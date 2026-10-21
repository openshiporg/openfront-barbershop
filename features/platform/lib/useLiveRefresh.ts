'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Explicit and periodic refresh for operational boards. Polling pauses while
 * the operator has an open form or an action is pending, so a refresh never
 * replaces a draft or retargets a pending command.
 */
export function useLiveRefresh({ paused, intervalMs = 60_000 }: { paused: boolean; intervalMs?: number }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => new Date());
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(() => {
    startRefresh(() => {
      router.refresh();
      setLastRefreshedAt(new Date());
    });
  }, [router]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (paused) return;
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, intervalMs);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener('focus', onFocus);
    };
  }, [paused, intervalMs, refresh]);

  return { refresh, refreshing, lastRefreshedAt, now };
}
