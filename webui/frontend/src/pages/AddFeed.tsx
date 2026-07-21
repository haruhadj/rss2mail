import { useState, useEffect, useRef, FormEvent } from 'react';
import { api } from '../api';
import type { AddFeedResponse, DiscoverResult } from '../types';

interface Message {
  text: string;
  type: 'success' | 'error';
}

type Tab = 'search' | 'manual';

function DiscoverTab(): JSX.Element {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<DiscoverResult[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [existingUrls, setExistingUrls] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<Message | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.getFeeds().then((data) => setExistingUrls(new Set(data.feeds.map((f) => f.url)))).catch(() => {});
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      api.discover(trimmed)
        .then((data) => setResults(data.results))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const showMessage = (text: string, type: 'success' | 'error' = 'success'): void => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleAdd = async (result: DiscoverResult): Promise<void> => {
    setAddingId(result.id);
    try {
      await api.addFeed(result.title, result.feed_url);
      setExistingUrls((prev) => new Set(prev).add(result.feed_url));
      showMessage(`Added "${result.title}"`);
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Unknown error', 'error');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search Weebcentral (e.g. Vinland Saga)"
        className="input"
        autoFocus
      />

      {message && (
        <div
          className={`mt-4 p-3 rounded-lg text-sm ${
            message.type === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mt-4">
        {searching ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : query.trim() && results.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No series found for "{query}".</p>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {results.map((result) => {
              const added = existingUrls.has(result.feed_url);
              return (
                <button
                  key={result.id}
                  onClick={() => !added && handleAdd(result)}
                  disabled={added || addingId === result.id}
                  className="group relative bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col text-left active:scale-[0.98] sm:hover:shadow-md transition-all duration-150 touch-manipulation disabled:cursor-default"
                >
                  <div className="relative w-full aspect-[2/3] bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    {result.cover_url ? (
                      <img src={result.cover_url} alt={result.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600 text-xs">
                        No cover
                      </div>
                    )}
                    <div
                      className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                        added ? 'bg-black/50 opacity-100' : addingId === result.id ? 'bg-black/50 opacity-100' : 'bg-black/60 opacity-0 sm:group-hover:opacity-100'
                      }`}
                    >
                      <span className="text-xs font-semibold text-white px-2 py-1 rounded-lg bg-white/10">
                        {added ? 'Added ✓' : addingId === result.id ? 'Adding...' : 'Add Feed'}
                      </span>
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug">
                      {result.title}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-8">Start typing to search Weebcentral's catalogue.</p>
        )}
      </div>
    </div>
  );
}

function ManualTab(): JSX.Element {
  const [name, setName] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [extractedTitle, setExtractedTitle] = useState<string | null>(null);

  const showMessage = (text: string, type: 'success' | 'error' = 'success'): void => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!url.trim()) {
      showMessage('Please enter a URL', 'error');
      return;
    }

    setLoading(true);
    setExtractedTitle(null);

    try {
      const result: AddFeedResponse = await api.addFeed(name, url);
      showMessage(result.message);
      setName('');
      setUrl('');
      if (result.feed?.name && !name) {
        setExtractedTitle(result.feed.name);
      }
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Unknown error', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {message && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
          }`}
        >
          {message.text}
        </div>
      )}

      {extractedTitle && (
        <div className="mb-4 p-4 bg-primary-50 text-primary-800 dark:bg-primary-900/40 dark:text-primary-300 rounded-lg">
          Auto-detected title: <strong>{extractedTitle}</strong>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-6">
        <div>
          <label className="label">Feed Name (optional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Leave empty to auto-detect"
            className="input"
          />
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            If left empty, the title will be extracted from the RSS feed.
          </p>
        </div>

        <div>
          <label className="label">RSS Feed URL *</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/feed.xml"
            required
            className="input"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Adding...' : 'Add Feed'}
          </button>
          <a href="/" className="btn-secondary text-center">
            Cancel
          </a>
        </div>
      </form>

      <div className="mt-6 card bg-slate-50 dark:bg-slate-700/50">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Example RSS Feeds:</h3>
        <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
          <li className="break-all">• Manga: https://weebcentral.com/series/01J76XY7FQY59WRK2YWX5T4E5N/rss</li>
          <li className="break-all">• News: https://feeds.bbci.co.uk/news/rss.xml</li>
          <li className="break-all">• Tech: https://news.ycombinator.com/rss</li>
        </ul>
      </div>
    </div>
  );
}

function AddFeed(): JSX.Element {
  const [tab, setTab] = useState<Tab>('search');

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">Add RSS Feed</h2>

      <div className="flex gap-2 mb-6 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        <button
          onClick={() => setTab('search')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors touch-manipulation ${
            tab === 'search' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-soft' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          Search Weebcentral
        </button>
        <button
          onClick={() => setTab('manual')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors touch-manipulation ${
            tab === 'manual' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-soft' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          Paste URL
        </button>
      </div>

      {tab === 'search' ? <DiscoverTab /> : <ManualTab />}
    </div>
  );
}

export default AddFeed;
