import { useState, useEffect } from 'react';
import { api } from '../api';
import type { LogsResponse } from '../types';

interface Message {
  text: string;
  type: 'success' | 'error';
}

function Logs(): JSX.Element {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [resetting, setResetting] = useState<boolean>(false);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async (): Promise<void> => {
    try {
      const data: LogsResponse = await api.getLogs();
      setLogs(data.logs || []);
    } catch (err) {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error' = 'success'): void => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleReset = async (): Promise<void> => {
    if (
      !confirm(
        'Are you sure you want to reset all processed items? This will cause all RSS items to be sent again.'
      )
    ) {
      return;
    }

    setResetting(true);
    try {
      await api.resetProcessed();
      showMessage('Processed items reset successfully!');
    } catch (err) {
      showMessage('Error resetting: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setResetting(false);
    }
  };

  const handleRefresh = (): void => {
    setLoading(true);
    loadLogs();
  };

  if (loading) {
    return <div className="text-center py-8">Loading logs...</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 justify-between items-center mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">Activity Logs</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={handleRefresh} className="btn-secondary flex-1 sm:flex-none whitespace-nowrap">
            Refresh
          </button>
          <button onClick={handleReset} disabled={resetting} className="btn-danger flex-1 sm:flex-none whitespace-nowrap">
            {resetting ? 'Resetting...' : 'Reset'}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="card">
        {logs.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">No log entries found.</div>
        ) : (
          <div className="space-y-1 font-mono text-xs sm:text-sm">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className={`py-1 px-2 rounded break-all ${
                  log.includes('error') || log.includes('Error')
                    ? 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    : log.includes('sent') || log.includes('success')
                    ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {log}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 card bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700/40">
        <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">About Reset</h3>
        <p className="text-sm text-yellow-700 dark:text-yellow-400">
          Resetting processed items will clear the history of already-sent items. This means the next
          time feeds are checked, all items will be treated as new and will be sent again. Use this
          when you want to re-send recent items.
        </p>
      </div>
    </div>
  );
}

export default Logs;
