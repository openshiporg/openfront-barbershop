export function assertUsdSettlementCurrency(currencyCode: unknown): asserts currencyCode is 'USD' {
  if (currencyCode !== 'USD') throw new Error('This release supports USD settlement only.');
}
