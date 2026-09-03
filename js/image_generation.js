// Unified text-to-image adapters for iMessage Gallery.
(function () {
    const PROVIDERS = Object.freeze(['openai', 'gemini', 'novelai', 'grok', 'relay']);
    const REQUEST_TIMEOUT_MS = 120000;
    const DEFAULTS = Object.freeze({
        activeProvider: 'gemini',
        providers: Object.freeze({
            openai: Object.freeze({
                endpoint: 'https://api.openai.com/v1/images/generations',
                apiKey: '',
                model: 'gpt-image-1.5',
                size: '1024x1024',
                models: []
            }),
            gemini: Object.freeze({
                endpoint: 'https://generativelanguage.googleapis.com/v1beta/interactions',
                apiKey: '',
                model: 'gemini-3.1-flash-image',
                size: '1024x1024',
                models: []
            }),
            novelai: Object.freeze({
                endpoint: 'https://image.novelai.net/ai/generate-image',
                apiKey: '',
                model: '',
                size: '1024x1024',
                models: []
            }),
            grok: Object.freeze({
                endpoint: 'https://api.x.ai/v1/images/generations',
                apiKey: '',
                model: 'grok-imagine-image',
                size: '1024x1024',
                models: []
            }),
            relay: Object.freeze({ endpoint: '', apiKey: '', model: '', size: '1024x1024', models: [] })
        })
    });

    function normalizeConfig(value) {
        const source = value && typeof value === 'object' ? value : {};
        const savedProviders = source.providers && typeof source.providers === 'object'
            ? source.providers
            : {};
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
                endpoint: String(saved.endpoint ?? defaults.endpoint).trim(),
                apiKey: String(saved.apiKey ?? defaults.apiKey).trim(),
                model: String(saved.model ?? defaults.model).trim(),
                size: ['1024x1024', '1024x1536', '1536x1024'].includes(saved.size)
                    ? saved.size
                    : defaults.size,
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
            typeof window.getImageGenerationConfig === 'function'
                ? window.getImageGenerationConfig()
                : window.imageGenerationConfig
        );
        window.imageGenerationConfig = config;
        return config;
    }

    function getActiveConfig() {
        const config = getConfig();
        return { provider: config.activeProvider, ...config.providers[config.activeProvider] };
    }

    function parseHttpUrl(value, fieldName = '生图接口地址') {
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

    function resolveImagesEndpoint(endpoint) {
        const parsed = parseHttpUrl(endpoint);
        const pathname = String(parsed.pathname || '/').replace(/\/+$/, '') || '/';
        if (/\/images\/generations$/i.test(pathname)) {
            parsed.pathname = pathname;
        } else if (/\/v\d+(?:[a-z0-9._-]*)?$/i.test(pathname)) {
            parsed.pathname = `${pathname}/images/generations`;
        } else {
            parsed.pathname = `${pathname === '/' ? '' : pathname}/v1/images/generations`;
        }
        return parsed.toString();
    }

    function validateActiveConfig(config = getActiveConfig()) {
        if (!PROVIDERS.includes(config.provider)) throw new Error('请选择生图服务商');
        parseHttpUrl(config.endpoint);
        if (!String(config.apiKey || '').trim()) {
            throw new Error(config.provider === 'novelai' ? '请填写 NovelAI Persistent API Token' : '请填写生图 API 密钥');
        }
        if (!String(config.model || '').trim()) throw new Error('请填写生图模型');
        return {
            provider: config.provider,
            endpoint: String(config.endpoint).trim(),
            apiKey: String(config.apiKey).trim(),
            model: String(config.model).trim(),
            size: ['1024x1024', '1024x1536', '1536x1024'].includes(config.size)
                ? config.size
                : '1024x1024'
        };
    }

    function getSilentHeaders() {
        const header = window.u2Api?.INTERNAL_SILENT_ERROR_HEADER || 'X-U2-Silent-Errors';
        return { [header]: '1' };
    }

    function base64ToDataUrl(value, mimeType = 'image/png') {
        const text = String(value || '').trim();
        if (!text) return '';
        if (/^data:image\//i.test(text)) return text;
        return `data:${mimeType || 'image/png'};base64,${text}`;
    }

    function dataUrlMimeType(dataUrl, fallback = 'image/png') {
        const match = String(dataUrl || '').match(/^data:([^;,]+)[;,]/i);
        return match?.[1] || fallback;
    }

    async function imageUrlToDataUrl(value) {
        const url = String(value || '').trim();
        if (!url) return '';
        if (/^data:image\//i.test(url)) return url;
        const response = await fetch(url);
        if (!response.ok) throw new Error('参考脸图片读取失败，请重新上传');
        const blob = await response.blob();
        if (!/^image\//i.test(blob.type || '')) throw new Error('参考脸文件不是有效图片');
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('参考脸图片读取失败，请重新上传'));
            reader.readAsDataURL(blob);
        });
    }

    function dataUrlParts(dataUrl) {
        const match = String(dataUrl || '').match(/^data:([^;,]+);base64,(.+)$/i);
        if (!match) throw new Error('参考脸图片格式无效，请重新上传');
        return { mimeType: match[1], base64: match[2] };
    }

    function dataUrlToBlob(dataUrl) {
        const { mimeType, base64 } = dataUrlParts(dataUrl);
        const bytes = atob(base64);
        const array = new Uint8Array(bytes.length);
        for (let index = 0; index < bytes.length; index += 1) array[index] = bytes.charCodeAt(index);
        return new Blob([array], { type: mimeType });
    }

    function resolveEditsEndpoint(endpoint) {
        const parsed = parseHttpUrl(endpoint);
        const pathname = String(parsed.pathname || '/').replace(/\/+$/, '') || '/';
        if (/\/images\/(?:generations|edits)$/i.test(pathname)) {
            parsed.pathname = pathname.replace(/\/images\/(?:generations|edits)$/i, '/images/edits');
        } else if (/\/v\d+(?:[a-z0-9._-]*)?$/i.test(pathname)) {
            parsed.pathname = `${pathname}/images/edits`;
        } else {
            parsed.pathname = `${pathname === '/' ? '' : pathname}/v1/images/edits`;
        }
        return parsed.toString();
    }

    async function readError(response, provider) {
        let detail = null;
        if (window.u2Api?.readApiError) detail = await window.u2Api.readApiError(response);
        const message = String(detail?.message || response.statusText || '').trim();
        if (response.status === 401 || response.status === 403) return new Error(`${provider} 鉴权失败，请检查密钥或模型权限`);
        if (response.status === 402) return new Error(`${provider} 额度不足`);
        if (response.status === 429) return new Error(`${provider} 请求过于频繁或额度已用完`);
        if (response.status === 400 && /safety|moderation|blocked|policy|content/i.test(message)) {
            return new Error(`${provider} 拒绝了该提示词，请调整内容后重试`);
        }
        return new Error(`${provider} 生图失败（HTTP ${response.status}${message ? `：${message}` : ''}）`);
    }

    async function fetchJson(endpoint, init, provider) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const response = await fetch(endpoint, { ...init, signal: controller.signal });
            if (!response.ok) throw await readError(response, provider);
            return await response.json();
        } catch (error) {
            if (error?.name === 'AbortError') throw new Error(`${provider} 生图超时，请稍后重试`);
            if (error instanceof SyntaxError) throw new Error(`${provider} 返回了无法解析的数据`);
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    function findGeminiImage(value) {
        if (!value || typeof value !== 'object') return null;
        if (typeof value.data === 'string' && (
            /^image\//i.test(String(value.mime_type || value.mimeType || ''))
            || value.type === 'image'
            || value.type === 'output_image'
        )) {
            return { base64: value.data, mimeType: value.mime_type || value.mimeType || 'image/png' };
        }
        if (value.output_image && typeof value.output_image.data === 'string') {
            return {
                base64: value.output_image.data,
                mimeType: value.output_image.mime_type || value.output_image.mimeType || 'image/png'
            };
        }
        const inlineData = value.inline_data || value.inlineData;
        if (inlineData && typeof inlineData.data === 'string') {
            return { base64: inlineData.data, mimeType: inlineData.mime_type || inlineData.mimeType || 'image/png' };
        }
        const children = Array.isArray(value) ? value : Object.values(value);
        for (const child of children) {
            const found = findGeminiImage(child);
            if (found) return found;
        }
        return null;
    }

    function parseOpenAiImage(data) {
        const row = Array.isArray(data?.data) ? data.data[0] : null;
        const base64 = row?.b64_json || row?.base64 || row?.image
            || data?.b64_json || data?.base64 || data?.image;
        const mimeType = row?.mime_type || row?.mimeType || data?.mime_type || data?.mimeType || 'image/png';
        if (base64) return { imageUrl: base64ToDataUrl(base64, mimeType), mimeType };
        const url = row?.url || row?.image_url || data?.url || data?.image_url;
        if (url) return { imageUrl: String(url), mimeType };
        return null;
    }

    async function generateGemini(prompt, config, referenceImage = '') {
        const aspectRatio = config.size === '1024x1536' ? '2:3' : config.size === '1536x1024' ? '3:2' : '1:1';
        const input = [];
        if (referenceImage) {
            const reference = dataUrlParts(referenceImage);
            input.push({ type: 'image', data: reference.base64, mime_type: reference.mimeType });
        }
        input.push({
            type: 'text',
            text: referenceImage
                ? `请以输入图片中的人物面部身份特征为参考，保持同一人物，但不要照搬背景、姿势或构图。${prompt}`
                : prompt
        });
        const data = await fetchJson(config.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': config.apiKey,
                ...getSilentHeaders()
            },
            body: JSON.stringify({
                model: config.model,
                input,
                response_format: { type: 'image', mime_type: 'image/png', aspect_ratio: aspectRatio, image_size: '1K' }
            })
        }, 'Gemini Image');
        const image = findGeminiImage(data);
        return image ? { imageUrl: base64ToDataUrl(image.base64, image.mimeType), mimeType: image.mimeType } : null;
    }

    async function generateNovelAi(prompt, config, referenceImage = '', negativePrompt = '') {
        const [width, height] = config.size.split('x').map(Number);
        if (referenceImage && !/4[-_.]?5/i.test(config.model)) {
            throw new Error('NovelAI 参考脸需要支持 Precise Reference 的 V4.5 图片模型');
        }
        const reference = referenceImage ? dataUrlParts(referenceImage) : null;
        const referenceParameters = reference ? {
            director_reference_images: [reference.base64],
            director_reference_descriptions: [{
                caption: { base_caption: 'character', char_captions: [] },
                legacy_uc: false,
                use_coords: false,
                use_order: true
            }],
            director_reference_strength_values: [0.75],
            director_reference_secondary_strength_values: [0.85],
            director_reference_information_extracted: [1]
        } : {};
        const data = await fetchJson(config.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
                ...getSilentHeaders()
            },
            body: JSON.stringify({
                action: 'generate',
                input: prompt,
                model: config.model,
                parameters: {
                    prompt,
                    width,
                    height,
                    n_samples: 1,
                    steps: 28,
                    scale: 5,
                    sampler: 'k_euler_ancestral',
                    seed: Math.floor(Math.random() * 4294967295),
                    qualityToggle: true,
                    negative_prompt: negativePrompt,
                    image_format: 'png',
                    ...referenceParameters
                }
            })
        }, 'NovelAI');
        const row = Array.isArray(data?.images) ? data.images[0] : null;
        return row?.image ? { imageUrl: base64ToDataUrl(row.image, 'image/png'), mimeType: 'image/png' } : null;
    }

    async function generateImageEdit(prompt, config, providerLabel, referenceImage, isRelay = false) {
        const endpoint = resolveEditsEndpoint(config.endpoint);
        if (providerLabel === 'Grok') {
            const data = await fetchJson(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`,
                    ...getSilentHeaders()
                },
                body: JSON.stringify({
                    model: config.model,
                    prompt,
                    image: { url: referenceImage, type: 'image_url' },
                    aspect_ratio: config.size === '1024x1536' ? '2:3' : config.size === '1536x1024' ? '3:2' : '1:1',
                    response_format: 'b64_json'
                })
            }, providerLabel);
            return parseOpenAiImage(data);
        }
        const form = new FormData();
        const referenceBlob = dataUrlToBlob(referenceImage);
        form.append('image', referenceBlob, `face-reference.${referenceBlob.type === 'image/jpeg' ? 'jpg' : 'png'}`);
        form.append('model', config.model);
        form.append('prompt', prompt);
        form.append('n', '1');
        form.append('size', config.size);
        form.append('input_fidelity', 'high');
        form.append('output_format', 'png');
        try {
            const data = await fetchJson(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    ...getSilentHeaders()
                },
                body: form
            }, providerLabel);
            return parseOpenAiImage(data);
        } catch (error) {
            if (config.provider === 'relay') throw new Error(`当前中转站不支持参考脸或图片编辑接口：${error?.message || '请求失败'}`);
            throw error;
        }
    }

    async function generateOpenAiCompatible(prompt, config, providerLabel, isRelay = false, referenceImage = '') {
        if (referenceImage) return generateImageEdit(prompt, config, providerLabel, referenceImage, isRelay);
        const endpoint = isRelay ? resolveImagesEndpoint(config.endpoint) : config.endpoint;
        const body = {
            model: config.model,
            prompt,
            n: 1
        };
        if (isRelay) {
            body.size = config.size;
            if (providerLabel === 'OpenAI') body.output_format = 'png';
            else body.response_format = 'b64_json';
        } else {
            body.aspect_ratio = config.size === '1024x1536' ? '2:3' : config.size === '1536x1024' ? '3:2' : '1:1';
            body.response_format = 'b64_json';
        }
        const data = await fetchJson(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
                ...getSilentHeaders()
            },
            body: JSON.stringify(body)
        }, providerLabel);
        return parseOpenAiImage(data);
    }

    function resolveModelsEndpoint(endpoint, provider) {
        const parsed = parseHttpUrl(endpoint);
        const pathname = String(parsed.pathname || '/').replace(/\/+$/, '') || '/';
        parsed.search = '';
        parsed.hash = '';
        if (provider === 'gemini') {
            const versionMatch = pathname.match(/^(.*?\/v\d+(?:beta\d*|alpha\d*)?)(?:\/.*)?$/i);
            parsed.pathname = `${versionMatch?.[1] || '/v1beta'}/models`;
            return parsed.toString();
        }
        if (provider === 'grok') {
            parsed.pathname = pathname.replace(/\/images\/generations$/i, '/image-generation-models');
            return parsed.toString();
        }
        if (/\/models$/i.test(pathname)) {
            parsed.pathname = pathname;
        } else if (/\/images\/generations$/i.test(pathname)) {
            parsed.pathname = pathname.replace(/\/images\/generations$/i, '/models');
        } else if (/\/v\d+(?:[a-z0-9._-]*)?$/i.test(pathname)) {
            parsed.pathname = `${pathname}/models`;
        } else {
            parsed.pathname = `${pathname === '/' ? '' : pathname}/v1/models`;
        }
        return parsed.toString();
    }

    async function fetchModels(configInput = getActiveConfig()) {
        const provider = PROVIDERS.includes(configInput?.provider) ? configInput.provider : getConfig().activeProvider;
        const config = {
            provider,
            endpoint: String(configInput?.endpoint || '').trim(),
            apiKey: String(configInput?.apiKey || '').trim(),
            model: String(configInput?.model || '').trim(),
            size: configInput?.size || '1024x1024'
        };
        parseHttpUrl(config.endpoint);
        if (!config.apiKey) {
            throw new Error(provider === 'novelai' ? '请填写 NovelAI Persistent API Token' : '请填写生图 API 密钥');
        }
        if (config.provider === 'novelai') {
            throw new Error('NovelAI 官方生图接口不提供模型列表，请手动填写模型');
        }
        const endpoint = resolveModelsEndpoint(config.endpoint, config.provider);
        const headers = { ...getSilentHeaders() };
        if (config.provider === 'gemini') headers['x-goog-api-key'] = config.apiKey;
        else headers.Authorization = `Bearer ${config.apiKey}`;
        const label = config.provider === 'gemini'
            ? 'Gemini Image'
            : config.provider === 'grok'
                ? 'Grok'
                : config.provider === 'openai' ? 'OpenAI' : '中转站';
        const data = await fetchJson(endpoint, { method: 'GET', headers }, label);
        let rows = [];
        if (config.provider === 'gemini') rows = Array.isArray(data?.models) ? data.models : [];
        else if (config.provider === 'grok') rows = Array.isArray(data?.models) ? data.models : [];
        else rows = Array.isArray(data?.data) ? data.data : (Array.isArray(data?.models) ? data.models : []);
        let models = rows.map((item) => typeof item === 'string' ? item : (item?.id || item?.name || ''))
            .map((item) => String(item || '').replace(/^models\//, '').trim())
            .filter(Boolean);
        if (config.provider === 'gemini') {
            const imageModels = models.filter((model) => /image|imagen/i.test(model));
            if (imageModels.length) models = imageModels;
        }
        if (config.provider === 'openai') {
            const imageModels = models.filter((model) => /gpt-image|dall-e|image/i.test(model));
            if (imageModels.length) models = imageModels;
        }
        return Array.from(new Set(models)).sort((a, b) => a.localeCompare(b));
    }

    async function localizeRemoteImage(result) {
        if (!result?.imageUrl || /^data:image\//i.test(result.imageUrl)) return result;
        try {
            const response = await fetch(result.imageUrl);
            if (!response.ok) return result;
            const blob = await response.blob();
            if (!/^image\//i.test(blob.type || '')) return result;
            const imageUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(reader.error || new Error('图片读取失败'));
                reader.readAsDataURL(blob);
            });
            return { imageUrl, mimeType: blob.type || result.mimeType || 'image/png' };
        } catch (_) {
            return result;
        }
    }

    async function generate(prompt, options = {}) {
        const normalizedPrompt = String(prompt || '').trim();
        if (!normalizedPrompt) throw new Error('请输入生图提示词');
        const config = validateActiveConfig(options.config || getActiveConfig());
        const charAppearance = String(options.charAppearance || '').trim();
        const userAppearance = String(options.userAppearance || '').trim();
        const artistPrompt = String(options.artistPrompt || '').trim();
        const negativePrompt = String(options.negativePrompt || '').trim();
        const appearanceParts = [];
        if (charAppearance) appearanceParts.push(`Char 外貌约束（仅当画面中出现 Char 时应用）：${charAppearance}`);
        if (userAppearance) appearanceParts.push(`User 外貌约束（仅当画面中出现 User 时应用）：${userAppearance}`);
        let effectivePrompt = [normalizedPrompt, ...appearanceParts, artistPrompt].filter(Boolean).join('\n');
        if (negativePrompt && config.provider !== 'novelai') {
            effectivePrompt += `\n避免出现以下内容：${negativePrompt}`;
        }
        const referenceImage = options.referenceImage
            ? await imageUrlToDataUrl(options.referenceImage)
            : '';
        let result = null;
        if (config.provider === 'gemini') result = await generateGemini(effectivePrompt, config, referenceImage);
        if (config.provider === 'novelai') result = await generateNovelAi(effectivePrompt, config, referenceImage, negativePrompt);
        if (config.provider === 'grok') result = await generateOpenAiCompatible(effectivePrompt, config, 'Grok', false, referenceImage);
        if (config.provider === 'openai') result = await generateOpenAiCompatible(effectivePrompt, config, 'OpenAI', true, referenceImage);
        if (config.provider === 'relay') result = await generateOpenAiCompatible(effectivePrompt, config, '中转站', true, referenceImage);
        if (!result?.imageUrl) throw new Error('生图接口返回成功，但没有找到图片数据');
        const localized = await localizeRemoteImage(result);
        return {
            imageUrl: localized.imageUrl,
            mimeType: localized.mimeType || dataUrlMimeType(localized.imageUrl),
            provider: config.provider,
            model: config.model,
            size: config.size,
            faceReferenceUsed: !!referenceImage
        };
    }

    window.imageGenerationConfig = normalizeConfig(window.imageGenerationConfig);
    window.u2ImageGeneration = Object.freeze({
        PROVIDERS,
        DEFAULT_CONFIG: DEFAULTS,
        REQUEST_TIMEOUT_MS,
        normalizeConfig,
        getConfig,
        getActiveConfig,
        validateActiveConfig,
        resolveImagesEndpoint,
        resolveEditsEndpoint,
        parseOpenAiImage,
        findGeminiImage,
        resolveModelsEndpoint,
        fetchModels,
        generate
    });
})();
