(function initImessageDataUtils(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.imDataUtils = api;
    else if (root) root.imDataUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : null, function createImessageDataUtils() {
    function pad2(value) {
        return String(value).padStart(2, '0');
    }

    function normalizeRoundLimit(value, fallback = 30) {
        const numeric = Number(value);
        return Number.isFinite(numeric) && numeric > 0
            ? Math.min(999, Math.max(1, Math.round(numeric)))
            : fallback;
    }

    function normalizeMessageLimit(value, fallback = 30) {
        return normalizeRoundLimit(value, fallback);
    }

    function normalizeChatMessageRange(minValue, maxValue, fallbackMin = 2, fallbackMax = 8) {
        const clamp = (value, fallback) => {
            const numeric = Number(value);
            return Number.isFinite(numeric)
                ? Math.min(20, Math.max(1, Math.round(numeric)))
                : fallback;
        };
        const min = clamp(minValue, clamp(fallbackMin, 2));
        const max = Math.max(min, clamp(maxValue, clamp(fallbackMax, 8)));
        return { min, max };
    }

    function findMessageByReference(messages, messageId, messageTimestamp) {
        const source = Array.isArray(messages) ? messages : [];
        const id = String(messageId || '').trim();
        const timestamp = String(messageTimestamp || '').trim();
        if (id) {
            const byId = source.find(message => message && String(message.id || '') === id);
            if (byId) return byId;
        }
        return timestamp
            ? source.find(message => message && String(message.timestamp || '') === timestamp) || null
            : null;
    }

    function normalizeChatLanguage(value) {
        const originalLanguage = String(value || '').trim();
        const language = originalLanguage.toLowerCase();
        if (!language || ['zh', 'cn', 'zh-cn'].includes(language)) return 'zh';
        if (['ko', 'kr'].includes(language)) return 'ko';
        if (['ja', 'jp'].includes(language)) return 'ja';
        if (language === 'en') return 'en';
        if (language === 'fr') return 'fr';
        if (['yue', 'cantonese', '粤语', '廣東話'].includes(language)) return 'yue';
        if (['ru', 'russian', '俄语', '俄語'].includes(language)) return 'ru';
        return originalLanguage || 'zh';
    }

    function getChatLanguageName(value) {
        const language = normalizeChatLanguage(value);
        return {
            zh: 'Chinese',
            ko: 'Korean',
            ja: 'Japanese',
            en: 'English',
            fr: 'French',
            yue: 'Cantonese',
            ru: 'Russian'
        }[language] || language || 'Chinese';
    }

    function normalizeLocalizedContent(value, language, options = {}) {
        const normalizedLanguage = normalizeChatLanguage(language);
        const source = value && typeof value === 'object'
            ? value
            : { text: value };
        const text = String(source.text ?? source.content ?? '').trim();
        let translation = String(source.translation ?? source.translationZh ?? source.trans ?? '').trim();
        if (!text) return null;
        if (normalizedLanguage === 'zh') translation = '';
        if (normalizedLanguage !== 'zh' && options.requireTranslation !== false && !translation) return null;
        return { text, translation, language: normalizedLanguage };
    }

    function hasLocalizedTranslation(value) {
        return !!String(value?.translation ?? value?.translationZh ?? value?.trans ?? '').trim();
    }

    function buildLocalizedJsonContract(language, subject = 'content') {
        const normalizedLanguage = normalizeChatLanguage(language);
        const languageName = getChatLanguageName(normalizedLanguage);
        if (normalizedLanguage === 'zh') {
            return `${subject}.text must be natural Simplified Chinese and ${subject}.translation must be an empty string.`;
        }
        return `${subject}.text must be written only in ${languageName}; ${subject}.translation is mandatory and must be a natural accurate Simplified Chinese translation of that text.`;
    }

    function parseBilingualDialogue(value, language) {
        const text = String(value || '').trim();
        if (!text) return { original: '', translation: '' };
        if (normalizeChatLanguage(language) === 'zh') {
            return { original: text, translation: '' };
        }

        const match = text.match(/^([\s\S]+)（([^（）]*[\u3400-\u9fff][^（）]*)）$/);
        if (!match) return { original: text, translation: '' };
        const original = String(match[1] || '').trim();
        const translation = String(match[2] || '').trim();
        if (!original || !translation) return { original: text, translation: '' };
        return { original, translation };
    }

    function normalizeGroupChatContexts(contexts, fallbackMessageLimit = 30) {
        const seenGroupIds = new Set();
        return (Array.isArray(contexts) ? contexts : [])
            .map((context) => {
                if (!context || typeof context !== 'object') return null;
                const groupId = String(context.groupId ?? '').trim();
                if (!groupId || seenGroupIds.has(groupId)) return null;
                seenGroupIds.add(groupId);
                return {
                    groupId,
                    messageLimit: normalizeMessageLimit(context.messageLimit, fallbackMessageLimit)
                };
            })
            .filter(Boolean);
    }

    function getRecentPublicGroupMessages(messages, messageLimit = 30) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        const limit = normalizeMessageLimit(messageLimit, 30);
        const publicMessages = safeMessages.filter((message) => (
            message?.noticeKind !== 'group_private_to_user'
            && message?.noticeKind !== 'group_friend_private_chat'
        ));
        const selectedMessages = publicMessages.slice(-limit);

        return {
            messageLimit: limit,
            availableMessageCount: publicMessages.length,
            selectedMessageCount: selectedMessages.length,
            selectedMessages
        };
    }

    function getRecentUserRounds(messages, roundLimit = 5) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        const limit = normalizeRoundLimit(roundLimit, 5);
        const userMessageIndexes = [];

        safeMessages.forEach((message, index) => {
            if (message?.role === 'user') userMessageIndexes.push(index);
        });

        const selectedRounds = Math.min(limit, userMessageIndexes.length);
        const startIndex = selectedRounds > 0
            ? userMessageIndexes[userMessageIndexes.length - selectedRounds]
            : safeMessages.length;
        const selectedMessages = selectedRounds > 0 ? safeMessages.slice(startIndex) : [];

        return {
            roundLimit: limit,
            availableRounds: userMessageIndexes.length,
            selectedRounds,
            selectedMessageCount: selectedMessages.length,
            startIndex,
            selectedMessages
        };
    }

    function parseMessageTimestamp(value) {
        if (value === null || value === undefined || value === '') return null;
        const text = typeof value === 'string' ? value.trim() : value;
        let timestamp = typeof text === 'number'
            ? text
            : (/^\d+(?:\.\d+)?$/.test(text) ? Number(text) : NaN);
        if (Number.isFinite(timestamp) && timestamp > 0 && timestamp < 100000000000) {
            timestamp *= 1000;
        }
        const date = Number.isFinite(timestamp) ? new Date(timestamp) : new Date(text);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatMemoryEventTime(messages, fallbackTimestamp = Date.now()) {
        const dates = (Array.isArray(messages) ? messages : [])
            .map(message => parseMessageTimestamp(message?.timestamp))
            .filter(Boolean)
            .sort((left, right) => left.getTime() - right.getTime());
        const fallbackDate = parseMessageTimestamp(fallbackTimestamp) || new Date();
        const start = dates[0] || fallbackDate;
        const end = dates[dates.length - 1] || start;
        const formatDate = date => `${date.getFullYear()}年${pad2(date.getMonth() + 1)}月${pad2(date.getDate())}日`;
        const formatTime = date => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
        const startText = `${formatDate(start)} ${formatTime(start)}`;
        const endText = `${formatDate(end)} ${formatTime(end)}`;
        if (startText === endText) return startText;
        if (formatDate(start) === formatDate(end)) {
            return `${startText}至${formatTime(end)}`;
        }
        return `${startText}至${endText}`;
    }

    function normalizeLocalDateTime(value) {
        const text = String(value || '').trim();
        if (!text) return '';
        const match = text.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/);
        return match ? `${match[1]}T${match[2]}` : '';
    }

    function splitLocalDateTime(value) {
        const normalized = normalizeLocalDateTime(value);
        if (!normalized) return { date: '', time: '' };
        const [date, time] = normalized.split('T');
        return { date, time };
    }

    function formatLocalDateTime(value) {
        const normalized = normalizeLocalDateTime(value);
        if (!normalized) return '';
        const date = new Date(normalized);
        if (Number.isNaN(date.getTime())) return '';
        return `${date.getFullYear()}年${pad2(date.getMonth() + 1)}月${pad2(date.getDate())}日 ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    }

    function normalizeScheduleEvent(event, index = 0) {
        if (!event || typeof event !== 'object') return null;
        const source = { ...event };
        const name = String(source.name || source.title || '未命名行程').trim() || '未命名行程';
        const recurrence = String(source.recurrence || source.repeat || '').trim() === 'daily'
            ? 'daily'
            : 'once';
        const eventSource = String(source.source || '').trim() || 'manual';
        let rawTime = recurrence === 'daily' ? '' : normalizeLocalDateTime(source.rawTime || source.startAt);
        const rawParts = splitLocalDateTime(rawTime);
        let date = recurrence === 'daily' ? '' : String(source.date || rawParts.date || '').trim();
        let startTime = String(source.startTime || rawParts.time || '').trim().slice(0, 5);

        if (recurrence !== 'daily' && !rawTime && /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(startTime)) {
            rawTime = `${date}T${startTime}`;
        }
        if (recurrence !== 'daily' && (!date || !startTime)) {
            const derived = splitLocalDateTime(rawTime);
            date = date || derived.date;
            startTime = startTime || derived.time;
        }

        const sourceEndText = String(source.endAt || source.endTime || '').trim();
        let endAt = recurrence === 'daily' ? '' : normalizeLocalDateTime(sourceEndText);
        let endTime = /^\d{2}:\d{2}$/.test(sourceEndText)
            ? sourceEndText
            : splitLocalDateTime(endAt).time;
        if (recurrence !== 'daily' && !endAt && date && endTime) endAt = `${date}T${endTime}`;
        if (!endTime) endTime = startTime;

        const formattedStart = formatLocalDateTime(rawTime);
        const formattedEnd = formatLocalDateTime(endAt);
        const displayTime = recurrence === 'daily' && startTime
            ? `每天 ${startTime}${endTime && endTime !== startTime ? ` - ${endTime}` : ''}`
            : formattedStart
            ? (formattedEnd && formattedEnd !== formattedStart ? `${formattedStart} - ${formattedEnd}` : formattedStart)
            : String(source.time || startTime || '').trim();

        return {
            ...source,
            id: source.id != null ? source.id : `schedule-${Date.now()}-${index}`,
            name,
            title: String(source.title || name).trim() || name,
            date,
            startTime,
            endTime,
            time: displayTime,
            rawTime,
            endAt,
            location: String(source.location || source.description || '').trim(),
            source: eventSource,
            recurrence,
            timestamp: Number(source.timestamp) || Date.now()
        };
    }

    function normalizeSchedule(schedule) {
        const source = schedule && typeof schedule === 'object' ? schedule : {};
        const events = (Array.isArray(source.events) ? source.events : [])
            .map(normalizeScheduleEvent)
            .filter(Boolean)
            .sort((left, right) => {
                if (left.recurrence === 'daily' && right.recurrence !== 'daily') return -1;
                if (left.recurrence !== 'daily' && right.recurrence === 'daily') return 1;
                if (left.recurrence === 'daily' && right.recurrence === 'daily') {
                    return String(left.startTime || '').localeCompare(String(right.startTime || ''));
                }
                const leftTime = new Date(left.rawTime || 0).getTime() || Number(left.timestamp) || 0;
                const rightTime = new Date(right.rawTime || 0).getTime() || Number(right.timestamp) || 0;
                return leftTime - rightTime;
            });
        return {
            enabled: !!source.enabled,
            sleepTime: String(source.sleepTime || '23:00'),
            wakeTime: String(source.wakeTime || '07:00'),
            events
        };
    }

    function getSummaryBatch(messages, lastSummaryMessageCount = 0, roundLimit = 30) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        const startIndex = Math.min(safeMessages.length, Math.max(0, Number(lastSummaryMessageCount) || 0));
        const limit = normalizeRoundLimit(roundLimit);
        let availableRounds = 0;
        for (let index = startIndex; index < safeMessages.length; index += 1) {
            if (safeMessages[index]?.role === 'user') availableRounds += 1;
        }

        let selectedRounds = 0;
        let endIndex = startIndex;
        for (let index = startIndex; index < safeMessages.length; index += 1) {
            const message = safeMessages[index];
            if (message?.role === 'user') {
                if (selectedRounds >= limit) break;
                selectedRounds += 1;
            }
            endIndex = index + 1;
        }

        if (selectedRounds === 0) endIndex = startIndex;
        const selectedMessages = safeMessages.slice(startIndex, endIndex);
        return {
            startIndex,
            endIndex,
            roundLimit: limit,
            availableRounds,
            unsummarizedMessageCount: safeMessages.length - startIndex,
            selectedRounds,
            selectedMessageCount: selectedMessages.length,
            selectedMessages,
            ready: availableRounds >= limit
        };
    }

    function classifySummaryRequestFailure(input = {}) {
        const status = Math.max(0, Math.round(Number(input?.status) || 0));
        const kind = String(input?.kind || '').trim().toLowerCase();
        const detail = String(input?.message || input?.detail || '').toLowerCase();
        const withStatus = (message) => ({
            code,
            status,
            message: `${message}${status > 0 ? `（HTTP ${status}）` : ''}`
        });
        const isContextLimit = status === 413 || (
            status === 400 && /(?:context(?:[_\s-]?length)?|maximum context|too many tokens|token limit|prompt is too long|input is too long|request (?:body|entity|payload) too large|payload too large|上下文|令牌|请求体|载荷|内容过长|文本过长)/i.test(detail)
        );
        let code = 'unknown';

        if (kind === 'persistence') {
            code = 'persistence_failed';
            return withStatus('总结已生成，但保存到本地失败');
        }
        if (kind === 'settings_persistence') {
            code = 'settings_persistence_failed';
            return withStatus('摘要设置保存失败');
        }
        if (kind === 'response_format') {
            code = 'invalid_response';
            return withStatus('摘要接口返回格式不兼容');
        }
        if (kind === 'network') {
            code = 'network_failed';
            return withStatus('无法连接摘要 API，请检查网络或跨域设置');
        }
        if (isContextLimit) {
            code = 'context_limit';
            return withStatus('本批对话过长，请降低总结轮数后重试');
        }
        if (status === 401) {
            code = 'unauthorized';
            return withStatus('摘要 API 密钥无效或未授权');
        }
        if (status === 403) {
            code = 'forbidden';
            return withStatus('当前摘要接口或模型没有权限');
        }
        if (status === 404) {
            code = 'not_found';
            return withStatus('摘要 API 地址或模型不可用');
        }
        if (status === 408 || status === 504) {
            code = 'timeout';
            return withStatus('摘要请求超时，请稍后重试');
        }
        if (status === 429) {
            code = 'rate_limited';
            return withStatus('摘要请求过于频繁或额度不足');
        }
        if (status >= 500 && status <= 599) {
            code = 'server_error';
            return withStatus('摘要 API 服务暂时异常，请稍后重试');
        }
        if (status === 400) {
            code = 'bad_request';
            return withStatus('摘要请求参数无效，请检查摘要 API 配置');
        }
        if (status > 0) {
            code = 'http_error';
            return withStatus('摘要 API 请求失败');
        }
        return withStatus('摘要生成失败，请稍后重试');
    }

    function removeShortTermSummaryEntry(entries, entryId) {
        const safeEntries = Array.isArray(entries) ? entries : [];
        return safeEntries.filter(entry => !entry || String(entry.id) !== String(entryId));
    }

    function isSuccessfulOnlineAssistantReply(message) {
        if (!message || message.role !== 'assistant') return false;

        // Online handoff ends only after a real, visible Char response. Payment cards,
        // notices, calls, recalls, and other auxiliary artifacts must not consume it.
        const auxiliaryTypes = new Set([
            'system_notice',
            'pay_transfer',
            'group_red_packet',
            'html',
            'music_control',
            'recall',
            'call',
            'voice_call_record',
            'offline_meeting_record'
        ]);
        const messageType = String(message.type || '').trim().toLowerCase();
        if (auxiliaryTypes.has(messageType)) return false;

        const visibleContent = String(
            message.text
            || message.transcript
            || message.description
            || message.content
            || ''
        ).trim();
        return visibleContent.length > 0;
    }

    function resolvePendingOfflineHandoff(messages) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        const lastOfflineMeeting = safeMessages.reduce((latest, message) => {
            if (!message || message.type !== 'offline_meeting_record') return latest;
            const timestamp = Number(message.timestamp);
            if (!Number.isFinite(timestamp) || timestamp <= 0) return latest;
            return !latest || timestamp > Number(latest.timestamp) ? message : latest;
        }, null);
        if (!lastOfflineMeeting) return null;

        const meetingTimestamp = Number(lastOfflineMeeting.timestamp);
        const onlineMessagesAfterMeeting = safeMessages.filter(message => (
            message
            && (message.role === 'user' || message.role === 'assistant')
            && Number(message.timestamp) > meetingTimestamp
        ));
        const hasUserReturnedOnline = onlineMessagesAfterMeeting.some(message => message.role === 'user');
        const hasCharacterRepliedOnline = onlineMessagesAfterMeeting.some(isSuccessfulOnlineAssistantReply);

        return hasUserReturnedOnline && !hasCharacterRepliedOnline
            ? lastOfflineMeeting
            : null;
    }

    function normalizeOfflineMemoryTags(value, fallbackCandidates = []) {
        const tags = [];
        const pushTag = (candidate) => {
            String(candidate || '')
                .split(/[，,、；;\n|/。.!！?？]+/)
                .map(tag => tag.trim().replace(/^[\-•·\s]+|[。.!！?？\s]+$/g, ''))
                .filter(tag => tag.length >= 2 && tag.length <= 32)
                .forEach((tag) => {
                    const key = tag.toLocaleLowerCase();
                    if (!tags.some(existing => existing.toLocaleLowerCase() === key)) tags.push(tag);
                });
        };
        pushTag('线下见面');
        (Array.isArray(fallbackCandidates) ? fallbackCandidates : [fallbackCandidates]).forEach(pushTag);
        (Array.isArray(value) ? value : [value]).forEach(pushTag);
        return tags.slice(0, 6);
    }

    function parseLegacyOfflineMeetingSummary(rawText) {
        const raw = String(rawText || '').trim();
        if (!raw) return null;
        const lines = raw
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);
        let title = '';
        let summary = '';
        const titleIndex = lines.findIndex(line => /^标题[:：]/.test(line));
        const contentIndex = lines.findIndex(line => /^(?:见面内容|总结)[:：]/.test(line));
        if (titleIndex >= 0) title = lines[titleIndex].replace(/^标题[:：]\s*/, '').trim();
        if (contentIndex >= 0) {
            const firstLine = lines[contentIndex].replace(/^(?:见面内容|总结)[:：]\s*/, '').trim();
            summary = [firstLine, ...lines.slice(contentIndex + 1)].filter(Boolean).join('\n\n');
        } else {
            summary = lines.filter((_, index) => index !== titleIndex).join('\n\n').trim();
        }
        if (!summary) return null;
        return { title: title || '见面记录', summary };
    }

    function parseOfflineMeetingArtifacts(rawText, options = {}) {
        const raw = String(rawText || '').trim();
        if (!raw) return null;
        const cleanText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
        let parsed = null;
        try {
            parsed = JSON.parse(cleanText);
        } catch (_) {
            parsed = null;
        }

        const meetingPayload = parsed?.meetingSummary && typeof parsed.meetingSummary === 'object'
            ? parsed.meetingSummary
            : null;
        const legacyMeeting = meetingPayload ? null : parseLegacyOfflineMeetingSummary(cleanText);
        const title = String(meetingPayload?.title || legacyMeeting?.title || '').trim();
        const summary = String(meetingPayload?.summary || meetingPayload?.content || legacyMeeting?.summary || '').trim();
        if (!summary) return null;

        const memoryPayload = parsed?.shortTermMemory && typeof parsed.shortTermMemory === 'object'
            ? parsed.shortTermMemory
            : null;
        const hasModelMemory = !!String(memoryPayload?.event || '').trim();
        const fallbackCandidates = [
            title,
            options.charName,
            options.userName
        ];
        const memoryTitle = String(hasModelMemory ? (memoryPayload.title || title) : title).trim() || '线下见面';
        const memoryEvent = String(hasModelMemory ? memoryPayload.event : summary).trim() || summary;
        const memoryPoints = String(hasModelMemory ? (memoryPayload.memoryPoints || memoryEvent) : summary).trim();
        const memoryTags = normalizeOfflineMemoryTags(
            hasModelMemory ? memoryPayload.memoryTags : [],
            fallbackCandidates
        );

        return {
            meetingSummary: {
                title: title || '见面记录',
                summary
            },
            shortTermMemory: {
                title: memoryTitle,
                time: String(options.dateText || '').trim(),
                event: memoryEvent,
                memoryPoints,
                memoryTags,
                triggerKeywords: memoryTags.slice(),
                degree: '高',
                raw
            },
            activatedEntryIds: Array.isArray(parsed?.activatedEntryIds)
                ? Array.from(new Set(parsed.activatedEntryIds.map(String).filter(Boolean)))
                : [],
            usedMemoryFallback: !hasModelMemory
        };
    }

    function parseStickerManifestText(text) {
        const items = [];
        const invalidLines = [];
        String(text || '').split(/\r?\n/).forEach((line, index) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            const urlMatch = trimmed.match(/https?:\/\/\S+$/i);
            if (!urlMatch) {
                invalidLines.push(index + 1);
                return;
            }
            const rawName = trimmed.slice(0, urlMatch.index).trim();
            const name = rawName.replace(/[\s\p{P}|｜=＝+＋~～]+$/u, '').trim();
            if (!name) {
                invalidLines.push(index + 1);
                return;
            }
            try {
                const parsed = new URL(urlMatch[0]);
                if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported protocol');
                items.push({ name, url: parsed.href });
            } catch (_) {
                invalidLines.push(index + 1);
            }
        });
        return { items, invalidLines };
    }

    return {
        normalizeRoundLimit,
        normalizeMessageLimit,
        normalizeChatMessageRange,
        findMessageByReference,
        normalizeChatLanguage,
        getChatLanguageName,
        normalizeLocalizedContent,
        hasLocalizedTranslation,
        buildLocalizedJsonContract,
        parseBilingualDialogue,
        normalizeGroupChatContexts,
        getRecentPublicGroupMessages,
        getRecentUserRounds,
        formatMemoryEventTime,
        normalizeScheduleEvent,
        normalizeSchedule,
        getSummaryBatch,
        classifySummaryRequestFailure,
        removeShortTermSummaryEntry,
        isSuccessfulOnlineAssistantReply,
        resolvePendingOfflineHandoff,
        normalizeOfflineMemoryTags,
        parseOfflineMeetingArtifacts,
        parseStickerManifestText
    };
});
