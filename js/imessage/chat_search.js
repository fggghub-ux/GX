// ==========================================
// IMESSAGE: CHAT HISTORY SEARCH
// ==========================================
(function initChatHistorySearch(global) {
    'use strict';

    const imChat = global.imChat = global.imChat || {};

    function stripHtmlToText(value) {
        const source = String(value == null ? '' : value);
        if (!source) return '';
        if (typeof document !== 'undefined' && document.createElement) {
            const holder = document.createElement('div');
            holder.innerHTML = source;
            holder.querySelectorAll('script,style').forEach(node => node.remove());
            return String(holder.textContent || holder.innerText || '').replace(/\s+/g, ' ').trim();
        }
        return source
            .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#0?39;/gi, "'")
            .replace(/\s+/g, ' ')
            .trim();
    }

    function pushText(parts, value, options = {}) {
        if (value == null) return;
        const text = options.html ? stripHtmlToText(value) : String(value).replace(/\s+/g, ' ').trim();
        if (!text || parts.includes(text)) return;
        parts.push(text);
    }

    function pushMessageListText(parts, messages) {
        if (!Array.isArray(messages)) return;
        messages.forEach(item => {
            if (!item || typeof item !== 'object') return;
            pushText(parts, item.speaker || item.senderName || item.roleName);
            pushText(parts, item.text || item.content);
        });
    }

    function parseMomentText(parts, content) {
        if (!content || typeof content !== 'string') return;
        try {
            const moment = JSON.parse(content);
            if (!moment || typeof moment !== 'object') return;
            pushText(parts, moment.authorName || moment.nickname || moment.userName || moment.author?.name || moment.author?.nickname);
            pushText(parts, moment.text || moment.caption || moment.description || moment.content);
        } catch (error) {
            // Malformed moment payloads are not useful searchable text.
        }
    }

    function extractSearchableMessageText(message = {}) {
        if (!message || typeof message !== 'object') return '';
        const parts = [];
        const type = String(message.type || '').trim();

        pushText(parts, message.replyTo);
        pushText(parts, message.translation);

        switch (type) {
            case 'voice_message':
                pushText(parts, message.transcript || message.text);
                break;
            case 'image':
                pushText(parts, message.text || message.description || message.caption);
                break;
            case 'sticker':
                pushText(parts, message.stickerName || message.text);
                break;
            case 'fake_link':
                pushText(parts, message.fakeLinkData?.siteName);
                pushText(parts, message.fakeLinkData?.title || message.title || message.linkTitle);
                pushText(parts, message.fakeLinkData?.summary || message.fakeLinkData?.description || message.description || message.linkDescription);
                pushText(parts, message.fakeLinkData?.bodyText);
                pushText(parts, message.fakeLinkData?.displayUrl || message.displayUrl || message.domain || message.urlLabel);
                break;
            case 'pay_transfer':
            case 'group_red_packet':
                pushText(parts, message.paymentAction);
                pushText(parts, message.cardTitle || message.title);
                pushText(parts, message.description);
                pushText(parts, message.amount);
                pushText(parts, message.payerName || message.senderName);
                pushText(parts, message.payeeName || message.receiverName || message.targetName);
                pushText(parts, message.statusText);
                break;
            case 'system_notice':
                pushText(parts, message.text || message.content);
                break;
            case 'voice_call_record':
                pushText(parts, message.isVideo ? '视频通话' : '语音通话');
                pushText(parts, message.title);
                pushText(parts, message.statusText);
                pushText(parts, message.summary);
                pushMessageListText(parts, message.messages || message.callMessages);
                break;
            case 'offline_meeting_record':
                pushText(parts, message.title);
                pushText(parts, message.summary || message.rawSummary || message.content);
                pushText(parts, message.dateText);
                pushMessageListText(parts, message.meetingMessages);
                break;
            case 'moment_forward':
                parseMomentText(parts, message.content);
                break;
            case 'html':
                pushText(parts, message.content || message.text, { html: true });
                break;
            default:
                if (message.role === 'user' || message.role === 'assistant') {
                    pushText(parts, message.content || message.text);
                }
                break;
        }

        return parts.join(' · ');
    }

    function getMessageTypeLabel(message = {}) {
        const labels = {
            voice_message: '语音', image: '图片', sticker: '表情', fake_link: '链接',
            pay_transfer: '转账', group_red_packet: '红包', system_notice: '系统提示',
            voice_call_record: '通话', offline_meeting_record: '见面记录', moment_forward: '朋友圈', html: '卡片'
        };
        return labels[message.type] || '消息';
    }

    function searchFriendMessages(friend, query) {
        const keyword = String(query == null ? '' : query).trim();
        if (!friend || !keyword) return [];
        const normalizedKeyword = keyword.toLocaleLowerCase();
        const messages = Array.isArray(friend.messages) ? friend.messages : [];
        const results = [];
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            const message = messages[index];
            const text = extractSearchableMessageText(message);
            if (!text) continue;
            const matchIndex = text.toLocaleLowerCase().indexOf(normalizedKeyword);
            if (matchIndex < 0) continue;
            results.push({ message, index, text, matchIndex, typeLabel: getMessageTypeLabel(message) });
        }
        return results;
    }

    function resolveMessageIndex(friend, descriptor = {}) {
        const messages = Array.isArray(friend?.messages) ? friend.messages : [];
        const id = descriptor.id == null ? '' : String(descriptor.id);
        const timestamp = descriptor.timestamp == null ? '' : String(descriptor.timestamp);
        if (id) {
            const byId = messages.findIndex(message => String(message?.id || '') === id);
            if (byId >= 0) return byId;
        }
        if (timestamp) {
            const byTimestamp = messages.findIndex(message => (
                String(message?.timestamp || '') === timestamp
                && (!descriptor.text || extractSearchableMessageText(message) === descriptor.text)
            ));
            if (byTimestamp >= 0) return byTimestamp;
        }
        const index = Number(descriptor.index);
        if (Number.isInteger(index) && index >= 0 && index < messages.length) {
            const candidateText = extractSearchableMessageText(messages[index]);
            if (!descriptor.text || candidateText === descriptor.text) return index;
        }
        return -1;
    }

    function findRenderedMessageRow(container, message, descriptor = {}) {
        const rows = Array.from(container?.querySelectorAll?.('.chat-row') || []);
        const id = String(message?.id || descriptor.id || '');
        const timestamp = String(message?.timestamp || descriptor.timestamp || '');
        if (id) {
            const byId = rows.find(row => String(row.getAttribute('data-message-id') || '') === id);
            if (byId) return byId;
        }
        if (timestamp) return rows.find(row => String(row.getAttribute('data-timestamp') || '') === timestamp) || null;
        return null;
    }

    function centerMessageRowInContainer(container, row) {
        if (!container || !row) return;
        const containerRect = container.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const rowOffsetInsideContainer = rowRect.top - containerRect.top;
        const centeredScrollTop = container.scrollTop
            + rowOffsetInsideContainer
            - Math.max(0, (container.clientHeight - rowRect.height) / 2);
        container.scrollTop = Math.max(0, centeredScrollTop);
    }

    function revealChatMessage(friendOrId, descriptor = {}) {
        const friend = global.imApp?.getFriendById
            ? global.imApp.getFriendById(friendOrId)
            : (typeof friendOrId === 'object' ? friendOrId : null);
        if (!friend || friend.type === 'group' || friend.type === 'npc' || friend.type === 'official') {
            return { ok: false, reason: 'friend' };
        }
        const targetIndex = resolveMessageIndex(friend, descriptor);
        if (targetIndex < 0) return { ok: false, reason: 'missing' };
        const page = typeof document !== 'undefined' ? document.getElementById(`chat-interface-${friend.id}`) : null;
        const container = page?.querySelector('.ins-chat-messages');
        if (!page || !container || typeof imChat.renderChatHistory !== 'function') return { ok: false, reason: 'view' };

        const previousStartIndex = Number(container._imHistoryState?.visibleStartIndex);
        const previousScrollTop = container.scrollTop;
        container.innerHTML = '';
        imChat.renderChatHistory(friend, container, { startIndex: Math.max(0, targetIndex - 4), scroll: false });
        const targetMessage = friend.messages[targetIndex];
        const row = findRenderedMessageRow(container, targetMessage, descriptor);
        if (!row) {
            container.innerHTML = '';
            imChat.renderChatHistory(friend, container, {
                startIndex: Number.isFinite(previousStartIndex) ? previousStartIndex : undefined,
                scroll: false
            });
            container.scrollTop = previousScrollTop;
            return { ok: false, reason: 'row' };
        }

        container.querySelectorAll('.chat-search-target').forEach(item => item.classList.remove('chat-search-target'));
        row.classList.add('chat-search-target');
        centerMessageRowInContainer(container, row);
        global.setTimeout(() => row.classList.remove('chat-search-target'), 2200);
        return { ok: true, friend, message: targetMessage, index: targetIndex, row };
    }

    imChat.stripChatSearchHtml = stripHtmlToText;
    imChat.extractSearchableMessageText = extractSearchableMessageText;
    imChat.searchFriendMessages = searchFriendMessages;
    imChat.resolveSearchMessageIndex = resolveMessageIndex;
    imChat.centerSearchMessageRow = centerMessageRowInContainer;
    imChat.revealChatMessage = revealChatMessage;

    if (typeof document === 'undefined') return;
    (window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
        const searchButton = document.getElementById('chat-settings-search-btn');
        const searchView = document.getElementById('chat-history-search-view');
        const backButton = document.getElementById('chat-history-search-back');
        const title = document.getElementById('chat-history-search-title');
        const input = document.getElementById('chat-history-search-input');
        const status = document.getElementById('chat-history-search-status');
        const resultsEl = document.getElementById('chat-history-search-results');
        if (!searchButton || !searchView || !backButton || !title || !input || !status || !resultsEl) return;
        let searchFriendId = '';

        global.mobileInputCompat?.registerFocusScope?.({
            selector: '#chat-history-search-view',
            preferFocusScope: true
        });

        function getLiveSearchFriend() {
            if (!searchFriendId) return null;
            return global.imApp?.getFriendById
                ? global.imApp.getFriendById(searchFriendId)
                : (global.imData?.friends || []).find(friend => String(friend.id) === searchFriendId) || null;
        }

        function resetSearchView() {
            input.value = '';
            resultsEl.replaceChildren();
            status.textContent = '输入关键词，搜索全部聊天记录';
            status.className = 'chat-history-search-status is-empty';
            searchFriendId = '';
        }

        function closeSearchView() {
            input.blur();
            if (global.closeView) global.closeView(searchView);
            else searchView.classList.remove('active');
            resetSearchView();
        }

        function appendHighlightedText(container, text, query) {
            const source = String(text || '');
            const keyword = String(query || '');
            const normalizedSource = source.toLocaleLowerCase();
            const normalizedKeyword = keyword.toLocaleLowerCase();
            let cursor = 0;
            let matchAt = normalizedSource.indexOf(normalizedKeyword);
            while (normalizedKeyword && matchAt >= 0) {
                if (matchAt > cursor) container.appendChild(document.createTextNode(source.slice(cursor, matchAt)));
                const mark = document.createElement('mark');
                mark.textContent = source.slice(matchAt, matchAt + keyword.length);
                container.appendChild(mark);
                cursor = matchAt + keyword.length;
                matchAt = normalizedSource.indexOf(normalizedKeyword, cursor);
            }
            if (cursor < source.length) container.appendChild(document.createTextNode(source.slice(cursor)));
        }

        function buildExcerpt(result, query) {
            const radius = 46;
            const start = Math.max(0, result.matchIndex - radius);
            const end = Math.min(result.text.length, result.matchIndex + query.length + radius);
            return `${start > 0 ? '…' : ''}${result.text.slice(start, end)}${end < result.text.length ? '…' : ''}`;
        }

        function formatResultTime(timestamp) {
            const value = Number(timestamp);
            if (!Number.isFinite(value) || value <= 0) return '';
            if (global.imApp?.formatTime) return global.imApp.formatTime(value);
            return new Date(value).toLocaleString();
        }

        function renderResults() {
            const friend = getLiveSearchFriend();
            const query = input.value.trim();
            resultsEl.replaceChildren();
            if (!friend || !query) {
                status.textContent = '输入关键词，搜索全部聊天记录';
                status.className = 'chat-history-search-status is-empty';
                return;
            }
            const results = searchFriendMessages(friend, query);
            if (results.length === 0) {
                status.textContent = `没有找到“${query}”`;
                status.className = 'chat-history-search-status is-empty';
                return;
            }
            status.textContent = `${results.length} 条结果`;
            status.className = 'chat-history-search-status';
            const fragment = document.createDocumentFragment();
            results.forEach(result => {
                const message = result.message || {};
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'chat-history-search-result';
                item.setAttribute('role', 'listitem');
                const heading = document.createElement('div');
                heading.className = 'chat-history-search-result-heading';
                const sender = document.createElement('strong');
                sender.textContent = message.role === 'user'
                    ? '我'
                    : (message.role === 'assistant' ? (friend.nickname || friend.realName || 'Char') : '系统');
                const meta = document.createElement('span');
                const time = formatResultTime(message.timestamp);
                meta.textContent = `${result.typeLabel}${time ? ` · ${time}` : ''}`;
                heading.append(sender, meta);
                const excerpt = document.createElement('div');
                excerpt.className = 'chat-history-search-result-text';
                appendHighlightedText(excerpt, buildExcerpt(result, query), query);
                item.append(heading, excerpt);
                item.addEventListener('click', () => {
                    const descriptor = { id: message.id || null, timestamp: message.timestamp || null, index: result.index, text: result.text };
                    input.blur();
                    const revealed = revealChatMessage(getLiveSearchFriend() || friend, descriptor);
                    if (!revealed.ok) {
                        if (global.showToast) global.showToast(revealed.reason === 'missing' ? '这条消息已不存在' : '暂时无法定位这条消息');
                        return;
                    }
                    const settingsSheet = document.getElementById('chat-settings-sheet');
                    if (global.closeView) {
                        global.closeView(searchView);
                        if (settingsSheet) global.closeView(settingsSheet);
                    } else {
                        searchView.classList.remove('active');
                        settingsSheet?.classList.remove('active');
                    }
                    resetSearchView();
                });
                fragment.appendChild(item);
            });
            resultsEl.appendChild(fragment);
        }

        searchButton.addEventListener('click', () => {
            const friend = global.imData?.currentSettingsFriend;
            if (!friend || friend.type === 'group' || friend.type === 'npc' || friend.type === 'official') return;
            searchFriendId = String(friend.id);
            title.textContent = `搜索与 ${friend.nickname || friend.realName || 'Char'} 的聊天`;
            input.value = '';
            renderResults();
            if (global.openView) global.openView(searchView);
            else searchView.classList.add('active');
            global.setTimeout(() => input.focus({ preventScroll: true }), 80);
        });
        backButton.addEventListener('click', closeSearchView);
        input.addEventListener('input', renderResults);
    });
})(typeof window !== 'undefined' ? window : globalThis);
