import { captureDOM, restoreDOM, restoreDOMHotReload, validateDOMContent } from '@extension/shared';
import type {
  ExtensionMessage,
  ContentScriptCaptureRequest,
  ContentScriptCaptureResponse,
  ContentScriptRestoreRequest,
  ContentScriptRestoreResponse,
} from '@extension/shared/lib/utils/messages';

interface GlobalThis {
  __DOM_SNAP_RESTORE_METHOD?: string;
  __DOM_SNAP_CONFIG?: typeof RESTORATION_CONFIG;
  __DOM_SNAP_SET_METHOD?: (method: 'hot-reload' | 'traditional', preserveState?: boolean) => typeof RESTORATION_CONFIG;
}

/**
 * Configuration for restoration method
 */
const RESTORATION_CONFIG = {
  // Set to 'hot-reload' for the new method, 'traditional' for the old method
  method: (globalThis as GlobalThis).__DOM_SNAP_RESTORE_METHOD || 'hot-reload',
  // Enable/disable state preservation
  preserveState: true,
  // Enable debug logging
  debug: true,
};

/**
 * Debug logger
 */
const debugLog = (message: string, ...args: unknown[]) => {
  if (RESTORATION_CONFIG.debug) {
    console.log(`[DOM-SNAP DEBUG] ${message}`, ...args);
  }
};

/**
 * Handles DOM capture request from background script
 */
const handleCaptureRequest = async (request: ContentScriptCaptureRequest): Promise<ContentScriptCaptureResponse> => {
  try {
    console.log('[DOM-SNAP] Starting DOM capture...');
    debugLog('Capture request received', request);

    const result = await captureDOM({
      timeout: 10000,
      maxSize: 10 * 1024 * 1024, // 10MB limit
    });

    console.log('[DOM-SNAP] DOM captured successfully');
    debugLog('Capture completed', { size: result.metadata.size, title: result.metadata.pageTitle });

    return {
      type: 'CONTENT_CAPTURE_DOM_RESPONSE',
      requestId: request.requestId,
      success: true,
      data: {
        domContent: result.domContent,
        metadata: result.metadata,
      },
    };
  } catch (error) {
    console.error('[DOM-SNAP] Error capturing DOM:', error);

    return {
      type: 'CONTENT_CAPTURE_DOM_RESPONSE',
      requestId: request.requestId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

/**
 * Shows a confirmation dialog for restoration
 */
const showRestoreConfirmation = async (): Promise<boolean> => {
  const method = RESTORATION_CONFIG.method === 'hot-reload' ? 'Hot Reload' : 'Traditional';
  const preserveNote = RESTORATION_CONFIG.preserveState
    ? 'Your current form data, scroll position, and JavaScript state will be preserved.'
    : 'Current page state will be lost.';

  return confirm(
    `Restore DOM snapshot using ${method} method?\n\n` +
      `${preserveNote}\n\n` +
      `This action will modify the current page content. Continue?`,
  );
};

/**
 * Handles DOM restoration request from background script
 */
const handleRestoreRequest = async (request: ContentScriptRestoreRequest): Promise<ContentScriptRestoreResponse> => {
  try {
    console.log('[DOM-SNAP] Starting DOM restoration...');
    debugLog('Restore request received', {
      method: RESTORATION_CONFIG.method,
      preserveState: RESTORATION_CONFIG.preserveState,
    });

    // Validate DOM content before restoration
    const validation = validateDOMContent(request.domContent);
    if (!validation.isValid) {
      throw new Error(`Invalid DOM content: ${validation.errors.join(', ')}`);
    }

    // Show confirmation dialog if possible
    const shouldRestore = await showRestoreConfirmation();
    if (!shouldRestore) {
      return {
        type: 'CONTENT_RESTORE_DOM_RESPONSE',
        requestId: request.requestId,
        success: false,
        error: 'Restoration cancelled by user',
      };
    }

    // Choose restoration method based on configuration
    if (RESTORATION_CONFIG.method === 'hot-reload') {
      debugLog('Using hot reload restoration method');
      await restoreDOMHotReload(request.domContent, {
        timeout: 5000,
        preserveState: RESTORATION_CONFIG.preserveState,
      });
      console.log('[DOM-SNAP] DOM restored successfully using hot reload method');
    } else {
      debugLog('Using traditional restoration method');
      await restoreDOM(request.domContent, { timeout: 5000 });
      console.log('[DOM-SNAP] DOM restored successfully using traditional method');
    }

    return {
      type: 'CONTENT_RESTORE_DOM_RESPONSE',
      requestId: request.requestId,
      success: true,
    };
  } catch (error) {
    console.error('[DOM-SNAP] Error restoring DOM:', error);

    return {
      type: 'CONTENT_RESTORE_DOM_RESPONSE',
      requestId: request.requestId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

/**
 * Message handler for content script
 */
const handleMessage = (
  message: ExtensionMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: ExtensionMessage) => void,
): boolean => {
  debugLog('Message received', message.type);

  switch (message.type) {
    case 'CONTENT_CAPTURE_DOM':
      handleCaptureRequest(message as ContentScriptCaptureRequest)
        .then(sendResponse)
        .catch(error => {
          console.error('[DOM-SNAP] Error in capture handler:', error);
          sendResponse({
            type: 'CONTENT_CAPTURE_DOM_RESPONSE',
            requestId: message.requestId,
            success: false,
            error: error instanceof Error ? error.message : 'Handler error',
          } as ContentScriptCaptureResponse);
        });
      return true; // Keep message channel open for async response

    case 'CONTENT_RESTORE_DOM':
      handleRestoreRequest(message as ContentScriptRestoreRequest)
        .then(sendResponse)
        .catch(error => {
          console.error('[DOM-SNAP] Error in restore handler:', error);
          sendResponse({
            type: 'CONTENT_RESTORE_DOM_RESPONSE',
            requestId: message.requestId,
            success: false,
            error: error instanceof Error ? error.message : 'Handler error',
          } as ContentScriptRestoreResponse);
        });
      return true; // Keep message channel open for async response

    default:
      debugLog('Unknown message type', message.type);
      return false;
  }
};

// Register message listener
chrome.runtime.onMessage.addListener(handleMessage);

// Expose configuration for testing
(globalThis as GlobalThis).__DOM_SNAP_CONFIG = RESTORATION_CONFIG;

// Log initialization
debugLog('Content script initialized', {
  url: location.href,
  method: RESTORATION_CONFIG.method,
  preserveState: RESTORATION_CONFIG.preserveState,
});

console.log('[DOM-SNAP] Content script loaded and ready');

// Add a global function to switch restoration methods for testing
(globalThis as GlobalThis).__DOM_SNAP_SET_METHOD = (method: 'hot-reload' | 'traditional', preserveState = true) => {
  RESTORATION_CONFIG.method = method;
  RESTORATION_CONFIG.preserveState = preserveState;
  console.log(`[DOM-SNAP] Switched to ${method} restoration method (preserveState: ${preserveState})`);
  return RESTORATION_CONFIG;
};
