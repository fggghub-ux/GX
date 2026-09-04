// ==========================================
// IMESSAGE: 4_chat_bubbles.js
// ==========================================
(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    const { apiConfig, userState } = window;
    window.imChat = window.imChat || {};
    const imChat = window.imChat;
    const INITIAL_HISTORY_USER_ROUNDS = 30;
    const HISTORY_LOAD_MORE_USER_ROUNDS = 10;
    const renderMessageContextByFriend = new WeakMap();

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getEffectiveUserProfile(friend = null, message = null) {
        if (friend?.type === 'group' && window.imApp?.getMessageUserIdentity) {
            return window.imApp.getMessageUserIdentity(friend, message || { role: 'user' });
        }
        const boundAccount = window.imApp?.getBoundAccountByFriend
            ? window.imApp.getBoundAccountByFriend(friend)
            : null;
        const source = boundAccount || window.userState || userState || {};

        return {
            name: source.name || source.realName || source.nickname || 'User',
            avatarUrl: source.avatarUrl || 'assets/moren-thumb.jpg'
        };
    }

    function syncGroupUserAvatarState(friend, container) {
        if (!container) return;
        const enabled = friend?.type === 'group' && friend.showGroupUserAvatar === true;
        container.classList.toggle('show-group-user-avatar', enabled);
        if (!enabled) {
            container.style.removeProperty('--group-user-avatar-image');
            return;
        }

        const avatarUrl = getEffectiveUserProfile(friend).avatarUrl || 'assets/moren-thumb.jpg';
        container.style.setProperty('--group-user-avatar-image', `url(${JSON.stringify(String(avatarUrl))})`);
    }

    function decorateMessageRowAvatar(row, friend, message = {}) {
        if (!row || friend?.type === 'group' || row.querySelector(':scope > .im-message-avatar')) return row;
        if (message.type === 'system_notice' || row.classList.contains('chat-system-row') || row.classList.contains('typing-row')) return row;

        const isUser = message.role === 'user' || row.classList.contains('user-row');
        let profile;
        if (isUser) {
            profile = getEffectiveUserProfile(friend, message);
        } else {
            profile = {
                name: friend?.nickname || friend?.realName || 'AI',
                avatarUrl: friend?.avatarUrl || 'assets/moren-thumb.jpg'
            };
        }

        const avatar = document.createElement('span');
        avatar.className = `im-message-avatar ${isUser ? 'is-user' : 'is-assistant'}`;
        avatar.setAttribute('aria-hidden', 'true');
        avatar.dataset.messageRole = isUser ? 'user' : 'assistant';
        avatar.innerHTML = `<img src="${escapeHtml(profile.avatarUrl || 'assets/moren-thumb.jpg')}" alt="" loading="lazy" decoding="async" onerror="this.src='assets/moren-thumb.jpg'">`;
        row.appendChild(avatar);
        return row;
    }

    function finalizeRenderedMessage(message, friend, container) {
        const messageId = String(message?.id || '');
        const rows = Array.from(container?.children || []);
        const row = rows.reverse().find((candidate) => candidate.classList?.contains('chat-row')
            && (!messageId || String(candidate.getAttribute('data-message-id') || '') === messageId));
        if (row) decorateMessageRowAvatar(row, friend, message);
        return true;
    }

    function setGroupUserRowIdentity(row, friend, message = renderMessageContextByFriend.get(friend)) {
        if (!row || friend?.type !== 'group' || message?.role !== 'user') return;
        const profile = getEffectiveUserProfile(friend, message);
        row.setAttribute('data-user-account-id', profile.accountId || '');
        row.style.setProperty('--group-user-avatar-image', `url(${JSON.stringify(String(profile.avatarUrl || 'assets/moren-thumb.jpg'))})`);
    }

    function resolveGroupBubbleIdentity(friend, msg = {}) {
        const member = friend?.type === 'group' && window.imChat?.getGroupMessageSpeaker
            ? window.imChat.getGroupMessageSpeaker(friend, msg)
            : null;
        return {
            member,
            memberId: member?.id ?? msg.speakerMemberId ?? msg.senderMemberId ?? '',
            name: member?.nickname || member?.realName || msg.speaker || msg.senderName || '群成员',
            avatarUrl: member?.avatarUrl || msg.senderAvatarUrl || null
        };
    }

    function setGroupRowMemberId(row, friend, msg = {}) {
        if (!row || friend?.type !== 'group') return;
        const identity = resolveGroupBubbleIdentity(friend, msg);
        if (identity.memberId !== '') {
            row.setAttribute('data-speaker-member-id', String(identity.memberId));
        }
    }

    function resolvePayTransferParties(msg = {}, friend = null) {
        if (typeof window.imChat.normalizePayTransferMessage === 'function') {
            return window.imChat.normalizePayTransferMessage(msg, friend);
        }

        if (typeof window.imChat.resolvePayTransferParties === 'function') {
            return window.imChat.resolvePayTransferParties(msg, friend);
        }

        const payKind = msg.payKind || (msg.role === 'user' ? 'user_to_char' : 'char_received');
        const userName = getEffectiveUserProfile(friend, msg).name;
        const charName = msg.speaker || msg.charName || friend?.nickname || friend?.realName || friend?.name || 'Char';
        const targetName = msg.targetName || '';
        const charToUserKinds = ['char_to_user_pending', 'char_to_user_claimed', 'user_received_from_char', 'user_rejected_from_char'];
        const claimedKinds = ['char_received', 'char_to_user_claimed', 'user_received_from_char'];
        const rejectedKinds = ['user_to_char_rejected', 'char_to_user_rejected', 'user_rejected_from_char'];
        const direction = msg.payDirection === 'char_to_user' || msg.payDirection === 'user_to_char'
            ? msg.payDirection
            : (charToUserKinds.includes(payKind) ? 'char_to_user' : 'user_to_char');
        let status = rejectedKinds.includes(payKind)
            ? 'rejected'
            : (claimedKinds.includes(payKind) ? 'claimed' : 'pending');
        if (status === 'pending' && msg.claimed) status = 'claimed';
        let payerName = msg.payerName || '';
        let payeeName = msg.payeeName || '';

        if (direction === 'char_to_user') {
            payerName = payerName || msg.senderName || targetName || charName;
            payeeName = payeeName || msg.receiverName || userName;
        } else {
            payerName = payerName || msg.senderName || userName;
            payeeName = payeeName || msg.receiverName || (targetName && targetName !== userName ? targetName : charName);
        }

        const payerType = direction === 'user_to_char' ? 'user' : 'char';
        const payeeType = direction === 'user_to_char' ? 'char' : 'user';

        return {
            payKind,
            direction,
            status,
            payerName,
            payeeName,
            payerType,
            payeeType,
            canCurrentUserClaim: direction === 'char_to_user' && status === 'pending' && !msg.claimed,
            senderName: payerName,
            receiverName: payeeName,
            senderType: payerType,
            receiverType: payeeType,
            isUserSender: payerType === 'user'
        };
    }

    function buildMessageHeaderHtml(isUser, friend, timestamp, speakerName, speakerAvatar, hasPrev, message = null) {
        if (!friend || !friend.showAvatar || hasPrev) return '';
        const date = new Date(timestamp);
        const dateStr = date.toLocaleString('en-US', { month: 'long', day: 'numeric' });
        const ampmTimeStr = date.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
        
        if (isUser) {
            const userProfile = getEffectiveUserProfile(friend, message || renderMessageContextByFriend.get(friend));
            const userName = userProfile.name;
            const userAvatar = userProfile.avatarUrl;
            return `
                <div class="chat-message-header user-header" style="display: flex; justify-content: flex-end; width: 100%; margin-bottom: 4px; padding-right: 0px; align-items: flex-start;">
                    <div class="chat-header-info" style="display: flex; flex-direction: column; align-items: flex-end; justify-content: center; padding-right: 25px; margin-bottom: 0px; margin-right: -20px; padding-bottom: 0px;">
                        <div class="chat-header-name" style="font-size: 14px; font-weight: 600; color: #333; margin-bottom: 2px;">${userName}</div>
                        <div class="chat-header-date" style="font-size: 12px; color: #888;">${dateStr} ${ampmTimeStr}</div>
                    </div>
                    <div class="chat-header-avatar" style="width: 44px; height: 44px; border-radius: 50%; overflow: hidden; border: 1px solid #eee; z-index: 2; background: #fff; flex-shrink: 0;">
                        <img src="${userAvatar}" onerror="this.src='assets/moren-thumb.jpg'" loading="lazy" decoding="async" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                </div>
            `;
        } else {
            const aiName = speakerName || friend.nickname || friend.realName || 'AI';
            const aiAvatar = speakerAvatar || friend.avatarUrl || 'assets/moren-thumb.jpg';
            return `
                <div class="chat-message-header ai-header" style="display: flex; justify-content: flex-start; width: 100%; margin-bottom: 4px; padding-left: 0px; align-items: flex-start;">
                    <div class="chat-header-avatar" style="width: 44px; height: 44px; border-radius: 50%; overflow: hidden; border: 1px solid #eee; z-index: 2; background: #fff; flex-shrink: 0;">
                        <img src="${aiAvatar}" onerror="this.src='assets/moren-thumb.jpg'" loading="lazy" decoding="async" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div class="chat-header-info" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding-left: 25px; margin-bottom: 0px; margin-left: -20px; padding-bottom: 0px;">
                        <div class="chat-header-name" style="font-size: 14px; font-weight: 600; color: #333; margin-bottom: 2px;">${aiName}</div>
                        <div class="chat-header-date" style="font-size: 12px; color: #888;">${dateStr} ${ampmTimeStr}</div>
                    </div>
                </div>
            `;
        }
    }

async function updateNarrationNoticeMessage(friend, msg, container, nextText) {
        const narrationText = String(nextText || '').trim();
        if (!friend || !msg || !narrationText) return false;

        const friendId = friend.id;
        const liveFriend = (window.imData?.friends || [])
            .find(item => String(item.id) === String(friendId)) || friend;
        const descriptor = {
            id: msg.id || null,
            timestamp: msg.timestamp || null
        };

        const saved = window.imApp?.updateFriendMessage
            ? await window.imApp.updateFriendMessage(friendId, descriptor, (targetMsg) => {
                if (!targetMsg) return;
                targetMsg.type = 'system_notice';
                targetMsg.noticeKind = 'narration';
                targetMsg.role = 'system';
                targetMsg.content = narrationText;
                targetMsg.text = narrationText;
            }, { silent: true })
            : false;

        if (!saved) {
            if (window.showToast) window.showToast('旁白保存失败');
            return false;
        }

        const updatedFriend = (window.imData?.friends || [])
            .find(item => String(item.id) === String(friendId)) || liveFriend;
        if (container && window.imChat.rerenderChatContainer) {
            window.imChat.rerenderChatContainer(updatedFriend, container, { scroll: true });
        }
        if (window.imChat.renderChatsList) {
            window.imChat.renderChatsList();
        }
        return true;
    }

async function deleteNarrationNoticeMessage(friend, msg, container) {
        if (!friend || !msg) return false;

        const friendId = friend.id;
        const liveFriend = (window.imData?.friends || [])
            .find(item => String(item.id) === String(friendId)) || friend;
        const descriptor = {
            id: msg.id || null,
            timestamp: msg.timestamp || null
        };

        let saved = false;
        if (window.imApp?.removeFriendMessages) {
            saved = await window.imApp.removeFriendMessages(friendId, descriptor, { silent: true });
        } else if (window.imApp?.commitScopedFriendChange) {
            saved = await window.imApp.commitScopedFriendChange(liveFriend, (targetFriend) => {
                if (!Array.isArray(targetFriend.messages)) return;
                targetFriend.messages = targetFriend.messages.filter((targetMsg) => {
                    if (msg.id && targetMsg?.id) return String(targetMsg.id) !== String(msg.id);
                    if (msg.timestamp && targetMsg?.timestamp) return String(targetMsg.timestamp) !== String(msg.timestamp);
                    return targetMsg !== msg;
                });
                if (window.imApp.clearFriendRuntimeMessageContext) {
                    window.imApp.clearFriendRuntimeMessageContext(targetFriend);
                }
            }, { silent: true });
        }

        if (!saved) {
            if (window.showToast) window.showToast('删除失败');
            return false;
        }

        const updatedFriend = (window.imData?.friends || [])
            .find(item => String(item.id) === String(friendId)) || liveFriend;
        if (container && window.imChat.rerenderChatContainer) {
            window.imChat.rerenderChatContainer(updatedFriend, container, { scroll: true });
        }
        if (window.imChat.renderChatsList) {
            window.imChat.renderChatsList();
        }
        return true;
    }

function openNarrationNoticeEditor(msg, friend, container) {
        if (!msg || msg.noticeKind !== 'narration') return;
        const currentText = msg.content || msg.text || '';

        const resetPromptLayout = () => {
            const inputGroup = document.getElementById('modal-input-group');
            const textareaGroup = document.getElementById('modal-textarea-group');
            const textarea = document.getElementById('modal-textarea');
            const deleteBtn = document.getElementById('modal-narration-delete-btn');
            if (inputGroup) inputGroup.style.display = 'block';
            if (textareaGroup) textareaGroup.style.display = 'none';
            if (textarea) textarea.value = '';
            if (deleteBtn) deleteBtn.remove();
        };

        if (!window.showCustomModal) {
            const nextText = window.prompt ? window.prompt('编辑旁白/动描', currentText) : null;
            if (nextText !== null) {
                void updateNarrationNoticeMessage(friend, msg, container, nextText);
            }
            return;
        }

        window.showCustomModal({
            type: 'prompt',
            title: '编辑旁白/动描',
            placeholder: '修改旁白/动描...',
            confirmText: '保存',
            confirmTone: 'dark',
            defaultValue: currentText,
            onCancel: resetPromptLayout,
            onConfirm: async (newValue) => {
                const textarea = document.getElementById('modal-textarea');
                const textareaGroup = document.getElementById('modal-textarea-group');
                const finalValue = textarea && textareaGroup && textareaGroup.style.display !== 'none'
                    ? textarea.value
                    : newValue;
                if (!String(finalValue || '').trim()) {
                    if (window.showToast) window.showToast('请输入旁白/动描内容');
                    resetPromptLayout();
                    return;
                }
                await updateNarrationNoticeMessage(friend, msg, container, finalValue);
                resetPromptLayout();
            }
        });

        setTimeout(() => {
            const inputGroup = document.getElementById('modal-input-group');
            const textareaGroup = document.getElementById('modal-textarea-group');
            const textarea = document.getElementById('modal-textarea');
            if (inputGroup) inputGroup.style.display = 'none';
            if (textareaGroup) textareaGroup.style.display = 'block';
            if (textarea) {
                textarea.placeholder = '修改旁白/动描...';
                textarea.value = currentText;
                textarea.focus();
            }

            const modalTitle = document.getElementById('modal-title');
            const modalHeader = modalTitle?.closest('.wb-centered-modal-header') || null;
            if (modalHeader && !document.getElementById('modal-narration-delete-btn')) {
                modalHeader.style.position = 'relative';
                const deleteBtn = document.createElement('button');
                deleteBtn.id = 'modal-narration-delete-btn';
                deleteBtn.type = 'button';
                deleteBtn.setAttribute('aria-label', '删除旁白/动描');
                deleteBtn.title = '删除旁白/动描';
                deleteBtn.style.cssText = 'position:absolute; right:16px; top:50%; transform:translateY(-50%); width:32px; height:32px; border:none; border-radius:16px; background:#ffe5e5; color:#ff3b30; display:flex; align-items:center; justify-content:center; font-size:15px; cursor:pointer;';
                deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
                deleteBtn.addEventListener('click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (window.confirm && !window.confirm('确定删除这条旁白/动描并清理上下文吗？')) return;
                    deleteBtn.style.pointerEvents = 'none';
                    deleteBtn.style.opacity = '0.65';
                    const saved = await deleteNarrationNoticeMessage(friend, msg, container);
                    if (saved) {
                        resetPromptLayout();
                        if (window.closeCustomModal) window.closeCustomModal(false);
                        if (window.showToast) window.showToast('已删除旁白/动描');
                        return;
                    }
                    deleteBtn.style.pointerEvents = '';
                    deleteBtn.style.opacity = '';
                });
                modalHeader.appendChild(deleteBtn);
            }
        }, 10);
    }

function openRecalledMessageDetail(content, translation = '') {
        const modal = document.getElementById('recalled-message-detail-modal');
        const contentEl = document.getElementById('recalled-message-detail-content');
        const translationEl = document.getElementById('recalled-message-detail-translation');
        const translateBtn = document.getElementById('recalled-message-detail-translate');
        const closeBtn = document.getElementById('recalled-message-detail-close');
        if (!modal || !contentEl) return false;

        contentEl.textContent = String(content || '');
        const translatedText = String(translation || '').trim();
        if (translationEl) {
            translationEl.textContent = translatedText;
            translationEl.hidden = true;
        }
        if (translateBtn) {
            translateBtn.hidden = !translatedText;
            translateBtn.textContent = '翻译';
            translateBtn.setAttribute('aria-expanded', 'false');
            translateBtn.onclick = () => {
                if (!translationEl || !translatedText) return;
                const willShow = translationEl.hidden;
                translationEl.hidden = !willShow;
                translateBtn.textContent = willShow ? '收起翻译' : '翻译';
                translateBtn.setAttribute('aria-expanded', willShow ? 'true' : 'false');
            };
        }

        const closeModal = () => {
            if (window.closeView) window.closeView(modal);
            else modal.classList.remove('active');
        };

        if (closeBtn && closeBtn.dataset.bound !== 'true') {
            closeBtn.dataset.bound = 'true';
            closeBtn.addEventListener('click', closeModal);
        }
        if (modal.dataset.bound !== 'true') {
            modal.dataset.bound = 'true';
            modal.addEventListener('click', (event) => {
                if (event.target === modal) closeModal();
            });
        }

        if (window.openView) window.openView(modal);
        else modal.classList.add('active');
        return true;
    }

function renderSystemNoticeBubble(msg, friend, container, timestamp = Date.now()) {
        const row = document.createElement('div');
        row.className = 'chat-system-row';
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'notice'));
        const noticeKind = msg.noticeKind || '';
        const noticeText = msg.text || msg.content || '系统提示';
        if (noticeKind === 'message_recalled') {
            const isUserRecall = msg.actorRole === 'user';
            const actorName = String(msg.actorName || friend?.nickname || friend?.realName || '对方').trim();
            const label = isUserRecall ? '你撤回了一条消息' : `${actorName}撤回了一条消息`;
            const recalledContent = !isUserRecall
                ? String(msg.payload?.recalledContent || '').trim()
                : '';
            const recalledTranslation = !isUserRecall
                ? String(msg.payload?.recalledTranslation || '').trim()
                : '';
            row.innerHTML = `
                <div class="message-recalled-notice">
                    <span>${escapeHtml(label)}</span>${recalledContent ? '<span class="message-recalled-view-link">查看</span>' : ''}
                </div>
            `;
            const viewLink = row.querySelector('.message-recalled-view-link');
            if (viewLink) {
                viewLink.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openRecalledMessageDetail(recalledContent, recalledTranslation);
                });
            }
            container.appendChild(row);
            window.imChat.scrollToBottom(container);
            return row;
        }
        const iconMap = {
            group_left: { icon: 'fa-sign-out-alt', color: '#ff3b30' },
            group_rejoined: { icon: 'fa-sign-in-alt', color: '#34c759' },
            narration: { icon: 'fa-quote-left', color: '#5856d6' },
            red_packet_claim: { icon: 'fa-envelope-open-text', color: '#ff9500' },
            offline_meeting_active: { icon: 'fa-user-friends', color: '#34c759' },
            group_private_to_user: { icon: 'fa-envelope', color: '#007aff' },
            group_friend_private_chat: { icon: 'fa-comments', color: '#5856d6' }
        };
        const iconMeta = iconMap[noticeKind] || { icon: 'fa-info-circle', color: '#8e8e93' };
        const textAlign = noticeKind === 'narration' ? 'left' : 'center';
        const noticeBody = noticeKind === 'group_friend_private_chat'
            ? `<span>${escapeHtml(noticeText)}</span><span class="group-private-chat-view-link">查看</span>`
            : `<span>${escapeHtml(noticeText)}</span>`;
        row.innerHTML = `
            <div style="width:100%; display:flex; justify-content:center; padding:2px 0; margin:10px 0;">
                <div class="voice-call-record-card im-card-content system-notice-card system-notice-${escapeHtml(noticeKind || 'default')}" style="max-width:80%; padding:10px 16px; border-radius:18px; background:rgba(0,0,0,0.05); color:#000; font-size:13px; line-height:1.4; text-align:${textAlign}; display:flex; align-items:flex-start; gap:8px; white-space:pre-wrap; word-break:break-word; ${noticeKind === 'narration' ? 'cursor:pointer;' : ''}">
                    <i class="fas ${iconMeta.icon}" style="color:${iconMeta.color}; line-height:1.4; flex-shrink:0;"></i>
                    <span style="display:inline-flex; align-items:center; flex-wrap:wrap; justify-content:center;">${noticeBody}</span>
                </div>
            </div>
        `;
        if (noticeKind === 'narration') {
            const card = row.querySelector('.system-notice-card');
            if (card) {
                card.title = '点击编辑旁白';
                card.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openNarrationNoticeEditor(msg, friend, container);
                });
            }
        }
        if (noticeKind === 'group_friend_private_chat') {
            const viewLink = row.querySelector('.group-private-chat-view-link');
            if (viewLink) {
                viewLink.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (window.imApp?.openGroupPrivateChatDetail) {
                        window.imApp.openGroupPrivateChatDetail(
                            msg.privateChatSnapshot || msg.payload?.privateChatSnapshot
                        );
                    }
                });
            }
        }
        container.appendChild(row);
        window.imChat.scrollToBottom(container);
    }

function renderGroupRedPacketBubble(msg, friend, container, timestamp = Date.now()) {
        window.imChat.normalizeGroupRedPacketState(msg, friend);

        const isUser = msg.role === 'user';
        const isGroupMessage = friend.type === 'group' && !isUser;
        const groupIdentity = resolveGroupBubbleIdentity(friend, msg);
        const speakerName = groupIdentity.name;
        const speakerAvatar = groupIdentity.avatarUrl;

        const lastRow = container.lastElementChild;
        let hasPrev = false;
        let sameSpeaker = false;

        if (lastRow) {
            if (isUser && lastRow.classList.contains('user-row')) {
                hasPrev = true;
                lastRow.classList.add('has-next');
            } else if (!isUser && lastRow.classList.contains('ai-row')) {
                const prevSpeaker = lastRow.getAttribute('data-speaker') || null;
                if (isGroupMessage) {
                    if (prevSpeaker === speakerName) {
                        hasPrev = true;
                        sameSpeaker = true;
                        lastRow.classList.add('has-next');
                    }
                } else if (!prevSpeaker) {
                    hasPrev = true;
                    sameSpeaker = true;
                    lastRow.classList.add('has-next');
                }
            }
        }

        const row = document.createElement('div');
        row.className = `chat-row ${isUser ? 'user-row' : 'ai-row'} ${hasPrev ? 'has-prev' : ''} ${isGroupMessage ? 'group-ai-row' : ''} ${isGroupMessage && sameSpeaker ? 'group-ai-row-continuous' : ''}`;
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'packet'));
        if (speakerName) {
            row.setAttribute('data-speaker', speakerName);
        }
        if (groupIdentity.memberId !== '') {
            row.setAttribute('data-speaker-member-id', String(groupIdentity.memberId));
        }
        setGroupUserRowIdentity(row, friend, msg);

        const totalAmount = Number(msg.totalAmount) || 0;
        const packetCount = parseInt(msg.packetCount, 10) || 0;
        const claimedCount = Array.isArray(msg.claimRecords) ? msg.claimRecords.length : 0;
        const subtitle = msg.currentUserClaimed
            ? `已领取 · ${claimedCount}/${packetCount}`
            : (msg.isFinished ? `${claimedCount}/${packetCount} 已领取` : '点击领取红包');

        const contentHtml = `
            <div class="group-red-packet-card im-card-content" style="width:100%; min-width:0; max-width:268px; border-radius:18px; padding:12px 14px; background:#fff; color:#111;  border:1px solid rgba(0,0,0,0.08); cursor:pointer;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:40px; height:40px; border-radius:14px; background:#111; color:#fff; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0;">
                        <i class="fas fa-gift"></i>
                    </div>
                    <div style="min-width:0; flex:1;">
                        <div style="font-size:15px; font-weight:800; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${msg.description || '恭喜发财'}</div>
                        <div style="font-size:12px; color:#8e8e93; margin-top:4px;">${subtitle}</div>
                    </div>
                </div>
                <div style="margin-top:10px; font-size:26px; font-weight:800; color:#111; letter-spacing:0.2px;">¥${totalAmount.toFixed(2)}</div>
            </div>
        `;

        const timeStr = typeof window.formatChatBubbleTime === 'function' ? window.formatChatBubbleTime(timestamp) : (() => {
            const date = new Date(timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        })();

        const headerHtml = buildMessageHeaderHtml(isUser, friend, timestamp, speakerName, speakerAvatar, hasPrev, msg);

        if (isUser) {
            const metaHtml = "";
            row.innerHTML = `
                <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                    <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                    ${headerHtml}
                    <div style="display: flex; justify-content: flex-end; align-items: flex-end; width: 100%;">
                        <div class="chat-bubble user-bubble im-card-bubble pay-transfer-bubble group-red-packet-bubble" style="padding:6px;">${contentHtml}${metaHtml}</div>
                    </div>
                </div>
            `;
        } else {
            const metaHtml = "";
            
            let bubbleWrapperHtml = '';
            if (isGroupMessage) {
                const avatarInitial = String(speakerName).trim().charAt(0) || '?';
                const avatarImg = speakerAvatar
                    ? `<img src="${speakerAvatar}" onerror="this.src='assets/moren-thumb.jpg'" loading="lazy" decoding="async" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;">`
                    : `<div class="chat-avatar-small">${avatarInitial}</div>`;

                bubbleWrapperHtml = `
                    <div class="group-ai-bubble-wrap">
                        ${sameSpeaker ? '' : `<div class="group-ai-speaker-name">${speakerName}</div>`}
                        <div class="group-ai-bubble-row">
                            <div class="group-ai-avatar-slot">${sameSpeaker ? '<div class="group-ai-avatar-placeholder"></div>' : avatarImg}</div>
                            <div class="chat-bubble ai-bubble im-card-bubble pay-transfer-bubble group-red-packet-bubble" style="padding:6px;">${contentHtml}${metaHtml}</div>
                        </div>
                    </div>
                `;
            } else {
                bubbleWrapperHtml = `<div class="chat-bubble ai-bubble im-card-bubble pay-transfer-bubble group-red-packet-bubble" style="padding:6px;">${contentHtml}${metaHtml}</div>`;
            }

            row.innerHTML = `
                <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                    <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                    ${headerHtml}
                    <div style="display: flex; justify-content: flex-start; align-items: flex-end; width: 100%;">
                        ${bubbleWrapperHtml}
                    </div>
                </div>
            `;
        }

        const clickableBubble = row.querySelector('.group-red-packet-card');
        if (clickableBubble) {
            clickableBubble.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const activePage = container.closest('.active-chat-interface');
                if (!activePage) return;
                if (!activePage._openGroupRedPacketInteraction) {
                    window.imChat.ensureRedPacketDetailOverlayForExistingPage(activePage, friend);
                }
                if (activePage._openGroupRedPacketInteraction) {
                    activePage._openGroupRedPacketInteraction(msg);
                }
            });
        }

        container.appendChild(row);
        window.imChat.scrollToBottom(container);
    }

    function renderGroupPollBubble(msg, friend, container, timestamp = Date.now()) {
        if (!msg || !friend || friend.type !== 'group' || !container) return;
        const options = Array.isArray(msg.pollOptions) ? msg.pollOptions : [];
        const votes = Array.isArray(msg.pollVotes) ? msg.pollVotes : [];
        const userVote = votes.find(vote => vote?.voterType === 'user');
        const status = String(msg.pollStatus || 'completed');
        const messageId = window.imChat.ensureMessageId(msg, 'poll');

        const optionHtml = options.map(option => {
            const optionId = String(option?.id || '');
            const optionVotes = votes.filter(vote => String(vote?.optionId || '') === optionId);
            const voterHtml = optionVotes.map(vote => {
                const isUser = vote?.voterType === 'user';
                const member = isUser
                    ? null
                    : (window.imData?.friends || []).find(item => String(item.id) === String(vote?.voterId));
                const profile = isUser ? getEffectiveUserProfile(friend, msg) : null;
                const voterName = vote?.voterName || member?.nickname || member?.realName || (isUser ? profile?.name : '群成员');
                const avatarUrl = vote?.voterAvatarUrl || member?.avatarUrl || profile?.avatarUrl || 'assets/moren-thumb.jpg';
                return `<span class="group-poll-voter"><img src="${escapeHtml(avatarUrl)}" alt="">${escapeHtml(voterName)}</span>`;
            }).join('');
            return `
                <button type="button" class="group-poll-card-option${String(userVote?.optionId || '') === optionId ? ' is-user-selected' : ''}" data-poll-option-id="${escapeHtml(optionId)}">
                    <span class="group-poll-card-option-main">
                        <span class="group-poll-radio"></span>
                        <span class="group-poll-option-text">${escapeHtml(option?.text || '')}</span>
                        <span class="group-poll-option-count">${optionVotes.length} 票</span>
                    </span>
                    ${voterHtml ? `<span class="group-poll-voters">${voterHtml}</span>` : ''}
                </button>
            `;
        }).join('');

        let statusText = `${votes.length} 人已投`;
        if (status === 'idle') {
            statusText = userVote ? '已选择，发送群聊回复后角色会投票' : '请选择你的选项';
        } else if (status === 'pending') {
            statusText = '等待群聊回复';
        } else if (status === 'error') {
            statusText = userVote ? '已选择，发送群聊回复后角色会投票' : '请选择你的选项';
        }

        const row = document.createElement('div');
        row.className = 'chat-row user-row group-poll-row';
        row.setAttribute('data-timestamp', String(timestamp));
        row.setAttribute('data-message-id', messageId);
        setGroupUserRowIdentity(row, friend, msg);
        row.innerHTML = `
            <div class="chat-checkbox-wrapper" style="display:${window.imData.batchSelectMode ? 'flex' : 'none'};width:40px;justify-content:center;align-items:flex-end;padding-bottom:10px;flex-shrink:0;cursor:pointer;transition:all .2s;">
                <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color:#c7c7cc;font-size:22px;"></i>
            </div>
            <div style="flex:1;display:flex;justify-content:flex-end;min-width:0;">
                <div class="chat-bubble user-bubble im-card-bubble" style="padding:0;background:transparent;">
                    <div class="group-poll-card">
                        <div class="group-poll-card-head">
                            <div class="group-poll-card-kicker"><i class="fas fa-poll-h"></i> 群投票 · 公开单选</div>
                            <div class="group-poll-card-title">${escapeHtml(msg.pollQuestion || '群投票')}</div>
                        </div>
                        <div class="group-poll-card-options">${optionHtml}</div>
                        <div class="group-poll-card-footer"><span>${statusText}</span></div>
                    </div>
                </div>
            </div>
        `;

        row.querySelectorAll('.group-poll-card-option').forEach(button => {
            button.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                const optionId = button.getAttribute('data-poll-option-id') || '';
                if (optionId && window.imChat?.selectGroupPollOption) {
                    window.imChat.selectGroupPollOption(friend.id, messageId, optionId);
                }
            });
        });
        container.appendChild(row);
    }

    function renderCotSummaryCard(msg, friend, container) {
        const cotSummary = typeof msg?.cotSummary === 'string' ? msg.cotSummary.trim() : '';
        if (!cotSummary || !friend || friend.type === 'group' || !container) return null;

        const cotKey = String(msg.apiRunId || msg.id || '').trim();
        if (cotKey) {
            const duplicate = Array.from(container.querySelectorAll('.chat-cot-row'))
                .some(row => row.dataset.cotKey === cotKey);
            if (duplicate) return null;
        }

        const row = document.createElement('div');
        row.className = 'chat-cot-row';
        if (cotKey) row.dataset.cotKey = cotKey;

        const card = document.createElement('section');
        card.className = 'chat-cot-card';
        const contentId = `chat-cot-content-${String(msg.id || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '')}`;

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'chat-cot-toggle';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', contentId);
        toggle.innerHTML = '<span class="chat-cot-title"><span>COT</span></span><i class="fas fa-chevron-down chat-cot-chevron" aria-hidden="true"></i>';

        const content = document.createElement('div');
        content.id = contentId;
        content.className = 'chat-cot-content';
        content.hidden = true;
        content.textContent = cotSummary;

        toggle.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const expanded = toggle.getAttribute('aria-expanded') !== 'true';
            toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            card.classList.toggle('is-expanded', expanded);
            content.hidden = !expanded;
        });

        card.append(toggle, content);
        row.appendChild(card);

        const placeBelowAvatar = () => {
            const messageId = String(msg.id || '');
            const messageRow = Array.from(container.children)
                .find(child => String(child.getAttribute?.('data-message-id') || '') === messageId);
            const messageColumn = messageRow?.classList?.contains('ai-row') ? messageRow.children?.[1] : null;
            const bubbleLine = messageColumn?.lastElementChild;

            if (messageColumn && bubbleLine) {
                row.classList.add('chat-cot-row-inline');
                messageColumn.insertBefore(row, bubbleLine);
            } else if (messageRow?.parentNode === container) {
                messageRow.insertAdjacentElement('afterend', row);
            } else {
                container.appendChild(row);
            }
        };

        if (typeof queueMicrotask === 'function') {
            queueMicrotask(placeBelowAvatar);
        } else {
            Promise.resolve().then(placeBelowAvatar);
        }
        return row;
    }

function renderMessageBubble(msg, friend, container, timestamp = Date.now()) {
        if (!msg || !container) return false;

        if (friend && typeof friend === 'object') renderMessageContextByFriend.set(friend, msg);
        window.imChat.ensureMessageId(msg, msg.type === 'pay_transfer' ? 'pay' : 'msg');
        const msgTime = timestamp || msg.timestamp || Date.now();
        renderCotSummaryCard(msg, friend, container);

        if (msg.type === 'group_poll') {
            renderGroupPollBubble(msg, friend, container, msgTime);
            return finalizeRenderedMessage(msg, friend, container);
        }
        if (msg.type === 'chat_record_forward') {
            window.imChat.renderChatRecordForwardBubble(msg, friend, container, msgTime);
            return finalizeRenderedMessage(msg, friend, container);
        }
        if (msg.type === 'moment_forward') {
            window.imChat.renderMomentForwardBubble(msg, friend, container, msgTime);
            return finalizeRenderedMessage(msg, friend, container);
        }
        if (msg.type === 'voice_call_record') {
            window.imChat.renderVoiceCallRecordBubble(msg, friend, container, msgTime);
            return finalizeRenderedMessage(msg, friend, container);
        }
        if (msg.type === 'offline_meeting_record') {
            window.imChat.renderOfflineMeetingRecordBubble(msg, friend, container, msgTime);
            return finalizeRenderedMessage(msg, friend, container);
        }
        if (msg.type === 'voice_message') {
            window.imChat.renderVoiceMessageBubble(msg, friend, container, msgTime);
            return finalizeRenderedMessage(msg, friend, container);
        }
        if (msg.type === 'sticker') {
            window.imChat.renderStickerMessageBubble(msg, friend, container, msgTime);
            return finalizeRenderedMessage(msg, friend, container);
        }
        if (msg.type === 'fake_link') {
            window.imChat.renderFakeLinkBubble(msg, friend, container, msgTime);
            return finalizeRenderedMessage(msg, friend, container);
        }
        if (msg.type === 'image') {
            window.imChat.renderImageBubble(msg, friend, container, msgTime);
            return finalizeRenderedMessage(msg, friend, container);
        }
        if (msg.type === 'pay_transfer') {
            window.imChat.renderPayTransferBubble(msg, friend, container, msgTime);
            return finalizeRenderedMessage(msg, friend, container);
        }
        if (msg.type === 'group_red_packet') {
            window.imChat.renderGroupRedPacketBubble(msg, friend, container, msgTime);
            return finalizeRenderedMessage(msg, friend, container);
        }
        if (msg.type === 'system_notice') {
            window.imChat.renderSystemNoticeBubble(msg, friend, container, msgTime);
            return true;
        }
        if (msg.type === 'html') {
            window.imChat.renderHtmlBubble(msg, friend, container, msgTime);
            return finalizeRenderedMessage(msg, friend, container);
        }
        if (msg.role === 'user') {
            window.imChat.renderUserBubble(msg.content, container, msgTime, msg.replyTo, msg.translation, msg.showTranslation, msg.id, friend, msg);
            return finalizeRenderedMessage(msg, friend, container);
        }
        if (msg.role === 'assistant') {
            let safeSpeakerName = msg.speaker || msg.senderName || null;
            let speakerAvatar = msg.senderAvatarUrl || null;

            if (friend.type === 'group') {
                const groupIdentity = resolveGroupBubbleIdentity(friend, msg);
                safeSpeakerName = groupIdentity.name;
                speakerAvatar = groupIdentity.avatarUrl;
            }

            window.imChat.renderAiBubble(
                msg.content,
                friend,
                container,
                msgTime,
                msg.translation,
                msg.showTranslation,
                msg.replyTo,
                safeSpeakerName,
                speakerAvatar,
                msg.id,
                msg.thought || null,
                msg.offlineScene || null,
                msg.offlineAction || null,
                msg.speakerMemberId || msg.senderMemberId || null
            );
            return finalizeRenderedMessage(msg, friend, container);
        }

        return false;
    }

    function getMessageUserRoundCount(messages, startIndex = 0, endIndex = null) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        let count = 0;
        const start = Math.max(0, Number(startIndex) || 0);
        const end = Math.min(safeMessages.length, Math.max(start, endIndex == null ? safeMessages.length : Number(endIndex) || safeMessages.length));

        for (let i = start; i < end; i += 1) {
            if (safeMessages[i] && safeMessages[i].role === 'user') count += 1;
        }

        return count;
    }

    function getHistoryStartIndexForUserRounds(messages, userRoundLimit) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        const limit = Math.max(0, Number(userRoundLimit) || 0);
        if (limit <= 0 || safeMessages.length === 0) return 0;

        let rounds = 0;
        for (let i = safeMessages.length - 1; i >= 0; i -= 1) {
            if (safeMessages[i] && safeMessages[i].role === 'user') {
                rounds += 1;
                if (rounds >= limit) return i;
            }
        }

        return 0;
    }

    function getExpandedHistoryStartIndex(messages, currentStartIndex, additionalUserRounds) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        const currentStart = Math.max(0, Math.min(safeMessages.length, Number(currentStartIndex) || 0));
        const additionalRounds = Math.max(1, Number(additionalUserRounds) || HISTORY_LOAD_MORE_USER_ROUNDS);
        let rounds = 0;

        for (let i = currentStart - 1; i >= 0; i -= 1) {
            if (safeMessages[i] && safeMessages[i].role === 'user') {
                rounds += 1;
                if (rounds >= additionalRounds) return i;
            }
        }

        return 0;
    }

    function getInitialHistoryStartIndex(messages) {
        return getHistoryStartIndexForUserRounds(messages, INITIAL_HISTORY_USER_ROUNDS);
    }

    function clampHistoryStartIndex(messages, startIndex) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        return Math.max(0, Math.min(safeMessages.length, Number(startIndex) || 0));
    }

    function getChatHistoryState(friend, container, messages, options = {}) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        const friendId = friend && friend.id != null ? String(friend.id) : '';
        const previousState = container ? container._imHistoryState : null;
        let visibleStartIndex;

        if (options.resetWindow) {
            visibleStartIndex = getInitialHistoryStartIndex(safeMessages);
        } else if (Number.isFinite(Number(options.startIndex))) {
            visibleStartIndex = clampHistoryStartIndex(safeMessages, options.startIndex);
        } else if (previousState && previousState.friendId === friendId && Number.isFinite(Number(previousState.visibleStartIndex))) {
            visibleStartIndex = clampHistoryStartIndex(safeMessages, previousState.visibleStartIndex);
        } else {
            visibleStartIndex = getInitialHistoryStartIndex(safeMessages);
        }

        const state = {
            friendId,
            visibleStartIndex,
            totalMessages: safeMessages.length
        };

        if (container) container._imHistoryState = state;
        return state;
    }

    function renderLoadMoreHistoryControl(friend, container, messages, state) {
        if (!container || !state || state.visibleStartIndex <= 0) return;

        const hiddenMessageCount = state.visibleStartIndex;
        const hiddenUserRounds = getMessageUserRoundCount(messages, 0, state.visibleStartIndex);
        const wrapper = document.createElement('div');
        wrapper.className = 'chat-history-loader';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chat-history-load-more-btn';
        button.innerHTML = `
            <span class="chat-history-load-more-title">查看更多历史记录</span>
            <span class="chat-history-load-more-meta">${hiddenUserRounds}轮 / ${hiddenMessageCount}条更早消息</span>
        `;

        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const latestMessages = Array.isArray(friend.messages) ? friend.messages : [];
            const currentState = container._imHistoryState || state;
            const previousScrollHeight = container.scrollHeight;
            const previousScrollTop = container.scrollTop;
            const nextStartIndex = getExpandedHistoryStartIndex(
                latestMessages,
                currentState.visibleStartIndex,
                HISTORY_LOAD_MORE_USER_ROUNDS
            );

            container.innerHTML = '';
            renderChatHistory(friend, container, {
                startIndex: nextStartIndex,
                scroll: false
            });

            const heightDelta = container.scrollHeight - previousScrollHeight;
            container.scrollTop = previousScrollTop + heightDelta;
        });

        wrapper.appendChild(button);
        container.appendChild(wrapper);
    }

    function getChatHistoryRenderKey(friend) {
        const messages = Array.isArray(friend?.messages) ? friend.messages : [];
        const lastMessage = messages[messages.length - 1] || null;
        const recallPresentation = friend?.memory?.recallPresentation || null;
        return [
            String(friend?.id ?? ''),
            messages.length,
            String(lastMessage?.id ?? ''),
            Number(lastMessage?.timestamp) || 0,
            String(lastMessage?.content ?? lastMessage?.text ?? ''),
            lastMessage?.showTranslation ? 1 : 0,
            friend?.showTimestamp ? 1 : 0,
            String(friend?.timestampPosition || ''),
            String(recallPresentation?.apiRunId || ''),
            String(recallPresentation?.triggerUserMessageId || '')
        ].join('\u0001');
    }

    function markChatHistoryRenderCurrent(friend, container) {
        if (container) container._imHistoryRenderKey = getChatHistoryRenderKey(friend);
    }

    function isChatHistoryRenderCurrent(friend, container) {
        return !!container
            && container.childElementCount > 0
            && container._imHistoryRenderKey === getChatHistoryRenderKey(friend);
    }

    function appendMessageToContainer(friend, container, msg, options = {}) {
        if (!friend || !container || !msg) return false;

        const msgTime = msg.timestamp || Date.now();
        const rows = Array.from(container.children);
        let lastMessageTimestamp = 0;

        for (let i = rows.length - 1; i >= 0; i -= 1) {
            const row = rows[i];
            if (!row || !row.classList || !row.classList.contains('chat-row')) continue;
            lastMessageTimestamp = Number(row.getAttribute('data-timestamp')) || 0;
            if (lastMessageTimestamp) break;
        }

        if (!lastMessageTimestamp || msgTime - lastMessageTimestamp > 300000) {
            window.imChat.renderTimestamp(msgTime, container);
        }

        const rendered = renderMessageBubble(msg, friend, container, msgTime);
        if (rendered && container._imHistoryState && container._imHistoryState.friendId === String(friend.id)) {
            container._imHistoryState.totalMessages = Array.isArray(friend.messages) ? friend.messages.length : container._imHistoryState.totalMessages;
        }
        if (rendered) markChatHistoryRenderCurrent(friend, container);
        if (rendered && options.scroll !== false) {
            window.imChat.scrollToBottom(container);
        }
        return rendered;
    }

    function rerenderChatContainer(friend, container, options = {}) {
        if (!friend || !container) return false;
        container.innerHTML = '';
        window.imChat.renderChatHistory(friend, container, {
            resetWindow: !!options.resetWindow,
            scroll: false
        });
        if (options.scroll !== false) {
            window.imChat.scrollToBottom(container);
        }
        return true;
    }

    function findMessageRow(container, descriptor) {
        if (!container || descriptor == null) return null;

        const descriptorId = typeof descriptor === 'object' && descriptor !== null && descriptor.id != null
            ? String(descriptor.id)
            : (typeof descriptor !== 'object' && descriptor != null ? String(descriptor) : null);
        const descriptorTimestamp = typeof descriptor === 'object' && descriptor !== null && descriptor.timestamp != null
            ? String(descriptor.timestamp)
            : null;

        if (descriptorId) {
            const rowById = container.querySelector(`.chat-row[data-message-id="${descriptorId}"]`);
            if (rowById) return rowById;
        }

        if (descriptorTimestamp) {
            const rows = Array.from(container.querySelectorAll('.chat-row'));
            return rows.find(row => String(row.getAttribute('data-timestamp') || '') === descriptorTimestamp) || null;
        }

        return null;
    }

    function replaceMessageInContainer(friend, container, msg, descriptor, options = {}) {
        if (!friend || !container || !msg) return false;
        return rerenderChatContainer(friend, container, options);
    }

    function removeMessageFromContainer(container, descriptor, options = {}) {
        if (!container) return false;
        const targetRow = findMessageRow(container, descriptor);
        if (!targetRow) return false;

        const previousElement = targetRow.previousElementSibling;
        const nextElement = targetRow.nextElementSibling;
        targetRow.remove();

        if (
            previousElement &&
            previousElement.classList &&
            previousElement.classList.contains('chat-timestamp') &&
            (!nextElement || !nextElement.classList || !nextElement.classList.contains('chat-row'))
        ) {
            previousElement.remove();
        }

        if (options.scroll) {
            window.imChat.scrollToBottom(container);
        }
        return true;
    }

function renderChatHistory(friend, container, options = {}) {
        if (!friend || !container) return;
        syncGroupUserAvatarState(friend, container);

        const messages = Array.isArray(friend.messages) ? friend.messages : [];
        const state = getChatHistoryState(friend, container, messages, options);
        let lastTime = 0;
        const recallPresentation = friend.memory?.recallPresentation || null;
        const recallApiRunId = String(recallPresentation?.apiRunId || '');
        const triggerUserMessageId = String(recallPresentation?.triggerUserMessageId || '');
        const triggerMessageExists = !triggerUserMessageId || messages.some(message => (
            message?.role === 'user' && String(message.id || '') === triggerUserMessageId
        ));
        const recallAnchorMessage = recallApiRunId && triggerMessageExists
            ? messages.find(message => (
                message?.role === 'assistant' && String(message.apiRunId || '') === recallApiRunId
            ))
            : null;

        try {
            container._imIsRenderingHistory = true;
            renderLoadMoreHistoryControl(friend, container, messages, state);

            if (messages.length > 0) {
                messages.slice(state.visibleStartIndex).forEach(msg => {
                    window.imChat.ensureMessageId(msg, msg.type === 'pay_transfer' ? 'pay' : 'msg');
                    const msgTime = msg.timestamp || 0;
                    if (msgTime - lastTime > 300000) { 
                        window.imChat.renderTimestamp(msgTime, container);
                        lastTime = msgTime;
                    }
                    if (msg === recallAnchorMessage && window.imChat.renderMemoryRecallPresentation) {
                        window.imChat.renderMemoryRecallPresentation(friend, container, recallPresentation);
                    }
                    renderMessageBubble(msg, friend, container, msgTime);
                });
            }
        } finally {
            container._imIsRenderingHistory = false;
        }

        if (window.imChat.syncBatchSelectionUi) {
            window.imChat.syncBatchSelectionUi(friend, container.closest('.active-chat-interface'));
        }

        if (options.scroll !== false) {
            window.imChat.scrollToBottom(container);
        }
        markChatHistoryRenderCurrent(friend, container);
    }

function scrollToBottom(container) {
        if(container && !container._imIsRenderingHistory) container.scrollTop = container.scrollHeight;
    }

function renderTimestamp(timestamp, container) {
        if (!timestamp) return;
        const div = document.createElement('div');
        div.className = 'chat-timestamp';
        let timeStr = window.imApp.formatTime ? window.imApp.formatTime(timestamp) : '';
        div.innerHTML = `<span>${timeStr}</span>`;
        container.appendChild(div);
    }


function renderUserBubble(text, container, timestamp = Date.now(), replyTo = null, translation = null, showTranslation = false, messageId = null, friend = null, message = null) {
        const rows = Array.from(container.children).filter(el => el.classList.contains('chat-row') && !el.classList.contains('typing-row'));
        const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
        let hasPrev = false;
        if (lastRow && lastRow.classList.contains('user-row')) {
            hasPrev = true;
            lastRow.classList.add('has-next');
        }

        const userMessage = message || { role: 'user' };
        const headerHtml = buildMessageHeaderHtml(true, friend, timestamp, null, null, hasPrev, userMessage);

        const row = document.createElement('div');
        row.className = `chat-row user-row ${hasPrev ? 'has-prev' : ''}`;
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', messageId || window.imChat.createMessageId('msg'));
        setGroupUserRowIdentity(row, friend, userMessage);
        
        let contentHtml = '';
        if (replyTo) {
            contentHtml += `<div class="msg-reply-quote" style="font-size: 13px; color: rgba(255,255,255,0.85); background: rgba(255,255,255,0.15); padding: 8px 12px; border-radius: 14px; margin-bottom: 8px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${replyTo}</div>`;
        }
        contentHtml += text;
        if (translation && showTranslation) {
            contentHtml += `<div class="msg-translation" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.4; word-wrap: break-word; white-space: normal;">${translation}</div>`;
        }

        const timeStr = typeof window.formatChatBubbleTime === 'function' ? window.formatChatBubbleTime(timestamp) : (() => {
            const date = new Date(timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        })();
        contentHtml += `<span class="bubble-meta"><span class="bubble-time">${timeStr}</span><i class="fas fa-check bubble-read-icon"></i></span>`;

        row.innerHTML = `
            <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                ${headerHtml}
                <div style="display: flex; justify-content: flex-end; align-items: flex-end; width: 100%;">
                    <div class="chat-bubble user-bubble">${contentHtml}</div>
                </div>
            </div>
        `;
        container.appendChild(row);
        decorateMessageRowAvatar(row, friend, userMessage);
        window.imChat.scrollToBottom(container);
    }

    function renderAiBubble(text, friend, container, timestamp = Date.now(), translation = null, showTranslation = false, replyTo = null, speakerName = null, speakerAvatar = null, messageId = null, thought = null, offlineScene = null, offlineAction = null, speakerMemberId = null) {
        const rows = Array.from(container.children).filter(el => !el.classList.contains('chat-timestamp') && !el.classList.contains('typing-row'));
        const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
        const isGroupMessage = friend.type === 'group' && !!speakerName;
        let hasPrev = false;
        let sameSpeaker = false;

        if (lastRow && lastRow.classList.contains('ai-row')) {
            const prevSpeaker = lastRow.getAttribute('data-speaker') || null;
            if (isGroupMessage) {
                if (prevSpeaker === speakerName) {
                    hasPrev = true;
                    sameSpeaker = true;
                    lastRow.classList.add('has-next');
                }
            } else if (!prevSpeaker) {
                hasPrev = true;
                sameSpeaker = true;
                lastRow.classList.add('has-next');
            }
        }

        const row = document.createElement('div');
        row.className = `chat-row ai-row ${hasPrev ? 'has-prev' : ''} ${isGroupMessage ? 'group-ai-row' : ''} ${isGroupMessage && sameSpeaker ? 'group-ai-row-continuous' : ''}`;
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', messageId || window.imChat.createMessageId('msg'));
        if (speakerName) {
            row.setAttribute('data-speaker', speakerName);
        }
        if (speakerMemberId != null && String(speakerMemberId).trim()) {
            row.setAttribute('data-speaker-member-id', String(speakerMemberId));
        }
        if (thought) {
            row.setAttribute('data-thought', thought);
        }
        
        let contentHtml = '';
        if (replyTo) {
            contentHtml += `<div class="msg-reply-quote" style="font-size: 13px; color: rgba(0,0,0,0.6); background: rgba(0,0,0,0.05); padding: 8px 12px; border-radius: 14px; margin-bottom: 8px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${replyTo}</div>`;
        }
        contentHtml += text;
        if (translation && showTranslation) {
            contentHtml += `<div class="msg-translation" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(0,0,0,0.1); font-size: 13px; color: #8e8e93; line-height: 1.4; word-wrap: break-word; white-space: normal;">${translation}</div>`;
        }
        
        const timeStr = typeof window.formatChatBubbleTime === 'function' ? window.formatChatBubbleTime(timestamp) : (() => {
            const date = new Date(timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        })();
        contentHtml += `<span class="bubble-meta"><span class="bubble-time">${timeStr}</span></span>`;

        const headerHtml = buildMessageHeaderHtml(false, friend, timestamp, speakerName, speakerAvatar, hasPrev);

        let bubbleWrapperHtml = '';
            if (isGroupMessage) {
                const avatarInitial = String(speakerName).trim().charAt(0) || '?';
                const avatarImg = speakerAvatar
                ? `<img src="${speakerAvatar}" onerror="this.src='assets/moren-thumb.jpg'" loading="lazy" decoding="async" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;">`
                    : `<div class="chat-avatar-small">${avatarInitial}</div>`;

                bubbleWrapperHtml = `
                    <div class="group-ai-bubble-wrap">
                    ${sameSpeaker ? '' : `<div class="group-ai-speaker-name">${speakerName}</div>`}
                    <div class="group-ai-bubble-row">
                        <div class="group-ai-avatar-slot">${sameSpeaker ? '<div class="group-ai-avatar-placeholder"></div>' : avatarImg}</div>
                        <div class="chat-bubble ai-bubble">${contentHtml}</div>
                    </div>
                </div>
            `;
        } else {
            bubbleWrapperHtml = `<div class="chat-bubble ai-bubble">${contentHtml}</div>`;
        }

        row.innerHTML = `
            <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                ${headerHtml}
                <div style="display: flex; justify-content: flex-start; align-items: flex-end; width: 100%;">
                    ${bubbleWrapperHtml}
                </div>
            </div>
        `;
        container.appendChild(row);
        window.imChat.scrollToBottom(container);
    }

    function getGeneratedChatImageFileName(timestamp, mimeType = '') {
        const extensionByMimeType = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/webp': 'webp',
            'image/gif': 'gif',
            'image/avif': 'avif',
            'image/png': 'png'
        };
        const extension = extensionByMimeType[String(mimeType || '').toLowerCase()] || 'png';
        const date = new Date(timestamp || Date.now());
        const stamp = Number.isNaN(date.getTime())
            ? String(Date.now())
            : date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        return `imessage-generated-${stamp}.${extension}`;
    }

    async function saveGeneratedChatImage(imageUrl, timestamp) {
        if (!imageUrl || typeof window.u2ExportFile !== 'function') {
            throw new Error('图片保存功能尚未加载，请刷新后重试');
        }
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error('无法读取这张图片，请稍后重试');
        const blob = await response.blob();
        if (!/^image\//i.test(blob.type || '')) throw new Error('图片数据无效，无法保存');
        const result = await window.u2ExportFile({
            blob,
            fileName: getGeneratedChatImageFileName(timestamp, blob.type),
            title: 'iMessage 生成图片'
        });
        if (result === 'failed') throw new Error('图片保存失败，请稍后重试');
        return result;
    }

    function getGeneratedImageRerollInput(msg, friend) {
        const currentConfig = friend?.imagePromptConfig && typeof friend.imagePromptConfig === 'object'
            ? friend.imagePromptConfig
            : {};
        const savedConfig = msg?.imageGenerationConfig && typeof msg.imageGenerationConfig === 'object'
            ? msg.imageGenerationConfig
            : null;
        const scenePrompt = String(msg?.imageGenerationPrompt || msg?.description || msg?.text || '').trim();
        const basePrompt = savedConfig ? '' : String(currentConfig.lastPrompt || '').trim();
        const prompt = [
            scenePrompt,
            basePrompt && !scenePrompt.includes(basePrompt)
                ? `当前单聊生图预设基础提示词：\n${basePrompt}`
                : ''
        ].filter(Boolean).join('\n\n');
        return {
            prompt,
            config: {
                charAppearance: String(savedConfig?.charAppearance ?? currentConfig.charAppearance ?? '').trim(),
                userAppearance: String(savedConfig?.userAppearance ?? currentConfig.userAppearance ?? '').trim(),
                artistPrompt: String(savedConfig?.artistPrompt ?? currentConfig.artistPrompt ?? '').trim(),
                negativePrompt: String(savedConfig?.negativePrompt ?? currentConfig.negativePrompt ?? '').trim(),
                useReferenceFace: savedConfig
                    ? savedConfig.useReferenceFace === true
                    : (msg?.faceReferenceUsed === true || currentConfig.autoUseReferenceFace === true)
            }
        };
    }

    async function rerollGeneratedChatImage(msg, friend) {
        if (!msg || msg.imageSource !== 'generated' || !friend?.id) {
            throw new Error('这张图片不支持重新生成');
        }
        const liveFriend = window.imApp?.getFriendById?.(friend.id)
            || (window.imData?.friends || []).find((item) => String(item.id) === String(friend.id))
            || friend;
        const { prompt, config } = getGeneratedImageRerollInput(msg, liveFriend);
        if (!prompt) throw new Error('这张图片没有可复用的生成提示词');
        const referenceImage = config.useReferenceFace
            ? await window.imChat.resolveAutoImageReferenceFace(liveFriend, { force: true })
            : '';
        const result = await window.imChat.generateChatImage(prompt, liveFriend, {
            referenceImage,
            charAppearance: config.charAppearance,
            userAppearance: config.userAppearance,
            artistPrompt: config.artistPrompt,
            negativePrompt: config.negativePrompt
        });
        const previousAssetId = String(msg.contentAssetId || '').trim();
        const descriptor = { id: msg.id || null, timestamp: msg.timestamp || null };
        const saved = await window.imApp.updateFriendMessage(friend.id, descriptor, (targetMsg) => {
            targetMsg.content = result.imageUrl;
            targetMsg.contentAssetId = '';
            targetMsg.imageSource = 'generated';
            targetMsg.imageProvider = result.provider || '';
            targetMsg.imageModel = result.model || '';
            targetMsg.imageSize = result.size || '';
            targetMsg.faceReferenceUsed = !!result.faceReferenceUsed;
            targetMsg.imageGenerationPrompt = prompt;
            targetMsg.imageGenerationConfig = config;
            targetMsg.imageRerollCount = Math.max(0, Number(targetMsg.imageRerollCount) || 0) + 1;
            targetMsg.imageRerolledAt = Date.now();
        }, { silent: true });
        if (!saved) throw new Error('新图片保存失败');

        const updatedFriend = window.imApp?.getFriendById?.(friend.id) || liveFriend;
        const updatedMessage = (updatedFriend.messages || []).find((item) => {
            if (descriptor.id && item?.id) return String(item.id) === String(descriptor.id);
            return descriptor.timestamp && String(item?.timestamp || '') === String(descriptor.timestamp);
        }) || msg;
        const nextAssetId = String(updatedMessage.contentAssetId || '').trim();
        if (previousAssetId && previousAssetId !== nextAssetId) {
            await window.appStorage?.markAssetOrphaned?.(previousAssetId).catch(() => undefined);
        }
        const page = document.getElementById(`chat-interface-${friend.id}`);
        const container = page?.querySelector('.ins-chat-messages');
        if (container) {
            const row = Array.from(container.querySelectorAll('.chat-row')).find((item) => {
                if (descriptor.id && item.dataset.messageId) return String(item.dataset.messageId) === String(descriptor.id);
                return descriptor.timestamp && String(item.dataset.timestamp || '') === String(descriptor.timestamp);
            });
            const image = row?.querySelector('.chat-image-bubble-img');
            if (image && updatedMessage.content) image.src = updatedMessage.content;
        }
        return { updatedFriend, updatedMessage };
    }

    function formatGeneratedImageRerollError(error) {
        let reason = String(error?.message || error || '').trim();
        if (error?.name === 'AbortError' || /abort|timeout|超时/i.test(reason)) {
            reason = reason || '生图请求超时，请稍后重试';
        } else if (error?.name === 'QuotaExceededError') {
            reason = '本地存储空间不足，无法保存新图片';
        } else if (!reason) {
            reason = '生图接口未返回具体错误';
        }
        reason = reason.replace(/^图片(?:重新生成|重\s*roll)失败[：:]?\s*/i, '').trim();
        reason = reason.replace(/[。.!！]+$/g, '').trim();
        return `图片重 roll 失败：${reason}。旧图片已保留`;
    }

function openChatImageDetail(msg, friend, timestamp, senderName) {
        let overlay = document.getElementById('chat-image-detail-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'chat-image-detail-overlay';
            overlay.style.cssText = 'position:fixed; inset:0; z-index:99999; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,0.55); padding:20px; box-sizing:border-box;';
            overlay.innerHTML = `
                <div class="chat-image-detail-card" style="width:100%; max-width:360px; max-height:86vh; background:#fff; border-radius:24px; overflow:hidden;  display:flex; flex-direction:column;">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; border-bottom:1px solid #f2f2f7;">
                        <div style="min-width:0;">
                            <div class="chat-image-detail-sender" style="font-size:16px; font-weight:800; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></div>
                            <div class="chat-image-detail-time" style="font-size:12px; color:#8e8e93; margin-top:2px;"></div>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                            <button type="button" class="chat-image-detail-reroll" style="display:none; border:none; border-radius:16px; background:#f2f2f7; color:#111; cursor:pointer; padding:8px 11px; font-size:12px; font-weight:700;"><i class="fas fa-redo"></i> 重 roll</button>
                            <button type="button" class="chat-image-detail-save" style="display:none; border:none; border-radius:16px; background:#111; color:#fff; cursor:pointer; padding:8px 11px; font-size:12px; font-weight:700;">保存</button>
                            <button type="button" class="chat-image-detail-close" aria-label="关闭" style="width:32px; height:32px; border:none; border-radius:16px; background:#f2f2f7; color:#111; cursor:pointer; flex-shrink:0;"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                    <div style="background:#111; display:flex; align-items:center; justify-content:center; min-height:220px;">
                        <img class="chat-image-detail-img" src="" alt="" style="max-width:100%; max-height:52vh; object-fit:contain; display:block;">
                    </div>
                    <div class="chat-image-detail-reroll-error" role="alert" aria-live="assertive" style="display:none; margin:12px 16px 0; padding:10px 12px; border-radius:12px; background:#fff1f0; color:#c62828; font-size:13px; line-height:1.45; word-break:break-word;"></div>
                    <div style="padding:14px 16px 18px; overflow-y:auto;">
                        <div style="font-size:12px; color:#8e8e93; font-weight:700; margin-bottom:7px;">图片详情</div>
                        <div class="chat-image-detail-desc" style="font-size:15px; color:#222; line-height:1.55; white-space:pre-wrap; word-break:break-word;"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay || event.target.closest('.chat-image-detail-close')) {
                    overlay.style.display = 'none';
                }
            });
        }

        const imageEl = overlay.querySelector('.chat-image-detail-img');
        const senderEl = overlay.querySelector('.chat-image-detail-sender');
        const timeEl = overlay.querySelector('.chat-image-detail-time');
        const descEl = overlay.querySelector('.chat-image-detail-desc');
        const rerollErrorEl = overlay.querySelector('.chat-image-detail-reroll-error');
        const rerollButton = overlay.querySelector('.chat-image-detail-reroll');
        const saveButton = overlay.querySelector('.chat-image-detail-save');
        const date = new Date(timestamp || msg.timestamp || Date.now());
        const timeStr = typeof window.formatChatBubbleTime === 'function'
            ? window.formatChatBubbleTime(timestamp || msg.timestamp || Date.now())
            : `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;

        const imageUrl = msg.content || window.imChat.CHAT_IMAGE_PLACEHOLDER_URL || '';
        const isGeneratedImage = msg.imageSource === 'generated'
            && imageUrl !== (window.imChat.CHAT_IMAGE_PLACEHOLDER_URL || '');
        const detailMessageKey = String(msg.id || timestamp || msg.timestamp || '');
        overlay.dataset.messageKey = detailMessageKey;
        if (imageEl) imageEl.src = imageUrl;
        if (senderEl) senderEl.textContent = senderName || friend?.nickname || friend?.realName || '图片';
        if (timeEl) timeEl.textContent = timeStr;
        if (descEl) descEl.textContent = msg.text || msg.description || '暂无图片描述';
        if (rerollErrorEl) {
            rerollErrorEl.style.display = 'none';
            rerollErrorEl.textContent = '';
        }
        if (saveButton) {
            saveButton.style.display = isGeneratedImage ? '' : 'none';
            saveButton.disabled = false;
            saveButton.textContent = '保存';
            saveButton.onclick = async () => {
                if (!isGeneratedImage || saveButton.disabled) return;
                const originalText = saveButton.textContent;
                saveButton.disabled = true;
                saveButton.textContent = '保存中…';
                try {
                    const result = await saveGeneratedChatImage(imageUrl, timestamp || msg.timestamp);
                    if (result === 'downloaded' || result === 'shared') window.showToast?.('图片已保存');
                } catch (error) {
                    window.showToast?.(error?.message || '图片保存失败，请稍后重试');
                } finally {
                    saveButton.disabled = false;
                    saveButton.textContent = originalText;
                }
            };
        }
        if (rerollButton) {
            rerollButton.style.display = isGeneratedImage ? '' : 'none';
            rerollButton.disabled = false;
            rerollButton.innerHTML = '<i class="fas fa-redo"></i> 重 roll';
            rerollButton.onclick = async () => {
                if (!isGeneratedImage || rerollButton.disabled) return;
                rerollButton.disabled = true;
                if (saveButton) saveButton.disabled = true;
                if (rerollErrorEl) {
                    rerollErrorEl.style.display = 'none';
                    rerollErrorEl.textContent = '';
                }
                rerollButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中…';
                try {
                    const { updatedFriend, updatedMessage } = await rerollGeneratedChatImage(msg, friend);
                    window.showToast?.('图片已重新生成');
                    if (overlay.dataset.messageKey === detailMessageKey && overlay.style.display !== 'none') {
                        openChatImageDetail(updatedMessage, updatedFriend, updatedMessage.timestamp, senderName);
                    }
                } catch (error) {
                    console.error('[iMessage] Image reroll failed:', error);
                    const userFacingError = formatGeneratedImageRerollError(error);
                    if (rerollErrorEl) {
                        rerollErrorEl.textContent = userFacingError;
                        rerollErrorEl.style.display = 'block';
                    } else {
                        window.alert(userFacingError);
                    }
                } finally {
                    rerollButton.disabled = false;
                    rerollButton.innerHTML = '<i class="fas fa-redo"></i> 重 roll';
                    if (saveButton) saveButton.disabled = false;
                }
            };
        }
        overlay.style.display = 'flex';
    }

function renderImageBubble(msg, friend, container, timestamp = Date.now()) {
        const isUser = msg.role === 'user';
        const isGroupMessage = !isUser && friend.type === 'group';
        const safeSpeaker = isGroupMessage && window.imChat.getGroupMessageSpeaker
            ? window.imChat.getGroupMessageSpeaker(friend, msg)
            : null;
        const speakerName = isGroupMessage
            ? ((safeSpeaker && safeSpeaker.nickname) || msg.speaker || msg.senderName || 'Group member')
            : null;
        const speakerAvatar = (safeSpeaker && safeSpeaker.avatarUrl) || msg.senderAvatarUrl || null;
        const rows = Array.from(container.children).filter(el => !el.classList.contains('chat-timestamp') && !el.classList.contains('typing-row'));
        const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
        let hasPrev = false;
        let sameSpeaker = false;
        
        if (lastRow) {
            if (isUser && lastRow.classList.contains('user-row')) {
                hasPrev = true;
                lastRow.classList.add('has-next');
            } else if (!isUser && lastRow.classList.contains('ai-row')) {
                const prevSpeaker = lastRow.getAttribute('data-speaker') || null;
                if (isGroupMessage) {
                    if (prevSpeaker === speakerName) {
                        hasPrev = true;
                        sameSpeaker = true;
                        lastRow.classList.add('has-next');
                    }
                } else if (!prevSpeaker) {
                    hasPrev = true;
                    lastRow.classList.add('has-next');
                }
            }
        }

        const row = document.createElement('div');
        row.className = `chat-row ${isUser ? 'user-row' : 'ai-row'} ${hasPrev ? 'has-prev' : ''} ${isGroupMessage ? 'group-ai-row' : ''} ${isGroupMessage && sameSpeaker ? 'group-ai-row-continuous' : ''}`;
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'img'));
        if (speakerName) row.setAttribute('data-speaker', speakerName);
        setGroupRowMemberId(row, friend, msg);
        setGroupUserRowIdentity(row, friend, msg);
        
        const imageSrc = msg.content || window.imChat.CHAT_IMAGE_PLACEHOLDER_URL || '';
        const contentHtml = `
            <img class="chat-image-bubble-img" src="${escapeHtml(imageSrc)}" style="width: min(56vw, 200px); height: min(56vw, 200px); max-width: 200px; max-height: 200px; aspect-ratio: 1 / 1; border-radius: 12px; object-fit: cover; display: block; background: #e5e5ea; cursor: pointer;">
        `;

        const timeStr = typeof window.formatChatBubbleTime === 'function' ? window.formatChatBubbleTime(timestamp) : (() => {
            const date = new Date(timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        })();

        const metaHtml = "";
        const bubbleHtml = `<div class="chat-bubble ${isUser ? 'user-bubble' : 'ai-bubble'} im-card-bubble image-message-bubble" style="padding: 0; background: transparent; ">${contentHtml}${metaHtml}</div>`;
        let bubbleWrapperHtml = bubbleHtml;

            if (isGroupMessage) {
                const avatarInitial = String(speakerName).trim().charAt(0) || '?';
                const avatarImg = speakerAvatar
                ? `<img src="${escapeHtml(speakerAvatar)}" onerror="this.src='assets/moren-thumb.jpg'" loading="lazy" decoding="async" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;">`
                    : `<div class="chat-avatar-small">${escapeHtml(avatarInitial)}</div>`;

                bubbleWrapperHtml = `
                    <div class="group-ai-bubble-wrap">
                    ${sameSpeaker ? '' : `<div class="group-ai-speaker-name">${escapeHtml(speakerName)}</div>`}
                    <div class="group-ai-bubble-row">
                        <div class="group-ai-avatar-slot">${sameSpeaker ? '<div class="group-ai-avatar-placeholder"></div>' : avatarImg}</div>
                        ${bubbleHtml}
                    </div>
                </div>
            `;
        }

        const headerHtml = buildMessageHeaderHtml(isUser, friend, timestamp, speakerName, speakerAvatar, hasPrev, msg);

        row.innerHTML = `
            <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                ${headerHtml}
                <div style="display: flex; justify-content: ${isUser ? 'flex-end' : 'flex-start'}; align-items: flex-end; width: 100%;">
                    ${bubbleWrapperHtml}
                </div>
            </div>
        `;

        const imageEl = row.querySelector('.chat-image-bubble-img');
        if (imageEl) {
            imageEl.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const senderName = isUser
                    ? getEffectiveUserProfile(friend).name
                    : (speakerName || friend?.nickname || friend?.realName || 'Char');
                openChatImageDetail(msg, friend, timestamp, senderName);
            });
        }

        container.appendChild(row);
        window.imChat.scrollToBottom(container);
    }

function renderPayTransferBubble(msg, friend, container, timestamp = Date.now()) {
        const isUser = msg.role === 'user';
        const isGroupMessage = !isUser && friend.type === 'group';
        const groupIdentity = isGroupMessage ? resolveGroupBubbleIdentity(friend, msg) : null;
        const speakerName = groupIdentity?.name || null;
        const speakerAvatar = groupIdentity?.avatarUrl || null;
        const lastRow = container.lastElementChild;
        let hasPrev = false;
        let sameSpeaker = false;

        if (lastRow) {
            if (isUser && lastRow.classList.contains('user-row')) {
                hasPrev = true;
                lastRow.classList.add('has-next');
            } else if (!isUser && lastRow.classList.contains('ai-row')) {
                const previousSpeaker = lastRow.getAttribute('data-speaker') || null;
                if (!isGroupMessage || previousSpeaker === speakerName) {
                    hasPrev = true;
                    sameSpeaker = isGroupMessage;
                    lastRow.classList.add('has-next');
                }
            }
        }

        const row = document.createElement('div');
        row.className = `chat-row ${isUser ? 'user-row' : 'ai-row'} ${hasPrev ? 'has-prev' : ''} ${isGroupMessage ? 'group-ai-row' : ''} ${isGroupMessage && sameSpeaker ? 'group-ai-row-continuous' : ''}`;
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'pay'));
        if (speakerName) row.setAttribute('data-speaker', speakerName);
        setGroupRowMemberId(row, friend, msg);
        setGroupUserRowIdentity(row, friend, msg);

        const amount = Number(msg.amount) || 0;
        const amountText = `¥${amount.toFixed(2)}`;
        const description = msg.description || '转账';
        const parties = resolvePayTransferParties(msg, friend);
        const { payKind, status, payerName, payeeName } = parties;

        const isOfficialReceipt = msg.targetName === 'Payment' || msg.cardTitle === '收款通知' || msg.cardTitle === '支付凭证';
        const familyCardText = `${msg.paymentAction || ''} ${msg.cardTitle || ''} ${msg.description || ''} ${msg.content || ''}`;
        const isFamilyCard = msg.paymentAction === 'family_card'
            || msg.paymentAction === 'family_card_increase'
            || familyCardText.includes('亲属卡');
        let cardTitle = msg.cardTitle || 'Payment';
        let subtitle = `${payerName} 向 ${payeeName} 转账`;
        let extraClass = '';

        if (status === 'claimed') {
            cardTitle = msg.cardTitle || `${payeeName}已收款`;
            subtitle = `${payeeName}已收取 ${payerName} 的转账`;
            extraClass = payKind === 'char_received' ? ' is-received' : ' is-income';
        } else if (status === 'rejected') {
            cardTitle = msg.cardTitle || '已退还';
            subtitle = `${payeeName}已退还 ${payerName} 的转账`;
            extraClass = ' is-rejected';
        } else if (payKind === 'char_to_user_pending') {
            cardTitle = msg.cardTitle || '转账';
            subtitle = `${payerName} 向 ${payeeName} 转账`;
            extraClass = ' is-pending';
        }

        const headerHtml = buildMessageHeaderHtml(isUser, friend, timestamp, speakerName, speakerAvatar, hasPrev, msg);

        const date = new Date(timestamp);
        const timeStr = typeof window.formatChatBubbleTime === 'function' ? window.formatChatBubbleTime(timestamp) : `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;

        if (isOfficialReceipt) {
            // 微信支付样式居中大卡片
            const sign = msg.cardTitle === '收款通知' ? '+' : '-';
            row.innerHTML = `
                <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                    <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
                </div>
                    <div style="width:100%; display:flex; justify-content:center; padding:10px 0;">
                    <div class="im-card-content pay-receipt-card" style="width:280px; background:#fff; border-radius:12px; padding:16px;  display:flex; flex-direction:column; align-items:center;">
                        <div style="font-size:14px; color:#111; margin-bottom:8px;">${description}</div>
                        <div style="font-size:28px; font-weight:bold; color:#111; margin-bottom:12px;">${sign}¥${amount.toFixed(2)}</div>
                          <div style="background:#f2f2f7; border-radius:16px; padding:4px 12px; font-size:12px; color:#8e8e93; margin-bottom:16px;">
                              ${timeStr}
                          </div>
                        <div style="width:100%; border-top:1px solid #f2f2f7; padding-top:12px; display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:13px; color:#8e8e93;">账单详情</span>
                            <i class="fas fa-chevron-right" style="font-size:12px; color:#c7c7cc;"></i>
                        </div>
                    </div>
                </div>
            `;
        } else {
            const contentHtml = `
                <div class="pay-transfer-card im-card-content${extraClass}">
                    <div class="pay-transfer-card-top">
                        <div class="pay-transfer-card-icon"><i class="fas fa-wallet"></i></div>
                        <div class="pay-transfer-card-meta">
                            <div class="pay-transfer-card-title">${cardTitle}</div>
                            ${isFamilyCard ? '' : `<div class="pay-transfer-card-subtitle">${subtitle}</div>`}
                        </div>
                    </div>
                    <div class="pay-transfer-card-amount">${amountText}</div>
                    <div class="pay-transfer-card-desc">${description}</div>
                </div>
            `;

            if (isUser) {
                const metaHtml = "";
                row.innerHTML = `
                    <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                        <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
                    </div>
                    <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                        ${headerHtml}
                        <div style="display: flex; justify-content: flex-end; align-items: flex-end; width: 100%;">
                            <div class="chat-bubble user-bubble im-card-bubble pay-transfer-bubble">${contentHtml}${metaHtml}</div>
                        </div>
                    </div>
                `;
            } else {
                const metaHtml = "";
                const groupContent = isGroupMessage
                    ? `<div class="group-ai-bubble-wrap">
                        ${sameSpeaker ? '' : `<div class="group-ai-speaker-name">${escapeHtml(speakerName)}</div>`}
                        <div class="group-ai-bubble-row">
                            <div class="group-ai-avatar-slot">${sameSpeaker ? '<div class="group-ai-avatar-placeholder"></div>' : (speakerAvatar ? `<img src="${escapeHtml(speakerAvatar)}" onerror="this.src='assets/moren-thumb.jpg'" loading="lazy" decoding="async" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">` : `<div class="chat-avatar-small">${escapeHtml(String(speakerName).charAt(0) || '?')}</div>`)}</div>
                            <div class="chat-bubble ai-bubble im-card-bubble pay-transfer-bubble">${contentHtml}${metaHtml}</div>
                        </div>
                    </div>`
                    : `<div class="chat-bubble ai-bubble im-card-bubble pay-transfer-bubble">${contentHtml}${metaHtml}</div>`;
                row.innerHTML = `
                    <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                        <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
                    </div>
                    <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                        ${headerHtml}
                        <div style="display: flex; justify-content: flex-start; align-items: flex-end; width: 100%;">${groupContent}</div>
                    </div>
                `;
            }
        }

        container.appendChild(row);

        // 允许用户向AI转账时，以及AI向用户转账时，都可以点击打开弹窗
        if (payKind === 'char_to_user_pending' || payKind === 'user_to_char') {
            const clickableBubble = row.querySelector('.chat-bubble.pay-transfer-bubble') || row.querySelector('.pay-transfer-card');
            if (clickableBubble) {
                clickableBubble.style.cursor = 'pointer';
                clickableBubble.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const activePage = container.closest('.active-chat-interface');
                    if (!activePage) {
                        if (window.showToast) window.showToast('未找到聊天页面');
                        return;
                    }

                    if (!activePage._openTransferDetailOverlay) {
                        window.imChat.ensureTransferDetailOverlayForExistingPage(activePage, friend);
                    }

                    if (activePage._openTransferDetailOverlay) {
                        const messageId = row.getAttribute('data-message-id');
                        const rowTimestamp = row.getAttribute('data-timestamp');
                        const liveFriend = window.imData.currentActiveFriend &&
                            String(window.imData.currentActiveFriend.id) === String(friend.id)
                            ? window.imData.currentActiveFriend
                            : friend;
                        const liveMsg = Array.isArray(liveFriend?.messages)
                            ? liveFriend.messages.find(item => {
                                if (messageId && String(item.id) === String(messageId)) return true;
                                return rowTimestamp && String(item.timestamp) === String(rowTimestamp);
                            })
                            : null;
                        activePage._openTransferDetailOverlay(liveMsg || msg);
                    } else if (window.showToast) {
                        window.showToast('详情卡片初始化失败');
                    }
                });
            }
        }

        window.imChat.scrollToBottom(container);
    }

function renderMomentForwardBubble(msg, friend, container, timestamp = Date.now()) {
        let momentData = {};
        try {
            momentData = JSON.parse(msg.content);
        } catch (e) {
            momentData = { text: '[解析错误]' };
        }

        const isUser = msg.role === 'user';
        const lastRow = container.lastElementChild;
        let hasPrev = false;
        
        if (lastRow) {
            if (isUser && lastRow.classList.contains('user-row')) {
                hasPrev = true;
                lastRow.classList.add('has-next');
            } else if (!isUser && lastRow.classList.contains('ai-row')) {
                hasPrev = true;
                lastRow.classList.add('has-next');
            }
        }

        const row = document.createElement('div');
        row.className = `chat-row ${isUser ? 'user-row' : 'ai-row'} ${hasPrev ? 'has-prev' : ''}`;
        row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'moment'));
        setGroupUserRowIdentity(row, friend, msg);
        
        const contentHtml = `
            <div class="moment-forward-bubble im-card-content" style="cursor: pointer; background: #fff; border-radius: 16px; padding: 12px;  border: 1px solid rgba(0,0,0,0.04); display: flex; align-items: center; gap: 12px; width: 220px; text-align: left; margin: 4px 0;">
                <div style="width: 44px; height: 44px; border-radius: 12px; background: #1c1c1e; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #fff; font-size: 20px;">
                    <i class="far fa-images"></i>
                </div>
                <div style="flex: 1; overflow: hidden;">
                    <div style="font-size: 15px; font-weight: 600; color: #262626; margin-bottom: 2px;">分享了动态</div>
                    <div style="font-size: 13px; color: #8e8e93;">点击查看详情</div>
                </div>
            </div>
        `;

        const headerHtml = buildMessageHeaderHtml(isUser, friend, timestamp, null, null, hasPrev, msg);

        const timeStr = typeof window.formatChatBubbleTime === 'function' ? window.formatChatBubbleTime(timestamp) : (() => {
            const date = new Date(timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        })();
        
        if (isUser) {
            let metaHtml = "";
            row.innerHTML = `
                <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                    <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                    ${headerHtml}
                    <div style="display: flex; justify-content: flex-end; align-items: flex-end; width: 100%;">
                        ${contentHtml}
                        ${metaHtml}
                    </div>
                </div>
            `;
        } else {
            let metaHtml = "";
            row.innerHTML = `
                <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                    <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                    ${headerHtml}
                    <div style="display: flex; justify-content: flex-start; align-items: flex-end; width: 100%;">
                        ${contentHtml}
                        ${metaHtml}
                    </div>
                </div>
            `;
        }
        
        row.querySelector('.moment-forward-bubble').addEventListener('click', () => {
            const foundMoment = window.imData.moments.find(m => m.id == momentData.id);
            if (foundMoment) {
                if(window.imApp.openMomentDetail) window.imApp.openMomentDetail(foundMoment);
            } else {
                if(window.showToast) window.showToast('该朋友圈已删除或不存在');
            }
        });

        container.appendChild(row);
        window.imChat.scrollToBottom(container);
    }

function renderVoiceMessageBubble(msg, friend, container, timestamp = Date.now()) {
        const isUser = msg.role !== 'assistant';
        const rows = Array.from(container.children).filter(el => !el.classList.contains('chat-timestamp') && !el.classList.contains('typing-row') && !el.classList.contains('chat-offline-scene-row'));
        const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
        const isGroupMessage = !isUser && friend.type === 'group';
        const safeSpeaker = isGroupMessage && window.imChat.getGroupMessageSpeaker
            ? window.imChat.getGroupMessageSpeaker(friend, msg)
            : null;
        const speakerName = isGroupMessage
            ? ((safeSpeaker && safeSpeaker.nickname) || msg.speaker || msg.senderName || '群成员')
            : null;
        const speakerAvatar = (safeSpeaker && safeSpeaker.avatarUrl) || msg.senderAvatarUrl || null;
        let hasPrev = false;
        let sameSpeaker = false;

        if (lastRow) {
            if (isUser && lastRow.classList.contains('user-row')) {
                hasPrev = true;
                lastRow.classList.add('has-next');
            } else if (!isUser && lastRow.classList.contains('ai-row')) {
                const prevSpeaker = lastRow.getAttribute('data-speaker') || null;
                if (isGroupMessage) {
                    if (prevSpeaker === speakerName) {
                        hasPrev = true;
                        sameSpeaker = true;
                        lastRow.classList.add('has-next');
                    }
                } else if (!prevSpeaker) {
                    hasPrev = true;
                    sameSpeaker = true;
                    lastRow.classList.add('has-next');
                }
            }
        }

        const row = document.createElement('div');
        row.className = `chat-row ${isUser ? 'user-row' : 'ai-row'} ${hasPrev ? 'has-prev' : ''} ${isGroupMessage ? 'group-ai-row' : ''} ${isGroupMessage && sameSpeaker ? 'group-ai-row-continuous' : ''}`;
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'voice'));
        if (speakerName) {
            row.setAttribute('data-speaker', speakerName);
        }
        setGroupRowMemberId(row, friend, msg);
        setGroupUserRowIdentity(row, friend, msg);

        const transcript = String(msg.transcript || msg.text || '').trim();
        const calculatedDuration = Math.min(18, Math.max(3, Math.ceil(transcript.length / 3)));
        const duration = Math.min(18, Math.max(3, Number(msg.duration) || calculatedDuration));
        const safeTranscript = escapeHtml(transcript || '暂无转文字');
        const cleanTranslation = String(msg.translation || '').trim();
        const timeStr = typeof window.formatChatBubbleTime === 'function' ? window.formatChatBubbleTime(timestamp) : (() => {
            const date = new Date(timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        })();
        const metaHtml = "";

        const contentHtml = `
            <button type="button" class="voice-message-bubble-inner" aria-expanded="false">
                <span class="voice-message-mic"><i class="fas fa-microphone-alt"></i></span>
                <span class="voice-message-wave" aria-hidden="true">
                    <span></span><span></span><span></span><span></span><span></span>
                </span>
                <span class="voice-message-duration">${duration}s</span>
            </button>
            <div class="voice-message-transcript" hidden>${safeTranscript}</div>
            ${cleanTranslation && msg.showTranslation ? `<div class="msg-translation" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid ${isUser ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}; font-size: 13px; color: ${isUser ? 'rgba(255,255,255,0.7)' : '#8e8e93'}; line-height: 1.4; word-wrap: break-word; white-space: normal;">${escapeHtml(cleanTranslation)}</div>` : ''}
            ${metaHtml}
        `;

        const bubbleHtml = `<div class="chat-bubble ${isUser ? 'user-bubble' : 'ai-bubble'} im-card-bubble voice-message-bubble">${contentHtml}</div>`;
        let bubbleWrapperHtml = bubbleHtml;
        if (isGroupMessage) {
            const avatarInitial = String(speakerName).trim().charAt(0) || '?';
            const avatarImg = speakerAvatar
                ? `<img src="${speakerAvatar}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;">`
                : `<div class="chat-avatar-small">${escapeHtml(avatarInitial)}</div>`;

            bubbleWrapperHtml = `
                <div class="group-ai-bubble-wrap">
                    ${sameSpeaker ? '' : `<div class="group-ai-speaker-name">${escapeHtml(speakerName)}</div>`}
                    <div class="group-ai-bubble-row">
                        <div class="group-ai-avatar-slot">${sameSpeaker ? '<div class="group-ai-avatar-placeholder"></div>' : avatarImg}</div>
                        ${bubbleHtml}
                    </div>
                </div>
            `;
        }

        const headerHtml = buildMessageHeaderHtml(isUser, friend, timestamp, speakerName, speakerAvatar, hasPrev, msg);

        row.innerHTML = `
            <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                ${headerHtml}
                <div style="display: flex; justify-content: ${isUser ? 'flex-end' : 'flex-start'}; align-items: flex-end; width: 100%;">
                    ${bubbleWrapperHtml}
                </div>
            </div>
        `;

        const toggle = row.querySelector('.voice-message-bubble-inner');
        const transcriptEl = row.querySelector('.voice-message-transcript');
        if (toggle && transcriptEl) {
            toggle.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const shouldExpand = transcriptEl.hidden;
                transcriptEl.hidden = !shouldExpand;
                toggle.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');

                const ttsFriend = window.u2Tts?.resolveMessageTtsFriend
                    ? window.u2Tts.resolveMessageTtsFriend(friend, msg)
                    : friend;
                const canPlayTts = window.u2Tts?.canSpeakForFriend
                    ? window.u2Tts.canSpeakForFriend(ttsFriend)
                    : true;
                if (shouldExpand && canPlayTts && window.u2Tts && typeof window.u2Tts.speakTextCached === 'function') {
                    try {
                        const cacheOwner = msg && typeof msg === 'object' ? msg : {};
                        const audioUrl = await window.u2Tts.speakTextCached(transcript, ttsFriend, cacheOwner);
                        if (audioUrl && msg && typeof msg === 'object' && !msg.ttsAudioUrl && window.imApp?.updateFriendMessage) {
                            await window.imApp.updateFriendMessage(friend.id, {
                                id: msg.id || row.getAttribute('data-message-id') || null,
                                timestamp: row.getAttribute('data-timestamp') || timestamp || null
                            }, (targetMsg) => {
                                if (targetMsg) targetMsg.ttsAudioUrl = audioUrl;
                            }, { silent: true });
                        }
                    } catch (error) {
                        console.error('Voice message playback failed', error);
                        if (window.showToast) window.showToast(window.u2Tts?.getUserErrorMessage?.(error) || '语音播放失败');
                    }
                }
            });
        }

        container.appendChild(row);
        window.imChat.scrollToBottom(container);
    }

function renderStickerMessageBubble(msg, friend, container, timestamp = Date.now()) {
        const isUser = msg.role !== 'assistant';
        const rows = Array.from(container.children).filter(el => !el.classList.contains('chat-timestamp') && !el.classList.contains('typing-row'));
        const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
        const isGroupMessage = !isUser && friend.type === 'group';
        const safeSpeaker = isGroupMessage && window.imChat.getGroupMessageSpeaker
            ? window.imChat.getGroupMessageSpeaker(friend, msg)
            : null;
        const speakerName = isGroupMessage
            ? ((safeSpeaker && safeSpeaker.nickname) || msg.speaker || msg.senderName || 'Group member')
            : null;
        const speakerAvatar = (safeSpeaker && safeSpeaker.avatarUrl) || msg.senderAvatarUrl || null;
        let hasPrev = false;
        let sameSpeaker = false;

        if (lastRow) {
            if (isUser && lastRow.classList.contains('user-row')) {
                hasPrev = true;
                lastRow.classList.add('has-next');
            } else if (!isUser && lastRow.classList.contains('ai-row')) {
                const prevSpeaker = lastRow.getAttribute('data-speaker') || null;
                if (isGroupMessage) {
                    if (prevSpeaker === speakerName) {
                        hasPrev = true;
                        sameSpeaker = true;
                        lastRow.classList.add('has-next');
                    }
                } else if (!prevSpeaker) {
                    hasPrev = true;
                    sameSpeaker = true;
                    lastRow.classList.add('has-next');
                }
            }
        }

        const row = document.createElement('div');
        row.className = `chat-row ${isUser ? 'user-row' : 'ai-row'} ${hasPrev ? 'has-prev' : ''} ${isGroupMessage ? 'group-ai-row' : ''} ${isGroupMessage && sameSpeaker ? 'group-ai-row-continuous' : ''}`;
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'sticker'));
        if (speakerName) {
            row.setAttribute('data-speaker', speakerName);
        }
        setGroupRowMemberId(row, friend, msg);
        setGroupUserRowIdentity(row, friend, msg);

        const stickerUrl = String(msg.stickerUrl || msg.content || '').trim();
        const stickerName = String(msg.stickerName || msg.text || 'Sticker').trim();
        const timeStr = typeof window.formatChatBubbleTime === 'function' ? window.formatChatBubbleTime(timestamp) : (() => {
            const date = new Date(timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        })();
        const metaHtml = "";
        const stickerHtml = `
            <div class="sticker-message-wrap" title="${escapeHtml(stickerName)}">
                <img class="sticker-message-img" src="${escapeHtml(stickerUrl)}" alt="${escapeHtml(stickerName)}">
                ${metaHtml}
            </div>
        `;

        let bubbleWrapperHtml = stickerHtml;
        if (isGroupMessage) {
            const avatarInitial = String(speakerName).trim().charAt(0) || '?';
            const avatarImg = speakerAvatar
                ? `<img src="${escapeHtml(speakerAvatar)}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;">`
                : `<div class="chat-avatar-small">${escapeHtml(avatarInitial)}</div>`;

            bubbleWrapperHtml = `
                <div class="group-ai-bubble-wrap sticker-group-wrap">
                    ${sameSpeaker ? '' : `<div class="group-ai-speaker-name">${escapeHtml(speakerName)}</div>`}
                    <div class="group-ai-bubble-row">
                        <div class="group-ai-avatar-slot">${sameSpeaker ? '<div class="group-ai-avatar-placeholder"></div>' : avatarImg}</div>
                        ${stickerHtml}
                    </div>
                </div>
            `;
        }

        const headerHtml = buildMessageHeaderHtml(isUser, friend, timestamp, speakerName, speakerAvatar, hasPrev, msg);

        row.innerHTML = `
            <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                ${headerHtml}
                <div style="display: flex; justify-content: ${isUser ? 'flex-end' : 'flex-start'}; align-items: flex-end; width: 100%;">
                    ${bubbleWrapperHtml}
                </div>
            </div>
        `;

        container.appendChild(row);
        window.imChat.scrollToBottom(container);
    }

    function cleanFakeLinkText(value, maxLength = 50000) {
        return String(value == null ? '' : value).replace(/\u0000/g, '').trim().slice(0, maxLength);
    }

    function isAllowedFakeLinkImageUrlForRender(value) {
        try {
            const parsed = new URL(String(value || ''));
            return parsed.protocol === 'https:' && parsed.hostname === 'picsum.photos';
        } catch (_) {
            return false;
        }
    }

    function stripFakeLinkHtmlToPlainText(value, maxLength = 12000) {
        return cleanFakeLinkText(value, maxLength)
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

    function sanitizeFakeLinkCssText(value) {
        return cleanFakeLinkText(value, 40000)
            .replace(/@import[^;]+;/gi, '')
            .replace(/url\s*\([^)]*\)/gi, 'none')
            .replace(/expression\s*\([^)]*\)/gi, '')
            .replace(/javascript\s*:/gi, '')
            .replace(/behavior\s*:/gi, '')
            .replace(/-moz-binding\s*:/gi, '')
            .replace(/position\s*:\s*fixed\s*;?/gi, 'position:absolute;')
            .slice(0, 40000);
    }

    function sanitizeFakeLinkJsText(value) {
        return cleanFakeLinkText(value, 12000)
            .replace(/<\/script/gi, '<\\/script')
            .slice(0, 12000);
    }

    function normalizeFakeLinkInteractionForRender(source = {}) {
        if (!source || typeof source !== 'object') return null;
        const allowedTypes = new Set(['toggleClass', 'toggleText', 'increment', 'switchPanel']);
        const type = allowedTypes.has(source.type) ? source.type : 'toggleClass';
        const selector = cleanFakeLinkText(source.selector || source.target || '', 160);
        if (!selector || /[<>{}]/.test(selector)) return null;
        return {
            type,
            selector,
            targetSelector: cleanFakeLinkText(source.targetSelector || source.target || selector, 160),
            className: cleanFakeLinkText(source.className || 'is-active', 60) || 'is-active',
            activeText: cleanFakeLinkText(source.activeText || '', 80),
            inactiveText: cleanFakeLinkText(source.inactiveText || '', 80),
            countSelector: cleanFakeLinkText(source.countSelector || '', 160),
            panelGroup: cleanFakeLinkText(source.panelGroup || '', 80)
        };
    }

    function sanitizeFakeLinkElementTree(parent) {
        if (!parent || !parent.childNodes) return;
        const allowedTags = new Set([
            'article', 'section', 'main', 'header', 'footer', 'nav', 'div', 'p', 'span',
            'strong', 'em', 'b', 'i', 'small', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4',
            'h5', 'h6', 'button', 'figure', 'figcaption', 'blockquote', 'hr', 'br', 'img'
        ]);
        const forbiddenTags = new Set([
            'script', 'style', 'iframe', 'object', 'embed', 'svg', 'canvas', 'link', 'meta',
            'base', 'form', 'input', 'textarea', 'select', 'option'
        ]);
        Array.from(parent.childNodes).forEach((node) => {
            if (!node || node.nodeType !== 1) return;
            const tag = String(node.tagName || '').toLowerCase();
            if (forbiddenTags.has(tag)) {
                node.remove();
                return;
            }
            if (!allowedTags.has(tag)) {
                const fragment = document.createDocumentFragment();
                while (node.firstChild) fragment.appendChild(node.firstChild);
                node.replaceWith(fragment);
                sanitizeFakeLinkElementTree(parent);
                return;
            }
            Array.from(node.attributes || []).forEach((attr) => {
                const name = String(attr.name || '').toLowerCase();
                const value = cleanFakeLinkText(attr.value || '', 500);
                if (!name || name.startsWith('on') || name === 'style' || name === 'href' || name === 'srcset' || name === 'action' || name === 'formaction') {
                    node.removeAttribute(attr.name);
                    return;
                }
                if (name === 'src') {
                    if (tag === 'img' && (/^data:image\//i.test(value) || isAllowedFakeLinkImageUrlForRender(value))) {
                        node.setAttribute('src', value);
                        node.setAttribute('loading', 'lazy');
                    } else {
                        node.removeAttribute(attr.name);
                    }
                    return;
                }
                if (name === 'type' && tag === 'button') {
                    node.setAttribute('type', 'button');
                    return;
                }
                if (name === 'class' || name === 'role' || name === 'title' || name === 'aria-label' || name.indexOf('data-') === 0) {
                    node.setAttribute(attr.name, value);
                    return;
                }
                node.removeAttribute(attr.name);
            });
            if (tag === 'button' && !node.getAttribute('type')) node.setAttribute('type', 'button');
            sanitizeFakeLinkElementTree(node);
        });
    }

    function sanitizeFakeLinkHtmlForRender(value) {
        const html = cleanFakeLinkText(value, 80000);
        if (!html) return '';
        if (typeof document === 'undefined' || !document.createElement) {
            return html
                .replace(/<\s*(script|style|iframe|object|embed|form|input|textarea|select|option)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
                .replace(/<\s*\/?\s*(script|style|iframe|object|embed|form|input|textarea|select|option)[^>]*>/gi, '')
                .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
                .replace(/\s+(href|src|srcset|action|formaction)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
        }
        const template = document.createElement('template');
        template.innerHTML = html;
        sanitizeFakeLinkElementTree(template.content);
        return template.innerHTML;
    }

    function normalizeFakeLinkWebPageForRender(source = {}) {
        const safeSource = source && typeof source === 'object' ? source : {};
        const rawHtml = safeSource.html || safeSource.bodyHtml || '';
        const html = safeSource.js && window.imChat?.sanitizeFakeLinkHtmlForStorage
            ? window.imChat.sanitizeFakeLinkHtmlForStorage(rawHtml)
            : sanitizeFakeLinkHtmlForRender(rawHtml);
        const css = sanitizeFakeLinkCssText(safeSource.css || safeSource.style || '');
        const js = sanitizeFakeLinkJsText(safeSource.js || '');
        const rawInteractions = Array.isArray(safeSource.interactions) ? safeSource.interactions : [];
        return {
            theme: cleanFakeLinkText(safeSource.theme || 'generic', 40).toLowerCase() || 'generic',
            html,
            css,
            js,
            interactions: rawInteractions.map(normalizeFakeLinkInteractionForRender).filter(Boolean).slice(0, 24),
            source: cleanFakeLinkText(safeSource.source || '', 30)
        };
    }

    function sanitizeFakeLinkPagePackage(webPage = {}) {
        return normalizeFakeLinkWebPageForRender(webPage);
    }

    function scopeFakeLinkCss(css, scopeSelector) {
        const safeCss = sanitizeFakeLinkCssText(css);
        if (!safeCss) return '';
        return safeCss.replace(/(^|})\s*([^@}{][^{]+)\{/g, (match, closeBrace, selectors) => {
            const scopedSelectors = selectors
                .split(',')
                .map(selector => selector.trim())
                .filter(Boolean)
                .map(selector => selector.indexOf(scopeSelector) === 0 ? selector : scopeSelector + ' ' + selector)
                .join(', ');
            return closeBrace + ' ' + scopedSelectors + '{';
        });
    }

    function safeQueryAll(root, selector) {
        try {
            return Array.from(root.querySelectorAll(selector));
        } catch (_) {
            return [];
        }
    }

    function bindFakeLinkInteractions(root, interactions = []) {
        if (!root || !Array.isArray(interactions)) return;
        interactions.forEach((interaction) => {
            const normalized = normalizeFakeLinkInteractionForRender(interaction);
            if (!normalized) return;
            safeQueryAll(root, normalized.selector).forEach((trigger) => {
                trigger.addEventListener('click', (event) => {
                    event.preventDefault();
                    const target = safeQueryAll(root, normalized.targetSelector)[0] || trigger;
                    if (normalized.type === 'switchPanel') {
                        const targetName = trigger.getAttribute('data-fake-target') || target.getAttribute('data-fake-panel') || '';
                        const groupSelector = normalized.panelGroup
                            ? '[data-fake-panel-group="' + normalized.panelGroup + '"]'
                            : '[data-fake-panel]';
                        safeQueryAll(root, groupSelector).forEach(panel => {
                            const active = targetName && panel.getAttribute('data-fake-panel') === targetName;
                            panel.hidden = !active;
                            panel.classList.toggle('is-active', active);
                        });
                        return;
                    }
                    if (normalized.type === 'toggleText') {
                        const isActive = target.classList.toggle(normalized.className);
                        if (normalized.activeText || normalized.inactiveText) {
                            target.textContent = isActive
                                ? (normalized.activeText || target.textContent)
                                : (normalized.inactiveText || target.textContent);
                        }
                        return;
                    }
                    if (normalized.type === 'increment') {
                        const countNode = normalized.countSelector
                            ? (safeQueryAll(root, normalized.countSelector)[0] || null)
                            : target;
                        if (countNode) {
                            const counted = trigger.dataset.fakeIncremented === 'true';
                            const current = Number(String(countNode.textContent || '').replace(/[^\d.-]/g, '')) || 0;
                            countNode.textContent = String(Math.max(0, current + (counted ? -1 : 1)));
                            trigger.dataset.fakeIncremented = counted ? 'false' : 'true';
                        }
                        return;
                    }
                    target.classList.toggle(normalized.className);
                });
            });
        });
    }

    function renderFakeLinkWebPage(host, webPage = {}) {
        if (!host) return false;
        const pagePackage = sanitizeFakeLinkPagePackage(webPage);
        if (!pagePackage.html) return false;
        if (pagePackage.js) {
            const buildSandboxDocument = window.imChat?.buildFakeLinkSandboxDocument;
            if (typeof buildSandboxDocument !== 'function') return false;
            host.innerHTML = '';
            const frame = document.createElement('iframe');
            frame.className = 'im-fake-link-detail-iframe';
            frame.setAttribute('sandbox', 'allow-scripts');
            frame.setAttribute('referrerpolicy', 'no-referrer');
            frame.setAttribute('title', '链接小剧场');
            frame.srcdoc = buildSandboxDocument(pagePackage);
            host.appendChild(frame);
            return finalizeRenderedMessage(msg, friend, container);
        }
        const pageId = 'fake-link-page-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        const scopeSelector = '[data-fake-page-id="' + pageId + '"]';
        host.innerHTML = '';
        const style = document.createElement('style');
        style.className = 'im-fake-link-web-style';
        style.textContent = scopeFakeLinkCss(pagePackage.css, scopeSelector);
        const root = document.createElement('div');
        root.className = 'im-fake-link-web-root';
        root.setAttribute('data-fake-page-id', pageId);
        root.setAttribute('data-theme', pagePackage.theme || 'generic');
        root.innerHTML = pagePackage.html;
        host.appendChild(style);
        host.appendChild(root);
        bindFakeLinkInteractions(root, pagePackage.interactions);
        return true;
    }

    function normalizeFakeLinkDisplayValue(value) {
        const raw = cleanFakeLinkText(value, 220);
        if (!raw) return '';
        if (window.imChat?.normalizeFakeLinkDomain) {
            const normalized = window.imChat.normalizeFakeLinkDomain(raw);
            if (normalized) return normalized;
        }
        try {
            const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
            const domain = parsed.hostname.toLowerCase();
            const path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
            return (domain + path + (parsed.search || '')).replace(/\/+$/, '');
        } catch (_) {
            return raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '').slice(0, 180);
        }
    }

    function normalizeFakeLinkDataForRender(msg = {}) {
        const source = msg.fakeLinkData && typeof msg.fakeLinkData === 'object'
            ? msg.fakeLinkData
            : {};
        const displayUrl = normalizeFakeLinkDisplayValue(
            source.displayUrl || source.canonicalUrl || msg.content || ''
        );
        const domain = cleanFakeLinkText(source.domain || (displayUrl.split(/[/?#]/)[0] || ''), 120);
        const siteName = cleanFakeLinkText(source.siteName || source.platformLabel || source.author || domain || '假网页', 80);
        const title = cleanFakeLinkText(source.title || msg.title || domain || '假网页', 180);
        const summary = cleanFakeLinkText(source.summary || source.description || '', 800);
        const bodyText = cleanFakeLinkText(source.bodyText || source.content || '', 50000);
        const rawWebPage = source.webPage && typeof source.webPage === 'object' ? source.webPage : null;
        const webPage = rawWebPage ? normalizeFakeLinkWebPageForRender(rawWebPage) : null;
        return {
            domain,
            displayUrl,
            siteName,
            title,
            summary,
            bodyText,
            webPage: webPage && webPage.html ? webPage : null,
            prompt: cleanFakeLinkText(source.prompt || '', 1000),
            generatedBy: cleanFakeLinkText(source.generatedBy || 'manual', 40),
            createdAt: Number(source.createdAt || msg.timestamp) || Date.now()
        };
    }

    function ensureFakeLinkDetailOverlay() {
        let overlay = document.getElementById('im-fake-link-detail-overlay');
        const host = document.getElementById('app') || document.body;
        if (overlay) {
            if (overlay.parentNode !== host) host.appendChild(overlay);
            return overlay;
        }
        overlay = document.createElement('div');
        overlay.id = 'im-fake-link-detail-overlay';
        overlay.className = 'bottom-sheet-overlay detail-sheet-overlay wb-centered-modal-overlay im-fake-link-detail-overlay';
        overlay.style.display = 'none';
        overlay.innerHTML = [
            '<div class="bottom-sheet wb-centered-modal-card im-fake-link-detail-sheet">',
            '  <div class="im-fake-link-browser-bar">',
            '    <button type="button" class="im-fake-link-browser-close" aria-label="关闭"><i class="fas fa-chevron-left"></i></button>',
            '    <div class="im-fake-link-address"></div>',
            '    <span></span>',
            '  </div>',
            '  <article class="im-fake-link-page">',
            '    <div class="im-fake-link-page-legacy">',
            '      <div class="im-fake-link-page-site"></div>',
            '      <h1 class="im-fake-link-page-title"></h1>',
            '      <p class="im-fake-link-page-summary"></p>',
            '      <div class="im-fake-link-page-body"></div>',
            '    </div>',
            '    <div class="im-fake-link-web-host" hidden></div>',
            '  </article>',
            '</div>'
        ].join('');
        const closeOverlay = () => {
            if (window.closeView) window.closeView(overlay);
            else overlay.style.display = 'none';
        };
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay || event.target.closest('.im-fake-link-browser-close')) {
                closeOverlay();
            }
        });
        host.appendChild(overlay);
        return overlay;
    }

    function openFakeLinkDetail(msg = {}, friend = null) {
        const overlay = ensureFakeLinkDetailOverlay();
        const data = normalizeFakeLinkDataForRender(msg);
        const address = overlay.querySelector('.im-fake-link-address');
        const site = overlay.querySelector('.im-fake-link-page-site');
        const title = overlay.querySelector('.im-fake-link-page-title');
        const summary = overlay.querySelector('.im-fake-link-page-summary');
        const body = overlay.querySelector('.im-fake-link-page-body');
        const pageEl = overlay.querySelector('.im-fake-link-page');
        const legacy = overlay.querySelector('.im-fake-link-page-legacy');
        const webHost = overlay.querySelector('.im-fake-link-web-host');
        let useWebPage = false;
        if (data.webPage && data.webPage.html && webHost) {
            try {
                useWebPage = renderFakeLinkWebPage(webHost, data.webPage);
            } catch (error) {
                console.warn('[iMessage fake link] detail render failed, falling back to text view', error);
                useWebPage = false;
            }
        }
        if (!useWebPage && webHost) webHost.innerHTML = '';
        if (pageEl) pageEl.classList.toggle('is-webpage', useWebPage);
        if (legacy) legacy.hidden = useWebPage;
        if (webHost) webHost.hidden = !useWebPage;
        if (address) address.textContent = data.displayUrl || data.domain || 'fake.local';
        if (site) site.textContent = data.siteName || data.domain || '假网页';
        if (title) title.textContent = data.title || data.siteName || '假网页';
        if (summary) {
            summary.textContent = data.summary || '';
            summary.style.display = summary.textContent ? 'block' : 'none';
        }
        if (body) {
            body.textContent = data.bodyText || data.summary || '这个假网页暂时没有正文内容。';
        }
        overlay.style.display = 'flex';
        if (window.openView) window.openView(overlay);
        else overlay.classList.add('active');
    }

 function renderFakeLinkBubble(msg, friend, container, timestamp = Date.now()) {
        const isUser = msg.role === 'user';
        const isGroupMessage = !isUser && friend.type === 'group';
        const safeSpeaker = isGroupMessage && window.imChat.getGroupMessageSpeaker
            ? window.imChat.getGroupMessageSpeaker(friend, msg)
            : null;
        const speakerName = isGroupMessage
            ? ((safeSpeaker && safeSpeaker.nickname) || msg.speaker || msg.senderName || 'Group member')
            : null;
        const speakerAvatar = (safeSpeaker && safeSpeaker.avatarUrl) || msg.senderAvatarUrl || null;
        const rows = Array.from(container.children).filter(el => !el.classList.contains('chat-timestamp') && !el.classList.contains('typing-row'));
        const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
        let hasPrev = false;
        let sameSpeaker = false;

        if (lastRow) {
            if (isUser && lastRow.classList.contains('user-row')) {
                hasPrev = true;
                lastRow.classList.add('has-next');
            } else if (!isUser && lastRow.classList.contains('ai-row')) {
                const previousSpeaker = lastRow.getAttribute('data-speaker') || null;
                if (isGroupMessage && previousSpeaker === speakerName) {
                    hasPrev = true;
                    sameSpeaker = true;
                    lastRow.classList.add('has-next');
                } else if (!isGroupMessage && !previousSpeaker) {
                    hasPrev = true;
                    lastRow.classList.add('has-next');
                }
            }
        }

        const fakeLinkData = normalizeFakeLinkDataForRender(msg);
        const displayUrl = fakeLinkData.displayUrl;
        const host = fakeLinkData.domain || displayUrl;
        const platformLabel = fakeLinkData.siteName || '假网页';
        const pageTheme = fakeLinkData.webPage?.theme || '';
        const cardColor = pageTheme === 'xiaohongshu' ? '#ff2442' : '#3a3a3c';
        const title = fakeLinkData.title || platformLabel || '假网页';
        const summary = fakeLinkData.summary || fakeLinkData.bodyText.slice(0, 120);
        const author = '';
        const coverUrl = '';
        const statusLabel = '站内假网页';
        const coverHtml = coverUrl
            ? `<img src="${escapeHtml(coverUrl)}" alt="">`
            : '<i class="fas fa-link"></i>';
        const effectiveStatusLabel = fakeLinkData.webPage
            ? (fakeLinkData.generatedBy === 'ai' ? 'AI 仿真网页' : '站内仿真网页')
            : statusLabel;

        const cardHtml = `
            <div class="chat-link-card" role="link" tabindex="0" style="--link-card-color:${escapeHtml(cardColor)};">
                <div class="chat-link-card-cover">${coverHtml}</div>
                <div class="chat-link-card-body">
                    <div class="chat-link-card-platform">${escapeHtml(platformLabel)}</div>
                    <div class="chat-link-card-title">${escapeHtml(title)}</div>
                    ${(author || summary) ? `<div class="chat-link-card-summary">${escapeHtml(author ? `${author}${summary ? ` · ${summary}` : ''}` : summary)}</div>` : ''}
                    <div class="chat-link-card-footer">
                        <span>${escapeHtml(host || displayUrl)}</span>
                        <strong>${escapeHtml(effectiveStatusLabel)}</strong>
                    </div>
                </div>
            </div>
        `;
        const bubbleHtml = `<div class="chat-bubble ${isUser ? 'user-bubble' : 'ai-bubble'} im-card-bubble" style="padding:0; background:transparent;">${cardHtml}</div>`;
        let bubbleWrapperHtml = bubbleHtml;

        if (isGroupMessage) {
            const avatarInitial = String(speakerName).trim().charAt(0) || '?';
            const avatarImg = speakerAvatar
                ? `<img src="${escapeHtml(speakerAvatar)}" onerror="this.src='assets/moren-thumb.jpg'" loading="lazy" decoding="async" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">`
                : `<div class="chat-avatar-small">${escapeHtml(avatarInitial)}</div>`;
            bubbleWrapperHtml = `
                <div class="group-ai-bubble-wrap">
                    ${sameSpeaker ? '' : `<div class="group-ai-speaker-name">${escapeHtml(speakerName)}</div>`}
                    <div class="group-ai-bubble-row">
                        <div class="group-ai-avatar-slot">${sameSpeaker ? '<div class="group-ai-avatar-placeholder"></div>' : avatarImg}</div>
                        ${bubbleHtml}
                    </div>
                </div>
            `;
        }

        const row = document.createElement('div');
        row.className = `chat-row ${isUser ? 'user-row' : 'ai-row'} ${hasPrev ? 'has-prev' : ''} ${isGroupMessage ? 'group-ai-row' : ''} ${isGroupMessage && sameSpeaker ? 'group-ai-row-continuous' : ''}`;
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'link'));
        if (speakerName) row.setAttribute('data-speaker', speakerName);
        setGroupRowMemberId(row, friend, msg);
        setGroupUserRowIdentity(row, friend, msg);
        const headerHtml = buildMessageHeaderHtml(isUser, friend, timestamp, speakerName, speakerAvatar, hasPrev, msg);
        row.innerHTML = `
            <div class="chat-checkbox-wrapper" style="display:${window.imData.batchSelectMode ? 'flex' : 'none'};width:40px;justify-content:center;align-items:flex-end;padding-bottom:10px;flex-shrink:0;cursor:pointer;transition:all 0.2s;">
                <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color:#c7c7cc;font-size:22px;"></i>
            </div>
            <div style="flex:1;display:flex;flex-direction:column;min-width:0;">
                ${headerHtml}
                <div style="display:flex;justify-content:${isUser ? 'flex-end' : 'flex-start'};align-items:flex-end;width:100%;">
                    ${bubbleWrapperHtml}
                </div>
            </div>
        `;

        const card = row.querySelector('.chat-link-card');
        const openFakeLink = (event) => {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            openFakeLinkDetail(msg, friend);
        };
        if (card) {
            card.addEventListener('click', openFakeLink);
            card.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') openFakeLink(event);
            });
        }
        const coverImage = row.querySelector('.chat-link-card-cover img');
        if (coverImage) {
            coverImage.addEventListener('error', () => {
                const cover = coverImage.closest('.chat-link-card-cover');
                if (cover) cover.innerHTML = '<i class="fas fa-link"></i>';
            }, { once: true });
        }

        container.appendChild(row);
        window.imChat.scrollToBottom(container);
    }

    function getOfflineMeetingSummaryText(msg = {}) {
        const explicitSummary = String(msg.summary || '').trim();
        if (explicitSummary) return explicitSummary;

        const rawSummary = String(msg.rawSummary || '').trim();
        const rawMatch = rawSummary.match(/(?:见面内容|总结)[:：]\s*([\s\S]+)$/);
        if (rawMatch?.[1]?.trim()) return rawMatch[1].trim();

        const contentParts = String(msg.content || '')
            .split(/\n\s*\n/)
            .map(part => part.trim())
            .filter(Boolean);
        if (contentParts.length >= 3) return contentParts.slice(2).join('\n\n');
        return contentParts.join('\n\n') || '暂无见面总结';
    }

    function formatOfflineMeetingTimestamp(timestamp) {
        const value = Number(timestamp) || Date.now();
        const date = new Date(value);
        const pad = (num) => String(num).padStart(2, '0');
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function renderOfflineMeetingDetailReadMode(contentEl, msg) {
        contentEl.innerHTML = `
            <div style="white-space:pre-wrap; word-break:break-word; line-height:1.7; color:#111; font-size:15px;">${escapeHtml(getOfflineMeetingSummaryText(msg))}</div>
        `;
    }

    function resolveOfflineMeetingDetailMessage(msg, friend) {
        const sessionId = String(msg?.offlineSessionId || '');
        const session = sessionId && Array.isArray(friend?.offlineMeetingSessions)
            ? friend.offlineMeetingSessions.find(item => String(item?.id || '') === sessionId)
            : null;
        if (!session) return msg;
        return {
            ...msg,
            dateText: msg.dateText || session.dateText || '',
            title: msg.title || session.title || '',
            summary: msg.summary || session.summary || '',
            rawSummary: msg.rawSummary || session.rawSummary || '',
            meetingMessages: Array.isArray(session.messages) ? session.messages : []
        };
    }

    function ensureOfflineMeetingDetailModal() {
        let modal = document.getElementById('offline-meeting-detail-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'offline-meeting-detail-modal';
        modal.className = 'bottom-sheet-overlay detail-sheet-overlay wb-centered-modal-overlay';
        modal.style.zIndex = '1060';
        modal.innerHTML = `
            <div class="bottom-sheet wb-centered-modal-card" style="width:min(calc(100% - 40px), 420px); max-height:min(72%, 620px); padding:0; border-radius:24px; background:#fff; display:flex; flex-direction:column; overflow:hidden;">
                <div style="display:flex; align-items:center; justify-content:space-between; padding:17px 18px 14px; border-bottom:1px solid rgba(17,17,17,0.08);">
                    <button id="offline-meeting-detail-close-btn" type="button" style="border:none; background:transparent; color:#007aff; font-size:16px; font-weight:700; cursor:pointer;">关闭</button>
                    <div style="font-size:17px; font-weight:800;">见面总结</div>
                    <button id="offline-meeting-detail-delete-btn" type="button" style="border:none; background:transparent; color:#ff3b30; font-size:16px; font-weight:700; cursor:pointer;">删除</button>
                </div>
                <div id="offline-meeting-detail-content" class="detail-sheet-content" style="flex:1; overflow-y:auto; padding:18px 20px 22px;"></div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    window.imChat.openOfflineMeetingDetail = function(msg, friend = null) {
        const detailModal = ensureOfflineMeetingDetailModal();
        const detailContent = document.getElementById('offline-meeting-detail-content');
        const closeBtn = document.getElementById('offline-meeting-detail-close-btn');
        const deleteBtn = document.getElementById('offline-meeting-detail-delete-btn');
        const detailFriend = friend || window.imData?.currentActiveFriend || null;
        if (!detailModal || !detailContent) return;

        if (closeBtn) {
            closeBtn.onclick = () => {
                if (window.closeView) window.closeView(detailModal);
                else detailModal.style.display = 'none';
            };
        }

        const detailMessage = resolveOfflineMeetingDetailMessage(msg, detailFriend);
        if (deleteBtn) {
            const canDelete = !!detailMessage?.offlineSessionId && typeof window.imChat.confirmDeleteOfflineMeetingRecord === 'function';
            deleteBtn.style.visibility = canDelete ? 'visible' : 'hidden';
            deleteBtn.disabled = !canDelete;
            deleteBtn.onclick = () => {
                if (!canDelete) return;
                window.imChat.confirmDeleteOfflineMeetingRecord(detailFriend, detailMessage, deleteBtn, {
                    onDeleted: () => {
                        if (window.closeView) window.closeView(detailModal);
                        else detailModal.style.display = 'none';
                    }
                });
            };
        }

        renderOfflineMeetingDetailReadMode(detailContent, detailMessage);
        if (window.openView) window.openView(detailModal);
        else detailModal.style.display = 'flex';
    };

    function renderOfflineMeetingRecordBubble(msg, friend, container, timestamp = Date.now()) {
        const row = document.createElement('div');
        row.className = 'chat-system-row';
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'meeting'));

        const dateText = msg.dateText || formatOfflineMeetingTimestamp(timestamp);
        const title = '见面记录';

        row.innerHTML = `
            <div style="width:100%; display:flex; justify-content:center; padding:2px 0; margin:10px 0;">
                <div class="voice-call-record-card im-card-content offline-meeting-record-card" aria-label="查看见面总结" style="max-width:84%; padding:11px 15px; border-radius:18px; background:rgba(0,0,0,0.05); color:#000; display:flex; align-items:flex-start; gap:10px; text-align:left;">
                    <div style="width:32px; height:32px; border-radius:16px; background:#34c759; color:#fff; display:flex; justify-content:center; align-items:center; flex-shrink:0;">
                        <i class="fas fa-user-friends"></i>
                    </div>
                    <div style="min-width:0;">
                        <div style="font-size:15px; font-weight:800; line-height:1.25;">${escapeHtml(title)}</div>
                        <div style="font-size:12px; color:#8e8e93; margin-top:2px;">${escapeHtml(dateText)}</div>
                    </div>
                </div>
            </div>
        `;

        const card = row.querySelector('.offline-meeting-record-card');
        if (card) {
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            const openDetail = () => window.imChat.openOfflineMeetingDetail(msg, friend);
            card.addEventListener('click', openDetail);
            card.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                openDetail();
            });
        }

        container.appendChild(row);
        window.imChat.scrollToBottom(container);
    }

    window.imChat.renderSystemNoticeBubble = renderSystemNoticeBubble;
    window.imChat.renderOfflineMeetingRecordBubble = renderOfflineMeetingRecordBubble;
    window.imChat.renderGroupRedPacketBubble = renderGroupRedPacketBubble;
    window.imChat.renderStickerMessageBubble = renderStickerMessageBubble;
    window.imChat.openRecalledMessageDetail = openRecalledMessageDetail;
    window.imChat.renderMessageBubble = renderMessageBubble;
    window.imChat.renderGroupPollBubble = renderGroupPollBubble;
    window.imChat.appendMessageToContainer = appendMessageToContainer;
    window.imChat.replaceMessageInContainer = replaceMessageInContainer;
    window.imChat.removeMessageFromContainer = removeMessageFromContainer;
    window.imChat.rerenderChatContainer = rerenderChatContainer;
    window.imChat.renderChatHistory = renderChatHistory;
    window.imChat.isChatHistoryRenderCurrent = isChatHistoryRenderCurrent;
    window.imChat.scrollToBottom = scrollToBottom;
    window.imChat.renderTimestamp = renderTimestamp;
    window.imChat.renderMessageBubble = renderMessageBubble;
    window.imChat.renderCotSummaryCard = renderCotSummaryCard;
    window.imChat.renderUserBubble = renderUserBubble;
    window.imChat.syncGroupUserAvatarState = syncGroupUserAvatarState;
    window.imChat.renderAiBubble = renderAiBubble;
    window.imChat.renderImageBubble = renderImageBubble;
    window.imChat.renderFakeLinkBubble = renderFakeLinkBubble;
    window.imChat.sanitizeFakeLinkPagePackage = sanitizeFakeLinkPagePackage;
    window.imChat.renderFakeLinkWebPage = renderFakeLinkWebPage;
    window.imChat.stripFakeLinkHtmlToPlainText = stripFakeLinkHtmlToPlainText;
    window.imChat.renderPayTransferBubble = renderPayTransferBubble;
    window.imChat.renderVoiceMessageBubble = renderVoiceMessageBubble;
    function renderHtmlBubble(msg, friend, container, timestamp = Date.now()) {
        const isUser = msg.role === 'user';
        const lastRow = container.lastElementChild;
        let hasPrev = false;

        if (lastRow) {
            if (isUser && lastRow.classList.contains('user-row')) {
                hasPrev = true;
                lastRow.classList.add('has-next');
            } else if (!isUser && lastRow.classList.contains('ai-row')) {
                hasPrev = true;
                lastRow.classList.add('has-next');
            }
        }

        const row = document.createElement('div');
        row.className = `chat-row ${isUser ? 'user-row' : 'ai-row'} ${hasPrev ? 'has-prev' : ''}`;
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'html'));
        setGroupUserRowIdentity(row, friend, msg);

        const contentHtml = msg.content || msg.text || '';
        const headerHtml = buildMessageHeaderHtml(isUser, friend, timestamp, null, null, hasPrev, msg);

        const date = new Date(timestamp);
        const timeStr = typeof window.formatChatBubbleTime === 'function' ? window.formatChatBubbleTime(timestamp) : `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;

        if (isUser) {
            const metaHtml = "";
            row.innerHTML = `
                <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                    <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                    ${headerHtml}
                    <div style="display: flex; justify-content: flex-end; align-items: flex-end; width: 100%;">
                        <div class="chat-bubble html-bubble im-card-bubble" style="position: relative; background: transparent; padding: 0;">
                            ${contentHtml}
                            <div style="position: absolute; bottom: 8px; right: -30px;">${metaHtml}</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            const metaHtml = "";
            row.innerHTML = `
                <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                    <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                    ${headerHtml}
                    <div style="display: flex; justify-content: flex-start; align-items: flex-end; width: 100%;">
                        <div class="chat-bubble html-bubble im-card-bubble" style="position: relative; background: transparent; padding: 0;">
                            ${contentHtml}
                            <div style="position: absolute; bottom: 8px; right: -25px;">${metaHtml}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        container.appendChild(row);
        window.imChat.scrollToBottom(container);
    }

function renderVoiceCallRecordBubble(msg, friend, container, timestamp = Date.now()) {
        const isSystem = msg.role === 'system';
        const isUser = msg.senderId === (window.imData.currentUser ? window.imData.currentUser.id : 'me') || msg.senderId === '__user__' || isSystem;
        
        if (isSystem && friend.type === 'group') {
            // Group call record
            const row = document.createElement('div');
            row.className = 'chat-system-row';
            row.setAttribute('data-timestamp', timestamp);
            row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'notice'));
            row.innerHTML = `
                <div style="width:100%; display:flex; justify-content:center; padding:2px 0; margin: 10px 0; cursor: pointer;">
                    <div class="voice-call-record-card im-card-content" style="max-width:80%; padding:10px 16px; border-radius:18px; background:rgba(0,0,0,0.05); color:#000; font-size:13px; line-height:1.4; text-align:center; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-phone-alt" style="color: #34c759;"></i>
                        <span>${msg.statusText || '群通话记录'}</span>
                    </div>
                </div>
            `;
            
            const clickableCard = row.querySelector('.voice-call-record-card');
            if (clickableCard) {
                clickableCard.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.imChat && window.imChat.openVoiceCallDetail) {
                        window.imChat.openVoiceCallDetail(msg, friend);
                    }
                });
            }

            container.appendChild(row);
            window.imChat.scrollToBottom(container);
            return;
        }

        const row = document.createElement('div');
        row.className = `chat-row ${isUser ? 'user-row' : 'ai-row'}`;
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'call'));
        setGroupUserRowIdentity(row, friend, msg);

        const duration = msg.duration || 0;
        const m = Math.floor(duration / 60).toString().padStart(2, '0');
        const s = (duration % 60).toString().padStart(2, '0');
        const durationText = `${m}:${s}`;
        const title = msg.isVideo ? '视频通话' : '语音通话';
        const statusText = msg.statusText || '通话记录';
        
        let subtitleHtml = '';
        if (statusText === '已拒绝' || statusText === '已取消') {
            subtitleHtml = `<div style="font-size: 13px; color: #ff3b30; margin-top: 2px; font-weight: 500;">${statusText}</div>`;
        } else {
            subtitleHtml = `<div style="font-size: 13px; color: #8e8e93; margin-top: 2px;">通话时长 ${durationText}</div>`;
        }

        const contentHtml = `
            <div class="voice-call-record-card im-card-content" style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: ${isUser ? '#e5e5ea' : '#f2f2f7'}; border-radius: 18px; cursor: pointer; color: #111;">
                <div style="width: 32px; height: 32px; border-radius: 16px; background: ${statusText === '已拒绝' || statusText === '已取消' ? '#ff3b30' : '#34c759'}; color: #fff; display: flex; justify-content: center; align-items: center; flex-shrink: 0;">
                    <i class="fas fa-phone-alt"></i>
                </div>
                <div>
                    <div style="font-size: 15px; font-weight: 600;">${title}</div>
                    ${subtitleHtml}
                </div>
            </div>
        `;

        const timeStr = typeof window.formatChatBubbleTime === 'function' ? window.formatChatBubbleTime(timestamp) : (() => {
            const date = new Date(timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        })();

        // For voice call record, it uses simplified DOM structure, but we still need header. 
        // Note: It doesn't have hasPrev tracking in its code properly, let's just assume false as it lacks context, or compute if possible.
        // Actually it doesn't compute hasPrev. I'll just pass false for hasPrev as it doesn't track it, 
        // but wait, is it worth adding? No, VoiceCallRecord is usually a system notice or independent item.
        const headerHtml = buildMessageHeaderHtml(isUser, friend, timestamp, null, null, false, msg);

        if (isUser) {
            const metaHtml = "";
            row.innerHTML = `
                <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                    ${headerHtml}
                    <div style="display: flex; justify-content: flex-end; align-items: flex-end; width: 100%;">
                        <div class="chat-bubble user-bubble im-card-bubble voice-call-record-bubble" style="padding: 0; background: transparent;">${contentHtml}${metaHtml}</div>
                    </div>
                </div>
            `;
        } else {
            const metaHtml = "";
            row.innerHTML = `
                <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                    ${headerHtml}
                    <div style="display: flex; justify-content: flex-start; align-items: flex-end; width: 100%;">
                        <div class="chat-bubble ai-bubble im-card-bubble voice-call-record-bubble" style="padding: 0; background: transparent;">${contentHtml}${metaHtml}</div>
                    </div>
                </div>
            `;
        }

        const clickableCard = row.querySelector('.voice-call-record-card');
        if (clickableCard) {
            clickableCard.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.imChat && window.imChat.openVoiceCallDetail) {
                    window.imChat.openVoiceCallDetail(msg, friend);
                }
            });
        }

        container.appendChild(row);
        window.imChat.scrollToBottom(container);
    }

    window.imChat.renderMomentForwardBubble = renderMomentForwardBubble;
    window.imChat.renderVoiceCallRecordBubble = renderVoiceCallRecordBubble;
    window.imChat.renderHtmlBubble = renderHtmlBubble;

});
