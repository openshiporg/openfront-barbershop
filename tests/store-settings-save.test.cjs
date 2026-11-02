// Store Settings save path: what updateActiveShopStorefrontSettingsAction sends.
// sanitizeStoreLogoSvg -> normalizeStoreLogoColor -> mutation variables. Offline.
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
  vm.runInNewContext(output, { module, exports: module.exports }, { filename });
  return module.exports;
}

const { sanitizeStoreLogoSvg } = load('features/keystone/utils/storeLogo.ts');
const { normalizeStoreLogoColor } = load('features/platform/store-settings/lib/store-logo.ts');
const { LOGO_ICONS } = load('features/platform/store-settings/lib/icon-registry.ts');
const action = fs.readFileSync(path.join(root, 'features/platform/store-settings/actions/settings.ts'), 'utf8');

// Mirrors the logo part of updateActiveShopStorefrontSettingsAction.
function variables(data) {
  const logoIcon = sanitizeStoreLogoSvg(data.logoIcon);
  if (!logoIcon) return { success: false, error: 'Invalid SVG format.' };
  return { success: true, data: { ...data, logoIcon, logoColor: normalizeStoreLogoColor(data.logoColor) } };
}

test('the action sanitizes, normalizes and sends both logo fields', () => {
  assert.match(action, /const logoIcon = sanitizeStoreLogoSvg\(data\.logoIcon\)/);
  assert.match(action, /logoColor: normalizeStoreLogoColor\(data\.logoColor\)/);
  assert.match(action, /logoIcon: \$logoIcon\s+logoColor: \$logoColor/);
});

test('a preset icon and hue reach the mutation unchanged', () => {
  const icon = LOGO_ICONS.find((entry) => entry.id === 'acme-corp').lightSvg;
  assert.deepEqual(variables({ name: 'Shop', logoIcon: icon, logoColor: '120' }).data, { name: 'Shop', logoIcon: icon, logoColor: '120' });
});

test('every preset survives the sanitizer', () => {
  for (const icon of LOGO_ICONS) assert.equal(variables({ logoIcon: icon.lightSvg, logoColor: '0' }).success, true, icon.id);
});

test('a pasted custom SVG is kept, trimmed', () => {
  const svg = '<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m48 11h-17z" fill="#087443"/></svg>';
  assert.equal(variables({ logoIcon: `\n${svg} `, logoColor: '0' }).data.logoIcon, svg);
});

test('the hue is normalized to 0-359', () => {
  const icon = LOGO_ICONS[0].lightSvg;
  assert.equal(variables({ logoIcon: icon, logoColor: '-90' }).data.logoColor, '270');
  assert.equal(variables({ logoIcon: icon, logoColor: '400' }).data.logoColor, '40');
  assert.equal(variables({ logoIcon: icon, logoColor: 'red' }).data.logoColor, '0');
});

test('an unsafe SVG rejects the save', () => {
  assert.equal(variables({ logoIcon: '<svg onload="alert(1)"></svg>', logoColor: '0' }).success, false);
});
