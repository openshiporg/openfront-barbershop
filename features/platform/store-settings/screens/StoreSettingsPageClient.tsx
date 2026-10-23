'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { StoreLogo } from '@/features/storefront/components/StoreLogo';
import { hoursTextToTimes, SHOP_HOURS_DAYS, timesToHoursText } from '@/features/shared/shop-hours';
import { Notice, PageHeader, Pill, PillLink, StatusDot, Track } from '@/features/platform/lib/ui';
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
  hours: Record<string, string>;
};

const DAY_LABELS: Record<string, string> = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

function toHours(hours: Record<string, unknown> | null | undefined) {
  return Object.fromEntries(SHOP_HOURS_DAYS.map((day) => {
    const value = hours?.[day];
    return [day, typeof value === 'string' && hoursTextToTimes(value) ? value.trim() : 'Closed'];
  }));
}

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
    hours: toHours(settings.hours),
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
      <div className="max-w-2xl space-y-6 px-4 py-6 md:px-6">
        <PageHeader title="Store Settings" tone="alert" />
        {shopSelector}
        <Notice tone="alert">{initialError || 'Select an active shop to edit its settings.'}</Notice>
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

  const swatch = STOREFRONT_BRAND_COLOR_OPTIONS.find((option) => option.value === form.brandColor)?.swatch;

  return (
    <div className="flex min-w-0 flex-col gap-6 px-4 py-6 md:px-6">
      <PageHeader
        title="Store Settings"
        tone={saved.isPublic ? 'live' : 'off'}
        meta={saved.isPublic ? 'Storefront published' : 'Storefront unpublished'}
        actions={<Track><PillLink href="/">View storefront</PillLink></Track>}
      />
      {shopSelector}

      <form onSubmit={handleSave} className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]" noValidate={false}>
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="settings-identity" className="space-y-4">
            <h2 id="settings-identity" className="border-b pb-2 text-sm font-semibold">Identity</h2>
            <div>
              <Label htmlFor="store-name">Shop Name</Label>
              <Input id="store-name" value={form.name} maxLength={120} required onChange={(e) => update({ name: e.target.value })} className="mt-2" />
            </div>
            <div className="flex flex-wrap gap-6">
              <LogoPicker
                logoIcon={form.logoIcon}
                logoColor={form.logoColor}
                disabled={isLoading}
                onIconChange={(logoIcon) => update({ logoIcon })}
                onColorChange={(logoColor) => update({ logoColor })}
              />
            </div>
            <div>
              <Label htmlFor="tagline">Tagline</Label>
              <Textarea id="tagline" value={form.tagline} maxLength={240} onChange={(e) => update({ tagline: e.target.value })} className="mt-2" />
            </div>
            <div>
              <Label id="brand-color-label">Storefront Color</Label>
              <Track label="Storefront Color" className="mt-2">
                {STOREFRONT_BRAND_COLOR_OPTIONS.map((option) => (
                  <Pill key={option.value} size="sm" variant="flat" role="radio" aria-checked={form.brandColor === option.value} disabled={isLoading} onClick={() => update({ brandColor: option.value as StorefrontBrandColor })}>
                    <span className="size-3.5 rounded-full ring-1 ring-black/10" style={{ backgroundColor: option.swatch }} aria-hidden="true" />{option.label}
                  </Pill>
                ))}
              </Track>
            </div>
          </section>

          <section aria-labelledby="settings-shop" className="space-y-4">
            <h2 id="settings-shop" className="border-b pb-2 text-sm font-semibold">Shop</h2>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={form.address} maxLength={300} onChange={(e) => update({ address: e.target.value })} className="mt-2" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} maxLength={40} onChange={(e) => update({ phone: e.target.value })} className="mt-2 font-mono" />
              </div>
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Input id="timezone" value={form.timezone} maxLength={100} required onChange={(e) => update({ timezone: e.target.value })} className="mt-2 font-mono" />
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" value={form.currencyCode} readOnly aria-describedby="currency-help" className="mt-2 font-mono uppercase" />
                <p id="currency-help" className="mt-1 text-xs text-muted-foreground">USD only</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="settings-hours" className="space-y-1">
            <h2 id="settings-hours" className="border-b pb-2 text-sm font-semibold">Hours</h2>
            {SHOP_HOURS_DAYS.map((day) => {
              const times = hoursTextToTimes(form.hours[day]);
              const setDay = (text: string) => update({ hours: { ...form.hours, [day]: text } });
              return (
                <div key={day} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b py-2.5 last:border-b-0">
                  <Label htmlFor={`hours-${day}`} className="w-12 shrink-0"><StatusDot tone={times ? 'live' : 'off'} />{DAY_LABELS[day]}</Label>
                  <Switch id={`hours-${day}`} aria-label={`Open ${DAY_LABELS[day]}`} checked={Boolean(times)} disabled={isLoading} onCheckedChange={(open) => setDay(open ? '9:00 AM - 7:00 PM' : 'Closed')} />
                  {times ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <Input type="time" aria-label={`${DAY_LABELS[day]} opens`} value={times.open} step={900} disabled={isLoading} onChange={(e) => e.target.value && setDay(timesToHoursText(e.target.value, times.close))} className="w-32 font-mono" />
                      <span className="text-muted-foreground">–</span>
                      <Input type="time" aria-label={`${DAY_LABELS[day]} closes`} value={times.close} step={900} disabled={isLoading} onChange={(e) => e.target.value && setDay(timesToHoursText(times.open, e.target.value))} className="w-32 font-mono" />
                    </span>
                  ) : <span className="text-sm text-muted-foreground">Closed</span>}
                </div>
              );
            })}
          </section>

          <section aria-labelledby="settings-publish" className="space-y-1">
            <h2 id="settings-publish" className="border-b pb-2 text-sm font-semibold">Publication</h2>
            <div className="flex items-center justify-between gap-4 border-b py-3">
              <Label htmlFor="published"><StatusDot tone={form.isPublic ? 'live' : 'off'} />Published Storefront</Label>
              <Switch id="published" checked={form.isPublic} disabled={isLoading} onCheckedChange={(isPublic) => update({ isPublic })} />
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <Label htmlFor="demo" className="grid gap-0.5"><span><StatusDot tone={form.isDemo ? 'wait' : 'off'} />Sample Shop</span><span className="text-xs font-normal text-muted-foreground">{form.isDemo ? 'Hidden from search engines' : 'Listed for search engines'}</span></Label>
              <Switch id="demo" checked={form.isDemo} disabled={isLoading} onCheckedChange={(isDemo) => update({ isDemo })} />
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-6 xl:self-start" aria-label="Preview and save">
          <div className="overflow-hidden rounded-2xl ring-1 ring-border">
            <div className="flex items-center justify-between gap-2 bg-zinc-900 px-3 py-1.5 text-[11px] text-zinc-300"><span className="truncate"><StatusDot tone={form.isPublic ? 'live' : 'off'} />{form.address || 'Address'}</span><span className="font-mono">{form.phone}</span></div>
            <div className="flex items-center gap-2.5 bg-[#f6f3ee] px-4 py-4 text-[#111a33]">
              {safeLogo ? <StoreLogo svg={safeLogo} color={form.logoColor} className="size-7" /> : <span className="size-7 rounded bg-red-200" aria-hidden="true" />}
              <span className="min-w-0 truncate text-xl font-extrabold uppercase tracking-tight">{form.name || 'Shop name'}</span>
              <span className="ml-auto shrink-0 rounded-full bg-[#111a33] px-3 py-1 text-xs font-semibold text-white">Book</span>
            </div>
            <div className="h-1.5" style={{ background: `repeating-linear-gradient(-45deg, #c62f2a 0 6px, #f6f3ee 6px 12px, ${swatch || '#155eef'} 12px 18px, #f6f3ee 18px 24px)` }} aria-hidden="true" />
            {form.tagline ? <p className="bg-[#f6f3ee] px-4 pb-4 pt-3 text-xs text-[#4b5268]">{form.tagline}</p> : null}
          </div>

          <div aria-live="polite" role="status" className="font-mono text-xs text-muted-foreground">
            {isLoading ? 'Saving…' : status || (dirty ? 'Unsaved changes' : 'Saved')}
          </div>
          {error && <Notice tone="alert">{error}</Notice>}
          <Track block>
            <Pill type="submit" variant="primary" disabled={isLoading || !safeLogo || !dirty}>
              {isLoading ? 'Saving…' : 'Save Settings'}
            </Pill>
          </Track>
        </aside>
      </form>
    </div>
  );
}
