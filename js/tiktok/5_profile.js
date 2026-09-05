// ==========================================
// TIKTOK: 5. PROFILE TAB
// ==========================================

(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    // UI Elements
    const avatarImg = document.getElementById('tk-profile-avatar-img');
    const avatarIcon = document.getElementById('tk-profile-avatar-icon');
    const statusBubble = document.getElementById('tk-profile-status-bubble');
    const nameEl = document.getElementById('tk-profile-name');
    const handleEl = document.getElementById('tk-profile-handle');
    const bioEl = document.getElementById('tk-profile-bio');
    
    const statFollowing = document.getElementById('tk-stat-following');
    const statFollowers = document.getElementById('tk-stat-followers');
    const statLikes = document.getElementById('tk-stat-likes');
    
    const editBtn = document.getElementById('tk-profile-edit-btn');
    const visitorsBtn = document.getElementById('tk-profile-visitors-btn');
    const profileSettingsBtn = document.getElementById('tk-profile-settings-btn');
    const profileBackBtn = document.getElementById('tk-profile-back-btn');
    const editSheet = document.getElementById('tk-edit-profile-sheet');
    const saveProfileBtn = document.getElementById('tk-save-profile-btn');
    const tkAppView = document.getElementById('tiktok-view');
    const editCharSheet = document.getElementById('tk-edit-char-sheet');
    const subProfileEditTrigger = document.getElementById('tk-sub-profile-edit-trigger');
    
    // Edit Form Elements
    const editNameInput = document.getElementById('tk-edit-name');
    const editHandleInput = document.getElementById('tk-edit-handle');
    const editBioInput = document.getElementById('tk-edit-bio');
    const editPersonaInput = document.getElementById('tk-edit-persona');
    
    // Stats Form Elements
    const editFollowingInput = document.getElementById('tk-edit-following');
    const editFollowersInput = document.getElementById('tk-edit-followers');
    const editLikesInput = document.getElementById('tk-edit-likes');

    // Avatar Upload in Profile
    const avatarBtn = document.getElementById('tk-profile-avatar-btn');
    const avatarUpload = document.getElementById('tk-profile-avatar-upload');

    // Sub Profile Elements
    const subProfileView = document.getElementById('tk-sub-profile-view');
    const subProfileBackBtn = document.getElementById('tk-sub-profile-back-btn');
    const subProfileAvatarImg = document.getElementById('tk-sub-profile-avatar-img');
    const subProfileAvatarIcon = document.getElementById('tk-sub-profile-avatar-icon');
    const subProfileStatusBubble = document.getElementById('tk-sub-profile-status-bubble');
    const subProfileName = document.getElementById('tk-sub-profile-name');
    const subProfileHandle = document.getElementById('tk-sub-profile-handle');
    const subStatFollowing = document.getElementById('tk-sub-stat-following');
    const subStatFollowers = document.getElementById('tk-sub-stat-followers');
    const subStatLikes = document.getElementById('tk-sub-stat-likes');
    const subProfileBio = document.getElementById('tk-sub-profile-bio');
    const subProfileFollowBtn = document.getElementById('tk-sub-profile-follow-btn');
    const subProfileMsgBtn = document.getElementById('tk-sub-profile-msg-btn');
    const subProfileApiBtn = document.getElementById('tk-sub-profile-api-btn');
    const subProfileGrid = document.getElementById('tk-sub-profile-grid');
    
    let currentSubCharId = null;

    function tkProfileFormatCount(value) {
        return window.tkFormatCount ? window.tkFormatCount(value) : String(value || 0);
    }

    function tkProfileResolveAvatar(char) {
        if (!char) return '';
        return window.tkResolveAvatar
            ? window.tkResolveAvatar(char.id, char.name || char.handle, char.avatar)
            : (char.avatar || '');
    }

    function tkProfileEscape(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '\u0026amp;',
            '<': '\u0026lt;',
            '>': '\u0026gt;',
            '"': '\u0026quot;',
            "'": '\u0026#39;'
        }[char]));
    }

    function tkProfileToNumber(value) {
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
    }

    function tkApplyLocalUserPostStatBoost(post) {
        const followerDelta = Math.floor(Math.random() * 9) + 1;
        const likeDelta = Math.floor(Math.random() * 220) + 20;
        tkState.profile.followers = tkProfileToNumber(tkState.profile.followers) + followerDelta;
        tkState.profile.likes = tkProfileToNumber(tkState.profile.likes) + likeDelta;
        if (post) {
            post.likes = tkProfileToNumber(post.likes) + likeDelta;
        }
        return { followerDelta, likeDelta };
    }

    function tkProfileGetBoundWorldBookIds() {
        if (!tkState.settings || typeof tkState.settings !== 'object') tkState.settings = {};
        if (!Array.isArray(tkState.settings.boundWorldBookIds)) tkState.settings.boundWorldBookIds = [];
        return tkState.settings.boundWorldBookIds;
    }

    function tkProfileBoundWorldBookLabel() {
        const ids = new Set(tkProfileGetBoundWorldBookIds().map(id => String(id)));
        if (!ids.size) return '未挂载';
        const books = typeof window.getWorldBooks === 'function' ? window.getWorldBooks() : [];
        const names = (Array.isArray(books) ? books : [])
            .filter(book => book && ids.has(String(book.id)))
            .map(book => book.name || book.title || book.keyword || '世界书')
            .filter(Boolean);
        if (!names.length) return `${ids.size} 本`;
        if (names.length <= 2) return names.join('、');
        return `${names.slice(0, 2).join('、')} 等 ${names.length} 本`;
    }

    function tkProfileUpdateSettingsSheet(sheet) {
        const label = sheet?.querySelector('#tk-bound-worldbook-label');
        if (label) label.textContent = tkProfileBoundWorldBookLabel();
    }

    function tkEnsureProfileSettingsSheet() {
        let sheet = document.getElementById('tk-profile-settings-sheet');
        if (sheet) return sheet;

        sheet = document.createElement('div');
        sheet.id = 'tk-profile-settings-sheet';
        sheet.className = 'bottom-sheet-overlay detail-sheet-overlay';
        sheet.innerHTML = `
            <div class="bottom-sheet" style="background: #ffffff;">
                <div class="sheet-handle"></div>
                <div class="sheet-title">TikTok 设置</div>
                <div class="detail-sheet-content" style="padding: 10px 16px 24px; background: #ffffff;">
                    <div class="settings-group fully-rounded" style="margin:0;">
                        <div class="settings-item" id="tk-bind-worldbook-btn" style="border-bottom:none; cursor:pointer;">
                            <div class="settings-icon" style="background-color:#1c1c1e;"><i class="fas fa-book"></i></div>
                            <div class="settings-text">挂载世界书</div>
                            <div id="tk-bound-worldbook-label" style="margin-left:auto; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#8e8e93; font-size:12px; text-align:right;">未挂载</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        (document.getElementById('tiktok-view') || document.body).appendChild(sheet);
        sheet.addEventListener('click', (event) => {
            if (event.target === sheet) window.closeView(sheet);
        });
        sheet.querySelector('#tk-bind-worldbook-btn')?.addEventListener('click', () => {
            if (typeof window.renderWorldBookSelector !== 'function') {
                if (window.showToast) window.showToast('世界书选择器不可用');
                return;
            }
            window.renderWorldBookSelector(tkProfileGetBoundWorldBookIds(), (selectedIds) => {
                tkState.settings = tkState.settings || {};
                tkState.settings.boundWorldBookIds = Array.isArray(selectedIds)
                    ? selectedIds.filter(Boolean).map(id => String(id))
                    : [];
                if (window.tkPersistState) window.tkPersistState();
                tkProfileUpdateSettingsSheet(sheet);
                if (window.showToast) window.showToast('TikTok 世界书挂载已更新');
            });
        });
        return sheet;
    }

    function tkFormatVisitorTime(value) {
        const time = Number(value);
        if (!Number.isFinite(time) || time <= 0) return '刚刚访问';
        return new Date(time).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function tkProfileParseAiJson(rawText) {
        if (window.tkParseAiJson) return window.tkParseAiJson(rawText);
        const raw = String(rawText || '')
            .replace(/```json/gi, '')
            .replace(/```/g, '')
            .trim();
        try {
            return JSON.parse(raw);
        } catch (error) {
            const start = Math.min(...[raw.indexOf('{'), raw.indexOf('[')].filter(index => index >= 0));
            const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
            if (!Number.isFinite(start) || start < 0 || end <= start) throw error;
            return JSON.parse(raw.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1'));
        }
    }

    function tkEnsureProfileVisitorsSheet() {
        let sheet = document.getElementById('tk-profile-visitors-sheet');
        if (sheet) return sheet;

        sheet = document.createElement('div');
        sheet.id = 'tk-profile-visitors-sheet';
        sheet.className = 'bottom-sheet-overlay';
        sheet.innerHTML = `
            <div class="bottom-sheet tk-visitors-sheet">
                <div class="sheet-handle"></div>
                <div class="sheet-title">主页访客</div>
                <div class="detail-sheet-content tk-visitors-list" id="tk-profile-visitors-list"></div>
            </div>
        `;
        (document.getElementById('tiktok-view') || document.body).appendChild(sheet);
        sheet.addEventListener('click', (event) => {
            if (event.target === sheet) window.closeView(sheet);
        });
        return sheet;
    }

    function tkEnsureVisitorThoughtSheet() {
        let sheet = document.getElementById('tk-profile-visitor-thought-sheet');
        if (sheet) return sheet;

        sheet = document.createElement('div');
        sheet.id = 'tk-profile-visitor-thought-sheet';
        sheet.className = 'bottom-sheet-overlay';
        sheet.innerHTML = `
            <div class="bottom-sheet tk-visitor-thought-sheet">
                <div class="sheet-handle"></div>
                <div class="tk-visitor-thought-header">
                    <div class="tk-visitor-avatar tk-visitor-thought-avatar" id="tk-visitor-thought-avatar"></div>
                    <div>
                        <div class="tk-visitor-name" id="tk-visitor-thought-name">Visitor</div>
                        <div class="tk-visitor-meta" id="tk-visitor-thought-handle">@visitor</div>
                        <div class="tk-visitor-meta tk-visitor-thought-time" id="tk-visitor-thought-time">刚刚访问</div>
                    </div>
                </div>
                <div class="tk-visitor-thought-text" id="tk-visitor-thought-text"></div>
            </div>
        `;
        (document.getElementById('tiktok-view') || document.body).appendChild(sheet);
        sheet.addEventListener('click', (event) => {
            if (event.target === sheet) window.closeView(sheet);
        });
        return sheet;
    }

    function tkOpenVisitorThought(visitor) {
        const sheet = tkEnsureVisitorThoughtSheet();
        const avatarEl = sheet.querySelector('#tk-visitor-thought-avatar');
        const nameEl = sheet.querySelector('#tk-visitor-thought-name');
        const handleEl = sheet.querySelector('#tk-visitor-thought-handle');
        const timeEl = sheet.querySelector('#tk-visitor-thought-time');
        const textEl = sheet.querySelector('#tk-visitor-thought-text');
        const avatar = visitor.avatar || '';

        avatarEl.innerHTML = avatar ? `<img src="${tkProfileEscape(avatar)}" alt="">` : '<i class="fas fa-user"></i>';
        nameEl.textContent = visitor.name || 'Visitor';
        handleEl.textContent = `@${visitor.handle || visitor.id || 'visitor'}`;
        if (timeEl) timeEl.textContent = tkFormatVisitorTime(visitor.createdAt);
        textEl.textContent = visitor.thought || visitor.reason || '看完你的评论后，想来主页确认更多细节。';
        window.openView(sheet);
    }

    function tkCollectProfileVisitors() {
        const storedVisitors = tkState.profile && Array.isArray(tkState.profile.visitors)
            ? tkState.profile.visitors
            : [];
        return storedVisitors
            .filter(visitor => visitor && visitor.name)
            .slice()
            .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
            .slice(0, 30)
            .map(visitor => ({
                ...visitor,
                avatar: window.tkResolveAvatar
                    ? window.tkResolveAvatar(visitor.id, visitor.name, visitor.avatar)
                    : visitor.avatar
            }));

        const seen = new Set();
        const visitors = [];
        const addVisitor = (visitor) => {
            if (!visitor || !visitor.name) return;
            const key = String(visitor.id || visitor.name);
            if (seen.has(key)) return;
            seen.add(key);
            visitors.push(visitor);
        };

        (tkState.videos || []).forEach(video => {
            (video.comments || []).forEach(comment => {
                const id = comment.authorId || `visitor_${comment.authorName}`;
                addVisitor({
                    id,
                    name: comment.authorName,
                    handle: comment.authorName,
                    avatar: window.tkResolveAvatar ? window.tkResolveAvatar(id, comment.authorName, comment.authorAvatar) : comment.authorAvatar,
                    reason: '刚刚看过你的内容'
                });
            });
        });

        (tkState.dms || []).forEach(dm => {
            const char = window.tkGetChar(dm.charId);
            if (char) {
                addVisitor({
                    id: char.id,
                    name: char.name || char.handle,
                    handle: char.handle || char.id,
                    avatar: tkProfileResolveAvatar(char),
                    reason: '来自私信互动'
                });
            }
        });

        (tkState.chars || []).filter(char => char.isFollowed).forEach(char => {
            addVisitor({
                id: char.id,
                name: char.name || char.handle,
                handle: char.handle || char.id,
                avatar: tkProfileResolveAvatar(char),
                reason: '关注了你的动态'
            });
        });

        return visitors.slice(0, 20);
    }

    window.tkOpenProfileVisitorsSheet = function() {
        const sheet = tkEnsureProfileVisitorsSheet();
        const list = sheet.querySelector('#tk-profile-visitors-list');
        const visitors = tkCollectProfileVisitors();

        if (!visitors.length) {
            list.innerHTML = '<div class="tk-visitors-empty">暂无访客</div>';
        } else {
            list.innerHTML = visitors.map(visitor => `
                <div class="tk-visitor-item" data-id="${tkProfileEscape(visitor.id)}" data-name="${tkProfileEscape(visitor.name)}" data-handle="${tkProfileEscape(visitor.handle || visitor.id || 'user')}" data-avatar="${tkProfileEscape(visitor.avatar)}" data-thought="${tkProfileEscape(visitor.thought || visitor.reason || '')}" data-created-at="${tkProfileEscape(visitor.createdAt || '')}">
                    <div class="tk-visitor-avatar">${visitor.avatar ? `<img src="${tkProfileEscape(visitor.avatar)}" alt="">` : '<i class="fas fa-user"></i>'}</div>
                    <div class="tk-visitor-info">
                        <div class="tk-visitor-name">${tkProfileEscape(visitor.name || 'User')}</div>
                        <div class="tk-visitor-meta">@${tkProfileEscape(visitor.handle || visitor.id || 'user')} · ${tkProfileEscape(visitor.reason || '访问了主页')}</div>
                    </div>
                    <button type="button" class="tk-visitor-delete-btn" title="删除访客"><i class="fas fa-chevron-right"></i></button>
                </div>
            `).join('');
            list.querySelectorAll('.tk-visitor-item').forEach(item => {
                item.addEventListener('click', (event) => {
                    if (event.target.closest('.tk-visitor-avatar')) return;
                    if (event.target.closest('.tk-visitor-delete-btn')) return;
                    tkOpenVisitorThought({
                        id: item.dataset.id || '',
                        name: item.dataset.name || 'Visitor',
                        handle: item.dataset.handle || '',
                        avatar: item.dataset.avatar || '',
                        thought: item.dataset.thought || '',
                        createdAt: item.dataset.createdAt || ''
                    });
                    return;
                    const id = item.dataset.id || `visitor_${Date.now()}`;
                    const name = item.dataset.name || 'User';
                    const avatar = item.dataset.avatar || '';
                    if (!window.tkGetChar(id)) {
                        window.tkSaveChar({
                            id,
                            name,
                            handle: name.toLowerCase().replace(/\s+/g, '') || id,
                            avatar,
                            status: '',
                            persona: `访问过主页的 ${name}`,
                            isFollowed: false
                        });
                    }
                    window.closeView(sheet);
                    if (window.tkOpenSubProfile) window.tkOpenSubProfile(id);
                });
                const avatarBtn = item.querySelector('.tk-visitor-avatar');
                if (avatarBtn) {
                    avatarBtn.addEventListener('click', (event) => {
                        event.stopPropagation();
                        const id = item.dataset.id || `visitor_${Date.now()}`;
                        const name = item.dataset.name || 'User';
                        const avatar = item.dataset.avatar || '';
                        const handle = item.dataset.handle || name.toLowerCase().replace(/\s+/g, '') || id;
                        if (!window.tkGetChar(id)) {
                            window.tkSaveChar({
                                id,
                                name,
                                handle,
                                avatar,
                                status: '',
                                persona: `访问过主页的 ${name}`,
                                isFollowed: false
                            });
                        }
                        window.closeView(sheet);
                        if (window.tkOpenSubProfile) window.tkOpenSubProfile(id);
                    });
                }
                const deleteBtn = item.querySelector('.tk-visitor-delete-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (event) => {
                        event.stopPropagation();
                        const id = item.dataset.id || '';
                        const handle = item.dataset.handle || '';
                        const name = item.dataset.name || '';
                        if (tkState.profile && Array.isArray(tkState.profile.visitors)) {
                            tkState.profile.visitors = tkState.profile.visitors.filter(visitor => {
                                return String(visitor.id || '') !== String(id)
                                    && String(visitor.handle || '') !== String(handle)
                                    && String(visitor.name || '') !== String(name);
                            });
                        }
                        if (window.tkPersistState) window.tkPersistState();
                        window.tkOpenProfileVisitorsSheet();
                    });
                }
            });
        }

        window.openView(sheet);
    };

    if (subProfileBackBtn && subProfileView) {
        subProfileBackBtn.addEventListener('click', () => {
            subProfileView.classList.remove('active');
            currentSubCharId = null;
        });
    }

    if (subProfileEditTrigger) {
        subProfileEditTrigger.addEventListener('click', () => {
            if (currentSubCharId) {
                // Open edit char sheet
                const title = document.getElementById('tk-char-sheet-title');
                if (title) title.textContent = '编辑角色';
                
                const charNameInput = document.getElementById('tk-char-name');
                const charStatusInput = document.getElementById('tk-char-status');
                const charPersonaInput = document.getElementById('tk-char-persona');
                const charBioInput = document.getElementById('tk-char-bio');
                const charFollowingInput = document.getElementById('tk-char-following');
                const charFollowersInput = document.getElementById('tk-char-followers');
                const charLikesInput = document.getElementById('tk-char-likes');
                const deleteCharBtn = document.getElementById('tk-delete-char-btn');
                const charAvatarImg = document.getElementById('tk-char-avatar-img');
                const charAvatarIcon = document.querySelector('#tk-char-avatar-preview i');
                
                const char = window.tkGetChar(currentSubCharId);
                if (char) {
                    if(charNameInput) charNameInput.value = char.name || '';
                    if(charStatusInput) charStatusInput.value = char.status || '';
                    if(charPersonaInput) charPersonaInput.value = char.persona || '';
                    if(charBioInput) charBioInput.value = char.bio || '';
                    if(charFollowingInput) charFollowingInput.value = char.following || 0;
                    if(charFollowersInput) charFollowersInput.value = char.followers || 0;
                    if(charLikesInput) charLikesInput.value = char.likes || 0;
                    
                    if(deleteCharBtn) deleteCharBtn.style.display = 'block';
                    
                    const resolvedEditAvatar = tkProfileResolveAvatar(char);
                    if (resolvedEditAvatar) {
                        if(charAvatarImg) { charAvatarImg.src = resolvedEditAvatar; charAvatarImg.style.display = 'block'; }
                        if(charAvatarIcon) charAvatarIcon.style.display = 'none';
                    } else {
                        if(charAvatarImg) { charAvatarImg.src = ''; charAvatarImg.style.display = 'none'; }
                        if(charAvatarIcon) charAvatarIcon.style.display = 'block';
                    }
                }
                
                // We need to set editingCharId in 4_chat.js context indirectly, or just trust the save button handles it.
                // A better way is to dispatch a custom event or call a global func.
                // Since 4_chat.js handles the save for this sheet, and relies on its own editingCharId scope, 
                // we should expose a global function in 4_chat.js to open it properly.
                if (window.tkOpenEditChar) {
                    window.tkOpenEditChar(currentSubCharId);
                } else {
                    window.openView(editCharSheet);
                }
            }
        });
    }

    function tkSetSubProfileFollowButton(char) {
        if (!subProfileFollowBtn || !char) return;
        if (char.isFollowed && char.isFollower) {
            subProfileFollowBtn.textContent = 'Mutual follow';
            subProfileFollowBtn.className = 'tk-btn-secondary';
        } else if (char.isFollowed) {
            subProfileFollowBtn.textContent = 'Following';
            subProfileFollowBtn.className = 'tk-btn-secondary';
        } else if (char.isFollower) {
            subProfileFollowBtn.textContent = 'Follow back';
            subProfileFollowBtn.className = 'tk-btn-primary';
        } else {
            subProfileFollowBtn.textContent = 'Follow';
            subProfileFollowBtn.className = 'tk-btn-primary';
        }
    }

    // Open Sub Profile Function
    window.tkOpenSubProfile = function(charId) {
        const char = window.tkGetChar(charId);
        if (!char || !subProfileView) return;
        currentSubCharId = charId;
        window.currentTkSubProfileCharId = charId;

        // Render info
        subProfileName.textContent = char.name || 'User';
        subProfileHandle.textContent = '@' + (char.handle || charId);
        subProfileBio.textContent = char.bio || 'No introduction yet';
        
        if (char.status) {
            subProfileStatusBubble.style.display = 'block';
            subProfileStatusBubble.textContent = char.status;
        } else {
            subProfileStatusBubble.style.display = 'none';
        }

        subStatFollowing.textContent = tkProfileFormatCount(char.following || 0);
        subStatFollowers.textContent = tkProfileFormatCount(char.followers || 0);
        subStatLikes.textContent = tkProfileFormatCount(char.likes || 0);

        const resolvedSubAvatar = tkProfileResolveAvatar(char);
        if (resolvedSubAvatar) {
            subProfileAvatarImg.src = resolvedSubAvatar;
            subProfileAvatarImg.style.display = 'block';
            subProfileAvatarIcon.style.display = 'none';
        } else {
            subProfileAvatarImg.src = '';
            subProfileAvatarImg.style.display = 'none';
            subProfileAvatarIcon.style.display = 'block';
        }

        // Follow Btn State
        tkSetSubProfileFollowButton(char);

        // Render initially with "videos" target
        const activeTab = document.querySelector('#tk-sub-profile-view .tk-ptab.active');
        const target = activeTab ? activeTab.getAttribute('data-target') : 'videos';
        
        let charVideos = tkState.videos.filter(v => v.authorId === charId);
        let likedVideos = [];
        if (char.likedVideoIds) {
            likedVideos = tkState.videos.filter(v => char.likedVideoIds.includes(v.id));
        }
        
        if (subProfileGrid) {
            renderGrid(target, subProfileGrid, charVideos, likedVideos);
        }

        subProfileView.classList.add('active');
    };

    if (subProfileFollowBtn) {
        subProfileFollowBtn.addEventListener('click', () => {
            if (!currentSubCharId) return;
            const char = window.tkGetChar(currentSubCharId);
            if (char) {
                char.isFollowed = !char.isFollowed;
                if (window.tkPersistState) window.tkPersistState();
                tkSetSubProfileFollowButton(char);
                if (char.isFollowed) {
                    window.showToast('已关注');
                } else {
                    window.showToast('已取消关注');
                }
                if (window.tkRenderHome) window.tkRenderHome();
                if (window.tkRenderChat) window.tkRenderChat();
            }
        });
    }

    if (subProfileApiBtn) {
        subProfileApiBtn.innerHTML = '<i class="fas fa-search" style="color: #fff;"></i>';
        subProfileApiBtn.title = '生成主页内容';
        subProfileApiBtn.addEventListener('click', () => {
            if (!currentSubCharId) return;
            // Trigger API specifically for this char
            if (window.tkGenerateCharVideos) {
                window.tkGenerateCharVideos(currentSubCharId, () => {
                    // re-render after generation
                    window.tkOpenSubProfile(currentSubCharId);
                });
            } else {
                window.showToast('生成功能未绑定');
            }
        });
    }

    // Add tkGenerateCharVideos to global scope
    window.tkGenerateCharVideos = async function(charId, callback) {
        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
            window.showToast('请在系统设置中配置 API');
            return;
        }

        const char = window.tkGetChar(charId);
        if(!char) return;

        window.showToast('正在生成角色主页内容...');
        
        let wbContext = '';
        
        // 1. 全局世界书
        if (window.getWorldBooks) {
            const allWb = window.getWorldBooks();
            const globalWb = allWb.filter(b => b.isGlobal);
            if (globalWb.length > 0) {
                wbContext += "世界观背景设定:\n";
                globalWb.forEach(b => {
                    b.entries.forEach(e => {
                        wbContext += `- ${e.keyword}: ${e.content}\n`;
                    });
                });
                wbContext += "\n";
            }
        }

        // 2. 内置世界书 (如果存在)
        if (window.getBuiltinWorldBooks) {
            const builtinWb = window.getBuiltinWorldBooks().filter(b => b.isGlobal);
            if (builtinWb.length > 0) {
                wbContext += "内置设定:\n";
                builtinWb.forEach(b => {
                    b.entries.forEach(e => {
                        wbContext += `- ${e.keyword}: ${e.content}\n`;
                    });
                });
                wbContext += "\n";
            }
        }

        // 3. 角色记忆 (如果存在)
        if (char.memories && char.memories.length > 0) {
            wbContext += "角色记忆:\n";
            char.memories.forEach(m => {
                wbContext += `- ${m.text}\n`;
            });
            wbContext += "\n";
        }

        const charContextText = `${char.name || ''} ${char.handle || ''} ${char.persona || ''} ${char.bio || ''}`;
        const modernWbContext = window.tkBuildWorldBookContext ? window.tkBuildWorldBookContext(charContextText) : '';
        const worldActorPrompt = window.tkBuildWorldActorPrompt
            ? window.tkBuildWorldActorPrompt({
                includeUserIdentity: false,
                purpose: '角色 TikTok 主页视频与评论区生成',
                triggerText: charContextText
            })
            : '你是这个世界观中的任何非 user 角色/路人/创作者；只有必要时才提到 user，禁止扮演 user。';
        if (modernWbContext) {
            wbContext = modernWbContext + (char.memories && char.memories.length > 0
                ? `\n\n角色记忆:\n${char.memories.map(m => `- ${m.text || m}`).join('\n')}\n`
                : '');
        }

        const prompt = `
你现在是一个 TikTok 视频内容生成器。请根据以下角色的设定和挂载的世界书/记忆，为该角色生成主页内容：至少 2 条发布的视频内容和至少 2 条点赞过的视频。
角色名字：${char.name}
角色设定：${char.persona}

要求：
1. 整体风格符合该角色的性格和人物设定，视频画面用文字描述，富有镜头感或气泡文字表现感，必须以第三人称视角描述简要的环境氛围、动作和语言描述，字数严格控制在 40-80 字之间。
2. 符合世界观，仿真实tk网络视频，内容多样化，文案要具有“活人感”（例如碎碎念、吐槽、玩梗,也可以是一句摘抄的文学语录），切忌机器播报感。
3. 务必为每个视频生成 3-5 条相关评论，且如果情景合适（比如@了朋友），请在评论中追加 \`replies\`（楼中楼回复）。
4. 返回严格的 JSON 格式（不要有 markdown 代码块标记，不要多余文字），格式必须如下：
{
  "posts": [
    {
      "desc": "视频文案（简短，带tag）",
      "sceneText": "画面内容文字描述（气泡内容或镜头描述）",
      "likes": 1234,
      "commentsCount": 5,
      "shares": 12,
      "comments": [
        { 
          "authorName": "评论者A", 
          "authorAvatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=c1", 
          "text": "评论内容", 
          "likes": 12,
          "replies": [
            {
              "authorName": "回复者B",
              "authorAvatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=c2",
              "text": "回复内容（如果情景合适）",
              "likes": 3
            }
          ]
        }
      ]
    }
  ],
  "likedVideos": [
    {
      "authorName": "随机创作者名",
      "authorAvatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=v1",
      "desc": "点赞视频文案",
      "sceneText": "点赞视频的画面内容",
      "likes": 5678,
      "commentsCount": 30,
      "shares": 20,
      "comments": [
        {
          "authorName": "评论者A",
          "authorAvatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=c3",
          "text": "好有趣的视频！",
          "likes": 100,
          "replies": []
        }
      ]
    }
  ]
}

${wbContext}
`;

        let normalizedPrompt = `${prompt}

新版补充要求（必须覆盖旧格式）：
角色名字：${char.name || 'User'}
角色 handle：${char.handle || charId}
角色设定：${char.persona || '普通 TikTok 用户'}
1. posts 生成 2-5 条，likedVideos 生成 2-5 条；每条内容必须包含 mediaType，值为 "video" 或 "image"。
2. image 内容必须额外包含 imagePrompt，描述图片主体、构图、光线、质感；可选 bgImage、cover 或 imageUrl，没有真实 URL 就留空。
3. 每条内容必须包含 opening、middle、ending 三段，每段 30-50 个字符；sceneText 可省略；如果原文不是中文，必须提供对应中文翻译字段。
4. posts 和 likedVideos 中每条内容都必须包含至少 10 条顶层 comments；每条评论必须包含 replies 数组，楼中楼按情境可为空或自然生成。
5. comments 和 replies 的每一项都必须带 authorName、authorAvatar、text、likes。
6. 返回 JSON 对象时，posts 和 likedVideos 中的内容都使用同一套字段：mediaType、desc、imagePrompt、opening、middle、ending、likes、shares、comments。
`;

        try {
            const endpoint = window.u2Api.resolveChatCompletionsEndpoint(window.apiConfig.endpoint);

            normalizedPrompt = `
You are generating a TikTok character profile. Return strict valid JSON only.
You may write as any non-user account/person inside this world view. Do not impersonate user.

${worldActorPrompt}

Character:
${JSON.stringify({
    id: charId,
    name: char.name || 'User',
    handle: char.handle || charId,
    persona: char.persona || '',
    bio: char.bio || '',
    status: char.status || '',
    memories: Array.isArray(char.memories) ? char.memories.map(m => m.text || m).slice(0, 12) : []
}, null, 2)}

World book and memory context:
${wbContext || 'No extra world book context.'}

Hard requirements:
1. Return one JSON object only. No markdown, no comments, no prose, no trailing commas.
2. Include "profileStats" with numeric "following", "followers", and "likes".
3. Include "posts": 2-5 items. Include "likedVideos": 1-3 items.
4. Every post and likedVideo must include "mediaType" ("video" or "image"), "desc", "imagePrompt", "opening", "middle", "ending", "likes", "shares", and "comments".
5. Even when mediaType is "video", provide imagePrompt as a realistic cover frame description. If no real image URL exists, leave "cover", "bgImage", and "imageUrl" empty.
6. opening, middle, and ending are each 30-50 characters and should read like immersive bubble-flow text. They may use any language that fits the character and world.
7. Every video in posts and likedVideos must contain at least 10 top-level comments. Each comment must include authorName, authorAvatar, text, likes, and replies. replies is always an array and may be empty or contain natural nested replies when appropriate.
8. The content must match the character persona and world book. Avoid generic influencer wording. 禁止扮演user的身份发抖音和评论，你只能是除了user以外的人。
9. 如果评论或 replies 中出现本角色本人，请使用 Character.id 作为 authorId，并让 authorName 与 Character.name 一致，以便头像与主页视频头像同步。
10. International translation rule: opening/middle/ending may use any language that fits the character and world. If a bubble field is not Chinese, fill openingTranslationZh/middleTranslationZh/endingTranslationZh with a natural Chinese translation. If it is Chinese, the matching translation field must be an empty string. If any comment or reply text is not Chinese, fill translationZh with a natural Chinese translation; if it is Chinese, translationZh must be an empty string.

JSON shape:
{
  "profileStats": {
    "following": 120,
    "followers": 3400,
    "likes": 28000
  },
  "posts": [
    {
      "mediaType": "video",
      "desc": "short TikTok caption with tags",
      "imagePrompt": "realistic cover frame description",
      "opening": "30-50 chars in the fitting language",
      "openingTranslationZh": "",
      "middle": "30-50 chars in the fitting language",
      "middleTranslationZh": "",
      "ending": "30-50 chars in the fitting language",
      "endingTranslationZh": "",
      "likes": 1234,
      "shares": 23,
      "comments": [
        {
          "authorName": "commenter",
          "authorAvatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=commenter",
          "text": "comment text",
          "translationZh": "Chinese translation if comment text is not Chinese, otherwise empty string",
          "likes": 12,
          "replies": [
            {
              "authorName": "reply author",
              "authorAvatar": "",
              "text": "reply text",
              "translationZh": "Chinese translation if reply text is not Chinese, otherwise empty string",
              "likes": 3
            }
          ]
        }
      ]
    }
  ],
  "likedVideos": [
    {
      "mediaType": "image",
      "authorName": "another creator",
      "authorAvatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=creator",
      "desc": "liked content caption",
      "imagePrompt": "realistic image or cover frame description",
      "opening": "30-50 chars in the fitting language",
      "openingTranslationZh": "",
      "middle": "30-50 chars in the fitting language",
      "middleTranslationZh": "",
      "ending": "30-50 chars in the fitting language",
      "endingTranslationZh": "",
      "likes": 5678,
      "shares": 44,
      "comments": []
    }
  ]
}
`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.apiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: window.apiConfig.model || 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: 'Return strict valid JSON only. Use double-quoted keys and strings. Do not use markdown, comments, prose, or trailing commas.' },
                        { role: 'user', content: normalizedPrompt }
                    ],
                    temperature: parseFloat(window.apiConfig.temperature) || 0.8
                })
            });

            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            
            const data = await response.json();
            let aiReply = data.choices[0].message.content;
            
            const parsedData = tkProfileParseAiJson(aiReply);
            
            let hasNewContent = false;
            if (parsedData.profileStats && typeof parsedData.profileStats === 'object') {
                const stats = parsedData.profileStats;
                if (Number.isFinite(Number(stats.following))) char.following = Number(stats.following);
                if (Number.isFinite(Number(stats.followers))) char.followers = Number(stats.followers);
                if (Number.isFinite(Number(stats.likes))) char.likes = Number(stats.likes);
            }

            if (parsedData.posts && Array.isArray(parsedData.posts)) {
                parsedData.posts.slice(0, 5).forEach(v => {
                    const normalized = window.tkNormalizeVideoPayload ? window.tkNormalizeVideoPayload(v, {
                        id: 'v_' + Date.now() + Math.floor(Math.random() * 1000),
                        authorId: charId,
                        authorName: char.name,
                        authorAvatar: tkProfileResolveAvatar(char) || null,
                        isLiked: false
                    }) : {
                        id: 'v_' + Date.now() + Math.floor(Math.random() * 1000),
                        authorId: charId,
                        authorName: char.name,
                        authorAvatar: tkProfileResolveAvatar(char) || null,
                        desc: v.desc || '',
                        sceneText: v.sceneText || [v.opening, v.middle, v.ending].filter(Boolean).join(' '),
                        sceneSegments: [v.opening, v.middle, v.ending].filter(Boolean),
                        likes: v.likes || Math.floor(Math.random() * 1000),
                        commentsCount: (v.comments && v.comments.length) || v.commentsCount || 0,
                        shares: v.shares || Math.floor(Math.random() * 100),
                        isLiked: false,
                        comments: v.comments || []
                    };
                    tkState.videos.unshift(normalized);
                });
                hasNewContent = true;
            }

            if (parsedData.likedVideos && Array.isArray(parsedData.likedVideos)) {
                if (!char.likedVideoIds) char.likedVideoIds = [];
                parsedData.likedVideos.slice(0, 3).forEach(v => {
                    const newId = 'v_liked_' + Date.now() + Math.floor(Math.random() * 1000);
                    const normalized = window.tkNormalizeVideoPayload ? window.tkNormalizeVideoPayload(v, {
                        id: newId,
                        authorId: 'user_' + Date.now() + Math.floor(Math.random() * 100),
                        authorName: v.authorName || 'User',
                        authorAvatar: v.authorAvatar || null,
                        isLiked: false
                    }) : {
                        id: newId,
                        authorId: 'user_' + Date.now() + Math.floor(Math.random() * 100),
                        authorName: v.authorName || 'User',
                        authorAvatar: v.authorAvatar || null,
                        desc: v.desc || '',
                        sceneText: v.sceneText || [v.opening, v.middle, v.ending].filter(Boolean).join(' '),
                        sceneSegments: [v.opening, v.middle, v.ending].filter(Boolean),
                        likes: v.likes || Math.floor(Math.random() * 10000),
                        commentsCount: (v.comments && v.comments.length) || v.commentsCount || 0,
                        shares: v.shares || Math.floor(Math.random() * 100),
                        isLiked: false,
                        comments: v.comments || []
                    };
                    tkState.videos.unshift(normalized);
                    char.likedVideoIds.push(newId);
                });
                hasNewContent = true;
            }

            if (hasNewContent) {
                if (window.tkPersistState) window.tkPersistState();
                if(window.tkRenderHome) window.tkRenderHome();
                window.showToast('生成成功');
                if(callback) callback();
            } else {
                throw new Error('No posts or likedVideos array in JSON');
            }

        } catch (error) {
            console.error('Gen Error:', error);
            window.showToast('生成失败，请检查 API 配置');
        }
    };

    window.tkRenderProfile = function() {
        const p = tkState.profile;
        
        // Render Info
        if (nameEl) nameEl.textContent = p.name || 'User';
        if (handleEl) handleEl.textContent = '@' + (p.handle || 'user123');
        if (bioEl) bioEl.textContent = p.bio || '点击添加个人简介';
        
        if (p.status) {
            if(statusBubble) {
                statusBubble.style.display = 'block';
                statusBubble.textContent = p.status;
            }
        } else {
            if(statusBubble) statusBubble.style.display = 'none';
        }

        statFollowing.textContent = tkProfileFormatCount(p.following || 0);
        statFollowers.textContent = tkProfileFormatCount(p.followers || 0);
        statLikes.textContent = tkProfileFormatCount(p.likes || 0);

        // Render Avatar：头像为空/删除时也统一显示随机图片，而不是默认人形图标。
        const resolvedProfileAvatar = window.tkResolveAvatar
            ? window.tkResolveAvatar('profile', p.name || p.handle || 'User', p.avatar)
            : p.avatar;
        if (resolvedProfileAvatar) {
            avatarImg.src = resolvedProfileAvatar;
            avatarImg.style.display = 'block';
            avatarIcon.style.display = 'none';
        } else {
            avatarImg.src = '';
            avatarImg.style.display = 'none';
            avatarIcon.style.display = 'block';
        }

        // Render initially with "videos" target for main profile
        const activeTab = document.querySelector('#tk-profile-tab .tk-ptab.active');
        const target = activeTab ? activeTab.getAttribute('data-target') : 'videos';
        renderGrid(target, document.getElementById('tk-profile-grid'), tkState.profile.posts || [], tkState.videos.filter(v => v.isLiked));
    };

    // Edit Status
    if (statusBubble) {
        statusBubble.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.showCustomModal) {
                window.showCustomModal({
                    title: '设置状态',
                    type: 'prompt',
                    placeholder: '输入你的当前状态...',
                    defaultValue: tkState.profile.status,
                    onConfirm: (val) => {
                        tkState.profile.status = val;
                        if (window.tkPersistState) window.tkPersistState();
                        window.tkRenderProfile();
                        if (window.tkRenderChat) window.tkRenderChat(); // update chat self item
                    }
                });
            } else {
                const ns = prompt('输入你的当前状态:', tkState.profile.status);
                if (ns !== null) {
                    tkState.profile.status = ns;
                    if (window.tkPersistState) window.tkPersistState();
                    window.tkRenderProfile();
                }
            }
        });
    }

    // Avatar Upload Logic
    if (avatarBtn && avatarUpload) {
        avatarBtn.addEventListener('click', (e) => {
            // Prevent opening upload if clicked on status bubble or plus icon
            if (e.target === statusBubble || e.target.closest('.tk-avatar-plus')) {
                // If plus clicked, also trigger upload
                if (e.target.closest('.tk-avatar-plus')) {
                    avatarUpload.click();
                }
                return;
            }
            avatarUpload.click();
        });

        avatarUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    tkState.profile.avatar = event.target.result;
                    // Also sync to main emulator user state if needed
                    if (window.userState) {
                        window.userState.avatarUrl = event.target.result;
                    }
                    if (window.tkPersistState) window.tkPersistState();
                    window.tkRenderProfile();
                    if (window.tkRenderChat) window.tkRenderChat();
                    window.showToast('头像已更新');
                };
                reader.readAsDataURL(file);
            }
            e.target.value = '';
        });
    }

    // Top Left Button -> Add Character / Import
    if (profileBackBtn) {
        profileBackBtn.addEventListener('click', () => {
            if (tkAppView) {
                window.closeView(tkAppView);
            }
        });
    }

    // --- Global Event Delegation for Edit Profile & Actions (Bulletproof) ---
    if (!window.tkProfileDelegationBound) {
        window.tkProfileDelegationBound = true;
        document.addEventListener('click', (e) => {
            // 点击空白处关闭各种 sheet
            const sheets = [
                'tk-edit-profile-sheet',
                'tk-upload-video-sheet',
                'tk-edit-char-sheet',
                'tk-create-action-sheet'
            ];
            sheets.forEach(id => {
                const sheet = document.getElementById(id);
                if (sheet && sheet.classList.contains('active')) {
                    if (e.target === sheet) {
                        window.closeView(sheet);
                    }
                }
            });

            // 1. Edit Profile Button
            if (e.target.closest('#tk-profile-edit-btn')) {
                try {
                    const p = tkState.profile;
                    const elName = document.getElementById('tk-edit-name');
                    if(elName) elName.value = p.name || '';
                    const elHandle = document.getElementById('tk-edit-handle');
                    if(elHandle) elHandle.value = p.handle || '';
                    const elBio = document.getElementById('tk-edit-bio');
                    if(elBio) elBio.value = p.bio || '';
                    const elPersona = document.getElementById('tk-edit-persona');
                    if(elPersona) elPersona.value = p.persona || '';
                    
                    const elFollowing = document.getElementById('tk-edit-following');
                    if(elFollowing) elFollowing.value = p.following || 0;
                    const elFollowers = document.getElementById('tk-edit-followers');
                    if(elFollowers) elFollowers.value = p.followers || 0;
                    const elLikes = document.getElementById('tk-edit-likes');
                    if(elLikes) elLikes.value = p.likes || 0;
                    
                    const sheet = document.getElementById('tk-edit-profile-sheet');
                    if(sheet) window.openView(sheet);
                    else if(window.showToast) window.showToast('无法找到编辑面板容器');
                } catch(err) {
                    console.error('打开编辑资料报错:', err);
                    if(window.showToast) window.showToast('打开编辑失败:' + err.message);
                }
            }
            
            // Save Profile Button
            if (e.target.closest('#tk-save-profile-btn')) {
                const elName = document.getElementById('tk-edit-name');
                const elHandle = document.getElementById('tk-edit-handle');
                const elBio = document.getElementById('tk-edit-bio');
                const elPersona = document.getElementById('tk-edit-persona');
                
                const elFollowing = document.getElementById('tk-edit-following');
                const elFollowers = document.getElementById('tk-edit-followers');
                const elLikes = document.getElementById('tk-edit-likes');
                
                tkState.profile.name = elName ? elName.value.trim() : 'User';
                tkState.profile.handle = elHandle ? elHandle.value.trim() : 'user123';
                tkState.profile.bio = elBio ? elBio.value.trim() : '';
                tkState.profile.persona = elPersona ? elPersona.value.trim() : '';
                
                if(elFollowing) tkState.profile.following = elFollowing.value || 0;
                if(elFollowers) tkState.profile.followers = elFollowers.value || 0;
                if(elLikes) tkState.profile.likes = elLikes.value || 0;

                if (window.userState) {
                    window.userState.name = tkState.profile.name;
                }

                if (window.tkPersistState) window.tkPersistState();
                window.tkRenderProfile();
                const sheet = document.getElementById('tk-edit-profile-sheet');
                if(sheet) window.closeView(sheet);
                window.showToast('资料已保存');
            }
            
            // 2. Profile Create Trigger (the little caret)
            if (e.target.closest('#tk-profile-tab .tk-btn-icon')) {
                const sheet = document.getElementById('tk-create-action-sheet');
                if (sheet && window.openView) window.openView(sheet);
            }
            
            // Open Upload Video Sheet Button
            if (e.target.closest('#tk-btn-open-upload-video')) {
                const createActionSheet = document.getElementById('tk-create-action-sheet');
                if(createActionSheet) window.closeView(createActionSheet);
                
                const descInput = document.getElementById('tk-upload-desc-input');
                const sceneInput = document.getElementById('tk-upload-scene-input');
                const coverImg = document.getElementById('tk-upload-cover-img');
                const coverBtn = document.getElementById('tk-upload-cover-btn');
                
                if(descInput) descInput.value = '';
                if(sceneInput) sceneInput.value = '';
                if(coverImg) {
                    coverImg.src = '';
                    coverImg.style.display = 'none';
                }
                if(coverBtn) {
                    const div = coverBtn.querySelector('div');
                    if(div) div.style.display = 'flex';
                }
                
                const sheet = document.getElementById('tk-upload-video-sheet');
                if(sheet) window.openView(sheet);
            }

            // Confirm Upload Button
            if (e.target.closest('#tk-confirm-upload-btn')) {
                const descInput = document.getElementById('tk-upload-desc-input');
                const sceneInput = document.getElementById('tk-upload-scene-input');
                const coverImg = document.getElementById('tk-upload-cover-img');
                
                const desc = descInput ? descInput.value.trim() : '';
                const scene = sceneInput ? sceneInput.value.trim() : '';
                const cover = coverImg ? coverImg.src : null;

                if (!tkState.profile.posts) tkState.profile.posts = [];
                
                const newPost = {
                    id: 'post_' + Date.now(),
                    authorId: 'profile',
                    authorName: tkState.profile.name || 'User',
                    authorAvatar: tkState.profile.avatar || null,
                    mediaType: 'video',
                    desc: desc,
                    sceneText: scene,
                    cover: (coverImg && coverImg.style.display === 'block') ? cover : null,
                    likes: 0,
                    savedCount: 0,
                    saves: 0,
                    shares: 0,
                    commentsCount: 0,
                    comments: []
                };
                
                const statBoost = tkApplyLocalUserPostStatBoost(newPost);
                tkState.profile.posts.unshift(newPost);
                if (window.tkPersistState) window.tkPersistState();
                window.tkRenderProfile();
                const sheet = document.getElementById('tk-upload-video-sheet');
                if(sheet) window.closeView(sheet);
                window.showToast(`视频已发布，粉丝 +${statBoost.followerDelta}，获赞 +${statBoost.likeDelta}`);
                if (window.tkGenerateVideoInteractions) {
                    window.tkGenerateVideoInteractions(newPost.id, { isAuto: true });
                }
            }
            
            // 3. Sub Profile Edit Trigger
            if (e.target.closest('#tk-sub-profile-edit-trigger')) {
                const charId = window.currentTkSubProfileCharId;
                if (charId) {
                    const title = document.getElementById('tk-char-sheet-title');
                    if (title) title.textContent = '编辑角色';
                    
                    const charNameInput = document.getElementById('tk-char-name');
                    const charStatusInput = document.getElementById('tk-char-status');
                    const charPersonaInput = document.getElementById('tk-char-persona');
                    const charBioInput = document.getElementById('tk-char-bio');
                    const charFollowingInput = document.getElementById('tk-char-following');
                    const charFollowersInput = document.getElementById('tk-char-followers');
                    const charLikesInput = document.getElementById('tk-char-likes');
                    const deleteCharBtn = document.getElementById('tk-delete-char-btn');
                    const charAvatarImg = document.getElementById('tk-char-avatar-img');
                    const charAvatarIcon = document.querySelector('#tk-char-avatar-preview i');
                    
                    const char = window.tkGetChar(charId);
                    if (char) {
                        if(charNameInput) charNameInput.value = char.name || '';
                        if(charStatusInput) charStatusInput.value = char.status || '';
                        if(charPersonaInput) charPersonaInput.value = char.persona || '';
                        if(charBioInput) charBioInput.value = char.bio || '';
                        if(charFollowingInput) charFollowingInput.value = char.following || 0;
                        if(charFollowersInput) charFollowersInput.value = char.followers || 0;
                        if(charLikesInput) charLikesInput.value = char.likes || 0;
                        if(deleteCharBtn) deleteCharBtn.style.display = 'block';
                        
                        const resolvedEditAvatar = tkProfileResolveAvatar(char);
                        if (resolvedEditAvatar) {
                            if(charAvatarImg) { charAvatarImg.src = resolvedEditAvatar; charAvatarImg.style.display = 'block'; }
                            if(charAvatarIcon) charAvatarIcon.style.display = 'none';
                        } else {
                            if(charAvatarImg) { charAvatarImg.src = ''; charAvatarImg.style.display = 'none'; }
                            if(charAvatarIcon) charAvatarIcon.style.display = 'block';
                        }
                    }
                    if (window.tkOpenEditChar) window.tkOpenEditChar(charId);
                    else {
                        const s = document.getElementById('tk-edit-char-sheet');
                        if(s) window.openView(s);
                    }
                }
            }
        });
    }

    if (visitorsBtn) {
        visitorsBtn.title = '主页访客';
        visitorsBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            if (window.tkOpenProfileVisitorsSheet) window.tkOpenProfileVisitorsSheet();
        });
    }

    if (profileSettingsBtn) {
        profileSettingsBtn.title = 'TikTok 设置';
        profileSettingsBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const sheet = tkEnsureProfileSettingsSheet();
            tkProfileUpdateSettingsSheet(sheet);
            window.openView(sheet);
        });
    }

    // Grid Tabs Logic - Main Profile
    const mainProfileTabs = document.querySelectorAll('#tk-profile-tab .tk-ptab');
    const mainIndicator = document.querySelector('#tk-profile-tab .tk-ptab-indicator');
    const mainGridContainer = document.getElementById('tk-profile-grid');

    mainProfileTabs.forEach((tab, index) => {
        tab.addEventListener('click', () => {
            mainProfileTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            mainIndicator.style.transform = `translateX(${index * 100}%)`;
            
            const target = tab.getAttribute('data-target');
            renderGrid(target, mainGridContainer, tkState.profile.posts || [], tkState.videos.filter(v => v.isLiked));
        });
    });

    // Grid Tabs Logic - Sub Profile
    const subProfileTabs = document.querySelectorAll('#tk-sub-profile-view .tk-ptab');
    const subIndicator = document.querySelector('#tk-sub-profile-view .tk-ptab-indicator');
    const subGridContainer = document.getElementById('tk-sub-profile-grid');

    subProfileTabs.forEach((tab, index) => {
        tab.addEventListener('click', () => {
            subProfileTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            subIndicator.style.transform = `translateX(${index * 100}%)`;
            
            const target = tab.getAttribute('data-target');
            let charVideos = [];
            let likedVideos = [];
            if (currentSubCharId) {
                const char = window.tkGetChar(currentSubCharId);
                charVideos = tkState.videos.filter(v => v.authorId === currentSubCharId);
                if (char && char.likedVideoIds) {
                    likedVideos = tkState.videos.filter(v => char.likedVideoIds.includes(v.id));
                }
            }
            renderGrid(target, subGridContainer, charVideos, likedVideos);
        });
    });

    function renderGrid(target = 'videos', container, videosList = [], likedList = []) {
        if (!container) return;
        container.innerHTML = '';
        
        let items = [];
        if (target === 'videos') {
            items = videosList;
        } else if (target === 'liked') {
            items = likedList;
        }
        
        if (items.length === 0) {
            container.innerHTML = '<div style="grid-column: span 3; padding: 40px 0; text-align: center; color: #999; font-size: 13px;">no content yet</div>';
            return;
        }

        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'tk-grid-item';
            
            const mediaIcon = item.mediaType === 'image' ? 'fa-image' : 'fa-play';
            if (item.cover || item.bgImage || item.imageUrl) {
                let imgUrl = item.cover || item.bgImage || item.imageUrl;
                el.innerHTML = `
                    <img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                    <div class="tk-grid-views" style="text-shadow: none;"><i class="fas ${mediaIcon}" style="text-shadow: none;"></i> ${tkProfileFormatCount(item.likes || Math.floor(Math.random()*1000))}</div>
                `;
            } else {
                let bgStyleStr = item.bgColor ? item.bgColor : '#ffffff';

                el.innerHTML = `
                    <div class="tk-grid-text" style="position: relative; left: 0; top: 0; transform: none; background: ${bgStyleStr}; color:#111111; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding: 8px; width: 100%; height: 100%; box-sizing: border-box; border: none;  text-shadow: none;">
                        ${item.sceneText ? item.sceneText.substring(0, 15) + '...' : (item.desc ? item.desc.substring(0, 15) + '...' : '视频')}
                    </div>
                    <div class="tk-grid-views" style="color: #fff; text-shadow: none;"><i class="fas ${mediaIcon}" style="text-shadow: none;"></i> ${tkProfileFormatCount(item.likes || Math.floor(Math.random()*1000))}</div>
                `;
            }
            
            el.addEventListener('click', () => {
                if (window.tkOpenFullscreenVideo) {
                    window.tkOpenFullscreenVideo(item.id);
                } else {
                    console.error("tkOpenFullscreenVideo 不存在");
                    if (window.showToast) window.showToast('错误: 全屏视频组件未就绪');
                }
            });
            
            container.appendChild(el);
        });
    }

    // Upload Video Logic (Cover Button remaining functionality)
    const coverBtn = document.getElementById('tk-upload-cover-btn');
    const coverInput = document.getElementById('tk-upload-cover-input');
    const coverImg = document.getElementById('tk-upload-cover-img');

    if (coverBtn && coverInput) {
        coverBtn.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') coverInput.click();
        });
        
        coverInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (coverImg) {
                        coverImg.src = ev.target.result;
                        coverImg.style.display = 'block';
                    }
                    const div = coverBtn.querySelector('div');
                    if (div) div.style.display = 'none';
                };
                reader.readAsDataURL(file);
            }
            e.target.value = '';
        });
    }

});
