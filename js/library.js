(function () {
    'use strict';

    const NETEASE_REDIRECT_API = 'https://music.znnu.com/api/redirect';
    const NETEASE_METING_API = 'https://api.injahow.cn/meting/';
    const NETEASE_RESOURCE_API = NETEASE_METING_API;
    const NETEASE_PLAYLIST_MAX_ATTEMPTS = 3;
    const NETEASE_PLAYLIST_RETRY_DELAYS = [400, 1200];
    const NETEASE_PLAYLIST_REQUEST_TIMEOUT = 12000;
    const BOOK_WORKER_URL = 'js/library_book_worker.js?v=20260715-reader-worker-v1';
    const READER_CHUNK_TARGET_CHARS = 16000;
    const READER_CONTENT_CACHE_LIMIT = 3;
    const TABS = ['books', 'music', 'overview'];
    const DEFAULT_PREFERENCES = {
        activeTab: 'books',
        readerFontSize: 18,
        readerLineHeight: 1.85,
        readerTheme: 'light',
        rankingRange: 'week'
    };
    const BOOK_PALETTES = [
        ['linear-gradient(145deg, #b9c1ad, #929d87)', '#273029'],
        ['linear-gradient(145deg, #c6b5aa, #a69287)', '#352b27'],
        ['linear-gradient(145deg, #aebdca, #8f9eac)', '#27323d'],
        ['linear-gradient(145deg, #c6aca8, #a88e8a)', '#382a29'],
        ['linear-gradient(145deg, #c2ba9d, #a69d80)', '#363329'],
        ['linear-gradient(145deg, #adbbb5, #8d9d97)', '#293532'],
        ['linear-gradient(145deg, #b8b0c3, #9c93ad)', '#302c39'],
        ['linear-gradient(145deg, #c4bbb0, #a79d91)', '#342f2a']
    ];

    const state = {
        ready: false,
        books: [],
        playlists: [],
        tracks: [],
        stats: [],
        preferences: { ...DEFAULT_PREFERENCES },
        activeTab: 'books',
        currentBook: null,
        detailBook: null,
        currentPlaylist: null,
        currentTrack: null,
        queue: [],
        queueIndex: -1,
        chapters: [],
        lyrics: [],
        lyricIndex: -1,
        lyricsStatus: 'idle',
        lyricsTrackId: null,
        lyricsRequestId: 0,
        playerShowsLyrics: false,
        together: null,
        togetherListening: null,
        togetherPicker: null,
        playerReturnToChatFriendId: null,
        readerPage: 0,
        readerPageCount: 1,
        readerMetrics: null,
        readerContent: null,
        readerChunkIndex: 0,
        readerChunkStart: 0,
        readerChunkEnd: 0,
        readerOpenRequestId: 0,
        readerPointerStart: null,
        readerLastActivityAt: 0,
        readerProgressSaveTimer: null,
        readerProgressSaveBook: null,
        pendingReadingSeconds: 0,
        pendingListeningSeconds: 0,
        lastMediaTime: 0,
        playbackAttemptId: 0,
        playbackStartingAttemptId: 0,
        neteasePlaybackRetryCount: 0,
        pendingPlayStatTrackId: null,
        isSeeking: false,
        navDragging: false,
        navMouseDragging: false,
        navPointerId: null
    };

    const dom = {};
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.playsInline = true;
    let togetherListeningEventTimer = null;
    let lastTogetherListeningEventAt = 0;
    const readerContentCache = new Map();
    const readerChunkHtmlCache = new Map();
    let bookWorker = null;
    let bookWorkerSequence = 0;
    const bookWorkerRequests = new Map();

    function $(id) {
        return document.getElementById(id);
    }

    function cacheDom() {
        [
            'library-view', 'library-back-btn', 'library-header-action', 'library-main',
            'library-books-page', 'library-music-page', 'library-overview-page',
            'library-book-upload-btn', 'library-book-file-input', 'library-book-count',
            'library-book-grid', 'library-books-empty', 'library-import-netease-btn',
            'library-add-track-btn', 'library-music-add-btn', 'library-playlist-count',
            'library-playlist-list', 'library-music-empty', 'library-floating-nav',
            'library-mini-player', 'library-mini-open', 'library-mini-art', 'library-mini-title',
            'library-mini-artist', 'library-mini-play', 'library-mini-next', 'library-mini-progress',
            'library-reader-view', 'library-reader-back', 'library-reader-title',
            'library-reader-progress-label', 'library-reader-settings', 'library-reader-toc-button',
            'library-reader-together',
            'library-reader-toc', 'library-reader-toc-close', 'library-reader-toc-list', 'library-reader-scroll',
            'library-reader-content', 'library-reader-loading', 'library-reader-panel', 'library-playlist-view',
            'library-playlist-back', 'library-playlist-delete', 'library-playlist-cover',
            'library-playlist-title', 'library-playlist-meta', 'library-play-all',
            'library-track-list', 'library-player-view', 'library-player-close',
            'library-player-wash', 'library-player-art', 'library-player-title',
            'library-player-stage',
            'library-player-artist', 'library-player-progress', 'library-player-current',
            'library-player-duration', 'library-player-prev', 'library-player-play',
            'library-player-next', 'library-lyrics', 'library-import-modal',
            'library-import-form', 'library-netease-input', 'library-track-modal',
            'library-track-form', 'library-track-name', 'library-track-artist',
            'library-track-url', 'library-track-cover-url', 'library-track-lyric-url',
            'library-book-detail-modal', 'library-book-detail-cover', 'library-book-detail-name',
            'library-book-detail-author', 'library-book-detail-progress', 'library-book-detail-progress-bar',
            'library-book-detail-synopsis', 'library-book-detail-start', 'library-book-detail-edit',
            'library-book-detail-delete', 'library-book-detail-actions', 'library-book-edit-form', 'library-book-edit-title',
            'library-book-edit-author', 'library-book-edit-synopsis', 'library-book-edit-cancel',
            'library-char-picker-modal', 'library-char-picker-list', 'library-char-picker-empty',
            'library-today-reading', 'library-today-listening', 'library-week-total',
            'library-week-chart', 'library-ranking-list'
        ].forEach((id) => {
            dom[id.replace(/^library-/, '').replace(/-/g, '_')] = $(id);
        });
    }

    function storage() {
        if (!window.appStorage) throw new Error('App storage is unavailable.');
        return window.appStorage;
    }

    function toast(message) {
        if (window.showToast) window.showToast(message);
        else console.info('[Library]', message);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function safeHttpUrl(value) {
        try {
            const url = new URL(String(value || '').trim());
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch (error) {
            return '';
        }
    }

    function safeImageSource(value) {
        const source = String(value || '').trim();
        if (/^https?:\/\//i.test(source)) return safeHttpUrl(source);
        if (/^data:image\/(?:png|jpe?g|gif|webp|avif);base64,/i.test(source)) return source;
        if (/^blob:/i.test(source) || /^(?:\.\/)?assets\//i.test(source)) return source;
        return '';
    }

    function extractNetEaseResourceId(value) {
        const source = String(value || '').trim();
        if (!source) return '';
        try {
            const url = new URL(source);
            const queryId = url.searchParams.get('id');
            if (/^\d+$/.test(queryId || '')) return queryId;
        } catch (error) {
            // Fall through to support direct music.126.net asset URLs.
        }
        const pathId = source.match(/\/(\d{8,})(?:\.[a-z0-9]+)?(?:[?#]|$)/i);
        return pathId ? pathId[1] : '';
    }

    function buildNetEaseResourceUrl(type, resourceId, cacheBust = '') {
        const id = String(resourceId || '').trim();
        if (!id) return '';
        const cacheParam = cacheBust ? `&_=${encodeURIComponent(cacheBust)}` : '';
        return `${NETEASE_RESOURCE_API}?server=netease&type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}${cacheParam}`;
    }

    function normalizeNetEaseTrackResources(track) {
        if (!track || track.source !== 'netease') return track;
        const currentMedia = safeHttpUrl(track.mediaUrl);
        const currentCover = safeHttpUrl(track.coverUrl);
        const currentLyric = safeHttpUrl(track.lyricUrl);
        const songId = String(track.neteaseId || extractNetEaseResourceId(currentMedia) || '').trim();
        if (!songId) return track;
        const picId = String(track.neteasePicId || extractNetEaseResourceId(currentCover) || '').trim();
        const lyricId = String(track.neteaseLyricId || extractNetEaseResourceId(currentLyric) || songId).trim();
        const mediaUrl = buildNetEaseResourceUrl('url', songId) || currentMedia;
        return {
            ...track,
            neteaseId: songId,
            neteasePicId: picId,
            neteaseLyricId: lyricId,
            mediaUrl,
            coverUrl: currentCover || buildNetEaseResourceUrl('pic', picId),
            lyricUrl: currentLyric || buildNetEaseResourceUrl('lrc', lyricId),
            available: !!mediaUrl
        };
    }

    function uid(prefix) {
        if (window.crypto?.randomUUID) return `${prefix}_${window.crypto.randomUUID()}`;
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }

    function hashString(value) {
        let hash = 0;
        for (const char of String(value || '')) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
        return Math.abs(hash);
    }

    function localDateKey(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function lastSevenDays() {
        const result = [];
        const now = new Date();
        now.setHours(12, 0, 0, 0);
        for (let offset = 6; offset >= 0; offset -= 1) {
            const date = new Date(now);
            date.setDate(now.getDate() - offset);
            result.push({
                key: localDateKey(date),
                label: ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
            });
        }
        return result;
    }

    function formatDuration(seconds, compact = false) {
        const safe = Math.max(0, Math.round(Number(seconds) || 0));
        if (safe < 60) return compact ? `${safe}秒` : '0分钟';
        const minutes = Math.floor(safe / 60);
        if (minutes < 60) return `${minutes}分钟`;
        const hours = Math.floor(minutes / 60);
        const rest = minutes % 60;
        return rest ? `${hours}小时${rest}分` : `${hours}小时`;
    }

    function formatClock(seconds) {
        const safe = Math.max(0, Number.isFinite(Number(seconds)) ? Number(seconds) : 0);
        const minutes = Math.floor(safe / 60);
        const rest = Math.floor(safe % 60);
        return `${minutes}:${String(rest).padStart(2, '0')}`;
    }

    function setArtwork(element, url, fallbackIcon = 'fa-music') {
        if (!element) return;
        const safeUrl = safeHttpUrl(url);
        element.innerHTML = safeUrl
            ? `<img src="${escapeHtml(safeUrl)}" alt="" referrerpolicy="no-referrer">`
            : `<i class="fas ${fallbackIcon}"></i>`;
    }

    function getTrack(trackId) {
        return state.tracks.find((track) => track.id === trackId) || null;
    }

    function getPlaylist(playlistId) {
        return state.playlists.find((playlist) => playlist.id === playlistId) || null;
    }

    async function loadState() {
        const repo = storage();
        const [books, playlists, tracks, stats, preferences] = await Promise.all([
            repo.loadLibraryBooks(),
            repo.loadLibraryPlaylists(),
            repo.loadLibraryTracks(),
            repo.loadLibraryDailyStats(),
            repo.getSetting('libraryPreferences', DEFAULT_PREFERENCES)
        ]);
        state.books = (Array.isArray(books) ? books : []).map((book) => ({
            ...book,
            author: String(book?.author || '').trim() || '未知作者',
            synopsis: String(book?.synopsis || '').trim() || '暂无简介'
        }));
        state.tracks = (Array.isArray(tracks) ? tracks : []).map(normalizeNetEaseTrackResources);
        state.playlists = (Array.isArray(playlists) ? playlists : []).map((playlist) => {
            if (playlist?.source !== 'netease') return playlist;
            const firstCover = (playlist.trackIds || [])
                .map((trackId) => state.tracks.find((track) => track.id === trackId)?.coverUrl || '')
                .find(Boolean);
            return firstCover ? { ...playlist, coverUrl: firstCover } : playlist;
        });
        state.stats = Array.isArray(stats) ? stats : [];
        state.preferences = { ...DEFAULT_PREFERENCES, ...(preferences || {}) };
        state.activeTab = TABS.includes(state.preferences.activeTab) ? state.preferences.activeTab : 'books';
    }

    async function savePreferences() {
        state.preferences.activeTab = state.activeTab;
        await storage().setSetting('libraryPreferences', state.preferences);
    }

    function setLibraryViewHidden(hidden) {
        if (!dom.view) return;
        if (hidden && dom.view.contains(document.activeElement)) {
            document.activeElement?.blur?.();
        }
        dom.view.toggleAttribute('inert', !!hidden);
        dom.view.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    }

    function openApp(tab) {
        if (!state.ready) return;
        if (TABS.includes(tab)) switchTab(tab, false);
        dom.view.classList.add('active');
        setLibraryViewHidden(false);
    }

    function closeApp() {
        if (dom.reader_view.classList.contains('active')) closeReader();
        dom.playlist_view.classList.remove('active');
        dom.player_view.classList.remove('active');
        state.playerReturnToChatFriendId = null;
        closeAllModals();
        dom.view.classList.remove('active');
        setLibraryViewHidden(true);
        savePreferences().catch(console.error);
    }

    function switchTab(tab, persist = true) {
        if (!TABS.includes(tab)) return;
        state.activeTab = tab;
        const index = TABS.indexOf(tab);
        dom.view.style.setProperty('--library-nav-index', String(index));
        dom.view.querySelectorAll('[data-library-page]').forEach((page) => {
            page.classList.toggle('active', page.dataset.libraryPage === tab);
        });
        dom.floating_nav.querySelectorAll('[data-library-tab]').forEach((button) => {
            button.classList.toggle('active', button.dataset.libraryTab === tab);
        });
        dom.header_action.style.visibility = tab === 'overview' ? 'hidden' : 'visible';
        if (tab === 'overview') renderOverview();
        if (persist) savePreferences().catch(console.error);
    }

    function renderBooks() {
        const sorted = [...state.books].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
        dom.book_count.textContent = `${sorted.length} ${sorted.length === 1 ? 'BOOK' : 'BOOKS'}`;
        dom.books_empty.hidden = sorted.length > 0;
        dom.book_grid.hidden = sorted.length === 0;
        dom.book_grid.innerHTML = sorted.map((book) => {
            const palette = BOOK_PALETTES[hashString(book.id) % BOOK_PALETTES.length];
            return `
                <article class="library-book-card" data-book-id="${escapeHtml(book.id)}">
                    <button class="library-book-open" type="button" data-book-action="details" aria-label="查看《${escapeHtml(book.title || '未命名')}》详情">
                        <span class="library-book-cover" style="background:${palette[0]};color:${palette[1]}">
                            <small>${escapeHtml(String(book.sourceType || 'TEXT').toUpperCase())}</small>
                            <strong>${escapeHtml(book.title || '未命名')}</strong>
                        </span>
                    </button>
                </article>`;
        }).join('');
    }

    function fileBaseName(name) {
        return String(name || '未命名书籍').replace(/\.[^/.]+$/, '') || '未命名书籍';
    }

    function decodeTextFile(buffer) {
        const bytes = new Uint8Array(buffer);
        if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
            return new TextDecoder('utf-8').decode(bytes.subarray(3));
        }
        if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
        if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));

        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch (error) {
            try {
                return new TextDecoder('gb18030').decode(bytes);
            } catch (fallbackError) {
                return new TextDecoder('utf-8').decode(bytes);
            }
        }
    }

    function parseLibraryXml(text, label) {
        const doc = new DOMParser().parseFromString(String(text || ''), 'application/xml');
        const parserError = doc.getElementsByTagName('parsererror')[0];
        if (parserError) throw new Error(`${label || 'XML'} 解析失败`);
        return doc;
    }

    function getXmlElementsByLocalName(doc, localName) {
        return [...doc.getElementsByTagName('*')].filter((node) => node.localName === localName);
    }

    function getFirstXmlText(doc, localNames) {
        const names = new Set((Array.isArray(localNames) ? localNames : [localNames]).map(String));
        const match = [...doc.getElementsByTagName('*')].find((node) => names.has(node.localName));
        return String(match?.textContent || '').trim();
    }

    function cleanBookPlainText(text) {
        return String(text || '')
            .replace(/\u00a0/g, ' ')
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n[ \t]+/g, '\n')
            .replace(/[ \t]{2,}/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function getZipDir(path) {
        const normalized = String(path || '').replace(/\\/g, '/');
        const index = normalized.lastIndexOf('/');
        return index >= 0 ? normalized.slice(0, index + 1) : '';
    }

    function resolveZipPath(baseDir, href) {
        let safeHref = String(href || '');
        try {
            safeHref = decodeURIComponent(safeHref);
        } catch (error) {
            // Keep the original href when an EPUB contains malformed percent escapes.
        }
        const parts = `${baseDir || ''}${safeHref}`.replace(/\\/g, '/').split('/');
        const resolved = [];
        parts.forEach((part) => {
            if (!part || part === '.') return;
            if (part === '..') resolved.pop();
            else resolved.push(part);
        });
        return resolved.join('/');
    }

    async function readZipText(zip, path, label) {
        const entry = zip.file(path);
        if (!entry) throw new Error(`${label || path} 缺失`);
        return entry.async('string');
    }

    function htmlNodeToPlainText(node) {
        if (!node) return '';
        if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
        if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_NODE) return '';

        const tag = node.nodeType === Node.ELEMENT_NODE ? node.tagName.toLowerCase() : '';
        if (['script', 'style', 'svg', 'head', 'nav'].includes(tag)) return '';
        if (tag === 'br') return '\n';

        const text = [...node.childNodes].map(htmlNodeToPlainText).join('');
        if (['address', 'article', 'aside', 'blockquote', 'body', 'div', 'dl', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'ol', 'p', 'pre', 'section', 'table', 'tr', 'ul'].includes(tag)) {
            return `\n${text}\n`;
        }
        return text;
    }

    function extractEpubHtmlChapter(html, fallbackTitle) {
        const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
        const title = String(
            doc.querySelector('h1,h2,h3,title')?.textContent
            || fallbackTitle
            || ''
        ).trim();
        const rawText = htmlNodeToPlainText(doc.body || doc.documentElement);
        return {
            title,
            text: cleanBookPlainText(rawText)
        };
    }

    async function readEpubBookFile(file) {
        await window.u2LoadVendorLibrary?.('jszip');
        if (!window.JSZip?.loadAsync) throw new Error('EPUB 解析组件未加载，请检查网络后重试');

        const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
        const containerText = await readZipText(zip, 'META-INF/container.xml', 'EPUB container.xml');
        const containerXml = parseLibraryXml(containerText, 'EPUB container.xml');
        const rootfilePath = getXmlElementsByLocalName(containerXml, 'rootfile')[0]?.getAttribute('full-path');
        if (!rootfilePath) throw new Error('EPUB 缺少 OPF 入口');

        const opfText = await readZipText(zip, rootfilePath, 'EPUB OPF');
        const opfXml = parseLibraryXml(opfText, 'EPUB OPF');
        const opfDir = getZipDir(rootfilePath);
        const title = getFirstXmlText(opfXml, 'title') || fileBaseName(file.name);
        const author = getFirstXmlText(opfXml, 'creator') || '未知作者';
        const synopsis = getFirstXmlText(opfXml, 'description') || '暂无简介';

        const manifest = new Map();
        getXmlElementsByLocalName(opfXml, 'item').forEach((item) => {
            const id = item.getAttribute('id');
            const href = item.getAttribute('href');
            if (!id || !href) return;
            manifest.set(id, {
                href,
                mediaType: item.getAttribute('media-type') || '',
                properties: item.getAttribute('properties') || ''
            });
        });

        const spineItems = getXmlElementsByLocalName(opfXml, 'itemref')
            .map((itemref) => manifest.get(itemref.getAttribute('idref') || ''))
            .filter((item) => item && (
                /application\/xhtml\+xml|text\/html/i.test(item.mediaType)
                || /\.x?html?$/i.test(item.href)
            ));
        if (!spineItems.length) throw new Error('EPUB 缺少可读取章节');

        const chapters = [];
        for (const item of spineItems) {
            const chapterPath = resolveZipPath(opfDir, item.href);
            const chapterHtml = await readZipText(zip, chapterPath, chapterPath);
            const chapter = extractEpubHtmlChapter(chapterHtml, fileBaseName(item.href));
            if (chapter.text) chapters.push(chapter);
        }

        if (!chapters.length) throw new Error('EPUB 没有可读取正文');
        const text = cleanBookPlainText(chapters.map((chapter) => {
            const heading = chapter.title ? `# ${chapter.title}` : '';
            return [heading, chapter.text].filter(Boolean).join('\n\n');
        }).join('\n\n'));
        if (!text) throw new Error('EPUB 解析后正文为空');

        return {
            text,
            sourceType: 'EPUB',
            title,
            author,
            synopsis
        };
    }

    async function readBookFile(file) {
        const lower = String(file.name || '').toLowerCase();
        if (lower.endsWith('.epub')) {
            return readEpubBookFile(file);
        }
        if (lower.endsWith('.docx')) {
            await window.u2LoadVendorLibrary?.('mammoth');
            if (!window.mammoth?.extractRawText) throw new Error('DOCX 解析组件未加载，请检查网络后重试');
            const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
            return {
                text: String(result?.value || '').replace(/\r\n/g, '\n'),
                sourceType: 'DOCX',
                title: fileBaseName(file.name),
                author: '未知作者',
                synopsis: '暂无简介'
            };
        }
        return {
            text: decodeTextFile(await file.arrayBuffer()).replace(/\r\n/g, '\n').replace(/\u0000/g, ''),
            sourceType: 'TXT',
            title: fileBaseName(file.name),
            author: '未知作者',
            synopsis: '暂无简介'
        };
    }

    function getBookWorker() {
        if (bookWorker) return bookWorker;
        if (typeof Worker !== 'function') return null;
        try {
            bookWorker = new Worker(BOOK_WORKER_URL);
            bookWorker.addEventListener('message', (event) => {
                const pending = bookWorkerRequests.get(event.data?.id);
                if (!pending) return;
                bookWorkerRequests.delete(event.data.id);
                if (event.data.ok) pending.resolve(event.data.book);
                else pending.reject(new Error(event.data.error || '书籍解析失败'));
            });
            bookWorker.addEventListener('error', (event) => {
                const error = new Error(event.message || '书籍解析 Worker 运行失败');
                bookWorkerRequests.forEach((pending) => pending.reject(error));
                bookWorkerRequests.clear();
                bookWorker?.terminate();
                bookWorker = null;
            });
            return bookWorker;
        } catch (error) {
            bookWorker = null;
            return null;
        }
    }

    function parseBookInWorker(file) {
        const worker = getBookWorker();
        if (!worker) return Promise.reject(new Error('BOOK_WORKER_UNAVAILABLE'));
        return file.arrayBuffer().then((buffer) => new Promise((resolve, reject) => {
            const id = `book-worker-${Date.now()}-${++bookWorkerSequence}`;
            bookWorkerRequests.set(id, { resolve, reject });
            worker.postMessage({ id, type: 'parse-book', name: file.name, buffer }, [buffer]);
        }));
    }

    function indexReaderContentInWorker(text) {
        const worker = getBookWorker();
        if (!worker) return Promise.reject(new Error('BOOK_WORKER_UNAVAILABLE'));
        return new Promise((resolve, reject) => {
            const id = `book-index-${Date.now()}-${++bookWorkerSequence}`;
            bookWorkerRequests.set(id, { resolve, reject });
            worker.postMessage({ id, type: 'index-content', text: String(text || '') });
        });
    }

    function buildReaderContentIndex(text) {
        const source = String(text || '');
        const chapters = [{ title: '开始阅读', start: 0 }];
        let offset = 0;
        source.split('\n').forEach((line) => {
            if (offset > 0 && isChapterHeading(line)) {
                chapters.push({ title: line.trim().replace(/^#{1,3}\s*/, ''), start: offset });
            }
            offset += line.length + 1;
        });
        const chapterIndex = chapters.map((chapter, index) => ({
            ...chapter,
            end: index + 1 < chapters.length ? chapters[index + 1].start : source.length
        }));
        const chunks = [];
        let start = 0;
        while (start < source.length) {
            const target = Math.min(source.length, start + READER_CHUNK_TARGET_CHARS);
            let end = target;
            if (target < source.length) {
                const nextChapter = chapterIndex.find((chapter) => chapter.start > start + 4000 && chapter.start <= target + 4000);
                if (nextChapter) end = nextChapter.start;
                else {
                    const paragraphBreak = source.lastIndexOf('\n\n', target);
                    const lineBreak = source.lastIndexOf('\n', target);
                    const candidate = paragraphBreak > start + 8000 ? paragraphBreak + 2 : lineBreak + 1;
                    if (candidate > start + 4000) end = candidate;
                }
            }
            if (end <= start) end = Math.min(source.length, start + READER_CHUNK_TARGET_CHARS);
            chunks.push({ start, end });
            start = end;
        }
        return { chapterIndex, chunks: chunks.length ? chunks : [{ start: 0, end: 0 }] };
    }

    async function parseBookForImport(file) {
        try {
            return await parseBookInWorker(file);
        } catch (workerError) {
            console.warn('[Library] Worker parsing unavailable, using main-thread fallback.', workerError);
            const parsed = await readBookFile(file);
            const text = String(parsed?.text || '');
            return { ...parsed, ...buildReaderContentIndex(text) };
        }
    }

    async function importBook(file) {
        if (!file) return;
        const lower = String(file.name || '').toLowerCase();
        if (!lower.endsWith('.txt') && !lower.endsWith('.text') && !lower.endsWith('.docx') && !lower.endsWith('.epub')) {
            toast('仅支持 TXT、DOCX 和 EPUB 文件');
            return;
        }
        toast('正在整理书籍…');
        try {
            const parsedBook = await parseBookForImport(file);
            const text = String(parsedBook?.text || '');
            if (!text.trim()) throw new Error('文件内容为空');
            const now = Date.now();
            const book = {
                id: uid('book'),
                title: String(parsedBook.title || fileBaseName(file.name)).slice(0, 100),
                sourceType: parsedBook.sourceType || (lower.endsWith('.docx') ? 'DOCX' : (lower.endsWith('.epub') ? 'EPUB' : 'TXT')),
                author: String(parsedBook.author || '未知作者').slice(0, 80),
                synopsis: String(parsedBook.synopsis || '暂无简介').slice(0, 2000),
                progress: 0,
                createdAt: now,
                updatedAt: now,
                lastOpenedAt: 0,
                text,
                chapterIndex: parsedBook.chapterIndex || [],
                chunks: parsedBook.chunks || []
            };
            const savedBook = await storage().saveLibraryBook(book);
            rememberReaderContent(savedBook.id, {
                id: savedBook.id,
                text,
                chapterIndex: book.chapterIndex,
                chunks: book.chunks,
                updatedAt: savedBook.updatedAt
            });
            state.books.push(savedBook);
            renderBooks();
            toast('书籍已放入书架');
        } catch (error) {
            console.error('[Library] Book import failed:', error);
            toast(error?.message || '书籍导入失败');
        } finally {
            dom.book_file_input.value = '';
        }
    }

    function requestRenameBook(book) {
        if (!book) return;
        if (window.showCustomModal) {
            window.showCustomModal({
                type: 'prompt',
                title: '重命名书籍',
                message: '输入新的书名',
                placeholder: '书名',
                defaultValue: book.title || '',
                confirmText: '保存',
                onConfirm: async (value) => {
                    const title = String(value || '').trim();
                    if (!title) return toast('书名不能为空');
                    book.title = title.slice(0, 100);
                    book.updatedAt = Date.now();
                    await storage().saveLibraryBook(book);
                    renderBooks();
                }
            });
            return;
        }
        const title = window.prompt('输入新的书名', book.title || '');
        if (title?.trim()) {
            book.title = title.trim().slice(0, 100);
            book.updatedAt = Date.now();
            storage().saveLibraryBook(book).then(renderBooks);
        }
    }

    function requestDeleteBook(book) {
        if (!book) return;
        const remove = async () => {
            if (state.currentBook?.id === book.id) closeReader();
            await storage().deleteLibraryBook(book.id);
            state.books = state.books.filter((item) => item.id !== book.id);
            if (state.detailBook?.id === book.id) {
                state.detailBook = null;
                if (dom.book_detail_modal) dom.book_detail_modal.hidden = true;
            }
            renderBooks();
            toast('书籍已删除');
        };
        if (window.showCustomModal) {
            window.showCustomModal({ title: '删除书籍', message: `确定删除《${book.title}》吗？`, confirmText: '删除', isDestructive: true, onConfirm: remove });
        } else if (window.confirm(`确定删除《${book.title}》吗？`)) remove();
    }

    function setBookDetailEditing(editing) {
        if (!dom.book_edit_form) return;
        dom.book_edit_form.hidden = !editing;
        dom.book_detail_actions?.toggleAttribute('hidden', editing);
        if (editing) requestAnimationFrame(() => dom.book_edit_title?.focus());
    }

    function renderBookDetail() {
        const book = state.detailBook;
        if (!book) return;
        const palette = BOOK_PALETTES[hashString(book.id) % BOOK_PALETTES.length];
        const progress = Math.round(Math.max(0, Math.min(1, Number(book.progress) || 0)) * 100);
        dom.book_detail_cover.style.background = palette[0];
        dom.book_detail_cover.style.color = palette[1];
        dom.book_detail_cover.innerHTML = `<small>${escapeHtml(String(book.sourceType || 'TEXT').toUpperCase())}</small><strong>${escapeHtml(book.title || '未命名')}</strong>`;
        dom.book_detail_name.textContent = book.title || '未命名';
        dom.book_detail_author.textContent = book.author || '未知作者';
        dom.book_detail_progress.textContent = `${progress}%`;
        dom.book_detail_progress_bar.style.width = `${progress}%`;
        dom.book_detail_synopsis.textContent = book.synopsis || '暂无简介';
        dom.book_detail_start.textContent = progress > 0 ? '继续阅读' : '开始阅读';
        dom.book_edit_title.value = book.title || '';
        dom.book_edit_author.value = book.author === '未知作者' ? '' : (book.author || '');
        dom.book_edit_synopsis.value = book.synopsis === '暂无简介' ? '' : (book.synopsis || '');
    }

    function openBookDetail(book) {
        if (!book) return;
        state.detailBook = book;
        renderBookDetail();
        setBookDetailEditing(false);
        openModal(dom.book_detail_modal, { focus: false });
    }

    async function saveBookDetail(event) {
        event.preventDefault();
        const book = state.detailBook;
        if (!book) return;
        const title = dom.book_edit_title.value.trim();
        if (!title) return toast('书名不能为空');
        book.title = title.slice(0, 100);
        book.author = dom.book_edit_author.value.trim().slice(0, 80) || '未知作者';
        book.synopsis = dom.book_edit_synopsis.value.trim().slice(0, 2000) || '暂无简介';
        book.updatedAt = Date.now();
        try {
            await storage().saveLibraryBook(book);
            renderBooks();
            renderBookDetail();
            setBookDetailEditing(false);
            toast('书籍资料已保存');
        } catch (error) {
            console.error('[Library] Book detail save failed:', error);
            toast('书籍资料保存失败');
        }
    }

    function applyReaderPreferences() {
        const size = Math.max(14, Math.min(28, Number(state.preferences.readerFontSize) || 18));
        const line = Math.max(1.4, Math.min(2.4, Number(state.preferences.readerLineHeight) || 1.85));
        const theme = ['light', 'paper', 'dark'].includes(state.preferences.readerTheme) ? state.preferences.readerTheme : 'light';
        state.preferences.readerFontSize = size;
        state.preferences.readerLineHeight = line;
        state.preferences.readerTheme = theme;
        dom.reader_view.style.setProperty('--reader-font', `${size}px`);
        dom.reader_view.style.setProperty('--reader-line', String(line));
        dom.reader_view.classList.toggle('theme-paper', theme === 'paper');
        dom.reader_view.classList.toggle('theme-dark', theme === 'dark');
        dom.reader_panel.querySelectorAll('[data-reader-theme]').forEach((button) => {
            button.classList.toggle('active', button.dataset.readerTheme === theme);
        });
        invalidateReaderMetrics();
    }

    function clampReaderValue(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function clampReaderProgress(value) {
        return clampReaderValue(Number(value) || 0, 0, 1);
    }

    function invalidateReaderMetrics() {
        state.readerMetrics = null;
    }

    function readReaderPixelValue(value) {
        const number = parseFloat(value);
        return Number.isFinite(number) ? number : 0;
    }

    function getReaderScrollPadding() {
        if (!dom.reader_scroll || typeof getComputedStyle !== 'function') return { left: 0, right: 0, horizontal: 0 };
        const style = getComputedStyle(dom.reader_scroll);
        const left = readReaderPixelValue(style.paddingLeft);
        const right = readReaderPixelValue(style.paddingRight);
        return { left, right, horizontal: left + right };
    }

    function updateReaderPageGeometry() {
        if (!dom.reader_scroll) return { pageWidth: 1, columnWidth: 1, pageGap: 0, pageStep: 1, paddingLeft: 0 };
        const pageWidth = Math.max(1, Math.round(dom.reader_scroll.clientWidth || 1));
        const padding = getReaderScrollPadding();
        const pageGap = Math.max(0, Math.round(padding.horizontal));
        const columnWidth = Math.max(1, pageWidth - pageGap);
        const pageStep = columnWidth + pageGap;
        dom.reader_view.style.setProperty('--reader-page-width', `${pageWidth}px`);
        dom.reader_view.style.setProperty('--reader-column-width', `${columnWidth}px`);
        dom.reader_view.style.setProperty('--reader-page-gap', `${pageGap}px`);
        dom.reader_view.style.setProperty('--reader-page-step', `${pageStep}px`);
        return { pageWidth, columnWidth, pageGap, pageStep, paddingLeft: padding.left };
    }

    function updateReaderPageWidth() {
        invalidateReaderMetrics();
        return updateReaderPageGeometry().pageStep;
    }

    function getReaderPageMetrics(options = {}) {
        if (!options.force && state.readerMetrics) return state.readerMetrics;
        const geometry = updateReaderPageGeometry();
        dom.reader_view.style.setProperty('--reader-content-width', `${geometry.columnWidth}px`);
        const articleWidth = Math.max(
            geometry.columnWidth,
            Math.ceil(dom.reader_content?.scrollWidth || 0),
            Math.ceil(dom.reader_content?.getBoundingClientRect?.().width || 0)
        );
        const pageCount = Math.max(1, Math.ceil((articleWidth + geometry.pageGap) / geometry.pageStep - 0.01));
        const contentWidth = Math.max(geometry.columnWidth, (pageCount - 1) * geometry.pageStep + geometry.columnWidth);
        dom.reader_view.style.setProperty('--reader-content-width', `${contentWidth}px`);
        const maxOffset = Math.max(0, (pageCount - 1) * geometry.pageStep);
        state.readerMetrics = { ...geometry, contentWidth, maxOffset, pageCount };
        return state.readerMetrics;
    }

    function getReaderPageFromOffset(metrics = getReaderPageMetrics(), offset = state.readerPage * metrics.pageStep) {
        return clampReaderValue(Math.round(offset / metrics.pageStep), 0, metrics.pageCount - 1);
    }

    function formatReaderProgressLabel(progress, page, pageCount) {
        const safePageCount = Math.max(1, pageCount);
        const safePage = clampReaderValue(page, 0, safePageCount - 1) + 1;
        return `${safePage}/${safePageCount} ${String.fromCharCode(183)} ${Math.round(clampReaderProgress(progress) * 100)}%`;
    }

    function saveReaderProgress(book, immediate = false) {
        if (!book) return Promise.resolve();
        if (state.readerProgressSaveTimer) {
            clearTimeout(state.readerProgressSaveTimer);
            state.readerProgressSaveTimer = null;
        }
        if (immediate) {
            state.readerProgressSaveBook = null;
            return storage().saveLibraryBook(book).catch(console.error);
        }
        state.readerProgressSaveBook = book;
        state.readerProgressSaveTimer = setTimeout(() => {
            state.readerProgressSaveTimer = null;
            const pendingBook = state.readerProgressSaveBook;
            state.readerProgressSaveBook = null;
            if (pendingBook) storage().saveLibraryBook(pendingBook).catch(console.error);
        }, 600);
        return Promise.resolve();
    }

    function flushReaderProgressSave() {
        const pendingBook = state.readerProgressSaveBook || state.currentBook;
        return saveReaderProgress(pendingBook, true);
    }

    function rememberReaderContent(bookId, content) {
        const key = String(bookId || '');
        if (!key || !content) return content;
        readerContentCache.delete(key);
        readerContentCache.set(key, content);
        while (readerContentCache.size > READER_CONTENT_CACHE_LIMIT) {
            readerContentCache.delete(readerContentCache.keys().next().value);
        }
        return content;
    }

    async function loadReaderContent(book) {
        const key = String(book?.id || '');
        if (!key) throw new Error('书籍不存在');
        if (readerContentCache.has(key)) return rememberReaderContent(key, readerContentCache.get(key));
        let content = await storage().loadLibraryBookContent(key);
        if (!content && typeof book.text === 'string') {
            content = { id: key, text: book.text, chapterIndex: book.chapterIndex || [], chunks: book.chunks || [] };
        }
        if (!content || typeof content.text !== 'string') throw new Error('书籍正文不存在');
        if (!Array.isArray(content.chapterIndex) || !content.chapterIndex.length || !Array.isArray(content.chunks) || !content.chunks.length) {
            let index;
            try {
                index = await indexReaderContentInWorker(content.text);
            } catch (workerError) {
                console.warn('[Library] Worker indexing unavailable, using main-thread fallback.', workerError);
                index = buildReaderContentIndex(content.text);
            }
            content = { ...content, ...index, updatedAt: Number(book.updatedAt) || Date.now() };
            await storage().saveLibraryBook({ ...book, text: content.text, chapterIndex: content.chapterIndex, chunks: content.chunks });
        }
        return rememberReaderContent(key, content);
    }

    function getCurrentReaderChunk() {
        return state.readerContent?.chunks?.[state.readerChunkIndex] || { start: 0, end: state.readerContent?.text?.length || 0 };
    }

    function estimateReaderPagePosition(progress, page, pageCount) {
        const chunkCount = Math.max(1, state.readerContent?.chunks?.length || 1);
        const estimatedTotal = Math.max(1, pageCount * chunkCount);
        const estimatedPage = clampReaderValue(Math.round(progress * (estimatedTotal - 1)), 0, estimatedTotal - 1);
        return { page: estimatedPage, pageCount: estimatedTotal };
    }

    function updateReaderProgress(save = false, forcedPage = null, options = {}) {
        const book = state.currentBook;
        if (!book || !dom.reader_scroll) return;
        const metrics = getReaderPageMetrics();
        const page = clampReaderValue(forcedPage == null ? state.readerPage : forcedPage, 0, metrics.pageCount - 1);
        const chunk = getCurrentReaderChunk();
        const localProgress = metrics.pageCount > 1 ? clampReaderProgress(page / (metrics.pageCount - 1)) : 0;
        const textLength = Math.max(1, state.readerContent?.text?.length || chunk.end || 1);
        const progress = clampReaderProgress((chunk.start + (chunk.end - chunk.start) * localProgress) / textLength);
        state.readerPage = page;
        state.readerPageCount = metrics.pageCount;
        book.progress = progress;
        book.updatedAt = Date.now();
        const display = estimateReaderPagePosition(progress, page, metrics.pageCount);
        dom.reader_progress_label.textContent = formatReaderProgressLabel(progress, display.page, display.pageCount);
        if (save) saveReaderProgress(book, !!options.immediate);
    }

    function setReaderPage(page, options = {}) {
        if (!dom.reader_scroll || !dom.reader_content) return;
        const metrics = getReaderPageMetrics();
        const nextPage = clampReaderValue(Math.round(Number(page) || 0), 0, metrics.pageCount - 1);
        const left = Math.min(metrics.maxOffset, nextPage * metrics.pageStep);
        state.readerPage = nextPage;
        state.readerPageCount = metrics.pageCount;
        if (typeof dom.reader_scroll.scrollTo === 'function') {
            dom.reader_scroll.scrollTo({ left, top: 0, behavior: options.animate ? 'smooth' : 'auto' });
        } else {
            dom.reader_scroll.scrollLeft = left;
        }
        if (options.updateProgress !== false) updateReaderProgress(!!options.save, nextPage);
    }

    function restoreReaderProgress(progress = state.currentBook?.progress || 0) {
        if (!state.readerContent) return;
        const safeProgress = clampReaderProgress(progress);
        const targetOffset = Math.round(safeProgress * state.readerContent.text.length);
        const chunkIndex = Math.max(0, state.readerContent.chunks.findIndex((chunk, index) => (
            targetOffset < chunk.end || index === state.readerContent.chunks.length - 1
        )));
        const chunk = state.readerContent.chunks[chunkIndex];
        const localProgress = chunk.end > chunk.start ? clampReaderProgress((targetOffset - chunk.start) / (chunk.end - chunk.start)) : 0;
        renderReaderChunk(chunkIndex, localProgress);
    }

    function getReaderElementPage(element) {
        if (!element || !dom.reader_scroll) return state.readerPage;
        const rect = element.getClientRects()[0] || element.getBoundingClientRect();
        const viewport = dom.reader_scroll.getBoundingClientRect();
        const metrics = getReaderPageMetrics();
        const currentOffset = Math.max(0, Math.round(Number(dom.reader_scroll.scrollLeft) || state.readerPage * metrics.pageStep));
        const left = rect.left - viewport.left - metrics.paddingLeft + currentOffset;
        return getReaderPageFromOffset(metrics, left);
    }

    function turnReaderPage(delta, options = {}) {
        const metrics = getReaderPageMetrics();
        const nextPage = state.readerPage + delta;
        if (nextPage >= metrics.pageCount && state.readerChunkIndex < (state.readerContent?.chunks?.length || 1) - 1) {
            renderReaderChunk(state.readerChunkIndex + 1, 0);
            if (options.save !== false) updateReaderProgress(true, 0);
            return;
        }
        if (nextPage < 0 && state.readerChunkIndex > 0) {
            renderReaderChunk(state.readerChunkIndex - 1, 1);
            if (options.save !== false) updateReaderProgress(true, state.readerPage);
            return;
        }
        setReaderPage(nextPage, { animate: true, save: options.save !== false });
    }

    function markReaderActivity() {
        state.readerLastActivityAt = Date.now();
    }

    function isChapterHeading(line) {
        const value = String(line || '').trim();
        if (!value || value.length > 80) return false;
        return /^(?:第[0-9零一二三四五六七八九十百千万两〇○]+[章节卷部篇回]|chapter\s+[0-9ivxlcdm]+\b|#{1,3}\s+|\d{1,3}[、.．]\s*\S+)/i.test(value);
    }

    function isReaderChapterHeading(line) {
        const value = String(line || '').trim();
        if (!value || value.length > 80) return false;
        return /^(?:第[0-9零一二三四五六七八九十百千万两〇]+[章节卷部篇回]|chapter\s+[0-9ivxlcdm]+\b|#{1,3}\s+|\d{1,3}[、.．]\s*\S+)/i.test(value);
    }

    function buildReaderChunkHtml(text, offset = 0) {
        let textOffset = Number(offset) || 0;
        return String(text || '').split('\n').map((line, lineIndex) => {
            const start = textOffset;
            const end = start + line.length;
            textOffset = end + 1;
            let content = escapeHtml(line) || '&#8203;';
            if (isReaderChapterHeading(line)) {
                content = `<span class="library-reader-chapter" id="library-reader-offset-${start}">${content}</span>`;
            }
            return `<span class="library-reader-line" data-reader-line="${lineIndex}" data-text-start="${start}" data-text-end="${end}">${content}</span>`;
        }).join('');
    }

    function renderReaderToc() {
        const chapters = state.readerContent?.chapterIndex || [{ title: '开始阅读', start: 0 }];
        state.chapters = chapters;
        dom.reader_toc_list.innerHTML = chapters.map((chapter, index) => `
            <button type="button" data-chapter-offset="${Math.max(0, Number(chapter.start) || 0)}">
                <span>${String(index + 1).padStart(2, '0')}</span>
                <span>${escapeHtml(chapter.title || '未命名章节')}</span>
            </button>`).join('') + (chapters.length === 1
            ? '<p class="library-reader-toc-empty">未识别到明确章节标题。支持“第×章”、Chapter、Markdown 标题和数字标题。</p>'
            : '');
    }

    function scheduleReaderChunkPrefetch(chunkIndex) {
        const nextIndex = chunkIndex + 1;
        const next = state.readerContent?.chunks?.[nextIndex];
        if (!next || !state.currentBook) return;
        const key = `${state.currentBook.id}:${state.readerContent.updatedAt || state.currentBook.updatedAt || 0}:${nextIndex}`;
        if (readerChunkHtmlCache.has(key)) return;
        const prepare = () => {
            if (!state.readerContent || readerChunkHtmlCache.has(key)) return;
            readerChunkHtmlCache.set(key, buildReaderChunkHtml(state.readerContent.text.slice(next.start, next.end), next.start));
            while (readerChunkHtmlCache.size > 12) readerChunkHtmlCache.delete(readerChunkHtmlCache.keys().next().value);
        };
        if (typeof requestIdleCallback === 'function') requestIdleCallback(prepare, { timeout: 500 });
        else setTimeout(prepare, 40);
    }

    function renderReaderChunk(chunkIndex, localProgress = 0) {
        if (!state.readerContent || !state.currentBook) return;
        const index = clampReaderValue(Math.round(Number(chunkIndex) || 0), 0, state.readerContent.chunks.length - 1);
        const chunk = state.readerContent.chunks[index];
        state.readerChunkIndex = index;
        state.readerChunkStart = chunk.start;
        state.readerChunkEnd = chunk.end;
        const cacheKey = `${state.currentBook.id}:${state.readerContent.updatedAt || state.currentBook.updatedAt || 0}:${index}`;
        let html = readerChunkHtmlCache.get(cacheKey);
        if (!html) {
            html = buildReaderChunkHtml(state.readerContent.text.slice(chunk.start, chunk.end), chunk.start);
            readerChunkHtmlCache.set(cacheKey, html);
            while (readerChunkHtmlCache.size > 12) readerChunkHtmlCache.delete(readerChunkHtmlCache.keys().next().value);
        }
        dom.reader_content.innerHTML = `<span id="library-reader-start"></span>${html}`;
        invalidateReaderMetrics();
        const metrics = getReaderPageMetrics({ force: true });
        const targetPage = Math.round(clampReaderProgress(localProgress) * (metrics.pageCount - 1));
        setReaderPage(targetPage, { animate: false, save: false, updateProgress: false });
        updateReaderProgress(false, targetPage);
        scheduleReaderChunkPrefetch(index);
    }

    function getVisibleReaderText() {
        const book = state.currentBook;
        if (!book || !dom.reader_scroll) return '';
        const viewport = dom.reader_scroll.getBoundingClientRect();
        const visibleLines = [...dom.reader_content.querySelectorAll('[data-reader-line]')].filter((line) => {
            return [...line.getClientRects()].some((rect) => (
                rect.right >= viewport.left
                && rect.left <= viewport.right
                && rect.bottom >= viewport.top
                && rect.top <= viewport.bottom
            ));
        });
        const visibleText = visibleLines.map((line) => line.textContent || '').join('\n').trim();
        if (visibleText && visibleText.length <= 6000) return visibleText;
        if (visibleText && visibleLines.length > 1) return visibleText.slice(0, 6000);

        const fullText = String(state.readerContent?.text || '');
        if (!fullText) return '';
        const metrics = getReaderPageMetrics();
        const ratio = metrics.pageCount > 1 ? clampReaderProgress(state.readerPage / (metrics.pageCount - 1)) : 0;
        const chunk = getCurrentReaderChunk();
        const center = Math.round(chunk.start + (chunk.end - chunk.start) * ratio);
        const start = Math.max(0, Math.min(fullText.length - 6000, center - 3000));
        return fullText.slice(start, start + 6000).trim();
    }

    function setReaderLoading(loading, message = '准备正文与阅读位置…') {
        if (!dom.reader_loading) return;
        dom.reader_loading.hidden = !loading;
        const detail = dom.reader_loading.querySelector('small');
        if (detail) detail.textContent = message;
    }

    async function openReaderAsync(book) {
        if (!book) return;
        const requestId = ++state.readerOpenRequestId;
        const savedProgress = clampReaderProgress(Number(book.progress) || 0);
        state.currentBook = book;
        state.readerContent = null;
        book.lastOpenedAt = Date.now();
        dom.reader_title.textContent = book.title || '未命名';
        applyReaderPreferences();
        dom.reader_view.classList.add('active');
        dom.reader_view.setAttribute('aria-hidden', 'false');
        dom.reader_content.innerHTML = '';
        setReaderLoading(true);
        markReaderActivity();
        try {
            const content = await loadReaderContent(book);
            if (requestId !== state.readerOpenRequestId || state.currentBook !== book) return;
            state.readerContent = content;
            renderReaderToc();
            await new Promise((resolve) => requestAnimationFrame(resolve));
            restoreReaderProgress(savedProgress);
            setReaderLoading(false);
        } catch (error) {
            console.error('[Library] Reader content load failed', error);
            if (requestId !== state.readerOpenRequestId) return;
            setReaderLoading(false);
            dom.reader_view.classList.remove('active');
            dom.reader_view.setAttribute('aria-hidden', 'true');
            state.currentBook = null;
            state.readerContent = null;
            toast(error?.message || '书籍打开失败');
        }
    }

    async function flushReadingStats() {
        const seconds = state.pendingReadingSeconds;
        const book = state.currentBook;
        if (!book || seconds <= 0) return;
        state.pendingReadingSeconds = 0;
        await storage().incrementLibraryDailyStat({ date: localDateKey(), kind: 'reading', itemId: book.id, seconds });
    }

    function closeReader() {
        state.readerOpenRequestId += 1;
        setReaderLoading(false);
        if (!state.currentBook) {
            dom.reader_view.classList.remove('active');
            dom.reader_view.setAttribute('aria-hidden', 'true');
            return;
        }
        stopTogether();
        if (state.readerContent) updateReaderProgress(true, null, { immediate: true });
        flushReadingStats().catch(console.error);
        dom.reader_panel.hidden = true;
        dom.reader_toc.hidden = true;
        dom.reader_view.classList.remove('active');
        dom.reader_view.setAttribute('aria-hidden', 'true');
        state.currentBook = null;
        state.readerContent = null;
        state.readerChunkIndex = 0;
        state.readerChunkStart = 0;
        state.readerChunkEnd = 0;
        renderBooks();
    }

    function isReaderActive() {
        return !!state.currentBook && dom.reader_view.classList.contains('active');
    }

    function repaginateReaderAtCurrentProgress() {
        if (!isReaderActive()) return;
        const progress = Number(state.currentBook.progress) || 0;
        invalidateReaderMetrics();
        updateReaderPageWidth();
        requestAnimationFrame(() => restoreReaderProgress(progress));
    }

    function handleReaderPointerDown(event) {
        if (!isReaderActive()) return;
        state.readerPointerStart = {
            x: event.clientX,
            y: event.clientY,
            page: state.readerPage,
            time: Date.now()
        };
    }

    function handleReaderPointerUp(event) {
        if (!isReaderActive() || !state.readerPointerStart) return;
        const start = state.readerPointerStart;
        state.readerPointerStart = null;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        const elapsed = Date.now() - start.time;

        if (absX >= 45 && absX > absY * 1.2) {
            turnReaderPage(dx < 0 ? 1 : -1, { save: true });
            markReaderActivity();
            return;
        }

        if (absX <= 8 && absY <= 8 && elapsed <= 350) {
            const rect = dom.reader_scroll.getBoundingClientRect();
            const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
            turnReaderPage(ratio < 0.5 ? -1 : 1, { save: true });
            markReaderActivity();
        }
    }

    function handleReaderKeydown(event) {
        if (!isReaderActive()) return;
        const tagName = event.target?.tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
        if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
            event.preventDefault();
            turnReaderPage(1, { save: true });
            markReaderActivity();
        } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
            event.preventDefault();
            turnReaderPage(-1, { save: true });
            markReaderActivity();
        }
    }

    function updateTogetherControls() {
        const active = !!state.together;
        if (dom.reader_together) {
            dom.reader_together.classList.toggle('is-active', active);
            dom.reader_together.innerHTML = active
                ? '<i class="fas fa-user-xmark"></i>'
                : '<i class="fas fa-user-group"></i>';
            dom.reader_together.setAttribute('aria-label', active ? '退出一起看' : '一起看小说');
            dom.reader_together.setAttribute('title', active ? '退出一起看' : '一起看小说');
        }
    }

    function getTogetherFriend() {
        const friendId = state.together?.friendId;
        if (!friendId) return null;
        return (window.imData?.friends || []).find((friend) => String(friend.id) === String(friendId)) || null;
    }

    function ensureTogetherFloat(friend) {
        let button = $('library-together-float');
        if (!button) {
            button = document.createElement('button');
            button.id = 'library-together-float';
            button.className = 'library-together-float';
            button.type = 'button';
            button.hidden = true;
            button.addEventListener('click', restoreTogetherPopup);
            dom.reader_view.appendChild(button);
        }
        const avatar = safeImageSource(friend?.avatarUrl);
        button.innerHTML = avatar
            ? `<img src="${escapeHtml(avatar)}" alt="">`
            : '<i class="fas fa-user"></i>';
        button.setAttribute('aria-label', `继续与 ${friend?.nickname || 'Char'} 一起看`);
        return button;
    }

    async function renderCharPicker() {
        if (window.imApp?.ensureDataReady) await window.imApp.ensureDataReady();
        const chars = (window.imData?.friends || []).filter((friend) => friend?.type === 'char');
        dom.char_picker_empty.hidden = chars.length > 0;
        dom.char_picker_list.hidden = chars.length === 0;
        dom.char_picker_list.innerHTML = chars.map((friend) => {
            const avatar = safeImageSource(friend.avatarUrl);
            const subtitle = friend.signature || friend.realName || '点击邀请一起看';
            return `<button class="library-char-picker-item" type="button" data-library-char-id="${escapeHtml(friend.id)}">
                <span class="library-char-picker-avatar">${avatar ? `<img src="${escapeHtml(avatar)}" alt="">` : '<i class="fas fa-user"></i>'}</span>
                <span class="library-char-picker-copy"><strong>${escapeHtml(friend.nickname || friend.realName || 'Char')}</strong><small>${escapeHtml(subtitle)}</small></span>
                <i class="fas fa-chevron-right"></i>
            </button>`;
        }).join('');
    }

    async function openCharPicker() {
        if (!state.currentBook) return;
        try {
            await renderCharPicker();
            openModal(dom.char_picker_modal, { focus: false });
        } catch (error) {
            console.error('[Library] Char picker failed:', error);
            toast('无法读取 iMessage Char');
        }
    }

    async function startTogether(friend) {
        if (!state.currentBook || !friend || friend.type !== 'char') return;
        const imessageView = $('imessage-view');
        const openChat = window.imChat?.openChatTab || window.imApp?.openChatTab;
        if (!imessageView || typeof openChat !== 'function') {
            toast('iMessage 聊天组件未就绪');
            return;
        }

        stopTogether();
        const previousActiveFriendId = window.imData?.currentActiveFriend?.id ?? null;
        state.together = {
            bookId: state.currentBook.id,
            friendId: String(friend.id),
            previousImessageActive: imessageView.classList.contains('active'),
            previousActiveFriendId
        };
        closeAllModals();

        try {
            await openChat(friend);
            imessageView.classList.add('active', 'library-together-popup');
            imessageView.classList.remove('library-together-collapsed');
            imessageView.dataset.libraryTogether = 'true';
            ensureTogetherFloat(friend).hidden = true;
            updateTogetherControls();
            toast(`已邀请 ${friend.nickname || 'Char'} 一起看`);
        } catch (error) {
            console.error('[Library] Together reading start failed:', error);
            stopTogether();
            toast('一起看启动失败');
        }
    }

    function collapseTogetherPopup() {
        if (!state.together) return;
        const imessageView = $('imessage-view');
        const friend = getTogetherFriend();
        imessageView?.classList.add('library-together-collapsed');
        const floatButton = ensureTogetherFloat(friend);
        floatButton.hidden = false;
    }

    function restoreTogetherPopup() {
        if (!state.together) return;
        const friend = getTogetherFriend();
        if (friend && window.imData) window.imData.currentActiveFriend = friend;
        window.imChat?.updateChatsView?.();
        $('imessage-view')?.classList.remove('library-together-collapsed');
        const floatButton = $('library-together-float');
        if (floatButton) floatButton.hidden = true;
    }

    function stopTogether() {
        const session = state.together;
        if (!session) {
            updateTogetherControls();
            return;
        }
        state.together = null;
        const imessageView = $('imessage-view');
        if (imessageView) {
            imessageView.classList.remove('library-together-popup', 'library-together-collapsed');
            delete imessageView.dataset.libraryTogether;
        }
        const floatButton = $('library-together-float');
        if (floatButton) floatButton.hidden = true;

        if (window.imData) {
            window.imData.currentActiveFriend = session.previousActiveFriendId == null
                ? null
                : (window.imData.friends || []).find((friend) => String(friend.id) === String(session.previousActiveFriendId)) || null;
        }
        window.imChat?.updateChatsView?.();
        if (imessageView && !session.previousImessageActive) imessageView.classList.remove('active');
        updateTogetherControls();
    }

    function getTogetherReadingContext(friendOrId) {
        const session = state.together;
        const friendId = typeof friendOrId === 'object' ? friendOrId?.id : friendOrId;
        const book = state.currentBook;
        if (!session || !book || session.bookId !== book.id || String(session.friendId) !== String(friendId ?? '')) return '';
        if (!dom.reader_view.classList.contains('active')) return '';
        const promptXml = (value) => String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        const visibleText = getVisibleReaderText() || '（当前页暂无可见文字）';
        return `<together_reading_context>
<scene>
你正和 User 同步读同一本小说，此刻两人都刚好看到 visible_page 中的内容。这是一次真正的“一起看书”，不是读后总结、文学鉴赏或客服问答。
</scene>
<co_reading_rules>
- 把 visible_page 当作你们眼前同时看到的当前页，优先接住其中具体的台词、动作、情绪、人物或情节变化。
- 像坐在 User 旁边边看边聊：可以即时吐槽、小声感叹、猜接下来会怎样、指出某句话或询问 User 此刻的感受。
- 用符合角色人设和与 User 关系的自然短句交流，反应要有当下感，可以使用“刚看到这里”“这句”“先等一下”等共读语气。
- 不要长篇复述原文，不要每次介绍书名和作者，不要机械声明“我们正在一起看书”。
- 只能根据作品简介和当前页推测，不得捏造后续原文、假装已经看过后文或提前剧透。
- 如果 User 正在说其他事，先自然回应 User，再视氛围决定是否带回当前页，不要强行转回书本。
</co_reading_rules>
<book_title>${promptXml(book.title || '未命名')}</book_title>
<book_author>${promptXml(book.author || '未知作者')}</book_author>
<book_synopsis>${promptXml(book.synopsis || '暂无简介')}</book_synopsis>
<visible_page>${promptXml(visibleText)}</visible_page>
</together_reading_context>`;
    }

    function getTogetherListeningFriendId(friendOrId) {
        return String(typeof friendOrId === 'object' ? (friendOrId?.id ?? '') : (friendOrId ?? ''));
    }

    function isPlayableTrack(track) {
        return !!track && track.available !== false && !!safeHttpUrl(track.mediaUrl);
    }

    function getTogetherListeningSnapshot(friendOrId) {
        const session = state.togetherListening;
        if (!session) return null;
        const requestedFriendId = getTogetherListeningFriendId(friendOrId);
        if (requestedFriendId && String(session.friendId) !== requestedFriendId) return null;

        const track = state.currentTrack;
        const playlist = getPlaylist(session.playlistId);
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
        const currentLyric = state.lyricIndex >= 0 ? state.lyrics[state.lyricIndex] || null : null;
        return {
            friendId: String(session.friendId),
            playlistId: String(session.playlistId),
            playlistName: playlist?.name || '未命名歌单',
            queue: [...session.queue],
            trackId: track?.id || '',
            title: track?.name || '未知歌曲',
            artist: track?.artist || '未知歌手',
            coverUrl: safeImageSource(track?.coverUrl),
            isPlaying: !!track && !audio.paused,
            currentTime,
            duration,
            progress: duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0,
            lyricIndex: state.lyricIndex,
            currentLyric: currentLyric ? { ...currentLyric } : null,
            lyricsStatus: state.lyricsStatus
        };
    }

    function emitTogetherListeningChange(immediate = false) {
        const dispatch = () => {
            togetherListeningEventTimer = null;
            lastTogetherListeningEventAt = Date.now();
            const detail = state.togetherListening ? getTogetherListeningSnapshot(state.togetherListening.friendId) : null;
            window.dispatchEvent(new CustomEvent('library:together-listening-change', { detail }));
        };
        const elapsed = Date.now() - lastTogetherListeningEventAt;
        if (immediate || elapsed >= 750) {
            if (togetherListeningEventTimer) clearTimeout(togetherListeningEventTimer);
            dispatch();
            return;
        }
        if (!togetherListeningEventTimer) togetherListeningEventTimer = setTimeout(dispatch, 750 - elapsed);
    }

    function closeTogetherListeningPicker() {
        const picker = $('library-together-listening-picker');
        if (picker) {
            picker.classList.remove('active');
            picker.setAttribute('aria-hidden', 'true');
        }
        state.togetherPicker = null;
    }

    function renderTogetherListeningPlaylists() {
        const picker = ensureTogetherListeningPicker();
        const list = picker.querySelector('.library-together-playlist-list');
        const empty = picker.querySelector('.library-together-empty');
        const sorted = [...state.playlists].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
        empty.hidden = sorted.length > 0;
        list.hidden = sorted.length === 0;
        list.innerHTML = sorted.map((playlist) => {
            const tracks = playlistTracks(playlist);
            const cover = safeImageSource(playlist.coverUrl || tracks.find((track) => track?.coverUrl)?.coverUrl);
            const playableCount = tracks.filter(isPlayableTrack).length;
            return `<button class="library-together-playlist-item" type="button" data-together-playlist-id="${escapeHtml(playlist.id)}">
                <span class="library-together-picker-art">${cover ? `<img src="${escapeHtml(cover)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '<i class="fas fa-music"></i>'}</span>
                <span class="library-together-picker-copy"><strong>${escapeHtml(playlist.name || '未命名歌单')}</strong><small>${tracks.length} 首歌曲 · ${playableCount} 首可播放</small></span>
                <i class="fas fa-chevron-right"></i>
            </button>`;
        }).join('');
    }

    function renderTogetherListeningTracks() {
        const picker = ensureTogetherListeningPicker();
        const pickerState = state.togetherPicker;
        if (!pickerState?.playlistId) return;
        const playlist = getPlaylist(pickerState.playlistId);
        const tracks = playlistTracks(playlist);
        const query = String(pickerState.query || '').trim().toLocaleLowerCase('zh-CN');
        const filteredTracks = tracks.filter((track) => !query || `${track.name || ''} ${track.artist || ''}`.toLocaleLowerCase('zh-CN').includes(query));
        const list = picker.querySelector('.library-together-track-list');
        const noResults = picker.querySelector('.library-together-no-results');
        const confirm = picker.querySelector('[data-together-picker-action="confirm"]');
        const selected = getTrack(pickerState.selectedTrackId);

        picker.querySelector('.library-together-picker-title').textContent = playlist?.name || '选择歌曲';
        noResults.hidden = filteredTracks.length > 0;
        list.hidden = filteredTracks.length === 0;
        list.innerHTML = filteredTracks.map((track, index) => {
            const playable = isPlayableTrack(track);
            const cover = safeImageSource(track.coverUrl);
            const isSelected = playable && String(track.id) === String(pickerState.selectedTrackId);
            return `<button class="library-together-track-item${isSelected ? ' selected' : ''}" type="button" data-together-track-id="${escapeHtml(track.id)}" ${playable ? '' : 'disabled'}>
                <span class="library-together-track-index">${isSelected ? '<i class="fas fa-check"></i>' : index + 1}</span>
                <span class="library-together-picker-art">${cover ? `<img src="${escapeHtml(cover)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '<i class="fas fa-music"></i>'}</span>
                <span class="library-together-picker-copy"><strong>${escapeHtml(track.name || '未知歌曲')}</strong><small>${escapeHtml(track.artist || '未知歌手')}${playable ? '' : ' · 不可播放'}</small></span>
            </button>`;
        }).join('');
        confirm.disabled = !isPlayableTrack(selected) || !tracks.some((track) => String(track.id) === String(selected?.id));
    }

    function showTogetherListeningPlaylistStep() {
        const picker = ensureTogetherListeningPicker();
        picker.classList.remove('show-tracks');
        picker.querySelector('.library-together-picker-title').textContent = '选择歌单';
        picker.querySelector('.library-together-picker-search').value = '';
        renderTogetherListeningPlaylists();
    }

    function showTogetherListeningTrackStep(playlistId) {
        const playlist = getPlaylist(playlistId);
        if (!playlist || !state.togetherPicker) return;
        const tracks = playlistTracks(playlist);
        const firstPlayable = tracks.find(isPlayableTrack) || null;
        state.togetherPicker.playlistId = String(playlist.id);
        state.togetherPicker.selectedTrackId = firstPlayable?.id || '';
        state.togetherPicker.query = '';
        const picker = ensureTogetherListeningPicker();
        picker.classList.add('show-tracks');
        picker.querySelector('.library-together-picker-search').value = '';
        renderTogetherListeningTracks();
    }

    async function startTogetherListening(friend, playlist, track) {
        if (!friend || friend.type !== 'char' || !playlist || !isPlayableTrack(track)) return false;
        const queue = playlistTracks(playlist).map((item) => item.id);
        state.togetherListening = {
            friendId: String(friend.id),
            playlistId: String(playlist.id),
            queue
        };
        closeTogetherListeningPicker();
        emitTogetherListeningChange(true);
        await playTrack(track, queue);
        toast(`已和 ${friend.nickname || friend.realName || 'Char'} 一起听`);
        return true;
    }

    function stopTogetherListening(friendOrId, options = {}) {
        const session = state.togetherListening;
        if (!session) return false;
        const requestedFriendId = getTogetherListeningFriendId(friendOrId);
        if (requestedFriendId && requestedFriendId !== String(session.friendId)) return false;
        state.togetherListening = null;
        state.playerReturnToChatFriendId = null;
        emitTogetherListeningChange(true);
        if (!options.silent) toast('已退出一起听，音乐将继续播放');
        return true;
    }

    function ensureTogetherListeningPicker() {
        let picker = $('library-together-listening-picker');
        if (picker) return picker;
        picker = document.createElement('section');
        picker.id = 'library-together-listening-picker';
        picker.className = 'library-together-picker';
        picker.setAttribute('aria-hidden', 'true');
        picker.innerHTML = `
            <div class="library-together-picker-backdrop" data-together-picker-action="close"></div>
            <div class="library-together-picker-card" role="dialog" aria-modal="true" aria-label="选择一起听的歌曲">
                <header>
                    <button class="library-together-picker-back" type="button" data-together-picker-action="back" aria-label="返回"><i class="fas fa-chevron-left"></i></button>
                    <strong class="library-together-picker-title">选择歌单</strong>
                    <button type="button" data-together-picker-action="close" aria-label="关闭"><i class="fas fa-times"></i></button>
                </header>
                <div class="library-together-picker-playlists">
                    <div class="library-together-playlist-list"></div>
                    <div class="library-together-empty" hidden>
                        <i class="fas fa-music"></i><strong>Library 还没有歌单</strong><span>先添加歌单或歌曲，再来和 Char 一起听。</span>
                        <button type="button" data-together-picker-action="open-library">前往 Library 添加</button>
                    </div>
                </div>
                <div class="library-together-picker-tracks">
                    <label class="library-together-search"><i class="fas fa-search"></i><input class="library-together-picker-search" type="search" placeholder="搜索歌曲或歌手" autocomplete="off"></label>
                    <div class="library-together-track-list"></div>
                    <div class="library-together-no-results" hidden>没有找到匹配的歌曲</div>
                    <button class="library-together-confirm" type="button" data-together-picker-action="confirm">确定并开始一起听</button>
                </div>
            </div>`;
        ($('imessage-view') || document.body).appendChild(picker);

        picker.addEventListener('click', async (event) => {
            const action = event.target.closest('[data-together-picker-action]')?.dataset.togetherPickerAction;
            if (action === 'close') return closeTogetherListeningPicker();
            if (action === 'back') return showTogetherListeningPlaylistStep();
            if (action === 'open-library') {
                closeTogetherListeningPicker();
                openApp('music');
                return;
            }
            const playlistButton = event.target.closest('[data-together-playlist-id]');
            if (playlistButton) return showTogetherListeningTrackStep(playlistButton.dataset.togetherPlaylistId);
            const trackButton = event.target.closest('[data-together-track-id]');
            if (trackButton && !trackButton.disabled && state.togetherPicker) {
                state.togetherPicker.selectedTrackId = trackButton.dataset.togetherTrackId;
                renderTogetherListeningTracks();
                return;
            }
            if (action === 'confirm' && state.togetherPicker) {
                const friend = (window.imData?.friends || []).find((item) => String(item.id) === String(state.togetherPicker.friendId));
                const playlist = getPlaylist(state.togetherPicker.playlistId);
                const track = getTrack(state.togetherPicker.selectedTrackId);
                await startTogetherListening(friend, playlist, track);
            }
        });
        picker.querySelector('.library-together-picker-search').addEventListener('input', (event) => {
            if (!state.togetherPicker) return;
            state.togetherPicker.query = event.target.value;
            renderTogetherListeningTracks();
        });
        return picker;
    }

    function openTogetherListeningPicker(friend) {
        if (!state.ready) return toast('Library 正在加载，请稍后再试');
        if (!friend || friend.type !== 'char') return toast('一起听仅支持 Char 单聊');
        if (getTogetherListeningSnapshot(friend)) {
            stopTogetherListening(friend);
            return;
        }
        state.togetherPicker = {
            friendId: String(friend.id),
            playlistId: '',
            selectedTrackId: '',
            query: ''
        };
        const picker = ensureTogetherListeningPicker();
        showTogetherListeningPlaylistStep();
        picker.classList.add('active');
        picker.setAttribute('aria-hidden', 'false');
    }

    async function controlTogetherListening(friendOrId, command = {}) {
        const snapshot = getTogetherListeningSnapshot(friendOrId);
        if (!snapshot) return false;
        const action = String(command.action || '').trim().toLowerCase();
        if (action === 'toggle') {
            togglePlayback();
            return true;
        }
        if (action === 'next' || action === 'previous') {
            state.queue = [...snapshot.queue];
            state.queueIndex = state.queue.findIndex((id) => String(id) === String(snapshot.trackId));
            playQueueDirection(action === 'next' ? 1 : -1);
            return true;
        }
        if (action !== 'play_track') return false;
        const trackId = String(command.trackId || '').trim();
        if (!trackId || !snapshot.queue.some((id) => String(id) === trackId)) return false;
        const track = getTrack(trackId);
        if (!isPlayableTrack(track) || String(track.playlistId) !== String(snapshot.playlistId)) return false;
        await playTrack(track, snapshot.queue);
        return true;
    }

    function openTogetherListeningPlayer(friendOrId) {
        const snapshot = getTogetherListeningSnapshot(friendOrId);
        if (!snapshot || !state.currentTrack) return false;
        state.playerReturnToChatFriendId = snapshot.friendId;
        openApp('music');
        openPlayer();
        return true;
    }

    function formatLrcTimestamp(seconds) {
        const safe = Math.max(0, Number(seconds) || 0);
        const minutes = Math.floor(safe / 60);
        const secs = Math.floor(safe % 60);
        const hundredths = Math.floor((safe - Math.floor(safe)) * 100);
        return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
    }

    function getTogetherListeningContext(friendOrId) {
        const snapshot = getTogetherListeningSnapshot(friendOrId);
        if (!snapshot) return '';
        const session = state.togetherListening;
        const playlist = getPlaylist(snapshot.playlistId);
        const track = state.currentTrack;
        if (!session || !playlist || !track) return '';
        const xml = (value) => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
        const lyricsStatusText = {
            loading: '歌词正在加载，当前不可用',
            unavailable: '歌曲没有歌词地址，歌词不可用',
            error: '歌词加载失败，歌词不可用',
            ready: '歌词已完整加载',
            idle: '歌词尚未加载'
        }[state.lyricsStatus] || '歌词状态未知';
        const fullLyrics = state.lyrics.length
            ? state.lyrics.map((line, index) => `${index === state.lyricIndex ? '▶ ' : ''}[${formatLrcTimestamp(line.time)}] ${line.text}`).join('\n')
            : `（${lyricsStatusText}）`;
        const currentLine = snapshot.currentLyric
            ? `[${formatLrcTimestamp(snapshot.currentLyric.time)}] ${snapshot.currentLyric.text}`
            : '（尚未播放到第一句，或当前没有可用歌词）';
        const catalog = playlistTracks(playlist).map((item) =>
            `<track id="${xml(item.id)}" available="${isPlayableTrack(item) ? 'true' : 'false'}"><title>${xml(item.name || '未知歌曲')}</title><artist>${xml(item.artist || '未知歌手')}</artist></track>`
        ).join('\n');
        return `<together_listening_context>
<scene>你正在和 User 同步听歌。以下播放状态是本次 API 请求发起时的实时快照。</scene>
<listening_rules>
- 你可以自然谈论当前歌曲、歌手、完整歌词和正在播放到的这一句，但不要机械复述全部歌词。
- 歌词不可用时必须明确承认不知道歌词，绝对禁止编造歌词。
- 只有 User 明确要求切歌或点歌时，才可以输出一个 music_control；不得主动切歌，每轮最多一个。
- “下一首”使用 {"type":"music_control","action":"next"}，“上一首”使用 {"type":"music_control","action":"previous"}。
- 指定歌曲只能从 available_playlist_tracks 中选择 available=true 的歌曲，并使用准确 ID：{"type":"music_control","action":"play_track","trackId":"歌曲ID"}。
- 歌名有歧义、没有命中或歌曲不可播放时，不要输出 music_control，改为在普通聊天气泡中询问或说明。
</listening_rules>
<playlist id="${xml(snapshot.playlistId)}">${xml(snapshot.playlistName)}</playlist>
<current_track id="${xml(snapshot.trackId)}"><title>${xml(snapshot.title)}</title><artist>${xml(snapshot.artist)}</artist></current_track>
<playback_state>${snapshot.isPlaying ? 'playing' : 'paused'}</playback_state>
<position seconds="${snapshot.currentTime.toFixed(2)}" duration="${snapshot.duration.toFixed(2)}">${xml(formatClock(snapshot.currentTime))} / ${xml(formatClock(snapshot.duration))}</position>
<lyrics_status>${xml(lyricsStatusText)}</lyrics_status>
<current_lyric index="${snapshot.lyricIndex}">${xml(currentLine)}</current_lyric>
<available_playlist_tracks>
${catalog}
</available_playlist_tracks>
<full_timed_lyrics>
${xml(fullLyrics)}
</full_timed_lyrics>
</together_listening_context>`;
    }

    function renderPlaylists() {
        const sorted = [...state.playlists].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
        dom.playlist_count.textContent = `${sorted.length} ${sorted.length === 1 ? 'PLAYLIST' : 'PLAYLISTS'}`;
        dom.music_empty.hidden = sorted.length > 0;
        dom.playlist_list.hidden = sorted.length === 0;
        dom.playlist_list.innerHTML = sorted.map((playlist) => {
            const count = Array.isArray(playlist.trackIds) ? playlist.trackIds.length : 0;
            const cover = safeHttpUrl(playlist.coverUrl);
            return `
                <button class="library-playlist-card" type="button" data-playlist-id="${escapeHtml(playlist.id)}">
                    <span class="library-playlist-cover">${cover ? `<img src="${escapeHtml(cover)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '<i class="fas fa-music"></i>'}</span>
                    <span><strong>${escapeHtml(playlist.name || '未命名歌单')}</strong><small>${count} 首歌曲 · ${escapeHtml(playlist.source === 'netease' ? '网易云音乐' : 'Library')}</small></span>
                    <i class="fas fa-chevron-right"></i>
                </button>`;
        }).join('');
    }

    function playlistTracks(playlist) {
        return (playlist?.trackIds || []).map(getTrack).filter(Boolean);
    }

    function openPlaylist(playlist) {
        if (!playlist) return;
        state.currentPlaylist = playlist;
        const tracks = playlistTracks(playlist);
        dom.playlist_title.textContent = playlist.name || '未命名歌单';
        dom.playlist_meta.textContent = `${tracks.length} 首歌曲${playlist.source === 'netease' ? ' · 网易云音乐' : ''}`;
        setArtwork(dom.playlist_cover, playlist.coverUrl);
        dom.track_list.innerHTML = tracks.map((track, index) => `
            <button class="library-track-row${track.available === false ? ' unavailable' : ''}" type="button" data-track-id="${escapeHtml(track.id)}">
                <span class="library-track-art">${safeHttpUrl(track.coverUrl) ? `<img src="${escapeHtml(safeHttpUrl(track.coverUrl))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '<i class="fas fa-music"></i>'}</span>
                <span><strong>${escapeHtml(track.name || '未知歌曲')}</strong><small>${escapeHtml(track.artist || '未知歌手')}</small></span>
                <span>${track.available === false ? '不可播放' : String(index + 1).padStart(2, '0')}</span>
            </button>`).join('');
        dom.playlist_view.classList.add('active');
        dom.playlist_view.setAttribute('aria-hidden', 'false');
    }

    function closePlaylist() {
        dom.playlist_view.classList.remove('active');
        dom.playlist_view.setAttribute('aria-hidden', 'true');
        state.currentPlaylist = null;
    }

    async function ensureManualPlaylist() {
        let playlist = state.playlists.find((item) => item.id === 'library_manual_playlist');
        if (playlist) return playlist;
        playlist = {
            id: 'library_manual_playlist',
            name: '我的歌单',
            source: 'manual',
            coverUrl: '',
            trackIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        await storage().saveLibraryPlaylistBundle(playlist, []);
        state.playlists.push(playlist);
        return playlist;
    }

    function openModal(modal, options = {}) {
        closeAllModals();
        modal.hidden = false;
        if (options.focus !== false) requestAnimationFrame(() => modal.querySelector('input, textarea')?.focus());
    }

    function closeAllModals() {
        [dom.import_modal, dom.track_modal, dom.book_detail_modal, dom.char_picker_modal].forEach((modal) => { if (modal) modal.hidden = true; });
        if (dom.book_edit_form) setBookDetailEditing(false);
    }

    async function addDirectTrack(event) {
        event.preventDefault();
        const name = dom.track_name.value.trim();
        const artist = dom.track_artist.value.trim() || '未知歌手';
        const mediaUrl = safeHttpUrl(dom.track_url.value);
        const coverUrl = dom.track_cover_url.value.trim() ? safeHttpUrl(dom.track_cover_url.value) : '';
        const lyricUrl = dom.track_lyric_url.value.trim() ? safeHttpUrl(dom.track_lyric_url.value) : '';
        if (!name || !mediaUrl) return toast('请填写歌曲名称和有效的音频 URL');
        if (dom.track_cover_url.value.trim() && !coverUrl) return toast('封面 URL 无效');
        if (dom.track_lyric_url.value.trim() && !lyricUrl) return toast('歌词 URL 无效');

        try {
            const playlist = await ensureManualPlaylist();
            const now = Date.now();
            const track = {
                id: uid('track'),
                playlistId: playlist.id,
                source: 'url',
                name,
                artist,
                mediaUrl,
                coverUrl,
                lyricUrl,
                available: true,
                createdAt: now,
                updatedAt: now
            };
            playlist.trackIds = [...(playlist.trackIds || []), track.id];
            playlist.coverUrl = playlist.coverUrl || coverUrl;
            playlist.updatedAt = now;
            await storage().saveLibraryPlaylistBundle(playlist, [track]);
            state.tracks.push(track);
            renderPlaylists();
            dom.track_form.reset();
            closeAllModals();
            toast('歌曲已添加到我的歌单');
        } catch (error) {
            console.error('[Library] Track save failed:', error);
            toast('歌曲保存失败');
        }
    }

    function extractSharedPlaylistName(input, playlistId) {
        const text = String(input || '');
        const quoted = text.match(/(?:歌单|分享)\s*[《「“"]([^》」”"\n]{1,80})[》」”"]/);
        if (quoted) return quoted[1].trim();
        const byLine = text.match(/分享歌单[:：]\s*([^\n]{1,80})/);
        if (byLine) {
            const sharedName = byLine[1].replace(/https?:\/\/.*$/, '').trim();
            if (sharedName) return sharedName;
        }
        return `网易云歌单 ${String(playlistId).slice(-6)}`;
    }

    async function fetchJson(url, timeoutMs = 25000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { signal: controller.signal, mode: 'cors', credentials: 'omit' });
            if (!response.ok) {
                const error = new Error(`请求失败 (${response.status})`);
                error.httpStatus = response.status;
                throw error;
            }
            return await response.json();
        } finally {
            clearTimeout(timer);
        }
    }

    function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function extractNetEaseShareUrl(input) {
        const raw = String(input || '').trim();
        if (!raw) return '';
        const match = raw.match(/https?:\/\/(?:(?:y\.)?music\.163\.com\/[^\s)）\]】}>]+|163cn\.tv\/+[a-zA-Z0-9]+)/i);
        return match ? match[0].replace(/[.,，。!！?？;；:：'"”’]+$/g, '') : '';
    }

    function extractNetEasePlaylistId(target) {
        const raw = String(target || '').trim();
        if (!raw) return '';

        try {
            const url = new URL(raw);
            const queryId = url.searchParams.get('id');
            if (/^\d+$/.test(queryId || '')) return queryId;

            const hash = String(url.hash || '').replace(/^#/, '');
            const hashQueryIndex = hash.indexOf('?');
            if (hashQueryIndex >= 0) {
                const hashId = new URLSearchParams(hash.slice(hashQueryIndex + 1)).get('id');
                if (/^\d+$/.test(hashId || '')) return hashId;
            }

            const pathMatch = url.pathname.match(/\/playlist\/(\d+)/i);
            if (pathMatch) return pathMatch[1];
        } catch (error) {
            // Fall through to the tolerant text patterns below.
        }

        const fallbackMatch = raw.match(/[?&#]id=(\d+)/i) || raw.match(/\/playlist\/(\d+)/i);
        return fallbackMatch ? fallbackMatch[1] : '';
    }

    async function resolveNetEasePlaylistId(input) {
        const raw = String(input || '').trim();
        if (!raw) throw new Error('请粘贴网易云歌单链接');
        if (/^\d{5,}$/.test(raw)) return raw;
        let target = extractNetEaseShareUrl(raw);
        if (!target) throw new Error('没有找到网易云歌单链接，请粘贴完整分享文字、歌单链接或歌单 ID');

        if (/^https?:\/\/163cn\.tv\/+/i.test(target)) {
            let result;
            try {
                result = await fetchJson(`${NETEASE_REDIRECT_API}?url=${encodeURIComponent(target)}`);
            } catch (error) {
                if (error?.name === 'AbortError') throw error;
                throw new Error(`网易云短链接解析失败${error?.message ? `：${error.message}` : ''}`);
            }
            if (result?.code !== 200 || !result.redirectUrl) {
                throw new Error('网易云短链接解析失败，请尝试粘贴完整歌单链接');
            }
            target = String(result.redirectUrl).trim();
        }

        const playlistId = extractNetEasePlaylistId(target);
        if (!playlistId) throw new Error('没有找到歌单 ID，请确认粘贴的是歌单链接');
        return playlistId;
    }

    function buildNetEaseMetingEndpoint(baseUrl, playlistId, cacheBust = '') {
        const separator = String(baseUrl).includes('?') ? '&' : '?';
        const cacheParam = cacheBust ? `&_=${encodeURIComponent(cacheBust)}` : '';
        return `${baseUrl}${separator}server=netease&type=playlist&id=${encodeURIComponent(playlistId)}${cacheParam}`;
    }

    function isRetryableNetEasePlaylistError(error) {
        if (['NETEASE_EMPTY_RESPONSE', 'NETEASE_INVALID_RESPONSE'].includes(error?.code)) return true;
        if (['AbortError', 'SyntaxError', 'TypeError'].includes(error?.name)) return true;
        const status = Number(error?.httpStatus);
        return status === 408 || status === 425 || status === 429 || status >= 500;
    }

    function describeNetEasePlaylistAttemptError(error) {
        if (error?.code === 'NETEASE_EMPTY_RESPONSE') return '接口返回空数组';
        if (error?.code === 'NETEASE_INVALID_RESPONSE') {
            return `接口返回格式异常${error.responseDescription ? ` (${error.responseDescription})` : ''}`;
        }
        if (error?.name === 'AbortError') return '请求超时';
        return error?.message || '未知错误';
    }

    function describeJsonPayload(value) {
        if (value === null) return 'null';
        if (Array.isArray(value)) return `array:${value.length}`;
        if (typeof value === 'object') {
            const keys = Object.keys(value).slice(0, 8);
            const message = typeof value.message === 'string' ? value.message.replace(/\s+/g, ' ').slice(0, 120) : '';
            return `object:${keys.length ? keys.join(',') : 'no-keys'}${message ? `:${message}` : ''}`;
        }
        return typeof value;
    }

    async function fetchNetEasePlaylistRows(playlistId) {
        let lastError = null;

        for (let attempt = 1; attempt <= NETEASE_PLAYLIST_MAX_ATTEMPTS; attempt += 1) {
            const cacheBust = `${Date.now()}-${attempt}`;
            const endpoint = buildNetEaseMetingEndpoint(NETEASE_METING_API, playlistId, cacheBust);
            try {
                const rows = await fetchJson(endpoint, NETEASE_PLAYLIST_REQUEST_TIMEOUT);
                if (!Array.isArray(rows)) {
                    const apiMessage = typeof rows?.message === 'string' ? rows.message.trim().slice(0, 200) : '';
                    if (apiMessage) {
                        const error = new Error(`网易云歌单接口提示：${apiMessage}`);
                        error.code = 'NETEASE_API_MESSAGE';
                        throw error;
                    }
                    const error = new Error('网易云歌单接口返回格式异常');
                    error.code = 'NETEASE_INVALID_RESPONSE';
                    error.responseDescription = describeJsonPayload(rows);
                    throw error;
                }
                if (rows.length === 0) {
                    const error = new Error('网易云歌单接口返回空数组');
                    error.code = 'NETEASE_EMPTY_RESPONSE';
                    throw error;
                }
                console.info(`[Library] NetEase playlist ${playlistId}: attempt ${attempt}/${NETEASE_PLAYLIST_MAX_ATTEMPTS}, ${rows.length} rows`);
                return rows;
            } catch (error) {
                lastError = error;
                const retryable = isRetryableNetEasePlaylistError(error);
                console.warn(`[Library] NetEase playlist ${playlistId}: attempt ${attempt}/${NETEASE_PLAYLIST_MAX_ATTEMPTS} failed (${describeNetEasePlaylistAttemptError(error)})`);
                if (!retryable || attempt === NETEASE_PLAYLIST_MAX_ATTEMPTS) break;
                await wait(NETEASE_PLAYLIST_RETRY_DELAYS[attempt - 1] || 0);
            }
        }

        if (lastError?.code === 'NETEASE_EMPTY_RESPONSE') {
            throw new Error(`网易云歌单接口连续 ${NETEASE_PLAYLIST_MAX_ATTEMPTS} 次未返回歌曲，服务暂时异常或歌单当前不可访问`);
        }
        if (lastError?.code === 'NETEASE_INVALID_RESPONSE' || lastError?.name === 'SyntaxError') {
            throw new Error(`网易云歌单接口连续 ${NETEASE_PLAYLIST_MAX_ATTEMPTS} 次返回格式异常，请稍后重试`);
        }
        if (lastError?.name === 'AbortError') {
            throw new Error(`网易云歌单接口连续 ${NETEASE_PLAYLIST_MAX_ATTEMPTS} 次响应超时，请稍后重试`);
        }
        throw lastError || new Error('网易云歌单接口请求失败');
    }

    async function importNetEasePlaylist(input) {
        const playlistId = await resolveNetEasePlaylistId(input);
        let rows;
        try {
            rows = await fetchNetEasePlaylistRows(playlistId);
        } catch (error) {
            if (error?.name === 'AbortError') throw error;
            throw new Error(`网易云歌单读取失败${error?.message ? `：${error.message}` : ''}`);
        }
        if (!Array.isArray(rows) || rows.length === 0) throw new Error('歌单为空、未公开或暂时无法解析');

        const now = Date.now();
        const playlistKey = `netease_playlist_${playlistId}`;
        const tracks = rows.map((row, index) => {
            const sourceUrl = safeHttpUrl(row?.url);
            const songId = String(row?.id || extractNetEaseResourceId(sourceUrl) || '').trim();
            const sourceCoverUrl = safeHttpUrl(row?.pic || row?.cover);
            const sourceLyricUrl = safeHttpUrl(row?.lrc || row?.lyric);
            const picId = extractNetEaseResourceId(sourceCoverUrl);
            const lyricId = extractNetEaseResourceId(sourceLyricUrl) || songId;
            const trackId = songId ? `netease_track_${playlistId}_${songId}` : `netease_track_${playlistId}_${index}`;
            return normalizeNetEaseTrackResources({
                id: trackId,
                playlistId: playlistKey,
                source: 'netease',
                neteaseId: songId || '',
                neteasePicId: picId || '',
                neteaseLyricId: lyricId || '',
                name: String(row?.name || row?.title || `歌曲 ${index + 1}`).slice(0, 120),
                artist: String(row?.artist || row?.author || '未知歌手').slice(0, 120),
                mediaUrl: sourceUrl,
                coverUrl: sourceCoverUrl,
                lyricUrl: sourceLyricUrl,
                available: !!sourceUrl,
                createdAt: now,
                updatedAt: now
            });
        });
        if (!tracks.some((track) => track.available)) throw new Error('歌单中没有可播放的歌曲');

        const previous = getPlaylist(playlistKey);
        const playlist = {
            id: playlistKey,
            source: 'netease',
            sourceId: playlistId,
            sourceUrl: `https://music.163.com/playlist?id=${playlistId}`,
            name: previous?.name || extractSharedPlaylistName(input, playlistId),
            coverUrl: tracks.find((track) => track.coverUrl)?.coverUrl || '',
            trackIds: tracks.map((track) => track.id),
            createdAt: previous?.createdAt || now,
            updatedAt: now
        };

        await storage().saveLibraryPlaylistBundle(playlist, tracks, { replaceTracks: true });
        state.playlists = state.playlists.filter((item) => item.id !== playlist.id);
        state.playlists.push(playlist);
        state.tracks = state.tracks.filter((track) => track.playlistId !== playlist.id).concat(tracks);
        renderPlaylists();
        return playlist;
    }

    async function handleNetEaseImport(event) {
        event?.preventDefault();
        const input = dom.netease_input.value.trim();
        const submit = dom.import_form.querySelector('[type="submit"]');
        submit.disabled = true;
        submit.textContent = '正在读取歌单…';
        try {
            const playlist = await importNetEasePlaylist(input);
            dom.import_form.reset();
            closeAllModals();
            toast(`已导入《${playlist.name}》`);
            openPlaylist(playlist);
        } catch (error) {
            console.error('[Library] NetEase import failed:', error);
            toast(error?.name === 'AbortError' ? '网易云服务响应超时，请稍后重试' : (error?.message || '网易云歌单导入失败'));
        } finally {
            submit.disabled = false;
            submit.textContent = '开始导入';
        }
    }

    function requestDeletePlaylist(playlist) {
        if (!playlist) return;
        const remove = async () => {
            const removingCurrent = state.currentTrack?.playlistId === playlist.id;
            if (removingCurrent) {
                audio.pause();
                audio.removeAttribute('src');
                state.currentTrack = null;
                state.queue = [];
                updatePlayerUi();
            }
            await storage().deleteLibraryPlaylist(playlist.id);
            state.playlists = state.playlists.filter((item) => item.id !== playlist.id);
            state.tracks = state.tracks.filter((track) => track.playlistId !== playlist.id);
            closePlaylist();
            renderPlaylists();
            toast('歌单已删除');
        };
        if (window.showCustomModal) {
            window.showCustomModal({ title: '删除歌单', message: `确定删除《${playlist.name}》及其中歌曲吗？`, confirmText: '删除', isDestructive: true, onConfirm: remove });
        } else if (window.confirm(`确定删除《${playlist.name}》吗？`)) remove();
    }

    function parseLrc(text) {
        const lines = [];
        String(text || '').split(/\r?\n/).forEach((line) => {
            const tags = [...line.matchAll(/\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];
            const content = line.replace(/\[[^\]]+\]/g, '').trim();
            if (!content) return;
            tags.forEach((tag) => {
                const fractionRaw = tag[3] || '0';
                const fraction = Number(fractionRaw) / (fractionRaw.length === 3 ? 1000 : 100);
                lines.push({ time: Number(tag[1]) * 60 + Number(tag[2]) + fraction, text: content });
            });
        });
        return lines.sort((a, b) => a.time - b.time);
    }

    async function loadLyrics(track) {
        const requestId = ++state.lyricsRequestId;
        state.lyrics = [];
        state.lyricIndex = -1;
        state.lyricsTrackId = track?.id || null;
        state.lyricsStatus = 'loading';
        dom.lyrics.innerHTML = '<p class="active">正在读取歌词…</p>';
        emitTogetherListeningChange(true);
        if (!track?.lyricUrl) {
            state.lyricsStatus = 'unavailable';
            dom.lyrics.innerHTML = '<p class="active">这首歌暂时没有歌词</p>';
            emitTogetherListeningChange(true);
            return;
        }
        try {
            const response = await fetch(track.lyricUrl, { mode: 'cors', credentials: 'omit' });
            if (!response.ok) throw new Error('Lyric request failed');
            const parsedLyrics = parseLrc(await response.text());
            if (requestId !== state.lyricsRequestId || String(state.currentTrack?.id || '') !== String(track.id || '')) return;
            state.lyrics = parsedLyrics;
            state.lyricsStatus = state.lyrics.length ? 'ready' : 'unavailable';
            dom.lyrics.innerHTML = state.lyrics.length
                ? state.lyrics.map((line, index) => `<p data-lyric-index="${index}">${escapeHtml(line.text)}</p>`).join('')
                : '<p class="active">这首歌暂时没有歌词</p>';
            updateLyrics(Number(audio.currentTime) || 0);
            emitTogetherListeningChange(true);
        } catch (error) {
            if (requestId !== state.lyricsRequestId || String(state.currentTrack?.id || '') !== String(track?.id || '')) return;
            console.warn('[Library] Lyrics unavailable:', error);
            state.lyricsStatus = 'error';
            dom.lyrics.innerHTML = '<p class="active">歌词加载失败</p>';
            emitTogetherListeningChange(true);
        }
    }

    function setPlayerLyricsMode(showLyrics) {
        state.playerShowsLyrics = !!showLyrics;
        dom.player_stage.classList.toggle('is-lyrics', state.playerShowsLyrics);
        dom.lyrics.hidden = !state.playerShowsLyrics;
        dom.player_art.setAttribute('aria-label', state.playerShowsLyrics ? '显示封面' : '查看歌词');
        if (state.playerShowsLyrics && state.lyricIndex >= 0) {
            requestAnimationFrame(() => {
                const active = dom.lyrics.querySelector(`[data-lyric-index="${state.lyricIndex}"]`);
                if (active) dom.lyrics.scrollTop = Math.max(0, active.offsetTop - dom.lyrics.clientHeight / 2);
            });
        }
    }

    function updateLyrics(currentTime) {
        if (!state.lyrics.length) return;
        let nextIndex = -1;
        for (let index = 0; index < state.lyrics.length; index += 1) {
            if (state.lyrics[index].time <= currentTime + 0.05) nextIndex = index;
            else break;
        }
        if (nextIndex === state.lyricIndex) return;
        state.lyricIndex = nextIndex;
        dom.lyrics.querySelectorAll('p').forEach((line, index) => line.classList.toggle('active', index === nextIndex));
        if (nextIndex >= 0) {
            const active = dom.lyrics.querySelector(`[data-lyric-index="${nextIndex}"]`);
            if (active) dom.lyrics.scrollTo({ top: Math.max(0, active.offsetTop - dom.lyrics.clientHeight / 2), behavior: 'smooth' });
        }
    }

    function isNetEaseTrack(track) {
        return track?.source === 'netease' && /^\d+$/.test(String(track.neteaseId || ''));
    }

    function getTrackPlaybackUrl(track, attemptId) {
        if (isNetEaseTrack(track)) {
            return buildNetEaseResourceUrl('url', track.neteaseId, `${Date.now()}-${attemptId}`);
        }
        return safeHttpUrl(track?.mediaUrl);
    }

    function finishPlaybackFailure(track, error) {
        state.pendingPlayStatTrackId = null;
        console.warn('[Library] Playback failed:', error);
        toast('当前歌曲暂时无法播放');
        updatePlayerUi();
        emitTogetherListeningChange(true);
    }

    async function startTrackPlaybackAttempt(track) {
        const attemptId = state.playbackAttemptId + 1;
        state.playbackAttemptId = attemptId;
        state.playbackStartingAttemptId = attemptId;
        const playbackUrl = getTrackPlaybackUrl(track, attemptId);

        if (!playbackUrl) {
            finishPlaybackFailure(track, new Error('歌曲没有有效的播放地址'));
            return false;
        }

        audio.src = playbackUrl;
        audio.load();
        try {
            await audio.play();
            return attemptId === state.playbackAttemptId && state.currentTrack?.id === track.id;
        } catch (error) {
            if (attemptId !== state.playbackAttemptId || state.currentTrack?.id !== track.id) return false;
            const canRetry = isNetEaseTrack(track)
                && state.neteasePlaybackRetryCount < 1
                && error?.name !== 'NotAllowedError';
            if (canRetry) {
                state.neteasePlaybackRetryCount += 1;
                console.warn(`[Library] NetEase playback retry ${state.neteasePlaybackRetryCount}/1 for track ${track.neteaseId}`);
                return startTrackPlaybackAttempt(track);
            }
            finishPlaybackFailure(track, error);
            return false;
        } finally {
            if (state.playbackStartingAttemptId === attemptId) state.playbackStartingAttemptId = 0;
        }
    }

    async function playTrack(track, queue) {
        if (!track || track.available === false || !safeHttpUrl(track.mediaUrl)) {
            toast('这首歌暂时无法播放');
            return;
        }
        flushListeningStats().catch(console.error);
        if (Array.isArray(queue) && queue.length) state.queue = queue.filter((id) => !!getTrack(id));
        if (!state.queue.includes(track.id)) state.queue = [track.id];
        state.queueIndex = state.queue.indexOf(track.id);
        state.currentTrack = track;
        state.lastMediaTime = 0;
        state.neteasePlaybackRetryCount = 0;
        state.pendingPlayStatTrackId = track.id;
        updatePlayerUi();
        emitTogetherListeningChange(true);
        loadLyrics(track);
        await startTrackPlaybackAttempt(track);
    }

    function playQueueDirection(direction) {
        if (!state.queue.length) return;
        const total = state.queue.length;
        for (let step = 1; step <= total; step += 1) {
            const index = (state.queueIndex + direction * step + total) % total;
            const track = getTrack(state.queue[index]);
            if (track?.available !== false && safeHttpUrl(track?.mediaUrl)) {
                state.queueIndex = index;
                playTrack(track, state.queue);
                return;
            }
        }
        toast('歌单中没有可播放的歌曲');
    }

    function togglePlayback() {
        if (!state.currentTrack) {
            const first = state.tracks.find((track) => track.available !== false && safeHttpUrl(track.mediaUrl));
            if (first) playTrack(first, [first.id]);
            else toast('还没有可播放的歌曲');
            return;
        }
        if (audio.paused) audio.play().catch(() => toast('当前歌曲暂时无法播放'));
        else audio.pause();
    }

    function openPlayer() {
        if (!state.currentTrack) return;
        dom.player_view.classList.add('active');
        dom.player_view.setAttribute('aria-hidden', 'false');
    }

    function closePlayer() {
        dom.player_view.classList.remove('active');
        dom.player_view.setAttribute('aria-hidden', 'true');
        if (state.playerReturnToChatFriendId) {
            state.playerReturnToChatFriendId = null;
            dom.view.classList.remove('active');
            setLibraryViewHidden(true);
            $('imessage-view')?.classList.add('active');
        }
    }

    function updatePlayerUi() {
        const track = state.currentTrack;
        const hasTrack = !!track;
        dom.mini_player.hidden = !hasTrack;
        dom.view.classList.toggle('has-mini-player', hasTrack);
        if (!hasTrack) return;
        dom.mini_title.textContent = track.name || '未知歌曲';
        dom.mini_artist.textContent = track.artist || '未知歌手';
        dom.player_title.textContent = track.name || '未知歌曲';
        dom.player_artist.textContent = track.artist || '未知歌手';
        setArtwork(dom.mini_art, track.coverUrl);
        setArtwork(dom.player_art, track.coverUrl);
        const cover = safeHttpUrl(track.coverUrl);
        dom.player_wash.style.backgroundImage = cover
            ? `linear-gradient(rgba(229,234,230,.45),rgba(245,243,237,.82)),url("${cover.replace(/"/g, '%22')}")`
            : '';
        dom.player_wash.style.backgroundSize = 'cover';
        dom.player_wash.style.backgroundPosition = 'center';
        const icon = audio.paused ? 'fa-play' : 'fa-pause';
        dom.mini_play.innerHTML = `<i class="fas ${icon}"></i>`;
        dom.player_play.innerHTML = `<i class="fas ${icon}"></i>`;
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
        const ratio = duration > 0 ? current / duration : 0;
        dom.player_progress.value = String(Math.round(ratio * 1000));
        dom.player_current.textContent = formatClock(current);
        dom.player_duration.textContent = formatClock(duration);
        dom.mini_progress.style.setProperty('--mini-progress', `${Math.max(0, Math.min(100, ratio * 100))}%`);
    }

    async function flushListeningStats() {
        const seconds = state.pendingListeningSeconds;
        const track = state.currentTrack;
        if (!track || seconds <= 0) return;
        state.pendingListeningSeconds = 0;
        await storage().incrementLibraryDailyStat({ date: localDateKey(), kind: 'listening', itemId: track.id, seconds });
    }

    async function renderOverview() {
        try {
            state.stats = await storage().loadLibraryDailyStats();
        } catch (error) {
            console.error('[Library] Stats load failed:', error);
        }
        const days = lastSevenDays();
        const today = localDateKey();
        const sum = (kind, date) => state.stats
            .filter((row) => row.kind === kind && (!date || row.date === date))
            .reduce((total, row) => total + (Number(row.seconds) || 0), 0);
        const todayReading = sum('reading', today);
        const todayListening = sum('listening', today);
        dom.today_reading.textContent = formatDuration(todayReading);
        dom.today_listening.textContent = formatDuration(todayListening);

        const values = days.map((day) => ({
            ...day,
            reading: sum('reading', day.key),
            listening: sum('listening', day.key)
        }));
        const max = Math.max(60, ...values.flatMap((item) => [item.reading, item.listening]));
        const weekTotal = values.reduce((total, item) => total + item.reading + item.listening, 0);
        dom.week_total.textContent = formatDuration(weekTotal);
        dom.week_chart.innerHTML = values.map((item) => `
            <div class="library-chart-day">
                <div class="library-chart-bars">
                    <i class="library-chart-bar" style="height:${Math.max(3, item.reading / max * 100)}%" title="阅读 ${escapeHtml(formatDuration(item.reading, true))}"></i>
                    <i class="library-chart-bar listening" style="height:${Math.max(3, item.listening / max * 100)}%" title="听歌 ${escapeHtml(formatDuration(item.listening, true))}"></i>
                </div>
                <small>${item.key === today ? '今' : item.label}</small>
            </div>`).join('');
        renderRanking();
    }

    function renderRanking() {
        const range = state.preferences.rankingRange === 'all' ? 'all' : 'week';
        const weekKeys = new Set(lastSevenDays().map((day) => day.key));
        const totals = new Map();
        state.stats.forEach((row) => {
            if (row.kind !== 'play' || (range === 'week' && !weekKeys.has(row.date))) return;
            totals.set(row.itemId, (totals.get(row.itemId) || 0) + (Number(row.count) || 0));
        });
        const ranked = [...totals.entries()]
            .map(([trackId, count]) => ({ track: getTrack(trackId), count }))
            .filter((item) => item.track && item.count > 0)
            .sort((a, b) => b.count - a.count || String(a.track.name || '').localeCompare(String(b.track.name || ''), 'zh-CN'))
            .slice(0, 8);
        dom.ranking_list.innerHTML = ranked.length ? ranked.map((item, index) => `
            <div class="library-ranking-row">
                <b>${String(index + 1).padStart(2, '0')}</b>
                <span class="library-track-art">${safeHttpUrl(item.track.coverUrl) ? `<img src="${escapeHtml(safeHttpUrl(item.track.coverUrl))}" alt="" referrerpolicy="no-referrer">` : '<i class="fas fa-music"></i>'}</span>
                <div><strong>${escapeHtml(item.track.name)}</strong><small>${escapeHtml(item.track.artist)}</small></div>
                <span>${item.count}次</span>
            </div>`).join('') : '<div class="library-ranking-empty">开始播放歌曲后，这里会出现你的排行。</div>';
        dom.view.querySelectorAll('[data-range]').forEach((button) => {
            button.classList.toggle('active', button.dataset.range === range);
        });
    }

    function bindNavigation() {
        const selectAtClientX = (clientX) => {
            const rect = dom.floating_nav.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(.999, (clientX - rect.left) / rect.width));
            switchTab(TABS[Math.floor(ratio * 3)], false);
        };
        dom.floating_nav.addEventListener('click', (event) => {
            const button = event.target.closest('[data-library-tab]');
            if (button) switchTab(button.dataset.libraryTab);
        });
        dom.floating_nav.addEventListener('pointerdown', (event) => {
            state.navDragging = true;
            state.navPointerId = event.pointerId;
            dom.floating_nav.setPointerCapture?.(event.pointerId);
        });
        dom.floating_nav.addEventListener('pointermove', (event) => {
            if (!state.navDragging || state.navPointerId !== event.pointerId) return;
            selectAtClientX(event.clientX);
        });
        const endDrag = (event) => {
            if (state.navPointerId !== null && event.pointerId !== state.navPointerId) return;
            state.navDragging = false;
            state.navPointerId = null;
            savePreferences().catch(console.error);
        };
        dom.floating_nav.addEventListener('pointerup', endDrag);
        dom.floating_nav.addEventListener('pointercancel', endDrag);
        dom.floating_nav.addEventListener('mousedown', () => { state.navMouseDragging = true; });
        dom.floating_nav.addEventListener('mousemove', (event) => {
            if (!state.navMouseDragging || event.buttons !== 1) return;
            selectAtClientX(event.clientX);
        });
        document.addEventListener('mouseup', () => {
            if (!state.navMouseDragging) return;
            state.navMouseDragging = false;
            savePreferences().catch(console.error);
        });
    }

    function bindEvents() {
        $('app-phone-btn')?.addEventListener('click', () => openApp());
        dom.back_btn.addEventListener('click', closeApp);
        dom.header_action.addEventListener('click', () => {
            if (state.activeTab === 'books') dom.book_file_input.click();
            else if (state.activeTab === 'music') openModal(dom.track_modal);
        });
        dom.book_upload_btn.addEventListener('click', () => dom.book_file_input.click());
        dom.books_empty.addEventListener('click', (event) => {
            if (event.target.closest('[data-library-action="upload-book"]')) dom.book_file_input.click();
        });
        dom.book_file_input.addEventListener('change', () => importBook(dom.book_file_input.files?.[0]));
        dom.book_grid.addEventListener('click', (event) => {
            const card = event.target.closest('[data-book-id]');
            const action = event.target.closest('[data-book-action]')?.dataset.bookAction;
            if (!card || !action) return;
            const book = state.books.find((item) => item.id === card.dataset.bookId);
            if (action === 'details') openBookDetail(book);
        });
        dom.book_detail_start.addEventListener('click', () => {
            const book = state.detailBook;
            if (!book) return;
            closeAllModals();
            openReaderAsync(book);
        });
        dom.book_detail_edit.addEventListener('click', () => setBookDetailEditing(true));
        dom.book_detail_delete.addEventListener('click', () => requestDeleteBook(state.detailBook));
        dom.book_edit_cancel.addEventListener('click', () => {
            renderBookDetail();
            setBookDetailEditing(false);
        });
        dom.book_edit_form.addEventListener('submit', saveBookDetail);
        dom.reader_back.addEventListener('click', closeReader);
        dom.reader_together.addEventListener('click', () => {
            if (state.together) stopTogether();
            else openCharPicker();
        });
        dom.char_picker_list.addEventListener('click', (event) => {
            const button = event.target.closest('[data-library-char-id]');
            if (!button) return;
            const friend = (window.imData?.friends || []).find((item) => String(item.id) === String(button.dataset.libraryCharId));
            startTogether(friend);
        });
        $('imessage-view')?.addEventListener('click', (event) => {
            if (!state.together) return;
            if (event.target.closest('.chat-back-btn')) {
                event.preventDefault();
                event.stopImmediatePropagation();
                collapseTogetherPopup();
                return;
            }
            if (event.target.closest('.chat-call-btn, .chat-menu-btn')) {
                event.preventDefault();
                event.stopImmediatePropagation();
                toast('一起看模式下暂不支持电话和聊天设置');
            }
        }, true);
        dom.reader_settings.addEventListener('click', () => {
            dom.reader_toc.hidden = true;
            dom.reader_panel.hidden = !dom.reader_panel.hidden;
        });
        dom.reader_toc_button.addEventListener('click', () => {
            dom.reader_panel.hidden = true;
            dom.reader_toc.hidden = !dom.reader_toc.hidden;
        });
        dom.reader_toc_close.addEventListener('click', () => { dom.reader_toc.hidden = true; });
        dom.reader_toc_list.addEventListener('click', (event) => {
            const button = event.target.closest('[data-chapter-offset]');
            if (!button) return;
            const textLength = Math.max(1, state.readerContent?.text?.length || 1);
            const offset = clampReaderValue(Number(button.dataset.chapterOffset) || 0, 0, textLength);
            dom.reader_toc.hidden = true;
            restoreReaderProgress(offset / textLength);
            updateReaderProgress(true, state.readerPage);
            markReaderActivity();
        });
        dom.reader_panel.addEventListener('click', (event) => {
            const font = event.target.closest('[data-reader-font]');
            const line = event.target.closest('[data-reader-line]');
            const theme = event.target.closest('[data-reader-theme]');
            const progress = state.currentBook ? Number(state.currentBook.progress) || 0 : 0;
            if (font) state.preferences.readerFontSize = (Number(state.preferences.readerFontSize) || 18) + Number(font.dataset.readerFont);
            if (line) state.preferences.readerLineHeight = (Number(state.preferences.readerLineHeight) || 1.85) + Number(line.dataset.readerLine) * .15;
            if (theme) state.preferences.readerTheme = theme.dataset.readerTheme;
            applyReaderPreferences();
            if (state.currentBook) requestAnimationFrame(() => restoreReaderProgress(progress));
            else updateReaderProgress(false);
            savePreferences().catch(console.error);
        });
        dom.reader_scroll.addEventListener('pointerdown', handleReaderPointerDown, { passive: true });
        dom.reader_scroll.addEventListener('pointerup', handleReaderPointerUp, { passive: true });
        dom.reader_scroll.addEventListener('pointercancel', () => { state.readerPointerStart = null; }, { passive: true });
        ['pointerdown', 'touchstart'].forEach((eventName) => dom.reader_view.addEventListener(eventName, markReaderActivity, { passive: true }));
        document.addEventListener('keydown', handleReaderKeydown);
        window.addEventListener('resize', repaginateReaderAtCurrentProgress);

        dom.import_netease_btn.addEventListener('click', () => openModal(dom.import_modal));
        dom.music_add_btn.addEventListener('click', () => openModal(dom.track_modal));
        dom.add_track_btn.addEventListener('click', () => openModal(dom.track_modal));
        dom.import_form.addEventListener('submit', handleNetEaseImport);
        dom.track_form.addEventListener('submit', addDirectTrack);
        dom.view.querySelectorAll('[data-close-library-modal]').forEach((button) => button.addEventListener('click', closeAllModals));
        [dom.import_modal, dom.track_modal, dom.book_detail_modal, dom.char_picker_modal].forEach((modal) => modal.addEventListener('click', (event) => { if (event.target === modal) closeAllModals(); }));
        dom.playlist_list.addEventListener('click', (event) => {
            const card = event.target.closest('[data-playlist-id]');
            if (card) openPlaylist(getPlaylist(card.dataset.playlistId));
        });
        dom.playlist_back.addEventListener('click', closePlaylist);
        dom.playlist_delete.addEventListener('click', () => requestDeletePlaylist(state.currentPlaylist));
        dom.play_all.addEventListener('click', () => {
            const tracks = playlistTracks(state.currentPlaylist).filter((track) => track.available !== false);
            if (tracks.length) playTrack(tracks[0], tracks.map((track) => track.id));
            else toast('歌单中没有可播放的歌曲');
        });
        dom.track_list.addEventListener('click', (event) => {
            const row = event.target.closest('[data-track-id]');
            if (!row) return;
            const tracks = playlistTracks(state.currentPlaylist);
            playTrack(getTrack(row.dataset.trackId), tracks.map((track) => track.id));
        });

        dom.mini_open.addEventListener('click', openPlayer);
        dom.mini_play.addEventListener('click', togglePlayback);
        dom.mini_next.addEventListener('click', () => playQueueDirection(1));
        dom.player_close.addEventListener('click', closePlayer);
        dom.player_art.addEventListener('click', () => setPlayerLyricsMode(true));
        dom.lyrics.addEventListener('click', () => setPlayerLyricsMode(false));
        dom.player_play.addEventListener('click', togglePlayback);
        dom.player_prev.addEventListener('click', () => playQueueDirection(-1));
        dom.player_next.addEventListener('click', () => playQueueDirection(1));
        dom.player_progress.addEventListener('pointerdown', () => { state.isSeeking = true; });
        dom.player_progress.addEventListener('input', () => {
            if (!Number.isFinite(audio.duration)) return;
            const next = Number(dom.player_progress.value) / 1000 * audio.duration;
            dom.player_current.textContent = formatClock(next);
        });
        dom.player_progress.addEventListener('change', () => {
            if (Number.isFinite(audio.duration)) audio.currentTime = Number(dom.player_progress.value) / 1000 * audio.duration;
            state.lastMediaTime = audio.currentTime;
            state.isSeeking = false;
        });
        dom.view.querySelectorAll('[data-range]').forEach((button) => button.addEventListener('click', () => {
            state.preferences.rankingRange = button.dataset.range;
            savePreferences().catch(console.error);
            renderRanking();
        }));
        bindNavigation();

        audio.addEventListener('play', () => {
            updatePlayerUi();
            emitTogetherListeningChange(true);
            if (state.currentTrack && state.pendingPlayStatTrackId === state.currentTrack.id) {
                const trackId = state.currentTrack.id;
                state.pendingPlayStatTrackId = null;
                storage().incrementLibraryDailyStat({ date: localDateKey(), kind: 'play', itemId: trackId, count: 1 }).catch((error) => {
                    console.error('[Library] Play count update failed:', error);
                });
            }
        });
        audio.addEventListener('pause', () => { updatePlayerUi(); emitTogetherListeningChange(true); flushListeningStats().catch(console.error); });
        audio.addEventListener('loadedmetadata', () => { state.lastMediaTime = audio.currentTime || 0; updatePlayerUi(); emitTogetherListeningChange(true); });
        audio.addEventListener('seeking', () => { state.isSeeking = true; });
        audio.addEventListener('seeked', () => { state.lastMediaTime = audio.currentTime || 0; state.isSeeking = false; updateLyrics(audio.currentTime || 0); emitTogetherListeningChange(true); });
        audio.addEventListener('timeupdate', () => {
            const current = Number(audio.currentTime) || 0;
            const delta = current - state.lastMediaTime;
            if (!state.isSeeking && !audio.paused && delta > 0 && delta <= 5) {
                state.pendingListeningSeconds += delta;
                if (state.pendingListeningSeconds >= 15) flushListeningStats().catch(console.error);
            }
            state.lastMediaTime = current;
            updatePlayerUi();
            updateLyrics(current);
            emitTogetherListeningChange(false);
        });
        audio.addEventListener('ended', () => { flushListeningStats().catch(console.error); playQueueDirection(1); });
        audio.addEventListener('error', () => {
            if (!state.currentTrack || !audio.src) return;
            if (state.playbackStartingAttemptId === state.playbackAttemptId) return;
            toast('当前歌曲暂时无法播放');
            updatePlayerUi();
            emitTogetherListeningChange(true);
        });

        window.addEventListener('pagehide', () => {
            if (state.currentBook) updateReaderProgress(true, null, { immediate: true });
            else flushReaderProgressSave().catch(console.error);
            flushReadingStats().catch(console.error);
            flushListeningStats().catch(console.error);
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (state.currentBook) updateReaderProgress(true, null, { immediate: true });
                else flushReaderProgressSave().catch(console.error);
                flushReadingStats().catch(console.error);
                flushListeningStats().catch(console.error);
            }
        });
    }

    function startTimers() {
        setInterval(() => {
            const readingActive = !!state.currentBook
                && dom.reader_view.classList.contains('active')
                && !document.hidden
                && Date.now() - state.readerLastActivityAt <= 60000;
            if (readingActive) {
                state.pendingReadingSeconds += 5;
                if (state.pendingReadingSeconds >= 15) flushReadingStats().catch(console.error);
            }
        }, 5000);
    }

    async function init() {
        cacheDom();
        if (!dom.view) return;
        setLibraryViewHidden(!dom.view.classList.contains('active'));
        try {
            await loadState();
            renderBooks();
            renderPlaylists();
            switchTab(state.activeTab, false);
            bindEvents();
            startTimers();
            updatePlayerUi();
            setPlayerLyricsMode(false);
            updateTogetherControls();
            state.ready = true;
        } catch (error) {
            console.error('[Library] Initialization failed:', error);
            toast('Library 初始化失败');
        }
    }

    window.libraryApp = {
        open: (tab) => openApp(tab),
        close: closeApp,
        importNetEasePlaylist,
        getTogetherReadingContext,
        openTogetherListeningPicker,
        getTogetherListeningSnapshot,
        getTogetherListeningContext,
        controlTogetherListening,
        stopTogetherListening,
        openTogetherListeningPlayer
    };

    (window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(init);
})();
