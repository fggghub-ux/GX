(function () {
    const modal = document.getElementById('about-info-modal');
    const title = document.getElementById('about-info-modal-title');
    const disclaimerContent = document.getElementById('about-disclaimer-content');
    const changelogContent = document.getElementById('about-changelog-content');
    const changelogListView = document.getElementById('about-changelog-list-view');
    const changelogList = document.getElementById('about-changelog-list');
    const changelogDetailView = document.getElementById('about-changelog-detail-view');
    const changelogDetailDate = document.getElementById('about-changelog-detail-date');
    const changelogDetailContent = document.getElementById('about-changelog-detail-content');
    const backButton = document.getElementById('about-info-modal-back');
    const closeButton = document.getElementById('about-info-modal-close');
    const confirmButton = document.getElementById('about-info-modal-confirm');
    const CHANGELOG_ENTRIES = [
        {
            id: 'September 4, 2026',
            date: 'September 4, 2026',
            summary: ' ',
            sections: [
                {
                    title: ' ',
                    items: [
                        'IHG',
                    ]
                }
            ]
        },
        {
            id: 'September 7, 2026',
            date: 'September 7, 2026',
            summary: ' ',
            sections: [
                {
                    title: ' ',
                    items: [
                        'Sol',
                    ]
                }
            ]
        },
        {
            id: 'August 15, 2026',
            date: 'August 15, 2026',
            summary: ' ',
            sections: [
                {
                    title: ' ',
                    items: [
                        'Updated',
                    ]
                }
            ]
        },
        {
            id: 'July 1, 2026',
            date: 'July 1, 2026',
            summary: ' ',
            sections: [
                {
                    title: ' ',
                    items: [
                        'leo',
                    ]
                }
            ]
        },
        {
            id: 'January 13, 2026',
            date: 'January 13, 2026',
            summary: ' ',
            sections: [
                {
                    title: ' ',
                    items: [
                        'zy',
                    ]
                }
            ]
        },
        {
            id: 'June 9, 2025',
            date: 'June 9, 2025',
            summary: ' ',
            sections: [
                {
                    title: ' ',
                    items: [
                        '4o',
                    ]
                }
            ]
        },
    ];
    const LATEST_CHANGELOG_ENTRY_ID = CHANGELOG_ENTRIES[0]?.id || '';
    const AUTO_CHANGELOG_DELAY_MS = 250;
    const ACKNOWLEDGEMENT_DELAY_MS = 3000;
    // Version the key so accounts that saw an earlier release receive this one once.
    const CHANGELOG_NOTICE_STORAGE_PREFIX = 'u2_changelog_notice_seen:September 4, 2026-v1:';
    let returnFocus = null;
    let previousBodyOverflow = '';
    let activeChangelogTrigger = null;
    let autoNoticeTimer = null;
    let autoNoticeInFlight = false;
    let pendingMainInterfaceUsername = '';
    let latestNoticeEligibilityReady = false;
    let acknowledgementTimer = null;
    let acknowledgementInterval = null;
    let dismissalLocked = false;
    let pendingNoticeStorageKey = '';
    const seenNoticeKeys = new Set();

    function getChangelogEntry(id) {
        return CHANGELOG_ENTRIES.find((entry) => entry.id === id) || null;
    }

    function setModalTitle(value) {
        if (title) title.textContent = value;
    }

    function getNoticeStorageKey(username) {
        const account = String(username || 'local')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '_') || 'local';
        return `${CHANGELOG_NOTICE_STORAGE_PREFIX}${LATEST_CHANGELOG_ENTRY_ID}:${account}`;
    }

    async function hasSeenLatestChangelog(storageKey) {
        if (seenNoticeKeys.has(storageKey)) return true;
        try {
            if (window.appStorage?.ready) await window.appStorage.ready;
            const seen = await window.appStorage?.getSetting?.(storageKey, false) === true;
            if (seen) seenNoticeKeys.add(storageKey);
            return seen;
        } catch {
            return false;
        }
    }

    async function markLatestChangelogSeen(storageKey) {
        if (!storageKey) return;
        seenNoticeKeys.add(storageKey);
        try {
            if (window.appStorage?.ready) await window.appStorage.ready;
            await window.appStorage?.setSetting?.(storageKey, true);
        } catch {
            // The notice can still be dismissed when browser storage is unavailable.
        }
    }

    function resetAcknowledgementControls() {
        if (acknowledgementTimer) window.clearTimeout(acknowledgementTimer);
        if (acknowledgementInterval) window.clearInterval(acknowledgementInterval);
        acknowledgementTimer = null;
        acknowledgementInterval = null;
        dismissalLocked = false;
        pendingNoticeStorageKey = '';
        if (closeButton) closeButton.disabled = false;
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.textContent = 'u';
        }
    }

    function startAcknowledgementDelay(storageKey) {
        resetAcknowledgementControls();
        pendingNoticeStorageKey = storageKey;
        dismissalLocked = true;
        if (closeButton) closeButton.disabled = true;
        if (backButton) backButton.hidden = true;
        if (confirmButton) confirmButton.disabled = true;

        const deadline = Date.now() + ACKNOWLEDGEMENT_DELAY_MS;
        const updateCountdown = () => {
            const secondsRemaining = Math.ceil(Math.max(0, deadline - Date.now()) / 1000);
            if (confirmButton) confirmButton.textContent = secondsRemaining > 0 ? `u（${secondsRemaining}秒）` : '知道了';
        };
        updateCountdown();
        acknowledgementInterval = window.setInterval(updateCountdown, 250);
        acknowledgementTimer = window.setTimeout(() => {
            if (acknowledgementInterval) window.clearInterval(acknowledgementInterval);
            acknowledgementInterval = null;
            acknowledgementTimer = null;
            dismissalLocked = false;
            if (closeButton) closeButton.disabled = false;
            if (confirmButton) {
                confirmButton.disabled = false;
                confirmButton.textContent = 'u';
            }
        }, ACKNOWLEDGEMENT_DELAY_MS);
    }

    function renderChangelogList() {
        if (!changelogList) return;
        changelogList.replaceChildren();

        CHANGELOG_ENTRIES.forEach((entry) => {
            const item = document.createElement('button');
            const copy = document.createElement('span');
            const date = document.createElement('strong');
            const summary = document.createElement('small');
            const arrow = document.createElement('i');

            item.type = 'button';
            item.className = 'about-changelog-entry';
            item.dataset.changelogId = entry.id;
            item.setAttribute('aria-label', `查看 ${entry.date} 更新内容`);
            date.textContent = entry.date;
            summary.textContent = entry.summary;
            copy.className = 'about-changelog-entry-copy';
            copy.append(date, summary);
            arrow.className = 'fas fa-chevron-right';
            arrow.setAttribute('aria-hidden', 'true');
            item.append(copy, arrow);
            item.addEventListener('click', () => showChangelogDetail(entry.id, item));
            changelogList.append(item);
        });
    }

    function showChangelogList({ restoreFocus = false } = {}) {
        if (changelogListView) changelogListView.hidden = false;
        if (changelogDetailView) changelogDetailView.hidden = true;
        if (backButton) backButton.hidden = true;
        setModalTitle('Desire');

        const focusTarget = activeChangelogTrigger;
        activeChangelogTrigger = null;
        if (restoreFocus && focusTarget && document.contains(focusTarget)) focusTarget.focus();
    }

    function showChangelogDetail(id, trigger) {
        const entry = getChangelogEntry(id);
        if (!entry || !changelogDetailContent) return;

        activeChangelogTrigger = trigger || changelogList?.querySelector(`[data-changelog-id="${id}"]`) || null;
        changelogDetailContent.replaceChildren();
        if (changelogDetailDate) changelogDetailDate.textContent = entry.date;

        entry.sections.forEach((section) => {
            const sectionElement = document.createElement('section');
            const heading = document.createElement('h3');
            const list = document.createElement('ul');

            sectionElement.className = 'about-changelog-section';
            heading.textContent = section.title;
            section.items.forEach((item) => {
                const listItem = document.createElement('li');
                listItem.textContent = item;
                list.append(listItem);
            });
            sectionElement.append(heading, list);
            changelogDetailContent.append(sectionElement);
        });

        if (changelogListView) changelogListView.hidden = true;
        if (changelogDetailView) changelogDetailView.hidden = false;
        if (backButton) backButton.hidden = false;
        setModalTitle('Desire');
        backButton?.focus();
    }

    function open(mode = 'disclaimer', options = {}) {
        if (!modal) return false;
        const safeOptions = options && typeof options === 'object' ? options : {};
        const showChangelog = mode === 'changelog';
        const changelogEntryId = showChangelog ? String(safeOptions.changelogEntryId || '') : '';
        const noticeStorageKey = showChangelog ? String(safeOptions.noticeStorageKey || '') : '';
        returnFocus = document.activeElement;
        resetAcknowledgementControls();
        if (disclaimerContent) disclaimerContent.hidden = showChangelog;
        if (changelogContent) changelogContent.hidden = !showChangelog;
        if (showChangelog) {
            renderChangelogList();
            showChangelogList();
            if (changelogEntryId) showChangelogDetail(changelogEntryId);
        } else {
            if (backButton) backButton.hidden = true;
            setModalTitle('Gravity');
        }
        previousBodyOverflow = document.body.style.overflow;
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        if (noticeStorageKey) {
            startAcknowledgementDelay(noticeStorageKey);
            changelogDetailView?.focus();
        } else {
            closeButton?.focus();
        }
        return true;
    }

    function close() {
        if (!modal || modal.hidden || dismissalLocked) return false;
        void markLatestChangelogSeen(pendingNoticeStorageKey);
        resetAcknowledgementControls();
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = previousBodyOverflow;
        previousBodyOverflow = '';
        if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
        returnFocus = null;
        return true;
    }

    async function showLatestChangelogNotice(username) {
        if (!latestNoticeEligibilityReady || !LATEST_CHANGELOG_ENTRY_ID || !modal || !modal.hidden) return false;
        const storageKey = getNoticeStorageKey(username);
        if (await hasSeenLatestChangelog(storageKey)) return false;
        if (!modal.hidden) return false;
        return open('changelog', {
            changelogEntryId: LATEST_CHANGELOG_ENTRY_ID,
            noticeStorageKey: storageKey
        });
    }

    function scheduleLatestChangelogNotice(event) {
        pendingMainInterfaceUsername = event?.detail?.username || pendingMainInterfaceUsername || '';
        if (!latestNoticeEligibilityReady || autoNoticeTimer || autoNoticeInFlight || !modal?.hidden) return;
        const username = pendingMainInterfaceUsername;
        const storageKey = getNoticeStorageKey(username);
        autoNoticeInFlight = true;
        hasSeenLatestChangelog(storageKey).then((hasSeen) => {
            if (hasSeen || !modal?.hidden) return;
            autoNoticeTimer = window.setTimeout(() => {
                autoNoticeTimer = null;
                showLatestChangelogNotice(username).finally(() => {
                    autoNoticeInFlight = false;
                });
            }, AUTO_CHANGELOG_DELAY_MS);
        }).catch(() => {}).finally(() => {
            if (!autoNoticeTimer) autoNoticeInFlight = false;
        });
    }

    function allowLatestChangelogNotice() {
        latestNoticeEligibilityReady = true;
        if (pendingMainInterfaceUsername || window.u2Auth?.isLoggedIn?.()) {
            scheduleLatestChangelogNotice({ detail: { username: pendingMainInterfaceUsername } });
        }
    }

    closeButton?.addEventListener('click', close);
    confirmButton?.addEventListener('click', close);
    backButton?.addEventListener('click', () => showChangelogList({ restoreFocus: true }));
    modal?.addEventListener('click', (event) => {
        if (event.target === modal) close();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal && !modal.hidden) close();
    });
    window.addEventListener('u2:main-interface-ready', scheduleLatestChangelogNotice);
    window.addEventListener('u2:splash-screen-removed', allowLatestChangelogNotice, { once: true });
    if (window.u2SplashScreenRemoved === true) allowLatestChangelogNotice();

    window.u2AboutInfoModal = { open, close, showLatestChangelogNotice };
})();
