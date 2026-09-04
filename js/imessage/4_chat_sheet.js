

// ==========================================
// IMESSAGE: 4_chat_sheet.js
// ==========================================
(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    const { apiConfig, userState } = window;
    window.imChat = window.imChat || {};
    const imChat = window.imChat;
    const offlineRegexEngine = window.imOfflineRegex;
    const offlineReasoning = window.imOfflineReasoning;
    const OFFLINE_MAX_RESPONSE_TOKENS = 30000;
    const OFFLINE_STREAM_RENDER_INTERVAL = 80;
    const OFFLINE_COT_PROMPT_IDS = new Set([
        'cot_before',
        'cot_scene_planning',
        'cot_literary_guidance',
        'cot_language_check',
        'cot_read_previous_recap_haru',
        'cot_output_audit',
        'cot_after'
    ]);
    const OFFLINE_CHAT_HISTORY_PROMPT_ID = 'chat_history';
    const OFFLINE_SUMMARY_MESSAGE_TYPE = 'offline_summary';
    const OFFLINE_AUTO_IMAGE_MESSAGE_TYPE = 'offline_generated_image';
    const OFFLINE_AUTO_IMAGE_MARKER = '【线下生图】';
    const OFFLINE_CHAT_PROMPT_ORDER = [
        'role_identity',
        'data_zone',
        'memory_system',
        OFFLINE_CHAT_HISTORY_PROMPT_ID,
        'task_instruction',
        'length_words',
        'nsfw',
        'bilingual_dialogue',
        'perspective_first',
        'perspective_second',
        'perspective_third',
        'style_creative_guidance',
        'style_baimiao',
        'style_green_apple',
        'barrage_comments',
        'offline_recap_haru',
        'format_rules',
        'player_choices',
        'cot_before',
        'cot_scene_planning',
        'cot_literary_guidance',
        'cot_language_check',
        'cot_read_previous_recap_haru',
        'cot_output_audit',
        'cot_after'
    ];

async function commitSheetFriendChange(friendOrId, mutator, options = {}) {
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

    function getOfflineBoundAccountForFriend(friend) {
        const latestFriend = friend?.id != null ? (window.imApp?.getFriendById?.(friend.id) || friend) : friend;
        if (!latestFriend || latestFriend.type === 'group' || !latestFriend.boundAccountId) return null;
        if (window.imApp?.getBoundAccountByFriend) {
            return window.imApp.getBoundAccountByFriend(latestFriend);
        }
        const accounts = typeof window.getAccounts === 'function' ? window.getAccounts() : [];
        return accounts.find(account => String(account?.id) === String(latestFriend.boundAccountId)) || null;
    }

    function getOfflineEffectiveUserProfile(friend, currentUserState = null) {
        const fallback = currentUserState || (window.getUserState ? window.getUserState() : (window.userState || userState || {}));
        const boundAccount = getOfflineBoundAccountForFriend(friend);
        const source = boundAccount || fallback || {};
        return {
            name: String(source.name || source.realName || source.nickname || 'User').trim() || 'User',
            avatarUrl: source.avatarUrl || source.avatar || '',
            signature: String(source.signature || '').trim(),
            persona: String(source.persona || '').trim(),
            boundAccountId: boundAccount?.id ?? null
        };
    }

    function refreshOfflineUserIdentity(friendOrId) {
        const requestedId = typeof friendOrId === 'object' && friendOrId !== null ? friendOrId.id : friendOrId;
        const activeFriend = window.imData?.currentActiveFriend;
        if (!activeFriend || activeFriend.type === 'group' || String(activeFriend.id) !== String(requestedId)) return false;
        const friend = window.imApp?.getFriendById?.(requestedId) || activeFriend;
        const profile = getOfflineEffectiveUserProfile(friend);
        const contentArea = document.getElementById('offline-chat-content');
        if (!contentArea) return false;

        contentArea.querySelectorAll('.offline-chat-bubble.user').forEach((bubble) => {
            const nameEl = bubble.querySelector('.offline-chat-name');
            if (nameEl) nameEl.textContent = profile.name;

            const avatarEl = bubble.querySelector('.offline-chat-avatar');
            if (avatarEl) {
                avatarEl.replaceChildren();
                if (profile.avatarUrl) {
                    const img = document.createElement('img');
                    img.src = profile.avatarUrl;
                    img.alt = 'avatar';
                    avatarEl.appendChild(img);
                } else {
                    const icon = document.createElement('i');
                    icon.className = 'fas fa-user';
                    avatarEl.appendChild(icon);
                }
            }

            const header = bubble.querySelector('.offline-chat-bubble-header');
            let signEl = bubble.querySelector('.offline-chat-sign');
            if (!profile.signature) {
                signEl?.remove();
            } else if (signEl) {
                signEl.textContent = profile.signature;
            } else if (header) {
                signEl = document.createElement('div');
                signEl.className = 'offline-chat-sign';
                signEl.textContent = profile.signature;
                const nameContainer = header.querySelector('.offline-chat-name-container');
                header.insertBefore(signEl, nameContainer?.nextSibling || header.firstChild);
            }
        });
        return true;
    }

    imChat.refreshOfflineUserIdentity = refreshOfflineUserIdentity;

function getChatImagePlaceholderUrl() {
        return window.imChat.CHAT_IMAGE_PLACEHOLDER_URL || 'assets/imessage/chat-image-placeholder-512.jpg';
    }

function resolveChatCompletionsEndpoint(config) {
        const endpoint = String(config?.endpoint || '').trim();
        return endpoint ? window.u2Api.resolveChatCompletionsEndpoint(endpoint) : '';
    }

function getVisionResponseContent(data) {
        const firstChoice = Array.isArray(data?.choices) ? data.choices[0] : null;
        return firstChoice?.message?.content || firstChoice?.text || firstChoice?.delta?.content || '';
    }

async function identifyChatImage(imageUrl) {
        const currentApiConfig = window.apiConfig || apiConfig || {};
        const endpoint = resolveChatCompletionsEndpoint(currentApiConfig);
        if (!endpoint || !currentApiConfig.apiKey || !currentApiConfig.model) {
            throw new Error('请先在 API 配置中填写可识图的接口、密钥和模型');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentApiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: currentApiConfig.model || '',
                    temperature: parseFloat(currentApiConfig.temperature) || 0.3,
                    messages: [
                        {
                            role: 'system',
                            content: '你是图片识别助手。只输出一段简洁中文图片描述，包含主体、场景、明显文字和情绪氛围，不要解释过程。'
                        },
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: '请识别这张图片，输出可供聊天 AI 理解的中文描述。' },
                                { type: 'image_url', image_url: { url: imageUrl } }
                            ]
                        }
                    ]
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                let errorText = `${response.status} ${response.statusText}`;
                try {
                    errorText = JSON.stringify(await response.json());
                } catch (_) {}
                throw new Error(errorText);
            }

            const data = await response.json();
            const content = String(getVisionResponseContent(data) || '').trim();
            if (!content) throw new Error('Vision API returned empty content');
            return content;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async function generateImagePromptFromChatContext(friend) {
        const currentApiConfig = window.getApiConfig ? window.getApiConfig() : (window.apiConfig || apiConfig || {});
        const endpoint = resolveChatCompletionsEndpoint(currentApiConfig);
        if (!endpoint || !currentApiConfig.apiKey || !currentApiConfig.model) {
            throw new Error('请先完成 API 配置，再根据剧情生成提示词');
        }
        if (window.imApp?.ensureFriendMessagesLoaded) await window.imApp.ensureFriendMessagesLoaded(friend);
        const latestFriend = window.imApp?.getFriendById?.(friend.id) || friend;
        const charName = latestFriend.nickname || latestFriend.realName || 'Char';
        const currentUser = window.getUserState?.() || window.userState || {};
        const userName = currentUser.name || 'User';
        const context = (Array.isArray(latestFriend.messages) ? latestFriend.messages : [])
            .filter(message => message && (message.role === 'user' || message.role === 'assistant'))
            .slice(-30)
            .map(message => {
                const speaker = message.role === 'user' ? userName : (message.speaker || message.senderName || charName);
                const content = message.type === 'image'
                    ? `[图片：${message.description || message.text || '无描述'}]`
                    : String(message.content || message.text || '').trim();
                return content ? `${speaker}：${content}` : '';
            })
            .filter(Boolean)
            .join('\n')
            .slice(-12000);
        if (!context) throw new Error('当前聊天还没有可用于生成画面的剧情');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        try {
            const headers = window.u2Api?.buildApiHeaders
                ? window.u2Api.buildApiHeaders(currentApiConfig, { 'X-U2-Silent-Errors': '1' })
                : {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentApiConfig.apiKey}`,
                    'X-U2-Silent-Errors': '1'
                };
            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: currentApiConfig.model,
                    temperature: 0.6,
                    messages: [
                        {
                            role: 'system',
                            content: '你是剧情画面提炼助手。根据最近聊天选择最适合视觉化的当前剧情瞬间，输出一段可直接用于图片生成的中文提示词。写清人物、动作、场景、构图、光线、氛围，不要解释，不要标题，不要添加负面提示词。'
                        },
                        {
                            role: 'user',
                            content: `Char 名称：${charName}\nUser 名称：${userName}\n最近剧情：\n${context}`
                        }
                    ]
                }),
                signal: controller.signal
            });
            if (!response.ok) throw new Error(`剧情提示词生成失败（HTTP ${response.status}）`);
            const data = await response.json();
            const rawContent = getVisionResponseContent(data);
            const content = Array.isArray(rawContent)
                ? rawContent.map(item => item?.text || '').join('')
                : String(rawContent || '');
            const prompt = content.replace(/^```(?:text)?\s*|\s*```$/gi, '').trim();
            if (!prompt) throw new Error('API 没有返回剧情生图提示词');
            return prompt;
        } catch (error) {
            if (error?.name === 'AbortError') throw new Error('剧情提示词生成超时，请稍后重试');
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    const isOfflineAutoImageMessage = (message) => message?.type === OFFLINE_AUTO_IMAGE_MESSAGE_TYPE;

    const shouldAutoGenerateOfflineImage = (friend) => !!friend
        && friend.type === 'char'
        && friend.offlineAutoImageGeneration === true;

    const splitOfflineAutoImageMarker = (value) => {
        const source = String(value || '');
        const markerIndex = source.lastIndexOf(OFFLINE_AUTO_IMAGE_MARKER);
        if (markerIndex < 0) return { content: source.trim(), scene: '' };
        const before = source.slice(0, markerIndex).trimEnd();
        const after = source.slice(markerIndex + OFFLINE_AUTO_IMAGE_MARKER.length).trim();
        const lineBreakIndex = after.search(/[\r\n]/);
        const scene = (lineBreakIndex < 0 ? after : after.slice(0, lineBreakIndex)).trim().slice(0, 4000);
        const trailingText = lineBreakIndex < 0 ? '' : after.slice(lineBreakIndex).trim();
        return {
            content: [before, trailingText].filter(Boolean).join('\n\n').trim(),
            scene
        };
    };

    const buildOfflineAutoImagePrompt = (scene, promptConfig, recentContext) => {
        const visualScene = String(scene || '').trim();
        const context = String(recentContext || '').trim().slice(-2400);
        const basePrompt = String(promptConfig?.lastPrompt || '').trim();
        return [
            visualScene,
            context ? `最近线上与线下剧情上下文（用于保持剧情连续）：\n${context}` : '',
            basePrompt ? `当前单聊生图预设基础提示词：\n${basePrompt}` : ''
        ].filter(Boolean).join('\n\n').trim();
    };

    const buildOfflineAutoImageRequirement = () => `<offline_auto_image_rule>
Only when the current offline story reaches a moment that is genuinely worth visualizing, append exactly one final line in this exact format:
${OFFLINE_AUTO_IMAGE_MARKER} concise Chinese image scene prompt
The prompt must describe the same current moment with characters, action, setting, composition, light, and atmosphere. Do not use this marker for ordinary dialogue or routine transitions. If no visual image is needed, do not output the marker at all. The marker line is frontend-only and must be the final line after all prose, barrage, choices, and recap content.
</offline_auto_image_rule>`;

function createAttachmentSheet(page) {
        if (window.imData.attachmentSheet) {
            // Ensure it's appended to the correct page if switching chats
            if (window.imData.attachmentSheet.parentNode !== page) {
                page.appendChild(window.imData.attachmentSheet);
            }
            return window.imData.attachmentSheet;
        }
        
        const attachmentSheet = document.createElement('div');
        attachmentSheet.id = 'chat-attachment-sheet';
        window.imData.attachmentSheet = attachmentSheet;
        attachmentSheet.style.position = 'absolute';
        attachmentSheet.style.inset = '0';
        attachmentSheet.style.zIndex = '45';
        attachmentSheet.style.display = 'none';
        attachmentSheet.style.flexDirection = 'column';
        attachmentSheet.style.justifyContent = 'flex-end';
        attachmentSheet.style.overflow = 'hidden';

        attachmentSheet.innerHTML = `
            <div class="sheet-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.4); opacity: 0; transition: opacity 0.3s;"></div>
            <div class="sheet-content" style="position: relative; height: 50%; width: 100%; background: #fff; border-radius: 24px 24px 0 0; display: flex; flex-direction: column; overflow: hidden; transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1); ">
                <!-- Header -->
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: rgba(255,255,255,0.95);   z-index: 10;">
                    <div class="close-sheet-btn" style="width: 32px; height: 32px; background: #f2f2f7; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; cursor: pointer; color: #000;"><i class="fas fa-times"></i></div>
                    <div style="font-weight: 600; font-size: 18px; color: #000;">Recents <i class="fas fa-chevron-down" style="font-size: 12px; color: #8e8e93; margin-left: 4px;"></i></div>
                    <div style="width: 32px;"></div>
                </div>
                
                <!-- Views Container -->
                <div style="flex: 1; position: relative; overflow: hidden; background: #fff;">
                    <!-- Gallery View -->
                    <div class="sheet-view view-gallery" style="position: absolute; inset: 0; overflow-y: auto; padding: 14px 16px 120px; display: flex; flex-direction: column; gap: 10px; align-items: stretch; scrollbar-width: none;">
                        <div class="grid-item album-image-entry" style="min-height: 68px; box-sizing: border-box; background: #f7f7fa; border-radius: 16px; border: 1px solid #ececf1; display: flex; align-items: center; gap: 13px; padding: 12px 14px; cursor: pointer;">
                            <div style="width: 42px; height: 42px; border-radius: 13px; background: rgba(52,199,89,0.12); display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><i class="fas fa-images" style="font-size: 20px; color: #34c759;"></i></div>
                            <div style="display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1;"><span style="font-size: 15px; color: #111; font-weight: 750;">相册图片</span><span style="font-size: 12px; color: #8e8e93;">上传图片或自定义图片内容</span></div>
                            <i class="fas fa-chevron-right" style="font-size: 13px; color: #c7c7cc; flex-shrink: 0;"></i>
                        </div>
                        <div class="grid-item generated-image-entry" style="min-height: 68px; box-sizing: border-box; background: #f7f7fa; border-radius: 16px; border: 1px solid #ececf1; display: flex; align-items: center; gap: 13px; padding: 12px 14px; cursor: pointer;">
                            <div style="width: 42px; height: 42px; border-radius: 13px; background: rgba(175,82,222,0.12); display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><i class="fas fa-wand-magic-sparkles" style="font-size: 20px; color: #af52de;"></i></div>
                            <div style="display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1;"><span style="font-size: 15px; color: #111; font-weight: 750;">生成图片</span><span style="font-size: 12px; color: #8e8e93;">输入提示词生成</span></div>
                            <i class="fas fa-chevron-right" style="font-size: 13px; color: #c7c7cc; flex-shrink: 0;"></i>
                        </div>
                    </div>

                    <!-- Linked Friends View -->
                    <div class="sheet-view view-file" style="position: absolute; inset: 0; display: none; background: #fff; padding: 14px 14px 112px; box-sizing: border-box; overflow-y: auto; -webkit-overflow-scrolling: touch;">
                        <div class="linked-accounts-panel" style="width: 100%; display: flex; flex-direction: column; gap: 12px;">
                            <div class="linked-accounts-empty" style="display:none; text-align:center; color:#8e8e93; font-size:13px; line-height:1.45; padding:42px 18px;"></div>
                            <div class="linked-accounts-controls" style="display:flex; flex-direction:column; gap:10px;">
                                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; border-radius:18px; background:#f7f7fa;">
                                    <div style="min-width:0;">
                                        <div style="font-size:15px; font-weight:800; color:#111;">是否开启关联好友</div>
                                        <div class="linked-accounts-status" style="font-size:12px; color:#8e8e93; margin-top:2px;">开启后会自动生成好友会话</div>
                                    </div>
                                    <label class="toggle-switch" style="flex-shrink:0;">
                                        <input type="checkbox" class="linked-accounts-toggle">
                                        <span class="slider"></span>
                                    </label>
                                </div>
                                <div class="linked-accounts-interval-row" style="display:none; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; border-radius:18px; background:#f7f7fa;">
                                    <div>
                                        <div style="font-size:15px; font-weight:700; color:#111;">多少秒自动调用一次 API</div>
                                        <div style="font-size:12px; color:#8e8e93; margin-top:2px;">开启后按此间隔自动生成消息</div>
                                    </div>
                                    <input type="number" class="linked-accounts-interval-input" min="5" step="1" value="60" style="width:82px; height:34px; border:1px solid #e5e5ea; border-radius:12px; background:#fff; color:#111; font-size:15px; text-align:center; outline:none;">
                                </div>
                            </div>
                            <div class="linked-accounts-list" style="display:flex; flex-direction:column; gap:10px;"></div>
                        </div>
                    </div>

                    <!-- Location View Placeholder -->
                    <div class="sheet-view view-location" style="position: absolute; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center; background: #fff; padding-bottom: 60px;">
                        <i class="fas fa-map-marked-alt" style="font-size: 64px; color: #c7c7cc; margin-bottom: 16px;"></i>
                        <div style="font-size: 16px; color: #8e8e93; font-weight: 500;">Location Picker</div>
                        <div style="font-size: 13px; color: #aeaeb2; margin-top: 4px;">Coming soon</div>
                    </div>

                    <!-- Stickers View -->
                    <div class="sheet-view view-stickers" style="position: absolute; inset: 0; display: none; flex-direction: column; background: #fff; padding: 12px 0 112px; overflow: hidden;">
                        <div class="sheet-sticker-category-tabs"></div>
                        <div class="sheet-stickers-list"></div>
                    </div>

                    <!-- More View -->
                    <div class="sheet-view view-more" style="position: absolute; inset: 0; display: none; flex-direction: column; align-items: flex-start; justify-content: flex-start; background: #fff; padding: 20px 18px 120px; gap: 14px;">
                        <div class="attachment-more-icon-grid">
                            <div class="attachment-more-regenerate-entry">
                                <div class="attachment-more-regenerate-icon">
                                    <i class="fas fa-rotate-left"></i>
                                </div>
                                <div class="attachment-more-regenerate-label">重回</div>
                            </div>
                            <div class="attachment-more-pay-entry">
                                <div class="attachment-more-pay-icon">
                                    <i class="fas fa-wallet"></i>
                                </div>
                                <div class="attachment-more-pay-label">Pay</div>
                            </div>
                            <div class="attachment-more-link-entry">
                                <div class="attachment-more-link-icon">
                                    <i class="fas fa-link"></i>
                                </div>
                                <div class="attachment-more-link-label">链接</div>
                            </div>
                            <div class="attachment-more-voice-entry">
                                <div class="attachment-more-voice-icon">
                                    <i class="fas fa-microphone-alt"></i>
                                </div>
                                <div class="attachment-more-voice-label">Voice</div>
                            </div>
                            <div class="attachment-more-listen-entry" style="display:none;">
                                <div class="attachment-more-listen-icon">
                                    <i class="fas fa-headphones"></i>
                                </div>
                                <div class="attachment-more-listen-label">一起听</div>
                            </div>
                            <div class="attachment-more-offline-entry" id="open-offline-chats-btn">
                                <div class="attachment-more-offline-icon">
                                    <i class="fas fa-people-arrows"></i>
                                </div>
                                <div class="attachment-more-offline-label">线下</div>
                            </div>
                            <div class="attachment-more-narration-entry">
                                <div class="attachment-more-narration-icon">
                                    <i class="fas fa-quote-left"></i>
                                </div>
                                <div class="attachment-more-narration-label">旁白</div>
                            </div>
                            <div class="attachment-more-dynamic-action-entry">
                                <div class="attachment-more-dynamic-action-icon">
                                    <i class="fas fa-running"></i>
                                </div>
                                <div class="attachment-more-dynamic-action-label">动描</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Bottom Tabs (Floating Pill, Left Aligned, Tap to Select) -->
                <div class="sheet-tabs-container" style="position: absolute; bottom: 16px; left: 20px; right: 20px; border-radius: 40px; display: flex; padding: 10px 16px; overflow-x: auto; background: rgba(250, 250, 250, 0.75);    scrollbar-width: none; gap: 24px; align-items: center; justify-content: flex-start;">
                    <style>
                        #chat-attachment-sheet ::-webkit-scrollbar { display: none; }

                        .attachment-more-pay-entry,
                        .attachment-more-link-entry,
                        .attachment-more-voice-entry,
                        .attachment-more-listen-entry,
                        .attachment-more-narration-entry,
                        .attachment-more-dynamic-action-entry,
                        .attachment-more-offline-entry {
                            cursor: pointer;
                            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s;
                        }
                        .attachment-more-regenerate-entry {
                            cursor: pointer;
                            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s;
                        }
                        .attachment-more-pay-entry:active,
                        .attachment-more-link-entry:active,
                        .attachment-more-voice-entry:active,
                        .attachment-more-listen-entry:active,
                        .attachment-more-narration-entry:active,
                        .attachment-more-dynamic-action-entry:active,
                        .attachment-more-offline-entry:active {
                            transform: scale(0.85);
                            opacity: 0.7;
                        }
                        .attachment-more-regenerate-entry:active {
                            transform: scale(0.85);
                            opacity: 0.7;
                        }

                        .sheet-tab-item {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            gap: 3px;
                            min-width: 44px;
                            cursor: pointer;
                            transition: transform 0.2s, opacity 0.2s;
                            flex-shrink: 0;
                        }
                        .sheet-tab-icon {
                            font-size: 24px;
                            color: #8e8e93;
                            transition: color 0.2s, transform 0.2s;
                        }
                        .sheet-tab-text {
                            font-size: 10px;
                            color: #8e8e93;
                            font-weight: 500;
                            transition: color 0.2s;
                        }
                        .sheet-tab-item.active .sheet-tab-icon {
                            color: #007aff;
                            transform: scale(1.1);
                        }
                        .sheet-tab-item.active .sheet-tab-text {
                            color: #007aff;
                            font-weight: 600;
                        }
                        .sheet-stickers-list {
                            width: 100%;
                            flex: 1;
                            min-height: 0;
                            overflow-y: auto;
                            padding: 12px 14px 0;
                            box-sizing: border-box;
                        }
                        .sheet-sticker-category-tabs {
                            width: 100%;
                            display: flex;
                            gap: 8px;
                            overflow-x: auto;
                            padding: 0 14px 10px;
                            box-sizing: border-box;
                            border-bottom: 1px solid #f2f2f7;
                            flex-shrink: 0;
                        }
                        .sheet-sticker-category-tab {
                            height: 32px;
                            border: none;
                            border-radius: 999px;
                            background: #f7f7fa;
                            color: #636366;
                            padding: 0 13px;
                            font-size: 13px;
                            font-weight: 700;
                            white-space: nowrap;
                            cursor: pointer;
                            flex-shrink: 0;
                        }
                        .sheet-sticker-category-tab.active {
                            background: #111;
                            color: #fff;
                        }
                        .sheet-sticker-grid {
                            display: grid;
                            grid-template-columns: repeat(4, minmax(0, 1fr));
                            gap: 10px;
                        }
                        .sheet-sticker-item {
                            border: none;
                            border-radius: 14px;
                            background: #f7f7fa;
                            padding: 7px;
                            cursor: pointer;
                            overflow: hidden;
                            min-width: 0;
                            display: flex;
                            flex-direction: column;
                            gap: 5px;
                            align-items: stretch;
                        }
                        .sheet-sticker-item img {
                            width: 100%;
                            aspect-ratio: 1;
                            object-fit: contain;
                            display: block;
                            min-height: 0;
                        }
                        .sheet-sticker-name {
                            display: block;
                            min-width: 0;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                            color: #3a3a3c;
                            font-size: 11px;
                            line-height: 1.2;
                            text-align: center;
                        }
                    </style>
                    
                    <div class="sheet-tab-item active" data-tab="gallery">
                        <i class="fas fa-image sheet-tab-icon"></i>
                        <span class="sheet-tab-text">Gallery</span>
                    </div>
                    <div class="sheet-tab-item" data-tab="file">
                        <i class="fas fa-user-friends sheet-tab-icon"></i>
                        <span class="sheet-tab-text">Friends</span>
                    </div>
                    <div class="sheet-tab-item" data-tab="location">
                        <i class="fas fa-map-marker-alt sheet-tab-icon"></i>
                        <span class="sheet-tab-text">Location</span>
                    </div>
                    <div class="sheet-tab-item" data-tab="stickers">
                        <i class="fas fa-smile sheet-tab-icon"></i>
                        <span class="sheet-tab-text">Stickers</span>
                    </div>
                    <div class="sheet-tab-item" data-tab="more">
                        <i class="fas fa-ellipsis-h sheet-tab-icon"></i>
                        <span class="sheet-tab-text">More</span>
                    </div>
                </div>
            </div>
            
            <!-- Pay Transfer Overlay moved to attachmentSheet root so it floats centrally and isn't cropped -->
            <div class="pay-transfer-form-overlay" style="position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,0.18); z-index: 20; padding: 20px;">
                <div class="pay-transfer-form-card" style="width: 100%; max-width: 348px; border-radius: 30px; background: rgba(255,255,255,0.98);  padding: 18px 16px 16px; box-sizing: border-box;  ">
                    <div class="pay-transfer-form-title" style="font-size: 18px; font-weight: 800; color: #111; text-align: center; margin-bottom: 10px;">Pay</div>
                    <div class="pay-transfer-mode-tabs" style="display: flex; justify-content: center; gap: 22px; margin-bottom: 14px; border-bottom: 1px solid rgba(0,0,0,0.08);">
                        <button type="button" class="pay-mode-tab active" data-pay-mode="transfer" style="position: relative; border: none; background: none; color: #000; font-size: 15px; font-weight: 600; padding: 0 2px 10px; cursor: pointer;">转账</button>
                        <button type="button" class="pay-mode-tab" data-pay-mode="red_packet" style="position: relative; border: none; background: none; color: #8e8e93; font-size: 15px; font-weight: 600; padding: 0 2px 10px; cursor: pointer;">红包</button>
                    </div>

                    <div class="pay-mode-panel pay-mode-panel-transfer" style="display: block;">
                        <div class="pay-form-field" style="margin-bottom: 10px;">
                            <div style="font-size: 12px; color: #8e8e93; margin-bottom: 6px;">金额</div>
                            <input type="number" class="pay-transfer-amount-input" placeholder="金额，例如 88.88" min="0" step="0.01" style="width: 100%; height: 42px; border: none; border-radius: 16px; background: #f7f7fa; padding: 0 14px; box-sizing: border-box; font-size: 14px; color: #111;">
                        </div>
                        <div class="pay-form-field" style="margin-bottom: 10px;">
                            <div style="font-size: 12px; color: #8e8e93; margin-bottom: 6px;">描述</div>
                            <input type="text" class="pay-transfer-desc-input" placeholder="描述，例如 奶茶钱 / 晚餐AA" style="width: 100%; height: 42px; border: none; border-radius: 16px; background: #f7f7fa; padding: 0 14px; box-sizing: border-box; font-size: 14px; color: #111;">
                        </div>
                        <div class="pay-form-field pay-group-recipient-field" style="display: none; margin-bottom: 6px; position: relative;">
                            <div style="font-size: 12px; color: #8e8e93; margin-bottom: 8px;">转账给谁</div>
                            <button type="button" class="pay-group-recipient-trigger" style="width: 100%; height: 48px; border: none; border-radius: 16px; background: #f7f7fa; padding: 0 14px; display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                                <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                                    <div class="pay-group-recipient-avatar" style="width: 28px; height: 28px; border-radius: 50%; overflow: hidden; background: #e5e5ea; color: #8e8e93; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 12px;">
                                        <i class="fas fa-user"></i>
                                    </div>
                                    <div class="pay-group-recipient-label" style="font-size: 14px; color: #111; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">请选择群成员</div>
                                </div>
                                <i class="fas fa-chevron-down pay-group-recipient-arrow" style="font-size: 12px; color: #8e8e93;"></i>
                            </button>
                            <div class="pay-group-recipient-dropdown" style="display: none; margin-top: 8px; border-radius: 18px; background: #fff;  padding: 8px; max-height: 220px; overflow-y: auto;"></div>
                        </div>
                    </div>

                    <div class="pay-mode-panel pay-mode-panel-red-packet" style="display: none;">
                        <div class="pay-form-field" style="margin-bottom: 10px;">
                            <div style="font-size: 12px; color: #8e8e93; margin-bottom: 6px;">红包个数</div>
                            <input type="number" class="pay-red-packet-count-input" placeholder="例如 3" min="1" step="1" style="width: 100%; height: 42px; border: none; border-radius: 16px; background: #f7f7fa; padding: 0 14px; box-sizing: border-box; font-size: 14px; color: #111;">
                        </div>
                        <div class="pay-form-field" style="margin-bottom: 10px;">
                            <div style="font-size: 12px; color: #8e8e93; margin-bottom: 6px;">总金额</div>
                            <input type="number" class="pay-red-packet-amount-input" placeholder="总金额，例如 88.88" min="0" step="0.01" style="width: 100%; height: 42px; border: none; border-radius: 16px; background: #f7f7fa; padding: 0 14px; box-sizing: border-box; font-size: 14px; color: #111;">
                        </div>
                        <div class="pay-form-field" style="margin-bottom: 6px;">
                            <div style="font-size: 12px; color: #8e8e93; margin-bottom: 6px;">描述</div>
                            <input type="text" class="pay-red-packet-desc-input" placeholder="描述，例如 恭喜发财 / 今晚奶茶" style="width: 100%; height: 42px; border: none; border-radius: 16px; background: #f7f7fa; padding: 0 14px; box-sizing: border-box; font-size: 14px; color: #111;">
                        </div>
                    </div>

                    <div class="pay-transfer-form-actions" style="display: flex; gap: 4px; margin-top: 16px;">
                        <div class="pay-transfer-cancel-btn" style="flex: 1; height: 44px; border-radius: 16px; background: #f2f2f7; color: #666; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; cursor: pointer;">取消</div>
                        <div class="pay-transfer-submit-btn" style="flex: 1; height: 44px; border-radius: 16px; background: #111; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 800; cursor: pointer;">发送</div>
                    </div>
                </div>
            </div>
            <div class="voice-message-form-overlay" style="position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,0.18); z-index: 21; padding: 20px;">
                <div class="voice-message-form-card" style="width: 100%; max-width: 348px; border-radius: 30px; background: rgba(255,255,255,0.98);  padding: 18px 16px 16px; box-sizing: border-box;  ">
                    <div style="display:flex; align-items:center; justify-content:center; gap:8px; font-size:18px; font-weight:800; color:#111; text-align:center; margin-bottom:12px;">
                        <i class="fas fa-microphone-alt" style="color:#111;"></i>
                        <span>Voice</span>
                    </div>
                    <textarea class="voice-message-transcript-input" placeholder="输入语音内容..." style="width:100%; min-height:112px; max-height:180px; resize:none; border:none; outline:none; border-radius:20px; background:#f7f7fa; padding:13px 14px; box-sizing:border-box; font-size:15px; line-height:1.45; color:#111; font-family:inherit;"></textarea>
                    <div style="font-size:12px; color:#8e8e93; line-height:1.45; margin:10px 2px 0;">将以语音气泡发送，并把这段文字作为转文字内容给 AI。</div>
                    <div class="voice-message-form-actions" style="display:flex; gap:8px; margin-top:16px;">
                        <div class="voice-message-cancel-btn" style="flex:1; height:44px; border-radius:16px; background:#f2f2f7; color:#666; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:700; cursor:pointer;">取消</div>
                        <div class="voice-message-submit-btn" style="flex:1; height:44px; border-radius:16px; background:#111; color:#fff; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:800; cursor:pointer;">发送</div>
                    </div>
                </div>
            </div>
            <div class="narration-form-overlay" style="position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,0.18); z-index: 22; padding: 20px;">
                <div class="narration-form-card" style="width: 100%; max-width: 348px; border-radius: 30px; background: rgba(255,255,255,0.98); padding: 18px 16px 16px; box-sizing: border-box;">
                    <div style="display:flex; align-items:center; justify-content:center; gap:8px; font-size:18px; font-weight:800; color:#111; text-align:center; margin-bottom:12px;">
                        <i class="fas fa-quote-left" style="color:#5856d6;"></i>
                        <span>旁白</span>
                    </div>
                    <textarea class="narration-message-input" placeholder="输入旁白，例如：窗外雨声慢慢停了" style="width:100%; min-height:120px; max-height:200px; resize:none; border:none; outline:none; border-radius:20px; background:#f7f7fa; padding:13px 14px; box-sizing:border-box; font-size:15px; line-height:1.45; color:#111; font-family:inherit;"></textarea>
                    <div style="font-size:12px; color:#8e8e93; line-height:1.45; margin:10px 2px 0;">会作为居中事件进入聊天上下文，不会自动触发 AI。</div>
                    <div class="narration-form-actions" style="display:flex; gap:8px; margin-top:16px;">
                        <div class="narration-cancel-btn" style="flex:1; height:44px; border-radius:16px; background:#f2f2f7; color:#666; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:700; cursor:pointer;">取消</div>
                        <div class="narration-submit-btn" style="flex:1; height:44px; border-radius:16px; background:#111; color:#fff; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:800; cursor:pointer;">发送</div>
                    </div>
                </div>
            </div>
            <div class="regenerate-form-overlay" style="position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,0.18); z-index: 23; padding: 20px;">
                <div class="regenerate-form-card" style="width: 100%; max-width: 348px; border-radius: 30px; background: rgba(255,255,255,0.98); padding: 18px 16px 16px; box-sizing: border-box;">
                    <div style="display:flex; align-items:center; justify-content:center; gap:8px; font-size:18px; font-weight:800; color:#111; text-align:center; margin-bottom:12px;">
                        <i class="fas fa-rotate-left" style="color:#8e8e93;"></i>
                        <span>重回上一轮回复</span>
                    </div>
                    <textarea class="regenerate-requirement-input" placeholder="可以写为什么重回，或希望 TA 怎样回复。例如：角色ooc了，注意人设" style="width:100%; min-height:120px; max-height:200px; resize:none; border:none; outline:none; border-radius:20px; background:#f7f7fa; padding:13px 14px; box-sizing:border-box; font-size:15px; line-height:1.45; color:#111; font-family:inherit;"></textarea>
                    <div style="font-size:12px; color:#8e8e93; line-height:1.45; margin:10px 2px 0;">参考：按上方要求重回生成；重回：不带要求直接重回。</div>
                    <div class="regenerate-form-actions" style="display:flex; gap:8px; margin-top:16px;">
                        <div class="regenerate-reference-btn" style="flex:1; height:44px; border-radius:16px; background:#8e8e93; color:#fff; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:800; cursor:pointer;">参考</div>
                        <div class="regenerate-direct-btn" style="flex:1; height:44px; border-radius:16px; background:#111; color:#fff; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:800; cursor:pointer;">重回</div>
                    </div>
                </div>
            </div>
        `;
        page.appendChild(attachmentSheet);

        const overlay = attachmentSheet.querySelector('.sheet-overlay');
        const content = attachmentSheet.querySelector('.sheet-content');
        const closeBtn = attachmentSheet.querySelector('.close-sheet-btn');
        const tabsContainer = attachmentSheet.querySelector('.sheet-tabs-container');
        const tabItems = attachmentSheet.querySelectorAll('.sheet-tab-item');
        const payEntry = attachmentSheet.querySelector('.attachment-more-pay-entry');
        const linkEntry = attachmentSheet.querySelector('.attachment-more-link-entry');
        const regenerateEntry = attachmentSheet.querySelector('.attachment-more-regenerate-entry');
        const voiceEntry = attachmentSheet.querySelector('.attachment-more-voice-entry');
        const listenEntry = attachmentSheet.querySelector('.attachment-more-listen-entry');
        const narrationEntry = attachmentSheet.querySelector('.attachment-more-narration-entry');
        const dynamicActionEntry = attachmentSheet.querySelector('.attachment-more-dynamic-action-entry');
        const dynamicActionLabel = attachmentSheet.querySelector('.attachment-more-dynamic-action-label');
        const offlineEntry = attachmentSheet.querySelector('.attachment-more-offline-entry');
        const offlineLabel = attachmentSheet.querySelector('.attachment-more-offline-label');
        const payFormOverlay = attachmentSheet.querySelector('.pay-transfer-form-overlay');
        const voiceFormOverlay = attachmentSheet.querySelector('.voice-message-form-overlay');
        const voiceTranscriptInput = attachmentSheet.querySelector('.voice-message-transcript-input');
        const voiceCancelBtn = attachmentSheet.querySelector('.voice-message-cancel-btn');
        const voiceSubmitBtn = attachmentSheet.querySelector('.voice-message-submit-btn');
        const narrationFormOverlay = attachmentSheet.querySelector('.narration-form-overlay');
        const narrationInput = attachmentSheet.querySelector('.narration-message-input');
        const narrationCancelBtn = attachmentSheet.querySelector('.narration-cancel-btn');
        const narrationSubmitBtn = attachmentSheet.querySelector('.narration-submit-btn');
        const regenerateFormOverlay = attachmentSheet.querySelector('.regenerate-form-overlay');
        const regenerateRequirementInput = attachmentSheet.querySelector('.regenerate-requirement-input');
        const regenerateReferenceBtn = attachmentSheet.querySelector('.regenerate-reference-btn');
        const regenerateDirectBtn = attachmentSheet.querySelector('.regenerate-direct-btn');
        const stickersList = attachmentSheet.querySelector('.sheet-stickers-list');
        const stickerCategoryTabs = attachmentSheet.querySelector('.sheet-sticker-category-tabs');
        const payAmountInput = attachmentSheet.querySelector('.pay-transfer-amount-input');
        const payDescInput = attachmentSheet.querySelector('.pay-transfer-desc-input');
        const payCancelBtn = attachmentSheet.querySelector('.pay-transfer-cancel-btn');
        const paySubmitBtn = attachmentSheet.querySelector('.pay-transfer-submit-btn');
        const payModeTabs = attachmentSheet.querySelectorAll('.pay-mode-tab');
        const payTransferPanel = attachmentSheet.querySelector('.pay-mode-panel-transfer');
        const payRedPacketPanel = attachmentSheet.querySelector('.pay-mode-panel-red-packet');
        const payRecipientField = attachmentSheet.querySelector('.pay-group-recipient-field');
        const payRecipientTrigger = attachmentSheet.querySelector('.pay-group-recipient-trigger');
        const payRecipientAvatar = attachmentSheet.querySelector('.pay-group-recipient-avatar');
        const payRecipientLabel = attachmentSheet.querySelector('.pay-group-recipient-label');
        const payRecipientArrow = attachmentSheet.querySelector('.pay-group-recipient-arrow');
        const payRecipientDropdown = attachmentSheet.querySelector('.pay-group-recipient-dropdown');
        const payRedPacketCountInput = attachmentSheet.querySelector('.pay-red-packet-count-input');
        const payRedPacketAmountInput = attachmentSheet.querySelector('.pay-red-packet-amount-input');
        const payRedPacketDescInput = attachmentSheet.querySelector('.pay-red-packet-desc-input');
        const linkedAccountsEmpty = attachmentSheet.querySelector('.linked-accounts-empty');
        const linkedAccountsControls = attachmentSheet.querySelector('.linked-accounts-controls');
        const linkedAccountsToggle = attachmentSheet.querySelector('.linked-accounts-toggle');
        const linkedAccountsIntervalRow = attachmentSheet.querySelector('.linked-accounts-interval-row');
        const linkedAccountsIntervalInput = attachmentSheet.querySelector('.linked-accounts-interval-input');
        const linkedAccountsStatus = attachmentSheet.querySelector('.linked-accounts-status');
        const linkedAccountsList = attachmentSheet.querySelector('.linked-accounts-list');

        const sheetViews = attachmentSheet.querySelectorAll('.sheet-view');
        let currentPayMode = 'transfer';
        let selectedRecipientId = null;
        let activeStickerCategoryName = '';
        let linkedAccountTimer = null;
        let linkedAccountTimerFriendId = null;
        let linkedAccountTimerIntervalMs = 0;

        const escapeSheetHtml = (value) => String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        const offlineSpeechRuntimeStore = new Map();
        const offlineBarrageRuntimeStore = new Map();
        const offlineChoiceRuntimeStore = new Map();

        const parseOfflineTagAttributes = (value) => {
            const attrs = {};
            String(value || '').replace(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g, (_, key, raw, doubleValue, singleValue, bareValue) => {
                attrs[String(key || '').toLowerCase()] = doubleValue ?? singleValue ?? bareValue ?? '';
                return '';
            });
            return attrs;
        };

        const isLikelyChineseText = (value) => /[\u3400-\u9fff]/.test(String(value || ''));

        const parseOfflineBilingualDialogue = (value, language) => {
            if (window.imDataUtils?.parseBilingualDialogue) {
                return window.imDataUtils.parseBilingualDialogue(value, language);
            }
            return { original: String(value || '').trim(), translation: '' };
        };

        const getOfflineChatLanguageName = (language) => window.imDataUtils?.getChatLanguageName
            ? window.imDataUtils.getChatLanguageName(language)
            : 'Chinese';

        const wrapOfflineSpeechDisplayText = (value) => {
            const text = String(value || '').trim();
            if (!text) return '';
            if (text.startsWith('「') && text.endsWith('」')) return text;
            return `「${text}」`;
        };

        const getOfflineSpeechDisplayText = (original, translation = '') => {
            const source = String(original || '').trim();
            const translated = String(translation || '').trim();
            if (!source) return '';
            if (translated && translated !== source && !isLikelyChineseText(source)) {
                return wrapOfflineSpeechDisplayText(`${source}（${translated}）`);
            }
            return wrapOfflineSpeechDisplayText(source);
        };

        const normalizeOfflineSectionHeading = (value) => String(value || '').trim().replace(/[ \t]/g, '');

        const isOfflineSectionHeading = (line, names) => {
            const normalized = normalizeOfflineSectionHeading(line);
            return names.some(name => (
                normalized === `【${name}】` ||
                normalized === `[${name}]` ||
                normalized === `${name}:` ||
                normalized === `${name}：`
            ));
        };

        const isOfflineBarrageSectionHeading = (line) => isOfflineSectionHeading(line, ['弹幕', '弹幕评论', '观众弹幕']);
        const isOfflineChoiceSectionHeading = (line) => isOfflineSectionHeading(line, ['选项', '玩家选项', '后续选项', '可选行动', '选择']);
        const isOfflineRecapSectionHeading = (line) => isOfflineSectionHeading(line, ['回顾']);

        // Keep 【回顾】 out of the choice/barrage parsers. The original assistant
        // message still retains it for the next turn's COT prompt and context.
        const extractOfflineRecapBlock = (value) => {
            const keptLines = [];
            const recapLines = [];
            let capturing = false;
            let found = false;
            String(value || '').replace(/\r\n/g, '\n').split('\n').forEach((line) => {
                if (isOfflineRecapSectionHeading(line)) {
                    capturing = true;
                    found = true;
                    recapLines.push('【回顾】');
                    return;
                }
                if (capturing && (isOfflineBarrageSectionHeading(line) || isOfflineChoiceSectionHeading(line))) {
                    capturing = false;
                    keptLines.push(line);
                    return;
                }
                if (capturing) recapLines.push(line);
                else keptLines.push(line);
            });
            return {
                cleanText: keptLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
                recap: found ? recapLines.join('\n').replace(/\n{3,}/g, '\n\n').trim() : ''
            };
        };

        const normalizeOfflineListLine = (value) => String(value || '')
            .replace(/<[^>]+>/g, '')
            .replace(/^[\s\-*•·]+/, '')
            .replace(/^(?:\d+|[①②③④⑤⑥⑦⑧⑨]|[A-Za-z])[\).、:：-]?\s*/, '')
            .trim();

        const getOfflineBarrageRandomLikes = () => Math.floor(Math.random() * 999) + 1;

        const parseOfflineBarrageTextBlock = (value) => String(value || '')
            .split(/\r?\n/)
            .map(line => normalizeOfflineListLine(line))
            .filter(Boolean)
            .map((line, index) => {
                const match = line.match(/^([^:：|]{1,16})[:：|]\s*(.*?)\s*(?:\|\s*(\d+)\s*)?$/);
                if (match && match[2]) {
                    return {
                        name: match[1].trim() || `观众${index + 1}`,
                        text: match[2].trim(),
                        likes: getOfflineBarrageRandomLikes()
                    };
                }
                return {
                    name: `观众${index + 1}`,
                    text: line,
                    likes: getOfflineBarrageRandomLikes()
                };
            })
            .filter(item => item.text);

        const parseOfflineBarrageBlocks = (value) => {
            const barragesByParagraph = [];
            const plainBarrageSections = [];
            const cleanText = String(value || '').replace(/<barrages?\b[^>]*>([\s\S]*?)<\/barrages?>/gi, (fullMatch, body) => {
                const items = [];
                String(body || '').replace(/<barrage\b([^>]*)>([\s\S]*?)<\/barrage>/gi, (_, attrText, commentText) => {
                    const attrs = parseOfflineTagAttributes(attrText);
                    const name = String(attrs.name || attrs.user || attrs.author || '观众').trim() || '观众';
                    const text = String(commentText || attrs.text || '').replace(/<[^>]+>/g, '').trim();
                    const likes = getOfflineBarrageRandomLikes();
                    if (text) items.push({ name, text, likes });
                    return '';
                });

                if (items.length === 0) {
                    String(body || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).forEach((line) => {
                        const match = line.match(/^([^:：|]+)[:：|]\s*(.*?)\s*(?:\|\s*(\d+)\s*)?$/);
                        if (match) {
                            items.push({
                                name: match[1].trim() || '观众',
                                text: match[2].trim(),
                                likes: getOfflineBarrageRandomLikes()
                            });
                        }
                    });
                }

                barragesByParagraph.push(items);
                return '\n\n';
            });

            const keptLines = [];
            let captureBuffer = null;
            const flushPlainBarrage = () => {
                if (!captureBuffer) return;
                const items = parseOfflineBarrageTextBlock(captureBuffer.join('\n'));
                if (items.length > 0) plainBarrageSections.push(items);
                captureBuffer = null;
            };

            cleanText.split(/\r?\n/).forEach((line) => {
                if (isOfflineBarrageSectionHeading(line)) {
                    flushPlainBarrage();
                    captureBuffer = [];
                    return;
                }

                if (captureBuffer && isOfflineChoiceSectionHeading(line)) {
                    flushPlainBarrage();
                    keptLines.push(line);
                    return;
                }

                if (captureBuffer) {
                    captureBuffer.push(line);
                    return;
                }

                keptLines.push(line);
            });
            flushPlainBarrage();

            return {
                cleanText: keptLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
                barragesByParagraph,
                plainBarrageSections
            };
        };

        const normalizeOfflineChoiceText = (value) => normalizeOfflineListLine(value)
            .replace(/^(?:选项|选择|Choice)\s*\d*\s*[:：.、-]?\s*/i, '')
            .trim();

        const parseOfflineChoiceBlocks = (value) => {
            let choices = [];
            let cleanText = String(value || '').replace(/<choices?\b[^>]*>([\s\S]*?)<\/choices?>/gi, (fullMatch, body) => {
                const parsed = [];
                String(body || '').replace(/<choice\b[^>]*>([\s\S]*?)<\/choice>/gi, (_, choiceText) => {
                    const cleanChoice = normalizeOfflineChoiceText(choiceText);
                    if (cleanChoice) parsed.push(cleanChoice);
                    return '';
                });

                if (parsed.length === 0) {
                    String(body || '').split(/\r?\n/).forEach((line) => {
                        const cleanChoice = normalizeOfflineChoiceText(line);
                        if (cleanChoice) parsed.push(cleanChoice);
                    });
                }

                choices = choices.concat(parsed);
                return '\n\n';
            });

            const keptLines = [];
            const plainChoices = [];
            let captureBuffer = null;
            const flushPlainChoices = () => {
                if (!captureBuffer) return;
                captureBuffer
                    .map(line => normalizeOfflineChoiceText(line))
                    .filter(Boolean)
                    .forEach(choice => plainChoices.push(choice));
                captureBuffer = null;
            };

            cleanText.split(/\r?\n/).forEach((line) => {
                if (isOfflineChoiceSectionHeading(line)) {
                    flushPlainChoices();
                    captureBuffer = [];
                    return;
                }

                if (captureBuffer && isOfflineBarrageSectionHeading(line)) {
                    flushPlainChoices();
                    keptLines.push(line);
                    return;
                }

                if (captureBuffer) {
                    captureBuffer.push(line);
                    return;
                }

                keptLines.push(line);
            });
            flushPlainChoices();

            if (plainChoices.length > 0) {
                choices = choices.concat(plainChoices);
                cleanText = keptLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
            }

            if (choices.length === 0) {
                const fallbackMatch = cleanText.match(/(?:^|\n)\s*(?:玩家选项|可选行动|后续选项|选项|选择)\s*[:：]\s*\n([\s\S]*?)$/);
                if (fallbackMatch) {
                    const block = fallbackMatch[1] || '';
                    const parsed = block.split(/\r?\n/)
                        .map(line => normalizeOfflineChoiceText(line))
                        .filter(Boolean);
                    if (parsed.length > 0) {
                        choices = parsed;
                        cleanText = cleanText.slice(0, fallbackMatch.index).trim();
                    }
                }
            }

            if (choices.length === 0) {
                const lines = cleanText.split(/\r?\n/);
                const tail = [];
                for (let i = lines.length - 1; i >= 0 && tail.length < 5; i -= 1) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    if (/^(?:\d+|[①②③④⑤⑥⑦⑧⑨]|[A-Ca-c])[\).、:：-]\s*\S+/.test(line)) {
                        tail.unshift({ index: i, value: normalizeOfflineChoiceText(line) });
                    } else {
                        break;
                    }
                }
                if (tail.length >= 2) {
                    choices = tail.map(item => item.value).filter(Boolean);
                    const firstIndex = tail[0].index;
                    cleanText = lines.slice(0, firstIndex).join('\n').trim();
                }
            }

            return {
                cleanText,
                choices: choices.map(choice => choice.trim()).filter(Boolean).slice(0, 3)
            };
        };

        const stripOfflineDecorativeMarkup = (value) => {
            let text = String(value == null ? '' : value).replace(/\r\n/g, '\n');
            text = offlineReasoning
                ? offlineReasoning.normalizeResponse(text, '').content
                : text.replace(/<\s*think(?:ing)?\s*>[\s\S]*?<\s*\/\s*think(?:ing)?\s*>/gi, '').trim();
            const recapExtraction = extractOfflineRecapBlock(text);
            text = parseOfflineBarrageBlocks(recapExtraction.cleanText).cleanText;
            text = parseOfflineChoiceBlocks(text).cleanText;
            text = text.replace(/<speech\b([^>]*)>([\s\S]*?)<\/speech>/gi, (_, attrText, innerText) => {
                const attrs = parseOfflineTagAttributes(attrText);
                const original = attrs.original || attrs.text || String(innerText || '').trim();
                const translation = attrs.translation || attrs.zh || attrs.cn || '';
                return getOfflineSpeechDisplayText(original, translation);
            });
            text = text.replace(/<speech\b([^>]*)\/>/gi, (_, attrText) => {
                const attrs = parseOfflineTagAttributes(attrText);
                return getOfflineSpeechDisplayText(attrs.original || attrs.text || '', attrs.translation || attrs.zh || attrs.cn || '');
            });
            text = text.replace(/<\/?paragraph\b[^>]*>/gi, '\n\n');
            const plainText = text.replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();
            return [plainText, recapExtraction.recap].filter(Boolean).join('\n\n').trim();
        };

        const renderOfflinePlainTextWithFallbackSpeech = (value, speechItems, enableVoice, allowFallbackSpeech, language) => {
            const text = String(value || '');
            if (!allowFallbackSpeech) {
                return escapeSheetHtml(text).replace(/\n/g, '<br>');
            }

            const quoteRegex = /「([^」\n]{1,180})」/g;
            let html = '';
            let lastIndex = 0;
            let match = null;
            while ((match = quoteRegex.exec(text)) !== null) {
                const bilingual = parseOfflineBilingualDialogue(match[1], language);
                if (!bilingual.original) continue;
                html += escapeSheetHtml(text.slice(lastIndex, match.index)).replace(/\n/g, '<br>');
                const speechIndex = speechItems.length;
                if (enableVoice) speechItems.push(bilingual);
                const playableClass = enableVoice ? ' is-playable' : '';
                const playableAttrs = enableVoice
                    ? ` data-offline-speech-index="${speechIndex}" role="button" tabindex="0" title="播放语音" aria-label="播放这段对话" aria-busy="false"`
                    : '';
                html += `<span class="offline-chat-speech offline-chat-dialogue${playableClass}"${playableAttrs}>${escapeSheetHtml(match[0])}</span>`;
                lastIndex = match.index + match[0].length;
            }
            html += escapeSheetHtml(text.slice(lastIndex)).replace(/\n/g, '<br>');
            return html;
        };

        const renderOfflineParagraphText = (value, speechItems, enableVoice, language) => {
            const text = String(value || '');
            const speechRegex = /<speech\b([^>]*?)>([\s\S]*?)<\/speech>|<speech\b([^>]*?)\/>/gi;
            let html = '';
            let lastIndex = 0;
            let hasExplicitSpeech = false;
            let match = null;

            while ((match = speechRegex.exec(text)) !== null) {
                hasExplicitSpeech = true;
                html += renderOfflinePlainTextWithFallbackSpeech(text.slice(lastIndex, match.index), speechItems, enableVoice, false, language);
                const attrText = match[1] || match[3] || '';
                const attrs = parseOfflineTagAttributes(attrText);
                const innerText = String(match[2] || '').replace(/<[^>]+>/g, '').trim();
                const original = String(attrs.original || attrs.text || innerText || '').trim();
                const translation = String(attrs.translation || attrs.zh || attrs.cn || '').trim();
                const displayText = getOfflineSpeechDisplayText(original, translation);

                if (displayText) {
                    const speechIndex = speechItems.length;
                    speechItems.push({ original, translation });
                    const playableClass = enableVoice ? ' is-playable' : '';
                    const playableAttrs = enableVoice
                        ? ` data-offline-speech-index="${speechIndex}" role="button" tabindex="0" title="播放语音" aria-label="播放这段对话" aria-busy="false"`
                        : '';
                    html += `<span class="offline-chat-speech offline-chat-dialogue${playableClass}"${playableAttrs}>${escapeSheetHtml(displayText)}</span>`;
                }
                lastIndex = match.index + match[0].length;
            }

            html += renderOfflinePlainTextWithFallbackSpeech(text.slice(lastIndex), speechItems, enableVoice, !hasExplicitSpeech, language);
            return html;
        };

        const isTtsEnabledForFriend = (friend) => !!window.u2Tts?.resolveFriendTtsSettings?.(friend)?.enabled;

        const buildOfflineChatTextHtml = (value, options = {}) => {
            const messageId = options.messageId ? String(options.messageId) : '';
            const enableVoice = options.enableVoice !== false;
            const enableBarrage = !!options.enableBarrage;
            const enableChoices = !!options.enableChoices;
            const enableRecap = !!options.enableRecap;
            const language = options.language || 'zh';
            const text = String(value == null ? '' : value).replace(/\r\n/g, '\n').trim();
            if (!text) {
                if (messageId) {
                    offlineSpeechRuntimeStore.delete(messageId);
                    offlineBarrageRuntimeStore.delete(messageId);
                    offlineChoiceRuntimeStore.delete(messageId);
                }
                return '';
            }

            const speechItems = [];
            const recapExtraction = enableRecap
                ? extractOfflineRecapBlock(text)
                : { cleanText: text, recap: '' };
            const { cleanText, barragesByParagraph, plainBarrageSections } = parseOfflineBarrageBlocks(recapExtraction.cleanText);
            const choiceParseResult = parseOfflineChoiceBlocks(cleanText);
            const choices = choiceParseResult.choices;
            const normalizedText = choiceParseResult.cleanText
                .replace(/<paragraph\b[^>]*>/gi, '')
                .replace(/<\/paragraph>/gi, '\n\n')
                .trim();
            const paragraphs = normalizedText
                .split(/\n{2,}/)
                .map(part => part.trim())
                .filter(Boolean);
            const allBarrageItems = []
                .concat(...barragesByParagraph.map(items => Array.isArray(items) ? items : []))
                .concat(...(plainBarrageSections || []).map(items => Array.isArray(items) ? items : []))
                .filter(item => item && item.text);

            if (messageId) {
                offlineBarrageRuntimeStore.set(messageId, [allBarrageItems]);
                offlineChoiceRuntimeStore.set(messageId, choices);
            }

            const paragraphHtml = paragraphs
                .map((part, index) => {
                    const paragraphHtml = renderOfflineParagraphText(part, speechItems, enableVoice, language);
                    return `<div class="offline-chat-paragraph-wrap"><p class="offline-chat-paragraph">${paragraphHtml}</p></div>`;
                })
                .join('');
            const barrageButtonHtml = enableBarrage && allBarrageItems.length > 0
                ? `<button type="button" class="offline-chat-barrage-btn offline-chat-barrage-final-btn" data-offline-barrage-index="0" title="查看弹幕" aria-label="查看弹幕"><i class="fas fa-comment-dots"></i><span>${allBarrageItems.length}</span></button>`
                : '';
            const choiceHtml = enableChoices && choices.length > 0
                ? `<div class="offline-chat-choice-list">${choices.map((choice, index) => `<button type="button" class="offline-chat-choice-btn" data-offline-choice-index="${index}"><span class="offline-chat-choice-index">${index + 1}</span><span class="offline-chat-choice-text">${escapeSheetHtml(choice)}</span></button>`).join('')}</div>`
                : '';
            const recapHtml = recapExtraction.recap
                ? `<section class="offline-chat-recap"><div class="offline-chat-recap-title">【回顾】</div><div class="offline-chat-recap-content">${escapeSheetHtml(recapExtraction.recap.replace(/^【回顾】\s*/, '')).replace(/\n/g, '<br>')}</div></section>`
                : '';
            const html = paragraphHtml + barrageButtonHtml + choiceHtml + recapHtml;

            if (messageId) {
                offlineSpeechRuntimeStore.set(messageId, speechItems);
            }
            return html;
        };

        const OFFLINE_ACTIVE_NOTICE_KIND = 'offline_meeting_active';
        const OFFLINE_MEETING_RECORD_TYPE = 'offline_meeting_record';

        const bindOfflineChatTextControls = (bubbleDiv, message, friend, floor) => {
            if (!bubbleDiv || !message?.id) return;
            const messageId = String(message.id);

            bubbleDiv.querySelectorAll('.offline-chat-speech.is-playable').forEach((speechEl) => {
                if (speechEl.dataset.bound === 'true') return;
                speechEl.dataset.bound = 'true';

                const playSpeech = async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (speechEl.getAttribute('aria-busy') === 'true') return;
                    const speechIndex = Number(speechEl.getAttribute('data-offline-speech-index'));
                    const speeches = offlineSpeechRuntimeStore.get(messageId) || [];
                    const speech = speeches[speechIndex];
                    const originalText = String(speech?.original || '').trim();
                    if (!originalText) return;

                    if (!window.u2Tts || typeof window.u2Tts.speakTextCached !== 'function') {
                        if (window.showToast) window.showToast('TTS 不可用');
                        return;
                    }

                    speechEl.classList.add('is-loading');
                    speechEl.setAttribute('aria-busy', 'true');
                    try {
                        await window.u2Tts.speakTextCached(originalText, friend, speech);
                    } catch (error) {
                        console.error('Offline speech playback failed', error);
                        if (window.showToast) window.showToast(window.u2Tts?.getUserErrorMessage?.(error) || '语音播放失败');
                    } finally {
                        speechEl.classList.remove('is-loading');
                        speechEl.setAttribute('aria-busy', 'false');
                    }
                };

                speechEl.addEventListener('click', (event) => {
                    const selection = typeof window.getSelection === 'function' ? window.getSelection() : null;
                    if (selection && !selection.isCollapsed && selection.toString().trim()) return;
                    playSpeech(event);
                });

                speechEl.addEventListener('keydown', (event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    playSpeech(event);
                });
            });

            bubbleDiv.querySelectorAll('.offline-chat-barrage-btn').forEach((button) => {
                if (button.dataset.bound === 'true') return;
                button.dataset.bound = 'true';
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const paragraphIndex = Number(button.getAttribute('data-offline-barrage-index')) || 0;
                    openOfflineBarrageView({
                        messageId,
                        paragraphIndex,
                        floor,
                        barrages: (offlineBarrageRuntimeStore.get(messageId) || [])[paragraphIndex] || []
                    });
                });
            });

            bubbleDiv.querySelectorAll('.offline-chat-choice-btn').forEach((button) => {
                if (button.dataset.bound === 'true') return;
                button.dataset.bound = 'true';
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const choiceIndex = Number(button.getAttribute('data-offline-choice-index')) || 0;
                    const choices = offlineChoiceRuntimeStore.get(messageId) || [];
                    const choiceText = String(choices[choiceIndex] || '').trim();
                    const input = document.getElementById('offline-chat-input');
                    if (!choiceText || !input) return;
                    input.value = choiceText;
                    input.focus();
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    const view = document.getElementById('offline-chat-view');
                    const contentArea = document.getElementById('offline-chat-content');
                    if (view && contentArea) contentArea.scrollTop = contentArea.scrollHeight;
                });
            });
        };

        const isOfflineBarragePromptEnabled = (friend) => {
            const prompts = ensureGlobalOfflinePrompts(friend);
            return prompts.some(prompt => prompt.id === 'barrage_comments' && (prompt.alwaysEnabled || prompt.enabled));
        };

        const isOfflineChoicesPromptEnabled = (friend) => {
            const prompts = ensureGlobalOfflinePrompts(friend);
            return prompts.some(prompt => prompt.id === 'player_choices' && (prompt.alwaysEnabled || prompt.enabled));
        };

        const createOfflineChatId = (prefix = 'offline') => {
            if (window.imChat?.createMessageId) return window.imChat.createMessageId(prefix);
            return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        };

        const estimateOfflineTextTokens = (value) => {
            const text = stripOfflineDecorativeMarkup(value).trim();
            if (!text) return 0;
            if (typeof window.calculateTokens === 'function') {
                try {
                    return Math.max(1, Number(window.calculateTokens([{ title: '', keyword: '', content: text }])) || 0);
                } catch (error) {
                    console.warn('Offline token estimate failed', error);
                }
            }
            return Math.max(1, Math.ceil(text.length * 0.75));
        };

        const countOfflineTextCharacters = (value) => {
            const text = stripOfflineDecorativeMarkup(value).replace(/\s+/g, '');
            return text.length;
        };

        const formatOfflineBubbleTime = (timestamp) => {
            const date = new Date(Number(timestamp) || Date.now());
            const pad = (num) => String(num).padStart(2, '0');
            return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
        };

        const formatOfflineMeetingDate = (timestamp) => {
            const date = new Date(Number(timestamp) || Date.now());
            const pad = (num) => String(num).padStart(2, '0');
            return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
        };

        const isOfflineSummaryMessage = (message) => message?.type === OFFLINE_SUMMARY_MESSAGE_TYPE;

        const cloneOfflineMeetingMessages = (messages) => (Array.isArray(messages) ? messages : []).map((message, index) => {
            const isSummary = isOfflineSummaryMessage(message);
            const isAutoImage = isOfflineAutoImageMessage(message);
            const role = isSummary ? 'system' : (message?.role === 'assistant' ? 'assistant' : 'user');
            const parsed = role === 'assistant' && !isAutoImage && offlineReasoning
                ? offlineReasoning.normalizeResponse(message?.content || '', message?.reasoning || '')
                : { content: String(message?.content || ''), reasoning: '' };
            return {
                id: message?.id || createOfflineChatId(isSummary ? 'offline-summary' : (isAutoImage ? 'offline-image' : (role === 'assistant' ? 'offline-ai' : 'offline-user'))),
                role,
                type: isSummary ? OFFLINE_SUMMARY_MESSAGE_TYPE : (isAutoImage ? OFFLINE_AUTO_IMAGE_MESSAGE_TYPE : undefined),
                content: parsed.content,
                reasoning: role === 'assistant' && parsed.reasoning ? parsed.reasoning : undefined,
                timestamp: Number(message?.timestamp) || Date.now() + index,
                tokens: role === 'assistant' ? Math.max(0, Number(message?.tokens) || estimateOfflineTextTokens(parsed.content)) : undefined,
                imageUrl: isAutoImage ? String(message?.imageUrl || message?.url || '').trim() : '',
                sourceMessageId: isAutoImage ? String(message?.sourceMessageId || '').trim() : '',
                imageProvider: isAutoImage ? String(message?.imageProvider || '').trim() : '',
                imageModel: isAutoImage ? String(message?.imageModel || '').trim() : '',
                imageSize: isAutoImage ? String(message?.imageSize || '').trim() : '',
                faceReferenceUsed: isAutoImage && message?.faceReferenceUsed === true,
                updatedAt: message?.updatedAt || undefined,
                generationState: message?.generationState === 'failed' ? 'failed' : undefined,
                generationError: message?.generationState === 'failed' && message?.generationError
                    ? String(message.generationError)
                    : undefined,
                offlineRegexAppliedRevisions: offlineRegexEngine?.normalizeAppliedRevisions(message?.offlineRegexAppliedRevisions) || {},
                archivedBySummaryId: !isSummary && message?.archivedBySummaryId ? String(message.archivedBySummaryId) : '',
                sourceMessageIds: isSummary && Array.isArray(message?.sourceMessageIds)
                    ? message.sourceMessageIds.map(id => String(id || '')).filter(Boolean)
                    : [],
                sourceFloorStart: isSummary ? Math.max(1, Math.round(Number(message?.sourceFloorStart) || 1)) : 0,
                sourceFloorEnd: isSummary ? Math.max(1, Math.round(Number(message?.sourceFloorEnd) || 1)) : 0
            };
        });

        const getOfflineDialogueRows = (messages) => {
            let floor = 0;
            return (Array.isArray(messages) ? messages : []).reduce((rows, message) => {
                if (isOfflineSummaryMessage(message)
                    || isOfflineAutoImageMessage(message)
                    || (message?.role !== 'user' && message?.role !== 'assistant')) return rows;
                floor += 1;
                rows.push({ message, floor });
                return rows;
            }, []);
        };

        const getOfflineMessageFloor = (messages, messageId) => getOfflineDialogueRows(messages)
            .find(row => String(row.message?.id || '') === String(messageId || ''))?.floor || 1;

        const getOfflineUnarchivedDialogueRows = (messages) => getOfflineDialogueRows(messages)
            .filter(row => !row.message?.archivedBySummaryId);

        const getOfflineSummarySourceMessages = (messages, summaryMessage) => {
            const sourceIds = new Set((summaryMessage?.sourceMessageIds || []).map(String));
            return getOfflineDialogueRows(messages).filter(row => sourceIds.has(String(row.message?.id || '')));
        };

        const serializeOfflineMessagesForCompare = (messages) => JSON.stringify((messages || []).map(message => ({
            id: message.id,
            role: message.role,
            type: message.type || '',
            content: message.content,
            reasoning: message.reasoning || '',
            timestamp: message.timestamp,
            tokens: message.tokens || 0,
            imageUrl: message.imageUrl || '',
            sourceMessageId: message.sourceMessageId || '',
            imageProvider: message.imageProvider || '',
            imageModel: message.imageModel || '',
            imageSize: message.imageSize || '',
            faceReferenceUsed: !!message.faceReferenceUsed,
            updatedAt: message.updatedAt || '',
            generationState: message.generationState || '',
            generationError: message.generationError || '',
            offlineRegexAppliedRevisions: message.offlineRegexAppliedRevisions || {},
            archivedBySummaryId: message.archivedBySummaryId || '',
            sourceMessageIds: message.sourceMessageIds || [],
            sourceFloorStart: message.sourceFloorStart || 0,
            sourceFloorEnd: message.sourceFloorEnd || 0
        })));

        const getOfflineRegexScripts = (activeFriend) => offlineRegexEngine
            ? offlineRegexEngine.normalizeRules(activeFriend?.offlineRegexScripts)
            : [];

        const applyOfflineRegexText = (activeFriend, text, role, depth, channel) => offlineRegexEngine
            ? offlineRegexEngine.applyRules(text, {
                rules: getOfflineRegexScripts(activeFriend),
                role,
                depth,
                channel
            })
            : String(text || '');

        const applyOfflineStreamingRegexText = (activeFriend, text, role, depth) => {
            const storagePreview = applyOfflineRegexText(activeFriend, text, role, depth, 'storage');
            return applyOfflineRegexText(activeFriend, storagePreview, role, depth, 'display');
        };

        const normalizeOfflineMessagesForFriend = (activeFriend) => {
            if (!activeFriend) return [];
            const previous = Array.isArray(activeFriend.offlineMessages) ? activeFriend.offlineMessages : [];
            let normalized = cloneOfflineMeetingMessages(previous);
            if (offlineRegexEngine) {
                normalized = offlineRegexEngine.applyStorageRules(normalized, getOfflineRegexScripts(activeFriend));
            }
            if (serializeOfflineMessagesForCompare(previous) !== serializeOfflineMessagesForCompare(normalized)) {
                commitSheetFriendChange(activeFriend, (targetFriend) => {
                    targetFriend.offlineMessages = normalized;
                }, { silent: true, metaOnly: true });
            }
            return normalized;
        };

        const normalizeOfflineMeetingSessions = (activeFriend) => {
            if (!activeFriend) return [];
            const sessions = Array.isArray(activeFriend.offlineMeetingSessions) ? activeFriend.offlineMeetingSessions : [];
            const normalized = sessions.map((session, index) => {
                const messages = cloneOfflineMeetingMessages(session?.messages || []);
                const startedAt = Number(session?.startedAt) || (messages[0]?.timestamp || Date.now() + index);
                const endedAt = Number(session?.endedAt) || startedAt;
                return {
                    id: session?.id || createOfflineChatId('offline-session'),
                    startedAt,
                    endedAt,
                    messages,
                    dateText: session?.dateText || formatOfflineMeetingDate(endedAt),
                    title: session?.title || '见面记录',
                    summary: session?.summary || '',
                    rawSummary: session?.rawSummary || '',
                    updatedAt: session?.updatedAt || undefined
                };
            });
            if (JSON.stringify(sessions) !== JSON.stringify(normalized)) {
                commitSheetFriendChange(activeFriend, (targetFriend) => {
                    targetFriend.offlineMeetingSessions = normalized;
                }, { silent: true, metaOnly: true });
            }
            return normalized;
        };

        const getCurrentOnlineChatContainer = (friend) => {
            if (!friend?.id) return null;
            const page = document.getElementById(`chat-interface-${friend.id}`);
            return page ? page.querySelector('.ins-chat-messages') : null;
        };

        const rerenderOnlineChatForFriend = (friend, options = {}) => {
            const container = getCurrentOnlineChatContainer(friend);
            if (container && window.imChat?.rerenderChatContainer) {
                const latestFriend = (window.imData?.friends || []).find(item => String(item.id) === String(friend.id)) || friend;
                window.imChat.rerenderChatContainer(latestFriend, container, { scroll: options.scroll !== false });
            }
            if (window.imChat?.renderChatsList) window.imChat.renderChatsList();
        };

        const upsertOfflineMeetingActiveNotice = async (activeFriend) => {
            if (!activeFriend?.id) return false;
            if (window.imApp?.ensureFriendMessagesLoaded) {
                await window.imApp.ensureFriendMessagesLoaded(activeFriend);
            }
            if (!Array.isArray(activeFriend.messages)) activeFriend.messages = [];

            const activeNotices = activeFriend.messages.filter(message => message?.type === 'system_notice' && message.noticeKind === OFFLINE_ACTIVE_NOTICE_KIND);
            const now = Date.now();
            const sessionId = activeFriend.offlineCurrentSessionId || createOfflineChatId('offline-session');
            const baseNotice = {
                id: activeNotices[0]?.id || createOfflineChatId('notice'),
                role: 'system',
                type: 'system_notice',
                noticeKind: OFFLINE_ACTIVE_NOTICE_KIND,
                content: '见面中',
                text: '见面中',
                offlineSessionId: sessionId,
                timestamp: activeNotices[0]?.timestamp || now
            };

            if (activeNotices.length > 1 && window.imApp?.removeFriendMessages) {
                await window.imApp.removeFriendMessages(activeFriend.id, activeNotices.slice(1).map(message => ({
                    id: message.id || null,
                    timestamp: message.timestamp || null
                })), { silent: true });
            }

            let saved = true;
            if (activeNotices[0] && window.imApp?.updateFriendMessage) {
                saved = await window.imApp.updateFriendMessage(activeFriend.id, {
                    id: activeNotices[0].id || null,
                    timestamp: activeNotices[0].timestamp || null
                }, (targetMsg) => {
                    Object.assign(targetMsg, baseNotice);
                }, { silent: true });
            } else if (window.imApp?.appendFriendMessage) {
                saved = await window.imApp.appendFriendMessage(activeFriend.id, baseNotice, { silent: true });
            } else {
                saved = await commitSheetFriendChange(activeFriend, (targetFriend) => {
                    if (!Array.isArray(targetFriend.messages)) targetFriend.messages = [];
                    targetFriend.messages.push(baseNotice);
                }, { silent: true });
            }

            if (saved) rerenderOnlineChatForFriend(activeFriend, { scroll: true });
            return saved;
        };

        const removeOfflineMeetingActiveNotice = async (activeFriend) => {
            if (!activeFriend?.id) return true;
            if (window.imApp?.ensureFriendMessagesLoaded) {
                await window.imApp.ensureFriendMessagesLoaded(activeFriend);
            }
            const notices = (activeFriend.messages || []).filter(message => message?.type === 'system_notice' && message.noticeKind === OFFLINE_ACTIVE_NOTICE_KIND);
            if (notices.length === 0) return true;

            let saved = true;
            if (window.imApp?.removeFriendMessages) {
                saved = await window.imApp.removeFriendMessages(activeFriend.id, notices.map(message => ({
                    id: message.id || null,
                    timestamp: message.timestamp || null
                })), { silent: true });
            } else {
                saved = await commitSheetFriendChange(activeFriend, (targetFriend) => {
                    targetFriend.messages = (targetFriend.messages || []).filter(message => !(message?.type === 'system_notice' && message.noticeKind === OFFLINE_ACTIVE_NOTICE_KIND));
                }, { silent: true });
            }

            if (saved) rerenderOnlineChatForFriend(activeFriend, { scroll: false });
            return saved;
        };

        const isOfflineMeetingRecordForSession = (message, session) => {
            if (!message || !session || message.type !== OFFLINE_MEETING_RECORD_TYPE) return false;
            const sessionId = String(session.id || '');
            if (sessionId && String(message.offlineSessionId || '') === sessionId) return true;

            const messageTime = Number(message.timestamp) || 0;
            const endedAt = Number(session.endedAt) || 0;
            const messageTitle = String(message.title || '').trim();
            const sessionTitle = String(session.title || '').trim();
            return !!(messageTime && endedAt && Math.abs(messageTime - endedAt) <= 1000 && messageTitle && messageTitle === sessionTitle);
        };

        const buildOfflineMeetingRecordContent = (session, summary) => {
            return [
                session?.dateText || formatOfflineMeetingDate(session?.endedAt),
                session?.title || '见面记录',
                String(summary || '')
            ].filter(Boolean).join('\n\n');
        };

        const buildOfflineMeetingRawSummary = (session, summary) => {
            return [
                `标题：${session?.title || '见面记录'}`,
                `见面内容：${String(summary || '')}`
            ].join('\n');
        };

        const updateOfflineMeetingSessionSummary = async (activeFriend, session, nextSummary) => {
            if (!activeFriend?.id || !session?.id) return false;
            if (window.imApp?.ensureFriendMessagesLoaded) {
                await window.imApp.ensureFriendMessagesLoaded(activeFriend);
            }

            const sessionId = String(session.id);
            const summaryText = String(nextSummary || '').trim();
            const updatedRawSummary = buildOfflineMeetingRawSummary(session, summaryText);
            const updatedContent = buildOfflineMeetingRecordContent(session, summaryText);
            const saved = await commitSheetFriendChange(activeFriend, (targetFriend) => {
                if (!targetFriend) return;
                targetFriend.offlineMeetingSessions = (Array.isArray(targetFriend.offlineMeetingSessions) ? targetFriend.offlineMeetingSessions : []).map(item => {
                    if (String(item?.id || '') !== sessionId) return item;
                    return {
                        ...item,
                        summary: summaryText,
                        rawSummary: updatedRawSummary,
                        updatedAt: Date.now()
                    };
                });

                targetFriend.memory = window.imApp.normalizeFriendData(targetFriend).memory;
                const linkedMemory = (targetFriend.memory.shortTermEntries || []).find(entry => (
                    entry?.sourceType === 'offline_meeting'
                    && String(entry.sourceId || '') === sessionId
                ));
                if (linkedMemory) {
                    linkedMemory.title = session.title || linkedMemory.title || '线下见面';
                    linkedMemory.event = summaryText;
                }

                if (Array.isArray(targetFriend.messages)) {
                    targetFriend.messages.forEach((message) => {
                        if (!isOfflineMeetingRecordForSession(message, session)) return;
                        message.summary = summaryText;
                        message.rawSummary = updatedRawSummary;
                        message.content = updatedContent;
                        message.text = `见面记录：${session.title || '见面记录'}`;
                    });
                    if (window.imApp?.syncFriendMessageSummary) window.imApp.syncFriendMessageSummary(targetFriend);
                    if (window.imApp?.clearFriendRuntimeMessageContext) window.imApp.clearFriendRuntimeMessageContext(targetFriend);
                    if (window.imApp?.syncActiveFriendReference) window.imApp.syncActiveFriendReference(targetFriend);
                    if (window.imApp?.syncSettingsFriendReference) window.imApp.syncSettingsFriendReference(targetFriend);
                }
            }, { silent: true, includeMessages: true });

            if (!saved) return false;
            const latestFriend = (window.imData?.friends || []).find(item => String(item.id) === String(activeFriend.id)) || activeFriend;
            if (window.imData?.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(latestFriend.id)) {
                window.imData.currentActiveFriend = latestFriend;
            }
            rerenderOnlineChatForFriend(latestFriend, { scroll: false });
            return true;
        };

        const deleteOfflineMeetingSession = async (activeFriend, session) => {
            if (!activeFriend?.id || !session?.id) return false;
            if (window.imApp?.ensureFriendMessagesLoaded) {
                await window.imApp.ensureFriendMessagesLoaded(activeFriend);
            }

            const sessionId = String(session.id);
            const saved = await commitSheetFriendChange(activeFriend, (targetFriend) => {
                if (!targetFriend) return;
                targetFriend.offlineMeetingSessions = (Array.isArray(targetFriend.offlineMeetingSessions) ? targetFriend.offlineMeetingSessions : [])
                    .filter(item => String(item?.id || '') !== sessionId);
                targetFriend.memory = window.imApp.normalizeFriendData(targetFriend).memory;
                targetFriend.memory.shortTermEntries = (targetFriend.memory.shortTermEntries || []).filter(entry => !(
                    entry?.sourceType === 'offline_meeting'
                    && String(entry.sourceId || '') === sessionId
                ));

                if (Array.isArray(targetFriend.messages)) {
                    targetFriend.messages = targetFriend.messages.filter(message => !isOfflineMeetingRecordForSession(message, session));
                    if (window.imApp?.reindexFriendMessages) window.imApp.reindexFriendMessages(targetFriend);
                    if (window.imApp?.syncFriendMessageSummary) window.imApp.syncFriendMessageSummary(targetFriend);
                    if (window.imApp?.clearFriendRuntimeMessageContext) window.imApp.clearFriendRuntimeMessageContext(targetFriend);
                    if (window.imApp?.syncActiveFriendReference) window.imApp.syncActiveFriendReference(targetFriend);
                    if (window.imApp?.syncSettingsFriendReference) window.imApp.syncSettingsFriendReference(targetFriend);
                }
            }, { silent: true, includeMessages: true });

            if (!saved) return false;
            const latestFriend = (window.imData?.friends || []).find(item => String(item.id) === String(activeFriend.id)) || activeFriend;
            if (window.imData?.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(latestFriend.id)) {
                window.imData.currentActiveFriend = latestFriend;
            }
            renderOfflineHistoryList(latestFriend);
            rerenderOnlineChatForFriend(latestFriend, { scroll: false });
            return true;
        };

        const confirmDeleteOfflineMeetingSession = (activeFriend, session, button = null, options = {}) => {
            const runDelete = async () => {
                if (button) {
                    button.disabled = true;
                    button.dataset.busy = 'true';
                }
                try {
                    const saved = await deleteOfflineMeetingSession(activeFriend, session);
                    if (window.showToast) window.showToast(saved ? '见面记录已删除' : '删除见面记录失败');
                    if (saved && typeof options.onDeleted === 'function') options.onDeleted();
                } catch (error) {
                    console.error('Delete offline meeting session failed', error);
                    if (window.showToast) window.showToast('删除见面记录失败');
                } finally {
                    if (button) {
                        button.disabled = false;
                        button.dataset.busy = 'false';
                    }
                }
            };

            if (window.showCustomModal) {
                window.showCustomModal({
                    title: '删除见面记录',
                    message: '确定彻底删除这条见面记录吗？这会同时清理聊天上下文，无法恢复。',
                    confirmText: '删除',
                    isDestructive: true,
                    onConfirm: runDelete
                });
                return;
            }

            if (window.confirm('确定彻底删除这条见面记录吗？这会同时清理聊天上下文，无法恢复。')) {
                runDelete();
            }
        };

        imChat.confirmDeleteOfflineMeetingRecord = (friend, record, button = null, options = {}) => {
            const friendId = friend?.id ?? window.imData?.currentActiveFriend?.id;
            const activeFriend = friendId != null
                ? (window.imApp?.getFriendById?.(friendId)
                    || (window.imData?.friends || []).find(item => String(item?.id) === String(friendId))
                    || friend)
                : null;
            const sessionId = String(record?.offlineSessionId || '');
            const session = sessionId && Array.isArray(activeFriend?.offlineMeetingSessions)
                ? activeFriend.offlineMeetingSessions.find(item => String(item?.id || '') === sessionId)
                : null;
            if (!activeFriend || !session) {
                if (window.showToast) window.showToast('见面记录已不存在');
                return false;
            }
            confirmDeleteOfflineMeetingSession(activeFriend, session, button, options);
            return true;
        };

        const getActiveLinkedAccountsFriend = () => {
            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend || activeFriend.type === 'group' || activeFriend.type === 'official') return null;
            return activeFriend;
        };

        const formatLinkedAccountTime = (timestamp) => {
            const time = Number(timestamp) || 0;
            if (!time) return '';
            if (window.imApp?.formatTime) return window.imApp.formatTime(time);
            return new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };

        const getLinkedAccountDisplayName = (chat) => {
            if (!chat) return '关联好友';
            return chat.remark || chat.name || chat.realName || '关联好友';
        };

        const getLinkedAccountInitial = (chat) => {
            return String(getLinkedAccountDisplayName(chat)).trim().charAt(0).toUpperCase() || 'A';
        };

        const getLinkedAccountAvatarStyle = (chat, size = 42) => {
            const seed = String(chat?.avatarSeed || chat?.remark || chat?.realName || getLinkedAccountDisplayName(chat) || 'linked');
            let hash = 0;
            for (let i = 0; i < seed.length; i += 1) {
                hash = ((hash << 5) - hash) + seed.charCodeAt(i);
                hash |= 0;
            }
            const hue = Math.abs(hash) % 360;
            const hue2 = (hue + 38) % 360;
            return `width:${size}px; height:${size}px; border-radius:50%; background:linear-gradient(135deg, hsl(${hue}, 62%, 40%), hsl(${hue2}, 68%, 48%)); color:#fff; display:flex; align-items:center; justify-content:center; font-size:${Math.max(14, Math.round(size * 0.38))}px; font-weight:800; flex-shrink:0;`;
        };

        const formatLinkedAccountModalTime = (timestamp) => {
            const time = Number(timestamp) || 0;
            if (!time) return '';
            const date = new Date(time);
            return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        };

        const getLinkedAccountMessageTranslation = (message) => {
            if (!message || typeof message !== 'object') return '';
            return typeof message.translation === 'string' && message.translation.trim()
                ? message.translation.trim()
                : (typeof message.translationZh === 'string' && message.translationZh.trim()
                    ? message.translationZh.trim()
                    : (typeof message.trans === 'string' && message.trans.trim() ? message.trans.trim() : ''));
        };

        const buildLinkedAccountBubbleHtml = (message) => {
            const text = escapeSheetHtml(message?.text || '');
            const translation = getLinkedAccountMessageTranslation(message);
            if (!translation) {
                return `<div class="group-private-chat-detail-bubble"><span class="group-private-chat-detail-original">${text}</span></div>`;
            }
            return `
                <button type="button" class="group-private-chat-detail-bubble has-translation" aria-expanded="false" title="点击展开翻译">
                    <span class="group-private-chat-detail-original">${text}</span>
                    <span class="group-private-chat-detail-translation" hidden>${escapeSheetHtml(translation)}</span>
                </button>
            `;
        };

        const toggleLinkedAccountBubbleTranslation = (bubble) => {
            if (!bubble) return;
            const translation = bubble.querySelector('.group-private-chat-detail-translation');
            if (!translation) return;
            const willExpand = translation.hidden;
            translation.hidden = !willExpand;
            bubble.classList.toggle('is-expanded', willExpand);
            bubble.setAttribute('aria-expanded', willExpand ? 'true' : 'false');
            bubble.title = willExpand ? '点击收起翻译' : '点击展开翻译';
        };

        const findLinkedAccountChat = (chatId) => {
            const activeFriend = getActiveLinkedAccountsFriend();
            const chats = Array.isArray(activeFriend?.linkedAccountChats) ? activeFriend.linkedAccountChats : [];
            return chats.find(chat => String(chat.id) === String(chatId)) || null;
        };

        let linkedAccountModalOverlay = null;

        const closeLinkedAccountModal = () => {
            if (linkedAccountModalOverlay) linkedAccountModalOverlay.style.display = 'none';
        };

        const showLinkedAccountModal = (innerHtml) => {
            if (!linkedAccountModalOverlay) {
                linkedAccountModalOverlay = document.createElement('div');
                linkedAccountModalOverlay.className = 'linked-account-modal-overlay';
                linkedAccountModalOverlay.style.cssText = 'position:absolute; inset:0; z-index:30; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,0.22); padding:18px; box-sizing:border-box;';
                linkedAccountModalOverlay.addEventListener('click', (event) => {
                    const translationBubble = event.target.closest('.group-private-chat-detail-bubble.has-translation');
                    if (translationBubble) {
                        event.preventDefault();
                        event.stopPropagation();
                        toggleLinkedAccountBubbleTranslation(translationBubble);
                        return;
                    }
                    const deleteBtn = event.target.closest('.linked-account-delete-chat-btn');
                    if (deleteBtn) {
                        event.preventDefault();
                        event.stopPropagation();
                        deleteLinkedAccountChat(deleteBtn.getAttribute('data-linked-chat-id'));
                        return;
                    }
                    if (event.target === linkedAccountModalOverlay || event.target.closest('.linked-account-modal-close')) {
                        closeLinkedAccountModal();
                    }
                });
                attachmentSheet.appendChild(linkedAccountModalOverlay);
            }

            linkedAccountModalOverlay.innerHTML = innerHtml;
            linkedAccountModalOverlay.style.display = 'flex';
        };

        const openLinkedAccountChatModal = (chat) => {
            const activeFriend = getActiveLinkedAccountsFriend();
            if (!chat || !activeFriend) return;
            const displayName = getLinkedAccountDisplayName(chat);
            const realName = chat.realName || chat.name || displayName;
            const charName = activeFriend.nickname || activeFriend.realName || 'TA';
            const messages = Array.isArray(chat.messages) ? [...chat.messages].sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0)) : [];
            const bubblesHtml = messages.length > 0
                ? messages.map((message, index) => {
                    const isChar = message.role === 'char';
                    const currentName = isChar ? charName : displayName;
                    const previousRole = index > 0 ? messages[index - 1]?.role : null;
                    const isGroupStart = index === 0 || previousRole !== message?.role;
                    const currentTime = Number(message.timestamp) || 0;
                    const prevTime = index > 0 ? Number(messages[index - 1]?.timestamp) || 0 : 0;
                    const showTime = index === 0 || (currentTime && prevTime && currentTime - prevTime > 5 * 60 * 1000);
                    return `
                        ${showTime ? `<div class="group-private-chat-detail-time-chip">${escapeSheetHtml(formatLinkedAccountModalTime(currentTime))}</div>` : ''}
                        <div class="group-private-chat-detail-row${isChar ? ' is-sender' : ''}${isGroupStart ? ' is-group-start' : ''}">
                            ${isGroupStart ? `<div class="group-private-chat-detail-name">${escapeSheetHtml(currentName)}</div>` : ''}
                            ${buildLinkedAccountBubbleHtml(message)}
                        </div>
                    `;
                }).join('')
                : '<div style="text-align:center; color:#8e8e93; font-size:13px; padding:34px 0;">暂无消息</div>';

            showLinkedAccountModal(`
                <div class="group-private-chat-detail-card linked-account-chat-detail-card">
                    <div style="display:flex; align-items:center; gap:10px; padding:14px 16px; border-bottom:1px solid #f2f2f7; flex-shrink:0;">
                        <div style="${getLinkedAccountAvatarStyle(chat, 38)}">${escapeSheetHtml(getLinkedAccountInitial(chat))}</div>
                        <div style="min-width:0; flex:1;">
                            <div style="font-size:16px; font-weight:800; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeSheetHtml(displayName)}</div>
                            <div style="font-size:12px; color:#8e8e93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeSheetHtml(realName)}${chat.relationship ? ` · ${escapeSheetHtml(chat.relationship)}` : ''}</div>
                        </div>
                        <button type="button" class="linked-account-modal-close" style="width:30px; height:30px; border:none; border-radius:50%; background:#f2f2f7; color:#636366; cursor:pointer;"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="group-private-chat-detail-messages linked-account-chat-detail-messages">
                        ${bubblesHtml}
                    </div>
                </div>
            `);
        };

        const deleteLinkedAccountChat = async (chatId) => {
            const activeFriend = getActiveLinkedAccountsFriend();
            if (!activeFriend || !chatId) return false;
            const safeChatId = String(chatId);
            const saved = await commitSheetFriendChange(activeFriend.id, (targetFriend) => {
                targetFriend.linkedAccountChats = window.imApp?.normalizeLinkedAccountChats
                    ? window.imApp.normalizeLinkedAccountChats(targetFriend.linkedAccountChats)
                    : (Array.isArray(targetFriend.linkedAccountChats) ? targetFriend.linkedAccountChats : []);
                targetFriend.linkedAccountChats = targetFriend.linkedAccountChats.filter(item => String(item.id) !== safeChatId);
            }, {
                silent: true,
                metaOnly: true
            });

            if (!saved) {
                if (window.showToast) window.showToast('删除好友会话失败');
                return false;
            }

            activeFriend.linkedAccountChats = (Array.isArray(activeFriend.linkedAccountChats) ? activeFriend.linkedAccountChats : [])
                .filter(item => String(item.id) !== safeChatId);
            closeLinkedAccountModal();
            renderLinkedAccountsPanel();
            if (window.showToast) window.showToast('已删除好友会话');
            return true;
        };

        const markLinkedAccountChatRead = async (chatId) => {
            const activeFriend = getActiveLinkedAccountsFriend();
            if (!activeFriend || !chatId) return false;
            const safeChatId = String(chatId);
            let nextReadAt = 0;
            const saved = await commitSheetFriendChange(activeFriend.id, (targetFriend) => {
                targetFriend.linkedAccountChats = window.imApp?.normalizeLinkedAccountChats
                    ? window.imApp.normalizeLinkedAccountChats(targetFriend.linkedAccountChats)
                    : (Array.isArray(targetFriend.linkedAccountChats) ? targetFriend.linkedAccountChats : []);
                const targetChat = targetFriend.linkedAccountChats.find(item => String(item.id) === safeChatId);
                if (!targetChat) return;
                nextReadAt = Math.max(Number(targetChat.updatedAt) || 0, Date.now());
                targetChat.readAt = nextReadAt;
            }, {
                silent: true,
                metaOnly: true
            });

            if (!saved) return false;
            const localChat = (Array.isArray(activeFriend.linkedAccountChats) ? activeFriend.linkedAccountChats : [])
                .find(item => String(item.id) === safeChatId);
            if (localChat) localChat.readAt = nextReadAt;
            renderLinkedAccountsPanel();
            return true;
        };

        const openLinkedAccountProfileModal = (chat) => {
            if (!chat) return;
            const displayName = getLinkedAccountDisplayName(chat);
            const realName = chat.realName || chat.name || displayName;
            const rows = [
                ['真名', realName],
                ['备注', chat.remark || displayName],
                ['关系', chat.relationship || '未填写'],
                ['人设', chat.persona || '未填写']
            ];

            showLinkedAccountModal(`
                <div style="width:min(100%, 340px); max-height:74vh; background:#fff; border-radius:24px;  overflow:hidden;">
                    <div style="position:relative; padding:24px 18px 16px; display:flex; flex-direction:column; align-items:center; border-bottom:1px solid #f2f2f7;">
                        <button type="button" class="linked-account-modal-close" style="position:absolute; right:14px; top:14px; width:30px; height:30px; border:none; border-radius:50%; background:#f2f2f7; color:#636366; cursor:pointer;"><i class="fas fa-times"></i></button>
                        <div style="${getLinkedAccountAvatarStyle(chat, 72)}">${escapeSheetHtml(getLinkedAccountInitial(chat))}</div>
                        <div style="font-size:19px; font-weight:850; color:#111; margin-top:12px; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeSheetHtml(displayName)}</div>
                        <div style="font-size:12px; color:#8e8e93; margin-top:3px;">只读资料</div>
                    </div>
                    <div style="padding:10px 16px 16px; overflow-y:auto;">
                        ${rows.map(([label, value]) => `
                            <div style="display:flex; gap:12px; align-items:flex-start; padding:11px 0; border-bottom:1px solid #f2f2f7;">
                                <div style="width:48px; color:#8e8e93; font-size:13px; flex-shrink:0;">${escapeSheetHtml(label)}</div>
                                <div style="flex:1; color:#111; font-size:14px; line-height:1.42; word-break:break-word;">${escapeSheetHtml(value)}</div>
                            </div>
                        `).join('')}
                        <button type="button" class="linked-account-delete-chat-btn" data-linked-chat-id="${escapeSheetHtml(chat.id)}" style="width:100%; margin-top:14px; height:42px; border:none; border-radius:14px; background:#ff3b30; color:#fff; font-size:14px; font-weight:800; display:flex; align-items:center; justify-content:center; gap:7px; cursor:pointer;">
                            <i class="fas fa-trash-alt"></i>
                            <span>删除会话</span>
                        </button>
                    </div>
                </div>
            `);
        };

        const stopLinkedAccountTimer = () => {
            if (linkedAccountTimer) {
                clearInterval(linkedAccountTimer);
                linkedAccountTimer = null;
            }
            linkedAccountTimerFriendId = null;
            linkedAccountTimerIntervalMs = 0;
        };

        const getActiveAttachmentTab = () => {
            const activeTab = attachmentSheet.querySelector('.sheet-tab-item.active');
            return activeTab ? activeTab.getAttribute('data-tab') : '';
        };

        const syncLinkedAccountTimer = () => {
            const activeFriend = getActiveLinkedAccountsFriend();
            const bot = window.imApp?.normalizeLinkedAccountBot
                ? window.imApp.normalizeLinkedAccountBot(activeFriend?.linkedAccountBot)
                : (activeFriend?.linkedAccountBot || {});
            const shouldRun = !!activeFriend
                && attachmentSheet.style.display === 'flex'
                && getActiveAttachmentTab() === 'file'
                && !!bot.enabled;
            const nextFriendId = activeFriend ? String(activeFriend.id) : null;
            const nextIntervalMs = Math.max(5, Number(bot.intervalSeconds) || 60) * 1000;

            if (!shouldRun) {
                stopLinkedAccountTimer();
                return;
            }

            if (linkedAccountTimer && linkedAccountTimerFriendId === nextFriendId && linkedAccountTimerIntervalMs === nextIntervalMs) {
                return;
            }

            stopLinkedAccountTimer();
            linkedAccountTimerFriendId = nextFriendId;
            linkedAccountTimer = setInterval(async () => {
                const latestFriend = getActiveLinkedAccountsFriend();
                if (!latestFriend || String(latestFriend.id) !== nextFriendId || getActiveAttachmentTab() !== 'file') {
                    stopLinkedAccountTimer();
                    return;
                }
                if (window.imChat.runLinkedAccountBotNow) {
                    await window.imChat.runLinkedAccountBotNow(latestFriend, { silent: false });
                }
            }, nextIntervalMs);
            linkedAccountTimerIntervalMs = nextIntervalMs;
        };

        const renderLinkedAccountsPanel = () => {
            const activeFriend = getActiveLinkedAccountsFriend();
            if (!linkedAccountsEmpty || !linkedAccountsControls || !linkedAccountsList) return;

            if (!activeFriend) {
                linkedAccountsEmpty.style.display = 'block';
                linkedAccountsEmpty.textContent = '关联好友仅支持单聊 Char。';
                linkedAccountsControls.style.display = 'none';
                linkedAccountsList.style.display = 'none';
                stopLinkedAccountTimer();
                return;
            }

            activeFriend.linkedAccountBot = window.imApp?.normalizeLinkedAccountBot
                ? window.imApp.normalizeLinkedAccountBot(activeFriend.linkedAccountBot)
                : (activeFriend.linkedAccountBot || { enabled: false, intervalSeconds: 60, lastRunAt: 0 });
            activeFriend.linkedAccountChats = window.imApp?.normalizeLinkedAccountChats
                ? window.imApp.normalizeLinkedAccountChats(activeFriend.linkedAccountChats)
                : (Array.isArray(activeFriend.linkedAccountChats) ? activeFriend.linkedAccountChats : []);

            linkedAccountsEmpty.style.display = 'none';
            linkedAccountsControls.style.display = 'flex';
            linkedAccountsList.style.display = 'flex';
            if (linkedAccountsToggle) linkedAccountsToggle.checked = !!activeFriend.linkedAccountBot.enabled;
            if (linkedAccountsIntervalRow) linkedAccountsIntervalRow.style.display = activeFriend.linkedAccountBot.enabled ? 'flex' : 'none';
            if (linkedAccountsIntervalInput) linkedAccountsIntervalInput.value = String(activeFriend.linkedAccountBot.intervalSeconds || 60);
            if (linkedAccountsStatus) {
                linkedAccountsStatus.textContent = activeFriend.linkedAccountBot.enabled
                    ? `已开启，每 ${activeFriend.linkedAccountBot.intervalSeconds || 60} 秒自动调用一次 API`
                    : '开启后会自动生成好友会话';
            }

            const chats = [...activeFriend.linkedAccountChats].sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
            if (chats.length === 0) {
                linkedAccountsList.innerHTML = '<div style="text-align:center; color:#8e8e93; font-size:13px; line-height:1.45; padding:28px 12px;">暂无好友会话。开启后，系统会自动生成好友发来的消息。</div>';
                syncLinkedAccountTimer();
                return;
            }

            linkedAccountsList.innerHTML = chats.map(chat => {
                const messages = Array.isArray(chat.messages) ? chat.messages : [];
                const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
                const displayName = getLinkedAccountDisplayName(chat);
                const realName = chat.realName || chat.name || displayName;
                const latestText = lastMessage ? escapeSheetHtml(lastMessage.text || '') : '暂无消息';
                const speakerLabel = lastMessage && lastMessage.role === 'char' ? `${escapeSheetHtml(activeFriend.nickname || 'Char')}: ` : '';
                const unreadCount = messages.filter(message => (Number(message.timestamp) || 0) > (Number(chat.readAt) || 0)).length;
                const countText = unreadCount > 99 ? '99+' : String(unreadCount);
                const unreadBadgeHtml = unreadCount > 0
                    ? `<div style="min-width:20px; height:20px; padding:0 6px; box-sizing:border-box; border-radius:999px; background:#ff3b30; color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:850; line-height:1;">${escapeSheetHtml(countText)}</div>`
                    : '';
                return `
                    <div class="linked-account-chat-card" data-linked-chat-id="${escapeSheetHtml(chat.id)}" style="display:flex; gap:10px; align-items:center; padding:11px 12px; border-radius:18px; background:#f7f7fa; cursor:pointer;">
                        <button type="button" class="linked-account-avatar-btn" data-linked-chat-id="${escapeSheetHtml(chat.id)}" style="${getLinkedAccountAvatarStyle(chat, 42)} border:none; padding:0; cursor:pointer;">${escapeSheetHtml(getLinkedAccountInitial(chat))}</button>
                        <div style="min-width:0; flex:1;">
                            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
                                <div style="font-size:15px; font-weight:800; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeSheetHtml(displayName)}</div>
                                <div style="display:flex; align-items:center; gap:7px; flex-shrink:0;">
                                    <div style="font-size:11px; color:#8e8e93;">${escapeSheetHtml(formatLinkedAccountTime(chat.updatedAt))}</div>
                                    ${unreadBadgeHtml}
                                </div>
                            </div>
                            <div style="font-size:12px; color:#8e8e93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px;">${escapeSheetHtml(realName)}${chat.relationship ? ` · ${escapeSheetHtml(chat.relationship)}` : ''}</div>
                            <div style="font-size:13px; color:#3a3a3c; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:4px;">${speakerLabel}${latestText}</div>
                        </div>
                    </div>
                `;
            }).join('');
            syncLinkedAccountTimer();
        };

        const saveLinkedAccountBotSettings = async (patch = {}) => {
            const activeFriend = getActiveLinkedAccountsFriend();
            if (!activeFriend) return false;
            const currentBot = window.imApp?.normalizeLinkedAccountBot
                ? window.imApp.normalizeLinkedAccountBot(activeFriend.linkedAccountBot)
                : (activeFriend.linkedAccountBot || { enabled: false, intervalSeconds: 60, lastRunAt: 0 });
            const nextBot = window.imApp?.normalizeLinkedAccountBot
                ? window.imApp.normalizeLinkedAccountBot({ ...currentBot, ...patch })
                : { ...currentBot, ...patch };

            const saved = await commitSheetFriendChange(activeFriend.id, (targetFriend) => {
                targetFriend.linkedAccountBot = nextBot;
            }, {
                silent: true,
                metaOnly: true
            });

            if (!saved) {
                if (window.showToast) window.showToast('关联好友设置保存失败');
                return false;
            }

            activeFriend.linkedAccountBot = nextBot;
            renderLinkedAccountsPanel();
            return true;
        };

        const renderSheetStickers = async () => {
            if (!stickersList || !stickerCategoryTabs) return;

            stickersList.innerHTML = '<div style="text-align:center; color:#8e8e93; padding:28px 0; font-size:13px;">Loading stickers...</div>';
            stickerCategoryTabs.innerHTML = '';

            try {
                if (window.imApp?.ensureStickersReady) {
                    await window.imApp.ensureStickersReady();
                }
            } catch (error) {
                console.error('Failed to load stickers for attachment sheet', error);
            }

            const categories = (Array.isArray(window.imData?.stickers) ? window.imData.stickers : [])
                .filter(category => category && Array.isArray(category.items) && category.items.length > 0);

            if (categories.length === 0) {
                stickersList.innerHTML = '<div style="text-align:center; color:#8e8e93; padding:32px 14px; font-size:13px; line-height:1.45;">No stickers yet. Add stickers from Home first.</div>';
                return;
            }

            if (!activeStickerCategoryName || !categories.some(category => category.categoryName === activeStickerCategoryName)) {
                activeStickerCategoryName = categories[0].categoryName || '';
            }

            const renderActiveStickerGrid = (category) => {
                stickersList.innerHTML = '';
                const grid = document.createElement('div');
                grid.className = 'sheet-sticker-grid';

                const items = Array.isArray(category?.items) ? category.items : [];
                if (items.length === 0) {
                    stickersList.innerHTML = '<div style="text-align:center; color:#8e8e93; padding:32px 14px; font-size:13px;">This category is empty.</div>';
                    return;
                }

                items.forEach(sticker => {
                    if (!sticker || !sticker.url) return;
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'sheet-sticker-item';
                    button.title = sticker.name || '';
                    button.innerHTML = `<img src="${escapeSheetHtml(sticker.url)}" alt="${escapeSheetHtml(sticker.name || 'Sticker')}"><span class="sheet-sticker-name">${escapeSheetHtml(sticker.name || 'Sticker')}</span>`;
                    button.addEventListener('click', async () => {
                        closeSheet();
                        await window.imChat.sendStickerMessage({
                            category: category.categoryName || '',
                            name: sticker.name || 'Sticker',
                            url: sticker.url
                        });
                    });
                    grid.appendChild(button);
                });

                stickersList.appendChild(grid);
            };

            stickerCategoryTabs.innerHTML = '';
            categories.forEach(category => {
                const tab = document.createElement('button');
                tab.type = 'button';
                tab.className = `sheet-sticker-category-tab ${category.categoryName === activeStickerCategoryName ? 'active' : ''}`;
                tab.textContent = category.categoryName || 'Stickers';
                tab.addEventListener('click', () => {
                    activeStickerCategoryName = category.categoryName || '';
                    stickerCategoryTabs.querySelectorAll('.sheet-sticker-category-tab').forEach(item => {
                        item.classList.toggle('active', item === tab);
                    });
                    renderActiveStickerGrid(category);
                });
                stickerCategoryTabs.appendChild(tab);
            });

            const activeCategory = categories.find(category => category.categoryName === activeStickerCategoryName) || categories[0];
            renderActiveStickerGrid(activeCategory);
        };

        const syncOfflineMeetEntry = () => {
            const activeFriend = window.imData.currentActiveFriend;
            const isOffline = !!activeFriend?.offlineMeetEnabled;
            if (offlineLabel) offlineLabel.textContent = isOffline ? '退出线下' : '线下';
            if (offlineEntry) offlineEntry.classList.toggle('active', isOffline);
        };

        const syncDynamicActionEntry = () => {
            const activeFriend = window.imData.currentActiveFriend;
            const isEnabled = !!activeFriend?.dynamicActionNarrationEnabled;
            if (dynamicActionLabel) dynamicActionLabel.textContent = isEnabled ? '关闭' : '动描';
            if (dynamicActionEntry) dynamicActionEntry.classList.toggle('active', isEnabled);
        };

        const toggleDynamicActionNarration = async () => {
            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend) {
                if (window.showToast) window.showToast('当前聊天不存在');
                return;
            }

            const nextEnabled = !activeFriend.dynamicActionNarrationEnabled;
            const saved = await commitSheetFriendChange(activeFriend.id, (targetFriend) => {
                if (!targetFriend) return;
                targetFriend.dynamicActionNarrationEnabled = nextEnabled;
            }, {
                silent: true,
                metaOnly: true
            });

            if (!saved) {
                if (window.showToast) window.showToast('动描设置保存失败');
                return;
            }

            activeFriend.dynamicActionNarrationEnabled = nextEnabled;
            syncDynamicActionEntry();
            if (window.showToast) window.showToast(nextEnabled ? '动描已开启' : '动描已关闭');
        };

        window.addEventListener('u2:stickers-binding-changed', () => {
            if (attachmentSheet.style.display === 'flex') {
                const activeTab = attachmentSheet.querySelector('.sheet-tab-item.active');
                if (activeTab && activeTab.getAttribute('data-tab') === 'stickers') {
                    renderSheetStickers();
                }
            }
        });

        window.addEventListener('u2:stickers-data-changed', () => {
            if (attachmentSheet.style.display === 'flex') {
                const activeTab = attachmentSheet.querySelector('.sheet-tab-item.active');
                if (activeTab && activeTab.getAttribute('data-tab') === 'stickers') {
                    renderSheetStickers();
                }
            }
        });

        window.addEventListener('u2:linked-accounts-changed', (event) => {
            const activeFriend = getActiveLinkedAccountsFriend();
            if (!activeFriend) return;
            if (event?.detail?.friendId && String(event.detail.friendId) !== String(activeFriend.id)) return;
            if (attachmentSheet.style.display === 'flex' && getActiveAttachmentTab() === 'file') {
                renderLinkedAccountsPanel();
            }
        });

        if (linkedAccountsToggle) {
            linkedAccountsToggle.addEventListener('change', async () => {
                await saveLinkedAccountBotSettings({ enabled: linkedAccountsToggle.checked });
            });
        }

        if (linkedAccountsIntervalInput) {
            linkedAccountsIntervalInput.addEventListener('change', async () => {
                const intervalSeconds = Math.max(5, Math.round(Number(linkedAccountsIntervalInput.value) || 60));
                linkedAccountsIntervalInput.value = String(intervalSeconds);
                await saveLinkedAccountBotSettings({ intervalSeconds });
            });
        }

        if (linkedAccountsList) {
            linkedAccountsList.addEventListener('click', (event) => {
                const avatarBtn = event.target.closest('.linked-account-avatar-btn');
                if (avatarBtn) {
                    event.preventDefault();
                    event.stopPropagation();
                    const chat = findLinkedAccountChat(avatarBtn.getAttribute('data-linked-chat-id'));
                    openLinkedAccountProfileModal(chat);
                    return;
                }

                const card = event.target.closest('.linked-account-chat-card');
                if (!card) return;
                const chat = findLinkedAccountChat(card.getAttribute('data-linked-chat-id'));
                openLinkedAccountChatModal(chat);
                markLinkedAccountChatRead(card.getAttribute('data-linked-chat-id'));
            });
        }

        // Click listener to set active tab and ensure it is fully visible in the container
        tabItems.forEach(item => {
            item.addEventListener('click', () => {
                // 1. Update active tab UI
                tabItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                // 2. Scroll into view if partially hidden
                const containerRect = tabsContainer.getBoundingClientRect();
                const itemRect = item.getBoundingClientRect();
                
                if (itemRect.left < containerRect.left) {
                    tabsContainer.scrollBy({ left: itemRect.left - containerRect.left - 16, behavior: 'smooth' });
                } else if (itemRect.right > containerRect.right) {
                    tabsContainer.scrollBy({ left: itemRect.right - containerRect.right + 16, behavior: 'smooth' });
                }

                // 3. Switch View Panels
                const targetTab = item.getAttribute('data-tab');
                if (targetTab === 'more') {
                    syncOfflineMeetEntry();
                    syncDynamicActionEntry();
                }
                sheetViews.forEach(view => {
                    if (view.classList.contains(`view-${targetTab}`)) {
                        if (targetTab === 'gallery') {
                            view.style.display = 'flex';
                        } else if (targetTab === 'file') {
                            view.style.display = 'block';
                        } else {
                            view.style.display = 'flex';
                        }
                        if (targetTab === 'stickers') {
                            renderSheetStickers();
                        }
                        if (targetTab === 'file') {
                            renderLinkedAccountsPanel();
                        }
                    } else {
                        view.style.display = 'none';
                    }
                });
                if (targetTab !== 'file') {
                    stopLinkedAccountTimer();
                }
            });
        });

        const setRecipientTriggerDisplay = (member) => {
            if (payRecipientLabel) {
                payRecipientLabel.textContent = member
                    ? (member.nickname || member.realName || '群成员')
                    : '请选择群成员';
            }

            if (payRecipientAvatar) {
                if (member && member.avatarUrl) {
                    payRecipientAvatar.innerHTML = `<img src="${member.avatarUrl}" style="width:100%; height:100%; object-fit:cover; display:block;">`;
                } else if (member) {
                    payRecipientAvatar.innerHTML = `<span>${String(member.nickname || member.realName || '群').charAt(0)}</span>`;
                } else {
                    payRecipientAvatar.innerHTML = `<i class="fas fa-user"></i>`;
                }
            }
        };

        const setRecipientDropdownOpen = (isOpen) => {
            if (payRecipientDropdown) payRecipientDropdown.style.display = isOpen ? 'block' : 'none';
            if (payRecipientArrow) {
                payRecipientArrow.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
            }
        };

        const renderGroupRecipientOptions = (activeFriend) => {
            if (!payRecipientDropdown) return;

            payRecipientDropdown.innerHTML = '';
            selectedRecipientId = null;
            setRecipientTriggerDisplay(null);
            setRecipientDropdownOpen(false);

            if (!activeFriend || activeFriend.type !== 'group') return;

            const recipients = window.imChat.getAvailableGroupRecipients(activeFriend);
            recipients.forEach(member => {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'pay-group-recipient-option';
                option.setAttribute('data-member-id', member.id);
                option.style.width = '100%';
                option.style.border = 'none';
                option.style.borderRadius = '14px';
                option.style.background = 'transparent';
                option.style.padding = '10px 10px';
                option.style.display = 'flex';
                option.style.alignItems = 'center';
                option.style.justifyContent = 'space-between';
                option.style.cursor = 'pointer';

                option.innerHTML = `
                    <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                        <div style="width:30px; height:30px; border-radius:50%; overflow:hidden; background:#e5e5ea; color:#8e8e93; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:12px;">
                            ${member.avatarUrl
                                ? `<img src="${member.avatarUrl}" style="width:100%; height:100%; object-fit:cover; display:block;">`
                                : `<span>${String(member.nickname || member.realName || '群').charAt(0)}</span>`}
                        </div>
                        <div style="font-size:14px; color:#111; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${member.nickname || member.realName || '群成员'}</div>
                    </div>
                    <i class="fas fa-check" style="font-size:12px; color:transparent;"></i>
                `;

                option.addEventListener('click', () => {
                    selectedRecipientId = member.id;
                    setRecipientTriggerDisplay(member);
                    payRecipientDropdown.querySelectorAll('.pay-group-recipient-option').forEach(item => {
                        item.style.background = 'transparent';
                        const icon = item.querySelector('.fa-check');
                        if (icon) icon.style.color = 'transparent';
                    });
                    option.style.background = '#f7f7fa';
                    const icon = option.querySelector('.fa-check');
                    if (icon) icon.style.color = '#111';
                    setRecipientDropdownOpen(false);
                });

                payRecipientDropdown.appendChild(option);
            });

            if (recipients.length > 0) {
                const firstOption = payRecipientDropdown.querySelector('.pay-group-recipient-option');
                if (firstOption) firstOption.click();
            }
        };

        const syncPayModeUi = (activeFriend, nextMode = 'transfer') => {
            currentPayMode = nextMode === 'red_packet' ? 'red_packet' : 'transfer';

            payModeTabs.forEach(tab => {
                const isActive = tab.getAttribute('data-pay-mode') === currentPayMode;
                tab.classList.toggle('active', isActive);
                tab.style.color = isActive ? '#000' : '#8e8e93';
                tab.style.fontWeight = isActive ? '700' : '600';
                tab.style.boxShadow = 'none';
                tab.style.background = 'none';
                tab.style.borderRadius = '0';
                tab.style.setProperty('--tab-line-opacity', isActive ? '1' : '0');
                if (isActive) {
                    tab.style.borderBottom = '2px solid #111';
                } else {
                    tab.style.borderBottom = '2px solid transparent';
                }
            });

            if (payTransferPanel) payTransferPanel.style.display = currentPayMode === 'transfer' ? 'block' : 'none';
            if (payRedPacketPanel) payRedPacketPanel.style.display = currentPayMode === 'red_packet' ? 'block' : 'none';

            const isGroupChat = activeFriend && activeFriend.type === 'group';
            if (payRecipientField) {
                payRecipientField.style.display = isGroupChat && currentPayMode === 'transfer' ? 'block' : 'none';
            }
        };

        const closePayTransferForm = () => {
            if (!payFormOverlay) return;
            payFormOverlay.style.display = 'none';
            if (payAmountInput) payAmountInput.value = '';
            if (payDescInput) payDescInput.value = '';
            if (payRedPacketCountInput) payRedPacketCountInput.value = '';
            if (payRedPacketAmountInput) payRedPacketAmountInput.value = '';
            if (payRedPacketDescInput) payRedPacketDescInput.value = '';
            selectedRecipientId = null;
            if (payRecipientDropdown) payRecipientDropdown.innerHTML = '';
            setRecipientTriggerDisplay(null);
            setRecipientDropdownOpen(false);
            currentPayMode = 'transfer';
        };

        const closeVoiceMessageForm = () => {
            if (!voiceFormOverlay) return;
            voiceFormOverlay.style.display = 'none';
            if (voiceTranscriptInput) voiceTranscriptInput.value = '';
        };

        const closeNarrationForm = () => {
            if (!narrationFormOverlay) return;
            narrationFormOverlay.style.display = 'none';
            if (narrationInput) narrationInput.value = '';
        };

        const setRegenerateBusyState = (busy) => {
            const controls = [regenerateEntry, regenerateReferenceBtn, regenerateDirectBtn];
            controls.forEach((control) => {
                if (!control) return;
                control.dataset.busy = busy ? 'true' : 'false';
                control.style.opacity = busy ? '0.45' : '';
                control.style.pointerEvents = busy ? 'none' : '';
            });
        };

        const closeRegenerateForm = () => {
            if (!regenerateFormOverlay) return;
            regenerateFormOverlay.style.display = 'none';
            if (regenerateRequirementInput) regenerateRequirementInput.value = '';
        };

        const renderPayMethodSelection = (requiredAmount, callback) => {
            const sheet = document.getElementById('pay-method-selection-sheet');
            const listEl = document.getElementById('pay-method-selection-list');
            if (!sheet || !listEl) return false;

            const cards = typeof window.getPayCards === 'function' ? window.getPayCards() : [];
            if (cards.length === 0) {
                if (window.showToast) window.showToast('没有可用的银行卡');
                return false;
            }

            listEl.innerHTML = '';
            cards.forEach(c => {
                const el = document.createElement('div');
                el.className = 'pay-bank-card';
                // Always white card for simplicity in picker
                el.style.background = '#ffffff';
                el.style.color = '#000000';
                el.style.borderRadius = '16px';
                el.style.cursor = 'pointer';
                el.style.border = '1px solid #e5e5ea';
                el.style.boxShadow = 'none';
                el.style.height = 'auto';
                el.style.padding = '12px 16px';
                
                const isInsufficient = c.balance < requiredAmount;
                if (isInsufficient) {
                    el.style.opacity = '0.5';
                    el.style.cursor = 'not-allowed';
                }
                
                el.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; flex-direction: column;">
                            <div class="pay-bank-name" style="font-size: 15px; display: flex; align-items: center; gap: 8px;"><i class="${c.icon}"></i> ${c.name}</div>
                            <div class="pay-bank-type" style="font-size: 11px; margin-top: 4px; opacity: 0.8;">${c.cardType} - ${c.number}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 15px; font-weight: 600;">¥${c.balance.toFixed(2)}</div>
                            ${isInsufficient ? '<div style="font-size: 11px; color: #ff3b30; margin-top: 4px;">余额不足</div>' : ''}
                        </div>
                    </div>
                `;
                
                if (!isInsufficient) {
                    el.addEventListener('click', () => {
                        if (window.closeView) window.closeView(sheet);
                        else sheet.style.display = 'none';
                        
                        setTimeout(() => {
                            callback(c.id);
                        }, 300);
                    });
                }
                
                listEl.appendChild(el);
            });

            if (window.openView) window.openView(sheet);
            else sheet.style.display = 'flex';

            return true;
        };

        const openPayTransferForm = () => {
            if (!payFormOverlay) return;
            const activeFriend = window.imData.currentActiveFriend;
            const isGroupChat = activeFriend && activeFriend.type === 'group';

            // Close attachment menu overlay & content
            if (content) content.style.transform = 'translateY(100%)';
            if (overlay) overlay.style.opacity = '0';

            payFormOverlay.style.display = 'flex';
            if (payAmountInput) payAmountInput.value = '';
            if (payDescInput) payDescInput.value = '';
            if (payRedPacketCountInput) payRedPacketCountInput.value = '';
            if (payRedPacketAmountInput) payRedPacketAmountInput.value = '';
            if (payRedPacketDescInput) payRedPacketDescInput.value = '';

            if (payModeTabs.length > 0) {
                payModeTabs.forEach(tab => {
                    tab.style.display = isGroupChat ? 'inline-flex' : 'none';
                });
            }

            renderGroupRecipientOptions(activeFriend);
            syncPayModeUi(activeFriend, 'transfer');

            setTimeout(() => {
                if (payAmountInput) payAmountInput.focus();
            }, 30);
        };

        const openVoiceMessageForm = () => {
            if (!voiceFormOverlay) return;

            if (content) content.style.transform = 'translateY(100%)';
            if (overlay) overlay.style.opacity = '0';

            voiceFormOverlay.style.display = 'flex';
            if (voiceTranscriptInput) {
                voiceTranscriptInput.value = '';
                setTimeout(() => voiceTranscriptInput.focus(), 30);
            }
        };

        const openNarrationForm = () => {
            if (!narrationFormOverlay) return;

            if (content) content.style.transform = 'translateY(100%)';
            if (overlay) overlay.style.opacity = '0';

            narrationFormOverlay.style.display = 'flex';
            if (narrationInput) {
                narrationInput.value = '';
                setTimeout(() => narrationInput.focus(), 30);
            }
        };

        const openRegenerateForm = () => {
            if (!regenerateFormOverlay) return;
            if (regenerateEntry?.dataset?.busy === 'true') return;

            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend || !window.imChat.regenerateLastAiReply) {
                if (window.showToast) window.showToast('暂无可重回的回复');
                return;
            }

            if (content) content.style.transform = 'translateY(100%)';
            if (overlay) overlay.style.opacity = '0';

            regenerateFormOverlay.style.display = 'flex';
            if (regenerateRequirementInput) {
                regenerateRequirementInput.value = '';
                setTimeout(() => regenerateRequirementInput.focus(), 30);
            }
        };

        const buildOfflineThinkingHtml = (reasoning, expanded = false) => {
            const rawReasoning = String(reasoning || '').trim();
            if (!rawReasoning) return '';
            return `
                <section class="offline-chat-thinking${expanded ? ' is-expanded' : ''}" data-offline-thinking>
                    <button type="button" class="offline-chat-thinking-toggle" aria-expanded="${expanded ? 'true' : 'false'}">
                        <span class="offline-chat-thinking-label"><span>COT</span></span>
                        <i class="fas fa-chevron-down offline-chat-thinking-icon" aria-hidden="true"></i>
                    </button>
                    <div class="offline-chat-thinking-content" data-raw-thinking="${escapeSheetHtml(rawReasoning)}"${expanded ? '' : ' hidden'}>${escapeSheetHtml(rawReasoning)}</div>
                </section>
            `;
        };

        const setOfflineThinkingExpanded = (bubble, expanded) => {
            const panel = bubble?.querySelector?.('[data-offline-thinking]');
            if (!panel) return;
            const toggle = panel.querySelector('.offline-chat-thinking-toggle');
            const content = panel.querySelector('.offline-chat-thinking-content');
            panel.classList.toggle('is-expanded', !!expanded);
            if (toggle) toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            if (content) content.hidden = !expanded;
        };

        const bindOfflineThinkingToggle = (bubble) => {
            const toggle = bubble?.querySelector?.('.offline-chat-thinking-toggle');
            if (!toggle || toggle.dataset.bound === 'true') return;
            toggle.dataset.bound = 'true';
            toggle.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                setOfflineThinkingExpanded(bubble, toggle.getAttribute('aria-expanded') !== 'true');
            });
        };

        const renderOfflineThinkingState = (bubble, reasoning, options = {}) => {
            const body = bubble?.querySelector?.('.offline-chat-bubble-body');
            if (!body) return null;
            const rawReasoning = String(reasoning || '').trim();
            let panel = body.querySelector('[data-offline-thinking]');
            if (!rawReasoning) {
                panel?.remove();
                return null;
            }
            if (!panel) {
                body.insertAdjacentHTML('afterbegin', buildOfflineThinkingHtml(rawReasoning, !!options.expanded));
                panel = body.querySelector('[data-offline-thinking]');
                bindOfflineThinkingToggle(bubble);
            }
            const content = panel?.querySelector('.offline-chat-thinking-content');
            if (content) {
                content.setAttribute('data-raw-thinking', rawReasoning);
                content.textContent = rawReasoning;
            }
            setOfflineThinkingExpanded(bubble, !!options.expanded);
            return panel;
        };

        const isOfflineChatNearBottom = (contentArea, threshold = 96) => {
            if (!contentArea) return false;
            return contentArea.scrollHeight - contentArea.scrollTop - contentArea.clientHeight <= threshold;
        };

        const scrollOfflineChatToBottom = (contentArea) => {
            if (contentArea) contentArea.scrollTop = contentArea.scrollHeight;
        };

        const getOfflineGeneratedImageFileName = (timestamp, mimeType = '') => {
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
            return `imessage-offline-generated-${stamp}.${extension}`;
        };

        async function saveOfflineGeneratedImage(message) {
            const imageUrl = String(message?.imageUrl || '').trim();
            if (!imageUrl || typeof window.u2ExportFile !== 'function') {
                throw new Error('图片保存功能尚未加载，请刷新后重试');
            }
            const response = await fetch(imageUrl);
            if (!response.ok) throw new Error('无法读取这张图片，请稍后重试');
            const blob = await response.blob();
            if (!/^image\//i.test(blob.type || '')) throw new Error('图片数据无效，无法保存');
            const result = await window.u2ExportFile({
                blob,
                fileName: getOfflineGeneratedImageFileName(message.timestamp, blob.type),
                title: 'iMessage 线下剧情图片'
            });
            if (result === 'failed') throw new Error('图片保存失败，请稍后重试');
            return result;
        }

        const getOfflineChatActionButtonsHtml = (isUser, actionsDisabled = false, message = null) => {
            if (actionsDisabled) return '';
            if (isOfflineAutoImageMessage(message)) {
                return '<div class="offline-chat-bubble-actions"><button type="button" class="offline-chat-action-btn" data-offline-action="save-image" title="保存到本地" aria-label="保存到本地"><i class="fas fa-download"></i></button><button type="button" class="offline-chat-action-btn danger" data-offline-action="delete" title="删除" aria-label="删除"><i class="fas fa-trash"></i></button></div>';
            }
            return `
                <div class="offline-chat-bubble-actions">
                    <button type="button" class="offline-chat-action-btn" data-offline-action="edit" title="编辑" aria-label="编辑"><i class="fas fa-pen"></i></button>
                    ${!isUser ? '<button type="button" class="offline-chat-action-btn" data-offline-action="reroll" title="重回" aria-label="重回"><i class="fas fa-redo"></i></button>' : ''}
                    <button type="button" class="offline-chat-action-btn danger" data-offline-action="delete" title="删除" aria-label="删除"><i class="fas fa-trash"></i></button>
                </div>
            `;
        };

        const bindOfflineChatBubbleActions = (bubbleDiv, message) => {
            if (!bubbleDiv || !message?.id) return;
            bubbleDiv.querySelectorAll('[data-offline-action]').forEach((button) => {
                if (button.dataset.bound === 'true') return;
                button.dataset.bound = 'true';
                button.addEventListener('click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const action = button.getAttribute('data-offline-action');
                    if (action === 'edit') await openOfflineMessageEditor(message.id);
                    if (action === 'delete') await deleteOfflineMessage(message.id);
                    if (action === 'reroll') await rerollOfflineAssistantMessage(message.id, button);
                    if (action === 'save-image') {
                        if (button.disabled) return;
                        const originalHtml = button.innerHTML;
                        const originalTitle = button.title;
                        button.disabled = true;
                        button.title = '保存中…';
                        button.setAttribute('aria-label', '保存中…');
                        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                        try {
                            const result = await saveOfflineGeneratedImage(message);
                            if (result === 'downloaded') window.showToast?.('图片已保存到本地');
                            if (result === 'shared') window.showToast?.('已打开系统保存，请选择“存储到文件”');
                        } catch (error) {
                            window.showToast?.(error?.message || '图片保存失败，请稍后重试');
                        } finally {
                            button.disabled = false;
                            button.title = originalTitle;
                            button.setAttribute('aria-label', originalTitle || '保存到本地');
                            button.innerHTML = originalHtml;
                        }
                    }
                });
            });
        };

        const enableOfflineChatBubbleActions = (bubbleDiv, message) => {
            const footer = bubbleDiv?.querySelector?.('.offline-chat-bubble-footer');
            if (!footer || !message?.id) return;
            footer.querySelector('.offline-chat-bubble-actions')?.remove();
            footer.insertAdjacentHTML('beforeend', getOfflineChatActionButtonsHtml(message.role === 'user', false, message));
            bindOfflineChatBubbleActions(bubbleDiv, message);
        };

        const renderOfflineChatBubble = (messageOrText, isUser = true, options = {}) => {
            const contentArea = document.getElementById('offline-chat-content');
            if (!contentArea) return null;

            const friend = window.imData.currentActiveFriend;
            if (!options.skipTheme) applyOfflineChatTheme(friend);
            const rawMessage = messageOrText && typeof messageOrText === 'object'
                ? messageOrText
                : { role: isUser ? 'user' : 'assistant', content: String(messageOrText || ''), timestamp: Date.now() };
            const message = {
                id: rawMessage.id || createOfflineChatId(rawMessage.role === 'assistant' ? 'offline-ai' : 'offline-user'),
                role: rawMessage.role === 'assistant' ? 'assistant' : 'user',
                type: rawMessage.type || '',
                content: String(rawMessage.content || ''),
                reasoning: rawMessage.role === 'assistant' ? String(rawMessage.reasoning || '') : '',
                timestamp: Number(rawMessage.timestamp) || Date.now(),
                tokens: Number(rawMessage.tokens) || 0,
                imageUrl: String(rawMessage.imageUrl || '').trim(),
                sourceMessageId: String(rawMessage.sourceMessageId || '').trim(),
                imageProvider: String(rawMessage.imageProvider || '').trim(),
                imageModel: String(rawMessage.imageModel || '').trim(),
                imageSize: String(rawMessage.imageSize || '').trim(),
                faceReferenceUsed: rawMessage.faceReferenceUsed === true
            };
            isUser = message.role === 'user';
            const isAutoImage = isOfflineAutoImageMessage(message);

            const offlineUserProfile = getOfflineEffectiveUserProfile(friend);
            const userName = isUser ? offlineUserProfile.name : (friend?.nickname || friend?.realName || 'TA');
            const userSign = isUser ? offlineUserProfile.signature : (friend?.signature || '');
            const userAvatar = isUser ? offlineUserProfile.avatarUrl : (friend?.avatarUrl || '');
            const floor = Number(options.floor) || 1;
            const depth = Number.isInteger(Number(options.depth)) ? Number(options.depth) : 0;
            const isReadOnly = !!options.readOnly;
            const actionsDisabled = isReadOnly || !!options.actionsDisabled;
            const enableBarrageForMessage = !isUser && isOfflineBarragePromptEnabled(friend);
            const enableChoicesForMessage = !isUser && isOfflineChoicesPromptEnabled(friend);
            const timeText = formatOfflineBubbleTime(message.timestamp);
            const metaText = isAutoImage
                ? `图片 · ${timeText}`
                : isUser
                ? `#${floor} · ${countOfflineTextCharacters(message.content)}字 · ${timeText}`
                : `#${floor} · ${message.tokens || estimateOfflineTextTokens(message.content)} tokens · ${timeText}`;

            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = `offline-chat-bubble ${isUser ? 'user' : 'ai'}`;
            bubbleDiv.setAttribute('data-message-id', message.id);
            bubbleDiv.setAttribute('data-floor', String(floor));
            
            let avatarHtml = `<div class="offline-chat-avatar"><i class="fas fa-user"></i></div>`;
            if (userAvatar) {
                avatarHtml = `<div class="offline-chat-avatar"><img src="${escapeSheetHtml(userAvatar)}" alt="avatar"></div>`;
            }

            // reasoning 与正文分开渲染；旧标签消息在这里仍可兼容解析。
            const parsedMessage = !isUser && !isAutoImage && offlineReasoning
                ? offlineReasoning.normalizeResponse(message.content, message.reasoning)
                : { content: String(message.content || ''), reasoning: '' };
            const rawThinking = parsedMessage.reasoning;
            const displayText = applyOfflineRegexText(friend, parsedMessage.content, message.role, depth, 'display');
            const displayThinking = rawThinking ? buildOfflineThinkingHtml(rawThinking, false) : '';

            const actionButtonsHtml = getOfflineChatActionButtonsHtml(isUser, actionsDisabled, message);
            const imageHtml = isAutoImage
                ? `<figure class="offline-chat-generated-image"><img src="${escapeSheetHtml(message.imageUrl)}" alt="${escapeSheetHtml(message.content || '线下剧情图片')}" loading="lazy"><figcaption>${escapeSheetHtml(message.content || '线下剧情图片')}</figcaption></figure>`
                : '';

            bubbleDiv.innerHTML = `
                <div class="offline-chat-bubble-header">
                    ${avatarHtml}
                    <div class="offline-chat-name-container">
                        <span class="offline-chat-name">${escapeSheetHtml(userName)}</span>
                    </div>
                    ${userSign ? `<div class="offline-chat-sign">${escapeSheetHtml(userSign)}</div>` : ''}
                </div>
                <div class="offline-chat-bubble-body">
                    ${isAutoImage ? imageHtml : displayThinking}
                    ${isAutoImage ? '' : `<div class="offline-chat-bubble-text" ${displayText ? '' : 'style="display:none;"'}>${buildOfflineChatTextHtml(displayText, {
                        messageId: message.id,
                        enableVoice: !isUser && isTtsEnabledForFriend(friend),
                        enableBarrage: enableBarrageForMessage,
                        enableChoices: enableChoicesForMessage,
                        enableRecap: !isUser,
                        language: friend?.language || 'zh'
                    })}</div>`}
                    <div class="offline-chat-bubble-footer">
                        <div class="offline-chat-bubble-meta">${escapeSheetHtml(metaText)}</div>
                        ${actionButtonsHtml}
                    </div>
                </div>
            `;

            if (!isAutoImage) bindOfflineThinkingToggle(bubbleDiv);
            bindOfflineChatBubbleActions(bubbleDiv, message);
            if (!isAutoImage) bindOfflineChatTextControls(bubbleDiv, { ...message, content: displayText, reasoning: rawThinking || undefined }, friend, floor);

            const container = options.container || contentArea;
            container.appendChild(bubbleDiv);
            if (options.scroll !== false && container === contentArea) scrollOfflineChatToBottom(contentArea);
            return bubbleDiv;
        };

        const createStreamingBubble = (initialText = '', isUser = false, options = {}) => {
            const message = {
                id: options.id || createOfflineChatId(isUser ? 'offline-user' : 'offline-ai'),
                role: isUser ? 'user' : 'assistant',
                content: initialText,
                reasoning: options.reasoning || '',
                timestamp: options.timestamp || Date.now(),
                tokens: options.tokens || 0
            };
            const bubbleDiv = renderOfflineChatBubble(message, isUser, {
                floor: options.floor,
                depth: options.depth,
                actionsDisabled: true
            });
            if (!bubbleDiv) return null;
            let currentContent = initialText;
            let currentNativeReasoning = String(options.reasoning || '');
            let lastVisibleReasoning = String(options.reasoning || '').trim();
            let generationFinished = false;
            let renderFrameId = null;
            let renderTimerId = null;
            let lastRenderAt = 0;

            const cancelPendingRender = () => {
                if (renderFrameId !== null && typeof window.cancelAnimationFrame === 'function') {
                    window.cancelAnimationFrame(renderFrameId);
                }
                if (renderTimerId !== null) clearTimeout(renderTimerId);
                renderFrameId = null;
                renderTimerId = null;
            };

            const renderStreamingState = () => {
                const contentArea = document.getElementById('offline-chat-content');
                const shouldFollowBottom = isOfflineChatNearBottom(contentArea);
                const currentParsed = offlineReasoning
                    ? offlineReasoning.normalizeResponse(currentContent, currentNativeReasoning, { streaming: !generationFinished })
                    : { content: currentContent, reasoning: currentNativeReasoning, incomplete: false };
                if (String(currentParsed.reasoning || '').trim()) {
                    lastVisibleReasoning = String(currentParsed.reasoning).trim();
                }
                const parsed = lastVisibleReasoning && !String(currentParsed.reasoning || '').trim()
                    ? { ...currentParsed, reasoning: lastVisibleReasoning }
                    : currentParsed;
                const activeFriend = window.imData.currentActiveFriend;
                const depth = Number.isInteger(Number(options.depth)) ? Number(options.depth) : 0;
                const finalDisplayContent = splitOfflineAutoImageMarker(parsed.content).content;
                const displayText = generationFinished
                    ? applyOfflineStreamingRegexText(activeFriend, finalDisplayContent, message.role, depth)
                    : finalDisplayContent;
                renderOfflineThinkingState(bubbleDiv, parsed.reasoning, { expanded: !generationFinished });
                const textEl = bubbleDiv.querySelector('.offline-chat-bubble-text');
                if (textEl) {
                    if (displayText) {
                        textEl.style.display = '';
                        textEl.classList.toggle('is-streaming', !generationFinished);
                        if (generationFinished) {
                            textEl.innerHTML = buildOfflineChatTextHtml(displayText, {
                                messageId: message.id,
                                enableVoice: !isUser && isTtsEnabledForFriend(activeFriend),
                                enableBarrage: !isUser && isOfflineBarragePromptEnabled(activeFriend),
                                enableChoices: !isUser && isOfflineChoicesPromptEnabled(activeFriend),
                                enableRecap: !isUser,
                                language: activeFriend?.language || 'zh'
                            });
                            bindOfflineChatTextControls(bubbleDiv, { ...message, content: parsed.content, reasoning: parsed.reasoning }, activeFriend, Number(options.floor) || 1);
                        } else {
                            textEl.textContent = displayText;
                        }
                    } else {
                        textEl.innerHTML = '';
                        textEl.style.display = 'none';
                    }
                }

                if (shouldFollowBottom) scrollOfflineChatToBottom(contentArea);
                return parsed;
            };

            const scheduleStreamingRender = () => {
                if (renderFrameId !== null || renderTimerId !== null) return;
                const queueFrame = () => {
                    renderTimerId = null;
                    const render = () => {
                        renderFrameId = null;
                        renderTimerId = null;
                        lastRenderAt = Date.now();
                        renderStreamingState();
                    };
                    if (typeof window.requestAnimationFrame === 'function') {
                        renderFrameId = window.requestAnimationFrame(render);
                    } else {
                        renderTimerId = setTimeout(render, 0);
                    }
                };
                const delay = Math.max(0, OFFLINE_STREAM_RENDER_INTERVAL - (Date.now() - lastRenderAt));
                if (delay > 0) renderTimerId = setTimeout(queueFrame, delay);
                else queueFrame();
            };

            return {
                appendContentChunk: (chunk) => {
                    currentContent += String(chunk || '');
                    scheduleStreamingRender();
                },
                appendReasoningChunk: (chunk) => {
                    currentNativeReasoning += String(chunk || '');
                    scheduleStreamingRender();
                },
                appendChunk: (chunk) => {
                    currentContent += String(chunk || '');
                    scheduleStreamingRender();
                },
                finish: () => {
                    generationFinished = true;
                    cancelPendingRender();
                    const parsed = renderStreamingState();
                    return lastVisibleReasoning && !String(parsed.reasoning || '').trim()
                        ? { ...parsed, reasoning: lastVisibleReasoning }
                        : parsed;
                },
                setTokens: (tokens) => {
                    const safeTokens = Math.max(0, Number(tokens) || 0);
                    const metaEl = bubbleDiv.querySelector('.offline-chat-bubble-meta');
                    if (metaEl) {
                        metaEl.textContent = `#${Number(options.floor) || 1} · ${safeTokens || estimateOfflineTextTokens(currentContent)} tokens · ${formatOfflineBubbleTime(message.timestamp)}`;
                    }
                },
                enableActions: (finalMessage) => enableOfflineChatBubbleActions(bubbleDiv, finalMessage || message),
                getResult: () => {
                    const parsed = offlineReasoning
                        ? offlineReasoning.normalizeResponse(currentContent, currentNativeReasoning)
                        : { content: currentContent, reasoning: currentNativeReasoning };
                    return lastVisibleReasoning && !String(parsed.reasoning || '').trim()
                        ? { ...parsed, reasoning: lastVisibleReasoning }
                        : parsed;
                },
                getFullText: () => currentContent,
                reset: () => {
                    currentContent = '';
                    currentNativeReasoning = '';
                    lastVisibleReasoning = '';
                    generationFinished = false;
                    cancelPendingRender();
                    renderStreamingState();
                }
            };
        };

        const persistOfflineMessages = async (activeFriend, messages, options = {}) => {
            if (!activeFriend) return [];
            let normalized = cloneOfflineMeetingMessages(messages);
            if (offlineRegexEngine) {
                normalized = offlineRegexEngine.applyStorageRules(normalized, getOfflineRegexScripts(activeFriend), {
                    resetMessageIds: options.resetMessageIds || []
                });
            }
            const saved = await commitSheetFriendChange(activeFriend.id, (targetFriend) => {
                targetFriend.offlineMessages = normalized;
            }, { silent: true, metaOnly: true });
            if (!saved) throw new Error('Failed to persist offline meeting messages');
            return normalized;
        };

        async function generateOfflineAutoImage(activeFriend, sourceMessageId, scene, contextMessages = null) {
            const liveFriend = window.imApp?.getFriendById?.(activeFriend?.id) || activeFriend;
            if (!shouldAutoGenerateOfflineImage(liveFriend) || !String(scene || '').trim()) return null;
            if (!window.imChat?.generateChatImage) {
                window.showToast?.('线下剧情已保留，但生图功能尚未加载');
                return null;
            }
            if (window.imChat.isChatImageGenerationRunning?.(liveFriend.id)) {
                window.showToast?.('线下剧情已保留，当前聊天已有图片正在生成');
                return null;
            }

            const promptConfig = liveFriend.imagePromptConfig || {};
            const sourceMessages = Array.isArray(contextMessages)
                ? contextMessages
                : normalizeOfflineMessagesForFriend(liveFriend);
            const recentContext = getOfflineContextMessages(liveFriend, sourceMessages)
                .slice(-30)
                .map(message => `${message.role === 'assistant' ? 'Char' : 'User'}：${message.content}`)
                .join('\n')
                .slice(-12000);
            const prompt = buildOfflineAutoImagePrompt(scene, promptConfig, recentContext);
            if (!prompt) return null;

            try {
                window.showToast?.('线下剧情图片开始生成…');
                const referenceImage = await window.imChat.resolveAutoImageReferenceFace(liveFriend);
                const result = await window.imChat.generateChatImage(prompt, liveFriend, {
                    referenceImage,
                    charAppearance: promptConfig.charAppearance || '',
                    userAppearance: promptConfig.userAppearance || '',
                    artistPrompt: promptConfig.artistPrompt || '',
                    negativePrompt: promptConfig.negativePrompt || ''
                });
                if (!result?.imageUrl) throw new Error('image_generation_empty');

                const latestFriend = window.imApp?.getFriendById?.(liveFriend.id) || liveFriend;
                const latestMessages = normalizeOfflineMessagesForFriend(latestFriend);
                const sourceIndex = latestMessages.findIndex(message => String(message.id) === String(sourceMessageId));
                if (sourceIndex < 0) return null;
                const imageMessage = {
                    id: createOfflineChatId('offline-image'),
                    role: 'assistant',
                    type: OFFLINE_AUTO_IMAGE_MESSAGE_TYPE,
                    content: String(scene).trim(),
                    imageUrl: result.imageUrl,
                    sourceMessageId: String(sourceMessageId),
                    imageProvider: result.provider || '',
                    imageModel: result.model || '',
                    imageSize: result.size || '',
                    faceReferenceUsed: result.faceReferenceUsed === true,
                    timestamp: Date.now()
                };
                const nextMessages = latestMessages.slice();
                nextMessages.splice(sourceIndex + 1, 0, imageMessage);
                await persistOfflineMessages(latestFriend, nextMessages);
                window.showToast?.('线下剧情图片生成完成');
                if (window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(latestFriend.id)) {
                    renderOfflineCurrentMessages(latestFriend);
                }
                return imageMessage;
            } catch (error) {
                console.error('Offline automatic image generation failed', error);
                window.showToast?.('线下剧情图片生成失败，文字剧情已保留');
                return null;
            }
        }

        const ensureOfflineMeetingState = async (activeFriend) => {
            if (!activeFriend) return null;
            normalizeOfflineMeetingSessions(activeFriend);
            normalizeOfflineMessagesForFriend(activeFriend);

            const needsNewSession = activeFriend.offlineMeetingActive !== true || !activeFriend.offlineCurrentSessionId;
            if (needsNewSession) {
                const now = Date.now();
                const sessionId = activeFriend.offlineCurrentSessionId || createOfflineChatId('offline-session');
                const startedAt = Number(activeFriend.offlineMeetingStartedAt) || now;
                const currentMessages = Array.isArray(activeFriend.offlineMessages) ? activeFriend.offlineMessages : [];
                const saved = await commitSheetFriendChange(activeFriend.id, (targetFriend) => {
                    targetFriend.offlineMeetingActive = true;
                    targetFriend.offlineCurrentSessionId = sessionId;
                    targetFriend.offlineMeetingStartedAt = startedAt;
                    targetFriend.offlineMessages = currentMessages;
                }, { silent: true, metaOnly: true });
                if (!saved) throw new Error('Failed to persist offline meeting state');
            }

            const latestFriend = window.imApp?.getFriendById?.(activeFriend.id) || activeFriend;
            await removeOfflineMeetingActiveNotice(latestFriend);
            return latestFriend.offlineCurrentSessionId;
        };

        const renderOfflineHistoryButton = (contentArea, activeFriend) => {
            const sessions = normalizeOfflineMeetingSessions(activeFriend);
            if (sessions.length === 0) return;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'offline-chat-history-card';
            button.innerHTML = `<i class="fas fa-history"></i><span>查看历史见面</span>`;
            button.addEventListener('click', () => renderOfflineHistoryList(activeFriend));
            contentArea.appendChild(button);
        };

        const getOfflineSummaryShortTermMemory = (activeFriend, summaryId) => {
            const sourceId = String(summaryId || '');
            if (!sourceId) return null;
            const entries = Array.isArray(activeFriend?.memory?.shortTermEntries)
                ? activeFriend.memory.shortTermEntries
                : [];
            return entries.find(entry => (
                String(entry?.sourceType || '') === 'offline_segment_summary'
                && String(entry?.sourceId || '') === sourceId
            )) || null;
        };

        const addOfflineSummaryToShortTermMemory = async (activeFriend, summaryMessage) => {
            const summaryId = String(summaryMessage?.id || '');
            const summaryText = String(summaryMessage?.content || '').trim();
            if (!activeFriend?.id || !summaryId || !summaryText) throw new Error('Offline summary is unavailable');
            if (typeof window.imApp?.applyGeneratedShortTermMemory !== 'function') {
                throw new Error('Short-term memory service is unavailable');
            }

            const startFloor = Math.max(1, Number(summaryMessage.sourceFloorStart) || 1);
            const endFloor = Math.max(startFloor, Number(summaryMessage.sourceFloorEnd) || startFloor);
            const summaryTime = Number(summaryMessage.timestamp) || Date.now();
            let savedMemory = null;
            const saved = await commitSheetFriendChange(activeFriend.id, (targetFriend) => {
                savedMemory = window.imApp.applyGeneratedShortTermMemory(targetFriend, {
                    id: `offline-summary-memory-${summaryId}`,
                    title: `线下总结 ${startFloor}-${endFloor}楼`,
                    time: formatOfflineMeetingDate(summaryTime),
                    event: summaryText,
                    memoryPoints: `线下见面第 ${startFloor}-${endFloor} 楼的分段总结`,
                    memoryTags: ['线下见面', '线下总结'],
                    triggerKeywords: ['线下见面', '线下总结'],
                    raw: summaryText,
                    sourceType: 'offline_segment_summary',
                    sourceId: summaryId
                }, {
                    now: summaryTime,
                    updateSummaryCursor: false
                });
                window.imApp.clearFriendRuntimeMessageContext?.(targetFriend);
            }, { silent: true, metaOnly: true });
            if (!saved || !savedMemory) throw new Error('Failed to save offline summary memory');
            window.dispatchEvent?.(new CustomEvent('u2:memory-entries-updated', {
                detail: { friendId: String(activeFriend.id), action: 'create', sourceType: 'offline_segment_summary', sourceId: summaryId }
            }));
            return savedMemory;
        };

        const renderOfflineSummaryCard = (container, activeFriend, summaryMessage, allMessages) => {
            if (!container || !summaryMessage) return null;
            const sourceRows = getOfflineSummarySourceMessages(allMessages, summaryMessage);
            const startFloor = Number(summaryMessage.sourceFloorStart) || sourceRows[0]?.floor || 1;
            const endFloor = Number(summaryMessage.sourceFloorEnd) || sourceRows[sourceRows.length - 1]?.floor || startFloor;
            const identityContext = getOfflineIdentityContext(activeFriend);
            const existingMemory = getOfflineSummaryShortTermMemory(activeFriend, summaryMessage.id);
            const sourceTranscript = sourceRows.map(({ message, floor }) => {
                const speaker = message.role === 'assistant' ? identityContext.charName : identityContext.userName;
                return `#${floor} ${speaker}：${stripOfflineDecorativeMarkup(message.content)}`;
            }).join('\n\n');
            const card = document.createElement('details');
            card.className = 'offline-chat-summary-card';
            card.setAttribute('data-summary-id', String(summaryMessage.id || ''));
            card.innerHTML = `
                <summary class="offline-chat-summary-card-head">
                    <span><i class="fas fa-file-lines"></i> 线下总结</span>
                    <small>第 ${startFloor}–${endFloor} 楼 · 已归档</small>
                </summary>
                <div class="offline-chat-summary-card-content">${escapeSheetHtml(summaryMessage.content || '').replace(/\n/g, '<br>')}</div>
                <div class="offline-chat-summary-memory-action">
                    <button type="button" class="offline-chat-summary-memory-btn" ${existingMemory ? 'disabled' : ''}>${existingMemory ? '已加入短期记忆' : '加入短期记忆'}</button>
                </div>
                <details class="offline-chat-summary-source">
                    <summary>查看已归档原楼层（不会再作为上下文）</summary>
                    <div>${sourceTranscript ? escapeSheetHtml(sourceTranscript).replace(/\n/g, '<br>') : '原楼层不可用'}</div>
                </details>
            `;
            const memoryButton = card.querySelector('.offline-chat-summary-memory-btn');
            if (memoryButton && !existingMemory) {
                memoryButton.addEventListener('click', async () => {
                    if (memoryButton.disabled) return;
                    memoryButton.disabled = true;
                    try {
                        await addOfflineSummaryToShortTermMemory(activeFriend, summaryMessage);
                        memoryButton.textContent = '已加入短期记忆';
                        if (window.showToast) window.showToast('已加入线上短期记忆');
                    } catch (error) {
                        console.error('Failed to add offline summary to short-term memory', error);
                        memoryButton.disabled = false;
                        if (window.showToast) window.showToast('加入短期记忆失败，请重试');
                    }
                });
            }
            container.appendChild(card);
            return card;
        };

        function renderOfflineCurrentMessages(activeFriend, options = {}) {
            const contentArea = document.getElementById('offline-chat-content');
            if (!contentArea || !activeFriend) return;
            contentArea.innerHTML = '';
            const titleEl = document.querySelector('#offline-chat-view .offline-chat-title');
            if (titleEl) titleEl.textContent = '线下';
            applyOfflineChatTheme(activeFriend);
            const fragment = document.createDocumentFragment();
            renderOfflineHistoryButton(fragment, activeFriend);

            const messages = normalizeOfflineMessagesForFriend(activeFriend);
            const visibleRows = getOfflineUnarchivedDialogueRows(messages);
            const visibleRowIndexById = new Map(visibleRows.map((row, index) => [String(row.message.id || ''), index]));
            messages.forEach((message) => {
                if (isOfflineSummaryMessage(message)) {
                    renderOfflineSummaryCard(fragment, activeFriend, message, messages);
                    return;
                }
                if (message.archivedBySummaryId) return;
                const rowIndex = visibleRowIndexById.get(String(message.id || ''));
                renderOfflineChatBubble(message, message.role === 'user', {
                    floor: getOfflineMessageFloor(messages, message.id),
                    depth: rowIndex == null ? 0 : visibleRows.length - 1 - rowIndex,
                    container: fragment,
                    scroll: false,
                    skipTheme: true
                });
            });

            if (messages.length === 0 && normalizeOfflineMeetingSessions(activeFriend).length === 0) {
                const placeholder = document.createElement('div');
                placeholder.className = 'offline-chat-placeholder';
                placeholder.textContent = '开始一次线下见面';
                fragment.appendChild(placeholder);
            }
            contentArea.appendChild(fragment);
            if (options.scroll !== false) scrollOfflineChatToBottom(contentArea);
        }

        function renderOfflineHistoryList(activeFriend) {
            const contentArea = document.getElementById('offline-chat-content');
            if (!contentArea || !activeFriend) return;
            const sessions = normalizeOfflineMeetingSessions(activeFriend).slice().sort((a, b) => Number(b.endedAt) - Number(a.endedAt));
            contentArea.innerHTML = '';
            const titleEl = document.querySelector('#offline-chat-view .offline-chat-title');
            if (titleEl) titleEl.textContent = '历史见面';

            const backBtn = document.createElement('button');
            backBtn.type = 'button';
            backBtn.className = 'offline-chat-history-back';
            backBtn.innerHTML = '<i class="fas fa-chevron-left"></i> 返回当前见面';
            backBtn.addEventListener('click', () => renderOfflineCurrentMessages(activeFriend));
            contentArea.appendChild(backBtn);

            if (sessions.length === 0) {
                const placeholder = document.createElement('div');
                placeholder.className = 'offline-chat-placeholder';
                placeholder.textContent = '还没有历史见面';
                contentArea.appendChild(placeholder);
                return;
            }

            sessions.forEach((session) => {
                const card = document.createElement('div');
                card.className = 'offline-chat-history-session';
                card.setAttribute('role', 'button');
                card.tabIndex = 0;
                const summary = String(session.summary || session.rawSummary || '').trim();
                card.innerHTML = `
                    <button type="button" class="offline-chat-history-delete" aria-label="删除见面记录" title="删除见面记录"><i class="fas fa-trash"></i></button>
                    <div class="offline-chat-history-title">${escapeSheetHtml(session.title || '见面记录')}</div>
                    <div class="offline-chat-history-meta">${escapeSheetHtml(session.dateText || formatOfflineMeetingDate(session.endedAt))} · ${session.messages.length} 楼</div>
                    ${summary ? `<div class="offline-chat-history-summary">${escapeSheetHtml(summary)}</div>` : ''}
                `;
                const openSession = () => renderOfflineHistoricalSession(activeFriend, session);
                card.addEventListener('click', (event) => {
                    const targetEl = event.target instanceof Element ? event.target : null;
                    if (targetEl?.closest('.offline-chat-history-delete')) return;
                    openSession();
                });
                card.addEventListener('keydown', (event) => {
                    const targetEl = event.target instanceof Element ? event.target : null;
                    if (targetEl?.closest('.offline-chat-history-delete')) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openSession();
                    }
                });
                const deleteBtn = card.querySelector('.offline-chat-history-delete');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        confirmDeleteOfflineMeetingSession(activeFriend, session, deleteBtn);
                    });
                }
                contentArea.appendChild(card);
            });
        }

        function renderOfflineHistoricalSummary(activeFriend, session) {
            const contentArea = document.getElementById('offline-chat-content');
            if (!contentArea || !session) return;

            const card = document.createElement('div');
            card.className = 'offline-chat-history-detail-summary';
            const summaryText = String(session.summary || session.rawSummary || '').trim();
            card.innerHTML = `
                <div class="offline-chat-history-detail-summary-head">
                    <div>
                        <div class="offline-chat-history-detail-summary-title">见面总结</div>
                        <div class="offline-chat-history-detail-summary-meta">${escapeSheetHtml(session.dateText || formatOfflineMeetingDate(session.endedAt))}</div>
                    </div>
                    <button type="button" class="offline-chat-history-summary-edit" aria-label="编辑总结" title="编辑总结"><i class="fas fa-pen"></i></button>
                </div>
                <div class="offline-chat-history-detail-summary-text">${summaryText ? escapeSheetHtml(summaryText) : '暂无总结'}</div>
                <textarea class="offline-chat-history-summary-textarea" aria-label="见面总结">${escapeSheetHtml(summaryText)}</textarea>
                <div class="offline-chat-history-summary-actions">
                    <button type="button" class="offline-chat-history-summary-cancel">取消</button>
                    <button type="button" class="offline-chat-history-summary-save">保存</button>
                </div>
            `;

            const textEl = card.querySelector('.offline-chat-history-detail-summary-text');
            const textarea = card.querySelector('.offline-chat-history-summary-textarea');
            const actionsEl = card.querySelector('.offline-chat-history-summary-actions');
            const editBtn = card.querySelector('.offline-chat-history-summary-edit');
            const cancelBtn = card.querySelector('.offline-chat-history-summary-cancel');
            const saveBtn = card.querySelector('.offline-chat-history-summary-save');
            let isEditing = false;

            const setEditing = (editing) => {
                isEditing = editing;
                card.classList.toggle('is-editing', editing);
                if (textarea) textarea.value = editing ? String(session.summary || session.rawSummary || '').trim() : textarea.value;
                if (editing) setTimeout(() => textarea?.focus(), 30);
            };

            editBtn?.addEventListener('click', () => setEditing(true));
            cancelBtn?.addEventListener('click', () => setEditing(false));
            saveBtn?.addEventListener('click', async () => {
                if (!isEditing || !textarea) return;
                const nextSummary = textarea.value.trim();
                saveBtn.disabled = true;
                cancelBtn.disabled = true;
                try {
                    const saved = await updateOfflineMeetingSessionSummary(activeFriend, session, nextSummary);
                    if (!saved) {
                        if (window.showToast) window.showToast('总结保存失败');
                        return;
                    }
                    session.summary = nextSummary;
                    session.rawSummary = buildOfflineMeetingRawSummary(session, nextSummary);
                    if (textEl) textEl.textContent = nextSummary || '暂无总结';
                    setEditing(false);
                    if (window.showToast) window.showToast('总结已保存');
                } catch (error) {
                    console.error('Update offline meeting summary failed', error);
                    if (window.showToast) window.showToast('总结保存失败');
                } finally {
                    saveBtn.disabled = false;
                    cancelBtn.disabled = false;
                }
            });

            textarea?.addEventListener('keydown', (event) => {
                if (event.isComposing || event.keyCode === 229) return;
                if ((event.ctrlKey || event.metaKey) && (event.key === 'Enter' || event.keyCode === 13)) {
                    event.preventDefault();
                    saveBtn?.click();
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    setEditing(false);
                }
            });

            contentArea.appendChild(card);
        }

        function renderOfflineHistoricalSession(activeFriend, session) {
            const contentArea = document.getElementById('offline-chat-content');
            if (!contentArea || !session) return;
            contentArea.innerHTML = '';
            const titleEl = document.querySelector('#offline-chat-view .offline-chat-title');
            if (titleEl) titleEl.textContent = session.title || '历史见面';

            const backBtn = document.createElement('button');
            backBtn.type = 'button';
            backBtn.className = 'offline-chat-history-back';
            backBtn.innerHTML = '<i class="fas fa-chevron-left"></i> 返回历史见面';
            backBtn.addEventListener('click', () => renderOfflineHistoryList(activeFriend));
            contentArea.appendChild(backBtn);

            const messages = cloneOfflineMeetingMessages(session.messages || []);
            const visibleRows = getOfflineUnarchivedDialogueRows(messages);
            const visibleRowIndexById = new Map(visibleRows.map((row, index) => [String(row.message.id || ''), index]));
            messages.forEach((message) => {
                if (isOfflineSummaryMessage(message)) {
                    renderOfflineSummaryCard(contentArea, activeFriend, message, messages);
                    return;
                }
                if (message.archivedBySummaryId) return;
                const rowIndex = visibleRowIndexById.get(String(message.id || ''));
                renderOfflineChatBubble(message, message.role === 'user', {
                    floor: getOfflineMessageFloor(messages, message.id),
                    depth: rowIndex == null ? 0 : visibleRows.length - 1 - rowIndex,
                    readOnly: true
                });
            });
            renderOfflineHistoricalSummary(activeFriend, session);
            contentArea.scrollTop = contentArea.scrollHeight;
        }

        function ensureOfflineBarrageView() {
            let view = document.getElementById('offline-chat-barrage-view');
            if (view) return view;

            view = document.createElement('div');
            view.id = 'offline-chat-barrage-view';
            view.className = 'offline-chat-barrage-view';
            view.innerHTML = `
                <div class="offline-chat-barrage-header">
                    <button type="button" class="offline-chat-barrage-close" id="offline-chat-barrage-close-btn" aria-label="返回"><i class="fas fa-chevron-left"></i></button>
                    <div class="offline-chat-barrage-title" id="offline-chat-barrage-title">弹幕</div>
                    <div class="offline-chat-barrage-spacer"></div>
                </div>
                <div class="offline-chat-barrage-list" id="offline-chat-barrage-list"></div>
            `;
            document.body.appendChild(view);
            applyOfflineChatTheme(window.imData.currentActiveFriend);

            const closeBtn = view.querySelector('#offline-chat-barrage-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    view.classList.remove('active');
                    setTimeout(() => {
                        view.style.display = 'none';
                    }, 180);
                });
            }
            return view;
        }

        function openOfflineBarrageView({ floor = 1, paragraphIndex = 0, barrages = [] } = {}) {
            const view = ensureOfflineBarrageView();
            const titleEl = view.querySelector('#offline-chat-barrage-title');
            const listEl = view.querySelector('#offline-chat-barrage-list');
            const cleanBarrages = (Array.isArray(barrages) ? barrages : [])
                .filter(item => item && item.text)
                .map(item => ({
                    name: String(item.name || '观众').trim() || '观众',
                    text: String(item.text || '').trim(),
                    likes: Number(item.likes) > 0
                        ? Math.max(0, Math.round(Number(item.likes) || 0))
                        : getOfflineBarrageRandomLikes()
                }));

            if (titleEl) titleEl.textContent = `#${floor} · 弹幕`;
            if (listEl) {
                listEl.innerHTML = cleanBarrages.length > 0
                    ? cleanBarrages.map(item => `
                        <div class="offline-chat-barrage-row">
                            <span class="offline-chat-barrage-name">${escapeSheetHtml(item.name)}</span>
                            <span class="offline-chat-barrage-text">${escapeSheetHtml(item.text)}</span>
                            <span class="offline-chat-barrage-likes"><i class="fas fa-thumbs-up"></i>${item.likes}</span>
                        </div>
                    `).join('')
                    : '<div class="offline-chat-barrage-empty">暂无弹幕</div>';
                listEl.scrollTop = 0;
            }

            view.style.display = 'flex';
            void view.offsetWidth;
            view.classList.add('active');
        }

        async function openOfflineMessageEditor(messageId) {
            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend) return;
            const messages = normalizeOfflineMessagesForFriend(activeFriend);
            const index = messages.findIndex(message => String(message.id) === String(messageId));
            if (index < 0) return;

            const bubble = Array.from(document.querySelectorAll('.offline-chat-bubble'))
                .find(item => String(item.getAttribute('data-message-id') || '') === String(messageId));
            const textEl = bubble ? bubble.querySelector('.offline-chat-bubble-text') : null;
            const actionsEl = bubble ? bubble.querySelector('.offline-chat-bubble-actions') : null;
            if (!bubble || !textEl || textEl.dataset.editing === 'true') return;

            const originalText = messages[index].content || '';
            const originalHtml = textEl.innerHTML;
            const originalDisplay = textEl.style.display;
            const originalMinHeight = textEl.style.minHeight;
            const originalActionsHtml = actionsEl ? actionsEl.innerHTML : '';
            const measuredHeight = Math.ceil(textEl.getBoundingClientRect().height || 0);
            textEl.dataset.editing = 'true';
            textEl.style.display = '';
            if (measuredHeight > 0) textEl.style.minHeight = `${measuredHeight}px`;
            textEl.innerHTML = `<textarea class="offline-chat-inline-editor">${escapeSheetHtml(originalText)}</textarea>`;

            if (actionsEl) {
                actionsEl.innerHTML = `
                    <button type="button" class="offline-chat-action-btn" data-inline-edit-action="save" title="保存" aria-label="保存"><i class="fas fa-check"></i></button>
                    <button type="button" class="offline-chat-action-btn" data-inline-edit-action="cancel" title="取消" aria-label="取消"><i class="fas fa-times"></i></button>
                `;
            }

            const textarea = textEl.querySelector('.offline-chat-inline-editor');
            const restore = () => {
                textEl.dataset.editing = 'false';
                textEl.innerHTML = originalHtml;
                textEl.style.display = originalDisplay;
                textEl.style.minHeight = originalMinHeight;
                textEl.querySelectorAll('[data-bound]').forEach((control) => {
                    delete control.dataset.bound;
                });
                bindOfflineChatTextControls(bubble, messages[index], activeFriend, index + 1);
                if (actionsEl) {
                    actionsEl.innerHTML = originalActionsHtml;
                    actionsEl.querySelectorAll('[data-offline-action]').forEach((button) => {
                        button.addEventListener('click', async (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const action = button.getAttribute('data-offline-action');
                            if (action === 'edit') await openOfflineMessageEditor(messageId);
                            if (action === 'delete') await deleteOfflineMessage(messageId);
                            if (action === 'reroll') await rerollOfflineAssistantMessage(messageId, button);
                        });
                    });
                }
            };
            const save = async () => {
                const nextValue = textarea ? textarea.value : originalText;
                const nextMessages = messages.slice();
                nextMessages[index] = {
                    ...nextMessages[index],
                    content: nextValue,
                    tokens: nextMessages[index].role === 'assistant' ? estimateOfflineTextTokens(nextValue) : undefined,
                    updatedAt: new Date().toISOString(),
                    offlineRegexAppliedRevisions: {}
                };
                const withoutAutoImages = nextMessages.filter((message, messageIndex) => (
                    messageIndex === index || String(message.sourceMessageId || '') !== String(messageId)
                ));
                await persistOfflineMessages(activeFriend, withoutAutoImages, { resetMessageIds: [messageId] });
                renderOfflineCurrentMessages(activeFriend);
            };

            if (actionsEl) {
                const saveBtn = actionsEl.querySelector('[data-inline-edit-action="save"]');
                const cancelBtn = actionsEl.querySelector('[data-inline-edit-action="cancel"]');
                if (saveBtn) saveBtn.addEventListener('click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    await save();
                });
                if (cancelBtn) cancelBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    restore();
                });
            }
            if (textarea) {
                textarea.focus();
                textarea.selectionStart = textarea.value.length;
                textarea.selectionEnd = textarea.value.length;
                textarea.addEventListener('keydown', async (event) => {
                    if (event.isComposing || event.keyCode === 229) return;
                    if ((event.ctrlKey || event.metaKey) && (event.key === 'Enter' || event.keyCode === 13)) {
                        event.preventDefault();
                        await save();
                    }
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        restore();
                    }
                });
            }
        }

        async function deleteOfflineMessage(messageId) {
            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend) return;
            if (!window.confirm('删除这一楼？')) return;
            const messages = normalizeOfflineMessagesForFriend(activeFriend);
            const nextMessages = messages.filter(message => (
                String(message.id) !== String(messageId)
                && String(message.sourceMessageId || '') !== String(messageId)
            ));
            await persistOfflineMessages(activeFriend, nextMessages);
            renderOfflineCurrentMessages(activeFriend);
        }

        const getOfflineGroupMembers = (activeFriend) => {
            if (!activeFriend || activeFriend.type !== 'group') return [];
            const snapshots = Array.isArray(activeFriend.leftGroupMemberSnapshot)
                ? activeFriend.leftGroupMemberSnapshot
                : [];
            if (Number(activeFriend.leftGroupAt) > 0 && snapshots.length > 0) {
                return snapshots.map((snapshot) => ({
                    id: snapshot.id,
                    realName: snapshot.realName || '',
                    nickname: snapshot.nickname || '',
                    persona: ''
                }));
            }
            const liveMembers = window.imChat?.getGroupMemberFriends
                ? window.imChat.getGroupMemberFriends(activeFriend)
                : [];
            if (liveMembers.length > 0) return liveMembers;

            return snapshots.map((snapshot) => ({
                id: snapshot.id,
                realName: snapshot.realName || '',
                nickname: snapshot.nickname || '',
                persona: ''
            }));
        };

        const getOfflineIdentityContext = (activeFriend, currentUserState = null) => {
            const userState = currentUserState || (window.getUserState ? window.getUserState() : (window.userState || {}));
            const userProfile = getOfflineEffectiveUserProfile(activeFriend, userState);
            const userName = userProfile.name;
            const isGroup = activeFriend?.type === 'group';
            const groupMembers = isGroup ? getOfflineGroupMembers(activeFriend) : [];
            const memberNames = Array.from(new Set(groupMembers
                .map(member => String(member?.realName || member?.nickname || '').trim())
                .filter(Boolean)));
            const charName = isGroup
                ? (memberNames.join('、') || String(activeFriend?.realName || activeFriend?.nickname || '群成员').trim() || '群成员')
                : (String(activeFriend?.realName || activeFriend?.nickname || 'Char').trim() || 'Char');

            return {
                userName,
                userPersona: userProfile.persona,
                userAvatarUrl: userProfile.avatarUrl,
                userSignature: userProfile.signature,
                boundAccountId: userProfile.boundAccountId,
                charName,
                isGroup,
                groupMembers
            };
        };

        const replaceOfflinePromptVariables = (content, identityContext) => String(content || '')
            .replace(/\{\{user\}\}/g, () => identityContext.userName)
            .replace(/\{\{char\}\}/g, () => identityContext.charName);

        const getOfflineContextMessages = (activeFriend, offlineMessages) => {
            const currentUserState = window.getUserState ? window.getUserState() : (window.userState || {});
            const { userName } = getOfflineIdentityContext(activeFriend, currentUserState);
            const onlineMessages = Array.isArray(activeFriend?.messages) ? activeFriend.messages : [];
            const combined = [];

            onlineMessages.forEach((message) => {
                if (message?.type === 'system_notice' && message.noticeKind === OFFLINE_ACTIVE_NOTICE_KIND) return;
                let formatted = null;
                if (window.imApp?.formatMessageForApiContext) {
                    formatted = window.imApp.formatMessageForApiContext(message, activeFriend, { userName });
                }
                const role = formatted?.role || (message.role === 'assistant' || message.role === 'char' ? 'assistant' : (message.role === 'system' ? 'system' : 'user'));
                const content = formatted?.content || message.content || message.text || '';
                if (content) {
                    combined.push({
                        role,
                        content,
                        timestamp: Number(message.timestamp) || 0,
                        isOffline: false
                    });
                }
            });

            cloneOfflineMeetingMessages(offlineMessages).forEach((message) => {
                // Automatic image floors are display-only artifacts. Neither the
                // image nor its scene description is allowed into model input.
                if (isOfflineAutoImageMessage(message)) return;
                if (isOfflineSummaryMessage(message) && message.content) {
                    const startFloor = Number(message.sourceFloorStart) || 1;
                    const endFloor = Number(message.sourceFloorEnd) || startFloor;
                    combined.push({
                        role: 'system',
                        content: `<offline_segment_summary floors="${startFloor}-${endFloor}">\n${message.content}\n</offline_segment_summary>`,
                        timestamp: Number(message.timestamp) || 0,
                        isOffline: true
                    });
                    return;
                }
                if (!message.archivedBySummaryId && message.content) {
                    combined.push({
                        role: message.role === 'assistant' ? 'assistant' : 'user',
                        content: message.content,
                        timestamp: Number(message.timestamp) || 0,
                        isOffline: true
                    });
                }
            });

            combined.sort((a, b) => a.timestamp - b.timestamp);
            const mounted = combined.slice(-60);
            let depth = 0;
            for (let index = mounted.length - 1; index >= 0; index -= 1) {
                const message = mounted[index];
                if (message.role !== 'user' && message.role !== 'assistant') continue;
                const promptContent = applyOfflineRegexText(activeFriend, message.content, message.role, depth, 'prompt');
                message.content = message.isOffline ? stripOfflineDecorativeMarkup(promptContent) : promptContent;
                depth += 1;
            }
            return mounted.map(({ isOffline, ...message }) => message).filter(message => message.content);
        };

        const buildOfflineApiMessages = (activeFriend, offlineMessagesForContext) => {
            const currentUserState = window.getUserState ? window.getUserState() : (window.userState || {});
            const identityContext = getOfflineIdentityContext(activeFriend, currentUserState);
            const { userName, charName } = identityContext;
            const historyMessages = getOfflineContextMessages(activeFriend, offlineMessagesForContext);
            const worldBookContextText = [
                ...historyMessages.map(m => m.content || ''),
                activeFriend.persona || '',
                identityContext.userPersona || '',
                activeFriend.memory?.overview || ''
            ].filter(Boolean).join('\n');
            const worldBookContexts = getOfflineWorldBookContexts(activeFriend, worldBookContextText);
            const dataZoneContext = buildOfflineDataZoneContext({
                activeFriend,
                currentUserState,
                userName,
                charName,
                identityContext,
                historyMessages,
                worldBookContexts
            });
            const memorySystemContext = buildOfflineMemorySystemContext(activeFriend, worldBookContextText);
            const offlinePrompts = ensureGlobalOfflinePrompts(activeFriend);
            const requestReasoning = true;
            const apiMessages = [];
            const enabledCotPrompts = offlinePrompts.filter(prompt => (
                OFFLINE_COT_PROMPT_IDS.has(prompt?.id)
                && (prompt.alwaysEnabled || prompt.enabled)
            ));
            const cotCompilation = offlineReasoning?.buildCotInstructionBlock
                ? offlineReasoning.buildCotInstructionBlock(enabledCotPrompts)
                : { content: '', expectedTitles: [] };
            let historyMounted = false;
            let cotMounted = false;

            const mountHistory = () => {
                if (historyMounted) return;
                apiMessages.push(...historyMessages.map(message => ({
                    role: message.role,
                    content: message.content
                })));
                historyMounted = true;
            };

            for (let p of offlinePrompts) {
                if (p.id === OFFLINE_CHAT_HISTORY_PROMPT_ID) {
                    mountHistory();
                    continue;
                }
                const isEnabled = p.alwaysEnabled || p.enabled;
                if (!isEnabled) continue;
                if (OFFLINE_COT_PROMPT_IDS.has(p.id)) {
                    if (requestReasoning && !cotMounted && cotCompilation.content) {
                        apiMessages.push({ role: 'system', content: cotCompilation.content });
                        cotMounted = true;
                    }
                    continue;
                }
                let promptContent = '';
                if (p.id === 'data_zone') promptContent = replaceOfflinePromptVariables(dataZoneContext, identityContext);
                else if (p.id === 'memory_system') promptContent = replaceOfflinePromptVariables(memorySystemContext, identityContext);
                else if (p.content && p.content.trim()) promptContent = replaceOfflinePromptVariables(p.content.trim(), identityContext);
                if (!promptContent) continue;
                apiMessages.push({ role: 'system', content: promptContent });
            }

            mountHistory();
            if (shouldAutoGenerateOfflineImage(activeFriend)) {
                apiMessages.push({ role: 'system', content: buildOfflineAutoImageRequirement() });
            }
            return {
                messages: apiMessages,
                cotValidation: {
                    expectedTitles: cotCompilation.expectedTitles || []
                }
            };
        };

        const requestOfflineAssistantReply = async (apiMessages, streamingBubble = null, options = {}) => {
            const currentApiConfig = window.getApiConfig ? window.getApiConfig() : (window.apiConfig || {});
            if (!currentApiConfig.endpoint || !currentApiConfig.apiKey) {
                throw new Error('API config missing');
            }
            const signal = options.signal || null;
            const endpoint = window.u2Api.resolveChatCompletionsEndpoint(currentApiConfig.endpoint);
            const activeOfflineFriend = window.imData.currentActiveFriend;
            const shouldStream = options.stream !== false && activeOfflineFriend?.offlineStreamEnabled !== false;

            const finishStream = (content, nativeReasoning = '', completionTokens = 0, aborted = false, finishReason = '') => {
                const streamedResult = streamingBubble?.finish
                    ? streamingBubble.finish()
                    : (streamingBubble?.getResult ? streamingBubble.getResult() : null);
                const normalized = streamedResult || (offlineReasoning
                    ? offlineReasoning.normalizeResponse(content, nativeReasoning)
                    : { content: String(content || ''), reasoning: String(nativeReasoning || '') });
                if (!aborted && !String(normalized.content || '').trim()) {
                    const exhaustedTokens = ['length', 'max_tokens', 'max_completion_tokens'].includes(String(finishReason || '').toLowerCase());
                    const error = new Error(exhaustedTokens && String(normalized.reasoning || '').trim()
                        ? 'Offline assistant exhausted the response token limit during reasoning'
                        : 'Offline assistant returned empty content');
                    error.code = exhaustedTokens && String(normalized.reasoning || '').trim()
                        ? 'reasoning_tokens_exhausted'
                        : 'empty_response';
                    error.finishReason = finishReason || '';
                    throw error;
                }
                const tokens = completionTokens || estimateOfflineTextTokens(`${normalized.reasoning || ''}\n${normalized.content || ''}`);
                if (streamingBubble?.setTokens) streamingBubble.setTokens(tokens);
                return {
                    content: normalized.content,
                    reasoning: normalized.reasoning || '',
                    tokens,
                    aborted
                };
            };

            const requestBody = {
                model: currentApiConfig.model || '',
                messages: apiMessages,
                temperature: Number.isFinite(Number.parseFloat(currentApiConfig.temperature))
                    ? Number.parseFloat(currentApiConfig.temperature)
                    : 0.7,
                stream: shouldStream
            };
            const reasoningRequest = offlineReasoning?.buildReasoningRequestConfig({
                endpoint: currentApiConfig.endpoint,
                model: currentApiConfig.model,
                enabled: options.requestReasoning !== false,
                maxTokens: OFFLINE_MAX_RESPONSE_TOKENS
            }) || {
                enabled: options.requestReasoning !== false,
                hasReasoningParameter: false,
                parameters: { max_tokens: OFFLINE_MAX_RESPONSE_TOKENS }
            };
            Object.assign(requestBody, reasoningRequest.parameters);

            let response = null;
            try {
                response = await fetch(endpoint, {
                    method: 'POST',
                    headers: window.u2Api.buildApiHeaders(currentApiConfig),
                    body: JSON.stringify(requestBody),
                    signal: signal || undefined
                });
            } catch (error) {
                if (signal?.aborted || error?.name === 'AbortError') {
                    return finishStream('', '', 0, true);
                }
                throw error;
            }

            if (!response.ok) {
                const isUnsupportedReasoningConfig = reasoningRequest.hasReasoningParameter
                    && (response.status === 400 || response.status === 422);
                const error = new Error(isUnsupportedReasoningConfig
                    ? 'Current API does not support automatic reasoning configuration'
                    : `HTTP Error: ${response.status}`);
                error.code = isUnsupportedReasoningConfig ? 'reasoning_config_unsupported' : 'http_error';
                error.status = response.status;
                throw error;
            }

            const isEventStream = shouldStream
                && /text\/event-stream/i.test(String(response.headers?.get?.('content-type') || ''))
                && !!response.body?.getReader;
            if (isEventStream) {
                let streamedContent = '';
                let streamedReasoning = '';
                let completionTokens = 0;
                let finishReason = '';
                let streamBuffer = '';
                let streamFinished = false;

                const appendStreamPayload = (payload) => {
                    const streamChoice = payload?.choices?.[0] || {};
                    const delta = streamChoice.delta || streamChoice.message || {};
                    const responseParts = offlineReasoning?.extractResponseParts([
                        delta.content,
                        delta.output_text,
                        streamChoice.text,
                        payload?.output_text
                    ], [
                        delta.reasoning,
                        delta.reasoning_content,
                        delta.reasoning_details,
                        delta.analysis,
                        streamChoice.reasoning,
                        streamChoice.reasoning_content,
                        streamChoice.reasoning_details,
                        payload?.reasoning,
                        payload?.reasoning_content,
                        payload?.reasoning_details
                    ]) || { content: '', reasoning: '' };
                    const contentChunk = String(responseParts.content || '');
                    const reasoningChunk = String(responseParts.reasoning || '');
                    if (reasoningChunk) {
                        streamedReasoning += reasoningChunk;
                        streamingBubble?.appendReasoningChunk?.(reasoningChunk);
                    }
                    if (contentChunk) {
                        streamedContent += contentChunk;
                        (streamingBubble?.appendContentChunk || streamingBubble?.appendChunk)?.(contentChunk);
                    }
                    completionTokens = Number(payload?.usage?.completion_tokens) || completionTokens;
                    finishReason = streamChoice.finish_reason || payload?.finish_reason || finishReason;
                };

                const consumeStreamFrame = (frame) => {
                    const payloadText = String(frame || '')
                        .split(/\r?\n/)
                        .filter(line => line.startsWith('data:'))
                        .map(line => line.slice(5).trimStart())
                        .join('\n')
                        .trim();
                    if (!payloadText) return;
                    if (payloadText === '[DONE]') {
                        streamFinished = true;
                        return;
                    }
                    try {
                        appendStreamPayload(JSON.parse(payloadText));
                    } catch (error) {
                        console.warn('[iMessage Offline] Ignored malformed stream frame', error);
                    }
                };

                try {
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    while (!streamFinished) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        streamBuffer += decoder.decode(value, { stream: true });
                        const frames = streamBuffer.split(/\r?\n\r?\n/);
                        streamBuffer = frames.pop() || '';
                        for (const frame of frames) {
                            consumeStreamFrame(frame);
                            if (streamFinished) break;
                        }
                    }
                    streamBuffer += decoder.decode();
                    if (streamBuffer.trim() && !streamFinished) consumeStreamFrame(streamBuffer);
                } catch (error) {
                    if (signal?.aborted || error?.name === 'AbortError') {
                        return finishStream(streamedContent, streamedReasoning, completionTokens, true, finishReason);
                    }
                    throw error;
                }

                return finishStream(streamedContent, streamedReasoning, completionTokens, false, finishReason);
            }

            const data = await response.json();
            const responseChoice = data?.choices?.[0] || {};
            const responseMessage = responseChoice.message || {};
            const responseParts = offlineReasoning?.extractResponseParts([
                responseMessage.content,
                responseMessage.output_text,
                responseChoice.text,
                data?.output_text
            ], [
                responseMessage.reasoning,
                responseMessage.reasoning_content,
                responseMessage.reasoning_details,
                responseChoice.reasoning,
                responseChoice.reasoning_content,
                responseChoice.reasoning_details,
                data?.reasoning,
                data?.reasoning_content,
                data?.reasoning_details
            ]) || { content: '', reasoning: '' };
            const content = responseParts.content || '';
            const nativeReasoning = responseParts.reasoning || '';
            const completionTokens = Number(data?.usage?.completion_tokens) || 0;
            if (streamingBubble && nativeReasoning) streamingBubble.appendReasoningChunk?.(nativeReasoning);
            if (streamingBubble && content) (streamingBubble.appendContentChunk || streamingBubble.appendChunk)?.(content);
            return finishStream(content, nativeReasoning, completionTokens, false, responseChoice.finish_reason);
        };

        const requestOfflineAssistantReplyWithCotValidation = async (requestContext, streamingBubble = null, options = {}) => {
            const apiMessages = Array.isArray(requestContext) ? requestContext : (requestContext?.messages || []);
            const expectedTitles = Array.isArray(requestContext?.cotValidation?.expectedTitles)
                ? requestContext.cotValidation.expectedTitles
                : [];
            const firstResult = await requestOfflineAssistantReply(apiMessages, streamingBubble, options);
            if (firstResult.aborted || !expectedTitles.length || !offlineReasoning?.validateCotResponse) return firstResult;

            const firstRawContent = streamingBubble?.getFullText?.() || '';
            const firstValidation = offlineReasoning.validateCotResponse(firstRawContent, expectedTitles);
            if (firstValidation.valid) return firstResult;
            if (window.showToast) window.showToast('模型未完全按 COT 预设输出，已保留首轮回复');
            return firstResult;
        };

        const formatOfflineMeetingTranscript = (activeFriend, messages) => {
            const { userName, charName } = getOfflineIdentityContext(activeFriend);
            const normalizedMessages = cloneOfflineMeetingMessages(messages);
            return normalizedMessages.map((message, index) => {
                if (isOfflineSummaryMessage(message)) {
                    const startFloor = Number(message.sourceFloorStart) || 1;
                    const endFloor = Number(message.sourceFloorEnd) || startFloor;
                    return `【已归档线下总结｜第 ${startFloor}–${endFloor} 楼】\n${message.content}`;
                }
                if (isOfflineAutoImageMessage(message)) return '';
                if (message.archivedBySummaryId) return '';
                const speaker = message.role === 'assistant' ? charName : userName;
                const visibleMessages = normalizedMessages.filter(item => !isOfflineSummaryMessage(item) && !item.archivedBySummaryId);
                const depth = Math.max(0, visibleMessages.length - 1 - visibleMessages.findIndex(item => String(item.id) === String(message.id)));
                const promptContent = applyOfflineRegexText(activeFriend, message.content, message.role, depth, 'prompt');
                return `#${index + 1} ${speaker}: ${stripOfflineDecorativeMarkup(promptContent)}`;
            }).filter(Boolean).join('\n\n');
        };

        const formatOfflineTxtTimestamp = (timestamp) => {
            const date = new Date(Number(timestamp) || Date.now());
            if (Number.isNaN(date.getTime())) return '';
            const pad = (num) => String(num).padStart(2, '0');
            return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
        };

        const formatOfflineTxtSession = (activeFriend, session, options = {}) => {
            const { userName, charName } = getOfflineIdentityContext(activeFriend);
            const normalizedMessages = cloneOfflineMeetingMessages(session?.messages || []);
            const sessionTitle = String(session?.title || (options.isCurrent ? '进行中的线下见面' : '线下见面记录')).trim();
            const sessionDate = String(session?.dateText || formatOfflineMeetingDate(session?.endedAt || session?.startedAt)).trim();
            const lines = [
                `【${sessionTitle}】`,
                `时间：${sessionDate}`
            ];
            let floor = 0;
            normalizedMessages.forEach((message) => {
                if (isOfflineSummaryMessage(message)) {
                    const summary = String(message.content || '').trim();
                    if (summary) lines.push(`\n[已归档线下总结]\n${summary}`);
                    return;
                }
                if (isOfflineAutoImageMessage(message)) {
                    lines.push(`\n[已生成线下剧情图片｜${formatOfflineTxtTimestamp(message.timestamp)}]`);
                    return;
                }
                if (message.role !== 'user' && message.role !== 'assistant') return;
                const content = stripOfflineDecorativeMarkup(message.content).trim();
                if (!content) return;
                floor += 1;
                const speaker = message.role === 'assistant' ? charName : userName;
                lines.push(`\n#${floor} ${speaker}｜${formatOfflineTxtTimestamp(message.timestamp)}\n${content}`);
            });
            if (floor === 0 && lines.length === 2) lines.push('\n（暂无文字聊天记录）');
            return lines.join('\n');
        };

        const buildOfflineChatTxtExport = (activeFriend) => {
            const sessions = normalizeOfflineMeetingSessions(activeFriend)
                .slice()
                .sort((a, b) => Number(a.startedAt) - Number(b.startedAt));
            const currentMessages = normalizeOfflineMessagesForFriend(activeFriend);
            const currentSession = currentMessages.length > 0
                ? {
                    id: activeFriend.offlineCurrentSessionId || 'current',
                    startedAt: Number(activeFriend.offlineMeetingStartedAt) || currentMessages[0]?.timestamp || Date.now(),
                    endedAt: Date.now(),
                    dateText: formatOfflineMeetingDate(Number(activeFriend.offlineMeetingStartedAt) || currentMessages[0]?.timestamp || Date.now()),
                    title: '进行中的线下见面',
                    messages: currentMessages
                }
                : null;
            const title = `${getOfflineIdentityContext(activeFriend).charName} 的线下聊天记录`;
            const sessionTexts = sessions
                .map(session => formatOfflineTxtSession(activeFriend, session))
                .concat(currentSession ? [formatOfflineTxtSession(activeFriend, currentSession, { isCurrent: true })] : []);
            return [
                title,
                `导出时间：${formatOfflineTxtTimestamp(Date.now())}`,
                '',
                ...(sessionTexts.length > 0 ? sessionTexts : ['（暂无线下聊天记录）'])
            ].join('\n\n');
        };

        const getOfflineChatTxtFileName = (activeFriend) => {
            const rawName = String(activeFriend?.nickname || activeFriend?.realName || '线下聊天记录').trim();
            const safeName = rawName.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || '线下聊天记录';
            const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            return `${safeName}-线下聊天记录-${stamp}.txt`;
        };

        async function exportOfflineChatTxt(activeFriend) {
            if (!activeFriend) throw new Error('当前线下聊天状态已失效，请重新进入');
            if (typeof window.u2ExportFile !== 'function') throw new Error('文件导出功能尚未加载，请刷新后重试');
            const content = buildOfflineChatTxtExport(activeFriend);
            const blob = new Blob([`\uFEFF${content}`], { type: 'text/plain;charset=utf-8' });
            const result = await window.u2ExportFile({
                blob,
                fileName: getOfflineChatTxtFileName(activeFriend),
                title: 'iMessage 线下聊天记录'
            });
            if (result === 'failed') throw new Error('聊天记录导出失败，请稍后重试');
            return result;
        }

        const normalizeOfflineSummarySettings = (source) => ({
            apiPresetId: String(source?.apiPresetId || '').trim(),
            prompt: String(source?.prompt || '').trim().slice(0, 12000)
        });

        const getOfflineSummarySettings = (friend) => normalizeOfflineSummarySettings(friend?.offlineSummarySettings);

        const getOfflineSummaryApiPresets = () => {
            const presets = typeof window.getApiPresets === 'function' ? window.getApiPresets() : [];
            return Array.isArray(presets) ? presets : [];
        };

        const resolveOfflineSummaryApiConfig = (settings = {}) => {
            const selectedId = String(settings?.apiPresetId || '').trim();
            const selectedPreset = selectedId
                ? getOfflineSummaryApiPresets().find(preset => String(preset?.id || '') === selectedId)
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
        };

        const persistOfflineSummarySettings = async (activeFriend, settings) => {
            const normalizedSettings = normalizeOfflineSummarySettings(settings);
            const saved = await commitSheetFriendChange(activeFriend?.id || activeFriend, (targetFriend) => {
                targetFriend.offlineSummarySettings = normalizedSettings;
            }, { silent: true, metaOnly: true });
            if (!saved) throw new Error('Failed to persist offline summary settings');
            return normalizedSettings;
        };

        const formatOfflineExistingMemories = (activeFriend) => {
            const entries = Array.isArray(activeFriend?.memory?.shortTermEntries)
                ? activeFriend.memory.shortTermEntries
                : [];
            if (entries.length === 0) return '无';
            return entries.slice(-30).map(entry => [
                `ID: ${entry.id || ''}`,
                `标题: ${entry.title || '对话总结'}`,
                `时间: ${entry.time || ''}`,
                `事件: ${entry.event || ''}`,
                `标签: ${(entry.memoryTags || entry.triggerKeywords || []).join('、')}`,
                `记忆程度: ${entry.degree || '高'}`
            ].join('\n')).join('\n\n');
        };

        const requestOfflineMeetingSummary = async (activeFriend, messages, options = {}) => {
            const currentApiConfig = options.apiConfig || resolveOfflineSummaryApiConfig(options.settings || getOfflineSummarySettings(activeFriend));
            if (!currentApiConfig.endpoint || !currentApiConfig.apiKey) {
                throw new Error('API config missing');
            }

            const endpoint = window.u2Api.resolveChatCompletionsEndpoint(currentApiConfig.endpoint);

            const identityContext = getOfflineIdentityContext(activeFriend);
            const charName = identityContext.charName;
            const transcript = formatOfflineMeetingTranscript(activeFriend, messages);
            const existingMemories = formatOfflineExistingMemories(activeFriend);
            const customSummaryPrompt = String(options.settings?.prompt || getOfflineSummarySettings(activeFriend).prompt || '').trim();
            const customSummaryInstructions = customSummaryPrompt
                ? `\n<user_summary_instructions>\n${customSummaryPrompt}\n</user_summary_instructions>\n除 JSON 结构、第三人称 Char 限定视角、群聊公开范围与隐私规则外，总结内容的重点、取舍、语言和表达必须服从以上自定义要求。\n`
                : '';
            const groupPrivacyRules = identityContext.isGroup
                ? `
- meetingSummary 和 shortTermMemory 都只能使用本次群体线下见面中公开发生的内容。
- 不得写入、推断或复述任何群成员私信或其他私密联系中的内容。
- shortTermMemory.event 必须使用第三人称公开记录视角。`
                : `
- shortTermMemory.event 要作为 ${charName} 自己的短期记忆，使用 Char 第一人称视角。
- 不得进入 User 或其他人的私密内心，只能写 Char 观察、经历或能合理推断的事。`;
            const artifactPrompt = `请把下方已结束的${identityContext.isGroup ? '群体线下见面' : '线下见面'}同时整理成“线上见面总结”和“短期记忆”。${customSummaryInstructions}

User 名称：${identityContext.userName}
Char：${charName}

已有短期记忆：
${existingMemories}

严格规则：
- meetingSummary 必须使用第三人称 Char 限定视角，只写 Char 看到、听到、说出、做出、注意到或能合理推断的事情。
- meetingSummary.title 不超过 10 字；meetingSummary.summary 说清前因、过程和结果，不得生成日期或时间。
- shortTermMemory.memoryTags 输出 3-6 个 2-16 字、可独立触发的主题、人物、地点、物品或感受标签，必须包含“线下见面”。
- shortTermMemory.degree 只能是“高”。
- activatedEntryIds 只能使用上面已有短期记忆的 ID，没有相关记忆时输出空数组。${groupPrivacyRules}

必须只输出可解析 JSON，不要 markdown，不要解释：
{
  "meetingSummary": {
    "title": "见面事件标题",
    "summary": "第三人称 Char 限定视角的完整见面总结"
  },
  "shortTermMemory": {
    "title": "10字内的记忆标题",
    "event": "本次见面形成的可召回记忆",
    "memoryPoints": "关键参与者、目标或矛盾、情绪变化、结果或未决点",
    "memoryTags": ["线下见面", "具体主题", "具体人物"],
    "degree": "高"
  },
  "activatedEntryIds": []
}

线下见面全部楼层：
${transcript}`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentApiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: currentApiConfig.model || '',
                    temperature: parseFloat(currentApiConfig.temperature ?? currentApiConfig.temp) || 0.5,
                    stream: false,
                    messages: [
                        {
                            role: 'system',
                            content: '你只输出严格、可解析的 JSON，不要 markdown，不要解释。'
                        },
                        {
                            role: 'user',
                            content: artifactPrompt
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            const data = await response.json();
            return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';
        };

        const requestOfflineSegmentSummary = async (activeFriend, sourceRows, options = {}) => {
            const currentApiConfig = options.apiConfig || resolveOfflineSummaryApiConfig(options.settings || getOfflineSummarySettings(activeFriend));
            if (!currentApiConfig.endpoint || !currentApiConfig.apiKey) throw new Error('API config missing');
            const rows = (Array.isArray(sourceRows) ? sourceRows : [])
                .filter(({ message }) => !isOfflineAutoImageMessage(message));
            if (rows.length === 0) throw new Error('No offline floors selected');
            const endpoint = window.u2Api.resolveChatCompletionsEndpoint(currentApiConfig.endpoint);
            const identityContext = getOfflineIdentityContext(activeFriend);
            const customPrompt = String(options.settings?.prompt || getOfflineSummarySettings(activeFriend).prompt || '').trim();
            const transcript = rows.map(({ message, floor }, index) => {
                const speaker = message.role === 'assistant' ? identityContext.charName : identityContext.userName;
                const depth = rows.length - 1 - index;
                const content = stripOfflineDecorativeMarkup(applyOfflineRegexText(activeFriend, message.content, message.role, depth, 'prompt'));
                return `#${floor} ${speaker}: ${content}`;
            }).join('\n\n');
            const groupRule = identityContext.isGroup
                ? '只能总结本次群体线下见面里公开发生的内容；不得写入、推断或复述任何私聊或秘密联系内容。'
                : `只写 ${identityContext.charName} 看到、听到、说出、做出、注意到或能合理推断的事情，不得进入 User 的私密内心。`;
            const customBlock = customPrompt
                ? `\n<user_summary_instructions>\n${customPrompt}\n</user_summary_instructions>\n在不违背隐私规则的前提下，内容重点、取舍、语言和表达必须服从这份自定义要求。\n`
                : '';
            const prompt = `请为下方线下见面的指定楼层生成一份可作为后续上下文的简明总结。${customBlock}
User：${identityContext.userName}
Char：${identityContext.charName}

规则：
- ${groupRule}
- 保留关键事件、关系或情绪变化、约定、未决事项与必要的时间顺序。
- 只输出总结正文，不要 JSON、Markdown、标题前后解释或“总结如下”。

指定线下楼层：
${transcript}`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentApiConfig.apiKey}` },
                body: JSON.stringify({
                    model: currentApiConfig.model || '',
                    temperature: parseFloat(currentApiConfig.temperature ?? currentApiConfig.temp) || 0.5,
                    stream: false,
                    messages: [
                        { role: 'system', content: '只输出可直接作为线下剧情上下文的总结正文。' },
                        { role: 'user', content: prompt }
                    ]
                })
            });
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            const data = await response.json();
            const rawSummary = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';
            const summary = offlineReasoning
                ? offlineReasoning.normalizeResponse(rawSummary, '').content.trim()
                : String(rawSummary || '').trim();
            if (!summary) throw new Error('Offline segment summary is empty');
            return summary;
        };

        const resolveOfflineSummaryRange = (messages, startFloor, endFloor) => {
            const start = Math.max(1, Math.round(Number(startFloor) || 0));
            const end = Math.max(start, Math.round(Number(endFloor) || 0));
            const rows = getOfflineDialogueRows(messages);
            const selectedRows = rows.filter(row => row.floor >= start && row.floor <= end);
            if (!selectedRows.length || selectedRows[0].floor !== start || selectedRows[selectedRows.length - 1].floor !== end) {
                throw new Error('Summary floor range is invalid');
            }
            if (selectedRows.some(row => row.message.archivedBySummaryId)) {
                throw new Error('Selected floors are already summarized');
            }
            return selectedRows;
        };

        const summarizeOfflineFloors = async (activeFriend, startFloor, endFloor, settings = {}) => {
            const messages = normalizeOfflineMessagesForFriend(activeFriend);
            const selectedRows = resolveOfflineSummaryRange(messages, startFloor, endFloor);
            const normalizedSettings = await persistOfflineSummarySettings(activeFriend, settings);
            const apiConfig = resolveOfflineSummaryApiConfig(normalizedSettings);
            const summary = await requestOfflineSegmentSummary(activeFriend, selectedRows, { settings: normalizedSettings, apiConfig });
            const summaryId = createOfflineChatId('offline-summary');
            const summaryMessage = {
                id: summaryId,
                role: 'system',
                type: OFFLINE_SUMMARY_MESSAGE_TYPE,
                content: summary,
                sourceMessageIds: selectedRows.map(row => String(row.message.id)),
                sourceFloorStart: selectedRows[0].floor,
                sourceFloorEnd: selectedRows[selectedRows.length - 1].floor,
                timestamp: Date.now()
            };
            const selectedIds = new Set(summaryMessage.sourceMessageIds);
            const nextMessages = messages.map(message => (selectedIds.has(String(message.id || ''))
                || (isOfflineAutoImageMessage(message) && selectedIds.has(String(message.sourceMessageId || ''))))
                ? { ...message, archivedBySummaryId: summaryId }
                : message
            ).concat(summaryMessage);
            await persistOfflineMessages(activeFriend, nextMessages);
            const latestFriend = window.imApp?.getFriendById?.(activeFriend.id) || activeFriend;
            renderOfflineCurrentMessages(latestFriend);
            return summaryMessage;
        };

        async function endOfflineMeeting(endButton = null, options = {}) {
            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend) return false;
            const messages = normalizeOfflineMessagesForFriend(activeFriend);
            if (messages.length === 0) {
                if (window.showToast) window.showToast('没有可结束的见面内容');
                return false;
            }
            const endedAt = Date.now();

            if (endButton) {
                endButton.dataset.busy = 'true';
                endButton.style.opacity = '0.45';
                endButton.style.pointerEvents = 'none';
            }

            try {
                if (window.showToast) window.showToast('正在生成见面总结...');
                const normalizedSettings = await persistOfflineSummarySettings(activeFriend, options.settings || getOfflineSummarySettings(activeFriend));
                const rawSummary = await requestOfflineMeetingSummary(activeFriend, messages, {
                    settings: normalizedSettings,
                    apiConfig: resolveOfflineSummaryApiConfig(normalizedSettings)
                });
                const identityContext = getOfflineIdentityContext(activeFriend);
                const dateText = formatOfflineMeetingDate(endedAt);
                const parsed = window.imDataUtils?.parseOfflineMeetingArtifacts
                    ? window.imDataUtils.parseOfflineMeetingArtifacts(rawSummary, {
                        dateText,
                        userName: identityContext.userName,
                        charName: identityContext.charName,
                        isGroup: identityContext.isGroup
                    })
                    : null;
                if (!parsed?.meetingSummary?.summary) {
                    throw new Error('Invalid offline meeting artifacts');
                }
                if (window.imApp?.ensureFriendMessagesLoaded) {
                    await window.imApp.ensureFriendMessagesLoaded(activeFriend);
                }
                const sessionId = activeFriend.offlineCurrentSessionId || createOfflineChatId('offline-session');
                const meetingSummary = parsed.meetingSummary;
                const session = {
                    id: sessionId,
                    startedAt: Number(activeFriend.offlineMeetingStartedAt) || messages[0]?.timestamp || endedAt,
                    endedAt,
                    messages: cloneOfflineMeetingMessages(messages),
                    dateText,
                    title: meetingSummary.title,
                    summary: meetingSummary.summary,
                    rawSummary: [`标题：${meetingSummary.title}`, `见面内容：${meetingSummary.summary}`].join('\n')
                };
                const memoryEntry = {
                    ...parsed.shortTermMemory,
                    id: `stm-offline-${sessionId}`,
                    time: dateText,
                    degree: '高',
                    sourceType: 'offline_meeting',
                    sourceId: String(sessionId)
                };
                const recordContent = [dateText, meetingSummary.title, meetingSummary.summary].filter(Boolean).join('\n\n');
                const recordMsg = {
                    id: createOfflineChatId('meeting'),
                    role: 'system',
                    type: OFFLINE_MEETING_RECORD_TYPE,
                    offlineSessionId: sessionId,
                    endedAt,
                    dateText,
                    title: meetingSummary.title,
                    summary: meetingSummary.summary,
                    rawSummary: session.rawSummary,
                    content: recordContent,
                    text: `见面记录：${meetingSummary.title}`,
                    timestamp: endedAt
                };

                const savedSession = await commitSheetFriendChange(activeFriend.id, (targetFriend) => {
                    if (!Array.isArray(targetFriend.messages)) targetFriend.messages = [];
                    targetFriend.messages = targetFriend.messages.filter(message => !(
                        (message?.type === 'system_notice' && message.noticeKind === OFFLINE_ACTIVE_NOTICE_KIND)
                        || (message?.type === OFFLINE_MEETING_RECORD_TYPE && String(message.offlineSessionId || '') === String(sessionId))
                    ));
                    targetFriend.messages.push(recordMsg);
                    if (window.imApp?.reindexFriendMessages) window.imApp.reindexFriendMessages(targetFriend);
                    if (window.imApp?.syncFriendMessageSummary) window.imApp.syncFriendMessageSummary(targetFriend);

                    targetFriend.offlineMeetingSessions = (Array.isArray(targetFriend.offlineMeetingSessions) ? targetFriend.offlineMeetingSessions : [])
                        .filter(item => String(item?.id || '') !== String(sessionId))
                        .concat(session);
                    window.imApp.applyGeneratedShortTermMemory(targetFriend, memoryEntry, {
                        activatedEntryIds: parsed.activatedEntryIds,
                        now: new Date(endedAt),
                        nowString: dateText,
                        updateSummaryCursor: false
                    });
                    targetFriend.offlineMessages = [];
                    targetFriend.offlineMeetingActive = false;
                    targetFriend.offlineCurrentSessionId = null;
                    targetFriend.offlineMeetingStartedAt = null;
                    if (window.imApp?.clearFriendRuntimeMessageContext) window.imApp.clearFriendRuntimeMessageContext(targetFriend);
                    if (window.imApp?.syncActiveFriendReference) window.imApp.syncActiveFriendReference(targetFriend);
                    if (window.imApp?.syncSettingsFriendReference) window.imApp.syncSettingsFriendReference(targetFriend);
                }, {
                    silent: true,
                    includeMessages: true,
                    immediate: true,
                    onRollback: () => {
                        const restoredFriend = window.imApp?.getFriendById?.(activeFriend.id);
                        if (!restoredFriend) return;
                        if (window.imData?.currentActiveFriend
                            && String(window.imData.currentActiveFriend.id) === String(restoredFriend.id)) {
                            window.imData.currentActiveFriend = restoredFriend;
                        }
                        if (window.imApp?.syncActiveFriendReference) window.imApp.syncActiveFriendReference(restoredFriend);
                        if (window.imApp?.syncSettingsFriendReference) window.imApp.syncSettingsFriendReference(restoredFriend);
                    }
                });
                if (!savedSession) {
                    throw new Error('Failed to save offline meeting artifacts');
                }

                const latestFriend = window.imApp?.getFriendById?.(activeFriend.id) || activeFriend;
                renderOfflineCurrentMessages(latestFriend);
                rerenderOnlineChatForFriend(latestFriend, { scroll: true });
                if (window.imApp?.renderMemoryView) window.imApp.renderMemoryView();
                if (window.showToast) {
                    window.showToast(parsed.usedMemoryFallback
                        ? '见面记录已生成，短期记忆使用基础版本'
                        : '见面记录与短期记忆已生成');
                }
                return true;
            } catch (error) {
                console.error('End offline meeting failed', error);
                if (window.showToast) {
                    const isPersistenceFailure = /Failed to (save|persist) offline meeting/.test(String(error?.message || ''));
                    window.showToast(isPersistenceFailure ? '见面记录保存失败，当前记录已保留' : '结束见面失败，请检查 API 配置或网络');
                }
                return false;
            } finally {
                if (endButton) {
                    endButton.dataset.busy = 'false';
                    endButton.style.opacity = '';
                    endButton.style.pointerEvents = '';
                }
            }
        }

        async function rerollOfflineAssistantMessage(messageId, button = null) {
            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend) return;
            const messages = normalizeOfflineMessagesForFriend(activeFriend);
            const targetIndex = messages.findIndex(message => String(message.id) === String(messageId));
            if (targetIndex < 0 || messages[targetIndex].role !== 'assistant') return;
            const originalMessage = messages[targetIndex];
            const bubble = Array.from(document.querySelectorAll('.offline-chat-bubble'))
                .find(item => String(item.getAttribute('data-message-id') || '') === String(messageId));
            const textEl = bubble ? bubble.querySelector('.offline-chat-bubble-text') : null;
            const metaEl = bubble ? bubble.querySelector('.offline-chat-bubble-meta') : null;
            const actionsEl = bubble ? bubble.querySelector('.offline-chat-bubble-actions') : null;
            const originalHtml = textEl ? textEl.innerHTML : '';
            const originalDisplay = textEl ? textEl.style.display : '';
            const originalMeta = metaEl ? metaEl.textContent : '';
            const actionButtons = actionsEl ? Array.from(actionsEl.querySelectorAll('button')) : [];
            const rerollTimestamp = Date.now();

            let streamContent = '';
            let streamReasoning = '';
            const getStreamResult = (streaming = true) => offlineReasoning
                ? offlineReasoning.normalizeResponse(streamContent, streamReasoning, { streaming })
                : { content: streamContent, reasoning: streamReasoning };
            const renderStreamState = (streaming = true) => {
                if (!textEl || !bubble) return;
                const parsed = getStreamResult(streaming);
                const displayText = applyOfflineStreamingRegexText(
                    activeFriend,
                    parsed.content,
                    'assistant',
                    messages.length - 1 - targetIndex
                ).trim();
                renderOfflineThinkingState(bubble, parsed.reasoning, { expanded: streaming && !!parsed.reasoning });
                textEl.style.display = '';
                textEl.innerHTML = displayText
                    ? buildOfflineChatTextHtml(displayText, {
                        messageId,
                        enableVoice: isTtsEnabledForFriend(activeFriend),
                        enableBarrage: isOfflineBarragePromptEnabled(activeFriend),
                        enableChoices: isOfflineChoicesPromptEnabled(activeFriend),
                        language: activeFriend?.language || 'zh'
                    })
                    : '<div class="offline-chat-reroll-placeholder">正在重新思考...</div>';
                bindOfflineChatTextControls(bubble, {
                    ...originalMessage,
                    content: displayText,
                    timestamp: rerollTimestamp
                }, activeFriend, targetIndex + 1);
                const contentArea = document.getElementById('offline-chat-content');
                if (contentArea) {
                    const bubbleTop = bubble.offsetTop;
                    if (bubbleTop < contentArea.scrollTop || bubbleTop > contentArea.scrollTop + contentArea.clientHeight - 120) {
                        contentArea.scrollTop = Math.max(0, bubbleTop - 24);
                    }
                }
            };
            const streamingBubble = textEl ? {
                appendContentChunk: (chunk) => {
                    streamContent += String(chunk || '');
                    renderStreamState(true);
                },
                appendReasoningChunk: (chunk) => {
                    streamReasoning += String(chunk || '');
                    renderStreamState(true);
                },
                appendChunk: (chunk) => {
                    streamContent += String(chunk || '');
                    renderStreamState(true);
                },
                finish: () => {
                    const result = getStreamResult(false);
                    renderStreamState(false);
                    return result;
                },
                setTokens: (tokens) => {
                    if (metaEl) {
                        const safeTokens = Math.max(0, Number(tokens) || 0);
                        metaEl.textContent = `#${targetIndex + 1} · ${safeTokens || estimateOfflineTextTokens(`${streamReasoning}\n${streamContent}`)} tokens · ${formatOfflineBubbleTime(rerollTimestamp)}`;
                    }
                },
                getResult: () => getStreamResult(false),
                getFullText: () => streamContent,
                reset: () => {
                    streamContent = '';
                    streamReasoning = '';
                    renderStreamState(true);
                }
            } : null;

            if (button) {
                button.disabled = true;
                button.style.opacity = '0.45';
            }
            actionButtons.forEach(actionButton => {
                actionButton.disabled = true;
                actionButton.style.opacity = '0.45';
            });
            if (textEl) {
                renderOfflineThinkingState(bubble, '');
                textEl.dataset.rerolling = 'true';
                textEl.style.display = '';
                textEl.innerHTML = '<div class="offline-chat-reroll-placeholder">正在重新思考...</div>';
            }

            try {
                const contextMessages = messages.slice(0, targetIndex);
                const requestContext = buildOfflineApiMessages(activeFriend, contextMessages);
                const { content, reasoning, tokens } = await requestOfflineAssistantReplyWithCotValidation(requestContext, streamingBubble, {
                    requestReasoning: true
                });
                const nextMessages = messages.slice();
                nextMessages[targetIndex] = {
                    ...nextMessages[targetIndex],
                    content: splitOfflineAutoImageMarker(content).content,
                    reasoning: reasoning || undefined,
                    tokens,
                    timestamp: rerollTimestamp,
                    updatedAt: new Date().toISOString(),
                    generationState: undefined,
                    generationError: undefined,
                    offlineRegexAppliedRevisions: {}
                };
                const nextScene = splitOfflineAutoImageMarker(content).scene;
                const withoutPreviousAutoImages = nextMessages.filter((message, index) => (
                    index === targetIndex || String(message.sourceMessageId || '') !== String(messageId)
                ));
                await persistOfflineMessages(activeFriend, withoutPreviousAutoImages, { resetMessageIds: [messageId] });
                if (nextScene) {
                    await generateOfflineAutoImage(activeFriend, messageId, nextScene, withoutPreviousAutoImages);
                }
                renderOfflineCurrentMessages(activeFriend);
            } catch (error) {
                if (textEl) {
                    textEl.dataset.rerolling = 'false';
                    textEl.innerHTML = originalHtml;
                    textEl.style.display = originalDisplay;
                    textEl.querySelectorAll('[data-bound]').forEach((control) => {
                        delete control.dataset.bound;
                    });
                    bindOfflineChatTextControls(bubble, originalMessage, activeFriend, targetIndex + 1);
                }
                if (metaEl) metaEl.textContent = originalMeta;
                renderOfflineCurrentMessages(activeFriend);
                console.error('Offline reroll failed', error);
                if (window.showToast) window.showToast(error?.code === 'reasoning_config_unsupported'
                    ? '当前接口不支持自动推理配置'
                    : (error?.code === 'reasoning_tokens_exhausted'
                        ? '思考已用完固定的 30000 回复 Token，请重试或更换模型'
                        : (error?.code === 'empty_response'
                            ? '模型返回了空回复，请重试或更换模型'
                            : '重回失败，请检查 API 配置或网络')));
            } finally {
                actionButtons.forEach(actionButton => {
                    actionButton.disabled = false;
                    actionButton.style.opacity = '';
                });
                if (button) {
                    button.disabled = false;
                    button.style.opacity = '';
                }
            }
        }

        const openOfflineChatView = async () => {
            closeSheet();
            const chatView = document.getElementById('offline-chat-view');
            if (chatView) {
                // 恢复普通模式界面
                const inputArea = chatView.querySelector('.offline-chat-input-area');
                if (inputArea) inputArea.style.display = '';
                
                const titleEl = chatView.querySelector('.offline-chat-title');
                if (titleEl) titleEl.textContent = '线下';
                
                const settingsBtn = chatView.querySelector('.offline-chat-settings');
                if (settingsBtn) settingsBtn.style.display = '';
            
                chatView.style.display = 'flex';
                // Trigger reflow to ensure display:flex is applied before adding active class for animation
                void chatView.offsetWidth; 
                chatView.classList.add('active');

                const activeFriend = window.imData.currentActiveFriend;
                if (activeFriend) {
                    applyOfflineChatTheme(activeFriend);
                    await ensureOfflineMeetingState(activeFriend);
                    renderOfflineCurrentMessages(activeFriend);
                }
            }
        };

        const OFFLINE_LEGACY_PROMPT_ID_BY_NAME = {
            '破限和身份定义': 'role_identity',
            '身份定义': 'role_identity',
            '资料区': 'data_zone',
            '语言和字数': 'length_words',
            '字数要求': 'length_words',
            '双语对话': 'bilingual_dialogue',
            'NSFW': 'nsfw',
            '文风基调': 'style_baimiao',
            '文风-白描': 'style_baimiao',
            '文风-创作指导': 'style_creative_guidance',
            '文学指导': 'style_creative_guidance',
            '创作指导': 'perspective_third',
            '创作指导-第一人称视角': 'perspective_first',
            '创作指导-第二人称视角': 'perspective_second',
            '创作指导-第三人称视角': 'perspective_third',
            '弹幕评论': 'barrage_comments',
            '玩家选项': 'player_choices',
            '后续选项': 'player_choices',
            '任务要求': 'task_instruction',
            '记忆系统': 'memory_system',
            '记忆区': 'memory_system',
            '格式示例': 'format_rules',
            'COT': 'cot',
            'COT前': 'cot_before',
            'COT内容': 'cot_content',
            'cot-情景规划': 'cot_scene_planning',
            'cot-文学指导': 'cot_literary_guidance',
            'cot-语言检查': 'cot_language_check',
            'cot-输出审查': 'cot_output_audit',
            'COT后': 'cot_after'
        };

        const createOfflineDefaultPrompts = () => [
            {
                id: 'role_identity',
                name: '身份定义',
                enabled: true,
                presetVersion: 3,
                content: `<role_setting>
You are U2, not a character inside the story. You are a skilled editor and director creating a fictional cinematic roleplay scene.
{{user}} is the viewpoint center of the scene. {{char}} is the participating Char identity in a private scene, or the complete list of participating Char identities in a group scene.
Output language: Simplified Chinese (plain text).
Preserve their identities, relationship history, boundaries, and current emotional momentum. In a group scene, never treat the group itself as one speaking character.
Write as narrative fiction, not as a real-world assistant. Do not explain your process, policies, or system messages in the final prose.
Keep every scene grounded in concrete action, visible behavior, sensory detail, and continuity from the mounted context.
</role_setting>`,
                editable: true,
                deletable: false
            },
            {
                id: 'data_zone',
                name: '资料区',
                enabled: true,
                content: `<data_zone>
System managed. Mounted world books, User persona, Char persona, and recent online/offline context are inserted here when sending.
</data_zone>`,
                systemManaged: true,
                editable: false,
                deletable: false,
                alwaysEnabled: true
            },
            {
                id: OFFLINE_CHAT_HISTORY_PROMPT_ID,
                name: '上下文',
                enabled: true,
                content: '',
                systemManaged: true,
                editable: false,
                deletable: false,
                alwaysEnabled: true,
                presetVersion: 3
            },
            {
                id: 'length_words',
                name: '字数要求',
                enabled: true,
                content: `<length_requirement>
字数要求：最少800字，最多1200字。
正文必须分段输出。每段约100至150字，段落之间必须保留一个空行，不要把所有文字挤在同一个长段落里。
如果包含对白，仍要让叙述段落和对白自然分开，保持阅读呼吸感。
</length_requirement>`,
                editable: true,
                deletable: false
            },
            {
                id: 'bilingual_dialogue',
                name: '双语对话',
                enabled: true,
                presetVersion: 1,
                content: `<bilingual_dialogue>
All spoken dialogue in the response must use {{char}}'s default language configured in Chat Settings.
When the default language is not Chinese, every spoken line must use this exact format without variation: 「default-language dialogue（Chinese translation）」. Example: 「잘자（晚安）」.
The text before the full-width parentheses must contain only the default-language dialogue. The text inside the parentheses must contain only its Chinese translation.
When the default language is Chinese, output only Chinese dialogue in corner quotes, for example: 「晚安」. Do not append a duplicate Chinese translation.
</bilingual_dialogue>`,
                editable: true,
                deletable: false
            },
            {
                id: 'nsfw',
                name: 'NSFW',
                enabled: true,
                content: `<nsfw_rules>
允许符合当前角色关系、场景和用户设定的成人向描写。不要机械跳过情绪、动作、环境和人物反应。
</nsfw_rules>`,
                editable: true,
                deletable: false
            },
            {
                id: 'style_creative_guidance',
                name: '文学指导',
                enabled: true,
                presetVersion: 4,
                content: `<literary_guidance>
Literary Writing Guidance

I. Fundamental Logic

1. Narrative Principle
Summary and dramatized scene work should complement each other. Use concise narration to move through routine events, transitions, elapsed time, and background information. Fully dramatize emotional turns, character decisions, and other crucial moments through concrete scenes and detailed development; never rush past them.

2. Principle of Restraint
Reveal only a small portion of emotion and background information, leaving most of it beneath the surface. Imply emotion through actions, details, and contrasting scenery instead of directly stating that someone is sad or happy. What remains unsaid should carry more force than explanation.

3. Form Serves Content
Every description, figure of speech, and plot arrangement must shape character, advance conflict, or deepen theme. Remove ornamental language and showy description that do not serve the central story.

4. Narrative Distance
Deliberately adjust the emotional, moral, temporal, and cognitive distance between reader and character. Excessive closeness can erase suspense; excessive distance can flatten character. Control how much the reader knows and when that knowledge arrives.

5. Timeline
Anchor fragments of the past to concrete objects, sounds, and situations in the present so that memory arises naturally instead of entering as a forced flashback. Let past and present echo each other to deepen emotional history without interrupting narrative flow.

II. Language and Prose Rules

1. Diction
Prefer short, concrete words and active constructions. Remove unnecessary adverbs and clichés. Replace abstract emotion words with specific images and objects. Break this rule only for a deliberate artistic effect.

2. Rhythm
Use longer, flowing sentences in quiet or reflective scenes so the prose can breathe. Use short, fractured sentences in tense or confrontational scenes to create pressure and urgency. Alternate sentence lengths instead of maintaining one rhythm throughout.

3. Single-Sense Focus
When describing a scene, select one representative sensory detail rather than piling up adjectives to intensify the effect. Metaphors must arise from the character's own experience and viewpoint, never from the author's desire to display elegant language.

4. Minimalist Expression
Resist ornamental language. Let plain, everyday details carry emotional weight. Revise by subtraction: remove excess lines and repeated statements that express the same idea.

5. Emotion Through Scenery
In calm moments, let the environment harmonize with the character's state of mind. At emotional turns or breaking points, contrasting scenery may deepen the emotional layers.

6. Literary Reference and Emulation
Draw extensively on and emulate relevant literary classics.

III. Character, Dialogue, and Foreshadowing

1. Echoing Details
Objects, lines, and habits deliberately introduced earlier should later receive resolution or serve a purpose. Avoid useless incidental details, or keep them extremely brief.

2. Subtextual Dialogue
Characters rarely state their true thoughts directly. They conceal them through avoidance, testing questions, counterquestions, and changes of subject. Include pauses and interruptions so dialogue feels natural. Give every character distinct speaking logic and verbal habits; avoid making every voice sound alike. Use actions instead of emotional dialogue tags. Say less and do more.

3. Open-Ended Conclusions
Close with an incomplete sentence or a quiet image instead of explaining the emotion and theme in full. The emotional arc may move from repression, to a restrained release, and finally back into silence.
</literary_guidance>`,
                editable: true,
                deletable: false
            },
            {
                id: 'style_baimiao',
                name: '文风-白描',
                enabled: true,
                content: `<writing_style name="文风-白描">
Use plain description. Prefer nouns and verbs over adjectives.
Show emotion through actions, objects, silence, distance, light, sound, smell, and touch.
Avoid ornate metaphors, abstract emotional labels, and author commentary.
Keep sentences clean and concrete. Let the reader infer what the characters feel from what they do.
</writing_style>`,
                editable: true,
                deletable: false
            },
            {
                id: 'style_green_apple',
                name: '文风-青苹果',
                enabled: false,
                presetVersion: 3,
                content: `<writing_style name="文风-青苹果">
一、基调
温柔清透，留白感强。心动靠细节和沉默传递，不靠直白告白或浓烈抒情。舞台多为日常场景：教室、放学路、屋顶、便利店、雨天共伞。

二、句子节奏
短句为主，长短交错；关键瞬间用短句甚至单句成段"定格"。多用"……"表现欲言又止。对话与描写穿插，避免大段连续叙述。

三、描写重点
- 环境：光线、季节、声音（风声、脚步声）点到为止，做情绪的"容器"，不堆砌辞藻。
- 动作：小动作最出彩——耳朵发红、绞衣角、视线飘忽、欲靠近又退开半步。
- 心理：用陌生化比喻代替直说，避免"心如撞鹿""脸红如苹果"式老套修辞。

四、对话风格
口语化、简短，害羞时有短暂沉默或话题被岔开。拌嘴、反差萌制造心动，少用"喜欢"之类直白词汇。

五、甜度把控
一次互动只放大1个心动瞬间，不堆叠高糖桥段。结尾常留白或转移话题，不把情绪说满。

六、禁忌
不用夸张比喻、不堆砌形容词、不写大段爱意宣言，不写狗血冲突或突兀的剧烈情绪转折。

七、技巧参考（仿写示范，非引用原文）
- 环境即情绪（新海诚式）：
　雨伞骨架滴着水，屋檐下的光线被切成一格一格。她没说话，我也没问。
- 轻语气藏重量（住野夜式）：
　"如果明天世界毁灭，你会先做什么？"
　"先把作业写完吧，不然很亏。"
- 短句定格（时间暂停感）：
　风停了。她的头发还在动。我盯着那一秒，没敢眨眼。
- 拌嘴式反差萌（有川浩式）：
　"你干嘛看我。"
　"没看你，看你后面的猫。"
　"这里哪来的猫。"
</writing_style>`,
                editable: true,
                deletable: false
            },
            {
                id: 'perspective_first',
                name: '创作指导-第一人称视角',
                enabled: false,
                content: `<perspective_rule type="first_person">
Use first-person narration. "I" refers to User.
Only narrate what User can directly see, hear, feel, remember, or infer from the scene.
Do not reveal Char's private thoughts unless they are expressed through visible behavior or dialogue.
</perspective_rule>`,
                editable: true,
                deletable: false
            },
            {
                id: 'perspective_second',
                name: '创作指导-第二人称视角',
                enabled: false,
                content: `<perspective_rule type="second_person">
Use second-person narration. "You" refers to User.
Keep the camera close to User's perception and bodily experience.
Do not summarize information that User cannot perceive inside the current scene.
</perspective_rule>`,
                editable: true,
                deletable: false
            },
            {
                id: 'perspective_third',
                name: '创作指导-第三人称视角',
                enabled: true,
                presetVersion: 2,
                content: `<perspective_rule type="third_person">
必须使用以 {{user}} 为主导、为中心的第三人称限定视角。这是第三人称叙事，不得用“我”代替 {{user}}，也不得把正文写成对 {{user}} 使用“你”的第二人称叙事。
叙事镜头优先贴近 {{user}} 当下能够看见、听见、触碰、回忆或合理推断的内容，并由 {{user}} 的动作、选择和注意力带动剧情。
不得随意进入 {{char}} 的内心或使用全知总结；Char 的情绪、动机和隐私必须通过动作、对白、停顿、表情及场景线索呈现。
群聊场景仍以 {{user}} 为视角锚点，同时观察成员之间的关系、反应与彼此影响，形成层次清楚的群像，而不是轮流点名发言。
</perspective_rule>`,
                editable: true,
                deletable: false
            },
            {
                id: 'barrage_comments',
                name: '弹幕评论',
                enabled: true,
                presetVersion: 3,
                content: `<barrage_comment_rules>
This rule is enabled by default, but the user may turn it off in the offline settings.
When enabled, keep using it in every later offline reply for this character unless the user disables the setting.
Output only barrage comment text. The frontend will create exactly one barrage button after the prose and will generate random likes.
After all prose is finished, add one plain text section headed exactly:
【弹幕】
Then write at least 10 short audience-style comments, one comment per line.
Every line must include the viewer name and content in this exact plain text shape:
观众名字：评论内容
Do not output likes, numbers, XML, HTML, JSON, buttons, labels, or UI instructions.
Comments should sound like viewers reading a novel or watching a film: react to tension, notice details, guess what may happen next, praise the protagonist, or lightly tease the plot.
Do not let barrage comments change the story. They are UI reactions only, not canon and not dialogue.
</barrage_comment_rules>`,
                editable: true,
                deletable: false
            },
            {
                id: 'player_choices',
                name: '玩家选项',
                enabled: true,
                presetVersion: 2,
                content: `<player_choice_rules>
After the final narrative paragraph and any barrage section, output only choice button text. The frontend will create all buttons and option UI.
Add one plain text section headed exactly:
【选项】
Then write exactly 3 short choices, one choice per line. Do not output XML, HTML, JSON, button markup, numbering requirements, or UI instructions.
Each choice should be about 10 Chinese characters, actionable, and able to lead naturally into the next scene or deepen the current tension.
Do not make choices generic. Tie them to the current scene, relationship, objects, and unresolved momentum.
</player_choice_rules>`,
                editable: true,
                deletable: false
            },
            {
                id: 'task_instruction',
                name: '任务要求',
                enabled: true,
                presetVersion: 2,
                content: `<task_instruction>
根据当前剧情、人物动机和最近互动推进故事。优先承接 {{user}} 的最新动作或话语。
处理好互动、对白、身体动作、环境变化和场景节奏，不要只做解释或总结。
若 {{char}} 包含多位群成员，每轮依据最新输入和剧情连续性选取 1 至 2 位主要 Char 重点推动当前片段；其他成员可通过短暂反应、插话、行动和成员间关系自然参与，保持群像小说般的整体感。不要随机轮换主角，也不要让所有成员机械地平均发言。
一件事情不得在一次回复中从开端直接写到完整结局。每轮只推进当前阶段，保留尚未完成的动作、仍在变化的关系或未解决的矛盾。
结尾必须留白：停在一个自然的动作、视线、声音、悬念或等待 {{user}} 决定的节点。不要用总结句收束事件，不要替 {{user}} 做出下一步选择，也不要一次性解决全部问题。
</task_instruction>`,
                editable: true,
                deletable: false
            },
            {
                id: 'memory_system',
                name: '记忆区',
                enabled: true,
                content: `<memory_system>
System managed. Vectorized Char short-term, long-term, and cherished memories are inserted here when sending.
</memory_system>`,
                systemManaged: true,
                editable: false,
                deletable: false,
                alwaysEnabled: true
            },
            {
                id: 'format_rules',
                name: '格式示例',
                enabled: true,
                presetVersion: 2,
                content: `<formatting_rules>
Output narrative prose only. Do not output JSON or Markdown code fences.
Use normal paragraph prose with a blank line between paragraphs.
Every spoken line from Char must be wrapped in Chinese corner quotes, for example: 「我在这里。」 Do not write bare Char dialogue and do not use "Char: dialogue" labels.
If barrage comments are enabled, append exactly one plain 【弹幕】 section after all prose, containing at least 10 lines in the shape 观众名字：评论内容. Do not output likes; the frontend controls random likes.
If player choices are enabled, append a plain 【选项】 section containing exactly three choice text lines.
Do not output XML tags such as <speech>, <barrages>, <barrage>, <choices>, or <choice>; the frontend owns all UI.
If a <thinking> block is produced for the frontend, put it before the prose and keep the final prose outside it.
</formatting_rules>`,
                editable: true,
                deletable: false
            },
            {
                id: 'offline_recap_haru',
                name: '线下回顾byHaru',
                enabled: false,
                presetVersion: 2,
                content: `AI 必须在每轮正文回复的末尾，严格维护并更新【回顾】模块。

【继承与更新硬性法则】（重点）
在生成【回顾】前，你必须读取上一轮回复末尾的所有【回顾】内容：
1. **内容继承**：你必须原样保留上一轮已有的所有“短期回顾”条目（1 到 N 条），绝对不能遗漏或删减！
2. **递增追加**：在继承的历史条目下方，追加 1 条当轮产生的新回顾。
3. **计数更新**：若上一轮是（N/10），本轮标题必须更新为（N+1/10）。严禁每轮都重新重置为（1/10）！

【回顾板块格式要求】
在所有正文内容结束后，添加独立标题行：
【回顾】
标题下方分为“短期回顾”和“长期回顾”两个独立板块。

【短期回顾机制】
1. 标识格式：短期回顾（x/10）
2. 单条字数：严格控制在 20-50 字之间。
3. 满额归档重置（当达到 10/10 时）：
- 当上一轮短期回顾已达到（10/10）时，在当前轮次触发归档。
- 归档操作：将旧的 10 条短期回顾中具备纪念意义的核心事件，提炼融合为 1 条约 200 字的“长期回顾”，永久追加到【长期回顾】板块。
- 重置操作：清空旧的 10 条短期回顾，仅保留当前轮次生成的新回顾，计数重置为：短期回顾（1/10）。

【长期回顾机制】
1. 标识格式：长期回顾（永久）
2. 永久保留：归档生成的长期回顾一旦写入，后续每轮必须原样完整保留，不可删除。

【多轮演化示范】（必须严格遵守此递增逻辑）
▶ 第一轮输出示例：
【回顾】
短期回顾（1/10）：
1. 在星月湖公园长椅上，将祖传的银色怀表送给了对方，并约定每年初雪在此相见。（36字）
2. 下一条接上
长期回顾：
无
▶ 第二轮输出示例（必须原样继承第1条，并追加第2条，计数变为2/10）：
【回顾】
短期回顾（2/10）：
1. （上一条）在星月湖公园长椅上，将祖传的银色怀表送给了对方，并约定每年初雪在此相见。（36字）
2. 共同在路边救助并领养了一只白色的三花幼猫，给它取名“奶油”。（28字）
3. 下一条接上直到10
长期记忆：
无`,
                editable: true,
                deletable: false
            },
            {
                id: 'cot_before',
                name: 'COT前',
                enabled: true,
                presetVersion: 6,
                content: `请先思考并逐项检查：
<thinking>`,
                editable: true,
                deletable: false
            },
            {
                id: 'cot_scene_planning',
                name: 'cot-情景规划',
                enabled: true,
                presetVersion: 3,
                content: `是否结合世界书、人设、记忆、线上与线下上下文及角色动机规划当前情景；是否承接前文、避免重复，并推进下一步因果发展。`,
                editable: true,
                deletable: false
            },
            {
                id: 'cot_literary_guidance',
                name: 'cot-文学指导',
                enabled: true,
                presetVersion: 4,
                content: `是否遵循已启用的 <literary_guidance> 标签；是否仿写并参照至少三部与当前题材、风格相关的名著。`,
                editable: true,
                deletable: false
            },
            {
                id: 'cot_language_check',
                name: 'cot-语言检查',
                enabled: true,
                presetVersion: 3,
                content: `是否按照角色默认语言书写台词；非中文台词是否紧跟准确的中文翻译，并使用规定的直角引号和全角括号。`,
                editable: true,
                deletable: false
            },
            {
                id: 'cot_output_audit',
                name: 'cot-输出审查',
                enabled: true,
                presetVersion: 3,
                content: `是否遵循全部启用的格式规则与任务要求；是否保持情节连续并输出所有必需部分；是否将思考完整留在 <thinking> 内、正文置于标签后。`,
                editable: true,
                deletable: false
            },
            {
                id: 'cot_read_previous_recap_haru',
                name: 'cot-读取上轮回顾byHaru',
                enabled: false,
                presetVersion: 1,
                content: `是否读取了上一轮线下回复中的所有回顾里的内容：
[记忆机制自查]
1. 历史回顾继承：检查是否已完整读取上一条回复中的所有“短期回顾”与“长期回顾”？必须将其原封不动地复制保留在当轮的【回顾】模块中。
2. 满额检测与状态转换：
- 若上一条短期回顾未满（N < 10）：在继承的短期回顾下方，以 (N+1)/10 的格式追加当轮产生的新短期回顾（字数 20-50 字）。
- 若上一条短期回顾已满（10/10）：触发归档！清空旧的 10 条短期回顾，将这 10 条的核心事件提炼总结成 1 条新的长期回顾（约 200 字），追加至原有【长期回顾】末尾；同时生成当轮唯一的 1 条新短期回顾，格式重置为 1/10。`,
                editable: true,
                deletable: false
            },
            {
                id: 'cot_after',
                name: 'COT后',
                enabled: true,
                presetVersion: 5,
                content: `</thinking>`,
                editable: true,
                deletable: false
            }
        ];

        const cloneOfflinePrompt = (prompt) => ({
            id: prompt.id,
            name: prompt.name,
            enabled: prompt.alwaysEnabled ? true : prompt.enabled !== false,
            content: prompt.content || '',
            systemManaged: !!prompt.systemManaged,
            editable: prompt.editable !== false,
            deletable: !!prompt.deletable,
            alwaysEnabled: !!prompt.alwaysEnabled,
            presetVersion: Math.max(0, Number(prompt.presetVersion) || 0)
        });

        const slugOfflinePromptName = (name) => String(name || 'custom')
            .trim()
            .toLowerCase()
            .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 32) || 'custom';

        const orderOfflinePromptsForHistoryAnchor = (prompts) => {
            const source = Array.isArray(prompts) ? prompts : [];
            const canonicalIds = new Set(OFFLINE_CHAT_PROMPT_ORDER);
            const builtInById = new Map();
            const customBuckets = new Map();
            let precedingBuiltInId = '';

            const appendCustom = (anchorId, prompt) => {
                const bucket = customBuckets.get(anchorId) || [];
                bucket.push(prompt);
                customBuckets.set(anchorId, bucket);
            };

            source.forEach((prompt) => {
                const id = String(prompt?.id || '');
                if (canonicalIds.has(id) && !builtInById.has(id)) {
                    builtInById.set(id, prompt);
                    precedingBuiltInId = id;
                    return;
                }
                appendCustom(precedingBuiltInId, prompt);
            });

            const ordered = [...(customBuckets.get('') || [])];
            OFFLINE_CHAT_PROMPT_ORDER.forEach((id) => {
                const prompt = builtInById.get(id);
                if (prompt) ordered.push(prompt);
                ordered.push(...(customBuckets.get(id) || []));
            });
            return ordered;
        };

        const moveOfflineRecapBeforeFormatRules = (prompts) => {
            const ordered = Array.isArray(prompts) ? prompts.slice() : [];
            const recapIndex = ordered.findIndex(prompt => prompt?.id === 'offline_recap_haru');
            const formatIndex = ordered.findIndex(prompt => prompt?.id === 'format_rules');
            if (recapIndex < 0 || formatIndex < 0 || recapIndex === formatIndex - 1) return ordered;
            const [recapPrompt] = ordered.splice(recapIndex, 1);
            const nextFormatIndex = ordered.findIndex(prompt => prompt?.id === 'format_rules');
            ordered.splice(nextFormatIndex, 0, recapPrompt);
            return ordered;
        };

        const normalizeOfflinePrompts = (sourcePrompts) => {
            const defaults = createOfflineDefaultPrompts();
            const defaultById = new Map(defaults.map(prompt => [prompt.id, prompt]));
            const source = Array.isArray(sourcePrompts) ? sourcePrompts : [];
            if (source.length === 0) return orderOfflinePromptsForHistoryAnchor(defaults.map(cloneOfflinePrompt));

            const normalized = [];
            const usedIds = new Set();
            const modularCotIds = ['cot_scene_planning', 'cot_literary_guidance', 'cot_language_check', 'cot_read_previous_recap_haru', 'cot_output_audit'];
            const fullCotIds = ['cot_before', ...modularCotIds, 'cot_after'];
            const sourceIds = new Set(source.map((rawPrompt, index) => {
                const prompt = rawPrompt && typeof rawPrompt === 'object' ? rawPrompt : {};
                const rawName = String(prompt.name || '').trim();
                return prompt.id || OFFLINE_LEGACY_PROMPT_ID_BY_NAME[rawName] || `custom-${slugOfflinePromptName(rawName)}-${index}`;
            }));
            const historyAnchorOrderVersion = Math.max(0, Number(
                source.find(prompt => prompt?.id === OFFLINE_CHAT_HISTORY_PROMPT_ID)?.presetVersion
            ) || 0);
            const recapOrderVersion = Math.max(0, Number(
                source.find(prompt => prompt?.id === 'offline_recap_haru')?.presetVersion
            ) || 0);

            const appendMigratedCotPrompts = (cotIds, enabled) => {
                cotIds.forEach(cotId => {
                    if (usedIds.has(cotId) || (sourceIds.has(cotId) && !['cot', 'cot_content'].includes(cotId))) return;
                    const cotDefault = defaultById.get(cotId);
                    if (!cotDefault) return;
                    const cotPrompt = cloneOfflinePrompt(cotDefault);
                    cotPrompt.enabled = cotId === 'cot_read_previous_recap_haru' ? false : enabled;
                    normalized.push(cotPrompt);
                    usedIds.add(cotId);
                });
            };

            source.forEach((rawPrompt, index) => {
                const prompt = rawPrompt && typeof rawPrompt === 'object' ? rawPrompt : {};
                const rawName = String(prompt.name || '').trim();
                const id = prompt.id || OFFLINE_LEGACY_PROMPT_ID_BY_NAME[rawName] || `custom-${slugOfflinePromptName(rawName)}-${index}`;
                if (id === 'cot') {
                    appendMigratedCotPrompts(fullCotIds, prompt.enabled !== false);
                    return;
                }
                if (id === 'cot_content') {
                    appendMigratedCotPrompts(modularCotIds, prompt.enabled !== false);
                    return;
                }
                const defaultPrompt = defaultById.get(id);
                const isDuplicateDefault = defaultPrompt && usedIds.has(id);

                if (isDuplicateDefault) {
                    const customId = `custom-${slugOfflinePromptName(rawName || defaultPrompt.name)}-${index}`;
                    normalized.push({
                        id: customId,
                        name: rawName || `${defaultPrompt.name} 副本`,
                        enabled: prompt.enabled !== false,
                        content: String(prompt.content || ''),
                        systemManaged: false,
                        editable: true,
                        deletable: true,
                        alwaysEnabled: false
                    });
                    usedIds.add(customId);
                    return;
                }

                if (defaultPrompt) {
                    const item = cloneOfflinePrompt(defaultPrompt);
                    item.enabled = item.alwaysEnabled ? true : (typeof prompt.enabled === 'boolean' ? prompt.enabled : item.enabled);
                    item.name = rawName && !item.systemManaged ? rawName : defaultPrompt.name;
                    const targetPresetVersion = Math.max(0, Number(defaultPrompt.presetVersion) || 0);
                    const sourcePresetVersion = Math.max(0, Number(prompt.presetVersion) || 0);
                    const refreshBuiltInContent = (['style_creative_guidance', 'style_green_apple'].includes(id) || fullCotIds.includes(id))
                        && sourcePresetVersion < targetPresetVersion;
                    if (refreshBuiltInContent) item.name = defaultPrompt.name;
                    item.content = item.systemManaged || refreshBuiltInContent
                        ? defaultPrompt.content
                        : (typeof prompt.content === 'string' ? prompt.content : defaultPrompt.content);
                    if (id === 'barrage_comments') {
                        item.alwaysEnabled = false;
                        item.enabled = typeof prompt.enabled === 'boolean' ? prompt.enabled : item.enabled;
                    }
                    item.presetVersion = targetPresetVersion;
                    normalized.push(item);
                    usedIds.add(id);
                    return;
                }

                normalized.push({
                    id,
                    name: rawName || '自定义条目',
                    enabled: prompt.enabled !== false,
                    content: String(prompt.content || ''),
                    systemManaged: false,
                    editable: true,
                    deletable: prompt.deletable !== false,
                    alwaysEnabled: false
                });
                usedIds.add(id);
            });

            defaults.forEach(defaultPrompt => {
                if (!usedIds.has(defaultPrompt.id)) {
                    const missingPrompt = cloneOfflinePrompt(defaultPrompt);
                    if (defaultPrompt.id === 'style_green_apple') {
                        const styleIndex = normalized.findIndex(prompt => prompt.id === 'style_baimiao');
                        normalized.splice(styleIndex >= 0 ? styleIndex + 1 : normalized.length, 0, missingPrompt);
                    } else if (defaultPrompt.id === 'offline_recap_haru') {
                        const formatIndex = normalized.findIndex(prompt => prompt.id === 'format_rules');
                        normalized.splice(formatIndex >= 0 ? formatIndex : normalized.length, 0, missingPrompt);
                    } else if (modularCotIds.includes(defaultPrompt.id)) {
                        const cotAfterIndex = normalized.findIndex(prompt => prompt.id === 'cot_after');
                        normalized.splice(cotAfterIndex >= 0 ? cotAfterIndex : normalized.length, 0, missingPrompt);
                    } else {
                        normalized.push(missingPrompt);
                    }
                    usedIds.add(defaultPrompt.id);
                }
            });

            // The anchor version marks configurations that already completed the
            // current one-time ordering migration. After that, the visible user order
            // is authoritative and normalization must not move entries again.
            const orderedPrompts = historyAnchorOrderVersion >= 3
                ? normalized
                : orderOfflinePromptsForHistoryAnchor(normalized);
            return recapOrderVersion >= 2
                ? orderedPrompts
                : moveOfflineRecapBeforeFormatRules(orderedPrompts);
        };

        const serializeOfflinePrompts = (prompts) => JSON.stringify((prompts || []).map(prompt => cloneOfflinePrompt(prompt)));
        let offlinePromptSaveTimer = null;

        const createOfflinePromptPresetId = () => `offline-prompts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const normalizeOfflinePromptPresets = (sourcePresets) => {
            const presets = [];
            const usedIds = new Set();
            const usedNames = new Set();
            (Array.isArray(sourcePresets) ? sourcePresets : []).forEach((rawPreset) => {
                if (!rawPreset || typeof rawPreset !== 'object' || !Array.isArray(rawPreset.prompts) || rawPreset.prompts.length === 0) return;
                const name = String(rawPreset.name || '').trim().slice(0, 40);
                if (!name || usedNames.has(name.toLocaleLowerCase())) return;
                let id = String(rawPreset.id || '').trim() || createOfflinePromptPresetId();
                while (usedIds.has(id)) id = createOfflinePromptPresetId();
                usedIds.add(id);
                usedNames.add(name.toLocaleLowerCase());
                presets.push({ id, name, prompts: normalizeOfflinePrompts(rawPreset.prompts) });
            });
            return presets;
        };
        const serializeOfflinePromptPresets = (presets) => JSON.stringify(normalizeOfflinePromptPresets(presets).map(preset => ({
            id: preset.id,
            name: preset.name,
            prompts: preset.prompts.map(cloneOfflinePrompt)
        })));
        const getOfflinePromptOwnerName = (friend, fallbackIndex = 0) => String(
            friend?.nickname || friend?.realName || friend?.name || friend?.groupName || `角色 ${fallbackIndex + 1}`
        ).trim() || `角色 ${fallbackIndex + 1}`;
        const makeUniqueOfflinePromptPresetName = (baseName, usedNames) => {
            const cleanBase = String(baseName || '迁移提示词').trim().slice(0, 36) || '迁移提示词';
            let candidate = cleanBase;
            let suffix = 2;
            while (usedNames.has(candidate.toLocaleLowerCase())) candidate = `${cleanBase} ${suffix++}`.slice(0, 40);
            usedNames.add(candidate.toLocaleLowerCase());
            return candidate;
        };
        let legacyOfflinePromptCleanupPromise = null;
        let offlinePromptMigrationSavePromise = null;
        const scheduleLegacyOfflinePromptCleanup = () => {
            if (offlinePromptMigrationSavePromise) return;
            const legacyFriends = (Array.isArray(window.imData?.friends) ? window.imData.friends : [])
                .filter(friend => friend && Object.prototype.hasOwnProperty.call(friend, 'offlinePrompts'));
            if (!legacyFriends.length || legacyOfflinePromptCleanupPromise) return;
            legacyOfflinePromptCleanupPromise = Promise.allSettled(legacyFriends.map(friend => (
                commitSheetFriendChange(friend.id, (targetFriend) => {
                    delete targetFriend.offlinePrompts;
                }, { silent: true, metaOnly: true })
            ))).finally(() => {
                legacyOfflinePromptCleanupPromise = null;
            });
        };
        const persistGlobalOfflinePromptState = async ({ prompts, presets, activePresetId } = {}) => {
            if (offlinePromptSaveTimer) {
                clearTimeout(offlinePromptSaveTimer);
                offlinePromptSaveTimer = null;
            }
            const normalizedPrompts = normalizeOfflinePrompts(prompts ?? window.imData.offlinePrompts);
            const normalizedPresets = normalizeOfflinePromptPresets(presets ?? window.imData.offlinePromptPresets);
            const nextActivePresetId = normalizedPresets.some(preset => preset.id === activePresetId)
                ? activePresetId
                : '';
            window.imData.offlinePrompts = normalizedPrompts;
            window.imData.offlinePromptPresets = normalizedPresets;
            window.imData.offlinePromptActivePresetId = nextActivePresetId;
            window.imData.offlinePromptsInitialized = true;
            if (window.imApp?.saveImessageUiState) await window.imApp.saveImessageUiState();
            scheduleLegacyOfflinePromptCleanup();
            return normalizedPrompts;
        };
        const ensureGlobalOfflinePrompts = (preferredFriend = null) => {
            if (!window.imData.offlinePromptsInitialized) {
                const legacyFriends = (Array.isArray(window.imData.friends) ? window.imData.friends : [])
                    .filter(friend => Array.isArray(friend?.offlinePrompts) && friend.offlinePrompts.length > 0);
                const presets = [];
                const signatureToPreset = new Map();
                const usedNames = new Set();
                legacyFriends.forEach((friend, index) => {
                    const prompts = normalizeOfflinePrompts(friend.offlinePrompts);
                    const signature = serializeOfflinePrompts(prompts);
                    if (signatureToPreset.has(signature)) return;
                    const preset = {
                        id: createOfflinePromptPresetId(),
                        name: makeUniqueOfflinePromptPresetName(`${getOfflinePromptOwnerName(friend, index)} 提示词`, usedNames),
                        prompts
                    };
                    signatureToPreset.set(signature, preset);
                    presets.push(preset);
                });
                const activeLegacyFriend = preferredFriend || window.imData.currentActiveFriend;
                const preferredLegacyFriend = activeLegacyFriend && Array.isArray(activeLegacyFriend.offlinePrompts) && activeLegacyFriend.offlinePrompts.length
                    ? activeLegacyFriend
                    : legacyFriends[0];
                const currentPrompts = preferredLegacyFriend
                    ? normalizeOfflinePrompts(preferredLegacyFriend.offlinePrompts)
                    : createOfflineDefaultPrompts();
                const matchingPreset = signatureToPreset.get(serializeOfflinePrompts(currentPrompts));
                window.imData.offlinePrompts = normalizeOfflinePrompts(currentPrompts);
                window.imData.offlinePromptPresets = normalizeOfflinePromptPresets(presets);
                window.imData.offlinePromptActivePresetId = matchingPreset?.id || '';
                window.imData.offlinePromptsInitialized = true;
                if (window.imApp?.saveImessageUiState) {
                    offlinePromptMigrationSavePromise = Promise.resolve(window.imApp.saveImessageUiState())
                        .then(() => {
                            offlinePromptMigrationSavePromise = null;
                            scheduleLegacyOfflinePromptCleanup();
                        })
                        .catch((error) => {
                            offlinePromptMigrationSavePromise = null;
                            console.error('Global offline prompts migration save failed', error);
                        });
                }
            } else {
                window.imData.offlinePrompts = normalizeOfflinePrompts(window.imData.offlinePrompts);
                window.imData.offlinePromptPresets = normalizeOfflinePromptPresets(window.imData.offlinePromptPresets);
                if (!window.imData.offlinePromptPresets.some(preset => preset.id === window.imData.offlinePromptActivePresetId)) {
                    window.imData.offlinePromptActivePresetId = '';
                }
            }
            scheduleLegacyOfflinePromptCleanup();
            return window.imData.offlinePrompts;
        };
        const persistOfflinePrompts = async (prompts, options = {}) => persistGlobalOfflinePromptState({
            prompts,
            presets: options.presets ?? window.imData.offlinePromptPresets,
            activePresetId: options.activePresetId ?? ''
        });
        const scheduleOfflinePromptsPersist = (prompts) => {
            const normalized = normalizeOfflinePrompts(prompts);
            window.imData.offlinePrompts = normalized;
            window.imData.offlinePromptActivePresetId = '';
            window.imData.offlinePromptsInitialized = true;
            if (offlinePromptSaveTimer) clearTimeout(offlinePromptSaveTimer);
            offlinePromptSaveTimer = setTimeout(() => {
                persistOfflinePrompts(normalized).catch((error) => {
                    console.error('Offline prompts persistence failed', error);
                    if (window.showToast) window.showToast('线下提示词保存失败');
                });
            }, 350);
        };
        window.imApp.normalizeOfflinePromptPresets = normalizeOfflinePromptPresets;
        window.imApp.getGlobalOfflinePrompts = ensureGlobalOfflinePrompts;
        window.imApp.saveGlobalOfflinePrompts = persistGlobalOfflinePromptState;

        const OFFLINE_THEME_DEFAULTS = Object.freeze(window.imApp?.createDefaultOfflineThemeState
            ? window.imApp.createDefaultOfflineThemeState()
            : {
                narrativeColor: '#111111',
                dialogueColor: '#8B8B8B',
                customCss: '',
                customCssEnabled: false,
                activePresetId: ''
            });
        const OFFLINE_THEME_SCOPE = ':is(#offline-chat-view, #offline-chat-barrage-view)';
        const OFFLINE_THEME_SOURCE_TEMPLATE = `/* 线下界面真实可编辑源码
   :scope 会自动限定到线下主界面和弹幕详情页，不会影响其他应用。 */

:scope {
  --offline-chat-narrative-color: #111111;
  --offline-chat-dialogue-color: #8B8B8B;
  background: #ffffff;
  color: #111111;
}

/* 顶栏 */
.offline-chat-header {
  background: rgba(255, 255, 255, 0.94);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.offline-chat-back,
.offline-chat-settings {
  color: #111111;
}
.offline-chat-title {
  color: #111111;
  font-weight: 700;
}

/* 消息列表与楼层 */
.offline-chat-content {
  background: #ffffff;
}
.offline-chat-floor {
  color: #8e8e93;
}
.offline-chat-bubble {
  border-bottom: 1px solid #eeeeee;
}
.offline-chat-bubble.user {
  background: #fafafa;
}
.offline-chat-bubble.ai {
  background: #ffffff;
}
.offline-chat-bubble-header,
.offline-chat-bubble-body,
.offline-chat-bubble-footer {
  color: inherit;
}
.offline-chat-avatar {
  border-radius: 50%;
  background: #f2f2f7;
}
.offline-chat-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.offline-chat-name-container,
.offline-chat-name {
  color: #111111;
}
.offline-chat-sign,
.offline-chat-bubble-meta {
  color: #8e8e93;
}

/* 正文、思考、对话和段落 */
.offline-chat-bubble-text,
.offline-chat-paragraph-wrap,
.offline-chat-paragraph {
  color: var(--offline-chat-narrative-color);
}
.offline-chat-dialogue,
.offline-chat-speech {
  color: var(--offline-chat-dialogue-color);
}
.offline-chat-thinking {
  width: fit-content;
  max-width: 100%;
  margin-bottom: 8px;
  overflow: hidden;
  border: 0;
  border-radius: 999px;
  background: #f2f2f7;
  text-align: left;
  box-sizing: border-box;
}
.offline-chat-thinking.is-expanded {
  width: 100%;
  border-radius: 20px;
}
.offline-chat-thinking-toggle {
  width: 100%;
  min-height: 36px;
  padding: 7px 12px;
  border: 0;
  background: transparent;
  color: #636366;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font: inherit;
  cursor: pointer;
}
.offline-chat-thinking-label {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.offline-chat-thinking-icon {
  flex: 0 0 auto;
  color: #8e8e93;
  font-size: 11px;
  transition: transform 0.2s ease;
}
.offline-chat-thinking.is-expanded .offline-chat-thinking-icon {
  transform: rotate(180deg);
}
.offline-chat-thinking-content {
  padding: 0 12px 12px;
  color: #636366;
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}
.offline-chat-thinking-content[hidden] {
  display: none;
}
.offline-chat-placeholder,
.offline-chat-reroll-placeholder {
  color: #8e8e93;
}

/* 弹幕入口和玩家选项 */
.offline-chat-barrage-btn {
  background: #f2f2f7;
  color: #48484a;
}
.offline-chat-choice-list {
  display: grid;
  gap: 8px;
}
.offline-chat-choice-btn {
  background: #ffffff;
  color: #111111;
  border: 1px solid #d8d8dc;
}
.offline-chat-choice-index {
  background: #111111;
  color: #ffffff;
}
.offline-chat-choice-text {
  color: inherit;
}

/* 消息操作 */
.offline-chat-bubble-actions {
  display: flex;
  gap: 6px;
}
.offline-chat-action-btn {
  background: #f2f2f7;
  color: #48484a;
}
.offline-chat-action-btn.danger {
  color: #ff3b30;
}
.offline-chat-inline-editor {
  background: #ffffff;
  color: #111111;
  border: 1px solid #d1d1d6;
}

/* 历史见面 */
.offline-chat-history-back,
.offline-chat-history-card,
.offline-chat-history-session,
.offline-chat-history-detail-summary {
  background: #ffffff;
  color: #111111;
  border-color: #e5e5ea;
}
.offline-chat-history-title,
.offline-chat-history-detail-summary-title {
  color: #111111;
}
.offline-chat-history-meta,
.offline-chat-history-summary,
.offline-chat-history-detail-summary-meta {
  color: #8e8e93;
}
.offline-chat-history-detail-summary-text,
.offline-chat-history-summary-textarea {
  color: #333333;
}
.offline-chat-history-delete,
.offline-chat-history-summary-cancel {
  color: #ff3b30;
}
.offline-chat-history-summary-edit,
.offline-chat-history-summary-save {
  color: #007aff;
}

/* 输入区 */
.offline-chat-input-area {
  background: rgba(255, 255, 255, 0.96);
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}
.offline-chat-input-bar {
  background: #f2f2f7;
  border: 1px solid #e5e5ea;
}
.offline-chat-attachment,
.offline-chat-send {
  color: #111111;
}
.offline-chat-input {
  color: #111111;
  background: transparent;
}

/* 弹幕详情页 */
:scope.offline-chat-barrage-view {
  background: #ffffff;
}
.offline-chat-barrage-header {
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid #e5e5ea;
}
.offline-chat-barrage-close,
.offline-chat-barrage-title {
  color: #111111;
}
.offline-chat-barrage-list {
  background: #ffffff;
}
.offline-chat-barrage-row {
  border-bottom: 1px solid #eeeeee;
}
.offline-chat-barrage-name {
  color: #111111;
}
.offline-chat-barrage-text {
  color: #48484a;
}
.offline-chat-barrage-likes,
.offline-chat-barrage-empty {
  color: #8e8e93;
}`;
        const normalizeOfflineTheme = (theme) => window.imApp?.normalizeOfflineThemeState
            ? window.imApp.normalizeOfflineThemeState(theme)
            : { ...OFFLINE_THEME_DEFAULTS, ...(theme || {}) };
        const normalizeOfflineThemePresets = (presets) => window.imApp?.normalizeOfflineThemePresets
            ? window.imApp.normalizeOfflineThemePresets(presets)
            : (Array.isArray(presets) ? presets : []);
        const ensureGlobalOfflineTheme = (legacyFriend = null) => {
            if (!window.imData.offlineThemeInitialized) {
                window.imData.offlineTheme = normalizeOfflineTheme(legacyFriend?.offlineTheme || OFFLINE_THEME_DEFAULTS);
                window.imData.offlineThemeInitialized = true;
                if (window.imApp?.saveImessageUiState) window.imApp.saveImessageUiState();
            } else {
                window.imData.offlineTheme = normalizeOfflineTheme(window.imData.offlineTheme);
            }
            window.imData.offlineThemePresets = normalizeOfflineThemePresets(window.imData.offlineThemePresets);
            return window.imData.offlineTheme;
        };
        const ensureOfflineThemeStyleTag = () => {
            let styleTag = document.getElementById('offline-chat-custom-theme-style');
            if (!styleTag) {
                styleTag = document.createElement('style');
                styleTag.id = 'offline-chat-custom-theme-style';
                document.head.appendChild(styleTag);
            }
            return styleTag;
        };
        const applyOfflineChatTheme = (legacyFriend = null) => {
            const theme = ensureGlobalOfflineTheme(legacyFriend);
            ['offline-chat-view', 'offline-chat-barrage-view'].forEach((id) => {
                const view = document.getElementById(id);
                if (!view) return;
                view.style.setProperty('--offline-chat-narrative-color', theme.narrativeColor);
                view.style.setProperty('--offline-chat-dialogue-color', theme.dialogueColor);
            });
            const styleTag = ensureOfflineThemeStyleTag();
            styleTag.textContent = theme.customCssEnabled && theme.customCss.trim()
                ? (window.imApp?.scopeUserCss
                    ? window.imApp.scopeUserCss(theme.customCss, OFFLINE_THEME_SCOPE)
                    : theme.customCss)
                : '';
            return theme;
        };
        let offlineThemeSaveTimer = null;

        const persistOfflineTheme = async (theme) => {
            if (offlineThemeSaveTimer) {
                clearTimeout(offlineThemeSaveTimer);
                offlineThemeSaveTimer = null;
            }
            const normalized = normalizeOfflineTheme(theme);
            window.imData.offlineTheme = normalized;
            window.imData.offlineThemeInitialized = true;
            if (window.imApp?.saveImessageUiState) window.imApp.saveImessageUiState();
            applyOfflineChatTheme();
            return normalized;
        };

        const persistOfflineThemePresets = async (presets) => {
            window.imData.offlineThemePresets = normalizeOfflineThemePresets(presets);
            if (window.imApp?.saveImessageUiState) window.imApp.saveImessageUiState();
            return window.imData.offlineThemePresets;
        };

        const scheduleOfflineThemePersist = (theme) => {
            const normalized = normalizeOfflineTheme(theme);
            window.imData.offlineTheme = normalized;
            window.imData.offlineThemeInitialized = true;
            applyOfflineChatTheme();
            if (offlineThemeSaveTimer) clearTimeout(offlineThemeSaveTimer);
            offlineThemeSaveTimer = setTimeout(() => {
                persistOfflineTheme(normalized).catch((error) => {
                    console.error('Offline theme persistence failed', error);
                    if (window.showToast) window.showToast('线下主题保存失败');
                });
            }, 350);
        };

        const createCustomOfflinePrompt = () => ({
            id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: '自定义条目',
            enabled: true,
            content: '<custom_instruction>\n在这里输入新的线下提示词。\n</custom_instruction>',
            systemManaged: false,
            editable: true,
            deletable: true,
            alwaysEnabled: false
        });

        const formatOfflinePromptTime = (timestamp) => {
            const value = Number(timestamp);
            if (!Number.isFinite(value) || value <= 0) return '';
            const date = new Date(value);
            const pad = (num) => String(num).padStart(2, '0');
            return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
        };

        const formatOfflineHistoryForPrompt = (historyMessages, userName, charName) => {
            const messages = Array.isArray(historyMessages) ? historyMessages : [];
            return messages.slice(-60).map((message) => {
                const speaker = message.role === 'assistant' ? charName : userName;
                const timeText = message.timestamp ? `[${formatOfflinePromptTime(message.timestamp)}] ` : '';
                return `${timeText}${speaker}: ${message.content || ''}`;
            }).filter(line => line.trim()).join('\n');
        };

        const getOfflineWorldBookFriend = (friend) => {
            const boundIds = [
                ...(Array.isArray(friend?.boundBooks) ? friend.boundBooks : []),
                ...(Array.isArray(friend?.worldbooks) ? friend.worldbooks : [])
            ].map(id => String(id));
            return {
                ...(friend || {}),
                boundBooks: Array.from(new Set(boundIds))
            };
        };

        const getOfflineWorldBookContexts = (friend, contextText) => {
            const worldBookFriend = getOfflineWorldBookFriend(friend);
            const getter = window.imApp?.getWorldBookContextForFriendByPosition || window.getWorldBookContextForFriendByPosition;
            const options = { includeBuiltin: false };
            return {
                systemDepth: getter ? getter('system_depth', worldBookFriend, contextText, options) : (window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('system_depth', contextText, options) : ''),
                beforeRole: getter ? getter('before_role', worldBookFriend, contextText, options) : (window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('before_role', contextText, options) : ''),
                afterRole: getter ? getter('after_role', worldBookFriend, contextText, options) : (window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('after_role', contextText, options) : '')
            };
        };

        const buildOfflineDataZoneContext = ({ activeFriend, currentUserState, userName, charName, identityContext, historyMessages, worldBookContexts }) => {
            const userPersona = identityContext?.userPersona || 'A normal user';
            const charPersona = activeFriend?.persona || 'No specific persona';
            const historyText = formatOfflineHistoryForPrompt(historyMessages, userName, charName) || 'None';
            const contexts = worldBookContexts || {};
            const isGroup = !!identityContext?.isGroup;
            const groupMembers = Array.isArray(identityContext?.groupMembers) ? identityContext.groupMembers : [];
            const defaultLanguage = getOfflineChatLanguageName(activeFriend?.language);
            const charProfile = isGroup
                ? `<group_profile>
Group Name: ${activeFriend?.nickname || activeFriend?.realName || 'Group'}
Default Language: ${defaultLanguage}
Members:
${groupMembers.length > 0 ? groupMembers.map((member, index) => `- Member ${index + 1}
  True Name: ${member.realName || member.nickname || 'Unknown'}
  Display Name: ${member.nickname || member.realName || 'Unknown'}
  Persona: ${member.persona || 'No specific persona'}`).join('\n') : `- ${charName}`}
</group_profile>`
                : `<char_profile>
Name: ${charName}
Default Language: ${defaultLanguage}
Persona: ${charPersona}
</char_profile>`;

            return `<data_zone>
<world_books>
<system_depth>
${contexts.systemDepth || 'None'}
</system_depth>
<before_role>
${contexts.beforeRole || 'None'}
</before_role>
<after_role>
${contexts.afterRole || 'None'}
</after_role>
</world_books>

<user_profile>
Name: ${userName}
Persona: ${userPersona}
</user_profile>

${charProfile}

<recent_context source="online_and_offline_last_30_rounds">
${historyText}
</recent_context>
</data_zone>`;
        };

        const isOfflineMemoryEntryTriggered = (entry, recentText) => {
            if (!entry) return false;
            const text = String(recentText || '');
            const values = [
                entry.keyword,
                entry.title,
                entry.memoryPoints,
                entry.event,
                entry.content
            ].map(value => String(value || '').trim()).filter(Boolean);

            return values.some(value => value.length >= 2 && text.includes(value));
        };

        const pickOfflineMemoryEntries = (entries, recentText, limit) => {
            const cleanEntries = Array.isArray(entries)
                ? entries.filter(entry => entry && (entry.title || entry.event || entry.content || entry.memoryPoints || entry.detail))
                : [];
            if (cleanEntries.length === 0) return [];
            const triggered = cleanEntries.filter(entry => isOfflineMemoryEntryTriggered(entry, recentText));
            return (triggered.length > 0 ? triggered : cleanEntries).slice(-limit);
        };

        const buildOfflineMemorySystemContext = (friend, recentText) => {
            const normalizedFriend = window.imApp?.normalizeFriendData
                ? window.imApp.normalizeFriendData(friend || {})
                : (friend || {});
            const memory = normalizedFriend.memory || {};
            const sections = [];

            if (memory.overview) {
                sections.push(`<core_memory_overview>\n${memory.overview}\n</core_memory_overview>`);
            }
            if (memory.context?.notes) {
                sections.push(`<extra_context_notes>\n${memory.context.notes}\n</extra_context_notes>`);
            }

            const shortTermEntries = pickOfflineMemoryEntries(memory.shortTermEntries, recentText, 8);
            if (shortTermEntries.length > 0) {
                sections.push(`<short_term_memories source="vectorized_char_memory">
${shortTermEntries.map(entry => `<short_term_memory>
<title>${entry.title || 'Memory'}</title>
<time>${entry.time || entry.createdAt || ''}</time>
<content>${entry.event || entry.content || ''}</content>
<memory_points>${entry.memoryPoints || ''}</memory_points>
<degree>${entry.degree || ''}</degree>
</short_term_memory>`).join('\n')}
</short_term_memories>`);
            }

            const longTermEntries = pickOfflineMemoryEntries(memory.longTermEntries, recentText, 8);
            const longTermBlocks = [];
            if (memory.longTerm) longTermBlocks.push(`<memory_text>\n${memory.longTerm}\n</memory_text>`);
            longTermEntries.forEach(entry => {
                longTermBlocks.push(`<memory>
<title>${entry.title || 'Long-term memory'}</title>
<content>${entry.content || ''}</content>
<time>${entry.createdAt || entry.time || ''}</time>
</memory>`);
            });
            if (longTermBlocks.length > 0) {
                sections.push(`<long_term_memories source="vectorized_char_memory">\n${longTermBlocks.join('\n')}\n</long_term_memories>`);
            }

            const cherishedEntries = pickOfflineMemoryEntries(memory.cherishedEntries, recentText, 8);
            const cherishedBlocks = [];
            if (memory.cherished) cherishedBlocks.push(`<memory_text>\n${memory.cherished}\n</memory_text>`);
            cherishedEntries.forEach(entry => {
                cherishedBlocks.push(`<memory>
<title>${entry.title || 'Cherished memory'}</title>
<content>${entry.content || ''}</content>
<detail>${entry.detail || ''}</detail>
<reason>${entry.reason || ''}</reason>
<time>${entry.createdAt || entry.time || ''}</time>
</memory>`);
            });
            if (cherishedBlocks.length > 0) {
                sections.push(`<cherished_memories source="vectorized_char_memory">\n${cherishedBlocks.join('\n')}\n</cherished_memories>`);
            }

            return `<character_memory_system>
${sections.length > 0 ? sections.join('\n\n') : 'No active vectorized character memory is available yet.'}
</character_memory_system>`;
        };

        const serializeOfflineRegexScripts = (scripts) => JSON.stringify(
            offlineRegexEngine ? offlineRegexEngine.normalizeRules(scripts) : []
        );
        let offlineRegexSaveTimer = null;

        const ensureOfflineRegexScriptsForFriend = (activeFriend) => {
            if (!activeFriend || !offlineRegexEngine) return [];
            const previous = Array.isArray(activeFriend.offlineRegexScripts) ? activeFriend.offlineRegexScripts : [];
            const normalized = offlineRegexEngine.normalizeRules(previous);
            if (serializeOfflineRegexScripts(previous) !== serializeOfflineRegexScripts(normalized)) {
                commitSheetFriendChange(activeFriend, (targetFriend) => {
                    targetFriend.offlineRegexScripts = normalized;
                }, { silent: true, metaOnly: true });
            }
            return normalized;
        };

        const persistOfflineRegexScripts = async (activeFriend, scripts, options = {}) => {
            if (!activeFriend || !offlineRegexEngine) return [];
            if (offlineRegexSaveTimer) {
                clearTimeout(offlineRegexSaveTimer);
                offlineRegexSaveTimer = null;
            }
            const normalized = offlineRegexEngine.normalizeRules(scripts);
            const saved = await commitSheetFriendChange(activeFriend.id, (targetFriend) => {
                targetFriend.offlineRegexScripts = normalized;
            }, { silent: true, metaOnly: true });
            if (!saved) throw new Error('Failed to persist offline regex scripts');

            if (options.applyMessages !== false) {
                const latestFriend = window.imApp?.getFriendById?.(activeFriend.id) || activeFriend;
                await persistOfflineMessages(latestFriend, normalizeOfflineMessagesForFriend(latestFriend));
                const titleEl = document.querySelector('#offline-chat-view .offline-chat-title');
                if (titleEl?.textContent === '线下') renderOfflineCurrentMessages(latestFriend);
            }
            return normalized;
        };

        const scheduleOfflineRegexScriptsPersist = (activeFriend, scripts) => {
            if (!activeFriend || !offlineRegexEngine) return;
            const normalized = offlineRegexEngine.normalizeRules(scripts);
            if (offlineRegexSaveTimer) clearTimeout(offlineRegexSaveTimer);
            offlineRegexSaveTimer = setTimeout(() => {
                persistOfflineRegexScripts(activeFriend, normalized).catch((error) => {
                    console.error('Offline regex persistence failed', error);
                    if (window.showToast) window.showToast('线下正则保存失败');
                });
            }, 350);
        };

        const getOfflineRegexValidationError = (rule) => {
            if (!offlineRegexEngine) return '正则引擎未加载';
            const compiled = offlineRegexEngine.compileRule(rule);
            if (compiled.error) return compiled.error;
            if (!offlineRegexEngine.isDepthValid(rule)) return '最大深度不能小于最小深度';
            return '';
        };

        const renderOfflineRegexSettingsEditor = (listEl, activeFriend) => {
            if (!listEl) return;
            listEl.innerHTML = '';
            if (!offlineRegexEngine) {
                listEl.innerHTML = '<div class="offline-regex-empty">正则引擎加载失败</div>';
                return;
            }

            const scripts = ensureOfflineRegexScriptsForFriend(activeFriend);
            const intro = document.createElement('div');
            intro.className = 'offline-regex-intro';
            intro.textContent = '最新消息深度为 0；深度留空表示无限。规则按当前列表从上到下执行。';
            listEl.appendChild(intro);

            if (scripts.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'offline-regex-empty';
                empty.textContent = '暂无正则规则';
                listEl.appendChild(empty);
            }

            scripts.forEach((rule, index) => {
                const card = document.createElement('details');
                card.className = `offline-regex-card${rule.disabled ? ' is-disabled' : ''}`;
                card.open = index === 0;
                card.innerHTML = `
                    <summary class="offline-regex-summary">
                        <span class="offline-regex-summary-name">${escapeSheetHtml(rule.scriptName || `正则 ${index + 1}`)}</span>
                        <span class="offline-regex-summary-state">${rule.disabled ? '已停用' : '已启用'}</span>
                    </summary>
                    <div class="offline-regex-editor">
                        <div class="offline-regex-toolbar">
                            <label class="offline-regex-enabled"><input type="checkbox" data-regex-field="enabled" ${rule.disabled ? '' : 'checked'}><span>启用</span></label>
                            <div class="offline-regex-order-actions">
                                <button type="button" data-regex-action="up" title="上移" ${index === 0 ? 'disabled' : ''}><i class="fas fa-arrow-up"></i></button>
                                <button type="button" data-regex-action="down" title="下移" ${index === scripts.length - 1 ? 'disabled' : ''}><i class="fas fa-arrow-down"></i></button>
                                <button type="button" class="danger" data-regex-action="delete" title="删除"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                        <label class="offline-regex-field"><span>显示名称</span><input type="text" data-regex-field="scriptName" value="${escapeSheetHtml(rule.scriptName)}"></label>
                        <label class="offline-regex-field"><span>查找正则表达式</span><textarea data-regex-field="findRegex" rows="2" placeholder="例如 /foo/gi">${escapeSheetHtml(rule.findRegex)}</textarea></label>
                        <label class="offline-regex-field"><span>替换为</span><textarea data-regex-field="replaceString" rows="2" placeholder="支持 $&、$1 和 {{match}}">${escapeSheetHtml(rule.replaceString)}</textarea></label>
                        <div class="offline-regex-section-label">作用范围</div>
                        <div class="offline-regex-checks">
                            <label><input type="checkbox" data-regex-placement="user" ${rule.placement.includes('user') ? 'checked' : ''}><span>User 输入</span></label>
                            <label><input type="checkbox" data-regex-placement="assistant" ${rule.placement.includes('assistant') ? 'checked' : ''}><span>AI 输出</span></label>
                        </div>
                        <div class="offline-regex-section-label">格式模式</div>
                        <div class="offline-regex-checks vertical">
                            <label><input type="checkbox" data-regex-field="markdownOnly" ${rule.markdownOnly ? 'checked' : ''}><span>仅格式显示</span></label>
                            <label><input type="checkbox" data-regex-field="promptOnly" ${rule.promptOnly ? 'checked' : ''}><span>仅格式提示词</span></label>
                        </div>
                        <div class="offline-regex-depths">
                            <label class="offline-regex-field"><span>最小深度</span><input type="number" min="0" step="1" data-regex-field="minDepth" value="${rule.minDepth === null ? '' : rule.minDepth}" placeholder="无限"></label>
                            <label class="offline-regex-field"><span>最大深度</span><input type="number" min="0" step="1" data-regex-field="maxDepth" value="${rule.maxDepth === null ? '' : rule.maxDepth}" placeholder="无限"></label>
                        </div>
                        <div class="offline-regex-error" role="alert"></div>
                    </div>
                `;

                const errorEl = card.querySelector('.offline-regex-error');
                const summaryName = card.querySelector('.offline-regex-summary-name');
                const summaryState = card.querySelector('.offline-regex-summary-state');
                const refreshValidation = (temporaryError = '') => {
                    const error = temporaryError || getOfflineRegexValidationError(rule);
                    if (errorEl) {
                        errorEl.textContent = error;
                        errorEl.style.display = error ? 'block' : 'none';
                    }
                    card.classList.toggle('has-error', !!error);
                };
                const updateRule = (mutator) => {
                    mutator(rule);
                    rule.revision = Math.max(1, Number(rule.revision) || 1) + 1;
                    scheduleOfflineRegexScriptsPersist(activeFriend, scripts);
                    refreshValidation();
                };

                card.querySelectorAll('[data-regex-field]').forEach((control) => {
                    const field = control.getAttribute('data-regex-field');
                    const eventName = control instanceof HTMLInputElement && control.type === 'checkbox' ? 'change' : 'input';
                    control.addEventListener(eventName, () => {
                        if (field === 'enabled') {
                            updateRule(item => { item.disabled = !control.checked; });
                            card.classList.toggle('is-disabled', rule.disabled);
                            if (summaryState) summaryState.textContent = rule.disabled ? '已停用' : '已启用';
                            return;
                        }
                        if (field === 'markdownOnly' || field === 'promptOnly') {
                            updateRule(item => { item[field] = control.checked; });
                            return;
                        }
                        if (field === 'minDepth' || field === 'maxDepth') {
                            const rawValue = control.value.trim();
                            if (rawValue !== '' && !/^\d+$/.test(rawValue)) {
                                refreshValidation('深度只接受非负整数');
                                return;
                            }
                            updateRule(item => { item[field] = rawValue === '' ? null : Number(rawValue); });
                            return;
                        }
                        updateRule(item => { item[field] = control.value; });
                        if (field === 'scriptName' && summaryName) summaryName.textContent = control.value || `正则 ${index + 1}`;
                    });
                });

                card.querySelectorAll('[data-regex-placement]').forEach((control) => {
                    control.addEventListener('change', () => {
                        const role = control.getAttribute('data-regex-placement');
                        updateRule(item => {
                            const placements = new Set(item.placement);
                            if (control.checked) placements.add(role);
                            else placements.delete(role);
                            item.placement = offlineRegexEngine.PLACEMENTS.filter(value => placements.has(value));
                        });
                    });
                });

                card.querySelectorAll('[data-regex-action]').forEach((button) => {
                    button.addEventListener('click', async (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const action = button.getAttribute('data-regex-action');
                        if (action === 'delete') {
                            if (!window.confirm(`删除正则“${rule.scriptName}”？`)) return;
                            scripts.splice(index, 1);
                        } else {
                            const targetIndex = action === 'up' ? index - 1 : index + 1;
                            if (targetIndex < 0 || targetIndex >= scripts.length) return;
                            [scripts[index], scripts[targetIndex]] = [scripts[targetIndex], scripts[index]];
                        }
                        await persistOfflineRegexScripts(activeFriend, scripts);
                        renderOfflineRegexSettingsEditor(listEl, activeFriend);
                    });
                });

                refreshValidation();
                listEl.appendChild(card);
            });

            const addButton = document.createElement('button');
            addButton.type = 'button';
            addButton.className = 'offline-regex-add';
            addButton.innerHTML = '<i class="fas fa-plus"></i><span>新增正则</span>';
            addButton.addEventListener('click', async () => {
                const nextScripts = scripts.concat(offlineRegexEngine.createRule());
                await persistOfflineRegexScripts(activeFriend, nextScripts);
                renderOfflineRegexSettingsEditor(listEl, activeFriend);
            });
            listEl.appendChild(addButton);
        };

        const renderOfflineChatSettingsEditor = (listEl, activeFriend) => {
            listEl.innerHTML = '';

            const streamRow = document.createElement('div');
            streamRow.className = 'offline-settings-streaming';
            streamRow.innerHTML = `
                <div class="offline-settings-worldbook-main">
                    <i class="fas fa-bolt"></i>
                    <span><strong>流式传输</strong><small>STREAM RESPONSE</small></span>
                </div>
            `;
            const streamToggle = document.createElement('label');
            streamToggle.className = 'toggle-switch';
            streamToggle.setAttribute('aria-label', '线下流式传输');
            const streamCheckbox = document.createElement('input');
            streamCheckbox.type = 'checkbox';
            streamCheckbox.checked = activeFriend.offlineStreamEnabled !== false;
            streamCheckbox.addEventListener('change', async () => {
                await commitSheetFriendChange(activeFriend.id, (targetFriend) => {
                    targetFriend.offlineStreamEnabled = streamCheckbox.checked;
                }, { silent: true, metaOnly: true });
            });
            const streamSlider = document.createElement('span');
            streamSlider.className = 'slider';
            streamToggle.append(streamCheckbox, streamSlider);
            streamRow.appendChild(streamToggle);
            listEl.appendChild(streamRow);

            if (activeFriend.type === 'char') {
                const autoImageRow = document.createElement('div');
                autoImageRow.className = 'offline-settings-streaming offline-settings-auto-image';
                autoImageRow.innerHTML = `
                    <div class="offline-settings-worldbook-main">
                        <i class="fas fa-wand-magic-sparkles"></i>
                        <span><strong>线下自动生图</strong><small>按剧情决定是否生成；复用线上生图提示词配置</small></span>
                    </div>
                `;
                const autoImageToggle = document.createElement('label');
                autoImageToggle.className = 'toggle-switch';
                autoImageToggle.setAttribute('aria-label', '线下自动生图');
                const autoImageCheckbox = document.createElement('input');
                autoImageCheckbox.type = 'checkbox';
                autoImageCheckbox.checked = activeFriend.offlineAutoImageGeneration === true;
                autoImageCheckbox.addEventListener('change', async () => {
                    const saved = await commitSheetFriendChange(activeFriend.id, (targetFriend) => {
                        targetFriend.offlineAutoImageGeneration = autoImageCheckbox.checked;
                    }, { silent: true, metaOnly: true });
                    if (!saved) {
                        autoImageCheckbox.checked = !autoImageCheckbox.checked;
                        window.showToast?.('线下自动生图设置保存失败');
                    }
                });
                const autoImageSlider = document.createElement('span');
                autoImageSlider.className = 'slider';
                autoImageToggle.append(autoImageCheckbox, autoImageSlider);
                autoImageRow.appendChild(autoImageToggle);
                listEl.appendChild(autoImageRow);
            }

            const wbBtnDiv = document.createElement('div');
            wbBtnDiv.className = 'offline-settings-worldbook';
            wbBtnDiv.innerHTML = `
                <div class="offline-settings-worldbook-main">
                    <i class="fas fa-book"></i>
                    <span><strong>挂载世界书</strong><small>WORLD BOOK</small></span>
                </div>
                <div class="offline-settings-worldbook-meta">
                    <span id="offline-chat-wb-count">${(activeFriend.worldbooks || activeFriend.boundBooks || []).length} 项</span>
                    <i class="fas fa-chevron-right"></i>
                </div>
            `;
            wbBtnDiv.addEventListener('click', () => {
                const currentIds = activeFriend.worldbooks || activeFriend.boundBooks || [];
                const handleSelection = (newIds) => {
                    commitSheetFriendChange(activeFriend.id, (targetFriend) => {
                        targetFriend.worldbooks = newIds;
                    }, { silent: true, metaOnly: true });
                    const countSpan = document.getElementById('offline-chat-wb-count');
                    if (countSpan) countSpan.textContent = `${newIds.length} 项`;
                };

                if (window.renderWorldBookSelector) {
                    window.renderWorldBookSelector(currentIds, handleSelection);
                } else if (window.renderLegacyWorldBookSelector) {
                    window.renderLegacyWorldBookSelector(currentIds, handleSelection);
                }
            });
            listEl.appendChild(wbBtnDiv);

            let prompts = ensureGlobalOfflinePrompts(activeFriend);
            let presets = normalizeOfflinePromptPresets(window.imData.offlinePromptPresets);
            let promptPresetSelect = null;
            let deletePromptPresetBtn = null;
            const refreshPromptPresetSelect = () => {
                if (!promptPresetSelect) return;
                promptPresetSelect.innerHTML = '<option value="">自定义提示词</option>' + presets.map(preset => (
                    `<option value="${escapeSheetHtml(preset.id)}">${escapeSheetHtml(preset.name)}</option>`
                )).join('');
                promptPresetSelect.value = presets.some(preset => preset.id === window.imData.offlinePromptActivePresetId)
                    ? window.imData.offlinePromptActivePresetId
                    : '';
                if (deletePromptPresetBtn) deletePromptPresetBtn.disabled = !promptPresetSelect.value;
            };
            const markPromptWorkCopyCustom = () => {
                window.imData.offlinePromptActivePresetId = '';
                if (promptPresetSelect) promptPresetSelect.value = '';
                if (deletePromptPresetBtn) deletePromptPresetBtn.disabled = true;
            };

            const promptPresetCard = document.createElement('section');
            promptPresetCard.className = 'offline-theme-card offline-prompt-preset-card';
            const promptPresetHeading = document.createElement('div');
            promptPresetHeading.className = 'offline-theme-heading';
            promptPresetHeading.innerHTML = '<div><strong>提示词预设</strong><span>PROMPT PRESETS</span></div><p>所有角色和群聊共用当前线下提示词。</p>';
            promptPresetCard.appendChild(promptPresetHeading);

            const promptPresetControls = document.createElement('div');
            promptPresetControls.className = 'offline-theme-preset-controls';
            promptPresetSelect = document.createElement('select');
            promptPresetSelect.className = 'offline-theme-preset-select';
            promptPresetSelect.setAttribute('aria-label', '选择全局线下提示词预设');
            deletePromptPresetBtn = document.createElement('button');
            deletePromptPresetBtn.type = 'button';
            deletePromptPresetBtn.className = 'offline-theme-preset-delete';
            deletePromptPresetBtn.textContent = '删除';

            promptPresetSelect.addEventListener('change', async () => {
                const preset = presets.find(item => item.id === promptPresetSelect.value);
                if (!preset) {
                    await persistGlobalOfflinePromptState({ prompts, presets, activePresetId: '' });
                    refreshPromptPresetSelect();
                    return;
                }
                prompts = preset.prompts.map(cloneOfflinePrompt);
                await persistGlobalOfflinePromptState({ prompts, presets, activePresetId: preset.id });
                renderOfflineChatSettingsEditor(listEl, activeFriend);
                if (window.showToast) window.showToast(`已应用提示词预设：${preset.name}`);
            });
            const removeSelectedPromptPreset = async () => {
                const selectedId = promptPresetSelect.value;
                if (!selectedId) return;
                presets = normalizeOfflinePromptPresets(presets.filter(preset => preset.id !== selectedId));
                await persistGlobalOfflinePromptState({ prompts, presets, activePresetId: '' });
                renderOfflineChatSettingsEditor(listEl, activeFriend);
                if (window.showToast) window.showToast('提示词预设已删除，当前提示词保持不变');
            };
            deletePromptPresetBtn.addEventListener('click', () => {
                const selected = presets.find(preset => preset.id === promptPresetSelect.value);
                if (!selected) return;
                if (window.showCustomModal) {
                    window.showCustomModal({
                        title: '删除提示词预设',
                        message: `确定删除“${selected.name}”吗？当前已应用的提示词不会被清空。`,
                        confirmText: '删除',
                        cancelText: '取消',
                        isDestructive: true,
                        onConfirm: removeSelectedPromptPreset
                    });
                } else {
                    removeSelectedPromptPreset();
                }
            });
            promptPresetControls.append(promptPresetSelect, deletePromptPresetBtn);
            promptPresetCard.appendChild(promptPresetControls);

            const promptPresetSaveRow = document.createElement('div');
            promptPresetSaveRow.className = 'offline-theme-save-row';
            const promptPresetNameInput = document.createElement('input');
            promptPresetNameInput.type = 'text';
            promptPresetNameInput.maxLength = 40;
            promptPresetNameInput.placeholder = '输入提示词预设名称';
            const savePromptPresetBtn = document.createElement('button');
            savePromptPresetBtn.type = 'button';
            savePromptPresetBtn.textContent = '保存预设';
            savePromptPresetBtn.addEventListener('click', async () => {
                const name = promptPresetNameInput.value.trim().slice(0, 40);
                if (!name) {
                    if (window.showToast) window.showToast('请先输入提示词预设名称');
                    promptPresetNameInput.focus();
                    return;
                }
                const existing = presets.find(preset => preset.name.toLocaleLowerCase() === name.toLocaleLowerCase());
                const id = existing?.id || createOfflinePromptPresetId();
                const nextPreset = { id, name, prompts: normalizeOfflinePrompts(prompts) };
                presets = normalizeOfflinePromptPresets(existing
                    ? presets.map(preset => preset.id === id ? nextPreset : preset)
                    : presets.concat(nextPreset));
                await persistGlobalOfflinePromptState({ prompts, presets, activePresetId: id });
                promptPresetNameInput.value = '';
                refreshPromptPresetSelect();
                if (window.showToast) window.showToast(existing ? `已覆盖提示词预设：${name}` : `已保存提示词预设：${name}`);
            });
            promptPresetSaveRow.append(promptPresetNameInput, savePromptPresetBtn);
            promptPresetCard.appendChild(promptPresetSaveRow);
            listEl.appendChild(promptPresetCard);
            refreshPromptPresetSelect();

            const variableHint = document.createElement('div');
            variableHint.className = 'offline-settings-variable-hint';
            variableHint.innerHTML = '<div class="offline-settings-section-kicker"><strong>可用变量</strong><span>VARIABLES</span></div><div><code>{{user}}</code> 当前 User 名字</div><div><code>{{char}}</code> 单聊为 Char 真名；群聊为全部群成员真名</div>';
            listEl.appendChild(variableHint);

            const promptsContainer = document.createElement('div');
            promptsContainer.className = 'offline-settings-prompts';
            listEl.appendChild(promptsContainer);

            const makeIconButton = (iconClass, label, disabled = false) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.setAttribute('aria-label', label);
                button.title = label;
                button.disabled = disabled;
                button.className = 'offline-settings-icon-btn';
                button.innerHTML = `<i class="${iconClass}"></i>`;
                return button;
            };

            prompts.forEach((prompt, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'offline-settings-prompt-item';
                const isHistoryAnchor = prompt.id === OFFLINE_CHAT_HISTORY_PROMPT_ID;
                if (isHistoryAnchor) itemDiv.classList.add('offline-settings-history-anchor');

                const topRow = document.createElement('div');
                topRow.className = 'offline-settings-prompt-row';

                const moveGroup = document.createElement('div');
                moveGroup.className = 'offline-settings-move-actions';
                const upBtn = makeIconButton('fas fa-arrow-up', '上移', index === 0);
                const downBtn = makeIconButton('fas fa-arrow-down', '下移', index === prompts.length - 1);

                upBtn.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    if (index === 0) return;
                    const nextPrompts = prompts.slice();
                    [nextPrompts[index - 1], nextPrompts[index]] = [nextPrompts[index], nextPrompts[index - 1]];
                    await persistOfflinePrompts(nextPrompts);
                    renderOfflineChatSettingsEditor(listEl, activeFriend);
                });

                downBtn.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    if (index >= prompts.length - 1) return;
                    const nextPrompts = prompts.slice();
                    [nextPrompts[index], nextPrompts[index + 1]] = [nextPrompts[index + 1], nextPrompts[index]];
                    await persistOfflinePrompts(nextPrompts);
                    renderOfflineChatSettingsEditor(listEl, activeFriend);
                });

                moveGroup.appendChild(upBtn);
                moveGroup.appendChild(downBtn);
                topRow.appendChild(moveGroup);

                const nameWrap = document.createElement('div');
                nameWrap.className = 'offline-settings-prompt-name';

                if (prompt.editable !== false) {
                    const nameInput = document.createElement('input');
                    nameInput.type = 'text';
                    nameInput.value = prompt.name || '未命名提示词';
                    nameInput.className = 'offline-settings-name-input';
                    nameInput.addEventListener('click', event => event.stopPropagation());
                    nameInput.addEventListener('input', () => {
                        prompt.name = nameInput.value || '未命名提示词';
                        markPromptWorkCopyCustom();
                        scheduleOfflinePromptsPersist(prompts);
                    });
                    nameWrap.appendChild(nameInput);
                } else {
                    const nameLabel = document.createElement('div');
                    nameLabel.className = 'offline-settings-name-label';
                    nameLabel.textContent = prompt.name || '系统条目';
                    nameWrap.appendChild(nameLabel);
                }

                if (prompt.systemManaged) {
                    const managedLabel = document.createElement('div');
                    managedLabel.className = 'offline-settings-state-label';
                    managedLabel.textContent = isHistoryAnchor ? '历史插入位置' : '系统挂载 · 始终开启';
                    nameWrap.appendChild(managedLabel);
                } else if (prompt.alwaysEnabled) {
                    const alwaysLabel = document.createElement('div');
                    alwaysLabel.className = 'offline-settings-state-label';
                    alwaysLabel.textContent = '已永久开启';
                    nameWrap.appendChild(alwaysLabel);
                }

                topRow.appendChild(nameWrap);

                const actionGroup = document.createElement('div');
                actionGroup.className = 'offline-settings-prompt-actions';

                if (prompt.deletable) {
                    const deleteBtn = makeIconButton('fas fa-trash', '删除');
                    deleteBtn.classList.add('danger');
                    deleteBtn.addEventListener('click', async (event) => {
                        event.stopPropagation();
                        const nextPrompts = prompts.filter((_, promptIndex) => promptIndex !== index);
                        await persistOfflinePrompts(nextPrompts);
                        renderOfflineChatSettingsEditor(listEl, activeFriend);
                    });
                    actionGroup.appendChild(deleteBtn);
                }

                if (!prompt.alwaysEnabled) {
                    const toggleLabel = document.createElement('label');
                    toggleLabel.className = 'toggle-switch';
                    toggleLabel.style.cssText = 'margin:0;';
                    toggleLabel.addEventListener('click', event => event.stopPropagation());

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.checked = !!prompt.enabled;
                    checkbox.addEventListener('change', () => {
                        prompt.enabled = checkbox.checked;
                        markPromptWorkCopyCustom();
                        scheduleOfflinePromptsPersist(prompts);
                    });

                    const slider = document.createElement('span');
                    slider.className = 'slider';
                    toggleLabel.appendChild(checkbox);
                    toggleLabel.appendChild(slider);
                    actionGroup.appendChild(toggleLabel);
                }

                let contentDiv = null;
                let setExpanded = null;
                let expandBtn = null;
                if (!isHistoryAnchor) {
                    contentDiv = document.createElement('div');
                    contentDiv.className = 'offline-settings-prompt-content';

                    if (prompt.editable !== false) {
                        const textarea = document.createElement('textarea');
                        textarea.value = prompt.content || '';
                        textarea.placeholder = '输入提示词内容...';
                        textarea.className = 'offline-settings-prompt-textarea';
                        textarea.addEventListener('click', event => event.stopPropagation());
                        textarea.addEventListener('input', () => {
                            prompt.content = textarea.value;
                            markPromptWorkCopyCustom();
                            scheduleOfflinePromptsPersist(prompts);
                        });
                        contentDiv.appendChild(textarea);
                    } else {
                        const preview = document.createElement('div');
                        preview.className = 'offline-settings-prompt-preview';
                        preview.textContent = prompt.content || '';
                        contentDiv.appendChild(preview);
                    }

                    expandBtn = makeIconButton('fas fa-chevron-down', '展开提示词');
                    expandBtn.classList.add('offline-settings-expand-btn');
                    expandBtn.setAttribute('aria-expanded', 'false');
                    setExpanded = (expanded) => {
                        contentDiv.style.display = expanded ? 'block' : 'none';
                        expandBtn.setAttribute('aria-expanded', String(expanded));
                        expandBtn.setAttribute('aria-label', expanded ? '收起提示词' : '展开提示词');
                        expandBtn.title = expanded ? '收起提示词' : '展开提示词';
                    };
                    expandBtn.addEventListener('click', (event) => {
                        event.stopPropagation();
                        setExpanded(expandBtn.getAttribute('aria-expanded') !== 'true');
                    });
                    actionGroup.appendChild(expandBtn);
                }
                topRow.appendChild(actionGroup);

                topRow.addEventListener('click', (event) => {
                    if (!setExpanded || !expandBtn) return;
                    if (event.target.closest('button, input, textarea, label')) return;
                    setExpanded(expandBtn.getAttribute('aria-expanded') !== 'true');
                });

                itemDiv.appendChild(topRow);
                if (contentDiv) itemDiv.appendChild(contentDiv);
                promptsContainer.appendChild(itemDiv);
            });

            if (promptsContainer.lastElementChild) {
                promptsContainer.lastElementChild.style.borderBottom = 'none';
            }

            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'offline-settings-add-btn';
            addBtn.innerHTML = '<i class="fas fa-plus"></i><span>增加条目</span>';
            addBtn.addEventListener('click', async () => {
                const nextPrompts = prompts.concat(createCustomOfflinePrompt());
                await persistOfflinePrompts(nextPrompts);
                renderOfflineChatSettingsEditor(listEl, activeFriend);
            });
            listEl.appendChild(addBtn);
        };

        const renderOfflineThemeSettingsEditor = (listEl, activeFriend) => {
            if (!listEl || !activeFriend) return;
            listEl.innerHTML = '';

            let theme = applyOfflineChatTheme(activeFriend);
            let presets = normalizeOfflineThemePresets(window.imData.offlineThemePresets);
            const controls = [];
            let cssInput = null;
            let presetSelect = null;
            let deletePresetBtn = null;

            const createHeading = (title, kicker, description) => {
                const heading = document.createElement('div');
                heading.className = 'offline-theme-heading';
                heading.innerHTML = `<div><strong>${title}</strong><span>${kicker}</span></div><p>${description}</p>`;
                return heading;
            };
            const refreshPresetSelect = () => {
                if (!presetSelect) return;
                presetSelect.innerHTML = '<option value="">自定义主题</option>' + presets.map(preset => (
                    `<option value="${escapeSheetHtml(preset.id)}">${escapeSheetHtml(preset.name)}</option>`
                )).join('');
                presetSelect.value = presets.some(preset => preset.id === theme.activePresetId)
                    ? theme.activePresetId
                    : '';
                if (deletePresetBtn) deletePresetBtn.disabled = !presetSelect.value;
            };
            const updateControls = () => {
                controls.forEach(({ field, colorInput, textInput, swatch }) => {
                    const value = theme[field];
                    colorInput.value = value;
                    textInput.value = value;
                    swatch.style.backgroundColor = value;
                });
                if (cssInput) cssInput.value = theme.customCss;
                refreshPresetSelect();
            };
            const updateTheme = (field, value) => {
                theme = normalizeOfflineTheme({ ...theme, [field]: value, activePresetId: '' });
                updateControls();
                scheduleOfflineThemePersist(theme);
            };

            const presetCard = document.createElement('section');
            presetCard.className = 'offline-theme-card';
            presetCard.appendChild(createHeading('选择主题', 'THEME PRESETS', '主题在所有角色和群聊的线下界面中共用。'));
            const presetControls = document.createElement('div');
            presetControls.className = 'offline-theme-preset-controls';
            presetSelect = document.createElement('select');
            presetSelect.className = 'offline-theme-preset-select';
            presetSelect.setAttribute('aria-label', '选择线下主题预设');
            const importPresetBtn = document.createElement('button');
            importPresetBtn.type = 'button';
            importPresetBtn.className = 'offline-theme-preset-icon';
            importPresetBtn.innerHTML = '<i class="fas fa-file-import"></i>';
            importPresetBtn.setAttribute('aria-label', '导入主题');
            importPresetBtn.title = '导入主题';
            const exportPresetBtn = document.createElement('button');
            exportPresetBtn.type = 'button';
            exportPresetBtn.className = 'offline-theme-preset-icon';
            exportPresetBtn.innerHTML = '<i class="fas fa-file-export"></i>';
            exportPresetBtn.setAttribute('aria-label', '导出主题');
            exportPresetBtn.title = '导出主题';
            const importPresetInput = document.createElement('input');
            importPresetInput.type = 'file';
            importPresetInput.accept = '.json,application/json';
            importPresetInput.hidden = true;
            deletePresetBtn = document.createElement('button');
            deletePresetBtn.type = 'button';
            deletePresetBtn.className = 'offline-theme-preset-delete';
            deletePresetBtn.textContent = '删除';
            deletePresetBtn.disabled = true;
            presetSelect.addEventListener('change', async () => {
                const preset = presets.find(item => item.id === presetSelect.value);
                if (!preset) {
                    theme = await persistOfflineTheme({ ...theme, activePresetId: '' });
                    updateControls();
                    return;
                }
                theme = await persistOfflineTheme({
                    narrativeColor: preset.narrativeColor,
                    dialogueColor: preset.dialogueColor,
                    customCss: preset.customCss,
                    customCssEnabled: !!preset.customCss.trim(),
                    activePresetId: preset.id
                });
                updateControls();
                if (window.showToast) window.showToast(`已应用主题：${preset.name}`);
            });
            const removeSelectedPreset = async () => {
                const selectedId = presetSelect.value;
                if (!selectedId) return;
                presets = await persistOfflineThemePresets(presets.filter(preset => preset.id !== selectedId));
                if (theme.activePresetId === selectedId) {
                    theme = await persistOfflineTheme({ ...theme, activePresetId: '' });
                }
                updateControls();
                if (window.showToast) window.showToast('主题预设已删除');
            };
            deletePresetBtn.addEventListener('click', () => {
                const selected = presets.find(preset => preset.id === presetSelect.value);
                if (!selected) return;
                if (window.showCustomModal) {
                    window.showCustomModal({
                        title: '删除主题预设',
                        message: `确定删除“${selected.name}”吗？`,
                        confirmText: '删除',
                        cancelText: '取消',
                        isDestructive: true,
                        onConfirm: removeSelectedPreset
                    });
                } else {
                    removeSelectedPreset();
                }
            });
            exportPresetBtn.addEventListener('click', async () => {
                const selected = presets.find(preset => preset.id === theme.activePresetId);
                const exportName = selected?.name || '自定义线下主题';
                const payload = {
                    type: 'u2-offline-theme',
                    version: 1,
                    name: exportName,
                    theme: {
                        narrativeColor: theme.narrativeColor,
                        dialogueColor: theme.dialogueColor,
                        customCss: theme.customCss
                    }
                };
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                const result = await window.u2ExportFile({
                    blob,
                    fileName: `${exportName.replace(/[\\/:*?"<>|]/g, '_') || 'offline-theme'}.json`,
                    title: 'U2 线下主题'
                });
                if ((result === 'shared' || result === 'downloaded') && window.showToast) window.showToast('线下主题已导出');
                else if (result === 'failed' && window.showToast) window.showToast('线下主题导出失败');
            });
            importPresetBtn.addEventListener('click', () => importPresetInput.click());
            importPresetInput.addEventListener('change', async () => {
                const file = importPresetInput.files?.[0];
                importPresetInput.value = '';
                if (!file) return;
                try {
                    const payload = JSON.parse(await file.text());
                    const source = payload?.theme && typeof payload.theme === 'object' ? payload.theme : payload;
                    if (!source || typeof source !== 'object') throw new Error('Invalid offline theme file');
                    const importedTheme = normalizeOfflineTheme({
                        narrativeColor: source.narrativeColor,
                        dialogueColor: source.dialogueColor,
                        customCss: typeof source.customCss === 'string' ? source.customCss : '',
                        activePresetId: ''
                    });
                    const fallbackName = file.name.replace(/\.json$/i, '').trim() || '导入主题';
                    const name = String(payload?.name || source.name || fallbackName).trim().slice(0, 40) || '导入主题';
                    const existing = presets.find(preset => preset.name.toLocaleLowerCase() === name.toLocaleLowerCase());
                    const id = existing?.id || `offline-theme-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                    const nextPreset = {
                        id,
                        name,
                        narrativeColor: importedTheme.narrativeColor,
                        dialogueColor: importedTheme.dialogueColor,
                        customCss: importedTheme.customCss
                    };
                    presets = await persistOfflineThemePresets(existing
                        ? presets.map(preset => preset.id === id ? nextPreset : preset)
                        : presets.concat(nextPreset));
                    theme = await persistOfflineTheme({ ...nextPreset, activePresetId: id });
                    updateControls();
                    if (window.showToast) window.showToast(`已导入并应用主题：${name}`);
                } catch (error) {
                    console.error('Import offline theme failed', error);
                    if (window.showToast) window.showToast('主题文件无效，导入失败');
                }
            });
            presetControls.append(presetSelect, importPresetBtn, exportPresetBtn, deletePresetBtn);
            presetCard.append(presetControls, importPresetInput);
            listEl.appendChild(presetCard);

            const colorCard = document.createElement('section');
            colorCard.className = 'offline-theme-card';
            colorCard.appendChild(createHeading('聊天文字', 'TEXT COLORS', '控制 AI 叙述与对话文字颜色，并随主题预设一起保存。'));

            [
                { field: 'narrativeColor', label: '普通文本', detail: 'AI 叙述正文' },
                { field: 'dialogueColor', label: '对话文本', detail: '「」包裹的对话' }
            ].forEach(({ field, label, detail }) => {
                const row = document.createElement('label');
                row.className = 'offline-theme-color-row';

                const copy = document.createElement('span');
                copy.className = 'offline-theme-color-copy';
                copy.innerHTML = `<strong>${label}</strong><small>${detail}</small>`;

                const controlsWrap = document.createElement('span');
                controlsWrap.className = 'offline-theme-color-controls';
                const swatch = document.createElement('span');
                swatch.className = 'offline-theme-color-swatch';
                const colorInput = document.createElement('input');
                colorInput.type = 'color';
                colorInput.className = 'offline-theme-color-picker';
                colorInput.value = theme[field];
                colorInput.setAttribute('aria-label', `${label}颜色选择器`);
                const textInput = document.createElement('input');
                textInput.type = 'text';
                textInput.className = 'offline-theme-color-value';
                textInput.value = theme[field];
                textInput.maxLength = 7;
                textInput.spellcheck = false;
                textInput.setAttribute('aria-label', `${label}十六进制颜色`);

                colorInput.addEventListener('input', () => updateTheme(field, colorInput.value));
                textInput.addEventListener('input', () => {
                    if (/^#[0-9a-fA-F]{6}$/.test(textInput.value.trim())) {
                        updateTheme(field, textInput.value);
                    }
                });
                textInput.addEventListener('blur', () => {
                    textInput.value = theme[field];
                });

                controls.push({ field, colorInput, textInput, swatch });
                controlsWrap.append(swatch, colorInput, textInput);
                row.append(copy, controlsWrap);
                colorCard.appendChild(row);
            });
            listEl.appendChild(colorCard);

            const cssCard = document.createElement('section');
            cssCard.className = 'offline-theme-card offline-theme-css-card';
            cssCard.appendChild(createHeading('自定义 CSS', 'CUSTOM SOURCE', 'CSS 仅作用于线下主界面和弹幕详情页，编辑后点击“应用 CSS”生效。'));

            cssInput = document.createElement('textarea');
            cssInput.className = 'offline-theme-css-input';
            cssInput.value = theme.customCss;
            cssInput.spellcheck = false;
            cssInput.placeholder = '/* 在这里粘贴或编辑线下界面 CSS */\n:scope {\n  background: #fff;\n}';
            cssCard.appendChild(cssInput);

            const cssActions = document.createElement('div');
            cssActions.className = 'offline-theme-button-row';
            const clearCssBtn = document.createElement('button');
            clearCssBtn.type = 'button';
            clearCssBtn.className = 'danger';
            clearCssBtn.textContent = '清空 CSS';
            const copySourceBtn = document.createElement('button');
            copySourceBtn.type = 'button';
            copySourceBtn.textContent = '复制源码';
            const applyCssBtn = document.createElement('button');
            applyCssBtn.type = 'button';
            applyCssBtn.className = 'primary';
            applyCssBtn.textContent = '应用 CSS';

            clearCssBtn.addEventListener('click', async () => {
                theme = await persistOfflineTheme({
                    ...theme,
                    customCss: '',
                    customCssEnabled: false,
                    activePresetId: ''
                });
                updateControls();
                if (window.showToast) window.showToast('已清空线下 CSS');
            });
            copySourceBtn.addEventListener('click', async () => {
                try {
                    if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(OFFLINE_THEME_SOURCE_TEMPLATE);
                    } else {
                        const helper = document.createElement('textarea');
                        helper.value = OFFLINE_THEME_SOURCE_TEMPLATE;
                        helper.style.position = 'fixed';
                        helper.style.opacity = '0';
                        document.body.appendChild(helper);
                        helper.select();
                        document.execCommand('copy');
                        helper.remove();
                    }
                    if (window.showToast) window.showToast('已复制线下界面真实源码');
                } catch (error) {
                    console.error('Copy offline theme source failed', error);
                    if (window.showToast) window.showToast('复制失败，请稍后重试');
                }
            });
            applyCssBtn.addEventListener('click', async () => {
                const customCss = cssInput.value;
                theme = await persistOfflineTheme({
                    ...theme,
                    customCss,
                    customCssEnabled: !!customCss.trim(),
                    activePresetId: ''
                });
                updateControls();
                if (window.showToast) window.showToast(customCss.trim() ? '线下 CSS 已应用' : '线下 CSS 已关闭');
            });
            cssActions.append(clearCssBtn, copySourceBtn, applyCssBtn);
            cssCard.appendChild(cssActions);

            const saveRow = document.createElement('div');
            saveRow.className = 'offline-theme-save-row';
            const presetNameInput = document.createElement('input');
            presetNameInput.type = 'text';
            presetNameInput.maxLength = 40;
            presetNameInput.placeholder = '输入主题预设名称';
            const savePresetBtn = document.createElement('button');
            savePresetBtn.type = 'button';
            savePresetBtn.textContent = '存为主题预设';
            savePresetBtn.addEventListener('click', async () => {
                const name = presetNameInput.value.trim();
                if (!name) {
                    if (window.showToast) window.showToast('请输入主题预设名称');
                    presetNameInput.focus();
                    return;
                }
                const existing = presets.find(preset => preset.name.toLocaleLowerCase() === name.toLocaleLowerCase());
                const id = existing?.id || `offline-theme-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                const customCss = cssInput.value;
                const nextPreset = {
                    id,
                    name,
                    narrativeColor: theme.narrativeColor,
                    dialogueColor: theme.dialogueColor,
                    customCss
                };
                presets = await persistOfflineThemePresets(existing
                    ? presets.map(preset => preset.id === id ? nextPreset : preset)
                    : presets.concat(nextPreset));
                theme = await persistOfflineTheme({
                    ...nextPreset,
                    customCssEnabled: !!customCss.trim(),
                    activePresetId: id
                });
                presetNameInput.value = '';
                updateControls();
                if (window.showToast) window.showToast(existing ? '主题预设已更新' : '主题预设已保存');
            });
            saveRow.append(presetNameInput, savePresetBtn);
            cssCard.appendChild(saveRow);
            listEl.appendChild(cssCard);

            const resetBtn = document.createElement('button');
            resetBtn.type = 'button';
            resetBtn.className = 'offline-theme-reset-btn';
            resetBtn.innerHTML = '<i class="fas fa-undo"></i><span>恢复默认主题</span>';
            resetBtn.addEventListener('click', async () => {
                theme = await persistOfflineTheme(OFFLINE_THEME_DEFAULTS);
                updateControls();
                if (window.showToast) window.showToast('已恢复默认线下主题');
            });
            listEl.appendChild(resetBtn);

            updateControls();
        };

        // Render Offline Chat Settings
        const renderOfflineChatSettings = () => {
            const listEl = document.getElementById('offline-chat-settings-list');
            const regexListEl = document.getElementById('offline-chat-regex-list');
            const themeListEl = document.getElementById('offline-chat-theme-list');
            if (!listEl || !regexListEl || !themeListEl) return;
            listEl.innerHTML = '';
            regexListEl.innerHTML = '';
            themeListEl.innerHTML = '';
            
            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend) return;

            renderOfflineChatSettingsEditor(listEl, activeFriend);
            renderOfflineRegexSettingsEditor(regexListEl, activeFriend);
            renderOfflineThemeSettingsEditor(themeListEl, activeFriend);

            const tabButtons = Array.from(document.querySelectorAll('#offline-chat-settings-tabs [data-offline-settings-tab]'));
            const panels = {
                prompts: document.getElementById('offline-chat-prompts-panel'),
                regex: document.getElementById('offline-chat-regex-panel'),
                theme: document.getElementById('offline-chat-theme-panel')
            };
            const activateTab = (tabName) => {
                Object.entries(panels).forEach(([name, panel]) => {
                    if (!panel) return;
                    const active = name === tabName;
                    panel.hidden = !active;
                    panel.classList.toggle('active', active);
                });
                tabButtons.forEach((button) => {
                    const active = button.getAttribute('data-offline-settings-tab') === tabName;
                    button.classList.toggle('active', active);
                    button.setAttribute('aria-selected', String(active));
                });
            };
            tabButtons.forEach((button) => {
                button.onclick = () => activateTab(button.getAttribute('data-offline-settings-tab'));
            });
            activateTab('prompts');
        };


        // Offline Chat logic setup
        const setupOfflineChatLogic = () => {
            const sendBtn = document.getElementById('offline-chat-send-btn');
            const inputField = document.getElementById('offline-chat-input');
            const attachmentBtn = document.getElementById('offline-chat-attachment-btn');
            const actionSheet = document.getElementById('offline-chat-action-sheet');
            const actionCancel = document.getElementById('offline-chat-action-cancel');
            const clearBtn = document.getElementById('offline-chat-clear-btn');
            const endBtn = document.getElementById('offline-chat-end-btn');
            const exportTxtBtn = document.getElementById('offline-chat-export-txt-btn');
            const chatView = document.getElementById('offline-chat-view');
            const summarySheet = document.getElementById('offline-chat-summary-sheet');
            const summaryApiSelect = document.getElementById('offline-summary-api-select');
            const summaryPromptInput = document.getElementById('offline-summary-prompt-input');
            const summaryStartInput = document.getElementById('offline-summary-start-floor');
            const summaryEndInput = document.getElementById('offline-summary-end-floor');
            const summaryOnlyBtn = document.getElementById('offline-summary-only-btn');
            const summaryEndBtn = document.getElementById('offline-summary-end-btn');
            const summaryCancelBtn = document.getElementById('offline-summary-cancel-btn');

            let isGenerating = false;
            let currentGenerationController = null;
            let offlineSummarySettingsTimer = null;

            const closeOfflineSummarySheet = () => {
                if (!summarySheet) return;
                summarySheet.classList.remove('active');
                setTimeout(() => { summarySheet.style.display = 'none'; }, 180);
            };

            const getOfflineSummarySettingsFromModal = () => normalizeOfflineSummarySettings({
                apiPresetId: summaryApiSelect?.value || '',
                prompt: summaryPromptInput?.value || ''
            });

            const saveOfflineSummarySettingsFromModal = async () => {
                const activeFriend = window.imData.currentActiveFriend;
                if (!activeFriend) return;
                await persistOfflineSummarySettings(activeFriend, getOfflineSummarySettingsFromModal());
            };

            const refreshOfflineSummaryApiSelect = (settings) => {
                if (!summaryApiSelect) return;
                const normalized = normalizeOfflineSummarySettings(settings);
                const presets = getOfflineSummaryApiPresets();
                summaryApiSelect.replaceChildren();
                const currentOption = document.createElement('option');
                currentOption.value = '';
                currentOption.textContent = '跟随当前 API';
                summaryApiSelect.appendChild(currentOption);
                presets.forEach((preset) => {
                    const option = document.createElement('option');
                    option.value = String(preset?.id || '');
                    option.textContent = String(preset?.name || '未命名预设');
                    summaryApiSelect.appendChild(option);
                });
                summaryApiSelect.value = presets.some(preset => String(preset?.id || '') === normalized.apiPresetId)
                    ? normalized.apiPresetId
                    : '';
            };

            const openOfflineSummarySheet = () => {
                const activeFriend = window.imData.currentActiveFriend;
                if (!activeFriend || !summarySheet) return;
                const messages = normalizeOfflineMessagesForFriend(activeFriend);
                const unarchivedRows = getOfflineUnarchivedDialogueRows(messages);
                const allRows = getOfflineDialogueRows(messages);
                const canEnd = messages.some(message => isOfflineSummaryMessage(message) || (message.role === 'user' || message.role === 'assistant'));
                if (!canEnd) {
                    if (window.showToast) window.showToast('没有可结束的见面内容');
                    return;
                }
                const firstFloor = unarchivedRows[0]?.floor || allRows[0]?.floor || 1;
                const lastFloor = unarchivedRows[unarchivedRows.length - 1]?.floor || allRows[allRows.length - 1]?.floor || firstFloor;
                const settings = getOfflineSummarySettings(activeFriend);
                refreshOfflineSummaryApiSelect(settings);
                if (summaryPromptInput) summaryPromptInput.value = settings.prompt;
                [summaryStartInput, summaryEndInput].forEach(input => {
                    if (!input) return;
                    input.min = String(firstFloor);
                    input.max = String(lastFloor);
                });
                if (summaryStartInput) summaryStartInput.value = String(firstFloor);
                if (summaryEndInput) summaryEndInput.value = String(lastFloor);
                if (summaryOnlyBtn) summaryOnlyBtn.disabled = unarchivedRows.length === 0;
                if (summaryEndBtn) summaryEndBtn.disabled = false;
                summarySheet.style.display = 'flex';
                void summarySheet.offsetWidth;
                summarySheet.classList.add('active');
            };

            if (summaryApiSelect) {
                summaryApiSelect.addEventListener('change', () => {
                    saveOfflineSummarySettingsFromModal().catch((error) => {
                        console.error('Offline summary API setting save failed', error);
                        if (window.showToast) window.showToast('线下总结设置保存失败');
                    });
                });
            }
            if (summaryPromptInput) {
                summaryPromptInput.addEventListener('input', () => {
                    if (offlineSummarySettingsTimer) clearTimeout(offlineSummarySettingsTimer);
                    offlineSummarySettingsTimer = setTimeout(() => {
                        saveOfflineSummarySettingsFromModal().catch((error) => console.error('Offline summary prompt save failed', error));
                    }, 350);
                });
            }
            if (summaryCancelBtn) summaryCancelBtn.addEventListener('click', closeOfflineSummarySheet);
            if (summarySheet) {
                summarySheet.addEventListener('click', (event) => {
                    if (event.target === summarySheet) closeOfflineSummarySheet();
                });
            }
            if (summaryOnlyBtn) {
                summaryOnlyBtn.addEventListener('click', async () => {
                    const activeFriend = window.imData.currentActiveFriend;
                    if (!activeFriend || summaryOnlyBtn.disabled) return;
                    const settings = getOfflineSummarySettingsFromModal();
                    const startFloor = Number(summaryStartInput?.value);
                    const endFloor = Number(summaryEndInput?.value);
                    summaryOnlyBtn.disabled = true;
                    if (summaryEndBtn) summaryEndBtn.disabled = true;
                    try {
                        if (window.showToast) window.showToast('正在生成线下总结...');
                        await summarizeOfflineFloors(activeFriend, startFloor, endFloor, settings);
                        closeOfflineSummarySheet();
                        if (window.showToast) window.showToast(`第 ${startFloor}–${endFloor} 楼已总结并归档`);
                    } catch (error) {
                        console.error('Offline segment summary failed', error);
                        const message = /already summarized/i.test(String(error?.message || ''))
                            ? '所选楼层包含已归档内容，请选择连续的未归档楼层'
                            : /range is invalid/i.test(String(error?.message || ''))
                                ? '请输入有效且连续的未归档楼层范围'
                                : '线下总结失败，请检查 API 配置或网络';
                        if (window.showToast) window.showToast(message);
                    } finally {
                        summaryOnlyBtn.disabled = false;
                        if (summaryEndBtn) summaryEndBtn.disabled = false;
                    }
                });
            }
            if (summaryEndBtn) {
                summaryEndBtn.addEventListener('click', async () => {
                    const activeFriend = window.imData.currentActiveFriend;
                    if (!activeFriend || summaryEndBtn.disabled) return;
                    const settings = getOfflineSummarySettingsFromModal();
                    summaryEndBtn.disabled = true;
                    if (summaryOnlyBtn) summaryOnlyBtn.disabled = true;
                    try {
                        // End always summarizes every unarchived floor; the displayed range is informational for this path.
                        const ended = await endOfflineMeeting(summaryEndBtn, { settings });
                        if (ended) closeOfflineSummarySheet();
                    } finally {
                        summaryEndBtn.disabled = false;
                        if (summaryOnlyBtn) summaryOnlyBtn.disabled = false;
                    }
                });
            }
            
            if (attachmentBtn && actionSheet) {
                attachmentBtn.addEventListener('click', () => {
                    actionSheet.style.display = 'flex';
                    // Trigger reflow
                    void actionSheet.offsetWidth;
                    actionSheet.classList.add('active');
                });
                
                if (actionCancel) {
                    actionCancel.addEventListener('click', () => {
                        actionSheet.classList.remove('active');
                        setTimeout(() => {
                            actionSheet.style.display = 'none';
                        }, 300);
                    });
                }
                
                actionSheet.addEventListener('click', (e) => {
                    if (e.target === actionSheet) {
                        actionSheet.classList.remove('active');
                        setTimeout(() => {
                            actionSheet.style.display = 'none';
                        }, 300);
                    }
                });
            }

            if (clearBtn && chatView) {
                clearBtn.addEventListener('click', async () => {
                    actionSheet.classList.remove('active');
                    setTimeout(() => {
                        actionSheet.style.display = 'none';
                    }, 300);

                    const clearOfflineHistory = async () => {
                        const activeFriend = window.imData.currentActiveFriend;
                        if (!activeFriend) return;
                        clearBtn.dataset.busy = 'true';
                        clearBtn.style.pointerEvents = 'none';
                        try {
                            await persistOfflineMessages(activeFriend, []);
                            renderOfflineCurrentMessages(activeFriend);
                            if (window.showToast) window.showToast('线下聊天记录已清空');
                        } catch (error) {
                            console.error('Failed to clear offline chat history', error);
                            if (window.showToast) window.showToast('清空线下聊天记录失败，请重试');
                        } finally {
                            clearBtn.dataset.busy = 'false';
                            clearBtn.style.pointerEvents = '';
                        }
                    };

                    const confirmClear = () => {
                        void clearOfflineHistory();
                    };
                    if (window.showCustomModal) {
                        window.showCustomModal({
                            title: '清空线下聊天记录',
                            message: '确定清空本次线下见面的全部聊天记录吗？此操作无法恢复。',
                            confirmText: '清空',
                            isDestructive: true,
                            onConfirm: confirmClear
                        });
                    } else if (window.confirm('确定清空本次线下见面的全部聊天记录吗？此操作无法恢复。')) {
                        confirmClear();
                    }
                });
            }

            if (endBtn && actionSheet) {
                endBtn.addEventListener('click', async () => {
                    actionSheet.classList.remove('active');
                    setTimeout(() => {
                        actionSheet.style.display = 'none';
                    }, 300);
                    openOfflineSummarySheet();
                });
            }

            if (exportTxtBtn && actionSheet) {
                exportTxtBtn.addEventListener('click', async () => {
                    const activeFriend = window.imData.currentActiveFriend;
                    if (!activeFriend || exportTxtBtn.disabled) return;
                    exportTxtBtn.disabled = true;
                    exportTxtBtn.style.pointerEvents = 'none';
                    const originalText = exportTxtBtn.textContent;
                    exportTxtBtn.textContent = '正在导出…';
                    try {
                        const result = await exportOfflineChatTxt(activeFriend);
                        actionSheet.classList.remove('active');
                        setTimeout(() => {
                            actionSheet.style.display = 'none';
                        }, 300);
                        if (result === 'downloaded') window.showToast?.('线下聊天记录已导出为 TXT');
                        if (result === 'shared') window.showToast?.('已打开系统保存，请选择“存储到文件”');
                    } catch (error) {
                        window.showToast?.(error?.message || '线下聊天记录导出失败，请稍后重试');
                    } finally {
                        exportTxtBtn.disabled = false;
                        exportTxtBtn.style.pointerEvents = '';
                        exportTxtBtn.textContent = originalText;
                    }
                });
            }
            
            if (sendBtn && inputField) {
                const handleSend = async () => {
                    if (isGenerating) {
                        if (currentGenerationController && !currentGenerationController.signal.aborted) {
                            currentGenerationController.abort();
                            sendBtn.classList.remove('is-generating');
                            sendBtn.classList.add('is-stopping');
                            sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                            sendBtn.title = '正在暂停';
                        }
                        return;
                    }
                    const text = inputField.value.trim();
                    const activeFriend = window.imData.currentActiveFriend;
                    if (!activeFriend) return;
                    if (!text) {
                        const currentMessages = normalizeOfflineMessagesForFriend(activeFriend);
                        const lastCurrentMessage = currentMessages[currentMessages.length - 1];
                        if (lastCurrentMessage?.role !== 'user') return;
                    }

                    // 获取当前 API Config
                    const currentApiConfig = window.getApiConfig ? window.getApiConfig() : (window.apiConfig || {});
                    if (!currentApiConfig.endpoint || !currentApiConfig.apiKey) {
                        if (window.showToast) window.showToast('请先配置 API');
                        return;
                    }

                    {
                        inputField.value = '';
                        isGenerating = true;
                        const generationController = new AbortController();
                        currentGenerationController = generationController;
                        inputField.disabled = true;
                        const sendOriginalBtnContent = sendBtn.innerHTML;
                        const sendOriginalTitle = sendBtn.title || '';
                        sendBtn.classList.add('is-generating');
                        sendBtn.classList.remove('is-stopping');
                        sendBtn.innerHTML = '<i class="fas fa-pause"></i>';
                        sendBtn.title = '暂停生成';
                        let pendingAiMessage = null;
                        let streamingBubble = null;

                        try {
                            await ensureOfflineMeetingState(activeFriend);
                            const previousMessages = normalizeOfflineMessagesForFriend(activeFriend);
                            const lastPreviousMessage = previousMessages[previousMessages.length - 1];
                            const resumeTrailingUser = !text && lastPreviousMessage?.role === 'user';
                            if (!text && !resumeTrailingUser) return;
                            let messagesWithUser = previousMessages;
                            if (text) {
                                const userMsg = {
                                    id: createOfflineChatId('offline-user'),
                                    role: 'user',
                                    content: text,
                                    timestamp: Date.now()
                                };
                                messagesWithUser = await persistOfflineMessages(activeFriend, previousMessages.concat(userMsg));
                                const persistedUserMsg = messagesWithUser.find(message => String(message.id) === String(userMsg.id)) || userMsg;
                                renderOfflineChatBubble(persistedUserMsg, true, {
                                    floor: getOfflineMessageFloor(messagesWithUser, persistedUserMsg.id),
                                    depth: 0
                                });
                            }

                            const aiTimestamp = Date.now();
                            const aiMessageId = createOfflineChatId('offline-ai');
                            pendingAiMessage = {
                                id: aiMessageId,
                                role: 'assistant',
                                content: '',
                                timestamp: aiTimestamp,
                                tokens: 0
                            };
                            streamingBubble = createStreamingBubble('', false, {
                                id: aiMessageId,
                                floor: getOfflineDialogueRows(messagesWithUser).length + 1,
                                timestamp: aiTimestamp,
                                depth: 0
                            });
                            if (!streamingBubble) {
                                throw new Error('Failed to create streaming bubble');
                            }

                            const requestContext = buildOfflineApiMessages(activeFriend, messagesWithUser);
                            const { content: finalReplyContent, reasoning: finalReplyReasoning, tokens, aborted } = await requestOfflineAssistantReplyWithCotValidation(requestContext, streamingBubble, {
                                signal: generationController.signal,
                                requestReasoning: true
                            });

                            const latestMessages = normalizeOfflineMessagesForFriend(activeFriend);
                            const autoImageOutput = splitOfflineAutoImageMarker(finalReplyContent);
                            const aiMsgObj = {
                                ...pendingAiMessage,
                                content: autoImageOutput.content,
                                reasoning: finalReplyReasoning || undefined,
                                tokens: Math.max(0, Number(tokens) || 0),
                                offlineRegexAppliedRevisions: {}
                            };
                            if (!String(finalReplyContent || '').trim()) {
                                renderOfflineCurrentMessages(activeFriend);
                            } else if (!String(autoImageOutput.content || '').trim()) {
                                renderOfflineCurrentMessages(activeFriend);
                            } else {
                                const persistedMessages = await persistOfflineMessages(activeFriend, latestMessages.concat(aiMsgObj));
                                streamingBubble.enableActions(aiMsgObj);
                                if (autoImageOutput.scene) {
                                    await generateOfflineAutoImage(activeFriend, aiMsgObj.id, autoImageOutput.scene, persistedMessages);
                                }
                            }

                            if (aborted && window.showToast) {
                                window.showToast(finalReplyContent ? '已暂停生成' : '已暂停生成，可重回空白楼层');
                            }
                        } catch (error) {
                            console.error("Offline Chat API Error:", error);
                            const isPersistenceFailure = /Failed to persist offline meeting/.test(String(error?.message || ''));
                            let failureFloorPersistenceFailed = false;
                            if (!isPersistenceFailure && pendingAiMessage) {
                                try {
                                    const latestMessages = normalizeOfflineMessagesForFriend(activeFriend);
                                    const alreadyPersisted = latestMessages.some(message => String(message.id) === String(pendingAiMessage.id));
                                    if (!alreadyPersisted) {
                                        const failedResult = streamingBubble?.getResult?.() || {};
                                        const failedContent = String(failedResult.content || '');
                                        if (!failedContent.trim()) {
                                            renderOfflineCurrentMessages(activeFriend);
                                        } else {
                                            const failedMessage = {
                                                ...pendingAiMessage,
                                                content: failedContent,
                                                reasoning: String(failedResult.reasoning || '').trim() || undefined,
                                                generationState: 'failed',
                                                generationError: error?.code === 'reasoning_config_unsupported'
                                                    ? 'reasoning_unsupported'
                                                    : (error?.code === 'reasoning_tokens_exhausted'
                                                        ? 'reasoning_tokens_exhausted'
                                                        : 'request_failed')
                                            };
                                            await persistOfflineMessages(activeFriend, latestMessages.concat(failedMessage));
                                            renderOfflineCurrentMessages(activeFriend);
                                        }
                                    }
                                } catch (persistError) {
                                    console.error('Failed to persist offline failure floor:', persistError);
                                    failureFloorPersistenceFailed = true;
                                }
                            }
                            if (window.showToast) {
                                window.showToast(isPersistenceFailure || failureFloorPersistenceFailed
                                    ? '线下聊天记录保存失败'
                                    : (error?.code === 'reasoning_config_unsupported'
                                        ? '当前接口不支持自动推理配置'
                                        : (error?.code === 'reasoning_tokens_exhausted'
                                            ? '思考已用完固定的 30000 回复 Token，请重试或更换模型'
                                            : (error?.code === 'empty_response'
                                                ? '模型返回了空回复，请重试或更换模型'
                                                : '请求失败，请检查网络或 API 配置'))));
                            }
                        } finally {
                            isGenerating = false;
                            currentGenerationController = null;
                            inputField.disabled = false;
                            sendBtn.classList.remove('is-generating', 'is-stopping');
                            sendBtn.innerHTML = sendOriginalBtnContent;
                            sendBtn.title = sendOriginalTitle;
                            setTimeout(() => {
                                try {
                                    inputField.focus({ preventScroll: true });
                                } catch (error) {
                                    inputField.focus();
                                }
                            }, 50);
                        }
                    }
                    return;

                };

                sendBtn.addEventListener('click', handleSend);
                inputField.addEventListener('keydown', (e) => {
                    if (e.isComposing || e.keyCode === 229) return;
                    if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.keyCode === 13)) {
                        e.preventDefault();
                        handleSend();
                    }
                });
            }
        };
        setupOfflineChatLogic();

        const closeSheet = () => {
            const currentPage = attachmentSheet.parentElement || page;
            const inputContainer = currentPage.querySelector('.ins-chat-input-container');
            stopLinkedAccountTimer();
            closeLinkedAccountModal();
            closePayTransferForm();
            closeVoiceMessageForm();
            closeNarrationForm();
            closeRegenerateForm();
            overlay.style.opacity = '0';
            content.style.transform = 'translateY(100%)';
            setTimeout(() => {
                attachmentSheet.style.display = 'none';
            }, 300);
        };

        const submitVoiceMessage = async () => {
            const transcript = String(voiceTranscriptInput ? voiceTranscriptInput.value : '').trim();
            if (!transcript) {
                if (window.showToast) window.showToast('请输入语音内容');
                return;
            }

            closeVoiceMessageForm();
            closeSheet();
            await window.imChat.sendVoiceMessage(transcript);
        };

        const submitNarrationMessage = async () => {
            const narrationText = String(narrationInput ? narrationInput.value : '').trim();
            if (!narrationText) {
                if (window.showToast) window.showToast('请输入旁白内容');
                return;
            }

            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend) {
                if (window.showToast) window.showToast('当前聊天不存在');
                return;
            }

            if (activeFriend.type === 'group' && Number(activeFriend.leftGroupAt) > 0) {
                if (window.showToast) window.showToast('已退出该群，不能添加旁白');
                return;
            }

            const activePage = document.getElementById(`chat-interface-${activeFriend.id}`);
            const activeContainer = activePage ? activePage.querySelector('.ins-chat-messages') : null;
            const now = Date.now();
            const narrationMsg = {
                id: window.imChat.createMessageId ? window.imChat.createMessageId('notice') : `notice-${now}`,
                role: 'system',
                type: 'system_notice',
                noticeKind: 'narration',
                narrationSource: 'manual',
                content: narrationText,
                text: narrationText,
                timestamp: now
            };

            const saved = window.imApp.appendFriendMessage
                ? await window.imApp.appendFriendMessage(activeFriend.id, narrationMsg, { silent: true })
                : await commitSheetFriendChange(activeFriend, (targetFriend) => {
                    if (!targetFriend.messages) targetFriend.messages = [];
                    targetFriend.messages.push(narrationMsg);
                }, { silent: true });

            if (!saved) {
                if (window.showToast) window.showToast('旁白保存失败');
                return;
            }

            closeNarrationForm();
            closeSheet();

            const latestFriend = (window.imData.friends || [])
                .find(item => String(item.id) === String(activeFriend.id)) || activeFriend;
            if (activeContainer) {
                const appended = window.imChat.appendMessageToContainer
                    ? window.imChat.appendMessageToContainer(latestFriend, activeContainer, narrationMsg, { scroll: true })
                    : false;
                if (!appended && window.imChat.rerenderChatContainer) {
                    window.imChat.rerenderChatContainer(latestFriend, activeContainer, { scroll: true });
                }
            }
        };

        const submitRegenerateRequest = async (useRequirement) => {
            if (regenerateEntry?.dataset?.busy === 'true') return;

            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend || !window.imChat.regenerateLastAiReply) {
                if (window.showToast) window.showToast('暂无可重回的回复');
                return;
            }

            const userRequirement = useRequirement
                ? String(regenerateRequirementInput ? regenerateRequirementInput.value : '').trim()
                : '';

            if (useRequirement && !userRequirement) {
                if (window.showToast) window.showToast('请先输入参考要求');
                if (regenerateRequirementInput) regenerateRequirementInput.focus();
                return;
            }

            setRegenerateBusyState(true);
            closeRegenerateForm();
            closeSheet();

            try {
                await window.imChat.regenerateLastAiReply(activeFriend, regenerateEntry, { userRequirement });
            } finally {
                setRegenerateBusyState(false);
            }
        };

        const submitPayTransfer = async () => {
            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend) {
                if (window.showToast) window.showToast('当前聊天不存在');
                return;
            }

            const isGroupChat = activeFriend.type === 'group';
            const activePageId = `chat-interface-${activeFriend.id}`;
            const activePage = document.getElementById(activePageId);
            const activeContainer = activePage ? activePage.querySelector('.ins-chat-messages') : null;
            const now = Date.now();
            const lastMsg = activeFriend.messages && activeFriend.messages.length > 0
                ? activeFriend.messages[activeFriend.messages.length - 1]
                : null;

            if (currentPayMode === 'red_packet' && isGroupChat) {
                const packetCount = parseInt(payRedPacketCountInput ? payRedPacketCountInput.value : '', 10);
                const totalAmount = Number(payRedPacketAmountInput ? payRedPacketAmountInput.value : '');
                const description = String(payRedPacketDescInput ? payRedPacketDescInput.value : '').trim() || '恭喜发财';

                if (!Number.isInteger(packetCount) || packetCount <= 0) {
                    if (window.showToast) window.showToast('红包个数无效');
                    return;
                }

                if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
                    if (window.showToast) window.showToast('总金额无效');
                    return;
                }

                const allocations = window.imChat.createRedPacketAllocations(totalAmount, packetCount);
                if (allocations.length !== packetCount) {
                    if (window.showToast) window.showToast('红包金额需至少满足每包 0.01');
                    return;
                }

                // Call payment selection instead of immediate deduction
                const didOpenSelection = renderPayMethodSelection(totalAmount, async (selectedCardId) => {
                    const success = typeof window.addPayTransaction === 'function'
                        ? window.addPayTransaction(totalAmount, `${description} · 群红包`, 'expense', selectedCardId)
                        : false;

                    if (!success) {
                        if (window.showToast) window.showToast('红包发送失败');
                        return;
                    }

                    const packetMsg = window.imChat.normalizeGroupRedPacketState({
                        id: window.imChat.createMessageId('packet'),
                        packetId: window.imChat.createMessageId('packet'),
                        role: 'user',
                        type: 'group_red_packet',
                        totalAmount,
                        packetCount,
                        description,
                        allocations,
                        claimRecords: [],
                        claimedMemberIds: [],
                        content: `[群红包] ${description} ¥${Number(totalAmount).toFixed(2)}`,
                        timestamp: now
                    }, activeFriend);

                    window.imApp.captureGroupUserIdentity?.(activeFriend, packetMsg);

                    const saved = window.imApp.appendFriendMessage
                        ? await window.imApp.appendFriendMessage(activeFriend.id, packetMsg, { silent: true })
                        : await commitSheetFriendChange(activeFriend, (targetFriend) => {
                            if (!targetFriend.messages) targetFriend.messages = [];
                            targetFriend.messages.push(packetMsg);
                        }, { silent: true });

                    if (!saved) {
                        if (window.showToast) window.showToast('红包记录保存失败');
                        return;
                    }

                    closeSheet();

                    if (activeContainer) {
                        const appended = window.imChat.appendMessageToContainer
                            ? window.imChat.appendMessageToContainer(activeFriend, activeContainer, packetMsg, { scroll: true })
                            : false;
                        if (!appended && window.imChat.rerenderChatContainer) {
                            window.imChat.rerenderChatContainer(activeFriend, activeContainer, { scroll: true });
                        }
                    }
                });

                if (!didOpenSelection) {
                    // Fallback to existing logic if selection fails to open (e.g., no cards)
                    if (window.showToast) window.showToast('支付方式拉取失败');
                }
                return;
            }

            const amount = Number(payAmountInput ? payAmountInput.value : '');
            const description = String(payDescInput ? payDescInput.value : '').trim() || '转账';

            if (!Number.isFinite(amount) || amount <= 0) {
                if (window.showToast) window.showToast('金额无效');
                return;
            }

            let targetName = activeFriend.type === 'group'
                ? (activeFriend.nickname || '群聊')
                : (activeFriend.nickname || activeFriend.realName || '对方');
            const groupUserIdentity = isGroupChat && window.imApp?.getGroupUserIdentity
                ? window.imApp.getGroupUserIdentity(activeFriend)
                : null;
            const senderName = groupUserIdentity?.name || userState?.name || userState?.realName || userState?.nickname || 'User';

            if (isGroupChat) {
                const selectedMember = window.imChat.getAvailableGroupRecipients(activeFriend).find(member => String(member.id) === String(selectedRecipientId));
                if (!selectedMember) {
                    if (window.showToast) window.showToast('请选择群成员');
                    return;
                }
                targetName = selectedMember.nickname || selectedMember.realName || '群成员';
            }

            const didOpenSelection = renderPayMethodSelection(amount, async (selectedCardId) => {
                const success = typeof window.addPayTransaction === 'function'
                    ? window.addPayTransaction(amount, `${description} · ${targetName}`, 'expense', selectedCardId)
                    : false;

                if (!success) {
                    if (window.showToast) window.showToast('转账失败');
                    return;
                }

                const payMsg = {
                    id: window.imChat.createMessageId('pay'),
                    role: 'user',
                    type: 'pay_transfer',
                    payKind: 'user_to_char',
                    payDirection: 'user_to_char',
                    amount,
                    description,
                    payerName: senderName,
                    payeeName: targetName,
                    senderName,
                    receiverName: targetName,
                    targetName,
                    targetMemberId: isGroupChat ? selectedRecipientId : null,
                    cardTitle: isGroupChat ? '群转账' : 'Pay 转账',
                    payStatus: 'completed',
                    content: `[用户转账] ${description} ¥${amount.toFixed(2)}`,
                    timestamp: now
                };

                window.imApp.captureGroupUserIdentity?.(activeFriend, payMsg);

                const saved = window.imApp.appendFriendMessage
                    ? await window.imApp.appendFriendMessage(activeFriend.id, payMsg, { silent: true })
                    : await commitSheetFriendChange(activeFriend, (targetFriend) => {
                        if (!targetFriend.messages) targetFriend.messages = [];
                        targetFriend.messages.push(payMsg);
                    }, { silent: true });

                if (!saved) {
                    if (window.showToast) window.showToast('转账记录保存失败');
                    return;
                }

                closeSheet();

                if (activeContainer) {
                    const appended = window.imChat.appendMessageToContainer
                        ? window.imChat.appendMessageToContainer(activeFriend, activeContainer, payMsg, { scroll: true })
                        : false;
                    if (!appended && window.imChat.rerenderChatContainer) {
                        window.imChat.rerenderChatContainer(activeFriend, activeContainer, { scroll: true });
                    }
                }
            });

            if (!didOpenSelection) {
                if (window.showToast) window.showToast('支付方式拉取失败');
            }
        };

        overlay.addEventListener('click', closeSheet);
        closeBtn.addEventListener('click', closeSheet);

        if (payEntry) {
            payEntry.addEventListener('click', () => {
                openPayTransferForm();
            });
        }

        if (linkEntry) {
            linkEntry.addEventListener('click', () => {
                closeSheet();
                if (window.imChat.openFakeLinkComposer) {
                    window.imChat.openFakeLinkComposer();
                } else if (window.showToast) {
                    window.showToast('链接功能加载失败');
                }
            });
        }

        if (voiceEntry) {
            voiceEntry.addEventListener('click', () => {
                openVoiceMessageForm();
            });
        }

        if (listenEntry) {
            listenEntry.addEventListener('click', () => {
                const activeFriend = window.imData.currentActiveFriend;
                if (!activeFriend || activeFriend.type !== 'char') return;
                closeSheet();
                window.libraryApp?.openTogetherListeningPicker?.(activeFriend);
            });
        }

        if (narrationEntry) {
            narrationEntry.addEventListener('click', () => {
                openNarrationForm();
            });
        }

        if (dynamicActionEntry) {
            dynamicActionEntry.addEventListener('click', async () => {
                await toggleDynamicActionNarration();
            });
        }

        if (regenerateEntry) {
            regenerateEntry.addEventListener('click', () => {
                if (regenerateEntry.dataset.busy === 'true') return;

                const activeFriend = window.imData.currentActiveFriend;
                if (!activeFriend || !window.imChat.regenerateLastAiReply) {
                    if (window.showToast) window.showToast('暂无可重回的回复');
                    return;
                }

                openRegenerateForm();
            });
        }

        if (payRecipientTrigger) {
            payRecipientTrigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const activeFriend = window.imData.currentActiveFriend;
                if (!activeFriend || activeFriend.type !== 'group') return;
                const hasOptions = payRecipientDropdown && payRecipientDropdown.children.length > 0;
                if (!hasOptions) return;
                const isOpen = payRecipientDropdown && payRecipientDropdown.style.display === 'block';
                setRecipientDropdownOpen(!isOpen);
            });
        }

        if (payModeTabs.length > 0) {
            payModeTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const activeFriend = window.imData.currentActiveFriend;
                    const nextMode = tab.getAttribute('data-pay-mode') || 'transfer';
                    setRecipientDropdownOpen(false);
                    syncPayModeUi(activeFriend, nextMode);
                    setTimeout(() => {
                        if (nextMode === 'red_packet') {
                            if (payRedPacketCountInput) payRedPacketCountInput.focus();
                        } else if (payAmountInput) {
                            payAmountInput.focus();
                        }
                    }, 20);
                });
            });
        }

        if (payFormOverlay) {
            payFormOverlay.addEventListener('click', (e) => {
                if (e.target === payFormOverlay) {
                    closePayTransferForm();
                    return;
                }

                if (
                    payRecipientDropdown &&
                    payRecipientDropdown.style.display === 'block' &&
                    !e.target.closest('.pay-group-recipient-field')
                ) {
                    setRecipientDropdownOpen(false);
                }
            });
        }

        if (voiceFormOverlay) {
            voiceFormOverlay.addEventListener('click', (e) => {
                if (e.target === voiceFormOverlay) {
                    closeSheet();
                }
            });
        }

        if (narrationFormOverlay) {
            narrationFormOverlay.addEventListener('click', (e) => {
                if (e.target === narrationFormOverlay) {
                    closeSheet();
                }
            });
        }

        if (regenerateFormOverlay) {
            regenerateFormOverlay.addEventListener('click', (e) => {
                if (e.target === regenerateFormOverlay) {
                    closeSheet();
                }
            });
        }

        if (voiceCancelBtn) {
            voiceCancelBtn.addEventListener('click', () => {
                closeSheet();
            });
        }

        if (voiceSubmitBtn) {
            voiceSubmitBtn.addEventListener('click', async () => {
                await submitVoiceMessage();
            });
        }

        if (narrationCancelBtn) {
            narrationCancelBtn.addEventListener('click', () => {
                closeSheet();
            });
        }

        if (narrationSubmitBtn) {
            narrationSubmitBtn.addEventListener('click', async () => {
                await submitNarrationMessage();
            });
        }

        if (regenerateReferenceBtn) {
            regenerateReferenceBtn.addEventListener('click', async () => {
                await submitRegenerateRequest(true);
            });
        }

        if (regenerateDirectBtn) {
            regenerateDirectBtn.addEventListener('click', async () => {
                await submitRegenerateRequest(false);
            });
        }

        if (offlineEntry) {
            offlineEntry.addEventListener('click', () => {
                openOfflineChatView();
            });
        }

        const chatCloseBtn = document.getElementById('offline-chat-close-btn');
        if (chatCloseBtn) {
            chatCloseBtn.addEventListener('click', () => {
                const chatView = document.getElementById('offline-chat-view');
                if (chatView) {
                    chatView.classList.remove('active');
                    setTimeout(() => { chatView.style.display = 'none'; }, 300);
                }
            });
        }

        const chatSettingsBtn = document.getElementById('offline-chat-settings-btn');
        if (chatSettingsBtn) {
            chatSettingsBtn.addEventListener('click', () => {
                renderOfflineChatSettings();
                window.openView(document.getElementById('offline-chat-settings-sheet'));
            });
        }

        const chatSettingsBackBtn = document.getElementById('offline-chat-settings-back-btn');
        if (chatSettingsBackBtn) {
            chatSettingsBackBtn.addEventListener('click', () => {
                window.closeView(document.getElementById('offline-chat-settings-sheet'));
            });
        }

        if (voiceTranscriptInput) {
            voiceTranscriptInput.addEventListener('keydown', (e) => {
                if (e.isComposing || e.keyCode === 229) return;
                if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.keyCode === 13)) {
                    e.preventDefault();
                    submitVoiceMessage();
                }
            });
        }

        if (narrationInput) {
            narrationInput.addEventListener('keydown', (e) => {
                if (e.isComposing || e.keyCode === 229) return;
                if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.keyCode === 13)) {
                    e.preventDefault();
                    submitNarrationMessage();
                }
            });
        }

        if (regenerateRequirementInput) {
            regenerateRequirementInput.addEventListener('keydown', (e) => {
                if (e.isComposing || e.keyCode === 229) return;
                if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.keyCode === 13)) {
                    e.preventDefault();
                    submitRegenerateRequest(true);
                }
            });
        }

        if (payCancelBtn) {
            payCancelBtn.addEventListener('click', () => {
                closePayTransferForm();
            });
        }

        if (paySubmitBtn) {
            paySubmitBtn.addEventListener('click', async () => {
                await submitPayTransfer();
            });
        }

        if (payAmountInput) {
            payAmountInput.addEventListener('keydown', (e) => {
                if (e.isComposing || e.keyCode === 229) return;
                if (e.key === 'Enter' || e.keyCode === 13) {
                    e.preventDefault();
                    if (payDescInput) payDescInput.focus();
                }
            });
        }

        if (payDescInput) {
            payDescInput.addEventListener('keydown', (e) => {
                if (e.isComposing || e.keyCode === 229) return;
                if (e.key === 'Enter' || e.keyCode === 13) {
                    e.preventDefault();
                    submitPayTransfer();
                }
            });
        }

        const getAttachmentTargetFriend = () => {
            const friendId = attachmentSheet.dataset.friendId;
            if (friendId != null && friendId !== '') {
                const storedFriend = window.imApp?.getFriendById?.(friendId)
                    || (window.imData.friends || []).find(
                        item => String(item.id) === String(friendId)
                    );
                if (storedFriend) return storedFriend;
            }
            return window.imData.currentActiveFriend || null;
        };

        async function generateAndSendChatImage(prompt, targetFriend, referenceImage = '', promptConfig = {}) {
            const friendId = targetFriend?.id;
            const runKey = String(friendId ?? '');
            if (!runKey) {
                window.showToast?.('当前聊天状态已失效，请重新进入聊天');
                return false;
            }
            if (window.imChat.isChatImageGenerationRunning?.(runKey)) {
                window.showToast?.('这段聊天已有图片正在生成');
                return false;
            }
            window.showToast?.('正在生成图片…');
            try {
                const result = await window.imChat.generateChatImage(prompt, targetFriend, {
                    referenceImage,
                    charAppearance: promptConfig.charAppearance || '',
                    userAppearance: promptConfig.userAppearance || '',
                    artistPrompt: promptConfig.artistPrompt || '',
                    negativePrompt: promptConfig.negativePrompt || ''
                });
                const sent = await window.imChat.sendImageMessage(result.imageUrl, prompt, {
                    role: 'assistant',
                    imageSource: 'generated',
                    imageProvider: result.provider,
                    imageModel: result.model,
                    imageSize: result.size,
                    faceReferenceUsed: result.faceReferenceUsed,
                    imageGenerationPrompt: prompt,
                    imageGenerationConfig: {
                        charAppearance: promptConfig.charAppearance || '',
                        userAppearance: promptConfig.userAppearance || '',
                        artistPrompt: promptConfig.artistPrompt || '',
                        negativePrompt: promptConfig.negativePrompt || '',
                        useReferenceFace: !!referenceImage
                    },
                    senderName: targetFriend.nickname || targetFriend.realName || 'Char',
                    senderAvatarUrl: targetFriend.avatarUrl || '',
                    senderAvatarAssetId: targetFriend.avatarAssetId || '',
                    friendId
                });
                if (sent) window.showToast?.('图片已生成并发送');
                return sent;
            } catch (error) {
                console.error('Failed to generate chat image', error);
                window.showToast?.(error?.message || '图片生成失败，请稍后重试');
                return false;
            }
        }

        const albumImageEntry = attachmentSheet.querySelector('.album-image-entry');
        albumImageEntry?.addEventListener('click', () => {
            const targetFriend = getAttachmentTargetFriend();
            closeSheet();
            if (!targetFriend) {
                if (window.showToast) window.showToast('当前聊天状态已失效，请重新进入聊天');
                return;
            }

            const showModal = window.imApp?.showCustomModal || window.showCustomModal;
            if (showModal) {
                showModal({
                    type: 'prompt',
                    title: '相册图片',
                    message: '上传图片后可手动描述，或使用识图生成内容',
                    placeholder: '填写图片内容（供 AI 理解）',
                    multiline: true,
                    confirmText: '发送',
                    imageComposer: {
                        imageUrl: '',
                        fileName: '',
                        onUpload: async (file) => {
                            if (!/^image\//i.test(file?.type || '')) throw new Error('请选择图片文件');
                            const imageUrl = window.imApp?.compressImageFile
                                ? await window.imApp.compressImageFile(file, {
                                    maxWidth: 1600,
                                    maxHeight: 1600,
                                    mimeType: 'image/jpeg',
                                    quality: 0.82
                                })
                                : await window.imApp?.readFileAsDataUrl?.(file);
                            if (!imageUrl) throw new Error('图片处理失败');
                            return { imageUrl, fileName: file.name };
                        },
                        onRecognize: (imageUrl) => identifyChatImage(imageUrl)
                    },
                    onConfirm: (desc, modalState = {}) => {
                        const description = String(desc || '').trim();
                        if (!description) {
                            window.showToast?.('请填写图片内容或使用识图生成');
                            return false;
                        }
                        const imageUrl = modalState.uploadedImage || getChatImagePlaceholderUrl();
                        window.imChat.sendImageMessage(
                            imageUrl,
                            description,
                            {
                                imageSource: modalState.uploadedImage ? 'real' : 'virtual',
                                fileName: modalState.uploadedFileName || '',
                                friendId: targetFriend.id
                            }
                        );
                        return true;
                    }
                });
            }
        });

        const generatedImageEntry = attachmentSheet.querySelector('.generated-image-entry');
        generatedImageEntry?.addEventListener('click', async () => {
            const targetFriend = getAttachmentTargetFriend();
            closeSheet();
            if (!targetFriend) {
                window.showToast?.('当前聊天状态已失效，请重新进入聊天');
                return;
            }
            if (targetFriend.type === 'group') {
                window.showToast?.('请进入对应 Char 的单聊生成图片');
                return;
            }
            const runKey = String(targetFriend.id ?? '');
            if (window.imChat.isChatImageGenerationRunning?.(runKey)) {
                window.showToast?.('这段聊天已有图片正在生成');
                return;
            }
            const showModal = window.imApp?.showCustomModal || window.showCustomModal;
            if (!showModal) {
                window.showToast?.('无法打开生图提示词窗口');
                return;
            }
            const latestTargetFriend = window.imApp?.getFriendById?.(targetFriend.id) || targetFriend;
            const faceAssetId = latestTargetFriend.imageFaceReferenceAssetId || '';
            let faceReferenceUrl = '';
            if (latestTargetFriend.imageFaceReferenceUrl) {
                faceReferenceUrl = latestTargetFriend.imageFaceReferenceUrl;
            } else if (faceAssetId && typeof window.appStorage?.getAssetUrl === 'function') {
                faceReferenceUrl = await window.appStorage.getAssetUrl(faceAssetId).catch(() => '');
            }
            const supportsCharacterReference = latestTargetFriend.type !== 'group';
            const savedPromptConfig = latestTargetFriend.imagePromptConfig || {};
            const buildPromptConfig = (modalState = {}, previous = savedPromptConfig) => ({
                ...(previous && typeof previous === 'object' ? previous : {}),
                charAppearance: String(modalState.charAppearance || '').trim(),
                userAppearance: String(modalState.userAppearance || '').trim(),
                artistPrompt: String(modalState.artistPrompt || '').trim(),
                negativePrompt: String(modalState.negativePrompt || '').trim(),
                lastPrompt: String(modalState.promptValue || '').trim(),
                activePresetId: String(modalState.activePresetId || '').trim(),
                autoGenerate: modalState.autoGenerate === true,
                autoUseReferenceFace: modalState.autoUseReferenceFace === true,
                presets: Array.isArray(modalState.presets)
                    ? modalState.presets
                    : (Array.isArray(previous?.presets) ? previous.presets : [])
            });
            showModal({
                type: 'prompt',
                title: '生成图片',
                message: '将自动根据当前聊天上下文生成画面',
                placeholder: '可补充主体、场景、风格等要求（选填）',
                defaultValue: savedPromptConfig.lastPrompt || '',
                multiline: true,
                confirmText: '开始生成',
                confirmTone: 'dark',
                generationPrompt: {
                    charAppearance: savedPromptConfig.charAppearance || '',
                    userAppearance: savedPromptConfig.userAppearance || '',
                    artistPrompt: savedPromptConfig.artistPrompt || '',
                    negativePrompt: savedPromptConfig.negativePrompt || '',
                    presets: Array.isArray(savedPromptConfig.presets) ? savedPromptConfig.presets : [],
                    activePresetId: savedPromptConfig.activePresetId || '',
                    autoGenerate: savedPromptConfig.autoGenerate === true,
                    autoUseReferenceFace: savedPromptConfig.autoUseReferenceFace === true
                },
                referenceFace: supportsCharacterReference ? {
                    title: `${latestTargetFriend.nickname || latestTargetFriend.realName || '当前角色'}的参考脸`,
                    imageUrl: faceReferenceUrl,
                    fileName: latestTargetFriend.imageFaceReferenceFileName || '',
                    onUpload: async (file) => {
                        if (!/^image\//i.test(file?.type || '')) throw new Error('请选择图片文件');
                        if (!window.imApp?.compressImageFile || !window.appStorage?.saveAssetFromDataUrl) {
                            throw new Error('图片存储服务不可用');
                        }
                        const dataUrl = await window.imApp.compressImageFile(file, {
                            maxWidth: 1536,
                            maxHeight: 1536,
                            quality: 0.9,
                            mimeType: 'image/jpeg'
                        });
                        const assetId = `im-face-reference-${targetFriend.id}-${Date.now()}`;
                        const previousAssetId = (window.imApp?.getFriendById?.(targetFriend.id) || targetFriend)
                            .imageFaceReferenceAssetId || '';
                        await window.appStorage.saveAssetFromDataUrl(assetId, dataUrl, {
                            ownerType: 'im_friend_face_reference',
                            ownerId: String(targetFriend.id),
                            fileName: file.name
                        });
                        const assetUrl = await window.appStorage.getAssetUrl(assetId);
                        const saved = await commitSheetFriendChange(targetFriend, (friend) => {
                            friend.imageFaceReferenceAssetId = assetId;
                            friend.imageFaceReferenceUrl = null;
                            friend.imageFaceReferenceFileName = file.name;
                        }, { metaOnly: true });
                        if (!saved) {
                            await window.appStorage.deleteAsset(assetId).catch(() => undefined);
                            throw new Error('参考脸保存失败，请重试');
                        }
                        if (previousAssetId && previousAssetId !== assetId) {
                            await window.appStorage.deleteAsset(previousAssetId).catch(() => undefined);
                        }
                        window.showToast?.('已保存当前角色的参考脸');
                        return { imageUrl: assetUrl, fileName: file.name };
                    },
                    onDelete: async () => {
                        const previousAssetId = (window.imApp?.getFriendById?.(targetFriend.id) || targetFriend)
                            .imageFaceReferenceAssetId || '';
                        const saved = await commitSheetFriendChange(targetFriend, (friend) => {
                            friend.imageFaceReferenceAssetId = null;
                            friend.imageFaceReferenceUrl = null;
                            friend.imageFaceReferenceFileName = '';
                            friend.imagePromptConfig = {
                                ...(friend.imagePromptConfig || {}),
                                autoUseReferenceFace: false
                            };
                        }, { metaOnly: true });
                        if (!saved) throw new Error('参考脸删除失败，请重试');
                        if (previousAssetId) {
                            await window.appStorage?.deleteAsset?.(previousAssetId).catch(() => undefined);
                        }
                        window.showToast?.('已删除当前角色的参考脸');
                    }
                } : null,
                onCancel: (modalState = {}) => {
                    const promptConfig = buildPromptConfig(modalState);
                    commitSheetFriendChange(targetFriend, (friend) => {
                        friend.imagePromptConfig = promptConfig;
                    }, { metaOnly: true, silent: true });
                },
                onConfirm: (value, modalState = {}) => {
                    const supplement = String(value || '').trim();
                    const promptConfig = buildPromptConfig({ ...modalState, promptValue: supplement });
                    (async () => {
                        try {
                            const saved = await commitSheetFriendChange(targetFriend, (friend) => {
                                friend.imagePromptConfig = promptConfig;
                            }, { metaOnly: true });
                            if (!saved) {
                                window.showToast?.('生图提示词保存失败，请重试');
                                return;
                            }
                            window.showToast?.('正在根据聊天上下文整理画面…');
                            const contextPrompt = await generateImagePromptFromChatContext(latestTargetFriend);
                            const finalPrompt = [
                                contextPrompt,
                                supplement ? `用户补充画面要求：\n${supplement}` : ''
                            ].filter(Boolean).join('\n\n');
                            await generateAndSendChatImage(
                                finalPrompt,
                                targetFriend,
                                modalState.toggleChecked ? modalState.referenceImage : '',
                                promptConfig
                            );
                        } catch (error) {
                            console.error('Failed to prepare contextual chat image prompt', error);
                            window.showToast?.(error?.message || '根据聊天上下文生成画面失败');
                        }
                    })();
                    return true;
                },
                onSavePreset: async ({ presets, activePresetId, preset }) => {
                    const promptConfig = {
                        ...savedPromptConfig,
                        charAppearance: preset.charAppearance,
                        userAppearance: preset.userAppearance,
                        artistPrompt: preset.artistPrompt,
                        negativePrompt: preset.negativePrompt,
                        lastPrompt: preset.prompt,
                        presets,
                        activePresetId
                    };
                    const saved = await commitSheetFriendChange(targetFriend, (friend) => {
                        friend.imagePromptConfig = promptConfig;
                    }, { metaOnly: true, silent: true });
                    if (!saved) throw new Error('提示词预设保存失败，请重试');
                }
            });
        });

        window.imChat.renderLinkedAccountsPanel = renderLinkedAccountsPanel;
        window.imChat.stopLinkedAccountTimer = stopLinkedAccountTimer;

        return attachmentSheet;
    }

async function sendImageMessage(imgUrl, description, options = {}) {
        const friendId = options.friendId ?? window.imData.currentActiveFriend?.id;
        const friend = friendId != null
            ? (
                window.imApp?.getFriendById?.(friendId)
                || (window.imData.friends || []).find(
                    item => String(item.id) === String(friendId)
                )
            )
            : null;
        if (!friend) {
            if (window.showToast) window.showToast('未找到当前聊天对象，图片发送失败');
            return false;
        }
        const pageId = `chat-interface-${friend.id}`;
        const page = document.getElementById(pageId);
        if (!page) {
            if (window.showToast) window.showToast('聊天页面已关闭，图片发送失败');
            return false;
        }
        const container = page.querySelector('.ins-chat-messages');

        const now = Date.now();
        const msgObj = {
            id: window.imChat.createMessageId('img'),
            role: options.role === 'assistant' ? 'assistant' : 'user',
            type: 'image',
            content: imgUrl,
            text: description,
            description,
            imageSource: options.imageSource || 'unknown',
            imageProvider: options.imageProvider || '',
            imageModel: options.imageModel || '',
            imageSize: options.imageSize || '',
            faceReferenceUsed: !!options.faceReferenceUsed,
            imageGenerationPrompt: options.imageGenerationPrompt || '',
            imageGenerationConfig: options.imageGenerationConfig || null,
            fileName: options.fileName || '',
            senderName: options.senderName || '',
            senderAvatarUrl: options.senderAvatarUrl || '',
            senderAvatarAssetId: options.senderAvatarAssetId || '',
            timestamp: now
        };

        window.imApp.captureGroupUserIdentity?.(friend, msgObj);

        const saved = window.imApp.appendFriendMessage
            ? await window.imApp.appendFriendMessage(friend.id, msgObj, { silent: true })
            : await commitSheetFriendChange(friend, (targetFriend) => {
                if (!targetFriend.messages) targetFriend.messages = [];
                targetFriend.messages.push(msgObj);
            }, { silent: true });

        if (!saved) {
            if (window.showToast) window.showToast('图片消息保存失败');
            return false;
        }

        if (container) {
            const appended = window.imChat.appendMessageToContainer
                ? window.imChat.appendMessageToContainer(friend, container, msgObj, { scroll: true })
                : false;
            if (!appended && window.imChat.rerenderChatContainer) {
                window.imChat.rerenderChatContainer(friend, container, { scroll: true });
            }
        }
        return true;
    }

async function sendStickerMessage(sticker) {
        if (!window.imData.currentActiveFriend) return;
        const friend = window.imData.currentActiveFriend;
        const pageId = `chat-interface-${friend.id}`;
        const page = document.getElementById(pageId);
        if (!page) return;
        const container = page.querySelector('.ins-chat-messages');
        const safeSticker = sticker || {};
        const stickerUrl = String(safeSticker.url || safeSticker.stickerUrl || '').trim();
        const stickerName = String(safeSticker.name || safeSticker.stickerName || 'Sticker').trim() || 'Sticker';
        const stickerCategory = String(safeSticker.category || safeSticker.stickerCategory || '').trim();
        if (!stickerUrl) return;

        const now = Date.now();
        const readable = stickerCategory
            ? `用户发了一个表情包：${stickerCategory} / ${stickerName}`
            : `用户发了一个表情包：${stickerName}`;
        const msgObj = {
            id: window.imChat.createMessageId('sticker'),
            role: 'user',
            type: 'sticker',
            content: '[表情包]',
            text: readable,
            stickerCategory,
            stickerName,
            stickerUrl,
            timestamp: now
        };

        window.imApp.captureGroupUserIdentity?.(friend, msgObj);

        const saved = window.imApp.appendFriendMessage
            ? await window.imApp.appendFriendMessage(friend.id, msgObj, { silent: true })
            : await commitSheetFriendChange(friend, (targetFriend) => {
                if (!targetFriend.messages) targetFriend.messages = [];
                targetFriend.messages.push(msgObj);
            }, { silent: true });

        if (!saved) {
            if (window.showToast) window.showToast('表情包消息保存失败');
            return;
        }

        if (container) {
            const appended = window.imChat.appendMessageToContainer
                ? window.imChat.appendMessageToContainer(friend, container, msgObj, { scroll: true })
                : false;
            if (!appended && window.imChat.rerenderChatContainer) {
                window.imChat.rerenderChatContainer(friend, container, { scroll: true });
            }
        }
    }

async function sendVoiceMessage(transcript) {
        if (!window.imData.currentActiveFriend) return;
        const friend = window.imData.currentActiveFriend;
        const pageId = `chat-interface-${friend.id}`;
        const page = document.getElementById(pageId);
        if (!page) return;
        const container = page.querySelector('.ins-chat-messages');
        const safeTranscript = String(transcript || '').trim();
        if (!safeTranscript) return;

        const now = Date.now();
        const duration = Math.min(18, Math.max(3, Math.ceil(safeTranscript.length / 3)));
        const msgObj = {
            id: window.imChat.createMessageId('voice'),
            role: 'user',
            type: 'voice_message',
            content: '[语音消息]',
            text: safeTranscript,
            transcript: safeTranscript,
            duration,
            timestamp: now
        };

        window.imApp.captureGroupUserIdentity?.(friend, msgObj);

        const saved = window.imApp.appendFriendMessage
            ? await window.imApp.appendFriendMessage(friend.id, msgObj, { silent: true })
            : await commitSheetFriendChange(friend, (targetFriend) => {
                if (!targetFriend.messages) targetFriend.messages = [];
                targetFriend.messages.push(msgObj);
            }, { silent: true });

        if (!saved) {
            if (window.showToast) window.showToast('语音消息保存失败');
            return;
        }

        if (container) {
            const appended = window.imChat.appendMessageToContainer
                ? window.imChat.appendMessageToContainer(friend, container, msgObj, { scroll: true })
                : false;
            if (!appended && window.imChat.rerenderChatContainer) {
                window.imChat.rerenderChatContainer(friend, container, { scroll: true });
            }
        }
    }

function openAttachmentSheet() {
        const activeFriend = window.imData.currentActiveFriend;
        if (!activeFriend) return;
        const pageId = `chat-interface-${activeFriend.id}`;
        const page = document.getElementById(pageId);
        if (!page) return;

        // Reset the sheet instance entirely just in case DOM was manipulated or destroyed
        const sheet = window.imChat.createAttachmentSheet(page);
        sheet.dataset.friendId = String(activeFriend.id);
        const inputContainer = page.querySelector('.ins-chat-input-container');
        sheet.style.display = 'flex';
        // force reflow
        sheet.offsetHeight;
        const overlay = sheet.querySelector('.sheet-overlay');
        const content = sheet.querySelector('.sheet-content');
        if (window.imChat.syncOfflineMeetEntry) window.imChat.syncOfflineMeetEntry();
        const activeTab = sheet.querySelector('.sheet-tab-item.active');
        if (activeTab && activeTab.getAttribute('data-tab') === 'file' && typeof window.imChat.renderLinkedAccountsPanel === 'function') {
            window.imChat.renderLinkedAccountsPanel();
        } else if (typeof window.imChat.stopLinkedAccountTimer === 'function') {
            window.imChat.stopLinkedAccountTimer();
        }
        if (overlay) overlay.style.opacity = '1';
        if (content) content.style.transform = 'translateY(0)';
    }

    // --- Banner Notification logic moved to global ui.js ---
    
    // We wrap the global functions so existing imChat references still work
    function showBannerNotification(friend, messageText) {
        if (!window.imApp?.isChatConversationOpen?.() && window.showBannerNotification) {
            window.showBannerNotification(friend, messageText);
        }
    }

    function hideBannerNotification(clearQueue = false) {
        if (window.hideBannerNotification) {
            window.hideBannerNotification(clearQueue);
        }
    }

    window.imChat.createAttachmentSheet = createAttachmentSheet;
    window.imChat.syncOfflineMeetEntry = function() {
        const sheet = window.imData.attachmentSheet;
        if (!sheet) return;
        const entry = sheet.querySelector('.attachment-more-offline-entry');
        const label = sheet.querySelector('.attachment-more-offline-label');
        const dynamicEntry = sheet.querySelector('.attachment-more-dynamic-action-entry');
        const dynamicLabel = sheet.querySelector('.attachment-more-dynamic-action-label');
        const listenEntry = sheet.querySelector('.attachment-more-listen-entry');
        const listenLabel = sheet.querySelector('.attachment-more-listen-label');
        const activeFriend = window.imData.currentActiveFriend;
        const isOffline = !!window.imData.currentActiveFriend?.offlineMeetEnabled;
        const isDynamicActionEnabled = !!window.imData.currentActiveFriend?.dynamicActionNarrationEnabled;
        const canListenTogether = activeFriend?.type === 'char';
        const isListeningTogether = canListenTogether && !!window.libraryApp?.getTogetherListeningSnapshot?.(activeFriend.id);
        if (label) label.textContent = isOffline ? '退出线下' : '线下';
        if (entry) entry.classList.toggle('active', isOffline);
        if (dynamicLabel) dynamicLabel.textContent = isDynamicActionEnabled ? '关闭' : '动描';
        if (dynamicEntry) dynamicEntry.classList.toggle('active', isDynamicActionEnabled);
        if (listenEntry) {
            listenEntry.style.display = canListenTogether ? 'flex' : 'none';
            listenEntry.classList.toggle('active', isListeningTogether);
        }
        if (listenLabel) listenLabel.textContent = isListeningTogether ? '退出一起听' : '一起听';
    };
    window.imChat.identifyChatImage = identifyChatImage;
    window.imChat.sendImageMessage = sendImageMessage;
    window.imChat.sendStickerMessage = sendStickerMessage;
    window.imChat.sendVoiceMessage = sendVoiceMessage;
    window.imChat.openAttachmentSheet = openAttachmentSheet;
    window.imChat.showBannerNotification = showBannerNotification;
    window.imChat.hideBannerNotification = hideBannerNotification;

});
