import test from 'node:test'
import assert from 'node:assert/strict'

// Needs a disposable database with migrations applied: RUN_DATABASE_TESTS=1 DATABASE_URL=... SESSION_SECRET=...
const enabled = process.env.RUN_DATABASE_TESTS === '1'
const FLAGS = ['canSeeOtherPeople','canEditOtherPeople','canManagePeople','canManageRoles','canAccessDashboard','canManageOnboarding','canManageServices','canManageStaff','canManageSchedules','canManageAppointments','canManageQueue','canManageCustomers','canManageCustomerNotes','canManageMemberships','canManagePayments','canViewReports'] as const
const ROLES: Record<string, { membership: string; flags: string[] }> = {
  admin: { membership: 'owner', flags: [...FLAGS] },
  manager: { membership: 'manager', flags: FLAGS.filter(f => f !== 'canManageRoles' && f !== 'canManagePeople') },
  frontdesk: { membership: 'front_desk', flags: ['canAccessDashboard','canManageAppointments','canManageQueue','canManageCustomers','canManageCustomerNotes','canManageMemberships','canManagePayments'] },
  barber: { membership: 'barber', flags: ['canAccessDashboard','canManageAppointments','canManageQueue','canManageCustomers','canManageCustomerNotes'] },
  viewer: { membership: 'viewer', flags: ['canAccessDashboard','canViewReports'] },
}

// [list query name, where builder]. Every probe is run once with a value that exists and once with one that does not.
const EXISTS = 'Zed', MISSING = 'Qqq'
// Roles that may legitimately read the filtered data (a differing count is then not a leak).
const allowedBy: Record<string, string[]> = {
  'user name': ['manager'], 'appointment notes': ['barber', 'frontdesk', 'manager'], 'transactions': ['frontdesk', 'manager'],
  'customer notes body': ['barber', 'frontdesk', 'manager'], 'package balances': ['frontdesk', 'manager'], 'account name': ['manager'],
  'payment sessions': ['frontdesk', 'manager'], 'customer phone': ['barber', 'frontdesk', 'manager'], 'note author name': ['manager'],
  'user role name': [], 'user memberships': ['manager'], 'user customer profile': ['manager'], 'role assignedTo': [],
  'shop memberships': ['manager'], 'shop payment sessions': ['frontdesk', 'manager'], 'shop customers': ['barber', 'frontdesk', 'manager'],
  'shop command receipts': ['manager'], 'barber user name': ['manager'], 'barber commissions': ['frontdesk', 'manager'],
  'service appointments': ['barber', 'frontdesk', 'manager'], 'provider sessions': ['frontdesk', 'manager'],
  'transaction customer': ['frontdesk', 'manager'], 'membership user name': ['manager'],
}
const probes: Array<[string, (v: string) => string, string]> = [
  ['customersCount', v => `{ user: { name: { startsWith: "${v}" } } }`, 'user name'],
  ['customersCount', v => `{ appointments: { some: { internalNotes: { startsWith: "${v}" } } } }`, 'appointment notes'],
  ['customersCount', v => `{ transactions: { some: { paymentMethod: { startsWith: "${v}" } } } }`, 'transactions'],
  ['customersCount', v => `{ notes: { some: { body: { startsWith: "${v}" } } } }`, 'customer notes body'],
  ['customersCount', v => `{ packageBalances: { some: { id: { startsWith: "${v}" } } } }`, 'package balances'],
  ['appointmentsCount', v => `{ account: { name: { startsWith: "${v}" } } }`, 'account name'],
  ['appointmentsCount', v => `{ paymentSessions: { some: { status: { equals: ${v === EXISTS ? 'captured' : 'failed'} } } } }`, 'payment sessions'],
  ['appointmentsCount', v => `{ customer: { phone: { startsWith: "${v === EXISTS ? '555' : '000'}" } } }`, 'customer phone'],
  ['customerNotesCount', v => `{ createdBy: { name: { startsWith: "${v}" } } }`, 'note author name'],
  ['usersCount', v => `{ role: { name: { startsWith: "${v}" } } }`, 'user role name'],
  ['usersCount', v => `{ shopMemberships: { some: { membershipRole: { equals: ${v === EXISTS ? 'owner' : 'viewer'} } } } }`, 'user memberships'],
  ['usersCount', v => `{ customerProfile: { firstName: { startsWith: "${v}" } } }`, 'user customer profile'],
  ['usersCount', v => `{ name: { startsWith: "${v}" } }`, 'user name'],
  ['rolesCount', v => `{ assignedTo: { some: { name: { startsWith: "${v}" } } } }`, 'role assignedTo'],
  ['shopsCount', v => `{ memberships: { some: { user: { name: { startsWith: "${v}" } } } } }`, 'shop memberships'],
  ['shopsCount', v => `{ paymentSessions: { some: { status: { equals: ${v === EXISTS ? 'captured' : 'failed'} } } } }`, 'shop payment sessions'],
  ['shopsCount', v => `{ customers: { some: { firstName: { startsWith: "${v}" } } } }`, 'shop customers'],
  ['shopsCount', v => `{ commandReceipts: { some: { aggregateType: { startsWith: "${v}" } } } }`, 'shop command receipts'],
  ['barbersCount', v => `{ user: { name: { startsWith: "${v}" } } }`, 'barber user name'],
  ['barbersCount', v => `{ commissions: { some: { commissionAmount: { gte: ${v === EXISTS ? 1 : 99999999} } } } }`, 'barber commissions'],
  ['servicesCount', v => `{ appointments: { some: { internalNotes: { startsWith: "${v}" } } } }`, 'service appointments'],
  ['paymentProvidersCount', v => `{ paymentSessions: { some: { status: { equals: ${v === EXISTS ? 'captured' : 'failed'} } } } }`, 'provider sessions'],
  ['checkoutTransactionsCount', v => `{ customer: { firstName: { startsWith: "${v}" } } }`, 'transaction customer'],
  ['shopMembershipsCount', v => `{ user: { name: { startsWith: "${v}" } } }`, 'membership user name'],
]

test('relation and scalar where-filters never reveal rows the role cannot read', { skip: !enabled }, async () => {
  const { keystoneContext } = await import('../features/keystone/context')
  const prisma = keystoneContext.prisma as any
  const sudo = keystoneContext.sudo()
  const tag = `flt${Date.now()}`
  const shop = await prisma.shop.create({ data: { name: 'Zed Cuts', slug: tag, status: 'active' } })
  const other = await prisma.shop.create({ data: { name: 'Other', slug: `${tag}b`, status: 'active' } })
  const people: Record<string, { id: string; session: any }> = {}
  for (const [key, def] of Object.entries(ROLES)) {
    const role = await prisma.role.create({ data: { name: `${tag}-${key}`, ...Object.fromEntries(def.flags.map(f => [f, true])) } })
    const user = await prisma.user.create({ data: { name: `Zed ${key}`, email: `${tag}-${key}@example.com`, password: 'x'.repeat(12), roleId: role.id, activeShopId: shop.id } })
    await prisma.shopMembership.create({ data: { shopId: shop.id, userId: user.id, membershipRole: def.membership, status: 'active', membershipKey: `${shop.id}:${user.id}` } })
    people[key] = { id: user.id, session: { itemId: user.id, listKey: 'User', data: { name: user.name, activeShop: { id: shop.id, slug: shop.slug, status: 'active' }, shopMemberships: [{ id: 'm', status: 'active', membershipRole: def.membership, shop: { id: shop.id, slug: shop.slug, status: 'active' } }], role: { id: role.id, name: role.name, ...Object.fromEntries(FLAGS.map(f => [f, def.flags.includes(f)])) } } } }
  }
  const customer = await prisma.customer.create({ data: { shopId: shop.id, firstName: 'Zed', lastName: 'Client', phone: '5551234', email: 'zed@example.com', userId: people.viewer.id } })
  const barber = await prisma.barber.create({ data: { shopId: shop.id, displayName: 'Zed Barber', userId: people.barber.id } })
  const appointment = await prisma.appointment.create({ data: { shopId: shop.id, customerId: customer.id, barberId: barber.id, accountId: people.viewer.id, startsAt: new Date(), internalNotes: 'Zed secret' } })
  const provider = await prisma.paymentProvider.create({ data: { shopId: shop.id, name: 'Manual', code: 'pp_manual' } })
  await prisma.paymentSession.create({ data: { shopId: shop.id, appointmentId: appointment.id, paymentProviderId: provider.id, amount: 1000, status: 'captured', idempotencyKeyHash: tag } })
  await prisma.customerNote.create({ data: { shopId: shop.id, customerId: customer.id, body: 'Zed private', createdById: people.admin.id, visibility: 'staff' } })
  void other

  const count = async (who: string | null, field: string, where: string) => {
    const ctx = who ? keystoneContext.withSession(people[who].session) : keystoneContext
    const res = await ctx.graphql.raw({ query: `query { ${field}(where: ${where}) }` })
    return res.errors?.length ? 'error' : String((res.data as any)?.[field])
  }

  const who: Array<string | null> = [null, 'viewer', 'barber', 'frontdesk', 'manager']
  const findings: string[] = []
  for (const role of who) {
    for (const [field, where, label] of probes) {
      const a = await count(role, field, where(EXISTS))
      const b = await count(role, field, where(MISSING))
      if ((allowedBy[label] ?? []).includes(role ?? '')) continue
      if (label === 'user name' && field === 'usersCount') continue // each person may read their own row
      if (a !== b && a !== 'error' && b !== 'error') findings.push(`${role ?? 'anonymous'} ${field} ${label}: exists=${a} missing=${b}`)
    }
  }
  // The same probes keep working for the admin where the data is readable.
  const adminHit = await count('admin', 'customersCount', `{ appointments: { some: { internalNotes: { startsWith: "${EXISTS}" } } } }`)
  const adminMiss = await count('admin', 'customersCount', `{ appointments: { some: { internalNotes: { startsWith: "${MISSING}" } } } }`)
  console.log(findings.join('\n') || 'no differing counts')
  assert.deepEqual(findings, [])
  assert.equal(adminHit, '1')
  assert.equal(adminMiss, '0')
  assert.equal(await count('admin', 'usersCount', `{ role: { name: { startsWith: "${tag}" } } }`), String(Object.keys(ROLES).length))
  void sudo
})
