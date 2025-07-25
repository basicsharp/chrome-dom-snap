import 'webextension-polyfill';
import {
  initializeStorage,
  getSnapshotsForUrl,
  saveSnapshot,
  deleteSnapshot,
  renameSnapshot,
  clearSnapshotsForUrl,
  clearAllSnapshots,
  getStorageInfo,
  getSnapshotById,
  isValidUrl,
} from '@extension/shared';
import type {
  ExtensionMessage,
  CaptureSnapshotRequest,
  GetSnapshotsRequest,
  RestoreSnapshotRequest,
  DeleteSnapshotRequest,
  RenameSnapshotRequest,
  ClearSnapshotsRequest,
  ClearAllSnapshotsRequest,
  GetStorageInfoRequest,
  GetCurrentTabRequest,
  ContentScriptCaptureResponse,
  ContentScriptRestoreResponse,
} from '@extension/shared';

/**
 * DOM Snapshot Extension Background Service Worker
 */

// Initialize storage on startup
initializeStorage().then(() => {
  console.log('[DOM-SNAP] Background service worker initialized');
});

/**
 * Gets the current active tab
 */
const getCurrentTab = async (): Promise<chrome.tabs.Tab | null> => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab || null;
  } catch (error) {
    console.error('[DOM-SNAP] Error getting current tab:', error);
    return null;
  }
};

/**
 * Injects content script into a tab
 */
const injectContentScript = async (tabId: number): Promise<boolean> => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['/content/all.iife.js'],
    });

    console.log(`[DOM-SNAP] Content script injected into tab ${tabId}`);
    return true;
  } catch (error) {
    console.error('[DOM-SNAP] Error injecting content script:', error);
    return false;
  }
};

/**
 * Sends a message to content script with retry logic
 */
const sendMessageToContentScript = async <T>(tabId: number, message: ExtensionMessage, retryCount = 0): Promise<T> => {
  const maxRetries = 2;

  try {
    return await new Promise<T>((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response) {
          reject(new Error('No response from content script'));
          return;
        }

        resolve(response);
      });
    });
  } catch (error) {
    if (retryCount < maxRetries && error instanceof Error && error.message.includes('Could not establish connection')) {
      console.log(`[DOM-SNAP] Retrying content script injection (attempt ${retryCount + 1})`);

      // Try to inject content script again
      const injected = await injectContentScript(tabId);
      if (injected) {
        // Wait a bit for script to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        return sendMessageToContentScript<T>(tabId, message, retryCount + 1);
      }
    }

    throw error;
  }
};

/**
 * Handles capture snapshot request
 */
const handleCaptureSnapshot = async (request: CaptureSnapshotRequest): Promise<ExtensionMessage> => {
  try {
    const tab = await getCurrentTab();
    if (!tab || !tab.id || !tab.url) {
      return {
        type: 'CAPTURE_SNAPSHOT_RESPONSE',
        requestId: request.requestId,
        success: false,
        error: 'No active tab found',
      };
    }

    if (!isValidUrl(tab.url)) {
      return {
        type: 'CAPTURE_SNAPSHOT_RESPONSE',
        requestId: request.requestId,
        success: false,
        error: 'Cannot capture snapshots on this page',
      };
    }

    // Send capture request to content script
    const captureResponse = await sendMessageToContentScript<ContentScriptCaptureResponse>(tab.id, {
      type: 'CONTENT_CAPTURE_DOM',
      options: {
        includeStyles: true,
        includeScripts: false,
        maxSize: 5 * 1024 * 1024, // 5MB
      },
    });

    if (!captureResponse.success || !captureResponse.data) {
      return {
        type: 'CAPTURE_SNAPSHOT_RESPONSE',
        requestId: request.requestId,
        success: false,
        error: captureResponse.error || 'Failed to capture DOM',
      };
    }

    // Save snapshot
    const snapshotId = await saveSnapshot(tab.url, {
      timestamp: Date.now(),
      name:
        request.name ||
        `Snapshot ${new Date().toISOString().substring(0, 10)} ${new Date().toTimeString().substring(0, 8)}`,
      domContent: captureResponse.data.domContent,
      metadata: captureResponse.data.metadata,
    });

    // Show success notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon-34.png',
      title: 'DOM Snap',
      message: 'Snapshot captured successfully!',
    });

    return {
      type: 'CAPTURE_SNAPSHOT_RESPONSE',
      requestId: request.requestId,
      success: true,
      snapshotId,
    };
  } catch (error) {
    console.error('[DOM-SNAP] Error capturing snapshot:', error);
    return {
      type: 'CAPTURE_SNAPSHOT_RESPONSE',
      requestId: request.requestId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Handles get snapshots request
 */
const handleGetSnapshots = async (request: GetSnapshotsRequest): Promise<ExtensionMessage> => {
  try {
    let url = request.url;

    if (!url) {
      const tab = await getCurrentTab();
      if (!tab || !tab.url) {
        return {
          type: 'GET_SNAPSHOTS_RESPONSE',
          requestId: request.requestId,
          snapshots: [],
        };
      }
      url = tab.url;
    }

    const snapshots = await getSnapshotsForUrl(url);

    return {
      type: 'GET_SNAPSHOTS_RESPONSE',
      requestId: request.requestId,
      snapshots: snapshots.map(snapshot => ({
        id: snapshot.id,
        name: snapshot.name,
        timestamp: snapshot.timestamp,
        size: snapshot.metadata.size,
        pageTitle: snapshot.metadata.pageTitle,
      })),
    };
  } catch (error) {
    console.error('[DOM-SNAP] Error getting snapshots:', error);
    return {
      type: 'GET_SNAPSHOTS_RESPONSE',
      requestId: request.requestId,
      snapshots: [],
    };
  }
};

/**
 * Handles restore snapshot request
 */
const handleRestoreSnapshot = async (request: RestoreSnapshotRequest): Promise<ExtensionMessage> => {
  try {
    const tab = await getCurrentTab();
    if (!tab || !tab.id) {
      return {
        type: 'RESTORE_SNAPSHOT_RESPONSE',
        requestId: request.requestId,
        success: false,
        error: 'No active tab found',
      };
    }

    const snapshot = await getSnapshotById(request.snapshotId);
    if (!snapshot) {
      return {
        type: 'RESTORE_SNAPSHOT_RESPONSE',
        requestId: request.requestId,
        success: false,
        error: 'Snapshot not found',
      };
    }

    // Send restore request to content script
    const restoreResponse = await sendMessageToContentScript<ContentScriptRestoreResponse>(tab.id, {
      type: 'CONTENT_RESTORE_DOM',
      domContent: snapshot.domContent,
    });

    if (restoreResponse.success) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-34.png',
        title: 'DOM Snap',
        message: 'Snapshot restored successfully!',
      });
    }

    return {
      type: 'RESTORE_SNAPSHOT_RESPONSE',
      requestId: request.requestId,
      success: restoreResponse.success,
      error: restoreResponse.error,
    };
  } catch (error) {
    console.error('[DOM-SNAP] Error restoring snapshot:', error);
    return {
      type: 'RESTORE_SNAPSHOT_RESPONSE',
      requestId: request.requestId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Handles delete snapshot request
 */
const handleDeleteSnapshot = async (request: DeleteSnapshotRequest): Promise<ExtensionMessage> => {
  try {
    const success = await deleteSnapshot(request.snapshotId);

    return {
      type: 'DELETE_SNAPSHOT_RESPONSE',
      requestId: request.requestId,
      success,
      error: success ? undefined : 'Snapshot not found',
    };
  } catch (error) {
    console.error('[DOM-SNAP] Error deleting snapshot:', error);
    return {
      type: 'DELETE_SNAPSHOT_RESPONSE',
      requestId: request.requestId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Handles rename snapshot request
 */
const handleRenameSnapshot = async (request: RenameSnapshotRequest): Promise<ExtensionMessage> => {
  try {
    const success = await renameSnapshot(request.snapshotId, request.newName);

    if (success) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-34.png',
        title: 'DOM Snap',
        message: `Snapshot renamed to "${request.newName}"`,
      });
    }

    return {
      type: 'RENAME_SNAPSHOT_RESPONSE',
      requestId: request.requestId,
      success,
      error: success ? undefined : 'Snapshot not found',
    };
  } catch (error) {
    console.error('[DOM-SNAP] Error renaming snapshot:', error);
    return {
      type: 'RENAME_SNAPSHOT_RESPONSE',
      requestId: request.requestId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Handles clear snapshots request
 */
const handleClearSnapshots = async (request: ClearSnapshotsRequest): Promise<ExtensionMessage> => {
  try {
    let url = request.url;

    if (!url) {
      const tab = await getCurrentTab();
      if (!tab || !tab.url) {
        return {
          type: 'CLEAR_SNAPSHOTS_RESPONSE',
          requestId: request.requestId,
          deletedCount: 0,
        };
      }
      url = tab.url;
    }

    const deletedCount = await clearSnapshotsForUrl(url);

    if (deletedCount > 0) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-34.png',
        title: 'DOM Snap',
        message: `${deletedCount} snapshots cleared`,
      });
    }

    return {
      type: 'CLEAR_SNAPSHOTS_RESPONSE',
      requestId: request.requestId,
      deletedCount,
    };
  } catch (error) {
    console.error('[DOM-SNAP] Error clearing snapshots:', error);
    return {
      type: 'CLEAR_SNAPSHOTS_RESPONSE',
      requestId: request.requestId,
      deletedCount: 0,
    };
  }
};

/**
 * Handles clear all snapshots request
 */
const handleClearAllSnapshots = async (request: ClearAllSnapshotsRequest): Promise<ExtensionMessage> => {
  try {
    const deletedCount = await clearAllSnapshots();

    if (deletedCount > 0) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-34.png',
        title: 'DOM Snap',
        message: `All ${deletedCount} snapshots cleared from all pages`,
      });
    }

    return {
      type: 'CLEAR_ALL_SNAPSHOTS_RESPONSE',
      requestId: request.requestId,
      deletedCount,
    };
  } catch (error) {
    console.error('[DOM-SNAP] Error clearing all snapshots:', error);
    return {
      type: 'CLEAR_ALL_SNAPSHOTS_RESPONSE',
      requestId: request.requestId,
      deletedCount: 0,
    };
  }
};

/**
 * Handles get storage info request
 */
const handleGetStorageInfo = async (request: GetStorageInfoRequest): Promise<ExtensionMessage> => {
  try {
    const info = await getStorageInfo();

    return {
      type: 'GET_STORAGE_INFO_RESPONSE',
      requestId: request.requestId,
      info,
    };
  } catch (error) {
    console.error('[DOM-SNAP] Error getting storage info:', error);
    return {
      type: 'GET_STORAGE_INFO_RESPONSE',
      requestId: request.requestId,
      info: {
        totalSize: 0,
        snapshotCount: 0,
        usedPercentage: 0,
        maxSize: 8 * 1024 * 1024,
      },
    };
  }
};

/**
 * Handles get current tab request
 */
const handleGetCurrentTab = async (request: GetCurrentTabRequest): Promise<ExtensionMessage> => {
  try {
    const tab = await getCurrentTab();

    return {
      type: 'GET_CURRENT_TAB_RESPONSE',
      requestId: request.requestId,
      tab: tab
        ? {
            url: tab.url || '',
            title: tab.title || 'Unknown',
            favicon: tab.favIconUrl,
          }
        : null,
    };
  } catch (error) {
    console.error('[DOM-SNAP] Error getting current tab:', error);
    return {
      type: 'GET_CURRENT_TAB_RESPONSE',
      requestId: request.requestId,
      tab: null,
    };
  }
};

/**
 * Main message handler
 */
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionMessage) => void,
  ) => {
    console.log(`[DOM-SNAP] Received message: ${message.type}`);

    // Handle messages asynchronously
    (async () => {
      try {
        let response;

        switch (message.type) {
          case 'CAPTURE_SNAPSHOT':
            response = await handleCaptureSnapshot(message as CaptureSnapshotRequest);
            break;

          case 'GET_SNAPSHOTS':
            response = await handleGetSnapshots(message as GetSnapshotsRequest);
            break;

          case 'RESTORE_SNAPSHOT':
            response = await handleRestoreSnapshot(message as RestoreSnapshotRequest);
            break;

          case 'DELETE_SNAPSHOT':
            response = await handleDeleteSnapshot(message as DeleteSnapshotRequest);
            break;

          case 'RENAME_SNAPSHOT':
            response = await handleRenameSnapshot(message as RenameSnapshotRequest);
            break;

          case 'CLEAR_SNAPSHOTS':
            response = await handleClearSnapshots(message as ClearSnapshotsRequest);
            break;

          case 'CLEAR_ALL_SNAPSHOTS':
            response = await handleClearAllSnapshots(message as ClearAllSnapshotsRequest);
            break;

          case 'GET_STORAGE_INFO':
            response = await handleGetStorageInfo(message as GetStorageInfoRequest);
            break;

          case 'GET_CURRENT_TAB':
            response = await handleGetCurrentTab(message as GetCurrentTabRequest);
            break;

          default:
            console.warn(`[DOM-SNAP] Unknown message type: ${message.type}`);
            response = {
              requestId: message.requestId,
              error: `Unknown message type: ${message.type}`,
            } as unknown as ExtensionMessage;
        }

        sendResponse(response);
      } catch (error) {
        console.error('[DOM-SNAP] Error handling message:', error);
        sendResponse({
          requestId: message.requestId,
          error: error instanceof Error ? error.message : 'Unknown error',
        } as unknown as ExtensionMessage);
      }
    })();

    // Return true to indicate we'll send response asynchronously
    return true;
  },
);

// Handle extension installation
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    console.log('[DOM-SNAP] Extension installed');
    initializeStorage();
  } else if (details.reason === 'update') {
    console.log('[DOM-SNAP] Extension updated');
  }
});

console.log('[DOM-SNAP] Background service worker loaded');
