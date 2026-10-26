'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { sanitizeStoreLogoSvg } from '@/features/shared/sanitize-store-logo';
import { StoreLogo } from '@/features/storefront/components/StoreLogo';
import { HUE_PRESETS, LOGO_ICONS } from '../lib/icon-registry';
import { normalizeStoreLogoColor } from '../lib/store-logo';

const triggerClass = 'flex h-12 w-12 shrink-0 rounded-[6px] border border-input bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 p-0 overflow-hidden items-center justify-center';

type LogoPickerProps = {
  // The current logo draft exactly as edited; it is only saved when it sanitizes.
  logoIcon: string;
  logoColor: string;
  disabled?: boolean;
  onIconChange(value: string): void;
  onColorChange(value: string): void;
};

/** Compact logo controls adapted from E-commerce Store Settings, with sanitized previews. */
export function LogoPicker({ logoIcon, logoColor, disabled, onIconChange, onColorChange }: LogoPickerProps) {
  const safe = sanitizeStoreLogoSvg(logoIcon);
  const color = normalizeStoreLogoColor(logoColor);
  const selectedIcon = LOGO_ICONS.find((icon) => icon.lightSvg === logoIcon);

  return (
    <>
      <div>
        <Label id="logo-icon-label">Logo Icon</Label>
        <div className="mt-2 flex items-center gap-2">
          <Select
            value={selectedIcon?.id || ''}
            disabled={disabled}
            onValueChange={(id) => {
              const icon = LOGO_ICONS.find((item) => item.id === id);
              if (icon) onIconChange(icon.lightSvg);
            }}
          >
            <SelectPrimitive.Trigger aria-labelledby="logo-icon-label" aria-label={selectedIcon ? `Logo icon: ${selectedIcon.name}` : 'Logo icon: custom'} className={cn(triggerClass)}>
              <StoreLogo svg={safe || ''} color={color} className="size-6" />
            </SelectPrimitive.Trigger>
            <SelectContent>
              {LOGO_ICONS.map((icon) => (
                <SelectItem key={icon.id} value={icon.id}>
                  <span className="flex items-center gap-3">
                    <StoreLogo svg={icon.lightSvg} color={color} className="size-6" />
                    <span className="block font-medium">{icon.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="h-12 w-12 shrink-0 rounded-[6px] border-b shadow-none ring-0 focus-visible:ring-2" type="button" disabled={disabled} aria-label="Edit SVG code">
                <Code className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(500px,calc(100vw-2rem))]" align="start">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Edit SVG Code</h4>
                  <Label htmlFor="custom-svg" className="sr-only">SVG code</Label>
                </div>
                <Textarea
                  id="custom-svg"
                  value={logoIcon}
                  maxLength={100000}
                  aria-invalid={!safe}
                  aria-describedby="custom-svg-status"
                  onChange={(event) => onIconChange(event.target.value)}
                  className="font-mono text-xs min-h-[240px]"
                  placeholder="<svg>...</svg>"
                />
                <div id="custom-svg-status" className="flex items-center gap-2">
                  {safe ? (
                    <>
                      <div className="text-sm text-muted-foreground">Preview:</div>
                      <div className="flex items-center justify-center p-2 border rounded-[4px]"><StoreLogo svg={safe} color={color} /></div>
                    </>
                  ) : <p role="alert" className="text-sm text-destructive">Invalid SVG format. Fix the code or choose a library icon before saving.</p>}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        {!safe && <p role="alert" className="mt-2 text-sm text-destructive">The logo SVG is invalid and will not be saved.</p>}
      </div>

      <div>
        <Label id="logo-color-label">Logo Color</Label>
        <div className="mt-2">
          <Select value={HUE_PRESETS.some((preset) => String(preset.value) === color) ? color : undefined} disabled={disabled} onValueChange={(value) => onColorChange(value)}>
            <SelectPrimitive.Trigger aria-labelledby="logo-color-label" className={cn(triggerClass)}>
              <SelectValue>
                <div className="size-6 rounded-[4px]" style={{ background: `hsl(${(240 + Number(color)) % 360}, 70%, 50%)` }} />
              </SelectValue>
            </SelectPrimitive.Trigger>
            <SelectContent>
              <div className="grid grid-cols-4 gap-2 p-2">
                {HUE_PRESETS.map((preset) => (
                  <SelectItem
                    key={preset.value}
                    value={preset.value.toString()}
                    aria-label={preset.name}
                    className="cursor-pointer p-0 h-12 w-12 flex items-center justify-center [&>span:first-child]:hidden"
                  >
                    <div className="size-6 rounded-[4px]" style={{ background: `hsl(${(240 + preset.value) % 360}, 70%, 50%)` }} />
                  </SelectItem>
                ))}
              </div>
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  );
}
