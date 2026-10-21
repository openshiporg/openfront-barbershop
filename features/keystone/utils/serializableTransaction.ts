type SerializableTransactionClient = {
  $transaction<T>(
    operation: (transaction: unknown) => Promise<T>,
    options?: { maxWait?: number; timeout?: number; isolationLevel?: 'Serializable' }
  ): Promise<T>;
};

function isSerializableWriteConflict(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2034');
}

export async function runSerializableTransaction<T>(
  prisma: SerializableTransactionClient,
  operation: (transaction: unknown) => Promise<T>,
  maxAttempts = 8
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        maxWait: 5_000,
        timeout: 10_000,
        isolationLevel: 'Serializable',
      });
    } catch (error) {
      if (!isSerializableWriteConflict(error) || attempt === maxAttempts) throw error;
      const backoffMs = Math.min(100, 5 * (2 ** (attempt - 1))) + Math.floor(Math.random() * 10);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  throw new Error('Unable to serialize transaction.');
}
