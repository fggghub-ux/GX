// ==========================================
// World Book — iOS Notes-style library and editor
// ==========================================
const WB_UNGROUPED = 'Ungrouped';
let worldBooks = [];
let wbGroups = [];
let activeWbGroupName = null;
let editingBookId = null;
let activeEntryId = null;
let tempEntries = [];
let draftIsGlobal = false;
let editorInitialSnapshot = '';
let editingGroupName = null;
let wbFolderEditMode = false;
const wbBookTokenCache = new Map();

function getWbElement(id) {
    return document.getElementById(id);
}

function openWbOverlay(id) {
    const element = getWbElement(id);
    if (element && window.openView) window.openView(element);
}

function closeWbOverlay(id) {
    const element = getWbElement(id);
    if (element && window.closeView) window.closeView(element);
}

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttr(value = '') {
    return escapeHtml(value);
}

function normalizeGroupName(value) {
    const name = String(value || '').trim();
    return name || WB_UNGROUPED;
}

function normalizeGroups() {
    const seen = new Set();
    wbGroups = (Array.isArray(wbGroups) ? wbGroups : [])
        .map(name => String(name || '').trim())
        .filter(name => name && name !== WB_UNGROUPED)
        .filter(name => {
            if (seen.has(name)) return false;
            seen.add(name);
            return true;
        });
}

function getAllDisplayGroups() {
    normalizeGroups();
    const assignedGroups = worldBooks
        .map(book => normalizeGroupName(book && book.group))
        .filter(group => group !== WB_UNGROUPED && !wbGroups.includes(group));
    return [...wbGroups, ...Array.from(new Set(assignedGroups)), WB_UNGROUPED];
}

function invalidateWorldBookRenderCache() {
    wbBookTokenCache.clear();
}

function invalidateWorldBookLocalBindings() {
    // Mount selectors obtain their data on demand; no view-specific cache remains.
}

function saveWorldBooksData() {
    invalidateWorldBookRenderCache();
    if (window.StorageManager) {
        window.StorageManager.save('u2_worldBooks', worldBooks);
        window.StorageManager.save('u2_wbGroups', wbGroups);
    }
}

function getBookTokenCount(book) {
    if (!book || book.id == null) return calculateTokens(book && book.entries);
    const cacheKey = String(book.id);
    if (wbBookTokenCache.has(cacheKey)) return wbBookTokenCache.get(cacheKey);
    const count = calculateTokens(book.entries);
    wbBookTokenCache.set(cacheKey, count);
    return count;
}

function calculateTokens(entries) {
    const text = (Array.isArray(entries) ? entries : [])
        .map(entry => `${entry && entry.title || ''}${entry && entry.keyword || ''}${entry && entry.content || ''}`)
        .join('');
    return Math.ceil(text.length * 1.5) || 0;
}

window.calculateTokens = calculateTokens;
window.invalidateWorldBookLocalBindings = invalidateWorldBookLocalBindings;
window.getWorldBooks = () => Array.isArray(worldBooks) ? worldBooks : [];

function normalizeEntryForEditor(entry = {}, index = 0) {
    const normalizer = window.normalizeWorldBookEntry;
    const source = normalizer ? normalizer(entry) : entry;
    return {
        ...source,
        __editorId: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        title: String(source.title || source.name || source.keyword || `词条 ${index + 1}`),
        keyword: String(source.keyword || ''),
        content: String(source.content || ''),
        triggerMode: source.triggerMode === 'keyword' ? 'keyword' : 'permanent',
        injectionPosition: ['before_role', 'after_role', 'system_depth'].includes(source.injectionPosition)
            ? source.injectionPosition
            : 'before_role',
        systemDepth: Number.isFinite(Number(source.systemDepth)) ? Number(source.systemDepth) : 4,
        order: Number.isFinite(Number(source.order)) ? Number(source.order) : 100,
        recursive: false,
        enabled: source.enabled !== false
    };
}

function createDefaultEntry(index = 0) {
    return normalizeEntryForEditor({
        title: `词条 ${index + 1}`,
        content: '',
        keyword: '',
        triggerMode: 'permanent',
        injectionPosition: 'before_role',
        systemDepth: 4,
        order: 100,
        enabled: true
    }, index);
}

function showCenteredConfirm({
    title = '确认操作',
    message = '确定继续吗？',
    confirmText = '确认',
    cancelText = '取消',
    isDestructive = false,
    onConfirm
} = {}) {
    if (typeof window.showCustomModal === 'function') {
        window.showCustomModal({ title, message, confirmText, cancelText, isDestructive, onConfirm });
        return;
    }

    getWbElement('wb-inline-confirm-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'wb-inline-confirm-overlay';
    overlay.className = 'bottom-sheet-overlay wb-centered-modal-overlay active';
    overlay.innerHTML = `
        <div class="wb-centered-modal-card wb-group-modal-card wb-inline-confirm-card">
            <div class="wb-centered-modal-header"><div class="wb-centered-modal-title">${escapeHtml(title)}</div></div>
            <div class="wb-centered-modal-body wb-inline-confirm-body">
                <div class="wb-inline-confirm-message">${escapeHtml(message)}</div>
                <div class="wb-inline-confirm-actions">
                    <button type="button" class="wb-inline-confirm-btn wb-inline-confirm-cancel">${escapeHtml(cancelText)}</button>
                    <button type="button" class="wb-inline-confirm-btn ${isDestructive ? 'wb-inline-confirm-danger' : 'wb-inline-confirm-confirm'}">${escapeHtml(confirmText)}</button>
                </div>
            </div>
        </div>`;
    const cleanUp = () => overlay.remove();
    overlay.querySelector('.wb-inline-confirm-cancel').addEventListener('click', cleanUp);
    overlay.querySelector(isDestructive ? '.wb-inline-confirm-danger' : '.wb-inline-confirm-confirm').addEventListener('click', () => {
        cleanUp();
        if (typeof onConfirm === 'function') onConfirm();
    });
    overlay.addEventListener('click', event => { if (event.target === overlay) cleanUp(); });
    (getWbElement('app') || document.body).appendChild(overlay);
}

function showWbMainPage() {
    activeWbGroupName = null;
    getWbElement('wb-files-main-page')?.classList.add('active');
    getWbElement('wb-files-group-page')?.classList.remove('active');
    getWbElement('wb-files-editor-page')?.classList.remove('active');
    renderWorldBooks({ force: true });
}

function openWbGroupPage(groupName) {
    activeWbGroupName = normalizeGroupName(groupName);
    getWbElement('wb-files-main-page')?.classList.remove('active');
    getWbElement('wb-files-editor-page')?.classList.remove('active');
    getWbElement('wb-files-group-page')?.classList.add('active');
    renderGroupBookList(activeWbGroupName);
}

function showEditorPage() {
    getWbElement('wb-files-main-page')?.classList.remove('active');
    getWbElement('wb-files-group-page')?.classList.remove('active');
    getWbElement('wb-files-editor-page')?.classList.add('active');
}

function getBooksInGroup(groupName) {
    const normalized = normalizeGroupName(groupName);
    return worldBooks.filter(book => normalizeGroupName(book && book.group) === normalized);
}

function createFolderElement(groupName) {
    const normalized = normalizeGroupName(groupName);
    const count = getBooksInGroup(normalized).length;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `wb-notes-row wb-folder-row${wbFolderEditMode ? ' is-editing' : ''}`;
    item.dataset.group = normalized;
    item.innerHTML = `
        <span class="wb-row-icon wb-folder-icon"><i class="far fa-folder"></i></span>
        <span class="wb-row-main"><strong>${escapeHtml(normalized)}</strong></span>
        <span class="wb-row-count">${count}</span>
        <i class="fas fa-chevron-right wb-row-chevron"></i>
        ${normalized === WB_UNGROUPED ? '' : '<span class="wb-row-edit-actions"><i class="fas fa-pen" data-action="rename"></i><i class="far fa-trash-alt" data-action="delete"></i></span>'}`;
    item.addEventListener('click', event => {
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (action === 'rename') {
            event.stopPropagation();
            openGroupNameDialog(normalized);
        } else if (action === 'delete') {
            event.stopPropagation();
            deleteGroupByName(normalized);
        } else if (!wbFolderEditMode) {
            openWbGroupPage(normalized);
        }
    });
    return item;
}

function renderWorldBooks() {
    normalizeGroups();
    const list = getWbElement('wb-folder-list');
    if (!list) return;
    const fragment = document.createDocumentFragment();
    getAllDisplayGroups().forEach(group => fragment.appendChild(createFolderElement(group)));
    list.replaceChildren(fragment);
    if (activeWbGroupName) renderGroupBookList(activeWbGroupName);
}

function createBookListItemElement(book) {
    const item = document.createElement('button');
    const entryCount = Array.isArray(book.entries) ? book.entries.length : 0;
    const tokens = getBookTokenCount(book);
    item.type = 'button';
    item.className = 'wb-notes-row wb-book-row';
    item.dataset.id = String(book.id);
    item.innerHTML = `
        <span class="wb-row-icon wb-book-icon"><i class="far fa-note-sticky"></i></span>
        <span class="wb-row-main"><strong>${escapeHtml(book.name || '未命名世界书')}</strong><small>${entryCount} 个词条 · ${tokens} Tokens${book.isGlobal ? ' · 全局启用' : ''}</small></span>
        <i class="fas fa-chevron-right wb-row-chevron"></i>`;
    item.addEventListener('click', () => openBookModal(book));
    return item;
}

function renderGroupBookList(groupName) {
    const normalized = normalizeGroupName(groupName);
    const books = getBooksInGroup(normalized);
    const title = getWbElement('wb-group-large-title');
    const countLine = getWbElement('wb-group-count-line');
    const list = getWbElement('wb-group-book-list');
    if (title) title.textContent = normalized;
    if (countLine) countLine.textContent = `${books.length} 本世界书`;
    if (!list) return;
    if (!books.length) {
        list.innerHTML = '<div class="wb-files-empty-state"><i class="far fa-folder-open"></i><span>这个文件夹还没有世界书</span></div>';
        return;
    }
    const fragment = document.createDocumentFragment();
    books.forEach(book => fragment.appendChild(createBookListItemElement(book)));
    list.replaceChildren(fragment);
}

function renderWorldBookTab() {
    renderWorldBooks({ force: true });
}

function renderWorldBookGlobalTab() {
    const target = getWbElement('wb-global-list');
    if (!target) return;
    const globalBooks = worldBooks.filter(book => book.isGlobal);
    target.textContent = `${globalBooks.length} 本全局世界书`;
}

function renderWorldBookLocalTab() {
    // The legacy local tab has intentionally been removed from this library UI.
    // Local mounts continue to be managed by renderWorldBookSelector in each app.
}

function normalizeBookForSave() {
    return tempEntries.map((entry, index) => {
        const normalized = normalizeEntryForEditor(entry, index);
        const { __editorId, ...rest } = normalized;
        return {
            ...rest,
            title: String(entry.title || '').trim() || `词条 ${index + 1}`,
            keyword: entry.triggerMode === 'keyword' ? String(entry.keyword || '').trim() : '',
            content: String(entry.content || '').trim(),
            triggerMode: entry.triggerMode === 'keyword' ? 'keyword' : 'permanent',
            injectionPosition: ['before_role', 'after_role', 'system_depth'].includes(entry.injectionPosition)
                ? entry.injectionPosition
                : 'before_role',
            systemDepth: Number.isFinite(Number(entry.systemDepth)) ? Number(entry.systemDepth) : 4,
            order: 100,
            recursive: false,
            enabled: entry.enabled !== false
        };
    });
}

function renderAddBookGroupSelect() {
    const select = getWbElement('add-book-group-input');
    if (!select) return;
    const current = normalizeGroupName(select.value);
    select.innerHTML = getAllDisplayGroups().map(group => `<option value="${escapeAttr(group)}">${escapeHtml(group)}</option>`).join('');
    select.value = getAllDisplayGroups().includes(current) ? current : WB_UNGROUPED;
}

function getEditorSnapshot() {
    return JSON.stringify({
        name: getWbElement('add-book-name-input')?.value || '',
        group: normalizeGroupName(getWbElement('add-book-group-input')?.value),
        isGlobal: !!draftIsGlobal,
        entries: tempEntries.map(({ __editorId, ...entry }) => entry)
    });
}

function isEditorDirty() {
    return getEditorSnapshot() !== editorInitialSnapshot;
}

function openBookModal(book = null, preferredGroup = null, entryEditorId = null) {
    editingBookId = book ? book.id : null;
    const nameInput = getWbElement('add-book-name-input');
    const groupInput = getWbElement('add-book-group-input');
    const globalInput = getWbElement('wb-editor-global-toggle');
    const deleteButton = getWbElement('delete-world-book-btn');
    renderAddBookGroupSelect();

    if (book) {
        if (nameInput) nameInput.value = book.name || '';
        if (groupInput) groupInput.value = normalizeGroupName(book.group);
        tempEntries = (Array.isArray(book.entries) ? book.entries : []).map(normalizeEntryForEditor);
        draftIsGlobal = !!book.isGlobal;
        if (deleteButton) deleteButton.hidden = false;
    } else {
        if (nameInput) nameInput.value = '';
        if (groupInput) groupInput.value = normalizeGroupName(preferredGroup || activeWbGroupName || WB_UNGROUPED);
        tempEntries = [createDefaultEntry(0)];
        draftIsGlobal = false;
        if (deleteButton) deleteButton.hidden = true;
    }
    if (globalInput) globalInput.checked = draftIsGlobal;
    activeEntryId = entryEditorId || tempEntries[0]?.__editorId || null;
    getWbElement('wb-editor-back-label').textContent = activeWbGroupName || '世界书';
    renderEntries();
    editorInitialSnapshot = getEditorSnapshot();
    showEditorPage();
    window.setTimeout(() => nameInput?.focus(), 0);
}

function addEntry() {
    const entry = createDefaultEntry(tempEntries.length);
    tempEntries.push(entry);
    activeEntryId = entry.__editorId;
    renderEntries();
}

function deleteEntry(editorId) {
    showCenteredConfirm({
        title: '删除词条',
        message: '确定要删除这个词条吗？',
        confirmText: '删除',
        isDestructive: true,
        onConfirm: () => {
            tempEntries = tempEntries.filter(entry => entry.__editorId !== editorId);
            if (!tempEntries.length) tempEntries = [createDefaultEntry(0)];
            activeEntryId = tempEntries[0].__editorId;
            renderEntries();
        }
    });
}

function renderEntries() {
    const list = getWbElement('wb-entries-list-container');
    if (!list) return;
    const fragment = document.createDocumentFragment();
    tempEntries.forEach((entry, index) => {
        const expanded = entry.__editorId === activeEntryId;
        const item = document.createElement('article');
        item.className = `wb-entry-note${expanded ? ' expanded' : ''}`;
        item.dataset.entryId = entry.__editorId;
        const hasKeywords = entry.triggerMode === 'keyword';
        const isSystemDepth = entry.injectionPosition === 'system_depth';
        item.innerHTML = `
            <header class="wb-entry-note-head">
                <button type="button" class="wb-entry-expand-btn" aria-expanded="${expanded}">
                    <span><strong>${escapeHtml(entry.title || `词条 ${index + 1}`)}</strong><small>${hasKeywords ? '关键词触发' : '永久生效'} · ${entry.injectionPosition === 'after_role' ? '角色后' : isSystemDepth ? '系统深度' : '角色前'}</small></span><i class="fas fa-chevron-right"></i>
                </button>
                <button type="button" class="wb-entry-delete-btn" aria-label="删除词条"><i class="far fa-trash-alt"></i></button>
            </header>
            <div class="wb-entry-note-body" ${expanded ? '' : 'hidden'}>
                <input type="text" class="wb-entry-title-input" placeholder="词条标题" value="${escapeAttr(entry.title)}" aria-label="词条标题">
                <textarea class="wb-entry-body-textarea" placeholder="输入词条内容…" aria-label="词条内容">${escapeHtml(entry.content)}</textarea>
                <details class="wb-entry-settings" ${hasKeywords || isSystemDepth ? 'open' : ''}>
                    <summary>词条设置 <i class="fas fa-chevron-right"></i></summary>
                    <div class="wb-entry-settings-content">
                        <label class="wb-entry-field"><span>触发模式</span><select class="wb-entry-trigger-mode"><option value="permanent" ${entry.triggerMode === 'permanent' ? 'selected' : ''}>永久生效</option><option value="keyword" ${hasKeywords ? 'selected' : ''}>关键词触发</option></select></label>
                        <label class="wb-entry-field wb-entry-keyword-field" ${hasKeywords ? '' : 'hidden'}><span>关键词（多个用逗号分隔）</span><input type="text" class="wb-entry-keyword-input" placeholder="输入关键词" value="${escapeAttr(entry.keyword)}"></label>
                        <label class="wb-entry-field"><span>注入位置</span><select class="wb-entry-injection-position"><option value="before_role" ${entry.injectionPosition === 'before_role' ? 'selected' : ''}>角色前</option><option value="after_role" ${entry.injectionPosition === 'after_role' ? 'selected' : ''}>角色后</option><option value="system_depth" ${isSystemDepth ? 'selected' : ''}>系统深度</option></select></label>
                        <label class="wb-entry-field wb-entry-depth-field" ${isSystemDepth ? '' : 'hidden'}><span>系统深度</span><input type="number" min="0" class="wb-entry-system-depth-input" value="${entry.systemDepth}"></label>
                    </div>
                </details>
            </div>`;
        const expandButton = item.querySelector('.wb-entry-expand-btn');
        expandButton.addEventListener('click', () => {
            activeEntryId = activeEntryId === entry.__editorId ? null : entry.__editorId;
            renderEntries();
        });
        item.querySelector('.wb-entry-delete-btn').addEventListener('click', () => deleteEntry(entry.__editorId));
        item.querySelector('.wb-entry-title-input').addEventListener('input', event => { entry.title = event.target.value; });
        const contentTextarea = item.querySelector('.wb-entry-body-textarea');
        contentTextarea.addEventListener('input', event => { entry.content = event.target.value; });
        item.querySelector('.wb-entry-keyword-input').addEventListener('input', event => { entry.keyword = event.target.value; });
        item.querySelector('.wb-entry-trigger-mode').addEventListener('change', event => {
            entry.triggerMode = event.target.value === 'keyword' ? 'keyword' : 'permanent';
            renderEntries();
        });
        item.querySelector('.wb-entry-injection-position').addEventListener('change', event => {
            entry.injectionPosition = event.target.value;
            renderEntries();
        });
        item.querySelector('.wb-entry-system-depth-input').addEventListener('input', event => {
            const value = Number.parseInt(event.target.value, 10);
            entry.systemDepth = Number.isFinite(value) ? value : 4;
        });
        fragment.appendChild(item);
    });
    list.replaceChildren(fragment);
}

function finishEditor() {
    const name = String(getWbElement('add-book-name-input')?.value || '').trim();
    const group = normalizeGroupName(getWbElement('add-book-group-input')?.value);
    if (!name) {
        window.showToast?.('请输入世界书名称');
        getWbElement('add-book-name-input')?.focus();
        return;
    }
    const entries = normalizeBookForSave();
    for (let index = 0; index < entries.length; index += 1) {
        if (!entries[index].content) {
            activeEntryId = tempEntries[index].__editorId;
            renderEntries();
            window.showToast?.(`请填写“${entries[index].title}”的内容`);
            return;
        }
        if (entries[index].triggerMode === 'keyword' && !entries[index].keyword) {
            activeEntryId = tempEntries[index].__editorId;
            renderEntries();
            window.showToast?.(`请填写“${entries[index].title}”的关键词`);
            return;
        }
    }
    if (editingBookId != null) {
        const book = worldBooks.find(item => String(item.id) === String(editingBookId));
        if (book) Object.assign(book, { name, group, entries, isGlobal: draftIsGlobal });
    } else {
        editingBookId = Date.now();
        worldBooks.push({ id: editingBookId, name, group, entries, isGlobal: draftIsGlobal, attachedRoles: [] });
    }
    if (group !== WB_UNGROUPED && !wbGroups.includes(group)) wbGroups.push(group);
    saveWorldBooksData();
    editorInitialSnapshot = getEditorSnapshot();
    renderWorldBooks({ force: true });
    if (activeWbGroupName) {
        if (normalizeGroupName(activeWbGroupName) === group) openWbGroupPage(group);
        else showWbMainPage();
    } else {
        showWbMainPage();
    }
    window.showToast?.('世界书已保存');
}

function requestCloseEditor() {
    if (!isEditorDirty()) {
        activeWbGroupName ? openWbGroupPage(activeWbGroupName) : showWbMainPage();
        return;
    }
    showCenteredConfirm({
        title: '放弃未保存的更改？',
        message: '返回后，本次编辑不会保存。',
        confirmText: '放弃更改',
        isDestructive: true,
        onConfirm: () => activeWbGroupName ? openWbGroupPage(activeWbGroupName) : showWbMainPage()
    });
}

function deleteCurrentBook() {
    if (editingBookId == null) return;
    showCenteredConfirm({
        title: '删除世界书',
        message: '确定要删除这本世界书吗？此操作不可恢复。',
        confirmText: '删除',
        isDestructive: true,
        onConfirm: () => {
            worldBooks = worldBooks.filter(book => String(book.id) !== String(editingBookId));
            saveWorldBooksData();
            activeWbGroupName ? openWbGroupPage(activeWbGroupName) : showWbMainPage();
            window.showToast?.('世界书已删除');
        }
    });
}

function openGroupNameDialog(groupName = null) {
    editingGroupName = groupName;
    getWbElement('wb-group-name-modal-title').textContent = groupName ? '重命名文件夹' : '新建文件夹';
    const input = getWbElement('wb-group-name-input');
    input.value = groupName || '';
    openWbOverlay('wb-group-name-overlay');
    window.setTimeout(() => input.focus(), 0);
}

function saveGroupName() {
    const input = getWbElement('wb-group-name-input');
    const nextName = String(input?.value || '').trim();
    normalizeGroups();
    if (!nextName) return window.showToast?.('请输入文件夹名称');
    if (nextName === WB_UNGROUPED) return window.showToast?.('“未分组”是系统文件夹');
    if (wbGroups.includes(nextName) && nextName !== editingGroupName) return window.showToast?.('该文件夹已存在');
    if (editingGroupName) {
        wbGroups = wbGroups.map(name => name === editingGroupName ? nextName : name);
        worldBooks.forEach(book => { if (normalizeGroupName(book.group) === editingGroupName) book.group = nextName; });
        if (activeWbGroupName === editingGroupName) activeWbGroupName = nextName;
    } else {
        wbGroups.push(nextName);
    }
    normalizeGroups();
    saveWorldBooksData();
    closeWbOverlay('wb-group-name-overlay');
    renderWorldBooks({ force: true });
    if (activeWbGroupName) renderGroupBookList(activeWbGroupName);
    window.showToast?.(editingGroupName ? '文件夹已重命名' : '文件夹已创建');
}

function deleteGroupByName(groupName) {
    const normalized = normalizeGroupName(groupName);
    if (normalized === WB_UNGROUPED) return;
    showCenteredConfirm({
        title: '删除文件夹',
        message: `“${normalized}”内的世界书会移到“未分组”。`,
        confirmText: '删除',
        isDestructive: true,
        onConfirm: () => {
            wbGroups = wbGroups.filter(group => group !== normalized);
            worldBooks.forEach(book => { if (normalizeGroupName(book.group) === normalized) book.group = WB_UNGROUPED; });
            saveWorldBooksData();
            if (activeWbGroupName === normalized) showWbMainPage();
            else renderWorldBooks({ force: true });
            window.showToast?.('文件夹已删除');
        }
    });
}

function toggleGroupMoreMenu() {
    const menu = getWbElement('wb-group-more-menu');
    if (!menu || !activeWbGroupName) return;
    if (!menu.hidden) {
        menu.hidden = true;
        return;
    }
    const canEdit = activeWbGroupName !== WB_UNGROUPED;
    menu.innerHTML = `
        <button type="button" data-menu-action="import"><i class="fas fa-file-import"></i>导入世界书</button>
        ${canEdit ? '<button type="button" data-menu-action="rename"><i class="fas fa-pen"></i>重命名文件夹</button><button type="button" class="is-danger" data-menu-action="delete"><i class="far fa-trash-alt"></i>删除文件夹</button>' : ''}`;
    menu.hidden = false;
    menu.querySelectorAll('[data-menu-action]').forEach(button => button.addEventListener('click', () => {
        const action = button.dataset.menuAction;
        menu.hidden = true;
        if (action === 'import') triggerWorldBookImport();
        if (action === 'rename') openGroupNameDialog(activeWbGroupName);
        if (action === 'delete') deleteGroupByName(activeWbGroupName);
    }));
}

function getFileBaseName(fileName = '') {
    return String(fileName || '导入的世界书').replace(/\.[^/.]+$/, '') || '导入的世界书';
}

function isSupportedWorldBookImportFile(file) {
    const name = String(file?.name || '').toLowerCase();
    return name.endsWith('.txt') || name.endsWith('.docx');
}

async function readWorldBookImportText(file) {
    if (String(file?.name || '').toLowerCase().endsWith('.docx')) {
        try { await window.u2LoadVendorLibrary?.('mammoth'); } catch (error) { console.warn('[worldbook] Could not load DOCX parser.', error); }
        if (!window.mammoth?.extractRawText) {
            window.showToast?.('DOCX 解析器加载失败，请先另存为 TXT 后导入');
            return null;
        }
        const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        if (!String(result?.value || '').trim()) throw new Error('DOCX 文件内容为空');
        return result.value;
    }
    return file.text();
}

function sanitizeImportedWorldBook(rawBook, fallbackName = '导入的世界书') {
    const source = rawBook && typeof rawBook === 'object' ? rawBook : {};
    const entries = (Array.isArray(source.entries) ? source.entries : [{ title: source.name || fallbackName, content: source.content || '' }])
        .map((entry, index) => normalizeEntryForEditor(entry, index))
        .filter(entry => String(entry.content || '').trim())
        .map(({ __editorId, ...entry }) => entry);
    return {
        id: Date.now() + Math.floor(Math.random() * 10000),
        name: String(source.name || fallbackName).trim() || fallbackName,
        group: normalizeGroupName(source.group || activeWbGroupName || WB_UNGROUPED),
        entries: entries.length ? entries : [{ title: '正文', content: '空白内容', keyword: '', triggerMode: 'permanent', injectionPosition: 'before_role', systemDepth: 4, order: 100, recursive: false, enabled: true }],
        isGlobal: !!source.isGlobal,
        attachedRoles: Array.isArray(source.attachedRoles) ? source.attachedRoles : []
    };
}

function parseImportedWorldBooks(text, file) {
    const name = getFileBaseName(file?.name || '');
    const content = String(text || '').trim();
    if (!content) throw new Error('文件内容为空');
    return [sanitizeImportedWorldBook({ name, group: activeWbGroupName || WB_UNGROUPED, entries: [{ title: name, content }] }, name)];
}

async function importWorldBookFile(file) {
    if (!file) return;
    if (!isSupportedWorldBookImportFile(file)) return window.showToast?.('仅支持导入 TXT 和 DOCX 文件');
    try {
        const text = await readWorldBookImportText(file);
        if (text === null) return;
        const importedBooks = parseImportedWorldBooks(text, file);
        worldBooks.push(...importedBooks);
        importedBooks.forEach(book => {
            const group = normalizeGroupName(book.group);
            if (group !== WB_UNGROUPED && !wbGroups.includes(group)) wbGroups.push(group);
        });
        saveWorldBooksData();
        renderWorldBooks({ force: true });
        if (activeWbGroupName) renderGroupBookList(activeWbGroupName);
        window.showToast?.(`已导入 ${importedBooks.length} 本世界书`);
    } catch (error) {
        console.error('Failed to import world book:', error);
        window.showToast?.('导入失败：请检查 TXT 或 DOCX 文件内容');
    }
}

function triggerWorldBookImport() {
    getWbElement('wb-import-file')?.click();
}

function makeSearchSnippet(value, query) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index < 0) return text.slice(0, 76);
    return `${index > 18 ? '…' : ''}${text.slice(Math.max(0, index - 18), index + query.length + 52)}${index + query.length + 52 < text.length ? '…' : ''}`;
}

function renderSearchResults(query) {
    const panel = getWbElement('wb-search-results');
    if (!panel) return;
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery) {
        panel.hidden = true;
        panel.replaceChildren();
        return;
    }
    const matches = [];
    worldBooks.forEach(book => {
        const bookName = String(book.name || '');
        if (bookName.toLowerCase().includes(normalizedQuery)) matches.push({ book, entry: null, snippet: makeSearchSnippet(bookName, normalizedQuery) });
        (Array.isArray(book.entries) ? book.entries : []).forEach((entry, entryIndex) => {
            const searchable = [entry.title, entry.keyword, entry.content].join('\n');
            if (searchable.toLowerCase().includes(normalizedQuery)) matches.push({ book, entryIndex, snippet: makeSearchSnippet(searchable, normalizedQuery) });
        });
    });
    panel.hidden = false;
    if (!matches.length) {
        panel.innerHTML = '<div class="wb-search-empty">没有找到匹配的世界书或词条</div>';
        return;
    }
    panel.innerHTML = matches.slice(0, 40).map((match, index) => `
        <button type="button" class="wb-search-result" data-result-index="${index}">
            <span class="wb-row-icon wb-book-icon"><i class="far fa-note-sticky"></i></span>
            <span><strong>${escapeHtml(match.entryIndex == null ? match.book.name || '未命名世界书' : match.book.entries[match.entryIndex].title || '未命名词条')}</strong><small>${escapeHtml(normalizeGroupName(match.book.group))} · ${escapeHtml(match.snippet)}</small></span><i class="fas fa-chevron-right"></i>
        </button>`).join('');
    panel.querySelectorAll('[data-result-index]').forEach(button => button.addEventListener('click', () => {
        const match = matches[Number(button.dataset.resultIndex)];
        getWbElement('wb-search-input').value = '';
        renderSearchResults('');
        const sourceEntries = Array.isArray(match.book.entries) ? match.book.entries : [];
        const targetEntry = Number.isInteger(match.entryIndex) ? sourceEntries[match.entryIndex] : null;
        openBookModal(match.book, null, targetEntry ? undefined : null);
        if (targetEntry) {
            const matchingDraft = tempEntries[match.entryIndex];
            activeEntryId = matchingDraft?.__editorId || activeEntryId;
            renderEntries();
        }
    }));
}

window.renderWorldBooks = renderWorldBooks;
window.renderWorldBookTab = renderWorldBookTab;
window.renderWorldBookGlobalTab = renderWorldBookGlobalTab;
window.renderWorldBookLocalTab = renderWorldBookLocalTab;

// Local mounting remains the shared public interface used by iMessage and other apps.
window.renderWorldBookSelector = function renderWorldBookSelector(selectedIds = [], onConfirm) {
    let selectedBookIds = [];
    let selector = getWbElement('wb-selector-sheet');
    if (!selector) {
        selector = document.createElement('div');
        selector.id = 'wb-selector-sheet';
        selector.className = 'bottom-sheet-overlay detail-sheet-overlay';
        selector.style.zIndex = '1150';
        selector.innerHTML = `
            <div class="bottom-sheet wb-selector-panel">
                <div class="sheet-handle"></div><div class="sheet-title">SELECT WORLD BOOK</div>
                <div class="wb-selector-body"><div class="wb-selector-field"><label for="wb-selector-group-select">SELECT GROUP</label><select id="wb-selector-group-select" class="wb-native-select"></select></div><div class="wb-selector-field"><label for="wb-selector-book-select">SELECT WORLD BOOK</label><select id="wb-selector-book-select" class="wb-native-select"></select><div id="wb-selector-empty" class="wb-selector-empty"></div></div><div class="wb-selector-preview-head"><span>MOUNTED</span><span id="wb-selector-mounted-count">0 LTEMS</span></div><div id="wb-selector-mounted-list" class="wb-selector-mounted-list"></div></div>
                <div class="wb-selector-actions"><button type="button" class="sheet-action wb-selector-action-btn" id="wb-selector-cancel-btn">Cancel</button><button type="button" class="sheet-action confirm-action wb-selector-action-btn" id="wb-selector-confirm-btn">Save</button></div>
            </div>`;
        (getWbElement('app') || document.body).appendChild(selector);
        selector.addEventListener('click', event => { if (event.target === selector) window.closeView?.(selector); });
    }
    const groupSelect = selector.querySelector('#wb-selector-group-select');
    const bookSelect = selector.querySelector('#wb-selector-book-select');
    const empty = selector.querySelector('#wb-selector-empty');
    const mountedList = selector.querySelector('#wb-selector-mounted-list');
    const mountedCount = selector.querySelector('#wb-selector-mounted-count');
    const getBook = id => worldBooks.find(book => String(book.id) === String(id));
    const renderGroups = () => {
        const current = normalizeGroupName(groupSelect.value);
        const groups = getAllDisplayGroups();
        groupSelect.innerHTML = groups.map(group => `<option value="${escapeAttr(group)}">${escapeHtml(group)}</option>`).join('');
        groupSelect.value = groups.includes(current) ? current : groups[0];
    };
    const renderBooks = () => {
        const selected = new Set(selectedBookIds.map(String));
        const books = getBooksInGroup(groupSelect.value).filter(book => !selected.has(String(book.id)));
        bookSelect.disabled = books.length === 0;
        bookSelect.innerHTML = books.length ? `<option value="">Select Items to Mount</option>${books.map(book => `<option value="${escapeAttr(book.id)}">${escapeHtml(book.name || '未命名世界书')} · +${getBookTokenCount(book)} Tokens</option>`).join('')}` : '<option value="">Nothing Available to Mount</option>';
        empty.textContent = books.length ? '' : 'no mountable ltems in this folder';
    };
    const renderMounted = () => {
        mountedCount.textContent = `${selectedBookIds.length} LTEMS`;
        mountedList.innerHTML = selectedBookIds.length ? selectedBookIds.map(id => {
            const book = getBook(id);
            if (!book) return '';
            return `<div class="wb-selector-mounted-card"><div class="wb-selector-mounted-icon"><i class="fas fa-book"></i></div><div class="wb-selector-mounted-info"><div class="wb-selector-mounted-name">${escapeHtml(book.name || '未命名世界书')}</div><div class="wb-selector-mounted-meta">${escapeHtml(normalizeGroupName(book.group))} · +${getBookTokenCount(book)} Tokens</div></div><button type="button" class="wb-selector-remove-btn" data-id="${escapeAttr(id)}" aria-label="移除"><i class="fas fa-times"></i></button></div>`;
        }).join('') : '<div class="wb-selector-mounted-empty">Not Mounted Yet</div>';
        mountedList.querySelectorAll('.wb-selector-remove-btn').forEach(button => button.addEventListener('click', () => {
            selectedBookIds = selectedBookIds.filter(id => String(id) !== String(button.dataset.id));
            renderMounted(); renderBooks();
        }));
    };
    selectedBookIds = (Array.isArray(selectedIds) ? selectedIds : []).map(String).filter((id, index, ids) => ids.indexOf(id) === index && getBook(id));
    renderGroups(); renderBooks(); renderMounted();
    groupSelect.onchange = renderBooks;
    bookSelect.onchange = () => { if (bookSelect.value) { selectedBookIds.push(String(bookSelect.value)); renderBooks(); renderMounted(); } };
    selector.querySelector('#wb-selector-cancel-btn').onclick = () => window.closeView?.(selector);
    selector.querySelector('#wb-selector-confirm-btn').onclick = () => { window.closeView?.(selector); if (typeof onConfirm === 'function') onConfirm([...selectedBookIds]); };
    window.openView?.(selector);
};

window.renderLegacyWorldBookSelector = window.renderWorldBookSelector;

window.autoSaveSummaryToWorldBook = function autoSaveSummaryToWorldBook(title, summaryText) {
    worldBooks.push({
        id: Date.now(), name: title || '自动总结', group: WB_UNGROUPED, isGlobal: true, attachedRoles: [],
        entries: [{ title: '总结内容', content: summaryText, keyword: '', triggerMode: 'permanent', injectionPosition: 'before_role', systemDepth: 4, order: 100, recursive: false, enabled: true }]
    });
    saveWorldBooksData();
    renderWorldBooks({ force: true });
    window.showToast?.('已自动生成全局世界书');
};

function initializeWorldBookUi() {
    if (typeof UI !== 'undefined') UI.views.worldBook = getWbElement('world-book-view');
    getWbElement('world-book-back-btn')?.addEventListener('click', () => closeWbOverlay('world-book-view'));
    getWbElement('wb-folder-add-btn')?.addEventListener('click', () => openGroupNameDialog());
    getWbElement('wb-folder-edit-btn')?.addEventListener('click', event => {
        wbFolderEditMode = !wbFolderEditMode;
        event.currentTarget.textContent = wbFolderEditMode ? '完成' : '编辑';
        renderWorldBooks({ force: true });
    });
    getWbElement('wb-main-add-book-btn')?.addEventListener('click', () => openBookModal());
    getWbElement('wb-group-back-btn')?.addEventListener('click', showWbMainPage);
    getWbElement('wb-group-add-book-btn')?.addEventListener('click', () => openBookModal(null, activeWbGroupName));
    getWbElement('wb-group-more-btn')?.addEventListener('click', toggleGroupMoreMenu);
    getWbElement('wb-editor-back-btn')?.addEventListener('click', requestCloseEditor);
    getWbElement('wb-editor-done-btn')?.addEventListener('click', finishEditor);
    getWbElement('add-book-entry-btn')?.addEventListener('click', addEntry);
    getWbElement('delete-world-book-btn')?.addEventListener('click', deleteCurrentBook);
    getWbElement('wb-editor-global-toggle')?.addEventListener('change', event => { draftIsGlobal = event.target.checked; });
    getWbElement('wb-group-name-cancel-btn')?.addEventListener('click', () => closeWbOverlay('wb-group-name-overlay'));
    getWbElement('wb-group-name-confirm-btn')?.addEventListener('click', saveGroupName);
    getWbElement('wb-group-name-input')?.addEventListener('keydown', event => { if (event.key === 'Enter') saveGroupName(); });
    getWbElement('wb-import-file')?.addEventListener('change', async event => {
        const file = event.target.files && event.target.files[0];
        await importWorldBookFile(file);
        event.target.value = '';
    });
    getWbElement('wb-search-input')?.addEventListener('input', event => renderSearchResults(event.target.value));
    document.addEventListener('click', event => {
        const menu = getWbElement('wb-group-more-menu');
        if (menu && !menu.hidden && !menu.contains(event.target) && !event.target.closest('#wb-group-more-btn')) menu.hidden = true;
    });
}

(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    if (window.StorageManager) {
        worldBooks = window.StorageManager.load('u2_worldBooks', []);
        wbGroups = window.StorageManager.load('u2_wbGroups', []);
    }
    normalizeGroups();
    renderWorldBooks({ force: true });
});

initializeWorldBookUi();
