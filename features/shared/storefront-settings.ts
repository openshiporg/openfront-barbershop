export const STOREFRONT_BRAND_PRESETS = {
  amber: {
    label: 'Cobalt',
    swatch: '#155eef',
    variables: {
      '--color-accent': 'oklch(50% 0.2 263)',
      '--color-accent-hover': 'oklch(43% 0.19 263)',
      '--color-accent-ink': 'oklch(98% 0.01 263)',
      '--color-accent-soft': 'oklch(92% 0.04 263)',
      '--color-focus': 'oklch(60% 0.2 263)',
    },
  },
  indigo: {
    label: 'Indigo',
    swatch: '#4f46e5',
    variables: {
      '--color-accent': 'oklch(66% 0.17 275)',
      '--color-accent-hover': 'oklch(57% 0.2 275)',
      '--color-accent-ink': 'oklch(98% 0.01 275)',
      '--color-accent-soft': 'oklch(91% 0.04 275)',
      '--color-focus': 'oklch(70% 0.18 275)',
    },
  },
  emerald: {
    label: 'Emerald',
    swatch: '#059669',
    variables: {
      '--color-accent': 'oklch(68% 0.14 160)',
      '--color-accent-hover': 'oklch(58% 0.15 160)',
      '--color-accent-ink': 'oklch(16% 0.025 160)',
      '--color-accent-soft': 'oklch(91% 0.045 160)',
      '--color-focus': 'oklch(72% 0.16 160)',
    },
  },
  rose: {
    label: 'Rose',
    swatch: '#e11d48',
    variables: {
      '--color-accent': 'oklch(67% 0.18 20)',
      '--color-accent-hover': 'oklch(57% 0.21 20)',
      '--color-accent-ink': 'oklch(98% 0.01 20)',
      '--color-accent-soft': 'oklch(92% 0.045 20)',
      '--color-focus': 'oklch(72% 0.18 20)',
    },
  },
  slate: {
    label: 'Slate',
    swatch: '#475569',
    variables: {
      '--color-accent': 'oklch(63% 0.035 255)',
      '--color-accent-hover': 'oklch(50% 0.04 255)',
      '--color-accent-ink': 'oklch(98% 0.005 255)',
      '--color-accent-soft': 'oklch(91% 0.015 255)',
      '--color-focus': 'oklch(70% 0.08 255)',
    },
  },
} as const;

export type StorefrontBrandColor = keyof typeof STOREFRONT_BRAND_PRESETS;

export const STOREFRONT_BRAND_COLOR_OPTIONS = Object.entries(STOREFRONT_BRAND_PRESETS).map(
  ([value, preset]) => ({ value: value as StorefrontBrandColor, label: preset.label, swatch: preset.swatch }),
);

export function isStorefrontBrandColor(value: unknown): value is StorefrontBrandColor {
  return typeof value === 'string' && Object.hasOwn(STOREFRONT_BRAND_PRESETS, value);
}

export function requireStorefrontBrandColor(value: unknown): StorefrontBrandColor {
  if (!isStorefrontBrandColor(value)) {
    throw new Error('Choose one of the supported storefront brand colors.');
  }
  return value;
}

export function storefrontBrandStyle(value: StorefrontBrandColor) {
  return STOREFRONT_BRAND_PRESETS[value].variables;
}

/**
 * Storefront theme: the merchant's logo colour drives the accent, as in Openfront
 * Restaurant (the default mark is blue, ~260° in OKLCH, so brand hue = 260 + logo
 * hue). A logo left at its default colour keeps the chosen preset accent. Only a
 * normalized number reaches CSS, so a malformed value cannot inject styles.
 */
export function storefrontThemeStyle(brandColor: StorefrontBrandColor, logoColor?: string | null): Record<string, string> {
  const preset = { ...STOREFRONT_BRAND_PRESETS[brandColor].variables } as Record<string, string>;
  const numeric = Number.parseFloat(String(logoColor ?? '0'));
  const logoHue = Number.isFinite(numeric) ? ((numeric % 360) + 360) % 360 : 0;
  if (!logoHue) return preset;
  const hue = Math.round((260 + logoHue) % 360);
  return {
    ...preset,
    '--color-accent': `oklch(68% 0.15 ${hue})`,
    '--color-accent-hover': `oklch(56% 0.17 ${hue})`,
    '--color-accent-ink': `oklch(17% 0.03 ${hue})`,
    '--color-accent-soft': `oklch(91% 0.045 ${hue})`,
    '--color-focus': `oklch(66% 0.17 ${hue})`,
  };
}

export type PublicStorefrontSettings = {
  id: string;
  name: string;
  tagline: string | null;
  address: string | null;
  phone: string | null;
  timezone: string;
  currencyCode: string;
  hours: Record<string, unknown> | null;
  brandColor: StorefrontBrandColor;
  logoIcon?: string;
  logoColor?: string;
  isDemo: boolean;
};

export function phoneHref(phone?: string | null) {
  const digits = phone?.replace(/\D/g, '') || '';
  return digits.length >= 7 ? `+${digits}` : null;
}
