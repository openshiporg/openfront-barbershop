import type { ReportsSummary, ReportsSummaryResult } from './reportsTypes';

type ReportsProjection = {
  success: boolean;
  error?: string | null;
  data?: ReportsSummary | null;
};

type ReportsResponse = {
  success: boolean;
  error?: string;
  data?: { platformReports?: ReportsProjection };
};

function isForbidden(message?: string | null) {
  return /not authorized|permission/i.test(message || '');
}

// Range/timezone problems are actionable by the operator, so their message is shown.
function isInvalidRange(message?: string | null) {
  return /report range|report dates|start date|timezone is not set/i.test(message || '');
}

export function normalizeReportsResponse(response: ReportsResponse): ReportsSummaryResult {
  if (!response.success) {
    return { ok: false, kind: isForbidden(response.error) ? 'forbidden' : 'unavailable' };
  }

  const projection = response.data?.platformReports;
  if (!projection?.success || !projection.data) {
    if (isInvalidRange(projection?.error)) return { ok: false, kind: 'invalid', message: projection?.error || undefined };
    return { ok: false, kind: isForbidden(projection?.error) ? 'forbidden' : 'unavailable' };
  }

  return { ok: true, data: projection.data };
}
