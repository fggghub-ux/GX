(function(root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.imGame = Object.assign(root.imGame || {}, api);
})(typeof window !== 'undefined' ? window : null, function(root) {
    'use strict';

    const MAX_BATCH_SIZE = 10;
    const DEFAULT_BATCH_SIZE = 1;
    const DEFAULT_CONTEXT_MESSAGE_COUNT = 20;
    const MAX_RECENT_MESSAGES = 50;
    const MAX_CONTEXT_CHARS = 36000;

    function cleanText(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    function containsChinese(value) {
        return /[\u3400-\u9fff]/.test(String(value || ''));
    }

    function clampBatchSize(value) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed)) return DEFAULT_BATCH_SIZE;
        return Math.max(1, Math.min(MAX_BATCH_SIZE, parsed));
    }

    function clampContextMessageCount(value) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed)) return DEFAULT_CONTEXT_MESSAGE_COUNT;
        return Math.max(1, Math.min(MAX_RECENT_MESSAGES, parsed));
    }

    function normalizeAnonymousQaEntry(entry, index = 0) {
        if (!entry || typeof entry !== 'object') return null;
        const question = cleanText(entry.question);
        const answer = cleanText(entry.answer);
        if (!question || !answer) return null;
        const createdAt = Math.max(0, Number(entry.createdAt) || 0);
        return {
            id: cleanText(entry.id) || `anonymous-qa-${createdAt || Date.now()}-${index}`,
            source: entry.source === 'generated' ? 'generated' : 'manual',
            question,
            answer,
            answerTranslationZh: cleanText(entry.answerTranslationZh) === answer ? '' : cleanText(entry.answerTranslationZh),
            createdAt: createdAt || Date.now()
        };
    }

    function normalizeAnonymousQaData(value) {
        const source = value && typeof value === 'object' ? value : {};
        return {
            entries: (Array.isArray(source.entries) ? source.entries : [])
                .map(normalizeAnonymousQaEntry)
                .filter(Boolean)
                .sort((a, b) => a.createdAt - b.createdAt)
        };
    }

    function removeAnonymousQaEntry(value, entryId) {
        const normalized = normalizeAnonymousQaData(value);
        const safeEntryId = cleanText(entryId);
        const entries = normalized.entries.filter(entry => entry.id !== safeEntryId);
        return {
            data: { entries },
            removed: !!safeEntryId && entries.length !== normalized.entries.length
        };
    }

    function getEligibleCharacters(friends) {
        return (Array.isArray(friends) ? friends : []).filter(friend => friend && friend.type === 'char');
    }

    function extractResponseContent(data) {
        const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
        const content = choice?.message?.content ?? choice?.text ?? choice?.delta?.content ?? '';
        return Array.isArray(content)
            ? content.map(item => typeof item === 'string' ? item : (item?.text || '')).join('')
            : String(content || '');
    }

    function parseJsonPayload(raw) {
        const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        if (!text) throw new Error('API 没有返回匿名问答内容');
        try {
            return JSON.parse(text);
        } catch (_) {
            const arrayStart = text.indexOf('[');
            const arrayEnd = text.lastIndexOf(']');
            if (arrayStart >= 0 && arrayEnd > arrayStart) return JSON.parse(text.slice(arrayStart, arrayEnd + 1));
            const objectStart = text.indexOf('{');
            const objectEnd = text.lastIndexOf('}');
            if (objectStart >= 0 && objectEnd > objectStart) return JSON.parse(text.slice(objectStart, objectEnd + 1));
            throw new Error('API 返回的匿名问答不是合法 JSON');
        }
    }

    function parseAnonymousQaResponse(raw, options = {}) {
        const source = options.source === 'generated' ? 'generated' : 'manual';
        const expectedCount = source === 'generated' ? clampBatchSize(options.expectedCount) : 1;
        const hasLanguageHint = cleanText(options.answerLanguage) !== '';
        const answerUsesChinese = hasLanguageHint ? /^zh(?:-|_|$)/i.test(cleanText(options.answerLanguage)) : null;
        const parsed = parseJsonPayload(raw);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        if (list.length !== expectedCount) {
            throw new Error(`API 应返回 ${expectedCount} 条问答，实际返回 ${list.length} 条`);
        }
        const baseTime = Math.max(1, Number(options.now) || Date.now());
        return list.map((item, index) => {
            const question = source === 'manual' ? cleanText(options.question) : cleanText(item?.question);
            const answer = cleanText(item?.answer);
            if (!question || !answer) throw new Error(`第 ${index + 1} 条问答缺少问题或回答`);
            const normalized = normalizeAnonymousQaEntry({
                id: `anonymous-qa-${baseTime}-${index}`,
                source,
                question,
                answer,
                answerTranslationZh: answerUsesChinese === true ? '' : item?.answerTranslationZh,
                createdAt: baseTime + index
            }, index);
            const needsTranslation = answerUsesChinese === false || (answerUsesChinese === null && !containsChinese(answer));
            if (needsTranslation && !normalized.answerTranslationZh) {
                throw new Error(`第 ${index + 1} 条非中文回答缺少中文翻译`);
            }
            return normalized;
        });
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    function entryText(entry) {
        if (typeof entry === 'string') return entry.trim();
        if (!entry || typeof entry !== 'object') return '';
        return cleanText(entry.content || entry.text || entry.summary || entry.note || entry.description || entry.title);
    }

    function formatMemoryList(entries) {
        return (Array.isArray(entries) ? entries : []).map(entryText).filter(Boolean).join('\n');
    }

    function formatRecentMessages(friend, userName, contextMessageCount = DEFAULT_CONTEXT_MESSAGE_COUNT) {
        const messages = Array.isArray(friend?.messages) ? friend.messages : [];
        const limit = clampContextMessageCount(contextMessageCount);
        const charName = friend?.nickname || friend?.realName || 'Char';
        return messages
            .filter(message => message && (message.role === 'user' || message.role === 'assistant'))
            .slice(-limit)
            .map(message => {
                const speaker = message.role === 'user' ? userName : charName;
                const content = message.type === 'image'
                    ? `[图片：${message.description || message.text || '无描述'}]`
                    : cleanText(message.content || message.text || message.transcript);
                return content ? `${speaker}: ${content}` : '';
            })
            .filter(Boolean)
            .join('\n')
            .slice(-12000);
    }

    function buildAnonymousQaContext(friend, options = {}) {
        const memory = friend?.memory && typeof friend.memory === 'object' ? friend.memory : {};
        const relationships = (Array.isArray(memory.relationships) ? memory.relationships : [])
            .map(item => {
                if (!item || typeof item !== 'object') return '';
                return [item.name || item.nickname || item.personName || item.friendId, item.relation || item.relationship]
                    .filter(Boolean).join(': ');
            }).filter(Boolean).join('\n');
        const sections = [
            `角色姓名：${friend?.nickname || friend?.realName || 'Char'}`,
            `真实姓名：${friend?.realName || '未填写'}`,
            `角色默认语言：${friend?.language || 'zh'}`,
            `核心人设：\n${friend?.persona || '未填写'}`,
            `与 User 的关系：\n${friend?.relationship || '未填写'}`,
            `记忆概要：\n${memory.overview || '无'}`,
            `长期记忆：\n${memory.longTerm || formatMemoryList(memory.longTermEntries) || '无'}`,
            `短期记忆：\n${formatMemoryList(memory.shortTermEntries) || '无'}`,
            `珍视记忆：\n${memory.cherished || formatMemoryList(memory.cherishedEntries) || '无'}`,
            `关系网络：\n${relationships || '无'}`,
            `最近聊天（仅用于保持当前性格与剧情连续性）：\n${options.recentChat || '无'}`,
            options.worldBookContext ? `当前生效的世界书：\n${options.worldBookContext}` : ''
        ].filter(Boolean);
        return sections.join('\n\n').slice(0, MAX_CONTEXT_CHARS);
    }

    function createViewMarkup() {
        return `
            <section class="app-view im-game-view" id="im-game-view" aria-label="Game" data-u2-i18n-aria-label="game.title">
                <header class="im-game-header">
                    <button type="button" class="im-game-back" id="im-game-back" aria-label="返回 iMessage"><i class="fas fa-chevron-left"></i></button>
                    <div class="im-game-header-title" data-u2-i18n="game.title">Game</div>
                    <div class="im-game-header-spacer" aria-hidden="true"></div>
                </header>
                <main class="im-game-hub">
                    <div class="im-game-hub-heading"><span>GAME CENTER</span><h1>选择游戏</h1></div>
                    <button type="button" class="im-game-card" id="im-anonymous-qa-card">
                        <span class="im-game-card-icon"><i class="fas fa-user-secret"></i></span>
                        <span class="im-game-card-copy"><strong>匿名问答</strong><small>选择一位 Char，看看 TA 会怎样回答匿名来信</small></span>
                        <i class="fas fa-chevron-right im-game-card-arrow" aria-hidden="true"></i>
                    </button>
                </main>
            </section>
            <section class="app-view im-anonymous-qa-view" id="im-anonymous-qa-view" aria-label="匿名问答">
                <header class="im-game-header">
                    <button type="button" class="im-game-back" id="im-anonymous-qa-back" aria-label="返回 Game"><i class="fas fa-chevron-left"></i></button>
                    <div class="im-game-header-title">匿名问答</div>
                    <button type="button" class="im-game-add" id="im-anonymous-composer-open" aria-label="新建匿名问答" title="新建匿名问答"><i class="fas fa-plus"></i></button>
                </header>
                <main class="im-anonymous-qa-scroll">
                    <section class="im-anonymous-panel im-anonymous-character-panel">
                        <div class="im-anonymous-character-title">选择 Char</div>
                        <div class="im-anonymous-character-bar" id="im-anonymous-character-bar" role="listbox" aria-label="选择已有 Char"></div>
                    </section>
                    <div class="im-anonymous-status" id="im-anonymous-status" role="status" aria-live="polite"></div>
                    <section class="im-anonymous-history-section">
                        <div class="im-anonymous-history-heading"><h2>问答记录</h2><span id="im-anonymous-history-count">0</span></div>
                        <div class="im-anonymous-history" id="im-anonymous-history"></div>
                    </section>
                </main>
                <div class="im-anonymous-composer-overlay" id="im-anonymous-composer-overlay" aria-hidden="true">
                    <section class="im-anonymous-composer" role="dialog" aria-modal="true" aria-labelledby="im-anonymous-composer-title">
                        <header class="im-anonymous-composer-header">
                            <div><small>ANONYMOUS Q&amp;A</small><h2 id="im-anonymous-composer-title">新建匿名问答</h2></div>
                            <button type="button" id="im-anonymous-composer-close" aria-label="关闭"><i class="fas fa-times"></i></button>
                        </header>
                        <div class="im-anonymous-mode-tabs" role="tablist" aria-label="选择问答方式">
                            <button type="button" class="is-active" data-anonymous-mode="manual" role="tab" aria-selected="true">匿名提问</button>
                            <button type="button" data-anonymous-mode="generated" role="tab" aria-selected="false">生成匿名来信</button>
                        </div>
                        <div class="im-anonymous-context-control" id="im-anonymous-context-control">
                            <div class="im-anonymous-context-copy"><strong>挂载聊天上下文</strong><small>默认最近 20 条，世界书始终挂载</small></div>
                            <div class="im-anonymous-context-options">
                                <label class="im-anonymous-context-switch" for="im-anonymous-context-enabled" title="是否挂载最近聊天上下文">
                                    <input id="im-anonymous-context-enabled" type="checkbox" checked aria-label="挂载最近聊天上下文">
                                    <span aria-hidden="true"></span>
                                </label>
                                <label class="im-anonymous-context-count-field" for="im-anonymous-context-count"><input id="im-anonymous-context-count" type="number" inputmode="numeric" min="1" max="50" step="1" value="20" aria-label="挂载聊天上下文条数"><em>条</em></label>
                            </div>
                        </div>
                        <div class="im-anonymous-mode-panel is-active" data-anonymous-panel="manual" role="tabpanel">
                            <div class="im-anonymous-section-title"><span>写下问题</span><small>TA 不会知道提问者是你</small></div>
                            <textarea id="im-anonymous-question" maxlength="500" rows="4" placeholder="写下你想匿名问 TA 的问题…"></textarea>
                            <button type="button" class="im-anonymous-primary" id="im-anonymous-ask">匿名提问</button>
                        </div>
                        <div class="im-anonymous-mode-panel" data-anonymous-panel="generated" role="tabpanel" hidden>
                            <div class="im-anonymous-section-title"><span>生成匿名来信</span><small>模拟其他匿名访客向 TA 提问并生成回答</small></div>
                            <div class="im-anonymous-generate-row">
                                <label for="im-anonymous-count">数量</label>
                                <input id="im-anonymous-count" type="number" inputmode="numeric" min="1" max="10" step="1" value="1">
                            </div>
                            <button type="button" class="im-anonymous-primary" id="im-anonymous-generate">生成问答</button>
                        </div>
                        <div class="im-anonymous-modal-status" id="im-anonymous-modal-status" role="status" aria-live="polite"></div>
                    </section>
                </div>
            </section>`;
    }

    function initializeBrowserGame() {
        if (!root?.document || root.document.getElementById('im-game-view')) return;
        const app = root.document.getElementById('app');
        if (!app) return;
        app.insertAdjacentHTML('beforeend', createViewMarkup());

        const elements = {
            service: root.document.getElementById('imessage-game-btn'),
            gameView: root.document.getElementById('im-game-view'),
            qaView: root.document.getElementById('im-anonymous-qa-view'),
            gameBack: root.document.getElementById('im-game-back'),
            qaBack: root.document.getElementById('im-anonymous-qa-back'),
            qaCard: root.document.getElementById('im-anonymous-qa-card'),
            composerOpen: root.document.getElementById('im-anonymous-composer-open'),
            composerOverlay: root.document.getElementById('im-anonymous-composer-overlay'),
            composerClose: root.document.getElementById('im-anonymous-composer-close'),
            modeButtons: Array.from(root.document.querySelectorAll('[data-anonymous-mode]')),
            modePanels: Array.from(root.document.querySelectorAll('[data-anonymous-panel]')),
            characterBar: root.document.getElementById('im-anonymous-character-bar'),
            question: root.document.getElementById('im-anonymous-question'),
            contextControl: root.document.getElementById('im-anonymous-context-control'),
            contextEnabled: root.document.getElementById('im-anonymous-context-enabled'),
            contextCount: root.document.getElementById('im-anonymous-context-count'),
            ask: root.document.getElementById('im-anonymous-ask'),
            count: root.document.getElementById('im-anonymous-count'),
            generate: root.document.getElementById('im-anonymous-generate'),
            status: root.document.getElementById('im-anonymous-status'),
            modalStatus: root.document.getElementById('im-anonymous-modal-status'),
            history: root.document.getElementById('im-anonymous-history'),
            historyCount: root.document.getElementById('im-anonymous-history-count')
        };
        const state = { selectedFriendId: '', inFlight: false, composerMode: 'manual' };

        function getCharacters() {
            return getEligibleCharacters(root.imData?.friends);
        }

        function getSelectedFriend() {
            return getCharacters().find(friend => String(friend.id) === String(state.selectedFriendId)) || null;
        }

        function setStatus(message = '', tone = '') {
            elements.status.textContent = message;
            elements.status.dataset.tone = tone;
        }

        function setModalStatus(message = '', tone = '') {
            elements.modalStatus.textContent = message;
            elements.modalStatus.dataset.tone = tone;
        }

        function setComposerMode(mode) {
            state.composerMode = mode === 'generated' ? 'generated' : 'manual';
            elements.modeButtons.forEach(button => {
                const active = button.dataset.anonymousMode === state.composerMode;
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-selected', String(active));
            });
            elements.modePanels.forEach(panel => {
                const active = panel.dataset.anonymousPanel === state.composerMode;
                panel.classList.toggle('is-active', active);
                panel.hidden = !active;
            });
            setModalStatus('');
        }

        function openComposer() {
            if (state.inFlight) return;
            if (!getSelectedFriend()) return setStatus('请先添加并选择一个 Char', 'error');
            setComposerMode('manual');
            elements.composerOverlay.classList.add('is-active');
            elements.composerOverlay.setAttribute('aria-hidden', 'false');
            setStatus('');
            elements.question.focus({ preventScroll: true });
        }

        function closeComposer(force = false) {
            if (state.inFlight && !force) return;
            elements.composerOverlay.classList.remove('is-active');
            elements.composerOverlay.setAttribute('aria-hidden', 'true');
            setModalStatus('');
            elements.composerOpen.focus({ preventScroll: true });
        }

        function syncContextControlState() {
            const enabled = !!elements.contextEnabled.checked;
            elements.contextControl.classList.toggle('is-disabled', !enabled);
            elements.contextCount.disabled = state.inFlight || !enabled;
        }

        function setBusy(busy, label = '') {
            state.inFlight = !!busy;
            elements.composerOpen.disabled = busy;
            elements.ask.disabled = busy;
            elements.generate.disabled = busy;
            elements.composerClose.disabled = busy;
            elements.modeButtons.forEach(button => { button.disabled = busy; });
            elements.characterBar.dataset.busy = busy ? 'true' : 'false';
            elements.characterBar.querySelectorAll('button').forEach(button => { button.disabled = busy; });
            elements.count.disabled = busy;
            elements.contextEnabled.disabled = busy;
            syncContextControlState();
            elements.question.disabled = busy;
            elements.ask.textContent = busy && label === 'manual' ? '正在回答…' : '匿名提问';
            elements.generate.textContent = busy && label === 'generated' ? '正在生成…' : '生成问答';
        }

        function renderHistory() {
            const friend = getSelectedFriend();
            if (!friend) {
                elements.historyCount.textContent = '0';
                elements.history.innerHTML = '<div class="im-anonymous-empty">添加 Char 后即可开始匿名问答</div>';
                return;
            }
            const entries = normalizeAnonymousQaData(friend.anonymousQa).entries.slice().reverse();
            elements.historyCount.textContent = String(entries.length);
            if (!entries.length) {
                elements.history.innerHTML = '<div class="im-anonymous-empty">还没有问答记录<br><span>发送第一封匿名来信吧</span></div>';
                return;
            }
            elements.history.innerHTML = entries.map(entry => {
                const date = new Date(entry.createdAt);
                const time = Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                return `<article class="im-anonymous-entry">
                    <div class="im-anonymous-entry-meta">
                        <span><i class="fas fa-user-secret"></i> 匿名来信</span>
                        <div class="im-anonymous-entry-actions">
                            <time>${escapeHtml(time)}</time>
                            <button type="button" class="im-anonymous-delete" data-anonymous-delete-id="${escapeHtml(entry.id)}" aria-label="删除这条问答" title="删除"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                    <div class="im-anonymous-question-copy">${escapeHtml(entry.question)}</div>
                    <div class="im-anonymous-answer-label">${escapeHtml(friend.nickname || friend.realName || 'Char')} 的回答</div>
                    <div class="im-anonymous-answer-copy">${escapeHtml(entry.answer)}</div>
                    ${entry.answerTranslationZh ? `<div class="im-anonymous-translation"><span>译</span>${escapeHtml(entry.answerTranslationZh)}</div>` : ''}
                </article>`;
            }).join('');
        }

        async function refreshCharacters() {
            if (root.imApp?.ensureDataReady && !root.imData?.ready) await root.imApp.ensureDataReady();
            const characters = getCharacters();
            const previous = String(state.selectedFriendId || '');
            const selected = characters.find(friend => String(friend.id) === previous) || characters[0] || null;
            state.selectedFriendId = selected ? String(selected.id) : '';
            elements.characterBar.innerHTML = characters.length
                ? characters.map(friend => {
                    const name = friend.nickname || friend.realName || '未命名 Char';
                    const isActive = String(friend.id) === state.selectedFriendId;
                    const avatar = friend.avatarUrl
                        ? `<img src="${escapeHtml(friend.avatarUrl)}" alt="">`
                        : `<span>${escapeHtml(name.slice(0, 1).toUpperCase())}</span>`;
                    return `<button type="button" class="im-anonymous-char-choice${isActive ? ' is-active' : ''}" data-anonymous-char-id="${escapeHtml(friend.id)}" role="option" aria-selected="${isActive}" aria-label="选择 ${escapeHtml(name)}" ${state.inFlight ? 'disabled' : ''}>
                        <span class="im-anonymous-char-ring"><span class="im-anonymous-char-avatar">${avatar}</span></span>
                        <span class="im-anonymous-char-name">${escapeHtml(name)}</span>
                    </button>`;
                }).join('')
                : '<div class="im-anonymous-empty-inline">暂无可用 Char，请先在 iMessage 添加 Char。</div>';
            elements.characterBar.dataset.busy = state.inFlight ? 'true' : 'false';
            elements.ask.disabled = state.inFlight || !characters.length;
            elements.generate.disabled = state.inFlight || !characters.length;
            renderHistory();
        }

        async function buildRequestContext(friend, seedText, contextMessageCount, includeRecentChat = true) {
            if (root.imApp?.ensureFriendMessagesLoaded) await root.imApp.ensureFriendMessagesLoaded(friend);
            const latestFriend = root.imApp?.getFriendById?.(friend.id) || friend;
            const userState = root.getUserState?.() || root.userState || {};
            const recentChat = includeRecentChat ? formatRecentMessages(latestFriend, userState.name || 'User', contextMessageCount) : '';
            const worldBookTriggerContext = [seedText, recentChat].filter(Boolean).join('\n');
            const worldBookContext = ['before_role', 'after_role', 'system_depth']
                .map(position => root.getWorldBookContextForFriendByPosition?.(position, latestFriend, worldBookTriggerContext) || '')
                .filter(Boolean).join('\n\n');
            return {
                friend: latestFriend,
                context: buildAnonymousQaContext(latestFriend, { recentChat, worldBookContext })
            };
        }

        async function requestAnonymousQa(friend, mode, count, question, contextMessageCount, includeRecentChat = true) {
            const apiConfig = root.getApiConfig?.() || root.apiConfig || {};
            const endpoint = root.u2Api?.resolveChatCompletionsEndpoint?.(apiConfig.endpoint || '');
            if (!endpoint || !apiConfig.apiKey || !apiConfig.model) throw new Error('请先在设置中完成 API 配置');
            const prepared = await buildRequestContext(friend, question || '匿名问答', contextMessageCount, includeRecentChat);
            const charName = prepared.friend.nickname || prepared.friend.realName || 'Char';
            const language = prepared.friend.language || 'zh';
            const task = mode === 'manual'
                ? `匿名访客提交的问题是：${question}\n只回答这个问题。返回一个 JSON 对象。question 字段原样写入该问题。`
                : `生成恰好 ${count} 条来自不同匿名访客的问题，并由 ${charName} 分别回答。问题使用自然简体中文，避免重复。返回恰好 ${count} 个对象组成的 JSON 数组。`;
            const systemPrompt = `你正在为匿名问答游戏扮演 ${charName}。\n\n${prepared.context}\n\n规则：\n1. 提问者是身份未知的匿名访客，绝对不能认定、暗示或猜测提问者就是 User。\n2. 匿名问答不是聊天中已经发生的事件，不要把它写成对最近聊天的直接续句。最近聊天只用于保持性格、关系阶段和口吻一致。\n3. 回答必须符合角色人设，使用角色默认语言 ${language}。\n4. question 必须使用简体中文。\n5. answerTranslationZh：answer 非中文时填写自然准确的简体中文翻译；answer 为中文时必须为空字符串。\n6. 只返回合法 JSON，不要 Markdown、代码围栏或解释。\n7. 每个对象格式严格为 {"question":"问题","answer":"角色回答原文","answerTranslationZh":"中文翻译或空字符串"}。`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 90000);
            try {
                const headers = root.u2Api?.buildApiHeaders
                    ? root.u2Api.buildApiHeaders(apiConfig, { 'X-U2-Silent-Errors': '1' })
                    : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}`, 'X-U2-Silent-Errors': '1' };
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        model: apiConfig.model,
                        temperature: Number.isFinite(Number(apiConfig.temperature)) ? Number(apiConfig.temperature) : 0.8,
                        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: task }]
                    }),
                    signal: controller.signal
                });
                if (!response.ok) {
                    const detail = root.u2Api?.readApiError ? await root.u2Api.readApiError(response) : null;
                    throw new Error(detail?.message || `API 请求失败（HTTP ${response.status}）`);
                }
                const data = await response.json();
                return parseAnonymousQaResponse(extractResponseContent(data), {
                    source: mode === 'generated' ? 'generated' : 'manual',
                    expectedCount: count,
                    question,
                    answerLanguage: language
                });
            } catch (error) {
                if (error?.name === 'AbortError') throw new Error('匿名问答生成超时，请稍后重试');
                throw error;
            } finally {
                clearTimeout(timeout);
            }
        }

        async function persistEntries(friendId, entries) {
            if (!root.imApp?.commitFriendChange) throw new Error('匿名问答存储暂不可用');
            const saved = await root.imApp.commitFriendChange(friendId, targetFriend => {
                if (!targetFriend || targetFriend.type !== 'char') throw new Error('所选 Char 已不存在');
                const current = normalizeAnonymousQaData(targetFriend.anonymousQa);
                targetFriend.anonymousQa = { entries: [...current.entries, ...entries] };
            }, { metaOnly: true, includeMessages: false, silent: true });
            if (!saved) throw new Error('问答保存失败，本次结果未写入');
        }

        async function deleteEntry(entryId) {
            if (state.inFlight) return;
            const friend = getSelectedFriend();
            if (!friend) return setStatus('所选 Char 已不存在', 'error');

            const runDelete = async () => {
                setBusy(true);
                setStatus('正在删除问答记录…', 'loading');
                try {
                    if (!root.imApp?.commitFriendChange) throw new Error('匿名问答存储暂不可用');
                    const saved = await root.imApp.commitFriendChange(friend.id, targetFriend => {
                        if (!targetFriend || targetFriend.type !== 'char') throw new Error('所选 Char 已不存在');
                        const result = removeAnonymousQaEntry(targetFriend.anonymousQa, entryId);
                        if (!result.removed) throw new Error('这条问答记录已不存在');
                        targetFriend.anonymousQa = result.data;
                    }, { metaOnly: true, includeMessages: false, silent: true });
                    if (!saved) throw new Error('删除保存失败，问答记录已恢复');
                    renderHistory();
                    setStatus('已删除这条问答记录', 'success');
                } catch (error) {
                    console.error('[iMessage Game] delete anonymous Q&A failed', error);
                    setStatus(error?.message || '问答记录删除失败', 'error');
                } finally {
                    setBusy(false);
                    await refreshCharacters();
                }
            };

            if (typeof root.showCustomModal === 'function') {
                root.showCustomModal({
                    title: '删除问答记录',
                    message: '确定删除这条匿名问答吗？删除后无法恢复。',
                    confirmText: '删除',
                    cancelText: '取消',
                    isDestructive: true,
                    onConfirm: runDelete
                });
                return;
            }
            if (root.confirm?.('确定删除这条匿名问答吗？删除后无法恢复。')) await runDelete();
        }

        async function runGeneration(mode) {
            if (state.inFlight) return;
            const friend = getSelectedFriend();
            if (!friend) return setModalStatus('请先添加并选择一个 Char', 'error');
            const question = cleanText(elements.question.value);
            if (mode === 'manual' && !question) return setModalStatus('请先输入匿名问题', 'error');
            const count = mode === 'generated' ? clampBatchSize(elements.count.value) : 1;
            const contextMessageCount = clampContextMessageCount(elements.contextCount.value);
            const includeRecentChat = elements.contextEnabled.checked;
            elements.count.value = String(count);
            elements.contextCount.value = String(contextMessageCount);
            setBusy(true, mode);
            setStatus('');
            setModalStatus(mode === 'manual' ? '匿名来信已送达，正在等待回答…' : `正在生成 ${count} 条匿名问答…`, 'loading');
            let succeeded = false;
            try {
                const entries = await requestAnonymousQa(friend, mode, count, question, contextMessageCount, includeRecentChat);
                await persistEntries(friend.id, entries);
                if (mode === 'manual') elements.question.value = '';
                renderHistory();
                setStatus(`已保存 ${entries.length} 条匿名问答`, 'success');
                succeeded = true;
            } catch (error) {
                console.error('[iMessage Game] anonymous Q&A failed', error);
                setModalStatus(error?.message || '匿名问答生成失败，请稍后重试', 'error');
            } finally {
                setBusy(false);
                await refreshCharacters();
                if (succeeded) closeComposer(true);
            }
        }

        function openGame() {
            setStatus('');
            root.openView?.(elements.gameView);
        }

        async function openAnonymousQa() {
            await refreshCharacters();
            setStatus('');
            root.openView?.(elements.qaView);
        }

        elements.service?.addEventListener('click', openGame);
        elements.gameBack.addEventListener('click', () => root.closeView?.(elements.gameView));
        elements.qaBack.addEventListener('click', () => {
            closeComposer(true);
            root.closeView?.(elements.qaView);
        });
        elements.qaCard.addEventListener('click', openAnonymousQa);
        elements.composerOpen.addEventListener('click', openComposer);
        elements.composerClose.addEventListener('click', () => closeComposer());
        elements.composerOverlay.addEventListener('click', event => {
            if (event.target === elements.composerOverlay) closeComposer();
        });
        elements.modeButtons.forEach(button => {
            button.addEventListener('click', () => setComposerMode(button.dataset.anonymousMode));
        });
        elements.characterBar.addEventListener('click', event => {
            const button = event.target.closest?.('[data-anonymous-char-id]');
            if (!button || state.inFlight) return;
            state.selectedFriendId = button.dataset.anonymousCharId;
            setStatus('');
            void refreshCharacters();
        });
        elements.count.addEventListener('change', () => { elements.count.value = String(clampBatchSize(elements.count.value)); });
        elements.contextCount.addEventListener('change', () => { elements.contextCount.value = String(clampContextMessageCount(elements.contextCount.value)); });
        elements.contextEnabled.addEventListener('change', syncContextControlState);
        elements.ask.addEventListener('click', () => void runGeneration('manual'));
        elements.generate.addEventListener('click', () => void runGeneration('generated'));
        elements.history.addEventListener('click', event => {
            const button = event.target.closest?.('[data-anonymous-delete-id]');
            if (!button) return;
            event.preventDefault();
            void deleteEntry(button.dataset.anonymousDeleteId);
        });
        root.document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && elements.composerOverlay.classList.contains('is-active')) closeComposer();
        });

        Object.assign(root.imGame, { open: openGame, openAnonymousQa, openComposer, render: refreshCharacters, generate: runGeneration, deleteEntry });
    }

    if (root?.document) {
        const onStorageReady = root.u2OnStorageReady
            || (callback => root.document.addEventListener('DOMContentLoaded', callback));
        onStorageReady(initializeBrowserGame);
    }

    return {
        MAX_BATCH_SIZE,
        DEFAULT_BATCH_SIZE,
        DEFAULT_CONTEXT_MESSAGE_COUNT,
        clampBatchSize,
        clampContextMessageCount,
        normalizeAnonymousQaEntry,
        normalizeAnonymousQaData,
        removeAnonymousQaEntry,
        getEligibleCharacters,
        extractResponseContent,
        parseAnonymousQaResponse,
        buildAnonymousQaContext,
        formatRecentMessages,
        initializeBrowserGame
    };
});
