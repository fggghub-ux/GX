// ==========================================
// IMESSAGE: 3. GROUPS
// ==========================================

(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    const { openView, closeView, showToast } = window;

    const createGroupSheet = document.getElementById('create-group-sheet');
    const groupDetailsSheet = document.getElementById('group-details-sheet');
    const groupEditSheet = document.getElementById('group-edit-sheet');
    const groupDetailsEditBtn = document.getElementById('group-details-edit-btn');
    const groupDetailsSettingsBtn = document.getElementById('group-details-settings-btn');
    const groupContextSettingsSheet = document.getElementById('group-context-settings-sheet');
    const groupDetailsMoreBtn = document.getElementById('group-details-more-btn');
    const groupMoreSheet = document.getElementById('group-more-sheet');
    const groupMemberManageSheet = document.getElementById('group-member-manage-sheet');
    const groupCallBtn = document.getElementById('group-call-btn');
    const groupPollBtn = document.getElementById('group-poll-btn');
    const groupPollCreateSheet = document.getElementById('group-poll-create-sheet');
    const groupPollCreateClose = document.getElementById('group-poll-create-close');
    const groupPollQuestionInput = document.getElementById('group-poll-question-input');
    const groupPollOptionsList = document.getElementById('group-poll-options-list');
    const groupPollOptionCount = document.getElementById('group-poll-option-count');
    const groupPollAddOptionBtn = document.getElementById('group-poll-add-option-btn');
    const groupPollSubmitBtn = document.getElementById('group-poll-submit-btn');
    const groupCallInviteSheet = document.getElementById('group-call-invite-sheet');
    const groupCallMembersList = document.getElementById('group-call-members-list');
    const groupCallStartBtn = document.getElementById('group-call-start-btn');
    const groupContextEnabledToggle = document.getElementById('group-context-enabled-toggle');
    const groupContextLimitInput = document.getElementById('group-context-limit-input');
    const groupTimeAwareToggle = document.getElementById('group-time-aware-toggle');
    const groupAutoExpandTranslationToggle = document.getElementById('group-auto-expand-translation-toggle');
    const groupShowUserAvatarToggle = document.getElementById('group-show-user-avatar-toggle');
    const groupMemberPrivateChatsToggle = document.getElementById('group-member-private-chats-toggle');
    const groupMemberFriendPrivateChatsToggle = document.getElementById('group-member-friend-private-chats-toggle');
    const groupManualSummaryBtn = document.getElementById('group-manual-summary-btn');
    const groupMemoryShortTermBtn = document.getElementById('group-memory-shortterm-btn');
    const groupMemoryLongTermBtn = document.getElementById('group-memory-longterm-btn');
    const groupMemoryShortTermCount = document.getElementById('group-memory-shortterm-count');
    const groupMemoryLongTermCount = document.getElementById('group-memory-longterm-count');
    const groupSummaryMoreStats = document.getElementById('group-summary-more-stats');
    const groupSummaryMoreList = document.getElementById('group-summary-more-list');
    const confirmGroupContextBtn = document.getElementById('confirm-group-context-btn');
    const confirmGroupEditBtn = document.getElementById('confirm-group-edit-btn');
    const groupEditNameInput = document.getElementById('group-edit-name-input');
    const groupBgUploadIcon = document.getElementById('group-bg-upload-icon');
    const groupBgResetIcon = document.getElementById('group-bg-reset-icon');
    const groupBgUpload = document.getElementById('group-bg-upload');
    const groupAddMemberBtn = document.getElementById('group-add-member-btn');
    const groupAddMemberSheet = document.getElementById('group-add-member-sheet');
    const groupAddMemberList = document.getElementById('group-add-member-list');
    const groupPrivateChatDetailModal = document.getElementById('group-private-chat-detail-modal');
    const groupPrivateChatDetailTitle = document.getElementById('group-private-chat-detail-title');
    const groupPrivateChatDetailSubtitle = document.getElementById('group-private-chat-detail-subtitle');
    const groupPrivateChatDetailMessages = document.getElementById('group-private-chat-detail-messages');
    const groupPrivateChatDetailClose = document.getElementById('group-private-chat-detail-close');

    let tempGroupMembers = [];
    let currentViewingGroup = null;

    function escapeGroupHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatPrivateChatDetailTime(timestamp) {
        const time = Number(timestamp) || 0;
        if (!time) return '';
        const date = new Date(time);
        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    function getPrivateChatMessageTranslation(message) {
        if (!message || typeof message !== 'object') return '';
        return typeof message.translation === 'string' && message.translation.trim()
            ? message.translation.trim()
            : (typeof message.translationZh === 'string' && message.translationZh.trim()
                ? message.translationZh.trim()
                : (typeof message.trans === 'string' && message.trans.trim() ? message.trans.trim() : ''));
    }

    function buildPrivateChatDetailBubbleHtml(message) {
        const text = escapeGroupHtml(message?.text || '');
        const translation = getPrivateChatMessageTranslation(message);
        if (!translation) {
            return `<div class="group-private-chat-detail-bubble"><span class="group-private-chat-detail-original">${text}</span></div>`;
        }
        return `
            <button type="button" class="group-private-chat-detail-bubble has-translation" aria-expanded="false" title="点击展开翻译">
                <span class="group-private-chat-detail-original">${text}</span>
                <span class="group-private-chat-detail-translation" hidden>${escapeGroupHtml(translation)}</span>
            </button>
        `;
    }

    function togglePrivateChatDetailTranslation(button) {
        if (!button) return;
        const translation = button.querySelector('.group-private-chat-detail-translation');
        if (!translation) return;
        const willExpand = translation.hidden;
        translation.hidden = !willExpand;
        button.classList.toggle('is-expanded', willExpand);
        button.setAttribute('aria-expanded', willExpand ? 'true' : 'false');
        button.title = willExpand ? '点击收起翻译' : '点击展开翻译';
    }

    function closeGroupPrivateChatDetail() {
        if (groupPrivateChatDetailModal) closeView(groupPrivateChatDetailModal);
    }

    window.imApp.openGroupPrivateChatDetail = function(snapshot) {
        if (!groupPrivateChatDetailModal || !groupPrivateChatDetailMessages || !snapshot) return false;
        const senderName = snapshot.senderName || '群成员';
        const recipientName = snapshot.recipientName || '好友';
        const messages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
        if (messages.length === 0) return false;

        if (groupPrivateChatDetailTitle) {
            groupPrivateChatDetailTitle.textContent = `${senderName} 与 ${recipientName}`;
        }
        if (groupPrivateChatDetailSubtitle) {
            groupPrivateChatDetailSubtitle.textContent = `本次私信记录 · ${messages.length} 条`;
        }

        groupPrivateChatDetailMessages.innerHTML = messages.map((message, index) => {
            const isSender = message?.role === 'char';
            const displayName = isSender ? senderName : recipientName;
            const previousRole = index > 0 ? messages[index - 1]?.role : null;
            const isGroupStart = index === 0 || previousRole !== message?.role;
            return `
                <div class="group-private-chat-detail-row${isSender ? ' is-sender' : ''}${isGroupStart ? ' is-group-start' : ''}">
                    ${isGroupStart ? `<div class="group-private-chat-detail-name">${escapeGroupHtml(displayName)}</div>` : ''}
                    ${buildPrivateChatDetailBubbleHtml(message)}
                </div>
            `;
        }).join('');

        groupPrivateChatDetailMessages.querySelectorAll('.group-private-chat-detail-bubble.has-translation').forEach((bubble) => {
            bubble.addEventListener('click', () => togglePrivateChatDetailTranslation(bubble));
        });

        openView(groupPrivateChatDetailModal);
        requestAnimationFrame(() => {
            groupPrivateChatDetailMessages.scrollTop = 0;
        });
        return true;
    };

    function isSelectableGroupMember(friend) {
        return !!friend && (friend.type === 'char' || friend.type === 'npc');
    }

    function getAvailableGroupAccounts() {
        return typeof window.getAccounts === 'function' ? window.getAccounts() : [];
    }

    async function commitCurrentGroupChange(mutator, options = {}) {
        if (!currentViewingGroup) return false;

        return window.imApp.commitScopedFriendChange(currentViewingGroup, (targetGroup) => {
            if (!targetGroup) return;
            currentViewingGroup = targetGroup;
            return mutator(targetGroup);
        }, {
            syncActive: true,
            metaOnly: options.metaOnly !== false,
            ...options
        });
    }

    async function commitContactsFriendChange(friendOrId, mutator, options = {}) {
        return window.imApp.commitScopedFriendChange(friendOrId, mutator, {
            syncActive: false,
            metaOnly: options.metaOnly !== false,
            ...options
        });
    }

    function resolveLatestGroup(groupOrId = currentViewingGroup) {
        const groupId = groupOrId && typeof groupOrId === 'object' ? groupOrId.id : groupOrId;
        const group = (window.imData?.friends || []).find(item => String(item.id) === String(groupId))
            || (groupOrId && typeof groupOrId === 'object' ? groupOrId : null);
        if (!group || group.type !== 'group') return null;
        group.memory = window.imApp.normalizeFriendData(group).memory;
        currentViewingGroup = group;
        return group;
    }

    function getResolvedGroupMembers(group) {
        if (!group || group.type !== 'group') return [];
        if (typeof window.imChat?.getGroupMemberFriends === 'function') {
            return window.imChat.getGroupMemberFriends(group);
        }

        const seenIds = new Set();
        return (Array.isArray(group.members) ? group.members : [])
            .map(memberRef => {
                const normalizedRef = String(memberRef == null ? '' : memberRef).trim();
                if (!normalizedRef) return null;
                return (window.imData?.friends || []).find(friend => isSelectableGroupMember(friend)
                    && (String(friend.id) === normalizedRef
                        || String(friend.nickname || '').trim() === normalizedRef
                        || String(friend.realName || '').trim() === normalizedRef)) || null;
            })
            .filter(member => {
                if (!member) return false;
                const memberId = String(member.id);
                if (seenIds.has(memberId)) return false;
                seenIds.add(memberId);
                return true;
            });
    }

    function getCanonicalGroupMemberIds(group) {
        return getResolvedGroupMembers(group).map(member => String(member.id));
    }

    function getGroupMemberCount(group) {
        const userIsInGroup = !(group && Number(group.leftGroupAt) > 0);
        return getResolvedGroupMembers(group).length + (userIsInGroup ? 1 : 0);
    }

    function formatGroupMemberCount(count) {
        const safeCount = Math.max(0, Number(count) || 0);
        return `${safeCount} member${safeCount === 1 ? '' : 's'}`;
    }

    function syncGroupHeaderMemberCount(group) {
        if (!group?.id) return;
        const page = document.getElementById(`chat-interface-${group.id}`);
        const signEl = page ? page.querySelector('.ins-chat-sign') : null;
        if (signEl) signEl.textContent = formatGroupMemberCount(getGroupMemberCount(group));
    }

    function refreshGroupMembershipUi(group) {
        const refreshedGroup = resolveLatestGroup(group) || group;
        if (!refreshedGroup) return null;
        syncGroupHeaderMemberCount(refreshedGroup);
        if (window.imApp.openGroupDetails) window.imApp.openGroupDetails(refreshedGroup);
        if (window.imApp.renderGroupsList) window.imApp.renderGroupsList({ force: true });
        if (window.imChat?.renderChatsList) window.imChat.renderChatsList();
        return refreshedGroup;
    }

    window.imApp.calculateChatMemoryTokenEstimate = window.imApp.calculateChatMemoryTokenEstimate || function(friend) {
        const normalizedFriend = window.imApp.normalizeFriendData(friend || {});
        const memory = normalizedFriend.memory || window.imApp.createDefaultMemory();
        let systemContextLen = 0;

        if (window.getGlobalWorldBookContext) {
            systemContextLen += (window.getGlobalWorldBookContext() || '').length;
        }

        systemContextLen += (normalizedFriend.nickname || '').length;
        systemContextLen += (normalizedFriend.persona || '').length;
        systemContextLen += (window.userState?.persona || '').length;
        systemContextLen += (memory.overview || '').length;
        systemContextLen += (memory.longTerm || '').length;
        systemContextLen += (memory.cherished || '').length;
        systemContextLen += (memory.context?.notes || '').length;

        if (Array.isArray(memory.shortTermEntries)) {
            systemContextLen += memory.shortTermEntries.reduce((sum, entry) => (
                sum
                + String(entry?.title || '').length
                + String(entry?.event || '').length
                + String(entry?.memoryPoints || '').length
            ), 0);
        }

        if (Array.isArray(memory.relationships)) {
            systemContextLen += memory.relationships.reduce((sum, rel) => sum + String(rel?.relation || '').length, 0);
        }

        if (normalizedFriend.type === 'group') {
            const members = Array.isArray(normalizedFriend.members) ? normalizedFriend.members : [];
            const mountSettings = memory.mountSettings || {};
            const mountLimits = memory.mountLimits || {};
            members.forEach(memberId => {
                const member = (window.imData?.friends || []).find(item => String(item.id) === String(memberId));
                if (!member) return;
                systemContextLen += String(member.nickname || '').length;
                systemContextLen += String(member.persona || '').length;
                systemContextLen += String(member.memory?.overview || '').length;
                if (mountSettings[String(memberId)] === false) return;
                const limit = Math.max(1, Number(mountLimits[String(memberId)]) || 20);
                const mountedMessages = Array.isArray(member.messages) ? member.messages.slice(-limit) : [];
                systemContextLen += mountedMessages.reduce((sum, message) => (
                    sum + String(message?.content || message?.text || message?.transcript || message?.description || '').length
                ), 0);
            });
        } else if (window.imApp.getEligibleGroupChatMemoryContexts) {
            window.imApp.getEligibleGroupChatMemoryContexts(normalizedFriend).forEach(({ group, roundLimit }) => {
                const roundData = window.imDataUtils?.getRecentUserRounds
                    ? window.imDataUtils.getRecentUserRounds(group.messages, roundLimit)
                    : { selectedMessages: [] };
                systemContextLen += String(group.nickname || group.realName || '').length + 280;
                systemContextLen += roundData.selectedMessages.reduce((sum, message) => (
                    sum + String(message?.content || message?.text || message?.transcript || message?.description || '').length
                ), 0);
            });
        }

        systemContextLen += normalizedFriend.type === 'group' ? 1600 : 800;

        let recentMessagesLen = 0;
        if (window.imApp.buildApiContextMessages) {
            const contextMsgs = window.imApp.buildApiContextMessages(normalizedFriend);
            if (Array.isArray(contextMsgs)) {
                recentMessagesLen = contextMsgs.reduce((sum, msg) => sum + String(msg?.content || '').length, 0);
            }
        }

        return systemContextLen + recentMessagesLen;
    };

    function renderGroupSummaryMorePanel(group = currentViewingGroup) {
        const latestGroup = resolveLatestGroup(group);
        if (!latestGroup) return;

        const messages = Array.isArray(latestGroup.messages) ? latestGroup.messages : [];
        const summaries = Array.isArray(latestGroup.memory?.shortTermEntries) ? latestGroup.memory.shortTermEntries : [];
        const tokenEstimate = window.imApp.calculateChatMemoryTokenEstimate
            ? window.imApp.calculateChatMemoryTokenEstimate(latestGroup)
            : 0;

        if (groupSummaryMoreStats) {
            groupSummaryMoreStats.innerHTML = `
                <div class="group-summary-stat-card">
                    <span>群聊总条数</span>
                    <strong>${messages.length}</strong>
                </div>
                <div class="group-summary-stat-card">
                    <span>单次 API Token 估算</span>
                    <strong>${Math.max(0, Math.round(tokenEstimate)).toLocaleString()}</strong>
                </div>
            `;
        }

        if (!groupSummaryMoreList) return;
        if (summaries.length === 0) {
            groupSummaryMoreList.innerHTML = '<div class="group-summary-empty">暂无群聊总结</div>';
            return;
        }

        groupSummaryMoreList.innerHTML = summaries.slice().reverse().map(entry => `
            <button type="button" class="group-summary-card" data-summary-id="${escapeGroupHtml(entry.id || '')}">
                <div class="group-summary-card-main">
                    <div class="group-summary-card-title">${escapeGroupHtml(entry.title || '群聊总结')}</div>
                    <div class="group-summary-card-time">${escapeGroupHtml(entry.time || '未记录时间')}</div>
                    <div class="group-summary-card-event">${escapeGroupHtml(entry.event || entry.memoryPoints || '点击编辑这条总结')}</div>
                </div>
                <span class="group-summary-card-delete" data-summary-delete="${escapeGroupHtml(entry.id || '')}" title="删除总结" aria-label="删除总结">
                    <i class="fas fa-trash-alt"></i>
                </span>
            </button>
        `).join('');

        groupSummaryMoreList.querySelectorAll('.group-summary-card').forEach(card => {
            card.addEventListener('click', event => {
                const deleteTarget = event.target.closest('[data-summary-delete]');
                if (deleteTarget) {
                    event.preventDefault();
                    event.stopPropagation();
                    deleteGroupSummary(deleteTarget.getAttribute('data-summary-delete') || '');
                    return;
                }
                openGroupSummaryDetail(card.getAttribute('data-summary-id') || '');
            });
        });
    }

    function hideGroupSummaryDetailModal() {
        const modal = document.getElementById('group-summary-detail-modal');
        if (modal && window.closeView) window.closeView(modal);
    }

    function ensureGroupSummaryDetailModal() {
        let modal = document.getElementById('group-summary-detail-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'group-summary-detail-modal';
        modal.className = 'bottom-sheet-overlay detail-sheet-overlay wb-centered-modal-overlay group-summary-detail-modal';
        modal.style.zIndex = '920';
        modal.innerHTML = `
            <div class="wb-centered-modal-card group-summary-detail-card">
                <div class="group-summary-detail-header">
                    <div>
                        <div class="group-summary-detail-title">编辑群聊总结</div>
                        <div class="group-summary-detail-subtitle" id="group-summary-detail-subtitle"></div>
                    </div>
                    <button type="button" class="group-summary-detail-close" aria-label="关闭">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="group-summary-detail-body">
                    <label class="group-summary-detail-field">
                        <span>标题</span>
                        <input type="text" id="group-summary-detail-title-input" maxlength="40">
                    </label>
                    <label class="group-summary-detail-field">
                        <span>事件</span>
                        <textarea id="group-summary-detail-event-input" rows="5"></textarea>
                    </label>
                    <label class="group-summary-detail-field">
                        <span>记忆点</span>
                        <textarea id="group-summary-detail-points-input" rows="4"></textarea>
                    </label>
                    <div class="group-summary-detail-actions">
                        <button type="button" class="group-summary-detail-delete" id="group-summary-detail-delete-btn">删除</button>
                        <button type="button" class="group-summary-detail-save" id="group-summary-detail-save-btn">保存</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', event => {
            if (event.target === modal) hideGroupSummaryDetailModal();
        });
        modal.querySelector('.group-summary-detail-close')?.addEventListener('click', hideGroupSummaryDetailModal);
        modal.querySelector('#group-summary-detail-save-btn')?.addEventListener('click', () => {
            saveGroupSummaryDetail(modal.dataset.summaryId || '');
        });
        modal.querySelector('#group-summary-detail-delete-btn')?.addEventListener('click', () => {
            deleteGroupSummary(modal.dataset.summaryId || '', { closeDetail: true });
        });

        return modal;
    }

    function openGroupSummaryDetail(entryId) {
        const group = resolveLatestGroup();
        if (!group || !entryId) return;
        const entries = Array.isArray(group.memory?.shortTermEntries) ? group.memory.shortTermEntries : [];
        const entry = entries.find(item => String(item.id) === String(entryId));
        if (!entry) return;

        const modal = ensureGroupSummaryDetailModal();
        modal.dataset.summaryId = String(entry.id);
        const titleInput = modal.querySelector('#group-summary-detail-title-input');
        const eventInput = modal.querySelector('#group-summary-detail-event-input');
        const pointsInput = modal.querySelector('#group-summary-detail-points-input');
        const subtitle = modal.querySelector('#group-summary-detail-subtitle');

        if (titleInput) titleInput.value = entry.title || '群聊总结';
        if (eventInput) eventInput.value = entry.event || '';
        if (pointsInput) pointsInput.value = entry.memoryPoints || '';
        if (subtitle) subtitle.textContent = entry.time ? `总结时间：${entry.time}` : '总结时间：未记录';

        if (window.openView) window.openView(modal);
    }

    async function saveGroupSummaryDetail(entryId) {
        if (!entryId) return;
        const modal = ensureGroupSummaryDetailModal();
        const title = String(modal.querySelector('#group-summary-detail-title-input')?.value || '').trim() || '群聊总结';
        const eventText = String(modal.querySelector('#group-summary-detail-event-input')?.value || '').trim();
        const memoryPoints = String(modal.querySelector('#group-summary-detail-points-input')?.value || '').trim();

        const saved = await commitCurrentGroupChange(targetGroup => {
            targetGroup.memory = window.imApp.normalizeFriendData(targetGroup).memory;
            const entries = Array.isArray(targetGroup.memory.shortTermEntries) ? targetGroup.memory.shortTermEntries : [];
            const entry = entries.find(item => String(item.id) === String(entryId));
            if (!entry) return;
            entry.title = title;
            entry.event = eventText;
            entry.memoryPoints = memoryPoints;
        }, { silent: true });

        if (!saved) {
            if (window.showToast) window.showToast('群聊总结保存失败');
            return;
        }

        renderGroupSummaryMorePanel(currentViewingGroup);
        if (window.imApp.renderMemoryView) window.imApp.renderMemoryView();
        hideGroupSummaryDetailModal();
        if (window.showToast) window.showToast('群聊总结已保存');
    }

    async function removeGroupSummaryEntry(entryId, options = {}) {
        const saved = await commitCurrentGroupChange(targetGroup => {
            targetGroup.memory = window.imApp.normalizeFriendData(targetGroup).memory;
            const entries = Array.isArray(targetGroup.memory.shortTermEntries) ? targetGroup.memory.shortTermEntries : [];
            targetGroup.memory.shortTermEntries = window.imDataUtils?.removeShortTermSummaryEntry
                ? window.imDataUtils.removeShortTermSummaryEntry(entries, entryId)
                : entries.filter(item => !item || String(item.id) !== String(entryId));
        }, { silent: true });

        if (!saved) {
            if (window.showToast) window.showToast('群聊总结删除失败');
            return;
        }

        renderGroupSummaryMorePanel(currentViewingGroup);
        if (window.imApp.renderMemoryView) window.imApp.renderMemoryView();
        if (options.closeDetail) hideGroupSummaryDetailModal();
        if (window.showToast) window.showToast('群聊总结已删除');
    }

    function deleteGroupSummary(entryId, options = {}) {
        if (!entryId) return;
        const doDelete = () => removeGroupSummaryEntry(entryId, options);
        if (window.showCustomModal) {
            window.showCustomModal({
                title: '删除群聊总结',
                message: '确定删除这条群聊总结吗？此操作不可恢复。',
                confirmText: '删除',
                isDestructive: true,
                onConfirm: doDelete
            });
            return;
        }
        if (window.confirm && !window.confirm('确定删除这条群聊总结吗？')) return;
        doDelete();
    }

    window.imApp.renderGroupSummaryMorePanel = renderGroupSummaryMorePanel;
    window.imApp.openGroupSummaryDetail = openGroupSummaryDetail;
    window.imApp.deleteGroupSummary = deleteGroupSummary;

    function getGroupUserDisplayMeta(group) {
        if (window.imApp?.getGroupUserIdentity) {
            const identity = window.imApp.getGroupUserIdentity(group);
            return {
                id: identity.accountId || '__user__',
                name: identity.name,
                avatarUrl: identity.avatarUrl,
                persona: identity.persona,
                signature: identity.signature
            };
        }
        const currentAccountId = typeof window.getCurrentAccountId === 'function' ? window.getCurrentAccountId() : null;
        const accounts = getAvailableGroupAccounts();
        const currentAccount = accounts.find(acc => String(acc.id) === String(currentAccountId)) || null;
        const override = group && group.memory ? (group.memory.userOverride || null) : null;

        const fallbackName = (window.userState && (window.userState.name || window.userState.realName))
            || currentAccount?.name
            || 'Me';
        const fallbackAvatar = (window.userState && (window.userState.avatarUrl || window.userState.avatar))
            || currentAccount?.avatarUrl
            || currentAccount?.avatar
            || `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=random`;

        return {
            id: override?.id || currentAccount?.id || '__user__',
            name: override?.name || fallbackName,
            avatarUrl: override?.avatarUrl || override?.avatar || fallbackAvatar,
            persona: override?.persona || currentAccount?.persona || (window.userState ? window.userState.persona : '') || '',
            signature: override?.signature || currentAccount?.signature || ''
        };
    }

    function setGroupAvatar(url) {
        const img = document.getElementById('group-avatar-img');
        const icon = document.getElementById('group-avatar-icon');
        if (!img || !icon) return;
        if (url) {
            img.src = url;
            img.style.display = 'block';
            icon.style.display = 'none';
        } else {
            img.src = '';
            img.style.display = 'none';
            icon.style.display = 'block';
        }
    }

    function updateCreateGroupConfirmBtn() {
        const confirmBtn = document.getElementById('confirm-create-group-btn');
        if (!confirmBtn) return;
        if (tempGroupMembers.length > 0) {
            confirmBtn.style.opacity = '1';
            confirmBtn.style.pointerEvents = 'auto';
        } else {
            confirmBtn.style.opacity = '0.5';
            confirmBtn.style.pointerEvents = 'none';
        }
    }

    function renderCreateGroupMembersList() {
        const list = document.getElementById('create-group-members-list');
        if (!list) return;
        list.innerHTML = '';

        const allFriends = window.imData.friends.filter(isSelectableGroupMember);

        allFriends.forEach(friend => {
            const item = document.createElement('div');
            item.className = 'line-list-item';

            const friendId = String(friend.id);
            const isSelected = tempGroupMembers.some(id => String(id) === friendId);

            const avatarHtml = friend.avatarUrl
                ? `<img src="${friend.avatarUrl}" style="width:100%;height:100%;object-fit:cover;">`
                : (friend.type === 'npc' ? `<i class="fas fa-robot"></i>` : `<i class="fas fa-user"></i>`);

            item.innerHTML = `
                <div style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid ${isSelected ? '#007aff' : '#c7c7cc'}; background: ${isSelected ? '#007aff' : 'transparent'}; display: flex; justify-content: center; align-items: center; color: #fff; font-size: 12px; margin-right: 5px;">
                    ${isSelected ? '<i class="fas fa-check"></i>' : ''}
                </div>
                <div class="line-item-avatar">${avatarHtml}</div>
                <div class="line-item-text" style="flex: 1;">${friend.nickname}</div>
            `;

            item.addEventListener('click', () => {
                if (isSelected) {
                    tempGroupMembers = tempGroupMembers.filter(id => String(id) !== friendId);
                } else {
                    tempGroupMembers.push(friendId);
                }
                renderCreateGroupMembersList();
                updateCreateGroupConfirmBtn();
            });

            list.appendChild(item);
        });
    }

    function openCreateGroupSheet() {
        tempGroupMembers = [];
        const nameInput = document.getElementById('group-name-input');
        if (nameInput) nameInput.value = '';
        const includeUserInput = document.getElementById('create-group-include-user');
        if (includeUserInput) includeUserInput.checked = true;
        setGroupAvatar(null);
        renderCreateGroupMembersList();
        updateCreateGroupConfirmBtn();
        openView(createGroupSheet);
    }

    let lastGroupsListSnapshot = [];

    function getGroupsListRenderSnapshot() {
        return (window.imData.friends || [])
            .filter(friend => friend.type === 'group')
            .map(group => ({ group, id: group.id, nickname: group.nickname, avatarUrl: group.avatarUrl || '' }));
    }

    function isSameGroupsListSnapshot(nextSnapshot) {
        return nextSnapshot.length === lastGroupsListSnapshot.length
            && nextSnapshot.every((row, index) => {
                const previous = lastGroupsListSnapshot[index];
                return previous
                    && previous.group === row.group
                    && previous.id === row.id
                    && previous.nickname === row.nickname
                    && previous.avatarUrl === row.avatarUrl;
            });
    }

    function renderGroupsList(options = {}) {
        const groupsContent = document.getElementById('groups-content');
        if (!groupsContent) return;
        const nextSnapshot = getGroupsListRenderSnapshot();
        const hasCurrentItems = groupsContent.children.length === nextSnapshot.length + 1;
        if (!options.force && hasCurrentItems && isSameGroupsListSnapshot(nextSnapshot)) return false;

        groupsContent.innerHTML = `
            <div class="line-list-item" id="create-group-trigger">
                <div class="line-item-icon bg-light"><i class="fas fa-users"></i></div>
                <div class="line-item-text">Create group</div>
            </div>
        `;

        const createGroupTrigger = document.getElementById('create-group-trigger');
        if (createGroupTrigger) {
            createGroupTrigger.addEventListener('click', () => {
                openCreateGroupSheet();
            });
        }

        const groups = window.imData.friends.filter(f => f.type === 'group');
        groups.forEach(group => {
            const item = document.createElement('div');
            item.className = 'line-list-item';

            const avatarHtml = group.avatarUrl
                ? `<img src="${group.avatarUrl}" style="width:100%;height:100%;object-fit:cover;">`
                : `<div style="width: 100%; height: 100%; background: linear-gradient(135deg, #ff9a9e, #fecfef); color: white; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 20px;">${group.nickname.charAt(0).toUpperCase()}</div>`;

            item.innerHTML = `
                <div class="line-item-avatar">${avatarHtml}</div>
                <div class="line-item-text">${group.nickname}</div>
            `;

            item.addEventListener('click', () => {
                if (window.imApp.openChatTab) window.imApp.openChatTab(group);
            });

            groupsContent.appendChild(item);
        });
        lastGroupsListSnapshot = nextSnapshot;
        return true;
    }

    function openGroupEditSheet() {
        if (!currentViewingGroup || !groupEditSheet) return;
        if (groupEditNameInput) {
            groupEditNameInput.value = currentViewingGroup.nickname || '';
        }
        openView(groupEditSheet);
    }

    function openGroupContextSettingsSheet() {
        if (!currentViewingGroup || !groupContextSettingsSheet) return;
        currentViewingGroup = resolveLatestGroup(currentViewingGroup) || currentViewingGroup;

        currentViewingGroup.memory = currentViewingGroup.memory || window.imApp.createDefaultMemory();
        currentViewingGroup.memory.context = currentViewingGroup.memory.context || {};

        const enabled = typeof currentViewingGroup.memory.context.enabled === 'boolean'
            ? currentViewingGroup.memory.context.enabled
            : true;
        const limit = Number(currentViewingGroup.memory.context.limit) > 0
            ? Number(currentViewingGroup.memory.context.limit)
            : 100;

        if (groupContextEnabledToggle) {
            groupContextEnabledToggle.checked = enabled;
        }

        if (groupContextLimitInput) {
            groupContextLimitInput.value = limit;
        }

        if (groupTimeAwareToggle) {
            groupTimeAwareToggle.checked = currentViewingGroup.timeAware !== false;
        }
        if (groupAutoExpandTranslationToggle) {
            groupAutoExpandTranslationToggle.checked = currentViewingGroup.autoExpandTranslation === true;
        }
        if (groupShowUserAvatarToggle) {
            groupShowUserAvatarToggle.checked = currentViewingGroup.showGroupUserAvatar === true;
        }
        if (groupMemberPrivateChatsToggle) {
            groupMemberPrivateChatsToggle.checked = currentViewingGroup.allowGroupMemberPrivateChats !== false;
        }
        if (groupMemberFriendPrivateChatsToggle) {
            groupMemberFriendPrivateChatsToggle.checked = currentViewingGroup.allowGroupMemberFriendPrivateChats !== false;
        }

        refreshGroupMemoryCounts(currentViewingGroup);

        openView(groupContextSettingsSheet);
    }

    function refreshGroupMemoryCounts(group) {
        const normalized = group ? window.imApp.normalizeFriendData(group) : null;
        const memory = normalized?.memory || {};
        const shortCount = Array.isArray(memory.shortTermEntries) ? memory.shortTermEntries.length : 0;
        const longCount = Array.isArray(memory.longTermEntries) ? memory.longTermEntries.length : 0;
        if (groupMemoryShortTermCount) groupMemoryShortTermCount.textContent = shortCount > 0 ? `${shortCount}项` : '';
        if (groupMemoryLongTermCount) groupMemoryLongTermCount.textContent = longCount > 0 ? `${longCount}项` : '';
    }

    function openGroupAddMemberSheet() {
        if (!currentViewingGroup || !groupAddMemberSheet || !groupAddMemberList) return;

        groupAddMemberList.innerHTML = '';

        const allFriendsAndNpcs = window.imData.friends.filter(isSelectableGroupMember);
        const currentMemberIds = new Set(getCanonicalGroupMemberIds(currentViewingGroup));

        allFriendsAndNpcs.forEach(friend => {
            const isAlreadyInGroup = currentMemberIds.has(String(friend.id));
            const item = document.createElement('div');
            item.className = 'line-list-item';
            if (isAlreadyInGroup) {
                item.style.opacity = '0.5';
                item.style.pointerEvents = 'none';
            }

            const avatarHtml = friend.avatarUrl
                ? `<img src="${friend.avatarUrl}" style="width:100%;height:100%;object-fit:cover;">`
                : (friend.type === 'npc' ? `<i class="fas fa-robot"></i>` : `<i class="fas fa-user"></i>`);

            item.innerHTML = `
                <div class="line-item-avatar">${avatarHtml}</div>
                <div class="line-item-text" style="flex: 1;">${friend.nickname}</div>
                ${isAlreadyInGroup ? '<div style="font-size: 13px; color: #8e8e93; margin-right: 15px;">已在群内</div>' : '<div style="width: 28px; height: 28px; border-radius: 50%; background: #007aff; color: #fff; display: flex; justify-content: center; align-items: center; cursor: pointer; margin-right: 15px;"><i class="fas fa-plus" style="font-size: 12px;"></i></div>'}
            `;

            if (!isAlreadyInGroup) {
                item.addEventListener('click', async () => {
                    const saved = await commitCurrentGroupChange((targetGroup) => {
                        const canonicalMemberIds = getCanonicalGroupMemberIds(targetGroup);
                        if (!canonicalMemberIds.includes(String(friend.id))) {
                            canonicalMemberIds.push(String(friend.id));
                        }
                        targetGroup.members = canonicalMemberIds;
                    }, { silent: true });

                    if (!saved) {
                        if (window.showToast) window.showToast(`邀请 ${friend.nickname} 失败`);
                        return;
                    }

                    item.style.opacity = '0.5';
                    item.style.pointerEvents = 'none';
                    item.innerHTML = `
                        <div class="line-item-avatar">${avatarHtml}</div>
                        <div class="line-item-text" style="flex: 1;">${friend.nickname}</div>
                        <div style="font-size: 13px; color: #8e8e93; margin-right: 15px;">已在群内</div>
                    `;

                    refreshGroupMembershipUi(currentViewingGroup);

                    if (window.showToast) window.showToast(`已邀请 ${friend.nickname} 加入群聊`);
                });
            }

            groupAddMemberList.appendChild(item);
        });

        openView(groupAddMemberSheet);
    }

    window.imApp.openGroupDetails = function(group) {
        if (!group || group.type !== 'group') return;
        currentViewingGroup = resolveLatestGroup(group) || group;
        group = currentViewingGroup;

        const avatarText = document.getElementById('group-details-avatar-text');
        const avatarImg = document.getElementById('group-details-avatar-img');
        if (group.avatarUrl) {
            avatarImg.src = group.avatarUrl;
            avatarImg.style.display = 'block';
            avatarText.style.display = 'none';
        } else {
            avatarImg.style.display = 'none';
            avatarText.style.display = 'block';
            avatarText.textContent = group.nickname.charAt(0).toUpperCase();
        }

        document.getElementById('group-details-name').textContent = group.nickname;

        const count = getGroupMemberCount(group);
        document.getElementById('group-details-count').textContent = formatGroupMemberCount(count);

        const listContainer = document.getElementById('group-details-members-list');
        const userMeta = getGroupUserDisplayMeta(group);
        const myName = userMeta.name;
        const myAvatarUrl = userMeta.avatarUrl;

        let membersHtml = Number(group.leftGroupAt) > 0 ? '' : `
            <div class="group-detail-member-item" data-id="__user__" style="padding: 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f2f2f7; cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: #e5e5ea; display: flex; justify-content: center; align-items: center; overflow: hidden;">
                        <img src="${myAvatarUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div>
                        <div style="font-size: 16px; font-weight: 600; color: #000;">${myName}</div>
                        <div style="font-size: 12px; color: #007aff;">online</div>
                    </div>
                </div>
                <div style="font-size: 12px; color: #8e8e93; background: #f2f2f7; padding: 2px 8px; border-radius: 10px; color: #c084fc; background: #f3e8ff;">owner</div>
            </div>
        `;

        getResolvedGroupMembers(group).forEach(f => {
                const avatar = f.avatarUrl ? `<img src="${f.avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i class="fas fa-user" style="color: #fff;"></i>`;
                membersHtml += `
                    <div class="group-detail-member-item" data-id="${f.id}" style="padding: 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f2f2f7; cursor: pointer;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="width: 40px; height: 40px; border-radius: 50%; background: #c7c7cc; display: flex; justify-content: center; align-items: center; overflow: hidden;">
                                ${avatar}
                            </div>
                            <div>
                                <div style="font-size: 16px; font-weight: 600; color: #000;">${f.nickname}</div>
                                <div style="font-size: 12px; color: #8e8e93;">offline</div>
                            </div>
                        </div>
                    </div>
                `;
            });

        if (listContainer) {
            listContainer.innerHTML = membersHtml;

            const memberItems = listContainer.querySelectorAll('.group-detail-member-item');
            memberItems.forEach(item => {
                item.addEventListener('click', () => {
                    const memberId = item.getAttribute('data-id');
                    if (memberId === '__user__') {
                        if (window.openView && document.getElementById('group-account-switch-sheet')) {
                            if (window.imApp && window.imApp.showGroupAccountSwitchSheet) {
                                window.imApp.showGroupAccountSwitchSheet(currentViewingGroup);
                            }
                        }
                    } else {
                        if (window.imApp && window.imApp.showGroupMemberManageSheet) {
                            window.imApp.showGroupMemberManageSheet(currentViewingGroup, memberId);
                        }
                    }
                });
            });
        }

        if (groupDetailsSheet) {
            openView(groupDetailsSheet);
        }
    };

    window.imApp.showGroupAccountSwitchSheet = function(group) {
        const sheet = document.getElementById('group-account-switch-sheet');
        const listContainer = document.getElementById('group-account-switch-list');
        if (!sheet || !listContainer || !group) return;

        const latestGroup = resolveLatestGroup(group) || group;
        const selectedAccountId = String(getGroupUserDisplayMeta(latestGroup).id || '');

        listContainer.innerHTML = '';
        listContainer.setAttribute('role', 'radiogroup');
        listContainer.setAttribute('aria-label', '选择群内身份');

        const accounts = getAvailableGroupAccounts();
        if (accounts.length === 0) {
            listContainer.innerHTML = '<div style="text-align: center; color: #8e8e93; padding: 20px;">暂无可用账号，请先在设置中添加 Apple ID</div>';
            window.openView(sheet);
            return;
        }

        accounts.forEach(acc => {
            const isSelected = String(acc.id || '') === selectedAccountId;
            let isSaving = false;
            const item = document.createElement('div');
            item.className = `group-detail-member-item${isSelected ? ' is-selected' : ''}`;
            item.setAttribute('role', 'radio');
            item.setAttribute('aria-checked', isSelected ? 'true' : 'false');
            item.tabIndex = 0;
            item.style.cssText = 'padding: 12px 16px; background: #fff; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer;  margin-bottom: 10px;';

            const accountAvatarUrl = acc.avatarUrl || acc.avatar || '';
            const avatarHtml = accountAvatarUrl
                ? `<img src="${accountAvatarUrl}" style="width: 100%; height: 100%; object-fit: cover;">`
                : `<i class="fas fa-user"></i>`;

            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 44px; height: 44px; border-radius: 50%; background: #e5e5ea; display: flex; justify-content: center; align-items: center; color: #8e8e93; font-size: 20px; overflow: hidden;">
                        ${avatarHtml}
                    </div>
                    <div>
                        <div style="font-size: 16px; font-weight: 600; color: #000;">${acc.name || 'User'}</div>
                        <div style="font-size: 12px; color: #8e8e93;">${acc.signature || acc.persona || 'No Signature'}</div>
                    </div>
                </div>
                <i class="fas fa-check" aria-hidden="true" style="color:#007aff;visibility:${isSelected ? 'visible' : 'hidden'};"></i>
            `;

            item.addEventListener('click', async () => {
                if (isSelected) {
                    window.closeView(sheet);
                    return;
                }
                if (isSaving) return;
                isSaving = true;
                item.style.pointerEvents = 'none';

                const saved = await commitContactsFriendChange(latestGroup, (targetGroup) => {
                    targetGroup.memory = targetGroup.memory || window.imApp.createDefaultMemory();
                    targetGroup.memory.userOverride = {
                        id: acc.id,
                        name: acc.name || 'User',
                        avatarUrl: acc.avatarUrl || acc.avatar || '',
                        persona: acc.persona || '',
                        signature: acc.signature || ''
                    };
                }, { silent: true });

                if (!saved) {
                    isSaving = false;
                    item.style.removeProperty('pointer-events');
                    if (window.showToast) window.showToast('群身份切换保存失败');
                    return;
                }

                const updatedGroup = resolveLatestGroup(latestGroup) || latestGroup;
                currentViewingGroup = updatedGroup;
                if (window.imApp.openGroupDetails) {
                    window.imApp.openGroupDetails(updatedGroup);
                }
                if (window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(updatedGroup.id)) {
                    window.imData.currentActiveFriend = updatedGroup;
                    const page = document.getElementById(`chat-interface-${updatedGroup.id}`);
                    const container = page?.querySelector('.ins-chat-messages');
                    if (container && window.imChat?.rerenderChatContainer) {
                        window.imChat.rerenderChatContainer(updatedGroup, container, { scroll: true });
                    }
                }

                window.closeView(sheet);
                if (window.showToast) window.showToast(`已将您的发言身份切换为: ${acc.name}`);
            });

            item.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    item.click();
                }
            });

            listContainer.appendChild(item);
        });

        window.openView(sheet);
    };

    window.imApp.showGroupMemberManageSheet = function(group, memberId) {
        const sheet = groupMemberManageSheet || document.getElementById('group-member-manage-sheet');
        if (!sheet || !group) return;
        const latestGroup = resolveLatestGroup(group) || group;
        currentViewingGroup = latestGroup;

        const targetMember = window.imData.friends.find(x => String(x.id) === String(memberId));

        if (!targetMember) return;

        const avatarImg = document.getElementById('gmm-avatar');
        const avatarIcon = document.getElementById('gmm-avatar-icon');
        if (targetMember.avatarUrl) {
            avatarImg.src = targetMember.avatarUrl;
            avatarImg.style.display = 'block';
            avatarIcon.style.display = 'none';
        } else {
            avatarImg.style.display = 'none';
            avatarIcon.style.display = 'block';
        }

        document.getElementById('gmm-name').textContent = targetMember.nickname || '群成员';
        
        // 单聊记忆开关与数量逻辑
        const memoryToggle = document.getElementById('gmm-memory-toggle');
        const memoryLimitInput = document.getElementById('gmm-memory-limit-input');
        
        if (memoryToggle) {
            const newToggle = memoryToggle.cloneNode(true);
            memoryToggle.parentNode.replaceChild(newToggle, memoryToggle);
            
            let newLimitInput = null;
            if (memoryLimitInput) {
                newLimitInput = memoryLimitInput.cloneNode(true);
                memoryLimitInput.parentNode.replaceChild(newLimitInput, memoryLimitInput);
            }
            
            newToggle.disabled = false;
            if (newLimitInput) newLimitInput.disabled = false;
            
            const groupMemory = latestGroup.memory || {};
            const mountSettings = groupMemory.mountSettings || {};
            const mountLimits = groupMemory.mountLimits || {};
            
            newToggle.checked = mountSettings[String(memberId)] !== false;
            if (newLimitInput) {
                newLimitInput.value = mountLimits[memberId] || 20;
            }
            
            const saveSettings = async () => {
                const isChecked = newToggle.checked;
                const limitVal = newLimitInput ? parseInt(newLimitInput.value) || 20 : 20;
                
                // 同步更新本地引用
                latestGroup.memory = latestGroup.memory || window.imApp.createDefaultMemory();
                latestGroup.memory.mountSettings = latestGroup.memory.mountSettings || {};
                latestGroup.memory.mountLimits = latestGroup.memory.mountLimits || {};
                latestGroup.memory.mountSettings[memberId] = isChecked;
                latestGroup.memory.mountLimits[memberId] = limitVal;
                
                await commitCurrentGroupChange((targetGroup) => {
                    targetGroup.memory = targetGroup.memory || window.imApp.createDefaultMemory();
                    targetGroup.memory.mountSettings = targetGroup.memory.mountSettings || {};
                    targetGroup.memory.mountLimits = targetGroup.memory.mountLimits || {};
                    
                    targetGroup.memory.mountSettings[memberId] = isChecked;
                    targetGroup.memory.mountLimits[memberId] = limitVal;
                }, { silent: true });
            };

            newToggle.addEventListener('change', async (e) => {
                await saveSettings();
                if (window.showToast) window.showToast(e.target.checked ? '已开启单聊挂载' : '已关闭单聊挂载');
            });
            
            if (newLimitInput) {
                newLimitInput.addEventListener('change', async () => {
                    await saveSettings();
                });
            }
        }

        const kickBtn = document.getElementById('gmm-kick-btn');
        if (kickBtn) {
            const newKickBtn = kickBtn.cloneNode(true);
            kickBtn.parentNode.replaceChild(newKickBtn, kickBtn);
            newKickBtn.addEventListener('click', () => {
                const liveGroup = resolveLatestGroup(latestGroup) || latestGroup;
                if (!liveGroup) return;
                const memberName = targetMember.nickname || '群成员';
                window.showCustomModal({
                    title: '踢出群聊',
                    message: `确定要将“${memberName}”从“${liveGroup.nickname || '群聊'}”中移除吗？该成员的角色和单聊记录不会被删除，群聊历史也会保留。`,
                    confirmText: '删除',
                    isDestructive: true,
                    onConfirm: async () => {
                        currentViewingGroup = liveGroup;
                        const memberKey = String(memberId);
                        const memberStorageKeys = Array.from(new Set([
                            memberKey,
                            String(targetMember.nickname || '').trim(),
                            String(targetMember.realName || '').trim()
                        ].filter(Boolean)));
                        const saved = await commitCurrentGroupChange((targetGroup) => {
                            targetGroup.members = getCanonicalGroupMemberIds(targetGroup)
                                .filter(id => String(id) !== memberKey);

                            if (targetGroup.memory) {
                                if (targetGroup.memory.mountSettings) {
                                    memberStorageKeys.forEach(key => delete targetGroup.memory.mountSettings[key]);
                                }
                                if (targetGroup.memory.mountLimits) {
                                    memberStorageKeys.forEach(key => delete targetGroup.memory.mountLimits[key]);
                                }
                            }

                            if (targetGroup.memberProfiles) {
                                memberStorageKeys.forEach(key => delete targetGroup.memberProfiles[key]);
                            }
                        }, { silent: true, metaOnly: true, syncActive: true });

                        if (!saved) {
                            if (window.showToast) window.showToast('删除成员失败');
                            return;
                        }

                        const refreshedGroup = resolveLatestGroup(liveGroup.id) || liveGroup;
                        closeView(sheet);
                        refreshGroupMembershipUi(refreshedGroup);
                        if (groupCallInviteSheet?.classList.contains('active')) {
                            selectedGroupCallMembers = selectedGroupCallMembers.filter(id => String(id) !== memberKey);
                            renderGroupCallInviteList();
                        }
                        if (window.showToast) window.showToast(`已删除 ${memberName}`);
                    }
                });
            });
        }

        window.openView(sheet);
    };

    if (createGroupSheet) {
        const createGroupTrigger = document.querySelector('#groups-content .line-list-item');
        if (createGroupTrigger) {
            createGroupTrigger.addEventListener('click', () => {
                openCreateGroupSheet();
            });
        }
    }

    const cancelCreateGroupBtn = document.getElementById('cancel-create-group-btn');
    if (cancelCreateGroupBtn) {
        cancelCreateGroupBtn.addEventListener('click', () => {
            closeView(createGroupSheet);
        });
    }

    const groupAvatarWrapper = document.getElementById('group-avatar-wrapper');
    const groupAvatarUpload = document.getElementById('group-avatar-upload');
    if (groupAvatarWrapper && groupAvatarUpload) {
        groupAvatarWrapper.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') groupAvatarUpload.click();
        });
        groupAvatarUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const nextAvatar = window.imApp.compressImageFile
                    ? await window.imApp.compressImageFile(file, {
                        maxWidth: 256,
                        maxHeight: 256,
                        mimeType: 'image/jpeg',
                        quality: 0.8
                    })
                    : await window.imApp.readFileAsDataUrl(file);

                setGroupAvatar(nextAvatar);
            } catch (error) {
                console.error('Failed to process group avatar', error);
                if (showToast) showToast('群头像处理失败');
            }
        });
    }

    const confirmCreateGroupBtn = document.getElementById('confirm-create-group-btn');
    if (confirmCreateGroupBtn) {
        confirmCreateGroupBtn.addEventListener('click', async () => {
            if (tempGroupMembers.length === 0) return;

            let groupName = document.getElementById('group-name-input').value.trim();
            if (!groupName) {
                const memberNames = tempGroupMembers.map(id => {
                    const f = window.imData.friends.find(x => String(x.id) === String(id));
                    return f ? f.nickname : '';
                }).filter(Boolean);
                groupName = memberNames.join(', ');
                if (groupName.length > 20) groupName = groupName.substring(0, 20) + '...';
            }

            const img = document.getElementById('group-avatar-img');
            const avatarUrl = (img && img.style.display === 'block') ? img.src : null;
            const includeUserInput = document.getElementById('create-group-include-user');
            const includeUser = includeUserInput ? includeUserInput.checked : true;
            const observerStartedAt = includeUser ? 0 : Date.now();

            const group = window.imApp.normalizeFriendData({
                id: 'group_' + Date.now(),
                type: 'group',
                realName: groupName,
                nickname: groupName,
                signature: 'Group Chat',
                persona: '',
                avatarUrl: avatarUrl,
                members: Array.from(new Set(tempGroupMembers.map(id => String(id)))),
                leftGroupAt: observerStartedAt,
                groupObserverMode: !includeUser,
                messages: [],
                chatBg: null,
                customCssEnabled: false,
                customCss: '',
                isPinned: false,
                memory: window.imApp.createDefaultMemory()
            });
            if (!includeUser && window.imApp.createGroupMemberSnapshot) {
                group.leftGroupMemberSnapshot = window.imApp.createGroupMemberSnapshot(group);
            }

            const saved = window.imApp.commitFriendsChange
                ? await window.imApp.commitFriendsChange(() => {
                    window.imData.friends.push(group);
                }, { silent: true })
                : false;

            if (!saved) {
                if (window.showToast) window.showToast('创建群聊保存失败');
                return;
            }

            renderGroupsList();
            closeView(createGroupSheet);

            if (window.showToast) window.showToast(includeUser ? '群聊已创建' : '旁观群聊已创建');
        });
    }

    window.imApp.renderGroupsList = renderGroupsList;
    renderGroupsList();

    window.addEventListener('u2:group-summary-updated', (event) => {
        const groupId = event?.detail?.groupId;
        if (!groupId || !currentViewingGroup || String(currentViewingGroup.id) !== String(groupId)) return;
        renderGroupSummaryMorePanel(currentViewingGroup);
    });

    if (groupDetailsSheet) {
        groupDetailsSheet.addEventListener('click', (e) => {
            if (e.target === groupDetailsSheet) closeView(groupDetailsSheet);
        });
    }

    [groupMemberManageSheet, groupMoreSheet].forEach((sheet) => {
        if (!sheet) return;
        sheet.addEventListener('click', (event) => {
            if (event.target === sheet) closeView(sheet);
        });
    });

    if (groupEditSheet) {
        groupEditSheet.addEventListener('click', (e) => {
            if (e.target === groupEditSheet) closeView(groupEditSheet);
        });
    }

    if (groupPrivateChatDetailModal) {
        groupPrivateChatDetailModal.addEventListener('click', (event) => {
            if (event.target === groupPrivateChatDetailModal) closeGroupPrivateChatDetail();
        });
    }
    if (groupPrivateChatDetailClose) {
        groupPrivateChatDetailClose.addEventListener('click', closeGroupPrivateChatDetail);
    }

    if (groupContextSettingsSheet) {
        groupContextSettingsSheet.addEventListener('click', (e) => {
            if (e.target === groupContextSettingsSheet) closeView(groupContextSettingsSheet);
        });
    }

    if (groupDetailsEditBtn) {
        groupDetailsEditBtn.addEventListener('click', () => {
            openGroupEditSheet();
        });
    }

    if (groupDetailsSettingsBtn) {
        groupDetailsSettingsBtn.addEventListener('click', () => {
            openGroupContextSettingsSheet();
        });
    }

    if (groupManualSummaryBtn) {
        groupManualSummaryBtn.addEventListener('click', () => {
            const group = resolveLatestGroup(currentViewingGroup);
            if (!group) return;
            window.imData.currentSettingsFriend = group;
            if (window.imChat?.openManualSummaryModal) {
                window.imChat.openManualSummaryModal(group);
            } else if (window.showToast) {
                window.showToast('总结功能尚未初始化');
            }
        });
    }

    groupMemoryShortTermBtn?.addEventListener('click', () => {
        const group = resolveLatestGroup(currentViewingGroup);
        if (group) window.imApp.openMemoryLocationForFriend?.(group, 'iphone');
    });

    groupMemoryLongTermBtn?.addEventListener('click', () => {
        const group = resolveLatestGroup(currentViewingGroup);
        if (group) window.imApp.openMemoryLocationForFriend?.(group, 'downloads');
    });

    window.addEventListener('u2:memory-entries-updated', event => {
        if (!currentViewingGroup || String(event.detail?.friendId || '') !== String(currentViewingGroup.id)) return;
        currentViewingGroup = resolveLatestGroup(currentViewingGroup) || currentViewingGroup;
        refreshGroupMemoryCounts(currentViewingGroup);
    });

    if (groupDetailsMoreBtn) {
        groupDetailsMoreBtn.addEventListener('click', () => {
            if (groupMoreSheet) {
                renderGroupSummaryMorePanel(currentViewingGroup);
                if (window.openView) window.openView(groupMoreSheet);
                else {
                    groupMoreSheet.style.display = 'flex';
                    setTimeout(() => { groupMoreSheet.style.opacity = '1'; }, 10);
                }
            }
        });
    }

    function createGroupPollOptionId(index = 0) {
        return `poll-option-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
    }

    function resetGroupPollForm() {
        if (groupPollQuestionInput) groupPollQuestionInput.value = '';
        if (!groupPollOptionsList) return;
        groupPollOptionsList.innerHTML = '';
        addGroupPollOptionRow();
        addGroupPollOptionRow();
        updateGroupPollOptionControls();
    }

    function updateGroupPollOptionControls() {
        if (!groupPollOptionsList) return;
        const rows = Array.from(groupPollOptionsList.querySelectorAll('.group-poll-option-row'));
        rows.forEach((row, index) => {
            const indexEl = row.querySelector('.group-poll-option-index');
            const removeBtn = row.querySelector('.group-poll-option-remove');
            if (indexEl) indexEl.textContent = String(index + 1);
            if (removeBtn) removeBtn.hidden = rows.length <= 2;
        });
        if (groupPollOptionCount) groupPollOptionCount.textContent = `${rows.length} / 10`;
        if (groupPollAddOptionBtn) groupPollAddOptionBtn.disabled = rows.length >= 10;
    }

    function addGroupPollOptionRow(value = '') {
        if (!groupPollOptionsList) return;
        const currentCount = groupPollOptionsList.querySelectorAll('.group-poll-option-row').length;
        if (currentCount >= 10) return;
        const row = document.createElement('div');
        row.className = 'group-poll-option-row';
        row.innerHTML = `
            <span class="group-poll-option-index">${currentCount + 1}</span>
            <input type="text" class="group-poll-option-input" maxlength="60" placeholder="选项 ${currentCount + 1}" value="${escapeGroupHtml(value)}">
            <button type="button" class="group-poll-option-remove" aria-label="删除选项"><i class="fas fa-minus-circle"></i></button>
        `;
        row.querySelector('.group-poll-option-remove')?.addEventListener('click', () => {
            if (groupPollOptionsList.querySelectorAll('.group-poll-option-row').length <= 2) return;
            row.remove();
            updateGroupPollOptionControls();
        });
        groupPollOptionsList.appendChild(row);
        updateGroupPollOptionControls();
    }

    function getGroupPollFormValues() {
        const question = String(groupPollQuestionInput?.value || '').trim();
        const options = Array.from(groupPollOptionsList?.querySelectorAll('.group-poll-option-input') || [])
            .map(input => String(input.value || '').trim());
        return { question, options };
    }

    function validateGroupPollForm(question, options) {
        if (!question) return '请输入投票内容';
        if (options.length < 2) return '至少需要两个选项';
        if (options.some(option => !option)) return '请填写完整的投票选项';
        const normalizedOptions = options.map(option => option.toLocaleLowerCase());
        if (new Set(normalizedOptions).size !== normalizedOptions.length) return '投票选项不能重复';
        return '';
    }

    function buildGroupPollContextText(message) {
        const question = String(message?.pollQuestion || '').trim();
        const options = Array.isArray(message?.pollOptions) ? message.pollOptions : [];
        const votes = Array.isArray(message?.pollVotes) ? message.pollVotes : [];
        const optionById = new Map(options.map(option => [String(option.id), option.text]));
        const voteLines = votes.map(vote => `${vote.voterName || vote.voterId} → ${optionById.get(String(vote.optionId)) || '未知选项'}`);
        return `[群投票：${question}\n选项：${options.map(option => option.text).join(' / ')}\n当前投票：${voteLines.length > 0 ? voteLines.join('；') : '暂无'}]`;
    }

    function getGroupPollMessage(groupId, messageId) {
        const group = resolveLatestGroup(groupId);
        if (!group || !Array.isArray(group.messages)) return null;
        return group.messages.find(message => String(message?.id) === String(messageId) && message?.type === 'group_poll') || null;
    }

    function rerenderGroupPollMessage(groupId, messageId) {
        const group = resolveLatestGroup(groupId);
        const message = getGroupPollMessage(groupId, messageId);
        const page = document.getElementById(`chat-interface-${groupId}`);
        const container = page?.querySelector('.ins-chat-messages');
        if (group && message && container && window.imChat?.replaceMessageInContainer) {
            window.imChat.replaceMessageInContainer(group, container, message, { id: messageId }, { scroll: false });
        }
    }

    async function updateGroupPollMessage(groupId, messageId, mutator) {
        const saved = await window.imApp.updateFriendMessage(groupId, { id: messageId }, (message) => {
            if (!message || message.type !== 'group_poll') return;
            mutator(message);
            message.content = buildGroupPollContextText(message);
        }, { silent: true });
        if (saved) rerenderGroupPollMessage(groupId, messageId);
        return saved;
    }

    window.imChat = window.imChat || {};
    window.imChat.applyGroupPollRoleVotes = async function(groupId, messageId, roleVotes) {
        const group = resolveLatestGroup(groupId);
        const message = getGroupPollMessage(groupId, messageId);
        if (!group || !message || !Array.isArray(roleVotes)) return false;
        const members = (Array.isArray(group.members) ? group.members : [])
            .map(memberId => (window.imData?.friends || []).find(friend => String(friend.id) === String(memberId)))
            .filter(Boolean);
        const memberById = new Map(members.map(member => [String(member.id), member]));
        const optionIds = new Set((message.pollOptions || []).map(option => String(option.id)));

        return updateGroupPollMessage(groupId, messageId, targetMessage => {
            const existingVotes = Array.isArray(targetMessage.pollVotes) ? targetMessage.pollVotes : [];
            const votedMemberIds = new Set(existingVotes
                .filter(vote => vote?.voterType === 'member')
                .map(vote => String(vote.voterId)));
            const acceptedVotes = [];
            roleVotes.forEach(vote => {
                const memberId = String(vote?.memberId || vote?.voterId || '');
                const optionId = String(vote?.optionId || '');
                const member = memberById.get(memberId);
                if (!member || !optionIds.has(optionId) || votedMemberIds.has(memberId)) return;
                votedMemberIds.add(memberId);
                acceptedVotes.push({
                    voterId: memberId,
                    voterName: member.nickname || member.realName || memberId,
                    optionId,
                    voterType: 'member'
                });
            });
            targetMessage.pollVotes = [...existingVotes, ...acceptedVotes];
            targetMessage.pollStatus = 'completed';
            targetMessage.pollError = '';
        });
    };
    window.imChat.selectGroupPollOption = async function(groupId, messageId, optionId) {
        const group = resolveLatestGroup(groupId);
        const message = getGroupPollMessage(groupId, messageId);
        if (!group || !message || !(message.pollOptions || []).some(option => String(option.id) === String(optionId))) return false;
        const userIdentity = window.imApp?.getGroupUserIdentity
            ? window.imApp.getGroupUserIdentity(group)
            : getGroupUserDisplayMeta(group);
        return updateGroupPollMessage(groupId, messageId, targetMessage => {
            const memberVotes = (Array.isArray(targetMessage.pollVotes) ? targetMessage.pollVotes : [])
                .filter(vote => vote?.voterType === 'member');
            targetMessage.pollVotes = [{
                voterId: '__user__',
                voterName: userIdentity.name,
                voterAvatarUrl: userIdentity.avatarUrl,
                optionId: String(optionId),
                voterType: 'user'
            }, ...memberVotes];
            targetMessage.pollStatus = 'idle';
            targetMessage.pollError = '';
        });
    };

    if (groupPollBtn) {
        groupPollBtn.addEventListener('click', () => {
            if (!resolveLatestGroup(currentViewingGroup)) return;
            resetGroupPollForm();
            closeView(groupMoreSheet);
            if (window.openView) window.openView(groupPollCreateSheet);
            setTimeout(() => groupPollQuestionInput?.focus(), 120);
        });
    }

    groupPollCreateClose?.addEventListener('click', () => closeView(groupPollCreateSheet));
    groupPollAddOptionBtn?.addEventListener('click', () => {
        addGroupPollOptionRow();
        const inputs = groupPollOptionsList?.querySelectorAll('.group-poll-option-input');
        inputs?.[inputs.length - 1]?.focus();
    });

    groupPollSubmitBtn?.addEventListener('click', async () => {
        const group = resolveLatestGroup(currentViewingGroup);
        if (!group) return;
        const { question, options } = getGroupPollFormValues();
        const validationError = validateGroupPollForm(question, options);
        if (validationError) {
            if (window.showToast) window.showToast(validationError);
            return;
        }

        groupPollSubmitBtn.disabled = true;
        const timestamp = Date.now();
        const message = {
            id: window.imChat?.createMessageId ? window.imChat.createMessageId('poll') : `poll-${timestamp}`,
            role: 'user',
            type: 'group_poll',
            timestamp,
            pollId: `group-poll-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
            pollQuestion: question,
            pollOptions: options.map((text, index) => ({ id: createGroupPollOptionId(index), text })),
            pollVotes: [],
            pollStatus: 'idle',
            pollError: ''
        };
        message.content = buildGroupPollContextText(message);

        try {
            const saved = await window.imApp.appendFriendMessage(group.id, message);
            if (!saved) return;
            const liveGroup = resolveLatestGroup(group.id) || group;
            const page = document.getElementById(`chat-interface-${group.id}`);
            const container = page?.querySelector('.ins-chat-messages');
            if (container && window.imChat?.appendMessageToContainer) {
                window.imChat.appendMessageToContainer(liveGroup, container, message);
            }
            closeView(groupPollCreateSheet);
            closeView(document.getElementById('group-details-sheet'));
        } finally {
            groupPollSubmitBtn.disabled = false;
        }
    });

    let selectedGroupCallMembers = [];

    function renderGroupCallInviteList() {
        if (!groupCallMembersList || !currentViewingGroup) return;
        groupCallMembersList.innerHTML = '';
        
        const allMembers = [ ...currentViewingGroup.members ];
        
        allMembers.forEach((memberId, index) => {
            const friend = window.imData.friends.find(f => f.id === memberId);
            if (!friend) return;

            const isSelected = selectedGroupCallMembers.includes(friend.id);
            const item = document.createElement('div');
            item.className = 'group-detail-member-item';
            item.style.cssText = `padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: ${index === allMembers.length - 1 ? 'none' : '1px solid #f2f2f7'}; cursor: pointer;`;

            const avatarHtml = friend.avatarUrl
                ? `<img src="${friend.avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;">`
                : (friend.type === 'npc' ? `<i class="fas fa-robot"></i>` : `<i class="fas fa-user"></i>`);

            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: #e5e5ea; display: flex; justify-content: center; align-items: center; color: #8e8e93; overflow: hidden;">
                        ${avatarHtml}
                    </div>
                    <div style="font-size: 16px; font-weight: 500; color: #000;">${friend.nickname}</div>
                </div>
                <div style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid ${isSelected ? '#34c759' : '#c7c7cc'}; background: ${isSelected ? '#34c759' : 'transparent'}; display: flex; justify-content: center; align-items: center; color: #fff; font-size: 12px;">
                    ${isSelected ? '<i class="fas fa-check"></i>' : ''}
                </div>
            `;

            item.addEventListener('click', () => {
                if (isSelected) {
                    selectedGroupCallMembers = selectedGroupCallMembers.filter(id => id !== friend.id);
                } else {
                    selectedGroupCallMembers.push(friend.id);
                }
                renderGroupCallInviteList();
            });

            groupCallMembersList.appendChild(item);
        });
        
        if (groupCallStartBtn) {
            if (selectedGroupCallMembers.length > 0) {
                groupCallStartBtn.style.opacity = '1';
                groupCallStartBtn.style.pointerEvents = 'auto';
            } else {
                groupCallStartBtn.style.opacity = '0.5';
                groupCallStartBtn.style.pointerEvents = 'none';
            }
        }
    }

    if (groupCallBtn) {
        groupCallBtn.addEventListener('click', () => {
            if (!currentViewingGroup) return;
            
            closeView(groupMoreSheet);
            closeView(document.getElementById('group-details-sheet'));
            
            selectedGroupCallMembers = [...currentViewingGroup.members];
            renderGroupCallInviteList();
            
            if (window.openView) window.openView(groupCallInviteSheet);
        });
    }

    if (groupCallStartBtn) {
        groupCallStartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (
                !groupCallInviteSheet ||
                !groupCallInviteSheet.classList.contains('active') ||
                window.getComputedStyle(groupCallInviteSheet).pointerEvents === 'none'
            ) {
                return;
            }

            if (!currentViewingGroup || selectedGroupCallMembers.length === 0) return;
            closeView(groupCallInviteSheet);
            
            if (window.imChat && window.imChat.openGroupVoiceCall) {
                window.imChat.openGroupVoiceCall(currentViewingGroup, selectedGroupCallMembers);
            }
        });
    }

    const clearGroupChatHistoryBtn = document.getElementById('clear-group-chat-history-btn');
    if (clearGroupChatHistoryBtn) {
        clearGroupChatHistoryBtn.addEventListener('click', async () => {
            if (!currentViewingGroup) return;
            window.showCustomModal({
                title: '清空聊天记录',
                message: `确定要清空群聊 "${currentViewingGroup.nickname}" 的聊天记录、全部记忆和成员状态栏吗？此操作不可恢复。`,
                confirmText: '清空',
                isDestructive: true,
                onConfirm: async () => {
                    const groupId = currentViewingGroup.id;
                    const success = await window.imApp.resetFriendConversation(groupId);
                    if (success) {
                        const latestGroup = resolveLatestGroup(groupId) || currentViewingGroup;
                        currentViewingGroup = latestGroup;
                        if (window.showToast) window.showToast('聊天记录、总结、上下文和成员心声已清空');
                        if (window.imApp.openChatTab) window.imApp.openChatTab(latestGroup);
                    }
                }
            });
        });
    }

    const leaveGroupChatBtn = document.getElementById('leave-group-chat-btn');
    if (leaveGroupChatBtn) {
        leaveGroupChatBtn.addEventListener('click', async () => {
            if (!currentViewingGroup) return;
            window.showCustomModal({
                title: '退出群聊',
                message: `确定要退出群聊 "${currentViewingGroup.nickname}" 吗？`,
                confirmText: '退出',
                isDestructive: true,
                onConfirm: async () => {
                    const groupId = currentViewingGroup.id;
                    const leftAt = Date.now();
                    const saved = window.imApp.commitScopedFriendChange
                        ? await window.imApp.commitScopedFriendChange(groupId, (targetGroup) => {
                            if (!targetGroup) return;
                            targetGroup.leftGroupAt = leftAt;
                            targetGroup.groupObserverMode = false;
                            targetGroup.leftGroupMemberSnapshot = window.imApp.createGroupMemberSnapshot
                                ? window.imApp.createGroupMemberSnapshot(targetGroup)
                                : [];
                        }, {
                            syncActive: true,
                            syncSettings: true,
                            metaOnly: true,
                            silent: true
                        })
                        : false;

                    if (!saved) {
                        if (window.showToast) window.showToast('退出群聊失败');
                        return;
                    }

                    const latestGroup = (window.imData.friends || []).find(item => String(item.id) === String(groupId)) || currentViewingGroup;
                    currentViewingGroup = latestGroup;

                    const groupLeftNotice = {
                        id: `sys-${Date.now()}`,
                        role: 'system',
                        type: 'system_notice',
                        noticeKind: 'group_left',
                        content: '你已退出群聊',
                        text: '你已退出群聊',
                        timestamp: Date.now()
                    };
                    await window.imApp.appendFriendMessage(groupId, groupLeftNotice, { silent: true });
                    if (window.showToast) window.showToast('已退出群聊');
                    window.closeView(document.getElementById('group-context-settings-sheet'));
                    window.closeView(document.getElementById('group-details-sheet'));
                    if (window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(groupId)) {
                        window.imData.currentActiveFriend = latestGroup;
                        const page = document.getElementById(`chat-interface-${groupId}`);
                        if (page && window.imChat?.syncGroupExitState) {
                            window.imChat.syncGroupExitState(latestGroup, page);
                        }
                        const msgContainer = page ? page.querySelector('.ins-chat-messages') : null;
                        if (msgContainer && window.imChat?.rerenderChatContainer) {
                            window.imChat.rerenderChatContainer(latestGroup, msgContainer, { scroll: true });
                        }
                    }
                    if (window.imApp.openChatTab) window.imApp.openChatTab(latestGroup);
                }
            });
        });
    }

    const dismissGroupChatBtn = document.getElementById('dismiss-group-chat-btn');
    if (dismissGroupChatBtn) {
        dismissGroupChatBtn.addEventListener('click', async () => {
            if (!currentViewingGroup) return;
            window.showCustomModal({
                title: '解散群聊',
                message: `确定要解散群聊 "${currentViewingGroup.nickname}" 吗？所有相关数据将被删除且不可恢复。`,
                confirmText: '解散',
                isDestructive: true,
                onConfirm: async () => {
                    const saved = await window.imApp.commitFriendsChange(() => {
                        window.imData.friends = window.imData.friends.filter(f => String(f.id) !== String(currentViewingGroup.id));
                    }, { silent: true });
                    
                    if (saved) {
                        if (window.imStorage && window.imStorage.deleteFriend) {
                            await window.imStorage.deleteFriend(currentViewingGroup.id);
                        }
                        if (window.showToast) window.showToast('群聊已解散');
                        window.closeView(document.getElementById('group-context-settings-sheet'));
                        window.closeView(document.getElementById('group-details-sheet'));
                        const chatInterface = document.getElementById(`chat-interface-${currentViewingGroup.id}`);
                        if (chatInterface) {
                            chatInterface.remove();
                        }
                        if (window.imData.currentActiveFriend && window.imData.currentActiveFriend.id === currentViewingGroup.id) {
                            window.imData.currentActiveFriend = null;
                            if (window.imChat && window.imChat.updateChatsView) {
                                window.imChat.updateChatsView();
                            }
                        }
                        currentViewingGroup = null;
                        if (window.imApp.renderGroupsList) window.imApp.renderGroupsList();
                    }
                }
            });
        });
    }

    if (confirmGroupEditBtn) {
        confirmGroupEditBtn.addEventListener('click', async () => {
            if (!currentViewingGroup) return;
            const newName = groupEditNameInput ? groupEditNameInput.value.trim() : '';
            if (newName) {
                const saved = await commitCurrentGroupChange((targetGroup) => {
                    targetGroup.nickname = newName;
                    targetGroup.realName = newName;
                }, { silent: true });

                if (!saved) {
                    if (window.showToast) window.showToast('群聊名称保存失败');
                    return;
                }

                const nameEl = document.getElementById('group-details-name');
                if (nameEl) nameEl.textContent = newName;

                const chatNameEl = document.getElementById('active-chat-name');
                const groupChatHeaderEl = document.getElementById('active-chat-header');

                if (window.imData.currentActiveFriend && window.imData.currentActiveFriend.id === currentViewingGroup.id) {
                    if (chatNameEl) {
                        chatNameEl.textContent = newName;
                    }
                    if (groupChatHeaderEl) {
                        const nameDiv = groupChatHeaderEl.querySelector('.ins-chat-name');
                        if (nameDiv) nameDiv.textContent = newName;
                    }
                }

                renderGroupsList();
            }
            closeView(groupEditSheet);
        });
    }

    if (confirmGroupContextBtn) {
        confirmGroupContextBtn.addEventListener('click', async () => {
            if (!currentViewingGroup) return;

            const enabled = !!(groupContextEnabledToggle && groupContextEnabledToggle.checked);
            const timeAware = groupTimeAwareToggle
                ? !!groupTimeAwareToggle.checked
                : currentViewingGroup.timeAware !== false;
            const autoExpandTranslation = groupAutoExpandTranslationToggle
                ? !!groupAutoExpandTranslationToggle.checked
                : currentViewingGroup.autoExpandTranslation === true;
            const showGroupUserAvatar = groupShowUserAvatarToggle?.checked === true;
            const allowGroupMemberPrivateChats = groupMemberPrivateChatsToggle
                ? !!groupMemberPrivateChatsToggle.checked
                : currentViewingGroup.allowGroupMemberPrivateChats !== false;
            const allowGroupMemberFriendPrivateChats = groupMemberFriendPrivateChatsToggle
                ? !!groupMemberFriendPrivateChatsToggle.checked
                : currentViewingGroup.allowGroupMemberFriendPrivateChats !== false;
            let limit = groupContextLimitInput ? Number(groupContextLimitInput.value) : 100;

            if (!Number.isFinite(limit) || limit <= 0) {
                limit = 100;
            }

            limit = Math.max(1, Math.floor(limit));

            if (groupContextLimitInput) {
                groupContextLimitInput.value = limit;
            }

            const saved = await commitCurrentGroupChange((targetGroup) => {
                targetGroup.memory = targetGroup.memory || window.imApp.createDefaultMemory();
                targetGroup.memory.context = targetGroup.memory.context || {};
                targetGroup.memory.context.enabled = enabled;
                targetGroup.memory.context.limit = limit;
                targetGroup.timeAware = timeAware;
                targetGroup.autoExpandTranslation = autoExpandTranslation;
                targetGroup.showGroupUserAvatar = showGroupUserAvatar;
                targetGroup.allowGroupMemberPrivateChats = allowGroupMemberPrivateChats;
                targetGroup.allowGroupMemberFriendPrivateChats = allowGroupMemberFriendPrivateChats;
            }, { silent: true });

            if (!saved) {
                if (window.showToast) window.showToast('群上下文设置保存失败');
                return;
            }

            const latestGroup = resolveLatestGroup(currentViewingGroup) || currentViewingGroup;
            const activePage = document.getElementById(`chat-interface-${latestGroup.id}`);
            const activeContainer = activePage?.querySelector('.ins-chat-messages');
            if (activeContainer && window.imChat?.syncGroupUserAvatarState) {
                window.imChat.syncGroupUserAvatarState(latestGroup, activeContainer);
            }
            closeView(groupContextSettingsSheet);
            if (window.showToast) window.showToast('设置已保存');
        });
    }

    if (groupContextLimitInput) {
        groupContextLimitInput.addEventListener('change', async () => {
            if (!currentViewingGroup) return;
            let limit = Number(groupContextLimitInput.value);
            if (!Number.isFinite(limit) || limit <= 0) {
                limit = Number(currentViewingGroup.memory?.context?.limit) || 100;
            }
            limit = Math.max(1, Math.floor(limit));

            const saved = await commitCurrentGroupChange((targetGroup) => {
                targetGroup.memory = window.imApp.normalizeFriendData(targetGroup).memory;
                targetGroup.memory.context.limit = limit;
            }, { silent: true });

            const latestGroup = resolveLatestGroup(currentViewingGroup) || currentViewingGroup;
            groupContextLimitInput.value = Number(latestGroup.memory?.context?.limit) > 0
                ? Number(latestGroup.memory.context.limit)
                : 100;
            if (!saved && window.showToast) window.showToast('群上下文条数保存失败');
        });
    }

    if (groupBgUploadIcon && groupBgUpload) {
        groupBgUploadIcon.addEventListener('click', () => {
            groupBgUpload.click();
        });
        groupBgUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && currentViewingGroup) {
                try {
                    const nextBg = window.imApp.compressImageFile
                        ? await window.imApp.compressImageFile(file, {
                            maxWidth: 1280,
                            maxHeight: 1280,
                            mimeType: 'image/jpeg',
                            quality: 0.82
                        })
                        : await window.imApp.readFileAsDataUrl(file);

                    const saved = await commitCurrentGroupChange((targetGroup) => {
                        targetGroup.chatBg = nextBg;
                    }, { silent: true });

                    if (!saved) {
                        if (window.showToast) window.showToast('群聊背景保存失败');
                        return;
                    }

                    if (window.imData.currentActiveFriend && window.imData.currentActiveFriend.id === currentViewingGroup.id) {
                        if (window.imApp.applyFriendBg) window.imApp.applyFriendBg(currentViewingGroup);
                    }
                    if (window.showToast) window.showToast('群聊背景已更新');
                } catch (error) {
                    console.error('Failed to process group background', error);
                    if (showToast) showToast('群背景处理失败');
                }
            }
            e.target.value = '';
        });
    }

    if (groupBgResetIcon) {
        groupBgResetIcon.addEventListener('click', async () => {
            if (currentViewingGroup) {
                const saved = await commitCurrentGroupChange((targetGroup) => {
                    targetGroup.chatBg = null;
                }, { silent: true });

                if (!saved) {
                    if (window.showToast) window.showToast('群聊背景重置失败');
                    return;
                }

                if (window.imData.currentActiveFriend && window.imData.currentActiveFriend.id === currentViewingGroup.id) {
                    if (window.imApp.applyFriendBg) window.imApp.applyFriendBg(currentViewingGroup);
                }
                if (window.showToast) window.showToast('群聊背景已重置');
            }
        });
    }

    const groupAvatarUploadBtn = document.getElementById('group-details-avatar-upload-btn');
    const groupAvatarInput = document.getElementById('group-details-avatar-input');
    if (groupAvatarUploadBtn && groupAvatarInput) {
        groupAvatarUploadBtn.addEventListener('click', () => {
            groupAvatarInput.click();
        });

        groupAvatarInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && currentViewingGroup) {
                try {
                    const newUrl = window.imApp.compressImageFile
                        ? await window.imApp.compressImageFile(file, {
                            maxWidth: 256,
                            maxHeight: 256,
                            mimeType: 'image/jpeg',
                            quality: 0.8
                        })
                        : await window.imApp.readFileAsDataUrl(file);

                    const saved = await commitCurrentGroupChange((targetGroup) => {
                        targetGroup.avatarUrl = newUrl;
                    }, { silent: true });

                    if (!saved) {
                        if (window.showToast) window.showToast('群头像保存失败');
                        return;
                    }

                    const avatarImg = document.getElementById('group-details-avatar-img');
                    const avatarText = document.getElementById('group-details-avatar-text');

                    if (avatarImg) {
                        avatarImg.src = newUrl;
                        avatarImg.style.display = 'block';
                    }
                    if (avatarText) avatarText.style.display = 'none';

                    const latestGroup = (window.imData.friends || []).find(item => String(item.id) === String(currentViewingGroup.id)) || currentViewingGroup;
                    currentViewingGroup = latestGroup;

                    if (window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(currentViewingGroup.id)) {
                        window.imData.currentActiveFriend = latestGroup;
                    }

                    if (window.imChat && window.imChat.refreshGroupHeaderAvatar) {
                        window.imChat.refreshGroupHeaderAvatar(latestGroup);
                    }

                    renderGroupsList();
                    if (window.imChat && window.imChat.renderChatsList) {
                        window.imChat.renderChatsList();
                    }
                    if (window.showToast) window.showToast('群头像已更新');
                } catch (error) {
                    console.error('Failed to process group details avatar', error);
                    if (showToast) showToast('群头像处理失败');
                }
            }
            e.target.value = '';
        });
    }

    if (groupAddMemberBtn) {
        groupAddMemberBtn.addEventListener('click', () => {
            if (!currentViewingGroup) return;
            openGroupAddMemberSheet();
        });
    }

    if (groupAddMemberSheet) {
        groupAddMemberSheet.addEventListener('click', (e) => {
            if (e.target === groupAddMemberSheet) closeView(groupAddMemberSheet);
        });
    }
});
