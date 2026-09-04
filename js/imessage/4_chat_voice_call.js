// ==========================================
// IMESSAGE: 4_chat_voice_call.js
// ==========================================
(function() {
    window.imChat = window.imChat || {};

    let callTimer = null;
    let callSeconds = 0;
    let callFriend = null;
    let callMessages = [];
    let callMessageSeq = 0;
    let lastCallAiTurn = null;
    let singleCallInputCleanup = null;
    let groupCallInputCleanup = null;
    let activeSingleCallContext = null;
    const isAndroidCallInput = !!window.mobileInputCompat?.isAndroid || /Android/i.test(navigator.userAgent || '');

    window.imChat.getActiveSingleCallContext = function(friendOrId) {
        if (!activeSingleCallContext?.connected) return null;

        const friendId = friendOrId && typeof friendOrId === 'object'
            ? friendOrId.id
            : friendOrId;
        if (String(friendId ?? '') !== activeSingleCallContext.friendId) return null;

        return {
            active: true,
            connected: true,
            minimized: !!activeSingleCallContext.minimized,
            friendId: activeSingleCallContext.friendId,
            durationSeconds: callSeconds
        };
    };

    function bindCallFocusPreservingAction(element, handler) {
        if (!element || typeof handler !== 'function') return function() {};

        let lastPointerActivationAt = 0;
        const invoke = (event) => {
            try {
                const result = handler(event);
                if (result && typeof result.catch === 'function') {
                    result.catch(error => console.error('[iMessage call] action failed', error));
                }
            } catch (error) {
                console.error('[iMessage call] action failed', error);
            }
        };
        const handlePointerDown = (event) => {
            if (!isAndroidCallInput || (event.button !== undefined && event.button !== 0)) return;
            event.preventDefault();
            lastPointerActivationAt = Date.now();
            invoke(event);
        };
        const handleClick = (event) => {
            if (isAndroidCallInput && Date.now() - lastPointerActivationAt < 700) {
                event.preventDefault();
                return;
            }
            invoke(event);
        };

        element.addEventListener('pointerdown', handlePointerDown, { passive: false });
        element.addEventListener('click', handleClick);
        return () => {
            element.removeEventListener('pointerdown', handlePointerDown);
            element.removeEventListener('click', handleClick);
        };
    }

    function waitForCallKeyboardToClose(input, timeout = 460) {
        if (!isAndroidCallInput || !input || document.activeElement !== input) return Promise.resolve();

        input.blur();
        const viewport = window.visualViewport;
        if (!viewport) return new Promise(resolve => setTimeout(resolve, 280));

        const startingHeight = Math.round(viewport.height || 0);
        let lastHeight = startingHeight;
        let stableFrames = 0;
        return new Promise(resolve => {
            let finished = false;
            const finish = () => {
                if (finished) return;
                finished = true;
                resolve();
            };
            const hardTimeout = setTimeout(finish, timeout);
            const check = () => {
                if (finished) return;
                const height = Math.round(viewport.height || 0);
                stableFrames = Math.abs(height - lastHeight) <= 1 ? stableFrames + 1 : 0;
                lastHeight = height;
                if (height >= startingHeight + 72 && stableFrames >= 2) {
                    clearTimeout(hardTimeout);
                    finish();
                    return;
                }
                requestAnimationFrame(check);
            };
            requestAnimationFrame(check);
        });
    }

    function bindCallVisualViewport(input, root, options = {}) {
        if (!window.mobileInputCompat?.isAndroid || !input || !root) return function() {};

        const viewport = window.visualViewport;
        const bottomControls = options.bottomControls || null;
        const collapseElements = (options.collapseElements || []).filter(Boolean);
        const originalRoot = {
            height: root.style.height,
            top: root.style.top,
            bottom: root.style.bottom
        };
        const originalBottomPadding = bottomControls?.style.paddingBottom || '';
        const originalDisplays = collapseElements.map((element) => element.style.display);
        const getViewportState = () => {
            const layoutHeight = Math.round(window.innerHeight || viewport?.height || 0);
            const visualHeight = Math.round(viewport?.height || layoutHeight);
            const viewportOffsetTop = Math.round(viewport?.offsetTop || 0);
            const documentScrollTop = Math.round(
                window.scrollY || document.documentElement?.scrollTop || document.body?.scrollTop || 0
            );
            return {
                layoutHeight,
                visualHeight,
                origin: Math.max(0, documentScrollTop + viewportOffsetTop)
            };
        };
        const initialViewport = getViewportState();
        let restingHeight = Math.max(initialViewport.layoutHeight, initialViewport.visualHeight);
        let restingLayoutHeight = initialViewport.layoutHeight;
        let restingViewportOrigin = initialViewport.origin;
        let keyboardWasOpen = false;

        const captureRestingViewport = (options = {}) => {
            const metrics = getViewportState();
            restingHeight = Math.max(restingHeight, metrics.layoutHeight, metrics.visualHeight);
            restingLayoutHeight = Math.max(restingLayoutHeight, metrics.layoutHeight);
            if (options.refreshOrigin !== false && !keyboardWasOpen) {
                restingViewportOrigin = metrics.origin;
            }
        };

        const restoreLayout = (scrollToLatest = false) => {
            root.style.height = originalRoot.height;
            root.style.top = originalRoot.top;
            root.style.bottom = originalRoot.bottom;
            root.classList.remove('im-call-keyboard-open');
            if (bottomControls) bottomControls.style.paddingBottom = originalBottomPadding;
            collapseElements.forEach((element, index) => {
                element.style.display = originalDisplays[index];
            });
            if (scrollToLatest) {
                requestAnimationFrame(() => {
                    if (options.scrollContainer) {
                        options.scrollContainer.scrollTop = options.scrollContainer.scrollHeight;
                    }
                });
            }
        };

        const applyViewport = () => {
            const metrics = getViewportState();
            const layoutAlreadyResized = restingLayoutHeight - metrics.layoutHeight > 100;
            // Some Android WebViews resize the layout viewport and then report an
            // already-reduced visual viewport again. Following visualViewport in
            // that mode applies the keyboard height twice. If the layout itself
            // has moved, it is already the authoritative visible height; otherwise
            // visualViewport handles overlay-style keyboards.
            const viewportHeight = layoutAlreadyResized ? metrics.layoutHeight : metrics.visualHeight;
            const viewportOrigin = metrics.origin;
            if (viewportHeight <= 0) return;

            const focused = document.activeElement === input;
            const heightReduced = restingHeight - viewportHeight > 100;
            // OPPO Edge can pan the page to reveal the composer while reporting
            // little or no visualViewport height change. Treat that origin shift
            // as the same keyboard-open state and pin the call view to it.
            const originMoved = Math.abs(viewportOrigin - restingViewportOrigin) > 72;
            const keyboardOpen = focused && (heightReduced || originMoved);

            if (!keyboardOpen) {
                const keyboardStillRetreating = keyboardWasOpen
                    && !focused
                    && (restingHeight - viewportHeight > 72 || Math.abs(viewportOrigin - restingViewportOrigin) > 48);
                if (keyboardStillRetreating) return;
                const shouldScroll = keyboardWasOpen;
                keyboardWasOpen = false;
                restoreLayout(shouldScroll);
                if (!focused || viewportHeight >= restingHeight - 72) captureRestingViewport();
                return;
            }

            keyboardWasOpen = true;
            root.style.height = `${viewportHeight}px`;
            root.style.top = `${viewportOrigin}px`;
            root.style.bottom = 'auto';
            root.classList.add('im-call-keyboard-open');

            if (bottomControls) {
                bottomControls.style.paddingBottom = '10px';
            }
            collapseElements.forEach((element, index) => {
                element.style.display = 'none';
            });
            requestAnimationFrame(() => {
                if (options.scrollContainer) {
                    options.scrollContainer.scrollTop = options.scrollContainer.scrollHeight;
                }
            });
        };

        if (viewport) {
            viewport.addEventListener('resize', applyViewport, { passive: true });
            viewport.addEventListener('scroll', applyViewport, { passive: true });
        }
        const handleFocus = () => {
            // Pointer/touch capture records the pre-keyboard origin. Do not
            // overwrite it if this browser pans before firing focus.
            captureRestingViewport({ refreshOrigin: false });
            applyViewport();
        };
        const handleBlur = () => {
            const metrics = getViewportState();
            const visibleStateStillShifted = restingHeight - metrics.visualHeight > 72
                || Math.abs(metrics.origin - restingViewportOrigin) > 48;
            if (keyboardWasOpen && visibleStateStillShifted) return;
            const shouldScroll = keyboardWasOpen;
            keyboardWasOpen = false;
            restoreLayout(shouldScroll);
        };
        input.addEventListener('pointerdown', captureRestingViewport, { passive: true });
        input.addEventListener('touchstart', captureRestingViewport, { passive: true });
        input.addEventListener('focus', handleFocus);
        input.addEventListener('blur', handleBlur);
        restoreLayout();

        return () => {
            viewport?.removeEventListener('resize', applyViewport);
            viewport?.removeEventListener('scroll', applyViewport);
            input.removeEventListener('pointerdown', captureRestingViewport);
            input.removeEventListener('touchstart', captureRestingViewport);
            input.removeEventListener('focus', handleFocus);
            input.removeEventListener('blur', handleBlur);
            keyboardWasOpen = false;
            restoreLayout();
        };
    }

    function registerCallSendInput(input, options = {}) {
        if (!input || typeof options.onSend !== 'function') return function() {};

        const dismissAfterSend = options.dismissAfterSend !== false;
        const sendAndMaybeDismiss = () => {
            const sent = options.onSend();
            if (dismissAfterSend && sent !== false) input.blur();
            return sent;
        };

        if (window.mobileInputCompat?.register) {
            const inputCleanup = window.mobileInputCompat.register({
                input,
                root: options.root || null,
                scrollContainer: options.scrollContainer || null,
                onSend: sendAndMaybeDismiss,
                blurAfterSend: false,
                enterKeyHint: 'send',
                restoreWindowScroll: false,
                managesOwnViewport: true
            });
            const viewportCleanup = bindCallVisualViewport(input, options.root, options);
            return () => {
                inputCleanup();
                viewportCleanup();
            };
        }

        const handleKeydown = (event) => {
            if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.keyCode === 229) return;
            event.preventDefault();
            if (!String(input.value || '').trim()) return;
            sendAndMaybeDismiss();
        };
        input.setAttribute('enterkeyhint', 'send');
        input.addEventListener('keydown', handleKeydown);
        return () => input.removeEventListener('keydown', handleKeydown);
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    let minTimeEl = null;

    function startTimer(statusEl, minEl) {
        callSeconds = 0;
        if(statusEl) statusEl.innerText = '00:00';
        if(minEl) minEl.innerText = '00:00';
        callTimer = setInterval(() => {
            callSeconds++;
            const t = formatTime(callSeconds);
            if(statusEl) statusEl.innerText = t;
            if(minEl) minEl.innerText = t;
            if(minTimeEl) minTimeEl.innerText = t;
        }, 1000);
    }

    function stopTimer() {
        if (callTimer) {
            clearInterval(callTimer);
            callTimer = null;
        }
    }

    function getCallSpeakerName(message, friend = callFriend) {
        if (message?.senderName) {
            return message.senderName;
        }
        if (message?.isSelf) {
            const group = friend?.type === 'group' ? friend : groupCallTarget;
            if (group?.type === 'group' && window.imApp?.getGroupUserIdentity) {
                return window.imApp.getGroupUserIdentity(group).name;
            }
            return window.userState?.name || window.userState?.realName || 'User';
        }
        if (friend?.type === 'group' && message?.senderId) {
            const member = (window.imData?.friends || []).find(item => String(item.id) === String(message.senderId));
            if (member) return member.nickname || member.realName || 'Member';
        }
        return friend?.nickname || friend?.realName || 'Char';
    }

    function formatCallLineText(text) {
        const cleanText = String(text || '').trim();
        return cleanText ? `「${cleanText}」` : '';
    }

    function createCallNovelLine(text, options = {}) {
        const rowWrap = document.createElement('div');
        rowWrap.style.width = '100%';
        rowWrap.style.marginBottom = '10px';
        rowWrap.style.display = 'flex';
        rowWrap.style.flexDirection = 'column';

        const row = document.createElement('div');
        if (options.callTurnId) row.dataset.callTurnId = options.callTurnId;
        if (options.callLineType) row.dataset.callLineType = options.callLineType;
        row.style.width = '100%';
        row.style.display = 'flex';
        row.style.alignItems = 'flex-start';
        row.style.justifyContent = 'flex-start';
        row.style.gap = '8px';
        row.style.padding = '0 10px';
        row.style.boxSizing = 'border-box';
        row.style.fontSize = options.fontSize || '15px';
        row.style.lineHeight = '1.55';
        row.style.color = options.color || '#fff';
        row.style.textAlign = 'left';
        row.style.wordBreak = 'break-word';

        const textEl = document.createElement('div');
        textEl.style.minWidth = '0';
        textEl.style.flex = '1';
        textEl.style.whiteSpace = 'pre-wrap';
        
        if (options.speakerName) {
            const nameTag = document.createElement('span');
            nameTag.style.display = 'inline-block';
            nameTag.style.padding = '1px 6px';
            nameTag.style.borderRadius = '8px';
            nameTag.style.marginRight = '6px';
            nameTag.style.fontSize = '12px';
            nameTag.style.fontWeight = '500';
            nameTag.style.verticalAlign = 'baseline';
            
            if (options.isSelf) {
                nameTag.style.background = 'rgba(255, 255, 255, 0.15)';
                nameTag.style.color = '#fff';
            } else {
                nameTag.style.background = 'rgba(255, 255, 255, 0.15)';
                nameTag.style.color = '#fff';
            }
            nameTag.innerText = `@${options.speakerName}`;
            
            textEl.appendChild(nameTag);
            textEl.appendChild(document.createTextNode(text));
        } else {
            textEl.innerText = text;
        }

        row.appendChild(textEl);

        const actionsContainer = document.createElement('div');
        actionsContainer.style.display = 'flex';
        actionsContainer.style.gap = '4px';
        actionsContainer.style.flexShrink = '0';

        if (options.translationText) {
            const translateBtn = document.createElement('button');
            translateBtn.type = 'button';
            translateBtn.title = '显示翻译';
            translateBtn.style.width = '30px';
            translateBtn.style.height = '30px';
            translateBtn.style.border = '1px solid rgba(255,255,255,0.35)';
            translateBtn.style.borderRadius = '50%';
            translateBtn.style.background = 'rgba(255,255,255,0.14)';
            translateBtn.style.color = '#fff';
            translateBtn.style.display = 'inline-flex';
            translateBtn.style.alignItems = 'center';
            translateBtn.style.justifyContent = 'center';
            translateBtn.style.cursor = 'pointer';
            translateBtn.style.padding = '0';
            translateBtn.style.fontSize = '12px';
            translateBtn.innerText = '译';

            const translationEl = document.createElement('div');
            translationEl.style.padding = '4px 10px';
            translationEl.style.fontSize = '13px';
            translationEl.style.color = 'rgba(255,255,255,0.7)';
            translationEl.style.display = 'none';
            translationEl.style.marginTop = '4px';
            translationEl.innerText = options.translationText;

            translateBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                translationEl.style.display = translationEl.style.display === 'none' ? 'block' : 'none';
            });
            
            actionsContainer.appendChild(translateBtn);
            rowWrap.translationElNode = translationEl;
        }

        if (options.voiceButton) {
            actionsContainer.appendChild(options.voiceButton);
        }

        if (actionsContainer.children.length > 0) {
            row.appendChild(actionsContainer);
        }

        rowWrap.appendChild(row);

        if (rowWrap.translationElNode) {
            rowWrap.appendChild(rowWrap.translationElNode);
        }

        return rowWrap;
    }

    function createCallVoiceButton(text, message, friend = callFriend) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = '播放语音';
        btn.setAttribute('aria-label', '播放语音');
        btn.style.width = '30px';
        btn.style.height = '30px';
        btn.style.border = '1px solid rgba(255,255,255,0.35)';
        btn.style.borderRadius = '50%';
        btn.style.background = 'rgba(255,255,255,0.14)';
        btn.style.color = '#fff';
        btn.style.display = 'inline-flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.cursor = 'pointer';
        btn.style.flexShrink = '0';
        btn.style.padding = '0';
        btn.innerHTML = '<i class="fas fa-volume-up" style="font-size: 12px;"></i>';

        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!window.u2Tts || typeof window.u2Tts.speakTextCached !== 'function') {
                if (window.showToast) window.showToast('TTS 不可用');
                return;
            }

            btn.style.opacity = '0.55';
            btn.style.pointerEvents = 'none';
            try {
                await window.u2Tts.speakTextCached(text, friend, message);
            } catch (error) {
                console.error('Call voice playback failed', error);
                if (window.showToast) window.showToast(window.u2Tts?.getUserErrorMessage?.(error) || '语音播放失败');
            } finally {
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            }
        });

        return btn;
    }

    function addCallBubble(text, isSelf, messagesArea, actionText = '', thoughtText = '', translationText = '') {
        const turnId = `call-msg-${Date.now()}-${++callMessageSeq}`;
        const message = {
            text: text,
            actionText: actionText,
            thoughtText: thoughtText,
            translationText: translationText,
            isSelf: isSelf,
            timestamp: Date.now(),
            callTurnId: turnId
        };
        callMessages.push(message);

        if (actionText && messagesArea) {
            messagesArea.appendChild(createCallNovelLine(actionText, {
                callTurnId: turnId,
                callLineType: 'action'
            }));
        }

        if (thoughtText && messagesArea) {
            messagesArea.appendChild(createCallNovelLine(thoughtText, {
                callTurnId: turnId,
                callLineType: 'thought',
                color: 'rgba(255,255,255,0.55)',
                fontSize: '13px'
            }));
        }

        if (text && messagesArea) {
            const speakerName = getCallSpeakerName(message);
            messagesArea.appendChild(createCallNovelLine(formatCallLineText(text), {
                voiceButton: isSelf ? null : createCallVoiceButton(text, message),
                callTurnId: turnId,
                callLineType: 'text',
                speakerName: speakerName,
                isSelf: isSelf,
                translationText: translationText
            }));
        }

        if (messagesArea) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }

        return message;
    }

    window.imChat.openVoiceCall = function(friend, isIncoming = false) {
        const view = document.getElementById('voice-call-view');
        
        if (!view) return;

        if (singleCallInputCleanup) {
            singleCallInputCleanup();
            singleCallInputCleanup = null;
        }

        // Clean up old listeners by cloning
        const newView = view.cloneNode(true);
        view.parentNode.replaceChild(newView, view);

        const newMinimizeBtn = newView.querySelector('#voice-call-minimize-btn');
        const newAvatarImg = newView.querySelector('#voice-call-avatar');
        const newAvatarIcon = newView.querySelector('#voice-call-avatar-icon');
        const newNameEl = newView.querySelector('#voice-call-name');
        const newStatusEl = newView.querySelector('#voice-call-status');
        const newMessagesArea = newView.querySelector('#voice-call-messages');
        
        const newInputRow = newView.querySelector('#voice-call-input-row');
        const newActionsRow = newView.querySelector('#voice-call-actions-row');
        const newInput = newView.querySelector('#voice-call-input');
        const newSendBtn = newView.querySelector('#voice-call-send-btn');
        const newAiBtn = newView.querySelector('#voice-call-ai-btn');
        const newHangupBtn = newView.querySelector('#voice-call-hangup-btn');
        const newRegenerateBtn = newView.querySelector('#voice-call-regenerate-btn');
        const newAcceptBtn = newView.querySelector('#voice-call-accept-btn');
        
        const minimizedFloat = newView.querySelector('#voice-call-minimized-float');
        const mainContent = newView.querySelector('#voice-call-main-content');
        const bgEl = newView.querySelector('#voice-call-bg');
        const infoArea = newView.querySelector('#voice-call-info-area');
        minTimeEl = newView.querySelector('#voice-call-minimized-time');

        callFriend = friend;
        callMessages = [];
        callMessageSeq = 0;
        lastCallAiTurn = null;
        if(newMessagesArea) newMessagesArea.innerHTML = '';
        if(newInput) newInput.value = '';

        if (friend.avatarUrl) {
            if(newAvatarImg) {
                newAvatarImg.src = friend.avatarUrl;
                newAvatarImg.style.display = 'block';
            }
            if(newAvatarIcon) newAvatarIcon.style.display = 'none';
        } else {
            if(newAvatarImg) {
                newAvatarImg.src = '';
                newAvatarImg.style.display = 'none';
            }
            if(newAvatarIcon) newAvatarIcon.style.display = 'block';
        }

        if(newNameEl) newNameEl.innerText = friend.nickname || '对方';
        
        newView.style.display = 'flex';
        newView.style.opacity = '1';
        newView.style.pointerEvents = 'auto';
        newView.classList.add('active');
        
        if (minimizedFloat && mainContent) {
            minimizedFloat.style.display = 'none';
            mainContent.style.display = 'flex';
            mainContent.style.opacity = '1';
            mainContent.style.pointerEvents = 'auto';
            if(bgEl) {
                bgEl.style.opacity = '1';
                bgEl.style.pointerEvents = 'auto';
            }
        }
        
        if (infoArea) {
            infoArea.style.transform = 'scale(1)';
        }

        if (window.openView) window.openView(newView);

        // State control
        let isConnected = false;
        let dialTimeout = null;
        const callSessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        activeSingleCallContext = {
            sessionId: callSessionId,
            friendId: String(friend.id ?? ''),
            connected: false,
            minimized: false
        };

        if (isIncoming) {
            newStatusEl.innerText = '正在邀请你进行语音通话...';
            newInputRow.style.display = 'none';
            newAcceptBtn.style.display = 'flex';
        } else {
            newStatusEl.innerText = '正在呼叫...';
            newInputRow.style.display = 'none';
            newAcceptBtn.style.display = 'none';
            
            // Auto connect after 2 seconds for outgoing call
            dialTimeout = setTimeout(() => {
                connectCall();
            }, 2000);
        }

        function connectCall() {
            isConnected = true;
            if (activeSingleCallContext?.sessionId === callSessionId) {
                activeSingleCallContext.connected = true;
            }
            newInputRow.style.display = 'flex';
            newAcceptBtn.style.display = 'none';
            newStatusEl.innerText = '00:00';
            if (infoArea) {
                infoArea.style.transform = 'scale(0.8)';
            }
            startTimer(newStatusEl, minTimeEl);
        }

        if (newAcceptBtn) {
            newAcceptBtn.addEventListener('click', connectCall);
        }

        let isClosingCall = false;
        async function closeCall() {
            if (isClosingCall) return;
            isClosingCall = true;
            await waitForCallKeyboardToClose(newInput);
            if (dialTimeout) clearTimeout(dialTimeout);
            if (singleCallInputCleanup) {
                singleCallInputCleanup();
                singleCallInputCleanup = null;
            }
            
            // Capture final duration BEFORE doing anything else
            const finalDuration = isConnected ? callSeconds : 0;
            const finalMessages = [...callMessages];
            const finalStatusText = isConnected ? '通话记录' : (isIncoming ? '已拒绝' : '已取消');
            const targetFriend = callFriend;

            stopTimer();
            minTimeEl = null;
            newView.style.display = 'none';
            newView.style.opacity = '0';
            newView.style.pointerEvents = 'none';
            newView.classList.remove('active');
            if (window.closeView) window.closeView(newView);
            
            if (targetFriend) {
                // Save call record
                const isSelfRecord = !isIncoming;
                const recordMsg = {
                    id: Date.now().toString(),
                    type: 'voice_call_record',
                    role: isSelfRecord ? 'user' : 'assistant',
                    content: '[语音通话记录]',
                    senderId: isSelfRecord ? (window.imData.currentUser ? window.imData.currentUser.id : 'me') : targetFriend.id,
                    timestamp: Date.now(),
                    duration: finalDuration,
                    callMessages: finalMessages,
                    isSelf: isSelfRecord,
                    statusText: finalStatusText
                };

                if (window.imApp && window.imApp.appendFriendMessage) {
                    window.imApp.appendFriendMessage(targetFriend.id, recordMsg);
                    
                    // Appended in real-time UI without re-rendering whole list
                    const pageId = `chat-interface-${callFriend.id}`;
                    const page = document.getElementById(pageId);
                    if (page) {
                        const msgContainer = page.querySelector('.ins-chat-messages');
                        if (msgContainer && window.imChat.appendMessageToContainer) {
                            window.imChat.appendMessageToContainer(callFriend, msgContainer, recordMsg);
                            window.imChat.scrollToBottom(msgContainer);
                        }
                    }
                }
            }

            if (activeSingleCallContext?.sessionId === callSessionId) {
                activeSingleCallContext = null;
            }
            callFriend = null;
        }

        if (newHangupBtn) {
            newHangupBtn.addEventListener('click', closeCall);
        }

        if (newMinimizeBtn && minimizedFloat && mainContent) {
            newMinimizeBtn.addEventListener('click', async () => {
                await waitForCallKeyboardToClose(newInput);
                if (activeSingleCallContext?.sessionId === callSessionId) {
                    activeSingleCallContext.minimized = true;
                }
                mainContent.style.opacity = '0';
                mainContent.style.pointerEvents = 'none';
                if(bgEl) {
                    bgEl.style.opacity = '0';
                    bgEl.style.pointerEvents = 'none';
                }
                
                setTimeout(() => {
                    mainContent.style.display = 'none';
                    minimizedFloat.style.display = 'flex';
                }, 300);
                
                // 设置整个视图不拦截点击
                newView.style.pointerEvents = 'none';
                
                // Reset float position
                minimizedFloat.style.right = '20px';
                minimizedFloat.style.top = '100px';
                minimizedFloat.style.left = 'auto';
                minimizedFloat.style.bottom = 'auto';
            });
        }

        if (minimizedFloat && mainContent) {
            let isDragging = false;
            let startX, startY, initialX, initialY;

            const onDragStart = (e) => {
                isDragging = false;
                const touch = e.type.includes('touch') ? e.touches[0] : e;
                startX = touch.clientX;
                startY = touch.clientY;
                const rect = minimizedFloat.getBoundingClientRect();
                initialX = rect.left;
                initialY = rect.top;
                
                minimizedFloat.style.transition = 'none';
                minimizedFloat.style.right = 'auto';
                minimizedFloat.style.bottom = 'auto';
                minimizedFloat.style.left = initialX + 'px';
                minimizedFloat.style.top = initialY + 'px';

                document.addEventListener('mousemove', onDragMove, { passive: false });
                document.addEventListener('touchmove', onDragMove, { passive: false });
                document.addEventListener('mouseup', onDragEnd);
                document.addEventListener('touchend', onDragEnd);
            };

            const onDragMove = (e) => {
                const touch = e.type.includes('touch') ? e.touches[0] : e;
                const dx = touch.clientX - startX;
                const dy = touch.clientY - startY;

                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    isDragging = true;
                }

                if (isDragging) {
                    e.preventDefault();
                    let newX = initialX + dx;
                    let newY = initialY + dy;
                    
                    // Boundary check
                    const maxX = window.innerWidth - minimizedFloat.offsetWidth;
                    const maxY = window.innerHeight - minimizedFloat.offsetHeight;
                    newX = Math.max(0, Math.min(newX, maxX));
                    newY = Math.max(0, Math.min(newY, maxY));

                    minimizedFloat.style.left = newX + 'px';
                    minimizedFloat.style.top = newY + 'px';
                }
            };

            const onDragEnd = () => {
                minimizedFloat.style.transition = 'all 0.3s ease';
                document.removeEventListener('mousemove', onDragMove);
                document.removeEventListener('touchmove', onDragMove);
                document.removeEventListener('mouseup', onDragEnd);
                document.removeEventListener('touchend', onDragEnd);
            };

            minimizedFloat.addEventListener('mousedown', onDragStart);
            minimizedFloat.addEventListener('touchstart', onDragStart, { passive: false });

            minimizedFloat.addEventListener('click', (e) => {
                if (isDragging) {
                    e.stopPropagation();
                    e.preventDefault();
                    return;
                }
                if (activeSingleCallContext?.sessionId === callSessionId) {
                    activeSingleCallContext.minimized = false;
                }
                minimizedFloat.style.display = 'none';
                mainContent.style.display = 'flex';
                if(bgEl) {
                    bgEl.style.opacity = '1';
                    bgEl.style.pointerEvents = 'auto';
                }
                setTimeout(() => {
                    mainContent.style.opacity = '1';
                    mainContent.style.pointerEvents = 'auto';
                }, 10);
                
                // 恢复整个视图的点击拦截
                newView.style.pointerEvents = 'auto';
            });
        }

        if (newSendBtn && newInput && newMessagesArea) {
            bindCallFocusPreservingAction(newSendBtn, async () => {
                if (!isConnected) return;
                const text = newInput.value.trim();
                if (!text || !callFriend) return;
                
                addCallBubble(text, true, newMessagesArea);
                lastCallAiTurn = null;
                newInput.value = '';

                // Optional: trigger API for character response inside call
                if (window.imChat.handleCallApiReply) {
                    await window.imChat.handleCallApiReply(callFriend, text, (txt, isSelf) => addCallBubble(txt, isSelf, newMessagesArea));
                } else if (window.imChat.generateMockReply) {
                    setTimeout(() => {
                        addCallBubble(window.imChat.generateMockReply(callFriend, text), false, newMessagesArea);
                    }, 1000);
                }
            });
        }

        function removeCallTurnFromView(turn, messagesArea) {
            if (!turn?.message?.callTurnId || !messagesArea) return;
            messagesArea.querySelectorAll(`[data-call-turn-id="${turn.message.callTurnId}"]`).forEach(node => node.remove());
        }

        function buildCallRegeneratePrompt(previousReply) {
            return previousReply ? `

【重回重新生成要求】：
- User 按下了“重回”，这通常代表 User 对上一轮语音回复不满意。
- 请先在内部思考：User 为什么重回、刚刚生成的内容不好的点在哪里、User 现在更需要怎样的电话回复。可能问题包括：语气不对、关系距离不对、动作氛围太泛、没有接住情绪、对话太长、太敷衍、太热情、偏离人设、节奏不像电话、没有回应重点。
- 禁止与上一轮重复或高度相似，不能复用相同句式、称呼、情绪走向、动作安排、环境声细节或结尾。
- 不要在 action 或 text 里解释“重回”。
【刚刚被重回的回复】：
${previousReply}` : '';
        }

        async function runCallAiReply(options = {}) {
            const triggerBtn = options.regenerate ? newRegenerateBtn : newAiBtn;
            if (!isConnected || !callFriend || !newMessagesArea) return;
            const { apiConfig, userState } = window;
            if (!apiConfig || !apiConfig.endpoint || !apiConfig.apiKey) {
                if (window.showToast) window.showToast('请先配置 API');
                return;
            }

            let regenerateContext = null;
            if (options.regenerate) {
                if (!lastCallAiTurn?.message) {
                    if (window.showToast) window.showToast('暂无可重回的回复');
                    return;
                }
                regenerateContext = {
                    previousAction: lastCallAiTurn.message.actionText || '',
                    previousThought: lastCallAiTurn.message.thoughtText || '',
                    previousText: lastCallAiTurn.message.text || '',
                    previousReply: [
                        lastCallAiTurn.message.actionText ? `动作/氛围：${lastCallAiTurn.message.actionText}` : '',
                        lastCallAiTurn.message.thoughtText ? `心声：${lastCallAiTurn.message.thoughtText}` : '',
                        lastCallAiTurn.message.text ? `对话：${lastCallAiTurn.message.text}` : ''
                    ].filter(Boolean).join('\n')
                };
                removeCallTurnFromView(lastCallAiTurn, newMessagesArea);
                callMessages = callMessages.filter(item => item !== lastCallAiTurn.message);
                lastCallAiTurn = null;
            }

            if (triggerBtn) {
                triggerBtn.style.opacity = '0.5';
                triggerBtn.style.pointerEvents = 'none';
            }

            try {
                const systemDepth = window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('system_depth') : '';
                const beforeRole = window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('before_role') : '';
                
                const effectiveUserPersona = window.imApp?.getEffectivePersonaForFriend ? window.imApp.getEffectivePersonaForFriend(callFriend) : (userState?.persona || '普通用户');
                
                const contextLimit = window.imApp?.getContextLimit ? window.imApp.getContextLimit(callFriend) : 20;
                
                const targetLanguage = callFriend.language || 'zh';
                const langMap = {
                    'en': 'English',
                    'ja': 'Japanese',
                    'ko': 'Korean',
                    'fr': 'French',
                    'de': 'German',
                    'ru': 'Russian',
                    'es': 'Spanish',
                    'pt': 'Portuguese',
                    'it': 'Italian',
                    'th': 'Thai',
                    'vi': 'Vietnamese',
                    'ar': 'Arabic',
                    'hi': 'Hindi'
                };
                let languageRequirement = '';
                let jsonFormat = `{"action": "第三人称动作/环境声/氛围描写，必须带\${charDisplayName}的名字", "thought": "角色当下心声，不说出口的话（第一人称视角）", "text": "角色说出口的对话内容"}`;
                
                let isChinese = ['zh', 'cn', 'zh-cn', 'chinese'].includes(targetLanguage.toLowerCase());
                if (!isChinese) {
                    const langName = langMap[targetLanguage.toLowerCase()] || langMap[targetLanguage] || targetLanguage;
                    languageRequirement = `\n\n【!!! CRITICAL LANGUAGE RULE / 绝对最高优先级语言指令 !!!】:\n- [ABSOLUTE REQUIREMENT]: You MUST speak ONLY in ${langName} for the "text" field. This overrides ALL persona and memory settings.\n- Even if your persona is Chinese or the user speaks in Chinese, your spoken "text" MUST be in ${langName}.\n- [TRANSLATION]: You MUST provide an accurate Chinese translation of your ${langName} "text" in the "translation" field.\n- [CHINESE ONLY]: The "thought" and "action" fields MUST ALWAYS be written in Chinese (必须使用中文).`;
                    jsonFormat = `{"action": "第三人称动作/环境声/氛围描写，必须带\${charDisplayName}的名字(必须用中文)", "thought": "角色当下心声，不说出口的话（第一人称视角）(必须用中文)", "text": "角色说出口的对话内容（使用${langName}）", "translation": "text字段对应的中文翻译（必须用中文）"}`;
                }

                let chatContextStr = '';
                if (window.imApp?.getRecentContextMessages) {
                    const contextMsgs = window.imApp.getRecentContextMessages(callFriend);
                    if (contextMsgs && contextMsgs.length > 0) {
                        chatContextStr = contextMsgs.map(m => {
                            const roleName = m.role === 'user' ? (userState.name || 'User') : (m.speaker || callFriend.nickname);
                            const content = m.text || m.content || '';
                            let timeStr = '';
                            if (m.timestamp) {
                                const date = new Date(m.timestamp);
                                timeStr = `[${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}] `;
                            }
                            return `${timeStr}${roleName}: ${content}`;
                        }).join('\n');
                    }
                }

                const recentMessages = callMessages.slice(-contextLimit).map(m => {
                    const speaker = m.isSelf ? (userState.name || 'User') : callFriend.nickname;
                    const parts = [];
                    if (m.actionText) parts.push(`动作/氛围：${m.actionText}`);
                    if (m.thoughtText) parts.push(`心声：${m.thoughtText}`);
                    if (m.text) parts.push(`对话：${m.text}`);
                    return `${speaker}: ${parts.join(' / ')}`;
                }).join('\n');

                const charDisplayName = callFriend.realName || callFriend.nickname || 'Char';
                const regeneratePrompt = buildCallRegeneratePrompt(regenerateContext?.previousReply || '');
                const systemPrompt = `${systemDepth ? `System Depth Rules:\n${systemDepth}\n\n` : ''}${beforeRole ? `Before Role Rules:\n${beforeRole}\n\n` : ''}You are playing the role of ${charDisplayName}.
【核心设定/Core Persona】：${callFriend.persona || 'No specific persona'}。
You are talking to ${userState.name || 'User'}, whose persona is: ${effectiveUserPersona}。

【之前的文字聊天记录】：
${chatContextStr || '无'}

【当前场景】：你和用户正处于实时的语音通话中。
【要求】：
1. 思考来电/接听背景：仔细思考用户打来电话或接听电话的原因，用户目前的情绪是怎样的，你（${charDisplayName}）现在在做什么，以及此时应该用怎样的语气来应对。
2. 话题推进：如果这不是一通带有明确紧急事由的电话，仅仅是日常闲聊，你是否应该主动给用户分享你正在做的事情，或者主动挑起一些能够延续通话的有趣话题？请在内心（thought）进行推演，并在文本（text）中自然地表达出来。
3. 结合记录：请结合之前的文字聊天记录以及当前的语音通话上下文，给出一个连贯自然的电话回复。
4. action 必须用第三人称描写动作、环境声或通话氛围，必须包含角色名字“${charDisplayName}”，不要用“我/你”开头。
5. action 要像电话那头能听到或感受到的细节，例如：${charDisplayName}翻了个身，电话那头传来布料摩擦声；${charDisplayName}压低了呼吸，背景里有很轻的脚步声。
6. thought 是 ${charDisplayName} 此刻没说出口的当下心声，必须使用第一人称自述视角（即以“我”自称），可以体现口是心非、犹豫、压住的情绪、真正想说但没说的话；必须贴合人设和当前电话氛围。
7. text 是角色真正说出口的话，可以和 thought 有反差，但不能让 text 解释 thought。
8. action、thought、text 都要简短、口语、贴近实时通话，不要长篇独白。${languageRequirement}
【输出格式】：必须返回纯 JSON，格式为 ${jsonFormat}${regeneratePrompt}

【当前的语音通话上下文】:
${recentMessages}`;

                const endpoint = window.u2Api.resolveChatCompletionsEndpoint(apiConfig.endpoint);

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}` },
                    body: JSON.stringify({
                        model: apiConfig.model || '',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: options.regenerate ? '请重回并重新生成这一轮语音通话回复' : '请继续语音通话' }
                        ],
                        temperature: parseFloat(apiConfig.temperature) || 0.7
                    })
                });

                if (!response.ok) throw new Error('API Error');
                const data = await response.json();
                let fullReply = data.choices[0].message.content;

                let parsed = null;
                let cleanText = fullReply.trim();
                if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7);
                else if (cleanText.startsWith('```')) cleanText = cleanText.substring(3);
                if (cleanText.endsWith('```')) cleanText = cleanText.substring(0, cleanText.length - 3);

                try {
                    parsed = JSON.parse(cleanText);
                } catch (e) {
                    parsed = { action: '', text: cleanText };
                }

                if (!callFriend) return;

                if (parsed && (parsed.text || parsed.action || parsed.thought)) {
                    const message = addCallBubble(parsed.text || '', false, newMessagesArea, parsed.action || '', parsed.thought || '', parsed.translation || '');
                    lastCallAiTurn = { message };
                }

            } catch (error) {
                console.error(error);
                if (options.regenerate && regenerateContext?.previousReply) {
                    const restored = addCallBubble(
                        regenerateContext.previousText || '',
                        false,
                        newMessagesArea,
                        regenerateContext.previousAction || '',
                        regenerateContext.previousThought || '',
                        regenerateContext.previousTranslation || ''
                    );
                    lastCallAiTurn = { message: restored };
                }
                if (window.showToast) window.showToast(options.regenerate ? '重回失败' : 'API 请求失败');
            } finally {
                if (triggerBtn) {
                    triggerBtn.style.opacity = '1';
                    triggerBtn.style.pointerEvents = 'auto';
                }
            }
        }

        if (newAiBtn && newMessagesArea) {
            bindCallFocusPreservingAction(newAiBtn, async () => {
                await runCallAiReply();
            });
        }

        if (newRegenerateBtn && newMessagesArea) {
            bindCallFocusPreservingAction(newRegenerateBtn, async () => {
                await runCallAiReply({ regenerate: true });
            });
        }

        if (newInput && newSendBtn) {
            singleCallInputCleanup = registerCallSendInput(newInput, {
                root: newView,
                scrollContainer: newMessagesArea,
                bottomControls: newInputRow?.parentElement,
                collapseElements: [infoArea, newActionsRow],
                dismissAfterSend: false,
                onSend: () => {
                    if (!isConnected || !newInput.value.trim()) return false;
                    newSendBtn.click();
                    return true;
                }
            });
        }
    };

    // Call Details Modal Logic
    // ==========================================
    // GROUP VOICE CALL
    // ==========================================
    let groupCallTimer = null;
    let groupCallSeconds = 0;
    let groupCallTarget = null;
    let groupCallMessages = [];
    let activeGroupMembers = [];
    let groupCallMessageSeq = 0;
    let lastGroupCallAiTurn = null;

    function startGroupTimer(statusEl, minTimeTextEl) {
        groupCallSeconds = 0;
        if(statusEl) statusEl.innerText = '00:00';
        if(minTimeTextEl) minTimeTextEl.innerText = '00:00';
        groupCallTimer = setInterval(() => {
            groupCallSeconds++;
            const t = formatTime(groupCallSeconds);
            if(statusEl) statusEl.innerText = t;
            if(minTimeTextEl) minTimeTextEl.innerText = t;
        }, 1000);
    }

    function stopGroupTimer() {
        if (groupCallTimer) {
            clearInterval(groupCallTimer);
            groupCallTimer = null;
        }
    }

    function addGroupCallBubble(text, senderId, messagesArea, actionText = '', translationText = '') {
        if (!text && !actionText) return null;

        let isSelf = (senderId === '__user__' || senderId == null);
        const groupUserIdentity = groupCallTarget?.type === 'group' && window.imApp?.getGroupUserIdentity
            ? window.imApp.getGroupUserIdentity(groupCallTarget)
            : null;
        let senderName = isSelf ? (groupUserIdentity?.name || window.userState?.name || 'User') : 'Member';
        let senderAvatar = isSelf ? (groupUserIdentity?.avatarUrl || '') : '';
        let senderFriend = null;
        
        if (!isSelf && groupCallTarget) {
            const groupMembers = window.imChat?.getGroupMemberFriends
                ? window.imChat.getGroupMemberFriends(groupCallTarget)
                : [];
            const friend = groupMembers.find(member => String(member.id) === String(senderId));
            if (friend) {
                senderName = friend.nickname;
                senderAvatar = friend.avatarUrl;
                senderFriend = friend;
            }
        }

        const turnId = `group-call-msg-${Date.now()}-${++groupCallMessageSeq}`;
        const message = {
            text: text,
            actionText: actionText,
            thoughtText: '',
            translationText: translationText,
            senderId: senderId == null ? '__user__' : senderId,
            senderName: senderName,
            senderAvatarUrl: senderAvatar || '',
            isSelf: isSelf,
            timestamp: Date.now(),
            callTurnId: turnId
        };
        groupCallMessages.push(message);

        if (actionText && messagesArea) {
            messagesArea.appendChild(createCallNovelLine(actionText, {
                callTurnId: turnId,
                callLineType: 'action'
            }));
        }

        if (text && messagesArea) {
            const canPlayTts = !isSelf
                && !!senderFriend
                && !!window.u2Tts?.canSpeakForFriend?.(senderFriend);
            messagesArea.appendChild(createCallNovelLine(formatCallLineText(text), {
                voiceButton: canPlayTts ? createCallVoiceButton(text, message, senderFriend) : null,
                callTurnId: turnId,
                callLineType: 'text',
                speakerName: senderName,
                isSelf: isSelf,
                translationText: translationText
            }));
        }

        if (messagesArea) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }

        return message;
    }

    window.imChat.openGroupVoiceCall = function(group, memberIds) {
        const view = document.getElementById('group-voice-call-view');
        if (!view) return;

        if (groupCallInputCleanup) {
            groupCallInputCleanup();
            groupCallInputCleanup = null;
        }

        // Clean up old listeners
        const newView = view.cloneNode(true);
        view.parentNode.replaceChild(newView, view);

        groupCallTarget = group;
        activeGroupMembers = memberIds;
        groupCallMessages = [];
        groupCallMessageSeq = 0;
        lastGroupCallAiTurn = null;

        // UI Elements
        const hangupBtn = newView.querySelector('#group-call-hangup-btn');
        const minimizeBtn = newView.querySelector('#group-call-minimize-btn');
        const statusText = newView.querySelector('#group-call-status-text');
        const avatarsGrid = newView.querySelector('#group-call-avatars-grid');
        const messagesArea = newView.querySelector('#group-call-messages');
        const inputEl = newView.querySelector('#group-call-input');
        const sendBtn = newView.querySelector('#group-call-send-btn');
        const aiBtn = newView.querySelector('#group-call-ai-btn');
        const regenerateBtn = newView.querySelector('#group-call-regenerate-btn');
        const actionsRow = newView.querySelector('#group-call-actions-row');
        const groupBgEl = newView.querySelector('#group-call-bg');
        
        let minBanner = document.getElementById('group-call-minimized-banner');
        let minText = null;
        let minTime = null;

        // 提前克隆并更新引用，防止后续使用旧 DOM
        if (minBanner) {
            const newMinBanner = minBanner.cloneNode(true);
            minBanner.parentNode.replaceChild(newMinBanner, minBanner);
            minBanner = newMinBanner;
            
            minText = document.getElementById('group-call-minimized-text');
            minTime = document.getElementById('group-call-minimized-time');
            
            minBanner.addEventListener('click', () => {
                minBanner.style.display = 'none';
                newView.style.display = 'flex';
                const mainContent = newView.querySelector('#group-call-main-content');
                if (mainContent) {
                    mainContent.style.opacity = '1';
                    mainContent.style.pointerEvents = 'auto';
                }
                if (groupBgEl) {
                    groupBgEl.style.opacity = '1';
                    groupBgEl.style.pointerEvents = 'auto';
                }
                newView.style.opacity = '1';
                newView.style.pointerEvents = 'auto';
                newView.classList.add('active');
            });
        }

        // Reset UI
        messagesArea.innerHTML = '';
        inputEl.value = '';
        avatarsGrid.innerHTML = '';
        statusText.innerText = '等待接通...';
        
        newView.style.display = 'flex';
        newView.style.opacity = '1';
        newView.style.pointerEvents = 'auto';
        newView.classList.add('active');
        if (groupBgEl) {
            groupBgEl.style.opacity = '1';
            groupBgEl.style.pointerEvents = 'auto';
        }
        if (window.openView) {
            window.openView(newView);
        }

        // Include user in avatars grid
        const allParticipants = [{ id: '__user__', isUser: true }, ...memberIds.map(id => window.imData.friends.find(f => f.id === id)).filter(Boolean)];
        
        allParticipants.forEach(p => {
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.alignItems = 'center';
            wrap.style.gap = '6px';
            
            const avatar = document.createElement('div');
            avatar.style.width = '64px';
            avatar.style.height = '64px';
            avatar.style.borderRadius = '50%';
            avatar.style.border = '2px solid rgba(255,255,255,0.1)';
            avatar.style.background = '#333';
            avatar.style.overflow = 'hidden';
            avatar.style.transition = 'all 0.5s ease';
            
            if (p.isUser) {
                // User initiating the call is fully colored and active immediately
                avatar.style.filter = 'grayscale(0%) opacity(1)';
                avatar.style.border = '2px solid #34c759';
            } else {
                // Others grayed out initially
                avatar.style.filter = 'grayscale(100%) opacity(0.5)';
            }
            
            if (p.isUser) {
                const groupUserIdentity = groupCallTarget?.type === 'group' && window.imApp?.getGroupUserIdentity
                    ? window.imApp.getGroupUserIdentity(groupCallTarget)
                    : null;
                const userAvatar = groupUserIdentity?.avatarUrl || window.userState?.avatarUrl || window.userState?.avatar;
                if (userAvatar) {
                    avatar.innerHTML = `<img src="${userAvatar}" style="width:100%;height:100%;object-fit:cover;">`;
                } else {
                    avatar.innerHTML = `<div style="width:100%;height:100%;display:flex;justify-content:center;align-items:center;color:#fff;"><i class="fas fa-user"></i></div>`;
                }
            } else {
                if (p.avatarUrl) {
                    avatar.innerHTML = `<img src="${p.avatarUrl}" style="width:100%;height:100%;object-fit:cover;">`;
                } else {
                    avatar.innerHTML = `<div style="width:100%;height:100%;display:flex;justify-content:center;align-items:center;color:#fff;"><i class="fas fa-robot"></i></div>`;
                }
            }

            const name = document.createElement('div');
            name.style.fontSize = '12px';
            name.style.color = 'rgba(255,255,255,0.6)';
            name.style.maxWidth = '70px';
            name.style.overflow = 'hidden';
            name.style.textOverflow = 'ellipsis';
            name.style.whiteSpace = 'nowrap';
            const groupUserIdentity = groupCallTarget?.type === 'group' && window.imApp?.getGroupUserIdentity
                ? window.imApp.getGroupUserIdentity(groupCallTarget)
                : null;
            name.innerText = p.isUser ? (groupUserIdentity?.name || window.userState?.name || 'User') : p.nickname;

            wrap.appendChild(avatar);
            wrap.appendChild(name);
            avatarsGrid.appendChild(wrap);

            if (!p.isUser) {
                // Animate to color after random delay (1-3 seconds)
                setTimeout(() => {
                    avatar.style.filter = 'grayscale(0%) opacity(1)';
                    avatar.style.border = '2px solid #34c759'; // Green border when connected
                }, 1000 + Math.random() * 2000);
            }
        });

        // Start timer after 1 second
        setTimeout(() => {
            startGroupTimer(statusText, minTime);
            if (minText) minText.innerText = `${allParticipants.length}人正在群通话中...`;
        }, 1000);

        let isClosingGroupCall = false;
        const closeGroupCall = async () => {
            if (isClosingGroupCall) return;
            isClosingGroupCall = true;
            await waitForCallKeyboardToClose(inputEl);
            if (groupCallInputCleanup) {
                groupCallInputCleanup();
                groupCallInputCleanup = null;
            }
            const durationText = formatTime(groupCallSeconds);
            const finalMessages = [...groupCallMessages];
            const finalDuration = groupCallSeconds;

            stopGroupTimer();
            newView.style.display = 'none';
            newView.style.opacity = '0';
            newView.style.pointerEvents = 'none';
            newView.classList.remove('active');
            if (window.closeView) window.closeView(newView);
            
            if (minBanner) minBanner.style.display = 'none';
            
            // Save to group
            if (groupCallTarget && window.imApp && window.imApp.appendFriendMessage) {
                let callTranscript = '';
                if (finalMessages.length > 0) {
                    callTranscript = finalMessages.map(m => {
                        const parts = [];
                        if (m.actionText) parts.push(`动作：${m.actionText}`);
                        if (m.text) parts.push(`${m.senderName}: ${m.text}`);
                        if (m.translationText) parts.push(`翻译：${m.translationText}`);
                        return parts.join(' / ');
                    }).filter(Boolean).join('\n  ');
                } else {
                    callTranscript = '无对话';
                }

                // Append the call card
                const recordMsg = {
                    id: Date.now().toString(),
                    type: 'voice_call_record',
                    role: 'system',
                    content: '[群语音通话记录]',
                    senderId: '__user__',
                    timestamp: Date.now(),
                    duration: finalDuration,
                    callMessages: finalMessages,
                    statusText: `群通话时长 ${durationText}`,
                    isSelf: true
                };

                window.imApp.appendFriendMessage(groupCallTarget.id, recordMsg);
                
                // Add text note for context
                const contextNotice = {
                    id: (Date.now() + 1).toString(),
                    type: 'text',
                    role: 'system',
                    content: `[系统提示：刚刚完成了一次群语音通话，时长 ${durationText}。通话内容：\n${callTranscript}]`,
                    timestamp: Date.now() + 1
                };
                window.imApp.appendFriendMessage(groupCallTarget.id, contextNotice);

                // Update UI if needed
                const pageId = `chat-interface-${groupCallTarget.id}`;
                const page = document.getElementById(pageId);
                if (page) {
                    const msgContainer = page.querySelector('.ins-chat-messages');
                    if (msgContainer && window.imChat.appendMessageToContainer) {
                        window.imChat.appendMessageToContainer(groupCallTarget, msgContainer, recordMsg);
                        window.imChat.scrollToBottom(msgContainer);
                    }
                }
            }

            groupCallTarget = null;
            groupCallMessages = [];
            lastGroupCallAiTurn = null;
        };

        if (hangupBtn) hangupBtn.addEventListener('click', closeGroupCall);

        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', async () => {
                await waitForCallKeyboardToClose(inputEl);
                const mainContent = newView.querySelector('#group-call-main-content');
                
                if (mainContent) {
                    mainContent.style.opacity = '0';
                    mainContent.style.pointerEvents = 'none';
                }
                if (groupBgEl) {
                    groupBgEl.style.opacity = '0';
                    groupBgEl.style.pointerEvents = 'none';
                }

                setTimeout(() => {
                    newView.style.display = 'none';
                    newView.style.opacity = '0';
                    newView.classList.remove('active');
                }, 300);
                
                newView.style.pointerEvents = 'none';
                if (minBanner) minBanner.style.display = 'flex'; // 恢复显示悬浮气泡
            });
        }

        if (sendBtn) {
            bindCallFocusPreservingAction(sendBtn, () => {
                const text = inputEl.value.trim();
                if (!text) return;
                addGroupCallBubble(text, '__user__', messagesArea);
                lastGroupCallAiTurn = null;
                inputEl.value = '';
            });
        }

        if (inputEl && sendBtn) {
            groupCallInputCleanup = registerCallSendInput(inputEl, {
                root: newView,
                scrollContainer: messagesArea,
                bottomControls: inputEl.parentElement?.parentElement,
                collapseElements: [avatarsGrid, actionsRow],
                dismissAfterSend: false,
                onSend: () => {
                    if (!inputEl.value.trim()) return false;
                    sendBtn.click();
                    return true;
                }
            });
        }

        let pendingGroupCallRegenerateContext = null;

        function buildGroupCallRegeneratePrompt(previousReply) {
            if (!previousReply) return '';
            return `

【重回重新生成要求】:
- User 按下了“重回”，请直接重新生成刚才那一轮群通话对话。
- 新一轮必须自然接住当前通话上下文，但不得复用下面旧回复中的句子、称呼、话题推进方式或结尾。
- 不要提及“重回”、旧回复或重新生成。
【刚才被重回的群通话对话】:
${previousReply}`;
        }

        function removeGroupCallAiTurn(turn) {
            const messages = Array.isArray(turn?.messages) ? turn.messages : [];
            const turnIds = new Set(messages.map(message => message?.callTurnId).filter(Boolean));
            if (turnIds.size > 0 && messagesArea) {
                turnIds.forEach(turnId => {
                    messagesArea.querySelectorAll(`[data-call-turn-id="${turnId}"]`).forEach(node => node.remove());
                });
            }
            groupCallMessages = groupCallMessages.filter(message => !messages.includes(message));
        }

        function restoreGroupCallAiTurn(messages) {
            const restoredMessages = [];
            (Array.isArray(messages) ? messages : []).forEach(message => {
                const restored = addGroupCallBubble(
                    message?.text || '',
                    message?.senderId || '__user__',
                    messagesArea,
                    message?.actionText || '',
                    message?.translationText || ''
                );
                if (restored) restoredMessages.push(restored);
            });
            return restoredMessages;
        }

        if (aiBtn) {
            bindCallFocusPreservingAction(aiBtn, async () => {
                if (!groupCallTarget) return;
                const regenerateContext = pendingGroupCallRegenerateContext;
                pendingGroupCallRegenerateContext = null;
                
                const { apiConfig } = window;
                const userState = window.userState || {};
                if (!apiConfig || !apiConfig.endpoint || !apiConfig.apiKey) {
                    if (window.showToast) window.showToast('请先配置 API');
                    return;
                }

                [aiBtn, regenerateBtn].filter(Boolean).forEach(button => {
                    button.style.opacity = '0.5';
                    button.style.pointerEvents = 'none';
                });

                try {
                    // Fetch group members details
                    const groupMembers = activeGroupMembers.map(id => window.imData.friends.find(f => f.id === id)).filter(Boolean);
                    
                    // 获取群聊成员的挂载单聊记忆
                    const groupMemorySettings = groupCallTarget.memory?.mountSettings || {};
                    const groupMemoryLimits = groupCallTarget.memory?.mountLimits || {};
                    const membersInfo = groupMembers.map(m => {
                        let memberStr = `Name: ${m.nickname}\nPersona: ${m.persona || 'None'}`;
                        
                        // 挂载单聊上下文
                        if (groupMemorySettings[m.id]) {
                            const limit = groupMemoryLimits[m.id] || 20;
                            let contextMsgs = m.messages || [];
                            if (window.imApp.getRecentContextMessages && contextMsgs.length === 0) {
                                contextMsgs = window.imApp.getRecentContextMessages(m) || [];
                            }
                            if (contextMsgs.length > limit) {
                                contextMsgs = contextMsgs.slice(-limit);
                            }
                            if (contextMsgs && contextMsgs.length > 0) {
                                const chatContextStr = contextMsgs.map(msg => {
                                    const roleName = msg.role === 'user' ? (userState.name || 'User') : (msg.speaker || m.nickname);
                                    let timeStr = '';
                                    if (msg.timestamp) {
                                        const date = new Date(msg.timestamp);
                                        timeStr = `[${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}] `;
                                    }
                                    return `${timeStr}${roleName}: ${msg.text || msg.content || ''}`;
                                }).join('\n');
                                memberStr += `\n【${m.nickname} 与 ${userState.name || 'User'} 的单聊记忆（供参考该角色的态度和背景）】:\n${chatContextStr}`;
                            }
                        }
                        return memberStr;
                    }).join('\n\n-----------------\n\n');
                    
                    const systemDepth = window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('system_depth') : '';
                    const beforeRole = window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('before_role') : '';
                    const afterRole = window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('after_role') : '';
                    const customGroupPrompt = groupCallTarget.memory?.context?.prompt || '';
                    const regeneratePrompt = buildGroupCallRegeneratePrompt(regenerateContext?.previousReply || '');
                    
                    const groupUserIdentity = window.imApp?.getGroupUserIdentity
                        ? window.imApp.getGroupUserIdentity(groupCallTarget)
                        : null;
                    const effectiveUserPersona = groupUserIdentity?.persona
                        || (window.imApp?.getEffectivePersonaForFriend
                            ? window.imApp.getEffectivePersonaForFriend(groupCallTarget)
                            : (userState?.persona || '普通用户'));
                    
                    const recentMsgs = groupCallMessages.slice(-20).map(m => {
                        const parts = [];
                        if (m.actionText) parts.push(`动作：${m.actionText}`);
                        if (m.text) parts.push(`发言：${m.text}`);
                        if (m.translationText) parts.push(`翻译：${m.translationText}`);
                        return `${m.senderName}: ${parts.join(' / ')}`;
                    }).join('\n');
                    const activeSpeakerNames = groupMembers.map(m => m.nickname || m.realName).filter(Boolean);
                    
                    let systemPrompt = '';
                    if (systemDepth) systemPrompt += `【系统规则 (System Depth)】\n${systemDepth}\n\n`;
                    if (beforeRole) systemPrompt += `【前置设定 (Before Role)】\n${beforeRole}\n\n`;
                    
                    systemPrompt += `You are simulating a group voice call in the group "${groupCallTarget.nickname}".
【群聊成员设定】:
${membersInfo}

The user is ${groupUserIdentity?.name || userState?.name || 'User'}, whose persona is: ${effectiveUserPersona}.

【当前的语音通话记录】:
${recentMsgs || '无'}
`;
                    if (customGroupPrompt) systemPrompt += `\n【群聊特殊设定】:\n${customGroupPrompt}\n`;
                    if (afterRole) systemPrompt += `\n【补充设定 (After Role)】:\n${afterRole}\n`;

systemPrompt += `\n【!!!重要指示!!!】:
你现在正处于真实的群聊实时语音通话中。
【要求】:
1. 这是一段连续发生的多人通话，不是点名发言。根据上一句的具体内容、语气和关系自然选择谁接话；后一条必须回应、补充、打断、追问或纠正前一条，禁止每个人各说一段互不相关的话。
2. 每次生成 3-8 条按实际发生顺序排列的简短发言。无需让所有成员出现，也不限制一名成员只能说一次；允许两三个人围绕同一件事连续来回。有至少两名可用成员时，本轮通常应形成至少两人之间的接话。
3. 已接入成员名单：${activeSpeakerNames.length > 0 ? activeSpeakerNames.join('、') : 'None'}。senderName 必须严格使用名单中的准确名字，禁止添加名单外的人，禁止替 User 发言。
4. 每条 text 都必须是成员真正说出口的短句，口语化、即时、自然；避免长篇独白、总结式轮流发言和重复上一句。
5. translation 必须是 text 对应的自然中文翻译；text 本身是中文时也给出自然中文复述，不要留空。
6. 只输出对话。严禁输出 action、thought、inner、monologue、心声、内心、心理活动、动作、环境声、旁白等字段或内容；不要展示任何未说出口的信息。
7. 【输出格式】：只返回纯 JSON 数组，数组顺序就是实际接话顺序。每项只能包含 senderName、text、translation 三个字段，格式为：[{"senderName":"成员名","text":"原文台词","translation":"中文翻译"}]。${regeneratePrompt}`;
                    const endpoint = window.u2Api.resolveChatCompletionsEndpoint(apiConfig.endpoint);

                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}` },
                        body: JSON.stringify({
                            model: apiConfig.model || '',
                            messages: [
                                { role: 'system', content: systemPrompt },
                                { role: 'user', content: '请继续群语音通话' }
                            ],
                            temperature: parseFloat(apiConfig.temperature) || 0.8
                        })
                    });

                    if (!response.ok) throw new Error('API Error');
                    const data = await response.json();
                    let fullReply = data.choices[0].message.content;

                    let parsed = null;
                    
                    try {
                        // 更鲁棒的 JSON 提取
                        let match = fullReply.match(/\[[\s\S]*\]/);
                        if (match) {
                            parsed = JSON.parse(match[0]);
                        } else {
                            let singleMatch = fullReply.match(/\{[\s\S]*\}/);
                            if (singleMatch) {
                                parsed = [JSON.parse(singleMatch[0])];
                            } else {
                                let cleanText = fullReply.trim();
                                if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7);
                                else if (cleanText.startsWith('```')) cleanText = cleanText.substring(3);
                                if (cleanText.endsWith('```')) cleanText = cleanText.substring(0, cleanText.length - 3);
                                parsed = JSON.parse(cleanText.trim());
                            }
                        }
                        if (!Array.isArray(parsed)) parsed = [parsed];
                        parsed = parsed.slice(0, 8).map(item => ({
                            senderName: typeof item?.senderName === 'string' ? item.senderName.trim() : '',
                            text: typeof item?.text === 'string' ? item.text.trim() : '',
                            translation: typeof item?.translation === 'string' ? item.translation.trim() : ''
                        }));
                    } catch (e) {
                        console.error("Failed to parse JSON in group call", e, fullReply);
                        parsed = [];
                        if (window.showToast) window.showToast('AI返回格式错误，请重试');
                    }

                    if (!groupCallTarget) return; // if hung up during fetch

                    const generatedTurn = { messages: [] };
                    parsed.forEach((msgObj) => {
                        if (msgObj.senderName && msgObj.text) {
                            // Find member id by name
                            let friend = groupMembers.find(m => 
                                m.nickname === msgObj.senderName || 
                                m.realName === msgObj.senderName || 
                                (m.nickname && msgObj.senderName.includes(m.nickname)) || 
                                (m.realName && msgObj.senderName.includes(m.realName))
                            );
                            
                            if (friend) {
                                const message = addGroupCallBubble(msgObj.text, friend.id, messagesArea, '', msgObj.translation || '');
                                if (message) generatedTurn.messages.push(message);
                            }
                        }
                    });

                    if (generatedTurn.messages.length === 0) {
                        throw new Error('No valid group call dialogue returned');
                    }
                    lastGroupCallAiTurn = generatedTurn;

                } catch (err) {
                    console.error(err);
                    if (regenerateContext?.previousMessages) {
                        const restoredMessages = restoreGroupCallAiTurn(regenerateContext.previousMessages);
                        lastGroupCallAiTurn = { messages: restoredMessages };
                    }
                    if (window.showToast) window.showToast('API 请求失败');
                } finally {
                    [aiBtn, regenerateBtn].filter(Boolean).forEach(button => {
                        button.style.opacity = '1';
                        button.style.pointerEvents = 'auto';
                    });
                }
            });
        }

        if (regenerateBtn) {
            bindCallFocusPreservingAction(regenerateBtn, () => {
                if (!lastGroupCallAiTurn?.messages?.length) {
                    if (window.showToast) window.showToast('暂无可重回的回复');
                    return;
                }

                const previousMessages = [...lastGroupCallAiTurn.messages];
                pendingGroupCallRegenerateContext = {
                    previousMessages,
                    previousReply: previousMessages
                        .map(message => `${message.senderName || '成员'}：${message.text || ''}`)
                        .filter(Boolean)
                        .join('\n')
                };
                removeGroupCallAiTurn(lastGroupCallAiTurn);
                lastGroupCallAiTurn = null;
                aiBtn.click();
            });
        }
    };

    window.imChat.openVoiceCallDetail = function(msg) {
        const detailModal = document.getElementById('voice-call-detail-modal');
        const detailContent = document.getElementById('voice-call-detail-content');
        const detailMeta = document.getElementById('voice-call-detail-meta');

        if (!detailModal || !detailContent || !detailMeta) return;
        
        detailMeta.innerText = `通话时长: ${formatTime(msg.duration || 0)}`;
        detailContent.innerHTML = '';

        if (!msg.callMessages || msg.callMessages.length === 0) {
            detailContent.innerHTML = '<div style="text-align: center; color: #8e8e93; padding: 20px;">无通话内容记录</div>';
        } else {
            msg.callMessages.forEach(cMsg => {
                const row = document.createElement('div');
                row.style.marginBottom = '12px';
                
                const name = document.createElement('div');
                name.style.fontSize = '12px';
                name.style.color = '#8e8e93';
                name.style.marginBottom = '4px';
                name.innerText = cMsg.isSelf ? '我' : '对方';

                const bubble = document.createElement('div');
                bubble.style.display = 'inline-block';
                bubble.style.padding = '8px 12px';
                bubble.style.borderRadius = '12px';
                bubble.style.fontSize = '14px';
                bubble.style.maxWidth = '85%';
                bubble.style.wordBreak = 'break-word';

                if (cMsg.isSelf) {
                    bubble.style.background = '#e5e5ea';
                    bubble.style.color = '#000';
                } else {
                    bubble.style.background = '#f2f2f7';
                    bubble.style.color = '#000';
                }

                bubble.innerText = cMsg.text;
                
                row.appendChild(name);
                row.appendChild(bubble);
                detailContent.appendChild(row);
            });
        }

        if (window.openView) {
            window.openView(detailModal);
        } else {
            detailModal.style.display = 'flex';
        }
    };
    function serializeCallMessagesForEdit(messages, friend = null) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        return safeMessages.map((message) => {
            const lines = [];
            if (message.actionText) lines.push(String(message.actionText).trim());
            if (message.thoughtText) lines.push(`心声：${String(message.thoughtText).trim()}`);
            if (message.text) lines.push(`${getCallSpeakerName(message, friend)}：${formatCallLineText(message.text)}`);
            if (message.translationText) lines.push(`翻译：${String(message.translationText).trim()}`);
            return lines.join('\n');
        }).filter(Boolean).join('\n\n');
    }

    function buildCallRecordContextText(messages, friend = null, duration = 0, statusText = '通话记录') {
        const safeMessages = Array.isArray(messages) ? messages : [];
        const durationText = `${Math.floor((Number(duration) || 0) / 60)}分${(Number(duration) || 0) % 60}秒`;

        if (statusText === '已拒绝') {
            return '[语音通话记录] 对方刚刚拒绝了这通语音通话。';
        }
        if (statusText === '已取消') {
            return '[语音通话记录] 用户刚刚取消了这通语音通话。';
        }

        const transcript = safeMessages.map((message) => {
            const parts = [];
            if (message.actionText) parts.push(String(message.actionText).trim());
            if (message.thoughtText) parts.push(`心声：${String(message.thoughtText).trim()}`);
            if (message.text) parts.push(`${getCallSpeakerName(message, friend)}：${formatCallLineText(message.text)}`);
            if (message.translationText) parts.push(`翻译：${String(message.translationText).trim()}`);
            return parts.join('\n');
        }).filter(Boolean).join('\n');

        return transcript
            ? `[语音通话记录] 时长 ${durationText}\n${transcript}`
            : `[语音通话记录] 时长 ${durationText}，未产生可识别的文本记录。`;
    }

    function parseCallMessagesFromEdit(rawText, previousMessages = [], friend = null) {
        const groupUserIdentity = friend?.type === 'group' && window.imApp?.getGroupUserIdentity
            ? window.imApp.getGroupUserIdentity(friend)
            : null;
        const userNames = [groupUserIdentity?.name, window.userState?.name, window.userState?.realName, 'User', '我']
            .filter(Boolean)
            .map(name => String(name).trim());
        const charNames = [friend?.nickname, friend?.realName, 'Char', '对方']
            .filter(Boolean)
            .map(name => String(name).trim());
        const messages = [];
        let pendingAction = '';
        let pendingThought = '';
        let pendingTranslation = '';

        String(rawText || '').split(/\r?\n/).forEach((rawLine) => {
            const line = rawLine.trim();
            if (!line) return;

            const thoughtMatch = line.match(/^心声[：:]\s*(.+)$/);
            if (thoughtMatch) {
                pendingThought = String(thoughtMatch[1] || '').trim();
                return;
            }

            const translationMatch = line.match(/^翻译[：:]\s*(.+)$/);
            if (translationMatch) {
                pendingTranslation = String(translationMatch[1] || '').trim();
                return;
            }

            const dialogMatch = line.match(/^(?:(.+?)[：:]\s*)?[「"](.*?)[」"]$/);
            if (dialogMatch) {
                const speaker = String(dialogMatch[1] || '').trim();
                const text = String(dialogMatch[2] || '').trim();
                const fallback = previousMessages[messages.length] || {};
                let isSelf = !!fallback.isSelf;

                if (speaker) {
                    if (userNames.some(name => name && speaker.includes(name))) isSelf = true;
                    if (charNames.some(name => name && speaker.includes(name))) isSelf = false;
                }

                messages.push({
                    text,
                    actionText: pendingAction,
                    thoughtText: pendingThought,
                    translationText: pendingTranslation,
                    isSelf,
                    timestamp: fallback.timestamp || Date.now()
                });
                pendingAction = '';
                pendingThought = '';
                pendingTranslation = '';
                return;
            }

            pendingAction = pendingAction ? `${pendingAction}\n${line}` : line;
        });

        if (pendingAction || pendingThought || pendingTranslation) {
            const fallback = previousMessages[messages.length] || {};
            messages.push({
                text: '',
                actionText: pendingAction,
                thoughtText: pendingThought,
                translationText: pendingTranslation,
                isSelf: !!fallback.isSelf,
                timestamp: fallback.timestamp || Date.now()
            });
        }

        return messages;
    }

    function renderCallDetailReadMode(detailContent, msg, friend = null) {
        detailContent.innerHTML = '';
        const safeMessages = Array.isArray(msg.callMessages) ? msg.callMessages : [];

        if (safeMessages.length === 0) {
            detailContent.innerHTML = '<div style="text-align:left; color:#8e8e93; padding:20px 0;">无通话内容记录</div>';
            return;
        }

        safeMessages.forEach((cMsg) => {
            const block = document.createElement('div');
            block.style.marginBottom = '14px';
            block.style.textAlign = 'left';
            block.style.color = '#111';
            block.style.fontSize = '15px';
            block.style.lineHeight = '1.65';

            if (cMsg.actionText) {
                const action = document.createElement('div');
                action.style.whiteSpace = 'pre-wrap';
                action.style.wordBreak = 'break-word';
                action.innerText = cMsg.actionText;
                block.appendChild(action);
            }

            if (cMsg.thoughtText) {
                const thought = document.createElement('div');
                thought.style.whiteSpace = 'pre-wrap';
                thought.style.wordBreak = 'break-word';
                thought.style.color = '#8e8e93';
                thought.style.fontSize = '13px';
                thought.innerText = cMsg.thoughtText;
                block.appendChild(thought);
            }

            if (cMsg.text) {
                const line = document.createElement('div');
                line.style.whiteSpace = 'pre-wrap';
                line.style.wordBreak = 'break-word';
                line.innerText = `${getCallSpeakerName(cMsg, friend)}：${formatCallLineText(cMsg.text)}`;
                block.appendChild(line);
            }

            if (cMsg.translationText) {
                const translation = document.createElement('div');
                translation.style.whiteSpace = 'pre-wrap';
                translation.style.wordBreak = 'break-word';
                translation.style.color = '#8e8e93';
                translation.style.fontSize = '13px';
                translation.style.marginTop = '4px';
                translation.innerText = `翻译：${cMsg.translationText}`;
                block.appendChild(translation);
            }

            detailContent.appendChild(block);
        });
    }

    function renderCallDetailEditMode(detailContent, msg, friend = null) {
        detailContent.innerHTML = '';
        const textarea = document.createElement('textarea');
        textarea.id = 'voice-call-detail-editor';
        // 保留说话人名称，便于保存时识别通话双方。
        textarea.value = serializeCallMessagesForEdit(msg.callMessages, friend);
        textarea.style.width = '100%';
        textarea.style.height = '100%';
        textarea.style.minHeight = '320px';
        textarea.style.boxSizing = 'border-box';
        textarea.style.border = '1px solid #d1d1d6';
        textarea.style.borderRadius = '12px';
        textarea.style.padding = '12px';
        textarea.style.fontSize = '15px';
        textarea.style.lineHeight = '1.6';
        textarea.style.outline = 'none';
        textarea.style.resize = 'none';
        textarea.style.background = '#fff';
        textarea.style.color = '#111';
        detailContent.appendChild(textarea);
        textarea.focus();
    }

    window.imChat.openVoiceCallDetail = function(msg, friend = null) {
        const detailModal = document.getElementById('voice-call-detail-modal');
        const detailContent = document.getElementById('voice-call-detail-content');
        const detailMeta = document.getElementById('voice-call-detail-meta');
        const editBtn = document.getElementById('voice-call-detail-edit-btn');
        const saveBtn = document.getElementById('voice-call-detail-save-btn');
        const cancelBtn = document.getElementById('voice-call-detail-cancel-btn');

        if (!detailModal || !detailContent || !detailMeta) return;

        const detailFriend = friend || window.imData?.currentActiveFriend || null;
        let isEditing = false;

        const setEditMode = (nextEditing) => {
            isEditing = nextEditing;
            if (editBtn) editBtn.style.display = isEditing ? 'none' : 'block';
            if (saveBtn) saveBtn.style.display = isEditing ? 'block' : 'none';
            if (cancelBtn) cancelBtn.style.display = isEditing ? 'block' : 'none';
            if (isEditing) renderCallDetailEditMode(detailContent, msg, detailFriend);
            else renderCallDetailReadMode(detailContent, msg, detailFriend);
        };

        detailMeta.innerText = `通话时长: ${formatTime(msg.duration || 0)}`;

        if (editBtn) editBtn.onclick = () => setEditMode(true);
        if (cancelBtn) cancelBtn.onclick = () => setEditMode(false);
        if (saveBtn) {
            saveBtn.onclick = async () => {
                const editor = document.getElementById('voice-call-detail-editor');
                if (!editor) return;

                const previousMessages = Array.isArray(msg.callMessages) ? msg.callMessages : [];
                const nextMessages = parseCallMessagesFromEdit(editor.value, previousMessages, detailFriend);
                const nextContextText = buildCallRecordContextText(
                    nextMessages,
                    detailFriend,
                    msg.duration || 0,
                    msg.statusText || '通话记录'
                );
                msg.callMessages = nextMessages;
                msg.content = nextContextText;
                msg.text = nextContextText;
                msg.updatedAt = new Date().toISOString();

                let saved = true;
                if (detailFriend?.id && window.imApp?.updateFriendMessage) {
                    saved = await window.imApp.updateFriendMessage(detailFriend.id, {
                        id: msg.id || null,
                        timestamp: msg.timestamp || null
                    }, (targetMsg) => {
                        targetMsg.callMessages = nextMessages;
                        targetMsg.content = nextContextText;
                        targetMsg.text = nextContextText;
                        targetMsg.updatedAt = msg.updatedAt;
                    }, { silent: true });

                    if (!saved && window.showToast) {
                        window.showToast('通话记录保存失败');
                    }
                }

                const page = detailFriend?.id ? document.getElementById(`chat-interface-${detailFriend.id}`) : null;
                const msgContainer = page ? page.querySelector('.ins-chat-messages') : null;
                if (msgContainer && window.imChat.rerenderChatContainer) {
                    const latestFriend = (window.imData?.friends || []).find(item => String(item.id) === String(detailFriend.id)) || detailFriend;
                    window.imChat.rerenderChatContainer(latestFriend, msgContainer, { scroll: false });
                }

                if (saved && window.showToast) window.showToast('通话上下文已更新');
                setEditMode(false);
            };
        }

        setEditMode(false);

        if (window.openView) {
            window.openView(detailModal);
        } else {
            detailModal.style.display = 'flex';
        }
    };
})();

