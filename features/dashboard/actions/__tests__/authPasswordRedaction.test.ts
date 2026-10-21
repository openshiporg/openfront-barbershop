import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import * as ts from 'typescript';

import { redactPassword } from '../authFormData';

function returnedFormDataProperties(sourcePath: string): ts.PropertyAssignment[] {
  const source = readFileSync(resolve(process.cwd(), sourcePath), 'utf8');
  const sourceFile = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true);
  const properties: ts.PropertyAssignment[] = [];

  function visit(node: ts.Node) {
    if (ts.isReturnStatement(node) && node.expression && ts.isObjectLiteralExpression(node.expression)) {
      for (const property of node.expression.properties) {
        if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === 'formData') {
          properties.push(property);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return properties;
}

const cases = [
  {
    flow: 'sign-in',
    formData: { email: 'owner@example.com', password: 'sign-in-secret' },
    expected: { email: 'owner@example.com', password: '' },
  },
  {
    flow: 'sign-up',
    formData: { email: 'new@example.com', password: 'sign-up-secret' },
    expected: { email: 'new@example.com', password: '' },
  },
  {
    flow: 'initial-user',
    formData: { name: 'Owner', email: 'init@example.com', password: 'initial-secret' },
    expected: { name: 'Owner', email: 'init@example.com', password: '' },
  },
  {
    flow: 'password-reset',
    formData: { email: 'reset@example.com', password: 'reset-secret' },
    expected: { email: 'reset@example.com', password: '' },
  },
] as const;

for (const { flow, formData, expected } of cases) {
  test(`${flow} form state preserves safe fields and clears the submitted password`, () => {
    const result = redactPassword(formData);

    const submittedPassword = formData.password;

    assert.deepEqual(result, expected);
    assert.equal(JSON.stringify(result).includes(submittedPassword), false);
    assert.equal(formData.password, submittedPassword, 'redaction must not mutate the submitted form data');
  });
}

test('every auth action result redacts password-bearing form state', () => {
  const properties = returnedFormDataProperties('features/dashboard/actions/auth.ts');

  assert.ok(properties.length > 0);
  for (const property of properties) {
    assert.ok(
      ts.isCallExpression(property.initializer) && property.initializer.expression.getText() === 'redactPassword',
      `unredacted auth formData result: ${property.getText()}`,
    );
  }
});

test('initial-user UI forwards only the redacted action form state after failures', () => {
  const properties = returnedFormDataProperties('features/dashboard/screens/InitPage/index.tsx');

  assert.equal(properties.length, 2);
  for (const property of properties) {
    assert.equal(property.initializer.getText(), 'result.formData');
  }
});
