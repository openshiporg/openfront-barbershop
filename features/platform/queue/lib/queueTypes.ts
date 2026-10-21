export type QueueStatus = 'waiting' | 'texted' | 'in_chair' | 'served' | 'left';

export type QueueLoadResult<T> =
  | { success: true; data: T }
  | { success: false; kind: 'forbidden' | 'unavailable' };

export const queueStatusLabels: Record<QueueStatus, string> = {
  waiting: 'Waiting',
  texted: 'Contacted manually',
  in_chair: 'In chair',
  served: 'Served',
  left: 'Left',
};
