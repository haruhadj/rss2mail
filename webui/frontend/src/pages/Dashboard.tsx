import { useState, useEffect, useMemo, KeyboardEvent } from 'react';
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
  onTagsChanged: () => void;
  checking: boolean;
}

function FeedDetailPanel({ feedId, onClose, onCheck, onRemove, onTagsChanged, checking }: FeedDetailPanelProps): JSX.Element | null {
  const [details, setDetails] = useState<FeedDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [savingTags, setSavingTags] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [markReadNote, setMarkReadNote] = useState<string | null>(null);

  useEffect(() => {
    if (!feedId) { setDetails(null); return; }
    setLoadingDetails(true);
    setMarkReadNote(null);
    api.getFeedDetails(feedId)
      .then(setDetails)
      .catch(() => setDetails(null))
      .finally(() => setLoadingDetails(false));
  }, [feedId]);

  if (!feedId) return null;

  const saveTags = async (nextTags: string[]): Promise<void> => {
    if (!details) return;
    setSavingTags(true);
    try {
      await api.updateFeedTags(details.id, nextTags);
      setDetails({ ...details, tags: nextTags });
      onTagsChanged();
    } catch {
      // silently ignore; the chip UI stays in sync with the last successful save
    } finally {
      setSavingTags(false);
    }
  };

  const handleAddTag = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const value = tagInput.trim();
    if (!value || !details) return;
    if (details.tags?.includes(value)) {
      setTagInput('');
      return;
    }
    saveTags([...(details.tags ?? []), value]);
    setTagInput('');
  };

  const handleRemoveTag = (tag: string): void => {
    if (!details) return;
    saveTags((details.tags ?? []).filter((t) => t !== tag));
  };

  const handleMarkRead = async (): Promise<void> => {
    if (!details) return;
    setMarkingRead(true);
    try {
      const result = await api.markFeedRead(details.id);
      setMarkReadNote(result.count > 0 ? `Marked ${result.count} item(s) as read` : 'Already up to date');
      const refreshed = await api.getFeedDetails(details.id);
      setDetails(refreshed);
    } catch (err) {
      setMarkReadNote(err instanceof Error ? err.message : 'Failed to mark as read');
    } finally {
      setMarkingRead(false);
    }
  };

  const newItems = details?.items.filter((i: FeedItem) => !i.processed) ?? [];
  const readItems = details?.items.filter((i: FeedItem) => i.processed) ?? [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel: full-width bottom sheet on mobile, centered dialog from sm+ */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 pointer-events-none">
      <div
        className="w-full sm:max-w-lg max-h-[92vh] sm:max-h-[90vh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Drag handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        {/* Header with cover */}
        <div className="relative h-48 sm:h-56 bg-slate-900 flex-shrink-0 overflow-hidden">
          {details?.cover_url && (
            <img
              src={details.cover_url}
              alt={details.name}
              className="absolute inset-0 w-full h-full object-cover opacity-40"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/20 active:bg-white/30 sm:hover:bg-white/30 text-white transition-colors touch-manipulation"
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
          <div className="flex divide-x divide-slate-100 dark:divide-slate-700 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
            <div className="flex-1 py-3 text-center">
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{details.total_items}</p>
              <p className="text-[11px] text-slate-400 uppercase tracking-wide">Chapters</p>
            </div>
            <div className="flex-1 py-3 text-center">
              <p className="text-lg font-bold text-green-600">{newItems.length}</p>
              <p className="text-[11px] text-slate-400 uppercase tracking-wide">Unread</p>
            </div>
            <div className="flex-1 py-3 text-center">
              <p className="text-lg font-bold text-slate-400">{readItems.length}</p>
              <p className="text-[11px] text-slate-400 uppercase tracking-wide">Sent</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {details && (
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex-shrink-0 space-y-2">
            <div className="flex gap-2">
              <a
                href={details.series_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center text-xs font-semibold py-2.5 min-h-[40px] flex items-center justify-center rounded-lg bg-slate-100 text-slate-700 active:bg-slate-200 sm:hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:active:bg-slate-600 transition-colors touch-manipulation"
              >
                Open Series
              </a>
              <button
                onClick={() => onCheck(details.id)}
                disabled={checking}
                className="flex-1 text-xs font-semibold py-2.5 min-h-[40px] rounded-lg bg-primary-600 text-white active:bg-primary-500 sm:hover:bg-primary-500 disabled:opacity-50 transition-colors touch-manipulation"
              >
                Check Now
              </button>
              <button
                onClick={() => onRemove(details.id, details.name)}
                className="px-3 text-xs font-semibold py-2.5 min-h-[40px] rounded-lg bg-red-50 text-red-600 active:bg-red-100 sm:hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:active:bg-red-900/50 transition-colors touch-manipulation"
              >
                Remove
              </button>
            </div>
            <button
              onClick={handleMarkRead}
              disabled={markingRead}
              className="w-full text-xs font-semibold py-2 min-h-[36px] rounded-lg bg-transparent border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 active:bg-slate-100 sm:hover:bg-slate-100 dark:active:bg-slate-800 disabled:opacity-50 transition-colors touch-manipulation"
            >
              {markingRead ? 'Marking as read...' : 'Mark All as Read'}
            </button>
            {markReadNote && (
              <p className="text-center text-[11px] text-slate-400">{markReadNote}</p>
            )}
          </div>
        )}

        {/* Tags */}
        {details && (
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
            <div className="flex flex-wrap gap-1.5 items-center">
              {(details.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-[11px] font-medium pl-2 pr-1 py-1 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    disabled={savingTags}
                    className="p-0.5 rounded-full active:bg-primary-100 sm:hover:bg-primary-100 dark:active:bg-primary-500/20 touch-manipulation"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="+ Add tag"
                className="flex-1 min-w-[80px] text-[11px] bg-transparent outline-none text-slate-500 dark:text-slate-400 placeholder-slate-400 dark:placeholder-slate-600 py-1"
              />
            </div>
          </div>
        )}

        {/* Chapter list */}
        <div className="flex-1 overflow-y-auto">
          {loadingDetails ? (
            <div className="p-4 space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : details?.items.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No chapters found.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {details?.items.map((item: FeedItem, idx: number) => (
                <a
                  key={idx}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      item.processed ? 'bg-slate-300' : 'bg-primary-500'
                    }`} />
                    <span className={`text-sm truncate ${
                      item.processed ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100 font-medium'
                    }`}>
                      {item.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {item.pub_date && (
                      <span className="text-[11px] text-slate-400">{formatDate(item.pub_date)}</span>
                    )}
                    <svg className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  const [search, setSearch] = useState<string>('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

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

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    feeds.forEach((f) => (f.tags ?? []).forEach((t) => tags.add(t)));
    return [...tags].sort();
  }, [feeds]);

  const visibleFeeds = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sortedFeeds.filter((feed) => {
      if (query && !feed.name.toLowerCase().includes(query)) return false;
      if (activeTag && !(feed.tags ?? []).includes(activeTag)) return false;
      return true;
    });
  }, [sortedFeeds, search, activeTag]);

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
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">RSS Feeds</h2>
        <button onClick={handleCheckAll} disabled={checking} className="btn-primary w-full sm:w-auto whitespace-nowrap">
          {checking ? 'Checking...' : 'Check All Now'}
        </button>
      </div>

      {/* Toast */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'}`}>
          {message.text}
        </div>
      )}

      {/* Search + tag filters */}
      <div className="mb-4 space-y-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search feeds..."
          className="input"
        />
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTag(null)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors touch-manipulation ${
                activeTag === null
                  ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200'
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag((current) => (current === tag ? null : tag))}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors touch-manipulation ${
                  activeTag === tag
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sort bar + Last Check toggle */}
      <div className="flex flex-wrap gap-2 items-center mb-5 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-none">
        <span className="text-xs text-slate-500 font-medium mr-1 flex-shrink-0">Sort:</span>
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
            className={`flex-shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold border transition-colors touch-manipulation ${
              sort === key
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 active:border-primary-400 sm:hover:border-primary-400'
            }`}
          >
            {key === 'added' ? 'Added' : key === 'name' ? 'Name' : 'Updated'}
            {sort === key && <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>}
          </button>
        ))}

        {lastCheck?.last_check_time && (
          <button
            onClick={() => setShowLastCheck((v) => !v)}
            className="flex-shrink-0 sm:ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 active:bg-slate-200 sm:hover:bg-slate-200 dark:active:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-colors touch-manipulation"
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
        <div className="mb-5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Latest Chapter Updates</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">From last feed check · {lastCheck.last_check_time}</p>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50 max-h-72 overflow-y-auto">
            {lastCheck.results.map((r: LastCheckResult, idx) => (
              <div key={idx} className="flex items-center justify-between px-4 py-2.5 gap-3">
                <span className="text-sm text-slate-800 dark:text-slate-200 truncate flex-1">{r.feed_name}</span>
                <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  r.status === 'sent'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                    : r.status === 'no_new_items'
                    ? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
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
          <p className="text-slate-500 dark:text-slate-400 mb-4">No feeds configured yet.</p>
          <a href="/add" className="btn-primary inline-block">Add Your First Feed</a>
        </div>
      ) : visibleFeeds.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">No feeds match your search or filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-5">
          {visibleFeeds.map((feed) => (
            <div
              key={feed.id}
              className="group relative bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col active:scale-[0.98] sm:hover:shadow-md transition-all duration-150 cursor-pointer touch-manipulation"
              onClick={() => setSelectedFeedId(feed.id)}
            >
              <div className="relative w-full aspect-[2/3] bg-slate-100 dark:bg-slate-700 overflow-hidden">
                {feed.cover_url ? (
                  <img src={feed.cover_url} alt={feed.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
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

                {/* New chapters badge from the last check */}
                {!!feed.last_check_items_count && (
                  <div className="absolute top-1.5 right-1.5 bg-primary-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-soft">
                    +{feed.last_check_items_count}
                  </div>
                )}

                {/* Hover actions (desktop only — mobile taps open the detail sheet instead) */}
                <div className="hidden sm:flex absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-col items-center justify-center gap-2 p-2">
                  <button
                    onClick={() => handleCheckOne(feed.id)}
                    disabled={checking}
                    className="w-full text-xs font-semibold bg-white text-slate-800 rounded-lg py-1.5 hover:bg-primary-50 disabled:opacity-50 transition-colors"
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
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug">{feed.name}</p>
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
        onTagsChanged={loadFeeds}
        checking={checking}
      />
    </div>
  );
}

export default Dashboard;
