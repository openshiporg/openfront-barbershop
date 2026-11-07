import assert from 'node:assert/strict';
import test from 'node:test';
import { closeOpenDepositSessions } from '../features/keystone/utils/expireStalePaymentSessions';

function fakeTx(rows: any[]) {
  const calls: any = { find: null, update: null };
  return {
    calls,
    tx: {
      paymentSession: {
        findMany: async (args: any) => { calls.find = args; return rows; },
        updateMany: async (args: any) => { calls.update = args; return { count: args.where.id.in.length }; },
      },
    } as any,
  };
}
const stripe = { code: 'stripe' };
const cash = { code: 'pay-in-person' };

test('only the online deposit checkout is expired and its provider id returned', async () => {
  const { tx, calls } = fakeTx([
    { id: 'a', providerPaymentId: 'cs_1', metadata: {}, paymentProvider: stripe },
    { id: 'b', providerPaymentId: 'cs_2', metadata: { purpose: 'desk_card' }, paymentProvider: stripe },
    { id: 'c', providerPaymentId: null, metadata: {}, paymentProvider: cash },
  ]);
  const ids = await closeOpenDepositSessions(tx, 'appt');
  assert.deepEqual(ids, ['cs_1']);
  assert.deepEqual(calls.update.where.id.in, ['a']);
  assert.equal(calls.update.data.status, 'expired');
  assert.equal(calls.update.where.status, 'pending');
  assert.equal(calls.find.where.appointmentId, 'appt');
});

test('nothing open means no write', async () => {
  const { tx, calls } = fakeTx([]);
  assert.deepEqual(await closeOpenDepositSessions(tx, 'appt'), []);
  assert.equal(calls.update, null);
});
