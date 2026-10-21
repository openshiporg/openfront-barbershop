'use server';

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { normalizeReportsResponse } from '../lib/normalizeReportsResponse';
import type { ReportsSummary, ReportsSummaryResult } from '../lib/reportsTypes';

export async function getReportsSummary(range: { startDate?: string; endDate?: string } = {}): Promise<ReportsSummaryResult> {
  const response = await keystoneClient<{ platformReports: { success: boolean; error?: string | null; data?: ReportsSummary | null } }>(`
    query ReportsProjection($startDate: String, $endDate: String) { platformReports(startDate: $startDate, endDate: $endDate) { success error data } }
  `, { startDate: range.startDate || null, endDate: range.endDate || null }, { cache: 'no-store' });
  return normalizeReportsResponse(response);
}
