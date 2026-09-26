(function () {
    'use strict';

    const APP_STATE_KEY = 'chatgpt';
    const FALLBACK_STORAGE_KEY = 'u2_chatgptState';
    const MAX_CONVERSATIONS = 100;
    const DEFAULT_STATE = Object.freeze({ schemaVersion: 1, currentConversationId: null, conversations: [] });

    let state = clone(DEFAULT_STATE);
    let elements = {};
    let initialized = false;
    let isRequesting = false;
    let pendingController = null;
    let suppressSidebarClickUntil = 0;

    function clone(value) {
        if (typeof structuredClone === 'function') return structuredClone(value);
        return JSON.parse(JSON.stringify(value));
    }

    function makeId(prefix) {
        if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
        return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }

    function normalizeMessage(raw) {
        if (!raw || (raw.role !== 'user' && raw.role !== 'assistant')) return null;
        const content = String(raw.content || '').trim();
        if (!content) return null;
        return {
            id: String(raw.id || makeId('message')),
            role: raw.role,
            content,
            createdAt: Number(raw.createdAt) || Date.now()
        };
    }

    function normalizeConversation(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const messages = Array.isArray(raw.messages) ? raw.messages.map(normalizeMessage).filter(Boolean) : [];
        if (!messages.length) return null;
        return {
            id: String(raw.id || makeId('conversation')),
            title: String(raw.title || 'New chat').trim().slice(0, 80) || 'New chat',
            pinned: raw.pinned === true,
            createdAt: Number(raw.createdAt) || Date.now(),
            updatedAt: Number(raw.updatedAt) || Number(raw.createdAt) || Date.now(),
            messages
        };
    }

    function normalizeState(raw) {
        const safe = raw && typeof raw === 'object' ? raw : {};
        const conversations = (Array.isArray(safe.conversations) ? safe.conversations : [])
            .map(normalizeConversation)
            .filter(Boolean)
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, MAX_CONVERSATIONS);
        const requestedCurrent = String(safe.currentConversationId || '');
        return {
            schemaVersion: 1,
            currentConversationId: conversations.some(item => item.id === requestedCurrent) ? requestedCurrent : null,
            conversations
        };
    }

    function loadState() {
        try {
            if (typeof window.getAppState === 'function') {
                const stored = window.getAppState(APP_STATE_KEY);
                if (stored) return normalizeState(stored);
            }
            const fallback = localStorage.getItem(FALLBACK_STORAGE_KEY);
            return normalizeState(fallback ? JSON.parse(fallback) : DEFAULT_STATE);
        } catch (error) {
            console.warn('[ChatGPT App] Failed to load state.', error);
            return normalizeState(DEFAULT_STATE);
        }
    }

    function saveState() {
        state = normalizeState(state);
        try {
            if (typeof window.setAppState === 'function') {
                window.setAppState(APP_STATE_KEY, state);
            } else {
                localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(state));
            }
        } catch (error) {
            console.warn('[ChatGPT App] Failed to save state.', error);
        }
    }

    function currentConversation() {
        return state.conversations.find(item => item.id === state.currentConversationId) || null;
    }

    function setSidebarOpen(open) {
        const next = !!open;
        elements.shell?.classList.toggle('is-sidebar-open', next);
        elements.sidebar?.setAttribute('aria-hidden', String(!next));
        elements.sidebarToggle?.setAttribute('aria-expanded', String(next));
        elements.sidebarToggle?.setAttribute('aria-label', next ? 'Close sidebar' : 'Open sidebar');
    }

    function openApp() {
        if (!initialized) init();
        elements.view?.classList.add('active');
        elements.view?.setAttribute('aria-hidden', 'false');
        renderAll();
        requestAnimationFrame(scrollMessagesToBottom);
    }

    function closeApp() {
        pendingController?.abort();
        pendingController = null;
        isRequesting = false;
        setRequestingUi(false);
        setSidebarOpen(false);
        elements.view?.classList.remove('active');
        elements.view?.setAttribute('aria-hidden', 'true');

        const pages = document.getElementById('pages-container');
        if (pages?.clientWidth) pages.scrollTo({ left: pages.clientWidth * 2, behavior: 'auto' });
    }

    function createNewDraft(options = {}) {
        if (isRequesting) {
            pendingController?.abort();
            pendingController = null;
            isRequesting = false;
            setRequestingUi(false);
        }
        state.currentConversationId = null;
        saveState();
        if (elements.input) {
            elements.input.value = '';
            resizeInput();
        }
        renderAll();
        if (options.closeSidebar !== false) setSidebarOpen(false);
        requestAnimationFrame(() => elements.input?.focus({ preventScroll: true }));
    }

    function ensureConversation() {
        let conversation = currentConversation();
        if (conversation) return conversation;
        const now = Date.now();
        conversation = {
            id: makeId('conversation'),
            title: 'New chat',
            pinned: false,
            createdAt: now,
            updatedAt: now,
            messages: []
        };
        state.conversations.unshift(conversation);
        state.currentConversationId = conversation.id;
        return conversation;
    }

    function appendMessage(role, content) {
        const text = String(content || '').trim();
        if (!text) return null;
        const conversation = ensureConversation();
        const message = { id: makeId('message'), role, content: text, createdAt: Date.now() };
        conversation.messages.push(message);
        conversation.updatedAt = message.createdAt;
        state.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
        saveState();
        return message;
    }

    function submitUserText() {
        const text = String(elements.input?.value || '').trim();
        if (!text) return null;
        const message = appendMessage('user', text);
        elements.input.value = '';
        resizeInput();
        renderAll();
        requestAnimationFrame(scrollMessagesToBottom);
        return message;
    }

    function createActionButton(iconName, label) {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-label', label);
        if (iconName === 'more') {
            button.innerHTML = '<i class="fas fa-ellipsis" aria-hidden="true"></i>';
        } else {
            const icon = document.createElement('span');
            icon.className = `cgpt-icon cgpt-icon-${iconName}`;
            icon.setAttribute('aria-hidden', 'true');
            button.appendChild(icon);
        }
        return button;
    }

    function buildMessageRow(message) {
        const row = document.createElement('article');
        row.className = `cgpt-message-row ${message.role}`;
        row.dataset.messageId = message.id;

        if (message.role === 'user') {
            const bubble = document.createElement('div');
            bubble.className = 'cgpt-user-bubble';
            bubble.textContent = message.content;
            row.appendChild(bubble);
            return row;
        }

        const content = document.createElement('div');
        content.className = 'cgpt-assistant-content';
        content.textContent = message.content;
        row.appendChild(content);

        const actions = document.createElement('div');
        actions.className = 'cgpt-assistant-actions';
        actions.append(
            createActionButton('copy', 'Copy'),
            createActionButton('read', 'Read Aloud'),
            createActionButton('share', 'Share'),
            createActionButton('more', 'More')
        );
        row.appendChild(actions);
        return row;
    }

    function renderMessages() {
        if (!elements.messages) return;
        elements.messages.replaceChildren();
        const conversation = currentConversation();
        (conversation?.messages || []).forEach(message => elements.messages.appendChild(buildMessageRow(message)));

        if (isRequesting) {
            const row = document.createElement('article');
            row.className = 'cgpt-message-row assistant';
            row.setAttribute('aria-label', 'ChatGPT is responding');
            row.innerHTML = '<span class="cgpt-typing" aria-hidden="true"><i></i><i></i><i></i></span>';
            elements.messages.appendChild(row);
        }
    }

    function bindConversationSelection(button, conversation) {
        button.addEventListener('click', () => {
            state.currentConversationId = conversation.id;
            saveState();
            renderAll();
            setSidebarOpen(false);
            requestAnimationFrame(scrollMessagesToBottom);
        });
    }

    function renderConversationList(container, conversations) {
        if (!container) return;
        container.replaceChildren();
        conversations.forEach(conversation => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'cgpt-conversation-item';
            button.classList.toggle('is-active', conversation.id === state.currentConversationId);
            button.textContent = conversation.title;
            bindConversationSelection(button, conversation);
            container.appendChild(button);
        });
    }

    function renderSidebar() {
        const sorted = [...state.conversations].sort((a, b) => b.updatedAt - a.updatedAt);
        const pinned = sorted.filter(item => item.pinned);
        const recents = sorted.filter(item => !item.pinned);
        elements.pinnedSection.hidden = pinned.length === 0;
        elements.recentsSection.hidden = recents.length === 0;
        renderConversationList(elements.pinnedList, pinned);
        renderConversationList(elements.recentsList, recents);
    }

    function renderAll() {
        renderMessages();
        renderSidebar();
    }

    function scrollMessagesToBottom() {
        if (elements.messages) elements.messages.scrollTop = elements.messages.scrollHeight;
    }

    function resizeInput() {
        const input = elements.input;
        if (!input) return;
        input.style.height = '36px';
        input.style.height = `${Math.min(120, Math.max(36, input.scrollHeight))}px`;
    }

    function setRequestingUi(requesting) {
        elements.apiSend?.classList.toggle('is-loading', requesting);
        if (elements.apiSend) elements.apiSend.disabled = requesting;
        if (elements.sendOnly) elements.sendOnly.disabled = requesting;
        if (elements.input) elements.input.readOnly = requesting;
    }

    function extractResponseText(data) {
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content === 'string') return content.trim();
        if (Array.isArray(content)) {
            const text = content.map(part => part?.text || part?.content || '').join('').trim();
            if (text) return text;
        }
        if (typeof data?.output_text === 'string') return data.output_text.trim();
        if (Array.isArray(data?.content)) {
            const text = data.content.map(part => part?.text || '').join('').trim();
            if (text) return text;
        }
        const geminiText = data?.candidates?.[0]?.content?.parts?.map(part => part?.text || '').join('').trim();
        return geminiText || '';
    }

    async function requestAssistantReply() {
        const conversation = currentConversation();
        if (!conversation?.messages?.length) {
            window.showToast?.('Enter a message first');
            return;
        }

        const apiConfig = window.getApiConfig ? window.getApiConfig() : (window.apiConfig || {});
        if (!apiConfig.endpoint || !apiConfig.apiKey || !apiConfig.model) {
            window.showToast?.('Please configure API in Settings');
            return;
        }

        const endpoint = window.u2Api?.resolveChatCompletionsEndpoint
            ? window.u2Api.resolveChatCompletionsEndpoint(apiConfig.endpoint)
            : String(apiConfig.endpoint || '');
        const headers = window.u2Api?.buildApiHeaders
            ? window.u2Api.buildApiHeaders(apiConfig, { 'X-U2-Silent-Errors': '1' })
            : { 'Content-Type': 'application/json', Authorization: `Bearer ${apiConfig.apiKey}` };
        const temperature = Number.parseFloat(apiConfig.temperature);

        isRequesting = true;
        pendingController = new AbortController();
        setRequestingUi(true);
        renderMessages();
        requestAnimationFrame(scrollMessagesToBottom);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: apiConfig.model,
                    messages: conversation.messages.map(message => ({ role: message.role, content: message.content })),
                    temperature: Number.isFinite(temperature) ? temperature : 0.7,
                    stream: false
                }),
                signal: pendingController.signal
            });
            if (!response.ok) {
                const detail = window.u2Api?.readApiError
                    ? await window.u2Api.readApiError(response)
                    : { message: `HTTP ${response.status}` };
                throw new Error(detail.message || `HTTP ${response.status}`);
            }
            const data = await response.json();
            const reply = extractResponseText(data);
            if (!reply) throw new Error('API returned an empty response');
            appendMessage('assistant', reply);
        } catch (error) {
            if (error?.name !== 'AbortError') {
                console.warn('[ChatGPT App] API request failed.', error);
                window.showToast?.(error?.message || 'API request failed');
            }
        } finally {
            pendingController = null;
            isRequesting = false;
            setRequestingUi(false);
            renderAll();
            requestAnimationFrame(scrollMessagesToBottom);
        }
    }

    async function sendAndAsk(event) {
        event?.preventDefault?.();
        if (isRequesting) return;
        const typed = String(elements.input?.value || '').trim();
        if (typed) submitUserText();
        await requestAssistantReply();
    }

    function cacheElements() {
        elements = {
            view: document.getElementById('chatgpt-view'),
            shell: document.getElementById('cgpt-shell'),
            sidebar: document.getElementById('cgpt-sidebar'),
            sidebarToggle: document.getElementById('cgpt-sidebar-toggle'),
            messages: document.getElementById('cgpt-messages'),
            input: document.getElementById('cgpt-input'),
            composer: document.getElementById('cgpt-composer'),
            sendOnly: document.getElementById('cgpt-send-only'),
            apiSend: document.getElementById('cgpt-api-send'),
            pinnedSection: document.getElementById('cgpt-pinned-section'),
            pinnedList: document.getElementById('cgpt-pinned-list'),
            recentsSection: document.getElementById('cgpt-recents-section'),
            recentsList: document.getElementById('cgpt-recents-list')
        };
    }

    function init() {
        if (initialized) return;
        cacheElements();
        if (!elements.view) return;
        initialized = true;
        state = loadState();

        document.getElementById('app-chatgpt-btn')?.addEventListener('click', openApp);
        elements.sidebarToggle?.addEventListener('pointerdown', event => {
            if (event.pointerType === 'mouse') return;
            event.preventDefault();
            event.stopImmediatePropagation();
            suppressSidebarClickUntil = Date.now() + 700;
            setSidebarOpen(!elements.shell.classList.contains('is-sidebar-open'));
        });
        elements.sidebarToggle?.addEventListener('click', event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (Date.now() < suppressSidebarClickUntil) return;
            setSidebarOpen(!elements.shell.classList.contains('is-sidebar-open'));
        });
        document.getElementById('cgpt-header-new-chat')?.addEventListener('click', () => createNewDraft());
        document.getElementById('cgpt-sidebar-new-chat')?.addEventListener('click', () => createNewDraft());
        document.getElementById('cgpt-exit-button')?.addEventListener('click', event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (!elements.shell.classList.contains('is-sidebar-open')) closeApp();
        });
        elements.sendOnly?.addEventListener('click', submitUserText);
        elements.composer?.addEventListener('submit', sendAndAsk);
        elements.input?.addEventListener('input', resizeInput);
        renderAll();
        resizeInput();

        if (window.globalDataReadyPromise && typeof window.globalDataReadyPromise.then === 'function') {
            window.globalDataReadyPromise.then(() => {
                state = loadState();
                renderAll();
                requestAnimationFrame(scrollMessagesToBottom);
            }).catch(error => console.warn('[ChatGPT App] State hydration failed.', error));
        }
    }

    window.chatgptApp = Object.freeze({ open: openApp, close: closeApp, newChat: createNewDraft });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
