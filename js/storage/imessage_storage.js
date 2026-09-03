// ==========================================
// IMESSAGE STORAGE ADAPTER
// Unified appStorage bridge for legacy iMessage APIs
// ==========================================

(function() {
    function getStorage() {
        if (!window.appStorage) {
            throw new Error('appStorage unavailable');
        }
        return window.appStorage;
    }

    function proxy(methodName, fallback) {
        return async function(...args) {
            const storage = getStorage();
            if (storage.ready) await storage.ready;
            const method = storage[methodName];
            if (typeof method !== 'function') {
                if (typeof fallback === 'function') {
                    return fallback(...args);
                }
                throw new Error(`appStorage.${methodName} unavailable`);
            }
            return method.apply(storage, args);
        };
    }

    function proxySync(methodName, fallback) {
        return function(...args) {
            const storage = getStorage();
            const method = storage[methodName];
            if (typeof method !== 'function') {
                if (typeof fallback === 'function') {
                    return fallback(...args);
                }
                throw new Error(`appStorage.${methodName} unavailable`);
            }
            return method.apply(storage, args);
        };
    }

    window.imStorage = {
        get DB_NAME() {
            return getStorage().DB_NAME;
        },

        openDb: proxy('openDb'),
        exportAllData: async function() {
            const storage = getStorage();
            if (storage.ready) await storage.ready;
            return {
                version: 1,
                exportedAt: Date.now(),
                friends: await storage.loadFriends(),
                moments: await storage.loadMoments(),
                momentMessages: await storage.loadMomentMessages(),
                stickers: await storage.loadStickers(),
                momentsCoverUrl: await storage.loadMomentsCoverUrl()
            };
        },
        importAllData: async function(payload = {}) {
            const storage = getStorage();
            if (storage.ready) await storage.ready;
            await storage.saveFriends(Array.isArray(payload.friends) ? payload.friends : []);
            await storage.saveMoments(Array.isArray(payload.moments) ? payload.moments : []);
            await storage.saveMomentMessages(Array.isArray(payload.momentMessages) ? payload.momentMessages : []);
            await storage.saveStickers(Array.isArray(payload.stickers) ? payload.stickers : []);
            await storage.saveMomentsCover(payload.momentsCoverUrl || null);
            return true;
        },
        clearAllData: async function() {
            const storage = getStorage();
            if (storage.ready) await storage.ready;
            await storage.saveFriends([]);
            await storage.saveMoments([]);
            await storage.saveMomentMessages([]);
            await storage.saveStickers([]);
            await storage.saveMomentsCover(null);
            if (storage.clearRuntimeAssetCache) {
                storage.clearRuntimeAssetCache();
            }
            return true;
        },

        saveGlobalData: async function(payload = {}) {
            const storage = getStorage();
            if (storage.ready) await storage.ready;
            await storage.saveFriends(Array.isArray(payload.friends) ? payload.friends : []);
            await storage.saveMoments(Array.isArray(payload.moments) ? payload.moments : []);
            await storage.saveMomentMessages(Array.isArray(payload.momentMessages) ? payload.momentMessages : []);
            await storage.saveStickers(Array.isArray(payload.stickers) ? payload.stickers : []);
            await storage.saveMomentsCover(payload.momentsCoverUrl || null);
            return true;
        },
        loadGlobalData: async function() {
            const storage = getStorage();
            if (storage.ready) await storage.ready;
            return {
                friends: await storage.loadFriends(),
                moments: await storage.loadMoments(),
                momentMessages: await storage.loadMomentMessages(),
                stickers: await storage.loadStickers(),
                momentsCoverUrl: await storage.loadMomentsCoverUrl()
            };
        },

        saveFriends: proxy('saveFriends'),
        saveFriend: proxy('saveFriend'),
        saveFriendMetaOnly: proxy('saveFriendMetaOnly'),
        patchFriendMeta: proxy('patchFriendMeta'),
        deleteFriend: proxy('deleteFriend'),
        loadFriends: proxy('loadFriends'),
        saveFriendMeta: proxy('saveFriendMeta'),
        saveFriendMessage: proxy('saveFriendMessage'),
        commitFriendMessage: proxy('commitFriendMessage'),
        deleteFriendMessage: proxy('deleteFriendMessage'),
        deleteFriendMessages: proxy('deleteFriendMessages'),
        saveFriendMessages: proxy('saveFriendMessages'),
        replaceFriendMessages: proxy('replaceFriendMessages'),
        loadMessagesByFriendId: proxy('loadMessagesByFriendId'),

        saveMoments: proxy('saveMoments'),
        saveMoment: proxy('saveMoment'),
        deleteMoment: proxy('deleteMoment'),
        loadMoments: proxy('loadMoments'),

        saveMomentMessages: proxy('saveMomentMessages'),
        loadMomentMessages: proxy('loadMomentMessages'),

        saveStickers: proxy('saveStickers'),
        loadStickers: proxy('loadStickers'),

        saveAssetFromDataUrl: proxy('saveAssetFromDataUrl'),
        getAssetUrl: proxy('getAssetUrl'),
        deleteAsset: proxy('deleteAsset'),

        saveMomentsCover: proxy('saveMomentsCover'),
        loadMomentsCoverUrl: proxy('loadMomentsCoverUrl'),

        measureApproximateUsage: async function() {
            const storage = getStorage();
            const payload = await storage.exportAllData();
            const imessage = payload && payload.imessage ? payload.imessage : {};
            return new Blob([JSON.stringify(imessage)]).size;
        },

        clearRuntimeAssetCache: proxySync('clearRuntimeAssetCache', () => true),
        pruneRuntimeAssetCache: proxySync('pruneRuntimeAssetCache', () => 0),
        blobToDataUrl: proxy('blobToDataUrl'),
        dataUrlToBlob: proxySync('dataUrlToBlob'),
        cloneDeep: proxySync('cloneDeep')
    };
})();
