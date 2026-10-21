type ServiceCommissionInput = {
  subtotal: number;
  discountAmount: number;
  rateBps: number;
};

export function calculateServiceCommission(input: ServiceCommissionInput) {
  const subtotal = Math.max(0, Math.floor(Number(input.subtotal) || 0));
  const discountAmount = Math.max(0, Math.floor(Number(input.discountAmount) || 0));
  const rateBps = Math.min(10_000, Math.max(0, Math.floor(Number(input.rateBps) || 0)));
  const serviceAmount = Math.max(0, subtotal - Math.min(subtotal, discountAmount));

  return {
    serviceAmount,
    commissionRate: String(rateBps / 100),
    commissionAmount: Math.floor(serviceAmount * rateBps / 10_000),
  };
}
