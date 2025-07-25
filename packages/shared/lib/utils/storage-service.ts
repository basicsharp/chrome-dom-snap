/**
 * Storage Service for DOM Snapshots
 * Handles all storage operations with chrome.storage.local
 */

import { normalizeUrl } from './url-utils.js';

interface Snapshot {
  id: string;
  timestamp: number;
  name: string;
  domContent: string;
  metadata: {
    size: number;
    pageTitle: string;
    viewport: {
      width: number;
      height: number;
    };
    url: string;
  };
}

interface StorageSchema {
  snapshots: {
    [normalizedUrl: string]: Snapshot[];
  };
  settings: {
    maxSnapshotsPerUrl: number;
    autoCleanup: boolean;
    maxTotalSize: number;
  };
  metadata: {
    totalSize: number;
    snapshotCount: number;
    lastCleanup: number;
  };
}

const DEFAULT_SETTINGS: StorageSchema['settings'] = {
  maxSnapshotsPerUrl: 50,
  autoCleanup: true,
  maxTotalSize: 8 * 1024 * 1024, // 8MB (leaving buffer for chrome.storage.local 10MB limit)
};

const DEFAULT_METADATA: StorageSchema['metadata'] = {
  totalSize: 0,
  snapshotCount: 0,
  lastCleanup: 0,
};

/**
 * Generates unique snapshot ID
 */
const generateSnapshotId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  return `snap_${timestamp}_${random}`;
};

/**
 * Gets all snapshots for a specific URL
 */
const getSnapshotsForUrl = async (url: string): Promise<Snapshot[]> => {
  const normalizedUrl = normalizeUrl(url);

  try {
    const result = await chrome.storage.local.get('snapshots');
    const snapshots = result.snapshots || {};
    return snapshots[normalizedUrl] || [];
  } catch (error) {
    console.error('[DOM-SNAP] Error getting snapshots:', error);
    return [];
  }
};

/**
 * Gets a specific snapshot by ID
 */
const getSnapshotById = async (snapshotId: string): Promise<Snapshot | null> => {
  try {
    const result = await chrome.storage.local.get('snapshots');
    const snapshots = result.snapshots || {};

    for (const urlSnapshots of Object.values(snapshots)) {
      const snapshot = (urlSnapshots as Snapshot[]).find(s => s.id === snapshotId);
      if (snapshot) {
        return snapshot;
      }
    }

    return null;
  } catch (error) {
    console.error('[DOM-SNAP] Error getting snapshot by ID:', error);
    return null;
  }
};

/**
 * Saves a new snapshot
 */
const saveSnapshot = async (url: string, snapshot: Omit<Snapshot, 'id'>): Promise<string> => {
  const normalizedUrl = normalizeUrl(url);
  const snapshotId = generateSnapshotId();
  const fullSnapshot: Snapshot = {
    id: snapshotId,
    ...snapshot,
  };

  try {
    // Get current data
    const result = await chrome.storage.local.get(['snapshots', 'metadata', 'settings']);
    const snapshots = result.snapshots || {};
    const metadata = { ...DEFAULT_METADATA, ...result.metadata };
    const settings = { ...DEFAULT_SETTINGS, ...result.settings };

    // Get current snapshots for URL
    const urlSnapshots = snapshots[normalizedUrl] || [];

    // Check if we need to remove old snapshots
    if (urlSnapshots.length >= settings.maxSnapshotsPerUrl) {
      // Remove oldest snapshot
      const oldestSnapshot = urlSnapshots.shift();
      if (oldestSnapshot) {
        metadata.totalSize -= oldestSnapshot.metadata.size;
        metadata.snapshotCount -= 1;
      }
    }

    // Add new snapshot
    urlSnapshots.push(fullSnapshot);
    snapshots[normalizedUrl] = urlSnapshots;

    // Update metadata
    metadata.totalSize += fullSnapshot.metadata.size;
    metadata.snapshotCount += 1;

    // Check total size limit
    if (metadata.totalSize > settings.maxTotalSize) {
      await performAutomaticCleanup(snapshots, metadata, settings);
    }

    // Save everything
    await chrome.storage.local.set({
      snapshots,
      metadata,
      settings,
    });

    console.log(`[DOM-SNAP] Saved snapshot ${snapshotId} for ${normalizedUrl}`);
    return snapshotId;
  } catch (error) {
    console.error('[DOM-SNAP] Error saving snapshot:', error);
    throw error;
  }
};

/**
 * Deletes a specific snapshot
 */
const deleteSnapshot = async (snapshotId: string): Promise<boolean> => {
  try {
    const result = await chrome.storage.local.get(['snapshots', 'metadata']);
    const snapshots = result.snapshots || {};
    const metadata = { ...DEFAULT_METADATA, ...result.metadata };

    let found = false;

    for (const [url, urlSnapshots] of Object.entries(snapshots)) {
      const index = (urlSnapshots as Snapshot[]).findIndex(s => s.id === snapshotId);
      if (index !== -1) {
        const deletedSnapshot = (urlSnapshots as Snapshot[])[index];
        (urlSnapshots as Snapshot[]).splice(index, 1);

        // Update metadata
        metadata.totalSize -= deletedSnapshot.metadata.size;
        metadata.snapshotCount -= 1;

        // Remove empty URL entries
        if ((urlSnapshots as Snapshot[]).length === 0) {
          delete snapshots[url];
        }

        found = true;
        break;
      }
    }

    if (found) {
      await chrome.storage.local.set({ snapshots, metadata });
      console.log(`[DOM-SNAP] Deleted snapshot ${snapshotId}`);
    }

    return found;
  } catch (error) {
    console.error('[DOM-SNAP] Error deleting snapshot:', error);
    return false;
  }
};

/**
 * Renames a specific snapshot
 */
const renameSnapshot = async (snapshotId: string, newName: string): Promise<boolean> => {
  // Validate the new name
  if (!newName || newName.trim().length === 0) {
    throw new Error('Snapshot name cannot be empty');
  }

  if (newName.length > 100) {
    throw new Error('Snapshot name cannot exceed 100 characters');
  }

  const trimmedName = newName.trim();

  try {
    const result = await chrome.storage.local.get('snapshots');
    const snapshots = result.snapshots || {};

    let found = false;

    // Find and update the snapshot
    for (const urlSnapshots of Object.values(snapshots)) {
      const snapshot = (urlSnapshots as Snapshot[]).find(s => s.id === snapshotId);
      if (snapshot) {
        snapshot.name = trimmedName;
        found = true;
        break;
      }
    }

    if (found) {
      await chrome.storage.local.set({ snapshots });
      console.log(`[DOM-SNAP] Renamed snapshot ${snapshotId} to "${trimmedName}"`);
    }

    return found;
  } catch (error) {
    console.error('[DOM-SNAP] Error renaming snapshot:', error);
    throw error;
  }
};

/**
 * Clears all snapshots for a specific URL
 */
const clearSnapshotsForUrl = async (url: string): Promise<number> => {
  const normalizedUrl = normalizeUrl(url);

  try {
    const result = await chrome.storage.local.get(['snapshots', 'metadata']);
    const snapshots = result.snapshots || {};
    const metadata = { ...DEFAULT_METADATA, ...result.metadata };

    const urlSnapshots = snapshots[normalizedUrl] || [];
    const deletedCount = urlSnapshots.length;

    if (deletedCount > 0) {
      // Update metadata
      const totalSize = urlSnapshots.reduce((sum: number, snapshot: Snapshot) => sum + snapshot.metadata.size, 0);
      metadata.totalSize -= totalSize;
      metadata.snapshotCount -= deletedCount;

      // Remove URL entry
      delete snapshots[normalizedUrl];

      await chrome.storage.local.set({ snapshots, metadata });
      console.log(`[DOM-SNAP] Cleared ${deletedCount} snapshots for ${normalizedUrl}`);
    }

    return deletedCount;
  } catch (error) {
    console.error('[DOM-SNAP] Error clearing snapshots:', error);
    return 0;
  }
};

/**
 * Clears ALL snapshots from all pages
 */
const clearAllSnapshots = async (): Promise<number> => {
  try {
    const result = await chrome.storage.local.get(['snapshots', 'settings']);
    const snapshots = result.snapshots || {};
    const settings = { ...DEFAULT_SETTINGS, ...result.settings };

    // Count total snapshots to be deleted
    let totalDeleted = 0;
    for (const urlSnapshots of Object.values(snapshots)) {
      totalDeleted += (urlSnapshots as Snapshot[]).length;
    }

    if (totalDeleted > 0) {
      // Clear all snapshots and reset metadata
      await chrome.storage.local.set({
        snapshots: {},
        metadata: {
          ...DEFAULT_METADATA,
          lastCleanup: Date.now(),
        },
        settings, // Keep settings unchanged
      });

      console.log(`[DOM-SNAP] Cleared all ${totalDeleted} snapshots from all pages`);
    }

    return totalDeleted;
  } catch (error) {
    console.error('[DOM-SNAP] Error clearing all snapshots:', error);
    return 0;
  }
};

/**
 * Gets storage usage information
 */
const getStorageInfo = async (): Promise<{
  totalSize: number;
  snapshotCount: number;
  usedPercentage: number;
  maxSize: number;
}> => {
  try {
    const result = await chrome.storage.local.get(['metadata', 'settings']);
    const metadata = { ...DEFAULT_METADATA, ...result.metadata };
    const settings = { ...DEFAULT_SETTINGS, ...result.settings };

    return {
      totalSize: metadata.totalSize,
      snapshotCount: metadata.snapshotCount,
      usedPercentage: (metadata.totalSize / settings.maxTotalSize) * 100,
      maxSize: settings.maxTotalSize,
    };
  } catch (error) {
    console.error('[DOM-SNAP] Error getting storage info:', error);
    return {
      totalSize: 0,
      snapshotCount: 0,
      usedPercentage: 0,
      maxSize: DEFAULT_SETTINGS.maxTotalSize,
    };
  }
};

/**
 * Performs automatic cleanup when storage limit is reached
 */
const performAutomaticCleanup = async (
  snapshots: StorageSchema['snapshots'],
  metadata: StorageSchema['metadata'],
  settings: StorageSchema['settings'],
): Promise<void> => {
  console.log('[DOM-SNAP] Performing automatic cleanup...');

  // Collect all snapshots with their URLs
  const allSnapshots: Array<{ snapshot: Snapshot; url: string }> = [];

  for (const [url, urlSnapshots] of Object.entries(snapshots)) {
    for (const snapshot of urlSnapshots) {
      allSnapshots.push({ snapshot, url });
    }
  }

  // Sort by timestamp (oldest first)
  allSnapshots.sort((a, b) => a.snapshot.timestamp - b.snapshot.timestamp);

  // Remove oldest snapshots until we're under the limit
  const targetSize = settings.maxTotalSize * 0.8; // Clean up to 80% of limit
  let currentSize = metadata.totalSize;
  let removedCount = 0;

  for (const { snapshot, url } of allSnapshots) {
    if (currentSize <= targetSize) break;

    // Remove from snapshots
    const urlSnapshots = snapshots[url];
    const index = urlSnapshots.findIndex(s => s.id === snapshot.id);
    if (index !== -1) {
      urlSnapshots.splice(index, 1);
      currentSize -= snapshot.metadata.size;
      removedCount++;

      // Remove empty URL entries
      if (urlSnapshots.length === 0) {
        delete snapshots[url];
      }
    }
  }

  // Update metadata
  metadata.totalSize = currentSize;
  metadata.snapshotCount -= removedCount;
  metadata.lastCleanup = Date.now();

  console.log(`[DOM-SNAP] Cleanup completed: removed ${removedCount} snapshots`);
};

/**
 * Initializes storage with default values if needed
 */
const initializeStorage = async (): Promise<void> => {
  try {
    const result = await chrome.storage.local.get(['snapshots', 'settings', 'metadata']);

    const updates: Partial<StorageSchema> = {};

    if (!result.snapshots) {
      updates.snapshots = {};
    }

    if (!result.settings) {
      updates.settings = DEFAULT_SETTINGS;
    }

    if (!result.metadata) {
      updates.metadata = DEFAULT_METADATA;
    }

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
      console.log('[DOM-SNAP] Storage initialized with defaults');
    }
  } catch (error) {
    console.error('[DOM-SNAP] Error initializing storage:', error);
  }
};

export type { Snapshot, StorageSchema };
export {
  generateSnapshotId,
  getSnapshotsForUrl,
  getSnapshotById,
  saveSnapshot,
  deleteSnapshot,
  renameSnapshot,
  clearSnapshotsForUrl,
  clearAllSnapshots,
  getStorageInfo,
  initializeStorage,
};
