// 8. Sub Channel View Logic
    const subChannelBackBtn = document.getElementById('sub-channel-back-btn');
    const subChannelContent = document.getElementById('sub-channel-content');
    const subChannelSubscribeBtn = document.getElementById('sub-channel-subscribe-btn');

    let currentSubChannelData = null;

    function escapeYtChannelHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[char]));
    }

    function openSubChannelView(sub) {
        try {
            if (!subChannelView) return;
            currentSubChannelData = sub;
            if (typeof window.ensureYtFixedCharFanGroup === 'function' && !sub.isBusiness) {
                const previousGroup = sub.generatedContent?.fanGroup;
                const previousName = previousGroup?.name;
                const previousCountSource = previousGroup?.memberCountSource;
                const memberCountMigrationPending = previousGroup?._memberCountMigrationPending === true;
                window.ensureYtFixedCharFanGroup(sub);
                if (memberCountMigrationPending) delete sub.generatedContent.fanGroup._memberCountMigrationPending;
                if (previousName !== sub.generatedContent?.fanGroup?.name || previousCountSource !== 'frontend' || memberCountMigrationPending) {
                    if (typeof saveYoutubeData === 'function') {
                        saveYoutubeData();
                        sub = mockSubscriptions.find(item => item.id === sub.id) || sub;
                        currentSubChannelData = sub;
                    }
                }
            }

            const nameEl = document.getElementById('sub-channel-name');
            if (nameEl) nameEl.textContent = sub.name || '未知';

            const handleEl = document.getElementById('sub-channel-handle');
            if (handleEl) {
                const handleText = sub.handle || (sub.name ? sub.name.toLowerCase().replace(/\s+/g, '') : 'unknown');
                handleEl.textContent = `@${handleText}`;
            }

            const avatarEl = document.getElementById('sub-channel-avatar');
            if (avatarEl) {
                avatarEl.src = typeof resolveYtChannelAvatar === 'function'
                    ? resolveYtChannelAvatar(sub)
                    : (sub.avatar || 'https://picsum.photos/80/80?grayscale');
                avatarEl.style.display = 'block';
            }
            
            const subBannerEl = document.getElementById('sub-channel-banner');
            if (subBannerEl) {
                if (sub.banner) {
                    subBannerEl.style.backgroundImage = `url('${sub.banner}')`;
                } else {
                    subBannerEl.style.backgroundImage = 'none';
                }
            }
            
            const displaySubs = sub.subs || '1.2万';
            const displayVideos = sub.videos || '45';
            
            const subsEl = document.getElementById('sub-channel-subs');
            if (subsEl) subsEl.textContent = `${displaySubs} 订阅者`;
            
            const videosEl = document.getElementById('sub-channel-videos');
            if (videosEl) videosEl.textContent = `${displayVideos} 视频`;
            
            if (subChannelContent) subChannelContent.innerHTML = ``;
            
            const tabsContainer = document.getElementById('sub-channel-tabs');
            if (tabsContainer) {
                const tabs = tabsContainer.querySelectorAll('.yt-sliding-tab');
                tabs.forEach(t => t.classList.remove('active'));
                if (tabs.length > 0) {
                    tabs[0].classList.add('active');
                    const indicator = tabsContainer.querySelector('.yt-tab-indicator');
                    if (indicator) updateSlidingIndicator(tabs[0], indicator);
                }
            }

            const foundSub = mockSubscriptions.find(s => s.id === sub.id);
            const isSubbed = foundSub && foundSub.isSubscribed !== false;
            if (subChannelSubscribeBtn) {
                if (isSubbed) {
                    subChannelSubscribeBtn.textContent = '已订阅';
                    subChannelSubscribeBtn.classList.add('subscribed');
                } else {
                    subChannelSubscribeBtn.textContent = '订阅';
                    subChannelSubscribeBtn.classList.remove('subscribed');
                }
            }

            if (typeof window.releaseYtChatKeyboardLock === 'function') window.releaseYtChatKeyboardLock();
            subChannelView.classList.add('active');
            window.resetYtViewportOffset?.();
            
            if(sub.generatedContent) {
                renderGeneratedContent('live');
            } else {
                renderGeneratedContent('live'); 
            }
            
            // Add click listener to video cards inside sub-channel
            setTimeout(() => {
                const subVideoCards = subChannelContent.querySelectorAll('.yt-video-card');
                subVideoCards.forEach(card => {
                    card.addEventListener('click', () => {
                        const titleEl = card.querySelector('.yt-video-title');
                        if(titleEl) {
                            const video = mockVideos.find(v => v.title === titleEl.textContent && v.channelData && v.channelData.id === sub.id);
                            if(video) openVideoPlayer(video);
                        }
                    });
                });
            }, 100);
        } catch (e) {
            console.error("Error opening sub channel view:", e);
            if(window.showToast) window.showToast('无法打开主页，出现异常');
        }
    }

    if (subChannelBackBtn) {
        subChannelBackBtn.addEventListener('click', () => {
            if (typeof window.releaseYtChatKeyboardLock === 'function') window.releaseYtChatKeyboardLock();
            if (subChannelView) subChannelView.classList.remove('active');
            window.resetYtViewportOffset?.();
        });
    }

    if (subChannelSubscribeBtn) {
        subChannelSubscribeBtn.addEventListener('click', function() {
            if (!currentSubChannelData) return;

            const subId = currentSubChannelData.id;
            const existingIndex = mockSubscriptions.findIndex(s => s.id === subId);

            if (this.classList.contains('subscribed')) {
                this.classList.remove('subscribed');
                this.textContent = '订阅';
                
                if (existingIndex > -1) {
                    mockSubscriptions[existingIndex].isSubscribed = false;
                    const realSubs = mockSubscriptions.filter(s => s.isSubscribed !== false);
                    hasSubscriptions = realSubs.length > 0;
                    renderSubscriptions(); 
                    
                    // Bug Fix: Update the list visually
                    renderVideos();
                }
            } else {
                this.classList.add('subscribed');
                this.textContent = '已订阅';
                
                if (existingIndex === -1) {
                    currentSubChannelData.isSubscribed = true;
                    mockSubscriptions.push(currentSubChannelData);
                } else {
                    mockSubscriptions[existingIndex].isSubscribed = true;
                }
                hasSubscriptions = true;
                renderSubscriptions();
                renderVideos();
            }
            saveYoutubeData();
        });
    }

    function updateSlidingIndicator(activeTab, indicator) {
        if (!activeTab || !indicator) return;
        indicator.style.width = `${activeTab.offsetWidth}px`;
        indicator.style.transform = `translateX(${activeTab.offsetLeft}px)`;
    }

    function initSlidingTabs(containerId, onChangeCallback) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const tabs = container.querySelectorAll('.yt-sliding-tab');
        const indicator = container.querySelector('.yt-tab-indicator');

        setTimeout(() => {
            const active = container.querySelector('.yt-sliding-tab.active') || tabs[0];
            updateSlidingIndicator(active, indicator);
        }, 50);

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                updateSlidingIndicator(tab, indicator);
                if (onChangeCallback) {
                    onChangeCallback(tab.getAttribute('data-target') || tab.textContent.trim());
                }
            });
        });
    }

    initSlidingTabs('profile-main-tabs', (target) => {
        const container = document.getElementById('yt-profile-content-list');
        if(!container) return;
        
        container.innerHTML = '';
        
        if(target === 'live') {
            const activeLive = mockVideos.find(v => v.channelData && v.channelData.id === 'user_channel_id');
            if (activeLive) {
                const el = document.createElement('div');
                el.innerHTML = `
                    <div class="yt-video-card yt-live-pin-card" style="margin: 16px;">
                        <div class="yt-video-thumbnail">
                            <img src="${activeLive.thumbnail}" alt="Live">
                            <div class="yt-live-badge"><i class="fas fa-broadcast-tower" style="font-size: 10px;"></i> LIVE</div>
                        </div>
                        <div class="yt-video-info" style="padding: 12px;">
                            <div class="yt-video-details">
                                <h3 class="yt-video-title">${activeLive.title || '无标题'}</h3>
                                <p class="yt-video-meta">${activeLive.views || '正在观看'}</p>
                            </div>
                        </div>
                    </div>
                `;
                el.querySelector('.yt-video-card').addEventListener('click', () => {
                    if (typeof window.openYtUserLiveView === 'function') window.openYtUserLiveView();
                    else {
                        const userLiveView = document.getElementById('yt-user-live-view');
                        if (userLiveView) userLiveView.classList.add('active');
                    }
                });
                container.appendChild(el);
            } else {
                container.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; padding: 40px 20px; color: #8e8e93;">
                        <i class="fas fa-video-slash" style="font-size: 40px; margin-bottom: 10px; color: #d1d1d6;"></i>
                        <p style="font-size: 14px;">暂未开播</p>
                    </div>
                `;
            }
        } else if (target === 'past') {
            if (channelState.pastVideos && channelState.pastVideos.length > 0) {
                const listWrapper = document.createElement('div');
                listWrapper.className = 'yt-history-list';
                listWrapper.style.padding = '16px';
                let upgradedUserReplays = false;
                channelState.pastVideos.forEach((video, videoIndex) => {
                    if (!video.id) {
                        video.id = `yt-user-replay-${Date.now()}-${videoIndex}-${Math.random().toString(36).slice(2, 7)}`;
                        upgradedUserReplays = true;
                    }
                    if (video.isLiveReplay !== true) {
                        video.isLiveReplay = true;
                        upgradedUserReplays = true;
                    }
                    if (!Number.isFinite(Number(video.realtimeCommentCount))) {
                        video.realtimeCommentCount = Array.isArray(video.comments) ? video.comments.length : 0;
                        upgradedUserReplays = true;
                    }
                    if (!Array.isArray(video.liveTranscript)) {
                        video.liveTranscript = [];
                        upgradedUserReplays = true;
                    }
                });
                if (upgradedUserReplays) saveYoutubeData();
                
                channelState.pastVideos.forEach((v, index) => {
                    const item = document.createElement('div');
                    item.className = 'yt-history-item';
                    item.style.position = 'relative';
                    item.innerHTML = `
                        <div class="yt-history-thumb">
                            <img src="${v.thumbnail}" alt="VOD">
                            <div class="yt-history-time">${Math.floor(Math.random() * 2)+1}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}</div>
                        </div>
                        <div class="yt-history-info">
                            <h3 class="yt-history-title">${v.title || '无标题'}</h3>
                            <p class="yt-history-meta">${v.views || '0 次观看'} • ${v.time || '刚刚'}</p>
                        </div>
                    `;
                    item.addEventListener('click', (e) => {
                        openVideoPlayer({
                            id: v.id,
                            isLiveReplay: true,
                            realtimeCommentCount: Number(v.realtimeCommentCount) || 0,
                            liveTranscript: Array.isArray(v.liveTranscript) ? v.liveTranscript : [],
                            time: v.time || '刚刚',
                            title: v.title,
                            views: v.views,
                            thumbnail: v.thumbnail,
                            isLive: false,
                            guest: v.guest || null,
                            channelData: {
                                id: 'user_channel_id',
                                name: ytUserState ? ytUserState.name : '我',
                                avatar: ytUserState ? ytUserState.avatarUrl : 'https://picsum.photos/80/80?grayscale',
                                subs: ytUserState ? ytUserState.subs : '0',
                                desc: ytUserState ? ytUserState.persona : ''
                            },
                            comments: v.comments || []
                        });
                    });
                    listWrapper.appendChild(item);
                });
                container.appendChild(listWrapper);
            } else {
                container.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; padding: 40px 20px; color: #8e8e93;">
                        <i class="fas fa-film" style="font-size: 40px; margin-bottom: 10px; color: #d1d1d6;"></i>
                        <p style="font-size: 14px;">暂无往期视频</p>
                    </div>
                `;
            }
        } else if (target === 'community') {
            const posts = Array.isArray(channelState.communityPosts) ? channelState.communityPosts : [];
            if (posts.length === 0) {
                container.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; padding: 40px 20px; color: #8e8e93;">
                        <i class="fas fa-users" style="font-size: 40px; margin-bottom: 10px; color: #d1d1d6;"></i>
                        <p style="font-size: 14px;">暂无社群动态</p>
                    </div>
                `;
                return;
            }
            const effectiveUser = typeof window.getYtEffectiveUserState === 'function'
                ? window.getYtEffectiveUserState()
                : (ytUserState || {});
            posts.forEach(post => {
                const syncedLikes = typeof window.syncYtPostLikeGrowth === 'function'
                    ? window.syncYtPostLikeGrowth(post)
                    : Math.max(0, Number(post.likes) || 0);
                const item = document.createElement('div');
                item.className = 'yt-community-post';
                item.style.cursor = 'pointer';
                const status = post.commentsStatus === 'loading'
                    ? '<span style="color:#8e8e93;"><i class="fas fa-circle-notch fa-spin"></i> 评论生成中</span>'
                    : (post.commentsStatus === 'failed' ? '<span style="color:#ff3b30;">评论生成失败</span>' : '');
                const commentCount = typeof window.countYtPostComments === 'function'
                    ? window.countYtPostComments(post)
                    : (Array.isArray(post.comments) ? post.comments.length : (Number(post.commentsCount) || 0));
                const likeCount = typeof window.formatYtPostLikeCount === 'function'
                    ? window.formatYtPostLikeCount(syncedLikes)
                    : String(syncedLikes);
                const postTranslationZh = String(post.translationZh || post.contentTranslationZh || post.translation || '').trim();
                item.innerHTML = `
                    <div style="display:flex;align-items:center;margin-bottom:10px;gap:10px;">
                        <div class="yt-video-avatar" style="width:36px;height:36px;">${effectiveUser.avatarUrl ? `<img src="${escapeYtChannelHtml(effectiveUser.avatarUrl)}">` : '<i class="fas fa-user" style="color:#8e8e93;"></i>'}</div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:14px;font-weight:500;">${escapeYtChannelHtml(effectiveUser.name || '我的频道')}</div>
                            <div style="font-size:11px;color:#606060;">${escapeYtChannelHtml(post.time || '刚刚')}</div>
                        </div>
                        <div style="font-size:11px;">${status}</div>
                    </div>
                    <div class="yt-community-post-content" style="white-space:pre-wrap;">${escapeYtChannelHtml(post.content || '')}</div>
                    ${postTranslationZh ? `
                        <button type="button" class="yt-post-content-translation-btn" aria-expanded="false" style="border:none;background:transparent;color:#606060;padding:6px 0 0;font-size:12px;font-weight:600;cursor:pointer;">翻译</button>
                        <div class="yt-post-content-translation" hidden style="margin:6px 0 0;padding:8px 10px;border-radius:10px;background:#f2f2f7;color:#3a3a3c;font-size:13px;line-height:1.45;">${escapeYtChannelHtml(postTranslationZh)}</div>
                    ` : ''}
                    ${post.imageUrl ? `<img src="${escapeYtChannelHtml(post.imageUrl)}" alt="贴文图片" style="display:block;width:100%;max-height:360px;object-fit:cover;border-radius:16px;margin-bottom:12px;">` : ''}
                    <div class="yt-community-post-actions">
                        <div class="yt-community-post-action"><i class="far fa-thumbs-up"></i> ${likeCount}</div>
                        <div class="yt-community-post-action"><i class="far fa-thumbs-down"></i></div>
                        <div class="yt-community-post-action"><i class="far fa-comment"></i> ${commentCount}</div>
                    </div>
                `;
                item.querySelectorAll('.yt-post-content-translation-btn').forEach(button => {
                    button.addEventListener('click', event => {
                        event.stopPropagation();
                        const translation = button.nextElementSibling;
                        if (!translation) return;
                        const isExpanded = translation.hasAttribute('hidden');
                        if (isExpanded) translation.removeAttribute('hidden');
                        else translation.setAttribute('hidden', '');
                        button.textContent = isExpanded ? '收起翻译' : '翻译';
                        button.setAttribute('aria-expanded', String(isExpanded));
                    });
                });
                item.addEventListener('click', () => window.openYtUserCommunityPost?.(post));
                container.appendChild(item);
            });
        }
    });

    initSlidingTabs('sub-channel-tabs', (target) => {
        renderGeneratedContent(target);
    });

    const addYtCharSheet = document.getElementById('add-yt-char-sheet');
    const ytCharAvatarWrapper = document.getElementById('yt-char-avatar-wrapper');
    const ytCharAvatarUpload = document.getElementById('yt-char-avatar-upload');
    const ytCharAvatarImg = document.getElementById('yt-char-avatar-img');
    const ytCharBannerBtn = document.getElementById('yt-char-banner-btn');
    const ytCharBannerUpload = document.getElementById('yt-char-banner-upload');
    const ytCharBannerImg = document.getElementById('yt-char-banner-img');
    const confirmAddYtCharBtn = document.getElementById('confirm-add-yt-char-btn');
    const charNameInput = document.getElementById('yt-char-name-input');
    const charHandleInput = document.getElementById('yt-char-handle-input');
    const charDescInput = document.getElementById('yt-char-desc-input');
    const charSubsInput = document.getElementById('yt-char-subs-input');
    const charVideosInput = document.getElementById('yt-char-videos-input');
    const charAvatarIcon = document.getElementById('yt-char-avatar-preview')?.querySelector('i');
    const imCharPickerSection = document.getElementById('yt-im-char-picker-section');
    const imCharPickerList = document.getElementById('yt-im-char-picker-list');

    let isEditingChar = false;
    let selectedImCharId = null;

    function getImportableImChars() {
        const friends = typeof window.getImFriends === 'function'
            ? window.getImFriends()
            : (window.imData && Array.isArray(window.imData.friends) ? window.imData.friends : []);
        return (Array.isArray(friends) ? friends : []).filter(friend => friend && friend.type === 'char');
    }

    function normalizeHandleFromName(name) {
        return String(name || 'channel')
            .trim()
            .replace(/^@/, '')
            .replace(/\s+/g, '')
            .replace(/[^\w\u4e00-\u9fa5.-]/g, '')
            .toLowerCase() || 'channel';
    }

    function findYtChannelByImCharId(imCharId, options = {}) {
        if (imCharId === undefined || imCharId === null || imCharId === '') return null;
        const includeUnsubscribed = !!options.includeUnsubscribed;
        return mockSubscriptions.find(sub => {
            if (!sub || String(sub.imCharId || '') !== String(imCharId)) return false;
            return includeUnsubscribed || sub.isSubscribed !== false;
        }) || null;
    }

    function fillYtCharFormFromImChar(friend) {
        if (!friend) return;
        selectedImCharId = friend.id;
        const displayName = friend.nickname || friend.realName || friend.name || 'Char';
        if (charNameInput) charNameInput.value = displayName;
        if (charHandleInput) charHandleInput.value = normalizeHandleFromName(displayName);
        if (charDescInput) charDescInput.value = friend.persona || friend.signature || '';

        if (friend.avatarUrl && ytCharAvatarImg) {
            ytCharAvatarImg.src = friend.avatarUrl;
            ytCharAvatarImg.style.display = 'block';
            if (charAvatarIcon) charAvatarIcon.style.display = 'none';
        }
    }

    function renderImCharPicker() {
        if (!imCharPickerSection || !imCharPickerList) return;

        const chars = getImportableImChars();
        imCharPickerList.innerHTML = '';

        if (chars.length === 0) {
            imCharPickerSection.style.display = 'none';
            return;
        }

        imCharPickerSection.style.display = 'block';
        chars.forEach((friend) => {
            const activeYtChannel = findYtChannelByImCharId(friend.id);
            const isAlreadyAdded = !!activeYtChannel;
            const item = document.createElement('div');
            item.style.cssText = `width:64px; flex:0 0 64px; display:flex; flex-direction:column; align-items:center; gap:6px; cursor:${isAlreadyAdded ? 'not-allowed' : 'pointer'}; opacity:${isAlreadyAdded ? '0.48' : '1'};`;
            const name = friend.nickname || friend.realName || friend.name || 'Char';
            if (friend.avatarUrl) {
                const avatar = document.createElement('img');
                avatar.src = friend.avatarUrl;
                avatar.style.cssText = `width:48px; height:48px; border-radius:50%; object-fit:cover; background:#f2f2f2; filter:${isAlreadyAdded ? 'grayscale(1)' : 'none'};`;
                item.appendChild(avatar);
            } else {
                const fallback = document.createElement('div');
                fallback.style.cssText = `width:48px; height:48px; border-radius:50%; background:#f2f2f2; display:flex; align-items:center; justify-content:center; color:#8e8e93; font-weight:700; filter:${isAlreadyAdded ? 'grayscale(1)' : 'none'};`;
                fallback.textContent = String(name).charAt(0);
                item.appendChild(fallback);
            }
            const label = document.createElement('div');
            label.style.cssText = 'max-width:64px; font-size:11px; color:#0f0f0f; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
            label.textContent = name;
            item.appendChild(label);
            if (isAlreadyAdded) {
                const addedLabel = document.createElement('div');
                addedLabel.style.cssText = 'font-size:10px; color:#8e8e93; line-height:1;';
                addedLabel.textContent = '已添加';
                item.appendChild(addedLabel);
                item.title = '该 Char 已有 YouTube 频道';
            }
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isAlreadyAdded) return;
                fillYtCharFormFromImChar(friend);
            });
            imCharPickerList.appendChild(item);
        });
    }

    function openCustomCharSheet(charData = null) {
        if(addYtCharSheet) {
            renderImCharPicker();
            if (charData) {
                isEditingChar = true;
                selectedImCharId = charData.imCharId || null;
                const titleEl = addYtCharSheet.querySelector('.sheet-title');
                if(titleEl) titleEl.textContent = '编辑频道角色';
                if(confirmAddYtCharBtn) confirmAddYtCharBtn.textContent = '保存修改';
                
                if(charNameInput) charNameInput.value = charData.name || '';
                if(charHandleInput) charHandleInput.value = (charData.handle || charData.name.toLowerCase().replace(/\s+/g, '')) || '';
                if(charDescInput) charDescInput.value = charData.desc || '';
                if(charSubsInput) charSubsInput.value = charData.subs || '';
                if(charVideosInput) charVideosInput.value = charData.videos || '';
                
                const resolvedAvatar = typeof resolveYtChannelAvatar === 'function'
                    ? resolveYtChannelAvatar(charData)
                    : charData.avatar;
                if(ytCharAvatarImg && resolvedAvatar) {
                    ytCharAvatarImg.src = resolvedAvatar;
                    ytCharAvatarImg.style.display = 'block';
                    if(charAvatarIcon) charAvatarIcon.style.display = 'none';
                }
                
                if(ytCharBannerImg && charData.banner) {
                    ytCharBannerImg.src = charData.banner;
                    ytCharBannerImg.style.display = 'block';
                } else if (ytCharBannerImg) {
                    ytCharBannerImg.style.display = 'none';
                }
            } else {
                isEditingChar = false;
                selectedImCharId = null;
                const titleEl = addYtCharSheet.querySelector('.sheet-title');
                if(titleEl) titleEl.textContent = '自定义频道角色';
                if(confirmAddYtCharBtn) confirmAddYtCharBtn.textContent = '生成频道并开播';
                
                if(charNameInput) charNameInput.value = '';
                if(charHandleInput) charHandleInput.value = '';
                if(charDescInput) charDescInput.value = '';
                if(charSubsInput) charSubsInput.value = '';
                if(charVideosInput) charVideosInput.value = '';
                
                if(ytCharAvatarImg) { ytCharAvatarImg.src = ''; ytCharAvatarImg.style.display = 'none'; }
                if(charAvatarIcon) charAvatarIcon.style.display = 'block';
                if(ytCharBannerImg) { ytCharBannerImg.src = ''; ytCharBannerImg.style.display = 'none'; }
            }
            
            addYtCharSheet.classList.add('active');
        }
    }

    const mainSearchBtn = document.getElementById('yt-main-search-btn');
    const mainSettingsBtn = document.getElementById('yt-main-settings-btn');
    
    const openCreateSheetHandler = (e) => {
        e.stopPropagation();
        openCustomCharSheet(null);
    };

    const openYoutubeSettingsHandler = (e) => {
        e.stopPropagation();
        if (typeof updateYtBoundWorldBookLabel === 'function') {
            updateYtBoundWorldBookLabel();
        }
        const ytSettingsSheet = document.getElementById('yt-settings-sheet');
        if (ytSettingsSheet) ytSettingsSheet.classList.add('active');
    };

    if (mainSearchBtn) mainSearchBtn.addEventListener('click', openCreateSheetHandler);
    if (mainSettingsBtn) mainSettingsBtn.addEventListener('click', openYoutubeSettingsHandler);

    const charEditBtn = document.getElementById('yt-char-edit-btn');
    if (charEditBtn) {
        charEditBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentSubChannelData) {
                openCustomCharSheet(currentSubChannelData);
            }
        });
    }

    if (ytCharAvatarWrapper && ytCharAvatarUpload) {
        ytCharAvatarWrapper.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                e.preventDefault();
                ytCharAvatarUpload.click();
            }
        });
        ytCharAvatarUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (window.compressImage) {
                        window.compressImage(event.target.result, 300, 300, (compressedUrl) => {
                            if(ytCharAvatarImg) {
                                ytCharAvatarImg.src = compressedUrl;
                                ytCharAvatarImg.style.display = 'block';
                            }
                            if(charAvatarIcon) charAvatarIcon.style.display = 'none';
                        });
                    } else {
                        if(ytCharAvatarImg) {
                            ytCharAvatarImg.src = event.target.result;
                            ytCharAvatarImg.style.display = 'block';
                        }
                        if(charAvatarIcon) charAvatarIcon.style.display = 'none';
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (ytCharBannerBtn && ytCharBannerUpload) {
        ytCharBannerBtn.addEventListener('click', () => ytCharBannerUpload.click());
        ytCharBannerUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (window.compressImage) {
                        window.compressImage(event.target.result, 800, 800, (compressedUrl) => {
                            if (ytCharBannerImg) {
                                ytCharBannerImg.src = compressedUrl;
                                ytCharBannerImg.style.display = 'block';
                            }
                        });
                    } else {
                        if (ytCharBannerImg) {
                            ytCharBannerImg.src = event.target.result;
                            ytCharBannerImg.style.display = 'block';
                        }
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (confirmAddYtCharBtn) {
        confirmAddYtCharBtn.addEventListener('click', async () => {
            const name = charNameInput?.value.trim() || '神秘新星';
            const handle = charHandleInput?.value.trim() || name.toLowerCase().replace(/\s+/g, '');
            const desc = charDescInput?.value.trim() || '这个频道很神秘，什么都没写...';
            const subs = charSubsInput?.value.trim() || '1.2万';
            const videos = charVideosInput?.value.trim() || '10';
            
            let avatarUrl = 'https://picsum.photos/seed/' + Math.random() + '/80/80?grayscale';
            if (ytCharAvatarImg && ytCharAvatarImg.style.display === 'block' && ytCharAvatarImg.src) {
                avatarUrl = ytCharAvatarImg.src;
            } else if (isEditingChar && currentSubChannelData && currentSubChannelData.avatar) {
                avatarUrl = currentSubChannelData.avatar; 
            }

            let bannerUrl = null;
            if (ytCharBannerImg && ytCharBannerImg.style.display === 'block' && ytCharBannerImg.src) {
                bannerUrl = ytCharBannerImg.src;
            } else if (isEditingChar && currentSubChannelData && currentSubChannelData.banner) {
                bannerUrl = currentSubChannelData.banner;
            }

            if (isEditingChar && currentSubChannelData) {
                // Update
                currentSubChannelData.name = name;
                currentSubChannelData.handle = handle;
                currentSubChannelData.desc = desc;
                currentSubChannelData.subs = subs;
                currentSubChannelData.videos = videos;
                currentSubChannelData.avatar = avatarUrl;
                currentSubChannelData.banner = bannerUrl;
                currentSubChannelData.imCharId = selectedImCharId;
                
                const subIndex = mockSubscriptions.findIndex(s => s.id === currentSubChannelData.id);
                if (subIndex > -1) {
                    mockSubscriptions[subIndex] = currentSubChannelData;
                }

                renderSubscriptions();
                openSubChannelView(currentSubChannelData);
                if (window.showToast) window.showToast('角色信息已更新！');
                
            } else {
                const existingUnsubscribedChannel = selectedImCharId
                    ? findYtChannelByImCharId(selectedImCharId, { includeUnsubscribed: true })
                    : null;

                if (existingUnsubscribedChannel && existingUnsubscribedChannel.isSubscribed !== false) {
                    renderSubscriptions();
                    openSubChannelView(existingUnsubscribedChannel);
                    if (window.showToast) window.showToast('该 Char 已有 YouTube 频道');
                } else if (existingUnsubscribedChannel && existingUnsubscribedChannel.isSubscribed === false) {
                    existingUnsubscribedChannel.name = name;
                    existingUnsubscribedChannel.handle = handle;
                    existingUnsubscribedChannel.desc = desc;
                    existingUnsubscribedChannel.subs = subs;
                    existingUnsubscribedChannel.videos = videos;
                    existingUnsubscribedChannel.avatar = avatarUrl;
                    existingUnsubscribedChannel.banner = bannerUrl;
                    existingUnsubscribedChannel.imCharId = selectedImCharId;
                    existingUnsubscribedChannel.isSubscribed = true;
                    hasSubscriptions = true;
                    renderSubscriptions();
                    openSubChannelView(existingUnsubscribedChannel);
                    if (window.showToast) window.showToast('已恢复该 Char 的 YouTube 频道！');
                } else {
                    // Create
                    const newCharData = {
                        id: 'char_custom_' + Date.now(),
                        name: name,
                        handle: handle,
                        avatar: avatarUrl,
                        banner: bannerUrl,
                        imCharId: selectedImCharId,
                        isLive: true,
                        desc: desc,
                        subs: subs,
                        videos: videos,
                        isFriend: false,
                        isBusiness: false,
                        isSubscribed: true // Default subscribed
                    };

                    if (!mockSubscriptions.some(s => s.id === newCharData.id)) {
                        mockSubscriptions.push(newCharData);
                        hasSubscriptions = true;
                    }

                    renderSubscriptions();
                    openSubChannelView(newCharData);
                    if (window.showToast) window.showToast('频道已生成，默认已订阅！');
                }
            }
            saveYoutubeData();
            if(addYtCharSheet) addYtCharSheet.classList.remove('active');
        });
    }

    if (addYtCharSheet) {
        addYtCharSheet.addEventListener('mousedown', (e) => {
            if (e.target === addYtCharSheet) {
                addYtCharSheet.classList.remove('active');
            }
        });
    }

    window.openSubChannelView = openSubChannelView;
    window.openCustomCharSheet = openCustomCharSheet;
