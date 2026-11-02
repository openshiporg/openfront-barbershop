// One signed-in person maps to one Customer per shop, and staff can merge the
// duplicates that already exist. Runs the real helpers against an in-memory
// store; no DB or network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function load(relative) {
  const { outputText } = ts.transpileModule(read(relative), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const module = { exports: {} };
  vm.runInNewContext(outputText, { module, exports: module.exports, require, Date });
  return module.exports;
}

const { resolveBookingCustomer } = load('features/keystone/utils/accountCustomer.ts');

// Minimal store that answers the queries resolveBookingCustomer makes, and lets
// the test record each booking the way createOnlineBooking does.
function store() {
  const customers = [];
  const appointments = [];
  let seq = 0;
  const matches = (row, where) => Object.entries(where).every(([key, value]) => (value && typeof value === 'object' && 'not' in value ? row[key] !== value.not : row[key] === value));
  return {
    customers, appointments,
    customer: {
      findFirst: async ({ where }) => customers.find((row) => matches(row, where)) || null,
      findUnique: async ({ where }) => customers.find((row) => row.userId === where.userId) || null,
      create: async ({ data }) => { const row = { id: `c${++seq}`, userId: null, ...data }; customers.push(row); return row; },
      update: async ({ where, data }) => Object.assign(customers.find((row) => row.id === where.id), data),
    },
    appointment: {
      findFirst: async ({ where }) => [...appointments].reverse().find((row) => matches(row, where)) || null,
    },
  };
}

async function book(db, accountId, contact = {}) {
  const customer = await resolveBookingCustomer(db, { shopId: 'shop1', firstName: 'QA', lastName: 'Test Customer', phone: '7185550199', email: 'qa@example.com', ...contact }, accountId);
  db.appointments.push({ id: `a${db.appointments.length + 1}`, shopId: 'shop1', accountId: accountId || null, customerId: customer.id });
  return customer;
}

test('two bookings by one signed-in account make one Customer', async () => {
  const db = store();
  const first = await book(db, 'user1');
  const second = await book(db, 'user1', { phone: '7185550100' });
  assert.equal(db.customers.length, 1);
  assert.equal(first.id, second.id);
  assert.equal(db.customers[0].userId, 'user1', 'the record is linked to the account');
  assert.equal(second.reused, true);
});

test('an account whose earlier booking made an unlinked Customer reuses and links it', async () => {
  const db = store();
  db.customers.push({ id: 'old', shopId: 'shop1', userId: null, email: 'qa@example.com' });
  db.appointments.push({ id: 'a0', shopId: 'shop1', accountId: 'user1', customerId: 'old' });
  const result = await book(db, 'user1');
  assert.equal(result.id, 'old');
  assert.equal(db.customers.length, 1);
  assert.equal(db.customers[0].userId, 'user1');
});

test('guests still get their own Customer: contact details are not authentication', async () => {
  const db = store();
  await book(db, 'user1');
  await book(db, null);
  await book(db, null);
  assert.equal(db.customers.length, 3, 'same phone and email as the account, still separate');
  assert.equal(db.customers.filter((row) => row.userId).length, 1);
});

test('email alone never claims someone else’s record', async () => {
  const db = store();
  db.customers.push({ id: 'walkin', shopId: 'shop1', userId: null, email: 'qa@example.com' });
  const result = await book(db, 'user2');
  assert.notEqual(result.id, 'walkin');
  assert.equal(db.customers.length, 2);
});
