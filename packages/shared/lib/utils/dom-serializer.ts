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
 * Restores DOM from serialized content
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

export type { SerializationResult, SerializationOptions };
export { captureDOM, restoreDOM, calculateDOMSize, validateDOMContent };
