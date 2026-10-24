'use server';

import { revalidatePath } from 'next/cache';
import { getActiveShopChoicesAction } from '@/features/platform/barbershop/actions/shop';
import { dollarsToCents, formImage, platformRequest, trimmed } from '@/features/platform/lib/platformRequest';
import { uploadRecordImage } from '@/features/platform/lib/uploadImage';

/**
 * Edit commands for the service menu and retail catalog, in dollars. Writes go
 * through the normal Keystone lists, so list access and model hooks (deposit
 * rules, shop scoping) still decide; their messages come back to the form.
 */
export type CatalogKind = 'service' | 'product' | 'package' | 'plan';
type Result = { success: boolean; error?: string | null; id?: string };
type Option = { id: string; name: string };

export type CatalogRecord = {
  id: string;
  name: string;
  description: string;
  status: string;
  price: number;
  // service
  durationMinutes?: number;
  depositAmount?: number;
  bookingBufferMinutes?: number;
  credentialRequired?: boolean;
  waiverRequired?: boolean;
  categoryId?: string;
  barberIds?: string[];
  // product
  sku?: string;
  cost?: number;
  productType?: string;
  // plan
  billingInterval?: string;
  includedVisits?: number;
  discountPercent?: number;
  // package
  items?: Array<{ id: string; serviceId: string; quantity: number }>;
  hasImage?: boolean;
};

export type CatalogOptions = { shopName: string; categories: Option[]; barbers: Option[]; services: Option[] };

async function activeShop() {
  const choices = await getActiveShopChoicesAction();
  const shop = choices.activeShop || (choices.shops.length === 1 ? choices.shops[0] : null);
  return shop ? { id: shop.id, name: shop.name } : null;
}

export async function getCatalogOptionsAction(): Promise<CatalogOptions | null> {
  const shop = await activeShop();
  if (!shop) return null;
  const result = await platformRequest<{ serviceCategories: Option[]; barbers: Array<{ id: string; displayName: string }>; services: Option[] }>(`
    query CatalogOptions($shop: ID!) {
      serviceCategories(where: { shop: { id: { equals: $shop } } }, orderBy: [{ displayOrder: asc }, { name: asc }]) { id name }
      barbers(where: { shop: { id: { equals: $shop } }, status: { not: { equals: inactive } } }, orderBy: [{ displayName: asc }]) { id displayName }
      services(where: { shop: { id: { equals: $shop } }, status: { not: { equals: archived } } }, orderBy: [{ name: asc }]) { id name }
    }`, { shop: shop.id });
  if (!result.ok) return { shopName: shop.name, categories: [], barbers: [], services: [] };
  return { shopName: shop.name, categories: result.data.serviceCategories, barbers: result.data.barbers.map((barber) => ({ id: barber.id, name: barber.displayName })), services: result.data.services };
}

const QUERIES: Record<CatalogKind, string> = {
  service: `query($id: ID!) { item: service(where: { id: $id }) { id name description status price durationMinutes depositAmount depositRequired bookingBufferMinutes credentialRequired waiverRequired category { id } specialists { id } image { id } } }`,
  product: `query($id: ID!) { item: product(where: { id: $id }) { id name description status price sku cost productType image { id } } }`,
  package: `query($id: ID!) { item: servicePackage(where: { id: $id }) { id name description status price items { id quantity service { id } } } }`,
  plan: `query($id: ID!) { item: membershipPlan(where: { id: $id }) { id name description status price billingInterval includedVisits discountPercent } }`,
};

type RawItem = Record<string, unknown> & { category?: { id: string } | null; specialists?: Option[]; items?: Array<{ id: string; quantity: number; service?: { id: string } | null }> };

export async function getCatalogRecordAction(kind: CatalogKind, id: string): Promise<CatalogRecord | null> {
  const result = await platformRequest<{ item: RawItem | null }>(QUERIES[kind], { id });
  const item = result.ok ? result.data.item : null;
  if (!item) return null;
  return {
    id: String(item.id), name: String(item.name || ''), description: String(item.description || ''), status: String(item.status || ''), price: Number(item.price || 0),
    durationMinutes: item.durationMinutes as number | undefined,
    depositAmount: item.depositRequired ? Number(item.depositAmount || 0) : 0,
    bookingBufferMinutes: item.bookingBufferMinutes as number | undefined,
    credentialRequired: Boolean(item.credentialRequired), waiverRequired: Boolean(item.waiverRequired),
    categoryId: item.category?.id || '', barberIds: (item.specialists || []).map((barber) => barber.id),
    sku: String(item.sku || ''), cost: Number(item.cost || 0), productType: String(item.productType || 'other'),
    billingInterval: String(item.billingInterval || 'monthly'), includedVisits: Number(item.includedVisits ?? 1), discountPercent: Number(item.discountPercent ?? 0),
    items: (item.items || []).map((line) => ({ id: line.id, serviceId: line.service?.id || '', quantity: line.quantity })),
    hasImage: Boolean(item.image),
  };
}

const RETURN: Record<CatalogKind, string> = { service: '/dashboard/platform/services', product: '/dashboard/platform/inventory', package: '/dashboard/platform/services', plan: '/dashboard/platform/services' };
const STATUSES: Record<CatalogKind, string[]> = { service: ['active', 'hidden', 'archived'], product: ['active', 'draft', 'archived'], package: ['active', 'hidden', 'archived'], plan: ['active', 'paused', 'archived'] };
const MUTATION: Record<CatalogKind, { create: string; update: string; input: string }> = {
  service: { create: 'createService', update: 'updateService', input: 'Service' },
  product: { create: 'createProduct', update: 'updateProduct', input: 'Product' },
  package: { create: 'createServicePackage', update: 'updateServicePackage', input: 'ServicePackage' },
  plan: { create: 'createMembershipPlan', update: 'updateMembershipPlan', input: 'MembershipPlan' },
};

function readData(kind: CatalogKind, form: FormData, editing: boolean): { data: Record<string, unknown> } | { error: string } {
  const name = trimmed(form.get('name'), 120);
  const price = Number(form.get('price'));
  if (!name) return { error: 'Enter a name.' };
  if (!Number.isFinite(price) || price < 0 || price > 100000) return { error: 'Enter a valid price.' };
  const status = String(form.get('status') || 'active');
  if (!STATUSES[kind].includes(status)) return { error: 'Choose a valid status.' };
  const base = { name, description: trimmed(form.get('description'), 2000), price: dollarsToCents(price), status };
  if (kind === 'service') {
    const durationMinutes = Math.floor(Number(form.get('durationMinutes')));
    const deposit = Number(form.get('deposit') || 0);
    const buffer = Math.floor(Number(form.get('bookingBufferMinutes') || 0));
    if (!(durationMinutes >= 5 && durationMinutes <= 480)) return { error: 'Time in chair must be 5 to 480 minutes.' };
    if (!(deposit >= 0) || deposit > price) return { error: 'The deposit can’t be more than the price.' };
    if (!(buffer >= 0 && buffer <= 240)) return { error: 'Cleanup time must be 0 to 240 minutes.' };
    const categoryId = String(form.get('categoryId') || '');
    const barberIds = form.getAll('barberIds').map(String).filter(Boolean);
    return { data: {
      ...base, durationMinutes, bookingBufferMinutes: buffer, depositRequired: deposit > 0, depositAmount: dollarsToCents(deposit),
      credentialRequired: form.get('credentialRequired') === 'on',
      ...(categoryId ? { category: { connect: { id: categoryId } } } : editing ? { category: { disconnect: true } } : {}),
      specialists: editing ? { set: barberIds.map((id) => ({ id })) } : { connect: barberIds.map((id) => ({ id })) },
    } };
  }
  if (kind === 'product') {
    const cost = Number(form.get('cost') || 0);
    if (!(cost >= 0)) return { error: 'Enter a valid cost.' };
    const productType = String(form.get('productType') || 'other');
    return { data: { ...base, sku: trimmed(form.get('sku'), 60), cost: dollarsToCents(cost), productType } };
  }
  if (kind === 'plan') {
    const includedVisits = Math.floor(Number(form.get('includedVisits') || 0));
    const discountPercent = Math.floor(Number(form.get('discountPercent') || 0));
    const billingInterval = String(form.get('billingInterval') || 'monthly');
    if (!['monthly', 'quarterly', 'annual'].includes(billingInterval)) return { error: 'Choose a billing interval.' };
    if (!(includedVisits >= 0 && includedVisits <= 100)) return { error: 'Included visits must be 0 to 100.' };
    if (!(discountPercent >= 0 && discountPercent <= 100)) return { error: 'Discount must be 0 to 100%.' };
    return { data: { ...base, billingInterval, includedVisits, discountPercent } };
  }
  return { data: base };
}

function packageLines(form: FormData) {
  const lines = new Map<string, number>();
  form.getAll('itemService').forEach((service, index) => {
    const serviceId = String(service || '');
    const quantity = Math.floor(Number(form.getAll('itemQuantity')[index] || 0));
    if (serviceId && quantity > 0) lines.set(serviceId, (lines.get(serviceId) || 0) + quantity);
  });
  return [...lines.entries()].map(([serviceId, quantity]) => ({ serviceId, quantity }));
}

export async function saveCatalogRecordAction(kind: CatalogKind, id: string | null, form: FormData): Promise<Result> {
  const shop = await activeShop();
  if (!shop) return { success: false, error: 'Select an active shop first.' };
  const parsed = readData(kind, form, Boolean(id));
  if ('error' in parsed) return { success: false, error: parsed.error };
  const image = kind === 'service' || kind === 'product' ? formImage(form, 'image') : null;
  if (image && 'error' in image) return { success: false, error: image.error };
  const lines = kind === 'package' ? packageLines(form) : [];
  if (kind === 'package' && !lines.length) return { success: false, error: 'Add at least one service to the package.' };
  if (lines.some((line) => line.quantity > 50)) return { success: false, error: 'Use 50 visits or fewer per service.' };
  const names = MUTATION[kind];
  let savedId = id;

  if (id) {
    const result = await platformRequest<Record<string, { id: string } | null>>(`mutation($id: ID!, $data: ${names.input}UpdateInput!) { ${names.update}(where: { id: $id }, data: $data) { id } }`, { id, data: parsed.data });
    if (!result.ok) return { success: false, error: result.error };
    if (kind === 'package') {
      // Package contents are replaced as a whole: drop the old lines, add the new ones.
      const existing = await platformRequest<{ servicePackageItems: Array<{ id: string }> }>(`query($id: ID!) { servicePackageItems(where: { package: { id: { equals: $id } } }) { id } }`, { id });
      if (!existing.ok) return { success: false, error: existing.error };
      if (existing.data.servicePackageItems.length) {
        const removed = await platformRequest(`mutation($where: [ServicePackageItemWhereUniqueInput!]!) { deleteServicePackageItems(where: $where) { id } }`, { where: existing.data.servicePackageItems.map((item) => ({ id: item.id })) });
        if (!removed.ok) return { success: false, error: removed.error };
      }
    }
  } else {
    const result = await platformRequest<Record<string, { id: string } | null>>(`mutation($data: ${names.input}CreateInput!) { ${names.create}(data: $data) { id } }`, { data: { ...parsed.data, shop: { connect: { id: shop.id } } } });
    if (!result.ok) return { success: false, error: result.error };
    savedId = result.data[names.create]?.id || null;
    if (!savedId) return { success: false, error: 'This couldn’t be saved.' };
  }
  if (kind === 'package' && savedId) {
    const added = await platformRequest(`mutation($data: [ServicePackageItemCreateInput!]!) { createServicePackageItems(data: $data) { id } }`, { data: lines.map((line) => ({ package: { connect: { id: savedId } }, service: { connect: { id: line.serviceId } }, quantity: line.quantity })) });
    if (!added.ok) return { success: false, error: added.error };
  }
  if (image && savedId) {
    const uploaded = await uploadRecordImage(kind === 'service' ? 'Service' : 'Product', savedId, 'image', image);
    if (!uploaded.success) return { success: false, error: uploaded.error, id: savedId };
  }
  revalidatePath(RETURN[kind]);
  revalidatePath('/', 'layout');
  return { success: true, id: savedId || undefined };
}
