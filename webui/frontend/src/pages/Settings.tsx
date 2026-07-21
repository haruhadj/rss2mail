import { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
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
    has_app_password: false,
    messenger_enabled: false,
    messenger_page_token: '',
    has_messenger_page_token: false,
    messenger_recipient_id: '',
    send_interval: 15,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [exporting, setExporting] = useState<'opml' | 'json' | null>(null);
  const [importing, setImporting] = useState<boolean>(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async (): Promise<void> => {
    try {
      const data = await api.getSettings();
      setSettings({
        email: data.email || '',
        app_password: '',
        has_app_password: !!data.has_app_password,
        messenger_enabled: data.messenger_enabled ?? !!(data.has_messenger_page_token || data.messenger_recipient_id),
        messenger_page_token: '',
        has_messenger_page_token: !!data.has_messenger_page_token,
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
      const payload: Partial<SettingsType> = {
        email: settings.email,
        messenger_enabled: settings.messenger_enabled,
        messenger_recipient_id: settings.messenger_recipient_id,
        send_interval: settings.send_interval,
      };
      if (settings.app_password) payload.app_password = settings.app_password;
      if (settings.messenger_page_token) payload.messenger_page_token = settings.messenger_page_token;
      await api.updateSettings(payload);
      showMessage('Settings saved successfully!');
    } catch (err) {
      showMessage('Error saving settings: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (format: 'opml' | 'json'): Promise<void> => {
    setExporting(format);
    try {
      const blob = await api.exportFeeds(format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rss2mail-feeds.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showMessage('Export failed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setExporting(null);
    }
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImporting(true);
    try {
      const result = await api.importFeeds(file);
      const failedNote = result.failed.length > 0 ? `, ${result.failed.length} failed` : '';
      showMessage(`Imported: ${result.added} added, ${result.skipped} skipped${failedNote}`);
    } catch (err) {
      showMessage('Import failed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setImporting(false);
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
      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Settings</h2>

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
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Email Configuration</h3>

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
                  placeholder={settings.has_app_password ? 'Unchanged — enter a new value to replace it' : 'xxxx xxxx xxxx xxxx'}
                  className="input pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Generate an App Password from your Google Account settings.
              </p>
            </div>

            <button
              type="button"
              onClick={handleTestEmail}
              disabled={testing || !settings.email || (!settings.app_password && !settings.has_app_password)}
              className="btn-secondary text-sm"
            >
              {testing ? 'Testing...' : 'Test Email'}
            </button>
          </div>
        </div>

        <hr className="border-slate-200 dark:border-slate-700" />

        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Facebook Messenger</h3>

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
                    settings.messenger_enabled ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                />
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings.messenger_enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable Facebook Messenger</span>
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
                    placeholder={settings.has_messenger_page_token ? 'Unchanged — enter a new value to replace it' : 'EAAP...'}
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

        <hr className="border-slate-200 dark:border-slate-700" />

        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">General Settings</h3>

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
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
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

      <div className="mt-6 card">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Feed Backup</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Export your feed list to back it up or move it to another instance, or import a previously exported file.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => handleExport('opml')}
            disabled={exporting !== null}
            className="btn-secondary flex-1"
          >
            {exporting === 'opml' ? 'Exporting...' : 'Export OPML'}
          </button>
          <button
            type="button"
            onClick={() => handleExport('json')}
            disabled={exporting !== null}
            className="btn-secondary flex-1"
          >
            {exporting === 'json' ? 'Exporting...' : 'Export JSON'}
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="btn-secondary flex-1"
          >
            {importing ? 'Importing...' : 'Import File'}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".opml,.xml,.json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
}

export default Settings;
