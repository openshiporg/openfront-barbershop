'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { sanitizeStoreLogoSvg } from '@/features/shared/sanitize-store-logo';
import {
  STOREFRONT_BRAND_COLOR_OPTIONS,
  type StorefrontBrandColor,
} from '@/features/shared/storefront-settings';
import { ActiveShopSelector } from '@/features/platform/barbershop/screens/ActiveShopSelector';
import type { ShopChoice } from '@/features/platform/barbershop/actions/shop';
import { LogoPicker } from '../components/LogoPicker';
import { DEFAULT_STORE_LOGO_ICON } from '../lib/store-logo';
import {
  updateActiveShopStorefrontSettingsAction,
  type ActiveShopStorefrontSettings,
} from '../actions/settings';

type ShopChoices = { success: boolean; error: string | null; activeShop: ShopChoice | null; shops: ShopChoice[]; total: number };

interface StoreSettingsPageClientProps {
  initialData: ActiveShopStorefrontSettings | null;
  initialError: string | null;
  shopChoices: ShopChoices;
}

type FormState = {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  timezone: string;
  currencyCode: string;
  brandColor: StorefrontBrandColor;
  logoIcon: string;
  logoColor: string;
  isPublic: boolean;
  isDemo: boolean;
};

function toForm(settings: ActiveShopStorefrontSettings): FormState {
  return {
    name: settings.name,
    tagline: settings.tagline || '',
    address: settings.address || '',
    phone: settings.phone || '',
    timezone: settings.timezone,
    currencyCode: settings.currencyCode,
    brandColor: settings.brandColor,
    logoIcon: settings.logoIcon || DEFAULT_STORE_LOGO_ICON,
    logoColor: settings.logoColor || '0',
    isPublic: settings.isPublic,
    isDemo: settings.isDemo,
  };
}

const same = (left: FormState, right: FormState) => JSON.stringify(left) === JSON.stringify(right);

export function StoreSettingsPageClient({ initialData, initialError, shopChoices }: StoreSettingsPageClientProps) {
  const [saved, setSaved] = useState<ActiveShopStorefrontSettings | null>(initialData);
  const [form, setForm] = useState<FormState | null>(initialData ? toForm(initialData) : null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef(form);
  formRef.current = form;

  const dirty = Boolean(form && saved && !same(form, toForm(saved)));
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const shopSelector = (
    <div className="mb-6">
      {shopChoices.success
        ? <ActiveShopSelector activeShop={shopChoices.activeShop} shops={shopChoices.shops} total={shopChoices.total} hasUnsavedChanges={() => dirtyRef.current} />
        : <p role="alert" className="text-sm text-destructive">{shopChoices.error}</p>}
    </div>
  );

  if (initialError || !initialData || !form || !saved) {
    return (
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Store Settings</h1>
        {shopSelector}
        <div role="alert" className="text-red-500">Error: {initialError || 'Select an active shop to edit its settings.'}</div>
      </div>
    );
  }

  const safeLogo = sanitizeStoreLogoSvg(form.logoIcon);
  const update = (patch: Partial<FormState>) => {
    setStatus('');
    setForm((current) => (current ? { ...current, ...patch } : current));
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!safeLogo) {
      setError('The logo SVG is invalid. Fix it or choose a library icon before saving.');
      return;
    }
    const submitted = form;
    setIsLoading(true);
    setError(null);
    setStatus('');
    try {
      const result = await updateActiveShopStorefrontSettingsAction(initialData.id, saved, submitted);
      if (!result.success || !result.data) {
        setError(result.error || 'Failed to update store settings.');
        return;
      }
      setSaved(result.data);
      // Apply the saved values only if nothing was edited while saving; newer
      // typing is kept (and stays marked unsaved).
      if (formRef.current && same(formRef.current, submitted)) setForm(toForm(result.data));
      setStatus('Store settings saved.');
    } catch {
      setError('The connection was interrupted. Your changes may not have been saved. Reload to check before saving again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Store Settings</h1>
      {shopSelector}

      <form onSubmit={handleSave} className="space-y-6" noValidate={false}>
        <div>
          <Label htmlFor="store-name">Shop Name</Label>
          <Input id="store-name" value={form.name} maxLength={120} required onChange={(e) => update({ name: e.target.value })} className="mt-2" />
        </div>

        <LogoPicker
          logoIcon={form.logoIcon}
          logoColor={form.logoColor}
          disabled={isLoading}
          onIconChange={(logoIcon) => update({ logoIcon })}
          onColorChange={(logoColor) => update({ logoColor })}
        />

        <div>
          <Label htmlFor="tagline">Tagline</Label>
          <Textarea id="tagline" value={form.tagline} maxLength={240} onChange={(e) => update({ tagline: e.target.value })} className="mt-2" />
        </div>

        <div>
          <Label htmlFor="address">Address</Label>
          <Input id="address" value={form.address} maxLength={300} onChange={(e) => update({ address: e.target.value })} className="mt-2" />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={form.phone} maxLength={40} onChange={(e) => update({ phone: e.target.value })} className="mt-2" />
          </div>
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" value={form.timezone} maxLength={100} required onChange={(e) => update({ timezone: e.target.value })} className="mt-2" />
          </div>
        </div>

        <div>
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" value={form.currencyCode} readOnly aria-describedby="currency-help" className="mt-2 uppercase" />
          <p id="currency-help" className="mt-1 text-xs text-muted-foreground">Payments are recorded in USD.</p>
        </div>

        <div>
          <Label id="brand-color-label">Storefront Color</Label>
          <RadioGroup
            aria-labelledby="brand-color-label"
            value={form.brandColor}
            onValueChange={(value) => update({ brandColor: value as StorefrontBrandColor })}
            disabled={isLoading}
            className="mt-2 grid gap-2 sm:grid-cols-3"
          >
            {STOREFRONT_BRAND_COLOR_OPTIONS.map((option) => (
              <Label key={option.value} htmlFor={`brand-${option.value}`} className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm font-normal has-[[data-state=checked]]:border-primary">
                <RadioGroupItem id={`brand-${option.value}`} value={option.value} />
                <span className="size-5 rounded-full border" style={{ backgroundColor: option.swatch }} aria-hidden="true" />
                <span>{option.label}</span>
              </Label>
            ))}
          </RadioGroup>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="published">Published Storefront</Label>
          <Switch id="published" checked={form.isPublic} disabled={isLoading} onCheckedChange={(isPublic) => update({ isPublic })} />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="demo">Sample Shop</Label>
          <Switch id="demo" checked={form.isDemo} disabled={isLoading} onCheckedChange={(isDemo) => update({ isDemo })} />
        </div>

        <div aria-live="polite" role="status" className="text-sm text-muted-foreground">
          {isLoading ? 'Saving…' : status || (dirty ? 'Unsaved changes' : '')}
        </div>
        {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={isLoading || !safeLogo || !dirty}>
          {isLoading ? 'Saving...' : 'Save Settings'}
        </Button>
      </form>
    </div>
  );
}
