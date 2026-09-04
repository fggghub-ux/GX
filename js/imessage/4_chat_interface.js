
// ==========================================
// IMESSAGE: 4_chat_interface.js
// ==========================================
(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    const { apiConfig, userState } = window;
    window.imChat = window.imChat || {};
    const imChat = window.imChat;
    const isAndroid = /Android/i.test(navigator.userAgent || '');
    let keyboardRestoreTimers = [];
    let androidRestingViewportHeight = 0;
    let androidViewportWidth = 0;
    let androidKeyboardWasOpen = false;
    let androidViewportFrame = 0;
    let androidAppliedViewportHeight = 0;
    let androidAppliedViewportTop = 0;

    function getBatchRowDescriptor(row) {
        if (!row || !row.classList?.contains('chat-row') || row.classList.contains('memory-recall-narration')) return null;
        const id = String(row.getAttribute('data-message-id') || '').trim();
        const timestamp = String(row.getAttribute('data-timestamp') || '').trim();
        if (!id && !timestamp) return null;
        return {
            key: id ? `id:${id}` : `timestamp:${timestamp}`,
            id: id || null,
            timestamp: timestamp || null
        };
    }

    function ensureBatchSelectionMap() {
        if (!(window.imData.batchSelectedMessages instanceof Map)) {
            window.imData.batchSelectedMessages = new Map();
        }
        return window.imData.batchSelectedMessages;
    }

    function syncBatchSelectionUi(friend, page = null) {
        const friendId = String(friend?.id || window.imData.currentActiveFriend?.id || '');
        const activePage = page || document.getElementById(`chat-interface-${friendId}`);
        if (!activePage) return;
        const isActiveSelection = !!window.imData.batchSelectMode
            && String(window.imData.batchSelectionFriendId || '') === friendId;
        const selection = ensureBatchSelectionMap();

        const topBar = activePage.querySelector('.chat-top-bar');
        const batchHeader = activePage.querySelector('.chat-batch-header');
        const inputWrapper = activePage.querySelector('.ins-chat-input-wrapper');
        if (topBar) topBar.style.display = isActiveSelection ? 'none' : 'flex';
        if (batchHeader) batchHeader.style.display = isActiveSelection ? 'flex' : 'none';
        if (inputWrapper) inputWrapper.style.display = isActiveSelection ? 'none' : 'flex';

        activePage.querySelectorAll('.chat-checkbox-wrapper').forEach(wrapper => {
            const row = wrapper.closest('.chat-row');
            const descriptor = getBatchRowDescriptor(row);
            const selected = !!descriptor && selection.has(descriptor.key);
            wrapper.style.display = isActiveSelection ? 'flex' : 'none';
            const icon = wrapper.querySelector('i');
            if (!icon) return;
            icon.className = selected ? 'fas fa-check-circle chat-checkbox' : 'far fa-circle chat-checkbox';
            icon.style.color = selected ? '#111111' : '#c7c7cc';
        });

        const selectedCount = isActiveSelection ? selection.size : 0;
        const count = activePage.querySelector('.chat-batch-selection-count');
        if (count) count.textContent = `已选择 ${selectedCount} 条`;
        const deleteButton = activePage.querySelector('.batch-delete-btn');
        const forwardButton = activePage.querySelector('.batch-forward-btn');
        if (forwardButton) {
            forwardButton.disabled = selectedCount === 0;
            forwardButton.style.opacity = selectedCount === 0 ? '0.4' : '1';
        }
        if (deleteButton) {
            deleteButton.disabled = selectedCount === 0;
            deleteButton.style.opacity = selectedCount === 0 ? '0.4' : '1';
        }
    }

    function exitBatchSelectMode(friend = window.imData.currentActiveFriend, page = null) {
        const friendId = String(friend?.id || window.imData.batchSelectionFriendId || '');
        window.imData.batchSelectMode = false;
        window.imData.batchSelectionFriendId = '';
        ensureBatchSelectionMap().clear();
        syncBatchSelectionUi({ id: friendId }, page);
    }

    function enterBatchSelectMode(friend, row, page = null) {
        const friendId = String(friend?.id || '');
        const descriptor = getBatchRowDescriptor(row);
        if (!friendId || !descriptor) return false;
        const selection = ensureBatchSelectionMap();
        selection.clear();
        selection.set(descriptor.key, descriptor);
        window.imData.batchSelectMode = true;
        window.imData.batchSelectionFriendId = friendId;
        syncBatchSelectionUi(friend, page);
        return true;
    }

    function toggleBatchRowSelection(friend, row, page = null) {
        const friendId = String(friend?.id || '');
        if (!window.imData.batchSelectMode || String(window.imData.batchSelectionFriendId || '') !== friendId) return false;
        const descriptor = getBatchRowDescriptor(row);
        if (!descriptor) return false;
        const selection = ensureBatchSelectionMap();
        if (selection.has(descriptor.key)) selection.delete(descriptor.key);
        else selection.set(descriptor.key, descriptor);
        syncBatchSelectionUi(friend, page);
        return true;
    }

    imChat.getBatchRowDescriptor = getBatchRowDescriptor;
    imChat.syncBatchSelectionUi = syncBatchSelectionUi;
    imChat.enterBatchSelectMode = enterBatchSelectMode;
    imChat.exitBatchSelectMode = exitBatchSelectMode;
    imChat.toggleBatchRowSelection = toggleBatchRowSelection;

    function formatStatusLabel(value, isSleeping = false) {
        if (isSleeping) return 'offline';
        const raw = String(value || 'online').trim();
        const normalized = raw.toLowerCase();
        if (normalized === 'offline' || raw === '离线') return 'offline';
        if (normalized === 'online' || raw === '在线') return 'online';
        return raw || 'online';
    }

    function normalizeStatusForStorage(value) {
        const raw = String(value || '').trim();
        const normalized = raw.toLowerCase();
        if (!raw || normalized === 'online' || raw === '在线') return 'online';
        if (normalized === 'offline' || raw === '离线') return 'offline';
        return raw;
    }

    function formatGroupMemberCount(count) {
        const safeCount = Math.max(0, Number(count) || 0);
        return `${safeCount} member${safeCount === 1 ? '' : 's'}`;
    }

    function isChatInputFocused(page) {
        const input = page?.querySelector('.chat-input');
        return !!input && document.activeElement === input;
    }

    function getAndroidViewportMetrics() {
        const viewport = window.visualViewport;
        return {
            height: Math.round(viewport?.height || window.innerHeight || 0),
            width: Math.round(viewport?.width || window.innerWidth || 0)
        };
    }

    function captureAndroidRestingViewport() {
        if (!isAndroid) return;
        const metrics = getAndroidViewportMetrics();
        if (metrics.width > 0 && Math.abs(metrics.width - androidViewportWidth) > 48) {
            androidViewportWidth = metrics.width;
            androidRestingViewportHeight = metrics.height;
            androidKeyboardWasOpen = false;
            return;
        }
        androidViewportWidth = metrics.width || androidViewportWidth;
        androidRestingViewportHeight = Math.max(androidRestingViewportHeight, metrics.height);
    }

    function clearKeyboardRestoreTimers() {
        keyboardRestoreTimers.forEach(timer => clearTimeout(timer));
        keyboardRestoreTimers = [];
    }

    function applyAndroidChatViewport(page, msgContainer, metrics = getAndroidViewportMetrics(), options = {}) {
        if (!isAndroid || !page || !window.visualViewport || metrics.height <= 0) return;

        const viewportTop = Math.round(window.visualViewport.offsetTop || 0);
        const metricsChanged = metrics.height !== androidAppliedViewportHeight
            || viewportTop !== androidAppliedViewportTop;
        const viewportClassApplied = page.classList.contains('u2-android-chat-viewport-sized');
        if (!metricsChanged && viewportClassApplied) return;
        if (metricsChanged) {
            androidAppliedViewportHeight = metrics.height;
            androidAppliedViewportTop = viewportTop;
            page.style.setProperty('--u2-android-chat-viewport-height', `${metrics.height}px`);
            page.style.setProperty('--u2-android-chat-viewport-top', `${viewportTop}px`);
        }
        if (!viewportClassApplied) page.classList.add('u2-android-chat-viewport-sized');

        if (options.scrollToBottom) requestAnimationFrame(() => {
            if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
        });
    }

    function restoreAndroidChatViewport(page, msgContainer) {
        if (!isAndroid || !page) return;

        page.classList.remove('u2-android-chat-viewport-sized');
        page.style.removeProperty('--u2-android-chat-viewport-height');
        page.style.removeProperty('--u2-android-chat-viewport-top');
        androidAppliedViewportHeight = 0;
        androidAppliedViewportTop = 0;
        page.classList.remove('keyboard-open');
        if (page.style.display === 'none') return;
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;

        requestAnimationFrame(() => {
            if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
        });
    }

    function scheduleAndroidChatViewportRestore(page, msgContainer) {
        if (!isAndroid) return;
        clearKeyboardRestoreTimers();
        [0, 60, 180, 360].forEach(delay => {
            keyboardRestoreTimers.push(setTimeout(() => {
                restoreAndroidChatViewport(page, msgContainer);
            }, delay));
        });
    }

    captureAndroidRestingViewport();

    if (isAndroid && window.visualViewport && !imChat._androidViewportListenersBound) {
        imChat._androidViewportListenersBound = true;
        const processViewportChange = () => {
            androidViewportFrame = 0;
            const page = document.querySelector('.active-chat-interface[style*="display: flex"]');
            if (!page) return;

            const metrics = getAndroidViewportMetrics();
            if (Math.abs(metrics.width - androidViewportWidth) > 48) {
                androidViewportWidth = metrics.width;
                androidRestingViewportHeight = metrics.height;
                androidKeyboardWasOpen = false;
                return;
            }

            const msgContainer = page.querySelector('.ins-chat-messages');
            const inputFocused = isChatInputFocused(page);
            if (!inputFocused && !androidKeyboardWasOpen) {
                androidRestingViewportHeight = Math.max(androidRestingViewportHeight, metrics.height);
            }

            if (inputFocused && androidRestingViewportHeight - metrics.height > 100) {
                const keyboardJustOpened = !androidKeyboardWasOpen;
                androidKeyboardWasOpen = true;
                applyAndroidChatViewport(page, msgContainer, metrics, { scrollToBottom: keyboardJustOpened });
                return;
            }

            if (androidKeyboardWasOpen && metrics.height >= androidRestingViewportHeight - 72) {
                androidKeyboardWasOpen = false;
                androidRestingViewportHeight = Math.max(androidRestingViewportHeight, metrics.height);
                scheduleAndroidChatViewportRestore(page, msgContainer);
            }
        };

        const handleViewportChange = () => {
            if (androidViewportFrame) return;
            androidViewportFrame = requestAnimationFrame(processViewportChange);
        };

        window.visualViewport.addEventListener('resize', handleViewportChange, { passive: true });
        window.visualViewport.addEventListener('scroll', handleViewportChange, { passive: true });
    }

    function closeStaleGroupCallSheets() {
        ['group-call-invite-sheet', 'group-more-sheet'].forEach((id) => {
            const sheet = document.getElementById(id);
            if (!sheet) return;

            sheet.classList.remove('active');
            sheet.style.pointerEvents = '';
        });
    }

    function renderTogetherListeningPlayer(friendOrId) {
        const friendId = String(typeof friendOrId === 'object' ? (friendOrId?.id ?? '') : (friendOrId ?? ''));
        if (!friendId) return;
        const friend = (window.imData?.friends || []).find((item) => String(item.id) === friendId)
            || (typeof friendOrId === 'object' ? friendOrId : null);
        const page = document.getElementById(`chat-interface-${friendId}`);
        const card = page?.querySelector('.im-together-listening-player');
        if (!card) return;
        const snapshot = friend?.type === 'char' && window.libraryApp?.getTogetherListeningSnapshot
            ? window.libraryApp.getTogetherListeningSnapshot(friendId)
            : null;
        card.hidden = !snapshot;
        if (!snapshot) return;

        const art = card.querySelector('.im-together-listening-art');
        const title = card.querySelector('.im-together-listening-title');
        const artist = card.querySelector('.im-together-listening-artist');
        const play = card.querySelector('[data-together-listening-control="toggle"]');
        if (art) {
            art.innerHTML = snapshot.coverUrl ? '' : '<i class="fas fa-music"></i>';
            if (snapshot.coverUrl) {
                const image = document.createElement('img');
                image.src = snapshot.coverUrl;
                image.alt = '';
                image.referrerPolicy = 'no-referrer';
                art.appendChild(image);
            }
        }
        if (title) title.textContent = snapshot.title || '未知歌曲';
        if (artist) artist.textContent = snapshot.artist || '未知歌手';
        if (play) {
            play.innerHTML = `<i class="fas ${snapshot.isPlaying ? 'fa-pause' : 'fa-play'}"></i>`;
            play.setAttribute('aria-label', snapshot.isPlaying ? '暂停' : '播放');
        }
        card.style.setProperty('--together-progress', `${Math.round((snapshot.progress || 0) * 10000) / 100}%`);
    }

    imChat.renderTogetherListeningPlayer = renderTogetherListeningPlayer;
    if (!imChat._togetherListeningEventBound) {
        imChat._togetherListeningEventBound = true;
        window.addEventListener('library:together-listening-change', () => {
            document.querySelectorAll('.im-together-listening-player').forEach((card) => {
                const page = card.closest('.active-chat-interface');
                const friendId = String(page?.id || '').replace(/^chat-interface-/, '');
                if (friendId) renderTogetherListeningPlayer(friendId);
            });
        });
    }

    function getGroupAvatarInitial(friend) {
        return String(friend?.nickname || friend?.realName || 'G').charAt(0).toUpperCase();
    }

    function renderGroupHeaderAvatarInnerHtml(friend) {
        const avatarUrl = friend?.avatarUrl || '';
        if (avatarUrl) {
            return `<img class="im-group-header-avatar-img" src="${avatarUrl}" alt="">`;
        }

        return `<div class="im-group-header-avatar-fallback">${getGroupAvatarInitial(friend)}</div>`;
    }

    imChat.refreshGroupHeaderAvatar = function(groupOrId) {
        const groupId = groupOrId && typeof groupOrId === 'object' ? groupOrId.id : groupOrId;
        if (groupId == null) return false;

        const latestGroup = (window.imData?.friends || []).find(item => String(item.id) === String(groupId))
            || (groupOrId && typeof groupOrId === 'object' ? groupOrId : null);
        if (!latestGroup || latestGroup.type !== 'group') return false;

        const page = document.getElementById(`chat-interface-${latestGroup.id}`);
        if (!page) return false;

        const inner = page.querySelector('.group-header-right-avatar-inner');
        if (!inner) return false;

        inner.innerHTML = renderGroupHeaderAvatarInnerHtml(latestGroup);
        return true;
    };

    function getLiveGroup(groupOrId) {
        const groupId = groupOrId && typeof groupOrId === 'object' ? groupOrId.id : groupOrId;
        if (groupId == null) return groupOrId && typeof groupOrId === 'object' ? groupOrId : null;
        return (window.imData?.friends || []).find(item => String(item.id) === String(groupId))
            || (groupOrId && typeof groupOrId === 'object' ? groupOrId : null);
    }

    function isLeftGroup(group) {
        return group && group.type === 'group' && Number(group.leftGroupAt) > 0;
    }

    function getGroupMemberCount(group) {
        const memberCount = typeof window.imChat?.getGroupMemberFriends === 'function'
            ? window.imChat.getGroupMemberFriends(group).length
            : new Set((Array.isArray(group?.members) ? group.members : []).map(memberId => String(memberId))).size;
        return memberCount + (isLeftGroup(group) ? 0 : 1);
    }

    async function rejoinGroupChat(group, page) {
        const liveGroup = getLiveGroup(group);
        if (!liveGroup || liveGroup.type !== 'group') return false;

        const saved = window.imApp?.commitScopedFriendChange
            ? await window.imApp.commitScopedFriendChange(liveGroup.id, (targetGroup) => {
                if (!targetGroup) return;
                targetGroup.leftGroupAt = 0;
                targetGroup.groupObserverMode = false;
                targetGroup.leftGroupMemberSnapshot = [];
            }, {
                syncActive: true,
                metaOnly: true,
                silent: true
            })
            : false;

        if (!saved) {
            if (window.showToast) window.showToast('重新进入失败');
            return false;
        }

        const groupRejoinedNotice = {
            id: `sys-${Date.now()}`,
            role: 'system',
            type: 'system_notice',
            noticeKind: 'group_rejoined',
            content: '你重新进入群聊',
            text: '你重新进入群聊',
            timestamp: Date.now()
        };
        await window.imApp.appendFriendMessage(liveGroup.id, groupRejoinedNotice, { silent: true });

        const latestGroup = getLiveGroup(liveGroup) || liveGroup;
        if (window.showToast) window.showToast('已重新进入群聊');
        if (page) imChat.syncGroupExitState(latestGroup, page);
        const msgContainer = page ? page.querySelector('.ins-chat-messages') : null;
        if (msgContainer && window.imChat?.rerenderChatContainer) {
            window.imChat.rerenderChatContainer(latestGroup, msgContainer, { scroll: true });
        }
        if (window.imApp.openChatTab) window.imApp.openChatTab(latestGroup);
        return true;
    }

    imChat.syncGroupExitState = function(groupOrId, page) {
        const group = getLiveGroup(groupOrId);
        if (!group || group.type !== 'group' || !page) return false;

        const left = isLeftGroup(group);
        const inputWrapper = page.querySelector('.ins-chat-input-wrapper');
        const leftBar = page.querySelector('.im-left-group-bar');
        const input = page.querySelector('.chat-input');
        const replyPreview = page.querySelector('.reply-preview-container');
        const mentionList = page.querySelector('.at-mention-list');

        if (inputWrapper) inputWrapper.style.display = left ? 'none' : 'flex';
        if (leftBar) leftBar.style.display = left ? 'flex' : 'none';
        if (input) {
            input.disabled = left;
            input.value = left ? '' : input.value;
        }
        if (left && replyPreview) replyPreview.style.display = 'none';
        if (left && mentionList) mentionList.style.display = 'none';

        const rejoinBtn = leftBar ? leftBar.querySelector('.im-left-group-rejoin-btn') : null;
        const aiBtn = leftBar ? leftBar.querySelector('.im-left-group-ai-btn') : null;
        const stateLabel = leftBar ? leftBar.querySelector('.im-left-group-label') : null;
        const msgContainer = page.querySelector('.ins-chat-messages');
        if (stateLabel) stateLabel.textContent = group.groupObserverMode ? '旁观群聊' : '已退出该群';
        if (rejoinBtn) rejoinBtn.style.display = group.groupObserverMode ? 'none' : '';

        if (rejoinBtn) {
            rejoinBtn.onclick = (e) => {
                e.preventDefault();
                void rejoinGroupChat(group, page);
            };
        }

        if (aiBtn) {
            aiBtn.onclick = (e) => {
                e.preventDefault();
                if (!window.imChat?.handleAiReply) {
                    if (window.showToast) window.showToast('无法调用 AI 接口');
                    return;
                }
                const latestGroup = getLiveGroup(group) || group;
                if (!window.showCustomModal) {
                    window.imChat.handleAiReply(latestGroup, msgContainer, aiBtn, { source: 'left_group_continue' });
                    return;
                }
                window.showCustomModal({
                    type: 'prompt',
                    multiline: true,
                    title: '推进剧情',
                    message: '可以输入你希望群成员接下来聊的方向；留空则由他们自由发展。',
                    placeholder: '例如：让他们聊聊刚才发生的事（可留空）',
                    confirmText: '推进',
                    confirmTone: 'dark',
                    onConfirm: (value) => {
                        const direction = String(value || '').trim();
                        const extraSystemPrompt = direction
                            ? `【旁观推进提示｜仅影响本轮群聊】\n旁观者希望群成员接下来围绕以下方向自然聊天：${direction}\n这不是 User 在群内发送的消息，不得让任何成员声称看到 User 发言，也不得让 User 出现在群内。`
                            : '';
                        window.imChat.handleAiReply(latestGroup, msgContainer, aiBtn, {
                            source: 'left_group_continue',
                            continueWithoutUser: true,
                            extraSystemPrompt
                        });
                    }
                });
            };
        }

        return true;
    };

const IM_CHAT_PAGE_CACHE_LIMIT = 6;

function touchChatPageCache(page) {
    if (page) page.dataset.imChatCacheUsedAt = String(Date.now());
}

function pruneHiddenChatPages(options = {}) {
    const chatsContent = document.getElementById('chats-content');
    if (!chatsContent) return 0;

    const keepFriendId = options.keepFriendId == null ? '' : String(options.keepFriendId);
    const activeFriendId = window.imData?.currentActiveFriend?.id == null
        ? ''
        : String(window.imData.currentActiveFriend.id);
    const pages = Array.from(chatsContent.querySelectorAll('.active-chat-interface[id^="chat-interface-"]'));
    const candidates = pages
        .filter((page) => {
            const friendId = String(page.id).replace(/^chat-interface-/, '');
            return friendId !== keepFriendId && friendId !== activeFriendId && page.style.display === 'none';
        })
        .sort((left, right) => (Number(left.dataset.imChatCacheUsedAt) || 0) - (Number(right.dataset.imChatCacheUsedAt) || 0));

    let overflow = Math.max(0, pages.length - IM_CHAT_PAGE_CACHE_LIMIT);
    while (overflow > 0 && candidates.length > 0) {
        candidates.shift().remove();
        overflow -= 1;
    }
    return Math.max(0, pages.length - IM_CHAT_PAGE_CACHE_LIMIT - overflow);
}

window.imChat.pruneHiddenChatPages = pruneHiddenChatPages;

async function openChatTab(friend) {
        const chatsContent = document.getElementById('chats-content');
        const navChatsBtn = document.getElementById('nav-chats-btn');
        window.imApp?.setActiveThemeSurface?.('chat-detail');
        closeStaleGroupCallSheets();

        if (window.imApp.ensureFriendMessagesLoaded) {
            await window.imApp.ensureFriendMessagesLoaded(friend, {
                onLoaded: (_, loadedFriend) => {
                    if (window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(loadedFriend.id)) {
                        window.imData.currentActiveFriend = loadedFriend;
                    }
                }
            });
        }

        const activeFriend = (window.imData.friends || []).find(
            item => String(item.id) === String(friend.id)
        ) || friend;

        if (window.imData.batchSelectMode
            && String(window.imData.batchSelectionFriendId || '') !== String(activeFriend.id)) {
            exitBatchSelectMode(window.imData.currentActiveFriend);
        }
        window.imData.currentActiveFriend = activeFriend;
        friend = activeFriend;
        if (window.imApp.clearFriendUnread) {
            await window.imApp.clearFriendUnread(friend.id, { silent: true });
        }
        let pageId = `chat-interface-${friend.id}`;
        let page = document.getElementById(pageId);
        const isGroupChat = friend.type === 'group';
        const isNpcChat = friend.type === 'npc';
        const interfaceClassName = `active-chat-interface im-chat-interface ${isGroupChat ? 'im-chat-group' : (isNpcChat ? 'im-chat-npc' : 'im-chat-single')}`;
        const isSleeping = window.imApp.isCharacterSleeping(friend);
        const statusLabel = formatStatusLabel(isSleeping ? 'offline' : 'online', isSleeping);
        const statusColor = isSleeping ? '#8e8e93' : '#34c759';

        if (page) {
            page.className = interfaceClassName;
            page.style.setProperty('--im-chat-status-color', statusColor);
            touchChatPageCache(page);
            if (window.imApp.applyFriendCss) {
                window.imApp.applyFriendCss(friend);
            }
        }

        if (!page) {
            page = document.createElement('div');
            page.id = pageId;
            page.className = interfaceClassName;
            page.style.display = 'none';
            touchChatPageCache(page);
            page.style.setProperty('--im-chat-status-color', statusColor);
            
            let avatarHtml;
            if (isGroupChat) {
                avatarHtml = renderGroupHeaderAvatarInnerHtml(friend);
            } else {
                avatarHtml = friend.avatarUrl 
                    ? `<img src="${friend.avatarUrl}" style="display: block;">` 
                    : `<i class="fas fa-user"></i>`;
            }

            const headerStyle = isGroupChat
                ? `position: relative; top: 0; padding: 0 16px; align-items: center; justify-content: space-between; display: flex; pointer-events: none; width: 100%;`
                : `position: relative; top: 0; padding: 0 16px; align-items: center;`;
                
            let titleHtml = '';
            if (isGroupChat) {
                titleHtml = `<div class="im-chat-group-title-wrap" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 0; padding: 4px 16px; background: rgba(242, 242, 247, 0.85);   border-radius: 40px;  pointer-events: auto;">
                        <div class="ins-chat-name" style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${friend.nickname}</div>
                        <div class="ins-chat-sign" style="font-size: 11px; font-weight: 500; color: #8e8e93; margin-top: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 4px;">${formatGroupMemberCount(getGroupMemberCount(friend))}</div>
                   </div>`;
            } else if (friend.type === 'official') {
                titleHtml = `<div class="im-chat-avatar-wrap">
                        <div class="ins-chat-avatar" style="pointer-events: none;">
                            ${avatarHtml}
                        </div>
                   </div>
                   <div class="im-chat-title-wrap">
                        <div class="ins-chat-name">${friend.nickname}</div>
                        <div class="ins-chat-sign"><div class="im-chat-status-dot"></div><span>${statusLabel}</span></div>
                   </div>`;
            } else if (isNpcChat) {
                titleHtml = `<div class="im-chat-avatar-wrap">
                        <div class="ins-chat-avatar">
                            ${avatarHtml}
                        </div>
                   </div>
                   <div class="im-chat-title-wrap">
                        <div class="ins-chat-name">${friend.nickname}</div>
                   </div>`;
            } else {
                titleHtml = `<div class="im-chat-avatar-wrap">
                        <div class="ins-chat-avatar">
                            ${avatarHtml}
                        </div>
                   </div>
                   <div class="im-chat-title-wrap">
                        <div class="ins-chat-name">${friend.nickname}</div>
                        <div class="ins-chat-sign"><div class="im-chat-status-dot"></div><span>${statusLabel}</span></div>
                   </div>`;
            }

            // Make the right avatar a floating bubble as well
            let groupRightAvatarHtml = '';
            if (isGroupChat) {
                groupRightAvatarHtml = `<div class="group-header-right-avatar">
                        <div class="group-header-right-avatar-inner">${avatarHtml}</div>
                   </div>`;
            } else if (friend.type === 'official') {
                groupRightAvatarHtml = `<div class="chat-menu-btn im-chat-icon-btn"><i class="fas fa-bars"></i></div>`;
            } else if (isNpcChat) {
                groupRightAvatarHtml = `<div class="chat-menu-btn im-chat-icon-btn"><i class="fas fa-bars"></i></div>`;
            } else {
                groupRightAvatarHtml = `<div class="chat-call-btn im-chat-icon-btn"><i class="fas fa-phone-alt"></i></div>
                   <div class="chat-menu-btn im-chat-icon-btn"><i class="fas fa-bars"></i></div>`;
            }

            const backBtnHtml = isGroupChat
                ? `<div class="chat-back-btn" style="cursor: pointer; width: 36px; height: 36px; background: rgba(242, 242, 247, 0.85);   border-radius: 50%;  display: flex; justify-content: center; align-items: center; pointer-events: auto;">
                        <i class="fas fa-chevron-left" style="pointer-events: none; margin-right: 2px;"></i>
                   </div>`
                : `<div class="chat-back-btn im-chat-back-btn"><i class="fas fa-chevron-left" style="pointer-events: none;"></i></div>`;

            let topBarHtml = '';
            if (isGroupChat) {
                topBarHtml = `
                    <div class="chat-top-bar" style="${headerStyle}">
                        ${backBtnHtml}
                        <div style="display: flex; align-items: center; justify-content: center; flex: 1; pointer-events: none;" class="ins-chat-header" id="active-chat-header">
                            ${titleHtml}
                        </div>
                        <div id="active-chat-right-avatar-container">
                            ${groupRightAvatarHtml}
                        </div>
                    </div>
                `;
            } else {
                topBarHtml = `
                    <div class="chat-top-bar im-chat-top-bar">
                        <div class="im-chat-header-left">
                            ${backBtnHtml}
                            <div class="ins-chat-header im-chat-header-main">
                                ${titleHtml}
                            </div>
                        </div>
                        <div class="im-chat-actions">
                            ${groupRightAvatarHtml}
                        </div>
                    </div>
                `;
            }

            page.innerHTML = `
                <div class="chat-sticky-container ${isGroupChat ? 'is-group' : 'is-friend'}">
                    ${topBarHtml}
                    <div class="chat-batch-header" style="display:none; align-items:center; justify-content:space-between; min-height:46px; padding:0 14px; color:#111; pointer-events:auto;">
                        <button type="button" class="chat-cancel-batch-btn im-chat-cancel-batch-btn">取消</button>
                        <div class="chat-batch-selection-count" style="font-size:16px; font-weight:600;">已选择 0 条</div>
                        <div class="chat-batch-actions">
                            <button type="button" class="batch-forward-btn">转发</button>
                            <button type="button" class="batch-delete-btn">删除</button>
                        </div>
                    </div>
                </div>
                <div class="ins-chat-messages"></div>
                <div class="ins-chat-input-container">
                    <div class="im-together-listening-player" hidden>
                        <button class="im-together-listening-main" type="button" aria-label="打开正在播放">
                            <span class="im-together-listening-art"><i class="fas fa-music"></i></span>
                            <span class="im-together-listening-copy"><strong class="im-together-listening-title">未知歌曲</strong><small class="im-together-listening-artist">未知歌手</small></span>
                        </button>
                        <button class="im-together-listening-control" type="button" data-together-listening-control="toggle" aria-label="播放"><i class="fas fa-play"></i></button>
                        <button class="im-together-listening-control" type="button" data-together-listening-control="next" aria-label="下一首"><i class="fas fa-forward-step"></i></button>
                        <span class="im-together-listening-progress"></span>
                    </div>
                    <div class="reply-preview-container" style="display:none; padding: 10px 14px; background: #f2f2f7; border-radius: 18px; margin-bottom: 10px; font-size: 13px; color: #8e8e93; position: relative; margin-left: 10px; margin-right: 10px; max-width: fit-content; border: 1px solid #e5e5ea; ">
                        <div class="reply-preview-text" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 24px; color: #333; max-width: 250px;"></div>
                        <div class="reply-cancel-btn" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; border-radius: 50%; background: #ccc; color: #fff; display: flex; justify-content: center; align-items: center; cursor: pointer; font-size: 10px;"><i class="fas fa-times"></i></div>
                    </div>
                    <div class="ins-chat-input-wrapper">
                        ${isNpcChat ? '' : '<div class="ins-input-icon plus-btn"><i class="fas fa-plus"></i></div>'}
                        <input type="text" placeholder="imessage..." class="ins-message-input chat-input" inputmode="text" enterkeyhint="send" autocomplete="off">
                        <div class="im-chat-input-actions">
                            <div class="send-btn-icon send-btn"><i class="fas fa-paper-plane"></i></div>
                            <div class="send-btn-icon mic-btn"><i class="fas fa-arrow-down"></i></div>
                        </div>
                    </div>
                    ${isGroupChat ? `
                    <div class="im-left-group-bar" style="display:none; align-items:center; justify-content:space-between; gap:10px; margin:0 10px; padding:8px 10px; border-radius:22px; background:#f2f2f7; border:1px solid #e5e5ea;">
                        <div class="im-left-group-label" style="font-size:14px; color:#8e8e93; font-weight:600; white-space:nowrap;">${friend.groupObserverMode ? '旁观群聊' : '已退出该群'}</div>
                        <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                            <button type="button" class="im-left-group-rejoin-btn" style="display:${friend.groupObserverMode ? 'none' : ''}; border:0; border-radius:18px; background:#007aff; color:#fff; height:34px; padding:0 12px; font-size:14px; font-weight:700; cursor:pointer; white-space:nowrap;">重新进入</button>
                            <button type="button" class="im-left-group-ai-btn" aria-label="推进剧情" title="推进剧情" style="border:0; border-radius:50%; background:#1c1c1e; color:#fff; width:34px; height:34px; padding:0; display:flex; align-items:center; justify-content:center; font-size:14px; cursor:pointer; flex-shrink:0;"><i class="fas fa-arrow-down"></i></button>
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;

            if(chatsContent) chatsContent.appendChild(page);
            if (window.imApp.applyFriendCss) {
                window.imApp.applyFriendCss(friend);
            }
            if (window.imApp.applyGlobalChatCss) {
                window.imApp.applyGlobalChatCss(window.u2ThemeState || {});
            }

            const backBtn = page.querySelector('.chat-back-btn');
            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    if (profilePanelOverlay) {
                        const latestFriend = window.imApp.getFriendById(friend) || friend;
                        window.imChat.hideProfilePanel(latestFriend, profilePanelOverlay);
                    }
                    if (window.imData.batchSelectMode) imChat.exitBatchSelectMode(friend, page);
                    window.imData.currentActiveFriend = null;
                    window.imApp?.setActiveThemeSurface?.('chats');
                    window.imChat.updateChatsView();
                });
            }

            const cancelBatchBtn = page.querySelector('.chat-cancel-batch-btn');
            const menuBtn = page.querySelector('.chat-menu-btn');
            const callBtn = page.querySelector('.chat-call-btn');
            const batchForwardBtn = page.querySelector('.batch-forward-btn');
            const batchDeleteBtn = page.querySelector('.batch-delete-btn');

            function exitBatchSelectMode() {
                imChat.exitBatchSelectMode(friend, page);
            }

            window.imChat.ensureTransferDetailOverlayForExistingPage(page, friend);
            window.imChat.ensureRedPacketDetailOverlayForExistingPage(page, friend);

            if (callBtn) {
                callBtn.addEventListener('click', () => {
                    let callOverlay = document.getElementById('custom-call-overlay');
                    if (!callOverlay) {
                        callOverlay = document.createElement('div');
                        callOverlay.id = 'custom-call-overlay';
                        callOverlay.style.position = 'fixed';
                        callOverlay.style.inset = '0';
                        callOverlay.style.backgroundColor = 'rgba(0,0,0,0.4)';
                        callOverlay.style.zIndex = '10000';
                        callOverlay.style.display = 'flex';
                        callOverlay.style.alignItems = 'flex-end';
                        callOverlay.style.justifyContent = 'center';
                        
                        const sheet = document.createElement('div');
                        sheet.style.width = '100%';
                        sheet.style.backgroundColor = 'transparent';
                        sheet.style.padding = '10px';
                        sheet.style.boxSizing = 'border-box';
                        sheet.style.paddingBottom = 'max(10px, env(safe-area-inset-bottom))';
                        
                        const menuGroup = document.createElement('div');
                        menuGroup.style.backgroundColor = '#fff';
                        menuGroup.style.borderRadius = '14px';
                        menuGroup.style.overflow = 'hidden';
                        
                        const videoBtn = document.createElement('div');
                        videoBtn.innerText = '视频通话';
                        videoBtn.style.padding = '18px 0';
                        videoBtn.style.textAlign = 'center';
                        videoBtn.style.fontSize = '20px';
                        videoBtn.style.color = '#007aff';
                        videoBtn.style.borderBottom = '1px solid #e5e5ea';
                        videoBtn.style.cursor = 'pointer';
                        videoBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            callOverlay.style.display = 'none';
                            if(window.showToast) window.showToast('视频通话功能开发中...');
                        });
                        
                        const voiceBtn = document.createElement('div');
                        voiceBtn.innerText = '语音通话';
                        voiceBtn.style.padding = '18px 0';
                        voiceBtn.style.textAlign = 'center';
                        voiceBtn.style.fontSize = '20px';
                        voiceBtn.style.color = '#007aff';
                        voiceBtn.style.cursor = 'pointer';
                        voiceBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            callOverlay.style.display = 'none';
                            if (window.imChat && window.imChat.openVoiceCall) {
                                window.imChat.openVoiceCall(friend);
                            } else {
                                if(window.showToast) window.showToast('语音通话准备中...');
                            }
                        });
                        
                        menuGroup.appendChild(videoBtn);
                        menuGroup.appendChild(voiceBtn);
                        sheet.appendChild(menuGroup);
                        callOverlay.appendChild(sheet);
                        
                        document.body.appendChild(callOverlay);
                        
                        callOverlay.addEventListener('click', (e) => {
                            if (e.target === callOverlay) {
                                callOverlay.style.display = 'none';
                            }
                        });
                    }
                    callOverlay.style.display = 'flex';
                });
            }

            if (cancelBatchBtn) {
                cancelBatchBtn.addEventListener('click', () => {
                    exitBatchSelectMode();
                });
            }

            if (batchForwardBtn) {
                batchForwardBtn.addEventListener('click', () => {
                    if (String(window.imData.batchSelectionFriendId || '') !== String(friend.id)) return;
                    const liveFriend = window.imApp.getFriendById ? (window.imApp.getFriendById(friend.id) || friend) : friend;
                    const descriptors = Array.from(ensureBatchSelectionMap().values());
                    const messages = window.imApp.findForwardMessagesByDescriptors
                        ? window.imApp.findForwardMessagesByDescriptors(liveFriend, descriptors)
                        : [];
                    window.imChat.openChatRecordForwardPicker?.(liveFriend, messages, {
                        onSuccess: () => exitBatchSelectMode()
                    });
                });
            }

            if (batchDeleteBtn) {
                batchDeleteBtn.addEventListener('click', () => {
                    if (String(window.imData.batchSelectionFriendId || '') !== String(friend.id)) return;
                    const selection = ensureBatchSelectionMap();
                    const selectedDescriptors = Array.from(selection.values())
                        .map(descriptor => ({ id: descriptor.id || null, timestamp: descriptor.timestamp || null }))
                        .filter(descriptor => descriptor.id || descriptor.timestamp);
                    if (selectedDescriptors.length === 0) {
                        if(window.showToast) window.showToast('请选择要删除的消息');
                        return;
                    }
                    if (window.showCustomModal) {
                        window.showCustomModal({
                            title: '删除消息',
                            message: `确定要删除选中的 ${selectedDescriptors.length} 条消息吗？`,
                            confirmText: '删除',
                            cancelText: '取消',
                            isDestructive: true,
                            confirmTone: 'dark',
                            onConfirm: async () => {
                                const saved = window.imApp.removeFriendMessages
                                    ? await window.imApp.removeFriendMessages(
                                        friend.id,
                                        selectedDescriptors,
                                        { silent: true }
                                    )
                                    : (window.imApp.commitFriendChange
                                        ? await window.imApp.commitFriendChange(friend.id, (targetFriend) => {
                                            if (!targetFriend || !Array.isArray(targetFriend.messages)) return;
                                            targetFriend.messages = targetFriend.messages.filter((m) => !selectedDescriptors.some((descriptor) => {
                                                if (!m) return true;
                                                if (descriptor.id && String(m.id) === String(descriptor.id)) return true;
                                                if (descriptor.timestamp && String(m.timestamp) === String(descriptor.timestamp)) return true;
                                                return false;
                                            }));
                                        }, { silent: true })
                                        : false);

                                if (!saved) {
                                    if (window.showToast) window.showToast('删除失败，消息已恢复');
                                    const failedContainer = page.querySelector('.ins-chat-messages');
                                    if (failedContainer) {
                                        failedContainer.innerHTML = '';
                                        const failedFriend = window.imApp.getFriendById ? (window.imApp.getFriendById(friend.id) || friend) : friend;
                                        window.imChat.renderChatHistory(failedFriend, failedContainer);
                                        window.imChat.scrollToBottom(failedContainer);
                                        imChat.syncBatchSelectionUi(failedFriend, page);
                                    }
                                    return;
                                }

                                const container = page.querySelector('.ins-chat-messages');
                                if(container) {
                                    container.innerHTML = '';
                                    const latestFriend = window.imApp.getFriendById ? (window.imApp.getFriendById(friend.id) || friend) : friend;
                                    window.imChat.renderChatHistory(latestFriend, container);
                                    window.imChat.scrollToBottom(container);
                                }
                                exitBatchSelectMode();
                            }
                        });
                    }
                });
            }

            const msgContainerProxy = page.querySelector('.ins-chat-messages');
            if (msgContainerProxy) {
                msgContainerProxy.addEventListener('click', (e) => {
                    const row = e.target.closest('.chat-row');

                    if (window.imData.batchSelectMode) {
                        e.stopPropagation();
                        e.preventDefault();
                        if (row) imChat.toggleBatchRowSelection(friend, row, page);
                        return;
                    }

                }, true);
            }


            const replyCancelBtn = page.querySelector('.reply-cancel-btn');
            if (replyCancelBtn) {
                replyCancelBtn.addEventListener('click', () => {
                    window.imData.currentReplyText = null;
                    window.imData.currentReplyMessageId = null;
                    const preview = page.querySelector('.reply-preview-container');
                    if(preview) preview.style.display = 'none';
                });
            }

            let profilePanelOverlay = page.querySelector('.chat-profile-panel-overlay');
            if (!profilePanelOverlay) {
                profilePanelOverlay = document.createElement('div');
                profilePanelOverlay.className = 'chat-profile-panel-overlay';
                profilePanelOverlay.style.display = 'none';

                page.appendChild(profilePanelOverlay);

                profilePanelOverlay.addEventListener('click', (e) => {
                    if (e.target === profilePanelOverlay) {
                        const latestFriend = window.imApp.getFriendById(friend) || friend;
                        window.imChat.hideProfilePanel(latestFriend, profilePanelOverlay);
                    }
                });
            }

            const avatarContainer = page.querySelector('.ins-chat-avatar');
            const singleChatHeader = page.querySelector('.ins-chat-header');

            function handleSingleChatProfileTrigger(e) {
                if (friend.type === 'official' || friend.type === 'group' || friend.type === 'npc') return;
                e.stopPropagation();
                const latestFriend = window.imApp.getFriendById(friend) || friend;
                window.imChat.toggleProfilePanel(latestFriend, profilePanelOverlay);
            }

            if (avatarContainer) {
                if (friend.type === 'official' || friend.type === 'npc') {
                    avatarContainer.style.cursor = 'default';
                } else {
                    avatarContainer.style.cursor = 'pointer';
                    avatarContainer.addEventListener('click', handleSingleChatProfileTrigger);
                }
            }

            if (singleChatHeader && friend.type !== 'group') {
                if (friend.type === 'official' || friend.type === 'npc') {
                    singleChatHeader.style.cursor = 'default';
                } else {
                    singleChatHeader.style.cursor = 'pointer';
                    singleChatHeader.addEventListener('click', handleSingleChatProfileTrigger);
                }
            }

            page.addEventListener('click', (e) => {
                if (
                    profilePanelOverlay &&
                    profilePanelOverlay.classList.contains('active') &&
                    !e.target.closest('.chat-profile-panel-card') &&
                    !e.target.closest('.ins-chat-avatar') &&
                    !e.target.closest('.ins-chat-header')
                ) {
                    const latestFriend = window.imApp.getFriendById(friend) || friend;
                    window.imChat.hideProfilePanel(latestFriend, profilePanelOverlay);
                }
            });

            if (friend.type === 'group') {
                const rightAvatar = page.querySelector('.group-header-right-avatar');
                if (rightAvatar) {
                    rightAvatar.addEventListener('click', () => {
                        if (window.imApp.openGroupDetails) {
                            window.imApp.openGroupDetails(friend);
                        }
                    });
                }
                const header = page.querySelector('.ins-chat-header');
                if (header) {
                    header.addEventListener('click', () => {
                        if (window.imApp.openGroupDetails) {
                            window.imApp.openGroupDetails(friend);
                        }
                    });
                }

                // Event delegation for clicking on member avatars in group chat to show profile card
                const messagesArea = page.querySelector('.ins-chat-messages');
                if (messagesArea) {
                    // Start dragging detection for keyboard dismissal
                    let isDragging = false;
                    let startY = 0;
                    
                    messagesArea.addEventListener('touchstart', (e) => {
                        isDragging = false;
                        startY = e.touches[0].clientY;
                    }, { passive: true });
                    
                    messagesArea.addEventListener('touchmove', (e) => {
                        if (Math.abs(e.touches[0].clientY - startY) > 10) {
                            isDragging = true;
                        }
                    }, { passive: true });
                    
                    messagesArea.addEventListener('touchend', (e) => {
                        if (isDragging) {
                            // User is scrolling, dismiss keyboard
                            const input = page.querySelector('.chat-input');
                            if (input && document.activeElement === input) {
                                input.blur();
                            }
                        }
                        isDragging = false;
                    }, { passive: true });

                    messagesArea.addEventListener('click', (e) => {
                        // User clicked somewhere in the chat messages area, dismiss keyboard
                        const input = page.querySelector('.chat-input');
                        if (input && document.activeElement === input) {
                            input.blur();
                        }
                        const avatarSlot = e.target.closest('.group-ai-avatar-slot');
                        if (avatarSlot) {
                            const row = avatarSlot.closest('.ai-row');
                            if (row) {
                                const speakerName = row.getAttribute('data-speaker');
                                const speakerMemberId = row.getAttribute('data-speaker-member-id');
                                const thought = row.getAttribute('data-thought');
                                if (speakerName || speakerMemberId) {
                                    const latestGroup = window.imApp.getFriendById
                                        ? (window.imApp.getFriendById(friend.id) || friend)
                                        : friend;
                                    const speakerInfo = window.imChat.normalizeGroupSpeaker
                                        ? window.imChat.normalizeGroupSpeaker(latestGroup, speakerName, speakerMemberId)
                                        : null;
                                    if (speakerInfo && window.imChat.showGroupMemberProfileCard) {
                                        window.imChat.showGroupMemberProfileCard(speakerInfo, page, avatarSlot, latestGroup, thought);
                                    }
                                }
                            }
                        }
                    });
                }
            }
            
            // Re-bind menuBtn properly for chat settings (whether single or group if needed, but per request it's mainly single chat setting missing)
            if (menuBtn && friend.type !== 'group') {
                menuBtn.addEventListener('click', () => {
                    if (friend.type === 'official') {
                        const officialSettingsSheet = document.getElementById('official-chat-settings-sheet');
                        if (officialSettingsSheet) {
                            if (window.openView) {
                                window.openView(officialSettingsSheet);
                            } else {
                                officialSettingsSheet.style.display = 'flex';
                                setTimeout(() => {
                                    officialSettingsSheet.style.opacity = '1';
                                    const bottomSheet = officialSettingsSheet.querySelector('.bottom-sheet');
                                    if(bottomSheet) bottomSheet.style.transform = 'translateY(0)';
                                }, 10);
                            }
                            
                            // add empty click listener so clicking outside closes it
                            officialSettingsSheet.onclick = (e) => {
                                if (e.target === officialSettingsSheet) {
                                    if (window.closeView) window.closeView(officialSettingsSheet);
                                    else officialSettingsSheet.style.display = 'none';
                                }
                            };
                        }
                        return;
                    }

                    if (window.imApp.openChatSettingsForFriend) {
                        window.imApp.openChatSettingsForFriend(friend);
                    }
                });
            }

            const input = page.querySelector('.chat-input');
            const sendBtn = page.querySelector('.send-btn');
            const micBtn = page.querySelector('.mic-btn');
            const plusBtn = page.querySelector('.plus-btn');
            const msgContainer = page.querySelector('.ins-chat-messages');
            const togetherPlayer = page.querySelector('.im-together-listening-player');

            if (togetherPlayer) {
                togetherPlayer.querySelector('.im-together-listening-main')?.addEventListener('click', () => {
                    window.libraryApp?.openTogetherListeningPlayer?.(friend.id);
                });
                togetherPlayer.querySelectorAll('[data-together-listening-control]').forEach((button) => {
                    button.addEventListener('click', () => {
                        const action = button.dataset.togetherListeningControl;
                        window.libraryApp?.controlTogetherListening?.(friend.id, { action });
                    });
                });
                renderTogetherListeningPlayer(friend);
            }

            const onPlusClick = (e) => {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                if (input) input.blur();
                if (window.imChat.openAttachmentSheet) {
                    window.imChat.openAttachmentSheet();
                }
            };

            if (plusBtn) {
                plusBtn.addEventListener('click', onPlusClick);
            }

            if (input) {
                if (isAndroid) {
                    input.addEventListener('pointerdown', captureAndroidRestingViewport, { passive: true });
                    input.addEventListener('touchstart', captureAndroidRestingViewport, { passive: true });
                }

                input.addEventListener('focus', () => {
                    captureAndroidRestingViewport();
                    page.classList.add('keyboard-open');
                    const attachmentSheet = document.getElementById('chat-attachment-sheet');
                    if (attachmentSheet) {
                        const overlay = attachmentSheet.querySelector('.sheet-overlay');
                        const content = attachmentSheet.querySelector('.sheet-content');
                        if (overlay) overlay.style.opacity = '0';
                        if (content) content.style.transform = 'translateY(100%)';
                        attachmentSheet.style.display = 'none';
                    }

                    setTimeout(() => {
                        if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
                    }, 100);
                });

                input.addEventListener('blur', () => {
                    page.classList.remove('keyboard-open');
                    if (isAndroid) {
                        if (window.visualViewport) restoreAndroidChatViewport(page, msgContainer);
                        else scheduleAndroidChatViewportRestore(page, msgContainer);
                    }
                });
            }

            // @ mention logic variables
            let mentionList = null;
            let currentMentionQuery = '';
            let mentionStartIndex = -1;

            function renderMentionList(query, inputEl) {
                if (friend.type !== 'group' || !friend.members) return;
                
                const listContainer = page.querySelector('.at-mention-list');
                if (!listContainer) return;

                const members = window.imChat.getGroupMemberFriends(friend);
                const allOptions = [
                    { id: 'all', nickname: '全体成员', isAll: true },
                    ...members
                ];

                const filtered = allOptions.filter(m => 
                    m.isAll || (m.nickname && m.nickname.toLowerCase().includes(query.toLowerCase()))
                );

                if (filtered.length === 0) {
                    listContainer.style.display = 'none';
                    return;
                }

                listContainer.innerHTML = '';
                filtered.forEach(m => {
                    const item = document.createElement('div');
                    item.className = 'at-mention-item';
                    
                    let avatarHtml = '';
                    if (m.isAll) {
                        avatarHtml = `<i class="fas fa-users" style="color: #007aff;"></i>`;
                    } else if (m.avatarUrl) {
                        avatarHtml = `<img src="${m.avatarUrl}">`;
                    } else {
                        avatarHtml = `<i class="fas fa-user"></i>`;
                    }

                    item.innerHTML = `
                        <div class="at-mention-avatar">${avatarHtml}</div>
                        <div class="at-mention-name">${m.isAll ? m.nickname : m.nickname}</div>
                    `;

                    item.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const text = inputEl.value;
                        const before = text.substring(0, mentionStartIndex);
                        const after = text.substring(inputEl.selectionStart);
                        const mentionText = m.isAll ? '@全体成员 ' : `@${m.nickname} `;
                        
                        inputEl.value = before + mentionText + after;
                        const newCursorPos = before.length + mentionText.length;
                        inputEl.setSelectionRange(newCursorPos, newCursorPos);
                        inputEl.focus();
                        
                        listContainer.style.display = 'none';
                        mentionStartIndex = -1;
                        currentMentionQuery = '';
                    });

                    listContainer.appendChild(item);
                });

                listContainer.style.display = 'flex';
            }

            input.addEventListener('input', (e) => {
                if (friend.type !== 'group') return;
                
                const text = input.value;
                const cursorPos = input.selectionStart;
                
                // Search backwards for the @ symbol
                let foundAt = -1;
                for (let i = cursorPos - 1; i >= 0; i--) {
                    if (text[i] === '@') {
                        foundAt = i;
                        break;
                    }
                    if (text[i] === ' ' || text[i] === '\n') {
                        break; // Stop if we hit a space before @
                    }
                }

                if (foundAt !== -1) {
                    mentionStartIndex = foundAt;
                    currentMentionQuery = text.substring(foundAt + 1, cursorPos);
                    
                    let listContainer = page.querySelector('.at-mention-list');
                    if (!listContainer) {
                        listContainer = document.createElement('div');
                        listContainer.className = 'at-mention-list';
                        const inputWrapper = page.querySelector('.ins-chat-input-wrapper');
                        inputWrapper.parentNode.insertBefore(listContainer, inputWrapper);
                    }
                    
                    renderMentionList(currentMentionQuery, input);
                } else {
                    mentionStartIndex = -1;
                    currentMentionQuery = '';
                    const listContainer = page.querySelector('.at-mention-list');
                    if (listContainer) listContainer.style.display = 'none';
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.isComposing || e.keyCode === 229) return;
                if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;

                e.preventDefault();
                const currentFriend = window.imData.currentActiveFriend || friend;
                window.imChat.handleSend(currentFriend, input, msgContainer);
                const listContainer = page.querySelector('.at-mention-list');
                if (listContainer) listContainer.style.display = 'none';
            });

            let lastSendTouchAt = 0;

            const onSendClick = (e, options = {}) => {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                const currentFriend = window.imData.currentActiveFriend || friend;
                window.imChat.handleSend(currentFriend, input, msgContainer);
                const listContainer = page.querySelector('.at-mention-list');
                if (listContainer) listContainer.style.display = 'none';
                if (options.refocus && input) {
                    setTimeout(() => {
                        input.focus();
                    }, 50);
                }
            };

            sendBtn.addEventListener('click', (e) => {
                if (Date.now() - lastSendTouchAt < 500) {
                    e.preventDefault();
                    return;
                }
                onSendClick(e);
            });
            sendBtn.addEventListener('touchstart', (e) => {
                lastSendTouchAt = Date.now();
                onSendClick(e, { refocus: true });
            }, { passive: false });

            const onMicClick = (e) => {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                console.log('Mic button clicked!');
                const currentFriend = window.imData.currentActiveFriend || friend;
                if (window.imChat && window.imChat.handleAiReply) {
                    window.imChat.handleAiReply(currentFriend, msgContainer, micBtn);
                } else {
                    console.error('window.imChat.handleAiReply is not defined');
                    if (window.showToast) window.showToast('无法调用 AI 接口');
                }
            };

            micBtn.addEventListener('mousedown', onMicClick);
            micBtn.addEventListener('touchstart', onMicClick, { passive: false });

            window.imChat.renderChatHistory(friend, msgContainer, { resetWindow: true });
        } else {
             // 如果页面已存在，我们需要确保已有页面的麦克风按钮能够正常触发，
             // 但原逻辑只有在 !page 也就是创建页面时绑定了 click，
             // 所以如果是复用的页面，原先的闭包引用的 friend 可能旧了，或者节点变了。
             // 不过通常这种 SPA 是在元素上保留原本监听器的，所以先看看原先的逻辑。
             window.imChat.ensureTransferDetailOverlayForExistingPage(page, friend);
             window.imChat.ensureRedPacketDetailOverlayForExistingPage(page, friend);
              if (isGroupChat && window.imChat.refreshGroupHeaderAvatar) {
                  window.imChat.refreshGroupHeaderAvatar(friend);
              }
              const msgContainer = page.querySelector('.ins-chat-messages');
              const canReuseHistory = window.imChat.isChatHistoryRenderCurrent?.(friend, msgContainer);
              if (!canReuseHistory) {
                  msgContainer.innerHTML = '';
                  window.imChat.renderChatHistory(friend, msgContainer, { resetWindow: true });
              }

             // 确保在已存在页面下，麦克风按钮也能绑定点击事件，或者原先的事件中的闭包上下文能够更新
             // 更好的做法是将最新 friend 更新给全局上下文。上面已经做了:
             // window.imData.currentActiveFriend = activeFriend;
             // 所以原绑定的闭包会读到最新的 window.imData.currentActiveFriend，这是有效的。
        }

        if(window.imApp.applyFriendBg) window.imApp.applyFriendBg(friend);
        if(window.imApp.initTimestampSetting) window.imApp.initTimestampSetting(friend);
        
        if(page) {
            page.classList.toggle('show-timestamps', !!friend.showTimestamp);
            page.classList.toggle('timestamp-outside', !!friend.showTimestamp && friend.timestampPosition === 'outside');
            
            if(friend.isPinned) page.classList.add('pinned-chat');
            else page.classList.remove('pinned-chat');
            
            // Re-apply status bar css
            if(window.imApp.applyFriendStatusBarCss) window.imApp.applyFriendStatusBarCss(friend);
            if (isGroupChat && window.imChat.syncGroupExitState) {
                window.imChat.syncGroupExitState(friend, page);
            }
        }

        if (navChatsBtn) {
            if (navChatsBtn.classList.contains('active')) window.imChat.updateChatsView();
            else navChatsBtn.click();
        }
        pruneHiddenChatPages({ keepFriendId: friend.id });
    }

    function measureContextMenuSafeInset(screenEl, propertyName) {
        const probe = document.createElement('div');
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = `position:absolute; visibility:hidden; pointer-events:none; width:0; height:var(${propertyName}, 0px);`;
        screenEl.appendChild(probe);
        const value = Math.max(0, probe.getBoundingClientRect().height || 0);
        probe.remove();
        return value;
    }

    function fitContextMenuToViewport() {
        const msgContextMenu = document.getElementById('msg-context-menu');
        const bubbleClone = document.getElementById('msg-context-bubble-clone');
        const reactionBar = document.getElementById('msg-reaction-bar');
        const mainActions = document.getElementById('msg-context-actions');
        const moreActions = document.getElementById('msg-context-more-actions');
        const screenEl = document.getElementById('app') || document.body;
        if (!msgContextMenu || !bubbleClone || !screenEl) return;

        const screenRect = screenEl.getBoundingClientRect();
        const visualViewport = window.visualViewport;
        const visibleViewportTop = visualViewport ? visualViewport.offsetTop : 0;
        const visibleViewportBottom = visualViewport
            ? visualViewport.offsetTop + visualViewport.height
            : document.documentElement.clientHeight;
        const localViewportTop = Math.max(0, visibleViewportTop - screenRect.top);
        const localViewportBottom = Math.min(screenRect.height, visibleViewportBottom - screenRect.top);
        const safeInsetTop = measureContextMenuSafeInset(screenEl, '--safe-top');
        const safeInsetBottom = measureContextMenuSafeInset(screenEl, '--safe-bottom');
        const safeTop = Math.max(localViewportTop + 16 + safeInsetTop, 60);
        const safeBottom = Math.max(safeTop + 120, localViewportBottom - Math.max(20, safeInsetBottom + 12));
        const availableHeight = Math.max(120, safeBottom - safeTop);
        const visibleActions = moreActions && getComputedStyle(moreActions).display !== 'none' ? moreActions : mainActions;
        const gap = parseFloat(getComputedStyle(msgContextMenu).gap) || 6;
        const reactionHeight = reactionBar?.getBoundingClientRect().height || 0;
        const actionsHeight = visibleActions?.getBoundingClientRect().height || 0;
        const chromeHeight = reactionHeight + actionsHeight + gap * 2;
        const bubbleHeightLimit = Math.max(64, availableHeight - chromeHeight);

        bubbleClone.style.maxHeight = `${bubbleHeightLimit}px`;
        bubbleClone.style.overflowY = 'auto';
        bubbleClone.style.overscrollBehavior = 'contain';
        bubbleClone.style.flexShrink = '1';
        if (reactionBar) reactionBar.style.flexShrink = '0';
        if (mainActions) mainActions.style.flexShrink = '0';
        if (moreActions) moreActions.style.flexShrink = '0';
        msgContextMenu.style.maxHeight = `${availableHeight}px`;
        msgContextMenu.style.overflowY = 'auto';
        msgContextMenu.style.overscrollBehavior = 'contain';

        const activeBubble = window.imData.currentActiveRow?.querySelector('.chat-bubble, .sticker-message-wrap');
        const activeBubbleRect = activeBubble?.getBoundingClientRect();
        const desiredCenter = activeBubbleRect
            ? activeBubbleRect.top + activeBubbleRect.height / 2 - screenRect.top
            : safeTop + availableHeight / 2;
        const measuredHeight = Math.min(msgContextMenu.scrollHeight || msgContextMenu.getBoundingClientRect().height, availableHeight);
        const nextTop = Math.min(
            Math.max(desiredCenter - measuredHeight / 2, safeTop),
            Math.max(safeTop, safeBottom - measuredHeight)
        );
        msgContextMenu.style.top = `${nextTop}px`;
    }

 function showContextMenu(row, e) {
        const msgContextOverlay = document.getElementById('msg-context-overlay');
        const msgContextMenu = document.getElementById('msg-context-menu');
        
        if (!msgContextOverlay || !msgContextMenu) return;
        
        if (navigator.vibrate) navigator.vibrate(50);
        
        window.imData.currentActiveRow = row;
        row.classList.add('message-active');
        
        const bubble = row.querySelector('.chat-bubble') || row.querySelector('.sticker-message-wrap');
        if (!bubble) return;
        
        const screenEl = document.getElementById('app') || document.body;
        const screenRect = screenEl.getBoundingClientRect();
        const sourceBubbleRect = bubble.getBoundingClientRect();
        const isUserRow = row.classList.contains('user-row');
        const isCardBubble = bubble.classList.contains('im-card-bubble')
            || !!bubble.querySelector('.chat-link-card, .chat-fake-link-card, .pay-transfer-card, .voice-call-record-card');
        
        // Clone bubble into context menu
        const bubbleClone = document.getElementById('msg-context-bubble-clone');
        if (bubbleClone) {
            bubbleClone.innerHTML = '';
            const activeFriend = window.imData.currentActiveFriend;
            if (activeFriend?.id != null) {
                bubbleClone.setAttribute('data-current-friend-id', String(activeFriend.id));
            } else {
                bubbleClone.removeAttribute('data-current-friend-id');
            }
            const clonedRow = document.createElement('div');
            clonedRow.className = [
                'chat-row',
                'msg-context-row-clone',
                isUserRow ? 'user-row' : 'ai-row',
                row.classList.contains('has-prev') ? 'has-prev' : '',
                row.classList.contains('has-next') ? 'has-next' : ''
            ].filter(Boolean).join(' ');
            const clonedBubble = bubble.cloneNode(true);
            clonedBubble.style.margin = '0';
            if (isCardBubble) {
                const cloneWidth = Math.max(180, Math.min(sourceBubbleRect.width || 260, 270, screenRect.width - 48));
                clonedBubble.classList.add('msg-context-card-clone');
                clonedBubble.style.width = cloneWidth + 'px';
                clonedBubble.style.maxWidth = cloneWidth + 'px';
                clonedBubble.style.flex = '0 0 auto';
                clonedBubble.querySelectorAll('.chat-link-card, .chat-fake-link-card').forEach(card => {
                    card.style.width = '100%';
                    card.style.maxWidth = '100%';
                    card.style.boxSizing = 'border-box';
                });
            } else {
                clonedBubble.style.maxWidth = '100%';
            }
            clonedRow.appendChild(clonedBubble);
            bubbleClone.appendChild(clonedRow);
        }
        
        // Reset more actions
        const moreActions = document.getElementById('msg-context-more-actions');
        const mainActions = document.getElementById('msg-context-actions');
        if (moreActions) moreActions.style.display = 'none';
        if (mainActions) mainActions.style.display = 'flex';

        const recallAction = msgContextMenu.querySelector('[data-action="recall"]');
        const speakAction = msgContextMenu.querySelector('[data-action="speak"]');
        const activeFriend = window.imData.currentActiveFriend;
        const messageId = row.getAttribute('data-message-id');
        const messageTimestamp = row.getAttribute('data-timestamp');
        const targetMessage = activeFriend && Array.isArray(activeFriend.messages)
            ? activeFriend.messages.find(message => {
                if (!message) return false;
                if (messageId && String(message.id) === String(messageId)) return true;
                return messageTimestamp && String(message.timestamp) === String(messageTimestamp);
            })
            : null;
        if (recallAction) {
            const canRecall = row.classList.contains('user-row')
                && !!window.imApp?.isRecallableUserMessage?.(targetMessage);
            recallAction.style.display = canRecall ? 'flex' : 'none';
        }
        if (speakAction) {
            const groupTtsMessage = targetMessage || {
                role: row.classList.contains('user-row') ? 'user' : 'assistant',
                speaker: row.getAttribute('data-speaker') || '',
                speakerMemberId: row.getAttribute('data-speaker-member-id') || null,
                senderAvatarUrl: row.getAttribute('data-sender-avatar-url') || ''
            };
            const canSpeakGroupMessage = activeFriend?.type === 'group'
                && !!window.u2Tts?.canSpeakMessage?.(activeFriend, groupTtsMessage);
            speakAction.style.display = activeFriend?.type === 'group'
                ? (canSpeakGroupMessage ? 'flex' : 'none')
                : 'flex';
        }
        
        msgContextOverlay.style.display = 'flex';
        msgContextOverlay.style.opacity = '1';
        
        // Position the menu centered or aligned
        const menuWidth = Math.min(screenRect.width - 32, 300);
        msgContextMenu.style.width = menuWidth + 'px';
        
        if (isUserRow) {
            msgContextMenu.style.alignItems = 'flex-end';
            msgContextMenu.style.right = '16px';
            msgContextMenu.style.left = 'auto';
        } else {
            msgContextMenu.style.alignItems = 'flex-start';
            msgContextMenu.style.left = '16px';
            msgContextMenu.style.right = 'auto';
        }
        
        msgContextMenu.style.transformOrigin = isUserRow ? 'top right' : 'top left';
        
        requestAnimationFrame(() => {
            fitContextMenuToViewport();
            msgContextMenu.style.opacity = '1';
            msgContextMenu.style.transform = 'scale(1)';
        });
    }

function closeContextMenu() {
        const msgContextOverlay = document.getElementById('msg-context-overlay');
        const msgContextMenu = document.getElementById('msg-context-menu');
        
        if (!msgContextOverlay || !msgContextMenu) return;
        msgContextMenu.style.opacity = '0';
        msgContextMenu.style.transform = 'scale(0.85)';
        
        if (window.imData.currentActiveRow) {
            window.imData.currentActiveRow.classList.remove('message-active');
            window.imData.currentActiveRow = null;
        }
        
        setTimeout(() => {
            msgContextOverlay.style.display = 'none';
            // Clean up cloned bubble
            const bubbleClone = document.getElementById('msg-context-bubble-clone');
            if (bubbleClone) {
                bubbleClone.innerHTML = '';
                bubbleClone.removeAttribute('data-current-friend-id');
            }
        }, 250);
    }

    function showGroupMemberProfileCard(speakerInfo, page, anchorElement, group, historicalThought = null) {
        if (!page) return;
        const latestGroup = group && window.imApp.getFriendById
            ? (window.imApp.getFriendById(group.id || group) || group)
            : group;
        const memberProfileKey = String(speakerInfo?.id ?? speakerInfo?.memberId ?? '');
        let overlay = document.getElementById('global-gmp-overlay');
        if (!overlay) {
            // Mount overlay to body so it covers everything and isn't clipped
            overlay = document.createElement('div');
            overlay.id = 'global-gmp-overlay';
            overlay.className = 'group-member-profile-overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(0,0,0,0.4)';
            overlay.style.zIndex = '9999';
            overlay.style.display = 'none';
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.3s ease';

            const card = document.createElement('div');
            card.className = 'group-member-profile-card';
            
            overlay.appendChild(card);
            document.body.appendChild(overlay);

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.style.opacity = '0';
                    card.classList.remove('active');
                    setTimeout(() => overlay.style.display = 'none', 300);
                }
            });
        }

        const card = overlay.querySelector('.group-member-profile-card');
        const avatarUrl = speakerInfo.avatarUrl || 'https://picsum.photos/seed/char/100/100';
        const name = speakerInfo.nickname || '群成员';
        const signature = speakerInfo.signature || '这个人很懒，什么都没写';
        const title = speakerInfo.groupTitle || '';
        
        let groupProfile = {};
        if (latestGroup && latestGroup.memberProfiles) {
            groupProfile = latestGroup.memberProfiles[memberProfileKey]
                || latestGroup.memberProfiles[speakerInfo.id]
                || {};
        }
        
        const hasHistoricalThought = typeof historicalThought === 'string' && historicalThought.trim();
        const thought = hasHistoricalThought ? historicalThought.trim() : (groupProfile.thought || '暂无心声');
        
        // For group members, we check if they have individual sleeping schedules if we can retrieve them
        let isSleeping = false;
        const members = window.imChat.getGroupMemberFriends(latestGroup);
        const actualMember = members.find(m => String(m.id) === memberProfileKey);
        if (actualMember) {
            isSleeping = window.imApp.isCharacterSleeping(actualMember);
        }
        
        const status = formatStatusLabel(groupProfile.status || 'online', isSleeping);
        const statusColor = isSleeping ? '#8e8e93' : '#34c759';

        let titleHtml = title ? `<div class="gmp-title">${title}</div>` : '';

        card.innerHTML = `
            <div class="gmp-header">
                <div class="gmp-avatar-wrapper">
                    <div class="gmp-avatar"><img src="${avatarUrl}"></div>
                    <div class="gmp-status-bubble" contenteditable="${isSleeping ? 'false' : 'true'}" spellcheck="false">${status}</div>
                </div>
            </div>
            <div class="gmp-body">
                <div class="gmp-name-row">
                    <div class="gmp-name">${name}</div>
                    ${titleHtml}
                </div>
                <div class="gmp-signature">${signature}</div>
                <div class="gmp-inner-voice">${thought}</div>
            </div>
        `;

        const statusBubble = card.querySelector('.gmp-status-bubble');
        statusBubble.addEventListener('blur', async (e) => {
            const nextStatus = normalizeStatusForStorage(e.target.innerText);
            if (latestGroup) {
                const saved = window.imApp.commitFriendChange
                    ? await window.imApp.commitFriendChange(latestGroup.id, (targetGroup) => {
                        if (!targetGroup) return;
                        if (!targetGroup.memberProfiles) targetGroup.memberProfiles = {};
                        if (!targetGroup.memberProfiles[memberProfileKey]) {
                            targetGroup.memberProfiles[memberProfileKey] = { thought: '暂无心声', status: 'online', updatedAt: 0 };
                        }
                        targetGroup.memberProfiles[memberProfileKey].status = nextStatus;
                        targetGroup.memberProfiles[memberProfileKey].updatedAt = Date.now();
                    }, { silent: true })
                    : false;

                if (!saved) {
                    e.target.innerText = status;
                    if (window.showToast) window.showToast('状态保存失败');
                    return;
                }
                e.target.innerText = formatStatusLabel(nextStatus, isSleeping);
            } else {
                // Fallback if no group context
                e.target.innerText = status;
            }
        });

        // Step 1: Explicitly set display flex to make it part of the render tree
        overlay.style.display = 'block';
        card.style.display = 'flex'; // CRITICAL FIX: Make the card itself visible

        // Calculate position based on anchor element
        if (anchorElement) {
            const rect = anchorElement.getBoundingClientRect();
            const cardWidth = 300;
            const cardHeight = card.offsetHeight || 380; // approximate if 0

            let top = rect.bottom + 10;
            let left = rect.left;

            // Adjust if it goes off screen
            const viewportWidth = Math.max(
                0,
                window.visualViewport?.width ||
                document.documentElement.clientWidth ||
                window.innerWidth ||
                0
            );
            const viewportHeight = Math.max(
                0,
                window.visualViewport?.height ||
                document.documentElement.clientHeight ||
                window.innerHeight ||
                0
            );

            if (left + cardWidth > viewportWidth - 20) {
                left = viewportWidth - cardWidth - 20;
            }
            if (top + cardHeight > viewportHeight - 20) {
                top = rect.top - cardHeight - 10;
            }

            const originY = (top < rect.top) ? 'bottom' : 'top';
            const originX = (left === rect.left) ? 'left' : 'right';
            
            card.style.top = top + 'px';
            card.style.left = left + 'px';
            card.style.transformOrigin = `${originX} ${originY}`;
        } else {
            card.style.top = '50%';
            card.style.left = '50%';
            card.style.transform = 'translate(-50%, -50%) scale(0.85)';
            card.style.transformOrigin = 'center center';
        }

        // Step 2: Force reflow so browser registers the new display state BEFORE animating
        void overlay.offsetHeight;
        void card.offsetHeight;
        
        // Step 3: Trigger the transition
        overlay.style.opacity = '1';
        card.classList.add('active');
        
        // Cleanup translation for anchor if needed after scale animation is triggered
        if (anchorElement) {
            card.style.transform = 'scale(1)';
        }
    }

    window.imChat.openChatTab = openChatTab;
    window.imChat.showContextMenu = showContextMenu;
    window.imChat.fitContextMenuToViewport = fitContextMenuToViewport;
    window.imChat.closeContextMenu = closeContextMenu;
    window.imChat.showGroupMemberProfileCard = showGroupMemberProfileCard;

});


