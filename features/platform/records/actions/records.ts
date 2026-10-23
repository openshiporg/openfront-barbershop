'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { getActiveShopChoicesAction } from '@/features/platform/barbershop/actions/shop';

/**
 * Shop-workflow create commands. Records are written to the selected active
 * shop through the normal Keystone lists, so list access and shop hooks apply.
 */
type Result = { success: true; id: string } | { success: false; error: string };
export type Option = { id: string; name: string; number?: string };
export type RecordOptions = { shopName: string; categories: Option[]; barbers: Option[]; services: Option[]; chairs: Option[] };

async function activeShop() {
  const choices = await getActiveShopChoicesAction();
  const shop = choices.activeShop || (choices.shops.length === 1 ? choices.shops[0] : null);
  return shop ? { id: shop.id, name: shop.name } : null;
}

const cents = (dollars: number) => Math.round(dollars * 100);
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export async function getRecordOptionsAction(): Promise<RecordOptions | null> {
  const shop = await activeShop();
  if (!shop) return null;
  const response = await keystoneClient<{ serviceCategories: Option[]; barbers: Array<{ id: string; displayName: string }>; services: Option[]; barberChairs: Array<{ id: string; chairNumber: string; stationName?: string | null }> }>(`
    query RecordOptions($shop: ID!) {
      serviceCategories(where: { shop: { id: { equals: $shop } } }, orderBy: [{ name: asc }]) { id name }
      barbers(where: { shop: { id: { equals: $shop } }, status: { equals: active } }, orderBy: [{ displayName: asc }]) { id displayName }
      services(where: { shop: { id: { equals: $shop } } }, orderBy: [{ name: asc }]) { id name }
      barberChairs(where: { shop: { id: { equals: $shop } } }, orderBy: [{ chairNumber: asc }]) { id chairNumber stationName }
    }
  `, { shop: shop.id }, { cache: 'no-store' });
  if (!response.success) return { shopName: shop.name, categories: [], barbers: [], services: [], chairs: [] };
  return {
    shopName: shop.name,
    categories: response.data.serviceCategories,
    barbers: response.data.barbers.map((barber) => ({ id: barber.id, name: barber.displayName })),
    services: response.data.services,
    chairs: response.data.barberChairs.map((chair) => ({ id: chair.id, number: chair.chairNumber, name: chair.stationName ? `Chair ${chair.chairNumber} · ${chair.stationName}` : `Chair ${chair.chairNumber}` })),
  };
}

async function create(mutation: string, field: string, data: Record<string, unknown>, paths: string[]): Promise<Result> {
  const shop = await activeShop();
  if (!shop) return { success: false, error: 'Select an active shop first.' };
  const response = await keystoneClient<Record<string, { id: string } | null>>(mutation, { data: { ...data, shop: { connect: { id: shop.id } } } });
  const created = response.success ? response.data[field] : null;
  if (!created?.id) return { success: false, error: 'This record couldn’t be saved. Check the fields and try again.' };
  for (const path of paths) revalidatePath(path);
  return { success: true, id: created.id };
}

export async function createServiceAction(input: { name: string; description: string; categoryId: string; durationMinutes: number; price: number; deposit: number; barberIds: string[]; status: 'active' | 'hidden' }): Promise<Result> {
  const name = text(input.name, 120);
  const durationMinutes = Math.floor(Number(input.durationMinutes));
  const price = Number(input.price);
  const deposit = Number(input.deposit || 0);
  if (!name) return { success: false, error: 'Enter a service name.' };
  if (!(durationMinutes >= 5 && durationMinutes <= 480)) return { success: false, error: 'Time in chair must be 5 to 480 minutes.' };
  if (!(price >= 0 && price <= 100000)) return { success: false, error: 'Enter a valid price.' };
  if (!(deposit >= 0) || deposit > price) return { success: false, error: 'The deposit can’t be more than the price.' };
  return create(`mutation CreateService($data: ServiceCreateInput!) { createService(data: $data) { id } }`, 'createService', {
    name,
    description: text(input.description, 2000),
    durationMinutes,
    price: cents(price),
    depositRequired: deposit > 0,
    depositAmount: cents(deposit),
    status: input.status === 'hidden' ? 'hidden' : 'active',
    ...(input.categoryId ? { category: { connect: { id: input.categoryId } } } : {}),
    ...(input.barberIds.length ? { specialists: { connect: input.barberIds.map((id) => ({ id })) } } : {}),
  }, ['/dashboard/platform/services', '/']);
}

export async function createBarberAction(input: { displayName: string; chairId: string; chairNumber: string; phone: string; email: string; bio: string; serviceIds: string[] }): Promise<Result> {
  const displayName = text(input.displayName, 120);
  if (!displayName) return { success: false, error: 'Enter the barber’s name.' };
  return create(`mutation CreateBarber($data: BarberCreateInput!) { createBarber(data: $data) { id } }`, 'createBarber', {
    displayName,
    phone: text(input.phone, 40),
    email: text(input.email, 254),
    bio: text(input.bio, 2000),
    ...(input.chairId ? { chair: { connect: { id: input.chairId } }, chairNumber: text(input.chairNumber, 40) } : {}),
    ...(input.serviceIds.length ? { specialties: { connect: input.serviceIds.map((id) => ({ id })) } } : {}),
  }, ['/dashboard/platform/staff', '/barbers']);
}

export async function createCustomerAction(input: { firstName: string; lastName: string; phone: string; email: string }): Promise<Result> {
  const firstName = text(input.firstName, 120);
  const phone = text(input.phone, 40);
  if (!firstName || !phone) return { success: false, error: 'Enter a first name and phone number.' };
  return create(`mutation CreateCustomer($data: CustomerCreateInput!) { createCustomer(data: $data) { id } }`, 'createCustomer', {
    firstName, lastName: text(input.lastName, 120), phone, email: text(input.email, 254),
  }, ['/dashboard/platform/customers']);
}

export async function createProductAction(input: { name: string; sku: string; price: number; cost: number; description: string }): Promise<Result> {
  const name = text(input.name, 120);
  const price = Number(input.price);
  const cost = Number(input.cost || 0);
  if (!name) return { success: false, error: 'Enter a product name.' };
  if (!(price >= 0 && price <= 100000) || !(cost >= 0)) return { success: false, error: 'Enter a valid price and cost.' };
  return create(`mutation CreateProduct($data: ProductCreateInput!) { createProduct(data: $data) { id } }`, 'createProduct', {
    name, sku: text(input.sku, 60), price: cents(price), cost: cents(cost), description: text(input.description, 2000),
  }, ['/dashboard/platform/services']);
}
