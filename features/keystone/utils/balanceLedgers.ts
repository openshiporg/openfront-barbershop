function integer(value: number, label: string) {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer.`);
  return value;
}

export function applyInventoryDelta(current: number, delta: number) {
  const before = integer(current, 'Inventory balance');
  const normalizedDelta = integer(delta, 'Inventory movement');
  if (normalizedDelta === 0) throw new Error('Inventory movement must be non-zero.');
  const after = before + normalizedDelta;
  if (after < 0) throw new Error('Insufficient inventory for this movement.');
  return { before, delta: normalizedDelta, after };
}

export function applyPackageDelta(current: number, delta: number) {
  const before = integer(current, 'Package balance');
  const normalizedDelta = integer(delta, 'Package usage');
  if (normalizedDelta === 0) throw new Error('Package usage must be non-zero.');
  const after = before + normalizedDelta;
  if (after < 0) throw new Error('Package has no visits remaining.');
  return { before, delta: normalizedDelta, after };
}
