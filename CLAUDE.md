# CLAUDE.md - "DOM Snap" DOM Snapshot Chrome Extension Project Guide

## Project Overview

You are working on a Google Chrome Extension that allows users to capture, store, and restore DOM states of web pages. This extension stores snapshots locally and provides an interface to manage them.

## Core Functionality

### What This Extension Does
1. **Captures DOM snapshots** of the current active tab
2. **Stores snapshots locally** using chrome.storage.local
3. **Lists all snapshots** for the current tab (identified by URL without hash)
4. **Restores DOM state** from any selected snapshot
5. **Manages storage** by allowing users to clear snapshots

### What This Extension Does NOT Do
- Does not sync data to cloud/external servers
- Does not capture screenshots (only DOM structure)
- Does not preserve JavaScript application state
- Does not work with hash-based routing (strips hash from URLs)

## Technical Architecture

### Project Structure
```
dom-snapshot-extension/
├── manifest.json          # Manifest V3 configuration
├── background.js          # Service worker for extension logic
├── content-script.js      # DOM manipulation and serialization
├── popup/
│   ├── popup.html        # Extension popup UI
│   ├── popup.js          # Popup logic and event handlers
│   └── popup.css         # Popup styling
├── utils/
│   ├── domSerializer.js  # DOM serialization utilities
│   ├── storage.js        # Storage management utilities
│   └── urlUtils.js       # URL normalization utilities
└── icons/                # Extension icons (16, 48, 128px)
```

### Key Technical Decisions

1. **Manifest V3**: Use latest Chrome Extension manifest format
2. **Storage**: Use chrome.storage.local (10MB limit)
3. **DOM Serialization**: Custom serializer to handle all node types
4. **URL Normalization**: Strip hash fragments for consistent grouping
5. **No External Dependencies**: Pure JavaScript, no frameworks in MVP

### Storage Schema
```javascript
{
  "snapshots": {
    "https://example.com/page": [
      {
        "id": "snap_1234567890_abcdef",
        "timestamp": 1234567890000,
        "name": "Before changes",
        "domContent": "<html>...</html>",
        "metadata": {
          "size": 45678,
          "pageTitle": "Example Page",
          "viewport": { "width": 1920, "height": 1080 }
        }
      }
    ]
  }
}
```

## Implementation Guidelines

### When Implementing Features

#### Snapshot Capture
```javascript
// Key steps for DOM capture:
1. Get current tab URL and normalize (remove hash)
2. Serialize entire document.documentElement
3. Calculate size and gather metadata
4. Generate unique ID: `snap_${Date.now()}_${Math.random().toString(36)}`
5. Store in chrome.storage.local under normalized URL key
6. Show success notification
```

#### DOM Serialization Considerations
- Capture all attributes including data-* and aria-*
- Preserve inline styles
- Handle SVG and MathML namespaces
- Escape special characters properly
- Consider compression for large DOMs

#### DOM Restoration
```javascript
// Key steps for restoration:
1. Retrieve snapshot data from storage
2. Show confirmation dialog (destructive action)
3. Clear current document
4. Parse and inject snapshot DOM
5. Handle potential errors gracefully
6. Show success/failure notification
```

### API Usage

#### Required Chrome APIs
```javascript
// manifest.json permissions needed:
{
  "permissions": ["storage", "activeTab", "notifications"],
  "host_permissions": ["<all_urls>"]
}

// Key API methods:
chrome.storage.local.get()
chrome.storage.local.set()
chrome.storage.local.remove()
chrome.storage.local.getBytesInUse()
chrome.tabs.query()
chrome.tabs.sendMessage()
chrome.runtime.sendMessage()
chrome.notifications.create()
```

### Error Handling

Always handle these scenarios:
1. **Storage quota exceeded**: Provide clear message and cleanup options
2. **DOM too large**: Set reasonable size limits (e.g., 5MB)
3. **Restoration failures**: Graceful degradation with error messages
4. **Invalid snapshot data**: Validate before restoration
5. **Cross-origin issues**: Document limitations

### Performance Considerations

1. **Async Operations**: All storage operations must be async
2. **Debouncing**: Prevent rapid successive snapshots
3. **Lazy Loading**: Load snapshot list progressively if many items
4. **Compression**: Consider LZ-string for large DOMs
5. **Memory Management**: Clean up large objects after use

## Code Style Guidelines

### JavaScript Conventions
```javascript
// Use modern ES6+ features
const captureSnapshot = async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = normalizeUrl(tab.url);
    // ... implementation
  } catch (error) {
    console.error('Snapshot capture failed:', error);
    showNotification('error', 'Failed to capture snapshot');
  }
};

// Consistent error handling
const handleStorageError = (error) => {
  if (error.message.includes('QUOTA_BYTES_PER_ITEM')) {
    return 'Snapshot too large. Please try a smaller page.';
  }
  return 'Storage error occurred. Please try again.';
};
```

### Naming Conventions
- Functions: `camelCase` (e.g., `captureSnapshot`, `restoreDom`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_SNAPSHOT_SIZE`)
- Files: `kebab-case` or `camelCase` (e.g., `dom-serializer.js`)
- CSS classes: `kebab-case` (e.g., `snapshot-item`)

## Testing Approach

### Test Scenarios to Cover
1. **Basic Flow**: Capture → List → Restore → Clear
2. **Edge Cases**:
   - Very large DOMs (>1MB)
   - Pages with iframes
   - Single Page Applications
   - Pages with dynamic content
3. **Storage Limits**: Behavior at 80%, 90%, 100% capacity
4. **URL Variations**: With/without www, trailing slashes, query params

### Manual Testing Checklist
- [ ] Extension installs without errors
- [ ] Popup opens and displays correctly
- [ ] Snapshot captures successfully
- [ ] Snapshots list filters by current URL
- [ ] DOM restoration works correctly
- [ ] Clear functionality works
- [ ] Notifications appear appropriately
- [ ] Storage limits are respected

## Common Pitfalls to Avoid

1. **Don't assume DOM structure**: Always validate before restoration
2. **Don't store sensitive data**: No passwords, tokens, or PII
3. **Don't block the main thread**: Use async operations
4. **Don't ignore edge cases**: Handle empty pages, errors gracefully
5. **Don't overcomplicate**: Start simple, iterate based on feedback

## Development Workflow

### Setting Up Development
```bash
1. Create extension directory structure
2. Implement manifest.json with required permissions
3. Create basic popup.html interface
4. Implement core capture/restore logic
5. Test in Chrome with developer mode enabled
6. Iterate based on testing results
```

### Debugging Tips
- Use Chrome DevTools for popup debugging
- Check service worker logs in chrome://extensions
- Use console.log liberally during development
- Test with various websites (static, SPA, heavy JS)
- Monitor storage usage with chrome.storage.local.getBytesInUse()

## Future Enhancement Notes

When implementing v2 features, consider:
1. **Incremental Snapshots**: Store only diffs between snapshots
2. **Cloud Sync**: Optional user-authenticated sync
3. **Export/Import**: JSON or custom format
4. **Visual Previews**: Canvas-based thumbnails
5. **Selective Capture**: Allow DOM subtree selection

## Quick Reference

### Essential Functions to Implement
```javascript
// Core functions needed:
normalizeUrl(url)           // Remove hash, standardize format
captureSnapshot()           // Serialize and store current DOM
getSnapshotsForUrl(url)     // Retrieve filtered snapshots
restoreSnapshot(snapshotId) // Replace current DOM
clearSnapshotsForUrl(url)   // Remove all snapshots for URL
showNotification(type, message) // User feedback

// Utility functions:
generateSnapshotId()        // Create unique identifier
calculateDomSize(domString) // Get size in bytes
compressData(data)          // Optional compression
decompressData(data)        // Optional decompression
```

### Chrome Extension Lifecycle
1. **Installation**: Set up initial storage structure
2. **Icon Click**: Show popup with current tab context
3. **Content Script**: Injected on-demand for DOM operations
4. **Background**: Manages storage and coordinates communication
5. **Uninstall**: Chrome automatically cleans up storage

## Remember

- Always read PLANNING.md at the start of every new conversation, check TASKS.md before starting your work, mark completed tasks to TASKS.md immediately, and add newly discovered tasks to TASKS.md when found.
- This is a **privacy-focused** tool - no external communication
- **User experience** is paramount - keep it simple and fast
- **Storage is limited** - implement smart cleanup strategies
- **DOM restoration** is powerful but can break page functionality
- **Test thoroughly** - each website is unique

When in doubt, refer back to the PRD for business requirements and use cases. Good luck with the implementation!

---

## Development Session Summary

### Session Date: January 24, 2025

#### 🎯 **What Was Accomplished**
This session successfully transformed the chrome-dom-snap project from a boilerplate template into a **fully functional DOM snapshot Chrome extension**. All core functionality has been implemented and tested.

#### 🔧 **Core Implementation Completed**

1. **DOM Serialization Engine** (`packages/shared/lib/utils/dom-serializer.ts`)
   - Complete recursive DOM tree traversal with all node types (elements, text, comments, doctype)
   - Preserves attributes, inline styles, and form states
   - Handles special elements (SVG, canvas) and namespaces
   - Size calculation, validation, and timeout protection
   - Configurable options (include styles/scripts, max size, timeout)

2. **Storage Management System** (`packages/shared/lib/utils/storage-service.ts`)
   - Full CRUD operations for snapshots with chrome.storage.local
   - URL normalization (removes hash fragments for consistent grouping)
   - Unique ID generation and metadata tracking
   - Storage quota management with automatic cleanup at 80% capacity
   - Real-time storage usage monitoring and statistics

3. **Background Service Worker** (`chrome-extension/src/background/index.ts`)
   - Complete message routing between popup and content scripts
   - Tab management with active tab tracking
   - Dynamic content script injection with retry logic
   - Storage operation coordination and error handling
   - Chrome notifications for user feedback

4. **Content Scripts** (`pages/content/src/matches/all/index.ts`)
   - DOM capture functionality with the serialization engine
   - DOM restoration with user confirmation dialogs
   - Cross-site compatibility and graceful error handling
   - Development mode indicator for debugging

5. **Modern Popup Interface** (`pages/popup/src/Popup.tsx`)
   - Complete replacement of template with DOM snapshot UI
   - Real-time storage usage indicator with color-coded progress bar
   - Snapshot list with individual restore/delete actions
   - Current tab information display with favicon
   - Loading states, error handling, and responsive design
   - Light/dark theme support integration

6. **Type-Safe Messaging System** (`packages/shared/lib/utils/messages.ts`)
   - Complete message type definitions for all extension communication
   - Request/response correlation with unique IDs
   - Timeout handling and retry logic
   - Helper functions for sending messages

7. **URL Utilities** (`packages/shared/lib/utils/url-utils.ts`)
   - URL normalization and validation
   - Display formatting for UI purposes
   - Domain extraction and security checks

#### 🚀 **Key Features Implemented**

- **📸 One-Click Capture**: Instant DOM snapshot with metadata
- **📋 Snapshot Management**: List, restore, delete, and clear operations  
- **💾 Smart Storage**: Automatic cleanup with 8MB limit and quota monitoring
- **🛡️ Safety Features**: Validation, confirmation dialogs, and XSS protection
- **📊 Storage Visualization**: Real-time usage tracking with progress indicators
- **🎨 Modern UI**: Responsive design with proper theming support
- **⚡ High Performance**: Optimized serialization with size limits and timeouts

#### 🐛 **Issues Resolved**

1. **Build System Conflicts**: Fixed React 19 compatibility issues with node polyfills
2. **TypeScript Errors**: Resolved module export conflicts and type annotations
3. **Manifest Configuration**: Cleaned up manifest to remove unused features (side panel, devtools, etc.)
4. **Popup Layout Issues**: 
   - Fixed width cropping (increased from 384px → 480px)
   - Improved button layout (vertical stacking instead of horizontal)
   - Added proper scrolling and flex layout
   - Enhanced button visibility with full text labels

#### 📁 **Project Structure**

```
packages/shared/lib/utils/
├── dom-serializer.ts     # Core DOM capture/restore logic
├── storage-service.ts    # Chrome storage management
├── messages.ts          # Type-safe message system
├── url-utils.ts         # URL normalization utilities
└── index.ts            # Exports for all utilities

chrome-extension/
├── src/background/index.ts    # Service worker implementation
├── manifest.ts               # Clean manifest configuration
└── vite.config.mts          # Build configuration

pages/
├── popup/src/Popup.tsx      # Main UI implementation
├── popup/src/Popup.css      # Popup styling
└── content/src/matches/all/index.ts  # Content script

dist/                        # Built extension ready for Chrome
├── manifest.json           # Generated manifest
├── background.js          # Compiled service worker
├── popup/                 # Popup assets
├── content/              # Content scripts
└── _locales/            # Internationalization
```

#### 🏗️ **Build System**

- **Fixed React 19 Compatibility**: Disabled problematic node polyfills
- **Monorepo Architecture**: Successfully building individual packages
- **TypeScript Compilation**: All modules compile without errors
- **Vite Configuration**: Optimized for Chrome extension development

#### ✅ **Testing Status**

- **Extension Loading**: Successfully loads in Chrome without errors
- **Popup Interface**: Fully functional with proper dimensions (480x500-600px)
- **Core Functionality**: Capture, list, restore, and delete operations working
- **Storage Management**: Real-time usage tracking and automatic cleanup
- **Cross-Site Compatibility**: Content script injection working on http/https sites

#### 🎯 **Current State**

The DOM Snap extension is **production-ready** with all core functionality implemented. Users can:

1. Load the extension from `/Users/porramatelim/workspace/chrome-dom-snap/dist`
2. Capture DOM snapshots of any webpage
3. View all snapshots for the current page
4. Restore any previous snapshot
5. Delete individual snapshots or clear all
6. Monitor storage usage in real-time

#### 📝 **Next Steps for Future Development**

1. **Enhanced Features**: Incremental snapshots, export/import, cloud sync
2. **Performance Optimization**: WebAssembly compression, diff-based storage
3. **Advanced UI**: Search/filter, snapshot previews, batch operations
4. **Enterprise Features**: Team sharing, analytics, compliance tools

#### 💡 **Key Technical Decisions**

- **Local Storage Only**: Privacy-focused approach using chrome.storage.local
- **TypeScript Throughout**: Type safety across all modules and communication
- **Modern React**: Hooks-based architecture with proper state management
- **Manifest V3**: Latest Chrome extension platform with service workers
- **Monorepo Structure**: Maintainable architecture with shared utilities

This implementation represents a complete, production-ready DOM snapshot solution that prioritizes user privacy, performance, and reliability.