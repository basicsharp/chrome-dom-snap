# 📸 DOM Snap - DOM Snapshot Chrome Extension

![](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![](https://img.shields.io/badge/Typescript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![](https://badges.aleen42.com/src/vitejs.svg)
![](https://img.shields.io/badge/Chrome-Extension-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![](https://img.shields.io/badge/Manifest-V3-FF5722?style=flat-square)

> A privacy-focused Chrome extension that allows users to capture, store, and restore DOM states of web pages locally, featuring advanced hot reload restoration technology.

## 🚀 Features

### Core Functionality
- **📸 DOM Snapshot Capture**: Capture complete DOM structure of any webpage
- **💾 Local Storage**: All data stored locally using chrome.storage.local (no cloud sync)
- **📋 Snapshot Management**: List, rename, copy, restore, and delete snapshots per URL
- **🔥 Hot Reload Restoration**: State-preserving DOM restoration without page refresh
- **🧹 Smart Cleanup**: Automatic storage management with quota monitoring
- **🛡️ Privacy First**: No external communication or data collection

### Technical Features
- **⚡ Fast Serialization**: Optimized DOM capture with size limits and timeouts
- **🎯 URL Normalization**: Groups snapshots by normalized URL (strips hash fragments)
- **📊 Storage Monitoring**: Real-time storage usage with visual progress indicators
- **🔒 Type Safety**: Full TypeScript implementation with strict type checking
- **🎨 Modern UI**: React-based popup with responsive design and theme support
- **♿ Accessibility**: WCAG compliant with jsx-a11y validation
- **🔄 State Preservation**: Maintains JavaScript variables, form data, and scroll positions

## 📦 Installation

### From Release (Recommended)

1. **Download the release**
   - Go to the [Releases](https://github.com/basicsharp/chrome-dom-snap/releases) page
   - Download the latest `chrome-dom-snap-vX.X.X.zip` file

2. **Install in Chrome**
   - Open `chrome://extensions`
   - Enable "Developer mode" (top right toggle)
   - Drag and drop the downloaded zip file directly into the extensions page
   - OR: Unzip the file and click "Load unpacked" to select the extracted directory

### From Source

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/chrome-dom-snap.git
   cd chrome-dom-snap
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Build the extension**
   ```bash
   pnpm build
   ```

4. **Load in Chrome**
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` directory

### Development Mode

For development with hot reload:
```bash
pnpm dev
```

## 🎯 How to Use

### Capturing Snapshots
1. Navigate to any webpage
2. Click the DOM Snap extension icon
3. Click "Capture Current DOM" button
4. Snapshot is saved locally with timestamp and metadata

### Managing Snapshots
- **View Snapshots**: See all snapshots for the current page URL
- **Rename Snapshots**: Click the edit icon (✏️) to rename any snapshot
- **Copy to Clipboard**: Use the clipboard icon (📋) to copy snapshot HTML
- **Restore DOM**: Click "Restore" to replace current DOM with snapshot (supports hot reload)
- **Delete Snapshot**: Remove individual snapshots
- **Clear All**: Remove all snapshots for current URL or all pages
- **Storage Monitor**: View real-time storage usage

### Hot Reload Restoration
The extension features advanced state-preserving restoration that maintains:
- **JavaScript Variables**: Counters, timers, and application state
- **Form Data**: Input values, checkboxes, radio buttons, and selections
- **UI State**: Scroll positions and focus states
- **Event Listeners**: Preserves existing event handlers
- **Dynamic Content**: Maintains JavaScript-generated content

### Storage Management
- **Automatic Cleanup**: Triggers at 80% storage capacity
- **Size Limits**: Individual snapshots limited to 5MB
- **Total Capacity**: Uses chrome.storage.local (10MB limit)
- **Date Format**: Consistent yyyy-mm-dd format for all timestamps

## 🏗️ Architecture

### Project Structure
```
chrome-dom-snap/
├── chrome-extension/           # Extension configuration
│   ├── manifest.ts            # Manifest V3 configuration
│   └── src/background/        # Service worker
├── pages/
│   ├── popup/                 # Extension popup UI
│   └── content/               # Content scripts
├── packages/
│   ├── shared/                # Shared utilities
│   │   ├── dom-serializer.ts  # DOM capture/restore engine
│   │   ├── storage-service.ts # Storage management
│   │   ├── messages.ts        # Type-safe messaging
│   │   └── url-utils.ts       # URL normalization
│   ├── ui/                    # UI components
│   └── ...                    # Other packages
└── dist/                      # Built extension
```

### Core Components

#### DOM Serialization Engine
- **Recursive Traversal**: Handles all node types (elements, text, comments, doctype)
- **Attribute Preservation**: Captures all attributes including data-* and aria-*
- **Form State**: Preserves input values and form states
- **Namespace Support**: Handles SVG and MathML correctly
- **Size Validation**: Prevents oversized snapshots
- **Hot Reload Support**: State-preserving DOM restoration

#### Storage System
- **CRUD Operations**: Complete snapshot lifecycle management
- **URL Grouping**: Organizes snapshots by normalized URLs
- **Metadata Tracking**: Stores size, timestamp, and page information
- **Quota Management**: Automatic cleanup and usage monitoring
- **Rename Support**: Custom snapshot naming with validation

#### Messaging System
- **Type Safety**: Full TypeScript message definitions
- **Request/Response**: Correlation with unique IDs
- **Error Handling**: Comprehensive error management
- **Timeout Protection**: Prevents hanging operations
- **Clipboard Integration**: Safe content copying with metadata

## 🛠️ Development

### Prerequisites
- Node.js >= 18
- pnpm package manager
- Chrome browser for testing

### Development Commands
```bash
# Install dependencies
pnpm install

# Development with hot reload
pnpm dev

# Build for production
pnpm build

# Run linting
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Type checking
pnpm type-check
```

### Code Quality
- **ESLint**: TypeScript, React, and accessibility rules
- **Prettier**: Automatic code formatting
- **TypeScript**: Strict type checking
- **GitHub Actions**: Automated formatting validation

### Testing
```bash
# End-to-end testing
pnpm e2e

# Manual testing checklist:
# - Extension loads without errors
# - Popup displays correctly (480x500-600px)
# - DOM capture works on various sites
# - Restoration preserves functionality
# - Storage cleanup triggers properly
```

## 🔧 Configuration

### Manifest V3 Permissions
```json
{
  "permissions": ["storage", "activeTab", "notifications"],
  "host_permissions": ["<all_urls>"]
}
```

### Storage Schema
```typescript
{
  "snapshots": {
    "https://example.com/page": [
      {
        "id": "snap_1234567890_abcdef",
        "timestamp": 1234567890000,
        "name": "Manual snapshot",
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

## 🚨 Limitations

### What DOM Snap Does NOT Do
- **No Cloud Sync**: All data stays local for privacy
- **No Screenshots**: Only captures DOM structure, not visual appearance
- **No Cross-Origin**: Limited by Chrome extension security policies

### Known Limitations
- **Storage Quota**: 10MB limit via chrome.storage.local
- **Large DOMs**: 5MB per snapshot limit for performance
- **Dynamic Content**: May not capture dynamically loaded content
- **SPA Compatibility**: Hash-based routing may group incorrectly

### Hot Reload Limitations
- **External Scripts**: Cannot preserve external script state
- **WebSocket Connections**: May need reconnection after restore
- **Third-party Widgets**: May require refresh for full functionality
- **Browser APIs**: Some browser API states may not be preserved

## 📦 Release Information

### Version Format
Releases follow semantic versioning (MAJOR.MINOR.PATCH):
- MAJOR: Breaking changes
- MINOR: New features
- PATCH: Bug fixes and minor improvements

### Release Files
Each release includes:
- `chrome-dom-snap-vX.X.X.zip`: Production build ready for installation
- Source code (zip/tar.gz): Full source code for the release
- Release notes: Detailed changelog and upgrade instructions

### Installation Methods
- **Direct Installation**: Drag & drop the .zip file into Chrome extensions page
- **Manual Installation**: Extract zip and use "Load unpacked"
- **Development**: Build from source for latest features

### Verifying Releases
1. Check the release hash (provided in release notes)
2. Verify the extension ID after installation
3. Ensure the version number matches the release

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow code style guidelines (ESLint + Prettier)
4. Ensure all tests pass
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Style
- **TypeScript**: Strict typing required
- **ESLint**: Must pass all rules
- **Prettier**: Automatic formatting
- **Accessibility**: jsx-a11y compliance

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on top of the excellent [Chrome Extension Boilerplate](https://github.com/Jonghakseo/chrome-extension-boilerplate-react-vite)
- Uses modern web technologies for optimal performance
- Designed with privacy and user experience as top priorities

---

Made by [Porramate Lim](https://github.com/basicsharp)
