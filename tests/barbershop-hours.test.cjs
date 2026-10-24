// Posted shop hours: parsing, clipping barber windows, validation and next opening.
// Node's built-in runner; the module is transpiled in memory. No DB or network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative) {
  const source = fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const module = { exports: {} };
  vm.runInNewContext(outputText, { module, exports: module.exports, require });
  return module.exports;
}

const hours = load('features/shared/shop-hours.ts');
const week = { monday: '9:00 AM - 7:00 PM', tuesday: 'Closed', wednesday: '9:00 AM - 7:00 PM', thursday: '9:00 AM - 8:00 PM', friday: '9:00 AM - 8:00 PM', saturday: '8:00 AM - 6:00 PM', sunday: '10:00 AM - 4:00 PM' };

test('parses ranges, closed days and a midnight close', () => {
  assert.deepEqual({ ...hours.parseHoursRange('9:00 AM - 7:00 PM') }, { startMinute: 540, endMinute: 1140 });
  assert.equal(hours.parseHoursRange('Closed'), 'closed');
  assert.deepEqual({ ...hours.parseHoursRange('6:00 PM - 12:00 AM') }, { startMinute: 1080, endMinute: 1440 });
  assert.equal(hours.parseHoursRange('4:00 PM - 9:00 AM'), null);
});

test('clips a barber window to posted hours and closes unposted days', () => {
  assert.deepEqual({ ...hours.clipToPostedHours({ startMinute: 660, endMinute: 1140 }, week, 'sunday') }, { startMinute: 660, endMinute: 960 });
  assert.equal(hours.clipToPostedHours({ startMinute: 540, endMinute: 1140 }, week, 'tuesday'), null);
  assert.deepEqual({ ...hours.clipToPostedHours({ startMinute: 540, endMinute: 600 }, null, 'monday') }, { startMinute: 540, endMinute: 600 });
});

test('validates merchant hours and normalises blanks to Closed', () => {
  const ok = hours.normalizeShopHours({ ...week, sunday: '' });
  assert.equal(ok.hours.sunday, 'Closed');
  assert.match(hours.normalizeShopHours({ ...week, monday: '7 PM - 9 AM' }).error, /Monday/);
});

test('round-trips time inputs and reports the next opening', () => {
  assert.equal(hours.timesToHoursText('09:00', '00:00'), '9:00 AM - 12:00 AM');
  assert.deepEqual({ ...hours.hoursTextToTimes('9:00 AM - 12:00 AM') }, { open: '09:00', close: '00:00' });
  assert.equal(hours.nextPostedOpening(week, 'friday', 21 * 60), 'Opens Sat 8:00 AM');
  assert.equal(hours.nextPostedOpening(week, 'monday', 7 * 60), 'Opens 9:00 AM');
  assert.equal(hours.nextPostedOpening(week, 'monday', 20 * 60), 'Opens Wed 9:00 AM');
});
