import { Building2, Package } from 'lucide-react';
import seed from '../lib/seed.json';

export type BarbershopTemplateKey = 'full' | 'minimal';

export interface BarbershopTemplate {
  name: string;
  description: string;
  icon: React.ReactNode;
  displayNames: {
    categories: string[];
    services: string[];
    barbers: string[];
    memberships: string[];
    products: string[];
    policies: string[];
  };
}

const names = (rows: Array<{ name?: string; displayName?: string }> | undefined) => (rows || []).map((row) => row.name || row.displayName || '').filter(Boolean);

// Minimal mirrors selectSeedMode in scripts/seedBarbershopDemo.ts: two categories,
// up to three of their services, one barber, one product, no memberships.
const minimalCategories = seed.serviceCategories.slice(0, 2);
const minimalCategoryNames = new Set(names(minimalCategories));
const minimalServices = seed.services.filter((service) => minimalCategoryNames.has(service.category)).slice(0, 3);

export const BARBERSHOP_TEMPLATES: Record<BarbershopTemplateKey, BarbershopTemplate> = {
  full: {
    name: 'Full setup',
    description: 'The whole service menu, every barber with weekly hours, memberships, packages and retail.',
    icon: <Building2 className="h-5 w-5" />,
    displayNames: {
      categories: names(seed.serviceCategories),
      services: names(seed.services),
      barbers: names(seed.barbers),
      memberships: [...names(seed.membershipPlans), ...names(seed.servicePackages)],
      products: names(seed.products),
      policies: [...names(seed.bookingPolicies), ...names(seed.noShowPolicies)],
    },
  },
  minimal: {
    name: 'Minimal setup',
    description: 'A short menu and one barber, enough to take a first online booking.',
    icon: <Package className="h-5 w-5" />,
    displayNames: {
      categories: names(minimalCategories),
      services: names(minimalServices),
      barbers: names(seed.barbers.slice(0, 1)),
      memberships: [],
      products: names(seed.products.slice(0, 1)),
      policies: names(seed.bookingPolicies.slice(0, 1)),
    },
  },
};

export interface SectionDefinition {
  id: number;
  type: keyof BarbershopTemplate['displayNames'];
  label: string;
  getItemsFn: (template: BarbershopTemplateKey) => string[];
}

const section = (id: number, type: SectionDefinition['type'], label: string): SectionDefinition => ({
  id,
  type,
  label,
  getItemsFn: (template) => BARBERSHOP_TEMPLATES[template].displayNames[type],
});

export const SECTION_DEFINITIONS: SectionDefinition[] = [
  section(1, 'categories', 'Service categories'),
  section(2, 'services', 'Services'),
  section(3, 'barbers', 'Barbers & weekly hours'),
  section(4, 'memberships', 'Memberships & packages'),
  section(5, 'products', 'Retail products'),
  section(6, 'policies', 'Booking policies'),
];

// Same alias the reference onboarding exposes.
export const STORE_TEMPLATES = BARBERSHOP_TEMPLATES;
