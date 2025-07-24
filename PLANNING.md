# PLANNING.md - DOM Snapshot Extension Planning Document

## Vision Statement

### Product Vision
Create the most reliable and user-friendly Chrome extension for capturing and restoring complete DOM states, empowering developers, content creators, and researchers to work confidently with dynamic web content without fear of losing important page states.

### Core Values
- **Privacy First**: All data stored locally, no external servers
- **Performance**: Lightning-fast capture and restore operations
- **Reliability**: Accurate DOM preservation and restoration
- **Simplicity**: Intuitive interface requiring no technical expertise
- **Compatibility**: Works with modern web applications and frameworks

### Success Metrics
- 95%+ successful DOM restoration rate
- <100ms average snapshot capture time
- 4.5+ star rating on Chrome Web Store
- 10,000+ weekly active users within 6 months
- <2% crash rate across all operations

## Architecture Overview

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                        │
│                    (Extension Popup - React)                 │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                    Background Service Worker                 │
│              (Event Handling & State Management)             │
└──────┬─────────────────────┬─────────────────────┬──────────┘
       │                     │                     │
┌──────┴──────┐      ┌──────┴──────┐      ┌──────┴──────┐
│   Content    │      │   Storage    │      │ Chrome APIs  │
│   Scripts    │      │   Manager    │      │  (tabs,      │
│(DOM Access)  │      │(chrome.storage)│     │notifications)│
└──────────────┘      └──────────────┘      └──────────────┘
```

### Component Architecture

#### 1. Extension Popup (UI Layer)
- **Technology**: React 18 with TypeScript
- **State Management**: React Context API for simple state
- **Styling**: Tailwind CSS for rapid UI development
- **Components**:
  ```
  App.tsx
  ├── Header.tsx (current tab info, snapshot count)
  ├── SnapshotButton.tsx (capture functionality)
  ├── SnapshotList.tsx
  │   └── SnapshotItem.tsx (individual snapshot)
  ├── StorageIndicator.tsx (usage visualization)
  └── Settings.tsx (future: preferences)
  
  UI Components (shadcn/ui):
  ├── components/ui/button.tsx
  ├── components/ui/card.tsx
  ├── components/ui/dialog.tsx
  ├── components/ui/dropdown-menu.tsx
  ├── components/ui/toast.tsx
  ├── components/ui/alert.tsx
  ├── components/ui/badge.tsx
  ├── components/ui/progress.tsx
  └── components/ui/scroll-area.tsx
  ```

#### 2. Background Service Worker
- **Purpose**: Central communication hub
- **Responsibilities**:
  - Message routing between popup and content scripts
  - Storage operations coordination
  - Tab state tracking
  - Notification management
- **Key Modules**:
  - `MessageHandler`: Routes messages between components
  - `StorageService`: Manages chrome.storage operations
  - `TabTracker`: Monitors active tab changes

#### 3. Content Scripts
- **Purpose**: DOM access and manipulation
- **Injection**: Dynamic, on-demand injection
- **Modules**:
  - `DOMSerializer`: Captures complete DOM state
  - `DOMRestorer`: Rebuilds DOM from snapshots
  - `DOMAnalyzer`: Gathers metadata about page

#### 4. Storage Layer
- **Structure**:
  ```typescript
  interface StorageSchema {
    snapshots: {
      [normalizedUrl: string]: Snapshot[];
    };
    settings: UserSettings;
    metadata: {
      totalSize: number;
      snapshotCount: number;
      lastCleanup: number;
    };
  }
  ```

### Data Flow

#### Snapshot Capture Flow
```
1. User clicks "Take Snapshot" → Popup
2. Popup → Background Worker (capture request)
3. Background → Content Script (inject & execute)
4. Content Script → Serializes DOM
5. Content Script → Background (DOM data)
6. Background → Storage (save snapshot)
7. Background → Popup (success/failure)
8. Popup → Updates UI
```

#### DOM Restoration Flow
```
1. User selects snapshot → Popup
2. Popup → Background (restore request)
3. Background → Storage (retrieve snapshot)
4. Background → Content Script (inject & send data)
5. Content Script → Restores DOM
6. Content Script → Background (result)
7. Background → Popup (success/failure)
8. Popup → Shows notification
```

## Tech Stack

### Core Technologies

#### Frontend (Popup)
- **React 18.2.0**: Modern UI library with hooks
- **TypeScript 5.0+**: Type safety and better DX
- **Tailwind CSS 3.4+**: Utility-first styling
- **shadcn/ui**: Modern component library with blue theme
- **Vite 5.0+**: Fast build tool and dev server
- **React Query**: Data fetching and caching (if needed)

#### Extension Core
- **Chrome Extension Manifest V3**: Latest extension platform
- **TypeScript**: Across all modules for consistency
- **Web APIs**:
  - DOM API for serialization
  - Chrome Storage API
  - Chrome Tabs API
  - Chrome Notifications API

#### Build & Development
- **Vite**: Primary build tool
- **ESBuild**: Fast TypeScript compilation
- **PostCSS**: CSS processing with Tailwind
- **Chrome Extension CLI**: Development utilities

### Dependencies

#### Production Dependencies
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "clsx": "^2.1.0",
  "nanoid": "^5.0.0",
  "date-fns": "^3.0.0",
  "class-variance-authority": "^0.7.0",
  "lucide-react": "^0.309.0",
  "tailwind-merge": "^2.2.0",
  "tailwindcss-animate": "^1.0.7",
  "@radix-ui/react-dialog": "^1.0.5",
  "@radix-ui/react-dropdown-menu": "^2.0.6",
  "@radix-ui/react-slot": "^1.0.2",
  "@radix-ui/react-toast": "^1.1.5"
}
```

#### Development Dependencies
```json
{
  "@types/chrome": "^0.0.260",
  "@types/react": "^18.2.0",
  "@types/react-dom": "^18.2.0",
  "@typescript-eslint/eslint-plugin": "^6.0.0",
  "@typescript-eslint/parser": "^6.0.0",
  "@vitejs/plugin-react": "^4.2.0",
  "autoprefixer": "^10.4.0",
  "eslint": "^8.56.0",
  "eslint-plugin-react": "^7.33.0",
  "eslint-plugin-react-hooks": "^4.6.0",
  "postcss": "^8.4.0",
  "prettier": "^3.2.0",
  "tailwindcss": "^3.4.0",
  "typescript": "^5.3.0",
  "vite": "^5.0.0"
}
```

### Architecture Decisions

#### Why shadcn/ui?
- Modern, accessible components
- Full TypeScript support
- Highly customizable with Tailwind
- Copy-paste component model (no lock-in)
- Blue theme aligns with productivity tools
- Radix UI primitives for accessibility

#### Why React for Popup?
- Component reusability
- Excellent TypeScript support
- Rich ecosystem
- Familiar to most developers
- Good performance for small UIs

#### Why Vite?
- Lightning-fast HMR
- Native ES modules
- Excellent TypeScript support
- Simple configuration
- Built-in optimizations

#### Why Local Storage Only?
- Privacy protection
- No server costs
- Instant access
- No network latency
- GDPR compliance

#### Why TypeScript Everywhere?
- Type safety across modules
- Better refactoring
- Self-documenting code
- Catch errors early
- Improved IDE support

## Required Tools & Setup

### Development Environment

#### Essential Tools
1. **Node.js** (v18.0.0 or higher)
   - Required for build tools
   - Install via [nodejs.org](https://nodejs.org/) or nvm

2. **pnpm** (v8.0.0 or higher)
   - Efficient package manager
   - Install: `npm install -g pnpm`

3. **Google Chrome** (Latest stable)
   - Primary testing browser
   - Enable Developer mode in extensions

4. **Visual Studio Code**
   - Recommended IDE
   - Install extensions:
     - Chrome Extension Debugger
     - ESLint
     - Prettier
     - Tailwind CSS IntelliSense
     - TypeScript Vue Plugin

#### VS Code Extensions
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "naumovs.color-highlight",
    "christian-kohler.path-intellisense",
    "formulahendry.auto-rename-tag",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

### Development Tools Setup

#### 1. Chrome Extension Development
```bash
# Install Chrome Extension CLI (optional but helpful)
npm install -g chrome-extension-cli

# Or use the initialized template from:
# https://github.com/basicsharp/chrome-dom-snap
```

#### 2. Testing Tools
- **Chrome DevTools**: Built-in debugging
- **Extension Reloader**: Auto-reload during development
- **React DevTools**: React component inspection

#### 3. Code Quality Tools
```bash
# ESLint for code linting
pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin

# Prettier for code formatting
pnpm add -D prettier eslint-config-prettier eslint-plugin-prettier

# Husky for pre-commit hooks
pnpm add -D husky lint-staged
```

#### 4. Build Tools Configuration

##### Vite Configuration
```javascript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  }
})
```

##### Tailwind Configuration with Blue Theme
```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

##### Global CSS with Blue Theme
```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    
    /* Blue theme colors */
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    
    --radius: 0.5rem;
  }
  
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    
    /* Blue theme colors for dark mode */
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

### Project Setup Checklist

- [ ] Clone chrome-dom-snap template
- [ ] Install Node.js 18+
- [ ] Install pnpm globally
- [ ] Run `pnpm install`
- [ ] Configure VS Code with recommended extensions
- [ ] Set up ESLint and Prettier
- [ ] Configure Tailwind CSS
- [ ] Install and configure shadcn/ui
- [ ] Set up TypeScript paths
- [ ] Create initial folder structure
- [ ] Configure manifest.json for development
- [ ] Load unpacked extension in Chrome
- [ ] Verify hot reload works
- [ ] Set up git hooks with Husky

### shadcn/ui Setup

```bash
# Initialize shadcn/ui (choose blue theme when prompted)
pnpm dlx shadcn-ui@latest init

# Install required components
pnpm dlx shadcn-ui@latest add button
pnpm dlx shadcn-ui@latest add card
pnpm dlx shadcn-ui@latest add dialog
pnpm dlx shadcn-ui@latest add dropdown-menu
pnpm dlx shadcn-ui@latest add toast
pnpm dlx shadcn-ui@latest add alert
pnpm dlx shadcn-ui@latest add badge
pnpm dlx shadcn-ui@latest add progress
pnpm dlx shadcn-ui@latest add scroll-area

# Configure components.json
{
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "blue",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

### Debugging Setup

#### Chrome Extension Debugging
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select build directory
4. Right-click extension icon → "Inspect popup"
5. Check service worker logs in extension details

#### Content Script Debugging
```javascript
// Add to content script for debugging
console.log('[DOM-SNAP]', 'Content script loaded');

// Use Chrome DevTools Sources tab
// Set breakpoints in content scripts
```

## Performance Targets

### Metrics to Monitor
- **Snapshot Capture**: <100ms for average webpage
- **DOM Restoration**: <200ms for complete restore
- **Storage Operations**: <50ms for read/write
- **Popup Load Time**: <150ms to interactive
- **Memory Usage**: <50MB during operations

### Optimization Strategies
1. **Lazy Loading**: Load snapshots progressively
2. **Compression**: Use LZ-string for large DOMs
3. **Debouncing**: Prevent rapid operations
4. **Virtual Scrolling**: For large snapshot lists
5. **Worker Threads**: Offload heavy serialization

## Security Considerations

### Content Security Policy
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'none';"
  }
}
```

### Data Sanitization
- Sanitize restored DOM content
- Validate snapshot data structure
- Escape user-provided names
- Prevent XSS in restored content

## Deployment Strategy

### Build Pipeline
1. **Development**: Hot reload with Vite
2. **Testing**: Unit + Integration tests
3. **Staging**: Test with real websites
4. **Production**: Minified and optimized build
5. **Release**: Chrome Web Store submission

### Version Management
- Follow Semantic Versioning (SemVer)
- Maintain CHANGELOG.md
- Tag releases in Git
- Automated builds with GitHub Actions

## Future Architecture Considerations

### Potential Enhancements
1. **WebAssembly**: For compression algorithms
2. **IndexedDB**: For larger storage needs
3. **Web Workers**: For background processing
4. **Incremental Snapshots**: Store only diffs
5. **Cloud Sync**: Optional backup service

### Scalability Plan
- Monitor storage usage patterns
- Implement progressive enhancement
- Plan for millions of snapshots
- Consider enterprise features
- Multi-browser support roadmap

## References

- [Chrome Extension Manifest V3 Documentation](https://developer.chrome.com/docs/extensions/mv3/)
- [React 18 Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)