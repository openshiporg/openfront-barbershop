import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Prisma } from '@prisma/client';
import { DELETE_HISTORY, deleteHistoryProblem, historyDeleteGuard } from '../features/keystone/utils/deleteHistoryGuard';

test('every delete-history reference is a real foreign key to that parent', () => {
  const models = Prisma.dmmf.datamodel.models;
  for (const [parent, rule] of Object.entries(DELETE_HISTORY)) {
    for (const ref of rule.references) {
      const model = models.find(m => m.name[0].toLowerCase() + m.name.slice(1) === ref.model);
      const relation = model?.fields.find(f => f.kind === 'object' && f.relationFromFields?.[0] === ref.field);
      assert.equal(relation?.type, parent, `${ref.model}.${ref.field} points at ${parent}`);
    }
  }
});

const prismaWith = (counts: Record<string, number>) => new Proxy({}, { get: (_t, model: string) => ({ count: async () => counts[model] || 0 }) });

test('records with history name it and how to retire them; unused records can go', async () => {
  assert.equal(await deleteHistoryProblem(prismaWith({ noShowEvent: 2 }), 'NoShowPolicy', 'p'), 'This has 2 no-show charges. Archive the policy instead; charged no-shows keep the policy they were charged under.');
  assert.equal(await deleteHistoryProblem(prismaWith({ user: 1 }), 'Role', 'r'), '1 person still has this role. Give them another role first.');
  assert.equal(await deleteHistoryProblem(prismaWith({}), 'NoShowPolicy', 'p'), null);
});

test('archive-only roots stay delete-denied by the relationship boundary', () => {
  const source = readFileSync(new URL('../features/keystone/utils/relationshipBoundaries.ts', import.meta.url), 'utf8');
  for (const list of ['Barber', 'Customer', 'Service', 'MembershipPlan', 'ServicePackage', 'BarberChair', 'Product', 'Supplier', 'PaymentProvider']) assert.ok(source.includes(`'${list}'`), list);
  assert.match(source, /delete: \(\) => false/);
});

test('nobody deletes their own account', async () => {
  const errors: string[] = [];
  await historyDeleteGuard('User')({ item: { id: 'u1' }, context: { session: { itemId: 'u1' }, prisma: prismaWith({}) }, addValidationError: (m: string) => errors.push(m) });
  assert.deepEqual(errors, ['You can’t delete your own account.']);
});

test('every guarded list wires the guard into its delete validation', () => {
  for (const list of Object.keys(DELETE_HISTORY)) {
    const source = readFileSync(new URL(`../features/keystone/models/${list}.ts`, import.meta.url), 'utf8');
    assert.match(source, new RegExp(`delete: historyDeleteGuard\\('${list}'\\)`), list);
  }
});

test('the migration fails closed and backs money and time ranges', () => {
  const sql = readFileSync(new URL('../migrations/20261107160000_barbershop_money_and_time_backstops/migration.sql', import.meta.url), 'utf8');
  assert.match(sql, /RAISE EXCEPTION/);
  for (const name of ['PaymentSession_refund_range_check', 'GiftCard_balance_range_check', 'Appointment_time_and_money_check', 'StaffShift_window_check', 'ProductSaleLine_quantity_money_check']) assert.ok(sql.includes(name), name);
});
