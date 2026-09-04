// ==========================================
// IMESSAGE: 5. SETTINGS & EDITING
// ==========================================

(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    const { openView, closeView, showToast, showCustomModal, userState } = window;
    
    const chatSettingsSheet = document.getElementById('chat-settings-sheet');
    const npcChatSettingsSheet = document.getElementById('npc-chat-settings-sheet');
    
    // Initialize shared state if not present
    window.imData.currentSettingsFriend = null;

    // Bind World Book Elements
    const bindWorldBookSheet = document.getElementById('bind-world-book-sheet');
    const bindWorldBookList = document.getElementById('bind-world-book-list');
    const confirmBindWorldBookBtn = document.getElementById('confirm-bind-world-book-btn');
    const worldBookBtn = document.getElementById('world-book-btn');
    const chatBindIdBtn = document.getElementById('chat-bind-id-btn');
    const chatBindIdLabel = document.getElementById('chat-bind-id-label');
    const bindAccountSheet = document.getElementById('bind-account-sheet');
    const bindAccountList = document.getElementById('bind-account-list');
    const bindAccountEmpty = document.getElementById('bind-account-empty');
    const confirmBindAccountBtn = document.getElementById('confirm-bind-account-btn');
    const bindAccountDetailSheet = document.getElementById('bind-account-detail-sheet');
    const bindAccountDetailSelect = document.getElementById('bind-account-detail-select');
    const bindAccountDetailEmpty = document.getElementById('bind-account-detail-empty');
    const bindAccountDetailForm = document.getElementById('bind-account-detail-form');
    const bindAccountDetailAvatarBtn = document.getElementById('bind-account-detail-avatar-btn');
    const bindAccountDetailAvatarUpload = document.getElementById('bind-account-detail-avatar-upload');
    const bindAccountDetailAvatarImg = document.getElementById('bind-account-detail-avatar-img');
    const bindAccountDetailAvatarIcon = document.getElementById('bind-account-detail-avatar-icon');
    const bindAccountDetailNameInput = document.getElementById('bind-account-detail-name-input');
    const bindAccountDetailPhoneInput = document.getElementById('bind-account-detail-phone-input');
    const bindAccountDetailSignatureInput = document.getElementById('bind-account-detail-signature-input');
    const bindAccountDetailPersonaInput = document.getElementById('bind-account-detail-persona-input');
    const bindAccountDetailSaveBtn = document.getElementById('bind-account-detail-save-btn');
    
    let tempSelectedBookIds = [];
    let tempSelectedAccountId = null;
    let bindAccountDetailAvatarUrl = null;
    
    const editCharPersonaSheet = document.getElementById('edit-char-persona-sheet');
    const relationshipSheet = document.getElementById('relationship-sheet');
    const relationshipBtn = document.getElementById('relationship-btn');
    const relationshipList = document.getElementById('relationship-list');
    const relationshipEmptyState = document.getElementById('relationship-empty-state');
    const relationshipPicker = document.getElementById('relationship-picker');
    const relationshipPickerList = document.getElementById('relationship-picker-list');
    const relationshipPickerFilters = document.getElementById('relationship-picker-filters');
    const relationshipSelectedCount = document.getElementById('relationship-selected-count');
    const relationshipTotalBadge = document.getElementById('relationship-total-badge');
    const confirmRelationshipBtn = document.getElementById('confirm-relationship-btn');
    const relationshipAddNpcBtn = document.getElementById('relationship-add-npc-btn');
    const statusPromptSheet = document.getElementById('status-prompt-sheet');
    const statusPromptBtn = document.getElementById('status-prompt-btn');
    const statusPromptEnabledToggle = document.getElementById('status-prompt-enabled-toggle');
    const statusPromptInput = document.getElementById('status-prompt-input');
    const saveStatusPromptBtn = document.getElementById('save-status-prompt-btn');
    const DEFAULT_STATUS_PROMPT = window.imApp.DEFAULT_STATUS_PROMPT
        || '固定使用简体中文，写角色此刻没有说出口的三句真实心声。每句约10个汉字，每行一句，共三行；不要添加序号、引号、标题、前缀或解释。';
    const chatCotSettingsSheet = document.getElementById('chat-cot-settings-sheet');
    const chatCotSettingsBtn = document.getElementById('chat-cot-settings-btn');
    const chatCotSettingsLabel = document.getElementById('chat-cot-settings-label');
    const chatCotEnabledToggle = document.getElementById('chat-cot-enabled-toggle');
    const chatCotPromptInput = document.getElementById('chat-cot-prompt-input');
    const resetChatCotPromptBtn = document.getElementById('reset-chat-cot-prompt-btn');
    const saveChatCotSettingsBtn = document.getElementById('save-chat-cot-settings-btn');
    const DEFAULT_SINGLE_CHAT_COT_PROMPT = window.imApp.DEFAULT_SINGLE_CHAT_COT_PROMPT || '';

    let tempRelationshipDrafts = [];
    let isRelationshipPickerVisible = false;
    let relationshipPickerType = 'all';
    let relationshipPreviewFrame = null;
    let pendingRelationshipPreviewFriend = null;

    async function commitSettingsFriendChange(mutator, options = {}) {
        const currentFriend = window.imData.currentSettingsFriend;
        if (!currentFriend) return false;

        return window.imApp.commitScopedFriendChange(currentFriend, mutator, {
            syncActive: false,
            syncSettings: true,
            metaOnly: options.metaOnly !== false,
            ...options
        });
    }

    async function commitNamedFriendChange(friend, mutator, options = {}) {
        if (!friend) return false;

        return window.imApp.commitScopedFriendChange(friend, mutator, {
            syncActive: false,
            syncSettings: true,
            metaOnly: options.metaOnly !== false,
            ...options
        });
    }

    const chatBackgroundOperationTokens = new Map();

    function beginChatBackgroundOperation(friend) {
        if (friend?.id == null) return null;
        const friendId = String(friend.id);
        const token = (chatBackgroundOperationTokens.get(friendId) || 0) + 1;
        chatBackgroundOperationTokens.set(friendId, token);
        return { friendId, token };
    }

    function isLatestChatBackgroundOperation(operation) {
        return !!operation
            && chatBackgroundOperationTokens.get(operation.friendId) === operation.token;
    }

    function getLatestChatBackgroundFriend(friend) {
        return window.imApp.getFriendById
            ? window.imApp.getFriendById(friend)
            : friend;
    }

    async function saveChatBackgroundUpload(file, friend) {
        if (!file || !friend) return { status: 'ignored' };
        const operation = beginChatBackgroundOperation(friend);
        if (!operation) return { status: 'ignored' };

        const bgUrl = window.imApp.compressImageFile
            ? await window.imApp.compressImageFile(file, {
                maxWidth: 1440,
                maxHeight: 1440,
                mimeType: 'image/jpeg',
                quality: 0.82
            })
            : await window.imApp.readFileAsDataUrl(file);

        if (!isLatestChatBackgroundOperation(operation)) return { status: 'superseded' };

        const saved = await commitNamedFriendChange(friend, (targetFriend) => {
            targetFriend.chatBg = bgUrl;
            targetFriend.chatBgAssetId = null;
        }, { silent: true });

        if (!isLatestChatBackgroundOperation(operation)) return { status: 'superseded' };
        if (!saved) return { status: 'failed' };

        const latestFriend = getLatestChatBackgroundFriend(friend);
        applyFriendBg(latestFriend);
        return { status: 'saved', friend: latestFriend };
    }

    async function resetChatBackground(friend) {
        if (!friend) return { status: 'ignored' };
        const operation = beginChatBackgroundOperation(friend);
        if (!operation) return { status: 'ignored' };

        const saved = await commitNamedFriendChange(friend, (targetFriend) => {
            targetFriend.chatBg = null;
            targetFriend.chatBgAssetId = null;
        }, { silent: true });

        if (!isLatestChatBackgroundOperation(operation)) return { status: 'superseded' };
        if (!saved) return { status: 'failed' };

        const latestFriend = getLatestChatBackgroundFriend(friend);
        applyFriendBg(latestFriend);
        return { status: 'reset', friend: latestFriend };
    }

    function updateStatusBarBtnCount() {
        return;
    }
    
    function getRelationshipTargetId(relation) {
        return String(relation?.targetId ?? relation?.npcId ?? '');
    }

    function getRelationshipTarget(relationOrId) {
        const targetId = typeof relationOrId === 'object'
            ? getRelationshipTargetId(relationOrId)
            : String(relationOrId ?? '');
        return (window.imData.friends || []).find(item =>
            (item?.type === 'char' || item?.type === 'npc')
            && String(item.id) === targetId
        ) || null;
    }

    function getRelationshipTypeLabel(target) {
        return target?.type === 'npc' ? 'NPC' : 'Char';
    }

    function getRelationshipFallbackIcon(target) {
        return target?.type === 'npc' ? 'fa-robot' : 'fa-user';
    }

    function escapeRelationshipHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getDraftRelationValue(targetId, friend) {
        const draftRelation = tempRelationshipDrafts.find(rel => getRelationshipTargetId(rel) === String(targetId));
        const savedRelation = friend.memory.relationships.find(rel => getRelationshipTargetId(rel) === String(targetId));
        if (draftRelation) return draftRelation.relation || '';
        return savedRelation ? (savedRelation.relation || '') : '';
    }
    
    function scheduleRelationshipPreviewRender(friend) {
        if (!friend) return;
        pendingRelationshipPreviewFriend = friend;
        if (relationshipPreviewFrame !== null) return;

        relationshipPreviewFrame = window.requestAnimationFrame(() => {
            relationshipPreviewFrame = null;
            const pendingFriend = pendingRelationshipPreviewFriend;
            pendingRelationshipPreviewFriend = null;
            if (pendingFriend) renderRelationshipPreview(pendingFriend);
        });
    }

    function renderRelationshipList(friend) {
        if (!relationshipList || !relationshipEmptyState) return;

        friend.memory = friend.memory || window.imApp.createDefaultMemory();
        if (!Array.isArray(friend.memory.relationships)) {
            friend.memory.relationships = [];
        }

        const selectedRelations = tempRelationshipDrafts;

        relationshipList.innerHTML = '';
        relationshipEmptyState.innerHTML = '';
        relationshipEmptyState.style.display = 'none';
        const visibleRelations = selectedRelations.filter(rel => !!getRelationshipTarget(rel));
        if (relationshipSelectedCount) relationshipSelectedCount.textContent = String(visibleRelations.length);
        if (relationshipTotalBadge) relationshipTotalBadge.textContent = `${visibleRelations.length} 人`;

        if (visibleRelations.length === 0) {
            relationshipList.style.display = 'none';
            relationshipEmptyState.style.display = 'block';
            relationshipEmptyState.innerHTML = `
                <div class="relationship-empty-icon"><i class="fas fa-user-group"></i></div>
                <div class="relationship-empty-title">还没有添加人物</div>
                <div class="relationship-empty-copy">可从已有 Char 或 NPC 中选择，为他们记录与当前 Char 的关系。</div>
            `;
            return;
        }

        relationshipList.style.display = 'flex';

        visibleRelations.forEach(rel => {
            const target = getRelationshipTarget(rel);
            if (!target) return;
            const targetId = String(target.id);

            const item = document.createElement('div');
            item.className = 'relationship-item';

            const avatarHtml = target.avatarUrl
                ? `<img src="${escapeRelationshipHtml(target.avatarUrl)}" alt="">`
                : `<i class="fas ${getRelationshipFallbackIcon(target)}"></i>`;
            const displayName = target.nickname || target.realName || '未命名人物';
            const secondaryText = target.realName && target.realName !== target.nickname
                ? target.realName
                : (target.signature || (target.type === 'npc' ? 'NPC 联系人' : 'Char 联系人'));

            item.innerHTML = `
                <div class="relationship-avatar">${avatarHtml}</div>
                <div class="relationship-meta">
                    <div class="relationship-name-row">
                        <div class="relationship-name">${escapeRelationshipHtml(displayName)}</div>
                        <span class="relationship-type-badge ${target.type === 'npc' ? 'is-npc' : 'is-char'}">${getRelationshipTypeLabel(target)}</span>
                    </div>
                    <div class="relationship-desc">${escapeRelationshipHtml(secondaryText)}</div>
                </div>
                <input class="relationship-input" data-target-id="${escapeRelationshipHtml(targetId)}" type="text" placeholder="例如：好友、同事" value="${escapeRelationshipHtml(rel.relation || '')}">
                <button type="button" class="relationship-delete-btn" aria-label="移除 ${escapeRelationshipHtml(displayName)}"><i class="fas fa-xmark"></i></button>
            `;

            const deleteBtn = item.querySelector('.relationship-delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    collectRelationshipDrafts();
                    tempRelationshipDrafts = tempRelationshipDrafts.filter(r => getRelationshipTargetId(r) !== targetId);
                    
                    relationshipList.innerHTML = '';
                    renderRelationshipList(friend);
                    renderRelationshipPreview(friend);
                    renderRelationshipPicker(friend);
                });
            }
            
            const relInput = item.querySelector('.relationship-input');
            if (relInput) {
                relInput.addEventListener('input', () => {
                    collectRelationshipDrafts();
                    scheduleRelationshipPreviewRender(friend);
                });
            }

            relationshipList.appendChild(item);
        });
    }

    function renderRelationshipPreview(friend) {
        const previewArea = document.getElementById('relationship-preview-area');
        const canvas = document.getElementById('relationship-canvas');
        const nodesContainer = document.getElementById('relationship-nodes-container');
        
        if (!previewArea || !canvas || !nodesContainer) return;
        
        canvas.width = previewArea.clientWidth;
        canvas.height = previewArea.clientHeight;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        nodesContainer.innerHTML = '';
        
        const selectedRelations = tempRelationshipDrafts.filter(rel => !!getRelationshipTarget(rel));
            
        if (selectedRelations.length === 0) {
            // Still render main node even if no relations
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            
            const mainNode = document.createElement('div');
            mainNode.className = 'relationship-node main-node';
            mainNode.style.left = `${centerX - 25}px`;
            mainNode.style.top = `${centerY - 25}px`;
            
            const mainAvatar = friend.avatarUrl 
                ? `<img src="${escapeRelationshipHtml(friend.avatarUrl)}" alt="">`
                : `<i class="fas fa-user"></i>`;

            mainNode.innerHTML = `${mainAvatar}<div class="node-label">${escapeRelationshipHtml(friend.nickname || 'Char')}</div>`;
            nodesContainer.appendChild(mainNode);
            return;
        }

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        const mainNode = document.createElement('div');
        mainNode.className = 'relationship-node main-node';
        mainNode.style.left = `${centerX - 25}px`;
        mainNode.style.top = `${centerY - 25}px`;
        
        const mainAvatar = friend.avatarUrl 
            ? `<img src="${escapeRelationshipHtml(friend.avatarUrl)}" alt="">`
            : `<i class="fas fa-user"></i>`;

        mainNode.innerHTML = `${mainAvatar}<div class="node-label">${escapeRelationshipHtml(friend.nickname || 'Char')}</div>`;
        nodesContainer.appendChild(mainNode);

        const radius = Math.max(72, Math.min(canvas.width, canvas.height) * 0.34);
        const angleStep = (Math.PI * 2) / selectedRelations.length;

        ctx.strokeStyle = 'rgba(88, 86, 214, 0.28)';
        ctx.lineWidth = 2;

        selectedRelations.forEach((rel, index) => {
            const target = getRelationshipTarget(rel);
            if (!target) return;

            const angle = index * angleStep - Math.PI / 2;
            const offsetX = radius * Math.cos(angle);
            const offsetY = radius * Math.sin(angle);
            const x = centerX + offsetX;
            const y = centerY + offsetY;

            // Draw line
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(x, y);
            ctx.stroke();

            // Draw text on line
            if (rel.relation) {
                const textX = centerX + offsetX * 0.5;
                const textY = centerY + offsetY * 0.5;
                
                ctx.font = '11px sans-serif';
                const metrics = ctx.measureText(rel.relation);
                const textWidth = metrics.width;
                const textHeight = 18;
                
                // Rotation for text
                let textAngle = Math.atan2(offsetY, offsetX);
                if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2) {
                    textAngle += Math.PI;
                }

                ctx.save();
                ctx.translate(textX, textY);
                ctx.rotate(textAngle);
                
                // Background
                ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
                ctx.beginPath();
                ctx.roundRect(-textWidth/2 - 7, -textHeight/2, textWidth + 14, textHeight, 8);
                ctx.fill();
                
                // Text
                ctx.fillStyle = '#3f3f46';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(rel.relation, 0, 0);
                
                ctx.restore();
            }

            // Create linked person node in DOM
            const targetNode = document.createElement('div');
            targetNode.className = `relationship-node ${target.type === 'npc' ? 'npc-node' : 'char-node'}`;
            targetNode.style.left = `${x - 20}px`;
            targetNode.style.top = `${y - 20}px`;
            
            const targetAvatar = target.avatarUrl
                ? `<img src="${escapeRelationshipHtml(target.avatarUrl)}" alt="">`
                : `<i class="fas ${getRelationshipFallbackIcon(target)}"></i>`;

            targetNode.innerHTML = `${targetAvatar}<div class="node-label">${escapeRelationshipHtml(target.nickname || target.realName || '人物')}</div>`;
            
            nodesContainer.appendChild(targetNode);
        });
    }
    
    // Setup Interaction for Relationship Preview
    function renderRelationshipPicker(friend) {
        if (!relationshipPicker || !relationshipPickerList) return;

        const allPeople = (window.imData.friends || []).filter(item =>
            (item.type === 'char' || item.type === 'npc')
            && String(item.id) !== String(friend.id)
        );
        // The sheet edits a live draft. An empty draft means the user removed
        // everything; falling back to saved data here makes deleted people
        // impossible to re-add until the sheet is reopened.
        const selectedTargetIds = new Set(tempRelationshipDrafts.map(getRelationshipTargetId));

        relationshipPickerList.innerHTML = '';

        const availablePeople = allPeople.filter(person =>
            !selectedTargetIds.has(String(person.id))
            && (relationshipPickerType === 'all' || person.type === relationshipPickerType)
        );

        if (!isRelationshipPickerVisible) {
            relationshipPicker.style.display = 'none';
            return;
        }

        relationshipPicker.style.display = 'block';

        relationshipPicker.querySelectorAll('.relationship-filter-btn').forEach(button => {
            button.classList.toggle('active', button.dataset.type === relationshipPickerType);
        });

        if (availablePeople.length === 0) {
            const typeText = relationshipPickerType === 'char' ? 'Char' : (relationshipPickerType === 'npc' ? 'NPC' : '人物');
            relationshipPickerList.innerHTML = `<div class="relationship-picker-empty">暂无可添加的${typeText}</div>`;
            return;
        }

        availablePeople.forEach(target => {
            const item = document.createElement('div');
            item.className = 'relationship-item relationship-picker-item';

            const avatarHtml = target.avatarUrl
                ? `<img src="${escapeRelationshipHtml(target.avatarUrl)}" alt="">`
                : `<i class="fas ${getRelationshipFallbackIcon(target)}"></i>`;
            const displayName = target.nickname || target.realName || '未命名人物';
            const secondaryText = target.realName && target.realName !== target.nickname
                ? target.realName
                : (target.signature || (target.type === 'npc' ? 'NPC 联系人' : 'Char 联系人'));

            item.innerHTML = `
                <div class="relationship-avatar">${avatarHtml}</div>
                <div class="relationship-meta">
                    <div class="relationship-name-row">
                        <div class="relationship-name">${escapeRelationshipHtml(displayName)}</div>
                        <span class="relationship-type-badge ${target.type === 'npc' ? 'is-npc' : 'is-char'}">${getRelationshipTypeLabel(target)}</span>
                    </div>
                    <div class="relationship-desc">${escapeRelationshipHtml(secondaryText)}</div>
                </div>
                <span class="relationship-picker-add"><i class="fas fa-plus"></i></span>
            `;

            item.addEventListener('click', () => {
                collectRelationshipDrafts();

                if (!tempRelationshipDrafts.some(rel => getRelationshipTargetId(rel) === String(target.id))) {
                    tempRelationshipDrafts.push({
                        npcId: String(target.id),
                        targetType: target.type,
                        relation: getDraftRelationValue(target.id, friend)
                    });
                }

                renderRelationshipList(friend);
                renderRelationshipPicker(friend);
                renderRelationshipPreview(friend);
                showToast(`已添加${getRelationshipTypeLabel(target)}：${displayName}`);
            });

            relationshipPickerList.appendChild(item);
        });
    }

    function renderRelationshipSheet(friend) {
        if (!relationshipList || !relationshipEmptyState) return;

        friend.memory = friend.memory || window.imApp.createDefaultMemory();
        if (!Array.isArray(friend.memory.relationships)) {
            friend.memory.relationships = [];
        }

        if (relationshipSheet && relationshipSheet.style.display === 'none' && tempRelationshipDrafts.length === 0) {
            tempRelationshipDrafts = friend.memory.relationships.map(rel => ({
                npcId: getRelationshipTargetId(rel),
                targetType: rel.targetType || getRelationshipTarget(rel)?.type,
                relation: rel.relation || '',
                offsetX: rel.offsetX,
                offsetY: rel.offsetY
            }));
        }
        
        renderRelationshipList(friend);
        renderRelationshipPicker(friend);
        setTimeout(() => renderRelationshipPreview(friend), 150);
    }

    function collectRelationshipDrafts() {
        if (!relationshipList) return;
        const inputs = relationshipList.querySelectorAll('.relationship-input');
        const currentValues = Array.from(inputs).map(input => {
            const targetId = input.getAttribute('data-target-id');
            const existingRel = tempRelationshipDrafts.find(r => getRelationshipTargetId(r) === targetId);
            const target = getRelationshipTarget(targetId);
            return {
                npcId: targetId,
                targetType: target?.type || existingRel?.targetType,
                relation: input.value.trim(),
                offsetX: existingRel ? existingRel.offsetX : undefined,
                offsetY: existingRel ? existingRel.offsetY : undefined
            };
        });

        const existingIds = new Set(currentValues.map(getRelationshipTargetId));
        const hiddenDrafts = tempRelationshipDrafts.filter(item => !existingIds.has(getRelationshipTargetId(item)));
        tempRelationshipDrafts = [...currentValues, ...hiddenDrafts];
    }

    function getAvailableAccounts() {
        return typeof window.getAccounts === 'function' ? window.getAccounts() : [];
    }

    function getBoundAccountByFriend(friend) {
        if (!friend || !friend.boundAccountId) return null;
        const accounts = getAvailableAccounts();
        return accounts.find(acc => String(acc.id) === String(friend.boundAccountId)) || null;
    }

    function getEffectivePersonaForFriend(friend) {
        const boundAccount = getBoundAccountByFriend(friend);
        if (!boundAccount) return userState.persona || '';
        return boundAccount.signature || boundAccount.persona || '';
    }

    function getFriendsBoundToAccount(accountId) {
        const allFriends = Array.isArray(window.imData?.friends) ? window.imData.friends : [];
        return allFriends.filter(friend => friend && friend.type !== 'group' && String(friend.boundAccountId || '') === String(accountId));
    }

    function updateChatBindIdLabel(friend) {
        if (!chatBindIdLabel) return;
        const boundAccount = getBoundAccountByFriend(friend);
        chatBindIdLabel.textContent = boundAccount ? (boundAccount.name || '已绑定') : '';
    }

    function renderBindAccountList(friend) {
        if (!bindAccountList || !bindAccountEmpty) return;

        const accounts = getAvailableAccounts();
        bindAccountList.innerHTML = '';

        const options = [
            {
                id: null,
                name: '不绑定',
                phone: '恢复为当前 Apple ID 默认人设',
                persona: ''
            },
            ...accounts
        ];

        if (options.length === 1) {
            bindAccountList.style.display = 'none';
            bindAccountEmpty.style.display = 'block';
            return;
        }

        bindAccountList.style.display = 'flex';
        bindAccountEmpty.style.display = 'none';

        options.forEach(acc => {
            const isSelected = String(tempSelectedAccountId || '') === String(acc.id || '');
            const personaText = acc.id == null
                ? '聊天时将继续读取当前 Apple ID 人设'
                : (acc.signature || acc.persona || '该 ID 暂无人设');

            const item = document.createElement('div');
            item.className = 'account-card';
            item.style.padding = '10px 14px';
            item.style.height = 'auto';
            item.style.cursor = 'pointer';
            item.style.borderRadius = '999px';
            item.style.border = isSelected ? '2px solid #007aff' : '1px solid #e5e5ea';
            item.style.boxShadow = '0 1px 6px rgba(0,0,0,0.04)';
            item.style.background = '#fff';

            item.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px; width:100%;">
                    <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
                        <div style="width:34px; height:34px; border-radius:999px; background:${acc.id == null ? '#8e8e93' : '#34c759'}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0;">
                            <i class="fas ${acc.id == null ? 'fa-ban' : 'fa-id-card'}"></i>
                        </div>
                        <div style="min-width:0; flex:1;">
                            <div style="font-size:14px; font-weight:600; color:#000; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${acc.name || '未命名ID'}</div>
                            <div style="font-size:11px; color:#8e8e93; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${acc.phone || personaText}</div>
                            <div style="font-size:11px; color:#666; margin-top:2px; line-height:1.35; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">${personaText}</div>
                        </div>
                    </div>
                    <div style="margin-left:auto; width:20px; height:20px; border-radius:50%; border:1px solid ${isSelected ? '#007aff' : '#c7c7cc'}; background:${isSelected ? '#007aff' : 'transparent'}; display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px; flex-shrink:0;">
                        ${isSelected ? '<i class="fas fa-check"></i>' : ''}
                    </div>
                </div>
            `;

            item.addEventListener('click', () => {
                tempSelectedAccountId = acc.id == null ? null : acc.id;
                renderBindAccountList(friend);
            });

            bindAccountList.appendChild(item);
        });
    }

    async function persistProfileStatusMigration(friend) {
        if (!friend || friend.type === 'group' || !window.imApp.migrateSingleChatProfileStatus) return true;
        const changed = window.imApp.migrateSingleChatProfileStatus(friend);
        if (!changed && !friend._profileStatusNeedsPersistence) return true;

        return commitNamedFriendChange(friend, (targetFriend) => {
            window.imApp.migrateSingleChatProfileStatus(targetFriend);
            delete targetFriend._profileStatusNeedsPersistence;
        }, { silent: true });
    }

    function renderStatusPromptSettings(friend) {
        if (!friend) return;
        const enabled = friend.statusPromptEnabled === true;
        if (statusPromptEnabledToggle) statusPromptEnabledToggle.checked = enabled;
        if (statusPromptInput) {
            const savedPrompt = typeof friend.statusPrompt === 'string' ? friend.statusPrompt.trim() : '';
            statusPromptInput.value = savedPrompt || DEFAULT_STATUS_PROMPT;
            statusPromptInput.disabled = !enabled;
        }
    }

    function renderChatCotSettings(friend) {
        if (!friend) return;
        if (chatCotSettingsBtn) chatCotSettingsBtn.style.display = friend.type === 'group' ? 'none' : 'flex';
        if (friend.type === 'group') return;
        const enabled = friend.cotEnabled === true;
        if (chatCotEnabledToggle) chatCotEnabledToggle.checked = enabled;
        if (chatCotPromptInput) {
            const savedPrompt = typeof friend.cotPrompt === 'string' ? friend.cotPrompt.trim() : '';
            chatCotPromptInput.value = savedPrompt || DEFAULT_SINGLE_CHAT_COT_PROMPT;
        }
        if (chatCotSettingsLabel) chatCotSettingsLabel.textContent = enabled ? '开启' : '关闭';
    }

    function getIdentityNames(identity = {}) {
        return Array.from(new Set([identity.nickname, identity.realName]
            .map(value => String(value || '').trim())
            .filter(Boolean)));
    }

    async function migrateGroupMemberIdentityReferences(memberId, previousIdentity = {}, nextIdentity = {}) {
        const previousNames = new Set(getIdentityNames(previousIdentity));
        const previousAvatarUrl = String(previousIdentity.avatarUrl || '').trim();
        const nextName = String(nextIdentity.nickname || nextIdentity.realName || '群成员').trim() || '群成员';
        const nextAvatarUrl = nextIdentity.avatarUrl || '';
        const groups = (window.imData.friends || []).filter(group => {
            if (!group || group.type !== 'group' || !Array.isArray(group.members)) return false;
            return group.members.some(memberRef => String(memberRef) === String(memberId) || previousNames.has(String(memberRef || '').trim()));
        });
        const changedGroupIds = [];

        for (const group of groups) {
            if (window.imApp.ensureFriendMessagesLoaded) {
                await window.imApp.ensureFriendMessagesLoaded(group);
            }
            const avatarIsUnique = !!previousAvatarUrl && !(window.imChat?.getGroupMemberFriends
                ? window.imChat.getGroupMemberFriends(group).some(member => String(member.id) !== String(memberId)
                    && String(member.avatarUrl || '').trim() === previousAvatarUrl)
                : false);
            let changed = false;
            const saved = await window.imApp.commitFriendChange(group.id, (targetGroup) => {
                if (!targetGroup) return;
                targetGroup.members = (targetGroup.members || []).map(memberRef => {
                    if (String(memberRef) === String(memberId) || previousNames.has(String(memberRef || '').trim())) {
                        if (String(memberRef) !== String(memberId)) changed = true;
                        return memberId;
                    }
                    return memberRef;
                });

                (targetGroup.messages || []).forEach(message => {
                    if (!message || message.role === 'user') return;
                    const storedMemberId = message.speakerMemberId ?? message.senderMemberId ?? null;
                    const storedNames = [message.speaker, message.senderName]
                        .map(value => String(value || '').trim())
                        .filter(Boolean);
                    const matchesId = storedMemberId != null && String(storedMemberId) === String(memberId);
                    const matchesLegacyName = storedMemberId == null && storedNames.some(name => previousNames.has(name));
                    const matchesLegacyAvatar = storedMemberId == null && avatarIsUnique
                        && String(message.senderAvatarUrl || '').trim() === previousAvatarUrl;
                    if (!matchesId && !matchesLegacyName && !matchesLegacyAvatar) return;

                    message.speakerMemberId = memberId;
                    message.speaker = nextName;
                    if (message.senderName || message.type === 'group_red_packet' || message.type === 'pay_transfer') {
                        message.senderName = nextName;
                    }
                    if (nextAvatarUrl || message.senderAvatarUrl) {
                        message.senderAvatarUrl = nextAvatarUrl || message.senderAvatarUrl || '';
                    }
                    changed = true;
                });
            }, { silent: true, metaOnly: false });

            if (saved && changed) changedGroupIds.push(String(group.id));
        }

        changedGroupIds.forEach(groupId => {
            const group = (window.imData.friends || []).find(item => String(item.id) === groupId);
            const page = document.getElementById(`chat-interface-${groupId}`);
            const container = page?.querySelector('.ins-chat-messages');
            if (group && container && window.imChat?.rerenderChatContainer) {
                window.imChat.rerenderChatContainer(group, container, { scroll: false });
            }
        });

        return changedGroupIds;
    }

    function setBindAccountDetailAvatar(url) {
        bindAccountDetailAvatarUrl = url || null;

        if (bindAccountDetailAvatarImg) {
            bindAccountDetailAvatarImg.src = bindAccountDetailAvatarUrl || '';
            bindAccountDetailAvatarImg.style.display = bindAccountDetailAvatarUrl ? 'block' : 'none';
        }

        if (bindAccountDetailAvatarIcon) {
            bindAccountDetailAvatarIcon.style.display = bindAccountDetailAvatarUrl ? 'none' : 'block';
        }
    }

    function getAccountById(accountId) {
        if (!accountId || accountId === 'none') return null;
        return getAvailableAccounts().find(acc => String(acc.id) === String(accountId)) || null;
    }

    function renderBindAccountDetailSelect(friend) {
        if (!bindAccountDetailSelect) return;

        const accounts = getAvailableAccounts();
        bindAccountDetailSelect.innerHTML = '<option value="none">不绑定</option>';

        accounts.forEach(acc => {
            const option = document.createElement('option');
            option.value = acc.id;
            option.textContent = acc.name || '未命名ID';
            bindAccountDetailSelect.appendChild(option);
        });

        const selectedAccount = getBoundAccountByFriend(friend);
        bindAccountDetailSelect.value = selectedAccount ? String(selectedAccount.id) : 'none';
    }

    function renderBindAccountDetailForm(friend) {
        const selectedAccountId = bindAccountDetailSelect ? bindAccountDetailSelect.value : (friend?.boundAccountId || 'none');
        const account = getAccountById(selectedAccountId);
        const hasAccounts = getAvailableAccounts().length > 0;

        if (!account) {
            if (bindAccountDetailForm) bindAccountDetailForm.style.display = 'none';
            if (bindAccountDetailEmpty) {
                bindAccountDetailEmpty.style.display = 'block';
                bindAccountDetailEmpty.textContent = hasAccounts
                    ? '当前未绑定 ID，选择一个 ID 后可快捷编辑资料'
                    : '暂无可用 ID，请先在系统设置的 Apple ID 中创建账号';
            }
            if (bindAccountDetailSaveBtn) bindAccountDetailSaveBtn.style.display = 'none';
            setBindAccountDetailAvatar(null);
            return;
        }

        if (bindAccountDetailEmpty) bindAccountDetailEmpty.style.display = 'none';
        if (bindAccountDetailForm) bindAccountDetailForm.style.display = 'block';
        if (bindAccountDetailSaveBtn) bindAccountDetailSaveBtn.style.display = 'flex';

        if (bindAccountDetailNameInput) bindAccountDetailNameInput.value = account.name || '';
        if (bindAccountDetailPhoneInput) bindAccountDetailPhoneInput.value = account.phone || '';
        if (bindAccountDetailSignatureInput) bindAccountDetailSignatureInput.value = account.signature || '';
        if (bindAccountDetailPersonaInput) bindAccountDetailPersonaInput.value = account.persona || '';
        setBindAccountDetailAvatar(account.avatarUrl || null);
    }

    function openBindAccountDetailSheet(friend) {
        if (!friend || !bindAccountDetailSheet) return;

        renderBindAccountDetailSelect(friend);
        renderBindAccountDetailForm(friend);
        openView(bindAccountDetailSheet);
    }

    async function saveBindAccountSelection(nextBoundAccountId) {
        const friend = window.imData.currentSettingsFriend;
        if (!friend) return false;

        const normalizedAccountId = nextBoundAccountId && nextBoundAccountId !== 'none'
            ? nextBoundAccountId
            : null;
        const saved = await commitSettingsFriendChange((targetFriend) => {
            targetFriend.boundAccountId = normalizedAccountId;
        }, { silent: true });

        if (!saved) {
            showToast('角色绑定ID保存失败');
            return false;
        }

        updateChatBindIdLabel(window.imData.currentSettingsFriend);
        if (window.updateBindRoleEntryPoints) window.updateBindRoleEntryPoints();
        refreshChatPageForFriend(window.imData.currentSettingsFriend);
        return true;
    }

    function refreshChatPageForFriend(friendOrId) {
        const friend = window.imApp.getFriendById
            ? window.imApp.getFriendById(friendOrId)
            : friendOrId;
        if (!friend) return false;

        let refreshed = false;

        const page = document.getElementById(`chat-interface-${friend.id}`);
        const msgContainer = page?.querySelector('.ins-chat-messages');
        if (msgContainer && window.imChat?.rerenderChatContainer) {
            window.imChat.rerenderChatContainer(friend, msgContainer, { scroll: false });
            refreshed = true;
        }

        if (window.imChat?.refreshOfflineUserIdentity) {
            refreshed = window.imChat.refreshOfflineUserIdentity(friend) || refreshed;
        }

        return refreshed;
    }

    function refreshChatPagesBoundToAccount(accountId) {
        if (!accountId) return;

        getFriendsBoundToAccount(accountId).forEach(friend => {
            refreshChatPageForFriend(friend);
        });
    }

    function setActiveChatSettingsTab(tabName) {
        const tabs = document.querySelectorAll('#chat-settings-segment .char-settings-tab');
        const panels = document.querySelectorAll('#chat-settings-sheet .char-settings-panel');

        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
        });

        panels.forEach(panel => {
            const isActivePanel = panel.id === `chat-settings-${tabName}-panel`;
            panel.classList.toggle('active', isActivePanel);
            if (isActivePanel) panel.scrollTop = 0;
        });
        
        if (tabName === 'memory' && window.imData.currentSettingsFriend) {
            bindChatMemoryPanelButtons();
            renderChatMemoryOverviewStats(window.imData.currentSettingsFriend);
        }
    }
    
    function renderChatMemoryOverviewStats(friend) {
        const statsContainer = document.getElementById('chat-memory-overview-stats');
        if (!statsContainer) return;

        const normalizedFriend = window.imApp.normalizeFriendData(friend);
        const memory = normalizedFriend.memory || window.imApp.createDefaultMemory();
        const messageCount = Array.isArray(normalizedFriend.messages) ? normalizedFriend.messages.length : 0;
        const shortTermEntries = Array.isArray(memory.shortTermEntries) ? memory.shortTermEntries : [];
        const longTermEntries = [
            ...(Array.isArray(memory.longTermEntries) ? memory.longTermEntries : []),
            ...(Array.isArray(memory.cherishedEntries) ? memory.cherishedEntries : [])
        ];
        const xDirectMessageMount = window.imApp.normalizeXDirectMessageMount
            ? window.imApp.normalizeXDirectMessageMount(memory.xDirectMessageMount)
            : { enabled: true, limit: 10, dmId: '' };
        const schedule = memory.schedule || {};
            
        // Re-calculate tokenCount realistically
        let tokenCount = 0;
        let systemContextLen = 0;
            
        if (window.getGlobalWorldBookContext) {
            const sysWorldBook = window.getGlobalWorldBookContext();
            systemContextLen += (sysWorldBook || '').length;
        }
            
        systemContextLen += (normalizedFriend.persona || '').length;
        systemContextLen += (userState?.persona || '').length;
        systemContextLen += (memory.overview || '').length;
        systemContextLen += (memory.longTerm || '').length;
        systemContextLen += (memory.cherished || '').length;
        systemContextLen += (memory.context?.notes || '').length;
        const groupContextCandidates = window.imApp.getEligibleGroupChatMemoryContexts
            ? window.imApp.getEligibleGroupChatMemoryContexts(normalizedFriend)
            : [];
        groupContextCandidates.forEach(({ group, messageLimit }) => {
            const groupMemory = getGroupChatMemoryMessages(group, messageLimit);
            systemContextLen += (group.nickname || group.realName || '').length + 280;
            systemContextLen += groupMemory.selectedMessages.reduce((sum, message) => (
                    sum + String(message?.content || message?.text || message?.transcript || message?.description || '').length
                ), 0);
        });
        if (Array.isArray(memory.relationships)) {
            systemContextLen += memory.relationships.reduce((sum, r) => sum + (r.relation || '').length, 0);
        }
        systemContextLen += 800; 
            
        let recentMessagesLen = 0;
        if (window.imApp.buildApiContextMessages) {
            const contextMsgs = window.imApp.buildApiContextMessages(normalizedFriend);
            if (Array.isArray(contextMsgs)) {
                recentMessagesLen = contextMsgs.reduce((sum, msg) => sum + (msg.content || '').length, 0);
            }
        }
            
        tokenCount = systemContextLen + recentMessagesLen;
            
        let firstMsgTime = Date.now();
        let lastMsgTime = Date.now();
        if (messageCount > 0) {
            firstMsgTime = normalizedFriend.messages[0].timestamp || Date.now();
            lastMsgTime = normalizedFriend.messages[messageCount - 1].timestamp || Date.now();
        }
        const days = Math.max(1, Math.ceil((Date.now() - firstMsgTime) / (1000 * 60 * 60 * 24)));
            
        const lastTimeStr = window.imApp.formatTime ? window.imApp.formatTime(lastMsgTime) : new Date(lastMsgTime).toLocaleString();

        statsContainer.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
                <div style="background: #ffffff; border: 1px solid #ececf2; border-radius: 12px; padding: 10px; text-align: center;">
                    <div style="font-size: 11px; color: #8e8e93; margin-bottom: 4px;">聊天总数</div>
                    <div style="font-size: 16px; font-weight: 700; color: #111;">${messageCount}</div>
                </div>
                <div style="background: #ffffff; border: 1px solid #ececf2; border-radius: 12px; padding: 10px; text-align: center;">
                    <div style="font-size: 11px; color: #8e8e93; margin-bottom: 4px;">建联天数</div>
                    <div style="font-size: 16px; font-weight: 700; color: #111;">${days}</div>
                </div>
                <div style="background: #ffffff; border: 1px solid #ececf2; border-radius: 12px; padding: 10px; text-align: center;">
                    <div style="font-size: 11px; color: #8e8e93; margin-bottom: 4px;">总Token估算</div>
                    <div style="font-size: 16px; font-weight: 700; color: #111;">${tokenCount}</div>
                </div>
                <div style="background: #ffffff; border: 1px solid #ececf2; border-radius: 12px; padding: 10px; text-align: center;">
                    <div style="font-size: 11px; color: #8e8e93; margin-bottom: 4px;">最后聊天</div>
                    <div style="font-size: 13px; font-weight: 700; color: #111; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${messageCount > 0 ? lastTimeStr : '无'}</div>
                </div>
            </div>
        `;

        const setCountText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value > 0 ? `${value}项` : '';
        };
        setCountText('chat-memory-shortterm-count', shortTermEntries.length);
        setCountText('chat-memory-group-context-count', groupContextCandidates.length);
        setCountText('chat-memory-longterm-count', longTermEntries.length);
        const xDmContextStatus = document.getElementById('chat-memory-x-dm-context-count');
        if (xDmContextStatus) {
            const hasMatchingXDirectMessage = xDirectMessageMount.dmId || Boolean(
                window.imApp.getXDirectMessageMountCandidates?.(normalizedFriend)?.length
            );
            xDmContextStatus.textContent = hasMatchingXDirectMessage
                ? (xDirectMessageMount.enabled ? `${xDirectMessageMount.limit}条/类` : '关闭')
                : '';
        }

        const scheduleStatus = document.getElementById('chat-memory-schedule-status');
        if (scheduleStatus) {
            scheduleStatus.textContent = schedule.enabled ? '开启' : '关闭';
        }
    }

    window.addEventListener('u2:memory-entries-updated', event => {
        const friend = window.imData.currentSettingsFriend;
        if (!friend || String(event.detail?.friendId || '') !== String(friend.id)) return;
        const latestFriend = window.imApp.getFriendById?.(friend.id) || friend;
        window.imData.currentSettingsFriend = latestFriend;
        renderChatMemoryOverviewStats(latestFriend);
    });

    function ensureChatMemoryModalUi() {
        const memoryPanel = document.getElementById('chat-settings-memory-panel');
        const modalRoot = chatSettingsSheet || memoryPanel;
        if (!modalRoot) return null;

        let overlay = document.getElementById('chat-memory-modal-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'chat-memory-modal-overlay';
            overlay.className = 'chat-memory-modal-overlay';
            overlay.style.display = 'none';
            overlay.innerHTML = `
                <div class="chat-memory-modal-card">
                    <button type="button" class="chat-memory-modal-close" aria-label="关闭">
                        <i class="fas fa-times"></i>
                    </button>
                    <div id="chat-memory-modal-label" class="chat-memory-modal-label">记忆</div>
                    <div id="chat-memory-modal-title" class="chat-memory-modal-title">记忆内容</div>
                    <div id="chat-memory-modal-subtitle" class="chat-memory-modal-subtitle"></div>
                    <div id="chat-memory-modal-content" class="chat-memory-modal-content"></div>
                </div>
            `;
            modalRoot.appendChild(overlay);

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    hideChatMemoryModal();
                }
            });

            const closeBtn = overlay.querySelector('.chat-memory-modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    hideChatMemoryModal();
                });
            }
        }

        return {
            overlay,
            labelEl: document.getElementById('chat-memory-modal-label'),
            titleEl: document.getElementById('chat-memory-modal-title'),
            subtitleEl: document.getElementById('chat-memory-modal-subtitle'),
            contentEl: document.getElementById('chat-memory-modal-content')
        };
    }

    function hideChatMemoryModal() {
        const overlay = document.getElementById('chat-memory-modal-overlay');
        if (!overlay) return;

        overlay.classList.remove('active');
        setTimeout(() => {
            if (!overlay.classList.contains('active')) {
                overlay.style.display = 'none';
            }
        }, 220);
    }

    function buildTextMemoryModalHtml(title, content, emptyText) {
        const safeContent = String(content || '').trim();
        if (!safeContent) {
            return `<div class="chat-memory-modal-empty">${emptyText}</div>`;
        }

        return `
            <div class="chat-memory-modal-text-block">
                ${safeContent}
            </div>
        `;
    }

    function showChatMemoryModal(type, friend) {
        const ui = ensureChatMemoryModalUi();
        if (!ui || !friend) return;

        const normalizedFriend = window.imApp.normalizeFriendData(friend);
        const memory = normalizedFriend.memory || window.imApp.createDefaultMemory();
        const typeMap = {
            schedule: {
                label: '角色记忆',
                title: '作息时间'
            },
            overview: {
                label: '角色记忆',
                title: '总览',
                subtitle: '记录整体印象、关系概括与近期变化',
                emptyText: '这里还没有记录总览内容。'
            },
            longterm: {
                label: '角色记忆',
                title: '长期记忆',
                subtitle: '记录长期稳定的重要设定、偏好与关系事实',
                emptyText: '这里还没有记录长期记忆内容。'
            },
            cherished: {
                label: '角色记忆',
                title: '珍视回忆',
                subtitle: '收纳那些值得被记住的时刻',
                emptyText: '这里还没有珍视回忆。'
            }
        };

        const currentConfig = typeMap[type] || typeMap.overview;
        ui.labelEl.textContent = currentConfig.label;
        ui.titleEl.textContent = currentConfig.title;
        ui.subtitleEl.textContent = currentConfig.subtitle || '';
        ui.subtitleEl.style.display = currentConfig.subtitle ? 'block' : 'none';

        if (type === 'schedule') {
            ui.contentEl.innerHTML = `
                <div class="chat-memory-modal-text-block">作息时间设置请直接在面板开关调整。</div>
            `;
        } else if (type === 'cherished') {
            const entries = Array.isArray(memory.cherishedEntries) ? memory.cherishedEntries : [];
            if (entries.length > 0) {
                ui.contentEl.innerHTML = `
                    <div class="chat-memory-modal-cherished-list">
                        ${entries.map((entry) => `
                            <button type="button" class="chat-memory-modal-cherished-card" data-entry-id="${entry.id}">
                                <div class="chat-memory-modal-cherished-card-title">${entry.title || '珍视回忆'}</div>
                                <div class="chat-memory-modal-cherished-card-time">${entry.createdAt || '点击查看详情'}</div>
                            </button>
                        `).join('')}
                    </div>
                `;

                const cardButtons = ui.contentEl.querySelectorAll('.chat-memory-modal-cherished-card');
                cardButtons.forEach((btn) => {
                    btn.addEventListener('click', () => {
                        const entryId = btn.getAttribute('data-entry-id') || '';
                        const latestFriend = window.imData.currentSettingsFriend
                            && String(window.imData.currentSettingsFriend.id) === String(normalizedFriend.id)
                            ? window.imData.currentSettingsFriend
                            : normalizedFriend;
                        const latestEntries = Array.isArray(latestFriend.memory?.cherishedEntries)
                            ? latestFriend.memory.cherishedEntries
                            : [];
                        const targetEntry = latestEntries.find((entry) => String(entry.id) === String(entryId));
                        if (targetEntry) {
                            showCherishedMemoryDetail(targetEntry);
                        }
                    });
                });
            } else {
                ui.contentEl.innerHTML = buildTextMemoryModalHtml('珍视回忆', memory.cherished, currentConfig.emptyText);
            }
        } else if (type === 'overview') {
            const messageCount = Array.isArray(normalizedFriend.messages) ? normalizedFriend.messages.length : 0;
            
            // Re-calculate tokenCount realistically
            let tokenCount = 0;
            let systemContextLen = 0;
            
            // 1. WorldBook
            if (window.getGlobalWorldBookContext) {
                const sysWorldBook = window.getGlobalWorldBookContext();
                systemContextLen += (sysWorldBook || '').length;
            }
            
            // 2. Persona and Meta
            systemContextLen += (normalizedFriend.persona || '').length;
            systemContextLen += (userState?.persona || '').length;
            
            // 3. Memories
            systemContextLen += (memory.overview || '').length;
            systemContextLen += (memory.longTerm || '').length;
            systemContextLen += (memory.cherished || '').length;
            systemContextLen += (memory.context?.notes || '').length;
            
            // 4. Relationships
            if (Array.isArray(memory.relationships)) {
                systemContextLen += memory.relationships.reduce((sum, r) => sum + (r.relation || '').length, 0);
            }
            
            // 5. System Prompt Boilerplate (approx. length of static rules)
            systemContextLen += 800; 
            
            // 6. Recent Chat History Context (truncated)
            let recentMessagesLen = 0;
            if (window.imApp.buildApiContextMessages) {
                const contextMsgs = window.imApp.buildApiContextMessages(normalizedFriend);
                if (Array.isArray(contextMsgs)) {
                    recentMessagesLen = contextMsgs.reduce((sum, msg) => sum + (msg.content || '').length, 0);
                }
            }
            
            tokenCount = systemContextLen + recentMessagesLen;
            
            let firstMsgTime = Date.now();
            let lastMsgTime = Date.now();
            if (messageCount > 0) {
                firstMsgTime = normalizedFriend.messages[0].timestamp || Date.now();
                lastMsgTime = normalizedFriend.messages[messageCount - 1].timestamp || Date.now();
            }
            const days = Math.max(1, Math.ceil((Date.now() - firstMsgTime) / (1000 * 60 * 60 * 24)));
            
            const lastTimeStr = window.imApp.formatTime ? window.imApp.formatTime(lastMsgTime) : new Date(lastMsgTime).toLocaleString();

            const statsHtml = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
                    <div style="background: #ffffff; border: 1px solid #ececf2; border-radius: 12px; padding: 10px; text-align: center;">
                        <div style="font-size: 11px; color: #8e8e93; margin-bottom: 4px;">聊天总数</div>
                        <div style="font-size: 16px; font-weight: 700; color: #111;">${messageCount}</div>
                    </div>
                    <div style="background: #ffffff; border: 1px solid #ececf2; border-radius: 12px; padding: 10px; text-align: center;">
                        <div style="font-size: 11px; color: #8e8e93; margin-bottom: 4px;">建联天数</div>
                        <div style="font-size: 16px; font-weight: 700; color: #111;">${days}</div>
                    </div>
                    <div style="background: #ffffff; border: 1px solid #ececf2; border-radius: 12px; padding: 10px; text-align: center;">
                        <div style="font-size: 11px; color: #8e8e93; margin-bottom: 4px;">总Token估算</div>
                        <div style="font-size: 16px; font-weight: 700; color: #111;">${tokenCount}</div>
                    </div>
                    <div style="background: #ffffff; border: 1px solid #ececf2; border-radius: 12px; padding: 10px; text-align: center;">
                        <div style="font-size: 11px; color: #8e8e93; margin-bottom: 4px;">最后聊天</div>
                        <div style="font-size: 13px; font-weight: 700; color: #111; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${messageCount > 0 ? lastTimeStr : '无'}</div>
                    </div>
                </div>
            `;
            ui.contentEl.innerHTML = statsHtml + buildTextMemoryModalHtml('总览', memory.overview, currentConfig.emptyText);
        } else {
            const entries = Array.isArray(memory.longTermEntries) ? memory.longTermEntries : [];
            if (entries.length > 0) {
                ui.contentEl.innerHTML = `
                    <div class="chat-memory-modal-cherished-list">
                        ${entries.map((entry) => `
                            <button type="button" class="chat-memory-modal-cherished-card" data-entry-id="${entry.id}">
                                <div class="chat-memory-modal-cherished-card-title">${entry.title || '长期记忆'}</div>
                                <div class="chat-memory-modal-cherished-card-time">${entry.time || '点击查看详情'}</div>
                            </button>
                        `).join('')}
                    </div>
                `;

                const cardButtons = ui.contentEl.querySelectorAll('.chat-memory-modal-cherished-card');
                cardButtons.forEach((btn) => {
                    btn.addEventListener('click', () => {
                        const entryId = btn.getAttribute('data-entry-id') || '';
                        const latestFriend = window.imData.currentSettingsFriend
                            && String(window.imData.currentSettingsFriend.id) === String(normalizedFriend.id)
                            ? window.imData.currentSettingsFriend
                            : normalizedFriend;
                        const latestEntries = Array.isArray(latestFriend.memory?.longTermEntries)
                            ? latestFriend.memory.longTermEntries
                            : [];
                        const targetEntry = latestEntries.find((entry) => String(entry.id) === String(entryId));
                        if (targetEntry) {
                            showCherishedMemoryDetail({
                                title: targetEntry.title,
                                createdAt: targetEntry.time,
                                content: targetEntry.content
                            });
                        }
                    });
                });
            } else {
                ui.contentEl.innerHTML = buildTextMemoryModalHtml('长期记忆', memory.longTerm, currentConfig.emptyText);
            }
        }

        ui.overlay.style.display = 'flex';
        requestAnimationFrame(() => {
            ui.overlay.classList.add('active');
        });
    }

    function escapeGroupChatMemoryHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getGroupChatMemoryContexts(friend) {
        const memory = window.imApp.normalizeFriendData(friend || {}).memory || {};
        return window.imDataUtils?.normalizeGroupChatContexts
            ? window.imDataUtils.normalizeGroupChatContexts(memory.groupChatContexts)
            : [];
    }

    function getGroupChatMemoryMessages(group, messageLimit = 30) {
        const messages = Array.isArray(group?.messages) ? group.messages : [];
        return window.imDataUtils?.getRecentPublicGroupMessages
            ? window.imDataUtils.getRecentPublicGroupMessages(messages, messageLimit)
            : {
                selectedMessages: messages.filter((message) => (
                    message?.noticeKind !== 'group_private_to_user'
                    && message?.noticeKind !== 'group_friend_private_chat'
                )).slice(-messageLimit)
            };
    }

    async function saveGroupChatMemoryContexts(friend, contexts) {
        if (!friend) return false;
        const candidates = window.imApp.getGroupChatMemoryCandidates
            ? window.imApp.getGroupChatMemoryCandidates(friend)
            : [];
        const candidateIds = new Set(candidates.map(group => String(group.id)));
        const normalizedContexts = (window.imDataUtils?.normalizeGroupChatContexts
            ? window.imDataUtils.normalizeGroupChatContexts(contexts)
            : [])
            .filter(context => candidateIds.has(String(context.groupId)));

        const saved = await commitNamedFriendChange(friend, (targetFriend) => {
            targetFriend.memory = targetFriend.memory || window.imApp.createDefaultMemory();
            targetFriend.memory.groupChatContexts = normalizedContexts;
        }, {
            silent: true,
            metaOnly: false,
            includeMessages: false,
            syncActive: true
        });

        if (saved && window.imData.currentSettingsFriend
            && String(window.imData.currentSettingsFriend.id) === String(friend.id)) {
            const latest = window.imApp.getFriendById(friend.id);
            if (latest) window.imData.currentSettingsFriend = latest;
        }
        return saved;
    }

    function showGroupChatMemoryPicker(friend) {
        const ui = ensureChatMemoryModalUi();
        if (!ui || !friend) return;

        const candidates = window.imApp.getGroupChatMemoryCandidates
            ? window.imApp.getGroupChatMemoryCandidates(friend)
            : [];
        const draftContexts = new Map(getGroupChatMemoryContexts(friend)
            .map(context => [String(context.groupId), { ...context }]));

        ui.labelEl.textContent = '角色记忆';
        ui.titleEl.textContent = '群聊记忆';
        ui.subtitleEl.textContent = '单聊时会读取角色所在群聊最新公开聊天记录。';
        ui.subtitleEl.style.display = 'block';

        const renderPicker = () => {
            if (candidates.length === 0) {
                ui.contentEl.innerHTML = '<div class="chat-memory-modal-empty">该角色暂未加入可读取的群聊</div>';
                return;
            }

            const selectedGroups = candidates.filter(group => draftContexts.has(String(group.id)));
            const availableGroups = candidates.filter(group => !draftContexts.has(String(group.id)));
            ui.contentEl.innerHTML = `
                <div class="chat-memory-modal-plain-note">选择群聊</div>
                <select class="chat-memory-group-picker-select" ${availableGroups.length === 0 ? 'disabled' : ''}>
                    <option value="">${availableGroups.length > 0 ? '选择群聊' : '没有更多可添加的群聊'}</option>
                    ${availableGroups.map((group) => {
                        const groupId = String(group.id);
                        const groupName = group.nickname || group.realName || '未命名群聊';
                        return `<option value="${escapeGroupChatMemoryHtml(groupId)}">${escapeGroupChatMemoryHtml(groupName)}</option>`;
                    }).join('')}
                </select>
                <div class="chat-memory-modal-plain-note">已加入群聊记忆</div>
                <div class="chat-memory-group-picker-list">
                    ${selectedGroups.length > 0 ? selectedGroups.map((group) => {
                        const groupId = String(group.id);
                        const context = draftContexts.get(groupId) || { groupId, messageLimit: 30 };
                        const groupName = group.nickname || group.realName || '未命名群聊';
                        return `
                            <div class="chat-memory-group-context-item" data-selected-group-id="${escapeGroupChatMemoryHtml(groupId)}">
                                <div class="chat-memory-group-context-icon"><i class="fas fa-users"></i></div>
                                <div class="chat-memory-group-context-main">
                                    <div class="chat-memory-group-context-name">${escapeGroupChatMemoryHtml(groupName)}</div>
                                    <div class="chat-memory-group-context-meta">读取最近 ${context.messageLimit} 条公开消息</div>
                                </div>
                                <input class="chat-memory-group-context-limit-input" type="number" min="1" max="999" value="${context.messageLimit}" aria-label="读取消息条数">
                                <button type="button" class="chat-memory-group-context-remove" aria-label="移除群聊记忆" title="移除群聊记忆"><i class="fas fa-trash-alt"></i></button>
                            </div>
                        `;
                    }).join('') : '<div class="chat-memory-modal-empty">暂未加入群聊记忆</div>'}
                </div>
                <button type="button" class="chat-memory-group-picker-save">保存</button>
            `;

            const groupSelect = ui.contentEl.querySelector('.chat-memory-group-picker-select');
            if (groupSelect) {
                groupSelect.addEventListener('change', () => {
                    const groupId = groupSelect.value;
                    if (!groupId) return;
                    groupSelect.disabled = true;
                    const liveGroup = window.imApp.getFriendById(groupId)
                        || candidates.find(group => String(group.id) === String(groupId));
                    if (!liveGroup) {
                        renderPicker();
                        return;
                    }
                    draftContexts.set(groupId, { groupId, messageLimit: 30 });
                    renderPicker();
                });
            }

            ui.contentEl.querySelectorAll('.chat-memory-group-context-limit-input').forEach((input) => {
                const updateMessageLimit = (normalizeValue = false) => {
                    const item = input.closest('[data-selected-group-id]');
                    const groupId = item?.getAttribute('data-selected-group-id') || '';
                    const context = draftContexts.get(groupId);
                    const numericValue = Number(input.value);
                    if (!context) return;
                    if (normalizeValue) {
                        context.messageLimit = window.imDataUtils?.normalizeMessageLimit
                            ? window.imDataUtils.normalizeMessageLimit(numericValue, 30)
                            : Math.min(999, Math.max(1, Math.round(numericValue) || 30));
                    } else if (Number.isFinite(numericValue) && numericValue >= 1) {
                        context.messageLimit = numericValue;
                    } else {
                        return;
                    }
                    if (normalizeValue) input.value = context.messageLimit;

                    const meta = item?.querySelector('.chat-memory-group-context-meta');
                    if (meta) meta.textContent = `读取最近 ${context.messageLimit} 条公开消息`;
                };
                input.addEventListener('input', () => updateMessageLimit(false));
                input.addEventListener('change', () => updateMessageLimit(true));
            });

            ui.contentEl.querySelectorAll('.chat-memory-group-context-remove').forEach((button) => {
                button.addEventListener('click', () => {
                    const item = button.closest('[data-selected-group-id]');
                    draftContexts.delete(item?.getAttribute('data-selected-group-id') || '');
                    renderPicker();
                });
            });

            const saveButton = ui.contentEl.querySelector('.chat-memory-group-picker-save');
            if (saveButton) {
                saveButton.addEventListener('click', async () => {
                    const saved = await saveGroupChatMemoryContexts(friend, Array.from(draftContexts.values()));
                    if (!saved) {
                        if (window.showToast) window.showToast('群聊记忆保存失败');
                        return;
                    }
                    const latestFriend = window.imApp.getFriendById(friend.id) || friend;
                    renderChatMemoryOverviewStats(latestFriend);
                    hideChatMemoryModal();
                });
            }
        };

        renderPicker();
        ui.overlay.style.display = 'flex';
        requestAnimationFrame(() => ui.overlay.classList.add('active'));
    }

    function bindChatMemoryPanelButtons() {
        const panelNames = ['overview', 'longterm', 'cherished'];
        const getCurrentFriend = () => window.imData.currentSettingsFriend || window.imData.currentActiveFriend || null;

        panelNames.forEach((panelName) => {
            const btn = document.getElementById(`chat-memory-${panelName}-btn`);
            if (!btn || btn.dataset.memoryPanelBound === 'true') return;

            btn.dataset.memoryPanelBound = 'true';
            btn.addEventListener('click', () => {
                const currentFriend = getCurrentFriend();
                if (!currentFriend) return;
                showChatMemoryModal(panelName, currentFriend);
            });
        });

        const bindMemoryLocationButton = (id, location) => {
            const btn = document.getElementById(id);
            if (!btn || btn.dataset.memoryPanelBound === 'true') return;
            btn.dataset.memoryPanelBound = 'true';
            btn.addEventListener('click', () => {
                const currentFriend = getCurrentFriend();
                if (!currentFriend) return;
                if (!window.imApp.openMemoryLocationForFriend || !window.imApp.openMemoryLocationForFriend(currentFriend, location)) {
                    if (window.showToast) window.showToast('记忆功能暂不可用');
                }
            });
        };

        bindMemoryLocationButton('chat-memory-shortterm-btn', 'iphone');
        bindMemoryLocationButton('chat-memory-longterm-library-btn', 'downloads');
        bindMemoryLocationButton('chat-memory-x-dm-context-btn', 'x-dm');

        const groupContextBtn = document.getElementById('chat-memory-group-context-btn');
        if (groupContextBtn && groupContextBtn.dataset.memoryPanelBound !== 'true') {
            groupContextBtn.dataset.memoryPanelBound = 'true';
            groupContextBtn.addEventListener('click', () => {
                const currentFriend = getCurrentFriend();
                if (currentFriend) showGroupChatMemoryPicker(currentFriend);
            });
        }

        const scheduleBtn = document.getElementById('chat-memory-schedule-entry-btn');
        if (scheduleBtn && scheduleBtn.dataset.memoryPanelBound !== 'true') {
            scheduleBtn.dataset.memoryPanelBound = 'true';
            scheduleBtn.addEventListener('click', () => {
                const currentFriend = getCurrentFriend();
                if (!currentFriend) return;
                if (!window.imApp.openMemoryScheduleForFriend || !window.imApp.openMemoryScheduleForFriend(currentFriend)) {
                    if (window.showToast) window.showToast('日程作息暂不可用');
                }
            });
        }
    }

    function initChatSettingsInteractions() {
        const segmentTabs = document.querySelectorAll('#chat-settings-segment .char-settings-tab');

        segmentTabs.forEach(tab => {
            if (tab.dataset.bound === 'true') return;
            tab.dataset.bound = 'true';
            tab.addEventListener('click', () => {
                setActiveChatSettingsTab(tab.getAttribute('data-tab'));
            });
        });

        ensureChatMemoryModalUi();
        bindChatMemoryPanelButtons();
    }

    if (editCharPersonaSheet) {
        editCharPersonaSheet.addEventListener('click', (e) => {
            if (e.target === editCharPersonaSheet) {
                closeView(editCharPersonaSheet);
            }
        });
    }

    if (relationshipSheet) {
        relationshipSheet.addEventListener('click', (e) => {
            if (e.target === relationshipSheet) {
                closeView(relationshipSheet);
            }
        });
    }

    if (relationshipBtn) {
        relationshipBtn.addEventListener('click', () => {
            if (!window.imData.currentSettingsFriend) return;
            isRelationshipPickerVisible = false;
            relationshipPickerType = 'all';
            tempRelationshipDrafts = (window.imData.currentSettingsFriend.memory?.relationships || []).map(rel => ({
                npcId: getRelationshipTargetId(rel),
                targetType: rel.targetType || getRelationshipTarget(rel)?.type,
                relation: rel.relation || '',
                offsetX: rel.offsetX,
                offsetY: rel.offsetY
            }));
            renderRelationshipSheet(window.imData.currentSettingsFriend);
            openView(relationshipSheet);
        });
    }

    if (confirmRelationshipBtn) {
        confirmRelationshipBtn.addEventListener('click', async () => {
            if (!window.imData.currentSettingsFriend || !relationshipList) return;

            collectRelationshipDrafts();
            const normalizedRelations = tempRelationshipDrafts
                .map(item => ({
                    // Keep npcId for compatibility with existing prompt and export readers.
                    npcId: getRelationshipTargetId(item),
                    targetType: item.targetType || getRelationshipTarget(item)?.type || 'npc',
                    relation: (item.relation || '').trim(),
                    offsetX: item.offsetX,
                    offsetY: item.offsetY
                }))
                .filter(item => item.npcId && item.relation && !!getRelationshipTarget(item.npcId));

            const saved = await commitSettingsFriendChange((targetFriend) => {
                targetFriend.memory = targetFriend.memory || window.imApp.createDefaultMemory();
                targetFriend.memory.relationships = normalizedRelations;
            }, { silent: true });

            if (!saved) {
                showToast('关系网保存失败');
                return;
            }

            tempRelationshipDrafts = (window.imData.currentSettingsFriend.memory.relationships || []).map(rel => ({
                npcId: getRelationshipTargetId(rel),
                targetType: rel.targetType || getRelationshipTarget(rel)?.type,
                relation: rel.relation || '',
                offsetX: rel.offsetX,
                offsetY: rel.offsetY
            }));
            isRelationshipPickerVisible = false;
            showToast(normalizedRelations.length > 0 ? '关系网已保存' : '未填写关系，已清空关系网');
            closeView(relationshipSheet);
        });
    }

    if (relationshipAddNpcBtn) {
        relationshipAddNpcBtn.addEventListener('click', () => {
            if (!window.imData.currentSettingsFriend) return;
            collectRelationshipDrafts();

            const allPeople = (window.imData.friends || []).filter(item =>
                (item.type === 'char' || item.type === 'npc')
                && String(item.id) !== String(window.imData.currentSettingsFriend.id)
            );
            const selectedTargetIds = new Set(tempRelationshipDrafts.map(getRelationshipTargetId));
            const availablePeople = allPeople.filter(person => !selectedTargetIds.has(String(person.id)));

            if (allPeople.length === 0) {
                showToast('暂无可添加的人物，请先创建 Char 或 NPC');
                return;
            }

            if (availablePeople.length === 0) {
                showToast('已有 Char 和 NPC 均已添加');
                return;
            }

            isRelationshipPickerVisible = !isRelationshipPickerVisible;
            renderRelationshipSheet(window.imData.currentSettingsFriend);
        });
    }

    if (relationshipPickerFilters) {
        relationshipPickerFilters.addEventListener('click', (event) => {
            const button = event.target.closest('.relationship-filter-btn');
            if (!button || !window.imData.currentSettingsFriend) return;
            relationshipPickerType = button.dataset.type || 'all';
            renderRelationshipPicker(window.imData.currentSettingsFriend);
        });
    }

    if (chatSettingsSheet) {
        chatSettingsSheet.addEventListener('click', (e) => {
            if (e.target === chatSettingsSheet) {
                closeView(chatSettingsSheet);
            }
        });
    }

    if (npcChatSettingsSheet) {
        npcChatSettingsSheet.addEventListener('click', (e) => {
            if (e.target === npcChatSettingsSheet) {
                closeView(npcChatSettingsSheet);
            }
        });
    }

    function initNpcChatSettingsInteractions() {
        const profileTrigger = document.getElementById('npc-chat-settings-profile-trigger');
        const bgUpload = document.getElementById('npc-chat-bg-upload');
        const bgUploadIcon = document.getElementById('npc-chat-bg-upload-icon');
        const bgResetIcon = document.getElementById('npc-chat-bg-reset-icon');
        const tsToggle = document.getElementById('npc-timestamp-toggle');
        const pinToggle = document.getElementById('npc-chat-pinned-toggle');
        const avatarToggle = document.getElementById('npc-chat-avatar-toggle');
        const clearHistoryBtn = document.getElementById('npc-clear-history-btn');
        const deleteNpcBtn = document.getElementById('npc-delete-friend-btn');

        if (profileTrigger && profileTrigger.dataset.bound !== 'true') {
            profileTrigger.dataset.bound = 'true';
            profileTrigger.addEventListener('click', () => {
                if (!window.imData.currentSettingsFriend) return;
                const sharedProfileTrigger = document.getElementById('chat-settings-profile-trigger');
                if (sharedProfileTrigger) sharedProfileTrigger.click();
            });
        }

        if (bgUploadIcon && bgUpload && bgUploadIcon.dataset.bound !== 'true') {
            bgUploadIcon.dataset.bound = 'true';
            bgUploadIcon.addEventListener('click', () => {
                bgUpload.click();
            });
        }

        if (bgUpload && bgUpload.dataset.bound !== 'true') {
            bgUpload.dataset.bound = 'true';
            bgUpload.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                const friend = window.imData.currentSettingsFriend;
                if (!file || !friend) {
                    e.target.value = '';
                    return;
                }

                try {
                    const result = await saveChatBackgroundUpload(file, friend);
                    if (result.status === 'failed') {
                        showToast('聊天背景保存失败');
                        return;
                    }
                    if (result.status === 'saved') showToast('已更换聊天背景');
                } catch (error) {
                    console.error('Failed to process NPC chat background image', error);
                    showToast('聊天背景处理失败');
                } finally {
                    e.target.value = '';
                }
            });
        }

        if (bgResetIcon && bgResetIcon.dataset.bound !== 'true') {
            bgResetIcon.dataset.bound = 'true';
            bgResetIcon.addEventListener('click', async () => {
                const friend = window.imData.currentSettingsFriend;
                if (!friend) return;
                const result = await resetChatBackground(friend);
                if (result.status === 'failed') {
                    showToast('聊天背景重置失败');
                    return;
                }
                if (result.status === 'reset') showToast('已重置聊天背景');
            });
        }

        if (avatarToggle && avatarToggle.dataset.bound !== 'true') {
            avatarToggle.dataset.bound = 'true';
            avatarToggle.addEventListener('change', async (e) => {
                const friend = window.imData.currentSettingsFriend;
                if (!friend) return;

                const previousValue = !!friend.showAvatar;
                const nextValue = e.target.checked;
                const saved = await commitSettingsFriendChange((targetFriend) => {
                    targetFriend.showAvatar = nextValue;
                }, { silent: true });

                if (!saved) {
                    e.target.checked = previousValue;
                    showToast('头像设置保存失败');
                    return;
                }

                if (window.imChat && window.imChat.rerenderChatContainer) {
                    const page = document.getElementById(`chat-interface-${friend.id}`);
                    if (page) {
                        const msgContainer = page.querySelector('.ins-chat-messages');
                        if (msgContainer) window.imChat.rerenderChatContainer(friend, msgContainer, { scroll: false });
                    }
                }
            });
        }

        if (tsToggle && tsToggle.dataset.bound !== 'true') {
            tsToggle.dataset.bound = 'true';
            tsToggle.addEventListener('change', async (e) => {
                const friend = window.imData.currentSettingsFriend;
                if (!friend) return;

                const previousValue = !!friend.showTimestamp;
                const nextValue = e.target.checked;
                const saved = await commitSettingsFriendChange((targetFriend) => {
                    targetFriend.showTimestamp = nextValue;
                }, { silent: true });

                if (!saved) {
                    e.target.checked = previousValue;
                    showToast('时间戳设置保存失败');
                    return;
                }

                updateCurrentSettingsChatPageState(window.imData.currentSettingsFriend);
            });
        }

        if (pinToggle && pinToggle.dataset.bound !== 'true') {
            pinToggle.dataset.bound = 'true';
            pinToggle.addEventListener('change', async (e) => {
                const friend = window.imData.currentSettingsFriend;
                if (!friend) return;

                const previousValue = !!friend.isPinned;
                const nextValue = e.target.checked;
                const saved = await commitSettingsFriendChange((targetFriend) => {
                    targetFriend.isPinned = nextValue;
                }, { silent: true });

                if (!saved) {
                    e.target.checked = previousValue;
                    showToast('置顶设置保存失败');
                    return;
                }

                if (window.imApp.renderChatsList) window.imApp.renderChatsList();
                updateCurrentSettingsChatPageState(window.imData.currentSettingsFriend);
                showToast(window.imData.currentSettingsFriend.isPinned ? '已置顶' : '已取消置顶');
            });
        }

        if (clearHistoryBtn && clearHistoryBtn.dataset.bound !== 'true') {
            clearHistoryBtn.dataset.bound = 'true';
            clearHistoryBtn.addEventListener('click', () => {
                const friend = window.imData.currentSettingsFriend;
                if (!friend) return;

                showCustomModal({
                    title: '清空聊天记录',
                    message: '确定清空这个 NPC 的聊天记录、上下文、全部记忆和状态栏吗？此操作不可恢复。',
                    isDestructive: true,
                    confirmText: '清空',
                    onConfirm: async () => {
                        const friendId = friend.id;
                        const saved = window.imApp.resetFriendConversation
                            ? await window.imApp.resetFriendConversation(friendId, { silent: true })
                            : await commitSettingsFriendChange((targetFriend) => {
                                targetFriend.messages = [];
                            }, { silent: true, metaOnly: false, includeMessages: true });

                        if (!saved) {
                            showToast('清空聊天记录失败');
                            return;
                        }

                        const page = document.getElementById(`chat-interface-${friendId}`);
                        if (page) {
                            const msgContainer = page.querySelector('.ins-chat-messages');
                            const latestFriend = window.imApp.getFriendById ? window.imApp.getFriendById(friendId) : window.imData.currentSettingsFriend;
                            if (msgContainer && latestFriend && window.imChat.rerenderChatContainer) {
                                window.imChat.rerenderChatContainer(latestFriend, msgContainer, { scroll: false });
                            } else if (msgContainer) {
                                msgContainer.innerHTML = '';
                            }
                        }

                        if (window.imApp.renderChatsList) window.imApp.renderChatsList();
                        showToast('已清空聊天记录');
                        closeView(npcChatSettingsSheet);
                    }
                });
            });
        }

        if (deleteNpcBtn && deleteNpcBtn.dataset.bound !== 'true') {
            deleteNpcBtn.dataset.bound = 'true';
            deleteNpcBtn.addEventListener('click', () => {
                const friend = window.imData.currentSettingsFriend;
                if (!friend) return;

                showCustomModal({
                    title: '删除 NPC',
                    message: `确定删除 NPC ${friend.nickname} 吗？此操作不可恢复。`,
                    isDestructive: true,
                    confirmText: '删除',
                    onConfirm: async () => {
                        const deletingFriendId = friend.id;
                        const saved = window.imApp.commitFriendsChange
                            ? await window.imApp.commitFriendsChange(() => {
                                window.imData.friends = (window.imData.friends || []).filter(
                                    f => String(f.id) !== String(deletingFriendId)
                                );
                            }, {
                                silent: true,
                                friendIds: [],
                                deletedFriendIds: [deletingFriendId]
                            })
                            : false;

                        if (!saved) {
                            showToast('删除 NPC 失败');
                            return;
                        }

                        if (window.imData.currentSettingsFriend && String(window.imData.currentSettingsFriend.id) === String(deletingFriendId)) {
                            window.imData.currentSettingsFriend = null;
                        }
                        if (window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(deletingFriendId)) {
                            window.imData.currentActiveFriend = null;
                        }

                        if (window.imApp.renderFriendsList) window.imApp.renderFriendsList();
                        if (window.imApp.updateChatsView) window.imApp.updateChatsView();

                        const page = document.getElementById(`chat-interface-${deletingFriendId}`);
                        if (page) page.remove();

                        closeView(npcChatSettingsSheet);
                        showToast('已删除 NPC');
                    }
                });
            });
        }
    }

    const staticChatMenuBtn = document.querySelector('#active-chat-interface .chat-menu-btn');
    if (staticChatMenuBtn) {
        staticChatMenuBtn.addEventListener('click', () => {
            if (window.imData.currentActiveFriend) {
                openChatSettingsForFriend(window.imData.currentActiveFriend);
            }
        });
    }

    if (bindWorldBookSheet) {
        bindWorldBookSheet.addEventListener('click', (e) => {
            if (e.target === bindWorldBookSheet) {
                closeView(bindWorldBookSheet);
            }
        });
    }

    if (bindAccountSheet) {
        bindAccountSheet.addEventListener('click', (e) => {
            if (e.target === bindAccountSheet) {
                closeView(bindAccountSheet);
            }
        });
    }

    if (statusPromptSheet) {
        statusPromptSheet.addEventListener('click', (e) => {
            if (e.target === statusPromptSheet) closeView(statusPromptSheet);
        });
    }

    if (chatCotSettingsSheet) {
        chatCotSettingsSheet.addEventListener('click', (e) => {
            if (e.target === chatCotSettingsSheet) closeView(chatCotSettingsSheet);
        });
    }

    if (chatCotSettingsBtn) {
        chatCotSettingsBtn.addEventListener('click', () => {
            const friend = window.imData.currentSettingsFriend;
            if (!friend || friend.type === 'group') return;
            renderChatCotSettings(friend);
            openView(chatCotSettingsSheet);
        });
    }

    if (resetChatCotPromptBtn) {
        resetChatCotPromptBtn.addEventListener('click', () => {
            if (chatCotPromptInput) chatCotPromptInput.value = DEFAULT_SINGLE_CHAT_COT_PROMPT;
        });
    }

    if (saveChatCotSettingsBtn) {
        saveChatCotSettingsBtn.addEventListener('click', async () => {
            const friend = window.imData.currentSettingsFriend;
            if (!friend || friend.type === 'group') return;
            const nextEnabled = chatCotEnabledToggle?.checked !== false;
            const nextPrompt = String(chatCotPromptInput?.value || '').trim().slice(0, 4000);
            saveChatCotSettingsBtn.disabled = true;

            const saved = await commitSettingsFriendChange((targetFriend) => {
                targetFriend.cotEnabled = nextEnabled;
                targetFriend.cotDefaultVersion = 2;
                targetFriend.cotPrompt = nextPrompt === DEFAULT_SINGLE_CHAT_COT_PROMPT ? '' : nextPrompt;
            }, { silent: true });

            saveChatCotSettingsBtn.disabled = false;
            if (!saved) {
                renderChatCotSettings(window.imData.currentSettingsFriend);
                showToast('COT 设置保存失败');
                return;
            }

            renderChatCotSettings(window.imData.currentSettingsFriend);
            showToast('COT 设置已保存');
            closeView(chatCotSettingsSheet);
        });
    }

    if (statusPromptBtn) {
        statusPromptBtn.addEventListener('click', () => {
            const friend = window.imData.currentSettingsFriend;
            if (!friend) return;
            void persistProfileStatusMigration(friend);
            renderStatusPromptSettings(friend);
            openView(statusPromptSheet);
        });
    }

    if (statusPromptEnabledToggle) {
        statusPromptEnabledToggle.addEventListener('change', () => {
            if (statusPromptInput) statusPromptInput.disabled = !statusPromptEnabledToggle.checked;
        });
    }

    if (saveStatusPromptBtn) {
        saveStatusPromptBtn.addEventListener('click', async () => {
            const friend = window.imData.currentSettingsFriend;
            if (!friend) return;
            const nextEnabled = statusPromptEnabledToggle?.checked === true;
            const nextPrompt = String(statusPromptInput?.value || '').trim();
            if (nextEnabled && !nextPrompt) {
                showToast('自定义提示词不能为空');
                statusPromptInput?.focus();
                return;
            }
            saveStatusPromptBtn.disabled = true;

            const saved = await commitSettingsFriendChange((targetFriend) => {
                targetFriend.statusPromptEnabled = nextEnabled;
                targetFriend.statusPrompt = nextPrompt;
                if (window.imApp.migrateSingleChatProfileStatus) {
                    window.imApp.migrateSingleChatProfileStatus(targetFriend);
                }
                delete targetFriend._profileStatusNeedsPersistence;
            }, { silent: true });

            saveStatusPromptBtn.disabled = false;
            if (!saved) {
                renderStatusPromptSettings(window.imData.currentSettingsFriend);
                showToast('状态栏设置保存失败');
                return;
            }

            showToast('状态栏设置已保存');
            closeView(statusPromptSheet);
        });
    }

    if (bindAccountDetailSheet) {
        bindAccountDetailSheet.addEventListener('click', (e) => {
            if (e.target === bindAccountDetailSheet) {
                closeView(bindAccountDetailSheet);
            }
        });
    }

    if (chatBindIdBtn) {
        chatBindIdBtn.addEventListener('click', () => {
            if (!window.imData.currentSettingsFriend) return;
            openBindAccountDetailSheet(window.imData.currentSettingsFriend);
        });
    }

    if (bindAccountDetailSelect) {
        bindAccountDetailSelect.addEventListener('change', async (e) => {
            const previousValue = window.imData.currentSettingsFriend?.boundAccountId || 'none';
            const nextValue = e.target.value || 'none';
            const saved = await saveBindAccountSelection(nextValue);

            if (!saved) {
                e.target.value = previousValue || 'none';
                renderBindAccountDetailForm(window.imData.currentSettingsFriend);
                return;
            }

            renderBindAccountDetailForm(window.imData.currentSettingsFriend);
            showToast(nextValue !== 'none' ? '角色绑定ID已更新' : '已取消绑定ID');
        });
    }

    if (bindAccountDetailAvatarBtn && bindAccountDetailAvatarUpload) {
        bindAccountDetailAvatarBtn.addEventListener('click', () => {
            if (bindAccountDetailSelect && bindAccountDetailSelect.value !== 'none') {
                bindAccountDetailAvatarUpload.click();
            }
        });

        bindAccountDetailAvatarUpload.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            try {
                if (typeof window.readImageAsCompressedDataUrl !== 'function') {
                    showToast('头像上传组件不可用');
                    return;
                }

                const url = await window.readImageAsCompressedDataUrl(file, {
                    maxWidth: 256,
                    maxHeight: 256,
                    quality: 0.72
                });
                setBindAccountDetailAvatar(url);
            } catch (error) {
                console.error('Failed to process bound account avatar', error);
                showToast('头像处理失败');
            } finally {
                e.target.value = '';
            }
        });
    }

    if (bindAccountDetailSaveBtn) {
        bindAccountDetailSaveBtn.addEventListener('click', () => {
            const accountId = bindAccountDetailSelect ? bindAccountDetailSelect.value : 'none';
            if (!accountId || accountId === 'none') {
                showToast('请先选择要绑定的 ID');
                return;
            }

            if (typeof window.updateAccountById !== 'function') {
                showToast('账号保存组件不可用');
                return;
            }

            const saved = window.updateAccountById(accountId, {
                name: (bindAccountDetailNameInput?.value || '').trim() || '未命名ID',
                phone: (bindAccountDetailPhoneInput?.value || '').trim(),
                signature: (bindAccountDetailSignatureInput?.value || '').trim(),
                persona: (bindAccountDetailPersonaInput?.value || '').trim(),
                avatarUrl: bindAccountDetailAvatarUrl || null
            });

            if (!saved) {
                showToast('ID资料保存失败');
                return;
            }

            updateChatBindIdLabel(window.imData.currentSettingsFriend);
            renderBindAccountDetailSelect(window.imData.currentSettingsFriend);
            if (bindAccountDetailSelect) bindAccountDetailSelect.value = String(accountId);
            renderBindAccountDetailForm(window.imData.currentSettingsFriend);
            if (window.updateBindRoleEntryPoints) window.updateBindRoleEntryPoints();
            if (window.imApp.renderFriendsList) window.imApp.renderFriendsList();
            if (window.imApp.renderChatsList) window.imApp.renderChatsList();
            if (window.imApp.updateChatsView) window.imApp.updateChatsView();
            refreshChatPagesBoundToAccount(accountId);
            showToast('ID资料已同步');
        });
    }


    if (worldBookBtn) {
        worldBookBtn.addEventListener('click', () => {
            if (!window.imData.currentSettingsFriend) return;
            if (typeof window.renderWorldBookSelector !== 'function') {
                showToast('世界书选择器不可用');
                return;
            }

            const selectedIds = Array.isArray(window.imData.currentSettingsFriend.boundBooks)
                ? window.imData.currentSettingsFriend.boundBooks
                : [];

            window.renderWorldBookSelector(selectedIds, async (nextIds) => {
                const saved = await commitSettingsFriendChange((targetFriend) => {
                    targetFriend.boundBooks = Array.isArray(nextIds)
                        ? nextIds.filter(Boolean).map(id => String(id))
                        : [];
                }, { silent: true });

                if (!saved) {
                    showToast('世界书绑定保存失败');
                    return;
                }

                if (window.invalidateWorldBookLocalBindings) window.invalidateWorldBookLocalBindings();
                if (window.renderWorldBooks) window.renderWorldBooks();
                showToast('世界书绑定已更新');
            });
        });
    }

    if (confirmBindWorldBookBtn) {
        confirmBindWorldBookBtn.addEventListener('click', async () => {
            if (window.imData.currentSettingsFriend) {
                const saved = await commitSettingsFriendChange((targetFriend) => {
                    targetFriend.boundBooks = [...tempSelectedBookIds];
                }, { silent: true });

                if (!saved) {
                    showToast('世界书绑定保存失败');
                    return;
                }

                if (window.invalidateWorldBookLocalBindings) window.invalidateWorldBookLocalBindings();
                if (window.renderWorldBooks) window.renderWorldBooks();
                showToast('世界书绑定已更新');
            }
            closeView(bindWorldBookSheet);
        });
    }

    if (confirmBindAccountBtn) {
        confirmBindAccountBtn.addEventListener('click', async () => {
            const friend = window.imData.currentSettingsFriend;
            if (!friend) return;

            const nextBoundAccountId = tempSelectedAccountId || null;
            const saved = await commitSettingsFriendChange((targetFriend) => {
                targetFriend.boundAccountId = nextBoundAccountId;
            }, { silent: true });

            if (!saved) {
                showToast('角色绑定ID保存失败');
                return;
            }

            updateChatBindIdLabel(window.imData.currentSettingsFriend);
            if (window.updateBindRoleEntryPoints) window.updateBindRoleEntryPoints();
            refreshChatPageForFriend(window.imData.currentSettingsFriend);
            showToast(window.imData.currentSettingsFriend.boundAccountId ? '角色绑定ID已更新' : '已取消绑定ID');
            closeView(bindAccountSheet);
        });
    }

    function renderBindWorldBookList() {
        if (!bindWorldBookList) return;
        bindWorldBookList.innerHTML = '';
        
        let allBooks = window.getWorldBooks ? window.getWorldBooks() : [];
        
        // 过滤掉已启用全局的世界书
        const selectableBooks = allBooks.filter(book => !book.isGlobal);
        
        if (allBooks.length === 0) {
            bindWorldBookList.innerHTML = '<div style="text-align: center; color: #8e8e93; padding: 20px;">暂无世界书，请先在主界面创建</div>';
            return;
        } else if (selectableBooks.length === 0) {
            bindWorldBookList.innerHTML = '<div style="text-align: center; color: #8e8e93; padding: 20px;">所有世界书都已启用全局，无需在此单独绑定</div>';
            return;
        }

        selectableBooks.forEach(book => {
            const isSelected = tempSelectedBookIds.includes(book.id);
            const tokens = window.calculateTokens ? window.calculateTokens(book.entries) : 0;
            
            const item = document.createElement('div');
            item.className = 'account-card';
            item.style.padding = '12px 16px';
            item.style.height = 'auto';
            item.style.cursor = 'pointer';
            item.style.borderRadius = '16px';
            item.style.border = isSelected ? '2px solid var(--blue-color)' : '2px solid transparent';
            item.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
            item.style.position = 'relative';
            
            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 36px; height: 36px; background-color: #1c1c1e; border-radius: 10px; display: flex; justify-content: center; align-items: center; color: #fff; font-size: 16px;">
                            <i class="fas fa-book"></i>
                        </div>
                        <div>
                            <div style="font-size: 16px; font-weight: 500; color: #000;">${book.name}</div>
                            <div style="font-size: 12px; color: #8e8e93; margin-top: 2px;">分组: ${book.group}</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 13px; color: #8e8e93;">+${tokens} Tokens</span>
                        <div style="width: 22px; height: 22px; border-radius: 50%; border: 1px solid ${isSelected ? 'var(--blue-color)' : '#c7c7cc'}; background-color: ${isSelected ? 'var(--blue-color)' : 'transparent'}; display: flex; justify-content: center; align-items: center; color: #fff; font-size: 12px;">
                            ${isSelected ? '<i class="fas fa-check"></i>' : ''}
                        </div>
                    </div>
                </div>
            `;
            
            const styleFix = document.createElement('style');
            styleFix.innerHTML = `#bind-world-book-list .account-card::after { display: none !important; }`;
            item.appendChild(styleFix);

            item.addEventListener('click', () => {
                if (tempSelectedBookIds.includes(book.id)) {
                    tempSelectedBookIds = tempSelectedBookIds.filter(id => id !== book.id);
                } else {
                    tempSelectedBookIds.push(book.id);
                }
                renderBindWorldBookList();
            });
            
            bindWorldBookList.appendChild(item);
        });
    }

    const deleteFriendBtn = document.getElementById('delete-friend-btn');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const resetCssBtn = document.getElementById('reset-css-btn');
    
    const chatBgUpload = document.getElementById('chat-bg-upload');
    const chatBgUploadIcon = document.getElementById('chat-bg-upload-icon');
    const chatBgSaveIcon = document.getElementById('chat-bg-save-icon');
    const chatBgResetIcon = document.getElementById('chat-bg-reset-icon');

    if (chatBgUploadIcon && chatBgUpload) {
        chatBgUploadIcon.addEventListener('click', () => {
            chatBgUpload.click();
        });

        chatBgUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            const friend = window.imData.currentSettingsFriend;
            if (file && friend) {
                try {
                    const result = await saveChatBackgroundUpload(file, friend);
                    if (result.status === 'failed') {
                        showToast('聊天背景保存失败');
                        return;
                    }
                    if (result.status === 'saved') showToast('已更换聊天背景');
                } catch (error) {
                    console.error('Failed to process chat background image', error);
                    showToast('聊天背景处理失败');
                }
            }
            e.target.value = ''; 
        });
    }

    if (chatBgResetIcon) {
        chatBgResetIcon.addEventListener('click', async () => {
            const friend = window.imData.currentSettingsFriend;
            if (!friend) return;
            const result = await resetChatBackground(friend);
            if (result.status === 'failed') {
                showToast('聊天背景重置失败');
                return;
            }
            if (result.status === 'reset') showToast('已重置聊天背景');
        });
    }

    function applyFriendBg(friend) {
        if (!friend) return;
        const page = document.getElementById(`chat-interface-${friend.id}`);
        if (page) {
            const stickyContainer = page.querySelector('.chat-sticky-container');

            page.style.removeProperty('background-image');
            page.style.removeProperty('background-color');
            page.style.removeProperty('background-size');
            page.style.removeProperty('background-position');
            if (stickyContainer) {
                stickyContainer.style.removeProperty('background');
                stickyContainer.style.removeProperty('border-bottom');
            }

            if (friend.chatBg) {
                const escapedBg = String(friend.chatBg).replace(/["\\]/g, '\\$&');
                page.classList.add('has-chat-bg');
                page.style.setProperty('--im-chat-bg-image', `url("${escapedBg}")`);
            } else {
                page.classList.remove('has-chat-bg');
                page.style.removeProperty('--im-chat-bg-image');
            }
        }
    }


    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            if (window.imData.currentSettingsFriend) {
                showCustomModal({
                    title: '清空聊天记录',
                    message: '确定清空聊天记录、上下文、全部记忆和状态栏吗？此操作不可恢复。',
                    isDestructive: true,
                    confirmText: '清空',
                    onConfirm: async () => {
                        const friendId = window.imData.currentSettingsFriend.id;
                        const saved = window.imApp.resetFriendConversation
                            ? await window.imApp.resetFriendConversation(friendId, { silent: true })
                            : await commitSettingsFriendChange((targetFriend) => {
                                targetFriend.messages = [];
                                if (window.imApp.syncActiveFriendReference) {
                                    window.imApp.syncActiveFriendReference(targetFriend);
                                }
                                if (window.imApp.syncSettingsFriendReference) {
                                    window.imApp.syncSettingsFriendReference(targetFriend);
                                }
                            }, { silent: true, metaOnly: false, includeMessages: true });

                        if (!saved) {
                            showToast('清空聊天记录失败');
                            const failedPage = document.getElementById(`chat-interface-${friendId}`);
                            if (failedPage) {
                                const failedContainer = failedPage.querySelector('.ins-chat-messages');
                                if (failedContainer) {
                                    failedContainer.innerHTML = '';
                                    window.imChat.renderChatHistory(window.imData.currentSettingsFriend, failedContainer);
                                }
                            }
                            return;
                        }
                        
                        const page = document.getElementById(`chat-interface-${friendId}`);
                        if (page) {
                            const msgContainer = page.querySelector('.ins-chat-messages');
                            const latestFriend = window.imApp.getFriendById ? window.imApp.getFriendById(friendId) : window.imData.currentSettingsFriend;
                            if (msgContainer && latestFriend && window.imChat.rerenderChatContainer) {
                                window.imChat.rerenderChatContainer(latestFriend, msgContainer, { scroll: false });
                            } else if (msgContainer) {
                                msgContainer.innerHTML = '';
                            }
                        }
                        
                        showToast('已清空聊天记录');
                        closeView(chatSettingsSheet);
                        if(window.imApp.renderChatsList) window.imApp.renderChatsList();
                    }
                });
            }
        });
    }

    if (deleteFriendBtn) {
        deleteFriendBtn.addEventListener('click', () => {
            if (window.imData.currentSettingsFriend) {
                showCustomModal({
                    title: '删除好友',
                    message: `确定删除好友 ${window.imData.currentSettingsFriend.nickname} 吗？此操作不可恢复。`,
                    isDestructive: true,
                    confirmText: '删除',
                    onConfirm: async () => {
                        const deletingFriend = window.imData.currentSettingsFriend;
                        const deletingFriendId = deletingFriend.id;

                        const saved = window.imApp.commitFriendsChange
                            ? await window.imApp.commitFriendsChange(() => {
                                window.imData.friends = (window.imData.friends || []).filter(
                                    f => String(f.id) !== String(deletingFriendId)
                                );
                            }, {
                                silent: true,
                                friendIds: [],
                                deletedFriendIds: [deletingFriendId]
                            })
                            : (window.imApp.flushFriendSave
                                ? await window.imApp.flushFriendSave(deletingFriendId, { silent: true })
                                : false);

                        if (!saved) {
                            showToast('删除好友失败');
                            return;
                        }

                        if (window.imData.currentSettingsFriend && String(window.imData.currentSettingsFriend.id) === String(deletingFriendId)) {
                            window.imData.currentSettingsFriend = null;
                        }
                        if (window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(deletingFriendId)) {
                            window.imData.currentActiveFriend = null;
                        }

                        if(window.imApp.renderFriendsList) window.imApp.renderFriendsList();
                        closeView(chatSettingsSheet);

                        if(window.imApp.updateChatsView) window.imApp.updateChatsView();

                        const page = document.getElementById(`chat-interface-${deletingFriendId}`);
                        if (page) page.remove();

                        showToast('已删除好友');
                    }
                });
            }
        });
    }

    const chatSettingsMomentsBtn = document.getElementById('chat-settings-moments-btn');
    if (chatSettingsMomentsBtn) {
        chatSettingsMomentsBtn.addEventListener('click', () => {
            if (!window.imData.currentSettingsFriend) return;
            if (chatSettingsSheet) closeView(chatSettingsSheet);
            if(window.imApp.openUserMoments) window.imApp.openUserMoments(window.imData.currentSettingsFriend.id);
        });
    }

    const chatSettingsProfileTrigger = document.getElementById('chat-settings-profile-trigger');
    if (chatSettingsProfileTrigger) {
        chatSettingsProfileTrigger.addEventListener('click', () => {
            if (!window.imData.currentSettingsFriend) return;
            const friend = window.imData.currentSettingsFriend;
            const editSheet = document.getElementById('edit-char-persona-sheet');
            if (!editSheet) return;

            const realNameInput = document.getElementById('char-realname-input');
            const nicknameInput = document.getElementById('char-nickname-input');
            const signatureInput = document.getElementById('char-signature-input');
            const relationshipInput = document.getElementById('char-relationship-input');
            const personaInput = document.getElementById('char-persona-input');
            const avatarPreview = document.getElementById('char-edit-avatar-img');
            const avatarIcon = document.getElementById('char-edit-avatar-preview');
            let avatarI = null;
            if(avatarIcon) avatarI = avatarIcon.querySelector('i');
            
            let tempAvatarUrl = friend.avatarUrl;

            friend.memory = window.imApp.normalizeFriendData(friend).memory;

            if(realNameInput) realNameInput.value = friend.realName || '';
            if(nicknameInput) nicknameInput.value = friend.nickname || '';
            if(signatureInput) signatureInput.value = friend.signature || '';
            if(relationshipInput) relationshipInput.value = friend.relationship || '';
            if(personaInput) personaInput.value = friend.persona || '';
            
            if (friend.avatarUrl) {
                if(avatarPreview) { avatarPreview.src = friend.avatarUrl; avatarPreview.style.display = 'block'; }
                if(avatarI) avatarI.style.display = 'none';
            } else {
                if(avatarPreview) { avatarPreview.style.display = 'none'; avatarPreview.src = ''; }
                if(avatarI) avatarI.style.display = 'block';
            }

            const avatarWrapper = document.getElementById('char-edit-avatar-wrapper');
            const avatarUpload = document.getElementById('char-edit-avatar-upload');
            
            if (avatarWrapper && avatarUpload) {
                const newAvatarWrapper = avatarWrapper.cloneNode(true);
                avatarWrapper.parentNode.replaceChild(newAvatarWrapper, avatarWrapper);
                
                const newAvatarUpload = avatarUpload.cloneNode(true);
                avatarUpload.parentNode.replaceChild(newAvatarUpload, avatarUpload);

                newAvatarWrapper.addEventListener('click', (e) => {
                    if (e.target.tagName !== 'INPUT') newAvatarUpload.click();
                });

                newAvatarUpload.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        try {
                            tempAvatarUrl = window.imApp.compressImageFile
                                ? await window.imApp.compressImageFile(file, {
                                    maxWidth: 256,
                                    maxHeight: 256,
                                    mimeType: 'image/jpeg',
                                    quality: 0.8
                                })
                                : await window.imApp.readFileAsDataUrl(file);

                            const img = document.getElementById('char-edit-avatar-img');
                            const iconPreview = document.getElementById('char-edit-avatar-preview');
                            let iconI = null;
                            if(iconPreview) iconI = iconPreview.querySelector('i');
                            if(img) { img.src = tempAvatarUrl; img.style.display = 'block'; }
                            if(iconI) iconI.style.display = 'none';
                        } catch (error) {
                            console.error('Failed to process character avatar image', error);
                            showToast('头像处理失败');
                        } finally {
                            e.target.value = '';
                        }
                    }
                });
            }

            const confirmBtn = document.getElementById('confirm-char-persona-btn');
            if (confirmBtn) {
                const newConfirmBtn = confirmBtn.cloneNode(true);
                confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
                 
                newConfirmBtn.addEventListener('click', async () => {
                    const previousIdentity = {
                        nickname: friend.nickname || '',
                        realName: friend.realName || '',
                        avatarUrl: friend.avatarUrl || ''
                    };
                    const fallbackName = friend.type === 'npc' ? 'New NPC' : 'New Friend';
                    const saved = await commitNamedFriendChange(friend, (targetFriend) => {
                        targetFriend.realName = realNameInput ? realNameInput.value : '';
                        targetFriend.nickname = nicknameInput ? (nicknameInput.value || fallbackName) : fallbackName;
                        targetFriend.signature = signatureInput ? signatureInput.value : '';
                        targetFriend.relationship = relationshipInput ? relationshipInput.value : '';
                        targetFriend.persona = personaInput ? personaInput.value : '';
                        targetFriend.avatarUrl = tempAvatarUrl;
                    }, { silent: true });

                    if (!saved) {
                        showToast('角色修改保存失败');
                        return;
                    }

                    const latestFriend = window.imData.friends.find(item => String(item.id) === String(friend.id)) || friend;
                    window.imData.currentSettingsFriend = latestFriend;

                    const identityChanged = previousIdentity.nickname !== (latestFriend.nickname || '')
                        || previousIdentity.realName !== (latestFriend.realName || '')
                        || previousIdentity.avatarUrl !== (latestFriend.avatarUrl || '');
                    if (identityChanged && latestFriend.type !== 'group') {
                        await migrateGroupMemberIdentityReferences(latestFriend.id, previousIdentity, latestFriend);
                    }
                    
                    const page = document.getElementById(`chat-interface-${latestFriend.id}`);
                    if (page) {
                        const nameEl = page.querySelector('.ins-chat-name');
                        const avatarContainer = page.querySelector('.ins-chat-avatar');
                        
                        if(nameEl) nameEl.textContent = latestFriend.nickname;
                        
                        if (avatarContainer) {
                            if (latestFriend.avatarUrl) {
                                avatarContainer.innerHTML = `<img src="${latestFriend.avatarUrl}" style="display: block;">`;
                            } else {
                                avatarContainer.innerHTML = `<i class="fas fa-user"></i>`;
                            }
                        }
                    }

                    const settingsAvatarImg = document.getElementById('chat-settings-avatar-img');
                    const settingsAvatarIcon = document.getElementById('chat-settings-avatar-icon');
                    const settingsName = document.getElementById('chat-settings-name');
                    if (latestFriend.avatarUrl) {
                        if(settingsAvatarImg) { settingsAvatarImg.src = latestFriend.avatarUrl; settingsAvatarImg.style.display = 'block'; }
                        if(settingsAvatarIcon) settingsAvatarIcon.style.display = 'none';
                    } else {
                        if(settingsAvatarImg) { settingsAvatarImg.style.display = 'none'; settingsAvatarImg.src = ''; }
                        if(settingsAvatarIcon) settingsAvatarIcon.style.display = 'block';
                    }
                    if (settingsName) settingsName.textContent = latestFriend.nickname;
                    if (latestFriend.type === 'npc') refreshNpcSettingsHeader(latestFriend);
                    
                    if(window.imApp.renderFriendsList) window.imApp.renderFriendsList();
                    if(window.imApp.renderChatsList) window.imApp.renderChatsList();
                    
                    if (window.imChat && window.imChat.rerenderChatContainer && page) {
                        const msgContainer = page.querySelector('.ins-chat-messages');
                        if (msgContainer) window.imChat.rerenderChatContainer(latestFriend, msgContainer, { scroll: false });
                    }
                    
                    showToast('角色修改成功');
                    closeView(editSheet);
                });
            }

            openView(editSheet);
        });
    }

    function ensureCherishedMemoryUi() {
        let detailOverlay = document.getElementById('chat-memory-cherished-detail-overlay');
        if (!detailOverlay) {
            detailOverlay = document.createElement('div');
            detailOverlay.id = 'chat-memory-cherished-detail-overlay';
            detailOverlay.className = 'chat-memory-cherished-detail-overlay';
            detailOverlay.style.position = 'fixed';
            detailOverlay.style.inset = '0';
            detailOverlay.style.background = 'rgba(0,0,0,0.4)';
            detailOverlay.style.zIndex = '99999';
            detailOverlay.style.display = 'none';
            detailOverlay.style.alignItems = 'center';
            detailOverlay.style.justifyContent = 'center';
            detailOverlay.style.padding = '20px';
            detailOverlay.style.boxSizing = 'border-box';
            
            detailOverlay.innerHTML = `
                <div class="chat-memory-cherished-detail-card" style="background:#fff; width:100%; max-width:320px; border-radius:20px; padding:20px;  position:relative;">
                    <button type="button" class="chat-memory-cherished-detail-close" aria-label="关闭" style="position:absolute; right:15px; top:15px; border:none; background:transparent; font-size:18px; color:#8e8e93; cursor:pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                    <div class="chat-memory-cherished-detail-label" style="font-size:12px; color:#007aff; font-weight:700; margin-bottom:10px;">长期记忆详情</div>
                    <div id="chat-memory-cherished-detail-title" class="chat-memory-cherished-detail-title" style="font-size:18px; font-weight:700; color:#111; margin-bottom:8px;">标题</div>
                    <div id="chat-memory-cherished-detail-time" class="chat-memory-cherished-detail-time" style="font-size:13px; color:#8e8e93; margin-bottom:16px;"></div>
                    <div id="chat-memory-cherished-detail-content" class="chat-memory-cherished-detail-content" style="font-size:15px; color:#333; line-height:1.6; margin-bottom:16px;"></div>
                    <div id="chat-memory-cherished-detail-reason" class="chat-memory-cherished-detail-reason" style="font-size:14px; color:#666; background:#f2f2f7; padding:12px; border-radius:12px; margin-bottom:12px;"></div>
                    <div id="chat-memory-cherished-detail-thought" class="chat-memory-cherished-detail-thought" style="font-size:14px; color:#666; background:#f2f2f7; padding:12px; border-radius:12px; margin-bottom:16px;"></div>
                    <div style="margin-top: 10px;">
                        <button type="button" id="chat-memory-cherished-detail-delete-btn" style="width: 100%; padding: 12px; border-radius: 12px; background: #ffe5e5; color: #ff3b30; border: none; font-size: 15px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                            <i class="fas fa-trash-alt"></i> 删除这条长期记忆
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(detailOverlay);

            detailOverlay.addEventListener('click', (e) => {
                if (e.target === detailOverlay) {
                    hideCherishedMemoryDetail();
                }
            });

            const closeBtn = detailOverlay.querySelector('.chat-memory-cherished-detail-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    hideCherishedMemoryDetail();
                });
            }
            
            const deleteBtn = detailOverlay.querySelector('#chat-memory-cherished-detail-delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const entryId = deleteBtn.getAttribute('data-entry-id');
                    if (!entryId) return;

                    const friend = window.imData.currentSettingsFriend || window.imApp.getCurrentMemoryFriend?.();

                    if (!friend) return;

                    let newCherishedText = '';
                    const saved = await window.imApp.commitScopedFriendChange(friend, (targetFriend) => {
                        if (!targetFriend || !targetFriend.memory) return;
                        
                        let entries = Array.isArray(targetFriend.memory.cherishedEntries) ? targetFriend.memory.cherishedEntries : [];
                        entries = entries.filter(item => String(item.id) !== String(entryId));
                        targetFriend.memory.cherishedEntries = entries;
                        const presentedEntries = targetFriend.memory.recallPresentation?.recall?.cherishedEntries;
                        if (Array.isArray(presentedEntries) && presentedEntries.some(item => String(item?.id) === String(entryId))) {
                            targetFriend.memory.recallPresentation = null;
                        }
                        
                        entries.forEach(entry => {
                            const parts = [
                                entry.title ? `【${entry.title}】` : '',
                                entry.content || '',
                                entry.reason ? `原因：${entry.reason}` : ''
                            ].filter(Boolean);
                            const block = parts.join('\n').trim();
                            if (block) newCherishedText += (newCherishedText ? '\n\n' : '') + block;
                        });
                        targetFriend.memory.cherished = newCherishedText;

                    }, { silent: true, syncActive: true, syncSettings: true });

                    if (saved) {
                        void window.imVectorMemory?.deleteMemoryEntries?.(friend, [{
                            kind: 'cherished',
                            entryId: String(entryId)
                        }]).catch(error => console.warn('[iMessage] external memory delete failed', error));
                        if (window.showToast) window.showToast('已删除长期记忆');
                        hideCherishedMemoryDetail();
                        const latestFriend = window.imApp.getFriendById
                            ? (window.imApp.getFriendById(friend.id) || friend)
                            : (window.imData.friends.find(f => String(f.id) === String(friend.id)) || friend);
                        const chatMemoryCherishedInput = document.getElementById('chat-memory-cherished-input');
                        if (chatMemoryCherishedInput && window.imData.currentSettingsFriend && String(window.imData.currentSettingsFriend.id) === String(latestFriend.id)) {
                            chatMemoryCherishedInput.value = latestFriend.memory?.cherished || '';
                        }
                        
                        if (window.imApp.refreshMemoryLocationSheet) {
                            window.imApp.refreshMemoryLocationSheet('downloads');
                        }
                        
                    } else {
                        if (window.showToast) window.showToast('删除失败');
                    }
                });
            }
        }

        return {
            detailOverlay
        };
    }

    function showCherishedMemoryDetail(entry) {
        ensureCherishedMemoryUi();
        const overlay = document.getElementById('chat-memory-cherished-detail-overlay');
        if (!overlay || !entry) return;

        const titleEl = document.getElementById('chat-memory-cherished-detail-title');
        const timeEl = document.getElementById('chat-memory-cherished-detail-time');
        const contentEl = document.getElementById('chat-memory-cherished-detail-content');
        const reasonEl = document.getElementById('chat-memory-cherished-detail-reason');
        const thoughtEl = document.getElementById('chat-memory-cherished-detail-thought');
        const deleteBtn = document.getElementById('chat-memory-cherished-detail-delete-btn');

        if (titleEl) titleEl.textContent = entry.title || '长期记忆';
        if (timeEl) timeEl.textContent = entry.createdAt || '';
        if (contentEl) contentEl.textContent = entry.content || '';
        if (reasonEl) {
            reasonEl.textContent = entry.reason ? `想记住的原因：${entry.reason}` : '';
            reasonEl.style.display = entry.reason ? 'block' : 'none';
        }
        if (thoughtEl) {
            thoughtEl.textContent = entry.sourceThought ? `当时的心声：${entry.sourceThought}` : '';
            thoughtEl.style.display = entry.sourceThought ? 'block' : 'none';
        }
        
        if (deleteBtn) {
            deleteBtn.setAttribute('data-entry-id', entry.id);
        }

        overlay.style.display = 'flex';
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });
    }

    function hideCherishedMemoryDetail() {
        const overlay = document.getElementById('chat-memory-cherished-detail-overlay');
        if (!overlay) return;

        overlay.classList.remove('active');
        setTimeout(() => {
            if (!overlay.classList.contains('active')) {
                overlay.style.display = 'none';
            }
        }, 220);
    }

    function renderCherishedMemoryCards(friend) {
        // Obsolete, replaced by generic downloads panel rendering in 2_core.js
        return;
    }

    async function saveChatSettingsMemory(friend, options = {}) {
        if (!friend) return false;
        friend = window.imApp.getFriendById?.(friend) || friend;
        const shouldToast = !!options.showToast;

        const chatMemoryOverviewInput = document.getElementById('chat-memory-overview-input');
        const chatMemoryContextEnabled = document.getElementById('chat-memory-context-enabled-toggle');
        const chatMemoryContextLimit = document.getElementById('chat-memory-context-limit-input');
        const chatMemoryCherishedInput = document.getElementById('chat-memory-cherished-input');
        const chatMemoryScheduleSleep = document.getElementById('chat-memory-schedule-sleep-input');
        const chatMemoryScheduleWake = document.getElementById('chat-memory-schedule-wake-input');

        const nextMemory = {
            ...window.imApp.createDefaultMemory(),
            ...(friend.memory || {}),
            overview: chatMemoryOverviewInput ? chatMemoryOverviewInput.value : '',
            context: {
                enabled: chatMemoryContextEnabled ? chatMemoryContextEnabled.checked : true,
                limit: chatMemoryContextLimit && Number(chatMemoryContextLimit.value) > 0 ? Number(chatMemoryContextLimit.value) : 50,
                notes: friend.memory?.context?.notes || ''
            },
            summary: {
                enabled: !!friend.memory?.summary?.enabled,
                limit: friend.memory?.summary?.limit || 80,
                roundLimit: window.imDataUtils?.normalizeRoundLimit
                    ? window.imDataUtils.normalizeRoundLimit(friend.memory?.summary?.roundLimit, 30)
                    : (Number(friend.memory?.summary?.roundLimit) || 30),
                prompt: friend.memory?.summary?.prompt || '',
                apiPresetId: String(friend.memory?.summary?.apiPresetId || '')
            },
            autonomous: window.imApp.normalizeAutonomousActivity
                ? window.imApp.normalizeAutonomousActivity(friend.memory?.autonomous)
                : { enabled: false, minIntervalMinutes: 30, maxIntervalMinutes: 240, nextRunAt: 0, lastRunAt: 0 },
            longTerm: friend.memory?.longTerm || '',
            shortTermEntries: Array.isArray(friend.memory?.shortTermEntries) ? friend.memory.shortTermEntries : [],
            cherished: chatMemoryCherishedInput ? chatMemoryCherishedInput.value : (friend.memory?.cherished || ''),
            schedule: {
                ...(friend.memory?.schedule || {}),
                enabled: !!friend.memory?.schedule?.enabled,
                sleepTime: chatMemoryScheduleSleep ? chatMemoryScheduleSleep.value : (friend.memory?.schedule?.sleepTime || '23:00'),
                wakeTime: chatMemoryScheduleWake ? chatMemoryScheduleWake.value : (friend.memory?.schedule?.wakeTime || '07:00'),
                events: Array.isArray(friend.memory?.schedule?.events) ? friend.memory.schedule.events : []
            },
            relationships: Array.isArray(friend.memory?.relationships) ? friend.memory.relationships : []
        };

        const commitOptions = {
            silent: options.silent !== false,
            immediate: options.immediate,
            delay: options.delay
        };

        const saved = await commitNamedFriendChange(friend, (targetFriend) => {
            const preservedAutonomous = window.imApp.normalizeAutonomousActivity
                ? window.imApp.normalizeAutonomousActivity(targetFriend.memory?.autonomous || nextMemory.autonomous)
                : nextMemory.autonomous;
            targetFriend.memory = {
                ...nextMemory,
                autonomous: preservedAutonomous
            };
        }, commitOptions);

        if (!saved) {
            if (shouldToast) showToast('记忆设置保存失败');
            return false;
        }

        if (shouldToast) showToast('记忆设置已保存');
        const latestFriend = window.imApp.getFriendById?.(friend) || friend;
        if (window.imData.currentSettingsFriend
            && String(window.imData.currentSettingsFriend.id) === String(latestFriend.id)) {
            window.imData.currentSettingsFriend = latestFriend;
        }
        return true;
    }

    function bindChatSettingsMemoryPersistence() {
        const ids = [
            'chat-memory-overview-input',
            'chat-memory-context-enabled-toggle',
            'chat-memory-context-limit-input',
            'chat-memory-cherished-input',
            'chat-memory-schedule-sleep-input',
            'chat-memory-schedule-wake-input'
        ];

        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;

            if (el.dataset.chatMemoryBound === 'true') {
                return;
            }

            const schedulePersist = async () => {
                const currentFriend = window.imData.currentSettingsFriend;
                if (!currentFriend) return;
                await saveChatSettingsMemory(currentFriend, {
                    showToast: false,
                    silent: true,
                    immediate: false,
                    delay: 900
                });
            };

            const flushPersist = async () => {
                const currentFriend = window.imData.currentSettingsFriend;
                if (!currentFriend) return;
                await saveChatSettingsMemory(currentFriend, {
                    showToast: false,
                    silent: true,
                    immediate: true
                });
            };

            if (el.tagName === 'TEXTAREA' || el.type === 'number' || el.type === 'text') {
                el.addEventListener('input', schedulePersist);
                el.addEventListener('blur', flushPersist);
            } else {
                el.addEventListener('change', flushPersist);
            }

            el.dataset.chatMemoryBound = 'true';
        });
    }

    const manualSummaryBtn = document.getElementById('chat-memory-manual-summary-btn');
    const manualSummaryModal = document.getElementById('chat-memory-summary-modal');
    const manualSummaryClose = document.getElementById('chat-memory-summary-close');
    const manualSummaryConfirm = document.getElementById('chat-memory-summary-confirm');
    const manualSummaryCountInput = document.getElementById('chat-memory-summary-count-input');
    const manualSummaryUnsummarizedCount = document.getElementById('chat-memory-unsummarized-count');
    const manualSummaryBatchCount = document.getElementById('chat-memory-summary-batch-count');
    const autoSummaryToggle = document.getElementById('chat-memory-auto-summary-toggle');
    const summaryRoundInput = document.getElementById('chat-memory-summary-round-input');
    const summaryHint = document.getElementById('chat-memory-summary-hint');
    const summaryApiSelect = document.getElementById('chat-memory-summary-api-select');
    const summaryPromptInput = document.getElementById('chat-memory-summary-prompt-input');
    const summaryPromptClear = document.getElementById('chat-memory-summary-prompt-clear');
    const autonomousBtn = document.getElementById('chat-memory-autonomous-btn');
    const autonomousSheet = document.getElementById('chat-memory-autonomous-sheet');
    const autonomousClose = document.getElementById('chat-memory-autonomous-close-btn');
    const autonomousSaveBtn = document.getElementById('chat-memory-autonomous-save-btn');
    const autonomousToggle = document.getElementById('chat-memory-autonomous-enabled-toggle');
    const autonomousStatus = document.getElementById('chat-memory-autonomous-status');
    const autonomousNextLabel = document.getElementById('chat-memory-autonomous-next-label');
    const autonomousReplyMinInput = document.getElementById('chat-memory-autonomous-reply-min-input');
    const autonomousReplyMaxInput = document.getElementById('chat-memory-autonomous-reply-max-input');
    const autonomousMomentToggle = document.getElementById('chat-memory-autonomous-moment-toggle');
    const autonomousMomentMinInput = document.getElementById('chat-memory-autonomous-moment-min-input');
    const autonomousMomentMaxInput = document.getElementById('chat-memory-autonomous-moment-max-input');
    const autonomousMomentNextLabel = document.getElementById('chat-memory-autonomous-moment-next-label');
    const summaryInFlight = new Set();

    function setAutonomousCardExpanded(toggleEl, expanded) {
        const card = toggleEl?.closest?.('.chat-memory-autonomous-card');
        if (card) card.classList.toggle('is-enabled', !!expanded);
    }

    function normalizeAutonomousActivity(activity) {
        return window.imApp.normalizeAutonomousActivity
            ? window.imApp.normalizeAutonomousActivity(activity)
            : {
                reply: normalizeAutonomousTask(activity?.reply || activity),
                moment: normalizeAutonomousTask(activity?.moment)
            };
    }

    function normalizeAutonomousTask(task) {
        return window.imApp.normalizeAutonomousTask
            ? window.imApp.normalizeAutonomousTask(task)
            : {
                enabled: !!task?.enabled,
                minIntervalMinutes: Math.max(1, Math.round(Number(task?.minIntervalMinutes) || 30)),
                maxIntervalMinutes: Math.max(
                    Math.max(1, Math.round(Number(task?.minIntervalMinutes) || 30)),
                    Math.round(Number(task?.maxIntervalMinutes) || 240)
                ),
                nextRunAt: Math.max(0, Number(task?.nextRunAt) || 0),
                lastRunAt: Math.max(0, Number(task?.lastRunAt) || 0)
            };
    }

    function getRandomAutonomousDelay(task) {
        const normalized = normalizeAutonomousTask(task);
        const min = Math.max(1, Number(normalized.minIntervalMinutes) || 30);
        const max = Math.max(min, Number(normalized.maxIntervalMinutes) || 240);
        const minutes = min + Math.floor(Math.random() * (max - min + 1));
        return minutes * 60 * 1000;
    }

    function formatAutonomousNextTime(timestamp) {
        const value = Number(timestamp) || 0;
        if (value <= 0) return '等待下次随机触发';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '等待下次随机触发';
        return `下次约 ${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    function getAutonomousIntervalValues(minInput, maxInput, fallbackTask) {
        const fallback = normalizeAutonomousTask(fallbackTask);
        const minValue = Math.max(1, Math.round(Number(minInput?.value) || fallback.minIntervalMinutes || 30));
        const maxValue = Math.max(minValue, Math.round(Number(maxInput?.value) || fallback.maxIntervalMinutes || 240));
        return { minIntervalMinutes: minValue, maxIntervalMinutes: maxValue };
    }

    function setAutonomousIntervalInputs(task, minInput, maxInput) {
        const normalized = normalizeAutonomousTask(task);
        if (minInput) minInput.value = String(normalized.minIntervalMinutes);
        if (maxInput) maxInput.value = String(normalized.maxIntervalMinutes);
    }

    function buildAutonomousTaskFromControls(task, enabled, minInput, maxInput) {
        const nextTask = normalizeAutonomousTask(task);
        const intervalValues = getAutonomousIntervalValues(minInput, maxInput, nextTask);
        nextTask.enabled = !!enabled;
        nextTask.minIntervalMinutes = intervalValues.minIntervalMinutes;
        nextTask.maxIntervalMinutes = intervalValues.maxIntervalMinutes;
        if (nextTask.enabled) {
            nextTask.nextRunAt = Date.now() + getRandomAutonomousDelay(nextTask);
        } else {
            nextTask.nextRunAt = 0;
        }
        return nextTask;
    }

    function updateAutonomousActivityControls(friend) {
        const activity = normalizeAutonomousActivity(friend?.memory?.autonomous);
        const replyTask = normalizeAutonomousTask(activity.reply);
        const momentTask = normalizeAutonomousTask(activity.moment);
        if (autonomousStatus) {
            autonomousStatus.textContent = replyTask.enabled && momentTask.enabled
                ? '全部开启'
                : (replyTask.enabled ? '回复开启' : (momentTask.enabled ? '朋友圈开启' : '关闭'));
            autonomousStatus.style.color = replyTask.enabled || momentTask.enabled ? '#34c759' : '#8e8e93';
        }
        if (autonomousToggle) autonomousToggle.checked = !!replyTask.enabled;
        if (autonomousMomentToggle) autonomousMomentToggle.checked = !!momentTask.enabled;
        setAutonomousCardExpanded(autonomousToggle, replyTask.enabled);
        setAutonomousCardExpanded(autonomousMomentToggle, momentTask.enabled);
        setAutonomousIntervalInputs(replyTask, autonomousReplyMinInput, autonomousReplyMaxInput);
        setAutonomousIntervalInputs(momentTask, autonomousMomentMinInput, autonomousMomentMaxInput);
        if (autonomousNextLabel) {
            autonomousNextLabel.textContent = replyTask.enabled
                ? formatAutonomousNextTime(replyTask.nextRunAt)
                : '关闭后不会主动发消息';
        }
        if (autonomousMomentNextLabel) {
            autonomousMomentNextLabel.textContent = momentTask.enabled
                ? formatAutonomousNextTime(momentTask.nextRunAt)
                : '关闭后不会自动发朋友圈';
        }
    }

    function openAutonomousActivitySheet(friend) {
        if (!friend || !autonomousSheet) return;
        friend.memory = window.imApp.normalizeFriendData(friend).memory;
        updateAutonomousActivityControls(friend);
        if (window.openView) {
            window.openView(autonomousSheet);
        } else {
            autonomousSheet.classList.add('active');
            autonomousSheet.style.display = 'flex';
        }
    }

    async function saveAutonomousActivitySettings() {
        const friend = window.imData.currentSettingsFriend;
        if (!friend || !autonomousSaveBtn) return;
        const replyEnabled = !!autonomousToggle?.checked;
        const momentEnabled = !!autonomousMomentToggle?.checked;
        autonomousSaveBtn.textContent = '保存中...';
        autonomousSaveBtn.style.pointerEvents = 'none';

        try {
            const saved = await commitNamedFriendChange(friend, (targetFriend) => {
                targetFriend.memory = window.imApp.normalizeFriendData(targetFriend).memory;
                const activity = normalizeAutonomousActivity(targetFriend.memory.autonomous);
                activity.reply = buildAutonomousTaskFromControls(activity.reply, replyEnabled, autonomousReplyMinInput, autonomousReplyMaxInput);
                activity.moment = buildAutonomousTaskFromControls(activity.moment, momentEnabled, autonomousMomentMinInput, autonomousMomentMaxInput);
                targetFriend.memory.autonomous = activity;
            }, { silent: true, immediate: true });

            if (!saved) {
                showToast('自主活动保存失败');
                return;
            }

            const latestFriend = window.imData.friends.find(item => String(item.id) === String(friend.id)) || friend;
            latestFriend.memory = window.imApp.normalizeFriendData(latestFriend).memory;
            window.imData.currentSettingsFriend = latestFriend;
            updateAutonomousActivityControls(latestFriend);
            if (window.imChat?.refreshAutonomousActivityTimers) {
                window.imChat.refreshAutonomousActivityTimers();
            }
            showToast(replyEnabled || momentEnabled ? '自主活动已保存' : '自主活动已关闭');
            if (autonomousSheet && window.closeView) window.closeView(autonomousSheet);
        } finally {
            autonomousSaveBtn.textContent = '保存';
            autonomousSaveBtn.style.pointerEvents = '';
        }
    }

    function getChatSummaryMessageCount(friend) {
        return Array.isArray(friend?.messages) ? friend.messages.length : 0;
    }

    function getChatSummaryUnsummarizedCount(friend) {
        const total = getChatSummaryMessageCount(friend);
        const last = Math.max(0, Number(friend?.memory?.lastSummaryMessageCount) || 0);
        return Math.max(0, total - Math.min(last, total));
    }

    function isGroupSummarySourceMessage(message) {
        if (!message) return false;
        if (message.privateFromGroup) return false;
        if (message.payload?.privateFromGroup) return false;
        if (message.privateChatSnapshot) return false;
        if (message.payload?.privateChatSnapshot) return false;
        const noticeKind = String(message.noticeKind || '').trim();
        if (noticeKind === 'group_private_to_user' || noticeKind === 'group_friend_private_chat') {
            return false;
        }
        return true;
    }

    function getChatSummaryBatch(friend, roundLimit) {
        const messages = Array.isArray(friend?.messages) ? friend.messages : [];
        const lastCount = Math.max(0, Number(friend?.memory?.lastSummaryMessageCount) || 0);
        const startIndex = Math.min(lastCount, messages.length);
        const limit = window.imDataUtils?.normalizeRoundLimit
            ? window.imDataUtils.normalizeRoundLimit(roundLimit, 30)
            : Math.max(1, Math.round(Number(roundLimit) || 30));

        if (friend?.type === 'group') {
            let availableRounds = 0;
            let pendingSourceCount = 0;
            for (let index = startIndex; index < messages.length; index += 1) {
                const message = messages[index];
                if (!isGroupSummarySourceMessage(message)) continue;
                pendingSourceCount += 1;
                if (message?.role === 'user') availableRounds += 1;
            }

            let selectedRounds = 0;
            let endIndex = startIndex;
            const selectedMessages = [];
            for (let index = startIndex; index < messages.length; index += 1) {
                const message = messages[index];
                if (!isGroupSummarySourceMessage(message)) {
                    endIndex = index + 1;
                    continue;
                }
                if (message?.role === 'user') {
                    if (selectedRounds >= limit) break;
                    selectedRounds += 1;
                }
                selectedMessages.push(message);
                endIndex = index + 1;
            }

            if (selectedRounds === 0) {
                endIndex = startIndex;
                selectedMessages.length = 0;
            }

            return {
                startIndex,
                endIndex,
                roundLimit: limit,
                availableRounds,
                unsummarizedMessageCount: pendingSourceCount,
                selectedRounds,
                selectedMessageCount: selectedMessages.length,
                selectedMessages,
                ready: availableRounds >= limit
            };
        }

        if (window.imDataUtils?.getSummaryBatch) {
            return window.imDataUtils.getSummaryBatch(messages, lastCount, roundLimit);
        }
        const pending = messages.slice(startIndex);
        const availableRounds = pending.filter(message => message?.role === 'user').length;
        return {
            startIndex,
            endIndex: messages.length,
            roundLimit: limit,
            availableRounds,
            unsummarizedMessageCount: pending.length,
            selectedRounds: Math.min(limit, availableRounds),
            selectedMessageCount: pending.length,
            selectedMessages: pending,
            ready: availableRounds >= limit
        };
    }

    function formatSummarySourceMessage(msg, friend) {
        if (friend?.type === 'group' && window.imApp.formatMessageForApiContext) {
            const formatted = window.imApp.formatMessageForApiContext(msg, friend, {
                userName: userState?.name || 'User'
            });
            const time = msg.timestamp ? new Date(msg.timestamp).toLocaleString('zh-CN', { hour12: false }) : '';
            return `[${time}] ${formatted?.content || msg.content || msg.text || ''}`;
        }

        const speaker = msg.role === 'assistant'
            ? (friend.nickname || friend.realname || friend.realName || 'Char')
            : (userState?.name || 'User');
        const time = msg.timestamp ? new Date(msg.timestamp).toLocaleString('zh-CN', { hour12: false }) : '';
        const content = msg.content || msg.text || '';
        return `[${time}] ${speaker}: ${content}`;
    }

    function normalizeSummaryApiEndpoint(config) {
        return window.u2Api.resolveChatCompletionsEndpoint(config.endpoint || '');
    }

    function getSummaryResponseContent(data) {
        const firstChoice = data?.choices?.[0];
        if (!firstChoice) return '';
        return firstChoice.message?.content || firstChoice.text || firstChoice.delta?.content || '';
    }

    function getSummaryEntryTime(entry) {
        return entry?.lastActivatedAt || entry?.time || entry?.createdAt || '';
    }

    function parseSummaryDate(value) {
        if (!value) return null;
        if (typeof value === 'number') {
            const numericDate = new Date(value);
            return Number.isNaN(numericDate.getTime()) ? null : numericDate;
        }
        const text = String(value).trim();
        const normalized = text
            .replace(/年/g, '-')
            .replace(/月/g, '-')
            .replace(/日/g, ' ')
            .replace(/\./g, '-')
            .replace(/\//g, '-');
        const parsed = new Date(normalized);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function decayShortTermMemoryEntries(entries, now = new Date(), activatedIds = new Set()) {
        if (!Array.isArray(entries)) return [];
        const dayMs = 24 * 60 * 60 * 1000;
        return entries.map(entry => {
            if (!entry) return entry;
            if (activatedIds.has(String(entry.id))) return entry;
            const anchorDate = parseSummaryDate(getSummaryEntryTime(entry));
            if (!anchorDate) return entry;
            const ageDays = (now.getTime() - anchorDate.getTime()) / dayMs;
            if (ageDays > 30) {
                entry.degree = '遗忘';
            } else if (ageDays > 7) {
                entry.degree = '低';
            } else if (ageDays > 1 && entry.degree === '高') {
                entry.degree = '中';
            }
            return entry;
        });
    }

    function formatExistingSummaryEntries(friend) {
        const entries = Array.isArray(friend?.memory?.shortTermEntries) ? friend.memory.shortTermEntries : [];
        if (entries.length === 0) return '无';
        return entries.map(entry => [
            `ID: ${entry.id}`,
            `标题: ${entry.title || '对话总结'}`,
            `时间: ${entry.time || ''}`,
            `事件: ${entry.event || ''}`,
            `记忆标签: ${(window.imChat?.getShortTermMemoryTags ? window.imChat.getShortTermMemoryTags(entry) : (entry.memoryTags || entry.triggerKeywords || [])).join('、')}`,
            `记忆程度: ${entry.degree || '高'}`
        ].join('\n')).join('\n\n');
    }

    function parseManualSummary(rawText) {
        const cleanText = String(rawText || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
        try {
            const parsed = JSON.parse(cleanText);
            const summaryPayload = parsed.summary && typeof parsed.summary === 'object' ? parsed.summary : parsed;
            
            let memoryPointsData = summaryPayload.memoryPoints || summaryPayload['记忆点'] || '';
            let memoryPoints = '';
            if (Array.isArray(memoryPointsData)) {
                memoryPoints = memoryPointsData.join('，');
            } else if (typeof memoryPointsData === 'object' && memoryPointsData !== null) {
                memoryPoints = Object.entries(memoryPointsData).map(([k, v]) => `${k}:${v}`).join('，');
            } else {
                memoryPoints = String(memoryPointsData);
            }
            const memoryTags = window.imChat?.normalizeMemoryTriggerKeywords
                ? window.imChat.normalizeMemoryTriggerKeywords(summaryPayload.memoryTags || summaryPayload['记忆标签'] || [])
                : (Array.isArray(summaryPayload.memoryTags) ? summaryPayload.memoryTags : []);

            return {
                activatedEntryIds: Array.isArray(parsed.activatedEntryIds) ? parsed.activatedEntryIds.map(String) : [],
                title: summaryPayload.title || summaryPayload['标题'] || '对话总结',
                time: summaryPayload.time || summaryPayload['时间'] || '',
                event: summaryPayload.event || summaryPayload['事件'] || '',
                memoryPoints,
                memoryTags,
                triggerKeywords: window.imChat?.normalizeMemoryTriggerKeywords
                    ? window.imChat.normalizeMemoryTriggerKeywords(memoryTags.length > 0 ? memoryTags : (summaryPayload.triggerKeywords || summaryPayload['触发词'] || []))
                    : (memoryTags.length > 0 ? memoryTags : (Array.isArray(summaryPayload.triggerKeywords) ? summaryPayload.triggerKeywords : [])),
                degree: summaryPayload.degree || summaryPayload['记忆程度'] || '高',
                raw: rawText
            };
        } catch (error) {
            const pick = (label) => {
                const match = cleanText.match(new RegExp(`${label}[:：]\\s*([\\s\\S]*?)(?=\\n(?:标题|时间|事件|记忆点|记忆程度)[:：]|$)`));
                return match ? match[1].trim() : '';
            };
            return {
                activatedEntryIds: [],
                title: pick('标题') || '对话总结',
                time: pick('时间'),
                event: pick('事件'),
                memoryPoints: pick('记忆点'),
                memoryTags: window.imChat?.normalizeMemoryTriggerKeywords
                    ? window.imChat.normalizeMemoryTriggerKeywords(pick('记忆标签'))
                    : [],
                triggerKeywords: window.imChat?.normalizeMemoryTriggerKeywords
                    ? window.imChat.normalizeMemoryTriggerKeywords(pick('记忆标签') || pick('触发词'))
                    : [],
                degree: pick('记忆程度') || '高',
                raw: rawText
            };
        }
    }

    function parseShortTermMemoryPromotionDraft(rawText, fallback = {}) {
        const cleanText = String(rawText || '').trim()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '');
        let payload = {};
        try {
            payload = JSON.parse(cleanText);
        } catch (error) {
            throw createSummaryFailureError({ kind: 'response_format' });
        }
        const title = String(payload?.title || '').trim();
        const content = String(payload?.content || payload?.memory || '').trim();
        const rawTags = payload?.triggerKeywords || payload?.memoryTags || [];
        const triggerKeywords = window.imChat?.normalizeMemoryTriggerKeywords
            ? window.imChat.normalizeMemoryTriggerKeywords(rawTags)
            : (Array.isArray(rawTags) ? rawTags : [rawTags])
                .map(value => String(value || '').trim())
                .filter(Boolean)
                .slice(0, 6);
        if (!title || !content || triggerKeywords.length === 0) {
            throw createSummaryFailureError({ kind: 'response_format' });
        }
        return {
            title,
            content,
            time: String(payload?.time || fallback.time || '').trim(),
            triggerKeywords: triggerKeywords.slice(0, 6)
        };
    }

    function getSummaryApiPresets() {
        const presets = typeof window.getApiPresets === 'function' ? window.getApiPresets() : [];
        return Array.isArray(presets) ? presets : [];
    }

    function resolveSummaryApiConfig(friend) {
        const selectedId = String(friend?.memory?.summary?.apiPresetId || '');
        const selectedPreset = selectedId
            ? getSummaryApiPresets().find(preset => String(preset?.id) === selectedId)
            : null;
        if (selectedPreset) {
            return {
                endpoint: selectedPreset.endpoint || '',
                apiKey: selectedPreset.apiKey || '',
                model: selectedPreset.model || '',
                temperature: selectedPreset.temperature ?? selectedPreset.temp ?? 0.7,
                presetId: selectedId
            };
        }
        const current = window.getApiConfig ? window.getApiConfig() : (window.apiConfig || {});
        return { ...current, presetId: '' };
    }

    window.imApp.generateShortTermMemoryPromotionDraft = async function(friendOrId, sourceEntries) {
        const friend = window.imApp.getFriendById?.(friendOrId) || friendOrId;
        const entries = (Array.isArray(sourceEntries) ? sourceEntries : [])
            .filter(entry => entry && entry.id != null)
            .map(entry => ({ ...entry }));
        if (!friend || entries.length === 0) {
            throw new Error('请选择至少一条短期记忆');
        }

        const apiConfig = resolveSummaryApiConfig(friend);
        if (!apiConfig.endpoint || !apiConfig.apiKey) {
            throw new Error('请先在设置中配置 API');
        }

        const charName = friend.nickname || friend.realname || friend.realName || 'Char';
        const isGroup = friend.type === 'group';
        const sourceText = entries.map((entry, index) => [
            `条目 ${index + 1}（ID: ${entry.id}）`,
            `标题: ${entry.title || '对话总结'}`,
            `时间: ${entry.time || entry.createdAt || '未记录'}`,
            `事件: ${entry.event || entry.content || ''}`,
            `记忆点: ${entry.memoryPoints || ''}`,
            `标签: ${(window.imChat?.getShortTermMemoryTags
                ? window.imChat.getShortTermMemoryTags(entry)
                : (entry.memoryTags || entry.triggerKeywords || [])).join('、')}`
        ].join('\n')).join('\n\n');
        const fallbackTime = String(entries[entries.length - 1]?.time || entries[entries.length - 1]?.createdAt || '');
        const privacyRules = isGroup
            ? `\n群聊隐私约束（最高优先级）：\n- 输入仅应来自该群公开总结；只保留公开发生的事实。\n- 禁止写入、推断或复述任何成员私信、好友私聊、私密想法或未公开信息。\n- 必须使用第三人称描述群聊共同事件。`
            : `\n单聊约束：\n- 只合并输入条目中已经明确存在的事实，不得补写、猜测或虚构细节。\n- 用 ${charName} 与 User 的长期关系和稳定偏好可理解的简洁表述。`;
        const prompt = `你是记忆整理员。请把以下 ${entries.length} 条短期记忆合并为一条可长期保存的记忆。保留稳定事实、承诺、偏好、关系变化和未完成事项；去掉重复与瞬时细节。${privacyRules}\n\n只输出可解析 JSON，禁止 markdown 或解释，结构必须完全如下：\n{\n  "title": "不超过16字的标题",\n  "time": "沿用输入中最晚的相关时间，不确定则留空",\n  "content": "60-180字的长期记忆正文",\n  "triggerKeywords": ["3到6个可单独触发的简短标签"]\n}\n\n短期记忆：\n${sourceText}`;
        const response = await fetch(normalizeSummaryApiEndpoint(apiConfig), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiConfig.apiKey}` },
            body: JSON.stringify({
                model: apiConfig.model || '',
                messages: [
                    { role: 'system', content: '你只输出可解析 JSON。' },
                    { role: 'user', content: prompt }
                ],
                temperature: parseFloat(apiConfig.temperature ?? apiConfig.temp) || 0.7
            })
        });
        if (!response.ok) {
            const apiError = window.u2Api?.readApiError
                ? await window.u2Api.readApiError(response)
                : { status: response.status, statusText: response.statusText || '', message: response.statusText || '' };
            throw createSummaryFailureError({
                kind: 'http',
                status: apiError.status || response.status,
                message: apiError.message || apiError.statusText || ''
            });
        }
        let data;
        try {
            data = await response.json();
        } catch (error) {
            throw createSummaryFailureError({ kind: 'response_format' });
        }
        return parseShortTermMemoryPromotionDraft(getSummaryResponseContent(data), { time: fallbackTime });
    };

    function refreshSummaryApiSelect(friend) {
        if (!summaryApiSelect) return;
        const selectedId = String(friend?.memory?.summary?.apiPresetId || '');
        const presets = getSummaryApiPresets();
        summaryApiSelect.replaceChildren();
        const fallbackOption = document.createElement('option');
        fallbackOption.value = '';
        fallbackOption.textContent = '跟随当前 API';
        summaryApiSelect.appendChild(fallbackOption);
        presets.forEach(preset => {
            const option = document.createElement('option');
            option.value = String(preset?.id ?? '');
            option.textContent = String(preset?.name || '未命名预设');
            summaryApiSelect.appendChild(option);
        });
        summaryApiSelect.value = presets.some(preset => String(preset?.id) === selectedId) ? selectedId : '';
    }

    function getSummaryFailureClassification(input = {}) {
        if (window.imDataUtils?.classifySummaryRequestFailure) {
            return window.imDataUtils.classifySummaryRequestFailure(input);
        }
        const status = Math.max(0, Math.round(Number(input.status) || 0));
        return {
            code: 'unknown',
            status,
            message: `摘要生成失败，请稍后重试${status > 0 ? `（HTTP ${status}）` : ''}`
        };
    }

    function createSummaryFailureError(input = {}) {
        const failure = getSummaryFailureClassification(input);
        const error = new Error(`Summary ${failure.code}`);
        error.name = 'SummaryGenerationError';
        error.summaryFailure = failure;
        return error;
    }

    function isSummaryNetworkError(error) {
        if (error?.name === 'TypeError') return true;
        return /(?:failed to fetch|networkerror|network request failed|cors)/i.test(String(error?.message || ''));
    }

    function logManualSingleSummaryFailure(friend, error) {
        const failure = error?.summaryFailure || getSummaryFailureClassification({
            kind: isSummaryNetworkError(error) ? 'network' : 'unknown'
        });
        console.error('Manual single-chat summary failed', {
            friendId: String(friend?.id || ''),
            apiPresetId: String(friend?.memory?.summary?.apiPresetId || ''),
            category: failure.code,
            status: failure.status || 0,
            message: failure.message
        });
        return failure;
    }

    async function generateChatSummary(friend, options = {}) {
        const currentApiConfig = resolveSummaryApiConfig(friend);
        const isManualSingleChatSummary = friend.type !== 'group' && !options.auto;
        if (!currentApiConfig.endpoint || !currentApiConfig.apiKey) {
            if (!options.silent) showToast('请先在设置中配置 API');
            return null;
        }

        if (window.imApp.ensureFriendMessagesLoaded) {
            await window.imApp.ensureFriendMessagesLoaded(friend);
        }

        const messages = Array.isArray(friend.messages) ? friend.messages : [];
        const roundLimit = window.imDataUtils?.normalizeRoundLimit
            ? window.imDataUtils.normalizeRoundLimit(options.roundLimit ?? friend.memory?.summary?.roundLimit, 30)
            : Math.max(1, Math.round(Number(options.roundLimit ?? friend.memory?.summary?.roundLimit) || 30));
        const batch = getChatSummaryBatch(friend, roundLimit);
        if (options.requireFullBatch && !batch.ready) return null;
        const sourceMessages = batch.selectedMessages;
        if (sourceMessages.length === 0) {
            if (!options.silent) showToast('暂无未总结对话');
            return null;
        }

        const charName = friend.nickname || friend.realname || friend.realName || 'Char';
        const userName = userState?.name || 'User';
        const now = new Date();
        const nowString = `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const eventTime = window.imDataUtils?.formatMemoryEventTime
            ? window.imDataUtils.formatMemoryEventTime(sourceMessages, now.getTime())
            : nowString;
        const dialogueText = sourceMessages.map(msg => formatSummarySourceMessage(msg, friend)).join('\n');
        const existingSummariesText = formatExistingSummaryEntries(friend);

        const customSummaryPrompt = String(friend.memory?.summary?.prompt || '').trim();
        const builtInPrompt = friend.type === 'group'
            ? `查看已有的群聊总结，将与本次需要总结的公开群聊内容相关的记忆条目激活（记忆程度改为高）。\n\n已有群聊总结：\n${existingSummariesText}\n\n你是群聊记录整理员。请用第三人称总结群聊「${charName}」中的公开聊天，把以下${batch.selectedRounds}轮、共${sourceMessages.length}条公开消息整合成一件完整的事情，必须说清楚前因、过程和结果。\n\n当前真实总结时间：${nowString}\n本批对话实际发生时间：${eventTime}\nUser 名称：${userName}\n\n严格限制：\n- 只总结当前群聊里公开发生的消息。\n- 不要写入、推断或复述任何群成员给 User 的私信内容。\n- 不要写入、推断或复述任何群成员与自己好友/私有联系人的私信内容。\n- 如果记录里只有“有人发了私信”这类系统提示，也只能当作不可展开的背景事件，不得编造私信细节。\n\n必须只输出 JSON，不要 markdown，不要解释。JSON 字段如下：\n{\n  "activatedEntryIds": ["与本次群聊相关、需要激活的已有总结ID，没有则为空数组"],\n  "summary": {\n    "title": "10字内，事件名称",\n    "time": "本批公开群聊实际发生时间，前端会按消息时间戳覆盖",\n    "event": "40-100字，第三人称，把公开群聊总结为一件完整的事，写清前因后果",\n    "memoryPoints": "纯文本字符串，概括公开群聊里的关键参与者、矛盾/目标、情绪变化、结果或悬而未决点",\n    "degree": "高"\n  }\n}\n\nsummary.degree 只可输出“高”。activatedEntryIds 只能使用已有群聊总结中的 ID。\n\n公开群聊：\n${dialogueText}\n\n查看已有总结，将所有记忆程度超过真实时间1天的高改成中，超过7天的改成低，超过30天的改成遗忘。`
            : `查看已有的总结，将与本次需要总结的对话的内容相关的记忆点的记忆条目激活（记忆程度改为高）。\n\n已有短期记忆总结：\n${existingSummariesText}\n\n你是${charName}，请站在${charName}的第一人称视角，将以下${batch.selectedRounds}轮、共${sourceMessages.length}条对话进行一次记忆总结，整合精炼成一件完整的事。\n\n当前真实总结时间：${nowString}\n本批对话实际发生时间：${eventTime}\nUser 名称：${userName}\n\n必须只输出 JSON，不要 markdown，不要解释。JSON 字段如下：\n{\n  "activatedEntryIds": ["与本次对话相关、需要激活的已有记忆ID，没有则为空数组"],\n  "summary": {\n    "title": "10字内，事件名称",\n    "time": "本批对话实际发生时间，前端会按消息时间戳覆盖",\n    "event": "20-50字，内容为一件完整的事",\n    "memoryPoints": "请输出纯文本字符串格式，必须包含情绪/声音/画面/气味/环境五个感官记忆，每个感官不超过10字，最好用一个词形容",\n    "degree": "高"\n  }\n}\n\nsummary.degree 只可输出“高”。activatedEntryIds 只能使用已有短期记忆总结中的 ID。\n\n对话：\n${dialogueText}\n\n查看已有的总结，将所有记忆程度超过真实时间1天的高改成中，超过7天的改成低，超过30天的改成遗忘。`;

        const customPrompt = customSummaryPrompt
            ? `请总结以下${friend.type === 'group' ? '公开群聊' : '对话'}。总结的内容取舍、重点、视角和表达方式必须以 <user_summary_instructions> 为最高优先级，不得套用其他内置总结风格。\n\n<user_summary_instructions>\n${customSummaryPrompt}\n</user_summary_instructions>\n\n已有总结：\n${existingSummariesText}\n\n当前真实总结时间：${nowString}\n本批对话实际发生时间：${eventTime}\nUser 名称：${userName}\n\n必须只输出以下 JSON 结构：\n{\n  "activatedEntryIds": ["与本次内容相关的已有总结ID，没有则为空数组"],\n  "summary": {\n    "title": "按自定义要求概括的简短标题",\n    "time": "本批对话实际发生时间，前端会按消息时间戳覆盖",\n    "event": "完全按自定义要求生成的总结正文",\n    "memoryPoints": "与自定义总结一致的可召回要点",\n    "degree": "高"\n  }\n}\n\n对话：\n${dialogueText}`
            : builtInPrompt;

        const promptWithMemoryTags = customPrompt.replace(
            /"memoryPoints": "[^"]*",/,
            '"memoryTags": ["3-6个可单独触发的简短标签"],'
        );
        const finalSummaryGuard = friend.type === 'group'
            ? '\n\n最高优先级结构与隐私约束：只能总结当前群聊公开消息，禁止写入、推断或复述任何群成员私信及好友私聊内容。不能修改 JSON 字段，只输出可解析 JSON。'
            : '\n\n最高优先级结构约束：不能修改 JSON 字段，只输出可解析 JSON。';
        const customPriorityReminder = customSummaryPrompt
            ? '\n除上述结构、真实时间和群聊隐私约束外，总结内容必须完全服从 <user_summary_instructions>，禁止恢复内置的字数、感官、人称或表达风格要求。'
            : '';
        const promptWithMemoryTriggers = `${promptWithMemoryTags}\n\n标签规则：summary.memoryTags 是唯一的短期记忆召回字段，必须输出 3-6 个 2-16 字的简短具体标签；任意单个标签都应能独立触发对应记忆。群聊标签只能来自公开内容。${customPriorityReminder}${finalSummaryGuard}`;
        const endpoint = normalizeSummaryApiEndpoint(currentApiConfig);
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentApiConfig.apiKey}` },
            body: JSON.stringify({
                model: currentApiConfig.model || '',
                messages: [
                    { role: 'system', content: '你只输出可解析 JSON。' },
                    { role: 'user', content: promptWithMemoryTriggers }
                ],
                temperature: parseFloat(currentApiConfig.temperature ?? currentApiConfig.temp) || 0.7
            })
        });

        if (!response.ok) {
            const apiError = window.u2Api?.readApiError
                ? await window.u2Api.readApiError(response)
                : { status: response.status, statusText: response.statusText || '', message: response.statusText || '' };
            throw createSummaryFailureError({
                kind: 'http',
                status: apiError.status || response.status,
                message: apiError.message || apiError.statusText || ''
            });
        }

        let data;
        try {
            data = await response.json();
        } catch (error) {
            throw createSummaryFailureError({ kind: 'response_format' });
        }
        const responseContent = getSummaryResponseContent(data);
        if (isManualSingleChatSummary && !String(responseContent || '').trim()) {
            throw createSummaryFailureError({ kind: 'response_format' });
        }
        const summary = parseManualSummary(responseContent);
        summary.id = `stm-${Date.now()}`;
        summary.time = eventTime;
        summary.degree = '高';
        summary.sourceCount = sourceMessages.length;
        summary.sourceRoundCount = batch.selectedRounds;
        summary.sourceStartMessageCount = batch.startIndex;
        summary.sourceEndMessageCount = batch.endIndex;
        return summary;
    }

    function refreshSummaryModal(friend) {
        if (!friend) return null;
        friend.memory = window.imApp.normalizeFriendData(friend).memory;
        const roundLimit = friend.memory.summary?.roundLimit || 30;
        const batch = getChatSummaryBatch(friend, roundLimit);
        if (manualSummaryUnsummarizedCount) {
            manualSummaryUnsummarizedCount.textContent = `${batch.availableRounds}轮 / ${batch.unsummarizedMessageCount}条`;
        }
        if (manualSummaryBatchCount) {
            manualSummaryBatchCount.textContent = `${batch.selectedRounds}轮 / ${batch.selectedMessageCount}条`;
        }
        if (manualSummaryCountInput) manualSummaryCountInput.value = String(batch.selectedMessageCount);
        if (autoSummaryToggle) autoSummaryToggle.checked = !!friend.memory.summary?.enabled;
        if (summaryRoundInput) summaryRoundInput.value = String(roundLimit);
        refreshSummaryApiSelect(friend);
        if (summaryPromptInput) summaryPromptInput.value = friend.memory.summary?.prompt || '';
        if (summaryHint) {
            summaryHint.textContent = autoSummaryToggle?.checked
                ? `开启后每 ${roundLimit} 轮自动总结一次；已有记录将在下一次 AI 回复后检查`
                : `开启后每 ${roundLimit} 轮自动总结一次`;
        }
        if (manualSummaryConfirm) {
            manualSummaryConfirm.disabled = batch.selectedMessageCount === 0;
            manualSummaryConfirm.textContent = batch.selectedMessageCount > 0
                ? `立即总结 ${batch.selectedMessageCount} 条`
                : '暂无可总结对话';
        }
        return batch;
    }

    async function persistSummarySettings(friend) {
        if (!friend) return false;
        const roundLimit = window.imDataUtils?.normalizeRoundLimit
            ? window.imDataUtils.normalizeRoundLimit(summaryRoundInput?.value, 30)
            : Math.max(1, Math.round(Number(summaryRoundInput?.value) || 30));
        const saved = await commitNamedFriendChange(friend, (targetFriend) => {
            targetFriend.memory = window.imApp.normalizeFriendData(targetFriend).memory;
            targetFriend.memory.summary = {
                ...targetFriend.memory.summary,
                enabled: !!autoSummaryToggle?.checked,
                roundLimit,
                apiPresetId: String(summaryApiSelect?.value || ''),
                prompt: String(summaryPromptInput?.value || '').trim()
            };
        }, { silent: true, immediate: true });
        if (saved) {
            const latestFriend = window.imData.friends.find(item => String(item.id) === String(friend.id)) || friend;
            if (window.imData.currentSettingsFriend && String(window.imData.currentSettingsFriend.id) === String(friend.id)) {
                window.imData.currentSettingsFriend = latestFriend;
            }
            refreshSummaryModal(latestFriend);
        }
        return saved;
    }

    async function commitGeneratedSummary(friend, summary) {
        if (!friend || !summary) return false;
        return commitNamedFriendChange(friend, (targetFriend) => {
            if (window.imApp.applyGeneratedShortTermMemory) {
                window.imApp.applyGeneratedShortTermMemory(targetFriend, summary, {
                    activatedEntryIds: summary.activatedEntryIds,
                    updateSummaryCursor: true
                });
                return;
            }
            targetFriend.memory = window.imApp.normalizeFriendData(targetFriend).memory;
            if (!Array.isArray(targetFriend.memory.shortTermEntries)) targetFriend.memory.shortTermEntries = [];
            const now = new Date();
            const nowString = `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const activatedIds = new Set(Array.isArray(summary.activatedEntryIds) ? summary.activatedEntryIds.map(String) : []);
            targetFriend.memory.shortTermEntries.forEach(entry => {
                if (entry && activatedIds.has(String(entry.id))) {
                    entry.degree = '高';
                    entry.lastActivatedAt = nowString;
                }
            });
            decayShortTermMemoryEntries(targetFriend.memory.shortTermEntries, now, activatedIds);
            summary.lastActivatedAt = nowString;
            targetFriend.memory.shortTermEntries.push(summary);
            targetFriend.memory.lastSummaryMessageCount = Number(summary.sourceEndMessageCount)
                || (Array.isArray(targetFriend.messages) ? targetFriend.messages.length : 0);
        }, { silent: true, immediate: true });
    }

    async function runChatSummary(friend, options = {}) {
        if (!friend) return false;
        const friendId = String(friend.id);
        if (summaryInFlight.has(friendId)) return false;
        if (window.imApp.ensureFriendMessagesLoaded) await window.imApp.ensureFriendMessagesLoaded(friend);
        friend = window.imData.friends.find(item => String(item.id) === friendId) || friend;
        friend.memory = window.imApp.normalizeFriendData(friend).memory;
        const isGroupSummary = friend.type === 'group';
        const roundLimit = friend.memory.summary?.roundLimit || 30;
        const batch = getChatSummaryBatch(friend, roundLimit);
        if (options.auto && (!friend.memory.summary?.enabled || !batch.ready)) return false;
        if (batch.selectedMessageCount === 0) return false;

        summaryInFlight.add(friendId);
        try {
            const summary = await generateChatSummary(friend, {
                roundLimit,
                requireFullBatch: !!options.auto,
                silent: !!options.auto
            });
            if (!summary) return false;
            const saved = await commitGeneratedSummary(friend, summary);
            if (!saved) {
                if (!isGroupSummary && !options.auto) {
                    throw createSummaryFailureError({ kind: 'persistence' });
                }
                throw new Error('summary persistence failed');
            }
            const latestFriend = window.imData.friends.find(item => String(item.id) === friendId) || friend;
            latestFriend.memory = window.imApp.normalizeFriendData(latestFriend).memory;
            if (window.imData.currentSettingsFriend && String(window.imData.currentSettingsFriend.id) === friendId) {
                window.imData.currentSettingsFriend = latestFriend;
                refreshSummaryModal(latestFriend);
            }
            if (window.imApp.renderMemoryView) window.imApp.renderMemoryView();
            if (isGroupSummary) {
                if (window.imApp.renderGroupSummaryMorePanel) window.imApp.renderGroupSummaryMorePanel(latestFriend);
                window.dispatchEvent(new CustomEvent('u2:group-summary-updated', {
                    detail: { groupId: friendId }
                }));
            } else {
                window.dispatchEvent(new CustomEvent('u2:memory-entries-updated', {
                    detail: {
                        friendId,
                        action: 'upsert',
                        collection: 'shortTermEntries',
                        entryId: String(summary.id || '')
                    }
                }));
            }
            showToast(options.auto
                ? `已自动总结 ${summary.sourceRoundCount || roundLimit} 轮${isGroupSummary ? '群聊' : '对话'}`
                : (isGroupSummary ? '群聊总结已存入 More' : '总结已存入短期记忆'));
            return true;
        } catch (error) {
            if (!isGroupSummary && !options.auto) {
                const failure = logManualSingleSummaryFailure(friend, error);
                showToast(`总结失败：${failure.message}`);
            } else {
                console.error(options.auto ? 'Auto summary failed' : 'Manual summary failed', error);
                showToast(options.auto ? '自动总结失败，将在下次回复后重试' : '总结生成失败');
            }
            return false;
        } finally {
            summaryInFlight.delete(friendId);
        }
    }

    async function openManualSummaryModal(friend) {
        if (!friend || !manualSummaryModal) return;
        if (window.imApp.ensureFriendMessagesLoaded) await window.imApp.ensureFriendMessagesLoaded(friend);
        friend = window.imData.friends.find(item => String(item.id) === String(friend.id)) || friend;
        window.imData.currentSettingsFriend = friend;
        refreshSummaryModal(friend);
        openView(manualSummaryModal);
    }

    window.imChat = window.imChat || {};
    window.imChat.openManualSummaryModal = openManualSummaryModal;

    if (manualSummaryBtn) {
        manualSummaryBtn.addEventListener('click', () => {
            if (window.imData.currentSettingsFriend) {
                openManualSummaryModal(window.imData.currentSettingsFriend);
            }
        });
    }

    if (manualSummaryClose && manualSummaryModal) {
        manualSummaryClose.addEventListener('click', () => closeView(manualSummaryModal));
    }

    if (autoSummaryToggle) {
        autoSummaryToggle.addEventListener('change', () => {
            const friend = window.imData.currentSettingsFriend;
            if (friend) void persistSummarySettings(friend);
        });
    }

    if (summaryRoundInput) {
        summaryRoundInput.addEventListener('input', () => {
            const friend = window.imData.currentSettingsFriend;
            if (!friend) return;
            const draftFriend = {
                ...friend,
                memory: {
                    ...friend.memory,
                    summary: {
                        ...friend.memory?.summary,
                        roundLimit: summaryRoundInput.value,
                        apiPresetId: String(summaryApiSelect?.value || ''),
                        prompt: String(summaryPromptInput?.value || '')
                    }
                }
            };
            refreshSummaryModal(draftFriend);
        });
        summaryRoundInput.addEventListener('change', () => {
            const friend = window.imData.currentSettingsFriend;
            if (friend) void persistSummarySettings(friend);
        });
    }

    summaryApiSelect?.addEventListener('change', () => {
        const friend = window.imData.currentSettingsFriend;
        if (friend) void persistSummarySettings(friend);
    });

    summaryPromptInput?.addEventListener('blur', () => {
        const friend = window.imData.currentSettingsFriend;
        if (friend) void persistSummarySettings(friend);
    });

    summaryPromptClear?.addEventListener('click', () => {
        if (summaryPromptInput) summaryPromptInput.value = '';
        const friend = window.imData.currentSettingsFriend;
        if (friend) void persistSummarySettings(friend);
    });

    window.addEventListener('u2:api-presets-updated', () => {
        const friend = window.imData.currentSettingsFriend;
        if (friend && manualSummaryModal?.classList.contains('active')) refreshSummaryApiSelect(friend);
    });

    if (autonomousBtn) {
        autonomousBtn.addEventListener('click', () => {
            if (window.imData.currentSettingsFriend) {
                openAutonomousActivitySheet(window.imData.currentSettingsFriend);
            }
        });
    }

    if (autonomousClose && autonomousSheet) {
        autonomousClose.addEventListener('click', () => {
            if (window.closeView) window.closeView(autonomousSheet);
        });
    }

    if (autonomousSheet) {
        autonomousSheet.addEventListener('click', (event) => {
            if (event.target === autonomousSheet && window.closeView) {
                window.closeView(autonomousSheet);
            }
        });
    }

    if (autonomousToggle) {
        autonomousToggle.addEventListener('change', () => {
            setAutonomousCardExpanded(autonomousToggle, autonomousToggle.checked);
            if (autonomousNextLabel) {
                autonomousNextLabel.textContent = autonomousToggle.checked
                    ? '保存后将按当前间隔随机触发'
                    : '关闭后不会主动发消息';
            }
        });
    }

    if (autonomousMomentToggle) {
        autonomousMomentToggle.addEventListener('change', () => {
            setAutonomousCardExpanded(autonomousMomentToggle, autonomousMomentToggle.checked);
            if (autonomousMomentNextLabel) {
                autonomousMomentNextLabel.textContent = autonomousMomentToggle.checked
                    ? '保存后将按当前间隔随机发朋友圈'
                    : '关闭后不会自动发朋友圈';
            }
        });
    }

    if (autonomousSaveBtn) {
        autonomousSaveBtn.addEventListener('click', saveAutonomousActivitySettings);
    }

    if (manualSummaryConfirm) {
        manualSummaryConfirm.addEventListener('click', async () => {
            let friend = window.imData.currentSettingsFriend;
            if (!friend) return;
            manualSummaryConfirm.disabled = true;
            manualSummaryConfirm.classList.add('is-loading');
            manualSummaryConfirm.textContent = '正在总结...';
            showToast('正在总结对话...');
            try {
                const settingsSaved = await persistSummarySettings(friend);
                if (!settingsSaved) {
                    const failure = getSummaryFailureClassification({ kind: 'settings_persistence' });
                    console.error('Manual single-chat summary settings save failed', {
                        friendId: String(friend.id || ''),
                        apiPresetId: String(friend.memory?.summary?.apiPresetId || ''),
                        category: failure.code,
                        status: failure.status || 0,
                        message: failure.message
                    });
                    showToast(`总结失败：${failure.message}`);
                    return;
                }
                friend = window.imData.friends.find(item => String(item.id) === String(friend.id)) || friend;
                const saved = await runChatSummary(friend, { auto: false });
                if (saved) closeView(manualSummaryModal);
            } catch (error) {
                const failure = getSummaryFailureClassification({ kind: 'settings_persistence' });
                console.error('Manual single-chat summary settings save failed', {
                    friendId: String(friend?.id || ''),
                    apiPresetId: String(friend?.memory?.summary?.apiPresetId || ''),
                    category: failure.code,
                    status: failure.status || 0,
                    message: failure.message
                });
                showToast(`总结失败：${failure.message}`);
            } finally {
                manualSummaryConfirm.disabled = false;
                manualSummaryConfirm.classList.remove('is-loading');
                const latestFriend = window.imData.friends.find(item => String(item.id) === String(friend.id)) || friend;
                refreshSummaryModal(latestFriend);
            }
        });
    }

    window.imChat = window.imChat || {};
    window.imChat.maybeAutoSummarize = async function maybeAutoSummarize(friendOrId) {
        const friendId = friendOrId && typeof friendOrId === 'object' ? friendOrId.id : friendOrId;
        const friend = (window.imData.friends || []).find(item => String(item.id) === String(friendId))
            || (friendOrId && typeof friendOrId === 'object' ? friendOrId : null);
        return runChatSummary(friend, { auto: true });
    };

    function refreshChatSettingsHeader(friend) {
        const settingsAvatarImg = document.getElementById('chat-settings-avatar-img');
        const settingsAvatarIcon = document.getElementById('chat-settings-avatar-icon');
        const settingsName = document.getElementById('chat-settings-name');

        if (friend.avatarUrl) {
            if (settingsAvatarImg) {
                settingsAvatarImg.src = friend.avatarUrl;
                settingsAvatarImg.style.display = 'block';
            }
            if (settingsAvatarIcon) settingsAvatarIcon.style.display = 'none';
        } else {
            if (settingsAvatarImg) {
                settingsAvatarImg.style.display = 'none';
                settingsAvatarImg.src = '';
            }
            if (settingsAvatarIcon) settingsAvatarIcon.style.display = 'block';
        }

        if (settingsName) settingsName.textContent = friend.nickname;
    }

    function initChatSettingsForFriend(friend) {
        if (!friend) return null;
        friend = window.imApp.getFriendById?.(friend) || friend;
        window.imData.currentSettingsFriend = friend;
        friend.memory = window.imApp.normalizeFriendData(friend).memory;
        isRelationshipPickerVisible = false;
        relationshipPickerType = 'all';
        tempRelationshipDrafts = (friend.memory.relationships || []).map(rel => ({
            npcId: getRelationshipTargetId(rel),
            targetType: rel.targetType || getRelationshipTarget(rel)?.type,
            relation: rel.relation || '',
            offsetX: rel.offsetX,
            offsetY: rel.offsetY
        }));
        initChatSettingsInteractions();
        setActiveChatSettingsTab('info');
        refreshChatSettingsHeader(friend);
        if (window.imApp.refreshChatThemePresetUi) {
            window.imApp.refreshChatThemePresetUi(friend);
        }


        const chatMemoryOverviewInput = document.getElementById('chat-memory-overview-input');
        const chatMemoryContextEnabled = document.getElementById('chat-memory-context-enabled-toggle');
        const chatMemoryContextLimit = document.getElementById('chat-memory-context-limit-input');
        const chatMemoryCherishedInput = document.getElementById('chat-memory-cherished-input');
        const chatMemoryScheduleSleep = document.getElementById('chat-memory-schedule-sleep-input');
        const chatMemoryScheduleWake = document.getElementById('chat-memory-schedule-wake-input');

        if (chatMemoryOverviewInput) chatMemoryOverviewInput.value = friend.memory.overview || '';
        if (chatMemoryContextEnabled) chatMemoryContextEnabled.checked = typeof friend.memory.context.enabled === 'boolean' ? friend.memory.context.enabled : true;
        if (chatMemoryContextLimit) chatMemoryContextLimit.value = friend.memory.context.limit || 50;
        if (chatMemoryScheduleSleep) chatMemoryScheduleSleep.value = friend.memory.schedule ? (friend.memory.schedule.sleepTime || '23:00') : '23:00';
        if (chatMemoryScheduleWake) chatMemoryScheduleWake.value = friend.memory.schedule ? (friend.memory.schedule.wakeTime || '07:00') : '07:00';

        bindChatSettingsMemoryPersistence();
        updateAutonomousActivityControls(friend);
        updateChatBindIdLabel(friend);

        const tsToggle = document.getElementById('timestamp-toggle');
        const tsPositionBody = document.getElementById('timestamp-position-body');
        const tsPositionSelect = document.getElementById('timestamp-position-select');
        const chatAvatarToggle = document.getElementById('chat-avatar-toggle');
        const chatLanguageSelect = document.getElementById('chat-language-select');
        const chatCustomLanguageRow = document.getElementById('chat-custom-language-row');
        const chatCustomLanguageInput = document.getElementById('chat-custom-language-input');
        const chatMessageCountMinInput = document.getElementById('chat-message-count-min-input');
        const chatMessageCountMaxInput = document.getElementById('chat-message-count-max-input');
        const chatTimeAwareToggle = document.getElementById('chat-time-aware-toggle');
        const chatRoleRecallToggle = document.getElementById('chat-role-recall-toggle');
        const chatAutoExpandTranslationToggle = document.getElementById('chat-auto-expand-translation-toggle');
        const chatTtsEnabledToggle = document.getElementById('chat-tts-enabled-toggle');
        const chatTtsBody = document.getElementById('chat-tts-settings-body');
        const chatTtsVoiceInput = document.getElementById('chat-tts-voice-id-input');
        const chatTtsSpeedInput = document.getElementById('chat-tts-speed-input');
        
        if (chatAvatarToggle) {
            chatAvatarToggle.checked = !!friend.showAvatar;
        }

        if (chatLanguageSelect) {
            const language = String(friend.language || 'zh').trim() || 'zh';
            const standardLanguages = new Set(['zh', 'ko', 'ja', 'en', 'fr', 'yue', 'ru']);
            const isCustomLanguage = !standardLanguages.has(language);
            chatLanguageSelect.value = isCustomLanguage ? '__custom__' : language;
            if (chatCustomLanguageRow) chatCustomLanguageRow.style.display = isCustomLanguage ? 'flex' : 'none';
            if (chatCustomLanguageInput) chatCustomLanguageInput.value = isCustomLanguage ? language : '';
        }

        const messageRange = window.imDataUtils?.normalizeChatMessageRange
            ? window.imDataUtils.normalizeChatMessageRange(friend.messageCountMin, friend.messageCountMax, 2, 8)
            : { min: 2, max: 8 };
        if (chatMessageCountMinInput) chatMessageCountMinInput.value = String(messageRange.min);
        if (chatMessageCountMaxInput) chatMessageCountMaxInput.value = String(messageRange.max);

        if (chatTimeAwareToggle) {
            chatTimeAwareToggle.checked = friend.timeAware !== false;
        }

        if (chatRoleRecallToggle) {
            chatRoleRecallToggle.checked = friend.allowRoleRecall !== false;
        }
        if (chatAutoExpandTranslationToggle) {
            chatAutoExpandTranslationToggle.checked = friend.autoExpandTranslation === true;
        }
        renderChatCotSettings(friend);

        const ttsVoice = friend.ttsVoice && typeof friend.ttsVoice === 'object'
            ? friend.ttsVoice
            : (friend.minimaxVoice && typeof friend.minimaxVoice === 'object' ? friend.minimaxVoice : {});
        if (chatTtsEnabledToggle) {
            chatTtsEnabledToggle.checked = !!ttsVoice.enabled;
        }
        if (chatTtsBody) {
            chatTtsBody.style.display = ttsVoice.enabled ? 'block' : 'none';
        }
        if (chatTtsVoiceInput) {
            chatTtsVoiceInput.value = ttsVoice.voiceId || '';
        }
        if (chatTtsSpeedInput) {
            chatTtsSpeedInput.value = ttsVoice.speed || 1;
        }

        if (tsToggle) {
            tsToggle.checked = !!friend.showTimestamp;
            if (tsPositionBody) {
                tsPositionBody.style.display = 'flex';
            }
            if (tsPositionSelect) {
                tsPositionSelect.value = friend.timestampPosition || 'inside';
            }
        }

        updateStatusBarBtnCount(friend);

        // Update stickers count display
        
        return friend;
    }

    function refreshNpcSettingsHeader(friend) {
        const avatarImg = document.getElementById('npc-chat-settings-avatar-img');
        const avatarIcon = document.getElementById('npc-chat-settings-avatar-icon');
        const nameEl = document.getElementById('npc-chat-settings-name');

        if (friend && friend.avatarUrl) {
            if (avatarImg) {
                avatarImg.src = friend.avatarUrl;
                avatarImg.style.display = 'block';
            }
            if (avatarIcon) avatarIcon.style.display = 'none';
        } else {
            if (avatarImg) {
                avatarImg.style.display = 'none';
                avatarImg.src = '';
            }
            if (avatarIcon) avatarIcon.style.display = 'flex';
        }

        if (nameEl) nameEl.textContent = friend?.nickname || 'NPC';
    }

    function updateCurrentSettingsChatPageState(friend) {
        if (!friend) return;
        const page = document.getElementById(`chat-interface-${friend.id}`);
        if (!page) return;

        page.classList.toggle('show-timestamps', !!friend.showTimestamp);
        page.classList.toggle('timestamp-outside', !!friend.showTimestamp && friend.timestampPosition === 'outside');
    }

    function initNpcChatSettingsForFriend(friend) {
        if (!friend) return null;
        window.imData.currentSettingsFriend = friend;
        friend.memory = window.imApp.normalizeFriendData(friend).memory;
        refreshNpcSettingsHeader(friend);

        const tsToggle = document.getElementById('npc-timestamp-toggle');
        const tsPositionBody = document.getElementById('npc-timestamp-position-body');
        const tsPositionSelect = document.getElementById('npc-timestamp-position-select');
        const avatarToggle = document.getElementById('npc-chat-avatar-toggle');

        if (avatarToggle) {
            avatarToggle.checked = !!friend.showAvatar;
        }

        if (tsToggle) {
            tsToggle.checked = !!friend.showTimestamp;
            if (tsPositionBody) {
                tsPositionBody.style.display = 'flex';
            }
            if (tsPositionSelect) {
                tsPositionSelect.value = friend.timestampPosition || 'inside';
            }
        }

        initNpcChatSettingsInteractions();
        return friend;
    }

    function openNpcChatSettingsForFriend(friend) {
        const initializedFriend = initNpcChatSettingsForFriend(friend);
        if (!initializedFriend || !npcChatSettingsSheet) return;

        if (window.openView) {
            window.openView(npcChatSettingsSheet);
        } else {
            npcChatSettingsSheet.classList.add('active');
        }
    }

    function openChatSettingsForFriend(friend) {
        const latestFriend = window.imApp.getFriendById
            ? (window.imApp.getFriendById(friend) || friend)
            : friend;

        if (latestFriend && latestFriend.type === 'npc') {
            openNpcChatSettingsForFriend(latestFriend);
            return;
        }

        void persistProfileStatusMigration(latestFriend);

        const initializedFriend = initChatSettingsForFriend(latestFriend);
        if (!initializedFriend || !chatSettingsSheet) return;

        if (window.openView) {
            window.openView(chatSettingsSheet);
        } else {
            chatSettingsSheet.classList.add('active');
        }
    }
    
    const tsToggle = document.getElementById('timestamp-toggle');
    const tsPositionBody = document.getElementById('timestamp-position-body');
    const tsPositionSelect = document.getElementById('timestamp-position-select');

    if (tsToggle && tsToggle.dataset.bound !== 'true') {
        tsToggle.dataset.bound = 'true';
        tsToggle.addEventListener('change', async (e) => {
            if (window.imData.currentSettingsFriend) {
                const previousValue = !!window.imData.currentSettingsFriend.showTimestamp;
                const nextValue = e.target.checked;

                const saved = await commitSettingsFriendChange((targetFriend) => {
                    targetFriend.showTimestamp = nextValue;
                }, { silent: true });

                if (!saved) {
                    e.target.checked = previousValue;
                    showToast('时间戳设置保存失败');
                    return;
                }
                
                updateCurrentSettingsChatPageState(window.imData.currentSettingsFriend);
            }
        });
    }

    if (tsPositionSelect && tsPositionSelect.dataset.bound !== 'true') {
        tsPositionSelect.dataset.bound = 'true';
        tsPositionSelect.addEventListener('change', async (e) => {
            if (window.imData.currentSettingsFriend) {
                const previousValue = window.imData.currentSettingsFriend.timestampPosition || 'inside';
                const nextValue = e.target.value;
                const saved = await commitSettingsFriendChange((targetFriend) => {
                    targetFriend.timestampPosition = nextValue;
                }, { silent: true });

                if (!saved) {
                    e.target.value = previousValue;
                    showToast('时间戳位置保存失败');
                    return;
                }
                
                updateCurrentSettingsChatPageState(window.imData.currentSettingsFriend);
            }
        });
    }

    const npcTsToggle = document.getElementById('npc-timestamp-toggle');
    const npcTsPositionBody = document.getElementById('npc-timestamp-position-body');
    const npcTsPositionSelect = document.getElementById('npc-timestamp-position-select');
    
    if (npcTsToggle && npcTsToggle.dataset.bound !== 'true') {
        npcTsToggle.dataset.bound = 'true';
        npcTsToggle.addEventListener('change', async (e) => {
            if (window.imData.currentSettingsFriend) {
                const previousValue = !!window.imData.currentSettingsFriend.showTimestamp;
                const nextValue = e.target.checked;
                const saved = await commitSettingsFriendChange((targetFriend) => {
                    targetFriend.showTimestamp = nextValue;
                }, { silent: true });

                if (!saved) {
                    e.target.checked = previousValue;
                    showToast('时间戳设置保存失败');
                    return;
                }
                
                updateCurrentSettingsChatPageState(window.imData.currentSettingsFriend);
            }
        });
    }

    if (npcTsPositionSelect && npcTsPositionSelect.dataset.bound !== 'true') {
        npcTsPositionSelect.dataset.bound = 'true';
        npcTsPositionSelect.addEventListener('change', async (e) => {
            if (window.imData.currentSettingsFriend) {
                const previousValue = window.imData.currentSettingsFriend.timestampPosition || 'inside';
                const nextValue = e.target.value;
                const saved = await commitSettingsFriendChange((targetFriend) => {
                    targetFriend.timestampPosition = nextValue;
                }, { silent: true });

                if (!saved) {
                    e.target.value = previousValue;
                    showToast('时间戳位置保存失败');
                    return;
                }
                
                updateCurrentSettingsChatPageState(window.imData.currentSettingsFriend);
            }
        });
    }

    const chatLanguageSelect = document.getElementById('chat-language-select');
    const chatCustomLanguageRow = document.getElementById('chat-custom-language-row');
    const chatCustomLanguageInput = document.getElementById('chat-custom-language-input');
    const standardChatLanguages = new Set(['zh', 'ko', 'ja', 'en', 'fr', 'yue', 'ru']);
    if (chatLanguageSelect) {
        chatLanguageSelect.addEventListener('change', async (e) => {
            if (window.imData.currentSettingsFriend) {
                const previousValue = window.imData.currentSettingsFriend.language || 'zh';
                const nextValue = e.target.value;

                if (nextValue === '__custom__') {
                    if (chatCustomLanguageRow) chatCustomLanguageRow.style.display = 'flex';
                    if (chatCustomLanguageInput) {
                        chatCustomLanguageInput.value = standardChatLanguages.has(previousValue) ? '' : previousValue;
                        chatCustomLanguageInput.focus();
                    }
                    return;
                }
                if (chatCustomLanguageRow) chatCustomLanguageRow.style.display = 'none';
                if (chatCustomLanguageInput) chatCustomLanguageInput.value = '';
                
                const saved = await commitSettingsFriendChange((targetFriend) => {
                    targetFriend.language = nextValue;
                }, { silent: true });

                if (!saved) {
                    e.target.value = previousValue;
                    showToast('语言设置保存失败');
                }
            }
        });
    }

    async function persistCustomChatLanguage() {
        const friend = window.imData.currentSettingsFriend;
        if (!friend || !chatCustomLanguageInput || chatLanguageSelect?.value !== '__custom__') return;
        const nextValue = String(chatCustomLanguageInput.value || '').trim();
        if (!nextValue) {
            showToast('请输入自定义语言');
            return;
        }
        const previousValue = friend.language || 'zh';
        const saved = await commitSettingsFriendChange((targetFriend) => {
            targetFriend.language = nextValue;
        }, { silent: true });
        if (!saved) {
            chatCustomLanguageInput.value = standardChatLanguages.has(previousValue) ? '' : previousValue;
            showToast('语言设置保存失败');
        }
    }

    chatCustomLanguageInput?.addEventListener('blur', () => void persistCustomChatLanguage());
    chatCustomLanguageInput?.addEventListener('change', () => void persistCustomChatLanguage());
    chatCustomLanguageInput?.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        chatCustomLanguageInput.blur();
    });

    const chatMessageCountMinInput = document.getElementById('chat-message-count-min-input');
    const chatMessageCountMaxInput = document.getElementById('chat-message-count-max-input');
    const clampChatMessageCount = value => Math.min(20, Math.max(1, Math.round(Number(value) || 1)));
    async function persistChatMessageRange(changedSide) {
        const friend = window.imData.currentSettingsFriend;
        if (!friend || !chatMessageCountMinInput || !chatMessageCountMaxInput) return;
        let min = clampChatMessageCount(chatMessageCountMinInput.value);
        let max = clampChatMessageCount(chatMessageCountMaxInput.value);
        if (min > max) {
            if (changedSide === 'min') max = min;
            else min = max;
        }
        chatMessageCountMinInput.value = String(min);
        chatMessageCountMaxInput.value = String(max);
        const previousRange = window.imDataUtils?.normalizeChatMessageRange
            ? window.imDataUtils.normalizeChatMessageRange(friend.messageCountMin, friend.messageCountMax, 2, 8)
            : { min: 2, max: 8 };
        const saved = await commitSettingsFriendChange((targetFriend) => {
            targetFriend.messageCountMin = min;
            targetFriend.messageCountMax = max;
        }, { silent: true });
        if (!saved) {
            chatMessageCountMinInput.value = String(previousRange.min);
            chatMessageCountMaxInput.value = String(previousRange.max);
            showToast('消息条数保存失败');
        }
    }

    chatMessageCountMinInput?.addEventListener('change', () => void persistChatMessageRange('min'));
    chatMessageCountMinInput?.addEventListener('blur', () => void persistChatMessageRange('min'));
    chatMessageCountMaxInput?.addEventListener('change', () => void persistChatMessageRange('max'));
    chatMessageCountMaxInput?.addEventListener('blur', () => void persistChatMessageRange('max'));

    const chatTimeAwareToggle = document.getElementById('chat-time-aware-toggle');
    if (chatTimeAwareToggle && chatTimeAwareToggle.dataset.bound !== 'true') {
        chatTimeAwareToggle.dataset.bound = 'true';
        chatTimeAwareToggle.addEventListener('change', async (e) => {
            if (window.imData.currentSettingsFriend) {
                const previousValue = window.imData.currentSettingsFriend.timeAware !== false;
                const nextValue = e.target.checked;
                
                const saved = await commitSettingsFriendChange((targetFriend) => {
                    targetFriend.timeAware = nextValue;
                }, { silent: true });

                if (!saved) {
                    e.target.checked = previousValue;
                    showToast('时间感知设置保存失败');
                }
            }
        });
    }

    const chatRoleRecallToggle = document.getElementById('chat-role-recall-toggle');
    if (chatRoleRecallToggle && chatRoleRecallToggle.dataset.bound !== 'true') {
        chatRoleRecallToggle.dataset.bound = 'true';
        chatRoleRecallToggle.addEventListener('change', async (e) => {
            if (window.imData.currentSettingsFriend) {
                const previousValue = window.imData.currentSettingsFriend.allowRoleRecall !== false;
                const nextValue = e.target.checked;

                const saved = await commitSettingsFriendChange((targetFriend) => {
                    targetFriend.allowRoleRecall = nextValue;
                }, { silent: true });

                if (!saved) {
                    e.target.checked = previousValue;
                    showToast('角色撤回设置保存失败');
                }
            }
        });
    }

    const chatAutoExpandTranslationToggle = document.getElementById('chat-auto-expand-translation-toggle');
    if (chatAutoExpandTranslationToggle && chatAutoExpandTranslationToggle.dataset.bound !== 'true') {
        chatAutoExpandTranslationToggle.dataset.bound = 'true';
        chatAutoExpandTranslationToggle.addEventListener('change', async (e) => {
            if (window.imData.currentSettingsFriend) {
                const previousValue = window.imData.currentSettingsFriend.autoExpandTranslation === true;
                const nextValue = e.target.checked;

                const saved = await commitSettingsFriendChange((targetFriend) => {
                    targetFriend.autoExpandTranslation = nextValue;
                }, { silent: true });

                if (!saved) {
                    e.target.checked = previousValue;
                    showToast('自动展开翻译设置保存失败');
                }
            }
        });
    }

    function getCurrentTtsVoiceSettings(friend) {
        if (!friend || typeof friend !== 'object') return { enabled: false, voiceId: '', speed: 1 };
        const source = friend.ttsVoice && typeof friend.ttsVoice === 'object'
            ? friend.ttsVoice
            : (friend.minimaxVoice && typeof friend.minimaxVoice === 'object' ? friend.minimaxVoice : {});
        return {
            enabled: source.enabled === true,
            voiceId: String(source.voiceId || '').trim(),
            speed: Math.max(0.5, Math.min(2, Number.parseFloat(source.speed) || 1))
        };
    }

    function syncChatTtsBodyVisibility(enabled) {
        const body = document.getElementById('chat-tts-settings-body');
        if (body) body.style.display = enabled ? 'block' : 'none';
    }

    const chatTtsEnabledToggle = document.getElementById('chat-tts-enabled-toggle');
    if (chatTtsEnabledToggle && chatTtsEnabledToggle.dataset.bound !== 'true') {
        chatTtsEnabledToggle.dataset.bound = 'true';
        chatTtsEnabledToggle.addEventListener('change', async (e) => {
            if (!window.imData.currentSettingsFriend) return;
            const previousSettings = { ...getCurrentTtsVoiceSettings(window.imData.currentSettingsFriend) };
            const nextValue = e.target.checked;

            syncChatTtsBodyVisibility(nextValue);
            const saved = await commitSettingsFriendChange((targetFriend) => {
                targetFriend.ttsVoice = {
                    ...getCurrentTtsVoiceSettings(targetFriend),
                    enabled: nextValue
                };
                delete targetFriend.minimaxVoice;
            }, { silent: true });

            if (!saved) {
                e.target.checked = !!previousSettings.enabled;
                syncChatTtsBodyVisibility(!!previousSettings.enabled);
                showToast('TTS 设置保存失败');
            }
        });
    }

    async function saveChatTtsField(field, value, inputEl, previousValue) {
        if (!window.imData.currentSettingsFriend) return;
        const saved = await commitSettingsFriendChange((targetFriend) => {
            targetFriend.ttsVoice = {
                ...getCurrentTtsVoiceSettings(targetFriend),
                [field]: value
            };
            delete targetFriend.minimaxVoice;
        }, { silent: true });

        if (!saved) {
            if (inputEl) inputEl.value = previousValue;
            showToast('TTS 设置保存失败');
        }
    }

    const chatTtsVoiceInput = document.getElementById('chat-tts-voice-id-input');
    if (chatTtsVoiceInput && chatTtsVoiceInput.dataset.bound !== 'true') {
        chatTtsVoiceInput.dataset.bound = 'true';
        chatTtsVoiceInput.addEventListener('change', async (e) => {
            const previousValue = getCurrentTtsVoiceSettings(window.imData.currentSettingsFriend).voiceId || '';
            await saveChatTtsField('voiceId', e.target.value.trim(), e.target, previousValue);
        });
    }

    const chatTtsSpeedInput = document.getElementById('chat-tts-speed-input');
    if (chatTtsSpeedInput && chatTtsSpeedInput.dataset.bound !== 'true') {
        chatTtsSpeedInput.dataset.bound = 'true';
        chatTtsSpeedInput.addEventListener('change', async (e) => {
            const previousValue = getCurrentTtsVoiceSettings(window.imData.currentSettingsFriend).speed || 1;
            const nextValue = Math.max(0.5, Math.min(2, parseFloat(e.target.value) || 1));
            e.target.value = nextValue;
            await saveChatTtsField('speed', nextValue, e.target, previousValue);
        });
    }

    const chatAvatarToggle = document.getElementById('chat-avatar-toggle');
    if (chatAvatarToggle) {
        chatAvatarToggle.addEventListener('change', async (e) => {
            if (window.imData.currentSettingsFriend) {
                const previousValue = !!window.imData.currentSettingsFriend.showAvatar;
                const nextValue = e.target.checked;
                
                const saved = await commitSettingsFriendChange((targetFriend) => {
                    targetFriend.showAvatar = nextValue;
                }, { silent: true });

                if (!saved) {
                    e.target.checked = previousValue;
                    showToast('头像设置保存失败');
                    return;
                }
                
                if (window.imChat && window.imChat.rerenderChatContainer) {
                    const friend = window.imData.currentSettingsFriend;
                    const page = document.getElementById(`chat-interface-${friend.id}`);
                    if (page) {
                        const msgContainer = page.querySelector('.ins-chat-messages');
                        if (msgContainer) window.imChat.rerenderChatContainer(friend, msgContainer, { scroll: false });
                    }
                }
            }
        });
    }

    const pinToggle = document.getElementById('chat-pinned-toggle');
    if (pinToggle) {
        pinToggle.addEventListener('change', async (e) => {
            if (window.imData.currentSettingsFriend) {
                const previousValue = !!window.imData.currentSettingsFriend.isPinned;
                const nextValue = e.target.checked;
                const saved = await commitSettingsFriendChange((targetFriend) => {
                    targetFriend.isPinned = nextValue;
                }, { silent: true });

                if (!saved) {
                    e.target.checked = previousValue;
                    showToast('置顶设置保存失败');
                    return;
                }

                if(window.imApp.renderChatsList) window.imApp.renderChatsList();
                showToast(window.imData.currentSettingsFriend.isPinned ? '已置顶' : '已取消置顶');
                
                const page = document.getElementById(`chat-interface-${window.imData.currentSettingsFriend.id}`);
                if (page) {
                    if (window.imData.currentSettingsFriend.isPinned) {
                        page.classList.add('pinned-chat');
                    } else {
                        page.classList.remove('pinned-chat');
                    }
                }
            }
        });
    }
    
    function initTimestampSetting(friend) {
        window.imData.currentSettingsFriend = friend;
    }

    function escapeCssAttributeValue(value) {
        return String(value ?? '')
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\r/g, '\\d ')
            .replace(/\n/g, '\\a ');
    }

    function scopeThemeCss(css, scope) {
        return window.imApp.scopeUserCss
            ? window.imApp.scopeUserCss(css, scope)
            : css.replace(/([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/ig, `${scope} ` + '$1$2');
    }

    function applyFriendCss(friend) {
        let styleTag = document.getElementById(`custom-style-${friend.id}`);
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = `custom-style-${friend.id}`;
            document.head.appendChild(styleTag);
        }

        let combinedCss = '';

        // 气泡 CSS
        if (friend.customCssEnabled && friend.customCss) {
            const prefix = `#chat-interface-${friend.id}`;
            const contextPrefix = `#msg-context-bubble-clone[data-current-friend-id="${escapeCssAttributeValue(friend.id)}"]`;
            combinedCss += scopeThemeCss(friend.customCss, prefix);
            combinedCss += '\n';
            combinedCss += scopeThemeCss(friend.customCss, contextPrefix);
            combinedCss += '\n';
        }

        // Chat CSS is owned by this friend, unlike the separate global Chat CSS editor.
        if (friend.chatCssEnabled && friend.chatCss) {
            const prefix = `#chat-interface-${friend.id}`;
            combinedCss += scopeThemeCss(friend.chatCss, prefix);
            combinedCss += '\n';
        }

        // Status CSS remains managed by Theme and is scoped to this chat page.
        if (friend.statusCssEnabled && friend.statusCss) {
            const prefix = `#chat-interface-${friend.id}`;
            combinedCss += scopeThemeCss(friend.statusCss, prefix);
            combinedCss += '\n';
        }
        
        if (styleTag.textContent !== combinedCss) styleTag.textContent = combinedCss;
    }
    
    async function applyAllSavedCss() {
        if (window.imApp.ensureDataReady) {
            await window.imApp.ensureDataReady();
        }

        if (Array.isArray(window.imData.friends)) {
            window.imData.friends.forEach(f => applyFriendCss(f));
        }
        if (window.imApp.applyGlobalChatCss) {
            window.imApp.applyGlobalChatCss(window.u2ThemeState || {});
        }
        window.imApp.applyGlobalGroupCss?.(window.u2ThemeState || {});
        window.imApp.applyGlobalHomeCss?.(window.u2ThemeState || {});
    }

    function restoreSavedCss() {
        applyAllSavedCss().catch((error) => {
            console.warn('Failed to restore saved iMessage CSS:', error);
        });
    }

    document.addEventListener('imessage-data-ready', restoreSavedCss);
    document.addEventListener('u2-theme-state-ready', restoreSavedCss);
    restoreSavedCss();

    const saveCssPresetBtn = document.getElementById('save-css-preset-btn');
    const loadCssPresetBtn = document.getElementById('load-css-preset-btn');
    const cssPresetListSheet = document.getElementById('css-preset-list-sheet');
    const cssPresetList = document.getElementById('css-preset-list');

    if (cssPresetListSheet) {
        cssPresetListSheet.addEventListener('click', (e) => {
            if (e.target === cssPresetListSheet) {
                closeView(cssPresetListSheet);
            }
        });
    }

    let cssPresets = Array.isArray(window.imData.cssPresets) ? window.imData.cssPresets : [];

    if (saveCssPresetBtn) {
        saveCssPresetBtn.addEventListener('click', () => {
            if (!window.imData.currentSettingsFriend) return;
            
            showCustomModal({
                type: 'prompt',
                title: '存为预设',
                placeholder: '输入预设名称',
                confirmText: '保存',
                onConfirm: (name) => {
                    if (name && name.trim()) {
                        cssPresets.push({ name: name.trim(), css: bubbleCssInput.value, id: Date.now() });
                        window.imData.cssPresets = cssPresets;
                        if (window.saveGlobalData) window.saveGlobalData();
                        showToast('预设已保存');
                    }
                }
            });
        });
    }

    if (loadCssPresetBtn) {
        loadCssPresetBtn.addEventListener('click', () => {
            renderCssPresetList();
            openView(cssPresetListSheet);
        });
    }

    function renderCssPresetList() {
        if (!cssPresetList) return;
        cssPresetList.innerHTML = '';
        if (cssPresets.length === 0) {
            cssPresetList.innerHTML = '<div style="padding: 20px; text-align: center; color: #8e8e93;">暂无预设</div>';
            return;
        }

        cssPresets.forEach(preset => {
            const item = document.createElement('div');
            item.className = 'account-card';
            item.innerHTML = `
                <div class="account-content" style="cursor: pointer;">
                    <div class="account-info">
                        <div class="account-name">${preset.name}</div>
                    </div>
                </div>
                <div class="delete-icon"><i class="fas fa-times"></i></div>
            `;

            item.querySelector('.account-content').addEventListener('click', () => {
                if (window.imData.currentSettingsFriend) {
                    bubbleCssInput.value = preset.css;
                    applyCssBtn.click();
                    closeView(cssPresetListSheet);
                }
            });

            item.querySelector('.delete-icon').addEventListener('click', (e) => {
                e.stopPropagation();
                cssPresets = cssPresets.filter(p => p.id !== preset.id);
                window.imData.cssPresets = cssPresets;
                if (window.saveGlobalData) window.saveGlobalData();
                renderCssPresetList();
            });

            cssPresetList.appendChild(item);
        });
    }

    // Expose Functions
    window.imApp.initChatSettingsForFriend = initChatSettingsForFriend;
    window.imApp.openChatSettingsForFriend = openChatSettingsForFriend;
    window.imApp.updateStatusBarBtnCount = updateStatusBarBtnCount;
    window.imApp.applyFriendBg = applyFriendBg;
    window.imApp.initTimestampSetting = initTimestampSetting;
    window.imApp.applyFriendCss = applyFriendCss;
    window.imApp.applyAllSavedCss = applyAllSavedCss;
    window.imApp.renderRelationshipSheet = renderRelationshipSheet;
    window.imApp.getBoundAccountByFriend = getBoundAccountByFriend;
    window.imApp.getEffectivePersonaForFriend = getEffectivePersonaForFriend;
    window.imApp.getFriendsBoundToAccount = getFriendsBoundToAccount;
    window.imApp.updateChatBindIdLabel = updateChatBindIdLabel;
    window.imApp.renderCherishedMemoryCards = renderCherishedMemoryCards;
    window.imApp.showCherishedMemoryDetail = showCherishedMemoryDetail;
    window.imApp.hideCherishedMemoryDetail = hideCherishedMemoryDetail;
    window.imApp.showChatMemoryModal = showChatMemoryModal;
    window.imApp.hideChatMemoryModal = hideChatMemoryModal;
});



