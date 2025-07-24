/**
 * Message types for DOM Snapshot extension communication
 */

interface BaseMessage {
  type: string;
  requestId?: string;
}

interface CaptureSnapshotRequest extends BaseMessage {
  type: 'CAPTURE_SNAPSHOT';
  name?: string;
}

interface CaptureSnapshotResponse extends BaseMessage {
  type: 'CAPTURE_SNAPSHOT_RESPONSE';
  success: boolean;
  snapshotId?: string;
  error?: string;
}

interface GetSnapshotsRequest extends BaseMessage {
  type: 'GET_SNAPSHOTS';
  url?: string;
}

interface GetSnapshotsResponse extends BaseMessage {
  type: 'GET_SNAPSHOTS_RESPONSE';
  snapshots: Array<{
    id: string;
    name: string;
    timestamp: number;
    size: number;
    pageTitle: string;
  }>;
}

interface RestoreSnapshotRequest extends BaseMessage {
  type: 'RESTORE_SNAPSHOT';
  snapshotId: string;
}

interface RestoreSnapshotResponse extends BaseMessage {
  type: 'RESTORE_SNAPSHOT_RESPONSE';
  success: boolean;
  error?: string;
}

interface DeleteSnapshotRequest extends BaseMessage {
  type: 'DELETE_SNAPSHOT';
  snapshotId: string;
}

interface DeleteSnapshotResponse extends BaseMessage {
  type: 'DELETE_SNAPSHOT_RESPONSE';
  success: boolean;
  error?: string;
}

interface ClearSnapshotsRequest extends BaseMessage {
  type: 'CLEAR_SNAPSHOTS';
  url?: string;
}

interface ClearSnapshotsResponse extends BaseMessage {
  type: 'CLEAR_SNAPSHOTS_RESPONSE';
  deletedCount: number;
}

interface ClearAllSnapshotsRequest extends BaseMessage {
  type: 'CLEAR_ALL_SNAPSHOTS';
}

interface ClearAllSnapshotsResponse extends BaseMessage {
  type: 'CLEAR_ALL_SNAPSHOTS_RESPONSE';
  deletedCount: number;
}

interface GetStorageInfoRequest extends BaseMessage {
  type: 'GET_STORAGE_INFO';
}

interface GetStorageInfoResponse extends BaseMessage {
  type: 'GET_STORAGE_INFO_RESPONSE';
  info: {
    totalSize: number;
    snapshotCount: number;
    usedPercentage: number;
    maxSize: number;
  };
}

interface GetCurrentTabRequest extends BaseMessage {
  type: 'GET_CURRENT_TAB';
}

interface GetCurrentTabResponse extends BaseMessage {
  type: 'GET_CURRENT_TAB_RESPONSE';
  tab: {
    url: string;
    title: string;
    favicon?: string;
  } | null;
}

// Content script messages
interface InjectContentScriptRequest extends BaseMessage {
  type: 'INJECT_CONTENT_SCRIPT';
  tabId: number;
}

interface ContentScriptCaptureRequest extends BaseMessage {
  type: 'CONTENT_CAPTURE_DOM';
  options?: {
    includeStyles?: boolean;
    includeScripts?: boolean;
    maxSize?: number;
  };
}

interface ContentScriptCaptureResponse extends BaseMessage {
  type: 'CONTENT_CAPTURE_DOM_RESPONSE';
  success: boolean;
  data?: {
    domContent: string;
    metadata: {
      size: number;
      pageTitle: string;
      viewport: { width: number; height: number };
      url: string;
      timestamp: number;
    };
  };
  error?: string;
}

interface ContentScriptRestoreRequest extends BaseMessage {
  type: 'CONTENT_RESTORE_DOM';
  domContent: string;
}

interface ContentScriptRestoreResponse extends BaseMessage {
  type: 'CONTENT_RESTORE_DOM_RESPONSE';
  success: boolean;
  error?: string;
}

type ExtensionMessage =
  | CaptureSnapshotRequest
  | CaptureSnapshotResponse
  | GetSnapshotsRequest
  | GetSnapshotsResponse
  | RestoreSnapshotRequest
  | RestoreSnapshotResponse
  | DeleteSnapshotRequest
  | DeleteSnapshotResponse
  | ClearSnapshotsRequest
  | ClearSnapshotsResponse
  | ClearAllSnapshotsRequest
  | ClearAllSnapshotsResponse
  | GetStorageInfoRequest
  | GetStorageInfoResponse
  | GetCurrentTabRequest
  | GetCurrentTabResponse
  | InjectContentScriptRequest
  | ContentScriptCaptureRequest
  | ContentScriptCaptureResponse
  | ContentScriptRestoreRequest
  | ContentScriptRestoreResponse;

/**
 * Generates a unique request ID for message correlation
 */
const generateRequestId = (): string => `req_${Date.now()}_${Math.random().toString(36).substring(2)}`;

/**
 * Sends a message and waits for response
 */
const sendMessage = async <T extends ExtensionMessage>(message: ExtensionMessage): Promise<T> =>
  new Promise((resolve, reject) => {
    const requestId = generateRequestId();
    const messageWithId = { ...message, requestId };

    const timeout = setTimeout(() => {
      reject(new Error(`Message timeout: ${message.type}`));
    }, 10000); // 10 second timeout

    chrome.runtime.sendMessage(messageWithId, response => {
      clearTimeout(timeout);

      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response) {
        reject(new Error('No response received'));
        return;
      }

      if (response.requestId !== requestId) {
        reject(new Error('Request ID mismatch'));
        return;
      }

      resolve(response as T);
    });
  });

/**
 * Sends a message to content script
 */
const sendMessageToTab = async <T extends ExtensionMessage>(tabId: number, message: ExtensionMessage): Promise<T> =>
  new Promise((resolve, reject) => {
    const requestId = generateRequestId();
    const messageWithId = { ...message, requestId };

    const timeout = setTimeout(() => {
      reject(new Error(`Tab message timeout: ${message.type}`));
    }, 10000);

    chrome.tabs.sendMessage(tabId, messageWithId, response => {
      clearTimeout(timeout);

      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response) {
        reject(new Error('No response from content script'));
        return;
      }

      resolve(response as T);
    });
  });

export type {
  BaseMessage,
  CaptureSnapshotRequest,
  CaptureSnapshotResponse,
  GetSnapshotsRequest,
  GetSnapshotsResponse,
  RestoreSnapshotRequest,
  RestoreSnapshotResponse,
  DeleteSnapshotRequest,
  DeleteSnapshotResponse,
  ClearSnapshotsRequest,
  ClearSnapshotsResponse,
  ClearAllSnapshotsRequest,
  ClearAllSnapshotsResponse,
  GetStorageInfoRequest,
  GetStorageInfoResponse,
  GetCurrentTabRequest,
  GetCurrentTabResponse,
  InjectContentScriptRequest,
  ContentScriptCaptureRequest,
  ContentScriptCaptureResponse,
  ContentScriptRestoreRequest,
  ContentScriptRestoreResponse,
  ExtensionMessage,
};
export { generateRequestId, sendMessage, sendMessageToTab };
