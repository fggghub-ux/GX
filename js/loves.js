/**
 * Loves App Logic
 */
window.lovesApp = {
    view: null,
    backBtn: null,
    initialized: false,
    currentImsgAccount: 'main',
    currentWeiboAccount: 'main',
    currentComputerApp: null,
    currentFriend: null,
    currentSelectedFriendId: null,
    lovesProgrammaticScrollUntil: 0,
    _realTimeJobsStarted: false,
    _realTimeTimer: null,
    _momentReplyQueues: new Map(),
    _androidFocusScopeCleanup: null,

    persistFriendState: async function(friend = this.currentFriend, options = {}) {
        if (!friend) return false;

        if (window.imApp && typeof window.imApp.commitScopedFriendChange === 'function') {
            const saved = await window.imApp.commitScopedFriendChange(friend, (targetFriend) => {
                if (this.currentFriend && String(this.currentFriend.id) === String(targetFriend.id)) {
                    this.currentFriend = targetFriend;
                }
            }, {
                silent: options.silent !== false,
                syncActive: true,
                metaOnly: options.metaOnly === true
            });
            return !!saved;
        }

        if (typeof window.saveGlobalData === 'function') {
            await window.saveGlobalData();
            return true;
        }

        return false;
    },

    bindLongPress: function(element, callback) {
        let pressTimer = null;
        let startX = 0, startY = 0;

        const start = (e) => {
            if (e.type === 'mousedown' && e.button !== 0) return;
            if (e.type === 'touchstart') {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            } else {
                startX = e.clientX;
                startY = e.clientY;
            }
            if (pressTimer === null) {
                pressTimer = setTimeout(() => {
                    pressTimer = null;
                    callback(e);
                }, 600);
            }
        };

        const cancel = () => {
            if (pressTimer !== null) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        const move = (e) => {
            if (pressTimer === null) return;
            let currentX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
            let currentY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
            if (Math.abs(currentX - startX) > 10 || Math.abs(currentY - startY) > 10) {
                cancel();
            }
        };

        element.addEventListener('mousedown', start);
        element.addEventListener('touchstart', start, {passive: true});
        element.addEventListener('mousemove', move);
        element.addEventListener('touchmove', move, {passive: true});
        element.addEventListener('mouseup', cancel);
        element.addEventListener('touchend', cancel);
        element.addEventListener('mouseleave', cancel);
        element.addEventListener('touchcancel', cancel);
    },

    showDeleteConfirm: function(text, onConfirm) {
        const result = window.confirm('确定要删除 "' + text + '" 吗？');
        if (result) {
            Promise.resolve(onConfirm()).then(() => {
            });
            if (window.showToast) window.showToast('已删除');
        }
    },

    escapeHTML: function(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[char]);
    },

    normalizeFriendPhoneLanguage: function(value) {
        if (window.imDataUtils?.normalizeChatLanguage) return window.imDataUtils.normalizeChatLanguage(value || 'zh');
        const language = String(value || 'zh').trim().toLowerCase();
        if (['zh', 'cn', 'zh-cn'].includes(language)) return 'zh';
        if (['ko', 'kr'].includes(language)) return 'ko';
        if (['ja', 'jp'].includes(language)) return 'ja';
        return language || 'zh';
    },

    getFriendPhoneLanguageName: function(value) {
        if (window.imDataUtils?.getChatLanguageName) return window.imDataUtils.getChatLanguageName(value || 'zh');
        return ({ zh: 'Chinese', en: 'English', ja: 'Japanese', ko: 'Korean', fr: 'French' })[this.normalizeFriendPhoneLanguage(value)] || String(value || 'Chinese');
    },

    resolveLovesMomentLanguage: function(friend = this.currentFriend) {
        return this.normalizeFriendPhoneLanguage(friend?.language || 'zh');
    },

    buildLovesMomentLocalizationContract: function(friend = this.currentFriend, subject = 'content') {
        const language = this.resolveLovesMomentLanguage(friend);
        if (window.imDataUtils?.buildLocalizedJsonContract) {
            return window.imDataUtils.buildLocalizedJsonContract(language, subject);
        }
        const languageName = this.getFriendPhoneLanguageName(language);
        return language === 'zh'
            ? `${subject}.text must be natural Simplified Chinese and ${subject}.translation must be an empty string.`
            : `${subject}.text must be written only in ${languageName}; ${subject}.translation is mandatory and must be a natural accurate Simplified Chinese translation of that text.`;
    },

    normalizeLovesMomentLocalizedContent: function(value, friend = this.currentFriend) {
        const language = this.resolveLovesMomentLanguage(friend);
        if (window.imDataUtils?.normalizeLocalizedContent) {
            return window.imDataUtils.normalizeLocalizedContent(value, language);
        }
        const source = value && typeof value === 'object' ? value : { text: value };
        const text = String(source.text ?? source.content ?? '').trim();
        let translation = String(source.translation ?? source.translationZh ?? '').trim();
        if (!text) return null;
        if (language === 'zh') translation = '';
        if (language !== 'zh' && !translation) return null;
        return { text, translation, language };
    },

    getLovesMomentTranslation: function(record) {
        if (!record || typeof record !== 'object') return '';
        return String(record.translation ?? record.translationZh ?? record.textTranslationZh ?? record.textTranslation ?? '').trim();
    },

    renderLovesMomentTranslation: function(translation, targetId) {
        const text = String(translation || '').trim();
        if (!text) return '';
        const safeTargetId = this.escapeHTML(targetId);
        return `<button type="button" class="loves-moment-translate-toggle" aria-expanded="false" aria-controls="${safeTargetId}" data-loves-translation-target="${safeTargetId}">翻译</button><div class="loves-moment-translation" id="${safeTargetId}" hidden>${this.escapeHTML(text).replace(/\n/g, '<br>')}</div>`;
    },

    bindLovesMomentTranslationControls: function(container) {
        if (!container) return;
        container.querySelectorAll('.loves-moment-translate-toggle').forEach(control => {
            const toggle = (event) => {
                event.preventDefault();
                event.stopPropagation();
                const targetId = control.getAttribute('data-loves-translation-target');
                const translation = targetId ? document.getElementById(targetId) : null;
                if (!translation) return;
                const expanded = control.getAttribute('aria-expanded') === 'true';
                control.setAttribute('aria-expanded', String(!expanded));
                control.textContent = expanded ? '翻译' : '收起';
                translation.hidden = expanded;
            };
            control.addEventListener('click', toggle);
        });
    },

    formatFriendPhoneGeneratedAt: function(value, nowValue = Date.now()) {
        const timestamp = Number(value);
        if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) return '';
        const now = new Date(nowValue);
        const pad = part => String(part).padStart(2, '0');
        const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
        const isToday = !Number.isNaN(now.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
        return isToday ? time : `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${time}`;
    },

    getFriendPhoneTranslation: function(record, field) {
        if (!record || typeof record !== 'object') return '';
        return String(record[`${field}TranslationZh`] ?? record[`${field}Translation`] ?? (field === 'text' ? (record.translationZh ?? record.translation) : '') ?? '').trim();
    },

    getFriendPhoneChineseContactName: function(record, field = 'name', fallback = '未知联系人') {
        if (!record || typeof record !== 'object') return String(fallback || '未知联系人');
        const fallbackName = String(fallback || '未知联系人');
        const translation = this.getFriendPhoneTranslation(record, field);
        const original = String(record[field] ?? '').trim();
        const hasChinese = value => /[\u3400-\u9fff]/.test(String(value || ''));
        if (hasChinese(translation)) return translation;
        if (hasChinese(original)) return original;
        return fallbackName;
    },

    renderFriendPhoneLocalized: function(record, field, options = {}) {
        const original = this.escapeHTML(record?.[field] ?? options.fallback ?? '').replace(/\n/g, '<br>');
        const translation = this.escapeHTML(this.getFriendPhoneTranslation(record, field)).replace(/\n/g, '<br>');
        if (!translation) return original;
        const id = `friend-phone-translation-${String(record?.batchId || 'legacy')}-${String(options.id || field)}-${Math.random().toString(36).slice(2, 8)}`;
        return `${original}<span class="friend-phone-translate-toggle" role="button" tabindex="0" aria-expanded="false" aria-controls="${id}">翻译</span><span class="friend-phone-translation" id="${id}" hidden>${translation}</span>`;
    },

    renderFriendPhoneGeneratedTime: function(record, className = '') {
        const text = this.formatFriendPhoneGeneratedAt(record?.generatedAt);
        return text ? `<span class="friend-phone-generated-time ${className}">${this.escapeHTML(text)}</span>` : '';
    },

    bindFriendPhoneTranslationDelegation: function(phoneView) {
        if (!phoneView || phoneView.dataset.translationBound === '1') return;
        const toggle = (control) => {
            const targetId = control.getAttribute('aria-controls');
            const target = targetId ? document.getElementById(targetId) : control.querySelector('.friend-phone-translation');
            if (!target) return;
            const expanded = control.getAttribute('aria-expanded') === 'true';
            control.setAttribute('aria-expanded', String(!expanded));
            target.hidden = expanded;
        };
        phoneView.addEventListener('click', event => {
            const control = event.target.closest('.friend-phone-translate-toggle, .friend-phone-bubble-translatable');
            if (!control || !phoneView.contains(control)) return;
            event.preventDefault();
            event.stopPropagation();
            toggle(control);
        }, true);
        phoneView.addEventListener('keydown', event => {
            if (!['Enter', ' '].includes(event.key)) return;
            const control = event.target.closest('.friend-phone-translate-toggle, .friend-phone-bubble-translatable');
            if (!control || !phoneView.contains(control)) return;
            event.preventDefault();
            toggle(control);
        });
        phoneView.dataset.translationBound = '1';
    },

    stripAndStampFriendPhoneGeneratedTree: function(value, generatedAt, batchId) {
        if (Array.isArray(value)) return value.map(item => this.stripAndStampFriendPhoneGeneratedTree(item, generatedAt, batchId));
        if (!value || typeof value !== 'object') return value;
        const blockedTimeKeys = new Set(['time', 'createdAt', 'timestamp', 'addedTime', 'recentCallTime', 'date', 'datetime']);
        const output = {};
        Object.entries(value).forEach(([key, item]) => {
            if (blockedTimeKeys.has(key)) return;
            output[key] = this.stripAndStampFriendPhoneGeneratedTree(item, generatedAt, batchId);
        });
        output.generatedAt = generatedAt;
        output.batchId = batchId;
        return output;
    },

    validateFriendPhoneLocalizedTree: function(value, language, path = 'root') {
        if (this.normalizeFriendPhoneLanguage(language) === 'zh') return [];
        const machineFields = new Set(['id', 'batchId', 'kind', 'sender', 'type', 'icon', 'color', 'cardNumber', 'loops', 'steps', 'sleepHours', 'sleepMinutes', 'heartRate', 'weight', 'height', 'totalAssets', 'amount', 'isIncome', 'reposts', 'likes', 'url', 'avatarUrl', 'result', 'kda', 'winRate']);
        const missingPaths = [];
        const isChineseOnlyContactField = (key, currentPath) => {
            if (key === 'contactName' || key === 'userRemark') return true;
            return key === 'name' && /^phone\.call\.(?:recentCalls|contacts)\[\d+\]$/.test(currentPath);
        };
        const isUnrestrictedLanguageField = (key, currentPath) => {
            if (key === 'name' && /^phone\.music\.(?:recent|favorites|top)\[\d+\]$/.test(currentPath)) return true;
            if (currentPath.startsWith('phone.weibo')) return key !== 'text';
            if (currentPath.startsWith('phone.files')) return key !== 'content';
            if (!currentPath.startsWith('phone.game')) return false;
            return !['desc', 'innerThoughts', 'postGameReflection', 'thoughts'].includes(key);
        };
        const visit = (node, currentPath) => {
            if (Array.isArray(node)) return node.forEach((item, index) => visit(item, `${currentPath}[${index}]`));
            if (!node || typeof node !== 'object') return;
            Object.entries(node).forEach(([key, item]) => {
                if (key.endsWith('TranslationZh') || key.endsWith('Translation') || key === 'translationZh' || key === 'translation') return;
                if (typeof item === 'string' && item.trim() && !machineFields.has(key) && !isChineseOnlyContactField(key, currentPath) && !isUnrestrictedLanguageField(key, currentPath)) {
                    const translation = String(node[`${key}TranslationZh`] ?? (key === 'text' ? (node.translationZh ?? node.translation) : '') ?? '').trim();
                    if (!translation) missingPaths.push(`${currentPath}.${key}`);
                } else if (item && typeof item === 'object') visit(item, `${currentPath}.${key}`);
            });
        };
        visit(value, path);
        if (missingPaths.length) console.warn('[Loves] 好友手机内容缺少中文翻译，已按原文降级展示：', missingPaths);
        return missingPaths;
    },

    clearFriendPhoneChineseTranslations: function(value) {
        if (Array.isArray(value)) return value.forEach(item => this.clearFriendPhoneChineseTranslations(item));
        if (!value || typeof value !== 'object') return;
        Object.keys(value).forEach(key => {
            if (key.endsWith('TranslationZh') || key === 'translationZh' || key === 'translation') value[key] = '';
            else this.clearFriendPhoneChineseTranslations(value[key]);
        });
    },

    mergeFriendPhoneNamedRecords: function(fresh, old, key = 'name', mergeItem = null) {
        const remaining = Array.isArray(old) ? old.slice() : [];
        return (Array.isArray(fresh) ? fresh : []).map(item => {
            const index = remaining.findIndex(existing => String(existing?.[key] || '').trim().toLocaleLowerCase() === String(item?.[key] || '').trim().toLocaleLowerCase());
            const existing = index >= 0 ? remaining.splice(index, 1)[0] : null;
            return mergeItem && existing ? mergeItem(item, existing) : item;
        }).concat(remaining);
    },

    mergeFriendPhoneChats: function(freshChats, oldChats, isAlt = false) {
        const remaining = Array.isArray(oldChats) ? oldChats.slice() : [];
        const chatKey = chat => String(chat?.contactNameTranslationZh || chat?.contactName || '').trim().toLocaleLowerCase();
        const merged = (Array.isArray(freshChats) ? freshChats : []).map(fresh => {
            const index = remaining.findIndex(old => chatKey(old) === chatKey(fresh));
            const old = index >= 0 ? remaining.splice(index, 1)[0] : null;
            return old ? { ...old, ...fresh, messages: [...(fresh.messages || []), ...(old.messages || [])] } : fresh;
        }).concat(remaining);
        if (!isAlt) return merged;
        const fixedNames = ['备忘录', '文件传输助手'];
        const fixedNameOf = chat => chat?.kind === 'memo' ? '备忘录' : (chat?.kind === 'file_transfer' ? '文件传输助手' : String(chat?.contactNameTranslationZh || chat?.contactName || '').trim());
        return [...fixedNames.map(name => merged.find(chat => fixedNameOf(chat) === name)).filter(Boolean), ...merged.filter(chat => !fixedNames.includes(fixedNameOf(chat)))];
    },

    normalizeFriendPhoneChatMessages: function(messages, max = 5) {
        if (!Array.isArray(messages)) return [];
        const safeMax = this.clampFriendGenCount(max, 5, 1, 20);
        return messages.filter(message => message && typeof message === 'object' && !Array.isArray(message)).slice(0, safeMax);
    },

    normalizeFriendPhoneWeiboPostComments: function(posts, max = 5) {
        if (!Array.isArray(posts)) return [];
        const safeMax = this.clampFriendGenCount(max, 5, 1, 20);
        return posts.map(post => {
            if (!post || typeof post !== 'object' || Array.isArray(post)) return post;
            return {
                ...post,
                comments: Array.isArray(post.comments)
                    ? post.comments.filter(comment => comment && (typeof comment === 'object' || typeof comment === 'string')).slice(0, safeMax)
                    : []
            };
        });
    },

    mergeFriendPhoneGeneratedData: function(friend, parsed, options = {}) {
        const generatedAt = Number(options.generatedAt) || Date.now();
        const batchId = options.batchId || `phone-${generatedAt}-${Math.random().toString(36).slice(2, 8)}`;
        const language = this.normalizeFriendPhoneLanguage(friend?.language || 'zh');
        const clean = this.stripAndStampFriendPhoneGeneratedTree(parsed, generatedAt, batchId);
        if (language === 'zh') this.clearFriendPhoneChineseTranslations(clean);
        if (options.skipValidation !== true) this.validateFriendPhoneLocalizedTree(clean, language, 'phone');
        const next = {};

        if (clean.music) {
            const normalizeSong = song => {
                const normalized = { ...(song || {}) };
                delete normalized.nameTranslationZh;
                delete normalized.nameTranslation;
                return normalized;
            };
            next.musicData = {
                ...clean.music,
                recent: Array.isArray(clean.music.recent) ? clean.music.recent.map(normalizeSong) : [],
                favorites: Array.isArray(clean.music.favorites) ? clean.music.favorites.map(normalizeSong) : [],
                top: Array.isArray(clean.music.top) ? clean.music.top.map(normalizeSong) : []
            };
        }
        if (clean.health) {
            const snapshot = { ...clean.health, generatedAt, batchId };
            next.healthData = { ...snapshot, history: [snapshot] };
        }
        if (clean.pay) {
            const snapshot = { ...clean.pay, generatedAt, batchId };
            next.payData = {
                ...snapshot,
                recentTransactions: Array.isArray(clean.pay.recentTransactions) ? clean.pay.recentTransactions : [],
                snapshots: [snapshot]
            };
        }
        if (clean.safari) next.safariData = {
            recentSearches: Array.isArray(clean.safari.recentSearches) ? clean.safari.recentSearches : [],
            privateSearches: Array.isArray(clean.safari.privateSearches) ? clean.safari.privateSearches : []
        };
        if (clean.call) next.callData = {
            ...clean.call,
            recentCalls: Array.isArray(clean.call.recentCalls) ? clean.call.recentCalls : [],
            contacts: Array.isArray(clean.call.contacts) ? clean.call.contacts : []
        };
        if (clean.files) next.filesData = {
            ...clean.files,
            tags: Array.isArray(clean.files.tags) ? clean.files.tags : [],
            recent: Array.isArray(clean.files.recent) ? clean.files.recent : []
        };
        if (clean.game) {
            const stripTranslations = (record, fields) => {
                const normalized = { ...(record || {}) };
                fields.forEach(field => {
                    delete normalized[`${field}TranslationZh`];
                    delete normalized[`${field}Translation`];
                });
                return normalized;
            };
            const gameRoot = stripTranslations(clean.game, ['playerName', 'totalHours']);
            next.gameData = {
                ...gameRoot,
                recentGames: Array.isArray(clean.game.recentGames) ? clean.game.recentGames.map(game => {
                    const normalizedGame = stripTranslations(game, ['name', 'hours', 'rank', 'winRate']);
                    return {
                        ...normalizedGame,
                        matches: Array.isArray(game?.matches) ? game.matches.map(match => stripTranslations(match, ['result', 'kda', 'hero'])) : game?.matches
                    };
                }) : []
            };
        }
        if (clean.weibo) {
            const replaceAccount = fresh => ({
                ...(fresh || {}),
                posts: Array.isArray(fresh?.posts) ? fresh.posts : [],
                album: Array.isArray(fresh?.album) ? fresh.album : [],
                liked: Array.isArray(fresh?.liked) ? fresh.liked : []
            });
            next.weiboData = {
                mainAccount: replaceAccount(clean.weibo.mainAccount || clean.weibo.main || clean.weibo),
                altAccount: replaceAccount(clean.weibo.altAccount || clean.weibo.alt || {})
            };
        }
        if (clean.imessage) {
            const freshMain = clean.imessage.mainAccount || {};
            const freshAlt = clean.imessage.altAccount || {};
            next.imessageData = {
                mainAccount: {
                    ...freshMain,
                    chats: this.mergeFriendPhoneChats(freshMain.chats, [], false)
                },
                altAccount: {
                    ...freshAlt,
                    chats: this.mergeFriendPhoneChats(freshAlt.chats, [], true)
                }
            };
        }
        return { next, generatedAt, batchId };
    },

    getLocalDateKey: function(value = new Date()) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return this.getLocalDateKey(new Date());
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    parseDateKey: function(dateKey) {
        if (!dateKey || typeof dateKey !== 'string') return new Date();
        const parts = dateKey.split('-').map(Number);
        if (parts.length !== 3 || parts.some(Number.isNaN)) return new Date();
        return new Date(parts[0], parts[1] - 1, parts[2]);
    },

    getLocalDayOrdinal: function(value = new Date()) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return this.getLocalDayOrdinal(new Date());
        return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
    },

    addLocalDateDays: function(dateKey, amount = 1) {
        const date = this.parseDateKey(dateKey);
        date.setDate(date.getDate() + amount);
        return this.getLocalDateKey(date);
    },

    findLovesAcceptanceTimestamp: function(friend) {
        const messages = Array.isArray(friend?.messages) ? friend.messages : [];
        const acceptedMessage = messages.find((message) => {
            const text = String(message?.text || message?.content || '');
            return text.includes('[ACCEPT_INVITE]')
                || text.includes('【邀请已接受】')
                || text.includes('【情侣空间】我接受了你的邀请')
                || text.includes('TA 已接受了你的情侣空间邀请')
                || text.includes('我已经接受了你的情侣空间邀请');
        });
        const timestamp = Number(acceptedMessage?.timestamp);
        return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
    },

    ensureLovesStartTime: function(friend, fallbackTimestamp = Date.now()) {
        if (!friend || !friend.hasLovesSpace) return { timestamp: 0, changed: false };
        const existing = Number(friend.lovesSpaceStartTime);
        if (Number.isFinite(existing) && existing > 0) {
            return { timestamp: existing, changed: false };
        }

        const recovered = this.findLovesAcceptanceTimestamp(friend);
        const fallback = Number(fallbackTimestamp);
        const timestamp = recovered || (Number.isFinite(fallback) && fallback > 0 ? fallback : Date.now());
        friend.lovesSpaceStartTime = timestamp;
        return { timestamp, changed: true };
    },

    getLovesDaysCount: function(friend, now = new Date()) {
        const startTimestamp = Number(friend?.lovesSpaceStartTime);
        if (!Number.isFinite(startTimestamp) || startTimestamp <= 0) return 1;
        const startDay = this.getLocalDayOrdinal(new Date(startTimestamp));
        const currentDay = this.getLocalDayOrdinal(now);
        return Math.max(1, currentDay - startDay + 1);
    },

    syncDailySavingsForFriend: async function(friend, now = new Date(), options = {}) {
        if (!friend || !friend.hasLovesSpace) return false;
        const startState = this.ensureLovesStartTime(friend, now.getTime());
        const startDateKey = this.getLocalDateKey(startState.timestamp);
        const todayKey = this.getLocalDateKey(now);
        const savings = this.ensureSavingsData(friend);
        const existingDailyDates = new Set(
            savings.records
                .filter(record => record?.source === 'char_daily' || String(record?.id || '').startsWith('sav_char_daily_'))
                .map(record => record.date)
                .filter(Boolean)
        );

        let cursor = this.getLocalDayOrdinal(this.parseDateKey(startDateKey)) > this.getLocalDayOrdinal(now)
            ? todayKey
            : startDateKey;
        let changed = startState.changed;
        let safety = 0;

        while (cursor <= todayKey && safety < 20000) {
            if (!existingDailyDates.has(cursor)) {
                const isToday = cursor === todayKey;
                const recordDate = isToday ? new Date(now) : this.parseDateKey(cursor);
                if (!isToday) recordDate.setHours(12, 0, 0, 0);
                savings.records.unshift({
                    id: `sav_char_daily_${cursor}`,
                    amount: Math.floor(Math.random() * 100) + 1,
                    actor: 'char',
                    date: cursor,
                    note: 'Char 每日存钱',
                    source: 'char_daily',
                    timestamp: recordDate.getTime()
                });
                existingDailyDates.add(cursor);
                changed = true;
            }
            if (cursor === todayKey) break;
            cursor = this.addLocalDateDays(cursor, 1);
            safety += 1;
        }

        if (changed && options.persist !== false) {
            await this.persistFriendState(friend, { metaOnly: true, silent: true });
        }
        return changed;
    },

    syncAllLovesRealTimeData: async function() {
        if (window.imApp?.ensureDataReady) await window.imApp.ensureDataReady();
        const friends = Array.isArray(window.imData?.friends) ? window.imData.friends : [];
        const acceptedFriends = friends.filter(friend => friend?.hasLovesSpace);

        for (const friend of acceptedFriends) {
            if (!Number(friend.lovesSpaceStartTime) && window.imApp?.ensureFriendMessagesLoaded) {
                await window.imApp.ensureFriendMessagesLoaded(friend);
            }
            await this.syncDailySavingsForFriend(friend);
        }

        if (this.currentFriend?.hasLovesSpace) this.updateDaysCount(this.currentFriend);
        if (document.getElementById('lovers-savings-view')?.classList.contains('active')) {
            this.renderSavingsJar();
        }
    },

    scheduleNextRealTimeSync: function() {
        if (this._realTimeTimer) clearTimeout(this._realTimeTimer);
        const now = new Date();
        const nextMidnight = new Date(now);
        nextMidnight.setHours(24, 0, 1, 0);
        this._realTimeTimer = setTimeout(async () => {
            await this.syncAllLovesRealTimeData();
            this.scheduleNextRealTimeSync();
        }, Math.max(1000, nextMidnight.getTime() - now.getTime()));
    },

    startRealTimeJobs: function() {
        if (this._realTimeJobsStarted) return;
        this._realTimeJobsStarted = true;

        const refresh = () => {
            void this.syncAllLovesRealTimeData().finally(() => this.scheduleNextRealTimeSync());
        };
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') refresh();
        });
        window.addEventListener('focus', refresh);
        refresh();
    },

    formatMoney: function(amount) {
        const value = Number(amount) || 0;
        return '¥' + value.toLocaleString('zh-CN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    },
    
    init: function() {
        if (this.initialized) return;
        
        this.view = document.getElementById('loves-view');
        this.backBtn = document.getElementById('loves-back-btn');
        
        if (!this.view) return;
        
        this.bindAndroidInputFocusScope();
        this.bindEvents();
        this.bindLauncherButton();
        this.initialized = true;
        this.startRealTimeJobs();
        console.log('Loves app initialized');
    },

    bindAndroidInputFocusScope: function() {
        if (this._androidFocusScopeCleanup || !window.mobileInputCompat?.registerFocusScope) return;
        this._androidFocusScopeCleanup = window.mobileInputCompat.registerFocusScope({
            selector: '#loves-view, #lovers-space-view, #lovers-savings-view, #lovers-friend-phone-view, #lovers-friend-computer-view, .bottom-sheet-overlay[id^="lovers-"], .bottom-sheet-overlay[id^="friend-"]'
        });
    },
    
    bindEvents: function() {
        if (this.backBtn) {
            this.backBtn.addEventListener('click', () => {
                this.close();
            });
        }

        if (!this._sharedSavingsDelegated) {
            document.addEventListener('click', (e) => {
                const savingsBtn = e.target.closest('#lovers-shared-savings-btn');
                if (!savingsBtn) return;
                e.preventDefault();
                e.stopPropagation();
                const friendId = savingsBtn.dataset.friendId;
                if (!this.currentFriend && friendId) {
                    this.currentFriend = window.imData?.friends?.find(friend => String(friend.id) === String(friendId)) || null;
                }
                this.openSavingsJar();
            });
            this._sharedSavingsDelegated = true;
        }
    },

    bindLauncherButton: function() {
        const launcher = document.getElementById('app-loves-btn');
        if (!launcher || launcher.dataset.lovesLauncherBound === 'true') return;
        launcher.dataset.lovesLauncherBound = 'true';
        launcher.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (window.lovesApp && typeof window.lovesApp.open === 'function') {
                window.lovesApp.open();
            }
        });
    },

    bindSharedSavingsButton: function(friend = this.currentFriend) {
        const sharedSavingsBtn = document.getElementById('lovers-shared-savings-btn');
        if (!sharedSavingsBtn) return;
        if (friend && friend.id !== undefined) {
            sharedSavingsBtn.dataset.friendId = String(friend.id);
        }
        sharedSavingsBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (friend) this.currentFriend = friend;
            if (!this.currentFriend && sharedSavingsBtn.dataset.friendId) {
                this.currentFriend = window.imData?.friends?.find(item => String(item.id) === String(sharedSavingsBtn.dataset.friendId)) || null;
            }
            this.openSavingsJar();
        };
    },
    
    // 添加动态 / 日记辅助方法
    bindFabClick: function() {
        const fab = document.getElementById('lovers-space-fab');
        if (!fab) return;
        
        // 移除拖拽相关样式，确保它固定，并恢复默认的触摸行为防止点击被吞
        fab.style.transform = '';
        fab.style.touchAction = 'auto';
        
        // 使用 onclick 简单粗暴覆盖绑定，避免因为 DOM 刷新或重进导致事件丢失
        fab.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const savingsView = document.getElementById('lovers-savings-view');
            if (savingsView && savingsView.classList.contains('active')) {
                this.openSavingsDepositSheet('user');
                return;
            }
            
            // 判断当前活跃的 tab
            const activeTab = document.querySelector('.lovers-space-tab.active');
            if (activeTab) {
                const tabName = activeTab.getAttribute('data-tab');
                if (tabName === 'diary') {
                    this.openDiaryGeneratorView();
                } else if (tabName === 'moments') {
                    this.openPublishView();
                } else {
                    if (window.showToast) window.showToast('此板块暂不支持添加');
                }
            } else {
                this.openPublishView(); // 默认 fallback
            }
        };
    },

    currentDiaryDate: new Date(),

    formatDiaryDateLabel: function(dateKey) {
        const date = this.parseDateKey(dateKey);
        const todayKey = this.getLocalDateKey(new Date());
        const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const prefix = dateKey === todayKey ? '今天' : (date.getMonth() + 1) + '月' + date.getDate() + '日';
        return prefix + ' · ' + weekNames[date.getDay()];
    },

    ensureDiaryData: function(friend = this.currentFriend) {
        if (!friend) return [];
        if (!friend.lovesData || typeof friend.lovesData !== 'object') friend.lovesData = {};
        if (!Array.isArray(friend.lovesData.diaries)) friend.lovesData.diaries = [];
        friend.lovesData.diaries = friend.lovesData.diaries
            .filter(item => item && typeof item === 'object')
            .map((item, index) => ({
                id: item.id || 'ld_' + Date.now() + '_' + index,
                date: String(item.date || this.getLocalDateKey(item.createdAt || Date.now())),
                time: String(item.time || '').slice(0, 5),
                title: String(item.title || item.name || '未命名日记').trim() || '未命名日记',
                location: String(item.location || '未设置地点').trim() || '未设置地点',
                diary: String(item.diary || item.content || '').trim(),
                createdAt: Number(item.createdAt) || Number(item.timestamp) || Date.now(),
                source: 'loves_diary'
            }));
        return friend.lovesData.diaries;
    },

    renderDiary: function() {
        const datesContainer = document.getElementById('lovers-diary-dates');
        const listContainer = document.getElementById('lovers-diary-list');
        const monthPicker = document.getElementById('lovers-diary-month-picker');
        const yearDisplay = document.getElementById('lovers-diary-year-display');
        const monthDisplay = document.getElementById('lovers-diary-month-display');
        if (!datesContainer || !listContainer) return;

        const today = new Date();
        const baseDate = this.currentDiaryDate || today;
        const selectedDateStr = this.getLocalDateKey(baseDate);

        if (yearDisplay && monthDisplay) {
            yearDisplay.textContent = baseDate.getFullYear() + '年';
            monthDisplay.textContent = (baseDate.getMonth() + 1) + '月';
        }

        if (monthPicker) {
            const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
            monthPicker.value = baseDate.getFullYear() + '-' + mm;
            monthPicker.onchange = (e) => {
                const val = e.target.value;
                if (!val) return;
                const parts = val.split('-').map(Number);
                if (parts.length !== 2 || parts.some(Number.isNaN)) return;
                this.currentDiaryDate = new Date(parts[0], parts[1] - 1, 1);
                this.renderDiary();
            };
        }

        const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
        let datesHtml = '';
        for (let i = -15; i <= 15; i++) {
            const d = new Date(baseDate);
            d.setDate(baseDate.getDate() + i);
            const dateStr = this.getLocalDateKey(d);
            const isToday = dateStr === this.getLocalDateKey(today);
            const isSelected = dateStr === selectedDateStr;
            const stateClasses = [
                'diary-date-item',
                isToday ? 'is-today' : '',
                isSelected ? 'is-selected' : ''
            ].filter(Boolean).join(' ');
            datesHtml += [
                '<button type="button" class="', stateClasses, '" data-date="', dateStr, '" aria-label="',
                d.getMonth() + 1, '月', d.getDate(), '日" aria-pressed="', String(isSelected), '">',
                '<small>', isToday ? '今' : dayNames[d.getDay()], '</small>',
                '<strong>', d.getDate(), '</strong>',
                '</button>'
            ].join('');
        }
        datesContainer.innerHTML = datesHtml;

        setTimeout(() => {
            const selectedEl = datesContainer.querySelector('.diary-date-item.is-selected');
            if (selectedEl && datesContainer.parentElement) {
                const scrollLeft = selectedEl.offsetLeft - datesContainer.parentElement.offsetWidth / 2 + selectedEl.offsetWidth / 2;
                datesContainer.parentElement.scrollTo({ left: scrollLeft, behavior: 'smooth' });
            }
        }, 50);

        datesContainer.querySelectorAll('.diary-date-item').forEach(item => {
            item.onclick = () => {
                this.currentDiaryDate = this.parseDateKey(item.getAttribute('data-date'));
                this.renderDiary();
            };
        });

        const entries = this.ensureDiaryData()
            .filter(item => item.date === selectedDateStr)
            .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));

        if (entries.length === 0) {
            listContainer.innerHTML = [
                '<div class="lovers-diary-empty">',
                '<i class="far fa-pen-to-square"></i>',
                '<strong>', selectedDateStr === this.getLocalDateKey(today) ? '今天还没有日记' : '这天还没有日记', '</strong>',
                '<span>点击右下角 +，让 TA 生成行程日记</span>',
                '</div>'
            ].join('');
            return;
        }

        listContainer.innerHTML = entries.map(entry => {
            const safeId = this.escapeHTML(entry.id);
            const safeTime = this.escapeHTML(entry.time || '--:--');
            const safeTitle = this.escapeHTML(entry.title || '未命名日记');
            const safeLocation = this.escapeHTML(entry.location || '未设置地点');
            const safeDiary = this.escapeHTML(entry.diary || '');
            return [
                '<article class="lovers-diary-item" data-id="', safeId, '">',
                '<div class="lovers-diary-time">', safeTime, '</div>',
                '<div class="lovers-diary-card">',
                '<div class="lovers-diary-card-head">',
                '<strong>', safeTitle, '</strong>',
                '<button type="button" class="lovers-diary-delete">删除</button>',
                '</div>',
                '<span class="lovers-diary-location"><i class="fas fa-map-marker-alt"></i>', safeLocation, '</span>',
                '<p>', safeDiary, '</p>',
                '</div>',
                '</article>'
            ].join('');
        }).join('') + '<div class="lovers-diary-end">这一天的日记已全部显示</div>';

        listContainer.querySelectorAll('.lovers-diary-delete').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const itemEl = e.target.closest('.lovers-diary-item');
                const entryId = itemEl?.getAttribute('data-id');
                if (!entryId) return;
                if (!confirm('确定要删除这条日记吗？')) return;
                const diaries = this.ensureDiaryData();
                this.currentFriend.lovesData.diaries = diaries.filter(item => String(item.id) !== String(entryId));
                this.persistFriendState();
                this.renderDiary();
            };
        });
    },

    openDiaryGeneratorView: function() {
        if (!this.currentFriend) {
            if (window.showToast) window.showToast('请先进入情侣空间');
            return;
        }
        const generatorView = document.getElementById('lovers-diary-generator-view');
        if (!generatorView) return;

        const dateKey = this.getLocalDateKey(this.currentDiaryDate || new Date());
        const dateLabel = document.getElementById('lovers-diary-generator-date');
        const countInput = document.getElementById('lovers-diary-count');
        const cancelBtn = document.getElementById('lovers-diary-generator-cancel');
        const generateBtn = document.getElementById('lovers-diary-generate-btn');

        if (dateLabel) dateLabel.textContent = this.formatDiaryDateLabel(dateKey);
        if (countInput) countInput.value = '10';
        if (cancelBtn) cancelBtn.onclick = () => {
            if (window.closeView) window.closeView(generatorView);
        };

        if (generateBtn) {
            generateBtn.onclick = async () => {
                const count = this.getDiaryGenerationCount();
                const originalText = generateBtn.textContent;
                generateBtn.disabled = true;
                generateBtn.textContent = '生成中...';
                try {
                    const entries = await this.requestDiaryEntries(dateKey, count);
                    const diaries = this.ensureDiaryData();
                    this.currentFriend.lovesData.diaries = diaries
                        .filter(item => item.date !== dateKey)
                        .concat(entries);
                    await this.persistFriendState();
                    this.currentDiaryDate = this.parseDateKey(dateKey);
                    this.renderDiary();
                    if (window.closeView) window.closeView(generatorView);
                    if (window.showToast) window.showToast('已生成 ' + entries.length + ' 条日记');
                } catch (error) {
                    console.error('[Loves Diary] generate failed', error);
                    const message = String(error?.message || '日记生成失败').slice(0, 80);
                    if (window.showToast) window.showToast(message);
                    else alert(message);
                } finally {
                    generateBtn.disabled = false;
                    generateBtn.textContent = originalText || '生成';
                }
            };
        }

        if (window.openView) window.openView(generatorView);
        else generatorView.classList.add('active');
    },

    getDiaryGenerationCount: function() {
        const input = document.getElementById('lovers-diary-count');
        const value = Math.round(Number(input?.value) || 10);
        const count = Math.min(30, Math.max(1, value));
        if (input) input.value = String(count);
        return count;
    },

    getLovesApiConfig: function() {
        return typeof window.getApiConfig === 'function' ? (window.getApiConfig() || {}) : (window.apiConfig || {});
    },

    resolveLovesChatEndpoint: function(apiConfig) {
        const endpoint = String(apiConfig?.endpoint || '').trim();
        return endpoint ? window.u2Api.resolveChatCompletionsEndpoint(endpoint) : '';
    },

    requestDiaryEntries: async function(dateKey, count) {
        const apiConfig = this.getLovesApiConfig();
        const endpoint = this.resolveLovesChatEndpoint(apiConfig);
        if (!endpoint || !apiConfig.apiKey) throw new Error('请先在设置中配置 API');

        const friend = this.currentFriend || {};
        const charName = friend.nickname || friend.realname || friend.realName || friend.name || 'TA';
        const charPersona = friend.persona || friend.signature || friend.description || '普通角色';
        const userName = window.userState?.name || window.imData?.profile?.name || 'User';
        const userPersona = window.userState?.persona || window.imData?.profile?.persona || '未设置';
        const dateLabel = this.formatDiaryDateLabel(dateKey);
        const worldBook = typeof window.getGlobalWorldBookContextByPosition === 'function'
            ? (window.getGlobalWorldBookContextByPosition('before') || '')
            : '';

        const promptLines = [
            '你要为 Loves 情侣空间生成角色的独立行程日记，不要写入或引用 iMessage 日程。',
            '',
            '【Char】' + charName,
            '【Char 人设】',
            charPersona,
            '',
            '【User】' + userName,
            '【User 人设】',
            userPersona
        ];
        if (worldBook) {
            promptLines.push('', '【世界书】', worldBook);
        }
        promptLines.push(
            '',
            '【日期】' + dateKey + '（' + dateLabel + '）',
            '【生成数量】' + count + ' 条',
            '',
            '要求：',
            '1. 返回严格 JSON，格式只能是 {"entries":[{"time":"HH:MM","title":"标题","location":"地点","diary":"日记正文"}]}。',
            '2. entries 数量必须刚好等于 ' + count + '。',
            '3. 每条代表 Char 今天一个时间点的静态行程，可包含起床、通勤、吃饭、学习/工作、发呆、休息、睡觉等日常。',
            '4. time 必须是 24 小时 HH:MM，所有条目按一天自然顺序排列。',
            '5. title 2-16 字，location 2-20 字。',
            '6. diary 必须使用 Char 第一人称视角，贴合 Char 人设，不少于 30 个中文字符，像真实日记，不要写成旁白或列表。',
            '7. 只返回 JSON，不要 Markdown，不要解释文字。'
        );
        const prompt = promptLines.join('\n');

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiConfig.apiKey
            },
            body: JSON.stringify({
                model: apiConfig.model || 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: '你是严格 JSON 生成器，只返回合法 JSON。' },
                    { role: 'user', content: prompt }
                ],
                temperature: Number.isFinite(Number(apiConfig.temperature)) ? Number(apiConfig.temperature) : 0.7
            })
        });

        if (!response.ok) {
            let errorText = 'API 请求失败：' + response.status;
            try {
                const body = await response.text();
                const parsed = JSON.parse(body);
                errorText = parsed?.error?.message || body || errorText;
            } catch (_) {}
            throw new Error(errorText);
        }

        const data = await response.json();
        const resultText = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';
        const parsed = this.parseDiaryJson(resultText);
        return this.normalizeGeneratedDiaryEntries(parsed?.entries, dateKey, count);
    },

    parseDiaryJson: function(resultText) {
        const fence = String.fromCharCode(96).repeat(3);
        let jsonStr = String(resultText || '').replace(new RegExp(fence + 'json', 'gi'), '').replace(new RegExp(fence, 'g'), '').trim();
        const match = jsonStr.match(/\{[\s\S]*\}/);
        if (match) jsonStr = match[0];
        try {
            return JSON.parse(jsonStr);
        } catch (error) {
            throw new Error('AI 返回不是合法 JSON，请重试');
        }
    },

    normalizeGeneratedDiaryEntries: function(rawEntries, dateKey, count) {
        if (!Array.isArray(rawEntries)) throw new Error('AI 返回缺少 entries 数组');
        if (rawEntries.length !== count) throw new Error('AI 返回数量不正确：需要 ' + count + ' 条');

        const normalized = rawEntries.map((entry, index) => {
            const rawTime = String(entry?.time || '').trim();
            const timeMatch = rawTime.match(/^(\d{1,2}):(\d{2})$/);
            if (!timeMatch) throw new Error('第 ' + (index + 1) + ' 条时间格式不正确');
            const hour = Number(timeMatch[1]);
            const minute = Number(timeMatch[2]);
            if (hour < 0 || hour > 23 || minute < 0 || minute > 59) throw new Error('第 ' + (index + 1) + ' 条时间不合法');
            const time = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
            const title = String(entry?.title || '').trim();
            const location = String(entry?.location || '').trim();
            const diary = String(entry?.diary || entry?.content || '').trim();
            if (!title) throw new Error('第 ' + (index + 1) + ' 条缺少标题');
            if (!location) throw new Error('第 ' + (index + 1) + ' 条缺少地点');
            if ([...diary.replace(/\s/g, '')].length < 30) throw new Error('第 ' + (index + 1) + ' 条日记少于 30 字');
            return {
                id: 'ld_' + dateKey.replace(/-/g, '') + '_' + Date.now() + '_' + index + '_' + Math.random().toString(36).slice(2, 7),
                date: dateKey,
                time,
                title,
                location,
                diary,
                createdAt: Date.now(),
                source: 'loves_diary'
            };
        });

        return normalized.sort((a, b) => a.time.localeCompare(b.time));
    },

    openPublishView: function() {
        const publishView = document.getElementById('lovers-publish-view');
        if (!publishView) return;
        
        if (window.openView) window.openView(publishView);
        
        document.getElementById('lovers-publish-text').value = '';
        
        const imgContainer = document.getElementById('lovers-publish-images-container');
        const addBtn = document.getElementById('lovers-publish-add-img-btn');
        imgContainer.innerHTML = '';
        imgContainer.appendChild(addBtn);
        
        // 初始化当前上传的图片数组
        this.currentPublishImages = [];
        
        // 绑定事件
        const cancelBtn = document.getElementById('lovers-publish-cancel');
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                if (window.closeView) window.closeView(publishView);
            };
        }
        
        const fileInput = document.getElementById('lovers-publish-file-input');
        if (addBtn && fileInput) {
            addBtn.onclick = () => fileInput.click();
            fileInput.onchange = (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;
                
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        this.currentPublishImages.push(ev.target.result);
                        this.renderPublishImagePreview();
                    };
                    reader.readAsDataURL(file);
                }
                fileInput.value = '';
            };
        }
        
        const publishBtn = document.getElementById('lovers-publish-btn');
        if (publishBtn) {
            publishBtn.onclick = () => {
                const text = document.getElementById('lovers-publish-text').value.trim();
                if (!text && this.currentPublishImages.length === 0) {
                    if (window.showToast) window.showToast('写点什么或添加图片吧');
                    return;
                }
                
                const moment = {
                    id: 'lm_' + Date.now(),
                    text: text,
                    images: [...this.currentPublishImages],
                    timestamp: Date.now(),
                    likes: 0,
                    comments: []
                };
                
                if (!this.currentFriend.lovesData) {
                    this.currentFriend.lovesData = { moments: [] };
                }
                if (!this.currentFriend.lovesData.moments) {
                    this.currentFriend.lovesData.moments = [];
                }
                
                this.currentFriend.lovesData.moments.unshift(moment);
                
                this.persistFriendState();
                if (window.showToast) window.showToast('发布成功');
                if (window.closeView) window.closeView(publishView);
                
                this.renderLovesMoments();
            };
        }
    },
    
    renderPublishImagePreview: function() {
        const imgContainer = document.getElementById('lovers-publish-images-container');
        const addBtn = document.getElementById('lovers-publish-add-img-btn');
        if (!imgContainer || !addBtn) return;
        
        imgContainer.innerHTML = '';
        
        (this.currentPublishImages || []).forEach((src, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'lovers-publish-image';
            
            const img = document.createElement('img');
            img.src = src;
            img.alt = `动态图片 ${index + 1}`;
            
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.setAttribute('aria-label', `删除第 ${index + 1} 张图片`);
            delBtn.innerHTML = '<i class="fas fa-times"></i>';
            delBtn.onclick = () => {
                this.currentPublishImages.splice(index, 1);
                this.renderPublishImagePreview();
            };
            
            wrapper.appendChild(img);
            wrapper.appendChild(delBtn);
            imgContainer.appendChild(wrapper);
        });
        
        imgContainer.appendChild(addBtn);
    },

    renderLovesMoments: function() {
        const list = document.getElementById('lovers-moments-list');
        const empty = document.getElementById('lovers-moments-empty');
        if (!list || !empty || !this.currentFriend) return;
        
        const moments = this.currentFriend.lovesData?.moments || [];
        
        if (moments.length === 0) {
            list.style.display = 'none';
            empty.style.display = 'flex';
            return;
        }
        
        list.style.display = 'flex';
        empty.style.display = 'none';
        
        const userAvatar = window.userState?.avatarUrl || window.imData?.profile?.avatarUrl;
        const userName = window.userState?.name || window.imData?.profile?.name || '我';
        const safeUserName = this.escapeHTML(userName);
        
        let html = '';
        moments.forEach((m, idx) => {
            const date = new Date(m.timestamp);
            const timeStr = `${date.getMonth()+1}-${date.getDate()} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
            
            const displayAvatar = m.isChar ? this.currentFriend.avatarUrl : userAvatar;
            const displayName = m.isChar ? (this.currentFriend.nickname || this.currentFriend.realname || 'TA') : userName;
            const safeDisplayName = this.escapeHTML(displayName);
            const safeMomentText = this.escapeHTML(m.text);
            const safeDisplayAvatar = this.escapeHTML(displayAvatar || '');
            const safeUserAvatar = this.escapeHTML(userAvatar || '');
            const momentTranslationHtml = m.isChar
                ? this.renderLovesMomentTranslation(this.getLovesMomentTranslation(m), `loves-moment-post-translation-${idx}`)
                : '';

            let imagesHtml = '';
            if (m.images && m.images.length > 0) {
                const imageLayout = m.images.length === 1 ? 'is-one' : (m.images.length === 2 ? 'is-two' : 'is-many');
                imagesHtml = `<div class="loves-moment-images ${imageLayout}">`;
                m.images.forEach((src, imageIndex) => {
                    imagesHtml += `<img src="${this.escapeHTML(src)}" alt="动态图片 ${imageIndex + 1}">`;
                });
                imagesHtml += `</div>`;
            }
            
            let commentsHtml = '';
            if (m.comments && m.comments.length > 0) {
                commentsHtml = `<div class="loves-moment-comments">`;
                m.comments.forEach((c, cIdx) => {
                    const cAuthor = c.isChar ? (this.currentFriend.nickname || this.currentFriend.realname || 'TA') : userName;
                    const safeAuthor = this.escapeHTML(cAuthor);
                    const safeCommentText = this.escapeHTML(c.text);
                    const commentTranslationHtml = c.isChar
                        ? this.renderLovesMomentTranslation(this.getLovesMomentTranslation(c), `loves-moment-comment-translation-${idx}-${cIdx}`)
                        : '';
                    commentsHtml += `
                        <div class="loves-moment-comment ${c.isChar ? 'is-char' : ''}">
                            <div class="loves-moment-comment-copy" onclick="window.lovesApp.replyToComment(${idx}, ${cIdx})"><div><span class="loves-moment-comment-author">${safeAuthor}</span>：${safeCommentText}</div>${commentTranslationHtml}</div>
                            <button type="button" class="loves-moment-comment-delete" onclick="window.lovesApp.deleteComment(${idx}, ${cIdx})">删除</button>
                        </div>
                    `;
                });
                commentsHtml += `</div>`;
            }

            html += `
            <article class="loves-moment-card">
                <div class="loves-moment-head">
                    <div class="loves-moment-author">
                        <div class="loves-moment-avatar">
                            ${displayAvatar ? `<img src="${safeDisplayAvatar}" alt="${safeDisplayName}">` : `<i class="fas fa-user"></i>`}
                        </div>
                        <div class="loves-moment-author-copy">
                            <div class="loves-moment-name">${safeDisplayName}</div>
                            <div class="loves-moment-time">${timeStr}</div>
                        </div>
                    </div>
                    <div class="loves-moment-actions">
                        <button type="button" class="loves-moment-more" aria-label="动态选项" onclick="window.lovesApp.toggleMomentMenu(${idx})"><i class="fas fa-ellipsis-h"></i></button>
                        <div id="loves-moment-menu-${idx}" class="loves-moment-menu">
                            <button type="button" onclick="window.lovesApp.requestCharComment(${idx})"><i class="fas fa-comment-dots"></i><span>让 TA 评论</span></button>
                            <button type="button" class="is-danger" onclick="window.lovesApp.deleteMoment(${idx})"><i class="fas fa-trash-alt"></i><span>删除动态</span></button>
                        </div>
                    </div>
                </div>
                
                ${m.text ? `<div class="loves-moment-body">${safeMomentText}</div>${momentTranslationHtml}` : ''}
                ${imagesHtml}
                
                <div class="loves-moment-toolbar">
                    <button type="button" class="${m.isLiked ? 'is-liked' : ''}" onclick="window.lovesApp.toggleMomentLike(${idx})"><i class="${m.isLiked ? 'fas' : 'far'} fa-heart"></i><span>${m.likes || 0}</span></button>
                    <button type="button" onclick="window.lovesApp.addMomentComment(${idx})"><i class="far fa-comment-dots"></i><span>${m.comments ? m.comments.length : 0}</span></button>
                </div>
                
                ${commentsHtml}
                <div class="loves-moment-composer">
                    <div class="loves-moment-composer-avatar">
                        ${userAvatar ? `<img src="${safeUserAvatar}" alt="${safeUserName}">` : `<i class="fas fa-user"></i>`}
                    </div>
                    <input type="text" class="loves-moment-comment-input" data-moment-idx="${idx}" inputmode="text" enterkeyhint="send" autocomplete="off" placeholder="${m.isChar ? '评论 TA 的动态...' : '添加评论...'}">
                    <button type="button" class="loves-moment-comment-send" data-moment-idx="${idx}">发送</button>
                </div>
            </article>
            `;
        });
        
        list.innerHTML = html;
        this.bindLovesMomentTranslationControls(list);
        list.querySelectorAll('.loves-moment-comment-send').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.momentIdx, 10);
                const input = list.querySelector(`.loves-moment-comment-input[data-moment-idx="${idx}"]`);
                this.addMomentComment(idx, input ? input.value : '', {
                    restoreComposerFocus: document.activeElement === input
                });
            });
        });
        list.querySelectorAll('.loves-moment-comment-input').forEach(input => {
            input.addEventListener('keydown', (e) => {
                const isSendEnter = window.mobileInputCompat?.isSendEnter
                    ? window.mobileInputCompat.isSendEnter(e)
                    : e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing && e.keyCode !== 229;
                if (!isSendEnter) return;
                e.preventDefault();
                const idx = parseInt(input.dataset.momentIdx, 10);
                this.addMomentComment(idx, input.value, { restoreComposerFocus: true });
            });
        });
        
        // 全局点击关闭菜单
        if (!this._menuClickBound) {
            document.addEventListener('click', (e) => {
                if (!e.target.closest('[id^="loves-moment-menu-"]') && !e.target.closest('.fa-ellipsis-h')) {
                    const menus = document.querySelectorAll('[id^="loves-moment-menu-"]');
                    menus.forEach(m => m.style.display = 'none');
                }
            });
            this._menuClickBound = true;
        }
    },
    
    updateDaysCount: function(friend) {
        const daysEl = document.getElementById('lovers-space-days');
        if (!daysEl || !friend) return;
        const startState = this.ensureLovesStartTime(friend);
        daysEl.textContent = String(this.getLovesDaysCount(friend));
        if (startState.changed) void this.persistFriendState(friend, { metaOnly: true, silent: true });
    },

    toggleMomentMenu: function(idx) {
        const menus = document.querySelectorAll('[id^="loves-moment-menu-"]');
        menus.forEach((m, i) => {
            if (i !== idx) m.style.display = 'none';
        });
        const targetMenu = document.getElementById(`loves-moment-menu-${idx}`);
        if (targetMenu) {
            targetMenu.style.display = targetMenu.style.display === 'none' ? 'block' : 'none';
        }
    },
    
    deleteMoment: function(idx) {
        if (!this.currentFriend || !this.currentFriend.lovesData || !this.currentFriend.lovesData.moments) return;
        const targetMenu = document.getElementById(`loves-moment-menu-${idx}`);
        if (targetMenu) targetMenu.style.display = 'none';
        
        this.showDeleteConfirm('这条动态', () => {
            this.currentFriend.lovesData.moments.splice(idx, 1);
            this.persistFriendState();
            this.renderLovesMoments();
        });
    },

    deleteComment: function(mIdx, cIdx) {
        if (!this.currentFriend || !this.currentFriend.lovesData || !this.currentFriend.lovesData.moments) return;
        const m = this.currentFriend.lovesData.moments[mIdx];
        if (!m || !m.comments) return;
        
        this.showDeleteConfirm('这条评论', () => {
            m.comments.splice(cIdx, 1);
            this.persistFriendState();
            this.renderLovesMoments();
        });
    },

    addMomentComment: function(mIdx, presetText = '', options = {}) {
        if (!this.currentFriend || !this.currentFriend.lovesData || !this.currentFriend.lovesData.moments) return;
        const m = this.currentFriend.lovesData.moments[mIdx];
        if (!m) return;

        let commentText = String(presetText || '').trim();
        if (!commentText) {
            const prompted = prompt(m.isChar ? '评论 TA 的动态：' : '添加评论：');
            if (prompted === null) return;
            commentText = prompted.trim();
        }
        if (!commentText) return;

        if (!m.comments) m.comments = [];
        m.comments.push({
            text: commentText,
            isChar: false,
            timestamp: Date.now()
        });

        this.persistFriendState();
        this.renderLovesMoments();

        if (options.restoreComposerFocus) {
            requestAnimationFrame(() => {
                const nextInput = document.querySelector(`.loves-moment-comment-input[data-moment-idx="${mIdx}"]`);
                if (!nextInput) return;
                try {
                    nextInput.focus({ preventScroll: true });
                } catch (error) {
                    nextInput.focus();
                }
            });
        }

        if (m.isChar === true) {
            this.requestCharComment(mIdx, {
                reason: 'user_comment',
                userComment: commentText,
                silentMissingApi: true
            });
        }
    },

    replyToComment: function(mIdx, cIdx) {
        if (!this.currentFriend || !this.currentFriend.lovesData || !this.currentFriend.lovesData.moments) return;
        const m = this.currentFriend.lovesData.moments[mIdx];
        if (!m || !m.comments || !m.comments[cIdx]) return;
        
        const targetComment = m.comments[cIdx];
        const targetName = targetComment.isChar ? (this.currentFriend.nickname || this.currentFriend.realname || 'TA') : '我';
        
        const replyText = prompt(`回复 ${targetName}：`);
        if (replyText !== null && replyText.trim() !== '') {
            m.comments.push({
                text: `回复 @${targetName} : ${replyText.trim()}`,
                isChar: false,
                timestamp: Date.now()
            });
            this.persistFriendState();
            this.renderLovesMoments();

            if (targetComment.isChar === true) {
                this.requestCharComment(mIdx, {
                    reason: 'user_comment',
                    userComment: replyText.trim(),
                    targetCommentText: String(targetComment.text || '').trim(),
                    silentMissingApi: true
                });
            }
        }
    },

    requestCharComment: function(idx, options = {}) {
        const friend = this.currentFriend;
        const moment = friend?.lovesData?.moments?.[idx];
        if (!friend || !moment) return Promise.resolve(false);
        if (!moment.id) {
            moment.id = `lm_${Number(moment.timestamp) || Date.now()}_${idx}`;
            void this.persistFriendState(friend, { metaOnly: true, silent: true });
        }

        const targetMenu = document.getElementById(`loves-moment-menu-${idx}`);
        if (targetMenu) targetMenu.style.display = 'none';
        return this.queueCharCommentRequest(friend.id, moment.id, options);
    },

    queueCharCommentRequest: function(friendId, momentId, options = {}) {
        const queueKey = `${friendId}:${momentId}`;
        const previous = this._momentReplyQueues.get(queueKey) || Promise.resolve();
        const next = previous
            .catch(() => false)
            .then(() => this.executeCharCommentRequest(friendId, momentId, { ...options }))
            .finally(() => {
                if (this._momentReplyQueues.get(queueKey) === next) {
                    this._momentReplyQueues.delete(queueKey);
                }
            });
        this._momentReplyQueues.set(queueKey, next);
        return next;
    },

    executeCharCommentRequest: async function(friendId, momentId, options = {}) {
        let friend = window.imData?.friends?.find(item => String(item.id) === String(friendId));
        let moment = friend?.lovesData?.moments?.find(item => String(item.id) === String(momentId));
        if (!friend || !moment) return false;

        const apiConfig = window.getApiConfig ? window.getApiConfig() : (window.apiConfig || {});
        if (!apiConfig.endpoint || !apiConfig.apiKey) {
            if (window.showToast) window.showToast('请先在系统设置中配置 API');
            return false;
        }

        moment._charReplyPendingCount = Math.max(0, Number(moment._charReplyPendingCount) || 0) + 1;
        moment._charReplyPending = true;
        if (window.showToast) window.showToast(options.reason === 'user_comment' ? 'TA 正在回复...' : '正在生成评论...');

        try {
            if (window.imApp?.ensureFriendMessagesLoaded) {
                await window.imApp.ensureFriendMessagesLoaded(friend);
                friend = window.imData?.friends?.find(item => String(item.id) === String(friendId)) || friend;
                moment = friend?.lovesData?.moments?.find(item => String(item.id) === String(momentId));
                if (!moment) return false;
            }

            let globalRule = '';
            if (window.getGlobalWorldBookContextByPosition) {
                globalRule = window.getGlobalWorldBookContextByPosition('system_depth') || '';
                const beforeRole = window.getGlobalWorldBookContextByPosition('before_role');
                if (beforeRole) globalRule += '\n' + beforeRole;
            }

            const userPersona = (window.getUserState ? window.getUserState() : window.userState || {})?.persona || '普通用户';
            const charPersona = friend.persona || '普通角色';
            const chatContext = Array.isArray(friend.messages)
                ? friend.messages.slice(-10).map((msg) => {
                    const sender = msg?.role === 'user' || msg?.sender === 'me' ? 'User' : 'Char';
                    return `${sender}: ${msg?.text || msg?.content || '[特殊消息]'}`;
                }).join('\n')
                : '';

            const momentContent = moment.text || '[只有图片]';
            const imageCount = Array.isArray(moment.images) ? moment.images.length : 0;
            const isCharMoment = moment.isChar === true;
            const charLanguage = this.resolveLovesMomentLanguage(friend);
            const charLanguageName = this.getFriendPhoneLanguageName(charLanguage);
            const momentAuthor = isCharMoment ? '角色(Char)' : '用户(User)';
            let momentDesc = `${momentAuthor}发布了一条动态：\n文字内容：${momentContent}\n附带图片数量：${imageCount} 张`;
            if (options.targetCommentText) {
                momentDesc += `\nChar 之前在动态下评论：${options.targetCommentText}`;
                momentDesc += `\nUser 刚刚回复 Char：${options.userComment || ''}`;
            } else if (options.userComment) {
                momentDesc += `\nUser 刚刚在这条 Char 动态下评论：${options.userComment}`;
            }

            let prompt = options.reason === 'user_comment'
                ? '你现在要扮演给定的角色(Char)。User 刚刚在动态评论区直接回应了你。请生成2-5条连续、自然的公开评论回复，并且可选生成0-2条相关私聊消息。\n'
                : isCharMoment
                ? '你现在要扮演给定的角色(Char)。这条动态是 Char 自己发布的，请生成1-3条补充评论，并给 User 发送1-3条相关私聊消息。\n'
                : '你现在要扮演给定的角色(Char)，为 User 发布的动态写1-2条评论，并给 User 发送1-3条相关私聊消息。\n';
            if (globalRule) prompt += `\n【世界书设定】：\n${globalRule}\n`;
            prompt += `\n【角色 (Char) 人设】：\n${charPersona}\n`;
            prompt += `\n【用户 (User) 人设】：\n${userPersona}\n`;
            if (chatContext) prompt += `\n【近期聊天上下文(最近10条)】：\n${chatContext}\n`;
            prompt += `\n【动态与评论现场】：\n${momentDesc}\n`;
            prompt += `\n要求：
1. 内容必须符合人设、世界观和近期关系氛围。
2. Char 在 iMessage 中配置的默认语言是 ${charLanguageName}。comments 和 messages 中每一条都必须遵守以下语言规则：${this.buildLovesMomentLocalizationContract(friend, 'each item')}。
3. 只返回纯 JSON 对象，格式为 {"comments":[{"text":"公开回复","translation":"中文翻译或空字符串"}],"messages":[{"text":"私聊消息","translation":"中文翻译或空字符串"}]}，不要返回 Markdown。
4. comments ${options.reason === 'user_comment' ? '必须包含2-5条 Char 对 User 的连续直接回复' : (isCharMoment ? '包含1-3条' : '包含1-2条')}；messages ${options.reason === 'user_comment' ? '包含0-2条，可以为空数组' : '包含1-3条'}。
5. 每个数组元素只写一条自然消息，不要带 Char/User 标签，不要把多条回复合并在一个字符串里。`;

            const endpoint = window.u2Api.resolveChatCompletionsEndpoint(apiConfig.endpoint);

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiConfig.apiKey
                },
                body: JSON.stringify({
                    model: apiConfig.model || 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: '你是角色扮演对话助手，必须严格返回指定 JSON 对象。' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: parseFloat(apiConfig.temperature) || 0.7
                })
            });
            if (!response.ok) throw new Error(`API Request Failed: ${response.status}`);

            const data = await response.json();
            const resultText = data.choices?.[0]?.message?.content || '';
            let jsonStr = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
            const match = jsonStr.match(/\{[\s\S]*\}/);
            if (match) jsonStr = match[0];
            const parsed = JSON.parse(jsonStr);
            const normalizeLocalizedList = (list, limit) => {
                if (!Array.isArray(list)) return [];
                const source = list.slice(0, limit);
                return source.map(item => {
                    const localized = this.normalizeLovesMomentLocalizedContent(item, friend);
                    if (localized) return localized;

                    // Keep a usable Char reply when a provider omits only its translation field.
                    const text = String(item && typeof item === 'object' ? (item.text ?? item.content ?? '') : item ?? '').trim();
                    return text ? { text, translation: '', language: charLanguage } : null;
                }).filter(Boolean);
            };
            const comments = normalizeLocalizedList(parsed.comments, options.reason === 'user_comment' ? 5 : (isCharMoment ? 3 : 2));
            const privateMessages = normalizeLocalizedList(parsed.messages, options.reason === 'user_comment' ? 2 : 3);
            if (options.reason === 'user_comment' && comments.length < 2) {
                throw new Error('API must return 2-5 public replies');
            }
            if (options.reason !== 'user_comment' && comments.length === 0 && privateMessages.length === 0) {
                throw new Error('No comments or messages generated');
            }

            friend = window.imData?.friends?.find(item => String(item.id) === String(friendId));
            moment = friend?.lovesData?.moments?.find(item => String(item.id) === String(momentId));
            if (!friend || !moment) return false;
            if (!Array.isArray(moment.comments)) moment.comments = [];
            const baseTime = Date.now();
            comments.forEach((comment, index) => {
                moment.comments.push({
                    id: `lmc_${baseTime}_${index}`,
                    text: comment.text,
                    translation: comment.translation,
                    language: comment.language,
                    isChar: true,
                    timestamp: baseTime + index
                });
            });

            for (let index = 0; index < privateMessages.length; index += 1) {
                const message = privateMessages[index];
                const timestamp = baseTime + (index + 1) * 1000;
                const msgObj = {
                    id: window.imChat?.createMessageId ? window.imChat.createMessageId('msg') : `msg_${timestamp}_${index}`,
                    sender: friend.id,
                    role: 'assistant',
                    text: message.text,
                    content: message.text,
                    translation: message.translation,
                    language: message.language,
                    timestamp,
                    time: new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
                    type: 'text'
                };
                if (window.imApp?.appendFriendMessage) {
                    await window.imApp.appendFriendMessage(friend.id, msgObj, { silent: false });
                } else {
                    if (!Array.isArray(friend.messages)) friend.messages = [];
                    friend.messages.push(msgObj);
                }
            }

            await this.persistFriendState(friend, { metaOnly: true });
            if (this.currentFriend && String(this.currentFriend.id) === String(friendId)) {
                this.currentFriend = friend;
                this.renderLovesMoments();
            }
            if (window.showToast) window.showToast(privateMessages.length > 0 ? '评论与消息发送成功' : '回复已生成');
            return true;
        } catch (error) {
            console.error('Comment API Error:', error);
            if (window.showToast) {
                window.showToast(error instanceof SyntaxError || /2-5 public replies/.test(String(error?.message || ''))
                    ? 'AI 生成内容格式错误'
                    : 'API 请求失败，无法评论');
            }
            return false;
        } finally {
            const liveFriend = window.imData?.friends?.find(item => String(item.id) === String(friendId));
            const liveMoment = liveFriend?.lovesData?.moments?.find(item => String(item.id) === String(momentId));
            if (liveMoment) {
                liveMoment._charReplyPendingCount = Math.max(0, Number(liveMoment._charReplyPendingCount) || 1) - 1;
                liveMoment._charReplyPending = liveMoment._charReplyPendingCount > 0;
            }
        }
    },
    
    toggleMomentLike: function(idx) {
        if (!this.currentFriend || !this.currentFriend.lovesData || !this.currentFriend.lovesData.moments) return;
        const m = this.currentFriend.lovesData.moments[idx];
        m.isLiked = !m.isLiked;
        m.likes = (m.likes || 0) + (m.isLiked ? 1 : -1);
        if (m.likes < 0) m.likes = 0;
        this.persistFriendState();
        this.renderLovesMoments();
    },

    ensureSavingsData: function(friend = this.currentFriend) {
        if (!friend) return { goal: 5200, records: [], withdrawals: [] };
        if (!friend.lovesData) friend.lovesData = {};
        if (!friend.lovesData.savings || typeof friend.lovesData.savings !== 'object') {
            friend.lovesData.savings = {};
        }
        const savings = friend.lovesData.savings;
        if (!Number.isFinite(Number(savings.goal)) || Number(savings.goal) <= 0) {
            savings.goal = 5200;
        } else {
            savings.goal = Number(savings.goal);
        }
        if (!Array.isArray(savings.records)) savings.records = [];
        savings.records = savings.records.map((record, index) => ({
            id: record.id || `sav_${Date.now()}_${index}`,
            amount: Math.max(0, Number(record.amount) || 0),
            actor: record.actor === 'char' ? 'char' : 'user',
            date: record.date || this.getLocalDateKey(record.timestamp || new Date()),
            note: String(record.note || ''),
            source: record.source === 'char_daily' || String(record.id || '').startsWith('sav_char_daily_') ? 'char_daily' : '',
            timestamp: Number(record.timestamp) || Date.now()
        })).filter(record => record.amount > 0);
        if (!Array.isArray(savings.withdrawals)) savings.withdrawals = [];
        savings.withdrawals = savings.withdrawals.map((record, index) => ({
            id: record.id || `wd_${Date.now()}_${index}`,
            amount: Math.max(0, Number(record.amount) || 0),
            actor: 'user',
            date: record.date || this.getLocalDateKey(record.timestamp || new Date()),
            reason: String(record.reason || record.note || ''),
            decisionReason: String(record.decisionReason || ''),
            timestamp: Number(record.timestamp) || Date.now()
        })).filter(record => record.amount > 0);
        return savings;
    },

    getSavingsSummary: function(savings = this.ensureSavingsData()) {
        const records = Array.isArray(savings.records) ? savings.records : [];
        const summary = records.reduce((nextSummary, record) => {
            const amount = Number(record.amount) || 0;
            nextSummary.total += amount;
            if (record.actor === 'char') nextSummary.char += amount;
            else nextSummary.user += amount;
            return nextSummary;
        }, { total: 0, user: 0, char: 0, withdrawn: 0 });
        const withdrawals = Array.isArray(savings.withdrawals) ? savings.withdrawals : [];
        summary.withdrawn = withdrawals.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
        summary.total = Math.max(0, summary.total - summary.withdrawn);
        return summary;
    },

    setSavingsFabCovered: function(covered) {
        const fab = document.getElementById('lovers-space-fab');
        if (!fab) return;

        if (covered) {
            if (fab.dataset.savingsFabCovered !== '1') {
                fab.dataset.savingsPreviousDisplay = fab.style.display || '';
                fab.dataset.savingsPreviousZIndex = fab.style.zIndex || '';
            }
            fab.dataset.savingsFabCovered = '1';
            fab.style.display = 'none';
            return;
        }

        const hasActiveSavingsSheet = [
            'lovers-savings-deposit-sheet',
            'lovers-savings-settings-sheet',
            'lovers-savings-withdraw-sheet',
            'lovers-savings-withdraw-result-modal'
        ].some(id => document.getElementById(id)?.classList.contains('active'));

        if (hasActiveSavingsSheet) return;

        if (fab.dataset.savingsFabCovered === '1') {
            fab.style.display = fab.dataset.savingsPreviousDisplay || '';
            fab.style.zIndex = fab.dataset.savingsPreviousZIndex || '';
            delete fab.dataset.savingsFabCovered;
            delete fab.dataset.savingsPreviousDisplay;
            delete fab.dataset.savingsPreviousZIndex;
        }
    },

    closeSavingsSheet: function(sheet, options = {}) {
        if (!sheet) return;
        if (window.closeView) window.closeView(sheet);
        else sheet.classList.remove('active');
        if (!options.keepFabHidden) {
            setTimeout(() => this.setSavingsFabCovered(false), 0);
        }
    },

    openSavingsSheet: function(sheet, focusEl = null) {
        if (!sheet) return;
        sheet.onclick = (e) => {
            if (e.target === sheet) {
                e.stopPropagation();
                this.closeSavingsSheet(sheet);
            }
        };
        this.setSavingsFabCovered(true);
        if (window.openView) window.openView(sheet);
        else sheet.classList.add('active');
        if (focusEl) setTimeout(() => focusEl.focus(), 80);
    },

    getSavingsApiEndpoint: function() {
        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) return '';
        return window.u2Api.resolveChatCompletionsEndpoint(window.apiConfig.endpoint);
    },

    parseSavingsJsonObject: function(resultText) {
        let jsonStr = String(resultText || '').replace(/```json/gi, '').replace(/```/g, '').trim();
        const match = jsonStr.match(/\{[\s\S]*\}/);
        if (match) jsonStr = match[0];
        return JSON.parse(jsonStr);
    },

    createSavingsMessageId: function(prefix = 'msg') {
        return window.imChat && window.imChat.createMessageId
            ? window.imChat.createMessageId(prefix)
            : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    },

    appendSavingsChatMessage: async function(friend, msgObj, options = {}) {
        if (!friend || !msgObj) return false;
        let saved = false;

        if (window.imApp && window.imApp.appendFriendMessage) {
            saved = await window.imApp.appendFriendMessage(friend.id, msgObj, { silent: options.silent !== false });
        } else {
            if (!Array.isArray(friend.messages)) friend.messages = [];
            friend.messages.push(msgObj);
            saved = true;
        }

        if (!saved) return false;

        const activeFriend = window.imData?.currentActiveFriend &&
            String(window.imData.currentActiveFriend.id) === String(friend.id)
            ? window.imData.currentActiveFriend
            : friend;
        const page = document.getElementById(`chat-interface-${friend.id}`);
        const container = page ? page.querySelector('.ins-chat-messages') : null;
        const isActiveChat = container && window.imData?.currentActiveFriend &&
            String(window.imData.currentActiveFriend.id) === String(friend.id);

        if (isActiveChat && window.imChat?.appendMessageToContainer) {
            const appended = window.imChat.appendMessageToContainer(activeFriend, container, msgObj, { scroll: true });
            if (!appended && window.imChat.rerenderChatContainer) {
                window.imChat.rerenderChatContainer(activeFriend, container, { scroll: true });
            }
        }

        return true;
    },

    normalizeSavingsWithdrawResult: function(parsed, amount, reason) {
        const decision = parsed?.decision === 'reject' ? 'reject' : 'approve';
        const defaultReason = decision === 'reject'
            ? `这笔我先不同意，${reason}这个理由还不够明确。`
            : `可以，这次先从存钱罐给你提 ${amount.toFixed(2)}。`;
        const decisionReason = String(parsed?.reason || parsed?.decisionReason || parsed?.approveReason || parsed?.rejectReason || defaultReason).trim() || defaultReason;
        let messages = Array.isArray(parsed?.messages)
            ? parsed.messages.map(item => String(item || '').trim()).filter(Boolean)
            : [];
        const fallbackMessages = decision === 'reject'
            ? [
                `这笔我先不同意，${reason}这个理由我还想再问清楚一点。`,
                `你先别急着提，跟我说说到底怎么用。`
            ]
            : [
                `可以，你先拿去用。`,
                amount <= 50 ? `就提 ${amount.toFixed(2)} 够不够？` : `这笔我同意，记得别乱花。`
            ];
        fallbackMessages.forEach(text => {
            if (messages.length < 2) messages.push(text);
        });
        messages = messages.slice(0, 5);

        const rawExtra = parsed?.extraSupport && typeof parsed.extraSupport === 'object'
            ? parsed.extraSupport
            : (parsed?.payment && typeof parsed.payment === 'object' ? parsed.payment : {});
        let extraType = String(rawExtra.type || 'none').trim();
        if (extraType === 'red_packet') extraType = 'transfer';
        if (!['none', 'transfer', 'family_card', 'family_card_increase'].includes(extraType)) extraType = 'none';

        const extraAmount = Number.isFinite(Number(rawExtra.amount)) && Number(rawExtra.amount) > 0
            ? Math.round(Number(rawExtra.amount) * 100) / 100
            : 0;
        if (extraAmount <= 0) extraType = 'none';

        return {
            decision,
            reason: decisionReason,
            messages,
            extraSupport: {
                type: extraType,
                amount: extraAmount,
                description: String(rawExtra.description || 'TA 额外补贴').trim() || 'TA 额外补贴'
            }
        };
    },

    openSavingsJar: function() {
        if (!this.currentFriend) {
            if (window.showToast) window.showToast('请先进入情侣空间');
            return;
        }
        const savingsView = document.getElementById('lovers-savings-view');
        if (!savingsView) return;

        this.ensureSavingsData();
        const spaceView = document.getElementById('lovers-space-view');
        if (spaceView && savingsView.parentElement !== spaceView) {
            spaceView.appendChild(savingsView);
        }
        savingsView.classList.add('active');
        const fab = document.getElementById('lovers-space-fab');
        if (fab) {
            fab.style.removeProperty('display');
            fab.style.removeProperty('z-index');
            fab.classList.add('is-savings-mode');
        }

        const backBtn = document.getElementById('lovers-savings-back-btn');
        if (backBtn) {
            backBtn.onclick = () => {
                savingsView.classList.remove('active');
                if (fab) {
                    fab.classList.remove('is-savings-mode');
                    fab.style.removeProperty('display');
                    fab.style.removeProperty('z-index');
                }
            };
        }

        const addBtn = document.getElementById('lovers-savings-add-btn');
        if (addBtn) {
            addBtn.onclick = () => this.openSavingsSettingsSheet();
        }

        const dateFilter = document.getElementById('lovers-savings-date-filter');
        if (dateFilter) {
            dateFilter.onchange = () => this.renderSavingsJar();
        }

        this.renderSavingsJar();
    },

    renderSavingsJar: function() {
        if (!this.currentFriend) return;
        const savings = this.ensureSavingsData();
        const summary = this.getSavingsSummary(savings);
        const friendName = this.currentFriend.nickname || this.currentFriend.realname || 'TA';
        const userName = window.userState?.name || window.imData?.profile?.name || '我';
        const percent = savings.goal > 0 ? Math.min(100, Math.round((summary.total / savings.goal) * 100)) : 0;

        const totalEl = document.getElementById('lovers-savings-total');
        const goalEl = document.getElementById('lovers-savings-goal');
        const percentEl = document.getElementById('lovers-savings-percent');
        const progressEl = document.getElementById('lovers-savings-progress');
        const userAmountEl = document.getElementById('lovers-savings-user-amount');
        const charAmountEl = document.getElementById('lovers-savings-char-amount');
        const userNameEl = document.getElementById('lovers-savings-user-name');
        const charNameEl = document.getElementById('lovers-savings-char-name');
        const leftEl = document.getElementById('lovers-savings-left');
        const dateFilter = document.getElementById('lovers-savings-date-filter');
        const selectedDateLabel = document.getElementById('lovers-savings-selected-date');
        const listEl = document.getElementById('lovers-savings-records');

        if (totalEl) totalEl.textContent = this.formatMoney(summary.total);
        if (goalEl) goalEl.textContent = `目标 ${this.formatMoney(savings.goal)}`;
        if (percentEl) percentEl.textContent = `${percent}%`;
        if (progressEl) progressEl.style.width = `${percent}%`;
        if (userAmountEl) userAmountEl.textContent = this.formatMoney(summary.user);
        if (charAmountEl) charAmountEl.textContent = this.formatMoney(summary.char);
        if (userNameEl) userNameEl.textContent = userName;
        if (charNameEl) charNameEl.textContent = friendName;
        if (leftEl) leftEl.textContent = summary.total >= savings.goal ? '目标已达成' : `还差 ${this.formatMoney(savings.goal - summary.total)}`;

        if (dateFilter && !dateFilter.value) {
            dateFilter.value = this.getLocalDateKey();
        }

        const selectedDate = dateFilter?.value || this.getLocalDateKey();
        const selectedDateObj = this.parseDateKey(selectedDate);
        if (selectedDateLabel) {
            selectedDateLabel.textContent = `${selectedDateObj.getMonth() + 1}月${selectedDateObj.getDate()}日`;
        }

        const depositRecords = savings.records
            .filter(record => record.date === selectedDate)
            .map(record => ({ ...record, kind: 'deposit' }));
        const withdrawalRecords = (Array.isArray(savings.withdrawals) ? savings.withdrawals : [])
            .filter(record => record.date === selectedDate)
            .map(record => ({ ...record, kind: 'withdrawal' }));
        const dayRecords = depositRecords
            .concat(withdrawalRecords)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const dayUser = depositRecords.filter(record => record.actor !== 'char').reduce((sum, record) => sum + Number(record.amount || 0), 0);
        const dayChar = depositRecords.filter(record => record.actor === 'char').reduce((sum, record) => sum + Number(record.amount || 0), 0);

        const dayUserEl = document.getElementById('lovers-savings-day-user');
        const dayCharEl = document.getElementById('lovers-savings-day-char');
        if (dayUserEl) dayUserEl.textContent = this.formatMoney(dayUser);
        if (dayCharEl) dayCharEl.textContent = this.formatMoney(dayChar);

        if (!listEl) return;
        if (dayRecords.length === 0) {
            listEl.innerHTML = `
                <div class="lovers-savings-empty">
                    <i class="fas fa-piggy-bank"></i>
                    <div>这天还没有存入记录</div>
                </div>
            `;
            return;
        }

        listEl.innerHTML = dayRecords.map((record) => {
            const isWithdrawal = record.kind === 'withdrawal';
            const isChar = record.actor === 'char';
            const actorName = isChar ? friendName : userName;
            const time = new Date(record.timestamp || Date.now()).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            return `
                <div class="lovers-savings-record ${isWithdrawal ? 'is-withdrawal' : ''}" data-record-id="${record.id}">
                    <div class="lovers-savings-record-icon ${isChar ? 'is-char' : 'is-user'}">
                        <i class="fas ${isWithdrawal ? 'fa-arrow-up-from-bracket' : (isChar ? 'fa-heart' : 'fa-coins')}"></i>
                    </div>
                    <div class="lovers-savings-record-main">
                        <div class="lovers-savings-record-top">
                            <span>${isWithdrawal ? '提款到 Pay' : this.escapeHTML(actorName)}</span>
                            <strong>${isWithdrawal ? '-' : ''}${this.formatMoney(record.amount)}</strong>
                        </div>
                        <div class="lovers-savings-record-meta">
                            <span>${time}</span>
                            ${isWithdrawal
                                ? `<span>${this.escapeHTML(record.reason || '存钱罐提款')}</span>`
                                : (record.note ? `<span>${this.escapeHTML(record.note)}</span>` : '')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    openSavingsDepositSheet: function(defaultActor = 'user') {
        if (!this.currentFriend) return;
        const sheet = document.getElementById('lovers-savings-deposit-sheet');
        if (!sheet) return;
        const savingsView = document.getElementById('lovers-savings-view');
        if (savingsView && sheet.parentElement !== savingsView) {
            savingsView.appendChild(sheet);
        }

        const amountInput = document.getElementById('lovers-savings-amount-input');
        const dateInput = document.getElementById('lovers-savings-date-input');
        const noteInput = document.getElementById('lovers-savings-note-input');
        const actorInput = document.getElementById('lovers-savings-actor-input');
        const friendName = this.currentFriend.nickname || this.currentFriend.realname || 'TA';

        if (amountInput) amountInput.value = '';
        if (dateInput) dateInput.value = this.getLocalDateKey();
        if (noteInput) noteInput.value = '';
        if (actorInput) {
            actorInput.innerHTML = `
                <option value="user">我</option>
                <option value="char">${this.escapeHTML(friendName)}</option>
            `;
            actorInput.value = defaultActor === 'char' ? 'char' : 'user';
        }

        const cancelBtn = document.getElementById('lovers-savings-deposit-cancel');
        if (cancelBtn) cancelBtn.onclick = () => this.closeSavingsSheet(sheet);

        const saveBtn = document.getElementById('lovers-savings-deposit-save');
        if (saveBtn) {
            saveBtn.onclick = () => this.addSavingsRecord();
        }

        this.openSavingsSheet(sheet, amountInput);
    },

    openSavingsSettingsSheet: function() {
        if (!this.currentFriend) return;
        const sheet = document.getElementById('lovers-savings-settings-sheet');
        if (!sheet) return;
        const savingsView = document.getElementById('lovers-savings-view');
        if (savingsView && sheet.parentElement !== savingsView) {
            savingsView.appendChild(sheet);
        }

        const savings = this.ensureSavingsData();
        const goalInput = document.getElementById('lovers-savings-goal-input');
        if (goalInput) goalInput.value = String(savings.goal || 5200);

        const cancelBtn = document.getElementById('lovers-savings-settings-cancel');
        if (cancelBtn) cancelBtn.onclick = () => this.closeSavingsSheet(sheet);

        const saveBtn = document.getElementById('lovers-savings-settings-save');
        if (saveBtn) saveBtn.onclick = () => this.saveSavingsSettings();

        const withdrawBtn = document.getElementById('lovers-savings-withdraw-btn');
        if (withdrawBtn) {
            withdrawBtn.onclick = () => {
                this.closeSavingsSheet(sheet, { keepFabHidden: true });
                this.openSavingsWithdrawSheet();
            };
        }

        this.openSavingsSheet(sheet, goalInput);
    },

    saveSavingsSettings: function() {
        if (!this.currentFriend) return;
        const sheet = document.getElementById('lovers-savings-settings-sheet');
        const goalInput = document.getElementById('lovers-savings-goal-input');
        const nextGoal = Number(goalInput?.value);

        if (!Number.isFinite(nextGoal) || nextGoal <= 0) {
            if (window.showToast) window.showToast('请输入有效目标金额');
            return;
        }

        const savings = this.ensureSavingsData();
        savings.goal = Math.round(nextGoal * 100) / 100;
        this.persistFriendState();
        this.renderSavingsJar();
        this.closeSavingsSheet(sheet);
        if (window.showToast) window.showToast('目标已更新');
    },

    openSavingsWithdrawSheet: function() {
        if (!this.currentFriend) return;
        const sheet = document.getElementById('lovers-savings-withdraw-sheet');
        if (!sheet) return;
        const savingsView = document.getElementById('lovers-savings-view');
        if (savingsView && sheet.parentElement !== savingsView) {
            savingsView.appendChild(sheet);
        }

        const amountInput = document.getElementById('lovers-savings-withdraw-amount-input');
        const reasonInput = document.getElementById('lovers-savings-withdraw-reason-input');
        if (amountInput) amountInput.value = '';
        if (reasonInput) reasonInput.value = '';

        const cancelBtn = document.getElementById('lovers-savings-withdraw-cancel');
        if (cancelBtn) cancelBtn.onclick = () => this.closeSavingsSheet(sheet);

        const sendBtn = document.getElementById('lovers-savings-withdraw-send');
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.textContent = '发送请求';
            sendBtn.onclick = () => this.sendSavingsWithdrawRequest();
        }

        this.openSavingsSheet(sheet, amountInput);
    },

    sendSavingsWithdrawRequest: async function() {
        if (!this.currentFriend) return;

        const sheet = document.getElementById('lovers-savings-withdraw-sheet');
        const amountInput = document.getElementById('lovers-savings-withdraw-amount-input');
        const reasonInput = document.getElementById('lovers-savings-withdraw-reason-input');
        const sendBtn = document.getElementById('lovers-savings-withdraw-send');
        const amount = Number(amountInput?.value);
        const reason = String(reasonInput?.value || '').trim();

        if (!Number.isFinite(amount) || amount <= 0) {
            if (window.showToast) window.showToast('请输入有效提款金额');
            return;
        }

        if (!reason) {
            if (window.showToast) window.showToast('请输入提款理由');
            return;
        }

        const endpoint = this.getSavingsApiEndpoint();
        if (!endpoint || !window.apiConfig?.apiKey) {
            if (window.showToast) window.showToast('请先在系统设置中配置 API');
            return;
        }

        const friend = this.currentFriend;
        if (window.imApp?.ensureFriendMessagesLoaded) {
            await window.imApp.ensureFriendMessagesLoaded(friend);
        }

        const savings = this.ensureSavingsData(friend);
        const summary = this.getSavingsSummary(savings);
        const friendName = friend.nickname || friend.realname || friend.realName || friend.name || 'TA';
        const userPersona = window.userState?.persona || '普通用户';
        const charPersona = friend.persona || '普通角色';
        const recentMessages = Array.isArray(friend.messages) ? friend.messages.slice(-10) : [];
        const chatContext = recentMessages.map(msg => {
            const sender = msg.role === 'user' || msg.sender === 'me' ? 'User' : 'Char';
            let content = msg.text || msg.content || '';
            if (msg.type === 'pay_transfer') {
                content = `[支付卡片] ${msg.description || msg.cardTitle || ''} ${msg.amount ? `¥${Number(msg.amount).toFixed(2)}` : ''}`.trim();
            }
            content = String(content || '[特殊消息]').replace(/<[^>]+>/g, '').slice(0, 180);
            return `${sender}: ${content}`;
        }).join('\n');

        let globalRule = '';
        if (window.getGlobalWorldBookContextByPosition) {
            globalRule = window.getGlobalWorldBookContextByPosition('system_depth') || '';
            const beforeRole = window.getGlobalWorldBookContextByPosition('before_role');
            if (beforeRole) globalRule += '\n' + beforeRole;
        }

        const prompt = `你现在扮演 Char，需要处理情侣共享存钱罐的一次提款请求。

【提款请求】
User 想从存钱罐提款：¥${amount.toFixed(2)}
提款理由：${reason}

【存钱罐状态】
存钱目标：${this.formatMoney(savings.goal)}
当前总额：${this.formatMoney(summary.total)}
User 已存：${this.formatMoney(summary.user)}
Char 已存：${this.formatMoney(summary.char)}

${globalRule ? `【世界书设定】\n${globalRule}\n\n` : ''}【角色(Char)人设】
${charPersona}

【用户(User)人设】
${userPersona}

${chatContext ? `【近期 iMessage 上下文】\n${chatContext}\n\n` : ''}要求：
1. 你必须以 Char 的身份决定同意或拒绝这次提款，decision 只能是 "approve" 或 "reject"。
2. 返回 reason，作为 Char 给出的同意理由或拒绝理由，语气要符合人设和上下文。
3. 提款本金来自存钱罐，不是 Char 的钱；如果同意，系统会把这笔钱直接转入 User 的 Pay，并从存钱罐余额扣除。
4. 生成 messages 数组，包含 2-5 条 Char 会发给 User 的 iMessage 单聊文本，要围绕提款理由自然展开。
5. extraSupport 是 Char 额外拿自己的钱或亲属卡补贴 User，完全看 Char 本人意愿，不是强制项；不想额外补贴时必须写 {"type":"none"}。如果补贴，type 可为 "transfer"、"family_card"、"family_card_increase"。
6. 如果拒绝，extraSupport.type 必须是 "none"。
7. 如果提款金额超过当前总额，必须拒绝。
8. 只返回纯 JSON，不要 Markdown，不要多余解释。格式如下：
{"decision":"approve","reason":"可以，你先拿去买吃的。","messages":["吃什么？","就提这么点够不够？"],"extraSupport":{"type":"none"}}`;

        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.textContent = '发送中';
        }
        if (window.showToast) window.showToast('正在发送提款请求...');

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + window.apiConfig.apiKey
                },
                body: JSON.stringify({
                    model: window.apiConfig.model || 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: '你是角色扮演对话助手，必须严格返回合法 JSON 对象。' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.75
                })
            });

            if (!response.ok) throw new Error('API Request Failed');
            const data = await response.json();
            const resultText = data.choices?.[0]?.message?.content || '';
            const parsed = this.parseSavingsJsonObject(resultText);
            const result = this.normalizeSavingsWithdrawResult(parsed, Math.round(amount * 100) / 100, reason);

            if (result.decision === 'approve' && amount > summary.total) {
                result.decision = 'reject';
                result.reason = `存钱罐当前只有 ${this.formatMoney(summary.total)}，不够提款 ${this.formatMoney(amount)}。`;
                result.extraSupport = { type: 'none', amount: 0, description: '' };
            }

            const baseTime = Date.now();
            if (result.decision === 'approve') {
                if (typeof window.addPayTransaction !== 'function') {
                    throw new Error('Pay API unavailable');
                }

                const incomeSuccess = window.addPayTransaction(amount, `存钱罐提款 · ${friendName}`, 'income');
                if (!incomeSuccess) throw new Error('Pay income failed');

                const now = new Date();
                const date = this.getLocalDateKey(now);
                savings.withdrawals.unshift({
                    id: 'wd_' + Date.now(),
                    amount: Math.round(amount * 100) / 100,
                    actor: 'user',
                    date,
                    reason,
                    decisionReason: result.reason,
                    timestamp: now.getTime()
                });
                const dateFilter = document.getElementById('lovers-savings-date-filter');
                if (dateFilter) dateFilter.value = date;
            }

            for (let idx = 0; idx < result.messages.length; idx++) {
                const msgTime = baseTime + (idx + 1) * 1000;
                const msgText = result.messages[idx];
                const msgObj = {
                    id: this.createSavingsMessageId('msg'),
                    sender: friend.id,
                    role: 'assistant',
                    type: 'text',
                    text: msgText,
                    content: msgText,
                    timestamp: msgTime,
                    time: new Date(msgTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
                };
                await this.appendSavingsChatMessage(friend, msgObj, { silent: false });
            }

            if (result.decision === 'approve' && result.extraSupport.type !== 'none') {
                const paymentMsg = this.createSavingsPaymentMessage(friend, result.extraSupport, baseTime + (result.messages.length + 1) * 1000);
                if (paymentMsg) {
                    await this.appendSavingsChatMessage(friend, paymentMsg, { silent: false });
                }
            }

            await this.persistFriendState(friend);
            this.renderSavingsJar();
            this.closeSavingsSheet(sheet, { keepFabHidden: true });
            this.openSavingsWithdrawResultModal({
                decision: result.decision,
                reason: result.reason,
                amount: Math.round(amount * 100) / 100
            });
        } catch (err) {
            console.error('Savings withdraw request failed:', err);
            if (window.showToast) window.showToast('提款请求发送失败，请重试');
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.textContent = '发送请求';
            }
        }
    },

    openSavingsWithdrawResultModal: function(result) {
        const modal = document.getElementById('lovers-savings-withdraw-result-modal');
        if (!modal) return;
        const savingsView = document.getElementById('lovers-savings-view');
        if (savingsView && modal.parentElement !== savingsView) {
            savingsView.appendChild(modal);
        }

        const approved = result?.decision === 'approve';
        const titleEl = document.getElementById('lovers-savings-withdraw-result-title');
        const amountEl = document.getElementById('lovers-savings-withdraw-result-amount');
        const labelEl = document.getElementById('lovers-savings-withdraw-result-reason-label');
        const reasonEl = document.getElementById('lovers-savings-withdraw-result-reason-text');
        const iconEl = document.getElementById('lovers-savings-withdraw-result-icon');
        const closeBtn = document.getElementById('lovers-savings-withdraw-result-close');
        const okBtn = document.getElementById('lovers-savings-withdraw-result-ok');

        modal.classList.toggle('is-approved', approved);
        modal.classList.toggle('is-rejected', !approved);
        if (titleEl) titleEl.textContent = approved ? 'TA 已同意' : 'TA 已拒绝';
        if (amountEl) amountEl.textContent = this.formatMoney(result?.amount || 0);
        if (labelEl) labelEl.textContent = approved ? '同意理由' : '拒绝理由';
        if (reasonEl) reasonEl.textContent = result?.reason || (approved ? 'TA 同意了这次提款。' : 'TA 拒绝了这次提款。');
        if (iconEl) {
            iconEl.innerHTML = `<i class="fas ${approved ? 'fa-check' : 'fa-xmark'}"></i>`;
        }

        const closeModal = () => this.closeSavingsSheet(modal);
        if (closeBtn) closeBtn.onclick = closeModal;
        if (okBtn) okBtn.onclick = closeModal;
        this.openSavingsSheet(modal);
    },

    createSavingsPaymentMessage: function(friend, payment, timestamp = Date.now()) {
        if (!friend || !payment || payment.type === 'none') return null;

        const amount = Number(payment.amount) || 0;
        if (!Number.isFinite(amount) || amount <= 0) return null;

        const friendName = friend.nickname || friend.realname || friend.realName || friend.name || 'Char';
        const userName = window.userState?.name || window.userState?.realName || window.userState?.nickname || window.imData?.profile?.name || 'User';
        const description = String(payment.description || '存钱罐提款').trim() || '存钱罐提款';

        if (payment.type === 'family_card' || payment.type === 'family_card_increase') {
            let titleStr = payment.type === 'family_card_increase' ? '提升亲属卡额度' : '赠送亲属卡';
            if (typeof window.addOrUpdateFamilyCard === 'function') {
                const result = window.addOrUpdateFamilyCard(friend.id, friendName, amount);
                titleStr = result?.action === 'increase' ? '提升亲属卡额度' : '赠送亲属卡';
            }
            return {
                id: this.createSavingsMessageId('pay'),
                sender: friend.id,
                role: 'assistant',
                type: 'pay_transfer',
                payKind: 'system_notification',
                payDirection: 'char_to_user',
                amount,
                description: `${titleStr} ¥${amount.toFixed(2)}`,
                payerName: friendName,
                payeeName: userName,
                senderName: friendName,
                receiverName: userName,
                targetName: userName,
                cardTitle: titleStr,
                payStatus: 'completed',
                content: `[亲属卡] ${titleStr} ¥${amount.toFixed(2)}`,
                timestamp
            };
        }

        return {
            id: this.createSavingsMessageId('pay'),
            sender: friend.id,
            role: 'assistant',
            type: 'pay_transfer',
            payKind: 'char_to_user_pending',
            payDirection: 'char_to_user',
            amount,
            description,
            payerName: friendName,
            payeeName: userName,
            senderName: friendName,
            receiverName: userName,
            targetName: userName,
            cardTitle: '转账',
            payStatus: 'pending',
            content: `[转账] ${description} ¥${amount.toFixed(2)}`,
            timestamp
        };
    },

    addSavingsRecord: function() {
        if (!this.currentFriend) return;
        const amountInput = document.getElementById('lovers-savings-amount-input');
        const dateInput = document.getElementById('lovers-savings-date-input');
        const noteInput = document.getElementById('lovers-savings-note-input');
        const actorInput = document.getElementById('lovers-savings-actor-input');
        const sheet = document.getElementById('lovers-savings-deposit-sheet');

        const amount = Number(amountInput?.value);
        if (!Number.isFinite(amount) || amount <= 0) {
            if (window.showToast) window.showToast('请输入有效金额');
            return;
        }

        const savings = this.ensureSavingsData();
        const date = dateInput?.value || this.getLocalDateKey();
        const now = new Date();
        const recordDate = this.parseDateKey(date);
        recordDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

        savings.records.unshift({
            id: 'sav_' + Date.now(),
            amount: Math.round(amount * 100) / 100,
            actor: actorInput?.value === 'char' ? 'char' : 'user',
            date: date,
            note: (noteInput?.value || '').trim(),
            timestamp: recordDate.getTime()
        });

        const dateFilter = document.getElementById('lovers-savings-date-filter');
        if (dateFilter) dateFilter.value = date;

        this.persistFriendState();
        this.renderSavingsJar();
        this.closeSavingsSheet(sheet);
        if (window.showToast) window.showToast('已存入存钱罐');
    },

    open: function() {
        if (!this.initialized) {
            this.init();
        }
        
        if (!this.view) this.view = document.getElementById('loves-view');
        if (this.view) {
            const appContainer = document.getElementById('app');
            if (appContainer) {
                appContainer.scrollTop = 0;
                appContainer.scrollLeft = 0;
            }
            this.scanForAcceptance();
            if (typeof window.openView === 'function') {
                window.openView(this.view);
            } else {
                this.view.classList.add('active');
                this.view.style.display = 'flex';
            }
            this.renderTopFriends();
        } else {
            console.warn('[Loves] loves-view not found');
        }
    },
    
    scanForAcceptance: function() {
        const friends = window.imData?.friends || [];
        let updated = false;

        friends.forEach(friend => {
            if (friend.pendingLovesInvite && !friend.hasLovesSpace) {
                const msgs = Array.isArray(friend.messages) ? friend.messages : [];
                for (let i = msgs.length - 1; i >= 0; i--) {
                    const msg = msgs[i];
                    if (msg.sender !== 'me' && msg.text && msg.text.includes('[ACCEPT_INVITE]')) {
                        // Found acceptance
                        friend.hasLovesSpace = true;
                        friend.pendingLovesInvite = false;
                        if (!Number(friend.lovesSpaceStartTime)) {
                            friend.lovesSpaceStartTime = Number(msg.timestamp) || Date.now();
                        }
                        
                        // Replace the tag in the original message
                        msg.text = msg.text.replace(/\[ACCEPT_INVITE\]/g, '').trim();
                        if (msg.content) {
                            msg.content = msg.content.replace(/\[ACCEPT_INVITE\]/g, '').trim();
                        }
                        
                        // Append the visual card
                        const acceptMsg = {
                            id: window.imChat && window.imChat.createMessageId ? window.imChat.createMessageId('msg') : 'msg_' + Date.now(),
                            sender: msg.sender,
                            role: 'assistant',
                            content: `<div class="loves-invite-bubble" style="background:#fff; border-radius:16px; padding:12px; border:1px solid #e5e5ea;  color:#111; max-width:220px; margin:2px;">
                                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                                    <div style="width:28px; height:28px; border-radius:8px; background:#ff2d55; color:#fff; display:flex; justify-content:center; align-items:center; font-size:14px;"><i class="fas fa-heart"></i></div>
                                    <div style="font-size:14px; font-weight:700;">邀请已接受</div>
                                </div>
                                <div style="font-size:13px; color:#333; line-height:1.4;">TA 已接受了你的情侣空间邀请。</div>
                            </div>`,
                            text: '【邀请已接受】TA 已接受了你的情侣空间邀请。',
                            timestamp: Date.now(),
                            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
                            type: 'html'
                        };
                        
                        msgs.push(acceptMsg);
                        void this.syncDailySavingsForFriend(friend, new Date(), { persist: false });
                        updated = true;
                        break; // Stop scanning for this friend
                    }
                }
            }
        });

        if (updated) {
            friends.forEach(friend => {
                if (friend.hasLovesSpace) this.persistFriendState(friend, { metaOnly: true });
            });
        }
    },

    handleInviteAccepted: async function(friend) {
        if (!friend) return;

        const acceptedAt = Date.now();
        friend.hasLovesSpace = true;
        friend.pendingLovesInvite = false;
        if (!Number(friend.lovesSpaceStartTime)) friend.lovesSpaceStartTime = acceptedAt;
        
        const acceptMsg = {
            id: window.imChat && window.imChat.createMessageId ? window.imChat.createMessageId('msg') : 'msg_' + Date.now(),
            sender: friend.id,
            role: 'assistant',
            content: `<div class="loves-invite-bubble" style="background:#fff; border-radius:16px; padding:12px; border:1px solid #e5e5ea;  color:#111; max-width:220px; margin:2px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <div style="width:28px; height:28px; border-radius:8px; background:#ff2d55; color:#fff; display:flex; justify-content:center; align-items:center; font-size:14px;"><i class="fas fa-heart"></i></div>
                    <div style="font-size:14px; font-weight:700;">邀请已接受</div>
                </div>
                <div style="font-size:13px; color:#333; line-height:1.4;">我已经接受了你的情侣空间邀请，现在我们可以一起使用了。</div>
            </div>`,
            text: '【情侣空间】我接受了你的邀请',
            timestamp: acceptedAt - 100, // 稍微提早一点以便排在前面
            type: 'html'
        };
        
        if (window.imApp && window.imApp.appendFriendMessage) {
            await window.imApp.appendFriendMessage(friend.id, acceptMsg, { silent: true });
        } else if (friend.messages && Array.isArray(friend.messages)) {
            friend.messages.push(acceptMsg);
        }
        
        await this.syncDailySavingsForFriend(friend, new Date(acceptedAt), { persist: false });
        await this.persistFriendState(friend, { metaOnly: true });
        
        // 尝试立即渲染到聊天面板中
        const pageId = `chat-interface-${friend.id}`;
        const page = document.getElementById(pageId);
        if (page) {
            const container = page.querySelector('.ins-chat-messages');
            if (container && window.imChat && window.imChat.appendMessageToContainer) {
                // 将接受卡片动态添加到 DOM，不刷新整个列表，避免抖动
                window.imChat.appendMessageToContainer(friend, container, acceptMsg);
            }
        }

        // 如果当前打开的是这名好友的 Loves 详情页，立即更新按钮状态
        const detailName = document.getElementById('loves-detail-name');
        const detailArea = document.getElementById('loves-detail-area');
        if (detailArea && detailArea.style.display === 'flex' && detailName) {
            const expectedName = friend.nickname || friend.realname || 'Unknown';
            if (detailName.textContent === expectedName) {
                this.showFriendDetail(friend);
            }
        }
    },

    getTopFriends: function() {
        const allFriends = Array.isArray(window.imData?.friends) ? window.imData.friends : [];
        return allFriends.filter(f => f && f.type !== 'group' && f.type !== 'npc');
    },

    getTopFriendsRenderSnapshot: function(friends = this.getTopFriends()) {
        return friends.map(friend => [
            friend.id,
            friend.nickname,
            friend.realname,
            friend.avatarUrl,
            friend.signature,
            friend.hasLovesSpace ? 1 : 0,
            friend.pendingLovesInvite ? 1 : 0
        ].join('\u0001')).join('\u0002');
    },
    
    renderTopFriends: function() {
        const container = document.getElementById('loves-board');
        if (!container) return;
        
        
        // 获取有效的好友列表 (排除群组, 官方号, NPC)
        const validFriends = this.getTopFriends();
        const snapshot = this.getTopFriendsRenderSnapshot(validFriends);
        if (this._topFriendsRenderSnapshot === snapshot && container.childElementCount > 0) return;
        this._topFriendsRenderSnapshot = snapshot;
        container.innerHTML = '';
        
        if (validFriends.length === 0) {
            container.innerHTML = `
                <div class="loves-placeholder">
                    <i class="fas fa-heart-crack"></i>
                    <p>还没有可邀请的好友</p>
                </div>
            `;
            return;
        }

        validFriends.forEach((friend, idx) => {
            const note = document.createElement(friend.hasLovesSpace ? 'button' : 'div');
            note.className = 'loves-note';
            if (friend.hasLovesSpace) {
                note.type = 'button';
                note.setAttribute('aria-label', `进入 ${friend.nickname || friend.realname || '好友'} 的恋人空间`);
            }
            
            // 头像区
            const avatarWrapper = document.createElement('div');
            avatarWrapper.className = 'loves-note-avatar';
            if (friend.avatarUrl) {
                const img = document.createElement('img');
                img.src = friend.avatarUrl;
                img.alt = friend.nickname || friend.realname || '好友头像';
                avatarWrapper.appendChild(img);
            } else {
                const icon = document.createElement('i');
                icon.className = 'fas fa-user';
                avatarWrapper.appendChild(icon);
            }
            
            // 中间信息区
            const infoArea = document.createElement('div');
            infoArea.className = 'loves-note-info';
            
            const nameEl = document.createElement('div');
            nameEl.className = 'loves-note-name';
            nameEl.textContent = friend.nickname || friend.realname || 'Unknown';
            
            const signEl = document.createElement('div');
            signEl.className = 'loves-note-sign';
            signEl.textContent = friend.signature || '新朋友加入，快去打个招呼吧';
            
            infoArea.appendChild(nameEl);
            infoArea.appendChild(signEl);
            
            // 右侧按钮区
            const actionBtn = document.createElement(friend.hasLovesSpace ? 'span' : 'button');
            actionBtn.className = 'loves-note-action';
            
            if (friend.hasLovesSpace) {
                actionBtn.textContent = '进入空间';
                actionBtn.classList.add('loves-note-action-enter');
                note.onclick = (e) => {
                    e.stopPropagation();
                    this.enterLovesSpace(friend);
                };
            } else {
                actionBtn.type = 'button';
                actionBtn.textContent = '邀请';
                actionBtn.setAttribute('aria-label', `邀请 ${friend.nickname || friend.realname || '好友'} 建立恋人空间`);
                actionBtn.classList.add('loves-note-action-invite');
                actionBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.sendInviteCard(friend);
                    // 假设发送后重新渲染界面
                    setTimeout(() => this.renderTopFriends(), 500);
                };
            }
            
            note.appendChild(avatarWrapper);
            note.appendChild(infoArea);
            note.appendChild(actionBtn);
            
            container.appendChild(note);
        });
    },
    
    // showFriendDetail 已废弃，因为按钮直接放在头像下方了
    showFriendDetail: function(friend) {
        // do nothing
    },
    
    sendInviteCard: async function(friend) {
        const inviteMsg = {
            id: window.imChat && window.imChat.createMessageId ? window.imChat.createMessageId('msg') : 'msg_' + Date.now(),
            sender: 'me',
            role: 'user',
            content: `<div class="loves-invite-bubble" style="background:#fff; border-radius:16px; padding:12px; border:1px solid #e5e5ea;  color:#111; max-width:220px; margin:2px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <div style="width:28px; height:28px; border-radius:8px; background:#000; color:#fff; display:flex; justify-content:center; align-items:center; font-size:14px;"><i class="fas fa-heart"></i></div>
                    <div style="font-size:14px; font-weight:700;">Loves 邀请</div>
                </div>
                <div style="font-size:13px; color:#333; line-height:1.4; margin-bottom:8px;">我向你发送了情侣空间的邀请，快来接受吧！</div>
                <div style="font-size:11px; color:#8e8e93;">点击接受进入专属空间</div>
            </div>`,
            text: '【情侣空间邀请】我向你发送了情侣空间的邀请，快来接受吧！',
            timestamp: Date.now(),
            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
            type: 'html'
        };
        
        // 尝试通过 imApp 接口追加消息，如果不存在则直接 push
        let saved = true;
        if (window.imApp && window.imApp.appendFriendMessage) {
            saved = await window.imApp.appendFriendMessage(friend.id, inviteMsg, { silent: false });
        } else if (friend.messages && Array.isArray(friend.messages)) {
             friend.messages.push(inviteMsg);
        } else {
             friend.messages = [inviteMsg];
        }
        if (!saved) return;
        
        friend.pendingLovesInvite = true;
        // 注意：这里移除了强制设置 friend.hasLovesSpace = true，改由AI回复后更新

        await this.persistFriendState(friend, { metaOnly: true });
        
        if (window.showToast) {
            window.showToast('已向 ' + (friend.nickname || friend.realname) + ' 发送邀请！');
        }
        
        // 动态更新列表中的按钮状态（仅模拟，实际上需要对方接受）
        this.renderTopFriends();
    },

    getWeiboRandomAvatar: function(friend) {
        const seed = encodeURIComponent(String(friend?.id || friend?.nickname || Date.now()));
        return `https://picsum.photos/seed/weibo_alt_${seed}/160/160`;
    },

    getWeiboRandomImage: function(friend, index = 0, account = 'main') {
        const seed = encodeURIComponent(`${friend?.id || friend?.nickname || 'friend'}_${account}_${index}`);
        return `https://picsum.photos/seed/weibo_photo_${seed}/600/600`;
    },

    getWeiboRandomCover: function(friend, account = 'main') {
        const seed = encodeURIComponent(`${friend?.id || friend?.nickname || 'friend'}_${account}`);
        return `https://picsum.photos/seed/weibo_cover_${seed}/800/300`;
    },

    normalizeWeiboPost: function(post, index = 0, liked = false) {
        const safePost = post && typeof post === 'object' ? post : {};
        const rawComments = Array.isArray(safePost.comments) ? safePost.comments : [];
        const comments = rawComments.map((comment, cIdx) => {
            if (typeof comment === 'string') {
                return { author: `评论用户${cIdx + 1}`, text: comment };
            }
            return {
                ...comment,
                author: comment?.author || comment?.name || `评论用户${cIdx + 1}`,
                text: comment?.text || comment?.content || '说得很对。'
            };
        });
        return {
            ...safePost,
            id: safePost.id || `post_${Date.now()}_${index}`,
            author: safePost.author || safePost.name || '',
            text: safePost.text || safePost.content || safePost.title || '',
            time: safePost.time || safePost.createdAt || '',
            source: safePost.source || '来自 iPhone',
            comments: comments.slice(0, 5),
            reposts: safePost.reposts ?? safePost.repostCount ?? Math.max(1, index + 2),
            likes: safePost.likes ?? safePost.likeCount ?? (liked ? 128 + index * 31 : 76 + index * 27),
            likedByMe: liked || safePost.likedByMe === true
        };
    },

    normalizeWeiboAlbumItem: function(item, index = 0, friend = null, account = 'main') {
        const safeItem = item && typeof item === 'object' ? item : {};
        return {
            ...safeItem,
            id: safeItem.id || `album_${account}_${index}`,
            url: safeItem.url || safeItem.image || safeItem.imageUrl || this.getWeiboRandomImage(friend, index, account),
            description: safeItem.description || safeItem.desc || safeItem.content || ''
        };
    },

    getDefaultWeiboData: function(friend) {
        return {
            mainAccount: {
                signature: '',
                posts: [],
                album: [],
                liked: []
            }
        };
    },

    clampFriendGenCount: function(value, fallback, min, max) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.min(max, Math.max(min, parsed));
    },

    getFriendPhoneGenCounts: function(friend) {
        const saved = friend?.phoneGenCounts && typeof friend.phoneGenCounts === 'object'
            ? friend.phoneGenCounts
            : {};
        return {
            imessageMain: this.clampFriendGenCount(saved.imessageMain, 5, 1, 10),
            imessageAlt: this.clampFriendGenCount(saved.imessageAlt, 5, 2, 10),
            musicTop: this.clampFriendGenCount(saved.musicTop, 3, 1, 10),
            safariTotal: this.clampFriendGenCount(saved.safariTotal, 10, 2, 30),
            gameTotal: this.clampFriendGenCount(saved.gameTotal, 2, 1, 5),
            callTotal: this.clampFriendGenCount(saved.callTotal, 5, 1, 20),
            weiboPostsTotal: this.clampFriendGenCount(saved.weiboPostsTotal, 10, 2, 20),
            weiboPhotosTotal: this.clampFriendGenCount(saved.weiboPhotosTotal, 6, 2, 12)
        };
    },

    splitFriendGenTotal: function(total) {
        return {
            primary: Math.ceil(total / 2),
            secondary: Math.floor(total / 2)
        };
    },

    getFriendComputerGenCounts: function(friend) {
        const saved = friend?.computerGenCounts && typeof friend.computerGenCounts === 'object' ? friend.computerGenCounts : {};
        return {
            mail: this.clampFriendGenCount(saved.mail, 6, 1, 12),
            calendar: this.clampFriendGenCount(saved.calendar, 5, 1, 10),
            notes: this.clampFriendGenCount(saved.notes, 5, 1, 10),
            files: this.clampFriendGenCount(saved.files, 6, 1, 12)
        };
    },

    getCurrentRealTimeContext: function(date = new Date()) {
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const pad = value => String(value).padStart(2, '0');
        return `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 ${weekdays[date.getDay()]} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    },

    getRecentSingleChatRounds: function(messages, roundLimit = 20) {
        if (!Array.isArray(messages)) return [];
        const safeLimit = this.clampFriendGenCount(roundLimit, 20, 1, 50);
        return messages.slice(-(safeLimit * 2));
    },

    getRecentSingleChatMessages: function(messages, messageLimit = 20) {
        if (!Array.isArray(messages)) return [];
        const safeLimit = this.clampFriendGenCount(messageLimit, 20, 1, 50);
        return messages.slice(-safeLimit);
    },

    buildFriendPhoneImessageContinuationContext: function(friend, perChatLimit = 8) {
        const data = friend?.imessageData;
        if (!data) return '';
        const limit = this.clampFriendGenCount(perChatLimit, 8, 1, 20);
        const mainChats = data.mainAccount?.chats || (Array.isArray(data) ? data : []);
        const altChats = data.altAccount?.chats || [];
        const sections = [];
        const appendAccount = (label, chats) => {
            (Array.isArray(chats) ? chats : []).forEach(chat => {
                const messages = Array.isArray(chat?.messages) ? chat.messages.slice(0, limit) : [];
                if (!messages.length) return;
                const contactName = chat.contactNameTranslationZh || chat.contactName || '未知联系人';
                const transcript = messages.map(message => {
                    const speaker = message.sender === 'char' ? 'Char' : '对方';
                    return `${speaker}: ${message.text || '[特殊消息]'}`;
                }).join('\n');
                sections.push(`[${label} / ${contactName}]\n${transcript}`);
            });
        };
        appendAccount('主账号', mainChats);
        appendAccount('小号', altChats);
        return sections.join('\n\n');
    },

    buildFriendPhoneExistingContentContext: function(friend, selectedApps, maxEntries = 160) {
        const roots = {
            imessage: friend?.imessageData,
            music: friend?.musicData,
            health: friend?.healthData,
            pay: friend?.payData,
            game: friend?.gameData,
            call: friend?.callData,
            safari: friend?.safariData,
            weibo: friend?.weiboData,
            files: friend?.filesData
        };
        const readableKeys = new Set([
            'text', 'content', 'keyword', 'title', 'description', 'thoughts', 'dream', 'stepsThoughts',
            'heartRateStatus', 'dialogue', 'callReason', 'innerThoughts', 'postGameReflection', 'desc',
            'name', 'contactName', 'userRemark', 'signature', 'artist', 'hero', 'rank', 'result', 'source'
        ]);
        const entries = [];
        const seen = new Set();
        const visit = (value, path = '') => {
            if (entries.length >= maxEntries || value == null) return;
            if (Array.isArray(value)) return value.forEach((item, index) => visit(item, `${path}[${index}]`));
            if (typeof value !== 'object') return;
            Object.entries(value).forEach(([key, child]) => {
                if (entries.length >= maxEntries || /TranslationZh$|^(?:generatedAt|batchId|time|date|timestamp)$/i.test(key)) return;
                const nextPath = path ? `${path}.${key}` : key;
                if (typeof child === 'string' && readableKeys.has(key)) {
                    const text = child.trim();
                    const normalized = text.toLocaleLowerCase().replace(/\s+/g, ' ');
                    if (text && !seen.has(normalized) && !/^(?:https?:|data:|#[0-9a-f]{3,8}$)/i.test(text)) {
                        seen.add(normalized);
                        entries.push(`${nextPath}: ${text.slice(0, 240)}`);
                    }
                } else {
                    visit(child, nextPath);
                }
            });
        };
        (Array.isArray(selectedApps) ? selectedApps : []).forEach(app => visit(roots[app], app));
        return entries.join('\n');
    },

    normalizeFriendComputerData: function(raw, friend) {
        const source = raw && typeof raw === 'object' ? raw : {};
        const resume = source.resume && typeof source.resume === 'object' ? source.resume : {};
        const list = (value, limit) => Array.isArray(value) ? value.filter(Boolean).slice(0, limit) : [];
        const name = friend?.nickname || friend?.realname || friend?.realName || friend?.name || '好友';
        return {
            resume: {
                name,
                avatarUrl: friend?.avatarUrl || '',
                realName: friend?.realname || friend?.realName || resume.realName || '',
                gender: resume.gender || '',
                age: resume.age || '',
                birthday: resume.birthday || '',
                height: resume.height || '',
                weight: resume.weight || '',
                ethnicity: resume.ethnicity || '',
                nationality: resume.nationality || '',
                title: resume.title || '',
                email: resume.email || '',
                phone: resume.phone || '',
                location: resume.location || '',
                summary: resume.summary || '',
                skills: list(resume.skills, 12),
                experience: list(resume.experience, 6),
                education: list(resume.education, 4),
                projects: list(resume.projects, 6),
                certificates: list(resume.certificates, 6),
                languages: list(resume.languages, 6)
            },
            mail: list(source.mail, 12),
            calendar: list(source.calendar, 10),
            notes: list(source.notes, 10),
            files: list(source.files, 12),
            generatedAt: source.generatedAt || ''
        };
    },

    normalizeWeiboAccount: function(rawAccount, friend, account = 'main') {
        const source = rawAccount && typeof rawAccount === 'object' ? rawAccount : {};
        const displayName = friend?.nickname || friend?.realname || friend?.realName || friend?.name || '好友';
        const isAlt = account === 'alt';
        const name = isAlt ? (source.name || '未公开小号') : displayName;
        const avatarUrl = isAlt ? (source.avatarUrl || this.getWeiboRandomAvatar(friend)) : (friend?.avatarUrl || '');
        const posts = Array.isArray(source.posts) ? source.posts : [];
        const album = Array.isArray(source.album) ? source.album : [];
        const liked = Array.isArray(source.liked) ? source.liked.slice(0, 3) : [];
        return {
            ...source,
            name,
            signature: source.signature || '',
            avatarUrl,
            posts: posts.map((post, index) => this.normalizeWeiboPost(post, index, false)),
            album: album.map((item, index) => this.normalizeWeiboAlbumItem(item, index, friend, account)),
            liked: liked.map((post, index) => this.normalizeWeiboPost(post, index, true))
        };
    },

    getFriendWeiboData: function(friend) {
        const hasGeneratedData = friend?.weiboData && typeof friend.weiboData === 'object';
        const data = hasGeneratedData ? friend.weiboData : this.getDefaultWeiboData(friend);
        return {
            mainAccount: this.normalizeWeiboAccount(data.mainAccount || data.main || data, friend, 'main'),
            altAccount: hasGeneratedData && data.altAccount ? this.normalizeWeiboAccount(data.altAccount, friend, 'alt') : null
        };
    },

    renderWeiboAvatarHtml: function(avatarUrl, size = 40) {
        const safeUrl = this.escapeHTML(avatarUrl || '');
        return `
            <div style="width: ${size}px; height: ${size}px; border-radius: 50%; background: linear-gradient(135deg, #fff2e2, #ffd2c2); display: flex; align-items: center; justify-content: center; color: #ff8200; flex-shrink: 0; overflow: hidden;">
                ${safeUrl ? `<img src="${safeUrl}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i class="fas fa-user"></i>`}
            </div>
        `;
    },

    renderWeiboPostCard: function(post, accountData, options = {}) {
        const safeName = this.escapeHTML(post.author || options.authorName || accountData.name || '微博用户');
        const safeText = this.escapeHTML(post.text || '').replace(/\n/g, '<br>');
        const safeTime = this.escapeHTML(this.formatFriendPhoneGeneratedAt(post.generatedAt) || post.time || '');
        const safeSource = this.escapeHTML(post.source || '来自 iPhone');
        const commentCount = Array.isArray(post.comments) ? post.comments.length : 0;
        const imagePreview = options.images && options.images.length ? `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-top: 10px;">
                ${options.images.slice(0, 3).map(img => `<div style="aspect-ratio: 1; border-radius: 8px; overflow: hidden; background: #f2f2f2;"><img src="${this.escapeHTML(img.url)}" style="width: 100%; height: 100%; object-fit: cover;"></div>`).join('')}
            </div>
        ` : '';
        return `
            <div class="friend-weibo-post-card" data-post-type="${options.type || 'home'}" data-index="${options.index || 0}" style="background: #fff; padding: 14px 16px; cursor: pointer;">
                ${options.likedLabel ? `<div style="font-size: 12px; color: #999; margin-bottom: 8px;">赞过 @${safeName} 的微博</div>` : ''}
                <div style="display: flex; gap: 10px;">
                    ${options.likedLabel ? '' : this.renderWeiboAvatarHtml(accountData.avatarUrl, 40)}
                    <div style="flex: 1; min-width: 0;">
                        ${options.likedLabel ? '' : `
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                            <div>
                                <div style="font-size: 15px; font-weight: 700; color: #111;">${safeName}</div>
                                <div style="font-size: 12px; color: #999; margin-top: 2px;">${safeTime} ${safeSource}</div>
                            </div>
                            <i class="fas fa-ellipsis-h" style="color: #999;"></i>
                        </div>`}
                        <div style="font-size: 15px; color: #222; line-height: 1.55; ${options.likedLabel ? '' : 'margin-top: 10px;'}">${safeText}</div>
                        ${imagePreview}
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 13px; color: #888; font-size: 13px;">
                            <span><i class="far fa-comment-dots"></i> ${commentCount || Math.max(3, Number(options.index || 0) + 3)}</span>
                            <span><i class="fas fa-retweet"></i> ${this.escapeHTML(post.reposts ?? 0)}</span>
                            <span style="${post.likedByMe ? 'color: #ff8200;' : ''}"><i class="${post.likedByMe ? 'fas' : 'far'} fa-heart"></i> ${post.likedByMe ? '已赞' : this.escapeHTML(post.likes ?? 0)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    showWeiboPostDetail: function(post, accountData, options = {}) {
        const safeName = this.escapeHTML(post.author || options.authorName || accountData.name || '微博用户');
        const safeText = this.renderFriendPhoneLocalized(post, 'text', { id: 'weibo-detail-text' });
        const comments = Array.isArray(post.comments) ? post.comments : [];
        const commentsHtml = comments.length ? comments.map(comment => `
            <div style="padding: 10px 0; border-top: 1px solid #f2f2f2;">
                <span style="font-size: 13px; font-weight: 700; color: #333;">${this.escapeHTML(comment.author || '评论用户')}</span>
                <span style="font-size: 13px; color: #333; line-height: 1.5;">：${this.renderFriendPhoneLocalized(comment, 'text', { id: 'comment-text' })}</span>
            </div>
        `).join('') : '<div style="padding: 12px 0; color: #999; font-size: 13px;">暂无评论</div>';
        const imagesHtml = options.images && options.images.length ? `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin: 14px 0;">
                ${options.images.map((img, idx) => `<div class="friend-weibo-detail-image" data-index="${idx}" style="aspect-ratio: 1; border-radius: 8px; overflow: hidden; background: #f2f2f2; cursor: pointer;"><img src="${this.escapeHTML(img.url)}" style="width: 100%; height: 100%; object-fit: cover;"></div>`).join('')}
            </div>
        ` : '';
        const content = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
                ${this.renderWeiboAvatarHtml(accountData.avatarUrl, 44)}
                <div style="min-width: 0;">
                    <div style="font-size: 16px; font-weight: 800; color: #111;">${safeName}</div>
                    <div style="font-size: 12px; color: #999;">${this.escapeHTML(this.formatFriendPhoneGeneratedAt(post.generatedAt) || post.time || '')} ${this.escapeHTML(post.source || '来自 iPhone')}</div>
                </div>
            </div>
            <div style="font-size: 16px; color: #222; line-height: 1.65; word-break: break-word;">${safeText}</div>
            ${imagesHtml}
            <div style="display: flex; justify-content: space-around; color: #777; font-size: 13px; padding: 12px 0; border-top: 1px solid #f2f2f2; border-bottom: 1px solid #f2f2f2; margin-top: 14px;">
                <span><i class="far fa-comment-dots"></i> ${comments.length}</span>
                <span><i class="fas fa-retweet"></i> ${this.escapeHTML(post.reposts ?? 0)}</span>
                <span style="${post.likedByMe ? 'color: #ff8200;' : ''}"><i class="${post.likedByMe ? 'fas' : 'far'} fa-heart"></i> ${this.escapeHTML(post.likes ?? 0)}</span>
            </div>
            <div style="font-size: 14px; font-weight: 800; margin: 16px 0 4px; color: #111;">评论</div>
            ${commentsHtml}
        `;
        this.showDetailModal('微博详情', content);
        setTimeout(() => {
            document.querySelectorAll('#loves-detail-modal .friend-weibo-detail-image').forEach(el => {
                el.addEventListener('click', () => {
                    const idx = Number(el.getAttribute('data-index') || 0);
                    const image = options.images?.[idx];
                    if (image) this.showWeiboImageDetail(image);
                });
            });
        }, 30);
    },

    showWeiboImageDetail: function(item) {
        const safeUrl = this.escapeHTML(item.url || '');
        const safeDesc = this.escapeHTML(item.description || '').replace(/\n/g, '<br>');
        const content = `
            <div style="width: 100%; aspect-ratio: 1; border-radius: 14px; overflow: hidden; background: #f2f2f2; margin-bottom: 14px;">
                ${safeUrl ? `<img src="${safeUrl}" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="height: 100%; display: flex; align-items: center; justify-content: center; color: #999;"><i class="far fa-image" style="font-size: 40px;"></i></div>`}
            </div>
            <div style="font-size: 15px; color: #222; line-height: 1.6; word-break: break-word;">${safeDesc || '暂无描述'}</div>
        `;
        this.showDetailModal('相册详情', content);
    },

    renderFriendWeibo: function(friend) {
        const weiboView = document.getElementById('friend-weibo-view');
        if (!weiboView) return;

        const hasGeneratedWeiboData = !!(friend?.weiboData && typeof friend.weiboData === 'object');
        const allData = this.getFriendWeiboData(friend);
        if (this.currentWeiboAccount === 'alt' && !allData.altAccount) this.currentWeiboAccount = 'main';
        const accountKey = this.currentWeiboAccount === 'alt' ? 'altAccount' : 'mainAccount';
        const accountData = allData[accountKey] || allData.mainAccount;

        const profileName = document.getElementById('friend-weibo-profile-name');
        const signatureEl = document.getElementById('friend-weibo-profile-signature');
        const postCountEl = document.getElementById('friend-weibo-post-count');
        const switchBtn = document.getElementById('friend-weibo-switch-account-btn');
        const coverEl = document.getElementById('friend-weibo-cover');
        if (profileName) profileName.textContent = accountData.name || '微博用户';
        if (signatureEl) signatureEl.textContent = accountData.signature || '';
        if (postCountEl) postCountEl.textContent = String((accountData.posts || []).length);
        if (switchBtn) switchBtn.textContent = this.currentWeiboAccount === 'alt' ? '切换大号' : '切换账号';
        if (coverEl) {
            const coverUrl = hasGeneratedWeiboData ? this.getWeiboRandomCover(friend, this.currentWeiboAccount) : '';
            coverEl.style.backgroundImage = coverUrl ? `linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.34)), url("${coverUrl}")` : 'none';
            coverEl.style.backgroundSize = 'cover';
            coverEl.style.backgroundPosition = 'center';
            coverEl.style.backgroundColor = coverUrl ? '' : '#f2f2f2';
        }

        weiboView.querySelectorAll('.friend-weibo-avatar-img').forEach(img => {
            if (accountData.avatarUrl) {
                img.src = accountData.avatarUrl;
                img.style.display = 'block';
            } else {
                img.removeAttribute('src');
                img.style.display = 'none';
            }
        });
        weiboView.querySelectorAll('.friend-weibo-avatar-icon').forEach(icon => {
            icon.style.display = accountData.avatarUrl ? 'none' : 'inline-block';
        });

        const homeList = document.getElementById('friend-weibo-home-list');
        const albumGrid = document.getElementById('friend-weibo-album-grid');
        const likedList = document.getElementById('friend-weibo-liked-list');
        const albumImages = accountData.album || [];

        if (homeList) {
            const posts = accountData.posts || [];
            homeList.innerHTML = posts.length ? posts.map((post, index) => {
                const previewImages = index === 0 ? albumImages.slice(0, 3) : [];
                return this.renderWeiboPostCard(post, accountData, { type: 'home', index, images: previewImages });
            }).join('') : '<div style="padding: 38px 16px; text-align: center; color: #999; font-size: 14px;">暂无微博<br><span style="font-size: 12px; display: inline-block; margin-top: 6px;">请在设置中生成</span></div>';
            homeList.querySelectorAll('.friend-weibo-post-card').forEach(card => {
                card.addEventListener('click', () => {
                    const index = Number(card.getAttribute('data-index') || 0);
                    this.showWeiboPostDetail(posts[index], accountData, { images: index === 0 ? albumImages.slice(0, 3) : [] });
                });
            });
        }

        if (albumGrid) {
            albumGrid.innerHTML = albumImages.length ? albumImages.map((item, index) => `
                <div class="friend-weibo-album-item" data-index="${index}" style="aspect-ratio: 1; border-radius: 6px; overflow: hidden; background: #f2f2f2; cursor: pointer; position: relative;">
                    <img src="${this.escapeHTML(item.url)}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
            `).join('') : '<div style="grid-column: span 3; padding: 38px 0; text-align: center; color: #999; font-size: 14px;">暂无相册</div>';
            albumGrid.querySelectorAll('.friend-weibo-album-item').forEach(itemEl => {
                itemEl.addEventListener('click', () => {
                    const index = Number(itemEl.getAttribute('data-index') || 0);
                    this.showWeiboImageDetail(albumImages[index]);
                });
            });
        }

        if (likedList) {
            const likedPosts = accountData.liked || [];
            likedList.innerHTML = likedPosts.length ? likedPosts.map((post, index) => {
                return this.renderWeiboPostCard(post, accountData, { type: 'liked', index, likedLabel: true, authorName: post.author || '微博用户' });
            }).join('') : '<div style="padding: 38px 16px; text-align: center; color: #999; font-size: 14px;">暂无赞过</div>';
            likedList.querySelectorAll('.friend-weibo-post-card').forEach(card => {
                card.addEventListener('click', () => {
                    const index = Number(card.getAttribute('data-index') || 0);
                    this.showWeiboPostDetail(likedPosts[index], accountData, { authorName: likedPosts[index]?.author || '微博用户' });
                });
            });
        }
    },
    
    enterLovesSpace: function(friend) {
        const spaceView = document.getElementById('lovers-space-view');
        if (spaceView) {
            if (window.openView) window.openView(spaceView);
            
            const backBtn = document.getElementById('lovers-space-back-btn');
            if (backBtn) {
                backBtn.onclick = () => {
                    if (window.closeView) window.closeView(spaceView);
                };
            }
            
            // 1. 设置我的头像
            const myAvatarImg = document.getElementById('lovers-space-user-avatar');
            const myAvatarIcon = document.getElementById('lovers-space-user-icon');
            let myAvatarUrl = window.userState?.avatarUrl || window.imData?.profile?.avatarUrl;
            if (!myAvatarUrl) {
                const domAvatar = document.getElementById('edit-avatar-img') || document.getElementById('custom-avatar-img-desktop');
                if (domAvatar && domAvatar.src && !domAvatar.src.endsWith('html') && domAvatar.style.display !== 'none') {
                    myAvatarUrl = domAvatar.src;
                }
            }
            if (myAvatarUrl) {
                if(myAvatarImg) { myAvatarImg.src = myAvatarUrl; myAvatarImg.style.display = 'block'; }
                if(myAvatarIcon) myAvatarIcon.style.display = 'none';
            } else {
                if(myAvatarImg) myAvatarImg.style.display = 'none';
                if(myAvatarIcon) myAvatarIcon.style.display = 'block';
            }
            
            // 2. 设置好友的头像
            const friendAvatarImg = document.getElementById('lovers-space-friend-avatar');
            const friendAvatarIcon = document.getElementById('lovers-space-friend-icon');
            if (friend.avatarUrl) {
                if(friendAvatarImg) { friendAvatarImg.src = friend.avatarUrl; friendAvatarImg.style.display = 'block'; }
                if(friendAvatarIcon) friendAvatarIcon.style.display = 'none';
            } else {
                if(friendAvatarImg) friendAvatarImg.style.display = 'none';
                if(friendAvatarIcon) friendAvatarIcon.style.display = 'block';
            }

            // 渲染设备列表
            const friendName = friend.nickname || friend.realname || 'TA';
            const safeFriendName = this.escapeHTML(friendName);
            const devicesList = document.getElementById('lovers-devices-list');
            if (devicesList) {
                devicesList.innerHTML = `
                    <div class="lovers-feature-row is-static">
                        <span class="lovers-feature-icon"><i class="fas fa-mobile-alt"></i></span>
                        <span class="lovers-feature-copy"><strong>我的手机</strong><small>在线 · 电量 87%</small></span>
                        <span class="lovers-device-status is-online">ONLINE</span>
                    </div>
                    <button type="button" id="friend-phone-device-item" class="lovers-feature-row">
                        <span class="lovers-feature-icon"><i class="fas fa-mobile-alt"></i></span>
                        <span class="lovers-feature-copy"><strong>${safeFriendName} 的手机</strong><small>在线 · 电量 91%</small></span>
                        <i class="fas fa-chevron-right lovers-feature-chevron"></i>
                    </button>
                    <button type="button" id="friend-computer-device-item" class="lovers-feature-row">
                        <span class="lovers-feature-icon"><i class="fas fa-laptop"></i></span>
                        <span class="lovers-feature-copy"><strong>${safeFriendName} 的电脑</strong><small>在线 · 工作模式</small></span>
                        <i class="fas fa-chevron-right lovers-feature-chevron"></i>
                    </button>
                `;
                
                const friendPhoneItem = document.getElementById('friend-phone-device-item');
                if (friendPhoneItem) {
                    friendPhoneItem.addEventListener('click', () => {
                        this.openFriendPhone(friend);
                    });
                }
                const friendComputerItem = document.getElementById('friend-computer-device-item');
                if (friendComputerItem) {
                    friendComputerItem.addEventListener('click', () => this.openFriendComputer(friend));
                }
            }
            
            this.currentFriend = friend;
            this.bindSharedSavingsButton(friend);
            this.updateDaysCount(friend);
            void this.syncDailySavingsForFriend(friend).then((changed) => {
                if (changed && document.getElementById('lovers-savings-view')?.classList.contains('active')) {
                    this.renderSavingsJar();
                }
            });
            
            // 绑定点击
            this.bindFabClick();
            // 首次渲染动态
            this.renderLovesMoments();
            // 初始化日记并渲染
            this.currentDiaryDate = new Date();
            this.renderDiary();

            // 3. Tabs 切换逻辑绑定
            const tabs = spaceView.querySelectorAll('.lovers-space-tab');
            const indicator = document.getElementById('lovers-space-tab-indicator');
            const panels = spaceView.querySelectorAll('.lovers-space-panel');
            
            // 避免克隆节点破坏原生绑定，改为检查是否已绑定自定义属性
            const tabsContainer = spaceView.querySelector('.lovers-space-tabs-container');
            if (tabsContainer && !tabsContainer.dataset.bound) {
                tabsContainer.dataset.bound = 'true';
                
                tabs.forEach(tab => {
                    tab.addEventListener('click', (e) => {
                        tabs.forEach(t => {
                            t.classList.remove('active');
                            t.setAttribute('aria-selected', 'false');
                        });
                        panels.forEach(p => {
                            p.classList.remove('active');
                        });
                        
                        const target = e.currentTarget;
                        target.classList.add('active');
                        target.setAttribute('aria-selected', 'true');
                        
                        const targetLeft = target.offsetLeft;
                        const targetWidth = target.offsetWidth;
                        if (indicator) {
                            indicator.style.left = (targetLeft + (targetWidth - 30) / 2) + 'px';
                        }
                        
                        const tabName = target.getAttribute('data-tab');
                        const panel = document.getElementById('lovers-panel-' + tabName);
                        if (panel) {
                            panel.classList.add('active');
                        }
                        if (tabName === 'diary') {
                            this.renderDiary();
                        }
                    });
                });
            }
            
            // 默认触发第一个 tab 居中计算
            if (tabs.length > 0 && indicator) {
                // 等待重绘
                setTimeout(() => {
                    const firstTab = tabs[0];
                    const targetLeft = firstTab.offsetLeft;
                    const targetWidth = firstTab.offsetWidth;
                    indicator.style.left = (targetLeft + (targetWidth - 30) / 2) + 'px';
                }, 10);
            }
        }
    },
    
    openFriendComputer: function(friend) {
        const view = document.getElementById('lovers-friend-computer-view');
        if (!view) return;
        this.currentFriend = friend;
        const name = friend.nickname || friend.realname || friend.realName || friend.name || 'TA';
        const owner = document.getElementById('friend-mac-owner-name');
        if (owner) owner.textContent = `${name} 的 Mac`;
        const desktop = document.getElementById('friend-mac-desktop');
        if (desktop) {
            desktop.classList.toggle('has-custom-background', !!friend.computerBg);
            desktop.style.backgroundImage = friend.computerBg ? `url("${String(friend.computerBg).replace(/"/g, '%22')}")` : '';
        }
        if (window.openView) window.openView(view);

        const back = document.getElementById('friend-computer-back-btn');
        if (back) back.onclick = () => {
            this.closeFriendComputerApp();
            if (window.closeView) window.closeView(view);
        };
        const close = document.getElementById('friend-mac-window-close');
        if (close) close.onclick = () => this.closeFriendComputerApp();
        view.querySelectorAll('.friend-mac-dock [data-computer-app]').forEach(button => {
            button.onclick = () => {
                if (this.currentComputerApp === button.dataset.computerApp && !document.getElementById('friend-mac-window')?.hidden) {
                    this.closeFriendComputerApp();
                    return;
                }
                this.openFriendComputerApp(button.dataset.computerApp);
            };
        });
    },

    closeFriendComputerApp: function() {
        const win = document.getElementById('friend-mac-window');
        if (win) win.hidden = true;
        document.getElementById('lovers-friend-computer-view')?.classList.remove('app-open');
        this.currentComputerApp = null;
        document.querySelectorAll('.friend-mac-dock [data-computer-app]').forEach(button => button.classList.remove('active'));
    },

    openFriendComputerApp: function(app) {
        const titles = { resume: '简历', mail: '邮件', calendar: '日历', notes: '备忘录', files: '文件', settings: '系统设置' };
        const win = document.getElementById('friend-mac-window');
        const title = document.getElementById('friend-mac-window-title');
        const content = document.getElementById('friend-mac-window-content');
        if (!win || !content || !titles[app]) return;
        const data = this.normalizeFriendComputerData(this.currentFriend?.computerData, this.currentFriend);
        win.hidden = false;
        document.getElementById('lovers-friend-computer-view')?.classList.add('app-open');
        this.currentComputerApp = app;
        if (title) title.textContent = titles[app];
        document.querySelectorAll('.friend-mac-dock [data-computer-app]').forEach(button => button.classList.toggle('active', button.dataset.computerApp === app));
        const renderers = {
            resume: () => this.renderFriendComputerResume(data.resume),
            mail: () => this.renderFriendComputerCollection('mail', data.mail),
            calendar: () => this.renderFriendComputerCollection('calendar', data.calendar),
            notes: () => this.renderFriendComputerCollection('notes', data.notes),
            files: () => this.renderFriendComputerCollection('files', data.files),
            settings: () => this.renderFriendComputerSettings()
        };
        content.innerHTML = renderers[app]();
        this.bindFriendComputerContent(app);
    },

    renderFriendComputerResume: function(resume) {
        const e = value => this.escapeHTML(String(value || ''));
        if (!resume.title && !resume.summary && resume.experience.length === 0) {
            return '<div class="friend-mac-empty"><i class="fas fa-id-card"></i><strong>还没有简历</strong><p>在系统设置中生成符合 Char 人设的职业资料。</p></div>';
        }
        const section = (title, items, renderer) => items.length ? `<section><h3>${title}</h3>${items.map(renderer).join('')}</section>` : '';
        const avatar = resume.avatarUrl ? `<img src="${e(resume.avatarUrl)}" alt="">` : '<i class="fas fa-user"></i>';
        const personalInfo = [
            ['真实姓名', resume.realName], ['性别', resume.gender], ['年龄', resume.age], ['出生日期', resume.birthday],
            ['身高', resume.height], ['体重', resume.weight], ['民族', resume.ethnicity], ['国籍', resume.nationality]
        ].filter(([, value]) => value);
        return `<article class="friend-mac-resume">
            <header><div class="friend-mac-resume-avatar">${avatar}</div><div><h1>${e(resume.name)}</h1><h2>${e(resume.title)}</h2><p>${[resume.email, resume.phone, resume.location].filter(Boolean).map(e).join(' · ')}</p></div></header>
            ${personalInfo.length ? `<section><h3>个人信息</h3><div class="friend-mac-personal-grid">${personalInfo.map(([label, value]) => `<div><span>${label}</span><strong>${e(value)}</strong></div>`).join('')}</div></section>` : ''}
            ${resume.summary ? `<section><h3>个人简介</h3><p>${e(resume.summary)}</p></section>` : ''}
            ${section('专业技能', resume.skills, item => `<span class="friend-mac-skill">${e(typeof item === 'string' ? item : item.name)}</span>`)}
            ${section('工作经历', resume.experience, item => `<div class="friend-mac-resume-item"><b>${e(item.role || item.title)}</b><time>${e(item.period)}</time><strong>${e(item.company)}</strong><p>${e(item.description)}</p></div>`)}
            ${section('项目经历', resume.projects, item => `<div class="friend-mac-resume-item"><b>${e(item.name)}</b><time>${e(item.period)}</time><p>${e(item.description)}</p></div>`)}
            ${section('教育经历', resume.education, item => `<div class="friend-mac-resume-item"><b>${e(item.school)}</b><time>${e(item.period)}</time><p>${e(item.degree || item.major)}</p></div>`)}
            ${section('证书', resume.certificates, item => `<span class="friend-mac-line-item">${e(typeof item === 'string' ? item : item.name)}</span>`)}
            ${section('语言', resume.languages, item => `<span class="friend-mac-line-item">${e(typeof item === 'string' ? item : `${item.name} · ${item.level || ''}`)}</span>`)}
        </article>`;
    },

    renderFriendComputerCollection: function(type, items) {
        const e = value => this.escapeHTML(String(value || ''));
        if (!items.length) return `<div class="friend-mac-empty"><i class="fas fa-${type === 'mail' ? 'envelope' : type === 'calendar' ? 'calendar-alt' : type === 'notes' ? 'sticky-note' : 'folder'}"></i><strong>暂无内容</strong><p>在系统设置中生成这项工作数据。</p></div>`;
        const labels = { mail: '收件箱', calendar: '工作日程', notes: '全部备忘录', files: '工作文件' };
        return `<div class="friend-mac-split"><aside><h2>${labels[type]}</h2>${items.map((item, index) => `<button type="button" class="friend-mac-list-item${index === 0 ? ' active' : ''}" data-computer-item="${index}"><b>${e(item.subject || item.title || item.name)}</b><span>${e(item.sender || item.date || item.modifiedAt || item.time)}</span><small>${e(item.preview || item.folder || item.type || item.location)}</small></button>`).join('')}</aside><article id="friend-mac-detail"></article></div>`;
    },

    bindFriendComputerContent: function(app) {
        if (app === 'settings') {
            const button = document.getElementById('friend-computer-generate-btn');
            if (button) button.onclick = () => this.generateFriendComputerData(button);
            const urlButton = document.getElementById('friend-computer-bg-url-apply');
            if (urlButton) urlButton.onclick = () => this.applyFriendComputerBackgroundUrl();
            const upload = document.getElementById('friend-computer-bg-upload');
            if (upload) upload.onchange = event => this.uploadFriendComputerBackground(event);
            const reset = document.getElementById('friend-computer-bg-reset');
            if (reset) reset.onclick = () => this.saveFriendComputerBackground('');
            const realTimeToggle = document.getElementById('friend-computer-real-time-toggle');
            if (realTimeToggle) realTimeToggle.onchange = () => {
                this.currentFriend.computerIncludeRealTime = realTimeToggle.checked;
                this.persistFriendState(this.currentFriend, { silent: true });
            };
            return;
        }
        if (!['mail', 'calendar', 'notes', 'files'].includes(app)) return;
        const data = this.normalizeFriendComputerData(this.currentFriend?.computerData, this.currentFriend)[app];
        const detail = document.getElementById('friend-mac-detail');
        const renderDetail = index => {
            const item = data[index] || {};
            const e = value => this.escapeHTML(String(value || ''));
            if (detail) detail.innerHTML = `<span class="friend-mac-detail-meta">${e(item.sender || item.date || item.modifiedAt || item.time || item.type)}</span><h1>${e(item.subject || item.title || item.name)}</h1>${item.location ? `<h3><i class="fas fa-map-marker-alt"></i> ${e(item.location)}</h3>` : ''}<div class="friend-mac-detail-body">${e(item.body || item.content || item.description || item.preview).replace(/\n/g, '<br>')}</div>`;
        };
        document.querySelectorAll('.friend-mac-list-item').forEach(button => button.onclick = () => {
            document.querySelectorAll('.friend-mac-list-item').forEach(item => item.classList.remove('active'));
            button.classList.add('active');
            renderDetail(Number(button.dataset.computerItem));
        });
        renderDetail(0);
    },

    renderFriendComputerSettings: function() {
        const counts = this.getFriendComputerGenCounts(this.currentFriend);
        const selected = Array.isArray(this.currentFriend?.computerGenApps) ? this.currentFriend.computerGenApps : ['resume', 'mail', 'calendar', 'notes', 'files'];
        const rows = [
            ['resume', '简历', 'id-card', null], ['mail', '邮件', 'envelope', counts.mail], ['calendar', '日历', 'calendar-alt', counts.calendar],
            ['notes', '备忘录', 'sticky-note', counts.notes], ['files', '文件', 'folder', counts.files]
        ];
        return `<div class="friend-mac-settings"><header><span>APPEARANCE</span><h1>桌面与数据</h1><p>管理这台 Mac 的桌面背景和工作内容。</p></header>
            <section class="friend-mac-wallpaper-settings"><h2>桌面背景</h2><div class="friend-mac-wallpaper-row"><input type="url" id="friend-computer-bg-url" placeholder="粘贴图片 URL" value="${this.escapeHTML(this.currentFriend?.computerBg?.startsWith('http') ? this.currentFriend.computerBg : '')}"><button type="button" id="friend-computer-bg-url-apply">应用</button></div><div class="friend-mac-wallpaper-actions"><label><i class="fas fa-arrow-up-from-bracket"></i><span>上传图片</span><input type="file" id="friend-computer-bg-upload" accept="image/*" hidden></label><button type="button" id="friend-computer-bg-reset"><i class="fas fa-rotate-left"></i><span>恢复默认</span></button></div></section>
            <div class="friend-mac-settings-heading"><span>GENERATOR</span><h2>生成工作数据</h2><p>仅覆盖选中的应用。</p></div><label class="friend-real-time-option friend-mac-real-time"><span><i class="fas fa-clock"></i><strong>使用真实时间</strong><small>加入当前日期、星期与准确时间</small></span><input type="checkbox" id="friend-computer-real-time-toggle" ${this.currentFriend?.computerIncludeRealTime !== false ? 'checked' : ''}></label><div class="friend-mac-settings-list">${rows.map(([key, label, icon, count]) => `<label><input type="checkbox" class="computer-gen-checkbox" value="${key}" ${selected.includes(key) ? 'checked' : ''}><i class="fas fa-${icon}"></i><strong>${label}</strong>${count ? `<input type="number" class="computer-gen-count" data-count-key="${key}" min="1" max="${key === 'mail' || key === 'files' ? 12 : 10}" value="${count}">` : '<span>完整模板</span>'}</label>`).join('')}</div><button type="button" id="friend-computer-generate-btn" class="friend-mac-generate"><i class="fas fa-wand-magic-sparkles"></i><span>生成选中的应用数据</span></button><small class="friend-mac-generated-at">${this.currentFriend?.computerData?.generatedAt ? `上次生成：${this.escapeHTML(this.currentFriend.computerData.generatedAt)}` : '尚未生成电脑数据'}</small></div>`;
    },

    applyFriendComputerBackgroundUrl: function() {
        const input = document.getElementById('friend-computer-bg-url');
        const value = input?.value.trim() || '';
        if (!value) return window.showToast?.('请输入图片 URL');
        try {
            const parsed = new URL(value);
            if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported');
            this.saveFriendComputerBackground(parsed.href);
        } catch (error) {
            window.showToast?.('请输入有效的 http 或 https 图片 URL');
        }
    },

    uploadFriendComputerBackground: function(event) {
        const file = event?.target?.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return window.showToast?.('请选择图片文件');
        const reader = new FileReader();
        reader.onload = () => this.saveFriendComputerBackground(String(reader.result || ''));
        reader.onerror = () => window.showToast?.('图片读取失败');
        reader.readAsDataURL(file);
    },

    saveFriendComputerBackground: async function(value) {
        if (!this.currentFriend) return;
        this.currentFriend.computerBg = value;
        const desktop = document.getElementById('friend-mac-desktop');
        if (desktop) {
            desktop.classList.toggle('has-custom-background', !!value);
            desktop.style.backgroundImage = value ? `url("${String(value).replace(/"/g, '%22')}")` : '';
        }
        await this.persistFriendState(this.currentFriend);
        window.showToast?.(value ? '桌面背景已更新' : '已恢复默认背景');
        this.openFriendComputerApp('settings');
    },

    generateFriendComputerData: async function(button) {
        const friend = this.currentFriend;
        if (!friend || button.disabled) return;
        const selected = Array.from(document.querySelectorAll('.computer-gen-checkbox:checked')).map(input => input.value);
        if (!selected.length) return window.showToast?.('请至少选择一个应用');
        if (!window.apiConfig?.endpoint || !window.apiConfig?.apiKey) return window.showToast?.('请先在系统设置中配置 API');
        const counts = this.getFriendComputerGenCounts({ computerGenCounts: Object.fromEntries(Array.from(document.querySelectorAll('.computer-gen-count')).map(input => [input.dataset.countKey, input.value])) });
        friend.computerGenApps = selected;
        friend.computerGenCounts = counts;
        const realTimeToggle = document.getElementById('friend-computer-real-time-toggle');
        friend.computerIncludeRealTime = realTimeToggle ? realTimeToggle.checked : friend.computerIncludeRealTime !== false;
        await this.persistFriendState(friend, { silent: true });
        let globalRule = '';
        if (window.getGlobalWorldBookContextByPosition) globalRule = [window.getGlobalWorldBookContextByPosition('system_depth'), window.getGlobalWorldBookContextByPosition('before_role')].filter(Boolean).join('\n');
        const chat = this.getRecentSingleChatRounds(friend.messages, 20).map(message => `${message.sender === 'me' ? 'User' : 'Char'}: ${message.text || '[特殊消息]'}`).join('\n');
        const requirements = {
            resume: 'resume：完整职业简历，包含 realName、gender、age、birthday、height、weight、ethnicity、nationality、title、email、phone、location、summary、skills、experience、education、projects、certificates、languages。age 为带“岁”的年龄，身高体重须带单位，经历字段使用 role/company/period/description，教育使用 school/degree/major/period，项目使用 name/period/description。',
            mail: `mail：严格 ${counts.mail} 封工作邮件，每项包含 subject、sender、time、preview、body。`,
            calendar: `calendar：严格 ${counts.calendar} 条工作日程，每项包含 title、date、time、location、description。`,
            notes: `notes：严格 ${counts.notes} 条工作备忘录，每项包含 title、modifiedAt、preview、content。`,
            files: `files：严格 ${counts.files} 个工作文件，每项包含 name、folder、type、modifiedAt、content。`
        };
        const realTimeContext = friend.computerIncludeRealTime !== false ? `\n【当前真实时间】${this.getCurrentRealTimeContext()}` : '';
        const prompt = `为 Char 的私人电脑生成真实、克制、符合职业与人设的工作数据。只能输出合法 JSON，不要 Markdown。${realTimeContext}\n【Char 人设】${friend.persona || '普通角色'}\n【User 人设】${window.userState?.persona || '普通用户'}\n【世界书】${globalRule}\n【近期聊天】${chat}\n【选中字段】\n${selected.map(key => requirements[key]).join('\n')}\n只返回一个对象，且只能包含这些顶层字段：${selected.join('、')}。内容避免模板化和重复，所有文本使用中文或符合角色背景的自然语言。`;
        const endpoint = window.u2Api.resolveChatCompletionsEndpoint(window.apiConfig.endpoint);
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>正在生成...</span>';
        window.showToast?.('正在生成电脑数据，请稍候...');
        try {
            const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.apiConfig.apiKey}` }, body: JSON.stringify({ model: window.apiConfig.model || 'gpt-3.5-turbo', messages: [{ role: 'system', content: '你是数据生成助手，只返回合法 JSON。' }, { role: 'user', content: prompt }], temperature: 0.7 }) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload = await response.json();
            const text = payload.choices?.[0]?.message?.content || '';
            const match = text.match(/\{[\s\S]*\}/);
            const parsed = JSON.parse(match ? match[0] : text.replace(/```json|```/gi, '').trim());
            const merged = { ...(friend.computerData || {}) };
            selected.forEach(key => { if (Object.prototype.hasOwnProperty.call(parsed, key)) merged[key] = parsed[key]; });
            merged.generatedAt = new Date().toLocaleString('zh-CN', { hour12: false });
            friend.computerData = this.normalizeFriendComputerData(merged, friend);
            friend.computerData.generatedAt = merged.generatedAt;
            await this.persistFriendState(friend);
            window.showToast?.('电脑数据生成成功');
            this.openFriendComputerApp('settings');
        } catch (error) {
            console.error('Friend computer generation failed:', error);
            window.showToast?.(`生成失败：${String(error.message || '未知错误').slice(0, 50)}`);
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i><span>生成选中的应用数据</span>';
        }
    },

    openFriendPhone: function(friend) {
        const phoneView = document.getElementById('lovers-friend-phone-view');
        if (!phoneView) return;
        if (String(this.currentFriend?.id || '') !== String(friend?.id || '')) {
            this._healthHistoryIndex = 0;
            this._payHistoryIndex = 0;
        }
        
        phoneView.style.backgroundImage = friend.phoneBg ? `url(${friend.phoneBg})` : 'url("assets/bizhi.jpg")';
        this.bindFriendPhoneTranslationDelegation(phoneView);
        this.bindFriendPhoneTranslationDelegation(document.getElementById('friend-reverse-chat-view'));
        
        if (window.openView) window.openView(phoneView);
        
        const backBtn = document.getElementById('friend-phone-back-btn');
        if (backBtn) {
            backBtn.onclick = () => {
                if (window.closeView) window.closeView(phoneView);
            };
        }
        
        // 绑定设置
        const settingsSheet = document.getElementById('friend-phone-settings-sheet');
        const settingsBtn = document.getElementById('friend-phone-app-settings');
        if (settingsBtn && settingsSheet) {
            settingsBtn.onclick = () => window.openView(settingsSheet);
        }
        
        const settingsBackBtn = document.getElementById('friend-settings-back-btn');
        if (settingsBackBtn && settingsSheet) {
            settingsBackBtn.onclick = () => {
                if (window.closeView) window.closeView(settingsSheet);
            };
        }

        const getGenAppCheckboxes = () => Array.from(document.querySelectorAll('.gen-app-checkbox'));
        const defaultGenApps = ['imessage', 'music', 'health', 'pay', 'game', 'call', 'safari', 'weibo', 'files'];
        const genCountInputs = {
            imessageMain: document.getElementById('friend-gen-imessage-main-count'),
            imessageAlt: document.getElementById('friend-gen-imessage-alt-count'),
            musicTop: document.getElementById('friend-gen-music-top-count'),
            safariTotal: document.getElementById('friend-gen-safari-count'),
            gameTotal: document.getElementById('friend-gen-game-count'),
            callTotal: document.getElementById('friend-gen-call-count'),
            weiboPostsTotal: document.getElementById('friend-gen-weibo-post-count'),
            weiboPhotosTotal: document.getElementById('friend-gen-weibo-photo-count')
        };
        const realTimeToggle = document.getElementById('friend-phone-real-time-toggle');
        const chatContextToggle = document.getElementById('friend-phone-chat-context-toggle');
        const getSavedGenApps = () => {
            return Array.isArray(friend.phoneGenApps) ? friend.phoneGenApps : defaultGenApps;
        };
        const applySavedGenApps = () => {
            const savedApps = getSavedGenApps();
            getGenAppCheckboxes().forEach(cb => {
                cb.checked = savedApps.includes(cb.value);
            });
        };
        const saveGenApps = () => {
            friend.phoneGenApps = getGenAppCheckboxes().filter(cb => cb.checked).map(cb => cb.value);
            this.persistFriendState(friend, { silent: true });
        };
        const syncGenRows = () => {
            getGenAppCheckboxes().forEach(cb => {
                const row = cb.closest('.friend-gen-limit-row');
                if (!row) return;
                row.classList.toggle('is-disabled', !cb.checked);
                row.querySelectorAll('input[type="number"]').forEach(input => {
                    input.disabled = !cb.checked;
                });
            });
        };
        const applySavedGenCounts = () => {
            const counts = this.getFriendPhoneGenCounts(friend);
            Object.entries(genCountInputs).forEach(([key, input]) => {
                if (input) input.value = String(counts[key]);
            });
        };
        const saveGenCounts = () => {
            const current = this.getFriendPhoneGenCounts({
                phoneGenCounts: Object.fromEntries(
                    Object.entries(genCountInputs).map(([key, input]) => [key, input?.value])
                )
            });
            friend.phoneGenCounts = current;
            Object.entries(genCountInputs).forEach(([key, input]) => {
                if (input) input.value = String(current[key]);
            });
            this.persistFriendState(friend, { silent: true });
            return current;
        };
        getGenAppCheckboxes().forEach(cb => {
            cb.onchange = () => {
                syncGenRows();
                saveGenApps();
            };
        });
        Object.values(genCountInputs).forEach(input => {
            if (input) input.onchange = () => saveGenCounts();
        });
        if (realTimeToggle) {
            realTimeToggle.checked = friend.phoneIncludeRealTime !== false;
            realTimeToggle.onchange = () => {
                friend.phoneIncludeRealTime = realTimeToggle.checked;
                this.persistFriendState(friend, { silent: true });
            };
        }
        if (chatContextToggle) {
            chatContextToggle.checked = friend.phoneIncludeChatContext !== false;
            chatContextToggle.onchange = () => {
                friend.phoneIncludeChatContext = chatContextToggle.checked;
                this.persistFriendState(friend, { silent: true });
            };
        }
        applySavedGenApps();
        applySavedGenCounts();
        syncGenRows();

        const genConfirmBtn = document.getElementById('friend-phone-gen-confirm-btn');
        if (genConfirmBtn) {
            genConfirmBtn.onclick = async () => {
                saveGenApps();
                const genCounts = saveGenCounts();
                const selectedApps = getSavedGenApps();
                const includeRealTime = realTimeToggle ? realTimeToggle.checked : friend.phoneIncludeRealTime !== false;
                const includeSingleChatContext = chatContextToggle ? chatContextToggle.checked : friend.phoneIncludeChatContext !== false;
                friend.phoneIncludeRealTime = includeRealTime;
                friend.phoneIncludeChatContext = includeSingleChatContext;
                const safariSplit = this.splitFriendGenTotal(genCounts.safariTotal);
                const weiboPostSplit = this.splitFriendGenTotal(genCounts.weiboPostsTotal);
                const weiboPhotoSplit = this.splitFriendGenTotal(genCounts.weiboPhotosTotal);
                
                if (selectedApps.length === 0) {
                    if (window.showToast) window.showToast('请至少选择一个应用');
                    return;
                }

                if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
                    if (window.showToast) window.showToast('请先在系统设置中配置 API');
                    return;
                }

                // 收集世界书与人设
                let globalRule = '';
                if (window.getGlobalWorldBookContextByPosition) {
                    globalRule = window.getGlobalWorldBookContextByPosition('system_depth') || '';
                    const beforeRole = window.getGlobalWorldBookContextByPosition('before_role');
                    if (beforeRole) globalRule += '\n' + beforeRole;
                }
                
                const userPersona = window.userState?.persona || '普通用户';
                const charPersona = friend.persona || '普通角色';
                
                // 按用户设置固定挂载最近 20 条真实单聊消息。
                let chatContext = '';
                if (includeSingleChatContext) {
                    const messageFriend = await this.ensureFriendPhoneMessagesLoaded(friend);
                    const msgs = this.getRecentSingleChatMessages(messageFriend?.messages, 20);
                    if (msgs.length > 0) {
                        chatContext = msgs.map(m => {
                            const sender = this.isFriendPhoneUserMessage(m) ? 'User' : 'Char';
                            return `${sender}: ${this.getFriendPhoneMessageText(m)}`;
                        }).join('\n');
                    }
                }
                
                const phoneLanguage = this.normalizeFriendPhoneLanguage(friend.language || 'zh');
                const phoneLanguageName = this.getFriendPhoneLanguageName(phoneLanguage);
                let prompt = `你现在要模拟生成一部手机里不同应用的数据。请严格遵循给定的世界观设定、角色人设和聊天上下文，生成符合角色性格的JSON格式数据。\n`;
                prompt += `\n【最高优先级语言与翻译协议】\n- 所有 AI 创作的可读字符串原文必须只使用 Char 的默认语言：${phoneLanguageName} (${phoneLanguage})。\n- 联系人例外：iMessage 的 contactName、userRemark，以及通话记录和通讯录的 name 必须直接使用自然的简体中文姓名，不得使用外文姓名，不需要额外翻译字段。\n- 音乐例外：music 内每首歌的 name 必须使用歌曲真实、正常的官方歌名，保留歌名本来的语言，不受 Char 默认语言限制，不返回 nameTranslationZh。\n- 游戏例外：game 中除 highlights[].desc、innerThoughts、postGameReflection（兼容 thoughts）外，其余字段均不受 Char 默认语言限制，也不需要任何 TranslationZh 字段；仅这四类叙事字段遵循 Char 默认语言并返回中文翻译。\n- 微博例外：weibo 只有帖子正文 text 和评论正文 comments[].text 遵循 Char 默认语言并返回 textTranslationZh；账号名、昵称、签名、作者名、来源、相册描述等其他字段不限制语言，也不返回翻译字段。\n- 文件例外：files 只有文件详情正文 items[].content 遵循 Char 默认语言并返回 contentTranslationZh；标签名与文件标题不限制语言，也不返回翻译字段。\n- 除以上例外，对每个可读字符串字段 field，都必须同时返回 fieldTranslationZh。原文非中文时，fieldTranslationZh 必须是自然准确的简体中文翻译；原文为中文时必须为空字符串。\n- sender、type、icon、数值、布尔值、URL、ID、银行卡号等机器字段不翻译。\n`;
                prompt += `\n【最高优先级时间协议】不要返回 time、date、createdAt、timestamp、addedTime、recentCallTime 等记录时间字段，也不要为应用记录编造时间戳；真实生成时间始终由前端写入。\n`;
                if (includeRealTime) prompt += `\n【当前真实时间】${this.getCurrentRealTimeContext()}\n- 仅将它用于理解当前季节、昼夜、作息、近期事件与内容语境，让生成内容具有自然的时间感知；不要把它复制成 JSON 时间字段。\n`;
                prompt += `\n【覆盖规则】本次勾选应用的生成结果会完整覆盖该应用旧数据。请生成一套独立、完整的新内容，不要续写或依赖旧手机数据。\n`;
                
                if (globalRule) prompt += `\n【世界书设定】：\n${globalRule}\n`;
                prompt += `\n【角色 (Char) 人设】：\n${charPersona}\n`;
                prompt += `\n【用户 (User) 人设】：\n${userPersona}\n`;
                if (chatContext) prompt += `\n【固定挂载的最近 20 条单聊上下文】：\n${chatContext}\n`;
                
                prompt += `\n根据选择的应用返回对应的数据。\n`;

                const requirementParts = {
                    imessage: `[imessage]: 主账号必须生成一个简体中文的 userRemark（如宝宝、主人、亲爱的或任何符合人设的专属称呼）。主号和小号所有 contactName 都必须直接使用自然的简体中文姓名，不要返回外文联系人名。主账号严格生成 ${genCounts.imessageMain} 个与其他人的完整日常会话，绝对不要生成与 user 的聊天记录；每个会话生成 2-5 条自然气泡，sender 只能是 them 或 char，按真实聊天节奏交替或连续发送，不要机械固定成一问一答。小号严格生成 ${genCounts.imessageAlt} 个完整会话，其中前两个固定且不可缺少：①【备忘录】，生成 2-5 条 sender 为 char 的情绪记录、私人想法或关于 user 的事情；②【文件传输助手】，生成 2-5 条 sender 为 char 的私密文件、图片或收藏记录。若小号会话数大于 2，其余会话才生成符合隐藏身份与交际圈的真实联系人，每个会话同样生成 2-5 条气泡。`,
                    safari: `[safari]: 严格生成 ${safariSplit.primary} 条公开模式的日常搜索，以及 ${safariSplit.secondary} 条无痕模式下符合其隐私、疑问或不愿公开心境的搜索内容，共 ${genCounts.safariTotal} 条。搜索主题、关键词长度、网页来源和详情表达需要自然多样，不要把无痕内容机械等同于阴暗或猎奇。`,
                    files: `[files]: 生成符合角色人设的文件列表，其中 tags 内必须包含能够体现其性格、癖好、或对 User 的看法的隐私内容（如小说草稿、私密日记、账单等），需生成 2-3 个标签，每个标签 1-3 个新文件，确保文件名不要与历史已有的重复。标签名和文件标题不限制语言且不需要翻译；只有文件详情 content 按 Char 默认语言生成并提供中文翻译。`,
                    call: `[call]: 严格生成 ${genCounts.callTotal} 条通话记录，并生成与记录中联系人对应的详细联系人信息。recentCalls 和 contacts 的 name 必须直接使用自然的简体中文姓名，不要返回外文联系人名；其余内容必须符合角色人设与交际圈。请避免使用不符合 JSON 标准的单引号。`,
                    music: `[music]: 听歌排行 top 严格生成 ${genCounts.musicTop} 首，风格应极大程度体现其人设与心境；歌曲 name 必须使用真实、正常的官方歌名，保留原本语言，不要翻译歌名，也不要返回 nameTranslationZh。每首歌必须包含循环次数（纯数字）和不少于 20 字的细腻心声。recent 和 favorites 保持自然数量，不受排行榜数量限制。`,
                    health: `[health]: 严格符合其人设（如是否运动、熬夜、体型等）生成近期睡眠、步数、身高和体重；dream 写约 30 字的昨夜梦境；stepsThoughts 写约 30 字的跑步或运动时心理活动；heartRate 必须是符合当前状态的纯数字 BPM，heartRateStatus 是与该心率匹配的简短状态。`,
                    pay: `[pay]: 生成符合人设的银行卡总金额和近期不少于 5 条收支记录。`,
                    game: `[game]: 严格生成 ${genCounts.gameTotal} 个符合人设的游戏。只有高光时刻 highlights[].desc、局内心声 innerThoughts、局后复盘 postGameReflection 受 Char 默认语言限制并需要中文翻译；游戏名、玩家名、段位、英雄、结果、时长等其余字段可使用其正常语言，不要返回翻译字段。每局必须包含结果、KDA(如8/2/5)、使用英雄、高光时刻(数组)、内心戏(30字)、复盘(30字)，不得包含时间。格式必须完全符合提供的JSON模板，不要使用特殊字符。`,
                    weibo: `[weibo]: 生成完整微博资料。只有帖子正文 text 和评论正文 comments[].text 按 Char 默认语言生成并提供中文翻译；账号名、昵称、签名、评论作者名、来源、相册描述等其他字段不限制语言且不需要翻译。大号严格生成 ${weiboPostSplit.primary} 条主页帖子和 ${weiboPhotoSplit.primary} 张相册照片；小号严格生成 ${weiboPostSplit.secondary} 条主页帖子和 ${weiboPhotoSplit.secondary} 张相册照片。每条主页帖子尽量生成 2-5 条自然评论；大号和小号的赞过列表各保持 3 条。大号像可被熟人看到的公开主页，小号则贴近隐藏身份，可以写关于 User 的情绪、珍视的记忆、关系思考或只有小号才敢保存的瞬间，但不要让所有内容围绕 User，也不要让小号只有负面情绪。所有帖子必须在主题、篇幅、语气、叙事视角和互动氛围上有真实差异，禁止套用固定开头、固定剧情、编号化文案、同义改写和重复句式；照片描述也要覆盖不同主体、场景、构图、光线和拍摄质感。小号头像 avatarUrl 可以留空，由系统随机补图。`
                };

                const promptParts = {
                    imessage: `"imessage": {
  "mainAccount": {
    "userRemark": "对于 user 的专属备注",
    "chats": [
      {"contactName": "简体中文联系人名", "messages": [{"sender": "them", "text": "承接当前话题的气泡1", "textTranslationZh": "中文翻译或空字符串"}, {"sender": "them", "text": "同一人连续发送的气泡2", "textTranslationZh": "中文翻译或空字符串"}, {"sender": "char", "text": "Char 的自然回复", "textTranslationZh": "中文翻译或空字符串"}]}
    ]
  },
  "altAccount": {
    "name": "符合隐藏身份的小号名",
    "nameTranslationZh": "中文翻译或空字符串",
    "chats": [
      {"kind": "memo", "contactName": "备忘录", "messages": [{"sender": "char", "text": "私人记录气泡1", "textTranslationZh": "中文翻译或空字符串"}, {"sender": "char", "text": "私人记录气泡2", "textTranslationZh": "中文翻译或空字符串"}]},
      {"kind": "file_transfer", "contactName": "文件传输助手", "messages": [{"sender": "char", "text": "[图片] 私密收藏气泡1", "textTranslationZh": "中文翻译或空字符串"}, {"sender": "char", "text": "相关说明气泡2", "textTranslationZh": "中文翻译或空字符串"}]},
      {"contactName": "符合小号身份的简体中文联系人名", "messages": [{"sender": "them", "text": "承接话题的气泡", "textTranslationZh": "中文翻译或空字符串"}, {"sender": "char", "text": "自然回复", "textTranslationZh": "中文翻译或空字符串"}]}
    ]
  }
}`,
                    safari: `"safari": {\n  "recentSearches": [\n    {"keyword": "搜索关键词1", "keywordTranslationZh": "中文翻译或空字符串", "title": "网页标题1", "titleTranslationZh": "中文翻译或空字符串", "content": "网页内容(如知乎,百度百科等真实浏览器内容50-100字)", "contentTranslationZh": "中文翻译或空字符串"}\n  ],\n  "privateSearches": [\n    {"keyword": "无痕搜索词1", "keywordTranslationZh": "中文翻译或空字符串", "title": "无痕网页标题1", "titleTranslationZh": "中文翻译或空字符串", "content": "隐私搜索详情内容(50-100字)", "contentTranslationZh": "中文翻译或空字符串"}\n  ]\n}`,
                    files: `"files": {\n  "tags": [\n    {"name": "新标签名称，不限制语言", "color": "#ff3b30", "items": [{"title": "新文件名，不限制语言", "content": "一段极度符合人设的私密内容(50-100字)", "contentTranslationZh": "中文翻译或空字符串"}]}\n  ]\n}`,
                    call: `"call": {\n  "recentCalls": [\n    {"name": "简体中文联系人名", "type": "incoming/outgoing/missed", "dialogue": "通话内容原文", "dialogueTranslationZh": "中文翻译或空字符串"}\n  ],\n  "contacts": [\n    {"name": "简体中文联系人名", "callReason": "通话原因原文", "callReasonTranslationZh": "中文翻译或空字符串"}\n  ]\n}`,
                    music: `"music": {\n  "recent": [{"name": "歌曲真实官方歌名（保留原本语言）", "artist": "歌手1", "artistTranslationZh": "中文翻译或空字符串"}],\n  "favorites": [{"name": "歌曲真实官方歌名（保留原本语言）", "artist": "最爱歌手1", "artistTranslationZh": "中文翻译或空字符串"}],\n  "top": [{"name": "歌曲真实官方歌名（保留原本语言）", "artist": "歌手1", "artistTranslationZh": "中文翻译或空字符串", "loops": 156, "thoughts": "听这首歌时的内心情感与心声，要非常符合人设且细腻，不少于30字", "thoughtsTranslationZh": "中文翻译或空字符串"}]\n}`,
                    health: `"health": {\n  "steps": "步数纯数字",\n  "stepsThoughts": "跑步或运动时的心理活动，约30字",\n  "stepsThoughtsTranslationZh": "中文翻译或空字符串",\n  "sleepHours": "睡眠小时数纯数字",\n  "sleepMinutes": "睡眠分钟数纯数字",\n  "dream": "昨夜梦境内容，约30字",\n  "dreamTranslationZh": "中文翻译或空字符串",\n  "heartRate": "当前心率纯数字BPM",\n  "heartRateStatus": "符合心率与角色状态的简短描述",\n  "heartRateStatusTranslationZh": "中文翻译或空字符串",\n  "weight": "体重",\n  "height": "身高"\n}`,
                    pay: `"pay": {\n  "totalAssets": "24560.88",\n  "recentTransactions": [\n    {"title": "交易标题原文", "titleTranslationZh": "中文翻译或空字符串", "amount": "-128.00", "isIncome": false}\n  ]\n}`,
                    game: `"game": {\n  "playerName": "正常游戏内 ID，不限制语言",\n  "totalHours": "200小时",\n  "recentGames": [\n    {"name": "正常游戏名，不限制语言", "hours": "50小时", "rank": "正常段位，不限制语言", "winRate": "65%", "icon": "fas fa-gamepad", "matches": [\n      {"result": "正常对局结果，不限制语言", "kda": "8/2/5", "hero": "正常英雄名，不限制语言", "highlights": [{"desc": "高光描述原文", "descTranslationZh": "中文翻译或空字符串"}], "innerThoughts": "局内心声原文", "innerThoughtsTranslationZh": "中文翻译或空字符串", "postGameReflection": "复盘原文", "postGameReflectionTranslationZh": "中文翻译或空字符串"}\n    ]}\n  ]\n}`,
                    weibo: `"weibo": {\n  "mainAccount": {\n    "name": "大号昵称，不限制语言",\n    "signature": "符合 Char 公开形象的签名，不限制语言",\n    "posts": [\n      {"text": "自然且各不相同的大号帖子正文", "textTranslationZh": "中文翻译或空字符串", "source": "真实来源，不限制语言", "comments": [{"author": "评论用户名，不限制语言", "text": "贴合该帖语境的评论", "textTranslationZh": "中文翻译或空字符串"}], "reposts": 6, "likes": 128}\n    ],\n    "album": [\n      {"description": "具体且不重复的图片主体、场景、构图和质感描述20-50字，不限制语言"}\n    ],\n    "liked": [\n      {"author": "被赞博主名，不限制语言", "text": "符合大号公开兴趣的赞过帖子", "textTranslationZh": "中文翻译或空字符串", "source": "真实来源，不限制语言", "comments": [], "reposts": 12, "likes": 241}\n    ]\n  },\n  "altAccount": {\n    "name": "符合隐藏身份的小号名，不限制语言",\n    "signature": "符合小号隐秘状态的签名，不限制语言",\n    "avatarUrl": "",\n    "posts": [\n      {"text": "符合隐藏身份且主题自然多样的小号帖子正文", "textTranslationZh": "中文翻译或空字符串", "source": "真实来源，不限制语言", "comments": [{"author": "评论用户名，不限制语言", "text": "贴合该帖语境的评论", "textTranslationZh": "中文翻译或空字符串"}], "reposts": 1, "likes": 19}\n    ],\n    "album": [\n      {"description": "符合小号状态且与其他照片不同的具体画面描述20-50字，不限制语言"}\n    ],\n    "liked": [\n      {"author": "被赞博主名，不限制语言", "text": "符合小号隐秘兴趣的赞过帖子", "textTranslationZh": "中文翻译或空字符串", "source": "真实来源，不限制语言", "comments": [], "reposts": 2, "likes": 33}\n    ]\n  }\n}`
                };

                prompt += `\n【各应用生成要求】：\n`;
                selectedApps.forEach(app => {
                    prompt += requirementParts[app] + `\n`;
                });

                prompt += `\n请包含以下字段（根据选择包含对应的对象）：\n{\n`;
                let selectedPrompts = selectedApps.map(app => promptParts[app]).join(",\n")
                    .replace(/"(?:time|date|createdAt|timestamp|addedTime|recentCallTime)"\s*:\s*"[^"]*"\s*,?/g, '');
                prompt += selectedPrompts + `\n}`;

                prompt += `\n注意：必须且只能返回合法的 JSON 字符串，不要包含任何多余的文字说明，不要 Markdown 标记。确保 JSON 格式绝对正确，键名和字符串都使用双引号。`;
                
                if (window.showToast) window.showToast('正在生成符合设定的数据，请稍候...');
                
                const messages = [
                    { role: "system", content: "你是一个数据生成助手。只能返回合法的 JSON 字符串。" },
                    { role: "user", content: prompt }
                ];
                
                const model = window.apiConfig.model || 'gpt-3.5-turbo';
                
                const endpoint = window.u2Api.resolveChatCompletionsEndpoint(window.apiConfig.endpoint);

                fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + window.apiConfig.apiKey
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: messages,
                        temperature: 0.7
                    })
                })
                .then(async response => {
                    if (!response.ok) {
                        let errorMsg = `HTTP error! status: ${response.status}`;
                        try {
                            const errorBody = await response.text();
                            console.error('API Error Response Body:', errorBody);
                            const errorObj = JSON.parse(errorBody);
                            if (errorObj.error && errorObj.error.message) {
                                errorMsg = errorObj.error.message;
                            } else {
                                errorMsg += ` - ${errorBody}`;
                            }
                        } catch(e) {
                            // ignore
                        }
                        throw new Error(errorMsg);
                    }
                    return response.json();
                })
                .then(data => {
                    let resultText = data.choices?.[0]?.message?.content || "";
                    
                    // 防御性处理：使用正则表达式尝试提取可能被文字包裹的 JSON 结构
                    let jsonStr = resultText;
                    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        jsonStr = jsonMatch[0];
                    } else {
                        // 兜底正则移除 markdown
                        jsonStr = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
                    }

                    try {
                        const parsed = JSON.parse(jsonStr);
                        const missingApps = selectedApps.filter(app => !parsed?.[app] || typeof parsed[app] !== 'object');
                        if (missingApps.length) throw new Error(`缺少应用数据：${missingApps.join('、')}`);
                        const requireCount = (items, expected, label) => {
                            if (!Array.isArray(items) || items.length !== expected) throw new Error(`${label} 数量必须为 ${expected}`);
                        };
                        const requireRange = (items, min, max, label) => {
                            if (!Array.isArray(items) || items.length < min || items.length > max) throw new Error(`${label} 数量必须为 ${min}-${max}`);
                        };
                        if (parsed.music) requireCount(parsed.music.top, genCounts.musicTop, '音乐排行');
                        if (parsed.safari) {
                            requireCount(parsed.safari.recentSearches, safariSplit.primary, 'Safari 公开搜索');
                            requireCount(parsed.safari.privateSearches, safariSplit.secondary, 'Safari 无痕搜索');
                        }
                        if (parsed.game) requireCount(parsed.game.recentGames, genCounts.gameTotal, '游戏');
                        if (parsed.call) requireCount(parsed.call.recentCalls, genCounts.callTotal, '通话记录');
                        if (parsed.imessage) {
                            requireCount(parsed.imessage.mainAccount?.chats, genCounts.imessageMain, 'iMessage 主号会话');
                            requireCount(parsed.imessage.altAccount?.chats, genCounts.imessageAlt, 'iMessage 小号会话');
                            [...parsed.imessage.mainAccount.chats, ...parsed.imessage.altAccount.chats].forEach(chat => {
                                if (chat && typeof chat === 'object') chat.messages = this.normalizeFriendPhoneChatMessages(chat.messages, 5);
                            });
                            parsed.imessage.mainAccount.chats.forEach((chat, index) => requireRange(chat?.messages, 1, 5, `iMessage 主号会话 ${index + 1} 消息`));
                            parsed.imessage.altAccount.chats.forEach((chat, index) => {
                                const fixedName = String(chat?.contactNameTranslationZh || chat?.contactName || '').trim();
                                requireRange(chat?.messages, 1, 5, `iMessage ${fixedName || `小号会话 ${index + 1}`} 消息`);
                            });
                        }
                        if (parsed.weibo) {
                            requireCount(parsed.weibo.mainAccount?.posts, weiboPostSplit.primary, '微博大号帖子');
                            requireCount(parsed.weibo.altAccount?.posts, weiboPostSplit.secondary, '微博小号帖子');
                            requireCount(parsed.weibo.mainAccount?.album, weiboPhotoSplit.primary, '微博大号相册');
                            requireCount(parsed.weibo.altAccount?.album, weiboPhotoSplit.secondary, '微博小号相册');
                            requireCount(parsed.weibo.mainAccount?.liked, 3, '微博大号赞过');
                            requireCount(parsed.weibo.altAccount?.liked, 3, '微博小号赞过');
                            parsed.weibo.mainAccount.posts = this.normalizeFriendPhoneWeiboPostComments(parsed.weibo.mainAccount.posts, 5);
                            parsed.weibo.altAccount.posts = this.normalizeFriendPhoneWeiboPostComments(parsed.weibo.altAccount.posts, 5);
                        }
                        if (parsed.files) {
                            requireRange(parsed.files.tags, 2, 3, '文件标签');
                            parsed.files.tags.forEach((tag, index) => requireRange(tag?.items, 1, 3, `文件标签 ${index + 1}`));
                        }
                        if (parsed.pay) requireRange(parsed.pay.recentTransactions, 5, 50, '钱包交易');
                        this.validateFriendPhoneLocalizedTree(parsed, friend.language || 'zh', 'phone');
                        const generationDraft = {};
                        
                        // 先规范化到独立草稿，全部成功后再原子合并到好友数据。
                        if (parsed.music) {
                            generationDraft.musicData = {
                                recent: Array.isArray(parsed.music.recent) ? parsed.music.recent : [],
                                favorites: Array.isArray(parsed.music.favorites) ? parsed.music.favorites : [],
                                top: Array.isArray(parsed.music.top) ? parsed.music.top.slice(0, genCounts.musicTop) : []
                            };
                        }
                        if (parsed.health) {
                            generationDraft.healthData = parsed.health;
                        }
                        if (parsed.pay) {
                            generationDraft.payData = {
                                ...parsed.pay,
                                recentTransactions: Array.isArray(parsed.pay.recentTransactions) ? parsed.pay.recentTransactions : []
                            };
                        }
                        if (parsed.game) {
                            generationDraft.gameData = {
                                ...parsed.game,
                                recentGames: Array.isArray(parsed.game.recentGames) ? parsed.game.recentGames.slice(0, genCounts.gameTotal) : []
                            };
                        }
                        if (parsed.call) {
                            generationDraft.callData = {
                                ...parsed.call,
                                recentCalls: Array.isArray(parsed.call.recentCalls) ? parsed.call.recentCalls.slice(0, genCounts.callTotal) : [],
                                contacts: Array.isArray(parsed.call.contacts) ? parsed.call.contacts : []
                            };
                        }
                        if (parsed.safari) {
                            generationDraft.safariData = {
                                recentSearches: Array.isArray(parsed.safari.recentSearches) ? parsed.safari.recentSearches.slice(0, safariSplit.primary) : [],
                                privateSearches: Array.isArray(parsed.safari.privateSearches) ? parsed.safari.privateSearches.slice(0, safariSplit.secondary) : []
                            };
                        }
                        if (parsed.files) {
                            generationDraft.filesData = {
                                ...parsed.files,
                                tags: Array.isArray(parsed.files.tags) ? parsed.files.tags : [],
                                recent: Array.isArray(parsed.files.recent) ? parsed.files.recent : []
                            };
                        }
                        if (parsed.weibo) {
                            const rawWeibo = parsed.weibo || {};
                            const ensureAccount = (rawAccount, accountKey) => {
                                const isAltAccount = accountKey === 'altAccount';
                                const normalized = this.normalizeWeiboAccount(rawAccount || {}, friend, accountKey === 'altAccount' ? 'alt' : 'main');
                                const postLimit = isAltAccount ? weiboPostSplit.secondary : weiboPostSplit.primary;
                                const photoLimit = isAltAccount ? weiboPhotoSplit.secondary : weiboPhotoSplit.primary;
                                normalized.posts = normalized.posts.slice(0, postLimit);
                                normalized.album = normalized.album.slice(0, photoLimit).map((item, index) => ({
                                    ...item,
                                    url: item.url || this.getWeiboRandomImage(friend, index, isAltAccount ? 'alt' : 'main')
                                }));
                                normalized.liked = normalized.liked.slice(0, 3);
                                if (isAltAccount && !normalized.avatarUrl) {
                                    normalized.avatarUrl = this.getWeiboRandomAvatar(friend);
                                }
                                return normalized;
                            };
                            generationDraft.weiboData = {
                                mainAccount: ensureAccount(rawWeibo.mainAccount || rawWeibo.main || rawWeibo, 'mainAccount'),
                                altAccount: ensureAccount(rawWeibo.altAccount || rawWeibo.alt || {}, 'altAccount')
                            };
                        }
                        if (parsed.imessage) {
                            const normalizeChats = (chats, limit, isAlt = false) => {
                                const sourceChats = Array.isArray(chats) ? chats : [];
                                const fixedNameOf = chat => String(chat?.contactNameTranslationZh || chat?.contactName || '').trim();
                                const orderedChats = isAlt
                                    ? [
                                        sourceChats.find(chat => fixedNameOf(chat) === '备忘录'),
                                        sourceChats.find(chat => fixedNameOf(chat) === '文件传输助手'),
                                        ...sourceChats.filter(chat => !['备忘录', '文件传输助手'].includes(fixedNameOf(chat)))
                                    ].filter(Boolean)
                                    : sourceChats;
                                return orderedChats.slice(0, limit)
                                .map(chat => ({
                                    ...chat,
                                    messages: this.normalizeFriendPhoneChatMessages(chat?.messages, 5)
                                }));
                            };
                            generationDraft.imessageData = {
                                mainAccount: {
                                    ...(parsed.imessage.mainAccount || {}),
                                    chats: normalizeChats(parsed.imessage.mainAccount?.chats, genCounts.imessageMain)
                                },
                                altAccount: {
                                    name: parsed.imessage.altAccount?.name || '小号',
                                    ...(parsed.imessage.altAccount || {}),
                                    chats: normalizeChats(parsed.imessage.altAccount?.chats, genCounts.imessageAlt, true)
                                }
                            };
                        }
                        const normalizedPayload = {};
                        if (generationDraft.musicData) normalizedPayload.music = generationDraft.musicData;
                        if (generationDraft.healthData) normalizedPayload.health = generationDraft.healthData;
                        if (generationDraft.payData) normalizedPayload.pay = generationDraft.payData;
                        if (generationDraft.gameData) normalizedPayload.game = generationDraft.gameData;
                        if (generationDraft.callData) normalizedPayload.call = generationDraft.callData;
                        if (generationDraft.safariData) normalizedPayload.safari = generationDraft.safariData;
                        if (generationDraft.filesData) normalizedPayload.files = generationDraft.filesData;
                        if (generationDraft.weiboData) normalizedPayload.weibo = generationDraft.weiboData;
                        if (generationDraft.imessageData) normalizedPayload.imessage = generationDraft.imessageData;
                        const mergedGeneration = this.mergeFriendPhoneGeneratedData(friend, normalizedPayload, { generatedAt: Date.now(), skipValidation: true });
                        Object.assign(friend, mergedGeneration.next);
                        
                        this.persistFriendState(friend);
                        
                        if (window.showToast) window.showToast('生成成功！请返回桌面重新进入 App 查看');
                        
                        // 强制刷新并关闭弹窗
                        if (window.closeView) {
                            window.closeView(settingsSheet);
                            const phoneView = document.getElementById('lovers-friend-phone-view');
                            if (phoneView) window.closeView(phoneView);
                        }
                    } catch (e) {
                        console.error('JSON Parse error', e, '\nOriginal Text:', resultText, '\nExtracted:', jsonStr);
                        if (window.showToast) window.showToast('生成数据解析失败，AI可能输出了非标准JSON格式，请重试');
                    }
                })
                .catch(err => {
                    console.error('API Error:', err);
                    let displayMsg = err.message || '未知网络错误';
                    if (displayMsg.length > 50) {
                        displayMsg = displayMsg.substring(0, 50) + '...'; // 防止超长报错撑爆 toast
                    }
                    if (window.showToast) window.showToast('API 请求失败: ' + displayMsg);
                    else alert('API 请求失败: ' + displayMsg);
                });
            };
        }

        const bgUpload = document.getElementById('friend-phone-bg-upload');
        if (bgUpload) {
            bgUpload.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        friend.phoneBg = ev.target.result;
                        this.persistFriendState(friend);
                        phoneView.style.backgroundImage = `url(${friend.phoneBg})`;
                        if (window.showToast) window.showToast('已更换 TA 的主屏幕背景');
                        if (window.closeView) window.closeView(settingsSheet);
                    };
                    reader.readAsDataURL(file);
                }
            };
        }

        const bgResetBtn = document.getElementById('friend-phone-bg-reset-btn');
        if (bgResetBtn) {
            bgResetBtn.onclick = async () => {
                friend.phoneBg = '';
                phoneView.style.backgroundImage = 'url("assets/bizhi.jpg")';
                if (bgUpload) bgUpload.value = '';
                await this.persistFriendState(friend);
                if (window.showToast) window.showToast('已恢复默认背景');
            };
        }
        
        this.currentFriend = friend;
        
        // 绑定 iMessage
        const imsgBtn = document.getElementById('friend-phone-app-imessage');
        const imsgView = document.getElementById('friend-imessage-view');
        if (imsgBtn && imsgView) {
            imsgBtn.onclick = async () => {
                this.currentImsgAccount = 'main';
                const messageFriend = await this.ensureFriendPhoneMessagesLoaded(friend);
                this.currentFriend = messageFriend;
                this.renderFriendImsg(messageFriend);
                if (window.openView) window.openView(imsgView);
            };
        }
        
        const switchBtn = document.getElementById('friend-imsg-switch-account-btn');
        const accountModal = document.getElementById('friend-imsg-account-modal');
        if (switchBtn && accountModal) {
            switchBtn.onclick = () => {
                const listEl = document.getElementById('friend-imsg-accounts-list');
                if (listEl) {
                    const mainName = friend.nickname || friend.realname || 'TA';
                    let altName = '小号';
                    let hasAlt = false;
                    if (friend.imessageData && !Array.isArray(friend.imessageData) && friend.imessageData.altAccount) {
                        altName = friend.imessageData.altAccount.name || '小号';
                        hasAlt = true;
                    }

                    listEl.innerHTML = `
                        <div style="padding: 15px 16px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; justify-content: space-between; cursor: pointer;" onclick="window.lovesApp.switchImsgAccount('main', true)">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="width: 40px; height: 40px; border-radius: 50%; background: #e5e5ea; display: flex; justify-content: center; align-items: center; color: #8e8e93;"><i class="fas fa-user"></i></div>
                                <span style="font-size: 16px; font-weight: 500; color: #000;">${mainName} (主账号)</span>
                            </div>
                            ${this.currentImsgAccount === 'main' ? '<i class="fas fa-check" style="color: #007aff;"></i>' : ''}
                        </div>
                        ${hasAlt ? `
                        <div style="padding: 15px 16px; display: flex; align-items: center; justify-content: space-between; cursor: pointer;" onclick="window.lovesApp.switchImsgAccount('alt', true)">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="width: 40px; height: 40px; border-radius: 50%; background: #e5e5ea; display: flex; justify-content: center; align-items: center; color: #8e8e93;"><i class="fas fa-user-secret"></i></div>
                                <span style="font-size: 16px; font-weight: 500; color: #000;">${altName} (小号)</span>
                            </div>
                            ${this.currentImsgAccount === 'alt' ? '<i class="fas fa-check" style="color: #007aff;"></i>' : ''}
                        </div>
                        ` : `
                        <div style="padding: 15px 16px; display: flex; align-items: center; justify-content: center; color: #8e8e93; font-size: 14px;">
                            暂无小号数据，请在生成设置中重新生成
                        </div>
                        `}
                    `;
                }
                if (window.openView) window.openView(accountModal);
            };
        }
        
        const imsgBackBtn = document.getElementById('friend-imsg-back-btn');
        if (imsgBackBtn) imsgBackBtn.onclick = () => { if (window.closeView) window.closeView(imsgView); };

        // 绑定 Files (文件)
        const filesBtn = document.getElementById('friend-phone-app-files');
        const filesView = document.getElementById('friend-files-view');
        
        // 全局事件代理绑定最近删除按钮，避免重复绑定和闭包问题，并确保点击能被捕获
        const filesRecentlyDeletedView = document.getElementById('friend-files-recently-deleted-view');
        const filesRecentlyDeletedBackBtn = document.getElementById('friend-files-recently-deleted-back-btn');
        const filesRecentlyDeletedList = document.getElementById('friend-files-recently-deleted-list');

        // 只在未绑定过时绑定，通过标识位防止重复绑定
        if (!window.lovesApp._filesRecentlyDeletedBound) {
            document.addEventListener('click', (e) => {
                const targetBtn = e.target.closest('#filesRecentlyDeletedBtn');
                if (targetBtn && filesRecentlyDeletedView) {
                    if (window.openView) window.openView(filesRecentlyDeletedView);
                    
                    const activeFriend = window.lovesApp.currentFriend;
                    
                    if (filesRecentlyDeletedList) {
                        if (activeFriend && activeFriend.filesData && activeFriend.filesData.recentlyDeleted && activeFriend.filesData.recentlyDeleted.length > 0) {
                            filesRecentlyDeletedList.innerHTML = activeFriend.filesData.recentlyDeleted.map(item => `
                                <div style="background: #fff; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; align-items: center;  position: relative; cursor: pointer;">
                                    <div style="width: 100%; aspect-ratio: 1; background: #f2f2f7; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: center; align-items: center; color: #8e8e93; font-size: 30px;">
                                        ${item.type === 'image' ? '<i class="fas fa-image"></i>' : '<i class="far fa-file-alt"></i>'}
                                    </div>
                                    <div style="font-size: 13px; font-weight: 500; color: #111; text-align: center; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</div>
                                    <div style="font-size: 11px; color: #8e8e93; margin-top: 4px;">${item.size || '未知大小'}</div>
                                    <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.5); color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 6px;">${item.daysLeft || '30'}天</div>
                                </div>
                            `).join('');
                        } else {
                            filesRecentlyDeletedList.innerHTML = `<div style="grid-column: span 3; text-align: center; color: #8e8e93; padding: 40px 0;">最近删除为空</div>`;
                        }
                    }
                }
            });
            
            if (filesRecentlyDeletedBackBtn && filesRecentlyDeletedView) {
                filesRecentlyDeletedBackBtn.addEventListener('click', () => {
                    if (window.closeView) window.closeView(filesRecentlyDeletedView);
                });
            }
            window.lovesApp._filesRecentlyDeletedBound = true;
        }

        if (filesBtn && filesView) {
            filesBtn.onclick = () => {
                if (window.openView) window.openView(filesView);

                const tagsList = document.getElementById('friend-files-tags-list');
                if (tagsList) {
                    if (friend.filesData && friend.filesData.tags) {
                        tagsList.innerHTML = friend.filesData.tags.map((tag, tagIdx) => {
                            const itemsHtml = tag.items ? tag.items.map((item, itemIdx) => {
                                const itemStr = encodeURIComponent(JSON.stringify(item));
                                return `
                                    <div class="file-item-clickable" data-item="${itemStr}" style="display: flex; align-items: center; padding: 12px 15px; border-top: 1px solid #f0f0f0; cursor: pointer; background: #fff;">
                                        <i class="far fa-file-alt" style="color: #8e8e93; font-size: 18px; margin-right: 12px;"></i>
                                        <span style="font-size: 16px; color: #111; flex: 1;">${this.escapeHTML(item.title || '未命名文件')}${this.renderFriendPhoneGeneratedTime(item)}</span>
                                        <i class="fas fa-chevron-right" style="color: #c7c7cc; font-size: 14px;"></i>
                                    </div>
                                `;
                            }).join('') : '';

                            return `
                                <div style="border-radius: 12px; overflow: hidden;  margin-bottom: 10px;">
                                    <div style="display: flex; align-items: center; padding: 12px 15px; background: #fff;">
                                        <div style="width: 12px; height: 12px; border-radius: 50%; background: ${tag.color || '#ff9500'}; margin-right: 12px;"></div>
                                        <span style="font-size: 17px; font-weight: 600; color: #111; flex: 1;">${this.escapeHTML(tag.name || '未命名标签')}</span>
                                    </div>
                                    ${itemsHtml}
                                </div>
                            `;
                        }).join('');
                        
                        setTimeout(() => {
                            const fileItems = tagsList.querySelectorAll('.file-item-clickable');
                            fileItems.forEach(el => {
                                el.addEventListener('click', function(e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    try {
                                        const item = JSON.parse(decodeURIComponent(this.getAttribute('data-item')));
                                        window.lovesApp.showDetailModal(item.title, `<div style="white-space: pre-wrap; font-size: 15px; line-height: 1.6; color: #333;">${window.lovesApp.renderFriendPhoneLocalized(item, 'content', { id: 'file-content' })}</div>${window.lovesApp.renderFriendPhoneGeneratedTime(item)}`);
                                    } catch (err) {
                                        console.error('File item parse error', err);
                                    }
                                });
                                window.lovesApp.bindLongPress(el, function() {
                                    try {
                                        const item = JSON.parse(decodeURIComponent(el.getAttribute('data-item')));
                                        window.lovesApp.showDeleteConfirm(item.title, () => {
                                            if (friend.filesData && friend.filesData.tags) {
                                                friend.filesData.tags.forEach(tag => {
                                                    if (tag.items) {
                                                        const idx = tag.items.findIndex(i => i.title === item.title && i.content === item.content);
                                                        if (idx !== -1) tag.items.splice(idx, 1);
                                                    }
                                                });
                                                filesBtn.onclick();
                                            }
                                        });
                                    } catch(e) {}
                                });
                            });
                        }, 50);
                    } else {
                        tagsList.innerHTML = '<div style="padding: 30px; text-align: center; color: #8e8e93; font-size: 14px;">暂无文件数据<br><span style="font-size: 12px; margin-top: 5px; display: inline-block;">请在设置中生成</span></div>';
                    }
                }
            };
        }
        const filesBackBtn = document.getElementById('friend-files-back-btn');
        if (filesBackBtn) filesBackBtn.onclick = () => { if (window.closeView) window.closeView(filesView); };

        // 绑定 Safari
        const safariBtn = document.getElementById('friend-phone-app-safari');
        const safariView = document.getElementById('friend-safari-view');
        if (safariBtn && safariView) {
            safariBtn.onclick = () => {
                if (window.openView) window.openView(safariView);
                
                const topbar = document.getElementById('friend-safari-topbar');
                const searchBar = document.getElementById('friend-safari-search-bar');
                const backBtnIcon = document.getElementById('friend-safari-back-btn');
                const normalMode = document.getElementById('friend-safari-normal-mode');
                const privateMode = document.getElementById('friend-safari-private-mode');
                const dock = document.getElementById('friend-safari-dock');
                const privateToggleBtn = document.getElementById('friend-safari-private-btn');

                // State
                let isPrivateMode = false;

                if (privateToggleBtn) {
                    privateToggleBtn.onclick = () => {
                        isPrivateMode = !isPrivateMode;
                        
                        if (isPrivateMode) {
                            safariView.style.background = '#000';
                            topbar.style.background = '#000';
                            searchBar.style.background = '#1c1c1e';
                            searchBar.style.color = '#8e8e93';
                            backBtnIcon.style.color = '#fff';
                            dock.style.background = 'rgba(0,0,0,0.95)';
                            dock.style.color = '#fff';
                            dock.style.borderTop = '1px solid transparent'; // 移除无痕白线
                            
                            normalMode.style.opacity = '0';
                            normalMode.style.pointerEvents = 'none';
                            normalMode.style.transform = 'translateY(-20px)';
                            
                            privateMode.style.opacity = '1';
                            privateMode.style.pointerEvents = 'auto';
                            privateMode.style.transform = 'translateY(0)';
                        } else {
                            safariView.style.background = '#f4f4f5';
                            topbar.style.background = '#f4f4f5';
                            searchBar.style.background = '#e5e5ea';
                            searchBar.style.color = '#8e8e93';
                            backBtnIcon.style.color = '#111';
                            dock.style.background = 'rgba(255,255,255,0.95)';
                            dock.style.color = '#111';
                            dock.style.borderTop = '1px solid #f0f0f0'; // 恢复普通模式白线
                            
                            privateMode.style.opacity = '0';
                            privateMode.style.pointerEvents = 'none';
                            privateMode.style.transform = 'translateY(20px)';
                            
                            normalMode.style.opacity = '1';
                            normalMode.style.pointerEvents = 'auto';
                            normalMode.style.transform = 'translateY(0)';
                        }
                    };
                }

                const historyList = document.getElementById('friend-safari-history-list');
                const privateHistoryList = document.getElementById('friend-safari-private-history-list');

                if (historyList) {
                    if (friend.safariData && friend.safariData.recentSearches) {
                        historyList.innerHTML = friend.safariData.recentSearches.map((s, idx) => {
                            let text = typeof s === 'string' ? s : (s.keyword || '未知搜索');
                            return `
                        <div class="safari-history-item-new" data-idx="${idx}" style="display: flex; align-items: center; gap: 15px; padding: 16px 0; border-bottom: 1px solid rgba(0,0,0,0.04); cursor: pointer;">
                            <i class="fas fa-search" style="color: #c7c7cc; font-size: 14px; pointer-events: none;"></i>
                            <span style="font-size: 16px; color: #111; font-weight: 500; flex:1;">${this.escapeHTML(text)}${typeof s === 'object' ? this.renderFriendPhoneGeneratedTime(s) : ''}</span>
                        </div>
                        `}).join('');

                        setTimeout(() => {
                            try {
                                const items = historyList.querySelectorAll('.safari-history-item-new');
                                items.forEach(el => {
                                    el.addEventListener('click', function(e) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const idx = this.getAttribute('data-idx');
                                        const s = friend.safariData.recentSearches[idx];
                                        if (typeof s === 'object' && s.title && s.content) {
                                            window.lovesApp.showBrowserDetailModal(s.title, s.content, false, s);
                                        } else {
                                            window.lovesApp.showBrowserDetailModal('搜索记录', '无更多详情', false);
                                        }
                                    });
                                    window.lovesApp.bindLongPress(el, function() {
                                        const idx = el.getAttribute('data-idx');
                                        const s = friend.safariData.recentSearches[idx];
                                        const text = typeof s === 'string' ? s : (s.keyword || '未知搜索');
                                        window.lovesApp.showDeleteConfirm(text, () => {
                                            friend.safariData.recentSearches.splice(idx, 1);
                                            safariBtn.onclick(); // 重新渲染
                                        });
                                    });
                                });
                            } catch(err) {
                                console.error('Safari normal bind error', err);
                            }
                        }, 50);
                    } else {
                        historyList.innerHTML = '<div style="padding: 30px; text-align: center; color: #8e8e93; font-size: 14px;">暂无搜索数据<br><span style="font-size: 12px; margin-top: 5px; display: inline-block;">请在设置中生成</span></div>';
                    }
                }

                // 渲染无痕模式列表
                if (privateHistoryList) {
                    if (friend.safariData && friend.safariData.privateSearches) {
                        privateHistoryList.innerHTML = friend.safariData.privateSearches.map((s, idx) => {
                            let text = typeof s === 'string' ? s : (s.keyword || '未知记录');
                            return `
                        <div class="safari-private-item-new" data-idx="${idx}" style="display: flex; align-items: center; gap: 15px; padding: 16px 0; border-bottom: 1px solid rgba(255,255,255,0.1); cursor: pointer;">
                            <i class="fas fa-search" style="color: #666; font-size: 14px; pointer-events: none;"></i>
                            <span style="font-size: 16px; color: #fff; font-weight: 500; flex:1;">${this.escapeHTML(text)}${typeof s === 'object' ? this.renderFriendPhoneGeneratedTime(s, 'is-dark') : ''}</span>
                        </div>
                        `}).join('');

                        setTimeout(() => {
                            try {
                                const items = privateHistoryList.querySelectorAll('.safari-private-item-new');
                                items.forEach(el => {
                                    el.addEventListener('click', function(e) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const idx = this.getAttribute('data-idx');
                                        const s = friend.safariData.privateSearches[idx];
                                        if (typeof s === 'object' && s.title && s.content) {
                                            window.lovesApp.showBrowserDetailModal(s.title, s.content, true, s);
                                        } else {
                                            window.lovesApp.showBrowserDetailModal('隐私记录', '无更多详情', true);
                                        }
                                    });
                                    window.lovesApp.bindLongPress(el, function() {
                                        const idx = el.getAttribute('data-idx');
                                        const s = friend.safariData.privateSearches[idx];
                                        const text = typeof s === 'string' ? s : (s.keyword || '未知记录');
                                        window.lovesApp.showDeleteConfirm(text, () => {
                                            friend.safariData.privateSearches.splice(idx, 1);
                                            safariBtn.onclick(); // 重新渲染
                                        });
                                    });
                                });
                            } catch(err) {
                                console.error('Safari private bind error', err);
                            }
                        }, 50);
                    } else {
                        privateHistoryList.innerHTML = '<div style="padding: 30px; text-align: center; color: #666; font-size: 14px;">暂无无痕搜索数据<br><span style="font-size: 12px; margin-top: 5px; display: inline-block;">请在设置中生成</span></div>';
                    }
                }
            };
        }
        const safariBackBtn = document.getElementById('friend-safari-back-btn');
        if (safariBackBtn) safariBackBtn.onclick = () => { if (window.closeView) window.closeView(safariView); };

        // 绑定微博
        const weiboBtn = document.getElementById('friend-phone-app-weibo');
        const weiboView = document.getElementById('friend-weibo-view');
        if (weiboBtn && weiboView) {
            weiboBtn.onclick = () => {
                this.currentWeiboAccount = 'main';
                this.renderFriendWeibo(friend);

                const tabs = Array.from(weiboView.querySelectorAll('.friend-weibo-tab'));
                const pages = document.getElementById('friend-weibo-pages');
                const setActiveWeiboTab = (activeIndex) => {
                    tabs.forEach((tab, index) => {
                        const isActive = index === activeIndex;
                        tab.style.color = isActive ? '#111' : '#777';
                        tab.style.fontWeight = isActive ? '700' : '600';
                        const line = tab.querySelector('.friend-weibo-tab-line');
                        if (line) line.style.display = isActive ? 'block' : 'none';
                    });
                };
                if (pages && tabs.length) {
                    tabs.forEach((tab, index) => {
                        tab.onclick = () => {
                            pages.scrollTo({ left: index * pages.clientWidth, behavior: 'smooth' });
                            setActiveWeiboTab(index);
                        };
                    });
                    pages.onscroll = () => {
                        const pageWidth = pages.clientWidth || 1;
                        const activeIndex = Math.max(0, Math.min(2, Math.round(pages.scrollLeft / pageWidth)));
                        setActiveWeiboTab(activeIndex);
                    };
                    pages.scrollTo({ left: 0, behavior: 'auto' });
                    setActiveWeiboTab(0);
                }

                if (window.openView) window.openView(weiboView);
            };
        }
        const weiboSwitchBtn = document.getElementById('friend-weibo-switch-account-btn');
        if (weiboSwitchBtn) {
            weiboSwitchBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const data = this.getFriendWeiboData(friend);
                if (this.currentWeiboAccount === 'main') {
                    if (!data.altAccount) {
                        if (window.showToast) window.showToast('暂无微博小号数据，请在生成设置中生成微博');
                        return;
                    }
                    this.currentWeiboAccount = 'alt';
                } else {
                    this.currentWeiboAccount = 'main';
                }
                this.renderFriendWeibo(friend);
                if (window.showToast) window.showToast(this.currentWeiboAccount === 'alt' ? '已切换到微博小号' : '已切换到微博大号');
            };
        }
        const weiboBackBtn = document.getElementById('friend-weibo-back-btn');
        if (weiboBackBtn) weiboBackBtn.onclick = () => { if (window.closeView) window.closeView(weiboView); };

        // 绑定 Music
        const musicBtn = document.getElementById('friend-phone-app-music');
        const musicView = document.getElementById('friend-music-view');
        if (musicBtn && musicView) {
            musicBtn.onclick = () => {
                if (window.openView) window.openView(musicView);
                const musicContent = document.getElementById('friend-music-content');
                if (musicContent) {
                    let musicData = friend.musicData;
                    
                    if (!musicData || !musicData.top || musicData.top.length === 0) {
                        musicContent.innerHTML = '<div style="padding: 50px 20px; text-align: center; color: #8e8e93; font-size: 15px;">暂无音乐数据<br><span style="font-size: 13px; margin-top: 8px; display: inline-block;">请在设置中生成</span></div>';
                    } else {
                        const topListHTML = (musicData.top || []).map((song, index) => `
                            <div class="music-history-item" data-idx="${index}" style="display: flex; align-items: center; gap: 15px; padding: 10px 0; border-bottom: 1px solid #f0f0f0; cursor: pointer;">
                                <div style="font-size: 16px; font-weight: 700; color: #111; width: 20px; text-align: center;">${index + 1}</div>
                                <div style="width: 50px; height: 50px; border-radius: 6px; background: #111; flex-shrink: 0; display: flex; justify-content: center; align-items: center; color: #fff;">
                                    <i class="fas fa-music"></i>
                                </div>
                                <div style="flex: 1; display: flex; flex-direction: column; pointer-events: none;">
                                    <div style="font-size: 16px; font-weight: 600; color: #111;">${this.escapeHTML(song.name || '未知歌曲')}</div>
                                    <div style="font-size: 13px; color: #8e8e93;">${this.renderFriendPhoneLocalized(song, 'artist', { id: `song-artist-${index}` })}${this.renderFriendPhoneGeneratedTime(song)}</div>
                                </div>
                                <i class="fas fa-ellipsis-v" style="color: #c7c7cc; pointer-events: none;"></i>
                            </div>
                        `).join('');

                        musicContent.innerHTML = `
                        <div style="padding: 20px 16px; background: #fff;">
                            <div style="font-size: 28px; font-weight: 800; color: #111; margin-bottom: 20px; letter-spacing: -0.5px;">音乐库</div>
                            <div style="display: flex; gap: 15px; overflow-x: auto; padding-bottom: 15px;">
                                <div style="min-width: 140px; display: flex; flex-direction: column; gap: 10px;">
                                    <div style="width: 140px; height: 140px; border-radius: 12px; background: #f4f4f5; display: flex; justify-content: center; align-items: center; color: #111; font-size: 30px; ">
                                        <i class="fas fa-history"></i>
                                    </div>
                                    <div style="font-size: 15px; font-weight: 700; color: #111;">最近播放</div>
                                    <div style="font-size: 13px; color: #8e8e93;">${musicData.recent ? musicData.recent.length : 0} 首歌曲</div>
                                </div>
                                <div style="min-width: 140px; display: flex; flex-direction: column; gap: 10px;">
                                    <div style="width: 140px; height: 140px; border-radius: 12px; background: #111; display: flex; justify-content: center; align-items: center; color: #fff; font-size: 30px; ">
                                        <i class="fas fa-heart"></i>
                                    </div>
                                    <div style="font-size: 15px; font-weight: 700; color: #111;">最爱</div>
                                    <div style="font-size: 13px; color: #8e8e93;">${musicData.favorites ? musicData.favorites.length : 0} 首歌曲</div>
                                </div>
                            </div>
                        </div>
                        <div style="padding: 10px 16px 30px; background: #fff; border-top: 1px solid #f0f0f0;">
                            <div style="font-size: 22px; font-weight: 700; color: #111; margin-bottom: 15px; margin-top: 10px;">听歌排行</div>
                            <div style="display: flex; flex-direction: column; gap: 5px;">
                                ${topListHTML}
                            </div>
                        </div>
                        `;
                    }

                    setTimeout(() => {
                        try {
                            const items = musicContent.querySelectorAll('.music-history-item');
                            items.forEach(el => {
                                el.addEventListener('click', function(e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const idx = this.getAttribute('data-idx');
                                    const song = musicData.top[idx];
                                    
                                    const loops = parseInt(song.loops) || Math.floor(Math.random() * 100) + 10;
                                    const thoughts = song.thoughts || '这首歌旋律很好听，每次听都能让我安静下来。';
                                    
                                    const content = `
                                        <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 20px;">
                                            <div style="width: 80px; height: 80px; border-radius: 50%; background: #111; display: flex; justify-content: center; align-items: center; color: #fff; font-size: 30px; margin-bottom: 15px; ">
                                                <i class="fas fa-compact-disc"></i>
                                            </div>
                                            <div style="font-size: 22px; font-weight: 800; color: #111; margin-bottom: 4px;">${window.lovesApp.escapeHTML(song.name || '未知歌曲')}</div>
                                            <div style="font-size: 15px; color: #8e8e93;">${window.lovesApp.renderFriendPhoneLocalized(song, 'artist', { id: 'song-detail-artist' })}${window.lovesApp.renderFriendPhoneGeneratedTime(song)}</div>
                                        </div>
                                        
                                        <div style="background: #f4f4f5; border-radius: 16px; padding: 15px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <div style="width: 32px; height: 32px; border-radius: 8px; background: #fff; display: flex; justify-content: center; align-items: center; color: #111;">
                                                    <i class="fas fa-redo-alt" style="font-size: 14px;"></i>
                                                </div>
                                                <span style="font-size: 15px; font-weight: 600; color: #111;">循环次数</span>
                                            </div>
                                            <div style="font-size: 20px; font-weight: 800; color: #111;">${loops} <span style="font-size: 13px; font-weight: 500; color: #8e8e93;">次</span></div>
                                        </div>

                                        <div style="background: #111; border-radius: 16px; padding: 20px; border-left: 4px solid #fff;">
                                            <div style="font-weight: 700; color: #fff; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                                <i class="fas fa-headphones-alt" style="color: #fff;"></i> 听歌心声
                                            </div>
                                            <div style="color: #ccc; line-height: 1.6; font-size: 14px; font-style: italic;">
                                                “${window.lovesApp.renderFriendPhoneLocalized(song, 'thoughts', { fallback: thoughts, id: 'song-thoughts' })}”
                                            </div>
                                        </div>
                                    `;
                                    window.lovesApp.showDetailModal('单曲详情', content);
                                });
                                window.lovesApp.bindLongPress(el, function() {
                                    const idx = el.getAttribute('data-idx');
                                    const song = musicData.top[idx];
                                    window.lovesApp.showDeleteConfirm(song.name, () => {
                                        musicData.top.splice(idx, 1);
                                        musicBtn.onclick(); // 重新渲染
                                    });
                                });
                            });
                        } catch(err) {
                            console.error('Music bind error', err);
                        }
                    }, 50);
                }
            };
        }
        const musicBackBtn = document.getElementById('friend-music-back-btn');
        if (musicBackBtn) musicBackBtn.onclick = () => { if (window.closeView) window.closeView(musicView); };

        // 绑定 电话
        const callBtn = document.getElementById('friend-phone-app-call');
        const callView = document.getElementById('friend-phonecall-view');
        if (callBtn && callView) {
            callBtn.onclick = () => {
                if (window.openView) window.openView(callView);
                
                const tabRecent = document.getElementById('friend-call-tab-recent');
                const tabContacts = document.getElementById('friend-call-tab-contacts');
                const listRecent = document.getElementById('friend-call-list');
                const listContacts = document.getElementById('friend-contact-list');
                
                // Tabs toggle logic
                if (tabRecent && tabContacts && listRecent && listContacts) {
                    tabRecent.onclick = () => {
                        tabRecent.style.background = '#fff';
                        tabRecent.style.color = '#111';
                        tabRecent.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                        
                        tabContacts.style.background = 'transparent';
                        tabContacts.style.color = '#8e8e93';
                        tabContacts.style.boxShadow = 'none';
                        
                        listRecent.style.display = 'block';
                        listContacts.style.display = 'none';
                    };
                    
                    tabContacts.onclick = () => {
                        tabContacts.style.background = '#fff';
                        tabContacts.style.color = '#111';
                        tabContacts.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                        
                        tabRecent.style.background = 'transparent';
                        tabRecent.style.color = '#8e8e93';
                        tabRecent.style.boxShadow = 'none';
                        
                        listContacts.style.display = 'block';
                        listRecent.style.display = 'none';
                    };
                }

                if (listRecent && friend.callData && friend.callData.recentCalls) {
                    listRecent.innerHTML = friend.callData.recentCalls.map((c, idx) => {
                        let typeIcon = '';
                        if (c.type === 'missed') {
                            typeIcon = '<i class="fas fa-phone-slash" style="color: #ff3b30; font-size: 10px;"></i>';
                        } else if (c.type === 'outgoing') {
                            typeIcon = '<i class="fas fa-phone" style="color: #8e8e93; font-size: 10px;"></i>';
                        } else {
                            typeIcon = '<i class="fas fa-phone-alt" style="color: #8e8e93; font-size: 10px;"></i>';
                        }
                        return `
                        <div class="call-history-item-new" data-idx="${idx}" style="display: flex; align-items: center; padding: 15px 0; cursor: pointer;">
                            <div style="flex: 1; display: flex; flex-direction: column; pointer-events: none;">
                                <div style="font-size: 18px; font-weight: 600; color: ${c.type === 'missed' ? '#ff3b30' : '#111'};">${this.escapeHTML(this.getFriendPhoneChineseContactName(c))}</div>
                                <div style="font-size: 14px; color: #8e8e93; display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                                    ${typeIcon}
                                    <span>${c.type === 'missed' ? '未接来电' : '语音通话'}</span>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 15px; pointer-events: none;">
                                <span style="color: #8e8e93; font-size: 14px;">${this.escapeHTML(this.formatFriendPhoneGeneratedAt(c.generatedAt) || c.time || '')}</span>
                                <i class="fas fa-info-circle" style="color: #007aff; font-size: 22px;"></i>
                            </div>
                        </div>`;
                    }).join('');
                    
                    // Render contacts list
                    if (listContacts) {
                        const fallbackContactNames = new Set();
                        const fallbackContacts = friend.callData.recentCalls.reduce((items, call) => {
                            const chineseName = this.getFriendPhoneChineseContactName(call);
                            if (!chineseName || fallbackContactNames.has(chineseName)) return items;
                            fallbackContactNames.add(chineseName);
                            items.push({
                                name: chineseName,
                                addedTime: '未知时间',
                                recentCallTime: '近期',
                                callReason: '日常联系'
                            });
                            return items;
                        }, []);
                        const contacts = Array.isArray(friend.callData.contacts) && friend.callData.contacts.length
                            ? friend.callData.contacts
                            : fallbackContacts;
                        friend.callData._parsedContacts = contacts;

                        listContacts.innerHTML = contacts.map((contact, idx) => `
                            <div class="contact-item-new" data-idx="${idx}" style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #e5e5ea; cursor: pointer;">
                                <div style="width: 40px; height: 40px; border-radius: 50%; background: #f2f2f7; display: flex; justify-content: center; align-items: center; color: #8e8e93; margin-right: 15px; font-size: 16px; pointer-events: none;">
                                    <i class="fas fa-user"></i>
                                </div>
                                <div style="flex: 1; font-size: 16px; font-weight: 600; color: #111;">${this.escapeHTML(this.getFriendPhoneChineseContactName(contact))}</div>
                                <i class="fas fa-info-circle" style="color: #007aff; font-size: 20px; pointer-events: none;"></i>
                            </div>
                        `).join('');
                    }

                    setTimeout(() => {
                        try {
                            const items = listRecent.querySelectorAll('.call-history-item-new');
                            items.forEach(el => {
                                el.addEventListener('click', function(e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const idx = this.getAttribute('data-idx');
                                    const c = friend.callData.recentCalls[idx];
                                    window.lovesApp.showCallDetailModal(c);
                                });
                                window.lovesApp.bindLongPress(el, function() {
                                    const idx = el.getAttribute('data-idx');
                                    const c = friend.callData.recentCalls[idx];
                                    window.lovesApp.showDeleteConfirm(c.name + '的通话记录', () => {
                                        friend.callData.recentCalls.splice(idx, 1);
                                        callBtn.onclick();
                                    });
                                });
                            });

                            if (listContacts && friend.callData._parsedContacts) {
                                const contactItems = listContacts.querySelectorAll('.contact-item-new');
                                contactItems.forEach(el => {
                                    el.addEventListener('click', function(e) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const idx = this.getAttribute('data-idx');
                                        const c = friend.callData._parsedContacts[idx];
                                        window.lovesApp.showContactDetailModal(c);
                                    });
                                });
                            }
                        } catch(err) {
                            console.error('Call bind error', err);
                        }
                    }, 50);
                } else if (listRecent) {
                    listRecent.innerHTML = '<div style="padding: 30px; text-align: center; color: #8e8e93; font-size: 14px;">暂无通话记录<br><span style="font-size: 12px; margin-top: 5px; display: inline-block;">请在设置中生成</span></div>';
                    if (listContacts) {
                        listContacts.innerHTML = '<div style="padding: 30px; text-align: center; color: #8e8e93; font-size: 14px;">暂无联系人</div>';
                    }
                }
            };
        }
        const callBackBtn = document.getElementById('friend-phonecall-back-btn');
        if (callBackBtn) callBackBtn.onclick = () => { if (window.closeView) window.closeView(callView); };

        // 绑定 健康
        const healthBtn = document.getElementById('friend-phone-app-health');
        const healthView = document.getElementById('friend-health-view');
        if (healthBtn && healthView) {
            healthBtn.onclick = () => {
                if (window.openView) window.openView(healthView);
                const healthContent = document.getElementById('friend-health-content');
                if (healthContent) {
                    if (!friend.healthData) {
                        healthContent.innerHTML = '<div style="padding: 50px 20px; text-align: center; color: #8e8e93; font-size: 15px;">暂无健康数据<br><span style="font-size: 13px; margin-top: 8px; display: inline-block;">请在设置中生成</span></div>';
                    } else {
                    const healthHistory = Array.isArray(friend.healthData.history) && friend.healthData.history.length ? friend.healthData.history : [friend.healthData];
                    const healthIndex = Math.min(Number(this._healthHistoryIndex) || 0, healthHistory.length - 1);
                    const healthData = healthHistory[healthIndex] || friend.healthData;
                    const today = new Date();
                    const stepsThoughts = this.renderFriendPhoneLocalized(healthData, 'stepsThoughts', { fallback: '暂无运动心声', id: 'health-steps-thoughts' });
                    const dream = this.renderFriendPhoneLocalized(healthData, 'dream', { fallback: '暂无梦境记录', id: 'health-dream' });
                    const heartRate = this.escapeHTML(healthData.heartRate || '--');
                    const heartRateStatus = this.renderFriendPhoneLocalized(healthData, 'heartRateStatus', { fallback: '暂无状态', id: 'health-heart-status' });
                    const healthHistoryOptions = healthHistory.map((snapshot, index) => `<option value="${index}" ${index === healthIndex ? 'selected' : ''}>${this.escapeHTML(this.formatFriendPhoneGeneratedAt(snapshot.generatedAt) || `旧记录 ${index + 1}`)}</option>`).join('');
                    
                    // 生成日期选项
                    const datesHtml = [-2, -1, 0, 1, 2].map(offset => {
                        const d = new Date(today);
                        d.setDate(today.getDate() + offset);
                        const dayStr = d.getDate();
                        const weekStr = ['日','一','二','三','四','五','六'][d.getDay()];
                        const isActive = offset === 0;
                        
                        return `
                            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 44px; height: 56px; border-radius: 14px; background: ${isActive ? '#111' : 'transparent'}; color: ${isActive ? '#fff' : '#8e8e93'}; flex-shrink: 0; cursor: pointer; ">
                                <div style="font-size: 11px; font-weight: 600; margin-bottom: 2px;">${weekStr}</div>
                                <div style="font-size: 16px; font-weight: 800;">${dayStr}</div>
                            </div>
                        `;
                    }).join('');

                    healthContent.innerHTML = `
                        <!-- 顶部日期选择 -->
                        <label class="friend-phone-history-picker"><span>生成记录</span><select id="friend-health-history-select">${healthHistoryOptions}</select></label>
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                            <div style="font-size: 28px; font-weight: 800; color: #111; letter-spacing: -0.5px;">摘要</div>
                            <div style="width: 32px; height: 32px; border-radius: 50%; background: #f2f2f7; display: flex; justify-content: center; align-items: center; color: #111; font-size: 14px; cursor: pointer;">
                                <i class="fas fa-calendar-day"></i>
                            </div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; background: #fff; border-radius: 20px; padding: 8px; ">
                            ${datesHtml}
                        </div>

                        <!-- 步数卡片 -->
                        <div style="background: #fff; border-radius: 24px; padding: 22px; margin-bottom: 15px; border: 1px solid #f0f0f0; ">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <div style="display: flex; align-items: center; gap: 8px; color: #111; font-weight: 600;">
                                    <div style="width: 28px; height: 28px; border-radius: 8px; background: #f2f2f7; display: flex; justify-content: center; align-items: center;"><i class="fas fa-shoe-prints" style="font-size: 12px; color: #ff3b30;"></i></div>
                                    <span>步数</span>
                                </div>
                                <div style="font-size: 12px; color: #8e8e93; font-weight: 600;">14:20 更新</div>
                            </div>
                            <div style="font-size: 42px; font-weight: 800; color: #111; display: flex; align-items: baseline; gap: 6px; letter-spacing: -1px;">
                                ${healthData.steps || '0'} <span style="font-size: 15px; color: #8e8e93; font-weight: 600; letter-spacing: 0;">步</span>
                            </div>
                            <div style="margin-top: 14px; padding-top: 13px; border-top: 1px solid #f0f0f0; color: #666; font-size: 13px; line-height: 1.65;">${stepsThoughts}</div>
                        </div>

                        <!-- 睡眠卡片 -->
                        <div style="background: #fff; border-radius: 24px; padding: 22px; margin-bottom: 15px; border: 1px solid #f0f0f0; ">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <div style="display: flex; align-items: center; gap: 8px; color: #111; font-weight: 600;">
                                    <div style="width: 28px; height: 28px; border-radius: 8px; background: #f2f2f7; display: flex; justify-content: center; align-items: center;"><i class="fas fa-bed" style="font-size: 12px; color: #5856d6;"></i></div>
                                    <span>睡眠</span>
                                </div>
                                <div style="font-size: 12px; color: #8e8e93; font-weight: 600;">昨晚记录</div>
                            </div>
                            <div style="font-size: 36px; font-weight: 800; color: #111; display: flex; align-items: baseline; gap: 6px; letter-spacing: -0.5px;">
                                ${healthData.sleepHours || '0'} <span style="font-size: 15px; color: #8e8e93; font-weight: 600; letter-spacing: 0;">小时</span> 
                                ${healthData.sleepMinutes || '0'} <span style="font-size: 15px; color: #8e8e93; font-weight: 600; letter-spacing: 0;">分钟</span>
                            </div>
                            <div style="margin-top: 14px; padding-top: 13px; border-top: 1px solid #f0f0f0; color: #666; font-size: 13px; line-height: 1.65;">${dream}</div>
                        </div>

                        <!-- 当前心率 -->
                        <div style="background: #fff; border-radius: 24px; padding: 22px; margin-bottom: 15px; border: 1px solid #f0f0f0; display: flex; align-items: center; justify-content: space-between; gap: 16px;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 8px; color: #111; font-weight: 600; margin-bottom: 10px;">
                                    <div style="width: 28px; height: 28px; border-radius: 8px; background: #fff0f2; display: flex; justify-content: center; align-items: center;"><i class="fas fa-heartbeat" style="font-size: 13px; color: #ff2d55;"></i></div>
                                    <span>实时心率</span>
                                </div>
                                <div style="color: #8e8e93; font-size: 13px;">${heartRateStatus}</div>
                            </div>
                            <div style="color: #111; display: flex; align-items: baseline; gap: 5px; flex-shrink: 0;">
                                <span style="font-size: 40px; font-weight: 800;">${heartRate}</span>
                                <span style="color: #8e8e93; font-size: 12px; font-weight: 600;">BPM</span>
                            </div>
                        </div>

                        <!-- 身体指标 -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div style="background: #fff; border-radius: 24px; padding: 20px; border: 1px solid #f0f0f0; ">
                                <div style="display: flex; align-items: center; gap: 8px; color: #111; font-weight: 600; margin-bottom: 16px;">
                                    <div style="width: 28px; height: 28px; border-radius: 8px; background: #f2f2f7; display: flex; justify-content: center; align-items: center;"><i class="fas fa-weight" style="font-size: 12px; color: #007aff;"></i></div>
                                    <span>体重</span>
                                </div>
                                <div style="font-size: 28px; font-weight: 800; color: #111; letter-spacing: -0.5px;">${healthData.weight || '-'} <span style="font-size: 13px; color: #8e8e93; font-weight: 600; letter-spacing: 0;">kg</span></div>
                            </div>
                            <div style="background: #fff; border-radius: 24px; padding: 20px; border: 1px solid #f0f0f0; ">
                                <div style="display: flex; align-items: center; gap: 8px; color: #111; font-weight: 600; margin-bottom: 16px;">
                                    <div style="width: 28px; height: 28px; border-radius: 8px; background: #f2f2f7; display: flex; justify-content: center; align-items: center;"><i class="fas fa-ruler-vertical" style="font-size: 12px; color: #ff9500;"></i></div>
                                    <span>身高</span>
                                </div>
                                <div style="font-size: 28px; font-weight: 800; color: #111; letter-spacing: -0.5px;">${healthData.height || '-'} <span style="font-size: 13px; color: #8e8e93; font-weight: 600; letter-spacing: 0;">cm</span></div>
                            </div>
                        </div>
                    `;
                    const healthHistorySelect = document.getElementById('friend-health-history-select');
                    if (healthHistorySelect) healthHistorySelect.onchange = () => {
                        this._healthHistoryIndex = Number(healthHistorySelect.value) || 0;
                        healthBtn.onclick();
                    };
                    }
                }
            };
        }
        const healthBackBtn = document.getElementById('friend-health-back-btn');
        if (healthBackBtn) healthBackBtn.onclick = () => { if (window.closeView) window.closeView(healthView); };

        // 绑定 Pay
        const payBtn = document.getElementById('friend-phone-app-pay');
        const payView = document.getElementById('friend-pay-view');
        if (payBtn && payView) {
            payBtn.onclick = () => {
                if (window.openView) window.openView(payView);
                const payContent = document.getElementById('friend-pay-content');
                if (payContent) {
                    const payHistory = Array.isArray(friend.payData?.snapshots) && friend.payData.snapshots.length ? friend.payData.snapshots : (friend.payData ? [friend.payData] : []);
                    const payIndex = Math.min(Number(this._payHistoryIndex) || 0, Math.max(0, payHistory.length - 1));
                    let payData = payHistory[payIndex] || friend.payData;
                    if (!payData) {
                        payContent.innerHTML = '<div style="padding: 50px 20px; text-align: center; color: #8e8e93; font-size: 15px;">暂无钱包数据<br><span style="font-size: 13px; margin-top: 8px; display: inline-block;">请在设置中生成</span></div>';
                    } else {
                    const payHistoryOptions = payHistory.map((snapshot, index) => `<option value="${index}" ${index === payIndex ? 'selected' : ''}>${this.escapeHTML(this.formatFriendPhoneGeneratedAt(snapshot.generatedAt) || `旧记录 ${index + 1}`)}</option>`).join('');
                    let cards = payData.cards;
                    if (!cards) {
                        const totalStr = String(payData.totalAssets || '0').replace(/,/g, '');
                        const total = parseFloat(totalStr) || 0;
                        const txs = payData.recentTransactions || [];
                        
                        cards = [
                            {
                                id: 'card1',
                                bankName: '黑金储蓄卡',
                                cardType: 'Debit',
                                cardNumber: '**** **** **** 1995',
                                amount: (total * 0.6).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
                                transactions: txs.filter((_, i) => i % 2 === 0)
                            },
                            {
                                id: 'card2',
                                bankName: '白金信用卡',
                                cardType: 'Credit',
                                cardNumber: '**** **** **** 0113',
                                amount: (total * 0.4).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
                                transactions: txs.filter((_, i) => i % 2 !== 0)
                            },
                            {
                                id: 'card3',
                                bankName: '虚拟支付卡',
                                cardType: 'Prepaid',
                                cardNumber: '**** **** **** 9999',
                                amount: '0.00',
                                transactions: []
                            }
                        ];
                        // If we didn't generate payData earlier, we attach it now
                        if (friend.payData) {
                            friend.payData.cards = cards;
                        }
                    }
                    
                    let activeCardIndex = 0;

                    const renderPayView = () => {
                        const cardsHTML = cards.map((c, i) => {
                            // 层叠算法：active在最上，其它卡在下方依次堆叠
                            const isActive = i === activeCardIndex;
                            let translateY = 0;
                            let scale = 1;
                            let opacity = 1;
                            let zIndex = 100;

                            // 极简纯深色系，完全消除反差防止刺眼，统一为偏黑质感
                            const bgStyles = [
                                'linear-gradient(135deg, #111, #1a1a1c)', // 深邃黑
                                'linear-gradient(135deg, #141416, #222)', // 稍亮一点黑
                                'linear-gradient(135deg, #0a0a0c, #161618)' // 更暗的黑
                            ];
                            const bgStyle = bgStyles[i % bgStyles.length];
                            
                            // 统一灰白文字
                            const textColor = '#fff';
                            const subtitleColor = 'rgba(255,255,255,0.6)';
                            const borderColor = 'rgba(255,255,255,0.15)';
                            
                            if (!isActive) {
                                // 重构：计算从激活卡片之后开始排队的严格递增索引 (1, 2, 3...)
                                // 取消原来可能出现跳跃的计算方式，只要你不是激活卡，你就排在下面
                                let rank = i - activeCardIndex;
                                if (rank < 0) {
                                    rank += cards.length;
                                }
                                // rank 会是 1, 2... 表示在你下面排第几位
                                
                                // 修改：增加基础偏移量，使未激活卡片被往下推，从而在切换时产生更明显的抽拉感
                                translateY = 40 + ((rank - 1) * 20); 
                                scale = 1 - (0.06 * rank); // 按名次缩小更多，增加层叠的空间感
                                zIndex = 10 - rank;
                            } else {
                                translateY = -10; // 激活卡片稍微往上浮动一点
                                scale = 1.02; // 稍微放大
                                zIndex = 100;
                            }

                            // 过渡曲线稍快，消除生硬感，非常平滑，甚至带一点弹性
                            const transCSS = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.6s ease';

                            return `
                                <div class="pay-wallet-card" data-idx="${i}" style="position: absolute; top: 0; left: 0; right: 0; height: 180px; background: ${bgStyle}; border-radius: 20px; padding: 20px; color: ${textColor};  transition: ${transCSS}; transform: translateY(${translateY}px) scale(${scale}); opacity: ${opacity}; z-index: ${zIndex}; cursor: pointer; border: 1px solid rgba(255,255,255,0.08);">
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                                        <div style="font-size: 16px; font-weight: 700; letter-spacing: 0.5px;">${c.bankName}</div>
                                        <div style="font-size: 11px; color: ${subtitleColor}; border: 1px solid ${borderColor}; padding: 2px 10px; border-radius: 12px; font-weight: 600;">${c.cardType}</div>
                                    </div>
                                    <div style="font-size: 20px; font-family: monospace; letter-spacing: 2px; margin-bottom: 20px; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">${c.cardNumber}</div>
                                    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                                        <div>
                                            <div style="font-size: 11px; color: ${subtitleColor}; margin-bottom: 4px; font-weight: 500;">当前金额</div>
                                            <div style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">¥ ${c.amount}</div>
                                        </div>
                                        <i class="fab fa-cc-visa" style="font-size: 28px; color: ${textColor}; opacity: 0.7;"></i>
                                    </div>
                                </div>
                            `;
                        }).join('');

                        const activeCard = cards[activeCardIndex];
                        // 极简黑白灰交易明细
                        const txHTML = activeCard.transactions && activeCard.transactions.length > 0 ? activeCard.transactions.map(tx => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px 0; border-bottom: 1px solid #f0f0f0;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 40px; height: 40px; border-radius: 12px; background: #f4f4f5; display: flex; justify-content: center; align-items: center; color: #111; font-size: 14px;">
                                        <i class="${tx.isIncome ? 'fas fa-arrow-down' : 'fas fa-arrow-up'}" style="transform: ${tx.isIncome ? 'none' : 'rotate(45deg)'};"></i>
                                    </div>
                                    <div>
                                        <div style="font-size: 15px; font-weight: 600; color: #111; margin-bottom: 2px;">${this.renderFriendPhoneLocalized(tx, 'title', { id: 'pay-title' })}</div>
                                        <div style="font-size: 12px; color: #8e8e93; font-weight: 500;">${this.escapeHTML(this.formatFriendPhoneGeneratedAt(tx.generatedAt) || tx.time || '')}</div>
                                    </div>
                                </div>
                                <div style="font-size: 16px; font-weight: 700; color: #111;">${tx.isIncome ? '+' : ''}${tx.amount}</div>
                            </div>
                        `).join('') : '<div style="padding: 30px; text-align: center; color: #8e8e93; font-size: 13px;">暂无交易记录</div>';

                        // 高度计算：基于堆叠的最底下一张卡片的 translateY 加上露出部分
                        const maxTranslateY = 50 + (Math.max(0, cards.length - 2) * 20);
                        const containerHeight = maxTranslateY + 45 + 180; // 确保留出足够的空间

                        payContent.innerHTML = `
                            <div style="padding:16px 20px 0;"><label class="friend-phone-history-picker"><span>生成记录</span><select id="friend-pay-history-select">${payHistoryOptions}</select></label></div>
                            <style>
                            #pay-tx-container { animation: fadeUp 0.4s ease-out forwards; } 
                            @keyframes fadeUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                            </style>
                            <div style="padding: 20px;">
                                <div style="font-size: 34px; font-weight: 800; color: #111; margin-bottom: 25px; letter-spacing: -0.5px;">Cards</div>
                                <div id="pay-cards-container" style="position: relative; width: 100%; height: ${containerHeight}px; margin-bottom: 10px;">
                                    ${cardsHTML}
                                </div>
                            </div>
                            
                            <div style="padding: 0 20px 40px;" id="pay-tx-container">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                                    <div style="font-size: 20px; font-weight: 800; color: #111; letter-spacing: -0.5px;">Transactions</div>
                                    <div style="width: 32px; height: 32px; border-radius: 16px; background: #e5e5ea; display: flex; justify-content: center; align-items: center; color: #111; font-size: 14px;">
                                        <i class="fas fa-search"></i>
                                    </div>
                                </div>
                                <div style="background: #fff; border-radius: 20px; padding: 0 20px; ">
                                    ${txHTML}
                                </div>
                            </div>
                        `;

                        const payHistorySelect = document.getElementById('friend-pay-history-select');
                        if (payHistorySelect) payHistorySelect.onchange = () => {
                            this._payHistoryIndex = Number(payHistorySelect.value) || 0;
                            payBtn.onclick();
                        };

                        const container = document.getElementById('pay-cards-container');
                        if (container) {
                            container.querySelectorAll('.pay-wallet-card').forEach(el => {
                                el.onclick = () => {
                                    const idx = parseInt(el.getAttribute('data-idx'));
                                    if (idx !== activeCardIndex) {
                                        activeCardIndex = idx;
                                        renderPayView(); // 重新渲染触发动画
                                    }
                                };
                            });
                        }
                    };

                    renderPayView();
                    }
                }
            };
        }
        const payBackBtn = document.getElementById('friend-pay-back-btn');
        if (payBackBtn) payBackBtn.onclick = () => { if (window.closeView) window.closeView(payView); };

        // 绑定 Game
        const gameBtn = document.getElementById('friend-phone-app-game');
        const gameView = document.getElementById('friend-game-view');
        if (gameBtn && gameView) {
            gameBtn.onclick = () => {
                if (window.openView) window.openView(gameView);
                const gameContent = document.getElementById('friend-game-content');
                if (gameContent && friend.gameData) {
                    const gamesHTML = friend.gameData.recentGames ? friend.gameData.recentGames.map((g, idx) => {
                        return `
                        <div class="game-history-item-new" data-idx="${idx}" style="background: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 20px; padding: 18px; display: flex; gap: 16px; align-items: center; cursor: pointer;">
                            <div style="width: 56px; height: 56px; border-radius: 16px; background: #2c2c2e; display: flex; justify-content: center; align-items: center; font-size: 24px; color: #fff; pointer-events: none;">
                                <i class="${g.icon || 'fas fa-gamepad'}"></i>
                            </div>
                            <div style="flex: 1; pointer-events: none;">
                                <div style="font-size: 17px; font-weight: 600; color: #fff; letter-spacing: 0.5px;">${this.escapeHTML(g.name || '未知游戏')}</div>
                                <div style="font-size: 13px; color: #8e8e93; margin-top: 4px;">时长: ${g.hours}</div>
                                <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
                                    <div style="background: #3a3a3c; color: #fff; font-size: 11px; padding: 3px 10px; border-radius: 6px; font-weight: 600;">${this.escapeHTML(g.rank || '未定级')}</div>
                                    <div style="font-size: 12px; color: #8e8e93;">胜率: <span style="color: #fff; font-weight: 500;">${g.winRate}</span>${this.renderFriendPhoneGeneratedTime(g, 'is-dark')}</div>
                                </div>
                            </div>
                        </div>
                    `}).join('') : '';

                    gameContent.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 30px;">
                            <div style="width: 70px; height: 70px; border-radius: 50%; background: #1c1c1e; display: flex; justify-content: center; align-items: center; font-size: 30px; color: #fff; border: 2px solid #3a3a3c;">
                                <i class="fas fa-user"></i>
                            </div>
                            <div>
                                <div style="font-size: 20px; font-weight: 700; color: #fff; letter-spacing: 0.5px;">${this.escapeHTML(friend.gameData.playerName || 'Player One')}</div>
                                <div style="font-size: 13px; color: #8e8e93; margin-top: 6px;">游戏总时长: <span style="color: #fff; font-weight: 500;">${friend.gameData.totalHours || '0 小时'}</span></div>
                            </div>
                        </div>
                        <div style="font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 15px;">常玩的游戏</div>
                        <div style="display: flex; flex-direction: column; gap: 15px;">
                            ${gamesHTML}
                        </div>
                    `;

                    setTimeout(() => {
                        try {
                            const items = gameContent.querySelectorAll('.game-history-item-new');
                            items.forEach(el => {
                                window.lovesApp.bindLongPress(el, function() {
                                    const idx = el.getAttribute('data-idx');
                                    const g = friend.gameData.recentGames[idx];
                                    window.lovesApp.showDeleteConfirm(g.name, () => {
                                        friend.gameData.recentGames.splice(idx, 1);
                                        gameBtn.onclick();
                                    });
                                });

                                el.addEventListener('click', function(e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const idx = this.getAttribute('data-idx');
                                    const g = friend.gameData.recentGames[idx];
                                    let content = '';
                                    if (Array.isArray(g.matches)) {
                                        content += `<div style="background: #f4f4f5; border-radius: 24px; padding: 16px; margin-bottom: 16px;">
                                            <div style="font-weight: 700; color: #111; margin-bottom: 12px; padding-left: 4px; display: flex; align-items: center; gap: 8px;"><i class="fas fa-gamepad" style="color: #111;"></i> 近期对局 (点击查看单局详情)</div>`;
                                        
                                        g.matches.forEach((m, mIdx) => {
                                            const isWin = m.result === '胜利' || m.result === 'Win';
                                            const bgColor = isWin ? '#111' : '#fff';
                                            const textColor = isWin ? '#fff' : '#8e8e93';
                                            const resultColor = isWin ? '#fff' : '#111';
                                            const kdaBgColor = isWin ? '#333' : '#f4f4f5';
                                            const kdaTextColor = isWin ? '#fff' : '#111';
                                            const iconColor = isWin ? '#fff' : '#111';
                                            
                                            // Encode match data for onclick handler
                                            const matchDataStr = encodeURIComponent(JSON.stringify(m));

                                            content += `
                                            <div class="game-match-item" data-match="${matchDataStr}" style="display: flex; align-items: center; justify-content: space-between; background: ${bgColor}; border: 1px solid #e5e5ea; border-radius: 16px; padding: 16px; margin-bottom: 10px; cursor: pointer;">
                                                <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; width: 50px; pointer-events: none;">
                                                    <div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(142,142,147,0.1); display: flex; justify-content: center; align-items: center; color: ${iconColor}; font-size: 16px;">
                                                        <i class="fas fa-user"></i>
                                                    </div>
                                                    <div style="font-size: 11px; font-weight: 500; color: ${textColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; text-align: center;">${window.lovesApp.escapeHTML(m.hero || '我方')}</div>
                                                </div>
                                                
                                                <div style="display: flex; flex-direction: column; align-items: center; flex: 1; pointer-events: none;">
                                                    <div style="font-size: 18px; font-weight: 800; color: ${resultColor}; letter-spacing: 1px;">${m.result}</div>
                                                    <div style="font-size: 11px; color: #8e8e93; margin-top: 6px;">${window.lovesApp.escapeHTML(window.lovesApp.formatFriendPhoneGeneratedAt(m.generatedAt) || m.time || '')}</div>
                                                    <div style="font-size: 12px; font-weight: 700; color: ${kdaTextColor}; margin-top: 8px; background: ${kdaBgColor}; padding: 4px 10px; border-radius: 8px;">KDA: ${m.kda || '-/-/-'}</div>
                                                </div>

                                                <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; width: 50px; pointer-events: none;">
                                                    <div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(142,142,147,0.1); display: flex; justify-content: center; align-items: center; color: ${iconColor}; font-size: 16px;">
                                                        <i class="fas fa-skull"></i>
                                                    </div>
                                                    <div style="font-size: 11px; font-weight: 500; color: ${textColor};">敌方</div>
                                                </div>
                                            </div>`;
                                        });
                                        content += `</div>`;
                                    } else if (typeof g.matches === 'string' && g.matches) {
                                        content += `<div style="background: #f4f4f5; border-radius: 24px; padding: 16px; margin-bottom: 16px;">
                                            <div style="font-weight: 700; color: #111; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;"><i class="fas fa-history" style="color: #111;"></i> 近期对局</div>
                                            <div style="color: #333; line-height: 1.6; font-size: 14px;">${g.matches.replace(/\n/g, '<br>')}</div>
                                        </div>`;
                                    }

                                    // For older data formats where thoughts were at the game level rather than match level
                                    if (g.innerThoughts && !Array.isArray(g.matches)) {
                                        content += `<div style="background: #f4f4f5; border-radius: 24px; padding: 16px; margin-bottom: 16px; border-left: 4px solid #111;">
                                            <div style="font-weight: 700; color: #111; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;"><i class="fas fa-headset" style="color: #111;"></i> 局内心声</div>
                                            <div style="color: #333; line-height: 1.6; font-size: 14px; font-style: italic;">“${window.lovesApp.renderFriendPhoneLocalized(g, 'innerThoughts', { id: 'game-thoughts' })}”</div>
                                        </div>`;
                                    }
                                    
                                    if (g.postGameReflection && !Array.isArray(g.matches)) {
                                        content += `<div style="background: #111; border-radius: 24px; padding: 16px; margin-bottom: 16px;">
                                            <div style="font-weight: 700; color: #fff; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;"><i class="fas fa-clipboard-list" style="color: #fff;"></i> 局后复盘</div>
                                            <div style="color: #ccc; line-height: 1.6; font-size: 14px;">${window.lovesApp.renderFriendPhoneLocalized(g, 'postGameReflection', { id: 'game-reflection' })}</div>
                                        </div>`;
                                    }
                                    
                                    if (!content) content = '暂无更多数据';
                                    window.lovesApp.showDetailModal(g.name + ' - 战绩列表', content);

                                    // Bind match click events
                                    setTimeout(() => {
                                        const matchItems = document.querySelectorAll('.game-match-item');
                                        matchItems.forEach(item => {
                                            item.addEventListener('click', function() {
                                                const matchStr = this.getAttribute('data-match');
                                                if (matchStr) {
                                                    try {
                                                        const m = JSON.parse(decodeURIComponent(matchStr));
                                                        let matchDetailContent = '';
                                                        
                                                        // Base Stats
                                                        matchDetailContent += `
                                                            <div style="background: #f4f4f5; border-radius: 20px; padding: 16px; margin-bottom: 16px;">
                                                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                                                    <div style="font-weight: 800; font-size: 20px; color: ${m.result === '胜利' || m.result === 'Win' ? '#111' : '#8e8e93'};">${m.result}</div>
                                                                    <div style="font-weight: 700; color: #111; background: #e5e5ea; padding: 4px 10px; border-radius: 8px;">KDA: ${m.kda || '-/-/-'}</div>
                                                                </div>
                                                                <div style="display: flex; align-items: center; gap: 8px; color: #8e8e93; font-size: 13px;">
                                                                    <i class="fas fa-clock"></i> ${window.lovesApp.escapeHTML(window.lovesApp.formatFriendPhoneGeneratedAt(m.generatedAt) || m.time || '')} | 英雄: ${window.lovesApp.escapeHTML(m.hero || '未知')}
                                                                </div>
                                                            </div>
                                                        `;

                                                        // Highlights
                                                        if (m.highlights && Array.isArray(m.highlights) && m.highlights.length > 0) {
                                                            let highlightsHtml = m.highlights.map(h => `
                                                                <div style="display: flex; gap: 12px; margin-bottom: 8px; align-items: flex-start;">
                                                                    <div style="font-weight: 700; color: #111; font-size: 13px; background: #e5e5ea; padding: 2px 6px; border-radius: 4px; flex-shrink: 0;">${window.lovesApp.escapeHTML(window.lovesApp.formatFriendPhoneGeneratedAt(h.generatedAt) || '')}</div>
                                                                    <div style="color: #333; font-size: 14px; line-height: 1.4;">${window.lovesApp.renderFriendPhoneLocalized(h, 'desc', { id: 'match-highlight' })}</div>
                                                                </div>
                                                            `).join('');
                                                            
                                                            matchDetailContent += `
                                                                <div style="background: #fff; border: 1px solid #e5e5ea; border-radius: 20px; padding: 16px; margin-bottom: 16px;">
                                                                    <div style="font-weight: 700; color: #111; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;"><i class="fas fa-bolt" style="color: #111;"></i> 高光时刻</div>
                                                                    ${highlightsHtml}
                                                                </div>
                                                            `;
                                                        }

                                                        // Inner Thoughts
                                                        if (m.innerThoughts) {
                                                            matchDetailContent += `
                                                                <div style="background: #f4f4f5; border-radius: 20px; padding: 16px; margin-bottom: 16px; border-left: 4px solid #111;">
                                                                    <div style="font-weight: 700; color: #111; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;"><i class="fas fa-headset" style="color: #111;"></i> 局内心声</div>
                                                                    <div style="color: #333; line-height: 1.6; font-size: 14px; font-style: italic;">“${window.lovesApp.renderFriendPhoneLocalized(m, 'innerThoughts', { id: 'match-thoughts' })}”</div>
                                                                </div>
                                                            `;
                                                        }

                                                        // Post Game Reflection
                                                        if (m.postGameReflection || m.thoughts) {
                                                            const reflectionText = m.postGameReflection || m.thoughts;
                                                            matchDetailContent += `
                                                                <div style="background: #111; border-radius: 20px; padding: 16px; margin-bottom: 16px;">
                                                                    <div style="font-weight: 700; color: #fff; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;"><i class="fas fa-clipboard-list" style="color: #fff;"></i> 局后复盘</div>
                                                                    <div style="color: #ccc; line-height: 1.6; font-size: 14px;">${window.lovesApp.renderFriendPhoneLocalized(m, m.postGameReflection ? 'postGameReflection' : 'thoughts', { fallback: reflectionText, id: 'match-reflection' })}</div>
                                                                </div>
                                                            `;
                                                        }

                                                        if (!matchDetailContent) matchDetailContent = '暂无详情数据';
                                                        
                                                        // Show secondary modal
                                                        window.lovesApp.showDetailModal('单局详情', matchDetailContent);
                                                    } catch (e) {
                                                        console.error('Parse match data error', e);
                                                    }
                                                }
                                            });
                                        });
                                    }, 100);
                                });
                            });
                        } catch(err) {
                            console.error('Game bind error', err);
                        }
                    }, 50);
                } else if (gameContent) {
                    gameContent.innerHTML = '<div style="padding: 50px 20px; text-align: center; color: #8e8e93; font-size: 15px;">暂无游戏数据<br><span style="font-size: 13px; margin-top: 8px; display: inline-block;">请在设置中生成</span></div>';
                }
            };
        }
        const gameBackBtn = document.getElementById('friend-game-back-btn');
        if (gameBackBtn) gameBackBtn.onclick = () => { if (window.closeView) window.closeView(gameView); };
        
        // iMessage Tab 切换
        const tabChat = document.getElementById('friend-imsg-tabbar-chat');
        const tabMe = document.getElementById('friend-imsg-tabbar-me');
        const panelChat = document.getElementById('friend-imsg-panel-chat');
        const panelMe = document.getElementById('friend-imsg-panel-me');
        const titleEl = document.getElementById('friend-imsg-title');
        
        if (tabChat) tabChat.onclick = () => {
            tabChat.style.color = '#007aff';
            if (tabMe) tabMe.style.color = '#8e8e93';
            if (panelChat) panelChat.style.display = 'flex';
            if (panelMe) panelMe.style.display = 'none';
            if (titleEl) titleEl.textContent = '信息';
        };
        if (tabMe) tabMe.onclick = () => {
            tabMe.style.color = '#007aff';
            if (tabChat) tabChat.style.color = '#8e8e93';
            if (panelMe) panelMe.style.display = 'flex';
            if (panelChat) panelChat.style.display = 'none';
            if (titleEl) titleEl.textContent = '我';
        };
        
        // 反向聊天室
        const revChatView = document.getElementById('friend-reverse-chat-view');
        // 将点击事件代理在外部方法中执行
        
        const revBackBtn = document.getElementById('reverse-chat-back-btn');
        if (revBackBtn) revBackBtn.onclick = () => { if (window.closeView) window.closeView(revChatView); };

    },
    
    showContactDetailModal: function(contactData) {
        try {
            const oldModals = document.querySelectorAll('#loves-contact-detail-modal');
            oldModals.forEach(m => m.remove());

            const modal = document.createElement('div');
            modal.id = 'loves-contact-detail-modal';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
            modal.style.zIndex = '2147483647'; 
            modal.style.display = 'flex';
            modal.style.flexDirection = 'column';
            modal.style.justifyContent = 'flex-end';

            const card = document.createElement('div');
            card.style.backgroundColor = '#f2f2f7';
            card.style.borderTopLeftRadius = '24px';
            card.style.borderTopRightRadius = '24px';
            card.style.width = '100%';
            card.style.maxHeight = '85%';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.pointerEvents = 'auto'; 
            card.style.boxShadow = '0 -4px 20px rgba(0,0,0,0.1)';

            const handle = document.createElement('div');
            handle.style.width = '36px';
            handle.style.height = '5px';
            handle.style.backgroundColor = '#ccc';
            handle.style.borderRadius = '3px';
            handle.style.margin = '10px auto 15px';

            const contentWrap = document.createElement('div');
            contentWrap.style.flex = '1';
            contentWrap.style.overflowY = 'auto';
            contentWrap.style.padding = '0 20px 20px';

            // Top Header: Avatar & Name
            const headerHtml = `
                <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 25px;">
                    <div style="width: 80px; height: 80px; border-radius: 50%; background: #e5e5ea; display: flex; justify-content: center; align-items: center; color: #8e8e93; font-size: 34px; margin-bottom: 10px; ">
                        <i class="fas fa-user"></i>
                    </div>
                    <div style="font-size: 24px; font-weight: 600; color: #111;">${this.escapeHTML(this.getFriendPhoneChineseContactName(contactData))}</div>
                </div>
            `;

            // Action Buttons Row
            const actionsHtml = `
                <div style="display: flex; justify-content: space-between; gap: 10px; margin-bottom: 25px;">
                    <div style="flex: 1; background: #fff; padding: 12px 0; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; color: #007aff;">
                        <i class="fas fa-comment" style="font-size: 20px;"></i>
                        <span style="font-size: 11px; font-weight: 500;">信息</span>
                    </div>
                    <div style="flex: 1; background: #fff; padding: 12px 0; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; color: #007aff;">
                        <i class="fas fa-phone-alt" style="font-size: 20px;"></i>
                        <span style="font-size: 11px; font-weight: 500;">电话</span>
                    </div>
                    <div style="flex: 1; background: #fff; padding: 12px 0; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; color: #007aff;">
                        <i class="fas fa-video" style="font-size: 20px;"></i>
                        <span style="font-size: 11px; font-weight: 500;">视频</span>
                    </div>
                    <div style="flex: 1; background: #fff; padding: 12px 0; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; color: #007aff;">
                        <i class="fas fa-envelope" style="font-size: 20px;"></i>
                        <span style="font-size: 11px; font-weight: 500;">邮件</span>
                    </div>
                </div>
            `;

            // Contact Info Details
            const infoHtml = `
                <div style="background: #fff; border-radius: 16px; padding: 16px; margin-bottom: 15px; display: flex; flex-direction: column; gap: 15px;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <div style="font-size: 13px; color: #8e8e93;">添加为联系人日期</div>
                        <div style="font-size: 15px; font-weight: 500; color: #111;">${this.escapeHTML(this.formatFriendPhoneGeneratedAt(contactData.generatedAt) || '旧数据')}</div>
                    </div>
                    <div style="height: 1px; background: #f2f2f7;"></div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <div style="font-size: 13px; color: #8e8e93;">近期通话时间</div>
                        <div style="font-size: 15px; font-weight: 500; color: #111;">${this.escapeHTML(this.formatFriendPhoneGeneratedAt(contactData.generatedAt) || '旧数据')}</div>
                    </div>
                </div>
            `;

            // Reason Card
            const reasonHtml = `
                <div style="background: #fff; border-radius: 16px; padding: 16px;">
                    <div style="font-size: 13px; color: #8e8e93; margin-bottom: 8px;">通话原因</div>
                    <div style="font-size: 15px; color: #333; line-height: 1.5; word-break: break-word;">
                        ${this.renderFriendPhoneLocalized(contactData, 'callReason', { fallback: '暂无说明', id: 'contact-reason' })}
                    </div>
                </div>
            `;

            contentWrap.innerHTML = headerHtml + actionsHtml + infoHtml + reasonHtml;

            card.appendChild(handle);
            card.appendChild(contentWrap);
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.opacity = '0';
                    card.style.transform = 'translateY(100%)';
                    setTimeout(() => modal.remove(), 250);
                }
            });

            modal.style.opacity = '0';
            modal.style.transition = 'opacity 0.25s ease';
            card.style.transform = 'translateY(100%)';
            card.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)';
            
            modal.appendChild(card);
            document.body.appendChild(modal);
            this.bindFriendPhoneTranslationDelegation(modal);

            void modal.offsetWidth;
            modal.style.opacity = '1';
            card.style.transform = 'translateY(0)';

        } catch (e) {
            console.error('Error showing contact detail modal:', e);
        }
    },

    showCallDetailModal: function(callData) {
        try {
            const oldModals = document.querySelectorAll('#loves-call-detail-modal');
            oldModals.forEach(m => m.remove());

            const modal = document.createElement('div');
            modal.id = 'loves-call-detail-modal';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
            modal.style.zIndex = '2147483647'; 
            modal.style.display = 'flex';
            modal.style.flexDirection = 'column';
            modal.style.justifyContent = 'flex-end';
            
            // Format data
            let typeText = '语音通话';
            let typeColor = '#8e8e93';
            if (callData.type === 'missed') {
                typeText = '未接来电';
                typeColor = '#ff3b30';
            } else if (callData.type === 'outgoing') {
                typeText = '呼出通话';
            } else {
                typeText = '呼入通话';
            }

            const dialogue = callData.dialogue || '无对话记录';

            const card = document.createElement('div');
            card.style.backgroundColor = '#f2f2f7';
            card.style.borderTopLeftRadius = '24px';
            card.style.borderTopRightRadius = '24px';
            card.style.width = '100%';
            card.style.maxHeight = '85%';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.pointerEvents = 'auto'; 
            card.style.boxShadow = '0 -4px 20px rgba(0,0,0,0.1)';

            const handle = document.createElement('div');
            handle.style.width = '36px';
            handle.style.height = '5px';
            handle.style.backgroundColor = '#ccc';
            handle.style.borderRadius = '3px';
            handle.style.margin = '10px auto 15px';

            const contentWrap = document.createElement('div');
            contentWrap.style.flex = '1';
            contentWrap.style.overflowY = 'auto';
            contentWrap.style.padding = '0 20px 20px';

            // Top Header: Avatar & Name
            const headerHtml = `
                <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 25px;">
                    <div style="width: 80px; height: 80px; border-radius: 50%; background: #e5e5ea; display: flex; justify-content: center; align-items: center; color: #8e8e93; font-size: 34px; margin-bottom: 10px; ">
                        <i class="fas fa-user"></i>
                    </div>
                    <div style="font-size: 24px; font-weight: 600; color: #111;">${this.escapeHTML(this.getFriendPhoneChineseContactName(callData))}</div>
                </div>
            `;

            // Action Buttons Row
            const actionsHtml = `
                <div style="display: flex; justify-content: space-between; gap: 10px; margin-bottom: 25px;">
                    <div style="flex: 1; background: #fff; padding: 12px 0; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; color: #007aff;">
                        <i class="fas fa-comment" style="font-size: 20px;"></i>
                        <span style="font-size: 11px; font-weight: 500;">信息</span>
                    </div>
                    <div style="flex: 1; background: #fff; padding: 12px 0; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; color: #007aff;">
                        <i class="fas fa-phone-alt" style="font-size: 20px;"></i>
                        <span style="font-size: 11px; font-weight: 500;">电话</span>
                    </div>
                    <div style="flex: 1; background: #fff; padding: 12px 0; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; color: #007aff;">
                        <i class="fas fa-video" style="font-size: 20px;"></i>
                        <span style="font-size: 11px; font-weight: 500;">视频</span>
                    </div>
                    <div style="flex: 1; background: #fff; padding: 12px 0; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; color: #007aff;">
                        <i class="fas fa-envelope" style="font-size: 20px;"></i>
                        <span style="font-size: 11px; font-weight: 500;">邮件</span>
                    </div>
                </div>
            `;

            // Call Details Card
            const detailsHtml = `
                <div style="background: #fff; border-radius: 16px; padding: 16px; margin-bottom: 15px;">
                    <div style="font-size: 15px; font-weight: 600; color: #111; margin-bottom: 8px;">${this.escapeHTML(this.formatFriendPhoneGeneratedAt(callData.generatedAt) || callData.time || '')}</div>
                    <div style="font-size: 14px; color: ${typeColor};">${typeText}</div>
                </div>
            `;

            // Dialogue Translation Card
            const dialogueHtml = `
                <div style="background: #fff; border-radius: 16px; padding: 16px;">
                    <div style="font-size: 13px; font-weight: 600; color: #8e8e93; margin-bottom: 12px; text-transform: uppercase;">录音转写记录</div>
                    <div style="font-size: 15px; color: #333; line-height: 1.6; word-break: break-word;">
                        ${this.renderFriendPhoneLocalized(callData, 'dialogue', { fallback: dialogue, id: 'call-dialogue' })}
                    </div>
                </div>
            `;

            contentWrap.innerHTML = headerHtml + actionsHtml + detailsHtml + dialogueHtml;

            card.appendChild(handle);
            card.appendChild(contentWrap);
            
            // Add click-to-close behavior
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.opacity = '0';
                    card.style.transform = 'translateY(100%)';
                    setTimeout(() => modal.remove(), 250);
                }
            });

            // Entry animation
            modal.style.opacity = '0';
            modal.style.transition = 'opacity 0.25s ease';
            card.style.transform = 'translateY(100%)';
            card.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)';
            
            modal.appendChild(card);
            document.body.appendChild(modal);
            this.bindFriendPhoneTranslationDelegation(modal);

            // Trigger reflow to start animation
            void modal.offsetWidth;
            modal.style.opacity = '1';
            card.style.transform = 'translateY(0)';

        } catch (e) {
            console.error('Error showing call detail modal:', e);
        }
    },

    showDetailModal: function(title, content) {
        try {
            // 清理旧的
            const oldModals = document.querySelectorAll('#loves-detail-modal');
            oldModals.forEach(m => m.remove());

            const modal = document.createElement('div');
            modal.id = 'loves-detail-modal';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            modal.style.zIndex = '2147483647'; 
            modal.style.display = 'flex';
            modal.style.justifyContent = 'center';
            modal.style.alignItems = 'center';
            
            const card = document.createElement('div');
            card.style.backgroundColor = '#fff';
            card.style.borderRadius = '16px';
            card.style.width = '80%';
            card.style.maxWidth = '300px';
            card.style.padding = '20px';
            card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            card.style.position = 'relative';
            card.style.maxHeight = '80%';
            card.style.overflowY = 'auto';
            card.style.pointerEvents = 'auto'; 
            
            const closeBtn = document.createElement('i');
            closeBtn.className = 'fas fa-times';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '15px';
            closeBtn.style.right = '15px';
            closeBtn.style.fontSize = '20px';
            closeBtn.style.color = '#8e8e93';
            closeBtn.style.cursor = 'pointer';
            closeBtn.onclick = (e) => { 
                e.stopPropagation();
                modal.remove(); 
            };
            
            const titleEl = document.createElement('div');
            titleEl.id = 'loves-detail-modal-title';
            titleEl.style.fontSize = '20px';
            titleEl.style.fontWeight = '800';
            titleEl.style.color = '#111';
            titleEl.style.marginBottom = '18px';
            titleEl.style.paddingRight = '20px';
            titleEl.innerText = title;
            
            const contentEl = document.createElement('div');
            contentEl.id = 'loves-detail-modal-content';
            contentEl.style.fontSize = '15px';
            contentEl.style.color = '#333';
            contentEl.style.lineHeight = '1.6';
            contentEl.innerHTML = content;
            
            card.appendChild(closeBtn);
            card.appendChild(titleEl);
            card.appendChild(contentEl);
            modal.appendChild(card);
            
            // 点击背景关闭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
            
            document.body.appendChild(modal);
            this.bindFriendPhoneTranslationDelegation(modal);
        } catch (e) {
            console.error('Error showing detail modal:', e);
        }
    },

    showBrowserDetailModal: function(title, content, isDark = false, record = null) {
        try {
            // 清理旧的
            const oldModals = document.querySelectorAll('#loves-browser-detail-modal');
            oldModals.forEach(m => m.remove());

            const modal = document.createElement('div');
            modal.id = 'loves-browser-detail-modal';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            modal.style.zIndex = '2147483647'; 
            modal.style.display = 'flex';
            modal.style.flexDirection = 'column';
            modal.style.justifyContent = 'flex-end'; // 从底部升起
            
            const bgOuterColor = isDark ? '#000' : '#f4f4f5';
            const bgInnerColor = isDark ? '#1c1c1e' : '#fff';
            const textMainColor = isDark ? '#fff' : '#111';
            const textSubColor = isDark ? '#ccc' : '#333';
            const borderColor = isDark ? 'transparent' : 'rgba(0,0,0,0.05)';
            
            const card = document.createElement('div');
            card.style.backgroundColor = bgOuterColor;
            card.style.borderTopLeftRadius = '24px'; 
            card.style.borderTopRightRadius = '24px';
            card.style.width = '100%';
            card.style.height = '92%'; // 占据大部分屏幕
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.pointerEvents = 'auto'; 
            card.style.boxShadow = '0 -4px 24px rgba(0,0,0,0.1)';
            
            // 极简黑白灰 Safari 风格的顶部导航栏
            const header = document.createElement('div');
            header.style.height = '54px';
            header.style.display = 'flex';
            header.style.alignItems = 'center';
            header.style.justifyContent = 'space-between';
            header.style.padding = '0 20px';
            header.style.backgroundColor = bgOuterColor;
            header.style.borderBottom = '1px solid ' + borderColor;
            header.style.borderTopLeftRadius = '24px';
            header.style.borderTopRightRadius = '24px';
            header.style.flexShrink = '0';

            const doneBtn = document.createElement('div');
            doneBtn.innerText = '完成';
            doneBtn.style.color = textMainColor; 
            doneBtn.style.fontSize = '16px';
            doneBtn.style.fontWeight = '600';
            doneBtn.style.cursor = 'pointer';
            doneBtn.onclick = () => {
                modal.style.opacity = '0';
                card.style.transform = 'translateY(100%)';
                setTimeout(() => modal.remove(), 250);
            };

            const headerDomain = document.createElement('div');
            headerDomain.style.display = 'flex';
            headerDomain.style.alignItems = 'center';
            headerDomain.style.justifyContent = 'center';
            headerDomain.style.gap = '6px';
            headerDomain.style.fontSize = '13px';
            headerDomain.style.fontWeight = '500';
            headerDomain.style.color = '#8e8e93';
            headerDomain.style.flex = '1';
            headerDomain.innerHTML = '<i class="fas fa-lock" style="font-size: 10px;"></i> search.com';

            const shareBtn = document.createElement('div');
            shareBtn.innerHTML = '<i class="fas fa-share-square"></i>';
            shareBtn.style.color = textMainColor;
            shareBtn.style.fontSize = '20px';

            header.appendChild(doneBtn);
            header.appendChild(headerDomain);
            header.appendChild(shareBtn);

            // 内容包裹区
            const contentWrap = document.createElement('div');
            contentWrap.style.flex = '1';
            contentWrap.style.overflowY = 'auto';
            contentWrap.style.padding = '0';
            contentWrap.style.backgroundColor = bgOuterColor;

            const pagePaper = document.createElement('div');
            pagePaper.style.backgroundColor = bgInnerColor;
            pagePaper.style.margin = '20px'; // 四周留白
            pagePaper.style.borderRadius = '24px'; // 大圆角
            pagePaper.style.padding = '30px 24px';
            pagePaper.style.boxShadow = isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.03)';
            
            const titleEl = document.createElement('h1');
            titleEl.style.fontSize = '24px'; 
            titleEl.style.fontWeight = '800';
            titleEl.style.color = textMainColor;
            titleEl.style.marginBottom = '24px';
            titleEl.style.lineHeight = '1.4';
            titleEl.style.letterSpacing = '-0.5px';
            titleEl.innerHTML = record ? this.renderFriendPhoneLocalized(record, 'title', { id: 'browser-title' }) : this.escapeHTML(title);
            
            const textEl = document.createElement('div');
            textEl.style.fontSize = '16px';
            textEl.style.color = textSubColor;
            textEl.style.lineHeight = '1.8';
            textEl.style.wordBreak = 'break-word';
            // Decode component if it was passed safely encoded
            textEl.innerHTML = record ? this.renderFriendPhoneLocalized(record, 'content', { id: 'browser-content' }) : this.escapeHTML(content).replace(/\n/g, '<br>');
            const generatedTime = this.renderFriendPhoneGeneratedTime(record, isDark ? 'is-dark' : '');
            
            pagePaper.appendChild(titleEl);
            pagePaper.appendChild(textEl);
            if (generatedTime) textEl.insertAdjacentHTML('afterend', generatedTime);
            contentWrap.appendChild(pagePaper);

            card.appendChild(header);
            card.appendChild(contentWrap);
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.opacity = '0';
                    card.style.transform = 'translateY(100%)';
                    setTimeout(() => modal.remove(), 250);
                }
            });

            // Entry animation
            modal.style.opacity = '0';
            modal.style.transition = 'opacity 0.25s ease';
            card.style.transform = 'translateY(100%)';
            card.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)';

            modal.appendChild(card);
            document.body.appendChild(modal);
            this.bindFriendPhoneTranslationDelegation(modal);

            // Trigger reflow to start animation
            void modal.offsetWidth;
            modal.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        } catch (e) {
            console.error('Error showing browser detail modal:', e);
        }
    },

    switchImsgAccount: function(accType, hasData) {
        if (!hasData) return;
        this.currentImsgAccount = accType;
        
        const accountModal = document.getElementById('friend-imsg-account-modal');
        if (window.closeView && accountModal) window.closeView(accountModal);

        if (this.currentFriend) {
            this.renderFriendImsg(this.currentFriend);
        }
    },

    getCanonicalFriendForPhone: function(friend) {
        if (!friend?.id) return friend;
        return (window.imData?.friends || []).find(item => String(item?.id) === String(friend.id)) || friend;
    },

    ensureFriendPhoneMessagesLoaded: async function(friend) {
        const canonicalFriend = this.getCanonicalFriendForPhone(friend);
        if (window.imApp?.ensureFriendMessagesLoaded) {
            await window.imApp.ensureFriendMessagesLoaded(canonicalFriend);
        }
        return canonicalFriend;
    },

    getFriendPhoneUserContextMessages: function(friend, limit = 10) {
        const canonicalMessages = Array.isArray(friend?.messages) ? friend.messages : [];
        const legacyMessages = Array.isArray(window.imData?.messages?.[friend?.id]) ? window.imData.messages[friend.id] : [];
        const source = canonicalMessages.length ? canonicalMessages : legacyMessages;
        return source.slice(-Math.max(1, Number(limit) || 10));
    },

    getFriendPhoneMessageText: function(message) {
        const directText = message?.content ?? message?.text ?? message?.transcript ?? message?.voiceTranscript;
        if (String(directText ?? '').trim()) return String(directText).trim();
        const typeLabels = {
            image: '[图片]', sticker: '[表情]', voice: '[语音]', voice_message: '[语音]',
            video: '[视频]', file: '[文件]', payment: '[转账]', transfer: '[转账]', location: '[位置]'
        };
        return typeLabels[message?.type] || '[特殊消息]';
    },

    isFriendPhoneUserMessage: function(message) {
        return message?.role === 'user' || message?.sender === 'me' || message?.sender === 'user';
    },

    renderFriendImsg: function(friend) {
        const imsgList = document.getElementById('friend-imsg-panel-chat');
        const meNameEl = document.getElementById('friend-imsg-me-name');
        const meImg = document.getElementById('friend-imsg-me-avatar');
        const meIcon = document.getElementById('friend-imsg-me-icon');

        if (!imsgList) return;

        let isMain = this.currentImsgAccount === 'main';
        
        let mainChats = [];
        let altChats = [];
        let altName = '小号';
        let userRemark = window.imData?.profile?.name || '我'; // 默认备注为用户自身名字
        
        if (friend.imessageData) {
            if (Array.isArray(friend.imessageData)) {
                mainChats = friend.imessageData;
            } else {
                mainChats = friend.imessageData.mainAccount?.chats || [];
                altChats = friend.imessageData.altAccount?.chats || [];
                altName = friend.imessageData.altAccount?.name || '小号';
                if (friend.imessageData.mainAccount?.userRemark) {
                    userRemark = friend.imessageData.mainAccount.userRemark;
                }
            }
        }

        if (isMain) {
            if (meNameEl) meNameEl.textContent = friend.nickname || friend.realname || 'TA';
            if (friend.avatarUrl) {
                if (meImg) { meImg.src = friend.avatarUrl; meImg.style.display = 'block'; }
                if (meIcon) meIcon.style.display = 'none';
            } else {
                if (meImg) meImg.style.display = 'none';
                if (meIcon) { meIcon.style.display = 'block'; meIcon.className = 'fas fa-user'; }
            }
        } else {
            if (meNameEl) meNameEl.textContent = altName;
            if (meImg) meImg.style.display = 'none';
            if (meIcon) {
                meIcon.style.display = 'block';
                meIcon.className = 'fas fa-user-secret';
            }
        }

        // 清空列表
        imsgList.innerHTML = '';
        
        // 渲染与 user 的固定聊天室（仅主账号展示）
        if (isMain) {
            const userAvatarUrl = window.userState?.avatarUrl || window.imData?.profile?.avatarUrl;
            const contextMessages = this.getFriendPhoneUserContextMessages(friend, 10);
            const latestContextMessage = contextMessages[contextMessages.length - 1] || null;
            const latestMsg = latestContextMessage ? this.getFriendPhoneMessageText(latestContextMessage) : '...';
            const latestTime = this.formatFriendPhoneGeneratedAt(latestContextMessage?.timestamp);

            const userChatHTML = `
            <div id="friend-imsg-chat-with-user-item-dynamic" style="display: flex; align-items: center; padding: 16px; border-radius: 20px; background: #f8f8fa; border: 1px solid #f0f0f0;  cursor: pointer;">
                <div style="width: 50px; height: 50px; border-radius: 50%; background: #f0f0f0; display: flex; justify-content: center; align-items: center; margin-right: 15px; flex-shrink: 0; overflow: hidden; position: relative;">
                    ${userAvatarUrl ? `<img src="${userAvatarUrl}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i class="fas fa-user" style="color: #8e8e93; font-size: 24px;"></i>`}
                    <div style="position: absolute; bottom: 0; right: 0; width: 14px; height: 14px; border-radius: 50%; background: #34c759; border: 2px solid #fff;"></div>
                </div>
                <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 17px; font-weight: 600; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 8px;">
                            ${this.escapeHTML(userRemark)}
                            <div style="background: rgba(142,142,147,0.15); color: #8e8e93; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 6px; display: flex; align-items: center; gap: 3px;">
                                <i class="fas fa-thumbtack"></i> 置顶
                            </div>
                        </div>
                        <div style="font-size: 12px; color: #8e8e93; font-weight: 500;">${this.escapeHTML(latestTime)}</div>
                    </div>
                    <div style="font-size: 15px; color: #8e8e93; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${this.escapeHTML(latestMsg)}
                    </div>
                </div>
            </div>`;

            const userChatWrapper = document.createElement('div');
            userChatWrapper.innerHTML = userChatHTML;
            const userChatEl = userChatWrapper.firstElementChild;
            
            userChatEl.onclick = () => {
                const revChatView = document.getElementById('friend-reverse-chat-view');
                if (revChatView) {
                    if (window.openView) window.openView(revChatView);
                    document.getElementById('reverse-chat-user-name').textContent = userRemark;
                    const revAvatarImg = document.getElementById('reverse-chat-user-avatar');
                    const revAvatarIcon = document.getElementById('reverse-chat-user-icon');
                    if (userAvatarUrl) {
                        if (revAvatarImg) { revAvatarImg.src = userAvatarUrl; revAvatarImg.style.display = 'block'; }
                        if (revAvatarIcon) revAvatarIcon.style.display = 'none';
                    } else {
                        if (revAvatarImg) revAvatarImg.style.display = 'none';
                        if (revAvatarIcon) revAvatarIcon.style.display = 'block';
                    }
                    
                    const msgContainer = document.getElementById('reverse-chat-messages');
                    if (msgContainer) {
                        msgContainer.innerHTML = '<div class="friend-phone-context-note">已同步最近 10 条聊天上下文</div>';
                        const last10Msgs = window.lovesApp.getFriendPhoneUserContextMessages(friend, 10);
                        let lastRenderedTimestamp = 0;
                        last10Msgs.forEach(m => {
                            const messageTimestamp = Number(m.timestamp) || 0;
                            if (messageTimestamp > 0 && (!lastRenderedTimestamp || messageTimestamp - lastRenderedTimestamp >= 5 * 60 * 1000)) {
                                const timeDivider = document.createElement('div');
                                timeDivider.className = 'friend-phone-message-time-divider';
                                timeDivider.textContent = window.lovesApp.formatFriendPhoneGeneratedAt(messageTimestamp);
                                msgContainer.appendChild(timeDivider);
                            }
                            if (messageTimestamp > 0) lastRenderedTimestamp = messageTimestamp;
                            const div = document.createElement('div');
                            // 在 Char 视角，User 发来的消息在左边，Char 自己发出的消息在右边。
                            if (window.lovesApp.isFriendPhoneUserMessage(m)) {
                                div.className = 'reverse-bubble-left';
                            } else {
                                div.className = 'reverse-bubble-right';
                            }
                            const messageText = window.lovesApp.getFriendPhoneMessageText(m);
                            const translation = window.lovesApp.getFriendPhoneTranslation(m, 'text');
                            div.innerHTML = `<span>${window.lovesApp.escapeHTML(messageText).replace(/\n/g, '<br>')}</span>${translation ? `<span class="friend-phone-translation friend-phone-bubble-translation" hidden>${window.lovesApp.escapeHTML(translation).replace(/\n/g, '<br>')}</span>` : ''}`;
                            if (translation) {
                                div.classList.add('friend-phone-bubble-translatable');
                                div.setAttribute('role', 'button');
                                div.setAttribute('tabindex', '0');
                                div.setAttribute('aria-expanded', 'false');
                            }
                            msgContainer.appendChild(div);
                        });
                        setTimeout(() => msgContainer.scrollTop = msgContainer.scrollHeight, 50);
                    }
                }
            };
            imsgList.appendChild(userChatEl);
        }

        const currentChats = isMain ? mainChats : altChats;

        const extraChatsHTML = currentChats.map((chat, idx) => {
            const lastMsgObj = chat.messages && chat.messages.length > 0 ? chat.messages[0] : null;
            const lastMsgText = lastMsgObj ? lastMsgObj.text : '...';
            
            let avatarHtml = '<i class="fas fa-user" style="color: #8e8e93; font-size: 24px;"></i>';
            const fixedChatName = this.getFriendPhoneChineseContactName(chat, 'contactName');
            if (fixedChatName === '文件传输助手') avatarHtml = '<i class="fas fa-folder" style="color: #111; font-size: 20px;"></i>';
            else if (fixedChatName === '备忘录') avatarHtml = '<i class="fas fa-sticky-note" style="color: #111; font-size: 20px;"></i>';

            return `
            <div class="lovers-friend-imsg-item" data-idx="${idx}" style="display: flex; align-items: center; padding: 16px; border-radius: 20px; background: #fff;  cursor: pointer;" onclick="window.lovesApp.openGeneratedChat('${isMain ? 'main' : 'alt'}', ${idx}, '${encodeURIComponent(JSON.stringify(chat))}')">
                <div style="width: 50px; height: 50px; border-radius: 50%; background: #f0f0f0; display: flex; justify-content: center; align-items: center; margin-right: 15px; flex-shrink: 0;">
                    ${avatarHtml}
                </div>
                <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 17px; font-weight: 600; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHTML(fixedChatName)}</div>
                        <div style="font-size: 13px; color: #8e8e93;">${this.escapeHTML(this.formatFriendPhoneGeneratedAt(lastMsgObj?.generatedAt || chat.generatedAt) || '')}</div>
                    </div>
                    <div style="font-size: 15px; color: #8e8e93; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${lastMsgObj ? this.escapeHTML(lastMsgText) : '...'}</div>
                </div>
            </div>`;
        }).join('');
        
        if (extraChatsHTML) {
            const extraDiv = document.createElement('div');
            extraDiv.innerHTML = extraChatsHTML;
            while(extraDiv.firstChild) {
                imsgList.appendChild(extraDiv.firstChild);
            }
        } else if (!isMain) {
            const emptyMsg = document.createElement('div');
            emptyMsg.style.cssText = 'padding: 50px 20px; text-align: center; color: #8e8e93; font-size: 15px;';
            emptyMsg.innerHTML = '暂无短信记录<br><span style="font-size: 13px; margin-top: 8px; display: inline-block;">请在设置中生成</span>';
            imsgList.appendChild(emptyMsg);
        }

        setTimeout(() => {
            const imsgItems = imsgList.querySelectorAll('.lovers-friend-imsg-item');
            imsgItems.forEach(el => {
                window.lovesApp.bindLongPress(el, function() {
                    const idx = el.getAttribute('data-idx');
                    const chat = currentChats[idx];
                    window.lovesApp.showDeleteConfirm(chat.contactName, () => {
                        currentChats.splice(idx, 1);
                        window.lovesApp.renderFriendImsg(friend);
                    });
                });
            });
        }, 50);
    },

    openGeneratedChat: function(accType, idx, chatDataStr) {
        try {
            const chat = JSON.parse(decodeURIComponent(chatDataStr));
            const revChatView = document.getElementById('friend-reverse-chat-view');
            if (revChatView) {
                if (window.openView) window.openView(revChatView);
                document.getElementById('reverse-chat-user-name').textContent = this.getFriendPhoneChineseContactName(chat, 'contactName', '联系人');
                
                const revAvatarImg = document.getElementById('reverse-chat-user-avatar');
                const revAvatarIcon = document.getElementById('reverse-chat-user-icon');
                if (revAvatarImg) revAvatarImg.style.display = 'none';
                if (revAvatarIcon) revAvatarIcon.style.display = 'block';
                
                const msgContainer = document.getElementById('reverse-chat-messages');
                if (msgContainer) {
                    msgContainer.innerHTML = '';
                    const msgs = chat.messages || [];
                    let renderedBatchId = null;
                    msgs.forEach((m, messageIndex) => {
                        const currentBatchId = m.batchId || `legacy-${messageIndex}`;
                        if (currentBatchId !== renderedBatchId) {
                            renderedBatchId = currentBatchId;
                            const timeText = window.lovesApp.formatFriendPhoneGeneratedAt(m.generatedAt) || m.time || '';
                            if (timeText) {
                                const divider = document.createElement('div');
                                divider.className = 'friend-phone-message-time-divider';
                                divider.textContent = timeText;
                                msgContainer.appendChild(divider);
                            }
                        }
                        const div = document.createElement('div');
                        // 角色(char)是"我"，them是对方
                        if (m.sender === 'them') {
                            div.className = 'reverse-bubble-left';
                            div.style.background = '#fff';
                            div.style.color = '#111';
                            div.style.boxShadow = '0 2px 10px rgba(0,0,0,0.03)';
                        } else {
                            div.className = 'reverse-bubble-right';
                            div.style.background = '#111';
                            div.style.color = '#fff';
                            div.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';
                        }
                        const translation = window.lovesApp.getFriendPhoneTranslation(m, 'text');
                        div.innerHTML = `<span>${window.lovesApp.escapeHTML(m.text || '[特殊消息]').replace(/\n/g, '<br>')}</span>${translation ? `<span class="friend-phone-translation friend-phone-bubble-translation" hidden>${window.lovesApp.escapeHTML(translation).replace(/\n/g, '<br>')}</span>` : ''}`;
                        if (translation) {
                            div.classList.add('friend-phone-bubble-translatable');
                            div.setAttribute('role', 'button');
                            div.setAttribute('tabindex', '0');
                            div.setAttribute('aria-expanded', 'false');
                        }
                        msgContainer.appendChild(div);
                    });
                    setTimeout(() => { msgContainer.scrollTop = 0; }, 50);
                }
            }
        } catch(e) {
            console.error('Parse chat error', e);
        }
    },

    close: function() {
        if (this.view) {
            window.closeView(this.view);
            const detailArea = document.getElementById('loves-detail-area');
            if (detailArea) detailArea.style.display = 'none';
        }
    }
};

// Initialize when DOM is ready
(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    // 延迟初始化以确保 DOM 完全加载
    setTimeout(() => {
        if (window.lovesApp) {
            window.lovesApp.init();
        }
    }, 100);
});
