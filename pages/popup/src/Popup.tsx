import '@src/Popup.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useEffect, useState, useCallback } from 'react';
import type {
  ExtensionMessage,
  CaptureSnapshotResponse,
  GetSnapshotsResponse,
  GetCurrentTabResponse,
  GetStorageInfoResponse,
  RestoreSnapshotResponse,
  DeleteSnapshotResponse,
  RenameSnapshotResponse,
  CopySnapshotResponse,
  ClearSnapshotsResponse,
  ClearAllSnapshotsResponse,
} from '@extension/shared';

interface SnapshotItem {
  id: string;
  name: string;
  timestamp: number;
  size: number;
  pageTitle: string;
}

interface TabInfo {
  url: string;
  title: string;
  favicon?: string;
}

interface StorageInfo {
  totalSize: number;
  snapshotCount: number;
  usedPercentage: number;
  maxSize: number;
}

const Popup = () => {
  const { isLight } = useStorage(exampleThemeStorage);

  // State
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [currentTab, setCurrentTab] = useState<TabInfo | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  // Send message to background script
  const sendMessage = useCallback(
    async <T extends ExtensionMessage>(message: ExtensionMessage): Promise<T> =>
      new Promise((resolve, reject) => {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        const messageWithId = { ...message, requestId };

        chrome.runtime.sendMessage(messageWithId, response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response || response.requestId !== requestId) {
            reject(new Error('Invalid response'));
            return;
          }

          resolve(response as T);
        });
      }),
    [],
  );

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load current tab info
      const tabResponse = await sendMessage<GetCurrentTabResponse>({
        type: 'GET_CURRENT_TAB',
      });
      setCurrentTab(tabResponse.tab);

      // Load snapshots
      const snapshotsResponse = await sendMessage<GetSnapshotsResponse>({
        type: 'GET_SNAPSHOTS',
      });
      setSnapshots(snapshotsResponse.snapshots);

      // Load storage info
      const storageResponse = await sendMessage<GetStorageInfoResponse>({
        type: 'GET_STORAGE_INFO',
      });
      setStorageInfo(storageResponse.info);
    } catch (error) {
      console.error('Error loading data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [sendMessage]);

  // Capture snapshot
  const captureSnapshot = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await sendMessage<CaptureSnapshotResponse>({
        type: 'CAPTURE_SNAPSHOT',
        name: `Snapshot ${new Date().toISOString().substring(0, 10)} ${new Date().toTimeString().substring(0, 8)}`,
      });

      if (response.success) {
        // Reload data to show new snapshot
        await loadData();
      } else {
        setError(response.error || 'Failed to capture snapshot');
      }
    } catch (error) {
      console.error('Error capturing snapshot:', error);
      setError(error instanceof Error ? error.message : 'Failed to capture snapshot');
    } finally {
      setLoading(false);
    }
  }, [sendMessage, loadData]);

  // Restore snapshot
  const restoreSnapshot = useCallback(
    async (snapshotId: string) => {
      try {
        setLoading(true);
        setError(null);

        const response = await sendMessage<RestoreSnapshotResponse>({
          type: 'RESTORE_SNAPSHOT',
          snapshotId,
        });

        if (!response.success) {
          setError(response.error || 'Failed to restore snapshot');
        }
      } catch (error) {
        console.error('Error restoring snapshot:', error);
        setError(error instanceof Error ? error.message : 'Failed to restore snapshot');
      } finally {
        setLoading(false);
      }
    },
    [sendMessage],
  );

  // Delete snapshot
  const deleteSnapshot = useCallback(
    async (snapshotId: string) => {
      try {
        setLoading(true);
        setError(null);

        const response = await sendMessage<DeleteSnapshotResponse>({
          type: 'DELETE_SNAPSHOT',
          snapshotId,
        });

        if (response.success) {
          // Remove from local state
          setSnapshots(prev => prev.filter(s => s.id !== snapshotId));
          // Reload storage info
          const storageResponse = await sendMessage<GetStorageInfoResponse>({
            type: 'GET_STORAGE_INFO',
          });
          setStorageInfo(storageResponse.info);
        } else {
          setError(response.error || 'Failed to delete snapshot');
        }
      } catch (error) {
        console.error('Error deleting snapshot:', error);
        setError(error instanceof Error ? error.message : 'Failed to delete snapshot');
      } finally {
        setLoading(false);
      }
    },
    [sendMessage],
  );

  // Start editing a snapshot name
  const startEditing = useCallback((snapshotId: string, currentName: string) => {
    setEditingSnapshotId(snapshotId);
    setEditingName(currentName);
  }, []);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingSnapshotId(null);
    setEditingName('');
  }, []);

  // Save renamed snapshot
  const saveRename = useCallback(
    async (snapshotId: string) => {
      if (!editingName.trim()) {
        setError('Snapshot name cannot be empty');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await sendMessage<RenameSnapshotResponse>({
          type: 'RENAME_SNAPSHOT',
          snapshotId,
          newName: editingName.trim(),
        });

        if (response.success) {
          // Update local state
          setSnapshots(prev => prev.map(s => (s.id === snapshotId ? { ...s, name: editingName.trim() } : s)));
          setEditingSnapshotId(null);
          setEditingName('');
        } else {
          setError(response.error || 'Failed to rename snapshot');
        }
      } catch (error) {
        console.error('Error renaming snapshot:', error);
        setError(error instanceof Error ? error.message : 'Failed to rename snapshot');
      } finally {
        setLoading(false);
      }
    },
    [sendMessage, editingName],
  );

  // Handle Enter key to save, Escape to cancel
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, snapshotId: string) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveRename(snapshotId);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEditing();
      }
    },
    [saveRename, cancelEditing],
  );

  // Format file size
  const formatSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }, []);

  // Format timestamp
  const formatTimestamp = useCallback((timestamp: number): string => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }, []);

  // Copy snapshot to clipboard
  const copySnapshot = useCallback(
    async (snapshotId: string) => {
      try {
        setLoading(true);
        setError(null);

        const response = await sendMessage<CopySnapshotResponse>({
          type: 'COPY_SNAPSHOT',
          snapshotId,
        });

        if (response.success && response.content) {
          // Check if the Clipboard API is available
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(response.content);

            // Show success notification with metadata
            const size = response.metadata?.size ? formatSize(response.metadata.size) : 'unknown size';
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icon-34.png',
              title: 'DOM Snap',
              message: `Snapshot copied to clipboard (${size})`,
            });
          } else {
            // Fallback for browsers without Clipboard API
            const textArea = document.createElement('textarea');
            textArea.value = response.content;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
              document.execCommand('copy');
              textArea.remove();

              // Show success notification
              chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon-34.png',
                title: 'DOM Snap',
                message: 'Snapshot copied to clipboard',
              });
            } catch {
              textArea.remove();
              throw new Error('Clipboard copy not supported');
            }
          }
        } else {
          setError(response.error || 'Failed to copy snapshot');
        }
      } catch (error) {
        console.error('Error copying snapshot:', error);
        setError(error instanceof Error ? error.message : 'Failed to copy snapshot');
      } finally {
        setLoading(false);
      }
    },
    [sendMessage, formatSize],
  );

  // Clear all snapshots for current page
  const clearAllSnapshots = useCallback(async () => {
    if (!confirm('Are you sure you want to delete all snapshots for this page?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await sendMessage<ClearSnapshotsResponse>({
        type: 'CLEAR_SNAPSHOTS',
      });

      if (response.deletedCount > 0) {
        setSnapshots([]);
        // Reload storage info
        const storageResponse = await sendMessage<GetStorageInfoResponse>({
          type: 'GET_STORAGE_INFO',
        });
        setStorageInfo(storageResponse.info);
      }
    } catch (error) {
      console.error('Error clearing snapshots:', error);
      setError(error instanceof Error ? error.message : 'Failed to clear snapshots');
    } finally {
      setLoading(false);
    }
  }, [sendMessage]);

  // Clear ALL snapshots from all pages
  const clearAllSnapshotsFromAllPages = useCallback(async () => {
    const confirmMessage =
      'Are you sure you want to delete ALL snapshots from ALL pages?\n\n' +
      'This will permanently remove all your saved snapshots and cannot be undone.';

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await sendMessage<ClearAllSnapshotsResponse>({
        type: 'CLEAR_ALL_SNAPSHOTS',
      });

      if (response.deletedCount > 0) {
        setSnapshots([]);
        // Reload storage info
        const storageResponse = await sendMessage<GetStorageInfoResponse>({
          type: 'GET_STORAGE_INFO',
        });
        setStorageInfo(storageResponse.info);
      }
    } catch (error) {
      console.error('Error clearing all snapshots:', error);
      setError(error instanceof Error ? error.message : 'Failed to clear all snapshots');
    } finally {
      setLoading(false);
    }
  }, [sendMessage]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Check if current page is valid for snapshots
  const isValidPage =
    currentTab?.url &&
    (currentTab.url.startsWith('http://') || currentTab.url.startsWith('https://')) &&
    !currentTab.url.startsWith('chrome://') &&
    !currentTab.url.startsWith('about:');

  return (
    <div
      className={cn(
        'popup-container flex max-h-[600px] min-h-[500px] w-[480px] min-w-[480px] flex-col p-0',
        isLight ? 'bg-white' : 'bg-gray-900',
      )}>
      {/* Header */}
      <div className={cn('border-b p-4', isLight ? 'border-gray-200 bg-blue-50' : 'border-gray-700 bg-blue-900/20')}>
        <div className="flex items-center gap-3">
          {currentTab?.favicon && (
            <img
              src={currentTab.favicon}
              alt=""
              className="h-5 w-5 rounded"
              onError={e => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <div className="min-w-0 flex-1">
            <h1 className={cn('truncate text-sm font-semibold', isLight ? 'text-gray-900' : 'text-white')}>DOM Snap</h1>
            <p className={cn('truncate text-xs', isLight ? 'text-gray-600' : 'text-gray-400')}>
              {currentTab?.title || 'Loading...'}
            </p>
          </div>
          <div
            className={cn(
              'rounded px-2 py-1 text-xs',
              isLight ? 'bg-blue-100 text-blue-800' : 'bg-blue-800/50 text-blue-200',
            )}>
            {snapshots.length} saved
          </div>
        </div>
      </div>

      {/* Storage Indicator */}
      {storageInfo && (
        <div
          className={cn(
            'border-b p-3 text-xs',
            isLight ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-gray-800',
          )}>
          <div className="mb-1 flex items-center justify-between">
            <span className={isLight ? 'text-gray-600' : 'text-gray-400'}>Storage Used</span>
            <span className={isLight ? 'text-gray-900' : 'text-white'}>
              {formatSize(storageInfo.totalSize)} / {formatSize(storageInfo.maxSize)}
            </span>
          </div>
          <div className={cn('h-1.5 w-full rounded-full', isLight ? 'bg-gray-200' : 'bg-gray-700')}>
            <div
              className={cn('h-full rounded-full transition-all', {
                'bg-green-500': storageInfo.usedPercentage < 60,
                'bg-yellow-500': storageInfo.usedPercentage >= 60 && storageInfo.usedPercentage < 85,
                'bg-red-500': storageInfo.usedPercentage >= 85,
              })}
              style={{ width: `${Math.min(storageInfo.usedPercentage, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="border-b border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
          <button onClick={() => setError(null)} className="mt-1 text-xs text-red-600 hover:text-red-800">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Capture Button */}
        <div className="flex-shrink-0 p-4">
          <button
            onClick={captureSnapshot}
            disabled={loading || !isValidPage}
            className={cn(
              'w-full rounded-lg px-4 py-3 text-sm font-medium transition-all',
              'disabled:cursor-not-allowed disabled:opacity-50',
              isValidPage && !loading
                ? isLight
                  ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
                : isLight
                  ? 'bg-gray-300 text-gray-500'
                  : 'bg-gray-700 text-gray-400',
            )}>
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Working...
              </div>
            ) : !isValidPage ? (
              'Cannot capture this page'
            ) : (
              '📸 Take Snapshot'
            )}
          </button>
        </div>

        {/* Snapshots List */}
        <div className="flex flex-1 flex-col overflow-hidden px-4 pb-4">
          <div className="mb-3 flex flex-shrink-0 items-center justify-between">
            <h2 className={cn('text-sm font-medium', isLight ? 'text-gray-900' : 'text-white')}>
              Snapshots ({snapshots.length})
            </h2>
            {snapshots.length > 0 && (
              <button
                onClick={clearAllSnapshots}
                disabled={loading}
                className={cn('flex-shrink-0 text-xs text-red-600 hover:text-red-800 disabled:opacity-50')}>
                Clear This Page
              </button>
            )}
          </div>

          {snapshots.length === 0 ? (
            <div
              className={cn(
                'flex flex-1 items-center justify-center py-8 text-center text-sm',
                isLight ? 'text-gray-500' : 'text-gray-400',
              )}>
              <div>
                No snapshots yet
                <br />
                <span className="text-xs">Capture your first snapshot above</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-2 pr-1">
                {snapshots.map(snapshot => (
                  <div
                    key={snapshot.id}
                    className={cn(
                      'rounded-lg border p-3 transition-colors',
                      isLight
                        ? 'border-gray-200 bg-white hover:bg-gray-50'
                        : 'hover:bg-gray-750 border-gray-700 bg-gray-800',
                    )}>
                    <div className="flex w-full items-start gap-2">
                      <div className="min-w-0 flex-1">
                        {editingSnapshotId === snapshot.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editingName}
                              onChange={e => setEditingName(e.target.value)}
                              onKeyDown={e => handleKeyDown(e, snapshot.id)}
                              className={cn(
                                'flex-1 rounded border px-1 py-0.5 text-sm font-medium',
                                isLight
                                  ? 'border-gray-300 bg-white text-gray-900'
                                  : 'border-gray-600 bg-gray-700 text-white',
                              )}
                              placeholder="Enter snapshot name"
                              disabled={loading}
                            />
                            <button
                              onClick={() => saveRename(snapshot.id)}
                              disabled={loading || !editingName.trim()}
                              className={cn(
                                'rounded px-1 py-1 text-xs font-medium transition-colors disabled:opacity-50',
                                isLight
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-green-900/50 text-green-300 hover:bg-green-900/70',
                              )}
                              title="Save (Enter)">
                              ✓
                            </button>
                            <button
                              onClick={cancelEditing}
                              disabled={loading}
                              className={cn(
                                'rounded px-1 py-1 text-xs font-medium transition-colors disabled:opacity-50',
                                isLight
                                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  : 'bg-gray-900/50 text-gray-300 hover:bg-gray-900/70',
                              )}
                              title="Cancel (Escape)">
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <p
                              className={cn(
                                'flex-1 truncate text-sm font-medium',
                                isLight ? 'text-gray-900' : 'text-white',
                              )}>
                              {snapshot.name}
                            </p>
                            <button
                              onClick={() => startEditing(snapshot.id, snapshot.name)}
                              disabled={loading}
                              className={cn(
                                'rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50',
                                isLight ? 'text-blue-700 hover:bg-blue-200' : 'text-blue-300 hover:bg-blue-900/70',
                              )}
                              title="Rename this snapshot">
                              &#x270f;&#xfe0f;
                            </button>
                            <button
                              onClick={() => copySnapshot(snapshot.id)}
                              disabled={loading}
                              className={cn(
                                'rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50',
                                isLight
                                  ? 'text-purple-700 hover:bg-purple-200'
                                  : 'text-purple-300 hover:bg-purple-900/70',
                              )}
                              title="Copy snapshot HTML to clipboard">
                              &#x1f4cb;
                            </button>
                          </div>
                        )}
                        <p className={cn('mt-1 text-xs', isLight ? 'text-gray-500' : 'text-gray-400')}>
                          {formatTimestamp(snapshot.timestamp)}
                        </p>
                        <p className={cn('text-xs', isLight ? 'text-gray-500' : 'text-gray-400')}>
                          {formatSize(snapshot.size)}
                        </p>
                      </div>
                      <div className="flex min-w-[80px] flex-shrink-0 flex-col gap-2">
                        <button
                          onClick={() => restoreSnapshot(snapshot.id)}
                          disabled={loading}
                          className={cn(
                            'w-full rounded px-2 py-1 text-center text-xs font-medium transition-colors disabled:opacity-50',
                            isLight
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-green-900/50 text-green-300 hover:bg-green-900/70',
                          )}
                          title="Restore this snapshot">
                          &#x21bb; Restore
                        </button>
                        <button
                          onClick={() => deleteSnapshot(snapshot.id)}
                          disabled={loading}
                          className={cn(
                            'w-full rounded px-2 py-1 text-center text-xs font-medium transition-colors disabled:opacity-50',
                            isLight
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-red-900/50 text-red-300 hover:bg-red-900/70',
                          )}
                          title="Delete this snapshot">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Clear All Data Section */}
        {storageInfo && storageInfo.snapshotCount > 0 && (
          <div
            className={cn(
              'border-t px-4 py-2',
              isLight ? 'border-gray-200 bg-gray-50/50' : 'border-gray-700 bg-gray-800/30',
            )}>
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className={cn('text-xs', isLight ? 'text-gray-600' : 'text-gray-400')}>
                  Clear all snapshots from all pages
                </p>
              </div>
              <button
                onClick={clearAllSnapshotsFromAllPages}
                disabled={loading}
                className={cn(
                  'flex-shrink-0 rounded px-2 py-1 text-xs transition-colors disabled:opacity-50',
                  isLight
                    ? 'text-red-600 hover:bg-red-600 hover:text-white'
                    : 'text-red-600 hover:bg-red-600 hover:text-white',
                )}
                title="Permanently delete ALL snapshots from ALL pages">
                Clear All Data
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
