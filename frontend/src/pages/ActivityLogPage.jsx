// ActivityLogPage: the full, live activity log (docs/DERM_FEEDBACK_PLAN.md, Phase 4). Every color analysis and every
// profile change, newest first, grouped by day. Opened from "View All" on Home and from the Profile page.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Dna, History, UserPlus, UserRoundPen } from "lucide-react";
import { useUserStore } from "../store/userStore";
import { subscribeActivity } from "../services/activityService";
import {
  ACTIVITY_FILTERS, activityCategory, describeActivity, formatExact, formatRelative, groupByDay, toDate,
} from "../utils/activityLog";

const PAGE_SIZE = 25;
const TICK_MS = 60_000; // relative times ("5 min ago") refresh every minute

const ICONS = { analysis: Dna, profile: UserRoundPen, account: UserPlus };

export function ActivityLogPage() {
  const navigate = useNavigate();
  const uid = useUserStore((state) => state.user?.uid);
  const createdAt = useUserStore((state) => state.user?.created_at);
  const [max, setMax] = useState(PAGE_SIZE);
  const [log, setLog] = useState({ uid: null, entries: [], hasMore: false, error: null });
  const [filter, setFilter] = useState("all");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeActivity(
      uid,
      max,
      (entries, hasMore) => setLog({ uid, entries, hasMore, error: null }),
      (error) => {
        console.error("Activity log error:", error);
        setLog((prev) => ({ ...prev, uid, error }));
      },
    );
  }, [uid, max]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const loading = Boolean(uid) && log.uid !== uid;

  // "Account created" comes from the existing created_at (nothing new is stored); shown once the whole log is loaded.
  const entries = useMemo(() => {
    const all = [...log.entries];
    const created = toDate(createdAt);
    if (!log.hasMore && created) all.push({ id: "account-created", type: "account_created", at: created });
    return filter === "all" ? all : all.filter((entry) => activityCategory(entry) === filter);
  }, [log.entries, log.hasMore, createdAt, filter]);

  const groups = useMemo(() => groupByDay(entries, now), [entries, now]);

  return (
    <main className="page-shell bg-primary-lightest text-black">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => navigate("/profile")}
          className="mb-4 inline-flex items-center gap-1.5 rounded-full py-2 pr-3 text-sm font-semibold text-gray transition hover:text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Profile
        </button>

        <header className="mb-6">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-black sm:text-4xl">Activity log</h1>
          <p className="mt-2 text-sm leading-6 text-gray sm:text-base">
            Every color analysis and every change to your profile, newest first. Updates live.
          </p>
        </header>

        <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Show">
          {ACTIVITY_FILTERS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={active}
                className={`min-h-10 rounded-full px-4 text-sm font-semibold transition-colors ${
                  active ? "bg-primary text-white shadow-sm" : "bg-white text-gray ring-1 ring-black/5 hover:text-black"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {log.error && log.entries.length === 0 ? (
          <StateCard
            title="Couldn't load your activity"
            message="Check your connection. The log updates as soon as you're back online."
          />
        ) : loading ? (
          <ActivitySkeleton />
        ) : groups.length === 0 ? (
          <StateCard
            title="No activity yet"
            message={
              filter === "all"
                ? "Run a color analysis or update your profile, and it will show up here."
                : "Nothing of this kind yet."
            }
            action={filter !== "profile" ? { label: "Start Color Analysis", onClick: () => navigate("/color-analysis") } : null}
          />
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`day-${group.key}`}>
                <h2
                  id={`day-${group.key}`}
                  className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.18em] text-gray-light"
                >
                  {group.label}
                </h2>
                <ol className="divide-y divide-primary/5 overflow-hidden rounded-2xl bg-white shadow-sm">
                  {group.entries.map((entry) => (
                    <ActivityRow key={entry.id} entry={entry} now={now} />
                  ))}
                </ol>
              </section>
            ))}
            {log.hasMore && (
              <button
                type="button"
                onClick={() => setMax((n) => n + PAGE_SIZE)}
                className="w-full rounded-full bg-white py-3 text-sm font-bold text-primary shadow-sm ring-1 ring-black/5 transition hover:bg-primary-lightest"
              >
                Show older activity
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function ActivityRow({ entry, now }) {
  const { title, details } = describeActivity(entry);
  const date = toDate(entry.at);
  const Icon = ICONS[activityCategory(entry)] ?? History;
  return (
    <li className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-5">
      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-lighter text-primary">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <p className="text-sm font-semibold text-black">{title}</p>
          {date ? (
            <time dateTime={date.toISOString()} title={formatExact(date)} className="shrink-0 text-xs text-gray-light">
              {formatRelative(date, now)}
            </time>
          ) : (
            <span className="shrink-0 text-xs text-gray-light">Time not recorded</span>
          )}
        </div>
        {details.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {details.map((line) => (
              <li key={line} className="break-words text-xs leading-5 text-gray">
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function StateCard({ title, message, action }) {
  return (
    <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm">
      <History size={28} className="mx-auto text-primary/60" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-black">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-gray">{message}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-dark"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-3 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
      <span className="sr-only">Loading activity</span>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} aria-hidden="true" className="flex items-center gap-3">
          <span className="skeleton h-9 w-9 shrink-0 rounded-xl" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="skeleton h-3.5 w-1/2 rounded" />
            <span className="skeleton h-3 w-1/3 rounded" />
          </span>
        </div>
      ))}
    </div>
  );
}
