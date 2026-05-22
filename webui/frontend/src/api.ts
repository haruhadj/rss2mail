import type {
  FeedsResponse,
  AddFeedResponse,
  Settings,
  CheckOptions,
  CheckResponse,
  FeedResult,
  TestEmailResponse,
  LogsResponse,
  ApiSuccess,
  LastCheckResponse,
  FeedDetails,
} from './types';

const API_BASE = '/api';

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || error.error || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Feeds
  getFeeds: () => apiRequest<FeedsResponse>('/feeds'),
  addFeed: (name: string, url: string) =>
    apiRequest<AddFeedResponse>('/feeds', {
      method: 'POST',
      body: JSON.stringify({ name, url }),
    }),
  removeFeed: (id: number) =>
    apiRequest<ApiSuccess>(`/feeds/${id}`, {
      method: 'DELETE',
    }),

  // Check feeds
  checkAll: (options: CheckOptions = {}) =>
    apiRequest<CheckResponse>('/check', {
      method: 'POST',
      body: JSON.stringify(options),
    }),
  checkFeed: (id: number, options: CheckOptions = {}) =>
    apiRequest<FeedResult>(`/check/${id}`, {
      method: 'POST',
      body: JSON.stringify(options),
    }),

  // Reset
  resetProcessed: () =>
    apiRequest<ApiSuccess>('/reset', {
      method: 'POST',
    }),

  // Settings
  getSettings: () => apiRequest<Settings>('/settings'),
  updateSettings: (settings: Settings) =>
    apiRequest<ApiSuccess>('/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),

  // Test
  testEmail: () =>
    apiRequest<TestEmailResponse>('/test/email', {
      method: 'POST',
    }),

  // Feed details
  getFeedDetails: (id: number) => apiRequest<FeedDetails>(`/feeds/${id}/details`),

  // Last check
  getLastCheck: () => apiRequest<LastCheckResponse>('/last-check'),

  // Logs
  getLogs: () => apiRequest<LogsResponse>('/logs'),
};

