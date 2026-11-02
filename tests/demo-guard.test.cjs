// Demo-account guard: features/keystone/lib/demo-guard.ts. Offline, no DB.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relative) {
  const filename = path.resolve(root, relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require, process, Symbol }, { filename });
  return module.exports;
}

const guard = load('features/keystone/lib/demo-guard.ts');
const { DEMO_GUARD_MESSAGE, withDemoGuard, DEMO_GUARD_POLICY, rewriteDemoErrors } = guard;
const env = { DEMO_USER_EMAILS: ' Other@example.com , BARBERSHOP@openship.org ' };

const DEMO = { itemId: 'demo', listKey: 'User', data: { email: 'barbershop@openship.org' } };
const ADMIN = { itemId: 'admin', listKey: 'User', data: { email: 'owner@openship.org' } };

// Lists shaped like the real ones; Service carries an existing hook to prove it still runs.
let serviceHookRan = 0;
const keys = ['User','Role','ShopMembership','Shop','ShopSettings','PaymentProvider','Appointment','AppointmentLineItem','WalkInQueueEntry','WaitlistEntry','Customer','CustomerPackage','ServiceCategory','ServicePackage','MembershipPlan','Product','Barber','CheckoutTransaction','PaymentSession','CashRefund','Tip','Commission','CommissionPayout'];
const base = Object.fromEntries(keys.map((k) => [k, { fields: {} }]));
const lists = withDemoGuard({
  ...base,
  Service: { fields: {}, hooks: { beforeOperation: { update: () => { serviceHookRan++; } } } },
}, DEMO_GUARD_POLICY, env);

function run(listKey, operation, session, { item, inputData } = {}) {
  const context = { session, sudo: () => context };
  const hook = lists[listKey].hooks?.beforeOperation;
  const fn = typeof hook === 'function' ? hook : hook?.[operation];
  if (!fn) return Promise.resolve();
  return fn({ listKey, operation, context, item, inputData, resolvedData: inputData });
}

async function refused(promise) {
  await assert.rejects(promise, (error) => error.message === DEMO_GUARD_MESSAGE);
}

test('the exact copy', () => {
  assert.equal(DEMO_GUARD_MESSAGE, "Demo accounts can't change this.");
});

test('demo + changed password, email, role or name is refused; users cannot be created or deleted', async () => {
  await refused(run('User', 'update', DEMO, { item: { id: 'demo' }, inputData: { password: 'x' } }));
  await refused(run('User', 'update', DEMO, { item: { id: 'demo' }, inputData: { email: 'a@b.c' } }));
  await refused(run('User', 'update', DEMO, { item: { id: 'demo' }, inputData: { role: { connect: { id: 'r' } } } }));
  await refused(run('User', 'update', DEMO, { item: { id: 'admin' }, inputData: { name: 'Hacked' } }));
  await refused(run('User', 'create', DEMO, { inputData: { name: 'New' } }));
  await refused(run('User', 'delete', DEMO, { item: { id: 'admin' } }));
  await run('User', 'update', DEMO, { item: { id: 'demo' }, inputData: { onboardingStatus: 'dismissed' } });
});

test('demo + Role and ShopMembership are locked', async () => {
  for (const key of ['Role', 'ShopMembership']) {
    await refused(run(key, 'create', DEMO, { inputData: {} }));
    await refused(run(key, 'update', DEMO, { item: { id: 'r' }, inputData: { name: 'X' } }));
    await refused(run(key, 'delete', DEMO, { item: { id: 'r' } }));
  }
});

test('demo + changed shop slug refused; unchanged allowed; name, tagline and logo ALLOWED', async () => {
  const item = { id: 's', name: 'Barbershop', slug: 'main', logoIcon: 'a', logoColor: '#111111' };
  await refused(run('Shop', 'update', DEMO, { item, inputData: { slug: 'other' } }));
  await run('Shop', 'update', DEMO, { item, inputData: { slug: ' main ', name: 'Barbershop', logoIcon: 'a' } });
  await run('Shop', 'update', DEMO, { item, inputData: { name: 'Barbershop QA', tagline: 'New line', logoIcon: 'b', logoColor: '#000000', hours: {}, phone: '1' } });
  await run('Shop', 'update', DEMO, { inputData: { name: 'No stored item' } });
  await refused(run('Shop', 'create', DEMO, { inputData: {} }));
  await refused(run('Shop', 'delete', DEMO, { item: { id: 's' } }));
  await run('ShopSettings', 'update', DEMO, { item: { id: 's' }, inputData: { name: 'Barbershop QA', tagline: 'x' } });
});

test('payment provider keys are protected when changed; name, isInstalled and metadata stay editable', async () => {
  const item = { id: 'pp', name: 'Stripe', code: 'pp_stripe', createPaymentFunction: 'create' };
  await refused(run('PaymentProvider', 'update', DEMO, { item, inputData: { credentials: { apiKey: 'k' } } }));
  await refused(run('PaymentProvider', 'update', DEMO, { item, inputData: { code: 'pp_other' } }));
  await refused(run('PaymentProvider', 'update', DEMO, { item, inputData: { handleWebhookFunction: 'x' } }));
  await refused(run('PaymentProvider', 'create', DEMO, { inputData: { code: 'x' } }));
  await refused(run('PaymentProvider', 'delete', DEMO, { item }));
  await run('PaymentProvider', 'update', DEMO, { item, inputData: { name: 'Stripe 2', code: 'pp_stripe', isInstalled: true, metadata: {} } });
});

test('demo cannot delete business records but can still create and edit them', async () => {
  const business = ['Appointment','AppointmentLineItem','WalkInQueueEntry','WaitlistEntry','Customer','CustomerPackage','Service','ServiceCategory','ServicePackage','MembershipPlan','Product','Barber','CheckoutTransaction','PaymentSession','CashRefund','Tip','Commission','CommissionPayout'];
  for (const key of business) {
    await refused(run(key, 'delete', DEMO, { item: { id: 'x' } }));
    await run(key, 'create', DEMO, { inputData: { name: 'New' } });
    await run(key, 'update', DEMO, { item: { id: 'x' }, inputData: { name: 'Edited', price: 10 } });
  }
  assert.equal(serviceHookRan, 1, 'the existing Service hook still runs');
});

test('a non-demo admin is unaffected', async () => {
  await run('User', 'update', ADMIN, { item: { id: 'demo' }, inputData: { password: 'x', email: 'a@b.c', role: {} } });
  await run('User', 'create', ADMIN, { inputData: { name: 'New' } });
  await run('Role', 'update', ADMIN, { item: { id: 'r' }, inputData: { name: 'Y' } });
  await run('Shop', 'update', ADMIN, { item: { id: 's' }, inputData: { slug: 'new' } });
  await run('Appointment', 'delete', ADMIN, { item: { id: 'a' } });
  await run('Customer', 'delete', ADMIN, { item: { id: 'c' } });
  await run('PaymentProvider', 'update', ADMIN, { item: { id: 'pp' }, inputData: { credentials: { k: 1 } } });
  await run('User', 'update', null, { item: { id: 'x' }, inputData: { password: 'x' } });
});

test('a session without data.email is resolved from the user record', async () => {
  const session = { itemId: 'demo', listKey: 'User' };
  const context = { session, sudo: () => ({ db: { User: { findOne: async () => ({ email: 'Barbershop@Openship.org' }) } } }) };
  await refused(lists.User.hooks.beforeOperation({ listKey: 'User', operation: 'update', context, item: { id: 'demo' }, inputData: { password: 'x' } }));
});

test('no DEMO_USER_EMAILS means no guard', async () => {
  const open = withDemoGuard({ Role: { fields: {} }, Appointment: { fields: {} } }, DEMO_GUARD_POLICY, {});
  await open.Role.hooks.beforeOperation({ listKey: 'Role', operation: 'delete', context: { session: DEMO }, item: { id: 'r' } });
  await open.Appointment.hooks.beforeOperation({ listKey: 'Appointment', operation: 'delete', context: { session: DEMO }, item: { id: 'r' } });
});

test('Keystone\'s hook wrapper is rewritten to the exact copy', () => {
  const wrapped = { message: `An error occurred while running "beforeOperation".\n  - Shop.hooks.beforeOperation: ${DEMO_GUARD_MESSAGE}`, path: ['updateShop'] };
  const other = { message: 'Something else' };
  const result = rewriteDemoErrors({ data: { updateShop: null }, errors: [wrapped, other] });
  assert.equal(result.errors[0].message, DEMO_GUARD_MESSAGE);
  assert.equal(result.errors[0].extensions.code, 'KS_ACCESS_DENIED');
  assert.equal(result.errors[1], other);
});

test('the guard is wired into the Keystone config and the GraphQL route', () => {
  const config = fs.readFileSync(path.join(root, 'features/keystone/index.ts'), 'utf8');
  assert.match(config, /lists: withDemoGuard\(models\)/);
  const route = fs.readFileSync(path.join(root, 'pages/api/graphql.ts'), 'utf8');
  assert.match(route, /useDemoGuardErrors\(\)/);
});
