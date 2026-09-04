
// ==========================================
// IMESSAGE: 4_chat_list.js
// ==========================================
(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    const { apiConfig, userState } = window;
    window.imChat = window.imChat || {};
    const imChat = window.imChat;

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
        const lastLoadedMsg = loadedMessages.length > 0 ? loadedMessages[loadedMessages.length - 1] : null;

        let preview = typeof friend.lastMessagePreview === 'string' ? friend.lastMessagePreview : '';
        let timestamp = Number(friend.lastMessageTimestamp) || 0;
        let count = Number(friend.messageCount) || 0;

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
        const lineHeader = document.querySelector('.line-header');
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
            if(emptyState) emptyState.style.display = 'none';
            if(listContainer) listContainer.style.display = 'none';
            if(imBottomNavContainer) imBottomNavContainer.style.display = 'none';
            if(lineHeader) lineHeader.style.display = 'none'; 
            
            const pageId = `chat-interface-${window.imData.currentActiveFriend.id}`;
            const page = document.getElementById(pageId);
            if (page) {
                page.style.display = 'flex';
                const container = page.querySelector('.ins-chat-messages');
                setTimeout(() => window.imChat.scrollToBottom(container), 50);
            }
        } else {
            window.imApp?.setActiveThemeSurface?.('chats');
            if(imBottomNavContainer) imBottomNavContainer.style.display = 'flex';
            if(lineHeader) lineHeader.style.display = 'flex'; 
            
            window.imChat.renderChatsList();
            const hasChats = window.imData.friends.some(f => {
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

        return friend.avatarUrl
            ? `<img src="${friend.avatarUrl}">`
            : `<i class="fas fa-user"></i>`;
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
            return `<div class="chat-unread-badge">${friend.unreadCount > 99 ? '99+' : friend.unreadCount}</div>`;
        }
        return '';
    }

    function createChatListItem(friend, isPinned) {
        const item = document.createElement('div');
        item.className = isPinned ? 'chat-item pinned' : 'chat-item';
        item.dataset.friendId = String(friend.id);
        item.addEventListener('click', () => {
            window.imChat.openChatTab(friend);
        });
        return item;
    }

    function updateChatListItem(item, friend, isPinned) {
        const summary = getFriendChatSummary(friend);
        const msgPreview = summary.preview;
        const timeStr = summary.timestamp && window.imApp.formatTime
            ? window.imApp.formatTime(summary.timestamp)
            : '';

        item.className = isPinned ? 'chat-item pinned' : 'chat-item';
        item.dataset.friendId = String(friend.id);
        item.innerHTML = isPinned
            ? `
                <div style="position: relative; display: inline-block;">
                    <div class="chat-avatar">${buildChatAvatarHtml(friend)}</div>
                    ${buildChatUnreadHtml(friend)}
                </div>
                <div class="chat-info">
                    <div class="chat-row-top">
                        <div class="chat-name">${buildChatNameHtml(friend)}</div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                            <div class="chat-time">${timeStr}</div>
                        </div>
                    </div>
                    <div class="chat-message">${msgPreview}</div>
                </div>
                <div class="pin-icon"><i class="fas fa-thumbtack"></i></div>
            `
            : `
                <div style="position: relative; display: inline-block;">
                    <div class="chat-avatar">${buildChatAvatarHtml(friend)}</div>
                    ${buildChatUnreadHtml(friend)}
                </div>
                <div class="chat-info">
                    <div class="chat-row-top">
                        <div class="chat-name">${buildChatNameHtml(friend)}</div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                            <div class="chat-time">${timeStr}</div>
                        </div>
                    </div>
                    <div class="chat-message">${msgPreview}</div>
                </div>
            `;
    }

    function renderChatsList() {
        const chatsList = document.getElementById('chats-list');
        if (!chatsList) return;

        const activeFriends = window.imData.friends.filter(f => {
            const summary = getFriendChatSummary(f);
            return summary.hasMessages || f.isPinned;
        });

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

});
