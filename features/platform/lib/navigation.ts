import { BadgeDollarSign, BarChart3, Boxes, CalendarDays, ClipboardList, CreditCard, ListChecks, PackageOpen, Scissors, ScrollText, Settings, ShieldCheck, Wallet, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface PlatformNavItem {
  title: string
  href: string
  description: string
  icon: LucideIcon
  group?: string
}

export interface PlatformNavGroup {
  id: string
  title: string
  icon: LucideIcon
  items: PlatformNavItem[]
}

// Barbershop platform pages; hrefs are relative to the dashboard basePath, as in E-commerce
export const platformNavItems: PlatformNavItem[] = [
  {
    title: 'Booking board',
    href: '/platform/booking',
    description: 'Manage daily appointments, barber assignment, and appointment status flow.',
    icon: CalendarDays,
    group: 'shop-workflows',
  },
  {
    title: 'Walk-in queue',
    href: '/platform/queue',
    description: 'Track walk-ins, quoted waits, seated guests, and queue-to-appointment conversion.',
    icon: ListChecks,
    group: 'shop-workflows',
  },
  {
    title: 'Shop operations',
    href: '/platform/barbershop',
    description: 'Chairs, inventory, suppliers, commissions, tips, payouts, waitlist, and care records.',
    icon: ClipboardList,
    group: 'shop-workflows',
  },
  {
    title: 'Services & packages',
    href: '/platform/services',
    description: 'Maintain service catalog, pricing, packages, and memberships.',
    icon: PackageOpen,
    group: 'shop-workflows',
  },
  {
    title: 'Barbers & schedules',
    href: '/platform/staff',
    description: 'Manage barber profiles, specialties, chairs, and weekly availability.',
    icon: Scissors,
    group: 'shop-workflows',
  },
  {
    title: 'Customers',
    href: '/platform/customers',
    description: 'Review customer profiles, visit history, notes, and package balances.',
    icon: UsersRound,
    group: 'shop-workflows',
  },
  {
    title: 'POS checkout',
    href: '/platform/pos',
    description: 'Take payment for visits, record retail sales and returns, and review receipts.',
    icon: CreditCard,
    group: 'shop-workflows',
  },
  {
    title: 'Inventory',
    href: '/platform/inventory',
    description: 'Retail stock on hand, deliveries, waste and corrections, and suppliers.',
    icon: Boxes,
    group: 'shop-workflows',
  },
  {
    title: 'Payroll',
    href: '/platform/payroll',
    description: 'Approve commissions, pay barbers, and review payouts and tips.',
    icon: BadgeDollarSign,
    group: 'shop-workflows',
  },
  {
    title: 'Payments',
    href: '/platform/payments',
    description: 'Payment methods, takings by tender, receipts and card payment checks.',
    icon: Wallet,
    group: 'shop-workflows',
  },
  {
    title: 'Policies',
    href: '/platform/policies',
    description: 'Booking policy versions and no-show fees.',
    icon: ScrollText,
    group: 'shop-workflows',
  },
  {
    title: 'Team',
    href: '/platform/team',
    description: 'Who can sign in to the shop, their roles and access.',
    icon: ShieldCheck,
    group: 'shop-workflows',
  },
  {
    title: 'Reports',
    href: '/platform/reports',
    description: 'Revenue, appointments, walk-ins, and barber and service performance.',
    icon: BarChart3,
    group: 'shop-workflows',
  },
  {
    title: 'Store Settings',
    href: '/platform/store-settings',
    description: 'Shop identity, logo, storefront color, and publication.',
    icon: Settings,
    group: 'shop-workflows',
  },
]

export const platformStandaloneItems = platformNavItems.filter((item) => item.group === 'standalone')

export const platformNavGroups: PlatformNavGroup[] = [
  {
    id: 'shop-workflows',
    title: 'Shop workflows',
    icon: Scissors,
    items: platformNavItems.filter((item) => item.group === 'shop-workflows'),
  },
]

export function getPlatformNavItemsWithBasePath(basePath: string) {
  return platformNavItems.map((item) => ({ ...item, href: `${basePath}${item.href}` }))
}
