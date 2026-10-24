import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

/** Uploads one image to a record's image field through the list API (S3 storage). */
export async function uploadRecordImage(list: 'Service' | 'Product' | 'Barber', id: string, field: 'image' | 'photo', file: File) {
  const result = await keystoneClient(`mutation($id: ID!, $data: ${list}UpdateInput!) { update${list}(where: { id: $id }, data: $data) { id } }`, { id, data: { [field]: { upload: file } } });
  return result.success ? { success: true as const } : { success: false as const, error: 'The image couldn’t be uploaded. Try a smaller file.' };
}
