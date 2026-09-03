'use strict';

const JSZIP_URL = 'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js';
const MAMMOTH_URL = 'https://unpkg.com/mammoth@1.8.0/mammoth.browser.min.js';
const CHUNK_TARGET_CHARS = 16000;

function fileBaseName(name) {
    return String(name || '未命名书籍').replace(/\.[^/.]+$/, '') || '未命名书籍';
}

function decodeEntities(value) {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    return String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
        if (entity[0] === '#') {
            const hex = entity[1]?.toLowerCase() === 'x';
            const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
            return Number.isFinite(code) ? String.fromCodePoint(code) : match;
        }
        return named[entity.toLowerCase()] ?? match;
    });
}

function cleanPlainText(value) {
    return String(value || '')
        .replace(/\r\n?/g, '\n')
        .replace(/\u0000/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function htmlToPlainText(html) {
    return cleanPlainText(decodeEntities(String(html || '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(script|style|svg|head|nav)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:p|div|section|article|h[1-6]|li|blockquote|pre|tr)>/gi, '\n')
        .replace(/<li\b[^>]*>/gi, '• ')
        .replace(/<[^>]+>/g, '')));
}

function readAttribute(source, name) {
    const match = String(source || '').match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
    return match ? decodeEntities(match[2]) : '';
}

function firstXmlText(xml, localName) {
    const match = String(xml || '').match(new RegExp(`<(?:[\\w.-]+:)?${localName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${localName}>`, 'i'));
    return match ? htmlToPlainText(match[1]) : '';
}

function normalizeZipPath(path) {
    const output = [];
    String(path || '').replace(/\\/g, '/').split('/').forEach((part) => {
        if (!part || part === '.') return;
        if (part === '..') output.pop();
        else output.push(part);
    });
    return output.join('/');
}

function zipDir(path) {
    const normalized = normalizeZipPath(path);
    const index = normalized.lastIndexOf('/');
    return index >= 0 ? normalized.slice(0, index + 1) : '';
}

function resolveZipPath(baseDir, href) {
    const cleanHref = decodeURIComponent(String(href || '').split('#')[0]);
    return normalizeZipPath(`${baseDir || ''}${cleanHref}`);
}

function decodeTextBuffer(buffer) {
    const bytes = new Uint8Array(buffer);
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8').decode(bytes.subarray(3));
    return new TextDecoder('utf-8').decode(bytes);
}

function isChapterHeading(line) {
    const value = String(line || '').trim();
    if (!value || value.length > 80) return false;
    return /^(?:第[0-9零一二三四五六七八九十百千万两〇]+[章节卷部篇回]|chapter\s+[0-9ivxlcdm]+\b|#{1,3}\s+|\d{1,3}[、.．]\s*\S+)/i.test(value);
}

function buildChapterIndex(text) {
    const chapters = [{ title: '开始阅读', start: 0 }];
    let offset = 0;
    String(text || '').split('\n').forEach((line) => {
        if (offset > 0 && isChapterHeading(line)) {
            chapters.push({ title: line.trim().replace(/^#{1,3}\s*/, ''), start: offset });
        }
        offset += line.length + 1;
    });
    return chapters.map((chapter, index) => ({
        ...chapter,
        end: index + 1 < chapters.length ? chapters[index + 1].start : text.length
    }));
}

function buildReaderChunks(text, chapterIndex) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const target = Math.min(text.length, start + CHUNK_TARGET_CHARS);
        let end = target;
        if (target < text.length) {
            const nextChapter = chapterIndex.find((chapter) => chapter.start > start + 4000 && chapter.start <= target + 4000);
            if (nextChapter) end = nextChapter.start;
            else {
                const paragraphBreak = text.lastIndexOf('\n\n', target);
                const lineBreak = text.lastIndexOf('\n', target);
                const candidate = paragraphBreak > start + 8000 ? paragraphBreak + 2 : lineBreak + 1;
                if (candidate > start + 4000) end = candidate;
            }
        }
        if (end <= start) end = Math.min(text.length, start + CHUNK_TARGET_CHARS);
        chunks.push({ start, end });
        start = end;
    }
    return chunks.length ? chunks : [{ start: 0, end: 0 }];
}

function createParsedBook({ text, sourceType, title, author = '未知作者', synopsis = '暂无简介' }) {
    const normalizedText = cleanPlainText(text);
    if (!normalizedText) throw new Error('文件内容为空');
    const chapterIndex = buildChapterIndex(normalizedText);
    return {
        text: normalizedText,
        sourceType,
        title,
        author,
        synopsis,
        chapterIndex,
        chunks: buildReaderChunks(normalizedText, chapterIndex)
    };
}

async function ensureDependency(kind) {
    if (kind === 'EPUB' && !self.JSZip) importScripts(JSZIP_URL);
    if (kind === 'DOCX' && !self.mammoth?.extractRawText) importScripts(MAMMOTH_URL);
}

async function parseEpub(buffer, name) {
    await ensureDependency('EPUB');
    const zip = await self.JSZip.loadAsync(buffer);
    const containerEntry = zip.file('META-INF/container.xml');
    if (!containerEntry) throw new Error('EPUB 缺少 container.xml');
    const containerXml = await containerEntry.async('string');
    const rootfileTag = containerXml.match(/<(?:[\w.-]+:)?rootfile\b([^>]*)>/i);
    const rootfilePath = readAttribute(rootfileTag?.[1], 'full-path');
    if (!rootfilePath) throw new Error('EPUB 缺少 OPF 入口');
    const opfEntry = zip.file(rootfilePath);
    if (!opfEntry) throw new Error('EPUB OPF 不存在');
    const opfXml = await opfEntry.async('string');
    const baseDir = zipDir(rootfilePath);
    const manifest = new Map();
    for (const match of opfXml.matchAll(/<(?:[\w.-]+:)?item\b([^>]*)\/?\s*>/gi)) {
        const attrs = match[1];
        const id = readAttribute(attrs, 'id');
        const href = readAttribute(attrs, 'href');
        if (id && href) manifest.set(id, { href, mediaType: readAttribute(attrs, 'media-type') });
    }
    const spine = [];
    for (const match of opfXml.matchAll(/<(?:[\w.-]+:)?itemref\b([^>]*)\/?\s*>/gi)) {
        const item = manifest.get(readAttribute(match[1], 'idref'));
        if (item && (/application\/xhtml\+xml|text\/html/i.test(item.mediaType) || /\.x?html?$/i.test(item.href))) spine.push(item);
    }
    if (!spine.length) throw new Error('EPUB 缺少可读章节');
    const chapterTexts = [];
    for (const item of spine) {
        const path = resolveZipPath(baseDir, item.href);
        const entry = zip.file(path);
        if (!entry) continue;
        const html = await entry.async('string');
        const heading = firstXmlText(html, 'h1') || firstXmlText(html, 'h2') || fileBaseName(item.href);
        const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
        const chapterText = htmlToPlainText(body);
        if (chapterText) chapterTexts.push([heading ? `# ${heading}` : '', chapterText].filter(Boolean).join('\n\n'));
    }
    return createParsedBook({
        text: chapterTexts.join('\n\n'),
        sourceType: 'EPUB',
        title: firstXmlText(opfXml, 'title') || fileBaseName(name),
        author: firstXmlText(opfXml, 'creator') || '未知作者',
        synopsis: firstXmlText(opfXml, 'description') || '暂无简介'
    });
}

async function parseBook(buffer, name) {
    const lower = String(name || '').toLowerCase();
    if (lower.endsWith('.epub')) return parseEpub(buffer, name);
    if (lower.endsWith('.docx')) {
        await ensureDependency('DOCX');
        const result = await self.mammoth.extractRawText({ arrayBuffer: buffer });
        return createParsedBook({ text: result?.value, sourceType: 'DOCX', title: fileBaseName(name) });
    }
    return createParsedBook({ text: decodeTextBuffer(buffer), sourceType: 'TXT', title: fileBaseName(name) });
}

self.addEventListener('message', async (event) => {
    const { id, type, buffer, name, text } = event.data || {};
    if (type !== 'parse-book' && type !== 'index-content') return;
    try {
        const book = type === 'index-content' ? buildContentIndex(text) : await parseBook(buffer, name);
        self.postMessage({ id, ok: true, book });
    } catch (error) {
        self.postMessage({ id, ok: false, error: error?.message || '书籍解析失败' });
    }
});
