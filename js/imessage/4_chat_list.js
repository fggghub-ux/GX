
// ==========================================
// IMESSAGE: 4_chat_list.js
// ==========================================
(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    const { apiConfig, userState } = window;
    window.imChat = window.imChat || {};
    const imChat = window.imChat;
    const chatsSearchInput = document.getElementById('chats-search-input');

    function formatChatsListTime(timestamp, referenceNow = Date.now()) {
        if (arguments.length < 2) {
            const sharedFormatter = window.imApp?.formatTime;
            if (typeof sharedFormatter === 'function') return sharedFormatter(timestamp);
        }
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date(referenceNow);
        if (Number.isNaN(date.getTime()) || Number.isNaN(now.getTime())) return '';

        const dayNumber = value => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
        const dayDifference = Math.round((dayNumber(now) - dayNumber(date)) / 86400000);

        if (dayDifference === 0) {
            return window.imDataUtils?.formatUsTime
                ? window.imDataUtils.formatUsTime(date)
                : date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        }
        if (dayDifference === 1) return 'Yesterday';
        if (dayDifference >= 2 && dayDifference <= 6) {
            return date.toLocaleDateString('en-US', { weekday: 'long' });
        }
        return date.toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: '2-digit'
        });
    }

function getFriendChatSummary(friend) {
        if (!friend) {
            return {
                hasMessages: false,
                preview: 'No messages',
                timestamp: 0,
                count: 0
            };
        }

        const loadedMessages = Array.isArray(friend.messages) ? friend.messages : [];
        const visibleLoadedMessages = loadedMessages.filter(message => {
            if (message?.role === 'system' || message?.type === 'hidden_context') return false;
            return window.imApp.getFriendMessagePreview
                ? !!window.imApp.getFriendMessagePreview(message)
                : !!(message?.content || message?.text);
        });
        const lastLoadedMsg = visibleLoadedMessages.length > 0
            ? visibleLoadedMessages[visibleLoadedMessages.length - 1]
            : null;

        let preview = typeof friend.lastMessagePreview === 'string' ? friend.lastMessagePreview : '';
        let timestamp = Number(friend.lastMessageTimestamp) || 0;
        let count = Number(friend.messageCount) || 0;
        if (/^\s*\[Gift event\]/i.test(preview)) preview = '[Gift]';

        if (lastLoadedMsg) {
            preview = window.imApp.getFriendMessagePreview
                ? (window.imApp.getFriendMessagePreview(lastLoadedMsg) || preview || '')
                : (lastLoadedMsg.content || lastLoadedMsg.text || preview || '');
            timestamp = Number(lastLoadedMsg.timestamp) || timestamp || 0;
            count = loadedMessages.length;
        }

        return {
            hasMessages: count > 0,
            preview: preview || 'No messages',
            timestamp,
            count
        };
    }

function updateChatsView() {
        const emptyState = document.getElementById('chats-empty-state');
        const listContainer = document.getElementById('chats-list-container');
        const listSurface = document.getElementById('chats-list-surface');
        const chatsContent = document.getElementById('chats-content');
        const imBottomNavContainer = document.querySelector('.line-bottom-nav-container');
        
        if(chatsContent) {
            Array.from(chatsContent.children).forEach(child => {
                if (child.classList.contains('active-chat-interface')) {
                    child.style.display = 'none';
                }
            });
        }

        if (window.imData.currentActiveFriend) {
            window.imApp?.setActiveThemeSurface?.('chat-detail');
            if(listSurface) listSurface.style.display = 'none';
            if(emptyState) emptyState.style.display = 'none';
            if(listContainer) listContainer.style.display = 'none';
            if(imBottomNavContainer) imBottomNavContainer.style.display = 'none';
            const pageId = `chat-interface-${window.imData.currentActiveFriend.id}`;
            const page = document.getElementById(pageId);
            if (page) {
                page.style.display = 'flex';
                const container = page.querySelector('.ins-chat-messages');
                setTimeout(() => window.imChat.scrollToBottom(container), 50);
            }
        } else {
            window.imApp?.setActiveThemeSurface?.('chats');
            if(listSurface) listSurface.style.display = 'flex';
            if(imBottomNavContainer) imBottomNavContainer.style.display = 'flex';
            window.imApp?.syncChatsLayout?.();
            window.imChat.renderChatsList();
            const hasChats = (window.imData.friends || []).some(f => {
                const summary = getFriendChatSummary(f);
                return summary.hasMessages || !!f.isPinned;
            });
            if (hasChats) {
                if(emptyState) emptyState.style.display = 'none';
                if(listContainer) listContainer.style.display = 'block';
            } else {
                if(emptyState) emptyState.style.display = 'flex';
                if(listContainer) listContainer.style.display = 'none';
            }
        }
        if (window.imApp.updateChatsUnreadBadges) window.imApp.updateChatsUnreadBadges();
    }

function buildChatAvatarHtml(friend) {
        if (friend.type === 'group') {
            return friend.avatarUrl
                ? `<img src="${friend.avatarUrl}">`
                : `<div style="width: 100%; height: 100%; background: linear-gradient(135deg, #ff9a9e, #fecfef); color: white; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 20px;">${friend.nickname.charAt(0).toUpperCase()}</div>`;
        }

        if (friend.avatarUrl) return `<img src="${friend.avatarUrl}">`;
        if (!friend.type || friend.type === 'char') {
            return '<img src="assets/imessage/default-char-avatar.jpg">';
        }
        return '<i class="fas fa-user"></i>';
    }

    function buildChatNameHtml(friend) {
        let nameHtml = friend.nickname;
        if (friend.type === 'group') {
            nameHtml += ` <span style="background:#e5e5ea; color:#8e8e93; font-size:10px; padding:2px 6px; border-radius:10px; margin-left:6px; vertical-align: middle;">group</span>`;
        } else if (friend.type === 'official') {
            nameHtml += ` <span style="background:#e5e5ea; color:#8e8e93; font-size:10px; padding:2px 6px; border-radius:10px; margin-left:6px; vertical-align: middle;">office</span>`;
        }
        return nameHtml;
    }

    function buildChatUnreadHtml(friend) {
        if (friend.unreadCount && friend.unreadCount > 0) {
            const unreadText = friend.unreadCount > 99 ? '99+' : String(friend.unreadCount);
            return `<span class="chat-unread-dot" aria-hidden="true">${unreadText}</span>`;
        }
        return '';
    }

    function buildChatPinnedHtml(isPinned) {
        return isPinned ? '<span class="chat-pinned-dot" aria-hidden="true"></span>' : '';
    }

    async function setChatPinnedState(friendId, shouldPin, item) {
        const liveFriend = (window.imData.friends || []).find(friend => String(friend.id) === String(friendId));
        if (!liveFriend || !!liveFriend.isPinned === shouldPin) return false;
        const saved = window.imApp?.commitFriendChange
            ? await window.imApp.commitFriendChange(friendId, (targetFriend) => {
                if (targetFriend) targetFriend.isPinned = shouldPin;
            }, { silent: true, metaOnly: true })
            : false;
        item?.classList.remove('is-pin-gesture');
        if (!saved) {
            window.showToast?.('置顶状态保存失败');
            return false;
        }
        const latestFriend = (window.imData.friends || []).find(friend => String(friend.id) === String(friendId)) || liveFriend;
        window.imChat.renderChatsList?.();
        window.showToast?.(shouldPin ? `Pinned ${latestFriend.nickname || latestFriend.realName || 'Char'}` : 'Unpinned');
        return true;
    }

    function bindChatPinGesture(item) {
        if (!item || item.dataset.pinGestureBound === 'true') return;
        item.dataset.pinGestureBound = 'true';
        let pointerId = null;
        let startX = 0;
        let startY = 0;
        let deltaX = 0;
        let armed = false;
        let longPressTimer = null;

        const clearLongPress = () => {
            if (longPressTimer) window.clearTimeout(longPressTimer);
            longPressTimer = null;
        };
        const reset = () => {
            clearLongPress();
            pointerId = null;
            deltaX = 0;
            armed = false;
            item.classList.remove('is-pin-gesture');
            item.style.transform = '';
        };

        item.addEventListener('pointerdown', (event) => {
            if (event.button != null && event.button !== 0) return;
            pointerId = event.pointerId;
            startX = event.clientX;
            startY = event.clientY;
            deltaX = 0;
            armed = false;
            clearLongPress();
            longPressTimer = window.setTimeout(() => {
                armed = true;
                item.classList.add('is-pin-gesture');
                navigator.vibrate?.(20);
                item.setPointerCapture?.(pointerId);
            }, 480);
        });

        item.addEventListener('pointermove', (event) => {
            if (pointerId !== event.pointerId) return;
            const nextX = event.clientX - startX;
            const nextY = event.clientY - startY;
            if (!armed) {
                if (Math.abs(nextX) > 10 || Math.abs(nextY) > 10) reset();
                return;
            }
            if (Math.abs(nextY) > Math.abs(nextX) + 16) {
                reset();
                return;
            }
            deltaX = Math.max(-34, Math.min(34, nextX));
            item.style.transform = `translateX(${deltaX}px)`;
            event.preventDefault();
        });

        item.addEventListener('pointerup', (event) => {
            if (pointerId !== event.pointerId) return;
            clearLongPress();
            const friendId = item.dataset.friendId || '';
            const liveFriend = (window.imData.friends || []).find(friend => String(friend.id) === String(friendId));
            const shouldPin = !!liveFriend && !liveFriend.isPinned && deltaX <= -24;
            const shouldUnpin = !!liveFriend?.isPinned && deltaX >= 24;
            if (shouldPin || shouldUnpin) {
                item._suppressChatOpenUntil = Date.now() + 700;
                item.style.transition = 'transform .18s cubic-bezier(.2,.8,.2,1)';
                item.style.transform = `translateX(${shouldPin ? -18 : 18}px)`;
                window.setTimeout(() => {
                    item.style.transform = '';
                    window.setTimeout(() => { item.style.transition = ''; }, 190);
                }, 90);
                void setChatPinnedState(friendId, shouldPin, item);
            } else {
                reset();
            }
            pointerId = null;
            armed = false;
        });

        item.addEventListener('pointercancel', reset);
        item.addEventListener('contextmenu', event => event.preventDefault());
    }

    function createChatListItem(friend, isPinned) {
        const item = document.createElement('div');
        item.className = isPinned ? 'chat-item pinned' : 'chat-item';
        item.dataset.friendId = String(friend.id);
        item.addEventListener('click', (event) => {
            if (Date.now() < Number(item._suppressChatOpenUntil || 0)) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            const liveFriend = (window.imData.friends || []).find(entry => String(entry.id) === String(item.dataset.friendId)) || friend;
            window.imChat.openChatTab(liveFriend);
        });
        bindChatPinGesture(item);
        return item;
    }

    function updateChatListItem(item, friend, isPinned) {
        const summary = getFriendChatSummary(friend);
        const msgPreview = summary.preview;
        const timeStr = formatChatsListTime(summary.timestamp);

        item.className = isPinned ? 'chat-item pinned' : 'chat-item';
        item.dataset.friendId = String(friend.id);
        item.setAttribute('aria-label', friend.unreadCount > 0
            ? `${friend.nickname}, ${friend.unreadCount} unread`
            : friend.nickname);
        item.innerHTML = `
            ${buildChatPinnedHtml(isPinned)}
            <div class="chat-avatar-wrap">
                <div class="chat-avatar">${buildChatAvatarHtml(friend)}</div>
                ${buildChatUnreadHtml(friend)}
            </div>
            <div class="chat-info">
                <div class="chat-row-top">
                    <div class="chat-name">${buildChatNameHtml(friend)}</div>
                    <div class="chat-meta">
                        <div class="chat-time">${timeStr}</div>
                        <svg class="chat-chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
                        </svg>
                    </div>
                </div>
                <div class="chat-message">${msgPreview}</div>
            </div>
        `;
    }

    function renderChatsList() {
        const chatsList = document.getElementById('chats-list');
        if (!chatsList) return;

        const allActiveFriends = (window.imData.friends || []).filter(f => {
            const summary = getFriendChatSummary(f);
            return summary.hasMessages || f.isPinned;
        });
        const query = String(chatsSearchInput?.value || '').trim().toLocaleLowerCase();
        const activeFriends = query
            ? allActiveFriends.filter(friend => String(friend.nickname || '').toLocaleLowerCase().includes(query))
            : allActiveFriends;

        activeFriends.sort((a, b) => {
            if (a.isPinned !== b.isPinned) {
                return a.isPinned ? -1 : 1;
            }
            const timeA = getFriendChatSummary(a).timestamp;
            const timeB = getFriendChatSummary(b).timestamp;
            return timeB - timeA;
        });

        let pinnedContainer = chatsList.querySelector('.pinned-chats-container');
        if (!pinnedContainer) {
            pinnedContainer = document.createElement('div');
            pinnedContainer.className = 'pinned-chats-container';
            chatsList.appendChild(pinnedContainer);
        }

        let normalContainer = chatsList.querySelector('.normal-chats-container');
        if (!normalContainer) {
            normalContainer = document.createElement('div');
            normalContainer.className = 'normal-chats-container';
            chatsList.appendChild(normalContainer);
        }

        const nextPinnedIds = new Set();
        const nextNormalIds = new Set();

        const pinnedFriends = activeFriends.filter(f => f.isPinned);
        pinnedFriends.forEach(friend => {
            const friendId = String(friend.id);
            nextPinnedIds.add(friendId);
            let item = pinnedContainer.querySelector(`.chat-item[data-friend-id="${friendId}"]`);
            if (!item) {
                item = createChatListItem(friend, true);
            }
            updateChatListItem(item, friend, true);
            pinnedContainer.appendChild(item);
        });

        Array.from(pinnedContainer.querySelectorAll('.chat-item')).forEach(item => {
            if (!nextPinnedIds.has(String(item.dataset.friendId || ''))) {
                item.remove();
            }
        });

        const unpinnedFriends = activeFriends.filter(f => !f.isPinned);
        unpinnedFriends.forEach(friend => {
            const friendId = String(friend.id);
            nextNormalIds.add(friendId);
            let item = normalContainer.querySelector(`.chat-item[data-friend-id="${friendId}"]`);
            if (!item) {
                item = createChatListItem(friend, false);
            }
            updateChatListItem(item, friend, false);
            normalContainer.appendChild(item);
        });

        Array.from(normalContainer.querySelectorAll('.chat-item')).forEach(item => {
            if (!nextNormalIds.has(String(item.dataset.friendId || ''))) {
                item.remove();
            }
        });

        if (pinnedFriends.length === 0 && pinnedContainer.parentNode === chatsList) {
            pinnedContainer.innerHTML = '';
        }

        if (unpinnedFriends.length === 0) {
            normalContainer.innerHTML = '';
        }

        if (window.imApp.updateChatsUnreadBadges) window.imApp.updateChatsUnreadBadges();
        if (window.imApp.markChatsListRendered) window.imApp.markChatsListRendered();
    }

    window.imChat.updateChatsView = updateChatsView;
    window.imChat.renderChatsList = renderChatsList;
    window.imChat.formatChatsListTime = formatChatsListTime;

    chatsSearchInput?.addEventListener('input', renderChatsList);

});
