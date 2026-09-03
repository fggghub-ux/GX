// --- Video Player Logic ---
    const playerView = document.getElementById('yt-video-player-view');
    const playerBackBtn = document.getElementById('yt-player-back-btn');
    const ytPlayerVideoArea = document.getElementById('yt-player-video-area');
    const ytPlayerThumbnail = document.getElementById('yt-player-thumbnail');
    const ytCharSpeechBubble = document.getElementById('yt-char-speech-bubble');
    const ytCharLiveConnectionCard = document.getElementById('yt-char-live-connection-card');
    const ytPlayerConnectBtn = document.getElementById('yt-player-connect-btn');
    const ytPlayerReplayCommentsBtn = document.getElementById('yt-player-replay-comments-btn');
    const ytPlayerDeleteVideoBtn = document.getElementById('yt-player-delete-video-btn');
    const ytCharLiveLotteryModal = document.getElementById('yt-char-live-lottery-modal');
    const ytCharLiveLotteryTitle = document.getElementById('yt-char-live-lottery-title');
    const ytCharLiveLotteryPrize = document.getElementById('yt-char-live-lottery-prize');
    const ytCharLiveLotteryCountdown = document.getElementById('yt-char-live-lottery-countdown');
    const ytCharLiveLotteryStatus = document.getElementById('yt-char-live-lottery-status');
    const ytCharLiveLotteryInlineStatus = document.getElementById('yt-char-live-lottery-inline-status');
    const ytCharLiveLotteryParticipants = document.getElementById('yt-char-live-lottery-participants');
    const ytCharLiveLotteryStatusCountdown = document.getElementById('yt-char-live-lottery-status-countdown');
    const ytCharLiveLotteryActions = document.getElementById('yt-char-live-lottery-actions');
    const ytCharLiveLotteryJoin = document.getElementById('yt-char-live-lottery-join');
    const ytCharLiveLotterySkip = document.getElementById('yt-char-live-lottery-skip');
    const ytCharLiveLotteryClose = document.getElementById('yt-char-live-lottery-close');
    
    let currentVideoData = null;
    let chatInterval = null;
    let tempVideoCover = null;
    let ytReplayCommentRequestId = '';
    let ytCharConnectionDelayTimer = null;
    let ytCharConnectionDurationTimer = null;
    let ytCharLiveLotteryTimer = null;
    const YT_CHAR_LOTTERY_TRIGGER_RATE = 0.03;

    function getCurrentYtViewer() {
        if (typeof window.getYtEffectiveUserState === 'function') {
            return window.getYtEffectiveUserState() || {};
        }
        return ytUserState || {};
    }

    function ytPlayerEscapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function getYtPlayerLanguageContext(channel = null) {
        const targetChannel = channel || currentVideoData?.channelData || currentSubChannelData;
        return typeof window.getYtChannelLanguageContext === 'function'
            ? window.getYtChannelLanguageContext(targetChannel)
            : { enabled: false, language: '', languageName: '' };
    }

    function getYtPlayerLocalizedContent(value, channel = null) {
        const context = getYtPlayerLanguageContext(channel);
        if (typeof window.normalizeYtLocalizedContent === 'function') {
            return window.normalizeYtLocalizedContent(value, context);
        }
        if (value && typeof value === 'object') {
            return {
                text: String(value.text || value.content || '').trim(),
                translationZh: String(value.translationZh || value.translation || '').trim()
            };
        }
        return { text: String(value || '').trim(), translationZh: '' };
    }

    function getYtPlayerTranslation(value) {
        if (!value || typeof value !== 'object') return '';
        return String(value.translationZh || value.translation || '').trim();
    }

    function getYtViewsDisplay(video, isLive = !!video?.isLive) {
        const source = video && typeof video === 'object' ? video : {};
        if (isLive && typeof window.formatYtLiveViewerCount === 'function') {
            return window.formatYtLiveViewerCount(source.viewerCount, source.views) || '0 人正在观看';
        }
        if (!isLive && typeof window.formatYtVideoViewCount === 'function') {
            return window.formatYtVideoViewCount(source.viewCount, source.views) || '0 次观看';
        }
        return String(source.views || (isLive ? '0 人正在观看' : '0 次观看'));
    }

    function formatYtCharFanGroupMemberCount(value) {
        const count = Math.max(1, Math.round(Number(value) || 1));
        if (count >= 10000) return `${(count / 10000).toFixed(count % 10000 === 0 ? 0 : 1)}万人`;
        return `${count.toLocaleString('zh-CN')}人`;
    }

    function renderYtSecondaryTranslation(translationZh, className = 'yt-localized-secondary') {
        const translation = String(translationZh || '').trim();
        return translation
            ? `<div class="${className}">${ytPlayerEscapeHtml(translation)}</div>`
            : '';
    }

    function bindYtCommentTranslationToggle(root) {
        if (!root) return;
        const button = root.querySelector('.yt-comment-translation-toggle');
        const translation = root.querySelector('.yt-comment-translation');
        if (!button || !translation) return;
        const toggleTranslation = (event) => {
            event.stopPropagation();
            const willExpand = translation.hidden;
            translation.hidden = !willExpand;
            button.textContent = willExpand ? '收起翻译' : '翻译';
            button.setAttribute('aria-expanded', String(willExpand));
        };
        button.addEventListener('click', toggleTranslation);
        button.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            toggleTranslation(event);
        });
    }

    function normalizeYtGeneratedComment(comment, channel = null) {
        const source = comment && typeof comment === 'object' ? comment : { text: comment };
        const text = String(source.text || source.comment || source.content || source.message || '').trim();
        const translationZh = String(source.translationZh || source.translation || source.chineseTranslation || '').trim();
        return {
            ...source,
            name: String(source.name || source.user || source.nickname || '观众').trim(),
            text,
            translationZh
        };
    }

    function createYtLiveReplayId(channelId = '') {
        const randomPart = Math.random().toString(36).slice(2, 9);
        return `yt-live-replay-${String(channelId || 'channel')}-${Date.now()}-${randomPart}`;
    }

    function createYtCharLiveId(channelId = '') {
        const randomPart = Math.random().toString(36).slice(2, 9);
        return `yt-char-live-${String(channelId || 'channel')}-${Date.now()}-${randomPart}`;
    }

    function ensureYtCharLiveId(live, channelId = '') {
        if (live && !live.id) live.id = createYtCharLiveId(channelId);
        return live?.id || '';
    }

    function isYtLiveReplay(video) {
        if (!video || video.isLive) return false;
        return video.isLiveReplay === true || String(video.time || '').trim() === '刚刚直播结束';
    }

    function getYtReplayRealtimeCommentCount(video) {
        if (!isYtLiveReplay(video)) return 0;
        const commentsLength = Array.isArray(video.comments) ? video.comments.length : 0;
        const storedCount = Math.round(Number(video.realtimeCommentCount));
        if (!Number.isFinite(storedCount) || storedCount < 0) return commentsLength;
        return Math.min(storedCount, commentsLength);
    }

    function createYtReplayTranscriptFromBubbles(bubbles) {
        if (!Array.isArray(bubbles)) return [];
        const now = Date.now();
        return bubbles.map((bubble, index) => {
            const localized = getYtPlayerLocalizedContent(bubble);
            return {
                type: 'bubble',
                text: localized.text,
                ...(localized.translationZh ? { translationZh: localized.translationZh } : {}),
                timestamp: now + index
            };
        }).filter(item => item.text);
    }

    function normalizeYtReplayTranscriptItem(item, index = 0) {
        const source = item && typeof item === 'object' ? item : { text: item };
        const localized = getYtPlayerLocalizedContent(source);
        return {
            type: source.type === 'narrative' ? 'narrative' : (source.type || 'bubble'),
            ...(source.name ? { name: String(source.name) } : {}),
            ...(source.senderType ? { senderType: String(source.senderType) } : {}),
            text: localized.text,
            ...(localized.translationZh ? { translationZh: localized.translationZh } : {}),
            timestamp: Number(source.timestamp) || (Date.now() + index)
        };
    }

    function archiveYtCurrentCharLive(channel) {
        const generatedContent = channel?.generatedContent;
        const currentLive = generatedContent?.currentLive;
        if (!currentLive) return null;
        const sourceLiveId = ensureYtCharLiveId(currentLive, channel.id);
        const archivedComments = Array.isArray(currentLive.comments)
            ? currentLive.comments.map(comment => normalizeYtGeneratedComment(comment, channel)).filter(comment => comment.text)
            : [];
        const archivedTranscript = Array.isArray(currentLive.liveTranscript)
            ? currentLive.liveTranscript.map((item, index) => normalizeYtReplayTranscriptItem(item, index)).filter(item => item.text)
            : createYtReplayTranscriptFromBubbles(currentLive.initialBubbles);
        const replay = {
            id: createYtLiveReplayId(channel.id),
            sourceLiveId,
            isLiveReplay: true,
            title: currentLive.title,
            titleTranslationZh: currentLive.titleTranslationZh || '',
            viewCount: Number.isFinite(Number(currentLive.viewerCount)) ? Number(currentLive.viewerCount) : undefined,
            views: currentLive.views,
            time: '刚刚直播结束',
            thumbnail: currentLive.thumbnail,
            comments: archivedComments,
            realtimeCommentCount: archivedComments.length,
            liveTranscript: archivedTranscript,
            guest: currentLive.guest || null,
            connectionHistory: Array.isArray(currentLive.connectionHistory)
                ? currentLive.connectionHistory.map(item => ({
                    ...item,
                    participant: { ...(item?.participant || {}) },
                    transcript: Array.isArray(item?.transcript) ? item.transcript.map(entry => ({ ...entry })) : []
                }))
                : [],
            charLottery: currentLive.charLottery ? {
                ...currentLive.charLottery,
                participants: Array.isArray(currentLive.charLottery.participants)
                    ? currentLive.charLottery.participants.map(item => ({ ...item }))
                    : [],
                winner: currentLive.charLottery.winner ? { ...currentLive.charLottery.winner } : null
            } : null,
            charLotteryHistory: Array.isArray(currentLive.charLotteryHistory)
                ? currentLive.charLotteryHistory.map(lottery => ({
                    ...lottery,
                    participants: Array.isArray(lottery?.participants) ? lottery.participants.map(item => ({ ...item })) : [],
                    winner: lottery?.winner ? { ...lottery.winner } : null
                }))
                : []
        };
        if (!Array.isArray(generatedContent.pastVideos)) generatedContent.pastVideos = [];
        generatedContent.pastVideos.unshift(replay);
        return replay;
    }

    function normalizeYtGeneratedBubble(value, channel = null) {
        const localized = getYtPlayerLocalizedContent(value, channel);
        return localized.translationZh ? localized : localized.text;
    }

    function getYtLiveFallbackBubbles(channel) {
        const context = getYtPlayerLanguageContext(channel);
        const localizedFallbacks = {
            en: [
                { text: 'Welcome to the stream!', translationZh: '欢迎来到直播间！' },
                { text: 'Good evening, everyone!', translationZh: '大家晚上好！' }
            ],
            ja: [
                { text: '配信へようこそ！', translationZh: '欢迎来到直播间！' },
                { text: 'みなさん、こんばんは！', translationZh: '大家晚上好！' }
            ],
            ko: [
                { text: '방송에 오신 걸 환영해요!', translationZh: '欢迎来到直播间！' },
                { text: '여러분, 좋은 저녁이에요!', translationZh: '大家晚上好！' }
            ],
            fr: [
                { text: 'Bienvenue sur le live !', translationZh: '欢迎来到直播间！' },
                { text: 'Bonsoir à tous !', translationZh: '大家晚上好！' }
            ]
        };
        if (context.enabled && context.language !== 'zh') {
            return localizedFallbacks[context.language] || [];
        }
        return ['欢迎来到直播间！', '大家晚上好！'];
    }

    const ytEditVideoSheet = document.getElementById('yt-edit-video-sheet');
    const ytEditVideoCoverBtn = document.getElementById('yt-edit-video-cover-btn');
    const ytEditVideoUpload = document.getElementById('yt-edit-video-upload');
    const ytEditVideoCoverImg = document.getElementById('yt-edit-video-cover-img');
    const ytEditVideoTitleInput = document.getElementById('yt-edit-video-title-input');
    const confirmYtVideoBtn = document.getElementById('confirm-yt-video-btn');
    const resetYtVideoBtn = document.getElementById('reset-yt-video-btn');

    // Guest Picker Elements
    const ytGuestPickerSheet = document.getElementById('yt-guest-picker-sheet');
    const ytGuestList = document.getElementById('yt-guest-list');
    const closeYtGuestPickerBtn = document.getElementById('close-yt-guest-picker-btn');
    
    // User Live Guest Elements
    const ytUserLiveGuestSelector = document.getElementById('yt-user-live-guest-selector');
    const ytUserLiveGuestName = document.getElementById('yt-user-live-guest-name');
    let userLiveSelectedGuests = [];

    function getFollowedTkLiveGuests() {
        const chars = Array.isArray(window.tkState?.chars) ? window.tkState.chars : [];
        return chars.filter(char => char && char.isFollowed === true).map(char => ({
            id: char.id,
            name: char.name || char.handle || '未命名 Char',
            avatar: window.tkResolveAvatar
                ? window.tkResolveAvatar(char.id, char.name || char.handle, char.avatar)
                : (char.avatar || ''),
            desc: char.persona || char.bio || '',
            persona: char.persona || '',
            status: char.status || '',
            guestSource: 'tiktok-following'
        }));
    }

    function getUnifiedYtLiveGuestOptions() {
        const seen = new Set();
        return (Array.isArray(mockSubscriptions) ? mockSubscriptions : []).filter(sub => {
            if (!sub) return false;
            const linkedChar = typeof resolveYtExplicitImChar === 'function' ? resolveYtExplicitImChar(sub) : null;
            return !!linkedChar || sub.isSubscribed !== false;
        }).map(sub => {
            const linkedChar = typeof resolveYtExplicitImChar === 'function' ? resolveYtExplicitImChar(sub) : null;
            const normalized = {
                ...sub,
                avatar: typeof resolveYtChannelAvatar === 'function'
                    ? resolveYtChannelAvatar(sub)
                    : (sub.avatar || sub.avatarUrl || ''),
                desc: sub.desc || sub.persona || '',
                persona: sub.persona || sub.desc || '',
                guestSource: linkedChar ? 'imessage-char' : 'youtube-subscription'
            };
            return normalized;
        }).filter(sub => {
            const key = sub.imCharId ? `char:${sub.imCharId}` : `sub:${sub.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function getYtSubscribedConnectionOptions() {
        const effectiveUser = typeof getCurrentYtViewer === 'function' ? getCurrentYtViewer() : (ytUserState || {});
        const currentUserName = String(effectiveUser?.name || '').trim();
        return getUnifiedYtLiveGuestOptions().filter(option => (
            option
            && option.isSubscribed !== false
            && option.isBusiness !== true
            && String(option.id || '') !== 'user_channel_id'
            && (!currentUserName || String(option.name || '').trim() !== currentUserName)
        ));
    }

    function validateYtLiveGuestOption(guest) {
        if (!guest) return null;
        return getYtSubscribedConnectionOptions().find(option => {
            if (String(option.id) === String(guest.id)) return true;
            return option.imCharId && guest.imCharId && String(option.imCharId) === String(guest.imCharId);
        }) || null;
    }
    window.validateYtLiveGuestOption = validateYtLiveGuestOption;

    function updateUserLiveGuestLabel() {
        if (!ytUserLiveGuestName) return;
        ytUserLiveGuestName.value = userLiveSelectedGuests.length
            ? userLiveSelectedGuests.map(item => item.name).join('、')
            : '无';
    }

    function validateUserLiveSelectedGuests() {
        const seen = new Set();
        userLiveSelectedGuests = (Array.isArray(userLiveSelectedGuests) ? userLiveSelectedGuests : [])
            .map(validateYtLiveGuestOption)
            .filter(guest => {
                const key = String(guest?.imCharId || guest?.id || '');
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, 3);
        updateUserLiveGuestLabel();
        return userLiveSelectedGuests;
    }

    window.validateUserLiveSelectedGuests = validateUserLiveSelectedGuests;
    window.validateUserLiveSelectedGuest = () => validateUserLiveSelectedGuests()[0] || null;
    window.getUserLiveSelectedGuests = () => [...validateUserLiveSelectedGuests()];
    window.setUserLiveSelectedGuests = guests => {
        userLiveSelectedGuests = Array.isArray(guests) ? [...guests] : [];
        return validateUserLiveSelectedGuests();
    };

    function renderGuestPicker(onSelect, source = 'unified-live-guests', options = {}) {
        if (!ytGuestList) return;
        ytGuestList.innerHTML = '';
        const excludedIds = new Set((options.excludeIds || []).map(String));
        const isMulti = options.multiSelect === true;
        const selectedIds = new Set((options.selectedIds || []).map(String));
        const selectedById = new Map();

        if (options.includeNone !== false && !isMulti) {
            const noneItem = document.createElement('div');
            noneItem.className = 'account-card';
            noneItem.innerHTML = `<div class="account-content"><div class="account-name">无联动嘉宾</div></div>`;
            noneItem.addEventListener('click', () => {
                onSelect(null);
                if(ytGuestPickerSheet) ytGuestPickerSheet.classList.remove('active');
            });
            ytGuestList.appendChild(noneItem);
        }

        const guestOptions = source === 'tiktok-following'
            ? getFollowedTkLiveGuests()
            : (source === 'youtube-subscriptions'
                ? mockSubscriptions
                : (source === 'youtube-connection-friends' ? getYtSubscribedConnectionOptions() : getUnifiedYtLiveGuestOptions()));

        if (guestOptions.length === 0) {
            const emptyItem = document.createElement('div');
            emptyItem.style.cssText = 'padding:28px 16px;text-align:center;color:#8e8e93;font-size:13px;';
            emptyItem.textContent = '暂无可连线的订阅好友';
            ytGuestList.appendChild(emptyItem);
        }

        guestOptions.forEach(sub => {
            // Avoid selecting self
            if (options.excludeCurrent !== false && currentSubChannelData && sub.id === currentSubChannelData.id) return;
            if (ytUserState && sub.name === ytUserState.name) return;
            const participantKey = String(sub.imCharId || sub.id || '');
            if (excludedIds.has(String(sub.id)) || (sub.imCharId && excludedIds.has(String(sub.imCharId)))) return;
            if (selectedIds.has(participantKey) || selectedIds.has(String(sub.id))) selectedById.set(participantKey, sub);
            const avatarUrl = source === 'tiktok-following'
                ? (sub.avatar || `https://picsum.photos/seed/${encodeURIComponent(sub.id || sub.name)}/80/80`)
                : (typeof resolveYtChannelAvatar === 'function'
                ? resolveYtChannelAvatar(sub)
                : (sub.avatar || 'https://picsum.photos/80/80?grayscale'));
            const detailText = source === 'tiktok-following'
                ? (sub.status || sub.persona || '已关注 Char')
                : (sub.guestSource === 'imessage-char' ? 'Char' : `${sub.subs || '0'} 订阅者`);

            const item = document.createElement('div');
            item.className = `account-card${selectedById.has(participantKey) ? ' is-selected' : ''}`;
            item.innerHTML = `
                <div class="account-content">
                        <div class="account-avatar"><img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div>
                        <div class="account-info">
                            <div class="account-name">${sub.name}</div>
                            <div class="account-detail">${detailText}</div>
                        </div>
                        ${isMulti ? '<i class="fas fa-check-circle yt-guest-selected-mark" aria-hidden="true"></i>' : ''}
                    </div>
            `;
            item.addEventListener('click', () => {
                if (isMulti) {
                    if (selectedById.has(participantKey)) {
                        selectedById.delete(participantKey);
                        item.classList.remove('is-selected');
                    } else if (selectedById.size < 3) {
                        selectedById.set(participantKey, sub);
                        item.classList.add('is-selected');
                    } else if (window.showToast) {
                        window.showToast('最多选择 3 位连线嘉宾');
                    }
                    return;
                }
                onSelect(sub);
                if (ytGuestPickerSheet) ytGuestPickerSheet.classList.remove('active');
            });
            ytGuestList.appendChild(item);
        });

        if (isMulti) {
            const confirm = document.createElement('button');
            confirm.type = 'button';
            confirm.className = 'yt-guest-multi-confirm';
            confirm.textContent = '确认选择';
            confirm.addEventListener('click', () => {
                onSelect([...selectedById.values()].slice(0, 3));
                ytGuestPickerSheet?.classList.remove('active');
            });
            ytGuestList.appendChild(confirm);
        }
    }

    if (closeYtGuestPickerBtn && ytGuestPickerSheet) {
        closeYtGuestPickerBtn.addEventListener('click', () => ytGuestPickerSheet.classList.remove('active'));
        ytGuestPickerSheet.addEventListener('mousedown', (e) => {
            if (e.target === ytGuestPickerSheet) ytGuestPickerSheet.classList.remove('active');
        });
    }

    if (ytUserLiveGuestSelector && ytGuestPickerSheet) {
        ytUserLiveGuestSelector.addEventListener('click', () => {
            renderGuestPicker((selectedGuests) => {
                userLiveSelectedGuests = selectedGuests;
                validateUserLiveSelectedGuests();
            }, 'youtube-connection-friends', {
                excludeCurrent: false,
                includeNone: false,
                multiSelect: true,
                selectedIds: userLiveSelectedGuests.map(item => item.imCharId || item.id)
            });
            ytGuestPickerSheet.classList.add('active');
        });
    }

    window.openYtLiveConnectionPicker = function(onSelect, options = {}) {
        if (!ytGuestPickerSheet || typeof onSelect !== 'function') return false;
        renderGuestPicker(onSelect, 'youtube-connection-friends', {
            includeNone: options.includeNone !== false,
            excludeCurrent: true,
            excludeIds: options.excludeIds || []
        });
        const title = ytGuestPickerSheet.querySelector('.sheet-title');
        if (title) title.textContent = options.title || '选择连线好友';
        ytGuestPickerSheet.classList.add('active');
        return true;
    };

    if (ytPlayerVideoArea && ytEditVideoSheet) {
        ytPlayerVideoArea.addEventListener('click', (e) => {
            if (e.target === ytPlayerVideoArea || e.target === ytPlayerThumbnail) {
                if(currentVideoData) {
                    ytEditVideoTitleInput.value = currentVideoData.title || '';
                    if (currentVideoData.thumbnail) {
                        ytEditVideoCoverImg.src = currentVideoData.thumbnail;
                        ytEditVideoCoverImg.style.display = 'block';
                    } else {
                        ytEditVideoCoverImg.style.display = 'none';
                    }

                    ytEditVideoSheet.classList.add('active');
                }
            }
        });

        if (ytEditVideoSheet) {
            ytEditVideoSheet.addEventListener('mousedown', (e) => {
                if (e.target === ytEditVideoSheet) ytEditVideoSheet.classList.remove('active');
            });
        }

        if (ytEditVideoCoverBtn && ytEditVideoUpload) {
            ytEditVideoCoverBtn.addEventListener('click', () => ytEditVideoUpload.click());
            ytEditVideoUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        if (window.compressImage) {
                            window.compressImage(event.target.result, 640, 360, (compressedUrl) => {
                                ytEditVideoCoverImg.src = compressedUrl;
                                ytEditVideoCoverImg.style.display = 'block';
                            });
                        } else {
                            ytEditVideoCoverImg.src = event.target.result;
                            ytEditVideoCoverImg.style.display = 'block';
                        }
                    };
                    reader.readAsDataURL(file);
                }
                e.target.value = '';
            });
        }

        if (resetYtVideoBtn) {
            resetYtVideoBtn.addEventListener('click', () => {
                ytEditVideoCoverImg.src = '';
                ytEditVideoCoverImg.style.display = 'none';
                ytEditVideoTitleInput.value = currentVideoData._originalTitle || '无标题';
            });
        }

        if (confirmYtVideoBtn) {
            confirmYtVideoBtn.addEventListener('click', () => {
                if (!currentVideoData) return;
                
                const newTitle = ytEditVideoTitleInput.value.trim() || '无标题';
                const newCover = (ytEditVideoCoverImg.style.display === 'block' && ytEditVideoCoverImg.src) ? ytEditVideoCoverImg.src : 'https://picsum.photos/320/180?grayscale';
                const titleChanged = newTitle !== currentVideoData.title;

                currentVideoData.title = newTitle;
                if (titleChanged) currentVideoData.titleTranslationZh = '';
                currentVideoData.thumbnail = newCover;
                
                const titleEl = document.getElementById('yt-player-title');
                if(titleEl) titleEl.textContent = newTitle;
                const liveTitleOverlay = document.getElementById('yt-player-live-title-overlay');
                if(liveTitleOverlay) liveTitleOverlay.textContent = newTitle;
                if(ytPlayerThumbnail) ytPlayerThumbnail.src = newCover;

                const channel = currentVideoData.channelData;
                if (channel && channel.generatedContent) {
                    if (currentVideoData.isLive && channel.generatedContent.currentLive) {
                        channel.generatedContent.currentLive.title = newTitle;
                        if (titleChanged) channel.generatedContent.currentLive.titleTranslationZh = '';
                        channel.generatedContent.currentLive.thumbnail = newCover;
                    } else if (!currentVideoData.isLive && channel.generatedContent.pastVideos) {
                        const originalTitle = currentVideoData._originalTitle;
                        const match = channel.generatedContent.pastVideos.find(v => v.title === originalTitle);
                        if (match) {
                            match.title = newTitle;
                            if (titleChanged) match.titleTranslationZh = '';
                            match.thumbnail = newCover;
                        }
                    }
                }
                
                if (channel && channel.id === 'user_channel_id' && channelState.pastVideos) {
                    const originalTitle = currentVideoData._originalTitle;
                    const match = channelState.pastVideos.find(v => v.title === originalTitle);
                    if (match) {
                        match.title = newTitle;
                        match.thumbnail = newCover;
                    }
                }
                
                const mv = mockVideos.find(v => v.title === currentVideoData._originalTitle);
                if (mv) {
                    mv.title = newTitle;
                    mv.thumbnail = newCover;
                }
                
                currentVideoData._originalTitle = newTitle; 

                saveYoutubeData();
                renderVideos();
                
                const activeTab = document.querySelector('#sub-channel-tabs .yt-sliding-tab.active');
                if (activeTab) {
                    const target = activeTab.getAttribute('data-target');
                    if (target === 'live' || target === 'past') renderGeneratedContent(target);
                } else if (channel && channel.id === 'user_channel_id') {
                    const userPastTab = document.querySelector('#profile-main-tabs .yt-sliding-tab.active');
                    if(userPastTab) userPastTab.click();
                }
                
                ytEditVideoSheet.classList.remove('active');
                if (window.showToast) window.showToast('视频信息已更新');
            });
        }
    }

    if(playerBackBtn && playerView) {
        playerBackBtn.addEventListener('click', () => {
            if (chatInput && document.activeElement === chatInput) chatInput.blur();
            if (ytScCustomInput && document.activeElement === ytScCustomInput) ytScCustomInput.blur();
            if (ytScInput && document.activeElement === ytScInput) ytScInput.blur();
            if (typeof window.releaseYtChatKeyboardLock === 'function') window.releaseYtChatKeyboardLock();
            playerView.classList.remove('active');
            playerView.classList.remove('yt-char-live-mode');
            setYtReplayCommentsButtonState(false);
            setYtPlayerDeleteVideoButtonState(false);
            window.resetYtViewportOffset?.();
            if(chatInterval) clearInterval(chatInterval);
            
            if (window.ytLiveTimeouts) {
                window.ytLiveTimeouts.forEach(clearTimeout);
                window.ytLiveTimeouts = [];
            }
            
            if(ytCharSpeechBubble) {
                ytCharSpeechBubble.innerHTML = '';
                ytCharSpeechBubble.style.display = 'none';
            }
            stopYtCharConnectionVisualTimers();
            if (ytCharLiveConnectionCard) ytCharLiveConnectionCard.style.display = 'none';
            stopYtCharLiveLotteryTimer();
            ytCharLiveLotteryModal?.classList.remove('active');
            if (ytCharLiveLotteryInlineStatus) ytCharLiveLotteryInlineStatus.style.display = 'none';
        });
    }

    function clearCharLiveBubbles() {
        if (!ytCharSpeechBubble) return;
        ytCharSpeechBubble.innerHTML = '';
        ytCharSpeechBubble.style.display = 'none';
    }

    function formatYtLiveConnectionDuration(startedAt) {
        const totalSeconds = Math.max(0, Math.floor((Date.now() - Number(startedAt || Date.now())) / 1000));
        const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    function resolveCanonicalYtCharLive() {
        const channelId = currentVideoData?.channelData?.id;
        if (!channelId || channelId === 'user_channel_id') return null;
        const canonicalChannel = (Array.isArray(mockSubscriptions) ? mockSubscriptions : [])
            .find(channel => String(channel?.id) === String(channelId));
        const currentLive = canonicalChannel?.generatedContent?.currentLive;
        if (!canonicalChannel || !currentLive) return null;
        const requestedLiveId = currentVideoData?.id || currentVideoData?.liveId;
        if (requestedLiveId && currentLive.id && String(requestedLiveId) !== String(currentLive.id)) return null;
        currentVideoData.channelData = canonicalChannel;
        currentVideoData.id = currentLive.id || requestedLiveId || '';
        currentVideoData.liveId = currentVideoData.id;
        currentVideoData.comments = Array.isArray(currentLive.comments) ? currentLive.comments : [];
        currentVideoData.initialBubbles = Array.isArray(currentLive.initialBubbles) ? currentLive.initialBubbles : [];
        currentVideoData.liveTranscript = Array.isArray(currentLive.liveTranscript) ? currentLive.liveTranscript : [];
        if (currentLive.connection && typeof currentLive.connection === 'object') {
            currentLive.connection.id = currentLive.connection.id || `connection_${currentLive.connection.requestedAt || Date.now()}`;
            currentLive.connection.transcript = Array.isArray(currentLive.connection.transcript)
                ? currentLive.connection.transcript.map(normalizeYtConnectionTranscriptItem)
                : [];
        }
        currentVideoData.connection = currentLive.connection || null;
        currentVideoData.connectionHistory = Array.isArray(currentLive.connectionHistory) ? currentLive.connectionHistory : [];
        currentVideoData.charLottery = currentLive.charLottery || null;
        return { channel: canonicalChannel, live: currentLive };
    }

    function getActiveYtCharConnection() {
        return resolveCanonicalYtCharLive()?.live?.connection || null;
    }

    function setYtCharConnectionButtonState(connection = getActiveYtCharConnection()) {
        if (!ytPlayerConnectBtn) return;
        const isCharLive = !!(currentVideoData?.isLive && currentVideoData?.channelData?.id !== 'user_channel_id');
        const isConnecting = connection?.status === 'connecting';
        const isActive = connection?.status === 'active';
        ytPlayerConnectBtn.style.display = isCharLive ? 'flex' : 'none';
        ytPlayerConnectBtn.disabled = !isCharLive || isConnecting || isActive;
        ytPlayerConnectBtn.classList.toggle('is-connecting', isConnecting);
        ytPlayerConnectBtn.innerHTML = isConnecting
            ? '<i class="fas fa-circle-notch fa-spin"></i>'
            : '<i class="fas fa-phone-volume"></i>';
        ytPlayerConnectBtn.title = isConnecting ? '正在等待接通' : (isActive ? '正在连线' : '请求连线');
        ytPlayerConnectBtn.setAttribute('aria-label', ytPlayerConnectBtn.title);
    }

    function stopYtCharConnectionVisualTimers() {
        if (ytCharConnectionDelayTimer) clearTimeout(ytCharConnectionDelayTimer);
        if (ytCharConnectionDurationTimer) clearInterval(ytCharConnectionDurationTimer);
        ytCharConnectionDelayTimer = null;
        ytCharConnectionDurationTimer = null;
    }

    function addYtCharConnectionBubble(value) {
        const localized = getYtPlayerLocalizedContent(value, currentVideoData?.channelData);
        const participant = getActiveYtCharConnection()?.participant || getCurrentYtViewer();
        const participantName = participant?.name || 'User';
        if (!localized.text) return;
        addCharLiveBubble({
            text: `${participantName}：${localized.text}`,
            translationZh: localized.translationZh ? `${participantName}：${localized.translationZh}` : ''
        }, { skipPersist: true });
    }

    function addYtCharConnectionNarrative(value) {
        const localized = getYtPlayerLocalizedContent(value, currentVideoData?.channelData);
        const container = ytCharLiveConnectionCard?.querySelector('.yt-live-connection-narratives');
        if (!container || !localized.text) return;
        const narrative = document.createElement('div');
        narrative.className = 'yt-live-connection-narrative';
        narrative.textContent = localized.translationZh
            ? `${localized.text}（${localized.translationZh}）`
            : localized.text;
        container.appendChild(narrative);
        while (container.children.length > 2) container.firstElementChild?.remove();
        setTimeout(() => narrative.remove(), 10000);
    }

    function normalizeYtConnectionTranscriptItem(item = {}) {
        return {
            speakerType: item.speakerType || 'user',
            speakerId: item.speakerId || null,
            name: item.name || '',
            text: String(item.text || '').trim(),
            ...(item.translationZh ? { translationZh: String(item.translationZh) } : {}),
            kind: item.kind === 'narrative' ? 'narrative' : 'speech',
            timestamp: Number(item.timestamp) || Date.now()
        };
    }

    function recordYtCharConnectionUserContent(text) {
        const resolved = resolveCanonicalYtCharLive();
        if (!resolved || !text) return;
        const participant = resolved.live.connection?.participant || getCurrentYtViewer();
        const transcriptItem = normalizeYtConnectionTranscriptItem({
            speakerType: 'user',
            speakerId: participant?.id || 'user_channel_id',
            name: participant?.name || '我',
            text: String(text),
            kind: 'speech'
        });
        if (resolved.live.connection) {
            if (!Array.isArray(resolved.live.connection.transcript)) resolved.live.connection.transcript = [];
            resolved.live.connection.transcript.push({ ...transcriptItem });
        }
        if (!Array.isArray(resolved.channel.liveHistory)) resolved.channel.liveHistory = [];
        resolved.channel.liveHistory.push({ type: 'connection-user', senderType: 'user', ...transcriptItem });
        if (!Array.isArray(resolved.live.liveTranscript)) resolved.live.liveTranscript = [];
        resolved.live.liveTranscript.push({ type: 'connection-user', senderType: 'user', ...transcriptItem });
        currentVideoData.liveTranscript = resolved.live.liveTranscript;
        saveYoutubeData();
    }

    function renderYtCharConnection() {
        if (!ytCharLiveConnectionCard) return;
        stopYtCharConnectionVisualTimers();
        const connection = getActiveYtCharConnection();
        setYtCharConnectionButtonState(connection);
        if (!connection || connection.status !== 'active' || !currentVideoData?.isLive) {
            ytCharLiveConnectionCard.style.display = 'none';
            ytCharLiveConnectionCard.querySelector('.yt-live-connection-narratives')?.replaceChildren();
            return;
        }
        const participant = connection.participant || {};
        const avatar = ytCharLiveConnectionCard.querySelector('.yt-live-connection-avatar');
        const name = ytCharLiveConnectionCard.querySelector('.yt-live-connection-name');
        const duration = ytCharLiveConnectionCard.querySelector('.yt-live-connection-duration');
        if (avatar) avatar.src = participant.avatar || participant.avatarUrl || 'https://picsum.photos/80/80?grayscale';
        if (name) name.textContent = participant.name || 'User';
        const updateDuration = () => {
            if (duration) duration.textContent = formatYtLiveConnectionDuration(connection.startedAt);
        };
        updateDuration();
        ytCharConnectionDurationTimer = setInterval(updateDuration, 1000);
        ytCharLiveConnectionCard.style.display = 'flex';
    }

    async function triggerYtCharConnectionKickoff() {
        const resolved = resolveCanonicalYtCharLive();
        const connection = resolved?.live?.connection;
        if (!resolved || connection?.status !== 'active' || connection.kickoffCompleted === true) return;
        connection.kickoffAttemptedAt = Date.now();
        saveYoutubeData();
        const responseObj = await getCharResponse('', false, 0, false, { connectionKickoff: true });
        if (responseObj?._error) {
            removeCharLiveLoadingBubbles();
            if (window.showToast) {
                window.showToast(responseObj._error === 'API_NOT_CONFIGURED'
                    ? '请先配置 API，之后可点击 API 按钮重试连线互动'
                    : '连线互动生成失败，可点击 API 按钮重试');
            }
            return;
        }
        const latest = resolveCanonicalYtCharLive()?.live?.connection;
        if (!latest || latest.status !== 'active') return;
        latest.kickoffCompleted = true;
        saveYoutubeData();
        resolveCanonicalYtCharLive();
        renderAiResponse(responseObj);
    }

    function activateYtCharConnection() {
        const resolved = resolveCanonicalYtCharLive();
        const connection = resolved?.live?.connection;
        if (!resolved || connection?.status !== 'connecting') return;
        connection.status = 'active';
        connection.startedAt = (Number(connection.requestedAt) || Date.now()) + 3000;
        resolved.live.guest = { ...connection.participant };
        currentVideoData.guest = resolved.live.guest;
        saveYoutubeData();
        renderYtCharConnection();
        triggerYtCharConnectionKickoff();
    }

    function scheduleYtCharConnectionRestore() {
        const connection = getActiveYtCharConnection();
        stopYtCharConnectionVisualTimers();
        if (connection?.status === 'connecting') {
            setYtCharConnectionButtonState(connection);
            const remaining = Math.max(0, (Number(connection.requestedAt) + 3000) - Date.now());
            ytCharConnectionDelayTimer = setTimeout(activateYtCharConnection, remaining);
            return;
        }
        renderYtCharConnection();
    }

    function stopYtCharLiveLotteryTimer() {
        if (ytCharLiveLotteryTimer) clearInterval(ytCharLiveLotteryTimer);
        ytCharLiveLotteryTimer = null;
    }

    function getYtCharLiveLottery() {
        return resolveCanonicalYtCharLive()?.live?.charLottery || null;
    }

    function formatYtCharLotteryCountdown(milliseconds) {
        const seconds = Math.max(0, Math.ceil(Number(milliseconds || 0) / 1000));
        return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }

    function positionYtCharLiveLotteryStatus() {
        if (!ytCharLiveLotteryInlineStatus || !playerView) return;
        const chatShell = playerView.querySelector('.yt-player-chat-shell');
        if (!chatShell) return;
        const viewRect = playerView.getBoundingClientRect();
        const chatRect = chatShell.getBoundingClientRect();
        const chatHeightFromBottom = Math.max(0, viewRect.bottom - chatRect.top);
        ytCharLiveLotteryInlineStatus.style.bottom = `${Math.round(chatHeightFromBottom + 8)}px`;
    }

    function renderYtCharLiveLotteryInlineStatus(lottery = getYtCharLiveLottery()) {
        if (!ytCharLiveLotteryInlineStatus) return;
        if (!lottery || lottery.status !== 'active' || lottery.joined !== true) {
            ytCharLiveLotteryInlineStatus.style.display = 'none';
            return;
        }
        ytCharLiveLotteryInlineStatus.style.display = 'flex';
        positionYtCharLiveLotteryStatus();
        if (ytCharLiveLotteryParticipants) {
            ytCharLiveLotteryParticipants.textContent = String(Array.isArray(lottery.participants) ? lottery.participants.length : 0);
        }
        if (ytCharLiveLotteryStatusCountdown) {
            ytCharLiveLotteryStatusCountdown.textContent = formatYtCharLotteryCountdown(Number(lottery.endAt) - Date.now());
        }
    }

    function parseYtCharLotteryCashAmount(value) {
        const text = String(value || '').trim();
        const match = text.match(/(?:¥|￥|RMB|人民币)\s*(\d+(?:\.\d+)?)/i)
            || text.match(/(\d+(?:\.\d+)?)\s*元/);
        const amount = match ? Number(match[1]) : 0;
        return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0;
    }

    function grantYtCharLotteryUserReward(lottery, resolved) {
        if (!lottery?.userWon || lottery.rewardGrantedAt) return false;
        channelState.dataCenter = channelState.dataCenter && typeof channelState.dataCenter === 'object'
            ? channelState.dataCenter
            : { views: 0, sc: 0, subs: 0, commission: 0, receivedGifts: [] };
        channelState.dataCenter.receivedGifts = Array.isArray(channelState.dataCenter.receivedGifts)
            ? channelState.dataCenter.receivedGifts
            : [];
        const existingGift = channelState.dataCenter.receivedGifts.find(item => String(item?.lotteryId) === String(lottery.id));
        if (existingGift) {
            lottery.rewardGrantedAt = Number(existingGift.receivedAt) || Date.now();
            return false;
        }

        const configuredAmount = Number(lottery.cashAmount);
        const cashAmount = Number.isFinite(configuredAmount) && configuredAmount > 0
            ? Math.round(configuredAmount * 100) / 100
            : parseYtCharLotteryCashAmount(lottery.prize);
        const isCash = lottery.prizeType === 'cash' || cashAmount > 0;
        let payCredited = false;
        if (isCash && cashAmount > 0) {
            payCredited = typeof window.addPayTransaction === 'function'
                && window.addPayTransaction(cashAmount, `YouTube 抽奖中奖 · ${lottery.hostName || '主播'}`, 'income') !== false;
            if (!payCredited) {
                if (window.showToast) window.showToast('奖金暂未到账，请稍后重新进入直播间领取');
                return false;
            }
        }

        const receivedAt = Date.now();
        channelState.dataCenter.receivedGifts.unshift({
            id: `yt_received_gift_${lottery.id}`,
            lotteryId: lottery.id,
            name: lottery.prize || '神秘礼物',
            type: isCash ? 'cash' : 'gift',
            cashAmount: isCash ? cashAmount : 0,
            payCredited,
            fromId: lottery.hostId || resolved?.channel?.id || '',
            fromName: lottery.hostName || resolved?.channel?.name || '主播',
            liveId: resolved?.live?.id || currentVideoData?.id || '',
            receivedAt
        });
        channelState.dataCenter.receivedGifts = channelState.dataCenter.receivedGifts.slice(0, 100);
        lottery.prizeType = isCash ? 'cash' : 'gift';
        lottery.cashAmount = isCash ? cashAmount : 0;
        lottery.payCredited = payCredited;
        lottery.rewardGrantedAt = receivedAt;
        if (typeof window.renderDataCenter === 'function') window.renderDataCenter();
        return true;
    }

    function renderYtCharLiveLottery(lottery = getYtCharLiveLottery(), shouldOpen = true) {
        if (!ytCharLiveLotteryModal || !lottery) return;
        const channelName = currentVideoData?.channelData?.name || lottery.hostName || '主播';
        const isCompleted = lottery.status === 'completed';
        if (ytCharLiveLotteryTitle) ytCharLiveLotteryTitle.textContent = isCompleted ? '开奖结果' : `${channelName} 发起了抽奖`;
        if (ytCharLiveLotteryPrize) ytCharLiveLotteryPrize.textContent = `奖品：${lottery.prize || '神秘礼物'}`;
        if (ytCharLiveLotteryCountdown) {
            ytCharLiveLotteryCountdown.textContent = isCompleted
                ? `共 ${Array.isArray(lottery.participants) ? lottery.participants.length : 0} 人参与`
                : `开奖倒计时 ${formatYtCharLotteryCountdown(Number(lottery.endAt) - Date.now())}`;
        }
        if (ytCharLiveLotteryActions) ytCharLiveLotteryActions.style.display = (!isCompleted && !lottery.joined && !lottery.declined) ? 'flex' : 'none';
        if (ytCharLiveLotteryClose) {
            ytCharLiveLotteryClose.style.display = (isCompleted || lottery.joined || lottery.declined) ? 'block' : 'none';
            ytCharLiveLotteryClose.textContent = isCompleted ? '知道了' : '先收起';
        }
        if (ytCharLiveLotteryStatus) {
            if (!isCompleted) {
                ytCharLiveLotteryStatus.textContent = lottery.joined
                    ? '已参与，等待开奖…'
                    : (lottery.declined ? '你选择了不参与本次抽奖' : '是否参与本次抽奖？');
            } else if (!lottery.joined) {
                ytCharLiveLotteryStatus.textContent = '你没有参与本次抽奖';
            } else if (lottery.userWon) {
                const rewardDestination = lottery.prizeType === 'cash' ? '，奖金已收入 Pay' : '，奖品已放入数据中心';
                ytCharLiveLotteryStatus.textContent = `恭喜你中奖，获得「${lottery.prize || '神秘礼物'}」${rewardDestination}`;
            } else {
                ytCharLiveLotteryStatus.textContent = `本次未中奖，中奖者：${lottery.winner?.name || '其他观众'}`;
            }
        }
        if (shouldOpen) ytCharLiveLotteryModal.classList.add('active');
    }

    function finalizeYtCharLiveLottery() {
        const resolved = resolveCanonicalYtCharLive();
        const lottery = resolved?.live?.charLottery;
        if (!resolved || !lottery || lottery.status !== 'active') return;
        const participants = Array.isArray(lottery.participants) ? lottery.participants : [];
        const winner = participants.length ? participants[Math.floor(Math.random() * participants.length)] : null;
        lottery.status = 'completed';
        lottery.completedAt = Date.now();
        lottery.winner = winner ? { ...winner } : null;
        lottery.userWon = Boolean(lottery.joined && winner?.id === 'user_channel_id');
        if (lottery.userWon) grantYtCharLotteryUserReward(lottery, resolved);
        currentVideoData.charLottery = lottery;
        stopYtCharLiveLotteryTimer();
        renderYtCharLiveLotteryInlineStatus(lottery);
        const resultText = lottery.userWon
            ? `恭喜你抽中了「${lottery.prize || '神秘礼物'}」！`
            : `抽奖结束，中奖的是 ${lottery.winner?.name || '一位观众'}。`;
        addCharLiveBubble(resultText, { skipPersist: true });
        recordCharContent(resultText, false);
        saveYoutubeData();
        renderYtCharLiveLottery(lottery, true);
    }

    function startYtCharLiveLotteryTimer() {
        stopYtCharLiveLotteryTimer();
        const lottery = getYtCharLiveLottery();
        if (!lottery || lottery.status !== 'active') {
            renderYtCharLiveLotteryInlineStatus(lottery);
            return;
        }
        if (Date.now() >= Number(lottery.endAt)) {
            finalizeYtCharLiveLottery();
            return;
        }
        renderYtCharLiveLotteryInlineStatus(lottery);
        renderYtCharLiveLottery(lottery, lottery.joined !== true && lottery.declined !== true);
        ytCharLiveLotteryTimer = setInterval(() => {
            const latest = getYtCharLiveLottery();
            if (!latest || latest.status !== 'active') {
                stopYtCharLiveLotteryTimer();
                renderYtCharLiveLotteryInlineStatus(latest);
                return;
            }
            if (Date.now() >= Number(latest.endAt)) finalizeYtCharLiveLottery();
            else {
                renderYtCharLiveLotteryInlineStatus(latest);
                renderYtCharLiveLottery(latest, false);
            }
        }, 1000);
    }

    function isExplicitYtCharLotteryRequest(userMessage) {
        const text = String(userMessage || '').trim().toLowerCase();
        if (!text) return false;
        const mentionsLottery = /抽奖|抽个奖|开奖|giveaway|raffle/.test(text);
        const asksForAction = /来|开|发|搞|办|安排|整|想要|想看|要不要|可以|能不能|可不可以|请|希望|吧|呗|一下|抽一个|抽个|do|start|host|run|please|can you|could you/.test(text);
        return mentionsLottery && asksForAction;
    }

    function normalizeYtCharLotteryDecision(value) {
        if (value === true || value === 1) return true;
        if (value === false || value === 0) return false;
        const normalized = String(value ?? '').trim().toLowerCase();
        if (['true', 'yes', 'start', 'accept', 'accepted', 'agree', 'agreed', '同意', '愿意', '开始', '发起'].includes(normalized)) return true;
        if (['false', 'no', 'decline', 'declined', 'reject', 'rejected', 'refuse', '拒绝', '不愿意', '不发'].includes(normalized)) return false;
        return null;
    }

    function inferYtCharLotteryAcceptance(responseObj) {
        const values = Array.isArray(responseObj?.charBubbles)
            ? responseObj.charBubbles
            : (responseObj?.charResponse ? [responseObj.charResponse] : []);
        const text = values.map(value => (
            typeof value === 'object' ? (value?.text || value?.content || '') : value
        )).join(' ').trim();
        if (!text) return false;
        if (/(?:不发|不开|不抽|拒绝|算了|下次|改天|今天不|暂时不).{0,10}(?:抽奖|开奖|奖品)|(?:抽奖|开奖).{0,10}(?:不行|不要|算了|拒绝)/.test(text)) return false;
        return /(?:好|可以|行|当然|那就|来|现在|马上|开始|安排|发|开|送).{0,14}(?:抽奖|开奖|奖品)|(?:抽奖|开奖|奖品).{0,14}(?:开始|安排|来|发|开|送)/.test(text);
    }

    function maybeStartYtCharLiveLottery(responseObj) {
        const resolved = resolveCanonicalYtCharLive();
        if (!resolved || !currentVideoData?.isLive || resolved.live.charLottery?.status === 'active') return false;
        const suggestion = responseObj?.lotterySuggestion || responseObj?.randomLottery || {};
        const explicitRequest = responseObj?._explicitLotteryRequest === true;
        const explicitPrize = String(suggestion.prize?.name || suggestion.prize || suggestion.reward || suggestion.gift || '').trim();
        if (explicitRequest) {
            const rawDecision = suggestion.shouldStart
                ?? suggestion.start
                ?? suggestion.accepted
                ?? suggestion.agree
                ?? suggestion.hasLottery
                ?? suggestion.enabled;
            const shouldStart = normalizeYtCharLotteryDecision(rawDecision);
            if (shouldStart === false) return false;
            if (shouldStart !== true && !explicitPrize && !inferYtCharLotteryAcceptance(responseObj)) return false;
        } else if (Math.random() >= YT_CHAR_LOTTERY_TRIGGER_RATE) {
            return false;
        }
        const prize = String(explicitPrize || '主播准备的神秘礼物').slice(0, 80);
        const declaredPrizeType = String(suggestion.prizeType || suggestion.type || '').trim().toLowerCase();
        const suggestedCashAmount = Number(suggestion.cashAmount ?? suggestion.amount ?? suggestion.prize?.amount);
        const cashAmount = declaredPrizeType === 'gift'
            ? 0
            : (Number.isFinite(suggestedCashAmount) && suggestedCashAmount > 0
                ? Math.round(suggestedCashAmount * 100) / 100
                : parseYtCharLotteryCashAmount(prize));
        const prizeType = declaredPrizeType === 'gift' ? 'gift' : (declaredPrizeType === 'cash' || cashAmount > 0 ? 'cash' : 'gift');
        const durationSec = Math.max(10, Math.min(60, Math.round(Number(suggestion.durationSec ?? suggestion.duration) || 30)));
        const viewerCount = Math.max(1, Number(resolved.live.viewerCount) || parseInt(String(resolved.live.views || '').replace(/[^0-9]/g, ''), 10) || 100);
        const simulatedCount = Math.max(8, Math.min(40, Math.round(viewerCount * (0.05 + Math.random() * 0.08))));
        const participants = Array.from({ length: simulatedCount }, (_, index) => ({
            id: `char_lottery_viewer_${index}_${Date.now()}`,
            name: `观众${index + 1}`,
            source: 'frontend-random'
        }));
        const now = Date.now();
        const previousLottery = resolved.live.charLottery;
        if (previousLottery) {
            resolved.live.charLotteryHistory = Array.isArray(resolved.live.charLotteryHistory)
                ? resolved.live.charLotteryHistory
                : [];
            if (!resolved.live.charLotteryHistory.some(item => String(item?.id) === String(previousLottery.id))) {
                resolved.live.charLotteryHistory.push({
                    ...previousLottery,
                    participants: Array.isArray(previousLottery.participants) ? previousLottery.participants.map(item => ({ ...item })) : [],
                    winner: previousLottery.winner ? { ...previousLottery.winner } : null
                });
            }
        }
        const lottery = {
            id: `char_live_lottery_${now}_${Math.random().toString(36).slice(2, 8)}`,
            status: 'active',
            hostId: resolved.channel.id,
            hostName: resolved.channel.name || '主播',
            prize,
            prizeType,
            cashAmount: prizeType === 'cash' ? cashAmount : 0,
            durationSec,
            createdAt: now,
            endAt: now + durationSec * 1000,
            participants,
            joined: false,
            declined: false,
            winner: null,
            userWon: false
        };
        resolved.live.charLottery = lottery;
        currentVideoData.charLottery = lottery;
        saveYoutubeData();
        const announcement = `来抽个奖吧，奖品是「${prize}」，想参加的记得点一下。`;
        addCharLiveBubble(announcement, { skipPersist: true });
        recordCharContent(announcement, false);
        startYtCharLiveLotteryTimer();
        return true;
    }

    ytCharLiveLotteryJoin?.addEventListener('click', event => {
        event.stopPropagation();
        const resolved = resolveCanonicalYtCharLive();
        const lottery = resolved?.live?.charLottery;
        if (!resolved || !lottery || lottery.status !== 'active' || lottery.joined) return;
        const user = getCurrentYtViewer();
        lottery.joined = true;
        lottery.declined = false;
        lottery.joinedAt = Date.now();
        lottery.participants = Array.isArray(lottery.participants) ? lottery.participants : [];
        lottery.participants.push({ id: 'user_channel_id', name: user.name || '我', source: 'user-choice', joinedAt: lottery.joinedAt });
        saveYoutubeData();
        ytCharLiveLotteryModal?.classList.remove('active');
        renderYtCharLiveLotteryInlineStatus(lottery);
    });

    ytCharLiveLotterySkip?.addEventListener('click', event => {
        event.stopPropagation();
        const lottery = getYtCharLiveLottery();
        if (!lottery || lottery.status !== 'active') return;
        lottery.declined = true;
        lottery.joined = false;
        saveYoutubeData();
        renderYtCharLiveLottery(lottery, true);
    });

    ytCharLiveLotteryClose?.addEventListener('click', event => {
        event.stopPropagation();
        ytCharLiveLotteryModal?.classList.remove('active');
    });

    window.addEventListener('resize', positionYtCharLiveLotteryStatus);
    window.visualViewport?.addEventListener('resize', positionYtCharLiveLotteryStatus);

    function beginYtCharConnection() {
        const resolved = resolveCanonicalYtCharLive();
        if (!resolved || resolved.live.connection?.status === 'connecting' || resolved.live.connection?.status === 'active') return;
        const user = getCurrentYtViewer();
        resolved.live.connection = {
            id: `connection_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            status: 'connecting',
            requestedAt: Date.now(),
            startedAt: null,
            kickoffAttemptedAt: null,
            kickoffCompleted: false,
            transcript: [],
            participant: {
                id: 'user_channel_id',
                name: user.name || '我',
                avatar: user.avatarUrl || user.avatar || '',
                persona: user.persona || ''
            }
        };
        currentVideoData.connection = resolved.live.connection;
        saveYoutubeData();
        scheduleYtCharConnectionRestore();
        if (window.showToast) window.showToast('连线请求已发送，等待对方接通...');
    }

    function endYtCharConnection() {
        const resolved = resolveCanonicalYtCharLive();
        const connection = resolved?.live?.connection;
        if (!resolved || !connection) return;
        resolved.live.guest = { ...(connection.participant || {}) };
        resolved.live.connectionEndedAt = Date.now();
        resolved.live.connectionHistory = [
            ...(Array.isArray(resolved.live.connectionHistory) ? resolved.live.connectionHistory : []),
            {
                id: connection.id,
                participant: { ...(connection.participant || {}) },
                requestedAt: connection.requestedAt || null,
                startedAt: connection.startedAt || null,
                endedAt: resolved.live.connectionEndedAt,
                transcript: Array.isArray(connection.transcript) ? connection.transcript.map(item => ({ ...item })) : []
            }
        ];
        resolved.live.connection = null;
        currentVideoData.connection = null;
        stopYtCharConnectionVisualTimers();
        saveYoutubeData();
        renderYtCharConnection();
        if (window.showToast) window.showToast('连线已结束');
    }

    if (ytPlayerConnectBtn) {
        ytPlayerConnectBtn.addEventListener('click', event => {
            event.stopPropagation();
            if (!currentVideoData?.isLive || currentVideoData?.channelData?.id === 'user_channel_id') return;
            const confirmConnection = () => beginYtCharConnection();
            if (window.showCustomModal) {
                window.showCustomModal({
                    title: '请求连线',
                    message: `确定向 ${currentVideoData.channelData?.name || '当前主播'} 发起连线吗？`,
                    confirmText: '请求连线',
                    cancelText: '取消',
                    onConfirm: confirmConnection
                });
            } else {
                confirmConnection();
            }
        });
    }

    ytCharLiveConnectionCard?.querySelector('.yt-live-connection-exit')?.addEventListener('click', event => {
        event.stopPropagation();
        endYtCharConnection();
    });

    function addCharLiveBubble(value, options = {}) {
        if (currentVideoData?.isLive && currentVideoData?.channelData?.id !== 'user_channel_id') resolveCanonicalYtCharLive();
        const localized = getYtPlayerLocalizedContent(value);
        if (!ytCharSpeechBubble || (!localized.text && !options.loading) || !currentVideoData || !currentVideoData.isLive) return;
        const bubble = document.createElement('div');
        bubble.className = options.isNarrative ? 'yt-char-live-narrative' : 'yt-char-live-bubble';
        if (options.loading) {
            bubble.innerHTML = '<i class="fas fa-ellipsis-h fa-fade"></i>';
            bubble.dataset.loading = 'true';
        } else {
            bubble.innerHTML = `
                <div class="yt-localized-original">${ytPlayerEscapeHtml(localized.text)}</div>
                ${renderYtSecondaryTranslation(localized.translationZh, 'yt-char-live-translation')}
            `;
            
            // Persist the bubble if it's not narrative
            if (!options.isNarrative && !options.skipPersist) {
                if (!currentVideoData.initialBubbles) currentVideoData.initialBubbles = [];
                currentVideoData.initialBubbles.push(localized.translationZh ? localized : localized.text);
                
                // Update the underlying data structure (use replacement instead of push to avoid reference duplication)
                const channel = currentVideoData.channelData;
                if (channel) {
                    if (channel.id === 'user_channel_id' && channelState.activeUserLive) {
                        channelState.activeUserLive.initialBubbles = [...currentVideoData.initialBubbles];
                    } else if (channel.generatedContent && channel.generatedContent.currentLive) {
                        channel.generatedContent.currentLive.initialBubbles = [...currentVideoData.initialBubbles];
                    }
                    
                    if (typeof mockVideos !== 'undefined') {
                        const mv = mockVideos.find(v => v.title === currentVideoData.title && v.isLive === currentVideoData.isLive);
                        if (mv) mv.initialBubbles = [...currentVideoData.initialBubbles];
                    }
                    
                    if (typeof saveYoutubeData === 'function') saveYoutubeData();
                }
            }
        }
        ytCharSpeechBubble.style.display = 'flex';
        ytCharSpeechBubble.appendChild(bubble);

        const lifetime = options.loading ? 0 : (options.lifetime || 8000);
        if (lifetime > 0) {
            setTimeout(() => {
                bubble.style.opacity = '0';
                setTimeout(() => {
                    bubble.remove();
                    if (ytCharSpeechBubble && ytCharSpeechBubble.children.length === 0) {
                        ytCharSpeechBubble.style.display = 'none';
                    }
                }, 1000);
            }, lifetime);
        }
        return bubble;
    }

    function removeCharLiveLoadingBubbles() {
        if (!ytCharSpeechBubble) return;
        ytCharSpeechBubble.querySelectorAll('[data-loading="true"]').forEach(item => item.remove());
        if (ytCharSpeechBubble.children.length === 0) {
            ytCharSpeechBubble.style.display = 'none';
        }
    }

    function ensureCharLiveChrome(video) {
        if (!playerView || !ytPlayerVideoArea) return;
        const isCharLive = !!(video && video.isLive && video.channelData && video.channelData.id !== 'user_channel_id');
        playerView.classList.toggle('yt-char-live-mode', isCharLive);

        let titleOverlay = document.getElementById('yt-player-live-title-overlay');
        if (!titleOverlay) {
            titleOverlay = document.createElement('div');
            titleOverlay.id = 'yt-player-live-title-overlay';
            titleOverlay.className = 'yt-player-live-title-overlay';
            ytPlayerVideoArea.appendChild(titleOverlay);
        }

        let statsOverlay = document.getElementById('yt-player-live-stats-overlay');
        if (!statsOverlay) {
            statsOverlay = document.createElement('div');
            statsOverlay.id = 'yt-player-live-stats-overlay';
            statsOverlay.className = 'yt-player-live-stats-overlay';
            ytPlayerVideoArea.appendChild(statsOverlay);
        }

        let actionsOverlay = document.getElementById('yt-player-live-actions-overlay');
        if (!actionsOverlay) {
            actionsOverlay = document.createElement('div');
            actionsOverlay.id = 'yt-player-live-actions-overlay';
            actionsOverlay.className = 'yt-player-live-actions-overlay';
            actionsOverlay.innerHTML = `
                <button type="button" class="yt-player-live-action-btn" id="yt-player-live-gift-btn"><i class="fas fa-gift"></i></button>
                <button type="button" class="yt-player-live-action-btn" id="yt-player-live-menu-btn"><i class="fas fa-plus"></i></button>
                <div class="yt-player-live-action-menu" id="yt-player-live-action-menu">
                    <div class="yt-player-live-menu-item" id="yt-player-live-all-content-btn"><i class="fas fa-list-alt"></i><span style="margin-left: 6px;">全部内容</span></div>
                    <div class="yt-player-live-menu-item" id="yt-player-live-continue-btn"><i class="fas fa-forward"></i><span style="margin-left: 6px;">继续直播</span></div>
                    <div class="yt-player-live-menu-item yt-player-live-menu-item-danger" id="yt-player-live-end-btn"><i class="fas fa-stop"></i><span style="margin-left: 6px;">结束直播</span></div>
                </div>
            `;
            ytPlayerVideoArea.appendChild(actionsOverlay);

            const liveGiftBtn = actionsOverlay.querySelector('#yt-player-live-gift-btn');
            const liveMenuBtn = actionsOverlay.querySelector('#yt-player-live-menu-btn');
            const liveMenu = actionsOverlay.querySelector('#yt-player-live-action-menu');
            const liveContinueBtn = actionsOverlay.querySelector('#yt-player-live-continue-btn');
            const liveAllContentBtn = actionsOverlay.querySelector('#yt-player-live-all-content-btn');
            const liveEndBtn = actionsOverlay.querySelector('#yt-player-live-end-btn');

            if (liveGiftBtn) {
                liveGiftBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const giftBtn = document.getElementById('yt-gift-btn');
                    if (giftBtn) giftBtn.click();
                });
            }
            if (liveMenuBtn && liveMenu) {
                liveMenuBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    liveMenu.classList.toggle('active');
                });
            }
            if (liveContinueBtn) {
                liveContinueBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (liveMenu) liveMenu.classList.remove('active');
                    const actionContinue = document.getElementById('yt-player-action-continue');
                    if (actionContinue) actionContinue.click();
                });
            }
            if (liveAllContentBtn) {
                liveAllContentBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (liveMenu) liveMenu.classList.remove('active');
                    openCharAllContentSheet();
                });
            }
            if (liveEndBtn) {
                liveEndBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (liveMenu) liveMenu.classList.remove('active');
                    document.getElementById('yt-player-action-end')?.click();
                });
            }
        }

        let allContentSheet = document.getElementById('yt-char-all-content-sheet');
        if (!allContentSheet) {
            allContentSheet = document.createElement('div');
            allContentSheet.id = 'yt-char-all-content-sheet';
            allContentSheet.className = 'bottom-sheet-overlay yt-char-all-content-modal-overlay';
            allContentSheet.innerHTML = `
                <div class="bottom-sheet yt-char-all-content-modal-card" style="background: #ffffff;">
                    <div class="sheet-header" style="padding: 16px; border-bottom: 1px solid #f2f2f2; display: flex; justify-content: space-between; align-items: center;">
                        <h3 class="sheet-title" style="margin: 0; font-size: 18px; font-weight: 600;">全部内容</h3>
                        <div>
                            <button id="clear-yt-all-content-btn" style="background: none; border: none; font-size: 14px; cursor: pointer; color: #ff3b30; margin-right: 16px; font-weight: 500;">清空</button>
                            <button class="sheet-close" id="close-yt-all-content-btn" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #606060;"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                    <div class="sheet-content" id="yt-char-all-content-list" style="min-height: 30vh; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 4px; background: #ffffff;">
                    </div>
                </div>
            `;
            document.body.appendChild(allContentSheet);
            
            const closeBtn = allContentSheet.querySelector('#close-yt-all-content-btn');
            closeBtn.addEventListener('click', () => allContentSheet.classList.remove('active'));
            
            const clearBtn = allContentSheet.querySelector('#clear-yt-all-content-btn');
            clearBtn.addEventListener('click', () => {
                if (window.showCustomModal) {
                    window.showCustomModal({
                        title: '清空内容',
                        message: '确定要清空该直播间的所有历史内容吗？此操作无法撤销。',
                        confirmText: '清空',
                        cancelText: '取消',
                        isDestructive: true,
                        onConfirm: () => {
                            if (currentVideoData && currentVideoData.channelData) {
                                currentVideoData.channelData.liveHistory = [];
                                currentVideoData.initialBubbles = [];
                                
                                const channel = currentVideoData.channelData;
                                if (channel.id === 'user_channel_id' && channelState.activeUserLive) {
                                    channelState.activeUserLive.history = [];
                                    channelState.activeUserLive.initialBubbles = [];
                                } else if (channel.generatedContent && channel.generatedContent.currentLive) {
                                    channel.generatedContent.currentLive.initialBubbles = [];
                                    channel.generatedContent.currentLive.liveTranscript = [];
                                }
                                currentVideoData.liveTranscript = [];
                                
                                if(typeof saveYoutubeData === 'function') saveYoutubeData();
                                openCharAllContentSheet(); // refresh
                                if(window.showToast) window.showToast('历史内容已清空');
                            }
                        }
                    });
                }
            });

            allContentSheet.addEventListener('mousedown', (e) => {
                if (e.target === allContentSheet) allContentSheet.classList.remove('active');
            });
        }

        titleOverlay.style.display = isCharLive ? 'block' : 'none';
        statsOverlay.style.display = isCharLive ? 'block' : 'none';
        actionsOverlay.style.display = isCharLive ? 'flex' : 'none';
        if (isCharLive) {
            titleOverlay.innerHTML = `
                <div>${ytPlayerEscapeHtml(video.title || 'Live')}</div>
                ${renderYtSecondaryTranslation(video.titleTranslationZh, 'yt-player-live-title-translation')}
            `;
            statsOverlay.textContent = getYtViewsDisplay(video, true);
        }

        const backIcon = playerBackBtn ? playerBackBtn.querySelector('i') : null;
        if (backIcon) {
            backIcon.className = isCharLive ? 'fas fa-xmark' : 'fas fa-chevron-left';
        }
    }

    function openCharAllContentSheet() {
        const sheet = document.getElementById('yt-char-all-content-sheet');
        const list = document.getElementById('yt-char-all-content-list');
        if (!sheet || !list) return;

        list.innerHTML = '';
        
        if (!currentVideoData || !currentVideoData.channelData || !currentVideoData.channelData.liveHistory || currentVideoData.channelData.liveHistory.length === 0) {
            list.innerHTML = '<div style="text-align: center; color: #8e8e93; padding: 20px;">暂无内容</div>';
        } else {
            currentVideoData.channelData.liveHistory.forEach(item => {
                const el = document.createElement('div');
                const localized = getYtPlayerLocalizedContent(item, currentVideoData.channelData);
                el.style.backgroundColor = item.type === 'narrative' ? 'transparent' : '#f2f2f2';
                el.style.padding = item.type === 'narrative' ? '4px 12px' : '10px 14px';
                el.style.borderRadius = item.type === 'narrative' ? '0' : '16px';
                el.style.color = item.type === 'narrative' ? '#8e8e93' : '#0f0f0f';
                el.style.fontStyle = item.type === 'narrative' ? 'italic' : 'normal';
                el.style.textAlign = item.type === 'narrative' ? 'center' : 'left';
                el.style.fontSize = item.type === 'narrative' ? '12px' : '14px';
                el.style.lineHeight = '1.4';
                el.style.alignSelf = item.type === 'narrative' ? 'center' : 'flex-start';
                el.style.maxWidth = '85%';
                
                let timeStr = new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                if (item.type !== 'narrative') {
                    // removed the visible time string to make bubbles look more connected
                    el.innerHTML = `
                        ${item.name ? `<div style="font-size:11px;color:#606060;margin-bottom:3px;">${ytPlayerEscapeHtml(item.name)}</div>` : ''}
                        <div>${ytPlayerEscapeHtml(localized.text)}</div>
                        ${renderYtSecondaryTranslation(localized.translationZh)}
                    `;
                } else {
                    el.innerHTML = `
                        <div>${ytPlayerEscapeHtml(localized.text)}</div>
                        ${renderYtSecondaryTranslation(localized.translationZh)}
                    `;
                }
                list.appendChild(el);
            });
            
            setTimeout(() => {
                list.scrollTop = list.scrollHeight;
            }, 10);
        }
        
        sheet.classList.add('active');
    }

    function appendYtRealtimeCommentsDivider(container) {
        if (!container || container.querySelector('.yt-replay-realtime-divider')) return;
        const divider = document.createElement('div');
        divider.className = 'yt-replay-realtime-divider';
        divider.innerHTML = '<span>以上为实时评论</span>';
        container.appendChild(divider);
    }

    function setYtReplayCommentsButtonState(isVisible, isLoading = false) {
        if (!ytPlayerReplayCommentsBtn) return;
        ytPlayerReplayCommentsBtn.style.display = isVisible ? 'flex' : 'none';
        ytPlayerReplayCommentsBtn.disabled = !!isLoading;
        ytPlayerReplayCommentsBtn.setAttribute('aria-busy', String(!!isLoading));
        ytPlayerReplayCommentsBtn.innerHTML = isLoading
            ? '<i class="fas fa-circle-notch fa-spin"></i>'
            : '<i class="fas fa-search"></i>';
    }

    function setYtPlayerDeleteVideoButtonState(isVisible) {
        if (!ytPlayerDeleteVideoBtn) return;
        ytPlayerDeleteVideoBtn.style.display = isVisible ? 'flex' : 'none';
        ytPlayerDeleteVideoBtn.disabled = !!ytReplayCommentRequestId;
    }

    function openVideoPlayer(video) {
        try {
            if(!playerView) return;
            if (typeof window.releaseYtChatKeyboardLock === 'function') window.releaseYtChatKeyboardLock(playerView);
            const userLiveView = document.getElementById('yt-user-live-view');
            if (userLiveView) userLiveView.classList.remove('active');
            currentVideoData = video;
            if(!currentVideoData._originalTitle) currentVideoData._originalTitle = video.title;
            let channel = video.channelData;

            if (video.isLive && channel?.id && channel.id !== 'user_channel_id') {
                const canonicalChannel = (Array.isArray(mockSubscriptions) ? mockSubscriptions : [])
                    .find(item => String(item?.id) === String(channel.id));
                const canonicalLive = canonicalChannel?.generatedContent?.currentLive;
                const requestedLiveId = video.id || video.liveId;
                if (canonicalChannel && canonicalLive && (!requestedLiveId || !canonicalLive.id || String(requestedLiveId) === String(canonicalLive.id))) {
                    channel = canonicalChannel;
                    currentVideoData.channelData = canonicalChannel;
                    currentVideoData.id = canonicalLive.id || requestedLiveId || '';
                    currentVideoData.liveId = currentVideoData.id;
                    currentVideoData.comments = canonicalLive.comments || [];
                    currentVideoData.initialBubbles = canonicalLive.initialBubbles || [];
                    currentVideoData.liveTranscript = canonicalLive.liveTranscript || [];
                    currentVideoData.connection = canonicalLive.connection || null;
                    currentVideoData.guest = canonicalLive.guest || null;
                }
            }

            if(!channel) return;
            ensureCharLiveChrome(video);

            let displayThumb = video.thumbnail;
            if (!video.isLive && channel.generatedContent && channel.generatedContent.pastVideos) {
                const savedMatch = channel.generatedContent.pastVideos.find(v => v.title === video.title);
                if (savedMatch && savedMatch.thumbnail) displayThumb = savedMatch.thumbnail;
            } else if (video.isLive && channel.generatedContent && channel.generatedContent.currentLive && channel.generatedContent.currentLive.thumbnail) {
                displayThumb = channel.generatedContent.currentLive.thumbnail;
            }
            
            if(ytPlayerThumbnail) ytPlayerThumbnail.src = displayThumb;
            currentVideoData.thumbnail = displayThumb; 

            const titleEl = document.getElementById('yt-player-title');
            if(titleEl) {
                titleEl.innerHTML = `
                    <div>${ytPlayerEscapeHtml(video.title || '无标题')}</div>
                    ${renderYtSecondaryTranslation(video.titleTranslationZh, 'yt-video-title-translation')}
                `;
            }
            
            const viewsEl = document.getElementById('yt-player-views');
            if(viewsEl) viewsEl.textContent = getYtViewsDisplay(video, video.isLive);
            
            const avatarEl = document.getElementById('yt-player-avatar');
            if(avatarEl) {
                avatarEl.src = typeof resolveYtChannelAvatar === 'function'
                    ? resolveYtChannelAvatar(channel)
                    : (channel.avatar || '');
            }
            
            const channelNameEl = document.getElementById('yt-player-channel-name');
            if(channelNameEl) channelNameEl.textContent = channel.name || '未知频道';
            
            const channelSubsEl = document.getElementById('yt-player-channel-subs');
            if(channelSubsEl) channelSubsEl.textContent = channel.subs || '1.2万 订阅者';

            clearCharLiveBubbles();

            const liveBadge = document.getElementById('yt-player-live-badge');
            const chatTitle = document.getElementById('yt-player-chat-title');
            const chatContainer = document.getElementById('yt-player-chat-container');
            const giftBtn = document.getElementById('yt-gift-btn');
            const plusMenu = document.querySelector('.yt-player-menu-container');
            const isReplay = isYtLiveReplay(video);
            const isPastVideo = !video.isLive;
            
            if(chatContainer) chatContainer.innerHTML = ''; 

            if (video.isLive) {
                setYtReplayCommentsButtonState(false);
                setYtPlayerDeleteVideoButtonState(false);
                syncPlayerChatInputMode(true);
                if(liveBadge) liveBadge.style.display = 'block';
                if(chatTitle) chatTitle.textContent = '实时聊天';
                if(giftBtn) giftBtn.style.display = 'flex';
                if(plusMenu) plusMenu.style.display = 'flex';
                
                currentChatHistory = [];
                
                let bubblesToPlay = video.initialBubbles;
                window.ytLiveTimeouts = window.ytLiveTimeouts || [];

                if (!bubblesToPlay || !Array.isArray(bubblesToPlay) || bubblesToPlay.length === 0) {
                    bubblesToPlay = getYtLiveFallbackBubbles(channel);
                    bubblesToPlay.forEach((bubbleText, index) => {
                        let tId = setTimeout(() => {
                            addCharLiveBubble(bubbleText);
                        }, 500 + (index * 2000));
                        window.ytLiveTimeouts.push(tId);
                    });
                } else {
                    if (bubblesToPlay.length > 0) {
                        // Just display the last bubble instantly to show current state, don't duplicate persist
                        addCharLiveBubble(bubblesToPlay[bubblesToPlay.length - 1], { skipPersist: true });
                    }
                }
                
                if(video.comments && Array.isArray(video.comments) && video.comments.length > 0) {
                    video.comments.forEach(c => {
                        const comment = normalizeYtGeneratedComment(c, channel);
                        addChatMessage(comment.name, comment.text, true, comment.amount, comment.color, true, comment.senderType || '', comment.translationZh);
                    });
                    
                    if(chatInterval) clearInterval(chatInterval);
                }
                if (channel.id !== 'user_channel_id') {
                    scheduleYtCharConnectionRestore();
                    const restoredCharLottery = getYtCharLiveLottery();
                    if (restoredCharLottery?.status === 'active') startYtCharLiveLotteryTimer();
                    else if (restoredCharLottery?.status === 'completed') renderYtCharLiveLottery(restoredCharLottery, false);
                }
            } else {
                stopYtCharConnectionVisualTimers();
                if (ytCharLiveConnectionCard) ytCharLiveConnectionCard.style.display = 'none';
                setYtCharConnectionButtonState(null);
                setYtReplayCommentsButtonState(isPastVideo, !!ytReplayCommentRequestId);
                setYtPlayerDeleteVideoButtonState(isPastVideo);
                syncPlayerChatInputMode(false);
                if(liveBadge) liveBadge.style.display = 'none';
                if(chatTitle) chatTitle.textContent = '评论';
                if(giftBtn) giftBtn.style.display = 'none';
                if(plusMenu) plusMenu.style.display = 'none';
                if(chatInterval) clearInterval(chatInterval);
                
                if(video.comments && Array.isArray(video.comments) && video.comments.length > 0) {
                    const realtimeCommentCount = getYtReplayRealtimeCommentCount(video);
                    video.comments.forEach((c, index) => {
                        const comment = normalizeYtGeneratedComment(c, channel);
                        addChatMessage(comment.name, comment.text, false, comment.amount, comment.color, true, comment.senderType || '', comment.translationZh);
                        if (isReplay && realtimeCommentCount > 0 && index + 1 === realtimeCommentCount) {
                            appendYtRealtimeCommentsDivider(chatContainer);
                        }
                    });
                } else {
                    if(chatContainer) chatContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: #666;" id="yt-empty-comment-msg">暂无评论</div>`;
                }
            }

            playerView.classList.add('active');
        } catch (e) {
            console.error("Error opening video player:", e);
            if(window.showToast) window.showToast('打开视频出错');
        }
    }

    function getYtSuperChatTier(amount) {
        const numericAmount = Number(String(amount ?? '').replace(/[^\d.]/g, '')) || 0;
        if (numericAmount >= 2000) return { key: 'red', color: '#d00000', textColor: '#ffffff' };
        if (numericAmount >= 1000) return { key: 'magenta', color: '#e91e63', textColor: '#ffffff' };
        if (numericAmount >= 500) return { key: 'orange', color: '#f57c00', textColor: '#ffffff' };
        if (numericAmount >= 200) return { key: 'yellow', color: '#ffca28', textColor: '#1f1f1f' };
        if (numericAmount >= 100) return { key: 'green', color: '#00bfa5', textColor: '#10201d' };
        if (numericAmount >= 50) return { key: 'cyan', color: '#00b8d4', textColor: '#102024' };
        return { key: 'blue', color: '#1565c0', textColor: '#ffffff' };
    }

    window.getYtSuperChatTier = getYtSuperChatTier;

    function addChatMessage(name, text, isLive = true, amount = null, color = null, skipPersist = false, senderType = '', translationZh = '') {
        if (isLive && currentVideoData?.channelData?.id !== 'user_channel_id') resolveCanonicalYtCharLive();
        const chatContainer = document.getElementById('yt-player-chat-container');
        if(!chatContainer) return;

        const safeName = ytPlayerEscapeHtml(name || '');
        const safeText = ytPlayerEscapeHtml(text || '');
        const safeTranslation = String(translationZh || '').trim();
        const translationHtml = safeTranslation ? `
            <span class="yt-comment-translation-toggle" role="button" tabindex="0" aria-expanded="false">翻译</span>
            <div class="yt-comment-translation" hidden>${ytPlayerEscapeHtml(safeTranslation)}</div>
        ` : '';

        const emptyMsg = document.getElementById('yt-empty-comment-msg');
        if(emptyMsg) emptyMsg.remove();

        const row = document.createElement('div');
        if (isLive) row.className = 'yt-live-chat-row-anim';
        
        if (amount) {
            const superChatTier = getYtSuperChatTier(amount);
            let displayAmount = amount;
            if (typeof amount === 'number' || /^\d+(\.\d+)?$/.test(String(amount))) {
                displayAmount = '￥' + amount;
            }
            row.style.backgroundColor = superChatTier.color;
            row.style.setProperty('--yt-sc-text-color', superChatTier.textColor);
            row.dataset.superChatTier = superChatTier.key;
            row.style.padding = '8px 12px';
            row.style.borderRadius = '8px';
            row.style.marginBottom = '4px';
            row.innerHTML = `
                <div style="font-weight: bold; font-size: 13px; color:${superChatTier.textColor}; opacity:0.88; margin-bottom: 4px;">${safeName} <span style="margin-left: 8px;">${ytPlayerEscapeHtml(displayAmount)}</span></div>
                <div style="font-size: 14px; color:${superChatTier.textColor};">${safeText}${translationHtml}</div>
            `;
        } else {
            row.style.display = 'flex';
            row.style.gap = '8px';
            row.style.alignItems = 'flex-start';
            row.style.marginBottom = '12px'; // slightly more margin for VOD
            
            const grayColors = ['#333333', '#4d4d4d', '#666666', '#808080', '#999999', '#b3b3b3'];
            const randColor = grayColors[Math.floor(Math.random() * grayColors.length)];
            
            row.innerHTML = `
                <div style="width:24px; height:24px; border-radius:50%; background-color:${randColor}; display:flex; justify-content:center; align-items:center; color:#fff; font-size:10px; font-weight:bold; flex-shrink:0;">
                    ${ytPlayerEscapeHtml(name && name.length > 0 ? name[0].toUpperCase() : '?')}
                </div>
                <div style="font-size:13px; margin-top:2px;">
                    <span class="yt-chat-msg-name" style="font-size:12px; margin-right:4px;">${safeName}</span>
                    <span class="yt-chat-msg-text">${safeText}</span>
                    ${translationHtml}
                </div>
            `;
        }

        bindYtCommentTranslationToggle(row);
        
        // append to bottom for both live and VOD as requested (最新评论置底)
        chatContainer.appendChild(row);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        // Persist comment
        if (currentVideoData && !skipPersist) {
            if (!currentVideoData.comments) currentVideoData.comments = [];
            const storedComment = { name: name, text: text, amount: amount, color: amount ? getYtSuperChatTier(amount).color : color };
            if (senderType) storedComment.senderType = senderType;
            if (safeTranslation) storedComment.translationZh = safeTranslation;
            currentVideoData.comments.push(storedComment);
            
            // Update the underlying data structure (use replacement instead of push to avoid reference duplication)
            const channel = currentVideoData.channelData;
            if (channel) {
                if (channel.id === 'user_channel_id' && channelState.activeUserLive) {
                    channelState.activeUserLive.comments = [...currentVideoData.comments];
                } else if (isLive && channel.generatedContent && channel.generatedContent.currentLive) {
                    channel.generatedContent.currentLive.comments = [...currentVideoData.comments];
                } else if (!isLive && channel.generatedContent && channel.generatedContent.pastVideos) {
                    const savedMatch = channel.generatedContent.pastVideos.find(v => (
                        currentVideoData.id && v.id === currentVideoData.id
                    )) || channel.generatedContent.pastVideos.find(v => v.title === currentVideoData.title);
                    if (savedMatch) {
                        savedMatch.comments = [...currentVideoData.comments];
                    }
                } else if (!isLive && channel.id === 'user_channel_id' && channelState.pastVideos) {
                    const savedMatch = channelState.pastVideos.find(v => v.title === currentVideoData.title);
                    if (savedMatch) {
                        savedMatch.comments = [...currentVideoData.comments];
                    }
                }
                
                // Keep also the global mockVideos up to date
                if (typeof mockVideos !== 'undefined') {
                    const mv = mockVideos.find(v => currentVideoData.id && v.id === currentVideoData.id)
                        || mockVideos.find(v => v.title === currentVideoData.title && v.isLive === isLive);
                    if (mv) {
                        mv.comments = [...currentVideoData.comments];
                    }
                }
                if (typeof saveYoutubeData === 'function') saveYoutubeData();
            }
        }
        
        if(isLive) {
            currentChatHistory.push({
                time: new Date().toLocaleTimeString(),
                name: name || '未知',
                text: text || '',
                amount: amount,
                color: amount ? getYtSuperChatTier(amount).color : color,
                ...(safeTranslation ? { translationZh: safeTranslation } : {}),
                ...(senderType ? { senderType } : {})
            });
            if (currentChatHistory.length > 50) currentChatHistory.shift(); 
        }
    }

    // --- VOD Comment API ---
    async function getVODResponse(userMessage, titleOverride, requireTranslations = false) {
        if (!currentSubChannelData) return null;
        const char = currentSubChannelData;
        
        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
            return { charReplies: ["（请配置API后体验互动）"], fanReplies: [] };
        }
        
        const effectiveYtUser = getCurrentYtViewer();
        const userPersona = effectiveYtUser.persona || '普通观众';
        const wbContext = window.getYtWorldBookContext
            ? window.getYtWorldBookContext(`${titleOverride || ''}\n${userMessage || ''}`)
            : '';

        let promptStr = channelState.vodPrompt || defaultVODPrompt;
        const charPersona = typeof window.getYtChannelPersonaWithRelationships === 'function'
            ? window.getYtChannelPersonaWithRelationships(char)
            : (char.desc || '未知');
        let finalPrompt = promptStr
            .replace(/{char}/g, char.name || '')
            .replace(/{char_persona}/g, charPersona)
            .replace(/{user}/g, effectiveYtUser.name || '我')
            .replace(/{user_persona}/g, userPersona)
            .replace(/{msg}/g, userMessage || '')
            .replace(/{wb_context}/g, wbContext)
            .replace(/{video_title}/g, titleOverride || (currentVideoData ? currentVideoData.title : '未知内容'));
        if (typeof window.buildYtLocalizedJsonContract === 'function') {
            finalPrompt += window.buildYtLocalizedJsonContract(char, 'every charReplies and fanReplies text field');
        }
        if (getYtPlayerLanguageContext(char).enabled) {
            finalPrompt += `\n- For this response, charReplies and fanReplies must both be arrays of {"name":"nickname or empty string","text":"original","translationZh":"Simplified Chinese translation or empty string"}.`;
        }
        if (requireTranslations) {
            finalPrompt += `\n\n当前互动发生在 YouTube 社群贴文评论区。charReplies 和 fanReplies 的每一项都必须返回对象 {"name":"昵称或空字符串","text":"原文","translationZh":"中文翻译或空字符串"}。text 不是中文时必须填写自然中文翻译；text 是中文时 translationZh 必须为空字符串。只返回合法 JSON。`;
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
                    messages: [{ role: 'user', content: finalPrompt }],
                    temperature: 0.8,
                    response_format: { type: "json_object" } 
                })
            });

            if (!res.ok) throw new Error(`API Error`);
            const data = await res.json();
            let resultText = data.choices[0].message.content;
            resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
            return sanitizeObj(JSON.parse(resultText));
        } catch (error) {
            console.error('VOD API Error:', error);
            return {
                charReplies: ["（网络似乎断开了...）"],
                fanReplies: []
            };
        }
    }

    function getYtVodReplyText(reply) {
        if (typeof reply === 'string') return reply.trim();
        if (!reply || typeof reply !== 'object') return '';
        return String(reply.text || reply.reply || reply.comment || reply.content || reply.message || '').trim();
    }

    function getYtVodReplyTranslation(reply) {
        if (!reply || typeof reply !== 'object') return '';
        return String(reply.translationZh || reply.translation || '').trim();
    }

    function renderVODResponse(responseObj, isPost = false) {
        if (!responseObj) return;
        
        window.ytLiveTimeouts = window.ytLiveTimeouts || [];
        
        const effectiveYtUser = getCurrentYtViewer();
        const userName = effectiveYtUser.name || '用户';
        
        let replies = [];
        if (responseObj.charReplies && Array.isArray(responseObj.charReplies)) {
            replies = responseObj.charReplies;
        } else if (responseObj.charReply) {
            replies = [responseObj.charReply];
        }

        // Add char replies with prefix
        replies.map(reply => ({ text: getYtVodReplyText(reply), translationZh: getYtVodReplyTranslation(reply) })).filter(item => item.text).forEach((reply, index) => {
            let tId = setTimeout(() => {
                const replyText = `回复 @${userName} : ${reply.text}`;
                if (isPost) {
                    const translatedReply = reply.translationZh ? `回复 @${userName}：${reply.translationZh}` : '';
                    addPostCommentMessage(currentSubChannelData.name, replyText, false, translatedReply);
                } else {
                    addChatMessage(currentSubChannelData.name, replyText, false, null, null, false, '', reply.translationZh ? `回复 @${userName}：${reply.translationZh}` : '');
                }
            }, 1000 + (index * 1500));
            window.ytLiveTimeouts.push(tId);
        });

        if (responseObj.fanReplies && Array.isArray(responseObj.fanReplies)) {
            responseObj.fanReplies = responseObj.fanReplies
                .map((reply) => {
                    const text = getYtVodReplyText(reply);
                    if (!text) return null;
                    if (reply && typeof reply === 'object') {
                        return {
                            ...reply,
                            name: reply.name || reply.user || reply.nickname,
                            text
                        };
                    }
                    return { text };
                })
                .filter(Boolean);
        }

        // Add fan replies with prefix
        if (responseObj.fanReplies && Array.isArray(responseObj.fanReplies)) {
            responseObj.fanReplies.forEach((c, i) => {
                let tId = setTimeout(() => {
                    const replyText = `回复 @${userName} : ${c.text}`;
                    if (isPost) {
                        const translationZh = getYtVodReplyTranslation(c);
                        const translatedReply = translationZh ? `回复 @${userName}：${translationZh}` : '';
                        addPostCommentMessage(c.name || '观众', replyText, false, translatedReply);
                    } else {
                        const translationZh = getYtVodReplyTranslation(c);
                        addChatMessage(c.name || '观众', replyText, false, null, null, false, '', translationZh ? `回复 @${userName}：${translationZh}` : '');
                    }
                }, 1500 + (replies.length * 1500) + (i * 1500));
                window.ytLiveTimeouts.push(tId);
            });
        }
        
        // Remove loading indicator
        const loadingMsg = document.getElementById('yt-reply-loading');
        if (loadingMsg) loadingMsg.remove();
        
        const postLoadingMsg = document.getElementById('yt-post-reply-loading');
        if (postLoadingMsg) postLoadingMsg.remove();
    }

    function findStoredYtReplay(video, channel) {
        if (channel?.id === 'user_channel_id') {
            const userPastVideos = channelState?.pastVideos;
            if (!Array.isArray(userPastVideos)) return null;
            return userPastVideos.find(item => video?.id && item.id === video.id)
                || userPastVideos.find(item => item.title === video?.title && !item.isLive)
                || null;
        }
        const pastVideos = channel?.generatedContent?.pastVideos;
        if (!Array.isArray(pastVideos)) return null;
        return pastVideos.find(item => video?.id && item.id === video.id)
            || pastVideos.find(item => item.title === video?.title && !item.isLive)
            || null;
    }

    function formatYtReplayPromptTranscript(items) {
        if (!Array.isArray(items) || items.length === 0) return '无主播文字记录';
        return items.map((item) => {
            const type = item?.type === 'narrative' ? '场景/动作' : '主播发言';
            const translation = String(item?.translationZh || '').trim();
            return `${type}: ${String(item?.text || '').trim()}${translation ? `（中文：${translation}）` : ''}`;
        }).filter(line => !line.endsWith(': ')).join('\n');
    }

    function formatYtReplayPromptComments(comments, count) {
        if (!Array.isArray(comments) || count <= 0) return '无实时评论';
        return comments.slice(0, count).map(comment => {
            const translation = String(comment?.translationZh || comment?.translation || '').trim();
            return `${String(comment?.name || '观众')}: ${String(comment?.text || '').trim()}${translation ? `（中文：${translation}）` : ''}`;
        }).join('\n');
    }

    async function getYtReplayTopLevelComments(video, channel) {
        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
            throw new Error('API_NOT_CONFIGURED');
        }
        const effectiveYtUser = getCurrentYtViewer();
        const charPersona = channel?.id === 'user_channel_id'
            ? (effectiveYtUser.persona || channel?.desc || '普通创作者')
            : (typeof window.getYtChannelPersonaWithRelationships === 'function'
                ? window.getYtChannelPersonaWithRelationships(channel)
                : (channel?.desc || '未知'));
        const guest = video?.guest;
        const guestName = guest?.name || '无嘉宾';
        const isLiveReplay = isYtLiveReplay(video);
        const realtimeCount = getYtReplayRealtimeCommentCount(video);
        const sourceDescription = isLiveReplay
            ? `【本场直播内容】
${formatYtReplayPromptTranscript(video?.liveTranscript)}

【直播期间的实时评论】
${formatYtReplayPromptComments(video?.comments, realtimeCount)}`
            : `【视频内容线索】
这是普通往期视频，不是直播回放。请根据视频标题、标题翻译、主播人设和已有评论准确推断视频主题；不要声称自己看过直播，也不要表达错过直播。

【已有视频评论】
${formatYtReplayPromptComments(video?.comments, Math.min(20, Array.isArray(video?.comments) ? video.comments.length : 0))}`;
        const commentRequest = isLiveReplay
            ? '请生成 12–16 条与本场直播内容直接相关的回放评论。可以讨论具体内容、表达错过直播的遗憾、分享看回放的感受，或回应上面的实时观众'
            : '请生成 12–16 条与本期视频内容直接相关的普通视频评论。可以讨论视频主题、具体观点、观看感受或回应已有评论';
        const wbContext = window.getYtWorldBookContext
            ? window.getYtWorldBookContext(`${video?.title || ''}\n${sourceDescription}`)
            : '';
        const prompt = `你正在为一个已经发布的 YouTube ${isLiveReplay ? '直播回放' : '普通往期视频'}生成新的顶层评论。

频道主播：${channel?.name || '未知'}
主播人设：${charPersona}
本场嘉宾：${guestName}
视频标题：${video?.title || '未知'}
标题中文翻译：${video?.titleTranslationZh || '无'}
世界书：${wbContext || '无'}

${sourceDescription}

${commentRequest}，但不要生成主播“${channel?.name || ''}”、嘉宾“${guestName}”或用户“${effectiveYtUser.name || '我'}”本人发言。

【国际化要求｜最高优先级】
- 评论者来自世界各地，昵称应符合各自国家或地区。
- 至少一半评论必须使用非中文，整体至少自然混合 3 种语言，可包含英语、日语、韩语、法语、西班牙语及其他语言。
- 每条外语评论必须提供自然准确的简体中文翻译；中文评论的 translationZh 必须为空字符串。
- 只返回合法 JSON：{"comments":[{"name":"viewer name","text":"原文","translationZh":"简体中文翻译或空字符串"}]}`;

        const endpoint = window.u2Api.resolveChatCompletionsEndpoint(window.apiConfig.endpoint);
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.apiConfig.apiKey}`
            },
            body: JSON.stringify({
                model: window.apiConfig.model || 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.9,
                response_format: { type: 'json_object' }
            })
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        let resultText = String(data?.choices?.[0]?.message?.content || '').trim();
        resultText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = sanitizeObj(JSON.parse(resultText));
        const blockedNames = new Set([
            String(channel?.name || '').trim().toLocaleLowerCase(),
            String(guest?.name || '').trim().toLocaleLowerCase(),
            String(effectiveYtUser.name || '').trim().toLocaleLowerCase()
        ].filter(Boolean));
        const comments = (Array.isArray(parsed?.comments) ? parsed.comments : [])
            .map(comment => normalizeYtGeneratedComment(comment, channel))
            .filter(comment => comment.name && comment.text && !blockedNames.has(comment.name.toLocaleLowerCase()))
            .slice(0, 16);
        const translatedCount = comments.filter(comment => comment.translationZh).length;
        if (comments.length < 10 || translatedCount < Math.ceil(comments.length / 2)) {
            throw new Error('INVALID_REPLAY_COMMENTS');
        }
        return comments;
    }

    function appendYtReplayGeneratedComments(video, channel, comments) {
        const storedReplay = findStoredYtReplay(video, channel);
        const target = storedReplay || video;
        const existingComments = Array.isArray(target.comments)
            ? target.comments.map(comment => normalizeYtGeneratedComment(comment, channel)).filter(comment => comment.text)
            : [];
        const nextComments = existingComments.concat(comments.map(comment => ({ ...comment })));
        target.comments = nextComments;
        video.comments = nextComments;

        if (typeof mockVideos !== 'undefined') {
            const mockReplay = mockVideos.find(item => video.id && item.id === video.id)
                || mockVideos.find(item => item.title === video.title && !item.isLive);
            if (mockReplay) mockReplay.comments = nextComments.map(comment => ({ ...comment }));
        }

        if (currentVideoData === video && playerView?.classList.contains('active')) {
            comments.forEach(comment => addChatMessage(
                comment.name,
                comment.text,
                false,
                null,
                null,
                true,
                '',
                comment.translationZh
            ));
        }
        if (typeof saveYoutubeData === 'function') saveYoutubeData();
    }

    async function triggerYtReplayCommentGeneration() {
        const targetVideo = currentVideoData;
        const channel = targetVideo?.channelData;
        if (!targetVideo || !channel || targetVideo.isLive || ytReplayCommentRequestId) return;
        const requestId = targetVideo.id || `${channel.id}:${targetVideo.title}`;
        ytReplayCommentRequestId = requestId;
        setYtReplayCommentsButtonState(true, true);
        setYtPlayerDeleteVideoButtonState(true);
        try {
            const comments = await getYtReplayTopLevelComments(targetVideo, channel);
            appendYtReplayGeneratedComments(targetVideo, channel, comments);
            if (window.showToast) window.showToast(`已生成 ${comments.length} 条回放评论`);
        } catch (error) {
            console.error('Replay comment generation failed:', error);
            if (window.showToast) {
                window.showToast(error?.message === 'API_NOT_CONFIGURED'
                    ? '请先配置 API'
                    : '回放评论生成失败，请重试');
            }
        } finally {
            if (ytReplayCommentRequestId === requestId) ytReplayCommentRequestId = '';
            const activeVideo = currentVideoData;
            const shouldShow = !!(
                playerView?.classList.contains('active')
                && !activeVideo?.isLive
            );
            setYtReplayCommentsButtonState(shouldShow, false);
            setYtPlayerDeleteVideoButtonState(shouldShow);
        }
    }

    if (ytPlayerReplayCommentsBtn) {
        ytPlayerReplayCommentsBtn.addEventListener('click', triggerYtReplayCommentGeneration);
    }

    if (ytPlayerDeleteVideoBtn) {
        ytPlayerDeleteVideoBtn.addEventListener('click', () => {
            const targetVideo = currentVideoData;
            const channel = targetVideo?.channelData;
            if (!targetVideo || targetVideo.isLive || !channel) return;
            if (ytReplayCommentRequestId) {
                if (window.showToast) window.showToast('请等待评论生成完成');
                return;
            }
            if (!window.showCustomModal) return;
            window.showCustomModal({
                title: '删除视频',
                message: '确定要删除这个往期视频吗？',
                confirmText: '删除',
                cancelText: '取消',
                isDestructive: true,
                onConfirm: () => {
                    const pastVideos = channel.id === 'user_channel_id'
                        ? channelState?.pastVideos
                        : channel.generatedContent?.pastVideos;
                    if (!Array.isArray(pastVideos)) return;
                    const index = pastVideos.findIndex(video => targetVideo.id && video.id === targetVideo.id);
                    const fallbackIndex = index >= 0 ? index : pastVideos.findIndex(video => video.title === targetVideo.title && !video.isLive);
                    if (fallbackIndex < 0) return;
                    pastVideos.splice(fallbackIndex, 1);
                    if (typeof saveYoutubeData === 'function') saveYoutubeData();
                    playerView?.classList.remove('active', 'yt-char-live-mode');
                    setYtReplayCommentsButtonState(false);
                    setYtPlayerDeleteVideoButtonState(false);
                    currentVideoData = null;
                    if (channel.id === 'user_channel_id') {
                        document.querySelector('#profile-main-tabs .yt-sliding-tab[data-target="past"]')?.click();
                    } else {
                        renderGeneratedContent('past');
                    }
                    if (window.showToast) window.showToast('视频已删除');
                }
            });
        });
    }

    // AI API call for interactive response (Live)
    async function getCharResponse(userMessage, isSC = false, amount = 0, isContinue = false, options = {}) {
        if (!currentVideoData || !currentVideoData.channelData) return null;
        const char = currentVideoData.channelData;
        const requestedLiveId = ensureYtCharLiveId(char.generatedContent?.currentLive, char.id);
        if (!requestedLiveId) return null;
        const charLiveState = resolveCanonicalYtCharLive()?.live;
        const explicitLotteryRequest = isExplicitYtCharLotteryRequest(userMessage);
        const activeConnection = charLiveState?.connection?.status === 'active' ? charLiveState.connection : null;
        const connectionHistory = Array.isArray(charLiveState?.connectionHistory) ? charLiveState.connectionHistory : [];
        const hasManagedConnectionSession = !!charLiveState?.connection || connectionHistory.length > 0;
        const guest = hasManagedConnectionSession
            ? (activeConnection?.participant || null)
            : currentVideoData.guest;
        
        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
            if (options.connectionKickoff) return { _error: 'API_NOT_CONFIGURED' };
            return { charBubbles: ["（请配置API后体验互动）"], passerbyComments: [] };
        }
        
        addCharLiveBubble('', { loading: true });
        
        const effectiveYtUser = getCurrentYtViewer();
        const userName = effectiveYtUser.name || '我';
        const userPersona = effectiveYtUser.persona || '普通观众';
        const wbContext = window.getYtWorldBookContext
            ? window.getYtWorldBookContext(`${currentVideoData?.title || ''}\n${userMessage || ''}`)
            : '';

        // Get last summary for live context
        let lastSummary = '暂无';
        if (channelState.liveSummaries && channelState.liveSummaries.length > 0) {
            const s = channelState.liveSummaries[channelState.liveSummaries.length - 1];
            lastSummary = `主题: ${s.title}, 内容: ${s.content}`;
        }

        let systemPromptStr = channelState.systemPrompt || defaultPrompt;

        let contextClueStr = isContinue 
            ? "注意：现在没有新的观众发言。请你作为主播，根据上下文自主推进直播内容，主动找话题，进行环境描写或动作描写，不要傻等观众，保持直播间的活跃氛围。" 
            : "";
            
        let msgContextStr = userMessage 
            ? `刚刚有一位观众（${userName}）发了一条弹幕说：“${userMessage}”。请主要针对这条留言进行回复。`
            : "";

        const charPersona = typeof window.getYtChannelPersonaWithRelationships === 'function'
            ? window.getYtChannelPersonaWithRelationships(char)
            : (char.desc || '未知');
        const guestPersona = guest && typeof window.getYtChannelPersonaWithRelationships === 'function'
            ? window.getYtChannelPersonaWithRelationships(guest)
            : (guest?.desc || '未知');
        let guestContextStr = guest 
            ? `\n特别注意：本场直播的联动嘉宾是"${guest.name}"，ta的人设："${guestPersona}"。你的回复中可以偶尔cue到嘉宾，或由你代为复述嘉宾说的话。`
            : "";

        const publicConnectionSessions = [...connectionHistory, ...(activeConnection ? [activeConnection] : [])];
        const publicConnectionContext = publicConnectionSessions.length
            ? publicConnectionSessions.map(session => {
                const participantName = session.participant?.name || 'User';
                const lines = (session.transcript || []).map(item => (
                    `${item.kind === 'narrative' ? '公开动作' : '公开发言'}｜${item.name || participantName}：${item.text || ''}`
                )).filter(Boolean).join('\n') || '尚无公开发言';
                return `${participantName}｜${session.endedAt ? '已结束' : '进行中'}\n${lines}`;
            }).join('\n\n')
            : '本场尚无连线公开记录。';
        const recentLiveTranscript = (Array.isArray(charLiveState?.liveTranscript) ? charLiveState.liveTranscript : [])
            .slice(-30)
            .map(item => {
                const localized = getYtPlayerLocalizedContent(item, char);
                if (!localized.text) return '';
                const speaker = item?.name || (item?.senderType === 'user' ? userName : (char.name || '主播'));
                const kind = item?.kind === 'narrative' || item?.type === 'narrative' || item?.type === 'connection-narrative'
                    ? '公开动作/环境'
                    : '公开发言';
                return `${kind}｜${speaker}：${localized.text}`;
            })
            .filter(Boolean);
        const recentLiveComments = (Array.isArray(currentChatHistory) ? currentChatHistory : [])
            .slice(-20)
            .map(item => `${item?.name || '观众'}：${item?.text || ''}`)
            .filter(line => !line.endsWith('：'));
        const liveContinuityContext = [
            ...recentLiveTranscript,
            ...recentLiveComments.map(line => `近期弹幕｜${line}`)
        ].join('\n') || '本场暂时没有可用的历史内容。';
        const privateUserPersona = typeof window.getYtChannelPersonaWithRelationships === 'function'
            ? window.getYtChannelPersonaWithRelationships(effectiveYtUser, userPersona)
            : userPersona;

        let finalPrompt = systemPromptStr
            .replace(/{char}/g, char.name || '')
            .replace(/{char_persona}/g, charPersona)
            .replace(/{user}/g, userName)
            .replace(/{user_persona}/g, userPersona)
            .replace(/{guest}/g, guest ? guest.name : '无嘉宾')
            .replace(/{wb_context}/g, wbContext)
            .replace(/{live_summary_context}/g, lastSummary)
            .replace(/{msg}/g, userMessage || '')
            .replace(/{msg_context}/g, msgContextStr)
            .replace(/{context_clue}/g, contextClueStr + guestContextStr);

        const connectionStatusRule = activeConnection
            ? '当前连线仍在进行，可以继续实时对话。'
            : (connectionHistory.length > 0
                ? '当前没有任何在线连线；历史连线均已结束。主播和观众不得把历史参与者描述成仍在通话，也不得继续向其提问或等待其即时回答。'
                : '当前没有在线连线用户。');

        finalPrompt += `\n\n【主播私有连线资料】${activeConnection
            ? `当前连线用户：${activeConnection.participant?.name || userName}。完整人设与关系：${privateUserPersona}。主播可以据此理解并回应用户。`
            : '当前没有在线连线用户。'}
【连线实时状态】${connectionStatusRule}
【观众可见的公开连线记录】\n${publicConnectionContext}
【严格信息边界】fanComments、passerbyComments 和 randomSuperChat 只能依据公开昵称、公开发言与公开动作；不得引用、暗示或泄露主播私有连线资料。主播可以自然回顾已结束连线的公开内容，评论也可以偶尔提到“错过了刚才的联动”，但不要强制所有评论讨论旧连线。`;
        finalPrompt += `\n\n【本场直播最近公开内容｜按已发生事实处理】\n${liveContinuityContext}\n【连续性规则】以上内容都已经在本场直播中真实发生。主播必须记得自己已经说过什么，并从最后的内容自然承接；不得重新开场、失忆、重复刚说过的观点，或把已经发生的内容当成第一次听说。新回复应推进话题、补充新信息或回应最新变化。`;
            
        if (isSC) {
            finalPrompt += `\n注意：这不仅仅是一条弹幕，而是一条来自“${userName}”价值 ${amount} 元的 Super Chat（醒目留言）！这是非常慷慨的打赏！\n要求：\n1. 你的 charBubbles 必须明确提到“${userName}”的名字，并表现出相应的惊喜和感谢！\n2. 【重要】本次由于已经有观众打赏，**请将 randomSuperChat 设置为 {"hasSuperChat": false}，不要再生成其他人的打赏了**！`;
        }

        const liveLanguageContext = getYtPlayerLanguageContext(char);
        if (liveLanguageContext.enabled && typeof window.buildYtLocalizedJsonContract === 'function') {
            finalPrompt += window.buildYtLocalizedJsonContract(
                char,
                'narrative and every charBubbles item'
            );
            finalPrompt += `\n- For this live response, narrative must be {"text":"original","translationZh":"Simplified Chinese translation or empty string"}; charBubbles must be an array of the same object shape.\n- Use this exact localized object schema even if the editable prompt above requests strings.`;
        }
        finalPrompt += `\n\n【最高优先级：直播观众国际化协议】主播的 narrative 和 charBubbles 继续严格使用主播默认语言；但 fanComments、passerbyComments 和 randomSuperChat 是来自世界各地的观众，绝对不能统一成主播默认语言。fanComments 或 passerbyComments 每次必须返回 6–10 条；观众昵称要符合其国家或地区，评论需混合英语、日语、韩语、法语、西班牙语及其他自然语言，至少包含 3 种语言，且至少一半为非中文评论。每条 fanComments/passerbyComments 必须是 {"name":"viewer name","text":"观众自己的语言原文","translationZh":"自然准确的简体中文翻译或空字符串"}；text 非中文时 translationZh 必须填写，text 中文时必须为空字符串。randomSuperChat 也遵循相同原文与翻译规则。此协议覆盖上方任何要求观众跟随主播默认语言的内容。`;
        finalPrompt += `\n\n【主播气泡去重规则｜最高优先级】同一批 charBubbles 中禁止用不同措辞重复表达同一个回应、观点、感谢、称呼或结论；也禁止在后续气泡重新回答一次用户刚才的同一条留言。每条气泡必须承接上一条并提供新的信息、反应、动作或话题推进。生成完成后先自行检查并删除语义重复的气泡，只保留自然连续且各有新内容的气泡。`;
        if (explicitLotteryRequest) {
            finalPrompt += charLiveState?.charLottery?.status === 'active'
                ? `\n\n【User 明确请求抽奖】当前已有一轮抽奖正在进行，不能同时再次发起。lotterySuggestion 必须返回 {"shouldStart":false,"prize":"","prizeType":"gift","cashAmount":0,"durationSec":30}，主播应自然提醒 User 等待当前开奖。`
                : `\n\n【User 明确请求抽奖｜由 Char 自主决定】User 正在明确要求主播发抽奖。请严格根据主播完整人设、与 User 的关系、当前情绪和本场直播内容，决定主播愿不愿意发；不得默认同意，也不得由观众替主播决定。只能返回以下三种完全合法的 JSON 之一：礼物抽奖示例 lotterySuggestion={"shouldStart":true,"prize":"签名海报","prizeType":"gift","cashAmount":0,"durationSec":30}；现金抽奖示例 lotterySuggestion={"shouldStart":true,"prize":"¥66现金","prizeType":"cash","cashAmount":66,"durationSec":30}；拒绝示例 lotterySuggestion={"shouldStart":false,"prize":"","prizeType":"gift","cashAmount":0,"durationSec":30}。durationSec 可选择 10 到 60 的整数。只要 charBubbles 表示同意、答应、宣布奖品或声称马上开始，shouldStart 就必须为 true，且必须同时返回具体 prize；绝对不能出现“嘴上答应但 shouldStart=false 或漏掉 lotterySuggestion”的矛盾。shouldStart=false 时应按人设自然拒绝、回避或提出理由，绝对不能声称抽奖已经开始。禁止把 shouldStart 返回成字符串。`;
        } else {
            finalPrompt += `\n每次响应还要返回一个合法的候选抽奖对象。非现金示例：lotterySuggestion={"shouldStart":true,"prize":"签名海报","prizeType":"gift","cashAmount":0,"durationSec":30}；现金示例：lotterySuggestion={"shouldStart":true,"prize":"¥66现金","prizeType":"cash","cashAmount":66,"durationSec":30}。这只是候选奖品，前端仅会以极低概率真正触发抽奖；不要为了该字段强行让 charBubbles 宣布抽奖。`;
        }
        if (activeConnection) {
            finalPrompt += `\n当前连线有效时还必须返回 connectionNarrative={"text":"连线用户的公开环境、动作或氛围描写","translationZh":"简体中文翻译或空字符串"}。该描写会公开显示并写入会话记录。`;
        }
        if (options.connectionKickoff) {
            const connection = getActiveYtCharConnection();
            const participant = connection?.participant || getCurrentYtViewer();
            finalPrompt += `\n\n【本次是连线刚接通后的首次互动，优先级最高】连线用户：${participant?.name || 'User'}。请让主播根据私有完整人设自然回应连线接通，并让观众只根据公开信息围绕这次连线即时讨论。charBubbles 必须生成 1–3 条主播发言；connectionNarrative 必须非空；fanComments 或 passerbyComments 必须生成 10–14 条相关评论，不得少于 10 条。`;
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
                    messages: [{ role: 'user', content: finalPrompt }],
                    temperature: 0.8,
                    response_format: { type: "json_object" } 
                })
            });

            if (!res.ok) throw new Error(`API Error`);
            const data = await res.json();
            let resultText = data.choices[0].message.content;
            resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
            if (char.generatedContent?.currentLive?.id !== requestedLiveId || currentVideoData?.channelData?.id !== char.id) return null;
            const parsedResult = sanitizeObj(JSON.parse(resultText));
            if (options.connectionKickoff) {
                const bubbles = Array.isArray(parsedResult.charBubbles)
                    ? parsedResult.charBubbles
                    : (parsedResult.charResponse ? [parsedResult.charResponse] : []);
                const comments = Array.isArray(parsedResult.fanComments)
                    ? parsedResult.fanComments
                    : (Array.isArray(parsedResult.passerbyComments) ? parsedResult.passerbyComments : []);
                const connectionNarrative = getYtPlayerLocalizedContent(parsedResult.connectionNarrative, char);
                if (bubbles.length < 1 || comments.length < 10 || !connectionNarrative.text) throw new Error('INVALID_CONNECTION_KICKOFF');
            }
            return { ...parsedResult, _liveId: requestedLiveId, _explicitLotteryRequest: explicitLotteryRequest };
        } catch (error) {
            console.error('Interactive Live Error:', error);
            if (char.generatedContent?.currentLive?.id !== requestedLiveId) return null;
            if (options.connectionKickoff) return { _error: 'CONNECTION_RESPONSE_INVALID', _liveId: requestedLiveId };
            return {
                _liveId: requestedLiveId,
                charBubbles: ["（直播信号有点差...）"],
                passerbyComments: []
            };
        }
    }

    function recordCharContent(value, isNarrative = false) {
        if (!currentVideoData || !currentVideoData.channelData) return;
        if (currentVideoData.isLive && currentVideoData.channelData.id !== 'user_channel_id') resolveCanonicalYtCharLive();
        const localized = getYtPlayerLocalizedContent(value, currentVideoData.channelData);
        const transcriptItem = {
            type: isNarrative ? 'narrative' : 'bubble',
            text: localized.text,
            ...(localized.translationZh ? { translationZh: localized.translationZh } : {}),
            timestamp: new Date().getTime()
        };
        if (!currentVideoData.channelData.liveHistory) {
            currentVideoData.channelData.liveHistory = [];
        }
        currentVideoData.channelData.liveHistory.push(transcriptItem);
        const currentLive = currentVideoData.channelData.generatedContent?.currentLive;
        if (currentLive && currentVideoData.isLive) {
            if (!Array.isArray(currentLive.liveTranscript)) currentLive.liveTranscript = [];
            currentLive.liveTranscript.push({ ...transcriptItem });
            currentVideoData.liveTranscript = currentLive.liveTranscript;
            if (currentLive.connection?.status === 'active') {
                if (!Array.isArray(currentLive.connection.transcript)) currentLive.connection.transcript = [];
                currentLive.connection.transcript.push(normalizeYtConnectionTranscriptItem({
                    speakerType: 'char',
                    speakerId: currentVideoData.channelData.id,
                    name: currentVideoData.channelData.name || '主播',
                    text: localized.text,
                    translationZh: localized.translationZh,
                    kind: isNarrative ? 'narrative' : 'speech',
                    timestamp: transcriptItem.timestamp
                }));
            }
        }
        saveYoutubeData();
    }

    function renderAiResponse(responseObj) {
        if (!responseObj) return;
        if (currentVideoData?.isLive && currentVideoData?.channelData?.id !== 'user_channel_id') resolveCanonicalYtCharLive();
        if (responseObj._liveId && currentVideoData?.channelData?.generatedContent?.currentLive?.id !== responseObj._liveId) return;
        removeCharLiveLoadingBubbles();
        
        window.ytLiveTimeouts = window.ytLiveTimeouts || [];

        if (responseObj.narrative) {
            const narrative = getYtPlayerLocalizedContent(responseObj.narrative);
            const localizedNarrative = {
                text: narrative.text ? `（${narrative.text}）` : '',
                translationZh: narrative.translationZh ? `（${narrative.translationZh}）` : ''
            };
            recordCharContent(localizedNarrative, true);
            let tId = setTimeout(() => {
                addCharLiveBubble(localizedNarrative, { isNarrative: true });
            }, 500);
            window.ytLiveTimeouts.push(tId);
        }

        if (responseObj.connectionNarrative && getActiveYtCharConnection()?.status === 'active') {
            const tId = setTimeout(() => {
                const connection = getActiveYtCharConnection();
                if (!connection || connection.status !== 'active') return;
                const localized = getYtPlayerLocalizedContent(responseObj.connectionNarrative, currentVideoData?.channelData);
                if (!localized.text) return;
                addYtCharConnectionNarrative(localized);
                const item = normalizeYtConnectionTranscriptItem({
                    speakerType: 'user',
                    speakerId: connection.participant?.id || 'user_channel_id',
                    name: connection.participant?.name || 'User',
                    text: localized.text,
                    translationZh: localized.translationZh,
                    kind: 'narrative'
                });
                connection.transcript = Array.isArray(connection.transcript) ? connection.transcript : [];
                connection.transcript.push(item);
                const resolved = resolveCanonicalYtCharLive();
                if (resolved) {
                    resolved.live.liveTranscript = Array.isArray(resolved.live.liveTranscript) ? resolved.live.liveTranscript : [];
                    resolved.live.liveTranscript.push({ type: 'connection-narrative', senderType: 'user', ...item });
                    resolved.channel.liveHistory = Array.isArray(resolved.channel.liveHistory) ? resolved.channel.liveHistory : [];
                    resolved.channel.liveHistory.push({ type: 'connection-narrative', senderType: 'user', ...item });
                    saveYoutubeData();
                }
            }, 700);
            window.ytLiveTimeouts.push(tId);
        }

        if (responseObj.randomSuperChat && responseObj.randomSuperChat.hasSuperChat) {
            let tId = setTimeout(() => {
                addChatMessage(
                    responseObj.randomSuperChat.name || '神秘人', 
                    responseObj.randomSuperChat.text || '', 
                    true, 
                    responseObj.randomSuperChat.displayAmount || responseObj.randomSuperChat.amount || 30, 
                    getYtSuperChatTier(responseObj.randomSuperChat.amount || responseObj.randomSuperChat.displayAmount || 30).color,
                    false,
                    '',
                    responseObj.randomSuperChat.translationZh || ''
                );
            }, Math.floor(Math.random() * 2000) + 500);
            window.ytLiveTimeouts.push(tId);
        }

        let bubbles = [];
        if (responseObj.charBubbles && Array.isArray(responseObj.charBubbles)) {
            bubbles = responseObj.charBubbles;
        } else if (responseObj.charResponse) {
            bubbles = [responseObj.charResponse];
        }

        if (bubbles.length > 0) {
            bubbles.forEach((bubbleValue, index) => {
                recordCharContent(bubbleValue, false);
                let tId = setTimeout(() => {
                    addCharLiveBubble(bubbleValue);
                    // 主播的话不再显示在下方评论区，仅在气泡显示
                }, 1000 + (index * 2500)); 
                window.ytLiveTimeouts.push(tId);
            });
        } else {
            if(ytCharSpeechBubble && ytCharSpeechBubble.children.length === 0) ytCharSpeechBubble.style.display = 'none';
        }

        const commentsArr = responseObj.fanComments || responseObj.passerbyComments;
        if (commentsArr && Array.isArray(commentsArr)) {
            let totalDelay = 2000;
            commentsArr.forEach((c) => {
                totalDelay += Math.floor(Math.random() * 2000) + 500;
                let tId = setTimeout(() => {
                    addChatMessage(c.name || '观众', c.text, true, null, null, false, '', c.translationZh || c.translation || '');
                }, totalDelay);
                window.ytLiveTimeouts.push(tId);
            });
        }
        maybeStartYtCharLiveLottery(responseObj);
    }

    async function generateLiveSummary() {
        if (!currentVideoData || !currentVideoData.channelData) return null;
        const char = currentVideoData.channelData;
        
        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
            if(window.showToast) window.showToast('请先配置 API 以生成总结');
            return null;
        }

        const effectiveYtUser = getCurrentYtViewer();
        const userPersona = effectiveYtUser.persona || '普通观众';
        
        let historyStr = "";
        if (currentChatHistory.length > 0) {
            historyStr = currentChatHistory.map(item => {
                if(item.amount) return `[${item.time}] ${item.name} 打赏了 ${item.amount}元: ${item.text}`;
                return `[${item.time}] ${item.name}: ${item.text}`;
            }).join('\n');
        } else {
            historyStr = "（暂无详细聊天记录）";
        }

        let promptStr = channelState.summaryPrompt || defaultSummaryPrompt;
        const charPersona = typeof window.getYtChannelPersonaWithRelationships === 'function'
            ? window.getYtChannelPersonaWithRelationships(char)
            : (char.desc || '未知');
        
        if (!promptStr.includes('newSubs')) {
            promptStr += `\n\n请在JSON中额外返回一个 "newSubs" 字段（整数），代表本次直播带来的新增订阅数。`;
        }

        const wbContext = window.getYtWorldBookContext
            ? window.getYtWorldBookContext(`${char?.name || ''}\n${historyStr}`)
            : '';
        const hasWorldBookPlaceholder = promptStr.includes('{wb_context}');
        let finalPrompt = promptStr
            .replace(/{char}/g, char.name || '')
            .replace(/{char_persona}/g, charPersona)
            .replace(/{user}/g, userPersona)
            .replace(/{current_time}/g, new Date().toLocaleString())
            .replace(/{chat_history}/g, historyStr)
            .replace(/{wb_context}/g, wbContext);
        if (!hasWorldBookPlaceholder && wbContext) {
            finalPrompt += `\n\n世界书内容：\n${wbContext}`;
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
                    messages: [{ role: 'user', content: finalPrompt }],
                    temperature: 0.7,
                    response_format: { type: "json_object" } 
                })
            });

            if (!res.ok) throw new Error(`API Error`);
            const data = await res.json();
            let resultText = data.choices[0].message.content;
            resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
            const summaryObj = sanitizeObj(JSON.parse(resultText));
            summaryObj.charName = char.name || '未知';
            
            if(!channelState.liveSummaries) channelState.liveSummaries = [];
            channelState.liveSummaries.push(summaryObj);
            
            // Generate World Book Entry
            if (window.autoSaveSummaryToWorldBook) {
                window.autoSaveSummaryToWorldBook(`${char.name} 直播记录`, summaryObj.content || summaryObj.summary || JSON.stringify(summaryObj));
            }
            
            // Update Char Subs
            if (summaryObj.newSubs && typeof summaryObj.newSubs === 'number') {
                const currentSubsNum = parseSubs(char.subs);
                char.subs = formatSubs(currentSubsNum + summaryObj.newSubs);
                
                const subIndex = mockSubscriptions.findIndex(s => s.id === char.id);
                if (subIndex > -1) {
                    mockSubscriptions[subIndex].subs = char.subs;
                }
                
                if (currentSubChannelData && currentSubChannelData.id === char.id) {
                    const subsEl = document.getElementById('sub-channel-subs');
                    if (subsEl) subsEl.textContent = `${char.subs} 订阅者`;
                }
            }
            
            saveYoutubeData();
            if(window.showToast) window.showToast('直播总结生成完毕并已保存');
            
            if (typeof window.releaseYtChatKeyboardLock === 'function') window.releaseYtChatKeyboardLock();
            if(playerView) playerView.classList.remove('active');
            if(chatInterval) clearInterval(chatInterval);
            clearCharLiveBubbles();

        } catch (error) {
            console.error('Summary Error:', error);
            if(window.showToast) window.showToast('生成总结失败');
        }
    }


    const chatInput = document.getElementById('yt-player-chat-input');
    const chatSend = document.getElementById('yt-player-chat-send');
    const chatApiBtn = document.getElementById('yt-player-chat-api');
    let isPlayerChatApiLoading = false;

    function stopPlayerControlEvent(e) {
        if (!e) return;
        e.stopPropagation();
    }

    const ytPlayerChatContainer = document.getElementById('yt-player-chat-container');
    const playerPlusBtn = document.getElementById('yt-player-plus-btn');
    const playerActionMenu = document.getElementById('yt-player-action-menu');
    const actionContinue = document.getElementById('yt-player-action-continue');
    const actionSummary = document.getElementById('yt-player-action-summary');
    const actionEndLive = document.getElementById('yt-player-action-end');

    [
        ytPlayerVideoArea,
        playerBackBtn,
        ytPlayerChatContainer,
        chatInput,
        chatSend,
        chatApiBtn,
        ytPlayerConnectBtn,
        ytCharLiveConnectionCard,
        playerPlusBtn,
        document.getElementById('yt-gift-btn')
    ].filter(Boolean).forEach((el) => {
        el.addEventListener('click', stopPlayerControlEvent);
        el.addEventListener('pointerdown', stopPlayerControlEvent);
    });

    if (ytPlayerChatContainer) {
        let isDraggingPlayerChat = false;
        ytPlayerChatContainer.addEventListener('touchstart', () => { isDraggingPlayerChat = false; }, { passive: true });
        ytPlayerChatContainer.addEventListener('touchmove', () => { isDraggingPlayerChat = true; }, { passive: true });
        ytPlayerChatContainer.addEventListener('touchend', () => {
            if (isDraggingPlayerChat) {
                if (chatInput && document.activeElement === chatInput) chatInput.blur();
            }
        });
        ytPlayerChatContainer.addEventListener('click', () => {
            if (chatInput && document.activeElement === chatInput) chatInput.blur();
        });
        const playerBackBtnInner = document.getElementById('yt-player-back-btn');
        if (playerBackBtnInner) {
            playerBackBtnInner.addEventListener('click', () => {
                if (chatInput && document.activeElement === chatInput) chatInput.blur();
            });
        }

    }

    if (chatInput) {
        chatInput.addEventListener('focus', () => {
            if (typeof window.setYtChatKeyboardLock === 'function') window.setYtChatKeyboardLock(playerView, true);
            else if (playerView) playerView.classList.add('keyboard-open');
        });
        chatInput.addEventListener('blur', () => {
            if (typeof window.setYtChatKeyboardLock === 'function') window.setYtChatKeyboardLock(playerView, false);
            else if (playerView) playerView.classList.remove('keyboard-open');
            window.resetYtViewportOffset?.();
        });
    }

    function syncPlayerChatInputMode(isLive) {
        if (chatInput) {
            chatInput.placeholder = isLive ? '发送消息...' : '发表评论...';
            chatInput.setAttribute('aria-label', isLive ? '发送直播聊天' : '发表评论');
            chatInput.setAttribute('enterkeyhint', 'send');
        }
        if (chatSend) {
            chatSend.title = isLive ? '发送消息' : '发表评论';
            chatSend.setAttribute('aria-label', isLive ? '发送消息' : '发表评论');
        }
        if (chatApiBtn) {
            chatApiBtn.title = isLive ? '调用 API 生成直播回复' : '调用 API 生成评论回复';
            chatApiBtn.setAttribute('aria-label', chatApiBtn.title);
        }
    }

    if(chatSend && chatInput) {
        const sendAction = () => {
            const text = chatInput.value.trim();
            if(!text) return;
            
            const isLive = currentVideoData && currentVideoData.isLive;
            const effectiveYtUser = getCurrentYtViewer();
            addChatMessage(effectiveYtUser.name || '我', text, isLive, null, null, false, 'user');
            if (isLive && getActiveYtCharConnection()?.status === 'active') {
                addYtCharConnectionBubble(text);
                recordYtCharConnectionUserContent(text);
            }
            chatInput.value = '';
        };

        chatSend.addEventListener('click', sendAction);
        chatSend.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            sendAction();
        });
        window.mobileInputCompat?.register({
            input: chatInput,
            root: playerView,
            scrollContainer: ytPlayerChatContainer,
            onSend: sendAction,
            allowEmpty: true,
            openClasses: ['keyboard-open', 'yt-chat-keyboard-lock']
        });
    }

    function findLatestPlayerUserMessage(isLive) {
        const effectiveYtUser = getCurrentYtViewer();
        const userName = String(effectiveYtUser.name || '我');
        const messages = isLive
            ? currentChatHistory
            : (Array.isArray(currentVideoData?.comments) ? currentVideoData.comments : []);
        for (let index = messages.length - 1; index >= 0; index--) {
            if (messages[index]?.senderType === 'user') return messages[index];
        }
        for (let index = messages.length - 1; index >= 0; index--) {
            if (String(messages[index]?.name || '') === userName) return messages[index];
        }
        return null;
    }

    function setPlayerChatApiLoading(isLoading) {
        isPlayerChatApiLoading = isLoading;
        if (!chatApiBtn) return;
        chatApiBtn.style.opacity = isLoading ? '0.5' : '1';
        chatApiBtn.style.pointerEvents = isLoading ? 'none' : 'auto';
        chatApiBtn.setAttribute('aria-busy', String(isLoading));
        chatApiBtn.innerHTML = isLoading
            ? '<i class="fas fa-spinner fa-spin"></i>'
            : '<i class="fas fa-arrow-down" style="font-size:14px;"></i>';
    }

    function showPlayerReplyLoading() {
        const chatContainer = document.getElementById('yt-player-chat-container');
        if (!chatContainer || document.getElementById('yt-reply-loading')) return;
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'yt-reply-loading';
        loadingDiv.style.textAlign = 'center';
        loadingDiv.style.padding = '10px';
        loadingDiv.style.color = '#8e8e93';
        loadingDiv.style.fontSize = '12px';
        loadingDiv.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 回复生成中...';
        chatContainer.appendChild(loadingDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    async function triggerPlayerChatApi() {
        if (isPlayerChatApiLoading || !currentVideoData) return;
        const isLive = !!currentVideoData.isLive;
        const latestUserMessage = findLatestPlayerUserMessage(isLive);
        if (!isLive && !latestUserMessage) {
            if (window.showToast) window.showToast('请先发送评论');
            return;
        }

        setPlayerChatApiLoading(true);
        try {
            if (isLive) {
                const activeConnection = getActiveYtCharConnection();
                const needsConnectionRetry = activeConnection?.status === 'active' && activeConnection.kickoffCompleted !== true;
                const responseObj = await getCharResponse(
                    latestUserMessage?.text || '',
                    false,
                    0,
                    !latestUserMessage,
                    { connectionKickoff: needsConnectionRetry }
                );
                if (responseObj?._error) {
                    removeCharLiveLoadingBubbles();
                    if (window.showToast) window.showToast('连线互动生成失败，请重试');
                } else {
                    if (needsConnectionRetry) {
                        const latestConnection = getActiveYtCharConnection();
                        if (latestConnection) latestConnection.kickoffCompleted = true;
                        saveYoutubeData();
                        resolveCanonicalYtCharLive();
                    }
                    renderAiResponse(responseObj);
                }
            } else {
                showPlayerReplyLoading();
                const responseObj = await getVODResponse(latestUserMessage.text);
                renderVODResponse(responseObj);
            }
        } finally {
            const loadingMsg = document.getElementById('yt-reply-loading');
            if (loadingMsg) loadingMsg.remove();
            setPlayerChatApiLoading(false);
        }
    }

    if (chatApiBtn) {
        chatApiBtn.addEventListener('click', triggerPlayerChatApi);
        chatApiBtn.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            triggerPlayerChatApi();
        });
    }

    if(playerPlusBtn && playerActionMenu) {
        playerPlusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playerActionMenu.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!playerPlusBtn.contains(e.target) && !playerActionMenu.contains(e.target)) {
                playerActionMenu.classList.remove('active');
            }
        });
    }

    if(actionContinue) {
        actionContinue.addEventListener('click', async (e) => {
            e.stopPropagation();
            if(playerActionMenu) playerActionMenu.classList.remove('active');
            if(currentVideoData && currentVideoData.isLive) {
                if(window.showToast) window.showToast('正在生成后续直播内容...');
                const responseObj = await getCharResponse('', false, 0, true); 
                renderAiResponse(responseObj);
            } else {
                if(window.showToast) window.showToast('仅在直播时可用');
            }
        });
    }

    function finishCurrentYtCharLive() {
        const video = currentVideoData;
        const channelId = video?.channelData?.id;
        const channel = (Array.isArray(mockSubscriptions) ? mockSubscriptions : [])
            .find(item => String(item?.id) === String(channelId)) || video?.channelData;
        const currentLive = channel?.generatedContent?.currentLive;
        const requestedLiveId = video?.id || video?.liveId;
        if (!video?.isLive || !channel || channel.id === 'user_channel_id' || !currentLive
            || (requestedLiveId && currentLive.id && String(requestedLiveId) !== String(currentLive.id))) {
            if (window.showToast) window.showToast('当前没有可结束的 Char 直播');
            return;
        }

        if (window.ytLiveTimeouts) {
            window.ytLiveTimeouts.forEach(clearTimeout);
            window.ytLiveTimeouts = [];
        }
        if (currentLive.charLottery?.status === 'active') finalizeYtCharLiveLottery();
        stopYtCharLiveLotteryTimer();
        ytCharLiveLotteryModal?.classList.remove('active');
        if (ytCharLiveLotteryInlineStatus) ytCharLiveLotteryInlineStatus.style.display = 'none';
        stopYtCharConnectionVisualTimers();
        if (currentLive.connection) {
            currentLive.guest = { ...(currentLive.connection.participant || currentLive.guest || {}) };
            currentLive.connectionEndedAt = Date.now();
            currentLive.connectionHistory = [
                ...(Array.isArray(currentLive.connectionHistory) ? currentLive.connectionHistory : []),
                {
                    id: currentLive.connection.id,
                    participant: { ...(currentLive.connection.participant || {}) },
                    requestedAt: currentLive.connection.requestedAt || null,
                    startedAt: currentLive.connection.startedAt || null,
                    endedAt: currentLive.connectionEndedAt,
                    transcript: Array.isArray(currentLive.connection.transcript)
                        ? currentLive.connection.transcript.map(item => ({ ...item }))
                        : []
                }
            ];
            currentLive.connection = null;
        }
        archiveYtCurrentCharLive(channel);
        channel.generatedContent.currentLive = null;
        channel.isLive = false;
        mockVideos = mockVideos.filter(item => !(item?.isLive && item?.channelData?.id === channel.id));
        if (typeof saveYoutubeData === 'function') saveYoutubeData();
        if (typeof renderVideos === 'function') renderVideos();
        const canonicalChannel = mockSubscriptions.find(item => item.id === channel.id) || channel;

        playerView?.classList.remove('active', 'yt-char-live-mode');
        if (ytCharSpeechBubble) {
            ytCharSpeechBubble.innerHTML = '';
            ytCharSpeechBubble.style.display = 'none';
        }
        if (typeof window.releaseYtChatKeyboardLock === 'function') window.releaseYtChatKeyboardLock();
        currentVideoData = null;
        currentSubChannelData = canonicalChannel;

        const channelView = document.getElementById('sub-channel-view');
        if (channelView) channelView.classList.add('active');
        const tabsContainer = document.getElementById('sub-channel-tabs');
        const liveTab = tabsContainer?.querySelector('.yt-sliding-tab[data-target="live"]');
        if (tabsContainer && liveTab) {
            tabsContainer.querySelectorAll('.yt-sliding-tab').forEach(tab => tab.classList.remove('active'));
            liveTab.classList.add('active');
            const indicator = tabsContainer.querySelector('.yt-tab-indicator');
            if (indicator && typeof updateSlidingIndicator === 'function') updateSlidingIndicator(liveTab, indicator);
        }
        renderGeneratedContent('live');
        if (window.showToast) window.showToast('直播已结束并保存到往期视频');
    }

    if (actionEndLive) {
        actionEndLive.addEventListener('click', (event) => {
            event.stopPropagation();
            if (playerActionMenu) playerActionMenu.classList.remove('active');
            if (!currentVideoData?.isLive || currentVideoData?.channelData?.id === 'user_channel_id') {
                if (window.showToast) window.showToast('仅在 Char 直播时可用');
                return;
            }
            if (window.showCustomModal) {
                window.showCustomModal({
                    title: '结束直播',
                    message: '确定结束当前直播吗？直播内容和实时评论会保存到往期视频。',
                    confirmText: '结束直播',
                    cancelText: '取消',
                    isDestructive: true,
                    onConfirm: finishCurrentYtCharLive
                });
            } else {
                finishCurrentYtCharLive();
            }
        });
    }

    if(actionSummary) {
        actionSummary.addEventListener('click', async (e) => {
            e.stopPropagation();
            if(playerActionMenu) playerActionMenu.classList.remove('active');
            if(currentVideoData && currentVideoData.isLive) {
                if(window.showToast) window.showToast('正在生成并保存直播总结...');
                await generateLiveSummary();
            } else {
                if(window.showToast) window.showToast('仅在直播时可用');
            }
        });
    }

    // --- Super Chat Logic ---
    const ytGiftBtn = document.getElementById('yt-gift-btn');
    const ytScSheet = document.getElementById('yt-sc-sheet');
    const ytScCloseBtn = document.getElementById('yt-sc-close-btn');
    const scAmountBtns = document.querySelectorAll('.sc-amount-btn');
    const ytScCustomInput = document.getElementById('yt-sc-custom-amount');
    const ytScInput = document.getElementById('yt-sc-input');
    const ytSendScBtn = document.getElementById('yt-send-sc-btn');
    
    let currentScAmount = 30;
    let currentScColor = getYtSuperChatTier(currentScAmount).color;

    function applyYtSuperChatTheme(amount) {
        const tier = getYtSuperChatTier(amount);
        currentScColor = tier.color;
        return tier;
    }
    applyYtSuperChatTheme(currentScAmount);

    if(ytGiftBtn && ytScSheet) {
        ytGiftBtn.addEventListener('click', () => {
            applyYtSuperChatTheme(currentScAmount);
            ytScSheet.classList.add('active');
        });

        ytScSheet.addEventListener('mousedown', (e) => {
            if (e.target === ytScSheet) {
                if (ytScCustomInput && document.activeElement === ytScCustomInput) ytScCustomInput.blur();
                if (ytScInput && document.activeElement === ytScInput) ytScInput.blur();
                ytScSheet.classList.remove('active');
            }
        });
    }

    ytScCloseBtn?.addEventListener('click', () => {
        ytScCustomInput?.blur();
        ytScInput?.blur();
        ytScSheet?.classList.remove('active', 'keyboard-open');
    });

    function updateScBtn() {
        applyYtSuperChatTheme(currentScAmount);
        if(ytSendScBtn) {
            ytSendScBtn.textContent = `发送 ￥${currentScAmount}`;
        }
    }

    scAmountBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            scAmountBtns.forEach(b => {
                b.classList.remove('selected');
                b.style.removeProperty('background');
                b.style.removeProperty('color');
            });
            btn.classList.add('selected');
            currentScAmount = btn.getAttribute('data-amount');
            if(ytScCustomInput) ytScCustomInput.value = '';
            updateScBtn();
        });
    });

    if(ytScCustomInput) {
        ytScCustomInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val && !isNaN(val)) {
                currentScAmount = val;
                scAmountBtns.forEach(b => {
                    b.classList.remove('selected');
                    b.style.removeProperty('background');
                    b.style.removeProperty('color');
                });
                updateScBtn();
            }
        });
        ytScCustomInput.addEventListener('focus', () => {
            if (ytScSheet) ytScSheet.classList.add('keyboard-open');
        });
        ytScCustomInput.addEventListener('blur', () => {
            if (ytScSheet) ytScSheet.classList.remove('keyboard-open');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    if (ytScInput) {
        ytScInput.addEventListener('focus', () => {
            if (ytScSheet) ytScSheet.classList.add('keyboard-open');
        });
        ytScInput.addEventListener('blur', () => {
            if (ytScSheet) ytScSheet.classList.remove('keyboard-open');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    if(ytSendScBtn) {
        ytSendScBtn.addEventListener('click', async () => {
            const text = ytScInput ? ytScInput.value.trim() || '支持主播！' : '支持主播！';
            
            const effectiveYtUser = getCurrentYtViewer();
            addChatMessage(effectiveYtUser.name || '我', text, true, currentScAmount, currentScColor, false, 'user');
            
            if(ytScInput) ytScInput.value = '';
            if(ytScSheet) ytScSheet.classList.remove('active');
            
            if(currentVideoData && currentVideoData.isLive) {
                const responseObj = await getCharResponse(text, true, currentScAmount);
                renderAiResponse(responseObj);
            }
        });
    }

    // --- Content Generation Logic (Append Mode) ---
    const btnGenerate = document.getElementById('yt-char-generate-btn');
    const loadingEl = document.getElementById('sub-channel-loading');

    function setCharGenerateLoading(isLoading) {
        if (!btnGenerate) return;
        btnGenerate.classList.toggle('is-loading', isLoading);
        btnGenerate.setAttribute('aria-disabled', isLoading ? 'true' : 'false');
        btnGenerate.innerHTML = isLoading
            ? '<i class="fas fa-spinner fa-spin"></i>'
            : '<i class="fas fa-search"></i>';
    }

    function renderGeneratedContent(type) {
        try {
            if (!subChannelContent) return;
            if (currentSubChannelData && typeof window.ensureYtFixedCharFanGroup === 'function') {
                window.ensureYtFixedCharFanGroup(currentSubChannelData);
            }
            if (!currentSubChannelData || !currentSubChannelData.generatedContent) {
                subChannelContent.innerHTML = `<div style="text-align:center; padding: 30px; color:#8e8e93; font-size:14px;">点击右上角魔法棒生成内容</div>`;
                return;
            }

            const data = currentSubChannelData.generatedContent;
            subChannelContent.innerHTML = '';

            if (type === 'live' && data.currentLive) {
                const el = document.createElement('div');
                const thumbUrl = data.currentLive.thumbnail || `https://picsum.photos/seed/${Math.random()}/320/180?grayscale`;
                
                el.innerHTML = `
                    <div class="yt-video-card yt-live-pin-card" style="margin: 16px;">
                        <div class="yt-video-thumbnail">
                            <img src="${thumbUrl}" alt="Live">
                            <div class="yt-live-badge"><i class="fas fa-broadcast-tower" style="font-size: 10px;"></i> LIVE</div>
                        </div>
                        <div class="yt-video-info" style="padding: 12px;">
                            <div class="yt-video-details">
                                <h3 class="yt-video-title">${ytPlayerEscapeHtml(data.currentLive.title || '无标题')}</h3>
                                ${renderYtSecondaryTranslation(data.currentLive.titleTranslationZh, 'yt-video-title-translation')}
                                <p class="yt-video-meta">${ytPlayerEscapeHtml(getYtViewsDisplay({ ...data.currentLive, isLive: true }, true))}</p>
                            </div>
                        </div>
                    </div>
                `;
                
                const cardEl = el.querySelector('.yt-video-card');
                if (cardEl) {
                    cardEl.addEventListener('click', () => {
                        const videoObj = {
                            id: data.currentLive.id || '',
                            liveId: data.currentLive.id || '',
                            title: data.currentLive.title,
                            titleTranslationZh: data.currentLive.titleTranslationZh || '',
                            viewerCount: data.currentLive.viewerCount,
                            views: getYtViewsDisplay({ ...data.currentLive, isLive: true }, true),
                            thumbnail: thumbUrl,
                            isLive: true,
                            channelData: currentSubChannelData,
                            comments: data.currentLive.comments || [],
                            initialBubbles: data.currentLive.initialBubbles || [],
                            liveTranscript: data.currentLive.liveTranscript || [],
                            guest: data.currentLive.guest || null
                        };
                        openVideoPlayer(videoObj);
                    });
                }
                
                subChannelContent.appendChild(el);
            } else if (type === 'past' && data.pastVideos && data.pastVideos.length > 0) {
                const listWrapper = document.createElement('div');
                listWrapper.className = 'yt-history-list';
                listWrapper.style.padding = '16px';

                let upgradedReplayMetadata = false;
                data.pastVideos.forEach((video) => {
                    if (!isYtLiveReplay(video)) return;
                    if (!video.isLiveReplay) {
                        video.isLiveReplay = true;
                        upgradedReplayMetadata = true;
                    }
                    if (!video.id) {
                        video.id = createYtLiveReplayId(currentSubChannelData.id);
                        upgradedReplayMetadata = true;
                    }
                    if (!Number.isFinite(Number(video.realtimeCommentCount))) {
                        video.realtimeCommentCount = Array.isArray(video.comments) ? video.comments.length : 0;
                        upgradedReplayMetadata = true;
                    }
                    if (!Array.isArray(video.liveTranscript)) {
                        video.liveTranscript = [];
                        upgradedReplayMetadata = true;
                    }
                });
                if (upgradedReplayMetadata && typeof saveYoutubeData === 'function') saveYoutubeData();
                
                data.pastVideos.forEach((v, index) => {
                    const item = document.createElement('div');
                    item.className = 'yt-history-item';
                    item.style.position = 'relative';
                    const thumbUrl = v.thumbnail || `https://picsum.photos/seed/${Math.random()}/320/180?grayscale`;
                    item.innerHTML = `
                        <div class="yt-history-thumb">
                            <img src="${thumbUrl}" alt="VOD">
                            <div class="yt-history-time">${Math.floor(Math.random() * 2)+1}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}</div>
                        </div>
                        <div class="yt-history-info">
                            <h3 class="yt-history-title">${ytPlayerEscapeHtml(v.title || '无标题')}</h3>
                            ${renderYtSecondaryTranslation(v.titleTranslationZh, 'yt-video-title-translation')}
                            <p class="yt-history-meta">${ytPlayerEscapeHtml(getYtViewsDisplay({ ...v, isLive: false }, false))} • ${ytPlayerEscapeHtml(v.time || Math.floor(Math.random() * 11) + 1 + '个月前')}</p>
                        </div>
                    `;
                    
                    item.addEventListener('click', (e) => {
                        const videoObj = {
                            id: v.id || '',
                            isLiveReplay: !!v.isLiveReplay,
                            realtimeCommentCount: getYtReplayRealtimeCommentCount(v),
                            liveTranscript: Array.isArray(v.liveTranscript) ? v.liveTranscript : [],
                            time: v.time || '',
                            title: v.title,
                            titleTranslationZh: v.titleTranslationZh || '',
                            viewCount: v.viewCount,
                            views: getYtViewsDisplay({ ...v, isLive: false }, false),
                            thumbnail: item.querySelector('img').src,
                            isLive: false,
                            channelData: currentSubChannelData,
                            comments: v.comments || [],
                            guest: v.guest || null
                        };
                        openVideoPlayer(videoObj);
                    });
                    
                    listWrapper.appendChild(item);
                });
                subChannelContent.appendChild(listWrapper);
            } else if (type === 'community' && data.communityPosts) {
                if (data.fanGroup) {
                    const isJoined = data.fanGroup.isJoined || false;
                    const btnBg = isJoined ? '#e5e5e5' : '#000';
                    const btnColor = isJoined ? '#606060' : '#fff';
                    const btnText = isJoined ? '进入' : '加入';

                    const groupEl = document.createElement('div');
                    groupEl.style.margin = '12px 16px 16px';
                    groupEl.style.padding = '12px';
                    groupEl.style.backgroundColor = '#f2f2f2';
                    groupEl.style.borderRadius = '12px';
                    groupEl.style.display = 'flex';
                    groupEl.style.alignItems = 'center';
                    groupEl.style.gap = '10px';
                    groupEl.style.cursor = 'pointer';
                    
                    let groupAvatarHtml = `
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: #f2f2f7; display: flex; justify-content: center; align-items: center; color: #8e8e93; ">
                            <i class="fas fa-users"></i>
                        </div>
                    `;
                    
                    if (data.fanGroup.avatar) {
                        groupAvatarHtml = `
                            <div style="width: 40px; height: 40px; border-radius: 50%; overflow: hidden;  background: transparent;">
                                <img src="${data.fanGroup.avatar}" style="width: 100%; height: 100%; object-fit: cover;">
                            </div>
                        `;
                    }

                    groupEl.innerHTML = `
                        ${groupAvatarHtml}
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 14px;">${ytPlayerEscapeHtml(data.fanGroup.name || '粉丝群')}</div>
                            ${renderYtSecondaryTranslation(data.fanGroup.nameTranslationZh, 'yt-fan-group-name-translation')}
                            <div style="font-size: 12px; color: #606060;">${formatYtCharFanGroupMemberCount(data.fanGroup.memberCount)} • 粉丝专属基地</div>
                        </div>
                        <div class="yt-fan-group-btn" style="background: ${btnBg}; color: ${btnColor}; padding: 6px 12px; border-radius: 16px; font-size: 12px; font-weight: 500; transition: all 0.2s;">${btnText}</div>
                    `;
                    
                    groupEl.addEventListener('click', () => {
                        if (!data.fanGroup.isJoined) {
                            data.fanGroup.isJoined = true;
                            renderGeneratedContent('community'); 
                            saveYoutubeData();
                            if (typeof renderMessagesList === 'function') renderMessagesList();
                            if(window.showToast) window.showToast('已加入粉丝群！');
                        }
                        openFanGroupChat(data.fanGroup);
                    });
                    
                    subChannelContent.appendChild(groupEl);
                }

                if(Array.isArray(data.communityPosts)){
                    data.communityPosts.forEach(post => {
                        const el = document.createElement('div');
                        const syncedLikes = typeof window.syncYtPostLikeGrowth === 'function'
                            ? window.syncYtPostLikeGrowth(post)
                            : post.likes;
                        const likeCount = typeof window.formatYtPostLikeCount === 'function'
                            ? window.formatYtPostLikeCount(syncedLikes)
                            : (syncedLikes || '0');
                        const commentCount = typeof window.countYtPostComments === 'function'
                            ? window.countYtPostComments(post)
                            : (post.commentsCount || post.comments?.length || 0);
                        const avatarUrl = typeof resolveYtChannelAvatar === 'function'
                            ? resolveYtChannelAvatar(currentSubChannelData)
                            : (currentSubChannelData.avatar || '');
                        el.className = 'yt-community-post';
                        el.style.cursor = 'pointer';
                        el.innerHTML = `
                            <div style="display: flex; align-items: center; margin-bottom: 10px; gap: 10px;">
                                <div class="yt-video-avatar" style="width:36px; height:36px;"><img src="${avatarUrl}"></div>
                                <div style="flex:1;">
                                    <div style="font-size:14px; font-weight:500;">${currentSubChannelData.name || '未知'}</div>
                                    <div style="font-size:11px; color:#606060;">${post.time || '刚刚'}</div>
                                </div>
                            </div>
                            <div class="yt-community-post-content">${ytPlayerEscapeHtml(post.content || '')}</div>
                            <div class="yt-community-post-actions">
                                <div class="yt-community-post-action"><i class="far fa-thumbs-up"></i> ${likeCount}</div>
                                <div class="yt-community-post-action"><i class="far fa-thumbs-down"></i></div>
                                <div class="yt-community-post-action"><i class="far fa-comment"></i> ${commentCount}</div>
                            </div>
                        `;
                        el.addEventListener('click', () => {
                            openPostDetail(post);
                        });
                        
                        subChannelContent.appendChild(el);
                    });
                }
            } else {
                subChannelContent.innerHTML = `<div style="text-align:center; padding: 30px; color:#8e8e93; font-size:14px;">暂无相关内容</div>`;
            }
        } catch (e) {
            console.error("Error rendering content:", e);
        }
    }

    if (false && btnGenerate) {
        btnGenerate.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (btnGenerate.classList.contains('is-loading')) return;
            if (!currentSubChannelData) return;
            
            if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
                if(window.showToast) window.showToast('请先在设置中配置大模型 API');
                return;
            }

            if (typeof mergeYtChannelIntoSubscriptions === 'function') {
                currentSubChannelData = mergeYtChannelIntoSubscriptions(currentSubChannelData, { save: true, preferExistingSubscription: true }) || currentSubChannelData;
            }

            setCharGenerateLoading(true);
            if(subChannelContent) subChannelContent.innerHTML = '';
            if (loadingEl) loadingEl.style.display = 'block';
            
            let prompt = `你是一个YouTube内容生成助手。现在有一个YouTuber，她的频道名称是："${currentSubChannelData.name}"，她的人设和简介是："${currentSubChannelData.desc || '未知'}"。
请你根据挂载的世界书，她的设定，生成符合她身份人设风格的内容，具有活人感，返回严格的JSON格式数据。
要求JSON包含以下字段：
1. currentLive: 对象，包含:
   - title(直播标题原文)
   - titleTranslationZh(title 的自然中文翻译或空字符串)
   - viewerCount(当前观看人数，必须是纯整数，例如 15000；禁止附加任何语言文字)
   - initialBubbles: 对象数组，每项为 {"text":"主播原话","translationZh":"中文翻译或空字符串"}，模拟刚进入直播间时主播正在说的话（3-5句开场白或正在进行的话题）。
   - comments: 数组，包含5-10个对象，每个对象有 name(观众昵称)、text(弹幕原文) 和 translationZh(中文翻译或空字符串)。
2. pastVideos: 数组，包含3个对象，每个对象有:
   - title(往期视频标题原文)
   - titleTranslationZh(title 的自然中文翻译或空字符串)
   - viewCount(观看次数，必须是纯整数，例如 450000；禁止附加任何语言文字)
   - time(发布时间，如"2天前")
   - comments: 数组，包含3-5个对象，每个对象有 name(观众昵称)、text(评论原文) 和 translationZh(中文翻译或空字符串)。
3. communityPosts: 数组，包含1-3个对象，每个对象代表一条YouTube社区动态，有:
   - content(动态正文内容，符合人设，具有活人感，禁止使用emoji)
   - translationZh(content 的自然中文翻译；content 是中文时必须为空字符串)
   - likes(点赞数字符串，如"3.2万")
   - commentsCount(评论数，如"1400")
   - time(发布时间，如"5小时前")
   - comments: 数组，包含3-5个对象，代表这条动态下的热门评论，每个对象有 name(观众昵称)、text(评论原文) 和 translationZh(中文翻译或空字符串)。
4. fanGroup: 对象，包含 name(粉丝群名称原文，如"xx的秘密基地")、nameTranslationZh(name 的自然中文翻译或空字符串) 和 memberCount(群人数，如"3000人")。
注意：YouTube 是国际化平台。社群动态正文 content 和评论 text 不是中文时，对应 translationZh 必须提供自然中文翻译；如果原文是中文，translationZh 必须为空字符串。只能返回纯 JSON，不要包含 Markdown 符号如 \`\`\`json。`;

            if (typeof window.buildYtLocalizedJsonContract === 'function') {
                prompt += window.buildYtLocalizedJsonContract(
                    currentSubChannelData,
                    'currentLive.title, every currentLive.initialBubbles item, every pastVideos.title, every communityPosts.content, and fanGroup.name'
                );
            }
            prompt += `\n\n【最高优先级：观众评论国际化协议】角色本人创作的标题、主播发言和社区正文继续跟随角色默认语言；currentLive.comments、pastVideos[].comments 和 communityPosts[].comments 必须模拟来自世界各地的真实 YouTube 观众，绝对不能全部跟随角色默认语言。每组评论要混合英语、日语、韩语、法语、西班牙语及其他自然语言，评论不少于 5 条时至少包含 3 种语言，且至少一半为非中文评论；昵称必须符合对应国家或地区。每条评论严格返回 {"name":"viewer name","text":"观众自己的语言原文","translationZh":"自然准确的简体中文翻译或空字符串"}；text 非中文时 translationZh 必须填写，text 中文时必须为空字符串。此协议覆盖上方任何要求观众评论跟随角色默认语言的内容。`;
            prompt += `\n\n【UI 指标固定规则】viewerCount、viewCount 只能返回非负纯整数；观看人数、观看次数、发布时间等 UI 指标不受角色默认语言影响，禁止翻译或添加外语单位，中文展示单位由前端生成。`;
            const generationWorldBookContext = window.getYtWorldBookContext
                ? window.getYtWorldBookContext(`${currentSubChannelData.name || ''}\n${currentSubChannelData.desc || ''}`)
                : '';
            prompt += `\n\n世界书内容：\n${generationWorldBookContext || '无'}`;

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
                        temperature: 0.7,
                        response_format: { type: "json_object" } 
                    })
                });

                if (!res.ok) throw new Error(`API Error: ${res.status}`);
                
                const data = await res.json();
                let resultText = data.choices[0].message.content;
                resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsedData = sanitizeObj(JSON.parse(resultText));

                // --- Append Logic instead of replace ---
                if (!currentSubChannelData.generatedContent) {
                    currentSubChannelData.generatedContent = { pastVideos: [], communityPosts: [] };
                }
                const oldGen = currentSubChannelData.generatedContent;
                
                // If there's an active live, move it to past
                if (oldGen.currentLive) {
                    archiveYtCurrentCharLive(currentSubChannelData);
                }
                
                if (parsedData.currentLive) {
                    const localizedTitle = getYtPlayerLocalizedContent({
                        text: parsedData.currentLive.title,
                        translationZh: parsedData.currentLive.titleTranslationZh
                    }, currentSubChannelData);
                    parsedData.currentLive.title = localizedTitle.text;
                    parsedData.currentLive.titleTranslationZh = localizedTitle.translationZh;
                    parsedData.currentLive.viewerCount = Math.max(0, Math.round(Number(parsedData.currentLive.viewerCount) || 0));
                    parsedData.currentLive.views = getYtViewsDisplay({ ...parsedData.currentLive, isLive: true }, true);
                    parsedData.currentLive.thumbnail = parsedData.currentLive.thumbnail || `https://picsum.photos/seed/${encodeURIComponent(currentSubChannelData.id + '_live_' + Date.now())}/320/180?grayscale`;
                    parsedData.currentLive.comments = Array.isArray(parsedData.currentLive.comments)
                        ? parsedData.currentLive.comments.map(comment => normalizeYtGeneratedComment(comment, currentSubChannelData)).filter(comment => comment.text)
                        : [];
                    parsedData.currentLive.initialBubbles = Array.isArray(parsedData.currentLive.initialBubbles)
                        ? parsedData.currentLive.initialBubbles.map(bubble => normalizeYtGeneratedBubble(bubble, currentSubChannelData)).filter(Boolean)
                        : [];
                    parsedData.currentLive.liveTranscript = Array.isArray(parsedData.currentLive.liveTranscript)
                        ? parsedData.currentLive.liveTranscript.map((item, index) => normalizeYtReplayTranscriptItem(item, index)).filter(item => item.text)
                        : createYtReplayTranscriptFromBubbles(parsedData.currentLive.initialBubbles);
                }
                oldGen.currentLive = parsedData.currentLive;
                
                if (parsedData.pastVideos) {
                    if (!oldGen.pastVideos) oldGen.pastVideos = [];
                    const normalizedPastVideos = parsedData.pastVideos.map((video, index) => {
                        const localizedTitle = getYtPlayerLocalizedContent({
                            text: video.title,
                            translationZh: video.titleTranslationZh
                        }, currentSubChannelData);
                        return {
                            ...video,
                            title: localizedTitle.text,
                            titleTranslationZh: localizedTitle.translationZh,
                            viewCount: Math.max(0, Math.round(Number(video.viewCount) || 0)),
                            views: getYtViewsDisplay({
                                ...video,
                                viewCount: Math.max(0, Math.round(Number(video.viewCount) || 0)),
                                isLive: false
                            }, false),
                            thumbnail: video.thumbnail || `https://picsum.photos/seed/${encodeURIComponent(currentSubChannelData.id + '_past_' + Date.now() + '_' + index)}/320/180?grayscale`,
                            comments: Array.isArray(video.comments)
                                ? video.comments.map(comment => normalizeYtGeneratedComment(comment, currentSubChannelData)).filter(comment => comment.text)
                                : []
                        };
                    });
                    oldGen.pastVideos = normalizedPastVideos.concat(oldGen.pastVideos);
                }
                
                if (parsedData.communityPosts) {
                    if (!oldGen.communityPosts) oldGen.communityPosts = [];
                    const normalizedCommunityPosts = parsedData.communityPosts.map(post => {
                        const localizedContent = getYtPlayerLocalizedContent({
                            text: post.content,
                            translationZh: post.translationZh || post.contentTranslationZh || post.translation
                        }, currentSubChannelData);
                        return {
                            ...post,
                            content: localizedContent.text,
                            translationZh: localizedContent.translationZh,
                            lastLikeGrowthAt: Number(post.lastLikeGrowthAt) || Date.now(),
                            comments: Array.isArray(post.comments)
                                ? post.comments.map(comment => normalizeYtGeneratedComment(comment, currentSubChannelData)).filter(comment => comment.text)
                                : []
                        };
                    });
                    oldGen.communityPosts = normalizedCommunityPosts.concat(oldGen.communityPosts);
                }
                
                if (parsedData.fanGroup) {
                    const localizedGroupName = getYtPlayerLocalizedContent({
                        text: parsedData.fanGroup.name,
                        translationZh: parsedData.fanGroup.nameTranslationZh
                    }, currentSubChannelData);
                    parsedData.fanGroup.name = localizedGroupName.text;
                    parsedData.fanGroup.nameTranslationZh = localizedGroupName.translationZh;
                    if (oldGen.fanGroup) {
                        parsedData.fanGroup.isJoined = oldGen.fanGroup.isJoined; 
                        // Preserve name if exists
                        if (oldGen.fanGroup.name) {
                            parsedData.fanGroup.name = oldGen.fanGroup.name;
                            parsedData.fanGroup.nameTranslationZh = oldGen.fanGroup.nameTranslationZh || '';
                        }
                    }
                    oldGen.fanGroup = parsedData.fanGroup;
                }
                
                if (typeof mergeYtChannelIntoSubscriptions === 'function') {
                    currentSubChannelData = mergeYtChannelIntoSubscriptions(currentSubChannelData, { save: false, preferExistingSubscription: true }) || currentSubChannelData;
                }
                saveYoutubeData();
                
                if(parsedData.currentLive) {
                    const newLiveVideo = {
                        title: parsedData.currentLive.title,
                        titleTranslationZh: parsedData.currentLive.titleTranslationZh || '',
                        viewerCount: parsedData.currentLive.viewerCount,
                        views: getYtViewsDisplay({ ...parsedData.currentLive, isLive: true }, true),
                        time: 'LIVE',
                        thumbnail: parsedData.currentLive.thumbnail || 'https://picsum.photos/seed/' + Math.random() + '/320/180?grayscale',
                        isLive: true,
                        comments: parsedData.currentLive.comments,
                        initialBubbles: parsedData.currentLive.initialBubbles || [], 
                        guest: parsedData.currentLive.guest || null,
                        channelData: currentSubChannelData 
                    };
                    
                    mockVideos = mockVideos.filter(v => v.channelData.id !== currentSubChannelData.id);
                    mockVideos.unshift(newLiveVideo);
                    renderVideos();
                }

                if (loadingEl) loadingEl.style.display = 'none';
                setCharGenerateLoading(false);
                
                const activeTab = document.querySelector('#sub-channel-tabs .yt-sliding-tab.active');
                const target = activeTab ? activeTab.getAttribute('data-target') : 'live';
                renderGeneratedContent(target);

                if(window.showToast) window.showToast('内容生成成功并已保存！');

            } catch (error) {
                console.error(error);
                if (loadingEl) loadingEl.style.display = 'none';
                setCharGenerateLoading(false);
                if(subChannelContent) subChannelContent.innerHTML = `<div style="text-align:center; padding: 30px; color:#ff3b30; font-size:14px;">生成失败，请检查 API 配置或网络</div>`;
            }
        });
    }

    const ytCharGenerateModal = document.getElementById('yt-char-generate-modal');
    const ytCharGenerateModalTitle = document.getElementById('yt-char-generate-modal-title');
    const ytCharGenerateModalClose = document.getElementById('yt-char-generate-modal-close');
    const ytCharGenerateRequirementLabel = document.getElementById('yt-char-generate-requirement-label');
    const ytCharGenerateRequirement = document.getElementById('yt-char-generate-requirement');
    const ytCharGenerateCountRow = document.getElementById('yt-char-generate-count-row');
    const ytCharGenerateCount = document.getElementById('yt-char-generate-count');
    const ytCharGenerateModalStatus = document.getElementById('yt-char-generate-modal-status');
    const ytCharGenerateConfirm = document.getElementById('yt-char-generate-confirm');
    let ytCharGenerateMode = 'live';
    let ytCharGenerateRequestActive = false;

    function getActiveYtCharGenerationTab() {
        return document.querySelector('#sub-channel-tabs .yt-sliding-tab.active')?.getAttribute('data-target') || 'live';
    }

    function clampYtCharGenerationCount(value) {
        return Math.max(1, Math.min(10, Math.round(Number(value) || 3)));
    }

    function setYtCharGenerationModalLoading(isLoading) {
        ytCharGenerateRequestActive = !!isLoading;
        setCharGenerateLoading(isLoading);
        if (ytCharGenerateConfirm) {
            ytCharGenerateConfirm.disabled = !!isLoading;
            ytCharGenerateConfirm.innerHTML = isLoading
                ? '<i class="fas fa-circle-notch fa-spin"></i> 生成中'
                : (ytCharGenerateMode === 'live' ? '开始直播' : (ytCharGenerateMode === 'past' ? '生成往期视频' : '生成帖子'));
        }
        if (ytCharGenerateModalClose) ytCharGenerateModalClose.disabled = !!isLoading;
    }

    function closeYtCharGenerationModal() {
        if (ytCharGenerateRequestActive) return;
        ytCharGenerateModal?.classList.remove('active');
    }

    function openYtCharGenerationModal(mode = getActiveYtCharGenerationTab()) {
        if (!ytCharGenerateModal || !currentSubChannelData) return;
        ytCharGenerateMode = ['live', 'past', 'community'].includes(mode) ? mode : 'live';
        const config = {
            live: { title: '开始直播', label: '直播内容', placeholder: '想让 Char 直播什么？可留空自由发挥', action: '开始直播' },
            past: { title: '生成往期视频', label: '视频内容或要求', placeholder: '可填写视频主题、风格或其他要求', action: '生成往期视频' },
            community: { title: '生成社区帖子', label: '帖子内容或要求', placeholder: '可填写想发布的话题或内容方向', action: '生成帖子' }
        }[ytCharGenerateMode];
        if (ytCharGenerateModalTitle) ytCharGenerateModalTitle.textContent = config.title;
        if (ytCharGenerateRequirementLabel) ytCharGenerateRequirementLabel.textContent = config.label;
        if (ytCharGenerateRequirement) {
            ytCharGenerateRequirement.value = '';
            ytCharGenerateRequirement.placeholder = config.placeholder;
        }
        if (ytCharGenerateCountRow) ytCharGenerateCountRow.style.display = ytCharGenerateMode === 'live' ? 'none' : 'flex';
        if (ytCharGenerateCount) ytCharGenerateCount.value = '3';
        const hasActiveLive = ytCharGenerateMode === 'live' && !!currentSubChannelData.generatedContent?.currentLive;
        if (ytCharGenerateModalStatus) {
            ytCharGenerateModalStatus.textContent = hasActiveLive ? '当前正在直播，请先进入直播间结束本场直播。' : '';
            ytCharGenerateModalStatus.classList.toggle('is-error', hasActiveLive);
        }
        if (ytCharGenerateConfirm) {
            ytCharGenerateConfirm.textContent = config.action;
            ytCharGenerateConfirm.disabled = hasActiveLive;
        }
        ytCharGenerateModal.classList.add('active');
        setTimeout(() => ytCharGenerateRequirement?.focus(), 80);
    }

    function getYtCharGenerationWorldBookContext(contextText = '') {
        return window.getYtWorldBookContext
            ? window.getYtWorldBookContext(contextText)
            : '';
    }

    function buildYtCharTabGenerationPrompt(mode, requirement, count) {
        const channel = currentSubChannelData;
        const persona = typeof window.getYtChannelPersonaWithRelationships === 'function'
            ? window.getYtChannelPersonaWithRelationships(channel)
            : (channel.desc || '未知');
        const userRequirement = requirement || '无额外要求，请根据角色人设自然发挥';
        const common = `频道名称：${channel.name}\n角色人设：${persona}\n世界书：${getYtCharGenerationWorldBookContext(`${channel.name}\n${persona}\n${userRequirement}`) || '无'}\n用户本次要求：${userRequirement}`;
        let prompt = '';
        if (mode === 'live') {
            prompt = `你是 YouTube Char 直播生成助手。${common}\n只生成一场新直播，返回 {"currentLive":{"title":"直播标题原文","titleTranslationZh":"中文翻译或空字符串","viewerCount":15000,"initialBubbles":[{"text":"主播原话","translationZh":"中文翻译或空字符串"}],"comments":[{"name":"观众昵称","text":"评论原文","translationZh":"中文翻译或空字符串"}]}}。initialBubbles 生成 3–5 条，comments 生成 6–10 条。`;
            if (typeof window.buildYtLocalizedJsonContract === 'function') {
                prompt += window.buildYtLocalizedJsonContract(channel, 'currentLive.title and every currentLive.initialBubbles item');
            }
        } else if (mode === 'past') {
            prompt = `你是 YouTube 往期视频生成助手。${common}\n生成至少 ${count} 个往期视频，只返回 {"pastVideos":[{"title":"标题原文","titleTranslationZh":"中文翻译或空字符串","viewCount":450000,"time":"2天前","comments":[{"name":"观众昵称","text":"评论原文","translationZh":"中文翻译或空字符串"}]}]}。每个视频生成 3–5 条评论。`;
            if (typeof window.buildYtLocalizedJsonContract === 'function') {
                prompt += window.buildYtLocalizedJsonContract(channel, 'every pastVideos.title');
            }
        } else {
            prompt = `你是 YouTube 社区帖子生成助手。${common}\n生成至少 ${count} 条社区帖子，只返回 {"communityPosts":[{"content":"帖子正文原文","translationZh":"中文翻译或空字符串","likes":"3.2万","commentsCount":"1400","time":"5小时前","comments":[{"name":"观众昵称","text":"评论原文","translationZh":"中文翻译或空字符串"}]}]}。每条帖子生成 3–5 条评论，正文禁止使用 emoji。`;
            if (typeof window.buildYtLocalizedJsonContract === 'function') {
                prompt += window.buildYtLocalizedJsonContract(channel, 'every communityPosts.content');
            }
        }
        prompt += `\n\n【最高优先级：观众国际化协议】角色本人创作的标题、主播发言和社区正文继续跟随角色默认语言；所有 comments 必须模拟世界各地的真实观众，至少一半为非中文并自然混合至少 3 种语言。每条评论严格返回 {"name":"viewer name","text":"观众自己的语言原文","translationZh":"自然准确的简体中文翻译或空字符串"}；外语必须填写 translationZh，中文必须为空。`;
        prompt += `\n【固定 UI 数据协议】viewerCount 和 viewCount 必须是非负纯整数；观看数、发布时间等 UI 指标不受角色默认语言影响。用户要求不得覆盖 JSON、语言、翻译、数量和安全协议。只返回合法 JSON，不要 Markdown。`;
        return prompt;
    }

    async function requestYtCharTabGeneration(mode, requirement, count) {
        const endpoint = window.u2Api.resolveChatCompletionsEndpoint(window.apiConfig.endpoint);
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.apiConfig.apiKey}`
            },
            body: JSON.stringify({
                model: window.apiConfig.model || 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: buildYtCharTabGenerationPrompt(mode, requirement, count) }],
                temperature: 0.8,
                response_format: { type: 'json_object' }
            })
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        let resultText = String(data?.choices?.[0]?.message?.content || '').trim();
        resultText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
        return sanitizeObj(JSON.parse(resultText));
    }

    function normalizeNewYtCharLive(rawLive, channel) {
        if (!rawLive || typeof rawLive !== 'object' || !String(rawLive.title || '').trim()) throw new Error('INVALID_LIVE');
        const localizedTitle = getYtPlayerLocalizedContent({ text: rawLive.title, translationZh: rawLive.titleTranslationZh }, channel);
        const live = {
            ...rawLive,
            id: createYtCharLiveId(channel.id),
            title: localizedTitle.text,
            titleTranslationZh: localizedTitle.translationZh,
            viewerCount: Math.max(0, Math.round(Number(rawLive.viewerCount) || 0)),
            thumbnail: rawLive.thumbnail || `https://picsum.photos/seed/${encodeURIComponent(channel.id + '_live_' + Date.now())}/320/180?grayscale`,
            comments: Array.isArray(rawLive.comments) ? rawLive.comments.map(comment => normalizeYtGeneratedComment(comment, channel)).filter(comment => comment.text) : [],
            initialBubbles: Array.isArray(rawLive.initialBubbles) ? rawLive.initialBubbles.map(bubble => normalizeYtGeneratedBubble(bubble, channel)).filter(Boolean) : []
        };
        live.views = getYtViewsDisplay({ ...live, isLive: true }, true);
        live.liveTranscript = createYtReplayTranscriptFromBubbles(live.initialBubbles);
        return live;
    }

    function normalizeNewYtPastVideos(rawVideos, channel, count) {
        const source = Array.isArray(rawVideos) ? rawVideos : [];
        const normalized = source.map((video, index) => {
            const localizedTitle = getYtPlayerLocalizedContent({ text: video?.title, translationZh: video?.titleTranslationZh }, channel);
            if (!localizedTitle.text) return null;
            const viewCount = Math.max(0, Math.round(Number(video?.viewCount) || 0));
            return {
                ...video,
                id: `yt-past-${channel.id}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
                title: localizedTitle.text,
                titleTranslationZh: localizedTitle.translationZh,
                viewCount,
                views: getYtViewsDisplay({ ...video, viewCount, isLive: false }, false),
                thumbnail: video?.thumbnail || `https://picsum.photos/seed/${encodeURIComponent(channel.id + '_past_' + Date.now() + '_' + index)}/320/180?grayscale`,
                comments: Array.isArray(video?.comments) ? video.comments.map(comment => normalizeYtGeneratedComment(comment, channel)).filter(comment => comment.text) : []
            };
        }).filter(Boolean);
        if (normalized.length < count) throw new Error('INSUFFICIENT_RESULTS');
        return normalized.slice(0, count);
    }

    function normalizeNewYtCommunityPosts(rawPosts, channel, count) {
        const source = Array.isArray(rawPosts) ? rawPosts : [];
        const normalized = source.map((post, index) => {
            const localizedContent = getYtPlayerLocalizedContent({ text: post?.content, translationZh: post?.translationZh || post?.contentTranslationZh }, channel);
            if (!localizedContent.text) return null;
            return {
                ...post,
                id: `yt-post-${channel.id}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
                content: localizedContent.text,
                translationZh: localizedContent.translationZh,
                lastLikeGrowthAt: Date.now(),
                comments: Array.isArray(post?.comments) ? post.comments.map(comment => normalizeYtGeneratedComment(comment, channel)).filter(comment => comment.text) : []
            };
        }).filter(Boolean);
        if (normalized.length < count) throw new Error('INSUFFICIENT_RESULTS');
        return normalized.slice(0, count);
    }

    function openNewYtCharLive(live, channel) {
        const video = {
            id: live.id,
            title: live.title,
            titleTranslationZh: live.titleTranslationZh || '',
            viewerCount: live.viewerCount,
            views: getYtViewsDisplay({ ...live, isLive: true }, true),
            time: 'LIVE',
            thumbnail: live.thumbnail,
            isLive: true,
            comments: live.comments,
            initialBubbles: live.initialBubbles,
            liveTranscript: live.liveTranscript,
            guest: live.guest || null,
            channelData: channel
        };
        mockVideos = mockVideos.filter(item => !(item?.isLive && item?.channelData?.id === channel.id));
        mockVideos.unshift(video);
        if (typeof renderVideos === 'function') renderVideos();
        openVideoPlayer(video);
    }

    function resolveYtCharGenerationChannel(channelId, fallbackChannel = null) {
        const canonical = (Array.isArray(mockSubscriptions) ? mockSubscriptions : [])
            .find(item => String(item?.id) === String(channelId));
        return canonical
            || (currentSubChannelData && String(currentSubChannelData.id) === String(channelId) ? currentSubChannelData : null)
            || fallbackChannel;
    }

    function refreshYtCharGeneratedContentUi(channelId, mode, fallbackChannel = null) {
        const canonicalChannel = resolveYtCharGenerationChannel(channelId, fallbackChannel);
        if (!canonicalChannel) return null;
        currentSubChannelData = canonicalChannel;
        setYtCharGenerationModalLoading(false);
        ytCharGenerateModal?.classList.remove('active');
        renderGeneratedContent(mode);
        if (typeof renderVideos === 'function') renderVideos();
        return canonicalChannel;
    }

    async function submitYtCharTabGeneration() {
        if (ytCharGenerateRequestActive || !currentSubChannelData) return;
        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
            if (window.showToast) window.showToast('请先在设置中配置大模型 API');
            return;
        }
        if (ytCharGenerateMode === 'live' && currentSubChannelData.generatedContent?.currentLive) {
            if (ytCharGenerateModalStatus) {
                ytCharGenerateModalStatus.textContent = '当前正在直播，请先进入直播间结束本场直播。';
                ytCharGenerateModalStatus.classList.add('is-error');
            }
            return;
        }
        const count = clampYtCharGenerationCount(ytCharGenerateCount?.value);
        if (ytCharGenerateCount) ytCharGenerateCount.value = String(count);
        const requirement = String(ytCharGenerateRequirement?.value || '').trim();
        const requestMode = ytCharGenerateMode;
        const requestChannel = currentSubChannelData;
        setYtCharGenerationModalLoading(true);
        if (ytCharGenerateModalStatus) {
            ytCharGenerateModalStatus.textContent = '正在生成，请稍候…';
            ytCharGenerateModalStatus.classList.remove('is-error');
        }
        try {
            const result = await requestYtCharTabGeneration(requestMode, requirement, count);
            if (currentSubChannelData?.id !== requestChannel.id) throw new Error('STALE_CHANNEL');
            const channel = resolveYtCharGenerationChannel(requestChannel.id, requestChannel);
            if (!channel) throw new Error('STALE_CHANNEL');
            if (typeof window.ensureYtFixedCharFanGroup === 'function') window.ensureYtFixedCharFanGroup(channel);
            const generatedContent = channel.generatedContent;
            if (requestMode === 'live') {
                const live = normalizeNewYtCharLive(result?.currentLive, channel);
                generatedContent.currentLive = live;
                channel.isLive = true;
                saveYoutubeData();
                const canonicalChannel = refreshYtCharGeneratedContentUi(channel.id, 'live', channel) || channel;
                openNewYtCharLive(canonicalChannel.generatedContent?.currentLive || live, canonicalChannel);
                if (window.showToast) window.showToast('直播已开始');
                return;
            }
            if (requestMode === 'past') {
                const videos = normalizeNewYtPastVideos(result?.pastVideos, channel, count);
                generatedContent.pastVideos = videos.concat(generatedContent.pastVideos || []);
            } else {
                const posts = normalizeNewYtCommunityPosts(result?.communityPosts, channel, count);
                generatedContent.communityPosts = posts.concat(generatedContent.communityPosts || []);
            }
            saveYoutubeData();
            refreshYtCharGeneratedContentUi(channel.id, requestMode, channel);
            if (window.showToast) window.showToast(requestMode === 'past' ? `已生成 ${count} 个往期视频` : `已生成 ${count} 条帖子`);
        } catch (error) {
            console.error('Char tab generation failed:', error);
            if (ytCharGenerateModalStatus) {
                ytCharGenerateModalStatus.textContent = error?.message === 'INSUFFICIENT_RESULTS'
                    ? '返回内容不足指定数量，本次未保存，请重试。'
                    : '生成失败，请检查 API 配置或网络后重试。';
                ytCharGenerateModalStatus.classList.add('is-error');
            }
            setYtCharGenerationModalLoading(false);
        }
    }

    if (btnGenerate) {
        btnGenerate.addEventListener('click', (event) => {
            event.stopPropagation();
            if (ytCharGenerateRequestActive) return;
            openYtCharGenerationModal();
        });
    }
    ytCharGenerateConfirm?.addEventListener('click', submitYtCharTabGeneration);
    ytCharGenerateModalClose?.addEventListener('click', closeYtCharGenerationModal);
    ytCharGenerateModal?.addEventListener('mousedown', event => {
        if (event.target === ytCharGenerateModal) closeYtCharGenerationModal();
    });
    ytCharGenerateCount?.addEventListener('change', () => {
        ytCharGenerateCount.value = String(clampYtCharGenerationCount(ytCharGenerateCount.value));
    });
