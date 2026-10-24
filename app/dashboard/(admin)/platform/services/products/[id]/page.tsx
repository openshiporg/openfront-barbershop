import { CatalogPage } from '@/features/platform/records/screens/CatalogPage';

export const dynamic = 'force-dynamic';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <CatalogPage kind="product" params={params} />;
}
