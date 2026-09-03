// U2 app state bridge.
// Provides the synchronous getAppState/setAppState API expected by migrated app modules,
// while keeping the current IndexedDB-backed appStorage layer as the durable store.
(function () {
    const SAVE_DEBOUNCE_MS = 120;

    const defaultYoutubeState = {
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
            pastVideos: [],
            communityPosts: [],
            userCommunityChannel: null
        },
        subscriptions: [],
        userState: null
    };

    function createDefaultAppState() {
        return {
            youtube: clone(defaultYoutubeState),
            tiktok: {
                profile: {
                    name: 'User',
                    handle: 'user123',
                    avatar: null,
                    status: '',
                    bio: '',
                    persona: '',
                    following: 0,
                    followers: 0,
                    likes: 0,
                    posts: []
                },
                chars: [],
                videos: [],
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
                    bio: '',
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
                boundWorldBookIds: [],
                xVisitors: [],
                xDirectMessages: [],
                xPostThreads: {},
                xGeneratedPosts: [],
                xAccounts: [],
                xTrends: [
                    { id: 'default-stage-style', title: '#'ParisFashionWeek', category: 'Fashion · Trending', heat: '248K', movement: 'none' },
                    { id: 'default-topic-host', title: '#LVMHResults', category: 'Business · Trending', heat: '19.8K', movement: 'none' },
                    { id: 'default-citywalk', title: '#ChristiesAuction', category: 'Art · Rising', heat: '14.6K', movement: 'none' }
                ],
                xAdvancePreferences: {
                    strangersEnabled: true,
                    strangersCount: 5,
                    trendsEnabled: true,
                    trendsCount: 3,
                    postsEnabled: true,
                    postsCount: 3
                },
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

    function clone(value) {
        if (value == null || typeof value !== 'object') return value;
        if (typeof structuredClone === 'function') {
            return structuredClone(value);
        }
        return JSON.parse(JSON.stringify(value));
    }

    function stripVolatileBlobUrls(value, seen = new WeakSet()) {
        if (typeof value === 'string') {
            return value.startsWith('blob:') ? null : value;
        }
        if (value == null || typeof value !== 'object') return value;
        if (seen.has(value)) return undefined;
        seen.add(value);

        if (Array.isArray(value)) {
            return value
                .map((item) => stripVolatileBlobUrls(item, seen))
                .filter((item) => item !== undefined);
        }

        const result = {};
        Object.keys(value).forEach((key) => {
            const nextValue = stripVolatileBlobUrls(value[key], seen);
            if (nextValue !== undefined) result[key] = nextValue;
        });
        return result;
    }

    function isPlainObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value);
    }

    function hasUsefulBstageState(value) {
        if (!isPlainObject(value)) return false;
        const hasMemberChatHistory = (members) => Array.isArray(members)
            && members.some((member) => Array.isArray(member?.chatHistory) && member.chatHistory.length > 0);
        const meaningfulArrays = ['teams', 'bstageOrders', 'bstageFanChatHistory', 'chatPhotos'];
        if (meaningfulArrays.some((key) => Array.isArray(value[key]) && value[key].length > 0)) return true;
        if (Array.isArray(value.teams) && value.teams.some((team) => hasMemberChatHistory(team?.members))) return true;
        const userTeam = value.bstageUserTeamState;
        if (isPlainObject(userTeam)) {
            if (hasMemberChatHistory(userTeam.members)) return true;
            if (Array.isArray(userTeam.members) && userTeam.members.length > 1) return true;
            if (Array.isArray(userTeam.videos) && userTeam.videos.length > 0) return true;
            if (Array.isArray(userTeam.shopItems) && userTeam.shopItems.length > 0) return true;
            if (userTeam.customName || userTeam.customDesc || userTeam.customAvatar || userTeam.customBg) return true;
        }
        const fanChatSettings = value.bstageFanChatSettings;
        if (isPlainObject(fanChatSettings) && (fanChatSettings.chatBg || fanChatSettings.chatCssId || fanChatSettings.bubbleCssId)) return true;
        const presets = value.bstagePresets;
        if (isPlainObject(presets) && Object.keys(presets).some((key) => Array.isArray(presets[key]) && presets[key].length > 0)) return true;
        const revenue = value.bstageRevenueState;
        if (isPlainObject(revenue) && Number(revenue.withdrawnCny) > 0) return true;
        return false;
    }

    function getStateUpdatedAt(value) {
        const parsed = Number(value && value.updatedAt);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function shouldRecoverDurableBstage(localBstage, durableBstage) {
        if (!hasUsefulBstageState(durableBstage)) return false;
        if (!hasUsefulBstageState(localBstage)) return true;
        const durableUpdatedAt = getStateUpdatedAt(durableBstage);
        const localUpdatedAt = getStateUpdatedAt(localBstage);
        return durableUpdatedAt > 0 && durableUpdatedAt > localUpdatedAt;
    }

    function mergeRecoveredAppState(localState, durableState) {
        const merged = normalizeAppState(localState);
        const durable = normalizeAppState(durableState);
        if (shouldRecoverDurableBstage(merged.bstage, durable.bstage)) {
            merged.bstage = clone(durable.bstage);
        }
        return normalizeAppState(merged);
    }

    function mergeDurableBaseWithRuntimeState(runtimeState, durableState) {
        const runtime = normalizeAppState(runtimeState);
        const durable = normalizeAppState(durableState);
        if (hasUsefulBstageState(runtime.bstage) && !shouldRecoverDurableBstage(runtime.bstage, durable.bstage)) {
            durable.bstage = clone(runtime.bstage);
        }
        return normalizeAppState(durable);
    }

    function normalizeYoutubeState(raw) {
        const safe = isPlainObject(raw) ? raw : {};
        const channelState = isPlainObject(safe.channelState) ? safe.channelState : {};

        return {
            ...clone(defaultYoutubeState),
            ...safe,
            channelState: {
                ...clone(defaultYoutubeState.channelState),
                ...channelState,
                boundWorldBookIds: Array.isArray(channelState.boundWorldBookIds) ? channelState.boundWorldBookIds.filter(Boolean) : [],
                liveSummaries: Array.isArray(channelState.liveSummaries) ? channelState.liveSummaries.filter(Boolean) : [],
                groupChatHistory: Array.isArray(channelState.groupChatHistory) ? channelState.groupChatHistory.filter(Boolean) : [],
                activeUserLive: isPlainObject(channelState.activeUserLive) ? channelState.activeUserLive : null,
                pastVideos: Array.isArray(channelState.pastVideos) ? channelState.pastVideos.filter(Boolean) : [],
                communityPosts: Array.isArray(channelState.communityPosts) ? channelState.communityPosts.filter(Boolean) : [],
                userCommunityChannel: isPlainObject(channelState.userCommunityChannel) ? channelState.userCommunityChannel : null
            },
            subscriptions: Array.isArray(safe.subscriptions) ? safe.subscriptions.filter(Boolean) : [],
            userState: isPlainObject(safe.userState) ? safe.userState : null
        };
    }

    function normalizeAppState(raw) {
        const defaults = createDefaultAppState();
        const safe = isPlainObject(raw) ? raw : {};
        const safeX = isPlainObject(safe.x) ? safe.x : {};
        const normalizedX = {
            ...defaults.x,
            ...safeX,
            xData: {
                ...defaults.x.xData,
                ...(isPlainObject(safeX.xData) ? safeX.xData : {})
            },
            xPlayerAccounts: Array.isArray(safeX.xPlayerAccounts) ? safeX.xPlayerAccounts : defaults.x.xPlayerAccounts,
            activeXPlayerAccountId: typeof safeX.activeXPlayerAccountId === 'string' ? safeX.activeXPlayerAccountId : defaults.x.activeXPlayerAccountId,
            xAccountSchemaVersion: Math.max(1, Number(safeX.xAccountSchemaVersion) || defaults.x.xAccountSchemaVersion),
            xCharIdentityMigrationVersion: Math.max(0, Number(safeX.xCharIdentityMigrationVersion) || defaults.x.xCharIdentityMigrationVersion),
            xCharProfileMediaMigrationVersion: Math.max(0, Number(safeX.xCharProfileMediaMigrationVersion) || defaults.x.xCharProfileMediaMigrationVersion),
            xTopics: Array.isArray(safeX.xTopics) ? safeX.xTopics : defaults.x.xTopics,
            boundWorldBookIds: Array.isArray(safeX.boundWorldBookIds) ? safeX.boundWorldBookIds.map(String) : defaults.x.boundWorldBookIds,
            xVisitors: Array.isArray(safeX.xVisitors) ? safeX.xVisitors : defaults.x.xVisitors,
            xDirectMessages: Array.isArray(safeX.xDirectMessages) ? safeX.xDirectMessages : defaults.x.xDirectMessages,
            xPostThreads: isPlainObject(safeX.xPostThreads) ? safeX.xPostThreads : defaults.x.xPostThreads,
            xGeneratedPosts: Array.isArray(safeX.xGeneratedPosts) ? safeX.xGeneratedPosts : defaults.x.xGeneratedPosts,
            xAccounts: Array.isArray(safeX.xAccounts) ? safeX.xAccounts : defaults.x.xAccounts,
            xTrends: Array.isArray(safeX.xTrends) ? safeX.xTrends : defaults.x.xTrends,
            xAdvancePreferences: isPlainObject(safeX.xAdvancePreferences) ? safeX.xAdvancePreferences : defaults.x.xAdvancePreferences,
            xHomeBannerUrl: typeof safeX.xHomeBannerUrl === 'string' ? safeX.xHomeBannerUrl : defaults.x.xHomeBannerUrl,
            xSearchBannerUrl: typeof safeX.xSearchBannerUrl === 'string' ? safeX.xSearchBannerUrl : defaults.x.xSearchBannerUrl
        };
        delete normalizedX.xCurrentDate;

        return {
            ...defaults,
            ...safe,
            youtube: normalizeYoutubeState(safe.youtube),
            tiktok: {
                ...defaults.tiktok,
                ...(isPlainObject(safe.tiktok) ? safe.tiktok : {})
            },
            pay: {
                ...defaults.pay,
                ...(isPlainObject(safe.pay) ? safe.pay : {})
            },
            spotify: {
                ...defaults.spotify,
                ...(isPlainObject(safe.spotify) ? safe.spotify : {})
            },
            diary: {
                ...defaults.diary,
                ...(isPlainObject(safe.diary) ? safe.diary : {})
            },
            maps: {
                ...defaults.maps,
                ...(isPlainObject(safe.maps) ? safe.maps : {})
            },
            netflix: isPlainObject(safe.netflix) ? safe.netflix : defaults.netflix,
            desktop: isPlainObject(safe.desktop) ? safe.desktop : defaults.desktop,
            bstage: isPlainObject(safe.bstage) ? safe.bstage : defaults.bstage,
            x: normalizedX,
            imessage: {
                uiState: {
                    ...defaults.imessage.uiState,
                    ...(isPlainObject(safe.imessage?.uiState) ? safe.imessage.uiState : {})
                }
            }
        };
    }

    function loadLocalAppState() {
        return null;
    }

    function saveLocalAppState() {
        return true;
    }

    function buildGlobalDataForSave(base = {}) {
        return {
            ...(isPlainObject(base) ? base : {}),
            appState: stripVolatileBlobUrls(normalizeAppState(appState))
        };
    }

    const initialLocalAppState = loadLocalAppState();
    let hasLocalAppState = !!initialLocalAppState;
    let runtimeDirty = false;
    const dirtyAppKeys = new Set();
    let appState = normalizeAppState(initialLocalAppState);
    const appStateRevisions = Object.create(null);
    let globalDataCache = null;
    let saveTimer = null;

    function bumpAppStateRevision(appKey) {
        const key = String(appKey || '');
        if (!key) return 0;
        appStateRevisions[key] = Math.max(0, Number(appStateRevisions[key]) || 0) + 1;
        return appStateRevisions[key];
    }

    function syncWindowState() {
        window.__u2AppState = appState;
        window.__iisonAppState = appState;
    }

    async function persistToAppStorage() {
        if (!window.appStorage || typeof window.appStorage.commitDomain !== 'function') {
            return false;
        }
        if (!runtimeDirty && dirtyAppKeys.size === 0) return true;

        try {
            await window.appStorage.ready;
            const normalized = stripVolatileBlobUrls(normalizeAppState(appState));
            const keys = dirtyAppKeys.size > 0 ? Array.from(dirtyAppKeys) : Object.keys(normalized);
            await Promise.all(keys.map((key) => window.appStorage.commitDomain(
                key,
                normalized[key],
                { critical: true, reason: `app-state:${key}` }
            )));
            dirtyAppKeys.clear();
            runtimeDirty = false;
            globalDataCache = buildGlobalDataForSave(globalDataCache || {});
            return true;
        } catch (error) {
            console.warn('[app_state_bridge] Failed to persist app state:', error);
            return false;
        }
    }

    function scheduleSave() {
        if (saveTimer) clearTimeout(saveTimer);
        const runPersist = () => {
            saveTimer = null;
            persistToAppStorage();
        };
        saveTimer = setTimeout(runPersist, SAVE_DEBOUNCE_MS);
    }

    window.getAllAppState = function getAllAppState() {
        return appState;
    };

    window.getAppState = function getAppState(appKey) {
        if (!appKey) return null;
        return appState && Object.prototype.hasOwnProperty.call(appState, appKey)
            ? clone(appState[appKey])
            : null;
    };

    window.getAppStateRevision = function getAppStateRevision(appKey) {
        return Math.max(0, Number(appStateRevisions[String(appKey || '')]) || 0);
    };

    window.setAppState = function setAppState(appKey, nextState, options = {}) {
        if (!appKey) return null;
        appState[appKey] = isPlainObject(nextState) || Array.isArray(nextState) ? clone(nextState) : nextState;
        appState = normalizeAppState(appState);
        bumpAppStateRevision(appKey);
        syncWindowState();
        runtimeDirty = true;
        dirtyAppKeys.add(String(appKey));
        if (options.save !== false) scheduleSave();
        return clone(appState[appKey]);
    };

    window.updateAppState = function updateAppState(appKey, updater, options = {}) {
        if (!appKey) return null;
        const previous = window.getAppState(appKey);
        const draft = isPlainObject(previous) || Array.isArray(previous) ? clone(previous) : previous;
        const nextState = typeof updater === 'function' ? updater(draft) ?? draft : updater;
        return window.setAppState(appKey, nextState, options);
    };

    window.resetUnifiedAppState = function resetUnifiedAppState(options = {}) {
        appState = normalizeAppState();
        Object.keys(appState).forEach(bumpAppStateRevision);
        syncWindowState();
        runtimeDirty = true;
        Object.keys(appState).forEach((key) => dirtyAppKeys.add(key));
        if (options.save !== false) scheduleSave();
        return clone(appState);
    };

    window.saveGlobalData = async function saveGlobalData() {
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }
        saveLocalAppState();
        return persistToAppStorage();
    };

    window.loadGlobalData = async function loadGlobalData() {
        if (window.appStorage && typeof window.appStorage.readDomain === 'function') {
            try {
                await window.appStorage.ready;
                const defaults = createDefaultAppState();
                const durableState = {};
                Object.keys(defaults).forEach((key) => {
                    durableState[key] = window.appStorage.readDomain(key, defaults[key]);
                });
                appState = normalizeAppState(durableState);
                if (runtimeDirty) {
                    dirtyAppKeys.forEach((key) => {
                        if (key === 'bstage') return;
                        appState[key] = clone(window.__u2AppState?.[key] ?? appState[key]);
                    });
                    appState = mergeDurableBaseWithRuntimeState(window.__u2AppState, appState);
                    appState = normalizeAppState(appState);
                }
                Object.keys(appState).forEach(bumpAppStateRevision);
                globalDataCache = typeof window.appStorage.loadGlobalData === 'function'
                    ? await window.appStorage.loadGlobalData()
                    : {};
                globalDataCache.appState = clone(appState);
                syncWindowState();

                return buildGlobalDataForSave(globalDataCache);
            } catch (error) {
                console.warn('[app_state_bridge] Failed to load global data:', error);
            }
        }

        return buildGlobalDataForSave(globalDataCache || {});
    };

    syncWindowState();

    function flushAppStateForPageLifecycle() {
        if (typeof window.saveGlobalData === 'function') {
            window.saveGlobalData();
        }
    }

    window.addEventListener('pagehide', flushAppStateForPageLifecycle);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushAppStateForPageLifecycle();
    });

    window.globalDataReadyPromise = window.loadGlobalData();
})();
