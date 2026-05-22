import { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import type { Feed, LastCheckResult, LastCheckResponse, FeedDetails, FeedItem } from '../types';

type SortKey = 'added' | 'name' | 'updated';

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface Message {
  text: string;
  type: 'success' | 'error';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

interface FeedDetailPanelProps {
  feedId: number | null;
  onClose: () => void;
  onCheck: (id: number) => void;
  onRemove: (id: number, name: string) => void;
  checking: boolean;
}

function FeedDetailPanel({ feedId, onClose, onCheck, onRemove, checking }: FeedDetailPanelProps): JSX.Element | null {
  const [details, setDetails] = useState<FeedDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!feedId) { setDetails(null); return; }
    setLoadingDetails(true);
    api.getFeedDetails(feedId)
      .then(setDetails)
      .catch(() => setDetails(null))
      .finally(() => setLoadingDetails(false));
  }, [feedId]);

  if (!feedId) return null;

  const newItems = details?.items.filter((i: FeedItem) => !i.processed) ?? [];
  const readItems = details?.items.filter((i: FeedItem) => i.processed) ?? [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
      <div className="w-full max-w-lg max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
        {/* Header with cover */}
        <div className="relative h-56 bg-gray-900 flex-shrink-0 overflow-hidden">
          {details?.cover_url && (
            <img
              src={details.cover_url}
              alt={details.name}
              className="absolute inset-0 w-full h-full object-cover opacity-40"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {details?.cover_url && (
            <img
              src={details.cover_url}
              alt={details.name}
              className="absolute bottom-4 left-4 w-16 h-20 object-cover rounded-lg shadow-lg border-2 border-white/20"
            />
          )}
          <div className="absolute bottom-4 left-24 right-4">
            {loadingDetails ? (
              <div className="h-6 w-40 bg-white/20 rounded animate-pulse" />
            ) : (
              <>
                <h2 className="text-white font-bold text-lg leading-tight line-clamp-2">
                  {details?.name}
                </h2>
                {details?.description && (
                  <p className="text-white/60 text-xs mt-0.5 line-clamp-1">{details.description}</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Stats row */}
        {details && (
          <div className="flex divide-x divide-gray-100 dark:divide-gray-700 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <div className="flex-1 py-3 text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{details.total_items}</p>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">Chapters</p>
            </div>
            <div className="flex-1 py-3 text-center">
              <p className="text-lg font-bold text-green-600">{newItems.length}</p>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">Unread</p>
            </div>
            <div className="flex-1 py-3 text-center">
              <p className="text-lg font-bold text-gray-400">{readItems.length}</p>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">Sent</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {details && (
          <div className="flex gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <a
              href={details.series_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-xs font-semibold py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Open Series
            </a>
            <button
              onClick={() => onCheck(details.id)}
              disabled={checking}
              className="flex-1 text-xs font-semibold py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Check Now
            </button>
            <button
              onClick={() => onRemove(details.id, details.name)}
              className="px-3 text-xs font-semibold py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
            >
              Remove
            </button>
          </div>
        )}

        {/* Chapter list */}
        <div className="flex-1 overflow-y-auto">
          {loadingDetails ? (
            <div className="p-4 space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : details?.items.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No chapters found.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {details?.items.map((item: FeedItem, idx: number) => (
                <a
                  key={idx}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      item.processed ? 'bg-gray-300' : 'bg-blue-500'
                    }`} />
                    <span className={`text-sm truncate ${
                      item.processed ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100 font-medium'
                    }`}>
                      {item.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {item.pub_date && (
                      <span className="text-[11px] text-gray-400">{formatDate(item.pub_date)}</span>
                    )}
                    <svg className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}

function Dashboard(): JSX.Element {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [checking, setChecking] = useState<boolean>(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [sort, setSort] = useState<SortKey>(() => (localStorage.getItem('dashboard-sort') as SortKey) || 'added');
  const [sortAsc, setSortAsc] = useState<boolean>(() => localStorage.getItem('dashboard-sort-asc') !== 'false');
  const [lastCheck, setLastCheck] = useState<LastCheckResponse | null>(null);
  const [showLastCheck, setShowLastCheck] = useState<boolean>(false);
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);

  useEffect(() => {
    loadFeeds();
    api.getLastCheck().then(setLastCheck).catch(() => {});
  }, []);

  const loadFeeds = async (): Promise<void> => {
    try {
      const data = await api.getFeeds();
      setFeeds(data.feeds);
    } catch (err) {
      showMessage('Error loading feeds: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const sortedFeeds = useMemo(() => {
    const copy = [...feeds];
    const dir = sortAsc ? 1 : -1;
    if (sort === 'name') return copy.sort((a, b) => dir * a.name.localeCompare(b.name));
    if (sort === 'updated') {
      return copy.sort((a, b) => {
        if (!a.last_sent_at && !b.last_sent_at) return 0;
        if (!a.last_sent_at) return sortAsc ? -1 : 1;
        if (!b.last_sent_at) return sortAsc ? 1 : -1;
        return dir * (new Date(a.last_sent_at).getTime() - new Date(b.last_sent_at).getTime());
      });
    }
    return sortAsc ? copy : copy.reverse(); // 'added' = DB order
  }, [feeds, sort, sortAsc]);

  const showMessage = (text: string, type: 'success' | 'error' = 'success'): void => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleRemove = async (id: number, name: string): Promise<void> => {
    if (!confirm(`Are you sure you want to remove "${name}"?`)) return;
    setSelectedFeedId(null);

    try {
      await api.removeFeed(id);
      showMessage(`Removed "${name}"`);
      loadFeeds();
    } catch (err) {
      showMessage('Error removing feed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    }
  };

  const handleCheckAll = async (): Promise<void> => {
    setChecking(true);
    try {
      await api.checkAll({
        send_email: true,
        send_messenger: false,
        max_items: 5,
      });
      showMessage('Check completed!');
      api.getLastCheck().then(setLastCheck).catch(() => {});
    } catch (err) {
      showMessage('Error checking feeds: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setChecking(false);
    }
  };

  const handleCheckOne = async (id: number): Promise<void> => {
    setChecking(true);
    try {
      const result = await api.checkFeed(id, {
        send_email: true,
        send_messenger: false,
        max_items: 5,
      });
      if (result.status === 'sent') {
        showMessage(`Sent ${result.items_count} items from ${result.feed}`);
      } else if (result.status === 'no_new_items') {
        showMessage(`No new items in ${result.feed}`);
      } else {
        showMessage(`Error checking ${result.feed}`, 'error');
      }
    } catch (err) {
      showMessage('Error checking feed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">RSS Feeds</h2>
        <button onClick={handleCheckAll} disabled={checking} className="btn-primary whitespace-nowrap">
          {checking ? 'Checking...' : 'Check All Now'}
        </button>
      </div>

      {/* Toast */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'}`}>
          {message.text}
        </div>
      )}

      {/* Sort bar + Last Check toggle */}
      <div className="flex flex-wrap gap-2 items-center mb-5">
        <span className="text-xs text-gray-500 font-medium mr-1">Sort:</span>
        {(['added', 'name', 'updated'] as SortKey[]).map((key) => (
          <button
            key={key}
            onClick={() => {
              if (sort === key) {
                const next = !sortAsc;
                setSortAsc(next);
                localStorage.setItem('dashboard-sort-asc', String(next));
              } else {
                setSort(key);
                setSortAsc(true);
                localStorage.setItem('dashboard-sort', key);
                localStorage.setItem('dashboard-sort-asc', 'true');
              }
            }}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              sort === key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
            }`}
          >
            {key === 'added' ? 'Added' : key === 'name' ? 'Name' : 'Updated'}
            {sort === key && <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>}
          </button>
        ))}

        {lastCheck?.last_check_time && (
          <button
            onClick={() => setShowLastCheck((v) => !v)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Last check: {timeAgo(lastCheck.last_check_time)}
            <svg className={`w-3 h-3 transition-transform ${showLastCheck ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Last Check Results panel */}
      {showLastCheck && lastCheck && lastCheck.results.length > 0 && (
        <div className="mb-5 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Latest Chapter Updates</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">From last feed check · {lastCheck.last_check_time}</p>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50 max-h-72 overflow-y-auto">
            {lastCheck.results.map((r: LastCheckResult, idx) => (
              <div key={idx} className="flex items-center justify-between px-4 py-2.5 gap-3">
                <span className="text-sm text-gray-800 dark:text-gray-200 truncate flex-1">{r.feed_name}</span>
                <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  r.status === 'sent'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                    : r.status === 'no_new_items'
                    ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                }`}>
                  {r.status === 'sent'
                    ? `${r.items_count} new`
                    : r.status === 'no_new_items'
                    ? 'Up to date'
                    : 'Error'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feed grid */}
      {feeds.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No feeds configured yet.</p>
          <a href="/add" className="btn-primary inline-block">Add Your First Feed</a>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {sortedFeeds.map((feed) => (
            <div
              key={feed.id}
              className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow duration-200 cursor-pointer"
              onClick={() => setSelectedFeedId(feed.id)}
            >
              <div className="relative w-full aspect-[2/3] bg-gray-100 dark:bg-gray-700 overflow-hidden">
                {feed.cover_url ? (
                  <img src={feed.cover_url} alt={feed.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}

                {/* Last updated badge */}
                {feed.last_sent_at && (
                  <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                    {timeAgo(feed.last_sent_at)}
                  </div>
                )}

                {/* Hover actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2 p-2">
                  <button
                    onClick={() => handleCheckOne(feed.id)}
                    disabled={checking}
                    className="w-full text-xs font-semibold bg-white text-gray-800 rounded-lg py-1.5 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                  >
                    Check Now
                  </button>
                  <button
                    onClick={() => handleRemove(feed.id, feed.name)}
                    className="w-full text-xs font-semibold bg-red-500 text-white rounded-lg py-1.5 hover:bg-red-600 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="p-2">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 line-clamp-2 leading-snug">{feed.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <FeedDetailPanel
        feedId={selectedFeedId}
        onClose={() => setSelectedFeedId(null)}
        onCheck={(id) => { setSelectedFeedId(null); handleCheckOne(id); }}
        onRemove={handleRemove}
        checking={checking}
      />
    </div>
  );
}

export default Dashboard;
