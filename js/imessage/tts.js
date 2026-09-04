// ==========================================
// IMESSAGE: Unified TTS runtime
// ==========================================
(function () {
    const PROVIDER_IDS = Object.freeze([
        'minimax', 'openai', 'openai-compatible', 'elevenlabs', 'azure', 'google',
        'aws-polly', 'volcengine', 'dashscope', 'tencent', 'baidu', 'xfyun'
    ]);

    const PROVIDERS = Object.freeze({
        minimax: {
            label: 'MiniMax', endpoint: 'https://api.minimax.chat', keyLabel: 'API Key', modelLabel: 'TTS 模型',
            fields: [
                { key: 'region', label: '区域', type: 'select', options: [['cn', '国内版'], ['intl', '海外版']] },
                { key: 'groupId', label: 'Group ID', placeholder: '旧版凭据可填写 Group ID', optional: true }
            ]
        },
        openai: { label: 'OpenAI', endpoint: 'https://api.openai.com/v1', keyLabel: 'OpenAI API Key', modelLabel: 'TTS 模型', fields: [] },
        'openai-compatible': { label: 'OpenAI 兼容中转站', endpoint: '', keyLabel: '中转 API Key', modelLabel: 'TTS 模型', fields: [] },
        elevenlabs: { label: 'ElevenLabs', endpoint: 'https://api.elevenlabs.io/v1', keyLabel: 'ElevenLabs API Key', modelLabel: 'TTS 模型', fields: [] },
        azure: {
            label: 'Azure Speech', endpoint: '', keyLabel: 'Speech Key', modelLabel: '默认音色', modelIsVoice: true,
            fields: [{ key: 'region', label: '区域', placeholder: '例如 eastasia' }]
        },
        google: { label: 'Google Cloud TTS', endpoint: 'https://texttospeech.googleapis.com/v1', keyLabel: 'Google API Key', modelLabel: '默认音色', modelIsVoice: true, fields: [] },
        'aws-polly': {
            label: 'AWS Polly', endpoint: '', keyLabel: 'Access Key ID', modelLabel: '默认音色', modelIsVoice: true,
            fields: [
                { key: 'region', label: '区域', placeholder: '例如 ap-east-1' },
                { key: 'secretKey', label: 'Secret Access Key', type: 'password' },
                { key: 'sessionToken', label: 'Session Token', type: 'password', optional: true }
            ]
        },
        volcengine: {
            label: '火山引擎 / 豆包语音', endpoint: 'https://openspeech.bytedance.com/api/v1/tts', keyLabel: 'Access Token', modelLabel: '资源 ID',
            fields: [
                { key: 'appId', label: 'App ID' },
                { key: 'resourceId', label: 'Resource ID', placeholder: '填写资源 ID' }
            ]
        },
        dashscope: { label: '阿里云 DashScope', endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', keyLabel: 'DashScope API Key', modelLabel: 'TTS 模型', fields: [] },
        tencent: {
            label: '腾讯云 TTS', endpoint: 'wss://tts.cloud.tencent.com/stream_ws', keyLabel: 'SecretId', modelLabel: '默认音色', modelIsVoice: true,
            fields: [
                { key: 'appId', label: 'App ID' },
                { key: 'secretKey', label: 'SecretKey', type: 'password' },
                { key: 'region', label: '区域', placeholder: '例如 ap-beijing' }
            ]
        },
        baidu: {
            label: '百度智能云 TTS', endpoint: 'https://tsn.baidu.com/text2audio', keyLabel: 'API Key', modelLabel: '默认音色', modelIsVoice: true,
            fields: [{ key: 'secretKey', label: 'Secret Key', type: 'password' }]
        },
        xfyun: {
            label: '讯飞 TTS', endpoint: 'wss://tts-api.xfyun.cn/v2/tts', keyLabel: 'API Key', modelLabel: '默认音色', modelIsVoice: true,
            fields: [
                { key: 'appId', label: 'App ID' },
                { key: 'apiSecret', label: 'API Secret', type: 'password' }
            ]
        }
    });

    const REQUEST_TIMEOUT_MS = 45000;
    const MAX_MINIMAX_TTS_TEXT_LENGTH = 9999;
    let currentAudio = null;

    function clone(value) {
        if (typeof structuredClone === 'function') return structuredClone(value);
        return JSON.parse(JSON.stringify(value));
    }

    function safeLoad(key, fallback) {
        try {
            return window.StorageManager?.load ? window.StorageManager.load(key, fallback) : fallback;
        } catch (error) {
            console.warn('[tts] Failed to load config:', error);
            return fallback;
        }
    }

    function safeSave(key, value) {
        try {
            if (window.StorageManager?.save) window.StorageManager.save(key, value);
        } catch (error) {
            console.warn('[tts] Failed to save config:', error);
        }
    }

    function cleanString(value, maxLength = 2048) {
        return String(value == null ? '' : value).trim().slice(0, maxLength);
    }

    function normalizeModels(value) {
        const seen = new Set();
        return (Array.isArray(value) ? value : [])
            .map((item) => cleanString(item, 256))
            .filter((item) => item && !seen.has(item) && (seen.add(item) || true))
            .slice(0, 200);
    }

    function isLegacyMinimaxConfig(value) {
        return value && typeof value === 'object' && !value.providers && [
            'region', 'customEndpointEnabled', 'endpoint', 'apiKey', 'groupId', 'ttsModel'
        ].some((key) => Object.prototype.hasOwnProperty.call(value, key));
    }

    function createProviderConfig(provider, saved = {}) {
        const definition = PROVIDERS[provider];
        const result = {
            endpoint: cleanString(saved.endpoint ?? definition.endpoint),
            apiKey: cleanString(saved.apiKey, 1024),
            model: cleanString(saved.model, 256),
            models: normalizeModels(saved.models)
        };
        definition.fields.forEach((field) => {
            result[field.key] = cleanString(saved[field.key], field.key === 'secretKey' || field.key === 'apiSecret' ? 1024 : 512);
        });
        if (provider === 'minimax') result.region = ['cn', 'intl'].includes(saved.region) ? saved.region : 'cn';
        return result;
    }

    function migrateLegacyMinimaxConfig(legacy) {
        const region = legacy?.region === 'intl' ? 'intl' : 'cn';
        const defaultEndpoint = region === 'intl' ? 'https://api.minimax.io' : 'https://api.minimax.chat';
        return {
            activeProvider: 'minimax',
            providers: {
                minimax: {
                    region,
                    endpoint: legacy?.customEndpointEnabled ? cleanString(legacy?.endpoint) : defaultEndpoint,
                    apiKey: cleanString(legacy?.apiKey, 1024),
                    groupId: cleanString(legacy?.groupId, 512),
                    model: cleanString(legacy?.ttsModel, 256),
                    models: []
                }
            }
        };
    }

    function normalizeConfig(value) {
        const raw = isLegacyMinimaxConfig(value) ? migrateLegacyMinimaxConfig(value) : (value && typeof value === 'object' ? value : {});
        const savedProviders = raw.providers && typeof raw.providers === 'object' ? raw.providers : {};
        const providers = {};
        PROVIDER_IDS.forEach((provider) => {
            providers[provider] = createProviderConfig(provider, savedProviders[provider] || {});
        });
        return {
            activeProvider: PROVIDER_IDS.includes(raw.activeProvider) ? raw.activeProvider : 'minimax',
            providers
        };
    }

    function getLegacyConfig() {
        return safeLoad('u2_minimaxConfig', null);
    }

    function getConfig() {
        const source = window.ttsConfig || safeLoad('u2_ttsConfig', null) || getLegacyConfig() || {};
        window.ttsConfig = normalizeConfig(source);
        return window.ttsConfig;
    }

    function getActiveConfig() {
        const config = getConfig();
        return { provider: config.activeProvider, ...(config.providers[config.activeProvider] || {}) };
    }

    function setConfig(nextConfig) {
        window.ttsConfig = normalizeConfig(nextConfig);
        safeSave('u2_ttsConfig', window.ttsConfig);
        try {
            window.dispatchEvent?.(new CustomEvent('u2:tts-config-updated', { detail: clone(window.ttsConfig) }));
        } catch (_) {
            // CustomEvent is unavailable in a few non-browser test harnesses.
        }
        return window.ttsConfig;
    }

    function getProviderDefinition(provider) {
        return PROVIDERS[provider] || PROVIDERS['openai-compatible'];
    }

    function getProviderName(provider) {
        return getProviderDefinition(provider).label;
    }

    function getBaseEndpoint(value, fieldName = '接口地址') {
        const endpoint = cleanString(value);
        if (!endpoint) throw new Error(`请填写${fieldName}`);
        let parsed;
        try {
            parsed = new URL(endpoint);
        } catch (_) {
            throw new Error(`${fieldName}格式无效`);
        }
        if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)) throw new Error(`${fieldName}仅支持 HTTP(S) 或 WebSocket`);
        return parsed;
    }

    function getHttpEndpoint(value, fieldName = '接口地址') {
        const parsed = getBaseEndpoint(value, fieldName);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`${fieldName}仅支持 HTTP 或 HTTPS`);
        return parsed;
    }

    function required(config, key, label) {
        const value = cleanString(config?.[key]);
        if (!value) throw new Error(`请填写${label}`);
        return value;
    }

    function validateActiveConfig(input = getActiveConfig(), options = {}) {
        const provider = PROVIDER_IDS.includes(input?.provider) ? input.provider : getConfig().activeProvider;
        const config = { provider, ...(input || {}) };
        const definition = getProviderDefinition(provider);
        if (provider !== 'aws-polly' && !(provider === 'azure' && !cleanString(config.endpoint))) getBaseEndpoint(config.endpoint);
        required(config, 'apiKey', definition.keyLabel);
        definition.fields.filter((field) => !field.optional && field.key !== 'region').forEach((field) => required(config, field.key, field.label));
        if (['azure', 'aws-polly', 'tencent'].includes(provider)) required(config, 'region', '区域');
        if (options.requireModel !== false && ['minimax', 'openai', 'openai-compatible', 'elevenlabs', 'dashscope', 'volcengine'].includes(provider)) {
            required(config, 'model', definition.modelLabel);
        }
        return config;
    }

    function resolveFriendTtsSettings(friend) {
        const tts = friend?.ttsVoice && typeof friend.ttsVoice === 'object'
            ? friend.ttsVoice
            : (friend?.minimaxVoice && typeof friend.minimaxVoice === 'object' ? friend.minimaxVoice : {});
        return {
            enabled: tts.enabled === true,
            voiceId: cleanString(tts.voiceId, 256),
            speed: Math.max(0.5, Math.min(2, Number.parseFloat(tts.speed) || 1)),
            language: cleanString(friend?.language, 80) || 'zh'
        };
    }

    function isTtsCharacter(friend) {
        return !!friend && friend.type !== 'group' && friend.type !== 'official';
    }

    // A group stores messages on the group itself, while the voice belongs to the
    // member's direct chat. Never fall back to the group (or a guessed member):
    // that would play another character's voice for NPC or unresolved messages.
    function resolveMessageTtsFriend(conversation, message = {}) {
        if (!conversation) return null;
        if (conversation.type !== 'group') {
            return isTtsCharacter(conversation) ? conversation : null;
        }

        const memberId = message?.speakerMemberId ?? message?.senderMemberId ?? null;
        if (message?.role === 'user' || String(memberId || '') === '__user__') return null;
        const member = window.imChat?.getGroupMessageSpeaker
            ? window.imChat.getGroupMessageSpeaker(conversation, message)
            : null;
        return isTtsCharacter(member) ? member : null;
    }

    function canSpeakForFriend(friend) {
        const settings = resolveFriendTtsSettings(friend);
        return isTtsCharacter(friend) && settings.enabled === true && !!settings.voiceId;
    }

    function canSpeakMessage(conversation, message = {}) {
        return canSpeakForFriend(resolveMessageTtsFriend(conversation, message));
    }

    function getVoiceId(config, voiceSettings) {
        const definition = getProviderDefinition(config.provider);
        const voiceId = voiceSettings.voiceId || (definition.modelIsVoice ? cleanString(config.model) : '');
        if (!voiceId) throw new Error('请先在 Chat Settings Info 填写 TTS 音色 ID');
        return voiceId;
    }

    function normalizeLanguage(language) {
        const aliases = {
            zh: 'Chinese', 'zh-cn': 'Chinese', 'chinese': 'Chinese', '中文': 'Chinese',
            yue: 'Chinese,Yue', '粤语': 'Chinese,Yue', 'cantonese': 'Chinese,Yue', 'traditional chinese with cantonese': 'Chinese,Yue',
            en: 'English', 'english': 'English', ja: 'Japanese', 'japanese': 'Japanese', '日语': 'Japanese',
            ko: 'Korean', 'korean': 'Korean', '韩语': 'Korean', fr: 'French', 'french': 'French', '法语': 'French',
            de: 'German', 'german': 'German', '德语': 'German', ru: 'Russian', 'russian': 'Russian', '俄语': 'Russian',
            es: 'Spanish', '西班牙语': 'Spanish', pt: 'Portuguese', '葡萄牙语': 'Portuguese'
        };
        const normalized = cleanString(language).toLowerCase();
        return aliases[normalized] || 'auto';
    }

    function isLikelyChinese(text) {
        return /[\u3400-\u9fff]/.test(String(text || ''));
    }

    function getSilentHeaders() {
        const header = window.u2Api?.INTERNAL_SILENT_ERROR_HEADER || 'X-U2-Silent-Errors';
        return { [header]: '1' };
    }

    async function readError(response) {
        try {
            const data = await response.clone().json();
            return cleanString(data?.error?.message || data?.message || data?.msg || data?.base_resp?.status_msg || data?.detail, 500);
        } catch (_) {
            try { return cleanString(await response.text(), 500); } catch (_) { return ''; }
        }
    }

    async function fetchWithTimeout(url, init = {}, label = 'TTS 服务') {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const response = await fetch(url, { ...init, signal: controller.signal });
            if (!response.ok) {
                const details = await readError(response);
                throw new Error(`${label}请求失败（HTTP ${response.status}${details ? `：${details}` : ''}）`);
            }
            return response;
        } catch (error) {
            if (error?.name === 'AbortError') throw new Error(`${label}请求超时，请稍后重试`);
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    function resolveOperationEndpoint(endpoint, operation) {
        const parsed = getHttpEndpoint(endpoint);
        const suffix = String(operation || '').replace(/^\/+/, '');
        let pathname = String(parsed.pathname || '/').replace(/\/+$/, '');
        pathname = pathname.replace(/\/(?:audio\/speech|models|chat\/completions|images\/generations)$/i, '');
        if (!/\/v\d+(?:[a-z0-9._-]*)?$/i.test(pathname)) pathname = `${pathname || ''}/v1`;
        parsed.pathname = `${pathname}/${suffix}`.replace(/\/+/g, '/');
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString();
    }

    function resolveMiniMaxEndpoint(config) {
        const parsed = getHttpEndpoint(config.endpoint);
        const pathname = String(parsed.pathname || '/').replace(/\/+$/, '');
        if (!/\/v1\/t2a_v2$/i.test(pathname)) parsed.pathname = `${pathname || ''}/v1/t2a_v2`.replace(/\/+/g, '/');
        const groupId = cleanString(config.groupId);
        if (groupId) parsed.searchParams.set('GroupId', groupId);
        return parsed.toString();
    }

    function resolveAzureEndpoint(config, operation) {
        const region = cleanString(config.region);
        const endpoint = cleanString(config.endpoint) || `https://${region}.tts.speech.microsoft.com`;
        const parsed = getHttpEndpoint(endpoint);
        let pathname = String(parsed.pathname || '/').replace(/\/+$/, '');
        pathname = pathname.replace(/\/cognitiveservices\/(?:v1|voices\/list)$/i, '');
        parsed.pathname = `${pathname || ''}/cognitiveservices/${operation}`.replace(/\/+/g, '/');
        parsed.search = '';
        return parsed.toString();
    }

    function resolveGoogleEndpoint(config, operation) {
        const parsed = getHttpEndpoint(config.endpoint);
        let pathname = String(parsed.pathname || '/').replace(/\/+$/, '');
        pathname = pathname.replace(/\/(?:text:synthesize|voices)$/i, '');
        if (!/\/v\d+(?:beta\d*)?$/i.test(pathname)) pathname = `${pathname || ''}/v1`;
        parsed.pathname = `${pathname}/${operation}`.replace(/\/+/g, '/');
        parsed.searchParams.set('key', required(config, 'apiKey', 'Google API Key'));
        return parsed.toString();
    }

    function base64ToBlobUrl(value, mimeType = 'audio/mpeg') {
        const base64 = String(value || '').replace(/^data:audio\/[^;]+;base64,/i, '').replace(/\s+/g, '');
        if (!base64) return '';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    }

    function hexToBlobUrl(value, mimeType = 'audio/mpeg') {
        const hex = String(value || '').replace(/^0x/i, '').replace(/\s+/g, '');
        if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return '';
        const bytes = new Uint8Array(hex.length / 2);
        for (let index = 0; index < hex.length; index += 2) bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
        return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    }

    function extractAudioUrl(data) {
        const value = [
            data?.data?.audio, data?.data?.audio_base64, data?.data?.audio_file, data?.data?.url,
            data?.output?.audio?.url, data?.output?.audio?.data, data?.output?.audio,
            data?.audio, data?.audio_base64, data?.audioContent, data?.url
        ].find(Boolean);
        // Audio payloads are commonly returned as hex/Base64. Unlike UI and
        // config strings, they must never go through cleanString(), whose
        // default 2,048-character safety limit would turn a valid MP3 into a
        // tiny, invalid Blob before playback.
        const audio = String(value == null ? '' : value).trim();
        if (!audio) return '';
        if (/^(https?:|blob:|data:audio\/)/i.test(audio)) return audio;
        if (/^[0-9a-f]+$/i.test(audio) && audio.length > 32) return hexToBlobUrl(audio);
        return base64ToBlobUrl(audio);
    }

    function getTtsResponseError(data) {
        const statusCode = data?.base_resp?.status_code;
        if (statusCode != null && Number(statusCode) !== 0) {
            const statusMessage = cleanString(data?.base_resp?.status_msg, 500);
            return statusMessage || `服务返回错误代码 ${statusCode}`;
        }
        return cleanString(
            data?.error?.message || data?.error?.detail || data?.message || data?.msg || data?.detail,
            500
        );
    }

    function getUserErrorMessage(error, fallback = '语音播放失败') {
        const message = cleanString(error?.message, 500)
            .replace(/\b(api[ _-]?key|authorization|token|secret)\b\s*[:=]\s*[^\s,;]+/gi, '$1：已隐藏');
        return message || fallback;
    }

    async function responseToAudioUrl(response, label = 'TTS 服务') {
        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('application/json') || contentType.includes('text/json')) {
            const data = await response.json();
            const audioUrl = extractAudioUrl(data);
            if (audioUrl) return audioUrl;
            const serviceError = getTtsResponseError(data);
            if (serviceError) throw new Error(`${label}合成失败：${serviceError}`);
            if (!audioUrl) throw new Error('TTS 服务未返回音频');
        }
        const blob = await response.blob();
        if (!blob.size) throw new Error('TTS 服务未返回音频');
        return URL.createObjectURL(new Blob([blob], { type: blob.type || 'audio/mpeg' }));
    }

    // MiniMax t2a_v2 always returns its audio envelope as JSON. Some compatible
    // gateways incorrectly label that JSON as text/plain (or omit the header),
    // so this provider must not use the generic content-type based parser above.
    async function responseToMiniMaxAudioUrl(response) {
        let data;
        try {
            data = await response.json();
        } catch (_) {
            throw new Error('MiniMax TTS 返回的音频响应不是有效 JSON');
        }
        const serviceError = getTtsResponseError(data);
        if (serviceError) throw new Error(`MiniMax TTS合成失败：${serviceError}`);
        const audioUrl = extractAudioUrl(data);
        if (!audioUrl) throw new Error('MiniMax TTS 未返回音频');
        return audioUrl;
    }

    async function playAudioUrl(url) {
        if (!url) throw new Error('没有可播放的音频');
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        const audio = new Audio(url);
        audio.preload = 'auto';
        currentAudio = audio;
        try {
            await audio.play();
            return audio;
        } catch (error) {
            if (currentAudio === audio) currentAudio = null;
            if (error?.name === 'NotAllowedError') {
                throw new Error('浏览器阻止音频播放，请再次点击播放按钮');
            }
            if (error?.name === 'NotSupportedError') {
                throw new Error('浏览器不支持返回的音频格式');
            }
            const details = cleanString(error?.message, 300);
            throw new Error(`音频播放失败${details ? `：${details}` : ''}`);
        }
    }

    function escapeXml(value) {
        return String(value || '').replace(/[<>&'\"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char]));
    }

    function utf8ToBase64(value) {
        const bytes = new TextEncoder().encode(String(value || ''));
        let binary = '';
        bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
        return btoa(binary);
    }

    async function synthesizeMiniMax(config, text, voiceSettings) {
        const voiceId = getVoiceId(config, voiceSettings);
        const body = {
            model: required(config, 'model', 'TTS 模型'), text, stream: false, output_format: 'hex',
            voice_setting: { voice_id: voiceId, speed: voiceSettings.speed, vol: 1, pitch: 0 },
            audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 }
        };
        const language = normalizeLanguage(voiceSettings.language);
        if (language !== 'auto' && (language !== 'Chinese' || isLikelyChinese(text))) body.language_boost = language;
        const response = await fetchWithTimeout(resolveMiniMaxEndpoint(config), {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}`, ...getSilentHeaders() }, body: JSON.stringify(body)
        }, 'MiniMax TTS');
        return responseToMiniMaxAudioUrl(response);
    }

    async function synthesizeOpenAi(config, text, voiceSettings) {
        const response = await fetchWithTimeout(resolveOperationEndpoint(config.endpoint, 'audio/speech'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}`, ...getSilentHeaders() },
            body: JSON.stringify({ model: required(config, 'model', 'TTS 模型'), input: text, voice: getVoiceId(config, voiceSettings), speed: voiceSettings.speed, response_format: 'mp3' })
        }, `${getProviderName(config.provider)} TTS`);
        return responseToAudioUrl(response);
    }

    async function synthesizeElevenLabs(config, text, voiceSettings) {
        const parsed = getHttpEndpoint(config.endpoint);
        let pathname = String(parsed.pathname || '/').replace(/\/+$/, '').replace(/\/text-to-speech\/[^/]+$/i, '');
        if (!/\/v1$/i.test(pathname)) pathname = `${pathname || ''}/v1`;
        parsed.pathname = `${pathname}/text-to-speech/${encodeURIComponent(getVoiceId(config, voiceSettings))}`.replace(/\/+/g, '/');
        parsed.searchParams.set('output_format', 'mp3_44100_128');
        const response = await fetchWithTimeout(parsed.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'xi-api-key': config.apiKey, ...getSilentHeaders() },
            body: JSON.stringify({ text, model_id: required(config, 'model', 'TTS 模型'), voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
        }, 'ElevenLabs TTS');
        return responseToAudioUrl(response);
    }

    async function synthesizeAzure(config, text, voiceSettings) {
        const voiceId = getVoiceId(config, voiceSettings);
        const response = await fetchWithTimeout(resolveAzureEndpoint(config, 'v1'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
                'Ocp-Apim-Subscription-Key': config.apiKey, 'User-Agent': 'u2phone', ...getSilentHeaders()
            },
            body: `<speak version="1.0" xml:lang="${escapeXml(voiceSettings.language || 'zh-CN')}"><voice name="${escapeXml(voiceId)}"><prosody rate="${Math.round((voiceSettings.speed - 1) * 100)}%">${escapeXml(text)}</prosody></voice></speak>`
        }, 'Azure Speech');
        return responseToAudioUrl(response);
    }

    async function synthesizeGoogle(config, text, voiceSettings) {
        const response = await fetchWithTimeout(resolveGoogleEndpoint(config, 'text:synthesize'), {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...getSilentHeaders() },
            body: JSON.stringify({
                input: { text }, voice: { name: getVoiceId(config, voiceSettings), languageCode: voiceSettings.language || undefined },
                audioConfig: { audioEncoding: 'MP3', speakingRate: voiceSettings.speed }
            })
        }, 'Google Cloud TTS');
        return responseToAudioUrl(response);
    }

    function toHex(buffer) {
        return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    async function sha256Hex(value) {
        return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    }

    async function hmac(key, value, algorithm = 'SHA-256') {
        const cryptoKey = await crypto.subtle.importKey('raw', key instanceof Uint8Array ? key : new TextEncoder().encode(key), { name: 'HMAC', hash: algorithm }, false, ['sign']);
        return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value)));
    }

    function awsDate(date = new Date()) {
        const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
        return { short: iso.slice(0, 8), long: iso.slice(0, 15) + 'Z' };
    }

    async function signAwsRequest(config, method, url, payload) {
        if (!window.crypto?.subtle) throw new Error('当前浏览器不支持 AWS Polly 所需的请求签名');
        const parsed = new URL(url);
        const date = awsDate();
        const payloadHash = await sha256Hex(payload);
        const headers = {
            'content-type': 'application/x-amz-json-1.0',
            host: parsed.host,
            'x-amz-date': date.long
        };
        if (cleanString(config.sessionToken)) headers['x-amz-security-token'] = config.sessionToken;
        const signedNames = Object.keys(headers).sort();
        const canonicalHeaders = signedNames.map((name) => `${name}:${headers[name]}\n`).join('');
        const canonicalRequest = `${method}\n${parsed.pathname}\n${parsed.search.slice(1)}\n${canonicalHeaders}\n${signedNames.join(';')}\n${payloadHash}`;
        const credentialScope = `${date.short}/${config.region}/polly/aws4_request`;
        const stringToSign = `AWS4-HMAC-SHA256\n${date.long}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;
        const dateKey = await hmac(`AWS4${config.secretKey}`, date.short);
        const regionKey = await hmac(dateKey, config.region);
        const serviceKey = await hmac(regionKey, 'polly');
        const signingKey = await hmac(serviceKey, 'aws4_request');
        const signature = toHex(await hmac(signingKey, stringToSign));
        return {
            ...headers,
            Authorization: `AWS4-HMAC-SHA256 Credential=${config.apiKey}/${credentialScope}, SignedHeaders=${signedNames.join(';')}, Signature=${signature}`
        };
    }

    async function synthesizeAwsPolly(config, text, voiceSettings) {
        const endpoint = cleanString(config.endpoint) || `https://polly.${config.region}.amazonaws.com`;
        const parsed = getHttpEndpoint(endpoint);
        parsed.pathname = '/v1/speech';
        parsed.search = '';
        const body = JSON.stringify({ OutputFormat: 'mp3', Text: text, VoiceId: getVoiceId(config, voiceSettings), SampleRate: '24000' });
        const headers = await signAwsRequest(config, 'POST', parsed.toString(), body);
        const response = await fetchWithTimeout(parsed.toString(), { method: 'POST', headers: { ...headers, ...getSilentHeaders() }, body }, 'AWS Polly');
        return responseToAudioUrl(response);
    }

    async function synthesizeVolcengine(config, text, voiceSettings) {
        const body = {
            app: { appid: config.appId, token: config.apiKey, cluster: config.resourceId || config.model },
            user: { uid: `u2-${Date.now()}` },
            audio: { voice_type: getVoiceId(config, voiceSettings), encoding: 'mp3', speed_ratio: voiceSettings.speed },
            request: { reqid: `u2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, operation: 'query' }
        };
        const response = await fetchWithTimeout(config.endpoint, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer;${config.apiKey}`, ...getSilentHeaders() }, body: JSON.stringify(body)
        }, '火山引擎 TTS');
        return responseToAudioUrl(response);
    }

    async function synthesizeDashScope(config, text, voiceSettings) {
        const response = await fetchWithTimeout(config.endpoint, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}`, ...getSilentHeaders() },
            body: JSON.stringify({ model: required(config, 'model', 'TTS 模型'), input: { text }, parameters: { voice: getVoiceId(config, voiceSettings), format: 'mp3', sample_rate: 44100 } })
        }, 'DashScope TTS');
        return responseToAudioUrl(response);
    }

    function waitForWebSocket(url, onOpen, onMessage, label) {
        if (typeof WebSocket !== 'function') return Promise.reject(new Error('当前环境不支持 WebSocket TTS'));
        return new Promise((resolve, reject) => {
            let settled = false;
            const socket = new WebSocket(url);
            const timeoutId = setTimeout(() => finish(new Error(`${label}连接超时`)), REQUEST_TIMEOUT_MS);
            const finish = (error, value) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                try { socket.close(); } catch (_) { /* ignored */ }
                if (error) reject(error); else resolve(value);
            };
            socket.onerror = () => finish(new Error(`${label}连接失败，请检查地址、凭据或浏览器跨域限制`));
            socket.onopen = () => {
                try { onOpen(socket); } catch (error) { finish(error); }
            };
            socket.onmessage = (event) => {
                try { onMessage(event, finish); } catch (error) { finish(error); }
            };
        });
    }

    async function synthesizeTencent(config, text, voiceSettings) {
        if (!window.crypto?.subtle) throw new Error('当前浏览器不支持腾讯云 TTS 所需的请求签名');
        const parsed = getBaseEndpoint(config.endpoint);
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = Math.floor(Math.random() * 1000000000);
        const params = {
            Action: 'TextToVoice', AppId: config.appId, Expired: timestamp + 3600, Nonce: nonce,
            SecretId: config.apiKey, Timestamp: timestamp, VoiceType: getVoiceId(config, voiceSettings)
        };
        Object.entries(params).forEach(([key, value]) => parsed.searchParams.set(key, String(value)));
        const sorted = Array.from(parsed.searchParams.entries()).sort(([left], [right]) => left.localeCompare(right));
        const source = `GET${parsed.host}${parsed.pathname}?${sorted.map(([key, value]) => `${key}=${value}`).join('&')}`;
        const signatureBytes = await hmac(config.secretKey, source, 'SHA-1');
        let binary = '';
        signatureBytes.forEach((byte) => { binary += String.fromCharCode(byte); });
        parsed.searchParams.set('Signature', btoa(binary));
        const chunks = [];
        return waitForWebSocket(parsed.toString(), (socket) => {
            socket.send(JSON.stringify({ Action: 'TextToVoice', Text: text, SessionId: `u2-${Date.now()}`, ModelType: 1, Codec: 'mp3', SampleRate: 16000, Speed: Math.round((voiceSettings.speed - 1) * 10) }));
        }, (event, finish) => {
            const data = JSON.parse(String(event.data || '{}'));
            if (Number(data.code) !== 0 && data.code != null) return finish(new Error(data.message || '腾讯云 TTS 合成失败'));
            const audio = data.data || data.Audio || data.audio;
            if (audio) chunks.push(String(audio));
            if (data.final === 1 || data.Final === 1 || data.status === 2) {
                const url = base64ToBlobUrl(chunks.join(''));
                finish(url ? null : new Error('腾讯云 TTS 未返回音频'), url);
            }
        }, '腾讯云 TTS');
    }

    async function synthesizeBaidu(config, text, voiceSettings) {
        const tokenBody = new URLSearchParams({ grant_type: 'client_credentials', client_id: config.apiKey, client_secret: config.secretKey });
        const tokenResponse = await fetchWithTimeout('https://aip.baidubce.com/oauth/2.0/token', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...getSilentHeaders() }, body: tokenBody.toString()
        }, '百度智能云鉴权');
        const tokenData = await tokenResponse.json();
        const token = cleanString(tokenData?.access_token);
        if (!token) throw new Error('百度智能云未返回 Access Token');
        const parsed = getHttpEndpoint(config.endpoint);
        parsed.searchParams.set('tex', text);
        parsed.searchParams.set('tok', token);
        parsed.searchParams.set('cuid', 'u2phone');
        parsed.searchParams.set('ctp', '1');
        parsed.searchParams.set('lan', String(voiceSettings.language || 'zh').split('-')[0]);
        parsed.searchParams.set('per', getVoiceId(config, voiceSettings));
        parsed.searchParams.set('spd', String(Math.round(5 + (voiceSettings.speed - 1) * 5)));
        const response = await fetchWithTimeout(parsed.toString(), { headers: getSilentHeaders() }, '百度智能云 TTS');
        return responseToAudioUrl(response);
    }

    async function synthesizeXfyun(config, text, voiceSettings) {
        if (!window.crypto?.subtle) throw new Error('当前浏览器不支持讯飞 TTS 所需的请求签名');
        const parsed = getBaseEndpoint(config.endpoint);
        const date = new Date().toUTCString();
        const signatureOrigin = `host: ${parsed.host}\ndate: ${date}\nGET ${parsed.pathname} HTTP/1.1`;
        const signatureBytes = await hmac(config.apiSecret, signatureOrigin);
        let signatureBinary = '';
        signatureBytes.forEach((byte) => { signatureBinary += String.fromCharCode(byte); });
        const authorization = btoa(`api_key="${config.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${btoa(signatureBinary)}"`);
        parsed.searchParams.set('authorization', authorization);
        parsed.searchParams.set('date', date);
        parsed.searchParams.set('host', parsed.host);
        const chunks = [];
        return waitForWebSocket(parsed.toString(), (socket) => {
            socket.send(JSON.stringify({
                common: { app_id: config.appId },
                business: { aue: 'lame', auf: 'audio/L16;rate=16000', vcn: getVoiceId(config, voiceSettings), speed: Math.round((voiceSettings.speed - 1) * 50) },
                data: { status: 2, text: utf8ToBase64(text) }
            }));
        }, (event, finish) => {
            const data = JSON.parse(String(event.data || '{}'));
            if (Number(data.code) !== 0 && data.code != null) return finish(new Error(data.message || '讯飞 TTS 合成失败'));
            if (data.data?.audio) chunks.push(data.data.audio);
            if (Number(data.data?.status) === 2) {
                const url = base64ToBlobUrl(chunks.join(''));
                finish(url ? null : new Error('讯飞 TTS 未返回音频'), url);
            }
        }, '讯飞 TTS');
    }

    async function synthesize(config, text, voiceSettings) {
        if (config.provider === 'minimax') return synthesizeMiniMax(config, text, voiceSettings);
        if (config.provider === 'openai' || config.provider === 'openai-compatible') return synthesizeOpenAi(config, text, voiceSettings);
        if (config.provider === 'elevenlabs') return synthesizeElevenLabs(config, text, voiceSettings);
        if (config.provider === 'azure') return synthesizeAzure(config, text, voiceSettings);
        if (config.provider === 'google') return synthesizeGoogle(config, text, voiceSettings);
        if (config.provider === 'aws-polly') return synthesizeAwsPolly(config, text, voiceSettings);
        if (config.provider === 'volcengine') return synthesizeVolcengine(config, text, voiceSettings);
        if (config.provider === 'dashscope') return synthesizeDashScope(config, text, voiceSettings);
        if (config.provider === 'tencent') return synthesizeTencent(config, text, voiceSettings);
        if (config.provider === 'baidu') return synthesizeBaidu(config, text, voiceSettings);
        if (config.provider === 'xfyun') return synthesizeXfyun(config, text, voiceSettings);
        throw new Error('不支持的 TTS 服务商');
    }

    function getCacheKey(config, voiceSettings) {
        return [config.provider, config.endpoint, config.model, config.region, config.resourceId, voiceSettings.voiceId, voiceSettings.speed].map((item) => cleanString(item)).join('|');
    }

    async function speakText(text, friend = null, options = {}) {
        const cleanText = cleanString(text, 12000);
        if (!cleanText) {
            if (window.showToast) window.showToast('没有可播放的文本');
            return null;
        }
        const voiceSettings = resolveFriendTtsSettings(friend);
        if (!voiceSettings.enabled && !options.ignoreFriendToggle) {
            if (window.showToast) window.showToast('请先在 Chat Settings Info 开启 TTS');
            return null;
        }
        const config = validateActiveConfig(options.config || getActiveConfig());
        if (config.provider === 'minimax' && cleanText.length > MAX_MINIMAX_TTS_TEXT_LENGTH) {
            throw new Error(`MiniMax TTS 单次文本不能超过 ${MAX_MINIMAX_TTS_TEXT_LENGTH.toLocaleString()} 个字符`);
        }
        if (window.showToast) window.showToast('语音生成中...');
        const audioUrl = await synthesize(config, cleanText, { ...voiceSettings, voiceId: options.voiceId || voiceSettings.voiceId });
        await playAudioUrl(audioUrl);
        return audioUrl;
    }

    async function speakTextCached(text, friend = null, cacheOwner = null, options = {}) {
        const voiceSettings = resolveFriendTtsSettings(friend);
        if (!voiceSettings.enabled && !options.ignoreFriendToggle) {
            return speakText(text, friend, options);
        }
        const config = validateActiveConfig(options.config || getActiveConfig());
        const cacheKey = getCacheKey(config, { ...voiceSettings, voiceId: options.voiceId || voiceSettings.voiceId });
        if (cacheOwner?.ttsAudioCache?.key === cacheKey && cacheOwner.ttsAudioCache.url) {
            await playAudioUrl(cacheOwner.ttsAudioCache.url);
            return cacheOwner.ttsAudioCache.url;
        }
        if (cacheOwner?.ttsAudioPromise) {
            const cached = await cacheOwner.ttsAudioPromise;
            if (cached) await playAudioUrl(cached);
            return cached;
        }
        const request = speakText(text, friend, { ...options, config });
        if (cacheOwner) cacheOwner.ttsAudioPromise = request;
        try {
            const audioUrl = await request;
            if (cacheOwner && audioUrl) cacheOwner.ttsAudioCache = { key: cacheKey, url: audioUrl };
            return audioUrl;
        } finally {
            if (cacheOwner) delete cacheOwner.ttsAudioPromise;
        }
    }

    function getModelRows(data) {
        return Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : (Array.isArray(data?.models) ? data.models : []));
    }

    function getModelId(item) {
        return typeof item === 'string' ? item : (item?.id || item?.model_id || item?.name || item?.model || '');
    }

    function isTtsModelRow(item) {
        const modelId = cleanString(getModelId(item), 256).toLowerCase();
        const capabilities = item && typeof item === 'object' ? item.capabilities : null;
        const hasDeclaredTtsCapability = item && typeof item === 'object' && (
            item.can_do_text_to_speech === true
            || item.supports_tts === true
            || item.supportsTextToSpeech === true
            || capabilities?.tts === true
            || capabilities?.text_to_speech === true
            || capabilities?.['text-to-speech'] === true
            || capabilities?.audio?.text_to_speech === true
        );
        return hasDeclaredTtsCapability
            || /(^|[-_])(?:tts|text[-_]?to[-_]?speech)(?:[-_]|$)/i.test(modelId);
    }

    function extractTtsModelRows(data) {
        return getModelRows(data).filter(isTtsModelRow).map(getModelId)
            .map((item) => cleanString(item, 256)).filter(Boolean);
    }

    async function fetchOpenAiModels(config) {
        const response = await fetchWithTimeout(resolveOperationEndpoint(config.endpoint, 'models'), { headers: { Authorization: `Bearer ${config.apiKey}`, ...getSilentHeaders() } }, `${getProviderName(config.provider)} 模型列表`);
        return extractTtsModelRows(await response.json());
    }

    async function fetchElevenLabsModels(config) {
        const parsed = getHttpEndpoint(config.endpoint);
        let pathname = String(parsed.pathname || '/').replace(/\/+$/, '').replace(/\/models$/i, '');
        if (!/\/v1$/i.test(pathname)) pathname = `${pathname || ''}/v1`;
        parsed.pathname = `${pathname}/models`.replace(/\/+/g, '/');
        const response = await fetchWithTimeout(parsed.toString(), { headers: { 'xi-api-key': config.apiKey, ...getSilentHeaders() } }, 'ElevenLabs 模型列表');
        const data = await response.json();
        return (Array.isArray(data) ? data : []).filter((item) => item?.can_do_text_to_speech !== false)
            .map((item) => cleanString(item?.model_id || item?.id, 256)).filter(Boolean);
    }

    async function fetchAzureVoices(config) {
        const response = await fetchWithTimeout(resolveAzureEndpoint(config, 'voices/list'), { headers: { 'Ocp-Apim-Subscription-Key': config.apiKey, ...getSilentHeaders() } }, 'Azure Speech 音色列表');
        const data = await response.json();
        return (Array.isArray(data) ? data : []).map((item) => cleanString(item?.ShortName || item?.Name, 256)).filter(Boolean);
    }

    async function fetchGoogleVoices(config) {
        const response = await fetchWithTimeout(resolveGoogleEndpoint(config, 'voices'), { headers: getSilentHeaders() }, 'Google Cloud TTS 音色列表');
        const data = await response.json();
        return (Array.isArray(data?.voices) ? data.voices : []).map((item) => cleanString(item?.name, 256)).filter(Boolean);
    }

    async function fetchAwsVoices(config) {
        const endpoint = cleanString(config.endpoint) || `https://polly.${config.region}.amazonaws.com`;
        const parsed = getHttpEndpoint(endpoint);
        parsed.pathname = '/v1/voices';
        parsed.search = '';
        const headers = await signAwsRequest(config, 'GET', parsed.toString(), '');
        const response = await fetchWithTimeout(parsed.toString(), { headers: { ...headers, ...getSilentHeaders() } }, 'AWS Polly 音色列表');
        const data = await response.json();
        return (Array.isArray(data?.Voices) ? data.Voices : []).map((item) => cleanString(item?.Id, 256)).filter(Boolean);
    }

    async function fetchModels(input = getActiveConfig()) {
        const config = validateActiveConfig({ ...input, provider: PROVIDER_IDS.includes(input?.provider) ? input.provider : getConfig().activeProvider }, { requireModel: false });
        let models;
        if (config.provider === 'openai' || config.provider === 'openai-compatible') models = await fetchOpenAiModels(config);
        else if (config.provider === 'elevenlabs') models = await fetchElevenLabsModels(config);
        else if (config.provider === 'azure') models = await fetchAzureVoices(config);
        else if (config.provider === 'google') models = await fetchGoogleVoices(config);
        else if (config.provider === 'aws-polly') models = await fetchAwsVoices(config);
        else if (['minimax', 'volcengine', 'dashscope'].includes(config.provider)) {
            throw new Error(`${getProviderName(config.provider)} 暂不支持可靠的 TTS 模型拉取，请手动填写 TTS 模型或音色 ID`);
        }
        else throw new Error(`${getProviderName(config.provider)} 未提供可在浏览器中拉取的模型列表；请手动填写模型或音色 ID`);
        const unique = normalizeModels(models).sort((left, right) => left.localeCompare(right));
        if (!unique.length) throw new Error('接口返回成功，但没有发现可用模型或音色');
        return unique;
    }

    window.ttsConfig = normalizeConfig(window.ttsConfig || safeLoad('u2_ttsConfig', null) || getLegacyConfig());
    window.getTtsConfig = getConfig;
    window.u2Tts = Object.freeze({
        PROVIDER_IDS, PROVIDERS, REQUEST_TIMEOUT_MS,
        normalizeConfig, getConfig, getActiveConfig, setConfig, getProviderDefinition, getProviderName,
        validateActiveConfig, resolveFriendTtsSettings, resolveMessageTtsFriend, canSpeakForFriend, canSpeakMessage, normalizeLanguage, getUserErrorMessage, fetchModels,
        speakText, speakTextCached, playAudioUrl
    });
})();
