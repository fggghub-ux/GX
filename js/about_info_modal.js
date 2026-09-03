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
            id: '2026-08-15',
            date: '2026年8月15日',
            summary: 'X、数据管理、聊天与线上生图功能更新。',
            sections: [
                {
                    title: 'X',
                    items: [
                        '新增切换账号功能。',
                        '优化运行性能。'
                    ]
                },
                {
                    title: '数据管理',
                    items: [
                        '新增图片压缩功能。'
                    ]
                },
                {
                    title: '聊天',
                    items: [
                        '新增自定义 Home 界面 CSS。',
                        '新增转发聊天记录功能。'
                    ]
                },
                {
                    title: '线上生图',
                    items: [
                        '新增单独重 Roll 功能。'
                    ]
                }
            ]
        },
        {
            id: '2026-08-13',
            date: '2026年8月13日',
            summary: '单聊线下生图、线下聊天 TXT 导出、聊天记忆优化与自动锁脸修复。',
            sections: [
                {
                    title: '聊天记忆',
                    items: [
                        '短期记忆和长期记忆均新增“读取条数”设置，可按聊天单独调整 AI 的相关记忆召回数量。',
                        '短期记忆支持多选归纳为一条长期记忆；确认保存后会自动移除已归纳的短期条目。'
                    ]
                },
                {
                    title: '单聊与线下模式',
                    items: [
                        '单聊线下设定新增“线下自动生图”开关，开启后沿用线上生图提示词与自动锁脸。',
                        '线下聊天新增全部聊天记录 TXT 导出。'
                    ]
                },
                {
                    title: '问题修复',
                    items: [
                        '修复线上自动生图的自动锁脸；已上传角色参考脸时，开启“自动锁脸”即可使用。'
                    ]
                }
            ]
        },
        {
            id: '2026-08-12',
            date: '2026年8月12日',
            summary: '数据管理、世界书与群聊设置优化，Pay 和表情包能力更新。',
            sections: [
                {
                    title: '界面与内容',
                    items: [
                        '优化数据管理与世界书的界面体验。',
                        '表情包贴图支持添加描述。'
                    ]
                },
                {
                    title: 'Pay 与群聊',
                    items: [
                        'Pay 新增充值功能，亲属卡支持解绑。',
                        '群聊新增“允许角色私聊”与“允许角色和角色好友私聊”开关。'
                    ]
                },
                {
                    title: '线下模式',
                    items: [
                        '进行线下性能小优化。'
                    ]
                }
            ]
        },
        {
            id: '2026-08-11',
            date: '2026年8月11日',
            summary: 'AI 兼容性、Netflix 玩法、TTS 与聊天记忆优化。',
            sections: [
                {
                    title: '功能更新',
                    items: [
                        '兼容 iOS 16.4 以下系统无法调用 AI 接口的问题。',
                        '重构 Netflix 玩法，未完善，测试中。',
                        '优化 TTS，增加更多服务商。',
                        '群聊增加 TTS。',
                        'X 和单聊记忆互通，未完善，测试中。'
                    ]
                },
                {
                    title: '线下模式',
                    items: [
                        '优化总结，增加总结楼层。',
                        '增加两个由 haru宝宝提供的单楼回顾条目，可在提示词中开启；注意 CoT 也要一并开启。'
                    ]
                }
            ]
        },
        {
            id: '2026-08-10',
            date: '2026年8月10日',
            summary: '识图、X 与朋友圈权限上线，并修复语言播放和排序问题',
            sections: [
                {
                    title: '新增功能',
                    items: [
                        '新增识图能力。',
                        '接入 X。',
                        '朋友圈新增“谁可以看见”权限设置。',
                        '角色发布朋友圈后，仅其关系网内的角色可以互动。'
                    ]
                },
                {
                    title: '问题修复',
                    items: [
                        '修复上移功能异常的问题。',
                        '修复粤语和自定义语言无法播放的问题。'
                    ]
                }
            ]
        },
        {
            id: '2026-08-07',
            date: '2026年8月7日',
            summary: '接口、聊天兼容性与多项新能力优化',
            sections: [
                {
                    title: '功能更新',
                    items: [
                        '优化接口兼容性。',
                        '支持聊天最小/最大气泡条数。',
                        '优化回车兼容性。',
                        '新增自动生图。',
                        '支持外接向量记忆。',
                        '新增中文 UI。'
                    ]
                }
            ]
        },
        {
            id: '2026-08-04',
            date: '2026年8月4日',
            summary: '线下模式、世界书与群聊体验优化',
            sections: [
                {
                    title: '性能与翻译',
                    items: [
                        '优化线下模式性能与世界书体验。',
                        '修复 Loves 动态双语翻译。'
                    ]
                },
                {
                    title: '群聊与美化',
                    items: [
                        '支持群聊 ID 切换。',
                        '新增群聊美化与美化方案导入。'
                    ]
                }
            ]
        },
        {
            id: '2026-08-03',
            date: '2026年8月3日',
            summary: '整体性能、备份与聊天显示优化',
            sections: [
                {
                    title: '体验优化',
                    items: [
                        '优化整体运行性能。',
                        '优化备份流程与聊天内容显示。'
                    ]
                }
            ]
        },
        {
            id: '2026-08-02',
            date: '2026年8月2日',
            summary: '聊天体验优化与多项功能新增',
            sections: [
                {
                    title: '性能与体验',
                    items: [
                        '优化整体性能、线上 CoT 与群通话体验。',
                        '聊天页面内不再弹出消息通知。'
                    ]
                },
                {
                    title: '新增功能',
                    items: [
                        '新增生图与单次回复条数设置。',
                        '支持默认语言自定义。',
                        '支持群聊翻译自动展开。',
                        '新增匿名问答。'
                    ]
                }
            ]
        },
        {
            id: '2026-08-01',
            date: '2026年8月1日',
            summary: '登录、兼容性与聊天能力优化',
            sections: [
                {
                    title: '性能与兼容',
                    items: [
                        '优化整体性能、登录以及导入导出备份流程。',
                        '修复 YTB 私信问题并提升 Edge 兼容性。'
                    ]
                },
                {
                    title: '聊天与模型',
                    items: [
                        '优化线上 CoT、心声自定义与报错处理。',
                        '单聊支持翻译自动展开。',
                        '群聊支持 U 头像。'
                    ]
                }
            ]
        },
        {
            id: '2026-07-31',
            date: '2026年7月31日',
            summary: '性能问题修复与多设备登录支持',
            sections: [
                {
                    title: '性能与界面',
                    items: [
                        '修复全局字体调整引起的卡顿，并改善界面适配。'
                    ]
                },
                {
                    title: '问题修复',
                    items: [
                        '修复 Bstage 与聊天记录搜索页面问题。',
                        '修复 U 人设未被读取的问题，并优化心声提示词。'
                    ]
                },
                {
                    title: '登录',
                    items: [
                        '账密登录支持多设备同时使用。'
                    ]
                }
            ]
        }
    ];
    const LATEST_CHANGELOG_ENTRY_ID = CHANGELOG_ENTRIES[0]?.id || '';
    const AUTO_CHANGELOG_DELAY_MS = 250;
    const ACKNOWLEDGEMENT_DELAY_MS = 3000;
    // Version the key so accounts that saw an earlier release receive this one once.
    const CHANGELOG_NOTICE_STORAGE_PREFIX = 'u2_changelog_notice_seen:20260815-v1:';
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
