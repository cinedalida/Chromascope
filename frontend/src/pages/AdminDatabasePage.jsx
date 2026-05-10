// AdminDatabasePage is an admin dashboard for managing the product database.

export function AdminDatabasePage() {
  return (
    <main className="min-h-screen bg-surface p-8 font-body text-black">
      <div className="mx-auto max-w-5xl space-y-6 pt-20">
        <header className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Admin
          </p>
          <h1 className="font-heading text-4xl font-bold text-black">
            Database Management
          </h1>
          <p className="text-gray max-w-2xl">
            Review catalog entries, statistics, and product moderation tools.
          </p>
        </header>

        <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-lightest/60">
          <p className="text-gray-light text-sm italic">
            Admin components will be wired here. See{" "}
            <code className="rounded bg-primary-lightest px-1.5 py-0.5 text-xs text-primary font-mono">
              components/admin/
            </code>{" "}
            for future components.
          </p>
        </div>
      </div>
    </main>
  );
}
