/**
 * DatabaseStatsCards — FUTURE USE (AdminDatabasePage)
 *
 * Renders a summary row of key admin metrics (total products, active users, flagged items).
 * Wire to AdminDatabasePage once adminService.fetchDatabaseStats() is connected to a real API.
 */
export function DatabaseStatsCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-3xl bg-slate-900 p-5">Stats card</div>
    </div>
  );
}
