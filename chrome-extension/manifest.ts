import { readFileSync } from 'node:fs';
import type { ManifestType } from '@extension/shared';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

/**
 * DOM Snap Chrome Extension Manifest
 *
 * This extension captures, stores, and restores DOM snapshots of web pages.
 * It requires minimal permissions for core functionality only.
 */
const manifest = {
  manifest_version: 3,
  default_locale: 'en',
  name: '__MSG_extensionName__',
  version: packageJson.version,
  description: '__MSG_extensionDescription__',

  // Permissions needed for DOM snapshot functionality
  host_permissions: ['<all_urls>'],
  permissions: ['storage', 'scripting', 'tabs', 'notifications'],

  // Background service worker for coordinating snapshot operations
  background: {
    service_worker: 'background.js',
    type: 'module',
  },

  // Popup interface for managing snapshots
  action: {
    default_popup: 'popup/index.html',
    default_icon: 'icon-34.png',
  },

  // Extension icons
  icons: {
    '128': 'icon-128.png',
    '34': 'icon-34.png',
  },

  // Content script for DOM capture and restoration
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['content/all.iife.js'],
      css: ['content.css'],
    },
  ],

  // Resources accessible to web pages
  web_accessible_resources: [
    {
      resources: ['*.js', '*.css', '*.svg', 'icon-128.png', 'icon-34.png'],
      matches: ['*://*/*'],
    },
  ],
} satisfies ManifestType;

export default manifest;
