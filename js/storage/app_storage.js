// ==========================================
// APP STORAGE LAYER
// Unified IndexedDB repository for the whole project
// Mobile-first, no legacy migration retention
// ==========================================

(function() {
    const DB_NAME = 'iiso_app_storage';
    const OPTIMIZATION_SHADOW_DB_NAME = 'iiso_app_storage_optimization_shadow_v10';
    const IMPORT_SHADOW_DB_NAME = 'iiso_app_storage_import_shadow_v10';
    const IMPORT_ROLLBACK_DB_NAME = 'iiso_app_storage_import_rollback_v10';
    const DB_VERSION = 9;
    const STORAGE_SCHEMA_VERSION = 10;
    const BACKUP_APP_NAME = 'u2phone';

    const STORES = {
        meta: 'meta',
        settings: 'settings',
        accounts: 'accounts',
        appState: 'app_state',
        theme: 'theme',
        worldbooks: 'worldbooks',
        assets: 'assets',
        imFriends: 'im_friends',
        imChatSummaries: 'im_chat_summaries',
        imMessages: 'im_messages',
        imMoments: 'im_moments',
        imMomentMessages: 'im_moment_messages',
        imStickers: 'im_stickers',
        libraryBooks: 'library_books',
        libraryBookContent: 'library_book_content',
        libraryPlaylists: 'library_playlists',
        libraryTracks: 'library_tracks',
        libraryDailyStats: 'library_daily_stats',
        appDomains: 'app_domains',
        xPosts: 'x_posts',
        xThreads: 'x_threads',
        xDms: 'x_dms',
        xAccountWorlds: 'x_account_worlds',
        vectorMemoryIndex: 'vector_memory_index',
        storageCheckpoints: 'storage_checkpoints'
    };
    const BACKUP_STORES = Object.values(STORES);

    const META_KEYS = {
        schemaVersion: 'schema_version',
        appVersion: 'app_version',
        imMomentsCoverAssetId: 'im_moments_cover_asset_id'
    };

    const runtimeBlobUrls = new Map();
    const runtimeBlobUrlAccess = new Map();
    const MAX_RUNTIME_BLOB_URLS = 120;
    const IMAGE_COMPRESSION_MIN_BYTES = 100 * 1024;
    const IMAGE_COMPRESSION_MIN_SAVED_BYTES = 32 * 1024;
    const IMAGE_COMPRESSION_MIN_SAVED_RATIO = 0.1;
    const IMAGE_COMPRESSION_QUALITY = 0.82;
    const IMAGE_COMPRESSION_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
    let dbPromise = null;
    const domainCache = new Map();
    const domainWriteChains = new Map();
    const pendingWrites = new Set();
    const storageSubscribers = new Set();
    const storageHealthState = {
        status: 'initializing',
        pendingWrites: 0,
        lastCommitAt: 0,
        lastError: null,
        migrationVersion: 0,
        lastCompaction: null,
        lastCacheCleanup: null,
        lastImageCompression: null
    };
    let imageCompressionPromise = null;
    let storageReadyPromise = null;
    let replacementInProgress = false;
    const storageBootstrapQueue = [];
    let storageBootstrapQueueScheduled = false;
    let deferredMaintenanceScheduled = false;

    function isTransientIndexedDbError(error) {
        const name = String(error?.name || '');
        const message = String(error?.message || error || '');
        return name === 'AbortError' ||
            name === 'InvalidStateError' ||
            name === 'TransactionInactiveError' ||
            /connection|closing|closed|transaction.*inactive|database.*not open/i.test(message);
    }

    async function resetDbConnection() {
        const pendingDb = dbPromise;
        dbPromise = null;
        if (!pendingDb) return;
        try {
            const db = await pendingDb;
            db?.close();
        } catch (error) {}
    }

    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function withAuthStorageRetry(operation, options = {}) {
        const attempts = Math.max(1, Number(options.attempts) || 3);
        let lastError;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                if (!isTransientIndexedDbError(error) || attempt === attempts - 1) throw error;
                const name = String(error?.name || '');
                const message = String(error?.message || error || '');
                if (name === 'InvalidStateError' || /connection|closing|closed|database.*not open/i.test(message)) {
                    await resetDbConnection();
                }
                await delay(60 * (attempt + 1));
            }
        }
        throw lastError;
    }

    function cloneDeep(value) {
        if (typeof structuredClone === 'function') {
            return structuredClone(value);
        }
        return JSON.parse(JSON.stringify(value));
    }

    function isDomNode(value) {
        return !!(
            value &&
            typeof value === 'object' &&
            typeof Node !== 'undefined' &&
            value instanceof Node
        );
    }

    function sanitizePersistentValue(value, seen = new WeakSet()) {
        if (value == null) return value;
        if (typeof value === 'function' || typeof value === 'symbol') return undefined;
        if (typeof value === 'string' && isBlobUrl(value)) return null;
        if (typeof value !== 'object') return value;
        if (isDomNode(value)) return undefined;
        if (value instanceof Date) return value.toISOString();
        if (typeof Blob !== 'undefined' && value instanceof Blob) return value;
        if (typeof File !== 'undefined' && value instanceof File) return value;

        if (seen.has(value)) return undefined;
        seen.add(value);

        if (Array.isArray(value)) {
            return value
                .map((item) => sanitizePersistentValue(item, seen))
                .filter((item) => item !== undefined);
        }

        const result = {};
        Object.keys(value).forEach((key) => {
            if (key.charAt(0) === '_') return;
            const sanitized = sanitizePersistentValue(value[key], seen);
            if (sanitized !== undefined) result[key] = sanitized;
        });
        return result;
    }

    function clampProgress(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return 0;
        return Math.max(0, Math.min(100, Math.round(parsed)));
    }

    function reportProgress(callback, message, progress) {
        if (typeof callback === 'function') {
            callback({ message, progress: clampProgress(progress) });
        }
    }

    // Browser localStorage is intentionally never read at runtime. These helpers
    // only parse rows embedded in a user-selected legacy backup file.
    function getLegacyBackupValue(snapshot = [], key) {
        const row = Array.isArray(snapshot)
            ? snapshot.find((item) => item && item.key === key)
            : null;
        return row ? row.value : undefined;
    }

    function parseLegacyBackupJson(snapshot = [], key) {
        const rawValue = getLegacyBackupValue(snapshot, key);
        if (rawValue === undefined || rawValue === null || rawValue === '') return undefined;

        try {
            return JSON.parse(rawValue);
        } catch (error) {
            console.warn(`Failed to parse legacy backup key "${key}":`, error);
            return undefined;
        }
    }

    function parseLegacyRawValue(rawValue) {
        if (rawValue === undefined || rawValue === null) return undefined;
        try {
            return sanitizePersistentValue(JSON.parse(String(rawValue)));
        } catch (error) {
            return isBlobUrl(String(rawValue)) ? '' : String(rawValue);
        }
    }

    async function importLegacyBackupStorageRows(snapshot = []) {
        const rows = Array.isArray(snapshot) ? snapshot.filter((row) => row?.key) : [];
        if (rows.length === 0) return { migratedKeys: [] };

        const settingsMap = {
            u2_userState: 'userState',
            u2_apiConfig: 'apiConfig',
            u2_vectorMemoryConfig: 'vectorMemoryConfig',
            u2_ttsConfig: 'ttsConfig',
            u2_minimaxConfig: 'minimaxConfig',
            u2_apiPresets: 'apiPresets',
            u2_fetchedModels: 'fetchedModels',
            u2_assistiveBallSettings: 'assistiveBallSettings',
            u2_accounts: 'accounts',
            u2_currentAccountId: 'currentAccountId',
            u2_themeState: 'themeState',
            u2_worldBooks: 'worldBooks',
            u2_wbGroups: 'wbGroups'
        };
        await withStore([STORES.appDomains, STORES.meta], 'readwrite', async (stores) => {
            const domainStore = stores[STORES.appDomains];
            const settingsRecord = await requestToPromise(domainStore.get('settings'));
            const legacyRecord = await requestToPromise(domainStore.get('legacy'));
            const settings = settingsRecord?.value && typeof settingsRecord.value === 'object'
                ? cloneDeep(settingsRecord.value)
                : {};
            const legacy = legacyRecord?.value && typeof legacyRecord.value === 'object'
                ? cloneDeep(legacyRecord.value)
                : {};
            let settingsChanged = false;
            let legacyChanged = false;

            for (const row of rows) {
                if (row.key === 'u2_mockAuthSession' || row.key === 'u2_appState') continue;
                const value = parseLegacyRawValue(row.value);
                const settingKey = settingsMap[row.key];
                if (settingKey) {
                    if (!Object.prototype.hasOwnProperty.call(settings, settingKey) && value !== undefined) {
                        settings[settingKey] = value;
                        settingsChanged = true;
                    }
                } else if (!Object.prototype.hasOwnProperty.call(legacy, row.key) && value !== undefined) {
                    legacy[row.key] = value;
                    legacyChanged = true;
                }
            }

            const oldAppState = parseLegacyBackupJson(rows, 'u2_appState');
            if (oldAppState && typeof oldAppState === 'object') {
                for (const [name, value] of Object.entries(oldAppState)) {
                    if (!name || !value || typeof value !== 'object') continue;
                    const existing = await requestToPromise(domainStore.get(name));
                    if (!existing) {
                        domainStore.put({
                            name,
                            schemaVersion: STORAGE_SCHEMA_VERSION,
                            revision: 1,
                            updatedAt: Date.now(),
                            value: sanitizePersistentValue(cloneDeep(value))
                        });
                    }
                }
            }

            const now = Date.now();
            if (settingsChanged || !settingsRecord) {
                domainStore.put({
                    name: 'settings',
                    schemaVersion: STORAGE_SCHEMA_VERSION,
                    revision: Math.max(0, Number(settingsRecord?.revision) || 0) + 1,
                    updatedAt: now,
                    value: sanitizePersistentValue(settings)
                });
            }
            if (legacyChanged || !legacyRecord) {
                domainStore.put({
                    name: 'legacy',
                    schemaVersion: STORAGE_SCHEMA_VERSION,
                    revision: Math.max(0, Number(legacyRecord?.revision) || 0) + 1,
                    updatedAt: now,
                    value: sanitizePersistentValue(legacy)
                });
            }
            stores[STORES.meta].put({ key: 'legacy_backup_imported_at', value: { importedAt: now, keys: rows.map((row) => row.key) } });
        });

        return { importedKeys: rows.map((row) => row.key) };
    }

    function estimateJsonBytes(value) {
        try {
            return new Blob([JSON.stringify(value)]).size;
        } catch (error) {
            try {
                return JSON.stringify(value).length;
            } catch (e) {
                return 0;
            }
        }
    }

    function createChecksum(value) {
        let text = '';
        try {
            text = JSON.stringify(value);
        } catch (error) {
            text = String(value || '');
        }

        let hash = 2166136261;
        for (let i = 0; i < text.length; i += 1) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }

        return (hash >>> 0).toString(16).padStart(8, '0');
    }

    function touchRuntimeBlobUrl(assetId) {
        if (!assetId) return;
        runtimeBlobUrlAccess.set(assetId, Date.now());
    }

    function revokeRuntimeBlobUrl(assetId) {
        const existing = runtimeBlobUrls.get(assetId);
        if (existing) {
            try {
                URL.revokeObjectURL(existing);
            } catch (e) {}
            runtimeBlobUrls.delete(assetId);
        }
        runtimeBlobUrlAccess.delete(assetId);
    }

    function clearRuntimeAssetCache() {
        try {
            Array.from(runtimeBlobUrls.keys()).forEach((assetId) => revokeRuntimeBlobUrl(assetId));
        } catch (e) {}
        runtimeBlobUrls.clear();
        runtimeBlobUrlAccess.clear();
        return true;
    }

    async function measureRuntimeCacheUsage() {
        const assetIds = Array.from(runtimeBlobUrls.keys());
        if (assetIds.length === 0) return 0;

        let total = 0;
        for (const assetId of assetIds) {
            const blob = await getAssetBlob(assetId);
            total += Number(blob?.size) || 0;
        }
        return total;
    }

    function pruneRuntimeAssetCache(maxEntries = MAX_RUNTIME_BLOB_URLS) {
        const limit = Math.max(0, Number(maxEntries) || 0);
        if (limit === 0) {
            clearRuntimeAssetCache();
            return 0;
        }

        if (runtimeBlobUrls.size <= limit) {
            return runtimeBlobUrls.size;
        }

        const removableIds = Array.from(runtimeBlobUrls.keys())
            .sort((a, b) => (runtimeBlobUrlAccess.get(a) || 0) - (runtimeBlobUrlAccess.get(b) || 0))
            .slice(0, Math.max(0, runtimeBlobUrls.size - limit));

        removableIds.forEach((assetId) => revokeRuntimeBlobUrl(assetId));
        return runtimeBlobUrls.size;
    }

    function isDataUrl(value) {
        return typeof value === 'string' && value.startsWith('data:');
    }

    function isBlobUrl(value) {
        return typeof value === 'string' && value.startsWith('blob:');
    }

    function hasStoreIndex(store, indexName) {
        if (!store || !store.indexNames) return false;
        if (typeof store.indexNames.contains === 'function') {
            return store.indexNames.contains(indexName);
        }
        return Array.from(store.indexNames).includes(indexName);
    }

    function dataUrlToBlob(dataUrl) {
        const source = String(dataUrl || '');
        const separatorIndex = source.indexOf(',');
        if (!source.startsWith('data:') || separatorIndex < 0) throw new Error('Invalid data URL.');
        const header = source.slice(0, separatorIndex);
        const data = source.slice(separatorIndex + 1);
        const mimeMatch = header.match(/^data:([^;,]*)/i);
        const mimeType = mimeMatch?.[1] || 'application/octet-stream';
        if (/;base64(?:;|$)/i.test(header)) {
            let normalized = data.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
            while (normalized.length % 4 !== 0) normalized += '=';
            const binary = atob(normalized);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
            return new Blob([bytes], { type: mimeType });
        }
        return new Blob([decodeURIComponent(data)], { type: mimeType });
    }

    async function hashBlobSha256(blob) {
        if (!blob || !globalThis.crypto?.subtle) return '';
        const buffer = await blob.arrayBuffer();
        const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
        return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    async function saveContentAddressedAsset(dataUrl, extra = {}) {
        if (!isDataUrl(dataUrl)) return null;
        await assertLargeAssetCapacity(dataUrl);
        const blob = dataUrlToBlob(dataUrl);
        const digest = await hashBlobSha256(blob);
        const fallbackId = String(extra.fallbackId || `asset_${Date.now()}_${Math.random().toString(36).slice(2)}`);
        const assetId = digest ? `sha256_${digest}` : fallbackId;
        await withStore([STORES.assets], 'readwrite', async (stores) => {
            const existing = await requestToPromise(stores[STORES.assets].get(assetId));
            if (existing?.blob && Number(existing.blob.size) === Number(blob.size)) return;
            stores[STORES.assets].put({
                id: assetId,
                blob,
                sha256: digest || null,
                mimeType: blob.type || extra.mimeType || 'application/octet-stream',
                createdAt: Number(existing?.createdAt) || Date.now(),
                updatedAt: Date.now(),
                ...extra,
                fallbackId: undefined
            });
        });
        return assetId;
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    function requestToPromise(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function deleteDatabaseSafe(name) {
        return new Promise((resolve) => {
            if (!window.indexedDB || !name) {
                resolve({ name, deleted: false, reason: 'indexeddb_unavailable' });
                return;
            }

            let settled = false;
            const request = window.indexedDB.deleteDatabase(name);

            request.onsuccess = () => {
                if (settled) return;
                settled = true;
                resolve({ name, deleted: true, reason: 'deleted' });
            };

            request.onerror = () => {
                if (settled) return;
                settled = true;
                resolve({
                    name,
                    deleted: false,
                    reason: request.error?.message || request.error?.name || 'delete_error'
                });
            };

            request.onblocked = () => {
                if (settled) return;
                settled = true;
                resolve({ name, deleted: false, reason: 'blocked' });
            };
        });
    }

    async function clearBrowserCaches() {
        if (!window.caches || typeof window.caches.keys !== 'function') {
            return [];
        }

        try {
            const cacheNames = await window.caches.keys();
            const results = [];

            for (const cacheName of cacheNames) {
                const deleted = await window.caches.delete(cacheName);
                results.push({ name: cacheName, deleted: !!deleted });
            }

            return results;
        } catch (error) {
            return [{ name: '*', deleted: false, reason: error?.message || 'cache_clear_failed' }];
        }
    }

    async function unregisterServiceWorkers() {
        if (!navigator.serviceWorker || typeof navigator.serviceWorker.getRegistrations !== 'function') {
            return [];
        }

        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            const results = [];

            for (const registration of registrations) {
                const scope = registration?.scope || 'unknown';
                const unregistered = await registration.unregister();
                results.push({ scope, unregistered: !!unregistered });
            }

            return results;
        } catch (error) {
            return [{ scope: '*', unregistered: false, reason: error?.message || 'sw_unregister_failed' }];
        }
    }

    function createDbConnection(databaseName = DB_NAME) {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB is not supported in this browser.'));
                return;
            }

            const request = window.indexedDB.open(databaseName, DB_VERSION);

            request.onerror = () => {
                dbPromise = null;
                reject(request.error);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(STORES.meta)) {
                    db.createObjectStore(STORES.meta, { keyPath: 'key' });
                }

                if (!db.objectStoreNames.contains(STORES.settings)) {
                    db.createObjectStore(STORES.settings, { keyPath: 'key' });
                }

                if (!db.objectStoreNames.contains(STORES.accounts)) {
                    db.createObjectStore(STORES.accounts, { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains(STORES.appState)) {
                    db.createObjectStore(STORES.appState, { keyPath: 'key' });
                }

                if (!db.objectStoreNames.contains(STORES.theme)) {
                    db.createObjectStore(STORES.theme, { keyPath: 'key' });
                }

                if (!db.objectStoreNames.contains(STORES.worldbooks)) {
                    db.createObjectStore(STORES.worldbooks, { keyPath: 'key' });
                }

                if (!db.objectStoreNames.contains(STORES.assets)) {
                    db.createObjectStore(STORES.assets, { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains(STORES.imFriends)) {
                    db.createObjectStore(STORES.imFriends, { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains(STORES.imChatSummaries)) {
                    db.createObjectStore(STORES.imChatSummaries, { keyPath: 'friendId' });
                }

                if (!db.objectStoreNames.contains(STORES.imMessages)) {
                    const messageStore = db.createObjectStore(STORES.imMessages, { keyPath: 'id' });
                    messageStore.createIndex('friendId', 'friendId', { unique: false });
                    messageStore.createIndex('friendId_timestamp', ['friendId', 'timestamp'], { unique: false });
                    messageStore.createIndex('friendId_order', ['friendId', 'order'], { unique: false });
                } else {
                    const upgradeTransaction = event.target.transaction;
                    if (upgradeTransaction) {
                        const messageStore = upgradeTransaction.objectStore(STORES.imMessages);
                        if (!hasStoreIndex(messageStore, 'friendId')) {
                            messageStore.createIndex('friendId', 'friendId', { unique: false });
                        }
                        if (!hasStoreIndex(messageStore, 'friendId_timestamp')) {
                            messageStore.createIndex('friendId_timestamp', ['friendId', 'timestamp'], { unique: false });
                        }
                        if (!hasStoreIndex(messageStore, 'friendId_order')) {
                            messageStore.createIndex('friendId_order', ['friendId', 'order'], { unique: false });
                        }
                    }
                }

                if (!db.objectStoreNames.contains(STORES.imMoments)) {
                    const momentsStore = db.createObjectStore(STORES.imMoments, { keyPath: 'id' });
                    momentsStore.createIndex('userId', 'userId', { unique: false });
                    momentsStore.createIndex('time', 'time', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.imMomentMessages)) {
                    const momentMsgStore = db.createObjectStore(STORES.imMomentMessages, { keyPath: 'id' });
                    momentMsgStore.createIndex('time', 'time', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.imStickers)) {
                    db.createObjectStore(STORES.imStickers, { keyPath: 'categoryName' });
                }

                if (!db.objectStoreNames.contains(STORES.libraryBooks)) {
                    const booksStore = db.createObjectStore(STORES.libraryBooks, { keyPath: 'id' });
                    booksStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.libraryBookContent)) {
                    db.createObjectStore(STORES.libraryBookContent, { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains(STORES.libraryPlaylists)) {
                    const playlistsStore = db.createObjectStore(STORES.libraryPlaylists, { keyPath: 'id' });
                    playlistsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.libraryTracks)) {
                    const tracksStore = db.createObjectStore(STORES.libraryTracks, { keyPath: 'id' });
                    tracksStore.createIndex('playlistId', 'playlistId', { unique: false });
                    tracksStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.libraryDailyStats)) {
                    const statsStore = db.createObjectStore(STORES.libraryDailyStats, { keyPath: 'id' });
                    statsStore.createIndex('date', 'date', { unique: false });
                    statsStore.createIndex('kind', 'kind', { unique: false });
                    statsStore.createIndex('date_kind', ['date', 'kind'], { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.appDomains)) {
                    const domainStore = db.createObjectStore(STORES.appDomains, { keyPath: 'name' });
                    domainStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.xPosts)) {
                    const postStore = db.createObjectStore(STORES.xPosts, { keyPath: 'id' });
                    postStore.createIndex('createdAt', 'createdAt', { unique: false });
                    postStore.createIndex('authorId', 'authorId', { unique: false });
                    postStore.createIndex('topicTag', 'topicTag', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.xThreads)) {
                    db.createObjectStore(STORES.xThreads, { keyPath: 'postId' });
                }

                if (!db.objectStoreNames.contains(STORES.xDms)) {
                    const dmStore = db.createObjectStore(STORES.xDms, { keyPath: 'id' });
                    dmStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.xAccountWorlds)) {
                    const worldStore = db.createObjectStore(STORES.xAccountWorlds, { keyPath: 'accountId' });
                    worldStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.vectorMemoryIndex)) {
                    const vectorStore = db.createObjectStore(STORES.vectorMemoryIndex, { keyPath: 'id' });
                    vectorStore.createIndex('scopeFriendKey', 'scopeFriendKey', { unique: false });
                    vectorStore.createIndex('scopeKey', 'scopeKey', { unique: false });
                } else {
                    const upgradeTransaction = event.target.transaction;
                    if (upgradeTransaction) {
                        const vectorStore = upgradeTransaction.objectStore(STORES.vectorMemoryIndex);
                        if (!hasStoreIndex(vectorStore, 'scopeFriendKey')) {
                            vectorStore.createIndex('scopeFriendKey', 'scopeFriendKey', { unique: false });
                        }
                        if (!hasStoreIndex(vectorStore, 'scopeKey')) {
                            vectorStore.createIndex('scopeKey', 'scopeKey', { unique: false });
                        }
                    }
                }

                if (!db.objectStoreNames.contains(STORES.storageCheckpoints)) {
                    db.createObjectStore(STORES.storageCheckpoints, { keyPath: 'id' });
                }
            };

            request.onsuccess = () => {
                const db = request.result;

                db.onversionchange = () => {
                    try {
                        db.close();
                    } catch (e) {}
                    dbPromise = null;
                };

                resolve(db);
            };
        });
    }

    function openDb() {
        if (!dbPromise) {
            dbPromise = createDbConnection().catch((error) => {
                dbPromise = null;
                throw error;
            });
        }
        return dbPromise;
    }

    async function withStore(storeNames, mode, callback) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeNames, mode);
            const stores = {};
            storeNames.forEach((name) => {
                stores[name] = transaction.objectStore(name);
            });

            let callbackResult;
            try {
                callbackResult = callback(stores, transaction);
            } catch (error) {
                reject(error);
                return;
            }

            transaction.oncomplete = async () => {
                try {
                    const resolved = await Promise.resolve(callbackResult);
                    resolve(resolved);
                } catch (error) {
                    reject(error);
                }
            };

            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'));
        });
    }

    async function getRecord(storeName, key) {
        return withStore([storeName], 'readonly', async (stores) => {
            const row = await requestToPromise(stores[storeName].get(key));
            return row || null;
        });
    }

    async function putRecord(storeName, record) {
        return withStore([storeName], 'readwrite', (stores) => {
            stores[storeName].put(record);
        });
    }

    async function deleteRecord(storeName, key) {
        return withStore([storeName], 'readwrite', (stores) => {
            stores[storeName].delete(key);
        });
    }

    async function getAllRecords(storeName) {
        return withStore([storeName], 'readonly', async (stores) => {
            const rows = await requestToPromise(stores[storeName].getAll());
            return Array.isArray(rows) ? rows : [];
        });
    }

    async function openExistingShadowDatabase() {
        if (!window.indexedDB) return null;
        if (typeof window.indexedDB.databases === 'function') {
            try {
                const databases = await window.indexedDB.databases();
                if (!databases.some((item) => item?.name === OPTIMIZATION_SHADOW_DB_NAME)) return null;
            } catch (error) {}
        }
        const db = await createDbConnection(OPTIMIZATION_SHADOW_DB_NAME);
        const marker = await new Promise((resolve, reject) => {
            const request = db.transaction(STORES.meta, 'readonly').objectStore(STORES.meta).get('optimization_shadow_ready');
            request.onsuccess = () => resolve(request.result?.value || null);
            request.onerror = () => reject(request.error);
        });
        if (!marker) {
            db.close();
            await deleteDatabaseSafe(OPTIMIZATION_SHADOW_DB_NAME);
            return null;
        }
        return { db, marker };
    }

    async function getAllFromConnection(db, storeName) {
        return new Promise((resolve, reject) => {
            const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
            request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
            request.onerror = () => reject(request.error);
        });
    }

    function sortStoreRowsByKey(storeName, rows = []) {
        const keyField = BACKUP_STORE_KEY_FIELDS[storeName];
        return (Array.isArray(rows) ? rows : []).slice().sort((left, right) => {
            const leftKey = String(left?.[keyField] ?? '');
            const rightKey = String(right?.[keyField] ?? '');
            if (leftKey < rightKey) return -1;
            if (leftKey > rightKey) return 1;
            return 0;
        });
    }

    async function buildStoreSignature(storeName, rows) {
        const orderedRows = sortStoreRowsByKey(storeName, rows);
        let checksumRows = orderedRows;
        if (storeName === STORES.assets) {
            checksumRows = [];
            for (const row of orderedRows) {
                const blob = row?.blob;
                checksumRows.push({
                    ...row,
                    blob: blob ? {
                        size: Number(blob.size) || 0,
                        type: blob.type || '',
                        sha256: row.sha256 || await hashBlobSha256(blob)
                    } : null
                });
            }
        }
        return {
            count: orderedRows.length,
            bytes: orderedRows.reduce((sum, row) => sum + measureRecordBytes(row), 0),
            checksum: createChecksum(checksumRows)
        };
    }

    async function replaceConnectionStore(db, storeName, rows) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            store.clear();
            rows.forEach((row) => store.put(row));
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error || new Error(`Copy aborted for ${storeName}`));
        });
    }

    async function copyDatabaseContents(sourceDb, targetDb, progressCallback, progressStart = 0, progressSpan = 100) {
        const signatures = {};
        const storeNames = Object.values(STORES);
        for (let index = 0; index < storeNames.length; index += 1) {
            const storeName = storeNames[index];
            const rows = await getAllFromConnection(sourceDb, storeName);
            const filteredRows = storeName === STORES.meta
                ? rows.filter((row) => row?.key !== 'optimization_shadow_ready' && row?.key !== 'optimization_restore_complete')
                : rows;
            const expected = await buildStoreSignature(storeName, filteredRows);
            await replaceConnectionStore(targetDb, storeName, filteredRows);
            const copiedRows = await getAllFromConnection(targetDb, storeName);
            const actual = await buildStoreSignature(storeName, copiedRows);
            if (expected.count !== actual.count || expected.bytes !== actual.bytes || expected.checksum !== actual.checksum) {
                throw new Error(`Storage verification failed for ${storeName}.`);
            }
            signatures[storeName] = actual;
            reportProgress(
                progressCallback,
                `校验 ${storeName} (${actual.count})...`,
                progressStart + ((index + 1) / storeNames.length) * progressSpan
            );
        }
        return signatures;
    }

    async function setConnectionMeta(db, key, value) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.meta, 'readwrite');
            transaction.objectStore(STORES.meta).put({ key, value });
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error || new Error(`Meta write aborted for ${key}`));
        });
    }

    function notifyStorageSubscribers(detail) {
        storageSubscribers.forEach((listener) => {
            try {
                listener(cloneDeep(detail));
            } catch (error) {
                console.warn('[appStorage] storage subscriber failed', error);
            }
        });
        try {
            window.dispatchEvent(new CustomEvent('u2-storage-status', { detail: cloneDeep(detail) }));
        } catch (error) {}
    }

    function trackPendingWrite(promise) {
        pendingWrites.add(promise);
        storageHealthState.pendingWrites = pendingWrites.size;
        storageHealthState.status = 'saving';
        notifyStorageSubscribers({ ...storageHealthState });
        promise.finally(() => {
            pendingWrites.delete(promise);
            storageHealthState.pendingWrites = pendingWrites.size;
            if (pendingWrites.size === 0 && storageHealthState.status !== 'error') {
                storageHealthState.status = 'saved';
            }
            notifyStorageSubscribers({ ...storageHealthState });
        });
        return promise;
    }

    function readDomain(name, fallbackValue = null) {
        if (!name || !domainCache.has(String(name))) return cloneDeep(fallbackValue);
        return cloneDeep(domainCache.get(String(name)));
    }

    function stripXCollections(value = {}) {
        const safe = value && typeof value === 'object' ? cloneDeep(value) : {};
        delete safe.xGeneratedPosts;
        delete safe.xPostThreads;
        delete safe.xDirectMessages;
        return safe;
    }

    function stripXAccountGlobals(value = {}) {
        const safe = value && typeof value === 'object' ? cloneDeep(value) : {};
        delete safe.xPlayerAccounts;
        delete safe.activeXPlayerAccountId;
        delete safe.xAccountSchemaVersion;
        return safe;
    }

    function getXAssetNamespace(value = {}) {
        return String(value?.activeXPlayerAccountId || 'legacy')
            .trim()
            .replace(/[^a-z0-9_-]+/gi, '-')
            .slice(0, 80) || 'legacy';
    }

    function putAssetInTransaction(assetStore, assetId, dataUrl, extra = {}) {
        const blob = dataUrlToBlob(dataUrl);
        assetStore.put({
            id: assetId,
            blob,
            mimeType: blob.type || 'application/octet-stream',
            updatedAt: Date.now(),
            ...extra
        });
    }

    function persistXAssetsInTransaction(value, assetStore) {
        const next = cloneDeep(value && typeof value === 'object' ? value : {});
        const accountNamespace = getXAssetNamespace(next);
        const scopedAssetId = (suffix) => `x_account_${accountNamespace}_${suffix}`;
        const persistField = (owner, urlField, assetField, assetId, extra) => {
            if (!owner || !isDataUrl(owner[urlField])) return;
            putAssetInTransaction(assetStore, assetId, owner[urlField], extra);
            owner[assetField] = assetId;
            owner[urlField] = null;
        };

        persistField(next.xData, 'avatar', 'avatarAssetId', scopedAssetId('profile_avatar'), { ownerType: 'x_profile', ownerId: accountNamespace, field: 'avatar' });
        persistField(next.xData, 'banner', 'bannerAssetId', scopedAssetId('profile_banner'), { ownerType: 'x_profile', ownerId: accountNamespace, field: 'banner' });
        persistField(next, 'xHomeBannerUrl', 'xHomeBannerAssetId', scopedAssetId('home_banner'), { ownerType: 'x_app', ownerId: accountNamespace, field: 'homeBanner' });
        persistField(next, 'xSearchBannerUrl', 'xSearchBannerAssetId', scopedAssetId('search_banner'), { ownerType: 'x_app', ownerId: accountNamespace, field: 'searchBanner' });
        (Array.isArray(next.xPlayerAccounts) ? next.xPlayerAccounts : []).forEach((account, accountIndex) => {
            const accountId = String(account?.id || `account-${accountIndex}`)
                .replace(/[^a-z0-9_-]+/gi, '-')
                .slice(0, 80) || `account-${accountIndex}`;
            persistField(account, 'avatar', 'avatarAssetId', `x_account_${accountId}_switcher_avatar`, {
                ownerType: 'x_account',
                ownerId: accountId,
                field: 'avatar'
            });
        });

        (Array.isArray(next.xTopics) ? next.xTopics : []).forEach((topic, topicIndex) => {
            const topicId = String(topic?.id ?? topic?.name ?? topicIndex);
            persistField(topic, 'avatar', 'avatarAssetId', scopedAssetId(`topic_${topicId}_avatar`), { ownerType: 'x_topic', ownerId: topicId, accountId: accountNamespace, field: 'avatar' });
            persistField(topic, 'banner', 'bannerAssetId', scopedAssetId(`topic_${topicId}_banner`), { ownerType: 'x_topic', ownerId: topicId, accountId: accountNamespace, field: 'banner' });
        });

        (Array.isArray(next.xGeneratedPosts) ? next.xGeneratedPosts : []).forEach((post, postIndex) => {
            const postId = String(post?.id ?? postIndex);
            persistField(post, 'authorAvatar', 'authorAvatarAssetId', scopedAssetId(`post_${postId}_author`), { ownerType: 'x_post', ownerId: postId, accountId: accountNamespace, field: 'authorAvatar' });
            (Array.isArray(post?.images) ? post.images : []).forEach((image, imageIndex) => {
                if (!image || typeof image !== 'object' || !isDataUrl(image.url)) return;
                const assetId = String(image.assetId || scopedAssetId(`post_${postId}_image_${imageIndex}`));
                putAssetInTransaction(assetStore, assetId, image.url, { ownerType: 'x_post', ownerId: postId, accountId: accountNamespace, field: 'images', index: imageIndex });
                image.assetId = assetId;
                image.url = null;
            });
        });
        (Array.isArray(next.xDirectMessages) ? next.xDirectMessages : []).forEach((dm, dmIndex) => {
            const charId = String(dm?.id ?? dmIndex).replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80) || `char-${dmIndex}`;
            persistField(
                dm,
                'profileImageFaceReferenceUrl',
                'profileImageFaceReferenceAssetId',
                scopedAssetId(`char_${charId}_profile_face`),
                { ownerType: 'x_char_profile_face', ownerId: String(dm?.id ?? dmIndex), accountId: accountNamespace }
            );
            (Array.isArray(dm?.profilePosts) ? dm.profilePosts : []).forEach((post, postIndex) => {
                const postId = String(post?.id ?? postIndex).replace(/[^a-z0-9_-]+/gi, '-').slice(0, 100) || `post-${postIndex}`;
                (Array.isArray(post?.images) ? post.images : []).forEach((image, imageIndex) => {
                    if (!image || typeof image !== 'object' || !isDataUrl(image.url)) return;
                    const assetId = String(image.assetId || scopedAssetId(`char_${charId}_profile_post_${postId}_image_${imageIndex}`));
                    putAssetInTransaction(assetStore, assetId, image.url, {
                        ownerType: 'x_char_profile_post',
                        ownerId: postId,
                        charId: String(dm?.id ?? dmIndex),
                        accountId: accountNamespace,
                        field: 'images',
                        index: imageIndex
                    });
                    image.assetId = assetId;
                    image.url = null;
                });
            });
        });
        return next;
    }

    async function hydrateXAssets(value) {
        const next = cloneDeep(value && typeof value === 'object' ? value : {});
        const hydrateField = async (owner, urlField, assetField) => {
            if (owner?.[assetField] && !owner[urlField]) owner[urlField] = await getAssetUrl(owner[assetField]);
        };
        await hydrateField(next.xData, 'avatar', 'avatarAssetId');
        await hydrateField(next.xData, 'banner', 'bannerAssetId');
        await hydrateField(next, 'xHomeBannerUrl', 'xHomeBannerAssetId');
        await hydrateField(next, 'xSearchBannerUrl', 'xSearchBannerAssetId');
        for (const account of (Array.isArray(next.xPlayerAccounts) ? next.xPlayerAccounts : [])) {
            await hydrateField(account, 'avatar', 'avatarAssetId');
        }
        for (const topic of (Array.isArray(next.xTopics) ? next.xTopics : [])) {
            await hydrateField(topic, 'avatar', 'avatarAssetId');
            await hydrateField(topic, 'banner', 'bannerAssetId');
        }
        for (const post of (Array.isArray(next.xGeneratedPosts) ? next.xGeneratedPosts : [])) {
            await hydrateField(post, 'authorAvatar', 'authorAvatarAssetId');
            for (const image of (Array.isArray(post?.images) ? post.images : [])) {
                if (image?.assetId && !image.url) image.url = await getAssetUrl(image.assetId);
            }
        }
        for (const dm of (Array.isArray(next.xDirectMessages) ? next.xDirectMessages : [])) {
            await hydrateField(dm, 'profileImageFaceReferenceUrl', 'profileImageFaceReferenceAssetId');
            for (const post of (Array.isArray(dm?.profilePosts) ? dm.profilePosts : [])) {
                for (const image of (Array.isArray(post?.images) ? post.images : [])) {
                    if (image?.assetId && !image.url) image.url = await getAssetUrl(image.assetId);
                }
            }
        }
        return next;
    }

    async function replaceCollectionRecords(store, rows, keyField) {
        const safeRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
        const keepKeys = new Set(safeRows.map((row) => String(row[keyField])).filter(Boolean));
        const existingKeys = await requestToPromise(store.getAllKeys());
        (Array.isArray(existingKeys) ? existingKeys : []).forEach((key) => {
            if (!keepKeys.has(String(key))) store.delete(key);
        });
        safeRows.forEach((row) => store.put(sanitizePersistentValue(cloneDeep(row))));
    }

    async function hydrateXDomain(value = {}) {
        const [posts, threads, dms] = await Promise.all([
            getAllRecords(STORES.xPosts),
            getAllRecords(STORES.xThreads),
            getAllRecords(STORES.xDms)
        ]);
        return hydrateXAssets({
            ...(value && typeof value === 'object' ? value : {}),
            xGeneratedPosts: posts.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)),
            xPostThreads: Object.fromEntries(threads.map((row) => [String(row.postId), row.value])),
            xDirectMessages: dms
        });
    }

    function buildXAccountWorldRecord(persistedValue = {}, accountId = '') {
        const safeAccountId = String(accountId || '').trim();
        if (!safeAccountId) throw new Error('X account id is required.');
        return {
            accountId: safeAccountId,
            updatedAt: Date.now(),
            state: stripXAccountGlobals(stripXCollections(persistedValue)),
            xGeneratedPosts: cloneDeep(Array.isArray(persistedValue.xGeneratedPosts) ? persistedValue.xGeneratedPosts : []),
            xPostThreads: cloneDeep(
                persistedValue.xPostThreads && typeof persistedValue.xPostThreads === 'object'
                    ? persistedValue.xPostThreads
                    : {}
            ),
            xDirectMessages: cloneDeep(Array.isArray(persistedValue.xDirectMessages) ? persistedValue.xDirectMessages : [])
        };
    }

    function restoreXAccountWorldRecord(record = {}, globals = {}) {
        return {
            ...(record.state && typeof record.state === 'object' ? cloneDeep(record.state) : {}),
            xGeneratedPosts: cloneDeep(Array.isArray(record.xGeneratedPosts) ? record.xGeneratedPosts : []),
            xPostThreads: cloneDeep(record.xPostThreads && typeof record.xPostThreads === 'object' ? record.xPostThreads : {}),
            xDirectMessages: cloneDeep(Array.isArray(record.xDirectMessages) ? record.xDirectMessages : []),
            xPlayerAccounts: cloneDeep(Array.isArray(globals.xPlayerAccounts) ? globals.xPlayerAccounts : []),
            activeXPlayerAccountId: String(globals.activeXPlayerAccountId || record.accountId || ''),
            xAccountSchemaVersion: Math.max(1, Number(globals.xAccountSchemaVersion) || 1)
        };
    }

    async function switchXAccountWorld(targetAccountId, initialState = null) {
        if (replacementInProgress) throw new Error('Storage replacement is in progress.');
        if (storageReadyPromise) await storageReadyPromise;
        const targetId = String(targetAccountId || '').trim();
        if (!targetId) throw new Error('Target X account id is required.');
        if (!await flushPendingWrites()) throw new Error('Pending writes could not be completed before switching X accounts.');

        const currentRuntime = readDomain('x', {});
        const currentId = String(currentRuntime.activeXPlayerAccountId || '').trim();
        if (currentId && currentId === targetId) return cloneDeep(currentRuntime);

        const storeNames = [
            STORES.appDomains,
            STORES.xPosts,
            STORES.xThreads,
            STORES.xDms,
            STORES.xAccountWorlds,
            STORES.assets
        ];
        let persistedTargetResult = null;
        const now = Date.now();

        await runWithQuotaRetry(() => withStore(storeNames, 'readwrite', async (stores) => {
            const currentRecord = await requestToPromise(stores[STORES.appDomains].get('x'));
            const persistedCurrent = persistXAssetsInTransaction(currentRuntime, stores[STORES.assets]);
            const globalAccountState = {
                xPlayerAccounts: cloneDeep(Array.isArray(persistedCurrent.xPlayerAccounts) ? persistedCurrent.xPlayerAccounts : []),
                activeXPlayerAccountId: targetId,
                xAccountSchemaVersion: Math.max(1, Number(persistedCurrent.xAccountSchemaVersion) || 1)
            };

            if (currentId) {
                stores[STORES.xAccountWorlds].put(buildXAccountWorldRecord(persistedCurrent, currentId));
            }

            let targetWorld = await requestToPromise(stores[STORES.xAccountWorlds].get(targetId));
            if (!targetWorld) {
                if (!initialState || typeof initialState !== 'object') {
                    throw new Error(`X account world ${targetId} was not found.`);
                }
                const preparedInitial = persistXAssetsInTransaction({
                    ...cloneDeep(initialState),
                    ...globalAccountState,
                    activeXPlayerAccountId: targetId
                }, stores[STORES.assets]);
                targetWorld = buildXAccountWorldRecord(preparedInitial, targetId);
            }

            const persistedTarget = restoreXAccountWorldRecord(targetWorld, globalAccountState);
            const revision = Math.max(0, Number(currentRecord?.revision) || 0) + 1;
            stores[STORES.appDomains].put({
                name: 'x',
                schemaVersion: STORAGE_SCHEMA_VERSION,
                revision,
                updatedAt: now,
                value: stripXCollections(persistedTarget)
            });
            await replaceCollectionRecords(stores[STORES.xPosts], persistedTarget.xGeneratedPosts || [], 'id');
            const threadRows = Object.entries(persistedTarget.xPostThreads || {}).map(([postId, value]) => ({ postId, value }));
            await replaceCollectionRecords(stores[STORES.xThreads], threadRows, 'postId');
            const dmRows = (persistedTarget.xDirectMessages || []).map((item, index) => ({
                ...item,
                id: String(item?.id ?? item?.charId ?? `x-dm-${index}`),
                updatedAt: Number(item?.updatedAt) || now
            }));
            await replaceCollectionRecords(stores[STORES.xDms], dmRows, 'id');
            stores[STORES.xAccountWorlds].delete(targetId);
            persistedTargetResult = persistedTarget;
        }));

        const nextRuntime = await hydrateXAssets(persistedTargetResult || {});
        domainCache.set('x', cloneDeep(nextRuntime));
        storageHealthState.status = 'saved';
        storageHealthState.lastCommitAt = now;
        storageHealthState.lastError = null;
        notifyStorageSubscribers({ ...storageHealthState, reason: 'x-account-switch' });
        return cloneDeep(nextRuntime);
    }

    async function runWithQuotaRetry(task) {
        try {
            return await task();
        } catch (error) {
            const isQuotaError = error?.name === 'QuotaExceededError'
                || /quota|storage.*full/i.test(String(error?.message || ''));
            if (!isQuotaError) throw error;
            await pruneOrphanedAssets();
            return task();
        }
    }

    async function commitDomain(name, reducer, options = {}) {
        if (replacementInProgress) throw new Error('Storage replacement is in progress.');
        const domainName = String(name || '').trim();
        if (!domainName) throw new Error('Domain name is required.');
        if (storageReadyPromise) await storageReadyPromise;

        const previousChain = domainWriteChains.get(domainName) || Promise.resolve();
        const writePromise = previousChain.catch(() => undefined).then(async () => {
            const storeNames = [STORES.appDomains];
            if (domainName === 'x') {
                storeNames.push(STORES.xPosts, STORES.xThreads, STORES.xDms, STORES.assets);
            }

            const currentCached = readDomain(domainName, {});
            const nextDraft = cloneDeep(currentCached && typeof currentCached === 'object' ? currentCached : {});
            const reduced = typeof reducer === 'function' ? reducer(nextDraft) : reducer;
            const runtimeNextValue = cloneDeep(reduced === undefined ? nextDraft : reduced);
            const nextValue = domainName === 'x'
                ? runtimeNextValue
                : sanitizePersistentValue(cloneDeep(runtimeNextValue));
            const now = Date.now();

            let commitResult = null;
            await runWithQuotaRetry(() => withStore(storeNames, 'readwrite', async (stores) => {
                const currentRecord = await requestToPromise(stores[STORES.appDomains].get(domainName));
                const revision = Math.max(0, Number(currentRecord?.revision) || 0) + 1;
                const persistedValue = domainName === 'x'
                    ? sanitizePersistentValue(persistXAssetsInTransaction(nextValue, stores[STORES.assets]))
                    : nextValue;
                const storedValue = domainName === 'x' ? stripXCollections(persistedValue) : persistedValue;
                const record = {
                    name: domainName,
                    schemaVersion: STORAGE_SCHEMA_VERSION,
                    revision,
                    updatedAt: now,
                    value: storedValue
                };

                if (domainName === 'x') {
                    await replaceCollectionRecords(
                        stores[STORES.xPosts],
                        Array.isArray(persistedValue.xGeneratedPosts) ? persistedValue.xGeneratedPosts : [],
                        'id'
                    );
                    const threadRows = Object.entries(persistedValue.xPostThreads || {}).map(([postId, value]) => ({ postId, value }));
                    await replaceCollectionRecords(stores[STORES.xThreads], threadRows, 'postId');
                    const dmRows = (Array.isArray(persistedValue.xDirectMessages) ? persistedValue.xDirectMessages : []).map((item, index) => ({
                        ...item,
                        id: String(item?.id ?? item?.charId ?? `x-dm-${index}`),
                        updatedAt: Number(item?.updatedAt) || now
                    }));
                    await replaceCollectionRecords(stores[STORES.xDms], dmRows, 'id');
                }

                stores[STORES.appDomains].put(record);
                commitResult = { revision, updatedAt: now, durable: true, domain: domainName };
            }));

            domainCache.set(domainName, cloneDeep(nextValue));
            storageHealthState.status = 'saved';
            storageHealthState.lastCommitAt = now;
            storageHealthState.lastError = null;
            notifyStorageSubscribers({ ...storageHealthState, commit: commitResult, reason: options.reason || '' });
            return commitResult;
        }).catch((error) => {
            storageHealthState.status = 'error';
            storageHealthState.lastError = error?.message || String(error);
            notifyStorageSubscribers({ ...storageHealthState, domain: domainName });
            throw error;
        });

        domainWriteChains.set(domainName, writePromise);
        trackPendingWrite(writePromise);
        try {
            return await writePromise;
        } finally {
            if (domainWriteChains.get(domainName) === writePromise) domainWriteChains.delete(domainName);
        }
    }

    async function commitRecords(operations = [], options = {}) {
        if (replacementInProgress) throw new Error('Storage replacement is in progress.');
        if (storageReadyPromise) await storageReadyPromise;
        const safeOperations = (Array.isArray(operations) ? operations : []).filter((operation) => {
            return operation && Object.values(STORES).includes(operation.store);
        });
        if (safeOperations.length === 0) return { durable: true, updatedAt: Date.now(), count: 0 };
        const storeNames = Array.from(new Set(safeOperations.map((operation) => operation.store)));
        const promise = runWithQuotaRetry(() => withStore(storeNames, 'readwrite', (stores) => {
            safeOperations.forEach((operation) => {
                const store = stores[operation.store];
                if (operation.type === 'delete') store.delete(operation.key);
                else store.put(sanitizePersistentValue(cloneDeep(operation.value)));
            });
        })).then(() => {
            const result = { durable: true, updatedAt: Date.now(), count: safeOperations.length, reason: options.reason || '' };
            storageHealthState.lastCommitAt = result.updatedAt;
            storageHealthState.lastError = null;
            return result;
        });
        return trackPendingWrite(promise);
    }

    async function flushPendingWrites() {
        const writes = Array.from(pendingWrites);
        if (writes.length === 0) return true;
        const results = await Promise.allSettled(writes);
        return results.every((result) => result.status === 'fulfilled');
    }

    function subscribe(listener) {
        if (typeof listener !== 'function') return () => {};
        storageSubscribers.add(listener);
        return () => storageSubscribers.delete(listener);
    }

    function sanitizeLibraryRecord(record) {
        return sanitizePersistentValue(cloneDeep(record || {}));
    }

    function splitLibraryBookRecord(book) {
        const record = sanitizeLibraryRecord(book);
        const text = typeof record.text === 'string' ? record.text : null;
        const chapterIndex = Array.isArray(record.chapterIndex) ? record.chapterIndex : null;
        const chunks = Array.isArray(record.chunks) ? record.chunks : null;
        delete record.text;
        delete record.chapterIndex;
        delete record.chunks;
        return { record, text, chapterIndex, chunks };
    }

    async function loadLibraryBooks() {
        return withStore([STORES.libraryBooks, STORES.libraryBookContent], 'readwrite', async (stores) => {
            const rows = await requestToPromise(stores[STORES.libraryBooks].getAll());
            const books = [];
            rows.forEach((row) => {
                const { record, text, chapterIndex, chunks } = splitLibraryBookRecord(row);
                if (!record.id) return;
                if (text !== null || chapterIndex || chunks) {
                    stores[STORES.libraryBookContent].put({
                        id: record.id,
                        text: text || '',
                        chapterIndex: chapterIndex || [],
                        chunks: chunks || [],
                        updatedAt: Number(record.updatedAt) || Date.now()
                    });
                    stores[STORES.libraryBooks].put(record);
                }
                books.push(record);
            });
            return cloneDeep(books);
        });
    }

    async function saveLibraryBook(book) {
        const { record, text, chapterIndex, chunks } = splitLibraryBookRecord(book);
        if (!record.id) throw new Error('Library book id is required.');
        if (text !== null || chapterIndex || chunks) {
            await withStore([STORES.libraryBooks, STORES.libraryBookContent], 'readwrite', (stores) => {
                stores[STORES.libraryBooks].put(record);
                stores[STORES.libraryBookContent].put({
                    id: record.id,
                    text: text || '',
                    chapterIndex: chapterIndex || [],
                    chunks: chunks || [],
                    updatedAt: Number(record.updatedAt) || Date.now()
                });
            });
        } else {
            await putRecord(STORES.libraryBooks, record);
        }
        return cloneDeep(record);
    }

    async function loadLibraryBookContent(bookId) {
        const record = await getRecord(STORES.libraryBookContent, String(bookId || ''));
        return record ? cloneDeep(record) : null;
    }

    async function deleteLibraryBook(bookId) {
        const safeBookId = String(bookId || '');
        return withStore([STORES.libraryBooks, STORES.libraryBookContent], 'readwrite', (stores) => {
            stores[STORES.libraryBooks].delete(safeBookId);
            stores[STORES.libraryBookContent].delete(safeBookId);
        });
    }

    async function loadLibraryPlaylists() {
        return cloneDeep(await getAllRecords(STORES.libraryPlaylists));
    }

    async function loadLibraryTracks() {
        return cloneDeep(await getAllRecords(STORES.libraryTracks));
    }

    async function saveLibraryPlaylistBundle(playlist, tracks = [], options = {}) {
        const playlistRecord = sanitizeLibraryRecord(playlist);
        if (!playlistRecord.id) throw new Error('Library playlist id is required.');
        const trackRecords = (Array.isArray(tracks) ? tracks : [])
            .map(sanitizeLibraryRecord)
            .filter((track) => track.id);

        await withStore([STORES.libraryPlaylists, STORES.libraryTracks], 'readwrite', (stores) => {
            const playlistStore = stores[STORES.libraryPlaylists];
            const trackStore = stores[STORES.libraryTracks];
            const writeBundle = () => {
                playlistStore.put(playlistRecord);
                trackRecords.forEach((track) => trackStore.put(track));
            };

            if (options.replaceTracks) {
                const keepIds = new Set(trackRecords.map((track) => track.id));
                const existingKeysRequest = trackStore.index('playlistId').getAllKeys(playlistRecord.id);
                existingKeysRequest.onsuccess = () => {
                    (Array.isArray(existingKeysRequest.result) ? existingKeysRequest.result : []).forEach((trackId) => {
                        if (!keepIds.has(trackId)) trackStore.delete(trackId);
                    });
                    writeBundle();
                };
                return;
            }

            writeBundle();
        });

        return {
            playlist: cloneDeep(playlistRecord),
            tracks: cloneDeep(trackRecords)
        };
    }

    async function saveLibraryTrack(track) {
        const record = sanitizeLibraryRecord(track);
        if (!record.id) throw new Error('Library track id is required.');
        await putRecord(STORES.libraryTracks, record);
        return cloneDeep(record);
    }

    async function deleteLibraryTrack(trackId) {
        return deleteRecord(STORES.libraryTracks, String(trackId || ''));
    }

    async function deleteLibraryPlaylist(playlistId) {
        const safePlaylistId = String(playlistId || '');
        if (!safePlaylistId) return;

        return withStore([STORES.libraryPlaylists, STORES.libraryTracks], 'readwrite', async (stores) => {
            const trackRows = await requestToPromise(stores[STORES.libraryTracks].getAll());
            (Array.isArray(trackRows) ? trackRows : []).forEach((track) => {
                if (track && track.playlistId === safePlaylistId) {
                    stores[STORES.libraryTracks].delete(track.id);
                }
            });
            stores[STORES.libraryPlaylists].delete(safePlaylistId);
        });
    }

    async function loadLibraryDailyStats() {
        return cloneDeep(await getAllRecords(STORES.libraryDailyStats));
    }

    async function incrementLibraryDailyStat({ date, kind, itemId, seconds = 0, count = 0 }) {
        const safeDate = String(date || '');
        const safeKind = String(kind || '');
        const safeItemId = String(itemId || 'all');
        const rawSeconds = Number(seconds);
        const rawCount = Number(count);
        const safeSeconds = Number.isFinite(rawSeconds) ? Math.max(0, rawSeconds) : 0;
        const safeCount = Number.isFinite(rawCount) ? Math.max(0, Math.floor(rawCount)) : 0;
        if (!safeDate || !safeKind || (safeSeconds <= 0 && safeCount <= 0)) return null;

        const id = `${safeDate}|${safeKind}|${safeItemId}`;
        return withStore([STORES.libraryDailyStats], 'readwrite', async (stores) => {
            const store = stores[STORES.libraryDailyStats];
            const existing = await requestToPromise(store.get(id));
            const record = {
                id,
                date: safeDate,
                kind: safeKind,
                itemId: safeItemId,
                seconds: Math.max(0, Number(existing?.seconds) || 0) + safeSeconds,
                count: Math.max(0, Number(existing?.count) || 0) + safeCount,
                updatedAt: Date.now()
            };
            store.put(record);
            return cloneDeep(record);
        });
    }

    async function getMeta(key) {
        const record = await getRecord(STORES.meta, key);
        return record ? record.value : null;
    }

    async function setMeta(key, value) {
        return putRecord(STORES.meta, { key, value });
    }

    async function getSetting(key, fallbackValue = null) {
        const record = await getRecord(STORES.settings, key);
        return record ? cloneDeep(record.value) : fallbackValue;
    }

    async function setSetting(key, value) {
        return putRecord(STORES.settings, { key, value: sanitizePersistentValue(cloneDeep(value)) });
    }

    async function assertLargeAssetCapacity(dataUrl) {
        if (typeof dataUrl !== 'string' || dataUrl.length < 350000 || !navigator.storage?.estimate) return;
        const estimate = await navigator.storage.estimate();
        const usage = Math.max(0, Number(estimate?.usage) || 0);
        const quota = Math.max(0, Number(estimate?.quota) || 0);
        if (quota > 0 && usage / quota >= 0.9) {
            throw new DOMException('Storage is above 90%; new large images are temporarily blocked.', 'QuotaExceededError');
        }
    }

    async function saveAssetFromDataUrl(assetId, dataUrl, extra = {}) {
        if (!assetId || !isDataUrl(dataUrl)) return null;
        await assertLargeAssetCapacity(dataUrl);
        revokeRuntimeBlobUrl(assetId);
        const blob = dataUrlToBlob(dataUrl);
        return withStore([STORES.assets], 'readwrite', (stores) => {
            stores[STORES.assets].put({
                id: assetId,
                blob,
                mimeType: blob.type || extra.mimeType || 'application/octet-stream',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                ...extra
            });
        }).then(() => assetId);
    }

    async function getAssetBlob(assetId) {
        if (!assetId) return null;
        const record = await getRecord(STORES.assets, assetId);
        return record && record.blob ? record.blob : null;
    }

    async function getAssetUrl(assetId) {
        if (!assetId) return null;
        const existing = runtimeBlobUrls.get(assetId);
        if (existing) {
            touchRuntimeBlobUrl(assetId);
            return existing;
        }

        const blob = await getAssetBlob(assetId);
        if (!blob) return null;

        const url = URL.createObjectURL(blob);
        runtimeBlobUrls.set(assetId, url);
        touchRuntimeBlobUrl(assetId);
        pruneRuntimeAssetCache();
        return url;
    }

    async function deleteAsset(assetId) {
        if (!assetId) return;
        revokeRuntimeBlobUrl(assetId);
        return deleteRecord(STORES.assets, assetId);
    }

    function getAssetImageMimeType(asset = {}) {
        return String(asset?.blob?.type || asset?.mimeType || '').trim().toLowerCase();
    }

    function isCompressibleImageAsset(asset = {}) {
        const blob = asset?.blob;
        return !!blob
            && !asset?.compressedAt
            && IMAGE_COMPRESSION_MIME_TYPES.has(getAssetImageMimeType(asset))
            && Number(blob.size) >= IMAGE_COMPRESSION_MIN_BYTES;
    }

    function isStoredImageAsset(asset = {}) {
        return getAssetImageMimeType(asset).startsWith('image/');
    }

    function getImageCompressionMaxEdge(asset = {}) {
        const hint = [asset?.ownerType, asset?.field, asset?.id]
            .map((value) => String(value || '').toLowerCase())
            .join(' ');
        if (/(avatar|icon|sticker|face|reference)/.test(hint)) return 1024;
        if (/(cover|banner|background|wallpaper|bg)/.test(hint)) return 1920;
        return 1600;
    }

    function decodeImageBlobForCompression(blob) {
        if (!blob) return Promise.reject(new Error('Image blob is missing.'));
        if (typeof createImageBitmap === 'function') {
            return createImageBitmap(blob).then((bitmap) => ({
                source: bitmap,
                width: Number(bitmap.width) || 0,
                height: Number(bitmap.height) || 0,
                close: () => bitmap.close?.()
            }));
        }
        if (typeof Image !== 'function' || typeof URL?.createObjectURL !== 'function') {
            return Promise.reject(new Error('Image decoding is unavailable.'));
        }
        return new Promise((resolve, reject) => {
            const objectUrl = URL.createObjectURL(blob);
            const image = new Image();
            image.onload = () => resolve({
                source: image,
                width: Number(image.naturalWidth || image.width) || 0,
                height: Number(image.naturalHeight || image.height) || 0,
                close: () => URL.revokeObjectURL(objectUrl)
            });
            image.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Image could not be decoded.'));
            };
            image.src = objectUrl;
        });
    }

    function canvasToBlob(canvas, mimeType, quality) {
        return new Promise((resolve, reject) => {
            if (!canvas || typeof canvas.toBlob !== 'function') {
                reject(new Error('Canvas image encoding is unavailable.'));
                return;
            }
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Image encoding returned no data.'));
            }, mimeType, quality);
        });
    }

    async function createCompressedImageBlob(asset) {
        const decoded = await decodeImageBlobForCompression(asset.blob);
        try {
            if (!decoded.width || !decoded.height) throw new Error('Image dimensions are invalid.');
            const maxEdge = getImageCompressionMaxEdge(asset);
            const scale = Math.min(1, maxEdge / Math.max(decoded.width, decoded.height));
            const width = Math.max(1, Math.round(decoded.width * scale));
            const height = Math.max(1, Math.round(decoded.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext?.('2d', { alpha: true });
            if (!context) throw new Error('Canvas rendering is unavailable.');
            context.drawImage(decoded.source, 0, 0, width, height);
            const blob = await canvasToBlob(canvas, 'image/webp', IMAGE_COMPRESSION_QUALITY);
            const verification = await decodeImageBlobForCompression(blob);
            try {
                if (!verification.width || !verification.height) throw new Error('Compressed image verification failed.');
            } finally {
                verification.close?.();
            }
            return { blob, width, height, originalWidth: decoded.width, originalHeight: decoded.height };
        } finally {
            decoded.close?.();
        }
    }

    async function inspectImageCompression(options = {}) {
        if (!options.skipReady && storageReadyPromise) await storageReadyPromise;
        const assets = await getAllRecords(STORES.assets);
        const images = assets.filter(isStoredImageAsset);
        const eligible = images.filter(isCompressibleImageAsset);
        return {
            scope: 'all',
            profile: 'balanced',
            scanned: images.length,
            eligible: eligible.length,
            skipped: Math.max(0, images.length - eligible.length),
            bytes: eligible.reduce((sum, asset) => sum + Math.max(0, Number(asset?.blob?.size) || 0), 0)
        };
    }

    async function runImageAssetCompression(options = {}) {
        if (!options.skipReady && storageReadyPromise) await storageReadyPromise;
        const progressCallback = typeof options.progressCallback === 'function' ? options.progressCallback : null;
        if (replacementInProgress) throw new Error('Storage replacement is in progress.');
        storageHealthState.status = 'saving';
        storageHealthState.lastError = null;
        notifyStorageSubscribers({ ...storageHealthState, reason: 'image-compression-start' });
        try {
            reportProgress(progressCallback, '正在完成待保存数据...', 2);
            if (!await flushPendingWrites()) throw new Error('Pending writes could not be completed before image compression.');
            const assets = await getAllRecords(STORES.assets);
            const images = assets.filter(isStoredImageAsset);
            const candidates = images.filter(isCompressibleImageAsset);
            const report = {
                scope: 'all',
                profile: 'balanced',
                compressedAt: Date.now(),
                scanned: images.length,
                eligible: candidates.length,
                compressed: 0,
                skipped: Math.max(0, images.length - candidates.length),
                failed: 0,
                bytesBefore: candidates.reduce((sum, asset) => sum + Math.max(0, Number(asset?.blob?.size) || 0), 0),
                bytesAfter: 0,
                bytesFreed: 0
            };

            for (let index = 0; index < candidates.length; index += 1) {
                const asset = candidates[index];
                const originalBytes = Math.max(0, Number(asset?.blob?.size) || 0);
                reportProgress(
                    progressCallback,
                    `正在压缩第 ${index + 1} / ${candidates.length} 张图片...`,
                    candidates.length ? 5 + ((index / candidates.length) * 90) : 95
                );
                try {
                    const compressed = await createCompressedImageBlob(asset);
                    const savedBytes = originalBytes - compressed.blob.size;
                    const savedRatio = originalBytes > 0 ? savedBytes / originalBytes : 0;
                    if (savedBytes < IMAGE_COMPRESSION_MIN_SAVED_BYTES || savedRatio < IMAGE_COMPRESSION_MIN_SAVED_RATIO) {
                        report.skipped += 1;
                        report.bytesAfter += originalBytes;
                        continue;
                    }
                    const digest = await hashBlobSha256(compressed.blob);
                    const replaced = await withStore([STORES.assets], 'readwrite', async (stores) => {
                        const current = await requestToPromise(stores[STORES.assets].get(String(asset.id)));
                        if (
                            !current?.blob
                            || Number(current.blob.size) !== originalBytes
                            || String(current.updatedAt ?? '') !== String(asset.updatedAt ?? '')
                        ) return false;
                        stores[STORES.assets].put({
                            ...current,
                            blob: compressed.blob,
                            mimeType: compressed.blob.type || 'image/webp',
                            width: compressed.width,
                            height: compressed.height,
                            originalWidth: Number(current.originalWidth) || compressed.originalWidth,
                            originalHeight: Number(current.originalHeight) || compressed.originalHeight,
                            originalMimeType: current.originalMimeType || getAssetImageMimeType(current),
                            sha256: digest || current.sha256 || null,
                            compressionProfile: 'balanced',
                            compressedAt: Date.now(),
                            updatedAt: Date.now()
                        });
                        return true;
                    });
                    if (!replaced) {
                        report.skipped += 1;
                        report.bytesAfter += originalBytes;
                        continue;
                    }
                    revokeRuntimeBlobUrl(asset.id);
                    report.compressed += 1;
                    report.bytesAfter += compressed.blob.size;
                } catch (error) {
                    console.warn('[Storage] Image compression skipped an asset:', asset?.id, error);
                    report.failed += 1;
                    report.bytesAfter += originalBytes;
                }
            }
            report.bytesFreed = Math.max(0, report.bytesBefore - report.bytesAfter);
            await setMeta('storage_last_image_compression', report);
            storageHealthState.status = 'saved';
            storageHealthState.lastError = null;
            storageHealthState.lastImageCompression = cloneDeep(report);
            notifyStorageSubscribers({ ...storageHealthState, reason: 'image-compression-complete' });
            reportProgress(progressCallback, '图片压缩完成', 100);
            return cloneDeep(report);
        } catch (error) {
            storageHealthState.status = 'error';
            storageHealthState.lastError = error?.message || String(error);
            notifyStorageSubscribers({ ...storageHealthState, reason: 'image-compression-error' });
            throw error;
        }
    }

    function compressImageAssets(options = {}) {
        if (imageCompressionPromise) return imageCompressionPromise;
        imageCompressionPromise = runImageAssetCompression(options)
            .finally(() => { imageCompressionPromise = null; });
        return imageCompressionPromise;
    }

    async function markAssetOrphaned(assetId) {
        if (!assetId) return false;
        return withStore([STORES.assets], 'readwrite', async (stores) => {
            const current = await requestToPromise(stores[STORES.assets].get(String(assetId)));
            if (!current) return false;
            stores[STORES.assets].put({ ...current, orphanedAt: current.orphanedAt || Date.now() });
            return true;
        });
    }

    function collectAssetReferences(value, result = new Set(), seen = new WeakSet()) {
        if (!value || typeof value !== 'object') return result;
        if (seen.has(value)) return result;
        seen.add(value);
        if (Array.isArray(value)) {
            value.forEach((item) => collectAssetReferences(item, result, seen));
            return result;
        }
        Object.entries(value).forEach(([key, item]) => {
            if ((key === 'assetId' || key.endsWith('AssetId')) && typeof item === 'string' && item) result.add(item);
            else collectAssetReferences(item, result, seen);
        });
        return result;
    }

    async function pruneOrphanedAssets(options = {}) {
        const graceMs = Math.max(0, Number(options.graceMs) || 7 * 24 * 60 * 60 * 1000);
        const now = Date.now();
        const referenceStores = Object.values(STORES).filter((name) => ![
            STORES.assets,
            STORES.storageCheckpoints,
            STORES.meta
        ].includes(name));
        const rowsByStore = await Promise.all(referenceStores.map((name) => getAllRecords(name)));
        const references = new Set();
        rowsByStore.forEach((rows) => collectAssetReferences(rows, references));
        const coverReference = await getMeta(META_KEYS.imMomentsCoverAssetId);
        if (typeof coverReference === 'string') references.add(coverReference);
        const assets = await getAllRecords(STORES.assets);
        const removable = assets.filter((asset) => {
            return asset?.id && asset.orphanedAt && now - Number(asset.orphanedAt) >= graceMs && !references.has(String(asset.id));
        });
        if (removable.length > 0) {
            await withStore([STORES.assets], 'readwrite', (stores) => {
                removable.forEach((asset) => stores[STORES.assets].delete(asset.id));
            });
            removable.forEach((asset) => revokeRuntimeBlobUrl(asset.id));
        }
        return removable.length;
    }

    function resolveMessageOrder(message, fallbackIndex = 0) {
        if (message && Number.isFinite(Number(message.__messageOrder))) {
            return Number(message.__messageOrder);
        }
        return Number.isFinite(Number(fallbackIndex)) ? Number(fallbackIndex) : 0;
    }

    function normalizeMessageRecord(friendId, msg, index) {
        const safe = msg || {};
        const resolvedOrder = resolveMessageOrder(safe, index);
        return {
            id: safe.id || `${String(friendId)}_msg_${safe.timestamp || Date.now()}_${resolvedOrder}`,
            friendId: String(friendId),
            order: resolvedOrder,
            role: safe.role || 'assistant',
            type: safe.type || 'text',
            noticeKind: typeof safe.noticeKind === 'string' ? safe.noticeKind : '',
            actorRole: safe.actorRole === 'user' || safe.actorRole === 'assistant' ? safe.actorRole : '',
            actorName: typeof safe.actorName === 'string' ? safe.actorName : '',
            content: typeof safe.content === 'string' ? safe.content : '',
            contentAssetId: typeof safe.contentAssetId === 'string' ? safe.contentAssetId : '',
            text: typeof safe.text === 'string' ? safe.text : '',
            transcript: typeof safe.transcript === 'string' ? safe.transcript : '',
            stickerCategory: typeof safe.stickerCategory === 'string' ? safe.stickerCategory : '',
            stickerName: typeof safe.stickerName === 'string' ? safe.stickerName : '',
            stickerUrl: typeof safe.stickerUrl === 'string' ? safe.stickerUrl : '',
            stickerAssetId: typeof safe.stickerAssetId === 'string' ? safe.stickerAssetId : '',
            translation: typeof safe.translation === 'string' ? safe.translation : '',
            showTranslation: !!safe.showTranslation,
            replyTo: safe.replyTo || null,
            offlineMode: !!safe.offlineMode,
            offlineScene: typeof safe.offlineScene === 'string' ? safe.offlineScene : '',
            offlineAction: typeof safe.offlineAction === 'string' ? safe.offlineAction : '',
            offlineSessionId: typeof safe.offlineSessionId === 'string' ? safe.offlineSessionId : '',
            endedAt: Number(safe.endedAt) || 0,
            dateText: typeof safe.dateText === 'string' ? safe.dateText : '',
            title: typeof safe.title === 'string' ? safe.title : '',
            summary: typeof safe.summary === 'string' ? safe.summary : '',
            rawSummary: typeof safe.rawSummary === 'string' ? safe.rawSummary : '',
            timestamp: Number(safe.timestamp) || Date.now(),
            amount: safe.amount,
            description: safe.description,
            targetName: safe.targetName,
            payKind: safe.payKind,
            speaker: safe.speaker,
            senderName: safe.senderName,
            senderAvatarUrl: safe.senderAvatarUrl,
            senderAvatarAssetId: typeof safe.senderAvatarAssetId === 'string' ? safe.senderAvatarAssetId : '',
            userIdentity: safe.userIdentity && typeof safe.userIdentity === 'object'
                ? {
                    accountId: String(safe.userIdentity.accountId || ''),
                    name: String(safe.userIdentity.name || ''),
                    avatarUrl: String(safe.userIdentity.avatarUrl || '')
                }
                : null,
            packetMsg: safe.packetMsg,
            claims: safe.claims,
            packetCount: safe.packetCount,
            packetType: safe.packetType,
            allocations: safe.allocations,
            status: safe.status,
            duration: safe.duration,
            callMessages: safe.callMessages,
            isSelf: safe.isSelf,
            statusText: safe.statusText,
            senderId: safe.senderId,
            apiRunId: safe.apiRunId,
            cotSummary: typeof safe.cotSummary === 'string' ? safe.cotSummary.slice(0, 4000) : '',
            rollbackSourceMessage: safe.rollbackSourceMessage || null,
            paymentAction: safe.paymentAction,
            payDirection: safe.payDirection,
            payerName: safe.payerName,
            payeeName: safe.payeeName,
            receiverName: safe.receiverName,
            cardTitle: safe.cardTitle,
            payStatus: safe.payStatus,
            claimed: !!safe.claimed,
            imageSource: safe.imageSource,
            imageProvider: typeof safe.imageProvider === 'string' ? safe.imageProvider : '',
            imageModel: typeof safe.imageModel === 'string' ? safe.imageModel : '',
            imageSize: typeof safe.imageSize === 'string' ? safe.imageSize : '',
            faceReferenceUsed: !!safe.faceReferenceUsed,
            imageGenerationPrompt: typeof safe.imageGenerationPrompt === 'string'
                ? safe.imageGenerationPrompt.slice(0, 16000)
                : '',
            imageGenerationConfig: safe.imageGenerationConfig && typeof safe.imageGenerationConfig === 'object'
                ? {
                    charAppearance: String(safe.imageGenerationConfig.charAppearance || '').slice(0, 4000),
                    userAppearance: String(safe.imageGenerationConfig.userAppearance || '').slice(0, 4000),
                    artistPrompt: String(safe.imageGenerationConfig.artistPrompt || '').slice(0, 4000),
                    negativePrompt: String(safe.imageGenerationConfig.negativePrompt || '').slice(0, 4000),
                    useReferenceFace: safe.imageGenerationConfig.useReferenceFace === true
                }
                : null,
            imageRerollCount: Math.max(0, Number(safe.imageRerollCount) || 0),
            imageRerolledAt: Math.max(0, Number(safe.imageRerolledAt) || 0),
            fakeLinkData: safe.fakeLinkData && typeof safe.fakeLinkData === 'object'
                ? sanitizePersistentValue(cloneDeep(safe.fakeLinkData))
                : null,
            record: safe.record && typeof safe.record === 'object'
                ? sanitizePersistentValue(cloneDeep(safe.record))
                : null,
            packetId: safe.packetId,
            totalAmount: safe.totalAmount,
            claimRecords: safe.claimRecords,
            claimedMemberIds: safe.claimedMemberIds,
            speakerMemberId: safe.speakerMemberId,
            pollId: typeof safe.pollId === 'string' ? safe.pollId : '',
            pollQuestion: typeof safe.pollQuestion === 'string' ? safe.pollQuestion : '',
            pollOptions: Array.isArray(safe.pollOptions)
                ? sanitizePersistentValue(cloneDeep(safe.pollOptions))
                : [],
            pollVotes: Array.isArray(safe.pollVotes)
                ? sanitizePersistentValue(cloneDeep(safe.pollVotes))
                : [],
            pollStatus: ['idle', 'pending', 'completed', 'error'].includes(safe.pollStatus) ? safe.pollStatus : '',
            pollError: typeof safe.pollError === 'string' ? safe.pollError : '',
            payload: safe.payload || null
        };
    }

    function recoverLegacyGroupPollFields(row) {
        if (!row || row.type !== 'group_poll') return null;
        const content = String(row.content || '');
        const questionMatch = content.match(/^\[群投票：([^\n\]]+)/);
        const optionsMatch = content.match(/\n选项：([^\n\]]+)/);
        if (!questionMatch || !optionsMatch) return null;
        const optionTexts = optionsMatch[1].split(/\s*\/\s*/).map(text => text.trim()).filter(Boolean);
        if (optionTexts.length < 2) return null;
        const safeMessageId = String(row.id || 'legacy').replace(/[^a-zA-Z0-9_-]/g, '-');
        const pollOptions = optionTexts.map((text, index) => ({
            id: `legacy-${safeMessageId}-option-${index + 1}`,
            text
        }));
        const optionIdByText = new Map(pollOptions.map(option => [option.text, option.id]));
        const currentUserName = String(window.userState?.name || 'User');
        const votesMatch = content.match(/\n当前投票：([^\n\]]+)/);
        const pollVotes = !votesMatch || votesMatch[1].trim() === '暂无'
            ? []
            : votesMatch[1].split('；').map((entry, index) => {
                const parts = entry.split('→').map(text => text.trim());
                const optionId = optionIdByText.get(parts[1]);
                if (!parts[0] || !optionId) return null;
                const isUser = parts[0] === currentUserName || parts[0] === 'User';
                return {
                    voterId: isUser ? '__user__' : `legacy-${safeMessageId}-voter-${index + 1}`,
                    voterName: parts[0],
                    optionId,
                    voterType: isUser ? 'user' : 'member'
                };
            }).filter(Boolean);
        return {
            pollId: `legacy-${safeMessageId}`,
            pollQuestion: questionMatch[1].trim(),
            pollOptions,
            pollVotes,
            pollStatus: 'completed',
            pollError: ''
        };
    }

    function denormalizeMessageRecord(row) {
        const inferredRecallActorRole = row.noticeKind === 'message_recalled'
            ? (String(row.content || '').trim().startsWith('你撤回了') ? 'user' : 'assistant')
            : '';
        const legacyGroupPoll = recoverLegacyGroupPollFields(row);
        return {
            id: row.id,
            role: row.role,
            type: row.type,
            noticeKind: row.noticeKind || '',
            actorRole: row.actorRole === 'user' || row.actorRole === 'assistant'
                ? row.actorRole
                : inferredRecallActorRole,
            actorName: row.actorName || '',
            content: row.content,
            contentAssetId: row.contentAssetId || '',
            text: row.text,
            transcript: row.transcript,
            stickerCategory: row.stickerCategory,
            stickerName: row.stickerName,
            stickerUrl: row.stickerUrl,
            stickerAssetId: row.stickerAssetId || '',
            translation: row.translation,
            showTranslation: row.showTranslation,
            replyTo: row.replyTo,
            offlineMode: !!row.offlineMode,
            offlineScene: row.offlineScene || '',
            offlineAction: row.offlineAction || '',
            offlineSessionId: row.offlineSessionId || '',
            endedAt: Number(row.endedAt) || 0,
            dateText: row.dateText || '',
            title: row.title || '',
            summary: row.summary || '',
            rawSummary: row.rawSummary || '',
            timestamp: row.timestamp,
            amount: row.amount,
            description: row.description,
            targetName: row.targetName,
            payKind: row.payKind,
            speaker: row.speaker,
            senderName: row.senderName,
            senderAvatarUrl: row.senderAvatarUrl,
            senderAvatarAssetId: row.senderAvatarAssetId || '',
            userIdentity: row.userIdentity && typeof row.userIdentity === 'object'
                ? {
                    accountId: String(row.userIdentity.accountId || ''),
                    name: String(row.userIdentity.name || ''),
                    avatarUrl: String(row.userIdentity.avatarUrl || '')
                }
                : null,
            packetMsg: row.packetMsg,
            claims: row.claims,
            packetCount: row.packetCount,
            packetType: row.packetType,
            allocations: row.allocations,
            status: row.status,
            duration: row.duration,
            callMessages: row.callMessages,
            isSelf: row.isSelf,
            statusText: row.statusText,
            senderId: row.senderId,
            apiRunId: row.apiRunId,
            cotSummary: typeof row.cotSummary === 'string' ? row.cotSummary : '',
            rollbackSourceMessage: row.rollbackSourceMessage || null,
            paymentAction: row.paymentAction,
            payDirection: row.payDirection,
            payerName: row.payerName,
            payeeName: row.payeeName,
            receiverName: row.receiverName,
            cardTitle: row.cardTitle,
            payStatus: row.payStatus,
            claimed: !!row.claimed,
            imageSource: row.imageSource,
            imageProvider: row.imageProvider || '',
            imageModel: row.imageModel || '',
            imageSize: row.imageSize || '',
            faceReferenceUsed: !!row.faceReferenceUsed,
            imageGenerationPrompt: row.imageGenerationPrompt || '',
            imageGenerationConfig: row.imageGenerationConfig && typeof row.imageGenerationConfig === 'object'
                ? cloneDeep(row.imageGenerationConfig)
                : null,
            imageRerollCount: Math.max(0, Number(row.imageRerollCount) || 0),
            imageRerolledAt: Math.max(0, Number(row.imageRerolledAt) || 0),
            fakeLinkData: row.fakeLinkData && typeof row.fakeLinkData === 'object'
                ? cloneDeep(row.fakeLinkData)
                : null,
            record: row.record && typeof row.record === 'object'
                ? cloneDeep(row.record)
                : null,
            packetId: row.packetId,
            totalAmount: row.totalAmount,
            claimRecords: row.claimRecords,
            claimedMemberIds: row.claimedMemberIds,
            speakerMemberId: row.speakerMemberId,
            pollId: row.pollId || legacyGroupPoll?.pollId || '',
            pollQuestion: row.pollQuestion || legacyGroupPoll?.pollQuestion || '',
            pollOptions: Array.isArray(row.pollOptions) && row.pollOptions.length > 0
                ? cloneDeep(row.pollOptions)
                : (legacyGroupPoll?.pollOptions || []),
            pollVotes: Array.isArray(row.pollVotes) && row.pollVotes.length > 0
                ? cloneDeep(row.pollVotes)
                : (legacyGroupPoll?.pollVotes || []),
            pollStatus: ['idle', 'pending', 'completed', 'error'].includes(row.pollStatus)
                ? row.pollStatus
                : (legacyGroupPoll?.pollStatus || ''),
            pollError: row.pollError || legacyGroupPoll?.pollError || '',
            payload: row.payload,
            __messageOrder: Number(row.order) || 0
        };
    }

    const MESSAGE_ASSET_FIELDS = [
        ['content', 'contentAssetId'],
        ['stickerUrl', 'stickerAssetId'],
        ['senderAvatarUrl', 'senderAvatarAssetId']
    ];

    async function prepareMessageForStorage(friendId, message, index = 0) {
        const next = cloneDeep(message || {});
        const messageId = String(next.id || `${friendId}_msg_${next.timestamp || Date.now()}_${index}`);
        next.id = messageId;
        for (const [urlField, assetField] of MESSAGE_ASSET_FIELDS) {
            const value = next[urlField];
            if (isDataUrl(value)) {
                next[assetField] = await saveContentAddressedAsset(value, {
                    fallbackId: buildAssetId('im_message', messageId, urlField),
                    ownerType: 'im_message',
                    ownerId: messageId,
                    field: urlField
                });
                next[urlField] = '';
            } else if (next[assetField] && isBlobUrl(value)) {
                next[urlField] = '';
            }
        }
        return next;
    }

    async function hydrateMessageAssets(message) {
        const next = { ...(message || {}) };
        for (const [urlField, assetField] of MESSAGE_ASSET_FIELDS) {
            if (next[assetField] && !next[urlField]) next[urlField] = await getAssetUrl(next[assetField]);
        }
        return next;
    }

    function buildAssetId(prefix, ownerId, fieldName) {
        return `${prefix}_${String(ownerId)}_${String(fieldName)}`;
    }

    const FRIEND_ASSET_FIELDS = [
        ['avatarUrl', 'avatarAssetId'],
        ['chatBg', 'chatBgAssetId'],
        ['momentsCover', 'momentsCoverAssetId'],
        ['imageFaceReferenceUrl', 'imageFaceReferenceAssetId']
    ];

    async function persistFriendAssets(friend) {
        if (!friend) return friend;
        const result = cloneDeep(friend);

        for (const [urlField, assetField] of FRIEND_ASSET_FIELDS) {
            const currentValue = result[urlField];
            if (isDataUrl(currentValue)) {
                const assetId = await saveContentAddressedAsset(currentValue, {
                    fallbackId: result[assetField] || buildAssetId('friend', result.id, urlField),
                    ownerType: 'im_friend',
                    ownerId: String(result.id),
                    field: urlField
                });
                result[assetField] = assetId;
                result[urlField] = null;
                continue;
            }

            if (result[assetField] && isBlobUrl(currentValue)) {
                result[urlField] = null;
            }
        }

        if (Array.isArray(result.members)) {
            for (let index = 0; index < result.members.length; index += 1) {
                const member = result.members[index];
                if (!member || typeof member !== 'object') continue;
                if (isDataUrl(member.avatarUrl)) {
                    member.avatarAssetId = await saveContentAddressedAsset(member.avatarUrl, {
                        fallbackId: buildAssetId('friend_member', result.id, member.id ?? index),
                        ownerType: 'im_group_member',
                        ownerId: String(member.id ?? index),
                        field: 'avatarUrl'
                    });
                    member.avatarUrl = null;
                } else if (member.avatarAssetId && isBlobUrl(member.avatarUrl)) {
                    member.avatarUrl = null;
                }
            }
        }

        return result;
    }

    async function hydrateFriendAssets(friend) {
        if (!friend) return friend;
        const result = cloneDeep(friend);
        const mappings = [
            ['avatarAssetId', 'avatarUrl'],
            ['chatBgAssetId', 'chatBg'],
            ['momentsCoverAssetId', 'momentsCover'],
            ['imageFaceReferenceAssetId', 'imageFaceReferenceUrl']
        ];

        for (const [assetField, urlField] of mappings) {
            if (result[assetField] && (!result[urlField] || isBlobUrl(result[urlField]))) {
                result[urlField] = await getAssetUrl(result[assetField]);
            }
        }

        if (Array.isArray(result.members)) {
            for (const member of result.members) {
                if (member?.avatarAssetId && !member.avatarUrl) member.avatarUrl = await getAssetUrl(member.avatarAssetId);
            }
        }

        return result;
    }

    function collectFriendAssetIds(friend) {
        if (!friend) return [];
        const ids = FRIEND_ASSET_FIELDS
            .map(([, assetField]) => friend[assetField] ? String(friend[assetField]) : null)
            .filter(Boolean);
        (Array.isArray(friend.members) ? friend.members : []).forEach((member) => {
            if (member?.avatarAssetId) ids.push(String(member.avatarAssetId));
        });
        return Array.from(new Set(ids));
    }

    function getExpectedFriendAssetIds(friend) {
        if (!friend || friend.id == null) return [];
        const ids = FRIEND_ASSET_FIELDS
            .map(([urlField, assetField]) => {
                if (friend[assetField]) return String(friend[assetField]);
                if (isDataUrl(friend[urlField])) return buildAssetId('friend', friend.id, urlField);
                return null;
            })
            .filter(Boolean);
        (Array.isArray(friend.members) ? friend.members : []).forEach((member, index) => {
            if (member?.avatarAssetId) ids.push(String(member.avatarAssetId));
            else if (isDataUrl(member?.avatarUrl)) ids.push(buildAssetId('friend_member', friend.id, member.id ?? index));
        });
        return Array.from(new Set(ids));
    }

    async function getFriendMetaById(friendId) {
        if (friendId == null) return null;
        return getRecord(STORES.imFriends, String(friendId));
    }

    async function deleteFriendMetaById(friendId) {
        return deleteRecord(STORES.imFriends, String(friendId));
    }

    async function cleanupRemovedFriendAssets(previousFriend, nextFriend, retainedAssetIds = new Set()) {
        if (!previousFriend) return;
        const nextIds = new Set(getExpectedFriendAssetIds(nextFriend));
        for (const assetId of collectFriendAssetIds(previousFriend)) {
            if (nextIds.has(assetId) || retainedAssetIds.has(assetId)) continue;
            await markAssetOrphaned(assetId);
        }
    }

    async function buildFriendMessageSummary(messages) {
        const list = Array.isArray(messages) ? messages : [];
        const lastMessage = list.length > 0 ? list[list.length - 1] : null;

        let previewText = '';
        if (lastMessage) {
            if (lastMessage.type === 'image') {
                previewText = lastMessage.text || '[图片]';
            } else if (lastMessage.type === 'voice_message') {
                previewText = `[语音] ${lastMessage.transcript || lastMessage.text || ''}`.trim();
            } else if (lastMessage.type === 'sticker') {
                previewText = `[表情] ${lastMessage.stickerName || lastMessage.text || ''}`.trim();
            } else if (lastMessage.type === 'moment_forward') {
                previewText = '[朋友圈]';
            } else if (lastMessage.type === 'pay_transfer') {
                previewText = `[转账] ${lastMessage.description || ''}`.trim();
            } else if (lastMessage.type === 'group_red_packet') {
                previewText = `[群红包] ${lastMessage.description || ''}`.trim();
            } else if (lastMessage.type === 'group_poll') {
                previewText = `[群投票] ${lastMessage.pollQuestion || ''}`.trim();
            } else if (lastMessage.type === 'system_notice') {
                if (lastMessage.noticeKind === 'group_left') {
                    previewText = '你已退出群聊';
                } else if (lastMessage.noticeKind === 'group_rejoined') {
                    previewText = '你重新进入群聊';
                } else if (lastMessage.noticeKind === 'narration') {
                    previewText = `[旁白] ${lastMessage.content || lastMessage.text || ''}`.trim();
                } else {
                    previewText = lastMessage.content || lastMessage.text || '';
                }
            } else {
                previewText = lastMessage.content || lastMessage.text || '';
            }
        }

        return {
            lastMessagePreview: previewText || '',
            lastMessageTimestamp: Number(lastMessage?.timestamp) || 0,
            messageCount: list.length
        };
    }

    function resolveFriendMessageSummary(friend, previousMeta = null) {
        if (!friend || friend.messagesLoaded !== false) {
            return buildFriendMessageSummary(friend ? friend.messages : []);
        }

        const preview = typeof friend.lastMessagePreview === 'string'
            ? friend.lastMessagePreview
            : typeof previousMeta?.lastMessagePreview === 'string'
                ? previousMeta.lastMessagePreview
                : '';

        const timestampSource = friend.lastMessageTimestamp != null
            ? friend.lastMessageTimestamp
            : previousMeta?.lastMessageTimestamp;

        const countSource = friend.messageCount != null
            ? friend.messageCount
            : previousMeta?.messageCount;

        return {
            lastMessagePreview: preview,
            lastMessageTimestamp: Number(timestampSource) || 0,
            messageCount: Number(countSource) || 0
        };
    }

    function normalizeChatSummary(friendId, source = {}) {
        return {
            friendId: String(friendId),
            lastMessagePreview: typeof source.lastMessagePreview === 'string' ? source.lastMessagePreview : '',
            lastMessageTimestamp: Math.max(0, Number(source.lastMessageTimestamp) || 0),
            messageCount: Math.max(0, Number(source.messageCount) || 0),
            unreadCount: Math.max(0, Number(source.unreadCount) || 0),
            updatedAt: Date.now()
        };
    }

    async function saveChatSummary(friendId, source = {}) {
        const record = normalizeChatSummary(friendId, source);
        await putRecord(STORES.imChatSummaries, record);
        return record;
    }

    async function saveFriendMeta(friend, options = {}) {
        if (!friend || friend.id == null) return false;

        const previousMeta = Object.prototype.hasOwnProperty.call(options, 'previousMeta')
            ? options.previousMeta
            : await getFriendMetaById(friend.id);

        const prepared = await persistFriendAssets(friend);
        const meta = { ...prepared };
        const messageSummary = await resolveFriendMessageSummary(prepared, previousMeta);

        delete meta.messages;

        meta.id = String(meta.id);
        meta.updatedAt = Date.now();
        const summary = normalizeChatSummary(meta.id, {
            ...messageSummary,
            unreadCount: prepared.unreadCount
        });
        delete meta.lastMessagePreview;
        delete meta.lastMessageTimestamp;
        delete meta.messageCount;
        delete meta.unreadCount;

        await withStore([STORES.imFriends, STORES.imChatSummaries], 'readwrite', (stores) => {
            stores[STORES.imFriends].put(sanitizePersistentValue(meta));
            stores[STORES.imChatSummaries].put(summary);
        });
        return true;
    }

    async function saveFriendMessage(friendId, message, order = 0) {
        const safeFriendId = String(friendId);
        const preparedMessage = await prepareMessageForStorage(safeFriendId, message, order);
        const normalized = normalizeMessageRecord(safeFriendId, {
            ...preparedMessage,
            __messageOrder: resolveMessageOrder(message, order)
        }, order);

        await putRecord(STORES.imMessages, normalized);
        return normalized;
    }

    async function commitFriendMessage(friend, message, order = 0) {
        if (!friend || friend.id == null) throw new Error('Friend is required for atomic message commit.');
        const safeFriendId = String(friend.id);
        const preparedMessage = await prepareMessageForStorage(safeFriendId, message, order);
        const normalized = normalizeMessageRecord(safeFriendId, {
            ...preparedMessage,
            __messageOrder: resolveMessageOrder(message, order)
        }, order);
        const messageSummary = await buildFriendMessageSummary(friend.messages || []);
        const summary = normalizeChatSummary(safeFriendId, {
            ...messageSummary,
            unreadCount: friend.unreadCount
        });
        await runWithQuotaRetry(() => withStore([STORES.imMessages, STORES.imChatSummaries], 'readwrite', (stores) => {
            stores[STORES.imMessages].put(normalized);
            stores[STORES.imChatSummaries].put(summary);
        }));
        storageHealthState.lastCommitAt = Date.now();
        storageHealthState.lastError = null;
        notifyStorageSubscribers({ ...storageHealthState, reason: 'imessage-message-commit', friendId: safeFriendId });
        return normalized;
    }

    async function deleteFriendMessage(messageId) {
        if (!messageId) return false;
        await deleteRecord(STORES.imMessages, messageId);
        return true;
    }

    async function deleteFriendMessages(messageIds) {
        const safeIds = Array.isArray(messageIds) ? messageIds.map((id) => String(id)).filter(Boolean) : [];
        if (safeIds.length === 0) return true;

        await withStore([STORES.imMessages], 'readwrite', (stores) => {
            safeIds.forEach((messageId) => stores[STORES.imMessages].delete(messageId));
        });
        return true;
    }

    async function saveFriendMessages(friendId, messages) {
        const safeFriendId = String(friendId);
        const list = Array.isArray(messages) ? messages : [];
        const preparedList = await Promise.all(list.map((msg, idx) => prepareMessageForStorage(safeFriendId, msg, idx)));
        const normalizedList = preparedList.map((msg, idx) => normalizeMessageRecord(safeFriendId, msg, idx));
        const nextMessageIds = new Set(normalizedList.map((msg) => String(msg.id)));

        return withStore([STORES.imMessages, STORES.imChatSummaries], 'readwrite', async (stores) => {
            const index = stores[STORES.imMessages].index('friendId');
            const range = IDBKeyRange.only(safeFriendId);
            const existingKeys = await requestToPromise(index.getAllKeys(range));
            const existingSummary = await requestToPromise(stores[STORES.imChatSummaries].get(safeFriendId));

            existingKeys.forEach((messageId) => {
                if (!nextMessageIds.has(String(messageId))) {
                    stores[STORES.imMessages].delete(messageId);
                }
            });

            normalizedList.forEach((msg) => stores[STORES.imMessages].put(msg));
            const messageSummary = await buildFriendMessageSummary(normalizedList);
            stores[STORES.imChatSummaries].put(normalizeChatSummary(safeFriendId, {
                ...messageSummary,
                unreadCount: existingSummary?.unreadCount
            }));
        });
    }

    async function replaceFriendMessages(friendId, messages) {
        return saveFriendMessages(friendId, messages);
    }

    async function saveFriend(friend, options = {}) {
        if (!friend || friend.id == null) return false;
        const previousFriend = await getFriendMetaById(friend.id);
        const retainedAssetIds = new Set(getExpectedFriendAssetIds(friend));
        const shouldPersistMessages = options.skipMessages !== true && friend.messagesLoaded !== false;

        await saveFriendMeta(friend, { previousMeta: previousFriend });

        if (shouldPersistMessages) {
            await saveFriendMessages(friend.id, friend.messages || []);
        }

        await cleanupRemovedFriendAssets(previousFriend, friend, retainedAssetIds);
        return true;
    }

    async function saveFriendMetaOnly(friend) {
        return saveFriend(friend, { skipMessages: true });
    }

    async function patchFriendMeta(friendId, patch = {}) {
        if (friendId == null) return false;
        const safeFriendId = String(friendId);
        const safePatch = patch && typeof patch === 'object' ? cloneDeep(patch) : {};
        delete safePatch.id;
        delete safePatch.messages;
        const summaryPatch = {};
        ['lastMessagePreview', 'lastMessageTimestamp', 'messageCount', 'unreadCount'].forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(safePatch, key)) summaryPatch[key] = safePatch[key];
            delete safePatch[key];
        });
        const now = Date.now();
        const refreshAssetIds = [];
        for (const [urlField, assetField] of FRIEND_ASSET_FIELDS) {
            if (!isDataUrl(safePatch[urlField])) continue;
            const assetId = await saveContentAddressedAsset(safePatch[urlField], {
                fallbackId: safePatch[assetField] || buildAssetId('friend', safeFriendId, urlField),
                ownerType: 'im_friend',
                ownerId: safeFriendId,
                field: urlField
            });
            safePatch[assetField] = assetId;
            safePatch[urlField] = null;
            refreshAssetIds.push(assetId);
        }

        await withStore([STORES.imFriends, STORES.imChatSummaries, STORES.assets], 'readwrite', async (stores) => {
            const current = await requestToPromise(stores[STORES.imFriends].get(safeFriendId));
            if (!current) throw new Error(`Friend ${safeFriendId} does not exist.`);
            const currentSummary = await requestToPromise(stores[STORES.imChatSummaries].get(safeFriendId));
            const next = { ...current, ...safePatch, id: safeFriendId };

            for (const [urlField, assetField] of FRIEND_ASSET_FIELDS) {
                if (!Object.prototype.hasOwnProperty.call(safePatch, urlField)) continue;
                const incoming = safePatch[urlField];
                if (isDataUrl(incoming)) {
                    const assetId = String(safePatch[assetField] || current[assetField] || buildAssetId('friend', safeFriendId, urlField));
                    const blob = dataUrlToBlob(incoming);
                    stores[STORES.assets].put({
                        id: assetId,
                        blob,
                        mimeType: blob.type || 'application/octet-stream',
                        ownerType: 'im_friend',
                        ownerId: safeFriendId,
                        field: urlField,
                        updatedAt: now
                    });
                    next[assetField] = assetId;
                    next[urlField] = null;
                    refreshAssetIds.push(assetId);
                } else if (!incoming && safePatch[assetField]) {
                    next[urlField] = null;
                    next[assetField] = safePatch[assetField];
                } else if (!incoming) {
                    next[urlField] = null;
                    next[assetField] = null;
                } else if (isBlobUrl(incoming) && current[assetField]) {
                    next[urlField] = null;
                    next[assetField] = current[assetField];
                }
            }

            next.updatedAt = now;
            next.revision = Math.max(0, Number(current.revision) || 0) + 1;
            const sanitized = sanitizePersistentValue(next);
            stores[STORES.imFriends].put(sanitized);
            if (Object.keys(summaryPatch).length > 0) {
                stores[STORES.imChatSummaries].put(normalizeChatSummary(safeFriendId, {
                    ...(currentSummary || {}),
                    ...summaryPatch
                }));
            }
        });

        refreshAssetIds.forEach((assetId) => revokeRuntimeBlobUrl(assetId));
        storageHealthState.lastCommitAt = now;
        storageHealthState.lastError = null;
        notifyStorageSubscribers({ ...storageHealthState, reason: 'imessage-friend-patch', friendId: safeFriendId });
        return true;
    }

    async function deleteFriend(friendId) {
        if (friendId == null) return false;
        const previousFriend = await getFriendMetaById(friendId);
        await saveFriendMessages(friendId, []);
        await withStore([STORES.imFriends, STORES.imChatSummaries], 'readwrite', (stores) => {
            stores[STORES.imFriends].delete(String(friendId));
            stores[STORES.imChatSummaries].delete(String(friendId));
        });
        await cleanupRemovedFriendAssets(previousFriend, null);
        return true;
    }

    async function loadMessagesByFriendId(friendId) {
        const safeFriendId = String(friendId);
        return withStore([STORES.imMessages], 'readonly', async (stores) => {
            const messageStore = stores[STORES.imMessages];

            if (hasStoreIndex(messageStore, 'friendId_order')) {
                const orderIndex = messageStore.index('friendId_order');
                const orderRange = IDBKeyRange.bound(
                    [safeFriendId, Number.MIN_SAFE_INTEGER],
                    [safeFriendId, Number.MAX_SAFE_INTEGER]
                );
                const orderedRows = await requestToPromise(orderIndex.getAll(orderRange));
                return Promise.all(orderedRows.map((row) => hydrateMessageAssets(denormalizeMessageRecord(row))));
            }

            const timeIndex = messageStore.index('friendId_timestamp');
            const timeRange = IDBKeyRange.bound([safeFriendId, 0], [safeFriendId, Number.MAX_SAFE_INTEGER]);
            const rows = await requestToPromise(timeIndex.getAll(timeRange));
            const ordered = rows
                .sort((a, b) => {
                    if ((a.timestamp || 0) !== (b.timestamp || 0)) return (a.timestamp || 0) - (b.timestamp || 0);
                    return (a.order || 0) - (b.order || 0);
                })
                .map(denormalizeMessageRecord);
            return Promise.all(ordered.map((message) => hydrateMessageAssets(message)));
        });
    }

    async function saveFriends(friends) {
        const safeFriends = Array.isArray(friends) ? friends.filter((friend) => friend && friend.id != null) : [];
        const nextFriendIds = new Set(safeFriends.map((friend) => String(friend.id)));
        const retainedAssetIds = new Set();
        safeFriends.forEach((friend) => {
            getExpectedFriendAssetIds(friend).forEach((assetId) => retainedAssetIds.add(assetId));
        });

        const existingFriends = await getAllRecords(STORES.imFriends);
        const existingById = new Map(existingFriends.map((friend) => [String(friend.id), friend]));

        for (const existingFriend of existingFriends) {
            const friendId = String(existingFriend.id);
            if (!nextFriendIds.has(friendId)) {
                await deleteFriend(friendId);
            }
        }

        for (const friend of safeFriends) {
            const previousFriend = existingById.get(String(friend.id)) || null;
            await saveFriendMeta(friend, { previousMeta: previousFriend });
            if (friend.messagesLoaded !== false) {
                await saveFriendMessages(friend.id, friend.messages || []);
            }
            await cleanupRemovedFriendAssets(previousFriend, friend, retainedAssetIds);
        }

        return true;
    }

    async function loadFriends() {
        const [allFriends, summaries] = await Promise.all([
            getAllRecords(STORES.imFriends),
            getAllRecords(STORES.imChatSummaries)
        ]);
        const summariesByFriendId = new Map(summaries.map((item) => [String(item.friendId), item]));
        const hydrated = await Promise.all(
            allFriends.map(async (friend) => {
                const next = await hydrateFriendAssets(friend);
                const summary = summariesByFriendId.get(String(friend.id)) || friend;
                next.messages = [];
                next.messagesLoaded = false;
                next.lastMessagePreview = typeof summary.lastMessagePreview === 'string' ? summary.lastMessagePreview : '';
                next.lastMessageTimestamp = Number(summary.lastMessageTimestamp) || 0;
                next.messageCount = Number(summary.messageCount) || 0;
                next.unreadCount = Math.max(0, Number(summary.unreadCount) || 0);
                return next;
            })
        );

        hydrated.sort((a, b) => {
            const aPinned = a.isPinned ? 1 : 0;
            const bPinned = b.isPinned ? 1 : 0;
            if (aPinned !== bPinned) return bPinned - aPinned;
            const aTime = Number(a.lastMessageTimestamp) || 0;
            const bTime = Number(b.lastMessageTimestamp) || 0;
            if (aTime !== bTime) return bTime - aTime;
            return String(a.id).localeCompare(String(b.id));
        });

        return hydrated;
    }

    async function persistMomentAssets(moment) {
        if (!moment) return moment;
        const result = { ...moment };

        if (isDataUrl(result.avatar)) {
            const assetId = result.avatarAssetId || buildAssetId('moment_avatar', result.id, 'avatar');
            await saveAssetFromDataUrl(assetId, result.avatar, {
                ownerType: 'im_moment',
                ownerId: String(result.id),
                field: 'avatar'
            });
            result.avatarAssetId = assetId;
            result.avatar = null;
        } else if (result.avatarAssetId && isBlobUrl(result.avatar)) {
            result.avatar = null;
        }

        if (Array.isArray(result.images)) {
            const nextImages = [];
            for (let i = 0; i < result.images.length; i += 1) {
                const item = result.images[i];
                if (typeof item === 'string' && isDataUrl(item)) {
                    const assetId = buildAssetId('moment_img', result.id, i);
                    await saveAssetFromDataUrl(assetId, item, {
                        ownerType: 'im_moment',
                        ownerId: String(result.id),
                        field: 'images',
                        index: i
                    });
                    nextImages.push({ assetId, desc: '' });
                } else if (item && typeof item === 'object' && isDataUrl(item.src)) {
                    const assetId = item.assetId || buildAssetId('moment_img', result.id, i);
                    await saveAssetFromDataUrl(assetId, item.src, {
                        ownerType: 'im_moment',
                        ownerId: String(result.id),
                        field: 'images',
                        index: i
                    });
                    nextImages.push({ ...item, assetId, src: null });
                } else if (item && typeof item === 'object' && item.assetId && isBlobUrl(item.src)) {
                    nextImages.push({ ...item, src: null });
                } else {
                    nextImages.push(item);
                }
            }
            result.images = nextImages;
        }

        return result;
    }

    async function hydrateMomentAssets(moment) {
        if (!moment) return moment;
        const result = { ...moment };

        if (result.avatarAssetId && (!result.avatar || isBlobUrl(result.avatar))) {
            result.avatar = await getAssetUrl(result.avatarAssetId);
        }

        if (Array.isArray(result.images)) {
            const nextImages = [];
            for (const item of result.images) {
                if (item && typeof item === 'object' && item.assetId && (!item.src || isBlobUrl(item.src))) {
                    nextImages.push({ ...item, src: await getAssetUrl(item.assetId) });
                } else {
                    nextImages.push(item);
                }
            }
            result.images = nextImages;
        }

        return result;
    }

    function collectMomentAssetIds(moment) {
        if (!moment) return [];
        const ids = [];
        if (moment.avatarAssetId) ids.push(String(moment.avatarAssetId));
        if (Array.isArray(moment.images)) {
            moment.images.forEach((item) => {
                if (item && typeof item === 'object' && item.assetId) {
                    ids.push(String(item.assetId));
                }
            });
        }
        return Array.from(new Set(ids));
    }

    function getExpectedMomentAssetIds(moment) {
        if (!moment || moment.id == null) return [];
        const ids = [];

        if (moment.avatarAssetId) {
            ids.push(String(moment.avatarAssetId));
        } else if (isDataUrl(moment.avatar)) {
            ids.push(buildAssetId('moment_avatar', moment.id, 'avatar'));
        }

        if (Array.isArray(moment.images)) {
            moment.images.forEach((item, index) => {
                if (item && typeof item === 'object' && item.assetId) {
                    ids.push(String(item.assetId));
                    return;
                }
                if (typeof item === 'string' && isDataUrl(item)) {
                    ids.push(buildAssetId('moment_img', moment.id, index));
                    return;
                }
                if (item && typeof item === 'object' && isDataUrl(item.src)) {
                    ids.push(String(item.assetId || buildAssetId('moment_img', moment.id, index)));
                }
            });
        }

        return Array.from(new Set(ids));
    }

    async function getMomentById(momentId) {
        if (momentId == null) return null;
        return getRecord(STORES.imMoments, momentId);
    }

    async function cleanupRemovedMomentAssets(previousMoment, nextMoment, retainedAssetIds = new Set()) {
        if (!previousMoment) return;
        const nextIds = new Set(getExpectedMomentAssetIds(nextMoment));
        for (const assetId of collectMomentAssetIds(previousMoment)) {
            if (nextIds.has(assetId) || retainedAssetIds.has(assetId)) continue;
            await markAssetOrphaned(assetId);
        }
    }

    async function saveMoment(moment) {
        if (!moment || moment.id == null) return false;
        const previousMoment = await getMomentById(moment.id);
        const retainedAssetIds = new Set(getExpectedMomentAssetIds(moment));
        const prepared = await persistMomentAssets(moment);

        await putRecord(STORES.imMoments, {
            ...prepared,
            id: prepared.id,
            updatedAt: Date.now()
        });

        await cleanupRemovedMomentAssets(previousMoment, moment, retainedAssetIds);
        return true;
    }

    async function deleteMoment(momentId) {
        if (momentId == null) return false;
        const existingMoments = await getAllRecords(STORES.imMoments);
        const matchingMoments = existingMoments.filter((moment) => String(moment?.id) === String(momentId));
        const directMoment = await getMomentById(momentId);
        const momentsToCleanup = [];
        const keysToDelete = new Set([momentId]);

        if (directMoment) {
            momentsToCleanup.push(directMoment);
            keysToDelete.add(directMoment.id);
        }

        matchingMoments.forEach((moment) => {
            if (!moment) return;
            momentsToCleanup.push(moment);
            keysToDelete.add(moment.id);
        });

        for (const key of keysToDelete) {
            await deleteRecord(STORES.imMoments, key);
        }

        const cleanedIds = new Set();
        for (const moment of momentsToCleanup) {
            const cleanupKey = `${typeof moment.id}:${String(moment.id)}`;
            if (cleanedIds.has(cleanupKey)) continue;
            cleanedIds.add(cleanupKey);
            await cleanupRemovedMomentAssets(moment, null);
        }
        return true;
    }

    async function saveMoments(moments) {
        const safeMoments = Array.isArray(moments) ? moments : [];
        const existingMoments = await getAllRecords(STORES.imMoments);
        const nextMomentIds = new Set(safeMoments.map((moment) => String(moment.id)));
        const retainedAssetIds = new Set();

        safeMoments.forEach((moment) => {
            getExpectedMomentAssetIds(moment).forEach((assetId) => retainedAssetIds.add(assetId));
        });

        for (const existingMoment of existingMoments) {
            if (!nextMomentIds.has(String(existingMoment.id))) {
                await deleteMoment(existingMoment.id);
            }
        }

        for (const rawMoment of safeMoments) {
            await saveMoment(rawMoment);
        }

        return true;
    }

    async function loadMoments() {
        const allMoments = await getAllRecords(STORES.imMoments);
        const hydrated = await Promise.all(allMoments.map((moment) => hydrateMomentAssets(moment)));
        hydrated.sort((a, b) => (b.time || 0) - (a.time || 0));
        return hydrated;
    }

    async function saveMomentMessages(messages) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        const normalizedMessages = safeMessages.map((msg) => ({
            ...msg,
            id: msg?.id || `moment_msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        }));
        const nextIds = new Set(normalizedMessages.map((msg) => String(msg.id)));

        return withStore([STORES.imMomentMessages], 'readwrite', async (stores) => {
            const existing = await requestToPromise(stores[STORES.imMomentMessages].getAll());
            const existingById = new Map((Array.isArray(existing) ? existing : []).map((item) => [String(item.id), item]));

            existingById.forEach((item, itemId) => {
                if (!nextIds.has(itemId)) {
                    stores[STORES.imMomentMessages].delete(item.id);
                }
            });

            normalizedMessages.forEach((msg) => {
                stores[STORES.imMomentMessages].put(msg);
            });
        });
    }

    async function loadMomentMessages() {
        const rows = await getAllRecords(STORES.imMomentMessages);
        return Array.isArray(rows) ? rows.sort((a, b) => (b.time || 0) - (a.time || 0)) : [];
    }

    async function saveStickers(stickers) {
        const safeStickers = Array.isArray(stickers)
            ? stickers.filter((category) => category && category.categoryName != null)
            : [];
        const normalizedStickers = [];
        for (const category of safeStickers) {
            const nextCategory = cloneDeep(category);
            nextCategory.categoryName = String(category.categoryName);
            const items = Array.isArray(nextCategory.items) ? nextCategory.items : [];
            for (let index = 0; index < items.length; index += 1) {
                const sticker = items[index];
                if (!sticker || typeof sticker !== 'object') continue;
                if (isDataUrl(sticker.url)) {
                    sticker.assetId = await saveContentAddressedAsset(sticker.url, {
                        fallbackId: buildAssetId('sticker', nextCategory.categoryName, sticker.name ?? index),
                        ownerType: 'im_sticker',
                        ownerId: nextCategory.categoryName,
                        field: String(sticker.name ?? index)
                    });
                    sticker.url = null;
                } else if (sticker.assetId && isBlobUrl(sticker.url)) {
                    sticker.url = null;
                }
            }
            normalizedStickers.push(nextCategory);
        }
        const nextIds = new Set(normalizedStickers.map((category) => category.categoryName));

        return withStore([STORES.imStickers], 'readwrite', async (stores) => {
            const existing = await requestToPromise(stores[STORES.imStickers].getAll());
            const existingById = new Map((Array.isArray(existing) ? existing : []).map((item) => [String(item.categoryName), item]));

            existingById.forEach((item, categoryName) => {
                if (!nextIds.has(categoryName)) {
                    stores[STORES.imStickers].delete(item.categoryName);
                }
            });

            normalizedStickers.forEach((category) => stores[STORES.imStickers].put(category));
        });
    }

    async function loadStickers() {
        const categories = await getAllRecords(STORES.imStickers);
        for (const category of categories) {
            for (const sticker of (Array.isArray(category?.items) ? category.items : [])) {
                if (sticker?.assetId && !sticker.url) sticker.url = await getAssetUrl(sticker.assetId);
            }
        }
        return categories;
    }

    async function saveMomentsCover(dataUrlOrUrl) {
        const now = Date.now();
        let storedValue = dataUrlOrUrl || null;
        if (isDataUrl(dataUrlOrUrl)) await assertLargeAssetCapacity(dataUrlOrUrl);
        await withStore([STORES.meta, STORES.assets], 'readwrite', async (stores) => {
            if (isDataUrl(dataUrlOrUrl)) {
                const assetId = 'im_moments_cover_me';
                const blob = dataUrlToBlob(dataUrlOrUrl);
                stores[STORES.assets].put({
                    id: assetId,
                    blob,
                    mimeType: blob.type || 'application/octet-stream',
                    ownerType: 'im_moments',
                    ownerId: 'me',
                    field: 'momentsCover',
                    updatedAt: now
                });
                storedValue = assetId;
            } else if (dataUrlOrUrl) {
                storedValue = { externalUrl: dataUrlOrUrl };
            } else {
                storedValue = null;
            }
            stores[STORES.meta].put({ key: META_KEYS.imMomentsCoverAssetId, value: storedValue });
        });
        if (storedValue === 'im_moments_cover_me') revokeRuntimeBlobUrl(storedValue);
        return storedValue;
    }

    async function loadMomentsCoverUrl() {
        const assetMeta = await getMeta(META_KEYS.imMomentsCoverAssetId);
        if (!assetMeta) return null;
        if (typeof assetMeta === 'object' && assetMeta.externalUrl) return assetMeta.externalUrl;
        if (typeof assetMeta === 'string') return getAssetUrl(assetMeta);
        return null;
    }

    function createDefaultAppState() {
        return {
            youtube: {
                channelState: {
                    bannerUrl: null,
                    url: '',
                    boundWorldBookIds: [],
                    systemPrompt: '',
                    summaryPrompt: '',
                    groupChatPrompt: '',
                    vodPrompt: '',
                    postPrompt: '',
                    liveSummaryPrompt: '',
                    liveSummaries: [],
                    groupChatHistory: [],
                    cachedTrendingLive: null,
                    cachedTrendingSub: null,
                    activeUserLive: null,
                    pastVideos: []
                },
                subscriptions: [],
                userState: null
            },
            tiktok: {
                profile: {
                    name: 'User',
                    handle: 'user123',
                    avatar: null,
                    status: '思考中...',
                    bio: '点击添加个人简介',
                    persona: '',
                    following: 0,
                    followers: 0,
                    likes: 0,
                    posts: []
                },
                chars: [],
                videos: [
                    {
                        id: 'v_default_1',
                        authorId: 'user_default_1',
                        authorName: 'Mew',
                        desc: '周末的正确打开方式，当然是和猫猫一起虚度光阴啦 🐈 #猫咪日常 #周末vlog',
                        sceneText: '阳光穿过窗纱洒在木地板上，一只橘猫正四仰八叉地躺在阳光里打呼噜。镜头缓慢拉近，画面色调温暖治愈，配着慵懒的 lofi 音乐。',
                        likes: 12543,
                        commentsCount: 432,
                        shares: 128,
                        isLiked: false,
                        comments: [
                            { authorName: 'Cici', text: '好治愈的画面，想去你家偷猫！', likes: 231 },
                            { authorName: '鱼蛋', text: '这猫怎么长得跟人一样哈哈哈', likes: 89 }
                        ]
                    },
                    {
                        id: 'v_default_2',
                        authorId: 'user_default_2',
                        authorName: 'CityWalker',
                        desc: '下雨天的城市，也有别样的浪漫 🌧️ 📸 #扫街 #下雨天 #摄影',
                        sceneText: '镜头跟随着一把透明雨伞，穿梭在霓虹闪烁的积水街道。水面倒映着红蓝色的灯牌，雨滴砸在伞面上发出清脆的白噪音，氛围感拉满。',
                        likes: 8762,
                        commentsCount: 215,
                        shares: 342,
                        isLiked: false,
                        comments: [
                            { authorName: '光影', text: '色彩太棒了，求个滤镜参数', likes: 156 },
                            { authorName: 'Jay', text: '喜欢下雨天的人，内心都很温柔吧', likes: 44 }
                        ]
                    }
                ],
                dms: []
            },
            pay: {
                transactions: [],
                balance: 1000
            },
            spotify: {
                customName: '',
                avatarUrl: '',
                backgroundUrl: ''
            },
            diary: {
                notes: []
            },
            maps: {
                mapsStore: [],
                activeMapId: null,
                friendPositionsStore: {}
            },
            netflix: {
                schemaVersion: 4,
                homeCatalog: null,
                activeRun: null,
                saveSlots: {
                    auto: null,
                    manual: [null, null, null, null, null, null]
                },
                unlockedEndings: [],
                uiSettings: {
                    textSpeed: 'normal',
                    reduceMotion: false
                }
            },
            desktop: {},
            bstage: {},
            x: {
                xData: {
                    name: 'User',
                    handle: '@user',
                    bio: '点击编辑资料添加简介',
                    location: '',
                    following: '0',
                    followers: '0',
                    persona: '',
                    avatar: '',
                    banner: ''
                },
                xPlayerAccounts: [],
                activeXPlayerAccountId: '',
                xAccountSchemaVersion: 1,
                xCharIdentityMigrationVersion: 0,
                xCharProfileMediaMigrationVersion: 0,
                xTopics: [],
                xHomeBannerUrl: '',
                xSearchBannerUrl: ''
            },
            imessage: {
                uiState: {
                    cssPresets: []
                }
            }
        };
    }

    function ensureAppStateShape(rawState = {}) {
        const defaults = createDefaultAppState();
        const safeState = rawState && typeof rawState === 'object' ? rawState : {};

        return {
            ...defaults,
            ...safeState,
            youtube: {
                ...defaults.youtube,
                ...(safeState.youtube && typeof safeState.youtube === 'object' ? safeState.youtube : {})
            },
            tiktok: {
                ...defaults.tiktok,
                ...(safeState.tiktok && typeof safeState.tiktok === 'object' ? safeState.tiktok : {})
            },
            pay: {
                ...defaults.pay,
                ...(safeState.pay && typeof safeState.pay === 'object' ? safeState.pay : {})
            },
            spotify: {
                ...defaults.spotify,
                ...(safeState.spotify && typeof safeState.spotify === 'object' ? safeState.spotify : {})
            },
            diary: {
                ...defaults.diary,
                ...(safeState.diary && typeof safeState.diary === 'object' ? safeState.diary : {})
            },
            maps: {
                ...defaults.maps,
                ...(safeState.maps && typeof safeState.maps === 'object' ? safeState.maps : {})
            },
            netflix: safeState.netflix && typeof safeState.netflix === 'object' ? safeState.netflix : defaults.netflix,
            desktop: safeState.desktop && typeof safeState.desktop === 'object' ? safeState.desktop : defaults.desktop,
            bstage: safeState.bstage && typeof safeState.bstage === 'object' ? safeState.bstage : defaults.bstage,
            x: {
                ...defaults.x,
                ...(safeState.x && typeof safeState.x === 'object' ? safeState.x : {}),
                xData: {
                    ...defaults.x.xData,
                    ...(safeState.x && safeState.x.xData && typeof safeState.x.xData === 'object'
                        ? safeState.x.xData
                        : {})
                },
                xTopics: Array.isArray(safeState.x?.xTopics) ? safeState.x.xTopics : defaults.x.xTopics,
                xHomeBannerUrl: typeof safeState.x?.xHomeBannerUrl === 'string'
                    ? safeState.x.xHomeBannerUrl
                    : defaults.x.xHomeBannerUrl,
                xSearchBannerUrl: typeof safeState.x?.xSearchBannerUrl === 'string'
                    ? safeState.x.xSearchBannerUrl
                    : defaults.x.xSearchBannerUrl
            },
            imessage: {
                ...defaults.imessage,
                ...(safeState.imessage && typeof safeState.imessage === 'object' ? safeState.imessage : {}),
                uiState: {
                    ...defaults.imessage.uiState,
                    ...(safeState.imessage && safeState.imessage.uiState && typeof safeState.imessage.uiState === 'object'
                        ? safeState.imessage.uiState
                        : {})
                }
            }
        };
    }

    function normalizeGlobalPayload(payload = {}) {
        const safe = payload && typeof payload === 'object' ? payload : {};
        const themeState = safe.themeState && typeof safe.themeState === 'object' ? safe.themeState : null;
        if (themeState) {
            themeState.imessageHomeCssEnabled = !!themeState.imessageHomeCssEnabled;
            themeState.imessageHomeCss = typeof themeState.imessageHomeCss === 'string' ? themeState.imessageHomeCss : '';
            themeState.imessageChatCssEnabled = !!themeState.imessageChatCssEnabled;
            themeState.imessageChatCss = typeof themeState.imessageChatCss === 'string' ? themeState.imessageChatCss : '';
            if (Array.isArray(themeState.apps)) {
                themeState.apps = themeState.apps.map(app => {
                    if (!app || typeof app !== 'object') return app;
                    if (app.id === 'app-icon-8' && app.name === 'Spotify') {
                        return { ...app, name: 'Loves' };
                    }
                    return app;
                });
            }
        }

        return {
            storageSchemaVersion: STORAGE_SCHEMA_VERSION,
            userState: safe.userState && typeof safe.userState === 'object'
                ? {
                    name: safe.userState.name || '',
                    phone: safe.userState.phone || '',
                    persona: safe.userState.persona || '',
                    avatarUrl: safe.userState.avatarUrl || null
                }
                : {
                    name: '',
                    phone: '',
                    persona: '',
                    avatarUrl: null
                },
            accounts: Array.isArray(safe.accounts) ? safe.accounts : [],
            currentAccountId: safe.currentAccountId ?? null,
            apiConfig: safe.apiConfig && typeof safe.apiConfig === 'object'
                ? {
                    provider: ['openai', 'deepseek', 'siliconflow', 'gemini', 'anthropic', 'openai-compatible']
                        .includes(String(safe.apiConfig.provider || '').toLowerCase())
                        ? String(safe.apiConfig.provider).toLowerCase()
                        : 'openai-compatible',
                    endpoint: typeof safe.apiConfig.endpoint === 'string' ? safe.apiConfig.endpoint : '',
                    apiKey: typeof safe.apiConfig.apiKey === 'string' ? safe.apiConfig.apiKey : '',
                    model: typeof safe.apiConfig.model === 'string' ? safe.apiConfig.model : '',
                    temperature: Number.isFinite(parseFloat(safe.apiConfig.temperature))
                        ? parseFloat(safe.apiConfig.temperature)
                        : 0.7
                }
                : { provider: 'openai-compatible', endpoint: '', apiKey: '', model: '', temperature: 0.7 },
            vectorMemoryConfig: (() => {
                const source = safe.vectorMemoryConfig && typeof safe.vectorMemoryConfig === 'object'
                    ? safe.vectorMemoryConfig
                    : {};
                const isLegacyConfig = !source.provider && [
                    'namespace',
                    'embeddingModel',
                    'embeddingDimensions',
                    'embeddingRevision',
                    'topK',
                    'timeoutMs'
                ].some((key) => Object.prototype.hasOwnProperty.call(source, key));
                const provider = ['siliconflow', 'openai', 'dashscope', 'zhipu', 'openai-compatible']
                    .includes(String(source.provider || '').toLowerCase())
                    ? String(source.provider).toLowerCase()
                    : 'siliconflow';
                const defaultModels = {
                    siliconflow: 'BAAI/bge-m3',
                    openai: 'text-embedding-3-small',
                    dashscope: 'text-embedding-v4',
                    zhipu: 'embedding-3',
                    'openai-compatible': ''
                };
                return {
                    enabled: !isLegacyConfig && source.enabled === true,
                    provider,
                    endpoint: provider === 'openai-compatible' && typeof source.endpoint === 'string'
                        ? source.endpoint
                        : '',
                    apiKey: !isLegacyConfig && typeof source.apiKey === 'string' ? source.apiKey : '',
                    model: typeof source.model === 'string' && source.model.trim()
                        ? source.model
                        : defaultModels[provider]
                };
            })(),
            apiPresets: Array.isArray(safe.apiPresets) ? safe.apiPresets : [],
            fetchedModels: Array.isArray(safe.fetchedModels) ? safe.fetchedModels : [],
            assistiveBallSettings: safe.assistiveBallSettings && typeof safe.assistiveBallSettings === 'object'
                ? {
                    enabled: !!safe.assistiveBallSettings.enabled,
                    x: Number.isFinite(parseFloat(safe.assistiveBallSettings.x))
                        ? parseFloat(safe.assistiveBallSettings.x)
                        : null,
                    y: Number.isFinite(parseFloat(safe.assistiveBallSettings.y))
                        ? parseFloat(safe.assistiveBallSettings.y)
                        : null,
                    size: Number.isFinite(parseFloat(safe.assistiveBallSettings.size))
                        ? Math.round(Math.max(36, Math.min(96, parseFloat(safe.assistiveBallSettings.size))) / 2) * 2
                        : 58,
                    opacity: Number.isFinite(parseFloat(safe.assistiveBallSettings.opacity))
                        ? Math.max(0.2, Math.min(1, parseFloat(safe.assistiveBallSettings.opacity) > 1
                            ? parseFloat(safe.assistiveBallSettings.opacity) / 100
                            : parseFloat(safe.assistiveBallSettings.opacity)))
                        : 0.72,
                    imageUrl: typeof safe.assistiveBallSettings.imageUrl === 'string'
                        && /^(https?:\/\/|data:image\/png;base64,)/i.test(safe.assistiveBallSettings.imageUrl.trim())
                        ? safe.assistiveBallSettings.imageUrl.trim()
                        : ''
                }
                : { enabled: false, x: null, y: null, size: 58, opacity: 0.72, imageUrl: '' },
            themeState: themeState || {
                bgUrl: null,
                fontMode: 'preset',
                fontPresetKey: 'system-default',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
            fontCssName: '',
            fontSize: 16,
                fontSources: {
                    woff2: '',
                    woff: '',
                    ttf: ''
                },
                savedFontPresets: [],
                imessageHomeCssEnabled: false,
                imessageHomeCss: '',
                imessageChatCssEnabled: false,
                imessageChatCss: '',
                apps: [
                    { id: 'app-icon-1', name: 'Pay', icon: null },
                    { id: 'app-icon-2', name: 'TikTok', icon: null },
                    { id: 'app-icon-3', name: 'b.stage', icon: null },
                    { id: 'app-icon-4', name: 'X', icon: null },
                    { id: 'app-icon-5', name: 'Shop', icon: null },
            { id: 'app-icon-6', name: 'call', icon: null },
                    { id: 'app-icon-7', name: 'Netflix', icon: null },
                    { id: 'app-icon-8', name: 'Loves', icon: null },
                    { id: 'dock-icon-settings', name: '设置', icon: null },
                    { id: 'dock-icon-imessage', name: '信息', icon: null },
                    { id: 'dock-icon-youtube', name: 'YouTube', icon: null }
                ]
            },
            wbGroups: Array.isArray(safe.wbGroups) ? safe.wbGroups : [],
            worldBooks: Array.isArray(safe.worldBooks) ? safe.worldBooks : [],
            appState: ensureAppStateShape(safe.appState)
        };
    }

    async function saveGlobalData(payload = {}) {
        const normalized = normalizeGlobalPayload(payload);

        await Promise.all([
            setSetting('userState', normalized.userState),
            setSetting('currentAccountId', normalized.currentAccountId),
            setSetting('apiConfig', normalized.apiConfig),
            setSetting('vectorMemoryConfig', normalized.vectorMemoryConfig),
            setSetting('apiPresets', normalized.apiPresets),
            setSetting('fetchedModels', normalized.fetchedModels),
            setSetting('assistiveBallSettings', normalized.assistiveBallSettings),
            setSetting('themeState', normalized.themeState),
            setSetting('wbGroups', normalized.wbGroups),
            setSetting('worldBooks', normalized.worldBooks),
            putRecord(STORES.accounts, { id: '__all__', value: cloneDeep(normalized.accounts) }),
            setMeta(META_KEYS.schemaVersion, STORAGE_SCHEMA_VERSION)
        ]);

        if (storageReadyPromise) await storageReadyPromise;
        await commitDomain('settings', (draft) => ({
            ...draft,
            userState: normalized.userState,
            accounts: normalized.accounts,
            currentAccountId: normalized.currentAccountId,
            apiConfig: normalized.apiConfig,
            vectorMemoryConfig: normalized.vectorMemoryConfig,
            apiPresets: normalized.apiPresets,
            fetchedModels: normalized.fetchedModels,
            assistiveBallSettings: normalized.assistiveBallSettings,
            themeState: normalized.themeState,
            wbGroups: normalized.wbGroups,
            worldBooks: normalized.worldBooks
        }), { reason: 'global-settings-save' });
        await Promise.all(Object.entries(normalized.appState || {}).map(([name, value]) => {
            return commitDomain(name, value, { reason: `global-app-save:${name}` });
        }));

        return true;
    }

    async function loadGlobalData() {
        const [
            storedSchemaVersion,
            userState,
            currentAccountId,
            apiConfig,
            vectorMemoryConfig,
            apiPresets,
            fetchedModels,
            assistiveBallSettings,
            themeState,
            wbGroups,
            worldBooks,
            appState,
            accountsRecord
        ] = await Promise.all([
            getMeta(META_KEYS.schemaVersion),
            getSetting('userState', null),
            getSetting('currentAccountId', null),
            getSetting('apiConfig', null),
            getSetting('vectorMemoryConfig', null),
            getSetting('apiPresets', []),
            getSetting('fetchedModels', []),
            getSetting('assistiveBallSettings', { enabled: false }),
            getSetting('themeState', null),
            getSetting('wbGroups', []),
            getSetting('worldBooks', []),
            getSetting('appState', createDefaultAppState()),
            getRecord(STORES.accounts, '__all__')
        ]);

        const durableSettings = readDomain('settings', {});
        const domainAppState = createDefaultAppState();
        Object.keys(domainAppState).forEach((name) => {
            domainAppState[name] = readDomain(name, domainAppState[name]);
        });
        return {
            ...normalizeGlobalPayload({
                userState: durableSettings.userState ?? userState,
                accounts: Array.isArray(durableSettings.accounts)
                    ? durableSettings.accounts
                    : (accountsRecord && Array.isArray(accountsRecord.value) ? accountsRecord.value : []),
                currentAccountId: durableSettings.currentAccountId ?? currentAccountId,
                apiConfig: durableSettings.apiConfig ?? apiConfig,
                vectorMemoryConfig: durableSettings.vectorMemoryConfig ?? vectorMemoryConfig,
                apiPresets: durableSettings.apiPresets ?? apiPresets,
                fetchedModels: durableSettings.fetchedModels ?? fetchedModels,
                assistiveBallSettings: durableSettings.assistiveBallSettings ?? assistiveBallSettings,
                themeState: durableSettings.themeState ?? themeState,
                wbGroups: durableSettings.wbGroups ?? wbGroups,
                worldBooks: durableSettings.worldBooks ?? worldBooks,
                appState: domainAppState
            }),
            storageSchemaVersion: Number(storedSchemaVersion) || 0
        };
    }

    async function serializeRecordForBackup(storeName, record) {
        const serialized = cloneDeep(record);

        if (storeName === STORES.assets && serialized && serialized.blob) {
            try {
                serialized.dataUrl = await blobToDataUrl(serialized.blob);
                delete serialized.blob;
            } catch (err) {
                throw new Error(`Asset ${serialized.id || 'unknown'} could not be included in the backup: ${err?.message || err}`);
            }
        }

        return serialized;
    }

    function deserializeBackupRecord(storeName, record) {
        const restored = cloneDeep(record);

        if (storeName === STORES.assets && restored && restored.dataUrl) {
            try {
                restored.blob = dataUrlToBlob(restored.dataUrl);
                delete restored.dataUrl;
            } catch (err) {
                throw new Error(`Backup asset ${restored.id || 'unknown'} contains invalid image data.`);
            }
        }

        return restored;
    }

    function buildBackupStats(storesData = {}, localStorageSnapshot = []) {
        const storeStats = {};
        let recordCount = 0;
        let assetCount = 0;

        BACKUP_STORES.forEach((storeName) => {
            const count = Array.isArray(storesData[storeName]) ? storesData[storeName].length : 0;
            storeStats[storeName] = count;
            recordCount += count;
        });

        if (Array.isArray(storesData[STORES.assets])) {
            assetCount = storesData[STORES.assets].length;
        }

        return {
            stores: storeStats,
            storeCount: BACKUP_STORES.length,
            recordCount,
            assetCount,
            localStorageKeyCount: Array.isArray(localStorageSnapshot) ? localStorageSnapshot.length : 0,
            approximateBytes: estimateJsonBytes({ stores: storesData, localStorage: localStorageSnapshot })
        };
    }

    async function collectBackupSnapshot(progressCallback) {
        reportProgress(progressCallback, '准备导出数据...', 0);

        const storesData = {};
        const storeNames = BACKUP_STORES;

        for (let i = 0; i < storeNames.length; i += 1) {
            const storeName = storeNames[i];
            const baseProgress = Math.floor((i / storeNames.length) * 82);
            reportProgress(progressCallback, `读取 ${storeName}...`, baseProgress);

            const records = await getAllRecords(storeName);
            const serializedRecords = [];

            for (let j = 0; j < records.length; j += 1) {
                serializedRecords.push(await serializeRecordForBackup(storeName, records[j]));
                if ((storeName === STORES.assets || storeName === STORES.imMessages) && j > 0 && j % 20 === 0) {
                    const stepProgress = Math.floor((j / records.length) * (82 / storeNames.length));
                    reportProgress(progressCallback, `处理 ${storeName} (${j}/${records.length})...`, baseProgress + stepProgress);
                }
            }

            storesData[storeName] = serializedRecords;
        }

        reportProgress(progressCallback, '校验 IndexedDB 数据...', 86);
        const localStorageSnapshot = [];
        const checksumSource = {
            stores: storesData,
            localStorage: localStorageSnapshot
        };
        const stats = buildBackupStats(storesData, localStorageSnapshot);

        return {
            app: BACKUP_APP_NAME,
            schemaVersion: STORAGE_SCHEMA_VERSION,
            version: STORAGE_SCHEMA_VERSION,
            exportedAt: Date.now(),
            stores: storesData,
            localStorage: localStorageSnapshot,
            stats,
            checksum: {
                algorithm: 'fnv1a32',
                value: createChecksum(checksumSource)
            }
        };
    }

    async function serializeBackupBlob(snapshot, progressCallback) {
        reportProgress(progressCallback, '生成备份文件...', 95);
        return new Blob([JSON.stringify(snapshot)], { type: 'application/json' });
    }

    function summarizeBackupPayload(payload = {}) {
        const safe = payload && typeof payload === 'object' ? payload : {};
        const storesData = safe.stores && typeof safe.stores === 'object' ? safe.stores : {};
        const localStorageSnapshot = Array.isArray(safe.localStorage) ? safe.localStorage : [];
        const stats = safe.stats && typeof safe.stats === 'object'
            ? safe.stats
            : buildBackupStats(storesData, localStorageSnapshot);

        return {
            app: safe.app || BACKUP_APP_NAME,
            schemaVersion: Number(safe.schemaVersion || safe.version) || 1,
            exportedAt: Number(safe.exportedAt) || 0,
            storeCount: Number(stats.storeCount) || Object.keys(storesData).length,
            recordCount: Number(stats.recordCount) || 0,
            assetCount: Number(stats.assetCount) || 0,
            localStorageKeyCount: Number(stats.localStorageKeyCount) || localStorageSnapshot.length,
            approximateBytes: Number(stats.approximateBytes) || estimateJsonBytes(safe),
            checksum: safe.checksum?.value || ''
        };
    }

    function validateBackupPayload(payload = {}) {
        if (!payload || typeof payload !== 'object') {
            throw new Error('Invalid backup payload.');
        }

        if (payload.stores && typeof payload.stores === 'object') {
            const suppliedChecksum = payload.checksum?.value;
            if (suppliedChecksum) {
                const actualChecksum = createChecksum({
                    stores: payload.stores,
                    localStorage: Array.isArray(payload.localStorage) ? payload.localStorage : []
                });
                if (actualChecksum !== suppliedChecksum) {
                    throw new Error('Backup checksum mismatch.');
                }
            }
            const storesData = { ...payload.stores };
            BACKUP_STORES.forEach((storeName) => {
                storesData[storeName] = Array.isArray(payload.stores[storeName]) ? payload.stores[storeName] : [];
            });

            const normalized = {
                ...payload,
                stores: storesData,
                localStorage: Array.isArray(payload.localStorage) ? payload.localStorage : []
            };

            return {
                format: 'snapshot',
                payload: normalized,
                summary: summarizeBackupPayload(normalized)
            };
        }

        const hasLegacyImessageRoot = ['friends', 'messages', 'moments', 'momentMessages', 'stickers', 'momentsCoverUrl']
            .some((key) => Object.prototype.hasOwnProperty.call(payload, key));
        if (payload.globalData || payload.imessage || payload.assets || hasLegacyImessageRoot) {
            return {
                format: 'legacy',
                payload,
                summary: {
                    app: BACKUP_APP_NAME,
                    schemaVersion: Number(payload.version) || 1,
                    exportedAt: Number(payload.exportedAt) || 0,
                    storeCount: 0,
                    recordCount: 0,
                    assetCount: Array.isArray(payload.assets) ? payload.assets.length : 0,
                    localStorageKeyCount: 0,
                    approximateBytes: estimateJsonBytes(payload),
                    checksum: ''
                }
            };
        }

        throw new Error('Unsupported backup format.');
    }

    const BACKUP_STORE_KEY_FIELDS = {
        [STORES.meta]: 'key',
        [STORES.settings]: 'key',
        [STORES.accounts]: 'id',
        [STORES.appState]: 'key',
        [STORES.theme]: 'key',
        [STORES.worldbooks]: 'key',
        [STORES.assets]: 'id',
        [STORES.imFriends]: 'id',
        [STORES.imChatSummaries]: 'friendId',
        [STORES.imMessages]: 'id',
        [STORES.imMoments]: 'id',
        [STORES.imMomentMessages]: 'id',
        [STORES.imStickers]: 'categoryName',
        [STORES.libraryBooks]: 'id',
        [STORES.libraryBookContent]: 'id',
        [STORES.libraryPlaylists]: 'id',
        [STORES.libraryTracks]: 'id',
        [STORES.libraryDailyStats]: 'id',
        [STORES.appDomains]: 'name',
        [STORES.xPosts]: 'id',
        [STORES.xThreads]: 'postId',
        [STORES.xDms]: 'id',
        [STORES.xAccountWorlds]: 'accountId',
        [STORES.vectorMemoryIndex]: 'id',
        [STORES.storageCheckpoints]: 'id'
    };

    function createEmptyBackupStores() {
        return Object.fromEntries(BACKUP_STORES.map((storeName) => [storeName, []]));
    }

    function upsertBackupRecord(storesData, storeName, record) {
        const keyField = BACKUP_STORE_KEY_FIELDS[storeName];
        const key = record?.[keyField];
        if (key === undefined || key === null || key === '') return false;
        const rows = storesData[storeName];
        const existingIndex = rows.findIndex((item) => String(item?.[keyField]) === String(key));
        if (existingIndex >= 0) rows[existingIndex] = record;
        else rows.push(record);
        return true;
    }

    function normalizeImportRecord(storeName, record, index = 0) {
        if (!record || typeof record !== 'object' || Array.isArray(record)) {
            throw new Error(`Invalid ${storeName} record at index ${index}.`);
        }
        const next = sanitizePersistentValue(cloneDeep(record));
        if (storeName === STORES.assets && record.dataUrl) {
            const restored = deserializeBackupRecord(storeName, record);
            if (!restored?.id) throw new Error(`Backup record ${storeName}[${index}] is missing id.`);
            if (typeof Blob !== 'undefined' && !(restored.blob instanceof Blob)) {
                throw new Error(`Backup asset ${restored.id} contains invalid image data.`);
            }
            return restored;
        }
        if (storeName === STORES.assets && next.blob && typeof Blob !== 'undefined' && !(next.blob instanceof Blob)) {
            throw new Error(`Backup asset ${next.id || index} contains an invalid blob.`);
        }
        if (storeName === STORES.imChatSummaries && next.friendId == null && next.id != null) next.friendId = String(next.id);
        if (storeName === STORES.imMessages) {
            const friendId = String(next.friendId ?? next.chatId ?? 'legacy');
            return normalizeMessageRecord(friendId, next, next.order ?? index);
        }
        if (storeName === STORES.imMoments && next.id == null) next.id = `legacy_moment_${next.time || next.timestamp || index}`;
        if (storeName === STORES.imMomentMessages && next.id == null) next.id = `legacy_moment_message_${next.time || next.timestamp || index}`;
        if (storeName === STORES.imStickers && next.categoryName == null) next.categoryName = String(next.name ?? next.title ?? `legacy_${index}`);
        if (storeName === STORES.appDomains && next.name == null && next.key != null) next.name = String(next.key);
        if (storeName === STORES.xPosts && next.id == null) next.id = `legacy_x_post_${next.createdAt || index}`;
        if (storeName === STORES.xThreads && next.postId == null && next.id != null) next.postId = String(next.id);
        if (storeName === STORES.xDms && next.id == null) next.id = String(next.charId ?? `legacy_x_dm_${index}`);
        const keyField = BACKUP_STORE_KEY_FIELDS[storeName];
        if (next[keyField] === undefined || next[keyField] === null || next[keyField] === '') {
            throw new Error(`Backup record ${storeName}[${index}] is missing ${keyField}.`);
        }
        return next;
    }

    function mergeLegacyStorageRowsIntoSnapshot(storesData, localStorageRows = []) {
        const rows = Array.isArray(localStorageRows) ? localStorageRows.filter((row) => row?.key) : [];
        if (rows.length === 0) return;
        const settingsMap = {
            u2_userState: 'userState',
            u2_apiConfig: 'apiConfig',
            u2_vectorMemoryConfig: 'vectorMemoryConfig',
            u2_ttsConfig: 'ttsConfig',
            u2_minimaxConfig: 'minimaxConfig',
            u2_apiPresets: 'apiPresets',
            u2_fetchedModels: 'fetchedModels',
            u2_assistiveBallSettings: 'assistiveBallSettings',
            u2_accounts: 'accounts',
            u2_currentAccountId: 'currentAccountId',
            u2_themeState: 'themeState',
            u2_worldBooks: 'worldBooks',
            u2_wbGroups: 'wbGroups'
        };
        const existingSettings = storesData[STORES.appDomains].find((row) => row?.name === 'settings');
        const settings = existingSettings?.value && typeof existingSettings.value === 'object'
            ? cloneDeep(existingSettings.value)
            : {};
        const existingLegacy = storesData[STORES.appDomains].find((row) => row?.name === 'legacy');
        const legacy = existingLegacy?.value && typeof existingLegacy.value === 'object'
            ? cloneDeep(existingLegacy.value)
            : {};
        rows.forEach((row) => {
            if (row.key === 'u2_mockAuthSession' || row.key === 'u2_appState') return;
            const value = parseLegacyRawValue(row.value);
            const settingKey = settingsMap[row.key];
            if (settingKey && !Object.prototype.hasOwnProperty.call(settings, settingKey)) settings[settingKey] = value;
            else if (!settingKey && !Object.prototype.hasOwnProperty.call(legacy, row.key)) legacy[row.key] = value;
        });
        const now = Date.now();
        upsertBackupRecord(storesData, STORES.appDomains, {
            name: 'settings', schemaVersion: STORAGE_SCHEMA_VERSION, revision: 1, updatedAt: now, value: settings
        });
        upsertBackupRecord(storesData, STORES.appDomains, {
            name: 'legacy', schemaVersion: STORAGE_SCHEMA_VERSION, revision: 1, updatedAt: now, value: legacy
        });
        const oldAppState = parseLegacyBackupJson(rows, 'u2_appState');
        if (oldAppState && typeof oldAppState === 'object') {
            Object.entries(oldAppState).forEach(([name, value]) => {
                if (!name || !value || typeof value !== 'object') {
                    legacy[`u2_appState_${name}`] = sanitizePersistentValue(value);
                    return;
                }
                if (!storesData[STORES.appDomains].some((row) => row?.name === name)) {
                    storesData[STORES.appDomains].push({
                        name, schemaVersion: STORAGE_SCHEMA_VERSION, revision: 1, updatedAt: now,
                        value: sanitizePersistentValue(cloneDeep(value))
                    });
                }
            });
        }
    }

    function addLegacyImessageToSnapshot(storesData, imessage = {}) {
        const safe = imessage && typeof imessage === 'object' ? imessage : {};
        const directMessages = Array.isArray(safe.messages) ? safe.messages : [];
        (Array.isArray(safe.friends) ? safe.friends : []).forEach((friend, friendIndex) => {
            if (!friend || friend.id == null) return;
            const friendId = String(friend.id);
            const meta = sanitizePersistentValue(cloneDeep(friend));
            const embeddedMessages = Array.isArray(meta.messages) ? meta.messages : [];
            delete meta.messages;
            meta.id = friendId;
            upsertBackupRecord(storesData, STORES.imFriends, meta);
            const allFriendMessages = [...embeddedMessages, ...directMessages.filter((message) => String(message?.friendId ?? message?.chatId ?? '') === friendId)];
            allFriendMessages.forEach((message, index) => {
                upsertBackupRecord(storesData, STORES.imMessages, normalizeMessageRecord(friendId, message, index));
            });
            upsertBackupRecord(storesData, STORES.imChatSummaries, normalizeChatSummary(friendId, {
                lastMessagePreview: friend.lastMessagePreview,
                lastMessageTimestamp: friend.lastMessageTimestamp,
                messageCount: allFriendMessages.length || friend.messageCount,
                unreadCount: friend.unreadCount
            }));
        });
        directMessages.forEach((message, index) => {
            const friendId = String(message?.friendId ?? message?.chatId ?? 'legacy');
            upsertBackupRecord(storesData, STORES.imMessages, normalizeMessageRecord(friendId, message, index));
        });
        (Array.isArray(safe.moments) ? safe.moments : []).forEach((record, index) => {
            upsertBackupRecord(storesData, STORES.imMoments, normalizeImportRecord(STORES.imMoments, record, index));
        });
        (Array.isArray(safe.momentMessages) ? safe.momentMessages : []).forEach((record, index) => {
            upsertBackupRecord(storesData, STORES.imMomentMessages, normalizeImportRecord(STORES.imMomentMessages, record, index));
        });
        (Array.isArray(safe.stickers) ? safe.stickers : []).forEach((record, index) => {
            if (!record || typeof record !== 'object') return;
            const category = cloneDeep(record);
            category.categoryName = String(category.categoryName ?? category.name ?? category.title ?? category.id ?? `legacy_${index}`);
            upsertBackupRecord(storesData, STORES.imStickers, category);
        });
        if (safe.momentsCoverUrlMeta !== undefined) {
            upsertBackupRecord(storesData, STORES.meta, { key: META_KEYS.imMomentsCoverAssetId, value: safe.momentsCoverUrlMeta });
        } else if (safe.momentsCoverUrl) {
            upsertBackupRecord(storesData, STORES.meta, {
                key: META_KEYS.imMomentsCoverAssetId,
                value: { externalUrl: safe.momentsCoverUrl }
            });
        }
    }

    function buildLegacyImportSnapshot(payload = {}) {
        const storesData = createEmptyBackupStores();
        const now = Date.now();
        const normalized = normalizeGlobalPayload(cloneDeep(payload.globalData || {}));
        const settingsValue = {
            userState: normalized.userState,
            accounts: normalized.accounts,
            currentAccountId: normalized.currentAccountId,
            apiConfig: normalized.apiConfig,
            vectorMemoryConfig: normalized.vectorMemoryConfig,
            apiPresets: normalized.apiPresets,
            fetchedModels: normalized.fetchedModels,
            assistiveBallSettings: normalized.assistiveBallSettings,
            themeState: normalized.themeState,
            wbGroups: normalized.wbGroups,
            worldBooks: normalized.worldBooks
        };
        Object.entries(settingsValue).forEach(([key, value]) => {
            if (key !== 'accounts') storesData[STORES.settings].push({ key, value: sanitizePersistentValue(cloneDeep(value)) });
        });
        storesData[STORES.accounts].push({ id: '__all__', value: cloneDeep(normalized.accounts) });
        storesData[STORES.appDomains].push({
            name: 'settings', schemaVersion: STORAGE_SCHEMA_VERSION, revision: 1, updatedAt: now,
            value: sanitizePersistentValue(cloneDeep(settingsValue))
        });
        storesData[STORES.appDomains].push({
            name: 'legacy', schemaVersion: STORAGE_SCHEMA_VERSION, revision: 1, updatedAt: now, value: {}
        });
        Object.entries(normalized.appState || {}).forEach(([name, value]) => {
            storesData[STORES.appDomains].push({
                name, schemaVersion: STORAGE_SCHEMA_VERSION, revision: 1, updatedAt: now,
                value: sanitizePersistentValue(cloneDeep(value))
            });
        });
        const imessage = payload.imessage && typeof payload.imessage === 'object' ? payload.imessage : payload;
        addLegacyImessageToSnapshot(storesData, imessage);
        (Array.isArray(payload.assets) ? payload.assets : []).forEach((record, index) => {
            upsertBackupRecord(storesData, STORES.assets, normalizeImportRecord(STORES.assets, record, index));
        });
        storesData[STORES.meta].push({ key: META_KEYS.schemaVersion, value: STORAGE_SCHEMA_VERSION });
        return { stores: storesData, localStorage: [] };
    }

    const LEGACY_STICKER_STORE_NAMES = ['stickers', 'imessage_stickers', 'imessageStickers', 'stickerCategories'];

    function getStickerItemsFromCategory(category = {}) {
        const candidates = [category.items, category.stickers, category.emojis, category.list];
        const arrayValue = candidates.find(Array.isArray);
        if (arrayValue) return arrayValue;
        const objectValue = candidates.find((candidate) => candidate && typeof candidate === 'object');
        if (!objectValue) return [];
        return Object.entries(objectValue).map(([name, value]) => {
            if (typeof value === 'string') return { name, url: value };
            return value && typeof value === 'object' ? { name, ...value } : null;
        }).filter(Boolean);
    }

    function getStickerAssetId(item = {}) {
        const value = item.assetId ?? item.imageAssetId ?? item.resourceId ?? '';
        return value == null ? '' : String(value);
    }

    function getStickerUrl(item = {}) {
        const candidates = [item.url, item.src, item.image, item.imageUrl, item.dataUrl, item.data];
        const value = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
        return typeof value === 'string' ? value.trim() : '';
    }

    function collectRawStickerRows(source = {}) {
        const stores = source.stores && typeof source.stores === 'object' ? source.stores : {};
        const rows = Array.isArray(stores[STORES.imStickers]) ? [...stores[STORES.imStickers]] : [];
        LEGACY_STICKER_STORE_NAMES.forEach((storeName) => {
            if (Array.isArray(stores[storeName])) rows.push(...stores[storeName]);
        });
        return rows;
    }

    function collectStickerAssetReferences(categories = []) {
        const references = new Set();
        categories.forEach((category) => {
            getStickerItemsFromCategory(category).forEach((item) => {
                if (!item || typeof item !== 'object') return;
                const assetId = getStickerAssetId(item);
                if (assetId) references.add(assetId);
            });
        });
        return references;
    }

    function normalizeStickerRowsForImport(rawCategories, storesData, report) {
        const availableAssetIds = new Set(storesData[STORES.assets].map((asset) => String(asset?.id || '')).filter(Boolean));
        rawCategories.forEach((rawCategory, categoryIndex) => {
            if (!rawCategory || typeof rawCategory !== 'object') {
                report.stickers.skippedCategories += 1;
                return;
            }
            const categoryName = String(
                rawCategory.categoryName ?? rawCategory.name ?? rawCategory.title ?? rawCategory.id ?? `旧表情包 ${categoryIndex + 1}`
            ).trim();
            if (!categoryName) {
                report.stickers.skippedCategories += 1;
                return;
            }
            const normalizedItems = [];
            getStickerItemsFromCategory(rawCategory).forEach((rawItem, itemIndex) => {
                const sourceItem = typeof rawItem === 'string'
                    ? { name: `表情 ${itemIndex + 1}`, url: rawItem }
                    : rawItem;
                if (!sourceItem || typeof sourceItem !== 'object') {
                    report.stickers.skippedItems += 1;
                    return;
                }
                const item = sanitizePersistentValue(cloneDeep(sourceItem));
                const name = String(sourceItem.name ?? sourceItem.title ?? sourceItem.label ?? sourceItem.id ?? `表情 ${itemIndex + 1}`).trim();
                let assetId = getStickerAssetId(sourceItem);
                let url = getStickerUrl(sourceItem);
                if (isDataUrl(url)) {
                    try {
                        const blob = dataUrlToBlob(url);
                        if (!blob.size) throw new Error('Empty sticker image.');
                        assetId = assetId || `sticker_import_${createChecksum(url)}`;
                        upsertBackupRecord(storesData, STORES.assets, {
                            id: assetId,
                            blob,
                            mimeType: blob.type || 'application/octet-stream',
                            ownerType: 'im_sticker',
                            ownerId: categoryName,
                            field: name,
                            updatedAt: Date.now()
                        });
                        availableAssetIds.add(assetId);
                        url = '';
                    } catch (error) {
                        report.stickers.invalidImages += 1;
                        report.stickers.skippedItems += 1;
                        return;
                    }
                } else if (isBlobUrl(url)) {
                    url = '';
                    report.stickers.expiredBlobUrls += 1;
                }
                if (assetId && !availableAssetIds.has(assetId)) {
                    if (!url) {
                        report.stickers.missingAssets += 1;
                        report.stickers.skippedItems += 1;
                        return;
                    }
                    assetId = '';
                }
                if (!assetId && !url) {
                    report.stickers.skippedItems += 1;
                    return;
                }
                normalizedItems.push({
                    ...item,
                    name,
                    url: url || null,
                    assetId: assetId || ''
                });
                report.stickers.importedItems += 1;
            });
            if (normalizedItems.length === 0) {
                report.stickers.skippedCategories += 1;
                return;
            }
            upsertBackupRecord(storesData, STORES.imStickers, {
                ...sanitizePersistentValue(cloneDeep(rawCategory)),
                categoryName,
                items: normalizedItems
            });
            report.stickers.importedCategories += 1;
        });
    }

    function prepareSnapshotForImport(validation) {
        const source = validation.format === 'legacy'
            ? buildLegacyImportSnapshot(validation.payload)
            : validation.payload;
        const storesData = createEmptyBackupStores();
        const report = {
            sourceFormat: validation.format,
            sourceVersion: validation.summary.schemaVersion,
            stickers: {
                importedCategories: 0,
                importedItems: 0,
                skippedCategories: 0,
                skippedItems: 0,
                missingAssets: 0,
                invalidImages: 0,
                expiredBlobUrls: 0
            }
        };
        const rawStickerRows = collectRawStickerRows(source);
        const stickerAssetReferences = collectStickerAssetReferences(rawStickerRows);
        BACKUP_STORES.forEach((storeName) => {
            if (storeName === STORES.imStickers) return;
            const records = Array.isArray(source.stores?.[storeName]) ? source.stores[storeName] : [];
            records.forEach((record, index) => {
                try {
                    upsertBackupRecord(storesData, storeName, normalizeImportRecord(storeName, record, index));
                } catch (error) {
                    const assetId = storeName === STORES.assets && record?.id != null ? String(record.id) : '';
                    if (assetId && stickerAssetReferences.has(assetId)) {
                        report.stickers.invalidImages += 1;
                        return;
                    }
                    throw error;
                }
            });
        });
        normalizeStickerRowsForImport(rawStickerRows, storesData, report);
        mergeLegacyStorageRowsIntoSnapshot(storesData, source.localStorage);

        const oldAppStateIndex = storesData[STORES.settings].findIndex((row) => row?.key === 'appState');
        if (oldAppStateIndex >= 0) {
            const oldAppState = storesData[STORES.settings][oldAppStateIndex]?.value;
            if (oldAppState && typeof oldAppState === 'object') {
                const syntheticRows = [{ key: 'u2_appState', value: JSON.stringify(oldAppState) }];
                mergeLegacyStorageRowsIntoSnapshot(storesData, syntheticRows);
            }
            storesData[STORES.settings].splice(oldAppStateIndex, 1);
        }
        upsertBackupRecord(storesData, STORES.meta, { key: META_KEYS.schemaVersion, value: STORAGE_SCHEMA_VERSION });
        return { stores: storesData, localStorage: [], report };
    }

    function inspectBackupPayload(payload = {}) {
        return validateBackupPayload(payload).summary;
    }

    async function clearManagedPersistence() {
        try {
            clearRuntimeAssetCache();
        } catch (e) {}
        const databaseDeleted = await clearAllData();
        return { databaseDeleted };
    }

    async function writeSnapshotToConnection(db, snapshot = {}, progressCallback) {
        const signatures = {};
        for (let index = 0; index < BACKUP_STORES.length; index += 1) {
            const storeName = BACKUP_STORES[index];
            const rows = Array.isArray(snapshot.stores?.[storeName]) ? snapshot.stores[storeName] : [];
            const orderedRows = sortStoreRowsByKey(storeName, rows);
            reportProgress(progressCallback, `校验并写入 ${storeName}...`, 12 + ((index + 1) / BACKUP_STORES.length) * 58);
            await replaceConnectionStore(db, storeName, orderedRows);
            const copiedRows = await getAllFromConnection(db, storeName);
            const expected = await buildStoreSignature(storeName, orderedRows);
            const actual = await buildStoreSignature(storeName, copiedRows);
            if (expected.count !== actual.count || expected.bytes !== actual.bytes || expected.checksum !== actual.checksum) {
                throw new Error(`Import verification failed for ${storeName}.`);
            }
            signatures[storeName] = actual;
        }
        return signatures;
    }

    async function promoteImportShadow(shadowDb, importId, progressCallback) {
        let rollbackDb = null;
        let mainDeleted = false;
        let rollbackRestored = false;
        let preserveRollback = false;

        try {
            const currentDb = await openDb();
            await deleteDatabaseSafe(IMPORT_ROLLBACK_DB_NAME);
            rollbackDb = await createDbConnection(IMPORT_ROLLBACK_DB_NAME);
            reportProgress(progressCallback, '正在创建当前数据保护副本...', 76);
            const rollbackSignatures = await copyDatabaseContents(currentDb, rollbackDb, progressCallback, 76, 2);
            await setConnectionMeta(rollbackDb, 'import_rollback_ready', {
                importId,
                createdAt: Date.now(),
                signatures: rollbackSignatures
            });

            try {
                currentDb.close();
            } catch (error) {}
            dbPromise = null;
            reportProgress(progressCallback, '正在安全切换数据库...', 78);
            const deleted = await deleteDatabaseSafe(DB_NAME);
            if (!deleted.deleted) {
                throw new Error(deleted.reason === 'blocked'
                    ? '数据库正被其他页面占用，请关闭本项目的其他标签页后重试。'
                    : `Current database could not be replaced: ${deleted.reason}`);
            }
            mainDeleted = true;

            const replacementDb = await openDb();
            await copyDatabaseContents(shadowDb, replacementDb, progressCallback, 80, 17);
            await setConnectionMeta(replacementDb, 'import_restore_complete', { importId, restoredAt: Date.now() });
            try {
                replacementDb.close();
            } catch (error) {}
            dbPromise = null;

            rollbackDb.close();
            rollbackDb = null;
            try {
                await deleteDatabaseSafe(IMPORT_ROLLBACK_DB_NAME);
            } catch (cleanupError) {}
            return true;
        } catch (error) {
            if (mainDeleted && rollbackDb) {
                try {
                    const restoredDb = await openDb();
                    await copyDatabaseContents(rollbackDb, restoredDb, null);
                    await setConnectionMeta(restoredDb, 'import_rollback_restored', {
                        importId,
                        restoredAt: Date.now()
                    });
                    rollbackRestored = true;
                } catch (rollbackError) {
                    preserveRollback = true;
                    console.error('Failed to restore the pre-import database', rollbackError);
                }
            }

            if (rollbackRestored) {
                error.message = `${error.message} 已自动恢复导入前的数据。`;
            } else if (mainDeleted) {
                error.message = `${error.message} 导入前的数据保护副本仍保留，重新打开应用会自动恢复。`;
            }
            throw error;
        } finally {
            try {
                rollbackDb?.close();
            } catch (error) {}
            if (!preserveRollback) {
                try {
                    await deleteDatabaseSafe(IMPORT_ROLLBACK_DB_NAME);
                } catch (cleanupError) {}
            }
        }
    }

    async function openExistingImportRollbackDatabase() {
        if (!window.indexedDB) return null;
        if (typeof window.indexedDB.databases === 'function') {
            try {
                const databases = await window.indexedDB.databases();
                if (!databases.some((item) => item?.name === IMPORT_ROLLBACK_DB_NAME)) return null;
            } catch (error) {}
        }
        const db = await createDbConnection(IMPORT_ROLLBACK_DB_NAME);
        const marker = await new Promise((resolve, reject) => {
            const request = db.transaction(STORES.meta, 'readonly').objectStore(STORES.meta).get('import_rollback_ready');
            request.onsuccess = () => resolve(request.result?.value || null);
            request.onerror = () => reject(request.error);
        });
        if (!marker?.importId) {
            db.close();
            await deleteDatabaseSafe(IMPORT_ROLLBACK_DB_NAME);
            return null;
        }
        return { db, marker };
    }

    async function recoverImportRollbackIfNeeded() {
        const rollback = await openExistingImportRollbackDatabase();
        if (!rollback) return false;

        const mainDb = await openDb();
        const currentMarker = await new Promise((resolve, reject) => {
            const request = mainDb.transaction(STORES.meta, 'readonly').objectStore(STORES.meta).get('import_restore_complete');
            request.onsuccess = () => resolve(request.result?.value || null);
            request.onerror = () => reject(request.error);
        });
        const importCompleted = currentMarker?.importId === rollback.marker.importId;
        if (!importCompleted) {
            await copyDatabaseContents(rollback.db, mainDb, null);
            await setConnectionMeta(mainDb, 'import_rollback_restored', {
                importId: rollback.marker.importId,
                restoredAt: Date.now(),
                recoveredAtStartup: true
            });
        }

        rollback.db.close();
        await deleteDatabaseSafe(IMPORT_ROLLBACK_DB_NAME);
        if (!importCompleted) await deleteDatabaseSafe(IMPORT_SHADOW_DB_NAME);
        return !importCompleted;
    }

    async function openExistingImportShadowDatabase() {
        if (!window.indexedDB) return null;
        if (typeof window.indexedDB.databases === 'function') {
            try {
                const databases = await window.indexedDB.databases();
                if (!databases.some((item) => item?.name === IMPORT_SHADOW_DB_NAME)) return null;
            } catch (error) {}
        }
        const db = await createDbConnection(IMPORT_SHADOW_DB_NAME);
        const marker = await new Promise((resolve, reject) => {
            const request = db.transaction(STORES.meta, 'readonly').objectStore(STORES.meta).get('import_shadow_ready');
            request.onsuccess = () => resolve(request.result?.value || null);
            request.onerror = () => reject(request.error);
        });
        if (!marker?.importId) {
            db.close();
            await deleteDatabaseSafe(IMPORT_SHADOW_DB_NAME);
            return null;
        }
        return { db, marker };
    }

    async function recoverImportShadowIfNeeded() {
        const shadow = await openExistingImportShadowDatabase();
        if (!shadow) return false;
        const mainDb = await openDb();
        const currentMarker = await new Promise((resolve, reject) => {
            const request = mainDb.transaction(STORES.meta, 'readonly').objectStore(STORES.meta).get('import_restore_complete');
            request.onsuccess = () => resolve(request.result?.value || null);
            request.onerror = () => reject(request.error);
        });
        if (!currentMarker || currentMarker.importId !== shadow.marker.importId) {
            await copyDatabaseContents(shadow.db, mainDb, null);
            await setConnectionMeta(mainDb, 'import_restore_complete', {
                importId: shadow.marker.importId,
                restoredAt: Date.now(),
                recoveredAtStartup: true
            });
        }
        shadow.db.close();
        await deleteDatabaseSafe(IMPORT_SHADOW_DB_NAME);
        return true;
    }

    async function restoreBackupSnapshot(snapshot = {}, progressCallback) {
        const storesData = snapshot.stores || {};
        const storeNames = BACKUP_STORES;

        reportProgress(progressCallback, '清理旧数据...', 0);
        await clearManagedPersistence();
        reportProgress(progressCallback, '恢复数据库...', 12);

        for (let i = 0; i < storeNames.length; i += 1) {
            const storeName = storeNames[i];
            const records = Array.isArray(storesData[storeName]) ? storesData[storeName] : [];
            const baseProgress = 12 + Math.floor((i / storeNames.length) * 72);
            reportProgress(progressCallback, `恢复 ${storeName}...`, baseProgress);

            if (records.length === 0) continue;

            await withStore([storeName], 'readwrite', (stores) => {
                const store = stores[storeName];
                records.forEach((record) => {
                    store.put(deserializeBackupRecord(storeName, record));
                });
            });
        }

        const legacyRows = (Array.isArray(snapshot.localStorage) ? snapshot.localStorage : [])
            .filter((row) => row?.key);
        if (legacyRows.length > 0) {
            reportProgress(progressCallback, '迁移旧版兼容数据...', 90);
            await importLegacyBackupStorageRows(legacyRows);
        }
        reportProgress(progressCallback, '导入完成', 100);
        return true;
    }

    async function importLegacyBackupPayload(payload = {}, progressCallback) {
        const safe = payload && typeof payload === 'object' ? payload : {};
        const globalData = safe.globalData || {};

        reportProgress(progressCallback, '迁移旧格式全局数据...', 18);
        await saveGlobalData(globalData);

        const imessage = safe.imessage && typeof safe.imessage === 'object' ? safe.imessage : {};
        const friends = Array.isArray(imessage.friends) ? imessage.friends : [];
        if (friends.length > 0) {
            reportProgress(progressCallback, '迁移聊天联系人...', 36);
            await withStore([STORES.imFriends], 'readwrite', (stores) => {
                friends.forEach((friend) => stores[STORES.imFriends].put(friend));
            });
        }

        const messages = Array.isArray(imessage.messages) ? imessage.messages : [];
        if (messages.length > 0) {
            reportProgress(progressCallback, '迁移聊天记录...', 48);
            await withStore([STORES.imMessages], 'readwrite', (stores) => {
                messages.forEach((message) => stores[STORES.imMessages].put(message));
            });
        }

        const moments = Array.isArray(imessage.moments) ? imessage.moments : [];
        if (moments.length > 0) {
            reportProgress(progressCallback, '迁移朋友圈...', 58);
            await withStore([STORES.imMoments], 'readwrite', (stores) => {
                moments.forEach((moment) => stores[STORES.imMoments].put(moment));
            });
        }

        const momentMessages = Array.isArray(imessage.momentMessages) ? imessage.momentMessages : [];
        if (momentMessages.length > 0) {
            reportProgress(progressCallback, '迁移朋友圈消息...', 68);
            await withStore([STORES.imMomentMessages], 'readwrite', (stores) => {
                momentMessages.forEach((message) => stores[STORES.imMomentMessages].put(message));
            });
        }

        const stickers = Array.isArray(imessage.stickers) ? imessage.stickers : [];
        if (stickers.length > 0) {
            reportProgress(progressCallback, '迁移贴纸...', 76);
            await withStore([STORES.imStickers], 'readwrite', (stores) => {
                stickers.forEach((sticker) => stores[STORES.imStickers].put(sticker));
            });
        }

        if (imessage.momentsCoverUrlMeta !== undefined) {
            await setMeta(META_KEYS.imMomentsCoverAssetId, imessage.momentsCoverUrlMeta);
        } else if (imessage.momentsCoverUrl) {
            await saveMomentsCover(imessage.momentsCoverUrl);
        }

        const assetsArray = Array.isArray(safe.assets) ? safe.assets : [];
        if (assetsArray.length > 0) {
            reportProgress(progressCallback, '迁移图片资源...', 86);
            await withStore([STORES.assets], 'readwrite', (stores) => {
                assetsArray.forEach((record) => {
                    if (record && record.id && record.dataUrl) {
                        stores[STORES.assets].put(deserializeBackupRecord(STORES.assets, record));
                    }
                });
            });
        }

        reportProgress(progressCallback, '旧格式迁移完成', 100);
        return true;
    }

    async function exportAllData(progressCallback) {
        reportProgress(progressCallback, '正在完成待保存数据...', 0);
        if (!await flushPendingWrites()) throw new Error('Pending writes could not be completed before export.');
        const snapshot = await collectBackupSnapshot(progressCallback);
        const blob = await serializeBackupBlob(snapshot, progressCallback);
        reportProgress(progressCallback, '导出完成', 100);
        return blob;
    }

    async function importAllData(payload = {}, progressCallback) {
        const validation = validateBackupPayload(payload);
        reportProgress(progressCallback, '正在预迁移并校验备份...', 3);
        const prepared = prepareSnapshotForImport(validation);
        const approximateBytes = estimateJsonBytes(prepared);
        if (navigator.storage?.estimate) {
            const estimate = await navigator.storage.estimate();
            const usage = Math.max(0, Number(estimate?.usage) || 0);
            const quota = Math.max(0, Number(estimate?.quota) || 0);
            const required = Math.max(4 * 1024 * 1024, Math.ceil(approximateBytes * 1.2));
            if (quota > 0 && Math.max(0, quota - usage) < required) {
                throw new DOMException(`安全导入需要约 ${formatBytes(required)} 的临时空间。`, 'QuotaExceededError');
            }
        }
        if (!await flushPendingWrites()) throw new Error('Pending writes could not be completed before import.');

        replacementInProgress = true;
        let shadowDb = null;
        const importId = `import_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        try {
            await deleteDatabaseSafe(IMPORT_SHADOW_DB_NAME);
            shadowDb = await createDbConnection(IMPORT_SHADOW_DB_NAME);
            const signatures = await writeSnapshotToConnection(shadowDb, prepared, progressCallback);
            await setConnectionMeta(shadowDb, 'import_shadow_ready', {
                importId,
                createdAt: Date.now(),
                sourceVersion: validation.summary.schemaVersion,
                sourceFormat: validation.format,
                report: prepared.report,
                signatures
            });
            reportProgress(progressCallback, '隔离数据校验完成...', 74);
            await promoteImportShadow(shadowDb, importId, progressCallback);
            shadowDb.close();
            shadowDb = null;
            await deleteDatabaseSafe(IMPORT_SHADOW_DB_NAME);
            domainCache.clear();
            const importedDomains = await getAllRecords(STORES.appDomains);
            for (const record of importedDomains) {
                if (record?.name) domainCache.set(String(record.name), cloneDeep(record.value));
            }
            reportProgress(progressCallback, '导入完成', 100);
            return cloneDeep(prepared.report);
        } catch (error) {
            try {
                if (shadowDb) shadowDb.close();
            } catch (closeError) {}
            try {
                await deleteDatabaseSafe(IMPORT_SHADOW_DB_NAME);
            } catch (cleanupError) {}
            throw error;
        } finally {
            replacementInProgress = false;
        }
    }

    function formatBytes(bytes = 0) {
        const size = Math.max(0, Number(bytes) || 0);
        if (size < 1024) return `${size} B`;

        const units = ['KB', 'MB', 'GB', 'TB'];
        let value = size / 1024;
        let unitIndex = 0;

        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex += 1;
        }

        const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2;
        return `${value.toFixed(precision)} ${units[unitIndex]}`;
    }

    async function measureApproximateUsage() {
        const breakdown = await getStorageBreakdown({ skipReady: true });
        return Math.max(0, Number(breakdown.logicalBytes) || 0);
    }

    async function getUsageSummary() {
        const [cacheBytes, totalBytes] = await Promise.all([
            measureRuntimeCacheUsage(),
            measureApproximateUsage()
        ]);

        return {
            cacheBytes,
            totalBytes,
            cacheFormatted: formatBytes(cacheBytes),
            totalFormatted: formatBytes(totalBytes),
            label: `${formatBytes(cacheBytes)} / ${formatBytes(totalBytes)}`
        };
    }

    async function getStorageHealth() {
        if (storageReadyPromise) await storageReadyPromise;
        let usage = 0;
        let quota = 0;
        let persisted = false;
        try {
            if (navigator.storage?.estimate) {
                const estimate = await navigator.storage.estimate();
                usage = Math.max(0, Number(estimate?.usage) || 0);
                quota = Math.max(0, Number(estimate?.quota) || 0);
            }
            if (navigator.storage?.persisted) persisted = !!(await navigator.storage.persisted());
        } catch (error) {}
        const breakdown = await getStorageBreakdown({ skipReady: true });
        return {
            ...cloneDeep(storageHealthState),
            usage,
            quota,
            ratio: quota > 0 ? usage / quota : 0,
            persisted,
            breakdown
        };
    }

    function measureBlobBytes(value, seen = new WeakSet()) {
        if (!value || typeof value !== 'object') return 0;
        if (typeof Blob !== 'undefined' && value instanceof Blob) return Math.max(0, Number(value.size) || 0);
        if (seen.has(value)) return 0;
        seen.add(value);
        if (Array.isArray(value)) return value.reduce((sum, item) => sum + measureBlobBytes(item, seen), 0);
        return Object.values(value).reduce((sum, item) => sum + measureBlobBytes(item, seen), 0);
    }

    function measureRecordBytes(record) {
        return estimateJsonBytes(record) + measureBlobBytes(record);
    }

    const STORAGE_BREAKDOWN_GROUPS = {
        appDomains: '应用状态',
        settings: '应用状态',
        accounts: '应用状态',
        appState: '应用状态',
        theme: '应用状态',
        worldbooks: '应用状态',
        meta: '应用状态',
        imFriends: 'iMessage',
        imChatSummaries: 'iMessage',
        imMessages: 'iMessage',
        imMoments: 'iMessage',
        imMomentMessages: 'iMessage',
        imStickers: 'iMessage',
        xPosts: 'X',
        xThreads: 'X',
        xDms: 'X',
        xAccountWorlds: 'X',
        assets: '图片资源',
        libraryBooks: '书库',
        libraryBookContent: '书库',
        libraryPlaylists: '书库',
        libraryTracks: '书库',
        libraryDailyStats: '书库',
        storageCheckpoints: '冗余历史'
    };

    async function getStorageBreakdown(options = {}) {
        if (!options.skipReady && storageReadyPromise) await storageReadyPromise;
        const stores = {};
        const groups = {};
        let indexedDbBytes = 0;
        for (const [storeKey, storeName] of Object.entries(STORES)) {
            const rows = await getAllRecords(storeName);
            const bytes = rows.reduce((sum, row) => sum + measureRecordBytes(row), 0);
            stores[storeName] = { count: rows.length, bytes };
            indexedDbBytes += bytes;
            const groupName = STORAGE_BREAKDOWN_GROUPS[storeKey] || '其他数据';
            const group = groups[groupName] || { count: 0, bytes: 0 };
            group.count += rows.length;
            group.bytes += bytes;
            groups[groupName] = group;
        }
        const logicalGroups = cloneDeep(groups);
        let originUsage = 0;
        let quota = 0;
        let usageDetails = {};
        try {
            const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
            originUsage = Math.max(0, Number(estimate?.usage) || 0);
            quota = Math.max(0, Number(estimate?.quota) || 0);
            usageDetails = estimate?.usageDetails && typeof estimate.usageDetails === 'object'
                ? Object.fromEntries(Object.entries(estimate.usageDetails).map(([key, value]) => [key, Math.max(0, Number(value) || 0)]))
                : {};
        } catch (error) {}
        const readUsageDetail = (...keys) => keys.reduce((value, key) => value || Math.max(0, Number(usageDetails[key]) || 0), 0);
        const indexedDbReportedBytes = readUsageDetail('indexedDB', 'indexeddb');
        const cacheBytes = readUsageDetail('caches', 'cacheStorage', 'cache_storage');
        const serviceWorkerBytes = readUsageDetail('serviceWorkerRegistrations', 'service_workers');
        const databaseOverheadBytes = indexedDbReportedBytes > 0
            ? Math.max(0, indexedDbReportedBytes - indexedDbBytes)
            : 0;
        const classifiedBytes = indexedDbReportedBytes + cacheBytes + serviceWorkerBytes;
        const browserOtherBytes = Math.max(0, originUsage - (classifiedBytes || indexedDbBytes));
        if (databaseOverheadBytes > 0) groups['IndexedDB 数据库开销'] = { count: 0, bytes: databaseOverheadBytes };
        if (cacheBytes > 0) groups['页面缓存'] = { count: 0, bytes: cacheBytes };
        if (browserOtherBytes > 0) groups[indexedDbReportedBytes > 0 ? '浏览器其他占用' : '浏览器未分类占用（估算）'] = { count: 0, bytes: browserOtherBytes };
        return {
            stores,
            groups,
            logicalGroups,
            indexedDbBytes,
            logicalBytes: indexedDbBytes,
            indexedDbReportedBytes,
            databaseOverheadBytes,
            cacheBytes,
            browserOtherBytes,
            originUsage,
            quota,
            usageDetails,
            classificationExact: indexedDbReportedBytes > 0 || cacheBytes > 0,
            otherBytes: browserOtherBytes,
            measuredAt: Date.now()
        };
    }

    async function deduplicateStoredImessageAssets() {
        const [friendRows, messageRows, stickerRows] = await Promise.all([
            getAllRecords(STORES.imFriends),
            getAllRecords(STORES.imMessages),
            getAllRecords(STORES.imStickers)
        ]);
        let recordsConverted = 0;
        for (const friend of friendRows) {
            const hasEmbedded = FRIEND_ASSET_FIELDS.some(([urlField]) => isDataUrl(friend?.[urlField]))
                || (Array.isArray(friend?.members) && friend.members.some((member) => isDataUrl(member?.avatarUrl)));
            if (!hasEmbedded) continue;
            const prepared = await persistFriendAssets(friend);
            await putRecord(STORES.imFriends, sanitizePersistentValue(prepared));
            recordsConverted += 1;
        }
        for (let index = 0; index < messageRows.length; index += 1) {
            const message = messageRows[index];
            if (!MESSAGE_ASSET_FIELDS.some(([urlField]) => isDataUrl(message?.[urlField]))) continue;
            const prepared = await prepareMessageForStorage(message.friendId, message, message.order ?? index);
            await putRecord(STORES.imMessages, normalizeMessageRecord(message.friendId, prepared, message.order ?? index));
            recordsConverted += 1;
        }
        const hasEmbeddedStickers = stickerRows.some((category) =>
            (Array.isArray(category?.items) ? category.items : []).some((sticker) => isDataUrl(sticker?.url))
        );
        if (hasEmbeddedStickers) {
            await saveStickers(stickerRows);
            recordsConverted += stickerRows.length;
        }
        return recordsConverted;
    }

    async function compactStorage(options = {}) {
        if (!options.skipReady && storageReadyPromise) await storageReadyPromise;
        const existingReport = await getMeta('storage_compacted_v8');
        if (existingReport && !options.force) {
            storageHealthState.lastCompaction = cloneDeep(existingReport);
            return cloneDeep(existingReport);
        }

        const before = await getStorageBreakdown({ skipReady: true });
        const [checkpoints, domains, friends, summaries, messages, moments, momentMessages, stickers, xPosts, xThreads, xDms, oldAppStateRecord, momentsCoverMeta] = await Promise.all([
            getAllRecords(STORES.storageCheckpoints),
            getAllRecords(STORES.appDomains),
            getAllRecords(STORES.imFriends),
            getAllRecords(STORES.imChatSummaries),
            getAllRecords(STORES.imMessages),
            getAllRecords(STORES.imMoments),
            getAllRecords(STORES.imMomentMessages),
            getAllRecords(STORES.imStickers),
            getAllRecords(STORES.xPosts),
            getAllRecords(STORES.xThreads),
            getAllRecords(STORES.xDms),
            getRecord(STORES.settings, 'appState'),
            getRecord(STORES.meta, META_KEYS.imMomentsCoverAssetId)
        ]);

        const domainNames = new Set(domains.map((row) => String(row?.name || '')).filter(Boolean));
        const friendIds = new Set(friends.map((row) => String(row?.id || '')).filter(Boolean));
        const summaryIds = new Set(summaries.map((row) => String(row?.friendId || '')).filter(Boolean));
        const messageIds = new Set(messages.map((row) => String(row?.id || '')).filter(Boolean));
        const momentIds = new Set(moments.map((row) => String(row?.id || '')).filter(Boolean));
        const momentMessageIds = new Set(momentMessages.map((row) => String(row?.id || '')).filter(Boolean));
        const stickerIds = new Set(stickers.map((row) => String(row?.categoryName || '')).filter(Boolean));
        const xPostIds = new Set(xPosts.map((row) => String(row?.id || '')).filter(Boolean));
        const xThreadIds = new Set(xThreads.map((row) => String(row?.postId || '')).filter(Boolean));
        const xDmIds = new Set(xDms.map((row) => String(row?.id || '')).filter(Boolean));
        const recoveredDomains = [];
        const recoveredFriends = [];
        const recoveredMessages = [];
        const recoveredMoments = [];
        const recoveredMomentMessages = [];
        const recoveredStickers = [];
        let coverRecoveryValue;

        const domainCheckpoints = new Map();
        checkpoints.forEach((checkpoint) => {
            if (checkpoint?.id?.startsWith('domain:') && checkpoint.current?.value && typeof checkpoint.current.value === 'object') {
                domainCheckpoints.set(checkpoint.id.slice('domain:'.length), checkpoint.current.value);
            }
            if (checkpoint?.id?.startsWith('im-friend:') && checkpoint.current?.value) {
                const friendId = checkpoint.id.slice('im-friend:'.length);
                if (!friendIds.has(friendId)) recoveredFriends.push(sanitizePersistentValue(cloneDeep(checkpoint.current.value)));
            }
            if (checkpoint?.id?.startsWith('im-messages:') && Array.isArray(checkpoint.current?.value)) {
                const friendId = checkpoint.id.slice('im-messages:'.length);
                checkpoint.current.value.forEach((message, index) => {
                    if (!message?.id || messageIds.has(String(message.id))) return;
                    recoveredMessages.push(normalizeMessageRecord(friendId, message, index));
                });
            }
            if (checkpoint?.id === 'im-moments-cover' && !momentsCoverMeta && checkpoint.current?.value) {
                coverRecoveryValue = cloneDeep(checkpoint.current.value);
            }
        });

        const oldAppState = oldAppStateRecord?.value && typeof oldAppStateRecord.value === 'object'
            ? oldAppStateRecord.value
            : {};
        const currentImessageDomain = domains.find((row) => row?.name === 'imessage');
        const legacyImessageValues = [oldAppState.imessage, currentImessageDomain?.value]
            .filter((value) => value && typeof value === 'object');
        legacyImessageValues.forEach((legacyImessage) => {
            const legacyFriends = Array.isArray(legacyImessage.friends) ? legacyImessage.friends : [];
            legacyFriends.forEach((friend) => {
                if (!friend || friend.id == null) return;
                const friendId = String(friend.id);
                if (!friendIds.has(friendId)) {
                    const friendMeta = sanitizePersistentValue(cloneDeep(friend));
                    delete friendMeta.messages;
                    recoveredFriends.push({ ...friendMeta, id: friendId });
                    friendIds.add(friendId);
                }
                (Array.isArray(friend.messages) ? friend.messages : []).forEach((message, index) => {
                    if (!message) return;
                    const normalized = normalizeMessageRecord(friendId, message, index);
                    if (messageIds.has(String(normalized.id))) return;
                    recoveredMessages.push(normalized);
                    messageIds.add(String(normalized.id));
                });
            });
            (Array.isArray(legacyImessage.messages) ? legacyImessage.messages : []).forEach((message, index) => {
                if (!message) return;
                const friendId = String(message.friendId ?? message.chatId ?? 'legacy');
                const normalized = normalizeMessageRecord(friendId, message, index);
                if (messageIds.has(String(normalized.id))) return;
                recoveredMessages.push(normalized);
                messageIds.add(String(normalized.id));
            });
            (Array.isArray(legacyImessage.moments) ? legacyImessage.moments : []).forEach((moment) => {
                if (!moment || moment.id == null || momentIds.has(String(moment.id))) return;
                recoveredMoments.push(sanitizePersistentValue(cloneDeep(moment)));
                momentIds.add(String(moment.id));
            });
            (Array.isArray(legacyImessage.momentMessages) ? legacyImessage.momentMessages : []).forEach((message) => {
                if (!message || message.id == null || momentMessageIds.has(String(message.id))) return;
                recoveredMomentMessages.push(sanitizePersistentValue(cloneDeep(message)));
                momentMessageIds.add(String(message.id));
            });
            (Array.isArray(legacyImessage.stickers) ? legacyImessage.stickers : []).forEach((category) => {
                if (!category || category.categoryName == null || stickerIds.has(String(category.categoryName))) return;
                recoveredStickers.push(sanitizePersistentValue(cloneDeep(category)));
                stickerIds.add(String(category.categoryName));
            });
        });
        const allDomainNames = new Set([...Object.keys(oldAppState), ...domainCheckpoints.keys()]);
        allDomainNames.forEach((name) => {
            if (domainNames.has(name)) return;
            const value = domainCheckpoints.get(name) ?? oldAppState[name];
            if (!value || typeof value !== 'object') {
                throw new Error(`Cannot safely recover missing domain ${name}.`);
            }
            recoveredDomains.push({
                name,
                value: name === 'imessage'
                    ? { uiState: cloneDeep(value.uiState && typeof value.uiState === 'object' ? value.uiState : {}) }
                    : cloneDeep(value)
            });
        });

        const xDomainValue = domains.find((row) => row?.name === 'x')?.value || {};
        const xRecoveryValue = domainCheckpoints.get('x') || oldAppState.x || {};
        const mergedXRecovery = {
            ...xRecoveryValue,
            ...xDomainValue,
            xGeneratedPosts: Array.isArray(xRecoveryValue.xGeneratedPosts) ? xRecoveryValue.xGeneratedPosts : [],
            xPostThreads: xRecoveryValue.xPostThreads && typeof xRecoveryValue.xPostThreads === 'object' ? xRecoveryValue.xPostThreads : {},
            xDirectMessages: Array.isArray(xRecoveryValue.xDirectMessages) ? xRecoveryValue.xDirectMessages : []
        };

        const summaryRecords = [];
        const allMessageRows = [...messages, ...recoveredMessages];
        for (const friend of [...friends, ...recoveredFriends]) {
            const friendId = String(friend?.id || '');
            if (!friendId || summaryIds.has(friendId)) continue;
            const friendMessages = allMessageRows
                .filter((message) => String(message?.friendId || '') === friendId)
                .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
            const derived = friendMessages.length > 0
                ? await buildFriendMessageSummary(friendMessages)
                : {
                    lastMessagePreview: friend.lastMessagePreview || '',
                    lastMessageTimestamp: Number(friend.lastMessageTimestamp) || 0,
                    messageCount: Number(friend.messageCount) || 0
                };
            summaryRecords.push(normalizeChatSummary(friendId, {
                ...derived,
                unreadCount: friend.unreadCount
            }));
        }

        const now = Date.now();
        await withStore([
            STORES.appDomains,
            STORES.imFriends,
            STORES.imChatSummaries,
            STORES.imMessages,
            STORES.imMoments,
            STORES.imMomentMessages,
            STORES.imStickers,
            STORES.xPosts,
            STORES.xThreads,
            STORES.xDms,
            STORES.assets,
            STORES.meta
        ], 'readwrite', (stores) => {
            recoveredDomains.forEach(({ name, value }) => {
                const persistedValue = name === 'x'
                    ? persistXAssetsInTransaction(value, stores[STORES.assets])
                    : sanitizePersistentValue(cloneDeep(value));
                stores[STORES.appDomains].put({
                    name,
                    schemaVersion: STORAGE_SCHEMA_VERSION,
                    revision: 1,
                    updatedAt: now,
                    value: name === 'x' ? stripXCollections(persistedValue) : persistedValue
                });
            });
            [...friends, ...recoveredFriends].forEach((friend) => {
                const nextFriend = sanitizePersistentValue(cloneDeep(friend));
                delete nextFriend.messages;
                delete nextFriend.lastMessagePreview;
                delete nextFriend.lastMessageTimestamp;
                delete nextFriend.messageCount;
                delete nextFriend.unreadCount;
                stores[STORES.imFriends].put(nextFriend);
            });
            summaryRecords.forEach((summary) => stores[STORES.imChatSummaries].put(summary));
            recoveredMessages.forEach((message) => stores[STORES.imMessages].put(message));
            recoveredMoments.forEach((moment) => stores[STORES.imMoments].put(moment));
            recoveredMomentMessages.forEach((message) => stores[STORES.imMomentMessages].put(message));
            recoveredStickers.forEach((category) => stores[STORES.imStickers].put(category));
            if (currentImessageDomain) {
                stores[STORES.appDomains].put({
                    ...currentImessageDomain,
                    schemaVersion: STORAGE_SCHEMA_VERSION,
                    revision: Math.max(0, Number(currentImessageDomain.revision) || 0) + 1,
                    updatedAt: now,
                    value: {
                        uiState: cloneDeep(currentImessageDomain.value?.uiState && typeof currentImessageDomain.value.uiState === 'object'
                            ? currentImessageDomain.value.uiState
                            : {})
                    }
                });
            }
            if (coverRecoveryValue !== undefined) {
                stores[STORES.meta].put({ key: META_KEYS.imMomentsCoverAssetId, value: coverRecoveryValue });
            }

            const persistedX = persistXAssetsInTransaction(mergedXRecovery, stores[STORES.assets]);
            (persistedX.xGeneratedPosts || []).forEach((post) => {
                if (post?.id != null && !xPostIds.has(String(post.id))) stores[STORES.xPosts].put(sanitizePersistentValue(post));
            });
            Object.entries(persistedX.xPostThreads || {}).forEach(([postId, value]) => {
                if (!xThreadIds.has(String(postId))) stores[STORES.xThreads].put({ postId: String(postId), value: sanitizePersistentValue(value) });
            });
            (persistedX.xDirectMessages || []).forEach((dm, index) => {
                const id = String(dm?.id ?? dm?.charId ?? `x-dm-${index}`);
                if (!xDmIds.has(id)) stores[STORES.xDms].put({ ...sanitizePersistentValue(dm), id, updatedAt: Number(dm?.updatedAt) || now });
            });
        });
        if (currentImessageDomain) {
            domainCache.set('imessage', {
                uiState: cloneDeep(currentImessageDomain.value?.uiState && typeof currentImessageDomain.value.uiState === 'object'
                    ? currentImessageDomain.value.uiState
                    : {})
            });
        }

        const [verifiedDomains, verifiedMessages, verifiedXPosts] = await Promise.all([
            getAllRecords(STORES.appDomains),
            getAllRecords(STORES.imMessages),
            getAllRecords(STORES.xPosts)
        ]);
        const verifiedDomainNames = new Set(verifiedDomains.map((row) => String(row?.name || '')));
        const verifiedMessageIds = new Set(verifiedMessages.map((row) => String(row?.id || '')));
        const verifiedXPostIds = new Set(verifiedXPosts.map((row) => String(row?.id || '')));
        if (recoveredDomains.some(({ name }) => !verifiedDomainNames.has(name))) throw new Error('Domain recovery verification failed.');
        if (recoveredMessages.some((message) => !verifiedMessageIds.has(String(message.id)))) throw new Error('Message recovery verification failed.');
        if ((mergedXRecovery.xGeneratedPosts || []).some((post) => post?.id != null && !verifiedXPostIds.has(String(post.id)))) {
            throw new Error('X post recovery verification failed.');
        }

        const cleanedImessageDomainBytes = currentImessageDomain
            ? measureRecordBytes({ value: { uiState: currentImessageDomain.value?.uiState || {} } })
            : 0;
        const legacyImessageBytes = currentImessageDomain
            ? Math.max(0, measureRecordBytes(currentImessageDomain) - cleanedImessageDomainBytes)
            : 0;
        const redundantBytes = checkpoints.reduce((sum, row) => sum + measureRecordBytes(row), 0)
            + (oldAppStateRecord ? measureRecordBytes(oldAppStateRecord) : 0)
            + legacyImessageBytes;
        await withStore([STORES.storageCheckpoints, STORES.settings, STORES.meta], 'readwrite', (stores) => {
            stores[STORES.storageCheckpoints].clear();
            stores[STORES.settings].delete('appState');
            stores[STORES.meta].put({ key: META_KEYS.schemaVersion, value: STORAGE_SCHEMA_VERSION });
        });
        const mediaRecordsDeduplicated = await deduplicateStoredImessageAssets();
        const orphanAssetsRemoved = await pruneOrphanedAssets();
        const after = await getStorageBreakdown({ skipReady: true });
        const report = {
            schemaVersion: STORAGE_SCHEMA_VERSION,
            compactedAt: Date.now(),
            checkpointRecordsDeleted: checkpoints.length,
            legacyAppStateDeleted: !!oldAppStateRecord,
            domainsRecovered: recoveredDomains.length,
            friendsRecovered: recoveredFriends.length,
            messagesRecovered: recoveredMessages.length,
            momentsRecovered: recoveredMoments.length,
            stickersRecovered: recoveredStickers.length,
            summariesCreated: summaryRecords.length,
            legacyImessageBytesRemoved: legacyImessageBytes,
            mediaRecordsDeduplicated,
            xPostsRecovered: Math.max(0, verifiedXPosts.length - xPosts.length),
            orphanAssetsRemoved,
            estimatedBytesFreed: Math.max(redundantBytes, before.indexedDbBytes - after.indexedDbBytes),
            beforeIndexedDbBytes: before.indexedDbBytes,
            afterIndexedDbBytes: after.indexedDbBytes
        };
        await setMeta('storage_compacted_v8', report);
        await setMeta('storage_last_compaction', report);
        storageHealthState.lastCompaction = cloneDeep(report);
        return cloneDeep(report);
    }

    async function clearSafeCache(options = {}) {
        if (!options.skipReady && storageReadyPromise) await storageReadyPromise;
        const progressCallback = typeof options.progressCallback === 'function' ? options.progressCallback : null;
        storageHealthState.status = 'saving';
        storageHealthState.lastError = null;
        notifyStorageSubscribers({ ...storageHealthState, reason: 'cache-cleanup-start' });

        try {
            reportProgress(progressCallback, '正在完成待保存数据...', 10);
            const flushed = await flushPendingWrites();
            if (!flushed) throw new Error('Pending writes could not be completed before cache cleanup.');

            const before = await getStorageBreakdown({ skipReady: true });
            reportProgress(progressCallback, '正在校验并清理重复数据...', 35);
            const compaction = await compactStorage({ skipReady: true, force: true });

            reportProgress(progressCallback, '正在清理可重新下载的页面缓存...', 72);
            const cacheResults = await clearBrowserCaches();
            const cachesDeleted = cacheResults.filter((item) => item?.deleted).length;
            const cacheDeleteFailures = cacheResults.filter((item) => !item?.deleted).length;

            reportProgress(progressCallback, '正在重新统计空间...', 90);
            const after = await getStorageBreakdown({ skipReady: true });
            const cacheBytesBefore = Math.max(0, Number(before.usageDetails?.caches) || 0);
            const cacheBytesAfter = Math.max(0, Number(after.usageDetails?.caches) || 0);
            const browserCacheBytesFreed = cacheResults.length > 0 && cacheDeleteFailures === 0
                ? Math.max(cacheBytesBefore, cacheBytesBefore - cacheBytesAfter)
                : Math.max(0, cacheBytesBefore - cacheBytesAfter);
            const estimateDelta = Math.max(0, before.originUsage - after.originUsage);
            const report = {
                clearedAt: Date.now(),
                cacheEntriesFound: cacheResults.length,
                cachesDeleted,
                cacheDeleteFailures,
                checkpointRecordsDeleted: Number(compaction?.checkpointRecordsDeleted) || 0,
                orphanAssetsRemoved: Number(compaction?.orphanAssetsRemoved) || 0,
                estimatedBytesFreed: Math.max(
                    estimateDelta,
                    (Number(compaction?.estimatedBytesFreed) || 0) + browserCacheBytesFreed
                ),
                beforeUsage: before.originUsage,
                afterUsage: after.originUsage
            };
            await setMeta('storage_last_cache_cleanup', report);
            storageHealthState.status = cacheDeleteFailures > 0 ? 'error' : 'saved';
            storageHealthState.lastError = cacheDeleteFailures > 0
                ? `${cacheDeleteFailures} browser cache item(s) could not be deleted.`
                : null;
            storageHealthState.lastCacheCleanup = cloneDeep(report);
            notifyStorageSubscribers({ ...storageHealthState, reason: 'cache-cleanup-complete' });
            reportProgress(progressCallback, '缓存清理完成', 100);
            return cloneDeep(report);
        } catch (error) {
            storageHealthState.status = 'error';
            storageHealthState.lastError = error?.message || String(error);
            notifyStorageSubscribers({ ...storageHealthState, reason: 'cache-cleanup-error' });
            throw error;
        }
    }

    async function optimizeStorage(options = {}) {
        if (!options.skipReady && storageReadyPromise) await storageReadyPromise;
        const progressCallback = typeof options.progressCallback === 'function' ? options.progressCallback : null;
        storageHealthState.status = 'saving';
        storageHealthState.lastError = null;
        notifyStorageSubscribers({ ...storageHealthState, reason: 'storage-optimization-start' });
        let shadowDb = null;
        try {
            reportProgress(progressCallback, '正在完成待保存数据...', 4);
            if (!await flushPendingWrites()) throw new Error('Pending writes could not be completed before optimization.');
            await compactStorage({ skipReady: true, force: true });
            const before = await getStorageBreakdown({ skipReady: true });
            const availableBytes = before.quota > 0 ? Math.max(0, before.quota - before.originUsage) : Number.POSITIVE_INFINITY;
            const requiredBytes = Math.max(8 * 1024 * 1024, Math.ceil(before.logicalBytes * 1.15));
            if (availableBytes < requiredBytes) {
                throw new DOMException(
                    `Safe optimization needs about ${formatBytes(requiredBytes)} of free temporary space.`,
                    'QuotaExceededError'
                );
            }

            await deleteDatabaseSafe(OPTIMIZATION_SHADOW_DB_NAME);
            shadowDb = await createDbConnection(OPTIMIZATION_SHADOW_DB_NAME);
            const mainDb = await openDb();
            const optimizationId = `opt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            reportProgress(progressCallback, '正在创建安全影子数据库...', 10);
            const signatures = await copyDatabaseContents(mainDb, shadowDb, progressCallback, 10, 42);
            await setConnectionMeta(shadowDb, 'optimization_shadow_ready', {
                optimizationId,
                createdAt: Date.now(),
                signatures
            });

            try {
                mainDb.close();
            } catch (error) {}
            dbPromise = null;
            reportProgress(progressCallback, '正在重建主数据库...', 56);
            const deleted = await deleteDatabaseSafe(DB_NAME);
            if (!deleted.deleted) {
                throw new Error(deleted.reason === 'blocked'
                    ? '数据库正被其他页面占用，请关闭本项目的其他标签页后重试。'
                    : `Main database could not be rebuilt: ${deleted.reason}`);
            }

            const rebuiltDb = await openDb();
            await copyDatabaseContents(shadowDb, rebuiltDb, progressCallback, 58, 36);
            await setConnectionMeta(rebuiltDb, 'optimization_restore_complete', {
                optimizationId,
                restoredAt: Date.now()
            });
            shadowDb.close();
            shadowDb = null;
            await deleteDatabaseSafe(OPTIMIZATION_SHADOW_DB_NAME);
            const after = await getStorageBreakdown({ skipReady: true });
            const report = {
                optimizedAt: Date.now(),
                compactedAt: Date.now(),
                optimizationId,
                logicalBytesBefore: before.logicalBytes,
                logicalBytesAfter: after.logicalBytes,
                browserUsageBefore: before.originUsage,
                browserUsageAfter: after.originUsage,
                estimatedBytesFreed: Math.max(0, before.originUsage - after.originUsage),
                databaseOverheadBefore: before.databaseOverheadBytes,
                databaseOverheadAfter: after.databaseOverheadBytes,
                verifiedStores: Object.keys(signatures).length
            };
            await setMeta('storage_last_optimization', report);
            storageHealthState.status = 'saved';
            storageHealthState.lastCompaction = cloneDeep(report);
            notifyStorageSubscribers({ ...storageHealthState, reason: 'storage-optimization-complete' });
            reportProgress(progressCallback, '存储优化完成', 100);
            return cloneDeep(report);
        } catch (error) {
            try {
                if (shadowDb) shadowDb.close();
            } catch (closeError) {}
            storageHealthState.status = 'error';
            storageHealthState.lastError = error?.message || String(error);
            notifyStorageSubscribers({ ...storageHealthState, reason: 'storage-optimization-error' });
            throw error;
        }
    }

    async function recoverOptimizationShadowIfNeeded() {
        const shadow = await openExistingShadowDatabase();
        if (!shadow) return false;
        const mainDb = await openDb();
        const currentMarker = await new Promise((resolve, reject) => {
            const request = mainDb.transaction(STORES.meta, 'readonly').objectStore(STORES.meta).get('optimization_restore_complete');
            request.onsuccess = () => resolve(request.result?.value || null);
            request.onerror = () => reject(request.error);
        });
        if (!currentMarker || currentMarker.optimizationId !== shadow.marker.optimizationId) {
            await copyDatabaseContents(shadow.db, mainDb, null);
            await setConnectionMeta(mainDb, 'optimization_restore_complete', {
                optimizationId: shadow.marker.optimizationId,
                restoredAt: Date.now()
            });
        }
        shadow.db.close();
        await deleteDatabaseSafe(OPTIMIZATION_SHADOW_DB_NAME);
        return true;
    }

    async function initializeUnifiedStorage() {
        storageHealthState.status = 'initializing';
        await recoverImportRollbackIfNeeded();
        await recoverImportShadowIfNeeded();
        await recoverOptimizationShadowIfNeeded();
        const existingDomains = await getAllRecords(STORES.appDomains);

        if (existingDomains.length === 0) {
            const [settingRows, appStateRecord, accountsRecord] = await Promise.all([
                getAllRecords(STORES.settings),
                getRecord(STORES.settings, 'appState'),
                getRecord(STORES.accounts, '__all__')
            ]);
            const durableAppState = appStateRecord && appStateRecord.value && typeof appStateRecord.value === 'object'
                ? appStateRecord.value
                : null;
            const appStateSource = durableAppState || {};
            const settingsValue = {};
            settingRows.forEach((row) => {
                if (!row || row.key === 'appState') return;
                settingsValue[row.key] = cloneDeep(row.value);
            });
            if (Array.isArray(accountsRecord?.value)) settingsValue.accounts = cloneDeep(accountsRecord.value);

            const domainValues = {
                ...Object.fromEntries(Object.entries(appStateSource).map(([name, value]) => [name, cloneDeep(value)])),
                settings: settingsValue,
                legacy: {}
            };
            const now = Date.now();
            await withStore([
                STORES.appDomains,
                STORES.xPosts,
                STORES.xThreads,
                STORES.xDms,
                STORES.assets,
                STORES.meta
            ], 'readwrite', async (stores) => {
                for (const [name, rawValue] of Object.entries(domainValues)) {
                    const value = sanitizePersistentValue(cloneDeep(rawValue));
                    const persistedValue = name === 'x'
                        ? persistXAssetsInTransaction(value, stores[STORES.assets])
                        : value;
                    const storedValue = name === 'x' ? stripXCollections(persistedValue) : persistedValue;
                    stores[STORES.appDomains].put({
                        name,
                        schemaVersion: STORAGE_SCHEMA_VERSION,
                        revision: 1,
                        updatedAt: now,
                        value: storedValue
                    });
                    if (name === 'x') {
                        await replaceCollectionRecords(stores[STORES.xPosts], persistedValue.xGeneratedPosts || [], 'id');
                        const threadRows = Object.entries(persistedValue.xPostThreads || {}).map(([postId, threadValue]) => ({ postId, value: threadValue }));
                        await replaceCollectionRecords(stores[STORES.xThreads], threadRows, 'postId');
                        const dmRows = (persistedValue.xDirectMessages || []).map((item, index) => ({
                            ...item,
                            id: String(item?.id ?? item?.charId ?? `x-dm-${index}`),
                            updatedAt: Number(item?.updatedAt) || now
                        }));
                        await replaceCollectionRecords(stores[STORES.xDms], dmRows, 'id');
                    }
                }
                stores[STORES.meta].put({ key: META_KEYS.schemaVersion, value: STORAGE_SCHEMA_VERSION });
                stores[STORES.meta].put({ key: 'unified_storage_migrated_at', value: now });
            });
        }

        // A legacy checkpoint is the only case where compaction is part of
        // startup correctness: it may be the sole copy of a domain or message.
        // For current stores, compaction can read every chat, asset, and X
        // record, so defer that maintenance until the shell is already usable.
        const [legacyAppState, startupCheckpoints] = await Promise.all([
            getRecord(STORES.settings, 'appState'),
            getAllRecords(STORES.storageCheckpoints)
        ]);
        const needsStartupRecovery = Boolean(legacyAppState) || startupCheckpoints.length > 0;
        storageHealthState.lastCompaction = needsStartupRecovery
            ? await compactStorage({ skipReady: true, force: true })
            : await getMeta('storage_last_compaction');
        storageHealthState.lastCacheCleanup = await getMeta('storage_last_cache_cleanup');
        storageHealthState.lastImageCompression = await getMeta('storage_last_image_compression');

        const hydratedDomains = await getAllRecords(STORES.appDomains);
        for (const record of hydratedDomains) {
            if (!record?.name) continue;
            const value = record.name === 'x' ? await hydrateXDomain(record.value) : record.value;
            domainCache.set(String(record.name), cloneDeep(value));
        }

        storageHealthState.status = 'saved';
        storageHealthState.migrationVersion = STORAGE_SCHEMA_VERSION;
        storageHealthState.lastError = null;
        try {
            if (navigator.storage?.persist) await navigator.storage.persist();
        } catch (error) {}
        notifyStorageSubscribers({ ...storageHealthState });
        try {
            window.dispatchEvent(new CustomEvent('u2-storage-ready'));
        } catch (error) {}
        scheduleDeferredStorageMaintenance();
        return true;
    }

    function scheduleDeferredStorageMaintenance() {
        if (deferredMaintenanceScheduled) return;
        deferredMaintenanceScheduled = true;
        const runMaintenance = async () => {
            try {
                storageHealthState.lastCompaction = await compactStorage({ skipReady: true });
                notifyStorageSubscribers({ ...storageHealthState, reason: 'startup-maintenance-complete' });
            } catch (error) {
                console.warn('[appStorage] Deferred startup maintenance failed', error);
            }
        };
        const scheduleWhenIdle = () => {
            if (typeof window.requestIdleCallback === 'function') {
                window.requestIdleCallback(() => { void runMaintenance(); }, { timeout: 10000 });
            } else {
                window.setTimeout(() => { void runMaintenance(); }, 0);
            }
        };
        // Leave the initial home render and first interaction a clear window.
        const maintenanceDelayTimer = window.setTimeout(scheduleWhenIdle, 2500);
        maintenanceDelayTimer?.unref?.();
    }

    function drainStorageBootstrapQueue() {
        storageBootstrapQueueScheduled = false;
        const next = storageBootstrapQueue.shift();
        if (!next) return;
        try {
            next();
        } catch (error) {
            console.error('[appStorage] Deferred startup initializer failed', error);
        }
        if (storageBootstrapQueue.length > 0) scheduleStorageBootstrapQueue();
    }

    function scheduleStorageBootstrapQueue() {
        if (storageBootstrapQueueScheduled || storageBootstrapQueue.length === 0) return;
        storageBootstrapQueueScheduled = true;
        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(drainStorageBootstrapQueue);
        } else {
            window.setTimeout(drainStorageBootstrapQueue, 0);
        }
    }

    function runAfterStorageReady(callback, options = {}) {
        if (typeof callback !== 'function') return Promise.resolve(false);
        const queue = options.queue !== false;
        const start = () => storageReadyPromise.then(() => {
            if (!queue) {
                callback();
                return true;
            }
            storageBootstrapQueue.push(callback);
            scheduleStorageBootstrapQueue();
            return true;
        }).catch((error) => {
            console.warn('[appStorage] Startup initializer skipped because storage is unavailable', error);
            return false;
        });
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start, { once: true });
        } else {
            start();
        }
        return storageReadyPromise;
    }

    const LEGACY_SETTING_KEY_MAP = {
        u2_userState: 'userState',
        u2_apiConfig: 'apiConfig',
        u2_ttsConfig: 'ttsConfig',
        u2_minimaxConfig: 'minimaxConfig',
        u2_apiPresets: 'apiPresets',
        u2_fetchedModels: 'fetchedModels',
        u2_assistiveBallSettings: 'assistiveBallSettings',
        u2_accounts: 'accounts',
        u2_currentAccountId: 'currentAccountId',
        u2_themeState: 'themeState',
        u2_worldBooks: 'worldBooks',
        u2_wbGroups: 'wbGroups'
    };

    function loadLegacyKey(key, fallbackValue = null) {
        const safeKey = String(key || '');
        const mappedKey = LEGACY_SETTING_KEY_MAP[safeKey];
        const settings = readDomain('settings', {});
        if (mappedKey) {
            return Object.prototype.hasOwnProperty.call(settings || {}, mappedKey)
                ? cloneDeep(settings[mappedKey])
                : cloneDeep(fallbackValue);
        }
        const legacy = readDomain('legacy', {});
        if (Object.prototype.hasOwnProperty.call(legacy || {}, safeKey)) return cloneDeep(legacy[safeKey]);
        return cloneDeep(fallbackValue);
    }

    function saveLegacyKey(key, value) {
        const safeKey = String(key || '');
        const mappedKey = LEGACY_SETTING_KEY_MAP[safeKey];
        const domainName = mappedKey ? 'settings' : 'legacy';
        const propertyName = mappedKey || safeKey;
        const optimistic = readDomain(domainName, {});
        optimistic[propertyName] = cloneDeep(value);
        domainCache.set(domainName, optimistic);
        return commitDomain(domainName, (draft) => {
            draft[propertyName] = cloneDeep(value);
            return draft;
        }, { reason: `legacy-key:${safeKey}` });
    }

    function removeLegacyKey(key) {
        const safeKey = String(key || '');
        const mappedKey = LEGACY_SETTING_KEY_MAP[safeKey];
        const domainName = mappedKey ? 'settings' : 'legacy';
        const propertyName = mappedKey || safeKey;
        const optimistic = readDomain(domainName, {});
        delete optimistic[propertyName];
        domainCache.set(domainName, optimistic);
        return commitDomain(domainName, (draft) => {
            delete draft[propertyName];
            return draft;
        }, { reason: `legacy-key-remove:${safeKey}` });
    }

    async function clearAllData() {
        try {
            clearRuntimeAssetCache();
        } catch (e) {}

        try {
            const db = await dbPromise;
            if (db) db.close();
        } catch (e) {}
        dbPromise = null;

        const result = await deleteDatabaseSafe(DB_NAME);
        return !!result.deleted;
    }

    async function clearAllPersistentData() {
        try {
            clearRuntimeAssetCache();
        } catch (e) {}

        try {
            const db = await dbPromise;
            if (db) db.close();
        } catch (e) {}
        dbPromise = null;

        let sessionStorageCleared = false;

        try {
            sessionStorage.clear();
            sessionStorageCleared = true;
        } catch (e) {}

        const [currentDbResult, legacyDbResult, cacheResults, swResults] = await Promise.all([
            deleteDatabaseSafe(DB_NAME),
            deleteDatabaseSafe('iiso_imessage_storage'),
            clearBrowserCaches(),
            unregisterServiceWorkers()
        ]);
        return {
            runtimeCacheCleared: true,
            localStorageCleared: false,
            localStorageRemovedKeys: [],
            sessionStorageCleared,
            databases: [currentDbResult, legacyDbResult],
            caches: cacheResults,
            serviceWorkers: swResults
        };
    }

    window.appStorage = {
        DB_NAME,
        STORES,
        openDb,
        withStore,
        requestToPromise,
        cloneDeep,
        dataUrlToBlob,
        blobToDataUrl,
        clearRuntimeAssetCache,
        pruneRuntimeAssetCache,
        measureRuntimeCacheUsage,
        formatBytes,
        getUsageSummary,
        saveAssetFromDataUrl,
        getAssetUrl,
        deleteAsset,
        markAssetOrphaned,
        getMeta,
        setMeta,
        getSetting,
        setSetting,
        saveGlobalData,
        loadGlobalData,
        collectBackupSnapshot,
        inspectBackupPayload,
        validateBackupPayload,
        exportAllData,
        importAllData,
        clearAllData,
        clearManagedPersistence,
        clearAllPersistentData,
        clearBrowserCaches,
        unregisterServiceWorkers,
        measureApproximateUsage,
        saveFriends,
        saveFriend,
        saveFriendMetaOnly,
        saveFriendMeta,
        patchFriendMeta,
        deleteFriend,
        loadFriends,
        saveFriendMessage,
        commitFriendMessage,
        saveChatSummary,
        deleteFriendMessage,
        deleteFriendMessages,
        saveFriendMessages,
        replaceFriendMessages,
        loadMessagesByFriendId,
        saveMoments,
        saveMoment,
        deleteMoment,
        loadMoments,
        saveMomentMessages,
        loadMomentMessages,
        saveStickers,
        loadStickers,
        saveMomentsCover,
        loadMomentsCoverUrl,
        loadLibraryBooks,
        loadLibraryBookContent,
        saveLibraryBook,
        deleteLibraryBook,
        loadLibraryPlaylists,
        loadLibraryTracks,
        saveLibraryPlaylistBundle,
        saveLibraryTrack,
        deleteLibraryTrack,
        deleteLibraryPlaylist,
        loadLibraryDailyStats,
        incrementLibraryDailyStat,
        switchXAccountWorld
    };

    Object.assign(window.appStorage, {
        readDomain,
        commitDomain,
        commitRecords,
        flushPendingWrites,
        getStorageHealth,
        getStorageBreakdown,
        compactStorage,
        clearSafeCache,
        optimizeStorage,
        inspectImageCompression,
        compressImageAssets,
        pruneOrphanedAssets,
        subscribe,
        loadLegacyKey,
        saveLegacyKey,
        removeLegacyKey
    });
    Object.defineProperty(window.appStorage, 'ready', {
        enumerable: true,
        configurable: false,
        get() {
            return storageReadyPromise;
        }
    });
    window.u2OnStorageReady = runAfterStorageReady;

    storageReadyPromise = initializeUnifiedStorage().catch((error) => {
        storageHealthState.status = 'error';
        storageHealthState.lastError = error?.message || String(error);
        console.error('[appStorage] unified storage initialization failed', error);
        notifyStorageSubscribers({ ...storageHealthState });
        try {
            const overlay = document.createElement('div');
            overlay.id = 'u2-storage-fatal';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#f2f2f7;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui;color:#1c1c1e;';
            overlay.innerHTML = `<div style="max-width:420px;background:#fff;border-radius:18px;padding:22px;box-shadow:0 18px 50px rgba(0,0,0,.12)"><h2 style="margin:0 0 10px">存储初始化失败</h2><p style="line-height:1.55;margin:0 0 16px">为防止空数据覆盖原数据，应用已停止启动。请重试；若仍失败，请先导出浏览器站点数据。</p><pre style="white-space:pre-wrap;font-size:12px;color:#8e8e93">${String(error?.message || error).replace(/[<>]/g, '')}</pre><button type="button" style="border:0;border-radius:12px;background:#007aff;color:#fff;padding:11px 18px" onclick="location.reload()">重试</button></div>`;
            document.body.appendChild(overlay);
        } catch (overlayError) {}
        throw error;
    });

})();
