import { captureDOM, restoreDOM, validateDOMContent } from '@extension/shared';
import type {
  ExtensionMessage,
  ContentScriptCaptureRequest,
  ContentScriptRestoreRequest,
  ContentScriptCaptureResponse,
  ContentScriptRestoreResponse,
} from '@extension/shared';

/**
 * DOM Snapshot Content Script
 * Handles DOM capture and restoration in web pages
 */

console.log('[DOM-SNAP] Content script loaded');

/**
 * Handles DOM capture request from background script
 */
const handleCaptureRequest = async (request: ContentScriptCaptureRequest): Promise<ContentScriptCaptureResponse> => {
  try {
    console.log('[DOM-SNAP] Starting DOM capture...');

    const options = {
      includeStyles: request.options?.includeStyles ?? true,
      includeScripts: request.options?.includeScripts ?? false,
      maxSize: request.options?.maxSize ?? 5 * 1024 * 1024,
      timeout: 10000,
    };

    const result = await captureDOM(options);

    console.log(`[DOM-SNAP] DOM captured successfully (${result.metadata.size} bytes)`);

    return {
      type: 'CONTENT_CAPTURE_DOM_RESPONSE',
      requestId: request.requestId,
      success: true,
      data: result,
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
 * Handles DOM restoration request from background script
 */
const handleRestoreRequest = async (request: ContentScriptRestoreRequest): Promise<ContentScriptRestoreResponse> => {
  try {
    console.log('[DOM-SNAP] Starting DOM restoration...');

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

    await restoreDOM(request.domContent, { timeout: 5000 });

    console.log('[DOM-SNAP] DOM restored successfully');

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
 * Shows confirmation dialog before DOM restoration
 */
const showRestoreConfirmation = async (): Promise<boolean> =>
  new Promise(resolve => {
    // Try to show a native confirm dialog
    // Note: This may be blocked by some sites or CSP, so we handle gracefully
    try {
      const confirmed = confirm(
        'DOM Snap: This will replace the current page content with the snapshot. ' +
          'Any unsaved changes will be lost. Continue?',
      );
      resolve(confirmed);
    } catch {
      console.warn('[DOM-SNAP] Could not show confirmation dialog, proceeding with restoration');
      // If we can't show confirmation, we proceed anyway since the user explicitly requested it
      resolve(true);
    }
  });

/**
 * Main message listener for content script
 */
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionMessage) => void,
  ) => {
    console.log(`[DOM-SNAP] Content script received message: ${message.type}`);

    // Handle messages asynchronously
    (async () => {
      try {
        let response;

        switch (message.type) {
          case 'CONTENT_CAPTURE_DOM':
            response = await handleCaptureRequest(message as ContentScriptCaptureRequest);
            break;

          case 'CONTENT_RESTORE_DOM':
            response = await handleRestoreRequest(message as ContentScriptRestoreRequest);
            break;

          default:
            console.warn(`[DOM-SNAP] Unknown message type in content script: ${message.type}`);
            response = {
              requestId: message.requestId,
              error: `Unknown message type: ${message.type}`,
            } as unknown as ExtensionMessage;
        }

        sendResponse(response);
      } catch (error) {
        console.error('[DOM-SNAP] Error handling message in content script:', error);
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

/**
 * Initialization
 */
(() => {
  // Check if we're in a valid context for DOM operations
  if (typeof document === 'undefined') {
    console.warn('[DOM-SNAP] Content script loaded in non-document context');
    return;
  }

  // Check if the page is accessible
  try {
    // Test if we can access document properties
    const tagName = document.documentElement.tagName;
    console.log(`[DOM-SNAP] Content script initialized on ${window.location.hostname} (${tagName})`);
  } catch {
    console.warn('[DOM-SNAP] Limited access to document, some features may not work');
  }

  // Add a small indicator that the extension is active (for debugging)
  if (process.env.NODE_ENV === 'development') {
    const indicator = document.createElement('div');
    indicator.id = 'dom-snap-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #3b82f6;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      z-index: 999999;
      pointer-events: none;
      opacity: 0.7;
    `;
    indicator.textContent = 'DOM Snap Active';

    // Add to page after a short delay to ensure DOM is ready
    setTimeout(() => {
      if (document.body) {
        document.body.appendChild(indicator);

        // Remove after 3 seconds
        setTimeout(() => {
          if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
          }
        }, 3000);
      }
    }, 1000);
  }
})();
