// ==========================================
// IMESSAGE: LOCAL VECTOR MEMORY
// ==========================================

(function() {
    const RECALL_LIMIT = 4;
    const EMBEDDING_REQUEST_TIMEOUT_MS = 15000;
    const EMBEDDING_BATCH_SIZE = 16;
    const FALLBACK_PROVIDERS = Object.freeze({
        siliconflow: {
            label: 'SiliconFlow',
            endpoint: 'https://api.siliconflow.cn/v1/embeddings',
            defaultModel: 'BAAI/bge-m3',
            models: ['BAAI/bge-m3', 'BAAI/bge-large-zh-v1.5']
        },
        openai: {
            label: 'OpenAI',
            endpoint: 'https://api.openai.com/v1/embeddings',
            defaultModel: 'text-embedding-3-small',
            models: ['text-embedding-3-small', 'text-embedding-3-large']
        },
        dashscope: {
            label: 'DashScope',
            endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings',
            defaultModel: 'text-embedding-v4',
            models: ['text-embedding-v4', 'text-embedding-v3']
        },
        zhipu: {
            label: 'Zhipu AI',
            endpoint: 'https://open.bigmodel.cn/api/paas/v4/embeddings',
            defaultModel: 'embedding-3',
            models: ['embedding-3', 'embedding-2']
        },
        'openai-compatible': {
            label: 'OpenAI Compatible',
            endpoint: '',
            defaultModel: '',
            models: []
        }
    });
    const fallbackIndex = new Map();
    let indexQueue = Promise.resolve();
    let syncStatus = {
        phase: 'idle',
        message: '',
        completed: 0,
        total: 0,
        updatedAt: 0
    };

    function getProviderRegistry() {
        const providers = window.u2Api?.VECTOR_MEMORY_PROVIDERS;
        return providers && typeof providers === 'object' ? providers : FALLBACK_PROVIDERS;
    }

    function getProviderMeta(provider) {
        const registry = getProviderRegistry();
        return registry[provider] || registry.siliconflow || FALLBACK_PROVIDERS.siliconflow;
    }

    function normalizeConfig(config) {
        if (window.imApp?.normalizeVectorMemoryConfig) {
            return window.imApp.normalizeVectorMemoryConfig(config);
        }
        if (window.u2Api?.normalizeVectorMemoryConfig) {
            return window.u2Api.normalizeVectorMemoryConfig(config);
        }
        const source = config && typeof config === 'object' ? config : {};
        const provider = Object.prototype.hasOwnProperty.call(getProviderRegistry(), String(source.provider || '').trim())
            ? String(source.provider).trim()
            : 'siliconflow';
        const meta = getProviderMeta(provider);
        let endpoint = String(source.endpoint || '').trim().replace(/\/+$/, '');
        try {
            if (endpoint) endpoint = new URL(endpoint).toString().replace(/\/+$/, '');
        } catch (error) {
            endpoint = '';
        }
        return {
            enabled: source.enabled === true,
            provider,
            endpoint: provider === 'openai-compatible' ? endpoint : '',
            apiKey: String(source.apiKey || '').trim(),
            model: String(source.model || meta.defaultModel || '').trim()
        };
    }

    function getGlobalConfig() {
        return normalizeConfig(window.getVectorMemoryConfig?.() || window.vectorMemoryConfig || {});
    }

    function getEmbeddingEndpoint(config) {
        const normalized = normalizeConfig(config);
        const provider = getProviderMeta(normalized.provider);
        return String(normalized.provider === 'openai-compatible' ? normalized.endpoint : provider.endpoint || '')
            .trim()
            .replace(/\/+$/, '');
    }

    function isConfigured(config) {
        const normalized = normalizeConfig(config);
        return !!(normalized.enabled && normalized.apiKey && normalized.model && getEmbeddingEndpoint(normalized));
    }

    function getFriend(friendOrId) {
        if (window.imApp?.getFriendById) return window.imApp.getFriendById(friendOrId);
        const id = typeof friendOrId === 'object' ? friendOrId?.id : friendOrId;
        return (window.imData?.friends || []).find(friend => String(friend?.id) === String(id)) || null;
    }

    function getMemory(friendOrId) {
        const source = getFriend(friendOrId) || (typeof friendOrId === 'object' ? friendOrId : null) || {};
        const normalized = window.imApp?.normalizeFriendData
            ? window.imApp.normalizeFriendData(source)
            : source;
        return { friend: normalized, memory: normalized.memory || {} };
    }

    function getAccountId() {
        const accountId = window.getCurrentAccountId?.();
        return String(accountId == null || accountId === '' ? 'default' : accountId);
    }

    function getConfigFingerprint(config) {
        const normalized = normalizeConfig(config);
        return [normalized.provider, getEmbeddingEndpoint(normalized), normalized.model]
            .map(value => String(value || '').trim())
            .join('|');
    }

    function getScopeKey(config) {
        return `${getAccountId()}|${getConfigFingerprint(config)}`;
    }

    function getScopeFriendKey(config, friendId) {
        return `${getScopeKey(config)}|${String(friendId || '')}`;
    }

    function getMemoryKindForCollection(collection) {
        if (collection === 'shortTermEntries') return 'short';
        if (collection === 'cherishedEntries') return 'cherished';
        return 'long';
    }

    function getVectorRecordId(friendId, kind, entryId, config = getGlobalConfig()) {
        return [
            'u2-vector',
            encodeURIComponent(getAccountId()),
            encodeURIComponent(getConfigFingerprint(config)),
            encodeURIComponent(String(friendId || '')),
            encodeURIComponent(String(kind || '')),
            encodeURIComponent(String(entryId || ''))
        ].join(':');
    }

    function getEntryTags(kind, entry) {
        const source = kind === 'short'
            ? (entry?.memoryTags || entry?.triggerKeywords || [])
            : (entry?.triggerKeywords || entry?.memoryTags || []);
        return (Array.isArray(source) ? source : [source])
            .map(value => String(value || '').trim())
            .filter(Boolean)
            .slice(0, 12);
    }

    function getEntryContent(kind, entry) {
        const pieces = [
            entry?.title ? `Title: ${entry.title}` : '',
            entry?.time || entry?.createdAt ? `Time: ${entry.time || entry.createdAt}` : '',
            kind === 'short' ? (entry?.event || entry?.content || '') : (entry?.content || ''),
            entry?.memoryPoints ? `Memory points: ${entry.memoryPoints}` : '',
            entry?.detail ? `Details: ${entry.detail}` : '',
            entry?.reason ? `Reason: ${entry.reason}` : '',
            getEntryTags(kind, entry).length > 0 ? `Tags: ${getEntryTags(kind, entry).join(', ')}` : ''
        ];
        return pieces.filter(Boolean).join('\n').trim();
    }

    function listIndexableEntries(friendOrId) {
        const { friend, memory } = getMemory(friendOrId);
        if (!friend?.id) return [];
        const isGroup = friend.type === 'group';
        const entries = [];
        const appendEntries = (kind, source) => {
            (Array.isArray(source) ? source : []).forEach(entry => {
                if (!entry?.id) return;
                const content = getEntryContent(kind, entry);
                if (content) entries.push({ kind, entry, content });
            });
        };

        appendEntries('short', memory.shortTermEntries);
        appendEntries('long', isGroup
            ? (Array.isArray(memory.longTermEntries)
                ? memory.longTermEntries.filter(entry => String(entry?.sourceType || '') === 'manual')
                : [])
            : memory.longTermEntries);
        if (!isGroup) appendEntries('cherished', memory.cherishedEntries);
        return entries;
    }

    function createContentHash(value) {
        const text = String(value || '');
        let hash = 2166136261;
        for (let index = 0; index < text.length; index += 1) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
    }

    function createIndexRecord(friendOrId, item, embedding, config = getGlobalConfig()) {
        const { friend } = getMemory(friendOrId);
        const kind = item?.kind;
        const entry = item?.entry || {};
        const vector = Array.isArray(embedding) ? embedding.map(Number) : [];
        if (!friend?.id || !kind || !entry.id || vector.length === 0 || vector.some(value => !Number.isFinite(value))) {
            return null;
        }
        const fingerprint = getConfigFingerprint(config);
        return {
            id: getVectorRecordId(friend.id, kind, entry.id, config),
            scopeKey: getScopeKey(config),
            scopeFriendKey: getScopeFriendKey(config, friend.id),
            accountId: getAccountId(),
            friendId: String(friend.id),
            kind,
            entryId: String(entry.id),
            contentHash: createContentHash(item.content),
            fingerprint,
            embedding: vector,
            updatedAt: Date.now()
        };
    }

    function enqueueIndexTask(task) {
        const result = indexQueue.then(task, task);
        indexQueue = result.catch(() => undefined);
        return result;
    }

    function emitStatus(patch) {
        syncStatus = {
            ...syncStatus,
            ...patch,
            updatedAt: Date.now()
        };
        if (typeof window.CustomEvent === 'function' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new window.CustomEvent('u2:vector-memory-status', {
                detail: { ...syncStatus }
            }));
        }
        return syncStatus;
    }

    function getStatus() {
        return { ...syncStatus };
    }

    function getIndexStorage() {
        const storage = window.appStorage;
        const storeName = storage?.STORES?.vectorMemoryIndex;
        return storage?.withStore && storage?.requestToPromise && storeName ? { storage, storeName } : null;
    }

    async function getIndexRecords(scopeFriendKey) {
        const runtime = getIndexStorage();
        if (!runtime) {
            return Array.from(fallbackIndex.values()).filter(record => record.scopeFriendKey === scopeFriendKey);
        }
        return runtime.storage.withStore([runtime.storeName], 'readonly', async stores => {
            const store = stores[runtime.storeName];
            const request = store.index('scopeFriendKey').getAll(scopeFriendKey);
            const records = await runtime.storage.requestToPromise(request);
            return Array.isArray(records) ? records : [];
        });
    }

    async function putIndexRecords(records) {
        const safeRecords = (Array.isArray(records) ? records : []).filter(Boolean);
        if (safeRecords.length === 0) return;
        const runtime = getIndexStorage();
        if (!runtime) {
            safeRecords.forEach(record => fallbackIndex.set(record.id, { ...record }));
            return;
        }
        await runtime.storage.withStore([runtime.storeName], 'readwrite', stores => {
            const store = stores[runtime.storeName];
            safeRecords.forEach(record => store.put(record));
        });
    }

    async function deleteIndexRecordIds(ids) {
        const safeIds = Array.from(new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean)));
        if (safeIds.length === 0) return;
        const runtime = getIndexStorage();
        if (!runtime) {
            safeIds.forEach(id => fallbackIndex.delete(id));
            return;
        }
        await runtime.storage.withStore([runtime.storeName], 'readwrite', stores => {
            const store = stores[runtime.storeName];
            safeIds.forEach(id => store.delete(id));
        });
    }

    async function clearIndex() {
        const runtime = getIndexStorage();
        if (!runtime) {
            fallbackIndex.clear();
            return;
        }
        await runtime.storage.withStore([runtime.storeName], 'readwrite', stores => {
            stores[runtime.storeName].clear();
        });
    }

    async function purgeFriendIndexNow(friendId, config = getGlobalConfig()) {
        const records = await getIndexRecords(getScopeFriendKey(config, friendId));
        await deleteIndexRecordIds(records.map(record => record.id));
        return records.length;
    }

    async function requestEmbeddings(config, inputs) {
        const normalized = normalizeConfig(config);
        if (!isConfigured(normalized)) throw new Error('请先完成向量记忆服务配置');
        const values = (Array.isArray(inputs) ? inputs : [inputs])
            .map(value => String(value || '').trim())
            .filter(Boolean);
        if (values.length === 0) return [];

        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timeout = window.setTimeout(() => controller?.abort(), EMBEDDING_REQUEST_TIMEOUT_MS);
        try {
            const response = await fetch(getEmbeddingEndpoint(normalized), {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${normalized.apiKey}`
                },
                body: JSON.stringify({ model: normalized.model, input: values }),
                signal: controller?.signal
            });
            const raw = await response.text();
            let data = {};
            if (raw) {
                try {
                    data = JSON.parse(raw);
                } catch (error) {
                    data = { error: raw.slice(0, 500) };
                }
            }
            if (!response.ok) {
                throw new Error(String(data?.error?.message || data?.message || data?.error || `${response.status} ${response.statusText}`));
            }
            const rows = Array.isArray(data?.data) ? data.data : [];
            const embeddings = Array(values.length);
            rows.forEach((row, fallbackIndex) => {
                const index = Number.isInteger(Number(row?.index)) ? Number(row.index) : fallbackIndex;
                const embedding = Array.isArray(row?.embedding) ? row.embedding.map(Number) : [];
                if (index >= 0 && index < embeddings.length && embedding.length > 0 && embedding.every(Number.isFinite)) {
                    embeddings[index] = embedding;
                }
            });
            const hasIncompleteEmbedding = Array.from({ length: values.length }, (_, index) => {
                const vector = embeddings[index];
                return !Array.isArray(vector) || vector.length === 0;
            }).some(Boolean);
            if (hasIncompleteEmbedding) {
                throw new Error('嵌入服务返回的数据不完整');
            }
            const dimensions = embeddings[0].length;
            if (embeddings.some(vector => vector.length !== dimensions)) {
                throw new Error('嵌入服务返回的向量维度不一致');
            }
            return embeddings;
        } catch (error) {
            if (error?.name === 'AbortError') throw new Error('嵌入请求超时，请稍后重试');
            throw error;
        } finally {
            window.clearTimeout(timeout);
        }
    }

    async function testConnection(config) {
        try {
            await requestEmbeddings(config, ['vector memory connection test']);
            return { ok: true };
        } catch (error) {
            return { ok: false, error: String(error?.message || error || '连接失败') };
        }
    }

    async function syncFriendMemoryNow(friendOrId, options = {}) {
        const { friend } = getMemory(friendOrId);
        const config = getGlobalConfig();
        if (!friend?.id) return { ok: false, reason: 'missing_friend', count: 0 };
        if (!isConfigured(config)) return { ok: false, reason: 'not_configured', count: 0 };
        if (navigator.onLine === false) return { ok: false, reason: 'offline', count: 0 };

        const entries = listIndexableEntries(friend);
        const scopeFriendKey = getScopeFriendKey(config, friend.id);
        const existing = await getIndexRecords(scopeFriendKey);
        const existingById = new Map(existing.map(record => [record.id, record]));
        const fingerprint = getConfigFingerprint(config);
        const currentIds = new Set();
        const pending = [];

        entries.forEach(item => {
            const id = getVectorRecordId(friend.id, item.kind, item.entry.id, config);
            const contentHash = createContentHash(item.content);
            currentIds.add(id);
            const previous = existingById.get(id);
            if (previous?.fingerprint === fingerprint && previous?.contentHash === contentHash && Array.isArray(previous.embedding)) return;
            pending.push({ id, item });
        });

        const staleIds = existing
            .filter(record => !currentIds.has(record.id) || record.fingerprint !== fingerprint)
            .map(record => record.id);
        const replacedIds = pending.filter(item => existingById.has(item.id)).map(item => item.id);
        await deleteIndexRecordIds([...staleIds, ...replacedIds]);

        let indexedCount = 0;
        for (let start = 0; start < pending.length; start += EMBEDDING_BATCH_SIZE) {
            const batch = pending.slice(start, start + EMBEDDING_BATCH_SIZE);
            const embeddings = await requestEmbeddings(config, batch.map(item => item.item.content));
            const records = batch
                .map((item, index) => createIndexRecord(friend, item.item, embeddings[index], config))
                .filter(Boolean);
            await putIndexRecords(records);
            indexedCount += records.length;
            options.onProgress?.(indexedCount, pending.length);
        }

        return { ok: true, count: entries.length, indexedCount, pendingCount: pending.length };
    }

    function syncFriendMemory(friendOrId, options = {}) {
        return enqueueIndexTask(() => syncFriendMemoryNow(friendOrId, options));
    }

    async function rebuildAllMemoryIndexesNow() {
        const config = getGlobalConfig();
        if (!isConfigured(config)) {
            emitStatus({ phase: 'error', message: '请先完成向量记忆服务配置', completed: 0, total: 0 });
            return { ok: false, reason: 'not_configured', count: 0 };
        }
        if (navigator.onLine === false) {
            emitStatus({ phase: 'error', message: '当前处于离线状态', completed: 0, total: 0 });
            return { ok: false, reason: 'offline', count: 0 };
        }

        const friends = (window.imData?.friends || []).filter(friend => friend?.id);
        const total = friends.reduce((count, friend) => count + listIndexableEntries(friend).length, 0);
        emitStatus({ phase: 'syncing', message: '正在建立本地索引', completed: 0, total });

        let completed = 0;
        try {
            await clearIndex();
            for (const friend of friends) {
                const entries = listIndexableEntries(friend);
                await syncFriendMemoryNow(friend, {
                    onProgress(indexed, pending) {
                        emitStatus({
                            phase: 'syncing',
                            message: '正在建立本地索引',
                            completed: Math.min(total, completed + indexed),
                            total
                        });
                    }
                });
                completed += entries.length;
                emitStatus({ phase: 'syncing', message: '正在建立本地索引', completed, total });
            }
            emitStatus({ phase: 'ready', message: `已同步 ${completed} 条记忆`, completed, total });
            return { ok: true, count: completed };
        } catch (error) {
            const message = String(error?.message || error || '索引同步失败');
            emitStatus({ phase: 'error', message, completed, total });
            return { ok: false, error: message, count: completed };
        }
    }

    function rebuildAllMemoryIndexes() {
        return enqueueIndexTask(rebuildAllMemoryIndexesNow);
    }

    async function deleteMemoryEntriesNow(friendOrId, items) {
        const { friend } = getMemory(friendOrId);
        if (!friend?.id) return { ok: false, reason: 'missing_friend', count: 0 };
        const config = getGlobalConfig();
        const ids = (Array.isArray(items) ? items : [])
            .map(item => {
                const kind = item?.kind || getMemoryKindForCollection(item?.collection);
                const entryId = item?.entryId || item?.entry?.id;
                return entryId ? getVectorRecordId(friend.id, kind, entryId, config) : '';
            })
            .filter(Boolean);
        await deleteIndexRecordIds(ids);
        return { ok: true, count: ids.length };
    }

    function deleteMemoryEntries(friendOrId, items) {
        return enqueueIndexTask(() => deleteMemoryEntriesNow(friendOrId, items));
    }

    function purgeFriendIndex(friendId) {
        return enqueueIndexTask(() => purgeFriendIndexNow(friendId));
    }

    function cosineSimilarity(left, right) {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length === 0 || left.length !== right.length) return -1;
        let dot = 0;
        let leftLength = 0;
        let rightLength = 0;
        for (let index = 0; index < left.length; index += 1) {
            const a = Number(left[index]);
            const b = Number(right[index]);
            if (!Number.isFinite(a) || !Number.isFinite(b)) return -1;
            dot += a * b;
            leftLength += a * a;
            rightLength += b * b;
        }
        if (leftLength <= 0 || rightLength <= 0) return -1;
        return dot / Math.sqrt(leftLength * rightLength);
    }

    async function searchFriendMemory(friendOrId, queryText, options = {}) {
        const { friend } = getMemory(friendOrId);
        const config = getGlobalConfig();
        const query = String(queryText || '').trim();
        if (!friend?.id || !isConfigured(config) || !query || navigator.onLine === false) {
            return { results: [], skipped: true };
        }

        const queryEmbedding = (await requestEmbeddings(config, [query.slice(0, 6000)]))[0];
        const fingerprint = getConfigFingerprint(config);
        const records = await getIndexRecords(getScopeFriendKey(config, friend.id));
        const requestedLimit = Math.round(Number(options?.limit));
        const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
            ? Math.min(100, requestedLimit)
            : RECALL_LIMIT;
        const results = records
            .filter(record => record.fingerprint === fingerprint && Array.isArray(record.embedding))
            .map(record => ({ id: record.id, score: cosineSimilarity(queryEmbedding, record.embedding) }))
            .filter(result => Number.isFinite(result.score) && result.score >= 0)
            .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
            .slice(0, limit);
        return { results, skipped: false };
    }

    function normalizeSearchResults(value) {
        const source = Array.isArray(value?.results) ? value.results : (Array.isArray(value) ? value : []);
        return source.map(item => ({
            id: String(item?.id || ''),
            score: Number(item?.score || 0)
        })).filter(item => item.id && Number.isFinite(item.score));
    }

    function resolveSearchResults(friendOrId, results) {
        const { friend } = getMemory(friendOrId);
        const config = getGlobalConfig();
        const known = new Map();
        listIndexableEntries(friend).forEach(item => {
            known.set(getVectorRecordId(friend.id, item.kind, item.entry.id, config), item);
        });

        const resolved = [];
        const seen = new Set();
        normalizeSearchResults(results).forEach(result => {
            const item = known.get(result.id);
            if (!item) return;
            const key = `${item.kind}:${item.entry.id}`;
            if (seen.has(key)) return;
            seen.add(key);
            resolved.push({ type: item.kind, entry: item.entry, score: result.score });
        });
        return resolved;
    }

    window.imVectorMemory = {
        RECALL_LIMIT,
        EMBEDDING_REQUEST_TIMEOUT_MS,
        PROVIDERS: getProviderRegistry(),
        normalizeConfig,
        getGlobalConfig,
        getEmbeddingEndpoint,
        getConfigFingerprint,
        getVectorRecordId,
        getMemoryKindForCollection,
        getEntryContent,
        listIndexableEntries,
        createIndexRecord,
        requestEmbeddings,
        testConnection,
        syncFriendMemory,
        rebuildAllMemoryIndexes,
        deleteMemoryEntries,
        purgeFriendIndex,
        searchFriendMemory,
        resolveSearchResults,
        cosineSimilarity,
        getStatus
    };

    window.addEventListener('u2:memory-entries-updated', event => {
        const detail = event?.detail || {};
        const friend = getFriend(detail.friendId);
        if (!friend) return;
        const task = detail.action === 'delete'
            ? deleteMemoryEntries(friend, [detail])
            : syncFriendMemory(friend);
        void task.catch(error => console.warn('[iMessage] local vector memory update failed', error));
    });

    window.addEventListener('u2:group-summary-updated', event => {
        const friend = getFriend(event?.detail?.groupId);
        if (!friend) return;
        void syncFriendMemory(friend).catch(error => console.warn('[iMessage] local vector memory update failed', error));
    });

    window.addEventListener('u2:friend-removed', event => {
        const friendId = event?.detail?.friendId;
        if (friendId == null) return;
        void purgeFriendIndex(friendId).catch(error => console.warn('[iMessage] local vector index cleanup failed', error));
    });
})();
