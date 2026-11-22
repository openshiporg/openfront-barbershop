// Next.js calls register() once per server process. Starts the per-minute Stripe settle (no webhook on this site).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.DATABASE_URL || process.env.NEXT_PHASE === 'phase-production-build') return;
  const [{ keystoneContext }, { startPaymentSettler }] = await Promise.all([
    import('./features/keystone/context'),
    import('./features/keystone/utils/settleOpenPayments'),
  ]);
  startPaymentSettler(keystoneContext.sudo().prisma as never);
}
