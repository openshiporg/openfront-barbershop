import { GraphQLError } from 'graphql';

const clients = new WeakMap<object, object>();
const delegates = new WeakMap<object, object>();

/** Core6.5.3's injected Prisma extension returns failures as GraphQLError values.
 * Recover thrown-error semantics outside that extension, including transaction
 * delegates, so SSI conflicts retry and a failed write cannot be read as a row.
 */
function assertResult<T>(result: T): T {
  if (result instanceof Error) {
    if (result instanceof GraphQLError) {
      const original = result.extensions?.prisma as Record<string, unknown> | undefined;
      const error = new Error(result.message);
      if (original) Object.assign(error, original);
      throw error;
    }
    throw result;
  }
  return result;
}

function strictDelegate<T extends object>(delegate: T): T {
  const cached = delegates.get(delegate);
  if (cached) return cached as T;
  const wrapped = new Proxy(delegate, { get(target, key) {
    const value = Reflect.get(target, key, target);
    if (typeof value !== 'function') return value;
    return async (...args: unknown[]) => assertResult(await value.apply(target, args));
  } });
  delegates.set(delegate, wrapped);
  return wrapped;
}

export function strictPrisma<T extends object>(client: T): T {
  const cached = clients.get(client);
  if (cached) return cached as T;
  const wrapped = new Proxy(client, { get(target, key) {
    const value = Reflect.get(target, key, target);
    if (key === '$transaction' && typeof value === 'function') {
      return async (operation: unknown, ...options: unknown[]) => {
        const work = typeof operation === 'function' ? (tx: object) => operation(strictPrisma(tx)) : operation;
        return assertResult(await value.call(target, work, ...options));
      };
    }
    if (typeof value === 'function') {
      if (typeof key === 'string' && /^\$(?:queryRaw|executeRaw|connect|disconnect)/.test(key)) return async (...args: unknown[]) => assertResult(await value.apply(target, args));
      return value.bind(target);
    }
    if (value && typeof value === 'object' && typeof Reflect.get(value, 'findUnique') === 'function') return strictDelegate(value);
    return value;
  } });
  clients.set(client, wrapped);
  return wrapped;
}
