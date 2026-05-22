import { useState, FormEvent } from 'react';
import { api } from '../api';
import type { AddFeedResponse } from '../types';

interface Message {
  text: string;
  type: 'success' | 'error';
}

function AddFeed(): JSX.Element {
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
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Add RSS Feed</h2>

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
        <div className="mb-4 p-4 bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 rounded-lg">
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
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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

      <div className="mt-6 card bg-gray-50 dark:bg-gray-700/50">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Example RSS Feeds:</h3>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <li className="break-all">• Manga: https://weebcentral.com/series/01J76XY7FQY59WRK2YWX5T4E5N/rss</li>
          <li className="break-all">• News: https://feeds.bbci.co.uk/news/rss.xml</li>
          <li className="break-all">• Tech: https://news.ycombinator.com/rss</li>
        </ul>
      </div>
    </div>
  );
}

export default AddFeed;
