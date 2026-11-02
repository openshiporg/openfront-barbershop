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

function load(relative, modules = {}) {
  const { outputText } = ts.transpileModule(read(relative), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const module = { exports: {} };
  vm.runInNewContext(outputText, { module, exports: module.exports, require: (name) => modules[name] || require(name), Date, Intl });
  return module.exports;
}

const { resolveBookingCustomer } = load('features/keystone/utils/accountCustomer.ts');
const merge = load('features/keystone/utils/customerMerge.ts');

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

test('the merge moves every relation that points at a Customer', () => {
  const schema = read('schema.prisma');
  const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)]
    .filter(([, name, body]) => name !== 'User' && /\s+customer\s+Customer\?\s+@relation/.test(body))
    .map(([, name]) => name[0].toLowerCase() + name.slice(1)).sort();
  assert.deepEqual([...merge.CUSTOMER_RELATIONS].sort(), models);
  const mutation = read('features/keystone/mutations/manageCustomers.ts');
  for (const relation of merge.CUSTOMER_RELATIONS) {
    assert.match(mutation, new RegExp(`moved\\.${relation} = \\(await transaction\\.${relation}\\.updateMany\\(\\{ where, data \\}\\)\\)\\.count`), relation);
  }
  assert.match(mutation, /requireCurrentShopPermission\(context\.session, 'canManageCustomers', transaction\)[\s\S]*customer\.delete\(\{ where: \{ id: duplicate!\.id \} \}\)/, 'authorized before anything moves');
  assert.match(mutation, /customer-merge:\$\{hash\}:v1/, 'idempotent');
});

test('merge refuses unsafe pairs and only fills blanks', () => {
  const row = (id, extra = {}) => ({ id, shopId: 'shop1', userId: null, lastVisitAt: null, email: '', phone: '', acceptsMarketing: false, birthday: null, preferredBarberId: null, ...extra });
  assert.equal(merge.mergeRefusal(row('a'), row('a'), 'shop1'), 'Choose a different customer to merge into.');
  assert.equal(merge.mergeRefusal(row('a'), row('b', { shopId: 'shop2' }), 'shop1'), 'Customer not found.');
  assert.match(merge.mergeRefusal(row('a', { userId: 'u1' }), row('b', { userId: 'u2' }), 'shop1'), /two different online accounts/);
  assert.equal(merge.mergeRefusal(row('a', { userId: 'u1' }), row('b'), 'shop1'), null);
  const later = new Date('2026-11-01T00:00:00Z');
  const fields = merge.mergedCustomerFields(row('a', { phone: '111', acceptsMarketing: true }), row('b', { phone: '222', email: 'b@x.com', userId: 'u1', lastVisitAt: later }));
  assert.deepEqual(Object.keys(fields).sort(), ['acceptsMarketing', 'email', 'lastVisitAt', 'userId']);
  assert.equal(fields.email, 'b@x.com');
  assert.equal(fields.acceptsMarketing, false, 'consent is never widened');
  assert.equal(fields.phone, undefined, 'existing phone kept');
});

test('staff merge is behind a confirm step with one key per dialog', () => {
  const ui = read('features/platform/customers/components/MergeCustomerButton.tsx');
  assert.match(ui, /Merge into…/);
  assert.match(ui, /AlertDialogAction disabled=\{!keep\}/, 'nothing merges until a record to keep is chosen');
  assert.doesNotMatch(ui, /<select/, 'no native select: the Keep picker is a popover of rows');
  assert.match(ui, /<Popover open=\{open\}/);
  assert.match(ui, /role="option"/);
  assert.match(ui, /if \(next\) \{ setKey\(crypto\.randomUUID\(\)\)/);
  const page = read('features/platform/customers/screens/CustomersPageClient.tsx');
  assert.match(page, /mergeCustomersAction\(\{ keepCustomerId, duplicateCustomerId: customer\.id, idempotencyKey \}\)/);
});

const phone = load('features/platform/lib/phone.ts');
const picker = load('features/platform/customers/lib/mergeCandidates.ts', { '../../lib/phone': phone });

test('phones read as (718) 555-0199 and never get mangled', () => {
  assert.equal(phone.formatPhone('7185550199'), '(718) 555-0199');
  assert.equal(phone.formatPhone('+1 718-555-0199'), '(718) 555-0199');
  assert.equal(phone.formatPhone('17185550199'), '(718) 555-0199');
  assert.equal(phone.formatPhone('+44 20 7946 0958'), '+44 20 7946 0958', 'international kept as typed');
  assert.equal(phone.formatPhone('555-0199'), '555-0199', 'partial kept as typed');
  assert.equal(phone.formatPhone(null), '');
});

test('admin shows phones through the one helper', () => {
  const files = {
    'features/platform/customers/screens/CustomersPageClient.tsx': [/formatPhone\(customer\.phone\) \|\| customer\.email/, /formatPhone\(customer\.phone\) \|\| 'No phone'/],
    'features/platform/booking/screens/BookingBoardPageClient.tsx': [/formatPhone\(appointment\.customer\?\.phone\)/],
    'features/platform/booking/components/StaffBookingForm.tsx': [/formatPhone\(customer\.phone\)/],
    'features/platform/queue/screens/QueuePageClient.tsx': [/formatPhone\(entry\.phone\)/],
    'features/platform/barbershop/screens/WaitlistControls.tsx': [/>\{formatPhone\(entry\.phone\)\}<\/a>/],
    'features/platform/inventory/screens/SuppliersPage.tsx': [/formatPhone\(supplier\.phone\)/, /\{formatPhone\(value\)\}<\/a>/],
  };
  for (const [file, patterns] of Object.entries(files)) for (const pattern of patterns) assert.match(read(file), pattern, file);
});

test('merge choices with the same name and phone can be told apart', () => {
  const a = { id: 'a', name: 'QA Test Customer', phone: '7185550199', email: 'one@example.com', visits: 1, lastVisitAt: null, createdAt: '2026-11-01T15:00:00.000Z' };
  const b = { id: 'b', name: 'QA Test Customer', phone: '7185550199', email: 'one@example.com', visits: 3, lastVisitAt: '2026-11-06T15:00:00.000Z', createdAt: '2026-10-20T15:00:00.000Z' };
  const tz = 'America/New_York';
  const da = picker.candidateDetail(a, [a, b], tz);
  const db = picker.candidateDetail(b, [a, b], tz);
  assert.notEqual(da, db);
  assert.equal(da, '1 visit · added Nov 1, 2026');
  assert.equal(db, '3 visits · last visit Nov 6, 2026');
  const c = { ...b, id: 'c', email: 'two@example.com' };
  assert.match(picker.candidateDetail(c, [a, c], tz), /^two@example\.com · /, 'email shown when emails differ');
  const d = { ...a, id: 'd', phone: '7185550100' };
  assert.match(picker.candidateDetail(d, [a, d], tz), /^\(718\) 555-0100 · /, 'formatted phone shown when phones differ');
});
