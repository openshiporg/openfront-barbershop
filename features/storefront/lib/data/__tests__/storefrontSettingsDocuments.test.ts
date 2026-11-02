// GraphQL documents must live outside 'use server' modules: a production build
// only lets those modules export async functions. Runs in the Railway build.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.cwd(), 'features/storefront/lib/data');
const read = (name: string) => fs.readFileSync(path.join(dir, name), 'utf8');
const isServerModule = (source: string) => /^\s*(?:\/\/[^\n]*\n\s*)*['"]use server['"]/.test(source);

test('storefront settings query lives in a plain module', () => {
  const contracts = read('settings-contracts.ts');
  assert.equal(isServerModule(contracts), false);
  assert.match(contracts, /export const PUBLIC_STOREFRONT_SETTINGS_QUERY = gql`/);
  for (const field of ['id', 'name', 'brandColor', 'logoIcon', 'logoColor']) assert.match(contracts, new RegExp(`\\n\\s+${field}\\n`));
});

test('use server data modules export no GraphQL documents', () => {
  for (const name of fs.readdirSync(dir).filter((file) => /\.tsx?$/.test(file))) {
    const source = read(name);
    if (!isServerModule(source)) continue;
    assert.doesNotMatch(source, /export const \w+\s*=\s*gql`/, `${name} exports a gql document from a 'use server' module`);
  }
});
