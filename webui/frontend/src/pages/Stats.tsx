import { useState, useEffect } from 'react';
import { api } from '../api';
import type { Stats as StatsType } from '../types';

function weekLabel(week: string): string {
  // week is "%Y-W%W", e.g. "2026-W29"
  const match = week.match(/^(\d{4})-W(\d{1,2})$/);
  return match ? `W${match[2]}` : week;
}

function Stats(): JSX.Element {
  const [stats, setStats] = useState<StatsType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getStats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-8">Loading stats...</div>;
  }

  if (error || !stats) {
    return <div className="text-center py-8 text-red-500">Error loading stats: {error}</div>;
  }

  const maxWeekly = Math.max(1, ...stats.weekly.map((w) => w.count));
  const maxTopFeed = Math.max(1, ...stats.top_feeds.map((f) => f.count));

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Stats</h2>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
        <div className="card text-center py-6">
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{stats.total_feeds}</p>
          <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">Feeds Tracked</p>
        </div>
        <div className="card text-center py-6">
          <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">{stats.total_chapters}</p>
          <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">Chapters Sent</p>
        </div>
      </div>

      {/* Weekly trend */}
      <div className="card mb-6">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Chapters per Week</h3>
        {stats.weekly.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No history yet.</p>
        ) : (
          <div className="flex items-end gap-1.5 h-32">
            {stats.weekly.map((w) => (
              <div key={w.week} className="flex-1 flex flex-col items-center justify-end gap-1 group">
                <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  {w.count}
                </span>
                <div
                  className="w-full rounded-t-md bg-primary-500 dark:bg-primary-500/80 transition-all min-h-[3px]"
                  style={{ height: `${(w.count / maxWeekly) * 100}%` }}
                />
                <span className="text-[9px] text-slate-400">{weekLabel(w.week)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top feeds */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Top Feeds</h3>
        {stats.top_feeds.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No chapters sent yet.</p>
        ) : (
          <div className="space-y-3">
            {stats.top_feeds.map((f) => (
              <div key={f.feed_title} className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 w-32 sm:w-48 truncate flex-shrink-0">
                  {f.feed_title}
                </span>
                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full"
                    style={{ width: `${(f.count / maxTopFeed) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 w-6 text-right flex-shrink-0">
                  {f.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Stats;
