'use server';

import { revalidatePath } from 'next/cache';
import { activeShop } from '@/features/platform/lib/activeShop';
import { platformRequest, trimmed } from '@/features/platform/lib/platformRequest';

export type CategoryRow = { id: string; name: string; description: string | null; displayOrder: number | null; status: string; servicesCount: number };

export async function getCategoriesAction(): Promise<{ shopName: string; categories: CategoryRow[] } | null> {
  const shop = await activeShop();
  if (!shop) return null;
  const result = await platformRequest<{ serviceCategories: CategoryRow[] }>(`
    query($shop: ID!) { serviceCategories(where: { shop: { id: { equals: $shop } } }, orderBy: [{ displayOrder: asc }, { name: asc }]) { id name description displayOrder status servicesCount } }`, { shop: shop.id });
  return { shopName: shop.name, categories: result.ok ? result.data.serviceCategories : [] };
}

function read(form: FormData) {
  const name = trimmed(form.get('name'), 120);
  const displayOrder = Math.floor(Number(form.get('displayOrder') || 0));
  if (!name) return { error: 'Enter a category name.' } as const;
  if (!(displayOrder >= 0 && displayOrder <= 999)) return { error: 'Order must be 0 to 999.' } as const;
  return { data: { name, description: trimmed(form.get('description'), 500), displayOrder } } as const;
}

export async function saveCategoryAction(id: string | null, form: FormData) {
  const shop = await activeShop();
  if (!shop) return { success: false, error: 'Select an active shop first.' };
  const parsed = read(form);
  if ('error' in parsed) return { success: false, error: parsed.error };
  const result = id
    ? await platformRequest(`mutation($id: ID!, $data: ServiceCategoryUpdateInput!) { updateServiceCategory(where: { id: $id }, data: $data) { id } }`, { id, data: parsed.data })
    : await platformRequest(`mutation($data: ServiceCategoryCreateInput!) { createServiceCategory(data: $data) { id } }`, { data: { ...parsed.data, status: 'active', shop: { connect: { id: shop.id } } } });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath('/dashboard/platform/services', 'layout');
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function setCategoryStatusAction(id: string, status: string) {
  if (!['active', 'hidden'].includes(status)) return { success: false, error: 'Choose shown or hidden.' };
  const result = await platformRequest(`mutation($id: ID!, $status: ServiceCategoryStatusType) { updateServiceCategory(where: { id: $id }, data: { status: $status }) { id } }`, { id, status });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath('/dashboard/platform/services', 'layout');
  revalidatePath('/', 'layout');
  return { success: true };
}
