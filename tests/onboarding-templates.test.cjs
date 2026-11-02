// Onboarding templates describe exactly what each setup size seeds, and the
// storefront header shows only a mark the shop chose. No DB or network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relative, modules = {}) {
  const { outputText } = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, { module, exports: module.exports, require: (name) => (name in modules ? modules[name] : require(name)) });
  return module.exports;
}

const seed = require('../features/platform/onboarding/lib/seed.json');
const stub = () => null;
const { BARBERSHOP_TEMPLATES, SECTION_DEFINITIONS } = load('features/platform/onboarding/config/templates.tsx', {
  '../lib/seed.json': { __esModule: true, default: seed },
  'lucide-react': { Building2: stub, Package: stub },
  'react/jsx-runtime': { jsx: () => null, jsxs: () => null },
});

test('full template lists every seeded record by name', () => {
  const full = BARBERSHOP_TEMPLATES.full.displayNames;
  assert.deepEqual(full.services, seed.services.map((s) => s.name));
  assert.deepEqual(full.barbers, seed.barbers.map((b) => b.displayName));
  assert.deepEqual(full.products, seed.products.map((p) => p.name));
  assert.equal(full.memberships.length, seed.membershipPlans.length + seed.servicePackages.length);
});

test('minimal template matches what selectSeedMode keeps', () => {
  const minimal = BARBERSHOP_TEMPLATES.minimal.displayNames;
  const categories = seed.serviceCategories.slice(0, 2).map((c) => c.name);
  assert.deepEqual(minimal.categories, categories);
  assert.deepEqual(minimal.services, seed.services.filter((s) => categories.includes(s.category)).slice(0, 3).map((s) => s.name));
  assert.deepEqual(minimal.barbers, [seed.barbers[0].displayName]);
  assert.equal(minimal.memberships.length, 0);
  const source = fs.readFileSync(path.join(root, 'features/platform/onboarding/scripts/seedBarbershopDemo.ts'), 'utf8');
  assert.match(source, /serviceCategories \?\? \[\]\)\.slice\(0, 2\)/);
  assert.match(source, /servicePackages: \[\],\s*membershipPlans: \[\]/);
});

test('every section reads its template list', () => {
  for (const section of SECTION_DEFINITIONS) assert.deepEqual(section.getItemsFn('full'), BARBERSHOP_TEMPLATES.full.displayNames[section.type]);
});

const DEFAULT = '<svg viewBox="0 0 24 48"><path d="M0 0"/></svg>';
const { storeOwnMark } = load('features/storefront/lib/store-mark.ts', {
  '@/features/shared/sanitize-store-logo': { sanitizeStoreLogoSvg: (svg) => (svg.startsWith('<svg') ? svg : '') },
  '@/features/platform/store-settings/lib/store-logo': { DEFAULT_STORE_LOGO_ICON: DEFAULT },
});

test('storefront always shows an icon beside the shop name', () => {
  assert.equal(storeOwnMark(''), DEFAULT);
  assert.equal(storeOwnMark(null), DEFAULT);
  assert.equal(storeOwnMark(DEFAULT), DEFAULT);
  assert.equal(storeOwnMark(`  ${DEFAULT} `), DEFAULT);
  assert.equal(storeOwnMark('not svg'), DEFAULT);
  const own = '<svg viewBox="0 0 24 24"><circle r="4"/></svg>';
  assert.equal(storeOwnMark(own), own);
});
