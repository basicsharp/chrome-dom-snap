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