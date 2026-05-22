import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { api } from '../api';
import type { Settings as SettingsType } from '../types';

interface Message {
  text: string;
  type: 'success' | 'error';
}

function Settings(): JSX.Element {
  const [settings, setSettings] = useState<SettingsType>({
    email: '',
    app_password: '',
    messenger_enabled: false,
    messenger_page_token: '',
    messenger_recipient_id: '',
    send_interval: 15,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async (): Promise<void> => {
    try {
      const data = await api.getSettings();
      setSettings({
        email: data.email || '',
        app_password: data.app_password || '',
        messenger_enabled: data.messenger_enabled ?? !!(data.messenger_page_token || data.messenger_recipient_id),
        messenger_page_token: data.messenger_page_token || '',
        messenger_recipient_id: data.messenger_recipient_id || '',
        send_interval: data.send_interval || 15,
      });
    } catch (err) {
      showMessage('Error loading settings: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error' = 'success'): void => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : name === 'send_interval' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSaving(true);

    try {
      await api.updateSettings(settings);
      showMessage('Settings saved successfully!');
    } catch (err) {
      showMessage('Error saving settings: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async (): Promise<void> => {
    setTesting(true);
    try {
      const result = await api.testEmail();
      showMessage(result.message);
    } catch (err) {
      showMessage('Email test failed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading settings...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Settings</h2>

      {message && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Email Configuration</h3>

          <div className="space-y-4">
            <div>
              <label className="label">Gmail Address</label>
              <input
                type="email"
                name="email"
                value={settings.email}
                onChange={handleChange}
                placeholder="yourname@gmail.com"
                className="input"
              />
            </div>

            <div>
              <label className="label">App Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="app_password"
                  value={settings.app_password}
                  onChange={handleChange}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="input pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Generate an App Password from your Google Account settings.
              </p>
            </div>

            <button
              type="button"
              onClick={handleTestEmail}
              disabled={testing || !settings.email || !settings.app_password}
              className="btn-secondary text-sm"
            >
              {testing ? 'Testing...' : 'Test Email'}
            </button>
          </div>
        </div>

        <hr className="border-gray-200 dark:border-gray-700" />

        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Facebook Messenger</h3>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  name="messenger_enabled"
                  checked={settings.messenger_enabled}
                  onChange={handleChange}
                  className="sr-only"
                />
                <div
                  className={`w-11 h-6 rounded-full transition-colors ${
                    settings.messenger_enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings.messenger_enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Facebook Messenger</span>
            </label>

            {settings.messenger_enabled && (
              <>
                <div>
                  <label className="label">Page Access Token</label>
                  <input
                    type="password"
                    name="messenger_page_token"
                    value={settings.messenger_page_token}
                    onChange={handleChange}
                    placeholder="EAAP..."
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Recipient ID</label>
                  <input
                    type="text"
                    name="messenger_recipient_id"
                    value={settings.messenger_recipient_id}
                    onChange={handleChange}
                    placeholder="1234567890"
                    className="input"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <hr className="border-gray-200 dark:border-gray-700" />

        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">General Settings</h3>

          <div>
            <label className="label">Check Interval (minutes)</label>
            <input
              type="number"
              name="send_interval"
              value={settings.send_interval}
              onChange={handleChange}
              min={1}
              max={1440}
              className="input"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              How often to check for new RSS items (used by cron job).
            </p>
          </div>
        </div>

        <div className="flex space-x-4 pt-4">
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Settings;
