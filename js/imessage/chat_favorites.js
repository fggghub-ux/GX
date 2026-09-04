// ==========================================
// IMESSAGE: CHARACTER FAVORITE USER MESSAGES
// ==========================================
(function initChatFavorites(global) {
    'use strict';

    const imChat = global.imChat = global.imChat || {};

    function normalizeReason(value) {
        return String(value || '').trim();
    }

    function getFavoriteMessageText(message = {}) {
        if (!message || message.role !== 'user') return '';
        if (message.type === 'voice_message') {
            return String(message.transcript || message.text || '').trim();
        }
        if (message.type && message.type !== 'text') return '';
        return String(message.content || message.text || '').trim();
    }

    function buildFavoriteCandidate(friend, options = {}) {
        if (!friend || friend.type !== 'char' || options.continueWithoutUser) return null;
        const source = String(options.source || '').trim();
        if (source && source !== 'regenerate') return null;
        const messages = Array.isArray(friend.messages) ? friend.messages : [];
        const latestDialogueMessage = messages.slice().reverse().find(message => (
            message && (message.role === 'user' || message.role === 'assistant')
        ));
        if (!latestDialogueMessage || latestDialogueMessage.role !== 'user') return null;

        const messageId = String(latestDialogueMessage.id || '').trim();
        const messageText = getFavoriteMessageText(latestDialogueMessage);
        if (!messageId || !messageText) return null;

        const favorites = global.imApp?.normalizeFavoriteUserMessages
            ? global.imApp.normalizeFavoriteUserMessages(friend.favoriteUserMessages)
            : (Array.isArray(friend.favoriteUserMessages) ? friend.favoriteUserMessages : []);
        if (favorites.some(item => String(item?.messageId || '') === messageId)) return null;

        return {
            messageId,
            messageText,
            messageType: latestDialogueMessage.type === 'voice_message' ? 'voice_message' : 'text',
            messageTimestamp: Math.max(0, Number(latestDialogueMessage.timestamp) || 0)
        };
    }

    function parseFavoriteSelection(rawPayload, candidate, sourceApiRunId, now = Date.now()) {
        if (!candidate || !rawPayload) return null;
        let payload = rawPayload;
        if (typeof rawPayload === 'string') {
            try {
                payload = JSON.parse(rawPayload);
            } catch (_) {
                return null;
            }
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
        if (String(payload.messageId || '').trim() !== String(candidate.messageId || '')) return null;
        const reason = normalizeReason(payload.reason);
        if (!reason) return null;
        const createdAt = Math.max(0, Number(now) || Date.now());
        return {
            id: `favorite-${candidate.messageId}-${createdAt}`,
            messageId: String(candidate.messageId),
            messageText: String(candidate.messageText || '').trim(),
            messageType: candidate.messageType === 'voice_message' ? 'voice_message' : 'text',
            messageTimestamp: Math.max(0, Number(candidate.messageTimestamp) || 0),
            reason,
            createdAt,
            sourceApiRunId: String(sourceApiRunId || '')
        };
    }

    async function commitFavoriteUserMessage(friendOrId, favorite) {
        if (!favorite || !global.imApp?.commitScopedFriendChange) return false;
        let inserted = false;
        const saved = await global.imApp.commitScopedFriendChange(friendOrId, targetFriend => {
            if (!targetFriend || targetFriend.type !== 'char') return;
            const favorites = global.imApp.normalizeFavoriteUserMessages(targetFriend.favoriteUserMessages);
            if (favorites.some(item => item.messageId === favorite.messageId)) return;
            targetFriend.favoriteUserMessages = global.imApp.normalizeFavoriteUserMessages([favorite, ...favorites]);
            inserted = true;
        }, {
            syncActive: true,
            syncSettings: true,
            metaOnly: true,
            silent: true,
            immediate: true
        });
        return !!saved && inserted;
    }

    async function removeFavoriteUserMessage(friendOrId, favoriteId) {
        if (!favoriteId || !global.imApp?.commitScopedFriendChange) return false;
        let removed = false;
        const saved = await global.imApp.commitScopedFriendChange(friendOrId, targetFriend => {
            if (!targetFriend) return;
            const favorites = global.imApp.normalizeFavoriteUserMessages(targetFriend.favoriteUserMessages);
            const nextFavorites = favorites.filter(item => String(item.id) !== String(favoriteId));
            removed = nextFavorites.length !== favorites.length;
            targetFriend.favoriteUserMessages = nextFavorites;
        }, {
            syncActive: true,
            syncSettings: true,
            metaOnly: true,
            silent: true,
            immediate: true
        });
        return !!saved && removed;
    }

    function showFavoriteSavedNotice(friend, container, sourceApiRunId = '') {
        if (!friend || typeof document === 'undefined') return false;
        const activeFriend = global.imData?.currentActiveFriend;
        if (!activeFriend || String(activeFriend.id) !== String(friend.id)) return false;
        const messageContainer = container || document.querySelector(`#chat-interface-${friend.id} .ins-chat-messages`);
        if (!messageContainer) return false;

        messageContainer.querySelectorAll('.favorite-saved-narration').forEach(row => row.remove());
        const row = document.createElement('div');
        row.className = 'chat-row memory-recall-narration favorite-saved-narration';
        row.dataset.friendId = String(friend.id);
        row.dataset.transient = 'true';
        row.dataset.apiRunId = String(sourceApiRunId || '');
        const notice = document.createElement('span');
        notice.className = 'memory-recall-narration-pill favorite-saved-narration-pill';
        notice.textContent = '收藏了一些话';
        row.appendChild(notice);
        messageContainer.appendChild(row);
        if (global.imChat?.scrollToBottom) global.imChat.scrollToBottom(messageContainer);
        return true;
    }

    imChat.normalizeFavoriteReason = normalizeReason;
    imChat.getFavoriteMessageText = getFavoriteMessageText;
    imChat.buildFavoriteCandidate = buildFavoriteCandidate;
    imChat.parseFavoriteSelection = parseFavoriteSelection;
    imChat.commitFavoriteUserMessage = commitFavoriteUserMessage;
    imChat.removeFavoriteUserMessage = removeFavoriteUserMessage;
    imChat.showFavoriteSavedNotice = showFavoriteSavedNotice;

    if (typeof document === 'undefined') return;
    (window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
        const openButton = document.getElementById('chat-settings-favorites-btn');
        const view = document.getElementById('chat-favorites-view');
        const backButton = document.getElementById('chat-favorites-back');
        const title = document.getElementById('chat-favorites-title');
        const list = document.getElementById('chat-favorites-list');
        if (!openButton || !view || !backButton || !title || !list) return;

        let favoritesFriendId = '';

        function getLiveFriend() {
            if (!favoritesFriendId) return null;
            return global.imApp?.getFriendById
                ? global.imApp.getFriendById(favoritesFriendId)
                : (global.imData?.friends || []).find(friend => String(friend.id) === favoritesFriendId) || null;
        }

        function formatTime(timestamp) {
            const value = Number(timestamp);
            if (!Number.isFinite(value) || value <= 0) return '';
            if (global.imApp?.formatTime) return global.imApp.formatTime(value);
            return new Date(value).toLocaleString();
        }

        function renderFavorites() {
            const friend = getLiveFriend();
            list.replaceChildren();
            if (!friend) return;
            const favorites = global.imApp?.normalizeFavoriteUserMessages
                ? global.imApp.normalizeFavoriteUserMessages(friend.favoriteUserMessages)
                : [];
            if (favorites.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'chat-favorites-empty';
                const icon = document.createElement('i');
                icon.className = 'far fa-star';
                icon.setAttribute('aria-hidden', 'true');
                const text = document.createElement('span');
                text.textContent = '还没有收藏的消息';
                empty.append(icon, text);
                list.appendChild(empty);
                return;
            }

            const fragment = document.createDocumentFragment();
            favorites.forEach(favorite => {
                const card = document.createElement('article');
                card.className = 'chat-favorite-card';

                const header = document.createElement('div');
                header.className = 'chat-favorite-card-header';
                const label = document.createElement('strong');
                label.textContent = favorite.messageType === 'voice_message' ? 'User 的语音' : 'User 的消息';
                const time = document.createElement('span');
                time.textContent = formatTime(favorite.messageTimestamp);
                header.append(label, time);

                const quote = document.createElement('blockquote');
                quote.className = 'chat-favorite-message';
                quote.textContent = favorite.messageText;

                const reason = document.createElement('div');
                reason.className = 'chat-favorite-reason';
                const reasonLabel = document.createElement('span');
                reasonLabel.textContent = '收藏原因';
                const reasonText = document.createElement('p');
                reasonText.textContent = favorite.reason;
                reason.append(reasonLabel, reasonText);

                const removeButton = document.createElement('button');
                removeButton.type = 'button';
                removeButton.className = 'chat-favorite-remove';
                removeButton.setAttribute('aria-label', '移除这条收藏');
                removeButton.textContent = '×';
                removeButton.addEventListener('click', () => {
                    const remove = async () => {
                        removeButton.disabled = true;
                        const removed = await removeFavoriteUserMessage(getLiveFriend() || friend, favorite.id);
                        if (!removed && global.showToast) global.showToast('移除收藏失败');
                        renderFavorites();
                    };
                    if (global.showCustomModal) {
                        global.showCustomModal({
                            title: '移除收藏',
                            message: '只会移除收藏，不会删除原聊天消息。',
                            isDestructive: true,
                            confirmText: '移除',
                            onConfirm: remove
                        });
                    } else {
                        void remove();
                    }
                });

                card.append(header, quote, reason, removeButton);
                fragment.appendChild(card);
            });
            list.appendChild(fragment);
        }

        function closeFavorites() {
            if (global.closeView) global.closeView(view);
            else view.classList.remove('active');
            favoritesFriendId = '';
            list.replaceChildren();
        }

        openButton.addEventListener('click', () => {
            const friend = global.imData?.currentSettingsFriend;
            if (!friend || friend.type !== 'char') return;
            favoritesFriendId = String(friend.id);
            title.textContent = `${friend.nickname || friend.realName || 'Char'} 的收藏`;
            renderFavorites();
            if (global.openView) global.openView(view);
            else view.classList.add('active');
        });
        backButton.addEventListener('click', closeFavorites);
    });
})(typeof window !== 'undefined' ? window : globalThis);
