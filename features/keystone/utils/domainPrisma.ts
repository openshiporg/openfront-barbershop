import type { PrismaClient } from '@prisma/client';
import { strictPrisma } from './strictPrisma';

let canonicalClient: PrismaClient | undefined;

/** Keystone supplies its extended client; this compatibility facade owns no pool. */
export function bindDomainPrisma(client: PrismaClient) {
  canonicalClient = strictPrisma(client);
  return canonicalClient;
}

export const domainPrisma = new Proxy({} as PrismaClient, {
  set(_target, key, value) {
    if (!canonicalClient) throw new Error('Initialize the Keystone context before using the domain database.');
    return Reflect.set(canonicalClient, key, value);
  },
  get(_target, key) {
    if (!canonicalClient) throw new Error('Initialize the Keystone context before using the domain database.');
    const value = Reflect.get(canonicalClient, key, canonicalClient);
    return typeof value === 'function' ? value.bind(canonicalClient) : value;
  },
});
