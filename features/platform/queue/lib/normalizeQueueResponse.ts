import type { QueueLoadResult } from './queueTypes';

type QueueProjection<T> = {
  success: boolean;
  error?: string | null;
  data?: T | null;
};

type QueueResponse<T> = {
  success: boolean;
  error?: string;
  data?: { platformQueue?: QueueProjection<T> };
};

function isForbidden(message?: string | null) {
  return /not authorized|permission|revoked|active shop|select exactly one/i.test(message || '');
}

export function normalizeQueueResponse<T>(response: QueueResponse<T>): QueueLoadResult<T> {
  if (!response.success) {
    return { success: false, kind: isForbidden(response.error) ? 'forbidden' : 'unavailable' };
  }

  const projection = response.data?.platformQueue;
  if (!projection?.success || projection.data == null) {
    return { success: false, kind: isForbidden(projection?.error) ? 'forbidden' : 'unavailable' };
  }

  return { success: true, data: projection.data };
}
