import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { isDisposableLocalFixtureTarget, isLocalFixtureShop, type FixtureQueryClient } from '../../../keystone/utils/localFixtureAuthority'
import { runSerializableTransaction } from '../../../keystone/utils/serializableTransaction'
import { strictPrisma } from '../../../keystone/utils/strictPrisma'
import { assertUsdSettlementCurrency } from '../../../keystone/utils/supportedSettlementCurrency'
import { sanitizeStoreLogoSvg } from '../../../shared/sanitize-store-logo'
import { normalizeStoreLogoColor } from '../../store-settings/lib/store-logo'

type SeedRecord = Record<string, unknown>
type KeystoneItem = SeedRecord & { id: string }

type KeystoneListApi = {
  findMany(args: SeedRecord): Promise<KeystoneItem[]>
  createOne(args: SeedRecord): Promise<KeystoneItem>
  updateOne(args: SeedRecord): Promise<KeystoneItem>
}

type KeystoneDbListApi = {
  updateOne(args: SeedRecord): Promise<unknown>
}

export type BarbershopSeedContext = {
  session?: { itemId?: string | null; data?: { activeShop?: { id?: string | null } | null } | Record<string, unknown> }
  withSession?(session: { itemId: string; listKey: string; data: Record<string, unknown> }): BarbershopSeedContext
  sudo(): KeystoneSudoContext
  prisma?: PrismaClientLike
}

type KeystoneSudoContext = {
  query: Record<string, KeystoneListApi>
  db: Record<string, KeystoneDbListApi>
}

type PrismaClientLike = Record<string, unknown> & { $disconnect?: () => Promise<void> }

/** Onboarding seeds configuration only, matching E-commerce and Restaurant:
 * shop profile, policies, catalog, staff, chairs, weekly hours and retail
 * products. It never writes customers, appointments, queue entries, received
 * stock, package/membership balances, payments, commissions or payouts. */
type SeedData = {
  shop?: SeedRecord
  paymentProviders?: SeedRecord[]
  noShowPolicies?: SeedRecord[]
  bookingPolicies?: SeedRecord[]
  serviceCategories?: SeedRecord[]
  services?: SeedRecord[]
  barbers?: SeedRecord[]
  products?: SeedRecord[]
  suppliers?: SeedRecord[]
  schedules?: SeedRecord[]
  servicePackages?: SeedRecord[]
  membershipPlans?: SeedRecord[]
}

export type BarbershopSeedMode = 'minimal' | 'full'
export type SeedStats = Record<string, { created: number; reused: number; skipped?: number }>

export type BarbershopSeedResult = {
  mode: BarbershopSeedMode
  runtime: { host: string; port: string; dbName: string }
  summary: Record<string, number>
  stats: SeedStats
  dryRun: boolean
}

const REQUIRED_LOCAL_RUNTIME_DATABASE = 'runtime_barbershop'
const SAFE_LOCAL_DB_HOSTS = new Set(['127.0.0.1', 'localhost'])

const seedPath = path.resolve(process.cwd(), 'features/platform/onboarding/lib/seed.json')
const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]) === path.resolve(process.cwd(), 'features/platform/onboarding/scripts/seedBarbershopDemo.ts')
  : false

export function describeSeedDatabase(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required before onboarding can save shop setup.')
  }

  const parsed = new URL(databaseUrl)
  const dbName = parsed.pathname.replace(/^\//, '')
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error(`Barbershop onboarding requires PostgreSQL, not ${parsed.protocol}.`)
  }
  if (!dbName) throw new Error('DATABASE_URL must include a database name.')
  return { host: parsed.hostname, port: parsed.port || '5432', dbName }
}

/** Local CLI protection only. The authenticated onboarding mutation deliberately
 * accepts customer-managed PostgreSQL hosts and database names. */
export function assertSafeLocalSeedDatabase(databaseUrl = process.env.DATABASE_URL) {
  const target = describeSeedDatabase(databaseUrl)
  if (!SAFE_LOCAL_DB_HOSTS.has(target.host)) {
    throw new Error(`Refusing local seed CLI against non-local database host ${target.host}.`)
  }
  const isDisposableRuntime = /^runtime_barbershop_(?:verify|ephemeral)_[a-z0-9_]+$/.test(target.dbName)
  if (target.dbName !== REQUIRED_LOCAL_RUNTIME_DATABASE && !isDisposableRuntime) {
    throw new Error(`Refusing local seed CLI against ${target.dbName}; expected ${REQUIRED_LOCAL_RUNTIME_DATABASE} or a disposable verify/ephemeral runtime.`)
  }
  return target
}

function loadSeed(): SeedData {
  return JSON.parse(fs.readFileSync(seedPath, 'utf8')) as SeedData
}

function selectSeedMode(seed: SeedData, mode: BarbershopSeedMode): SeedData {
  if (mode === 'full') return seed

  const categories = (seed.serviceCategories ?? []).slice(0, 2)
  const categoryNames = new Set(categories.map((item) => text(item.name)))
  const services = (seed.services ?? []).filter((item) => categoryNames.has(text(item.category))).slice(0, 3)
  const serviceNames = new Set(services.map((item) => text(item.name)))
  const barbers: SeedRecord[] = (seed.barbers ?? []).slice(0, 1).map((item): SeedRecord => ({
    ...item,
    specialties: Array.isArray(item.specialties)
      ? item.specialties.filter((name) => serviceNames.has(text(name)))
      : [],
  }))
  const barberNames = new Set(barbers.map((item) => text(item.displayName)))

  return {
    shop: seed.shop,
    paymentProviders: (seed.paymentProviders ?? []).slice(0, 1),
    bookingPolicies: (seed.bookingPolicies ?? []).slice(0, 1),
    noShowPolicies: [],
    serviceCategories: categories,
    services,
    barbers,
    products: (seed.products ?? []).slice(0, 1),
    suppliers: (seed.suppliers ?? []).slice(0, 1),
    schedules: (seed.schedules ?? []).filter((item) => barberNames.has(text(item.barber))),
    servicePackages: [],
    membershipPlans: [],
  }
}

function stat(stats: SeedStats, key: string, field: 'created' | 'reused' | 'skipped' = 'created') {
  stats[key] ??= { created: 0, reused: 0, skipped: 0 }
  stats[key][field] = (stats[key][field] ?? 0) + 1
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export type DemoPractitionerCredentialSeed = {
  barberName: string
  serviceName: string
  credentialType: 'barber'
  credentialNumber: string
  issuingAuthority: string
  jurisdictionCode: string
  scopeDescription: string
  evidenceHash: string
  status: 'active'
  effectiveFrom: string
  expiresAt: string
  verifiedAt: string
  supervisionRequired: false
}

/** Disposable local runtimes only (see localFixtureAuthority). These values are
 * deliberately self-describing so they can never be mistaken for a license. */
export function buildDemoPractitionerCredentialSeeds(barbers: SeedRecord[], jurisdictionCode: string): DemoPractitionerCredentialSeed[] {
  const jurisdiction = text(jurisdictionCode, 'US-NY')
  return barbers.flatMap((barber) => {
    const barberName = text(barber.displayName)
    const specialties = Array.isArray(barber.specialties) ? barber.specialties.map((service) => text(service)).filter(Boolean) : []
    return specialties.map((serviceName) => {
      const seedKey = `${jurisdiction}:${barberName}:${serviceName}`
      const keyHash = createHash('sha256').update(seedKey).digest('hex')
      return {
        barberName,
        serviceName,
        credentialType: 'barber' as const,
        credentialNumber: `DEMO-NOT-A-LICENSE-${keyHash.slice(0, 12).toUpperCase()}`,
        issuingAuthority: 'DEMO ONLY — onboarding authority fixture; not a licensing authority',
        jurisdictionCode: jurisdiction,
        scopeDescription: `DEMO ONLY — seeded authority for ${barberName} to provide ${serviceName}; not legal credential proof`,
        evidenceHash: createHash('sha256').update(`demo-practitioner-authority:${seedKey}:v1`).digest('hex'),
        status: 'active' as const,
        effectiveFrom: '2020-01-01T00:00:00.000Z',
        expiresAt: '2099-12-31T23:59:59.000Z',
        verifiedAt: '2020-01-01T00:00:00.000Z',
        supervisionRequired: false as const,
      }
    })
  })
}

export function demoCredentialRerunAction(existing?: { status?: unknown } | null): 'create' | 'reuse' | 'skip' {
  if (!existing) return 'create'
  return existing.status === 'active' ? 'reuse' : 'skip'
}

function optionalConnect(id?: string) {
  return id ? { connect: { id } } : undefined
}

// Each seed run carries its own request context through async continuations, so
// overlapping onboarding requests cannot read each other's session or sudo context.
const seedContextStorage = new AsyncLocalStorage<BarbershopSeedContext>()

function getSudoContext() {
  const context = seedContextStorage.getStore()
  if (!context) throw new Error('Barbershop seed context is required.')
  return context.sudo()
}

function getPrismaClient() {
  return seedContextStorage.getStore()?.prisma
}

function getSeedSessionUserId() {
  return seedContextStorage.getStore()?.session?.itemId || undefined
}

function getSeedSessionActiveShopId() {
  const data = seedContextStorage.getStore()?.session?.data as { activeShop?: { id?: string | null } | null } | undefined
  return data?.activeShop?.id || undefined
}

function hasPrismaDelegate(delegateName: string) {
  return Boolean(getPrismaClient()?.[delegateName])
}

async function findFirst(listKey: string, where: SeedRecord, query = 'id') {
  const sudo = getSudoContext()
  const items = await sudo.query[listKey].findMany({ where, take: 1, query })
  return items[0] ?? null
}

/** Reruns only fill in missing setup inside the caller's own shop. A matching
 * record is left exactly as the operator last saved it; it is never overwritten. */
async function findOrCreate(
  stats: SeedStats,
  listKey: string,
  where: SeedRecord,
  data: SeedRecord,
  query = 'id'
) {
  const existing = await findFirst(listKey, where, query)
  if (existing) {
    stat(stats, listKey, 'reused')
    return existing
  }

  const sudo = getSudoContext()
  const created = await sudo.query[listKey].createOne({ data, query })
  stat(stats, listKey, 'created')
  return created
}

type ShopPrisma = {
  shopMembership: {
    findMany(args: SeedRecord): Promise<Array<{ shopId: string; shop: { id: string; jurisdictionCode: string } }>>
    create(args: SeedRecord): Promise<unknown>
  }
  shop: {
    findFirst(args: SeedRecord): Promise<{ id: string } | null>
    findUnique(args: SeedRecord): Promise<{ id: string } | null>
    create(args: SeedRecord): Promise<{ id: string; jurisdictionCode: string }>
  }
  user: { update(args: SeedRecord): Promise<unknown> }
}

function slugify(value: string) {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'barbershop'
}

function seedShopData(shop: SeedRecord) {
  const timezone = text(shop.timezone, 'America/New_York')
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format() } catch { throw new Error('Timezone must be a valid IANA timezone.') }
  const currencyCode = text(shop.currencyCode, 'USD')
  assertUsdSettlementCurrency(currencyCode)
  const logoIcon = typeof shop.logoIcon === 'string' && shop.logoIcon.trim() ? sanitizeStoreLogoSvg(shop.logoIcon) : ''
  if (typeof shop.logoIcon === 'string' && shop.logoIcon.trim() && !logoIcon) throw new Error('Invalid SVG format.')
  return {
    name: text(shop.name, 'Barbershop'),
    legalName: text(shop.legalName, text(shop.name, 'Barbershop')),
    status: 'active',
    tagline: text(shop.tagline),
    address: text(shop.address),
    phone: text(shop.phone),
    timezone,
    currencyCode,
    jurisdictionCode: text(shop.jurisdictionCode, 'US-NY'),
    hours: (shop.hours ?? {}) as object,
    brandColor: text(shop.brandColor, 'amber'),
    ...(logoIcon ? { logoIcon } : {}),
    ...(shop.logoColor !== undefined ? { logoColor: normalizeStoreLogoColor(shop.logoColor) } : {}),
    isDemo: true,
  }
}

/**
 * Setup binds to a shop the caller already owns, or creates a brand-new shop
 * owned by the caller in one transaction. It never adopts an existing shop by
 * slug, name or contact details, and never grants authority over a shop the
 * caller does not already own.
 */
async function resolveCallerShop(stats: SeedStats, userId: string, shopSeed: SeedRecord) {
  const client = getPrismaClient()
  if (!client) throw new Error('Shop setup requires the database client.')
  const prisma = strictPrisma(client)
  const activeShopId = getSeedSessionActiveShopId()
  return runSerializableTransaction(prisma as never, async (client) => {
    const transaction = client as ShopPrisma
    const owned = await transaction.shopMembership.findMany({
      where: { userId, status: 'active', membershipRole: 'owner', shop: { status: 'active' } },
      select: { shopId: true, shop: { select: { id: true, jurisdictionCode: true } } },
      orderBy: { createdAt: 'asc' },
    })
    if (owned.length) {
      const selected = owned.find((membership) => membership.shopId === activeShopId) ?? (owned.length === 1 ? owned[0] : null)
      if (!selected) throw new Error('Select the shop you want to set up, then run setup again.')
      return { id: selected.shop.id, jurisdictionCode: selected.shop.jurisdictionCode, created: false }
    }

    const data = seedShopData(shopSeed)
    const baseSlug = slugify(text(shopSeed.slug, data.name))
    let slug = baseSlug
    for (let attempt = 0; attempt < 5 && await transaction.shop.findUnique({ where: { slug }, select: { id: true } }); attempt += 1) {
      slug = `${baseSlug}-${randomBytes(3).toString('hex')}`
    }
    // The flattened storefront publishes exactly one shop; never make a second
    // public shop that would take another merchant's storefront offline.
    const otherPublicShop = await transaction.shop.findFirst({ where: { status: 'active', isPublic: true }, select: { id: true } })
    const shop = await transaction.shop.create({
      data: { ...data, slug, isPublic: !otherPublicShop },
      select: { id: true, jurisdictionCode: true },
    })
    await transaction.shopMembership.create({
      data: { membershipKey: `${shop.id}:${userId}`, shopId: shop.id, userId, membershipRole: 'owner', status: 'active' },
    })
    await transaction.user.update({ where: { id: userId }, data: { activeShopId: shop.id } })
    return { id: shop.id, jurisdictionCode: shop.jurisdictionCode, created: true }
  }).then((shop) => {
    stat(stats, 'Shop', shop.created ? 'created' : 'reused')
    if (shop.created) stat(stats, 'ShopMembership', 'created')
    return shop
  })
}

/** CLI-only local runtime path: there is no signed-in caller and no ownership
 * is granted to anyone. */
async function resolveCliShop(stats: SeedStats, shopSeed: SeedRecord) {
  const data = seedShopData(shopSeed)
  const slug = slugify(text(shopSeed.slug, data.name))
  const shop = await findOrCreate(stats, 'Shop', { slug: { equals: slug } }, { ...data, slug, isPublic: true }, 'id jurisdictionCode')
  return { id: shop.id, jurisdictionCode: text(shop.jurisdictionCode, data.jurisdictionCode), created: false }
}

/** Refresh the request session from durable data so child hooks see the
 * caller's current owner membership and active shop, not an old cookie. */
async function refreshSeedSession(userId: string) {
  const context = seedContextStorage.getStore()
  if (!context?.withSession) return
  const [current] = await getSudoContext().query.User.findMany({
    where: { id: { equals: userId } }, take: 1,
    query: `id name activeShop { id slug status } shopMemberships { id status membershipRole shop { id slug status } } role { id name canSeeOtherPeople canEditOtherPeople canManagePeople canManageRoles canAccessDashboard canManageOnboarding canManageServices canManageStaff canManageSchedules canManageAppointments canManageQueue canManageCustomers canManageCustomerNotes canManageMemberships canManagePayments canViewReports }`,
  })
  if (!current) throw new Error('Onboarding account is unavailable.')
  seedContextStorage.enterWith(context.withSession({ itemId: userId, listKey: 'User', data: current }))
}

export async function runBarbershopSeed({
  mode = 'full',
  apply = false,
  context,
  requireLocalDatabase = false,
}: {
  mode?: BarbershopSeedMode
  apply?: boolean
  context: BarbershopSeedContext
  requireLocalDatabase?: boolean
}): Promise<BarbershopSeedResult> {
  return seedContextStorage.run(context, async (): Promise<BarbershopSeedResult> => {
  const runtime = requireLocalDatabase ? assertSafeLocalSeedDatabase() : describeSeedDatabase()
  const seed = selectSeedMode(loadSeed(), mode)
  const shouldDryRun = !apply

  const summary = {
    shops: seed.shop ? 1 : 0,
    paymentProviders: seed.paymentProviders?.length ?? 0,
    noShowPolicies: seed.noShowPolicies?.length ?? 0,
    bookingPolicies: seed.bookingPolicies?.length ?? 0,
    practitionerCredentials: 0,
    serviceCategories: seed.serviceCategories?.length ?? 0,
    services: seed.services?.length ?? 0,
    barbers: seed.barbers?.length ?? 0,
    products: seed.products?.length ?? 0,
    suppliers: seed.suppliers?.length ?? 0,
    scheduleTemplates: seed.schedules?.length ?? 0,
    servicePackages: seed.servicePackages?.length ?? 0,
    membershipPlans: seed.membershipPlans?.length ?? 0,
  }

  if (shouldDryRun) {
    return { mode, runtime, summary, stats: {}, dryRun: true }
  }
  if (!seed.shop) throw new Error('Shop setup data is missing.')

  const stats: SeedStats = {}
  const categoryIds: Record<string, string> = {}
  const serviceIds: Record<string, string> = {}
  const barberIds: Record<string, string> = {}
  const productIdsBySku: Record<string, string> = {}

  const userId = getSeedSessionUserId()
  const shop = userId ? await resolveCallerShop(stats, userId, seed.shop) : await resolveCliShop(stats, seed.shop)
  const shopId = shop.id
  const shopJurisdictionCode = text(shop.jurisdictionCode, text(seed.shop.jurisdictionCode, 'US-NY'))
  if (userId) await refreshSeedSession(userId)

  for (const policy of seed.bookingPolicies ?? []) {
    const existing = await findFirst('BookingPolicy', { shop: { id: { equals: shopId } } }, 'id status')
    if (existing) {
      stat(stats, 'BookingPolicy', 'reused')
      continue
    }
    await findOrCreate(
      stats,
      'BookingPolicy',
      { shop: { id: { equals: shopId } }, version: { equals: text(policy.version, 'v1') } },
      {
        shop: optionalConnect(shopId),
        name: text(policy.name, 'Standard booking policy'),
        version: text(policy.version, 'v1'),
        jurisdictionCode: shopJurisdictionCode,
        policyTextHash: text(policy.policyTextHash),
        status: 'active',
        effectiveFrom: text(policy.effectiveFrom, new Date().toISOString()),
        effectiveUntil: policy.effectiveUntil || null,
        cancellationWindowMinutes: numberValue(policy.cancellationWindowMinutes, 1440),
        rescheduleWindowMinutes: numberValue(policy.rescheduleWindowMinutes, 1440),
        lateCancellationFeeAmount: numberValue(policy.lateCancellationFeeAmount),
        rescheduleFeeAmount: numberValue(policy.rescheduleFeeAmount),
        depositCancellationRule: text(policy.depositCancellationRule, 'manual_review'),
        maxCustomerReschedules: numberValue(policy.maxCustomerReschedules, 2),
      },
      'id status'
    )
  }

  if (hasPrismaDelegate('paymentProvider')) {
    for (const provider of seed.paymentProviders ?? []) {
      const code = text(provider.code)
      if (!code) continue
      await findOrCreate(
        stats,
        'PaymentProvider',
        { shop: { id: { equals: shopId } }, code: { equals: code } },
        {
          shop: optionalConnect(shopId),
          name: text(provider.name, code),
          code,
          isInstalled: provider.isInstalled ?? true,
          credentials: provider.credentials ?? {},
          metadata: provider.metadata ?? {},
          createPaymentFunction: text(provider.createPaymentFunction, 'manual'),
          capturePaymentFunction: text(provider.capturePaymentFunction, 'manual'),
          refundPaymentFunction: text(provider.refundPaymentFunction, 'manual'),
          getPaymentStatusFunction: text(provider.getPaymentStatusFunction, 'manual'),
          generatePaymentLinkFunction: text(provider.generatePaymentLinkFunction, 'manual'),
          handleWebhookFunction: text(provider.handleWebhookFunction, 'manual'),
        },
        'id code'
      )
    }
  } else {
    stat(stats, 'PaymentProvider', 'skipped')
  }

  for (const policy of seed.noShowPolicies ?? []) {
    const name = text(policy.name)
    if (!name) continue
    await findOrCreate(
      stats,
      'NoShowPolicy',
      { shop: { id: { equals: shopId } }, name: { equals: name } },
      {
        shop: optionalConnect(shopId),
        name,
        status: text(policy.status, 'active'),
        feeAmount: numberValue(policy.feeAmount),
        graceMinutes: numberValue(policy.graceMinutes, 10),
        appliesToMemberships: Boolean(policy.appliesToMemberships),
        description: text(policy.description),
      }
    )
  }

  for (const category of seed.serviceCategories ?? []) {
    const name = text(category.name)
    if (!name) continue
    const item = await findOrCreate(
      stats,
      'ServiceCategory',
      { shop: { id: { equals: shopId } }, name: { equals: name } },
      {
        shop: optionalConnect(shopId),
        name,
        description: text(category.description),
        displayOrder: numberValue(category.displayOrder),
        status: text(category.status, 'active'),
      }
    )
    categoryIds[name] = item.id
  }

  for (const service of seed.services ?? []) {
    const name = text(service.name)
    if (!name) continue
    const item = await findOrCreate(
      stats,
      'Service',
      { shop: { id: { equals: shopId } }, name: { equals: name } },
      {
        shop: optionalConnect(shopId),
        name,
        description: text(service.description),
        imagePath: text(service.imagePath),
        durationMinutes: numberValue(service.durationMinutes, 30),
        price: numberValue(service.price),
        depositRequired: Boolean(service.depositRequired),
        depositAmount: numberValue(service.depositAmount),
        status: text(service.status, 'active'),
        bookingBufferMinutes: numberValue(service.bookingBufferMinutes, 10),
        color: text(service.color, '#111827'),
        category: optionalConnect(categoryIds[text(service.category)]),
      }
    )
    serviceIds[name] = item.id
  }

  for (const barber of seed.barbers ?? []) {
    const displayName = text(barber.displayName)
    if (!displayName) continue
    const specialties = Array.isArray(barber.specialties)
      ? barber.specialties.map((name) => serviceIds[text(name)]).filter(Boolean).map((id) => ({ id }))
      : []
    const chairNumber = text(barber.chairNumber)
    const chair = chairNumber
      ? await findOrCreate(
        stats,
        'BarberChair',
        { shop: { id: { equals: shopId } }, chairNumber: { equals: chairNumber } },
        { shop: optionalConnect(shopId), chairNumber, stationName: `Chair ${chairNumber}`, status: 'active' }
      )
      : null
    const item = await findOrCreate(
      stats,
      'Barber',
      { shop: { id: { equals: shopId } }, displayName: { equals: displayName } },
      {
        shop: optionalConnect(shopId),
        chair: optionalConnect(chair?.id),
        displayName,
        legalName: text(barber.legalName),
        bio: text(barber.bio),
        imagePath: text(barber.imagePath),
        phone: text(barber.phone),
        email: text(barber.email),
        chairNumber,
        status: text(barber.status, 'active'),
        bookingEnabled: barber.bookingEnabled ?? true,
        bufferMinutes: numberValue(barber.bufferMinutes, 10),
        serviceCommissionRateBps: numberValue(barber.serviceCommissionRateBps),
        specialties: specialties.length ? { connect: specialties } : undefined,
      }
    )
    barberIds[displayName] = item.id
  }

  const fixtureClient = getPrismaClient()
  const fixtureScope = !!(isDisposableLocalFixtureTarget(runtime) && fixtureClient && typeof fixtureClient.$queryRawUnsafe === 'function' && await isLocalFixtureShop(fixtureClient as FixtureQueryClient, shopId))
  const localCredentials = fixtureScope ? buildDemoPractitionerCredentialSeeds(seed.barbers ?? [], shopJurisdictionCode) : []
  summary.practitionerCredentials = localCredentials.length
  for (const credential of localCredentials) {
    const barberId = barberIds[credential.barberName]
    const serviceId = serviceIds[credential.serviceName]
    if (!barberId || !serviceId) {
      stat(stats, 'PractitionerCredential', 'skipped')
      continue
    }
    const existing = await findFirst(
      'PractitionerCredential',
      { shop: { id: { equals: shopId } }, barber: { id: { equals: barberId } }, service: { id: { equals: serviceId } } },
      'id status'
    )
    const action = demoCredentialRerunAction(existing ? { status: existing.status } : null)
    if (action !== 'create') {
      stat(stats, 'PractitionerCredential', action === 'reuse' ? 'reused' : 'skipped')
      continue
    }
    await findOrCreate(
      stats,
      'PractitionerCredential',
      { credentialNumber: { equals: credential.credentialNumber }, shop: { id: { equals: shopId } }, barber: { id: { equals: barberId } }, service: { id: { equals: serviceId } } },
      {
        shop: optionalConnect(shopId),
        barber: optionalConnect(barberId),
        service: optionalConnect(serviceId),
        credentialType: credential.credentialType,
        credentialNumber: credential.credentialNumber,
        issuingAuthority: credential.issuingAuthority,
        jurisdictionCode: credential.jurisdictionCode,
        scopeDescription: credential.scopeDescription,
        evidenceHash: credential.evidenceHash,
        status: credential.status,
        effectiveFrom: credential.effectiveFrom,
        expiresAt: credential.expiresAt,
        verifiedAt: credential.verifiedAt,
        supervisionRequired: credential.supervisionRequired,
      }
    )
  }

  // Products are catalog entries only. Stock is recorded later through the
  // inventory receiving workflow when goods actually arrive.
  for (const product of seed.products ?? []) {
    const sku = text(product.sku)
    const name = text(product.name)
    if (!sku || !name) continue
    const item = await findOrCreate(
      stats,
      'Product',
      { shop: { id: { equals: shopId } }, sku: { equals: sku } },
      {
        shop: optionalConnect(shopId),
        name,
        sku,
        status: text(product.status, 'active'),
        productType: text(product.productType, 'other'),
        price: numberValue(product.price),
        cost: numberValue(product.cost),
        description: text(product.description),
        imagePath: text(product.imagePath),
        inventoryTracked: product.inventoryTracked ?? true,
        metadata: product.metadata ?? {},
      }
    )
    productIdsBySku[sku] = item.id
  }

  for (const supplier of seed.suppliers ?? []) {
    const name = text(supplier.name)
    if (!name) continue
    await findOrCreate(
      stats,
      'Supplier',
      { shop: { id: { equals: shopId } }, name: { equals: name } },
      {
        shop: optionalConnect(shopId),
        name,
        status: text(supplier.status, 'active'),
        contactName: text(supplier.contactName),
        email: text(supplier.email),
        phone: text(supplier.phone),
        website: text(supplier.website),
        notes: text(supplier.notes),
        metadata: supplier.metadata ?? {},
      }
    )
  }

  // Weekly working hours are shop-local wall-clock minutes; no dated instants
  // are created, so the server timezone never shifts them.
  for (const schedule of seed.schedules ?? []) {
    const barberId = barberIds[text(schedule.barber)]
    const days = Array.isArray(schedule.days) ? schedule.days.map((day) => text(day)).filter(Boolean) : []
    if (!barberId || days.length === 0) continue
    for (const dayOfWeek of days) {
      await findOrCreate(
        stats,
        'BarberSchedule',
        { barber: { id: { equals: barberId } }, dayOfWeek: { equals: dayOfWeek } },
        {
          barber: { connect: { id: barberId } },
          dayOfWeek,
          isWorking: schedule.isWorking ?? true,
          startMinute: numberValue(schedule.startMinute, 540),
          endMinute: numberValue(schedule.endMinute, 1020),
          breakStartMinute: numberValue(schedule.breakStartMinute, 0),
          breakEndMinute: numberValue(schedule.breakEndMinute, 0),
          notes: text(schedule.notes),
        }
      )
    }
  }

  for (const pack of seed.servicePackages ?? []) {
    const name = text(pack.name)
    if (!name) continue
    const item = await findOrCreate(
      stats,
      'ServicePackage',
      { shop: { id: { equals: shopId } }, name: { equals: name } },
      {
        shop: optionalConnect(shopId),
        name,
        description: text(pack.description),
        price: numberValue(pack.price),
        status: text(pack.status, 'active'),
      }
    )
    const items = Array.isArray(pack.items) ? pack.items : []
    for (const packItem of items) {
      const serviceId = serviceIds[text((packItem as SeedRecord).service)]
      if (!serviceId) continue
      await findOrCreate(
        stats,
        'ServicePackageItem',
        { package: { id: { equals: item.id } }, service: { id: { equals: serviceId } } },
        {
          package: { connect: { id: item.id } },
          service: { connect: { id: serviceId } },
          quantity: numberValue((packItem as SeedRecord).quantity, 1),
        }
      )
    }
  }

  for (const plan of seed.membershipPlans ?? []) {
    const name = text(plan.name)
    if (!name) continue
    await findOrCreate(
      stats,
      'MembershipPlan',
      { shop: { id: { equals: shopId } }, name: { equals: name } },
      {
        shop: optionalConnect(shopId),
        name,
        description: text(plan.description),
        price: numberValue(plan.price),
        billingInterval: text(plan.billingInterval, 'monthly'),
        includedVisits: numberValue(plan.includedVisits, 1),
        discountPercent: numberValue(plan.discountPercent),
        status: text(plan.status, 'active'),
      }
    )
  }

  return { mode, runtime, summary, stats, dryRun: false }
  })
}

if (isDirectExecution) {
  const apply = process.argv.includes('--apply')
  const mode: BarbershopSeedMode = process.argv.includes('--minimal') ? 'minimal' : 'full'

  let cliContext: BarbershopSeedContext | null = null
  import('../../../keystone/context').then(({ keystoneContext }) => {
    cliContext = keystoneContext as unknown as BarbershopSeedContext
    return runBarbershopSeed({ mode, apply, context: cliContext, requireLocalDatabase: true })
  })
    .then((result) => {
      process.stdout.write(`${JSON.stringify({ mode: result.mode, dryRun: result.dryRun, summary: result.summary, stats: result.stats }, null, 2)}\n`)
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
      process.exitCode = 1
    })
    .finally(async () => {
      await cliContext?.prisma?.$disconnect?.()
    })
}
