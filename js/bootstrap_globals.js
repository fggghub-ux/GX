// ==========================================
// U2: bootstrap_globals.js
// 在各应用模块注册 DOMContentLoaded 回调之前，提前准备全局配置对象。
// 这样 iMessage 等模块即使先加载，也不会在初始化时拿到 undefined。
// ==========================================
(function () {
    const API_PROVIDERS = Object.freeze([
        'openai',
        'deepseek',
        'siliconflow',
        'gemini',
        'anthropic',
        'openai-compatible'
    ]);

    const defaultApiConfig = {
        provider: 'openai-compatible',
        endpoint: '',
        apiKey: '',
        model: '',
        temperature: 0.7
    };

    const VECTOR_MEMORY_PROVIDERS = Object.freeze({
        siliconflow: {
            label: '硅基流动',
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
            label: '阿里云百炼',
            endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings',
            defaultModel: 'text-embedding-v4',
            models: ['text-embedding-v4', 'text-embedding-v3']
        },
        zhipu: {
            label: '智谱 AI',
            endpoint: 'https://open.bigmodel.cn/api/paas/v4/embeddings',
            defaultModel: 'embedding-3',
            models: ['embedding-3', 'embedding-2']
        },
        'openai-compatible': {
            label: '自定义 OpenAI 兼容',
            endpoint: '',
            defaultModel: '',
            models: []
        }
    });

    const defaultVectorMemoryConfig = {
        enabled: false,
        provider: 'siliconflow',
        endpoint: '',
        apiKey: '',
        model: 'BAAI/bge-m3'
    };

    const defaultImageGenerationConfig = {
        activeProvider: 'gemini',
        providers: {
            openai: {
                endpoint: 'https://api.openai.com/v1/images/generations',
                apiKey: '',
                model: 'gpt-image-1.5',
                size: '1024x1024',
                models: []
            },
            gemini: {
                endpoint: 'https://generativelanguage.googleapis.com/v1beta/interactions',
                apiKey: '',
                model: 'gemini-3.1-flash-image',
                size: '1024x1024',
                models: []
            },
            novelai: {
                endpoint: 'https://image.novelai.net/ai/generate-image',
                apiKey: '',
                model: '',
                size: '1024x1024',
                models: []
            },
            grok: {
                endpoint: 'https://api.x.ai/v1/images/generations',
                apiKey: '',
                model: 'grok-imagine-image',
                size: '1024x1024',
                models: []
            },
            relay: {
                endpoint: '',
                apiKey: '',
                model: '',
                size: '1024x1024',
                models: []
            }
        }
    };

    const VISION_PROVIDERS = Object.freeze({
        openai: {
            label: 'OpenAI',
            endpoint: 'https://api.openai.com/v1/chat/completions'
        },
        gemini: {
            label: 'Gemini',
            endpoint: 'https://generativelanguage.googleapis.com/v1beta/interactions'
        },
        claude: {
            label: 'Claude',
            endpoint: 'https://api.anthropic.com/v1/messages'
        },
        grok: {
            label: 'Grok',
            endpoint: 'https://api.x.ai/v1/chat/completions'
        },
        qwen: {
            label: 'Qwen / DashScope',
            endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
        },
        zhipu: {
            label: '智谱 GLM',
            endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
        },
        'openai-compatible': {
            label: 'OpenAI 兼容',
            endpoint: ''
        }
    });

    const defaultVisionConfig = {
        activeProvider: 'gemini',
        providers: Object.fromEntries(Object.entries(VISION_PROVIDERS).map(([provider, meta]) => [provider, {
            endpoint: meta.endpoint,
            apiKey: '',
            model: '',
            models: []
        }]))
    };

    const TTS_PROVIDER_IDS = Object.freeze([
        'minimax',
        'openai',
        'openai-compatible',
        'elevenlabs',
        'azure',
        'google',
        'aws-polly',
        'volcengine',
        'dashscope',
        'tencent',
        'baidu',
        'xfyun'
    ]);

    const defaultTtsConfig = {
        activeProvider: 'minimax',
        providers: {}
    };

    const defaultUserState = {
        name: '',
        phone: '',
        persona: '',
        avatarUrl: null
    };

    function safeLoad(key, fallback) {
        try {
            if (window.StorageManager && typeof window.StorageManager.load === 'function') {
                return window.StorageManager.load(key, fallback);
            }

            return fallback;
        } catch (error) {
            console.warn(`[bootstrap_globals] Failed to load ${key}:`, error);
            return fallback;
        }
    }

    function normalizeApiConfig(value) {
        const normalized = sanitizeApiConfig({
            ...defaultApiConfig,
            ...(value && typeof value === 'object' ? value : {})
        });
        if (normalized.endpoint) {
            try {
                normalized.endpoint = normalizeApiEndpoint(normalized.endpoint, normalized.provider);
            } catch (error) {
                // Keep the trimmed value so the settings UI can explain and correct it.
            }
        }
        return normalized;
    }

    function normalizeVectorMemoryConfig(value) {
        const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        const isLegacyConfig = !source.provider && [
            'namespace',
            'embeddingModel',
            'embeddingDimensions',
            'embeddingRevision',
            'topK',
            'timeoutMs'
        ].some((key) => Object.prototype.hasOwnProperty.call(source, key));
        const rawProvider = String(source.provider || defaultVectorMemoryConfig.provider).trim().toLowerCase();
        const provider = Object.prototype.hasOwnProperty.call(VECTOR_MEMORY_PROVIDERS, rawProvider)
            ? rawProvider
            : defaultVectorMemoryConfig.provider;
        let endpoint = String(source.endpoint || '').trim();

        if (endpoint) {
            try {
                endpoint = parseHttpUrl(endpoint).toString().replace(/\/+$/, '');
            } catch (error) {
                endpoint = '';
            }
        }

        const providerMeta = VECTOR_MEMORY_PROVIDERS[provider];
        return {
            enabled: !isLegacyConfig && source.enabled === true,
            provider,
            endpoint: provider === 'openai-compatible' ? endpoint.slice(0, 1024) : '',
            apiKey: !isLegacyConfig ? String(source.apiKey || '').trim().slice(0, 512) : '',
            model: String(source.model || providerMeta.defaultModel || '').trim().slice(0, 256)
        };
    }

    function normalizeTtsConfig(value) {
        const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        const isLegacyMinimaxConfig = !source.providers && [
            'region',
            'customEndpointEnabled',
            'endpoint',
            'apiKey',
            'groupId',
            'ttsModel'
        ].some((key) => Object.prototype.hasOwnProperty.call(source, key));
        const legacyMinimax = isLegacyMinimaxConfig ? source : {};
        const sourceProviders = source.providers && typeof source.providers === 'object' ? source.providers : {};
        const providers = {};
        TTS_PROVIDER_IDS.forEach((provider) => {
            const saved = sourceProviders[provider] && typeof sourceProviders[provider] === 'object'
                ? sourceProviders[provider]
                : {};
            providers[provider] = { ...saved };
        });
        if (isLegacyMinimaxConfig) {
            const region = legacyMinimax.region === 'intl' ? 'intl' : 'cn';
            providers.minimax = {
                region,
                endpoint: legacyMinimax.customEndpointEnabled
                    ? String(legacyMinimax.endpoint || '').trim()
                    : (region === 'intl' ? 'https://api.minimax.io' : 'https://api.minimax.chat'),
                apiKey: String(legacyMinimax.apiKey || '').trim(),
                groupId: String(legacyMinimax.groupId || '').trim(),
                model: String(legacyMinimax.ttsModel || '').trim(),
                models: []
            };
        }
        const activeProvider = TTS_PROVIDER_IDS.includes(source.activeProvider)
            ? source.activeProvider
            : 'minimax';
        return { ...defaultTtsConfig, activeProvider, providers };
    }

    function normalizeImageGenerationConfig(value) {
        const source = value && typeof value === 'object' ? value : {};
        const sourceProviders = source.providers && typeof source.providers === 'object'
            ? source.providers
            : {};
        const providers = {};
        const normalizeImageModels = (models) => {
            const seen = new Set();
            return (Array.isArray(models) ? models : [])
                .map((model) => String(model || '').trim().slice(0, 256))
                .filter((model) => model && !seen.has(model) && (seen.add(model) || true))
                .slice(0, 100);
        };
        Object.keys(defaultImageGenerationConfig.providers).forEach((provider) => {
            const defaults = defaultImageGenerationConfig.providers[provider];
            const saved = sourceProviders[provider] && typeof sourceProviders[provider] === 'object'
                ? sourceProviders[provider]
                : {};
            providers[provider] = {
                endpoint: String(saved.endpoint ?? defaults.endpoint).trim(),
                apiKey: String(saved.apiKey ?? defaults.apiKey).trim(),
                model: String(saved.model ?? defaults.model).trim(),
                size: ['1024x1024', '1024x1536', '1536x1024'].includes(saved.size)
                    ? saved.size
                    : defaults.size,
                models: normalizeImageModels(saved.models)
            };
        });
        const activeProvider = Object.prototype.hasOwnProperty.call(providers, source.activeProvider)
            ? source.activeProvider
            : defaultImageGenerationConfig.activeProvider;
        return { activeProvider, providers };
    }

    function normalizeVisionConfig(value) {
        const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        const sourceProviders = source.providers && typeof source.providers === 'object'
            ? source.providers
            : {};
        const normalizeModels = (models) => {
            const seen = new Set();
            return (Array.isArray(models) ? models : [])
                .map((model) => String(model || '').trim().slice(0, 256))
                .filter((model) => model && !seen.has(model) && (seen.add(model) || true))
                .slice(0, 100);
        };
        const providers = {};
        Object.entries(VISION_PROVIDERS).forEach(([provider, meta]) => {
            const saved = sourceProviders[provider] && typeof sourceProviders[provider] === 'object'
                ? sourceProviders[provider]
                : {};
            providers[provider] = {
                endpoint: String(saved.endpoint ?? meta.endpoint).trim().slice(0, 1024),
                apiKey: String(saved.apiKey || '').trim().slice(0, 512),
                model: String(saved.model || '').trim().slice(0, 256),
                models: normalizeModels(saved.models)
            };
        });
        const activeProvider = Object.prototype.hasOwnProperty.call(providers, source.activeProvider)
            ? source.activeProvider
            : defaultVisionConfig.activeProvider;
        return { activeProvider, providers };
    }

    function safeSave(key, value) {
        try {
            if (window.StorageManager && typeof window.StorageManager.save === 'function') {
                window.StorageManager.save(key, value);
                return;
            }
            console.warn(`[bootstrap_globals] StorageManager unavailable for ${key}`);
        } catch (error) {
            console.warn(`[bootstrap_globals] Failed to save ${key}:`, error);
        }
    }

    function resolveUserStateFromAccounts() {
        const accounts = safeLoad('u2_accounts', []);
        const currentAccountId = safeLoad('u2_currentAccountId', null);

        if (Array.isArray(accounts) && currentAccountId != null) {
            const account = accounts.find((item) => String(item.id) === String(currentAccountId));
            if (account) {
                return {
                    name: account.name || '',
                    phone: account.phone || '',
                    persona: account.persona || account.signature || '',
                    avatarUrl: account.avatarUrl || null
                };
            }
        }

        return { ...defaultUserState };
    }

    window.apiConfig = normalizeApiConfig(window.apiConfig || safeLoad('u2_apiConfig', defaultApiConfig));
    window.vectorMemoryConfig = normalizeVectorMemoryConfig(
        window.vectorMemoryConfig || safeLoad('u2_vectorMemoryConfig', defaultVectorMemoryConfig)
    );
    window.imageGenerationConfig = normalizeImageGenerationConfig(
        window.imageGenerationConfig || safeLoad('u2_imageGenerationConfig', defaultImageGenerationConfig)
    );
    window.visionConfig = normalizeVisionConfig(
        window.visionConfig || safeLoad('u2_visionConfig', defaultVisionConfig)
    );
    const storedTtsConfig = safeLoad('u2_ttsConfig', null);
    const storedLegacyMinimaxConfig = safeLoad('u2_minimaxConfig', null);
    window.ttsConfig = normalizeTtsConfig(window.ttsConfig || storedTtsConfig || storedLegacyMinimaxConfig);
    window.userState = {
        ...defaultUserState,
        ...(window.userState && typeof window.userState === 'object' ? window.userState : resolveUserStateFromAccounts())
    };

    window.getApiConfig = function getApiConfig() {
        window.apiConfig = normalizeApiConfig(window.apiConfig || safeLoad('u2_apiConfig', defaultApiConfig));
        return window.apiConfig;
    };

    window.getVectorMemoryConfig = function getVectorMemoryConfig() {
        window.vectorMemoryConfig = normalizeVectorMemoryConfig(
            window.vectorMemoryConfig || safeLoad('u2_vectorMemoryConfig', defaultVectorMemoryConfig)
        );
        return window.vectorMemoryConfig;
    };

    window.getImageGenerationConfig = function getImageGenerationConfig() {
        window.imageGenerationConfig = normalizeImageGenerationConfig(window.imageGenerationConfig);
        return window.imageGenerationConfig;
    };

    window.getActiveImageGenerationConfig = function getActiveImageGenerationConfig() {
        const config = window.getImageGenerationConfig();
        return {
            provider: config.activeProvider,
            ...(config.providers[config.activeProvider] || {})
        };
    };

    window.getVisionConfig = function getVisionConfig() {
        window.visionConfig = normalizeVisionConfig(window.visionConfig || safeLoad('u2_visionConfig', defaultVisionConfig));
        return window.visionConfig;
    };

    window.getActiveVisionConfig = function getActiveVisionConfig() {
        const config = window.getVisionConfig();
        return {
            provider: config.activeProvider,
            ...(config.providers[config.activeProvider] || {})
        };
    };

    window.getTtsConfig = function getTtsConfig() {
        window.ttsConfig = normalizeTtsConfig(window.ttsConfig || safeLoad('u2_ttsConfig', storedLegacyMinimaxConfig));
        return window.ttsConfig;
    };

    window.getUserState = function getUserState() {
        if (!window.userState || typeof window.userState !== 'object') {
            window.userState = resolveUserStateFromAccounts();
        }
        return window.userState;
    };

    const INTERNAL_SILENT_ERROR_HEADER = 'X-U2-Silent-Errors';
    const INTERNAL_GLOBAL_ERROR_HEADER = 'X-U2-Global-Errors';

    function parseHttpUrl(value, fieldName = '接口地址') {
        const text = String(value || '').trim();
        if (!text) throw new Error(`请填写${fieldName}`);

        let parsed;
        try {
            parsed = new URL(text);
        } catch (error) {
            throw new Error(`${fieldName}格式无效`);
        }
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error(`${fieldName}仅支持 HTTP 或 HTTPS`);
        }
        return parsed;
    }

    function trimTrailingSlashes(pathname) {
        const trimmed = String(pathname || '').replace(/\/+$/, '');
        return trimmed || '/';
    }

    function normalizeApiProvider(value) {
        const provider = String(value || '').trim().toLowerCase();
        return API_PROVIDERS.includes(provider) ? provider : defaultApiConfig.provider;
    }

    function isGeminiProvider(provider) {
        return normalizeApiProvider(provider) === 'gemini';
    }

    function isAnthropicProvider(provider) {
        return normalizeApiProvider(provider) === 'anthropic';
    }

    function detectApiProviderFromEndpoint(endpoint) {
        try {
            const hostname = parseHttpUrl(endpoint).hostname.toLowerCase();
            if (hostname === 'generativelanguage.googleapis.com') return 'gemini';
            if (hostname === 'api.anthropic.com') return 'anthropic';
        } catch (error) {
            // The normal validation path reports malformed endpoints.
        }
        return 'openai-compatible';
    }

    function normalizeNativeApiEndpoint(endpoint, provider) {
        const parsed = parseHttpUrl(endpoint);
        const normalizedProvider = normalizeApiProvider(provider);
        let pathname = trimTrailingSlashes(parsed.pathname);
        parsed.search = '';
        parsed.hash = '';

        if (isGeminiProvider(normalizedProvider)) {
            pathname = pathname
                .replace(/\/chat\/completions$/i, '')
                .replace(/\/models\/[^/]+:(?:generateContent|streamGenerateContent)$/i, '');
        } else if (isAnthropicProvider(normalizedProvider)) {
            pathname = pathname.replace(/\/(?:chat\/completions|messages|models)$/i, '');
        }

        parsed.pathname = pathname;
        return parsed.toString();
    }

    function normalizeApiEndpoint(endpoint, provider) {
        const resolvedProvider = normalizeApiProvider(provider || detectApiProviderFromEndpoint(endpoint));
        if (isGeminiProvider(resolvedProvider) || isAnthropicProvider(resolvedProvider)) {
            return normalizeNativeApiEndpoint(endpoint, resolvedProvider);
        }
        return resolveChatCompletionsEndpoint(endpoint);
    }

    function resolveChatCompletionsEndpoint(endpoint) {
        const parsed = parseHttpUrl(endpoint);
        const pathname = trimTrailingSlashes(parsed.pathname);
        if (/\/chat\/completions$/i.test(pathname)) {
            parsed.pathname = pathname;
        } else if (/\/v\d+(?:[a-z0-9._-]*)?$/i.test(pathname)) {
            parsed.pathname = `${pathname}/chat/completions`;
        } else {
            parsed.pathname = `${pathname === '/' ? '' : pathname}/v1/chat/completions`;
        }
        return parsed.toString();
    }

    function resolveModelsEndpoint(endpoint) {
        const parsed = parseHttpUrl(endpoint);
        const pathname = trimTrailingSlashes(parsed.pathname);
        const provider = detectApiProviderFromEndpoint(endpoint);
        parsed.search = '';
        parsed.hash = '';

        if (isGeminiProvider(provider)) {
            parsed.pathname = `${pathname.replace(/\/chat\/completions$/i, '')}/models`.replace(/\/\/+/g, '/');
            return parsed.toString();
        }

        if (isAnthropicProvider(provider)) {
            const basePath = pathname.replace(/\/(?:chat\/completions|messages)$/i, '');
            parsed.pathname = `${basePath}/models`.replace(/\/\/+/g, '/');
            return parsed.toString();
        }

        if (/\/models$/i.test(pathname)) {
            parsed.pathname = pathname;
        } else if (/\/chat\/completions$/i.test(pathname)) {
            parsed.pathname = pathname.replace(/\/chat\/completions$/i, '/models');
        } else if (/\/v\d+(?:[a-z0-9._-]*)?$/i.test(pathname)) {
            parsed.pathname = `${pathname}/models`;
        } else {
            parsed.pathname = `${pathname === '/' ? '' : pathname}/v1/models`;
        }
        return parsed.toString();
    }

    function sanitizeApiConfig(value) {
        const config = value && typeof value === 'object' ? value : {};
        const temperature = Number.parseFloat(config.temperature);
        return {
            provider: normalizeApiProvider(config.provider),
            endpoint: String(config.endpoint || '').trim(),
            apiKey: String(config.apiKey || '').trim(),
            model: String(config.model || '').trim(),
            temperature: Number.isFinite(temperature) ? Math.max(0, Math.min(2, temperature)) : 0.7
        };
    }

    function validateApiConfig(value, options = {}) {
        const config = sanitizeApiConfig(value);
        parseHttpUrl(config.endpoint);
        if (!config.apiKey) throw new Error('请填写 API 密钥');
        if (options.requireModel !== false && !config.model) throw new Error('请填写模型名称');
        return config;
    }

    function buildApiHeaders(config, extraHeaders = {}) {
        const endpoint = String(config?.endpoint || '');
        const provider = normalizeApiProvider(config?.provider || detectApiProviderFromEndpoint(endpoint));
        const headers = new Headers({ 'Content-Type': 'application/json', ...extraHeaders });
        if (isGeminiProvider(provider)) {
            headers.set('x-goog-api-key', String(config?.apiKey || ''));
        } else if (isAnthropicProvider(provider)) {
            headers.set('x-api-key', String(config?.apiKey || ''));
            headers.set('anthropic-version', '2023-06-01');
        } else if (/\.openai\.azure\.com(?=\/|$)/i.test(endpoint)) {
            headers.set('api-key', String(config?.apiKey || ''));
        } else {
            headers.set('Authorization', `Bearer ${String(config?.apiKey || '')}`);
        }
        return Object.fromEntries(headers.entries());
    }

    async function readApiError(response) {
        let rawBody = '';
        try {
            rawBody = await response.clone().text();
        } catch (error) {
            rawBody = '';
        }
        let detail = rawBody;
        try {
            const parsed = JSON.parse(rawBody);
            detail = parsed?.error?.message || parsed?.message || parsed?.error || rawBody;
        } catch (error) {
            // Keep the original response text.
        }
        return {
            status: response.status,
            statusText: response.statusText || '',
            rawBody,
            message: String(detail || `HTTP ${response.status}`)
        };
    }

    window.u2Api = Object.freeze({
        INTERNAL_SILENT_ERROR_HEADER,
        INTERNAL_GLOBAL_ERROR_HEADER,
        parseHttpUrl,
        normalizeApiProvider,
        detectApiProviderFromEndpoint,
        normalizeApiEndpoint,
        resolveChatCompletionsEndpoint,
        resolveModelsEndpoint,
        sanitizeApiConfig,
        VECTOR_MEMORY_PROVIDERS,
        normalizeVectorMemoryConfig,
        VISION_PROVIDERS,
        normalizeVisionConfig,
        validateApiConfig,
        buildApiHeaders,
        readApiError
    });

    // ==========================================
    // 全局 fetch 拦截器：统一处理 API 错误弹窗
    // ==========================================
    const originalFetch = window.fetch;

    function showApiErrorPopup(title, message, rawResponse) {
        // 如果已经有弹窗，先移除
        const existing = document.getElementById('global-api-error-overlay');
        if (existing) {
            existing.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'global-api-error-overlay';
        overlay.className = 'api-error-overlay';

        const rawText = typeof rawResponse === 'object' ? JSON.stringify(rawResponse, null, 2) : String(rawResponse || '');
        const modal = document.createElement('div');
        modal.className = 'api-error-modal';
        const content = document.createElement('div');
        content.className = 'api-error-content';
        const titleEl = document.createElement('div');
        titleEl.className = 'api-error-title';
        titleEl.textContent = String(title || 'API 请求失败');
        const messageEl = document.createElement('div');
        messageEl.className = 'api-error-message';
        messageEl.textContent = String(message || '接口返回错误');
        content.append(titleEl, messageEl);

        if (rawText) {
            const rawWrapper = document.createElement('div');
            rawWrapper.className = 'api-error-raw-wrapper';
            const rawEl = document.createElement('pre');
            rawEl.className = 'api-error-raw';
            rawEl.textContent = rawText;
            rawWrapper.appendChild(rawEl);
            content.appendChild(rawWrapper);
        }

        const button = document.createElement('button');
        button.className = 'api-error-button';
        button.type = 'button';
        button.textContent = '确定';
        button.addEventListener('click', () => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 300);
        });
        modal.append(content, button);
        overlay.appendChild(modal);

        document.body.appendChild(overlay);
        
        // 强制重绘以触发动画
        overlay.getBoundingClientRect();
        overlay.classList.add('show');
    }

    function getMessageText(content) {
        if (typeof content === 'string') return content;
        if (!Array.isArray(content)) return String(content || '');
        return content.map((part) => {
            if (typeof part === 'string') return part;
            if (!part || typeof part !== 'object') return '';
            if (typeof part.text === 'string') return part.text;
            if (typeof part.content === 'string') return part.content;
            return '';
        }).filter(Boolean).join('\n');
    }

    function getApiRequestMessages(body) {
        return Array.isArray(body?.messages) ? body.messages : [];
    }

    function getSystemInstruction(messages) {
        return messages
            .filter((message) => ['system', 'developer'].includes(String(message?.role || '').toLowerCase()))
            .map((message) => getMessageText(message?.content).trim())
            .filter(Boolean)
            .join('\n\n');
    }

    function mergeProviderMessages(messages, mapMessage) {
        return messages.reduce((result, message) => {
            const mapped = mapMessage(message);
            if (!mapped) return result;
            const last = result[result.length - 1];
            if (last && last.role === mapped.role) {
                last.parts.push(...mapped.parts);
            } else {
                result.push(mapped);
            }
            return result;
        }, []);
    }

    function createGeminiRequest(body) {
        const messages = getApiRequestMessages(body).filter((message) => {
            const role = String(message?.role || '').toLowerCase();
            return role !== 'system' && role !== 'developer';
        });
        const contents = mergeProviderMessages(messages, (message) => {
            const text = getMessageText(message?.content).trim();
            if (!text) return null;
            return {
                role: String(message?.role || '').toLowerCase() === 'assistant' ? 'model' : 'user',
                parts: [{ text }]
            };
        });
        if (!contents.length) contents.push({ role: 'user', parts: [{ text: '' }] });

        const generationConfig = {};
        if (Number.isFinite(Number(body?.temperature))) generationConfig.temperature = Number(body.temperature);
        const maxTokens = Number(body?.max_completion_tokens ?? body?.max_tokens);
        if (Number.isFinite(maxTokens) && maxTokens > 0) generationConfig.maxOutputTokens = Math.round(maxTokens);
        if (body?.response_format?.type === 'json_object') generationConfig.responseMimeType = 'application/json';

        const nativeBody = { contents };
        const systemInstruction = getSystemInstruction(getApiRequestMessages(body));
        if (systemInstruction) nativeBody.systemInstruction = { parts: [{ text: systemInstruction }] };
        if (Object.keys(generationConfig).length) nativeBody.generationConfig = generationConfig;
        return nativeBody;
    }

    function createAnthropicRequest(body) {
        const messages = getApiRequestMessages(body).filter((message) => {
            const role = String(message?.role || '').toLowerCase();
            return role !== 'system' && role !== 'developer';
        });
        const merged = mergeProviderMessages(messages, (message) => {
            const text = getMessageText(message?.content).trim();
            if (!text) return null;
            return {
                role: String(message?.role || '').toLowerCase() === 'assistant' ? 'assistant' : 'user',
                parts: [text]
            };
        });
        if (!merged.length) merged.push({ role: 'user', parts: [''] });

        const maxTokens = Number(body?.max_tokens ?? body?.max_completion_tokens);
        const nativeBody = {
            model: String(body?.model || '').trim(),
            max_tokens: Number.isFinite(maxTokens) && maxTokens > 0 ? Math.round(maxTokens) : 2048,
            messages: merged.map((message) => ({ role: message.role, content: message.parts.join('\n') }))
        };
        if (Number.isFinite(Number(body?.temperature))) nativeBody.temperature = Number(body.temperature);
        const system = getSystemInstruction(getApiRequestMessages(body));
        if (system) nativeBody.system = system;
        return nativeBody;
    }

    function getNativeApiKey(headers) {
        const bearer = String(headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1] || '';
        return String(headers.get('x-goog-api-key') || headers.get('x-api-key') || bearer).trim();
    }

    function resolveGeminiRequestUrl(requestUrl, model) {
        const parsed = parseHttpUrl(requestUrl);
        const version = String(parsed.pathname || '').match(/^(.*\/v\d+(?:beta|alpha)?\d*)(?:\/|$)/i)?.[1] || '/v1beta';
        const normalizedModel = String(model || '').trim().replace(/^models\//i, '');
        parsed.pathname = `${version}/models/${encodeURIComponent(normalizedModel)}:generateContent`;
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString();
    }

    function resolveAnthropicRequestUrl(requestUrl) {
        const parsed = parseHttpUrl(requestUrl);
        const version = String(parsed.pathname || '').match(/^(.*\/v\d+)(?:\/|$)/i)?.[1] || '/v1';
        parsed.pathname = `${version}/messages`;
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString();
    }

    function createNativeRequestAdapter(requestUrl, requestHeaders, body) {
        const provider = detectApiProviderFromEndpoint(requestUrl);
        if (!isGeminiProvider(provider) && !isAnthropicProvider(provider)) return null;
        if (!body || typeof body !== 'object' || Array.isArray(body)) return null;

        const apiKey = getNativeApiKey(requestHeaders);
        if (!apiKey || !String(body.model || '').trim()) return null;

        if (isGeminiProvider(provider)) {
            requestHeaders.set('x-goog-api-key', apiKey);
            requestHeaders.delete('Authorization');
            requestHeaders.delete('x-api-key');
            requestHeaders.delete('anthropic-version');
            return {
                provider,
                stream: body.stream === true,
                model: String(body.model).trim().replace(/^models\//i, ''),
                url: resolveGeminiRequestUrl(requestUrl, body.model),
                body: createGeminiRequest(body)
            };
        }

        requestHeaders.set('x-api-key', apiKey);
        requestHeaders.set('anthropic-version', requestHeaders.get('anthropic-version') || '2023-06-01');
        requestHeaders.delete('Authorization');
        requestHeaders.delete('x-goog-api-key');
        return {
            provider,
            stream: body.stream === true,
            model: String(body.model).trim(),
            url: resolveAnthropicRequestUrl(requestUrl),
            body: createAnthropicRequest(body)
        };
    }

    function mapFinishReason(value) {
        const reason = String(value || '').toUpperCase();
        if (reason === 'STOP' || reason === 'END_TURN') return 'stop';
        if (reason === 'MAX_TOKENS' || reason === 'MAX_TOKENS_REACHED') return 'length';
        if (reason === 'SAFETY' || reason === 'CONTENT_FILTER') return 'content_filter';
        return reason ? reason.toLowerCase() : 'stop';
    }

    function normalizeNativeResponse(provider, data, model) {
        if (isGeminiProvider(provider)) {
            const candidate = Array.isArray(data?.candidates) ? data.candidates[0] : null;
            const content = Array.isArray(candidate?.content?.parts)
                ? candidate.content.parts.map((part) => String(part?.text || '')).join('')
                : '';
            const usage = data?.usageMetadata || {};
            return {
                id: `gemini-${Date.now()}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [{
                    index: 0,
                    message: { role: 'assistant', content },
                    finish_reason: mapFinishReason(candidate?.finishReason)
                }],
                usage: {
                    prompt_tokens: Number(usage.promptTokenCount) || 0,
                    completion_tokens: Number(usage.candidatesTokenCount) || 0,
                    total_tokens: Number(usage.totalTokenCount) || 0
                }
            };
        }

        const content = Array.isArray(data?.content)
            ? data.content.filter((part) => part?.type === 'text').map((part) => String(part.text || '')).join('')
            : '';
        const usage = data?.usage || {};
        return {
            id: String(data?.id || `anthropic-${Date.now()}`),
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: String(data?.model || model || ''),
            choices: [{
                index: 0,
                message: { role: 'assistant', content },
                finish_reason: mapFinishReason(data?.stop_reason)
            }],
            usage: {
                prompt_tokens: Number(usage.input_tokens) || 0,
                completion_tokens: Number(usage.output_tokens) || 0,
                total_tokens: (Number(usage.input_tokens) || 0) + (Number(usage.output_tokens) || 0)
            }
        };
    }

    function createCompatibleNativeResponse(response, adapter, data) {
        const payload = normalizeNativeResponse(adapter.provider, data, adapter.model);
        const headers = new Headers(response.headers);
        if (!adapter.stream) {
            headers.set('Content-Type', 'application/json');
            return new Response(JSON.stringify(payload), {
                status: response.status,
                statusText: response.statusText,
                headers
            });
        }

        const choice = payload.choices[0] || {};
        const text = String(choice?.message?.content || '');
        const chunk = {
            id: payload.id,
            object: 'chat.completion.chunk',
            created: payload.created,
            model: payload.model,
            choices: [{ index: 0, delta: { content: text }, finish_reason: null }]
        };
        const finalChunk = {
            id: payload.id,
            object: 'chat.completion.chunk',
            created: payload.created,
            model: payload.model,
            choices: [{ index: 0, delta: {}, finish_reason: choice.finish_reason || 'stop' }],
            usage: payload.usage
        };
        headers.set('Content-Type', 'text/event-stream; charset=utf-8');
        return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(finalChunk)}\n\ndata: [DONE]\n\n`, {
            status: response.status,
            statusText: response.statusText,
            headers
        });
    }

    async function readRequestJson(url, requestInit) {
        let body = requestInit.body;
        if (body === undefined && url instanceof Request) {
            body = await url.clone().text();
        }
        if (typeof body !== 'string' || !body.trim()) return null;
        try {
            return JSON.parse(body);
        } catch (error) {
            return null;
        }
    }

    window.fetch = async function(...args) {
        const url = args[0];
        const requestInit = args[1] && typeof args[1] === 'object' ? args[1] : {};
        const requestHeaders = requestInit.headers instanceof Headers
            ? requestInit.headers
            : new Headers(requestInit.headers || (url instanceof Request ? url.headers : undefined));
        const silentErrors = requestHeaders.get(INTERNAL_SILENT_ERROR_HEADER) === '1';
        const showGlobalErrors = requestHeaders.get(INTERNAL_GLOBAL_ERROR_HEADER) === '1';
        requestHeaders.delete(INTERNAL_SILENT_ERROR_HEADER);
        requestHeaders.delete(INTERNAL_GLOBAL_ERROR_HEADER);

        let requestUrl = '';
        try {
            requestUrl = String(url instanceof Request ? url.url : url || '');
        } catch (error) {
            requestUrl = '';
        }
        const isAiApiRequest = /\/(?:chat\/completions|models)(?:[/?#]|$)/i.test(requestUrl);
        if (isAiApiRequest && /\.openai\.azure\.com(?=\/|$)/i.test(requestUrl)) {
            const bearer = String(requestHeaders.get('Authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1] || '';
            if (bearer && !requestHeaders.has('api-key')) requestHeaders.set('api-key', bearer);
            requestHeaders.delete('Authorization');
        }

        let nativeAdapter = null;
        if (isAiApiRequest && String(requestInit.method || (url instanceof Request ? url.method : 'GET')).toUpperCase() === 'POST') {
            const requestBody = await readRequestJson(url, requestInit);
            nativeAdapter = createNativeRequestAdapter(requestUrl, requestHeaders, requestBody);
            if (nativeAdapter) requestUrl = nativeAdapter.url;
        }

        let networkArgs;
        if (url instanceof Request) {
            networkArgs = nativeAdapter
                ? [new Request(requestUrl, {
                    method: requestInit.method || url.method,
                    headers: requestHeaders,
                    body: JSON.stringify(nativeAdapter.body),
                    signal: requestInit.signal || url.signal
                })]
                : [new Request(url, { ...requestInit, headers: requestHeaders })];
        } else {
            networkArgs = [nativeAdapter ? requestUrl : url, {
                ...requestInit,
                headers: requestHeaders,
                ...(nativeAdapter ? { body: JSON.stringify(nativeAdapter.body) } : {})
            }];
        }
        
        try {
            const response = await originalFetch(...networkArgs);
            
            // 如果请求正常，直接返回原 response
            if (response.ok && nativeAdapter) {
                try {
                    const nativeData = await response.json();
                    return createCompatibleNativeResponse(response, nativeAdapter, nativeData);
                } catch (error) {
                    return response;
                }
            }
            if (response.ok) {
                return response;
            }

            // --- 出现错误（非 20x 状态码） ---
            
            // 复制一份 response 来读取 body，防止 consumed 影响后续调用
            if (silentErrors || !showGlobalErrors || !isAiApiRequest) return response;

            const clonedResponse = response.clone();
            let rawBody = '';
            try {
                rawBody = await clonedResponse.text();
            } catch (e) {
                rawBody = '[无法读取接口返回内容]';
            }
            
            // 弹出错误提示
            setTimeout(() => {
                showApiErrorPopup(
                    'API 请求失败', 
                    `接口返回错误状态：HTTP ${response.status}`, 
                    rawBody
                );
            }, 0);

            return response; // 依然把 response 返给调用方，让调用方的 catch 也能正常工作
            
        } catch (error) {
            // AbortError 代表调用方主动取消或超时，不应误报成网络/CORS。
            // 具体的取消原因由发起请求的业务模块负责提示。
            const isAborted = error?.name === 'AbortError' || requestInit.signal?.aborted === true;
            if (!silentErrors && showGlobalErrors && !isAborted && isAiApiRequest) {
                setTimeout(() => {
                    showApiErrorPopup(
                        '网络连接失败',
                        '无法连接 API 接口，请检查接口地址、网络连接、代理服务或跨域设置。',
                        error.message || String(error)
                    );
                }, 0);
            }
            throw error;
        }
    };

})();
