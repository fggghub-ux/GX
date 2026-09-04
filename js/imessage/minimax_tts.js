// ==========================================
// IMESSAGE: Minimax TTS
// ==========================================
(function () {
    const DEFAULT_CONFIG = {
        region: 'cn',
        customEndpointEnabled: false,
        endpoint: '',
        apiKey: '',
        groupId: '',
        ttsModel: 'speech-02-hd'
    };

    const REGION_ENDPOINTS = {
        cn: 'https://api.minimax.chat',
        intl: 'https://api.minimax.io'
    };

    // MiniMax expects the documented language_boost enum, not the short codes
    // saved by the chat-language selector. Keep the full list here so a custom
    // language such as "German" can be passed through safely as well.
    const LANGUAGE_BOOST_VALUES = [
        'Chinese', 'Chinese,Yue', 'English', 'Arabic', 'Russian', 'Spanish',
        'French', 'Portuguese', 'German', 'Turkish', 'Dutch', 'Ukrainian',
        'Vietnamese', 'Indonesian', 'Japanese', 'Italian', 'Korean', 'Thai',
        'Polish', 'Romanian', 'Greek', 'Czech', 'Finnish', 'Hindi', 'Bulgarian',
        'Danish', 'Hebrew', 'Malay', 'Persian', 'Slovak', 'Swedish', 'Croatian',
        'Filipino', 'Hungarian', 'Norwegian', 'Slovenian', 'Catalan', 'Nynorsk',
        'Tamil', 'Afrikaans', 'auto'
    ];

    function normalizeLanguageKey(value) {
        return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    const LANGUAGE_BOOST_ALIASES = new Map(
        LANGUAGE_BOOST_VALUES.map(value => [normalizeLanguageKey(value), value])
    );
    [
        ['zh', 'Chinese'], ['cn', 'Chinese'], ['zh-cn', 'Chinese'], ['中文', 'Chinese'], ['汉语', 'Chinese'], ['漢語', 'Chinese'], ['普通话', 'Chinese'], ['普通話', 'Chinese'],
        ['yue', 'Chinese,Yue'], ['cantonese', 'Chinese,Yue'], ['chinese yue', 'Chinese,Yue'], ['粤语', 'Chinese,Yue'], ['粵語', 'Chinese,Yue'], ['广东话', 'Chinese,Yue'], ['廣東話', 'Chinese,Yue'], ['繁体中文夹粤语', 'Chinese,Yue'], ['繁體中文夾粵語', 'Chinese,Yue'], ['traditional chinese with cantonese', 'Chinese,Yue'],
        ['en', 'English'], ['英语', 'English'], ['英語', 'English'],
        ['ar', 'Arabic'], ['阿拉伯语', 'Arabic'], ['阿拉伯語', 'Arabic'],
        ['ru', 'Russian'], ['俄语', 'Russian'], ['俄語', 'Russian'],
        ['es', 'Spanish'], ['西班牙语', 'Spanish'], ['西班牙語', 'Spanish'],
        ['fr', 'French'], ['法语', 'French'], ['法語', 'French'],
        ['pt', 'Portuguese'], ['葡萄牙语', 'Portuguese'], ['葡萄牙語', 'Portuguese'],
        ['de', 'German'], ['德语', 'German'], ['德語', 'German'],
        ['tr', 'Turkish'], ['土耳其语', 'Turkish'], ['土耳其語', 'Turkish'],
        ['nl', 'Dutch'], ['荷兰语', 'Dutch'], ['荷蘭語', 'Dutch'],
        ['uk', 'Ukrainian'], ['乌克兰语', 'Ukrainian'], ['烏克蘭語', 'Ukrainian'],
        ['vi', 'Vietnamese'], ['越南语', 'Vietnamese'], ['越南語', 'Vietnamese'],
        ['id', 'Indonesian'], ['印度尼西亚语', 'Indonesian'], ['印度尼西亞語', 'Indonesian'],
        ['ja', 'Japanese'], ['jp', 'Japanese'], ['日语', 'Japanese'], ['日語', 'Japanese'],
        ['it', 'Italian'], ['意大利语', 'Italian'], ['義大利語', 'Italian'],
        ['ko', 'Korean'], ['kr', 'Korean'], ['韩语', 'Korean'], ['韓語', 'Korean'],
        ['th', 'Thai'], ['泰语', 'Thai'], ['泰語', 'Thai'],
        ['pl', 'Polish'], ['波兰语', 'Polish'], ['波蘭語', 'Polish'],
        ['ro', 'Romanian'], ['罗马尼亚语', 'Romanian'], ['羅馬尼亞語', 'Romanian'],
        ['el', 'Greek'], ['希腊语', 'Greek'], ['希臘語', 'Greek'],
        ['cs', 'Czech'], ['捷克语', 'Czech'], ['捷克語', 'Czech'],
        ['fi', 'Finnish'], ['芬兰语', 'Finnish'], ['芬蘭語', 'Finnish'],
        ['hi', 'Hindi'], ['印地语', 'Hindi'], ['印地語', 'Hindi'],
        ['da', 'Danish'], ['丹麦语', 'Danish'], ['丹麥語', 'Danish'],
        ['he', 'Hebrew'], ['希伯来语', 'Hebrew'], ['希伯來語', 'Hebrew'],
        ['ms', 'Malay'], ['马来语', 'Malay'], ['馬來語', 'Malay'],
        ['sv', 'Swedish'], ['瑞典语', 'Swedish'], ['瑞典語', 'Swedish'],
        ['no', 'Norwegian'], ['挪威语', 'Norwegian'], ['挪威語', 'Norwegian'],
        ['ca', 'Catalan'], ['加泰罗尼亚语', 'Catalan'], ['加泰羅尼亞語', 'Catalan'],
        ['auto', 'auto'], ['自动', 'auto'], ['自動', 'auto']
    ].forEach(([alias, value]) => LANGUAGE_BOOST_ALIASES.set(normalizeLanguageKey(alias), value));

    let currentAudio = null;

    function cloneConfig(value) {
        return {
            ...DEFAULT_CONFIG,
            ...(value && typeof value === 'object' ? value : {})
        };
    }

    function safeLoad(key, fallback) {
        try {
            if (window.StorageManager && typeof window.StorageManager.load === 'function') {
                return window.StorageManager.load(key, fallback);
            }
            return fallback;
        } catch (error) {
            console.warn('[minimax_tts] Failed to load config:', error);
            return fallback;
        }
    }

    function safeSave(key, value) {
        try {
            if (window.StorageManager && typeof window.StorageManager.save === 'function') {
                window.StorageManager.save(key, value);
                return;
            }
        } catch (error) {
            console.warn('[minimax_tts] Failed to save config:', error);
        }
    }

    function getConfig() {
        window.minimaxConfig = cloneConfig(window.minimaxConfig || safeLoad('u2_minimaxConfig', DEFAULT_CONFIG));
        return window.minimaxConfig;
    }

    function setConfig(nextConfig) {
        window.minimaxConfig = cloneConfig(nextConfig);
        safeSave('u2_minimaxConfig', window.minimaxConfig);
        window.dispatchEvent(new CustomEvent('u2:minimax-config-updated', { detail: window.minimaxConfig }));
        return window.minimaxConfig;
    }

    function getBaseEndpoint(config = getConfig()) {
        const regionEndpoint = REGION_ENDPOINTS[config.region] || REGION_ENDPOINTS.cn;
        return String(config.customEndpointEnabled ? (config.endpoint || regionEndpoint) : regionEndpoint).replace(/\/+$/, '');
    }

    function getTtsUrl(config = getConfig()) {
        const groupId = String(config.groupId || '').trim();
        const query = groupId ? `?GroupId=${encodeURIComponent(groupId)}` : '';
        return `${getBaseEndpoint(config)}/v1/t2a_v2${query}`;
    }

    function isLikelyChinese(text) {
        return /[\u3400-\u9fff]/.test(String(text || ''));
    }

    function normalizeLanguage(language) {
        const normalized = normalizeLanguageKey(language);
        // Unknown custom values must not be sent as invalid enums. Let MiniMax
        // auto-detect instead, which also keeps truly custom language names usable.
        return LANGUAGE_BOOST_ALIASES.get(normalized) || 'auto';
    }

    function getMinimaxErrorMessage(payload) {
        if (typeof payload === 'string') return payload.trim();
        if (!payload || typeof payload !== 'object') return '';
        return String(
            payload?.base_resp?.status_msg
            || payload?.message
            || payload?.msg
            || payload?.error?.message
            || payload?.error
            || ''
        ).trim();
    }

    async function readMinimaxResponseError(response) {
        try {
            const payload = await response.json();
            return getMinimaxErrorMessage(payload);
        } catch (error) {
            try {
                return String(await response.text() || '').trim();
            } catch (readError) {
                return '';
            }
        }
    }

    function hexToBlobUrl(hex, mimeType = 'audio/mpeg') {
        const cleanHex = String(hex || '').replace(/^0x/i, '').replace(/\s+/g, '');
        if (!cleanHex || cleanHex.length % 2 !== 0) return '';
        const bytes = new Uint8Array(cleanHex.length / 2);
        for (let i = 0; i < cleanHex.length; i += 2) {
            bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
        }
        return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    }

    function base64ToBlobUrl(base64, mimeType = 'audio/mpeg') {
        const cleanBase64 = String(base64 || '').replace(/^data:audio\/[^;]+;base64,/, '').replace(/\s+/g, '');
        if (!cleanBase64) return '';
        const binary = atob(cleanBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    }

    function extractAudioUrl(data) {
        const candidates = [
            data?.data?.audio,
            data?.data?.audio_base64,
            data?.audio,
            data?.audio_base64,
            data?.data?.audio_file,
            data?.data?.url,
            data?.url
        ].filter(Boolean);

        const first = String(candidates[0] || '').trim();
        if (!first) return '';
        if (/^https?:\/\//i.test(first) || /^blob:/i.test(first) || /^data:audio\//i.test(first)) return first;
        if (/^[0-9a-fA-F]+$/.test(first) && first.length > 32) return hexToBlobUrl(first);
        return base64ToBlobUrl(first);
    }

    async function playAudioUrl(url) {
        if (!url) throw new Error('No audio url');
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        currentAudio = new Audio(url);
        await currentAudio.play();
        return currentAudio;
    }

    function resolveFriendVoiceSettings(friend) {
        const settings = friend?.minimaxVoice && typeof friend.minimaxVoice === 'object' ? friend.minimaxVoice : {};
        return {
            enabled: !!settings.enabled,
            voiceId: String(settings.voiceId || '').trim(),
            speed: Math.max(0.5, Math.min(2, parseFloat(settings.speed) || 1)),
            language: friend?.language || 'zh'
        };
    }

    async function speakText(text, friend = null, options = {}) {
        const cleanText = String(text || '').trim();
        if (!cleanText) {
            if (window.showToast) window.showToast('没有可播放的文本');
            return null;
        }

        const config = getConfig();
        const voiceSettings = resolveFriendVoiceSettings(friend);
        if (!voiceSettings.enabled && !options.ignoreFriendToggle) {
            if (window.showToast) window.showToast('请先在 Chat Settings Info 开启 Minimax 语音');
            return null;
        }
        if (!config.apiKey || !config.groupId) {
            if (window.showToast) window.showToast('请先配置 Minimax Key 和 Group ID');
            return null;
        }

        const voiceId = voiceSettings.voiceId || options.voiceId || 'male-qn-qingse';
        const language = normalizeLanguage(voiceSettings.language);
        const body = {
            model: config.ttsModel || DEFAULT_CONFIG.ttsModel,
            text: cleanText,
            stream: false,
            output_format: 'hex',
            voice_setting: {
                voice_id: voiceId,
                speed: voiceSettings.speed,
                vol: 1,
                pitch: 0
            },
            audio_setting: {
                sample_rate: 32000,
                bitrate: 128000,
                format: 'mp3',
                channel: 1
            }
        };

        if (language && (language !== 'Chinese' || isLikelyChinese(cleanText))) {
            body.language_boost = language;
        }

        if (window.showToast) window.showToast('语音生成中...');
        const response = await fetch(getTtsUrl(config), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.apiKey}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const details = await readMinimaxResponseError(response);
            throw new Error(`${response.status} ${details || response.statusText}`.trim());
        }
        const data = await response.json();
        const apiError = getMinimaxErrorMessage(data);
        if (Number(data?.base_resp?.status_code) !== 0 && apiError) {
            throw new Error(apiError);
        }
        const audioUrl = extractAudioUrl(data);
        if (!audioUrl) throw new Error('Minimax 未返回音频');
        await playAudioUrl(audioUrl);
        return audioUrl;
    }

    async function speakTextCached(text, friend = null, cacheOwner = null, options = {}) {
        if (cacheOwner && cacheOwner.minimaxAudioUrl) {
            await playAudioUrl(cacheOwner.minimaxAudioUrl);
            return cacheOwner.minimaxAudioUrl;
        }

        if (cacheOwner && cacheOwner.minimaxAudioPromise) {
            const cachedUrl = await cacheOwner.minimaxAudioPromise;
            if (cachedUrl) await playAudioUrl(cachedUrl);
            return cachedUrl;
        }

        const requestPromise = speakText(text, friend, options);
        if (cacheOwner) cacheOwner.minimaxAudioPromise = requestPromise;

        try {
            const audioUrl = await requestPromise;
            if (cacheOwner && audioUrl) cacheOwner.minimaxAudioUrl = audioUrl;
            return audioUrl;
        } finally {
            if (cacheOwner) delete cacheOwner.minimaxAudioPromise;
        }
    }

    window.minimaxConfig = cloneConfig(window.minimaxConfig || safeLoad('u2_minimaxConfig', DEFAULT_CONFIG));
    window.u2MinimaxTts = {
        DEFAULT_CONFIG,
        REGION_ENDPOINTS,
        getConfig,
        setConfig,
        getBaseEndpoint,
        getTtsUrl,
        normalizeLanguage,
        speakText,
        speakTextCached,
        playAudioUrl,
        resolveFriendVoiceSettings
    };
})();
