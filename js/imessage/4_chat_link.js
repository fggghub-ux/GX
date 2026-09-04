// ==========================================
// IMESSAGE: lightweight AI link theatre
// ==========================================
(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    window.imChat = window.imChat || {};
    const imChat = window.imChat;

    const FAKE_LINK_CONTEXT_OPTIONS_KEY = 'u2_fakeLinkAiContextOptions';
    const FAKE_LINK_RANDOM_IMAGE_HOST = 'picsum.photos';
    const DEFAULT_RECENT_CONTEXT_LIMIT = 10;
    const MAX_RECENT_CONTEXT_LIMIT = 50;
    const fakeLinkSessions = new Map();

    function cleanText(value, maxLength = 50000) {
        return String(value == null ? '' : value)
            .replace(/\u0000/g, '')
            .trim()
            .slice(0, maxLength);
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function stripHtmlToPlainText(value, maxLength = 20000) {
        return cleanText(value, 50000)
            .replace(/<\s*(script|style|iframe|object|embed|svg|canvas)[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#039;/gi, "'")
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, maxLength);
    }

    function hashFakeLinkSeed(value) {
        const text = String(value == null ? '' : value);
        let hash = 2166136261;
        for (let i = 0; i < text.length; i += 1) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
    }

    function buildRandomFakeLinkImageUrl(seedParts = [], index = 0, width = 900, height = 600) {
        const seed = hashFakeLinkSeed([].concat(seedParts, index).join('|')) || 'u2';
        return `https://${FAKE_LINK_RANDOM_IMAGE_HOST}/seed/u2-${seed}-${index}/${width}/${height}`;
    }

    function isAllowedFakeLinkImageUrl(value) {
        try {
            const parsed = new URL(String(value || ''));
            return parsed.protocol === 'https:' && parsed.hostname === FAKE_LINK_RANDOM_IMAGE_HOST;
        } catch (_) {
            return false;
        }
    }

    function injectRandomFakeLinkImages(html, options = {}) {
        const sourceHtml = cleanText(html, 20000);
        if (!sourceHtml) return '';
        const seedParts = [
            cleanText(options.domain || '', 180),
            cleanText(options.prompt || '', 1000),
            cleanText(options.siteName || '', 80)
        ];
        let imageIndex = 0;
        return sourceHtml.replace(/<img\b([^>]*)>/gi, (match, attrs = '') => {
            const srcMatch = String(attrs).match(/\s+src\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i);
            const currentSrc = srcMatch ? srcMatch[1].replace(/^['"]|['"]$/g, '') : '';
            const nextSrc = isAllowedFakeLinkImageUrl(currentSrc)
                ? currentSrc
                : buildRandomFakeLinkImageUrl(seedParts, imageIndex);
            imageIndex += 1;
            let nextAttrs = String(attrs)
                .replace(/\s+src\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/ig, '')
                .replace(/\s+srcset\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/ig, '')
                .replace(/\s+loading\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/ig, '');
            if (!/\salt\s*=/i.test(nextAttrs)) nextAttrs += ' alt=""';
            return `<img${nextAttrs} src="${escapeHtml(nextSrc)}" loading="lazy">`;
        });
    }

    function normalizeRecentContextLimit(value) {
        const parsed = Math.round(Number(value) || DEFAULT_RECENT_CONTEXT_LIMIT);
        return Math.min(MAX_RECENT_CONTEXT_LIMIT, Math.max(1, parsed));
    }

    function loadFakeLinkContextOptions() {
        const fallback = {
            includeCharPersona: false,
            includeUserPersona: false,
            includeRecentContext: false,
            recentContextLimit: DEFAULT_RECENT_CONTEXT_LIMIT
        };
        try {
            const loaded = window.StorageManager && typeof window.StorageManager.load === 'function'
                ? window.StorageManager.load(FAKE_LINK_CONTEXT_OPTIONS_KEY, fallback)
                : null;
            return {
                includeCharPersona: !!loaded?.includeCharPersona,
                includeUserPersona: !!loaded?.includeUserPersona,
                includeRecentContext: !!loaded?.includeRecentContext,
                recentContextLimit: normalizeRecentContextLimit(loaded?.recentContextLimit)
            };
        } catch (_) {
            return fallback;
        }
    }

    function saveFakeLinkContextOptions(options = {}) {
        const normalized = {
            includeCharPersona: !!options.includeCharPersona,
            includeUserPersona: !!options.includeUserPersona,
            includeRecentContext: !!options.includeRecentContext,
            recentContextLimit: normalizeRecentContextLimit(options.recentContextLimit)
        };
        try {
            if (window.StorageManager && typeof window.StorageManager.save === 'function') {
                window.StorageManager.save(FAKE_LINK_CONTEXT_OPTIONS_KEY, normalized);
            }
        } catch (_) {}
        return normalized;
    }

    function getFakeLinkAppContainer() {
        return document.getElementById('app') || document.body;
    }

    function focusFakeLinkControl(element) {
        if (!element || typeof element.focus !== 'function') return;
        try {
            element.focus({ preventScroll: true });
        } catch (_) {
            element.focus();
        }
    }

    function resolveFakeLinkWorldBookContext(friend, contextText = '') {
        const positions = ['system_depth', 'before_role', 'after_role'];
        const sections = [];
        positions.forEach((position) => {
            let text = '';
            if (friend && window.imApp?.getWorldBookContextForFriendByPosition) {
                text = window.imApp.getWorldBookContextForFriendByPosition(position, friend, contextText) || '';
            } else if (window.getGlobalWorldBookContextByPosition) {
                text = window.getGlobalWorldBookContextByPosition(position, contextText) || '';
            }
            if (text) sections.push(`${position}:\n${text}`);
        });
        return cleanText(sections.join('\n\n'), 6000);
    }

    function resolveFakeLinkCharPersona(friend) {
        if (!friend || typeof friend !== 'object') return '';
        const name = friend.realName || friend.nickname || friend.name || 'Char';
        const persona = cleanText(friend.persona || friend.signature || friend.description || '', 2000);
        return persona ? `Char name: ${name}\nChar persona:\n${persona}` : '';
    }

    function resolveFakeLinkUserPersona(friend) {
        const user = window.getUserState ? window.getUserState() : (window.userState || {});
        const name = user.name || user.realName || 'User';
        const persona = cleanText(
            (window.imApp?.getEffectivePersonaForFriend ? window.imApp.getEffectivePersonaForFriend(friend) : '')
                || user.persona
                || user.signature
                || '',
            2000
        );
        return persona ? `User name: ${name}\nUser persona:\n${persona}` : '';
    }

    function resolveFakeLinkRecentChatContext(friend, limit = DEFAULT_RECENT_CONTEXT_LIMIT) {
        if (!friend || typeof friend !== 'object') return '';
        const safeLimit = normalizeRecentContextLimit(limit);
        const messages = (Array.isArray(friend.messages) ? friend.messages : [])
            .filter(message => message && (message.role === 'user' || message.role === 'assistant'))
            .slice(-safeLimit);
        let totalLength = 0;
        const lines = [];
        messages.forEach((message) => {
            let role = message.role === 'assistant' ? 'Char' : 'User';
            let content = '';
            if (window.imApp?.formatMessageForApiContext) {
                const formatted = window.imApp.formatMessageForApiContext(message, friend, {
                    userName: window.getUserState?.()?.name || 'User',
                    expandLinkContent: false,
                    maxLinkBodyChars: 400
                });
                if (formatted?.role === 'assistant') role = 'Char';
                if (formatted?.role === 'user') role = 'User';
                content = formatted?.content || '';
            }
            if (!content) {
                content = message.text || message.content || message.fakeLinkData?.summary || '';
            }
            const remaining = 4000 - totalLength;
            if (remaining <= 0) return;
            const line = `${role}: ${cleanText(content, Math.min(400, remaining))}`;
            if (!line.replace(/^(User|Char):\s*$/, '').trim()) return;
            lines.push(line);
            totalLength += line.length + 1;
        });
        return cleanText(lines.join('\n'), 4000);
    }

    function normalizeFakeLinkInput(value) {
        const raw = cleanText(value, 220);
        if (!raw || /[\u0000-\u001F\u007F]/.test(raw) || /[\s<>"'\x60\\]/.test(raw)) return null;
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https?:\/\//i.test(raw)) return null;
        const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        try {
            const parsed = new URL(candidate);
            if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return null;
            const domain = parsed.hostname.toLowerCase();
            const path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
            const search = parsed.search || '';
            const displayUrl = `${domain}${path}${search}`.replace(/\/+$/, '');
            if (!displayUrl || displayUrl.length > 180) return null;
            return {
                domain,
                path,
                search,
                displayUrl,
                canonicalUrl: `https://${displayUrl}`
            };
        } catch (_) {
            return null;
        }
    }

    function normalizeFakeLinkDomain(value) {
        return normalizeFakeLinkInput(value)?.displayUrl || '';
    }

    function resolveChatCompletionsEndpoint(config = {}) {
        const endpoint = String(config.endpoint || '').trim();
        return endpoint ? window.u2Api.resolveChatCompletionsEndpoint(endpoint) : '';
    }

    function extractJsonObject(text) {
        const raw = String(text || '').trim();
        if (!raw) return null;
        const fenced = raw.match(/\x60\x60\x60(?:json)?\s*([\s\S]*?)\x60\x60\x60/i);
        const candidate = fenced ? fenced[1].trim() : raw;
        try {
            return JSON.parse(candidate);
        } catch (_) {
            const start = candidate.indexOf('{');
            const end = candidate.lastIndexOf('}');
            if (start >= 0 && end > start) {
                try {
                    return JSON.parse(candidate.slice(start, end + 1));
                } catch (_) {}
            }
        }
        return null;
    }

    function sanitizeFakeLinkHtmlForStorage(value) {
        return cleanText(value, 20000)
            .replace(/<\s*(script|style|iframe|object|embed|link|meta|base)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
            .replace(/<\s*\/?\s*(script|style|iframe|object|embed|link|meta|base)[^>]*>/gi, '')
            .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
            .replace(/\s+(href|action|formaction)\s*=\s*("https?:[^"]*"|'https?:[^']*'|https?:[^\s>]+)/gi, '')
            .slice(0, 20000);
    }

    function sanitizeFakeLinkCssForStorage(value) {
        return cleanText(value, 16000)
            .replace(/@import[^;]+;/gi, '')
            .replace(/url\s*\([^)]*\)/gi, 'none')
            .replace(/expression\s*\([^)]*\)/gi, '')
            .replace(/javascript\s*:/gi, '')
            .replace(/behavior\s*:/gi, '')
            .replace(/-moz-binding\s*:/gi, '')
            .slice(0, 16000);
    }

    function sanitizeFakeLinkJsForStorage(value) {
        return cleanText(value, 12000)
            .replace(/<\/script/gi, '<\\/script')
            .slice(0, 12000);
    }

    function normalizeFakeLinkWebPage(source = {}, fallback = {}) {
        const safeSource = source && typeof source === 'object' ? source : {};
        const html = sanitizeFakeLinkHtmlForStorage(injectRandomFakeLinkImages(safeSource.html || '', {
            domain: fallback.domain || '',
            prompt: fallback.prompt || '',
            siteName: fallback.siteName || ''
        }));
        return {
            html,
            css: sanitizeFakeLinkCssForStorage(safeSource.css || ''),
            js: sanitizeFakeLinkJsForStorage(safeSource.js || ''),
            source: cleanText(safeSource.source || fallback.source || 'ai', 30) || 'ai'
        };
    }

    function buildFakeLinkSandboxDocument(webPage = {}) {
        const page = normalizeFakeLinkWebPage(webPage);
        const safeCss = page.css.replace(/<\/style/gi, '<\\/style');
        const safeJs = page.js.replace(/<\/script/gi, '<\\/script');
        const csp = [
            "default-src 'none'",
            "img-src https://picsum.photos data:",
            "style-src 'unsafe-inline'",
            "script-src 'unsafe-inline'",
            "connect-src 'none'",
            "font-src data:",
            "media-src 'none'",
            "object-src 'none'",
            "base-uri 'none'",
            "form-action 'none'"
        ].join('; ');
        return [
            '<!doctype html>',
            '<html><head><meta charset="utf-8">',
            `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">`,
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
            '<style>html,body{margin:0;min-height:100%;overflow-x:hidden}*,*::before,*::after{box-sizing:border-box}button,input,textarea,select{font:inherit}</style>',
            `<style>${safeCss}</style>`,
            '</head><body>',
            page.html,
            `<script>"use strict";${safeJs}</script>`,
            '</body></html>'
        ].join('');
    }

    function buildFakeLinkPrompt({
        domain,
        prompt,
        worldBookContext = '',
        charPersonaContext = '',
        userPersonaContext = '',
        recentChatContext = '',
        includeCharPersona = false,
        includeUserPersona = false,
        includeRecentContext = false
    }) {
        const contextLines = [
            '',
            '世界书上下文（只用于保持设定一致；为空则忽略）：',
            worldBookContext || '无'
        ];
        if (includeCharPersona && charPersonaContext) {
            contextLines.push('', 'Char 人设：', charPersonaContext);
        }
        if (includeUserPersona && userPersonaContext) {
            contextLines.push('', 'User 人设：', userPersonaContext);
        }
        if (includeRecentContext && recentChatContext) {
            contextLines.push('', '最近聊天上下文（把网页写成当前关系和剧情里自然出现的小剧场，不要逐句复述）：', recentChatContext);
        }
        return [
            '你正在为站内 iMessage 的“链接小剧场”生成一个虚构但可信、可交互的网页。',
            '不要访问或声称读取真实网站；只根据域名、用户提示和提供的设定创作。',
            '只返回合法 JSON，不要 Markdown、代码围栏、注释或解释。',
            'JSON 顶层字段固定为：',
            '{"siteName":"站点名","title":"聊天卡片标题","summary":"聊天卡片摘要","webPage":{"html":"页面主体HTML片段","css":"页面CSS","js":"页面原生JavaScript"}}',
            'html、css、js 三个字段都必须是非空字符串。html 不要包含 html/head/body/style/script 外壳。',
            '页面应像一个完整的小剧场：内容与当前人物、关系或情境自然相关，并包含 1-3 个有意义的交互。',
            'JavaScript 必须是无需外部库即可运行的原生 JS；通过 DOM 查询绑定按钮、切换、计数、动画或面板。',
            '禁止 fetch、XMLHttpRequest、WebSocket、外链、登录、支付、账号密码采集、弹窗和父页面访问。',
            '不要使用 localStorage、sessionStorage、indexedDB、window.parent、window.top、window.opener 或 postMessage。',
            '代码保持紧凑：HTML 目标不超过 8KB，CSS 不超过 6KB，JS 不超过 4KB；不要大型网站、多页路由或框架。',
            '图片位置必须输出 <img>；src 可以留空或使用 https://picsum.photos/seed/...，系统会替换其他图片地址。',
            '',
            `域名：${domain}`,
            `用户提示：${prompt || '生成一个与当前聊天情境自然相关、可读、精致且可交互的链接小剧场。'}`
        ].concat(contextLines).join('\n');
    }

    async function requestFakeLinkAiContent({
        domain,
        prompt,
        friend = null,
        includeCharPersona = false,
        includeUserPersona = false,
        includeRecentContext = false,
        recentContextLimit = DEFAULT_RECENT_CONTEXT_LIMIT
    }) {
        const api = window.getApiConfig ? window.getApiConfig() : (window.apiConfig || {});
        const endpoint = resolveChatCompletionsEndpoint(api);
        if (!endpoint || !api.apiKey || !api.model) throw new Error('API_NOT_CONFIGURED');

        const contextText = [domain, prompt || ''].filter(Boolean).join('\n');
        const worldBookContext = resolveFakeLinkWorldBookContext(friend, contextText);
        const charPersonaContext = includeCharPersona ? resolveFakeLinkCharPersona(friend) : '';
        const userPersonaContext = includeUserPersona ? resolveFakeLinkUserPersona(friend) : '';
        const recentChatContext = includeRecentContext
            ? resolveFakeLinkRecentChatContext(friend, recentContextLimit)
            : '';
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${api.apiKey}`,
                'X-U2-Silent-Errors': '1'
            },
            body: JSON.stringify({
                model: api.model,
                temperature: Number.isFinite(Number(api.temperature)) ? Number(api.temperature) : 0.72,
                messages: [
                    {
                        role: 'system',
                        content: '你是轻量交互网页生成器。只输出严格 JSON，并生成紧凑、无依赖的 HTML、CSS 和 JavaScript。'
                    },
                    {
                        role: 'user',
                        content: buildFakeLinkPrompt({
                            domain,
                            prompt,
                            worldBookContext,
                            charPersonaContext,
                            userPersonaContext,
                            recentChatContext,
                            includeCharPersona,
                            includeUserPersona,
                            includeRecentContext
                        })
                    }
                ]
            })
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload) throw new Error(`HTTP_${response.status}`);
        const text = payload.choices?.[0]?.message?.content || payload.choices?.[0]?.text || '';
        const parsed = extractJsonObject(text);
        if (!parsed || typeof parsed !== 'object') throw new Error('INVALID_JSON');

        const siteName = cleanText(parsed.siteName, 80);
        const title = cleanText(parsed.title, 180);
        const summary = cleanText(parsed.summary, 800);
        const webPage = normalizeFakeLinkWebPage(parsed.webPage, {
            source: 'ai',
            domain,
            prompt,
            siteName
        });
        if (!siteName || !title || !webPage.html || !webPage.css || !webPage.js) {
            throw new Error('INVALID_PAGE_PACKAGE');
        }
        return {
            siteName,
            title,
            summary,
            bodyText: stripHtmlToPlainText(webPage.html, 20000),
            webPage
        };
    }

    function createEmptySession(friendId) {
        const options = loadFakeLinkContextOptions();
        return {
            friendId: String(friendId),
            domainInput: '',
            promptInput: '',
            ...options,
            status: 'idle',
            generatedData: null,
            errorMessage: '',
            promise: null,
            sending: false
        };
    }

    function getFakeLinkSession(friendId) {
        const key = String(friendId || '');
        if (!fakeLinkSessions.has(key)) fakeLinkSessions.set(key, createEmptySession(key));
        return fakeLinkSessions.get(key);
    }

    function createPreviewIframe(webPage, className) {
        const frame = document.createElement('iframe');
        frame.className = className;
        frame.setAttribute('sandbox', 'allow-scripts');
        frame.setAttribute('referrerpolicy', 'no-referrer');
        frame.setAttribute('title', 'AI 生成的链接小剧场预览');
        frame.srcdoc = buildFakeLinkSandboxDocument(webPage);
        return frame;
    }

    function createFakeLinkComposer(page) {
        const host = getFakeLinkAppContainer();
        let overlay = document.getElementById('im-fake-link-composer-overlay');
        if (overlay) {
            if (overlay.parentNode !== host) host.appendChild(overlay);
            overlay._imFakeLinkPage = page;
            return overlay;
        }

        overlay = document.createElement('div');
        overlay.id = 'im-fake-link-composer-overlay';
        overlay.className = 'im-fake-link-composer-overlay';
        overlay.innerHTML = [
            '<div class="im-fake-link-composer-backdrop"></div>',
            '<section class="im-fake-link-composer-card" role="dialog" aria-modal="true" aria-label="发送链接">',
            '  <header class="im-fake-link-composer-header">',
            '    <button type="button" class="im-fake-link-composer-close" aria-label="关闭"><i class="fas fa-times"></i></button>',
            '    <strong>链接小剧场</strong>',
            '    <span></span>',
            '  </header>',
            '  <div class="im-fake-link-composer-body">',
            '    <label class="im-fake-link-field"><span>域名 / 地址</span><input class="im-fake-link-ai-domain-input" type="text" inputmode="url" autocomplete="off" placeholder="example.com/story"></label>',
            '    <label class="im-fake-link-field"><span>生成提示</span><textarea class="im-fake-link-ai-prompt-input" rows="4" placeholder="例如：生成一个和当前聊天剧情有关的互动网页，包含角色会看到的内容和自然的小互动"></textarea></label>',
            '    <div class="im-fake-link-context-options">',
            '      <label class="im-fake-link-context-toggle"><input class="im-fake-link-char-persona-toggle" type="checkbox"><span>挂载 Char 人设</span></label>',
            '      <label class="im-fake-link-context-toggle"><input class="im-fake-link-user-persona-toggle" type="checkbox"><span>挂载 User 人设</span></label>',
            '      <div class="im-fake-link-context-row">',
            '        <label class="im-fake-link-context-toggle"><input class="im-fake-link-recent-context-toggle" type="checkbox"><span>挂载最近聊天上下文</span></label>',
            '        <label class="im-fake-link-context-limit"><input class="im-fake-link-context-limit-input" type="number" min="1" max="50" value="10" inputmode="numeric"><span>条</span></label>',
            '      </div>',
            '    </div>',
            '    <div class="im-fake-link-generation-row">',
            '      <button type="button" class="im-fake-link-generate-btn" aria-label="调用 API 生成网页" title="调用 API 生成网页"><i class="fas fa-search"></i></button>',
            '      <span class="im-fake-link-status">填写地址和提示后生成链接小剧场</span>',
            '    </div>',
            '    <div class="im-fake-link-web-mini-preview" hidden>',
            '      <div class="im-fake-link-web-mini-label">生成结果</div>',
            '      <div class="im-fake-link-web-mini-frame"></div>',
            '    </div>',
            '  </div>',
            '  <footer class="im-fake-link-composer-actions">',
            '    <button type="button" class="im-fake-link-composer-cancel">取消</button>',
            '    <button type="button" class="im-fake-link-composer-send">发送</button>',
            '  </footer>',
            '</section>'
        ].join('');
        host.appendChild(overlay);
        overlay._imFakeLinkPage = page;

        const domainInput = overlay.querySelector('.im-fake-link-ai-domain-input');
        const promptInput = overlay.querySelector('.im-fake-link-ai-prompt-input');
        const includeCharPersonaInput = overlay.querySelector('.im-fake-link-char-persona-toggle');
        const includeUserPersonaInput = overlay.querySelector('.im-fake-link-user-persona-toggle');
        const includeRecentContextInput = overlay.querySelector('.im-fake-link-recent-context-toggle');
        const recentContextLimitInput = overlay.querySelector('.im-fake-link-context-limit-input');
        const generateButton = overlay.querySelector('.im-fake-link-generate-btn');
        const statusText = overlay.querySelector('.im-fake-link-status');
        const preview = overlay.querySelector('.im-fake-link-web-mini-preview');
        const previewFrame = overlay.querySelector('.im-fake-link-web-mini-frame');
        const closeButton = overlay.querySelector('.im-fake-link-composer-close');
        const cancelButton = overlay.querySelector('.im-fake-link-composer-cancel');
        const sendButton = overlay.querySelector('.im-fake-link-composer-send');
        const backdrop = overlay.querySelector('.im-fake-link-composer-backdrop');
        const editableControls = [
            domainInput,
            promptInput,
            includeCharPersonaInput,
            includeUserPersonaInput,
            includeRecentContextInput,
            recentContextLimitInput
        ];

        function getCurrentSession() {
            return getFakeLinkSession(overlay._imFakeLinkFriendId);
        }

        function setGenerateButtonLoading(isLoading) {
            const icon = generateButton.querySelector('i');
            if (icon) icon.className = isLoading ? 'fas fa-spinner fa-spin' : 'fas fa-search';
            generateButton.setAttribute('aria-busy', String(!!isLoading));
        }

        function setStatus(message, tone = 'idle') {
            statusText.textContent = message || '';
            statusText.dataset.status = tone;
        }

        function syncSessionFromInputs({ invalidate = true } = {}) {
            const session = getCurrentSession();
            if (session.status === 'generating') return session;
            session.domainInput = domainInput.value;
            session.promptInput = promptInput.value;
            session.includeCharPersona = !!includeCharPersonaInput.checked;
            session.includeUserPersona = !!includeUserPersonaInput.checked;
            session.includeRecentContext = !!includeRecentContextInput.checked;
            session.recentContextLimit = normalizeRecentContextLimit(recentContextLimitInput.value);
            recentContextLimitInput.value = String(session.recentContextLimit);
            saveFakeLinkContextOptions(session);
            if (invalidate && session.generatedData) {
                session.generatedData = null;
                session.status = 'idle';
                session.errorMessage = '';
            }
            return session;
        }

        function renderComposerState() {
            const session = getCurrentSession();
            const generating = session.status === 'generating';
            editableControls.forEach(control => {
                control.disabled = generating;
            });
            recentContextLimitInput.disabled = generating || !includeRecentContextInput.checked;
            generateButton.disabled = generating;
            sendButton.disabled = generating || session.status !== 'ready' || !session.generatedData;
            setGenerateButtonLoading(generating);

            preview.hidden = session.status !== 'ready' || !session.generatedData?.webPage;
            previewFrame.innerHTML = '';
            if (!preview.hidden) {
                previewFrame.appendChild(createPreviewIframe(
                    session.generatedData.webPage,
                    'im-fake-link-preview-iframe'
                ));
            }

            if (session.status === 'generating') {
                setStatus('AI 正在生成链接小剧场，退出此界面也会继续…', 'loading');
            } else if (session.status === 'ready') {
                setStatus('生成完成，可以预览或发送', 'ready');
            } else if (session.status === 'error') {
                setStatus(session.errorMessage || '生成失败，请重试', 'error');
            } else {
                setStatus('填写地址和提示后生成链接小剧场', 'idle');
            }
        }

        function loadSessionIntoInputs(session) {
            domainInput.value = session.domainInput || '';
            promptInput.value = session.promptInput || '';
            includeCharPersonaInput.checked = !!session.includeCharPersona;
            includeUserPersonaInput.checked = !!session.includeUserPersona;
            includeRecentContextInput.checked = !!session.includeRecentContext;
            recentContextLimitInput.value = String(normalizeRecentContextLimit(session.recentContextLimit));
            renderComposerState();
        }

        function closeComposer() {
            const activeElement = document.activeElement;
            if (activeElement && overlay.contains(activeElement) && typeof activeElement.blur === 'function') {
                activeElement.blur();
            }
            overlay.classList.remove('active');
            setTimeout(() => {
                if (!overlay.classList.contains('active')) overlay.style.display = 'none';
            }, 220);
        }

        async function generateContent() {
            const session = syncSessionFromInputs({ invalidate: true });
            const normalized = normalizeFakeLinkInput(session.domainInput);
            if (!normalized) {
                session.status = 'error';
                session.errorMessage = '请先输入有效域名或 http/https 地址';
                renderComposerState();
                focusFakeLinkControl(domainInput);
                return;
            }
            if (session.status === 'generating') return;

            const friendId = String(overlay._imFakeLinkFriendId || '');
            const friend = (window.imData?.friends || []).find(item => String(item.id) === friendId)
                || window.imData?.currentActiveFriend
                || null;
            session.domainInput = normalized.displayUrl;
            domainInput.value = normalized.displayUrl;
            session.status = 'generating';
            session.generatedData = null;
            session.errorMessage = '';
            const request = requestFakeLinkAiContent({
                domain: normalized.displayUrl,
                prompt: cleanText(session.promptInput, 1000),
                friend,
                includeCharPersona: session.includeCharPersona,
                includeUserPersona: session.includeUserPersona,
                includeRecentContext: session.includeRecentContext,
                recentContextLimit: session.recentContextLimit
            });
            session.promise = request;
            renderComposerState();

            try {
                const generated = await request;
                if (session.promise !== request) return;
                session.generatedData = {
                    ...generated,
                    siteName: generated.siteName || normalized.domain,
                    title: generated.title || normalized.domain,
                    webPage: normalizeFakeLinkWebPage(generated.webPage, {
                        source: 'ai',
                        domain: normalized.displayUrl,
                        prompt: session.promptInput,
                        siteName: generated.siteName || normalized.domain
                    })
                };
                session.status = 'ready';
                session.errorMessage = '';
                const visibleHere = overlay.classList.contains('active')
                    && String(overlay._imFakeLinkFriendId) === friendId;
                if (!visibleHere && window.showToast) window.showToast('链接小剧场已生成');
            } catch (error) {
                if (session.promise !== request) return;
                console.warn('[iMessage fake link] AI generation failed', error);
                session.status = 'error';
                session.errorMessage = error?.message === 'API_NOT_CONFIGURED'
                    ? '未配置 API，请到设置中填写后再生成'
                    : (error?.message === 'INVALID_PAGE_PACKAGE'
                        ? 'AI 返回的网页代码不完整，请重试'
                        : 'AI 生成失败，请重试');
                if (window.showToast) window.showToast(session.errorMessage);
            } finally {
                if (session.promise === request) session.promise = null;
                if (String(overlay._imFakeLinkFriendId) === friendId) renderComposerState();
            }
        }

        async function sendFakeLinkMessage() {
            const session = getCurrentSession();
            if (session.sending || session.status !== 'ready' || !session.generatedData) return;
            const normalized = normalizeFakeLinkInput(session.domainInput);
            if (!normalized) {
                session.status = 'error';
                session.errorMessage = '请先输入有效域名';
                renderComposerState();
                return;
            }
            const friendId = String(overlay._imFakeLinkFriendId || '');
            const friend = (window.imData?.friends || []).find(item => String(item.id) === friendId)
                || window.imData?.currentActiveFriend;
            if (!friend || (friend.type === 'group' && Number(friend.leftGroupAt) > 0)) {
                if (window.showToast) window.showToast('当前聊天无法发送链接');
                return;
            }

            session.sending = true;
            sendButton.disabled = true;
            sendButton.textContent = '发送中…';
            const now = Date.now();
            const generated = session.generatedData;
            const fakeLinkData = {
                domain: normalized.domain,
                displayUrl: normalized.displayUrl,
                canonicalUrl: normalized.canonicalUrl,
                siteName: generated.siteName,
                title: generated.title,
                summary: generated.summary,
                bodyText: generated.bodyText || stripHtmlToPlainText(generated.webPage?.html, 20000),
                prompt: cleanText(session.promptInput, 1000),
                includeCharPersona: !!session.includeCharPersona,
                includeUserPersona: !!session.includeUserPersona,
                includeRecentContext: !!session.includeRecentContext,
                recentContextLimit: normalizeRecentContextLimit(session.recentContextLimit),
                generatedBy: 'ai',
                webPage: normalizeFakeLinkWebPage(generated.webPage, { source: 'ai' }),
                createdAt: now
            };
            const msgObj = {
                id: imChat.createMessageId ? imChat.createMessageId('fake-link') : `fake-link-${now}`,
                role: 'user',
                type: 'fake_link',
                content: fakeLinkData.displayUrl,
                text: `[链接] ${fakeLinkData.siteName}：${fakeLinkData.title}`,
                fakeLinkData,
                timestamp: now
            };
            window.imApp.captureGroupUserIdentity?.(friend, msgObj);
            const saved = window.imApp.appendFriendMessage
                ? await window.imApp.appendFriendMessage(friend.id, msgObj, { silent: true })
                : false;
            if (!saved) {
                if (window.showToast) window.showToast('链接消息保存失败');
                session.sending = false;
                sendButton.disabled = false;
                sendButton.textContent = '发送';
                return;
            }

            const activePage = overlay._imFakeLinkPage || document.getElementById(`chat-interface-${friend.id}`) || page;
            const container = activePage?.querySelector('.ins-chat-messages');
            if (container) {
                const appended = imChat.appendMessageToContainer
                    ? imChat.appendMessageToContainer(friend, container, msgObj, { scroll: true })
                    : false;
                if (!appended && imChat.rerenderChatContainer) {
                    imChat.rerenderChatContainer(friend, container, { scroll: true });
                }
            }

            fakeLinkSessions.delete(friendId);
            closeComposer();
            session.sending = false;
            sendButton.textContent = '发送';
        }

        editableControls.forEach(node => {
            node.addEventListener('input', () => {
                syncSessionFromInputs({ invalidate: true });
                renderComposerState();
            });
            node.addEventListener('change', () => {
                syncSessionFromInputs({ invalidate: true });
                renderComposerState();
            });
        });
        generateButton.addEventListener('click', () => void generateContent());
        sendButton.addEventListener('click', () => void sendFakeLinkMessage());
        closeButton.addEventListener('click', closeComposer);
        cancelButton.addEventListener('click', closeComposer);
        backdrop.addEventListener('click', closeComposer);

        overlay._renderFakeLinkComposerState = renderComposerState;
        overlay._openFakeLinkComposer = (friend, nextPage) => {
            overlay._imFakeLinkFriendId = String(friend.id);
            overlay._imFakeLinkPage = nextPage || page;
            loadSessionIntoInputs(getFakeLinkSession(friend.id));
            sendButton.textContent = '发送';
            overlay.style.display = 'flex';
            void overlay.offsetWidth;
            overlay.classList.add('active');
        };
        return overlay;
    }

    function openFakeLinkComposer() {
        const friend = window.imData.currentActiveFriend;
        if (!friend) return;
        const page = document.getElementById(`chat-interface-${friend.id}`);
        if (!page) return;
        const overlay = createFakeLinkComposer(page);
        overlay._openFakeLinkComposer(friend, page);
    }

    imChat.normalizeFakeLinkInput = normalizeFakeLinkInput;
    imChat.normalizeFakeLinkDomain = normalizeFakeLinkDomain;
    imChat.buildFakeLinkPrompt = buildFakeLinkPrompt;
    imChat.resolveFakeLinkRecentChatContext = resolveFakeLinkRecentChatContext;
    imChat.buildRandomFakeLinkImageUrl = buildRandomFakeLinkImageUrl;
    imChat.isAllowedFakeLinkImageUrl = isAllowedFakeLinkImageUrl;
    imChat.injectRandomFakeLinkImages = injectRandomFakeLinkImages;
    imChat.normalizeFakeLinkWebPage = normalizeFakeLinkWebPage;
    imChat.sanitizeFakeLinkHtmlForStorage = sanitizeFakeLinkHtmlForStorage;
    imChat.sanitizeFakeLinkCssForStorage = sanitizeFakeLinkCssForStorage;
    imChat.sanitizeFakeLinkJsForStorage = sanitizeFakeLinkJsForStorage;
    imChat.buildFakeLinkSandboxDocument = buildFakeLinkSandboxDocument;
    imChat.openFakeLinkComposer = openFakeLinkComposer;
});
