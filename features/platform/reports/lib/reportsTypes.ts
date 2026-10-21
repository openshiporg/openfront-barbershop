export type PerformanceRow = { key: string; name: string; revenue: number; appointments: number; linked: boolean; duplicateName: boolean };

export type ReportsSummary = {
  range: { start: string; end: string; startDate: string; endDate: string; days: number; timeZone: string; currencyCode: string };
  appointments: { total: number; completed?: number; cancelled?: number; no_show?: number };
  revenue: { paidTotal: number; tips: number; transactionCount: number; productSales: number; productSaleCount: number };
  queue: { waiting?: number; served?: number; left?: number };
  payouts: { total: number; count: number };
  rates: { completion: number; queueConversion: number; utilization: number };
  liabilities: { memberships: number; activeBalances: number };
  servicePerformance: PerformanceRow[];
  barberPerformance: PerformanceRow[];
};

export type ReportsSummaryResult =
  | { ok: true; data: ReportsSummary }
  | { ok: false; kind: 'forbidden' | 'unavailable' | 'invalid'; message?: string };
