/**
 * adminService — FUTURE USE (AdminDatabasePage)
 *
 * API layer for admin-only operations: fetching database stats and saving/updating products.
 * Wire fetchDatabaseStats() to DatabaseStatsCards and saveProduct() to AddProductModal.
 * Replace Promise.resolve stubs with real backend API calls (e.g. fetch/axios to /api/admin).
 */
export async function fetchDatabaseStats() {
  return Promise.resolve({ products: 122, activeUsers: 4800 });
}

export async function saveProduct(product) {
  return Promise.resolve({ success: true, product });
}
