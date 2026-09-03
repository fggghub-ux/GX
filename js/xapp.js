(function() {
    (window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
        const appButton = document.getElementById('app-x-btn');
        const view = document.getElementById('x-view');
        const mainContent = view ? view.querySelector('.x-main-content') : null;
        const navItems = view ? Array.from(view.querySelectorAll('.x-nav-item[data-target]')) : [];
        const tabs = view ? Array.from(view.querySelectorAll('.x-tab-content')) : [];
        const indicator = document.getElementById('x-nav-indicator');
        const postDetailView = document.getElementById('x-post-detail-view');
        const postDetailBack = document.getElementById('x-post-detail-back');
        const topicDetailView = document.getElementById('x-topic-detail-view');
        const topicDetailBack = document.getElementById('x-topic-detail-back');
        const topicDetailGenerateBtn = document.getElementById('x-topic-detail-generate-btn');
        const topicDetailHeadline = document.getElementById('x-topic-detail-headline');
        const topicFeedPanel = document.getElementById('x-topic-feed-panel');
        const createTopicSheet = document.getElementById('x-create-topic-sheet');
        const createTopicCancelBtn = document.getElementById('x-create-topic-cancel-btn');
        const createTopicSaveBtn = document.getElementById('x-create-topic-save-btn');
        const createTopicBannerPreview = document.getElementById('x-create-topic-banner-preview');
        const createTopicBannerInput = document.getElementById('x-create-topic-banner-input');
        const createTopicAvatarPreview = document.getElementById('x-create-topic-avatar-preview');
        const createTopicAvatarInput = document.getElementById('x-create-topic-avatar-input');
        const createTopicNameInput = document.getElementById('x-create-topic-name-input');
        const createTopicFansInput = document.getElementById('x-create-topic-fans-input');
        const createTopicImportBtn = document.getElementById('x-topic-import-imessage-btn');
        const createTopicManualBtn = document.getElementById('x-topic-manual-char-btn');
        const createTopicImessageContainer = document.getElementById('x-topic-imessage-list-container');
        const createTopicManualContainer = document.getElementById('x-topic-manual-container');
        const createTopicCharsList = document.getElementById('x-topic-chars-list');
        const topicManualSaveBtn = document.getElementById('x-topic-manual-save-btn');
        const superUpdateBtn = document.getElementById('x-super-update-btn');
        
        let createTopicAvatarDraft = '';
        let createTopicBannerDraft = '';
        let createTopicSelectedChars = [];
        let editSuperTopicSheet = null;
        let currentEditingSuperTopicId = null;
        let editSuperTopicAvatarDraft = '';
        let editSuperTopicBannerDraft = '';
        let editSuperTopicSelectedChars = [];

        const editSheet = document.getElementById('x-edit-profile-sheet');
        const settingsSheet = document.getElementById('x-settings-sheet');
        const composeSheet = document.getElementById('x-compose-sheet');
        const settingsButton = document.getElementById('x-profile-settings-btn');
        const editCancelButton = document.getElementById('x-edit-cancel-btn');
        const editSaveButton = document.getElementById('x-edit-save-btn');
        const settingsCloseButton = document.getElementById('x-settings-close-btn');
        const settingsWorldBookButton = document.getElementById('x-settings-worldbook-btn');
        const composeCancelButton = document.getElementById('x-compose-cancel-btn');
        const composeSubmitButton = document.getElementById('x-compose-submit-btn');
        const composeTextInput = document.getElementById('x-compose-text-input');
        const composeTopicInput = document.getElementById('x-compose-topic-input');
        const composeSuperChip = document.getElementById('x-compose-super-chip');
        const composeSuperName = document.getElementById('x-compose-super-name');
        const composeImageButton = document.getElementById('x-compose-image-placeholder');
        const composeImageInput = document.getElementById('x-compose-image-input');
        const composeImagePreview = document.getElementById('x-compose-image-preview');
        const composeImageClearButton = document.getElementById('x-compose-image-clear-btn');
        const composeImageUrlInput = document.getElementById('x-compose-image-url-input');
        const composeImageUrlButton = document.getElementById('x-compose-image-url-btn');
        const editAvatarPreview = document.getElementById('x-edit-avatar-preview');
        const editAvatarInput = document.getElementById('x-edit-avatar-input');
        const editBannerPreview = document.getElementById('x-edit-banner-preview');
        const editBannerInput = document.getElementById('x-edit-banner-input');
        const editNameInput = document.getElementById('x-edit-name-input');
        const editHandleInput = document.getElementById('x-edit-handle-input');
        const editBioInput = document.getElementById('x-edit-bio-input');
        const editPersonaInput = document.getElementById('x-edit-persona-input');
        const editFollowingInput = document.getElementById('x-edit-following-input');
        const editFollowersInput = document.getElementById('x-edit-followers-input');
        const closeButtons = [
            document.getElementById('x-back-btn'),
            document.getElementById('x-profile-close-btn')
        ].filter(Boolean);

        if (!view || !appButton || navItems.length === 0 || tabs.length === 0) return;

        const nextDayBtn = document.getElementById('x-next-day-btn');
        const trendList = document.getElementById('x-trend-list');

        const defaultProfile = {
            name: 'User Name',
            handle: '@username',
            bio: '',
            persona: '',
            avatar: '',
            banner: '',
            following: 8,
            followers: 190000,
            profileStatsEdited: false
        };

        const defaultTrends = [
            { id: 'default-stage-style', title: '#ParisFashionWeek', category: 'Fashion · Trending', heat: '248K', movement: 'none' },
            { id: 'default-topic-host', title: '#LVMHResults', category: 'Business · Trending', heat: '19.8K', movement: 'none' },
            { id: 'default-citywalk', title: '#ChristiesAuction', category: 'Art · Rising', heat: '14.6K', movement: 'none' }
        ];
        const defaultAdvancePreferences = {
            strangersEnabled: true,
            strangersCount: 5,
            trendsEnabled: true,
            trendsCount: 3,
            postsEnabled: true,
            postsCount: 3
        };
        const defaultImessageContextMount = Object.freeze({
            enabled: true,
            limit: 20
        });

        const defaultXState = {
            xData: { ...defaultProfile, edited: false },
            xPlayerAccounts: [],
            activeXPlayerAccountId: '',
            xAccountSchemaVersion: 1,
            xCharIdentityMigrationVersion: 0,
            xCharProfileMediaMigrationVersion: 0,
            xTopics: [],
            boundWorldBookIds: [],
            xVisitors: [],
            xDirectMessages: [],
            xPostThreads: {},
            xGeneratedPosts: [],
            xAccounts: [],
            xTrends: defaultTrends.map((trend) => ({ ...trend })),
            xAdvancePreferences: { ...defaultAdvancePreferences },
            xHomeBannerUrl: '',
            xSearchBannerUrl: ''
        };
        const xImageCompressionPresets = Object.freeze({
            avatar: Object.freeze({ maxWidth: 512, maxHeight: 512, quality: 0.82 }),
            cover: Object.freeze({ maxWidth: 1600, maxHeight: 900, quality: 0.82 }),
            post: Object.freeze({ maxWidth: 1600, maxHeight: 1600, quality: 0.82 })
        });
        const xAcceptedImageTypes = new Set(['image/jpeg', 'image/jpg', 'image/png']);
        const maxXTrends = 15;
        const xLandscapeAvatarImages = Object.freeze([
            'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=256&h=256&q=82&sat=-100',
            'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=256&h=256&q=82&sat=-100',
            'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=256&h=256&q=82&sat=-100',
            'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=256&h=256&q=82&sat=-100',
            'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=256&h=256&q=82&sat=-100',
            'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=256&h=256&q=82&sat=-100',
            'https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=256&h=256&q=82&sat=-100',
            'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=256&h=256&q=82&sat=-100'
        ]);

        const postData = {
            island: {
                avatar: 'D',
                name: 'Daniel Kehoe',
                handle: '@Kehoe · 12m',
                text: '首页信息流先按微博的阅读节奏排，保留热搜、转评赞和图文密度，但整体收进 X 的黑白系统里。',
                reposts: '41',
                likes: '7.1K',
                comments: '118',
                commentList: [
                    { avatar: 'A', name: 'Akira', handle: '@akira · 4m', text: '这个层级更像微博，但底色和按钮都很 X。' },
                    { avatar: 'M', name: 'Mina', handle: '@mina · 2m', text: '评论区做成卡片之后，帖子详情就完整很多。' },
                    { avatar: 'S', name: 'Sora', handle: '@sora · now', text: '图片区域保留静态占位也够看排版了。' }
                ]
            },
            super: {
                avatar: '超',
                name: '超话精选',
                handle: '@super · 28m',
                text: '今日签到人数上涨 24%，热门讨论集中在企业项目动向、品牌活动、近期展览动态。',
                reposts: '301',
                likes: '8.8K',
                comments: '89',
                commentList: [
                    { avatar: '#', name: 'Topic Bot', handle: '@topic · 9m', text: '本季高定时装已经进入超话热帖榜。' },
                    { avatar: 'L', name: 'Luna', handle: '@luna · 3m', text: '超话页和详情页之间的关系现在更明确。' }
                ]
            },
            following: {
                avatar: 'M',
                name: 'Mina',
                handle: '@mina · 6m',
                text: 'Following 里先放关注流的静态样式。后续接账号或角色关系时，可以直接把关注对象的帖子渲染进这里。',
                reposts: '9',
                likes: '642',
                comments: '18',
                commentList: [
                    { avatar: 'U', name: 'User', handle: '@user · 1m', text: '关注页用静态占位就能先验证切换体验。' }
                ]
            },
            profile: {
                avatar: 'U',
                name: 'User Name',
                handle: '@username · pinned',
                text: '个人主页内容卡片先保持静态，重点是排版、层级和底栏切换体验。',
                reposts: '12',
                likes: '520',
                comments: '34',
                commentList: [
                    { avatar: 'X', name: 'X App', handle: '@xapp · now', text: '这条来自个人页 Posts 分栏。' }
                ]
            }
        };

        let currentIndex = 0;
        let touchStartX = 0;
        let touchStartY = 0;
        let isTouching = false;
        let currentProfile = { ...defaultProfile };
        let profileEditorMode = 'edit';
        let accountSwitchSheet = null;
        let xAccountSwitchInFlight = false;
        let avatarDraft = currentProfile.avatar || '';
        let bannerDraft = currentProfile.banner || '';
        let tempPostCounter = 0;
        let currentDetailPostId = null;
        let replyTarget = null;
        let visitorsSheet = null;
        let visitorsList = null;
        let addDmSheet = null;
        let imessageCharList = null;
        let dmList = null;
        let manualCharNameInput = null;
        let manualCharHandleInput = null;
        let manualCharBioInput = null;
        let manualCharPersonaInput = null;
        let dmChatView = null;
        let dmChatMessagesEl = null;
        let dmChatInput = null;
        let dmSettingsSheet = null;
        let dmProfileView = null;
        let currentProfileIdentity = null;
        let charEditSheet = null;
        let currentEditingCharId = null;
        let charEditAvatarDraft = '';
        let charEditCoverSeed = '';
        let charEditCoverImageDraft = '';
        let charProfileGenerateSheet = null;
        let currentGeneratingCharId = null;
        let charProfileGenerationInFlight = false;
        let charProfileReferenceDraft = '';
        let charProfileReferenceFileNameDraft = '';
        let charProfileReferenceChanged = false;
        let charProfilePresetDrafts = [];
        let postForwardSheet = null;
        let currentForwardPostId = null;
        let currentDmId = null;
        let searchGenerateSheet = null;
        let searchGenerateInput = null;
        let searchGenerateMode = 'home';
        let advanceSheet = null;
        let advancePlotInput = null;
        let imagePreviewOverlay = null;
        let currentTopicContext = null;
        let postSettingsSheet = null;
        let currentActionPostId = null;
        let currentComposeSuperId = null;
        let composeImageDraft = '';
        const postVisionRuns = new Set();
        let xChromeInitialized = false;
        let xEventsInitialized = false;
        const xHomeFeedInitialLimit = 20;
        const xHomeFeedPageSize = 20;
        let xHomeFeedRenderLimit = xHomeFeedInitialLimit;
        let xHomeFeedTotalPosts = 0;
        let xHomeFeedRenderKey = '';
        let cachedNormalizedXState = null;
        let cachedNormalizedXRevision = -1;
        let fallbackXStateRevision = 0;
        let xOpenMaintenancePromise = null;

        function safeText(value, fallback = '') {
            const text = String(value == null ? '' : value).trim();
            return text || fallback;
        }

        function escapeHtml(value) {
            return String(value == null ? '' : value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function parseCompactCount(value) {
            const raw = String(value == null ? '0' : value).trim().replace(/,/g, '');
            const match = raw.match(/^([\d.]+)\s*([Kk万])?$/);
            if (!match) return Number(raw) || 0;
            const number = Number(match[1]) || 0;
            if (match[2] === '万') return Math.round(number * 10000);
            if (match[2] && match[2].toLowerCase() === 'k') return Math.round(number * 1000);
            return Math.round(number);
        }

        function normalizeProfileCount(value, fallback = 0) {
            const raw = String(value == null ? '' : value).trim().replace(/,/g, '');
            if (!raw) return Math.max(0, Math.round(Number(fallback) || 0));
            const parsed = Number(raw);
            if (!Number.isFinite(parsed) || parsed < 0) return Math.max(0, Math.round(Number(fallback) || 0));
            return Math.min(Number.MAX_SAFE_INTEGER, Math.round(parsed));
        }

        function formatCompactCount(value) {
            const count = Math.max(0, Number(value) || 0);
            if (count >= 10000) return `${(count / 10000).toFixed(count >= 100000 ? 0 : 1).replace(/\.0$/, '')}万`;
            if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1).replace(/\.0$/, '')}K`;
            return String(count);
        }

        function makeLocalId(prefix) {
            return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        }

        function hashPostMetricSeed(value) {
            let hash = 2166136261;
            const text = String(value || 'post');
            for (let index = 0; index < text.length; index += 1) {
                hash ^= text.charCodeAt(index);
                hash = Math.imul(hash, 16777619);
            }
            return hash >>> 0;
        }

        function getFrontendPostMetrics(postId) {
            const likes = 300 + (hashPostMetricSeed(`${postId}:likes`) % 29701);
            const repostLimit = Math.max(25, Math.floor(likes * 0.24));
            const reposts = 10 + (hashPostMetricSeed(`${postId}:reposts`) % repostLimit);
            return { likes, reposts };
        }

        function getStableLandscapeAvatar(seed) {
            const index = hashPostMetricSeed(`x-avatar:${safeText(seed, 'account')}`) % xLandscapeAvatarImages.length;
            return xLandscapeAvatarImages[index];
        }

        function normalizePersonAvatar(value, seed = '') {
            const avatar = safeText(value);
            const isImageSource = /^(?:data:image\/|blob:|https?:\/\/|\/|\.\.?\/|assets\/)/i.test(avatar)
                || /\.(?:avif|jpe?g|png|webp)(?:[?#].*)?$/i.test(avatar);
            return isImageSource ? avatar : getStableLandscapeAvatar(seed || avatar || 'account');
        }

        function buildAvatarHtml(value, fallback = '?') {
            const avatar = normalizePersonAvatar(value, fallback);
            return `<img src="${escapeHtml(avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
        }

        function buildAuthorAvatarButton(author = {}, className = 'x-avatar') {
            const identity = resolveXAuthorIdentity(author.authorId, author.handle, author.name, author.avatar);
            return `<button class="${escapeHtml(className)} x-author-avatar-btn" type="button" data-x-author-id="${escapeHtml(identity.id)}" data-x-author-name="${escapeHtml(identity.name)}" data-x-author-handle="${escapeHtml(identity.handle)}" data-x-author-avatar="${escapeHtml(identity.avatar)}" aria-label="查看 ${escapeHtml(identity.name)} 的主页">${buildAvatarHtml(identity.avatar, identity.name)}</button>`;
        }

        function getCurrentCommentAuthor() {
            const name = safeText(currentProfile.name, 'Me');
            return {
                authorId: 'me',
                avatar: normalizePersonAvatar(currentProfile.avatar, `me:${currentProfile.handle || name}`),
                name,
                handle: `${currentProfile.handle || '@me'} · now`
            };
        }

        function normalizeApiEndpoint(config = {}) {
            const endpoint = safeText(config.endpoint);
            return endpoint ? window.u2Api.resolveChatCompletionsEndpoint(endpoint) : '';
        }

        function buildXUserBoundaryPrompt() {
            const profile = currentProfile || {};
            return `HIGHEST-PRIORITY IDENTITY BOUNDARY:
The current User (${safeText(profile.name, 'User')} ${safeText(profile.handle, '@user')}) is controlled exclusively by the human. Treat the User profile, persona, posts, comments, replies, and chat messages as read-only context.
Never generate or invent any outbound post, comment, reply, quote, private message, or other social action authored by the User. Never use the User's name, handle, avatar, account identity, or authorId "me" as the author of generated content.
Generate content only for explicitly requested non-User characters or accounts. When replying in private messages, speak only as the named Char or incoming stranger, never as the User. If a task requests reactions to User content, generate only other accounts reacting to it.

INTERNATIONAL X CONTENT RULE:
X is a global app. Non-User authors may write in the language that naturally fits their identity, location, persona and context; do not force everyone to write in Chinese. In every JSON object containing user-facing text, comment, reply, bio or private-message content, include a sibling "translation" field. If the original content is not Simplified Chinese, "translation" must be an accurate, natural Simplified Chinese translation. If the original is already Simplified Chinese, set "translation" to an empty string. Arrays of private messages must use objects shaped as {"text":"","translation":""}, not bare strings. Image descriptions may use Simplified Chinese for reliable rendering.`;
        }

        async function requestXChatCompletion(messages, options = {}) {
            const config = typeof window.getApiConfig === 'function' ? window.getApiConfig() : (window.apiConfig || {});
            const endpoint = normalizeApiEndpoint(config);
            if (!endpoint || !config.apiKey) throw new Error('API config missing');
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    model: config.model || 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: buildXUserBoundaryPrompt() },
                        ...(Array.isArray(messages) ? messages : [])
                    ],
                    temperature: parseFloat(config.temperature) || options.temperature || 0.8
                })
            });
            if (!response.ok) throw new Error(`API ${response.status}`);
            const data = await response.json();
            return data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
        }

        function parseJsonPayload(text) {
            const raw = safeText(text);
            if (!raw) throw new Error('Empty API response');
            try {
                return JSON.parse(raw);
            } catch (error) {
                const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
                if (match) return JSON.parse(match[1]);
                throw error;
            }
        }

        function normalizeWorldBookIds(ids = []) {
            return (Array.isArray(ids) ? ids : [])
                .map(String)
                .filter((id, index, allIds) => id && allIds.indexOf(id) === index);
        }

        function getCharacterBoundWorldBookIds(characters = []) {
            const list = Array.isArray(characters) ? characters : [characters];
            const runtimeFriends = Array.isArray(window.imData?.friends) ? window.imData.friends : [];
            return normalizeWorldBookIds(list.flatMap((character) => {
                if (!character || typeof character !== 'object') return [];
                const sourceFriendId = character.sourceFriendId
                    || (character.origin === 'imessage' ? character.id : null);
                const sourceFriend = sourceFriendId == null
                    ? null
                    : runtimeFriends.find((friend) => String(friend?.id) === String(sourceFriendId));
                return [
                    ...(Array.isArray(character.boundBooks) ? character.boundBooks : []),
                    ...(Array.isArray(character.boundWorldBookIds) ? character.boundWorldBookIds : []),
                    ...(Array.isArray(sourceFriend?.boundBooks) ? sourceFriend.boundBooks : [])
                ];
            }));
        }

        function getSelectedWorldBookContext(extraText = '', extraBookIds = []) {
            const state = getXState();
            const selected = new Set(normalizeWorldBookIds([
                ...(state.boundWorldBookIds || []),
                ...normalizeWorldBookIds(extraBookIds)
            ]));
            const parts = [];
            if (typeof window.getWorldBooks === 'function') {
                window.getWorldBooks().forEach((book) => {
                    const isSelected = selected.has(String(book.id));
                    if (!isSelected && !book.isGlobal) return;
                    const lines = (Array.isArray(book.entries) ? book.entries : [])
                        .filter((entry) => entry && entry.enabled !== false)
                        .map((entry) => `- ${entry.keyword || entry.title || book.name}: ${entry.content || ''}`)
                        .filter((line) => line.trim() !== '- :');
                    if (lines.length) parts.push(`[WorldBook: ${book.name || book.id}]\n${lines.join('\n')}`);
                });
            }
            if (typeof window.getBuiltinWorldBookEntries === 'function') {
                const builtinLines = window.getBuiltinWorldBookEntries()
                    .filter((entry) => entry && entry.enabled !== false)
                    .filter((entry) => !entry.keyword || !window.worldBookKeywordMatched || window.worldBookKeywordMatched(entry, extraText))
                    .slice(0, 12)
                    .map((entry) => `- ${entry.keyword || entry.title || 'builtin'}: ${entry.content || ''}`);
                if (builtinLines.length) parts.push(`[Built-in WorldBook]\n${builtinLines.join('\n')}`);
            }
            return parts.join('\n\n');
        }

        function isCurrentXUserAuthor(raw = {}) {
            const authorId = safeText(raw.authorId || raw.accountId || raw.id).toLocaleLowerCase();
            if (authorId === 'me' || authorId === 'user:self' || authorId === 'current-user') return true;

            const candidateHandle = safeText(raw.handle || raw.authorHandle || raw.accountHandle);
            const userHandle = safeText(currentProfile?.handle);
            if (candidateHandle && userHandle
                && canonicalAccountHandle(candidateHandle, raw.authorName || raw.name) === canonicalAccountHandle(userHandle, currentProfile?.name)) {
                return true;
            }

            const candidateName = safeText(raw.authorName || raw.name || raw.displayName).toLocaleLowerCase();
            const userName = safeText(currentProfile?.name).toLocaleLowerCase();
            return !!candidateName && !!userName && candidateName === userName;
        }

        function sanitizeApiGeneratedComment(rawComment) {
            if (!rawComment || typeof rawComment !== 'object' || isCurrentXUserAuthor(rawComment)) return null;
            const sanitized = { ...rawComment };
            if (Array.isArray(rawComment.replies)) {
                sanitized.replies = rawComment.replies.map(sanitizeApiGeneratedComment).filter(Boolean);
            }
            return sanitized;
        }

        function sanitizeApiGeneratedPost(rawPost, options = {}) {
            if (!rawPost || typeof rawPost !== 'object') return null;
            if (!options.forceOuterAuthor && isCurrentXUserAuthor(rawPost)) return null;
            const sanitized = { ...rawPost };
            if (Array.isArray(rawPost.comments)) {
                sanitized.comments = rawPost.comments.map(sanitizeApiGeneratedComment).filter(Boolean);
            }
            if (Array.isArray(rawPost.commentList)) {
                sanitized.commentList = rawPost.commentList.map(sanitizeApiGeneratedComment).filter(Boolean);
            }
            if (rawPost.refPost) sanitized.refPost = sanitizeApiGeneratedPost(rawPost.refPost);
            return sanitized;
        }

        function sanitizeApiGeneratedPosts(rawPosts, options = {}) {
            return (Array.isArray(rawPosts) ? rawPosts : [])
                .map((post) => sanitizeApiGeneratedPost(post, options))
                .filter(Boolean);
        }

        function sanitizeApiGeneratedAuthors(items = []) {
            return (Array.isArray(items) ? items : []).filter((item) => item && !isCurrentXUserAuthor(item));
        }

        function reconcileTopicCharacterAuthors(rawPosts, topic, cloneAccountIds = new Set()) {
            const topicChars = (Array.isArray(topic?.chars) ? topic.chars : []).map((char) => {
                const name = safeText(char?.name || char?.nickname || char?.realName, 'Char');
                return {
                    id: String(char?.id || char?.sourceFriendId || ''),
                    sourceFriendId: safeText(char?.sourceFriendId),
                    name,
                    handle: makeHandle(name, char?.handle || char?.realName || char?.signature || name),
                    avatar: safeText(char?.avatar || char?.avatarUrl)
                };
            }).filter((char) => char.id && char.name);
            if (!topicChars.length) return Array.isArray(rawPosts) ? rawPosts : [];

            const uniqueNameCounts = topicChars.reduce((counts, char) => {
                const key = char.name.toLocaleLowerCase();
                counts.set(key, (counts.get(key) || 0) + 1);
                return counts;
            }, new Map());
            const findChar = (raw) => {
                if (!raw || typeof raw !== 'object') return null;
                const authorId = safeText(raw.authorId || raw.accountId);
                const authorName = safeText(raw.authorName || raw.name || raw.displayName);
                const authorHandle = canonicalAccountHandle(raw.handle || raw.authorHandle, authorName);
                return topicChars.find((char) => authorId && (authorId === char.id || authorId === char.sourceFriendId))
                    || topicChars.find((char) => authorHandle && authorHandle === canonicalAccountHandle(char.handle, char.name))
                    || topicChars.find((char) => {
                        const key = authorName.toLocaleLowerCase();
                        return key && uniqueNameCounts.get(key) === 1 && char.name.toLocaleLowerCase() === key;
                    })
                    || null;
            };
            const reconcileAuthor = (raw) => {
                if (!raw || typeof raw !== 'object') return raw;
                const matched = findChar(raw);
                if (matched) {
                    const previousAuthorId = safeText(raw.authorId || raw.accountId);
                    if (previousAuthorId && previousAuthorId !== matched.id) cloneAccountIds.add(previousAuthorId);
                    raw.authorId = matched.id;
                    delete raw.accountId;
                    raw.authorName = matched.name;
                    raw.name = matched.name;
                    raw.handle = matched.handle;
                    raw.authorHandle = matched.handle;
                    if (matched.avatar) {
                        raw.authorAvatar = matched.avatar;
                        raw.avatar = matched.avatar;
                    }
                }
                const comments = Array.isArray(raw.comments) ? raw.comments : (Array.isArray(raw.commentList) ? raw.commentList : []);
                comments.forEach(reconcileAuthor);
                if (raw.refPost) reconcileAuthor(raw.refPost);
                return raw;
            };
            return (Array.isArray(rawPosts) ? rawPosts : []).map(reconcileAuthor);
        }

        async function migrateActiveXCharIdentities() {
            const state = getXState();
            if (state.xCharIdentityMigrationVersion >= 1) return state;
            const cloneAccountIds = new Set();
            const topics = Array.isArray(state.xTopics) ? state.xTopics : [];
            const posts = (state.xGeneratedPosts || []).map((post) => ({ ...post }));
            topics.forEach((topic) => {
                const topicPosts = posts.filter((post) => (
                    String(post.superTopicId || '') === String(topic.id || topic.name || '')
                    || (!post.superTopicId && safeText(post.superTopicName) === safeText(topic.name || topic.title))
                ));
                reconcileTopicCharacterAuthors(topicPosts, topic, cloneAccountIds);
            });
            const migrated = saveXState({
                ...state,
                xGeneratedPosts: posts,
                xAccounts: (state.xAccounts || []).filter((account) => !cloneAccountIds.has(String(account.id))),
                xCharIdentityMigrationVersion: 1
            });
            await flushXStateNow('x-char-identity-migration');
            return migrated;
        }

        function isLegacyCharProfileRandomImage(image) {
            const url = safeText(image?.url || image?.src || image?.imageUrl);
            return /^https:\/\/picsum\.photos\//i.test(url);
        }

        async function migrateActiveXCharProfileMedia() {
            const state = getXState();
            if (state.xCharProfileMediaMigrationVersion >= 2) return state;
            const normalizedDirectMessages = (state.xDirectMessages || []).map((item) => ({
                ...item,
                profilePosts: (item.profilePosts || []).map((post) => ({
                    ...post,
                    images: (Array.isArray(post.images) ? post.images : [])
                        .filter((image) => !isLegacyCharProfileRandomImage(image))
                }))
            }));
            const existingProfilePosts = normalizedDirectMessages
                .flatMap((item) => item.profilePosts || []);
            const migrated = saveXState({
                ...state,
                xDirectMessages: normalizedDirectMessages,
                xGeneratedPosts: prependUniquePosts(state.xGeneratedPosts || [], existingProfilePosts),
                xCharProfileMediaMigrationVersion: 2
            });
            await flushXStateNow('x-char-profile-media-migration');
            return migrated;
        }

        function getGeneratedTranslation(raw = {}, originalText = '') {
            const translation = safeText(
                raw.translation || raw.translationZh || raw.zhTranslation || raw.translatedText || raw.textZh || raw.chineseTranslation
            );
            return translation && translation !== safeText(originalText) ? translation : '';
        }

        function normalizeGeneratedComment(comment, fallbackIndex = 0) {
            const text = safeText(comment.text || comment.content);
            if (!text) return null;
            const name = safeText(comment.authorName || comment.name || comment.handle);
            if (!name) return null;
            const identity = resolveXAuthorIdentity(comment.authorId || comment.accountId, comment.handle, name, comment.authorAvatar || comment.avatar);
            return {
                id: String(comment.id || makeLocalId('comment')),
                authorId: identity.id,
                avatar: identity.avatar,
                name: identity.name,
                handle: identity.handle,
                text,
                translation: getGeneratedTranslation(comment, text),
                replies: (Array.isArray(comment.replies) ? comment.replies : []).map((reply, index) => {
                    const replyText = safeText(reply.text || reply.content);
                    if (!replyText) return null;
                    const replyName = safeText(reply.authorName || reply.name || reply.handle);
                    if (!replyName) return null;
                    const replyIdentity = resolveXAuthorIdentity(reply.authorId || reply.accountId, reply.handle, replyName, reply.authorAvatar || reply.avatar);
                    return {
                        id: String(reply.id || makeLocalId('reply')),
                        authorId: replyIdentity.id,
                        avatar: replyIdentity.avatar,
                        name: replyIdentity.name,
                        handle: replyIdentity.handle,
                        text: replyText,
                        translation: getGeneratedTranslation(reply, replyText),
                        replies: []
                    };
                }).filter(Boolean)
            };
        }

        function normalizeGeneratedPost(raw, index = 0) {
            const authorName = safeText(raw.authorName || raw.name || raw.handle || raw.authorHandle);
            if (!authorName) return null;
            const identity = resolveXAuthorIdentity(raw.authorId || raw.accountId, raw.handle || raw.authorHandle, authorName, raw.authorAvatar || raw.avatar);
            const id = String(raw.id || makeLocalId('xgen'));
            const frontendMetrics = getFrontendPostMetrics(id);
            const text = safeText(raw.text || raw.desc || raw.content);
            if (!text && !raw.isMoment) return null;
            const imageText = safeText(raw.imageText || raw.imagePrompt || raw.image || raw.picture || raw.mediaDescription);
            const rawImages = Array.isArray(raw.images) ? raw.images : [];
            const images = rawImages.length > 0
                ? rawImages.map((image, imageIndex) => ({
                    id: String(image.id || `${id}-image-${imageIndex}`),
                    text: safeText(image.text || image.prompt || image.description || image.alt || imageText),
                    url: safeText(image.url || image.src || image.imageUrl),
                    assetId: safeText(image.assetId || image.imageAssetId),
                    imageSource: safeText(image.imageSource),
                    imageProvider: safeText(image.imageProvider),
                    imageModel: safeText(image.imageModel),
                    imageSize: safeText(image.imageSize),
                    faceReferenceUsed: image.faceReferenceUsed === true,
                    vision: image?.vision && typeof image.vision === 'object' ? { ...image.vision } : undefined
                }))
                : (imageText || raw.mediaType === 'image'
                    ? [{ id: `${id}-image-0`, text: imageText, url: '' }]
                    : []);
            const rawComments = Array.isArray(raw.comments)
                ? raw.comments
                : (Array.isArray(raw.commentList) ? raw.commentList : []);
            const comments = rawComments
                .map((comment, commentIndex) => normalizeGeneratedComment(comment, commentIndex))
                .filter(Boolean);
            return {
                id,
                authorId: identity.id,
                avatar: identity.avatar,
                name: identity.name,
                handle: identity.handle,
                text,
                translation: getGeneratedTranslation(raw, text),
                reposts: formatCompactCount(frontendMetrics.reposts),
                likes: formatCompactCount(frontendMetrics.likes),
                comments: formatCompactCount(Math.max(Number(raw.commentsCount) || 0, comments.length)),
                commentList: comments,
                images,
                generated: true,
                topicTag: raw.topicTag || '',
                superTopicId: safeText(raw.superTopicId),
                superTopicName: safeText(raw.superTopicName),
                isMoment: !!raw.isMoment,
                actionText: safeText(raw.actionText),
                refPost: raw.refPost ? normalizeGeneratedPost(raw.refPost, 0) : null,
                isFeatured: !!raw.isFeatured,
                profileOwnerId: safeText(raw.profileOwnerId),
                createdAt: raw.createdAt || Date.now()
            };
        }

        function getPostImages(post) {
            return (Array.isArray(post?.images) ? post.images : [])
                .filter((image) => safeText(image?.url));
        }

        function renderPostImages(images = []) {
            if (!images.length) return '';
            return `
                <div class="x-generated-media-grid">
                    ${images.slice(0, 4).map((image) => `
                        <button class="x-post-image-thumb" type="button" data-image-text="${escapeHtml(image.text || 'Image')}" data-image-url="${escapeHtml(image.url || '')}">
                            <img src="${escapeHtml(image.url)}" alt="" onerror="this.remove()">
                        </button>
                    `).join('')}
                </div>
            `;
        }

        function makeHandle(name, handle) {
            const raw = safeText(handle);
            if (raw) return raw.startsWith('@') ? raw : `@${raw}`;
            const base = safeText(name, 'user')
                .toLowerCase()
                .replace(/[^a-z0-9_\u4e00-\u9fa5]+/gi, '');
            return `@${base || 'user'}`;
        }

        function canonicalAccountHandle(handle, name = '') {
            const raw = safeText(handle).split('·')[0].trim();
            return makeHandle(name, raw || name).toLocaleLowerCase();
        }

        function getTopicCharacterIdentities(state = getXState()) {
            const identities = [];
            const seen = new Set();
            (state.xTopics || []).forEach((topic) => {
                (Array.isArray(topic?.chars) ? topic.chars : []).forEach((char) => {
                    if (!char || typeof char !== 'object') return;
                    const name = safeText(char.name || char.nickname || char.realName, 'Char');
                    const id = String(char.id || char.sourceFriendId || `${topic.id || topic.name}:${name}`);
                    const key = `${id}|${canonicalAccountHandle(char.handle, name)}`;
                    if (seen.has(key)) return;
                    seen.add(key);
                    identities.push({
                        id,
                        sourceFriendId: safeText(char.sourceFriendId),
                        name,
                        handle: makeHandle(name, char.handle || char.realName || char.signature || name),
                        avatar: normalizePersonAvatar(char.avatar || char.avatarUrl, `topic-char:${id}`),
                        bio: safeText(char.bio || char.signature),
                        persona: safeText(char.persona || char.characterPersona || char.systemPrompt),
                        coverSeed: safeText(char.coverSeed, `${id}-cover`),
                        coverImage: safeText(char.coverImage),
                        kind: 'topic-char'
                    });
                });
            });
            return identities;
        }

        function findTopicCharacterIdentity(authorId, handle, name, state = getXState()) {
            const requestedId = safeText(authorId);
            const requestedHandle = canonicalAccountHandle(handle, name);
            const identities = getTopicCharacterIdentities(state);
            return identities.find((identity) => requestedId && (
                String(identity.id) === requestedId || String(identity.sourceFriendId || '') === requestedId
            )) || identities.find((identity) => requestedHandle && canonicalAccountHandle(identity.handle, identity.name) === requestedHandle)
                || null;
        }

        function makeAccountId(handle, name = '') {
            const key = canonicalAccountHandle(handle, name)
                .replace(/^@/, '')
                .replace(/[^a-z0-9_\u4e00-\u9fa5-]+/gi, '-');
            return `account:${key || safeText(name, 'user').toLocaleLowerCase()}`;
        }

        function getStableExternalImage(seed, width = 1200, height = 480) {
            const safeSeed = encodeURIComponent(safeText(seed, 'x-image').replace(/\s+/g, '-'));
            return `https://picsum.photos/seed/${safeSeed}/${width}/${height}?grayscale`;
        }

        function normalizeXAccount(raw = {}, index = 0) {
            const name = safeText(raw.name || raw.authorName || raw.handle, 'X User');
            const handle = makeHandle(name, raw.handle || raw.authorHandle || name);
            const id = String(raw.id || raw.authorId || makeAccountId(handle, name));
            return {
                id,
                name,
                handle,
                avatar: normalizePersonAvatar(raw.avatar || raw.authorAvatar, `${id}:${handle}`),
                bio: safeText(raw.bio || raw.signature, '暂无简介'),
                persona: safeText(raw.persona),
                coverSeed: safeText(raw.coverSeed, `${id}-${index}-cover`),
                isFollowing: raw.isFollowing !== false,
                source: safeText(raw.source, 'generated'),
                createdAt: Number(raw.createdAt) || Date.now()
            };
        }

        function normalizeXAccounts(items = []) {
            const seen = new Set();
            return (Array.isArray(items) ? items : [])
                .map((item, index) => normalizeXAccount(item, index))
                .filter((item) => {
                    if (seen.has(item.id)) return false;
                    seen.add(item.id);
                    return true;
                });
        }

        function clampAdvanceCount(value, fallback, maximum = 20) {
            const parsed = Number.parseInt(value, 10);
            if (!Number.isFinite(parsed)) return fallback;
            return Math.min(maximum, Math.max(1, parsed));
        }

        function normalizeAdvancePreferences(raw = {}) {
            const source = raw && typeof raw === 'object' ? raw : {};
            return {
                strangersEnabled: source.strangersEnabled !== false,
                strangersCount: clampAdvanceCount(source.strangersCount, defaultAdvancePreferences.strangersCount),
                trendsEnabled: source.trendsEnabled !== false,
                trendsCount: clampAdvanceCount(source.trendsCount, defaultAdvancePreferences.trendsCount, maxXTrends),
                postsEnabled: source.postsEnabled !== false,
                postsCount: clampAdvanceCount(source.postsCount, defaultAdvancePreferences.postsCount)
            };
        }

        function normalizeTrend(raw = {}, index = 0) {
            let title = safeText(raw.title || raw.topic || raw.name || raw.keyword);
            if (!title) return null;
            if (!title.startsWith('#')) title = `#${title.replace(/^#+/, '')}`;
            const category = safeText(raw.category || raw.label || raw.type, 'Trending');
            const heatValue = raw.heat ?? raw.count ?? raw.score ?? raw.hotness;
            const heat = typeof heatValue === 'number'
                ? formatCompactCount(heatValue)
                : safeText(heatValue, 'Trending');
            return {
                id: String(raw.id || makeLocalId(`trend-${index}`)),
                title,
                category,
                heat,
                movement: ['up', 'down'].includes(raw.movement) ? raw.movement : 'none'
            };
        }

        function normalizeTrendList(items = []) {
            const seen = new Set();
            return (Array.isArray(items) ? items : [])
                .map((item, index) => normalizeTrend(item, index))
                .filter((item) => {
                    if (!item) return false;
                    const key = item.title.toLocaleLowerCase();
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
        }

        function normalizeXPlayerAccount(raw = {}, fallbackProfile = defaultProfile, index = 0) {
            const profile = raw && typeof raw === 'object' ? raw : {};
            const name = safeText(profile.name, fallbackProfile.name || defaultProfile.name);
            return {
                id: String(profile.id || `x-account-${index + 1}`),
                name,
                handle: makeHandle(name, profile.handle || fallbackProfile.handle),
                avatar: safeText(profile.avatar || fallbackProfile.avatar),
                avatarAssetId: safeText(profile.avatarAssetId || fallbackProfile.avatarAssetId),
                createdAt: Number(profile.createdAt) || Date.now(),
                updatedAt: Number(profile.updatedAt) || Date.now()
            };
        }

        function normalizeXPlayerAccounts(items, xData = {}) {
            const source = Array.isArray(items) && items.length
                ? items
                : [{ id: 'x-account-default', ...xData, createdAt: Date.now() }];
            const seen = new Set();
            return source.map((item, index) => normalizeXPlayerAccount(item, index === 0 ? xData : defaultProfile, index))
                .filter((account) => {
                    if (!account.id || seen.has(account.id)) return false;
                    seen.add(account.id);
                    return true;
                });
        }

        function syncActiveXAccountSummary(state) {
            const activeId = String(state.activeXPlayerAccountId || '');
            const profile = state.xData || defaultProfile;
            state.xPlayerAccounts = normalizeXPlayerAccounts(state.xPlayerAccounts, profile).map((account) => (
                account.id === activeId
                    ? {
                        ...account,
                        name: safeText(profile.name, account.name),
                        handle: makeHandle(profile.name || account.name, profile.handle || account.handle),
                        avatar: safeText(profile.avatar),
                        avatarAssetId: safeText(profile.avatarAssetId),
                        updatedAt: Date.now()
                    }
                    : account
            ));
            return state;
        }

        function normalizeXState(rawState) {
            const safe = rawState && typeof rawState === 'object' ? rawState : {};
            const xData = safe.xData && typeof safe.xData === 'object' ? safe.xData : {};
            const xPlayerAccounts = normalizeXPlayerAccounts(safe.xPlayerAccounts, {
                ...defaultXState.xData,
                ...xData
            });
            const requestedActiveId = String(safe.activeXPlayerAccountId || '');
            const activeXPlayerAccountId = xPlayerAccounts.some((account) => account.id === requestedActiveId)
                ? requestedActiveId
                : xPlayerAccounts[0].id;
            const normalized = {
                ...defaultXState,
                ...safe,
                xData: {
                    ...defaultXState.xData,
                    ...xData
                },
                xPlayerAccounts,
                activeXPlayerAccountId,
                xAccountSchemaVersion: Math.max(1, Number(safe.xAccountSchemaVersion) || 1),
                xCharIdentityMigrationVersion: Math.max(0, Number(safe.xCharIdentityMigrationVersion) || 0),
                xCharProfileMediaMigrationVersion: Math.max(0, Number(safe.xCharProfileMediaMigrationVersion) || 0),
                xTopics: Array.isArray(safe.xTopics) ? safe.xTopics : [],
                boundWorldBookIds: Array.isArray(safe.boundWorldBookIds)
                    ? safe.boundWorldBookIds.map(String)
                    : [],
                xVisitors: Array.isArray(safe.xVisitors) ? safe.xVisitors : [],
                xDirectMessages: Array.isArray(safe.xDirectMessages) ? safe.xDirectMessages : [],
                xPostThreads: safe.xPostThreads && typeof safe.xPostThreads === 'object' && !Array.isArray(safe.xPostThreads)
                    ? safe.xPostThreads
                    : {},
                xGeneratedPosts: Array.isArray(safe.xGeneratedPosts) ? safe.xGeneratedPosts : [],
                xAccounts: normalizeXAccounts(safe.xAccounts),
                xTrends: Array.isArray(safe.xTrends)
                    ? normalizeTrendList(safe.xTrends).slice(0, maxXTrends)
                    : defaultTrends.map((trend) => ({ ...trend })),
                xAdvancePreferences: normalizeAdvancePreferences(safe.xAdvancePreferences)
            };
            delete normalized.xCurrentDate;
            return normalized;
        }

        function getXState() {
            const revision = typeof window.getAppStateRevision === 'function'
                ? window.getAppStateRevision('x')
                : fallbackXStateRevision;
            if (cachedNormalizedXState && cachedNormalizedXRevision === revision) {
                return cachedNormalizedXState;
            }
            const raw = typeof window.getAppState === 'function' ? window.getAppState('x') : window.__xFallbackState;
            cachedNormalizedXState = normalizeXState(raw);
            cachedNormalizedXRevision = revision;
            return cachedNormalizedXState;
        }

        function saveXState(nextState) {
            const normalized = syncActiveXAccountSummary(normalizeXState(nextState));
            if (typeof window.setAppState === 'function') {
                window.setAppState('x', normalized);
            } else {
                window.__xFallbackState = normalized;
                fallbackXStateRevision += 1;
            }
            cachedNormalizedXState = normalized;
            cachedNormalizedXRevision = typeof window.getAppStateRevision === 'function'
                ? window.getAppStateRevision('x')
                : fallbackXStateRevision;
            return normalized;
        }

        async function ensureXPlayerAccountMigration() {
            const raw = typeof window.getAppState === 'function' ? window.getAppState('x') : window.__xFallbackState;
            const hasAccounts = Array.isArray(raw?.xPlayerAccounts) && raw.xPlayerAccounts.length > 0;
            const hasActive = !!safeText(raw?.activeXPlayerAccountId);
            if (hasAccounts && hasActive) return getXState();
            const migrated = saveXState(normalizeXState(raw));
            await flushXStateNow('x-account-migration');
            return migrated;
        }

        function createBlankXWorld(profile) {
            return {
                ...JSON.parse(JSON.stringify(defaultXState)),
                xData: {
                    ...defaultXState.xData,
                    ...profile,
                    edited: true,
                    following: normalizeProfileCount(profile.following, 0),
                    followers: normalizeProfileCount(profile.followers, 0),
                    profileStatsEdited: true
                },
                xPlayerAccounts: [],
                activeXPlayerAccountId: '',
                xAccountSchemaVersion: 1,
                xCharIdentityMigrationVersion: 1,
                xCharProfileMediaMigrationVersion: 2
            };
        }

        function updateXState(mutator) {
            const previous = getXState();
            const draft = {
                ...previous,
                xVisitors: [...(previous.xVisitors || [])],
                xDirectMessages: [...(previous.xDirectMessages || [])],
                xPostThreads: { ...(previous.xPostThreads || {}) },
                xGeneratedPosts: [...(previous.xGeneratedPosts || [])],
                xPlayerAccounts: [...(previous.xPlayerAccounts || [])],
                xAccounts: [...(previous.xAccounts || [])],
                xTrends: [...(previous.xTrends || [])],
                xAdvancePreferences: { ...(previous.xAdvancePreferences || defaultAdvancePreferences) }
            };
            mutator(draft);
            return saveXState(draft);
        }

        function flushXStateNow(reason = 'x-state') {
            if (typeof window.saveGlobalData !== 'function') return Promise.resolve(false);
            return Promise.resolve(window.saveGlobalData()).catch((error) => {
                console.warn(`[X] Failed to flush ${reason}`, error);
                return false;
            });
        }

        function resolveXAuthorIdentity(authorId, handle, name, avatar = '') {
            const displayName = safeText(name || handle, 'X User');
            const displayHandle = makeHandle(displayName, safeText(handle).split('·')[0].trim() || displayName);
            const requestedId = safeText(authorId);
            const currentHandle = canonicalAccountHandle(currentProfile?.handle, currentProfile?.name);
            if (requestedId === 'me' || canonicalAccountHandle(displayHandle, displayName) === currentHandle) {
                return {
                    id: 'me',
                    name: safeText(currentProfile?.name, displayName),
                    handle: makeHandle(currentProfile?.name || displayName, currentProfile?.handle || displayHandle),
                    avatar: normalizePersonAvatar(currentProfile?.avatar || avatar, `me:${currentHandle || displayName}`),
                    kind: 'me'
                };
            }

            const state = getXState();
            const chars = Array.isArray(state.xDirectMessages) ? state.xDirectMessages : [];
            const char = chars.find((item) =>
                (requestedId && String(item.id) === requestedId) ||
                canonicalAccountHandle(item.handle, item.name) === canonicalAccountHandle(displayHandle, displayName)
            );
            if (char) {
                return {
                    id: String(char.id),
                    name: safeText(char.name || char.nickname, displayName),
                    handle: makeHandle(char.name || displayName, char.handle || displayHandle),
                    avatar: normalizePersonAvatar(char.avatar || char.avatarUrl || avatar, `char:${char.id || displayHandle}`),
                    kind: 'char'
                };
            }

            const topicCharacter = findTopicCharacterIdentity(requestedId, displayHandle, displayName, state);
            if (topicCharacter) return topicCharacter;

            const accounts = Array.isArray(state.xAccounts) ? state.xAccounts : [];
            const account = accounts.find((item) =>
                (requestedId && String(item.id) === requestedId) ||
                canonicalAccountHandle(item.handle, item.name) === canonicalAccountHandle(displayHandle, displayName)
            );
            if (account) return { ...normalizeXAccount(account), kind: 'account' };

            return {
                id: requestedId || makeAccountId(displayHandle, displayName),
                name: displayName,
                handle: displayHandle,
                avatar: normalizePersonAvatar(avatar, `account:${requestedId || displayHandle || displayName}`),
                kind: 'unknown'
            };
        }

        function registerLightweightAccount(identity) {
            const normalized = normalizeXAccount({ ...identity, source: 'generated' });
            updateXState((draft) => {
                const index = (draft.xAccounts || []).findIndex((account) => String(account.id) === String(normalized.id));
                if (index >= 0) draft.xAccounts[index] = { ...draft.xAccounts[index], ...normalized };
                else draft.xAccounts.unshift(normalized);
            });
            return normalized;
        }

        function getReusableAuthorContext() {
            const state = getXState();
            const chars = (state.xDirectMessages || [])
                .filter((item) => Number(item.profileGeneratedAt) > 0 || (Array.isArray(item.profilePosts) && item.profilePosts.length > 0))
                .map((item) => ({
                    authorId: String(item.id),
                    name: safeText(item.name || item.nickname, 'Char'),
                    handle: makeHandle(item.name || 'Char', item.handle || item.name),
                    bio: safeText(item.bio || item.signature),
                    persona: safeText(item.persona)
                }));
            const accounts = normalizeXAccounts(state.xAccounts).map((account) => ({
                authorId: account.id,
                name: account.name,
                handle: account.handle,
                bio: account.bio,
                persona: account.persona
            }));
            return [...chars, ...accounts].slice(0, 30);
        }

        function setupSectionHeader(header, rightButtonLabel) {
            if (!header || header.dataset.xCentered === 'true') return;
            const rightButton = header.querySelector('.x-header-button');
            if (!rightButton) return;
            rightButton.setAttribute('aria-label', rightButton.getAttribute('aria-label') || rightButtonLabel || 'Action');
            header.innerHTML = '';
            const backButton = document.createElement('button');
            backButton.className = 'x-header-button';
            backButton.type = 'button';
            backButton.setAttribute('aria-label', 'Back');
            backButton.setAttribute('data-x-close', 'true');
            backButton.innerHTML = '<i class="fas fa-chevron-left"></i>';

            const brand = document.createElement('div');
            brand.className = 'x-brand-lockup x-section-brand';
            brand.innerHTML = '<i class="fa-brands fa-x-twitter"></i>';

            header.classList.add('x-centered-header');
            header.append(backButton, brand, rightButton);
            header.dataset.xCentered = 'true';
        }

        function renderTrends(state = getXState()) {
            if (!trendList) return;
            const trends = normalizeTrendList(state.xTrends || []).slice(0, maxXTrends);
            if (trends.length === 0) {
                trendList.innerHTML = '<div class="x-empty-state">暂无热搜，点击右上角搜索生成。</div>';
                return;
            }
            trendList.innerHTML = trends.map((trend) => `
                <div class="x-trend-row" role="button" tabindex="0" data-trend-title="${escapeHtml(trend.title)}">
                    <div>
                        <small>${escapeHtml(trend.category)}</small>
                        <strong>${escapeHtml(trend.title)}</strong>
                    </div>
                    <span class="x-trend-rank-meta">
                        ${trend.movement === 'up' ? '<i class="fas fa-arrow-up x-trend-up" aria-label="上升"></i>' : ''}
                        ${trend.movement === 'down' ? '<i class="fas fa-arrow-down x-trend-down" aria-label="下降"></i>' : ''}
                        <span>${escapeHtml(trend.heat)}</span>
                    </span>
                </div>
            `).join('');
        }

        function ensureXChrome() {
            if (xChromeInitialized) return;
            xChromeInitialized = true;
            const superHeader = document.querySelector('#x-super-tab .x-section-header');
            setupSectionHeader(superHeader, 'Create topic');
            const superCreateBtn = superHeader?.querySelector('.x-header-button[aria-label="Create topic"]');
            if (superCreateBtn) {
                superCreateBtn.addEventListener('click', openCreateTopicSheet);
            }

            setupSectionHeader(document.querySelector('#x-discover-tab .x-section-header'), 'Search');
            setupSectionHeader(document.querySelector('#x-messages-tab .x-section-header'), 'New message');

            const messageHeaderButton = document.querySelector('#x-messages-tab .x-section-header .x-header-button:last-child');
            if (messageHeaderButton) messageHeaderButton.id = 'x-add-dm-btn';
            const discoverSearchButton = document.querySelector('#x-discover-tab .x-section-header .x-header-button:last-child');
            if (discoverSearchButton) {
                discoverSearchButton.id = 'x-discover-search-btn';
                discoverSearchButton.setAttribute('aria-label', '搜索并生成热搜');
                discoverSearchButton.innerHTML = '<i class="fas fa-search"></i>';
            }
            const homeSearchButton = document.querySelector('#x-home-tab .x-header-actions .x-header-button:not(.x-compose-button)');
            if (homeSearchButton) homeSearchButton.id = 'x-search-generate-btn';
            const firstSummaryLabel = document.querySelector('#x-messages-tab .x-message-summary div:first-child span');
            if (firstSummaryLabel) firstSummaryLabel.textContent = '新粉丝';

            const summaryLabels = document.querySelectorAll('#x-messages-tab .x-message-summary span');
            const summaryCopy = ['会话', '未读', '@我'];
            summaryLabels.forEach((label, index) => {
                label.textContent = summaryCopy[index] || label.textContent;
            });

            const profileActions = document.querySelector('.x-profile-cover-actions');
            const settingsBtn = document.getElementById('x-profile-settings-btn');
            if (profileActions && settingsBtn && !document.getElementById('x-profile-visitors-btn')) {
                const rightActions = document.createElement('div');
                rightActions.className = 'x-profile-cover-right-actions';
                const visitorBtn = document.createElement('button');
                visitorBtn.className = 'x-header-button';
                visitorBtn.id = 'x-profile-visitors-btn';
                visitorBtn.type = 'button';
                visitorBtn.setAttribute('aria-label', 'Profile visitors');
                visitorBtn.innerHTML = '<i class="fas fa-user-clock"></i>';
                settingsBtn.parentNode.insertBefore(rightActions, settingsBtn);
                rightActions.append(visitorBtn, settingsBtn);
            }

            setupPostDetailControls();
            setupVisitorsSheet();
            setupAddDmSheet();
            setupDmChatView();
            setupDmSettingsSheet();
            setupDmProfileView();
            setupCharEditSheet();
            setupCharProfileGenerateSheet();
            setupEditSuperTopicSheet();
            setupPostForwardSheet();
            setupSearchGenerateSheet();
            setupAdvanceSheet();
            setupImagePreviewOverlay();
            setupPostSettingsSheet();
            dmList = document.getElementById('x-dm-list') || document.querySelector('#x-messages-tab .x-message-list');
            if (dmList) dmList.id = 'x-dm-list';
            clearDefaultHomeFeedContent();
            renderHomeEmptyStates();
        }

        function setupPostDetailControls() {
            const composer = document.querySelector('.x-comment-composer');
            document.getElementById('x-detail-actions')?.remove();
            if (composer && !document.getElementById('x-reply-input')) {
                const context = document.createElement('div');
                context.className = 'x-reply-context';
                context.id = 'x-reply-context';
                context.hidden = true;
                context.innerHTML = `
                    <span id="x-reply-context-text">Replying to post</span>
                    <button id="x-reply-cancel-btn" type="button" aria-label="Cancel reply target"><i class="fas fa-times"></i></button>
                `;
                composer.insertAdjacentElement('beforebegin', context);
                composer.innerHTML = `
                    <div class="x-avatar x-avatar-dark">X</div>
                    <input id="x-reply-input" type="text" maxlength="180" placeholder="Post your reply">
                    <button id="x-reply-submit-btn" type="button">Reply</button>
                `;
            }
            const context = document.getElementById('x-reply-context');
            if (postDetailView && context && context.parentElement !== postDetailView) {
                postDetailView.appendChild(context);
            }
            if (postDetailView && composer && composer.parentElement !== postDetailView) {
                postDetailView.appendChild(composer);
            }
        }

        function setupVisitorsSheet() {
            visitorsSheet = document.getElementById('x-visitors-sheet');
            if (!visitorsSheet) {
                visitorsSheet = document.createElement('div');
                visitorsSheet.className = 'bottom-sheet-overlay detail-sheet-overlay x-visitors-overlay';
                visitorsSheet.id = 'x-visitors-sheet';
                visitorsSheet.style.zIndex = '268';
                visitorsSheet.innerHTML = `
                    <div class="bottom-sheet x-visitors-sheet">
                        <div class="sheet-handle"></div>
                        <div class="x-edit-sheet-header">
                            <button class="x-edit-sheet-text-btn" id="x-visitors-close-btn" type="button">Close</button>
                            <strong>主页访客</strong>
                            <span class="x-settings-spacer"></span>
                        </div>
                        <div class="x-visitors-list" id="x-visitors-list"></div>
                    </div>
                `;
                view.appendChild(visitorsSheet);
            }
            visitorsList = document.getElementById('x-visitors-list');
        }

        function setupAddDmSheet() {
            addDmSheet = document.getElementById('x-add-dm-sheet');
            if (!addDmSheet) {
                addDmSheet = document.createElement('div');
                addDmSheet.className = 'bottom-sheet-overlay detail-sheet-overlay x-add-dm-overlay';
                addDmSheet.id = 'x-add-dm-sheet';
                addDmSheet.style.zIndex = '272';
                addDmSheet.innerHTML = `
                    <div class="bottom-sheet x-add-dm-sheet">
                        <div class="sheet-handle"></div>
                        <div class="x-edit-sheet-header">
                            <button class="x-edit-sheet-text-btn" id="x-add-dm-close-btn" type="button">关闭</button>
                            <strong>添加私信</strong>
                            <span class="x-settings-spacer"></span>
                        </div>
                        <div class="x-add-dm-body">
                            <section class="x-add-dm-section">
                                <div class="x-add-dm-section-title">从 iMessage 导入 Char</div>
                                <div class="x-imessage-char-list" id="x-imessage-char-list">
                                    <div class="x-empty-state">加载 iMessage Char...</div>
                                </div>
                            </section>
                            <section class="x-add-dm-section">
                                <div class="x-add-dm-section-title">手动添加 Char</div>
                                <label class="x-add-dm-field">
                                    <span>名称</span>
                                    <input id="x-manual-char-name" type="text" maxlength="32" placeholder="Char name">
                                </label>
                                <label class="x-add-dm-field">
                                    <span>@账号</span>
                                    <input id="x-manual-char-handle" type="text" maxlength="32" placeholder="@char">
                                </label>
                                <label class="x-add-dm-field">
                                    <span>简介</span>
                                    <textarea id="x-manual-char-bio" maxlength="120" placeholder="输入角色简介或签名"></textarea>
                                </label>
                                <label class="x-add-dm-field">
                                    <span>人设</span>
                                    <textarea id="x-manual-char-persona" maxlength="600" placeholder="输入角色说话方式、性格、关系和背景设定"></textarea>
                                </label>
                                <button class="x-add-dm-submit" id="x-manual-char-add-btn" type="button">保存并添加</button>
                            </section>
                        </div>
                    </div>
                `;
                view.appendChild(addDmSheet);
            }
            imessageCharList = document.getElementById('x-imessage-char-list');
            manualCharNameInput = document.getElementById('x-manual-char-name');
            manualCharHandleInput = document.getElementById('x-manual-char-handle');
            manualCharBioInput = document.getElementById('x-manual-char-bio');
            manualCharPersonaInput = document.getElementById('x-manual-char-persona');
        }

        function setupDmChatView() {
            dmChatView = document.getElementById('x-dm-chat-view');
            if (!dmChatView) {
                dmChatView = document.createElement('div');
                dmChatView.className = 'x-dm-chat-view';
                dmChatView.id = 'x-dm-chat-view';
                dmChatView.setAttribute('aria-hidden', 'true');
                dmChatView.innerHTML = `
                    <header class="x-dm-chat-header">
                        <button class="x-dm-chat-back" id="x-dm-chat-back" type="button" aria-label="返回">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <div class="x-dm-chat-title">
                            <div class="x-avatar" id="x-dm-chat-avatar">X</div>
                            <div class="x-dm-chat-name">
                                <strong id="x-dm-chat-name">Char</strong>
                                <span id="x-dm-chat-handle">@char</span>
                            </div>
                        </div>
                        <button class="x-dm-chat-menu" id="x-dm-chat-menu-btn" type="button" aria-label="菜单">
                            <i class="fas fa-ellipsis-h"></i>
                        </button>
                    </header>
                    <main class="x-dm-chat-messages" id="x-dm-chat-messages"></main>
                    <form class="x-dm-chat-composer" id="x-dm-chat-composer" autocomplete="off">
                        <div class="x-dm-chat-input-wrapper">
                            <input id="x-dm-chat-input" type="text" maxlength="280" placeholder="发送消息...">
                            <button class="x-dm-chat-api" id="x-dm-chat-api-btn" type="button" aria-label="接收/生成回复"><i class="fas fa-arrow-down"></i></button>
                        </div>
                        <button class="x-dm-chat-send" id="x-dm-chat-send-btn" type="submit" aria-label="发送"><i class="fas fa-paper-plane"></i></button>
                    </form>
                `;
                view.appendChild(dmChatView);
            }
            dmChatMessagesEl = document.getElementById('x-dm-chat-messages');
            dmChatInput = document.getElementById('x-dm-chat-input');
        }

        function setupDmSettingsSheet() {
            dmSettingsSheet = document.getElementById('x-dm-settings-sheet');
            if (!dmSettingsSheet) {
                dmSettingsSheet = document.createElement('div');
                dmSettingsSheet.className = 'bottom-sheet-overlay detail-sheet-overlay x-dm-settings-overlay';
                dmSettingsSheet.id = 'x-dm-settings-sheet';
                dmSettingsSheet.style.zIndex = '274';
                dmSettingsSheet.innerHTML = `
                    <div class="bottom-sheet x-dm-settings-sheet">
                        <div class="sheet-handle"></div>
                        <div class="x-edit-sheet-header">
                            <button class="x-edit-sheet-text-btn" id="x-dm-settings-close-btn" type="button">关闭</button>
                            <strong>私信设置</strong>
                            <span class="x-settings-spacer"></span>
                        </div>
                        <div class="x-dm-settings-body">
                            <section class="x-dm-imessage-context-settings" id="x-dm-imessage-context-settings" hidden>
                                <div class="x-dm-imessage-context-heading">
                                    <div>
                                        <strong>iMessage 单聊上下文</strong>
                                        <small id="x-dm-imessage-context-source">生成回复时引用同一 Char 的 iMessage 单聊</small>
                                    </div>
                                    <label class="x-dm-imessage-context-switch" aria-label="开启 iMessage 单聊上下文">
                                        <input id="x-dm-imessage-context-enabled" type="checkbox" checked>
                                        <span aria-hidden="true"></span>
                                    </label>
                                </div>
                                <label class="x-dm-imessage-context-limit-row" for="x-dm-imessage-context-limit">
                                    <span>上下文条数</span>
                                    <span><input id="x-dm-imessage-context-limit" type="number" min="1" max="50" step="1" inputmode="numeric" value="20" aria-label="iMessage 单聊上下文条数"> 条</span>
                                </label>
                            </section>
                            <button class="x-dm-settings-action" id="x-dm-clear-chat-btn" type="button">
                                <i class="fas fa-eraser"></i>
                                <span>清空聊天记录</span>
                            </button>
                            <button class="x-dm-settings-action danger" id="x-dm-delete-chat-btn" type="button">
                                <i class="far fa-trash-alt"></i>
                                <span>删除会话</span>
                            </button>
                        </div>
                    </div>
                `;
                view.appendChild(dmSettingsSheet);
            }
        }

        function setupDmProfileView() {
            dmProfileView = document.getElementById('x-dm-profile-view');
            if (!dmProfileView) {
                dmProfileView = document.createElement('div');
                dmProfileView.className = 'x-dm-profile-view';
                dmProfileView.id = 'x-dm-profile-view';
                dmProfileView.setAttribute('aria-hidden', 'true');
                dmProfileView.innerHTML = `
                    <main class="x-dm-profile-body" id="x-dm-profile-body"></main>
                `;
                view.appendChild(dmProfileView);
            }
        }

        function setupCharEditSheet() {
            charEditSheet = document.getElementById('x-char-edit-sheet');
            if (charEditSheet) return;
            charEditSheet = document.createElement('div');
            charEditSheet.className = 'bottom-sheet-overlay detail-sheet-overlay x-char-edit-overlay';
            charEditSheet.id = 'x-char-edit-sheet';
            charEditSheet.style.zIndex = '278';
            charEditSheet.innerHTML = `
                <div class="bottom-sheet x-char-edit-sheet">
                    <div class="sheet-handle"></div>
                    <div class="x-edit-sheet-header">
                        <button class="x-edit-sheet-text-btn" id="x-char-edit-close-btn" type="button">取消</button>
                        <strong>Edit Char</strong>
                        <button class="x-edit-sheet-save" id="x-char-edit-save-btn" type="button">保存</button>
                    </div>
                    <div class="x-char-edit-body">
                        <div class="x-edit-avatar-row">
                            <button class="x-edit-avatar-preview" id="x-char-edit-avatar-preview" type="button" aria-label="上传 Char 头像"><span>C</span></button>
                            <input type="file" id="x-char-edit-avatar-input" accept="image/jpeg,image/png" style="display:none;">
                            <div><strong>Avatar</strong><p>仅修改 X 中的资料。</p></div>
                        </div>
                        <div class="x-edit-banner-row">
                            <button class="x-edit-banner-preview" id="x-char-edit-cover-preview" type="button" aria-label="上传 Char 主页背景"><span>Cover</span></button>
                            <input type="file" id="x-char-edit-cover-input" accept="image/jpeg,image/png" style="display:none;">
                            <div><strong>Background</strong><p>上传图片，或使用下方随机背景。</p></div>
                        </div>
                        <label class="x-edit-field"><span>Name</span><input id="x-char-edit-name" type="text" maxlength="32"></label>
                        <label class="x-edit-field"><span>@ Account</span><input id="x-char-edit-handle" type="text" maxlength="32"></label>
                        <label class="x-edit-field"><span>Signature</span><textarea id="x-char-edit-bio" maxlength="160"></textarea></label>
                        <label class="x-edit-field"><span>Persona</span><textarea id="x-char-edit-persona" maxlength="800"></textarea></label>
                        <label class="x-edit-field"><span>Following</span><input id="x-char-edit-following" type="number" min="0" step="1" inputmode="numeric"></label>
                        <label class="x-edit-field"><span>Followers</span><input id="x-char-edit-followers" type="number" min="0" step="1" inputmode="numeric"></label>
                        <button class="x-char-random-cover-btn" id="x-char-random-cover-btn" type="button"><i class="fas fa-image"></i> 更换随机背景</button>
                    </div>
                </div>
            `;
            view.appendChild(charEditSheet);
        }

        function setupCharProfileGenerateSheet() {
            charProfileGenerateSheet = document.getElementById('x-char-profile-generate-sheet');
            if (charProfileGenerateSheet) return;
            charProfileGenerateSheet = document.createElement('div');
            charProfileGenerateSheet.className = 'bottom-sheet-overlay detail-sheet-overlay x-char-profile-generate-overlay';
            charProfileGenerateSheet.id = 'x-char-profile-generate-sheet';
            charProfileGenerateSheet.style.zIndex = '281';
            charProfileGenerateSheet.innerHTML = `
                <div class="bottom-sheet x-char-profile-generate-sheet" role="dialog" aria-modal="true" aria-labelledby="x-char-profile-generate-title">
                    <div class="sheet-handle"></div>
                    <div class="x-edit-sheet-header">
                        <button class="x-edit-sheet-text-btn" id="x-char-profile-generate-close-btn" type="button">取消</button>
                        <strong id="x-char-profile-generate-title">生成主页帖子</strong>
                        <button class="x-edit-sheet-save" id="x-char-profile-generate-run-btn" type="button">生成</button>
                    </div>
                    <div class="x-char-profile-generate-body">
                        <label class="x-char-profile-generate-row">
                            <span><strong>帖子数量</strong><small>每条至少包含 10 条评论</small></span>
                            <input id="x-char-profile-generate-count" type="number" min="1" max="10" step="1" inputmode="numeric" value="3">
                        </label>
                        <label class="x-char-profile-generate-row">
                            <span><strong>开启生图</strong><small>整批最多为一条帖子生成真实图片</small></span>
                            <input id="x-char-profile-image-toggle" type="checkbox">
                        </label>
                        <section class="x-char-profile-image-options" id="x-char-profile-image-options" hidden>
                            <label class="x-edit-field">
                                <span>提示词预设</span>
                                <select id="x-char-profile-image-preset"><option value="">当前编辑内容</option></select>
                            </label>
                            <div class="x-char-profile-preset-actions">
                                <input id="x-char-profile-preset-name" type="text" maxlength="40" placeholder="预设名称">
                                <button id="x-char-profile-preset-save" type="button">保存预设</button>
                                <button id="x-char-profile-preset-delete" type="button">删除</button>
                            </div>
                            <label class="x-edit-field"><span>正向提示词</span><textarea id="x-char-profile-image-prompt" maxlength="4000" placeholder="追加到帖子画面描述后的主体、场景或风格要求"></textarea></label>
                            <label class="x-edit-field"><span>Char 外貌</span><textarea id="x-char-profile-char-appearance" maxlength="4000" placeholder="角色外貌约束"></textarea></label>
                            <label class="x-edit-field"><span>User 外貌</span><textarea id="x-char-profile-user-appearance" maxlength="4000" placeholder="用户外貌约束"></textarea></label>
                            <label class="x-edit-field"><span>画风提示词</span><textarea id="x-char-profile-artist-prompt" maxlength="4000" placeholder="画风、镜头、质感等"></textarea></label>
                            <label class="x-edit-field"><span>负面提示词</span><textarea id="x-char-profile-negative-prompt" maxlength="4000" placeholder="不希望出现在图片中的内容"></textarea></label>
                            <div class="x-char-profile-reference-card">
                                <button class="x-char-profile-reference-preview" id="x-char-profile-reference-preview" type="button" aria-label="上传参考脸"><i class="fas fa-user"></i></button>
                                <input id="x-char-profile-reference-input" type="file" accept="image/jpeg,image/png" hidden>
                                <div><strong>Char 参考脸</strong><small id="x-char-profile-reference-status">尚未上传</small></div>
                                <button id="x-char-profile-reference-delete" type="button">移除</button>
                            </div>
                            <label class="x-char-profile-generate-row compact">
                                <span><strong>本次使用参考脸</strong><small>仅在已有参考脸时可用</small></span>
                                <input id="x-char-profile-reference-toggle" type="checkbox">
                            </label>
                        </section>
                        <p class="x-advance-note">生图失败时仍会保留本次生成的文字帖子，不会使用随机外部图片。</p>
                    </div>
                </div>`;
            view.appendChild(charProfileGenerateSheet);
        }

        function setupEditSuperTopicSheet() {
            editSuperTopicSheet = document.getElementById('x-edit-super-topic-sheet');
            if (editSuperTopicSheet) return;
            editSuperTopicSheet = document.createElement('div');
            editSuperTopicSheet.className = 'bottom-sheet-overlay detail-sheet-overlay x-edit-super-topic-overlay';
            editSuperTopicSheet.id = 'x-edit-super-topic-sheet';
            editSuperTopicSheet.style.zIndex = '278';
            editSuperTopicSheet.innerHTML = `
                <div class="bottom-sheet x-edit-super-topic-sheet">
                    <div class="sheet-handle"></div>
                    <div class="x-edit-sheet-header">
                        <button class="x-edit-sheet-text-btn" id="x-edit-super-topic-close-btn" type="button">取消</button>
                        <strong>编辑超话</strong>
                        <button class="x-edit-sheet-save" id="x-edit-super-topic-save-btn" type="button">保存</button>
                    </div>
                    <div class="x-topic-editor-body">
                        <div class="x-topic-editor-hero">
                            <button class="x-topic-editor-cover x-edit-banner-preview" id="x-edit-super-topic-banner-preview" type="button" aria-label="上传超话封面"><span>Cover</span></button>
                            <input type="file" id="x-edit-super-topic-banner-input" accept="image/jpeg,image/png" hidden>
                            <button class="x-topic-editor-avatar x-edit-avatar-preview" id="x-edit-super-topic-avatar-preview" type="button" aria-label="上传超话头像"><span>超</span></button>
                            <input type="file" id="x-edit-super-topic-avatar-input" accept="image/jpeg,image/png" hidden>
                        </div>
                        <div class="x-topic-editor-card">
                            <label class="x-edit-field"><span>超话名称</span><input id="x-edit-super-topic-name" type="text" maxlength="40"></label>
                            <label class="x-edit-field"><span>粉丝数</span><input id="x-edit-super-topic-fans" type="text" maxlength="20"></label>
                        </div>
                        <section class="x-topic-editor-card x-topic-roles-section">
                            <div class="x-topic-editor-card-title">
                                <div>
                                    <strong>超话角色</strong>
                                    <span>用于生成超话动态和互动时的人物来源。</span>
                                </div>
                            </div>
                            <div class="x-topic-role-actions">
                                <button type="button" id="x-edit-topic-import-imessage-btn"><i class="far fa-comments"></i> 从 iMessage 拉取</button>
                                <button type="button" id="x-edit-topic-manual-char-btn"><i class="fas fa-user-plus"></i> 手动添加</button>
                            </div>
                            <div class="x-topic-chars-list" id="x-edit-topic-chars-list"></div>
                            <div class="x-topic-source-list" id="x-edit-topic-imessage-list-container" style="display:none;"></div>
                            <div class="x-topic-manual-card" id="x-edit-topic-manual-container" style="display:none;">
                                <input id="x-edit-topic-manual-name" type="text" placeholder="角色名称">
                                <input id="x-edit-topic-manual-handle" type="text" placeholder="@账号">
                                <textarea id="x-edit-topic-manual-bio" placeholder="简介"></textarea>
                                <textarea id="x-edit-topic-manual-persona" placeholder="人设"></textarea>
                                <button type="button" id="x-edit-topic-manual-save-btn">确认添加</button>
                            </div>
                        </section>
                        <button class="x-topic-delete-btn" id="x-edit-super-topic-delete-btn" type="button"><i class="fas fa-trash-alt"></i> 删除此超话</button>
                    </div>
                </div>
            `;
            view.appendChild(editSuperTopicSheet);
        }

        function setupPostForwardSheet() {
            postForwardSheet = document.getElementById('x-post-forward-sheet');
            if (postForwardSheet) return;
            postForwardSheet = document.createElement('div');
            postForwardSheet.className = 'bottom-sheet-overlay detail-sheet-overlay x-post-forward-overlay';
            postForwardSheet.id = 'x-post-forward-sheet';
            postForwardSheet.style.zIndex = '279';
            postForwardSheet.innerHTML = `
                <div class="bottom-sheet x-post-forward-sheet">
                    <div class="sheet-handle"></div>
                    <div class="x-edit-sheet-header">
                        <button class="x-edit-sheet-text-btn" id="x-post-forward-close-btn" type="button">取消</button>
                        <strong>转发给私信</strong>
                        <span class="x-settings-spacer"></span>
                    </div>
                    <div class="x-post-forward-list" id="x-post-forward-list"></div>
                </div>
            `;
            view.appendChild(postForwardSheet);
        }

        function setupSearchGenerateSheet() {
            searchGenerateSheet = document.getElementById('x-search-generate-sheet');
            if (!searchGenerateSheet) {
                searchGenerateSheet = document.createElement('div');
                searchGenerateSheet.className = 'bottom-sheet-overlay detail-sheet-overlay x-search-generate-overlay';
                searchGenerateSheet.id = 'x-search-generate-sheet';
                searchGenerateSheet.style.zIndex = '273';
                searchGenerateSheet.innerHTML = `
                    <div class="bottom-sheet x-search-generate-sheet">
                        <div class="sheet-handle"></div>
                        <div class="x-edit-sheet-header">
                            <button class="x-edit-sheet-text-btn" id="x-search-generate-close-btn" type="button">Close</button>
                            <strong id="x-search-generate-title">搜索/生成帖子</strong>
                            <button class="x-edit-sheet-save" id="x-search-generate-run-btn" type="button">Generate</button>
                        </div>
                        <div class="x-search-generate-body">
                            <label class="x-add-dm-field">
                                <span id="x-search-generate-label">生成方向</span>
                                <textarea id="x-search-generate-input" maxlength="500" placeholder="可留空，或输入想生成的帖子主题"></textarea>
                            </label>
                        </div>
                    </div>
                `;
                view.appendChild(searchGenerateSheet);
            }
            searchGenerateInput = document.getElementById('x-search-generate-input');
            searchGenerateSheet?.querySelectorAll('.x-settings-note').forEach((node) => node.remove());
        }

        function setupAdvanceSheet() {
            advanceSheet = document.getElementById('x-advance-sheet');
            if (!advanceSheet) {
                advanceSheet = document.createElement('div');
                advanceSheet.className = 'bottom-sheet-overlay detail-sheet-overlay x-advance-overlay';
                advanceSheet.id = 'x-advance-sheet';
                advanceSheet.style.zIndex = '276';
                advanceSheet.innerHTML = `
                    <div class="bottom-sheet x-advance-sheet">
                        <div class="sheet-handle"></div>
                        <div class="x-edit-sheet-header">
                            <button class="x-edit-sheet-text-btn" id="x-advance-close-btn" type="button">关闭</button>
                            <strong>推进到下一天</strong>
                            <button class="x-edit-sheet-save" id="x-advance-run-btn" type="button">生成</button>
                        </div>
                        <div class="x-advance-body">
                            <label class="x-advance-field">
                                <span>想推进的剧情</span>
                                <textarea id="x-advance-plot-input" maxlength="800" placeholder="可留空，留空时将随机延续当前剧情"></textarea>
                            </label>
                            <div class="x-advance-section-title">生成内容</div>
                            <div class="x-advance-options">
                                <label class="x-advance-option">
                                    <input id="x-advance-strangers-toggle" type="checkbox">
                                    <span class="x-advance-option-copy">
                                        <strong>陌生人私信</strong>
                                        <span>每人生成 2–5 条对方来信</span>
                                    </span>
                                    <input class="x-advance-count" id="x-advance-strangers-count" type="number" min="1" max="20" inputmode="numeric" aria-label="陌生人人数">
                                </label>
                                <label class="x-advance-option">
                                    <input id="x-advance-trends-toggle" type="checkbox">
                                    <span class="x-advance-option-copy">
                                        <strong>推进热搜</strong>
                                        <span>新热搜置顶，旧热搜依次下移</span>
                                    </span>
                                    <input class="x-advance-count" id="x-advance-trends-count" type="number" min="1" max="15" inputmode="numeric" aria-label="热搜数量">
                                </label>
                                <label class="x-advance-option">
                                    <input id="x-advance-posts-toggle" type="checkbox">
                                    <span class="x-advance-option-copy">
                                        <strong>推进帖子</strong>
                                        <span>每条新帖子至少生成 5 条评论</span>
                                    </span>
                                    <input class="x-advance-count" id="x-advance-posts-count" type="number" min="1" max="20" inputmode="numeric" aria-label="帖子数量">
                                </label>
                            </div>
                            <p class="x-advance-note">将使用 X 已绑定的世界书和当前热搜、帖子作为剧情上下文。全部生成成功后才会保存。</p>
                        </div>
                    </div>
                `;
                view.appendChild(advanceSheet);
            }
            advancePlotInput = document.getElementById('x-advance-plot-input');
        }

        function setupPostSettingsSheet() {
            postSettingsSheet = document.getElementById('x-post-settings-sheet');
            if (!postSettingsSheet) {
                postSettingsSheet = document.createElement('div');
                postSettingsSheet.className = 'bottom-sheet-overlay detail-sheet-overlay x-dm-settings-overlay';
                postSettingsSheet.id = 'x-post-settings-sheet';
                postSettingsSheet.style.zIndex = '275';
                postSettingsSheet.innerHTML = `
                    <div class="bottom-sheet x-dm-settings-sheet">
                        <div class="sheet-handle"></div>
                        <div class="x-edit-sheet-header">
                            <button class="x-edit-sheet-text-btn" id="x-post-settings-close-btn" type="button">关闭</button>
                            <strong>帖子设置</strong>
                            <span class="x-settings-spacer"></span>
                        </div>
                        <div class="x-dm-settings-body">
                            <button class="x-dm-settings-action" id="x-post-advance-btn" type="button">
                                <i class="fas fa-forward"></i>
                                <span>Advance post</span>
                            </button>
                            <button class="x-dm-settings-action danger" id="x-post-delete-btn" type="button">
                                <i class="far fa-trash-alt"></i>
                                <span>删除帖子</span>
                            </button>
                        </div>
                    </div>
                `;
                view.appendChild(postSettingsSheet);
            }
        }

        function setupImagePreviewOverlay() {
            imagePreviewOverlay = document.getElementById('x-image-preview-overlay');
            if (!imagePreviewOverlay) {
                imagePreviewOverlay = document.createElement('div');
                imagePreviewOverlay.className = 'x-image-preview-overlay';
                imagePreviewOverlay.id = 'x-image-preview-overlay';
                imagePreviewOverlay.setAttribute('aria-hidden', 'true');
                imagePreviewOverlay.innerHTML = `
                    <button class="x-image-preview-close" id="x-image-preview-close" type="button" aria-label="Close image"><i class="fas fa-times"></i></button>
                    <div class="x-image-preview-card" id="x-image-preview-card">
                        <img id="x-image-preview-img" alt="">
                        <div id="x-image-preview-text"></div>
                    </div>
                `;
                view.appendChild(imagePreviewOverlay);
            }
        }

        function getCurrentAccountProfile() {
            const accounts = typeof window.getAccounts === 'function' ? window.getAccounts() : [];
            const currentAccountId = typeof window.getCurrentAccountId === 'function' ? window.getCurrentAccountId() : null;
            const currentAccount = Array.isArray(accounts)
                ? accounts.find((account) => String(account.id) === String(currentAccountId))
                : null;
            const runtimeUser = window.userState || {};
            const source = currentAccount || runtimeUser || {};
            const name = source.name || source.realName || runtimeUser.name || runtimeUser.realName || defaultProfile.name;
            const bio = source.signature || source.bio || source.persona || runtimeUser.signature || runtimeUser.persona || defaultProfile.bio;

            return {
                name,
                handle: makeHandle(name, source.handle || runtimeUser.handle),
                bio,
                persona: source.persona || runtimeUser.persona || '',
                avatar: source.avatarUrl || source.avatar || runtimeUser.avatarUrl || runtimeUser.avatar || '',
                banner: source.banner || source.bannerUrl || ''
            };
        }

        function hasEditedXProfile(xData = {}) {
            return Boolean(
                xData.edited ||
                xData.avatar ||
                xData.banner ||
                xData.bio ||
                xData.persona ||
                (xData.name && xData.name !== 'User') ||
                (xData.handle && xData.handle !== '@user')
            );
        }

        function resolveProfile(state = getXState()) {
            const xState = state || defaultXState;
            const fallback = getCurrentAccountProfile();
            const source = hasEditedXProfile(xState.xData) ? xState.xData : fallback;
            const name = safeText(source.name, fallback.name || defaultProfile.name);

            return {
                name,
                handle: makeHandle(name, source.handle || fallback.handle),
                bio: safeText(source.bio || source.signature, fallback.bio || defaultProfile.bio),
                persona: safeText(source.persona, fallback.persona || ''),
                avatar: normalizePersonAvatar(
                    source.avatar || source.avatarUrl || fallback.avatar,
                    `me:${source.handle || fallback.handle || name}`
                ),
                banner: safeText(source.banner || source.bannerUrl, fallback.banner || ''),
                following: normalizeProfileCount(
                    source.profileStatsEdited === true ? source.following : defaultProfile.following,
                    defaultProfile.following
                ),
                followers: normalizeProfileCount(
                    source.profileStatsEdited === true ? source.followers : defaultProfile.followers,
                    defaultProfile.followers
                ),
                profileStatsEdited: source.profileStatsEdited === true
            };
        }

        function setAvatarNode(node, profile) {
            if (!node) return;
            const name = safeText(profile.name, 'User');
            node.innerHTML = buildAvatarHtml(profile.avatar, `me:${profile.handle || name}`);
        }

        function syncCurrentProfile(state = getXState()) {
            currentProfile = resolveProfile(state);
            setAvatarNode(document.getElementById('x-compose-author-avatar'), currentProfile);
            postData.profile.avatar = normalizePersonAvatar(currentProfile.avatar, `me:${currentProfile.handle || currentProfile.name}`);
            postData.profile.name = currentProfile.name;
            postData.profile.handle = `${currentProfile.handle} 路 pinned`;
            return currentProfile;
        }

        function buildUnifiedProfileContentHtml({ identity, posts = [], stats = [], actionsHtml = '', isSelf = false }) {
            const safeIdentity = identity || {};
            const name = safeText(safeIdentity.name, 'User');
            const handle = makeHandle(name, safeIdentity.handle);
            const bio = safeText(safeIdentity.bio, '暂无简介');
            const avatarId = isSelf ? ' id="x-profile-avatar"' : '';
            const nameId = isSelf ? ' id="x-profile-name"' : '';
            const handleId = isSelf ? ' id="x-profile-handle"' : '';
            const bioId = isSelf ? ' id="x-profile-bio"' : '';
            const normalizedStats = (Array.isArray(stats) ? stats : []).slice(0, 3);

            return `
                <div class="x-profile-card x-unified-profile-card">
                    <div class="x-profile-avatar"${avatarId}>${buildAvatarHtml(safeIdentity.avatar, `${safeIdentity.id || handle}:${name}`)}</div>
                    <div class="x-dm-profile-heading-row">
                        <div class="x-dm-profile-identity">
                            <div class="x-profile-account-name-row">
                                <h2${nameId}>${escapeHtml(name)}</h2>
                                ${isSelf ? '<button class="x-account-switch-trigger" id="x-account-switch-trigger" type="button" aria-label="切换 X 账号" aria-haspopup="dialog"><i class="fas fa-chevron-down"></i></button>' : ''}
                            </div>
                            <span${handleId}>${escapeHtml(handle)}</span>
                        </div>
                        <div class="x-dm-profile-actions x-unified-profile-actions">${actionsHtml}</div>
                    </div>
                    <p${bioId}>${escapeHtml(bio)}</p>
                    <div class="x-profile-stats">
                        ${normalizedStats.map((stat) => `<div><strong>${escapeHtml(stat.value)}</strong><span>${escapeHtml(stat.label)}</span></div>`).join('')}
                    </div>
                </div>
                <div class="x-profile-tabs x-unified-profile-tabs">
                    <button class="active" type="button" data-x-profile-tab="posts">Posts</button>
                    <button type="button" data-x-profile-tab="photos">Photos</button>
                </div>
                <div class="x-profile-panel active x-profile-posts-panel" data-x-profile-panel="posts">${buildProfilePostsHtml(posts)}</div>
                <div class="x-profile-panel" data-x-profile-panel="photos">${buildProfilePhotosHtml(posts)}</div>
            `;
        }

        function renderProfile(state = getXState()) {
            const profile = syncCurrentProfile(state);
            const coverEl = document.getElementById('x-profile-cover');
            const profileScroll = document.getElementById('x-profile-scroll');
            if (coverEl) {
                coverEl.style.backgroundImage = profile.banner
                    ? `linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.34)), url("${profile.banner}")`
                    : '';
            }

            if (profileScroll) {
                const identity = {
                    id: 'me',
                    kind: 'me',
                    name: profile.name,
                    handle: profile.handle,
                    avatar: profile.avatar,
                    bio: profile.bio
                };
                const posts = getIdentityProfilePosts(identity, state);
                profileScroll.innerHTML = buildUnifiedProfileContentHtml({
                    identity,
                    posts,
                    isSelf: true,
                    actionsHtml: '<button class="x-profile-edit" id="x-profile-edit-btn" type="button">Edit profile</button>',
                    stats: [
                        { value: posts.length, label: 'Posts' },
                        { value: formatCompactCount(profile.followers), label: 'Followers' },
                        { value: formatCompactCount(profile.following), label: 'Following' }
                    ]
                });
                profileScroll.querySelectorAll('.x-profile-feed-card').forEach(bindPostCard);
            }
        }

        function ensureAccountSwitchSheet() {
            accountSwitchSheet = document.getElementById('x-account-switch-sheet');
            if (accountSwitchSheet) return accountSwitchSheet;
            accountSwitchSheet = document.createElement('div');
            accountSwitchSheet.className = 'bottom-sheet-overlay detail-sheet-overlay x-account-switch-overlay';
            accountSwitchSheet.id = 'x-account-switch-sheet';
            accountSwitchSheet.style.zIndex = '282';
            accountSwitchSheet.innerHTML = `
                <div class="bottom-sheet x-account-switch-sheet" role="dialog" aria-modal="true" aria-labelledby="x-account-switch-title">
                    <div class="sheet-handle"></div>
                    <div class="x-edit-sheet-header">
                        <button class="x-edit-sheet-text-btn" id="x-account-switch-close-btn" type="button">关闭</button>
                        <strong id="x-account-switch-title">切换账号</strong>
                        <span class="x-settings-spacer"></span>
                    </div>
                    <div class="x-account-switch-list" id="x-account-switch-list"></div>
                    <button class="x-account-add-btn" id="x-account-add-btn" type="button"><i class="fas fa-plus"></i><span>新增账号</span></button>
                </div>`;
            view.appendChild(accountSwitchSheet);
            return accountSwitchSheet;
        }

        function renderAccountSwitchList(state = getXState()) {
            ensureAccountSwitchSheet();
            const list = accountSwitchSheet?.querySelector('#x-account-switch-list');
            if (!list) return;
            list.innerHTML = (state.xPlayerAccounts || []).map((account) => {
                const active = account.id === state.activeXPlayerAccountId;
                return `<button class="x-account-switch-row${active ? ' active' : ''}" type="button" data-x-player-account-id="${escapeHtml(account.id)}"${active ? ' aria-current="true"' : ''}>
                    <span class="x-account-switch-avatar">${buildAvatarHtml(account.avatar, account.name)}</span>
                    <span class="x-account-switch-copy"><strong>${escapeHtml(account.name)}</strong><small>${escapeHtml(account.handle)}</small></span>
                    ${active ? '<i class="fas fa-check" aria-label="当前账号"></i>' : '<i class="fas fa-chevron-right" aria-hidden="true"></i>'}
                </button>`;
            }).join('');
        }

        function openAccountSwitchSheet() {
            renderAccountSwitchList();
            if (typeof window.openView === 'function') window.openView(accountSwitchSheet);
            else accountSwitchSheet?.classList.add('active');
        }

        function closeAccountSwitchSheet() {
            if (typeof window.closeView === 'function') window.closeView(accountSwitchSheet);
            else accountSwitchSheet?.classList.remove('active');
        }

        function resetXRuntimeForAccountSwitch() {
            const staticPostIds = new Set(['island', 'super', 'following', 'profile']);
            Object.keys(postData).forEach((postId) => {
                if (!staticPostIds.has(postId)) delete postData[postId];
            });
            postVisionRuns.clear();
            currentActiveTopicId = null;
            currentEditingSuperTopicId = null;
            currentDetailPostId = null;
            currentDmId = null;
            currentProfileIdentity = null;
            replyTarget = null;
            xHomeFeedRenderLimit = xHomeFeedInitialLimit;
            xHomeFeedRenderKey = '';
            closeAccountSwitchSheet();
            closeEditProfile();
            closeTopicDetail();
            closePostDetail();
            closeComposer();
            closeVisitorsSheet();
            closeAddDmSheet();
            closeDmChat();
            closeDmSettingsSheet();
            closeDmProfile();
            closeSearchGenerateSheet();
            closeAdvanceSheet();
            closeCharEditSheet();
            closeCharProfileGenerateSheet();
            closeEditSuperTopicSheet();
            closePostForwardSheet();
            closeImagePreview();
        }

        async function activateXPlayerAccount(accountId, initialState = null) {
            const targetId = String(accountId || '');
            const currentState = getXState();
            if (!targetId || targetId === currentState.activeXPlayerAccountId) {
                closeAccountSwitchSheet();
                return true;
            }
            if (xAccountSwitchInFlight) return false;
            if (charProfileGenerationInFlight) {
                if (typeof window.showToast === 'function') window.showToast('请等待 Char 主页生成完成后再切换账号');
                return false;
            }
            xAccountSwitchInFlight = true;
            try {
                if (!window.appStorage?.switchXAccountWorld) throw new Error('X account storage is unavailable.');
                const durable = await flushXStateNow('x-account-before-switch');
                if (!durable) throw new Error('Current X account could not be saved.');
                const nextState = await window.appStorage.switchXAccountWorld(targetId, initialState);
                if (typeof window.setAppState === 'function') window.setAppState('x', nextState, { save: false });
                else window.__xFallbackState = nextState;
                await migrateActiveXCharIdentities();
                await migrateActiveXCharProfileMedia();
                resetXRuntimeForAccountSwitch();
                const normalized = getXState();
                syncCurrentProfile(normalized);
                const meIndex = navItems.findIndex((item) => item.getAttribute('data-target') === 'x-me-tab');
                switchTab(meIndex >= 0 ? meIndex : currentIndex, { state: normalized, resetHomeFeed: true });
                renderWorldBookSummary(normalized);
                return true;
            } finally {
                xAccountSwitchInFlight = false;
            }
        }

        async function createAndSwitchXPlayerAccount(profile) {
            const previous = getXState();
            const accountId = makeLocalId('x-account');
            const accountSummary = normalizeXPlayerAccount({
                id: accountId,
                name: profile.name,
                handle: profile.handle,
                avatar: profile.avatar,
                createdAt: Date.now(),
                updatedAt: Date.now()
            }, profile, previous.xPlayerAccounts.length);
            saveXState({
                ...previous,
                xPlayerAccounts: [...previous.xPlayerAccounts, accountSummary]
            });
            try {
                const switched = await activateXPlayerAccount(accountId, createBlankXWorld(profile));
                if (!switched) throw new Error('Another X account switch is still running.');
                if (typeof window.showToast === 'function') window.showToast('已创建并切换账号');
            } catch (error) {
                console.error('[X] Create account failed', error);
                const rollback = getXState();
                saveXState({
                    ...rollback,
                    xPlayerAccounts: (rollback.xPlayerAccounts || []).filter((account) => account.id !== accountId)
                });
                await flushXStateNow('x-account-create-rollback');
                if (typeof window.showToast === 'function') window.showToast('账号创建失败，原账号未改变');
            }
        }

        async function switchXPlayerAccount(accountId) {
            try {
                await activateXPlayerAccount(accountId);
            } catch (error) {
                console.error('[X] Account switch failed', error);
                if (typeof window.showToast === 'function') window.showToast('账号切换失败，已保留当前账号');
            }
        }

        function renderImagePreview(button, src, fallbackText) {
            if (!button) return;
            if (src) {
                button.innerHTML = `<img src="${escapeHtml(src)}" alt="">`;
            } else {
                button.innerHTML = `<span>${escapeHtml(fallbackText)}</span>`;
            }
        }

        function openEditProfile(mode = 'edit') {
            profileEditorMode = mode === 'create' ? 'create' : 'edit';
            currentProfile = resolveProfile();
            const sourceProfile = profileEditorMode === 'create'
                ? { ...defaultProfile, name: '', handle: '', bio: '', persona: '', avatar: '', banner: '', following: 0, followers: 0, profileStatsEdited: true }
                : currentProfile;
            avatarDraft = sourceProfile.avatar || '';
            bannerDraft = sourceProfile.banner || '';
            if (editNameInput) editNameInput.value = sourceProfile.name;
            if (editHandleInput) editHandleInput.value = sourceProfile.handle;
            if (editBioInput) editBioInput.value = sourceProfile.bio;
            if (editPersonaInput) editPersonaInput.value = sourceProfile.persona;
            if (editFollowingInput) editFollowingInput.value = String(normalizeProfileCount(sourceProfile.following, 0));
            if (editFollowersInput) editFollowersInput.value = String(normalizeProfileCount(sourceProfile.followers, 0));
            const title = editSheet?.querySelector('.x-edit-sheet-header strong');
            if (title) title.textContent = profileEditorMode === 'create' ? '新增 X 账号' : 'Edit profile';
            renderImagePreview(editAvatarPreview, avatarDraft, (sourceProfile.name || 'U').slice(0, 1).toUpperCase());
            renderImagePreview(editBannerPreview, bannerDraft, 'Cover');
            if (typeof window.openView === 'function') window.openView(editSheet);
            else editSheet?.classList.add('active');
        }

        function closeEditProfile() {
            if (typeof window.closeView === 'function') window.closeView(editSheet);
            else editSheet?.classList.remove('active');
            profileEditorMode = 'edit';
        }

        async function saveProfile() {
            const name = safeText(editNameInput?.value);
            if (!name) {
                if (typeof window.showToast === 'function') window.showToast('请输入账号名称');
                editNameInput?.focus();
                return;
            }
            const followingRaw = String(editFollowingInput?.value ?? '').trim();
            const followersRaw = String(editFollowersInput?.value ?? '').trim();
            if ((followingRaw && (!/^\d+$/.test(followingRaw) || Number(followingRaw) > Number.MAX_SAFE_INTEGER))
                || (followersRaw && (!/^\d+$/.test(followersRaw) || Number(followersRaw) > Number.MAX_SAFE_INTEGER))) {
                if (typeof window.showToast === 'function') window.showToast('关注数和粉丝数请输入非负整数');
                return;
            }
            const nextProfile = {
                name,
                handle: makeHandle(name, editHandleInput?.value || currentProfile.handle),
                bio: safeText(editBioInput?.value, defaultProfile.bio),
                persona: safeText(editPersonaInput?.value),
                avatar: avatarDraft,
                banner: bannerDraft,
                following: normalizeProfileCount(followingRaw, 0),
                followers: normalizeProfileCount(followersRaw, 0),
                profileStatsEdited: true,
                edited: true,
                updatedAt: new Date().toISOString()
            };
            if (profileEditorMode === 'create') {
                await createAndSwitchXPlayerAccount(nextProfile);
                return;
            }
            const previous = getXState();
            const nextState = saveXState({
                ...previous,
                xData: {
                    ...previous.xData,
                    ...nextProfile
                }
            });

            currentProfile = nextProfile;
            renderProfile(nextState);
            closeEditProfile();
        }

        function renderWorldBookSummary(state = getXState()) {
            const countEl = document.getElementById('x-worldbook-count');
            const selected = state.boundWorldBookIds || [];
            if (countEl) countEl.textContent = `${selected.length} selected`;
        }

        function openXSettings() {
            renderWorldBookSummary();
            if (typeof window.openView === 'function') window.openView(settingsSheet);
            else settingsSheet?.classList.add('active');
        }

        function closeXSettings() {
            if (typeof window.closeView === 'function') window.closeView(settingsSheet);
            else settingsSheet?.classList.remove('active');
        }

        function resetAllXData() {
            showXConfirm({
                title: '清空当前 X 账号',
                message: '将清空当前账号内的帖子、超话、私信、热搜、主页资料和全部设置，其他 X 账号不受影响。此操作不可恢复。',
                confirmText: '清空当前账号',
                isDestructive: true,
                onConfirm: () => {
                    const previous = getXState();
                    const freshState = JSON.parse(JSON.stringify(defaultXState));
                    freshState.xPlayerAccounts = previous.xPlayerAccounts;
                    freshState.activeXPlayerAccountId = previous.activeXPlayerAccountId;
                    freshState.xAccountSchemaVersion = previous.xAccountSchemaVersion;
                    freshState.xCharIdentityMigrationVersion = 1;
                    saveXState(freshState);
                    currentActiveTopicId = null;
                    currentProfileIdentity = null;
                    currentDmId = null;
                    closeXSettings();
                    closeComposer();
                    closePostDetail();
                    closeTopicDetail();
                    closeDmChat();
                    closeDmProfile();
                    closePostForwardSheet();
                    renderProfile();
                    renderWorldBookSummary();
                    renderSuperFollowBar();
                    renderGeneratedPosts();
                    renderTrends();
                    renderDirectMessages();
                    renderVisitors();
                    switchTab(0);
                    if (typeof window.showToast === 'function') window.showToast('当前 X 账号已恢复初始状态');
                }
            });
        }

        function openWorldBookSelector() {
            const currentState = getXState();
            const selectedIds = currentState.boundWorldBookIds || [];
            if (typeof window.renderWorldBookSelector !== 'function') {
                if (typeof window.showToast === 'function') window.showToast('世界书选择器不可用');
                return;
            }
            window.renderWorldBookSelector(selectedIds, (nextIds) => {
                saveXState({
                    ...getXState(),
                    boundWorldBookIds: Array.isArray(nextIds) ? nextIds.map(String) : []
                });
                renderWorldBookSummary();
            });
        }

        function normalizeComposeTopicTag(value) {
            const topic = safeText(value).replace(/^#+/, '').trim();
            return topic ? `#${topic}` : '';
        }

        function renderPostTextHtml(post = {}) {
            const topicTag = normalizeComposeTopicTag(post.topicTag);
            let text = safeText(post.text);
            const hashtagPattern = /#[^\s#，。！？、,.!?;；:：]+/g;
            const existingTags = text.match(hashtagPattern) || [];
            const hasTopicTag = topicTag && existingTags.some((tag) => tag.toLocaleLowerCase() === topicTag.toLocaleLowerCase());
            if (topicTag && !hasTopicTag) text = `${text}${text ? ' ' : ''}${topicTag}`;

            let cursor = 0;
            let html = '';
            text.replace(hashtagPattern, (tag, offset) => {
                html += escapeHtml(text.slice(cursor, offset));
                const normalizedTag = normalizeComposeTopicTag(tag);
                html += `<button class="x-post-topic-link" type="button" data-topic-tag="${escapeHtml(normalizedTag)}">${escapeHtml(tag)}</button>`;
                cursor = offset + tag.length;
                return tag;
            });
            html += escapeHtml(text.slice(cursor));
            return html;
        }

        function buildExpandableTranslationHtml(translation, extraClass = '') {
            const text = safeText(translation);
            if (!text) return '';
            return `
                <button class="x-translation-toggle ${escapeHtml(extraClass)}" type="button" aria-expanded="false">翻译</button>
                <p class="x-translation-text" hidden>${escapeHtml(text)}</p>
            `;
        }

        function renderComposeImageDraft() {
            const icon = composeImageButton?.querySelector('i');
            const label = composeImageButton?.querySelector('.x-compose-image-copy');
            const hasImage = !!composeImageDraft;
            composeImageButton?.classList.toggle('has-image', hasImage);
            if (icon) icon.hidden = hasImage;
            if (label) label.hidden = hasImage;
            if (composeImagePreview) {
                composeImagePreview.hidden = !hasImage;
                composeImagePreview.src = hasImage ? composeImageDraft : '';
            }
            if (composeImageClearButton) composeImageClearButton.hidden = !hasImage;
        }

        function addComposeImageUrl() {
            const url = safeText(composeImageUrlInput?.value);
            if (!/^https?:\/\//i.test(url)) {
                if (typeof window.showToast === 'function') window.showToast('请输入有效的 http(s) 图片 URL');
                return;
            }
            composeImageDraft = url;
            renderComposeImageDraft();
        }

        function openComposer(options = {}) {
            const requestedSuperId = safeText(options?.superTopicId);
            const topic = requestedSuperId
                ? (getXState().xTopics || []).find((item) => String(item.id || item.name) === requestedSuperId)
                : null;
            currentComposeSuperId = topic ? String(topic.id || topic.name) : null;
            composeImageDraft = '';
            if (composeImageInput) composeImageInput.value = '';
            if (composeImageUrlInput) composeImageUrlInput.value = '';
            if (composeTextInput) composeTextInput.value = '';
            if (composeTopicInput) composeTopicInput.value = '';
            if (composeSuperChip) composeSuperChip.hidden = !topic;
            if (composeSuperName) composeSuperName.textContent = topic ? `超话：${safeText(topic.name || topic.title, '超话')}` : '';
            renderComposeImageDraft();
            if (typeof window.openView === 'function') window.openView(composeSheet);
            else composeSheet?.classList.add('active');
        }

        function closeComposer() {
            currentComposeSuperId = null;
            composeImageDraft = '';
            renderComposeImageDraft();
            if (typeof window.closeView === 'function') window.closeView(composeSheet);
            else composeSheet?.classList.remove('active');
        }

        async function submitComposer() {
            const text = safeText(composeTextInput?.value, '新帖子草稿');
            tempPostCounter += 1;
            const id = `temp-${Date.now()}-${tempPostCounter}`;
            const superTopic = currentComposeSuperId
                ? (getXState().xTopics || []).find((item) => String(item.id || item.name) === String(currentComposeSuperId))
                : null;
            const topicTag = normalizeComposeTopicTag(composeTopicInput?.value)
                || normalizeComposeTopicTag(superTopic?.name || superTopic?.title);
            const rawPost = {
                id,
                authorId: 'me',
                authorAvatar: normalizePersonAvatar(currentProfile.avatar, `me:${currentProfile.handle || currentProfile.name}`),
                authorName: currentProfile.name,
                handle: currentProfile.handle,
                text,
                topicTag,
                superTopicId: superTopic ? String(superTopic.id || superTopic.name) : '',
                superTopicName: superTopic ? safeText(superTopic.name || superTopic.title, '超话') : '',
                reposts: 0,
                likes: 0,
                commentsCount: 0,
                comments: [],
                mediaType: composeImageDraft ? 'image' : 'text',
                images: composeImageDraft ? [{ id: `${id}-image-0`, text: '用户上传图片', url: composeImageDraft }] : [],
                createdAt: Date.now()
            };
            const publishImageSources = rawPost.images.map((image) => ({
                id: String(image.id || ''),
                url: String(image.url || ''),
                mimeType: String(image.mimeType || '')
            }));
            const added = appendGeneratedPosts([rawPost]);
            if (superTopic && added.length) updateSuperHomeCard(superTopic);
            closeComposer();
            if (added.length) {
                const durable = await flushXStateNow('x-post-publish');
                if (!durable) {
                    updateXState((draft) => {
                        draft.xGeneratedPosts = (draft.xGeneratedPosts || []).filter((post) => String(post.id) !== String(id));
                    });
                    renderGeneratedPosts();
                    if (typeof window.showToast === 'function') window.showToast('帖子保存失败，已撤销发布');
                    return;
                }
                if (typeof window.showToast === 'function') window.showToast('Post published; generating engagement');
                generatePostPublishInteractions(added[0].id, { imageSources: publishImageSources });
            }
        }

        function ensureCommentDepth(post) {
            const comments = Array.isArray(post.commentList) ? post.commentList : [];
            post.commentList = comments;
            post.comments = formatCompactCount(Math.max(parseCompactCount(post.comments), comments.length));
            return post;
        }

        function registerGeneratedPosts(posts = []) {
            posts.forEach((post) => {
                postData[post.id] = ensureCommentDepth(post);
                if (post.refPost) {
                    postData[post.refPost.id] = ensureCommentDepth(post.refPost);
                }
            });
        }

        function clearDefaultHomeFeedContent() {
            ['island', 'super', 'following'].forEach((postId) => {
                view.querySelectorAll(`.x-feed-card[data-post-id="${postId}"]`).forEach((card) => card.remove());
            });
        }

        function clearHomeEmptyState(panel) {
            panel?.querySelectorAll('.x-home-empty-state').forEach((node) => node.remove());
        }

        function renderHomeEmptyStates() {
            view.querySelectorAll('#x-home-tab .x-feed-panel').forEach((panel) => {
                clearHomeEmptyState(panel);
                if (!panel.querySelector('.x-feed-card')) {
                    panel.innerHTML = '<div class="x-empty-state x-home-empty-state">暂无内容，点击搜索生成帖子。</div>';
                }
            });
        }

        function buildFeedCardHtml(post) {
            return `
                ${buildAuthorAvatarButton(post, 'x-feed-avatar x-avatar')}
                <div class="x-feed-body">
                    <div class="x-feed-meta">
                        <strong>${escapeHtml(post.name)}</strong>
                        <span>${escapeHtml(post.handle)} · now</span>
                    </div>
                    <p>${renderPostTextHtml(post)}</p>
                    ${renderPostImages(getPostImages(post))}
                    <div class="x-feed-actions">
                        <span><i class="far fa-comment"></i> ${escapeHtml(post.comments || '0')}</span>
                        <button class="x-feed-forward-btn" type="button" data-post-id="${escapeHtml(post.id)}" aria-label="转发帖子"><i class="fas fa-retweet"></i> <span>${escapeHtml(post.reposts || '0')}</span></button>
                        <span><i class="far fa-heart"></i> ${escapeHtml(post.likes || '0')}</span>
                        <span><i class="far fa-share-square"></i></span>
                    </div>
                </div>
            `;
        }

        function buildSuperTopicFeedCardHtml(post, topicName = '') {
            const topicLabel = normalizeComposeTopicTag(post.topicTag || topicName);
            const textHtml = renderPostTextHtml({ ...post, topicTag: '' });
            return `
                ${buildAuthorAvatarButton(post, 'x-feed-avatar x-avatar x-super-feed-avatar')}
                <div class="x-feed-body x-super-feed-body">
                    <div class="x-feed-meta x-super-feed-meta">
                        <div>
                            <strong>${escapeHtml(post.name)}</strong>
                            <span>${escapeHtml(post.handle)} · now</span>
                        </div>
                        ${topicLabel ? `<button type="button" class="x-super-topic-chip x-post-topic-link" data-topic-tag="${escapeHtml(topicLabel)}">${escapeHtml(topicLabel)}</button>` : ''}
                    </div>
                    <p class="x-super-feed-text">${textHtml}</p>
                    ${renderPostImages(getPostImages(post))}
                    <div class="x-feed-actions x-super-feed-actions">
                        <span><i class="far fa-comment"></i> ${escapeHtml(post.comments || '0')}</span>
                        <button class="x-feed-forward-btn" type="button" data-post-id="${escapeHtml(post.id)}" aria-label="转发帖子"><i class="fas fa-retweet"></i> <span>${escapeHtml(post.reposts || '0')}</span></button>
                        <span><i class="far fa-heart"></i> ${escapeHtml(post.likes || '0')}</span>
                        <span><i class="far fa-share-square"></i></span>
                    </div>
                </div>
            `;
        }

        function renderGeneratedPosts(state = getXState(), options = {}) {
            const recommendPanel = view.querySelector('.x-feed-panel[data-feed-panel="recommend"]');
            if (!recommendPanel) return;
            if (options.resetLimit) xHomeFeedRenderLimit = xHomeFeedInitialLimit;
            const revision = typeof window.getAppStateRevision === 'function'
                ? window.getAppStateRevision('x')
                : fallbackXStateRevision;
            const renderKey = `${state.activeXPlayerAccountId || 'default'}:${revision}:${xHomeFeedRenderLimit}`;
            if (!options.force && xHomeFeedRenderKey === renderKey) return;
            clearDefaultHomeFeedContent();
            clearHomeEmptyState(recommendPanel);
            recommendPanel.querySelectorAll('.x-generated-feed-card').forEach((card) => card.remove());
            const rawFeedPosts = (state.xGeneratedPosts || []).filter((post) => !post?.isMoment);
            xHomeFeedTotalPosts = rawFeedPosts.length;
            const posts = rawFeedPosts
                .slice(0, xHomeFeedRenderLimit)
                .map((post, index) => normalizeGeneratedPost(post, index))
                .filter(Boolean)
                .map((post) => ensureCommentDepth(post));
            registerGeneratedPosts(posts);
            posts.slice().reverse().forEach((post) => {
                clearHomeEmptyState(recommendPanel);
                const card = document.createElement('article');
                card.className = 'x-feed-card x-generated-feed-card';
                card.setAttribute('data-post-id', post.id);
                card.setAttribute('tabindex', '0');
                card.innerHTML = buildFeedCardHtml(post);
                bindPostCard(card);
                recommendPanel.prepend(card);
                updatePostCountNodes(post.id, getPostThread(post.id, state));
            });
            renderHomeEmptyStates();
            xHomeFeedRenderKey = renderKey;
        }

        function loadMoreHomeFeedPosts() {
            if (xHomeFeedRenderLimit >= xHomeFeedTotalPosts) return;
            xHomeFeedRenderLimit = Math.min(xHomeFeedRenderLimit + xHomeFeedPageSize, xHomeFeedTotalPosts);
            renderGeneratedPosts(getXState());
        }

        function renderTopicFeed(topic) {
            if (!topicFeedPanel) return;
            topicFeedPanel.innerHTML = '';
            const posts = (getXState().xGeneratedPosts || [])
                .filter(p => p.topicTag === topic)
                .map((post, index) => normalizeGeneratedPost(post, index))
                .filter(Boolean)
                .map((post) => ensureCommentDepth(post));
            
            if (posts.length === 0) {
                topicFeedPanel.innerHTML = '<div class="x-empty-state">暂无帖子，点击右上角生成</div>';
                return;
            }

            posts.slice().reverse().forEach((post, index, arr) => {
                const realIndex = arr.length - 1 - index;
                const card = document.createElement('article');
                card.className = 'x-feed-card x-generated-feed-card';
                if (realIndex >= 10) {
                    card.style.display = 'none';
                    card.classList.add('x-hidden-page-2');
                }
                card.setAttribute('data-post-id', post.id);
                card.setAttribute('tabindex', '0');
                card.innerHTML = buildFeedCardHtml(post);
                bindPostCard(card);
                topicFeedPanel.prepend(card);
                updatePostCountNodes(post.id, getPostThread(post.id));
            });
        }

        function openTopicDetail(topicText) {
            currentTopicContext = topicText;
            if (topicDetailHeadline) topicDetailHeadline.textContent = topicText;
            renderTopicFeed(topicText);
            topicDetailView?.classList.add('active');
            topicDetailView?.setAttribute('aria-hidden', 'false');
        }

        function closeTopicDetail() {
            if (topicDetailView?.contains(document.activeElement)) {
                document.activeElement.blur();
            }
            topicDetailView?.classList.remove('active');
            topicDetailView?.setAttribute('aria-hidden', 'true');
            currentTopicContext = null;
        }

        async function generateTopicPosts() {
            if (!currentTopicContext || !topicDetailGenerateBtn) return;
            const topic = currentTopicContext;
            topicDetailGenerateBtn.classList.add('loading');
            topicDetailGenerateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            try {
                const worldbook = getSelectedWorldBookContext(`${topic} ${currentProfile.persona} ${currentProfile.bio}`);
                const reusableAuthors = getReusableAuthorContext();
                const prompt = `Return strict JSON only. Generate 1 to 3 X/Twitter style posts for the user's feed specifically about the topic: "${topic}".
The current User is context only. Every generated post, comment and reply must be authored by a distinct non-User account.
Important: Every post text MUST include the exact text "${topic}" within it as a hashtag or text.
Each post must include: authorName, handle, text, translation, likes, reposts, commentsCount, mediaType ("text" or "image"), optional imagePrompt/images, and comments. Every comment and reply must also include translation.
Each post must have at least 10 comments. Across each post, replies inside comments must total at least 10.
Images are text placeholders: describe the image content in imagePrompt or images[].text.
Authors may use any language that naturally fits their identity and context. For every non-Chinese post, comment or reply, provide an accurate Simplified Chinese translation in its translation field; use "" when the original is already Chinese. Keep imagePrompt descriptions in Simplified Chinese.
X user: ${JSON.stringify(currentProfile)}
Reusable existing authors (optional; when used, return their exact authorId): ${JSON.stringify(reusableAuthors)}
Worldbook:
${worldbook || 'None'}`;
                
                const raw = await requestXChatCompletion([
                    { role: 'system', content: 'You are a JSON generator for a fictional X feed. Output only valid JSON.' },
                    { role: 'user', content: prompt }
                ], { temperature: 0.9 });
                
                const parsed = parseJsonPayload(raw);
                const posts = sanitizeApiGeneratedPosts(Array.isArray(parsed) ? parsed : (Array.isArray(parsed.posts) ? parsed.posts : []));
                
                posts.forEach(p => {
                    if (!p.text.includes(topic)) {
                        p.text += ` ${topic}`;
                    }
                    p.topicTag = topic;
                });

                const added = appendGeneratedPosts(posts);
                await flushXStateNow('x-topic-generation');
                renderTopicFeed(topic);
                if (typeof window.showToast === 'function') window.showToast(added.length ? `已生成 ${added.length} 条帖子` : '没有生成可用帖子');
            } catch (error) {
                console.error('[X] Generate topic posts failed', error);
                if (typeof window.showToast === 'function') window.showToast('生成失败，请检查 API 配置或返回格式');
            } finally {
                topicDetailGenerateBtn.classList.remove('loading');
                topicDetailGenerateBtn.innerHTML = '<i class="fas fa-magic"></i>';
            }
        }

        function appendGeneratedPosts(rawPosts) {
            const normalized = (Array.isArray(rawPosts) ? rawPosts : [])
                .slice(0, 50)
                .map((post, index) => normalizeGeneratedPost(post, index))
                .filter(Boolean)
                .map((post) => ensureCommentDepth(post));
            if (normalized.length === 0) return [];
            updateXState((draft) => {
                const existingIds = new Set((draft.xGeneratedPosts || []).map((post) => String(post.id)));
                normalized.forEach((post) => {
                    if (!existingIds.has(String(post.id))) draft.xGeneratedPosts.unshift(post);
                });
                
                const topicCounts = {};
                draft.xGeneratedPosts = draft.xGeneratedPosts.filter(post => {
                    if (!post.topicTag) return true;
                    topicCounts[post.topicTag] = (topicCounts[post.topicTag] || 0) + 1;
                    return topicCounts[post.topicTag] <= 20;
                });
            });
            renderGeneratedPosts();
            return normalized;
        }

        function renderSuperFollowBar(state = getXState()) {
            const listEl = document.getElementById('x-super-follow-list');
            const countEl = document.getElementById('x-super-follow-count');
            if (!listEl) return;
            const topics = (state.xTopics || []).filter(Boolean);
            const homeCard = view.querySelector('.x-super-home-card');
            const contentTabs = document.getElementById('x-super-profile-tabs');
            const feedPanels = Array.from(view.querySelectorAll('.x-super-feed[data-super-panel]'));
            const setTopicContentVisible = (visible) => {
                if (homeCard) homeCard.hidden = !visible;
                if (contentTabs) contentTabs.hidden = !visible;
                feedPanels.forEach((panel) => { panel.hidden = !visible; });
            };
            if (countEl) countEl.textContent = `${topics.length} followed`;
            if (topics.length === 0) {
                currentActiveTopicId = null;
                setTopicContentVisible(false);
                listEl.innerHTML = '<div class="x-super-empty-follow">暂无关注</div>';
                return;
            }
            setTopicContentVisible(true);
            listEl.innerHTML = topics.map((topic) => {
                const name = safeText(topic.name || topic.title, '超话');
                const topicId = String(topic.id || name);
                const avatar = safeText(topic.avatar || topic.icon, name.slice(0, 1));
                const avatarHtml = avatar.startsWith('data:') || avatar.startsWith('http')
                    ? `<img src="${escapeHtml(avatar)}" alt="">`
                    : escapeHtml(avatar.slice(0, 1));
                return `
                    <button class="x-super-follow-item ${String(currentActiveTopicId) === topicId ? 'active' : ''}" type="button" data-topic-id="${escapeHtml(topicId)}" aria-label="${escapeHtml(name)}">
                        <div class="x-super-follow-avatar">${avatarHtml}</div>
                        <span>${escapeHtml(name)}</span>
                    </button>
                `;
            }).join('');
            
            // 绑定点击事件，切换下方的超话主页卡片
            listEl.querySelectorAll('.x-super-follow-item').forEach(item => {
                item.addEventListener('click', () => {
                    const topicId = item.dataset.topicId;
                    const topic = topics.find(t => String(t.id || t.name) === topicId);
                    if (topic) {
                        if (String(currentActiveTopicId) === String(topicId)) openEditSuperTopicSheet(topicId);
                        else updateSuperHomeCard(topic);
                    }
                });
            });
            
            const activeTopic = topics.find((topic) => String(topic.id || topic.name) === String(currentActiveTopicId)) || topics[0];
            updateSuperHomeCard(activeTopic, state);
        }
        
        let currentActiveTopicId = null;

        async function generateSuperTopicUpdate() {
            if (!currentActiveTopicId || !superUpdateBtn) return;
            const topics = getXState().xTopics || [];
            const topic = topics.find(t => String(t.id || t.name) === String(currentActiveTopicId));
            if (!topic) return;

            const topicName = topic.name || topic.title || '超话';
            
            let charsInfo = [];
            if (Array.isArray(topic.chars) && topic.chars.length > 0) {
                charsInfo = topic.chars.map((char) => ({
                    authorId: String(char.id || char.sourceFriendId || ''),
                    sourceFriendId: safeText(char.sourceFriendId),
                    name: safeText(char.name || char.nickname || char.realName, 'Char'),
                    handle: makeHandle(char.name || 'Char', char.handle || char.realName || char.signature || char.name),
                    persona: safeText(char.persona || char.bio || char.signature)
                }));
            }

            superUpdateBtn.disabled = true;
            superUpdateBtn.setAttribute('aria-label', '更新中');
            superUpdateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            
            try {
                const worldbook = getSelectedWorldBookContext(
                    `${topicName} ${JSON.stringify(charsInfo)}`,
                    getCharacterBoundWorldBookIds(topic.chars)
                );
                const reusableAuthors = getReusableAuthorContext();
                
                const prompt = `Return strict JSON only. Generate an update for a celebrity/entertainment community named "${topicName}" inside the international X app.

Please generate a JSON OBJECT containing the celebrity's online status and an array of 15 to 20 feed items.
The feed items should be a mix of fan posts, photo posts, featured high-quality posts, and moments.
The current User is context only and must never appear as the author of any post, comment, reply, moment, or nested refPost.
The Topic Characters below are canonical identities. If a Topic Character authors a post, comment, reply, moment or nested refPost, copy that character's authorId, name and handle EXACTLY. Never invent a duplicate, clone, alternate handle, lookalike celebrity account, or replacement identity for a Topic Character. Fan and passer-by accounts must be clearly distinct identities.

JSON Format Requirements:
{
  "onlineStatus": {
    "isOnline": boolean, // Is the celebrity online right now?
    "lastOnline": "String" // e.g. "刚刚", "10分钟前", "2小时前", "昨天". Empty string "" if isOnline is true.
  },
  "items": [
    // 1. "Posts" (帖子): Fan/entertainment text posts.
    // Format: { "authorName": "", "handle": "", "text": "", "translation": "", "likes": 0, "reposts": 0, "commentsCount": 10, "mediaType": "text", "comments": [ {"authorName": "", "text": "", "translation": ""} ] }

    // 2. "Photos" (图片): Posts containing images. 
    // Format: { "authorName": "", "handle": "", "text": "", "translation": "", "likes": 0, "reposts": 0, "commentsCount": 10, "mediaType": "image", "imagePrompt": "简体中文图片描述", "comments": [ {"authorName": "", "text": "", "translation": ""} ] }

    // 3. "Featured" (精选): High-quality hot posts (can be text or image). MUST add "isFeatured": true.
    // Format: { "authorName": "", "handle": "", "text": "", "likes": 5000, "reposts": 1000, "commentsCount": 50, "mediaType": "text|image", "isFeatured": true, "comments": [...] }

    // 4. "Moments" (动态): Celebrity activity logs (名人互动动态). MUST add "isMoment": true.
    // Represents the celebrity interacting with other posts (likes, comments, reposts).
    // Format MUST include: "actionText" (e.g. "点赞了这条帖子", "评论了这条帖子"), and a nested "refPost" object representing the original post they interacted with.
    // Format: { "authorName": "Celebrity Name", "handle": "@celeb", "isMoment": true, "actionText": "点赞了这条帖子", "refPost": { "authorName": "Fan Account", "handle": "@fan", "text": "Post content...", "likes": 200, "commentsCount": 10, "mediaType": "text", "comments": [ {"authorName": "", "text": "", "replies": []} ] } }
  ]
}

CRITICAL REQUIREMENT: EVERY SINGLE POST (including normal feed items AND the nested "refPost" inside moments) MUST contain an array of "comments" with at least 10 valid comment objects. For nested "replies" inside comments, they also count towards the total of 10. If the moment actionText says the celebrity "评论了这条帖子" (commented on this post), YOU MUST include the celebrity's comment directly inside the refPost's "comments" array!

Ensure the "items" array has at least 3 items with "isFeatured": true, at least 3 items with "mediaType": "image", and at least 3 items with "isMoment": true.
Authors may use any language natural to their identity and context. Every post, nested refPost, comment and reply must include translation: an accurate Simplified Chinese translation for non-Chinese originals, or "" for Chinese originals. Keep imagePrompt descriptions in Simplified Chinese.

Topic Name: ${topicName}
Canonical Topic Characters (authorId, name and handle are immutable):
${charsInfo.length ? JSON.stringify(charsInfo) : 'None'}
Reusable existing authors (optional; when used, return their exact authorId): ${JSON.stringify(reusableAuthors)}
Worldbook context:
${worldbook || 'None'}
`;
                
                const raw = await requestXChatCompletion([
                    { role: 'system', content: 'You are a JSON generator for a fictional social feed. Output only valid JSON object with onlineStatus and items array.' },
                    { role: 'user', content: prompt }
                ], { temperature: 0.9 });
                
                const parsed = parseJsonPayload(raw);
                let allItems = [];
                let newOnlineStatus = { isOnline: false, lastOnline: "未知" };

                // Handle Object vs Array Fallback
                if (Array.isArray(parsed)) {
                    allItems = parsed;
                } else if (parsed && typeof parsed === 'object') {
                    if (parsed.onlineStatus) {
                        newOnlineStatus = {
                            isOnline: !!parsed.onlineStatus.isOnline,
                            lastOnline: parsed.onlineStatus.lastOnline || ""
                        };
                    }
                    if (Array.isArray(parsed.items)) allItems = allItems.concat(parsed.items);
                    if (Array.isArray(parsed.posts)) allItems = allItems.concat(parsed.posts);
                    if (Array.isArray(parsed.moments)) {
                        parsed.moments.forEach(m => m.isMoment = true);
                        allItems = allItems.concat(parsed.moments);
                    }
                }
                
                // Update topic online status in state
                updateXState(draft => {
                    const t = (draft.xTopics || []).find(x => String(x.id || x.name) === String(currentActiveTopicId));
                    if (t) {
                        t.onlineStatus = newOnlineStatus;
                    }
                });

                allItems = sanitizeApiGeneratedPosts(allItems);
                const cloneAccountIds = new Set();
                allItems = reconcileTopicCharacterAuthors(allItems, topic, cloneAccountIds);
                allItems.forEach(p => {
                    p.topicTag = topicName;
                    p.superTopicId = String(topic.id || topic.name);
                    p.superTopicName = topicName;
                });

                // Update the local object for immediate UI rendering
                topic.onlineStatus = newOnlineStatus;
                
                const added = appendGeneratedPosts(allItems);
                if (cloneAccountIds.size) {
                    updateXState((draft) => {
                        draft.xAccounts = (draft.xAccounts || []).filter((account) => !cloneAccountIds.has(String(account.id)));
                    });
                }
                await flushXStateNow('x-super-topic-generation');
                renderSuperTopicFeed(topic);
                
                if (typeof window.showToast === 'function') {
                    window.showToast(`超话已更新，生成 ${added.length} 条内容`);
                }
            } catch (error) {
                console.error('[X] Generate super topic update failed', error);
                if (typeof window.showToast === 'function') window.showToast('更新失败，请检查 API 配置');
            } finally {
                superUpdateBtn.disabled = false;
                superUpdateBtn.setAttribute('aria-label', '更新');
                superUpdateBtn.innerHTML = '<i class="fas fa-sync"></i>';
            }
        }

        function renderSuperTopicFeed(topic, state = getXState()) {
            if (!topic) return;
            const topicName = topic.name || topic.title || '';
            const featuredPanel = view.querySelector('.x-super-feed[data-super-panel="featured"]');
            const postsPanel = view.querySelector('.x-super-feed[data-super-panel="posts"]');
            const photosPanel = view.querySelector('.x-super-feed[data-super-panel="photos"]');
            const momentsPanel = view.querySelector('.x-super-feed[data-super-panel="moments"]');
            
            const posts = (state.xGeneratedPosts || [])
                .filter((post) => {
                    const topicId = String(topic.id || topic.name);
                    if (post.superTopicId) return String(post.superTopicId) === topicId;
                    if (post.superTopicName) return safeText(post.superTopicName) === topicName;
                    return post.topicTag === topicName;
                })
                .map((post, index) => normalizeGeneratedPost(post, index))
                .filter(Boolean)
                .map((post) => ensureCommentDepth(post));
            
            if (featuredPanel) featuredPanel.innerHTML = '';
            if (postsPanel) postsPanel.innerHTML = '';
            if (photosPanel) photosPanel.innerHTML = '';
            if (momentsPanel) momentsPanel.innerHTML = '';
            
            // Handle Top Online Status for Moments Panel
            let momentsOnlineHeaderHtml = '';
            if (topic.onlineStatus) {
                const status = topic.onlineStatus;
                if (status.isOnline) {
                    momentsOnlineHeaderHtml = `
                        <div class="x-online-status-banner online">
                            <div class="x-online-indicator online"></div>
                            <span class="x-online-text online">明星当前在线</span>
                        </div>
                    `;
                } else if (status.lastOnline) {
                    momentsOnlineHeaderHtml = `
                        <div class="x-online-status-banner offline">
                            <div class="x-online-indicator offline"></div>
                            <span class="x-online-text offline">离线 · 上次在线：${escapeHtml(status.lastOnline)}</span>
                        </div>
                    `;
                }
            }

            if (posts.length === 0) {
                if (featuredPanel) featuredPanel.innerHTML = '<div class="x-empty-state">暂无精选，点击更新获取内容</div>';
                if (postsPanel) postsPanel.innerHTML = '<div class="x-empty-state">暂无帖子</div>';
                if (photosPanel) photosPanel.innerHTML = '<div class="x-empty-state">暂无图片</div>';
                if (momentsPanel) {
                    momentsPanel.innerHTML = momentsOnlineHeaderHtml + '<div class="x-empty-state">暂无动态</div>';
                }
                return;
            }

            if (momentsPanel && momentsOnlineHeaderHtml) {
                momentsPanel.innerHTML = momentsOnlineHeaderHtml; // Insert header first
            }

            posts.slice().reverse().forEach((post, index, arr) => {
                const realIndex = arr.length - 1 - index;
                const card = document.createElement('article');
                card.className = 'x-feed-card x-generated-feed-card x-super-feed-card';
                if (realIndex >= 10) {
                    card.style.display = 'none';
                    card.classList.add('x-hidden-page-2');
                }
                card.setAttribute('data-post-id', post.id);
                card.setAttribute('tabindex', '0');
                
                if (post.isMoment) {
                    card.classList.add('is-moment', 'x-super-moment-card');
                    const actionText = safeText(post.actionText, '更新了动态');
                    const refHtml = post.refPost ? `
                        <div class="x-ref-post x-super-moment-ref" data-ref-id="${escapeHtml(post.refPost.id)}">
                            <div class="x-feed-meta">
                                <strong>${escapeHtml(post.refPost.name)}</strong>
                                <span>${escapeHtml(post.refPost.handle)}</span>
                            </div>
                            <p>${renderPostTextHtml(post.refPost)}</p>
                            ${renderPostImages(getPostImages(post.refPost))}
                        </div>
                    ` : `<p class="x-super-feed-text">${renderPostTextHtml(post)}</p>`;

                    card.innerHTML = `
                        <div class="x-super-moment-shell">
                            <div class="x-moment-action x-super-moment-action">
                                ${buildAuthorAvatarButton(post, 'x-avatar x-moment-avatar')}
                                <div>
                                    <strong>${escapeHtml(post.name)}</strong>
                                    <span>${escapeHtml(actionText)}</span>
                                </div>
                            </div>
                            ${refHtml}
                        </div>
                    `;
                    if (momentsPanel) {
                        const existingHeader = momentsPanel.querySelector('.x-online-status-banner');
                        if (existingHeader) {
                            existingHeader.insertAdjacentElement('afterend', card.cloneNode(true));
                        } else {
                            momentsPanel.prepend(card.cloneNode(true));
                        }
                    }
                } else {
                    card.innerHTML = buildSuperTopicFeedCardHtml(post, topicName);
                    
                    if (postsPanel) postsPanel.prepend(card.cloneNode(true));
                    if (post.isFeatured && featuredPanel) {
                        featuredPanel.prepend(card.cloneNode(true));
                    }
                }
                
                // Bind all cloned cards
                const addedCards = view.querySelectorAll(`.x-feed-card[data-post-id="${post.id}"]`);
                addedCards.forEach(c => bindPostCard(c));
                updatePostCountNodes(post.id, getPostThread(post.id, state));
            });

            // Handle photos panel as a grid
            if (photosPanel) {
                const allImages = posts.flatMap(post => {
                    if (post.isMoment) return [];
                    return getPostImages(post).map(img => ({ ...img, postId: post.id }));
                });

                if (allImages.length === 0) {
                    photosPanel.innerHTML = '<div class="x-empty-state">暂无图片</div>';
                } else {
                    photosPanel.innerHTML = `<div class="x-super-post-grid">
                        ${allImages.map((img, i) => `
                            <div class="x-post-image-thumb ${i >= 12 ? 'x-hidden-page-2' : ''}" style="${i >= 12 ? 'display:none;' : ''}" data-image-text="${escapeHtml(img.text || 'Image')}" data-image-url="${escapeHtml(img.url || '')}" data-post-id="${img.postId}">
                                <img src="${escapeHtml(img.url)}" alt="" onerror="this.remove()">
                            </div>
                        `).join('')}
                    </div>`;
                    
                    // Bind click for images in photo grid
                    photosPanel.querySelectorAll('.x-post-image-thumb').forEach(thumb => {
                        thumb.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openImagePreview(thumb.dataset.imageText || 'Image', thumb.dataset.imageUrl || '');
                        });
                    });
                }
            }

            if (featuredPanel && featuredPanel.children.length === 0) featuredPanel.innerHTML = '<div class="x-empty-state">暂无精选内容</div>';
            if (postsPanel && postsPanel.children.length === 0) postsPanel.innerHTML = '<div class="x-empty-state">暂无帖子</div>';
            
            // Check Moments emptiness safely (considering the online header might be the only child)
            if (momentsPanel) {
                const hasCards = momentsPanel.querySelector('.x-feed-card');
                if (!hasCards) {
                    momentsPanel.insertAdjacentHTML('beforeend', '<div class="x-empty-state">暂无动态</div>');
                }
            }
        }

        function updateSuperHomeCard(topic, state = getXState()) {
            currentActiveTopicId = topic.id || topic.name;
            view.querySelectorAll('.x-super-follow-item[data-topic-id]').forEach((item) => {
                item.classList.toggle('active', String(item.dataset.topicId) === String(currentActiveTopicId));
            });
            const homeCard = view.querySelector('#x-super-tab .x-super-home-card');
            const coverEl = homeCard?.querySelector('.x-super-cover');
            const avatarEl = homeCard?.querySelector('.x-super-topic-avatar');
            const titleEl = homeCard?.querySelector('.x-super-title-row h3');
            const statEl = homeCard?.querySelector('.x-super-title-row span');
            const signBtn = homeCard?.querySelector('.x-super-title-row button');
            
            if (coverEl) {
                if (topic.banner) {
                    coverEl.style.backgroundImage = `url(${topic.banner})`;
                    coverEl.style.backgroundSize = 'cover';
                    coverEl.style.backgroundPosition = 'center';
                    coverEl.innerHTML = '';
                } else {
                    coverEl.style.backgroundImage = '';
                    coverEl.style.backgroundSize = '';
                    coverEl.style.backgroundPosition = '';
                    coverEl.innerHTML = '<div class="x-super-cover-mark">#</div>';
                }
            }
            
            if (avatarEl) {
                const avatar = safeText(topic.avatar || topic.icon, safeText(topic.name || topic.title, '超').slice(0, 1));
                if (avatar.startsWith('data:') || avatar.startsWith('http')) {
                    avatarEl.innerHTML = `<img src="${escapeHtml(avatar)}" alt="">`;
                } else {
                    avatarEl.textContent = avatar;
                }
            }
            
            if (titleEl) {
                titleEl.textContent = safeText(topic.name || topic.title, '超话');
            }

            if (statEl) {
                const signDays = topic.signDays || 0;
                const fans = safeText(topic.fans, '0');
                statEl.textContent = `超话 · ${fans} 粉丝 · 连续签到 ${signDays} 天`;
            }

            if (signBtn) {
                const currentDate = new Date().toISOString().split('T')[0];
                if (topic.lastSignDate === currentDate) {
                    signBtn.textContent = '已签到';
                    signBtn.disabled = true;
                    signBtn.style.opacity = '0.5';
                    signBtn.style.cursor = 'default';
                } else {
                    signBtn.textContent = '签到';
                    signBtn.disabled = false;
                    signBtn.style.opacity = '1';
                    signBtn.style.cursor = 'pointer';
                }
            }
            renderSuperTopicFeed(topic, state);
        }

        function openSuperTopicById(topicId) {
            const targetId = safeText(topicId);
            const topics = getXState().xTopics || [];
            const topic = topics.find((item) =>
                String(item.id || item.name) === targetId || safeText(item.name || item.title) === targetId
            );
            if (!topic) {
                if (typeof window.showToast === 'function') window.showToast('对应超话不存在');
                return;
            }
            closePostDetail();
            closeTopicDetail();
            closeDmProfile();
            closeComposer();
            const superIndex = navItems.findIndex((item) => item.getAttribute('data-target') === 'x-super-tab');
            if (superIndex >= 0) switchTab(superIndex);
            renderSuperFollowBar();
            updateSuperHomeCard(topic);
        }

        function handleTopicSign(topicId) {
            const currentDate = new Date().toISOString().split('T')[0];
            
            updateXState(draft => {
                const topic = (draft.xTopics || []).find(t => String(t.id || t.name) === String(topicId));
                if (topic) {
                    if (topic.lastSignDate !== currentDate) {
                        topic.signDays = (topic.signDays || 0) + 1;
                        topic.lastSignDate = currentDate;
                    }
                }
            });

            const topics = getXState().xTopics || [];
            const topic = topics.find(t => String(t.id || t.name) === String(topicId));
            if (topic) {
                updateSuperHomeCard(topic);
                if (typeof window.showToast === 'function') {
                    window.showToast(`签到成功！已连续签到 ${topic.signDays} 天`);
                }
            }
        }

        function openEditSuperTopicSheet(topicId) {
            const id = safeText(topicId);
            const topic = (getXState().xTopics || []).find((item) => String(item.id || item.name) === id);
            if (!topic || !editSuperTopicSheet) return;
            currentEditingSuperTopicId = String(topic.id || topic.name);
            editSuperTopicAvatarDraft = safeText(topic.avatar || topic.icon);
            editSuperTopicBannerDraft = safeText(topic.banner);
            editSuperTopicSelectedChars = cloneTopicChars(topic.chars || []);
            const nameInput = document.getElementById('x-edit-super-topic-name');
            const fansInput = document.getElementById('x-edit-super-topic-fans');
            if (nameInput) nameInput.value = safeText(topic.name || topic.title, '超话');
            if (fansInput) fansInput.value = safeText(topic.fans, '0');
            renderImagePreview(document.getElementById('x-edit-super-topic-avatar-preview'), editSuperTopicAvatarDraft, '超');
            renderImagePreview(document.getElementById('x-edit-super-topic-banner-preview'), editSuperTopicBannerDraft, 'Cover');
            renderEditTopicSelectedChars();
            const importContainer = document.getElementById('x-edit-topic-imessage-list-container');
            const manualContainer = document.getElementById('x-edit-topic-manual-container');
            if (importContainer) importContainer.style.display = 'none';
            if (manualContainer) manualContainer.style.display = 'none';
            if (typeof window.openView === 'function') window.openView(editSuperTopicSheet);
            else editSuperTopicSheet.classList.add('active');
        }

        function closeEditSuperTopicSheet() {
            currentEditingSuperTopicId = null;
            editSuperTopicAvatarDraft = '';
            editSuperTopicBannerDraft = '';
            editSuperTopicSelectedChars = [];
            if (typeof window.closeView === 'function') window.closeView(editSuperTopicSheet);
            else editSuperTopicSheet?.classList.remove('active');
        }

        function saveEditedSuperTopic() {
            if (!currentEditingSuperTopicId) return;
            const topicId = currentEditingSuperTopicId;
            const name = safeText(document.getElementById('x-edit-super-topic-name')?.value);
            const fans = safeText(document.getElementById('x-edit-super-topic-fans')?.value, '0');
            if (!name) {
                if (typeof window.showToast === 'function') window.showToast('请输入超话名称');
                return;
            }
            let updatedTopic = null;
            const cloneAccountIds = new Set();
            updateXState((draft) => {
                const topic = (draft.xTopics || []).find((item) => String(item.id || item.name) === String(topicId));
                if (!topic) return;
                const previousName = safeText(topic.name || topic.title, '超话');
                topic.name = name;
                topic.title = name;
                topic.fans = fans;
                topic.avatar = editSuperTopicAvatarDraft;
                topic.banner = editSuperTopicBannerDraft;
                topic.chars = cloneTopicChars(editSuperTopicSelectedChars);
                updatedTopic = { ...topic };
                draft.xGeneratedPosts = (draft.xGeneratedPosts || []).map((post) => {
                    const linked = String(post.superTopicId || '') === String(topicId)
                        || (!post.superTopicId && post.topicTag === previousName)
                        || post.superTopicName === previousName;
                    if (!linked) return post;
                    return {
                        ...post,
                        superTopicId: String(topicId),
                        superTopicName: name,
                        topicTag: post.topicTag === previousName ? name : post.topicTag
                    };
                });
                reconcileTopicCharacterAuthors(
                    draft.xGeneratedPosts.filter((post) => String(post.superTopicId || '') === String(topicId)),
                    topic,
                    cloneAccountIds
                );
                if (cloneAccountIds.size) {
                    draft.xAccounts = (draft.xAccounts || []).filter((account) => !cloneAccountIds.has(String(account.id)));
                }
            });
            closeEditSuperTopicSheet();
            renderSuperFollowBar();
            renderGeneratedPosts();
            if (updatedTopic) updateSuperHomeCard(updatedTopic);
            if (typeof window.showToast === 'function') window.showToast('超话信息已更新');
        }

        function deleteEditedSuperTopic() {
            if (!currentEditingSuperTopicId) return;
            const topicId = currentEditingSuperTopicId;
            const topic = (getXState().xTopics || []).find((item) => String(item.id || item.name) === String(topicId));
            if (!topic) return;
            const topicName = safeText(topic.name || topic.title, '超话');
            showXConfirm({
                title: '删除超话',
                message: `确定删除“${topicName}”及其关联帖子吗？此操作不可恢复。`,
                confirmText: '删除',
                isDestructive: true,
                onConfirm: () => {
                    updateXState((draft) => {
                        draft.xTopics = (draft.xTopics || []).filter((item) => String(item.id || item.name) !== String(topicId));
                        const removedIds = new Set();
                        draft.xGeneratedPosts = (draft.xGeneratedPosts || []).filter((post) => {
                            const linked = String(post.superTopicId || '') === String(topicId)
                                || (!post.superTopicId && post.topicTag === topicName)
                                || post.superTopicName === topicName;
                            if (linked) removedIds.add(String(post.id));
                            return !linked;
                        });
                        removedIds.forEach((postId) => { delete draft.xPostThreads[postId]; });
                    });
                    currentActiveTopicId = null;
                    closeEditSuperTopicSheet();
                    renderSuperFollowBar();
                    renderGeneratedPosts();
                    if (typeof window.showToast === 'function') window.showToast('超话已删除');
                }
            });
        }

        // --- Create Topic Logic ---
        function openCreateTopicSheet() {
            createTopicAvatarDraft = '';
            createTopicBannerDraft = '';
            createTopicSelectedChars = [];
            
            if (createTopicNameInput) createTopicNameInput.value = '';
            if (createTopicFansInput) createTopicFansInput.value = '';
            renderImagePreview(createTopicAvatarPreview, '', '超');
            renderImagePreview(createTopicBannerPreview, '', 'Cover');
            renderCreateTopicSelectedChars();
            
            if (createTopicImessageContainer) createTopicImessageContainer.style.display = 'none';
            if (createTopicManualContainer) createTopicManualContainer.style.display = 'none';

            if (typeof window.openView === 'function') window.openView(createTopicSheet);
            else createTopicSheet?.classList.add('active');
        }

        function closeCreateTopicSheet() {
            if (typeof window.closeView === 'function') window.closeView(createTopicSheet);
            else createTopicSheet?.classList.remove('active');
        }

        function saveTopic() {
            const name = safeText(createTopicNameInput?.value);
            const fans = safeText(createTopicFansInput?.value, '0');
            if (!name) {
                if (typeof window.showToast === 'function') window.showToast('请输入超话名字');
                return;
            }
            
            const newTopic = {
                id: makeLocalId('topic'),
                name: name,
                fans: fans,
                avatar: createTopicAvatarDraft,
                banner: createTopicBannerDraft,
                chars: cloneTopicChars(createTopicSelectedChars),
                createdAt: Date.now()
            };
            
            updateXState(draft => {
                draft.xTopics = draft.xTopics || [];
                draft.xTopics.unshift(newTopic);
            });
            
            currentActiveTopicId = String(newTopic.id || newTopic.name);
            renderSuperFollowBar();
            updateSuperHomeCard(newTopic);
            closeCreateTopicSheet();
            if (typeof window.showToast === 'function') window.showToast('超话创建成功');
        }

        async function toggleTopicImportImessage() {
            if (createTopicManualContainer) createTopicManualContainer.style.display = 'none';
            if (!createTopicImessageContainer) return;
            
            if (createTopicImessageContainer.style.display === 'flex') {
                createTopicImessageContainer.style.display = 'none';
            } else {
                createTopicImessageContainer.style.display = 'flex';
                createTopicImessageContainer.innerHTML = '<div style="text-align:center; padding: 10px;">加载中...</div>';
                const chars = await loadImessageChars();
                if (chars.length === 0) {
                    createTopicImessageContainer.innerHTML = '<div style="text-align:center; padding: 10px;">未找到可导入的角色</div>';
                    return;
                }
                
                createTopicImessageContainer.innerHTML = chars.map(char => {
                    const item = normalizeDmChar(stripImessageCharMessagesForXImport(char), 'imessage');
                    return `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid #eee;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div style="width:30px; height:30px; border-radius:50%; overflow:hidden; background:#eee; display:flex; justify-content:center; align-items:center;">
                                    ${buildAvatarHtml(item.avatar, item.name)}
                                </div>
                                <span>${escapeHtml(item.name)}</span>
                            </div>
                            <button type="button" data-char-id="${item.id}" class="x-topic-pick-char-btn" style="padding:4px 10px; border-radius:4px; border:1px solid #ccc; background:#fff; cursor:pointer;">添加</button>
                        </div>
                    `;
                }).join('');
                
                createTopicImessageContainer.querySelectorAll('.x-topic-pick-char-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const charId = btn.dataset.charId;
                        const char = chars.find(c => String(c.id) === String(charId));
                        if (char) {
                            const normalized = normalizeDmChar(stripImessageCharMessagesForXImport(char), 'imessage');
                            if (!createTopicSelectedChars.find(c => c.id === normalized.id)) {
                                createTopicSelectedChars.push(normalized);
                                renderCreateTopicSelectedChars();
                                if (typeof window.showToast === 'function') window.showToast('已添加角色');
                            } else {
                                if (typeof window.showToast === 'function') window.showToast('该角色已添加');
                            }
                        }
                    });
                });
            }
        }

        function toggleTopicManualChar() {
            if (createTopicImessageContainer) createTopicImessageContainer.style.display = 'none';
            if (!createTopicManualContainer) return;
            
            if (createTopicManualContainer.style.display === 'flex') {
                createTopicManualContainer.style.display = 'none';
            } else {
                createTopicManualContainer.style.display = 'flex';
            }
        }

        function saveTopicManualChar() {
            const nameInput = document.getElementById('x-topic-manual-name');
            const handleInput = document.getElementById('x-topic-manual-handle');
            const bioInput = document.getElementById('x-topic-manual-bio');
            const personaInput = document.getElementById('x-topic-manual-persona');
            
            const name = safeText(nameInput?.value);
            if (!name) {
                if (typeof window.showToast === 'function') window.showToast('请输入角色名称');
                return;
            }
            
            const newChar = {
                id: makeLocalId('manual-char'),
                origin: 'manual',
                name: name,
                handle: makeHandle(name, handleInput?.value),
                bio: safeText(bioInput?.value),
                persona: safeText(personaInput?.value),
                avatar: ''
            };
            
            createTopicSelectedChars.push(newChar);
            renderCreateTopicSelectedChars();
            
            if (nameInput) nameInput.value = '';
            if (handleInput) handleInput.value = '';
            if (bioInput) bioInput.value = '';
            if (personaInput) personaInput.value = '';
            
            if (typeof window.showToast === 'function') window.showToast('已添加角色');
        }

        function renderCreateTopicSelectedChars() {
            if (!createTopicCharsList) return;
            if (createTopicSelectedChars.length === 0) {
                createTopicCharsList.innerHTML = '<div style="color: #888; font-size: 13px;">暂未添加任何角色</div>';
                return;
            }
            createTopicCharsList.innerHTML = createTopicSelectedChars.map((char, index) => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#f0f0f0; padding:8px 12px; border-radius:8px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:24px; height:24px; border-radius:50%; overflow:hidden; background:#ccc; display:flex; justify-content:center; align-items:center; font-size:12px;">
                            ${buildAvatarHtml(char.avatar, char.name)}
                        </div>
                        <span style="font-weight:bold;">${escapeHtml(char.name)}</span>
                    </div>
                    <i class="fas fa-times x-topic-remove-char" data-index="${index}" style="color:#ff3b30; cursor:pointer;"></i>
                </div>
            `).join('');
            
            createTopicCharsList.querySelectorAll('.x-topic-remove-char').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.index, 10);
                    if (!isNaN(idx)) {
                        createTopicSelectedChars.splice(idx, 1);
                        renderCreateTopicSelectedChars();
                    }
                });
            });
        }

        function getTopicEditorConfig(mode = 'create') {
            const isEdit = mode === 'edit';
            return {
                mode: isEdit ? 'edit' : 'create',
                charsList: isEdit ? document.getElementById('x-edit-topic-chars-list') : createTopicCharsList,
                importContainer: isEdit ? document.getElementById('x-edit-topic-imessage-list-container') : createTopicImessageContainer,
                manualContainer: isEdit ? document.getElementById('x-edit-topic-manual-container') : createTopicManualContainer,
                manualNameId: isEdit ? 'x-edit-topic-manual-name' : 'x-topic-manual-name',
                manualHandleId: isEdit ? 'x-edit-topic-manual-handle' : 'x-topic-manual-handle',
                manualBioId: isEdit ? 'x-edit-topic-manual-bio' : 'x-topic-manual-bio',
                manualPersonaId: isEdit ? 'x-edit-topic-manual-persona' : 'x-topic-manual-persona'
            };
        }

        function getTopicEditorChars(mode = 'create') {
            return mode === 'edit' ? editSuperTopicSelectedChars : createTopicSelectedChars;
        }

        function getTopicCharKey(char = {}) {
            const origin = safeText(char.origin, 'manual');
            const id = safeText(char.sourceFriendId || char.id || char.name, char.name || origin);
            return (origin + ':' + id).toLocaleLowerCase();
        }

        function cloneTopicChars(chars = []) {
            return (Array.isArray(chars) ? chars : [])
                .map((char) => normalizeDmChar(char, char?.origin || 'manual'))
                .filter((char) => safeText(char.name));
        }

        function addTopicEditorChar(mode, rawChar) {
            const chars = getTopicEditorChars(mode);
            const normalized = normalizeDmChar(rawChar, rawChar?.origin || 'manual');
            const key = getTopicCharKey(normalized);
            if (chars.some((char) => getTopicCharKey(char) === key)) {
                if (typeof window.showToast === 'function') window.showToast('该角色已添加');
                return false;
            }
            chars.push(normalized);
            renderTopicEditorSelectedChars(mode);
            if (typeof window.showToast === 'function') window.showToast('已添加角色');
            return true;
        }

        function renderTopicEditorSelectedChars(mode = 'create') {
            const config = getTopicEditorConfig(mode);
            const listEl = config.charsList;
            if (!listEl) return;
            const chars = getTopicEditorChars(config.mode);
            if (chars.length === 0) {
                listEl.innerHTML = '<div class="x-topic-chars-empty">暂未添加任何角色</div>';
                return;
            }
            listEl.innerHTML = chars.map((char, index) => {
                const originLabel = char.origin === 'imessage' ? 'iMessage' : '手动';
                return '<div class="x-topic-char-chip">' +
                    '<div class="x-topic-char-avatar">' + buildAvatarHtml(char.avatar, char.name) + '</div>' +
                    '<div class="x-topic-char-copy">' +
                        '<strong>' + escapeHtml(char.name || 'Char') + '</strong>' +
                        '<span>' + escapeHtml(char.handle || originLabel) + '</span>' +
                    '</div>' +
                    '<em>' + escapeHtml(originLabel) + '</em>' +
                    '<button type="button" class="x-topic-remove-char" data-index="' + index + '" aria-label="移除角色"><i class="fas fa-times"></i></button>' +
                '</div>';
            }).join('');
            listEl.querySelectorAll('.x-topic-remove-char').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.index, 10);
                    if (!Number.isNaN(idx)) {
                        chars.splice(idx, 1);
                        renderTopicEditorSelectedChars(config.mode);
                    }
                });
            });
        }

        async function toggleTopicEditorImport(mode = 'create') {
            const config = getTopicEditorConfig(mode);
            const importContainer = config.importContainer;
            const manualContainer = config.manualContainer;
            if (manualContainer) manualContainer.style.display = 'none';
            if (!importContainer) return;

            if (importContainer.style.display === 'flex') {
                importContainer.style.display = 'none';
                return;
            }

            importContainer.style.display = 'flex';
            importContainer.innerHTML = '<div class="x-topic-source-empty">加载 iMessage 角色中...</div>';
            const chars = await loadImessageChars();
            if (chars.length === 0) {
                importContainer.innerHTML = '<div class="x-topic-source-empty">未找到可导入的角色</div>';
                return;
            }

            const normalizedChars = chars.map((char) => normalizeDmChar(stripImessageCharMessagesForXImport(char), 'imessage'));
            importContainer.innerHTML =
                '<div class="x-topic-native-picker">' +
                    '<select class="x-topic-imessage-select" aria-label="选择 iMessage 角色">' +
                        '<option value="">选择要添加的角色</option>' +
                        normalizedChars.map((item, index) =>
                            '<option value="' + index + '">' + escapeHtml(item.name) + ' · ' + escapeHtml(item.handle || 'iMessage') + '</option>'
                        ).join('') +
                    '</select>' +
                    '<button type="button" class="x-topic-native-add-btn">添加</button>' +
                '</div>';

            const selectEl = importContainer.querySelector('.x-topic-imessage-select');
            importContainer.querySelector('.x-topic-native-add-btn')?.addEventListener('click', () => {
                const selectedIndex = parseInt(selectEl?.value || '', 10);
                if (Number.isNaN(selectedIndex) || !normalizedChars[selectedIndex]) {
                    if (typeof window.showToast === 'function') window.showToast('请选择角色');
                    return;
                }
                if (addTopicEditorChar(config.mode, normalizedChars[selectedIndex]) && selectEl) {
                    selectEl.value = '';
                }
            });
        }

        function toggleTopicEditorManual(mode = 'create') {
            const config = getTopicEditorConfig(mode);
            if (config.importContainer) config.importContainer.style.display = 'none';
            if (!config.manualContainer) return;
            config.manualContainer.style.display = config.manualContainer.style.display === 'grid' ? 'none' : 'grid';
        }

        function saveTopicEditorManualChar(mode = 'create') {
            const config = getTopicEditorConfig(mode);
            const nameInput = document.getElementById(config.manualNameId);
            const handleInput = document.getElementById(config.manualHandleId);
            const bioInput = document.getElementById(config.manualBioId);
            const personaInput = document.getElementById(config.manualPersonaId);
            const name = safeText(nameInput?.value);
            if (!name) {
                if (typeof window.showToast === 'function') window.showToast('请输入角色名称');
                return;
            }
            addTopicEditorChar(config.mode, {
                id: makeLocalId('manual-char'),
                origin: 'manual',
                name,
                handle: makeHandle(name, handleInput?.value),
                bio: safeText(bioInput?.value),
                persona: safeText(personaInput?.value),
                avatar: ''
            });
            if (nameInput) nameInput.value = '';
            if (handleInput) handleInput.value = '';
            if (bioInput) bioInput.value = '';
            if (personaInput) personaInput.value = '';
        }

        async function toggleTopicImportImessage() {
            return toggleTopicEditorImport('create');
        }

        function toggleTopicManualChar() {
            return toggleTopicEditorManual('create');
        }

        function saveTopicManualChar() {
            return saveTopicEditorManualChar('create');
        }

        function renderCreateTopicSelectedChars() {
            return renderTopicEditorSelectedChars('create');
        }

        function toggleEditTopicImportImessage() {
            return toggleTopicEditorImport('edit');
        }

        function toggleEditTopicManualChar() {
            return toggleTopicEditorManual('edit');
        }

        function saveEditTopicManualChar() {
            return saveTopicEditorManualChar('edit');
        }

        function renderEditTopicSelectedChars() {
            return renderTopicEditorSelectedChars('edit');
        }

        function getBaseThread(postId) {
            const post = postData[postId] || postData.island;
            const frontendMetrics = getFrontendPostMetrics(postId);
            return {
                likes: frontendMetrics.likes,
                reposts: frontendMetrics.reposts,
                commentsCount: parseCompactCount(post.comments),
                liked: false,
                reposted: false,
                frontendMetricVersion: 1,
                comments: (Array.isArray(post.commentList) ? post.commentList : []).map((comment, index) => ({
                    id: comment.id || `${postId}-comment-${index}`,
                    authorId: comment.authorId || makeAccountId(comment.handle, comment.name),
                    avatar: comment.avatar || '?',
                    name: comment.name || 'User',
                    handle: comment.handle || '@user',
                    text: comment.text || '',
                    translation: safeText(comment.translation),
                    replies: Array.isArray(comment.replies) ? comment.replies : []
                }))
            };
        }

        function getPostThread(postId, state = getXState()) {
            const base = getBaseThread(postId);
            const saved = state.xPostThreads?.[postId];
            if (!saved || typeof saved !== 'object') return base;
            const useSavedMetrics = Number(saved.frontendMetricVersion) === 1;
            return {
                ...base,
                ...saved,
                comments: Array.isArray(saved.comments) ? saved.comments : base.comments,
                likes: useSavedMetrics && Number.isFinite(Number(saved.likes)) ? Number(saved.likes) : base.likes + (saved.liked ? 1 : 0),
                reposts: useSavedMetrics && Number.isFinite(Number(saved.reposts)) ? Number(saved.reposts) : base.reposts + (saved.reposted ? 1 : 0),
                commentsCount: Number.isFinite(Number(saved.commentsCount)) ? Number(saved.commentsCount) : base.commentsCount,
                liked: !!saved.liked,
                reposted: !!saved.reposted,
                frontendMetricVersion: 1
            };
        }

        function savePostThread(postId, thread) {
            updateXState((draft) => {
                draft.xPostThreads[postId] = thread;
            });
        }

        function escapeCssIdent(value) {
            if (window.CSS && typeof window.CSS.escape === 'function') return CSS.escape(String(value));
            return String(value).replace(/["\\]/g, '\\$&');
        }

        function updatePostCountNodes(postId, thread) {
            const post = postData[postId];
            if (post) {
                post.likes = formatCompactCount(thread.likes);
                post.reposts = formatCompactCount(thread.reposts);
                post.comments = formatCompactCount(thread.commentsCount);
            }
            view.querySelectorAll(`.x-feed-card[data-post-id="${escapeCssIdent(postId)}"]`).forEach((card) => {
                const actionItems = Array.from(card.querySelector('.x-feed-actions')?.children || []);
                if (actionItems[0]) actionItems[0].innerHTML = `<i class="far fa-comment"></i> ${escapeHtml(formatCompactCount(thread.commentsCount))}`;
                if (actionItems[1]) {
                    actionItems[1].classList.toggle('active', !!thread.reposted);
                    actionItems[1].innerHTML = `<i class="fas fa-retweet"></i> <span>${escapeHtml(formatCompactCount(thread.reposts))}</span>`;
                }
                if (actionItems[2]) {
                    actionItems[2].classList.toggle('active', !!thread.liked);
                    actionItems[2].innerHTML = `<i class="${thread.liked ? 'fas' : 'far'} fa-heart"></i> ${escapeHtml(formatCompactCount(thread.likes))}`;
                }
            });
        }

        function renderDetailActions(thread) {
            const repostBtn = document.getElementById('x-detail-repost-btn');
            const likeBtn = document.getElementById('x-detail-like-btn');
            repostBtn?.classList.toggle('active', !!thread.reposted);
            likeBtn?.classList.toggle('active', !!thread.liked);
            const likeIcon = likeBtn?.querySelector('i');
            if (likeIcon) likeIcon.className = `${thread.liked ? 'fas' : 'far'} fa-heart`;
        }

        function renderReplyContext() {
            const context = document.getElementById('x-reply-context');
            const textEl = document.getElementById('x-reply-context-text');
            if (!context || !textEl) return;
            if (!replyTarget || !currentDetailPostId) {
                context.hidden = true;
                textEl.textContent = 'Replying to post';
                return;
            }
            context.hidden = false;
            textEl.textContent = `Replying to ${replyTarget.name || 'comment'}`;
        }

        function findCommentById(thread, commentId) {
            return (thread.comments || []).find((comment) => String(comment.id) === String(commentId)) || null;
        }

        function findReplyById(comment, replyId) {
            return (Array.isArray(comment?.replies) ? comment.replies : [])
                .find((reply) => String(reply.id) === String(replyId)) || null;
        }

        function deletePostComment(commentId, replyId = '') {
            if (!currentDetailPostId || !commentId) return;
            const thread = getPostThread(currentDetailPostId);
            const rootComment = findCommentById(thread, commentId);
            if (!rootComment) return;
            let removedCount = 0;

            if (replyId) {
                const replies = Array.isArray(rootComment.replies) ? rootComment.replies : [];
                const replyIndex = replies.findIndex((reply) => String(reply.id) === String(replyId));
                if (replyIndex < 0) return;
                replies.splice(replyIndex, 1);
                rootComment.replies = replies;
                removedCount = 1;
            } else {
                const commentIndex = thread.comments.findIndex((comment) => String(comment.id) === String(commentId));
                if (commentIndex < 0) return;
                removedCount = 1 + (Array.isArray(thread.comments[commentIndex].replies) ? thread.comments[commentIndex].replies.length : 0);
                thread.comments.splice(commentIndex, 1);
            }

            thread.commentsCount = Math.max(0, Number(thread.commentsCount) - removedCount);
            savePostThread(currentDetailPostId, thread);
            if (String(replyTarget?.commentId || '') === String(commentId)
                && (!replyId || String(replyTarget?.replyId || '') === String(replyId))) {
                setReplyTarget(null);
            }
            renderCommentsList(currentDetailPostId, thread);
            updatePostCountNodes(currentDetailPostId, thread);
            const commentsEl = document.getElementById('x-detail-comments');
            if (commentsEl) commentsEl.textContent = formatCompactCount(thread.commentsCount);
        }

        function renderCommentsList(postId, thread) {
            const commentsList = document.getElementById('x-comments-list');
            if (!commentsList) return;
            commentsList.innerHTML = thread.comments.map((comment) => {
                const replies = Array.isArray(comment.replies) ? comment.replies : [];
                const repliesHtml = replies.length
                    ? `<div class="x-comment-replies">${replies.map((reply) => `
                        <div class="x-comment-reply" data-comment-id="${escapeHtml(comment.id)}" data-reply-id="${escapeHtml(reply.id)}">
                            ${buildAuthorAvatarButton(reply, 'x-avatar')}
                            <div>
                                <strong>${escapeHtml(reply.name)}</strong>
                                <span>${escapeHtml(reply.handle)}</span>
                                <p>${reply.replyToName ? `<b>回复 @${escapeHtml(reply.replyToName)}</b> ` : ''}${escapeHtml(reply.text)}</p>
                                <div class="x-comment-action-row">
                                    <button class="x-comment-reply-btn" type="button" data-comment-id="${escapeHtml(comment.id)}" data-reply-id="${escapeHtml(reply.id)}" data-reply-name="${escapeHtml(reply.name)}">回复</button>
                                    ${reply.translation ? '<button class="x-translation-toggle x-comment-translation-toggle" type="button" aria-expanded="false">翻译</button>' : ''}
                                    <button class="x-comment-delete-btn" type="button" data-comment-id="${escapeHtml(comment.id)}" data-reply-id="${escapeHtml(reply.id)}">删除</button>
                                </div>
                                ${reply.translation ? `<p class="x-translation-text" hidden>${escapeHtml(reply.translation)}</p>` : ''}
                            </div>
                        </div>
                    `).join('')}</div>`
                    : '';
                return `
                    <div class="x-comment-row" data-comment-id="${escapeHtml(comment.id)}">
                        ${buildAuthorAvatarButton(comment, 'x-avatar')}
                        <div class="x-comment-main">
                            <strong>${escapeHtml(comment.name)}</strong>
                            <span>${escapeHtml(comment.handle)}</span>
                            <p>${escapeHtml(comment.text)}</p>
                            <div class="x-comment-action-row">
                                <button class="x-comment-reply-btn" type="button" data-comment-id="${escapeHtml(comment.id)}">回复</button>
                                ${comment.translation ? '<button class="x-translation-toggle x-comment-translation-toggle" type="button" aria-expanded="false">翻译</button>' : ''}
                                <button class="x-comment-delete-btn" type="button" data-comment-id="${escapeHtml(comment.id)}">删除</button>
                            </div>
                            ${comment.translation ? `<p class="x-translation-text" hidden>${escapeHtml(comment.translation)}</p>` : ''}
                            ${repliesHtml}
                        </div>
                    </div>
                `;
            }).join('');
        }

        function setReplyTarget(target = null) {
            if (!target) {
                replyTarget = null;
            } else if (typeof target === 'object') {
                replyTarget = {
                    commentId: String(target.commentId || ''),
                    replyId: target.replyId ? String(target.replyId) : '',
                    name: safeText(target.name, 'comment')
                };
            } else {
                const thread = currentDetailPostId ? getPostThread(currentDetailPostId) : null;
                const comment = thread ? findCommentById(thread, target) : null;
                replyTarget = {
                    commentId: String(target),
                    replyId: '',
                    name: safeText(comment?.name, 'comment')
                };
            }
            renderReplyContext();
            document.getElementById('x-reply-input')?.focus();
        }

        function submitReply() {
            if (!currentDetailPostId) return;
            const input = document.getElementById('x-reply-input');
            const text = safeText(input?.value);
            if (!text) {
                if (typeof window.showToast === 'function') window.showToast('请输入回复内容');
                return;
            }
            const author = getCurrentCommentAuthor();
            const thread = getPostThread(currentDetailPostId);
            let rootCommentId = '';
            let userReply = null;
            let appended = false;
            if (replyTarget?.commentId) {
                const target = findCommentById(thread, replyTarget.commentId);
                if (target) {
                    target.replies = Array.isArray(target.replies) ? target.replies : [];
                    userReply = {
                        id: makeLocalId('reply'),
                        ...author,
                        text,
                        replyToId: replyTarget.replyId || '',
                        replyToName: replyTarget.name || target.name || ''
                    };
                    target.replies.push(userReply);
                    rootCommentId = target.id;
                    appended = true;
                }
            }
            if (!appended) {
                userReply = {
                    id: makeLocalId('comment'),
                    ...author,
                    text,
                    replies: []
                };
                thread.comments.unshift(userReply);
                rootCommentId = userReply.id;
            }
            thread.commentsCount += 1;
            savePostThread(currentDetailPostId, thread);
            updatePostCountNodes(currentDetailPostId, thread);
            if (input) input.value = '';
            setReplyTarget(null);
            openPostDetail(currentDetailPostId);
            if (rootCommentId && userReply) {
                generateUserReplyEngagement(currentDetailPostId, rootCommentId, userReply, appended);
            }
        }

        function normalizeEngagementReply(reply, index = 0, replyTo = {}) {
            const text = safeText(reply?.text || reply?.content);
            const name = safeText(reply?.authorName || reply?.name || reply?.handle);
            if (!text || !name) return null;
            return {
                id: String(reply.id || makeLocalId('auto-reply')),
                avatar: normalizePersonAvatar(reply.authorAvatar || reply.avatar, `reply:${reply.authorId || reply.handle || name}`),
                name,
                handle: makeHandle(name, reply.handle || name),
                text,
                translation: getGeneratedTranslation(reply, text),
                replyToId: replyTo.id || '',
                replyToName: replyTo.name || '',
                replies: []
            };
        }

        function normalizeGeneratedVisitor(visitor, index = 0) {
            const name = safeText(visitor?.name || visitor?.authorName || visitor?.handle);
            if (!name) return null;
            return {
                id: String(visitor.id || makeLocalId('x-visitor')),
                avatar: normalizePersonAvatar(visitor.avatar || visitor.authorAvatar, `visitor:${visitor.id || visitor.handle || name}`),
                name,
                handle: makeHandle(name, visitor.handle || name),
                bio: safeText(visitor.bio || visitor.reason || visitor.text),
                time: safeText(visitor.time, 'now'),
                createdAt: Date.now()
            };
        }

        async function generateUserReplyEngagement(postId, rootCommentId, userReply, isNestedReply = false) {
            const post = postData[postId] || {};
            const rootThread = getPostThread(postId);
            const rootComment = findCommentById(rootThread, rootCommentId);
            if (!rootComment || !userReply) return;
            try {
                const worldbook = getSelectedWorldBookContext([
                    post.name,
                    post.text,
                    rootComment.name,
                    rootComment.text,
                    userReply.text,
                    currentProfile.persona
                ].filter(Boolean).join(' '));
                const prompt = `Return strict JSON only. A user just commented in an X/Twitter-style post detail page. Generate engagement around this user's exact comment.
Output JSON shape:
{
  "replies": [{"authorName":"", "handle":"", "text":"", "translation":""}],
  "visitors": [{"name":"", "handle":"", "bio":"", "translation":"", "avatar":"", "time":"now"}]
}
Rules:
- replies must contain at least 5 items.
- visitors must contain 2 to 5 items.
- Every generated reply and visitor must be a non-User identity. Never write another comment or reply as the current User.
- Replies must directly respond to the user's comment, not to the whole post in general.
- Keep replies short, social, varied, and realistic. Mix agreement, disagreement, teasing, clarification, and curiosity.
- Each account may use the language natural to its identity. For non-Chinese reply or bio text, translation must contain Simplified Chinese; for Chinese originals use "".
- Visitors are people who visited the user's profile because of this comment; bio should briefly explain the vibe or reason.
- Do not include markdown or extra text.

Post author: ${post.name || ''}
Post text: ${post.text || ''}
Root comment author: ${rootComment.name || ''}
Root comment text: ${rootComment.text || ''}
User display name: ${currentProfile.name} ${currentProfile.handle}
User comment text: ${userReply.text}
User comment type: ${isNestedReply ? 'reply inside a comment thread' : 'top-level comment'}

Worldbook:
${worldbook || 'None'}`;
                const raw = await requestXChatCompletion([
                    { role: 'system', content: 'You generate strict JSON for social-feed replies and profile visitors.' },
                    { role: 'user', content: prompt }
                ], { temperature: 0.9 });
                const parsed = parseJsonPayload(raw);
                const rawReplies = sanitizeApiGeneratedAuthors(Array.isArray(parsed?.replies) ? parsed.replies : []);
                const rawVisitors = sanitizeApiGeneratedAuthors(Array.isArray(parsed?.visitors) ? parsed.visitors : []);
                const replyTo = isNestedReply ? { id: userReply.id, name: userReply.name } : {};
                const generatedReplies = rawReplies
                    .map((reply, index) => normalizeEngagementReply(reply, index, replyTo))
                    .filter(Boolean);
                const visitors = rawVisitors
                    .map((visitor, index) => normalizeGeneratedVisitor(visitor, index))
                    .filter(Boolean);

                if (generatedReplies.length) {
                    const latestThread = getPostThread(postId);
                    const latestRoot = findCommentById(latestThread, rootCommentId);
                    if (latestRoot) {
                        latestRoot.replies = Array.isArray(latestRoot.replies) ? latestRoot.replies : [];
                        const existingIds = new Set(latestRoot.replies.map((reply) => String(reply.id)));
                        generatedReplies.forEach((reply) => {
                            if (!existingIds.has(String(reply.id))) latestRoot.replies.push(reply);
                        });
                        latestThread.commentsCount += generatedReplies.length;
                        savePostThread(postId, latestThread);
                        updatePostCountNodes(postId, latestThread);
                        if (String(currentDetailPostId) === String(postId)) {
                            renderCommentsList(postId, latestThread);
                            const commentsEl = document.getElementById('x-detail-comments');
                            if (commentsEl) commentsEl.textContent = formatCompactCount(latestThread.commentsCount);
                        }
                    }
                }

                if (visitors.length) {
                    updateXState((draft) => {
                        const existingIds = new Set((draft.xVisitors || []).map((visitor) => String(visitor.id)));
                        visitors.slice(0, 5).reverse().forEach((visitor) => {
                            if (!existingIds.has(String(visitor.id))) draft.xVisitors.unshift(visitor);
                        });
                    });
                    renderVisitors();
                }
            } catch (error) {
                console.error('[X] Generate user reply engagement failed', error);
                if (typeof window.showToast === 'function') window.showToast('回复生成失败');
            }
        }

        function toggleDetailAction(kind) {
            if (!currentDetailPostId) return;
            const thread = getPostThread(currentDetailPostId);
            if (kind === 'like') {
                thread.liked = !thread.liked;
                thread.likes += thread.liked ? 1 : -1;
            } else if (kind === 'repost') {
                thread.reposted = !thread.reposted;
                thread.reposts += thread.reposted ? 1 : -1;
            }
            thread.likes = Math.max(0, thread.likes);
            thread.reposts = Math.max(0, thread.reposts);
            savePostThread(currentDetailPostId, thread);
            updatePostCountNodes(currentDetailPostId, thread);
            openPostDetail(currentDetailPostId);
        }

        function normalizePostSnapshot(snapshot = {}) {
            const comments = Array.isArray(snapshot.comments) ? snapshot.comments : [];
            return {
                id: String(snapshot.id || makeLocalId('shared-post')),
                authorId: safeText(snapshot.authorId),
                name: safeText(snapshot.name || snapshot.authorName, 'X User'),
                handle: safeText(snapshot.handle || snapshot.authorHandle),
                avatar: safeText(snapshot.avatar || snapshot.authorAvatar),
                text: safeText(snapshot.text || snapshot.content),
                translation: getGeneratedTranslation(snapshot, snapshot.text || snapshot.content),
                topicTag: safeText(snapshot.topicTag),
                images: Array.isArray(snapshot.images) ? snapshot.images.slice(0, 4) : [],
                comments: comments.map((comment) => ({
                    authorId: safeText(comment.authorId),
                    avatar: safeText(comment.avatar || comment.authorAvatar),
                    name: safeText(comment.name || comment.authorName, 'User'),
                    handle: safeText(comment.handle),
                    text: safeText(comment.text || comment.content),
                    translation: getGeneratedTranslation(comment, comment.text || comment.content),
                    replies: (Array.isArray(comment.replies) ? comment.replies : []).map((reply) => ({
                        authorId: safeText(reply.authorId),
                        avatar: safeText(reply.avatar || reply.authorAvatar),
                        name: safeText(reply.name || reply.authorName, 'User'),
                        handle: safeText(reply.handle),
                        text: safeText(reply.text || reply.content),
                        translation: getGeneratedTranslation(reply, reply.text || reply.content)
                    })).filter((reply) => reply.text)
                })).filter((comment) => comment.text)
            };
        }

        function normalizeDmMessages(messages) {
            if (!Array.isArray(messages)) return [];
            return messages.map((message) => {
                const source = message?.source || message?.sender;
                const type = message?.type === 'post-card' ? 'post-card' : 'text';
                return {
                    id: String(message?.id || makeLocalId('dm-msg')),
                    source: source === 'user' ? 'user' : 'char',
                    type,
                    text: safeText(message?.text || message?.content || message?.message),
                    postSnapshot: type === 'post-card' ? normalizePostSnapshot(message?.postSnapshot || message?.post) : null,
                    translation: getGeneratedTranslation(message, message?.text || message?.content || message?.message),
                    createdAt: Number(message?.createdAt || message?.timestamp || Date.now())
                };
            }).filter((message) => message.text || message.type === 'post-card');
        }

        function normalizeImessageContextMount(mount) {
            const source = mount && typeof mount === 'object' && !Array.isArray(mount) ? mount : {};
            const parsedLimit = Number(source.limit);
            return {
                enabled: source.enabled !== false,
                limit: Number.isFinite(parsedLimit)
                    ? Math.max(1, Math.min(50, Math.floor(parsedLimit)))
                    : defaultImessageContextMount.limit
            };
        }

        function isImessageImportedDm(item) {
            return Boolean(
                item
                && item.origin === 'imessage'
                && String(item.sourceFriendId || '').trim()
            );
        }

        function getLinkedImessageCharForDm(item) {
            if (!isImessageImportedDm(item)) return null;
            const friendId = String(item.sourceFriendId || '').trim();
            const friend = window.imApp?.getFriendById?.(friendId)
                || (Array.isArray(window.imData?.friends)
                    ? window.imData.friends.find(candidate => String(candidate?.id) === friendId)
                    : null);
            return friend?.type === 'char' ? friend : null;
        }

        function formatImessageContextTimestamp(timestamp) {
            const date = new Date(Number(timestamp));
            if (Number.isNaN(date.getTime())) return '';
            const pad = value => String(value).padStart(2, '0');
            return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
        }

        function buildImessageSingleChatContextMessage(message, userName, charName) {
            if (!message || (message.role !== 'user' && message.role !== 'assistant')) return '';
            const rawText = message.content || message.text || message.message || '';
            const text = String(rawText)
                .replace(/[<>]/g, character => character === '<' ? '‹' : '›')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 800);
            if (!text) return '';
            const timestamp = formatImessageContextTimestamp(message.timestamp);
            const speaker = message.role === 'user' ? userName : charName;
            return `${timestamp ? `[${timestamp}] ` : ''}${speaker}: ${text}`;
        }

        async function buildImessageSingleChatContext(item) {
            const mount = normalizeImessageContextMount(item?.imessageContextMount);
            if (!mount.enabled) return '';

            const initialFriend = getLinkedImessageCharForDm(item);
            if (!initialFriend) return '';

            if (window.imApp?.ensureFriendMessagesLoaded) {
                await window.imApp.ensureFriendMessagesLoaded(initialFriend);
            }

            const friend = getLinkedImessageCharForDm(item);
            if (!friend) return '';

            const userName = safeText(currentProfile?.name, 'User')
                .replace(/[<>]/g, character => character === '<' ? '‹' : '›');
            const charName = safeText(friend.nickname || friend.realName || item.name, 'Char')
                .replace(/[<>]/g, character => character === '<' ? '‹' : '›');
            const recentMessages = (Array.isArray(friend.messages) ? friend.messages : [])
                .filter(message => message?.role === 'user' || message?.role === 'assistant')
                .slice(-mount.limit)
                .map(message => buildImessageSingleChatContextMessage(message, userName, charName))
                .filter(Boolean);
            if (!recentMessages.length) return '';

            return `<mounted_imessage_single_chat_context>\nSource: prior iMessage one-to-one chat with the same Char. This is cross-platform continuity only, not a message in the current X conversation.\nUse it only to maintain continuity with User. Do not say it happened on X, do not repeat it as a new X message, and do not imply anyone else saw it.\nSame iMessage Char: ${charName}\nRecent iMessage messages:\n${recentMessages.join('\n')}\n</mounted_imessage_single_chat_context>`;
        }

        function stripImessageCharMessagesForXImport(source = {}) {
            if (!source || typeof source !== 'object') return source;
            const id = source.id || source.sourceFriendId || makeLocalId('imessage');
            return {
                ...source,
                id,
                origin: 'imessage',
                sourceFriendId: source.sourceFriendId || source.id || id,
                messages: []
            };
        }

        function getDmLastMessageText(item) {
            const messages = normalizeDmMessages(item?.messages);
            if (!messages.length) return safeText(item?.bio, '暂无签名');
            const last = messages[messages.length - 1];
            return last.type === 'post-card'
                ? `[帖子] ${safeText(last.postSnapshot?.text, '分享了一条帖子')}`
                : last.text;
        }

        function getDmUnreadCount(item) {
            const lastReadAt = Number(item?.lastReadAt) || 0;
            return normalizeDmMessages(item?.messages)
                .filter((message) => message.source === 'char' && message.createdAt > lastReadAt)
                .length;
        }

        function getDmLatestIncomingAt(item) {
            return normalizeDmMessages(item?.messages).reduce((latest, message) => (
                message.source === 'char' ? Math.max(latest, message.createdAt) : latest
            ), 0);
        }

        function formatDmTimestamp(value) {
            const date = new Date(Number(value));
            if (Number.isNaN(date.getTime())) return '';
            const now = new Date();
            const time = new Intl.DateTimeFormat('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).format(date);
            if (date.toDateString() === now.toDateString()) return time;
            if (date.getFullYear() === now.getFullYear()) {
                return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
            }
            return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
        }

        function updateMessageSummary(messages = []) {
            const summaryValues = document.querySelectorAll('#x-messages-tab .x-message-summary strong');
            const unreadCount = messages.reduce((total, item) => total + getDmUnreadCount(item), 0);
            if (summaryValues[0]) summaryValues[0].textContent = String(messages.length);
            if (summaryValues[1]) summaryValues[1].textContent = String(unreadCount);
            if (summaryValues[2]) summaryValues[2].textContent = '0';
            const messagesNavItem = navItems.find((item) => item.getAttribute('data-target') === 'x-messages-tab');
            if (messagesNavItem) {
                messagesNavItem.classList.toggle('has-unread', unreadCount > 0);
                messagesNavItem.setAttribute('aria-label', unreadCount > 0 ? `Messages，${unreadCount} 条未读` : 'Messages');
            }
        }

        function normalizeCharProfileImagePromptConfig(raw = {}) {
            const source = raw && typeof raw === 'object' ? raw : {};
            const presets = (Array.isArray(source.presets) ? source.presets : []).map((preset, index) => ({
                id: String(preset?.id || `x-char-image-preset-${index + 1}`),
                name: safeText(preset?.name, `预设 ${index + 1}`),
                prompt: safeText(preset?.prompt),
                charAppearance: safeText(preset?.charAppearance),
                userAppearance: safeText(preset?.userAppearance),
                artistPrompt: safeText(preset?.artistPrompt),
                negativePrompt: safeText(preset?.negativePrompt)
            }));
            const activePresetId = presets.some((preset) => preset.id === String(source.activePresetId || ''))
                ? String(source.activePresetId)
                : '';
            return {
                lastPrompt: safeText(source.lastPrompt),
                charAppearance: safeText(source.charAppearance),
                userAppearance: safeText(source.userAppearance),
                artistPrompt: safeText(source.artistPrompt),
                negativePrompt: safeText(source.negativePrompt),
                presets,
                activePresetId,
                autoUseReferenceFace: source.autoUseReferenceFace === true
            };
        }

        function getDefaultCharSocialCounts(source = {}) {
            const seed = `${source.id || ''}:${source.handle || source.name || ''}`;
            return {
                followersCount: 1200 + (hashPostMetricSeed(`followers:${seed}`) % 198800),
                followingCount: 80 + (hashPostMetricSeed(`following:${seed}`) % 1920)
            };
        }

        function normalizeDmChar(source = {}, origin = 'manual') {
            const name = safeText(source.nickname || source.name || source.realName, 'Char');
            const handleSource = source.handle || source.realName || source.signature || name;
            const id = String(source.id || makeLocalId(origin));
            const handle = makeHandle(name, handleSource);
            const avatar = normalizePersonAvatar(source.avatarUrl || source.avatar, `char:${id}:${handleSource}`);
            const profilePosts = (Array.isArray(source.profilePosts) ? source.profilePosts : [])
                .map((post, index) => normalizeGeneratedPost({ ...post, profileOwnerId: id, authorId: id }, index))
                .filter(Boolean);
            const socialCounts = getDefaultCharSocialCounts({ ...source, id, name, handle });
            return {
                id,
                origin,
                sourceFriendId: source.sourceFriendId || (origin === 'imessage' ? source.id : ''),
                name,
                handle,
                bio: safeText(source.bio || source.signature, '暂无签名'),
                persona: safeText(source.persona || source.characterPersona || source.systemPrompt),
                avatar: avatar,
                boundBooks: getCharacterBoundWorldBookIds(source),
                messages: normalizeDmMessages(source.messages),
                imessageContextMount: origin === 'imessage'
                    ? normalizeImessageContextMount(source.imessageContextMount)
                    : null,
                isFollowing: typeof source.isFollowing === 'boolean' ? source.isFollowing : origin !== 'generated',
                followingCount: normalizeProfileCount(source.followingCount ?? source.following, socialCounts.followingCount),
                followersCount: normalizeProfileCount(source.followersCount ?? source.followers, socialCounts.followersCount),
                coverSeed: safeText(source.coverSeed, `${id}-cover`),
                coverImage: safeText(source.coverImage),
                profileImagePromptConfig: normalizeCharProfileImagePromptConfig(source.profileImagePromptConfig),
                profileImageFaceReferenceAssetId: safeText(source.profileImageFaceReferenceAssetId),
                profileImageFaceReferenceUrl: safeText(source.profileImageFaceReferenceUrl),
                profileImageFaceReferenceFileName: safeText(source.profileImageFaceReferenceFileName),
                profilePosts,
                profileGeneratedAt: Number(source.profileGeneratedAt) || 0,
                addedAt: Number(source.addedAt) || Date.now(),
                lastReadAt: Number(source.lastReadAt) || 0
            };
        }

        function addDirectMessageChar(charItem) {
            const sourceItem = charItem?.origin === 'imessage'
                ? stripImessageCharMessagesForXImport(charItem)
                : charItem;
            const item = normalizeDmChar(sourceItem, sourceItem?.origin || 'manual');
            updateXState((draft) => {
                const existingIndex = draft.xDirectMessages.findIndex((entry) =>
                    String(entry.id) === String(item.id) || safeText(entry.name).toLowerCase() === item.name.toLowerCase()
                );
                if (existingIndex >= 0) {
                    const existing = normalizeDmChar(draft.xDirectMessages[existingIndex], draft.xDirectMessages[existingIndex].origin || item.origin);
                    const merged = {
                        ...existing,
                        ...item,
                        messages: item.messages.length ? item.messages : existing.messages,
                        imessageContextMount: existing.origin === 'imessage'
                            && String(existing.sourceFriendId || '') === String(item.sourceFriendId || '')
                            ? existing.imessageContextMount
                            : item.imessageContextMount,
                        addedAt: existing.addedAt || item.addedAt,
                        lastReadAt: Math.max(Number(existing.lastReadAt) || 0, Number(item.lastReadAt) || 0)
                    };
                    draft.xDirectMessages.splice(existingIndex, 1);
                    draft.xDirectMessages.unshift(merged);
                } else {
                    draft.xDirectMessages.unshift(item);
                }
            });
            renderDirectMessages();
            if (typeof window.showToast === 'function') window.showToast('已添加到 X 私信');
        }

        function renderDirectMessages(state = getXState()) {
            if (!dmList) dmList = document.getElementById('x-dm-list') || document.querySelector('#x-messages-tab .x-message-list');
            if (!dmList) return;
            const messages = (state.xDirectMessages || [])
                .map((item) => normalizeDmChar(item, item?.origin || 'manual'))
                .sort((a, b) => {
                    const aLast = a.messages[a.messages.length - 1]?.createdAt || a.addedAt || 0;
                    const bLast = b.messages[b.messages.length - 1]?.createdAt || b.addedAt || 0;
                    return bLast - aLast;
                });
            updateMessageSummary(messages);
            if (messages.length === 0) {
                dmList.innerHTML = `
                    <div class="x-empty-state x-dm-empty-state">
                        <strong>暂无私信</strong>
                        <span>添加一个 Char 开始聊天吧</span>
                        <button class="x-add-dm-submit x-empty-add-dm-btn" type="button">添加 Char</button>
                    </div>
                `;
                return;
            }
            dmList.innerHTML = messages.map((item) => {
                const unreadCount = getDmUnreadCount(item);
                return `
                <button class="x-message-row x-dm-row ${unreadCount > 0 ? 'has-unread' : ''}" type="button" data-dm-id="${escapeHtml(item.id)}">
                    <div class="x-avatar">${buildAvatarHtml(item.avatar, item.name)}</div>
                    <div>
                        <strong>${escapeHtml(item.name)}</strong>
                        <p>${escapeHtml(getDmLastMessageText(item))}</p>
                    </div>
                    <span class="x-dm-row-side">
                        <span>${escapeHtml(item.origin === 'imessage' ? 'iMessage' : 'X')}</span>
                        ${unreadCount > 0 ? `<i class="x-dm-unread-dot" aria-label="${unreadCount} 条未读"></i>` : ''}
                    </span>
                </button>
            `;
            }).join('');
        }

        function renderVisitors() {
            if (!visitorsList) visitorsList = document.getElementById('x-visitors-list');
            if (!visitorsList) return;
            const visitors = getXState().xVisitors || [];
            if (visitors.length === 0) {
                visitorsList.innerHTML = '<div class="x-empty-state">暂无主页访客</div>';
                return;
            }
            visitorsList.innerHTML = visitors.map((item) => `
                <div class="x-message-row">
                    <div class="x-avatar">${buildAvatarHtml(item.avatar, item.name)}</div>
                    <div>
                        <strong>${escapeHtml(item.name || 'Visitor')}</strong>
                        <p>${escapeHtml(item.bio || '最近访问了你的主页')}</p>
                    </div>
                    <span>${escapeHtml(item.time || 'now')}</span>
                </div>
            `).join('');
        }

        async function hydrateImessageCharAvatar(friend) {
            if (!friend || typeof friend !== 'object') return friend;
            if (friend.avatarUrl || friend.avatar || !friend.avatarAssetId) return friend;
            if (!window.appStorage || typeof window.appStorage.getAssetUrl !== 'function') return friend;
            try {
                const avatarUrl = await window.appStorage.getAssetUrl(friend.avatarAssetId);
                return avatarUrl ? { ...friend, avatarUrl } : friend;
            } catch (error) {
                console.warn('[X] Failed to hydrate iMessage char avatar', error);
                return friend;
            }
        }

        async function loadImessageChars() {
            const runtimeFriends = Array.isArray(window.imData?.friends) ? window.imData.friends : [];
            if (runtimeFriends.length > 0) {
                return Promise.all(runtimeFriends
                    .filter((friend) => friend?.type === 'char')
                    .map((friend) => hydrateImessageCharAvatar(friend)));
            }
            if (window.imStorage && typeof window.imStorage.loadFriends === 'function') {
                try {
                    const friends = await window.imStorage.loadFriends();
                    return Array.isArray(friends)
                        ? Promise.all(friends
                            .filter((friend) => friend?.type === 'char')
                            .map((friend) => hydrateImessageCharAvatar(friend)))
                        : [];
                } catch (error) {
                    console.warn('[X] Failed to load iMessage chars', error);
                }
            }
            return [];
        }

        async function renderImessageCharPicker() {
            if (!imessageCharList) imessageCharList = document.getElementById('x-imessage-char-list');
            if (!imessageCharList) return;
            imessageCharList.innerHTML = '<div class="x-empty-state">加载 iMessage Char...</div>';
            const chars = await loadImessageChars();
            if (chars.length === 0) {
                imessageCharList.innerHTML = '<div class="x-empty-state">未找到 iMessage Char</div>';
                return;
            }
            imessageCharList.innerHTML = chars.map((friend) => {
                const item = normalizeDmChar(stripImessageCharMessagesForXImport(friend), 'imessage');
                return `
                    <button class="x-char-pick-row" type="button" data-char-id="${escapeHtml(item.id)}">
                        <div class="x-avatar">${buildAvatarHtml(item.avatar, item.name)}</div>
                        <div>
                            <strong>${escapeHtml(item.name)}</strong>
                            <span>${escapeHtml(item.bio)}</span>
                        </div>
                        <i class="fas fa-plus"></i>
                    </button>
                `;
            }).join('');
            imessageCharList.querySelectorAll('.x-char-pick-row').forEach((button) => {
                button.addEventListener('click', () => {
                    const friend = chars.find((item) => String(item.id) === String(button.dataset.charId));
                    if (friend) addDirectMessageChar({ ...friend, origin: 'imessage' });
                });
            });
        }

        function openVisitorsSheet() {
            renderVisitors();
            if (typeof window.openView === 'function') window.openView(visitorsSheet);
            else visitorsSheet?.classList.add('active');
        }

        function closeVisitorsSheet() {
            if (typeof window.closeView === 'function') window.closeView(visitorsSheet);
            else visitorsSheet?.classList.remove('active');
        }

        function openAddDmSheet() {
            if (manualCharNameInput) manualCharNameInput.value = '';
            if (manualCharHandleInput) manualCharHandleInput.value = '';
            if (manualCharBioInput) manualCharBioInput.value = '';
            if (manualCharPersonaInput) manualCharPersonaInput.value = '';
            if (typeof window.openView === 'function') window.openView(addDmSheet);
            else addDmSheet?.classList.add('active');
            renderImessageCharPicker();
        }

        function closeAddDmSheet() {
            if (typeof window.closeView === 'function') window.closeView(addDmSheet);
            else addDmSheet?.classList.remove('active');
        }

        function addManualChar() {
            const name = safeText(manualCharNameInput?.value);
            if (!name) {
                if (typeof window.showToast === 'function') window.showToast('请输入 Char 名称');
                return;
            }
            addDirectMessageChar({
                id: makeLocalId('x-char'),
                origin: 'manual',
                name,
                handle: manualCharHandleInput?.value,
                bio: manualCharBioInput?.value,
                persona: manualCharPersonaInput?.value
            });
            closeAddDmSheet();
        }

        function getDirectMessageById(dmId) {
            const item = (getXState().xDirectMessages || []).find((entry) => String(entry.id) === String(dmId));
            return item ? normalizeDmChar(item, item.origin || 'manual') : null;
        }

        function releaseFocusBeforeHide(container, fallbackSelector = '') {
            if (!container || !container.contains(document.activeElement)) return;
            const focused = document.activeElement;
            if (focused && typeof focused.blur === 'function') focused.blur();
            requestAnimationFrame(() => {
                if (!fallbackSelector) return;
                const fallback = view.querySelector(fallbackSelector);
                if (fallback && typeof fallback.focus === 'function') fallback.focus({ preventScroll: true });
            });
        }

        function renderDmProfileIntro(item) {
            return `
                <section class="x-dm-profile-intro">
                    <div class="x-avatar">${buildAvatarHtml(item.avatar, item.name)}</div>
                    <div>
                        <strong>${escapeHtml(item.name)}</strong>
                        <span>${escapeHtml(item.handle || '@char')}</span>
                        <p>${escapeHtml(item.bio || '暂无签名')}</p>
                    </div>
                    <button class="x-dm-profile-home-btn" type="button" data-dm-profile-id="${escapeHtml(item.id)}">主页</button>
                </section>
            `;
        }

        function getIdentityProfilePosts(identity, state = getXState()) {
            const posts = [];
            if (identity.kind === 'char') {
                const item = getDirectMessageById(identity.id);
                posts.push(...(item?.profilePosts || []));
            }
            posts.push(...(state.xGeneratedPosts || []).filter((post) => {
                if (post.authorId && String(post.authorId) === String(identity.id)) return true;
                return canonicalAccountHandle(post.handle || post.authorHandle, post.name || post.authorName) === canonicalAccountHandle(identity.handle, identity.name);
            }));
            const seen = new Set();
            return posts.map((post, index) => normalizeGeneratedPost(post, index)).filter((post) => {
                if (!post || seen.has(post.id)) return false;
                seen.add(post.id);
                postData[post.id] = ensureCommentDepth(post);
                return true;
            });
        }

        function buildProfilePostsHtml(posts) {
            if (!posts.length) return '<div class="x-empty-state">暂无帖子</div>';
            return posts.map((post) => `
                <article class="x-feed-card x-generated-feed-card x-profile-feed-card" data-post-id="${escapeHtml(post.id)}" tabindex="0">
                    ${buildFeedCardHtml(post)}
                </article>
            `).join('');
        }

        function buildProfilePhotosHtml(posts) {
            const images = posts.flatMap((post) => getPostImages(post).map((image) => ({ ...image, postId: post.id })));
            if (!images.length) return '<div class="x-empty-state">暂无照片</div>';
            return `<div class="x-super-post-grid x-profile-photo-grid">${images.map((image) => `
                <button class="x-post-image-thumb" type="button" data-image-text="${escapeHtml(image.text || 'Image')}" data-image-url="${escapeHtml(image.url || '')}" data-post-id="${escapeHtml(image.postId)}">
                    <img src="${escapeHtml(image.url)}" alt="" onerror="this.remove()">
                </button>
            `).join('')}</div>`;
        }

        function renderIdentityProfile(identity, charItem = null) {
            const body = document.getElementById('x-dm-profile-body');
            if (!identity || !body || !dmProfileView) return;
            const isChar = identity.kind === 'char' && !!charItem;
            const isTopicChar = identity.kind === 'topic-char';
            const posts = getIdentityProfilePosts(identity);
            const socialSeed = `${identity.id || ''}:${identity.handle || identity.name || ''}`;
            const fallbackSocialCounts = getDefaultCharSocialCounts({ id: identity.id, handle: identity.handle, name: identity.name });
            const followersCount = isChar
                ? normalizeProfileCount(charItem.followersCount, fallbackSocialCounts.followersCount)
                : 1200 + (hashPostMetricSeed(`followers:${socialSeed}`) % 198800);
            const followingCount = isChar
                ? normalizeProfileCount(charItem.followingCount, fallbackSocialCounts.followingCount)
                : 80 + (hashPostMetricSeed(`following:${socialSeed}`) % 1920);
            const coverSeed = safeText(charItem?.coverSeed || identity.coverSeed, `${identity.id}-cover`);
            const coverUrl = safeText(charItem?.coverImage || identity.coverImage) || getStableExternalImage(coverSeed, 1200, 480);
            const fallbackCover = safeText(currentProfile.banner);
            const fallbackCoverStyle = fallbackCover ? `,url('${escapeHtml(fallbackCover)}')` : '';
            const following = isChar ? charItem.isFollowing !== false : identity.isFollowing !== false;
            currentProfileIdentity = { ...identity, kind: isChar ? 'char' : (isTopicChar ? 'topic-char' : 'account') };
            const actionsHtml = isTopicChar ? '' : `
                <button class="x-profile-follow-btn ${following ? 'active' : ''}" type="button" data-profile-follow-id="${escapeHtml(identity.id)}">${following ? '已关注' : '关注'}</button>
                ${isChar ? `<button class="x-profile-edit" type="button" data-profile-edit-id="${escapeHtml(identity.id)}">Edit</button>` : ''}
            `;
            const profileContentHtml = buildUnifiedProfileContentHtml({
                identity,
                posts,
                actionsHtml,
                stats: [
                    { value: posts.length, label: 'Posts' },
                    { value: formatCompactCount(followersCount), label: 'Followers' },
                    { value: formatCompactCount(followingCount), label: 'Following' }
                ]
            });

            body.innerHTML = `
                <div class="x-dm-profile-page-scroll">
                    <div class="x-profile-cover x-dm-profile-cover" style="background-image:linear-gradient(180deg,rgba(0,0,0,.04),rgba(0,0,0,.35))${fallbackCoverStyle}">
                        <img class="x-dm-profile-cover-image" src="${escapeHtml(coverUrl)}" alt="" onerror="this.remove()">
                        <div class="x-profile-cover-actions">
                            <button class="x-header-button" id="x-dm-profile-back" type="button" aria-label="返回"><i class="fas fa-chevron-left"></i></button>
                            ${isChar ? '<button class="x-header-button" id="x-char-profile-generate-btn" type="button" aria-label="生成 Char 主页内容"><i class="fas fa-search"></i></button>' : '<span></span>'}
                        </div>
                    </div>
                    <div class="x-profile-scroll x-dm-profile-scroll">
                        ${profileContentHtml}
                    </div>
                </div>
            `;
            body.querySelectorAll('.x-profile-feed-card').forEach(bindPostCard);
            dmProfileView.classList.add('active');
            dmProfileView.setAttribute('aria-hidden', 'false');
        }

        function openDmProfile(dmId = currentDmId) {
            const item = dmId ? getDirectMessageById(dmId) : null;
            if (!item) return;
            renderIdentityProfile({
                id: item.id,
                name: item.name,
                handle: item.handle,
                avatar: item.avatar,
                bio: item.bio,
                persona: item.persona,
                coverSeed: item.coverSeed,
                coverImage: item.coverImage,
                isFollowing: item.isFollowing,
                kind: 'char'
            }, item);
        }

        function openAuthorProfile(authorId, name, handle, avatar) {
            const identity = resolveXAuthorIdentity(authorId, handle, name, avatar);
            if (identity.kind === 'me') {
                const meIndex = navItems.findIndex((item) => item.getAttribute('data-target') === 'x-me-tab');
                if (meIndex >= 0) switchTab(meIndex);
                return;
            }
            if (identity.kind === 'char') {
                openDmProfile(identity.id);
                return;
            }
            if (identity.kind === 'topic-char') {
                renderIdentityProfile(identity);
                return;
            }
            const account = identity.kind === 'account' ? identity : registerLightweightAccount(identity);
            renderIdentityProfile({ ...account, kind: 'account' });
        }

        function closeDmProfile() {
            releaseFocusBeforeHide(dmProfileView);
            currentProfileIdentity = null;
            dmProfileView?.classList.remove('active');
            dmProfileView?.setAttribute('aria-hidden', 'true');
        }

        function toggleProfileFollow(profileId) {
            const item = getDirectMessageById(profileId);
            if (item) {
                const updated = updateDirectMessage(profileId, (draft) => {
                    draft.isFollowing = draft.isFollowing === false;
                    return draft;
                });
                if (updated) openDmProfile(profileId);
                return;
            }
            let updatedAccount = null;
            updateXState((draft) => {
                draft.xAccounts = (draft.xAccounts || []).map((account) => {
                    if (String(account.id) !== String(profileId)) return account;
                    updatedAccount = { ...account, isFollowing: account.isFollowing === false };
                    return updatedAccount;
                });
            });
            if (updatedAccount) renderIdentityProfile({ ...normalizeXAccount(updatedAccount), kind: 'account' });
        }

        function openCharEditSheet(charId) {
            const item = getDirectMessageById(charId);
            if (!item || !charEditSheet) return;
            currentEditingCharId = String(item.id);
            charEditAvatarDraft = item.avatar || '';
            charEditCoverSeed = item.coverSeed || `${item.id}-cover`;
            charEditCoverImageDraft = item.coverImage || '';
            const nameInput = document.getElementById('x-char-edit-name');
            const handleInput = document.getElementById('x-char-edit-handle');
            const bioInput = document.getElementById('x-char-edit-bio');
            const personaInput = document.getElementById('x-char-edit-persona');
            const followingInput = document.getElementById('x-char-edit-following');
            const followersInput = document.getElementById('x-char-edit-followers');
            if (nameInput) nameInput.value = item.name;
            if (handleInput) handleInput.value = item.handle;
            if (bioInput) bioInput.value = item.bio;
            if (personaInput) personaInput.value = item.persona;
            if (followingInput) followingInput.value = String(item.followingCount);
            if (followersInput) followersInput.value = String(item.followersCount);
            renderImagePreview(document.getElementById('x-char-edit-avatar-preview'), charEditAvatarDraft, item.name.slice(0, 1).toUpperCase());
            renderImagePreview(
                document.getElementById('x-char-edit-cover-preview'),
                charEditCoverImageDraft || getStableExternalImage(charEditCoverSeed, 600, 240),
                'Cover'
            );
            if (typeof window.openView === 'function') window.openView(charEditSheet);
            else charEditSheet.classList.add('active');
        }

        function closeCharEditSheet() {
            currentEditingCharId = null;
            charEditCoverImageDraft = '';
            if (typeof window.closeView === 'function') window.closeView(charEditSheet);
            else charEditSheet?.classList.remove('active');
        }

        function saveCharEdit() {
            if (!currentEditingCharId) return;
            const previous = getDirectMessageById(currentEditingCharId);
            const name = safeText(document.getElementById('x-char-edit-name')?.value, 'Char');
            const followingRaw = String(document.getElementById('x-char-edit-following')?.value ?? '').trim();
            const followersRaw = String(document.getElementById('x-char-edit-followers')?.value ?? '').trim();
            if ((followingRaw && (!/^\d+$/.test(followingRaw) || Number(followingRaw) > Number.MAX_SAFE_INTEGER))
                || (followersRaw && (!/^\d+$/.test(followersRaw) || Number(followersRaw) > Number.MAX_SAFE_INTEGER))) {
                if (typeof window.showToast === 'function') window.showToast('关注数和粉丝数请输入非负整数');
                return;
            }
            const updated = updateDirectMessage(currentEditingCharId, (draft) => {
                draft.name = name;
                draft.handle = makeHandle(name, document.getElementById('x-char-edit-handle')?.value);
                draft.bio = safeText(document.getElementById('x-char-edit-bio')?.value, '暂无签名');
                draft.persona = safeText(document.getElementById('x-char-edit-persona')?.value);
                draft.avatar = charEditAvatarDraft;
                draft.coverSeed = charEditCoverSeed;
                draft.coverImage = charEditCoverImageDraft;
                draft.followingCount = normalizeProfileCount(followingRaw, previous?.followingCount || 0);
                draft.followersCount = normalizeProfileCount(followersRaw, previous?.followersCount || 0);
                return draft;
            });
            const id = currentEditingCharId;
            if (updated) syncCharPostIdentity(updated, previous);
            closeCharEditSheet();
            renderDirectMessages();
            renderDmChat();
            renderGeneratedPosts();
            renderSuperFollowBar();
            if (updated) openDmProfile(id);
        }

        function refreshCharEditCover() {
            if (!currentEditingCharId) return;
            charEditCoverSeed = `${currentEditingCharId}-cover-${Date.now()}`;
            charEditCoverImageDraft = '';
            renderImagePreview(
                document.getElementById('x-char-edit-cover-preview'),
                getStableExternalImage(charEditCoverSeed, 600, 240),
                'Cover'
            );
            if (typeof window.showToast === 'function') window.showToast('已更换主页背景');
        }

        function getCharProfilePromptFieldValues() {
            return {
                lastPrompt: safeText(document.getElementById('x-char-profile-image-prompt')?.value),
                charAppearance: safeText(document.getElementById('x-char-profile-char-appearance')?.value),
                userAppearance: safeText(document.getElementById('x-char-profile-user-appearance')?.value),
                artistPrompt: safeText(document.getElementById('x-char-profile-artist-prompt')?.value),
                negativePrompt: safeText(document.getElementById('x-char-profile-negative-prompt')?.value)
            };
        }

        function setCharProfilePromptFieldValues(config = {}) {
            const normalized = normalizeCharProfileImagePromptConfig(config);
            const values = {
                'x-char-profile-image-prompt': normalized.lastPrompt,
                'x-char-profile-char-appearance': normalized.charAppearance,
                'x-char-profile-user-appearance': normalized.userAppearance,
                'x-char-profile-artist-prompt': normalized.artistPrompt,
                'x-char-profile-negative-prompt': normalized.negativePrompt
            };
            Object.entries(values).forEach(([id, value]) => {
                const field = document.getElementById(id);
                if (field) field.value = value;
            });
        }

        function renderCharProfilePresetOptions(activePresetId = '') {
            const select = document.getElementById('x-char-profile-image-preset');
            if (!select) return;
            select.innerHTML = '<option value="">当前编辑内容</option>' + charProfilePresetDrafts.map((preset) => (
                `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}</option>`
            )).join('');
            select.value = charProfilePresetDrafts.some((preset) => preset.id === activePresetId) ? activePresetId : '';
        }

        function syncCharProfileImageOptions() {
            const enabled = document.getElementById('x-char-profile-image-toggle')?.checked === true;
            const options = document.getElementById('x-char-profile-image-options');
            if (options) options.hidden = !enabled;
        }

        function renderCharProfileReferenceDraft() {
            const preview = document.getElementById('x-char-profile-reference-preview');
            const status = document.getElementById('x-char-profile-reference-status');
            const removeButton = document.getElementById('x-char-profile-reference-delete');
            const toggle = document.getElementById('x-char-profile-reference-toggle');
            if (preview) {
                preview.innerHTML = charProfileReferenceDraft
                    ? `<img src="${escapeHtml(charProfileReferenceDraft)}" alt="">`
                    : '<i class="fas fa-user"></i>';
            }
            if (status) status.textContent = charProfileReferenceDraft
                ? (charProfileReferenceFileNameDraft || '已上传')
                : '尚未上传';
            if (removeButton) removeButton.hidden = !charProfileReferenceDraft;
            if (toggle) {
                toggle.disabled = !charProfileReferenceDraft;
                if (!charProfileReferenceDraft) toggle.checked = false;
            }
        }

        async function resolveCharProfileReferenceUrl(item) {
            if (item?.profileImageFaceReferenceUrl) return item.profileImageFaceReferenceUrl;
            if (item?.profileImageFaceReferenceAssetId && typeof window.appStorage?.getAssetUrl === 'function') {
                return window.appStorage.getAssetUrl(item.profileImageFaceReferenceAssetId).catch(() => '');
            }
            return '';
        }

        async function openCharProfileGenerateSheet(charId) {
            const item = getDirectMessageById(charId);
            if (!item || !charProfileGenerateSheet || charProfileGenerationInFlight) return;
            currentGeneratingCharId = String(item.id);
            const config = normalizeCharProfileImagePromptConfig(item.profileImagePromptConfig);
            charProfilePresetDrafts = config.presets.map((preset) => ({ ...preset }));
            const countInput = document.getElementById('x-char-profile-generate-count');
            const imageToggle = document.getElementById('x-char-profile-image-toggle');
            const referenceToggle = document.getElementById('x-char-profile-reference-toggle');
            const presetNameInput = document.getElementById('x-char-profile-preset-name');
            if (countInput) countInput.value = '3';
            if (imageToggle) imageToggle.checked = false;
            if (presetNameInput) presetNameInput.value = '';
            setCharProfilePromptFieldValues(config);
            renderCharProfilePresetOptions(config.activePresetId);
            charProfileReferenceDraft = await resolveCharProfileReferenceUrl(item);
            charProfileReferenceFileNameDraft = item.profileImageFaceReferenceFileName || '';
            charProfileReferenceChanged = false;
            if (referenceToggle) referenceToggle.checked = !!charProfileReferenceDraft && config.autoUseReferenceFace;
            renderCharProfileReferenceDraft();
            syncCharProfileImageOptions();
            if (typeof window.openView === 'function') window.openView(charProfileGenerateSheet);
            else charProfileGenerateSheet.classList.add('active');
        }

        function closeCharProfileGenerateSheet() {
            if (charProfileGenerationInFlight) return;
            currentGeneratingCharId = null;
            charProfileReferenceDraft = '';
            charProfileReferenceFileNameDraft = '';
            charProfileReferenceChanged = false;
            charProfilePresetDrafts = [];
            const referenceInput = document.getElementById('x-char-profile-reference-input');
            if (referenceInput) referenceInput.value = '';
            if (typeof window.closeView === 'function') window.closeView(charProfileGenerateSheet);
            else charProfileGenerateSheet?.classList.remove('active');
        }

        function saveCharProfilePromptPreset() {
            const nameInput = document.getElementById('x-char-profile-preset-name');
            const name = safeText(nameInput?.value);
            if (!name) {
                if (typeof window.showToast === 'function') window.showToast('请输入预设名称');
                nameInput?.focus();
                return;
            }
            const selectedId = String(document.getElementById('x-char-profile-image-preset')?.value || '');
            const values = getCharProfilePromptFieldValues();
            const preset = {
                id: selectedId || makeLocalId('x-char-image-preset'),
                name,
                prompt: values.lastPrompt,
                charAppearance: values.charAppearance,
                userAppearance: values.userAppearance,
                artistPrompt: values.artistPrompt,
                negativePrompt: values.negativePrompt
            };
            const existingIndex = charProfilePresetDrafts.findIndex((item) => item.id === preset.id);
            if (existingIndex >= 0) charProfilePresetDrafts[existingIndex] = preset;
            else charProfilePresetDrafts.push(preset);
            renderCharProfilePresetOptions(preset.id);
            if (nameInput) nameInput.value = preset.name;
        }

        function deleteCharProfilePromptPreset() {
            const select = document.getElementById('x-char-profile-image-preset');
            const id = String(select?.value || '');
            if (!id) return;
            charProfilePresetDrafts = charProfilePresetDrafts.filter((preset) => preset.id !== id);
            renderCharProfilePresetOptions('');
            const nameInput = document.getElementById('x-char-profile-preset-name');
            if (nameInput) nameInput.value = '';
        }

        function applyCharProfilePromptPreset(presetId) {
            const preset = charProfilePresetDrafts.find((item) => item.id === String(presetId || ''));
            const nameInput = document.getElementById('x-char-profile-preset-name');
            if (!preset) {
                if (nameInput) nameInput.value = '';
                return;
            }
            setCharProfilePromptFieldValues({
                lastPrompt: preset.prompt,
                charAppearance: preset.charAppearance,
                userAppearance: preset.userAppearance,
                artistPrompt: preset.artistPrompt,
                negativePrompt: preset.negativePrompt
            });
            if (nameInput) nameInput.value = preset.name;
        }

        async function loadCharProfileReferenceFile() {
            const input = document.getElementById('x-char-profile-reference-input');
            const file = input?.files?.[0];
            if (!file) return;
            input.disabled = true;
            try {
                charProfileReferenceDraft = await compressXImageFile(file, { maxWidth: 1536, maxHeight: 1536, quality: 0.9 });
                charProfileReferenceFileNameDraft = file.name || 'reference.jpg';
                charProfileReferenceChanged = true;
                const toggle = document.getElementById('x-char-profile-reference-toggle');
                if (toggle) toggle.checked = true;
                renderCharProfileReferenceDraft();
            } catch (error) {
                if (typeof window.showToast === 'function') window.showToast(error?.message || '参考脸读取失败');
            } finally {
                input.disabled = false;
                input.value = '';
            }
        }

        function removeCharProfileReferenceDraft() {
            charProfileReferenceDraft = '';
            charProfileReferenceFileNameDraft = '';
            charProfileReferenceChanged = true;
            renderCharProfileReferenceDraft();
        }

        function normalizeCharProfilePosts(rawPosts, item) {
            return (Array.isArray(rawPosts) ? rawPosts : []).map((rawPost, index) => {
                const charAvatar = normalizePersonAvatar(item.avatar, `char:${item.id}:${item.handle || item.name}`);
                const imageCandidatePrompt = safeText(
                    rawPost.imagePrompt || rawPost.imageText || rawPost.mediaDescription
                    || (Array.isArray(rawPost.images) ? rawPost.images[0]?.text || rawPost.images[0]?.prompt : '')
                );
                const post = normalizeGeneratedPost({
                    ...rawPost,
                    mediaType: 'text',
                    imagePrompt: '',
                    imageText: '',
                    images: [],
                    authorId: item.id,
                    authorName: item.name,
                    handle: item.handle,
                    authorAvatar: charAvatar,
                    profileOwnerId: item.id
                }, index);
                if (!post || post.commentList.length < 10) return null;
                post.avatar = charAvatar;
                post.images = [];
                post.imageCandidate = rawPost.imageCandidate === true || safeText(rawPost.imageCandidate).toLowerCase() === 'true';
                post.imageCandidatePrompt = imageCandidatePrompt;
                return ensureCommentDepth(post);
            }).filter(Boolean);
        }

        async function requestCharProfilePostBatch(item, count, excludedTexts = [], allowImageCandidate = false) {
            const recentChat = normalizeDmMessages(item.messages).slice(-12).map(serializeDmMessageForAi).join('\n');
            const worldbook = getSelectedWorldBookContext(
                `${item.name} ${item.bio} ${item.persona} ${currentProfile.persona}`,
                getCharacterBoundWorldBookIds(item)
            );
            const prompt = `Return strict JSON only: {"posts":[{"authorName":"","handle":"","text":"","translation":"","likes":0,"reposts":0,"commentsCount":10,"imageCandidate":false,"imagePrompt":"","comments":[{"authorName":"","handle":"","text":"","translation":"","replies":[{"authorName":"","handle":"","text":"","translation":""}]}]}]}.
Generate exactly ${count} new text-first X profile posts written by this Char. Every post MUST contain at least 10 distinct top-level comment objects in comments. Replies do not count toward the 10-comment minimum. Posts must feel like the Char's own public life and remain consistent with their persona, recent private conversation, User relationship and worldbook.
${allowImageCandidate ? 'Mark exactly one visually suitable post with imageCandidate:true and provide a detailed Simplified Chinese imagePrompt that directly matches that post. All other posts use imageCandidate:false and imagePrompt:"".' : 'Every post must use imageCandidate:false and imagePrompt:"". Do not create any image entry.'}
Only the named Char may author the posts. All generated commenters and repliers must be non-User accounts; never write a comment or reply as the current User.
The Char and commenters may use any language natural to their identity and context. Every post, comment and reply must include translation: Simplified Chinese for non-Chinese originals, or "" for Chinese originals. Never return an image URL or external image.
Char: ${JSON.stringify({ id: item.id, name: item.name, handle: item.handle, bio: item.bio, persona: item.persona })}
User: ${JSON.stringify({ name: currentProfile.name, handle: currentProfile.handle, bio: currentProfile.bio, persona: currentProfile.persona })}
Recent private chat: ${recentChat || 'None'}
Do not repeat these post texts: ${excludedTexts.length ? excludedTexts.join(' | ') : 'None'}
Worldbook:
${worldbook || 'None'}`;
            const raw = await requestXChatCompletion([
                { role: 'system', content: 'Generate strict JSON for a fictional X character profile. Output JSON only.' },
                { role: 'user', content: prompt }
            ], { temperature: 0.9 });
            const parsed = parseJsonPayload(raw);
            const posts = sanitizeApiGeneratedPosts(
                Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.posts) ? parsed.posts : []),
                { forceOuterAuthor: true }
            );
            return normalizeCharProfilePosts(posts, item);
        }

        async function persistCharProfileReference(item, promptConfig) {
            const previousAssetId = safeText(item.profileImageFaceReferenceAssetId);
            let nextAssetId = previousAssetId;
            let nextReferenceUrl = item.profileImageFaceReferenceUrl || '';
            if (charProfileReferenceChanged) {
                if (charProfileReferenceDraft) {
                    if (!window.appStorage?.saveAssetFromDataUrl) throw new Error('图片存储服务不可用');
                    const accountId = safeText(getXState().activeXPlayerAccountId, 'legacy').replace(/[^a-z0-9_-]+/gi, '-');
                    const charId = String(item.id).replace(/[^a-z0-9_-]+/gi, '-');
                    nextAssetId = `x_account_${accountId}_char_${charId}_profile_face`;
                    await window.appStorage.saveAssetFromDataUrl(nextAssetId, charProfileReferenceDraft, {
                        ownerType: 'x_char_profile_face',
                        ownerId: String(item.id),
                        accountId,
                        fileName: charProfileReferenceFileNameDraft
                    });
                    nextReferenceUrl = '';
                } else {
                    nextAssetId = '';
                    nextReferenceUrl = '';
                }
            }
            const updated = updateDirectMessage(item.id, (draft) => {
                draft.profileImagePromptConfig = promptConfig;
                draft.profileImageFaceReferenceAssetId = nextAssetId;
                draft.profileImageFaceReferenceUrl = nextReferenceUrl;
                draft.profileImageFaceReferenceFileName = charProfileReferenceDraft ? charProfileReferenceFileNameDraft : '';
                return draft;
            });
            if (!updated) throw new Error('Char 生图配置保存失败');
            if (previousAssetId && previousAssetId !== nextAssetId) {
                await window.appStorage?.deleteAsset?.(previousAssetId).catch(() => undefined);
            }
            return updated;
        }

        async function generateCurrentCharProfile() {
            if (charProfileGenerationInFlight || !currentGeneratingCharId) return;
            const item = getDirectMessageById(currentGeneratingCharId);
            const button = document.getElementById('x-char-profile-generate-run-btn');
            const countInput = document.getElementById('x-char-profile-generate-count');
            if (!item || !button) return;
            const requestedCount = Math.min(10, Math.max(1, Number.parseInt(countInput?.value, 10) || 3));
            if (countInput) countInput.value = String(requestedCount);
            const imageEnabled = document.getElementById('x-char-profile-image-toggle')?.checked === true;
            const selectedPresetId = String(document.getElementById('x-char-profile-image-preset')?.value || '');
            const promptFields = getCharProfilePromptFieldValues();
            const promptConfig = normalizeCharProfileImagePromptConfig({
                ...promptFields,
                presets: charProfilePresetDrafts,
                activePresetId: selectedPresetId,
                autoUseReferenceFace: imageEnabled
                    && document.getElementById('x-char-profile-reference-toggle')?.checked === true
            });
            charProfileGenerationInFlight = true;
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中';
            let completed = false;
            try {
                const collected = [];
                const existingTexts = (item.profilePosts || []).map((post) => safeText(post.text)).filter(Boolean);
                const seen = new Set(existingTexts.map((text) => text.toLocaleLowerCase()));
                const addPosts = (posts) => posts.forEach((post) => {
                    const key = post.text.toLocaleLowerCase();
                    if (collected.length < requestedCount && !seen.has(key)) {
                        seen.add(key);
                        collected.push(post);
                    }
                });
                const maxAttempts = Math.ceil(requestedCount / 3) + 3;
                let attempt = 0;
                while (collected.length < requestedCount && attempt < maxAttempts) {
                    const batchCount = Math.min(3, requestedCount - collected.length);
                    addPosts(await requestCharProfilePostBatch(
                        item,
                        batchCount,
                        [...existingTexts, ...collected.map((post) => post.text)],
                        imageEnabled && attempt === 0
                    ));
                    attempt += 1;
                }
                if (collected.length !== requestedCount || collected.some((post) => post.commentList.length < 10)) {
                    throw new Error('Insufficient Char profile content');
                }

                let generatedImage = null;
                let imageError = null;
                if (imageEnabled) {
                    const targetPost = collected.find((post) => post.imageCandidate) || collected[0];
                    const postPrompt = safeText(targetPost.imageCandidatePrompt, targetPost.text);
                    const finalPrompt = [postPrompt, promptConfig.lastPrompt].filter(Boolean).join('\n');
                    try {
                        if (!window.u2ImageGeneration?.generate) throw new Error('生图功能尚未加载，请刷新后重试');
                        generatedImage = await window.u2ImageGeneration.generate(finalPrompt, {
                            referenceImage: promptConfig.autoUseReferenceFace ? charProfileReferenceDraft : '',
                            charAppearance: promptConfig.charAppearance,
                            userAppearance: promptConfig.userAppearance,
                            artistPrompt: promptConfig.artistPrompt,
                            negativePrompt: promptConfig.negativePrompt
                        });
                        targetPost.images = [{
                            id: `${targetPost.id}-image-0`,
                            text: postPrompt,
                            url: generatedImage.imageUrl,
                            imageSource: 'generated',
                            imageProvider: generatedImage.provider || '',
                            imageModel: generatedImage.model || '',
                            imageSize: generatedImage.size || '',
                            faceReferenceUsed: !!generatedImage.faceReferenceUsed
                        }];
                    } catch (error) {
                        imageError = error;
                        console.warn('[X] Char profile image generation failed', error);
                    }
                }

                collected.forEach((post) => {
                    delete post.imageCandidate;
                    delete post.imageCandidatePrompt;
                });
                const latestItem = await persistCharProfileReference(item, promptConfig);
                updateXState((draft) => {
                    draft.xGeneratedPosts = prependUniquePosts(draft.xGeneratedPosts || [], collected);
                    draft.xDirectMessages = (draft.xDirectMessages || []).map((entry) => {
                        if (String(entry.id) !== String(item.id)) return entry;
                        const normalized = normalizeDmChar(entry, entry.origin || 'manual');
                        return {
                            ...normalized,
                            profileImagePromptConfig: latestItem.profileImagePromptConfig,
                            profileImageFaceReferenceAssetId: latestItem.profileImageFaceReferenceAssetId,
                            profileImageFaceReferenceUrl: latestItem.profileImageFaceReferenceUrl,
                            profileImageFaceReferenceFileName: latestItem.profileImageFaceReferenceFileName,
                            profilePosts: prependUniquePosts(normalized.profilePosts || [], collected),
                            profileGeneratedAt: Date.now()
                        };
                    });
                });
                await flushXStateNow('x-char-profile-generation');
                renderGeneratedPosts(getXState(), { force: true });
                openDmProfile(item.id);
                completed = true;
                if (typeof window.showToast === 'function') {
                    window.showToast(imageError
                        ? `已生成 ${collected.length} 条帖子；${imageError?.message || '生图失败，已保留文字帖'}`
                        : `已生成 ${collected.length} 条帖子${generatedImage ? '和 1 张图片' : ''}`);
                }
            } catch (error) {
                console.error('[X] Generate Char profile failed', error);
                if (typeof window.showToast === 'function') window.showToast('主页生成失败，未修改现有内容');
            } finally {
                charProfileGenerationInFlight = false;
                const nextButton = document.getElementById('x-char-profile-generate-run-btn');
                if (nextButton) {
                    nextButton.disabled = false;
                    nextButton.textContent = '生成';
                }
            }
            if (completed) closeCharProfileGenerateSheet();
        }

        function showXConfirm(options = {}) {
            if (typeof window.showCustomModal === 'function') {
                window.showCustomModal(options);
                return;
            }
            if (window.confirm(options.message || options.title || 'Confirm?')) {
                options.onConfirm?.();
            }
        }

        function openDmSettingsSheet() {
            if (!currentDmId || !getDirectMessageById(currentDmId)) return;
            renderDmSettingsImessageContext();
            if (typeof window.openView === 'function') window.openView(dmSettingsSheet);
            else dmSettingsSheet?.classList.add('active');
        }

        function closeDmSettingsSheet() {
            if (typeof window.closeView === 'function') window.closeView(dmSettingsSheet);
            else dmSettingsSheet?.classList.remove('active');
        }

        function renderDmSettingsImessageContext() {
            const section = document.getElementById('x-dm-imessage-context-settings');
            const enabledInput = document.getElementById('x-dm-imessage-context-enabled');
            const limitInput = document.getElementById('x-dm-imessage-context-limit');
            const sourceLabel = document.getElementById('x-dm-imessage-context-source');
            const item = currentDmId ? getDirectMessageById(currentDmId) : null;
            const linkedChar = getLinkedImessageCharForDm(item);

            if (!section || !enabledInput || !limitInput) return;
            if (!item || !linkedChar) {
                section.hidden = true;
                return;
            }

            const mount = normalizeImessageContextMount(item.imessageContextMount);
            section.hidden = false;
            enabledInput.checked = mount.enabled;
            limitInput.value = String(mount.limit);
            if (sourceLabel) {
                sourceLabel.textContent = `生成回复时引用 ${linkedChar.nickname || linkedChar.realName || item.name} 的 iMessage 单聊`;
            }
        }

        function updateCurrentDmImessageContext(patch = {}) {
            const item = currentDmId ? getDirectMessageById(currentDmId) : null;
            if (!item || !getLinkedImessageCharForDm(item)) return null;

            const nextMount = normalizeImessageContextMount({
                ...item.imessageContextMount,
                ...patch
            });
            const updated = updateDirectMessage(item.id, draft => {
                draft.imessageContextMount = nextMount;
                return draft;
            });
            renderDmSettingsImessageContext();
            return updated;
        }

        function clearCurrentDmChat() {
            const item = currentDmId ? getDirectMessageById(currentDmId) : null;
            if (!item) return;
            showXConfirm({
                title: '清空聊天记录',
                message: `确定清空与 ${item.name} 的聊天记录吗？此操作不可恢复。`,
                confirmText: '清空',
                isDestructive: true,
                onConfirm: () => {
                    updateDirectMessage(item.id, (draft) => {
                        draft.messages = [];
                        return draft;
                    });
                    closeDmSettingsSheet();
                    renderDirectMessages();
                    renderDmChat();
                    if (typeof window.showToast === 'function') window.showToast('已清空聊天记录');
                }
            });
        }

        function deleteCurrentDmChat() {
            const item = currentDmId ? getDirectMessageById(currentDmId) : null;
            if (!item) return;
            showXConfirm({
                title: '删除会话',
                message: `确定删除与 ${item.name} 的私信会话吗？此操作不可恢复。`,
                confirmText: '删除',
                isDestructive: true,
                onConfirm: () => {
                    updateXState((draft) => {
                        draft.xDirectMessages = (draft.xDirectMessages || [])
                            .filter((entry) => String(entry.id) !== String(item.id));
                    });
                    closeDmSettingsSheet();
                    closeDmProfile();
                    closeDmChat();
                    renderDirectMessages();
                    if (typeof window.showToast === 'function') window.showToast('已删除会话');
                }
            });
        }

        function updateDirectMessage(dmId, updater) {
            let updated = null;
            updateXState((draft) => {
                draft.xDirectMessages = (draft.xDirectMessages || []).map((item) => {
                    if (String(item.id) !== String(dmId)) return item;
                    const normalized = normalizeDmChar(item, item.origin || 'manual');
                    const next = updater({ ...normalized, messages: [...normalized.messages] }) || normalized;
                    updated = next;
                    return next;
                });
            });
            return updated;
        }

        function syncCharPostIdentity(char, previous = {}) {
            if (!char) return;
            const charId = String(char.id || '');
            const currentHandle = canonicalAccountHandle(char.handle, char.name);
            const previousHandle = canonicalAccountHandle(previous?.handle, previous?.name);
            const avatar = normalizePersonAvatar(char.avatar, `char:${charId}:${char.handle || char.name}`);
            const matchesChar = (post = {}) => {
                if (charId && String(post.authorId || post.accountId || '') === charId) return true;
                const postHandle = canonicalAccountHandle(post.handle || post.authorHandle, post.name || post.authorName);
                return Boolean(postHandle && (postHandle === currentHandle || postHandle === previousHandle));
            };
            const applyIdentity = (post = {}, force = false) => {
                const refPost = post.refPost ? applyIdentity(post.refPost) : post.refPost;
                if (!force && !matchesChar(post)) return refPost === post.refPost ? post : { ...post, refPost };
                return {
                    ...post,
                    refPost,
                    authorId: charId,
                    authorName: char.name,
                    name: char.name,
                    handle: char.handle,
                    authorAvatar: avatar,
                    avatar
                };
            };

            updateXState((draft) => {
                draft.xGeneratedPosts = (draft.xGeneratedPosts || []).map((post) => applyIdentity(post));
                draft.xDirectMessages = (draft.xDirectMessages || []).map((item) => ({
                    ...item,
                    profilePosts: String(item.id) === charId
                        ? (item.profilePosts || []).map((post) => applyIdentity(post, true))
                        : (item.profilePosts || []).map((post) => applyIdentity(post)),
                    messages: (item.messages || []).map((message) => ({
                        ...message,
                        postSnapshot: message.postSnapshot ? applyIdentity(message.postSnapshot) : message.postSnapshot
                    }))
                }));
            });

            Object.keys(postData).forEach((postId) => {
                const refreshed = applyIdentity(postData[postId]);
                if (refreshed !== postData[postId]) postData[postId] = refreshed;
            });
        }

        function appendDmMessage(dmId, source, text, translation = '') {
            const content = safeText(text);
            if (!content) return null;
            const isIncoming = source !== 'user';
            const isOpenConversation = isIncoming
                && String(currentDmId || '') === String(dmId)
                && dmChatView?.classList.contains('active');
            const message = {
                id: makeLocalId('dm-msg'),
                source: source === 'user' ? 'user' : 'char',
                text: content,
                translation: safeText(translation),
                createdAt: Date.now()
            };
            updateDirectMessage(dmId, (item) => {
                item.messages.push(message);
                if (isOpenConversation) item.lastReadAt = message.createdAt;
                return item;
            });
            renderDirectMessages();
            renderDmChat();
            return message;
        }

        function appendDmMessageBatch(dmId, source, entries = []) {
            const isIncoming = source !== 'user';
            const isOpenConversation = isIncoming
                && String(currentDmId || '') === String(dmId)
                && dmChatView?.classList.contains('active');
            const createdAt = Date.now();
            const messages = (Array.isArray(entries) ? entries : [])
                .map((entry, index) => {
                    const text = safeText(entry?.text || entry?.content || entry?.message);
                    if (!text) return null;
                    return {
                        id: makeLocalId(`dm-msg-${index}`),
                        source: source === 'user' ? 'user' : 'char',
                        text,
                        translation: getGeneratedTranslation(entry, text),
                        createdAt: createdAt + index
                    };
                })
                .filter(Boolean);
            if (!messages.length) return [];

            updateDirectMessage(dmId, (item) => {
                item.messages.push(...messages);
                if (isOpenConversation) item.lastReadAt = messages[messages.length - 1].createdAt;
                return item;
            });
            renderDirectMessages();
            renderDmChat();
            return messages;
        }

        function appendDmPostCard(dmId, postSnapshot) {
            const message = {
                id: makeLocalId('dm-post'),
                source: 'user',
                type: 'post-card',
                text: '[转发帖子]',
                postSnapshot: normalizePostSnapshot(postSnapshot),
                createdAt: Date.now()
            };
            updateDirectMessage(dmId, (item) => {
                item.messages.push(message);
                return item;
            });
            renderDirectMessages();
            if (currentDmId && String(currentDmId) === String(dmId)) renderDmChat();
            return message;
        }

        function createPostSnapshot(postId) {
            const post = postData[postId];
            if (!post) return null;
            const thread = getPostThread(postId);
            return normalizePostSnapshot({
                id: postId,
                authorId: post.authorId,
                name: post.name,
                handle: post.handle,
                avatar: post.avatar,
                text: post.text,
                topicTag: post.topicTag,
                images: getPostImages(post).map((image) => ({ ...image })),
                comments: (thread.comments || []).map((comment) => ({
                    ...comment,
                    replies: (comment.replies || []).map((reply) => ({ ...reply }))
                }))
            });
        }

        function openPostForwardSheet(postId) {
            const snapshot = createPostSnapshot(postId);
            const list = document.getElementById('x-post-forward-list');
            if (!snapshot || !list || !postForwardSheet) return;
            currentForwardPostId = String(postId);
            const recipients = (getXState().xDirectMessages || [])
                .map((item) => normalizeDmChar(item, item?.origin || 'manual'))
                .filter((item) => item.isFollowing === true);
            list.innerHTML = recipients.length
                ? recipients.map((item) => `
                    <button class="x-post-forward-recipient" type="button" data-forward-dm-id="${escapeHtml(item.id)}">
                        <span class="x-avatar">${buildAvatarHtml(item.avatar, item.name)}</span>
                        <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.handle || '@char')}</small></span>
                        <i class="fas fa-paper-plane"></i>
                    </button>
                `).join('')
                : '<div class="x-empty-state">暂无已关注的 Char，请先进入 Char 主页关注。</div>';
            if (typeof window.openView === 'function') window.openView(postForwardSheet);
            else postForwardSheet.classList.add('active');
        }

        function closePostForwardSheet() {
            currentForwardPostId = null;
            if (typeof window.closeView === 'function') window.closeView(postForwardSheet);
            else postForwardSheet?.classList.remove('active');
        }

        function forwardPostToDm(dmId) {
            const postId = currentForwardPostId;
            const recipient = getDirectMessageById(dmId);
            const snapshot = postId ? createPostSnapshot(postId) : null;
            if (!recipient || !snapshot) return;
            appendDmPostCard(recipient.id, snapshot);
            const thread = getPostThread(postId);
            thread.reposts = Math.max(0, Number(thread.reposts) || 0) + 1;
            thread.reposted = true;
            savePostThread(postId, thread);
            updatePostCountNodes(postId, thread);
            closePostForwardSheet();
            if (postDetailView?.classList.contains('active') && String(currentDetailPostId) === String(postId)) {
                openPostDetail(postId);
            }
            if (typeof window.showToast === 'function') window.showToast(`已转发给 ${recipient.name}`);
        }

        function serializeDmMessageForAi(message) {
            if (message?.type !== 'post-card') {
                return `${message?.source === 'user' ? currentProfile.name : 'Char'}: ${safeText(message?.text)}`;
            }
            const post = normalizePostSnapshot(message.postSnapshot);
            const contextLines = [];
            for (const comment of post.comments) {
                if (contextLines.length >= 20) break;
                contextLines.push(`${comment.name}: ${comment.text}`);
                for (const reply of comment.replies) {
                    if (contextLines.length >= 20) break;
                    contextLines.push(`↳ ${reply.name}: ${reply.text}`);
                }
            }
            const comments = contextLines.join('\n');
            return `${currentProfile.name} 转发了一条帖子：
作者：${post.name} ${post.handle}
正文：${post.text}
话题：${post.topicTag || '无'}
评论：
${comments || '暂无评论'}`;
        }

        function buildDmPostCardHtml(message) {
            const post = normalizePostSnapshot(message.postSnapshot);
            const image = post.images[0];
            return `
                <div class="x-dm-post-card" data-shared-post-id="${escapeHtml(post.id)}">
                    <div class="x-dm-post-card-author">
                        <span class="x-avatar">${buildAvatarHtml(post.avatar, post.name)}</span>
                        <span><strong>${escapeHtml(post.name)}</strong><small>${escapeHtml(post.handle)}</small></span>
                    </div>
                    <p>${renderPostTextHtml({ ...post, text: post.text || '分享了一条帖子' })}</p>
                    ${image ? `<img src="${escapeHtml(image.url)}" alt="" onerror="this.remove()">` : ''}
                    <span class="x-dm-post-card-label"><i class="fab fa-x-twitter"></i> X Post</span>
                </div>
            `;
        }

        function openDmChat(dmId) {
            currentDmId = String(dmId);
            updateDirectMessage(currentDmId, (item) => {
                item.lastReadAt = Math.max(Number(item.lastReadAt) || 0, getDmLatestIncomingAt(item));
                return item;
            });
            renderDirectMessages();
            renderDmChat();
            dmChatView?.classList.add('active');
            dmChatView?.setAttribute('aria-hidden', 'false');
        }

        function closeDmChat() {
            const closingDmId = currentDmId;
            const fallbackSelector = closingDmId
                ? `.x-dm-row[data-dm-id="${escapeCssIdent(closingDmId)}"]`
                : '';
            releaseFocusBeforeHide(dmChatView, fallbackSelector);
            currentDmId = null;
            dmChatView?.classList.remove('active');
            dmChatView?.setAttribute('aria-hidden', 'true');
        }

        function renderDmChat() {
            const item = currentDmId ? getDirectMessageById(currentDmId) : null;
            if (!item || !dmChatView) return;
            const avatarEl = document.getElementById('x-dm-chat-avatar');
            const nameEl = document.getElementById('x-dm-chat-name');
            const handleEl = document.getElementById('x-dm-chat-handle');
            const messages = normalizeDmMessages(item.messages);

            if (avatarEl) avatarEl.innerHTML = buildAvatarHtml(item.avatar, item.name);
            if (nameEl) nameEl.textContent = item.name;
            if (handleEl) handleEl.textContent = item.handle || '@char';
            if (dmChatMessagesEl) {
                const introHtml = renderDmProfileIntro(item);
                const timestampHtml = messages.length
                    ? `<time class="x-dm-time-divider" datetime="${escapeHtml(new Date(messages[0].createdAt).toISOString())}">${escapeHtml(formatDmTimestamp(messages[0].createdAt))}</time>`
                    : '';
                dmChatMessagesEl.innerHTML = messages.length
                    ? `${introHtml}${timestampHtml}${messages.map((message) => `
                        <div class="x-dm-chat-bubble-row ${message.source === 'user' ? 'user' : 'char'} ${message.type === 'post-card' ? 'post-card' : ''}">
                            ${message.type === 'post-card'
                                ? buildDmPostCardHtml(message)
                                : (message.translation
                                    ? `<button class="x-dm-chat-bubble x-dm-translation-bubble" type="button" aria-expanded="false" title="点击展开翻译"><span class="x-dm-original-text">${escapeHtml(message.text)}</span><span class="x-dm-expanded-translation" hidden>${escapeHtml(message.translation)}</span></button>`
                                    : `<div class="x-dm-chat-bubble">${escapeHtml(message.text)}</div>`)}
                        </div>
                    `).join('')}`
                    : `${introHtml}<div class="x-dm-chat-empty">暂无消息</div>`;
                dmChatMessagesEl.scrollTop = dmChatMessagesEl.scrollHeight;
            }
        }

        function sendDmUserMessage() {
            if (!currentDmId || !dmChatInput) return;
            const text = safeText(dmChatInput.value);
            if (!text) {
                if (typeof window.showToast === 'function') window.showToast('请输入消息内容');
                return;
            }
            dmChatInput.value = '';
            appendDmMessage(currentDmId, 'user', text);
        }

        async function generateDmApiReply() {
            if (!currentDmId) return;
            const requestedDmId = String(currentDmId);
            const item = getDirectMessageById(requestedDmId);
            if (!item) return;
            const apiBtn = document.getElementById('x-dm-chat-api-btn');
            apiBtn?.classList.add('loading');
            apiBtn?.setAttribute('disabled', 'true');
            try {
                const imessageContext = await buildImessageSingleChatContext(item);
                const recent = normalizeDmMessages(item.messages).slice(-12)
                    .map((message) => message.type === 'post-card'
                        ? serializeDmMessageForAi(message)
                        : `${message.source === 'user' ? currentProfile.name : item.name}: ${message.text}`)
                    .join('\n');
                const worldbook = getSelectedWorldBookContext(
                    `${item.name} ${item.bio} ${currentProfile.persona}`,
                    getCharacterBoundWorldBookIds(item)
                );
                const content = await requestXChatCompletion([
                    { role: 'system', content: 'You are generating an incoming direct-message reply in the X app. This is a one-to-one private conversation between the named Char and the human-controlled User account. Reply only as the named X private-message Char, never as the User. Return strict JSON only: {"messages":[{"text":"","translation":""}]}.' },
                    { role: 'user', content: `Character: ${item.name} ${item.handle || ''}
Persona: ${item.persona || 'ordinary user'}
Bio/signature: ${item.bio || ''}
User profile: ${currentProfile.name} ${currentProfile.handle}
User persona: ${currentProfile.persona || currentProfile.bio || ''}
Conversation channel: this is a private one-to-one X app direct message between this Character and User.
Worldbook:
${worldbook || 'None'}
iMessage single-chat continuity:
${imessageContext || 'None'}
Recent chat:
${recent || 'No previous chat.'}
Generate between 3 and 8 natural incoming private-message bubbles from this Character.
Rules:
- The messages array MUST contain 3 to 8 objects, inclusive.
- Every message is authored by the Character. Never generate a message, action, narration or reply authored by the User.
- Write one coherent conversational burst: each bubble should advance the thought or reaction, without repeating the same sentence.
- Keep individual bubbles concise and realistic. Splitting a longer thought across multiple bubbles is encouraged.
- Continue naturally from the most recent chat and respond to concrete details. If the latest context contains a forwarded post, react specifically to that post.
- Do not prefix messages with a name, handle, role label or quotation marks. Do not include markdown or text outside the JSON object.
- Each message object must contain text and translation. If text is not Simplified Chinese, translation must be an accurate Simplified Chinese translation; otherwise translation must be an empty string.` }
                ], { temperature: 0.85 });
                const parsed = parseJsonPayload(content);
                const rawReplies = Array.isArray(parsed)
                    ? parsed
                    : (Array.isArray(parsed?.messages)
                        ? parsed.messages
                        : (Array.isArray(parsed?.replies) ? parsed.replies : (parsed?.text ? [parsed] : [])));
                const replies = rawReplies
                    .map((reply) => ({
                        text: safeText(reply?.text || reply?.content || reply?.message),
                        translation: getGeneratedTranslation(reply, reply?.text || reply?.content || reply?.message)
                    }))
                    .filter((reply) => reply.text)
                    .slice(0, 8);
                if (replies.length < 3) throw new Error('DM reply batch must contain at least 3 messages');
                appendDmMessageBatch(requestedDmId, 'char', replies);
            } catch (error) {
                console.error('[X] DM API reply failed', error);
                if (typeof window.showToast === 'function') window.showToast('API 调用失败，请稍后重试');
            } finally {
                apiBtn?.classList.remove('loading');
                apiBtn?.removeAttribute('disabled');
            }
        }

        function openImagePreview(text, url = '') {
            if (!imagePreviewOverlay) return;
            const textEl = document.getElementById('x-image-preview-text');
            const imgEl = document.getElementById('x-image-preview-img');
            if (textEl) textEl.textContent = safeText(text, 'Image');
            if (imgEl) {
                if (url) {
                    imgEl.src = url;
                    imgEl.style.display = 'block';
                } else {
                    imgEl.removeAttribute('src');
                    imgEl.style.display = 'none';
                }
            }
            imagePreviewOverlay.classList.add('active');
            imagePreviewOverlay.setAttribute('aria-hidden', 'false');
        }

        function closeImagePreview() {
            imagePreviewOverlay?.classList.remove('active');
            imagePreviewOverlay?.setAttribute('aria-hidden', 'true');
        }

        function openPostSettingsSheet(postId) {
            currentActionPostId = postId;
            if (typeof window.openView === 'function') window.openView(postSettingsSheet);
            else postSettingsSheet?.classList.add('active');
        }

        function closePostSettingsSheet() {
            if (typeof window.closeView === 'function') window.closeView(postSettingsSheet);
            else postSettingsSheet?.classList.remove('active');
            setTimeout(() => { currentActionPostId = null; }, 300);
        }

        async function deleteXPost(postId) {
            const previousState = getXState();
            updateXState((draft) => {
                draft.xGeneratedPosts = (draft.xGeneratedPosts || [])
                    .filter((post) => String(post?.id) !== String(postId));
                draft.xDirectMessages = (draft.xDirectMessages || []).map((item) => ({
                    ...item,
                    profilePosts: (item.profilePosts || [])
                        .filter((post) => String(post?.id) !== String(postId))
                }));
                delete draft.xPostThreads[String(postId)];
            });
            delete postData[postId];

            const durable = await flushXStateNow('x-post-delete');
            if (!durable) {
                saveXState(previousState);
                renderGeneratedPosts();
                if (typeof window.showToast === 'function') window.showToast('帖子删除未保存，请重试');
                return false;
            }

            const cards = view.querySelectorAll(`.x-feed-card[data-post-id="${escapeCssIdent(postId)}"]`);
            cards.forEach(card => {
                card.style.opacity = '0';
                card.style.transform = 'scale(0.95)';
                card.style.transition = 'all 0.2s ease';
                setTimeout(() => card.remove(), 200);
            });

            closePostSettingsSheet();
            if (currentDetailPostId === postId) {
                closePostDetail();
            }
            if (typeof window.showToast === 'function') window.showToast('帖子已删除');
            return true;
        }

        function deleteTargetPost() {
            if (!currentActionPostId) return;
            const postId = currentActionPostId;
            showXConfirm({
                title: '删除帖子',
                message: '确定要删除这条帖子吗？此操作不可恢复。',
                confirmText: '删除',
                isDestructive: true,
                onConfirm: () => {
                    void deleteXPost(postId);
                }
            });
        }

        function prependUniquePosts(existingPosts, newPosts) {
            const seen = new Set();
            return [...(newPosts || []), ...(existingPosts || [])].filter((post) => {
                if (!post) return false;
                const key = String(post.id || '');
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        }

        function openSearchGenerateSheet(mode = 'home') {
            searchGenerateMode = mode === 'discover' ? 'discover' : 'home';
            if (searchGenerateInput) searchGenerateInput.value = '';
            const title = document.getElementById('x-search-generate-title');
            const label = document.getElementById('x-search-generate-label');
            const runBtn = document.getElementById('x-search-generate-run-btn');
            if (searchGenerateMode === 'discover') {
                if (title) title.textContent = '生成热搜';
                if (label) label.textContent = '想搜索什么';
                if (searchGenerateInput) searchGenerateInput.placeholder = '可留空，留空时随机生成热搜';
                if (runBtn) runBtn.textContent = '生成';
            } else {
                if (title) title.textContent = '搜索/生成帖子';
                if (label) label.textContent = '生成方向';
                if (searchGenerateInput) searchGenerateInput.placeholder = '可留空，或输入想生成的帖子主题';
                if (runBtn) runBtn.textContent = 'Generate';
            }
            if (typeof window.openView === 'function') window.openView(searchGenerateSheet);
            else searchGenerateSheet?.classList.add('active');
        }

        function closeSearchGenerateSheet() {
            if (typeof window.closeView === 'function') window.closeView(searchGenerateSheet);
            else searchGenerateSheet?.classList.remove('active');
        }

        function normalizeDiscoverTrendEntries(payload) {
            const rawTrends = Array.isArray(payload)
                ? payload
                : (Array.isArray(payload?.trends) ? payload.trends : []);
            return rawTrends.map((rawTrend, trendIndex) => {
                const trend = normalizeTrend(rawTrend, trendIndex);
                if (!trend) return null;
                const rawPosts = sanitizeApiGeneratedPosts(Array.isArray(rawTrend?.posts) ? rawTrend.posts : []);
                const posts = rawPosts.slice(0, 3)
                    .map((rawPost, postIndex) => normalizeGeneratedPost({
                        ...rawPost,
                        topicTag: trend.title
                    }, postIndex))
                    .filter(Boolean)
                    .map((post) => {
                        post.topicTag = trend.title;
                        return ensureCommentDepth(post);
                    });
                if (posts.length < 1 || posts.length > 3) return null;
                return { trend, posts };
            }).filter(Boolean);
        }

        async function requestDiscoverTrendBatch(topic, count, excludedTitles = []) {
            const worldbook = getSelectedWorldBookContext(`${topic} ${currentProfile.bio} ${currentProfile.persona}`);
            const reusableAuthors = getReusableAuthorContext();
            const prompt = `Return strict JSON only in this shape: {"trends":[{"title":"#Topic","translation":"","category":"Category · Trending","heat":"12.3K","posts":[{"authorName":"","handle":"","text":"","translation":"","likes":0,"reposts":0,"commentsCount":0,"mediaType":"text","comments":[{"authorName":"","handle":"","text":"","translation":""}]}]}]}.
Generate exactly ${count} unique realistic global X hot-search topics. Each trend MUST contain 1 to 3 directly related posts. Do not return a trend without a valid post.
The current User is context only. Every generated post, comment and reply must use a non-User author.
Use varied regions, languages, categories, account types, viewpoints and plausible heat values. Authors should use their natural language. Every non-Chinese post, comment and reply must include an accurate Simplified Chinese translation; Chinese originals use "". Avoid generic filler.
Search intent: ${topic || '随机发现内容'}
Do not repeat these trend titles: ${excludedTitles.length ? excludedTitles.join('、') : 'None'}
X user: ${JSON.stringify({ name: currentProfile.name, handle: currentProfile.handle, bio: currentProfile.bio })}
Reusable existing authors (optional; when used for a post, return their exact authorId): ${JSON.stringify(reusableAuthors)}
Worldbook:
${worldbook || 'None'}`;
            const raw = await requestXChatCompletion([
                { role: 'system', content: 'You generate strict JSON for a fictional international X social feed. Output JSON only.' },
                { role: 'user', content: prompt }
            ], { temperature: 0.9 });
            return normalizeDiscoverTrendEntries(parseJsonPayload(raw));
        }

        async function generateDiscoverSearchResults() {
            const topic = safeText(searchGenerateInput?.value);
            const entries = [];
            const seen = new Set();
            const addEntries = (items) => {
                items.forEach((entry) => {
                    const key = entry.trend.title.toLocaleLowerCase();
                    if (seen.has(key) || entries.length >= 10) return;
                    seen.add(key);
                    entries.push(entry);
                });
            };
            addEntries(await requestDiscoverTrendBatch(topic, 10));
            if (entries.length < 10) {
                addEntries(await requestDiscoverTrendBatch(topic, 10 - entries.length, entries.map((entry) => entry.trend.title)));
            }
            if (entries.length < 10) throw new Error('API returned fewer than 10 valid trends');

            const state = getXState();
            const newPosts = entries.flatMap((entry) => entry.posts);
            saveXState({
                ...state,
                xTrends: entries.slice(0, 10).map((entry) => ({ ...entry.trend, movement: 'none' })),
                xGeneratedPosts: prependUniquePosts(state.xGeneratedPosts, newPosts)
            });
            await flushXStateNow('x-discover-generation');
            renderTrends();
            renderGeneratedPosts();
            return `已生成 10 条热搜和 ${newPosts.length} 条关联帖子`;
        }

        async function generateHomeSearchPosts() {
            const topic = safeText(searchGenerateInput?.value);
            const worldbook = getSelectedWorldBookContext(`${topic} ${currentProfile.bio}`);
            const searchUserProfile = {
                name: currentProfile.name,
                handle: currentProfile.handle,
                bio: currentProfile.bio
            };
            const reusableAuthors = getReusableAuthorContext();
            const prompt = `Return strict JSON only. Generate 5 to 10 realistic Weibo/X-style posts for the user's feed.
The current User is context only. Never author a generated post, comment or reply as the User; use only distinct non-User accounts.
Mix account types: official brand/media accounts, personal accounts, fan accounts, passers-by, marketing accounts, and niche community accounts.
Mix tones: serious analysis, funny meme-style posts, subtle sarcasm, heated/controversial takes, recommendations, complaints, fan enthusiasm, and deliberately argument-starting opinions. Keep it plausible, not generic.
Every post must be grounded in the topic, minimal user profile, and worldbook context when available. Avoid template-like filler.
Each post must include: authorName, handle, text, translation, likes, reposts, commentsCount, mediaType ("text" or "image"), comments, and optional imagePrompt/images only when mediaType is "image". Every comment and reply must include translation.
Posts can be pure text. Prefer text posts unless an image clearly adds value.
Each post must have at least 5 comments.
Comments should feel like a real international X feed: disagreements, jokes, memes, clarifications, fans defending someone, skeptical passers-by, and occasional heated replies are allowed.
Every comment must be directly related to its own post. It must reference at least one concrete detail from the post text, topic, author stance, event, character, imagePrompt, or images[].text. Do not write generic reactions such as "interesting", "same", "nice", or comments that could fit any post.
Replies are optional. If replies are included, each reply must respond to the parent comment's concrete point and connect back to the post.
If mediaType is "image", describe the image subject, composition, light, mood, and relevant post detail in imagePrompt or images[].text. Do not invent inaccessible URLs.
Authors may use any language natural to their identity and context. For every non-Chinese post, comment or reply, translation must contain accurate Simplified Chinese; Chinese originals use "". Keep imagePrompt and images[].text descriptions in Simplified Chinese.
Topic: ${topic || 'open recommendation feed'}
User profile: ${JSON.stringify(searchUserProfile)}
Reusable existing authors (optional; when used, return their exact authorId): ${JSON.stringify(reusableAuthors)}
Worldbook:
${worldbook || 'None'}`;
            const raw = await requestXChatCompletion([
                { role: 'system', content: 'You are a JSON generator for a fictional X feed. Output only valid JSON.' },
                { role: 'user', content: prompt }
            ], { temperature: 0.9 });
            const parsed = parseJsonPayload(raw);
            const posts = sanitizeApiGeneratedPosts(Array.isArray(parsed) ? parsed : (Array.isArray(parsed.posts) ? parsed.posts : []));
            const added = appendGeneratedPosts(posts);
            await flushXStateNow('x-search-generation');
            return added.length ? `已生成 ${added.length} 条帖子` : '没有生成可用帖子';
        }

        async function runSearchGeneration() {
            const runBtn = document.getElementById('x-search-generate-run-btn');
            const idleText = searchGenerateMode === 'discover' ? '生成' : 'Generate';
            runBtn?.classList.add('loading');
            if (runBtn) runBtn.textContent = searchGenerateMode === 'discover' ? '生成中...' : 'Generating';
            try {
                const message = searchGenerateMode === 'discover'
                    ? await generateDiscoverSearchResults()
                    : await generateHomeSearchPosts();
                closeSearchGenerateSheet();
                if (typeof window.showToast === 'function') window.showToast(message);
            } catch (error) {
                console.error('[X] Search generation failed', error);
                if (typeof window.showToast === 'function') window.showToast('生成失败，请检查 API 配置或返回格式');
            } finally {
                runBtn?.classList.remove('loading');
                if (runBtn) runBtn.textContent = idleText;
            }
        }

        function getAdvanceControls() {
            return {
                strangersToggle: document.getElementById('x-advance-strangers-toggle'),
                strangersCount: document.getElementById('x-advance-strangers-count'),
                trendsToggle: document.getElementById('x-advance-trends-toggle'),
                trendsCount: document.getElementById('x-advance-trends-count'),
                postsToggle: document.getElementById('x-advance-posts-toggle'),
                postsCount: document.getElementById('x-advance-posts-count'),
                runButton: document.getElementById('x-advance-run-btn')
            };
        }

        function readAdvancePreferences() {
            const controls = getAdvanceControls();
            return normalizeAdvancePreferences({
                strangersEnabled: !!controls.strangersToggle?.checked,
                strangersCount: controls.strangersCount?.value,
                trendsEnabled: !!controls.trendsToggle?.checked,
                trendsCount: controls.trendsCount?.value,
                postsEnabled: !!controls.postsToggle?.checked,
                postsCount: controls.postsCount?.value
            });
        }

        function syncAdvanceControls() {
            const controls = getAdvanceControls();
            if (controls.strangersCount) controls.strangersCount.disabled = !controls.strangersToggle?.checked;
            if (controls.trendsCount) controls.trendsCount.disabled = !controls.trendsToggle?.checked;
            if (controls.postsCount) controls.postsCount.disabled = !controls.postsToggle?.checked;
            const hasSelection = !!(controls.strangersToggle?.checked || controls.trendsToggle?.checked || controls.postsToggle?.checked);
            if (controls.runButton && !controls.runButton.classList.contains('loading')) controls.runButton.disabled = !hasSelection;
        }

        function populateAdvanceControls() {
            const preferences = normalizeAdvancePreferences(getXState().xAdvancePreferences);
            const controls = getAdvanceControls();
            if (controls.strangersToggle) controls.strangersToggle.checked = preferences.strangersEnabled;
            if (controls.strangersCount) controls.strangersCount.value = String(preferences.strangersCount);
            if (controls.trendsToggle) controls.trendsToggle.checked = preferences.trendsEnabled;
            if (controls.trendsCount) controls.trendsCount.value = String(preferences.trendsCount);
            if (controls.postsToggle) controls.postsToggle.checked = preferences.postsEnabled;
            if (controls.postsCount) controls.postsCount.value = String(preferences.postsCount);
            syncAdvanceControls();
        }

        function persistAdvancePreferences() {
            const preferences = readAdvancePreferences();
            updateXState((draft) => {
                draft.xAdvancePreferences = preferences;
            });
            return preferences;
        }

        function openAdvanceSheet() {
            if (advancePlotInput) advancePlotInput.value = '';
            populateAdvanceControls();
            if (typeof window.openView === 'function') window.openView(advanceSheet);
            else advanceSheet?.classList.add('active');
        }

        function closeAdvanceSheet() {
            if (advanceSheet?.querySelector('.x-advance-sheet')?.classList.contains('is-loading')) return;
            if (typeof window.closeView === 'function') window.closeView(advanceSheet);
            else advanceSheet?.classList.remove('active');
        }

        function setAdvanceLoading(loading) {
            const sheet = advanceSheet?.querySelector('.x-advance-sheet');
            const runBtn = document.getElementById('x-advance-run-btn');
            sheet?.classList.toggle('is-loading', loading);
            runBtn?.classList.toggle('loading', loading);
            if (runBtn) {
                runBtn.disabled = loading;
                runBtn.textContent = loading ? '生成中...' : '生成';
            }
            if (!loading) syncAdvanceControls();
        }

        function buildAdvanceStoryContext(state) {
            const recentPosts = (state.xGeneratedPosts || []).slice(0, 20).map((post) => ({
                author: post.authorName || post.name || post.handle,
                topic: post.topicTag || '',
                text: post.text || post.content || '',
                comments: (Array.isArray(post.commentList) ? post.commentList : [])
                    .slice(0, 3)
                    .map((comment) => comment.text || comment.content || '')
            }));
            return JSON.stringify({
                user: {
                    name: currentProfile.name,
                    handle: currentProfile.handle,
                    bio: currentProfile.bio,
                    persona: currentProfile.persona
                },
                trends: normalizeTrendList(state.xTrends || []).slice(0, maxXTrends),
                recentPosts
            });
        }

        async function collectExactGeneratedItems({ total, batchSize, blockedKeys = [], getKey, requestBatch, label }) {
            const items = [];
            const seen = new Set(blockedKeys.map((key) => String(key).toLocaleLowerCase()));
            const addItems = (batch) => {
                (Array.isArray(batch) ? batch : []).forEach((item) => {
                    const key = safeText(getKey(item)).toLocaleLowerCase();
                    if (!key || seen.has(key) || items.length >= total) return;
                    seen.add(key);
                    items.push(item);
                });
            };
            const batchCount = Math.ceil(total / batchSize);
            for (let index = 0; index < batchCount && items.length < total; index += 1) {
                addItems(await requestBatch(Math.min(batchSize, total - items.length), Array.from(seen)));
            }
            if (items.length < total) {
                addItems(await requestBatch(total - items.length, Array.from(seen)));
            }
            if (items.length < total) throw new Error(`${label} returned fewer than ${total} valid items`);
            return items.slice(0, total);
        }

        function normalizeGeneratedStranger(raw = {}, index = 0) {
            const name = safeText(raw.name || raw.nickname || raw.handle);
            if (!name) return null;
            const rawMessages = Array.isArray(raw.messages) ? raw.messages : [];
            const baseTime = Date.now() + index * 10;
            const messages = rawMessages.map((message, messageIndex) => {
                const text = safeText(typeof message === 'string' ? message : (message?.text || message?.content || message?.message));
                return {
                    id: makeLocalId('dm-msg'),
                    source: 'char',
                    text,
                    translation: typeof message === 'object' ? getGeneratedTranslation(message, text) : '',
                    createdAt: baseTime + messageIndex
                };
            }).filter((message) => message.text).slice(0, 5);
            if (messages.length < 2) return null;
            return normalizeDmChar({
                id: raw.id || makeLocalId('stranger'),
                origin: 'generated',
                name,
                handle: raw.handle,
                bio: raw.bio || raw.signature,
                persona: raw.persona,
                avatar: raw.avatar,
                isFollowing: false,
                messages,
                addedAt: baseTime
            }, 'generated');
        }

        function countGeneratedCommentItems(item) {
            if (Array.isArray(item)) {
                return item.reduce((total, child) => total + countGeneratedCommentItems(child), 0);
            }
            if (!item || typeof item !== 'object') return 0;
            return 1 + countGeneratedCommentItems(item.replies || []);
        }

        function collectCommentIds(comments, ids = new Set()) {
            (Array.isArray(comments) ? comments : []).forEach((comment) => {
                if (!comment || typeof comment !== 'object') return;
                if (comment.id) ids.add(String(comment.id));
                collectCommentIds(comment.replies, ids);
            });
            return ids;
        }

        function ensureUniqueGeneratedCommentIds(comment, seenIds) {
            const next = {
                ...comment,
                replies: Array.isArray(comment.replies) ? comment.replies : []
            };
            if (!next.id || seenIds.has(String(next.id))) next.id = makeLocalId('auto-comment');
            seenIds.add(String(next.id));
            next.replies = next.replies.map((reply) => {
                const normalizedReply = { ...reply, replies: [] };
                if (!normalizedReply.id || seenIds.has(String(normalizedReply.id))) {
                    normalizedReply.id = makeLocalId('auto-reply');
                }
                seenIds.add(String(normalizedReply.id));
                return normalizedReply;
            });
            return next;
        }

        function normalizePostInteractionComments(payload = {}) {
            const rawComments = Array.isArray(payload)
                ? payload
                : (Array.isArray(payload.comments)
                    ? payload.comments
                    : (Array.isArray(payload.replies) ? payload.replies : []));
            return rawComments
                .map((comment) => sanitizeApiGeneratedComment(comment))
                .filter(Boolean)
                .map((comment, index) => normalizeGeneratedComment(comment, index))
                .filter(Boolean);
        }

        function normalizePostInteractionPrivateMessages(payload = {}) {
            const rawMessages = Array.isArray(payload?.privateMessages)
                ? payload.privateMessages
                : (Array.isArray(payload?.dmConversations)
                    ? payload.dmConversations
                    : (Array.isArray(payload?.dms) ? payload.dms : []));
            return sanitizeApiGeneratedAuthors(rawMessages)
                .map((item, index) => normalizeGeneratedStranger(item, index))
                .filter(Boolean);
        }

        function getPostForInteraction(postId, state = getXState()) {
            return (state.xGeneratedPosts || []).find((post) => String(post.id) === String(postId))
                || postData[postId]
                || {};
        }

        function savePostImageVision(postId, imageId, vision) {
            updateXState((draft) => {
                draft.xGeneratedPosts = (draft.xGeneratedPosts || []).map((post) => {
                    if (String(post?.id) !== String(postId)) return post;
                    return {
                        ...post,
                        images: (Array.isArray(post.images) ? post.images : []).map((image) => (
                            String(image?.id) === String(imageId)
                                ? { ...image, vision: { ...vision } }
                                : image
                        ))
                    };
                });
            });
        }

        function visionContextForImage(vision) {
            if (!vision || typeof vision !== 'object') return null;
            if (vision.status !== 'ready') return { status: String(vision.status || 'unknown') };
            return {
                status: 'ready',
                summary: safeText(vision.summary),
                visibleText: Array.isArray(vision.visibleText) ? vision.visibleText.map((item) => safeText(item)).filter(Boolean) : [],
                subjects: Array.isArray(vision.subjects) ? vision.subjects.map((item) => safeText(item)).filter(Boolean) : [],
                scene: safeText(vision.scene),
                mood: safeText(vision.mood),
                notableDetails: Array.isArray(vision.notableDetails) ? vision.notableDetails.map((item) => safeText(item)).filter(Boolean) : []
            };
        }

        async function enrichPublishedPostImages(postId, imageSources = []) {
            const source = (Array.isArray(imageSources) ? imageSources : []).find((image) => image?.id && image?.url);
            if (!source) return;
            const visionApi = window.u2ImageUnderstanding;
            if (!visionApi?.isConfigured?.()) {
                savePostImageVision(postId, source.id, {
                    status: 'skipped',
                    reason: 'not-configured',
                    analyzedAt: Date.now()
                });
                await flushXStateNow('x-post-image-vision-skipped');
                return;
            }
            try {
                const vision = await visionApi.analyze({ url: source.url, mimeType: source.mimeType });
                savePostImageVision(postId, source.id, vision);
                await flushXStateNow('x-post-image-vision');
            } catch (error) {
                console.warn('[X] Post image understanding failed', error);
                savePostImageVision(postId, source.id, {
                    status: 'failed',
                    reason: 'analysis-failed',
                    analyzedAt: Date.now()
                });
                await flushXStateNow('x-post-image-vision-failed');
            }
        }

        function buildPostInteractionContext(postId) {
            const state = getXState();
            const post = getPostForInteraction(postId, state);
            const thread = getPostThread(postId, state);
            const existingComments = (thread.comments || []).slice(0, 25).map((comment) => ({
                author: comment.name || comment.handle || '',
                text: comment.text || '',
                replies: (Array.isArray(comment.replies) ? comment.replies : []).slice(0, 5).map((reply) => ({
                    author: reply.name || reply.handle || '',
                    text: reply.text || ''
                }))
            }));
            const images = getPostImages(post).map((image) => ({
                text: image.text || image.description || '',
                vision: visionContextForImage(image.vision)
            }));
            return {
                user: {
                    name: currentProfile.name,
                    handle: currentProfile.handle,
                    bio: currentProfile.bio,
                    persona: currentProfile.persona
                },
                post: {
                    id: postId,
                    author: post.name || post.authorName || '',
                    handle: post.handle || post.authorHandle || '',
                    text: post.text || post.content || '',
                    topicTag: post.topicTag || '',
                    translation: post.translation || '',
                    images
                },
                existingComments,
                existingDmContacts: (state.xDirectMessages || []).slice(0, 50).map((item) => ({
                    name: item.name || item.nickname || '',
                    handle: item.handle || ''
                }))
            };
        }

        async function requestPostInteractionBatch(postId, options = {}) {
            const includePrivateMessages = options.includePrivateMessages !== false;
            const context = buildPostInteractionContext(postId);
            const contextText = JSON.stringify(context);
            const worldbook = getSelectedWorldBookContext(`${context.post.text} ${context.post.topicTag} ${currentProfile.persona} ${contextText}`);
            const outputShape = includePrivateMessages
                ? '{"comments":[{"authorName":"","handle":"","text":"","translation":"","replies":[{"authorName":"","handle":"","text":"","translation":""}]}],"privateMessages":[{"name":"","handle":"","bio":"","translation":"","persona":"","messages":[{"text":"","translation":""},{"text":"","translation":""}]}]}'
                : '{"comments":[{"authorName":"","handle":"","text":"","translation":"","replies":[{"authorName":"","handle":"","text":"","translation":""}]}]}';
            const prompt = `Return strict JSON only in this shape: ${outputShape}.
Generate engagement for this exact X post.
Minimum requirements:
- comments plus nested replies combined MUST contain at least 10 generated comment objects.
- Comments and replies must react to concrete details from the post, image descriptions, topic, existing comments, User persona, or Worldbook.
- When an image includes a ready vision object, use it as the only visual evidence. Do not invent visual details that are absent from that object.
${includePrivateMessages ? '- privateMessages MUST contain at least 2 new stranger private-message conversations.\n- Each privateMessages[].messages MUST contain 2 to 5 incoming message objects, and every message is authored by that stranger.\n- Private messages must be prompted by this specific User post and must not reuse existing DM contacts.' : '- Do not include privateMessages or any private-message content.'}
- Never generate content authored by the current User. The User is context only.
- Every generated author must be a non-User identity.
- Every user-facing text object must include translation. If the original text is Simplified Chinese, translation must be "".
- Do not include markdown, explanations, or text outside JSON.
${options.retryReason ? `Retry reason: ${options.retryReason}` : ''}

User profile/persona:
${JSON.stringify(context.user)}

Post context:
${contextText}

Worldbook:
${worldbook || 'None'}`;
            const raw = await requestXChatCompletion([
                { role: 'system', content: 'Generate strict JSON for fictional X post engagement. Output JSON only.' },
                { role: 'user', content: prompt }
            ], { temperature: 0.9 });
            const parsed = parseJsonPayload(raw);
            return {
                comments: normalizePostInteractionComments(parsed),
                privateMessages: includePrivateMessages ? normalizePostInteractionPrivateMessages(parsed) : []
            };
        }

        async function requestPostInteractionsWithRetry(postId, options = {}) {
            const minCommentItems = Number(options.minCommentItems) || 10;
            const minPrivateMessages = options.includePrivateMessages === false ? 0 : (Number(options.minPrivateMessages) || 2);
            let retryReason = '';
            let lastError = null;
            for (let attempt = 0; attempt < 2; attempt += 1) {
                try {
                    const result = await requestPostInteractionBatch(postId, {
                        ...options,
                        retryReason
                    });
                    const commentCount = countGeneratedCommentItems(result.comments);
                    const dmCount = result.privateMessages.length;
                    if (commentCount >= minCommentItems && dmCount >= minPrivateMessages) return result;
                    retryReason = `Previous response produced ${commentCount} comment/reply objects and ${dmCount} private-message conversations; minimums are ${minCommentItems} comments/replies and ${minPrivateMessages} private-message conversations.`;
                    lastError = new Error(retryReason);
                } catch (error) {
                    lastError = error;
                    retryReason = `Previous response failed validation: ${error?.message || error}`;
                }
            }
            throw lastError || new Error('Post interaction generation failed');
        }

        function appendGeneratedCommentsToPost(postId, comments = []) {
            const normalized = (Array.isArray(comments) ? comments : []).filter(Boolean);
            if (!normalized.length) return 0;
            const thread = getPostThread(postId);
            const seenIds = collectCommentIds(thread.comments);
            const nextComments = normalized.map((comment) => ensureUniqueGeneratedCommentIds(comment, seenIds));
            const addedCount = countGeneratedCommentItems(nextComments);
            thread.comments = [...nextComments, ...(thread.comments || [])];
            thread.commentsCount = Math.max(Number(thread.commentsCount) || 0, 0) + addedCount;
            savePostThread(postId, thread);
            updatePostCountNodes(postId, thread);
            if (String(currentDetailPostId) === String(postId)) {
                renderCommentsList(postId, thread);
                const commentsEl = document.getElementById('x-detail-comments');
                if (commentsEl) commentsEl.textContent = formatCompactCount(thread.commentsCount);
            }
            return addedCount;
        }

        function prependGeneratedPrivateMessages(privateMessages = []) {
            const normalized = (Array.isArray(privateMessages) ? privateMessages : []).filter(Boolean);
            if (!normalized.length) return 0;
            updateXState((draft) => {
                draft.xDirectMessages = [...normalized, ...(draft.xDirectMessages || [])];
            });
            renderDirectMessages();
            return normalized.length;
        }

        async function generatePostPublishInteractions(postId, options = {}) {
            const runKey = String(postId || '');
            if (!runKey || postVisionRuns.has(runKey)) return;
            postVisionRuns.add(runKey);
            try {
                try {
                    await enrichPublishedPostImages(postId, options.imageSources);
                } catch (error) {
                    console.warn('[X] Post image understanding persistence failed', error);
                }
                const result = await requestPostInteractionsWithRetry(postId, {
                    includePrivateMessages: true,
                    minCommentItems: 10,
                    minPrivateMessages: 2
                });
                const addedComments = appendGeneratedCommentsToPost(postId, result.comments);
                const addedDms = prependGeneratedPrivateMessages(result.privateMessages);
                await flushXStateNow('x-post-publish-interactions');
                if (typeof window.showToast === 'function') {
                    window.showToast(`Generated ${addedComments} replies and ${addedDms} DMs`);
                }
            } catch (error) {
                console.error('[X] Post publish interaction generation failed', error);
                if (typeof window.showToast === 'function') window.showToast('Post published, but API engagement generation failed');
            } finally {
                postVisionRuns.delete(runKey);
            }
        }

        async function advanceCurrentPostComments() {
            const postId = currentActionPostId || currentDetailPostId;
            if (!postId) return;
            const button = document.getElementById('x-post-advance-btn');
            if (button?.classList.contains('loading')) return;
            const buttonLabel = button?.querySelector('span');
            const idleLabel = buttonLabel?.textContent || 'Advance post';
            button?.classList.add('loading');
            button?.setAttribute('aria-busy', 'true');
            if (button) button.disabled = true;
            if (buttonLabel) buttonLabel.textContent = 'Generating...';
            if (typeof window.showToast === 'function') window.showToast('Generating post engagement...');
            try {
                const result = await requestPostInteractionsWithRetry(postId, {
                    includePrivateMessages: false,
                    minCommentItems: 10
                });
                const addedComments = appendGeneratedCommentsToPost(postId, result.comments);
                await flushXStateNow('x-post-advance-comments');
                closePostSettingsSheet();
                if (typeof window.showToast === 'function') {
                    window.showToast(`Advanced post with ${addedComments} new replies`);
                }
            } catch (error) {
                console.error('[X] Advance post comments failed', error);
                if (typeof window.showToast === 'function') window.showToast('Advance post failed; existing content was unchanged');
            } finally {
                button?.classList.remove('loading');
                button?.removeAttribute('aria-busy');
                if (button) button.disabled = false;
                if (buttonLabel) buttonLabel.textContent = idleLabel;
            }
        }

        async function requestAdvanceStrangerBatch(count, excludedKeys, plot, storyContext, worldbook) {
            const prompt = `Return strict JSON only: {"strangers":[{"name":"","handle":"","bio":"","translation":"","persona":"","messages":[{"text":"","translation":""},{"text":"","translation":""}]}]}.
Generate exactly ${count} unique strangers who proactively send private messages to the X user. Each stranger must send 2 to 5 incoming messages; do not write messages for the user. Messages should form a natural short sequence related to the ongoing plot.
Every message is incoming from the named stranger. Never generate an outbound User message or reuse the User identity as a stranger.
Every stranger must have a concrete reason to contact this specific User. Their identity, opening topic, tone and message details MUST reference or logically derive from the User profile/persona below, not only from the general plot. Avoid generic greetings that could be sent to anyone.
Each stranger may use the language natural to their identity. Every non-Chinese bio and message must include an accurate Simplified Chinese translation; Chinese originals use "".
Plot direction: ${plot || '随机延续当前剧情'}
User profile/persona: ${JSON.stringify({ name: currentProfile.name, handle: currentProfile.handle, bio: currentProfile.bio, persona: currentProfile.persona })}
Do not repeat these names or handles: ${excludedKeys.length ? excludedKeys.join('、') : 'None'}
Current story context: ${storyContext}
Worldbook:
${worldbook || 'None'}`;
            const raw = await requestXChatCompletion([
                { role: 'system', content: 'Generate strict JSON for fictional incoming X private messages. Output JSON only.' },
                { role: 'user', content: prompt }
            ], { temperature: 0.9 });
            const parsed = parseJsonPayload(raw);
            const strangers = sanitizeApiGeneratedAuthors(Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.strangers) ? parsed.strangers : []));
            return strangers.map(normalizeGeneratedStranger).filter(Boolean);
        }

        async function requestAdvanceTrendBatch(count, excludedKeys, plot, storyContext, worldbook) {
            const prompt = `Return strict JSON only: {"trends":[{"title":"#Topic","translation":"","category":"Category · Trending","heat":"12.3K"}]}.
Generate exactly ${count} unique new global hot-search topics that continue and evolve the existing trends and posts. New trends must be relevant to the requested plot and feel like later developments, not paraphrases.
Topics may originate from any region or language. For non-Chinese title/category text include accurate Simplified Chinese in translation; Chinese originals use "".
Plot direction: ${plot || '随机延续当前剧情'}
Do not repeat these titles: ${excludedKeys.length ? excludedKeys.join('、') : 'None'}
Current story context: ${storyContext}
Worldbook:
${worldbook || 'None'}`;
            const raw = await requestXChatCompletion([
                { role: 'system', content: 'Generate strict JSON for fictional international X hot searches. Output JSON only.' },
                { role: 'user', content: prompt }
            ], { temperature: 0.9 });
            const parsed = parseJsonPayload(raw);
            const trends = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.trends) ? parsed.trends : []);
            return normalizeTrendList(trends);
        }

        function matchTrendTitle(value, availableTrends) {
            const target = safeText(value).replace(/^#+/, '').toLocaleLowerCase();
            if (!target) return '';
            const match = availableTrends.find((trend) => trend.title.replace(/^#+/, '').toLocaleLowerCase() === target);
            return match?.title || '';
        }

        async function requestAdvancePostBatch(count, excludedKeys, plot, storyContext, worldbook, availableTrends, newTrendTitles) {
            const topicTitles = availableTrends.map((trend) => trend.title);
            const reusableAuthors = getReusableAuthorContext();
            const prompt = `Return strict JSON only: {"posts":[{"authorName":"","handle":"","text":"","translation":"","topicTag":"#精确热搜名","likes":0,"reposts":0,"commentsCount":5,"mediaType":"text","comments":[{"authorName":"","handle":"","text":"","translation":""}]}]}.
Generate exactly ${count} new international X posts that advance the current plot. Every post must use one exact topicTag from the allowed trend list and contain at least 5 valid, concrete comments in its comments array. Comments must respond to details in their own post.
Never use the current User as a generated post, comment or reply author. All generated authors must be non-User accounts.
Prefer newly generated trends while still allowing continuation of older trends. Use varied countries, languages, authors and viewpoints. Every non-Chinese post, comment and reply must include an accurate Simplified Chinese translation; Chinese originals use "".
Plot direction: ${plot || '随机延续当前剧情'}
Allowed trends: ${topicTitles.join('、')}
New trends to prioritize: ${newTrendTitles.length ? newTrendTitles.join('、') : 'None'}
Reusable existing authors (optional; when used, return their exact authorId): ${JSON.stringify(reusableAuthors)}
Do not repeat these post identifiers or summaries: ${excludedKeys.length ? excludedKeys.join('、') : 'None'}
Current story context: ${storyContext}
Worldbook:
${worldbook || 'None'}`;
            const raw = await requestXChatCompletion([
                { role: 'system', content: 'Generate strict JSON for fictional international X posts. Output JSON only.' },
                { role: 'user', content: prompt }
            ], { temperature: 0.9 });
            const parsed = parseJsonPayload(raw);
            const posts = sanitizeApiGeneratedPosts(Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.posts) ? parsed.posts : []));
            return posts.map((rawPost, index) => {
                const topicTag = matchTrendTitle(rawPost?.topicTag || rawPost?.topic || rawPost?.trend, availableTrends);
                if (!topicTag) return null;
                const post = normalizeGeneratedPost({ ...rawPost, topicTag }, index);
                if (!post || !Array.isArray(post.commentList) || post.commentList.length < 5) return null;
                post.topicTag = topicTag;
                return ensureCommentDepth(post);
            }).filter(Boolean);
        }

        async function runAdvanceGeneration() {
            const preferences = persistAdvancePreferences();
            if (!preferences.strangersEnabled && !preferences.trendsEnabled && !preferences.postsEnabled) {
                if (typeof window.showToast === 'function') window.showToast('请至少开启一项生成内容');
                return;
            }
            const plot = safeText(advancePlotInput?.value);
            setAdvanceLoading(true);
            try {
                const state = getXState();
                const storyContext = buildAdvanceStoryContext(state);
                const worldbook = getSelectedWorldBookContext(`${plot} ${currentProfile.bio} ${currentProfile.persona}`);
                const existingTrends = normalizeTrendList(state.xTrends || []);
                let newTrends = [];
                let newPosts = [];
                let newStrangers = [];

                if (preferences.trendsEnabled) {
                    newTrends = await collectExactGeneratedItems({
                        total: preferences.trendsCount,
                        batchSize: 10,
                        blockedKeys: existingTrends.map((trend) => trend.title),
                        getKey: (trend) => trend.title,
                        requestBatch: (count, excluded) => requestAdvanceTrendBatch(count, excluded, plot, storyContext, worldbook),
                        label: 'Trends'
                    });
                    newTrends = newTrends.map((trend) => ({ ...trend, movement: 'up' }));
                }

                const shiftedTrends = preferences.trendsEnabled
                    ? existingTrends.map((trend) => ({ ...trend, movement: 'down' }))
                    : existingTrends;
                const availableTrends = normalizeTrendList([...newTrends, ...shiftedTrends]).slice(0, maxXTrends);
                if (preferences.postsEnabled) {
                    if (availableTrends.length === 0) throw new Error('No trends available for generated posts');
                    newPosts = await collectExactGeneratedItems({
                        total: preferences.postsCount,
                        batchSize: 5,
                        getKey: (post) => `${post.name}|${post.text}`,
                        requestBatch: (count, excluded) => requestAdvancePostBatch(
                            count,
                            excluded,
                            plot,
                            storyContext,
                            worldbook,
                            availableTrends,
                            newTrends.map((trend) => trend.title)
                        ),
                        label: 'Posts'
                    });
                }

                if (preferences.strangersEnabled) {
                    const existingDmKeys = (state.xDirectMessages || []).map((item) => `${safeText(item.name)}|${safeText(item.handle)}`);
                    newStrangers = await collectExactGeneratedItems({
                        total: preferences.strangersCount,
                        batchSize: 10,
                        blockedKeys: existingDmKeys,
                        getKey: (item) => `${item.name}|${item.handle}`,
                        requestBatch: (count, excluded) => requestAdvanceStrangerBatch(count, excluded, plot, storyContext, worldbook),
                        label: 'Strangers'
                    });
                }

                saveXState({
                    ...state,
                    xAdvancePreferences: preferences,
                    xTrends: availableTrends,
                    xGeneratedPosts: prependUniquePosts(state.xGeneratedPosts, newPosts),
                    xDirectMessages: [...newStrangers, ...(state.xDirectMessages || [])]
                });
                await flushXStateNow('x-advance-generation');
                renderTrends();
                renderGeneratedPosts();
                renderDirectMessages();
                setAdvanceLoading(false);
                closeAdvanceSheet();
                if (typeof window.showToast === 'function') {
                    window.showToast(`已生成 ${newStrangers.length} 个陌生人、${newTrends.length} 条热搜、${newPosts.length} 条帖子`);
                }
            } catch (error) {
                console.error('[X] Advance generation failed', error);
                if (typeof window.showToast === 'function') window.showToast('推进失败，未修改现有内容');
            } finally {
                setAdvanceLoading(false);
            }
        }

        function updateIndicator(targetItem) {
            if (!indicator || !targetItem) return;
            const nav = targetItem.parentElement;
            if (!nav) return;

            const navRect = nav.getBoundingClientRect();
            const itemRect = targetItem.getBoundingClientRect();
            indicator.style.left = `${itemRect.left - navRect.left}px`;
            indicator.style.width = `${itemRect.width}px`;
        }

        function renderVisibleXTab(index = currentIndex, state = getXState(), options = {}) {
            syncCurrentProfile(state);
            const target = navItems[index]?.getAttribute('data-target');
            if (target === 'x-home-tab') {
                renderGeneratedPosts(state, { resetLimit: !!options.resetHomeFeed, force: !!options.force });
                return;
            }
            if (target === 'x-super-tab') {
                renderSuperFollowBar(state);
                return;
            }
            if (target === 'x-discover-tab') {
                renderTrends(state);
                return;
            }
            if (target === 'x-messages-tab') {
                renderDirectMessages(state);
                return;
            }
            if (target === 'x-me-tab') {
                renderProfile(state);
            }
        }

        function switchTab(index, options = {}) {
            if (index < 0 || index >= navItems.length) return;
            currentIndex = index;
            view.scrollTop = 0;
            const state = options.state || getXState();

            navItems.forEach((item, itemIndex) => {
                item.classList.toggle('active', itemIndex === index);
            });

            tabs.forEach((tab, tabIndex) => {
                tab.classList.toggle('active', tabIndex === index);
                tab.style.transform = `translateX(-${index * 100}%)`;
            });

            updateIndicator(navItems[index]);
            renderVisibleXTab(index, state, options);
            closePostDetail();
        }

        function switchButtonTabs(buttons, panels, buttonAttr, panelAttr, nextValue) {
            buttons.forEach((button) => {
                button.classList.toggle('active', button.getAttribute(buttonAttr) === nextValue);
            });
            panels.forEach((panel) => {
                panel.classList.toggle('active', panel.getAttribute(panelAttr) === nextValue);
            });
        }

        function openPostDetail(postId) {
            const post = postData[postId] || postData.island;
            currentDetailPostId = postId;
            const detailPost = document.getElementById('x-detail-post');
            const thread = getPostThread(postId);

            if (detailPost) {
                detailPost.innerHTML = `
                    <div class="x-detail-author">
                        ${buildAuthorAvatarButton(post, 'x-avatar')}
                        <div>
                            <strong>${escapeHtml(post.name)}</strong>
                            <span>${escapeHtml(post.handle)}</span>
                        </div>
                    </div>
                    <p class="x-detail-text">${renderPostTextHtml(post)}</p>
                    ${buildExpandableTranslationHtml(post.translation, 'x-post-translation-toggle')}
                    ${renderPostImages(getPostImages(post))}
                    <div class="x-detail-inline-actions">
                        <button id="x-detail-repost-btn" type="button" class="x-detail-inline-action ${thread.reposted ? 'active' : ''}" aria-label="Repost">
                            <i class="fas fa-retweet"></i><span>${escapeHtml(formatCompactCount(thread.reposts))}</span>
                        </button>
                        <button id="x-detail-like-btn" type="button" class="x-detail-inline-action ${thread.liked ? 'active' : ''}" aria-label="Like">
                            <i class="${thread.liked ? 'fas' : 'far'} fa-heart"></i><span>${escapeHtml(formatCompactCount(thread.likes))}</span>
                        </button>
                    </div>
                `;
            }

            const repostsEl = document.getElementById('x-detail-reposts');
            const likesEl = document.getElementById('x-detail-likes');
            const commentsEl = document.getElementById('x-detail-comments');
            if (repostsEl) repostsEl.textContent = formatCompactCount(thread.reposts);
            if (likesEl) likesEl.textContent = formatCompactCount(thread.likes);
            if (commentsEl) commentsEl.textContent = formatCompactCount(thread.commentsCount);
            renderDetailActions(thread);
            renderReplyContext();
            renderCommentsList(postId, thread);
            updatePostCountNodes(postId, thread);

            if (postDetailView) postDetailView.style.zIndex = topicDetailView?.classList.contains('active') ? '94' : '90';
            postDetailView?.classList.add('active');
            postDetailView?.setAttribute('aria-hidden', 'false');
        }

        function closePostDetail() {
            if (postDetailView?.contains(document.activeElement)) {
                document.activeElement.blur();
            }
            postDetailView?.classList.remove('active');
            postDetailView?.setAttribute('aria-hidden', 'true');
            if (postDetailView) postDetailView.style.zIndex = '90';
            currentDetailPostId = null;
            replyTarget = null;
        }

        function bindPostCard(card) {
            const postId = card.getAttribute('data-post-id');
            if (!postId || card.dataset.xBound === 'true') return;
            card.dataset.xBound = 'true';
            card.addEventListener('click', (event) => {
                if (event.target.closest('.x-post-image-thumb, .x-author-avatar-btn, .x-feed-forward-btn, .x-post-topic-link, .x-translation-toggle')) return;
                
                const ref = event.target.closest('.x-ref-post');
                if (ref) {
                    event.stopPropagation();
                    openPostDetail(ref.dataset.refId);
                    return;
                }
                
                if (card.classList.contains('is-moment')) return;
                
                openPostDetail(postId);
            });
            card.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    if (card.classList.contains('is-moment')) return;
                    openPostDetail(postId);
                }
            });
        }

        function scheduleXOpenMaintenance() {
            if (xOpenMaintenancePromise) return xOpenMaintenancePromise;
            const run = async () => {
                const beforeRevision = typeof window.getAppStateRevision === 'function'
                    ? window.getAppStateRevision('x')
                    : fallbackXStateRevision;
                await ensureXPlayerAccountMigration();
                await migrateActiveXCharIdentities();
                await migrateActiveXCharProfileMedia();
                const afterRevision = typeof window.getAppStateRevision === 'function'
                    ? window.getAppStateRevision('x')
                    : fallbackXStateRevision;
                if (view.classList.contains('active') && afterRevision !== beforeRevision) {
                    renderVisibleXTab(currentIndex, getXState(), { force: true });
                }
            };
            xOpenMaintenancePromise = new Promise((resolve) => {
                const start = () => run().catch((error) => {
                    console.warn('[X] Deferred open maintenance failed', error);
                }).finally(() => {
                    xOpenMaintenancePromise = null;
                    resolve();
                });
                if (typeof window.requestIdleCallback === 'function') {
                    window.requestIdleCallback(start, { timeout: 750 });
                } else {
                    setTimeout(start, 0);
                }
            });
            return xOpenMaintenancePromise;
        }

        async function openXApp(event) {
            if (event) event.stopPropagation();
            if (window.isJiggleMode) return;
            if (window.globalDataReadyPromise) await window.globalDataReadyPromise;
            view.scrollTop = 0;
            view.classList.add('active');
            ensureXEventBindings();
            xHomeFeedRenderLimit = xHomeFeedInitialLimit;
            const state = getXState();
            syncCurrentProfile(state);
            requestAnimationFrame(() => {
                switchTab(currentIndex, { state, resetHomeFeed: true });
                scheduleXOpenMaintenance();
            });
        }

        function closeXApp() {
            closeTopicDetail();
            closePostDetail();
            closeEditProfile();
            closeAccountSwitchSheet();
            closeCreateTopicSheet();
            closeXSettings();
            closeComposer();
            closeVisitorsSheet();
            closeAddDmSheet();
            closeDmChat();
            closeDmSettingsSheet();
            closeDmProfile();
            closeSearchGenerateSheet();
            closeAdvanceSheet();
            closeCharEditSheet();
            closeCharProfileGenerateSheet();
            closeEditSuperTopicSheet();
            closePostForwardSheet();
            closeImagePreview();
            view.classList.remove('active');
            flushXStateNow('x-close');
        }

        function readXImageFile(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
                reader.readAsDataURL(file);
            });
        }

        function loadXImage(dataUrl) {
            return new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = () => reject(new Error('解析图片失败'));
                image.src = dataUrl;
            });
        }

        async function compressXImageFile(file, options = xImageCompressionPresets.post) {
            const declaredMimeType = String(file?.type || '').toLowerCase();
            const fileName = String(file?.name || '').toLowerCase();
            const inferredMimeType = /\.png$/.test(fileName)
                ? 'image/png'
                : (/\.jpe?g$/.test(fileName) ? 'image/jpeg' : '');
            const sourceMimeType = declaredMimeType || inferredMimeType;
            if (!file || !xAcceptedImageTypes.has(sourceMimeType)) {
                throw new Error('仅支持 JPG、JPEG 或 PNG 图片');
            }
            const rawDataUrl = await readXImageFile(file);
            const image = await loadXImage(rawDataUrl);
            const width = image.naturalWidth || image.width || 0;
            const height = image.naturalHeight || image.height || 0;
            if (!width || !height) throw new Error('无法读取图片尺寸');

            const scale = Math.min(1, options.maxWidth / width, options.maxHeight / height);
            const targetWidth = Math.max(1, Math.round(width * scale));
            const targetHeight = Math.max(1, Math.round(height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const context = canvas.getContext('2d');
            if (!context) throw new Error('当前浏览器无法压缩图片');
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
            context.drawImage(image, 0, 0, targetWidth, targetHeight);
            const outputMimeType = sourceMimeType === 'image/png' ? 'image/png' : 'image/jpeg';
            const compressedDataUrl = outputMimeType === 'image/png'
                ? canvas.toDataURL(outputMimeType)
                : canvas.toDataURL(outputMimeType, options.quality ?? 0.82);
            if (!compressedDataUrl.startsWith(`data:${outputMimeType}`)) {
                throw new Error(`${outputMimeType === 'image/png' ? 'PNG' : 'JPG'} 压缩失败`);
            }
            return compressedDataUrl;
        }

        function bindFilePreview(input, options, onLoad) {
            input?.addEventListener('change', async () => {
                const file = input.files && input.files[0];
                if (!file) return;
                input.disabled = true;
                try {
                    const src = await compressXImageFile(file, options);
                    onLoad(src);
                } catch (error) {
                    console.warn('[X] Image compression failed', error);
                    if (typeof window.showToast === 'function') {
                        window.showToast(error?.message || '图片压缩失败，请重新选择');
                    }
                } finally {
                    input.value = '';
                    input.disabled = false;
                }
            });
        }

        appButton.addEventListener('click', openXApp);

        function ensureXEventBindings() {
            if (xEventsInitialized) return;
            xEventsInitialized = true;
            ensureXChrome();

            closeButtons.forEach((button) => button.addEventListener('click', closeXApp));
        navItems.forEach((item, index) => item.addEventListener('click', () => switchTab(index)));

        view.querySelectorAll('.x-feed-card[data-post-id]').forEach(bindPostCard);
        postDetailBack?.addEventListener('click', closePostDetail);
        topicDetailBack?.addEventListener('click', closeTopicDetail);
        topicDetailGenerateBtn?.addEventListener('click', generateTopicPosts);
        settingsButton?.addEventListener('click', openXSettings);
        document.getElementById('x-profile-visitors-btn')?.addEventListener('click', openVisitorsSheet);
        document.getElementById('x-visitors-close-btn')?.addEventListener('click', closeVisitorsSheet);
        document.getElementById('x-add-dm-btn')?.addEventListener('click', openAddDmSheet);
        document.getElementById('x-add-dm-close-btn')?.addEventListener('click', closeAddDmSheet);
        document.getElementById('x-manual-char-add-btn')?.addEventListener('click', addManualChar);
        nextDayBtn?.addEventListener('click', openAdvanceSheet);

        document.getElementById('x-search-generate-btn')?.addEventListener('click', () => openSearchGenerateSheet('home'));
        document.getElementById('x-discover-search-btn')?.addEventListener('click', () => openSearchGenerateSheet('discover'));
        document.getElementById('x-search-generate-close-btn')?.addEventListener('click', closeSearchGenerateSheet);
        document.getElementById('x-search-generate-run-btn')?.addEventListener('click', runSearchGeneration);
        document.getElementById('x-advance-close-btn')?.addEventListener('click', closeAdvanceSheet);
        document.getElementById('x-advance-run-btn')?.addEventListener('click', runAdvanceGeneration);
        ['x-advance-strangers-toggle', 'x-advance-trends-toggle', 'x-advance-posts-toggle'].forEach((id) => {
            document.getElementById(id)?.addEventListener('change', () => {
                syncAdvanceControls();
                persistAdvancePreferences();
            });
        });
        ['x-advance-strangers-count', 'x-advance-trends-count', 'x-advance-posts-count'].forEach((id) => {
            const input = document.getElementById(id);
            input?.addEventListener('input', persistAdvancePreferences);
            input?.addEventListener('change', () => {
                persistAdvancePreferences();
                populateAdvanceControls();
            });
        });
        document.getElementById('x-post-settings-close-btn')?.addEventListener('click', closePostSettingsSheet);
        document.getElementById('x-post-advance-btn')?.addEventListener('click', advanceCurrentPostComments);
        document.getElementById('x-post-delete-btn')?.addEventListener('click', deleteTargetPost);
        document.getElementById('x-post-detail-menu-btn')?.addEventListener('click', () => {
            if (currentDetailPostId) openPostSettingsSheet(currentDetailPostId);
        });
        document.getElementById('x-dm-chat-back')?.addEventListener('click', closeDmChat);
        document.getElementById('x-dm-chat-menu-btn')?.addEventListener('click', openDmSettingsSheet);
        document.getElementById('x-dm-settings-close-btn')?.addEventListener('click', closeDmSettingsSheet);
        document.getElementById('x-dm-imessage-context-enabled')?.addEventListener('change', (event) => {
            updateCurrentDmImessageContext({ enabled: event.target.checked });
        });
        document.getElementById('x-dm-imessage-context-limit')?.addEventListener('change', (event) => {
            updateCurrentDmImessageContext({ limit: event.target.value });
        });
        document.getElementById('x-dm-clear-chat-btn')?.addEventListener('click', clearCurrentDmChat);
        document.getElementById('x-dm-delete-chat-btn')?.addEventListener('click', deleteCurrentDmChat);
        document.getElementById('x-dm-profile-back')?.addEventListener('click', closeDmProfile);
        document.getElementById('x-char-edit-close-btn')?.addEventListener('click', closeCharEditSheet);
        document.getElementById('x-char-edit-save-btn')?.addEventListener('click', saveCharEdit);
        document.getElementById('x-char-random-cover-btn')?.addEventListener('click', refreshCharEditCover);
        document.getElementById('x-char-edit-avatar-preview')?.addEventListener('click', () => document.getElementById('x-char-edit-avatar-input')?.click());
        document.getElementById('x-char-edit-cover-preview')?.addEventListener('click', () => document.getElementById('x-char-edit-cover-input')?.click());
        document.getElementById('x-char-profile-generate-close-btn')?.addEventListener('click', closeCharProfileGenerateSheet);
        document.getElementById('x-char-profile-generate-run-btn')?.addEventListener('click', generateCurrentCharProfile);
        document.getElementById('x-char-profile-image-toggle')?.addEventListener('change', syncCharProfileImageOptions);
        document.getElementById('x-char-profile-image-preset')?.addEventListener('change', (event) => applyCharProfilePromptPreset(event.target.value));
        document.getElementById('x-char-profile-preset-save')?.addEventListener('click', saveCharProfilePromptPreset);
        document.getElementById('x-char-profile-preset-delete')?.addEventListener('click', deleteCharProfilePromptPreset);
        document.getElementById('x-char-profile-reference-preview')?.addEventListener('click', () => document.getElementById('x-char-profile-reference-input')?.click());
        document.getElementById('x-char-profile-reference-input')?.addEventListener('change', loadCharProfileReferenceFile);
        document.getElementById('x-char-profile-reference-delete')?.addEventListener('click', removeCharProfileReferenceDraft);
        document.getElementById('x-edit-super-topic-close-btn')?.addEventListener('click', closeEditSuperTopicSheet);
        document.getElementById('x-edit-super-topic-save-btn')?.addEventListener('click', saveEditedSuperTopic);
        document.getElementById('x-edit-super-topic-delete-btn')?.addEventListener('click', deleteEditedSuperTopic);
        document.getElementById('x-edit-super-topic-avatar-preview')?.addEventListener('click', () => document.getElementById('x-edit-super-topic-avatar-input')?.click());
        document.getElementById('x-edit-super-topic-banner-preview')?.addEventListener('click', () => document.getElementById('x-edit-super-topic-banner-input')?.click());
        document.getElementById('x-edit-topic-import-imessage-btn')?.addEventListener('click', toggleEditTopicImportImessage);
        document.getElementById('x-edit-topic-manual-char-btn')?.addEventListener('click', toggleEditTopicManualChar);
        document.getElementById('x-edit-topic-manual-save-btn')?.addEventListener('click', saveEditTopicManualChar);
        document.getElementById('x-post-forward-close-btn')?.addEventListener('click', closePostForwardSheet);
        document.getElementById('x-dm-chat-composer')?.addEventListener('submit', (event) => {
            event.preventDefault();
            sendDmUserMessage();
        });
        document.getElementById('x-dm-chat-send-btn')?.addEventListener('click', (event) => {
            event.preventDefault();
            sendDmUserMessage();
        });
        document.getElementById('x-dm-chat-api-btn')?.addEventListener('click', generateDmApiReply);
        window.mobileInputCompat?.register({
            input: document.getElementById('x-dm-chat-input'),
            root: dmChatView,
            scrollContainer: dmChatMessagesEl,
            onSend: sendDmUserMessage,
            allowEmpty: true,
            blurAfterSend: true
        });
        document.getElementById('x-image-preview-close')?.addEventListener('click', closeImagePreview);
        document.getElementById('x-reply-submit-btn')?.addEventListener('click', submitReply);
        document.getElementById('x-reply-cancel-btn')?.addEventListener('click', () => setReplyTarget(null));
        document.getElementById('x-reply-input')?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.isComposing && event.keyCode !== 229) {
                event.preventDefault();
                submitReply();
                event.target.blur();
            }
        });
        editCancelButton?.addEventListener('click', closeEditProfile);
        editSaveButton?.addEventListener('click', saveProfile);
        settingsCloseButton?.addEventListener('click', closeXSettings);
        settingsWorldBookButton?.addEventListener('click', openWorldBookSelector);
        document.getElementById('x-settings-clear-data-btn')?.addEventListener('click', resetAllXData);
        composeCancelButton?.addEventListener('click', closeComposer);
        composeSubmitButton?.addEventListener('click', submitComposer);
        composeImageButton?.addEventListener('click', () => composeImageInput?.click());
        composeImageUrlButton?.addEventListener('click', addComposeImageUrl);
        composeImageUrlInput?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                addComposeImageUrl();
            }
        });
        composeImageClearButton?.addEventListener('click', () => {
            composeImageDraft = '';
            if (composeImageInput) composeImageInput.value = '';
            if (composeImageUrlInput) composeImageUrlInput.value = '';
            renderComposeImageDraft();
        });
        document.querySelector('.x-compose-button')?.addEventListener('click', () => openComposer());
        document.querySelector('.x-post-button')?.addEventListener('click', () => openComposer());
        document.getElementById('x-super-compose-btn')?.addEventListener('click', () => {
            if (currentActiveTopicId) openComposer({ superTopicId: currentActiveTopicId });
        });
        composeSuperChip?.addEventListener('click', () => {
            if (currentComposeSuperId) openSuperTopicById(currentComposeSuperId);
        });
        editAvatarPreview?.addEventListener('click', () => editAvatarInput?.click());
        editBannerPreview?.addEventListener('click', () => editBannerInput?.click());

        view.addEventListener('click', (event) => {
            const translationToggle = event.target.closest('.x-translation-toggle');
            if (translationToggle) {
                event.preventDefault();
                event.stopPropagation();
                let translationText = translationToggle.nextElementSibling;
                if (!translationText?.classList.contains('x-translation-text')) {
                    translationText = translationToggle.closest('.x-comment-action-row')?.nextElementSibling;
                }
                if (!translationText?.classList.contains('x-translation-text')) return;
                const willExpand = translationText.hidden;
                translationText.hidden = !willExpand;
                translationToggle.setAttribute('aria-expanded', String(willExpand));
                translationToggle.textContent = willExpand ? '收起翻译' : '翻译';
                return;
            }
            const translationBubble = event.target.closest('.x-dm-translation-bubble');
            if (translationBubble) {
                event.preventDefault();
                event.stopPropagation();
                const translationText = translationBubble.querySelector('.x-dm-expanded-translation');
                if (!translationText) return;
                const willExpand = translationText.hidden;
                translationText.hidden = !willExpand;
                translationBubble.setAttribute('aria-expanded', String(willExpand));
                translationBubble.classList.toggle('translated', willExpand);
                translationBubble.title = willExpand ? '点击收起翻译' : '点击展开翻译';
                return;
            }
            const topicLink = event.target.closest('.x-post-topic-link[data-topic-tag]');
            if (topicLink) {
                event.preventDefault();
                event.stopPropagation();
                closePostDetail();
                openTopicDetail(topicLink.dataset.topicTag);
                return;
            }
            const accountSwitchTrigger = event.target.closest('#x-account-switch-trigger');
            if (accountSwitchTrigger) {
                event.preventDefault();
                event.stopPropagation();
                openAccountSwitchSheet();
                return;
            }
            const accountSwitchClose = event.target.closest('#x-account-switch-close-btn');
            if (accountSwitchClose) {
                event.preventDefault();
                closeAccountSwitchSheet();
                return;
            }
            const addAccountButton = event.target.closest('#x-account-add-btn');
            if (addAccountButton) {
                event.preventDefault();
                closeAccountSwitchSheet();
                openEditProfile('create');
                return;
            }
            const accountRow = event.target.closest('[data-x-player-account-id]');
            if (accountRow) {
                event.preventDefault();
                void switchXPlayerAccount(accountRow.dataset.xPlayerAccountId);
                return;
            }
            const selfProfileEdit = event.target.closest('#x-profile-edit-btn');
            if (selfProfileEdit) {
                event.preventDefault();
                openEditProfile();
                return;
            }
            const authorButton = event.target.closest('.x-author-avatar-btn');
            if (authorButton) {
                event.preventDefault();
                event.stopPropagation();
                openAuthorProfile(
                    authorButton.dataset.xAuthorId,
                    authorButton.dataset.xAuthorName,
                    authorButton.dataset.xAuthorHandle,
                    authorButton.dataset.xAuthorAvatar
                );
                return;
            }
            const profileFollow = event.target.closest('[data-profile-follow-id]');
            if (profileFollow) {
                event.preventDefault();
                toggleProfileFollow(profileFollow.dataset.profileFollowId);
                return;
            }
            const profileEdit = event.target.closest('[data-profile-edit-id]');
            if (profileEdit) {
                event.preventDefault();
                openCharEditSheet(profileEdit.dataset.profileEditId);
                return;
            }
            const profileGenerate = event.target.closest('#x-char-profile-generate-btn');
            if (profileGenerate) {
                event.preventDefault();
                openCharProfileGenerateSheet(currentProfileIdentity?.id);
                return;
            }
            const forwardButton = event.target.closest('.x-feed-forward-btn');
            if (forwardButton) {
                event.preventDefault();
                event.stopPropagation();
                openPostForwardSheet(forwardButton.dataset.postId || forwardButton.closest('[data-post-id]')?.dataset.postId);
                return;
            }
            const forwardRecipient = event.target.closest('.x-post-forward-recipient[data-forward-dm-id]');
            if (forwardRecipient) {
                event.preventDefault();
                forwardPostToDm(forwardRecipient.dataset.forwardDmId);
                return;
            }
            const dmProfileBack = event.target.closest('#x-dm-profile-back');
            if (dmProfileBack) {
                event.preventDefault();
                closeDmProfile();
                return;
            }
            const profileTab = event.target.closest('.x-unified-profile-tabs button[data-x-profile-tab]');
            if (profileTab) {
                event.preventDefault();
                const nextTab = profileTab.getAttribute('data-x-profile-tab');
                const profileRoot = profileTab.closest('#x-profile-scroll, .x-dm-profile-scroll');
                const tabButtons = Array.from(profileRoot?.querySelectorAll('.x-unified-profile-tabs button[data-x-profile-tab]') || []);
                const panels = Array.from(profileRoot?.querySelectorAll('.x-profile-panel[data-x-profile-panel]') || []);
                switchButtonTabs(tabButtons, panels, 'data-x-profile-tab', 'data-x-profile-panel', nextTab);
                return;
            }
            const imageButton = event.target.closest('.x-post-image-thumb');
            if (imageButton) {
                event.preventDefault();
                event.stopPropagation();
                openImagePreview(imageButton.dataset.imageText || 'Image', imageButton.dataset.imageUrl || '');
                return;
            }
            const detailLike = event.target.closest('#x-detail-like-btn');
            if (detailLike) {
                event.preventDefault();
                toggleDetailAction('like');
                return;
            }
            const detailRepost = event.target.closest('#x-detail-repost-btn');
            if (detailRepost) {
                event.preventDefault();
                openPostForwardSheet(currentDetailPostId);
                return;
            }
            const dmRow = event.target.closest('.x-dm-row[data-dm-id]');
            if (dmRow) {
                event.preventDefault();
                openDmChat(dmRow.dataset.dmId);
                return;
            }
            const emptyAddDmButton = event.target.closest('.x-empty-add-dm-btn');
            if (emptyAddDmButton) {
                event.preventDefault();
                openAddDmSheet();
                return;
            }
            const dmProfileButton = event.target.closest('[data-dm-profile-id]');
            if (dmProfileButton) {
                event.preventDefault();
                openDmProfile(dmProfileButton.dataset.dmProfileId);
                return;
            }
            const closeTrigger = event.target.closest('[data-x-close]');
            if (closeTrigger) {
                event.preventDefault();
                closeXApp();
                return;
            }
            const deleteCommentButton = event.target.closest('.x-comment-delete-btn');
            if (deleteCommentButton) {
                event.preventDefault();
                event.stopPropagation();
                deletePostComment(deleteCommentButton.dataset.commentId, deleteCommentButton.dataset.replyId || '');
                return;
            }
            const replyButton = event.target.closest('.x-comment-reply-btn');
            if (replyButton) {
                event.preventDefault();
                const commentId = replyButton.dataset.commentId;
                const replyId = replyButton.dataset.replyId || '';
                let targetName = safeText(replyButton.dataset.replyName);
                if (!targetName && currentDetailPostId) {
                    const thread = getPostThread(currentDetailPostId);
                    const comment = findCommentById(thread, commentId);
                    targetName = replyId
                        ? safeText(findReplyById(comment, replyId)?.name, comment?.name || 'comment')
                        : safeText(comment?.name, 'comment');
                }
                setReplyTarget({ commentId, replyId, name: targetName });
                return;
            }
            const trendRow = event.target.closest('.x-trend-row');
            if (trendRow) {
                const topic = trendRow.dataset.trendTitle || trendRow.querySelector('strong')?.textContent.trim();
                if (topic) openTopicDetail(topic);
                return;
            }

            const signBtn = event.target.closest('.x-super-title-row button');
            if (signBtn && !signBtn.disabled && currentActiveTopicId) {
                event.preventDefault();
                handleTopicSign(currentActiveTopicId);
                return;
            }
        });

        view.addEventListener('keydown', (event) => {
            const trendRow = event.target.closest?.('.x-trend-row');
            if (!trendRow || (event.key !== 'Enter' && event.key !== ' ')) return;
            event.preventDefault();
            const topic = trendRow.dataset.trendTitle || trendRow.querySelector('strong')?.textContent.trim();
            if (topic) openTopicDetail(topic);
        });

        [visitorsSheet, addDmSheet, dmSettingsSheet, searchGenerateSheet, advanceSheet, imagePreviewOverlay, createTopicSheet, postSettingsSheet, charEditSheet, editSuperTopicSheet, postForwardSheet].forEach((sheet) => {
            sheet?.addEventListener('click', (event) => {
                if (event.target === sheet) {
                    if (sheet === visitorsSheet) closeVisitorsSheet();
                    if (sheet === addDmSheet) closeAddDmSheet();
                    if (sheet === dmSettingsSheet) closeDmSettingsSheet();
                    if (sheet === searchGenerateSheet) closeSearchGenerateSheet();
                    if (sheet === advanceSheet) closeAdvanceSheet();
                    if (sheet === imagePreviewOverlay) closeImagePreview();
                    if (sheet === createTopicSheet) closeCreateTopicSheet();
                    if (sheet === postSettingsSheet) closePostSettingsSheet();
                    if (sheet === charEditSheet) closeCharEditSheet();
                    if (sheet === editSuperTopicSheet) closeEditSuperTopicSheet();
                    if (sheet === postForwardSheet) closePostForwardSheet();
                }
            });
        });

        createTopicCancelBtn?.addEventListener('click', closeCreateTopicSheet);
        createTopicSaveBtn?.addEventListener('click', saveTopic);
        createTopicImportBtn?.addEventListener('click', toggleTopicImportImessage);
        createTopicManualBtn?.addEventListener('click', toggleTopicManualChar);
        topicManualSaveBtn?.addEventListener('click', saveTopicManualChar);
        superUpdateBtn?.addEventListener('click', generateSuperTopicUpdate);

        createTopicAvatarPreview?.addEventListener('click', () => createTopicAvatarInput?.click());
        bindFilePreview(createTopicAvatarInput, xImageCompressionPresets.avatar, (src) => {
            createTopicAvatarDraft = src;
            renderImagePreview(createTopicAvatarPreview, src, '超');
        });

        createTopicBannerPreview?.addEventListener('click', () => createTopicBannerInput?.click());
        bindFilePreview(createTopicBannerInput, xImageCompressionPresets.cover, (src) => {
            createTopicBannerDraft = src;
            renderImagePreview(createTopicBannerPreview, src, 'Cover');
        });

        bindFilePreview(editAvatarInput, xImageCompressionPresets.avatar, (src) => {
            avatarDraft = src;
            renderImagePreview(editAvatarPreview, avatarDraft, safeText(editNameInput?.value, 'U').slice(0, 1).toUpperCase());
        });

        bindFilePreview(editBannerInput, xImageCompressionPresets.cover, (src) => {
            bannerDraft = src;
            renderImagePreview(editBannerPreview, bannerDraft, 'Cover');
        });

        bindFilePreview(document.getElementById('x-char-edit-avatar-input'), xImageCompressionPresets.avatar, (src) => {
            charEditAvatarDraft = src;
            renderImagePreview(
                document.getElementById('x-char-edit-avatar-preview'),
                charEditAvatarDraft,
                safeText(document.getElementById('x-char-edit-name')?.value, 'C').slice(0, 1).toUpperCase()
            );
        });

        bindFilePreview(document.getElementById('x-char-edit-cover-input'), xImageCompressionPresets.cover, (src) => {
            charEditCoverImageDraft = src;
            renderImagePreview(document.getElementById('x-char-edit-cover-preview'), src, 'Cover');
        });

        bindFilePreview(document.getElementById('x-edit-super-topic-avatar-input'), xImageCompressionPresets.avatar, (src) => {
            editSuperTopicAvatarDraft = src;
            renderImagePreview(document.getElementById('x-edit-super-topic-avatar-preview'), src, '超');
        });

        bindFilePreview(document.getElementById('x-edit-super-topic-banner-input'), xImageCompressionPresets.cover, (src) => {
            editSuperTopicBannerDraft = src;
            renderImagePreview(document.getElementById('x-edit-super-topic-banner-preview'), src, 'Cover');
        });

        bindFilePreview(composeImageInput, xImageCompressionPresets.post, (src) => {
            composeImageDraft = src;
            renderComposeImageDraft();
        });

        const homeFeedButtons = Array.from(view.querySelectorAll('.x-home-feed-tabs button[data-feed]'));
        const homeFeedPanels = Array.from(view.querySelectorAll('.x-feed-panel[data-feed-panel]'));
        homeFeedButtons.forEach((button) => {
            button.addEventListener('click', () => {
                switchButtonTabs(homeFeedButtons, homeFeedPanels, 'data-feed', 'data-feed-panel', button.getAttribute('data-feed'));
            });
        });

        const superTabButtons = Array.from(view.querySelectorAll('#x-super-profile-tabs button[data-super-tab]'));
        const superPanels = Array.from(view.querySelectorAll('.x-super-feed[data-super-panel]'));
        superTabButtons.forEach((button) => {
            button.addEventListener('click', () => {
                switchButtonTabs(superTabButtons, superPanels, 'data-super-tab', 'data-super-panel', button.getAttribute('data-super-tab'));
            });
        });

        if (mainContent) {
            mainContent.addEventListener('touchstart', (event) => {
                if (postDetailView?.classList.contains('active')) return;
                if (!event.touches || event.touches.length === 0) return;
                touchStartX = event.touches[0].clientX;
                touchStartY = event.touches[0].clientY;
                isTouching = true;
            }, { passive: true });

            mainContent.addEventListener('touchend', (event) => {
                if (!isTouching || !event.changedTouches || event.changedTouches.length === 0) return;
                isTouching = false;

                const endX = event.changedTouches[0].clientX;
                const endY = event.changedTouches[0].clientY;
                const diffX = touchStartX - endX;
                const diffY = touchStartY - endY;

                if (Math.abs(diffX) < 52 || Math.abs(diffX) < Math.abs(diffY) * 1.25) return;

                if (diffX > 0) {
                    switchTab(Math.min(currentIndex + 1, navItems.length - 1));
                } else {
                    switchTab(Math.max(currentIndex - 1, 0));
                }
            }, { passive: true });
        }

        window.addEventListener('resize', () => {
            if (!view.classList.contains('active')) return;
            updateIndicator(navItems[currentIndex]);
        });
        
        view.querySelectorAll('.x-scroll-area, .x-detail-scroll').forEach(area => {
            area.addEventListener('scroll', () => {
                if (area.scrollTop + area.clientHeight >= area.scrollHeight - 160) {
                    if (area.closest('#x-home-tab')) {
                        loadMoreHomeFeedPosts();
                    }
                    const hiddens = area.querySelectorAll('.x-hidden-page-2');
                    if (hiddens.length > 0) {
                        hiddens.forEach(el => {
                            el.style.display = '';
                            el.classList.remove('x-hidden-page-2');
                        });
                    }
                }
            }, { passive: true });
        });

        }
    });
})();
