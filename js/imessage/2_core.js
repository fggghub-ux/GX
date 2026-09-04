// ==========================================
// IMESSAGE: DATA, STATE, CORE SYSTEM & NAVIGATION
// ==========================================

window.imData = {
    friends: [],
    moments: [],
    momentMessages: [],
    currentActiveFriend: null,
    currentSettingsFriend: null,
    currentDetailMoment: null,
    currentOpenUserId: 'me',
    pendingImages: [],
    isPublishing: false,
    currentEditImageIndex: -1,
    cssPresets: [],
    offlineTheme: {
        narrativeColor: '#111111',
        dialogueColor: '#8B8B8B',
        customCss: '',
        customCssEnabled: false,
        activePresetId: ''
    },
    offlineThemePresets: [],
    offlineThemeInitialized: false,
    offlinePrompts: [],
    offlinePromptPresets: [],
    offlinePromptActivePresetId: '',
    offlinePromptsInitialized: false,
    tempSelectedBookIds: [],
    tempRelationshipDrafts: [],
    isRelationshipPickerVisible: false,
    longPressTimer: null,
    currentActiveRow: null,
    currentReplyMessageId: null,
    batchSelectMode: false,
    batchSelectionFriendId: '',
    batchSelectedMessages: new Map(),
    stickers: [],
    momentsCoverUrl: null,
    profilePanelUiStateByFriendId: {},
    ready: false,
    momentsLoaded: false,
    momentMessagesLoaded: false,
    stickersLoaded: false
};

window.imApp = window.imApp || {};

window.imApp.getGroupUserIdentity = function(group, options = {}) {
    const user = window.getUserState ? window.getUserState() : (window.userState || {});
    const accounts = typeof window.getAccounts === 'function' ? window.getAccounts() : [];
    const currentAccountId = typeof window.getCurrentAccountId === 'function' ? window.getCurrentAccountId() : null;
    const currentAccount = accounts.find(account => String(account?.id) === String(currentAccountId)) || null;
    const override = !options.ignoreOverride && group?.type === 'group'
        ? group.memory?.userOverride
        : null;
    const source = override || currentAccount || user || {};
    const name = String(source.name || source.realName || source.nickname || user.name || user.realName || 'User').trim() || 'User';

    return {
        accountId: String(source.id || currentAccount?.id || user.id || ''),
        name,
        avatarUrl: String(source.avatarUrl || source.avatar || user.avatarUrl || user.avatar || 'assets/moren-thumb.jpg'),
        persona: String(source.persona || source.signature || user.persona || ''),
        signature: String(source.signature || source.persona || user.signature || '')
    };
};

window.imApp.captureGroupUserIdentity = function(group, message) {
    if (!group || group.type !== 'group' || !message || message.role !== 'user') return message;
    if (message.userIdentity && typeof message.userIdentity === 'object' && String(message.userIdentity.name || '').trim()) {
        return message;
    }

    const identity = window.imApp.getGroupUserIdentity(group);
    message.userIdentity = {
        accountId: identity.accountId,
        name: identity.name,
        avatarUrl: identity.avatarUrl
    };
    return message;
};

window.imApp.getMessageUserIdentity = function(friend, message) {
    if (friend?.type === 'group' && message?.role === 'user') {
        const snapshot = message.userIdentity;
        if (snapshot && typeof snapshot === 'object' && String(snapshot.name || '').trim()) {
            const legacyFallback = window.imApp.getGroupUserIdentity(friend, { ignoreOverride: true });
            return {
                accountId: String(snapshot.accountId || ''),
                name: String(snapshot.name).trim(),
                avatarUrl: String(snapshot.avatarUrl || legacyFallback.avatarUrl || 'assets/moren-thumb.jpg'),
                persona: legacyFallback.persona,
                signature: legacyFallback.signature
            };
        }

        // Legacy messages predate group identity snapshots, so retain their old global-profile behavior.
        return window.imApp.getGroupUserIdentity(friend, { ignoreOverride: true });
    }

    const user = window.getUserState ? window.getUserState() : (window.userState || {});
    return {
        accountId: String(user.id || ''),
        name: String(user.name || user.realName || user.nickname || 'User'),
        avatarUrl: String(user.avatarUrl || user.avatar || 'assets/moren-thumb.jpg'),
        persona: String(user.persona || ''),
        signature: String(user.signature || '')
    };
};
window.imApp.DEFAULT_STATUS_PROMPT = '固定使用简体中文，写角色此刻没有说出口的三句真实心声。每句约10个汉字，每行一句，共三行；不要添加序号、引号、标题、前缀或解释。';
window.imApp.DEFAULT_SINGLE_CHAT_COT_PROMPT = `请按以下顺序完整分析：
1. 当前具体日期、时间与时间段，以及这对本轮场景和聊天承接意味着什么。
2. 结合自己的核心人设、性格、当前情绪和与 User 的关系，分析自己现在最真实的想法与适合的回应方式。
3. 结合 User 人设、当前消息的内容与语气，分析 User 此刻的需求、感受和适合被怎样回应。`;

window.imApp.scopeUserCss = function(css, scope) {
    if (!css || !scope) return '';

    function findMatchingBrace(text, openIndex) {
        let depth = 0;
        let quote = null;
        let inComment = false;

        for (let i = openIndex; i < text.length; i += 1) {
            const char = text[i];
            const next = text[i + 1];

            if (inComment) {
                if (char === '*' && next === '/') {
                    inComment = false;
                    i += 1;
                }
                continue;
            }

            if (quote) {
                if (char === '\\') {
                    i += 1;
                } else if (char === quote) {
                    quote = null;
                }
                continue;
            }

            if (char === '/' && next === '*') {
                inComment = true;
                i += 1;
                continue;
            }

            if (char === '"' || char === "'") {
                quote = char;
                continue;
            }

            if (char === '{') depth += 1;
            if (char === '}') {
                depth -= 1;
                if (depth === 0) return i;
            }
        }

        return -1;
    }

    function splitSelectorList(selectorText) {
        const selectors = [];
        let current = '';
        let squareDepth = 0;
        let parenDepth = 0;
        let quote = null;

        for (let i = 0; i < selectorText.length; i += 1) {
            const char = selectorText[i];

            if (quote) {
                current += char;
                if (char === '\\') {
                    i += 1;
                    current += selectorText[i] || '';
                } else if (char === quote) {
                    quote = null;
                }
                continue;
            }

            if (char === '"' || char === "'") {
                quote = char;
                current += char;
                continue;
            }

            if (char === '[') squareDepth += 1;
            if (char === ']') squareDepth = Math.max(0, squareDepth - 1);
            if (char === '(') parenDepth += 1;
            if (char === ')') parenDepth = Math.max(0, parenDepth - 1);

            if (char === ',' && squareDepth === 0 && parenDepth === 0) {
                selectors.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        if (current.trim()) selectors.push(current.trim());
        return selectors;
    }

    function scopeSelector(selector) {
        const trimmed = selector.trim();
        if (!trimmed) return trimmed;
        if (trimmed.includes(':scope')) return trimmed.replace(/:scope/g, scope);
        if (trimmed === ':root' || trimmed === 'html' || trimmed === 'body') return scope;
        if (trimmed.startsWith(scope)) return trimmed;
        return `${scope} ${trimmed}`;
    }

    function scopeRules(text) {
        let output = '';
        let cursor = 0;

        while (cursor < text.length) {
            const openIndex = text.indexOf('{', cursor);
            if (openIndex === -1) {
                output += text.slice(cursor);
                break;
            }

            const prelude = text.slice(cursor, openIndex);
            const trimmedPrelude = prelude.trim();
            const closeIndex = findMatchingBrace(text, openIndex);

            if (closeIndex === -1) {
                output += text.slice(cursor);
                break;
            }

            const body = text.slice(openIndex + 1, closeIndex);
            const lowerPrelude = trimmedPrelude.toLowerCase();

            if (!trimmedPrelude) {
                output += text.slice(cursor, closeIndex + 1);
            } else if (
                lowerPrelude.startsWith('@media') ||
                lowerPrelude.startsWith('@supports') ||
                lowerPrelude.startsWith('@container') ||
                lowerPrelude.startsWith('@layer')
            ) {
                output += `${prelude}{${scopeRules(body)}}`;
            } else if (
                lowerPrelude.startsWith('@keyframes') ||
                lowerPrelude.startsWith('@-webkit-keyframes') ||
                lowerPrelude.startsWith('@font-face') ||
                lowerPrelude.startsWith('@property') ||
                lowerPrelude.startsWith('@page')
            ) {
                output += text.slice(cursor, closeIndex + 1);
            } else if (trimmedPrelude.startsWith('@')) {
                output += text.slice(cursor, closeIndex + 1);
            } else {
                const leadingWhitespace = prelude.match(/^\s*/)?.[0] || '';
                const scopedPrelude = splitSelectorList(trimmedPrelude).map(scopeSelector).join(', ');
                output += `${leadingWhitespace}${scopedPrelude}{${body}}`;
            }

            cursor = closeIndex + 1;
        }

        return output;
    }

    return scopeRules(String(css));
};

window.imApp.createDefaultOfflineThemeState = function() {
    return {
        narrativeColor: '#111111',
        dialogueColor: '#8B8B8B',
        customCss: '',
        customCssEnabled: false,
        activePresetId: ''
    };
};

window.imApp.normalizeOfflineThemeState = function(theme) {
    const defaults = window.imApp.createDefaultOfflineThemeState();
    const source = theme && typeof theme === 'object' ? theme : {};
    const normalizeColor = (value, fallback) => {
        const color = String(value || '').trim();
        return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toUpperCase() : fallback;
    };
    const customCss = typeof source.customCss === 'string' ? source.customCss : '';
    const migratedCustomCss = customCss.replaceAll('offline-tavern', 'offline-chat');

    return {
        narrativeColor: normalizeColor(source.narrativeColor, defaults.narrativeColor),
        dialogueColor: normalizeColor(source.dialogueColor, defaults.dialogueColor),
        customCss: migratedCustomCss,
        customCssEnabled: !!migratedCustomCss.trim(),
        activePresetId: String(source.activePresetId || '').trim()
    };
};

window.imApp.normalizeOfflineThemePresets = function(presets) {
    const source = Array.isArray(presets) ? presets : [];
    const usedIds = new Set();
    const usedNames = new Set();

    return source.map((preset, index) => {
        const item = preset && typeof preset === 'object' ? preset : {};
        const theme = window.imApp.normalizeOfflineThemeState(item);
        const name = String(item.name || '').trim() || `线下主题 ${index + 1}`;
        const normalizedName = name.toLocaleLowerCase();
        let id = String(item.id || '').trim() || `offline-theme-${index + 1}`;
        while (usedIds.has(id)) id = `${id}-${index + 1}`;
        if (usedNames.has(normalizedName)) return null;
        usedIds.add(id);
        usedNames.add(normalizedName);
        return {
            id,
            name,
            narrativeColor: theme.narrativeColor,
            dialogueColor: theme.dialogueColor,
            customCss: theme.customCss
        };
    }).filter(Boolean);
};

window.imApp.applyGlobalChatCss = function(themeState = window.u2ThemeState || {}) {
    const styleId = 'global-imessage-chat-css';
    let styleTag = document.getElementById(styleId);

    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
    }

    const enabled = !!themeState.imessageChatCssEnabled;
    const css = typeof themeState.imessageChatCss === 'string' ? themeState.imessageChatCss : '';
    const nextCss = enabled && css.trim()
        ? window.imApp.scopeUserCss(css, '.active-chat-interface.im-chat-single')
        : '';
    if (styleTag.textContent !== nextCss) styleTag.textContent = nextCss;
};

window.imApp.setActiveThemeSurface = function(surface = 'home') {
    const imessageView = document.getElementById('imessage-view');
    if (!imessageView) return;
    imessageView.dataset.imActiveSurface = String(surface || 'home');
};

function applyGlobalSurfaceCss({ styleId, enabled, css, scope }) {
    let styleTag = document.getElementById(styleId);
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
    }
    const nextCss = enabled && typeof css === 'string' && css.trim()
        ? window.imApp.scopeUserCss(css, scope)
        : '';
    if (styleTag.textContent !== nextCss) styleTag.textContent = nextCss;
}

window.imApp.applyGlobalHomeCss = function(themeState = window.u2ThemeState || {}) {
    applyGlobalSurfaceCss({
        styleId: 'global-imessage-home-css',
        enabled: !!themeState.imessageHomeCssEnabled,
        css: themeState.imessageHomeCss,
        scope: '#imessage-view:is([data-im-active-surface="home"], [data-im-active-surface="chats"])'
    });
};

window.imApp.applyGlobalGroupCss = function(themeState = window.u2ThemeState || {}) {
    const styleId = 'global-imessage-group-css';
    let styleTag = document.getElementById(styleId);

    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
    }

    const enabled = !!themeState.imessageGroupCssEnabled;
    const css = typeof themeState.imessageGroupCss === 'string' ? themeState.imessageGroupCss : '';
    const nextCss = enabled && css.trim()
        ? window.imApp.scopeUserCss(css, '.active-chat-interface.im-chat-group')
        : '';
    if (styleTag.textContent !== nextCss) styleTag.textContent = nextCss;
};

window.imApp.createDefaultAutonomousTask = function() {
    return {
        enabled: false,
        minIntervalMinutes: 30,
        maxIntervalMinutes: 240,
        nextRunAt: 0,
        lastRunAt: 0
    };
};

window.imApp.normalizeAutonomousTask = function(task) {
    const defaultTask = window.imApp.createDefaultAutonomousTask();
    const source = task && typeof task === 'object' ? task : {};
    const minInterval = Number(source.minIntervalMinutes);
    const maxInterval = Number(source.maxIntervalMinutes);
    const normalizedMin = Number.isFinite(minInterval)
        ? Math.max(1, Math.round(minInterval))
        : defaultTask.minIntervalMinutes;
    const normalizedMax = Number.isFinite(maxInterval)
        ? Math.max(normalizedMin, Math.round(maxInterval))
        : Math.max(normalizedMin, defaultTask.maxIntervalMinutes);

    return {
        enabled: !!source.enabled,
        minIntervalMinutes: normalizedMin,
        maxIntervalMinutes: normalizedMax,
        nextRunAt: Math.max(0, Number(source.nextRunAt) || defaultTask.nextRunAt),
        lastRunAt: Math.max(0, Number(source.lastRunAt) || defaultTask.lastRunAt)
    };
};

window.imApp.createDefaultAutonomousActivity = function() {
    return {
        reply: window.imApp.createDefaultAutonomousTask(),
        moment: window.imApp.createDefaultAutonomousTask()
    };
};

window.imApp.normalizeAutonomousActivity = function(activity) {
    const source = activity && typeof activity === 'object' ? activity : {};
    const hasNestedTasks = source.reply && typeof source.reply === 'object'
        || source.moment && typeof source.moment === 'object';
    const legacyReplySource = hasNestedTasks ? source.reply : source;

    return {
        reply: window.imApp.normalizeAutonomousTask(legacyReplySource),
        moment: window.imApp.normalizeAutonomousTask(source.moment)
    };
};

window.imApp.createDefaultMemory = function() {
    return {
        overview: '',
        anniversaries: '',
        context: { enabled: true, limit: 50, notes: '' },
        recallLimits: { shortTerm: 30, longTerm: 30 },
        summary: { enabled: false, limit: 80, roundLimit: 30, prompt: '', apiPresetId: '' },
        autonomous: window.imApp.createDefaultAutonomousActivity(),
        longTerm: '',
        shortTermEntries: [],
        groupChatContexts: [],
        cherished: '',
        longTermEntries: [],
        cherishedEntries: [],
        relationships: [],
        xDirectMessageMount: { enabled: true, limit: 10, dmId: '' },
        schedule: { enabled: false, sleepTime: '23:00', wakeTime: '07:00', events: [] },
        lastSummaryMessageCount: 0,
        mountSettings: {},
        mountLimits: {},
        recallPresentation: null
    };
};

window.imApp.createDefaultLinkedAccountBot = function() {
    return {
        enabled: false,
        intervalSeconds: 60,
        lastRunAt: 0
    };
};

window.imApp.normalizeLinkedAccountBot = function(bot) {
    const defaultBot = window.imApp.createDefaultLinkedAccountBot();
    const source = bot && typeof bot === 'object' ? bot : {};
    const intervalSeconds = Number(source.intervalSeconds);

    return {
        enabled: !!source.enabled,
        intervalSeconds: Number.isFinite(intervalSeconds)
            ? Math.max(5, Math.min(86400, Math.round(intervalSeconds)))
            : defaultBot.intervalSeconds,
        lastRunAt: Number(source.lastRunAt) || defaultBot.lastRunAt
    };
};

window.imApp.normalizeLinkedAccountChats = function(chats) {
    if (!Array.isArray(chats)) return [];

    return chats
        .map((chat, index) => {
            if (!chat || typeof chat !== 'object') return null;
            const messages = Array.isArray(chat.messages)
                ? chat.messages
                    .map((message, messageIndex) => {
                        if (!message || typeof message !== 'object') return null;
                        const text = typeof message.text === 'string'
                            ? message.text.trim()
                            : (typeof message.content === 'string' ? message.content.trim() : '');
                        if (!text) return null;
                        const role = message.role === 'char' ? 'char' : 'account';
                        const timestamp = Number(message.timestamp) || Date.now() + messageIndex;
                        const normalizedMessage = {
                            id: message.id || `linked-msg-${timestamp}-${messageIndex}`,
                            role,
                            text,
                            timestamp
                        };
                        const translation = typeof message.translation === 'string' && message.translation.trim()
                            ? message.translation.trim()
                            : (typeof message.translationZh === 'string' && message.translationZh.trim()
                                ? message.translationZh.trim()
                                : (typeof message.trans === 'string' && message.trans.trim() ? message.trans.trim() : ''));
                        if (translation) normalizedMessage.translation = translation;
                        const round = Number(message.round);
                        if (Number.isFinite(round) && round > 0) normalizedMessage.round = round;
                        const orderInTurn = Number(message.orderInTurn);
                        if (Number.isFinite(orderInTurn) && orderInTurn >= 0) normalizedMessage.orderInTurn = orderInTurn;
                        return normalizedMessage;
                    })
                    .filter(Boolean)
                : [];
            const now = Date.now();
            const updatedAt = Number(chat.updatedAt) || (messages.length > 0 ? messages[messages.length - 1].timestamp : now);

            return {
                id: chat.id || `linked-chat-${updatedAt}-${index}`,
                name: typeof chat.name === 'string' && chat.name.trim() ? chat.name.trim() : `Linked Friend ${index + 1}`,
                realName: typeof chat.realName === 'string' && chat.realName.trim()
                    ? chat.realName.trim()
                    : (typeof chat.name === 'string' ? chat.name.trim() : ''),
                remark: typeof chat.remark === 'string' ? chat.remark.trim() : '',
                handle: typeof chat.handle === 'string' ? chat.handle.trim() : '',
                persona: typeof chat.persona === 'string' ? chat.persona.trim() : '',
                relationship: typeof chat.relationship === 'string' ? chat.relationship.trim() : '',
                avatarSeed: typeof chat.avatarSeed === 'string' && chat.avatarSeed.trim()
                    ? chat.avatarSeed.trim()
                    : (typeof chat.handle === 'string' && chat.handle.trim() ? chat.handle.trim() : (typeof chat.name === 'string' ? chat.name.trim() : `linked-${index}`)),
                sourceNpcId: chat.sourceNpcId != null ? String(chat.sourceNpcId) : '',
                messages,
                createdAt: Number(chat.createdAt) || updatedAt,
                updatedAt,
                readAt: Number(chat.readAt) || 0
            };
        })
        .filter(Boolean);
};

window.imApp.createDefaultXDirectMessageMount = function() {
    return {
        enabled: true,
        limit: 10,
        dmId: ''
    };
};

window.imApp.normalizeMemoryRecallLimits = function(value) {
    const source = value && typeof value === 'object' ? value : {};
    const normalizeLimit = (candidate, fallback = 30) => {
        const numeric = Math.round(Number(candidate));
        return Number.isFinite(numeric) && numeric > 0
            ? Math.min(100, Math.max(1, numeric))
            : fallback;
    };
    return {
        shortTerm: normalizeLimit(source.shortTerm, 30),
        longTerm: normalizeLimit(source.longTerm, 30)
    };
};

window.imApp.normalizeXDirectMessageMount = function(mount) {
    const fallback = window.imApp.createDefaultXDirectMessageMount();
    const source = mount && typeof mount === 'object' && !Array.isArray(mount) ? mount : {};
    const parsedLimit = Number(source.limit);

    return {
        enabled: source.enabled !== false,
        limit: Number.isFinite(parsedLimit) ? Math.max(1, Math.min(50, Math.floor(parsedLimit))) : fallback.limit,
        dmId: source.dmId == null ? '' : String(source.dmId)
    };
};

window.imApp.isCharacterSleeping = function(friend) {
    if (!friend || !friend.memory || !friend.memory.schedule || !friend.memory.schedule.enabled) {
        return false;
    }
    
    const schedule = friend.memory.schedule;
    const sleepTime = schedule.sleepTime || '23:00';
    const wakeTime = schedule.wakeTime || '07:00';
    
    if (sleepTime === wakeTime) return false;

    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;

    const parseTime = (timeStr) => {
        const parts = timeStr.split(':');
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    };

    const sleepTotalMinutes = parseTime(sleepTime);
    const wakeTotalMinutes = parseTime(wakeTime);

    if (sleepTotalMinutes < wakeTotalMinutes) {
        // Sleep and wake on the same day (e.g. 13:00 to 15:00)
        return currentTotalMinutes >= sleepTotalMinutes && currentTotalMinutes < wakeTotalMinutes;
    } else {
        // Cross midnight (e.g. 23:00 to 07:00)
        return currentTotalMinutes >= sleepTotalMinutes || currentTotalMinutes < wakeTotalMinutes;
    }
};

window.imApp.normalizeProfileStatusHistory = function(friend = {}) {
    const panel = friend?.profilePanel && typeof friend.profilePanel === 'object'
        ? friend.profilePanel
        : {};
    const hasStatusHistory = Array.isArray(panel.statusHistory) && panel.statusHistory.length > 0;
    const source = hasStatusHistory
        ? panel.statusHistory
        : (Array.isArray(panel.thoughtHistory) ? panel.thoughtHistory : []);
    const currentThought = String(panel.thought || friend?.latestThought || '').trim();

    const history = source.map((item, index) => {
        const sourceItem = item && typeof item === 'object' ? item : {};
        const thought = String(sourceItem.thought ?? sourceItem.content ?? '').trim();
        const canEnrichCurrent = !hasStatusHistory
            && index === 0
            && thought
            && thought === currentThought;
        const readNumber = (key) => {
            if (typeof sourceItem[key] === 'number' && Number.isFinite(sourceItem[key])) {
                return sourceItem[key];
            }
            if (canEnrichCurrent && typeof panel[key] === 'number' && Number.isFinite(panel[key])) {
                return panel[key];
            }
            return null;
        };

        return {
            id: String(sourceItem.id || `status-${sourceItem.createdAt || sourceItem.time || index}`),
            thought,
            affection: readNumber('affection'),
            affectionChange: readNumber('affectionChange'),
            createdAt: sourceItem.createdAt || sourceItem.time || null,
            legacy: sourceItem.legacy === true || (!hasStatusHistory && !canEnrichCurrent)
        };
    }).filter(item => item.thought);

    if (history.length === 0 && currentThought) {
        history.push({
            id: `status-current-${friend?.id || 'friend'}`,
            thought: currentThought,
            affection: typeof panel.affection === 'number' ? panel.affection : 0,
            affectionChange: typeof panel.affectionChange === 'number' ? panel.affectionChange : 0,
            createdAt: null,
            legacy: false
        });
    }

    return history;
};

window.imApp.migrateSingleChatProfileStatus = function(friend = {}) {
    if (!friend || friend.type === 'group') return false;
    const legacyKeys = ['location', 'action', 'mood', 'expression'];
    let changed = false;
    const stripLegacyFields = (target) => {
        if (!target || typeof target !== 'object') return;
        legacyKeys.forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(target, key)) {
                delete target[key];
                changed = true;
            }
        });
    };

    const panel = friend.profilePanel;
    if (panel && typeof panel === 'object') {
        stripLegacyFields(panel);
        ['statusHistory', 'thoughtHistory'].forEach((historyKey) => {
            if (!Array.isArray(panel[historyKey])) return;
            panel[historyKey].forEach(stripLegacyFields);
        });
    }

    return changed;
};

window.imApp.createDefaultProfilePanel = function(friend = {}) {
    window.imApp.migrateSingleChatProfileStatus(friend);
    return {
        activeTab: 'thought',
        thought: friend?.profilePanel?.thought || friend?.latestThought || '',
        affection: typeof friend?.profilePanel?.affection === 'number' ? friend.profilePanel.affection : 0,
        affectionChange: typeof friend?.profilePanel?.affectionChange === 'number' ? friend.profilePanel.affectionChange : 0,
        status: friend?.profilePanel?.status || friend?.status || 'online',
        thoughtHistory: Array.isArray(friend?.profilePanel?.thoughtHistory) ? friend.profilePanel.thoughtHistory : [],
        statusHistory: window.imApp.normalizeProfileStatusHistory(friend),
        events: Array.isArray(friend?.profilePanel?.events)
            ? friend.profilePanel.events.map((eventItem, index) => ({
                id: eventItem?.id != null ? eventItem.id : `event-${index}`,
                title: eventItem?.title || '新的事件',
                description: eventItem?.description || '',
                time: eventItem?.time || '',
                type: eventItem?.type || 'note',
                status: eventItem?.status || 'pending',
                requestText: eventItem?.requestText || '',
                detail: eventItem?.detail || '',
                confirmText: eventItem?.confirmText || '确认',
                cancelText: eventItem?.cancelText || '取消',
                memoryPayload: eventItem?.memoryPayload && typeof eventItem.memoryPayload === 'object'
                    ? {
                        title: eventItem.memoryPayload.title || eventItem?.title || '珍视回忆',
                        content: eventItem.memoryPayload.content || eventItem?.requestText || eventItem?.description || '',
                        detail: eventItem.memoryPayload.detail || eventItem?.detail || '',
                        reason: eventItem.memoryPayload.reason || '',
                        sourceEventId: eventItem.memoryPayload.sourceEventId || (eventItem?.id != null ? eventItem.id : `event-${index}`),
                        createdAt: eventItem.memoryPayload.createdAt || eventItem?.time || '',
                        sourceThought: eventItem.memoryPayload.sourceThought || '',
                        triggerKeywords: Array.isArray(eventItem.memoryPayload.triggerKeywords)
                            ? eventItem.memoryPayload.triggerKeywords.map(keyword => String(keyword || '').trim()).filter(Boolean)
                            : []
                    }
                    : null
            }))
            : []
    };
};

window.imApp.normalizeFavoriteUserMessages = function(items) {
    const seenMessageIds = new Set();
    return (Array.isArray(items) ? items : [])
        .map((item, index) => {
            if (!item || typeof item !== 'object') return null;
            const messageId = String(item.messageId || '').trim();
            const messageText = String(item.messageText || '').trim();
            const reason = String(item.reason || '').trim();
            if (!messageId || !messageText || !reason || seenMessageIds.has(messageId)) return null;
            seenMessageIds.add(messageId);
            const createdAt = Math.max(0, Number(item.createdAt) || 0);
            const messageTimestamp = Math.max(0, Number(item.messageTimestamp) || 0);
            return {
                id: String(item.id || `favorite-${messageId}-${createdAt || index}`),
                messageId,
                messageText,
                messageType: item.messageType === 'voice_message' ? 'voice_message' : 'text',
                messageTimestamp,
                reason,
                createdAt,
                sourceApiRunId: String(item.sourceApiRunId || '')
            };
        })
        .filter(Boolean)
        .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
};

window.imApp.normalizeFriendData = function(friend) {
    const normalized = { ...friend };
    normalized.id = normalized.id != null ? normalized.id : Date.now();
    normalized.type = normalized.type || 'char';
    const isGroupChat = normalized.type === 'group';
    normalized.realName = normalized.realName || '';
    normalized.nickname = normalized.nickname || (normalized.type === 'npc' ? 'New NPC' : 'New Friend');
    normalized.signature = normalized.signature || 'No Signature';
    normalized.persona = normalized.persona || '';
    normalized.relationship = typeof normalized.relationship === 'string' ? normalized.relationship.trim() : '';
    normalized.avatarUrl = normalized.avatarUrl || null;
    normalized.avatarAssetId = normalized.avatarAssetId || null;
    normalized.imageFaceReferenceUrl = normalized.imageFaceReferenceUrl || null;
    normalized.imageFaceReferenceAssetId = normalized.imageFaceReferenceAssetId || null;
    normalized.imageFaceReferenceFileName = normalized.imageFaceReferenceFileName || '';
    const imagePromptConfig = normalized.imagePromptConfig && typeof normalized.imagePromptConfig === 'object'
        ? normalized.imagePromptConfig
        : {};
    const promptPresetIds = new Set();
    const promptPresets = (Array.isArray(imagePromptConfig.presets) ? imagePromptConfig.presets : [])
        .map((preset, index) => {
            if (!preset || typeof preset !== 'object') return null;
            const name = String(preset.name || '').trim().slice(0, 80);
            const prompt = String(preset.prompt || '').trim().slice(0, 8000);
            if (!name || !prompt) return null;
            const id = String(preset.id || `image-preset-${normalized.id}-${index}`).trim();
            if (!id || promptPresetIds.has(id)) return null;
            promptPresetIds.add(id);
            const createdAt = Math.max(0, Number(preset.createdAt) || Date.now());
            return {
                id,
                name,
                prompt,
                charAppearance: String(preset.charAppearance || '').trim().slice(0, 4000),
                userAppearance: String(preset.userAppearance || '').trim().slice(0, 4000),
                artistPrompt: String(preset.artistPrompt || '').trim().slice(0, 4000),
                negativePrompt: String(preset.negativePrompt || '').trim().slice(0, 4000),
                createdAt,
                updatedAt: Math.max(createdAt, Number(preset.updatedAt) || createdAt)
            };
        })
        .filter(Boolean)
        .slice(0, 30);
    const activePromptPresetId = promptPresetIds.has(String(imagePromptConfig.activePresetId || '').trim())
        ? String(imagePromptConfig.activePresetId).trim()
        : '';
    normalized.imagePromptConfig = {
        charAppearance: String(imagePromptConfig.charAppearance || '').trim().slice(0, 4000),
        userAppearance: String(imagePromptConfig.userAppearance || '').trim().slice(0, 4000),
        artistPrompt: String(imagePromptConfig.artistPrompt || '').trim().slice(0, 4000),
        negativePrompt: String(imagePromptConfig.negativePrompt || '').trim().slice(0, 4000),
        lastPrompt: String(imagePromptConfig.lastPrompt || '').trim().slice(0, 8000),
        activePresetId: activePromptPresetId,
        autoGenerate: imagePromptConfig.autoGenerate === true,
        autoUseReferenceFace: imagePromptConfig.autoUseReferenceFace === true
            && !!(normalized.imageFaceReferenceUrl || normalized.imageFaceReferenceAssetId),
        presets: promptPresets
    };
    normalized.messages = Array.isArray(normalized.messages) ? normalized.messages : [];
    normalized.language = String(normalized.language || 'zh').trim() || 'zh';
    const chatMessageRange = window.imDataUtils?.normalizeChatMessageRange
        ? window.imDataUtils.normalizeChatMessageRange(normalized.messageCountMin, normalized.messageCountMax, 2, 8)
        : {
            min: Math.min(20, Math.max(1, Math.round(Number(normalized.messageCountMin) || 2))),
            max: Math.min(20, Math.max(1, Math.round(Number(normalized.messageCountMax) || 8)))
        };
    normalized.messageCountMin = chatMessageRange.min;
    normalized.messageCountMax = Math.max(chatMessageRange.min, chatMessageRange.max);
    normalized.favoriteUserMessages = window.imApp.normalizeFavoriteUserMessages(normalized.favoriteUserMessages);
    normalized.anonymousQa = window.imGame?.normalizeAnonymousQaData
        ? window.imGame.normalizeAnonymousQaData(normalized.anonymousQa)
        : { entries: [] };
    normalized.chatBg = normalized.chatBg || null;
    normalized.chatBgAssetId = normalized.chatBgAssetId || null;
    normalized.customCssEnabled = !!normalized.customCssEnabled;
    normalized.customCss = normalized.customCss || '';
    normalized.chatCssEnabled = !!normalized.chatCssEnabled;
    normalized.chatCss = normalized.chatCss || '';
    normalized.statusCssEnabled = !!normalized.statusCssEnabled;
    normalized.statusCss = normalized.statusCss || '';
    normalized.isPinned = !!normalized.isPinned;
    normalized.unreadCount = Math.max(0, Number(normalized.unreadCount) || 0);
    normalized.showTimestamp = !!normalized.showTimestamp;
    normalized.timeAware = normalized.timeAware !== false;
    normalized.allowRoleRecall = normalized.allowRoleRecall !== false;
    // Group-derived private conversations are enabled by default so existing groups
    // keep their current behavior until the owner explicitly turns either off.
    normalized.allowGroupMemberPrivateChats = isGroupChat && normalized.allowGroupMemberPrivateChats !== false;
    normalized.allowGroupMemberFriendPrivateChats = isGroupChat && normalized.allowGroupMemberFriendPrivateChats !== false;
    normalized.autoExpandTranslation = normalized.autoExpandTranslation === true;
    normalized.showGroupUserAvatar = isGroupChat && normalized.showGroupUserAvatar === true;
    const cotDefaultVersion = Number(normalized.cotDefaultVersion) || 0;
    normalized.cotEnabled = cotDefaultVersion >= 2 && normalized.cotEnabled === true;
    normalized.cotDefaultVersion = 2;
    normalized.cotPrompt = typeof normalized.cotPrompt === 'string' ? normalized.cotPrompt : '';
    normalized.statusPromptEnabled = normalized.statusPromptEnabled === true;
    normalized.statusPrompt = typeof normalized.statusPrompt === 'string' ? normalized.statusPrompt : '';
    if (normalized.statusPrompt.trim() === '生成角色此刻没有说出口的心声。内容贴合本轮聊天、人设、关系进展和已绑定世界书。') {
        normalized.statusPrompt = window.imApp.DEFAULT_STATUS_PROMPT;
    }
    if (normalized.statusPromptEnabled && !normalized.statusPrompt.trim()) {
        normalized.statusPrompt = window.imApp.DEFAULT_STATUS_PROMPT;
    }
    normalized.offlineStreamEnabled = normalized.offlineStreamEnabled !== false;
    // Keep offline automatic images opt-in.  This is intentionally separate from
    // the normal-chat autoGenerate setting so enabling one surface never starts
    // image requests in the other.  Groups never participate in this flow.
    normalized.offlineAutoImageGeneration = !isGroupChat && normalized.offlineAutoImageGeneration === true;
    normalized.offlineRequestReasoning = true;
    normalized.offlineMaxResponseTokens = 30000;
    normalized.offlineMaxResponseTokensVersion = 2;
    normalized.dynamicActionNarrationEnabled = !!normalized.dynamicActionNarrationEnabled;
    normalized.timestampPosition = normalized.timestampPosition === 'outside' ? 'outside' : 'inside';
    normalized.boundBooks = Array.isArray(normalized.boundBooks) ? normalized.boundBooks : [];
    normalized.momentsCover = normalized.momentsCover || null;
    normalized.momentsCoverAssetId = normalized.momentsCoverAssetId || null;
    normalized.members = Array.isArray(normalized.members) ? normalized.members : [];
    normalized.leftGroupAt = isGroupChat ? (Number(normalized.leftGroupAt) || 0) : 0;
    normalized.groupObserverMode = isGroupChat
        && normalized.groupObserverMode === true
        && normalized.leftGroupAt > 0;
    normalized.leftGroupMemberSnapshot = isGroupChat && Array.isArray(normalized.leftGroupMemberSnapshot)
        ? normalized.leftGroupMemberSnapshot
            .filter(item => item && item.id != null)
            .map(item => ({
                id: item.id,
                nickname: item.nickname || '',
                realName: item.realName || ''
            }))
        : [];
    normalized.memberProfiles = (friend.memberProfiles && typeof friend.memberProfiles === 'object') ? friend.memberProfiles : {};
    normalized.botEnabled = !!normalized.botEnabled;
    // offlineMeetEnabled is deprecated
    normalized.offlineRegexScripts = Array.isArray(normalized.offlineRegexScripts) ? normalized.offlineRegexScripts : [];
    normalized.offlineSummarySettings = {
        apiPresetId: String(normalized.offlineSummarySettings?.apiPresetId || '').trim(),
        prompt: String(normalized.offlineSummarySettings?.prompt || '').trim().slice(0, 12000)
    };
    normalized.linkedAccountBot = window.imApp.normalizeLinkedAccountBot(normalized.linkedAccountBot);
    normalized.linkedAccountChats = window.imApp.normalizeLinkedAccountChats(normalized.linkedAccountChats);

    if (!isGroupChat && normalized.profilePanel && typeof normalized.profilePanel === 'object') {
        normalized.profilePanel = {
            ...normalized.profilePanel,
            statusHistory: Array.isArray(normalized.profilePanel.statusHistory)
                ? normalized.profilePanel.statusHistory.map(item => (item && typeof item === 'object' ? { ...item } : item))
                : normalized.profilePanel.statusHistory,
            thoughtHistory: Array.isArray(normalized.profilePanel.thoughtHistory)
                ? normalized.profilePanel.thoughtHistory.map(item => (item && typeof item === 'object' ? { ...item } : item))
                : normalized.profilePanel.thoughtHistory
        };
        if (window.imApp.migrateSingleChatProfileStatus(normalized)) {
            normalized._profileStatusNeedsPersistence = true;
        }
    }
    normalized.profilePanel = window.imApp.createDefaultProfilePanel(normalized);
    normalized.latestThought = normalized.profilePanel.thought;
    normalized.status = normalized.profilePanel.status || normalized.status || 'online';

    const defaultMemory = window.imApp.createDefaultMemory();
    const memory = normalized.memory || {};
    const recallPresentationSource = memory.recallPresentation && typeof memory.recallPresentation === 'object'
        ? memory.recallPresentation
        : null;
    const normalizeRecallPresentationEntries = (entries) => (Array.isArray(entries) ? entries : [])
        .filter(entry => entry && typeof entry === 'object')
        .slice(0, 100)
        .map(entry => ({ ...entry }));
    const normalizedRecallPresentation = recallPresentationSource
        && recallPresentationSource.apiRunId
        && recallPresentationSource.recall
        && typeof recallPresentationSource.recall === 'object'
        ? {
            apiRunId: String(recallPresentationSource.apiRunId),
            triggerUserMessageId: String(recallPresentationSource.triggerUserMessageId || ''),
            createdAt: Number(recallPresentationSource.createdAt) || 0,
            recall: {
                friendId: String(recallPresentationSource.recall.friendId || normalized.id || ''),
                isGroupChat: !!recallPresentationSource.recall.isGroupChat,
                shortTermEntries: normalizeRecallPresentationEntries(recallPresentationSource.recall.shortTermEntries),
                longTermEntries: normalizeRecallPresentationEntries(recallPresentationSource.recall.longTermEntries),
                cherishedEntries: normalizeRecallPresentationEntries(recallPresentationSource.recall.cherishedEntries)
            }
        }
        : null;
    const normalizedSchedule = window.imDataUtils?.normalizeSchedule
        ? window.imDataUtils.normalizeSchedule(memory.schedule)
        : {
            enabled: !!memory.schedule?.enabled,
            sleepTime: memory.schedule?.sleepTime || defaultMemory.schedule.sleepTime,
            wakeTime: memory.schedule?.wakeTime || defaultMemory.schedule.wakeTime,
            events: Array.isArray(memory.schedule?.events) ? memory.schedule.events : []
        };
    normalized.memory = {
        overview: memory.overview || defaultMemory.overview,
        anniversaries: memory.anniversaries || defaultMemory.anniversaries,
        schedule: normalizedSchedule,
        context: {
            enabled: typeof memory.context?.enabled === 'boolean' ? memory.context.enabled : defaultMemory.context.enabled,
            limit: Number(memory.context?.limit) > 0
                ? Number(memory.context.limit)
                : (isGroupChat ? 100 : defaultMemory.context.limit),
            notes: memory.context?.notes || defaultMemory.context.notes
        },
        recallLimits: window.imApp.normalizeMemoryRecallLimits(memory.recallLimits),
        summary: {
            enabled: typeof memory.summary?.enabled === 'boolean' ? memory.summary.enabled : defaultMemory.summary.enabled,
            limit: Number(memory.summary?.limit) > 0 ? Number(memory.summary.limit) : defaultMemory.summary.limit,
            roundLimit: window.imDataUtils?.normalizeRoundLimit
                ? window.imDataUtils.normalizeRoundLimit(memory.summary?.roundLimit, defaultMemory.summary.roundLimit)
                : (Number(memory.summary?.roundLimit) > 0 ? Math.round(Number(memory.summary.roundLimit)) : defaultMemory.summary.roundLimit),
            prompt: memory.summary?.prompt || defaultMemory.summary.prompt,
            apiPresetId: String(memory.summary?.apiPresetId || defaultMemory.summary.apiPresetId || '')
        },
        autonomous: window.imApp.normalizeAutonomousActivity(memory.autonomous),
        longTerm: memory.longTerm || defaultMemory.longTerm,
        shortTermEntries: Array.isArray(memory.shortTermEntries)
            ? memory.shortTermEntries.map((entry, index) => ({
                id: entry?.id != null ? entry.id : `shortterm-${index}`,
                title: entry?.title || '对话总结',
                time: entry?.time || entry?.createdAt || '',
                event: entry?.event || entry?.content || '',
                memoryPoints: entry?.memoryPoints || entry?.points || '',
                memoryTags: Array.isArray(entry?.memoryTags)
                    ? entry.memoryTags.map(tag => String(tag || '').trim()).filter(Boolean)
                    : [],
                degree: entry?.degree || '高',
                lastActivatedAt: entry?.lastActivatedAt || entry?.activatedAt || entry?.time || entry?.createdAt || '',
                triggerKeywords: Array.isArray(entry?.triggerKeywords)
                    ? entry.triggerKeywords.map(keyword => String(keyword || '').trim()).filter(Boolean)
                    : (Array.isArray(entry?.memoryTags)
                        ? entry.memoryTags.map(tag => String(tag || '').trim()).filter(Boolean)
                        : (entry?.keyword ? [String(entry.keyword).trim()] : [])),
                sourceType: String(entry?.sourceType || '').trim(),
                sourceId: String(entry?.sourceId || '').trim(),
                raw: entry?.raw || '',
                sourceCount: Math.max(0, Number(entry?.sourceCount) || 0),
                sourceRoundCount: Math.max(0, Number(entry?.sourceRoundCount) || 0),
                sourceStartMessageCount: Math.max(0, Number(entry?.sourceStartMessageCount) || 0),
                sourceEndMessageCount: Math.max(0, Number(entry?.sourceEndMessageCount) || 0)
            }))
            : defaultMemory.shortTermEntries,
        groupChatContexts: window.imDataUtils?.normalizeGroupChatContexts
            ? window.imDataUtils.normalizeGroupChatContexts(memory.groupChatContexts)
            : defaultMemory.groupChatContexts,
        longTermEntries: Array.isArray(memory.longTermEntries)
            ? memory.longTermEntries.map((entry, index) => ({
                id: entry?.id != null ? entry.id : `longterm-${index}`,
                title: entry?.title || '长期记忆',
                content: entry?.content || '',
                createdAt: entry?.createdAt || entry?.time || '',
                time: entry?.time || entry?.createdAt || '',
                sourceType: String(entry?.sourceType || '').trim(),
                sourceId: String(entry?.sourceId || '').trim(),
                triggerKeywords: Array.isArray(entry?.triggerKeywords)
                    ? entry.triggerKeywords.map(keyword => String(keyword || '').trim()).filter(Boolean)
                    : (entry?.keyword ? [String(entry.keyword).trim()] : [])
            }))
            : defaultMemory.longTermEntries,
        lastSummaryMessageCount: typeof memory.lastSummaryMessageCount === 'number' ? memory.lastSummaryMessageCount : 0,
        cherished: memory.cherished || defaultMemory.cherished,
        cherishedEntries: Array.isArray(memory.cherishedEntries)
            ? memory.cherishedEntries.map((entry, index) => ({
                id: entry?.id != null ? entry.id : `cherished-${index}`,
                title: entry?.title || '长期记忆',
                content: entry?.content || '',
                detail: entry?.detail || '',
                reason: entry?.reason || '',
                sourceEventId: entry?.sourceEventId || '',
                createdAt: entry?.createdAt || '',
                sourceThought: entry?.sourceThought || '',
                triggerKeywords: Array.isArray(entry?.triggerKeywords)
                    ? entry.triggerKeywords.map(keyword => String(keyword || '').trim()).filter(Boolean)
                    : (entry?.keyword ? [String(entry.keyword).trim()] : [])
            }))
            : defaultMemory.cherishedEntries,
        relationships: Array.isArray(memory.relationships) ? memory.relationships : defaultMemory.relationships,
        xDirectMessageMount: window.imApp.normalizeXDirectMessageMount(memory.xDirectMessageMount),
        recallPresentation: normalizedRecallPresentation,
        userOverride: memory.userOverride || null,
        mountSettings: (memory.mountSettings && typeof memory.mountSettings === 'object' && !Array.isArray(memory.mountSettings))
            ? { ...memory.mountSettings }
            : defaultMemory.mountSettings,
        mountLimits: (memory.mountLimits && typeof memory.mountLimits === 'object' && !Array.isArray(memory.mountLimits))
            ? Object.fromEntries(Object.entries(memory.mountLimits).map(([key, value]) => {
                const limit = Number(value);
                return [key, Number.isFinite(limit) && limit > 0 ? Math.max(1, Math.floor(limit)) : 20];
            }))
            : defaultMemory.mountLimits
    };

    return normalized;
};

window.imApp.applyGeneratedShortTermMemory = function(friend, entry, options = {}) {
    if (!friend || !entry) return null;
    friend.memory = window.imApp.normalizeFriendData(friend).memory;
    if (!Array.isArray(friend.memory.shortTermEntries)) friend.memory.shortTermEntries = [];

    const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
    const pad = value => String(value).padStart(2, '0');
    const nowString = options.nowString || `${now.getFullYear()}年${pad(now.getMonth() + 1)}月${pad(now.getDate())}日 ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const activatedIds = new Set((Array.isArray(options.activatedEntryIds) ? options.activatedEntryIds : [])
        .map(String)
        .filter(Boolean));
    const parseMemoryDate = (value) => {
        if (!value) return null;
        if (typeof value === 'number') {
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? null : date;
        }
        const normalized = String(value).trim()
            .replace(/年/g, '-')
            .replace(/月/g, '-')
            .replace(/日/g, ' ')
            .replace(/\./g, '-')
            .replace(/\//g, '-');
        const date = new Date(normalized);
        return Number.isNaN(date.getTime()) ? null : date;
    };

    friend.memory.shortTermEntries.forEach((existing) => {
        if (!existing) return;
        if (activatedIds.has(String(existing.id))) {
            existing.degree = '高';
            existing.lastActivatedAt = nowString;
            return;
        }
        const anchorDate = parseMemoryDate(existing.lastActivatedAt || existing.time || existing.createdAt || '');
        if (!anchorDate) return;
        const ageDays = (now.getTime() - anchorDate.getTime()) / (24 * 60 * 60 * 1000);
        if (ageDays > 30) existing.degree = '遗忘';
        else if (ageDays > 7) existing.degree = '低';
        else if (ageDays > 1 && existing.degree === '高') existing.degree = '中';
    });

    const normalizedEntry = {
        ...entry,
        id: entry.id || `stm-${Date.now()}`,
        time: entry.time || nowString,
        degree: '高',
        lastActivatedAt: nowString,
        sourceType: String(entry.sourceType || '').trim(),
        sourceId: String(entry.sourceId || '').trim()
    };
    const sourceIndex = normalizedEntry.sourceType && normalizedEntry.sourceId
        ? friend.memory.shortTermEntries.findIndex(existing => (
            String(existing?.sourceType || '') === normalizedEntry.sourceType
            && String(existing?.sourceId || '') === normalizedEntry.sourceId
        ))
        : -1;
    if (sourceIndex >= 0) {
        normalizedEntry.id = friend.memory.shortTermEntries[sourceIndex]?.id || normalizedEntry.id;
        friend.memory.shortTermEntries[sourceIndex] = {
            ...friend.memory.shortTermEntries[sourceIndex],
            ...normalizedEntry
        };
    } else {
        friend.memory.shortTermEntries.push(normalizedEntry);
    }

    if (options.updateSummaryCursor !== false) {
        friend.memory.lastSummaryMessageCount = Number(entry.sourceEndMessageCount)
            || (Array.isArray(friend.messages) ? friend.messages.length : 0);
    }
    return normalizedEntry;
};

window.imApp.commitShortTermMemoryPromotion = async function(friendOrId, draft, sourceEntryIds) {
    const friend = window.imApp.getFriendById(friendOrId);
    const selectedIds = Array.from(new Set((Array.isArray(sourceEntryIds) ? sourceEntryIds : [])
        .map(value => String(value || '').trim())
        .filter(Boolean)));
    if (!friend || selectedIds.length === 0 || !draft || typeof draft !== 'object') return false;

    const normalizeTags = value => (window.imChat?.normalizeMemoryTriggerKeywords
        ? window.imChat.normalizeMemoryTriggerKeywords(value)
        : (Array.isArray(value) ? value : [value])
            .map(item => String(item || '').trim())
            .filter(Boolean)
            .slice(0, 6));
    const title = String(draft.title || '').trim() || '长期记忆';
    const content = String(draft.content || '').trim();
    const time = String(draft.time || '').trim();
    const triggerKeywords = normalizeTags(draft.triggerKeywords || draft.memoryTags || []);
    if (!content) return false;

    const promotionId = `promoted-ltm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const saved = await window.imApp.commitScopedFriendChange(friend, targetFriend => {
        targetFriend.memory = window.imApp.normalizeFriendData(targetFriend).memory;
        const shortTermEntries = Array.isArray(targetFriend.memory.shortTermEntries)
            ? targetFriend.memory.shortTermEntries
            : [];
        const selectedEntries = shortTermEntries.filter(entry => selectedIds.includes(String(entry?.id || '')));
        if (selectedEntries.length !== selectedIds.length) {
            throw new Error('Selected short-term memories are no longer available');
        }
        if (!Array.isArray(targetFriend.memory.longTermEntries)) targetFriend.memory.longTermEntries = [];
        targetFriend.memory.longTermEntries.push({
            id: promotionId,
            title,
            content,
            time: time || new Date().toISOString(),
            createdAt: time || new Date().toISOString(),
            triggerKeywords,
            sourceType: 'manual',
            sourceId: promotionId,
            promotedFromShortTermIds: selectedIds
        });
        targetFriend.memory.shortTermEntries = shortTermEntries.filter(entry => !selectedIds.includes(String(entry?.id || '')));
        // Promotion is an archival operation, not a summary deletion: retain the existing cursor.
        targetFriend.memory.recallPresentation = null;
        window.imApp.clearFriendRuntimeMessageContext?.(targetFriend);
    }, { silent: true, immediate: true, syncActive: true, syncSettings: true });

    if (!saved) return false;
    window.dispatchEvent(new CustomEvent('u2:memory-entries-updated', {
        detail: {
            friendId: String(friend.id),
            action: 'promote',
            collection: 'longTermEntries',
            entryId: promotionId,
            removedShortTermEntryIds: selectedIds
        }
    }));
    return { id: promotionId };
};

window.imApp.createGroupMemberSnapshot = function(group) {
    if (!group || group.type !== 'group') return [];
    const memberIds = Array.isArray(group.members) ? group.members : [];
    return memberIds.map((memberId) => {
        const member = (window.imData?.friends || []).find(item => String(item.id) === String(memberId));
        return {
            id: memberId,
            nickname: member?.nickname || '',
            realName: member?.realName || ''
        };
    });
};

window.imApp.getContextLimit = function(friend) {
    const normalizedFriend = window.imApp.normalizeFriendData(friend || {});
    const defaultContextLimit = normalizedFriend.type === 'group' ? 100 : 50;

    if (normalizedFriend.memory?.context?.enabled === false) {
        return 0;
    }

    return Number(normalizedFriend.memory?.context?.limit) > 0
        ? Number(normalizedFriend.memory.context.limit)
        : defaultContextLimit;
};

window.imApp.getRecentContextMessages = function(friend) {
    const normalizedFriend = window.imApp.normalizeFriendData(friend || {});
    const contextLimit = window.imApp.getContextLimit(normalizedFriend);
    const allMessages = Array.isArray(normalizedFriend.messages) ? normalizedFriend.messages : [];
    if (contextLimit <= 0 || allMessages.length === 0) return [];

    if (normalizedFriend.type === 'group') {
        return allMessages.slice(-contextLimit);
    }

    const boundedStartIndex = Math.max(0, allMessages.length - contextLimit);
    let roundStartIndex = -1;

    // Preserve the leading user message so an included Char reply never starts mid-turn.
    for (let index = boundedStartIndex; index >= 0; index -= 1) {
        if (allMessages[index]?.role === 'user') {
            roundStartIndex = index;
            break;
        }
    }

    return roundStartIndex >= 0
        ? allMessages.slice(roundStartIndex)
        : allMessages.slice(-contextLimit);
};

window.imApp.formatOfflineMeetingRecordForContext = function(message, options = {}) {
    if (!message || message.type !== 'offline_meeting_record') return '';
    const includeTime = options?.includeTime !== false;
    const dateText = String(message.dateText || '').trim() || '未知';
    const title = String(message.title || '').trim() || '见面记录';
    const summary = String(message.summary || message.content || '').trim();
    if (!summary) return '';
    return [
        '<offline_meeting>',
        includeTime ? `<ended_at>${dateText}</ended_at>` : '',
        `<title>${title}</title>`,
        `<summary>${summary}</summary>`,
        '</offline_meeting>'
    ].join('\n');
};

window.imApp.buildOfflineMeetingContext = function(friend, options = {}) {
    const includeTime = options?.includeTime !== false;
    const excludedRecord = options && typeof options === 'object'
        ? options.excludeRecord
        : null;
    const excludedId = String(excludedRecord?.id || '').trim();
    const excludedSessionId = String(excludedRecord?.offlineSessionId || '').trim();
    const excludedTimestamp = Number(excludedRecord?.timestamp) || 0;
    const isExcludedRecord = (message) => {
        if (!excludedRecord || !message) return false;
        if (excludedId && String(message.id || '') === excludedId) return true;
        if (excludedSessionId && String(message.offlineSessionId || '') === excludedSessionId) return true;
        return !excludedId && !excludedSessionId
            && excludedTimestamp > 0
            && Number(message.timestamp) === excludedTimestamp;
    };
    const records = window.imApp.getRecentContextMessages(friend)
        .filter(message => message?.type === 'offline_meeting_record' && !isExcludedRecord(message))
        .map(message => window.imApp.formatOfflineMeetingRecordForContext(message, { includeTime }))
        .filter(Boolean);
    if (records.length === 0) return '';
    return `<offline_meeting_context>\n${records.join('\n')}\n</offline_meeting_context>\nUse these completed face-to-face meeting summaries as known history for the current online chat.`;
};

window.imApp.getGroupChatMemoryCandidates = function(friend) {
    const normalizedFriend = window.imApp.normalizeFriendData(friend || {});
    if (!normalizedFriend || normalizedFriend.type === 'group' || normalizedFriend.type === 'official') return [];

    return (window.imData?.friends || []).filter((group) => {
        if (!group || group.type !== 'group' || !Array.isArray(group.members)) return false;
        const isDirectMember = group.members.some(memberRef => (
            String(memberRef) === String(normalizedFriend.id)
            || String(memberRef) === String(normalizedFriend.nickname)
            || String(memberRef) === String(normalizedFriend.realName)
        ));
        const isResolvedMember = window.imChat?.getGroupMemberFriends
            ? window.imChat.getGroupMemberFriends(group)
                .some(member => String(member?.id) === String(normalizedFriend.id))
            : false;
        return isDirectMember || isResolvedMember;
    });
};

window.imApp.getEligibleGroupChatMemoryContexts = function(friend) {
    const normalizedFriend = window.imApp.normalizeFriendData(friend || {});
    const contexts = window.imDataUtils?.normalizeGroupChatContexts
        ? window.imDataUtils.normalizeGroupChatContexts(normalizedFriend.memory?.groupChatContexts)
        : [];
    const groupsById = new Map(window.imApp.getGroupChatMemoryCandidates(normalizedFriend)
        .map(group => [String(group.id), group]));

    return contexts
        .map(context => ({ ...context, group: groupsById.get(String(context.groupId)) || null }))
        .filter(context => context.group);
};

window.imApp.loadEligibleGroupChatMemoryContexts = async function(friend) {
    const initialContexts = window.imApp.getEligibleGroupChatMemoryContexts(friend);
    if (initialContexts.length === 0) return [];

    if (window.imApp.ensureFriendMessagesLoaded) {
        await Promise.all(initialContexts.map(({ group }) => window.imApp.ensureFriendMessagesLoaded(group)));
    }

    const liveFriend = window.imApp.getFriendById(friend) || friend;
    return window.imApp.getEligibleGroupChatMemoryContexts(liveFriend);
};

window.imApp.isRecallableUserMessage = function(message) {
    if (!message || message.role !== 'user') return false;
    const blockedTypes = new Set([
        'system_notice',
        'pay_transfer',
        'group_red_packet',
        'group_poll',
        'voice_call_record',
        'offline_meeting_record',
        'html'
    ]);
    return !blockedTypes.has(String(message.type || '').trim());
};

window.imApp.createRecalledNoticeMessage = function(originalMessage, options = {}) {
    const original = originalMessage && typeof originalMessage === 'object' ? originalMessage : {};
    const actorRole = options.actorRole === 'user' ? 'user' : 'assistant';
    const actorName = String(options.actorName || '').trim();
    const timestamp = Number(options.timestamp || original.timestamp) || Date.now();
    const notice = {
        id: original.id || options.id || (window.imChat?.createMessageId ? window.imChat.createMessageId('notice') : `notice_${timestamp}`),
        role: 'system',
        type: 'system_notice',
        noticeKind: 'message_recalled',
        actorRole,
        actorName,
        content: actorRole === 'user' ? '你撤回了一条消息' : `${actorName || '对方'}撤回了一条消息`,
        timestamp
    };

    if (actorRole !== 'user' && typeof options.recalledContent === 'string' && options.recalledContent.trim()) {
        notice.payload = {
            recalledContent: options.recalledContent.trim(),
            recalledTranslation: typeof options.recalledTranslation === 'string'
                ? options.recalledTranslation.trim()
                : ''
        };
    }
    if (options.apiRunId) notice.apiRunId = options.apiRunId;
    return notice;
};

window.imApp.formatSystemNoticeForApiContext = function(message) {
    const normalizedMessage = message || {};
    const noticeKind = normalizedMessage.noticeKind || '';
    const noticeText = normalizedMessage.content || normalizedMessage.text || '';

    if (noticeKind === 'group_left') {
        return '[系统事件：User 已退出群聊。]';
    }
    if (noticeKind === 'group_rejoined') {
        return '[系统事件：User 重新进入群聊。]';
    }
    if (noticeKind === 'narration') {
        const narrationSource = normalizedMessage.narrationSource === 'dynamic_action'
            ? 'narrator_dynamic_action'
            : 'scene_director';
        return `<SCENE_NARRATION source="${narrationSource}" attribution="none">
content_json: ${JSON.stringify(String(noticeText || ''))}
interpretation_rules:
- This is an out-of-character scene narration event, not a message, spoken line, inner thought, intention, or automatically performed action from User.
- Do not reply as though User said this text. Do not attribute it to User or any character unless the narration explicitly names that character as the actor.
- If the narration explicitly states that a named character performed an action, treat that action as an already established scene fact and continue from its result.
- Preserve this event's chronological place in the scene and continue the story from it.
</SCENE_NARRATION>`;
    }
    if (noticeKind === 'offline_meeting_active') {
        return '';
    }
    if (noticeKind === 'group_private_to_user') {
        return '[系统事件：有群成员向 User 发送了私信。其他群成员默认不知道私信内容。]';
    }
    if (noticeKind === 'group_friend_private_chat') {
        return '[系统事件：有群成员与自己的好友进行了私聊。私聊内容只属于该成员，其他群成员默认不知道。]';
    }
    if (noticeKind === 'message_recalled') {
        if (normalizedMessage.actorRole === 'user') {
            return '[系统事件：User 撤回了一条消息。你只知道发生了撤回，无法读取被撤回的原文。]';
        }
        const actorName = String(normalizedMessage.actorName || '').trim();
        return actorName
            ? `[系统事件：${actorName} 撤回了一条消息。]`
            : '[系统事件：你撤回了一条消息。]';
    }

    return noticeText ? `[系统事件：${noticeText}]` : '[系统事件]';
};

window.imApp.stripFakeLinkHtmlForApiContext = function(value, maxLength = 20000) {
    return String(value == null ? '' : value)
        .replace(/<\s*(script|style|iframe|object|embed|svg|canvas)[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#039;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, Math.max(1000, Number(maxLength) || 20000));
};

window.imApp.formatFakeLinkMessageForApiContext = function(message, options = {}) {
    const normalizedMessage = message || {};
    const fakeLinkData = normalizedMessage.fakeLinkData && typeof normalizedMessage.fakeLinkData === 'object'
        ? normalizedMessage.fakeLinkData
        : {};
    const displayUrl = String(fakeLinkData.displayUrl || fakeLinkData.canonicalUrl || normalizedMessage.content || '').trim();
    const platformLabel = String(fakeLinkData.siteName || fakeLinkData.domain || '假网页').trim();
    const title = String(fakeLinkData.title || displayUrl || '未命名假网页').trim();
    const description = String(fakeLinkData.summary || '').trim();
    const webPage = fakeLinkData.webPage && typeof fakeLinkData.webPage === 'object' ? fakeLinkData.webPage : null;
    const pageHtmlText = webPage && webPage.html
        ? window.imApp.stripFakeLinkHtmlForApiContext(webPage.html, options.maxLinkBodyChars || 20000)
        : '';
    const bodyText = String(fakeLinkData.bodyText || fakeLinkData.pageText || pageHtmlText || '').trim();
    const webTheme = webPage ? String(webPage.theme || '').trim() : '';
    const expandContent = options.expandLinkContent !== false;
    const maxBodyChars = Math.max(1000, Number(options.maxLinkBodyChars) || 20000);
    const fakeLines = [
        '[User 分享了一个站内假网页]',
        '站点：' + platformLabel,
        '标题：' + title,
        '显示地址：' + displayUrl
    ];
    if (description) fakeLines.push('摘要：' + description);
    if (!bodyText) {
        fakeLines.push('正文状态：用户未填写正文，只能参考标题、域名和摘要。');
        return fakeLines.join('\n');
    }
    if (!expandContent) {
        fakeLines.push('页面摘要：' + (description || bodyText.slice(0, 500)));
        fakeLines.push('正文状态：这是较早的假网页记录，本轮只保留摘要。');
        return fakeLines.join('\n');
    }
    const fakeInjectedBody = bodyText.slice(0, maxBodyChars);
    fakeLines.push('页面正文：\n' + fakeInjectedBody);
    if (bodyText.length > fakeInjectedBody.length) {
        fakeLines.push('正文状态：内容过长，已截断。');
    }
    return fakeLines.join('\n');
};

window.imApp.formatMessageForApiContext = function(message, friend, options = {}) {
    const normalizedFriend = window.imApp.normalizeFriendData(friend || {});
    const normalizedMessage = message || {};
    const isGroupChat = normalizedFriend.type === 'group';
    let apiContent = normalizedMessage.content || '';

    if (normalizedMessage.type === 'system_notice') {
        return {
            role: 'system',
            content: window.imApp.formatSystemNoticeForApiContext(normalizedMessage)
        };
    }

    if (normalizedMessage.type === 'chat_record_forward') {
        apiContent = window.imApp.formatChatRecordForwardForApiContext
            ? window.imApp.formatChatRecordForwardForApiContext(normalizedMessage)
            : '[User 转发了一份聊天记录]';
    } else if (normalizedMessage.type === 'group_poll') {
        const pollOptions = Array.isArray(normalizedMessage.pollOptions) ? normalizedMessage.pollOptions : [];
        const pollVotes = Array.isArray(normalizedMessage.pollVotes) ? normalizedMessage.pollVotes : [];
        const optionById = new Map(pollOptions.map(option => [String(option?.id || ''), String(option?.text || '')]));
        const voteLines = pollVotes.map(vote => {
            const voterName = String(vote?.voterName || vote?.voterId || '未知成员');
            const optionText = optionById.get(String(vote?.optionId || '')) || '未知选项';
            return `${voterName} → ${optionText}`;
        });
        apiContent = [
            `[User 发起了一项公开单选群投票：${normalizedMessage.pollQuestion || '未命名投票'}]`,
            `选项：${pollOptions.map(option => option?.text || '').filter(Boolean).join(' / ') || '无'}`,
            `投票结果：${voteLines.length > 0 ? voteLines.join('；') : '暂时无人投票'}`,
            normalizedMessage.pollStatus === 'pending' ? '角色投票仍在进行中。' : ''
        ].filter(Boolean).join('\n');
    } else if (normalizedMessage.type === 'fake_link') {
        apiContent = window.imApp.formatFakeLinkMessageForApiContext(normalizedMessage, options);
    } else if (normalizedMessage.type === 'voice_message') {
        const voiceText = normalizedMessage.transcript || normalizedMessage.text || '';
        apiContent = normalizedMessage.role === 'user'
            ? `[用户发了一条语音消息，语音内容：${voiceText}]`
            : `[你发了一条语音消息，语音内容：${voiceText}]`;
    } else if (normalizedMessage.type === 'sticker') {
        const stickerName = normalizedMessage.stickerName || normalizedMessage.text || '表情包';
        const stickerCategory = normalizedMessage.stickerCategory || '';
        const stickerLabel = stickerCategory ? `${stickerCategory} / ${stickerName}` : stickerName;
        apiContent = normalizedMessage.role === 'user'
            ? `[用户发了一个表情包：${stickerLabel}]`
            : `[你发了一个表情包：${stickerLabel}]`;
    } else if (normalizedMessage.type === 'offline_meeting_record') {
        const dateText = normalizedMessage.dateText || '';
        const title = normalizedMessage.title || '见面记录';
        const summary = normalizedMessage.summary || normalizedMessage.content || '';
        return {
            role: 'system',
            content: `[见面记录]\n结束时间：${dateText || '未知'}\n标题：${title}\n总结：${summary}\n（该线下见面已经结束，请将这份总结作为后续线上聊天上下文。）`
        };
    } else if (normalizedMessage.type === 'voice_call_record') {
        const duration = normalizedMessage.duration || 0;
        const callDurationText = `${Math.floor(duration / 60)}分${duration % 60}秒`;
        const callMessages = normalizedMessage.callMessages || [];
        const statusText = normalizedMessage.statusText || '通话记录';
        
        if (statusText === '已拒绝') {
            apiContent = `[提示：${normalizedMessage.isSelf ? '对方' : '你'}刚刚拒绝了这通语音通话。]`;
        } else if (statusText === '已取消') {
            apiContent = `[提示：${normalizedMessage.isSelf ? '你' : '对方'}刚刚取消了这通语音通话。]`;
        } else {
            if (callMessages.length > 0) {
                const userName = options.userName || window.userState?.name || 'User';
                const charName = normalizedFriend.nickname || '对方';
                const callTranscript = callMessages.map(m => {
                    const speaker = m.isSelf ? userName : charName;
                    const parts = [];
                    if (m.actionText) parts.push(String(m.actionText).trim());
                    if (m.thoughtText) parts.push(`心声：${String(m.thoughtText).trim()}`);
                    if (m.text) parts.push(`${speaker}：「${String(m.text).trim()}」`);
                    return parts.join('\n  ');
                }).filter(Boolean).join('\n  ');
                
                apiContent = `[提示：你们刚刚完成了一通语音通话，时长 ${callDurationText}。通话期间的交流内容如下：\n  ${callTranscript}\n（通话已结束，请直接用普通文字回复）]`;
            } else {
                apiContent = `[提示：你们刚刚完成了一通语音通话，时长 ${callDurationText}，未产生可识别的文本记录。（通话已结束，请直接用普通文字回复）]`;
            }
        }
    } else if (normalizedMessage.type === 'moment_forward') {
        try {
            const momentData = JSON.parse(normalizedMessage.content);
            const momentText = momentData.text || '无配文';
            apiContent = `[转发了一条朋友圈, 内容: "${momentText}"]`;
            if (momentData.img) {
                if (momentData.imgDesc) {
                    apiContent += ` (附带图片: ${momentData.imgDesc})`;
                } else {
                    apiContent += ` (附带图片)`;
                }
            }
        } catch (e) {
            apiContent = `[转发了一条朋友圈]`;
        }
    } else if (normalizedMessage.type === 'image') {
        const imageDescription = normalizedMessage.text || normalizedMessage.description || normalizedMessage.fileName || '无描述';
        apiContent = `[发送了一张图片：${imageDescription}]`;
    } else if (normalizedMessage.type === 'pay_transfer') {
        const payAmount = Number(normalizedMessage.amount) || 0;
        const payDesc = normalizedMessage.description || '转账';
        const payTarget = normalizedMessage.targetName || normalizedFriend.nickname || '对方';

        if (normalizedMessage.payKind === 'user_to_char') {
            apiContent = `[用户刚刚向你转账 ¥${payAmount.toFixed(2)}，备注：${payDesc}，对象：${payTarget}。你可以收下这笔钱，也可以退回，或者正常回复。]`;
        } else if (normalizedMessage.payKind === 'char_received') {
            apiContent = `[你刚刚收下了用户的一笔转账 ¥${payAmount.toFixed(2)}，备注：${payDesc}。]`;
        } else if (normalizedMessage.payKind === 'char_to_user_pending') {
            apiContent = `[你刚刚向用户发起了一笔转账 ¥${payAmount.toFixed(2)}，备注：${payDesc}，等待用户领取。]`;
        } else if (normalizedMessage.payKind === 'char_to_user_claimed' || normalizedMessage.payKind === 'user_received_from_char') {
            apiContent = `[用户已领取你的转账 ¥${payAmount.toFixed(2)}，备注：${payDesc}。]`;
        } else if (normalizedMessage.payKind === 'user_rejected_from_char') {
            apiContent = `[用户退回了你的转账 ¥${payAmount.toFixed(2)}，备注：${payDesc}。]`;
        } else if (normalizedMessage.payKind === 'char_to_user_rejected' || normalizedMessage.payKind === 'user_to_char_rejected') {
            apiContent = `[你刚刚退回了用户的转账 ¥${payAmount.toFixed(2)}，备注：${payDesc}。]`;
        }
    }

    if (isGroupChat) {
        const userName = String(
            normalizedMessage.userIdentity?.name
            || options.userName
            || window.imApp.getGroupUserIdentity(normalizedFriend).name
            || 'User'
        ).trim() || 'User';
        if (normalizedMessage.role === 'user') {
            if (normalizedMessage.replyTo) {
                apiContent = `[引用了消息："${normalizedMessage.replyTo}"]\n${apiContent}`;
            }
            return {
                role: 'user',
                content: `User(${userName}): ${apiContent}`
            };
        }

        const assistantSpeaker = typeof normalizedMessage.speaker === 'string' && normalizedMessage.speaker.trim()
            ? normalizedMessage.speaker.trim()
            : '群成员';

        if (normalizedMessage.replyTo) {
            apiContent = `[引用了消息："${normalizedMessage.replyTo}"]\n${apiContent}`;
        }

        return {
            role: 'assistant',
            content: `${assistantSpeaker}: ${apiContent}`
        };
    }

    if (normalizedMessage.role === 'user' && normalizedMessage.replyTo) {
        apiContent = `[用户引用了消息："${normalizedMessage.replyTo}"]\n${apiContent}`;
    }

    return {
        role: normalizedMessage.role,
        content: apiContent
    };
};

window.imApp.buildApiContextMessages = function(friend, options = {}) {
    const normalizedFriend = window.imApp.normalizeFriendData(friend || {});
    const recentMessages = window.imApp.getRecentContextMessages(normalizedFriend);
    let latestLinkIndex = -1;
    recentMessages.forEach((message, index) => {
        if (message && message.type === 'fake_link') latestLinkIndex = index;
    });

    return recentMessages
        .filter(message => !(options.excludeOfflineMeetingRecords && message?.type === 'offline_meeting_record'))
        .map((message, index) => {
            const formattedMessage = window.imApp.formatMessageForApiContext(message, normalizedFriend, {
                ...options,
                expandLinkContent: message && message.type === 'fake_link' ? index === latestLinkIndex : options.expandLinkContent
            });
            if (!formattedMessage || !options.includeContextMetadata) return formattedMessage;

            return {
                ...formattedMessage,
                _contextMessageId: String(message?.id || ''),
                _contextTimestamp: Number(message?.timestamp) || 0
            };
        })
        .filter(item => item && item.role && typeof item.content === 'string' && item.content.trim());
};

window.imApp.buildLinkedAccountMemoryContext = function(friend, options = {}) {
    const normalizedFriend = window.imApp.normalizeFriendData(friend || {});
    const linkedChats = Array.isArray(normalizedFriend.linkedAccountChats)
        ? normalizedFriend.linkedAccountChats
        : [];
    if (linkedChats.length === 0) return '';

    const charName = normalizedFriend.nickname || normalizedFriend.realName || 'Char';
    const includeTime = options?.includeTime !== false;
    const maxMessagesPerFriend = Math.max(1, Number(options.maxMessagesPerFriend) || 4);
    const formatLinkedMessageTime = (timestamp) => {
        const value = Number(timestamp) || 0;
        if (!value) return '未知时间';
        const date = new Date(value);
        const pad = number => String(number).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };
    const lines = [
        'Linked Friend Memory / 关联好友记忆:',
        'These are private friend chats belonging to the character. They are context about the character\'s own friends, not messages from the current User.'
    ];

    linkedChats.forEach((chat, index) => {
        const displayName = chat.remark || chat.name || chat.realName || `Friend ${index + 1}`;
        const realName = chat.realName || chat.name || displayName;
        const recentMessages = Array.isArray(chat.messages)
            ? chat.messages.slice(-maxMessagesPerFriend)
            : [];

        lines.push('');
        lines.push(`Friend ${index + 1}: ${displayName}`);
        lines.push(`Real Name: ${realName || 'Unknown'}`);
        lines.push(`Remark: ${chat.remark || displayName || 'None'}`);
        lines.push(`Relationship: ${chat.relationship || 'None'}`);
        lines.push(`Persona: ${chat.persona || 'None'}`);
        lines.push('Recent private messages, fixed to the latest 2 rounds:');
        if (recentMessages.length === 0) {
            lines.push('None');
        } else {
            recentMessages.forEach(message => {
                const speaker = message.role === 'char' ? charName : displayName;
                const timePrefix = includeTime ? `[${formatLinkedMessageTime(message.timestamp)}] ` : '';
                lines.push(`${timePrefix}${speaker}: ${message.text || ''}`);
            });
        }
    });

    return lines.join('\n');
};

window.imApp.getXDirectMessageMountCandidates = function(friendOrId) {
    const friendId = window.imApp.resolveFriendId(friendOrId);
    if (friendId == null) return [];

    const xState = typeof window.getAppState === 'function'
        ? window.getAppState('x')
        : window.__xFallbackState;
    const directMessages = Array.isArray(xState?.xDirectMessages) ? xState.xDirectMessages : [];

    const getMessageText = (message) => {
        if (!message || typeof message !== 'object') return '';
        if (message.type === 'post-card') {
            const post = message.postSnapshot || message.post || {};
            return `[X Post] ${String(post.text || post.content || '').trim()}`.trim();
        }
        return String(message.text || message.content || message.message || '').trim();
    };

    return directMessages
        .filter(item => item && String(item.sourceFriendId || '') === String(friendId))
        .map((item, index) => {
            const messages = Array.isArray(item.messages) ? item.messages : [];
            const lastMessage = messages[messages.length - 1] || null;
            const lastTimestamp = Number(lastMessage?.createdAt || lastMessage?.timestamp || item.updatedAt || item.addedAt) || 0;
            return {
                id: String(item.id || ''),
                name: String(item.name || item.nickname || item.realName || 'X Char'),
                handle: String(item.handle || ''),
                messages,
                messageCount: messages.length,
                lastMessageText: getMessageText(lastMessage),
                updatedAt: lastTimestamp,
                index
            };
        })
        .filter(item => item.id)
        .sort((left, right) => right.updatedAt - left.updatedAt || left.index - right.index);
};

window.imApp.buildXDirectMessageMemoryContext = function(friend, options = {}) {
    const normalizedFriend = window.imApp.normalizeFriendData(friend || {});
    if (normalizedFriend.type === 'group') return '';

    const mount = window.imApp.normalizeXDirectMessageMount(normalizedFriend.memory?.xDirectMessageMount);
    if (!mount.enabled) return '';

    const mountCandidates = window.imApp.getXDirectMessageMountCandidates(normalizedFriend);
    const mountedThread = mountCandidates.find(item => item.id === mount.dmId)
        || (!mount.dmId ? mountCandidates[0] : null);
    if (!mountedThread) return '';

    const requestedLimit = Number(options.maxMessages);
    const includeTime = options?.includeTime !== false;
    const limit = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(50, Math.floor(requestedLimit)))
        : mount.limit;
    const charName = normalizedFriend.nickname || normalizedFriend.realName || 'Char';
    const xCharName = mountedThread.name || 'X Char';
    const sanitize = (value) => String(value == null ? '' : value)
        .replace(/[<>]/g, character => character === '<' ? '‹' : '›')
        .slice(0, 800);
    const formatTime = (value) => {
        const timestamp = Number(value) || 0;
        if (!timestamp) return 'Unknown time';
        const date = new Date(timestamp);
        const pad = number => String(number).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };
    const formatMessage = (message) => {
        if (!message || typeof message !== 'object') return '';
        const isPostCard = message.type === 'post-card';
        const post = isPostCard ? (message.postSnapshot || message.post || {}) : null;
        const rawText = isPostCard
            ? `[X Post] ${post?.name || ''} ${post?.text || post?.content || ''}`
            : (message.text || message.content || message.message || '');
        const text = sanitize(rawText).trim();
        if (!text) return '';
        const speaker = message.source === 'user' || message.sender === 'user' ? 'User' : xCharName;
        const timePrefix = includeTime ? `[${formatTime(message.createdAt || message.timestamp)}] ` : '';
        return `${timePrefix}${speaker}: ${text}`;
    };
    const xState = typeof window.getAppState === 'function'
        ? window.getAppState('x')
        : window.__xFallbackState;
    const directMessages = Array.isArray(xState?.xDirectMessages) ? xState.xDirectMessages : [];
    const allXPosts = Array.isArray(xState?.xGeneratedPosts) ? xState.xGeneratedPosts : [];
    const rawMountedThread = directMessages.find(item => String(item?.id || '') === String(mountedThread.id)) || {};
    const normalizeIdentity = value => String(value == null ? '' : value)
        .split('·')[0]
        .trim()
        .replace(/^@/, '')
        .toLocaleLowerCase();
    const getPostTimestamp = post => Number(post?.createdAt || post?.timestamp || post?.publishedAt || 0) || 0;
    const getPostText = post => String(post?.text || post?.content || '').trim();
    const getPostAuthorHandle = post => normalizeIdentity(post?.handle || post?.authorHandle || post?.accountHandle);
    const getPostAuthorName = post => String(post?.authorName || post?.name || post?.displayName || '').trim();
    const currentUserHandle = normalizeIdentity(xState?.xData?.handle);
    const mountedCharHandle = normalizeIdentity(mountedThread.handle);
    const mountedCharName = String(mountedThread.name || '').trim().toLocaleLowerCase();
    const isCurrentUserPost = post => {
        const authorId = String(post?.authorId || post?.accountId || '').trim();
        if (authorId === 'me' || authorId === 'user:self' || authorId === 'current-user') return true;
        const authorHandle = getPostAuthorHandle(post);
        return Boolean(currentUserHandle && authorHandle && currentUserHandle === authorHandle);
    };
    const isMountedCharPost = post => {
        const authorId = String(post?.authorId || post?.profileOwnerId || post?.accountId || '').trim();
        if (authorId && authorId === String(mountedThread.id)) return true;
        const authorHandle = getPostAuthorHandle(post);
        if (mountedCharHandle && authorHandle && mountedCharHandle === authorHandle) return true;
        return !authorHandle && !!mountedCharName
            && getPostAuthorName(post).toLocaleLowerCase() === mountedCharName;
    };
    const formatPost = (post, ownerLabel) => {
        const text = sanitize(getPostText(post)).trim();
        if (!text) return '';
        const topic = sanitize(post?.topicTag || '').trim();
        const timePrefix = includeTime ? `[${formatTime(getPostTimestamp(post))}] ` : '';
        return `${timePrefix}${ownerLabel} posted on X${topic ? ` (${topic})` : ''}: ${text}`;
    };
    const collectRecentPosts = (posts, ownerLabel) => {
        const seen = new Set();
        return (Array.isArray(posts) ? posts : [])
            .slice()
            .filter(post => getPostText(post))
            .sort((left, right) => getPostTimestamp(right) - getPostTimestamp(left))
            .filter(post => {
                const key = String(post?.id || '') || `${getPostTimestamp(post)}:${getPostText(post)}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, limit)
            .sort((left, right) => getPostTimestamp(left) - getPostTimestamp(right))
            .map(post => formatPost(post, ownerLabel))
            .filter(Boolean);
    };
    const recentMessages = mountedThread.messages
        .slice()
        .sort((left, right) => Number(left?.createdAt || left?.timestamp || 0) - Number(right?.createdAt || right?.timestamp || 0))
        .slice(-limit)
        .map(formatMessage)
        .filter(Boolean);
    const recentUserPosts = collectRecentPosts(allXPosts.filter(isCurrentUserPost), 'User');
    const charProfilePosts = [
        ...(Array.isArray(rawMountedThread.profilePosts) ? rawMountedThread.profilePosts : []),
        ...allXPosts.filter(isMountedCharPost)
    ];
    const recentCharPosts = collectRecentPosts(charProfilePosts, `Current Char (${xCharName})`);

    if (recentMessages.length === 0 && recentUserPosts.length === 0 && recentCharPosts.length === 0) return '';

    return `<mounted_x_direct_message_context>\nSource: mounted X app social context for the same Char. This is prior cross-platform context, not a message sent in the current iMessage thread.\nMounted X thread: ${sanitize(xCharName)}${mountedThread.handle ? ` (${sanitize(mountedThread.handle)})` : ''}\nUse it only to maintain continuity with User. Do not say other characters saw it, and do not present any of this as an iMessage bubble.\nCurrent iMessage Char: ${sanitize(charName)}\n\n<x_private_direct_messages>\nScope: prior one-to-one private X direct messages between User and the current Char. These are neither public posts nor iMessage bubbles.\n${recentMessages.length ? recentMessages.join('\n') : 'None'}\n</x_private_direct_messages>\n\n<x_user_public_posts>\nScope: User's public X posts.\nOwnership hard rule: every post in this block was authored and publicly posted by User, not by you (the current Char). Never claim, imply, remember, or refer to any of these posts as your own.\n${recentUserPosts.length ? recentUserPosts.join('\n') : 'None'}\n</x_user_public_posts>\n\n<x_current_char_own_public_posts>\nScope: the current Char's own public X profile posts.\nOwnership hard rule: every post in this block was authored and publicly posted by you, the current Char. Treat it as your own public content; do not deny authorship or describe it as User's or someone else's post.\n${recentCharPosts.length ? recentCharPosts.join('\n') : 'None'}\n</x_current_char_own_public_posts>\n</mounted_x_direct_message_context>`;
};

window.imApp.getMomentMessages = function() {
    return Array.isArray(window.imData.momentMessages) ? window.imData.momentMessages : [];
};

window.imApp.setMomentMessages = function(messages) {
    window.imData.momentMessages = Array.isArray(messages) ? messages : [];
};

window.imApp.ensureFriendMessagesLoaded = async function(friendOrId, options = {}) {
    const targetId = typeof friendOrId === 'object' && friendOrId !== null ? friendOrId.id : friendOrId;
    if (targetId == null) return [];

    const targetFriend = (window.imData.friends || []).find(
        friend => String(friend.id) === String(targetId)
    );
    if (!targetFriend) return [];

    if (targetFriend.messagesLoaded && Array.isArray(targetFriend.messages)) {
        return targetFriend.messages;
    }

    try {
        if (!window.imStorage || !window.imStorage.loadMessagesByFriendId) {
            targetFriend.messages = Array.isArray(targetFriend.messages) ? targetFriend.messages : [];
            targetFriend.messagesLoaded = true;
            return targetFriend.messages;
        }

        const loadedMessages = await window.imStorage.loadMessagesByFriendId(targetId);
        targetFriend.messages = Array.isArray(loadedMessages) ? loadedMessages : [];
        targetFriend.messagesLoaded = true;
        targetFriend.messageCount = targetFriend.messages.length;

        if (targetFriend.messages.length > 0) {
            const visibleMessages = targetFriend.messages.filter(message => window.imApp.getFriendMessagePreview(message));
            const lastMessage = visibleMessages.length > 0 ? visibleMessages[visibleMessages.length - 1] : null;
            targetFriend.lastMessageTimestamp = Number(lastMessage?.timestamp) || targetFriend.lastMessageTimestamp || 0;
            targetFriend.lastMessagePreview =
                (lastMessage ? window.imApp.getFriendMessagePreview(lastMessage) : '') ||
                targetFriend.lastMessagePreview ||
                '';
        }

        if (typeof options.onLoaded === 'function') {
            options.onLoaded(targetFriend.messages, targetFriend);
        }

        return targetFriend.messages;
    } catch (e) {
        console.error('Failed to load friend messages on demand', e);
        targetFriend.messages = Array.isArray(targetFriend.messages) ? targetFriend.messages : [];
        targetFriend.messagesLoaded = true;
        return targetFriend.messages;
    }
};

window.imApp.getMomentsCoverUrl = function() {
    return window.imData.momentsCoverUrl || null;
};

window.imApp.setMomentsCoverUrl = function(url) {
    window.imData.momentsCoverUrl = url || null;
};

window.imApp.cloneDataSnapshot = function(value) {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
};

window.imApp.buildPersistedData = function() {
    return {
        friends: window.imApp.cloneDataSnapshot(Array.isArray(window.imData.friends) ? window.imData.friends : []),
        moments: window.imApp.cloneDataSnapshot(Array.isArray(window.imData.moments) ? window.imData.moments : []),
        momentMessages: window.imApp.cloneDataSnapshot(Array.isArray(window.imData.momentMessages) ? window.imData.momentMessages : []),
        stickers: window.imApp.cloneDataSnapshot(Array.isArray(window.imData.stickers) ? window.imData.stickers : []),
        momentsCoverUrl: window.imData.momentsCoverUrl || null
    };
};

window.imApp.markMomentsLoaded = function(loaded = true) {
    window.imData.momentsLoaded = !!loaded;
};

window.imApp.markMomentMessagesLoaded = function(loaded = true) {
    window.imData.momentMessagesLoaded = !!loaded;
};

window.imApp.markStickersLoaded = function(loaded = true) {
    window.imData.stickersLoaded = !!loaded;
};

window.imApp.getFriendMessagePreview = function(message) {
    const targetMessage = message || {};
    if (targetMessage.type === 'chat_record_forward') {
        return window.imApp.getChatRecordPreview
            ? window.imApp.getChatRecordPreview(targetMessage)
            : '[聊天记录]';
    }
    if (targetMessage.type === 'image') {
        const desc = targetMessage.text || targetMessage.description || '';
        return desc ? `[图片] ${desc}`.trim() : '[图片]';
    }
    if (targetMessage.type === 'voice_message') {
        return `[语音] ${targetMessage.transcript || targetMessage.text || ''}`.trim();
    }
    if (targetMessage.type === 'sticker') {
        const name = targetMessage.stickerName || targetMessage.text || '';
        return name ? `[表情包] ${name}`.trim() : '[表情包]';
    }
    if (targetMessage.type === 'moment_forward') {
        let content = '';
        try {
            if (targetMessage.content) {
                const parsed = JSON.parse(targetMessage.content);
                content = parsed.text || '';
            }
        } catch(e) {}
        return content ? `[朋友圈] ${content}`.trim() : '[朋友圈]';
    }
    if (targetMessage.type === 'pay_transfer') {
        return `[转账] ${targetMessage.description || ''}`.trim();
    }
    if (targetMessage.type === 'group_red_packet') {
        return `[群红包] ${targetMessage.description || ''}`.trim();
    }
    if (targetMessage.type === 'voice_call_record') {
        return targetMessage.text || `[语音通话记录] ${targetMessage.statusText || ''}`.trim();
    }
    if (targetMessage.type === 'fake_link') {
        const fakeLinkData = targetMessage.fakeLinkData && typeof targetMessage.fakeLinkData === 'object'
            ? targetMessage.fakeLinkData
            : {};
        const label = fakeLinkData.siteName || '假链接';
        const title = fakeLinkData.title || targetMessage.content || '';
        return `[${label}] ${title}`.trim();
    }
    if (targetMessage.type === 'offline_meeting_record') {
        return '[见面记录]';
    }
    if (targetMessage.type === 'system_notice') {
        const noticeKind = targetMessage.noticeKind || '';
        const noticeText = targetMessage.content || targetMessage.text || '';
        if (noticeKind === 'group_left') return '你已退出群聊';
        if (noticeKind === 'group_rejoined') return '你重新进入群聊';
        if (noticeKind === 'narration') return `[旁白] ${noticeText}`.trim();
        if (noticeKind === 'offline_meeting_active') return '';
        if (noticeKind === 'message_recalled') {
            if (targetMessage.actorRole === 'user') return '你撤回了一条消息';
            const actorName = String(targetMessage.actorName || '').trim();
            return `${actorName || '对方'}撤回了一条消息`;
        }
        return noticeText;
    }
    if (targetMessage.type === 'html') {
        return targetMessage.text || '[卡片消息]';
    }
    return targetMessage.content || targetMessage.text || '';
};

window.imApp.syncFriendMessageSummary = function(friend) {
    if (!friend) return null;

    const messages = Array.isArray(friend.messages) ? friend.messages : [];
    const visibleMessages = messages.filter(message => window.imApp.getFriendMessagePreview(message));
    const lastMessage = visibleMessages.length > 0 ? visibleMessages[visibleMessages.length - 1] : null;

    friend.messages = messages;
    friend.messagesLoaded = true;
    friend.messageCount = messages.length;
    friend.lastMessageTimestamp = Number(lastMessage?.timestamp) || 0;
    friend.lastMessagePreview = lastMessage
        ? window.imApp.getFriendMessagePreview(lastMessage)
        : '';

    return friend;
};

window.imApp.getTotalUnreadCount = function() {
    return (Array.isArray(window.imData.friends) ? window.imData.friends : [])
        .reduce((total, friend) => total + Math.max(0, Number(friend?.unreadCount) || 0), 0);
};

window.imApp.updateChatsUnreadBadges = function() {
    const navChatsBtn = document.getElementById('nav-chats-btn');
    if (!navChatsBtn) return;

    let badge = navChatsBtn.querySelector('.nav-chats-unread-badge');
    const totalUnread = window.imApp.getTotalUnreadCount();
    const shouldShow = totalUnread > 0 && !navChatsBtn.classList.contains('active');

    if (!badge) {
        badge = document.createElement('div');
        badge.className = 'nav-chats-unread-badge';
        badge.style.cssText = 'position:absolute; top:6px; right:14px; min-width:16px; height:16px; padding:0 4px; border-radius:999px; background:#ff3b30; color:#fff; font-size:10px; font-weight:700; line-height:16px; text-align:center; box-sizing:border-box; display:none; pointer-events:none;';
        navChatsBtn.style.position = navChatsBtn.style.position || 'relative';
        navChatsBtn.appendChild(badge);
    }

    badge.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
    badge.style.display = shouldShow ? 'block' : 'none';
};

window.imApp.clearFriendUnread = async function(friendId, options = {}) {
    const safeFriendId = String(friendId);
    const targetFriend = (window.imData.friends || []).find(
        friend => String(friend.id) === safeFriendId
    );
    if (!targetFriend) return false;

    if (!targetFriend.unreadCount) {
        if (window.imApp.updateChatsUnreadBadges) window.imApp.updateChatsUnreadBadges();
        return true;
    }

    targetFriend.unreadCount = 0;
    try {
        if (window.imStorage?.saveFriendMeta) {
            await window.imStorage.saveFriendMeta(targetFriend);
        } else if (window.imApp.commitFriendChange) {
            await window.imApp.commitFriendChange(safeFriendId, (friend) => {
                if (friend) friend.unreadCount = 0;
            }, { silent: true, metaOnly: true });
        }
    } catch (error) {
        console.error('Failed to clear unread count', error);
        if (!options.silent && window.showToast) window.showToast('未读状态保存失败');
        return false;
    } finally {
        if (window.imChat?.renderChatsList) window.imChat.renderChatsList();
        if (window.imApp.updateChatsUnreadBadges) window.imApp.updateChatsUnreadBadges();
    }

    return true;
};

window.imApp.reindexFriendMessages = function(friend) {
    if (!friend || !Array.isArray(friend.messages)) return [];

    friend.messages.forEach((message, index) => {
        if (message && typeof message === 'object') {
            message.__messageOrder = index;
        }
    });

    return friend.messages;
};

window.imApp.findFriendMessageIndex = function(friend, descriptor) {
    const messages = Array.isArray(friend?.messages) ? friend.messages : [];
    if (messages.length === 0 || descriptor == null) return -1;

    if (typeof descriptor === 'function') {
        return messages.findIndex(descriptor);
    }

    const descriptorId = typeof descriptor === 'object' && descriptor !== null && descriptor.id != null
        ? String(descriptor.id)
        : (typeof descriptor !== 'object' ? String(descriptor) : null);
    const descriptorTimestamp = typeof descriptor === 'object' && descriptor !== null && descriptor.timestamp != null
        ? String(descriptor.timestamp)
        : null;

    return messages.findIndex((message) => {
        if (!message) return false;
        if (descriptorId && message.id != null && String(message.id) === descriptorId) return true;
        if (descriptorTimestamp && message.timestamp != null && String(message.timestamp) === descriptorTimestamp) return true;
        return false;
    });
};

window.imApp.syncActiveFriendReference = function(friend) {
    if (!friend) return;
    if (window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(friend.id)) {
        window.imData.currentActiveFriend = friend;
    }
};

window.imApp.syncSettingsFriendReference = function(friend) {
    if (!friend) return;
    if (window.imData.currentSettingsFriend && String(window.imData.currentSettingsFriend.id) === String(friend.id)) {
        window.imData.currentSettingsFriend = friend;
    }
};

window.imApp.clearFriendRuntimeMessageContext = function(friend) {
    if (!friend) return;
    if (friend.pendingRegenerateContext) delete friend.pendingRegenerateContext;
    if (window.imData.currentReplyText) window.imData.currentReplyText = null;
    if (window.imData.currentReplyMessageId) window.imData.currentReplyMessageId = null;
    const safeFriendId = String(friend.id);
    if (window.imData.profilePanelUiStateByFriendId) {
        delete window.imData.profilePanelUiStateByFriendId[safeFriendId];
    }
    const page = document.getElementById(`chat-interface-${friend.id}`);
    const replyPreview = page ? page.querySelector('.reply-preview-container') : null;
    if (replyPreview) {
        replyPreview.style.display = 'none';
        replyPreview.querySelectorAll('[data-reply-text], .reply-preview-text').forEach(node => {
            node.textContent = '';
        });
    }
    page?.querySelectorAll('.typing-row').forEach(row => row.remove());
    page?.querySelectorAll('.chat-profile-panel-overlay').forEach((overlay) => {
        overlay.classList.remove('active');
        overlay.style.display = 'none';
    });
    if (window.imData.currentActiveRow) {
        window.imData.currentActiveRow.classList?.remove('message-active');
        window.imData.currentActiveRow = null;
    }
};

window.imApp.createClearedConversationMemory = function(memory = {}) {
    const normalizedMemory = window.imApp.normalizeFriendData({
        id: '__conversation_reset__',
        memory
    }).memory;
    const cleared = window.imApp.createDefaultMemory();

    cleared.context = {
        enabled: normalizedMemory.context.enabled,
        limit: normalizedMemory.context.limit,
        notes: ''
    };
    cleared.summary = {
        enabled: normalizedMemory.summary.enabled,
        limit: normalizedMemory.summary.limit,
        roundLimit: normalizedMemory.summary.roundLimit || 30,
        prompt: normalizedMemory.summary.prompt || '',
        apiPresetId: normalizedMemory.summary.apiPresetId || ''
    };
    cleared.autonomous = window.imApp.cloneDataSnapshot(normalizedMemory.autonomous);
    cleared.schedule = {
        enabled: !!normalizedMemory.schedule.enabled,
        sleepTime: normalizedMemory.schedule.sleepTime || '23:00',
        wakeTime: normalizedMemory.schedule.wakeTime || '07:00',
        events: []
    };
    cleared.userOverride = normalizedMemory.userOverride
        ? window.imApp.cloneDataSnapshot(normalizedMemory.userOverride)
        : null;
    cleared.mountSettings = window.imApp.cloneDataSnapshot(normalizedMemory.mountSettings || {});
    cleared.mountLimits = window.imApp.cloneDataSnapshot(normalizedMemory.mountLimits || {});
    cleared.groupChatContexts = window.imApp.cloneDataSnapshot(normalizedMemory.groupChatContexts || []);
    cleared.lastSummaryMessageCount = 0;
    return cleared;
};

window.imApp.resolveFriendId = function(friendOrId) {
    if (friendOrId && typeof friendOrId === 'object') {
        return friendOrId.id;
    }
    return friendOrId;
};

window.imApp.getFriendById = function(friendOrId) {
    const targetId = window.imApp.resolveFriendId(friendOrId);
    if (targetId == null) return null;

    return (window.imData.friends || []).find(
        friend => String(friend.id) === String(targetId)
    ) || null;
};

window.imApp.commitScopedFriendChange = async function(friendOrId, mutator, options = {}) {
    if (!window.imApp.commitFriendChange) return false;

    const targetId = window.imApp.resolveFriendId(friendOrId);
    if (targetId == null) return false;

    return window.imApp.commitFriendChange(targetId, (targetFriend, friends, targetIndex) => {
        if (!targetFriend) return;

        if (options.syncActive !== false) {
            window.imApp.syncActiveFriendReference(targetFriend);
        }

        if (options.syncSettings === true) {
            window.imApp.syncSettingsFriendReference(targetFriend);
        }

        if (typeof options.onTargetResolved === 'function') {
            options.onTargetResolved(targetFriend, friends, targetIndex);
        }

        return typeof mutator === 'function'
            ? mutator(targetFriend, friends, targetIndex)
            : undefined;
    }, options);
};

window.imApp.runFriendPersistenceTask = async function(friendId, task) {
    const safeFriendId = String(friendId);
    const previousChain = window.imApp.saveState.friendFlushChains.get(safeFriendId) || Promise.resolve();

    const nextChain = previousChain.catch(() => false).then(async () => {
        return task();
    });

    window.imApp.saveState.friendFlushChains.set(safeFriendId, nextChain);

    try {
        return await nextChain;
    } finally {
        if (window.imApp.saveState.friendFlushChains.get(safeFriendId) === nextChain) {
            window.imApp.saveState.friendFlushChains.delete(safeFriendId);
        }
    }
};

window.imApp.saveState = {
    timer: null,
    delay: 800,
    dirty: false,
    isSaving: false,
    hasPendingSave: false,
    lastError: null,
    friendTimers: new Map(),
    momentTimers: new Map(),
    friendDirtyIds: new Set(),
    momentDirtyIds: new Set(),
    friendFlushChains: new Map(),
    momentFlushChains: new Map(),
    friendRevisions: new Map(),
    momentRevisions: new Map(),
    pendingFriendPatches: new Map(),
    momentMessagesDirty: false,
    stickersDirty: false,
    momentsCoverDirty: false
};

window.imApp.markFriendDirty = function(friendId) {
    if (friendId == null) return;
    const safeFriendId = String(friendId);
    const currentRevision = window.imApp.saveState.friendRevisions.get(safeFriendId) || 0;
    window.imApp.saveState.friendRevisions.set(safeFriendId, currentRevision + 1);
    window.imApp.saveState.friendDirtyIds.add(safeFriendId);
    window.imApp.saveState.dirty = true;
};

window.imApp.markMomentDirty = function(momentId) {
    if (momentId == null) return;
    const safeMomentId = String(momentId);
    const currentRevision = window.imApp.saveState.momentRevisions.get(safeMomentId) || 0;
    window.imApp.saveState.momentRevisions.set(safeMomentId, currentRevision + 1);
    window.imApp.saveState.momentDirtyIds.add(safeMomentId);
    window.imApp.saveState.dirty = true;
};

window.imApp.markMomentMessagesDirty = function() {
    window.imApp.saveState.momentMessagesDirty = true;
    window.imApp.saveState.dirty = true;
};

window.imApp.markStickersDirty = function() {
    window.imApp.saveState.stickersDirty = true;
    window.imApp.saveState.dirty = true;
};

window.imApp.markMomentsCoverDirty = function() {
    window.imApp.saveState.momentsCoverDirty = true;
    window.imApp.saveState.dirty = true;
};

window.imApp.persistGlobalData = async function(options = {}) {
    try {
        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (!window.imStorage || !window.imStorage.saveGlobalData) {
            throw new Error('imStorage.saveGlobalData unavailable');
        }

        const payload = window.imApp.buildPersistedData();
        await window.imStorage.saveGlobalData(payload);
        window.imApp.saveState.lastError = null;
        return true;
    } catch (e) {
        console.error('Failed to persist iMessage global data', e);
        window.imApp.saveState.lastError = e;
        if (!options.silent && window.showToast) {
            window.showToast('保存失败，可能是浏览器存储不可用');
        }
        return false;
    }
};

window.imApp.persistFriendData = async function(friendId, options = {}) {
    try {
        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (!window.imStorage || !window.imStorage.saveFriend) {
            throw new Error('imStorage.saveFriend unavailable');
        }

        const targetFriend = (window.imData.friends || []).find(
            friend => String(friend.id) === String(friendId)
        );

        if (!targetFriend) {
            if (window.imStorage.deleteFriend) {
                await window.imStorage.deleteFriend(friendId);
            }
            window.imApp.saveState.lastError = null;
            return true;
        }

        const friendSnapshot = window.imApp.cloneDataSnapshot(targetFriend);
        const shouldPersistMetaOnly = options.metaOnly === true && !!window.imStorage.saveFriendMetaOnly;

        if (shouldPersistMetaOnly && window.imStorage.patchFriendMeta) {
            const pendingPatch = window.imApp.saveState.pendingFriendPatches.get(String(friendId)) || {};
            await window.imStorage.patchFriendMeta(friendId, window.imApp.cloneDataSnapshot(pendingPatch));
        } else if (shouldPersistMetaOnly) {
            await window.imStorage.saveFriendMetaOnly(friendSnapshot);
        } else {
            await window.imStorage.saveFriend(friendSnapshot, {
                skipMessages: options.includeMessages === false
            });
        }

        window.imApp.saveState.lastError = null;
        return true;
    } catch (e) {
        console.error('Failed to persist friend data', e);
        window.imApp.saveState.lastError = e;
        if (!options.silent && window.showToast) {
            window.showToast('好友数据保存失败');
        }
        return false;
    }
};

window.imApp.persistMomentData = async function(momentId, options = {}) {
    try {
        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (!window.imStorage) {
            throw new Error('imStorage unavailable');
        }

        const targetMoment = (window.imData.moments || []).find(
            moment => String(moment.id) === String(momentId)
        );

        if (!targetMoment) {
            if (window.imStorage.deleteMoment) {
                await window.imStorage.deleteMoment(momentId);
            }
            window.imApp.saveState.lastError = null;
            return true;
        }

        if (!window.imStorage.saveMoment) {
            throw new Error('imStorage.saveMoment unavailable');
        }

        await window.imStorage.saveMoment(window.imApp.cloneDataSnapshot(targetMoment));
        window.imApp.saveState.lastError = null;
        return true;
    } catch (e) {
        console.error('Failed to persist moment data', e);
        window.imApp.saveState.lastError = e;
        if (!options.silent && window.showToast) {
            window.showToast('朋友圈数据保存失败');
        }
        return false;
    }
};

const IM_CHAT_LIST_RENDER_DEBOUNCE_MS = 180;
let imChatListRenderTimer = null;
let imChatListRenderBatchDepth = 0;
let imChatListRenderDirty = false;

function isImChatConversationOpen() {
    if (document.hidden) return false;

    const activeFriendId = window.imData?.currentActiveFriend?.id;
    if (activeFriendId == null || activeFriendId === '') return false;

    const imessageView = document.getElementById('imessage-view');
    if (!imessageView || (!imessageView.classList.contains('active') && !imessageView.classList.contains('library-together-popup'))) {
        return false;
    }

    const page = document.getElementById(`chat-interface-${activeFriendId}`);
    return !!page && page.style.display !== 'none';
}

function flushImChatListRender() {
    imChatListRenderTimer = null;
    if (!imChatListRenderDirty || imChatListRenderBatchDepth > 0 || isImChatConversationOpen()) return;

    imChatListRenderDirty = false;
    if (window.imChat?.renderChatsList) window.imChat.renderChatsList();
    else if (window.imApp.updateChatsUnreadBadges) window.imApp.updateChatsUnreadBadges();
}

window.imApp.isChatConversationOpen = isImChatConversationOpen;
window.imApp.requestChatsListRefresh = function(options = {}) {
    imChatListRenderDirty = true;
    if (imChatListRenderBatchDepth > 0 || isImChatConversationOpen()) return false;

    if (options.immediate) {
        if (imChatListRenderTimer) clearTimeout(imChatListRenderTimer);
        flushImChatListRender();
        return true;
    }

    if (imChatListRenderTimer) return false;
    imChatListRenderTimer = setTimeout(flushImChatListRender, IM_CHAT_LIST_RENDER_DEBOUNCE_MS);
    return true;
};
window.imApp.beginChatsListRefreshBatch = function() {
    imChatListRenderBatchDepth += 1;
    let released = false;

    return () => {
        if (released) return;
        released = true;
        imChatListRenderBatchDepth = Math.max(0, imChatListRenderBatchDepth - 1);
        if (imChatListRenderBatchDepth === 0 && imChatListRenderDirty) {
            window.imApp.requestChatsListRefresh();
        }
    };
};
window.imApp.markChatsListRendered = function() {
    imChatListRenderDirty = false;
    if (imChatListRenderTimer) {
        clearTimeout(imChatListRenderTimer);
        imChatListRenderTimer = null;
    }
};

window.imApp.appendFriendMessage = async function(friendId, message, options = {}) {
    const safeFriendId = String(friendId);
    const targetFriend = (window.imData.friends || []).find(
        friend => String(friend.id) === safeFriendId
    );

    if (!targetFriend) return false;
    if (window.imApp.ensureFriendMessagesLoaded) {
        await window.imApp.ensureFriendMessagesLoaded(targetFriend);
    }
    if (!Array.isArray(targetFriend.messages)) targetFriend.messages = [];

    const targetMessage = message && typeof message === 'object' ? message : {};
    window.imApp.captureGroupUserIdentity(targetFriend, targetMessage);
    const previousUnreadCount = Math.max(0, Number(targetFriend.unreadCount) || 0);
    const nextOrder = targetFriend.messages.length;
    targetMessage.__messageOrder = nextOrder;
    targetFriend.messages.push(targetMessage);
    window.imApp.syncFriendMessageSummary(targetFriend);

    const isIncomingMessage = targetMessage.role !== 'user';
    const isActiveChat = window.imData.currentActiveFriend &&
        String(window.imData.currentActiveFriend.id) === safeFriendId;
    if (isIncomingMessage && !isActiveChat) {
        targetFriend.unreadCount = Math.max(0, Number(targetFriend.unreadCount) || 0) + 1;
    }

    window.imApp.syncActiveFriendReference(targetFriend);

    try {
        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (!window.imStorage?.commitFriendMessage) {
            throw new Error('Incremental friend message persistence unavailable');
        }

        const persistedMessage = await window.imApp.runFriendPersistenceTask(safeFriendId, async () => {
            return window.imStorage.commitFriendMessage(targetFriend, targetMessage, nextOrder);
        });

        if (persistedMessage && persistedMessage.id && !targetMessage.id) {
            targetMessage.id = persistedMessage.id;
        }
        targetMessage.__messageOrder = nextOrder;
        window.imApp.saveState.lastError = null;
        if (window.imApp.requestChatsListRefresh) window.imApp.requestChatsListRefresh();
        if (isIncomingMessage && !window.imApp.isChatConversationOpen?.() && window.u2SystemNotifications?.notifyIncomingMessage) {
            window.u2SystemNotifications.notifyIncomingMessage({
                friend: targetFriend,
                message: targetMessage
            });
        }
        return true;
    } catch (e) {
        console.error('Failed to append friend message', e);
        targetFriend.messages = targetFriend.messages.filter((item, index) => {
            if (item === targetMessage) return false;
            if (targetMessage.id && item?.id && String(item.id) === String(targetMessage.id)) return false;
            return !(index === nextOrder && item?.timestamp != null && targetMessage.timestamp != null && String(item.timestamp) === String(targetMessage.timestamp));
        });
        window.imApp.reindexFriendMessages(targetFriend);
        window.imApp.syncFriendMessageSummary(targetFriend);
        targetFriend.unreadCount = previousUnreadCount;
        window.imApp.syncActiveFriendReference(targetFriend);
        if (window.imApp.requestChatsListRefresh) window.imApp.requestChatsListRefresh();
        window.imApp.saveState.lastError = e;
        if (!options.silent && window.showToast) {
            window.showToast('消息保存失败');
        }
        return false;
    }
};

window.imApp.updateFriendMessage = async function(friendId, descriptor, mutator, options = {}) {
    const safeFriendId = String(friendId);
    const targetFriend = (window.imData.friends || []).find(
        friend => String(friend.id) === safeFriendId
    );

    if (!targetFriend) return false;
    if (window.imApp.ensureFriendMessagesLoaded) {
        await window.imApp.ensureFriendMessagesLoaded(targetFriend);
    }
    if (!Array.isArray(targetFriend.messages)) return false;

    const targetIndex = window.imApp.findFriendMessageIndex(targetFriend, descriptor);
    if (targetIndex < 0) return false;

    const previousMessage = window.imApp.cloneDataSnapshot(targetFriend.messages[targetIndex]);
    const targetMessage = targetFriend.messages[targetIndex];
    const getApiContextFingerprint = (message) => JSON.stringify({
        role: message?.role || '',
        type: message?.type || '',
        content: message?.content || '',
        text: message?.text || '',
        transcript: message?.transcript || '',
        description: message?.description || '',
        replyTo: message?.replyTo || '',
        replyToMessageId: message?.replyToMessageId || ''
    });
    const previousContextFingerprint = getApiContextFingerprint(previousMessage);

    try {
        if (typeof mutator === 'function') {
            await mutator(targetMessage, targetFriend, targetIndex);
        }

        targetMessage.__messageOrder = targetIndex;
        window.imApp.syncFriendMessageSummary(targetFriend);
        window.imApp.syncActiveFriendReference(targetFriend);

        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (!window.imStorage?.commitFriendMessage) {
            throw new Error('Incremental friend message persistence unavailable');
        }

        const persistedMessage = await window.imApp.runFriendPersistenceTask(safeFriendId, async () => {
            return window.imStorage.commitFriendMessage(targetFriend, targetMessage, targetIndex);
        });

        if (persistedMessage && persistedMessage.id && !targetMessage.id) {
            targetMessage.id = persistedMessage.id;
        }
        if (persistedMessage) {
            ['contentAssetId', 'stickerAssetId', 'senderAvatarAssetId'].forEach((field) => {
                if (Object.prototype.hasOwnProperty.call(persistedMessage, field)) {
                    targetMessage[field] = persistedMessage[field] || '';
                }
            });
        }
        targetMessage.__messageOrder = targetIndex;
        if (getApiContextFingerprint(targetMessage) !== previousContextFingerprint) {
            window.imApp.clearFriendRuntimeMessageContext(targetFriend);
        }
        window.imApp.syncActiveFriendReference(targetFriend);
        window.imApp.syncSettingsFriendReference(targetFriend);
        window.imApp.saveState.lastError = null;
        return true;
    } catch (e) {
        console.error('Failed to update friend message', e);
        targetFriend.messages[targetIndex] = previousMessage;
        window.imApp.syncFriendMessageSummary(targetFriend);
        window.imApp.syncActiveFriendReference(targetFriend);
        window.imApp.saveState.lastError = e;
        if (!options.silent && window.showToast) {
            window.showToast('消息保存失败');
        }
        return false;
    }
};

window.imApp.removeFriendMessages = async function(friendId, descriptors, options = {}) {
    const safeFriendId = String(friendId);
    const targetFriend = (window.imData.friends || []).find(
        friend => String(friend.id) === safeFriendId
    );

    if (!targetFriend) return false;
    if (window.imApp.ensureFriendMessagesLoaded) {
        await window.imApp.ensureFriendMessagesLoaded(targetFriend);
    }
    if (!Array.isArray(targetFriend.messages)) return false;

    const descriptorList = Array.isArray(descriptors) ? descriptors : [descriptors];
    const previousMessages = window.imApp.cloneDataSnapshot(targetFriend.messages);
    const previousPendingRegenerateContext = window.imApp.cloneDataSnapshot(targetFriend.pendingRegenerateContext || null);
    const previousRecallPresentation = window.imApp.cloneDataSnapshot(targetFriend.memory?.recallPresentation || null);
    const previousCurrentReplyText = window.imData.currentReplyText || null;
    const previousCurrentReplyMessageId = window.imData.currentReplyMessageId || null;
    const removalIndexes = new Set();

    descriptorList.forEach((descriptor) => {
        const index = window.imApp.findFriendMessageIndex(targetFriend, descriptor);
        if (index > -1) removalIndexes.add(index);
    });

    if (removalIndexes.size === 0) return true;

    const sortedRemovalIndexes = Array.from(removalIndexes).sort((a, b) => a - b);
    const removedMessages = targetFriend.messages.filter((_, index) => removalIndexes.has(index));
    const removedMessageIds = new Set(removedMessages.map(message => String(message?.id || '').trim()).filter(Boolean));
    const removedApiRunIds = new Set(removedMessages.map(message => String(message?.apiRunId || '').trim()).filter(Boolean));
    const removedReplyTexts = new Set();
    const normalizeReplyReferenceText = value => String(value || '').replace(/\s+/g, ' ').trim();
    removedMessages.forEach(message => {
        [
            message?.content,
            message?.text,
            message?.transcript,
            message?.description,
            message?.fakeLinkData?.title,
            message?.fakeLinkData?.summary
        ].forEach(value => {
            const text = normalizeReplyReferenceText(value);
            if (text) removedReplyTexts.add(text);
        });
        const primaryText = normalizeReplyReferenceText(message?.content || message?.text || message?.transcript || message?.description);
        const translationText = normalizeReplyReferenceText(message?.translation);
        if (primaryText && translationText) removedReplyTexts.add(`${primaryText} ${translationText}`);
    });
    let clearedReplyReference = false;
    let canDeleteWithoutReindex = sortedRemovalIndexes.every((index, removalOrder) => {
        return index === (previousMessages.length - sortedRemovalIndexes.length + removalOrder);
    });

    if (window.imChat?.invalidateFriendConversation) {
        window.imChat.invalidateFriendConversation(safeFriendId);
    }
    targetFriend.messages = targetFriend.messages.filter((_, index) => !removalIndexes.has(index));
    const removedCotByRunId = new Map();
    removedMessages.forEach((message) => {
        const runId = String(message?.apiRunId || '').trim();
        const cotSummary = typeof message?.cotSummary === 'string' ? message.cotSummary.trim() : '';
        if (runId && cotSummary && !removedCotByRunId.has(runId)) {
            removedCotByRunId.set(runId, cotSummary);
        }
    });
    removedCotByRunId.forEach((cotSummary, runId) => {
        const runMessages = targetFriend.messages.filter(message => (
            message
            && message.role !== 'user'
            && String(message.apiRunId || '').trim() === runId
        ));
        if (runMessages.length === 0 || runMessages.some(message => String(message.cotSummary || '').trim())) return;
        runMessages[0].cotSummary = cotSummary;
        canDeleteWithoutReindex = false;
    });
    targetFriend.messages.forEach(message => {
        if (!message) return;
        const replyMessageId = String(message.replyToMessageId || '').trim();
        const replyText = normalizeReplyReferenceText(message.replyTo);
        if ((replyMessageId && removedMessageIds.has(replyMessageId)) || (replyText && removedReplyTexts.has(replyText))) {
            delete message.replyToMessageId;
            delete message.replyTo;
            clearedReplyReference = true;
        }
    });

    const recallPresentation = targetFriend.memory?.recallPresentation;
    if (recallPresentation) {
        const triggerUserMessageId = String(recallPresentation.triggerUserMessageId || '').trim();
        const presentationRunId = String(recallPresentation.apiRunId || '').trim();
        const triggerStillExists = !triggerUserMessageId || targetFriend.messages.some(message => (
            message?.role === 'user' && String(message.id || '') === triggerUserMessageId
        ));
        const anchorStillExists = !presentationRunId || targetFriend.messages.some(message => (
            message?.role === 'assistant' && String(message.apiRunId || '') === presentationRunId
        ));
        if ((triggerUserMessageId && removedMessageIds.has(triggerUserMessageId))
            || (presentationRunId && removedApiRunIds.has(presentationRunId))
            || !triggerStillExists
            || !anchorStillExists) {
            targetFriend.memory.recallPresentation = null;
        }
    }
    window.imApp.reindexFriendMessages(targetFriend);
    window.imApp.syncFriendMessageSummary(targetFriend);
    window.imApp.clearFriendRuntimeMessageContext(targetFriend);
    window.imApp.syncActiveFriendReference(targetFriend);
    window.imApp.syncSettingsFriendReference(targetFriend);

    try {
        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (!window.imStorage?.saveFriendMeta) {
            throw new Error('Friend meta persistence unavailable');
        }

        const removableIds = removedMessages
            .map((message) => message?.id ? String(message.id) : null)
            .filter(Boolean);

        await window.imApp.runFriendPersistenceTask(safeFriendId, async () => {
            if (
                canDeleteWithoutReindex &&
                !clearedReplyReference &&
                removableIds.length === removedMessages.length &&
                window.imStorage?.deleteFriendMessages
            ) {
                await window.imStorage.deleteFriendMessages(removableIds);
            } else if (window.imStorage?.replaceFriendMessages) {
                await window.imStorage.replaceFriendMessages(safeFriendId, targetFriend.messages);
            } else {
                throw new Error('Friend message removal persistence unavailable');
            }

            await window.imStorage.saveFriendMeta(targetFriend);
            return true;
        });

        window.imApp.saveState.lastError = null;
        if (removedApiRunIds.size > 0 && window.imChat?.purgeRegenerateRunSnapshots) {
            window.imChat.purgeRegenerateRunSnapshots(safeFriendId, Array.from(removedApiRunIds));
        }
        return true;
    } catch (e) {
        console.error('Failed to remove friend messages', e);
        targetFriend.messages = previousMessages;
        if (previousPendingRegenerateContext) targetFriend.pendingRegenerateContext = previousPendingRegenerateContext;
        else if (targetFriend.pendingRegenerateContext) delete targetFriend.pendingRegenerateContext;
        targetFriend.memory = targetFriend.memory || window.imApp.createDefaultMemory();
        targetFriend.memory.recallPresentation = previousRecallPresentation;
        window.imData.currentReplyText = previousCurrentReplyText;
        window.imData.currentReplyMessageId = previousCurrentReplyMessageId;
        window.imApp.reindexFriendMessages(targetFriend);
        window.imApp.syncFriendMessageSummary(targetFriend);
        window.imApp.syncActiveFriendReference(targetFriend);
        window.imApp.syncSettingsFriendReference(targetFriend);
        window.imApp.saveState.lastError = e;
        if (!options.silent && window.showToast) {
            window.showToast('删除消息失败');
        }
        return false;
    }
};

window.imApp.resetFriendMessages = async function(friendId, options = {}) {
    const safeFriendId = String(friendId);
    const targetFriend = (window.imData.friends || []).find(
        friend => String(friend.id) === safeFriendId
    );

    if (!targetFriend) return false;
    if (window.imApp.ensureFriendMessagesLoaded) {
        await window.imApp.ensureFriendMessagesLoaded(targetFriend);
    }

    const previousMessages = window.imApp.cloneDataSnapshot(Array.isArray(targetFriend.messages) ? targetFriend.messages : []);
    const previousRecallPresentation = window.imApp.cloneDataSnapshot(targetFriend.memory?.recallPresentation || null);
    targetFriend.messages = [];
    if (targetFriend.memory) targetFriend.memory.recallPresentation = null;
    window.imApp.syncFriendMessageSummary(targetFriend);
    window.imApp.clearFriendRuntimeMessageContext(targetFriend);
    window.imApp.syncActiveFriendReference(targetFriend);
    window.imApp.syncSettingsFriendReference(targetFriend);

    try {
        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (!window.imStorage?.replaceFriendMessages || !window.imStorage?.saveFriendMeta) {
            throw new Error('Friend message reset persistence unavailable');
        }

        await window.imApp.runFriendPersistenceTask(safeFriendId, async () => {
            await window.imStorage.replaceFriendMessages(safeFriendId, []);
            await window.imStorage.saveFriendMeta(targetFriend);
            return true;
        });

        window.imApp.saveState.lastError = null;
        return true;
    } catch (e) {
        console.error('Failed to reset friend messages', e);
        targetFriend.messages = previousMessages;
        if (targetFriend.memory) targetFriend.memory.recallPresentation = previousRecallPresentation;
        window.imApp.reindexFriendMessages(targetFriend);
        window.imApp.syncFriendMessageSummary(targetFriend);
        window.imApp.syncActiveFriendReference(targetFriend);
        window.imApp.syncSettingsFriendReference(targetFriend);
        window.imApp.saveState.lastError = e;
        if (!options.silent && window.showToast) {
            window.showToast('聊天记录清空失败');
        }
        return false;
    }
};

window.imApp.buildFriendMetaPatch = function(previousFriend, nextFriend) {
    if (!nextFriend || typeof nextFriend !== 'object') return {};
    if (!previousFriend || typeof previousFriend !== 'object') {
        const full = window.imApp.cloneDataSnapshot(nextFriend);
        delete full.messages;
        return full;
    }
    const patch = {};
    Object.keys(nextFriend).forEach((key) => {
        if (key === 'messages') return;
        const previousValue = previousFriend[key];
        const nextValue = nextFriend[key];
        let changed = previousValue !== nextValue;
        if (previousValue && nextValue && typeof previousValue === 'object' && typeof nextValue === 'object') {
            try {
                changed = JSON.stringify(previousValue) !== JSON.stringify(nextValue);
            } catch (error) {
                changed = true;
            }
        }
        if (changed) patch[key] = window.imApp.cloneDataSnapshot(nextValue);
    });
    return patch;
};

window.imApp.resetFriendConversation = async function(friendId, options = {}) {
    const safeFriendId = String(friendId);
    const targetFriend = (window.imData.friends || []).find(
        friend => String(friend.id) === safeFriendId
    );
    if (!targetFriend) return false;

    if (window.imApp.ensureFriendMessagesLoaded) {
        await window.imApp.ensureFriendMessagesLoaded(targetFriend);
    }

    const previousFriend = window.imApp.cloneDataSnapshot(targetFriend);
    const pendingTimer = window.imApp.saveState.friendTimers.get(safeFriendId);
    if (pendingTimer) clearTimeout(pendingTimer);
    window.imApp.saveState.friendTimers.delete(safeFriendId);
    window.imApp.saveState.friendDirtyIds.delete(safeFriendId);
    if (window.imChat?.invalidateFriendConversation) {
        window.imChat.invalidateFriendConversation(safeFriendId);
    }

    targetFriend.messages = [];
    targetFriend.unreadCount = 0;
    targetFriend.memory = window.imApp.createClearedConversationMemory(targetFriend.memory || {});
    targetFriend.profilePanel = window.imApp.createDefaultProfilePanel({});
    targetFriend.latestThought = '';
    targetFriend.status = 'online';
    if (targetFriend.type === 'group') targetFriend.memberProfiles = {};
    if (targetFriend.pendingRegenerateContext) delete targetFriend.pendingRegenerateContext;
    window.imApp.syncFriendMessageSummary(targetFriend);
    window.imApp.clearFriendRuntimeMessageContext(targetFriend);
    window.imApp.syncActiveFriendReference(targetFriend);
    window.imApp.syncSettingsFriendReference(targetFriend);

    try {
        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (!window.imStorage?.replaceFriendMessages || !window.imStorage?.saveFriendMeta) {
            throw new Error('Friend conversation reset persistence unavailable');
        }

        await window.imApp.runFriendPersistenceTask(safeFriendId, async () => {
            await window.imStorage.replaceFriendMessages(safeFriendId, []);
            await window.imStorage.saveFriendMeta(targetFriend);
            return true;
        });

        window.imApp.saveState.lastError = null;
        if (window.imApp.updateChatsUnreadBadges) window.imApp.updateChatsUnreadBadges();
        return true;
    } catch (error) {
        console.error('Failed to reset friend conversation', error);
        Object.keys(targetFriend).forEach(key => delete targetFriend[key]);
        Object.assign(targetFriend, previousFriend);
        window.imApp.reindexFriendMessages(targetFriend);
        window.imApp.syncFriendMessageSummary(targetFriend);
        window.imApp.syncActiveFriendReference(targetFriend);
        window.imApp.syncSettingsFriendReference(targetFriend);
        window.imApp.saveState.lastError = error;

        try {
            if (window.imStorage?.replaceFriendMessages && window.imStorage?.saveFriendMeta) {
                await window.imApp.runFriendPersistenceTask(safeFriendId, async () => {
                    await window.imStorage.replaceFriendMessages(safeFriendId, previousFriend.messages || []);
                    await window.imStorage.saveFriendMeta(previousFriend);
                    return true;
                });
            }
        } catch (rollbackError) {
            console.error('Failed to roll back friend conversation reset', rollbackError);
        }

        if (!options.silent && window.showToast) {
            window.showToast('聊天记录与上下文清空失败');
        }
        return false;
    }
};

window.imApp.persistMomentMessagesData = async function(options = {}) {
    try {
        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (!window.imStorage || !window.imStorage.saveMomentMessages) {
            throw new Error('imStorage.saveMomentMessages unavailable');
        }

        await window.imStorage.saveMomentMessages(
            window.imApp.cloneDataSnapshot(Array.isArray(window.imData.momentMessages) ? window.imData.momentMessages : [])
        );
        window.imApp.saveState.lastError = null;
        return true;
    } catch (e) {
        console.error('Failed to persist moment message data', e);
        window.imApp.saveState.lastError = e;
        if (!options.silent && window.showToast) {
            window.showToast('朋友圈通知保存失败');
        }
        return false;
    }
};

window.imApp.persistStickersData = async function(options = {}) {
    try {
        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (!window.imStorage || !window.imStorage.saveStickers) {
            throw new Error('imStorage.saveStickers unavailable');
        }

        await window.imStorage.saveStickers(
            window.imApp.cloneDataSnapshot(Array.isArray(window.imData.stickers) ? window.imData.stickers : [])
        );
        window.imApp.saveState.lastError = null;
        return true;
    } catch (e) {
        console.error('Failed to persist sticker data', e);
        window.imApp.saveState.lastError = e;
        if (!options.silent && window.showToast) {
            window.showToast('表情包保存失败');
        }
        return false;
    }
};

window.imApp.persistMomentsCoverData = async function(options = {}) {
    try {
        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (!window.imStorage || !window.imStorage.saveMomentsCover) {
            throw new Error('imStorage.saveMomentsCover unavailable');
        }

        await window.imStorage.saveMomentsCover(window.imData.momentsCoverUrl || null);
        window.imApp.saveState.lastError = null;
        return true;
    } catch (e) {
        console.error('Failed to persist moments cover data', e);
        window.imApp.saveState.lastError = e;
        if (!options.silent && window.showToast) {
            window.showToast('朋友圈封面保存失败');
        }
        return false;
    }
};

window.imApp.flushFriendSave = async function(friendId, options = {}) {
    const safeFriendId = String(friendId);
    const timerRecord = window.imApp.saveState.friendTimers.get(safeFriendId);
    if (timerRecord) {
        clearTimeout(timerRecord.timer || timerRecord);
        window.imApp.saveState.friendTimers.delete(safeFriendId);
    }

    const previousChain = window.imApp.saveState.friendFlushChains.get(safeFriendId) || Promise.resolve();
    const nextChain = previousChain.catch(() => false).then(async () => {
        const revisionBeforeSave = window.imApp.saveState.friendRevisions.get(safeFriendId) || 0;
        const timerOptions = timerRecord && typeof timerRecord === 'object' ? (timerRecord.options || {}) : {};
        const persistOptions = {
            ...timerOptions,
            ...options
        };
        const saved = await window.imApp.persistFriendData(safeFriendId, persistOptions);

        if (saved) {
            const latestRevision = window.imApp.saveState.friendRevisions.get(safeFriendId) || 0;
            if (latestRevision === revisionBeforeSave) {
                window.imApp.saveState.friendDirtyIds.delete(safeFriendId);
                window.imApp.saveState.pendingFriendPatches.delete(safeFriendId);
            }
        }

        window.imApp.saveState.dirty =
            window.imApp.saveState.friendDirtyIds.size > 0 ||
            window.imApp.saveState.momentDirtyIds.size > 0 ||
            window.imApp.saveState.momentMessagesDirty ||
            window.imApp.saveState.stickersDirty ||
            window.imApp.saveState.momentsCoverDirty;

        return saved;
    });

    window.imApp.saveState.friendFlushChains.set(safeFriendId, nextChain);

    try {
        return await nextChain;
    } finally {
        if (window.imApp.saveState.friendFlushChains.get(safeFriendId) === nextChain) {
            window.imApp.saveState.friendFlushChains.delete(safeFriendId);
        }
    }
};

window.imApp.scheduleFriendSave = function(friendId, options = {}) {
    if (friendId == null) return false;
    const safeFriendId = String(friendId);
    const delay = Number.isFinite(Number(options.delay)) ? Number(options.delay) : 500;

    window.imApp.markFriendDirty(safeFriendId);

    const existingTimer = window.imApp.saveState.friendTimers.get(safeFriendId);
    if (existingTimer) {
        clearTimeout(existingTimer.timer || existingTimer);
    }

    const timerOptions = {
        silent: options.silent !== false,
        metaOnly: options.metaOnly === true,
        includeMessages: options.includeMessages
    };

    const timer = setTimeout(() => {
        window.imApp.flushFriendSave(safeFriendId, timerOptions);
    }, Math.max(0, delay));

    window.imApp.saveState.friendTimers.set(safeFriendId, {
        timer,
        options: timerOptions
    });
    return true;
};

window.imApp.flushMomentSave = async function(momentId, options = {}) {
    const safeMomentId = String(momentId);
    const timer = window.imApp.saveState.momentTimers.get(safeMomentId);
    if (timer) {
        clearTimeout(timer);
        window.imApp.saveState.momentTimers.delete(safeMomentId);
    }

    const previousChain = window.imApp.saveState.momentFlushChains.get(safeMomentId) || Promise.resolve();
    const nextChain = previousChain.catch(() => false).then(async () => {
        const revisionBeforeSave = window.imApp.saveState.momentRevisions.get(safeMomentId) || 0;
        const saved = await window.imApp.persistMomentData(safeMomentId, options);

        if (saved) {
            const latestRevision = window.imApp.saveState.momentRevisions.get(safeMomentId) || 0;
            if (latestRevision === revisionBeforeSave) {
                window.imApp.saveState.momentDirtyIds.delete(safeMomentId);
            }
        }

        window.imApp.saveState.dirty =
            window.imApp.saveState.friendDirtyIds.size > 0 ||
            window.imApp.saveState.momentDirtyIds.size > 0 ||
            window.imApp.saveState.momentMessagesDirty ||
            window.imApp.saveState.stickersDirty ||
            window.imApp.saveState.momentsCoverDirty;

        return saved;
    });

    window.imApp.saveState.momentFlushChains.set(safeMomentId, nextChain);

    try {
        return await nextChain;
    } finally {
        if (window.imApp.saveState.momentFlushChains.get(safeMomentId) === nextChain) {
            window.imApp.saveState.momentFlushChains.delete(safeMomentId);
        }
    }
};

window.imApp.scheduleMomentSave = function(momentId, options = {}) {
    if (momentId == null) return false;
    const safeMomentId = String(momentId);
    const delay = Number.isFinite(Number(options.delay)) ? Number(options.delay) : 500;

    window.imApp.markMomentDirty(safeMomentId);

    const existingTimer = window.imApp.saveState.momentTimers.get(safeMomentId);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
        window.imApp.flushMomentSave(safeMomentId, {
            silent: options.silent !== false
        });
    }, Math.max(0, delay));

    window.imApp.saveState.momentTimers.set(safeMomentId, timer);
    return true;
};

window.imApp.flushMomentMessagesSave = async function(options = {}) {
    const saved = await window.imApp.persistMomentMessagesData(options);
    if (saved) {
        window.imApp.saveState.momentMessagesDirty = false;
    }
    window.imApp.saveState.dirty =
        window.imApp.saveState.friendDirtyIds.size > 0 ||
        window.imApp.saveState.momentDirtyIds.size > 0 ||
        window.imApp.saveState.momentMessagesDirty ||
        window.imApp.saveState.stickersDirty ||
        window.imApp.saveState.momentsCoverDirty;
    return saved;
};

window.imApp.flushStickersSave = async function(options = {}) {
    const saved = await window.imApp.persistStickersData(options);
    if (saved) {
        window.imApp.saveState.stickersDirty = false;
    }
    window.imApp.saveState.dirty =
        window.imApp.saveState.friendDirtyIds.size > 0 ||
        window.imApp.saveState.momentDirtyIds.size > 0 ||
        window.imApp.saveState.momentMessagesDirty ||
        window.imApp.saveState.stickersDirty ||
        window.imApp.saveState.momentsCoverDirty;
    return saved;
};

window.imApp.flushMomentsCoverSave = async function(options = {}) {
    const saved = await window.imApp.persistMomentsCoverData(options);
    if (saved) {
        window.imApp.saveState.momentsCoverDirty = false;
    }
    window.imApp.saveState.dirty =
        window.imApp.saveState.friendDirtyIds.size > 0 ||
        window.imApp.saveState.momentDirtyIds.size > 0 ||
        window.imApp.saveState.momentMessagesDirty ||
        window.imApp.saveState.stickersDirty ||
        window.imApp.saveState.momentsCoverDirty;
    return saved;
};

window.imApp.flushGlobalSave = async function(options = {}) {
    if (window.imApp.saveState.timer) {
        clearTimeout(window.imApp.saveState.timer);
        window.imApp.saveState.timer = null;
    }

    if (window.imApp.saveState.isSaving) {
        window.imApp.saveState.hasPendingSave = true;
        return true;
    }

    window.imApp.saveState.isSaving = true;
    try {
        do {
            window.imApp.saveState.hasPendingSave = false;

            const dirtyFriendIds = Array.from(window.imApp.saveState.friendDirtyIds);
            const dirtyMomentIds = Array.from(window.imApp.saveState.momentDirtyIds);

            for (const friendId of dirtyFriendIds) {
                const saved = await window.imApp.flushFriendSave(friendId, options);
                if (!saved) return false;
            }

            for (const momentId of dirtyMomentIds) {
                const saved = await window.imApp.flushMomentSave(momentId, options);
                if (!saved) return false;
            }

            if (window.imApp.saveState.momentMessagesDirty) {
                const saved = await window.imApp.flushMomentMessagesSave(options);
                if (!saved) return false;
            }

            if (window.imApp.saveState.stickersDirty) {
                const saved = await window.imApp.flushStickersSave(options);
                if (!saved) return false;
            }

            if (window.imApp.saveState.momentsCoverDirty) {
                const saved = await window.imApp.flushMomentsCoverSave(options);
                if (!saved) return false;
            }

            window.imApp.saveState.dirty =
                window.imApp.saveState.friendDirtyIds.size > 0 ||
                window.imApp.saveState.momentDirtyIds.size > 0 ||
                window.imApp.saveState.momentMessagesDirty ||
                window.imApp.saveState.stickersDirty ||
                window.imApp.saveState.momentsCoverDirty;
        } while (window.imApp.saveState.hasPendingSave);

        return true;
    } finally {
        window.imApp.saveState.isSaving = false;
    }
};

window.imApp.scheduleGlobalSave = function(options = {}) {
    const delay = Number.isFinite(Number(options.delay)) ? Number(options.delay) : window.imApp.saveState.delay;
    window.imApp.saveState.dirty = true;

    if (window.imApp.saveState.timer) {
        clearTimeout(window.imApp.saveState.timer);
    }

    window.imApp.saveState.timer = setTimeout(() => {
        window.imApp.flushGlobalSave({
            silent: options.silent !== false
        });
    }, Math.max(0, delay));

    return true;
};

window.imApp.commitGlobalChange = async function(mutator, options = {}) {
    const previousSnapshot = window.imApp.buildPersistedData();

    try {
        if (typeof mutator === 'function') {
            await mutator();
        }

        if (options.immediate === false) {
            window.imApp.scheduleGlobalSave({
                delay: options.delay,
                silent: options.silent !== false
            });

            if (typeof options.onSuccess === 'function') {
                options.onSuccess(window.imData);
            }
            return true;
        }

        const saved = await window.imApp.flushGlobalSave({
            silent: !!options.silent
        });

        if (!saved) {
            window.imData.friends = previousSnapshot.friends;
            window.imData.moments = previousSnapshot.moments;
            window.imData.momentMessages = previousSnapshot.momentMessages;
            window.imData.stickers = previousSnapshot.stickers;
            window.imData.momentsCoverUrl = previousSnapshot.momentsCoverUrl;
            if (typeof options.onRollback === 'function') {
                options.onRollback(window.imData);
            }
            return false;
        }

        if (typeof options.onSuccess === 'function') {
            options.onSuccess(window.imData);
        }

        return true;
    } catch (e) {
        console.error('Failed to commit global change', e);
        window.imData.friends = previousSnapshot.friends;
        window.imData.moments = previousSnapshot.moments;
        window.imData.momentMessages = previousSnapshot.momentMessages;
        window.imData.stickers = previousSnapshot.stickers;
        window.imData.momentsCoverUrl = previousSnapshot.momentsCoverUrl;
        if (typeof options.onRollback === 'function') {
            options.onRollback(window.imData);
        }
        if (!options.silent && window.showToast) {
            window.showToast('保存失败，已撤销本次修改');
        }
        return false;
    }
};

window.imApp.commitFriendChange = async function(friendId, mutator, options = {}) {
    const friends = Array.isArray(window.imData.friends) ? window.imData.friends : [];
    const targetIndex = friends.findIndex(
        friend => String(friend.id) === String(friendId)
    );
    const previousFriend = targetIndex > -1
        ? window.imApp.cloneDataSnapshot(friends[targetIndex])
        : null;

    try {
        const targetFriend = targetIndex > -1 ? friends[targetIndex] : null;

        if (typeof mutator === 'function') {
            await mutator(targetFriend, friends, targetIndex);
        }

        if (options.metaOnly === true && targetFriend) {
            const safeFriendId = String(friendId);
            const nextPatch = window.imApp.buildFriendMetaPatch(previousFriend, targetFriend);
            const existingPatch = window.imApp.saveState.pendingFriendPatches.get(safeFriendId) || {};
            window.imApp.saveState.pendingFriendPatches.set(safeFriendId, {
                ...existingPatch,
                ...nextPatch
            });
        }

        window.imApp.markFriendDirty(friendId);

        if (options.immediate === false) {
            window.imApp.scheduleFriendSave(friendId, {
                delay: options.delay,
                silent: options.silent !== false,
                metaOnly: options.metaOnly === true,
                includeMessages: options.includeMessages
            });

            if (typeof options.onSuccess === 'function') {
                options.onSuccess(window.imData.friends);
            }
            return true;
        }

        const saved = await window.imApp.flushFriendSave(friendId, {
            silent: !!options.silent,
            metaOnly: options.metaOnly === true,
            includeMessages: options.includeMessages
        });

        if (!saved) {
            if (targetIndex > -1) {
                if (previousFriend) {
                    window.imData.friends[targetIndex] = previousFriend;
                } else {
                    window.imData.friends.splice(targetIndex, 1);
                }
            }
            if (typeof options.onRollback === 'function') {
                options.onRollback(window.imData.friends);
            }
            return false;
        }

        if (typeof options.onSuccess === 'function') {
            options.onSuccess(window.imData.friends);
        }

        return true;
    } catch (e) {
        console.error('Failed to commit friend change', e);
        if (targetIndex > -1) {
            if (previousFriend) {
                window.imData.friends[targetIndex] = previousFriend;
            } else {
                window.imData.friends.splice(targetIndex, 1);
            }
        }
        if (typeof options.onRollback === 'function') {
            options.onRollback(window.imData.friends);
        }
        if (!options.silent && window.showToast) {
            window.showToast('保存失败，已撤销本次修改');
        }
        return false;
    }
};

window.imApp.commitFriendsChange = async function(mutator, options = {}) {
    if (window.imApp.ensureDataReady && !window.imData.ready) {
        await window.imApp.ensureDataReady();
    }

    const previousFriends = window.imApp.cloneDataSnapshot(
        Array.isArray(window.imData.friends) ? window.imData.friends : []
    );

    try {
        if (typeof mutator === 'function') {
            await mutator();
        }

        const currentFriendIds = (window.imData.friends || []).map(friend => String(friend.id));
        const deletedFriendIds = Array.isArray(options.deletedFriendIds)
            ? options.deletedFriendIds.map(String)
            : previousFriends
                .map(friend => String(friend.id))
                .filter((friendId) => !currentFriendIds.includes(friendId));

        const friendIds = Array.isArray(options.friendIds)
            ? Array.from(new Set([...options.friendIds.map(String), ...deletedFriendIds]))
            : (options.friendId != null
                ? Array.from(new Set([String(options.friendId), ...deletedFriendIds]))
                : Array.from(new Set([...currentFriendIds, ...deletedFriendIds])));

        friendIds.forEach((friendId) => window.imApp.markFriendDirty(friendId));

        if (options.immediate === false) {
            if (friendIds.length === 1) {
                window.imApp.scheduleFriendSave(friendIds[0], {
                    delay: options.delay,
                    silent: options.silent !== false,
                    metaOnly: options.metaOnly === true,
                    includeMessages: options.includeMessages
                });
            } else {
                window.imApp.scheduleGlobalSave({
                    delay: options.delay,
                    silent: options.silent !== false
                });
            }

            if (typeof options.onSuccess === 'function') {
                options.onSuccess(window.imData.friends);
            }
            return true;
        }

        const saved = friendIds.length === 1
            ? await window.imApp.flushFriendSave(friendIds[0], {
                silent: !!options.silent,
                metaOnly: options.metaOnly === true,
                includeMessages: options.includeMessages
            })
            : await window.imApp.flushGlobalSave({
                silent: !!options.silent
            });

        if (!saved) {
            window.imData.friends = previousFriends;
            if (typeof options.onRollback === 'function') {
                options.onRollback(window.imData.friends);
            }
            return false;
        }

        if (typeof options.onSuccess === 'function') {
            options.onSuccess(window.imData.friends);
        }

        deletedFriendIds.forEach((friendId) => {
            window.dispatchEvent(new CustomEvent('u2:friend-removed', {
                detail: { friendId }
            }));
        });

        return true;
    } catch (e) {
        console.error('Failed to commit friends change', e);
        window.imData.friends = previousFriends;
        if (typeof options.onRollback === 'function') {
            options.onRollback(window.imData.friends);
        }
        if (!options.silent && window.showToast) {
            window.showToast('保存失败，已撤销本次修改');
        }
        return false;
    }
};

window.imApp.commitMomentChange = async function(momentId, mutator, options = {}) {
    const moments = Array.isArray(window.imData.moments) ? window.imData.moments : [];
    const targetIndex = moments.findIndex(
        moment => String(moment.id) === String(momentId)
    );
    const previousMoment = targetIndex > -1
        ? window.imApp.cloneDataSnapshot(moments[targetIndex])
        : null;

    try {
        const targetMoment = targetIndex > -1 ? moments[targetIndex] : null;

        if (typeof mutator === 'function') {
            await mutator(targetMoment, moments, targetIndex);
        }

        window.imApp.markMomentDirty(momentId);

        if (options.immediate === false) {
            window.imApp.scheduleMomentSave(momentId, {
                delay: options.delay,
                silent: options.silent !== false
            });

            if (typeof options.onSuccess === 'function') {
                options.onSuccess(window.imData.moments);
            }
            return true;
        }

        const saved = await window.imApp.flushMomentSave(momentId, {
            silent: !!options.silent
        });

        if (!saved) {
            if (targetIndex > -1) {
                if (previousMoment) {
                    window.imData.moments[targetIndex] = previousMoment;
                } else {
                    window.imData.moments.splice(targetIndex, 1);
                }
            }
            if (typeof options.onRollback === 'function') {
                options.onRollback(window.imData.moments);
            }
            return false;
        }

        if (typeof options.onSuccess === 'function') {
            options.onSuccess(window.imData.moments);
        }

        return true;
    } catch (e) {
        console.error('Failed to commit moment change', e);
        if (targetIndex > -1) {
            if (previousMoment) {
                window.imData.moments[targetIndex] = previousMoment;
            } else {
                window.imData.moments.splice(targetIndex, 1);
            }
        }
        if (typeof options.onRollback === 'function') {
            options.onRollback(window.imData.moments);
        }
        if (!options.silent && window.showToast) {
            window.showToast('朋友圈保存失败，已撤销本次修改');
        }
        return false;
    }
};

window.imApp.deleteMomentPermanently = async function(momentId, options = {}) {
    if (momentId == null) return false;

    const safeMomentId = String(momentId);
    let previousMoments = [];
    let previousMessages = [];

    try {
        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (window.imApp.ensureMomentsReady) await window.imApp.ensureMomentsReady();
        if (window.imApp.ensureMomentMessagesReady) await window.imApp.ensureMomentMessagesReady();

        previousMoments = window.imApp.cloneDataSnapshot(Array.isArray(window.imData.moments) ? window.imData.moments : []);
        previousMessages = window.imApp.cloneDataSnapshot(Array.isArray(window.imData.momentMessages) ? window.imData.momentMessages : []);

        const pendingTimer = window.imApp.saveState.momentTimers.get(safeMomentId);
        if (pendingTimer) {
            clearTimeout(pendingTimer);
            window.imApp.saveState.momentTimers.delete(safeMomentId);
        }

        const pendingFlush = window.imApp.saveState.momentFlushChains.get(safeMomentId);
        if (pendingFlush) {
            await pendingFlush.catch(() => false);
        }

        window.imData.moments = (Array.isArray(window.imData.moments) ? window.imData.moments : [])
            .filter(moment => String(moment?.id) !== safeMomentId);
        window.imData.momentMessages = (Array.isArray(window.imData.momentMessages) ? window.imData.momentMessages : [])
            .filter(msg => String(msg?.momentId) !== safeMomentId);

        window.imApp.saveState.momentDirtyIds.delete(safeMomentId);
        window.imApp.saveState.momentRevisions.delete(safeMomentId);
        window.imApp.saveState.momentFlushChains.delete(safeMomentId);

        if (window.imStorage?.deleteMoment) {
            const deleted = await window.imStorage.deleteMoment(momentId);
            if (deleted === false) throw new Error('deleteMoment failed');
        }
        if (window.imStorage?.saveMoments) {
            const savedMoments = await window.imStorage.saveMoments(window.imData.moments);
            if (savedMoments === false) throw new Error('saveMoments failed');
        } else if (window.imApp.saveMoments) {
            const saved = await window.imApp.saveMoments({ silent: options.silent !== false });
            if (!saved) throw new Error('saveMoments failed');
        }

        if (window.imStorage?.saveMomentMessages) {
            const savedMessages = await window.imStorage.saveMomentMessages(window.imData.momentMessages);
            if (savedMessages === false) throw new Error('saveMomentMessages failed');
            window.imApp.saveState.momentMessagesDirty = false;
        } else if (window.imApp.saveMomentMessages) {
            const saved = await window.imApp.saveMomentMessages({ silent: options.silent !== false });
            if (!saved) throw new Error('saveMomentMessages failed');
        }

        window.imApp.saveState.lastError = null;
        window.imApp.saveState.dirty =
            window.imApp.saveState.friendDirtyIds.size > 0 ||
            window.imApp.saveState.momentDirtyIds.size > 0 ||
            window.imApp.saveState.momentMessagesDirty ||
            window.imApp.saveState.stickersDirty ||
            window.imApp.saveState.momentsCoverDirty;

        return true;
    } catch (e) {
        console.error('Failed to permanently delete moment', e);
        window.imData.moments = previousMoments;
        window.imData.momentMessages = previousMessages;
        window.imApp.saveState.lastError = e;

        try {
            if (window.imStorage?.saveMoments) {
                await window.imStorage.saveMoments(previousMoments);
            }
            if (window.imStorage?.saveMomentMessages) {
                await window.imStorage.saveMomentMessages(previousMessages);
            }
        } catch (restoreError) {
            console.error('Failed to restore moment deletion rollback', restoreError);
        }

        if (!options.silent && window.showToast) {
            window.showToast('朋友圈删除失败，已恢复');
        }
        return false;
    }
};

window.imApp.saveFriends = async function(options = {}) {
    return window.imApp.flushGlobalSave(options);
};

window.imApp.saveMoments = async function(options = {}) {
    return window.imApp.flushGlobalSave(options);
};

window.imApp.saveMomentMessages = async function(options = {}) {
    window.imApp.markMomentMessagesDirty();
    if (options.immediate === false) {
        window.imApp.scheduleGlobalSave({
            delay: options.delay,
            silent: options.silent !== false
        });
        return true;
    }
    return window.imApp.flushMomentMessagesSave(options);
};

window.imApp.saveStickers = async function(options = {}) {
    window.imApp.markStickersDirty();
    if (options.immediate === false) {
        window.imApp.scheduleGlobalSave({
            delay: options.delay,
            silent: options.silent !== false
        });
        return true;
    }
    return window.imApp.flushStickersSave(options);
};

window.imApp.commitStickersChange = async function(mutator, options = {}) {
    const previousStickers = window.imApp.cloneDataSnapshot(
        Array.isArray(window.imData.stickers) ? window.imData.stickers : []
    );

    try {
        if (typeof mutator === 'function') {
            await mutator(window.imData.stickers);
        }

        window.imApp.markStickersDirty();

        if (options.immediate === false) {
            window.imApp.scheduleGlobalSave({
                delay: options.delay,
                silent: options.silent !== false
            });

            if (typeof options.onSuccess === 'function') {
                options.onSuccess(window.imData.stickers);
            }
            window.dispatchEvent(new CustomEvent('u2:stickers-data-changed', {
                detail: { stickers: window.imData.stickers }
            }));
            return true;
        }

        const saved = await window.imApp.flushStickersSave({
            silent: !!options.silent
        });

        if (!saved) {
            window.imData.stickers = previousStickers;
            if (typeof options.onRollback === 'function') {
                options.onRollback(window.imData.stickers);
            }
            return false;
        }

        if (typeof options.onSuccess === 'function') {
            options.onSuccess(window.imData.stickers);
        }

        window.dispatchEvent(new CustomEvent('u2:stickers-data-changed', {
            detail: { stickers: window.imData.stickers }
        }));

        return true;
    } catch (e) {
        console.error('Failed to commit stickers change', e);
        window.imData.stickers = previousStickers;
        if (typeof options.onRollback === 'function') {
            options.onRollback(window.imData.stickers);
        }
        if (!options.silent && window.showToast) {
            window.showToast('表情包保存失败，已撤销本次修改');
        }
        return false;
    }
};

window.imApp.saveMomentsCover = async function(dataUrlOrUrl, options = {}) {
    window.imData.momentsCoverUrl = dataUrlOrUrl || null;
    window.imApp.markMomentsCoverDirty();
    if (options.immediate === false) {
        window.imApp.scheduleGlobalSave({
            delay: options.delay,
            silent: options.silent !== false
        });
        return window.imData.momentsCoverUrl;
    }
    const saved = await window.imApp.flushMomentsCoverSave(options);
    return saved ? window.imData.momentsCoverUrl : null;
};

window.imApp.getStorageUsage = async function() {
    try {
        if (!window.imStorage || !window.imStorage.measureApproximateUsage) return 0;
        return await window.imStorage.measureApproximateUsage();
    } catch (e) {
        console.error('Failed to measure iMessage storage usage', e);
        return 0;
    }
};

window.imApp.clearRuntimeCache = function() {
    try {
        if (window.imStorage?.clearRuntimeAssetCache) {
            window.imStorage.clearRuntimeAssetCache();
        }
        if (window.imStorage?.pruneRuntimeAssetCache) {
            window.imStorage.pruneRuntimeAssetCache(0);
        }
        return true;
    } catch (e) {
        console.error('Failed to clear iMessage runtime cache', e);
        return false;
    }
};

window.getGlobalWorldBookContextByPosition = function(position = 'before_role', contextText = '', options = {}) {
    const normalizeEntry = window.normalizeWorldBookEntry
        ? window.normalizeWorldBookEntry
        : function(entry = {}) {
            return {
                title: entry.title || entry.name || entry.keyword || '未命名词条',
                keyword: entry.keyword || '',
                content: entry.content || '',
                triggerMode: entry.triggerMode === 'keyword' ? 'keyword' : 'permanent',
                injectionPosition: ['before_role', 'after_role', 'system_depth'].includes(entry.injectionPosition)
                    ? entry.injectionPosition
                    : 'before_role',
                systemDepth: Number.isFinite(Number(entry.systemDepth)) ? Number(entry.systemDepth) : 4,
                order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : 100,
                recursive: false,
                enabled: entry.enabled !== false
            };
        };

    const keywordMatched = window.worldBookKeywordMatched
        ? window.worldBookKeywordMatched
        : function(entry, text = '') {
            if (!entry || entry.triggerMode !== 'keyword') return true;
            const keyword = entry.keyword ? String(entry.keyword).trim() : '';
            if (!keyword) return false;
            return String(text || '').includes(keyword);
        };

    const formatEntry = window.formatWorldBookEntryForPrompt
        ? window.formatWorldBookEntryForPrompt
        : function(entry) {
            const title = entry.title ? String(entry.title).trim() : '未命名词条';
            const keyword = entry.keyword ? String(entry.keyword).trim() : '';
            const content = entry.content ? String(entry.content).trim() : '';
            const triggerModeLabel = entry.triggerMode === 'keyword' ? '关键词' : '永久';

            let injectionLabel = '角色前';
            if (entry.injectionPosition === 'after_role') injectionLabel = '角色后';
            if (entry.injectionPosition === 'system_depth') injectionLabel = '系统深度';

            let block = `【${title}】\n`;
            block += `触发机制: ${triggerModeLabel}\n`;
            block += `注入位置: ${injectionLabel}\n`;

            if (entry.injectionPosition === 'system_depth') {
                block += `深度: ${entry.systemDepth}\n`;
                block += `顺序: ${entry.order}\n`;
            }

            if (entry.triggerMode === 'keyword' && keyword) {
                block += `关键词: ${keyword}\n`;
            }

            if (content) {
                block += `内容:\n${content}\n`;
            }

            return block.trim();
        };

    const titleMap = {
        before_role: 'World Book / 角色前',
        after_role: 'World Book / 角色后',
        system_depth: 'World Book / 系统深度'
    };

    const positionEntries = [];

    if (window.getWorldBooks) {
        const allBooks = window.getWorldBooks();
        if (Array.isArray(allBooks) && allBooks.length > 0) {
            const globalBooks = allBooks.filter(book => book && book.isGlobal && Array.isArray(book.entries) && book.entries.length > 0);

            globalBooks.forEach(book => {
                book.entries
                    .map(entry => normalizeEntry(entry))
                    .filter(entry => entry && entry.enabled !== false)
                    .filter(entry => entry.injectionPosition === position)
                    .filter(entry => keywordMatched(entry, contextText))
                    .forEach(entry => {
                        positionEntries.push({
                            ...entry,
                            __bookName: book.name || '未命名世界书'
                        });
                    });
            });
        }
    }

    const sections = [];

    if (positionEntries.length > 0) {
        positionEntries.sort((a, b) => {
            if (position === 'system_depth') {
                if (a.systemDepth !== b.systemDepth) return a.systemDepth - b.systemDepth;
                return a.order - b.order;
            }
            return a.order - b.order;
        });

        let section = `${titleMap[position]}:\n`;
        positionEntries.forEach(entry => {
            section += `〔${entry.__bookName}〕\n${formatEntry(entry)}\n\n`;
        });
        sections.push(section.trim());
    }

    if (options.includeBuiltin !== false && window.getBuiltinWorldBookContext) {
        const builtinSection = window.getBuiltinWorldBookContext(position, contextText);
        if (builtinSection) {
            sections.push(builtinSection.trim());
        }
    }

    return sections.join('\n\n').trim();
};

window.getGlobalWorldBookContext = function(contextText = '') {
    const positions = ['system_depth', 'before_role', 'after_role'];
    const sections = positions
        .map(position => window.getGlobalWorldBookContextByPosition(position, contextText))
        .filter(Boolean);

    return sections.join('\n\n').trim();
};

window.imApp.getWorldBookContextForFriendByPosition = function(position = 'before_role', friend = null, contextText = '', options = {}) {
    const normalizeEntry = window.normalizeWorldBookEntry
        ? window.normalizeWorldBookEntry
        : function(entry = {}) {
            return {
                title: entry.title || entry.name || entry.keyword || '未命名词条',
                keyword: entry.keyword || '',
                content: entry.content || '',
                triggerMode: entry.triggerMode === 'keyword' ? 'keyword' : 'permanent',
                injectionPosition: ['before_role', 'after_role', 'system_depth'].includes(entry.injectionPosition)
                    ? entry.injectionPosition
                    : 'before_role',
                systemDepth: Number.isFinite(Number(entry.systemDepth)) ? Number(entry.systemDepth) : 4,
                order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : 100,
                enabled: entry.enabled !== false
            };
        };

    const keywordMatched = window.worldBookKeywordMatched
        ? window.worldBookKeywordMatched
        : function(entry, text = '') {
            if (!entry || entry.triggerMode !== 'keyword') return true;
            const keyword = entry.keyword ? String(entry.keyword).trim() : '';
            if (!keyword) return false;
            return String(text || '').includes(keyword);
        };

    const formatEntry = window.formatWorldBookEntryForPrompt
        ? window.formatWorldBookEntryForPrompt
        : function(entry) {
            const title = entry.title ? String(entry.title).trim() : '未命名词条';
            const keyword = entry.keyword ? String(entry.keyword).trim() : '';
            const content = entry.content ? String(entry.content).trim() : '';
            const triggerModeLabel = entry.triggerMode === 'keyword' ? '关键词' : '永久';

            let injectionLabel = '角色前';
            if (entry.injectionPosition === 'after_role') injectionLabel = '角色后';
            if (entry.injectionPosition === 'system_depth') injectionLabel = '系统深度';

            let block = `【${title}】\n`;
            block += `触发机制: ${triggerModeLabel}\n`;
            block += `注入位置: ${injectionLabel}\n`;

            if (entry.injectionPosition === 'system_depth') {
                block += `深度: ${entry.systemDepth}\n`;
                block += `顺序: ${entry.order}\n`;
            }

            if (entry.triggerMode === 'keyword' && keyword) {
                block += `关键词: ${keyword}\n`;
            }

            if (content) {
                block += `内容:\n${content}\n`;
            }

            return block.trim();
        };

    const titleMap = {
        before_role: 'Bound World Book / 绑定角色前',
        after_role: 'Bound World Book / 绑定角色后',
        system_depth: 'Bound World Book / 绑定系统深度'
    };

    const sections = [];
    const globalContext = window.getGlobalWorldBookContextByPosition
        ? window.getGlobalWorldBookContextByPosition(position, contextText, options)
        : '';

    if (globalContext) {
        sections.push(globalContext.trim());
    }

    const normalizedFriend = friend ? window.imApp.normalizeFriendData(friend) : null;
    const boundBookIds = normalizedFriend && Array.isArray(normalizedFriend.boundBooks)
        ? normalizedFriend.boundBooks.map(id => String(id))
        : [];

    if (boundBookIds.length > 0 && window.getWorldBooks) {
        const allBooks = window.getWorldBooks();
        const boundEntries = [];

        if (Array.isArray(allBooks)) {
            allBooks
                .filter(book => book && boundBookIds.includes(String(book.id)) && Array.isArray(book.entries))
                .forEach(book => {
                    book.entries
                        .map(entry => normalizeEntry(entry))
                        .filter(entry => entry && entry.enabled !== false)
                        .filter(entry => entry.injectionPosition === position)
                        .filter(entry => keywordMatched(entry, contextText))
                        .forEach(entry => {
                            boundEntries.push({
                                ...entry,
                                __bookName: book.name || '未命名世界书'
                            });
                        });
                });
        }

        if (boundEntries.length > 0) {
            boundEntries.sort((a, b) => {
                if (position === 'system_depth') {
                    if (a.systemDepth !== b.systemDepth) return a.systemDepth - b.systemDepth;
                    return a.order - b.order;
                }
                return a.order - b.order;
            });

            let section = `${titleMap[position]}:\n`;
            boundEntries.forEach(entry => {
                section += `〔${entry.__bookName}〕\n${formatEntry(entry)}\n\n`;
            });
            sections.push(section.trim());
        }
    }

    return sections.join('\n\n').trim();
};

window.getWorldBookContextForFriendByPosition = function(position = 'before_role', friend = null, contextText = '', options = {}) {
    return window.imApp.getWorldBookContextForFriendByPosition(position, friend, contextText, options);
};

window.imApp.getWorldBookContextForFriendByPosition = function(position = 'before_role', friend = null, contextText = '', options = {}) {
    const normalizeEntry = window.normalizeWorldBookEntry
        ? window.normalizeWorldBookEntry
        : function(entry = {}) {
            return {
                title: entry.title || entry.name || entry.keyword || '未命名词条',
                keyword: entry.keyword || '',
                content: entry.content || '',
                triggerMode: entry.triggerMode === 'keyword' ? 'keyword' : 'permanent',
                injectionPosition: ['before_role', 'after_role', 'system_depth'].includes(entry.injectionPosition)
                    ? entry.injectionPosition
                    : 'before_role',
                systemDepth: Number.isFinite(Number(entry.systemDepth)) ? Number(entry.systemDepth) : 4,
                order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : 100,
                enabled: entry.enabled !== false
            };
        };

    const keywordMatched = window.worldBookKeywordMatched
        ? window.worldBookKeywordMatched
        : function(entry, text = '') {
            if (!entry || entry.triggerMode !== 'keyword') return true;
            const keyword = entry.keyword ? String(entry.keyword).trim() : '';
            if (!keyword) return false;
            return String(text || '').includes(keyword);
        };

    const formatEntry = window.formatWorldBookEntryForPrompt
        ? window.formatWorldBookEntryForPrompt
        : function(entry) {
            const title = entry.title ? String(entry.title).trim() : '未命名词条';
            const keyword = entry.keyword ? String(entry.keyword).trim() : '';
            const content = entry.content ? String(entry.content).trim() : '';
            const triggerModeLabel = entry.triggerMode === 'keyword' ? '关键词' : '永久';

            let injectionLabel = '角色前';
            if (entry.injectionPosition === 'after_role') injectionLabel = '角色后';
            if (entry.injectionPosition === 'system_depth') injectionLabel = '系统深度';

            let block = `【${title}】\n`;
            block += `触发机制: ${triggerModeLabel}\n`;
            block += `注入位置: ${injectionLabel}\n`;

            if (entry.injectionPosition === 'system_depth') {
                block += `深度: ${entry.systemDepth}\n`;
                block += `顺序: ${entry.order}\n`;
            }

            if (entry.triggerMode === 'keyword' && keyword) {
                block += `关键词: ${keyword}\n`;
            }

            if (content) {
                block += `内容:\n${content}\n`;
            }

            return block.trim();
        };

    const titleMap = {
        before_role: 'Bound World Book / 绑定角色前',
        after_role: 'Bound World Book / 绑定角色后',
        system_depth: 'Bound World Book / 绑定系统深度'
    };

    const sections = [];
    const globalContext = window.getGlobalWorldBookContextByPosition
        ? window.getGlobalWorldBookContextByPosition(position, contextText, options)
        : '';

    if (globalContext) {
        sections.push(globalContext.trim());
    }

    const normalizedFriend = friend ? window.imApp.normalizeFriendData(friend) : null;
    const boundBookIds = normalizedFriend && Array.isArray(normalizedFriend.boundBooks)
        ? normalizedFriend.boundBooks.map(id => String(id))
        : [];

    if (boundBookIds.length > 0 && window.getWorldBooks) {
        const allBooks = window.getWorldBooks();
        const boundEntries = [];

        if (Array.isArray(allBooks)) {
            allBooks
                .filter(book => book && boundBookIds.includes(String(book.id)) && Array.isArray(book.entries))
                .forEach(book => {
                    book.entries
                        .map(entry => normalizeEntry(entry))
                        .filter(entry => entry && entry.enabled !== false)
                        .filter(entry => entry.injectionPosition === position)
                        .filter(entry => keywordMatched(entry, contextText))
                        .forEach(entry => {
                            boundEntries.push({
                                ...entry,
                                __bookName: book.name || '未命名世界书'
                            });
                        });
                });
        }

        if (boundEntries.length > 0) {
            boundEntries.sort((a, b) => {
                if (position === 'system_depth') {
                    if (a.systemDepth !== b.systemDepth) return a.systemDepth - b.systemDepth;
                    return a.order - b.order;
                }
                return a.order - b.order;
            });

            let section = `${titleMap[position]}:\n`;
            boundEntries.forEach(entry => {
                section += `〔${entry.__bookName}〕\n${formatEntry(entry)}\n\n`;
            });
            sections.push(section.trim());
        }
    }

    return sections.join('\n\n').trim();
};

window.getWorldBookContextForFriendByPosition = function(position = 'before_role', friend = null, contextText = '', options = {}) {
    return window.imApp.getWorldBookContextForFriendByPosition(position, friend, contextText, options);
};

window.getImFriends = () => window.imData.friends;

window.addImFriend = async function(friendData) {
    const friend = window.imApp.normalizeFriendData({
        id: Date.now(),
        type: friendData.type || 'char',
        realName: friendData.realName || '',
        nickname: friendData.nickname || 'New Friend',
        signature: friendData.signature || 'No Signature',
        persona: friendData.persona || '',
        avatarUrl: friendData.avatarUrl || null,
        messages: [],
        chatBg: null,
        customCssEnabled: false,
        customCss: '',
        memory: window.imApp.createDefaultMemory()
    });

    const saved = window.imApp.commitFriendsChange
        ? await window.imApp.commitFriendsChange(() => {
            window.imData.friends.push(friend);
        }, { friendId: friend.id, silent: true })
        : false;

    if (!saved) {
        if (window.showToast) window.showToast('添加好友保存失败');
        return false;
    }

    if (window.imApp.renderFriendsList) window.imApp.renderFriendsList();
    if (window.showToast) window.showToast(`已添加好友: ${friend.nickname}`);
    return true;
};

window.imApp.formatTime = function(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

      if (isToday) return `${hours}:${minutes}`;
      if (isYesterday) return `Yesterday`;
      return `${date.getMonth() + 1}/${date.getDate()} ${hours}:${minutes}`;
  };

window.imApp.addMomentNotification = async function(type, user, momentId, contentOrPayload = '', thought = '') {
    const payload = contentOrPayload && typeof contentOrPayload === 'object'
        ? contentOrPayload
        : { content: contentOrPayload, thought };
    const notif = {
        id: Date.now(),
        type: type,
        userId: user.id || user.userId,
        userName: user.nickname || user.name,
        userAvatar: user.avatarUrl || user.avatar,
        momentId: momentId,
        momentImg: null,
        momentText: null,
        content: String(payload.content || '').trim(),
        contentTranslation: String(payload.contentTranslation || payload.translation || '').trim(),
        thought: String(payload.thought || '').trim(),
        thoughtTranslation: String(payload.thoughtTranslation || '').trim(),
        language: window.imDataUtils?.normalizeChatLanguage
            ? window.imDataUtils.normalizeChatLanguage(payload.language || user.language || 'zh')
            : String(payload.language || user.language || 'zh'),
        time: Date.now(),
        read: false
    };

    const m = window.imData.moments.find(x => x.id === momentId);
    if (m) {
        if (m.images && m.images.length > 0) {
            const img = m.images[0];
            notif.momentImg = (typeof img === 'object') ? img.src : img;
        }
        notif.momentText = m.text;
    }

    const previousMessages = Array.isArray(window.imData.momentMessages)
        ? (typeof structuredClone === 'function'
            ? structuredClone(window.imData.momentMessages)
            : JSON.parse(JSON.stringify(window.imData.momentMessages)))
        : [];

    window.imData.momentMessages.unshift(notif);
    const saved = await window.imApp.saveMomentMessages({ silent: true });
    if (!saved) {
        window.imData.momentMessages = previousMessages;
        if (window.imApp.renderMomentsMessages) window.imApp.renderMomentsMessages();
        if (window.imApp.updateMomentsNewMessageBubble) window.imApp.updateMomentsNewMessageBubble();
        if (window.showToast) window.showToast('朋友圈消息保存失败');
        return false;
    }

    if (window.imApp.renderMomentsMessages) window.imApp.renderMomentsMessages();
    if (window.imApp.updateMomentsNewMessageBubble) window.imApp.updateMomentsNewMessageBubble();
    window.dispatchEvent(new CustomEvent('u2:moment-notification-added', { detail: { notificationId: notif.id } }));
    return true;
};

window.imApp.getImessageUiState = function() {
    const rawState = typeof window.getAppState === 'function'
        ? window.getAppState('imessage')
        : null;
    const safeState = rawState && typeof rawState === 'object' ? rawState : {};
    const uiState = safeState.uiState && typeof safeState.uiState === 'object' ? safeState.uiState : {};

    const hasLegacyOfflineThemeCss = (theme) => (
        typeof theme?.customCss === 'string' && theme.customCss.includes('offline-tavern')
    );
    const needsOfflineThemeCssMigration = hasLegacyOfflineThemeCss(uiState.offlineTheme)
        || (Array.isArray(uiState.offlineThemePresets) && uiState.offlineThemePresets.some(hasLegacyOfflineThemeCss));
    const offlineThemePresets = window.imApp.normalizeOfflineThemePresets(uiState.offlineThemePresets);
    const offlineTheme = window.imApp.normalizeOfflineThemeState(uiState.offlineTheme);
    if (offlineTheme.activePresetId && !offlineThemePresets.some(preset => preset.id === offlineTheme.activePresetId)) {
        offlineTheme.activePresetId = '';
    }

    return {
        cssPresets: Array.isArray(uiState.cssPresets) ? uiState.cssPresets : [],
        offlineTheme,
        offlineThemePresets,
        hasOfflineTheme: !!(uiState.offlineTheme && typeof uiState.offlineTheme === 'object'),
        needsOfflineThemeCssMigration,
        offlinePrompts: Array.isArray(uiState.offlinePrompts) ? uiState.offlinePrompts : [],
        offlinePromptPresets: Array.isArray(uiState.offlinePromptPresets) ? uiState.offlinePromptPresets : [],
        offlinePromptActivePresetId: String(uiState.offlinePromptActivePresetId || '').trim(),
        offlinePromptsInitialized: uiState.offlinePromptsInitialized === true
    };
};

window.imApp.saveImessageUiState = function() {
    const currentState = typeof window.getAppState === 'function'
        ? (window.getAppState('imessage') || {})
        : {};
    const nextState = {
        ...currentState,
        uiState: {
            ...(currentState && currentState.uiState && typeof currentState.uiState === 'object' ? currentState.uiState : {}),
            cssPresets: Array.isArray(window.imData.cssPresets) ? window.imData.cssPresets : [],
            offlineTheme: window.imApp.normalizeOfflineThemeState(window.imData.offlineTheme),
            offlineThemePresets: window.imApp.normalizeOfflineThemePresets(window.imData.offlineThemePresets),
            offlinePrompts: Array.isArray(window.imData.offlinePrompts) ? window.imData.offlinePrompts : [],
            offlinePromptPresets: Array.isArray(window.imData.offlinePromptPresets) ? window.imData.offlinePromptPresets : [],
            offlinePromptActivePresetId: String(window.imData.offlinePromptActivePresetId || '').trim(),
            offlinePromptsInitialized: window.imData.offlinePromptsInitialized === true
        }
    };

    if (typeof window.setAppState === 'function') {
        window.setAppState('imessage', nextState);
    } else if (window.saveGlobalData) {
        window.saveGlobalData();
    }

    return nextState;
};

window.imApp.initializeData = async function() {
    if (window.imData.ready) return window.imData;

    try {
        if (window.imStorage) {
            if (window.__iisoNeedsLegacyStorageReset && window.imStorage.clearAllData) {
                try {
                    await window.imStorage.clearAllData();
                    console.warn('Legacy iMessage IndexedDB data cleared due to storage schema upgrade.');
                } catch (clearError) {
                    console.error('Failed to clear legacy iMessage IndexedDB data during schema upgrade', clearError);
                } finally {
                    window.__iisoNeedsLegacyStorageReset = false;
                }
            }

            const initialPayload = {
                friends: window.imStorage.loadFriends
                    ? await window.imStorage.loadFriends()
                    : [],
                momentsCoverUrl: window.imStorage.loadMomentsCoverUrl
                    ? await window.imStorage.loadMomentsCoverUrl()
                    : null
            };
            const legacySocialAccountFriendIds = [];

            window.imData.friends = Array.isArray(initialPayload.friends)
                ? initialPayload.friends.map((friend) => {
                    if (Array.isArray(friend?.memory?.socialAccounts) && friend.id != null) {
                        legacySocialAccountFriendIds.push(String(friend.id));
                    }
                    const normalizedFriend = window.imApp.normalizeFriendData(friend);
                    normalizedFriend.messages = Array.isArray(friend.messages) ? friend.messages : [];
                    normalizedFriend.messagesLoaded = !!friend.messagesLoaded || normalizedFriend.messages.length > 0;
                    normalizedFriend.lastMessagePreview = typeof friend.lastMessagePreview === 'string'
                        ? friend.lastMessagePreview
                        : '';
                    normalizedFriend.lastMessageTimestamp = Number(friend.lastMessageTimestamp) || 0;
                    normalizedFriend.messageCount = Number(friend.messageCount) || normalizedFriend.messages.length || 0;
                    return normalizedFriend;
                })
                : [];
            window.imData.moments = [];
            window.imData.momentMessages = [];
            window.imData.stickers = [];
            window.imData.momentsCoverUrl = initialPayload.momentsCoverUrl || null;
            window.imData.momentsLoaded = false;
            window.imData.momentMessagesLoaded = false;
            window.imData.stickersLoaded = false;

            if (legacySocialAccountFriendIds.length > 0 && window.imStorage.saveFriendMeta) {
                Promise.all(legacySocialAccountFriendIds.map(friendId => {
                    const normalizedFriend = window.imApp.getFriendById(friendId);
                    return normalizedFriend ? window.imStorage.saveFriendMeta(normalizedFriend) : null;
                })).catch(error => console.warn('Failed to remove legacy social-account memory data', error));
            }
        } else {
            console.warn('imStorage not available, iMessage will run with volatile in-memory state.');
        }

        const globalUiState = window.imApp.getImessageUiState
            ? window.imApp.getImessageUiState()
            : { cssPresets: [], offlineTheme: window.imApp.createDefaultOfflineThemeState(), offlineThemePresets: [], hasOfflineTheme: false, offlinePrompts: [], offlinePromptPresets: [], offlinePromptActivePresetId: '', offlinePromptsInitialized: false };
        window.imData.cssPresets = Array.isArray(globalUiState.cssPresets) ? globalUiState.cssPresets : [];
        window.imData.offlineTheme = window.imApp.normalizeOfflineThemeState(globalUiState.offlineTheme);
        window.imData.offlineThemePresets = window.imApp.normalizeOfflineThemePresets(globalUiState.offlineThemePresets);
        window.imData.offlineThemeInitialized = !!globalUiState.hasOfflineTheme;
        window.imData.offlinePrompts = Array.isArray(globalUiState.offlinePrompts) ? globalUiState.offlinePrompts : [];
        window.imData.offlinePromptPresets = Array.isArray(globalUiState.offlinePromptPresets) ? globalUiState.offlinePromptPresets : [];
        window.imData.offlinePromptActivePresetId = String(globalUiState.offlinePromptActivePresetId || '').trim();
        window.imData.offlinePromptsInitialized = globalUiState.offlinePromptsInitialized === true;

        if (globalUiState.needsOfflineThemeCssMigration && window.imApp.saveImessageUiState) {
            window.imApp.saveImessageUiState();
        }

        window.imData.ready = true;

        if (window.appStorage?.setMeta) {
            window.appStorage.setMeta('imessage_runtime', {
                storageMode: 'indexeddb',
                dataVersion: 3,
                friendsCount: Array.isArray(window.imData.friends) ? window.imData.friends.length : 0,
                lastSyncAt: Date.now()
            }).catch((error) => console.warn('Failed to persist iMessage runtime metadata', error));
        }

        document.dispatchEvent(new CustomEvent('imessage-data-ready'));
    } catch (e) {
        console.error('Failed to initialize iMessage data', e);
        window.imData.ready = true;
        document.dispatchEvent(new CustomEvent('imessage-data-ready'));
    }

    return window.imData;
};

window.imApp.dataReadyPromise = window.imApp.initializeData();

window.imApp.ensureDataReady = async function() {
    return window.imApp.dataReadyPromise;
};

window.imApp.ensureMomentsReady = async function() {
    if (window.imData.momentsLoaded) {
        return Array.isArray(window.imData.moments) ? window.imData.moments : [];
    }

    if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();

    try {
        const moments = window.imStorage?.loadMoments
            ? await window.imStorage.loadMoments()
            : [];
        window.imData.moments = Array.isArray(moments) ? moments : [];
        window.imData.momentsLoaded = true;
    } catch (e) {
        console.error('Failed to lazy load moments', e);
        window.imData.moments = Array.isArray(window.imData.moments) ? window.imData.moments : [];
        window.imData.momentsLoaded = true;
    }

    return window.imData.moments;
};

window.imApp.ensureMomentMessagesReady = async function() {
    if (window.imData.momentMessagesLoaded) {
        return Array.isArray(window.imData.momentMessages) ? window.imData.momentMessages : [];
    }

    if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();

    try {
        const messages = window.imStorage?.loadMomentMessages
            ? await window.imStorage.loadMomentMessages()
            : [];
        window.imData.momentMessages = Array.isArray(messages) ? messages : [];
        window.imData.momentMessagesLoaded = true;
    } catch (e) {
        console.error('Failed to lazy load moment messages', e);
        window.imData.momentMessages = Array.isArray(window.imData.momentMessages) ? window.imData.momentMessages : [];
        window.imData.momentMessagesLoaded = true;
    }

    return window.imData.momentMessages;
};

window.imApp.ensureStickersReady = async function() {
    if (window.imData.stickersLoaded) {
        return Array.isArray(window.imData.stickers) ? window.imData.stickers : [];
    }

    if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();

    try {
        const stickers = window.imStorage?.loadStickers
            ? await window.imStorage.loadStickers()
            : [];
        window.imData.stickers = Array.isArray(stickers) ? stickers : [];
        window.imData.stickersLoaded = true;
    } catch (e) {
        console.error('Failed to lazy load stickers', e);
        window.imData.stickers = Array.isArray(window.imData.stickers) ? window.imData.stickers : [];
        window.imData.stickersLoaded = true;
    }

    return window.imData.stickers;
};

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && window.imApp?.saveState?.dirty) {
        window.imApp.flushGlobalSave({ silent: true });
    }
});

window.addEventListener('pagehide', () => {
    if (window.imApp?.saveState?.dirty) {
        window.imApp.flushGlobalSave({ silent: true });
    }
});

(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    const { UI, userState, apiConfig, openView, closeView, showToast, syncUIs } = window;

    async function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target?.result || null);
            reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    async function loadImageFromDataUrl(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = dataUrl;
        });
    }

    function canvasToDataUrl(canvas, mimeType = 'image/jpeg', quality = 0.82) {
        try {
            return canvas.toDataURL(mimeType, quality);
        } catch (e) {
            return canvas.toDataURL();
        }
    }

    async function compressImageFile(file, options = {}) {
        if (!file) return null;

        const {
            maxWidth = 1080,
            maxHeight = 1080,
            mimeType = 'image/jpeg',
            quality = 0.82
        } = options;

        const rawDataUrl = await readFileAsDataUrl(file);
        if (!rawDataUrl) return null;

        const img = await loadImageFromDataUrl(rawDataUrl);
        const naturalWidth = img.naturalWidth || img.width || 0;
        const naturalHeight = img.naturalHeight || img.height || 0;

        if (!naturalWidth || !naturalHeight) {
            return rawDataUrl;
        }

        const scale = Math.min(
            1,
            maxWidth / naturalWidth,
            maxHeight / naturalHeight
        );

        const targetWidth = Math.max(1, Math.round(naturalWidth * scale));
        const targetHeight = Math.max(1, Math.round(naturalHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return rawDataUrl;
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        return canvasToDataUrl(canvas, mimeType, quality);
    }

    async function createSquareAvatarFromDataUrl(dataUrl, options = {}) {
        const sourceUrl = String(dataUrl || '').trim();
        if (!/^data:image\//i.test(sourceUrl)) return null;

        const {
            size = 256,
            mimeType = 'image/jpeg',
            quality = 0.84
        } = options;
        const targetSize = Math.max(1, Math.min(512, Math.round(Number(size) || 256)));
        const img = await loadImageFromDataUrl(sourceUrl);
        const naturalWidth = img.naturalWidth || img.width || 0;
        const naturalHeight = img.naturalHeight || img.height || 0;
        const sourceSize = Math.min(naturalWidth, naturalHeight);
        if (!sourceSize) return null;

        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const sourceX = Math.max(0, Math.round((naturalWidth - sourceSize) / 2));
        const sourceY = Math.max(0, Math.round((naturalHeight - sourceSize) / 2));
        ctx.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, targetSize, targetSize);
        return canvasToDataUrl(canvas, mimeType, quality);
    }

    window.imApp = window.imApp || {};
    window.imApp.readFileAsDataUrl = readFileAsDataUrl;
    window.imApp.compressImageFile = compressImageFile;
    window.imApp.createSquareAvatarFromDataUrl = createSquareAvatarFromDataUrl;

    // --- Custom Modal Logic ---
    const customModalOverlay = document.getElementById('custom-modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalConfirmContent = document.getElementById('modal-confirm-content');
    const modalPromptContent = document.getElementById('modal-prompt-content');
    const modalMessage = document.getElementById('modal-message');
    const modalInput = document.getElementById('modal-input');
    const modalInputGroup = document.getElementById('modal-input-group');
    const modalTextareaGroup = document.getElementById('modal-textarea-group');
    const modalTextarea = document.getElementById('modal-textarea');
    const modalToggleGroup = document.getElementById('modal-toggle-group');
    const modalToggleLabel = document.getElementById('modal-toggle-label');
    const modalToggleInput = document.getElementById('modal-toggle-input');
    const modalReferenceFaceGroup = document.getElementById('modal-reference-face-group');
    const modalReferenceFacePreview = document.getElementById('modal-reference-face-preview');
    const modalReferenceFaceTitle = document.getElementById('modal-reference-face-title');
    const modalReferenceFaceStatus = document.getElementById('modal-reference-face-status');
    const modalReferenceFaceUploadBtn = document.getElementById('modal-reference-face-upload-btn');
    const modalReferenceFaceDeleteBtn = document.getElementById('modal-reference-face-delete-btn');
    const modalReferenceFaceInput = document.getElementById('modal-reference-face-input');
    const modalImageComposerGroup = document.getElementById('modal-image-composer-group');
    const modalImageComposerPreview = document.getElementById('modal-image-composer-preview');
    const modalImageComposerStatus = document.getElementById('modal-image-composer-status');
    const modalImageComposerUploadBtn = document.getElementById('modal-image-composer-upload-btn');
    const modalImageComposerRemoveBtn = document.getElementById('modal-image-composer-remove-btn');
    const modalImageComposerRecognizeBtn = document.getElementById('modal-image-composer-recognize-btn');
    const modalImageComposerInput = document.getElementById('modal-image-composer-input');
    const modalGenerationPromptGroup = document.getElementById('modal-generation-prompt-group');
    const modalGenerationPresetSelect = document.getElementById('modal-generation-preset-select');
    const modalGenerationSavePresetBtn = document.getElementById('modal-generation-save-preset-btn');
    const modalAutoImageGenerationToggle = document.getElementById('modal-auto-image-generation-toggle');
    const modalAutoReferenceFaceToggle = document.getElementById('modal-auto-reference-face-toggle');
    const modalAutoReferenceFaceHint = document.getElementById('modal-auto-reference-face-hint');
    const modalGenerationCharAppearance = document.getElementById('modal-generation-char-appearance');
    const modalGenerationUserAppearance = document.getElementById('modal-generation-user-appearance');
    const modalGenerationArtistPrompt = document.getElementById('modal-generation-artist-prompt');
    const modalGenerationNegativePrompt = document.getElementById('modal-generation-negative-prompt');
    
    // Buttons
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalPromptConfirmBtn = document.getElementById('modal-prompt-confirm-btn');

    let currentModalCallback = null;
    let currentModalCancelCallback = null;
    let currentModalReferenceFace = null;
    let currentModalImageComposer = null;
    let currentModalGenerationPrompt = null;

    function renderModalImageComposer(composer) {
        currentModalImageComposer = composer || null;
        const imageUrl = String(composer?.imageUrl || '');
        const previewImage = modalImageComposerPreview?.querySelector('img');
        const previewIcon = modalImageComposerPreview?.querySelector('i');
        if (modalImageComposerGroup) modalImageComposerGroup.style.display = composer ? 'block' : 'none';
        if (modalImageComposerStatus) modalImageComposerStatus.textContent = imageUrl
            ? (composer?.fileName || '已选择图片')
            : '未选择图片时发送虚拟图片';
        if (modalImageComposerUploadBtn) modalImageComposerUploadBtn.textContent = imageUrl ? '更换' : '上传';
        if (modalImageComposerRemoveBtn) modalImageComposerRemoveBtn.style.display = imageUrl ? '' : 'none';
        if (modalImageComposerRecognizeBtn) modalImageComposerRecognizeBtn.style.display = imageUrl ? 'block' : 'none';
        if (previewImage && previewIcon) {
            if (imageUrl) {
                previewImage.src = imageUrl;
                previewImage.style.display = 'block';
                previewIcon.style.display = 'none';
            } else {
                previewImage.removeAttribute('src');
                previewImage.style.display = 'none';
                previewIcon.style.display = '';
            }
        }
    }

    function renderModalReferenceFace(referenceFace, enableAfterUpload = false) {
        currentModalReferenceFace = referenceFace || null;
        const imageUrl = String(referenceFace?.imageUrl || '');
        const previewImage = modalReferenceFacePreview?.querySelector('img');
        const previewIcon = modalReferenceFacePreview?.querySelector('i');
        if (modalReferenceFaceGroup) modalReferenceFaceGroup.style.display = referenceFace ? 'flex' : 'none';
        if (modalReferenceFaceTitle) modalReferenceFaceTitle.textContent = referenceFace?.title || '角色参考脸';
        if (modalReferenceFaceStatus) modalReferenceFaceStatus.textContent = imageUrl
            ? (referenceFace?.fileName || '已上传')
            : '尚未上传';
        if (modalReferenceFaceUploadBtn) modalReferenceFaceUploadBtn.textContent = imageUrl ? '更换' : '上传';
        if (modalReferenceFaceDeleteBtn) modalReferenceFaceDeleteBtn.style.display = imageUrl ? '' : 'none';
        if (previewImage && previewIcon) {
            if (imageUrl) {
                previewImage.src = imageUrl;
                previewImage.style.display = 'block';
                previewIcon.style.display = 'none';
            } else {
                previewImage.removeAttribute('src');
                previewImage.style.display = 'none';
                previewIcon.style.display = '';
            }
        }
        if (modalToggleGroup) modalToggleGroup.style.display = imageUrl ? 'flex' : 'none';
        if (modalToggleLabel) modalToggleLabel.textContent = '本次使用参考脸';
        if (modalToggleInput) {
            modalToggleInput.checked = imageUrl && enableAfterUpload;
            modalToggleInput.disabled = !imageUrl;
        }
        syncModalAutoReferenceFaceToggle();
    }

    function syncModalAutoReferenceFaceToggle() {
        if (!modalAutoReferenceFaceToggle) return;
        const hasReferenceFace = !!String(currentModalReferenceFace?.imageUrl || '').trim();
        modalAutoReferenceFaceToggle.disabled = !hasReferenceFace;
        if (!hasReferenceFace) modalAutoReferenceFaceToggle.checked = false;
        if (modalAutoReferenceFaceHint) {
            modalAutoReferenceFaceHint.textContent = hasReferenceFace
                ? '自动生图时使用当前角色参考脸'
                : '请先上传角色参考脸';
        }
    }

    function showCustomModal(options) {
        if (!customModalOverlay) return;
        
        modalTitle.textContent = options.title || '提示';
        currentModalCallback = options.onConfirm;
        currentModalCancelCallback = options.onCancel;
        currentModalReferenceFace = null;
        currentModalImageComposer = null;
        currentModalGenerationPrompt = options.generationPrompt || null;

        if (options.type === 'prompt') {
            const useTextarea = options.multiline === true;
            modalConfirmBtn.style.display = 'none';
            modalPromptConfirmBtn.style.display = 'block';
            modalConfirmContent.style.display = 'none';
            modalPromptContent.style.display = 'block';
            
            modalMessage.textContent = options.message || '';
            if (modalInputGroup) modalInputGroup.style.display = useTextarea ? 'none' : '';
            if (modalTextareaGroup) modalTextareaGroup.style.display = useTextarea ? 'block' : 'none';
            if (modalInput) {
                modalInput.value = useTextarea ? '' : (options.defaultValue || '');
                modalInput.placeholder = options.placeholder || '';
            }
            if (modalTextarea) {
                modalTextarea.value = useTextarea ? (options.defaultValue || '') : '';
                modalTextarea.placeholder = options.placeholder || '';
            }
            if (options.imageComposer) renderModalImageComposer(options.imageComposer);
            else if (modalImageComposerGroup) modalImageComposerGroup.style.display = 'none';
            if (modalGenerationPromptGroup) modalGenerationPromptGroup.style.display = options.generationPrompt ? 'block' : 'none';
            if (modalGenerationPresetSelect) {
                modalGenerationPresetSelect.replaceChildren();
                const currentOption = document.createElement('option');
                currentOption.value = '';
                currentOption.textContent = '当前编辑内容';
                modalGenerationPresetSelect.appendChild(currentOption);
                (Array.isArray(options.generationPrompt?.presets) ? options.generationPrompt.presets : []).forEach((preset) => {
                    const option = document.createElement('option');
                    option.value = String(preset.id || '');
                    option.textContent = String(preset.name || '未命名预设');
                    modalGenerationPresetSelect.appendChild(option);
                });
                modalGenerationPresetSelect.value = String(options.generationPrompt?.activePresetId || '');
                modalGenerationPresetSelect.disabled = !options.generationPrompt?.presets?.length;
            }
            if (modalAutoImageGenerationToggle) {
                modalAutoImageGenerationToggle.checked = options.generationPrompt?.autoGenerate === true;
            }
            if (modalAutoReferenceFaceToggle) {
                modalAutoReferenceFaceToggle.checked = options.generationPrompt?.autoUseReferenceFace === true;
            }
            if (modalGenerationCharAppearance) modalGenerationCharAppearance.value = options.generationPrompt?.charAppearance || '';
            if (modalGenerationUserAppearance) modalGenerationUserAppearance.value = options.generationPrompt?.userAppearance || '';
            if (modalGenerationArtistPrompt) modalGenerationArtistPrompt.value = options.generationPrompt?.artistPrompt || '';
            if (modalGenerationNegativePrompt) modalGenerationNegativePrompt.value = options.generationPrompt?.negativePrompt || '';
            if (options.referenceFace) renderModalReferenceFace(options.referenceFace);
            else {
                if (modalReferenceFaceGroup) modalReferenceFaceGroup.style.display = 'none';
                if (modalToggleGroup) modalToggleGroup.style.display = options.toggle ? 'flex' : 'none';
                if (modalToggleLabel) modalToggleLabel.textContent = options.toggle?.label || '';
                if (modalToggleInput) {
                    modalToggleInput.checked = !!options.toggle?.checked;
                    modalToggleInput.disabled = !!options.toggle?.disabled;
                }
                syncModalAutoReferenceFaceToggle();
            }
            modalPromptConfirmBtn.textContent = options.confirmText || '确认';
            modalPromptConfirmBtn.style.background = options.confirmTone === 'dark' ? '#111' : '#007aff';
            modalPromptConfirmBtn.style.color = '#fff';
        } else {
            modalConfirmBtn.style.display = 'block';
            modalPromptConfirmBtn.style.display = 'none';
            modalConfirmContent.style.display = 'block';
            modalPromptContent.style.display = 'none';
            if (modalToggleGroup) modalToggleGroup.style.display = 'none';
            if (modalReferenceFaceGroup) modalReferenceFaceGroup.style.display = 'none';
            if (modalImageComposerGroup) modalImageComposerGroup.style.display = 'none';
            if (modalGenerationPromptGroup) modalGenerationPromptGroup.style.display = 'none';
            if (modalGenerationPresetSelect) {
                modalGenerationPresetSelect.replaceChildren();
                modalGenerationPresetSelect.disabled = true;
            }
            if (modalAutoImageGenerationToggle) modalAutoImageGenerationToggle.checked = false;
            if (modalAutoReferenceFaceToggle) {
                modalAutoReferenceFaceToggle.checked = false;
                modalAutoReferenceFaceToggle.disabled = true;
            }
            if (modalAutoReferenceFaceHint) modalAutoReferenceFaceHint.textContent = '请先上传角色参考脸';
            
            modalMessage.textContent = options.message || '';
            modalConfirmBtn.textContent = options.confirmText || '确认';
            const isDeleteAction = options.isDestructive && String(options.confirmText || '').trim() === '删除';
            const isDarkAction = options.confirmTone === 'dark';
            modalConfirmBtn.style.color = isDeleteAction || isDarkAction ? '#fff' : (options.isDestructive ? '#ff3b30' : '#2c2c2e');
            modalConfirmBtn.style.background = isDeleteAction || isDarkAction ? '#111' : '';
            modalConfirmBtn.style.borderRadius = isDeleteAction ? '12px' : '';
            modalConfirmBtn.style.fontWeight = isDeleteAction ? '700' : '';
        }

        customModalOverlay.style.display = 'flex';
        void customModalOverlay.offsetWidth; // force reflow
        customModalOverlay.classList.add('active');
        
        const sheet = customModalOverlay.querySelector('.bottom-sheet');
        if(sheet) sheet.style.transform = 'translateY(0)';

        if (options.type === 'prompt') {
            if (options.multiline === true) {
                setTimeout(() => modalTextarea?.focus(), 300);
            } else {
                setTimeout(() => modalInput.focus(), 300);
            }
        }
    }

    function getCurrentModalPromptState() {
        const promptValue = modalTextareaGroup?.style.display === 'block'
            ? (modalTextarea?.value || '')
            : (modalInput?.value || '');
        return {
            promptValue,
            toggleChecked: !!modalToggleInput?.checked,
            referenceImage: currentModalReferenceFace?.imageUrl || '',
            uploadedImage: currentModalImageComposer?.imageUrl || '',
            uploadedFileName: currentModalImageComposer?.fileName || '',
            charAppearance: modalGenerationCharAppearance?.value || '',
            userAppearance: modalGenerationUserAppearance?.value || '',
            artistPrompt: modalGenerationArtistPrompt?.value || '',
            negativePrompt: modalGenerationNegativePrompt?.value || '',
            activePresetId: modalGenerationPresetSelect?.value || '',
            autoGenerate: modalAutoImageGenerationToggle?.checked === true,
            autoUseReferenceFace: modalAutoReferenceFaceToggle?.checked === true,
            presets: Array.isArray(currentModalGenerationPrompt?.presets)
                ? currentModalGenerationPrompt.presets
                : []
        };
    }

    function closeCustomModal(isCancel = true) {
        if (!customModalOverlay) return;
        customModalOverlay.classList.remove('active');
        setTimeout(() => {
            customModalOverlay.style.display = 'none';
        }, 300);
        if (isCancel && typeof currentModalCancelCallback === 'function') {
            currentModalCancelCallback(getCurrentModalPromptState());
        }
        currentModalCallback = null;
        currentModalCancelCallback = null;
        currentModalReferenceFace = null;
        currentModalImageComposer = null;
        currentModalGenerationPrompt = null;
    }

    window.imApp.showCustomModal = showCustomModal;
    window.imApp.closeCustomModal = closeCustomModal;

    // Export for legacy compatibility if any other app uses it directly
    window.showCustomModal = showCustomModal;
    window.closeCustomModal = closeCustomModal;

    if (modalCancelBtn) modalCancelBtn.addEventListener('click', () => closeCustomModal(true));
    
    if (modalConfirmBtn) {
        modalConfirmBtn.addEventListener('click', () => {
            if (currentModalCallback) currentModalCallback(true);
            closeCustomModal(false);
        });
    }

    if (modalPromptConfirmBtn) {
        modalPromptConfirmBtn.addEventListener('click', () => {
            const modalState = getCurrentModalPromptState();
            const callbackResult = currentModalCallback
                ? currentModalCallback(modalState.promptValue, modalState)
                : undefined;
            if (callbackResult === false) return;
            closeCustomModal(false);
        });
    }

    modalReferenceFaceUploadBtn?.addEventListener('click', () => modalReferenceFaceInput?.click());
    modalReferenceFaceInput?.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || typeof currentModalReferenceFace?.onUpload !== 'function') return;
        try {
            modalReferenceFaceUploadBtn.disabled = true;
            const result = await currentModalReferenceFace.onUpload(file);
            if (result?.imageUrl) {
                renderModalReferenceFace({ ...currentModalReferenceFace, ...result }, true);
            }
        } catch (error) {
            window.showToast?.(error?.message || '参考脸上传失败');
        } finally {
            modalReferenceFaceUploadBtn.disabled = false;
        }
    });
    modalReferenceFaceDeleteBtn?.addEventListener('click', async () => {
        if (typeof currentModalReferenceFace?.onDelete !== 'function') return;
        try {
            modalReferenceFaceDeleteBtn.disabled = true;
            await currentModalReferenceFace.onDelete();
            renderModalReferenceFace({ ...currentModalReferenceFace, imageUrl: '', fileName: '' });
        } catch (error) {
            window.showToast?.(error?.message || '参考脸删除失败');
        } finally {
            modalReferenceFaceDeleteBtn.disabled = false;
        }
    });

    modalImageComposerUploadBtn?.addEventListener('click', () => modalImageComposerInput?.click());
    modalImageComposerInput?.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || typeof currentModalImageComposer?.onUpload !== 'function') return;
        try {
            modalImageComposerUploadBtn.disabled = true;
            const result = await currentModalImageComposer.onUpload(file);
            if (result?.imageUrl) renderModalImageComposer({ ...currentModalImageComposer, ...result });
        } catch (error) {
            window.showToast?.(error?.message || '图片处理失败');
        } finally {
            modalImageComposerUploadBtn.disabled = false;
        }
    });
    modalImageComposerRemoveBtn?.addEventListener('click', () => {
        renderModalImageComposer({ ...currentModalImageComposer, imageUrl: '', fileName: '' });
    });
    modalImageComposerRecognizeBtn?.addEventListener('click', async () => {
        if (!currentModalImageComposer?.imageUrl || typeof currentModalImageComposer?.onRecognize !== 'function') return;
        try {
            modalImageComposerRecognizeBtn.disabled = true;
            modalImageComposerRecognizeBtn.textContent = '正在识图…';
            const description = String(await currentModalImageComposer.onRecognize(currentModalImageComposer.imageUrl) || '').trim();
            if (!description) throw new Error('识图接口没有返回图片内容');
            if (modalTextareaGroup?.style.display === 'block' && modalTextarea) modalTextarea.value = description;
            else if (modalInput) modalInput.value = description;
            window.showToast?.('已生成图片内容');
        } catch (error) {
            window.showToast?.(error?.message || '图片识别失败');
        } finally {
            modalImageComposerRecognizeBtn.disabled = false;
            modalImageComposerRecognizeBtn.textContent = '识图生成图片内容';
        }
    });
    modalGenerationPresetSelect?.addEventListener('change', async () => {
        const generationPrompt = currentModalGenerationPrompt;
        if (!generationPrompt) return;
        const presetId = String(modalGenerationPresetSelect.value || '').trim();
        const preset = (Array.isArray(generationPrompt.presets) ? generationPrompt.presets : [])
            .find((item) => String(item?.id || '') === presetId);
        if (preset) {
            if (modalTextarea) modalTextarea.value = preset.prompt || '';
            if (modalGenerationCharAppearance) modalGenerationCharAppearance.value = preset.charAppearance || '';
            if (modalGenerationUserAppearance) modalGenerationUserAppearance.value = preset.userAppearance || '';
            if (modalGenerationArtistPrompt) modalGenerationArtistPrompt.value = preset.artistPrompt || '';
            if (modalGenerationNegativePrompt) modalGenerationNegativePrompt.value = preset.negativePrompt || '';
        }
        if (typeof generationPrompt.onPresetSelect === 'function') {
            try {
                await generationPrompt.onPresetSelect(presetId, preset || null);
            } catch (error) {
                window.showToast?.(error?.message || '提示词预设切换失败');
            }
        }
    });

    modalGenerationSavePresetBtn?.addEventListener('click', async () => {
        const generationPrompt = currentModalGenerationPrompt;
        if (!generationPrompt) return;
        const prompt = String(modalTextarea?.value || modalInput?.value || '').trim();
        if (!prompt) {
            window.showToast?.('请输入生图提示词后再保存预设');
            return;
        }
        const defaultName = modalGenerationPresetSelect?.selectedOptions?.[0]?.textContent || '';
        const name = String(window.prompt('请输入预设名称', defaultName === '当前编辑内容' ? '' : defaultName) || '').trim();
        if (!name) return;
        const now = Date.now();
        const existing = (Array.isArray(generationPrompt.presets) ? generationPrompt.presets : [])
            .find((item) => String(item?.name || '').trim() === name);
        const preset = {
            id: existing?.id || `image-preset-${now}-${Math.random().toString(36).slice(2, 7)}`,
            name,
            prompt,
            charAppearance: String(modalGenerationCharAppearance?.value || '').trim(),
            userAppearance: String(modalGenerationUserAppearance?.value || '').trim(),
            artistPrompt: String(modalGenerationArtistPrompt?.value || '').trim(),
            negativePrompt: String(modalGenerationNegativePrompt?.value || '').trim(),
            createdAt: existing?.createdAt || now,
            updatedAt: now
        };
        const presets = (Array.isArray(generationPrompt.presets) ? generationPrompt.presets : [])
            .filter((item) => String(item?.id || '') !== String(preset.id));
        presets.push(preset);
        generationPrompt.presets = presets.slice(-30);
        generationPrompt.activePresetId = preset.id;
        if (modalGenerationPresetSelect) {
            const option = Array.from(modalGenerationPresetSelect.options).find((item) => item.value === preset.id);
            if (!option) {
                const newOption = document.createElement('option');
                newOption.value = preset.id;
                newOption.textContent = preset.name;
                modalGenerationPresetSelect.appendChild(newOption);
            }
            modalGenerationPresetSelect.disabled = false;
            modalGenerationPresetSelect.value = preset.id;
        }
        try {
            if (typeof generationPrompt.onSavePreset === 'function') {
                await generationPrompt.onSavePreset({ preset, presets: generationPrompt.presets, activePresetId: preset.id });
            }
            window.showToast?.('提示词预设已保存');
        } catch (error) {
            window.showToast?.(error?.message || '提示词预设保存失败');
        }
    });

    if (customModalOverlay) {
        customModalOverlay.addEventListener('click', (e) => {
            if (e.target === customModalOverlay) closeCustomModal(true);
        });
    }

    // --- iMessage (LINE Style) View Initialization ---
    const imessageView = document.getElementById('imessage-view');
    const dockIcon = document.getElementById('dock-icon-imessage');
    
    if (dockIcon) {
        dockIcon.addEventListener('click', (e) => {
            if (window.isJiggleMode || window.preventAppClick) { e.preventDefault(); e.stopPropagation(); return; }
            if (syncUIs) syncUIs();
            openView(imessageView);
            
            // Sync user avatar
            if (window.imApp.syncMomentsUser) window.imApp.syncMomentsUser();
            // Render friends to ensure up to date
            if (window.imApp.renderFriendsList) window.imApp.renderFriendsList();
            if (window.imApp.renderGroupsList) window.imApp.renderGroupsList();
            if (window.imApp.updateChatsUnreadBadges) window.imApp.updateChatsUnreadBadges();
        });
    }

    const imHeaderLeft = document.querySelector('.line-header-left');
    if (imHeaderLeft) {
        imHeaderLeft.addEventListener('click', () => {
            closeView(imessageView);
        });
    }

    const imHeaderRight = document.querySelector('.line-header-right');
    if (imHeaderRight) {
        const bookmarkBtn = imHeaderRight.querySelector('.fa-bookmark');
        const settingsBtn = imHeaderRight.querySelector('.fa-cog');

        if(bookmarkBtn) bookmarkBtn.addEventListener('click', () => { if(window.showToast) window.showToast('Bookmark clicked'); });
        if(settingsBtn) settingsBtn.addEventListener('click', () => { if(window.showToast) window.showToast('Settings clicked'); });
    }

    function ensureStickersViewInApp() {
        const stickersViewEl = document.getElementById('stickers-view');
        const appEl = document.getElementById('app');
        if (stickersViewEl && appEl && stickersViewEl.parentNode !== appEl) {
            appEl.appendChild(stickersViewEl);
        }
        return stickersViewEl;
    }

    const imServiceItems = document.querySelectorAll('.line-service-item');
    imServiceItems.forEach(item => {
        item.addEventListener('click', async () => {
            if (item.dataset.imessageService === 'stickers') {
                try {
                    if (window.imApp?.ensureStickersReady) {
                        await window.imApp.ensureStickersReady();
                    }
                } catch (error) {
                    console.error('Failed to lazy load stickers', error);
                    if (window.showToast) window.showToast('表情数据加载失败');
                }

                // Open stickers view
                const stickersViewEl = ensureStickersViewInApp();
                if (stickersViewEl && window.openView) {
                    stickersViewEl.style.display = 'flex';
                    window.openView(stickersViewEl);
                    if (typeof renderStickersView === 'function') {
                        renderStickersView();
                    }
                } else {
                    console.error('Stickers view or openView not found');
                }
            } else {
                // Ignore general service clicks
            }
        });
    });

    // --- Stickers Feature Logic ---
    const stickersView = ensureStickersViewInApp();
    const stickersBackBtn = document.getElementById('stickers-back-btn');
    const stickersAddBtn = document.getElementById('stickers-add-btn');
    const stickersEditBtn = document.getElementById('stickers-edit-btn');
    const addStickerSheet = document.getElementById('add-sticker-sheet');
    const stickersListContainer = document.getElementById('stickers-list-container');
    const stickerCategoryNameInput = document.getElementById('sticker-category-name');
    const stickerLocalUploadBtn = document.getElementById('sticker-local-upload-btn');
    const stickerLocalUploadInput = document.getElementById('sticker-local-upload-input');
    const stickerLocalPreview = document.getElementById('sticker-local-preview');
    const stickerUrlInput = document.getElementById('sticker-url-input');
    const confirmAddStickerBtn = document.getElementById('confirm-add-sticker-btn');
    const stickerManifestUploadBtn = document.getElementById('sticker-manifest-upload-btn');
    const stickerManifestUploadInput = document.getElementById('sticker-manifest-upload-input');
    const stickerDetailSheet = document.getElementById('sticker-category-detail-sheet');
    const stickerDetailTitle = document.getElementById('sticker-detail-title');
    const stickerDetailCount = document.getElementById('sticker-detail-count');
    const stickerDetailGrid = document.getElementById('sticker-detail-grid');
    const stickerDetailBindBtn = document.getElementById('sticker-detail-bind-btn');
    const stickerDetailDeleteCategoryBtn = document.getElementById('sticker-detail-delete-category-btn');
    const stickerDetailBatchBar = document.getElementById('sticker-detail-batch-bar');
    const stickerBatchDeleteBtn = document.getElementById('batch-delete-toggle');

    // Temporary storage for local uploaded images
    let pendingLocalStickers = [];

    let activeStickerCategoryName = '';

    if (stickersBackBtn && stickersView) {
        stickersBackBtn.addEventListener('click', () => {
            if (window.closeView) window.closeView(stickersView);
            else stickersView.style.display = 'none';
        });
    }

    // Open add sticker sheet
    if (stickersAddBtn) {
        stickersAddBtn.addEventListener('click', () => {
            if (addStickerSheet) {
                addStickerSheet.style.display = 'flex';
                void addStickerSheet.offsetWidth;
                addStickerSheet.classList.add('active');
                const sheet = addStickerSheet.querySelector('.bottom-sheet');
                if (sheet) sheet.style.transform = 'translateY(0)';
                // Reset form
                if (stickerCategoryNameInput) stickerCategoryNameInput.value = '';
                if (stickerUrlInput) stickerUrlInput.value = '';
                if (stickerLocalPreview) {
                    stickerLocalPreview.innerHTML = '';
                    stickerLocalPreview.classList.remove('has-items');
                }
                pendingLocalStickers = [];
            }
        });
    }

    // Close add sticker sheet
    function closeAddStickerSheet() {
        if (addStickerSheet) {
            addStickerSheet.classList.remove('active');
            setTimeout(() => {
                addStickerSheet.style.display = 'none';
                if (stickerLocalPreview) {
                    stickerLocalPreview.innerHTML = '';
                    stickerLocalPreview.classList.remove('has-items');
                }
                pendingLocalStickers = [];
            }, 300);
        }
    }

    if (addStickerSheet) {
        addStickerSheet.addEventListener('click', (e) => {
            if (e.target === addStickerSheet) closeAddStickerSheet();
        });
    }

    // Local file upload trigger
    if (stickerLocalUploadBtn && stickerLocalUploadInput) {
        stickerLocalUploadBtn.addEventListener('click', () => {
            stickerLocalUploadInput.click();
        });

        stickerLocalUploadInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;

            pendingLocalStickers = [];
            if (stickerLocalPreview) {
                stickerLocalPreview.innerHTML = '';
                stickerLocalPreview.classList.add('has-items');
            }

            Array.from(files).forEach(async (file, index) => {
                try {
                    const dataUrl = window.imApp.compressImageFile
                        ? await window.imApp.compressImageFile(file, {
                            maxWidth: 256,
                            maxHeight: 256,
                            mimeType: 'image/jpeg',
                            quality: 0.8
                        })
                        : await window.imApp.readFileAsDataUrl(file);

                    const name = file.name.replace(/\.[^/.]+$/, '') || `sticker_${index + 1}`;
                    
                    // Store with temporary index, will update name from input
                    const stickerObj = { name, url: dataUrl };
                    pendingLocalStickers.push(stickerObj);

                    // Show preview with name input
                    if (stickerLocalPreview) {
                        const previewContainer = document.createElement('div');
                        previewContainer.className = 'sticker-preview-item';
                        
                        const previewImg = document.createElement('img');
                        previewImg.src = dataUrl;
                        previewImg.className = 'sticker-preview-img';
                        
                        const nameInput = document.createElement('input');
                        nameInput.type = 'text';
                        nameInput.value = name;
                        nameInput.className = 'sticker-name-input';
                        nameInput.placeholder = '名称';
                        
                        // Update name when input changes
                        nameInput.addEventListener('input', () => {
                            const idx = pendingLocalStickers.findIndex(s => s.url === dataUrl);
                            if (idx !== -1) {
                                pendingLocalStickers[idx].name = nameInput.value || name;
                            }
                        });
                        
                        previewContainer.appendChild(previewImg);
                        previewContainer.appendChild(nameInput);
                        stickerLocalPreview.appendChild(previewContainer);
                    }
                } catch (error) {
                    console.error('Failed to process sticker image', error);
                    if (showToast) showToast('表情图片处理失败');
                }
            });

            // Reset input for re-upload
            stickerLocalUploadInput.value = '';
        });
    }

    async function readStickerManifestFile(file) {
        const fileName = String(file?.name || '').toLowerCase();
        if (fileName.endsWith('.docx')) {
            await window.u2LoadVendorLibrary?.('mammoth');
            if (!window.mammoth?.extractRawText) throw new Error('DOCX 解析组件未加载');
            const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
            return String(result?.value || '');
        }
        return String(await file.text()).replace(/\u0000/g, '');
    }

    if (stickerManifestUploadBtn && stickerManifestUploadInput) {
        stickerManifestUploadBtn.addEventListener('click', () => stickerManifestUploadInput.click());
        stickerManifestUploadInput.addEventListener('change', async () => {
            const file = stickerManifestUploadInput.files?.[0];
            stickerManifestUploadInput.value = '';
            if (!file) return;
            const lowerName = String(file.name || '').toLowerCase();
            if (!lowerName.endsWith('.txt') && !lowerName.endsWith('.text') && !lowerName.endsWith('.docx')) {
                if (showToast) showToast('仅支持 TXT 和 DOCX 文件');
                return;
            }
            try {
                const text = await readStickerManifestFile(file);
                const parsed = window.imDataUtils?.parseStickerManifestText
                    ? window.imDataUtils.parseStickerManifestText(text)
                    : { items: [], invalidLines: [] };
                if (parsed.items.length === 0) {
                    if (showToast) showToast('文件中没有有效的名称和 URL 记录');
                    return;
                }
                const normalizedText = parsed.items.map(item => `${item.name} ${item.url}`).join('\n');
                if (stickerUrlInput) {
                    const existing = stickerUrlInput.value.trim();
                    stickerUrlInput.value = existing ? `${existing}\n${normalizedText}` : normalizedText;
                    stickerUrlInput.focus();
                }
                if (showToast) {
                    showToast(parsed.invalidLines.length > 0
                        ? `已读取 ${parsed.items.length} 条，第 ${parsed.invalidLines.join('、')} 行格式无效`
                        : `已读取 ${parsed.items.length} 条贴图记录`);
                }
            } catch (error) {
                console.error('Failed to import sticker manifest', error);
                if (showToast) showToast(error?.message || '贴图清单读取失败');
            }
        });
    }

    // Confirm add sticker
    if (confirmAddStickerBtn) {
        confirmAddStickerBtn.addEventListener('click', async () => {
            const categoryName = stickerCategoryNameInput ? stickerCategoryNameInput.value.trim() : '';
            if (!categoryName) {
                if (showToast) showToast('请输入分类名称');
                return;
            }

            // Parse URL input
            const parsedManifest = window.imDataUtils?.parseStickerManifestText
                ? window.imDataUtils.parseStickerManifestText(stickerUrlInput?.value || '')
                : { items: [], invalidLines: [] };
            const urlStickers = parsedManifest.items;
            if (parsedManifest.invalidLines.length > 0) {
                if (showToast) showToast(`第 ${parsedManifest.invalidLines.join('、')} 行格式无效，请修改后重试`);
                return;
            }

            // Combine all stickers
            const allNewStickers = [...pendingLocalStickers, ...urlStickers];
            if (allNewStickers.length === 0) {
                if (showToast) showToast('请添加至少一张表情');
                return;
            }

            const saved = window.imApp.commitStickersChange
                ? await window.imApp.commitStickersChange(() => {
                    if (!window.imData.stickers) window.imData.stickers = [];
                    let category = window.imData.stickers.find(c => c.categoryName === categoryName);
                    if (category) {
                        category.items = Array.isArray(category.items) ? category.items.concat(allNewStickers) : [...allNewStickers];
                    } else {
                        window.imData.stickers.push({
                            categoryName,
                            items: allNewStickers
                        });
                    }
                }, { silent: true })
                : (window.imApp.saveStickers
                    ? await (async () => {
                        if (!window.imData.stickers) window.imData.stickers = [];
                        let category = window.imData.stickers.find(c => c.categoryName === categoryName);
                        if (category) {
                            category.items = Array.isArray(category.items) ? category.items.concat(allNewStickers) : [...allNewStickers];
                        } else {
                            window.imData.stickers.push({
                                categoryName,
                                items: allNewStickers
                            });
                        }
                        return window.imApp.saveStickers({ silent: true });
                    })()
                    : false);

            if (!saved) {
                if (showToast) showToast('表情包保存失败');
                return;
            }

            renderStickersView();
            closeAddStickerSheet();
            if (showToast) showToast(`已添加 ${allNewStickers.length} 张表情到 "${categoryName}"`);
        });
    }

    // Batch delete mode state
    let batchDeleteMode = false;
    let selectedStickers = new Set();

    // Edit button to toggle batch delete mode
    if (stickersEditBtn) {
        stickersEditBtn.addEventListener('click', () => {
            batchDeleteMode = !batchDeleteMode;
            selectedStickers.clear();
            stickersEditBtn.innerHTML = batchDeleteMode ? '<i class="fas fa-check"></i>' : '<i class="fas fa-pen"></i>';
            renderStickersView(batchDeleteMode);
        });
    }

    function getStickerBindableFriends() {
        return (Array.isArray(window.imData.friends) ? window.imData.friends : [])
            .filter(friend => friend && friend.id != null && friend.type !== 'group');
    }

    function getStickerBoundFriends(categoryName) {
        return getStickerBindableFriends()
            .filter(friend => Array.isArray(friend.mountedStickers) && friend.mountedStickers.includes(categoryName));
    }

    function openStickerBindingDialog(categoryName) {
        const safeCategoryName = String(categoryName || '').trim();
        if (!safeCategoryName) return;

        const chars = getStickerBindableFriends();
        if (chars.length === 0) {
            if (showToast) showToast('No chars available');
            return;
        }

        let overlay = document.getElementById('sticker-bind-role-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'sticker-bind-role-overlay';
            overlay.style.cssText = 'position:fixed; inset:0; z-index:10020; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,0.24); padding:18px;';
            overlay.innerHTML = `
                <div class="sticker-bind-role-card" style="width:min(100%,360px); max-height:78vh; display:flex; flex-direction:column; background:#fff; border-radius:24px;  overflow:hidden;">
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:16px 18px; border-bottom:1px solid #f2f2f7;">
                        <div style="min-width:0;">
                            <div style="font-size:17px; font-weight:800; color:#111;">Bind Roles</div>
                            <div class="sticker-bind-role-subtitle" style="font-size:12px; color:#8e8e93; margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></div>
                        </div>
                        <button type="button" class="sticker-bind-role-close" style="width:32px; height:32px; border:none; border-radius:50%; background:#f2f2f7; color:#636366; cursor:pointer;"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="sticker-bind-role-list" style="padding:8px; overflow-y:auto;"></div>
                    <div style="display:flex; gap:8px; padding:12px 14px 14px; border-top:1px solid #f2f2f7;">
                        <button type="button" class="sticker-bind-role-cancel" style="flex:1; height:42px; border:none; border-radius:16px; background:#f2f2f7; color:#555; font-size:15px; font-weight:700; cursor:pointer;">Cancel</button>
                        <button type="button" class="sticker-bind-role-save" style="flex:1; height:42px; border:none; border-radius:16px; background:#111; color:#fff; font-size:15px; font-weight:800; cursor:pointer;">Save</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) overlay.style.display = 'none';
            });
            overlay.querySelector('.sticker-bind-role-close')?.addEventListener('click', () => {
                overlay.style.display = 'none';
            });
            overlay.querySelector('.sticker-bind-role-cancel')?.addEventListener('click', () => {
                overlay.style.display = 'none';
            });
        }

        const subtitle = overlay.querySelector('.sticker-bind-role-subtitle');
        const list = overlay.querySelector('.sticker-bind-role-list');
            const saveBtn = overlay.querySelector('.sticker-bind-role-save');
        if (subtitle) subtitle.textContent = safeCategoryName;
        if (!list || !saveBtn) return;

        list.innerHTML = '';
        chars.forEach(char => {
            const selected = Array.isArray(char.mountedStickers) && char.mountedStickers.includes(safeCategoryName);
            const item = document.createElement('label');
            item.style.cssText = 'display:flex; align-items:center; gap:12px; padding:10px; border-radius:16px; cursor:pointer;';
            item.innerHTML = `
                <input type="checkbox" data-friend-id="${char.id}" ${selected ? 'checked' : ''} style="width:18px; height:18px; accent-color:#111;">
                <div style="width:34px; height:34px; border-radius:50%; overflow:hidden; background:#f2f2f7; color:#8e8e93; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    ${char.avatarUrl ? `<img src="${char.avatarUrl}" style="width:100%; height:100%; object-fit:cover;">` : `<span>${String(char.nickname || char.realName || '?').charAt(0)}</span>`}
                </div>
                <div style="min-width:0; flex:1; font-size:14px; color:#111; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${char.nickname || char.realName || 'Char'}</div>
            `;
            list.appendChild(item);
        });

        saveBtn.onclick = async () => {
            const checkedIds = new Set(Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map(input => String(input.dataset.friendId)));
            const touchedIds = chars.map(char => String(char.id));
            const saved = window.imApp.commitFriendsChange
                ? await window.imApp.commitFriendsChange(() => {
                    chars.forEach(char => {
                        const shouldBind = checkedIds.has(String(char.id));
                        const mounted = Array.isArray(char.mountedStickers) ? char.mountedStickers : [];
                        const nextMounted = mounted.filter(name => name !== safeCategoryName);
                        if (shouldBind) nextMounted.push(safeCategoryName);
                        char.mountedStickers = Array.from(new Set(nextMounted));
                    });
                }, { silent: true, friendIds: touchedIds, metaOnly: true })
                : false;

            if (!saved) {
                if (showToast) showToast('Bind failed');
                return;
            }

            const activeFriend = window.imData.currentActiveFriend;
            if (activeFriend && touchedIds.includes(String(activeFriend.id))) {
                const latestActive = (window.imData.friends || []).find(friend => String(friend.id) === String(activeFriend.id));
                if (latestActive) window.imData.currentActiveFriend = latestActive;
            }

            const settingsFriend = window.imData.currentSettingsFriend;
            if (settingsFriend && touchedIds.includes(String(settingsFriend.id))) {
                const latestSettings = (window.imData.friends || []).find(friend => String(friend.id) === String(settingsFriend.id));
                if (latestSettings) window.imData.currentSettingsFriend = latestSettings;
            }

            overlay.style.display = 'none';
            renderStickersView(true);
            window.dispatchEvent(new CustomEvent('u2:stickers-binding-changed', {
                detail: {
                    categoryName: safeCategoryName,
                    boundFriendIds: Array.from(checkedIds)
                }
            }));
            if (showToast) showToast('Bound');
        };

        overlay.style.display = 'flex';
    }

    // Render stickers view
    function renderLegacyStickersView(keepBatchMode) {
        if (!stickersListContainer) return;
        stickersListContainer.innerHTML = '';
        
        // If not explicitly keeping batch mode, reset it
        if (!keepBatchMode) {
            batchDeleteMode = false;
            selectedStickers.clear();
            if (stickersEditBtn) stickersEditBtn.innerHTML = '<i class="fas fa-pen"></i>';
        }

        const stickers = window.imData.stickers || [];
        if (stickers.length === 0) {
            stickersListContainer.innerHTML = '<div style="text-align: center; color: #8e8e93; padding: 40px;">No stickers yet. Tap + to add.</div>';
            return;
        }

        // Floating batch delete bar (fixed at bottom when in batch mode)
        if (batchDeleteMode) {
            const batchBar = document.createElement('div');
            batchBar.id = 'batch-delete-bar';
            batchBar.style.cssText = 'position: sticky; top: 0; z-index: 50; display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: rgba(255,255,255,0.95);   border-radius: 16px; margin-bottom: 12px; ';
            
            const selectInfo = document.createElement('div');
            selectInfo.id = 'batch-select-info';
            selectInfo.style.cssText = 'font-size: 14px; color: #8e8e93; font-weight: 500;';
            selectInfo.textContent = `已选择 ${selectedStickers.size} 项`;
            
            const batchDeleteBtn = document.createElement('div');
            batchDeleteBtn.id = 'batch-delete-toggle';
            batchDeleteBtn.style.cssText = 'background: #ff3b30; color: #fff; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;';
            batchDeleteBtn.innerHTML = '<i class="fas fa-trash"></i> 删除所选';
            batchDeleteBtn.addEventListener('click', async () => {
                if (selectedStickers.size === 0) {
                    if (showToast) showToast('请先选择要删除的表情');
                    return;
                }
                // Sort selected keys in reverse order to safely splice
                const sortedKeys = Array.from(selectedStickers).sort((a, b) => {
                    const [aCat, aIdx] = a.split('-').map(Number);
                    const [bCat, bIdx] = b.split('-').map(Number);
                    if (aCat !== bCat) return bCat - aCat;
                    return bIdx - aIdx;
                });
                const count = sortedKeys.length;

                const saved = window.imApp.commitStickersChange
                    ? await window.imApp.commitStickersChange(() => {
                        sortedKeys.forEach(key => {
                            const [catIdx, stickerIdx] = key.split('-').map(Number);
                            if (window.imData.stickers[catIdx]?.items?.[stickerIdx]) {
                                window.imData.stickers[catIdx].items.splice(stickerIdx, 1);
                            }
                        });
                        window.imData.stickers = (window.imData.stickers || []).filter(c => Array.isArray(c.items) && c.items.length > 0);
                    }, { silent: true })
                    : (window.imApp.saveStickers
                        ? await (async () => {
                            sortedKeys.forEach(key => {
                                const [catIdx, stickerIdx] = key.split('-').map(Number);
                                if (window.imData.stickers[catIdx]?.items?.[stickerIdx]) {
                                    window.imData.stickers[catIdx].items.splice(stickerIdx, 1);
                                }
                            });
                            window.imData.stickers = (window.imData.stickers || []).filter(c => Array.isArray(c.items) && c.items.length > 0);
                            return window.imApp.saveStickers({ silent: true });
                        })()
                        : false);

                if (!saved) {
                    if (showToast) showToast('表情删除失败');
                    return;
                }

                batchDeleteMode = false;
                selectedStickers.clear();
                if (stickersEditBtn) stickersEditBtn.innerHTML = '<i class="fas fa-pen"></i>';
                renderStickersView();
                if (showToast) showToast(`已删除 ${count} 张表情`);
            });
            
            batchBar.appendChild(selectInfo);
            batchBar.appendChild(batchDeleteBtn);
            stickersListContainer.appendChild(batchBar);
        }

        stickers.forEach((category, catIndex) => {
            const card = document.createElement('div');
            card.className = 'sticker-category-card';
            card.style.cssText = 'background: #fff; border: 1px solid #f2f2f7; border-radius: 14px; padding: 0; overflow: hidden;  display: flex; flex-direction: column; max-height: 350px; margin-bottom: 12px;';

            // Header: title center, collapse arrow right
            const header = document.createElement('div');
            header.className = 'sticker-category-header';
            header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer; position: relative; min-height: 42px; padding: 7px 12px; flex-shrink: 0; border-bottom: 1px solid #f2f2f7;';

            const leftContainer = document.createElement('div');
            leftContainer.style.cssText = 'display: flex; align-items: center; gap: 6px; min-width: 90px;';

            const bindBtn = document.createElement('button');
            bindBtn.type = 'button';
            bindBtn.className = 'sticker-category-bind';
            const boundCount = getStickerBoundFriends(category.categoryName).length;
            bindBtn.innerHTML = `<i class="fas fa-user-plus"></i><span>${boundCount || ''}</span>`;
            bindBtn.title = 'Bind roles';
            bindBtn.style.cssText = 'height: 28px; min-width: 44px; border: none; border-radius: 14px; background: #f7f7fa; color: #111; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 0 9px; font-size: 12px; font-weight: 700; cursor: pointer;';
            bindBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openStickerBindingDialog(category.categoryName);
            });

            leftContainer.appendChild(bindBtn);

            // Center: title (absolutely positioned for true centering)
            const title = document.createElement('div');
            title.className = 'sticker-category-title';
            title.textContent = category.categoryName;
            title.style.cssText = 'position: absolute; left: 50%; transform: translateX(-50%); font-size: 14px; font-weight: 600; color: #000; white-space: nowrap; pointer-events: none;';

            // Right side container: delete btn + collapse icon
            const rightContainer = document.createElement('div');
            rightContainer.style.cssText = 'display: flex; align-items: center; gap: 4px; margin-left: auto;';

            // Delete category button (only visible when expanded)
            const deleteBtn = document.createElement('div');
            deleteBtn.className = 'sticker-category-delete';
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.style.cssText = 'color: #ff3b30; cursor: pointer; font-size: 13px; width: 28px; height: 28px; padding: 0; display: none; border-radius: 50%; align-items: center; justify-content: center; transition: background 0.2s;';
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`删除分类 "${category.categoryName}" ?`)) {
                    const saved = window.imApp.commitStickersChange
                        ? await window.imApp.commitStickersChange(() => {
                            window.imData.stickers.splice(catIndex, 1);
                        }, { silent: true })
                        : (window.imApp.saveStickers
                            ? await (async () => {
                                window.imData.stickers.splice(catIndex, 1);
                                return window.imApp.saveStickers({ silent: true });
                            })()
                            : false);

                    if (!saved) {
                        if (showToast) showToast('分类删除失败');
                        return;
                    }

                    renderStickersView();
                    if (showToast) showToast(`已删除分类 "${category.categoryName}"`);
                }
            });

            // Collapse indicator
            const collapseIcon = document.createElement('div');
            collapseIcon.className = 'sticker-category-collapse-icon';
            collapseIcon.style.cssText = 'color: #8e8e93; font-size: 13px; transition: transform 0.3s; padding: 6px;';
            collapseIcon.innerHTML = '<i class="fas fa-chevron-down"></i>';

            rightContainer.appendChild(deleteBtn);
            rightContainer.appendChild(collapseIcon);

            header.appendChild(leftContainer);
            header.appendChild(title);
            header.appendChild(rightContainer);

            // Sticker grid
            const grid = document.createElement('div');
            grid.className = 'sticker-grid';
            grid.style.overflowY = 'auto';
            grid.style.flex = '1';
            grid.style.minHeight = '0';
            grid.style.padding = '12px 12px 12px 12px';
            grid.style.alignContent = 'start';
            
            // Track collapsed state
            let isCollapsed = category.collapsed || false;
            if (isCollapsed) {
                grid.style.display = 'none';
                collapseIcon.querySelector('i').style.transform = 'rotate(-90deg)';
                deleteBtn.style.display = 'none';
            } else {
                deleteBtn.style.display = 'flex';
            }

            // Toggle collapse on header click
            header.addEventListener('click', (e) => {
                if (e.target.closest('.sticker-category-delete')) return;
                if (e.target.closest('.sticker-category-bind')) return;
                
                isCollapsed = !isCollapsed;
                category.collapsed = isCollapsed;
                grid.style.display = isCollapsed ? 'none' : 'grid';
                collapseIcon.querySelector('i').style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
                deleteBtn.style.display = isCollapsed ? 'none' : 'flex';
            });

            category.items.forEach((sticker, stickerIndex) => {
                const item = document.createElement('div');
                item.className = 'sticker-item';
                item.style.position = 'relative';
                
                const img = document.createElement('img');
                img.src = sticker.url;
                img.alt = sticker.name;
                img.title = sticker.name;

                // Selection checkbox for batch delete
                if (batchDeleteMode) {
                    const checkbox = document.createElement('div');
                    checkbox.className = 'sticker-select-checkbox';
                    checkbox.dataset.key = `${catIndex}-${stickerIndex}`;
                    const isSelected = selectedStickers.has(`${catIndex}-${stickerIndex}`);
                    checkbox.style.cssText = `position: absolute; top: 4px; left: 4px; width: 22px; height: 22px; border-radius: 50%; background: ${isSelected ? '#007aff' : 'rgba(255,255,255,0.9)'}; border: 2px solid ${isSelected ? '#007aff' : '#ccc'}; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #fff; cursor: pointer; z-index: 5; `;
                    if (isSelected) {
                        checkbox.innerHTML = '<i class="fas fa-check"></i>';
                        item.style.outline = '2px solid #007aff';
                        item.style.borderRadius = '8px';
                    }
                    
                    const toggleSelect = (e) => {
                        if (e) e.stopPropagation();
                        const key = `${catIndex}-${stickerIndex}`;
                        if (selectedStickers.has(key)) {
                            selectedStickers.delete(key);
                            checkbox.innerHTML = '';
                            checkbox.style.borderColor = '#ccc';
                            checkbox.style.background = 'rgba(255,255,255,0.9)';
                            item.style.outline = 'none';
                        } else {
                            selectedStickers.add(key);
                            checkbox.innerHTML = '<i class="fas fa-check"></i>';
                            checkbox.style.borderColor = '#007aff';
                            checkbox.style.background = '#007aff';
                            item.style.outline = '2px solid #007aff';
                        }
                        // Update count display
                        const info = document.getElementById('batch-select-info');
                        if (info) info.textContent = `已选择 ${selectedStickers.size} 项`;
                    };
                    
                    checkbox.addEventListener('click', toggleSelect);
                    item.addEventListener('click', () => toggleSelect());
                    item.appendChild(checkbox);
                }

                item.appendChild(img);

                // Long press or right click to enter batch mode when not already in it
                if (!batchDeleteMode) {
                    let pressTimer;
                    item.addEventListener('touchstart', () => {
                        pressTimer = setTimeout(() => {
                            batchDeleteMode = true;
                            selectedStickers.add(`${catIndex}-${stickerIndex}`);
                            if (stickersEditBtn) stickersEditBtn.innerHTML = '<i class="fas fa-check"></i>';
                            renderStickersView(true);
                        }, 800);
                    });
                    item.addEventListener('touchend', () => clearTimeout(pressTimer));
                    item.addEventListener('touchmove', () => clearTimeout(pressTimer));
                    
                    item.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        batchDeleteMode = true;
                        selectedStickers.add(`${catIndex}-${stickerIndex}`);
                        if (stickersEditBtn) stickersEditBtn.innerHTML = '<i class="fas fa-check"></i>';
                        renderStickersView(true);
                    });
                }

                grid.appendChild(item);
            });

            card.appendChild(header);
            card.appendChild(grid);
            stickersListContainer.appendChild(card);
        });
    }

    function getActiveStickerCategory() {
        return (window.imData.stickers || []).find(category => category?.categoryName === activeStickerCategoryName) || null;
    }

    function renderStickerDetail() {
        if (!stickerDetailGrid) return;
        const category = getActiveStickerCategory();
        if (!category) {
            if (stickerDetailSheet && window.closeView) window.closeView(stickerDetailSheet);
            activeStickerCategoryName = '';
            return;
        }

        const items = Array.isArray(category.items) ? category.items : [];
        if (stickerDetailTitle) stickerDetailTitle.textContent = category.categoryName || '表情包';
        if (stickerDetailCount) stickerDetailCount.textContent = `${items.length} 张 · 已绑定 ${getStickerBoundFriends(category.categoryName).length} 位角色`;
        if (stickerDetailBatchBar) stickerDetailBatchBar.hidden = !batchDeleteMode;
        const batchInfo = document.getElementById('batch-select-info');
        if (batchInfo) batchInfo.textContent = `已选择 ${selectedStickers.size} 项`;
        if (stickersEditBtn) stickersEditBtn.innerHTML = batchDeleteMode ? '<i class="fas fa-check"></i>' : '<i class="fas fa-pen"></i>';

        stickerDetailGrid.innerHTML = '';
        items.forEach((sticker, stickerIndex) => {
            if (!sticker?.url) return;
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'sticker-item sticker-detail-item';
            item.title = sticker.name || `Sticker ${stickerIndex + 1}`;
            const image = document.createElement('img');
            image.src = sticker.url;
            image.alt = sticker.name || '';
            item.appendChild(image);

            if (batchDeleteMode) {
                const selected = selectedStickers.has(String(stickerIndex));
                item.classList.toggle('selected', selected);
                const checkbox = document.createElement('span');
                checkbox.className = 'sticker-select-checkbox';
                checkbox.innerHTML = selected ? '<i class="fas fa-check"></i>' : '';
                item.appendChild(checkbox);
                item.addEventListener('click', () => {
                    const key = String(stickerIndex);
                    if (selectedStickers.has(key)) selectedStickers.delete(key);
                    else selectedStickers.add(key);
                    renderStickerDetail();
                });
            }
            stickerDetailGrid.appendChild(item);
        });

        if (stickerDetailBindBtn) {
            stickerDetailBindBtn.onclick = () => openStickerBindingDialog(category.categoryName);
        }
        if (stickerDetailDeleteCategoryBtn) {
            stickerDetailDeleteCategoryBtn.onclick = async () => {
                if (!confirm(`删除分类 "${category.categoryName}" ?`)) return;
                const saved = await window.imApp.commitStickersChange(() => {
                    window.imData.stickers = (window.imData.stickers || []).filter(item => item !== category);
                }, { silent: true });
                if (!saved) {
                    if (showToast) showToast('分类删除失败');
                    return;
                }
                activeStickerCategoryName = '';
                batchDeleteMode = false;
                selectedStickers.clear();
                if (stickerDetailSheet && window.closeView) window.closeView(stickerDetailSheet);
                renderStickersView();
                if (showToast) showToast(`已删除分类 "${category.categoryName}"`);
            };
        }
    }

    function openStickerCategoryDetail(categoryName) {
        activeStickerCategoryName = String(categoryName || '');
        batchDeleteMode = false;
        selectedStickers.clear();
        renderStickerDetail();
        if (stickerDetailSheet && window.openView) window.openView(stickerDetailSheet);
    }

    function renderStickersView(keepBatchMode) {
        if (!stickersListContainer) return;
        if (!keepBatchMode) {
            batchDeleteMode = false;
            selectedStickers.clear();
        }
        stickersListContainer.innerHTML = '';
        const stickers = Array.isArray(window.imData.stickers) ? window.imData.stickers : [];
        if (stickers.length === 0) {
            stickersListContainer.innerHTML = '<div class="stickers-empty-state"><i class="far fa-face-smile"></i><strong>还没有表情包</strong><span>点击右上角添加第一个分组</span></div>';
            return;
        }

        stickers.forEach(category => {
            if (!category) return;
            const items = Array.isArray(category.items) ? category.items : [];
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'sticker-group-card';
            const preview = document.createElement('span');
            preview.className = 'sticker-group-preview';
            items.slice(0, 4).forEach(sticker => {
                const cell = document.createElement('span');
                cell.className = 'sticker-group-preview-cell';
                if (sticker?.url) {
                    const image = document.createElement('img');
                    image.src = sticker.url;
                    image.alt = sticker.name || '';
                    cell.appendChild(image);
                }
                preview.appendChild(cell);
            });
            while (preview.children.length < 4) {
                const cell = document.createElement('span');
                cell.className = 'sticker-group-preview-cell empty';
                preview.appendChild(cell);
            }

            const copy = document.createElement('span');
            copy.className = 'sticker-group-copy';
            const title = document.createElement('strong');
            title.textContent = category.categoryName || '未命名分组';
            const meta = document.createElement('span');
            meta.textContent = `${items.length} 张 · ${getStickerBoundFriends(category.categoryName).length} 位角色`;
            copy.appendChild(title);
            copy.appendChild(meta);
            card.appendChild(preview);
            card.appendChild(copy);
            card.addEventListener('click', () => openStickerCategoryDetail(category.categoryName));
            stickersListContainer.appendChild(card);
        });

        if (activeStickerCategoryName && getActiveStickerCategory()) renderStickerDetail();
    }

    if (stickerBatchDeleteBtn) {
        stickerBatchDeleteBtn.addEventListener('click', async () => {
            const category = getActiveStickerCategory();
            if (!category || selectedStickers.size === 0) {
                if (showToast) showToast('请先选择要删除的表情');
                return;
            }
            const selectedIndexes = Array.from(selectedStickers).map(Number).sort((a, b) => b - a);
            const saved = await window.imApp.commitStickersChange(() => {
                selectedIndexes.forEach(index => category.items.splice(index, 1));
                window.imData.stickers = (window.imData.stickers || []).filter(item => Array.isArray(item.items) && item.items.length > 0);
            }, { silent: true });
            if (!saved) {
                if (showToast) showToast('表情删除失败');
                return;
            }
            batchDeleteMode = false;
            selectedStickers.clear();
            if (!getActiveStickerCategory()) {
                activeStickerCategoryName = '';
                if (stickerDetailSheet && window.closeView) window.closeView(stickerDetailSheet);
            }
            renderStickersView();
            if (showToast) showToast(`已删除 ${selectedIndexes.length} 张表情`);
        });
    }

    if (stickerDetailSheet) {
        stickerDetailSheet.addEventListener('click', event => {
            if (event.target !== stickerDetailSheet) return;
            batchDeleteMode = false;
            selectedStickers.clear();
            if (window.closeView) window.closeView(stickerDetailSheet);
        });
    }

    // Export render function
    window.imApp.renderStickersView = renderStickersView;

    const groupsToggle = document.getElementById('groups-toggle');
    if (groupsToggle) {
        groupsToggle.addEventListener('click', () => {
            groupsToggle.parentElement.classList.toggle('collapsed');
        });
    }

    const friendsToggle = document.getElementById('friends-toggle');
    if (friendsToggle) {
        friendsToggle.addEventListener('click', () => {
            friendsToggle.parentElement.classList.toggle('collapsed');
        });
    }

    const npcsToggle = document.getElementById('npcs-toggle');
    if (npcsToggle) {
        npcsToggle.addEventListener('click', () => {
            npcsToggle.parentElement.classList.toggle('collapsed');
        });
    }

    // --- Bottom Nav Logic ---
    const navHomeBtn = document.getElementById('nav-home-btn');
    const navChatsBtn = document.getElementById('nav-chats-btn');
    const navMomentsBtn = document.getElementById('nav-moments-btn');
    const lineNavIndicator = document.getElementById('line-nav-indicator');
    const imBottomNavContainer = document.querySelector('.line-bottom-nav-container');
    
    const imContent = document.querySelector('.line-content'); 
    const chatsContent = document.getElementById('chats-content');
    const memoryLocationSheet = document.getElementById('memory-location-sheet');
    const memoryLocationSheetContent = document.getElementById('memory-location-sheet-content');
    const memoryEntryDetailModal = document.getElementById('memory-entry-detail-modal');
    const scheduleModal = document.getElementById('chat-memory-schedule-modal');
    const scheduleClose = document.getElementById('chat-memory-schedule-close');
    const scheduleAddModal = document.getElementById('chat-memory-schedule-add-modal');
    const memoryEntryDetailTitle = document.getElementById('memory-entry-detail-title');
    const memoryEntryDetailBody = document.getElementById('memory-entry-detail-body');
    const memoryEntryDetailClose = document.getElementById('memory-entry-detail-close');
    const memoryEntryEditorModal = document.getElementById('memory-entry-editor-modal');
    const memoryEntryEditorTitle = document.getElementById('memory-entry-editor-title');
    const memoryEntryEditorKind = document.getElementById('memory-entry-editor-kind');
    const memoryEntryEditorId = document.getElementById('memory-entry-editor-id');
    const memoryEntryEditorCollection = document.getElementById('memory-entry-editor-collection');
    const memoryEntryEditorTitleInput = document.getElementById('memory-entry-editor-title-input');
    const memoryEntryEditorTimeInput = document.getElementById('memory-entry-editor-time-input');
    const memoryEntryEditorContentInput = document.getElementById('memory-entry-editor-content-input');
    const memoryEntryEditorContentLabel = document.getElementById('memory-entry-editor-content-label');
    const memoryEntryEditorTagsInput = document.getElementById('memory-entry-editor-tags-input');
    const memoryEntryEditorDegreeRow = document.getElementById('memory-entry-editor-degree-row');
    const memoryEntryEditorDegreeSelect = document.getElementById('memory-entry-editor-degree-select');
    const memoryEntryEditorClose = document.getElementById('memory-entry-editor-close');
    const memoryEntryEditorCancel = document.getElementById('memory-entry-editor-cancel');
    const memoryEntryEditorSave = document.getElementById('memory-entry-editor-save');
    const memoryPromotionPreviewModal = document.getElementById('memory-promotion-preview-modal');
    const memoryPromotionPreviewClose = document.getElementById('memory-promotion-preview-close');
    const memoryPromotionPreviewCancel = document.getElementById('memory-promotion-preview-cancel');
    const memoryPromotionPreviewConfirm = document.getElementById('memory-promotion-preview-confirm');
    const memoryPromotionTitleInput = document.getElementById('memory-promotion-title-input');
    const memoryPromotionTimeInput = document.getElementById('memory-promotion-time-input');
    const memoryPromotionContentInput = document.getElementById('memory-promotion-content-input');
    const memoryPromotionTagsInput = document.getElementById('memory-promotion-tags-input');
    const momentsContent = document.getElementById('moments-content');
    let currentMemoryFriendId = null;
    let currentMemoryLocation = 'iphone';
    let scheduleEditorEventId = null;
    let pendingMemoryPromotion = null;

    function updateLineNavIndicator(activeItem) {
        if (!activeItem || !lineNavIndicator) return;
        const containerRect = activeItem.parentElement.getBoundingClientRect();
        const itemRect = activeItem.getBoundingClientRect();
        const relativeLeft = itemRect.left - containerRect.left;
        
        lineNavIndicator.style.width = `${itemRect.width}px`;
        lineNavIndicator.style.left = `${relativeLeft}px`;
    }

    setTimeout(() => {
        if(navHomeBtn && navHomeBtn.classList.contains('active')) updateLineNavIndicator(navHomeBtn);
    }, 100);

    function getMemoryFriends() {
        const allFriends = Array.isArray(window.imData?.friends) ? window.imData.friends : [];
        return allFriends.filter(f => f && f.type !== 'group' && f.type !== 'npc');
    }

    function escapeMemoryHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function setMemoryFriendSelection(friend) {
        if (!friend) return;
        currentMemoryFriendId = friend.id;
    }

    function renderMemoryView() {
        if (memoryLocationSheetContent && memoryLocationSheetContent.innerHTML !== '') {
            renderMemoryLocationSheet(currentMemoryLocation || 'iphone');
        }
    }

    function renderScheduleModal() {
        const toMinutes = (value) => {
            const match = /^(\d{2}):(\d{2})$/.exec(String(value || '').trim());
            if (!match) return -1;
            const hours = Number(match[1]);
            const minutes = Number(match[2]);
            return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 ? hours * 60 + minutes : -1;
        };
        const toLocalInputValue = (value, fallback = '') => {
            const normalized = String(value || '').trim();
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) return normalized;
            return fallback;
        };
        const getDefaultOneTimeValues = () => {
            const start = new Date();
            start.setMinutes(start.getMinutes() - start.getTimezoneOffset());
            const end = new Date(Date.now() + 60 * 60 * 1000);
            end.setMinutes(end.getMinutes() - end.getTimezoneOffset());
            return {
                start: start.toISOString().slice(0, 16),
                end: end.toISOString().slice(0, 16)
            };
        };
        const friend = getCurrentMemoryFriend();
        if (!friend) return;

        const normalizedFriend = window.imApp.normalizeFriendData
            ? window.imApp.normalizeFriendData(friend)
            : friend;
        friend.memory = normalizedFriend.memory || friend.memory || window.imApp.createDefaultMemory?.() || {};
        if (!friend.memory.schedule) {
            friend.memory.schedule = window.imApp.createDefaultMemory?.().schedule || {
                enabled: false,
                sleepTime: '23:00',
                wakeTime: '07:00',
                events: []
            };
        }

        const enabledToggle = document.getElementById('chat-memory-schedule-enabled-toggle');
        const sleepText = document.getElementById('chat-memory-schedule-sleep-text');
        const wakeText = document.getElementById('chat-memory-schedule-wake-text');
        const sleepPicker = document.getElementById('chat-memory-schedule-sleep-picker');
        const wakePicker = document.getElementById('chat-memory-schedule-wake-picker');
        const timeline = document.getElementById('chat-memory-schedule-timeline');
        const addScheduleBtn = document.getElementById('chat-memory-schedule-add-btn');
        const generateScheduleBtn = document.getElementById('chat-memory-schedule-generate-btn');
        const editorTitle = document.getElementById('chat-memory-schedule-editor-title');
        const eventNameInput = document.getElementById('chat-memory-schedule-add-name');
        const recurrenceInput = document.getElementById('chat-memory-schedule-add-recurrence');
        const dailyFields = document.getElementById('chat-memory-schedule-daily-fields');
        const onceFields = document.getElementById('chat-memory-schedule-once-fields');
        const dailyStartInput = document.getElementById('chat-memory-schedule-add-daily-start');
        const dailyEndInput = document.getElementById('chat-memory-schedule-add-daily-end');
        const onceStartInput = document.getElementById('chat-memory-schedule-add-start');
        const onceEndInput = document.getElementById('chat-memory-schedule-add-end');
        const confirmAddBtn = document.getElementById('chat-memory-schedule-add-confirm-btn');
        const deleteScheduleBtn = document.getElementById('chat-memory-schedule-delete-btn');

        const schedule = friend.memory.schedule;

        const applyScheduleEditorRecurrence = (recurrence) => {
            const isDaily = recurrence !== 'once';
            if (recurrenceInput) recurrenceInput.value = isDaily ? 'daily' : 'once';
            if (dailyFields) dailyFields.hidden = !isDaily;
            if (onceFields) onceFields.hidden = isDaily;
        };

        const openScheduleEditor = (event = null) => {
            scheduleEditorEventId = event ? String(event.id) : null;
            const recurrence = event?.recurrence === 'once' ? 'once' : 'daily';
            const defaults = getDefaultOneTimeValues();
            if (editorTitle) editorTitle.textContent = event ? '编辑行程' : '添加行程';
            if (eventNameInput) eventNameInput.value = event?.name || event?.title || '';
            applyScheduleEditorRecurrence(recurrence);
            if (dailyStartInput) dailyStartInput.value = event?.startTime || '09:00';
            if (dailyEndInput) dailyEndInput.value = event?.endTime || '10:00';
            if (onceStartInput) onceStartInput.value = toLocalInputValue(event?.rawTime, defaults.start);
            if (onceEndInput) onceEndInput.value = toLocalInputValue(event?.endAt, defaults.end);
            if (deleteScheduleBtn) deleteScheduleBtn.hidden = !event;
            if (scheduleAddModal && window.openView) window.openView(scheduleAddModal);
        };

        if (enabledToggle) {
            enabledToggle.checked = !!schedule.enabled;
            enabledToggle.onchange = async (e) => {
                await window.imApp.commitScopedFriendChange(friend, (f) => {
                    if (!f.memory.schedule) f.memory.schedule = {};
                    f.memory.schedule.enabled = e.target.checked;
                }, { silent: true });
                renderScheduleModal();
            };
        }
        
        if (generateScheduleBtn) {
            const isDirectCharacter = friend.type !== 'group';
            generateScheduleBtn.hidden = !isDirectCharacter;
            generateScheduleBtn.onclick = async () => {
                if (!isDirectCharacter || !window.imChat?.generateScheduleForFriend) {
                    if (window.showToast) window.showToast('仅单个角色可生成日程');
                    return;
                }
                const originalText = generateScheduleBtn.textContent;
                generateScheduleBtn.disabled = true;
                generateScheduleBtn.textContent = '生成中...';
                try {
                    const result = await window.imChat.generateScheduleForFriend(friend);
                    if (!result?.success && window.showToast) {
                        window.showToast(result?.error || '日程生成失败，请稍后重试');
                    }
                } finally {
                    generateScheduleBtn.disabled = false;
                    generateScheduleBtn.textContent = originalText;
                    renderScheduleModal();
                }
            };
        }

        recurrenceInput && (recurrenceInput.onchange = () => applyScheduleEditorRecurrence(recurrenceInput.value));

        if (addScheduleBtn) {
            addScheduleBtn.onclick = () => openScheduleEditor();
        }

        if (confirmAddBtn) {
            confirmAddBtn.onclick = async () => {
                const eventName = eventNameInput ? eventNameInput.value.trim() : '';
                const recurrence = recurrenceInput?.value === 'once' ? 'once' : 'daily';
                const existingEvent = Array.isArray(schedule.events)
                    ? schedule.events.find(item => String(item.id) === String(scheduleEditorEventId))
                    : null;
                if (!eventName) {
                    if (window.showToast) window.showToast('请输入行程名称');
                    return;
                }

                let eventData;
                if (recurrence === 'daily') {
                    const startTime = dailyStartInput?.value || '';
                    const endTime = dailyEndInput?.value || '';
                    if (toMinutes(startTime) < 0 || toMinutes(endTime) < 0) {
                        if (window.showToast) window.showToast('请输入有效的开始和结束时间');
                        return;
                    }
                    if (toMinutes(endTime) <= toMinutes(startTime)) {
                        if (window.showToast) window.showToast('每天重复的结束时间必须晚于开始时间');
                        return;
                    }
                    eventData = {
                        id: existingEvent?.id ?? `schedule-${Date.now()}`,
                        name: eventName,
                        title: eventName,
                        startTime,
                        endTime,
                        recurrence: 'daily',
                        source: existingEvent?.source === 'generated' ? 'manual' : (existingEvent?.source || 'manual'),
                        timestamp: existingEvent?.timestamp || Date.now()
                    };
                } else {
                    const startAt = onceStartInput?.value || '';
                    const endAt = onceEndInput?.value || '';
                    if (!startAt || !endAt || new Date(startAt) >= new Date(endAt)) {
                        if (window.showToast) window.showToast('结束时间必须晚于开始时间');
                        return;
                    }
                    const startDate = new Date(startAt);
                    const endDate = new Date(endAt);
                    eventData = {
                        id: existingEvent?.id ?? `schedule-${Date.now()}`,
                        name: eventName,
                        title: eventName,
                        date: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`,
                        startTime: `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`,
                        endTime: `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`,
                        rawTime: startAt,
                        endAt,
                        recurrence: 'once',
                        source: existingEvent?.source === 'generated' ? 'manual' : (existingEvent?.source || 'manual'),
                        timestamp: existingEvent?.timestamp || Date.now()
                    };
                }

                await window.imApp.commitScopedFriendChange(friend, (targetFriend) => {
                    targetFriend.memory = targetFriend.memory || window.imApp.createDefaultMemory();
                    const currentSchedule = targetFriend.memory.schedule || window.imApp.createDefaultMemory().schedule;
                    const events = Array.isArray(currentSchedule.events) ? currentSchedule.events.slice() : [];
                    const existingIndex = events.findIndex(item => String(item?.id) === String(scheduleEditorEventId));
                    if (existingIndex >= 0) events.splice(existingIndex, 1, eventData);
                    else events.push(eventData);
                    targetFriend.memory.schedule = window.imDataUtils?.normalizeSchedule
                        ? window.imDataUtils.normalizeSchedule({ ...currentSchedule, events })
                        : { ...currentSchedule, events };
                }, { silent: true });

                scheduleEditorEventId = null;
                if (scheduleAddModal && window.closeView) window.closeView(scheduleAddModal);
                renderScheduleModal();
            };
        }

        if (deleteScheduleBtn) {
            deleteScheduleBtn.onclick = () => {
                const eventId = scheduleEditorEventId;
                if (eventId == null) return;
                const removeEvent = async () => {
                    await window.imApp.commitScopedFriendChange(friend, (targetFriend) => {
                        const currentSchedule = targetFriend.memory?.schedule || window.imApp.createDefaultMemory().schedule;
                        targetFriend.memory = targetFriend.memory || window.imApp.createDefaultMemory();
                        targetFriend.memory.schedule = window.imDataUtils?.normalizeSchedule
                            ? window.imDataUtils.normalizeSchedule({
                                ...currentSchedule,
                                events: (currentSchedule.events || []).filter(item => String(item?.id) !== String(eventId))
                            })
                            : {
                                ...currentSchedule,
                                events: (currentSchedule.events || []).filter(item => String(item?.id) !== String(eventId))
                            };
                    }, { silent: true });
                    scheduleEditorEventId = null;
                    if (scheduleAddModal && window.closeView) window.closeView(scheduleAddModal);
                    renderScheduleModal();
                };
                if (window.imApp.showCustomModal) {
                    window.imApp.showCustomModal({
                        title: '删除行程',
                        message: '确定删除这条行程吗？',
                        isDestructive: true,
                        confirmText: '删除',
                        onConfirm: removeEvent
                    });
                } else {
                    void removeEvent();
                }
            };
        }
        
        if (sleepText && sleepPicker) {
            sleepText.textContent = schedule.sleepTime || '23:00';
            sleepPicker.value = schedule.sleepTime || '23:00';
            sleepPicker.onchange = async (e) => {
                sleepText.textContent = e.target.value;
                await window.imApp.commitScopedFriendChange(friend, (f) => {
                    if (!f.memory.schedule) f.memory.schedule = {};
                    f.memory.schedule.sleepTime = e.target.value;
                }, { silent: true });
                renderScheduleModal();
            };
        }

        if (wakeText && wakePicker) {
            wakeText.textContent = schedule.wakeTime || '07:00';
            wakePicker.value = schedule.wakeTime || '07:00';
            wakePicker.onchange = async (e) => {
                wakeText.textContent = e.target.value;
                await window.imApp.commitScopedFriendChange(friend, (f) => {
                    if (!f.memory.schedule) f.memory.schedule = {};
                    f.memory.schedule.wakeTime = e.target.value;
                }, { silent: true });
                renderScheduleModal();
            };
        }

        if (timeline) {
            const wake = schedule.wakeTime || '07:00';
            const sleep = schedule.sleepTime || '23:00';
            const events = Array.isArray(schedule.events) ? schedule.events : [];
            
            let html = `<div style="position: absolute; left: 24px; top: 10px; bottom: 10px; width: 2px; background: #e5e5ea; z-index: 1;"></div>`;
            
            html += `
                <div style="position: relative; z-index: 2; display: flex; align-items: flex-start;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: #007aff; margin-right: 15px; margin-top: 5px;  flex-shrink: 0;"></div>
                    <div>
                        <div style="font-size: 16px; font-weight: 600; color: #111;">起床</div>
                        <div style="font-size: 13px; color: #8e8e93; margin-top: 2px;">${wake} - 开启新的一天</div>
                    </div>
                </div>
            `;

            events.forEach(evt => {
                html += `
                    <div style="position: relative; z-index: 2; display: flex; align-items: flex-start;">
                        <div style="width: 10px; height: 10px; border-radius: 50%; background: #8e8e93; margin-right: 15px; margin-top: 15px;  flex-shrink: 0;"></div>
                        <div class="schedule-event-card" data-event-id="${evt.id}" style="background: #f2f2f7; border-radius: 16px; padding: 12px 16px; flex: 1; cursor: pointer; ">
                            <div style="font-size: 15px; font-weight: 600; color: #111;">${escapeMemoryHtml(evt.name || evt.title || '未命名行程')}</div>
                            <div style="font-size: 13px; color: #8e8e93; margin-top: 4px;">${escapeMemoryHtml(evt.time || `${evt.date || ''} ${evt.startTime || ''}`.trim())}</div>
                        </div>
                    </div>
                `;
            });

            html += `
                <div style="position: relative; z-index: 2; display: flex; align-items: flex-start;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: #5856d6; margin-right: 15px; margin-top: 5px;  flex-shrink: 0;"></div>
                    <div>
                        <div style="font-size: 16px; font-weight: 600; color: #111;">睡觉</div>
                        <div style="font-size: 13px; color: #8e8e93; margin-top: 2px;">${sleep} - 休息时间到了</div>
                    </div>
                </div>
            `;
            
            timeline.innerHTML = html;

            const eventCards = timeline.querySelectorAll('.schedule-event-card');
            eventCards.forEach(card => {
                card.addEventListener('click', () => {
                    const eventId = card.getAttribute('data-event-id');
                    const targetEvent = events.find(e => String(e.id) === String(eventId));
                    if (targetEvent) openScheduleEditor(targetEvent);
                });
            });
        }
    }

    function getCurrentMemoryFriend() {
        const allFriends = Array.isArray(window.imData?.friends) ? window.imData.friends : [];
        const selected = allFriends.find(f => String(f.id) === String(currentMemoryFriendId));
        if (selected) return selected;
        return getMemoryFriends()[0] || null;
    }

    function formatManualMemoryTime(date = new Date()) {
        const pad = value => String(value).padStart(2, '0');
        return `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function normalizeManualMemoryTags(value) {
        if (window.imChat?.normalizeMemoryTriggerKeywords) {
            return window.imChat.normalizeMemoryTriggerKeywords(value);
        }
        return String(value || '')
            .split(/[,，、；;\n|/]+/)
            .map(tag => tag.trim())
            .filter(Boolean)
            .slice(0, 12);
    }

    function getMemoryEntryCollection(friend, collection) {
        const memory = friend?.memory || {};
        return Array.isArray(memory[collection]) ? memory[collection] : [];
    }

    function findMemoryEntry(friend, collection, entryId) {
        return getMemoryEntryCollection(friend, collection)
            .find(entry => String(entry?.id) === String(entryId)) || null;
    }

    function closeMemoryEntryEditor() {
        if (memoryEntryEditorModal && window.closeView) window.closeView(memoryEntryEditorModal);
    }

    function normalizeMemoryRecallLimit(value, fallback = 30) {
        const numeric = Math.round(Number(value));
        return Number.isFinite(numeric) && numeric > 0
            ? Math.min(100, Math.max(1, numeric))
            : fallback;
    }

    async function saveMemoryRecallLimit(kind, rawValue) {
        const friend = getCurrentMemoryFriend();
        if (!friend) return false;
        const normalizedFriend = window.imApp.normalizeFriendData(friend);
        const fallback = normalizedFriend.memory?.recallLimits?.[kind] || 30;
        const limit = normalizeMemoryRecallLimit(rawValue, fallback);
        const saved = await window.imApp.commitScopedFriendChange(friend, targetFriend => {
            targetFriend.memory = window.imApp.normalizeFriendData(targetFriend).memory;
            targetFriend.memory.recallLimits = window.imApp.normalizeMemoryRecallLimits({
                ...targetFriend.memory.recallLimits,
                [kind]: limit
            });
            targetFriend.memory.recallPresentation = null;
            window.imApp.clearFriendRuntimeMessageContext?.(targetFriend);
        }, { silent: true, immediate: true, syncActive: true, syncSettings: true });
        if (!saved) {
            if (window.showToast) window.showToast('读取条数保存失败');
            return false;
        }
        window.dispatchEvent(new CustomEvent('u2:memory-entries-updated', {
            detail: { friendId: String(friend.id), action: 'recall-limit', kind, limit }
        }));
        renderMemoryLocationSheet(currentMemoryLocation);
        return true;
    }

    function closeMemoryPromotionPreview() {
        pendingMemoryPromotion = null;
        if (memoryPromotionPreviewModal && window.closeView) window.closeView(memoryPromotionPreviewModal);
    }

    function openMemoryPromotionPreview(friend, selectedIds, draft) {
        if (!memoryPromotionPreviewModal) return;
        pendingMemoryPromotion = {
            friendId: String(friend.id),
            selectedIds: selectedIds.map(String)
        };
        if (memoryPromotionTitleInput) memoryPromotionTitleInput.value = draft.title || '';
        if (memoryPromotionTimeInput) memoryPromotionTimeInput.value = draft.time || '';
        if (memoryPromotionContentInput) memoryPromotionContentInput.value = draft.content || '';
        if (memoryPromotionTagsInput) memoryPromotionTagsInput.value = (draft.triggerKeywords || []).join('，');
        if (window.openView) window.openView(memoryPromotionPreviewModal);
    }

    async function confirmMemoryPromotionPreview() {
        const pending = pendingMemoryPromotion;
        if (!pending) return false;
        const friend = window.imApp.getFriendById?.(pending.friendId) || getCurrentMemoryFriend();
        const title = String(memoryPromotionTitleInput?.value || '').trim();
        const content = String(memoryPromotionContentInput?.value || '').trim();
        const time = String(memoryPromotionTimeInput?.value || '').trim();
        const triggerKeywords = normalizeManualMemoryTags(memoryPromotionTagsInput?.value || '');
        if (!title || !content || triggerKeywords.length === 0) {
            if (window.showToast) window.showToast('请填写标题、内容和至少一个召回标签');
            return false;
        }
        if (!friend || !window.imApp.commitShortTermMemoryPromotion) return false;
        if (memoryPromotionPreviewConfirm) {
            memoryPromotionPreviewConfirm.disabled = true;
            memoryPromotionPreviewConfirm.textContent = '保存中...';
        }
        try {
            const result = await window.imApp.commitShortTermMemoryPromotion(friend, {
                title,
                content,
                time,
                triggerKeywords
            }, pending.selectedIds);
            if (!result) {
                if (window.showToast) window.showToast('长期记忆保存失败，短期记忆未删除');
                return false;
            }
            closeMemoryPromotionPreview();
            renderMemoryLocationSheet('iphone');
            renderMemoryView();
            if (window.showToast) window.showToast('已归纳为长期记忆');
            return true;
        } finally {
            if (memoryPromotionPreviewConfirm) {
                memoryPromotionPreviewConfirm.disabled = false;
                memoryPromotionPreviewConfirm.textContent = '确认归纳并删除原短期记忆';
            }
        }
    }

    async function generateMemoryPromotion(friend, selectedIds) {
        const entries = (Array.isArray(friend?.memory?.shortTermEntries) ? friend.memory.shortTermEntries : [])
            .filter(entry => selectedIds.includes(String(entry?.id || '')));
        if (entries.length === 0 || entries.length !== selectedIds.length) {
            if (window.showToast) window.showToast('所选短期记忆已变更，请重新选择');
            renderMemoryLocationSheet('iphone');
            return;
        }
        if (!window.imApp.generateShortTermMemoryPromotionDraft) {
            if (window.showToast) window.showToast('归纳功能尚未初始化');
            return;
        }
        try {
            if (window.showToast) window.showToast('正在归纳长期记忆...');
            const draft = await window.imApp.generateShortTermMemoryPromotionDraft(friend, entries);
            openMemoryPromotionPreview(friend, selectedIds, draft);
        } catch (error) {
            console.error('Short-term memory promotion failed', error);
            const message = error?.summaryFailure?.message || error?.message || '归纳失败，请检查 API 配置';
            if (window.showToast) window.showToast(`归纳失败：${message}`);
        }
    }

    function openMemoryEntryEditor(kind, entry = null, collection = '') {
        if (!memoryEntryEditorModal) return;
        const isShort = kind === 'short';
        const targetCollection = collection || (isShort ? 'shortTermEntries' : 'longTermEntries');
        const time = entry?.time || entry?.createdAt || formatManualMemoryTime();
        const tags = isShort
            ? (window.imChat?.getShortTermMemoryTags ? window.imChat.getShortTermMemoryTags(entry || {}) : (entry?.memoryTags || entry?.triggerKeywords || []))
            : (entry?.triggerKeywords || []);

        if (memoryEntryEditorTitle) memoryEntryEditorTitle.textContent = entry ? `编辑${isShort ? '短期' : '长期'}记忆` : `新增${isShort ? '短期' : '长期'}记忆`;
        if (memoryEntryEditorKind) memoryEntryEditorKind.value = kind;
        if (memoryEntryEditorId) memoryEntryEditorId.value = entry?.id == null ? '' : String(entry.id);
        if (memoryEntryEditorCollection) memoryEntryEditorCollection.value = targetCollection;
        if (memoryEntryEditorTitleInput) memoryEntryEditorTitleInput.value = entry?.title || '';
        if (memoryEntryEditorTimeInput) memoryEntryEditorTimeInput.value = time;
        if (memoryEntryEditorContentInput) memoryEntryEditorContentInput.value = isShort ? (entry?.event || entry?.content || '') : (entry?.content || '');
        if (memoryEntryEditorContentLabel) memoryEntryEditorContentLabel.textContent = isShort ? '事件内容' : '记忆内容';
        if (memoryEntryEditorTagsInput) memoryEntryEditorTagsInput.value = Array.isArray(tags) ? tags.join('，') : '';
        if (memoryEntryEditorDegreeRow) memoryEntryEditorDegreeRow.style.display = isShort ? 'flex' : 'none';
        if (memoryEntryEditorDegreeSelect) memoryEntryEditorDegreeSelect.value = entry?.degree || '高';
        if (window.openView) window.openView(memoryEntryEditorModal);
    }

    async function saveMemoryEntryEditor() {
        const friend = getCurrentMemoryFriend();
        if (!friend) return false;
        const kind = memoryEntryEditorKind?.value === 'long' ? 'long' : 'short';
        const isShort = kind === 'short';
        const collection = memoryEntryEditorCollection?.value || (isShort ? 'shortTermEntries' : 'longTermEntries');
        const existingId = String(memoryEntryEditorId?.value || '');
        const title = String(memoryEntryEditorTitleInput?.value || '').trim() || (isShort ? '手动记忆' : '长期记忆');
        const time = String(memoryEntryEditorTimeInput?.value || '').trim() || formatManualMemoryTime();
        const content = String(memoryEntryEditorContentInput?.value || '').trim();
        const tags = normalizeManualMemoryTags(memoryEntryEditorTagsInput?.value || '');
        if (!content) {
            if (window.showToast) window.showToast('请输入记忆内容');
            memoryEntryEditorContentInput?.focus();
            return false;
        }

        const id = existingId || `${isShort ? 'manual-stm' : 'manual-ltm'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const saved = await window.imApp.commitScopedFriendChange(friend, targetFriend => {
            targetFriend.memory = window.imApp.normalizeFriendData(targetFriend).memory;
            if (!Array.isArray(targetFriend.memory[collection])) targetFriend.memory[collection] = [];
            const entries = targetFriend.memory[collection];
            const index = entries.findIndex(entry => String(entry?.id) === id);
            const previous = index >= 0 ? entries[index] : null;
            let nextEntry;
            if (isShort) {
                nextEntry = {
                    ...(previous || {}),
                    id,
                    title,
                    time,
                    event: content,
                    memoryTags: tags,
                    triggerKeywords: tags,
                    degree: memoryEntryEditorDegreeSelect?.value || previous?.degree || '高',
                    lastActivatedAt: previous?.lastActivatedAt || time,
                    sourceType: previous?.sourceType || 'manual',
                    sourceId: previous?.sourceId || id
                };
            } else {
                nextEntry = {
                    ...(previous || {}),
                    id,
                    title,
                    content,
                    time,
                    createdAt: time,
                    triggerKeywords: tags,
                    sourceType: previous?.sourceType || 'manual',
                    sourceId: previous?.sourceId || id
                };
            }
            if (index >= 0) entries[index] = nextEntry;
            else entries.push(nextEntry);
            targetFriend.memory.recallPresentation = null;
            window.imApp.clearFriendRuntimeMessageContext?.(targetFriend);
        }, { silent: true, syncActive: true, syncSettings: true });

        if (!saved) {
            if (window.showToast) window.showToast('记忆保存失败');
            return false;
        }
        closeMemoryEntryEditor();
        renderMemoryLocationSheet(currentMemoryLocation);
        renderMemoryView();
        window.dispatchEvent(new CustomEvent('u2:memory-entries-updated', {
            detail: {
                friendId: String(friend.id),
                action: 'upsert',
                collection,
                entryId: id
            }
        }));
        if (window.showToast) window.showToast(existingId ? '记忆已更新' : '记忆已添加');
        return true;
    }

    async function deleteMemoryEntry(entry, collection, options = {}) {
        if (!entry) return false;
        const friend = getCurrentMemoryFriend();
        if (!friend) return false;
        const saved = await window.imApp.commitScopedFriendChange(friend, targetFriend => {
            targetFriend.memory = window.imApp.normalizeFriendData(targetFriend).memory;
            const entries = Array.isArray(targetFriend.memory[collection]) ? targetFriend.memory[collection] : [];
            targetFriend.memory[collection] = entries.filter(item => String(item?.id) !== String(entry.id));
            if (collection === 'shortTermEntries') {
                targetFriend.memory.lastSummaryMessageCount = targetFriend.memory.shortTermEntries.reduce((max, item) => (
                    Math.max(max, Math.max(0, Number(item?.sourceEndMessageCount) || 0))
                ), 0);
            }
            targetFriend.memory.recallPresentation = null;
            window.imApp.clearFriendRuntimeMessageContext?.(targetFriend);
        }, { silent: true, syncActive: true, syncSettings: true });
        if (!saved) return false;
        if (options.closeDetail && memoryEntryDetailModal && window.closeView) window.closeView(memoryEntryDetailModal);
        renderMemoryLocationSheet(currentMemoryLocation);
        renderMemoryView();
        window.dispatchEvent(new CustomEvent('u2:memory-entries-updated', {
            detail: {
                friendId: String(friend.id),
                action: 'delete',
                collection,
                entryId: String(entry.id)
            }
        }));
        return true;
    }

    function confirmDeleteMemoryEntry(entry, collection, options = {}) {
        const runDelete = async () => {
            const saved = await deleteMemoryEntry(entry, collection, options);
            if (window.showToast) window.showToast(saved ? '记忆已删除' : '删除失败');
        };
        const label = collection === 'shortTermEntries' ? '短期记忆' : '长期记忆';
        if (window.showCustomModal) {
            window.showCustomModal({
                title: `删除${label}`,
                message: '确定彻底删除这条记忆吗？删除后无法恢复。',
                confirmText: '删除',
                isDestructive: true,
                onConfirm: runDelete
            });
        } else if (window.confirm('确定彻底删除这条记忆吗？')) {
            runDelete();
        }
    }

    async function deleteShortTermMemoryEntry(entry, options = {}) {
        if (!entry) return false;
        const friend = getCurrentMemoryFriend();
        if (!friend) return false;

        const saved = await window.imApp.commitScopedFriendChange(friend, (targetFriend) => {
            if (!targetFriend) return;
            targetFriend.memory = targetFriend.memory || window.imApp.createDefaultMemory();
            if (!Array.isArray(targetFriend.memory.shortTermEntries)) targetFriend.memory.shortTermEntries = [];
            const entries = Array.isArray(targetFriend.memory.shortTermEntries) ? targetFriend.memory.shortTermEntries : [];
            targetFriend.memory.shortTermEntries = window.imDataUtils?.removeShortTermSummaryEntry
                ? window.imDataUtils.removeShortTermSummaryEntry(entries, entry.id)
                : entries.filter(item => !item || String(item.id) !== String(entry.id));
            const presentedEntries = targetFriend.memory.recallPresentation?.recall?.shortTermEntries;
            if (Array.isArray(presentedEntries) && presentedEntries.some(item => String(item?.id) === String(entry.id))) {
                targetFriend.memory.recallPresentation = null;
            }
            if (window.imApp.clearFriendRuntimeMessageContext) {
                window.imApp.clearFriendRuntimeMessageContext(targetFriend);
            }
        }, { silent: true });

        if (!saved) return false;
        if (options.closeDetail && window.closeView && memoryEntryDetailModal) {
            window.closeView(memoryEntryDetailModal);
        }
        renderMemoryLocationSheet('iphone');
        renderMemoryView();
        window.dispatchEvent(new CustomEvent('u2:memory-entries-updated', {
            detail: {
                friendId: String(friend.id),
                action: 'delete',
                collection: 'shortTermEntries',
                entryId: String(entry.id)
            }
        }));
        return true;
    }

    function confirmDeleteShortTermMemoryEntry(entry, options = {}) {
        const runDelete = async () => {
            const saved = await deleteShortTermMemoryEntry(entry, options);
            if (window.showToast) window.showToast(saved ? '已删除短期记忆' : '删除失败');
        };

        if (window.showCustomModal) {
            window.showCustomModal({
                title: '删除已总结记录',
                message: '确定彻底删除这条已总结记录吗？这会同时从角色记忆上下文中移除，无法恢复。',
                confirmText: '删除',
                isDestructive: true,
                onConfirm: runDelete
            });
            return;
        }

        if (window.confirm('确定彻底删除这条已总结记录吗？这会同时从角色记忆上下文中移除，无法恢复。')) {
            runDelete();
        }
    }

    function showMemoryEntryDetail(entry, kind = 'short', collection = 'shortTermEntries') {
        if (!entry || !memoryEntryDetailModal || !memoryEntryDetailBody) return;
        if (memoryEntryDetailTitle) memoryEntryDetailTitle.textContent = entry.title || '记忆详情';
        const isShort = kind === 'short';
        const memoryTags = isShort
            ? (window.imChat?.getShortTermMemoryTags
                ? window.imChat.getShortTermMemoryTags(entry)
                : (Array.isArray(entry.memoryTags) ? entry.memoryTags : []))
            : (Array.isArray(entry.triggerKeywords) ? entry.triggerKeywords : []);
        memoryEntryDetailBody.innerHTML = `
            <div class="memory-entry-field">
                <div class="memory-entry-field-label">时间</div>
                <div class="memory-entry-field-value">${escapeMemoryHtml(entry.time || entry.createdAt || '')}</div>
            </div>
            <div class="memory-entry-field">
                <div class="memory-entry-field-label">${isShort ? '事件' : '内容'}</div>
                <div class="memory-entry-field-value">${escapeMemoryHtml(isShort ? (entry.event || entry.content || '') : (entry.content || ''))}</div>
            </div>
            <div class="memory-entry-field">
                <div class="memory-entry-field-label">记忆标签</div>
                <div class="memory-entry-field-value" style="display:flex; flex-wrap:wrap; gap:6px;">${memoryTags.length > 0
                    ? memoryTags.map(tag => `<span style="padding:3px 8px; border-radius:999px; background:#e8f2ff; color:#007aff; font-size:12px; font-weight:600;">${escapeMemoryHtml(tag)}</span>`).join('')
                    : '暂无标签'}</div>
            </div>
            ${isShort ? `<div class="memory-entry-field">
                <div class="memory-entry-field-label">记忆程度</div>
                <div class="memory-entry-field-value">${escapeMemoryHtml(entry.degree || '高')}</div>
            </div>` : ''}
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:20px;">
                <button type="button" id="memory-entry-detail-edit-btn" style="width:100%; padding:12px; border-radius:12px; background:#e8f2ff; color:#007aff; border:none; font-size:15px; font-weight:600; cursor:pointer;">
                    <i class="fas fa-pen"></i> 编辑
                </button>
                <button type="button" id="memory-entry-detail-delete-btn" style="width: 100%; padding: 12px; border-radius: 12px; background: #ffe5e5; color: #ff3b30; border: none; font-size: 15px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    <i class="fas fa-trash-alt"></i> 删除这条记忆
                </button>
            </div>
        `;
        
        const editBtn = document.getElementById('memory-entry-detail-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                if (window.closeView) window.closeView(memoryEntryDetailModal);
                openMemoryEntryEditor(kind, entry, collection);
            });
        }
        const deleteBtn = document.getElementById('memory-entry-detail-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                confirmDeleteMemoryEntry(entry, collection, { closeDetail: true });
            });
        }
        
        if (window.openView) window.openView(memoryEntryDetailModal);
    }

    function renderMemoryLocationSheet(location) {
        if (!memoryLocationSheetContent) return;

        location = location || 'iphone';
        currentMemoryLocation = location;

        const friend = getCurrentMemoryFriend();

        const normalizedFriend = friend ? window.imApp.normalizeFriendData(friend) : null;

        if (location === 'x-dm') {
            if (!normalizedFriend || normalizedFriend.type === 'group') {
                memoryLocationSheetContent.innerHTML = `
                    <div class="memory-sheet-title">社交帐号</div>
                    <div class="memory-short-list">
                        <div class="memory-short-empty">仅支持 iMessage 单聊 Char 挂载 X 私信。</div>
                    </div>
                `;
                return;
            }

            const mount = window.imApp.normalizeXDirectMessageMount(normalizedFriend.memory?.xDirectMessageMount);
            const candidates = window.imApp.getXDirectMessageMountCandidates(normalizedFriend);
            const selected = candidates.find(item => item.id === mount.dmId)
                || (!mount.dmId ? candidates[0] : null);
            const selectedIsMissing = Boolean(mount.dmId && !selected);
            const selectedLabel = selected
                ? `${selected.name}${selected.handle ? ` · ${selected.handle}` : ''}`
                : '';
            const savedMount = { ...mount, dmId: selected?.id || mount.dmId };

            memoryLocationSheetContent.innerHTML = `
                <div class="memory-sheet-title">社交帐号</div>
                    <div style="margin:0 0 12px; padding:12px 14px; border-radius:14px; background:#f7f7fa; color:#636366; font-size:13px; line-height:1.5;">
                        开启后会参考同一 Char 的 X 私信、User 最近发布的 X 帖子，以及 Char 自己主页的 X 帖子；不会合并到 iMessage 聊天记录中。
                    </div>
                <div class="memory-short-list" style="gap:10px;">
                    <label style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; border-radius:14px; background:#f7f7fa;">
                        <span style="display:flex; flex-direction:column; min-width:0; gap:3px;"><strong style="font-size:15px; color:#111;">X 社交帐号</strong><small style="font-size:12px; color:#8e8e93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${selected ? `${escapeMemoryHtml(selectedLabel)} · 私信、User 帖子与 Char 主页帖子` : (selectedIsMissing ? '原会话已不存在' : '暂无对应私信')}</small></span>
                        <span style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
                            <input id="memory-x-dm-limit" type="number" min="1" max="50" step="1" value="${mount.limit}" aria-label="X 社交帐号每类上下文条数" style="width:48px; height:32px; border:1px solid #e5e5ea; border-radius:9px; background:#fff; color:#111; font-size:14px; text-align:center;">
                            <span style="font-size:13px; color:#8e8e93; margin-left:-6px;">条/类</span>
                            <input id="memory-x-dm-enabled" type="checkbox" aria-label="开启 X 社交帐号上下文" ${mount.enabled ? 'checked' : ''} ${selected ? '' : 'disabled'}>
                        </span>
                    </label>
                    ${candidates.length === 0 ? '<div class="memory-short-empty">未找到当前 Char 对应的 X 私信。请先在 X 中从 iMessage 导入该 Char 并创建私信，才能挂载社交帐号上下文。</div>' : ''}
                </div>
            `;

            const saveMount = async (nextMount) => {
                const saved = await window.imApp.commitScopedFriendChange(friend, targetFriend => {
                    targetFriend.memory = window.imApp.normalizeFriendData(targetFriend).memory;
                    targetFriend.memory.xDirectMessageMount = window.imApp.normalizeXDirectMessageMount(nextMount);
                }, { silent: true, syncActive: true, syncSettings: true });
                if (!saved) {
                    if (window.showToast) window.showToast('X 社交帐号上下文保存失败');
                    return false;
                }
                window.dispatchEvent(new CustomEvent('u2:memory-entries-updated', {
                    detail: { friendId: String(friend.id), action: 'x-dm-mount' }
                }));
                renderMemoryLocationSheet('x-dm');
                return true;
            };

            memoryLocationSheetContent.querySelector('#memory-x-dm-enabled')?.addEventListener('change', event => {
                saveMount({ ...savedMount, enabled: event.target.checked });
            });
            memoryLocationSheetContent.querySelector('#memory-x-dm-limit')?.addEventListener('change', event => {
                saveMount({ ...savedMount, limit: event.target.value });
            });
            return;
        }

        if (location === 'downloads') {
            const longTermEntries = Array.isArray(normalizedFriend?.memory?.longTermEntries)
                ? normalizedFriend.memory.longTermEntries.map(entry => ({ entry, collection: 'longTermEntries' }))
                : [];
            const cherishedEntries = Array.isArray(normalizedFriend?.memory?.cherishedEntries)
                ? normalizedFriend.memory.cherishedEntries.map(entry => ({ entry, collection: 'cherishedEntries' }))
                : [];
            const entries = [...longTermEntries, ...cherishedEntries];

            memoryLocationSheetContent.innerHTML = `
                <div class="memory-sheet-title-row">
                    <div class="memory-sheet-title">长期记忆</div>
                    <button type="button" class="memory-sheet-add-btn" data-memory-add-kind="long" aria-label="新增长期记忆"><i class="fas fa-plus"></i></button>
                </div>
                <div class="memory-recall-limit-row">
                    <span>读取条数 <small>长期记忆与珍视回忆共用</small></span>
                    <input type="number" min="1" max="100" step="1" value="${escapeMemoryHtml(normalizedFriend.memory?.recallLimits?.longTerm || 30)}" data-memory-recall-limit="longTerm" aria-label="长期记忆读取条数">
                </div>
                <div class="memory-short-list">
                    ${entries.length === 0 ? '<div class="memory-short-empty">暂无长期记忆</div>' : entries.slice().reverse().map(({ entry, collection }) => `
                        <div class="memory-short-item memory-long-summary-item" role="button" tabindex="0" data-memory-entry-id="${escapeMemoryHtml(entry.id)}" data-memory-collection="${collection}">
                            <span class="memory-short-summary-title">${escapeMemoryHtml(entry.title || '长期记忆')}</span>
                            <div class="memory-short-actions">
                                <span style="font-size:11px; color:#8e8e93;">${collection === 'cherishedEntries' ? '珍视' : '长期'}</span>
                                <button type="button" class="memory-short-delete-btn" aria-label="删除长期记忆"><i class="fas fa-trash-alt"></i></button>
                                <i class="fas fa-chevron-right"></i>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            memoryLocationSheetContent.querySelector('[data-memory-recall-limit="longTerm"]')?.addEventListener('change', event => {
                void saveMemoryRecallLimit('longTerm', event.target.value);
            });

            memoryLocationSheetContent.querySelector('[data-memory-add-kind="long"]')?.addEventListener('click', () => openMemoryEntryEditor('long'));
            memoryLocationSheetContent.querySelectorAll('.memory-long-summary-item').forEach(btn => {
                const resolveEntry = () => {
                    const entryId = btn.getAttribute('data-memory-entry-id');
                    const collection = btn.getAttribute('data-memory-collection') || 'longTermEntries';
                    return { collection, entry: findMemoryEntry(getCurrentMemoryFriend(), collection, entryId) };
                };
                btn.addEventListener('click', event => {
                    if (event.target instanceof Element && event.target.closest('.memory-short-delete-btn')) return;
                    const resolved = resolveEntry();
                    if (resolved.entry) showMemoryEntryDetail(resolved.entry, 'long', resolved.collection);
                });
                btn.querySelector('.memory-short-delete-btn')?.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    const resolved = resolveEntry();
                    if (resolved.entry) confirmDeleteMemoryEntry(resolved.entry, resolved.collection);
                });
            });
            return;
        }

        if (location !== 'iphone') {
            memoryLocationSheetContent.innerHTML = '';
            return;
        }

        // Short-term memory library for manually generated chat summaries.
        const entries = Array.isArray(normalizedFriend?.memory?.shortTermEntries)
            ? normalizedFriend.memory.shortTermEntries
            : [];

        memoryLocationSheetContent.innerHTML = `
            <div class="memory-sheet-title-row">
                <div class="memory-sheet-title">短期记忆</div>
                <div class="memory-sheet-toolbar">
                    <button type="button" class="memory-sheet-text-btn" data-memory-select-all>全选</button>
                    <button type="button" class="memory-sheet-add-btn" data-memory-add-kind="short" aria-label="新增短期记忆"><i class="fas fa-plus"></i></button>
                </div>
            </div>
            <div class="memory-recall-limit-row">
                <span>读取条数 <small>按相关度最多注入</small></span>
                <input type="number" min="1" max="100" step="1" value="${escapeMemoryHtml(normalizedFriend.memory?.recallLimits?.shortTerm || 30)}" data-memory-recall-limit="shortTerm" aria-label="短期记忆读取条数">
            </div>
            <div class="memory-short-list">
                ${entries.length === 0 ? '<div class="memory-short-empty">暂无短期记忆</div>' : entries.slice().reverse().map(entry => `
                    <div class="memory-short-item memory-short-summary-item" role="button" tabindex="0" data-memory-entry-id="${entry.id}">
                        <input type="checkbox" class="memory-short-select" data-memory-select-id="${escapeMemoryHtml(entry.id)}" aria-label="选择${escapeMemoryHtml(entry.title || '短期记忆')}">
                        <span class="memory-short-summary-title">${escapeMemoryHtml(entry.title || '对话总结')}</span>
                        <div class="memory-short-actions">
                            <button type="button" class="memory-short-delete-btn" aria-label="删除已总结记录" title="删除已总结记录"><i class="fas fa-trash-alt"></i></button>
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button type="button" class="memory-promotion-btn" data-memory-promote disabled>归纳为长期记忆</button>
        `;

        memoryLocationSheetContent.querySelector('[data-memory-recall-limit="shortTerm"]')?.addEventListener('change', event => {
            void saveMemoryRecallLimit('shortTerm', event.target.value);
        });
        memoryLocationSheetContent.querySelector('[data-memory-add-kind="short"]')?.addEventListener('click', () => openMemoryEntryEditor('short'));

        const selectedIds = new Set();
        const selectAllButton = memoryLocationSheetContent.querySelector('[data-memory-select-all]');
        const promoteButton = memoryLocationSheetContent.querySelector('[data-memory-promote]');
        const refreshPromotionSelection = () => {
            const allSelected = entries.length > 0 && selectedIds.size === entries.length;
            if (selectAllButton) selectAllButton.textContent = allSelected ? '取消全选' : '全选';
            if (promoteButton) {
                const isPromoting = promoteButton.dataset.memoryPromoting === 'true';
                if (isPromoting) {
                    promoteButton.disabled = true;
                    promoteButton.textContent = '正在归纳...';
                    return;
                }
                promoteButton.disabled = selectedIds.size === 0;
                promoteButton.textContent = selectedIds.size > 0
                    ? `归纳 ${selectedIds.size} 条为长期记忆`
                    : '归纳为长期记忆';
            }
        };
        selectAllButton?.addEventListener('click', event => {
            event.preventDefault();
            const shouldSelectAll = selectedIds.size !== entries.length;
            memoryLocationSheetContent.querySelectorAll('.memory-short-select').forEach(input => {
                input.checked = shouldSelectAll;
                const id = String(input.getAttribute('data-memory-select-id') || '');
                if (shouldSelectAll) selectedIds.add(id);
                else selectedIds.delete(id);
            });
            refreshPromotionSelection();
        });
        promoteButton?.addEventListener('click', async () => {
            if (promoteButton.dataset.memoryPromoting === 'true' || selectedIds.size === 0) return;
            promoteButton.dataset.memoryPromoting = 'true';
            promoteButton.setAttribute('aria-busy', 'true');
            refreshPromotionSelection();
            try {
                await generateMemoryPromotion(normalizedFriend, Array.from(selectedIds));
            } finally {
                delete promoteButton.dataset.memoryPromoting;
                promoteButton.removeAttribute('aria-busy');
                if (promoteButton.isConnected) refreshPromotionSelection();
            }
        });

        memoryLocationSheetContent.querySelectorAll('.memory-short-summary-item').forEach(btn => {
            const openEntry = () => {
                const entryId = btn.getAttribute('data-memory-entry-id');
                const target = entries.find(entry => String(entry.id) === String(entryId));
                if (target) showMemoryEntryDetail(target);
            };
            btn.addEventListener('click', (event) => {
                const targetEl = event.target instanceof Element ? event.target : null;
                if (targetEl?.closest('.memory-short-delete-btn')) return;
                if (targetEl?.closest('.memory-short-select')) return;
                openEntry();
            });
            btn.addEventListener('keydown', (event) => {
                const targetEl = event.target instanceof Element ? event.target : null;
                if (targetEl?.closest('.memory-short-delete-btn')) return;
                if (targetEl?.closest('.memory-short-select')) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openEntry();
                }
            });
            const deleteBtn = btn.querySelector('.memory-short-delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const entryId = btn.getAttribute('data-memory-entry-id');
                    const target = entries.find(entry => String(entry.id) === String(entryId));
                    if (target) confirmDeleteMemoryEntry(target, 'shortTermEntries');
                });
            }
            const selectInput = btn.querySelector('.memory-short-select');
            selectInput?.addEventListener('change', () => {
                const id = String(selectInput.getAttribute('data-memory-select-id') || '');
                if (selectInput.checked) selectedIds.add(id);
                else selectedIds.delete(id);
                refreshPromotionSelection();
            });
        });
    }

    window.imApp.openMemoryLocationForFriend = function(friendOrId, location) {
        const friend = window.imApp.getFriendById
            ? window.imApp.getFriendById(friendOrId)
            : ((window.imData.friends || []).find(item => String(item.id) === String(friendOrId?.id ?? friendOrId)));
        if (!friend) return false;
        setMemoryFriendSelection(friend);
        renderMemoryLocationSheet(location);
        if (memoryLocationSheet && window.openView) {
            window.openView(memoryLocationSheet);
            return true;
        }
        return false;
    };

    window.imApp.openMemoryScheduleForFriend = function(friendOrId) {
        const friend = window.imApp.getFriendById
            ? window.imApp.getFriendById(friendOrId)
            : ((window.imData.friends || []).find(item => String(item.id) === String(friendOrId?.id ?? friendOrId)));
        if (!friend) return false;
        setMemoryFriendSelection(friend);
        if (scheduleModal && window.openView) {
            renderScheduleModal();
            window.openView(scheduleModal);
            return true;
        }
        return false;
    };

    window.imApp.getCurrentMemoryFriend = getCurrentMemoryFriend;

    window.imApp.refreshMemoryLocationSheet = function(location) {
        renderMemoryLocationSheet(location || currentMemoryLocation || 'iphone');
    };

    if (memoryEntryDetailClose && memoryEntryDetailModal) {
        memoryEntryDetailClose.addEventListener('click', () => {
            if (window.closeView) window.closeView(memoryEntryDetailModal);
        });
    }

    [memoryEntryEditorClose, memoryEntryEditorCancel].forEach(button => {
        button?.addEventListener('click', closeMemoryEntryEditor);
    });
    memoryEntryEditorSave?.addEventListener('click', () => void saveMemoryEntryEditor());
    memoryEntryEditorModal?.addEventListener('click', event => {
        if (event.target === memoryEntryEditorModal) closeMemoryEntryEditor();
    });

    [memoryPromotionPreviewClose, memoryPromotionPreviewCancel].forEach(button => {
        button?.addEventListener('click', closeMemoryPromotionPreview);
    });
    memoryPromotionPreviewConfirm?.addEventListener('click', () => void confirmMemoryPromotionPreview());
    memoryPromotionPreviewModal?.addEventListener('click', event => {
        if (event.target === memoryPromotionPreviewModal) closeMemoryPromotionPreview();
    });

    if (scheduleClose && scheduleModal) {
        scheduleClose.addEventListener('click', () => {
            if (window.closeView) window.closeView(scheduleModal);
        });
    }

    window.imApp.renderMemoryView = renderMemoryView;

    function hideAllTabs() {
        if(imContent) imContent.style.display = 'none';
        if(chatsContent) chatsContent.style.display = 'none';
        if(momentsContent) momentsContent.style.display = 'none';
        if(imContent) imContent.setAttribute('aria-hidden', 'true');
        if(chatsContent) chatsContent.setAttribute('aria-hidden', 'true');
        
        if(navHomeBtn) navHomeBtn.classList.remove('active');
        if(navChatsBtn) navChatsBtn.classList.remove('active');
        if(navMomentsBtn) navMomentsBtn.classList.remove('active');
        
        const imHeaderRight = document.querySelector('.line-header-right');
        if (imHeaderRight) imHeaderRight.style.display = 'flex'; 
    }

    if (navHomeBtn) {
        navHomeBtn.addEventListener('click', () => {
            hideAllTabs();
            window.imApp.setActiveThemeSurface('home');
            if(imContent) imContent.style.display = 'block';
            if(imContent) imContent.setAttribute('aria-hidden', 'false');
            if(imBottomNavContainer) imBottomNavContainer.style.display = 'flex';
            navHomeBtn.classList.add('active');
            updateLineNavIndicator(navHomeBtn);
            if (window.imApp.renderFriendsList) window.imApp.renderFriendsList();
            if (window.imApp.renderGroupsList) window.imApp.renderGroupsList();
        });
    }

    if (navChatsBtn) {
        navChatsBtn.addEventListener('click', () => {
            hideAllTabs();
            window.imApp.setActiveThemeSurface('chats');
            if(chatsContent) {
                chatsContent.style.display = 'flex';
                chatsContent.style.flexDirection = 'column';
                chatsContent.setAttribute('aria-hidden', 'false');
                if (window.imApp.updateChatsView) window.imApp.updateChatsView();
            }
            navChatsBtn.classList.add('active');
            updateLineNavIndicator(navChatsBtn);
            if (window.imApp.updateChatsUnreadBadges) window.imApp.updateChatsUnreadBadges();
        });
    }

    if (navMomentsBtn) {
        navMomentsBtn.addEventListener('click', () => {
            hideAllTabs();
            window.imApp.setActiveThemeSurface('moments');
            if(momentsContent) {
                momentsContent.style.display = 'flex';
                momentsContent.style.flexDirection = 'column';
                if (window.imApp.renderMoments) window.imApp.renderMoments();
                
                if(imBottomNavContainer) imBottomNavContainer.style.display = 'flex';
                
                const imHeaderRight = document.querySelector('.line-header-right');
                if (imHeaderRight) imHeaderRight.style.display = 'none';
            }
            navMomentsBtn.classList.add('active');
            updateLineNavIndicator(navMomentsBtn);
            if (window.imApp.updateChatsUnreadBadges) window.imApp.updateChatsUnreadBadges();
        });
    }

    window.imApp.setActiveThemeSurface(
        navChatsBtn?.classList.contains('active') ? 'chats' : (navMomentsBtn?.classList.contains('active') ? 'moments' : 'home')
    );

    // Initialize saved CSS for all friends on boot
    setTimeout(() => {
        if (window.imApp.applyAllSavedCss) window.imApp.applyAllSavedCss();
    }, 100);
});

