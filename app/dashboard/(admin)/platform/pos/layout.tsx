import { guardPlatformPage } from '@/features/platform/lib/guardPlatformPage';

export default async function Layout({ children }: { children: React.ReactNode }) {
  await guardPlatformPage('pos');
  return children;
}
