// ==========================================
// IMESSAGE: 4_chat_status.js
// ==========================================
(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    window.imChat = window.imChat || {};

    function formatProfileStatusLabel(value, isSleeping = false) {
        if (isSleeping) return 'offline';
        const raw = String(value || 'online').trim();
        const normalized = raw.toLowerCase();
        if (normalized === 'offline' || raw === '离线') return 'offline';
        if (normalized === 'online' || raw === '在线') return 'online';
        return raw || 'online';
    }

    async function commitStatusFriendChange(friendOrId, mutator, options = {}) {
        const commitOptions = {
            metaOnly: options.metaOnly !== false,
            ...options
        };

        return window.imApp.commitScopedFriendChange(friendOrId, mutator, {
            syncActive: true,
            ...commitOptions
        });
    }

    function ensureProfilePanelData(friend) {
        if (!friend) return window.imApp.createDefaultProfilePanel({});
        if (window.imApp.migrateSingleChatProfileStatus) {
            window.imApp.migrateSingleChatProfileStatus(friend);
        }
        const nextPanel = window.imApp.createDefaultProfilePanel(friend);
        friend.profilePanel = nextPanel;
        friend.latestThought = nextPanel.thought;
        friend.status = nextPanel.status || 'online';
        return nextPanel;
    }

    function getProfilePanelData(friend) {
        if (!friend) return window.imApp.createDefaultProfilePanel({});
        return ensureProfilePanelData(friend);
    }

    function getProfilePanelUiState(friendOrId) {
        const targetId = window.imApp.resolveFriendId(friendOrId);
        const safeFriendId = targetId != null ? String(targetId) : 'default';
        const stateMap = window.imData.profilePanelUiStateByFriendId || (window.imData.profilePanelUiStateByFriendId = {});
        const existingState = stateMap[safeFriendId];

        if (
            !existingState ||
            typeof existingState !== 'object' ||
            typeof existingState.activeTab !== 'string'
        ) {
            stateMap[safeFriendId] = {
                open: false,
                activeTab: 'thought',
                selectedHistoryIndex: 0
            };
        }

        if (!['thought', 'events'].includes(stateMap[safeFriendId].activeTab)) {
            stateMap[safeFriendId].activeTab = 'thought';
        }
        if (!Number.isInteger(stateMap[safeFriendId].selectedHistoryIndex) || stateMap[safeFriendId].selectedHistoryIndex < 0) {
            stateMap[safeFriendId].selectedHistoryIndex = 0;
        }

        return stateMap[safeFriendId];
    }

    function setProfilePanelTab(friendOrId, tabName) {
        const uiState = window.imChat.getProfilePanelUiState(friendOrId);
        const safeTab = ['thought', 'events'].includes(tabName) ? tabName : 'thought';
        uiState.activeTab = safeTab;

        const targetFriend = window.imApp.getFriendById(friendOrId);
        if (targetFriend) {
            ensureProfilePanelData(targetFriend).activeTab = safeTab;
        }

        return safeTab;
    }

    function getProfilePanelEvents(friend) {
        const panel = window.imChat.getProfilePanelData(friend);
        return Array.isArray(panel.events) ? panel.events : [];
    }

    function escapeProfilePanelHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getProfileStatusHistory(friend, panelOverride = null) {
        const panel = panelOverride || window.imChat.getProfilePanelData(friend);
        return Array.isArray(panel.statusHistory) ? panel.statusHistory : [];
    }

    function getSelectedProfileStatus(friend, panelOverride = null) {
        const history = getProfileStatusHistory(friend, panelOverride);
        const uiState = window.imChat.getProfilePanelUiState(friend);
        const index = Math.max(0, Math.min(uiState.selectedHistoryIndex || 0, Math.max(0, history.length - 1)));
        uiState.selectedHistoryIndex = index;
        return { history, index, snapshot: history[index] || null };
    }

    function applySnapshotAsCurrent(panel, friend, snapshot) {
        if (!panel || !friend) return;
        panel.thought = snapshot?.thought || '';
        panel.affection = typeof snapshot?.affection === 'number' ? snapshot.affection : 0;
        panel.affectionChange = typeof snapshot?.affectionChange === 'number' ? snapshot.affectionChange : 0;
        friend.latestThought = panel.thought;
    }

    async function editProfileStatusSnapshot(friendOrId, snapshotId, updates) {
        const targetFriend = window.imApp.getFriendById(friendOrId);
        if (!targetFriend || !snapshotId || !updates) return false;

        return commitStatusFriendChange(targetFriend, (friend) => {
            const panel = ensureProfilePanelData(friend);
            const history = Array.isArray(panel.statusHistory) ? panel.statusHistory : [];
            const index = history.findIndex(item => String(item.id) === String(snapshotId));
            if (index < 0) return;
            const snapshot = history[index];
            if (typeof updates.thought === 'string') snapshot.thought = updates.thought.trim();
            snapshot.legacy = false;
            panel.statusHistory = history;
            if (index === 0) applySnapshotAsCurrent(panel, friend, snapshot);
        }, { silent: true });
    }

    async function deleteProfileStatusSnapshot(friendOrId, snapshotId) {
        const targetFriend = window.imApp.getFriendById(friendOrId);
        if (!targetFriend || !snapshotId) return false;

        return commitStatusFriendChange(targetFriend, (friend) => {
            const panel = ensureProfilePanelData(friend);
            const history = Array.isArray(panel.statusHistory) ? panel.statusHistory : [];
            const index = history.findIndex(item => String(item.id) === String(snapshotId));
            if (index < 0) return;
            history.splice(index, 1);
            panel.statusHistory = history;
            if (index === 0) applySnapshotAsCurrent(panel, friend, history[0] || null);
        }, { silent: true });
    }

    function getProfilePanelMetrics() {
        return [];
    }

    function buildCherishedMemoryEntryFromEvent(eventItem, friend) {
        if (!eventItem) return null;

        const payload = eventItem.memoryPayload && typeof eventItem.memoryPayload === 'object'
            ? eventItem.memoryPayload
            : null;

        const entryId = `cherished-${eventItem.id || Date.now()}`;
        const title = payload?.title || eventItem.title || '珍视回忆';
        const content = payload?.content || eventItem.requestText || eventItem.description || '';
        const detail = payload?.detail || eventItem.detail || '';
        const reason = payload?.reason || '';
        const createdAt = payload?.createdAt || eventItem.time || '';
        const sourceThought = payload?.sourceThought
            || friend?.profilePanel?.thought
            || friend?.latestThought
            || '';
        const triggerKeywords = window.imChat?.normalizeMemoryTriggerKeywords
            ? window.imChat.normalizeMemoryTriggerKeywords(payload?.triggerKeywords || [])
            : (Array.isArray(payload?.triggerKeywords) ? payload.triggerKeywords : []);

        if (!content.trim()) return null;

        return {
            id: entryId,
            title,
            content,
            detail,
            reason,
            sourceEventId: String(payload?.sourceEventId || eventItem.id || ''),
            createdAt,
            sourceThought,
            triggerKeywords
        };
    }

    function mergeCherishedMemoryText(existingText, entry) {
        const baseText = typeof existingText === 'string' ? existingText.trim() : '';
        if (!entry || !entry.content) return baseText;

        const parts = [
            entry.title ? `【${entry.title}】` : '',
            entry.content || '',
            entry.reason ? `原因：${entry.reason}` : ''
        ].filter(Boolean);

        const block = parts.join('\n').trim();
        if (!block) return baseText;
        if (baseText.includes(entry.content)) return baseText;

        return baseText ? `${baseText}\n\n${block}` : block;
    }

    async function confirmMemoryRequestEvent(friendOrId, eventId) {
        const targetFriend = window.imApp.getFriendById(friendOrId);
        if (!targetFriend || !eventId) return false;

        const saved = await commitStatusFriendChange(targetFriend, (friend) => {
            if (!friend) return;
            friend.memory = window.imApp.normalizeFriendData(friend).memory;

            const panel = ensureProfilePanelData(friend);
            const events = Array.isArray(panel.events) ? panel.events : [];
            const eventIndex = events.findIndex((eventItem) => String(eventItem.id) === String(eventId));
            if (eventIndex < 0) return;

            const targetEvent = events[eventIndex];
            const nextEntry = buildCherishedMemoryEntryFromEvent(targetEvent, friend);
            if (!nextEntry) {
                events.splice(eventIndex, 1);
                panel.events = events;
                return;
            }

            const existingEntries = Array.isArray(friend.memory.cherishedEntries)
                ? friend.memory.cherishedEntries
                : [];

            const duplicated = existingEntries.some((entry) => {
                if (!entry) return false;
                if (entry.sourceEventId && String(entry.sourceEventId) === String(targetEvent.id)) return true;
                return String(entry.content || '').trim() && String(entry.content || '').trim() === String(nextEntry.content || '').trim();
            });

            if (!duplicated) {
                existingEntries.push(nextEntry);
            }

            friend.memory.cherishedEntries = existingEntries;
            friend.memory.cherished = mergeCherishedMemoryText(friend.memory.cherished, nextEntry);
            
            events.splice(eventIndex, 1);
            panel.events = events;
        }, { silent: true });

        return saved;
    }

    async function cancelMemoryRequestEvent(friendOrId, eventId) {
        const targetFriend = window.imApp.getFriendById(friendOrId);
        if (!targetFriend || !eventId) return false;

        return commitStatusFriendChange(targetFriend, (friend) => {
            if (!friend) return;
            const panel = ensureProfilePanelData(friend);
            let events = Array.isArray(panel.events) ? panel.events : [];
            events = events.filter((eventItem) => String(eventItem.id) !== String(eventId));
            panel.events = events;
        }, { silent: true });
    }

    function showProfileEventDetail(friend, eventId, panelEl) {
        if (!friend || !eventId || !panelEl) return;

        const overlay = panelEl.querySelector('.chat-profile-event-detail-overlay');
        const titleEl = panelEl.querySelector('.chat-profile-event-detail-title');
        const timeEl = panelEl.querySelector('.chat-profile-event-detail-time');
        const descEl = panelEl.querySelector('.chat-profile-event-detail-desc');
        const detailEl = panelEl.querySelector('.chat-profile-event-detail-detail');

        if (!overlay || !titleEl || !timeEl || !descEl || !detailEl) return;

        const events = window.imChat.getProfilePanelEvents(friend);
        const targetEvent = events.find((eventItem) => String(eventItem.id) === String(eventId));
        if (!targetEvent) return;

        titleEl.textContent = targetEvent.title || '事件详情';
        timeEl.textContent = targetEvent.time || '';
        descEl.textContent = targetEvent.requestText || targetEvent.description || '暂无内容';
        detailEl.textContent = targetEvent.detail
            || targetEvent.memoryPayload?.detail
            || targetEvent.memoryPayload?.reason
            || '暂无更多详情';

        overlay.style.display = 'flex';
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });
    }

    function hideProfileEventDetail(panelEl) {
        if (!panelEl) return;
        const overlay = panelEl.querySelector('.chat-profile-event-detail-overlay');
        if (!overlay) return;

        overlay.classList.remove('active');
        setTimeout(() => {
            if (!overlay.classList.contains('active')) {
                overlay.style.display = 'none';
            }
        }, 220);
    }

    function buildProfilePanelBody(friend, activeTab, renderContext = {}) {
        const panel = renderContext.panel || window.imChat.getProfilePanelData(friend);
        const safeTab = ['thought', 'events'].includes(activeTab) ? activeTab : 'thought';

        if (safeTab === 'events') {
            const events = Array.isArray(renderContext.events)
                ? renderContext.events
                : (Array.isArray(panel.events) ? panel.events : []);
            if (events.length === 0) {
                return `
                    <div class="chat-profile-panel-empty">
                        <div class="chat-profile-panel-empty-title">暂无事件</div>
                        <div class="chat-profile-panel-empty-desc">这里会展示和这个角色相关的近期事件记录。</div>
                    </div>
                `;
            }

            return `
                <div class="chat-profile-panel-events">
                    ${events.map((eventItem) => {
                        if (eventItem.type === 'memory_request') {
                            const statusLabel = eventItem.status === 'confirmed'
                                ? '<span class="chat-profile-memory-request-badge is-confirmed">已记住</span>'
                                : eventItem.status === 'cancelled'
                                    ? '<span class="chat-profile-memory-request-badge is-cancelled">已取消</span>'
                                    : '<span class="chat-profile-memory-request-badge">待处理</span>';

                            const actionHtml = eventItem.status === 'pending'
                                ? `
                                    <div class="chat-profile-memory-request-actions">
                                        <button type="button" class="chat-profile-memory-request-btn is-confirm" data-action="confirm-memory-request" data-event-id="${eventItem.id}">${eventItem.confirmText || '确认'}</button>
                                        <button type="button" class="chat-profile-memory-request-btn is-cancel" data-action="cancel-memory-request" data-event-id="${eventItem.id}">${eventItem.cancelText || '取消'}</button>
                                    </div>
                                `
                                : '';

                            return `
                                <div class="chat-profile-memory-request-card" data-event-id="${eventItem.id}" data-event-type="memory_request">
                                    <div class="chat-profile-memory-request-top">
                                        <div class="chat-profile-memory-request-title">${eventItem.title || '想记住某件事'}</div>
                                        ${statusLabel}
                                    </div>
                                    <div class="chat-profile-memory-request-content">${eventItem.requestText || eventItem.description || '想把这一刻记住。'}</div>
                                    ${eventItem.detail ? `<div class="chat-profile-memory-request-detail">${eventItem.detail}</div>` : ''}
                                    <div class="chat-profile-memory-request-footer">
                                        ${eventItem.time ? `<div class="chat-profile-memory-request-time">${eventItem.time}</div>` : '<div></div>'}
                                        <button type="button" class="chat-profile-memory-request-detail-trigger" data-action="open-event-detail" data-event-id="${eventItem.id}">查看详情</button>
                                    </div>
                                    ${actionHtml}
                                </div>
                            `;
                        }

                        return `
                            <div class="chat-profile-event-item" data-event-id="${eventItem.id}">
                                <div class="chat-profile-event-dot"></div>
                                <div class="chat-profile-event-main">
                                    <div class="chat-profile-event-title-row">
                                        <div class="chat-profile-event-title">${eventItem.title || '新的事件'}</div>
                                        ${eventItem.time ? `<div class="chat-profile-event-time">${eventItem.time}</div>` : ''}
                                    </div>
                                    ${eventItem.description ? `<div class="chat-profile-event-desc">${eventItem.description}</div>` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        const { history, index: selectedIndex } = renderContext.statusSelection
            || getSelectedProfileStatus(friend, panel);
        if (history.length === 0) {
            return `
                <div class="chat-profile-panel-empty">
                    <div class="chat-profile-panel-empty-title">暂无状态</div>
                    <div class="chat-profile-panel-empty-desc">生成新的聊天回复后，这里会保存完整状态记录。</div>
                </div>
            `;
        }

        const snapshot = history[selectedIndex];
        const createdAt = snapshot.createdAt ? new Date(snapshot.createdAt) : null;
        const timeLabel = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleString() : '时间未记录';
        const field = (value) => escapeProfilePanelHtml(value || '未记录');
        return `
            <div class="chat-profile-status-page" data-selected-index="${selectedIndex}" data-status-id="${escapeProfilePanelHtml(snapshot.id)}">
                <div class="chat-profile-status-time">${escapeProfilePanelHtml(timeLabel)}</div>
                <div class="gmp-inner-voice chat-profile-panel-thought">${field(snapshot.thought)}</div>
                <div class="chat-profile-status-counter"><span>${selectedIndex + 1}</span> / ${history.length}</div>
            </div>
        `;
    }

    function renderProfileStatusSelection(friend, panelEl, panelOverride = null) {
        if (!friend || !panelEl) return;
        const panel = panelOverride || window.imChat.getProfilePanelData(friend);
        const statusSelection = getSelectedProfileStatus(friend, panel);
        const selectedStatus = statusSelection.snapshot;
        const contentEl = panelEl.querySelector('.chat-profile-panel-content');

        if (contentEl) {
            contentEl.innerHTML = buildProfilePanelBody(friend, 'thought', {
                panel,
                statusSelection
            });
        }

        const affection = typeof selectedStatus?.affection === 'number'
            ? selectedStatus.affection
            : (typeof panel.affection === 'number' ? panel.affection : 0);
        const affectionChange = typeof selectedStatus?.affectionChange === 'number'
            ? selectedStatus.affectionChange
            : (typeof panel.affectionChange === 'number' ? panel.affectionChange : 0);
        const affectionEl = panelEl.querySelector('.chat-profile-status-affection span');
        const affectionChangeEl = panelEl.querySelector('.chat-profile-status-affection-change');
        if (affectionEl) affectionEl.textContent = String(affection);
        if (affectionChangeEl) {
            affectionChangeEl.textContent = affectionChange >= 0 ? `+${affectionChange}` : String(affectionChange);
            affectionChangeEl.style.display = affectionChange === 0 ? 'none' : '';
        }

        panelEl.querySelectorAll('[data-action="page-status"]').forEach((button) => {
            const isNewer = button.getAttribute('data-direction') === 'newer';
            button.disabled = isNewer
                ? statusSelection.index <= 0
                : statusSelection.index >= statusSelection.history.length - 1;
        });
    }

    function renderProfilePanel(friend, panelEl) {
        if (!friend || !panelEl) return;

        const panel = window.imChat.getProfilePanelData(friend);
        const uiState = window.imChat.getProfilePanelUiState(friend);
        const activeTab = ['thought', 'events'].includes(uiState.activeTab)
            ? uiState.activeTab
            : (['thought', 'events'].includes(panel.activeTab) ? panel.activeTab : 'thought');

        uiState.activeTab = activeTab;
        panel.activeTab = activeTab;

        const avatarUrl = friend.avatarUrl || 'https://picsum.photos/seed/char/100/100';
        
        let isSleeping = false;
        if (typeof window.imApp.isCharacterSleeping === 'function') {
            isSleeping = window.imApp.isCharacterSleeping(friend);
        } else if (friend.memory && friend.memory.schedule && friend.memory.schedule.enabled) {
            const now = new Date();
            const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
            
            const parseTime = (timeStr) => {
                if (!timeStr) return 0;
                const [h, m] = timeStr.split(':').map(Number);
                return (h || 0) * 60 + (m || 0);
            };
            
            const sleepMin = parseTime(friend.memory.schedule.sleepTime || '23:00');
            const wakeMin = parseTime(friend.memory.schedule.wakeTime || '07:00');
            
            if (sleepMin > wakeMin) {
                isSleeping = currentTotalMinutes >= sleepMin || currentTotalMinutes < wakeMin;
            } else {
                isSleeping = currentTotalMinutes >= sleepMin && currentTotalMinutes < wakeMin;
            }
        }

        const name = friend.nickname || friend.realName || 'Unknown';
        const signature = friend.signature || '这个人很懒，什么都没写';
        const onlineLabel = formatProfileStatusLabel(panel.status || friend.status || 'online', isSleeping);
        
        const statusSelection = getSelectedProfileStatus(friend, panel);
        const selectedStatus = statusSelection.snapshot;
        const canPageNewer = statusSelection.index > 0;
        const canPageOlder = statusSelection.index < statusSelection.history.length - 1;
        const affection = typeof selectedStatus?.affection === 'number'
            ? selectedStatus.affection
            : (typeof panel.affection === 'number' ? panel.affection : 0);
        const affectionChange = typeof selectedStatus?.affectionChange === 'number'
            ? selectedStatus.affectionChange
            : (typeof panel.affectionChange === 'number' ? panel.affectionChange : 0);
        const affectionChangeStr = affectionChange >= 0 ? `+${affectionChange}` : `${affectionChange}`;

        panelEl.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 320px; margin: 0 auto;">
                <div class="chat-profile-panel-card" style="width: 100%;">
                    <div class="gmp-header chat-profile-panel-header" style="position: relative;">
                        <div class="gmp-avatar-wrapper">
                            <div class="gmp-avatar"><img src="${avatarUrl}"></div>
                            <div class="gmp-status-bubble chat-profile-panel-header-status">${onlineLabel}</div>
                        </div>
                        <button type="button" class="chat-profile-panel-close" aria-label="关闭">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="gmp-body chat-profile-panel-body">
                        <div class="gmp-name-row" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <div class="gmp-name">${name}</div>
                            <div style="display: flex; flex-direction: column; align-items: flex-end;">
                                <div class="chat-profile-status-affection" style="background: #f2f2f7; color: #8e8e93; padding: 4px 10px; border-radius: 999px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 4px;">
                                    <i class="fas fa-heart"></i> <span>${affection}</span>
                                </div>
                                <div class="chat-profile-status-affection-change" style="font-size: 10px; color: #8e8e93; margin-top: 4px; font-weight: 600; ${affectionChange === 0 ? 'display:none;' : ''}">${affectionChangeStr}</div>
                            </div>
                        </div>
                        <div class="gmp-signature">${signature}</div>
                        <div class="chat-profile-panel-content">
                            ${window.imChat.buildProfilePanelBody(friend, activeTab, {
                                panel,
                                events: panel.events,
                                statusSelection
                            })}
                        </div>
                    </div>
                    <div class="chat-profile-event-detail-overlay" style="display:none;">
                        <div class="chat-profile-event-detail-card">
                            <button type="button" class="chat-profile-event-detail-close" aria-label="关闭">
                                <i class="fas fa-times"></i>
                            </button>
                            <div class="chat-profile-event-detail-label">记忆详情</div>
                            <div class="chat-profile-event-detail-title">事件详情</div>
                            <div class="chat-profile-event-detail-time"></div>
                            <div class="chat-profile-event-detail-desc"></div>
                            <div class="chat-profile-event-detail-detail"></div>
                        </div>
                    </div>
                    <div class="chat-profile-status-edit-overlay" style="display:none;">
                        <form class="chat-profile-status-edit-card">
                            <div class="chat-profile-status-edit-title">编辑状态</div>
                            <label>状态内容<textarea name="thought" rows="6" required></textarea></label>
                            <div class="chat-profile-status-edit-readonly"></div>
                            <div class="chat-profile-status-edit-actions">
                                <button type="button" data-action="cancel-status-edit">取消</button>
                                <button type="submit" class="is-primary">保存</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <div class="chat-profile-panel-floating-tabs" style="display: flex; flex-direction: row; gap: 8px; margin-top: 18px; z-index: 100;">
                    <button type="button" class="chat-profile-panel-action-btn is-page" data-action="page-status" data-direction="newer" aria-label="上一条状态" ${canPageNewer ? '' : 'disabled'}><i class="fas fa-chevron-left"></i></button>
                    <button type="button" class="chat-profile-panel-tab-btn ${activeTab === 'thought' ? 'active' : ''}" data-tab="thought" style="width: 42px; height: 42px; border-radius: 50%; border: none; background: ${activeTab === 'thought' ? '#111' : '#fff'}; color: ${activeTab === 'thought' ? '#fff' : '#111'};  display: flex; justify-content: center; align-items: center; font-size: 17px; cursor: pointer; transition: transform 0.2s, background 0.2s;">
                        <i class="fas fa-heart"></i>
                    </button>
                    <button type="button" class="chat-profile-panel-tab-btn ${activeTab === 'events' ? 'active' : ''}" data-tab="events" style="width: 42px; height: 42px; border-radius: 50%; border: none; background: ${activeTab === 'events' ? '#111' : '#fff'}; color: ${activeTab === 'events' ? '#fff' : '#111'};  display: flex; justify-content: center; align-items: center; font-size: 17px; cursor: pointer; transition: transform 0.2s, background 0.2s;">
                        <i class="fas fa-flag"></i>
                    </button>
                    <button type="button" class="chat-profile-panel-action-btn" data-action="edit-status" aria-label="编辑状态"><i class="fas fa-pen"></i></button>
                    <button type="button" class="chat-profile-panel-action-btn is-danger" data-action="delete-status" aria-label="删除状态"><i class="fas fa-trash-alt"></i></button>
                    <button type="button" class="chat-profile-panel-action-btn is-page" data-action="page-status" data-direction="older" aria-label="下一条状态" ${canPageOlder ? '' : 'disabled'}><i class="fas fa-chevron-right"></i></button>
                </div>
            </div>
        `;

        const closeBtn = panelEl.querySelector('.chat-profile-panel-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.imChat.hideProfilePanel(friend, panelEl);
            });
        }

        const detailOverlay = panelEl.querySelector('.chat-profile-event-detail-overlay');
        const detailCloseBtn = panelEl.querySelector('.chat-profile-event-detail-close');
        if (detailOverlay) {
            detailOverlay.addEventListener('click', (e) => {
                if (e.target === detailOverlay) {
                    window.imChat.hideProfileEventDetail(panelEl);
                }
            });
        }
        if (detailCloseBtn) {
            detailCloseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.imChat.hideProfileEventDetail(panelEl);
            });
        }

        panelEl.querySelectorAll('[data-action="page-status"]').forEach((button) => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (button.disabled) return;
                const latestFriend = window.imApp.getFriendById(friend) || friend;
                const panel = window.imChat.getProfilePanelData(latestFriend);
                const { history, index } = getSelectedProfileStatus(latestFriend, panel);
                const direction = button.getAttribute('data-direction') === 'newer' ? -1 : 1;
                const nextIndex = index + direction;
                if (nextIndex < 0 || nextIndex >= history.length) return;

                const uiState = window.imChat.getProfilePanelUiState(latestFriend);
                uiState.selectedHistoryIndex = nextIndex;
                uiState.activeTab = 'thought';
                renderProfileStatusSelection(latestFriend, panelEl, panel);
            });
        });

        const editOverlay = panelEl.querySelector('.chat-profile-status-edit-overlay');
        const editForm = panelEl.querySelector('.chat-profile-status-edit-card');
        const closeStatusEditor = () => {
            if (!editOverlay) return;
            editOverlay.classList.remove('active');
            setTimeout(() => {
                if (!editOverlay.classList.contains('active')) editOverlay.style.display = 'none';
            }, 180);
        };
        panelEl.querySelector('[data-action="cancel-status-edit"]')?.addEventListener('click', closeStatusEditor);
        editOverlay?.addEventListener('click', (e) => {
            if (e.target === editOverlay) closeStatusEditor();
        });

        panelEl.querySelector('[data-action="edit-status"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const latestFriend = window.imApp.getFriendById(friend) || friend;
            const { snapshot } = getSelectedProfileStatus(latestFriend);
            if (!snapshot || !editOverlay || !editForm) {
                if (window.showToast) window.showToast('暂无可编辑的状态');
                return;
            }
            editForm.dataset.statusId = snapshot.id;
            const thoughtInput = editForm.elements.namedItem('thought');
            if (thoughtInput) thoughtInput.value = snapshot.thought || '';
            const readonly = editForm.querySelector('.chat-profile-status-edit-readonly');
            if (readonly) {
                const affectionText = typeof snapshot.affection === 'number' ? snapshot.affection : '未记录';
                const changeText = typeof snapshot.affectionChange === 'number'
                    ? (snapshot.affectionChange >= 0 ? `+${snapshot.affectionChange}` : snapshot.affectionChange)
                    : '未记录';
                readonly.textContent = `好感度 ${affectionText} · 本次变化 ${changeText}`;
            }
            editOverlay.style.display = 'flex';
            requestAnimationFrame(() => editOverlay.classList.add('active'));
        });

        editForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const thought = String(editForm.elements.namedItem('thought')?.value || '').trim();
            if (!thought) {
                if (window.showToast) window.showToast('状态内容不能为空');
                return;
            }
            const saved = await editProfileStatusSnapshot(friend, editForm.dataset.statusId, { thought });
            if (!saved) {
                if (window.showToast) window.showToast('状态更新失败');
                return;
            }
            closeStatusEditor();
            const latestFriend = window.imApp.getFriendById(friend) || friend;
            window.imChat.renderProfilePanel(latestFriend, panelEl);
            if (window.showToast) window.showToast('状态已更新');
        });

        panelEl.querySelector('[data-action="delete-status"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const latestFriend = window.imApp.getFriendById(friend) || friend;
            const { history, index, snapshot } = getSelectedProfileStatus(latestFriend);
            if (!snapshot) {
                if (window.showToast) window.showToast('暂无可删除的状态');
                return;
            }
            const confirmDelete = async () => {
                const saved = await deleteProfileStatusSnapshot(latestFriend, snapshot.id);
                if (!saved) {
                    if (window.showToast) window.showToast('状态删除失败');
                    return;
                }
                const uiState = window.imChat.getProfilePanelUiState(latestFriend);
                uiState.selectedHistoryIndex = Math.max(0, Math.min(index, history.length - 2));
                const refreshedFriend = window.imApp.getFriendById(latestFriend) || latestFriend;
                window.imChat.renderProfilePanel(refreshedFriend, panelEl);
                if (window.showToast) window.showToast('状态已删除');
            };
            if (window.showCustomModal) {
                window.showCustomModal({
                    title: '删除状态',
                    message: index === 0 ? '删除最新状态后，上一条状态会自动接替为当前状态。' : '确定删除当前查看的这条历史状态吗？',
                    confirmText: '删除',
                    cancelText: '取消',
                    isDestructive: true,
                    onConfirm: confirmDelete
                });
            } else {
                confirmDelete();
            }
        });

        const eventActionButtons = panelEl.querySelectorAll('[data-action="confirm-memory-request"], [data-action="cancel-memory-request"], [data-action="open-event-detail"]');
        eventActionButtons.forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = btn.getAttribute('data-action') || '';
                const eventId = btn.getAttribute('data-event-id') || '';
                const latestFriend = window.imApp.getFriendById(friend) || friend;

                if (action === 'open-event-detail') {
                    window.imChat.showProfileEventDetail(latestFriend, eventId, panelEl);
                    return;
                }

                let saved = false;
                if (action === 'confirm-memory-request') {
                    saved = await window.imChat.confirmMemoryRequestEvent(latestFriend, eventId);
                    if (saved && window.showToast) window.showToast('已写入长期记忆');
                } else if (action === 'cancel-memory-request') {
                    saved = await window.imChat.cancelMemoryRequestEvent(latestFriend, eventId);
                }

                if (!saved) {
                    if (window.showToast) window.showToast(action === 'confirm-memory-request' ? '保存珍视回忆失败' : '事件状态更新失败');
                    return;
                }

                const refreshedFriend = window.imApp.getFriendById(friend) || latestFriend;
                window.imChat.renderProfilePanel(refreshedFriend, panelEl);

                if (
                    window.imData.currentSettingsFriend &&
                    String(window.imData.currentSettingsFriend.id) === String(refreshedFriend.id) &&
                    typeof window.imApp.initChatSettingsForFriend === 'function'
                ) {
                    window.imApp.initChatSettingsForFriend(refreshedFriend);
                }
            });
        });

        const eventItems = panelEl.querySelectorAll('.chat-profile-event-item');
        eventItems.forEach((item) => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const eventId = item.getAttribute('data-event-id');
                const latestFriend = window.imApp.getFriendById(friend) || friend;
                window.imChat.showProfileEventDetail(latestFriend, eventId, panelEl);
            });
        });

        const tabButtons = panelEl.querySelectorAll('.chat-profile-panel-tab-btn');
        tabButtons.forEach((btn) => {
            const stopProfileTabEvent = (e) => {
                e.stopPropagation();
                if (typeof e.stopImmediatePropagation === 'function') {
                    e.stopImmediatePropagation();
                }
            };

            const handleProfileTabClick = (e) => {
                e.preventDefault();
                stopProfileTabEvent(e);
            };

            btn.addEventListener('pointerdown', stopProfileTabEvent, true);
            btn.addEventListener('touchstart', stopProfileTabEvent, { capture: true, passive: false });

            btn.addEventListener('click', async (e) => {
                handleProfileTabClick(e);
                const nextTab = btn.getAttribute('data-tab') || 'thought';
                window.imChat.setProfilePanelTab(friend, nextTab);

                await commitStatusFriendChange(friend, (targetFriend) => {
                    if (!targetFriend) return;
                    const nextPanel = ensureProfilePanelData(targetFriend);
                    nextPanel.activeTab = nextTab;
                }, { silent: true });

                const latestFriend = window.imApp.getFriendById(friend) || friend;
                window.imChat.renderProfilePanel(latestFriend, panelEl);
            });
        });
    }

    function showProfilePanel(friend, panelEl) {
        if (!friend || !panelEl) return;
        const hadLegacyFields = window.imApp.migrateSingleChatProfileStatus
            ? window.imApp.migrateSingleChatProfileStatus(friend)
            : false;
        if ((hadLegacyFields || friend._profileStatusNeedsPersistence) && window.imApp.commitScopedFriendChange) {
            void window.imApp.commitScopedFriendChange(friend, (targetFriend) => {
                window.imApp.migrateSingleChatProfileStatus(targetFriend);
                delete targetFriend._profileStatusNeedsPersistence;
            }, { syncActive: true, metaOnly: true, silent: true });
        }
        const uiState = window.imChat.getProfilePanelUiState(friend);
        uiState.open = true;
        uiState.selectedHistoryIndex = 0;
        window.imChat.renderProfilePanel(friend, panelEl);
        panelEl.style.display = 'flex';
        requestAnimationFrame(() => {
            panelEl.classList.add('active');
        });
    }

    function hideProfilePanel(friendOrId, panelEl) {
        const uiState = window.imChat.getProfilePanelUiState(friendOrId);
        uiState.open = false;
        if (!panelEl) return;
        panelEl.classList.remove('active');
        setTimeout(() => {
            if (!panelEl.classList.contains('active')) {
                panelEl.style.display = 'none';
            }
        }, 220);
    }

    function toggleProfilePanel(friend, panelEl) {
        if (!friend || !panelEl) return;
        const uiState = window.imChat.getProfilePanelUiState(friend);
        if (uiState.open && panelEl.classList.contains('active')) {
            window.imChat.hideProfilePanel(friend, panelEl);
        } else {
            window.imChat.showProfilePanel(friend, panelEl);
        }
    }

    function applyFriendStatusBarCss() {
        return;
    }

    window.imChat.getProfilePanelData = getProfilePanelData;
    window.imChat.getProfilePanelUiState = getProfilePanelUiState;
    window.imChat.setProfilePanelTab = setProfilePanelTab;
    window.imChat.getProfilePanelEvents = getProfilePanelEvents;
    window.imChat.getProfileStatusHistory = getProfileStatusHistory;
    window.imChat.getSelectedProfileStatus = getSelectedProfileStatus;
    window.imChat.editProfileStatusSnapshot = editProfileStatusSnapshot;
    window.imChat.deleteProfileStatusSnapshot = deleteProfileStatusSnapshot;
    window.imChat.getProfilePanelMetrics = getProfilePanelMetrics;
    window.imChat.buildCherishedMemoryEntryFromEvent = buildCherishedMemoryEntryFromEvent;
    window.imChat.mergeCherishedMemoryText = mergeCherishedMemoryText;
    window.imChat.confirmMemoryRequestEvent = confirmMemoryRequestEvent;
    window.imChat.cancelMemoryRequestEvent = cancelMemoryRequestEvent;
    window.imChat.showProfileEventDetail = showProfileEventDetail;
    window.imChat.hideProfileEventDetail = hideProfileEventDetail;
    window.imChat.buildProfilePanelBody = buildProfilePanelBody;
    window.imChat.renderProfilePanel = renderProfilePanel;
    window.imChat.showProfilePanel = showProfilePanel;
    window.imChat.hideProfilePanel = hideProfilePanel;
    window.imChat.toggleProfilePanel = toggleProfilePanel;
    window.imChat.applyFriendStatusBarCss = applyFriendStatusBarCss;
    window.imApp.applyFriendStatusBarCss = applyFriendStatusBarCss;
});
