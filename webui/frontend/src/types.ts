// RSS2Mail WebUI Types

export interface Feed {
  id: number;
  name: string;
  url: string;
  cover_url?: string | null;
  last_sent_at?: string | null;
}

export interface LastCheckResult {
  feed_id: number;
  feed_name: string;
  status: 'sent' | 'no_new_items' | 'error';
  items_count: number;
  error?: string | null;
  checked_at: string;
}

export interface FeedItem {
  title: string;
  link: string;
  pub_date: string;
  processed: boolean;
}

export interface FeedDetails {
  id: number;
  name: string;
  url: string;
  cover_url?: string | null;
  last_sent_at?: string | null;
  description: string;
  series_link: string;
  last_build_date: string;
  total_items: number;
  items: FeedItem[];
}

export interface LastCheckResponse {
  results: LastCheckResult[];
  last_check_time: string | null;
}

export interface FeedsResponse {
  feeds: Feed[];
}

export interface FeedResult {
  feed: string;
  status: 'sent' | 'no_new_items' | 'error';
  items_count?: number;
  error?: string;
}

export interface CheckResponse {
  results: FeedResult[];
}

export interface AddFeedResponse {
  success: boolean;
  message: string;
  feed?: Feed;
}

export interface ApiError {
  error: string;
}

export interface Settings {
  email: string;
  app_password: string;
  messenger_enabled: boolean;
  messenger_page_token: string;
  messenger_recipient_id: string;
  send_interval: number;
}

export interface TestEmailResponse {
  success: boolean;
  message: string;
}

export interface LogsResponse {
  logs: string[];
}

export interface ApiSuccess {
  success: boolean;
  message: string;
}

export interface CheckOptions {
  send_email?: boolean;
  send_messenger?: boolean;
  max_items?: number;
}
