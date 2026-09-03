// --- Community Detail View Logic ---
    const communityDetailView = document.getElementById('yt-community-detail-view');
    const communityDetailBackBtn = document.getElementById('yt-community-detail-back-btn');
    const communityDetailContent = document.getElementById('yt-community-detail-content');
    const postChatSend = document.getElementById('yt-community-chat-send');
    const postChatInput = document.getElementById('yt-community-chat-input');
    const communityDetailGenerateBtn = document.getElementById('yt-community-generate-comments-btn');
    const communityDetailDeletePostBtn = document.getElementById('yt-community-delete-post-btn');
    
    let currentActivePost = null;
    let currentPostReplyTarget = null;
    let ytPostLikeGrowthTimer = null;
    let ytPostCommentGenerationLocked = false;
    const userPostComposeSheet = document.getElementById('yt-user-post-compose-sheet');
    const userPostContentInput = document.getElementById('yt-user-post-content-input');
    const userPostImageWrapper = document.getElementById('yt-user-post-image-wrapper');
    const userPostImagePreview = document.getElementById('yt-user-post-image-preview');
    const userPostImageAddBtn = document.getElementById('yt-user-post-image-add-btn');
    const userPostImageUpload = document.getElementById('yt-user-post-image-upload');
    const userPostImageRemoveBtn = document.getElementById('yt-user-post-image-remove-btn');
    const userPostImageDescriptionGroup = document.getElementById('yt-user-post-image-description-group');
    const userPostImageDescriptionInput = document.getElementById('yt-user-post-image-description-input');
    const userPostPublishBtn = document.getElementById('yt-user-post-publish-btn');
    const postReplyContext = document.getElementById('yt-community-reply-context');
    const postReplyContextText = document.getElementById('yt-community-reply-context-text');
    const postReplyCancel = document.getElementById('yt-community-reply-cancel');

    function stopCommunityControlEvent(e) {
        if (!e) return;
        e.stopPropagation();
    }

    [
        communityDetailContent,
        postChatInput,
        postChatSend,
        communityDetailBackBtn,
        communityDetailGenerateBtn,
        communityDetailDeletePostBtn
    ].filter(Boolean).forEach((el) => {
        el.addEventListener('click', stopCommunityControlEvent);
        el.addEventListener('pointerdown', stopCommunityControlEvent);
    });

    if (communityDetailContent) {
        let isDraggingDetail = false;
        communityDetailContent.addEventListener('touchstart', () => { isDraggingDetail = false; }, { passive: true });
        communityDetailContent.addEventListener('touchmove', () => { isDraggingDetail = true; }, { passive: true });
        communityDetailContent.addEventListener('touchend', () => {
            if (isDraggingDetail) {
                if (postChatInput && document.activeElement === postChatInput) postChatInput.blur();
            }
        });
        communityDetailContent.addEventListener('click', () => {
            if (postChatInput && document.activeElement === postChatInput) postChatInput.blur();
        });
    }

    if (communityDetailBackBtn) {
        communityDetailBackBtn.addEventListener('click', () => {
            if (postChatInput && document.activeElement === postChatInput) postChatInput.blur();
            clearYtPostReplyTarget();
            stopYtPostLikeGrowthTimer();
            if (typeof window.releaseYtChatKeyboardLock === 'function') window.releaseYtChatKeyboardLock();
        });
    }

    if (postReplyCancel) {
        postReplyCancel.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            clearYtPostReplyTarget();
        });
    }

    if (postChatInput) {
        postChatInput.addEventListener('focus', () => {
            if (typeof window.setYtChatKeyboardLock === 'function') window.setYtChatKeyboardLock(communityDetailView, true);
            else if (communityDetailView) communityDetailView.classList.add('keyboard-open');
        });
        postChatInput.addEventListener('blur', () => {
            if (typeof window.setYtChatKeyboardLock === 'function') window.setYtChatKeyboardLock(communityDetailView, false);
            else if (communityDetailView) communityDetailView.classList.remove('keyboard-open');
            window.resetYtViewportOffset?.();
        });
    }

    function getCurrentYtCommunityUser() {
        if (typeof window.getYtEffectiveUserState === 'function') {
            return window.getYtEffectiveUserState() || {};
        }
        return ytUserState || {};
    }

    function ytEscapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function formatYtPostText(value) {
        return ytEscapeHtml(value).replace(/\n/g, '<br>');
    }

    function parseYtPostLikeCount(value) {
        if (Number.isFinite(Number(value))) return Math.max(0, Math.round(Number(value)));
        const text = String(value || '').replace(/,/g, '').trim();
        const matched = text.match(/[\d.]+/);
        if (!matched) return 0;
        const number = Number(matched[0]);
        if (!Number.isFinite(number)) return 0;
        if (text.includes('万')) return Math.max(0, Math.round(number * 10000));
        return Math.max(0, Math.round(number));
    }

    function formatYtPostLikeCount(value) {
        const count = parseYtPostLikeCount(value);
        if (count >= 10000) {
            const formatted = (count / 10000).toFixed(count % 10000 === 0 ? 0 : 1).replace(/\.0$/, '');
            return `${formatted}万`;
        }
        return String(count);
    }

    function makeYtPostCommentId(prefix = 'yt_post_comment') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function normalizeYtPostNameKey(value) {
        return String(value || '').trim().toLowerCase();
    }

    function getYtPostAvailableChars() {
        const rawChars = typeof getYtImChars === 'function'
            ? getYtImChars()
            : (Array.isArray(window.imData?.friends) ? window.imData.friends.filter(friend => friend?.type === 'char') : []);
        return (Array.isArray(rawChars) ? rawChars : []).map(friend => {
            const normalized = window.imApp && typeof window.imApp.normalizeFriendData === 'function'
                ? (window.imApp.normalizeFriendData(friend) || friend)
                : friend;
            const id = String(normalized?.id ?? friend?.id ?? '').trim();
            const name = String(normalized?.nickname || normalized?.realName || normalized?.name || friend?.nickname || friend?.realName || friend?.name || '').trim();
            if (!id || !name) return null;
            return {
                id,
                name,
                avatar: normalized?.avatarUrl || normalized?.avatar || friend?.avatarUrl || friend?.avatar || '',
                persona: normalized?.persona || friend?.persona || friend?.bio || '',
                aliases: [
                    normalized?.nickname,
                    normalized?.realName,
                    normalized?.name,
                    friend?.nickname,
                    friend?.realName,
                    friend?.name
                ].map(normalizeYtPostNameKey).filter(Boolean)
            };
        }).filter(Boolean);
    }

    function resolveYtPostCommentChar(comment) {
        const declaredType = String(comment?.speakerType || comment?.type || '').toLowerCase();
        if (declaredType === 'user') return null;
        const chars = getYtPostAvailableChars();
        if (chars.length === 0) return null;
        const speakerId = String(comment?.speakerId || comment?.charId || comment?.imCharId || '').trim();
        if (speakerId) {
            const byId = chars.find(char => char.id === speakerId);
            if (byId) return byId;
        }
        const nameKey = normalizeYtPostNameKey(comment?.name || comment?.speakerName);
        if (!nameKey) return null;
        if (declaredType === 'char') {
            return chars.find(char => char.aliases.includes(nameKey)) || null;
        }
        return chars.find(char => char.aliases.includes(nameKey)) || null;
    }

    function normalizeYtPostCommentEntry(rawComment, index = 0) {
        const source = typeof rawComment === 'string' ? { text: rawComment } : (rawComment && typeof rawComment === 'object' ? rawComment : {});
        const resolvedChar = resolveYtPostCommentChar(source);
        const fallbackName = `观众${index + 1}`;
        const text = String(source.text ?? source.content ?? '').trim();
        const replies = Array.isArray(source.replies)
            ? source.replies.map((reply, replyIndex) => normalizeYtPostCommentEntry(reply, replyIndex)).filter(reply => reply.text)
            : [];
        source.id = source.id || makeYtPostCommentId();
        source.speakerId = resolvedChar ? resolvedChar.id : String(source.speakerId || source.charId || source.imCharId || '').trim();
        source.speakerType = resolvedChar ? 'char' : String(source.speakerType || source.type || 'fan').trim();
        source.name = resolvedChar ? resolvedChar.name : String(source.name || source.speakerName || fallbackName).trim();
        source.avatar = resolvedChar ? resolvedChar.avatar : (source.avatar || source.avatarUrl || '');
        source.text = text;
        source.translationZh = String(source.translationZh || source.translation || '').trim();
        source.likes = Math.max(0, Math.round(Number(source.likes) || 0));
        source.replyTo = source.replyTo ? String(source.replyTo).trim() : '';
        source.replies = replies;
        return source;
    }

    function ensureYtPostCommentsShape(post) {
        if (!post || typeof post !== 'object') return [];
        post.comments = Array.isArray(post.comments)
            ? post.comments.map((comment, index) => normalizeYtPostCommentEntry(comment, index)).filter(comment => comment.text)
            : [];
        post.commentsCount = post.comments.reduce((total, comment) => total + 1 + (Array.isArray(comment.replies) ? comment.replies.length : 0), 0);
        return post.comments;
    }

    function countYtPostComments(post) {
        const comments = ensureYtPostCommentsShape(post);
        return comments.reduce((total, comment) => total + 1 + (Array.isArray(comment?.replies) ? comment.replies.length : 0), 0);
    }

    function syncYtPostLikeGrowth(post, persist = true) {
        if (!post || typeof post !== 'object') return 0;
        const now = Date.now();
        const currentLikes = parseYtPostLikeCount(post.likes);
        const lastGrowthAt = Number(post.lastLikeGrowthAt);
        if (!Number.isFinite(lastGrowthAt) || lastGrowthAt <= 0) {
            post.likes = currentLikes;
            post.lastLikeGrowthAt = now;
            if (persist) saveYoutubeData();
            return currentLikes;
        }
        const elapsedSteps = Math.min(2880, Math.floor((now - lastGrowthAt) / 30000));
        if (elapsedSteps <= 0) return currentLikes;
        const growthPerStep = Math.max(1, Math.ceil(countYtPostComments(post) * 0.08));
        post.likes = currentLikes + elapsedSteps * growthPerStep;
        post.lastLikeGrowthAt = lastGrowthAt + elapsedSteps * 30000;
        if (persist) saveYoutubeData();
        return post.likes;
    }

    window.syncYtPostLikeGrowth = syncYtPostLikeGrowth;
    window.formatYtPostLikeCount = formatYtPostLikeCount;
    window.countYtPostComments = countYtPostComments;

    function clearYtPostReplyTarget() {
        currentPostReplyTarget = null;
        if (postReplyContext) postReplyContext.style.display = 'none';
        if (postReplyContextText) postReplyContextText.textContent = '';
        if (postChatInput) postChatInput.placeholder = '发表评论...';
    }

    function setYtPostReplyTarget(rootComment, replyToName) {
        if (!rootComment) return;
        currentPostReplyTarget = { rootComment, replyToName: String(replyToName || rootComment.name || '评论者') };
        if (postReplyContext) postReplyContext.style.display = 'flex';
        if (postReplyContextText) postReplyContextText.textContent = `回复 @${currentPostReplyTarget.replyToName}`;
        if (postChatInput) {
            postChatInput.placeholder = `回复 @${currentPostReplyTarget.replyToName}...`;
            postChatInput.focus();
        }
    }

    function stopYtPostLikeGrowthTimer() {
        if (ytPostLikeGrowthTimer) clearInterval(ytPostLikeGrowthTimer);
        ytPostLikeGrowthTimer = null;
    }

    function startYtPostLikeGrowthTimer(post) {
        stopYtPostLikeGrowthTimer();
        if (!post) return;
        ytPostLikeGrowthTimer = setInterval(() => {
            if (currentActivePost !== post || !communityDetailView?.classList.contains('active')) return;
            const growth = Math.max(1, Math.ceil(countYtPostComments(post) * 0.05));
            post.likes = parseYtPostLikeCount(post.likes) + growth;
            post.lastLikeGrowthAt = Date.now();
            saveYoutubeData();
            const likeCount = document.getElementById('yt-community-post-like-count');
            if (likeCount) likeCount.textContent = formatYtPostLikeCount(post.likes);
        }, 10000);
    }

    function setYtPostGenerateButtonLoading(isLoading) {
        ytPostCommentGenerationLocked = !!isLoading;
        if (!communityDetailGenerateBtn) return;
        communityDetailGenerateBtn.style.pointerEvents = isLoading ? 'none' : 'auto';
        communityDetailGenerateBtn.style.opacity = isLoading ? '0.65' : '1';
        communityDetailGenerateBtn.innerHTML = isLoading
            ? '<i class="fas fa-circle-notch fa-spin"></i>'
            : '<i class="fas fa-search"></i>';
        communityDetailGenerateBtn.setAttribute('aria-busy', String(!!isLoading));
    }

    function normalizeYtChatReply(value) {
        if (typeof normalizeYtGeneratedMessage === 'function') {
            return normalizeYtGeneratedMessage(value);
        }
        if (typeof value === 'string') return { text: value.trim(), translationZh: '' };
        return {
            text: String(value?.text ?? value?.content ?? '').trim(),
            translationZh: String(value?.translationZh ?? value?.translation ?? '').trim()
        };
    }

    function getYtBubbleSpeakerKey(msg) {
        if (msg?.type === 'system') return `system:${msg?.status || ''}`;
        if (msg?.type === 'user') return 'user';
        if (msg?.type === 'admin') return `admin:${msg?.speakerId || msg?.name || ''}`;
        if (msg?.isOffer || msg?.type === 'char') return `char:${msg?.name || currentSubChannelData?.name || ''}`;
        return `fan:${msg?.name || ''}`;
    }

    function getYtBubbleGroupState(msg) {
        const speakerKey = getYtBubbleSpeakerKey(msg);
        let previousSpeakerKey = '';
        if (groupChatContainer) {
            const rows = groupChatContainer.querySelectorAll('.yt-bubble-row[data-yt-speaker-key]');
            previousSpeakerKey = rows.length > 0 ? rows[rows.length - 1].dataset.ytSpeakerKey || '' : '';
        }
        return { speakerKey, isConsecutive: previousSpeakerKey === speakerKey };
    }

    function getYtBubbleTextMarkup(msg) {
        const text = ytEscapeHtml(msg?.text || '');
        const translationZh = String(msg?.translationZh || '').trim();
        return {
            className: translationZh ? 'yt-bubble-msg yt-bubble-translatable' : 'yt-bubble-msg',
            attributes: translationZh ? 'role="button" tabindex="0" aria-expanded="false" aria-label="展开中文翻译"' : '',
            html: `${text}${translationZh ? `<div class="yt-bubble-translation">${ytEscapeHtml(translationZh)}</div>` : ''}`
        };
    }

    function bindYtBubbleTranslation(row) {
        const bubble = row?.querySelector('.yt-bubble-translatable');
        if (!bubble) return;
        const toggle = () => {
            const isExpanded = bubble.classList.toggle('yt-translation-expanded');
            bubble.setAttribute('aria-expanded', String(isExpanded));
            bubble.setAttribute('aria-label', isExpanded ? '收起中文翻译' : '展开中文翻译');
        };
        bubble.addEventListener('click', event => {
            event.stopPropagation();
            toggle();
        });
        bubble.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            toggle();
        });
    }

    const YT_CHAT_GENERATION_STALE_MS = 2 * 60 * 1000;
    const YT_CHAT_GENERATION_SOURCE = 'yt-chat-api';

    function createYtChatRuntimeId(prefix = 'yt_msg') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }

    function getCurrentYtChatMode() {
        return groupChatTitle && currentSubChannelData && groupChatTitle.textContent === currentSubChannelData.name ? 'dm' : 'group';
    }

    function resolveYtChatThread(channelId, mode) {
        const safeMode = mode === 'dm' ? 'dm' : 'group';
        const safeChannelId = String(channelId || '');
        let channel = null;

        if (channelState?.userCommunityChannel && String(channelState.userCommunityChannel.id) === safeChannelId) {
            channel = channelState.userCommunityChannel;
        }
        if (!channel && Array.isArray(mockSubscriptions)) {
            channel = mockSubscriptions.find(sub => String(sub?.id) === safeChannelId) || null;
        }
        if (!channel && currentSubChannelData && String(currentSubChannelData.id) === safeChannelId) {
            channel = currentSubChannelData;
        }
        if (!channel) return null;

        const historyKey = safeMode === 'dm' ? 'dmHistory' : 'groupChatHistory';
        if (!Array.isArray(channel[historyKey])) channel[historyKey] = [];
        return {
            channel,
            channelId: String(channel.id || safeChannelId),
            mode: safeMode,
            historyKey,
            history: channel[historyKey]
        };
    }

    function getCurrentYtChatThreadRef() {
        if (!currentSubChannelData?.id) return null;
        return {
            channelId: String(currentSubChannelData.id),
            mode: getCurrentYtChatMode()
        };
    }

    function isCurrentYtChatThread(threadRef) {
        if (!threadRef || !currentSubChannelData?.id) return false;
        return String(currentSubChannelData.id) === String(threadRef.channelId)
            && getCurrentYtChatMode() === threadRef.mode;
    }

    function refreshYtChatThreadIfVisible(threadRef) {
        if (isCurrentYtChatThread(threadRef)) {
            renderGroupChatHistory(threadRef.mode === 'dm');
        }
        if (typeof renderMessagesList === 'function') renderMessagesList();
    }

    function getLatestYtNonSystemMessage(history) {
        for (let index = history.length - 1; index >= 0; index--) {
            if (history[index]?.type !== 'system') return history[index];
        }
        return null;
    }

    function createYtGenerationPlaceholder(generationId) {
        return {
            type: 'system',
            id: generationId,
            generationId,
            source: YT_CHAT_GENERATION_SOURCE,
            status: 'generating',
            text: '\u751f\u6210\u4e2d...',
            createdAt: Date.now()
        };
    }

    function markYtGenerationMessageFailed(message, now = Date.now()) {
        if (!message || message.type !== 'system' || message.status !== 'generating') return false;
        message.status = 'failed';
        message.text = '\u751f\u6210\u4e2d\u65ad\uff0c\u8bf7\u91cd\u65b0\u751f\u6210';
        message.updatedAt = now;
        return true;
    }

    function cleanupStaleYtGeneratingMessages(history, now = Date.now()) {
        if (!Array.isArray(history)) return false;
        let changed = false;
        history.forEach(message => {
            if (message?.type !== 'system' || message.status !== 'generating') return;
            const createdAt = Number(message.createdAt) || 0;
            if (createdAt > 0 && now - createdAt <= YT_CHAT_GENERATION_STALE_MS) return;
            changed = markYtGenerationMessageFailed(message, now) || changed;
        });
        return changed;
    }

    function cleanupAllStaleYtChatGenerations() {
        const channels = [];
        if (channelState?.userCommunityChannel) channels.push(channelState.userCommunityChannel);
        if (Array.isArray(mockSubscriptions)) channels.push(...mockSubscriptions.filter(Boolean));

        let changed = false;
        const now = Date.now();
        channels.forEach(channel => {
            if (Array.isArray(channel.dmHistory)) changed = cleanupStaleYtGeneratingMessages(channel.dmHistory, now) || changed;
            if (Array.isArray(channel.groupChatHistory)) changed = cleanupStaleYtGeneratingMessages(channel.groupChatHistory, now) || changed;
        });

        if (changed) {
            saveYoutubeData();
            const currentRef = getCurrentYtChatThreadRef();
            if (currentRef) refreshYtChatThreadIfVisible(currentRef);
        }
        return changed;
    }

    function markYtChatGenerationFailed(threadRef, generationId) {
        const thread = resolveYtChatThread(threadRef?.channelId, threadRef?.mode);
        if (!thread) return;
        const placeholder = thread.history.find(message => message?.generationId === generationId);
        if (placeholder) {
            markYtGenerationMessageFailed(placeholder);
            saveYoutubeData();
            refreshYtChatThreadIfVisible(threadRef);
        }
    }

    function replaceYtChatGenerationWithReplies(threadRef, generationId, replyMessages) {
        const thread = resolveYtChatThread(threadRef?.channelId, threadRef?.mode);
        if (!thread) return false;
        const messages = Array.isArray(replyMessages) ? replyMessages.filter(message => message?.text) : [];
        if (!messages.length) {
            const placeholder = thread.history.find(message => message?.generationId === generationId);
            if (placeholder) markYtGenerationMessageFailed(placeholder);
            saveYoutubeData();
            refreshYtChatThreadIfVisible(threadRef);
            return false;
        }
        const placeholderIndex = thread.history.findIndex(message => message?.generationId === generationId);
        if (placeholderIndex < 0) return false;
        thread.history.splice(placeholderIndex, 1, ...messages);
        saveYoutubeData();
        refreshYtChatThreadIfVisible(threadRef);
        return true;
    }

    function buildYtGeneratedChatMessage(item, index = 0) {
        const normalizedReply = normalizeYtChatReply(item?.reply);
        if (!normalizedReply.text) return null;
        return {
            type: item.type,
            name: item.name,
            speakerId: item.speakerId,
            avatarUrl: item.avatarUrl,
            text: normalizedReply.text,
            translationZh: normalizedReply.translationZh,
            id: createYtChatRuntimeId('yt_reply'),
            source: YT_CHAT_GENERATION_SOURCE,
            createdAt: Date.now() + index
        };
    }

    window.addEventListener('pageshow', cleanupAllStaleYtChatGenerations);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') cleanupAllStaleYtChatGenerations();
    });

    if (communityDetailBackBtn) {
        communityDetailBackBtn.addEventListener('click', () => {
            if (communityDetailView) communityDetailView.classList.remove('active');
        });
    }

    function openPostDetail(post) {
        if (!communityDetailView || !communityDetailContent || !currentSubChannelData) return;
        if (typeof window.releaseYtChatKeyboardLock === 'function') window.releaseYtChatKeyboardLock(communityDetailView);
        currentActivePost = post;
        clearYtPostReplyTarget();
        syncYtPostLikeGrowth(post);
        if (postChatInput) {
            postChatInput.value = '';
            postChatInput.placeholder = '发表评论...';
            postChatInput.setAttribute('enterkeyhint', 'send');
        }

        // Initialize user avatar in input area
        const userAvatar = document.getElementById('yt-community-user-avatar');
        const userIcon = document.getElementById('yt-community-user-icon');
        const effectiveYtUser = getCurrentYtCommunityUser();
        if (effectiveYtUser.avatarUrl && userAvatar) {
            userAvatar.src = effectiveYtUser.avatarUrl;
            userAvatar.style.display = 'block';
            if(userIcon) userIcon.style.display = 'none';
        }

        renderPostComments();
        startYtPostLikeGrowthTimer(post);
        communityDetailView.classList.add('active');
    }

    function findYtActivePostList() {
        if (!currentActivePost) return null;
        const candidates = [];
        if (Array.isArray(channelState.communityPosts)) candidates.push(channelState.communityPosts);
        if (Array.isArray(currentSubChannelData?.generatedContent?.communityPosts)) candidates.push(currentSubChannelData.generatedContent.communityPosts);
        if (Array.isArray(currentSubChannelData?.communityPosts)) candidates.push(currentSubChannelData.communityPosts);
        return candidates.find(list => list.includes(currentActivePost))
            || candidates.find(list => list.some(post => post?.id && post.id === currentActivePost.id))
            || null;
    }

    function deleteYtActiveCommunityPost() {
        if (!currentActivePost) return;
        const list = findYtActivePostList();
        if (!list) return;
        const index = list.indexOf(currentActivePost);
        const resolvedIndex = index >= 0
            ? index
            : list.findIndex(post => post?.id && post.id === currentActivePost.id);
        if (resolvedIndex < 0) return;
        list.splice(resolvedIndex, 1);
        const deletedPost = currentActivePost;
        currentActivePost = null;
        clearYtPostReplyTarget();
        stopYtPostLikeGrowthTimer();
        saveYoutubeData();
        if (communityDetailView) communityDetailView.classList.remove('active');
        refreshYtUserCommunityPosts();
        if (typeof renderGeneratedContent === 'function') {
            try { renderGeneratedContent('community'); } catch (error) {}
        }
        if (typeof window.showToast === 'function') window.showToast('贴文已删除');
        return deletedPost;
    }

    function renderPostComments() {
        if (!currentActivePost) return;
        const post = currentActivePost;
        const comments = ensureYtPostCommentsShape(post);
        
        let commentsHtml = '';
        if (comments.length > 0) {
            commentsHtml = comments.map((c, rootIndex) => {
                const translationZh = String(c?.translationZh || '').trim();
                const replies = Array.isArray(c?.replies) ? c.replies : [];
                const repliesHtml = replies.map((reply, replyIndex) => {
                    const replyTranslation = String(reply?.translationZh || '').trim();
                    const replyTranslationId = `yt-post-translation-${rootIndex}-${replyIndex}`;
                    return `
                        <div class="yt-community-comment-reply" style="display:flex; gap:9px; margin-top:12px; padding:10px 10px 10px 12px; border-left:2px solid #e5e5ea; background:#fafafa; border-radius:0 12px 12px 0;">
                            <div class="yt-video-avatar" style="width:24px; height:24px; flex-shrink:0; background:#e5e5ea; display:flex; justify-content:center; align-items:center; border-radius:50%; overflow:hidden;">
                                ${reply.avatar ? `<img src="${ytEscapeHtml(reply.avatar)}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="font-size:10px;font-weight:bold;color:#555;">${ytEscapeHtml(String(reply.name || '?').charAt(0).toUpperCase())}</span>`}
                            </div>
                            <div style="flex:1;min-width:0;">
                                <div class="yt-post-comment-reply-target" role="button" tabindex="0" data-root-index="${rootIndex}" data-reply-index="${replyIndex}" style="cursor:pointer;">
                                    <div style="font-size:12px;color:#606060;margin-bottom:3px;">${ytEscapeHtml(reply.name || '用户')}</div>
                                    <div style="font-size:13px;color:#0f0f0f;line-height:1.4;">${reply.replyTo ? `<span style="color:#606060;">回复 @${ytEscapeHtml(reply.replyTo)}：</span>` : ''}${formatYtPostText(reply.text)}</div>
                                </div>
                                <div style="font-size:12px;color:#8e8e93;margin-top:5px;display:flex;gap:14px;">
                                    <span class="yt-post-comment-reply-action" role="button" tabindex="0" data-root-index="${rootIndex}" data-reply-index="${replyIndex}" style="font-weight:600;cursor:pointer;">回复</span>
                                    ${replyTranslation ? `<span class="yt-post-comment-translation-toggle" role="button" tabindex="0" aria-expanded="false" aria-controls="${replyTranslationId}" style="font-weight:600;cursor:pointer;">翻译</span>` : ''}
                                    <span class="yt-post-comment-delete-btn" role="button" tabindex="0" data-root-index="${rootIndex}" data-reply-index="${replyIndex}" style="color:#8e8e93;cursor:pointer;">删除</span>
                                </div>
                                ${replyTranslation ? `<div class="yt-post-comment-translation is-reply" id="${replyTranslationId}" hidden>${formatYtPostText(replyTranslation)}</div>` : ''}
                            </div>
                        </div>
                    `;
                }).join('');
                const rootTranslationId = `yt-post-translation-${rootIndex}-root`;
                return `
                <div class="yt-community-comment-item">
                    <div class="yt-video-avatar" style="width:30px; height:30px; flex-shrink: 0; background-color: #f2f2f2; display: flex; justify-content: center; align-items: center; border-radius: 50%; overflow: hidden;">
                        ${c.avatar ? `<img src="${ytEscapeHtml(c.avatar)}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="font-size:12px; font-weight:bold; color:#555;">${ytEscapeHtml(c.name ? c.name[0].toUpperCase() : '?')}</span>`}
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div class="yt-post-comment-reply-target" role="button" tabindex="0" data-root-index="${rootIndex}" style="cursor:pointer;">
                            <div style="font-size: 13px; color: #606060; margin-bottom: 4px;">${ytEscapeHtml(c.name)}</div>
                            <div style="font-size: 14px; color: #0f0f0f; line-height: 1.4;">${formatYtPostText(c.text)}</div>
                        </div>
                        <div style="font-size: 12px; color: #8e8e93; margin-top: 6px; display: flex; gap: 16px;">
                            <span><i class="far fa-thumbs-up"></i> ${Number.isFinite(Number(c.likes)) ? Math.max(0, Math.round(Number(c.likes))) : 0}</span>
                            <span><i class="far fa-thumbs-down"></i></span>
                            <span class="yt-post-comment-reply-action" role="button" tabindex="0" data-root-index="${rootIndex}" style="font-weight:600;cursor:pointer;">回复</span>
                            ${translationZh ? `<span class="yt-post-comment-translation-toggle" role="button" tabindex="0" aria-expanded="false" aria-controls="${rootTranslationId}" style="font-weight:600;cursor:pointer;">翻译</span>` : ''}
                            <span class="yt-post-comment-delete-btn" role="button" tabindex="0" data-root-index="${rootIndex}" style="color:#8e8e93;cursor:pointer;">删除</span>
                        </div>
                        ${translationZh ? `<div class="yt-post-comment-translation is-root" id="${rootTranslationId}" hidden>${formatYtPostText(translationZh)}</div>` : ''}
                        ${repliesHtml}
                    </div>
                </div>
            `;
            }).join('');
        } else {
            commentsHtml = '<div style="text-align:center; padding: 20px; color:#8e8e93; font-size:13px;" id="yt-empty-post-comments">暂无评论</div>';
        }

        const statusHtml = post.commentsStatus === 'loading'
            ? '<div style="font-size:12px;color:#8e8e93;margin:0 0 12px;"><i class="fas fa-circle-notch fa-spin"></i> 评论生成中</div>'
            : (post.commentsStatus === 'failed' ? '<div style="font-size:12px;color:#ff3b30;margin:0 0 12px;">评论生成失败，贴文已保留</div>' : '');
        const postTranslationZh = String(post.translationZh || post.contentTranslationZh || post.translation || '').trim();
        communityDetailContent.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 12px; gap: 10px;">
                <div class="yt-video-avatar" style="width:40px; height:40px;"><img src="${typeof resolveYtChannelAvatar === 'function' ? resolveYtChannelAvatar(currentSubChannelData) : (currentSubChannelData.avatar || '')}"></div>
                <div style="flex:1;">
                    <div style="font-size:15px; font-weight:500;">${ytEscapeHtml(currentSubChannelData.name || '未知')}</div>
                    <div style="font-size:12px; color:#606060;">${post.time || '刚刚'}</div>
                </div>
            </div>
            <div style="font-size: 15px; line-height: 1.5; color: #0f0f0f; margin-bottom: 16px;">
                ${formatYtPostText(post.content || '')}
            </div>
            ${postTranslationZh ? `
                <span class="yt-community-content-translation-toggle" role="button" tabindex="0" aria-expanded="false" aria-controls="yt-community-detail-post-translation">翻译</span>
                <div class="yt-community-post-translation" id="yt-community-detail-post-translation" hidden>${formatYtPostText(postTranslationZh)}</div>
            ` : ''}
            ${post.imageUrl ? `<img src="${ytEscapeHtml(post.imageUrl)}" alt="贴文图片" style="display:block;width:100%;max-height:420px;object-fit:cover;border-radius:16px;margin:0 0 16px;">` : ''}
            ${statusHtml}
            <div style="display: flex; gap: 24px; color: #606060; font-size: 14px; padding-bottom: 16px;">
                <span><i class="far fa-thumbs-up"></i> <span id="yt-community-post-like-count">${formatYtPostLikeCount(post.likes)}</span></span>
                <span><i class="far fa-thumbs-down"></i></span>
                <span><i class="far fa-comment"></i> ${countYtPostComments(post)}</span>
            </div>

            <div class="yt-community-comments-section" id="yt-post-comments-container">
                <div style="font-size: 14px; font-weight: 500; margin-bottom: 16px;">评论</div>
                ${commentsHtml}
            </div>
        `;
        communityDetailContent.querySelectorAll('.yt-post-comment-translation-toggle, .yt-community-content-translation-toggle').forEach(button => {
            const toggleTranslation = event => {
                event.stopPropagation();
                const translationId = button.getAttribute('aria-controls');
                const translation = translationId ? document.getElementById(translationId) : button.nextElementSibling;
                if (!translation) return;
                const isExpanded = translation.hasAttribute('hidden');
                if (isExpanded) translation.removeAttribute('hidden');
                else translation.setAttribute('hidden', '');
                button.textContent = isExpanded ? '收起翻译' : '翻译';
                button.setAttribute('aria-expanded', String(isExpanded));
            };
            button.addEventListener('click', toggleTranslation);
            button.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                toggleTranslation(event);
            });
        });
        communityDetailContent.querySelectorAll('.yt-post-comment-reply-target').forEach(target => {
            const activateReply = () => {
                const rootIndex = Number(target.dataset.rootIndex);
                const rootComment = post.comments?.[rootIndex];
                if (!rootComment) return;
                const replyIndex = target.dataset.replyIndex === undefined ? -1 : Number(target.dataset.replyIndex);
                const replyToName = replyIndex >= 0 ? rootComment.replies?.[replyIndex]?.name : rootComment.name;
                setYtPostReplyTarget(rootComment, replyToName);
            };
            target.addEventListener('click', event => {
                event.stopPropagation();
                activateReply();
            });
            target.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                activateReply();
            });
        });
        communityDetailContent.querySelectorAll('.yt-post-comment-reply-action').forEach(target => {
            const activateReply = () => {
                const rootIndex = Number(target.dataset.rootIndex);
                const rootComment = post.comments?.[rootIndex];
                if (!rootComment) return;
                const replyIndex = target.dataset.replyIndex === undefined ? -1 : Number(target.dataset.replyIndex);
                const replyToName = replyIndex >= 0 ? rootComment.replies?.[replyIndex]?.name : rootComment.name;
                setYtPostReplyTarget(rootComment, replyToName);
            };
            target.addEventListener('click', event => {
                event.stopPropagation();
                activateReply();
            });
            target.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                activateReply();
            });
        });
        communityDetailContent.querySelectorAll('.yt-post-comment-delete-btn').forEach(button => {
            const deleteComment = () => {
                const rootIndex = Number(button.dataset.rootIndex);
                if (!Array.isArray(post.comments) || rootIndex < 0 || rootIndex >= post.comments.length) return;
                const rootComment = post.comments[rootIndex];
                const replyIndex = button.dataset.replyIndex === undefined ? -1 : Number(button.dataset.replyIndex);
                if (replyIndex >= 0) {
                    if (!Array.isArray(rootComment.replies) || replyIndex >= rootComment.replies.length) return;
                    rootComment.replies.splice(replyIndex, 1);
                } else {
                    post.comments.splice(rootIndex, 1);
                }
                if (currentPostReplyTarget?.rootComment === rootComment) clearYtPostReplyTarget();
                post.commentsCount = countYtPostComments(post);
                saveYoutubeData();
                renderPostComments();
                refreshYtUserCommunityPosts();
            };
            button.addEventListener('click', event => {
                event.stopPropagation();
                deleteComment();
            });
            button.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                deleteComment();
            });
        });
    }

    function resolveYtPostReplyRoot(replyTarget) {
        if (!replyTarget?.rootComment || !currentActivePost) return null;
        const comments = ensureYtPostCommentsShape(currentActivePost);
        if (comments.includes(replyTarget.rootComment)) return replyTarget.rootComment;
        const targetId = replyTarget.rootComment.id;
        return targetId ? comments.find(comment => comment.id === targetId) || null : null;
    }

    function addPostCommentMessage(name, text, isUser = false, translationZh = '', options = {}) {
        const container = document.getElementById('yt-post-comments-container');
        if (!container) return;
        
        const emptyMsg = document.getElementById('yt-empty-post-comments');
        if (emptyMsg) emptyMsg.remove();

        // Update state
        if (!currentActivePost.comments) currentActivePost.comments = [];
        
        const effectiveYtUser = getCurrentYtCommunityUser();
        const rawComment = {
            id: makeYtPostCommentId(),
            name: name,
            text: text,
            speakerType: isUser ? 'user' : 'fan',
            avatar: isUser ? effectiveYtUser.avatarUrl || null : null,
            translationZh: isUser ? '' : String(translationZh || '').trim()
        };
        const newComment = normalizeYtPostCommentEntry(rawComment, currentActivePost.comments.length);
        
        const replyTarget = options.replyTarget || currentPostReplyTarget;
        const rootComment = resolveYtPostReplyRoot(replyTarget);
        const wasReply = !!rootComment;
        if (wasReply) {
            rootComment.replies = Array.isArray(rootComment.replies) ? rootComment.replies : [];
            newComment.replyTo = replyTarget.replyToName;
            rootComment.replies.push(newComment);
        } else {
            currentActivePost.comments.push(newComment);
        }
        currentActivePost.commentsCount = countYtPostComments(currentActivePost);
        if (isUser) currentActivePost.likes = parseYtPostLikeCount(currentActivePost.likes) + 1;
        if (options.clearReplyTarget !== false) clearYtPostReplyTarget();
        saveYoutubeData();

        // Re-render
        renderPostComments();
        refreshYtUserCommunityPosts();
        return { comment: newComment, rootComment, wasReply };
    }

    if (postChatSend && postChatInput) {
        postChatSend.addEventListener('click', async () => {
            const text = postChatInput.value.trim();
            if(!text || !currentActivePost) return;
            
            const effectiveYtUser = getCurrentYtCommunityUser();
            const added = addPostCommentMessage(effectiveYtUser.name || '我', text, true);
            postChatInput.value = '';
            if (added?.wasReply) {
                const container = document.getElementById('yt-post-comments-container');
                let loadingId = null;
                if (container) {
                    loadingId = 'yt-post-thread-reply-loading';
                    const loadingDiv = document.createElement('div');
                    loadingDiv.id = loadingId;
                    loadingDiv.style.textAlign = 'center';
                    loadingDiv.style.padding = '10px';
                    loadingDiv.style.color = '#8e8e93';
                    loadingDiv.style.fontSize = '12px';
                    loadingDiv.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 楼中楼回复生成中...';
                    container.appendChild(loadingDiv);
                }
                try {
                    await generateYtPostThreadReplies(currentActivePost, added.rootComment, added.comment);
                } finally {
                    if (loadingId) {
                        const el = document.getElementById(loadingId);
                        if (el) el.remove();
                    }
                }
                return;
            }
            if (currentActivePost.isUserPost) return;
            
            // Show loading
            const container = document.getElementById('yt-post-comments-container');
            let loadingId = null;
            if(container) {
                loadingId = 'yt-post-reply-loading';
                const loadingDiv = document.createElement('div');
                loadingDiv.id = loadingId;
                loadingDiv.style.textAlign = 'center';
                loadingDiv.style.padding = '10px';
                loadingDiv.style.color = '#8e8e93';
                loadingDiv.style.fontSize = '12px';
                loadingDiv.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 回复生成中...';
                container.appendChild(loadingDiv);
            }

            try {
                const responseObj = await getVODResponse(text, currentActivePost.content, true);
                renderVODResponse(responseObj, true);
            } finally {
                if(loadingId) { const el = document.getElementById(loadingId); if(el) el.remove(); }
            }
        });
        window.mobileInputCompat?.register({
            input: postChatInput,
            root: communityDetailView,
            scrollContainer: communityDetailContent,
            onSend: () => postChatSend.click(),
            allowEmpty: true,
            openClasses: ['keyboard-open', 'yt-chat-keyboard-lock']
        });
    }

    function refreshYtUserCommunityPosts() {
        const activeCommunityTab = document.querySelector('#profile-main-tabs .yt-sliding-tab.active[data-target="community"]');
        if (activeCommunityTab) activeCommunityTab.click();
        if (currentActivePost?.isUserPost && communityDetailView?.classList.contains('active')) renderPostComments();
    }

    function resetYtUserPostComposer() {
        if (userPostContentInput) userPostContentInput.value = '';
        if (userPostImagePreview) {
            userPostImagePreview.src = '';
            userPostImagePreview.removeAttribute('data-image-ready');
        }
        if (userPostImageWrapper) userPostImageWrapper.style.display = 'none';
        if (userPostImageDescriptionGroup) userPostImageDescriptionGroup.style.display = 'none';
        if (userPostImageDescriptionInput) userPostImageDescriptionInput.value = '';
        if (userPostImageUpload) userPostImageUpload.value = '';
    }

    window.openYtUserPostComposer = function() {
        resetYtUserPostComposer();
        if (userPostComposeSheet) userPostComposeSheet.classList.add('active');
        setTimeout(() => {
            if (!userPostComposeSheet?.classList.contains('active')) return;
            userPostContentInput?.focus({ preventScroll: true });
        }, 120);
    };

    window.openYtUserCommunityPost = function(post) {
        if (!post) return;
        const effectiveUser = getCurrentYtCommunityUser();
        currentSubChannelData = channelState.userCommunityChannel || {
            id: 'user_channel_id',
            name: effectiveUser.name || '我的频道',
            avatar: effectiveUser.avatarUrl || '',
            desc: effectiveUser.persona || ''
        };
        openPostDetail(post);
    };

    if (userPostComposeSheet) {
        userPostComposeSheet.addEventListener('mousedown', event => {
            if (event.target === userPostComposeSheet) userPostComposeSheet.classList.remove('active');
        });
    }

    if (userPostImageAddBtn && userPostImageUpload) {
        userPostImageAddBtn.addEventListener('click', () => userPostImageUpload.click());
        userPostImageUpload.addEventListener('change', event => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = loadEvent => {
                const applyImage = url => {
                    if (userPostImagePreview) {
                        userPostImagePreview.src = url;
                        userPostImagePreview.setAttribute('data-image-ready', 'true');
                    }
                    if (userPostImageWrapper) userPostImageWrapper.style.display = 'block';
                    if (userPostImageDescriptionGroup) userPostImageDescriptionGroup.style.display = 'block';
                };
                if (window.compressImage) window.compressImage(loadEvent.target.result, 1280, 1280, applyImage);
                else applyImage(loadEvent.target.result);
            };
            reader.readAsDataURL(file);
            event.target.value = '';
        });
    }

    if (userPostImageRemoveBtn) {
        userPostImageRemoveBtn.addEventListener('click', event => {
            event.preventDefault();
            if (userPostImagePreview) {
                userPostImagePreview.src = '';
                userPostImagePreview.removeAttribute('data-image-ready');
            }
            if (userPostImageWrapper) userPostImageWrapper.style.display = 'none';
            if (userPostImageDescriptionGroup) userPostImageDescriptionGroup.style.display = 'none';
            if (userPostImageDescriptionInput) userPostImageDescriptionInput.value = '';
        });
    }

    function buildYtPostCommentContext(post, rootComment = null) {
        const comments = ensureYtPostCommentsShape(post);
        if (rootComment) {
            const replies = Array.isArray(rootComment.replies) ? rootComment.replies : [];
            return [
                `根评论：${rootComment.name || '观众'}：${rootComment.text || ''}`,
                `已有楼中楼：${replies.map(reply => `${reply.name || '观众'}${reply.replyTo ? ` 回复 @${reply.replyTo}` : ''}：${reply.text || ''}`).join('\n') || '无'}`
            ].join('\n');
        }
        return comments.slice(0, 30).map(comment => {
            const replies = Array.isArray(comment.replies) && comment.replies.length > 0
                ? `\n  楼中楼：${comment.replies.map(reply => `${reply.name || '观众'}${reply.replyTo ? ` 回复 @${reply.replyTo}` : ''}：${reply.text || ''}`).join(' | ')}`
                : '';
            return `${comment.name || '观众'}：${comment.text || ''}${replies}`;
        }).join('\n') || '无';
    }

    function buildYtPostCharPromptContext() {
        const chars = getYtPostAvailableChars();
        if (chars.length === 0) return '无可用 Char';
        return JSON.stringify(chars.slice(0, 30).map(char => ({
            speakerId: char.id,
            name: char.name,
            persona: char.persona || ''
        })));
    }

    function normalizeYtGeneratedPostComments(rawComments, maxCount = 15) {
        const source = Array.isArray(rawComments) ? rawComments : [];
        return source.slice(0, maxCount).map((comment, index) => {
            const raw = typeof comment === 'string'
                ? { name: `观众${index + 1}`, text: comment }
                : (comment && typeof comment === 'object' ? comment : {});
            const languageContext = typeof window.getYtChannelLanguageContext === 'function'
                ? window.getYtChannelLanguageContext(currentSubChannelData)
                : null;
            const localized = typeof window.normalizeYtLocalizedContent === 'function'
                ? window.normalizeYtLocalizedContent(raw, languageContext)
                : { text: String(raw.text || raw.content || '').trim(), translationZh: String(raw.translationZh || raw.translation || '').trim() };
            const text = localized.text;
            if (!text) return null;
            return normalizeYtPostCommentEntry({
                id: makeYtPostCommentId(),
                speakerType: raw.speakerType || raw.type || '',
                speakerId: raw.speakerId || raw.charId || raw.imCharId || '',
                name: raw.name || raw.speakerName || `观众${index + 1}`,
                avatar: raw.avatar || raw.avatarUrl || '',
                text,
                translationZh: localized.translationZh,
                likes: raw.likes
            }, index);
        }).filter(Boolean);
    }

    async function requestYtPostGeneratedComments({ post, mode = 'top', rootComment = null, userReply = null } = {}) {
        if (!post) throw new Error('NO_POST');
        if (!window.apiConfig?.endpoint || !window.apiConfig?.apiKey) throw new Error('API_NOT_CONFIGURED');
        const effectiveUser = getCurrentYtCommunityUser();
        const wbContext = window.getYtWorldBookContext
            ? window.getYtWorldBookContext(`${post.content || ''}\n${rootComment?.text || ''}\n${userReply?.text || ''}`)
            : '';
        const imageContext = post.imageUrl ? (post.imageDescription || '用户未填写图片描述') : '无图片';
        const existingContext = buildYtPostCommentContext(post, rootComment);
        const charContext = buildYtPostCharPromptContext();
        const modeInstruction = mode === 'thread'
            ? `你正在模拟 YouTube 社群贴文某条评论下的楼中楼讨论。用户刚刚回复了别人：${userReply?.name || effectiveUser.name || 'User'}：${userReply?.text || ''}\n请在同一个楼中楼线程继续生成 10–15 条自然、有差异的后续回复，应该排在用户回复之后。可以有人回应用户、回应根评论、互相补充或跑题闲聊；不要冒充发布者或 User。`
            : '请为当前贴文继续生成 10–15 条新的顶层评论，参考已有评论但避免重复昵称、重复观点和机械复读。不要冒充发布者或 User。';
        let prompt = `你要模拟真实 YouTube 社群贴文下的国际化评论区。\n发布者：${effectiveUser.name || '用户'}\n发布者人设：${effectiveUser.persona || '未设置'}\n贴文正文：${post.content}\n图片内容描述：${imageContext}\n世界书：${wbContext || '无'}\n可用 Char 列表：${charContext}\n现有评论上下文：\n${existingContext}\n\n${modeInstruction}\n\n输出规则：\n1. 评论者可以是普通国际观众，也可以是可用 Char 列表中的角色。\n2. 如果使用 Char，speakerType 必须是 "char"，speakerId 必须填写可用 Char 列表里的 speakerId；前端会用真实 Char 名字和头像展示。\n3. 普通观众 speakerType 填 "fan" 或留空，name 使用自然昵称。\n4. YouTube 是国际化平台：text 不是中文时 translationZh 必须提供自然中文翻译；text 是中文时 translationZh 必须为空字符串。\n5. 必须一次返回不少于 10 条，最多 15 条。\n只返回严格 JSON：{"comments":[{"speakerType":"fan或char","speakerId":"Char ID或空字符串","name":"评论者昵称","text":"评论内容","translationZh":"中文翻译或空字符串","likes":0}]}。不要 Markdown。`;
        if (typeof window.buildYtLocalizedJsonContract === 'function') {
            prompt += window.buildYtLocalizedJsonContract(currentSubChannelData, 'every generated comment and thread reply text field');
        }
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
        if (!response.ok) throw new Error(`API_${response.status}`);
        const data = await response.json();
        const rawText = String(data?.choices?.[0]?.message?.content || '').replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = sanitizeObj(JSON.parse(rawText));
        const rawComments = Array.isArray(parsed?.comments)
            ? parsed.comments
            : (Array.isArray(parsed?.replies) ? parsed.replies : (Array.isArray(parsed?.threadReplies) ? parsed.threadReplies : []));
        const comments = normalizeYtGeneratedPostComments(rawComments, 15);
        if (comments.length < 10) throw new Error('TOO_FEW_COMMENTS');
        return comments;
    }

    function appendYtPostTopLevelComments(post, comments) {
        if (!post || !Array.isArray(comments)) return 0;
        ensureYtPostCommentsShape(post);
        comments.forEach(comment => post.comments.push(comment));
        post.commentsCount = countYtPostComments(post);
        post.commentsStatus = 'ready';
        saveYoutubeData();
        if (currentActivePost === post && communityDetailView?.classList.contains('active')) renderPostComments();
        refreshYtUserCommunityPosts();
        return comments.length;
    }

    function appendYtPostThreadReplies(post, rootComment, comments, replyToName = '') {
        if (!post || !rootComment || !Array.isArray(comments)) return 0;
        const resolvedRoot = resolveYtPostReplyRoot({ rootComment });
        if (!resolvedRoot) return 0;
        resolvedRoot.replies = Array.isArray(resolvedRoot.replies) ? resolvedRoot.replies : [];
        comments.forEach(comment => {
            comment.replyTo = comment.replyTo || replyToName || '';
            resolvedRoot.replies.push(comment);
        });
        post.commentsCount = countYtPostComments(post);
        saveYoutubeData();
        if (currentActivePost === post && communityDetailView?.classList.contains('active')) renderPostComments();
        refreshYtUserCommunityPosts();
        return comments.length;
    }

    async function generateYtPostThreadReplies(post, rootComment, userReply) {
        try {
            const comments = await requestYtPostGeneratedComments({ post, mode: 'thread', rootComment, userReply });
            const added = appendYtPostThreadReplies(post, rootComment, comments, userReply?.name || '');
            if (added > 0 && window.showToast) window.showToast(`已生成 ${added} 条楼中楼回复`);
        } catch (error) {
            console.error('User community post thread replies failed:', error);
            if (window.showToast) {
                window.showToast(error?.message === 'API_NOT_CONFIGURED' ? '回复已发送，请先配置 API' : '回复已发送，后续评论生成失败');
            }
        }
    }

    async function generateYtUserPostComments(post) {
        try {
            const comments = await requestYtPostGeneratedComments({ post, mode: 'top' });
            appendYtPostTopLevelComments(post, comments);
        } catch (error) {
            console.error('User community post comments failed:', error);
            post.commentsStatus = 'failed';
            saveYoutubeData();
            refreshYtUserCommunityPosts();
            if (window.showToast) {
                window.showToast(error?.message === 'API_NOT_CONFIGURED' ? '贴文已发布，请先配置 API' : '贴文已发布，评论生成失败');
            }
        }
    }

    async function generateYtPostTopCommentsFromButton() {
        if (!currentActivePost || ytPostCommentGenerationLocked) return;
        const post = currentActivePost;
        setYtPostGenerateButtonLoading(true);
        post.commentsStatus = 'loading';
        saveYoutubeData();
        renderPostComments();
        try {
            const comments = await requestYtPostGeneratedComments({ post, mode: 'top' });
            const added = appendYtPostTopLevelComments(post, comments);
            if (window.showToast) window.showToast(`已生成 ${added} 条评论`);
        } catch (error) {
            console.error('Manual community post comments failed:', error);
            post.commentsStatus = 'failed';
            saveYoutubeData();
            renderPostComments();
            refreshYtUserCommunityPosts();
            if (window.showToast) {
                window.showToast(error?.message === 'API_NOT_CONFIGURED' ? '请先配置 API' : '评论生成失败');
            }
        } finally {
            setYtPostGenerateButtonLoading(false);
        }
    }

    if (communityDetailGenerateBtn) {
        communityDetailGenerateBtn.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            generateYtPostTopCommentsFromButton();
        });
    }

    if (communityDetailDeletePostBtn) {
        communityDetailDeletePostBtn.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            deleteYtActiveCommunityPost();
        });
    }

    if (userPostPublishBtn) {
        userPostPublishBtn.addEventListener('click', () => {
            const content = userPostContentInput?.value.trim() || '';
            if (!content) {
                if (window.showToast) window.showToast('请输入贴文正文');
                return;
            }
            const hasImage = userPostImagePreview?.getAttribute('data-image-ready') === 'true';
            const post = {
                id: `user_post_${Date.now()}`,
                isUserPost: true,
                content,
                translationZh: '',
                imageUrl: hasImage ? userPostImagePreview.src : '',
                imageDescription: hasImage ? (userPostImageDescriptionInput?.value.trim() || '') : '',
                time: '刚刚',
                createdAt: Date.now(),
                likes: 0,
                lastLikeGrowthAt: Date.now(),
                comments: [],
                commentsCount: 0,
                commentsStatus: 'loading'
            };
            channelState.communityPosts = Array.isArray(channelState.communityPosts) ? channelState.communityPosts : [];
            channelState.communityPosts.unshift(post);
            saveYoutubeData();
            if (userPostComposeSheet) userPostComposeSheet.classList.remove('active');
            resetYtUserPostComposer();
            document.querySelector('.yt-nav-item[data-target="yt-profile-tab"]')?.click();
            setTimeout(() => document.querySelector('#profile-main-tabs .yt-sliding-tab[data-target="community"]')?.click(), 0);
            generateYtUserPostComments(post);
        });
    }

    // --- Fan Group Chat Logic ---
    const groupChatView = document.getElementById('yt-bubble-chat-view');
    const groupChatBackBtn = document.getElementById('yt-bubble-chat-back-btn');
    const groupChatTitle = document.getElementById('yt-bubble-chat-title');
    const groupChatContainer = document.getElementById('yt-bubble-chat-container');
    const groupChatInput = document.getElementById('yt-bubble-chat-input');
    const groupChatApiBtn = document.getElementById('yt-bubble-chat-api-btn');
    const groupChatSendBtn = document.getElementById('yt-bubble-chat-send-btn');
    const groupChatSettingsBtn = document.getElementById('yt-bubble-chat-settings-btn');
    
    // Settings Sheet Elements
    const groupSettingsSheet = document.getElementById('yt-group-settings-sheet');
    const groupNameInput = document.getElementById('yt-group-name-input');
    const groupOwnerInfo = document.getElementById('yt-group-owner-info');
    const groupSettingsSaveBtn = document.getElementById('yt-save-group-settings-btn');
    const groupMemberCount = document.getElementById('yt-group-member-count');
    const groupOwnerStatus = document.getElementById('yt-group-owner-status');
    const groupAdminSettingsGroup = document.getElementById('yt-group-admin-settings-group');
    const groupAdminManageBtn = document.getElementById('yt-group-admin-manage-btn');
    const groupAdminCount = document.getElementById('yt-group-admin-count');
    
    let isGroupChatLoading = false;

    function getCurrentYtFanGroup() {
        return currentSubChannelData?.generatedContent?.fanGroup || null;
    }

    function parseYtGroupMemberCount(value, fallback = 1) {
        if (Number.isFinite(Number(value))) return Math.max(1, Math.round(Number(value)));
        const match = String(value || '').replace(/,/g, '').match(/[\d.]+/);
        if (!match) return fallback;
        const parsed = Number(match[0]);
        if (!Number.isFinite(parsed)) return fallback;
        if (String(value).includes('万')) return Math.max(1, Math.round(parsed * 10000));
        return Math.max(1, Math.round(parsed));
    }

    function formatYtGroupMemberCount(value) {
        const count = parseYtGroupMemberCount(value, 1);
        if (count >= 10000) return `${(count / 10000).toFixed(count % 10000 === 0 ? 0 : 1)}万人`;
        return `${count}人`;
    }

    window.applyYtUserCommunityLiveGrowth = function({ liveId, newSubs, totalViews } = {}) {
        const fanGroup = channelState.userCommunityChannel?.generatedContent?.fanGroup;
        const normalizedLiveId = String(liveId || '').trim();
        if (!fanGroup || !normalizedLiveId || String(fanGroup.lastGrowthLiveId || '') === normalizedLiveId) return 0;
        const growth = Math.max(1, Math.round((Number(newSubs) || 0) * 0.5 + (Number(totalViews) || 0) * 0.02));
        fanGroup.memberCount = parseYtGroupMemberCount(fanGroup.memberCount, 1) + growth;
        fanGroup.lastGrowthLiveId = normalizedLiveId;
        if (typeof renderMessagesList === 'function') renderMessagesList();
        if (currentSubChannelData?.isUserOwnedCommunity && groupChatTitle) {
            groupChatTitle.textContent = `${fanGroup.name} (${formatYtGroupMemberCount(fanGroup.memberCount)})`;
        }
        if (currentSubChannelData?.isUserOwnedCommunity && groupMemberCount) {
            groupMemberCount.textContent = formatYtGroupMemberCount(fanGroup.memberCount);
        }
        return growth;
    };

    [
        groupChatContainer,
        groupChatInput,
        groupChatSendBtn,
        groupChatApiBtn,
        groupChatBackBtn,
        groupChatSettingsBtn
    ].filter(Boolean).forEach((el) => {
        el.addEventListener('click', stopCommunityControlEvent);
        el.addEventListener('pointerdown', stopCommunityControlEvent);
    });

    if (groupChatContainer) {
        let isDraggingGroupChat = false;
        groupChatContainer.addEventListener('touchstart', () => { isDraggingGroupChat = false; }, { passive: true });
        groupChatContainer.addEventListener('touchmove', () => { isDraggingGroupChat = true; }, { passive: true });
        groupChatContainer.addEventListener('touchend', () => {
            if (isDraggingGroupChat) {
                if (groupChatInput && document.activeElement === groupChatInput) groupChatInput.blur();
            }
        });
        groupChatContainer.addEventListener('click', () => {
            if (groupChatInput && document.activeElement === groupChatInput) groupChatInput.blur();
        });
    }

    if (groupChatBackBtn) {
        groupChatBackBtn.addEventListener('click', () => {
            if (groupChatInput && document.activeElement === groupChatInput) groupChatInput.blur();
            if (typeof window.releaseYtChatKeyboardLock === 'function') window.releaseYtChatKeyboardLock();
        });
    }

    if (groupChatInput) {
        groupChatInput.addEventListener('focus', () => {
            if (typeof window.setYtChatKeyboardLock === 'function') window.setYtChatKeyboardLock(groupChatView, true);
            else if (groupChatView) groupChatView.classList.add('keyboard-open');
        });
        groupChatInput.addEventListener('blur', () => {
            if (typeof window.setYtChatKeyboardLock === 'function') window.setYtChatKeyboardLock(groupChatView, false);
            else if (groupChatView) groupChatView.classList.remove('keyboard-open');
            window.resetYtViewportOffset?.();
        });
    }

    function sendGroupChatMessageOnly(text) {
        if (!text || !currentSubChannelData || !groupChatTitle) return false;

        const effectiveYtUser = getCurrentYtCommunityUser();
        const userMsg = { type: 'user', name: effectiveYtUser.name || '我', text: text };
        const isDM = groupChatTitle.textContent === currentSubChannelData.name;

        if (isDM) {
            if (!currentSubChannelData.dmHistory) currentSubChannelData.dmHistory = [];
            currentSubChannelData.dmHistory.push(userMsg);
        } else {
            if (!currentSubChannelData.groupChatHistory) currentSubChannelData.groupChatHistory = [];
            currentSubChannelData.groupChatHistory.push(userMsg);
        }

        saveYoutubeData();
        addGroupChatMessageToUI(userMsg);
        if (groupChatInput) groupChatInput.value = '';
        return true;
    }

    if (groupChatBackBtn) {
        groupChatBackBtn.addEventListener('click', () => {
            if (groupChatView) groupChatView.classList.remove('active');
            if (typeof renderMessagesList === 'function') renderMessagesList();
        });
    }
    
    // Group Settings Logic
    const groupAvatarWrapper = document.getElementById('yt-group-avatar-wrapper');
    const groupAvatarUpload = document.getElementById('yt-group-avatar-upload');
    const groupAvatarImg = document.getElementById('yt-group-avatar-img');
    const groupAvatarIcon = document.getElementById('yt-group-avatar-icon');
    const clearGroupHistoryBtn = document.getElementById('yt-clear-group-history-btn');
    const exitGroupBtn = document.getElementById('yt-exit-group-btn');

    const userCommunityCreateSheet = document.getElementById('yt-user-community-create-sheet');
    const userCommunityAvatarWrapper = document.getElementById('yt-user-community-avatar-wrapper');
    const userCommunityAvatarUpload = document.getElementById('yt-user-community-avatar-upload');
    const userCommunityAvatarImg = document.getElementById('yt-user-community-avatar-img');
    const userCommunityAvatarIcon = document.getElementById('yt-user-community-avatar-icon');
    const userCommunityNameInput = document.getElementById('yt-user-community-name-input');
    const userCommunityConfirmBtn = document.getElementById('yt-user-community-confirm-btn');
    const userCommunityAdminSheet = document.getElementById('yt-user-community-admin-sheet');
    const userCommunityAdminList = document.getElementById('yt-user-community-admin-list');
    const userCommunityAdminSaveBtn = document.getElementById('yt-user-community-admin-save-btn');
    let pendingUserCommunityAdminIds = new Set();

    function getYtCommunityAdminSource() {
        const chars = typeof getYtImChars === 'function'
            ? getYtImChars()
            : (typeof window.getImFriends === 'function' ? window.getImFriends().filter(item => item?.type === 'char') : []);
        return Array.isArray(chars) ? chars : [];
    }

    function resolveYtCommunityAdmin(adminSnapshot) {
        const source = getYtCommunityAdminSource();
        const current = source.find(char => String(char.id) === String(adminSnapshot?.charId));
        if (!current) return adminSnapshot || null;
        return {
            charId: current.id,
            name: current.nickname || current.realName || current.name || adminSnapshot?.name || '管理员',
            avatarUrl: current.avatarUrl || adminSnapshot?.avatarUrl || '',
            persona: current.persona || adminSnapshot?.persona || ''
        };
    }

    function findYtCommunityAdmin(speakerId, name) {
        const admins = getCurrentYtFanGroup()?.admins || [];
        const snapshot = admins.find(admin => String(admin.charId) === String(speakerId || ''))
            || admins.find(admin => String(admin.name || '').trim() === String(name || '').trim());
        return snapshot ? resolveYtCommunityAdmin(snapshot) : null;
    }

    function openOwnedYtCommunity() {
        const ownedChannel = channelState.userCommunityChannel;
        const fanGroup = ownedChannel?.generatedContent?.fanGroup;
        if (!ownedChannel || !fanGroup) return false;
        currentSubChannelData = ownedChannel;
        const msgNavBtn = document.querySelector('.yt-nav-item[data-target="yt-messages-tab"]');
        if (msgNavBtn) msgNavBtn.click();
        const communityFilter = document.getElementById('msg-filter-community');
        if (communityFilter) communityFilter.click();
        openFanGroupChat(fanGroup);
        return true;
    }

    window.openYtUserCommunityCreator = function() {
        if (openOwnedYtCommunity()) return;
        const effectiveUser = getCurrentYtCommunityUser();
        if (userCommunityNameInput) userCommunityNameInput.value = `${effectiveUser.name || '我的'}的社群`;
        if (userCommunityAvatarImg) {
            userCommunityAvatarImg.src = '';
            userCommunityAvatarImg.style.display = 'none';
        }
        if (userCommunityAvatarIcon) userCommunityAvatarIcon.style.display = 'block';
        if (userCommunityCreateSheet) userCommunityCreateSheet.classList.add('active');
    };

    if (userCommunityCreateSheet) {
        userCommunityCreateSheet.addEventListener('mousedown', event => {
            if (event.target === userCommunityCreateSheet) userCommunityCreateSheet.classList.remove('active');
        });
    }

    if (userCommunityAvatarWrapper && userCommunityAvatarUpload) {
        userCommunityAvatarWrapper.addEventListener('click', () => userCommunityAvatarUpload.click());
        userCommunityAvatarUpload.addEventListener('change', event => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = loadEvent => {
                const applyAvatar = url => {
                    if (userCommunityAvatarImg) {
                        userCommunityAvatarImg.src = url;
                        userCommunityAvatarImg.style.display = 'block';
                    }
                    if (userCommunityAvatarIcon) userCommunityAvatarIcon.style.display = 'none';
                };
                if (window.compressImage) window.compressImage(loadEvent.target.result, 320, 320, applyAvatar);
                else applyAvatar(loadEvent.target.result);
            };
            reader.readAsDataURL(file);
            event.target.value = '';
        });
    }

    if (userCommunityConfirmBtn) {
        userCommunityConfirmBtn.addEventListener('click', () => {
            if (channelState.userCommunityChannel) {
                if (userCommunityCreateSheet) userCommunityCreateSheet.classList.remove('active');
                openOwnedYtCommunity();
                return;
            }
            const name = userCommunityNameInput?.value.trim();
            if (!name) {
                if (window.showToast) window.showToast('请输入社群名称');
                return;
            }
            const effectiveUser = getCurrentYtCommunityUser();
            const avatar = userCommunityAvatarImg?.style.display === 'block'
                ? userCommunityAvatarImg.src
                : (effectiveUser.avatarUrl || '');
            channelState.userCommunityChannel = {
                id: 'user_community_channel',
                name: effectiveUser.name || '我的频道',
                avatar,
                isUserOwnedCommunity: true,
                isBusiness: false,
                dmHistory: [],
                groupChatHistory: [],
                generatedContent: {
                    communityPosts: [],
                    fanGroup: {
                        id: 'user_fan_group',
                        name,
                        avatar,
                        memberCount: 1,
                        admins: [],
                        isJoined: true,
                        isOwned: true,
                        lastGrowthLiveId: null
                    }
                }
            };
            saveYoutubeData();
            if (userCommunityCreateSheet) userCommunityCreateSheet.classList.remove('active');
            renderMessagesList();
            openOwnedYtCommunity();
            if (window.showToast) window.showToast('社群已创建');
        });
    }

    function renderYtCommunityAdminPicker() {
        if (!userCommunityAdminList) return;
        const fanGroup = getCurrentYtFanGroup();
        const currentAdmins = Array.isArray(fanGroup?.admins) ? fanGroup.admins : [];
        pendingUserCommunityAdminIds = new Set(currentAdmins.map(admin => String(admin.charId)));
        const chars = getYtCommunityAdminSource();
        if (chars.length === 0) {
            userCommunityAdminList.innerHTML = '<div style="padding:40px 10px; text-align:center; color:#8e8e93; font-size:14px;">暂无已添加的 Char</div>';
            return;
        }
        userCommunityAdminList.innerHTML = '';
        chars.forEach(char => {
            const charId = String(char.id);
            const selected = pendingUserCommunityAdminIds.has(charId);
            const name = char.nickname || char.realName || char.name || 'Char';
            const row = document.createElement('div');
            row.className = 'account-card';
            row.dataset.charId = charId;
            row.style.cursor = 'pointer';
            row.innerHTML = `
                <div class="account-content">
                    <div class="account-avatar">${char.avatarUrl ? `<img src="${ytEscapeHtml(char.avatarUrl)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : '<i class="fas fa-user"></i>'}</div>
                    <div class="account-info">
                        <div class="account-name">${ytEscapeHtml(name)}</div>
                        <div class="account-detail">${ytEscapeHtml(char.persona || char.signature || '已添加 Char')}</div>
                    </div>
                    <i class="fas ${selected ? 'fa-check-circle' : 'fa-circle'}" style="color:${selected ? '#34c759' : '#d1d1d6'}; font-size:20px;"></i>
                </div>
            `;
            row.addEventListener('click', () => {
                if (pendingUserCommunityAdminIds.has(charId)) pendingUserCommunityAdminIds.delete(charId);
                else pendingUserCommunityAdminIds.add(charId);
                renderYtCommunityAdminPicker();
            });
            userCommunityAdminList.appendChild(row);
        });
    }

    if (groupAdminManageBtn) {
        groupAdminManageBtn.addEventListener('click', () => {
            if (!currentSubChannelData?.isUserOwnedCommunity) return;
            renderYtCommunityAdminPicker();
            if (userCommunityAdminSheet) userCommunityAdminSheet.classList.add('active');
        });
    }

    if (userCommunityAdminSheet) {
        userCommunityAdminSheet.addEventListener('mousedown', event => {
            if (event.target === userCommunityAdminSheet) userCommunityAdminSheet.classList.remove('active');
        });
    }

    if (userCommunityAdminSaveBtn) {
        userCommunityAdminSaveBtn.addEventListener('click', () => {
            const fanGroup = getCurrentYtFanGroup();
            if (!fanGroup || !currentSubChannelData?.isUserOwnedCommunity) return;
            const chars = getYtCommunityAdminSource();
            const previousCount = Array.isArray(fanGroup.admins) ? fanGroup.admins.length : 0;
            const nextAdmins = chars.filter(char => pendingUserCommunityAdminIds.has(String(char.id))).map(char => ({
                charId: char.id,
                name: char.nickname || char.realName || char.name || '管理员',
                avatarUrl: char.avatarUrl || '',
                persona: char.persona || ''
            }));
            fanGroup.admins = typeof window.normalizeYtAdminSnapshots === 'function'
                ? window.normalizeYtAdminSnapshots(nextAdmins)
                : nextAdmins;
            fanGroup.memberCount = Math.max(1, parseYtGroupMemberCount(fanGroup.memberCount, 1) + fanGroup.admins.length - previousCount);
            saveYoutubeData();
            if (groupMemberCount) groupMemberCount.textContent = formatYtGroupMemberCount(fanGroup.memberCount);
            if (groupAdminCount) groupAdminCount.textContent = `${fanGroup.admins.length}人`;
            if (groupChatTitle) groupChatTitle.textContent = `${fanGroup.name} (${formatYtGroupMemberCount(fanGroup.memberCount)})`;
            if (userCommunityAdminSheet) userCommunityAdminSheet.classList.remove('active');
            renderMessagesList();
            if (window.showToast) window.showToast('管理员已更新');
        });
    }

    if (groupAvatarWrapper && groupAvatarUpload) {
        groupAvatarWrapper.addEventListener('click', () => groupAvatarUpload.click());
        groupAvatarUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (window.compressImage) {
                        window.compressImage(event.target.result, 300, 300, (compressedUrl) => {
                            if (groupAvatarImg) {
                                groupAvatarImg.src = compressedUrl;
                                groupAvatarImg.style.display = 'block';
                            }
                            if (groupAvatarIcon) groupAvatarIcon.style.display = 'none';
                            if (groupAvatarWrapper) groupAvatarWrapper.style.backgroundColor = 'transparent';
                        });
                    } else {
                        if (groupAvatarImg) {
                            groupAvatarImg.src = event.target.result;
                            groupAvatarImg.style.display = 'block';
                        }
                        if (groupAvatarIcon) groupAvatarIcon.style.display = 'none';
                        if (groupAvatarWrapper) groupAvatarWrapper.style.backgroundColor = 'transparent';
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (groupSettingsSheet) {
        groupSettingsSheet.addEventListener('mousedown', (e) => {
            if (e.target === groupSettingsSheet) groupSettingsSheet.classList.remove('active');
        });
    }
    
    if (groupSettingsSaveBtn) {
        groupSettingsSaveBtn.addEventListener('click', () => {
            if (!currentSubChannelData || !currentSubChannelData.generatedContent || !currentSubChannelData.generatedContent.fanGroup) return;
            const fanGroup = currentSubChannelData.generatedContent.fanGroup;
            
            if (currentSubChannelData.isUserOwnedCommunity && groupNameInput && groupNameInput.value.trim()) {
                fanGroup.name = groupNameInput.value.trim();
            }

            if (groupAvatarImg && groupAvatarImg.style.display === 'block' && groupAvatarImg.src) {
                fanGroup.avatar = groupAvatarImg.src;
            }
            if (groupChatTitle) groupChatTitle.textContent = `${fanGroup.name} (${formatYtGroupMemberCount(fanGroup.memberCount)})`;
            
            saveYoutubeData();
            if (currentSubChannelData.isUserOwnedCommunity) {
                const activeTab = document.querySelector('#profile-main-tabs .yt-sliding-tab.active');
                if (activeTab?.getAttribute('data-target') === 'community') activeTab.click();
            } else {
                renderGeneratedContent('community');
            }
            renderMessagesList(); // Refresh message list tab
            if(window.showToast) window.showToast('群设置已修改');
            groupSettingsSheet.classList.remove('active');
        });
    }

    if (clearGroupHistoryBtn) {
        clearGroupHistoryBtn.addEventListener('click', () => {
            window.showCustomModal({
                title: '清空聊天记录',
                message: '确定要清空该群聊的所有历史记录吗？此操作无法撤销。',
                confirmText: '清空',
                cancelText: '取消',
                isDestructive: true,
                onConfirm: () => {
                    if (currentSubChannelData) {
                        currentSubChannelData.groupChatHistory = [];
                        saveYoutubeData();
                        renderGroupChatHistory(false);
                        if(window.showToast) window.showToast('聊天记录已清空');
                    }
                    groupSettingsSheet.classList.remove('active');
                }
            });
        });
    }

    if (exitGroupBtn) {
        exitGroupBtn.addEventListener('click', () => {
            const isOwnedGroup = !!currentSubChannelData?.isUserOwnedCommunity;
            window.showCustomModal({
                title: isOwnedGroup ? '解散社群' : '退出群聊',
                message: isOwnedGroup ? '确定要解散自己的社群吗？社群和聊天记录将被删除。' : '确定要退出该粉丝群吗？退出后聊天记录将被删除。',
                confirmText: isOwnedGroup ? '解散' : '退出',
                cancelText: '取消',
                isDestructive: true,
                onConfirm: () => {
                    if (currentSubChannelData && currentSubChannelData.generatedContent && currentSubChannelData.generatedContent.fanGroup) {
                        if (currentSubChannelData.isUserOwnedCommunity) {
                            channelState.userCommunityChannel = null;
                            saveYoutubeData();
                            groupSettingsSheet.classList.remove('active');
                            if (groupChatView) groupChatView.classList.remove('active');
                            renderMessagesList();
                            if (window.showToast) window.showToast('社群已解散');
                            return;
                        }
                        currentSubChannelData.generatedContent.fanGroup.isJoined = false;
                        currentSubChannelData.groupChatHistory = [];
                        saveYoutubeData();
                        
                        groupSettingsSheet.classList.remove('active');
                        if (groupChatView) groupChatView.classList.remove('active');
                        
                        renderGeneratedContent('community');
                        renderMessagesList();
                        
                        if(window.showToast) window.showToast('已退出群聊');
                    }
                }
            });
        });
    }
    
    // Add Friend to DM Logic
    if (groupOwnerInfo) {
        groupOwnerInfo.addEventListener('click', () => {
            if (!currentSubChannelData) return;
            if (currentSubChannelData.isUserOwnedCommunity) {
                if (window.showToast) window.showToast('这是你的频道');
                return;
            }
            if (currentSubChannelData.isFriend) {
                if (window.showToast) window.showToast('已添加到私信');
                return;
            }
            
            window.showCustomModal({
                title: '添加私信',
                message: `是否将群主 ${currentSubChannelData.name} 添加至私信列表？`,
                confirmText: '添加',
                cancelText: '取消',
                onConfirm: () => {
                    if (!currentSubChannelData.dmHistory) {
                        currentSubChannelData.dmHistory = [];
                    }
                    
                    currentSubChannelData.isFriend = true; // Ensure it shows in DM list
                    if (currentSubChannelData.isBusiness === undefined) {
                        currentSubChannelData.isBusiness = false; // Default to non-business
                    }
                    
                    // Add an initial greeting if empty
                    if (currentSubChannelData.dmHistory.length === 0) {
                        currentSubChannelData.dmHistory.push({
                            type: 'char',
                            name: currentSubChannelData.name,
                            text: '我已经通过了你的好友请求，现在我们可以开始聊天了。'
                        });
                    }
                    
                    saveYoutubeData();
                    renderMessagesList();
                    if (groupOwnerStatus) {
                        groupOwnerStatus.textContent = '已添加';
                        groupOwnerStatus.style.color = '#34c759';
                    }
                    if (window.showToast) window.showToast(`已添加与 ${currentSubChannelData.name} 的私信`);
                }
            });
        });
    }

    const dmSettingsSheet = document.getElementById('yt-dm-settings-sheet');
    const dmGoHomeBtn = document.getElementById('yt-dm-go-home-btn');
    const dmClearHistoryBtn = document.getElementById('yt-dm-clear-history-btn');
    const dmDeleteFriendBtn = document.getElementById('yt-dm-delete-friend-btn');

    if (groupChatSettingsBtn) {
        groupChatSettingsBtn.addEventListener('click', () => {
            if (!currentSubChannelData) return;
            
            const isDM = groupChatTitle && groupChatTitle.textContent === currentSubChannelData.name;
            
            if (isDM) {
                if (dmDeleteFriendBtn) dmDeleteFriendBtn.style.display = 'block';
                if (dmSettingsSheet) dmSettingsSheet.classList.add('active');
            } else {
                // Group Settings
                if (!currentSubChannelData.generatedContent || !currentSubChannelData.generatedContent.fanGroup) return;
                const fanGroup = currentSubChannelData.generatedContent.fanGroup;
                
                if (groupNameInput) {
                    groupNameInput.value = fanGroup.name || '';
                    groupNameInput.readOnly = !currentSubChannelData.isUserOwnedCommunity;
                    groupNameInput.style.color = currentSubChannelData.isUserOwnedCommunity ? '' : '#8e8e93';
                }
                
                // Set Group Avatar
                if (fanGroup.avatar && groupAvatarImg) {
                    groupAvatarImg.src = fanGroup.avatar;
                    groupAvatarImg.style.display = 'block';
                    if (groupAvatarIcon) groupAvatarIcon.style.display = 'none';
                    if (groupAvatarWrapper) groupAvatarWrapper.style.backgroundColor = 'transparent';
                } else {
                    if (groupAvatarImg) groupAvatarImg.style.display = 'none';
                    if (groupAvatarIcon) groupAvatarIcon.style.display = 'block';
                    if (groupAvatarWrapper) groupAvatarWrapper.style.backgroundColor = '#f2f2f7';
                }

                // Set Owner Info
                const ownerName = document.getElementById('yt-group-owner-name');
                const ownerAvatar = document.getElementById('yt-group-owner-avatar');
                if(ownerName) ownerName.textContent = currentSubChannelData.name;
                if(ownerAvatar) {
                    ownerAvatar.src = typeof resolveYtChannelAvatar === 'function' ? resolveYtChannelAvatar(currentSubChannelData) : currentSubChannelData.avatar;
                    ownerAvatar.style.display = 'block';
                }
                if (groupMemberCount) groupMemberCount.textContent = formatYtGroupMemberCount(fanGroup.memberCount);
                const isOwnedGroup = !!currentSubChannelData.isUserOwnedCommunity;
                if (groupOwnerStatus) {
                    groupOwnerStatus.textContent = isOwnedGroup ? '我的频道' : (currentSubChannelData.isFriend ? '已添加' : '添加');
                    groupOwnerStatus.style.color = isOwnedGroup || currentSubChannelData.isFriend ? '#34c759' : '#007aff';
                }
                if (groupAdminSettingsGroup) groupAdminSettingsGroup.style.display = isOwnedGroup ? 'block' : 'none';
                if (groupAdminCount) groupAdminCount.textContent = `${Array.isArray(fanGroup.admins) ? fanGroup.admins.length : 0}人`;
                if (exitGroupBtn) exitGroupBtn.textContent = isOwnedGroup ? '解散社群' : '退出群聊';
                
                if (groupSettingsSheet) groupSettingsSheet.classList.add('active');
            }
        });
    }
    
    if (dmSettingsSheet) {
        dmSettingsSheet.addEventListener('mousedown', (e) => {
            if (e.target === dmSettingsSheet) dmSettingsSheet.classList.remove('active');
        });
    }

    if (dmGoHomeBtn) {
        dmGoHomeBtn.addEventListener('click', () => {
            if (dmSettingsSheet) dmSettingsSheet.classList.remove('active');
            if (groupChatView) groupChatView.classList.remove('active');
            
            if (currentSubChannelData) {
                // Navigate to channel view
                const homeNavBtn = document.querySelector('.yt-nav-item[data-target="yt-home-tab"]');
                if (homeNavBtn) homeNavBtn.click();
                openSubChannelView(currentSubChannelData);
            }
        });
    }

    if (dmClearHistoryBtn) {
        dmClearHistoryBtn.addEventListener('click', () => {
            window.showCustomModal({
                title: '清空聊天记录',
                message: '确定要清空与该联系人的私信记录吗？',
                confirmText: '清空',
                cancelText: '取消',
                isDestructive: true,
                onConfirm: () => {
                    if (currentSubChannelData) {
                        currentSubChannelData.dmHistory = [];
                        
                        // 仅清空数据，不删除联系人卡片，即使不是好友也不删除
                        renderGroupChatHistory(true);
                        renderMessagesList();
                        
                        saveYoutubeData();
                        if(window.showToast) window.showToast('私信记录已清空');
                    }
                    if (dmSettingsSheet) dmSettingsSheet.classList.remove('active');
                }
            });
        });
    }

    if (dmDeleteFriendBtn) {
        dmDeleteFriendBtn.addEventListener('click', () => {
            window.showCustomModal({
                title: '删除私信',
                message: '确定要删除该私信吗？聊天记录将被清空。',
                confirmText: '删除',
                cancelText: '取消',
                isDestructive: true,
                onConfirm: () => {
                    if (currentSubChannelData) {
                        currentSubChannelData.dmHistory = [];
                        currentSubChannelData.isFriend = false; // Set to false to hide from friend list
                        saveYoutubeData();
                        
                        if (dmSettingsSheet) dmSettingsSheet.classList.remove('active');
                        if (groupChatView) groupChatView.classList.remove('active');
                        
                        renderMessagesList();
                        if(window.showToast) window.showToast('已删除私信');
                    }
                }
            });
        });
    }

    function openFanGroupChat(groupData) {
        if (!groupChatView || !currentSubChannelData) return;
        if (typeof window.releaseYtChatKeyboardLock === 'function') window.releaseYtChatKeyboardLock(groupChatView);
        
        if (groupChatTitle) {
            groupChatTitle.textContent = `${groupData.name} (${formatYtGroupMemberCount(groupData.memberCount || 1)})`;
        }

        renderGroupChatHistory(false);
        groupChatView.classList.add('active');
        
        setTimeout(() => {
            if(groupChatContainer) groupChatContainer.scrollTop = groupChatContainer.scrollHeight;
        }, 100);
    }

    function openDMChat(subData) {
        if (!groupChatView || !currentSubChannelData) return;
        if (typeof window.releaseYtChatKeyboardLock === 'function') window.releaseYtChatKeyboardLock(groupChatView);
        
        if (groupChatTitle) {
            groupChatTitle.textContent = `${subData.name}`;
        }

        renderGroupChatHistory(true);
        groupChatView.classList.add('active');
        
        setTimeout(() => {
            if(groupChatContainer) groupChatContainer.scrollTop = groupChatContainer.scrollHeight;
        }, 100);
    }

    function renderGroupChatHistory(isDM = false) {
        if (!groupChatContainer) return;
        groupChatContainer.innerHTML = '';
        
        const historyArray = isDM ? (currentSubChannelData.dmHistory || []) : (currentSubChannelData.groupChatHistory || []);
        if (isDM && !currentSubChannelData.dmHistory) {
            currentSubChannelData.dmHistory = historyArray;
        } else if (!isDM && !currentSubChannelData.groupChatHistory) {
            currentSubChannelData.groupChatHistory = historyArray;
        }

        if (cleanupStaleYtGeneratingMessages(historyArray)) {
            saveYoutubeData();
        }

        historyArray.forEach(msg => {
            addGroupChatMessageToUI(msg);
        });
        groupChatContainer.scrollTop = groupChatContainer.scrollHeight;
    }

    function openOfferDetailSheet(msg) {
        let sheet = document.getElementById('yt-offer-detail-sheet');
        if (!sheet) {
            sheet = document.createElement('div');
            sheet.id = 'yt-offer-detail-sheet';
            sheet.className = 'bottom-sheet-overlay detail-sheet-overlay';
            sheet.style.zIndex = '600';
            sheet.innerHTML = `
                <div class="bottom-sheet" style="height: auto; max-height: 80%;">
                    <div class="sheet-handle"></div>
                    <div class="sheet-title">商单详情</div>
                    <div class="detail-sheet-content" id="yt-offer-detail-content" style="padding-bottom: 30px;">
                    </div>
                </div>
            `;
            document.getElementById('app').appendChild(sheet);
            sheet.addEventListener('mousedown', (e) => {
                if (e.target === sheet) sheet.classList.remove('active');
            });
        }
        
        const contentContainer = document.getElementById('yt-offer-detail-content');
        const isAccepted = msg.offerStatus === 'accepted';
        const isRejected = msg.offerStatus === 'rejected';
        const isCompleted = msg.offerStatus === 'completed';
        const isFailed = msg.offerStatus === 'failed';

        let buttonsHtml = '';
        if (isCompleted) {
            buttonsHtml = `<div style="text-align:center; padding: 12px; color: #8e8e93; font-size: 15px; background: #e8f5e9; border-radius: 12px; margin: 0 16px;">商单已结算完成</div>`;
        } else if (isFailed) {
            buttonsHtml = `<div style="text-align:center; padding: 12px; color: #8e8e93; font-size: 15px; background: #ffebee; border-radius: 12px; margin: 0 16px;">商单已违约取消</div>`;
        } else if (isAccepted) {
            buttonsHtml = `
                <div style="display: flex; gap: 12px; margin: 0 16px;">
                    <div id="offer-sheet-fail-btn" style="flex: 1; padding: 12px; text-align: center; border-radius: 12px; background: #ffebee; color: #ff3b30; font-size: 15px; font-weight: 600; cursor: pointer;">违约放弃</div>
                    <div id="offer-sheet-complete-btn" style="flex: 1; padding: 12px; text-align: center; border-radius: 12px; background: #e8f5e9; color: #388e3c; font-size: 15px; font-weight: 600; cursor: pointer;">完成结单</div>
                </div>
            `;
        } else if (isRejected) {
            buttonsHtml = `<div style="text-align:center; padding: 12px; color: #8e8e93; font-size: 15px; background: #f2f2f2; border-radius: 12px; margin: 0 16px;">已婉拒该商单</div>`;
        } else {
            buttonsHtml = `
                <div style="display: flex; gap: 12px; margin: 0 16px;">
                    <div id="offer-sheet-reject-btn" style="flex: 1; padding: 12px; text-align: center; border-radius: 12px; background: #ffebee; color: #ff3b30; font-size: 15px; font-weight: 600; cursor: pointer;">婉拒</div>
                    <div id="offer-sheet-accept-btn" style="flex: 1; padding: 12px; text-align: center; border-radius: 12px; background: #e8f5e9; color: #388e3c; font-size: 15px; font-weight: 600; cursor: pointer;">接取</div>
                </div>
            `;
        }

        contentContainer.innerHTML = `
            <div style="margin: 20px 16px; background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); border: 1px solid rgba(0,0,0,0.08); border-radius: 16px; padding: 20px;  position: relative; overflow: hidden;">
                <div style="position: absolute; top: -10px; right: -10px; opacity: 0.05; font-size: 100px; pointer-events: none;">
                    <i class="fas fa-handshake"></i>
                </div>
                <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px;">
                    <div style="font-size: 15px; color: #1c1c1e; line-height: 1.5; display: flex; flex-direction: column;">
                        <span style="color: #8e8e93; font-size: 12px; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Subject 项目</span>
                        <span style="font-weight: 500; font-size: 16px;">${msg.offerData.title || '无'} <span style="font-size: 11px; background: #e5e5ea; padding: 2px 6px; border-radius: 4px; color: #8e8e93;">${msg.offerData.offerType || '未知'}</span></span>
                    </div>
                    <div style="font-size: 15px; color: #1c1c1e; line-height: 1.5; display: flex; flex-direction: column; background: rgba(0,0,0,0.02); padding: 12px; border-radius: 8px;">
                        <span style="color: #8e8e93; font-size: 12px; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Requirements 需求</span>
                        <span style="white-space: pre-wrap;">${msg.offerData.requirement || '无'}</span>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                        <div style="display: flex; align-items: baseline; gap: 8px;">
                            <span style="color: #8e8e93; font-size: 12px; text-transform: uppercase; font-weight: 600;">Offer 报价</span>
                            <span style="font-size: 22px; color: #ff3b30; font-weight: 700;">${msg.offerData.price || '面议'}</span>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                            <span style="color: #8e8e93; font-size: 11px; font-weight: 500;">违约金</span>
                            <span style="font-size: 14px; color: #000; font-weight: 600;">${msg.offerData.penalty || '无'}</span>
                        </div>
                    </div>
                </div>
            </div>
            ${buttonsHtml}
        `;

        if (!isAccepted && !isRejected && !isCompleted && !isFailed) {
            setTimeout(() => {
                const acceptBtn = document.getElementById('offer-sheet-accept-btn');
                const rejectBtn = document.getElementById('offer-sheet-reject-btn');
                
                if (acceptBtn) {
                    acceptBtn.addEventListener('click', () => {
                        msg.offerStatus = 'accepted';
                        saveYoutubeData();
                        sheet.classList.remove('active');
                        renderGroupChatHistory(true); 
                        triggerGroupChatAPI("好的，我接下这个合作了，请发送具体合同或细则。");
                    });
                }
                if (rejectBtn) {
                    rejectBtn.addEventListener('click', () => {
                        msg.offerStatus = 'rejected';
                        saveYoutubeData();
                        sheet.classList.remove('active');
                        renderGroupChatHistory(true);
                        triggerGroupChatAPI("抱歉，近期档期较满，暂不接取该合作，感谢邀请。");
                    });
                }
            }, 0);
        } else if (isAccepted) {
            setTimeout(() => {
                const completeBtn = document.getElementById('offer-sheet-complete-btn');
                const failBtn = document.getElementById('offer-sheet-fail-btn');
                
                if (completeBtn) {
                    completeBtn.addEventListener('click', () => {
                        sheet.classList.remove('active');
                        processOfferCompletion(msg, currentSubChannelData, 'complete');
                    });
                }
                if (failBtn) {
                    failBtn.addEventListener('click', () => {
                        sheet.classList.remove('active');
                        processOfferCompletion(msg, currentSubChannelData, 'fail');
                    });
                }
            }, 0);
        }

        sheet.classList.add('active');
    }

    function processOfferCompletion(msg, sub, actionType) {
        const effectiveYtUser = getCurrentYtCommunityUser();
        if (!sub.generatedContent) {
            sub.generatedContent = { pastVideos: [], communityPosts: [], currentLive: null, fanGroup: null };
        }
        
        if (actionType === 'complete') {
            msg.offerStatus = 'completed';
            const priceNum = msg.offerData.rmbAmount || parseFloat((msg.offerData.price || '0').replace(/[^0-9.]/g, '')) || 0;
            if (!channelState.dataCenter) channelState.dataCenter = { views: 0, sc: 0, subs: 0, commission: 0 };
            if (!channelState.dataCenter.commission) channelState.dataCenter.commission = 0;
            channelState.dataCenter.commission += priceNum;
            
            const type = msg.offerData.offerType || 'video';
            const title = msg.offerData.title || '合作项目';
            
            if (type === 'video') {
                if (!sub.generatedContent.pastVideos) sub.generatedContent.pastVideos = [];
                sub.generatedContent.pastVideos.unshift({
                    title: `【官方宣传】${title} ft. ${effectiveYtUser.name || 'User'}`,
                    views: Math.floor(Math.random() * 50) + 10 + '万 次观看',
                    time: '刚刚',
                    thumbnail: 'https://picsum.photos/seed/' + Math.random() + '/320/180?grayscale',
                    comments: [{name: effectiveYtUser.name || '我', text: '感谢官方的邀请！'}]
                });
                sub.dmHistory.push({ type: 'char', name: sub.name, text: '审片通过！视频已经在我们频道上线，反响很好，合作款已打入账户，期待下次合作！' });
            } else if (type === 'live') {
                if (!sub.generatedContent.pastVideos) sub.generatedContent.pastVideos = [];
                sub.generatedContent.pastVideos.unshift({
                    title: `【官方直播回放】${title} 合作专场`,
                    views: Math.floor(Math.random() * 20) + 5 + '万 次观看',
                    time: '刚刚',
                    thumbnail: 'https://picsum.photos/seed/' + Math.random() + '/320/180?grayscale',
                    comments: [{name: effectiveYtUser.name || '我', text: '昨晚带货太有意思了！'}]
                });
                sub.dmHistory.push({ type: 'char', name: sub.name, text: '昨晚在您频道的直播效果爆炸！录播我们官方也同步发布了，感谢主播的热情带货！' });
            } else if (type === 'post') {
                if (!sub.generatedContent.communityPosts) sub.generatedContent.communityPosts = [];
                sub.generatedContent.communityPosts.unshift({
                    content: `非常荣幸能邀请到 @${effectiveYtUser.name || 'User'} 参与我们的 ${title} 活动！现场返图来啦~ #商业合作`,
                    translationZh: '',
                    likes: Math.floor(Math.random() * 10) + 1 + '万',
                    time: '刚刚'
                });
                sub.dmHistory.push({ type: 'char', name: sub.name, text: '社群动态已经看到了，互动率很高，感谢您的支持！' });
            } else if (type === 'collab') {
                if (!channelState.pastVideos) channelState.pastVideos = [];
                const videoObj = {
                    title: `【联动】${title} ft. ${sub.name}`,
                    views: Math.floor(Math.random() * 100) + 20 + '万 次观看',
                    time: '刚刚',
                    thumbnail: 'https://picsum.photos/seed/' + Math.random() + '/320/180?grayscale',
                    comments: [{name: sub.name, text: '太好玩了下次再来！'}]
                };
                channelState.pastVideos.unshift(videoObj);
                
                if (!sub.generatedContent.pastVideos) sub.generatedContent.pastVideos = [];
                sub.generatedContent.pastVideos.unshift(videoObj);
                
                if (!sub.generatedContent.communityPosts) sub.generatedContent.communityPosts = [];
                sub.generatedContent.communityPosts.unshift({
                    content: `今天和 @${effectiveYtUser.name || 'User'} 合作了《${title}》，真是太有趣了，快去看正片！`,
                    translationZh: '',
                    likes: Math.floor(Math.random() * 5) + 1 + '万',
                    time: '刚刚'
                });
                sub.dmHistory.push({ type: 'char', name: sub.name, text: '节目效果太棒了，动态我也发了，下次再一起玩！' });
            } else {
                sub.dmHistory.push({ type: 'char', name: sub.name, text: '项目已验收，合作款已结清，期待下次合作！' });
            }
            
            if(window.showToast) window.showToast('结单成功，全网数据已同步！');
            
        } else if (actionType === 'fail') {
            msg.offerStatus = 'failed';
            const penaltyNum = msg.offerData.rmbPenalty || parseFloat((msg.offerData.penalty || '0').replace(/[^0-9.]/g, '')) || 0;
            if (!channelState.dataCenter) channelState.dataCenter = { views: 0, sc: 0, subs: 0, commission: 0 };
            if (!channelState.dataCenter.commission) channelState.dataCenter.commission = 0;
            channelState.dataCenter.commission -= penaltyNum;
            
            sub.dmHistory.push({ type: 'char', name: sub.name, text: '由于您单方面违约，项目已终止，违约金已从总资产中扣除。希望下次合作能顺利。' });
            if(window.showToast) window.showToast('已违约放弃，扣除违约金');
        }
        
        saveYoutubeData();
        renderGroupChatHistory(true); 
        
        const dataCenterSheet = document.getElementById('yt-data-center-sheet');
        if (dataCenterSheet && dataCenterSheet.classList.contains('active')) {
            renderDataCenter();
        }
        
        const activeTab = document.querySelector('#profile-main-tabs .yt-sliding-tab.active');
        if (activeTab && activeTab.getAttribute('data-target') === 'past') { activeTab.click(); }
    }

    function addGroupChatMessageToUI(msg) {
        if (!groupChatContainer) return;

        const row = document.createElement('div');
        const groupState = getYtBubbleGroupState(msg);
        const groupClass = groupState.isConsecutive ? 'yt-bubble-compact' : 'yt-bubble-group-start';
        const avatarPlaceholder = '<div class="yt-bubble-avatar yt-bubble-avatar-placeholder" aria-hidden="true"></div>';
        row.dataset.ytSpeakerKey = groupState.speakerKey;
        
        if (msg.isOffer) {
            row.className = `yt-bubble-row left ${groupClass}`;
            
            const isAccepted = msg.offerStatus === 'accepted';
            const isRejected = msg.offerStatus === 'rejected';
            const isCompleted = msg.offerStatus === 'completed';
            const isFailed = msg.offerStatus === 'failed';

            let statusText = '待处理';
            let statusColor = '#f57c00';
            if (isAccepted) { statusText = '已接取'; statusColor = '#388e3c'; }
            else if (isRejected) { statusText = '已婉拒'; statusColor = '#ff3b30'; }
            else if (isCompleted) { statusText = '已完成'; statusColor = '#007aff'; }
            else if (isFailed) { statusText = '已违约'; statusColor = '#8e8e93'; }

            row.innerHTML = `
                ${groupState.isConsecutive ? avatarPlaceholder : `<div class="yt-bubble-avatar"><img src="${typeof resolveYtChannelAvatar === 'function' ? resolveYtChannelAvatar(currentSubChannelData) : currentSubChannelData.avatar}"></div>`}
                <div class="yt-bubble-content" style="max-width: 80%;">
                    ${groupState.isConsecutive ? '' : `<div class="yt-bubble-name">${ytEscapeHtml(msg.name || currentSubChannelData?.name || '')}</div>`}
                    <div class="yt-offer-bubble" style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border: 1px solid rgba(0,0,0,0.08); border-radius: 20px; padding: 12px; cursor: pointer; display: flex; align-items: center; gap: 10px;">
                        <div style="background: #007aff; color: #fff; width: 32px; height: 32px; border-radius: 8px; display: flex; justify-content: center; align-items: center;">
                            <i class="fas fa-file-signature"></i>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 14px; font-weight: 600; color: #1c1c1e;">商务合作邀请</div>
                            <div style="font-size: 12px; color: ${statusColor}; font-weight: 500; margin-top: 2px;">状态: ${statusText}</div>
                        </div>
                    </div>
                </div>
            `;
            
            setTimeout(() => {
                const bubble = row.querySelector('.yt-offer-bubble');
                if (bubble) {
                    bubble.addEventListener('click', () => {
                        openOfferDetailSheet(msg);
                    });
                }
            }, 0);

        } else if (msg.type === 'system') {
            row.className = `yt-bubble-row left ${groupClass}`;
            const isGenerating = msg.status === 'generating';
            const iconClass = isGenerating ? 'fas fa-circle-notch fa-spin' : 'fas fa-triangle-exclamation';
            const text = msg.text || (isGenerating ? '\u751f\u6210\u4e2d...' : '\u751f\u6210\u4e2d\u65ad\uff0c\u8bf7\u91cd\u65b0\u751f\u6210');
            row.innerHTML = `
                <div class="yt-bubble-avatar"><i class="${iconClass}" style="color:#8e8e93; font-size:16px; line-height:36px; text-align:center; width:100%;"></i></div>
                <div class="yt-bubble-content">
                    <div class="yt-bubble-msg" style="background:#f2f2f7; color:#8e8e93; font-size:12px;">${ytEscapeHtml(text)}</div>
                </div>
            `;

        } else if (msg.type === 'user') {
            row.className = `yt-bubble-row right ${groupClass}`;
            const effectiveYtUser = getCurrentYtCommunityUser();
            const bubble = getYtBubbleTextMarkup(msg);
            row.innerHTML = `
                ${groupState.isConsecutive ? avatarPlaceholder : `<div class="yt-bubble-avatar"><img src="${effectiveYtUser.avatarUrl || 'https://picsum.photos/100'}"></div>`}
                <div class="yt-bubble-content">
                    ${groupState.isConsecutive ? '' : `<div class="yt-bubble-name">${ytEscapeHtml(msg.name || effectiveYtUser.name || '我')}</div>`}
                    <div class="${bubble.className}" ${bubble.attributes}>${bubble.html}</div>
                </div>
            `;
        } else if (msg.type === 'admin') {
            row.className = `yt-bubble-row left ${groupClass}`;
            const admin = findYtCommunityAdmin(msg.speakerId, msg.name) || {
                charId: msg.speakerId,
                name: msg.name || '管理员',
                avatarUrl: msg.avatarUrl || ''
            };
            const adminName = ytEscapeHtml(admin.name || msg.name || '管理员');
            const adminAvatar = admin.avatarUrl || msg.avatarUrl || '';
            const bubble = getYtBubbleTextMarkup(msg);
            row.innerHTML = `
                ${groupState.isConsecutive ? avatarPlaceholder : `<div class="yt-bubble-avatar">${adminAvatar ? `<img src="${ytEscapeHtml(adminAvatar)}">` : '<i class="fas fa-user-shield" style="color:#8e8e93;"></i>'}</div>`}
                <div class="yt-bubble-content">
                    ${groupState.isConsecutive ? '' : `<div class="yt-bubble-name" style="color:#1c1c1e; font-weight:500; display:flex; align-items:center;">${adminName}<span style="font-size:10px; background:rgba(88,86,214,.1); color:#5856d6; padding:2px 6px; border-radius:6px; margin-left:6px; font-weight:600;">管理员</span></div>`}
                    <div class="${bubble.className}" ${bubble.attributes}>${bubble.html}</div>
                </div>
            `;
        } else if (msg.type === 'char') {
            row.className = `yt-bubble-row left ${groupClass}`;
            // isDM check based on Title matching the name
            const isDMContext = groupChatTitle && groupChatTitle.textContent === currentSubChannelData.name;
            const safeName = ytEscapeHtml(msg.name || currentSubChannelData?.name || '');
            const displayName = isDMContext ? safeName : `${safeName} <span style="font-size: 10px; background: rgba(0, 122, 255, 0.1); color: #007aff; padding: 2px 6px; border-radius: 6px; margin-left: 6px; font-weight: 600;">群主</span>`;
            
            let charAvatarSrc = typeof resolveYtChannelAvatar === 'function' ? resolveYtChannelAvatar(currentSubChannelData) : currentSubChannelData.avatar;
            const bubble = getYtBubbleTextMarkup(msg);
            
            row.innerHTML = `
                ${groupState.isConsecutive ? avatarPlaceholder : `<div class="yt-bubble-avatar"><img src="${charAvatarSrc}"></div>`}
                <div class="yt-bubble-content">
                    ${groupState.isConsecutive ? '' : `<div class="yt-bubble-name" style="color: #1c1c1e; font-weight: 500; display: flex; align-items: center;">${displayName}</div>`}
                    <div class="${bubble.className}" ${bubble.attributes}>${bubble.html}</div>
                </div>
            `;
        } else {
            row.className = `yt-bubble-row left ${groupClass}`;
            let hash = 0;
            const fanName = String(msg.name || '粉丝');
            for (let i = 0; i < fanName.length; i++) hash = fanName.charCodeAt(i) + ((hash << 5) - hash);
            const color = '#' + (hash & 0x00FFFFFF).toString(16).padStart(6, '0');
            const bubble = getYtBubbleTextMarkup(msg);
            
            row.innerHTML = `
                ${groupState.isConsecutive ? avatarPlaceholder : `<div class="yt-bubble-avatar" style="background-color: ${color}; display: flex; justify-content: center; align-items: center; color: white; font-size: 14px; font-weight: bold;">${ytEscapeHtml(fanName.substring(0, 1))}</div>`}
                <div class="yt-bubble-content">
                    ${groupState.isConsecutive ? '' : `<div class="yt-bubble-name">${ytEscapeHtml(fanName)}</div>`}
                    <div class="${bubble.className}" ${bubble.attributes}>${bubble.html}</div>
                </div>
            `;
        }

        groupChatContainer.appendChild(row);
        bindYtBubbleTranslation(row);
        groupChatContainer.scrollTop = groupChatContainer.scrollHeight;
    }

    if (groupChatSendBtn && groupChatInput) {
        groupChatSendBtn.addEventListener('click', () => {
            sendGroupChatMessageOnly(groupChatInput.value.trim());
        });
        groupChatSendBtn.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            groupChatSendBtn.click();
        });
        
        window.mobileInputCompat?.register({
            input: groupChatInput,
            root: groupChatView,
            scrollContainer: groupChatContainer,
            onSend: () => sendGroupChatMessageOnly(groupChatInput.value.trim()),
            allowEmpty: true,
            openClasses: ['keyboard-open', 'yt-chat-keyboard-lock']
        });
    }

    if (groupChatApiBtn && groupChatInput) {
        groupChatApiBtn.addEventListener('click', () => {
            triggerGroupChatAPI('');
        });
        groupChatApiBtn.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            groupChatApiBtn.click();
        });
    }

    async function triggerGroupChatAPI(text) {
        if (isGroupChatLoading || !currentSubChannelData) return;

        const threadRef = getCurrentYtChatThreadRef();
        const thread = threadRef ? resolveYtChatThread(threadRef.channelId, threadRef.mode) : null;
        if (!thread) return;

        const isDM = threadRef.mode === 'dm';
        const targetHistory = thread.history;
        cleanupStaleYtGeneratingMessages(targetHistory);

        let isUserMsg = false;
        let userMsg = null;
        if (text.length > 0) {
            isUserMsg = true;
            const effectiveYtUser = getCurrentYtCommunityUser();
            userMsg = {
                type: 'user',
                name: effectiveYtUser.name || '我',
                text: text,
                id: createYtChatRuntimeId('yt_user'),
                source: 'yt-chat-user',
                createdAt: Date.now()
            };
            targetHistory.push(userMsg);
            if(groupChatInput) groupChatInput.value = '';
        } else {
            isUserMsg = getLatestYtNonSystemMessage(targetHistory)?.type === 'user';
        }

        isGroupChatLoading = true;
        const generationId = createYtChatRuntimeId('yt_gen');
        const placeholder = createYtGenerationPlaceholder(generationId);
        targetHistory.push(placeholder);
        saveYoutubeData();

        if (isCurrentYtChatThread(threadRef)) {
            if (userMsg) addGroupChatMessageToUI(userMsg);
            addGroupChatMessageToUI(placeholder);
        }

        try {
            const char = thread.channel;
            const effectiveYtUser = getCurrentYtCommunityUser();
            const userPersona = effectiveYtUser.persona || '普通粉丝';
            const promptHistory = targetHistory.filter(message => message?.type !== 'system');
            const worldBookSearchText = promptHistory
                .map(message => `${message?.name || ''}: ${message?.text || ''}`)
                .join('\n');
            
            const wbContext = window.getYtWorldBookContext
                ? window.getYtWorldBookContext(`${char?.name || ''}\n${worldBookSearchText}`)
                : '';

            const fanGroup = char?.generatedContent?.fanGroup || null;
            const isOwnedGroup = !isDM && Boolean(char.isUserOwnedCommunity || fanGroup?.isOwned);
            const resolvedAdmins = (fanGroup?.admins || []).map(resolveYtCommunityAdmin).filter(Boolean);
            const findCapturedAdmin = (speakerId, name) => resolvedAdmins.find(admin => String(admin.charId) === String(speakerId || ''))
                || resolvedAdmins.find(admin => String(admin.name || '').trim() === String(name || '').trim())
                || null;
            const adminContext = resolvedAdmins.length > 0
                ? resolvedAdmins.map(admin => `- speakerId: ${admin.charId}; 姓名: ${admin.name}; 人设: ${admin.persona || '未设置'}`).join('\n')
                : '无管理员';
            const historyStr = promptHistory.map(m => `${m.type || 'fan'}${m.speakerId ? `(${m.speakerId})` : ''} ${m.name}: ${m.text}`).join('\n');

            let instructionStr = isUserMsg 
                ? `用户"${effectiveYtUser.name || '我'}"刚刚发送了消息。请先生成其他粉丝的讨论或附和，然后你作为群主回复用户的消息（也可以带上其他粉丝）。`
                : `用户现在在潜水没有说话。请生成其他粉丝在聊天的内容，然后你作为群主偶尔插话或回复他们，展现群里的日常氛围。`;
            
            if (isDM) {
                let contextAddon = '';
                if (char.isBusiness) {
                    contextAddon = `\n注意：当前是商务私信，你扮演品牌方/赞助商（"${char.name}"）。如果用户刚刚接取了你的商单（发了同意接取之类的话），你需要表现出感谢并回复准备对接细节/合同；如果用户婉拒了，则礼貌回应。`;
                }
                const languageHint = char.preferredLanguage ? `优先保持联系人此前的惯用语言：${char.preferredLanguage}。` : '';
                instructionStr = `这是一对一私信。${isUserMsg ? '用户刚刚发送了消息，请自然承接最后一条内容。' : '用户没有发送新消息，请基于聊天上下文自然主动继续话题。'}请你作为"${char.name}"，直接对用户"${effectiveYtUser.name || '我'}"进行私信回复，保持真实活人的短消息节奏。${languageHint}${contextAddon}`;
            } else if (isOwnedGroup) {
                instructionStr = `这是用户自己创建并担任群主的社群。用户群主名为"${effectiveYtUser.name || '我'}"，你绝对不能代替、模仿或生成用户群主的发言。只能生成普通粉丝和上方管理员名单中的管理员发言。管理员发言必须使用真实 speakerId 并严格遵守对应人设；没有管理员时只能生成普通粉丝。${isUserMsg ? '请自然回应用户刚刚发送的消息。' : '请基于上下文自然延续社群日常聊天。'}`;
            }

            function getYtDmVideoText(value) {
                if (value && typeof value === 'object') return String(value.text || value.content || '').trim();
                return String(value || '').trim();
            }

            function summarizeYtDmPastVideos(videos, ownerLabel) {
                const source = Array.isArray(videos) ? videos.slice(0, 6) : [];
                if (source.length === 0) return `${ownerLabel}：暂无往期视频。`;
                return `${ownerLabel}：\n${source.map((video, index) => {
                    const transcript = (Array.isArray(video?.liveTranscript) ? video.liveTranscript : [])
                        .slice(-12)
                        .map(item => `${item?.name ? `${item.name}：` : ''}${getYtDmVideoText(item)}`)
                        .filter(Boolean)
                        .join('｜');
                    const initialBubbles = (Array.isArray(video?.initialBubbles) ? video.initialBubbles : [])
                        .slice(-8)
                        .map(getYtDmVideoText)
                        .filter(Boolean)
                        .join('｜');
                    const comments = (Array.isArray(video?.comments) ? video.comments : [])
                        .slice(-8)
                        .map(item => `${item?.name || '观众'}：${getYtDmVideoText(item)}`)
                        .filter(Boolean)
                        .join('｜');
                    return `${index + 1}. 标题：${video?.title || '无标题'}\n简介：${video?.desc || '无'}\n公开内容：${transcript || initialBubbles || '无可用发言记录'}\n代表评论：${comments || '无'}`;
                }).join('\n\n')}`;
            }

            const dmPastVideoContext = isDM
                ? `【双方往期视频公开内容】\n${summarizeYtDmPastVideos(char?.generatedContent?.pastVideos, `${char.name || 'Char'}自己的往期`)}\n\n${summarizeYtDmPastVideos(channelState?.pastVideos, `${effectiveYtUser.name || 'User'}的往期`)}\n你可以在话题相关时自然回忆、评价或追问这些视频内容，但不能声称看过这里没有记录的内容。`
                : '';

            let promptStr = channelState.groupChatPrompt || defaultGroupChatPrompt;
            const charPersona = typeof window.getYtChannelPersonaWithRelationships === 'function'
                ? window.getYtChannelPersonaWithRelationships(char)
                : (char.desc || '未知');
            let finalPrompt = promptStr
                .replace(/{char}/g, char.name || '')
                .replace(/{char_persona}/g, charPersona)
                .replace(/{user}/g, effectiveYtUser.name || '我')
                .replace(/{user_persona}/g, userPersona)
                .replace(/{admins}/g, adminContext)
                .replace(/{wb_context}/g, wbContext)
                .replace(/{chat_history}/g, historyStr)
                .replace(/{trigger_instruction}/g, instructionStr);
            if (isDM) {
                finalPrompt += `\n\n${dmPastVideoContext}\n\n【国际化输出协议｜不可省略】\n- 返回 {"charReplies":[{"text":"原文","translationZh":"中文翻译或空字符串"}]}。\n- text 不是中文时必须提供自然中文翻译；text 是中文时 translationZh 为空字符串。\n- 只返回合法 JSON，不要 Markdown。`;
            } else {
                const allowedRoles = isOwnedGroup ? 'admin 或 fan，禁止 owner 和 user' : 'owner 或 fan';
                finalPrompt += `\n\n【统一群聊输出协议｜不可省略】\n- 返回 {"groupReplies":[{"role":"角色","speakerId":"管理员ID或空字符串","name":"显示名","text":"原文","translationZh":"中文翻译或空字符串"}]}。\n- role 只能是 ${allowedRoles}。\n- admin 只能从管理员名单选择，speakerId 必须完全一致；fan 使用自然的粉丝昵称。\n- text 不是中文时必须提供自然中文翻译；text 是中文时 translationZh 为空字符串。\n- 生成 2–6 条简短、自然、有连续性的消息。\n- 只返回合法 JSON，不要 Markdown。`;
            }

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
            const responseObj = sanitizeObj(JSON.parse(resultText));

            const scheduledReplies = [];
            if (isDM) {
                const replies = Array.isArray(responseObj.charReplies)
                    ? responseObj.charReplies
                    : (responseObj.charReply ? [responseObj.charReply] : []);
                replies.forEach(reply => scheduledReplies.push({ type: 'char', name: char.name, reply }));
            } else if (Array.isArray(responseObj.groupReplies)) {
                responseObj.groupReplies.forEach(reply => {
                    const role = String(reply?.role || '').toLowerCase();
                    if (role === 'admin') {
                        if (!isOwnedGroup) return;
                        const admin = findCapturedAdmin(reply?.speakerId || reply?.charId, reply?.name);
                        if (!admin) return;
                        scheduledReplies.push({ type: 'admin', name: admin.name, speakerId: admin.charId, avatarUrl: admin.avatarUrl, reply });
                    } else if (role === 'fan' || role === 'otherfan' || role === 'other_fan') {
                        scheduledReplies.push({ type: 'fan', name: reply?.name || '粉丝', reply });
                    } else if (!isOwnedGroup && (role === 'owner' || role === 'char')) {
                        scheduledReplies.push({ type: 'char', name: char.name, reply });
                    }
                });
            } else {
                const fanReplies = Array.isArray(responseObj.otherFansReplies) ? responseObj.otherFansReplies : [];
                fanReplies.forEach(reply => scheduledReplies.push({ type: 'fan', name: reply?.name || '粉丝', reply }));
                if (isOwnedGroup && Array.isArray(responseObj.adminReplies)) {
                    responseObj.adminReplies.forEach(reply => {
                        const admin = findCapturedAdmin(reply?.speakerId || reply?.charId, reply?.name);
                        if (admin) scheduledReplies.push({ type: 'admin', name: admin.name, speakerId: admin.charId, avatarUrl: admin.avatarUrl, reply });
                    });
                } else if (!isOwnedGroup) {
                    const ownerReplies = Array.isArray(responseObj.charReplies)
                        ? responseObj.charReplies
                        : (responseObj.charReply ? [responseObj.charReply] : []);
                    ownerReplies.forEach(reply => scheduledReplies.push({ type: 'char', name: char.name, reply }));
                }
            }

            const replyMessages = scheduledReplies
                .map((item, index) => buildYtGeneratedChatMessage(item, index))
                .filter(Boolean);
            replaceYtChatGenerationWithReplies(threadRef, generationId, replyMessages);

        } catch (error) {
            console.error('Group Chat API Error:', error);
            markYtChatGenerationFailed(threadRef, generationId);
            if(window.showToast) window.showToast('网络错误，无法获取回复');
        } finally {
            setTimeout(() => { isGroupChatLoading = false; }, 2000);
        }
    }

    const communityDetailSheet = document.getElementById('yt-community-detail-sheet');
    if (communityDetailSheet) {
        communityDetailSheet.addEventListener('mousedown', (e) => {
            if (e.target === communityDetailSheet) {
                communityDetailSheet.classList.remove('active');
            }
        });
    }
