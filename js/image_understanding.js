// Unified image-understanding adapters used by X post engagement.
(function () {
    const PROVIDERS = Object.freeze([
        'openai',
        'gemini',
        'claude',
        'grok',
        'qwen',
        'zhipu',
        'openai-compatible'
    ]);
    const REQUEST_TIMEOUT_MS = 60000;
    const DEFAULTS = Object.freeze({
        activeProvider: 'gemini',
        providers: Object.freeze({
            openai: Object.freeze({ endpoint: 'https://api.openai.com/v1/chat/completions', apiKey: '', model: '', models: [] }),
            gemini: Object.freeze({ endpoint: 'https://generativelanguage.googleapis.com/v1beta/interactions', apiKey: '', model: '', models: [] }),
            claude: Object.freeze({ endpoint: 'https://api.anthropic.com/v1/messages', apiKey: '', model: '', models: [] }),
            grok: Object.freeze({ endpoint: 'https://api.x.ai/v1/chat/completions', apiKey: '', model: '', models: [] }),
            qwen: Object.freeze({ endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', apiKey: '', model: '', models: [] }),
            zhipu: Object.freeze({ endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', apiKey: '', model: '', models: [] }),
            'openai-compatible': Object.freeze({ endpoint: '', apiKey: '', model: '', models: [] })
        })
    });

    const ANALYSIS_PROMPT = `Analyze this image for a fictional X/Twitter feed. Return JSON only, with this exact shape:
{"summary":"","visibleText":[],"subjects":[],"scene":"","mood":"","notableDetails":[]}
Rules: describe only visible facts; transcribe text only when readable; do not identify real people, infer private attributes, or invent events. Keep every value concise and useful for generating natural social-media reactions.`;

    function normalizeConfig(value) {
        if (typeof window.u2Api?.normalizeVisionConfig === 'function') {
            return window.u2Api.normalizeVisionConfig(value);
        }
        const source = value && typeof value === 'object' ? value : {};
        const savedProviders = source.providers && typeof source.providers === 'object' ? source.providers : {};
        const providers = {};
        const normalizeModels = (models) => {
            const seen = new Set();
            return (Array.isArray(models) ? models : [])
                .map((model) => String(model || '').trim().slice(0, 256))
                .filter((model) => model && !seen.has(model) && (seen.add(model) || true))
                .slice(0, 100);
        };
        PROVIDERS.forEach((provider) => {
            const defaults = DEFAULTS.providers[provider];
            const saved = savedProviders[provider] && typeof savedProviders[provider] === 'object'
                ? savedProviders[provider]
                : {};
            providers[provider] = {
                endpoint: String(saved.endpoint ?? defaults.endpoint).trim().slice(0, 1024),
                apiKey: String(saved.apiKey || '').trim().slice(0, 512),
                model: String(saved.model || '').trim().slice(0, 256),
                models: normalizeModels(saved.models)
            };
        });
        return {
            activeProvider: PROVIDERS.includes(source.activeProvider) ? source.activeProvider : DEFAULTS.activeProvider,
            providers
        };
    }

    function getConfig() {
        const config = normalizeConfig(
            typeof window.getVisionConfig === 'function' ? window.getVisionConfig() : window.visionConfig
        );
        window.visionConfig = config;
        return config;
    }

    function getActiveConfig() {
        const config = getConfig();
        return { provider: config.activeProvider, ...config.providers[config.activeProvider] };
    }

    function parseHttpUrl(value, fieldName = '识图接口地址') {
        if (window.u2Api?.parseHttpUrl) return window.u2Api.parseHttpUrl(value, fieldName);
        const text = String(value || '').trim();
        if (!text) throw new Error(`请填写${fieldName}`);
        let parsed;
        try {
            parsed = new URL(text);
        } catch (_) {
            throw new Error(`${fieldName}格式无效`);
        }
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`${fieldName}仅支持 HTTP 或 HTTPS`);
        return parsed;
    }

    function resolveChatEndpoint(endpoint) {
        const parsed = parseHttpUrl(endpoint);
        const pathname = String(parsed.pathname || '/').replace(/\/+$/, '') || '/';
        if (/\/chat\/completions$/i.test(pathname)) parsed.pathname = pathname;
        else if (/\/v\d+(?:[a-z0-9._-]*)?$/i.test(pathname)) parsed.pathname = `${pathname}/chat/completions`;
        else parsed.pathname = `${pathname === '/' ? '' : pathname}/v1/chat/completions`;
        return parsed.toString();
    }

    function resolveModelsEndpoint(endpoint, provider) {
        const parsed = parseHttpUrl(endpoint);
        const pathname = String(parsed.pathname || '/').replace(/\/+$/, '') || '/';
        if (provider === 'gemini') {
            const version = pathname.match(/^(.*\/v\d+(?:beta|alpha)?)(?:\/.*)?$/i)?.[1] || '/v1beta';
            parsed.pathname = `${version}/models`;
            return parsed.toString();
        }
        if (/\/models$/i.test(pathname)) parsed.pathname = pathname;
        else if (/\/(?:chat\/completions|messages)$/i.test(pathname)) parsed.pathname = pathname.replace(/\/(?:chat\/completions|messages)$/i, '/models');
        else if (/\/v\d+(?:[a-z0-9._-]*)?$/i.test(pathname)) parsed.pathname = `${pathname}/models`;
        else parsed.pathname = `${pathname === '/' ? '' : pathname}/v1/models`;
        return parsed.toString();
    }

    function validateActiveConfig(config = getActiveConfig()) {
        if (!PROVIDERS.includes(config?.provider)) throw new Error('请选择识图服务商');
        const endpoint = parseHttpUrl(config.endpoint).toString();
        const apiKey = String(config.apiKey || '').trim();
        const model = String(config.model || '').trim();
        if (!apiKey) throw new Error('请填写识图 API 密钥');
        if (!model) throw new Error('请填写识图模型');
        return { provider: config.provider, endpoint, apiKey, model };
    }

    function isConfigured(config = getActiveConfig()) {
        try {
            validateActiveConfig(config);
            return true;
        } catch (_) {
            return false;
        }
    }

    function getSilentHeaders() {
        const header = window.u2Api?.INTERNAL_SILENT_ERROR_HEADER || 'X-U2-Silent-Errors';
        return { [header]: '1' };
    }

    async function readError(response, provider) {
        const detail = window.u2Api?.readApiError
            ? await window.u2Api.readApiError(response)
            : { message: await response.text().catch(() => '') };
        const message = String(detail?.message || response.statusText || '').trim();
        if (response.status === 401 || response.status === 403) return new Error(`${provider} 鉴权失败，请检查密钥或模型权限`);
        if (response.status === 402) return new Error(`${provider} 额度不足`);
        if (response.status === 429) return new Error(`${provider} 请求过于频繁或额度已用完`);
        return new Error(`${provider} 识图失败（HTTP ${response.status}${message ? `：${message}` : ''}）`);
    }

    async function fetchJson(endpoint, init, provider) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const response = await fetch(endpoint, { ...init, signal: controller.signal });
            if (!response.ok) throw await readError(response, provider);
            return await response.json();
        } catch (error) {
            if (error?.name === 'AbortError') throw new Error(`${provider} 识图超时，请稍后重试`);
            if (error instanceof SyntaxError) throw new Error(`${provider} 返回了无法解析的数据`);
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    function normalizeImageInput(image) {
        const value = String(typeof image === 'string' ? image : image?.url || '').trim();
        if (!value) throw new Error('没有可供识别的图片');
        if (/^data:image\//i.test(value)) {
            const match = value.match(/^data:([^;,]+);base64,(.+)$/i);
            if (!match) throw new Error('图片数据格式无效');
            return { kind: 'base64', value, mimeType: match[1], base64: match[2] };
        }
        if (!/^https?:\/\//i.test(value)) throw new Error('图片地址仅支持 http(s) URL 或 data URL');
        return { kind: 'url', value, mimeType: String(image?.mimeType || '').trim() };
    }

    function dataUrlParts(dataUrl) {
        const match = String(dataUrl || '').match(/^data:([^;,]+);base64,(.+)$/i);
        if (!match) throw new Error('图片数据格式无效');
        return { mimeType: match[1], base64: match[2] };
    }

    async function remoteImageToDataUrl(url) {
        const response = await fetch(url, { headers: getSilentHeaders() });
        if (!response.ok) throw new Error('远程图片无法读取');
        const blob = await response.blob();
        if (!/^image\//i.test(blob.type || '')) throw new Error('远程地址不是有效图片');
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('远程图片读取失败'));
            reader.readAsDataURL(blob);
        });
    }

    function contentText(value) {
        if (typeof value === 'string') return value;
        if (!Array.isArray(value)) return '';
        return value.map((item) => {
            if (typeof item === 'string') return item;
            return String(item?.text || item?.content || '');
        }).filter(Boolean).join('\n');
    }

    function extractOpenAiText(data) {
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content === 'string' && content.trim()) return content.trim();
        if (typeof data?.choices?.[0]?.text === 'string' && data.choices[0].text.trim()) return data.choices[0].text.trim();
        if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
        return contentText(content).trim();
    }

    function extractClaudeText(data) {
        return contentText(data?.content).trim();
    }

    function extractGeminiText(data) {
        if (typeof data?.output_text === 'string') return data.output_text.trim();
        const queue = [data?.output, data?.candidates, data?.content].filter(Boolean);
        while (queue.length) {
            const current = queue.shift();
            if (Array.isArray(current)) {
                queue.push(...current);
                continue;
            }
            if (!current || typeof current !== 'object') continue;
            if (typeof current.text === 'string' && /output_text|text/i.test(String(current.type || ''))) {
                return current.text.trim();
            }
            if (typeof current.output_text === 'string') return current.output_text.trim();
            Object.values(current).forEach((value) => {
                if (value && typeof value === 'object') queue.push(value);
            });
        }
        return '';
    }

    function parseJsonPayload(text) {
        const raw = String(text || '').trim();
        if (!raw) throw new Error('识图模型没有返回内容');
        try {
            return JSON.parse(raw);
        } catch (_) {
            const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/i) || raw.match(/(\{[\s\S]*\})/);
            if (!match) throw new Error('识图模型未返回有效 JSON');
            try {
                return JSON.parse(match[1]);
            } catch (error) {
                throw new Error('识图模型未返回有效 JSON');
            }
        }
    }

    function compactText(value, maxLength = 300) {
        return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
    }

    function compactList(value, maxItems = 12, maxLength = 160) {
        const values = Array.isArray(value) ? value : (value ? [value] : []);
        const seen = new Set();
        return values.map((item) => compactText(item, maxLength))
            .filter((item) => item && !seen.has(item) && (seen.add(item) || true))
            .slice(0, maxItems);
    }

    function normalizeAnalysis(payload, config) {
        const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
        const result = {
            status: 'ready',
            summary: compactText(source.summary, 500),
            visibleText: compactList(source.visibleText, 12, 200),
            subjects: compactList(source.subjects, 12, 160),
            scene: compactText(source.scene, 300),
            mood: compactText(source.mood, 120),
            notableDetails: compactList(source.notableDetails, 12, 160),
            provider: config.provider,
            model: config.model,
            analyzedAt: Date.now()
        };
        if (!result.summary && !result.scene && result.subjects.length === 0 && result.notableDetails.length === 0) {
            throw new Error('识图结果缺少可用画面摘要');
        }
        return result;
    }

    function openAiHeaders(config) {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
            ...getSilentHeaders()
        };
    }

    async function analyze(image, options = {}) {
        const config = validateActiveConfig(options.config || getActiveConfig());
        const input = normalizeImageInput(image);
        let data;
        let text = '';

        if (config.provider === 'gemini') {
            const imagePart = input.kind === 'base64'
                ? { type: 'image', data: input.base64, mime_type: input.mimeType }
                : { type: 'image', uri: input.value, mime_type: input.mimeType || undefined };
            data = await fetchJson(config.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': config.apiKey,
                    ...getSilentHeaders()
                },
                body: JSON.stringify({
                    model: config.model,
                    input: [
                        { type: 'text', text: ANALYSIS_PROMPT },
                        imagePart
                    ],
                    response_format: { type: 'text', mime_type: 'application/json' }
                })
            }, 'Gemini');
            text = extractGeminiText(data);
        } else if (config.provider === 'claude') {
            const dataUrl = input.kind === 'base64' ? input.value : await remoteImageToDataUrl(input.value);
            const source = dataUrlParts(dataUrl);
            data = await fetchJson(config.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': config.apiKey,
                    'anthropic-version': '2023-06-01',
                    ...getSilentHeaders()
                },
                body: JSON.stringify({
                    model: config.model,
                    max_tokens: 600,
                    temperature: 0.2,
                    system: 'You are a precise image-analysis service. Output JSON only.',
                    messages: [{
                        role: 'user',
                        content: [
                            { type: 'image', source: { type: 'base64', media_type: source.mimeType, data: source.base64 } },
                            { type: 'text', text: ANALYSIS_PROMPT }
                        ]
                    }]
                })
            }, 'Claude');
            text = extractClaudeText(data);
        } else {
            const label = config.provider === 'openai' ? 'OpenAI'
                : config.provider === 'grok' ? 'Grok'
                    : config.provider === 'qwen' ? 'Qwen / DashScope'
                        : config.provider === 'zhipu' ? '智谱 GLM' : 'OpenAI 兼容服务';
            data = await fetchJson(resolveChatEndpoint(config.endpoint), {
                method: 'POST',
                headers: openAiHeaders(config),
                body: JSON.stringify({
                    model: config.model,
                    temperature: 0.2,
                    max_tokens: 600,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: 'You are a precise image-analysis service. Output JSON only.' },
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: ANALYSIS_PROMPT },
                                { type: 'image_url', image_url: { url: input.value } }
                            ]
                        }
                    ]
                })
            }, label);
            text = extractOpenAiText(data);
        }

        return normalizeAnalysis(parseJsonPayload(text), config);
    }

    async function fetchModels(configInput = getActiveConfig()) {
        const provider = PROVIDERS.includes(configInput?.provider) ? configInput.provider : getConfig().activeProvider;
        const config = {
            provider,
            endpoint: String(configInput?.endpoint || '').trim(),
            apiKey: String(configInput?.apiKey || '').trim()
        };
        parseHttpUrl(config.endpoint);
        if (!config.apiKey) throw new Error('请填写识图 API 密钥');
        const headers = { ...getSilentHeaders() };
        if (provider === 'gemini') headers['x-goog-api-key'] = config.apiKey;
        else if (provider === 'claude') {
            headers['x-api-key'] = config.apiKey;
            headers['anthropic-version'] = '2023-06-01';
        } else headers.Authorization = `Bearer ${config.apiKey}`;
        const data = await fetchJson(resolveModelsEndpoint(config.endpoint, provider), { method: 'GET', headers }, '识图服务');
        const rows = Array.isArray(data?.data) ? data.data : (Array.isArray(data?.models) ? data.models : []);
        const models = rows.map((item) => typeof item === 'string' ? item : (item?.id || item?.name || item?.model || ''))
            .map((model) => String(model || '').replace(/^models\//, '').trim())
            .filter(Boolean);
        return Array.from(new Set(models)).sort((a, b) => a.localeCompare(b));
    }

    window.visionConfig = normalizeConfig(window.visionConfig);
    window.u2ImageUnderstanding = Object.freeze({
        PROVIDERS,
        DEFAULT_CONFIG: DEFAULTS,
        REQUEST_TIMEOUT_MS,
        normalizeConfig,
        getConfig,
        getActiveConfig,
        validateActiveConfig,
        isConfigured,
        resolveChatEndpoint,
        resolveModelsEndpoint,
        parseJsonPayload,
        normalizeAnalysis,
        fetchModels,
        analyze
    });
})();
