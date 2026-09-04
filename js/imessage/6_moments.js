// ==========================================
// IMESSAGE: 6. MOMENTS (朋友圈)
// ==========================================

(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(async () => {
    const { apiConfig, openView, closeView, showToast } = window;

    const momentsContent = document.getElementById('moments-content');
    const navMomentsBtn = document.getElementById('nav-moments-btn');
    const imBottomNavContainer = document.querySelector('.line-bottom-nav-container');
    const momentsScrollContainer = document.getElementById('moments-scroll-container');
    const NO_USER_SELF_COMMENT_RULE = [
        'Hard rule: never generate the current User as a public commenter, liker, reply speaker, or NPC.',
        'Public moment comments and nested comment replies must only be spoken by the current character or the explicitly allowed NPC speakers.',
        'If the output format contains speakerId/name/commenter/liker, it must not refer to User, me, self, or the user persona.',
        'This rule overrides any other instruction that would allow User to like, comment, or reply.'
    ].join('\n');
    const momentsUtils = window.imDataUtils || {};

    function normalizeMomentLanguage(value) {
        return momentsUtils.normalizeChatLanguage
            ? momentsUtils.normalizeChatLanguage(value)
            : (String(value || '').trim().toLowerCase() || 'zh');
    }

    function getMomentLanguageName(value) {
        return momentsUtils.getChatLanguageName
            ? momentsUtils.getChatLanguageName(value)
            : normalizeMomentLanguage(value);
    }

    function buildMomentLanguageContract(language, subject) {
        return momentsUtils.buildLocalizedJsonContract
            ? momentsUtils.buildLocalizedJsonContract(language, subject)
            : `${subject}.text must follow the speaker language and include a Simplified Chinese translation when non-Chinese.`;
    }

    function normalizeMomentLocalizedContent(value, language, options = {}) {
        if (momentsUtils.normalizeLocalizedContent) {
            return momentsUtils.normalizeLocalizedContent(value, language, options);
        }
        const text = String(value?.text ?? value?.content ?? value ?? '').trim();
        const translation = String(value?.translation ?? value?.translationZh ?? '').trim();
        return text ? { text, translation, language: normalizeMomentLanguage(language) } : null;
    }

    function setTranslationExpanded(button, translationEl, expanded) {
        if (!button || !translationEl) return;
        translationEl.style.display = expanded ? 'block' : 'none';
        button.textContent = expanded ? '收起' : '翻译';
        button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    function bindTranslationButton(button, translationEl) {
        if (!button || !translationEl) return;
        const toggle = (event) => {
            event.preventDefault();
            event.stopPropagation();
            setTranslationExpanded(button, translationEl, translationEl.style.display !== 'block');
        };
        button.addEventListener('click', toggle);
        button.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') toggle(event);
        });
    }

    if (window.imApp && window.imApp.ensureDataReady) {
        await window.imApp.ensureDataReady();
    }

    async function ensureMomentsModuleDataReady() {
        if (window.imApp?.ensureMomentsReady) {
            await window.imApp.ensureMomentsReady();
        }
    }

    async function ensureMomentMessagesModuleDataReady() {
        if (window.imApp?.ensureMomentMessagesReady) {
            await window.imApp.ensureMomentMessagesReady();
        }
    }

    function getCurrentMomentApiConfig() {
        return window.getApiConfig ? window.getApiConfig() : (window.apiConfig || apiConfig || {});
    }

    function hasCurrentMomentApiConfig(config = getCurrentMomentApiConfig()) {
        return Boolean(config?.endpoint && config?.apiKey);
    }

    function createMomentExternalImageUrl(image, fallbackSeed = '') {
        const source = image && typeof image === 'object' ? image : {};
        const seed = String(source.seed || source.desc || fallbackSeed || Date.now()).trim();
        return `https://picsum.photos/seed/${encodeURIComponent(`moment_${seed}`)}/900/900?grayscale`;
    }

    function normalizeMomentImageDescription(value) {
        const description = String(value || '').trim();
        return /[\u3400-\u9fff]/.test(description) ? description : '';
    }

    function getMomentImageSource(image) {
        if (!image || typeof image !== 'object') return image || '';
        const description = String(image.desc || '').trim();
        const isDescriptionImage = image.kind === 'description'
            || (description && /^data:image\/png;base64,/i.test(String(image.src || '')));
        return isDescriptionImage || image.kind === 'external'
            ? createMomentExternalImageUrl(image, description)
            : (image.src || '');
    }

    function openMomentImageDetail(image, moment) {
        const src = getMomentImageSource(image);
        if (!src) return;
        let overlay = document.getElementById('moment-image-detail-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'moment-image-detail-overlay';
            overlay.className = 'moment-image-detail-overlay';
            overlay.innerHTML = `
                <div class="moment-image-detail-card">
                    <div class="moment-image-detail-header">
                        <div class="moment-image-detail-author"></div>
                        <span class="moment-image-detail-close" role="button" tabindex="0" aria-label="关闭"><i class="fas fa-times"></i></span>
                    </div>
                    <div class="moment-image-detail-media"><img src="" alt=""></div>
                    <div class="moment-image-detail-copy">
                        <div class="moment-image-detail-label">图片详情</div>
                        <div class="moment-image-detail-description"></div>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            const close = () => {
                overlay.classList.remove('active');
                setTimeout(() => { overlay.style.display = 'none'; }, 180);
            };
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay || event.target.closest('.moment-image-detail-close')) close();
            });
            overlay.querySelector('.moment-image-detail-close')?.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') close();
            });
        }
        overlay.querySelector('.moment-image-detail-media img').src = src;
        overlay.querySelector('.moment-image-detail-author').textContent = moment?.name || moment?.userName || '';
        const description = String(image?.desc || '').trim();
        const copy = overlay.querySelector('.moment-image-detail-copy');
        const descriptionEl = overlay.querySelector('.moment-image-detail-description');
        if (descriptionEl) descriptionEl.textContent = description;
        if (copy) copy.style.display = description ? 'block' : 'none';
        overlay.style.display = 'flex';
        requestAnimationFrame(() => overlay.classList.add('active'));
    }

    // --- Moments Main Logic ---
    function getMomentMessages() {
        if (window.imApp.getMomentMessages) {
            return window.imApp.getMomentMessages();
        }
        return Array.isArray(window.imData.momentMessages) ? window.imData.momentMessages : [];
    }

    function getMomentMessageAuthor(msg) {
        const friend = (window.imData.friends || []).find((item) => {
            if (!item || !msg) return false;
            return String(item.id) === String(msg.userId);
        });

        return {
            name: friend?.nickname || friend?.realName || msg?.userName || 'Friend',
            avatar: friend?.avatarUrl || msg?.userAvatar || null
        };
    }

    async function saveMomentMessagesNow() {
        if (window.imApp.saveMomentMessages) {
            return window.imApp.saveMomentMessages({ silent: true });
        }
        return false;
    }

    function getUnreadMomentMessages() {
        return getMomentMessages().filter((message) => message && message.read !== true);
    }

    function updateMomentsNewMessageBubble() {
        const bubble = document.getElementById('moments-new-message-bubble');
        if (!bubble) return;
        const unreadMessages = getUnreadMomentMessages();
        if (unreadMessages.length === 0) {
            bubble.style.display = 'none';
            return;
        }

        const latest = unreadMessages[0];
        const author = getMomentMessageAuthor(latest);
        const avatarEl = bubble.querySelector('.moments-new-message-avatar');
        const textEl = bubble.querySelector('.moments-new-message-text');
        if (avatarEl) {
            avatarEl.replaceChildren();
            if (author.avatar) {
                const image = document.createElement('img');
                image.src = author.avatar;
                image.alt = '';
                avatarEl.appendChild(image);
            } else {
                const icon = document.createElement('i');
                icon.className = 'fas fa-user';
                avatarEl.appendChild(icon);
            }
        }
        if (textEl) textEl.textContent = `${unreadMessages.length}条新消息`;
        bubble.style.display = 'flex';
    }

    async function markCurrentMomentMessagesRead() {
        const unreadIds = new Set(getUnreadMomentMessages().map((message) => String(message.id)));
        if (unreadIds.size === 0) return true;
        const previousMessages = cloneSnapshot(getMomentMessages());
        getMomentMessages().forEach((message) => {
            if (message && unreadIds.has(String(message.id))) message.read = true;
        });
        const saved = await saveMomentMessagesNow();
        if (!saved) {
            window.imData.momentMessages = previousMessages;
            updateMomentsNewMessageBubble();
            return false;
        }
        updateMomentsNewMessageBubble();
        return true;
    }

    function findMomentMessageIndex(targetMsg) {
        const messages = Array.isArray(window.imData.momentMessages) ? window.imData.momentMessages : [];
        const directIndex = messages.indexOf(targetMsg);
        if (directIndex > -1) return directIndex;

        if (targetMsg?.id != null) {
            const idIndex = messages.findIndex((msg) => msg && String(msg.id) === String(targetMsg.id));
            if (idIndex > -1) return idIndex;
        }

        return messages.findIndex((msg) => {
            if (!msg || !targetMsg) return false;
            return String(msg.type || '') === String(targetMsg.type || '') &&
                String(msg.userId || '') === String(targetMsg.userId || '') &&
                String(msg.momentId || '') === String(targetMsg.momentId || '') &&
                String(msg.time || '') === String(targetMsg.time || '') &&
                String(msg.content || '') === String(targetMsg.content || '');
        });
    }

    async function deleteMomentMessage(targetMsg) {
        if (!Array.isArray(window.imData.momentMessages)) return false;

        const previousMessages = cloneSnapshot(window.imData.momentMessages);
        const index = findMomentMessageIndex(targetMsg);
        if (index < 0) return false;

        window.imData.momentMessages.splice(index, 1);
        const saved = await saveMomentMessagesNow();
        if (!saved) {
            window.imData.momentMessages = previousMessages;
            return false;
        }
        return true;
    }

    async function deleteMomentPermanently(momentId) {
        if (window.imApp?.deleteMomentPermanently) {
            return window.imApp.deleteMomentPermanently(momentId, { silent: true });
        }

        await ensureMomentsModuleDataReady();
        await ensureMomentMessagesModuleDataReady();

        const safeMomentId = String(momentId);
        const previousMoments = cloneSnapshot(Array.isArray(window.imData.moments) ? window.imData.moments : []);
        const previousMessages = cloneSnapshot(Array.isArray(window.imData.momentMessages) ? window.imData.momentMessages : []);

        try {
            window.imData.moments = (Array.isArray(window.imData.moments) ? window.imData.moments : [])
                .filter((moment) => String(moment?.id) !== safeMomentId);
            window.imData.momentMessages = (Array.isArray(window.imData.momentMessages) ? window.imData.momentMessages : [])
                .filter((msg) => String(msg?.momentId) !== safeMomentId);

            if (window.imStorage?.deleteMoment) {
                const deleted = await window.imStorage.deleteMoment(momentId);
                if (deleted === false) throw new Error('deleteMoment failed');
            }

            if (window.imStorage?.saveMoments) {
                const savedMoments = await window.imStorage.saveMoments(window.imData.moments);
                if (savedMoments === false) throw new Error('saveMoments failed');
            } else {
                const savedMoment = window.imApp.saveMoments
                    ? await window.imApp.saveMoments({ silent: true })
                    : false;
                if (!savedMoment) throw new Error('saveMoments failed');
            }

            if (window.imStorage?.saveMomentMessages) {
                const savedMessages = await window.imStorage.saveMomentMessages(window.imData.momentMessages);
                if (savedMessages === false) throw new Error('saveMomentMessages failed');
            } else {
                const savedMessages = await saveMomentMessagesNow();
                if (!savedMessages) throw new Error('saveMomentMessages failed');
            }

            return true;
        } catch (error) {
            console.error('Fallback permanent moment delete failed:', error);
            window.imData.moments = previousMoments;
            window.imData.momentMessages = previousMessages;
            try {
                if (window.imStorage?.saveMoments) await window.imStorage.saveMoments(previousMoments);
                if (window.imStorage?.saveMomentMessages) await window.imStorage.saveMomentMessages(previousMessages);
            } catch (restoreError) {
                console.error('Fallback moment delete rollback failed:', restoreError);
            }
            return false;
        }
    }

    function cloneSnapshot(value) {
        if (typeof structuredClone === 'function') {
            return structuredClone(value);
        }
        return JSON.parse(JSON.stringify(value));
    }

    async function commitMomentsChange(momentId, mutator, options = {}) {
        if (!window.imApp.commitMomentChange) {
            const previousMoments = cloneSnapshot(window.imData.moments);
            if (typeof mutator === 'function') mutator();
            const saved = window.imApp.saveMoments
                ? await window.imApp.saveMoments({ silent: options.silent !== false })
                : false;
            if (!saved) {
                window.imData.moments = previousMoments;
                refreshAllMomentsViews();
                return false;
            }
            return true;
        }

        return window.imApp.commitMomentChange(momentId, mutator, {
            silent: options.silent !== false,
            immediate: options.immediate,
            delay: options.delay,
            onRollback: () => {
                refreshAllMomentsViews();
            }
        });
    }

    async function commitFriendsChange(friendOrId, mutator, options = {}) {
        if (window.imApp.commitFriendChange) {
            const targetId = typeof friendOrId === 'object' && friendOrId !== null ? friendOrId.id : friendOrId;
            return window.imApp.commitFriendChange(targetId, mutator, {
                silent: options.silent !== false,
                immediate: options.immediate,
                delay: options.delay,
                metaOnly: options.metaOnly,
                includeMessages: options.includeMessages
            });
        }

        if (!window.imApp.commitFriendsChange) {
            return false;
        }

        return window.imApp.commitFriendsChange(mutator, {
            silent: options.silent !== false,
            friendId: typeof friendOrId === 'object' && friendOrId !== null ? friendOrId.id : friendOrId,
            metaOnly: options.metaOnly,
            includeMessages: options.includeMessages
        });
    }

    function findMomentById(momentId) {
        return window.imData.moments.find((m) => m && String(m.id) === String(momentId)) || null;
    }

    function refreshViewsForMomentUser(moment) {
        renderMoments();
    }

    function refreshViewsAfterMomentComment(momentId) {
        const latestMoment = findMomentById(momentId);
        refreshViewsForMomentUser(latestMoment);
        if (
            latestMoment &&
            momentDetailOverlay &&
            momentDetailOverlay.classList.contains('active') &&
            currentDetailMoment &&
            String(currentDetailMoment.id) === String(momentId)
        ) {
            openMomentDetail(latestMoment);
        }
    }

    if (navMomentsBtn) {
        navMomentsBtn.addEventListener('click', async () => {
            await ensureMomentsModuleDataReady();
            await ensureMomentMessagesModuleDataReady();

            if (window.imApp.hideAllTabs) window.imApp.hideAllTabs();
            if (momentsContent) {
                momentsContent.style.display = 'flex';
                momentsContent.style.flexDirection = 'column';
                renderMoments();
                updateMomentsNewMessageBubble();

                if (imBottomNavContainer) imBottomNavContainer.style.display = 'flex';

                const imHeaderRight = document.querySelector('.line-header-right');
                if (imHeaderRight) imHeaderRight.style.display = 'none';
            }
            navMomentsBtn.classList.add('active');
            if (window.imApp.updateLineNavIndicator) window.imApp.updateLineNavIndicator(navMomentsBtn);
        });
    }

    // Cover Upload
    const momentsCoverWrapper = document.getElementById('moments-cover-wrapper');
    const momentsCoverUpload = document.getElementById('moments-cover-upload');
    const momentsCoverImg = document.getElementById('moments-cover-img');

    const savedMomentsCover = window.imApp.getMomentsCoverUrl
        ? window.imApp.getMomentsCoverUrl()
        : null;
    if (savedMomentsCover && momentsCoverImg) {
        momentsCoverImg.src = savedMomentsCover;
        momentsCoverImg.style.display = 'block';
    }

    if (momentsCoverWrapper && momentsCoverUpload) {
        momentsCoverWrapper.addEventListener('click', (e) => {
            if (e.target !== momentsCoverUpload) momentsCoverUpload.click();
        });

        momentsCoverUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const nextCoverSource = window.imApp.compressImageFile
                    ? await window.imApp.compressImageFile(file, {
                        maxWidth: 1280,
                        maxHeight: 1280,
                        mimeType: 'image/jpeg',
                        quality: 0.82
                    })
                    : await window.imApp.readFileAsDataUrl(file);

                const coverUrl = window.imApp.saveMomentsCover
                    ? await window.imApp.saveMomentsCover(nextCoverSource)
                    : nextCoverSource;
                if (!coverUrl) return;
                if (momentsCoverImg) {
                    momentsCoverImg.src = coverUrl;
                    momentsCoverImg.style.display = 'block';
                }
            } catch (error) {
                console.error('Failed to process moments cover', error);
                if (showToast) showToast('封面处理失败');
            }
        });
    }

    // Avatar update in moments
    const momentsUserName = document.getElementById('moments-user-name');
    const momentsUserAvatarWrapper = document.getElementById('moments-user-avatar-wrapper');
    const momentsUserAvatarImg = document.getElementById('moments-user-avatar-img');
    const momentsUserAvatarIcon = document.getElementById('moments-user-avatar-icon');
    const momentsUserAvatarUpload = document.getElementById('moments-user-avatar-upload');
    const mainMomentsSignature = document.getElementById('main-moments-signature');

    function getCurrentMomentsIdentity() {
        const currentAccountId = typeof window.getCurrentAccountId === 'function'
            ? window.getCurrentAccountId()
            : null;
        const accounts = typeof window.getAccounts === 'function' ? window.getAccounts() : [];
        const accountList = Array.isArray(accounts) ? accounts : [];
        const currentAccount = accountList.find(account => String(account?.id) === String(currentAccountId));
        const user = currentAccount || (window.getUserState ? window.getUserState() : window.userState) || {};

        return {
            name: user.name || user.realName || user.nickname || 'User',
            signature: user.signature || '',
            avatarUrl: user.avatarUrl || user.avatar || null,
            persona: user.persona || ''
        };
    }

    function refreshActiveMomentDetailForUserState() {
        if (
            currentDetailMoment &&
            momentDetailOverlay &&
            momentDetailOverlay.classList.contains('active') &&
            isUserMoment(currentDetailMoment)
        ) {
            const latestMoment = findMomentById(currentDetailMoment.id) || currentDetailMoment;
            openMomentDetail(latestMoment);
        }
    }

    function pruneStoredSelfMomentAvatars() {
        if (!Array.isArray(window.imData?.moments)) return false;
        let changed = false;
        window.imData.moments.forEach((moment) => {
            if (isUserMoment(moment) && moment.avatar) {
                moment.avatar = null;
                changed = true;
            }
        });
        if (changed && window.imApp?.saveMoments) {
            window.imApp.saveMoments({ silent: true });
        }
        return changed;
    }

    function syncMomentsUser() {
        const user = getCurrentMomentsIdentity();
        if (momentsUserName) momentsUserName.textContent = user.name;
        if (mainMomentsSignature) {
            const sig = user.signature;
            if (sig) {
                mainMomentsSignature.textContent = sig;
                mainMomentsSignature.style.display = 'block';
            } else {
                mainMomentsSignature.style.display = 'none';
            }
        }
        if (momentsUserAvatarImg && momentsUserAvatarIcon) {
            const avatarUrl = user.avatarUrl;
            if (avatarUrl) {
                momentsUserAvatarImg.src = avatarUrl;
                momentsUserAvatarImg.style.display = 'block';
                momentsUserAvatarIcon.style.display = 'none';
            } else {
                momentsUserAvatarImg.style.display = 'none';
                momentsUserAvatarIcon.style.display = 'flex';
            }
        }
        pruneStoredSelfMomentAvatars();
        renderMoments();
        refreshActiveMomentDetailForUserState();
    }

    function openMomentsAvatarPicker() {
        if (!momentsUserAvatarUpload) return;
        const currentAccountId = typeof window.getCurrentAccountId === 'function'
            ? window.getCurrentAccountId()
            : null;
        if (currentAccountId == null) {
            if (showToast) showToast('请先在设置中添加并选择 Apple ID');
            return;
        }
        momentsUserAvatarUpload.click();
    }

    momentsUserAvatarWrapper?.addEventListener('click', openMomentsAvatarPicker);
    momentsUserAvatarWrapper?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openMomentsAvatarPicker();
        }
    });
    momentsUserAvatarUpload?.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        const currentAccountId = typeof window.getCurrentAccountId === 'function'
            ? window.getCurrentAccountId()
            : null;
        if (currentAccountId == null || typeof window.updateAccountById !== 'function') {
            if (showToast) showToast('当前 Apple ID 不可编辑');
            return;
        }

        try {
            if (typeof window.readImageAsCompressedDataUrl !== 'function') {
                throw new Error('头像处理服务未就绪');
            }
            const avatarUrl = await window.readImageAsCompressedDataUrl(file, {
                maxWidth: 256,
                maxHeight: 256,
                quality: 0.72
            });
            const updated = window.updateAccountById(currentAccountId, { avatarUrl });
            if (!updated) throw new Error('当前 Apple ID 不可编辑');
            syncMomentsUser();
            if (showToast) showToast('头像已更新');
        } catch (error) {
            console.error('Failed to update moments avatar', error);
            if (showToast) showToast(error?.message || '头像处理失败');
        }
    });

    setTimeout(syncMomentsUser, 0);

    document.addEventListener('imessage-data-ready', syncMomentsUser);
    window.addEventListener('user-state-updated', syncMomentsUser);
    
    // Add event listener to capture global avatar update event if it exists
    window.addEventListener('avatar-updated', syncMomentsUser);
    

    // --- Moment Detail & Action Logic ---
    let currentDetailMoment = null;
    const momentDetailOverlay = document.getElementById('moment-detail-overlay');
    const momentActionSheet = document.getElementById('moment-action-sheet');
    const momentActionCancel = document.getElementById('moment-action-cancel');
    const momentDetailMoreBtn = document.getElementById('moment-detail-more-btn');

    const mActionEdit = document.getElementById('moment-action-edit');
    const mActionPrivacy = document.getElementById('moment-action-privacy');
    const mActionPin = document.getElementById('moment-action-pin');
    const mActionDelete = document.getElementById('moment-action-delete');

    function openMomentDetail(m) {
        if (!momentDetailOverlay) return;
        currentDetailMoment = m;

        const timeEl = document.getElementById('moment-detail-time');
        const textEl = document.getElementById('moment-detail-text');
        const avatarEl = document.getElementById('moment-detail-avatar');
        const nameEl = document.getElementById('moment-detail-name');
        const pinnedTag = document.getElementById('moment-detail-pinned-tag');
        const pinActionText = document.getElementById('moment-action-pin-text');

        if (pinnedTag) pinnedTag.style.display = m.isPinned ? 'inline-block' : 'none';
        if (pinActionText) pinActionText.textContent = m.isPinned ? '取消置顶' : '置顶';

        // Dynamically fetch the latest avatar and name based on userId
        let currentAvatar = m.avatar;
        let currentName = m.name;
        if (m.userId === 'me' || m.userId === 'self') {
            const user = getCurrentMomentsIdentity();
            currentAvatar = user.avatarUrl;
            currentName = user.name;
        } else {
            const friend = window.imData.friends ? window.imData.friends.find(f => f.id == m.userId || f.id === m.userId) : null;
            if (friend) {
                currentAvatar = friend.avatarUrl;
                currentName = friend.nickname || friend.realName || currentName;
            }
        }

        if (avatarEl) {
            if (currentAvatar) {
                avatarEl.innerHTML = `<img src="${currentAvatar}" style="width: 100%; height: 100%; object-fit: cover;">`;
            } else {
                avatarEl.innerHTML = `<i class="fas fa-user"></i>`;
            }
        }

        if (nameEl) nameEl.textContent = currentName || '';

        const imagesEl = document.getElementById('moment-detail-images');
        const interactionEl = document.getElementById('moment-detail-interaction');
        const likesListEl = document.getElementById('moment-detail-likes-list');
        const likesContainerEl = document.getElementById('moment-detail-likes');
        const commentsListEl = document.getElementById('moment-detail-comments-list');

        if (timeEl) {
            const d = new Date(m.time);
            timeEl.textContent = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
            let translateButton = document.getElementById('moment-detail-translate-btn');
            if (!translateButton) {
                translateButton = document.createElement('span');
                translateButton.id = 'moment-detail-translate-btn';
                translateButton.className = 'moment-translate-btn';
                translateButton.setAttribute('role', 'button');
                translateButton.tabIndex = 0;
                translateButton.style.marginLeft = '8px';
                timeEl.insertAdjacentElement('afterend', translateButton);
            }
            const translation = String(m.translation || '').trim();
            translateButton.style.display = translation ? 'inline' : 'none';
            translateButton.textContent = '翻译';
            translateButton.setAttribute('aria-expanded', 'false');
        }

        if (textEl) {
            textEl.textContent = m.text || '';
            textEl.style.display = m.text ? 'block' : 'none';
            let translationEl = document.getElementById('moment-detail-translation');
            if (!translationEl) {
                translationEl = document.createElement('div');
                translationEl.id = 'moment-detail-translation';
                translationEl.className = 'moment-translation';
                textEl.insertAdjacentElement('afterend', translationEl);
            }
            translationEl.textContent = String(m.translation || '').trim();
            translationEl.style.display = 'none';
            const translateButton = document.getElementById('moment-detail-translate-btn');
            if (translateButton && translationEl.textContent) {
                const toggleDetailTranslation = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setTranslationExpanded(translateButton, translationEl, translationEl.style.display !== 'block');
                };
                translateButton.onclick = toggleDetailTranslation;
                translateButton.onkeydown = (event) => {
                    if (event.key === 'Enter' || event.key === ' ') toggleDetailTranslation(event);
                };
            }
        }

        if (imagesEl) {
            imagesEl.innerHTML = '';
            imagesEl.className = 'moment-detail-images';
            if (m.images && m.images.length > 0) {
                if (m.images.length === 1) imagesEl.classList.add('single');
                else if (m.images.length === 2 || m.images.length === 4) imagesEl.classList.add('double');
                else imagesEl.classList.add('grid');

                m.images.forEach((img, index) => {
                    const src = getMomentImageSource(img);
                    imagesEl.innerHTML += `<div class="moment-detail-img-wrapper" data-image-index="${index}" style="width:100%; height:100%; overflow:hidden; cursor:pointer;"><img src="${src}" onerror="this.style.display='none'; this.parentElement.style.background='#ffebee'; this.parentElement.innerHTML='<div style=\\'font-size:10px;color:#ff3b30;padding:5px;text-align:center;height:100%;display:flex;justify-content:center;align-items:center;\\'>过期</div>';" style="width:100%; height:100%; object-fit:cover;"></div>`;
                });
                imagesEl.querySelectorAll('.moment-detail-img-wrapper').forEach((wrapper) => {
                    wrapper.addEventListener('click', (event) => {
                        event.stopPropagation();
                        openMomentImageDetail(m.images[Number(wrapper.dataset.imageIndex)], m);
                    });
                });
                imagesEl.style.display = 'grid';
            } else {
                imagesEl.style.display = 'none';
            }
        }

        const normalizedComments = normalizeMomentComments(m.comments);
        const hasLikes = m.likes && m.likes.length > 0;
        const hasComments = normalizedComments.length > 0;

        if (interactionEl) {
            if (!hasLikes && !hasComments) {
                interactionEl.style.display = 'none';
            } else {
                interactionEl.style.display = 'block';

                if (likesContainerEl) {
                    if (hasLikes) {
                        likesListEl.textContent = m.likes.join(', ');
                        likesContainerEl.style.display = 'flex';
                    } else {
                        likesContainerEl.style.display = 'none';
                    }
                }

                if (commentsListEl) {
                    commentsListEl.innerHTML = '';
                    if (hasComments) {
                        normalizedComments.forEach((c) => {
                            commentsListEl.innerHTML += renderMomentCommentHtml(c, 'moment-detail-comment');
                        });
                        bindMomentCommentInteractions(
                            commentsListEl,
                            '.moment-detail-comment',
                            (commentIndex) => openMomentCommentReply(m.id, commentIndex),
                            (commentIndex) => deleteMomentComment(m.id, commentIndex)
                        );
                        if (hasLikes) {
                            commentsListEl.style.borderTop = '1px solid #e5e5ea';
                            commentsListEl.style.paddingTop = '12px';
                            commentsListEl.style.marginTop = '10px';
                        } else {
                            commentsListEl.style.borderTop = 'none';
                            commentsListEl.style.paddingTop = '0';
                        }
                    }
                }
            }
        }

        momentDetailOverlay.style.display = 'flex';
        void momentDetailOverlay.offsetWidth;
        momentDetailOverlay.classList.add('active');
    }

    function populateMomentShareSheet() {
        const friendsListEl = document.getElementById('moment-share-friends-list');
        if (!friendsListEl) return;

        friendsListEl.innerHTML = '';

        if (window.imData.friends && window.imData.friends.length > 0) {
            const shareableFriends = window.imData.friends.filter(f => f && f.type !== 'official' && f.type !== 'group');
            shareableFriends.forEach((friend) => {
                const item = document.createElement('div');
                item.className = 'moment-share-friend-item';

                const avatarHtml = friend.avatarUrl
                    ? `<img src="${friend.avatarUrl}">`
                    : `<i class="fas fa-user"></i>`;

                item.innerHTML = `
                    <div class="moment-share-friend-avatar">${avatarHtml}</div>
                    <div class="moment-share-friend-name">${friend.nickname}</div>
                `;

                item.addEventListener('click', async () => {
                    if (currentDetailMoment) {
                        const contentObj = {
                            id: currentDetailMoment.id,
                            text: currentDetailMoment.text,
                            img: null,
                            imgDesc: null
                        };

                        if (currentDetailMoment.images && currentDetailMoment.images.length > 0) {
                            const firstImg = currentDetailMoment.images[0];
                            contentObj.img = getMomentImageSource(firstImg);
                            contentObj.imgDesc = typeof firstImg === 'object' ? firstImg.desc : null;
                        }

                        const content = JSON.stringify(contentObj);

                        const msgData = {
                            role: 'user',
                            type: 'moment_forward',
                            content: content,
                            timestamp: Date.now()
                        };
                        window.imApp.captureGroupUserIdentity?.(friend, msgData);

                        const saved = window.imApp.appendFriendMessage
                            ? await window.imApp.appendFriendMessage(friend.id, msgData, { silent: true })
                            : await commitFriendsChange(friend.id, (targetFriend) => {
                                if (!targetFriend.messages) targetFriend.messages = [];
                                targetFriend.messages.push(msgData);
                            });
                        if (!saved) return;

                        showToast(`已转发给 ${friend.nickname}`);
                        closeView(momentActionSheet);
                    }
                });

                friendsListEl.appendChild(item);
            });
            if (shareableFriends.length === 0) {
                friendsListEl.innerHTML = '<div style="font-size: 13px; color: #8e8e93; text-align: center; width: 100%;">暂无联系人</div>';
            }
        } else {
            friendsListEl.innerHTML = '<div style="font-size: 13px; color: #8e8e93; text-align: center; width: 100%;">暂无联系人</div>';
        }
    }

    function closeMomentDetail() {
        if (!momentDetailOverlay) return;
        momentDetailOverlay.classList.remove('active');
        setTimeout(() => {
            momentDetailOverlay.style.display = 'none';
            currentDetailMoment = null;
        }, 300);
    }

    if (momentDetailOverlay) {
        momentDetailOverlay.addEventListener('click', (e) => {
            if (e.target === momentDetailOverlay) {
                closeMomentDetail();
            }
        });
    }

    if (momentDetailMoreBtn) {
        momentDetailMoreBtn.addEventListener('click', () => {
            if (momentActionSheet) {
                populateMomentShareSheet();
                openView(momentActionSheet);
            }
        });
    }

    if (momentActionCancel) {
        momentActionCancel.addEventListener('click', () => {
            closeView(momentActionSheet);
        });
    }

    if (mActionEdit) mActionEdit.addEventListener('click', () => { showToast('功能未实现'); closeView(momentActionSheet); closeMomentDetail(); });
    if (mActionPrivacy) mActionPrivacy.addEventListener('click', () => { showToast('功能未实现'); closeView(momentActionSheet); closeMomentDetail(); });

    if (mActionPin) {
        mActionPin.addEventListener('click', async () => {
            if (currentDetailMoment) {
                const nextPinnedState = !currentDetailMoment.isPinned;
                const targetMomentId = currentDetailMoment.id;
                const saved = await commitMomentsChange(targetMomentId, () => {
                    const targetMoment = findMomentById(targetMomentId);
                    if (!targetMoment) return;
                    targetMoment.isPinned = nextPinnedState;
                });
                if (saved) {
                    const latestMoment = findMomentById(targetMomentId);
                    if (latestMoment) currentDetailMoment = latestMoment;
                    showToast(nextPinnedState ? '已置顶' : '已取消置顶');
                    refreshAllMomentsViews();
                }
            }
            closeView(momentActionSheet);
            closeMomentDetail();
        });
    }

    if (mActionDelete) {
        mActionDelete.addEventListener('click', () => {
            closeView(momentActionSheet);
            if (currentDetailMoment) {
                if (window.showCustomModal) {
                    window.showCustomModal({
                        title: '删除朋友圈',
                        message: '确定要删除这条朋友圈吗？',
                        isDestructive: true,
                        confirmText: '删除',
                        onConfirm: async () => {
                            const targetMomentId = currentDetailMoment.id;
                            const saved = await deleteMomentPermanently(targetMomentId);
                            if (!saved) return;

                            closeMomentDetail();
                            refreshAllMomentsViews();
                            if (window.showToast) window.showToast('已删除');
                        }
                    });
                }
            }
        });
    }

    if (momentsContent) {
        momentsContent.addEventListener('click', () => {
            document.querySelectorAll('.moment-action-menu.active').forEach((menu) => {
                menu.classList.remove('active');
            });
        });
    }

    // --- Publishing Moment ---
    const momentsCameraBtn = document.getElementById('moments-camera-btn');
    const publishMomentView = document.getElementById('publish-moment-view');
    const publishMomentCancel = document.getElementById('publish-moment-cancel');
    const publishMomentSubmit = document.getElementById('publish-moment-submit');
    const publishMomentText = document.getElementById('publish-moment-text');
    const publishMomentAddImg = document.getElementById('publish-moment-add-img');
    const publishMomentUpload = document.getElementById('publish-moment-upload');
    const publishMomentImages = document.getElementById('publish-moment-images');
    const publishMomentVisibilityBtn = document.getElementById('publish-moment-visibility-btn');
    const publishMomentVisibilitySummary = document.getElementById('publish-moment-visibility-summary');
    const publishMomentVisibilitySheet = document.getElementById('publish-moment-visibility-sheet');
    const publishMomentVisibilityList = document.getElementById('publish-moment-visibility-list');
    const publishMomentVisibilityEmpty = document.getElementById('publish-moment-visibility-empty');
    const publishMomentVisibilitySelectAll = document.getElementById('publish-moment-visibility-select-all');
    const publishMomentVisibilityCancel = document.getElementById('publish-moment-visibility-cancel');
    const publishMomentVisibilityConfirm = document.getElementById('publish-moment-visibility-confirm');

    const publishMomentDescModal = document.getElementById('publish-moment-desc-modal');
    const publishMomentImgDesc = document.getElementById('publish-moment-img-desc');
    const publishMomentDescConfirm = document.getElementById('publish-moment-desc-confirm');

    let pendingImages = [];
    let isPublishing = false;
    let currentEditImageIndex = -1;
    let publishMomentVisibleCharIds = new Set();
    let publishMomentVisibilityDraftIds = null;

    function getMomentVisibilityChars() {
        const friends = Array.isArray(window.imData?.friends) ? window.imData.friends : [];
        return friends.filter((friend) => friend && friend.type === 'char' && friend.id != null);
    }

    function normalizeMomentVisibleCharIds(ids) {
        const validIds = new Set(getMomentVisibilityChars().map((friend) => String(friend.id)));
        const normalizedIds = [];
        const seenIds = new Set();
        (ids instanceof Set ? Array.from(ids) : (Array.isArray(ids) ? ids : [])).forEach((id) => {
            const normalizedId = String(id ?? '').trim();
            if (!normalizedId || !validIds.has(normalizedId) || seenIds.has(normalizedId)) return;
            seenIds.add(normalizedId);
            normalizedIds.push(normalizedId);
        });
        return normalizedIds;
    }

    function getPublishMomentVisibleCharIds() {
        return normalizeMomentVisibleCharIds(publishMomentVisibleCharIds);
    }

    function updatePublishMomentVisibilitySummary() {
        if (!publishMomentVisibilitySummary) return;
        const chars = getMomentVisibilityChars();
        const selectedIds = new Set(getPublishMomentVisibleCharIds());
        const selectedCount = chars.filter((friend) => selectedIds.has(String(friend.id))).length;
        const label = selectedCount === 0
            ? '仅自己可见'
            : (selectedCount === chars.length ? '全部 Char 可见' : `仅 ${selectedCount} 位 Char 可见`);
        publishMomentVisibilitySummary.textContent = label;
        const arrow = document.createElement('i');
        arrow.className = 'fas fa-chevron-right';
        arrow.style.color = '#ccc';
        arrow.style.fontSize = '14px';
        publishMomentVisibilitySummary.appendChild(arrow);
    }

    function resetPublishMomentVisibility() {
        publishMomentVisibleCharIds = new Set(getMomentVisibilityChars().map((friend) => String(friend.id)));
        publishMomentVisibilityDraftIds = null;
        updatePublishMomentVisibilitySummary();
    }

    function closePublishMomentVisibilitySheet() {
        if (!publishMomentVisibilitySheet) return;
        publishMomentVisibilitySheet.classList.remove('active');
        publishMomentVisibilitySheet.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
            if (!publishMomentVisibilitySheet.classList.contains('active')) {
                publishMomentVisibilitySheet.style.display = 'none';
            }
        }, 300);
    }

    function renderPublishMomentVisibilityList() {
        if (!publishMomentVisibilityList) return;
        const chars = getMomentVisibilityChars();
        const selectedIds = publishMomentVisibilityDraftIds || new Set();
        publishMomentVisibilityList.innerHTML = '';
        publishMomentVisibilityList.style.display = chars.length > 0 ? 'block' : 'none';
        if (publishMomentVisibilityEmpty) {
            publishMomentVisibilityEmpty.style.display = chars.length > 0 ? 'none' : 'block';
        }

        chars.forEach((friend) => {
            const friendId = String(friend.id);
            const isSelected = selectedIds.has(friendId);
            const item = document.createElement('button');
            item.type = 'button';
            item.className = `publish-moment-visibility-person${isSelected ? ' is-selected' : ''}`;
            item.setAttribute('aria-pressed', String(isSelected));

            const avatar = document.createElement('span');
            avatar.className = 'publish-moment-visibility-avatar';
            if (friend.avatarUrl) {
                const image = document.createElement('img');
                image.src = friend.avatarUrl;
                image.alt = '';
                avatar.appendChild(image);
            } else {
                const icon = document.createElement('i');
                icon.className = 'fas fa-user';
                avatar.appendChild(icon);
            }

            const name = document.createElement('span');
            name.className = 'publish-moment-visibility-name';
            name.textContent = getDisplayNameForMomentSpeaker(friend);

            const check = document.createElement('span');
            check.className = 'publish-moment-visibility-check';
            check.innerHTML = '<i class="fas fa-check"></i>';

            item.append(avatar, name, check);
            item.addEventListener('click', () => {
                if (selectedIds.has(friendId)) selectedIds.delete(friendId);
                else selectedIds.add(friendId);
                renderPublishMomentVisibilityList();
            });
            publishMomentVisibilityList.appendChild(item);
        });

        if (publishMomentVisibilitySelectAll) {
            const hasEveryChar = chars.length > 0 && chars.every((friend) => selectedIds.has(String(friend.id)));
            publishMomentVisibilitySelectAll.textContent = hasEveryChar ? '取消全选' : '全选';
        }
    }

    function openPublishMomentVisibilitySheet() {
        if (!publishMomentVisibilitySheet) return;
        publishMomentVisibilityDraftIds = new Set(getPublishMomentVisibleCharIds());
        renderPublishMomentVisibilityList();
        publishMomentVisibilitySheet.style.display = 'flex';
        void publishMomentVisibilitySheet.offsetWidth;
        publishMomentVisibilitySheet.classList.add('active');
        publishMomentVisibilitySheet.setAttribute('aria-hidden', 'false');
    }

    publishMomentVisibilityBtn?.addEventListener('click', openPublishMomentVisibilitySheet);
    publishMomentVisibilityBtn?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPublishMomentVisibilitySheet();
        }
    });
    publishMomentVisibilitySelectAll?.addEventListener('click', () => {
        const chars = getMomentVisibilityChars();
        const selectedIds = publishMomentVisibilityDraftIds || new Set();
        const hasEveryChar = chars.length > 0 && chars.every((friend) => selectedIds.has(String(friend.id)));
        publishMomentVisibilityDraftIds = hasEveryChar
            ? new Set()
            : new Set(chars.map((friend) => String(friend.id)));
        renderPublishMomentVisibilityList();
    });
    publishMomentVisibilityCancel?.addEventListener('click', () => {
        publishMomentVisibilityDraftIds = null;
        closePublishMomentVisibilitySheet();
    });
    publishMomentVisibilityConfirm?.addEventListener('click', () => {
        publishMomentVisibleCharIds = new Set(normalizeMomentVisibleCharIds(publishMomentVisibilityDraftIds));
        publishMomentVisibilityDraftIds = null;
        updatePublishMomentVisibilitySummary();
        closePublishMomentVisibilitySheet();
    });
    publishMomentVisibilitySheet?.addEventListener('click', (event) => {
        if (event.target !== publishMomentVisibilitySheet) return;
        publishMomentVisibilityDraftIds = null;
        closePublishMomentVisibilitySheet();
    });

    if (momentsCameraBtn) {
        momentsCameraBtn.addEventListener('click', () => {
            pendingImages = [];
            if (publishMomentText) publishMomentText.value = '';
            isPublishing = false;
            resetPublishMomentVisibility();
            renderPendingImages();
            checkPublishState();

            if (publishMomentView) {
                publishMomentView.style.display = 'flex';
                void publishMomentView.offsetWidth;
                publishMomentView.classList.add('active');
            }
        });
    }

    if (publishMomentCancel) {
        publishMomentCancel.addEventListener('click', () => {
            publishMomentView.classList.remove('active');
            setTimeout(() => publishMomentView.style.display = 'none', 300);
            publishMomentVisibleCharIds = new Set();
            publishMomentVisibilityDraftIds = null;
            closePublishMomentVisibilitySheet();
        });
    }

    if (publishMomentAddImg && publishMomentUpload) {
        publishMomentAddImg.addEventListener('click', () => {
            publishMomentUpload.click();
        });

        publishMomentUpload.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []);
            if (files.length === 0) {
                e.target.value = '';
                return;
            }

            try {
                const processedImages = await Promise.all(
                    files.map(async (file) => {
                        const src = window.imApp.compressImageFile
                            ? await window.imApp.compressImageFile(file, {
                                maxWidth: 1080,
                                maxHeight: 1080,
                                mimeType: 'image/jpeg',
                                quality: 0.8
                            })
                            : await window.imApp.readFileAsDataUrl(file);

                        return { src, desc: '' };
                    })
                );

                pendingImages.push(...processedImages.filter((item) => item && item.src));
                renderPendingImages();
                checkPublishState();
            } catch (error) {
                console.error('Failed to process moment images', error);
                if (showToast) showToast('图片处理失败');
            }

            e.target.value = '';
        });
    }

    function renderPendingImages() {
        if (!publishMomentImages) return;
        const currentImgs = publishMomentImages.querySelectorAll('.pending-img-wrapper');
        currentImgs.forEach((el) => el.remove());

        pendingImages.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'pending-img-wrapper';
            div.style.position = 'relative';
            div.style.aspectRatio = '1/1';

            div.innerHTML = `
                <img src="${item.src}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;">
                <div class="remove-img-btn" data-index="${index}" style="position: absolute; top: 0; right: 0; background: rgba(0,0,0,0.5); color: #fff; width: 20px; height: 20px; display: flex; justify-content: center; align-items: center; cursor: pointer;">
                    <i class="fas fa-times" style="font-size: 12px;"></i>
                </div>
                ${item.desc ? '<div style="position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(0,0,0,0.5); color: #fff; font-size: 10px; padding: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none;">已添加描述</div>' : ''}
            `;

            if (publishMomentAddImg) publishMomentImages.insertBefore(div, publishMomentAddImg);
            else publishMomentImages.appendChild(div);

            div.querySelector('img').addEventListener('click', () => {
                currentEditImageIndex = index;
                if (publishMomentImgDesc) publishMomentImgDesc.value = item.desc || '';
                if (publishMomentDescModal) {
                    publishMomentDescModal.style.display = 'flex';
                    void publishMomentDescModal.offsetWidth;
                    publishMomentDescModal.classList.add('active');
                }
            });

            div.querySelector('.remove-img-btn').addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-index'));
                pendingImages.splice(idx, 1);
                renderPendingImages();
                checkPublishState();
            });
        });
    }

    if (publishMomentDescConfirm) {
        publishMomentDescConfirm.addEventListener('click', () => {
            if (currentEditImageIndex >= 0 && currentEditImageIndex < pendingImages.length) {
                pendingImages[currentEditImageIndex].desc = publishMomentImgDesc ? publishMomentImgDesc.value.trim() : '';
                renderPendingImages();
            }
            if (publishMomentDescModal) {
                publishMomentDescModal.classList.remove('active');
                setTimeout(() => {
                    publishMomentDescModal.style.display = 'none';
                }, 300);
            }
        });
    }

    if (publishMomentDescModal) {
        publishMomentDescModal.addEventListener('click', (e) => {
            if (e.target === publishMomentDescModal) {
                publishMomentDescModal.classList.remove('active');
                setTimeout(() => {
                    publishMomentDescModal.style.display = 'none';
                }, 300);
            }
        });
    }

    if (publishMomentText) {
        publishMomentText.addEventListener('input', checkPublishState);
    }

    function checkPublishState() {
        if (!publishMomentText || !publishMomentSubmit) return;
        const hasText = publishMomentText.value.trim().length > 0;
        const hasImages = pendingImages.length > 0;

        if (hasText || hasImages) {
            publishMomentSubmit.classList.add('active');
            publishMomentSubmit.style.color = '#fff';
            publishMomentSubmit.style.backgroundColor = '#000';
        } else {
            publishMomentSubmit.classList.remove('active');
            publishMomentSubmit.style.color = '#b2b2b2';
            publishMomentSubmit.style.backgroundColor = '#f2f2f2';
        }
    }

    if (publishMomentSubmit) {
        publishMomentSubmit.addEventListener('click', async () => {
            const text = publishMomentText ? publishMomentText.value.trim() : '';
            const hasImages = pendingImages.length > 0;

            if (!text && !hasImages) {
                showToast('内容不能为空');
                return;
            }

            if (isPublishing) return;
            isPublishing = true;
            publishMomentSubmit.classList.remove('active');

            const imgs = cloneSnapshot(pendingImages);

            const newMoment = {
                id: Date.now(),
                userId: 'me',
                name: getCurrentMomentsIdentity().name || 'Me',
                avatar: null,
                text: text,
                images: imgs,
                time: Date.now(),
                likes: [],
                comments: [],
                visibleToCharIds: getPublishMomentVisibleCharIds(),
                isPinned: false
            };

            const saved = await commitMomentsChange(newMoment.id, () => {
                window.imData.moments.unshift(newMoment);
            });

            if (!saved) {
                isPublishing = false;
                checkPublishState();
                return;
            }

            renderMoments();

            if (momentsScrollContainer) momentsScrollContainer.scrollTop = 0;

            if (publishMomentView) {
                publishMomentView.classList.remove('active');
                publishMomentView.style.display = 'none';
            }
            isPublishing = false;
            pendingImages = [];
            if (publishMomentText) publishMomentText.value = '';
            publishMomentVisibleCharIds = new Set();
            publishMomentVisibilityDraftIds = null;

            showToast('发表成功');
            await triggerAutoCommentsForMyMoment(newMoment.id);
        });
    }

    const publishMomentAiAllFriends = document.getElementById('publish-moment-ai-all-friends');
    if (publishMomentAiAllFriends) {
        publishMomentAiAllFriends.addEventListener('click', async () => {
            if (publishMomentAiAllFriends.dataset.generating === 'true') return;

            const currentApiConfig = getCurrentMomentApiConfig();
            if (!currentApiConfig.endpoint || !currentApiConfig.apiKey) {
                if (window.showToast) window.showToast('请先配置 API');
                return;
            }

            if (publishMomentView) {
                publishMomentView.classList.remove('active');
                publishMomentView.style.display = 'none';
            }
            
            const allFriends = Array.isArray(window.imData?.friends) ? window.imData.friends : [];
            const eligibleChars = allFriends.filter(f => f && f.type !== 'official' && f.type !== 'group');
            
            if (eligibleChars.length === 0) {
                if (window.showToast) window.showToast('没有好友想发朋友圈');
                return;
            }
            
            if (window.showToast) window.showToast(` ${eligibleChars.length} 位好友正在发朋友圈...`);
            
            publishMomentAiAllFriends.dataset.generating = 'true';
            publishMomentAiAllFriends.style.pointerEvents = 'none';
            publishMomentAiAllFriends.style.opacity = '0.6';

            let successCount = 0;
            let failedCount = 0;

            try {
                // Generate moments sequentially to avoid rate limits
                for (const friend of eligibleChars) {
                    try {
                        const generated = await triggerAiMomentPost(friend, true); // true indicates batch mode to suppress individual toasts
                        if (generated) {
                            successCount += 1;
                        } else {
                            failedCount += 1;
                        }
                    } catch (e) {
                        failedCount += 1;
                        console.error(`Failed to generate moment for ${friend.nickname}:`, e);
                    }
                }
            } finally {
                publishMomentAiAllFriends.dataset.generating = 'false';
                publishMomentAiAllFriends.style.pointerEvents = '';
                publishMomentAiAllFriends.style.opacity = '';
            }
            
            if (window.showToast) {
                if (successCount > 0 && failedCount > 0) {
                    window.showToast(`已生成 ${successCount} 条朋友圈，${failedCount} 位好友失败`);
                } else if (successCount > 0) {
                    window.showToast(`已生成 ${successCount} 条朋友圈`);
                } else {
                    window.showToast('没有生成成功，请检查 API 配置或网络');
                }
            }
        });
    }

    // --- Unified Refresh Function (Task 5: Real-time updates) ---
    function refreshAllMomentsViews() {
        // Re-render main moments feed
        renderMoments();
    }

    function normalizeMomentComments(comments) {
        if (!Array.isArray(comments)) return [];

        return comments.reduce((normalized, comment, index) => {
            if (comment == null) return normalized;

            if (typeof comment === 'string') {
                const content = comment.trim();
                if (content) normalized.push({ name: 'Unknown', content, translation: '', language: 'zh', index });
                return normalized;
            }

            if (typeof comment !== 'object') return normalized;

            const rawName = comment.name ?? comment.userName ?? comment.nickname ?? comment.realName ?? 'Unknown';
            const rawContent = comment.content ?? comment.text ?? comment.comment ?? '';
            const name = String(rawName || 'Unknown').trim() || 'Unknown';
            const content = String(rawContent || '').trim();

            if (content) {
                normalized.push({
                    ...comment,
                    name,
                    content,
                    userId: comment.userId ?? comment.friendId ?? comment.charId ?? null,
                    replyToName: comment.replyToName ?? comment.replyToUserName ?? null,
                    replyToContent: comment.replyToContent ?? null,
                    thought: comment.thought ?? '',
                    thoughtTranslation: comment.thoughtTranslation ?? '',
                    translation: comment.translation ?? comment.contentTranslation ?? comment.translationZh ?? '',
                    language: normalizeMomentLanguage(comment.language || 'zh'),
                    index
                });
            }
            return normalized;
        }, []);
    }

    function escapeMomentHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderMomentCommentHtml(comment, className) {
        const replyPrefix = comment.replyToName
            ? ` <span style="color:#576b95;">回复 ${escapeMomentHtml(comment.replyToName)}</span>`
            : '';
        const translation = String(comment.translation || '').trim();
        const translationButton = translation
            ? ` <span class="moment-translate-btn moment-comment-translate-btn" role="button" tabindex="0" aria-expanded="false">翻译</span>`
            : '';
        const translationHtml = translation
            ? `<div class="moment-comment-translation">${escapeMomentHtml(translation)}</div>`
            : '';
        return `<div class="${className}" data-comment-index="${comment.index}" style="font-size:15px; margin-bottom:4px; line-height:1.4; cursor:pointer;"><div><span class="${className}-name">${escapeMomentHtml(comment.name)}${replyPrefix}: </span><span class="moment-comment-content">${escapeMomentHtml(comment.content)}</span>${translationButton} <span class="moment-comment-delete" role="button" tabindex="0">删除</span></div>${translationHtml}</div>`;
    }

    function bindMomentCommentInteractions(container, selector, onReply, onDelete) {
        if (!container) return;
        container.querySelectorAll(selector).forEach((commentEl) => {
            bindTranslationButton(
                commentEl.querySelector('.moment-comment-translate-btn'),
                commentEl.querySelector('.moment-comment-translation')
            );
            const deleteButton = commentEl.querySelector('.moment-comment-delete');
            const deleteComment = (event) => {
                event.preventDefault();
                event.stopPropagation();
                onDelete(commentEl.dataset.commentIndex);
            };
            deleteButton?.addEventListener('click', deleteComment);
            deleteButton?.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') deleteComment(event);
            });
            commentEl.addEventListener('click', (event) => {
                if (event.target.closest('.moment-comment-translate-btn, .moment-comment-delete')) return;
                event.stopPropagation();
                onReply(commentEl.dataset.commentIndex);
            });
        });
    }

    function deleteMomentComment(momentId, commentIndex) {
        const moment = findMomentById(momentId);
        const index = Number(commentIndex);
        if (!moment || !Array.isArray(moment.comments) || !Number.isInteger(index) || index < 0 || index >= moment.comments.length) return;

        const removeComment = async () => {
            const saved = await commitMomentsChange(momentId, () => {
                const latestMoment = findMomentById(momentId);
                if (!latestMoment || !Array.isArray(latestMoment.comments)) return;
                latestMoment.comments.splice(index, 1);
            });
            if (!saved) return;
            refreshViewsAfterMomentComment(momentId);
            if (window.showToast) window.showToast('评论已删除');
        };

        if (!window.showCustomModal) {
            removeComment();
            return;
        }
        window.showCustomModal({
            title: '删除评论',
            message: '确定删除这条评论吗？',
            confirmText: '删除',
            confirmTone: 'dark',
            isDestructive: true,
            onConfirm: removeComment
        });
    }

    function findFriendForMomentComment(comment) {
        if (!comment) return null;
        const friends = Array.isArray(window.imData.friends) ? window.imData.friends : [];
        if (comment.userId != null) {
            const byId = friends.find((friend) => String(friend.id) === String(comment.userId));
            if (byId) return byId;
        }

        const commentName = String(comment.name || '').trim();
        if (!commentName) return null;
        return friends.find((friend) => {
            if (!friend || friend.type === 'group' || friend.type === 'official') return false;
            return String(friend.nickname || '').trim() === commentName ||
                String(friend.realName || '').trim() === commentName;
        }) || null;
    }

    function isUserMomentComment(comment) {
        const userName = getCurrentMomentsIdentity().name || 'Me';
        return String(comment?.userId || '') === 'me' ||
            String(comment?.userId || '') === 'self' ||
            String(comment?.name || '') === String(userName);
    }

    function isUserMoment(moment) {
        const userName = getCurrentMomentsIdentity().name || 'Me';
        return String(moment?.userId || '') === 'me' ||
            String(moment?.userId || '') === 'self' ||
            String(moment?.name || moment?.userName || '') === String(userName);
    }

    function findFriendForMomentAuthor(moment) {
        if (!moment || isUserMoment(moment)) return null;
        const friends = Array.isArray(window.imData.friends) ? window.imData.friends : [];
        if (moment.userId != null) {
            const byId = friends.find((friend) => {
                if (!friend || friend.type === 'group' || friend.type === 'official') return false;
                return String(friend.id) === String(moment.userId);
            });
            if (byId) return byId;
        }

        const authorName = String(moment.name || moment.userName || '').trim();
        if (!authorName) return null;
        return friends.find((friend) => {
            if (!friend || friend.type === 'group' || friend.type === 'official') return false;
            return String(friend.nickname || '').trim() === authorName ||
                String(friend.realName || '').trim() === authorName;
        }) || null;
    }

    function getDisplayNameForMomentSpeaker(friend) {
        return String(friend?.nickname || friend?.realName || friend?.name || 'Friend').trim() || 'Friend';
    }

    function isUserLikeName(value) {
        const text = String(value || '').trim();
        if (!text) return false;
        const userName = String(getCurrentMomentsIdentity().name || 'Me').trim();
        const lowered = text.toLowerCase();
        return lowered === 'me' ||
            lowered === 'self' ||
            lowered === 'user' ||
            lowered === 'current user' ||
            (userName && text === userName);
    }

    function buildMomentCommentReplyTargets(replyFriend, relation = '', role = 'author') {
        const targets = [];
        const seenIds = new Set();

        function addTarget(friend, relation = '', role = 'npc') {
            if (!friend || friend.type === 'group' || friend.type === 'official') return;
            const id = String(friend.id || '').trim();
            if (!id || seenIds.has(id) || isUserLikeName(id) || isUserLikeName(getDisplayNameForMomentSpeaker(friend))) return;
            seenIds.add(id);
            targets.push({
                id,
                name: getDisplayNameForMomentSpeaker(friend),
                realName: String(friend.realName || friend.nickname || '').trim(),
                persona: String(friend.persona || friend.signature || '').trim(),
                relation: String(relation || '').trim(),
                language: normalizeMomentLanguage(friend.language || 'zh'),
                friend,
                role
            });
        }

        addTarget(replyFriend, relation, role);

        return targets;
    }

    function cleanMomentApiJsonText(rawText) {
        let text = String(rawText || '').trim();
        if (!text) return '';
        if (text.startsWith('```json')) {
            text = text.slice(7);
        } else if (text.startsWith('```')) {
            text = text.slice(3);
        }
        if (text.endsWith('```')) {
            text = text.slice(0, -3);
        }
        text = text.trim();
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace > -1 && lastBrace > firstBrace) {
            text = text.slice(firstBrace, lastBrace + 1);
        }
        return text;
    }

    function parseMomentUserCommentReplies(aiResponse, targets) {
        const targetById = new Map((targets || []).map((target) => [String(target.id), target]));
        if (!aiResponse || targetById.size === 0) return [];

        let payload = null;
        try {
            payload = JSON.parse(cleanMomentApiJsonText(aiResponse));
        } catch (error) {
            console.warn('Moment user comment reply JSON parse failed:', error);
            return [];
        }

        const replies = Array.isArray(payload?.replies) ? payload.replies : [];
        return replies
            .map((entry) => {
                const speakerId = String(entry?.speakerId ?? entry?.id ?? '').trim();
                const target = targetById.get(speakerId);
                if (!target || isUserLikeName(speakerId) || isUserLikeName(entry?.name || entry?.speakerName || '')) return null;

                const thought = normalizeMomentLocalizedContent(entry?.thought, target.language);
                const cleanComments = (Array.isArray(entry?.comments) ? entry.comments : [])
                    .map((comment) => normalizeMomentLocalizedContent(comment, target.language))
                    .filter(Boolean)
                    .slice(0, 3);

                if (cleanComments.length === 0) return null;
                return {
                    target,
                    thought: thought?.text || '',
                    thoughtTranslation: thought?.translation || '',
                    comments: cleanComments
                };
            })
            .filter(Boolean);
    }

    function formatMomentReplyTargetsForPrompt(targets) {
        return (targets || []).map((target) => {
            return [
                `speakerId: ${target.id}`,
                `name: ${target.name}`,
                `role: ${target.role}`,
                `realName: ${target.realName || 'None'}`,
                `persona: ${target.persona || 'None'}`,
                `relationshipToMomentAuthor: ${target.relation || 'None'}`,
                `language: ${target.language} (${getMomentLanguageName(target.language)})`
            ].join('\n');
        }).join('\n\n');
    }

    async function generateMomentUserCommentReplies(moment, replyFriend, userComment, targetComment = null) {
        if (!moment || !replyFriend || !userComment || !hasCurrentMomentApiConfig()) return [];

        const targets = buildMomentCommentReplyTargets(
            replyFriend,
            targetComment ? 'Character whose comment the User replied to' : 'Moment author',
            targetComment ? 'comment_target' : 'author'
        );
        if (targets.length === 0) return [];

        if (window.imApp?.ensureFriendMessagesLoaded) {
            await window.imApp.ensureFriendMessagesLoaded(replyFriend.id);
        }

        const imageDescriptions = getMomentImageDescriptions(moment);
        const authorFriend = findFriendForMomentAuthor(moment);
        const momentAuthorName = isUserMoment(moment)
            ? (getCurrentMomentsIdentity().name || moment.name || moment.userName || 'User')
            : (moment.name || moment.userName || getDisplayNameForMomentSpeaker(authorFriend));
        const momentAuthorPersona = isUserMoment(moment)
            ? (getCurrentMomentsIdentity().persona || 'ordinary user')
            : (authorFriend?.persona || 'ordinary user');
        const worldBookContextText = [
            moment.text || '',
            imageDescriptions || '',
            userComment.content || '',
            targetComment?.content || '',
            replyFriend?.memory?.overview || ''
        ].filter(Boolean).join('\n');

        const systemDepthWorldBookContext = window.imApp?.getWorldBookContextForFriendByPosition
            ? window.imApp.getWorldBookContextForFriendByPosition('system_depth', replyFriend, worldBookContextText)
            : (window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('system_depth') : '');
        const beforeRoleWorldBookContext = window.imApp?.getWorldBookContextForFriendByPosition
            ? window.imApp.getWorldBookContextForFriendByPosition('before_role', replyFriend, worldBookContextText)
            : (window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('before_role') : '');
        const afterRoleWorldBookContext = window.imApp?.getWorldBookContextForFriendByPosition
            ? window.imApp.getWorldBookContextForFriendByPosition('after_role', replyFriend, worldBookContextText)
            : (window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('after_role') : '');

        const effectiveUserPersona = window.imApp?.getEffectivePersonaForFriend
            ? window.imApp.getEffectivePersonaForFriend(replyFriend)
            : (window.userState?.persona || '');
        const contextMessages = window.imApp.buildApiContextMessages
            ? window.imApp.buildApiContextMessages(replyFriend, {
                userName: getCurrentMomentsIdentity().name || 'User'
            })
            : [];

        const systemPrompt = `${systemDepthWorldBookContext ? `System Depth Rules (Highest Priority):\n${systemDepthWorldBookContext}\n\n` : ''}${beforeRoleWorldBookContext ? `Before Role Rules:\n${beforeRoleWorldBookContext}\n\n` : ''}You are generating public replies under an iMessage Moments post.
Moment author: ${momentAuthorName}.
Moment author persona: ${momentAuthorPersona}.
User (${window.userState?.name || 'User'}) persona: ${effectiveUserPersona || window.userState?.persona || 'ordinary user'}.
${afterRoleWorldBookContext ? `\nAfter Role Rules:\n${afterRoleWorldBookContext}\n` : ''}

${NO_USER_SELF_COMMENT_RULE}

Generate 1 to 3 short natural public nested comments from the single allowed speaker below. When the User replied to an existing comment, continue only as the character who wrote that existing comment. Never add replies from the Moment author or related NPCs unless that character is the allowed speaker.

Allowed speakers:
${formatMomentReplyTargetsForPrompt(targets)}

Each speaker's thought and comments must use that speaker's listed language. For every non-Chinese speaker, every text object must include an accurate Simplified Chinese translation; Chinese speakers must use an empty translation string.
Output strict JSON only, with this exact shape:
{"replies":[{"speakerId":"allowed speakerId","thought":{"text":"private thought","translation":"Chinese translation or empty string"},"comments":[{"text":"public reply","translation":"Chinese translation or empty string"}]}]}

Do not output markdown, code fences, explanations, chain-of-thought, [Comment] tags, or any speaker not listed above.`;

        const userPromptParts = [
            `Moment author: ${momentAuthorName}`,
            `Moment text:\n${moment.text || '(no text)'}`,
            imageDescriptions ? `Image descriptions:\n${imageDescriptions}` : '',
            targetComment ? `The user is replying under this existing comment by ${targetComment.name}:\n${targetComment.content}` : 'The user made a top-level public comment.',
            `User comment to answer:\n${userComment.content}`
        ].filter(Boolean);

        const messages = [{ role: 'system', content: systemPrompt }];
        if (Array.isArray(contextMessages) && contextMessages.length > 0) {
            messages.push(...contextMessages);
        }
        messages.push({ role: 'user', content: userPromptParts.join('\n\n') });

        const aiResponse = await requestMomentApiCompletion(messages, 0.8);
        return parseMomentUserCommentReplies(aiResponse, targets);
    }

    async function appendMomentUserCommentReplies(momentId, replyEntries, userComment) {
        const entries = Array.isArray(replyEntries) ? replyEntries : [];
        if (entries.length === 0 || !userComment) return false;

        const saved = await commitMomentsChange(momentId, () => {
            const currentMoment = findMomentById(momentId);
            if (!currentMoment) return;
            if (!Array.isArray(currentMoment.comments)) currentMoment.comments = [];

            entries.forEach((entry) => {
                const target = entry.target;
                const displayName = target.name || getDisplayNameForMomentSpeaker(target.friend);
                entry.comments.forEach((comment) => {
                    currentMoment.comments.push({
                        name: displayName,
                        userId: target.id,
                        content: comment.text,
                        translation: comment.translation,
                        language: target.language,
                        replyToName: userComment.name,
                        replyToContent: userComment.content,
                        thought: entry.thought || '',
                        thoughtTranslation: entry.thoughtTranslation || ''
                    });
                });
            });
        });
        if (!saved) return false;

        if (window.imApp.addMomentNotification) {
            for (const entry of entries) {
                for (const comment of entry.comments) {
                    await window.imApp.addMomentNotification('comment', entry.target.friend, momentId, {
                        content: comment.text,
                        contentTranslation: comment.translation,
                        thought: entry.thought || '',
                        thoughtTranslation: entry.thoughtTranslation || '',
                        language: entry.target.language
                    });
                }
            }
        }
        refreshViewsForMomentUser(findMomentById(momentId));
        return true;
    }

    const handledMomentReplyCommentIds = new Set();

    async function triggerMomentUserCommentReplies(momentId, userComment, targetComment = null, explicitReplyFriend = null) {
        const latestMoment = findMomentById(momentId);
        if (!latestMoment || !userComment) {
            if (window.showToast) window.showToast('朋友圈或评论已不存在');
            return false;
        }

        const replyFriend = explicitReplyFriend || (targetComment
            ? findFriendForMomentComment(targetComment)
            : findFriendForMomentAuthor(latestMoment));
        if (!replyFriend) {
            if (targetComment && window.showToast) window.showToast('找不到这条评论对应的角色');
            return false;
        }

        if (!hasCurrentMomentApiConfig()) {
            if (window.showToast) window.showToast('请先配置 API');
            return false;
        }

        const requestId = String(userComment.id || '').trim();
        if (requestId && handledMomentReplyCommentIds.has(requestId)) return false;
        if (requestId) handledMomentReplyCommentIds.add(requestId);

        try {
            const replyEntries = await generateMomentUserCommentReplies(latestMoment, replyFriend, userComment, targetComment);
            if (!Array.isArray(replyEntries) || replyEntries.length === 0) {
                if (window.showToast) window.showToast('暂无可生成的回复');
                return false;
            }

            const appended = await appendMomentUserCommentReplies(momentId, replyEntries, userComment);
            if (window.showToast) {
                window.showToast(appended ? '角色已回复' : '暂无可生成的回复');
            }
            return appended;
        } catch (error) {
            console.error('Moment user comment reply generation failed:', error);
            if (window.showToast) window.showToast('回复生成失败');
            return false;
        }
    }

    function parseMomentJsonObject(aiResponse) {
        try {
            return JSON.parse(cleanMomentApiJsonText(aiResponse));
        } catch (error) {
            console.warn('Moment JSON parse failed:', error);
            return null;
        }
    }

    function parseAutoMomentResponse(aiResponse, language) {
        const result = { thought: '', thoughtTranslation: '', comment: '', commentTranslation: '', chatReplies: [] };
        const payload = parseMomentJsonObject(aiResponse);
        if (!payload) return result;
        const thought = normalizeMomentLocalizedContent(payload.thought, language);
        const comment = normalizeMomentLocalizedContent(payload.comment, language);
        const chatReplies = (Array.isArray(payload.chatReplies) ? payload.chatReplies : [])
            .map((reply) => normalizeMomentLocalizedContent(reply, language))
            .filter(Boolean)
            .slice(0, 3);
        if (thought) {
            result.thought = thought.text;
            result.thoughtTranslation = thought.translation;
        }
        if (comment) {
            result.comment = comment.text;
            result.commentTranslation = comment.translation;
        }
        result.chatReplies = chatReplies;
        return result;
    }

    function openMomentCommentReply(momentId, commentIndex) {
        const moment = findMomentById(momentId);
        const comments = normalizeMomentComments(moment?.comments);
        const targetComment = comments.find((comment) => String(comment.index) === String(commentIndex));
        if (!moment || !targetComment) return;
        if (isUserMomentComment(targetComment)) return;

        const friend = findFriendForMomentComment(targetComment);
        if (!friend) {
            if (window.showToast) window.showToast('找不到这条评论对应的角色');
            return;
        }

        if (!window.showCustomModal) return;
        window.showCustomModal({
            type: 'prompt',
            title: `回复 ${friend.nickname || friend.realName || targetComment.name}`,
            placeholder: '回复评论...',
            confirmText: '发送',
            confirmTone: 'dark',
            onConfirm: async (text) => {
                const replyText = String(text || '').trim();
                if (!replyText) return;

                const userComment = {
                    id: `moment-comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    name: getCurrentMomentsIdentity().name || 'Me',
                    userId: 'me',
                    content: replyText,
                    replyToName: targetComment.name,
                    replyToContent: targetComment.content
                };

                const userSaved = await commitMomentsChange(momentId, () => {
                    const latestMoment = findMomentById(momentId);
                    if (!latestMoment) return;
                    if (!Array.isArray(latestMoment.comments)) latestMoment.comments = [];
                    latestMoment.comments.push(userComment);
                });
                if (!userSaved) return;

                refreshViewsForMomentUser(findMomentById(momentId));

                if (window.showToast) window.showToast('正在生成角色回复...');
                await triggerMomentUserCommentReplies(momentId, userComment, targetComment, friend);
            }
        });
    }

    function showMomentThoughtSheet(msg) {
        if (!msg || !msg.thought) {
            if (window.showToast) window.showToast('当时TA没有留下特别的心声...');
            return;
        }

        let sheet = document.getElementById('moment-thought-sheet');
        if (!sheet) {
            sheet = document.createElement('div');
            sheet.id = 'moment-thought-sheet';
            sheet.style.cssText = 'position: fixed; inset: 0; z-index: 10000; display: none; align-items: flex-end; justify-content: center;';
            sheet.innerHTML = `
                <div class="moment-thought-overlay" style="position:absolute; inset:0; background:rgba(0,0,0,0.35); opacity:0; transition:opacity 0.25s;"></div>
                <div class="moment-thought-panel" style="position:relative; width:100%; max-width:480px; background:#fff; border-radius:22px 22px 0 0; padding:14px 18px 24px; transform:translateY(100%); transition:transform 0.28s cubic-bezier(0.2,0.8,0.2,1); ">
                    <div style="width:40px; height:4px; border-radius:999px; background:#d1d1d6; margin:0 auto 16px;"></div>
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                        <div class="moment-thought-avatar" style="width:46px; height:46px; border-radius:10px; overflow:hidden; background:#e5e5ea; display:flex; align-items:center; justify-content:center; color:#8e8e93; flex-shrink:0;"></div>
                        <div style="min-width:0; flex:1;">
                            <div class="moment-thought-name" style="font-size:17px; font-weight:700; color:#111; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;"></div>
                            <div class="moment-thought-type" style="font-size:13px; color:#8e8e93; margin-top:2px;"></div>
                        </div>
                        <button class="moment-thought-close" type="button" style="width:32px; height:32px; border:0; border-radius:50%; background:#f2f2f7; color:#555; display:flex; align-items:center; justify-content:center; cursor:pointer;"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="moment-thought-content" style="font-size:16px; line-height:1.65; color:#1c1c1e; background:#f7f7fa; border-radius:14px; padding:14px 16px; white-space:pre-wrap;"></div>
                    <span class="moment-translate-btn moment-thought-translate-btn" role="button" tabindex="0" aria-expanded="false" style="display:none; margin-top:10px;">翻译</span>
                    <div class="moment-thought-translation" style="font-size:15px; margin-top:8px; background:#f7f7fa; border-radius:12px; padding:12px 14px;"></div>
                </div>
            `;
            document.body.appendChild(sheet);

            const closeSheet = () => {
                const overlay = sheet.querySelector('.moment-thought-overlay');
                const panel = sheet.querySelector('.moment-thought-panel');
                if (overlay) overlay.style.opacity = '0';
                if (panel) panel.style.transform = 'translateY(100%)';
                setTimeout(() => {
                    sheet.style.display = 'none';
                }, 260);
            };

            sheet.querySelector('.moment-thought-overlay')?.addEventListener('click', closeSheet);
            sheet.querySelector('.moment-thought-close')?.addEventListener('click', closeSheet);
        }

        const avatarEl = sheet.querySelector('.moment-thought-avatar');
        const nameEl = sheet.querySelector('.moment-thought-name');
        const typeEl = sheet.querySelector('.moment-thought-type');
        const contentEl = sheet.querySelector('.moment-thought-content');
        const translationButton = sheet.querySelector('.moment-thought-translate-btn');
        const translationEl = sheet.querySelector('.moment-thought-translation');
        const overlay = sheet.querySelector('.moment-thought-overlay');
        const panel = sheet.querySelector('.moment-thought-panel');
        const author = getMomentMessageAuthor(msg);

        if (avatarEl) {
            avatarEl.innerHTML = author.avatar
                ? `<img src="${author.avatar}" style="width:100%; height:100%; object-fit:cover;">`
                : '<i class="fas fa-user"></i>';
        }
        if (nameEl) nameEl.textContent = author.name;
        if (typeEl) typeEl.textContent = msg.type === 'like' ? 'Moment like thought' : 'Moment comment thought';
        if (contentEl) contentEl.textContent = msg.thought || '';
        const thoughtTranslation = String(msg.thoughtTranslation || '').trim();
        if (translationEl) {
            translationEl.textContent = thoughtTranslation;
            translationEl.style.display = 'none';
        }
        if (translationButton) {
            translationButton.style.display = thoughtTranslation ? 'inline' : 'none';
            translationButton.textContent = '翻译';
            translationButton.setAttribute('aria-expanded', 'false');
            const toggleThoughtTranslation = (event) => {
                event.preventDefault();
                event.stopPropagation();
                setTranslationExpanded(translationButton, translationEl, translationEl.style.display !== 'block');
            };
            translationButton.onclick = toggleThoughtTranslation;
            translationButton.onkeydown = (event) => {
                if (event.key === 'Enter' || event.key === ' ') toggleThoughtTranslation(event);
            };
        }

        sheet.style.display = 'flex';
        void sheet.offsetWidth;
        if (overlay) overlay.style.opacity = '1';
        if (panel) panel.style.transform = 'translateY(0)';
    }

    async function appendAutoMomentChatReplies(friend, replies) {
        if (!friend || !Array.isArray(replies) || replies.length === 0) return;

        const cleanReplies = replies
            .map((reply) => {
                if (reply && typeof reply === 'object') {
                    return {
                        text: String(reply.text || '').trim(),
                        translation: String(reply.translation || '').trim()
                    };
                }
                return { text: String(reply || '').trim(), translation: '' };
            })
            .filter((reply) => reply.text)
            .slice(0, 3);
        if (cleanReplies.length === 0) return;

        if (window.imApp?.ensureFriendMessagesLoaded) {
            await window.imApp.ensureFriendMessagesLoaded(friend.id);
        }

        const liveFriend = (window.imData.friends || []).find((item) => String(item.id) === String(friend.id)) || friend;
        const baseTime = Date.now();

        for (let index = 0; index < cleanReplies.length; index += 1) {
            const msgObj = {
                id: window.imChat?.createMessageId ? window.imChat.createMessageId('msg') : `auto-moment-${baseTime}-${index}`,
                role: 'assistant',
                content: cleanReplies[index].text,
                timestamp: baseTime + index
            };
            if (cleanReplies[index].translation) {
                msgObj.translation = cleanReplies[index].translation;
                msgObj.showTranslation = liveFriend.autoExpandTranslation === true;
            }

            if (window.imApp.appendFriendMessage) {
                await window.imApp.appendFriendMessage(liveFriend.id || friend.id, msgObj, { silent: true });
            } else {
                await commitFriendsChange(liveFriend.id || friend.id, (targetFriend) => {
                    if (!targetFriend) return;
                    if (!Array.isArray(targetFriend.messages)) targetFriend.messages = [];
                    targetFriend.messages.push(msgObj);
                }, { silent: true });
            }
        }

        const page = document.getElementById(`chat-interface-${liveFriend.id || friend.id}`);
        const container = page && page.style.display !== 'none'
            ? page.querySelector('.ins-chat-messages')
            : null;
        if (container && window.imChat?.rerenderChatContainer) {
            const latestFriend = (window.imData.friends || []).find((item) => String(item.id) === String(liveFriend.id || friend.id)) || liveFriend;
            window.imChat.rerenderChatContainer(latestFriend, container, { scroll: true });
        }
    }

    // --- Rendering Feed Elements ---
    function createMomentElement(m) {
        const item = document.createElement('div');
        item.className = 'moment-item';

        const momentId = m.id;

        // Dynamically fetch the latest avatar based on userId
        let currentAvatar = m.avatar;
        let currentName = m.name;
        if (m.userId === 'me' || m.userId === 'self') {
            const user = getCurrentMomentsIdentity();
            currentAvatar = user.avatarUrl;
            currentName = user.name;
        } else {
            const friend = window.imData.friends ? window.imData.friends.find(f => f.id == m.userId || f.id === m.userId) : null;
            if (friend) {
                currentAvatar = friend.avatarUrl;
                currentName = friend.nickname || friend.realName || currentName;
            }
        }

        let avatarHtml = currentAvatar
            ? `<img src="${currentAvatar}">`
            : `<i class="fas fa-user"></i>`;

        let imagesHtml = '';
        if (m.images && m.images.length > 0) {
            let layoutClass = 'grid';
            if (m.images.length === 1) layoutClass = 'single';
            if (m.images.length === 2 || m.images.length === 4) layoutClass = 'double';

            const imgDivs = m.images.map((img, index) => {
                const src = getMomentImageSource(img);
                return `<div class="moment-img-wrapper" data-image-index="${index}" style="cursor:pointer;"><img src="${src}" onerror="this.style.display='none'; this.parentElement.style.background='#ffebee'; this.parentElement.innerHTML='<div style=\\'font-size:10px;color:#ff3b30;padding:5px;text-align:center;\\'>过期</div>';" style="width:100%; height:100%; object-fit:cover;"></div>`;
            }).join('');
            imagesHtml = `<div class="moment-images ${layoutClass}">${imgDivs}</div>`;
        }

        let interactionHtml = '';
        const normalizedComments = normalizeMomentComments(m.comments);
        const hasLikes = m.likes && m.likes.length > 0;
        const hasComments = normalizedComments.length > 0;

        if (hasLikes || hasComments) {
            let likesHtml = '';
            if (hasLikes) {
                likesHtml = `<div class="moment-likes"><i class="far fa-heart" style="margin-top:2px;"></i> <span class="moment-likes-list">${m.likes.map(escapeMomentHtml).join(', ')}</span></div>`;
            }

            let commentsHtml = '';
            if (hasComments) {
                commentsHtml = normalizedComments.map((c) => renderMomentCommentHtml(c, 'moment-comment')).join('');
            }

            interactionHtml = `
                <div class="moment-interaction-area">
                    ${likesHtml}
                    ${hasLikes && hasComments ? '<div style="border-bottom: 1px solid #e5e5ea; margin: 4px 0;"></div>' : ''}
                    ${commentsHtml}
                </div>
            `;
        }

        const currentMyName = getCurrentMomentsIdentity().name || 'Me';
        const hasLiked = m.likes && m.likes.includes(currentMyName);
        const likeText = hasLiked ? '取消' : '赞';

        const timeStr = window.imApp.formatTime ? window.imApp.formatTime(m.time) : '';
        const momentTranslation = String(m.translation || '').trim();
        const translationHtml = momentTranslation
            ? `<div class="moment-translation">${escapeMomentHtml(momentTranslation)}</div>`
            : '';
        const translationButtonHtml = momentTranslation
            ? '<span class="moment-translate-btn moment-post-translate-btn" role="button" tabindex="0" aria-expanded="false">翻译</span>'
            : '';

        item.innerHTML = `
            <div class="moment-avatar" style="cursor: pointer;">${avatarHtml}</div>
            <div class="moment-main">
                <div class="moment-name">${escapeMomentHtml(currentName || '')}</div>
                <div class="moment-text">${escapeMomentHtml(m.text || '')}</div>
                ${translationHtml}
                ${imagesHtml}
                <div class="moment-footer">
                    <div class="moment-time-actions"><span class="moment-time">${escapeMomentHtml(timeStr)}</span>${translationButtonHtml}</div>
                    <div class="moment-action-btn"><i class="fas fa-ellipsis-h" style="transform: scale(0.8)"></i></div>
                    <div class="moment-action-menu">
                        <div class="moment-action-item like-btn"><i class="far fa-heart"></i> ${likeText}</div>
                        <div class="moment-action-item comment-btn"><i class="far fa-comment"></i> 评论</div>
                        <div class="moment-action-item forward-btn"><i class="fas fa-share"></i> 转发</div>
                        <div class="moment-action-item delete-btn"><i class="fas fa-trash"></i> 删除</div>
                    </div>
                </div>
                ${interactionHtml}
            </div>
        `;

        item.addEventListener('click', (e) => {
            // Prevent clicking the moment item from opening chat if we clicked a button
            if (e.target.closest('.moment-action-btn') || e.target.closest('.moment-action-menu')) return;
        });

        bindTranslationButton(
            item.querySelector('.moment-post-translate-btn'),
            item.querySelector('.moment-translation')
        );
        bindMomentCommentInteractions(
            item,
            '.moment-comment',
            (commentIndex) => openMomentCommentReply(momentId, commentIndex),
            (commentIndex) => deleteMomentComment(momentId, commentIndex)
        );
        item.querySelectorAll('.moment-img-wrapper').forEach((wrapper) => {
            wrapper.addEventListener('click', (event) => {
                event.stopPropagation();
                openMomentImageDetail(m.images[Number(wrapper.dataset.imageIndex)], m);
            });
        });

        const actionBtn = item.querySelector('.moment-action-btn');
        const actionMenu = item.querySelector('.moment-action-menu');

        actionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.moment-action-menu.active').forEach((menu) => {
                if (menu !== actionMenu) menu.classList.remove('active');
            });
            actionMenu.classList.toggle('active');
        });

        item.querySelector('.like-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            actionMenu.classList.remove('active');

            const saved = await commitMomentsChange(momentId, (moment) => {
                if (!moment) return;
                if (!moment.likes) moment.likes = [];
                const idx = moment.likes.indexOf(currentMyName);
                if (idx > -1) moment.likes.splice(idx, 1);
                else moment.likes.push(currentMyName);
            });

            if (!saved) return;

            const latestMoment = findMomentById(momentId);
            refreshViewsForMomentUser(latestMoment);
        });

        item.querySelector('.forward-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            actionMenu.classList.remove('active');
            const latestMoment = findMomentById(momentId) || m;
            openMomentForwardSheet(latestMoment);
        });

        item.querySelector('.comment-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            actionMenu.classList.remove('active');
            if (window.showCustomModal) {
                window.showCustomModal({
                    type: 'prompt',
                    title: '评论',
                    placeholder: '评论...',
                    confirmText: '发送',
                    onConfirm: async (text) => {
                        if (!text || !text.trim()) return;

                        const newComment = {
                            id: `moment-comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                            name: getCurrentMomentsIdentity().name || 'Me',
                            userId: 'me',
                            content: text.trim()
                        };

                        const saved = await commitMomentsChange(momentId, () => {
                            const moment = findMomentById(momentId);
                            if (!moment) return;
                            if (!moment.comments) moment.comments = [];
                            moment.comments.push(newComment);
                        });

                        if (!saved) return;

                        const latestMoment = findMomentById(momentId);
                        refreshViewsForMomentUser(latestMoment);
                        if (findFriendForMomentAuthor(latestMoment)) {
                            if (window.showToast) window.showToast('正在生成角色回复...');
                            await triggerMomentUserCommentReplies(momentId, newComment);
                        }
                    }
                });
            }
        });

        item.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            actionMenu.classList.remove('active');
            if (window.showCustomModal) {
                window.showCustomModal({
                    title: '删除朋友圈',
                    message: '确定要删除这条朋友圈吗？',
                    isDestructive: true,
                    confirmText: '删除',
                    onConfirm: async () => {
                        const targetMomentId = momentId;
                        const saved = await deleteMomentPermanently(targetMomentId);
                        if (!saved) return;

                        refreshAllMomentsViews();
                        if (window.showToast) window.showToast('已删除');
                    }
                });
            }
        });

        return item;
    }

    function renderMoments() {
        const list = document.getElementById('moments-list');
        if (!list) return;
        list.innerHTML = '';

        const moments = Array.isArray(window.imData?.moments) ? window.imData.moments : [];
        moments.forEach((m) => {
            const item = createMomentElement(m);
            list.appendChild(item);
        });
    }

    function openMomentForwardSheet(m) {
        const sheet = document.getElementById('moment-forward-sheet');
        const list = document.getElementById('moment-forward-list');
        if (!sheet || !list) return;

        list.innerHTML = '';
        if (window.imData.friends && window.imData.friends.length > 0) {
            window.imData.friends.forEach((friend) => {
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.flexDirection = 'column';
                item.style.alignItems = 'center';
                item.style.gap = '5px';
                item.style.cursor = 'pointer';
                item.style.minWidth = '60px';

                const avatarHtml = friend.avatarUrl
                    ? `<img src="${friend.avatarUrl}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover;">`
                    : (friend.type === 'npc'
                        ? `<div style="width: 50px; height: 50px; border-radius: 8px; background: #e5e5ea; display: flex; justify-content: center; align-items: center; color: #8e8e93; font-size: 24px;"><i class="fas fa-robot"></i></div>`
                        : `<div style="width: 50px; height: 50px; border-radius: 8px; background: #e5e5ea; display: flex; justify-content: center; align-items: center; color: #8e8e93; font-size: 24px;"><i class="fas fa-user"></i></div>`);

                item.innerHTML = `
                    <div class="moment-share-friend-avatar" style="width: auto; height: auto; border-radius: 0; margin: 0;">${avatarHtml}</div>
                    <div class="moment-share-friend-name" style="font-size: 11px; color: #000; text-align: center; width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${friend.nickname}</div>
                `;

                item.addEventListener('click', async () => {
                    const contentObj = {
                        id: m.id,
                        text: m.text,
                        img: null,
                        imgDesc: null
                    };

                    if (m.images && m.images.length > 0) {
                        const firstImg = m.images[0];
                        contentObj.img = getMomentImageSource(firstImg);
                        contentObj.imgDesc = typeof firstImg === 'object' ? firstImg.desc : null;
                    }

                    const content = JSON.stringify(contentObj);

                    const msgData = {
                        role: 'user',
                        type: 'moment_forward',
                        content: content,
                        timestamp: Date.now()
                    };
                    window.imApp.captureGroupUserIdentity?.(friend, msgData);

                    const saved = window.imApp.appendFriendMessage
                        ? await window.imApp.appendFriendMessage(friend.id, msgData, { silent: true })
                        : await commitFriendsChange(friend.id, (targetFriend) => {
                            if (!targetFriend.messages) targetFriend.messages = [];
                            targetFriend.messages.push(msgData);
                        });
                    if (!saved) return;

                    const pageId = `chat-interface-${friend.id}`;
                    const page = document.getElementById(pageId);
                    if (page && page.style.display !== 'none') {
                        const msgContainer = page.querySelector('.ins-chat-messages');
                        if (window.imApp.renderMomentForwardBubble) window.imApp.renderMomentForwardBubble(msgData, friend, msgContainer, msgData.timestamp);
                    }

                    showToast(`已转发给 ${friend.nickname}`);
                    closeView(sheet);
                });

                list.appendChild(item);
            });
        } else {
            list.innerHTML = '<div style="font-size: 13px; color: #8e8e93; text-align: center; width: 100%; padding: 20px;">暂无联系人</div>';
        }

        openView(sheet);
    }

    const forwardSheetEl = document.getElementById('moment-forward-sheet');
    if (forwardSheetEl) {
        forwardSheetEl.addEventListener('click', (e) => {
            if (e.target === forwardSheetEl) closeView(forwardSheetEl);
        });
    }

    const forwardSheetCancel = document.getElementById('moment-forward-cancel');
    if (forwardSheetCancel) {
        forwardSheetCancel.addEventListener('click', () => {
            const sheet = document.getElementById('moment-forward-sheet');
            if (sheet) closeView(sheet);
        });
    }

    // --- Moments Messages View ---
    const mainMomentsMessageBtn = document.getElementById('main-moments-message-btn');
    const momentsMessageView = document.getElementById('moments-message-view');
    const momentsMessageBack = document.getElementById('moments-message-back');
    const momentsNewMessageBubble = document.getElementById('moments-new-message-bubble');

    async function openMomentsMessageCenter() {
        await ensureMomentMessagesModuleDataReady();
        await markCurrentMomentMessagesRead();
        if (momentsMessageView) {
            renderMomentsMessages();
            momentsMessageView.style.display = 'flex';
            void momentsMessageView.offsetWidth;
            momentsMessageView.classList.add('active');
        }
    }

    if (mainMomentsMessageBtn) {
        mainMomentsMessageBtn.addEventListener('click', openMomentsMessageCenter);
    }
    if (momentsNewMessageBubble) momentsNewMessageBubble.addEventListener('click', openMomentsMessageCenter);

    if (momentsMessageBack) {
        momentsMessageBack.addEventListener('click', () => {
            if (momentsMessageView) {
                momentsMessageView.classList.remove('active');
                setTimeout(() => momentsMessageView.style.display = 'none', 300);
            }
        });
    }

    function renderMomentsMessages() {
        const list = document.getElementById('moments-message-list');
        if (!list) return;
        list.innerHTML = '';

        const currentMomentMessages = getMomentMessages();
        if (currentMomentMessages.length === 0) {
            list.innerHTML = `
                <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100%; color:#8e8e93;">
                    <i class="far fa-comment-dots" style="font-size:50px; margin-bottom:20px; color:#e5e5ea;"></i>
                    <div style="font-size:16px;">暂无新消息</div>
                </div>`;
            return;
        }

        const msgListContainer = document.createElement('div');
        msgListContainer.style.cssText = 'flex:1; overflow-y:auto; padding-bottom:16px;';

        currentMomentMessages.forEach((msg) => {
            const item = document.createElement('div');
            item.className = 'moment-message-item';
            item.style.cssText = 'display:flex; padding:15px; border-bottom:1px solid #f2f2f2; gap:12px; cursor:pointer; transition:background-color 0.2s;';

            item.addEventListener('mousedown', () => item.style.backgroundColor = '#f2f2f7');
            item.addEventListener('mouseup', () => item.style.backgroundColor = '#fff');
            item.addEventListener('mouseleave', () => item.style.backgroundColor = '#fff');
            item.addEventListener('touchstart', () => item.style.backgroundColor = '#f2f2f7', {passive: true});
            item.addEventListener('touchend', () => item.style.backgroundColor = '#fff');
            item.addEventListener('touchcancel', () => item.style.backgroundColor = '#fff');

            const author = getMomentMessageAuthor(msg);
            const avatarHtml = author.avatar
                ? `<img src="${author.avatar}" style="width:44px; height:44px; border-radius:6px; object-fit:cover;">`
                : `<div style="width:44px; height:44px; border-radius:6px; background:#e5e5ea; display:flex; justify-content:center; align-items:center; color:#8e8e93;"><i class="fas fa-user"></i></div>`;

            const contentHtml = msg.type === 'like'
                ? `<div style="font-size:16px; color:#576b95; font-weight:600; margin-bottom:4px;">${author.name}</div><div style="font-size:15px; color:#576b95;"><i class="far fa-heart"></i></div>`
                : `<div style="font-size:16px; color:#576b95; font-weight:600; margin-bottom:4px;">${author.name}</div><div style="font-size:15px; color:#111; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${msg.content || ''}</div>`;

            let momentPreview = '';
            if (msg.momentImg) {
                momentPreview = `<img src="${msg.momentImg}" style="width:60px; height:60px; object-fit:cover; background:#f2f2f7;">`;
            } else if (msg.momentText) {
                momentPreview = `<div style="width:60px; height:60px; background:#f2f2f7; color:#8e8e93; font-size:12px; padding:6px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; line-height:1.3;">${msg.momentText}</div>`;
            } else {
                momentPreview = `<div style="width:60px; height:60px; background:#f2f2f7;"></div>`;
            }

            const timeStr = window.imApp.formatTime ? window.imApp.formatTime(msg.time) : '';

            item.innerHTML = `
                <div style="flex-shrink:0;">${avatarHtml}</div>
                <div style="flex:1; min-width:0; display:flex; flex-direction:column; justify-content:space-between;">
                    <div>${contentHtml}</div>
                    <div style="font-size:12px; color:#8e8e93; margin-top:8px;">${timeStr}</div>
                </div>
                <div style="flex-shrink:0; margin-left:10px;">${momentPreview}</div>
                <button class="moment-message-delete-btn" type="button" title="Delete" style="width:20px; height:20px; border:0; background:transparent; color:#8e8e93; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; align-self:center; font-size:18px; line-height:1; padding:0;">&times;</button>
            `;

            item.addEventListener('click', () => {
                showMomentThoughtSheet(msg);
            });

            item.querySelector('.moment-message-delete-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!window.showCustomModal) return;
                window.showCustomModal({
                    title: '删除消息',
                    message: '确定要删除这条朋友圈消息吗？',
                    isDestructive: true,
                    confirmText: '删除',
                    onConfirm: async () => {
                        const deleted = await deleteMomentMessage(msg);
                        if (!deleted) {
                            if (window.showToast) window.showToast('删除失败');
                            return;
                        }
                        renderMomentsMessages();
                        updateMomentsNewMessageBubble();
                    }
                });
            });

            msgListContainer.appendChild(item);
        });

        list.appendChild(msgListContainer);
    }
    function getLastChatTimestampWithUser(friend) {
        if (!friend) return 0;

        const summaryTimestamp = Number(friend.lastMessageTimestamp) || 0;
        if (summaryTimestamp > 0) return summaryTimestamp;

        if (!Array.isArray(friend.messages) || friend.messages.length === 0) return 0;
        const validMessages = friend.messages.filter((msg) => msg && Number(msg.timestamp) > 0);
        if (validMessages.length === 0) return 0;
        return Math.max(...validMessages.map((msg) => Number(msg.timestamp) || 0));
    }

    function pickRandomItems(items, count) {
        const pool = Array.isArray(items) ? [...items] : [];
        const picked = [];
        while (pool.length > 0 && picked.length < count) {
            const index = Math.floor(Math.random() * pool.length);
            picked.push(pool.splice(index, 1)[0]);
        }
        return picked;
    }

    function getEligibleAutoMomentFriends(moment = null) {
        const allFriends = Array.isArray(window.imData.friends) ? window.imData.friends : [];
        const eligibleFriends = allFriends.filter((friend) => {
            if (!friend) return false;
            if (friend.type === 'group' || friend.type === 'official') return false;
            return true;
        });

        // Legacy user moments had no recipient list and remain public. New user
        // moments store an explicit Char-only audience snapshot.
        if (!moment || !isUserMoment(moment) || !Array.isArray(moment.visibleToCharIds)) {
            return eligibleFriends;
        }

        const visibleCharIds = new Set(moment.visibleToCharIds.map((id) => String(id ?? '').trim()).filter(Boolean));
        return eligibleFriends.filter((friend) => {
            return friend.type === 'char' && visibleCharIds.has(String(friend.id));
        });
    }

    function getAutoCommentCandidates(moment = null) {
        const eligibleChars = getEligibleAutoMomentFriends(moment);
        if (eligibleChars.length === 0) return [];

        const twelveHoursMs = 12 * 60 * 60 * 1000;
        const now = Date.now();

        const recentChatChars = eligibleChars.filter((friend) => {
            const lastChatTime = getLastChatTimestampWithUser(friend);
            return lastChatTime > 0 && (now - lastChatTime) <= twelveHoursMs;
        });

        const sourcePool = recentChatChars.length > 0 ? recentChatChars : eligibleChars;
        const targetCount = Math.min(
            sourcePool.length,
            Math.max(1, Math.floor(Math.random() * 3) + 1)
        );

        return pickRandomItems(sourcePool, targetCount);
    }

    function getMomentImageDescriptions(moment) {
        return Array.isArray(moment?.images)
            ? moment.images
                .map((img) => typeof img === 'object' ? (img.desc || '未命名图片') : '图片')
                .filter(Boolean)
                .join('，')
            : '';
    }

    function getApiChatCompletionsEndpoint(config = getCurrentMomentApiConfig()) {
        return window.u2Api.resolveChatCompletionsEndpoint(config?.endpoint || '');
    }

    async function requestMomentApiCompletion(messages, temperature = 0.8) {
        const currentApiConfig = getCurrentMomentApiConfig();
        if (!hasCurrentMomentApiConfig(currentApiConfig)) {
            throw new Error('API config missing');
        }

        const response = await fetch(getApiChatCompletionsEndpoint(currentApiConfig), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentApiConfig.apiKey}` },
            body: JSON.stringify({
                model: currentApiConfig.model || '',
                messages,
                temperature: parseFloat(currentApiConfig.temperature) || temperature
            })
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const data = await response.json();
        return data?.choices?.[0]?.message?.content?.trim() || null;
    }

    function getAutoLikeFallbackThought(friend) {
        const lastChatTime = getLastChatTimestampWithUser(friend);
        const hasRecentChat = lastChatTime > 0 && (Date.now() - lastChatTime) <= 12 * 60 * 60 * 1000;
        const language = normalizeMomentLanguage(friend?.language || 'zh');
        const translations = hasRecentChat
            ? {
                zh: '看见这条动态有些在意，先点个赞，等合适的时候再私下聊聊。',
                en: 'This caught my attention. I will leave a like and talk about it privately when the timing feels right.',
                ja: 'この投稿が少し気になった。まずはいいねをして、タイミングを見てあとで話そう。',
                ko: '이 게시물이 조금 신경 쓰인다. 일단 좋아요를 누르고 적당할 때 따로 이야기해야겠다.',
                fr: 'Cette publication m’interpelle. Je vais laisser un j’aime et en parler en privé au bon moment.'
            }
            : {
                zh: '觉得这条动态有点意思，但关系还不太熟，先默默点个赞不打扰。',
                en: 'This is interesting, but we are not close enough yet. I will quietly leave a like without intruding.',
                ja: '少し気になるけれど、まだそこまで親しくない。邪魔せず静かにいいねだけしておこう。',
                ko: '조금 흥미롭지만 아직 많이 친하지는 않다. 방해하지 말고 조용히 좋아요만 눌러야겠다.',
                fr: 'C’est intéressant, mais nous ne sommes pas encore assez proches. Je vais simplement laisser un j’aime.'
            };
        const text = translations[language] || translations.zh;
        return {
            text,
            translation: language === 'zh' ? '' : translations.zh,
            language
        };
    }

    function parseAutoLikeThought(aiResponse, friend) {
        const payload = parseMomentJsonObject(aiResponse);
        return normalizeMomentLocalizedContent(payload?.thought, friend?.language || 'zh') || getAutoLikeFallbackThought(friend);
    }

    async function generateAutoLikeThoughtForMoment(moment, friend) {
        if (!moment || !friend || !hasCurrentMomentApiConfig()) {
            return getAutoLikeFallbackThought(friend);
        }

        try {
            const systemDepthWorldBookContext = window.getGlobalWorldBookContextByPosition
                ? window.getGlobalWorldBookContextByPosition('system_depth')
                : '';
            const beforeRoleWorldBookContext = window.getGlobalWorldBookContextByPosition
                ? window.getGlobalWorldBookContextByPosition('before_role')
                : '';
            const afterRoleWorldBookContext = window.getGlobalWorldBookContextByPosition
                ? window.getGlobalWorldBookContextByPosition('after_role')
                : '';

            if (window.imApp?.ensureFriendMessagesLoaded) {
                await window.imApp.ensureFriendMessagesLoaded(friend.id);
            }
            const contextFriend = (window.imData.friends || []).find((item) => String(item.id) === String(friend.id)) || friend;
            const contextMessages = window.imApp.buildApiContextMessages
                ? window.imApp.buildApiContextMessages(contextFriend, {
                    userName: window.userState?.name || 'User'
                })
                : [];

            const lastChatTime = getLastChatTimestampWithUser(friend);
            const hasRecentChat = lastChatTime > 0 && (Date.now() - lastChatTime) <= 12 * 60 * 60 * 1000;
            const imageDescriptions = getMomentImageDescriptions(moment);
            const systemPrompt = `${systemDepthWorldBookContext ? `System Depth Rules (Highest Priority):\n${systemDepthWorldBookContext}\n\n` : ''}${beforeRoleWorldBookContext ? `Before Role Rules:\n${beforeRoleWorldBookContext}\n\n` : ''}You are roleplaying ${friend.realName || friend.nickname}.
Role persona: ${friend.persona || 'ordinary user'}.
User (${window.userState?.name || 'User'}) persona: ${window.userState?.persona || 'ordinary user'}.
${afterRoleWorldBookContext ? `\nAfter Role Rules:\n${afterRoleWorldBookContext}\n` : ''}

${NO_USER_SELF_COMMENT_RULE}

The user just posted a moment. This character will like it but will not leave a public comment.
Generate only this character's private thought about liking silently. Keep it concise and fit the relationship and recent chat context.
If they are not close to the user, reflect being interested but not familiar enough to comment.
${buildMomentLanguageContract(friend.language || 'zh', 'thought')}
Output strict JSON only: {"thought":{"text":"private thought","translation":"Chinese translation or empty string"}}
Do not output comments, private chat replies, markdown, explanations, or chain-of-thought.`;

            const userPromptParts = [
                `User moment text:\n${moment.text || '(no text)'}`,
                imageDescriptions ? `Image descriptions:\n${imageDescriptions}` : '',
                `Recent chat status: ${hasRecentChat ? 'chatted with the user recently' : 'has not chatted with the user recently'}`
            ].filter(Boolean);

            const messages = [{ role: 'system', content: systemPrompt }];
            if (Array.isArray(contextMessages) && contextMessages.length > 0) {
                messages.push(...contextMessages);
            }
            messages.push({ role: 'user', content: userPromptParts.join('\n\n') });

            const aiResponse = await requestMomentApiCompletion(messages, 0.75);
            return parseAutoLikeThought(aiResponse, friend);
        } catch (error) {
            console.error('Auto moment like thought failed:', error);
            return getAutoLikeFallbackThought(friend);
        }
    }

    async function generateAutoCommentForMoment(moment, friend) {
        if (!moment || !friend || !hasCurrentMomentApiConfig()) return null;

        const systemDepthWorldBookContext = window.getGlobalWorldBookContextByPosition
            ? window.getGlobalWorldBookContextByPosition('system_depth')
            : '';
        const beforeRoleWorldBookContext = window.getGlobalWorldBookContextByPosition
            ? window.getGlobalWorldBookContextByPosition('before_role')
            : '';
        const afterRoleWorldBookContext = window.getGlobalWorldBookContextByPosition
            ? window.getGlobalWorldBookContextByPosition('after_role')
            : '';

        if (window.imApp?.ensureFriendMessagesLoaded) {
            await window.imApp.ensureFriendMessagesLoaded(friend.id);
        }
        const contextFriend = (window.imData.friends || []).find((item) => String(item.id) === String(friend.id)) || friend;
        const contextMessages = window.imApp.buildApiContextMessages
            ? window.imApp.buildApiContextMessages(contextFriend, {
                userName: window.userState?.name || 'User'
            })
            : [];

        const lastChatTime = getLastChatTimestampWithUser(friend);
        const hasRecentChat = lastChatTime > 0 && (Date.now() - lastChatTime) <= 12 * 60 * 60 * 1000;
        const imageDescriptions = getMomentImageDescriptions(moment);
        const targetLanguage = normalizeMomentLanguage(friend.language || 'zh');

        const autoCommentOutputContract = [
            'Output contract override:',
            '1. Generate exactly one short natural public comment for the user moment.',
            '2. Generate one concise private thought that fits this character and the recent chat context.',
            '3. Generate 1 to 3 private chat replies this character would send to the user about this moment.',
            `4. ${buildMomentLanguageContract(targetLanguage, 'thought')}`,
            `5. ${buildMomentLanguageContract(targetLanguage, 'comment')}`,
            `6. ${buildMomentLanguageContract(targetLanguage, 'every chatReplies item')}`,
            '7. Output strict JSON only with this shape:',
            '{"thought":{"text":"private thought","translation":"Chinese translation or empty string"},"comment":{"text":"public comment","translation":"Chinese translation or empty string"},"chatReplies":[{"text":"private chat reply","translation":"Chinese translation or empty string"}]}',
            '8. Do not decide likes, output markdown, labels, explanations, or chain-of-thought.'
        ].join('\n');

        const autoCommentRolePrompt = `${systemDepthWorldBookContext ? `System Depth Rules (Highest Priority):\n${systemDepthWorldBookContext}\n\n` : ''}${beforeRoleWorldBookContext ? `Before Role Rules:\n${beforeRoleWorldBookContext}\n\n` : ''}You are roleplaying ${friend.realName || friend.nickname}.
Role persona: ${friend.persona || 'ordinary user'}.
User (${window.userState?.name || 'User'}) persona: ${window.userState?.persona || 'ordinary user'}.
${afterRoleWorldBookContext ? `\nAfter Role Rules:\n${afterRoleWorldBookContext}\n` : ''}

${NO_USER_SELF_COMMENT_RULE}

You need to react to a moment just posted by the user.
Use the attached chat history and role context to make the thought and private chat replies feel specific to this character.
If you chatted with the user recently, the public comment and private replies can feel more familiar. Otherwise keep a more restrained boundary.`;

        const autoCommentUserPromptParts = [
            `User moment text:\n${moment.text || '(no text)'}`,
            imageDescriptions ? `Image descriptions:\n${imageDescriptions}` : '',
            `Recent chat status: ${hasRecentChat ? 'chatted with the user recently' : 'has not chatted with the user recently'}`
        ].filter(Boolean);

        const messages = [{ role: 'system', content: `${autoCommentRolePrompt}\n\n${autoCommentOutputContract}` }];
        if (Array.isArray(contextMessages) && contextMessages.length > 0) {
            messages.push(...contextMessages);
        }
        messages.push({ role: 'user', content: autoCommentUserPromptParts.join('\n\n') });

        return requestMomentApiCompletion(messages, 0.8);
    }

    function hasMomentNotification(type, friend, momentId) {
        const messages = getMomentMessages();
        const friendId = friend?.id || friend?.userId;
        return messages.some((msg) => {
            if (!msg) return false;
            return String(msg.type || '') === String(type || '') &&
                String(msg.userId || '') === String(friendId || '') &&
                String(msg.momentId || '') === String(momentId || '');
        });
    }

    async function addMomentNotificationOnce(type, friend, momentId, payload = {}) {
        if (!window.imApp.addMomentNotification) return false;
        if (hasMomentNotification(type, friend, momentId)) return true;
        return window.imApp.addMomentNotification(type, friend, momentId, payload);
    }

    async function triggerAutoCommentsForMyMoment(momentId) {
        const baseMoment = findMomentById(momentId);
        if (!baseMoment || !hasCurrentMomentApiConfig()) return;

        const eligibleFriends = getEligibleAutoMomentFriends(baseMoment);
        if (!Array.isArray(eligibleFriends) || eligibleFriends.length === 0) return;

        const candidates = getAutoCommentCandidates(baseMoment);
        const commentCandidateIds = new Set(candidates.map((friend) => String(friend.id)));
        const generatedInteractions = [];
        const nonCommentThoughts = new Map();

        for (const friend of candidates) {
            try {
                const latestMoment = findMomentById(momentId);
                if (!latestMoment) break;

                const aiResponse = await generateAutoCommentForMoment(latestMoment, friend);
                if (!aiResponse) continue;

                const language = normalizeMomentLanguage(friend.language || 'zh');
                const parsedResponse = parseAutoMomentResponse(aiResponse, language);
                if (!parsedResponse.comment.trim()) {
                    nonCommentThoughts.set(String(friend.id), parsedResponse.thought
                        ? { text: parsedResponse.thought, translation: parsedResponse.thoughtTranslation, language }
                        : getAutoLikeFallbackThought(friend));
                    continue;
                }

                const fallbackThought = getAutoLikeFallbackThought(friend);
                const displayName = friend.nickname || friend.realName || 'Friend';
                generatedInteractions.push({
                    friend,
                    name: displayName,
                    content: parsedResponse.comment.trim(),
                    translation: parsedResponse.commentTranslation,
                    language,
                    thought: parsedResponse.thought || fallbackThought.text,
                    thoughtTranslation: parsedResponse.thought ? parsedResponse.thoughtTranslation : fallbackThought.translation,
                    chatReplies: parsedResponse.chatReplies
                });
            } catch (e) {
                console.error('Auto moment comment failed:', e);
                nonCommentThoughts.set(String(friend.id), getAutoLikeFallbackThought(friend));
            }
        }

        const generatedByFriendId = new Map(
            generatedInteractions.map((entry) => [String(entry.friend.id), entry])
        );
        const likeInteractions = [];

        for (const friend of eligibleFriends) {
            const generatedComment = generatedByFriendId.get(String(friend.id));
            if (generatedComment) {
                likeInteractions.push(generatedComment);
                continue;
            }

            const latestMoment = findMomentById(momentId);
            if (!latestMoment) break;

            const friendId = String(friend.id);
            const thoughtPayload = commentCandidateIds.has(friendId)
                ? (nonCommentThoughts.get(friendId) || getAutoLikeFallbackThought(friend))
                : await generateAutoLikeThoughtForMoment(latestMoment, friend);
            likeInteractions.push({
                friend,
                name: friend.nickname || friend.realName || 'Friend',
                content: '',
                language: normalizeMomentLanguage(friend.language || 'zh'),
                thought: thoughtPayload.text,
                thoughtTranslation: thoughtPayload.translation,
                chatReplies: []
            });
        }

        if (likeInteractions.length === 0) return;

        const saved = await commitMomentsChange(momentId, () => {
            const moment = findMomentById(momentId);
            if (!moment) return;
            if (!Array.isArray(moment.comments)) moment.comments = [];
            if (!Array.isArray(moment.likes)) moment.likes = [];

            generatedInteractions.forEach((entry) => {
                const hasSameComment = moment.comments.some((comment) => {
                    if (!comment) return false;
                    return String(comment.name || comment.userName || '') === String(entry.name) &&
                        String(comment.content || comment.text || '') === String(entry.content);
                });
                if (!hasSameComment) {
                    moment.comments.push({
                        name: entry.name,
                        userId: entry.friend.id,
                        content: entry.content,
                        translation: entry.translation,
                        language: entry.language,
                        thought: entry.thought,
                        thoughtTranslation: entry.thoughtTranslation
                    });
                }
            });

            likeInteractions.forEach((entry) => {
                if (!moment.likes.includes(entry.name)) {
                    moment.likes.push(entry.name);
                }
            });
        });

        if (!saved) return;

        for (const entry of generatedInteractions) {
            await addMomentNotificationOnce('comment', entry.friend, momentId, {
                content: entry.content,
                contentTranslation: entry.translation,
                thought: entry.thought,
                thoughtTranslation: entry.thoughtTranslation,
                language: entry.language
            });
        }
        for (const entry of likeInteractions) {
            await addMomentNotificationOnce('like', entry.friend, momentId, {
                thought: entry.thought,
                thoughtTranslation: entry.thoughtTranslation,
                language: entry.language
            });
        }

        for (const entry of generatedInteractions) {
            await appendAutoMomentChatReplies(entry.friend, entry.chatReplies);
        }

        const latestMoment = findMomentById(momentId);
        refreshViewsForMomentUser(latestMoment);
    }

    function getMomentRelationshipEngagementSpeakers(author) {
        if (!author) return [];
        const authorId = String(author.id ?? '').trim();
        const friendsById = new Map(
            (Array.isArray(window.imData?.friends) ? window.imData.friends : [])
                .filter(Boolean)
                .map((friend) => [String(friend.id ?? '').trim(), friend])
        );
        const seenIds = new Set();
        const relationships = Array.isArray(author.memory?.relationships) ? author.memory.relationships : [];

        return relationships.reduce((speakers, relationship) => {
            const targetId = String(relationship?.targetId || relationship?.npcId || '').trim();
            const relation = String(relationship?.relation || '').trim();
            if (!targetId || !relation || targetId === authorId || seenIds.has(targetId)) return speakers;

            const target = friendsById.get(targetId);
            if (!target || (target.type !== 'char' && target.type !== 'npc')) return speakers;

            seenIds.add(targetId);
            speakers.push({
                id: targetId,
                name: getDisplayNameForMomentSpeaker(target),
                language: normalizeMomentLanguage(target.language || 'zh'),
                type: target.type,
                relation,
                persona: String(target.persona || target.signature || '').trim()
            });
            return speakers;
        }, []);
    }

    async function generateAndPublishMoment(friend, options = {}) {
        const normalizedOptions = typeof options === 'boolean' ? { silent: options } : options;
        const silent = normalizedOptions.silent === true;
        const includeEngagement = normalizedOptions.includeEngagement !== false;
        const allowImages = normalizedOptions.allowImages !== false;
        const currentApiConfig = getCurrentMomentApiConfig();
        if (!currentApiConfig.endpoint || !currentApiConfig.apiKey) {
            if (!silent) showToast('请先配置 API');
            return false;
        }
        if (!silent) showToast('正在编写朋友圈内容...');

        try {
            if (window.imApp?.ensureFriendMessagesLoaded) {
                await window.imApp.ensureFriendMessagesLoaded(friend.id);
            }
            const liveFriend = (window.imData.friends || []).find((item) => String(item.id) === String(friend.id)) || friend;
            const targetLanguage = normalizeMomentLanguage(liveFriend.language || 'zh');
            const allowedFriends = includeEngagement
                ? getMomentRelationshipEngagementSpeakers(liveFriend)
                : [];
            const allowedById = new Map(allowedFriends.map((candidate) => [candidate.id, candidate]));
            const contextText = [liveFriend.persona, liveFriend.memory?.overview, liveFriend.signature].filter(Boolean).join('\n');
            const getWorldBook = (position) => window.imApp?.getWorldBookContextForFriendByPosition
                ? window.imApp.getWorldBookContextForFriendByPosition(position, liveFriend, contextText)
                : (window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition(position) : '');
            const systemDepthWorldBookContext = getWorldBook('system_depth');
            const beforeRoleWorldBookContext = getWorldBook('before_role');
            const afterRoleWorldBookContext = getWorldBook('after_role');
            const contextMessages = window.imApp.buildApiContextMessages
                ? window.imApp.buildApiContextMessages(liveFriend, { userName: window.userState?.name || 'User' })
                : [];
            const engagementContract = !includeEngagement
                ? 'Do not generate comments or likes; return empty arrays for both.'
                : (allowedFriends.length > 0
                    ? `Allowed engagement speakers are only the character's direct relationship-network contacts (use speakerId exactly): ${JSON.stringify(allowedFriends)}\nGenerate 1-2 comments and a few likes only from this list. Each comment must follow its speaker's language and include a Chinese translation when non-Chinese.`
                    : 'This character has no valid direct relationship-network contacts. Do not generate comments or likes; return empty arrays for both.');
            const imageContract = allowImages
                ? 'You may include zero or more concrete image descriptions in images. Every images[].description must be written only in natural Simplified Chinese, regardless of the character default language.'
                : 'Do not generate images; return an empty images array.';
            const systemPrompt = `${systemDepthWorldBookContext ? `System Depth Rules (Highest Priority):\n${systemDepthWorldBookContext}\n\n` : ''}${beforeRoleWorldBookContext ? `Before Role Rules:\n${beforeRoleWorldBookContext}\n\n` : ''}You are roleplaying ${liveFriend.realName || liveFriend.nickname} and creating one public iMessage Moments post.
Role persona: ${liveFriend.persona || 'ordinary user'}.
User persona: ${window.userState?.persona || 'ordinary user'}.
${afterRoleWorldBookContext ? `After Role Rules:\n${afterRoleWorldBookContext}\n` : ''}
${NO_USER_SELF_COMMENT_RULE}
The post must feel like a public life update, not a private message asking User to reply.
${buildMomentLanguageContract(targetLanguage, 'post')}
${imageContract}
${engagementContract}
Output strict JSON only with this shape:
{"post":{"text":"moment text","translation":"Chinese translation or empty string"},"images":[{"description":"image description"}],"comments":[{"speakerId":"allowed id","text":"comment","translation":"Chinese translation or empty string"}],"likes":["allowed speakerId"]}
Do not output markdown, tagged lines, explanations, or chain-of-thought.`;
            const messages = [{ role: 'system', content: systemPrompt }];
            if (Array.isArray(contextMessages) && contextMessages.length > 0) messages.push(...contextMessages);
            messages.push({ role: 'user', content: 'Generate the public moment now.' });
            const reply = await requestMomentApiCompletion(messages, 0.8);
            const payload = parseMomentJsonObject(reply);
            const post = normalizeMomentLocalizedContent(payload?.post, targetLanguage);
            if (!post) {
                throw new Error('Invalid API response: localized post missing or incomplete');
            }
            const images = allowImages
                ? (Array.isArray(payload?.images) ? payload.images : []).map((image, index) => {
                    const desc = normalizeMomentImageDescription(image?.description || image?.desc || '');
                    const generatedImage = desc ? {
                        seed: `${liveFriend.id}_${Date.now()}_${index}_${desc}`,
                        desc,
                        kind: 'external'
                    } : null;
                    if (generatedImage) generatedImage.src = createMomentExternalImageUrl(generatedImage);
                    return generatedImage;
                }).filter(Boolean)
                : [];
            const safeGeneratedComments = includeEngagement
                ? (Array.isArray(payload?.comments) ? payload.comments : []).map((comment) => {
                    const speakerId = String(comment?.speakerId || '').trim();
                    const speaker = allowedById.get(speakerId);
                    const localized = speaker ? normalizeMomentLocalizedContent(comment, speaker.language) : null;
                    return speaker && localized ? {
                        name: speaker.name,
                        userId: speaker.id,
                        content: localized.text,
                        translation: localized.translation,
                        language: speaker.language
                    } : null;
                }).filter(Boolean).slice(0, 2)
                : [];
            const safeGeneratedLikes = includeEngagement
                ? [...new Set((Array.isArray(payload?.likes) ? payload.likes : [])
                    .map((speakerId) => allowedById.get(String(speakerId))?.name)
                    .filter(Boolean))]
                : [];
            const newMoment = {
                id: Date.now(),
                userId: liveFriend.id,
                name: liveFriend.nickname || liveFriend.realName || 'Friend',
                avatar: liveFriend.avatarUrl,
                text: post.text,
                translation: post.translation,
                language: post.language,
                images,
                time: Date.now(),
                likes: safeGeneratedLikes,
                comments: safeGeneratedComments,
                isPinned: false
            };

            const saved = await commitMomentsChange(newMoment.id, () => {
                window.imData.moments.unshift(newMoment);
            });
            if (!saved) return false;

            const list = document.getElementById('moments-list');
            if (list) {
                const itemEl = createMomentElement(newMoment);
                list.insertBefore(itemEl, list.firstChild);
            } else {
                renderMoments();
            }

            if (momentsScrollContainer) momentsScrollContainer.scrollTop = 0;

            if (!silent) showToast(`${newMoment.name} 发布了朋友圈`);
            return true;
        } catch (e) {
            console.error(e);
            if (!silent) showToast('发布失败');
            return false;
        }
    }

    async function triggerAiMomentPost(friend, isBatch = false) {
        return generateAndPublishMoment(friend, { silent: isBatch, includeEngagement: true, allowImages: true });
    }

    // Expose Functions
    window.imApp.openMomentDetail = openMomentDetail;
    window.imApp.renderMoments = renderMoments;
    window.imApp.renderMomentsMessages = renderMomentsMessages;
    window.imApp.refreshAllMomentsViews = refreshAllMomentsViews;
    window.imApp.updateMomentsNewMessageBubble = updateMomentsNewMessageBubble;
    window.imApp.generateAndPublishMoment = generateAndPublishMoment;
    void ensureMomentMessagesModuleDataReady().then(updateMomentsNewMessageBubble);
});
