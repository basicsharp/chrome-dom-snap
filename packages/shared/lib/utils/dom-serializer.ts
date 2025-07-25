/**
 * DOM Serializer for Chrome Extension
 * Handles capturing and serializing DOM trees with metadata
 */

interface SerializationResult {
  domContent: string;
  metadata: {
    size: number;
    pageTitle: string;
    viewport: {
      width: number;
      height: number;
    };
    url: string;
    timestamp: number;
  };
}

interface SerializationOptions {
  includeStyles?: boolean;
  includeScripts?: boolean;
  maxSize?: number;
  timeout?: number;
}

const DEFAULT_OPTIONS: Required<SerializationOptions> = {
  includeStyles: true,
  includeScripts: false,
  maxSize: 5 * 1024 * 1024, // 5MB
  timeout: 10000, // 10 seconds
};

/**
 * Serializes a DOM node and its children recursively
 */
const serializeNode = (node: Node, options: Required<SerializationOptions>): string => {
  switch (node.nodeType) {
    case Node.ELEMENT_NODE: {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();

      // Skip script tags unless explicitly included
      if (tagName === 'script' && !options.includeScripts) {
        return '';
      }

      // Handle special elements
      if (tagName === 'style' && !options.includeStyles) {
        return '';
      }

      let html = `<${tagName}`;

      // Serialize attributes
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        const value = attr.value.replace(/"/g, '&quot;');
        html += ` ${attr.name}="${value}"`;
      }

      // Handle self-closing tags
      if (element.children.length === 0 && element.textContent === '') {
        const selfClosingTags = [
          'img',
          'br',
          'hr',
          'input',
          'meta',
          'link',
          'area',
          'base',
          'col',
          'embed',
          'source',
          'track',
          'wbr',
        ];
        if (selfClosingTags.includes(tagName)) {
          return `${html} />`;
        }
      }

      html += '>';

      // Serialize children
      for (let i = 0; i < node.childNodes.length; i++) {
        html += serializeNode(node.childNodes[i], options);
      }

      html += `</${tagName}>`;
      return html;
    }

    case Node.TEXT_NODE: {
      const text = node.textContent || '';
      // Escape HTML special characters
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    case Node.COMMENT_NODE: {
      const comment = node.textContent || '';
      return `<!--${comment}-->`;
    }

    case Node.DOCUMENT_TYPE_NODE: {
      const doctype = node as DocumentType;
      return `<!DOCTYPE ${doctype.name}>`;
    }

    default:
      return '';
  }
};

/**
 * Captures the current DOM state and returns serialized content with metadata
 */
const captureDOM = async (options: SerializationOptions = {}): Promise<SerializationResult> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`DOM capture timed out after ${opts.timeout}ms`));
    }, opts.timeout);

    try {
      const startTime = performance.now();

      // Get document content
      const doctype = document.doctype;
      let html = '';

      if (doctype) {
        html += serializeNode(doctype, opts);
      }

      html += serializeNode(document.documentElement, opts);

      // Check size limit
      const size = new Blob([html]).size;
      if (size > opts.maxSize) {
        throw new Error(`DOM size (${size} bytes) exceeds limit (${opts.maxSize} bytes)`);
      }

      // Gather metadata
      const metadata = {
        size,
        pageTitle: document.title || 'Untitled',
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        url: window.location.href,
        timestamp: Date.now(),
      };

      const endTime = performance.now();
      console.log(`[DOM-SNAP] Capture completed in ${(endTime - startTime).toFixed(2)}ms`);

      clearTimeout(timeout);
      resolve({
        domContent: html,
        metadata,
      });
    } catch (error) {
      clearTimeout(timeout);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
};

/**
 * Restores DOM from serialized content using hot-reload-like approach
 * This preserves JavaScript state, event listeners, and form data
 */
const restoreDOMHotReload = async (domContent: string, options: RestoreOptions = {}): Promise<void> => {
  const { timeout = 5000, preserveState = true } = options;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`DOM restoration timed out after ${timeout}ms`));
    }, timeout);

    try {
      const startTime = performance.now();

      // Parse the snapshot HTML
      const parser = new DOMParser();
      const snapshotDoc = parser.parseFromString(domContent, 'text/html');

      if (!snapshotDoc || !snapshotDoc.documentElement) {
        throw new Error('Failed to parse snapshot DOM content');
      }

      // Preserve current state if requested
      const preservedState = preserveState ? preserveCurrentState() : null;

      // Update document elements selectively
      updateDocumentHead(snapshotDoc.head);
      updateDocumentBody(snapshotDoc.body as HTMLBodyElement);

      // Restore preserved state
      if (preservedState) {
        restorePreservedState(preservedState);
      }

      const endTime = performance.now();
      console.log(`[DOM-SNAP] Hot-reload restoration completed in ${(endTime - startTime).toFixed(2)}ms`);

      clearTimeout(timeoutId);
      resolve();
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
};

/**
 * Preserves current page state that should survive restoration
 */
const preserveCurrentState = (): PreservedState => {
  const state: PreservedState = {
    scroll: {
      x: window.scrollX,
      y: window.scrollY,
    },
    focus: {
      element: document.activeElement?.tagName,
      id: document.activeElement?.id,
      name: (document.activeElement as HTMLInputElement)?.name,
    },
    forms: {},
    inputs: {},
    localStorage: { ...localStorage },
    sessionStorage: { ...sessionStorage },
    globalVars: {},
  };

  // Preserve global JavaScript variables that might be on window
  try {
    // Common global variable patterns to preserve
    const globalPatterns = [
      'counter',
      'count',
      'items',
      'data',
      'state',
      'appState',
      'timerValue',
      'timerInterval',
      'itemCounter',
      'isAnimated',
    ];
    globalPatterns.forEach(varName => {
      if (varName in window && window[varName as keyof Window] !== undefined) {
        state.globalVars[varName] = window[varName as keyof Window];
      }
    });

    // Also check for any numeric variables (likely counters) or boolean state variables
    Object.keys(window).forEach(key => {
      const value = window[key as keyof Window];
      if (
        (typeof value === 'number' && key.toLowerCase().includes('count')) ||
        (typeof value === 'number' && key.toLowerCase().includes('timer')) ||
        (typeof value === 'boolean' && key.toLowerCase().includes('animated')) ||
        (typeof value === 'boolean' && key.toLowerCase().includes('active'))
      ) {
        state.globalVars[key] = value;
      }
    });
  } catch (error) {
    console.warn('[DOM-SNAP] Could not preserve global variables:', error);
  }

  // Preserve all form inputs individually
  document.querySelectorAll('input, textarea, select').forEach((input, index) => {
    const element = input as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const key = element.id || element.name || `input-${index}`;

    if (element.type === 'checkbox' || element.type === 'radio') {
      state.inputs[key] = {
        value: element.value,
        checked: (element as HTMLInputElement).checked,
      };
    } else if (element.tagName === 'SELECT') {
      const selectElement = element as HTMLSelectElement;
      state.inputs[key] = {
        value: selectElement.value,
        selectedIndex: selectElement.selectedIndex,
      };
    } else {
      state.inputs[key] = {
        value: element.value,
      };
    }
  });

  // Preserve form data as backup
  document.querySelectorAll('form').forEach((form, index) => {
    const formId = form.id || `form-${index}`;
    try {
      const formData = new FormData(form);
      const formObj: Record<string, string> = {};
      formData.forEach((value, key) => {
        formObj[key] = value.toString();
      });
      state.forms[formId] = formObj;
    } catch (error) {
      console.warn('[DOM-SNAP] Could not preserve form data:', error);
    }
  });

  return state;
};

/**
 * Updates document head with smart merging
 */
const updateDocumentHead = (newHead: HTMLHeadElement) => {
  const currentHead = document.head;

  // Keep existing <script> tags to preserve JS state
  const existingScripts = Array.from(currentHead.querySelectorAll('script[src]'));

  // Clear current head but preserve critical elements
  while (currentHead.firstChild) {
    currentHead.removeChild(currentHead.firstChild);
  }

  // Add new head content
  Array.from(newHead.children).forEach(child => {
    // Skip script tags that already exist to prevent re-execution
    if (child.tagName === 'SCRIPT') {
      const existingScript = existingScripts.find(
        script => (script as HTMLScriptElement).src === (child as HTMLScriptElement).src,
      );
      if (!existingScript) {
        currentHead.appendChild(child.cloneNode(true));
      }
    } else {
      currentHead.appendChild(child.cloneNode(true));
    }
  });

  // Re-add preserved external scripts
  existingScripts.forEach(script => currentHead.appendChild(script));
};

/**
 * Updates document body with morphing technique
 */
const updateDocumentBody = (newBody: HTMLBodyElement) => {
  const currentBody = document.body;

  // Use morphing algorithm to minimize DOM changes
  morphElement(currentBody as Element, newBody as Element);
};

/**
 * Morphs one element to match another while preserving event listeners
 */
const morphElement = (current: Element, target: Element) => {
  // If elements are identical, no change needed
  if (current.isEqualNode(target)) {
    return;
  }

  // Update attributes
  const currentAttrs = current.attributes;
  const targetAttrs = target.attributes;

  // Remove old attributes
  for (let i = currentAttrs.length - 1; i >= 0; i--) {
    const attr = currentAttrs[i];
    if (!target.hasAttribute(attr.name)) {
      current.removeAttribute(attr.name);
    }
  }

  // Add/update new attributes
  for (let i = 0; i < targetAttrs.length; i++) {
    const attr = targetAttrs[i];
    if (current.getAttribute(attr.name) !== attr.value) {
      current.setAttribute(attr.name, attr.value);
    }
  }

  // Handle child nodes
  const currentChildren = Array.from(current.childNodes);
  const targetChildren = Array.from(target.childNodes);

  const maxLength = Math.max(currentChildren.length, targetChildren.length);

  for (let i = 0; i < maxLength; i++) {
    const currentChild = currentChildren[i];
    const targetChild = targetChildren[i];

    if (!currentChild && targetChild) {
      // Add new child
      current.appendChild(targetChild.cloneNode(true));
    } else if (currentChild && !targetChild) {
      // Remove old child
      current.removeChild(currentChild);
    } else if (currentChild && targetChild) {
      if (currentChild.nodeType === Node.TEXT_NODE && targetChild.nodeType === Node.TEXT_NODE) {
        // Update text content
        if (currentChild.textContent !== targetChild.textContent) {
          currentChild.textContent = targetChild.textContent;
        }
      } else if (currentChild.nodeType === Node.ELEMENT_NODE && targetChild.nodeType === Node.ELEMENT_NODE) {
        const currentEl = currentChild as Element;
        const targetEl = targetChild as Element;

        if (currentEl.tagName === targetEl.tagName) {
          // Recursively morph matching elements
          morphElement(currentEl, targetEl);
        } else {
          // Replace with new element
          current.replaceChild(targetEl.cloneNode(true), currentEl);
        }
      } else {
        // Different node types, replace
        current.replaceChild(targetChild.cloneNode(true), currentChild);
      }
    }
  }
};

interface PreservedState {
  scroll: { x: number; y: number };
  focus: { element?: string; id?: string; name?: string };
  forms: Record<string, Record<string, string>>;
  inputs: Record<string, { value: string; checked?: boolean; selectedIndex?: number }>;
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  globalVars: Record<string, unknown>;
}

/**
 * Restores preserved state after DOM update
 */
const restorePreservedState = (state: PreservedState) => {
  // Restore global JavaScript variables
  try {
    Object.entries(state.globalVars).forEach(([key, value]) => {
      if (key in window) {
        // Use proper type assertion for window property assignment
        (window as unknown as Record<string, unknown>)[key] = value;
        console.log(`[DOM-SNAP] Restored global variable: ${key} = ${value}`);
      }
    });
  } catch (error) {
    console.warn('[DOM-SNAP] Could not restore global variables:', error);
  }

  // Restore individual form inputs
  Object.entries(state.inputs).forEach(([key, inputState]) => {
    let element = document.getElementById(key) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

    if (!element && key.startsWith('input-')) {
      // Try to find by index if no ID/name
      const index = parseInt(key.split('-')[1]);
      const allInputs = document.querySelectorAll('input, textarea, select');
      element = allInputs[index] as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    }

    if (!element) {
      // Try to find by name
      element = document.querySelector(`[name="${key}"]`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    }

    if (element) {
      try {
        if (element.type === 'checkbox' || element.type === 'radio') {
          const input = element as HTMLInputElement;
          input.value = inputState.value;
          if (inputState.checked !== undefined) {
            input.checked = inputState.checked;
          }
        } else if (element.tagName === 'SELECT') {
          const select = element as HTMLSelectElement;
          select.value = inputState.value;
          if (inputState.selectedIndex !== undefined) {
            select.selectedIndex = inputState.selectedIndex;
          }
        } else {
          element.value = inputState.value;
        }
      } catch (error) {
        console.warn(`[DOM-SNAP] Could not restore input ${key}:`, error);
      }
    }
  });

  // Restore form data as backup (for any missed inputs)
  Object.entries(state.forms).forEach(([formId, formData]) => {
    const form =
      document.getElementById(formId) ||
      document.querySelector(`form:nth-child(${parseInt(formId.split('-')[1]) + 1})`);

    if (form && typeof formData === 'object') {
      Object.entries(formData).forEach(([name, value]) => {
        const input = form.querySelector(`[name="${name}"]`) as HTMLInputElement;
        if (input && typeof value === 'string' && !input.value) {
          // Only restore if not already restored by inputs logic
          input.value = value;
        }
      });
    }
  });

  // Restore scroll position with multiple attempts
  const restoreScroll = () => {
    if (window.scrollX !== state.scroll.x || window.scrollY !== state.scroll.y) {
      window.scrollTo(state.scroll.x, state.scroll.y);
      console.log(`[DOM-SNAP] Restored scroll position: ${state.scroll.x}, ${state.scroll.y}`);
    }
  };

  // Try multiple times to ensure scroll restoration
  setTimeout(restoreScroll, 10);
  setTimeout(restoreScroll, 50);
  setTimeout(restoreScroll, 100);

  // Restore focus (best effort)
  if (state.focus.id) {
    const element = document.getElementById(state.focus.id);
    if (element && 'focus' in element) {
      setTimeout(() => {
        try {
          (element as HTMLElement).focus();
          console.log(`[DOM-SNAP] Restored focus to element: ${state.focus.id}`);
        } catch (error) {
          console.warn('[DOM-SNAP] Could not restore focus:', error);
        }
      }, 150);
    }
  }
};

/**
 * Calculates the size of DOM content in bytes
 */
const calculateDOMSize = (domContent: string): number => new Blob([domContent]).size;

/**
 * Validates DOM content for safety
 */
const validateDOMContent = (domContent: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check for basic structure
  if (!domContent.includes('<html')) {
    errors.push('Missing HTML root element');
  }

  // Check size
  const size = calculateDOMSize(domContent);
  if (size === 0) {
    errors.push('Empty DOM content');
  }

  if (size > 10 * 1024 * 1024) {
    // 10MB absolute max
    errors.push(`DOM content too large: ${size} bytes`);
  }

  // Basic XSS protection - check for dangerous patterns
  const dangerousPatterns = [/<script[^>]*>[\s\S]*?<\/script>/gi, /javascript:/gi, /data:text\/html/gi];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(domContent)) {
      errors.push('Potentially unsafe content detected');
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

interface RestoreOptions {
  timeout?: number;
  preserveState?: boolean;
  morphing?: boolean;
}

/**
 * Restores DOM from serialized content (legacy method - causes page refresh)
 */
const restoreDOM = async (domContent: string, options: { timeout?: number } = {}): Promise<void> => {
  const timeout = options.timeout || 5000;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`DOM restoration timed out after ${timeout}ms`));
    }, timeout);

    try {
      const startTime = performance.now();

      // Clear current document
      document.open();
      document.write(domContent);
      document.close();

      const endTime = performance.now();
      console.log(`[DOM-SNAP] Restoration completed in ${(endTime - startTime).toFixed(2)}ms`);

      clearTimeout(timeoutId);
      resolve();
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
};

export type { SerializationResult, SerializationOptions, RestoreOptions };
export { captureDOM, restoreDOM, restoreDOMHotReload, calculateDOMSize, validateDOMContent };
