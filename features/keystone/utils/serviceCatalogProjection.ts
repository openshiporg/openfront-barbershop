export function uncategorizedServiceWhere(shopId: string) {
  return { shopId, categoryId: null } as const;
}

export function countProjectedServices<TCategory extends { services: readonly unknown[] }>(
  categories: readonly TCategory[],
  uncategorizedServices: readonly unknown[],
) {
  return categories.reduce((count, category) => count + category.services.length, 0) + uncategorizedServices.length;
}
