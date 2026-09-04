// ==========================================
// IMESSAGE: 3. CONTACTS & ADD FRIEND
// ==========================================

(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    const { openView, closeView, showToast } = window;

    // Add Friend Modal Buttons from Header
    const addCharBtn = document.getElementById('add-char-btn');
    const friendActionsSheet = document.getElementById('friend-actions-sheet');
    const openAddFriendSheetBtn = document.getElementById('open-add-friend-sheet-btn');
    const newFriendsBtn = document.getElementById('new-friends-btn');

    function resetAddFriendForm() {
        const friendRealName = document.getElementById('friend-realname-input');
        const friendNickname = document.getElementById('friend-nickname-input');
        const friendSignature = document.getElementById('friend-signature-input');
        const friendRelationship = document.getElementById('friend-relationship-input');
        const friendPersona = document.getElementById('friend-persona-input');

        if(friendRealName) friendRealName.value = '';
        if(friendNickname) friendNickname.value = '';
        if(friendSignature) friendSignature.value = '';
        if(friendRelationship) friendRelationship.value = '';
        if(friendPersona) friendPersona.value = '';
        
        setFriendAvatar(null);
    }

    async function commitContactsFriendChange(friendOrId, mutator, options = {}) {
        if (!window.imApp.commitFriendsChange) return false;
        const targetId = typeof friendOrId === 'object' && friendOrId !== null ? friendOrId.id : friendOrId;
        const commitOptions = {
            metaOnly: options.metaOnly !== false,
            ...options
        };

        return window.imApp.commitFriendsChange(() => {
            const targetFriend = window.imData.friends.find(
                item => String(item.id) === String(targetId)
            );
            if (!targetFriend) return;
            return mutator(targetFriend);
        }, commitOptions);
    }

    async function commitCurrentGroupChange(mutator, options = {}) {
        if (!currentViewingGroup || !window.imApp.commitFriendsChange) return false;

        const commitOptions = {
            metaOnly: options.metaOnly !== false,
            ...options
        };

        return window.imApp.commitFriendsChange(() => {
            const targetGroup = window.imData.friends.find(
                item => String(item.id) === String(currentViewingGroup.id)
            );
            if (!targetGroup) return;
            currentViewingGroup = targetGroup;
            if (window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(targetGroup.id)) {
                window.imData.currentActiveFriend = targetGroup;
            }
            return mutator(targetGroup);
        }, commitOptions);
    }

    function openAddFriendSheetDirectly() {
        resetAddFriendForm();
        const addFriendSheet = document.getElementById('add-friend-sheet');
        if (addFriendSheet) {
            if (typeof window.openView === 'function') {
                window.openView(addFriendSheet);
            } else {
                addFriendSheet.style.display = 'flex';
                const bottomSheet = addFriendSheet.querySelector('.bottom-sheet');
                if (bottomSheet) {
                    setTimeout(() => bottomSheet.style.transform = 'translateY(0)', 10);
                }
            }
        }
    }

    if(addCharBtn) {
        addCharBtn.addEventListener('click', () => {
            if (friendActionsSheet) {
                if (typeof window.openView === 'function') {
                    window.openView(friendActionsSheet);
                } else {
                    friendActionsSheet.style.display = 'flex';
                }
            } else {
                openAddFriendSheetDirectly();
            }
        });
    }

    if (openAddFriendSheetBtn) {
        openAddFriendSheetBtn.addEventListener('click', () => {
            if (friendActionsSheet && typeof window.closeView === 'function') {
                window.closeView(friendActionsSheet);
            } else if (friendActionsSheet) {
                friendActionsSheet.style.display = 'none';
            }
            openAddFriendSheetDirectly();
        });
    }

    if (newFriendsBtn) {
        newFriendsBtn.addEventListener('click', () => {
            if(window.showToast) window.showToast('新的朋友功能暂未开放');
        });
    }

    if (friendActionsSheet) {
        friendActionsSheet.addEventListener('click', (e) => {
            if (e.target === friendActionsSheet) {
                if (typeof window.closeView === 'function') window.closeView(friendActionsSheet);
                else friendActionsSheet.style.display = 'none';
            }
        });
    }

    // Avatar Upload Logic
    const friendAvatarWrapper = document.getElementById('friend-avatar-wrapper');
    if(friendAvatarWrapper) {
        friendAvatarWrapper.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') document.getElementById('friend-avatar-upload').click();
        });
    }

    const friendAvatarUpload = document.getElementById('friend-avatar-upload');
    if(friendAvatarUpload) {
        friendAvatarUpload.addEventListener('change', async (e) => {
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

                setFriendAvatar(nextAvatar);
            } catch (error) {
                console.error('Failed to process friend avatar', error);
                if (showToast) showToast('头像处理失败');
            }
        });
    }

    const friendProfileImportBtn = document.getElementById('friend-profile-import-btn');
    const friendProfileImportInput = document.getElementById('friend-profile-import-input');

    async function readFriendProfileFile(file) {
        const lowerName = String(file?.name || '').toLowerCase();
        if (lowerName.endsWith('.doc')) {
            throw new Error('暂不支持旧版 DOC，请另存为 DOCX 或 TXT 后导入');
        }
        if (lowerName.endsWith('.docx')) {
            await window.u2LoadVendorLibrary?.('mammoth');
            if (!window.mammoth?.extractRawText) {
                throw new Error('DOCX 解析组件未加载，请检查网络后重试');
            }
            const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
            return String(result?.value || '').replace(/\u0000/g, '').trim();
        }
        if (!lowerName.endsWith('.txt') && !lowerName.endsWith('.text')) {
            throw new Error('仅支持 TXT 和 DOCX 文件');
        }
        return String(await file.text()).replace(/\u0000/g, '').trim();
    }

    if (friendProfileImportBtn && friendProfileImportInput) {
        friendProfileImportBtn.addEventListener('click', () => friendProfileImportInput.click());
        friendProfileImportInput.addEventListener('change', async () => {
            const file = friendProfileImportInput.files?.[0];
            friendProfileImportInput.value = '';
            if (!file) return;

            try {
                const importedPersona = await readFriendProfileFile(file);
                if (!importedPersona) throw new Error('文件内容为空');

                const personaInput = document.getElementById('friend-persona-input');
                const nicknameInput = document.getElementById('friend-nickname-input');
                const fileBaseName = String(file.name || '')
                    .replace(/\.(?:txt|text|docx)$/i, '')
                    .trim();

                if (personaInput) personaInput.value = importedPersona;
                if (nicknameInput && fileBaseName) nicknameInput.value = fileBaseName;
                if (showToast) showToast('角色设定已导入，请确认后添加');
            } catch (error) {
                console.error('Failed to import friend profile', error);
                if (showToast) showToast(error?.message || '角色设定导入失败');
            }
        });
    }

    function setFriendAvatar(url) {
        const friendAvatarImg = document.getElementById('friend-avatar-img');
        const friendAvatarPreview = document.getElementById('friend-avatar-preview');
        const friendAvatarIcon = friendAvatarPreview ? friendAvatarPreview.querySelector('i') : null;

        if (!friendAvatarImg || !friendAvatarIcon) return;

        if (url) {
            friendAvatarImg.src = url;
            friendAvatarImg.style.display = 'block';
            friendAvatarIcon.style.display = 'none';
        } else {
            friendAvatarImg.style.display = 'none';
            friendAvatarIcon.style.display = 'block';
            friendAvatarImg.src = '';
        }
    }

    // Confirm Add Friend/NPC
    const confirmAddFriendBtn = document.getElementById('confirm-add-friend-btn');
    const confirmAddNpcBtn = document.getElementById('confirm-add-npc-btn');
    let isAddingFriend = false;
    let isAddingNpc = false;

    function setAddButtonBusy(button, busy) {
        if (!button) return;
        button.style.pointerEvents = busy ? 'none' : '';
        button.style.opacity = busy ? '0.65' : '';
    }

    if(confirmAddFriendBtn) {
        confirmAddFriendBtn.addEventListener('click', async () => {
            if (isAddingFriend) return;
            isAddingFriend = true;
            setAddButtonBusy(confirmAddFriendBtn, true);

            const friend = window.imApp.normalizeFriendData({
                id: Date.now(),
                type: 'char',
                realName: document.getElementById('friend-realname-input') ? document.getElementById('friend-realname-input').value : '',
                nickname: document.getElementById('friend-nickname-input') ? document.getElementById('friend-nickname-input').value || 'New Friend' : 'New Friend',
                signature: document.getElementById('friend-signature-input') ? document.getElementById('friend-signature-input').value || 'No Signature' : 'No Signature',
                persona: document.getElementById('friend-persona-input') ? document.getElementById('friend-persona-input').value : '',
                relationship: document.getElementById('friend-relationship-input') ? document.getElementById('friend-relationship-input').value : '',
                avatarUrl: (document.getElementById('friend-avatar-img') && document.getElementById('friend-avatar-img').style.display === 'block') ? document.getElementById('friend-avatar-img').src : null,
                messages: [],
                chatBg: null,
                customCssEnabled: false,
                customCss: '',
                isPinned: false,
                memory: window.imApp.createDefaultMemory()
            });

            const saved = window.imApp.commitFriendsChange
                ? await window.imApp.commitFriendsChange(() => {
                    window.imData.friends.push(friend);
                }, { friendId: friend.id, silent: true })
                : false;

            if (!saved) {
                isAddingFriend = false;
                setAddButtonBusy(confirmAddFriendBtn, false);
                if(window.showToast) window.showToast('添加 Char 保存失败');
                return;
            }

            renderFriendsList();
            isAddingFriend = false;
            setAddButtonBusy(confirmAddFriendBtn, false);
            closeView(document.getElementById('add-friend-sheet'));
            if(window.showToast) window.showToast(`已添加 Char: ${friend.nickname}`);
        });
    }

    if(confirmAddNpcBtn) {
        confirmAddNpcBtn.addEventListener('click', async () => {
            if (isAddingNpc) return;
            isAddingNpc = true;
            setAddButtonBusy(confirmAddNpcBtn, true);

            const npc = window.imApp.normalizeFriendData({
                id: Date.now(),
                type: 'npc',
                realName: document.getElementById('friend-realname-input') ? document.getElementById('friend-realname-input').value : '',
                nickname: document.getElementById('friend-nickname-input') ? document.getElementById('friend-nickname-input').value || 'New NPC' : 'New NPC',
                signature: document.getElementById('friend-signature-input') ? document.getElementById('friend-signature-input').value || 'No Signature' : 'No Signature',
                persona: document.getElementById('friend-persona-input') ? document.getElementById('friend-persona-input').value : '',
                relationship: document.getElementById('friend-relationship-input') ? document.getElementById('friend-relationship-input').value : '',
                avatarUrl: (document.getElementById('friend-avatar-img') && document.getElementById('friend-avatar-img').style.display === 'block') ? document.getElementById('friend-avatar-img').src : null,
                messages: [],
                chatBg: null,
                customCssEnabled: false,
                customCss: '',
                isPinned: false,
                memory: window.imApp.createDefaultMemory()
            });

            const saved = window.imApp.commitFriendsChange
                ? await window.imApp.commitFriendsChange(() => {
                    window.imData.friends.push(npc);
                }, { friendId: npc.id, silent: true })
                : false;

            if (!saved) {
                isAddingNpc = false;
                setAddButtonBusy(confirmAddNpcBtn, false);
                if(window.showToast) window.showToast('添加 NPC 保存失败');
                return;
            }

            renderFriendsList();
            closeView(document.getElementById('add-friend-sheet'));
            if(window.showToast) window.showToast(`已添加 NPC: ${npc.nickname}`);

            isAddingNpc = false;
            setAddButtonBusy(confirmAddNpcBtn, false);
        });
    }

    let lastFriendsListSnapshot = [];

    function getFriendsListRenderSnapshot() {
        return (window.imData.friends || [])
            .filter(friend => friend.type !== 'group')
            .map(friend => ({ friend, id: friend.id, type: friend.type, nickname: friend.nickname, avatarUrl: friend.avatarUrl || '' }));
    }

    function isSameFriendsListSnapshot(nextSnapshot) {
        return nextSnapshot.length === lastFriendsListSnapshot.length
            && nextSnapshot.every((row, index) => {
                const previous = lastFriendsListSnapshot[index];
                return previous
                    && previous.friend === row.friend
                    && previous.id === row.id
                    && previous.type === row.type
                    && previous.nickname === row.nickname
                    && previous.avatarUrl === row.avatarUrl;
            });
    }

    function renderFriendsList(options = {}) {
        const friendsContent = document.getElementById('friends-content');
        const npcsContent = document.getElementById('npcs-content');
        const nextSnapshot = getFriendsListRenderSnapshot();
        const renderedItemCount = (friendsContent?.children.length || 0) + (npcsContent?.children.length || 0);
        const isCurrent = renderedItemCount === nextSnapshot.length && isSameFriendsListSnapshot(nextSnapshot);
        if (!options.force && isCurrent) return false;
        
        if (friendsContent) friendsContent.innerHTML = '';
        if (npcsContent) npcsContent.innerHTML = '';
        
        window.imData.friends.forEach(friend => {
            if (friend.type === 'group') return; // Do not show groups in Friends/NPCs lists

            const item = document.createElement('div');
            item.className = 'line-list-item';
            
            const avatarHtml = friend.avatarUrl 
                ? `<img src="${friend.avatarUrl}" style="width:100%;height:100%;object-fit:cover;">` 
                : (friend.type === 'npc' ? `<i class="fas fa-robot"></i>` : `<i class="fas fa-user"></i>`);
                
            item.innerHTML = `
                <div class="line-item-avatar">${avatarHtml}</div>
                <div class="line-item-text">${friend.nickname}</div>
            `;
            
            item.addEventListener('click', () => {
                if(window.imApp.openChatTab) window.imApp.openChatTab(friend);
            });

            if (friend.type === 'npc') {
                if (npcsContent) npcsContent.appendChild(item);
            } else {
                if (friendsContent) friendsContent.appendChild(item);
            }
        });
        lastFriendsListSnapshot = nextSnapshot;
        return true;
    }

    window.imApp.renderFriendsList = renderFriendsList;

    // Initial render
    renderFriendsList();
});
