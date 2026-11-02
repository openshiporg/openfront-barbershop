// Customer self-service on /appointment: the reschedule picker offers the barber's
// real open times (not a free-typed clock time), never the time already held, and
// both changes still go through review-then-confirm. No DB or network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relative) {
  const source = fs.readFileSync(path.resolve(root, relative), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const module = { exports: {} };
  vm.runInNewContext(outputText, { module, exports: module.exports, require, Intl, Date });
  return module.exports;
}

const lib = load('features/storefront/lib/reschedule.ts');

test('the held time is never offered as a new time', () => {
  const slots = [{ startsAt: '2026-11-06T14:30:00.000Z', label: '9:30 AM' }, { startsAt: '2026-11-06T16:00:00.000Z', label: '11:00 AM' }];
  assert.deepEqual(lib.rescheduleSlots(slots, '2026-11-06T14:30:00.000Z').map((slot) => slot.label), ['11:00 AM']);
  assert.equal(lib.rescheduleSlots(slots, null).length, 2);
  assert.equal(lib.rescheduleSlots(slots, '2026-11-06T14:30:00Z').length, 1, 'same instant, different spelling');
});

test('time zones read as a name, not an IANA id', () => {
  assert.equal(lib.timeZoneName('America/New_York'), 'Eastern Time');
  assert.equal(lib.timeZoneName('Not/AZone'), 'Not/AZone');
});

test('reschedule and cancel stay behind review then confirm, through the existing mutation', () => {
  const ui = fs.readFileSync(path.join(root, 'features/storefront/components/AppointmentSelfService.tsx'), 'utf8');
  assert.match(ui, /managePublicAppointment\(\{ \.\.\.request\(action\), preview: true \}\)/, 'review is a dry run');
  assert.match(ui, /acceptedFeeAmount: review\.feeAmount/, 'confirm carries the reviewed fee');
  assert.match(ui, /Confirm cancellation/);
  assert.match(ui, /Confirm new time/);
  assert.match(ui, /useSlots\(\{ serviceId: source\?\.serviceId/, 'times come from barber availability');
  const page = fs.readFileSync(path.join(root, 'features/storefront/screens/AppointmentStatusPage.tsx'), 'utf8');
  assert.match(page, /slotSource=\{/);
});
