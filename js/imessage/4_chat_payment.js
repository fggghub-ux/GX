
// ==========================================
// IMESSAGE: 4_chat_payment.js
// ==========================================
(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    const { apiConfig, userState } = window;
    window.imChat = window.imChat || {};
    const imChat = window.imChat;

async function commitPaymentFriendChange(friendOrId, mutator, options = {}) {
        if (!window.imApp.commitFriendChange) return false;
        const targetId = typeof friendOrId === 'object' && friendOrId !== null ? friendOrId.id : friendOrId;

        return window.imApp.commitFriendChange(targetId, (targetFriend) => {
            if (!targetFriend) return;
            if (window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(targetFriend.id)) {
                window.imData.currentActiveFriend = targetFriend;
            }
            return mutator(targetFriend);
        }, options);
    }

function getGroupMemberFriends(group) {
        if (!group || group.type !== 'group' || !Array.isArray(group.members)) return [];
        const resolvedIds = new Set();
        return group.members
            .map(memberRef => {
                const normalizedRef = String(memberRef == null ? '' : memberRef).trim();
                if (!normalizedRef) return null;
                return window.imData.friends.find(item => {
                    if (!item || (item.type !== 'char' && item.type !== 'npc')) return false;
                    return String(item.id) === normalizedRef
                        || String(item.nickname || '').trim() === normalizedRef
                        || String(item.realName || '').trim() === normalizedRef;
                }) || null;
            })
            .filter(member => {
                if (!member) return false;
                const memberId = String(member.id);
                if (resolvedIds.has(memberId)) return false;
                resolvedIds.add(memberId);
                return true;
            });
    }

    function getCanonicalGroupMemberIds(group) {
        return getGroupMemberFriends(group).map(member => String(member.id));
    }

function normalizeGroupSpeaker(group, rawSpeakerName, speakerMemberId = null) {
        if (!group || group.type !== 'group') return null;
        const groupMembers = window.imChat.getGroupMemberFriends(group);
        if (groupMembers.length === 0) return null;

        if (speakerMemberId != null && String(speakerMemberId).trim()) {
            const idMatch = groupMembers.find(member => String(member.id) === String(speakerMemberId));
            if (idMatch) return idMatch;
        }

        const safeName = String(rawSpeakerName || '').trim();
        if (!safeName) return null;

        const exactMatch = groupMembers.find(member => member.nickname === safeName || member.realName === safeName);
        if (exactMatch) return exactMatch;

        const normalizedTarget = safeName.toLowerCase();
        const fuzzyMatch = groupMembers.find(member => [member.nickname, member.realName]
            .some(value => String(value || '').trim().toLowerCase() === normalizedTarget));
        return fuzzyMatch || null;
    }

function getGroupMessageSpeaker(group, message = {}) {
        if (!message || typeof message !== 'object') return null;
        const directMatch = window.imChat.normalizeGroupSpeaker(
            group,
            message.speaker || message.senderName || '',
            message.speakerMemberId || message.senderMemberId || null
        );
        if (directMatch) return directMatch;

        const storedAvatar = String(message.senderAvatarUrl || '').trim();
        if (!storedAvatar) return null;
        const avatarMatches = window.imChat.getGroupMemberFriends(group)
            .filter(member => String(member?.avatarUrl || '').trim() === storedAvatar);
        return avatarMatches.length === 1 ? avatarMatches[0] : null;
    }

 function getSafeGroupSpeaker(group, preferredSpeakerName = null, speakerMemberId = null) {
        const normalized = window.imChat.normalizeGroupSpeaker(group, preferredSpeakerName, speakerMemberId);
        if (normalized) return normalized;

        const members = window.imChat.getGroupMemberFriends(group);
        return members.length > 0 ? members[0] : null;
    }

function getDisplayNameByMemberId(group, memberId) {
        if (!group || !memberId) return '群成员';
        const member = window.imChat.getGroupMemberFriends(group).find(item => String(item.id) === String(memberId));
        return member ? (member.nickname || member.realName || '群成员') : '群成员';
    }

function getPayUserName() {
        const currentUserState = window.userState || userState || {};
        return currentUserState.name || currentUserState.realName || currentUserState.nickname || 'User';
    }

function getPayFriendName(friend, fallback = '') {
        return fallback || friend?.nickname || friend?.realName || friend?.name || 'Char';
    }

function getPayUserAvatar() {
        const currentUserState = window.userState || userState || {};
        return currentUserState.avatarUrl || currentUserState.avatar || '';
    }

function getPayFriendAvatar(friend) {
        return friend?.avatarUrl || friend?.avatar || '';
    }

function normalizePayTransferMessage(msg = {}, friend = null) {
        const payKind = msg.payKind || (msg.role === 'user' ? 'user_to_char' : 'char_received');
        const userName = getPayUserName();
        const charName = getPayFriendName(friend, msg.speaker || msg.charName || '');
        const targetName = msg.targetName || '';
        const charToUserKinds = ['char_to_user_pending', 'char_to_user_claimed', 'user_received_from_char', 'user_rejected_from_char'];
        const claimedKinds = ['char_received', 'char_to_user_claimed', 'user_received_from_char'];
        const rejectedKinds = ['user_to_char_rejected', 'char_to_user_rejected', 'user_rejected_from_char'];
        const explicitDirection = msg.payDirection === 'char_to_user' || msg.payDirection === 'user_to_char'
            ? msg.payDirection
            : '';
        const direction = explicitDirection || (charToUserKinds.includes(payKind) ? 'char_to_user' : 'user_to_char');
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
            payerAvatar: payerType === 'user' ? getPayUserAvatar() : getPayFriendAvatar(friend),
            payeeAvatar: payeeType === 'user' ? getPayUserAvatar() : getPayFriendAvatar(friend),
            canCurrentUserClaim: direction === 'char_to_user' && status === 'pending' && !msg.claimed,
            senderName: payerName,
            receiverName: payeeName,
            senderType: payerType,
            receiverType: payeeType,
            isUserSender: payerType === 'user'
        };
    }

function resolvePayTransferParties(msg = {}, friend = null) {
        return normalizePayTransferMessage(msg, friend);
    }

    window.imChat.normalizePayTransferMessage = normalizePayTransferMessage;
    window.imChat.resolvePayTransferParties = resolvePayTransferParties;

function getAvailableGroupRecipients(group) {
        return window.imChat.getGroupMemberFriends(group).filter(member => member && member.type !== 'group');
    }

function getCurrentUserPacketMember(group) {
        if (window.imApp?.getGroupUserIdentity) {
            const identity = window.imApp.getGroupUserIdentity(group);
            return {
                id: '__user__',
                accountId: identity.accountId || null,
                nickname: identity.name,
                realName: identity.name,
                avatarUrl: identity.avatarUrl,
                persona: identity.persona,
                signature: identity.signature,
                type: 'user'
            };
        }
        const currentAccountId = typeof window.getCurrentAccountId === 'function' ? window.getCurrentAccountId() : null;
        const accounts = typeof window.getAccounts === 'function' ? window.getAccounts() : [];
        const currentAccount = accounts.find(acc => String(acc.id) === String(currentAccountId)) || null;
        const override = group && group.memory ? (group.memory.userOverride || null) : null;

        const fallbackName = (userState && (userState.name || userState.realName))
            || currentAccount?.name
            || '你';
        const fallbackAvatarUrl = (userState && (userState.avatarUrl || userState.avatar))
            || currentAccount?.avatarUrl
            || currentAccount?.avatar
            || '';

        return {
            id: '__user__',
            accountId: override?.id || currentAccount?.id || null,
            nickname: override?.name || fallbackName,
            realName: override?.name || fallbackName,
            avatarUrl: override?.avatarUrl || override?.avatar || fallbackAvatarUrl,
            persona: override?.persona || currentAccount?.persona || (userState ? userState.persona : '') || '',
            signature: override?.signature || currentAccount?.signature || '',
            type: 'user'
        };
    }

function getAllRedPacketParticipants(group) {
        const members = window.imChat.getAvailableGroupRecipients(group).slice();
        members.push(window.imChat.getCurrentUserPacketMember(group));
        return members;
    }

function getPacketSenderDisplayMeta(packetMsg, group, fallbackFriend = null) {
        if (!packetMsg) {
            return {
                id: '',
                name: fallbackFriend?.nickname || fallbackFriend?.realName || '发红包的人',
                avatarUrl: fallbackFriend?.avatarUrl || ''
            };
        }

        const senderMemberId = packetMsg.senderMemberId;
        if (String(senderMemberId) === '__user__') {
            const userMember = window.imChat.getCurrentUserPacketMember(group);
            return {
                id: userMember.id,
                name: packetMsg.senderName || userMember.nickname,
                avatarUrl: packetMsg.senderAvatarUrl || userMember.avatarUrl || ''
            };
        }

        const member = window.imChat.getAllRedPacketParticipants(group).find(item => String(item.id) === String(senderMemberId));
        return {
            id: senderMemberId || '',
            name: packetMsg.senderName || member?.nickname || member?.realName || fallbackFriend?.nickname || fallbackFriend?.realName || '发红包的人',
            avatarUrl: packetMsg.senderAvatarUrl || member?.avatarUrl || fallbackFriend?.avatarUrl || ''
        };
    }

function getCurrentUserClaimRecord(packetMsg) {
        if (!packetMsg || !Array.isArray(packetMsg.claimRecords)) return null;
        return packetMsg.claimRecords.find(item => String(item.memberId) === '__user__') || null;
    }

function createRedPacketClaimNoticeText(packetMsg, claimRecord, senderMeta) {
        if (!claimRecord) return '有人领取了红包';
        const claimerName = claimRecord.memberName || '有人';
        const senderName = senderMeta?.name || '对方';

        if (String(claimRecord.memberId) === '__user__') {
            return `你领取了${senderName}的红包`;
        }

        if (String(claimRecord.memberId) === String(senderMeta?.id)) {
            return `${claimerName}领取了自己发的红包`;
        }

        return `${claimerName}领取了${senderName}的红包`;
    }

function claimGroupRedPacketForMember(group, packetMsg, memberMeta, options = {}) {
        if (!group || !packetMsg || packetMsg.type !== 'group_red_packet' || !memberMeta) return null;

        window.imChat.normalizeGroupRedPacketState(packetMsg, group);
        if (packetMsg.isFinished) return null;

        const memberId = String(memberMeta.id);
        const alreadyClaimedSet = new Set((packetMsg.claimedMemberIds || []).map(String));
        if (alreadyClaimedSet.has(memberId)) {
            return packetMsg.claimRecords.find(item => String(item.memberId) === memberId) || null;
        }

        const nextIndex = Array.isArray(packetMsg.claimRecords) ? packetMsg.claimRecords.length : 0;
        const amount = Number((packetMsg.allocations || [])[nextIndex] || 0);
        if (!amount || amount <= 0) {
            window.imChat.normalizeGroupRedPacketState(packetMsg, group);
            return null;
        }

        const claimRecord = {
            memberId: memberMeta.id,
            memberName: memberMeta.nickname || memberMeta.realName || '群成员',
            amount,
            claimedAt: options.claimedAt || Date.now()
        };

        packetMsg.claimRecords.push(claimRecord);
        packetMsg.claimedMemberIds.push(memberId);
        packetMsg.deferAutoClaimUntilNextTurn = false;

        window.imChat.normalizeGroupRedPacketState(packetMsg, group);
        
        // 抢到红包同步到PayApp
        if (String(memberId) === '__user__' && typeof window.addPayTransaction === 'function' && amount > 0) {
            const senderName = packetMsg.senderName || '群成员';
            window.addPayTransaction(
                amount,
                `${packetMsg.description || '群红包'} · 抢到红包 · ${senderName}`,
                'income'
            );
        }

        if (!options.silentNotice) {
            const senderMeta = window.imChat.getPacketSenderDisplayMeta(packetMsg, group);
            group.messages.push({
                id: window.imChat.createMessageId('notice'),
                type: 'system_notice',
                noticeKind: 'red_packet_claim',
                text: window.imChat.createRedPacketClaimNoticeText(packetMsg, claimRecord, senderMeta),
                relatedPacketId: packetMsg.packetId || packetMsg.id,
                timestamp: claimRecord.claimedAt
            });
        }

        return claimRecord;
    }

function createRedPacketAllocations(totalAmount, packetCount) {
        const centsTotal = Math.round((Number(totalAmount) || 0) * 100);
        const count = Math.max(1, parseInt(packetCount, 10) || 1);
        if (centsTotal < count) return [];

        let remaining = centsTotal;
        const allocations = [];

        for (let i = 0; i < count; i++) {
            const packetsLeft = count - i;
            if (packetsLeft === 1) {
                allocations.push(Number((remaining / 100).toFixed(2)));
                remaining = 0;
                break;
            }

            const minRemainingForOthers = packetsLeft - 1;
            const maxForCurrent = remaining - minRemainingForOthers;
            const average = Math.floor(remaining / packetsLeft);
            const upper = Math.max(1, Math.min(maxForCurrent, average * 2));
            const lower = 1;
            const current = Math.max(lower, Math.min(maxForCurrent, Math.floor(Math.random() * upper) + 1));

            allocations.push(Number((current / 100).toFixed(2)));
            remaining -= current;
        }

        const diff = Number((Number(totalAmount) - allocations.reduce((sum, item) => sum + Number(item || 0), 0)).toFixed(2));
        if (allocations.length > 0 && Math.abs(diff) > 0) {
            allocations[allocations.length - 1] = Number((allocations[allocations.length - 1] + diff).toFixed(2));
        }

        return allocations;
    }

function getRedPacketLuckiestMemberId(packetMsg) {
        if (!packetMsg || !Array.isArray(packetMsg.claimRecords) || packetMsg.claimRecords.length === 0) return null;
        return packetMsg.claimRecords.reduce((best, item) => {
            if (!best) return item;
            return Number(item.amount || 0) > Number(best.amount || 0) ? item : best;
        }, null)?.memberId || null;
    }

function normalizeGroupRedPacketState(packetMsg, group) {
        if (!packetMsg || packetMsg.type !== 'group_red_packet') return packetMsg;

        if (!Array.isArray(packetMsg.claimRecords)) packetMsg.claimRecords = [];
        if (!Array.isArray(packetMsg.claimedMemberIds)) packetMsg.claimedMemberIds = [];
        if (!Array.isArray(packetMsg.allocations) || packetMsg.allocations.length === 0) {
            packetMsg.allocations = window.imChat.createRedPacketAllocations(packetMsg.totalAmount, packetMsg.packetCount);
        }

        if (!packetMsg.senderRole) packetMsg.senderRole = packetMsg.role === 'assistant' ? 'assistant' : 'user';
        if (!packetMsg.senderMemberId) {
            packetMsg.senderMemberId = packetMsg.senderRole === 'user'
                ? '__user__'
                : (packetMsg.speakerMemberId || '');
        }
        if (!packetMsg.senderName) {
            const senderMeta = window.imChat.getPacketSenderDisplayMeta(packetMsg, group);
            packetMsg.senderName = senderMeta.name;
            packetMsg.senderAvatarUrl = packetMsg.senderAvatarUrl || senderMeta.avatarUrl || '';
        }

        packetMsg.claimedMemberIds = packetMsg.claimRecords.map(item => String(item.memberId));
        packetMsg.remainingCount = Math.max(0, (parseInt(packetMsg.packetCount, 10) || 0) - packetMsg.claimRecords.length);
        packetMsg.remainingAmount = Number((
            (Number(packetMsg.totalAmount) || 0) -
            packetMsg.claimRecords.reduce((sum, item) => sum + Number(item.amount || 0), 0)
        ).toFixed(2));
        packetMsg.luckiestMemberId = window.imChat.getRedPacketLuckiestMemberId(packetMsg);

        const participants = window.imChat.getAllRedPacketParticipants(group);
        const configuredPacketCount = Math.max(1, parseInt(packetMsg.packetCount, 10) || 1);
        const maxClaimable = Math.min(participants.length, configuredPacketCount);
        packetMsg.packetCount = configuredPacketCount;
        packetMsg.maxClaimable = maxClaimable;
        packetMsg.remainingCount = Math.min(packetMsg.remainingCount, Math.max(0, maxClaimable - packetMsg.claimRecords.length));
        packetMsg.isFinished = packetMsg.claimRecords.length >= maxClaimable || packetMsg.remainingCount <= 0 || packetMsg.remainingAmount <= 0;
        packetMsg.statusText = packetMsg.isFinished ? '已被抢完' : '待领取';

        const currentUserClaimRecord = window.imChat.getCurrentUserClaimRecord(packetMsg);
        packetMsg.currentUserClaimRecord = currentUserClaimRecord;
        packetMsg.currentUserClaimed = !!currentUserClaimRecord;
        packetMsg.currentUserClaimAmount = currentUserClaimRecord ? Number(currentUserClaimRecord.amount || 0) : 0;
        return packetMsg;
    }

function processPendingGroupRedPackets(group) {
        if (!group || group.type !== 'group' || !Array.isArray(group.messages) || group.messages.length === 0) return false;

        const packets = group.messages.filter(msg => msg && msg.type === 'group_red_packet' && !msg.isFinished);
        if (packets.length === 0) return false;

        const participants = window.imChat.getAllRedPacketParticipants(group).filter(member => String(member.id) !== '__user__');
        if (participants.length === 0) return false;

        let changed = false;

        packets.forEach(packetMsg => {
            window.imChat.normalizeGroupRedPacketState(packetMsg, group);
            if (packetMsg.isFinished) return;

            if (packetMsg.deferAutoClaimUntilNextTurn) {
                packetMsg.deferAutoClaimUntilNextTurn = false;
                changed = true;
                return;
            }

            const alreadyClaimedSet = new Set((packetMsg.claimedMemberIds || []).map(String));
            const claimableMembers = participants.filter(member => !alreadyClaimedSet.has(String(member.id)));
            const remainingAllocations = (packetMsg.allocations || []).slice(packetMsg.claimRecords.length);
            if (claimableMembers.length === 0 || remainingAllocations.length === 0) {
                window.imChat.normalizeGroupRedPacketState(packetMsg, group);
                return;
            }

            const maxClaimsThisRound = Math.min(
                remainingAllocations.length,
                claimableMembers.length,
                Math.max(1, Math.min(3, claimableMembers.length))
            );
            const shouldClaimCount = Math.max(1, Math.min(maxClaimsThisRound, Math.ceil(Math.random() * maxClaimsThisRound)));
            const shuffledMembers = claimableMembers.slice().sort(() => Math.random() - 0.5).slice(0, shouldClaimCount);

            shuffledMembers.forEach((member, index) => {
                const claimRecord = window.imChat.claimGroupRedPacketForMember(group, packetMsg, member, {
                    claimedAt: Date.now() + index
                });
                if (claimRecord) changed = true;
            });

            window.imChat.normalizeGroupRedPacketState(packetMsg, group);
        });

        if (changed) {
            group.messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        }

        return changed;
    }

function refreshRedPacketMessageInContainer(page, friend, targetMsg) {
        if (!page || !friend || !targetMsg) return false;
        const latestContainer = page.querySelector('.ins-chat-messages');
        if (!latestContainer) return false;

        const targetMessageId = targetMsg.id || targetMsg.packetId || null;
        const targetTimestamp = targetMsg.timestamp || null;
        const existingRow = targetMessageId
            ? latestContainer.querySelector(`.chat-row[data-message-id="${targetMessageId}"]`)
            : (targetTimestamp
                ? latestContainer.querySelector(`.chat-row[data-timestamp="${targetTimestamp}"]`)
                : null);

        if (!existingRow) return false;

        const replaceHost = document.createElement('div');
        window.imChat.renderGroupRedPacketBubble(targetMsg, friend, replaceHost, targetMsg.timestamp || Date.now());
        const updatedRow = replaceHost.querySelector('.chat-row');
        if (!updatedRow) return false;

        existingRow.replaceWith(updatedRow);
        return true;
    }

function ensureRedPacketDetailOverlayForExistingPage(page, friend) {
        if (!page || page.querySelector('.group-red-packet-detail-overlay')) return;

        page.insertAdjacentHTML('beforeend', `
            <div class="group-red-packet-claim-overlay" style="display:none; position:absolute; inset:0; z-index:1201; background:rgba(0,0,0,0.32); opacity:0; transition:opacity 0.3s ease; align-items:center; justify-content:center; padding:18px; box-sizing:border-box;">
                <div class="group-red-packet-claim-card" style="width:100%; max-width:320px; border-radius:24px; background:#fff; color:#111;  padding:32px 24px 28px; box-sizing:border-box; text-align:center; position:relative; transform:scale(0.9); opacity:0; transition:all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                    <button type="button" class="group-red-packet-claim-close" style="position:absolute; right:16px; top:16px; width:32px; height:32px; border:none; border-radius:50%; background:#f2f2f7; color:#666; cursor:pointer; transition:background 0.2s;"><i class="fas fa-times"></i></button>
                    
                    <div class="group-red-packet-claim-avatar" style="width:64px; height:64px; border-radius:50%; overflow:hidden; margin:0 auto 16px; background:#f2f2f7; display:flex; align-items:center; justify-content:center; font-size:22px; color:#8e8e93;">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="group-red-packet-claim-sender" style="font-size:18px; font-weight:800; color:#111;">发红包的人</div>
                    <div class="group-red-packet-claim-desc" style="font-size:14px; color:#8e8e93; margin-top:8px; line-height:1.5;">恭喜发财</div>
                    
                    <div class="group-red-packet-claim-action-area" style="margin-top:36px; min-height:110px; display:flex; flex-direction:column; align-items:center;">
                        <button type="button" class="group-red-packet-claim-action" style="width:90px; height:90px; border:none; border-radius:50%; background:#ff4d4f; color:#fff; display:flex; align-items:center; justify-content:center; font-size:42px; cursor:pointer;  transition:transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                            <i class="fas fa-envelope-open-text"></i>
                        </button>
                        <div class="group-red-packet-claim-empty-text" style="display:none; font-size:24px; font-weight:800; color:#111; margin-bottom:10px;">手慢了，红包派完了</div>
                        
                        <div class="group-red-packet-claim-view-detail" style="margin-top:auto; font-size:13px; color:#007aff; cursor:pointer; font-weight:500; display:flex; align-items:center; justify-content:center; gap:4px;">
                            查看详情 <i class="fas fa-chevron-right" style="font-size:10px;"></i>
                        </div>
                    </div>
                </div>
            </div>

            <div class="group-red-packet-detail-overlay" style="display:none; position:absolute; inset:0; z-index:1202; background:rgba(0,0,0,0.28); opacity:0; transition:opacity 0.3s ease; align-items:center; justify-content:center; padding:18px; box-sizing:border-box;">
                <div class="group-red-packet-detail-card" style="width:100%; max-width:340px; max-height:82%; overflow:hidden; border-radius:30px; background:rgba(255,255,255,0.98);    display:flex; flex-direction:column; transform:translateY(20px); opacity:0; transition:all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);">
                    <div style="position:relative; padding:18px 18px 14px; border-bottom:1px solid rgba(0,0,0,0.06); text-align:center;">
                        <div style="font-size:18px; font-weight:800; color:#111; text-align:center;">红包详情</div>
                        <button type="button" class="group-red-packet-detail-close" style="position:absolute; right:18px; top:16px; width:32px; height:32px; border:none; border-radius:50%; background:#f2f2f7; color:#666; cursor:pointer;"><i class="fas fa-times"></i></button>
                        <div class="group-red-packet-detail-header" style="display:flex; flex-direction:column; align-items:center; justify-content:center; margin-top:14px;">
                            <div class="group-red-packet-detail-avatar" style="width:58px; height:58px; border-radius:50%; overflow:hidden; background:#e5e5ea; color:#8e8e93; display:flex; align-items:center; justify-content:center; font-size:20px; margin-bottom:10px;">
                                <i class="fas fa-user"></i>
                            </div>
                            <div class="group-red-packet-detail-title" style="font-size:17px; font-weight:700; color:#111; text-align:center;">发红包的人</div>
                            <div class="group-red-packet-detail-summary" style="font-size:12px; color:#8e8e93; margin-top:6px; text-align:center;">总金额 ¥0.00 · 恭喜发财</div>
                            <div class="group-red-packet-detail-claim-amount" style="font-size:36px; line-height:1.1; font-weight:800; color:#111; text-align:center; margin-top:14px;">¥0.00</div>
                            <div style="font-size:12px; color:#8e8e93; margin-top:6px;">你抢到的金额</div>
                        </div>
                    </div>
                    <div style="padding:14px 18px 10px;">
                        <div class="group-red-packet-detail-progress" style="border-radius:18px; background:#f7f7fa; padding:12px 14px;">
                            <div class="group-red-packet-detail-progress-text" style="font-size:14px; color:#333; line-height:1.5;">0/0 人领取</div>
                            <div class="group-red-packet-detail-status" style="font-size:12px; color:#8e8e93; margin-top:4px;">待领取</div>
                        </div>
                    </div>
                    <div class="group-red-packet-detail-list" style="flex:1; overflow-y:auto; padding:0 18px 18px;"></div>
                </div>
            </div>
        `);

        const claimOverlay = page.querySelector('.group-red-packet-claim-overlay');
        const claimCloseBtn = page.querySelector('.group-red-packet-claim-close');
        const claimAvatarEl = page.querySelector('.group-red-packet-claim-avatar');
        const claimSenderEl = page.querySelector('.group-red-packet-claim-sender');
        const claimDescEl = page.querySelector('.group-red-packet-claim-desc');
        const claimActionBtn = page.querySelector('.group-red-packet-claim-action');

        const overlay = page.querySelector('.group-red-packet-detail-overlay');
        const closeBtn = page.querySelector('.group-red-packet-detail-close');
        const titleEl = page.querySelector('.group-red-packet-detail-title');
        const summaryEl = page.querySelector('.group-red-packet-detail-summary');
        const claimAmountEl = page.querySelector('.group-red-packet-detail-claim-amount');
        const progressTextEl = page.querySelector('.group-red-packet-detail-progress-text');
        const statusEl = page.querySelector('.group-red-packet-detail-status');
        const listEl = page.querySelector('.group-red-packet-detail-list');
        const avatarEl = page.querySelector('.group-red-packet-detail-avatar');
        let activePacketMsg = null;

        function closeRedPacketClaimOverlay() {
            activePacketMsg = null;
            if (claimOverlay) {
                claimOverlay.style.opacity = '0';
                const card = claimOverlay.querySelector('.group-red-packet-claim-card');
                if (card) {
                    card.style.transform = 'scale(0.9)';
                    card.style.opacity = '0';
                }
                setTimeout(() => {
                    claimOverlay.style.display = 'none';
                }, 300);
            }
        }

        function closeRedPacketDetailOverlay() {
            activePacketMsg = null;
            if (overlay) {
                overlay.style.opacity = '0';
                const card = overlay.querySelector('.group-red-packet-detail-card');
                if (card) {
                    card.style.transform = 'translateY(20px)';
                    card.style.opacity = '0';
                }
                setTimeout(() => {
                    overlay.style.display = 'none';
                }, 300);
            }
        }

        function openRedPacketDetailOverlay(targetMsg) {
            if (!overlay || !targetMsg) return;
            activePacketMsg = targetMsg;
            window.imChat.normalizeGroupRedPacketState(targetMsg, friend);

            const senderMeta = window.imChat.getPacketSenderDisplayMeta(targetMsg, friend, friend);
            const claimRecords = Array.isArray(targetMsg.claimRecords) ? targetMsg.claimRecords.slice() : [];
            const claimedCount = claimRecords.length;
            const packetCount = parseInt(targetMsg.packetCount, 10) || 0;
            const totalAmount = Number(targetMsg.totalAmount) || 0;
            const luckiestMemberId = targetMsg.luckiestMemberId || window.imChat.getRedPacketLuckiestMemberId(targetMsg);
            const myAmount = Number(targetMsg.currentUserClaimAmount || 0);

            if (titleEl) titleEl.textContent = senderMeta.name || '发红包的人';
            if (summaryEl) summaryEl.textContent = `总金额 ¥${totalAmount.toFixed(2)} · ${targetMsg.description || '恭喜发财'}`;
            if (claimAmountEl) claimAmountEl.textContent = `¥${myAmount.toFixed(2)}`;
            if (progressTextEl) progressTextEl.textContent = `${claimedCount}/${packetCount} 人领取`;
            if (statusEl) statusEl.textContent = targetMsg.isFinished ? '已被抢完' : `剩余 ${targetMsg.remainingCount || 0} 个，¥${Number(targetMsg.remainingAmount || 0).toFixed(2)}`;

            const senderAvatarHtml = senderMeta.avatarUrl
                ? `<img src="${senderMeta.avatarUrl}" style="width:100%; height:100%; object-fit:cover; display:block;">`
                : `<span>${String(senderMeta.name || '群').charAt(0)}</span>`;
            if (avatarEl) avatarEl.innerHTML = senderAvatarHtml;

            if (listEl) {
                const claimedHtml = claimRecords.map(item => `
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-bottom:1px solid rgba(0,0,0,0.05);">
                        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                            <div style="width:36px; height:36px; border-radius:50%; background:#f2f2f7; display:flex; align-items:center; justify-content:center; color:#8e8e93; font-size:15px; flex-shrink:0;">
                                ${(item.memberName || '群').charAt(0)}
                            </div>
                            <div style="min-width:0;">
                                <div style="font-size:14px; font-weight:600; color:#111; display:flex; align-items:center; gap:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                    <span>${item.memberName || window.imChat.getDisplayNameByMemberId(friend, item.memberId)}</span>
                                    ${String(item.memberId) === String(luckiestMemberId) ? '<span style="display:inline-flex; align-items:center; padding:2px 8px; border-radius:999px; background:#f2f2f7; color:#111; font-size:10px; font-weight:700;">运气王</span>' : ''}
                                </div>
                                <div style="font-size:11px; color:#8e8e93; margin-top:3px;">${window.imApp.formatTime ? window.imApp.formatTime(item.claimedAt) : ''}</div>
                            </div>
                        </div>
                        <div style="font-size:16px; font-weight:800; color:#111;">¥${Number(item.amount || 0).toFixed(2)}</div>
                    </div>
                `).join('');

                listEl.innerHTML = claimedHtml
                    ? claimedHtml
                    : `<div style="padding:28px 0; text-align:center; color:#8e8e93; font-size:13px;">还没有人领取红包</div>`;
            }

            overlay.style.display = 'flex';
            // Trigger reflow for animation
            overlay.offsetHeight;
            overlay.style.opacity = '1';
            const card = overlay.querySelector('.group-red-packet-detail-card');
            if (card) {
                card.style.transform = 'translateY(0)';
                card.style.opacity = '1';
            }
        }

        function openRedPacketClaimOverlay(targetMsg) {
            if (!claimOverlay || !targetMsg) return;
            activePacketMsg = targetMsg;
            window.imChat.normalizeGroupRedPacketState(targetMsg, friend);

            const senderMeta = window.imChat.getPacketSenderDisplayMeta(targetMsg, friend, friend);
            const senderAvatarHtml = senderMeta.avatarUrl
                ? `<img src="${senderMeta.avatarUrl}" style="width:100%; height:100%; object-fit:cover; display:block;">`
                : `<span>${String(senderMeta.name || '群').charAt(0)}</span>`;

            if (claimAvatarEl) claimAvatarEl.innerHTML = senderAvatarHtml;
            if (claimSenderEl) claimSenderEl.textContent = senderMeta.name || '发红包的人';
            if (claimDescEl) claimDescEl.textContent = targetMsg.description || '恭喜发财';
            
            const actionBtn = claimOverlay.querySelector('.group-red-packet-claim-action');
            const emptyText = claimOverlay.querySelector('.group-red-packet-claim-empty-text');
            if (targetMsg.isFinished) {
                if (actionBtn) actionBtn.style.display = 'none';
                if (emptyText) emptyText.style.display = 'block';
            } else {
                if (actionBtn) actionBtn.style.display = 'flex';
                if (emptyText) emptyText.style.display = 'none';
            }

            claimOverlay.style.display = 'flex';
            // Trigger reflow for animation
            claimOverlay.offsetHeight;
            claimOverlay.style.opacity = '1';
            const card = claimOverlay.querySelector('.group-red-packet-claim-card');
            if (card) {
                card.style.transform = 'scale(1)';
                card.style.opacity = '1';
            }
        }

        function openGroupRedPacketInteraction(targetMsg) {
            if (!targetMsg) return;
            window.imChat.normalizeGroupRedPacketState(targetMsg, friend);
            if (targetMsg.currentUserClaimed) {
                openRedPacketDetailOverlay(targetMsg);
                return;
            }
            openRedPacketClaimOverlay(targetMsg);
        }

        page._openRedPacketDetailOverlay = openRedPacketDetailOverlay;
        page._closeRedPacketDetailOverlay = closeRedPacketDetailOverlay;
        page._openRedPacketClaimOverlay = openRedPacketClaimOverlay;
        page._closeRedPacketClaimOverlay = closeRedPacketClaimOverlay;
        page._openGroupRedPacketInteraction = openGroupRedPacketInteraction;

        if (claimOverlay) {
            claimOverlay.addEventListener('click', (e) => {
                if (e.target === claimOverlay) closeRedPacketClaimOverlay();
            });
        }

        if (claimCloseBtn) {
            claimCloseBtn.addEventListener('click', () => {
                closeRedPacketClaimOverlay();
            });
        }

        const viewDetailBtn = page.querySelector('.group-red-packet-claim-view-detail');
        if (viewDetailBtn) {
            viewDetailBtn.addEventListener('click', () => {
                if (!activePacketMsg) return;
                const msg = activePacketMsg;
                closeRedPacketClaimOverlay();
                setTimeout(() => {
                    openRedPacketDetailOverlay(msg);
                }, 200);
            });
        }

        if (claimActionBtn) {
            claimActionBtn.addEventListener('click', () => {
                if (!activePacketMsg) return;
                
                claimActionBtn.style.transform = 'scale(0.9)';
                setTimeout(async () => {
                    claimActionBtn.style.transform = 'scale(1)';

                    const packetId = activePacketMsg.packetId || activePacketMsg.id;
                    let claimedPacketMsg = null;

                    const saved = await commitPaymentFriendChange(friend, (targetFriend) => {
                        const targetPacket = Array.isArray(targetFriend.messages)
                            ? targetFriend.messages.find((item) => item && (item.packetId === packetId || item.id === packetId))
                            : null;
                        if (!targetPacket) return;

                        const claimRecord = window.imChat.claimGroupRedPacketForMember(
                            targetFriend,
                            targetPacket,
                            window.imChat.getCurrentUserPacketMember(targetFriend)
                        );
                        if (!claimRecord) return;
                        claimedPacketMsg = targetPacket;
                    }, { silent: true });

                    if (!claimedPacketMsg) {
                        if (window.showToast) window.showToast('手慢了，红包派完了');
                        openRedPacketClaimOverlay(activePacketMsg);
                        return;
                    }

                    if (!saved) {
                        if (window.showToast) window.showToast('红包领取保存失败');
                        return;
                    }

                    const latestContainer = page.querySelector('.ins-chat-messages');
                    if (latestContainer) {
                        const patched = refreshRedPacketMessageInContainer(page, friend, claimedPacketMsg);
                        if (!patched) {
                            latestContainer.innerHTML = '';
                            window.imChat.renderChatHistory(friend, latestContainer);
                        }
                        window.imChat.scrollToBottom(latestContainer);
                    }

                    closeRedPacketClaimOverlay();
                    setTimeout(() => {
                        openRedPacketDetailOverlay(claimedPacketMsg);
                    }, 250);
                }, 150);
            });
        }

        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeRedPacketDetailOverlay();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                closeRedPacketDetailOverlay();
            });
        }
    }

function ensureTransferDetailOverlayForExistingPage(page, friend) {
        if (!page) return;

        const existingOverlay = page.querySelector('.pay-transfer-detail-overlay');
        const hasManagedOverlay = existingOverlay &&
            page._transferDetailOverlayManaged === true &&
            typeof page._openTransferDetailOverlay === 'function';

        if (hasManagedOverlay) return;

        if (existingOverlay) {
            existingOverlay.remove();
            page._openTransferDetailOverlay = null;
            page._closeTransferDetailOverlay = null;
            page._transferDetailOverlayManaged = false;
        }

        page.insertAdjacentHTML('beforeend', `
                <div class="pay-transfer-detail-overlay" style="display:none; position:absolute; inset:0; z-index:1200; background:rgba(0,0,0,0.28); align-items:center; justify-content:center; padding:20px; box-sizing:border-box;">
                    <div class="pay-transfer-detail-card" style="width:100%; max-width:320px; border-radius:28px; background:rgba(255,255,255,0.96);    padding:20px 18px 16px; box-sizing:border-box;">
                        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                            <div class="pay-transfer-detail-avatar" style="width:52px; height:52px; border-radius:50%; overflow:hidden; background:#e5e5ea; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                <i class="fas fa-user" style="color:#8e8e93; font-size:20px;"></i>
                            </div>
                            <div style="min-width:0;">
                                <div class="pay-transfer-detail-name" style="font-size:17px; font-weight:700; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">付款人</div>
                                <div class="pay-transfer-detail-action-text" style="font-size:12px; color:#8e8e93; margin-top:3px;">向你转账</div>
                            </div>
                        </div>
                        <div class="pay-transfer-detail-amount" style="font-size:34px; line-height:1.1; font-weight:800; color:#111; text-align:center; margin:8px 0 10px;">¥0.00</div>
                        <div class="pay-transfer-detail-desc" style="font-size:14px; color:#666; text-align:center; line-height:1.5; min-height:21px; margin-bottom:18px;">转账说明</div>
                        <div style="border-radius:18px; background:#f7f7fa; padding:12px 14px; margin-bottom:16px;">
                            <div style="font-size:12px; color:#8e8e93; margin-bottom:6px;">转账详情</div>
                            <div class="pay-transfer-detail-summary" style="font-size:14px; color:#222; line-height:1.5;">付款人向你转账</div>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button type="button" class="pay-transfer-detail-reject-btn" style="flex:1; height:46px; border:none; border-radius:16px; background:#f2f2f7; color:#666; font-size:16px; font-weight:600; cursor:pointer;">退回</button>
                            <button type="button" class="pay-transfer-detail-claim-btn" style="flex:1; height:46px; border:none; border-radius:16px; background:#111; color:#fff; font-size:16px; font-weight:700; cursor:pointer;">收下</button>
                        </div>
                    </div>
                </div>
        `);

        const transferDetailOverlay = page.querySelector('.pay-transfer-detail-overlay');
        const transferDetailAvatar = page.querySelector('.pay-transfer-detail-avatar');
        const transferDetailName = page.querySelector('.pay-transfer-detail-name');
        const transferDetailAmount = page.querySelector('.pay-transfer-detail-amount');
        const transferDetailDesc = page.querySelector('.pay-transfer-detail-desc');
        const transferDetailSummary = page.querySelector('.pay-transfer-detail-summary');
        const transferDetailRejectBtn = page.querySelector('.pay-transfer-detail-reject-btn');
        const transferDetailClaimBtn = page.querySelector('.pay-transfer-detail-claim-btn');
        const msgContainerProxy = page.querySelector('.ins-chat-messages');
        let pendingTransferMsg = null;

        function closeTransferDetailOverlay() {
            pendingTransferMsg = null;
            if (transferDetailOverlay) transferDetailOverlay.style.display = 'none';
        }

        function openTransferDetailOverlay(targetMsg) {
            if (!transferDetailOverlay || !targetMsg) return;

            pendingTransferMsg = targetMsg;

            const model = normalizePayTransferMessage(targetMsg, friend);
            const {
                status,
                payerName,
                payeeName,
                payerAvatar,
                canCurrentUserClaim
            } = model;
            
            const amount = Number(targetMsg.amount) || 0;
            const description = targetMsg.description || '转账';
            const familyCardText = `${targetMsg.paymentAction || ''} ${targetMsg.cardTitle || ''} ${targetMsg.description || ''} ${targetMsg.content || ''}`;
            const isFamilyCard = targetMsg.paymentAction === 'family_card'
                || targetMsg.paymentAction === 'family_card_increase'
                || familyCardText.includes('亲属卡');

            if (transferDetailName) transferDetailName.textContent = payerName;
            if (transferDetailAmount) transferDetailAmount.textContent = `¥${amount.toFixed(2)}`;
            if (transferDetailDesc) transferDetailDesc.textContent = description;
            if (transferDetailSummary) transferDetailSummary.textContent = isFamilyCard ? `备注：${description}` : `${payerName} 向 ${payeeName} 转账，备注：${description}`;

            const transferDetailActionText = page.querySelector('.pay-transfer-detail-action-text');
            if (transferDetailActionText) {
                if (isFamilyCard) {
                    transferDetailActionText.textContent = '';
                } else if (status === 'claimed') {
                    transferDetailActionText.textContent = `${payeeName}已收款`;
                } else if (status === 'rejected') {
                    transferDetailActionText.textContent = '已退还';
                } else if (canCurrentUserClaim) {
                    transferDetailActionText.textContent = '向你转账';
                } else {
                    transferDetailActionText.textContent = `转账给 ${payeeName}`;
                }
            }

            if (transferDetailAvatar) {
                if (payerAvatar) {
                    transferDetailAvatar.innerHTML = `<img src="${payerAvatar}" style="width:100%; height:100%; object-fit:cover; display:block;">`;
                } else {
                    transferDetailAvatar.innerHTML = `<i class="fas fa-user" style="color:#8e8e93; font-size:20px;"></i>`;
                }
            }

            // 按钮容器
            const actionsContainer = transferDetailRejectBtn ? transferDetailRejectBtn.parentElement : null;

            // 根据状态控制按钮显示
            // 如果是已经被处理过的记录（任何已收下或退回的状态），隐藏所有按钮及其容器
            if (canCurrentUserClaim) {
                if (actionsContainer) actionsContainer.style.display = 'flex';
                if (transferDetailRejectBtn) {
                    transferDetailRejectBtn.style.display = 'block';
                    transferDetailRejectBtn.textContent = '退回';
                }
                if (transferDetailClaimBtn) {
                    transferDetailClaimBtn.style.display = 'block';
                    transferDetailClaimBtn.textContent = '收下';
                }
            } else {
                if (actionsContainer) actionsContainer.style.display = 'none';
            }

            transferDetailOverlay.style.display = 'flex';
        }

            page._openTransferDetailOverlay = openTransferDetailOverlay;
            page._closeTransferDetailOverlay = closeTransferDetailOverlay;
            page._transferDetailOverlayManaged = true;
            window.imChat.ensureRedPacketDetailOverlayForExistingPage(page, friend);

        if (msgContainerProxy) {
            msgContainerProxy.addEventListener('click', (e) => {
                const row = e.target.closest('.chat-row');
                if (!row) return;

                const messageId = row.getAttribute('data-message-id');
                const ts = row.getAttribute('data-timestamp');
                const liveFriend = window.imData.currentActiveFriend &&
                    String(window.imData.currentActiveFriend.id) === String(friend.id)
                    ? window.imData.currentActiveFriend
                    : friend;

                if ((!messageId && !ts) || !liveFriend.messages) return;

                const msg = liveFriend.messages.find(item => {
                    if (messageId && String(item.id) === String(messageId)) return true;
                    return String(item.timestamp) === String(ts);
                });
                
                // 允许双方转账在点击时都弹出（包括处理前和处理后的所有payKind）
                if (!msg || msg.type !== 'pay_transfer') return;
                
                // 仅允许基础的转账和系统交互过的转账气泡可点击（排除某些纯通知类型的转账卡片如果存在的话）
                const validKinds = [
                    'user_to_char', 'char_to_user_pending', // 待处理
                    'char_received', 'char_to_user_claimed', 'user_received_from_char', // 已收下
                    'user_rejected_from_char', 'char_to_user_rejected', 'user_to_char_rejected' // 已退还
                ];
                
                if (!validKinds.includes(msg.payKind)) return;

                const bubble = e.target.closest('.chat-bubble.pay-transfer-bubble, .pay-transfer-card');
                if (!bubble) return;

                e.preventDefault();
                e.stopPropagation();
                openTransferDetailOverlay(msg);
            }, true);
        }

        if (transferDetailOverlay) {
            transferDetailOverlay.addEventListener('click', (e) => {
                if (e.target === transferDetailOverlay) {
                    closeTransferDetailOverlay();
                }
            });
        }

        if (transferDetailRejectBtn) {
            transferDetailRejectBtn.addEventListener('click', () => {
                const targetMsg = pendingTransferMsg;
                closeTransferDetailOverlay();
                if (targetMsg) {
                    if (window.imChat.rejectIncomingTransfer) {
                        window.imChat.rejectIncomingTransfer(friend, targetMsg);
                    }
                }
            });
        }

        if (transferDetailClaimBtn) {
            transferDetailClaimBtn.addEventListener('click', () => {
                const targetMsg = pendingTransferMsg;
                closeTransferDetailOverlay();
                if (targetMsg) {
                    window.imChat.claimIncomingTransfer(friend, targetMsg);
                }
            });
        }
    }

async function claimIncomingTransfer(friend, msg, options = {}) {
        if (!friend || !msg || msg.claimed) return;
        
        // 允许自己收下AI的转账，或者AI收下自己的转账
        if (msg.payKind !== 'char_to_user_pending' && msg.payKind !== 'user_to_char') return;

        const amount = Number(msg.amount) || 0;
        const description = msg.description || '转账';
        const transferModel = normalizePayTransferMessage(msg, friend);
        const senderName = transferModel.payerName;
        const receiverName = transferModel.payeeName;

        if (amount <= 0) {
            if (window.showToast) window.showToast('金额无效');
            return;
        }

        const activeFriend = window.imData.currentActiveFriend;
        const activePage = document.getElementById(`chat-interface-${friend.id}`);
        const activeContainer = activePage ? activePage.querySelector('.ins-chat-messages') : null;
        const existingRow = activeContainer && msg.id
            ? activeContainer.querySelector(`.chat-row[data-message-id="${msg.id}"]`)
            : null;

        const isUserClaiming = msg.payKind === 'char_to_user_pending';

        if (isUserClaiming) {
            const incomeSuccess = typeof window.addPayTransaction === 'function'
                ? window.addPayTransaction(
                    amount,
                    `${description} · ${senderName}`,
                    'income'
                )
                : false;

            if (!incomeSuccess) {
                if (window.showToast) window.showToast('收款失败');
                return;
            }
        }

        const sourceMessageId = msg.id;
        const sourceMessageSnapshot = JSON.parse(JSON.stringify(msg));
        let updatedMsg = null;
        let receiveMsg = null;
        let receiveTimestamp = Date.now();

        if (isUserClaiming) {
            receiveMsg = {
                id: window.imChat.createMessageId('pay'),
                role: 'user',
                type: 'pay_transfer',
                payKind: 'user_received_from_char',
                payDirection: transferModel.direction,
                amount,
                description,
                payerName: senderName,
                payeeName: receiverName,
                senderName,
                receiverName,
                targetName: senderName,
                cardTitle: '收款',
                payStatus: 'completed',
                content: `[收款] ${description} ¥${amount.toFixed(2)}`,
                timestamp: receiveTimestamp,
                apiRunId: options.apiRunId || null,
                rollbackSourceMessage: sourceMessageSnapshot
            };
        } else {
            // AI收下用户的钱
            receiveMsg = {
                id: window.imChat.createMessageId('pay'),
                role: 'assistant',
                type: 'pay_transfer',
                payKind: 'char_received',
                payDirection: transferModel.direction,
                amount,
                description,
                payerName: senderName,
                payeeName: receiverName,
                senderName,
                receiverName,
                targetName: senderName,
                cardTitle: `${receiverName}已收款`,
                payStatus: 'completed',
                content: `[对方已收款] ${description} ¥${amount.toFixed(2)}`,
                timestamp: receiveTimestamp,
                apiRunId: options.apiRunId || null,
                rollbackSourceMessage: sourceMessageSnapshot
            };
            if (typeof options.cotSummary === 'string' && options.cotSummary.trim()) {
                receiveMsg.cotSummary = options.cotSummary.trim();
            }
        }

        window.imApp.captureGroupUserIdentity?.(friend, receiveMsg);
        let saved = false;

        if (window.imApp.updateFriendMessage && window.imApp.appendFriendMessage) {
            const updated = await window.imApp.updateFriendMessage(friend.id, {
                id: sourceMessageId || null,
                timestamp: msg.timestamp || null
            }, (targetMsg) => {
                if (!targetMsg) return;
                targetMsg.claimed = true;
                if (isUserClaiming) {
                    targetMsg.payKind = 'char_to_user_claimed';
                    targetMsg.payDirection = transferModel.direction;
                    targetMsg.cardTitle = `${receiverName}已收款`;
                    targetMsg.targetName = senderName;
                    targetMsg.payerName = senderName;
                    targetMsg.payeeName = receiverName;
                    targetMsg.senderName = senderName;
                    targetMsg.receiverName = receiverName;
                    targetMsg.content = `[对方转账已领取] ${description} ¥${amount.toFixed(2)}`;
                } else {
                    targetMsg.payKind = 'char_received';
                    targetMsg.payDirection = transferModel.direction;
                    targetMsg.cardTitle = `${receiverName}已收款`;
                    targetMsg.targetName = senderName;
                    targetMsg.payerName = senderName;
                    targetMsg.payeeName = receiverName;
                    targetMsg.senderName = senderName;
                    targetMsg.receiverName = receiverName;
                    targetMsg.content = `[对方转账已领取] ${description} ¥${amount.toFixed(2)}`;
                }
                updatedMsg = targetMsg;
            }, { silent: true });

            if (updated) {
                saved = await window.imApp.appendFriendMessage(friend.id, receiveMsg, { silent: true });
            }
        } else {
            saved = await commitPaymentFriendChange(friend, (targetFriend) => {
                const targetMsg = Array.isArray(targetFriend.messages)
                    ? targetFriend.messages.find((item) => item && String(item.id) === String(sourceMessageId))
                    : null;
                if (!targetMsg) return;

                targetMsg.claimed = true;
                if (isUserClaiming) {
                    targetMsg.payKind = 'char_to_user_claimed';
                    targetMsg.payDirection = transferModel.direction;
                    targetMsg.cardTitle = `${receiverName}已收款`;
                    targetMsg.targetName = senderName;
                    targetMsg.payerName = senderName;
                    targetMsg.payeeName = receiverName;
                    targetMsg.senderName = senderName;
                    targetMsg.receiverName = receiverName;
                    targetMsg.content = `[对方转账已领取] ${description} ¥${amount.toFixed(2)}`;
                } else {
                    targetMsg.payKind = 'char_received';
                    targetMsg.payDirection = transferModel.direction;
                    targetMsg.cardTitle = `${receiverName}已收款`;
                    targetMsg.targetName = senderName;
                    targetMsg.payerName = senderName;
                    targetMsg.payeeName = receiverName;
                    targetMsg.senderName = senderName;
                    targetMsg.receiverName = receiverName;
                    targetMsg.content = `[对方转账已领取] ${description} ¥${amount.toFixed(2)}`;
                }

                if (!targetFriend.messages) targetFriend.messages = [];
                targetFriend.messages.push(receiveMsg);
                updatedMsg = targetMsg;
            }, { silent: true });
        }

        if (!saved || !updatedMsg || !receiveMsg) {
            if (window.showToast) window.showToast('收款记录保存失败');
            return;
        }

        if (activeFriend && String(activeFriend.id) === String(friend.id) && activeContainer) {
            if (existingRow) {
                const replaceHost = document.createElement('div');
                window.imChat.renderPayTransferBubble(updatedMsg, friend, replaceHost, updatedMsg.timestamp || receiveTimestamp);
                const updatedClaimedRow = replaceHost.querySelector('.chat-row');

                if (updatedClaimedRow) {
                    existingRow.replaceWith(updatedClaimedRow);
                }

                const appendHost = document.createElement('div');
                const lastMsgBeforeReceive = friend.messages.length > 1 ? friend.messages[friend.messages.length - 2] : null;

                if (!lastMsgBeforeReceive || (receiveTimestamp - (lastMsgBeforeReceive.timestamp || 0) > 300000)) {
                    window.imChat.renderTimestamp(receiveTimestamp, appendHost);
                }

                if (window.imChat.renderMessageBubble) {
                    window.imChat.renderMessageBubble(receiveMsg, friend, appendHost, receiveTimestamp);
                } else {
                    window.imChat.renderPayTransferBubble(receiveMsg, friend, appendHost, receiveTimestamp);
                }

                while (appendHost.firstChild) {
                    activeContainer.appendChild(appendHost.firstChild);
                }

                window.imChat.scrollToBottom(activeContainer);
            } else {
                activeContainer.innerHTML = '';
                window.imChat.renderChatHistory(friend, activeContainer);
                window.imChat.scrollToBottom(activeContainer);
            }
        }
        return true;
    }

    window.imChat.getGroupMemberFriends = getGroupMemberFriends;
    window.imChat.getCanonicalGroupMemberIds = getCanonicalGroupMemberIds;
    window.imChat.normalizeGroupSpeaker = normalizeGroupSpeaker;
    window.imChat.getGroupMessageSpeaker = getGroupMessageSpeaker;
    window.imChat.getSafeGroupSpeaker = getSafeGroupSpeaker;
    window.imChat.getDisplayNameByMemberId = getDisplayNameByMemberId;
    window.imChat.getAvailableGroupRecipients = getAvailableGroupRecipients;
    window.imChat.getCurrentUserPacketMember = getCurrentUserPacketMember;
    window.imChat.getAllRedPacketParticipants = getAllRedPacketParticipants;
    window.imChat.getPacketSenderDisplayMeta = getPacketSenderDisplayMeta;
    window.imChat.getCurrentUserClaimRecord = getCurrentUserClaimRecord;
    window.imChat.createRedPacketClaimNoticeText = createRedPacketClaimNoticeText;
    window.imChat.claimGroupRedPacketForMember = claimGroupRedPacketForMember;
    window.imChat.createRedPacketAllocations = createRedPacketAllocations;
    window.imChat.getRedPacketLuckiestMemberId = getRedPacketLuckiestMemberId;
    window.imChat.normalizeGroupRedPacketState = normalizeGroupRedPacketState;
    window.imChat.processPendingGroupRedPackets = processPendingGroupRedPackets;
    window.imChat.ensureRedPacketDetailOverlayForExistingPage = ensureRedPacketDetailOverlayForExistingPage;
    async function rejectIncomingTransfer(friend, msg, options = {}) {
        if (!friend || !msg || msg.claimed) return;
        
        // 允许退回AI的转账，或者模拟AI退回用户的转账
        if (msg.payKind !== 'char_to_user_pending' && msg.payKind !== 'user_to_char') return;

        const amount = Number(msg.amount) || 0;
        const description = msg.description || '转账';
        const transferModel = normalizePayTransferMessage(msg, friend);
        const senderName = transferModel.payerName;
        const receiverName = transferModel.payeeName;
        // isUserRejecting true 代表：用户退回 char 的钱（用户发出的退回气泡）
        // isUserRejecting false 代表：char 退回 用户的钱（char/assistant 发出的退回气泡）
        const isUserRejecting = msg.payKind === 'char_to_user_pending';

        if (amount <= 0) return;

        const activeFriend = window.imData.currentActiveFriend;
        const activePage = document.getElementById(`chat-interface-${friend.id}`);
        const activeContainer = activePage ? activePage.querySelector('.ins-chat-messages') : null;
        const existingRow = activeContainer && msg.id
            ? activeContainer.querySelector(`.chat-row[data-message-id="${msg.id}"]`)
            : null;

        // 如果是AI退回用户的转账，钱回到用户余额
        if (!isUserRejecting && typeof window.addPayTransaction === 'function') {
            window.addPayTransaction(
                amount,
                `${description} · 转账退还 · ${receiverName}`,
                'income'
            );
        }

        const sourceMessageId = msg.id;
        const sourceMessageSnapshot = JSON.parse(JSON.stringify(msg));
        let updatedMsg = null;
        let rejectMsg = null;
        let rejectTimestamp = Date.now();

        if (isUserRejecting) {
            rejectMsg = {
                id: window.imChat.createMessageId('pay'),
                role: 'user', // 用户发起拒绝
                type: 'pay_transfer',
                payKind: 'user_rejected_from_char', // 用户的拒绝消息，UI将渲染为 "已退还"
                payDirection: transferModel.direction,
                amount,
                description,
                payerName: senderName,
                payeeName: receiverName,
                senderName,
                receiverName,
                targetName: senderName,
                cardTitle: '已退还',
                payStatus: 'completed',
                content: `[已退还] ${description} ¥${amount.toFixed(2)}`,
                timestamp: rejectTimestamp,
                apiRunId: options.apiRunId || null,
                rollbackSourceMessage: sourceMessageSnapshot
            };
        } else {
            rejectMsg = {
                id: window.imChat.createMessageId('pay'),
                role: 'assistant', // AI发起的退回
                type: 'pay_transfer',
                payKind: 'char_to_user_rejected', // AI的拒绝消息（或 user_to_char_rejected）
                payDirection: transferModel.direction,
                amount,
                description,
                payerName: senderName,
                payeeName: receiverName,
                senderName,
                receiverName,
                targetName: senderName,
                cardTitle: '已退还',
                payStatus: 'completed',
                content: `[对方已退还] ${description} ¥${amount.toFixed(2)}`,
                timestamp: rejectTimestamp,
                apiRunId: options.apiRunId || null,
                rollbackSourceMessage: sourceMessageSnapshot
            };
            if (typeof options.cotSummary === 'string' && options.cotSummary.trim()) {
                rejectMsg.cotSummary = options.cotSummary.trim();
            }
        }

        window.imApp.captureGroupUserIdentity?.(friend, rejectMsg);
        let saved = false;

        if (window.imApp.updateFriendMessage && window.imApp.appendFriendMessage) {
            const updated = await window.imApp.updateFriendMessage(friend.id, {
                id: sourceMessageId || null,
                timestamp: msg.timestamp || null
            }, (targetMsg) => {
                if (!targetMsg) return;
                targetMsg.claimed = true;
                if (isUserRejecting) {
                    targetMsg.payKind = 'user_rejected_from_char'; // 原始卡片状态更新
                    targetMsg.payDirection = transferModel.direction;
                    targetMsg.cardTitle = '已退还';
                    targetMsg.targetName = senderName;
                    targetMsg.payerName = senderName;
                    targetMsg.payeeName = receiverName;
                    targetMsg.senderName = senderName;
                    targetMsg.receiverName = receiverName;
                    targetMsg.content = `[转账已退还] ${description} ¥${amount.toFixed(2)}`;
                } else {
                    targetMsg.payKind = 'user_to_char_rejected'; // 原始卡片状态更新
                    targetMsg.payDirection = transferModel.direction;
                    targetMsg.cardTitle = '已退还';
                    targetMsg.targetName = senderName;
                    targetMsg.payerName = senderName;
                    targetMsg.payeeName = receiverName;
                    targetMsg.senderName = senderName;
                    targetMsg.receiverName = receiverName;
                    targetMsg.content = `[转账已退还] ${description} ¥${amount.toFixed(2)}`;
                }
                updatedMsg = targetMsg;
            }, { silent: true });

            if (updated) {
                saved = await window.imApp.appendFriendMessage(friend.id, rejectMsg, { silent: true });
            }
        } else {
            saved = await commitPaymentFriendChange(friend, (targetFriend) => {
                const targetMsg = Array.isArray(targetFriend.messages)
                    ? targetFriend.messages.find((item) => item && String(item.id) === String(sourceMessageId))
                    : null;
                if (!targetMsg) return;

                targetMsg.claimed = true;
                if (isUserRejecting) {
                    targetMsg.payKind = 'user_rejected_from_char';
                    targetMsg.payDirection = transferModel.direction;
                    targetMsg.cardTitle = '已退还';
                    targetMsg.targetName = senderName;
                    targetMsg.payerName = senderName;
                    targetMsg.payeeName = receiverName;
                    targetMsg.senderName = senderName;
                    targetMsg.receiverName = receiverName;
                    targetMsg.content = `[转账已退还] ${description} ¥${amount.toFixed(2)}`;
                } else {
                    targetMsg.payKind = 'user_to_char_rejected';
                    targetMsg.payDirection = transferModel.direction;
                    targetMsg.cardTitle = '已退还';
                    targetMsg.targetName = senderName;
                    targetMsg.payerName = senderName;
                    targetMsg.payeeName = receiverName;
                    targetMsg.senderName = senderName;
                    targetMsg.receiverName = receiverName;
                    targetMsg.content = `[转账已退还] ${description} ¥${amount.toFixed(2)}`;
                }

                if (!targetFriend.messages) targetFriend.messages = [];
                targetFriend.messages.push(rejectMsg);
                updatedMsg = targetMsg;
            }, { silent: true });
        }

        if (!saved || !updatedMsg || !rejectMsg) {
            if (window.showToast) window.showToast('退还记录保存失败');
            return;
        }

        if (activeFriend && String(activeFriend.id) === String(friend.id) && activeContainer) {
            if (existingRow) {
                const replaceHost = document.createElement('div');
                window.imChat.renderPayTransferBubble(updatedMsg, friend, replaceHost, updatedMsg.timestamp || rejectTimestamp);
                const updatedClaimedRow = replaceHost.querySelector('.chat-row');

                if (updatedClaimedRow) {
                    existingRow.replaceWith(updatedClaimedRow);
                }

                const appendHost = document.createElement('div');
                const lastMsgBeforeReceive = friend.messages.length > 1 ? friend.messages[friend.messages.length - 2] : null;

                if (!lastMsgBeforeReceive || (rejectTimestamp - (lastMsgBeforeReceive.timestamp || 0) > 300000)) {
                    window.imChat.renderTimestamp(rejectTimestamp, appendHost);
                }

                if (window.imChat.renderMessageBubble) {
                    window.imChat.renderMessageBubble(rejectMsg, friend, appendHost, rejectTimestamp);
                } else {
                    window.imChat.renderPayTransferBubble(rejectMsg, friend, appendHost, rejectTimestamp);
                }

                while (appendHost.firstChild) {
                    activeContainer.appendChild(appendHost.firstChild);
                }

                window.imChat.scrollToBottom(activeContainer);
            } else {
                activeContainer.innerHTML = '';
                window.imChat.renderChatHistory(friend, activeContainer);
                window.imChat.scrollToBottom(activeContainer);
            }
        }
        return true;
    }

    window.imChat.ensureTransferDetailOverlayForExistingPage = ensureTransferDetailOverlayForExistingPage;
    window.imChat.claimIncomingTransfer = claimIncomingTransfer;
    window.imChat.rejectIncomingTransfer = rejectIncomingTransfer;

});
