'use client';

import { useCallback } from 'react';

// Operator command identity is created in the browser BEFORE the first dispatch
// and bound to the normalized command body. Retrying the same body (after an
// error, an interrupted connection or a reload in this tab) reuses the original
// key so the backend replays the original result instead of applying the effect
// twice. Only a confirmed success (or a changed body) releases the key, so a
// genuine new identical intent later gets a new key.

type StoredCommand = { body: string; key: string };

function storageKey(scope: string) {
  return `openfront:platform-command:${scope}`;
}

function read(scope: string): StoredCommand | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCommand;
    return typeof parsed?.body === 'string' && typeof parsed?.key === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function write(scope: string, value: StoredCommand | null) {
  try {
    if (value) window.sessionStorage.setItem(storageKey(scope), JSON.stringify(value));
    else window.sessionStorage.removeItem(storageKey(scope));
  } catch {
    // Storage can be unavailable; the in-memory fallback below still applies.
  }
}

const memory = new Map<string, StoredCommand>();

function newKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function normalize(body: unknown) {
  return JSON.stringify(body, (_key, value) => (value === undefined ? null : value));
}

/**
 * Returns `keyFor(body)` which yields the retained key for an unresolved command
 * with the same normalized body, or a new key otherwise, and `settle()` which
 * releases the key after a confirmed outcome.
 */
export function useCommandKey(scope: string) {
  // `target` separates independent commands that share one control group (for
  // example each shift row), so one pending intent never overwrites another.
  const keyFor = useCallback((body: unknown, target = '') => {
    const slot = target ? `${scope}:${target}` : scope;
    const normalized = normalize(body);
    const current = memory.get(slot) || read(slot);
    if (current && current.body === normalized) {
      memory.set(slot, current);
      return `platform:${slot}:${current.key}`;
    }
    const next = { body: normalized, key: newKey() };
    memory.set(slot, next);
    write(slot, next);
    return `platform:${slot}:${next.key}`;
  }, [scope]);

  const settle = useCallback((target = '') => {
    const slot = target ? `${scope}:${target}` : scope;
    memory.delete(slot);
    write(slot, null);
  }, [scope]);

  return { keyFor, settle };
}
