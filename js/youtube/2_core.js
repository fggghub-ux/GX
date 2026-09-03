// 1. YouTube State, Data & Discovery Content
    let mockVideos = []; // Global video list
    let currentChatHistory = []; // Store chat history for summary
    
    // Initial empty mock subscription list
    let mockSubscriptions = []; 
    let hasSubscriptions = false;

    // Channel Data State
    let ytUserState = null; // Internal state for YouTube app
    let currentSummaryFilter = '全部';

    function sanitizeObj(obj) {
        if (typeof obj === 'string') {
            let str = obj.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
            str = str.replace(/[.。]+$/g, '');
            return str.trim();
        } else if (Array.isArray(obj)) {
            return obj.map(item => sanitizeObj(item));
        } else if (obj !== null && typeof obj === 'object') {
            const newObj = {};
            for (let key in obj) {
                newObj[key] = sanitizeObj(obj[key]);
            }
            return newObj;
        }
        return obj;
    }

    function normalizeYtGeneratedMessage(value) {
        if (typeof value === 'string') {
            return { text: value.trim(), translationZh: '' };
        }
        if (!value || typeof value !== 'object') {
            return { text: '', translationZh: '' };
        }
        return {
            text: String(value.text ?? value.content ?? value.message ?? '').trim(),
            translationZh: String(value.translationZh ?? value.translation ?? '').trim()
        };
    }

    function createDefaultYtChannelState() {
        return {
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
            dataCenter: { views: 0, sc: 0, subs: 0, commission: 0, receivedGifts: [] },
            userCommunityChannel: null
        };
    }

    function createDefaultYoutubeState() {
        return {
            channelState: createDefaultYtChannelState(),
            subscriptions: [],
            userState: null
        };
    }

    function normalizeYoutubeState(rawState) {
        const safeState = rawState && typeof rawState === 'object' ? rawState : {};
        return {
            channelState: normalizeYtChannelState(safeState.channelState),
            subscriptions: normalizeYtSubscriptions(safeState.subscriptions),
            userState: safeState.userState ? normalizeYtUserState(safeState.userState) : null
        };
    }

    let channelState = createDefaultYtChannelState();

    function normalizeYtAdminSnapshots(rawAdmins) {
        if (!Array.isArray(rawAdmins)) return [];
        const seen = new Set();
        return rawAdmins.map(admin => {
            if (!admin || typeof admin !== 'object') return null;
            const charId = admin.charId ?? admin.id;
            if (charId === undefined || charId === null || charId === '') return null;
            const key = String(charId);
            if (seen.has(key)) return null;
            seen.add(key);
            return {
                charId,
                name: String(admin.name || admin.nickname || admin.realName || '管理员'),
                avatarUrl: admin.avatarUrl || admin.avatar || '',
                persona: String(admin.persona || '')
            };
        }).filter(Boolean);
    }

    function normalizeYtFanGroup(rawGroup = {}) {
        const safeGroup = rawGroup && typeof rawGroup === 'object' ? rawGroup : {};
        return {
            ...safeGroup,
            admins: normalizeYtAdminSnapshots(safeGroup.admins)
        };
    }

    function ensureYtFixedCharFanGroup(channel) {
        if (!channel || typeof channel !== 'object' || channel.id === 'user_channel_id' || channel.isUserOwnedCommunity || channel.isBusiness) {
            return channel;
        }
        if (!channel.generatedContent || typeof channel.generatedContent !== 'object') {
            channel.generatedContent = { currentLive: null, pastVideos: [], communityPosts: [] };
        }
        const existing = channel.generatedContent.fanGroup && typeof channel.generatedContent.fanGroup === 'object'
            ? channel.generatedContent.fanGroup
            : {};
        const shouldAssignFrontendCount = existing.memberCountSource !== 'frontend'
            || !Number.isFinite(Number(existing.memberCount));
        channel.generatedContent.fanGroup = {
            ...existing,
            id: existing.id || `yt_fan_group_${channel.id || Date.now()}`,
            name: `${String(channel.name || 'Char').trim() || 'Char'}的粉丝群`,
            nameTranslationZh: '',
            memberCount: shouldAssignFrontendCount
                ? Math.floor(Math.random() * (50000 - 500 + 1)) + 500
                : Math.max(500, Math.min(50000, Math.round(Number(existing.memberCount)))),
            memberCountSource: 'frontend',
            _memberCountMigrationPending: existing._memberCountMigrationPending === true || shouldAssignFrontendCount,
            admins: normalizeYtAdminSnapshots(existing.admins),
            isJoined: existing.isJoined === true,
            isOwned: false
        };
        if (!Array.isArray(channel.generatedContent.pastVideos)) channel.generatedContent.pastVideos = [];
        if (!Array.isArray(channel.generatedContent.communityPosts)) channel.generatedContent.communityPosts = [];
        return channel;
    }

    function normalizeYtUserCommunityChannel(rawChannel) {
        if (!rawChannel || typeof rawChannel !== 'object') return null;
        const safeGeneratedContent = rawChannel.generatedContent && typeof rawChannel.generatedContent === 'object'
            ? rawChannel.generatedContent
            : {};
        const rawGroup = safeGeneratedContent.fanGroup && typeof safeGeneratedContent.fanGroup === 'object'
            ? safeGeneratedContent.fanGroup
            : {};
        const memberCount = Math.max(1, Math.round(Number(rawGroup.memberCount) || 1));
        return {
            ...rawChannel,
            id: rawChannel.id || 'user_community_channel',
            name: String(rawChannel.name || '我的频道'),
            avatar: rawChannel.avatar || '',
            isUserOwnedCommunity: true,
            isBusiness: false,
            groupChatHistory: Array.isArray(rawChannel.groupChatHistory) ? rawChannel.groupChatHistory.filter(Boolean) : [],
            dmHistory: Array.isArray(rawChannel.dmHistory) ? rawChannel.dmHistory.filter(Boolean) : [],
            generatedContent: {
                ...safeGeneratedContent,
                fanGroup: {
                    ...normalizeYtFanGroup(rawGroup),
                    id: rawGroup.id || 'user_fan_group',
                    name: String(rawGroup.name || '我的社群'),
                    memberCount,
                    isJoined: true,
                    isOwned: true,
                    lastGrowthLiveId: rawGroup.lastGrowthLiveId || null
                }
            }
        };
    }

    function compressImage(dataUrl, maxWidth, maxHeight, callback) {
        const img = new Image();
        img.onload = function() {
            let width = img.width;
            let height = img.height;
            let shouldCompress = false;
            
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
                shouldCompress = true;
            }
            if (height > maxHeight) {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
                shouldCompress = true;
            }

            if (!shouldCompress) {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, img.width, img.height);
                callback(canvas.toDataURL('image/jpeg', 0.8));
                return;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            callback(compressedDataUrl);
        };
        img.src = dataUrl;
    }
    window.compressImage = window.compressImage || compressImage;

    function parseSubs(str) {
        if (!str) return 0;
        let s = String(str).replace(/,/g, '').trim();
        let multi = 1;
        if (s.includes('亿')) { multi = 100000000; s = s.replace('亿', ''); }
        else if (s.includes('万')) { multi = 10000; s = s.replace('万', ''); }
        else if (s.toUpperCase().includes('K')) { multi = 1000; s = s.toUpperCase().replace('K', ''); }
        else if (s.toUpperCase().includes('M')) { multi = 1000000; s = s.toUpperCase().replace('M', ''); }
        let num = parseFloat(s);
        if (isNaN(num)) return 0;
        return Math.floor(num * multi);
    }

    function formatSubs(num) {
        if (num >= 100000000) {
            return (num / 100000000).toFixed(1).replace(/\.0$/, '') + '亿';
        } else if (num >= 10000) {
            return (num / 10000).toFixed(1).replace(/\.0$/, '') + '万';
        } else {
            return num.toString();
        }
    }

    function getPreferredAppleIdUser() {
        const accounts = typeof window.getAccounts === 'function' ? window.getAccounts() : [];
        const currentAccountId = typeof window.getCurrentAccountId === 'function' ? window.getCurrentAccountId() : null;
        const currentAccount = accounts.find(acc => String(acc.id) === String(currentAccountId)) || null;
        const runtimeUser = window.userState || {};

        if (currentAccount) {
            const resolvedName = currentAccount.name || runtimeUser.name || runtimeUser.realName || 'User';
            return {
                name: resolvedName,
                handle: currentAccount.handle || runtimeUser.handle || (resolvedName ? resolvedName.toLowerCase().replace(/\s+/g, '') : 'user'),
                avatarUrl: currentAccount.avatarUrl || runtimeUser.avatarUrl || runtimeUser.avatar || '',
                persona: currentAccount.persona || currentAccount.signature || runtimeUser.persona || '',
                subs: runtimeUser.subs || '0',
                videos: runtimeUser.videos || '0'
            };
        }

        return {
            name: runtimeUser.name || runtimeUser.realName || 'User',
            handle: runtimeUser.handle || (runtimeUser.name ? runtimeUser.name.toLowerCase().replace(/\s+/g, '') : 'user'),
            avatarUrl: runtimeUser.avatarUrl || runtimeUser.avatar || '',
            persona: runtimeUser.persona || '',
            subs: runtimeUser.subs || '0',
            videos: runtimeUser.videos || '0'
        };
    }

    function createYtUserStateFromAppleId() {
        const appleUser = getPreferredAppleIdUser();
        return {
            name: appleUser.name || 'User',
            handle: appleUser.handle || (appleUser.name ? appleUser.name.toLowerCase().replace(/\s+/g, '') : 'user'),
            avatarUrl: appleUser.avatarUrl || '',
            persona: appleUser.persona || '',
            subs: appleUser.subs || '0',
            videos: appleUser.videos || '0'
        };
    }

    function normalizeYtUserState(rawUser) {
        const fallbackUser = createYtUserStateFromAppleId();
        const safeUser = rawUser && typeof rawUser === 'object' ? rawUser : {};
        const resolvedName = safeUser.name || safeUser.realName || fallbackUser.name || 'User';

        return {
            name: resolvedName,
            handle: (safeUser.handle || (resolvedName ? resolvedName.toLowerCase().replace(/\s+/g, '') : fallbackUser.handle || 'user')).replace(/^@/, ''),
            avatarUrl: safeUser.avatarUrl || safeUser.avatar || fallbackUser.avatarUrl || '',
            persona: safeUser.persona || fallbackUser.persona || '',
            subs: safeUser.subs || fallbackUser.subs || '0',
            videos: safeUser.videos || fallbackUser.videos || '0'
        };
    }

    function normalizeYtChannelState(rawState) {
        const defaults = createDefaultYtChannelState();
        const safeState = rawState && typeof rawState === 'object' ? rawState : {};
        const rawDataCenter = safeState.dataCenter && typeof safeState.dataCenter === 'object' ? safeState.dataCenter : {};

        return {
            ...defaults,
            ...safeState,
            boundWorldBookIds: Array.isArray(safeState.boundWorldBookIds) ? safeState.boundWorldBookIds.filter(Boolean) : [],
            liveSummaries: Array.isArray(safeState.liveSummaries) ? safeState.liveSummaries.filter(item => item && typeof item === 'object') : [],
            groupChatHistory: Array.isArray(safeState.groupChatHistory) ? safeState.groupChatHistory.filter(item => item && typeof item === 'object') : [],
            activeUserLive: safeState.activeUserLive && typeof safeState.activeUserLive === 'object' ? safeState.activeUserLive : null,
            pastVideos: Array.isArray(safeState.pastVideos) ? safeState.pastVideos.filter(video => video && typeof video === 'object') : [],
            communityPosts: Array.isArray(safeState.communityPosts) ? safeState.communityPosts.filter(post => post && typeof post === 'object') : [],
            dataCenter: {
                views: Math.max(0, Number(rawDataCenter.views) || 0),
                sc: Math.max(0, Number(rawDataCenter.sc) || 0),
                subs: Math.max(0, Number(rawDataCenter.subs) || 0),
                commission: Number(rawDataCenter.commission) || 0,
                receivedGifts: Array.isArray(rawDataCenter.receivedGifts)
                    ? rawDataCenter.receivedGifts.filter(item => item && typeof item === 'object').slice(0, 100)
                    : []
            },
            userCommunityChannel: normalizeYtUserCommunityChannel(safeState.userCommunityChannel)
        };
    }

    function getYtImChars() {
        const friends = typeof window.getImFriends === 'function'
            ? window.getImFriends()
            : (window.imData && Array.isArray(window.imData.friends) ? window.imData.friends : []);
        return (Array.isArray(friends) ? friends : []).filter(friend => friend && friend.type === 'char');
    }

    function normalizeYtLookupText(value) {
        return String(value || '').trim().toLowerCase();
    }

    function resolveYtLinkedImChar(channel) {
        if (!channel || typeof channel !== 'object') return null;
        const chars = getYtImChars();
        if (chars.length === 0) return null;

        if (channel.imCharId !== undefined && channel.imCharId !== null && channel.imCharId !== '') {
            const byId = chars.find(friend => String(friend.id) === String(channel.imCharId));
            if (byId) return byId;
        }

        const channelNames = [
            channel.name,
            channel.nickname,
            channel.realName,
            channel.handle
        ].map(normalizeYtLookupText).filter(Boolean);

        return chars.find(friend => {
            const friendNames = [
                friend.nickname,
                friend.realName,
                friend.name
            ].map(normalizeYtLookupText).filter(Boolean);
            return friendNames.some(name => channelNames.includes(name));
        }) || null;
    }

    function resolveYtExplicitImChar(channel) {
        if (!channel || typeof channel !== 'object') return null;
        if (channel.imCharId === undefined || channel.imCharId === null || channel.imCharId === '') return null;
        return getYtImChars().find(friend => String(friend.id) === String(channel.imCharId)) || null;
    }

    function normalizeYtChatLanguage(value) {
        if (window.imDataUtils && typeof window.imDataUtils.normalizeChatLanguage === 'function') {
            return window.imDataUtils.normalizeChatLanguage(value);
        }
        const language = String(value || '').trim().toLowerCase();
        if (!language || ['zh', 'cn', 'zh-cn'].includes(language)) return 'zh';
        if (['ko', 'kr'].includes(language)) return 'ko';
        if (['ja', 'jp'].includes(language)) return 'ja';
        if (language === 'en') return 'en';
        if (language === 'fr') return 'fr';
        return language;
    }

    function escapeYtCoreHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[char]));
    }

    function getYtChatLanguageName(value) {
        if (window.imDataUtils && typeof window.imDataUtils.getChatLanguageName === 'function') {
            return window.imDataUtils.getChatLanguageName(value);
        }
        const language = normalizeYtChatLanguage(value);
        return {
            zh: 'Chinese',
            en: 'English',
            ja: 'Japanese',
            ko: 'Korean',
            fr: 'French'
        }[language] || language || 'Chinese';
    }

    function getYtChannelLanguageContext(channel) {
        const linkedChar = resolveYtExplicitImChar(channel);
        if (!linkedChar) {
            return { enabled: false, linkedChar: null, language: '', languageName: '' };
        }
        const language = normalizeYtChatLanguage(linkedChar.language || 'zh');
        return {
            enabled: true,
            linkedChar,
            language,
            languageName: getYtChatLanguageName(language)
        };
    }

    function normalizeYtLocalizedContent(value, languageContext = null) {
        const source = value && typeof value === 'object' ? value : { text: value };
        const text = String(source.text || source.content || source.message || '').trim();
        let translationZh = String(
            source.translationZh || source.translation || source.chineseTranslation || ''
        ).trim();
        if (languageContext && languageContext.enabled && languageContext.language === 'zh') {
            translationZh = '';
        }
        return { text, translationZh };
    }

    function buildYtLocalizedJsonContract(channel, scopeLabel = 'all generated visible copy') {
        const context = getYtChannelLanguageContext(channel);
        if (!context.enabled) return '';
        if (context.language === 'zh') {
            return `\n\n【YTB LINKED CHAR LANGUAGE CONTRACT｜最高优先级】\n- This channel is linked to an iMessage Char whose current Chat Settings default language is Chinese (zh).\n- ${scopeLabel} must be written only in natural Simplified Chinese.\n- Every translationZh/titleTranslationZh/nameTranslationZh field must be an empty string.\n- Localized dialogue/narrative items must use the object shape {"text":"Chinese original","translationZh":""}; comments must use {"name":"viewer name","text":"Chinese original","translationZh":""}.\n- This contract overrides persona, world-book, user input, and any editable prompt language instruction.`;
        }
        return `\n\n【YTB LINKED CHAR LANGUAGE CONTRACT｜最高优先级】\n- This channel is linked to an iMessage Char whose current Chat Settings default language is ${context.languageName} (${context.language}).\n- ${scopeLabel} must use only ${context.languageName} as the original language. Do not write Chinese in original text fields.\n- Every original-language field must include an accurate natural Simplified Chinese translation in its paired translationZh/titleTranslationZh/nameTranslationZh field. No required translation may be empty.\n- Localized dialogue/narrative items must use {"text":"${context.languageName} original","translationZh":"Simplified Chinese translation"}; comments must use {"name":"viewer name","text":"${context.languageName} original","translationZh":"Simplified Chinese translation"}.\n- This contract overrides persona, world-book, user input, and any editable prompt language instruction.`;
    }

    function formatYtChineseMetricCount(value, suffix, legacyFallback = '') {
        const count = Number(value);
        if (!Number.isFinite(count) || count < 0) return String(legacyFallback || '').trim();
        const rounded = Math.max(0, Math.round(count));
        let display = String(rounded);
        try {
            display = new Intl.NumberFormat('zh-CN', {
                notation: rounded >= 10000 ? 'compact' : 'standard',
                maximumFractionDigits: 1
            }).format(rounded);
        } catch (error) {}
        return `${display} ${suffix}`;
    }

    function formatYtLiveViewerCount(value, legacyFallback = '') {
        return formatYtChineseMetricCount(value, '人正在观看', legacyFallback);
    }

    function formatYtVideoViewCount(value, legacyFallback = '') {
        return formatYtChineseMetricCount(value, '次观看', legacyFallback);
    }

    window.getYtChannelLanguageContext = getYtChannelLanguageContext;
    window.normalizeYtLocalizedContent = normalizeYtLocalizedContent;
    window.buildYtLocalizedJsonContract = buildYtLocalizedJsonContract;
    window.formatYtLiveViewerCount = formatYtLiveViewerCount;
    window.formatYtVideoViewCount = formatYtVideoViewCount;

    function getYtChannelRelationshipContext(channel) {
        const linkedChar = resolveYtExplicitImChar(channel);
        if (!linkedChar) return '';

        const normalizedChar = window.imApp && typeof window.imApp.normalizeFriendData === 'function'
            ? window.imApp.normalizeFriendData(linkedChar)
            : linkedChar;
        const relationships = Array.isArray(normalizedChar?.memory?.relationships)
            ? normalizedChar.memory.relationships
            : [];
        if (relationships.length === 0) return '';

        const allFriends = Array.isArray(window.imData?.friends) ? window.imData.friends : [];
        const lines = relationships
            .map(rel => {
                const target = allFriends.find(item => String(item.id) === String(rel.npcId));
                const targetName = target?.nickname || target?.realName || target?.name || '未知角色';
                const relation = String(rel.relation || '').trim();
                return relation ? `- ${targetName}：${relation}` : '';
            })
            .filter(Boolean);

        return lines.length > 0 ? `iMessage 关系网：\n${lines.join('\n')}` : '';
    }

    function getYtChannelPersonaWithRelationships(channel, fallbackPersona = '未知') {
        const basePersona = String(
            channel?.desc || channel?.persona || fallbackPersona || '未知'
        ).trim() || '未知';
        const relationshipContext = getYtChannelRelationshipContext(channel);
        return relationshipContext ? `${basePersona}\n${relationshipContext}` : basePersona;
    }

    function normalizeYtWorldBookIds(ids = []) {
        return (Array.isArray(ids) ? ids : [])
            .map(id => String(id || '').trim())
            .filter((id, index, allIds) => id && allIds.indexOf(id) === index);
    }

    function getYtMountedWorldBookIds() {
        return normalizeYtWorldBookIds(
            Array.isArray(channelState?.boundWorldBookIds)
                ? channelState.boundWorldBookIds
                : []
        );
    }

    function getYtWorldBookContext(contextText = '') {
        const sourceText = String(contextText || '');
        const sections = [];
        const hasGlobalContextHelper = typeof window.getGlobalWorldBookContext === 'function';
        const globalContext = hasGlobalContextHelper
            ? window.getGlobalWorldBookContext(sourceText)
            : '';
        if (globalContext) sections.push(globalContext.trim());

        const selectedIds = new Set(getYtMountedWorldBookIds());
        if (typeof window.getWorldBooks === 'function') {
            const books = window.getWorldBooks();
            if (Array.isArray(books)) {
                books.forEach(book => {
                    if (!book || !Array.isArray(book.entries)) return;
                    const isGlobalFallback = !hasGlobalContextHelper && book.isGlobal;
                    if (!isGlobalFallback && !selectedIds.has(String(book.id))) return;
                    if (hasGlobalContextHelper && book.isGlobal) return;

                    const entries = book.entries
                        .map(entry => window.normalizeWorldBookEntry
                            ? window.normalizeWorldBookEntry(entry)
                            : entry)
                        .filter(entry => entry && entry.enabled !== false)
                        .filter(entry => !window.worldBookKeywordMatched
                            || window.worldBookKeywordMatched(entry, sourceText));
                    if (entries.length === 0) return;

                    const entryBlocks = entries.map(entry => {
                        if (typeof window.formatWorldBookEntryForPrompt === 'function') {
                            return window.formatWorldBookEntryForPrompt(entry);
                        }
                        const label = entry.title || entry.name || entry.keyword || '未命名词条';
                        return `【${label}】\n${entry.content || ''}`.trim();
                    }).filter(Boolean);
                    if (entryBlocks.length > 0) {
                        sections.push(`Mounted World Book / 已挂载世界书：\n【${book.name || book.id || '未命名世界书'}】\n${entryBlocks.join('\n\n')}`);
                    }
                });
            }
        }

        if (!hasGlobalContextHelper && typeof window.getBuiltinWorldBookContext === 'function') {
            ['system_depth', 'before_role', 'after_role'].forEach(position => {
                const builtinContext = window.getBuiltinWorldBookContext(position, sourceText);
                if (builtinContext) sections.push(builtinContext.trim());
            });
        }

        return sections.filter(Boolean).join('\n\n').trim();
    }

    function resolveYtChannelAvatar(channel) {
        const linkedChar = resolveYtLinkedImChar(channel);
        return (linkedChar && linkedChar.avatarUrl)
            || (channel && (channel.avatar || channel.avatarUrl))
            || 'https://picsum.photos/80/80?grayscale';
    }

    window.resolveYtLinkedImChar = resolveYtLinkedImChar;
    window.resolveYtExplicitImChar = resolveYtExplicitImChar;
    window.getYtChannelRelationshipContext = getYtChannelRelationshipContext;
    window.getYtChannelPersonaWithRelationships = getYtChannelPersonaWithRelationships;
    window.getYtMountedWorldBookIds = getYtMountedWorldBookIds;
    window.getYtWorldBookContext = getYtWorldBookContext;
    window.resolveYtChannelAvatar = resolveYtChannelAvatar;

    function normalizeYtSubscription(sub, index = 0) {
        if (!sub || typeof sub !== 'object') return null;

        const resolvedName = String(sub.name || sub.nickname || '').trim();
        if (!resolvedName) return null;

        const resolvedHandle = String(sub.handle || resolvedName.toLowerCase().replace(/\s+/g, '')).replace(/^@/, '') || `channel${index + 1}`;
        const resolvedId = sub.id || `yt_sub_${resolvedHandle}_${index}`;

        const normalized = {
            ...sub,
            id: resolvedId,
            name: resolvedName,
            handle: resolvedHandle,
            imCharId: sub.imCharId || sub.imId || sub.friendId || null,
            avatar: sub.avatar || sub.avatarUrl || `https://picsum.photos/seed/${encodeURIComponent(resolvedId)}/80/80?grayscale`,
            banner: sub.banner || null,
            desc: sub.desc || '',
            subs: sub.subs || '',
            videos: sub.videos || '',
            isLive: !!sub.isLive,
            generatedContent: sub.generatedContent && typeof sub.generatedContent === 'object'
                ? {
                    ...sub.generatedContent,
                    fanGroup: sub.generatedContent.fanGroup
                        ? normalizeYtFanGroup(sub.generatedContent.fanGroup)
                        : null
                }
                : null,
            groupChatHistory: Array.isArray(sub.groupChatHistory) ? sub.groupChatHistory : [],
            isFriend: !!sub.isFriend,
            isBusiness: !!sub.isBusiness,
            isSubscribed: sub.isSubscribed !== false,
            unreadDmCount: Math.max(0, Math.round(Number(sub.unreadDmCount) || 0)),
            dmHistory: Array.isArray(sub.dmHistory) ? sub.dmHistory.filter(item => item && typeof item === 'object') : []
        };
        return ensureYtFixedCharFanGroup(normalized);
    }

    function normalizeYtSubscriptions(rawSubscriptions) {
        if (!Array.isArray(rawSubscriptions)) return [];

        return rawSubscriptions
            .map((sub, index) => normalizeYtSubscription(sub, index))
            .filter(Boolean);
    }

    function createStableYtChannelId(value, prefix = 'yt_channel') {
        const source = String(value || prefix)
            .trim()
            .toLowerCase()
            .replace(/^@/, '')
            .replace(/\s+/g, '-')
            .replace(/[^\w\u4e00-\u9fa5.-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || prefix;
        return `${prefix}_${source}`;
    }

    function buildYtChannelFromTrendingItem(item, type = 'trend', index = 0) {
        const safeItem = item && typeof item === 'object' ? item : {};
        const resolvedName = String(safeItem.name || safeItem.nickname || `频道${index + 1}`).trim();
        const resolvedHandle = String(safeItem.handle || resolvedName || `channel${index + 1}`)
            .replace(/^@/, '')
            .replace(/\s+/g, '')
            .trim() || `channel${index + 1}`;
        const stableId = safeItem.id || createStableYtChannelId(`${type}_${resolvedHandle}`, 'char_trend');
        const avatarSeed = encodeURIComponent(resolvedHandle || stableId);

        return normalizeYtSubscription({
            id: stableId,
            name: resolvedName,
            handle: resolvedHandle,
            avatar: safeItem.avatar || safeItem.avatarUrl || `https://picsum.photos/seed/${avatarSeed}/80/80`,
            banner: safeItem.banner || null,
            isLive: !!safeItem.isLive,
            desc: safeItem.desc || safeItem.persona || '',
            subs: safeItem.subs || '0',
            videos: safeItem.videos || '10',
            isFriend: !!safeItem.isFriend,
            isBusiness: !!safeItem.isBusiness,
            isSubscribed: safeItem.isSubscribed === true,
            generatedContent: safeItem.generatedContent || null,
            groupChatHistory: Array.isArray(safeItem.groupChatHistory) ? safeItem.groupChatHistory : [],
            dmHistory: Array.isArray(safeItem.dmHistory) ? safeItem.dmHistory : []
        }, index);
    }

    function mergeYtChannelIntoSubscriptions(channel, options = {}) {
        if (!channel || typeof channel !== 'object') return null;
        const { save = true, preferExistingSubscription = true } = options;
        const normalized = normalizeYtSubscription(channel, mockSubscriptions.length) || buildYtChannelFromTrendingItem(channel, 'manual', mockSubscriptions.length);
        if (!normalized) return null;

        const lookupHandle = normalizeYtLookupText(normalized.handle);
        const existingIndex = mockSubscriptions.findIndex(sub => {
            if (!sub) return false;
            if (String(sub.id) === String(normalized.id)) return true;
            return lookupHandle && normalizeYtLookupText(sub.handle) === lookupHandle;
        });

        if (existingIndex > -1) {
            const existing = mockSubscriptions[existingIndex];
            const merged = normalizeYtSubscription({
                ...existing,
                ...normalized,
                id: existing.id || normalized.id,
                isSubscribed: preferExistingSubscription ? (existing.isSubscribed !== false) : normalized.isSubscribed,
                generatedContent: normalized.generatedContent || existing.generatedContent || null,
                groupChatHistory: Array.isArray(normalized.groupChatHistory) && normalized.groupChatHistory.length > 0 ? normalized.groupChatHistory : (existing.groupChatHistory || []),
                dmHistory: Array.isArray(normalized.dmHistory) && normalized.dmHistory.length > 0 ? normalized.dmHistory : (existing.dmHistory || [])
            }, existingIndex);
            mockSubscriptions[existingIndex] = merged;
            hasSubscriptions = mockSubscriptions.some(sub => sub && sub.isSubscribed !== false);
            if (save) saveYoutubeData();
            return mockSubscriptions[existingIndex];
        }

        mockSubscriptions.push(normalized);
        hasSubscriptions = mockSubscriptions.some(sub => sub && sub.isSubscribed !== false);
        if (save) saveYoutubeData();
        return mockSubscriptions[mockSubscriptions.length - 1];
    }

    function rebuildYoutubeMockVideos() {
        mockVideos = [];
        if (channelState.activeUserLive) {
            const activeLive = channelState.activeUserLive;
            const liveUser = activeLive.user || {};
            mockVideos.push({
                title: activeLive.title || '我的直播间',
                desc: activeLive.desc || '',
                viewerCount: Number(activeLive.totalViews) || 0,
                views: formatYtLiveViewerCount(activeLive.totalViews, activeLive.views || `${activeLive.totalViews || 0} 人正在观看`),
                time: 'LIVE',
                thumbnail: activeLive.thumbnail || activeLive.backgroundUrl || 'https://picsum.photos/320/180',
                isLive: true,
                comments: Array.isArray(activeLive.comments) ? activeLive.comments : [],
                initialBubbles: Array.isArray(activeLive.initialBubbles) ? activeLive.initialBubbles : [],
                guest: activeLive.guest || null,
                channelData: {
                    id: 'user_channel_id',
                    name: liveUser.name || '我',
                    avatar: liveUser.avatarUrl || liveUser.avatar || 'https://picsum.photos/80/80',
                    subs: liveUser.subs || '0'
                }
            });
        }
        mockSubscriptions.forEach(sub => {
            if (sub.generatedContent && sub.generatedContent.currentLive) {
                mockVideos.push({
                    id: sub.generatedContent.currentLive.id || null,
                    title: sub.generatedContent.currentLive.title,
                    titleTranslationZh: sub.generatedContent.currentLive.titleTranslationZh || '',
                    viewerCount: Number(sub.generatedContent.currentLive.viewerCount),
                    views: formatYtLiveViewerCount(
                        sub.generatedContent.currentLive.viewerCount,
                        sub.generatedContent.currentLive.views
                    ) || '0 人正在观看',
                    time: 'LIVE',
                    thumbnail: sub.generatedContent.currentLive.thumbnail || 'https://picsum.photos/320/180?grayscale',
                    isLive: true,
                    comments: sub.generatedContent.currentLive.comments || [],
                    initialBubbles: sub.generatedContent.currentLive.initialBubbles || [],
                    liveTranscript: sub.generatedContent.currentLive.liveTranscript || [],
                    guest: sub.generatedContent.currentLive.guest || null,
                    channelData: sub
                });
            }
        });
    }

    function ensureYtUserState() {
        if (!ytUserState || typeof ytUserState !== 'object') {
            ytUserState = createYtUserStateFromAppleId();
        } else {
            ytUserState = {
                ...createYtUserStateFromAppleId(),
                ...normalizeYtUserState(ytUserState)
            };
        }
        return ytUserState;
    }

    function getYtEffectiveUserState() {
        return ensureYtUserState();
    }

    function loadYoutubeData() {
        try {
            const snapshot = typeof window.getAppState === 'function'
                ? normalizeYoutubeState(window.getAppState('youtube'))
                : createDefaultYoutubeState();

            channelState = snapshot.channelState;
            mockSubscriptions = snapshot.subscriptions;
            hasSubscriptions = mockSubscriptions.length > 0;
            rebuildYoutubeMockVideos();

            ytUserState = snapshot.userState;
        } catch (e) {
            console.error("Error loading YouTube data", e);
            channelState = createDefaultYtChannelState();
            mockSubscriptions = [];
            hasSubscriptions = false;
            mockVideos = [];
            ytUserState = null;
        }
    }

    function saveYoutubeData(options = {}) {
        try {
            const { skipUserState = false } = options || {};

            channelState = normalizeYtChannelState(channelState);
            mockSubscriptions = normalizeYtSubscriptions(mockSubscriptions);
            hasSubscriptions = mockSubscriptions.some(sub => sub && sub.isSubscribed !== false);

            if (typeof currentSubChannelData !== 'undefined' && currentSubChannelData && currentSubChannelData.id) {
                const syncedCurrentSub = channelState.userCommunityChannel
                    && String(channelState.userCommunityChannel.id) === String(currentSubChannelData.id)
                    ? channelState.userCommunityChannel
                    : mockSubscriptions.find(sub => String(sub.id) === String(currentSubChannelData.id));
                if (syncedCurrentSub) currentSubChannelData = syncedCurrentSub;
            }

            ytUserState = ytUserState ? normalizeYtUserState(ytUserState) : null;

            const nextState = normalizeYoutubeState({
                channelState,
                subscriptions: mockSubscriptions,
                userState: skipUserState || !ytUserState ? null : ytUserState
            });

            if (skipUserState || !ytUserState) {
                ytUserState = null;
            }

            rebuildYoutubeMockVideos();

            if (typeof window.setAppState === 'function') {
                window.setAppState('youtube', nextState);
            } else if (window.appState && typeof window.appStorage !== 'undefined') {
                window.appState.youtube = nextState;
                if (typeof window.appStorage.saveGlobalData === 'function') {
                    window.appStorage.saveGlobalData(window.appState);
                }
            } else {
                console.warn("YouTube data was not saved: setAppState is unavailable");
            }
        } catch (e) {
            console.error("Error saving YouTube data", e);
        }
    }

    loadYoutubeData();

    window.createYtUserStateFromAppleId = createYtUserStateFromAppleId;
    window.ensureYtUserState = ensureYtUserState;
    window.getYtEffectiveUserState = getYtEffectiveUserState;
    window.normalizeYtUserState = normalizeYtUserState;
    window.normalizeYtSubscriptions = normalizeYtSubscriptions;
    window.normalizeYtChannelState = normalizeYtChannelState;
    window.normalizeYtAdminSnapshots = normalizeYtAdminSnapshots;
    window.ensureYtFixedCharFanGroup = ensureYtFixedCharFanGroup;
    window.normalizeYoutubeState = normalizeYoutubeState;
    window.createStableYtChannelId = createStableYtChannelId;
    window.buildYtChannelFromTrendingItem = buildYtChannelFromTrendingItem;
    window.mergeYtChannelIntoSubscriptions = mergeYtChannelIntoSubscriptions;
    window.saveYoutubeData = saveYoutubeData;
    const ytChatKeyboardViewIds = [
        'yt-video-player-view',
        'yt-user-live-view',
        'yt-community-detail-view',
        'yt-bubble-chat-view'
    ];
    const isYtIOSWebKit = (() => {
        const ua = navigator.userAgent || '';
        const isIOSDevice = /iPad|iPhone|iPod/i.test(ua)
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        return isIOSDevice && /AppleWebKit/i.test(ua);
    })();
    let ytViewportResetTimers = [];
    let ytRootScrollGuardBound = false;

    function hasFocusedTextInput() {
        const active = document.activeElement;
        if (!active || !active.matches?.('input, textarea, [contenteditable="true"]')) return false;
        return true;
    }

    function clearYtViewportResetTimers() {
        ytViewportResetTimers.forEach((timer) => clearTimeout(timer));
        ytViewportResetTimers = [];
    }

    function resetYtManagedContainerScroll() {
        const app = document.getElementById('app');
        const youtubeView = document.getElementById('youtube-view');

        [app, youtubeView].forEach((element) => {
            if (!element) return;
            element.scrollTop = 0;
            element.scrollLeft = 0;
        });
    }

    function guardYtRootScroll() {
        if (!isYtIOSWebKit) return;
        const app = document.getElementById('app');
        if (!app?.classList.contains('yt-ios-scroll-locked')) return;
        resetYtManagedContainerScroll();
    }

    function bindYtRootScrollGuard() {
        if (!isYtIOSWebKit || ytRootScrollGuardBound) return;
        const app = document.getElementById('app');
        const youtubeView = document.getElementById('youtube-view');

        [app, youtubeView].forEach((element) => {
            element?.addEventListener('scroll', guardYtRootScroll, { passive: true });
        });
        ytRootScrollGuardBound = true;
    }

    function setYtIOSAppScrollLock(isLocked) {
        if (!isYtIOSWebKit) return;
        const app = document.getElementById('app');
        if (!app) return;

        if (isLocked) {
            app.classList.add('yt-ios-scroll-locked');
            bindYtRootScrollGuard();
            resetYtManagedContainerScroll();
            requestAnimationFrame(resetYtManagedContainerScroll);
            return;
        }

        resetYtManagedContainerScroll();
        app.classList.remove('yt-ios-scroll-locked');
    }

    function resetYtScrollPositions() {
        resetYtManagedContainerScroll();

        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.documentElement.scrollLeft = 0;
        document.body.scrollTop = 0;
        document.body.scrollLeft = 0;
    }

    window.resetYtViewportOffset = function() {
        if (!isYtIOSWebKit) return;

        clearYtViewportResetTimers();
        resetYtScrollPositions();

        const deferredReset = () => {
            // Never let a delayed YouTube cleanup disturb an input that was
            // subsequently focused in iMessage or another app.
            if (hasFocusedTextInput()) return;
            resetYtScrollPositions();
        };

        requestAnimationFrame(() => {
            deferredReset();
            requestAnimationFrame(deferredReset);
        });

        [60, 180, 360].forEach((delay) => {
            ytViewportResetTimers.push(setTimeout(deferredReset, delay));
        });
    };

    function clearYtKeyboardViewState(view) {
        if (!view) return;
        view.classList.remove('keyboard-open', 'yt-chat-keyboard-lock');
        delete view.dataset.ytKeyboardScrollTop;
    }

    window.releaseYtChatKeyboardLock = function(nextView = null) {
        const active = document.activeElement;
        const keepView = nextView || null;

        ytChatKeyboardViewIds.forEach((id) => {
            const view = document.getElementById(id);
            if (!view || view === keepView) return;
            if (active && view.contains(active) && typeof active.blur === 'function') active.blur();
            clearYtKeyboardViewState(view);
        });
    };

    window.setYtChatKeyboardLock = function(view, isOpen) {
        if (!view) return;
        if (isOpen) {
            window.releaseYtChatKeyboardLock(view);
            if (isYtIOSWebKit) {
                view.classList.add('keyboard-open', 'yt-chat-keyboard-lock');
                resetYtManagedContainerScroll();
            } else {
                clearYtKeyboardViewState(view);
            }
            return;
        }

        clearYtKeyboardViewState(view);
        if (isYtIOSWebKit) window.resetYtViewportOffset();
    };

    // 2. DOM Elements
    const ytView = document.getElementById('youtube-view');
    const subChannelView = document.getElementById('sub-channel-view');
    const dockIconYt = document.getElementById('dock-icon-youtube');
    const backBtn = document.getElementById('yt-back-btn');
    
    // Bottom Nav
    const navItems = document.querySelectorAll('.yt-nav-item');
    const navIndicator = document.getElementById('yt-nav-indicator');
    const tabContents = document.querySelectorAll('.yt-tab-content');

    // Home Tab Elements
    const subsList = document.getElementById('yt-subs-list');
    const liveSection = document.getElementById('yt-live-section');
    const emptyState = document.getElementById('yt-empty-state');
    const filterBubbles = document.querySelectorAll('.yt-filter-bubble');

    // Profile Tab Elements
    const profileName = document.getElementById('yt-profile-name');
    const profileHandle = document.getElementById('yt-profile-handle');
    const profileAvatarImg = document.getElementById('yt-profile-avatar-img');
    const profileAvatarIcon = document.querySelector('.yt-profile-avatar i');
    const profileHeaderBg = document.querySelector('.yt-profile-header-bg');
    const profileSubs = document.getElementById('yt-profile-subs');
    const profileVideos = document.getElementById('yt-profile-videos');
    const profileTabIndicator = document.getElementById('profile-tab-indicator');
    
    // Edit Channel Elements
    const editChannelBtn = document.getElementById('yt-edit-channel-btn');
    const editChannelSheet = document.getElementById('yt-edit-channel-sheet');
    const confirmEditBtn = document.getElementById('confirm-yt-edit-btn');

    // Edit Inputs
    const editNameInput = document.getElementById('yt-edit-name-input');
    const editHandleInput = document.getElementById('yt-edit-handle-input');
    const editUrlInput = document.getElementById('yt-edit-url-input');
    const editSubsInput = document.getElementById('yt-edit-subs-input');
    const editVideosInput = document.getElementById('yt-edit-videos-input');
    const editPersonaInput = document.getElementById('yt-edit-persona-input');
    const editDescInput = document.getElementById('yt-edit-desc-input');
    
    // Edit Uploads
    const editBannerBtn = document.getElementById('yt-edit-banner-btn');
    const bannerUpload = document.getElementById('yt-banner-upload');
    const editBannerImg = document.getElementById('yt-edit-banner-img');
    
    const editAvatarWrapper = document.getElementById('yt-edit-avatar-wrapper');
    const avatarUpload = document.getElementById('yt-avatar-upload');
    const editAvatarImg = document.getElementById('yt-edit-avatar-img');
    const editAvatarIcon = document.querySelector('#yt-edit-avatar-preview i');

    // 3. App Launch & Close Logic
    if (dockIconYt && ytView) {
        dockIconYt.addEventListener('click', (e) => {
            if (window.isJiggleMode || window.preventAppClick) { e.preventDefault(); e.stopPropagation(); return; }
            if (typeof window.ensureYtUserState === 'function') {
                ytUserState = window.ensureYtUserState();
            } else if (!ytUserState) {
                ytUserState = {};
            }
            syncYtProfile();
            setYtIOSAppScrollLock(true);
            if (window.openView) window.openView(ytView);
            else ytView.classList.add('active');
            resetYtManagedContainerScroll();
            renderSubscriptions();
            renderVideos();
        });
    }

    if (backBtn && ytView) {
        backBtn.addEventListener('click', () => {
            window.releaseYtChatKeyboardLock?.();
            if (window.closeView) window.closeView(ytView);
            else ytView.classList.remove('active');
            window.resetYtViewportOffset?.();
            setYtIOSAppScrollLock(false);
        });
    }

    // 4. Bottom Nav Interaction
    
    // --- Messages Tab Logic ---
    const msgFilterDm = document.getElementById('msg-filter-dm');
    const msgFilterCommunity = document.getElementById('msg-filter-community');
    const msgFilterBusiness = document.getElementById('msg-filter-business');
    const msgListContainer = document.getElementById('yt-messages-list');
    const msgRefreshBtn = document.getElementById('yt-messages-refresh-btn');
    const ytMessagesNavUnread = document.getElementById('yt-messages-nav-unread');
    let currentMsgFilter = 'dm';

    function getYtUnreadMessageCount() {
        return mockSubscriptions.reduce((total, sub) => total + Math.max(0, Math.round(Number(sub?.unreadDmCount) || 0)), 0);
    }

    function updateYtMessageUnreadIndicators() {
        const unreadCount = getYtUnreadMessageCount();
        ytMessagesNavUnread?.classList.toggle('is-visible', unreadCount > 0);
        if (ytMessagesNavUnread) {
            ytMessagesNavUnread.setAttribute('aria-label', unreadCount > 0 ? `${unreadCount} 条未读消息` : '暂无未读消息');
        }
        return unreadCount;
    }

    function markYtMessagesUnread(channel, count = 1) {
        if (!channel || typeof channel !== 'object') return 0;
        const safeCount = Math.max(0, Math.round(Number(count) || 0));
        channel.unreadDmCount = Math.max(0, Math.round(Number(channel.unreadDmCount) || 0)) + safeCount;
        updateYtMessageUnreadIndicators();
        return channel.unreadDmCount;
    }

    window.getYtUnreadMessageCount = getYtUnreadMessageCount;
    window.updateYtMessageUnreadIndicators = updateYtMessageUnreadIndicators;
    window.markYtMessagesUnread = markYtMessagesUnread;

    function buildYtIncomingMessageChannelContext() {
        const activeLive = channelState && channelState.activeUserLive
            ? {
                title: channelState.activeUserLive.title || '未命名直播',
                topic: channelState.activeUserLive.desc || '',
                guest: channelState.activeUserLive.guest?.name || ''
            }
            : null;
        const pastVideos = Array.isArray(channelState?.pastVideos)
            ? channelState.pastVideos.slice(0, 5).map(video => ({
                title: video.title || '未命名视频',
                description: video.desc || '',
                publishedAt: video.time || '',
                representativeComments: Array.isArray(video.comments)
                    ? video.comments.slice(0, 2).map(comment => comment?.text || '').filter(Boolean)
                    : []
            }))
            : [];
        const liveSummaries = Array.isArray(channelState?.liveSummaries)
            ? channelState.liveSummaries.slice(-3).reverse().map(summary => ({
                title: summary.title || '',
                content: summary.content || summary.summary || '',
                highlights: Array.isArray(summary.highlights) ? summary.highlights.slice(0, 3) : []
            }))
            : [];

        return JSON.stringify({
            currentlyLive: activeLive,
            recentVideos: pastVideos,
            recentLiveSummaries: liveSummaries
        }, null, 2);
    }

    if (msgRefreshBtn) {
        msgRefreshBtn.addEventListener('click', async () => {
            if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
                if(window.showToast) window.showToast('请先配置 API');
                renderMessagesList();
                return;
            }
            
            if (currentMsgFilter === 'community') {
                if(window.showToast) window.showToast('社群不支持魔法棒生成');
                return;
            }

            msgRefreshBtn.style.opacity = '0.5';
            msgRefreshBtn.style.pointerEvents = 'none';
            if(window.showToast) window.showToast('正在生成新消息...');

            const wbContext = window.getYtWorldBookContext
                ? window.getYtWorldBookContext(currentMsgFilter)
                : '';

            const effectiveYtUser = typeof window.getYtEffectiveUserState === 'function'
                ? window.getYtEffectiveUserState()
                : (ytUserState || {});
            const userPersona = effectiveYtUser.persona || '普通用户';
            const userChannelContext = buildYtIncomingMessageChannelContext();
            
            const filterTypeAtRequest = currentMsgFilter;
            let prompt = '';
            if (filterTypeAtRequest === 'business') {
                prompt = `仔细阅读我的用户人设，根据我的用户人设生成3-5个**为你量身定制**的商务合作/赞助/联动邀请。
要求发件人来自不同国家或地区，可以是品牌方、赞助商或希望联动的博主。合作内容必须与我的人设及真实频道内容息息相关。
每个发件人要有明确身份、沟通风格和惯用语言；允许使用符合其地区和人设的任意语言，整体应体现 YouTube 的国际化用户构成。
每人先发送2-4条简短自然的文字气泡，再发送商单卡片。不要像统一模板，不要每个人都用相同开场。
绝对不要使用任何 Emoji 表情符号，句子末尾不要使用句号。
我的用户人设："${userPersona}"。
世界观背景：${wbContext}
我的 YouTube 频道真实内容：${userChannelContext}
只能引用上述真实频道内容；没有往期视频或直播记录时，不得虚构看过某个具体视频或直播。
国际化翻译规则：每条文字消息如果 content 不是中文，translationZh 必须填写自然中文翻译；如果 content 是中文，translationZh 必须是空字符串。
返回严格的JSON格式：
{
  "users": [
    {
      "name": "发件人名字(必须纯品牌名或频道名，绝对禁止在名字中添加'PR'、'经理'、'负责人'、'官方'等任何后缀！)",
      "avatarDesc": "英文单词描述头像(如: business logo)",
      "persona": "发件人的身份、地区、性格和沟通风格",
      "preferredLanguage": "主要使用的语言名称",
      "messages": [
        { "type": "text", "content": "你好！我们是某某品牌", "translationZh": "" },
        { "type": "text", "content": "We loved your latest stream", "translationZh": "我们很喜欢你最近的直播" },
        { "type": "offer", "offerData": { 
            "title": "游戏试玩推广", 
            "offerType": "填入枚举值: video(定制视频) 或 live(工商直播) 或 post(图文宣发) 或 collab(博主联动)",
            "requirement": "详细说明植入要求或直播要求，必须明确！", 
            "price": "$5000",
            "rmbAmount": 35000,
            "penalty": "$2000",
            "rmbPenalty": 14000
            } 
        }
      ]
    }
  ]
}
注意：每个发件人的 messages 数组中，除了前面的文字寒暄，最后一条必须是 type 为 "offer" 的商单卡片。
offerData.price 用于展示，offerData.rmbAmount 是纯数字，代表换算成人民币的金额。只能返回纯JSON。`;
            } else if (filterTypeAtRequest === 'dm') {
                prompt = `仔细阅读我的用户人设和频道真实内容，生成3-5个不同国家、身份和语言习惯的陌生人、同行或粉丝给我发 YouTube 私信的数据。
私信必须像真实活人发来的消息：一句一发，每人2-5条短气泡，语气、断句和熟悉程度各不相同，不要像客服或统一模板。
他们可以询问我什么时候开播、讨论正在进行的直播、针对真实往期视频或直播内容说具体感受、催更、追问后续，或根据人设自然搭话。不同联系人应选择不同话题，不要全都催更。
如果频道没有往期视频或直播记录，只能询问首次开播、未来计划或根据人设搭话，绝对不能虚构看过某个具体视频或直播。
允许使用符合联系人国籍、人设和上下文的任意语言，整体应体现 YouTube 的国际化用户构成。
绝对不要使用任何 Emoji 表情符号，句子末尾不要使用句号。
我的用户人设："${userPersona}"。
世界观背景：${wbContext}
我的 YouTube 频道真实内容：${userChannelContext}
国际化翻译规则：每条消息如果 content 不是中文，translationZh 必须填写自然中文翻译；如果 content 是中文，translationZh 必须是空字符串。
返回严格的JSON格式：
{
  "users": [
    {
      "name": "陌生人/同行/粉丝名字",
      "avatarDesc": "英文单词描述头像",
      "persona": "联系人身份、国家或地区、性格以及为什么联系我",
      "preferredLanguage": "主要使用的语言名称",
      "messages": [
        { "type": "text", "content": "第一条中文消息", "translationZh": "" },
        { "type": "text", "content": "foreign-language message", "translationZh": "这条外语消息的自然中文翻译" }
      ]
    }
  ]
}
注意：只能返回纯JSON。`;
            }

            try {
                const endpoint = window.u2Api.resolveChatCompletionsEndpoint(window.apiConfig.endpoint);

                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${window.apiConfig.apiKey}`
                    },
                    body: JSON.stringify({
                        model: window.apiConfig.model || 'gpt-3.5-turbo',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.9,
                        response_format: { type: "json_object" } 
                    })
                });

                if (!res.ok) throw new Error("API failed");
                const data = await res.json();
                let resultText = data.choices[0].message.content;
                let jsonMatch = resultText.match(/\{[\s\S]*\}/);
                resultText = jsonMatch ? jsonMatch[0] : resultText;
                const parsed = sanitizeObj(JSON.parse(resultText));

                if (parsed.users && Array.isArray(parsed.users)) {
                    const isBusiness = filterTypeAtRequest === 'business';
                    parsed.users.forEach(u => {
                        const newSub = {
                            id: 'gen_user_' + Date.now() + Math.floor(Math.random()*10000),
                            name: u.name,
                            handle: u.name.toLowerCase().replace(/\s+/g, ''),
                            avatar: `https://picsum.photos/seed/${u.avatarDesc ? u.avatarDesc.replace(/\s+/g, '') : Date.now()}/80/80?grayscale`,
                            desc: u.persona || '',
                            preferredLanguage: u.preferredLanguage || '',
                            isBusiness: isBusiness,
                            isFriend: false,
                            isSubscribed: false, // 默认未订阅
                            dmHistory: (Array.isArray(u.messages) ? u.messages : []).map(m => {
                                if (m.type === 'offer') {
                                    return {
                                        type: 'char',
                                        name: u.name,
                                        isOffer: true,
                                        offerData: m.offerData || { title: '合作邀请', offerType: 'video', requirement: '详谈', price: '￥5000', penalty: '￥2000' },
                                        offerStatus: 'pending' // pending, accepted, rejected, completed, failed
                                    };
                                } else {
                                    const normalizedMessage = normalizeYtGeneratedMessage(m);
                                    return {
                                        type: 'char',
                                        name: u.name,
                                        text: normalizedMessage.text || "你好",
                                        translationZh: normalizedMessage.translationZh
                                    };
                                }
                            })
                        };
                        newSub.unreadDmCount = Math.max(1, newSub.dmHistory.length);
                        mockSubscriptions.unshift(newSub);
                    });
                    saveYoutubeData();
                    updateYtMessageUnreadIndicators();
                    renderMessagesList();
                    if(window.showToast) window.showToast(`收到 ${parsed.users.length} 位新联系人的消息`);
                }

            } catch (e) {
                console.error("Generate MSG Error: ", e);
                if(window.showToast) window.showToast('无法生成新消息，请重试');
            } finally {
                msgRefreshBtn.style.opacity = '1';
                msgRefreshBtn.style.pointerEvents = 'auto';
            }
        });
    }

    if (msgFilterDm && msgFilterCommunity && msgFilterBusiness) {
        msgFilterDm.addEventListener('click', () => {
            msgFilterDm.classList.add('active');
            msgFilterCommunity.classList.remove('active');
            msgFilterBusiness.classList.remove('active');
            currentMsgFilter = 'dm';
            renderMessagesList();
        });
        msgFilterCommunity.addEventListener('click', () => {
            msgFilterCommunity.classList.add('active');
            msgFilterDm.classList.remove('active');
            msgFilterBusiness.classList.remove('active');
            currentMsgFilter = 'community';
            renderMessagesList();
        });
        msgFilterBusiness.addEventListener('click', () => {
            msgFilterBusiness.classList.add('active');
            msgFilterCommunity.classList.remove('active');
            msgFilterDm.classList.remove('active');
            currentMsgFilter = 'business';
            renderMessagesList();
        });
    }

    function renderMessagesList() {
        if (!msgListContainer) return;
        updateYtMessageUnreadIndicators();
        msgListContainer.innerHTML = '';

        if (currentMsgFilter === 'business' || currentMsgFilter === 'dm') {
            const isBusiness = currentMsgFilter === 'business';
            const allTargetSubs = mockSubscriptions.filter(sub => sub.isBusiness === isBusiness && (sub.isFriend || (sub.dmHistory && sub.dmHistory.length > 0)));
            
            if (allTargetSubs.length === 0) {
                msgListContainer.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: 100px; color: #8e8e93;">
                        <i class="fas ${isBusiness ? 'fa-envelope-open-text' : 'fa-comment-dots'}" style="font-size: 48px; margin-bottom: 16px; color: #d1d1d6;"></i>
                        <p style="font-size: 15px;">暂无${isBusiness ? '商务' : '私信'}消息</p>
                    </div>
                `;
                return;
            }

            const friends = allTargetSubs.filter(s => s.isFriend);
            const strangers = allTargetSubs.filter(s => !s.isFriend);

            const renderSubList = (subsArr, title) => {
                if (subsArr.length === 0) return '';
                const wrapper = document.createElement('div');
                wrapper.innerHTML = `<div style="font-size: 14px; font-weight: 600; color: #8e8e93; margin: 16px 4px 8px;">${title} (${subsArr.length})</div>`;
                
                const listWrapper = document.createElement('div');
                listWrapper.style.backgroundColor = '#ffffff';
                listWrapper.style.borderRadius = '16px';
                listWrapper.style.overflow = 'hidden';
                listWrapper.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';

                subsArr.forEach((sub, index) => {
                    const el = document.createElement('div');
                    const avatarUrl = resolveYtChannelAvatar(sub);
                    el.style.display = 'flex';
                    el.style.alignItems = 'center';
                    el.style.gap = '15px';
                    el.style.cursor = 'pointer';
                    el.style.padding = '16px';
                    el.style.backgroundColor = '#ffffff';
                    if (index < subsArr.length - 1) {
                        el.style.borderBottom = '1px solid #f2f2f2';
                    }
                    
                    const dmHistory = Array.isArray(sub.dmHistory) ? sub.dmHistory : [];
                    const lastMsg = dmHistory.length > 0 ? dmHistory[dmHistory.length - 1] : null;
                    let lastMsgText = lastMsg?.isOffer ? '[商单邀请]' : (lastMsg?.text || '暂无消息');
                    let lastMsgTime = '刚刚';
                    const unreadCount = Math.max(0, Math.round(Number(sub.unreadDmCount) || 0));

                    const badgeHtml = sub.isBusiness ? `<span style="font-size:10px; background:#e8f5e9; color:#388e3c; padding:2px 4px; border-radius:4px; margin-left:4px;">商务</span>` : '';

                    el.innerHTML = `
                        <div style="width: 50px; height: 50px; border-radius: 50%; overflow: hidden; flex-shrink: 0; ">
                            <img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                        <div style="flex: 1; overflow: hidden;">
                            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                                <div style="font-size: 16px; font-weight: 600; color: #0f0f0f; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${sub.name} ${badgeHtml}</div>
                                <div style="display:flex;align-items:center;gap:7px;flex-shrink:0;">
                                    <div style="font-size: 12px; color: #8e8e93;">${lastMsgTime}</div>
                                    ${unreadCount > 0 ? '<span class="yt-message-thread-unread" aria-label="未读消息"></span>' : ''}
                                </div>
                            </div>
                            <div style="font-size: 13px; color: #606060; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${lastMsgText}</div>
                        </div>
                    `;
                    
                    el.addEventListener('click', () => {
                        currentSubChannelData = sub;
                        if (unreadCount > 0) {
                            sub.unreadDmCount = 0;
                            saveYoutubeData();
                            updateYtMessageUnreadIndicators();
                            renderMessagesList();
                        }
                        openDMChat(currentSubChannelData);
                    });
                    
                    listWrapper.appendChild(el);
                });
                wrapper.appendChild(listWrapper);
                return wrapper;
            };

            if (friends.length > 0) {
                msgListContainer.appendChild(renderSubList(friends, '我的好友'));
            }
            if (strangers.length > 0) {
                msgListContainer.appendChild(renderSubList(strangers, '消息请求'));
            }
            return;
        }

        // Community Tab - Render joined fan groups
        let joinedGroups = [];
        if (channelState.userCommunityChannel?.generatedContent?.fanGroup) {
            joinedGroups.push({
                subData: channelState.userCommunityChannel,
                group: channelState.userCommunityChannel.generatedContent.fanGroup,
                isOwned: true
            });
        }
        mockSubscriptions.forEach(sub => {
            if (sub.generatedContent && sub.generatedContent.fanGroup && sub.generatedContent.fanGroup.isJoined) {
                joinedGroups.push({
                    subData: sub,
                    group: sub.generatedContent.fanGroup
                });
            }
        });

        if (joinedGroups.length === 0) {
            msgListContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: 100px; color: #8e8e93;">
                    <i class="fas fa-users" style="font-size: 48px; margin-bottom: 16px; color: #d1d1d6;"></i>
                    <p style="font-size: 15px;">你还没有创建或加入任何社群</p>
                </div>
            `;
            return;
        }

        const listWrapper = document.createElement('div');
        listWrapper.style.backgroundColor = '#ffffff';
        listWrapper.style.borderRadius = '16px';
        listWrapper.style.overflow = 'hidden';
        listWrapper.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';

        joinedGroups.forEach((item, index) => {
            const el = document.createElement('div');
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.gap = '15px';
            el.style.cursor = 'pointer';
            el.style.padding = '16px';
            el.style.backgroundColor = '#ffffff';
            if (index < joinedGroups.length - 1) {
                el.style.borderBottom = '1px solid #f2f2f2';
            }
            
            let groupAvatarHtml = `
                <div style="width: 50px; height: 50px; border-radius: 50%; background: #f2f2f7; display: flex; justify-content: center; align-items: center; color: #8e8e93; flex-shrink: 0; ">
                    <i class="fas fa-users" style="font-size: 20px;"></i>
                </div>
            `;
            
            if (item.group.avatar) {
                groupAvatarHtml = `
                    <div style="width: 50px; height: 50px; border-radius: 50%; overflow: hidden; flex-shrink: 0;  background: transparent;">
                        <img src="${item.group.avatar}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                `;
            }
            
            let lastMsgText = '暂无群消息';
            if (item.subData.groupChatHistory && item.subData.groupChatHistory.length > 0) {
                const lastMsg = item.subData.groupChatHistory[item.subData.groupChatHistory.length - 1];
                lastMsgText = (lastMsg.name ? lastMsg.name + ': ' : '') + (lastMsg.text || '');
            }
            
            el.innerHTML = `
                ${groupAvatarHtml}
                <div style="flex: 1; overflow: hidden;">
                    <div style="font-size: 16px; font-weight: 600; color: #0f0f0f; margin-bottom: 4px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${item.group.name || '粉丝群'}${item.isOwned ? '<span style="font-size:10px; color:#fff; background:#0f0f0f; border-radius:6px; padding:2px 5px; margin-left:6px; vertical-align:2px;">我的</span>' : ''}</div>
                    <div style="font-size: 13px; color: #606060; display: flex; align-items: center; gap: 6px;">
                        <span style="white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${lastMsgText}</span>
                    </div>
                </div>
                <div style="color: #ccc;"><i class="fas fa-chevron-right"></i></div>
            `;
            
            el.addEventListener('click', () => {
                currentSubChannelData = item.subData; // Required for openFanGroupChat to know context
                openFanGroupChat(item.group);
            });
            
            listWrapper.appendChild(el);
        });
        msgListContainer.appendChild(listWrapper);
    }


    function updateNavIndicator(activeItem) {
        if (!activeItem || !navIndicator) return;
        const containerRect = activeItem.parentElement.getBoundingClientRect();
        const itemRect = activeItem.getBoundingClientRect();
        const relativeLeft = itemRect.left - containerRect.left;
        navIndicator.style.width = `${itemRect.width}px`;
        navIndicator.style.left = `${relativeLeft}px`;
    }

    setTimeout(() => {
        const activeNav = document.querySelector('.yt-nav-item.active');
        if(activeNav) updateNavIndicator(activeNav);
    }, 100);

    const ytCreateSheet = document.getElementById('yt-create-sheet');
    const ytNavPlusBtn = document.getElementById('yt-nav-plus-btn');

    if(ytNavPlusBtn && ytCreateSheet) {
        ytNavPlusBtn.addEventListener('click', () => {
            ytCreateSheet.classList.add('active');
        });

        ytCreateSheet.addEventListener('mousedown', (e) => {
            if (e.target === ytCreateSheet) {
                ytCreateSheet.classList.remove('active');
            }
        });
        
        const createBtns = ytCreateSheet.querySelectorAll('.yt-create-bubble-btn');
        createBtns.forEach((btn, idx) => {
            btn.addEventListener('click', () => {
                ytCreateSheet.classList.remove('active');
                if (idx === 0) {
                    const userLiveSetupSheet = document.getElementById('yt-user-live-setup-sheet');
                    if (userLiveSetupSheet) userLiveSetupSheet.classList.add('active');
                } else if (idx === 1) {
                    if (typeof window.openYtUserPostComposer === 'function') window.openYtUserPostComposer();
                } else if (idx === 2) {
                    if (typeof window.openYtUserCommunityCreator === 'function') window.openYtUserCommunityCreator();
                }
            });
        });
    }

    navItems.forEach((item) => {
        item.addEventListener('click', () => {
            if(item.classList.contains('yt-nav-item-center')) return;

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            updateNavIndicator(item);

            const targetId = item.getAttribute('data-target');
            tabContents.forEach(tab => {
                if (tab.id === targetId) {
                    tab.classList.add('active');
                    // Add hook for rendering messages
                    if (targetId === 'yt-messages-tab') {
                        renderMessagesList();
                    }
                } else {
                    tab.classList.remove('active');
                }
            });
        });
    });
    
    window.addEventListener('resize', () => {
        const activeNav = document.querySelector('.yt-nav-item.active');
        if(activeNav) updateNavIndicator(activeNav);
    });

    // 5. Data Rendering Logic
    function renderSubscriptions() {
        if (!subsList) return;
        subsList.innerHTML = '';

        document.querySelector('.yt-subscriptions-wrapper').style.display = 'flex';

        if (!hasSubscriptions || mockSubscriptions.length === 0) {
            const el = document.createElement('div');
            el.className = `yt-sub-item`;
            el.innerHTML = `
                <div class="yt-sub-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <span class="yt-sub-name">暂无订阅</span>
            `;
            subsList.appendChild(el);
            return;
        }

        // Only render actually subscribed channels in the top bar
        const realSubscriptions = mockSubscriptions.filter(s => s.isSubscribed !== false);
        
        if (realSubscriptions.length === 0 && mockSubscriptions.length > 0) {
            const el = document.createElement('div');
            el.className = `yt-sub-item`;
            el.innerHTML = `
                <div class="yt-sub-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <span class="yt-sub-name">暂无订阅</span>
            `;
            subsList.appendChild(el);
        } else {
            realSubscriptions.forEach(sub => {
                const el = document.createElement('div');
                const avatarUrl = resolveYtChannelAvatar(sub);
                el.className = `yt-sub-item ${sub.isLive ? 'has-live' : ''}`;
                el.innerHTML = `
                    <div class="yt-sub-avatar">
                        <img src="${avatarUrl}" alt="${sub.name}">
                    </div>
                    <span class="yt-sub-name">${sub.name}</span>
                `;
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (sub.id === 'user_channel_id') {
                        const userProfileTab = document.querySelector('.yt-nav-item[data-target="yt-profile-tab"]');
                        if (userProfileTab) userProfileTab.click();
                    } else {
                        if(window.openSubChannelView) window.openSubChannelView(sub);
                    }
                });
                subsList.appendChild(el);
            });
        }

        const allBtn = document.querySelector('.yt-sub-all-btn');
        const allSubsSheet = document.getElementById('yt-all-subs-sheet');
        if(allBtn && allSubsSheet) {
            allBtn.onclick = () => {
                const list = document.getElementById('yt-all-subs-list');
                list.innerHTML = '';
                const visibleSubscriptions = mockSubscriptions.filter(sub => {
                    if (!sub) return false;
                    return sub.isSubscribed !== false || !!resolveYtExplicitImChar(sub);
                });
                if (visibleSubscriptions.length === 0) {
                    list.innerHTML = `
                        <div style="display:flex; flex-direction:column; align-items:center; padding:44px 16px; color:#8e8e93; text-align:center;">
                            <i class="fas fa-user-plus" style="font-size:36px; color:#d1d1d6; margin-bottom:12px;"></i>
                            <div style="font-size:14px;">暂无 Char 或已订阅频道</div>
                        </div>
                    `;
                }
                visibleSubscriptions.forEach(sub => {
                    const item = document.createElement('div');
                    const avatarUrl = resolveYtChannelAvatar(sub);
                    item.className = 'account-card';
                    item.innerHTML = `
                        <div class="account-content" style="cursor:pointer;">
                            <div class="account-avatar"><img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div>
                            <div class="account-info">
                                <div class="account-name">${sub.name}</div>
                                <div class="account-detail">${sub.subs || '0'} 订阅者</div>
                            </div>
                        </div>
                    `;
                    item.addEventListener('click', () => {
                        allSubsSheet.classList.remove('active');
                        openSubChannelView(sub);
                    });
                    list.appendChild(item);
                });
                allSubsSheet.classList.add('active');
            };
            
            allSubsSheet.addEventListener('mousedown', (e) => {
                if(e.target === allSubsSheet) allSubsSheet.classList.remove('active');
            });
        }
    }

    let currentFilter = '全部';

    filterBubbles.forEach(bubble => {
        bubble.addEventListener('click', () => {
            filterBubbles.forEach(b => b.classList.remove('active'));
            bubble.classList.add('active');
            currentFilter = bubble.textContent;
            renderVideos();
        });
    });

    function renderVideos() {
        if (!liveSection || !emptyState) return;
        liveSection.innerHTML = '';

        let filteredVideos = mockVideos;
        if (currentFilter === '正在直播') {
            filteredVideos = mockVideos.filter(v => v.isLive);
        }

        if (filteredVideos.length === 0) {
            liveSection.style.display = 'none';
            emptyState.style.display = 'flex';
            emptyState.querySelector('p').textContent = '暂无符合条件的视频';
            return;
        }

        liveSection.style.display = 'flex';
        emptyState.style.display = 'none';

        // Only show videos from subscribed channels
        const realFilteredVideos = filteredVideos.filter(v => v.channelData && v.channelData.isSubscribed !== false);
        
        if (realFilteredVideos.length === 0) {
            liveSection.style.display = 'none';
            emptyState.style.display = 'flex';
            emptyState.querySelector('p').textContent = '暂无符合条件的视频';
            return;
        }

        realFilteredVideos.forEach(video => {
            const channel = video.channelData;
            const avatarUrl = resolveYtChannelAvatar(channel);
            const liveBadgeHtml = video.isLive ? `<div class="yt-live-badge"><i class="fas fa-broadcast-tower" style="font-size: 10px;"></i> LIVE</div>` : '';

            const el = document.createElement('div');
            el.className = 'yt-video-card';
            el.innerHTML = `
                <div class="yt-video-thumbnail">
                    <img src="${video.thumbnail || 'https://picsum.photos/320/180?grayscale'}" alt="Thumbnail">
                    ${liveBadgeHtml}
                </div>
                <div class="yt-video-info">
                    <div class="yt-video-avatar" style="cursor: pointer; border: 1px solid #e5e5e5; transition: transform 0.2s;">
                        <img src="${avatarUrl}" alt="${channel.name}">
                    </div>
                    <div class="yt-video-details">
                        <h3 class="yt-video-title">${escapeYtCoreHtml(video.title || '无标题')}</h3>
                        ${video.titleTranslationZh ? `<div class="yt-video-title-translation">${escapeYtCoreHtml(video.titleTranslationZh)}</div>` : ''}
                        <p class="yt-video-meta">${escapeYtCoreHtml(channel.name)} • ${escapeYtCoreHtml(video.views || '0')} • ${escapeYtCoreHtml(video.time || '刚刚')}</p>
                    </div>
                </div>
            `;
            
            el.addEventListener('click', () => {
                if(channel.id === 'user_channel_id') {
                    if(video.isLive) {
                        if (typeof window.openYtUserLiveView === 'function') window.openYtUserLiveView();
                        else {
                            const userLiveView = document.getElementById('yt-user-live-view');
                            if (userLiveView) userLiveView.classList.add('active');
                        }
                    } else {
                        const userProfileTab = document.querySelector('.yt-nav-item[data-target="yt-profile-tab"]');
                        if (userProfileTab) userProfileTab.click();
                    }
                } else {
                    openVideoPlayer(video);
                }
            });

            const avatarBtn = el.querySelector('.yt-video-avatar');
            avatarBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if(channel.id === 'user_channel_id') {
                    const userProfileTab = document.querySelector('.yt-nav-item[data-target="yt-profile-tab"]');
                    if (userProfileTab) userProfileTab.click();
                } else {
                    openSubChannelView(channel);
                }
            });

            liveSection.appendChild(el);
        });
    }

    function syncYtProfile() {
        // Safe binding for Data Center to avoid multiple event listeners without cloning
        const dataCenterBtn = document.getElementById('yt-data-center-btn');
        const dataCenterSheet = document.getElementById('yt-data-center-sheet');
        if (dataCenterBtn && dataCenterSheet && !dataCenterBtn.dataset.bound) {
            dataCenterBtn.dataset.bound = 'true';
            dataCenterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if(window.renderDataCenter) window.renderDataCenter();
                dataCenterSheet.classList.add('active');
            });
        }

        const effectiveYtUser = typeof window.getYtEffectiveUserState === 'function'
            ? window.getYtEffectiveUserState()
            : ytUserState;
        if (effectiveYtUser) {
            ytUserState = effectiveYtUser;
            const nameStr = effectiveYtUser.name || 'User';
            if (profileName) profileName.textContent = nameStr;
            
            const handleStr = effectiveYtUser.handle || nameStr.toLowerCase().replace(/\s+/g, '');
            if (profileHandle) profileHandle.textContent = '@' + handleStr;
            
            if (effectiveYtUser.avatarUrl) {
                if (profileAvatarImg) {
                    profileAvatarImg.src = effectiveYtUser.avatarUrl;
                    profileAvatarImg.style.display = 'block';
                }
                if (profileAvatarIcon) profileAvatarIcon.style.display = 'none';
            } else {
                if (profileAvatarImg) profileAvatarImg.style.display = 'none';
                if (profileAvatarIcon) profileAvatarIcon.style.display = 'block';
            }
            
            if (channelState.bannerUrl && profileHeaderBg) {
                profileHeaderBg.style.backgroundImage = `url('${channelState.bannerUrl}')`;
            } else if (profileHeaderBg) {
                profileHeaderBg.style.backgroundImage = 'none';
            }

            if (profileSubs) {
                profileSubs.textContent = `${effectiveYtUser.subs || '0'} 订阅者`;
            }
            if (profileVideos) {
                profileVideos.textContent = `${effectiveYtUser.videos || '0'} 视频`;
            }
        }
    }

    if (editChannelBtn && editChannelSheet) {
        editChannelBtn.addEventListener('click', () => {
            const effectiveYtUser = typeof window.getYtEffectiveUserState === 'function'
                ? window.getYtEffectiveUserState()
                : ytUserState;
            if (!effectiveYtUser) return;
            ytUserState = effectiveYtUser;
            const nameStr = effectiveYtUser.name || '';
            const handleStr = effectiveYtUser.handle || nameStr.toLowerCase().replace(/\s+/g, '');
            
            if(editNameInput) editNameInput.value = nameStr;
            if(editHandleInput) editHandleInput.value = handleStr;
            if(editUrlInput) editUrlInput.value = channelState.url || `youtube.com/@${handleStr}`;
            if(editSubsInput) editSubsInput.value = effectiveYtUser.subs || '';
            if(editVideosInput) editVideosInput.value = effectiveYtUser.videos || '';
            if(editPersonaInput) editPersonaInput.value = effectiveYtUser.persona || '';
            
            if (effectiveYtUser.avatarUrl && editAvatarImg) {
                editAvatarImg.src = effectiveYtUser.avatarUrl;
                editAvatarImg.style.display = 'block';
                if(editAvatarIcon) editAvatarIcon.style.display = 'none';
            } else {
                if(editAvatarImg) editAvatarImg.style.display = 'none';
                if(editAvatarIcon) editAvatarIcon.style.display = 'block';
            }
            
            if (channelState.bannerUrl && editBannerImg) {
                editBannerImg.src = channelState.bannerUrl;
                editBannerImg.style.display = 'block';
            } else {
                if(editBannerImg) editBannerImg.style.display = 'none';
            }
            editChannelSheet.classList.add('active');
        });
    }

    if (editHandleInput && editUrlInput) {
        editHandleInput.addEventListener('input', (e) => {
            const val = e.target.value.replace(/^@/, '');
            editUrlInput.value = val ? `youtube.com/@${val}` : 'youtube.com/@';
        });
    }

    if (editBannerBtn && bannerUpload) {
        editBannerBtn.addEventListener('click', () => bannerUpload.click());
        bannerUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (window.compressImage) {
                        window.compressImage(event.target.result, 800, 800, (compressedUrl) => {
                            if(editBannerImg) {
                                editBannerImg.src = compressedUrl;
                                editBannerImg.style.display = 'block';
                            }
                        });
                    } else {
                        if(editBannerImg) {
                            editBannerImg.src = event.target.result;
                            editBannerImg.style.display = 'block';
                        }
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (editAvatarWrapper && avatarUpload) {
        editAvatarWrapper.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                e.preventDefault();
                avatarUpload.click();
            }
        });
        avatarUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (window.compressImage) {
                        window.compressImage(event.target.result, 300, 300, (compressedUrl) => {
                            if(editAvatarImg) {
                                editAvatarImg.src = compressedUrl;
                                editAvatarImg.style.display = 'block';
                            }
                            if(editAvatarIcon) editAvatarIcon.style.display = 'none';
                        });
                    } else {
                        if(editAvatarImg) {
                            editAvatarImg.src = event.target.result;
                            editAvatarImg.style.display = 'block';
                        }
                        if(editAvatarIcon) editAvatarIcon.style.display = 'none';
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (confirmEditBtn) {
        confirmEditBtn.addEventListener('click', () => {
            if (typeof window.ensureYtUserState === 'function') {
                ytUserState = window.ensureYtUserState();
            } else if (!ytUserState) {
                ytUserState = {};
            }
            if(editNameInput) ytUserState.name = editNameInput.value.trim();
            if(editHandleInput) ytUserState.handle = editHandleInput.value.trim().replace(/^@/, '');
            if(editSubsInput) ytUserState.subs = editSubsInput.value.trim();
            if(editVideosInput) ytUserState.videos = editVideosInput.value.trim();
            if(editPersonaInput) ytUserState.persona = editPersonaInput.value.trim();
            if(editDescInput) ytUserState.desc = editDescInput.value.trim();
            
            if (editAvatarImg && editAvatarImg.style.display === 'block' && editAvatarImg.src) {
                ytUserState.avatarUrl = editAvatarImg.src;
            }
            if (editBannerImg && editBannerImg.style.display === 'block' && editBannerImg.src) {
                channelState.bannerUrl = editBannerImg.src;
            }
            if(editUrlInput) channelState.url = editUrlInput.value.trim();

            syncYtProfile();
            if(editChannelSheet) editChannelSheet.classList.remove('active');
            saveYoutubeData();
            if (window.showToast) window.showToast('频道信息已保存');
            renderVideos(); // Refresh avatars in video list
        });
    }

    if (editChannelSheet) {
        editChannelSheet.addEventListener('mousedown', (e) => {
            if (e.target === editChannelSheet) {
                editChannelSheet.classList.remove('active');
            }
        });
    }

    function refreshYoutubeUiAfterHydration() {
        updateYtMessageUnreadIndicators();
        if (!ytView || !ytView.classList.contains('active')) return;
        syncYtProfile();
        renderSubscriptions();
        renderVideos();

        const activeNavItem = document.querySelector('.yt-nav-item.active');
        if (activeNavItem?.getAttribute('data-target') === 'yt-messages-tab') {
            renderMessagesList();
        }
    }

    if (window.globalDataReadyPromise && typeof window.globalDataReadyPromise.then === 'function') {
        window.youtubeDataReadyPromise = window.globalDataReadyPromise.then(() => {
            loadYoutubeData();
            refreshYoutubeUiAfterHydration();
            return true;
        }).catch((error) => {
            console.warn('YouTube global data recovery failed:', error);
            return false;
        });
    } else {
        window.youtubeDataReadyPromise = Promise.resolve(true);
    }
