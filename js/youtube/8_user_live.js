// === User Live Setup & Interface ===
    const startLiveOptionBtn = ytCreateSheet ? ytCreateSheet.querySelectorAll('.yt-create-bubble-btn')[0] : null;
    
    const userLiveSetupSheet = document.getElementById('yt-user-live-setup-sheet');
    const startUserLiveBtn = document.getElementById('start-user-live-btn');
    const userLiveView = document.getElementById('yt-user-live-view');
    const userLiveBackBtn = document.getElementById('yt-user-live-back-btn');
    const userLiveVideoArea = document.getElementById('yt-user-live-video-area');

    let userLiveBgUrl = '';
    const userLiveBgUpload = document.getElementById('yt-user-live-bg-upload');
    const userLiveBgBtn = document.getElementById('yt-user-live-bg-btn');
    const userLiveBgImg = document.getElementById('yt-user-live-bg-img');

    function getCurrentYtLiveUser() {
        if (typeof window.getYtEffectiveUserState === 'function') {
            return window.getYtEffectiveUserState() || {};
        }
        return ytUserState || {};
    }

    function stopUserLiveControlEvent(e) {
        if (!e) return;
        e.stopPropagation();
    }

    if (userLiveBgBtn && userLiveBgUpload) {
        userLiveBgBtn.addEventListener('click', (e) => {
            stopUserLiveControlEvent(e);
            userLiveBgUpload.click();
        });
        userLiveBgUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (window.compressImage) {
                        window.compressImage(ev.target.result, 900, 600, (compressedUrl) => {
                            userLiveBgUrl = compressedUrl;
                            if(userLiveBgImg) {
                                userLiveBgImg.src = userLiveBgUrl;
                                userLiveBgImg.style.display = 'block';
                            }
                            const liveDisplay = document.getElementById('yt-user-live-bg-display');
                            if(liveDisplay) {
                                liveDisplay.src = userLiveBgUrl;
                            }
                        });
                    } else {
                        userLiveBgUrl = ev.target.result;
                        if(userLiveBgImg) {
                            userLiveBgImg.src = userLiveBgUrl;
                            userLiveBgImg.style.display = 'block';
                        }
                        const liveDisplay = document.getElementById('yt-user-live-bg-display');
                        if(liveDisplay) {
                            liveDisplay.src = userLiveBgUrl;
                        }
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (startLiveOptionBtn && userLiveSetupSheet) {
        startLiveOptionBtn.addEventListener('click', () => {
            if(ytCreateSheet) ytCreateSheet.classList.remove('active');
            userLiveSetupSheet.classList.add('active');
        });
        userLiveSetupSheet.addEventListener('mousedown', (e) => {
            if(e.target === userLiveSetupSheet) userLiveSetupSheet.classList.remove('active');
        });
    }

    if (startUserLiveBtn && userLiveView) {
        startUserLiveBtn.addEventListener('click', () => {
            if (typeof window.validateUserLiveSelectedGuests === 'function') {
                window.validateUserLiveSelectedGuests();
            }
            const titleInput = document.getElementById('yt-user-live-title-input');
            const title = titleInput && titleInput.value ? titleInput.value : '我的直播间';

            document.getElementById('yt-user-live-title-display').textContent = title;
            if(userLiveBgUrl) {
                document.getElementById('yt-user-live-bg-display').src = userLiveBgUrl;
            } else {
                document.getElementById('yt-user-live-bg-display').src = 'https://picsum.photos/900/600';
            }

            userLiveSetupSheet.classList.remove('active');
            
            // Clean up old state
            document.getElementById('yt-user-live-chat-container').innerHTML = '';
            document.getElementById('yt-user-live-bubbles-container').innerHTML = '';
            document.getElementById('yt-user-live-alert-container').innerHTML = '';
            userLiveConnectionCard?.replaceChildren();
            userLiveHistory = [];

            if (typeof window.openYtUserLiveView === 'function') {
                window.openYtUserLiveView();
                return;
            }
            userLiveView.classList.add('active');
        });
    }

    if (userLiveBackBtn) {
        userLiveBackBtn.addEventListener('click', () => {
            if (isUserLiveLotteryActive()) {
                if (window.showToast) window.showToast('抽奖进行中，请等待开奖后再结束直播');
                renderUserLiveLotteryStatus(true);
                return;
            }
            window.showCustomModal({
                title: '结束直播',
                message: '确定要结束当前的直播吗？',
                confirmText: '结束',
                cancelText: '继续',
                isDestructive: true,
                onConfirm: () => {
                    archiveAllUserLiveConnections();
                    if (typeof window.releaseYtChatKeyboardLock === 'function') window.releaseYtChatKeyboardLock();
                    userLiveView.classList.remove('active');
                    
                    document.getElementById('yt-summary-views').textContent = userLiveTotalViews;
                    document.getElementById('yt-summary-hot').textContent = userLiveMaxHot;
                    document.getElementById('yt-summary-subs').textContent = '+' + userLiveNewSubs;
                    document.getElementById('yt-summary-sc').textContent = '￥' + userLiveTotalSC;
                    
                    if(userLiveSummarySheet) userLiveSummarySheet.classList.add('active');
                }
            });
        });
    }

    // Data Center Logic
    window.renderDataCenter = function() {
        const dataCenterBtn = document.getElementById('yt-data-center-btn');
        const dataCenterSheet = document.getElementById('yt-data-center-sheet');
        const ytWithdrawBtn = document.getElementById('yt-withdraw-btn');
        const dcTotalViews = document.getElementById('dc-total-views');
        const dcTotalSc = document.getElementById('dc-total-sc');
        const dcTotalSubs = document.getElementById('dc-total-subs');
        const dcTotalCommission = document.getElementById('dc-total-commission');
        const dcTotalRevenue = document.getElementById('dc-total-revenue');
        const dcOffersList = document.getElementById('dc-offers-list');
        const dcReceivedGiftsList = document.getElementById('dc-received-gifts-list');

        if (!channelState.dataCenter) {
            channelState.dataCenter = { views: 0, sc: 0, subs: 0, commission: 0, receivedGifts: [] };
        }
        if (channelState.dataCenter.commission === undefined) channelState.dataCenter.commission = 0;
        if (!Array.isArray(channelState.dataCenter.receivedGifts)) channelState.dataCenter.receivedGifts = [];

        if (dcTotalViews) dcTotalViews.textContent = channelState.dataCenter.views || 0;
        if (dcTotalSc) dcTotalSc.textContent = (channelState.dataCenter.sc || 0).toFixed(2);
        if (dcTotalSubs) dcTotalSubs.textContent = channelState.dataCenter.subs || 0;
        if (dcTotalCommission) dcTotalCommission.textContent = (channelState.dataCenter.commission || 0).toFixed(2);
        
        const total = parseFloat(channelState.dataCenter.sc || 0) + parseFloat(channelState.dataCenter.commission || 0);
        if (dcTotalRevenue) dcTotalRevenue.textContent = total.toFixed(2);
        
        if (ytWithdrawBtn) {
            if (total > 0) {
                ytWithdrawBtn.style.opacity = '1';
                ytWithdrawBtn.style.pointerEvents = 'auto';
            } else {
                ytWithdrawBtn.style.opacity = '0.5';
                ytWithdrawBtn.style.pointerEvents = 'none';
            }
        }

        if (dcOffersList) {
            dcOffersList.innerHTML = '';
            let hasOffers = false;

            mockSubscriptions.forEach(sub => {
                if (sub.dmHistory) {
                    sub.dmHistory.forEach(msg => {
                        if (msg.isOffer && msg.offerStatus === 'accepted') {
                            hasOffers = true;
                            const el = document.createElement('div');
                            el.className = 'settings-item';
                            el.style.padding = '12px 16px';
                            el.style.cursor = 'pointer';

                            const priceStr = msg.offerData.price || '0';
                            const avatarUrl = typeof resolveYtChannelAvatar === 'function'
                                ? resolveYtChannelAvatar(sub)
                                : (sub.avatar || 'https://picsum.photos/80/80?grayscale');

                            el.innerHTML = `
                                <div style="width: 36px; height: 36px; border-radius: 50%; overflow: hidden; margin-right: 12px; flex-shrink: 0;">
                                    <img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                                </div>
                                <div style="flex: 1; overflow: hidden;">
                                    <div style="font-weight: 600; font-size: 15px; color: #000; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${msg.offerData.title || '商单任务'}</div>
                                    <div style="font-size: 12px; color: #8e8e93; margin-top: 2px;">来自: ${sub.name}</div>
                                </div>
                                <div style="color: #ff3b30; font-weight: 600; font-size: 15px;">${priceStr}</div>
                            `;

                            el.addEventListener('click', () => {
                                // Set global current sub so the detail sheet context works
                                currentSubChannelData = sub;
                                openOfferDetailSheet(msg);
                            });

                            dcOffersList.appendChild(el);
                        }
                    });
                }
            });

            if (!hasOffers) {
                dcOffersList.innerHTML = '<div style="padding: 16px; text-align: center; color: #8e8e93; font-size: 14px;">暂无进行中的商单</div>';
            }
        }
        
        // Hide sheet handler
        if (dataCenterSheet && !dataCenterSheet.dataset.bound) {
            dataCenterSheet.dataset.bound = 'true';
            dataCenterSheet.addEventListener('mousedown', (e) => {
                if (e.target === dataCenterSheet) dataCenterSheet.classList.remove('active');
            });
        }
    };
    
    // Bind initial load just in case
    setTimeout(() => {
        const dataCenterBtn = document.getElementById('yt-data-center-btn');
        const dataCenterSheet = document.getElementById('yt-data-center-sheet');
        if (dataCenterBtn && dataCenterSheet && !dataCenterBtn.dataset.bound) {
            dataCenterBtn.dataset.bound = 'true';
            dataCenterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.renderDataCenter();
                dataCenterSheet.classList.add('active');
            });
        }
    }, 500);

    const ytWithdrawBtn = document.getElementById('yt-withdraw-btn');
    if (ytWithdrawBtn) {
        ytWithdrawBtn.addEventListener('click', () => {
            const total = parseFloat(channelState.dataCenter.sc || 0) + parseFloat(channelState.dataCenter.commission || 0);
            if (total <= 0) return;

            if (window.showCustomModal) {
                window.showCustomModal({
                    title: '收益提现',
                    message: `确认将 YouTube 创作者收益 ￥${total.toFixed(2)} 提现到 Pay 钱包吗？`,
                    confirmText: '确认提现',
                    cancelText: '取消',
                    onConfirm: () => {
                        // 重置收益
                        channelState.dataCenter.sc = 0;
                        channelState.dataCenter.commission = 0;
                        saveYoutubeData();
                        renderDataCenter();

                        // 同步到 Pay App
                        if (window.addPayTransaction) {
                            window.addPayTransaction(total, 'YouTube 创作者收益', 'income');
                        }

                        if(window.showToast) window.showToast('提现成功，已存入 Pay 钱包');
                    }
                });
            } else {
                if (confirm(`确认提现 ￥${total.toFixed(2)} 吗？`)) {
                    channelState.dataCenter.sc = 0;
                    channelState.dataCenter.commission = 0;
                    saveYoutubeData();
                    renderDataCenter();
                    if (window.addPayTransaction) window.addPayTransaction(total, 'YouTube 创作者收益', 'income');
                    alert('提现成功！');
                }
            }
        });
    }

    // User Live Chat & API interaction
    let userLiveHistory = [];
    let userLiveComments = [];
    let userLiveTotalSC = 0;
    let userLiveTotalViews = 0;
    let userLiveMaxHot = 0;
    let userLiveNewSubs = 0;
    let userLiveSessionId = null;
    const userLiveConnectionDelayTimers = new Map();
    const userLiveConnectionDurationTimers = new Map();

    const userLiveChatInput = document.getElementById('yt-user-live-chat-input');
    const userLiveChatSend = document.getElementById('yt-user-live-chat-send');
    const userLiveBubblesContainer = document.getElementById('yt-user-live-bubbles-container');
    const userLiveChatContainer = document.getElementById('yt-user-live-chat-container');
    const userLiveTriggerApiBtn = document.getElementById('yt-user-live-trigger-api-btn');
    const userLiveConnectBtn = document.getElementById('yt-user-live-connect-btn');
    const userLiveConnectionCard = document.getElementById('yt-user-live-connection-card');
    const userLiveMinimizeBtn = document.getElementById('yt-user-live-minimize-btn');
    const userLiveLotteryBtn = document.getElementById('yt-user-live-lottery-btn');
    const userLiveLotterySheet = document.getElementById('yt-user-live-lottery-sheet');
    const userLiveLotteryClose = document.getElementById('yt-user-live-lottery-close');
    const userLiveLotteryDuration = document.getElementById('yt-user-live-lottery-duration');
    const userLiveLotteryPrizes = document.getElementById('yt-user-live-lottery-prizes');
    const userLiveLotteryAddPrize = document.getElementById('yt-user-live-lottery-add-prize');
    const userLiveLotteryConfirm = document.getElementById('yt-user-live-lottery-confirm');
    const userLiveLotteryStatus = document.getElementById('yt-user-live-lottery-status');
    const userLiveLotteryParticipants = document.getElementById('yt-user-live-lottery-participants');
    const userLiveLotteryCountdown = document.getElementById('yt-user-live-lottery-countdown');
    const userLiveLotteryResultModal = document.getElementById('yt-user-live-lottery-result-modal');
    const userLiveLotteryResultSummary = document.getElementById('yt-user-live-lottery-result-summary');
    const userLiveLotteryResultList = document.getElementById('yt-user-live-lottery-result-list');
    const userLiveLotteryResultClose = document.getElementById('yt-user-live-lottery-result-close');
    const userLiveLotteryResultConfirm = document.getElementById('yt-user-live-lottery-result-confirm');
    let userLiveLotteryTimer = null;
    let isFinalizingUserLiveLottery = false;

    function positionUserLiveLotteryStatus() {
        if (!userLiveLotteryStatus || !userLiveView) return;
        const chatShell = userLiveView.querySelector('.yt-user-live-chat-shell');
        if (!chatShell) return;
        const viewRect = userLiveView.getBoundingClientRect();
        const chatRect = chatShell.getBoundingClientRect();
        const chatHeightFromBottom = Math.max(0, viewRect.bottom - chatRect.top);
        userLiveLotteryStatus.style.bottom = `${Math.round(chatHeightFromBottom + 8)}px`;
    }

    function escapeYtUserLiveHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[char]));
    }

    function getActiveUserLiveLottery() {
        const lottery = channelState?.activeUserLive?.lottery;
        return lottery && typeof lottery === 'object' ? lottery : null;
    }

    function isUserLiveLotteryActive() {
        return getActiveUserLiveLottery()?.status === 'active';
    }

    function getUserLiveTitle() {
        const titleInput = document.getElementById('yt-user-live-title-input');
        return titleInput && titleInput.value ? titleInput.value : '我的直播间';
    }

    function getUserLiveTopic() {
        const topicInput = document.getElementById('yt-user-live-topic-input');
        return topicInput && topicInput.value ? topicInput.value : '';
    }

    function getSelectedUserLiveGuests() {
        return typeof window.getUserLiveSelectedGuests === 'function'
            ? window.getUserLiveSelectedGuests()
            : [];
    }

    function buildActiveUserLiveState(extra = {}) {
        const effectiveYtUser = getCurrentYtLiveUser();
        const totalViews = Number(userLiveTotalViews) || 0;
        return {
            ...(channelState.activeUserLive || {}),
            title: getUserLiveTitle(),
            desc: getUserLiveTopic(),
            views: `${totalViews} 人正在观看`,
            thumbnail: userLiveBgUrl || channelState.activeUserLive?.thumbnail || 'https://picsum.photos/320/180',
            backgroundUrl: userLiveBgUrl || channelState.activeUserLive?.backgroundUrl || '',
            comments: Array.isArray(userLiveComments) ? [...userLiveComments] : [],
            history: Array.isArray(userLiveHistory) ? [...userLiveHistory] : [],
            totalSC: Number(userLiveTotalSC) || 0,
            totalViews,
            maxHot: Number(userLiveMaxHot) || totalViews,
            newSubs: Number(userLiveNewSubs) || 0,
            liveSessionId: userLiveSessionId || channelState.activeUserLive?.liveSessionId || null,
            guests: getSelectedUserLiveGuests(),
            user: {
                name: effectiveYtUser.name || '我',
                avatarUrl: effectiveYtUser.avatarUrl || '',
                subs: effectiveYtUser.subs || '0'
            },
            updatedAt: Date.now(),
            ...extra
        };
    }

    function persistActiveUserLive(extra = {}) {
        if (!channelState) return null;
        channelState.activeUserLive = buildActiveUserLiveState(extra);
        saveYoutubeData();
        return channelState.activeUserLive;
    }

    function formatUserLiveConnectionDuration(startedAt) {
        const totalSeconds = Math.max(0, Math.floor((Date.now() - Number(startedAt || Date.now())) / 1000));
        const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    function normalizeUserLiveTranscriptItem(item = {}) {
        const kind = item.kind === 'narrative' ? 'narrative' : 'speech';
        return {
            speakerType: item.speakerType || 'char',
            speakerId: item.speakerId || null,
            name: item.name || '',
            text: String(item.text || '').trim(),
            ...(item.translationZh ? { translationZh: String(item.translationZh) } : {}),
            kind,
            timestamp: Number(item.timestamp) || Date.now()
        };
    }

    function getUserLiveConnections() {
        const live = channelState?.activeUserLive;
        if (!live) return [];
        if (!Array.isArray(live.connections)) {
            live.connections = live.connection && typeof live.connection === 'object' ? [live.connection] : [];
            live.connection = null;
        }
        live.connections = live.connections.filter(Boolean).slice(0, 3).map(connection => ({
            ...connection,
            id: connection.id || `connection_${connection.requestedAt || Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            transcript: Array.isArray(connection.transcript) ? connection.transcript.map(normalizeUserLiveTranscriptItem) : []
        }));
        if (!Array.isArray(live.connectionHistory)) live.connectionHistory = [];
        return live.connections;
    }

    function getActiveUserLiveConnections() {
        return getUserLiveConnections().filter(connection => connection.status === 'active');
    }

    function getUserLiveConnectionById(connectionId) {
        return getUserLiveConnections().find(connection => String(connection.id) === String(connectionId)) || null;
    }

    function stopUserLiveConnectionTimers(connectionId = null) {
        const stopMap = (map, clearFn) => {
            if (connectionId !== null) {
                const timer = map.get(String(connectionId));
                if (timer) clearFn(timer);
                map.delete(String(connectionId));
                return;
            }
            map.forEach(clearFn);
            map.clear();
        };
        stopMap(userLiveConnectionDelayTimers, clearTimeout);
        stopMap(userLiveConnectionDurationTimers, clearInterval);
    }

    function stopUserLiveConnectionDurationTimers() {
        userLiveConnectionDurationTimers.forEach(clearInterval);
        userLiveConnectionDurationTimers.clear();
    }

    function setUserLiveConnectionButtonState() {
        if (!userLiveConnectBtn) return;
        const connections = getUserLiveConnections();
        const isFull = connections.length >= 3;
        userLiveConnectBtn.disabled = !channelState?.activeUserLive || isFull;
        userLiveConnectBtn.classList.toggle('is-connecting', connections.some(item => item.status === 'connecting'));
        userLiveConnectBtn.innerHTML = '<i class="fas fa-phone-volume"></i>';
        userLiveConnectBtn.title = isFull ? '最多同时连线 3 位嘉宾' : '添加连线嘉宾';
        userLiveConnectBtn.setAttribute('aria-label', userLiveConnectBtn.title);
    }

    function appendUserLiveConnectionTranscript(connectionId, item, options = {}) {
        const connection = getUserLiveConnectionById(connectionId);
        const normalized = normalizeUserLiveTranscriptItem(item);
        if (!connection || !normalized.text) return null;
        connection.transcript.push(normalized);
        if (options.includeLiveHistory !== false) {
            userLiveHistory.push({
                type: normalized.kind === 'narrative' ? 'guest-narrative' : 'guest',
                senderType: normalized.speakerType,
                ...normalized
            });
        }
        persistActiveUserLive({ connections: getUserLiveConnections(), connection: null });
        return normalized;
    }

    function addUserLiveConnectionBubble(connectionId, value, options = {}) {
        const connection = getUserLiveConnectionById(connectionId);
        const text = String(value?.text || value?.content || value || '').trim();
        const translationZh = String(value?.translationZh || value?.translation || '').trim();
        if (!connection || !userLiveBubblesContainer || !text) return;
        const participantName = connection.participant?.name || '连线嘉宾';
        const bubble = document.createElement('div');
        bubble.className = 'yt-user-live-bubble';
        bubble.innerHTML = `
            <div class="yt-localized-original">${escapeYtUserLiveHtml(`${participantName}：${text}`)}</div>
            ${translationZh ? `<div class="yt-char-live-translation">${escapeYtUserLiveHtml(`${participantName}：${translationZh}`)}</div>` : ''}`;
        userLiveBubblesContainer.appendChild(bubble);
        setTimeout(() => {
            bubble.style.opacity = '0';
            bubble.style.transition = 'opacity 1s ease';
            setTimeout(() => bubble.remove(), 1000);
        }, 8000);
        if (options.persist !== false) {
            appendUserLiveConnectionTranscript(connectionId, {
                speakerType: 'char',
                speakerId: connection.participant?.imCharId || connection.participant?.id,
                name: connection.participant?.name || '连线嘉宾',
                text,
                translationZh,
                kind: 'speech'
            });
        }
    }

    function addUserLiveConnectionNarrative(connectionId, value, options = {}) {
        const connection = getUserLiveConnectionById(connectionId);
        const text = String(value?.text || value?.content || value || '').trim();
        const translationZh = String(value?.translationZh || value?.translation || '').trim();
        const container = userLiveConnectionCard?.querySelector(`[data-connection-id="${CSS.escape(String(connectionId))}"] .yt-live-connection-narratives`);
        if (!connection || !container || !text) return;
        const narrative = document.createElement('div');
        narrative.className = 'yt-live-connection-narrative';
        narrative.textContent = translationZh ? `${text}（${translationZh}）` : text;
        container.appendChild(narrative);
        while (container.children.length > 2) container.firstElementChild?.remove();
        setTimeout(() => narrative.remove(), 10000);
        if (options.persist !== false) {
            appendUserLiveConnectionTranscript(connectionId, {
                speakerType: 'char',
                speakerId: connection.participant?.imCharId || connection.participant?.id,
                name: connection.participant?.name || '连线嘉宾',
                text,
                translationZh,
                kind: 'narrative'
            });
        }
    }

    function renderUserLiveConnections() {
        if (!userLiveConnectionCard) return;
        stopUserLiveConnectionDurationTimers();
        userLiveConnectionCard.replaceChildren();
        const activeConnections = channelState?.activeUserLive ? getActiveUserLiveConnections() : [];
        activeConnections.forEach(connection => {
            const participant = connection.participant || {};
            const seat = document.createElement('div');
            seat.className = 'yt-live-connection-card yt-user-live-connection-seat';
            seat.dataset.connectionId = connection.id;
            seat.innerHTML = `
                <div class="yt-live-connection-avatar-wrap">
                    <img class="yt-live-connection-avatar" src="${escapeYtUserLiveHtml(participant.avatar || participant.avatarUrl || 'https://picsum.photos/80/80?grayscale')}" alt="">
                    <div class="yt-live-connection-wave" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
                </div>
                <div class="yt-live-connection-info">
                    <div class="yt-live-connection-name">${escapeYtUserLiveHtml(participant.name || '连线嘉宾')}</div>
                    <div class="yt-live-connection-duration">${formatUserLiveConnectionDuration(connection.startedAt)}</div>
                </div>
                <button type="button" class="yt-live-connection-exit" aria-label="退出连线" title="退出连线"><i class="fas fa-phone-slash"></i></button>
                <div class="yt-live-connection-narratives" aria-live="polite"></div>`;
            seat.querySelector('.yt-live-connection-exit')?.addEventListener('click', event => {
                event.stopPropagation();
                endUserLiveConnection(connection.id);
            });
            userLiveConnectionCard.appendChild(seat);
            const duration = seat.querySelector('.yt-live-connection-duration');
            const timer = setInterval(() => {
                const latest = getUserLiveConnectionById(connection.id);
                if (!latest || latest.status !== 'active') return;
                if (duration) duration.textContent = formatUserLiveConnectionDuration(latest.startedAt);
            }, 1000);
            userLiveConnectionDurationTimers.set(String(connection.id), timer);
        });
        setUserLiveConnectionButtonState();
    }

    function activateUserLiveConnection(connectionId) {
        const connection = getUserLiveConnectionById(connectionId);
        if (!connection || connection.status !== 'connecting') return;
        userLiveConnectionDelayTimers.delete(String(connectionId));
        connection.status = 'active';
        connection.startedAt = (Number(connection.requestedAt) || Date.now()) + 3000;
        persistActiveUserLive({ connections: getUserLiveConnections(), connection: null });
        renderUserLiveConnections();
        if (window.showToast) window.showToast(`已与 ${connection.participant?.name || '嘉宾'} 接通`);
    }

    function scheduleUserLiveConnectionRestore() {
        stopUserLiveConnectionTimers();
        getUserLiveConnections().forEach(connection => {
            if (connection.status !== 'connecting') return;
            const remaining = Math.max(0, (Number(connection.requestedAt) + 3000) - Date.now());
            const timer = setTimeout(() => activateUserLiveConnection(connection.id), remaining);
            userLiveConnectionDelayTimers.set(String(connection.id), timer);
        });
        renderUserLiveConnections();
    }

    function beginUserLiveConnection(guest) {
        if (!channelState?.activeUserLive || !guest) return false;
        const validatedGuest = typeof window.validateYtLiveGuestOption === 'function'
            ? window.validateYtLiveGuestOption(guest)
            : guest;
        if (!validatedGuest) {
            window.showToast?.('该好友已不在订阅栏中');
            return false;
        }
        const connections = getUserLiveConnections();
        const participantId = String(validatedGuest.imCharId || validatedGuest.id || '');
        if (connections.some(item => String(item.participant?.imCharId || item.participant?.id || '') === participantId)) {
            window.showToast?.('该嘉宾已经在连线中');
            return false;
        }
        if (connections.length >= 3) {
            window.showToast?.('最多同时连线 3 位嘉宾');
            return false;
        }
        const participant = {
            id: validatedGuest.id,
            imCharId: validatedGuest.imCharId || null,
            name: validatedGuest.name || '连线嘉宾',
            avatar: validatedGuest.avatar || validatedGuest.avatarUrl || '',
            desc: validatedGuest.desc || validatedGuest.persona || '',
            persona: validatedGuest.persona || validatedGuest.desc || '',
            guestSource: validatedGuest.guestSource || 'youtube-subscription'
        };
        const connection = {
            id: `connection_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            status: 'connecting',
            requestedAt: Date.now(),
            startedAt: null,
            participant,
            transcript: []
        };
        connections.push(connection);
        persistActiveUserLive({ connections, connection: null });
        scheduleUserLiveConnectionRestore();
        window.showToast?.(`已向 ${participant.name} 发送连线请求，等待接通...`);
        return true;
    }

    function endUserLiveConnection(connectionId, options = {}) {
        const live = channelState?.activeUserLive;
        const connection = getUserLiveConnectionById(connectionId);
        if (!live || !connection) return;
        stopUserLiveConnectionTimers(connection.id);
        const connectionHistory = Array.isArray(live.connectionHistory) ? [...live.connectionHistory] : [];
        connectionHistory.push({
            ...connection,
            participant: { ...(connection.participant || {}) },
            transcript: Array.isArray(connection.transcript) ? connection.transcript.map(item => ({ ...item })) : [],
            endedAt: Date.now()
        });
        const connections = getUserLiveConnections().filter(item => String(item.id) !== String(connection.id));
        persistActiveUserLive({ connections, connection: null, connectionHistory });
        renderUserLiveConnections();
        if (!options.silent) window.showToast?.(`已结束与 ${connection.participant?.name || '嘉宾'} 的连线`);
    }

    function archiveAllUserLiveConnections() {
        const ids = getUserLiveConnections().map(connection => connection.id);
        ids.forEach(id => endUserLiveConnection(id, { silent: true }));
    }

    if (userLiveConnectBtn) {
        userLiveConnectBtn.addEventListener('click', event => {
            event.stopPropagation();
            if (!channelState?.activeUserLive) return;
            const connections = getUserLiveConnections();
            if (connections.length >= 3) {
                window.showToast?.('最多同时连线 3 位嘉宾');
                return;
            }
            const excludedIds = connections.flatMap(item => [item.participant?.id, item.participant?.imCharId]).filter(Boolean);
            const opened = window.openYtLiveConnectionPicker?.((selectedGuest) => {
                if (!selectedGuest) return;
                const confirmConnection = () => beginUserLiveConnection(selectedGuest);
                if (window.showCustomModal) {
                    window.showCustomModal({
                        title: '请求连线',
                        message: `确定向 ${selectedGuest.name || '该好友'} 发起连线吗？`,
                        confirmText: '请求连线',
                        cancelText: '取消',
                        onConfirm: confirmConnection
                    });
                } else confirmConnection();
            }, { includeNone: false, title: '添加连线嘉宾', excludeIds: excludedIds });
            if (opened === false) window.showToast?.('暂无可连线的订阅好友');
        });
    }

    function getUserLiveLotteryPrizeName(index) {
        const names = ['一等奖', '二等奖', '三等奖', '四等奖', '五等奖', '六等奖', '七等奖', '八等奖', '九等奖', '十等奖'];
        return names[index] || `奖项${index + 1}`;
    }

    function createDefaultUserLiveLotteryPrize(index = 0) {
        return {
            id: `lottery_prize_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
            name: getUserLiveLotteryPrizeName(index),
            type: 'custom',
            prize: '',
            amount: 0,
            winnerCount: 1
        };
    }

    function renderUserLiveLotteryPrizeRows(prizes = null) {
        if (!userLiveLotteryPrizes) return;
        const source = Array.isArray(prizes) && prizes.length > 0 ? prizes : [createDefaultUserLiveLotteryPrize(0)];
        userLiveLotteryPrizes.innerHTML = '';
        source.slice(0, 10).forEach((prize, index) => {
            const row = document.createElement('div');
            row.className = 'yt-user-live-lottery-prize-row';
            row.dataset.prizeId = prize.id || createDefaultUserLiveLotteryPrize(index).id;
            const prizeType = prize.type === 'cash' ? 'cash' : 'custom';
            row.innerHTML = `
                <input class="yt-lottery-prize-name" type="text" maxlength="20" aria-label="奖项名称" value="${escapeYtUserLiveHtml(prize.name || getUserLiveLotteryPrizeName(index))}">
                <select class="yt-lottery-prize-type" aria-label="奖品类型">
                    <option value="cash"${prizeType === 'cash' ? ' selected' : ''}>金额</option>
                    <option value="custom"${prizeType === 'custom' ? ' selected' : ''}>自定义</option>
                </select>
                <input class="yt-lottery-prize-count" type="number" min="1" max="100" step="1" inputmode="numeric" aria-label="中奖人数" value="${Math.max(1, Math.min(100, Math.round(Number(prize.winnerCount) || 1)))}">
                <button type="button" class="yt-user-live-lottery-prize-remove" aria-label="删除奖项"><i class="fas fa-minus-circle"></i></button>
                <div class="yt-lottery-prize-value">
                    <label class="yt-lottery-prize-amount-wrap">
                        <span>¥</span>
                        <input class="yt-lottery-prize-amount" type="number" min="0.01" max="1000000" step="0.01" inputmode="decimal" aria-label="每位中奖者金额" placeholder="每人金额" value="${Number(prize.amount) > 0 ? Number(prize.amount) : ''}">
                    </label>
                    <input class="yt-lottery-prize-content" type="text" maxlength="60" aria-label="自定义奖品内容" placeholder="填写自定义奖品" value="${escapeYtUserLiveHtml(prizeType === 'custom' ? (prize.prize || '') : '')}">
                </div>
            `;
            const typeSelect = row.querySelector('.yt-lottery-prize-type');
            const syncPrizeValueInput = () => {
                const isCash = typeSelect?.value === 'cash';
                row.querySelector('.yt-lottery-prize-amount-wrap')?.classList.toggle('is-visible', isCash);
                row.querySelector('.yt-lottery-prize-content')?.classList.toggle('is-visible', !isCash);
            };
            typeSelect?.addEventListener('change', syncPrizeValueInput);
            syncPrizeValueInput();
            const removeButton = row.querySelector('.yt-user-live-lottery-prize-remove');
            if (removeButton) {
                removeButton.addEventListener('click', () => {
                    if (userLiveLotteryPrizes.children.length <= 1) {
                        if (window.showToast) window.showToast('至少保留一个奖项');
                        return;
                    }
                    row.remove();
                });
            }
            userLiveLotteryPrizes.appendChild(row);
        });
    }

    function collectUserLiveLotteryConfig() {
        const durationSec = Math.round(Number(userLiveLotteryDuration?.value));
        if (!Number.isFinite(durationSec) || durationSec < 5 || durationSec > 3600) {
            if (window.showToast) window.showToast('开奖时间请输入 5–3600 秒');
            return null;
        }
        const rows = userLiveLotteryPrizes ? Array.from(userLiveLotteryPrizes.querySelectorAll('.yt-user-live-lottery-prize-row')) : [];
        if (rows.length === 0 || rows.length > 10) {
            if (window.showToast) window.showToast('请设置 1–10 个奖项');
            return null;
        }
        const prizes = [];
        let totalCashAmount = 0;
        for (let index = 0; index < rows.length; index++) {
            const row = rows[index];
            const name = String(row.querySelector('.yt-lottery-prize-name')?.value || '').trim() || getUserLiveLotteryPrizeName(index);
            const type = row.querySelector('.yt-lottery-prize-type')?.value === 'cash' ? 'cash' : 'custom';
            const winnerCount = Math.round(Number(row.querySelector('.yt-lottery-prize-count')?.value));
            if (!Number.isFinite(winnerCount) || winnerCount < 1 || winnerCount > 100) {
                if (window.showToast) window.showToast(`${name}中奖人数需为 1–100`);
                return null;
            }
            let prize = '';
            let amount = 0;
            if (type === 'cash') {
                amount = Math.round(Number(row.querySelector('.yt-lottery-prize-amount')?.value) * 100) / 100;
                if (!Number.isFinite(amount) || amount < 0.01 || amount > 1000000) {
                    if (window.showToast) window.showToast(`${name}每人金额需为 ¥0.01–¥1,000,000`);
                    row.querySelector('.yt-lottery-prize-amount')?.focus();
                    return null;
                }
                prize = `¥${amount.toFixed(2)}`;
                totalCashAmount = Math.round((totalCashAmount + amount * winnerCount) * 100) / 100;
            } else {
                prize = String(row.querySelector('.yt-lottery-prize-content')?.value || '').trim();
                if (!prize) {
                    if (window.showToast) window.showToast(`请填写${name}的自定义奖品`);
                    row.querySelector('.yt-lottery-prize-content')?.focus();
                    return null;
                }
            }
            prizes.push({ id: row.dataset.prizeId || createDefaultUserLiveLotteryPrize(index).id, name, type, prize, amount, winnerCount });
        }
        return { durationSec, prizes, totalCashAmount };
    }

    function closeUserLiveLotterySheet() {
        userLiveLotterySheet?.classList.remove('active');
    }

    function formatUserLiveLotteryCountdown(milliseconds) {
        const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function renderUserLiveLotteryStatus(highlight = false) {
        const lottery = getActiveUserLiveLottery();
        if (!userLiveLotteryStatus) return;
        if (!lottery || lottery.status !== 'active') {
            userLiveLotteryStatus.style.display = 'none';
            userLiveLotteryStatus.classList.remove('is-highlighted');
            return;
        }
        userLiveLotteryStatus.style.display = 'flex';
        positionUserLiveLotteryStatus();
        if (userLiveLotteryParticipants) userLiveLotteryParticipants.textContent = String(Array.isArray(lottery.participants) ? lottery.participants.length : 0);
        if (userLiveLotteryCountdown) userLiveLotteryCountdown.textContent = formatUserLiveLotteryCountdown(Number(lottery.endAt) - Date.now());
        if (highlight) {
            userLiveLotteryStatus.classList.remove('is-highlighted');
            void userLiveLotteryStatus.offsetWidth;
            userLiveLotteryStatus.classList.add('is-highlighted');
        }
    }

    function stopUserLiveLotteryTimer() {
        if (userLiveLotteryTimer) clearInterval(userLiveLotteryTimer);
        userLiveLotteryTimer = null;
    }

    function getUserLiveOnlineViewerLimit() {
        const displayValue = Number.parseInt(document.getElementById('yt-user-live-views-display')?.textContent || '', 10);
        return Math.max(0, Math.round(Number(userLiveTotalViews) || displayValue || 0));
    }

    function createSimulatedUserLiveLotteryParticipantName(lottery, sequence) {
        const names = [
            'Liam Carter', 'Emma Wilson', 'Noah Reed', 'Olivia Stone', 'Haruto', 'Aiko',
            'Sakura', 'Min-jun', 'Seo-yeon', 'Camille', 'Lucas Martin', 'Lucía',
            'Mateo', 'Elena Rossi', 'Mia Schmidt', 'Ethan Brooks', 'Yuna', 'Ren'
        ];
        const baseName = names[sequence % names.length];
        const cycle = Math.floor(sequence / names.length);
        return cycle > 0 ? `${baseName} ${cycle + 1}` : baseName;
    }

    function growSimulatedUserLiveLotteryParticipants(lottery) {
        if (!lottery || lottery.status !== 'active') return false;
        const onlineLimit = getUserLiveOnlineViewerLimit();
        if (onlineLimit <= 0) return false;
        lottery.participants = Array.isArray(lottery.participants) ? lottery.participants : [];
        if (lottery.participants.length >= onlineLimit) return false;

        const winnerSlots = (Array.isArray(lottery.prizes) ? lottery.prizes : [])
            .reduce((total, prize) => total + Math.max(0, Math.round(Number(prize?.winnerCount) || 0)), 0);
        if (!Number.isFinite(Number(lottery.simulatedTargetParticipants)) || Number(lottery.simulatedTargetParticipants) <= 0) {
            const ratio = 0.35 + Math.random() * 0.3;
            lottery.simulatedTargetParticipants = Math.min(onlineLimit, Math.max(winnerSlots, Math.round(onlineLimit * ratio)));
        }
        const target = Math.min(onlineLimit, Math.max(lottery.participants.length, Math.round(Number(lottery.simulatedTargetParticipants) || 0)));
        lottery.simulatedTargetParticipants = target;

        const now = Date.now();
        const duration = Math.max(1, Number(lottery.endAt) - Number(lottery.createdAt));
        const progress = Math.max(0, Math.min(1, (now - Number(lottery.createdAt)) / duration));
        const desiredCount = Math.min(onlineLimit, Math.floor(target * Math.min(1, 0.08 + progress * 0.92)));
        if (desiredCount <= lottery.participants.length) return false;
        if (now < Number(lottery.endAt) && now - Number(lottery.lastSimulatedGrowthAt || 0) < 1500) return false;

        const existingNames = new Set(lottery.participants.map(item => String(item?.name || '').trim().toLocaleLowerCase()));
        let sequence = Math.max(0, Math.round(Number(lottery.simulatedNameSequence) || 0));
        while (lottery.participants.length < desiredCount && lottery.participants.length < onlineLimit) {
            let name = createSimulatedUserLiveLotteryParticipantName(lottery, sequence++);
            while (existingNames.has(name.toLocaleLowerCase())) name = createSimulatedUserLiveLotteryParticipantName(lottery, sequence++);
            existingNames.add(name.toLocaleLowerCase());
            lottery.participants.push({ name, joinedAt: now, source: 'frontend-random' });
        }
        lottery.simulatedNameSequence = sequence;
        lottery.lastSimulatedGrowthAt = now;
        persistActiveUserLive({ lottery });
        return true;
    }

    function startUserLiveLotteryTimer() {
        stopUserLiveLotteryTimer();
        const tick = () => {
            const lottery = getActiveUserLiveLottery();
            if (!lottery || lottery.status !== 'active') {
                stopUserLiveLotteryTimer();
                renderUserLiveLotteryStatus();
                return;
            }
            growSimulatedUserLiveLotteryParticipants(lottery);
            renderUserLiveLotteryStatus();
            if (Date.now() >= Number(lottery.endAt)) finalizeUserLiveLottery();
        };
        tick();
        if (isUserLiveLotteryActive()) userLiveLotteryTimer = setInterval(tick, 500);
    }

    function addUserLiveLotteryParticipant(name, source = 'lottery-api') {
        const lottery = getActiveUserLiveLottery();
        if (!lottery || lottery.status !== 'active') return false;
        const participantName = String(name || '').trim();
        if (!participantName) return false;
        const hostName = String(getCurrentYtLiveUser()?.name || '我').trim().toLocaleLowerCase();
        const normalizedName = participantName.toLocaleLowerCase();
        if (normalizedName === hostName) return false;
        lottery.participants = Array.isArray(lottery.participants) ? lottery.participants : [];
        const onlineLimit = getUserLiveOnlineViewerLimit();
        if (onlineLimit <= 0 || lottery.participants.length >= onlineLimit) return false;
        if (lottery.participants.some(item => String(item?.name || '').trim().toLocaleLowerCase() === normalizedName)) return false;
        lottery.participants.push({ name: participantName, joinedAt: Date.now(), source });
        persistActiveUserLive({ lottery });
        renderUserLiveLotteryStatus();
        return true;
    }

    function shuffleUserLiveLotteryParticipants(participants) {
        const result = [...participants];
        const getRandomIndex = max => {
            if (window.crypto?.getRandomValues) {
                const values = new Uint32Array(1);
                window.crypto.getRandomValues(values);
                return values[0] % max;
            }
            return Math.floor(Math.random() * max);
        };
        for (let index = result.length - 1; index > 0; index--) {
            const swapIndex = getRandomIndex(index + 1);
            [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
        }
        return result;
    }

    function drawUserLiveLotteryWinners(lottery) {
        const pool = shuffleUserLiveLotteryParticipants(Array.isArray(lottery.participants) ? lottery.participants : []);
        const winners = [];
        let cursor = 0;
        (Array.isArray(lottery.prizes) ? lottery.prizes : []).forEach(prize => {
            const count = Math.max(0, Math.round(Number(prize.winnerCount) || 0));
            for (let index = 0; index < count && cursor < pool.length; index++, cursor++) {
                winners.push({
                    prizeId: prize.id,
                    prizeName: prize.name,
                    prize: prize.prize,
                    name: pool[cursor].name
                });
            }
        });
        return winners;
    }

    function renderUserLiveLotteryResult(lottery, shouldOpen = true) {
        if (!lottery || !userLiveLotteryResultList) return;
        const participants = Array.isArray(lottery.participants) ? lottery.participants : [];
        const winners = Array.isArray(lottery.winners) ? lottery.winners : [];
        if (userLiveLotteryResultSummary) {
            userLiveLotteryResultSummary.textContent = `${participants.length} 人参与，共产生 ${winners.length} 位中奖者`;
        }
        userLiveLotteryResultList.innerHTML = '';
        (Array.isArray(lottery.prizes) ? lottery.prizes : []).forEach(prize => {
            const tierWinners = winners.filter(winner => String(winner.prizeId) === String(prize.id));
            const missing = Math.max(0, Number(prize.winnerCount) - tierWinners.length);
            const item = document.createElement('div');
            item.className = 'yt-user-live-lottery-result-tier';
            item.innerHTML = `
                <div style="font-size:14px;font-weight:700;">${escapeYtUserLiveHtml(prize.name)} · ${escapeYtUserLiveHtml(prize.prize)}</div>
                <div class="yt-user-live-lottery-result-names">${tierWinners.length > 0 ? tierWinners.map(winner => escapeYtUserLiveHtml(winner.name)).join('、') : '暂无中奖者'}</div>
                ${missing > 0 ? `<div style="margin-top:5px;color:#ff9500;font-size:12px;">参与人数不足，空缺 ${missing} 个名额</div>` : ''}
            `;
            userLiveLotteryResultList.appendChild(item);
        });
        if (shouldOpen) userLiveLotteryResultModal?.classList.add('active');
    }

    async function requestUserLiveLotteryJson(prompt) {
        if (!window.apiConfig?.endpoint || !window.apiConfig?.apiKey) throw new Error('API_NOT_CONFIGURED');
        const endpoint = window.u2Api.resolveChatCompletionsEndpoint(window.apiConfig.endpoint);
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.apiConfig.apiKey}`
            },
            body: JSON.stringify({
                model: window.apiConfig.model || 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.85,
                response_format: { type: 'json_object' }
            })
        });
        if (!response.ok) throw new Error(`API_${response.status}`);
        const data = await response.json();
        const rawText = String(data?.choices?.[0]?.message?.content || '').replace(/```json\n?/gi, '').replace(/```/g, '').trim();
        return sanitizeObj(JSON.parse(rawText));
    }

    function buildUserLiveLotteryLaunchPrompt(lottery) {
        const effectiveUser = getCurrentYtLiveUser();
        const wbContext = window.getYtWorldBookContext
            ? window.getYtWorldBookContext(`${getUserLiveTitle()}\n${getUserLiveTopic()}\n${JSON.stringify(lottery.prizes)}`)
            : '';
        return `你正在模拟真实 YouTube 直播间宣布抽奖后的即时评论。\n主播：${effectiveUser.name || '我'}\n主播人设：${effectiveUser.persona || '普通主播'}\n直播标题：${getUserLiveTitle()}\n直播主题：${getUserLiveTopic()}\n世界书：${wbContext || '无'}\n开奖剩余时间：${lottery.durationSec} 秒\n奖项：${JSON.stringify(lottery.prizes)}\n\n生成不少于 10 条与本次抽奖直接相关、昵称不重复的短评论。评论者可以报名、期待、讨论奖品或围观；只有明确想参加抽奖的人 participates 才能为 true。至少一半评论必须来自使用英语、日语、韩语、法语、西班牙语等非中文语言的外国观众，外国观众使用符合其语言习惯的昵称和原文；非中文评论必须填写自然准确的简体中文 translationZh，中文评论的 translationZh 为空字符串。\n只返回严格 JSON：{"comments":[{"name":"viewer name","text":"original comment","translationZh":"简体中文翻译或空字符串","participates":true}]}。comments 不少于 10 条，不要 Markdown，不要 emoji。`;
    }

    function buildUserLiveLotteryFollowupPrompt(lottery) {
        const effectiveUser = getCurrentYtLiveUser();
        const wbContext = window.getYtWorldBookContext
            ? window.getYtWorldBookContext(`${getUserLiveTitle()}\n${getUserLiveTopic()}\n${JSON.stringify(lottery.winners)}`)
            : '';
        return `你正在模拟真实 YouTube 直播抽奖开奖后的观众反应。\n主播：${effectiveUser.name || '我'}\n主播人设：${effectiveUser.persona || '普通主播'}\n直播标题：${getUserLiveTitle()}\n直播主题：${getUserLiveTopic()}\n世界书：${wbContext || '无'}\n奖项：${JSON.stringify(lottery.prizes)}\n参与人数：${lottery.participants.length}\n中奖结果：${JSON.stringify(lottery.winners)}\n\n生成不少于 10 条短评论，必须同时包含中奖者的惊喜回应、未中奖者的反应和围观观众的祝贺或调侃；不得篡改中奖名单。至少一半评论使用英语、日语、韩语、法语、西班牙语等非中文语言，并使用符合语言地区的外国昵称。所有非中文评论必须填写自然准确的简体中文 translationZh，中文评论的 translationZh 为空字符串。\n此外，每一位实际中奖者都要给主播发送 2 至 5 条连续私信。私信可以谈论本场直播或刚刚获得的奖品，语气要符合中奖后的即时反应。winnerName 必须逐字使用中奖结果中的昵称，不得给未中奖者生成私信；同一中奖者的 messages 数量必须在 2 到 5 条之间。私信若不是中文，translationZh 必须提供自然准确的简体中文；中文私信的 translationZh 为空字符串。\n只返回严格 JSON：{"comments":[{"name":"viewer name","text":"original comment","translationZh":"简体中文翻译或空字符串"}],"winnerDMs":[{"winnerName":"中奖者原昵称","messages":[{"text":"私信原文","translationZh":"简体中文翻译或空字符串"}]}]}。comments 不少于 10 条；每位中奖者必须各有 2 至 5 条 messages；不要 Markdown，不要 emoji。`;
    }

    function normalizeUserLiveLotteryWinnerDmBatches(lottery, rawWinnerDms) {
        const winners = Array.isArray(lottery?.winners) ? lottery.winners : [];
        const winnerNames = [...new Set(winners.map(winner => String(winner?.name || '').trim()).filter(Boolean))];
        if (winnerNames.length === 0) return [];
        const source = Array.isArray(rawWinnerDms) ? rawWinnerDms : [];

        return winnerNames.map(winnerName => {
            const normalizedWinnerName = winnerName.toLocaleLowerCase();
            const batch = source.find(item => String(item?.winnerName || item?.name || '').trim().toLocaleLowerCase() === normalizedWinnerName);
            const messages = (Array.isArray(batch?.messages) ? batch.messages : [])
                .map(message => {
                    if (typeof message === 'string') return { text: message.trim(), translationZh: '' };
                    return {
                        text: String(message?.text || message?.content || '').trim(),
                        translationZh: String(message?.translationZh || '').trim()
                    };
                })
                .filter(message => message.text)
                .slice(0, 5);
            if (messages.length < 2) throw new Error(`TOO_FEW_WINNER_DMS:${winnerName}`);
            return { winnerName, messages };
        });
    }

    function appendUserLiveLotteryWinnerDms(lottery, winnerDmBatches) {
        const lotteryId = String(lottery?.id || '').trim();
        if (!lotteryId || lottery?.winnerDmsAppliedAt) return;
        const now = Date.now();
        winnerDmBatches.forEach((batch, batchIndex) => {
            const normalizedName = batch.winnerName.toLocaleLowerCase();
            let contact = mockSubscriptions.find(sub => String(sub?.name || '').trim().toLocaleLowerCase() === normalizedName && !sub?.isBusiness);
            if (!contact) {
                const contactId = createStableYtChannelId(`lottery-winner-${batch.winnerName}`, 'yt_lottery_winner');
                contact = {
                    id: contactId,
                    name: batch.winnerName,
                    handle: `lottery_${String(contactId).replace(/[^a-zA-Z0-9_]/g, '').slice(-24)}`,
                    avatar: `https://picsum.photos/seed/${encodeURIComponent(contactId)}/80/80?grayscale`,
                    desc: '直播抽奖观众',
                    isFriend: false,
                    isBusiness: false,
                    isSubscribed: false,
                    dmHistory: []
                };
                mockSubscriptions.unshift(contact);
            }
            if (!Array.isArray(contact.dmHistory)) contact.dmHistory = [];
            batch.messages.forEach((message, messageIndex) => {
                contact.dmHistory.push({
                    type: 'char',
                    name: batch.winnerName,
                    text: message.text,
                    translationZh: message.translationZh,
                    timestamp: now + batchIndex * 10 + messageIndex,
                    lotteryId
                });
            });
            if (typeof window.markYtMessagesUnread === 'function') {
                window.markYtMessagesUnread(contact, batch.messages.length);
            } else {
                contact.unreadDmCount = Math.max(0, Math.round(Number(contact.unreadDmCount) || 0)) + batch.messages.length;
            }
        });
        lottery.winnerDmsAppliedAt = now;
        window.updateYtMessageUnreadIndicators?.();
        if (typeof renderMessagesList === 'function') renderMessagesList();
    }

    function scheduleUserLiveLotteryComments(comments, options = {}) {
        const source = Array.isArray(comments) ? comments : [];
        source.forEach((comment, index) => {
            setTimeout(() => {
                const name = String(comment?.name || `观众${index + 1}`).trim();
                const text = String(comment?.text || comment?.content || '').trim();
                if (!text) return;
                if (channelState?.activeUserLive) {
                    addUserLiveChatMessage(name, text, null, null, comment?.translationZh);
                } else {
                    const latestPastVideo = Array.isArray(channelState?.pastVideos) ? channelState.pastVideos[0] : null;
                    if (latestPastVideo) {
                        latestPastVideo.comments = Array.isArray(latestPastVideo.comments) ? latestPastVideo.comments : [];
                        latestPastVideo.comments.push({ name, text, translationZh: String(comment?.translationZh || '').trim(), amount: null, color: null });
                        saveYoutubeData();
                    }
                }
                if (options.collectParticipants && comment?.participates === true) {
                    addUserLiveLotteryParticipant(name, options.source || 'lottery-api');
                }
            }, 180 * index);
        });
    }

    async function requestUserLiveLotteryLaunchComments(lottery) {
        try {
            const parsed = await requestUserLiveLotteryJson(buildUserLiveLotteryLaunchPrompt(lottery));
            const comments = Array.isArray(parsed?.comments) ? parsed.comments.filter(comment => String(comment?.text || comment?.content || '').trim()) : [];
            if (comments.length < 10) throw new Error('TOO_FEW_LOTTERY_COMMENTS');
            comments.filter(comment => comment?.participates === true).forEach(comment => {
                addUserLiveLotteryParticipant(comment.name, 'lottery-launch-api');
            });
            scheduleUserLiveLotteryComments(comments, { collectParticipants: false });
        } catch (error) {
            console.error('User live lottery launch comments failed:', error);
            if (window.showToast) window.showToast('抽奖互动生成失败，抽奖仍会继续');
        }
    }

    async function requestUserLiveLotteryFollowup(lottery) {
        try {
            const parsed = await requestUserLiveLotteryJson(buildUserLiveLotteryFollowupPrompt(lottery));
            const comments = Array.isArray(parsed?.comments) ? parsed.comments.filter(comment => String(comment?.text || comment?.content || '').trim()) : [];
            if (comments.length < 10) throw new Error('TOO_FEW_LOTTERY_FOLLOWUP_COMMENTS');
            const winnerDmBatches = normalizeUserLiveLotteryWinnerDmBatches(lottery, parsed?.winnerDMs);
            appendUserLiveLotteryWinnerDms(lottery, winnerDmBatches);
            scheduleUserLiveLotteryComments(comments, { collectParticipants: false });
            lottery.followupStatus = 'succeeded';
        } catch (error) {
            console.error('User live lottery follow-up failed:', error);
            lottery.followupStatus = 'failed';
            if (window.showToast) window.showToast('开奖结果已保存，后续互动生成失败');
        } finally {
            if (String(channelState?.activeUserLive?.lottery?.id || '') === String(lottery.id || '')) {
                persistActiveUserLive({ lottery });
            } else {
                saveYoutubeData();
            }
        }

        if (dcReceivedGiftsList) {
            const receivedGifts = channelState.dataCenter.receivedGifts;
            if (receivedGifts.length === 0) {
                dcReceivedGiftsList.innerHTML = '<div style="padding: 16px; text-align: center; color: #8e8e93; font-size: 14px;">暂无获得的礼物</div>';
            } else {
                dcReceivedGiftsList.innerHTML = receivedGifts.map(gift => {
                    const name = escapeYtUserLiveHtml(gift?.name || '神秘礼物');
                    const fromName = escapeYtUserLiveHtml(gift?.fromName || '主播');
                    const receivedAt = Number(gift?.receivedAt)
                        ? new Date(Number(gift.receivedAt)).toLocaleString('zh-CN')
                        : '刚刚';
                    const cashMeta = gift?.type === 'cash' && Number(gift?.cashAmount) > 0
                        ? ` · ¥${Number(gift.cashAmount).toFixed(2)} 已收入 Pay`
                        : '';
                    return `
                        <div class="settings-item" style="padding:12px 16px;">
                            <div style="width:36px;height:36px;border-radius:50%;margin-right:12px;flex-shrink:0;background:#fff0f3;color:#ff0033;display:flex;align-items:center;justify-content:center;">
                                <i class="fas fa-gift"></i>
                            </div>
                            <div style="flex:1;min-width:0;">
                                <div style="font-weight:600;font-size:15px;color:#000;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">${name}</div>
                                <div style="font-size:12px;color:#8e8e93;margin-top:2px;">来自 ${fromName}${cashMeta} · ${escapeYtUserLiveHtml(receivedAt)}</div>
                            </div>
                        </div>`;
                }).join('');
            }
        }
    }

    async function finalizeUserLiveLottery() {
        const lottery = getActiveUserLiveLottery();
        if (!lottery || lottery.status !== 'active' || isFinalizingUserLiveLottery) return;
        isFinalizingUserLiveLottery = true;
        try {
            lottery.status = 'completed';
            lottery.completedAt = Date.now();
            lottery.winners = drawUserLiveLotteryWinners(lottery);
            lottery.followupStatus = 'requesting';
            lottery.followupRequestedAt = Date.now();
            persistActiveUserLive({ lottery });
            stopUserLiveLotteryTimer();
            renderUserLiveLotteryStatus();
            renderUserLiveLotteryResult(lottery, true);
            requestUserLiveLotteryFollowup(lottery);
        } finally {
            isFinalizingUserLiveLottery = false;
        }
    }

    function closeUserLiveLotteryResult() {
        userLiveLotteryResultModal?.classList.remove('active');
    }

    function openUserLiveLotterySetup() {
        if (isUserLiveLotteryActive()) {
            renderUserLiveLotteryStatus(true);
            if (window.showToast) window.showToast('当前抽奖正在进行中');
            return;
        }
        if (userLiveLotteryDuration) userLiveLotteryDuration.value = '30';
        renderUserLiveLotteryPrizeRows();
        userLiveLotterySheet?.classList.add('active');
    }

    if (userLiveLotteryBtn) {
        const activateLotteryButton = event => {
            event?.stopPropagation();
            openUserLiveLotterySetup();
        };
        userLiveLotteryBtn.addEventListener('click', activateLotteryButton);
        userLiveLotteryBtn.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            activateLotteryButton(event);
        });
    }

    if (userLiveLotteryAddPrize) {
        userLiveLotteryAddPrize.addEventListener('click', () => {
            const currentRows = userLiveLotteryPrizes ? Array.from(userLiveLotteryPrizes.querySelectorAll('.yt-user-live-lottery-prize-row')) : [];
            if (currentRows.length >= 10) {
                if (window.showToast) window.showToast('最多设置 10 个奖项');
                return;
            }
            const currentPrizes = currentRows.map((row, index) => ({
                id: row.dataset.prizeId,
                name: row.querySelector('.yt-lottery-prize-name')?.value || getUserLiveLotteryPrizeName(index),
                type: row.querySelector('.yt-lottery-prize-type')?.value === 'cash' ? 'cash' : 'custom',
                prize: row.querySelector('.yt-lottery-prize-content')?.value || '',
                amount: row.querySelector('.yt-lottery-prize-amount')?.value || 0,
                winnerCount: row.querySelector('.yt-lottery-prize-count')?.value || 1
            }));
            currentPrizes.push(createDefaultUserLiveLotteryPrize(currentPrizes.length));
            renderUserLiveLotteryPrizeRows(currentPrizes);
        });
    }

    userLiveLotteryClose?.addEventListener('click', closeUserLiveLotterySheet);
    userLiveLotterySheet?.addEventListener('mousedown', event => {
        if (event.target === userLiveLotterySheet) closeUserLiveLotterySheet();
    });
    userLiveLotteryResultClose?.addEventListener('click', closeUserLiveLotteryResult);
    userLiveLotteryResultConfirm?.addEventListener('click', closeUserLiveLotteryResult);
    userLiveLotteryResultModal?.addEventListener('mousedown', event => {
        if (event.target === userLiveLotteryResultModal) closeUserLiveLotteryResult();
    });

    if (userLiveLotteryConfirm) {
        userLiveLotteryConfirm.addEventListener('click', async () => {
            if (isUserLiveLotteryActive()) {
                closeUserLiveLotterySheet();
                renderUserLiveLotteryStatus(true);
                return;
            }
            if (!window.apiConfig?.endpoint || !window.apiConfig?.apiKey) {
                if (window.showToast) window.showToast('请先配置 API');
                return;
            }
            const config = collectUserLiveLotteryConfig();
            if (!config || !channelState?.activeUserLive) return;
            if (config.totalCashAmount > 0) {
                if (typeof window.getPayBalance !== 'function' || typeof window.addPayTransaction !== 'function') {
                    if (window.showToast) window.showToast('Pay 尚未加载，暂时无法发放金额奖品');
                    return;
                }
                const payBalance = Number(window.getPayBalance());
                if (!Number.isFinite(payBalance) || payBalance < config.totalCashAmount) {
                    if (window.showToast) window.showToast(`Pay 余额不足，需要 ¥${config.totalCashAmount.toFixed(2)}`);
                    return;
                }
            }
            const now = Date.now();
            const lottery = {
                id: `user_live_lottery_${now}_${Math.random().toString(36).slice(2, 8)}`,
                status: 'active',
                createdAt: now,
                endAt: now + config.durationSec * 1000,
                durationSec: config.durationSec,
                prizes: config.prizes,
                participants: [],
                winners: [],
                simulatedTargetParticipants: Math.min(
                    getUserLiveOnlineViewerLimit(),
                    Math.max(
                        config.prizes.reduce((total, prize) => total + prize.winnerCount, 0),
                        Math.round(getUserLiveOnlineViewerLimit() * (0.35 + Math.random() * 0.3))
                    )
                ),
                payAmountCharged: config.totalCashAmount,
                payChargedAt: null,
                followupStatus: 'pending'
            };
            userLiveLotteryConfirm.disabled = true;
            try {
                if (config.totalCashAmount > 0) {
                    const paid = window.addPayTransaction(config.totalCashAmount, 'YouTube 直播抽奖奖金', 'expense');
                    if (!paid) {
                        if (window.showToast) window.showToast('Pay 扣款失败，抽奖未开始');
                        return;
                    }
                    lottery.payChargedAt = Date.now();
                }
                persistActiveUserLive({ lottery });
                closeUserLiveLotterySheet();
                closeUserLiveLotteryResult();
                startUserLiveLotteryTimer();
                requestUserLiveLotteryLaunchComments(lottery);
            } finally {
                userLiveLotteryConfirm.disabled = false;
            }
        });
    }

    function buildUserLiveCommentTextHtml(comment, textColor = '#0f0f0f') {
        const translationZh = String(comment?.translationZh || '').trim();
        return `
            <span style="color:${textColor};">${escapeYtUserLiveHtml(comment?.text || '')}</span>
            ${translationZh ? `<span class="yt-user-live-comment-translation-toggle" role="button" tabindex="0">翻译</span><span class="yt-user-live-comment-translation" hidden>${escapeYtUserLiveHtml(translationZh)}</span>` : ''}
        `;
    }

    function bindUserLiveCommentTranslation(row) {
        const toggle = row?.querySelector('.yt-user-live-comment-translation-toggle');
        const translation = row?.querySelector('.yt-user-live-comment-translation');
        if (!toggle || !translation) return;
        const activate = () => {
            const shouldExpand = translation.hidden;
            translation.hidden = !shouldExpand;
            toggle.textContent = shouldExpand ? '收起翻译' : '翻译';
            toggle.setAttribute('aria-expanded', String(shouldExpand));
        };
        toggle.addEventListener('click', activate);
        toggle.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            activate();
        });
    }

    function renderUserLiveChatRow(comment) {
        if (!userLiveChatContainer || !comment) return;
        const row = document.createElement('div');
        row.className = 'yt-live-chat-row-anim';
        if (comment.amount) {
            row.classList.add('yt-user-live-superchat');
            row.style.backgroundColor = comment.color || '#8e8e93';
            row.style.padding = '8px 12px';
            row.style.borderRadius = '8px';
            row.style.marginBottom = '4px';
            row.innerHTML = `
                <div style="font-weight: bold; font-size: 13px; color: rgba(255,255,255,0.9); margin-bottom: 4px;">${escapeYtUserLiveHtml(comment.name || '')} <span style="margin-left: 8px;">${escapeYtUserLiveHtml(comment.amount)}</span></div>
                <div style="font-size: 14px; color: #fff;">${buildUserLiveCommentTextHtml(comment, '#fff')}</div>
            `;
        } else {
            const grayColors = ['#333333', '#4d4d4d', '#666666', '#808080', '#999999', '#b3b3b3'];
            const randColor = grayColors[Math.floor(Math.random() * grayColors.length)];
            row.style.display = 'flex';
            row.style.gap = '8px';
            row.style.alignItems = 'flex-start';
            row.style.marginBottom = '12px';
            row.innerHTML = `
                <div style="width:24px; height:24px; border-radius:50%; background-color:${randColor}; display:flex; justify-content:center; align-items:center; color:#fff; font-size:10px; font-weight:bold; flex-shrink:0;">
                    ${escapeYtUserLiveHtml(comment.name && comment.name.length > 0 ? comment.name[0].toUpperCase() : '?')}
                </div>
                <div style="font-size:13px; margin-top:2px;">
                    <span style="font-size:12px; margin-right:4px; color:#606060;">${escapeYtUserLiveHtml(comment.name || '')}</span>
                    ${buildUserLiveCommentTextHtml(comment)}
                </div>
            `;
        }
        bindUserLiveCommentTranslation(row);
        userLiveChatContainer.appendChild(row);
        userLiveChatContainer.scrollTop = userLiveChatContainer.scrollHeight;
    }

    function restoreActiveUserLiveState() {
        const activeLive = channelState && channelState.activeUserLive;
        if (!activeLive || typeof activeLive !== 'object') return;

        userLiveBgUrl = activeLive.backgroundUrl || activeLive.thumbnail || '';
        userLiveHistory = Array.isArray(activeLive.history) ? [...activeLive.history] : [];
        userLiveComments = Array.isArray(activeLive.comments) ? [...activeLive.comments] : [];
        userLiveTotalSC = Number(activeLive.totalSC) || 0;
        userLiveTotalViews = Number(activeLive.totalViews) || 0;
        userLiveMaxHot = Number(activeLive.maxHot) || userLiveTotalViews;
        userLiveNewSubs = Number(activeLive.newSubs) || 0;
        userLiveSessionId = activeLive.liveSessionId || activeLive.id || null;
        getUserLiveConnections();
        const restoredGuests = activeLive.connections.map(item => item.participant).filter(Boolean);
        window.setUserLiveSelectedGuests?.(restoredGuests.length ? restoredGuests : (activeLive.guests || []));

        const titleInput = document.getElementById('yt-user-live-title-input');
        const topicInput = document.getElementById('yt-user-live-topic-input');
        const titleDisplay = document.getElementById('yt-user-live-title-display');
        const bgDisplay = document.getElementById('yt-user-live-bg-display');
        const viewsEl = document.getElementById('yt-user-live-views-display');

        if (titleInput) titleInput.value = activeLive.title || '';
        if (topicInput) topicInput.value = activeLive.desc || '';
        if (titleDisplay) titleDisplay.textContent = activeLive.title || '我的直播间';
        if (userLiveBgImg && userLiveBgUrl) {
            userLiveBgImg.src = userLiveBgUrl;
            userLiveBgImg.style.display = 'block';
        }
        if (bgDisplay) bgDisplay.src = userLiveBgUrl || 'https://picsum.photos/900/600';
        if (viewsEl) viewsEl.textContent = activeLive.views || `${userLiveTotalViews} 人正在观看`;
        const guestNameInput = document.getElementById('yt-user-live-guest-name');
        if (guestNameInput) guestNameInput.value = restoredGuests.length ? restoredGuests.map(item => item.name).join('、') : '无';
        if (userLiveChatContainer) {
            userLiveChatContainer.innerHTML = '';
            userLiveComments.forEach(renderUserLiveChatRow);
        }
        const restoredLottery = activeLive.lottery;
        if (restoredLottery?.status === 'active') {
            startUserLiveLotteryTimer();
        } else {
            renderUserLiveLotteryStatus();
            if (restoredLottery?.status === 'completed') renderUserLiveLotteryResult(restoredLottery, false);
        }
        scheduleUserLiveConnectionRestore();
    }

    window.openYtUserLiveView = function() {
        if (typeof window.releaseYtChatKeyboardLock === 'function') window.releaseYtChatKeyboardLock(userLiveView);
        const playerView = document.getElementById('yt-video-player-view');
        if (playerView) playerView.classList.remove('active', 'yt-char-live-mode');
        if (userLiveView) userLiveView.classList.add('active');
        requestAnimationFrame(positionUserLiveLotteryStatus);
        scheduleUserLiveConnectionRestore();
        window.resetYtViewportOffset?.();
    };

    window.addEventListener('resize', positionUserLiveLotteryStatus);
    window.visualViewport?.addEventListener('resize', positionUserLiveLotteryStatus);

    [
        userLiveVideoArea,
        userLiveBackBtn,
        userLiveMinimizeBtn,
        userLiveLotteryBtn,
        document.getElementById('yt-user-live-views-display'),
        userLiveTriggerApiBtn,
        userLiveConnectBtn,
        userLiveConnectionCard,
        userLiveChatContainer,
        userLiveChatInput,
        userLiveChatSend
    ].filter(Boolean).forEach((el) => {
        el.addEventListener('click', stopUserLiveControlEvent);
        el.addEventListener('pointerdown', stopUserLiveControlEvent);
    });

    if (userLiveChatContainer) {
        let isDraggingUserLive = false;
        userLiveChatContainer.addEventListener('touchstart', () => { isDraggingUserLive = false; }, { passive: true });
        userLiveChatContainer.addEventListener('touchmove', () => { isDraggingUserLive = true; }, { passive: true });
        userLiveChatContainer.addEventListener('touchend', () => {
            if (isDraggingUserLive) {
                if (userLiveChatInput && document.activeElement === userLiveChatInput) userLiveChatInput.blur();
            }
        });
        userLiveChatContainer.addEventListener('click', () => {
            if (userLiveChatInput && document.activeElement === userLiveChatInput) userLiveChatInput.blur();
        });
    }

    if (userLiveBackBtn) {
        userLiveBackBtn.addEventListener('click', () => {
            if (userLiveChatInput && document.activeElement === userLiveChatInput) userLiveChatInput.blur();
        });
    }

    if (userLiveChatInput) {
        userLiveChatInput.addEventListener('focus', () => {
            if (typeof window.setYtChatKeyboardLock === 'function') window.setYtChatKeyboardLock(userLiveView, true);
            else if (userLiveView) userLiveView.classList.add('keyboard-open');
        });
        userLiveChatInput.addEventListener('blur', () => {
            if (typeof window.setYtChatKeyboardLock === 'function') window.setYtChatKeyboardLock(userLiveView, false);
            else if (userLiveView) userLiveView.classList.remove('keyboard-open');
            window.resetYtViewportOffset?.();
        });
    }

    restoreActiveUserLiveState();
    if (window.youtubeDataReadyPromise && typeof window.youtubeDataReadyPromise.then === 'function') {
        window.youtubeDataReadyPromise.then(() => restoreActiveUserLiveState()).catch(() => {});
    }

    if (startUserLiveBtn) {
        startUserLiveBtn.addEventListener('click', () => {
            userLiveComments = [];
            userLiveTotalSC = 0;
            userLiveTotalViews = Math.floor(Math.random() * 500) + 100;
            userLiveMaxHot = userLiveTotalViews;
            userLiveNewSubs = 0;
            userLiveSessionId = `user_live_${Date.now()}`;
            stopUserLiveLotteryTimer();
            const initialGuests = getSelectedUserLiveGuests().slice(0, 3);
            persistActiveUserLive({ minimized: false, lottery: null, connection: null, connections: [], connectionHistory: [] });
            renderUserLiveLotteryStatus();
            const viewsEl = document.getElementById('yt-user-live-views-display');
            if(viewsEl) viewsEl.textContent = userLiveTotalViews + ' 人正在观看';
            initialGuests.forEach(beginUserLiveConnection);
            if (initialGuests.length === 0) renderUserLiveConnections();
        });
    }

    if (userLiveMinimizeBtn) {
        userLiveMinimizeBtn.addEventListener('click', () => {
            if (typeof window.releaseYtChatKeyboardLock === 'function') window.releaseYtChatKeyboardLock();
            if(userLiveView) userLiveView.classList.remove('active');
            stopUserLiveConnectionTimers();
            if(window.showToast) window.showToast('直播已最小化并在后台运行');
            
            // Generate a fake active live stream for the user in the channel list
            const effectiveYtUser = getCurrentYtLiveUser();
            if (effectiveYtUser) {
                // Just persist it, rebuildYoutubeMockVideos handles the rest
                persistActiveUserLive({ minimized: true });
                if(typeof rebuildYoutubeMockVideos === 'function') {
                    rebuildYoutubeMockVideos();
                } else {
                    // Fallback just in case
                    const existingIndex = mockVideos.findIndex(v => v.channelData && v.channelData.id === 'user_channel_id');
                    if(existingIndex > -1) mockVideos.splice(existingIndex, 1);
                    const activeLive = channelState.activeUserLive;
                    
                    mockVideos.unshift({
                        title: activeLive.title,
                        desc: activeLive.desc,
                        views: activeLive.views,
                        time: 'LIVE',
                        thumbnail: activeLive.thumbnail,
                        isLive: true,
                        comments: activeLive.comments || [],
                        initialBubbles: [],
                        guest: activeLive.connections?.[0]?.participant || activeLive.guests?.[0] || null,
                        channelData: {
                            id: 'user_channel_id',
                            name: effectiveYtUser.name || '我',
                            avatar: effectiveYtUser.avatarUrl || 'https://picsum.photos/80/80',
                            subs: effectiveYtUser.subs || '0'
                        }
                    });
                }
                renderVideos();
            }
        });
    }

    const userLiveSummarySheet = document.getElementById('yt-user-live-summary-sheet');
    const ytSummaryConfirmBtn = document.getElementById('yt-summary-confirm-btn');

    if (userLiveSummarySheet) {
        userLiveSummarySheet.addEventListener('mousedown', (e) => {
            if (e.target === userLiveSummarySheet) userLiveSummarySheet.classList.remove('active');
        });
    }

    if (ytSummaryConfirmBtn && userLiveSummarySheet) {
        ytSummaryConfirmBtn.addEventListener('click', () => {
            userLiveSummarySheet.classList.remove('active');
            const completedLiveId = userLiveSessionId || channelState.activeUserLive?.liveSessionId || `user_live_${Date.now()}`;
            archiveAllUserLiveConnections();
            const communityGrowth = typeof window.applyYtUserCommunityLiveGrowth === 'function'
                ? window.applyYtUserCommunityLiveGrowth({
                    liveId: completedLiveId,
                    newSubs: userLiveNewSubs,
                    totalViews: userLiveTotalViews
                })
                : 0;
            
            const existingIndex = mockVideos.findIndex(v => v.channelData && v.channelData.id === 'user_channel_id');
            if(existingIndex > -1) mockVideos.splice(existingIndex, 1);

            // Update Data Center
            if (!channelState.dataCenter) {
                channelState.dataCenter = { views: 0, sc: 0, subs: 0 };
            }
            channelState.dataCenter.views += userLiveTotalViews;
            channelState.dataCenter.sc += userLiveTotalSC;
            if (!channelState.dataCenter.subs) channelState.dataCenter.subs = 0;
            channelState.dataCenter.subs += userLiveNewSubs;
            
            const effectiveYtUser = getCurrentYtLiveUser();
            if (effectiveYtUser) {
                const currentSubsNum = parseSubs(effectiveYtUser.subs);
                effectiveYtUser.subs = formatSubs(currentSubsNum + userLiveNewSubs);

                const currentNumStr = (effectiveYtUser.videos || '0').replace(/[^0-9]/g, '');
                let currentNum = parseInt(currentNumStr) || 0;
                effectiveYtUser.videos = (currentNum + 1).toString();
                ytUserState = effectiveYtUser;
                syncYtProfile();
            }

            // Save to Past Videos
            if (!channelState.pastVideos) channelState.pastVideos = [];
            const titleInput = document.getElementById('yt-user-live-title-input');
            const title = titleInput && titleInput.value ? titleInput.value : '我的直播间';

            const topicInput = document.getElementById('yt-user-live-topic-input');
            const topicDesc = topicInput && topicInput.value ? topicInput.value : '';
            const archivedUserComments = [...userLiveComments];
            
            const pastVid = {
                id: `yt-user-replay-${completedLiveId}-${Date.now()}`,
                sourceLiveId: completedLiveId,
                isLiveReplay: true,
                title: title,
                desc: topicDesc,
                views: userLiveTotalViews + ' 次观看',
                time: '刚刚',
                thumbnail: userLiveBgUrl || 'https://picsum.photos/seed/user_past/320/180?grayscale',
                comments: archivedUserComments,
                realtimeCommentCount: archivedUserComments.length,
                liveTranscript: Array.isArray(userLiveHistory) ? userLiveHistory.map(item => ({ ...item })) : [],
                guest: channelState.activeUserLive?.connectionHistory?.[0]?.participant || null,
                participants: (channelState.activeUserLive?.connectionHistory || []).map(item => ({ ...(item.participant || {}) })),
                connectionHistory: Array.isArray(channelState.activeUserLive?.connectionHistory)
                    ? channelState.activeUserLive.connectionHistory.map(item => ({
                        ...item,
                        participant: { ...(item?.participant || {}) },
                        transcript: Array.isArray(item?.transcript) ? item.transcript.map(entry => ({ ...entry })) : []
                    }))
                    : [],
                lottery: channelState.activeUserLive?.lottery || null
            };
            channelState.pastVideos.unshift(pastVid);
            
            // Sync to Guest Profile
            const archivedGuests = [...new Map((channelState.activeUserLive?.connectionHistory || [])
                .map(item => item.participant)
                .filter(Boolean)
                .map(item => [String(item.imCharId || item.id), item])).values()];
            archivedGuests.forEach(selectedLiveGuest => {
              if (selectedLiveGuest.guestSource !== 'tiktok-following') {
                const guestSub = mockSubscriptions.find(s => s.id === selectedLiveGuest.id);
                if (guestSub) {
                    if (!guestSub.generatedContent) {
                        guestSub.generatedContent = { pastVideos: [], communityPosts: [], currentLive: null, fanGroup: null };
                    }
                    if (!guestSub.generatedContent.pastVideos) guestSub.generatedContent.pastVideos = [];
                    guestSub.generatedContent.pastVideos.unshift({
                        title: `【联动录播】${title}`,
                        views: Math.floor(userLiveTotalViews * 0.8) + ' 次观看',
                        time: '刚刚',
                        thumbnail: pastVid.thumbnail,
                        comments: [{name: effectiveYtUser.name || '我', text: '这把打得不错！'}],
                        guest: { name: effectiveYtUser.name || '我' }
                    });
                }
              }
            });

            stopUserLiveLotteryTimer();
            renderUserLiveLotteryStatus();
            channelState.activeUserLive = null;
            saveYoutubeData();

            if(window.showToast) {
                window.showToast(communityGrowth > 0
                    ? `录播已保存，社群新增 ${communityGrowth} 人`
                    : '录播已保存至往期记录');
            }

            renderVideos();
            
            // Force refresh profile tab if active
            const activeTab = document.querySelector('#profile-main-tabs .yt-sliding-tab.active');
            if (activeTab && activeTab.getAttribute('data-target') === 'past') {
                activeTab.click(); 
            }
        });
    }

    if (userLiveChatSend && userLiveChatInput) {
        const sendAction = () => {
            const text = userLiveChatInput.value.trim();
            if(!text) return;

            const effectiveHost = getCurrentYtLiveUser();
            const hostTurn = normalizeUserLiveTranscriptItem({
                speakerType: 'user',
                speakerId: effectiveHost.id || 'user_channel_id',
                name: effectiveHost.name || '我',
                text,
                kind: 'speech'
            });
            userLiveHistory.push({ type: 'host', senderType: 'user', ...hostTurn });
            getActiveUserLiveConnections().forEach(connection => {
                appendUserLiveConnectionTranscript(connection.id, hostTurn, { includeLiveHistory: false });
            });
            
            // Create bubble on screen
            const bubble = document.createElement('div');
            bubble.className = 'yt-user-live-bubble';
            bubble.textContent = text;
            userLiveBubblesContainer.appendChild(bubble);

            setTimeout(() => {
                bubble.style.opacity = '0';
                bubble.style.transition = 'opacity 1s ease';
                setTimeout(() => bubble.remove(), 1000);
            }, 8000);

            userLiveChatInput.value = '';
            persistActiveUserLive();
        };

        userLiveChatSend.addEventListener('click', sendAction);
        userLiveChatSend.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            sendAction();
        });
        window.mobileInputCompat?.register({
            input: userLiveChatInput,
            root: userLiveView,
            scrollContainer: userLiveChatContainer,
            onSend: sendAction,
            allowEmpty: true,
            openClasses: ['keyboard-open', 'yt-chat-keyboard-lock']
        });
    }

    function buildUserLiveAudiencePrompt() {
        const effectiveYtUser = getCurrentYtLiveUser();
        const hostName = effectiveYtUser.name || '我';
        const hostPersona = effectiveYtUser.persona || effectiveYtUser.desc || '普通主播';
        const liveTitle = getUserLiveTitle();
        const liveTopic = getUserLiveTopic();
        const recentHostMsg = userLiveHistory.filter(item => item?.type === 'host').slice(-5).map(m => m.text).filter(Boolean).join(' | ') || '刚开播，还没有明显发言';
        const activeConnections = getActiveUserLiveConnections();
        const worldBookContext = window.getYtWorldBookContext
            ? window.getYtWorldBookContext(`${hostName}\n${hostPersona}\n${liveTitle}\n${liveTopic}`)
            : '';
        const connectionHistory = Array.isArray(channelState?.activeUserLive?.connectionHistory)
            ? channelState.activeUserLive.connectionHistory
            : [];
        const formatPublicSession = connection => {
            const participant = connection.participant || {};
            const transcript = (connection.transcript || []).map(item => {
                const label = item.kind === 'narrative' ? '公开动作' : '公开发言';
                return `${label}｜${item.name || participant.name || '嘉宾'}：${item.text || ''}`;
            }).filter(Boolean).join('\n') || '尚无公开发言';
            return `会话 ${connection.id || 'unknown'}｜${participant.name || '未知嘉宾'}｜${connection.endedAt ? '已结束' : '进行中'}\n${transcript}`;
        };
        const publicConnectionContext = [...connectionHistory, ...activeConnections].length
            ? [...connectionHistory, ...activeConnections].map(formatPublicSession).join('\n\n')
            : '本场尚无连线公开记录。';
        const privateGuestContext = activeConnections.map(connection => {
            const participant = connection.participant || {};
            const canonical = (Array.isArray(mockSubscriptions) ? mockSubscriptions : []).find(item => (
                String(item?.id || '') === String(participant.id || '')
                || (item?.imCharId && participant.imCharId && String(item.imCharId) === String(participant.imCharId))
            )) || participant;
            const persona = typeof window.getYtChannelPersonaWithRelationships === 'function'
                ? window.getYtChannelPersonaWithRelationships(canonical, participant.persona || participant.desc || '未知')
                : (participant.persona || participant.desc || '未知');
            return `participantId=${participant.imCharId || participant.id}\n姓名=${participant.name || '未知'}\n完整人设与关系=${persona}`;
        }).join('\n\n');
        const needsGuestTurns = activeConnections.length > 0;
        const worldBookSection = worldBookContext
            ? `\n已挂载世界书内容：\n${worldBookContext}\n`
            : '';
        const activeLottery = getActiveUserLiveLottery();
        const lotteryContext = activeLottery?.status === 'active'
            ? `\n当前直播正在抽奖。剩余约 ${Math.max(0, Math.ceil((Number(activeLottery.endAt) - Date.now()) / 1000))} 秒。奖项：${JSON.stringify(activeLottery.prizes)}。每条评论必须额外返回 participates 布尔值，只有明确报名参加抽奖的人为 true；其他围观评论为 false。\n`
            : '';

        const guestTurnsExample = activeConnections.map(connection => {
            const participantId = connection.participant?.imCharId || connection.participant?.id;
            return `{"participantId":"${participantId}","bubbles":[{"text":"嘉宾原话","translationZh":"简体中文翻译或空字符串"}],"narrative":{"text":"公开环境或动作描写","translationZh":"简体中文翻译或空字符串"}}`;
        }).join(',');

        return `你正在为一个真实 YouTube 直播间生成观众实时反应与连线嘉宾回应。
主播名：${hostName}
主播人设：${hostPersona}
直播标题：${liveTitle}
直播主题：${liveTopic}
最近主播发言或动作：${recentHostMsg}
${worldBookSection}${lotteryContext}
【所有人可见的连线公开记录】
${publicConnectionContext}

【仅供连线嘉宾扮演使用的私密角色资料】
${privateGuestContext || '当前没有在线嘉宾。'}
这部分私密角色资料只能用于对应 participantId 的 guestTurns，comments 和 superchats 绝对不能引用、暗示或泄露未在公开记录中出现的人设、关系和身份信息。

请根据主播人设、直播标题、主题、最近发言和联动信息，生成像真实 YouTube 直播间一样的即时评论、打赏和新订阅。
评论要短、有弹幕感，允许观众有不同语气、追问、吐槽、起哄、支持和轻微跑题，但要贴合当前直播。
观众可以自然回顾已结束连线的公开内容，例如提到错过刚才的联动，但不要强制每条评论都讨论旧连线。
观众要有明显的国际构成：comments 至少一半来自使用英语、日语、韩语、法语、西班牙语等非中文语言的外国观众，昵称也要符合对应语言地区。非中文内容保留原语言，并提供自然准确的简体中文 translationZh；中文内容的 translationZh 为空字符串。不要把所有评论都写成中文。

只返回严格 JSON，不要 Markdown，不要代码块，不要解释，不要 emoji。
JSON 结构必须完全符合：
{
  "comments": [
    {"name": "viewer name", "text": "original comment", "translationZh": "简体中文翻译或空字符串", "participates": false},
    {"name": "观众2", "text": "中文弹幕内容", "translationZh": "", "participates": false}
  ],
  "superchats": [
    {"name": "supporter name", "text": "original message", "translationZh": "简体中文翻译或空字符串", "displayAmount": "$50", "amount": 350, "color": "#e65100"}
  ],
  "newSubs": ["新粉丝A", "新粉丝B"]${needsGuestTurns ? `,\n  "guestTurns": [${guestTurnsExample}]` : ''}
}
约束：
1. comments 必须是 5 到 10 条
2. superchats 必须是 0 到 2 条，displayAmount 是带币种符号的展示金额，amount 是换算成人民币的纯数字
3. newSubs 可以是空数组，也可以是 1 到 3 个名字
4. 抽奖进行中时 comments 每项必须包含 participates；没有抽奖时一律为 false
5. comments 和 superchats 的非中文内容必须带 translationZh，中文内容不重复翻译
6. 所有句子自然短促，不要在句末堆标点${needsGuestTurns ? `
7. guestTurns 必须且只能覆盖以下在线 participantId，各一次且不能重复：${activeConnections.map(item => item.participant?.imCharId || item.participant?.id).join('、')}
8. 每个 guestTurns.bubbles 必须生成 3 到 8 条，只能使用该 participantId 的人设，禁止多人串位
9. 每个 guestTurns.narrative 必须有至少一条公开环境、动作或氛围描写；嘉宾使用自己的默认语言，非中文时提供 translationZh` : ''}`;
    }

    if (userLiveTriggerApiBtn) {
        userLiveTriggerApiBtn.addEventListener('click', async () => {
            if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
                if(window.showToast) window.showToast('请配置API');
                return;
            }

            userLiveTriggerApiBtn.style.opacity = '0.5';
            userLiveTriggerApiBtn.style.pointerEvents = 'none';
            userLiveTriggerApiBtn.setAttribute('aria-busy', 'true');
            userLiveTriggerApiBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            const requestedConnections = getActiveUserLiveConnections().map(connection => ({
                id: connection.id,
                participantId: String(connection.participant?.imCharId || connection.participant?.id || ''),
                startedAt: connection.startedAt
            }));
            const requestedConnectionSignature = requestedConnections
                .map(item => `${item.id}:${item.participantId}:${item.startedAt || ''}`)
                .sort()
                .join('|');

            try {
                const endpoint = window.u2Api.resolveChatCompletionsEndpoint(window.apiConfig.endpoint);

                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${window.apiConfig.apiKey}`
                    },
                    body: JSON.stringify({
                        model: window.apiConfig.model || 'gpt-3.5-turbo',
                        messages: [{ role: 'user', content: buildUserLiveAudiencePrompt() }],
                        temperature: 0.8,
                        response_format: { type: "json_object" } 
                    })
                });

                if (!res.ok) throw new Error("API failed");
                const data = await res.json();
                let resultText = data.choices[0].message.content.replace(/```json\n?/g, '').replace(/```/g, '').trim();
                
                let parsed;
                try {
                    parsed = sanitizeObj(JSON.parse(resultText));
                } catch (parseErr) {
                    console.error("JSON Parse Error in Live Audience:", parseErr, resultText);
                    if(window.showToast) window.showToast('观众反应格式生成失败，请重试');
                    return;
                }

                const guestTurns = Array.isArray(parsed.guestTurns) ? parsed.guestTurns : [];
                if (requestedConnections.length > 0) {
                    const expectedIds = new Set(requestedConnections.map(item => item.participantId));
                    const receivedIds = guestTurns.map(turn => String(turn?.participantId || ''));
                    const hasDuplicateId = new Set(receivedIds).size !== receivedIds.length;
                    const hasUnknownId = receivedIds.some(id => !expectedIds.has(id));
                    const hasMissingId = expectedIds.size !== receivedIds.length || [...expectedIds].some(id => !receivedIds.includes(id));
                    const hasInvalidTurn = guestTurns.some(turn => {
                        const bubbles = Array.isArray(turn?.bubbles)
                            ? turn.bubbles.filter(item => String(item?.text || item?.content || '').trim())
                            : [];
                        const narrativeText = String(turn?.narrative?.text || turn?.narrative?.content || '').trim();
                        return bubbles.length < 3 || bubbles.length > 8 || !narrativeText;
                    });
                    if (hasDuplicateId || hasUnknownId || hasMissingId || hasInvalidTurn) {
                        window.showToast?.('多人连线回复格式不完整或角色对应错误，请重试');
                        return;
                    }

                    const latestSignature = getActiveUserLiveConnections().map(connection => (
                        `${connection.id}:${String(connection.participant?.imCharId || connection.participant?.id || '')}:${connection.startedAt || ''}`
                    )).sort().join('|');
                    if (latestSignature !== requestedConnectionSignature) return;

                    guestTurns.forEach(turn => {
                        const participantId = String(turn.participantId);
                        const requested = requestedConnections.find(item => item.participantId === participantId);
                        if (!requested) return;
                        setTimeout(() => {
                            const latest = getUserLiveConnectionById(requested.id);
                            if (latest?.status !== 'active') return;
                            addUserLiveConnectionNarrative(requested.id, turn.narrative);
                        }, 350);
                        turn.bubbles.forEach((bubble, index) => {
                            setTimeout(() => {
                                const latest = getUserLiveConnectionById(requested.id);
                                const latestParticipantId = String(latest?.participant?.imCharId || latest?.participant?.id || '');
                                if (latest?.status !== 'active' || latestParticipantId !== participantId) return;
                                addUserLiveConnectionBubble(requested.id, bubble);
                            }, 900 + (index * 1700));
                        });
                    });
                }

                // Combine and Shuffle Events for Realistic Streaming
                let events = [];
                
                if (parsed.comments && Array.isArray(parsed.comments)) {
                    parsed.comments.forEach(c => events.push({ type: 'comment', data: c }));
                }
                if (parsed.superchats && Array.isArray(parsed.superchats)) {
                    parsed.superchats.forEach(sc => events.push({ type: 'sc', data: sc }));
                }
                if (parsed.newSubs && Array.isArray(parsed.newSubs)) {
                    parsed.newSubs.forEach(sub => events.push({ type: 'sub', data: sub }));
                }

                // Randomly shuffle the events
                events.sort(() => Math.random() - 0.5);

                let totalDelay = 0;
                events.forEach(ev => {
                    // Random delay between 0.5s and 2.5s for each event
                    totalDelay += Math.floor(Math.random() * 2000) + 500;
                    
                    setTimeout(() => {
                        if (ev.type === 'comment') {
                            addUserLiveChatMessage(ev.data.name, ev.data.text, null, null, ev.data.translationZh);
                            if (ev.data.participates === true) {
                                addUserLiveLotteryParticipant(ev.data.name, 'audience-api');
                            }
                        } else if (ev.type === 'sc') {
                            addUserLiveChatMessage(ev.data.name, ev.data.text, ev.data.displayAmount || ev.data.amount, ev.data.color, ev.data.translationZh);
                            const amountNum = parseFloat(ev.data.amount) || 0;
                            userLiveTotalSC += amountNum;
                            persistActiveUserLive();
                        } else if (ev.type === 'sub') {
                            const alertContainer = document.getElementById('yt-user-live-alert-container');
                            if (alertContainer) {
                                const alert = document.createElement('div');
                                alert.className = 'yt-user-live-alert';
                                alert.innerHTML = `<i class="fas fa-bell"></i> ${ev.data} 刚刚订阅了你！`;
                                
                                // random vertical position
                                alert.style.top = Math.floor(Math.random() * 80) + '%';
                                
                                alertContainer.appendChild(alert);
                                setTimeout(() => alert.remove(), 5000);
                                
                                userLiveNewSubs += 1;
                                
                                // increment viewer count
                                const viewsEl = document.getElementById('yt-user-live-views-display');
                                if(viewsEl) {
                                    let currentNum = parseInt(viewsEl.textContent) || 0;
                                    const addedViews = Math.floor(Math.random() * 50) + 10;
                                    currentNum += addedViews;
                                    userLiveTotalViews += addedViews;
                                    if(userLiveTotalViews > userLiveMaxHot) userLiveMaxHot = userLiveTotalViews;
                                    viewsEl.textContent = currentNum + ' 人正在观看';
                                }
                                persistActiveUserLive();
                            }
                        }
                    }, totalDelay);
                });

            } catch (e) {
                console.error(e);
                if(window.showToast) window.showToast('无法获取观众反应');
            } finally {
                userLiveTriggerApiBtn.style.opacity = '1';
                userLiveTriggerApiBtn.style.pointerEvents = 'auto';
                userLiveTriggerApiBtn.setAttribute('aria-busy', 'false');
                userLiveTriggerApiBtn.innerHTML = '<i class="fas fa-arrow-down" style="font-size:14px;"></i>';
            }
        });
        userLiveTriggerApiBtn.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            userLiveTriggerApiBtn.click();
        });
    }

    function addUserLiveChatMessage(name, text, amount, color, translationZh = '') {
        if (!userLiveChatContainer) return;
        const comment = { name, text, translationZh: String(translationZh || '').trim(), amount, color };
        userLiveComments.push(comment);

        const row = document.createElement('div');
        row.className = 'yt-live-chat-row-anim';
        
        if (amount) {
            row.classList.add('yt-user-live-superchat');
            let displayAmount = amount;
            if (typeof amount === 'number' || /^\d+(\.\d+)?$/.test(String(amount))) {
                displayAmount = '￥' + amount;
            }
            row.style.backgroundColor = color || '#8e8e93';
            row.style.padding = '8px 12px';
            row.style.borderRadius = '8px';
            row.style.marginBottom = '4px';
            row.innerHTML = `
                <div style="font-weight: bold; font-size: 13px; color: rgba(255,255,255,0.9); margin-bottom: 4px;">${escapeYtUserLiveHtml(name)} <span style="margin-left: 8px;">${escapeYtUserLiveHtml(displayAmount)}</span></div>
                <div style="font-size: 14px; color: #fff;">${buildUserLiveCommentTextHtml(comment, '#fff')}</div>
            `;
        } else {
            row.style.display = 'flex';
            row.style.gap = '8px';
            row.style.alignItems = 'flex-start';
            row.style.marginBottom = '12px';
            
            const grayColors = ['#333333', '#4d4d4d', '#666666', '#808080', '#999999', '#b3b3b3'];
            const randColor = grayColors[Math.floor(Math.random() * grayColors.length)];
            
            row.innerHTML = `
                <div style="width:24px; height:24px; border-radius:50%; background-color:${randColor}; display:flex; justify-content:center; align-items:center; color:#fff; font-size:10px; font-weight:bold; flex-shrink:0;">
                    ${escapeYtUserLiveHtml(name && name.length > 0 ? name[0].toUpperCase() : '?')}
                </div>
                <div style="font-size:13px; margin-top:2px;">
                    <span style="font-size:12px; margin-right:4px; color:#606060;">${escapeYtUserLiveHtml(name)}</span>
                    ${buildUserLiveCommentTextHtml(comment)}
                </div>
            `;
        }
        bindUserLiveCommentTranslation(row);
        userLiveChatContainer.appendChild(row);
        userLiveChatContainer.scrollTop = userLiveChatContainer.scrollHeight;
        persistActiveUserLive();
    }
