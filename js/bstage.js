(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    // DOM Elements
    const bstageView = document.createElement('div');
    bstageView.className = 'app-view bstage-view';
    bstageView.id = 'bstage-view';
    
    // Inject HTML Structure
    bstageView.innerHTML = `
        <!-- Header -->
        <div class="bstage-header">
            <div class="bstage-logo" id="bstage-back-btn">b.stage</div>
            <div class="bstage-header-right">
                <i class="fas fa-search bstage-icon-btn" id="bstage-search-generate-btn"></i>
                <i class="fas fa-cog bstage-icon-btn" id="bstage-global-settings-btn"></i>
                <div class="bstage-avatar-placeholder" id="bstage-header-profile-container"><i class="fas fa-user"></i></div>
            </div>
        </div>

        <!-- Following Bar -->
        <div class="bstage-following-bar" id="bstage-following-bar">
            <!-- Add Button -->
            <div class="bstage-team-item" id="bstage-create-team-btn">
                <div class="bstage-create-btn">
                    <i class="fas fa-plus"></i>
                </div>
                <div class="bstage-team-name">Create</div>
            </div>
            <!-- Teams will be injected here -->
        </div>

        <!-- Content Area -->
        <div class="bstage-content-area" id="bstage-content-area">
            <!-- Default Empty State or Team View -->
            <div style="height: 100%; display: flex; justify-content: center; align-items: center; color: #333; font-size: 14px;">
                请选择或创建一个团队
            </div>
        </div>

        <!-- Floating Bottom Nav (Hidden by default) -->
        <div class="bstage-bottom-nav-container" id="bstage-bottom-nav" style="display: none;">
            <div class="bstage-bottom-nav">
                <div class="bstage-nav-indicator"></div>
                <div class="bstage-nav-item active" data-tab="home">Home</div>
                <div class="bstage-nav-item" data-tab="content">Content</div>
                <div class="bstage-nav-item" data-tab="shop">Shop</div>
                <div class="bstage-nav-item" data-tab="pop">Pop</div>
            </div>
        </div>
    `;

    document.getElementById('app').appendChild(bstageView);

    // Chat View
    const bstageChatView = document.createElement('div');
    bstageChatView.className = 'app-view bstage-chat-view';
    bstageChatView.id = 'bstage-chat-view';
    bstageChatView.style.backgroundColor = '#1c1c1e';
    bstageChatView.innerHTML = `
        <div class="bstage-header chat-header" style="background-color: transparent;">
            <div class="bstage-icon-btn" id="bstage-chat-back-btn"><i class="fas fa-chevron-left"></i></div>
            <div class="bstage-chat-header-info">
                <div class="bstage-chat-name" id="bstage-chat-name">Name</div>
                <div class="bstage-chat-days" id="bstage-chat-days">已一同 1 天</div>
            </div>
            <div class="bstage-icon-btn" id="bstage-chat-menu-btn"><i class="fas fa-bars"></i></div>
        </div>
        <div class="bstage-chat-content" id="bstage-chat-content">
            <!-- Messages go here -->
        </div>
        <div class="bstage-chat-input-area">
            <div class="bstage-reply-preview" id="bstage-chat-reply-preview" style="display:none;">
                <div class="bstage-reply-preview-content">
                    <div class="bstage-reply-preview-label">正在回复</div>
                    <div class="bstage-reply-preview-text" id="bstage-chat-reply-preview-text"></div>
                </div>
                <div class="bstage-reply-preview-close" id="bstage-chat-reply-cancel-btn" role="button" tabindex="0" aria-label="取消回复" title="取消回复">
                    <i class="fas fa-times"></i>
                </div>
            </div>
            <div class="bstage-chat-input-wrapper">
                <input type="text" id="bstage-chat-input" inputmode="text" enterkeyhint="send" autocomplete="off" autocapitalize="sentences" placeholder="Send a message..." style="color: #fff; background-color: transparent; border: none; outline: none;">
                <div id="bstage-chat-send-btn" class="bstage-chat-action-btn bstage-chat-send-btn" role="button" tabindex="0" aria-label="发送消息" title="发送消息">
                    <i class="fas fa-paper-plane"></i>
                </div>
                <div id="bstage-chat-api-btn" class="bstage-chat-action-btn bstage-chat-api-btn" role="button" tabindex="0" aria-label="调用 API" title="调用 API">
                    <i class="fas fa-arrow-down"></i>
                </div>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(bstageChatView);

    // Fan Chat View
    const bstageFanChatView = document.createElement('div');
    bstageFanChatView.className = 'app-view bstage-chat-view bstage-fan-chat-view';
    bstageFanChatView.id = 'bstage-fan-chat-view';
    bstageFanChatView.style.backgroundColor = '#1c1c1e';
    bstageFanChatView.innerHTML = `
        <div class="bstage-header chat-header" style="background-color: transparent;">
            <div class="bstage-icon-btn" id="bstage-fan-chat-back-btn"><i class="fas fa-chevron-left"></i></div>
            <div class="bstage-chat-header-info">
                <div class="bstage-chat-name" id="bstage-fan-chat-name">Fan Chatroom</div>
                <div class="bstage-chat-days" id="bstage-fan-chat-subtitle"> 0 Subscribers</div>
            </div>
            <div class="bstage-icon-btn" id="bstage-fan-chat-menu-btn"><i class="fas fa-bars"></i></div>
        </div>
        <div class="bstage-chat-content" id="bstage-fan-chat-content">
            <!-- Fan messages go here -->
        </div>
        <div class="bstage-chat-input-area">
            <div class="bstage-reply-preview" id="bstage-fan-chat-reply-preview" style="display:none;">
                <div class="bstage-reply-preview-content">
                    <div class="bstage-reply-preview-label">正在回复</div>
                    <div class="bstage-reply-preview-text" id="bstage-fan-chat-reply-preview-text"></div>
                </div>
                <div class="bstage-reply-preview-close" id="bstage-fan-chat-reply-cancel-btn" role="button" tabindex="0" aria-label="取消回复" title="取消回复">
                    <i class="fas fa-times"></i>
                </div>
            </div>
            <div class="bstage-chat-input-wrapper">
                <input type="text" id="bstage-fan-chat-input" inputmode="text" enterkeyhint="send" autocomplete="off" autocapitalize="sentences" placeholder="Say something..." style="color: #fff; background-color: transparent; border: none; outline: none;">
                <div id="bstage-fan-chat-send-btn" class="bstage-chat-action-btn bstage-chat-send-btn" role="button" tabindex="0" aria-label="发送消息" title="发送消息">
                    <i class="fas fa-paper-plane"></i>
                </div>
                <div id="bstage-fan-chat-api-btn" class="bstage-chat-action-btn bstage-chat-api-btn" role="button" tabindex="0" aria-label="调用 API" title="调用 API">
                    <i class="fas fa-arrow-down"></i>
                </div>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(bstageFanChatView);

    // Other Fans Center Modal for char chats
    const bstageOtherFansModal = document.createElement('div');
    bstageOtherFansModal.className = 'bstage-center-modal-overlay';
    bstageOtherFansModal.id = 'bstage-other-fans-modal';
    bstageOtherFansModal.innerHTML = `
        <section class="bstage-center-modal-card" role="dialog" aria-modal="true" aria-labelledby="bstage-other-fans-title">
            <div class="bstage-center-modal-heading">
                <div>
                    <small>OTHER FANS</small>
                    <h2 id="bstage-other-fans-title">其他人的消息</h2>
                </div>
                <button type="button" class="bstage-center-modal-close" id="bstage-other-fans-close-btn" aria-label="关闭">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="bstage-other-fans-list" id="bstage-other-fans-list"></div>
        </section>
    `;
    document.getElementById('app').appendChild(bstageOtherFansModal);
    bstageOtherFansModal.addEventListener('click', (event) => {
        if (event.target === bstageOtherFansModal) closeOtherFansModal();
    });
    const otherFansCloseBtn = bstageOtherFansModal.querySelector('#bstage-other-fans-close-btn');
    if (otherFansCloseBtn) otherFansCloseBtn.addEventListener('click', closeOtherFansModal);

    // Global Settings Modal
    const globalSettingsModal = document.createElement('div');
    globalSettingsModal.className = 'bottom-sheet-overlay detail-sheet-overlay';
    globalSettingsModal.id = 'bstage-global-settings-modal';
    globalSettingsModal.style.zIndex = '2000';
    globalSettingsModal.innerHTML = `
        <div class="bottom-sheet" style="height: 90%; background: #1c1c1e; color: #fff;">
            <div class="sheet-handle" style="background-color: #444;"></div>
            <div class="sheet-title" style="color: #fff;">CSS PRESET</div>
            <div class="detail-sheet-content" style="padding-bottom: 20px;">
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <button class="bstage-preset-tab active" data-type="chatCss" style="flex: 1; padding: 8px; background: #fff; color: #000; border-radius: 8px; border: none; font-weight: bold;">聊天界面</button>
                    <button class="bstage-preset-tab" data-type="avatarFrameCss" style="flex: 1; padding: 8px; background: #2c2c2e; color: #fff; border-radius: 8px; border: none; font-weight: bold;">头像框</button>
                    <button class="bstage-preset-tab" data-type="bubbleCss" style="flex: 1; padding: 8px; background: #2c2c2e; color: #fff; border-radius: 8px; border: none; font-weight: bold;">气泡</button>
                </div>
                
                <div id="bstage-preset-list" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px; max-height: 200px; overflow-y: auto;">
                    <!-- 预设列表将在这里渲染 -->
                </div>
                
                <div class="bstage-form-group" style="background-color: #2c2c2e; border-color: #333;">
                    <div class="bstage-form-item" style="border-bottom-color: #444;">
                        <input type="text" id="bstage-preset-name-input" placeholder="预设名称" style="color: #fff; background-color: transparent; border: none; outline: none; width: 100%; padding: 8px 0;">
                    </div>
                    <div class="bstage-form-item">
                        <textarea id="bstage-preset-css-input" placeholder="输入 CSS 代码..." style="color: #fff; background-color: transparent; border: none; outline: none; width: 100%; padding: 8px 0; height: 100px;"></textarea>
                    </div>
                </div>
                <div class="sheet-action confirm-action" id="bstage-save-preset-btn" style="background-color: #007aff; color: #fff; margin-top: 15px;">save preset</div>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(globalSettingsModal);

    // Search Generate Modal
    const searchGenerateModal = document.createElement('div');
    searchGenerateModal.className = 'bottom-sheet-overlay detail-sheet-overlay';
    searchGenerateModal.id = 'bstage-search-generate-modal';
    searchGenerateModal.style.zIndex = '1200';
    searchGenerateModal.innerHTML = `
        <div class="bottom-sheet bstage-search-generate-sheet" style="background: #1c1c1e; color: #fff;">
            <div class="sheet-handle" style="background-color: #444;"></div>
            <div class="sheet-title" style="color: #fff;">SEARCH TEAMS</div>
            <div class="detail-sheet-content bstage-modal-content">
                <div class="bstage-search-generate-hint">输入想搜索的团队或明星，AI 会按内容生成团队资料和成员设定；留空则随机生成。</div>
                <div class="bstage-search-form">
                    <label class="bstage-search-label" for="bstage-search-query-input">搜索内容</label>
                    <input type="text" id="bstage-search-query-input" class="bstage-search-input" placeholder="例如：韩系男团、清冷女演员、摇滚乐队；留空随机">
                </div>
                <div class="bstage-search-form">
                    <label class="bstage-search-label" for="bstage-search-member-count">团队人数</label>
                    <input type="number" id="bstage-search-member-count" class="bstage-search-input" value="1" min="1" max="12" step="1" inputmode="numeric">
                </div>
                <div id="bstage-search-loading" class="bstage-search-loading" style="display:none;">
                    <i class="fas fa-spinner"></i>
                    <span>正在生成团队...</span>
                </div>
                <div class="sheet-action confirm-action bstage-search-confirm-btn" id="bstage-search-confirm-btn" style="background-color: #fff; color: #000;">Generate</div>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(searchGenerateModal);

    // Create Modals
    const createTeamSheet = document.createElement('div');
    createTeamSheet.className = 'bottom-sheet-overlay detail-sheet-overlay';
    createTeamSheet.id = 'bstage-create-sheet';
    createTeamSheet.style.zIndex = '200'; // Ensure lower than char sheet
    createTeamSheet.innerHTML = `
        <div class="bottom-sheet" style="height: 80%; background: #1c1c1e; color: #fff;">
            <div class="sheet-handle" style="background-color: #444;"></div>
            <div class="sheet-title" style="color: #fff;">CREATE TEAM</div>
            <div class="detail-sheet-content">
                <!-- Team Background -->
                <div class="sheet-title" style="margin-top: 0; margin-bottom: 10px; color: #aaa; font-size: 14px;">Background</div>
                <div class="bstage-bg-upload" id="bstage-team-bg-upload" style="background-color: #2c2c2e; border-color: #444; overflow: hidden; position: relative;">
                    <span style="color: #aaa; font-size: 14px; position: relative; z-index: 1;">点击上传背景图</span>
                    <img id="bstage-team-bg-preview" src="" style="width: 100%; height: 100%; object-fit: cover; display: none; position: absolute; top: 0; left: 0; z-index: 0;">
                    <input type="file" accept="image/*" style="display:none;">
                </div>

                <!-- Team Avatar -->
                <div class="bstage-avatar-upload" id="bstage-team-avatar-upload" style="background-color: #2c2c2e; margin-top: -60px; position: relative; z-index: 2; border: 4px solid #1c1c1e; overflow: hidden;">
                    <i class="fas fa-camera" style="color: #aaa; position: relative; z-index: 1;"></i>
                    <img id="bstage-team-avatar-preview" src="" style="width: 100%; height: 100%; object-fit: cover; display: none; position: absolute; top: 0; left: 0; z-index: 0;">
                    <input type="file" accept="image/*" style="display:none;">
                </div>

                <!-- Team Name & Info -->
                <div class="bstage-form-group" style="background-color: #2c2c2e; border-color: #333;">
                    <div class="bstage-form-item" style="border-bottom-color: #444;">
                        <label style="color: #aaa;">团队名</label>
                        <input type="text" id="bstage-team-name-input" placeholder="输入团队名称" style="color: #fff; background-color: transparent; border: none; outline: none; width: 100%; padding: 4px 0; margin-top: 4px;">
                    </div>
                    <div class="bstage-form-item">
                        <label style="color: #aaa;">团队信息</label>
                        <textarea id="bstage-team-desc-input" placeholder="输入团队简介..." style="color: #fff; background-color: transparent; border: none; outline: none; width: 100%; padding: 4px 0; margin-top: 4px; min-height: 60px;"></textarea>
                    </div>
                </div>

                <!-- Add Characters -->
                <div class="sheet-title" style="margin-top: 20px; margin-bottom: 10px; color: #fff;">添加成员</div>
                <div class="bstage-chars-list-preview" id="bstage-chars-preview-list">
                    <!-- Preview of added chars -->
                </div>
                <div style="display: flex; gap: 10px;">
                    <div class="bstage-add-char-btn" id="bstage-add-char-btn" style="flex: 1; background-color: #2c2c2e; color: #fff; padding: 10px; border-radius: 12px; font-size: 14px;">+ 手动添加</div>
                    <div class="bstage-add-char-btn" id="bstage-pull-friend-btn" style="flex: 1; background-color: #2c2c2e; color: #fff; padding: 10px; border-radius: 12px; font-size: 14px;">+ 拉取已有好友</div>
                </div>

                <div class="sheet-action confirm-action" id="bstage-confirm-create-btn" style="background-color: #fff; color: #000; margin-top: 30px;">creation</div>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(createTeamSheet);

    // Add Character Sub-Modal (Simulated by replacing content or overlay)
    // Needs higher z-index to show over create team sheet and edit team sheet
    const addCharSheet = document.createElement('div');
    addCharSheet.className = 'bottom-sheet-overlay detail-sheet-overlay';
    addCharSheet.id = 'bstage-add-char-sheet';
    addCharSheet.style.zIndex = '1500'; /* Higher than edit team sheet */
    addCharSheet.innerHTML = `
        <div class="bottom-sheet" style="background: #1c1c1e; color: #fff;">
            <div class="sheet-handle" style="background-color: #444;"></div>
            <div class="sheet-title" style="color: #fff;">添加成员</div>
            <div class="detail-sheet-content">
                <div class="bstage-avatar-upload" id="bstage-char-avatar-upload" style="background-color: #2c2c2e; overflow: hidden; position: relative;">
                    <i class="fas fa-user" style="color: #aaa; position: relative; z-index: 1;"></i>
                    <img id="bstage-char-avatar-preview" src="" style="width: 100%; height: 100%; object-fit: cover; display: none; position: absolute; top: 0; left: 0; z-index: 0;">
                    <input type="file" accept="image/*" style="display:none;">
                </div>
                <div class="bstage-form-group" style="background-color: #2c2c2e; border-color: #333;">
                    <div class="bstage-form-item" style="border-bottom-color: #444;">
                        <label style="color: #aaa;">名字</label>
                        <input type="text" id="bstage-char-name-input" placeholder="成员名字" style="color: #fff; background-color: transparent; border: none; outline: none; width: 100%; padding: 4px 0; margin-top: 4px;">
                    </div>
                    <div class="bstage-form-item">
                        <label style="color: #aaa;">人设</label>
                        <input type="text" id="bstage-char-role-input" placeholder="简单的描述" style="color: #fff; background-color: transparent; border: none; outline: none; width: 100%; padding: 4px 0; margin-top: 4px;">
                    </div>
                </div>
                <div class="sheet-action confirm-action" id="bstage-confirm-add-char-btn" style="background-color: #fff; color: #000;">添加</div>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(addCharSheet);

    // Pull Friend Sheet
    const pullFriendSheet = document.createElement('div');
    pullFriendSheet.className = 'bottom-sheet-overlay detail-sheet-overlay';
    pullFriendSheet.id = 'bstage-pull-friend-sheet';
    pullFriendSheet.style.zIndex = '1550';
    pullFriendSheet.innerHTML = `
        <div class="bottom-sheet" style="height: 70%; background: #1c1c1e; color: #fff;">
            <div class="sheet-handle" style="background-color: #444;"></div>
            <div class="sheet-title" style="color: #fff;">选择好友</div>
            <div class="detail-sheet-content" style="flex: 1; overflow-y: auto;">
                <div id="bstage-friend-list" style="display: flex; flex-direction: column; gap: 10px; padding-bottom: 20px;">
                    <!-- Friend items injected here -->
                </div>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(pullFriendSheet);

    // Subscription Modal
    const subModal = document.createElement('div');
    subModal.className = 'bottom-sheet-overlay detail-sheet-overlay';
    subModal.id = 'bstage-sub-modal';
    subModal.innerHTML = `
        <div class="bottom-sheet" style="background: #1c1c1e; color: #fff;">
            <div class="sheet-handle" style="background-color: #444;"></div>
            <div class="sheet-title" style="color: #fff;">MEMBERSHIP</div>
            <div class="detail-sheet-content bstage-modal-content">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 8px; color: #fff;">加入团队会员</h3>
                    <p style="color: #aaa; font-size: 13px;">享受独家内容与购物特权</p>
                </div>
                
                <div class="bstage-price-options">
                    <div class="bstage-price-option selected" data-type="year" style="border: 1px solid #fff; border-radius: 12px; margin-bottom: 10px; padding: 15px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background-color: #2c2c2e;">
                        <span class="bstage-price-title" style="color: #fff; font-weight: 600;">年卡会员</span>
                        <span class="bstage-price-amount" style="color: #fff; font-weight: 600;">₩89,000 / 年</span>
                    </div>
                    <div class="bstage-price-option" data-type="month" style="border: 1px solid transparent; border-radius: 12px; padding: 15px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background-color: #2c2c2e;">
                        <span class="bstage-price-title" style="color: #fff; font-weight: 600;">月卡会员</span>
                        <span class="bstage-price-amount" style="color: #fff; font-weight: 600;">₩8,900 / 月</span>
                    </div>
                </div>

                <div class="sheet-action confirm-action" id="bstage-confirm-sub-btn" style="background-color: #fff; color: #000; margin-top: 20px; border-radius: 25px;">立即订阅</div>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(subModal);

    // Pop Subscription Modal
    const popSubModal = document.createElement('div');
    popSubModal.className = 'bottom-sheet-overlay detail-sheet-overlay';
    popSubModal.id = 'bstage-pop-sub-modal';
    popSubModal.innerHTML = `
        <div class="bottom-sheet" style="background: #1c1c1e; color: #fff;">
            <div class="sheet-handle" style="background-color: #444;"></div>
            <div class="sheet-title" style="color: #fff;">POP SUBSCRIPTION</div>
            <div class="detail-sheet-content bstage-modal-content">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 8px; color: #fff;" id="pop-sub-char-name">Subscribe to Character</h3>
                    <p style="color: #aaa; font-size: 13px;">开启私密聊天之旅</p>
                </div>
                
                <div class="bstage-price-options">
                    <div class="bstage-price-option selected" style="border: 1px solid #fff; border-radius: 12px; padding: 15px; display: flex; justify-content: space-between; align-items: center; background-color: #2c2c2e;">
                        <span class="bstage-price-title" style="color: #fff; font-weight: 600;">月度订阅</span>
                        <span class="bstage-price-amount" style="color: #fff; font-weight: 600;">₩4,500 / 月</span>
                    </div>
                </div>

                <div class="sheet-action confirm-action" id="bstage-confirm-pop-sub-btn" style="background-color: #fff; color: #000; margin-top: 20px; border-radius: 25px;">确认支付</div>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(popSubModal);

    // User Profile Modal
    const userProfileModal = document.createElement('div');
    userProfileModal.className = 'bottom-sheet-overlay detail-sheet-overlay';
    userProfileModal.id = 'bstage-user-profile-modal';
    userProfileModal.innerHTML = `
        <div class="bottom-sheet" style="background: #1c1c1e; color: #fff;">
            <div class="sheet-handle" style="background-color: #444;"></div>
            <div class="detail-sheet-content bstage-modal-content" style="text-align: center;">
                <div style="width: 80px; height: 80px; border-radius: 50%; background-color: #2c2c2e; margin: 0 auto 15px; display: flex; justify-content: center; align-items: center; overflow: hidden; border: none;">
                    <img id="bstage-profile-avatar-display" src="" style="width: 100%; height: 100%; object-fit: cover; display: none;">
                    <i class="fas fa-user" id="bstage-profile-avatar-icon" style="font-size: 30px; color: #aaa;"></i>
                </div>
                <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 20px; color: #fff;" id="bstage-profile-name-display">User Name</h2>
                
                <div class="bstage-profile-stats-container">
                    <div class="bstage-profile-stat-bubble" style="background-color: #2c2c2e; color: #fff; border: none;">
                        <span class="bstage-stat-label" style="color: #aaa;">POP Plan</span>
                        <span class="bstage-stat-value" id="bstage-profile-pop-sub-count" style="color: #fff;">0</span>
                    </div>
                    <div class="bstage-profile-stat-bubble" style="background-color: #2c2c2e; color: #fff; border: none;">
                        <span class="bstage-stat-label" style="color: #aaa;">Plan Earnings</span>
                        <span class="bstage-stat-value" id="bstage-profile-sub-revenue" style="color: #fff;">￥0.00</span>
                    </div>
                </div>

                <div class="bstage-profile-actions">
                    <div class="bstage-profile-btn" id="bstage-edit-profile-btn" style="background-color: #2c2c2e; color: #fff; border: none;">
                        <i class="fas fa-pen"></i> Edit Profile
                    </div>
                    <div class="bstage-profile-btn" id="bstage-withdraw-revenue-btn" style="background-color: #2c2c2e; color: #fff; border: none;">
                        <i class="fas fa-wallet"></i> Withdraw to Pay
                    </div>
                    <div class="bstage-profile-btn" id="bstage-my-orders-btn" style="background-color: #2c2c2e; color: #fff; border: none;">
                        <i class="fas fa-receipt"></i> My Orders
                    </div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(userProfileModal);

    // Orders Modal
    const ordersModal = document.createElement('div');
    ordersModal.className = 'bottom-sheet-overlay detail-sheet-overlay';
    ordersModal.id = 'bstage-orders-modal';
    ordersModal.innerHTML = `
        <div class="bottom-sheet" style="height: 70%; background: #1c1c1e; color: #fff;">
            <div class="sheet-handle" style="background-color: #444;"></div>
            <div class="sheet-title" style="color: #fff;">My Orders</div>
            <div class="detail-sheet-content">
                <div id="bstage-orders-list" style="display: flex; flex-direction: column; gap: 10px; padding: 0 16px 20px;">
                    <!-- Orders Injected Here -->
                </div>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(ordersModal);

    // Edit Profile Modal
    const editProfileModal = document.createElement('div');
    editProfileModal.className = 'bottom-sheet-overlay detail-sheet-overlay';
    editProfileModal.id = 'bstage-edit-profile-modal';
    editProfileModal.innerHTML = `
        <div class="bottom-sheet" style="background: #1c1c1e; color: #fff;">
            <div class="sheet-handle" style="background-color: #444;"></div>
            <div class="sheet-title" style="color: #fff;">EDIT PROFILE</div>
            <div class="detail-sheet-content">
                <div class="bstage-avatar-upload" id="bstage-edit-profile-avatar-upload" style="background-color: #2c2c2e; overflow: hidden; position: relative;">
                    <i class="fas fa-camera" style="color: #aaa; position: relative; z-index: 1;"></i>
                    <img id="bstage-edit-profile-avatar-preview" src="" style="width: 100%; height: 100%; object-fit: cover; display: none; position: absolute; top: 0; left: 0; z-index: 0;">
                    <input type="file" accept="image/*" style="display:none;">
                </div>
                <div class="bstage-form-group" style="background-color: #2c2c2e; border-color: #333;">
                    <div class="bstage-form-item" style="border-bottom-color: #444;">
                        <label style="color: #aaa;">Nickname</label>
                        <input type="text" id="bstage-edit-profile-name" placeholder="输入昵称" style="color: #fff; background-color: transparent; border: none; outline: none; width: 100%; padding: 4px 0; margin-top: 4px;">
                    </div>
                    <div class="bstage-form-item">
                        <label style="color: #aaa;">Persona</label>
                        <input type="text" id="bstage-edit-profile-persona" placeholder="输入你的粉丝人设" style="color: #fff; background-color: transparent; border: none; outline: none; width: 100%; padding: 4px 0; margin-top: 4px;">
                    </div>
                </div>
                <div class="sheet-action confirm-action" id="bstage-save-profile-btn" style="background-color: #fff; color: #000;">save</div>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(editProfileModal);

    // Shared Generate Type Sheet
    const generateTypeSheet = document.createElement('div');
    generateTypeSheet.className = 'bottom-sheet-overlay detail-sheet-overlay';
    generateTypeSheet.id = 'bstage-generate-type-sheet';
    generateTypeSheet.style.zIndex = '2200';
    generateTypeSheet.innerHTML = `
        <div class="bottom-sheet" style="height: auto; max-height: 70%; background: #1c1c1e; color: #fff;">
            <div class="sheet-handle"></div>
            <div class="sheet-title" id="bstage-generate-type-title">生成内容</div>
            <div class="detail-sheet-content bstage-modal-content">
                <div class="bstage-form-group" style="background-color: #2c2c2e; border-color: #333;">
                    <div class="bstage-form-item">
                        <label id="bstage-generate-type-label" style="color: #aaa;">想看什么类型</label>
                        <input type="text" id="bstage-generate-type-input" placeholder="留空则随机生成" style="color: #fff; background-color: transparent; border: none; outline: none; width: 100%; padding: 4px 0; margin-top: 4px;">
                    </div>
                </div>
                <div class="sheet-action confirm-action" id="bstage-generate-type-confirm-btn" style="background-color: #fff; color: #000;">确认生成</div>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(generateTypeSheet);

    // Edit Team Sheet
    const editTeamSheet = document.createElement('div');
    editTeamSheet.className = 'bottom-sheet-overlay detail-sheet-overlay';
    editTeamSheet.id = 'bstage-edit-team-sheet';
    editTeamSheet.innerHTML = `
        <div class="bottom-sheet" style="height: 80%; background: #1c1c1e; color: #fff;">
            <div class="sheet-handle"></div>
            <div class="sheet-title">EDIT TEAM</div>
            <div class="detail-sheet-content">
                <!-- Team Avatar -->
                <div class="bstage-avatar-upload" id="bstage-edit-team-avatar-upload" style="background-color: #2c2c2e; overflow: hidden; position: relative;">
                    <i class="fas fa-camera" style="color: #aaa; position: relative; z-index: 1;"></i>
                    <img id="bstage-edit-team-avatar-preview" src="" style="width: 100%; height: 100%; object-fit: cover; display: none; position: absolute; top: 0; left: 0; z-index: 0;">
                    <input type="file" accept="image/*" style="display:none;">
                </div>

                <!-- Team Name -->
                <div class="bstage-form-group" style="background-color: #2c2c2e; border-color: #333;">
                    <div class="bstage-form-item" style="border-bottom-color: #444;">
                        <label style="color: #aaa;">团队名</label>
                        <input type="text" id="bstage-edit-team-name-input" placeholder="输入团队名称" style="color: #fff; background-color: transparent; border: none; outline: none; width: 100%; padding: 4px 0; margin-top: 4px;">
                    </div>
                </div>

                <!-- Team Background -->
                <div class="sheet-title" style="margin-top: 20px; margin-bottom: 10px;">Background</div>
                <div class="bstage-bg-upload" id="bstage-edit-team-bg-upload" style="background-color: #2c2c2e; border-color: #444; overflow: hidden; position: relative;">
                    <span style="color: #888; font-size: 14px; position: relative; z-index: 1;">点击上传背景图</span>
                    <img id="bstage-edit-team-bg-preview" src="" style="width: 100%; height: 100%; object-fit: cover; display: none; position: absolute; top: 0; left: 0; z-index: 0;">
                    <input type="file" accept="image/*" style="display:none;">
                </div>

                <!-- Manage Members -->
                <div class="sheet-title" style="margin-top: 20px; margin-bottom: 10px; color: #fff;">成员管理</div>
                <div class="bstage-chars-list-preview" id="bstage-edit-team-members-list">
                    <!-- Members Injected Here -->
                </div>
                <div style="display: flex; gap: 10px;">
                    <div class="bstage-add-char-btn" id="bstage-edit-team-add-member-btn" style="flex: 1; background-color: #2c2c2e; color: #fff; padding: 10px; border-radius: 12px; font-size: 14px;">+ 手动添加</div>
                    <div class="bstage-add-char-btn" id="bstage-edit-team-pull-friend-btn" style="flex: 1; background-color: #2c2c2e; color: #fff; padding: 10px; border-radius: 12px; font-size: 14px;">+ 拉取已有好友</div>
                </div>

                <div class="sheet-action confirm-action" id="bstage-confirm-edit-team-btn" style="background-color: #fff; color: #000; margin-top: 30px;">changes</div>
                <div class="sheet-action" id="bstage-delete-team-btn" style="background-color: #ff3b30; color: #fff; margin-top: 10px;">删除团队</div>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(editTeamSheet);

    // Edit Video Sheet
    const editVideoSheet = document.createElement('div');
    editVideoSheet.className = 'bottom-sheet-overlay detail-sheet-overlay';
    editVideoSheet.id = 'bstage-edit-video-sheet';
    editVideoSheet.style.zIndex = '1000'; // Significantly higher to ensure visibility over detail modal
    editVideoSheet.innerHTML = `
        <div class="bottom-sheet" style="height: 85%; background: #1c1c1e; color: #fff;">
            <div class="sheet-handle"></div>
            <div class="sheet-title">编辑视频信息</div>
            <div class="detail-sheet-content">
                <!-- Cover Upload -->
                <div class="sheet-title" style="margin-top: 0; margin-bottom: 10px; font-size: 14px;">封面</div>
                <div class="bstage-bg-upload" id="bstage-edit-video-cover-upload" style="height: 120px; overflow: hidden; position: relative;">
                    <span style="color: #888; font-size: 13px; position: relative; z-index: 1;">点击上传封面</span>
                    <img id="bstage-edit-video-cover-preview" src="" style="width: 100%; height: 100%; object-fit: cover; display: none; position: absolute; top: 0; left: 0; z-index: 0;">
                    <input type="file" accept="image/*" style="display:none;">
                </div>

                <!-- Info Form -->
                <div class="bstage-form-group" style="background-color: #2c2c2e; border-color: #333;">
                    <div class="bstage-form-item" style="border-bottom-color: #444;">
                        <label style="color: #aaa;">视频标题</label>
                        <input type="text" id="bstage-edit-video-title" placeholder="输入标题" style="color: #fff; background-color: transparent; border: none; outline: none; width: 100%; padding: 4px 0;">
                    </div>
                    <div class="bstage-form-item">
                        <label style="color: #aaa;">简介</label>
                        <textarea id="bstage-edit-video-desc" placeholder="输入视频简介..." style="height: 80px; color: #fff; background-color: transparent; border: none; outline: none; width: 100%; padding: 4px 0;"></textarea>
                    </div>
                </div>

                <div class="sheet-action confirm-action" id="bstage-confirm-edit-video-btn" style="background-color: #000; color: #fff; margin-top: 20px;">保存</div>
                <div class="sheet-action" id="bstage-delete-video-btn" style="background-color: #ff3b30; color: #fff; margin-top: 10px;">删除视频</div>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(editVideoSheet);

    // Chat Detail Sheet (P2)
    const chatDetailSheet = document.createElement('div');
    chatDetailSheet.className = 'bottom-sheet-overlay detail-sheet-overlay';
    chatDetailSheet.id = 'bstage-chat-detail-sheet';
    chatDetailSheet.style.zIndex = '1200'; // Ensure higher than chat view to fix menu click issue
    chatDetailSheet.innerHTML = `
        <style>
            #bstage-chat-detail-sheet .bstage-setting-item { background-color: #2c2c2e !important; color: #fff !important; border-bottom: none !important; }
            #bstage-chat-detail-sheet .bstage-setting-icon { color: #aaa !important; }
            #bstage-chat-detail-sheet .bstage-setting-label { color: #fff !important; }
            #bstage-chat-detail-sheet .bstage-settings-list { background-color: #1c1c1e; }
        </style>
        <div class="bottom-sheet" style="height: 90%; background: #1c1c1e; color: #fff;">
            <div class="sheet-handle" style="background-color: #444;"></div>
            <div class="detail-sheet-content bstage-modal-content" style="padding: 0;">
                <!-- Profile Section -->
                <div style="text-align: center; padding: 20px 0;">
                    <div id="bstage-detail-avatar-container" style="width: 80px; height: 80px; border-radius: 50%; background-color: #1c1c1e; margin: 0 auto 10px; overflow: hidden; border: 1px solid #333; display: flex; justify-content: center; align-items: center;">
                        <img id="bstage-detail-avatar" src="" style="width: 100%; height: 100%; object-fit: cover;">
                        <div id="bstage-detail-avatar-text" style="display:none; color:#fff; font-size:30px;"></div>
                    </div>
                    <h2 style="font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 5px;" id="bstage-detail-name">Name</h2>
                    <div style="font-size: 13px; color: #aaa; display: flex; align-items: center; justify-content: center; gap: 4px;">
                        <i class="fas fa-heart" style="color: #ff3b30;"></i>
                        <span id="bstage-detail-days">已一同 1 天</span>
                    </div>
                </div>

                <!-- Locker Section -->
                <div style="padding: 0 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span style="font-size: 14px; font-weight: 600; color: #aaa;">置物柜</span>
                        <span style="font-size: 14px; color: #fff; cursor: pointer;" id="bstage-locker-see-all-btn">看全部</span>
                    </div>
                    <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 10px; margin-bottom: 20px;" id="bstage-locker-preview-list">
                        <!-- Preview Photos -->
                    </div>
                </div>

                <!-- Settings List -->
                <div class="bstage-settings-list">
                    <div class="bstage-setting-item" id="bstage-setting-nickname">
                        <div class="bstage-setting-icon"><i class="fas fa-user"></i></div>
                        <div class="bstage-setting-label">昵称设置</div>
                    </div>
                    <div class="bstage-setting-item">
                        <div class="bstage-setting-icon"><i class="fas fa-image"></i></div>
                        <div class="bstage-setting-label" id="bstage-setting-bg" style="flex:1;">背景设定</div>
                        <div class="bstage-setting-right-action" id="bstage-reset-bg-btn" style="color: #aaa;">重置</div>
                        <input type="file" id="bstage-chat-bg-input" accept="image/*" style="display:none;">
                    </div>

                    <!-- CSS Presets Settings -->
                    <div class="bstage-setting-item">
                        <div class="bstage-setting-icon"><i class="fas fa-paint-brush"></i></div>
                        <div class="bstage-setting-label" style="flex:1;">界面 CSS</div>
                        <select id="bstage-chat-css-select" style="background: #2c2c2e; color: #fff; border: 1px solid #444; border-radius: 4px; padding: 4px; width: 120px; outline: none;">
                            <option value="">默认</option>
                        </select>
                    </div>
                    
                    <div class="bstage-setting-item">
                        <div class="bstage-setting-icon"><i class="fas fa-crop-alt"></i></div>
                        <div class="bstage-setting-label" style="flex:1;">头像框 CSS</div>
                        <select id="bstage-frame-css-select" style="background: #2c2c2e; color: #fff; border: 1px solid #444; border-radius: 4px; padding: 4px; width: 120px; outline: none;">
                            <option value="">默认</option>
                        </select>
                    </div>
                    
                    <div class="bstage-setting-item">
                        <div class="bstage-setting-icon"><i class="fas fa-comment-dots"></i></div>
                        <div class="bstage-setting-label" style="flex:1;">气泡 CSS</div>
                        <select id="bstage-bubble-css-select" style="background: #2c2c2e; color: #fff; border: 1px solid #444; border-radius: 4px; padding: 4px; width: 120px; outline: none;">
                            <option value="">默认</option>
                        </select>
                    </div>

                    <!-- Context Setting -->
                    <div class="bstage-setting-item">
                        <div class="bstage-setting-icon"><i class="fas fa-history"></i></div>
                        <div class="bstage-setting-label" style="flex: 1;">上下文携带</div>
                        <input type="number" id="bstage-context-count" value="50" style="width: 50px; background: transparent; border: 1px solid #444; color: #fff; text-align: center; border-radius: 4px; margin-right: 10px;">
                        <div class="bstage-switch active" id="bstage-context-switch">
                            <div class="bstage-switch-knob"></div>
                        </div>
                    </div>
                    
                    <!-- Translation Switch -->
                    <div class="bstage-setting-item">
                        <div class="bstage-setting-icon"><i class="fas fa-language"></i></div>
                        <div class="bstage-setting-label" style="flex: 1;">实时翻译</div>
                        <div class="bstage-switch" id="bstage-trans-switch">
                            <div class="bstage-switch-knob"></div>
                        </div>
                    </div>

                    <!-- Other Fans Messages Setting -->
                    <div class="bstage-setting-item">
                        <div class="bstage-setting-icon"><i class="fas fa-comments"></i></div>
                        <div class="bstage-setting-label" style="flex: 1;">查看其他人消息</div>
                        <div class="bstage-switch" id="bstage-other-fans-switch">
                            <div class="bstage-switch-knob"></div>
                        </div>
                    </div>

                    <!-- Auto Activity Setting -->
                    <div class="bstage-setting-item" style="flex-wrap: wrap; padding-top: 10px; padding-bottom: 10px;">
                        <div style="width: 100%; display: flex; align-items: center;">
                            <div class="bstage-setting-icon"><i class="fas fa-robot"></i></div>
                            <div class="bstage-setting-label" style="flex: 1;">自主活动</div>
                            <div class="bstage-switch" id="bstage-auto-activity-switch">
                                <div class="bstage-switch-knob"></div>
                            </div>
                        </div>
                        <div id="bstage-auto-activity-options" style="width: 100%; margin-top: 10px; display: none; background: #1c1c1e; padding: 10px; border-radius: 8px; border: 1px solid #333;">
                            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                                <span style="font-size: 13px; color: #aaa; width: 70px;">调用间隔</span>
                                <input type="number" id="bstage-auto-activity-interval" value="60" style="flex: 1; background: #2c2c2e; border: 1px solid #444; color: #fff; border-radius: 4px; padding: 4px 8px; outline: none;">
                                <span style="font-size: 13px; color: #aaa; margin-left: 8px;">秒</span>
                            </div>
                            <div style="display: flex; align-items: center;">
                                <span style="font-size: 13px; color: #aaa; width: 70px;">API预设</span>
                                <select id="bstage-auto-activity-preset" style="flex: 1; background: #2c2c2e; color: #fff; border: 1px solid #444; border-radius: 4px; padding: 4px; outline: none;">
                                    <option value="">默认全局API</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="bstage-setting-item" style="color: #ff3b30;" id="bstage-chat-exit-btn">
                        <div class="bstage-setting-icon" style="color: #ff3b30 !important;"><i class="fas fa-sign-out-alt"></i></div>
                        <div class="bstage-setting-label" style="color: #ff3b30 !important;">退出</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(chatDetailSheet);

    // Fan Chat Detail Sheet
    const fanChatDetailSheet = document.createElement('div');
    fanChatDetailSheet.className = 'bottom-sheet-overlay detail-sheet-overlay';
    fanChatDetailSheet.id = 'bstage-fan-chat-detail-sheet';
    fanChatDetailSheet.style.zIndex = '1200';
    fanChatDetailSheet.innerHTML = `
        <div class="bottom-sheet" style="height: 90%; background: #1c1c1e; color: #fff;">
            <div class="sheet-handle" style="background-color: #444;"></div>
            <div class="detail-sheet-content bstage-modal-content" style="padding: 0;">
                <div style="text-align: center; padding: 20px 0;">
                    <div id="bstage-fan-detail-avatar-container" style="width: 80px; height: 80px; border-radius: 50%; background-color: #2c2c2e; margin: 0 auto 10px; overflow: hidden; border: 1px solid #333; display: flex; justify-content: center; align-items: center;">
                        <img id="bstage-fan-detail-avatar" src="" style="width: 100%; height: 100%; object-fit: cover; display: none;">
                        <i class="fas fa-user-friends" id="bstage-fan-detail-avatar-icon" style="font-size: 28px; color: #aaa;"></i>
                    </div>
                    <h2 style="font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 5px;" id="bstage-fan-detail-name">粉丝聊天室</h2>
                    <div style="font-size: 13px; color: #aaa; display: flex; align-items: center; justify-content: center; gap: 4px;">
                        <i class="fas fa-heart" style="color: #ff3b30;"></i>
                        <span id="bstage-fan-detail-subscribers">已订阅 0 人</span>
                    </div>
                </div>

                <div class="bstage-settings-list">
                    <div class="bstage-setting-item">
                        <div class="bstage-setting-icon"><i class="fas fa-image"></i></div>
                        <div class="bstage-setting-label" id="bstage-fan-setting-bg" style="flex:1;">背景设定</div>
                        <div class="bstage-setting-right-action" id="bstage-fan-reset-bg-btn" style="color: #aaa;">重置</div>
                        <input type="file" id="bstage-fan-chat-bg-input" accept="image/*" style="display:none;">
                    </div>

                    <div class="bstage-setting-item">
                        <div class="bstage-setting-icon"><i class="fas fa-paint-brush"></i></div>
                        <div class="bstage-setting-label" style="flex:1;">界面 CSS</div>
                        <select id="bstage-fan-chat-css-select" style="background: #2c2c2e; color: #fff; border: 1px solid #444; border-radius: 4px; padding: 4px; width: 120px; outline: none;">
                            <option value="">默认</option>
                        </select>
                    </div>

                    <div class="bstage-setting-item">
                        <div class="bstage-setting-icon"><i class="fas fa-comment-dots"></i></div>
                        <div class="bstage-setting-label" style="flex:1;">气泡 CSS</div>
                        <select id="bstage-fan-bubble-css-select" style="background: #2c2c2e; color: #fff; border: 1px solid #444; border-radius: 4px; padding: 4px; width: 120px; outline: none;">
                            <option value="">默认</option>
                        </select>
                    </div>

                    <div class="bstage-setting-item">
                        <div class="bstage-setting-icon"><i class="fas fa-history"></i></div>
                        <div class="bstage-setting-label" style="flex: 1;">上下文携带</div>
                        <input type="number" id="bstage-fan-context-count" value="50" style="width: 50px; background: transparent; border: 1px solid #444; color: #fff; text-align: center; border-radius: 4px; margin-right: 10px;">
                        <div class="bstage-switch active" id="bstage-fan-context-switch">
                            <div class="bstage-switch-knob"></div>
                        </div>
                    </div>

                    <div class="bstage-setting-item">
                        <div class="bstage-setting-icon"><i class="fas fa-language"></i></div>
                        <div class="bstage-setting-label" style="flex: 1;">实时翻译</div>
                        <div class="bstage-switch" id="bstage-fan-trans-switch">
                            <div class="bstage-switch-knob"></div>
                        </div>
                    </div>

                    <div class="bstage-setting-item" style="color: #ff3b30;" id="bstage-fan-chat-clear-btn">
                        <div class="bstage-setting-icon" style="color: #ff3b30 !important;"><i class="fas fa-trash-alt"></i></div>
                        <div class="bstage-setting-label" style="color: #ff3b30 !important;">清空聊天</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(fanChatDetailSheet);

    // Locker Modal (See All Photos)
    const lockerModal = document.createElement('div');
    lockerModal.className = 'bottom-sheet-overlay detail-sheet-overlay';
    lockerModal.id = 'bstage-locker-modal';
    lockerModal.style.zIndex = '1250'; // Ensure above chat detail sheet
    lockerModal.innerHTML = `
        <div class="bottom-sheet" style="height: 90%; background: #1c1c1e; color: #fff;">
            <div class="sheet-handle" style="background-color: #444;"></div>
            <div class="sheet-title" style="color: #fff;">置物柜</div>
            <div class="detail-sheet-content bstage-modal-content">
                <div class="bstage-locker-grid" id="bstage-locker-grid">
                    <!-- Photos + Add Button -->
                </div>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(lockerModal);

    // Video Detail Modal
    const videoDetailModal = document.createElement('div');
    videoDetailModal.className = 'bottom-sheet-overlay detail-sheet-overlay';
    videoDetailModal.id = 'bstage-video-detail-modal';
    videoDetailModal.innerHTML = `
        <div class="bottom-sheet" style="height: 95%; background: #1c1c1e; color: #fff;">
            <div class="sheet-handle"></div>
            <div class="bstage-video-modal-content">
                <div class="bstage-video-detail-scroll">
                    <!-- Video Player Placeholder -->
                    <div class="bstage-video-player-placeholder">
                        <i class="fas fa-play" style="font-size: 40px; opacity: 0.8;"></i>
                    </div>

                    <!-- Info Section -->
                    <div class="bstage-video-info-section">
                        <div class="bstage-video-detail-title" id="bstage-vid-detail-title">Title</div>
                        <div class="bstage-video-detail-meta" id="bstage-vid-detail-meta">Views • Date</div>
                        
                        <div class="bstage-publisher-row">
                            <div class="bstage-publisher-avatar" id="bstage-vid-publisher-avatar"></div>
                            <div class="bstage-publisher-name" id="bstage-vid-publisher-name">Team Name</div>
                            <div class="bstage-small-magic-btn" id="bstage-video-detail-magic-btn" style="margin-left: auto;">
                                <i class="fas fa-plus"></i>
                            </div>
                        </div>

                        <div class="bstage-video-description" id="bstage-vid-description">
                            Description text...
                        </div>
                    </div>

                    <!-- Comments Section -->
                    <div class="bstage-comments-section">
                        <div class="bstage-comments-header" id="bstage-vid-comments-header">评论 (0)</div>
                        <div class="bstage-comment-list" id="bstage-vid-comments-list">
                            <!-- Comments injected here -->
                        </div>
                    </div>
                </div>

                <!-- Comment Input (Sticky Bottom) -->
                <div class="bstage-comment-input-area" style="background-color: #1c1c1e; border-top: 1px solid #333;">
                    <div class="bstage-comment-reply-preview" id="bstage-vid-comment-reply-preview" style="display:none;">
                        <div class="bstage-comment-reply-preview-text" id="bstage-vid-comment-reply-preview-text"></div>
                        <div class="bstage-comment-reply-cancel" id="bstage-vid-comment-reply-cancel-btn" role="button" tabindex="0" aria-label="取消回复" title="取消回复">
                            <i class="fas fa-times"></i>
                        </div>
                    </div>
                    <div class="bstage-user-avatar-small" id="bstage-comment-user-avatar"></div>
                    <input type="text" class="bstage-comment-input" id="bstage-vid-comment-input" inputmode="text" enterkeyhint="send" autocomplete="off" autocapitalize="sentences" placeholder="添加评论..." style="color: #fff; background-color: transparent; border: none; outline: none; flex: 1;">
                    <i class="fas fa-paper-plane bstage-comment-send-btn disabled" id="bstage-vid-comment-send-btn" style="color: #aaa;"></i>
                </div>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(videoDetailModal);

    // Shop Detail Modal
    const shopDetailModal = document.createElement('div');
    shopDetailModal.className = 'bottom-sheet-overlay detail-sheet-overlay';
    shopDetailModal.id = 'bstage-shop-detail-modal';
    shopDetailModal.innerHTML = `
        <div class="bottom-sheet" style="height: 90%; background: #1c1c1e; border: 1px solid #333; color: #fff;">
            <div class="sheet-handle" style="background-color: #444;"></div>
            <div class="bstage-modal-content" style="padding: 0; display: flex; flex-direction: column; height: 100%; background-color: #000; color: #fff;">
                <div class="bstage-shop-detail-scroll" style="flex:1; overflow-y:auto; padding-bottom:80px;">
                    <!-- Image -->
                    <div class="bstage-shop-detail-img" id="bstage-shop-detail-img" style="width:100%; aspect-ratio:1/1; background-color:#1a1a1a; position:relative; overflow:hidden;">
                        <img src="" style="width:100%; height:100%; object-fit:cover; display:none;">
                        <div class="bstage-shop-detail-placeholder" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center; color:#555;">
                            <i class="fas fa-image" style="font-size:50px;"></i>
                        </div>
                    </div>
                    
                    <!-- Info -->
                    <div class="bstage-shop-detail-info" style="padding:20px;">
                        <span class="bstage-shop-badge" id="bstage-shop-detail-cat" style="margin-bottom:8px;">Category</span>
                        <div class="bstage-shop-detail-title" id="bstage-shop-detail-title" style="font-size:22px; font-weight:700; margin-bottom:8px; line-height:1.3;">Title</div>
                        <div class="bstage-shop-detail-price" id="bstage-shop-detail-price" style="font-size:24px; font-weight:800; color:#fff; margin-bottom:24px;">₩0</div>
                        
                        <div style="width:100%; height:1px; background-color:#222; margin-bottom:24px;"></div>

                        <div class="bstage-shop-detail-desc-title" style="font-size:16px; font-weight:600; margin-bottom:12px;">商品详情</div>
                        <div class="bstage-shop-detail-desc" id="bstage-shop-detail-desc" style="font-size:14px; color:#ccc; line-height:1.6; white-space: pre-wrap;">
                            Description...
                        </div>
                    </div>
                </div>

                <!-- Buy Bar -->
                <div class="bstage-shop-buy-bar" style="padding:16px 20px; border-top:1px solid #222; background-color:#000;">
                    <div class="bstage-shop-buy-btn" style="width:100%; background-color:#fff; color:#000; font-weight:700; font-size:16px; height:50px; border-radius:25px; display:flex; justify-content:center; align-items:center; cursor:pointer;">立即购买</div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(shopDetailModal);

    // --- State ---
    const BSTAGE_STATE_SCHEMA_VERSION = 2;
    const BSTAGE_POP_MONTHLY_KRW = 4500;
    const BSTAGE_KRW_TO_CNY = 0.0052;
    const BSTAGE_MAX_SUBSCRIBERS = 9999999;
    let teams = []; // { id, name, avatar, bg, members: [], isSubscribed: false }
    let currentTeam = null;
    let tempMembers = []; // For creation process
    let isEditingTeam = false; // Flag for edit mode
    let currentEditingMember = null; // Track member being edited
    let currentPopSubMember = null;
    let currentChatMember = null; // Track current chat member
    let pendingChatReply = null;
    let pendingFanReply = null;
    let isTranslationEnabled = false; // Translation State
    let isContextEnabled = true; // Context State
    let contextMessageCount = 50; // Context Message Count
    let userMsgCountSinceLastReply = 0; // POP logic: resets on char reply
    let bstageOrders = []; // { id, title, price, date, type }
    let bstageFanChatHistory = []; // { type, isUser, text, name, avatar, timestamp }
    let bstageFanChatSettings = { chatBg: null, chatCssId: '', bubbleCssId: '' };
    let bstageUserTeamState = { id: '__bstage_user_team__', isUserTeam: true, isSubscribed: true };
    let bstageFanSubscriberCount = null;
    let bstageFanSubscriberGrowthTimer = null;
    let bstageStateUpdatedAt = 0;
    let bstageHydrationComplete = false;
    let bstageRevenueState = { withdrawnCny: 0, lastWithdrawAt: null };
    let pendingVideoCommentReply = null;
    let currentGenerateTypeAction = null;
    let chatPhotos = []; // List of photo URLs for the current chat/team (Simplified as global for now)
    let contentCarouselInterval = null; // To track auto-rotation
    let bstagePresets = {
        chatCss: [],
        avatarFrameCss: [],
        bubbleCss: []
    };
    let currentPresetTab = 'chatCss';
    let activeCharacterChatInputCleanup = null;

    let autoActivityIntervals = {}; // { memberId: intervalId }
    const isBstageAndroid = !!window.mobileInputCompat?.isAndroid || /Android/i.test(navigator.userAgent || '');
    const pendingBstageKeyboardCloses = new WeakSet();

    function isBstageEditableElement(element) {
        if (!element || !element.matches) return false;
        return element.matches('input:not([type="file"]):not([type="hidden"]), textarea, select, [contenteditable="true"]');
    }

    function bindBstageFocusPreservingAction(element, handler) {
        if (!element || typeof handler !== 'function') return function() {};

        let lastPointerActivationAt = 0;
        const invoke = (event) => {
            try {
                const result = handler(event);
                if (result && typeof result.catch === 'function') {
                    result.catch(error => console.error('[b.stage] action failed', error));
                }
            } catch (error) {
                console.error('[b.stage] action failed', error);
            }
        };
        const handlePointerDown = (event) => {
            if (!isBstageAndroid || (event.button !== undefined && event.button !== 0)) return;
            event.preventDefault();
            lastPointerActivationAt = Date.now();
            invoke(event);
        };
        const handleClick = (event) => {
            if (isBstageAndroid && Date.now() - lastPointerActivationAt < 700) {
                event.preventDefault();
                return;
            }
            invoke(event);
        };
        const handleKeydown = (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            invoke(event);
        };

        element.addEventListener('pointerdown', handlePointerDown, { passive: false });
        element.addEventListener('click', handleClick);
        element.addEventListener('keydown', handleKeydown);
        return () => {
            element.removeEventListener('pointerdown', handlePointerDown);
            element.removeEventListener('click', handleClick);
            element.removeEventListener('keydown', handleKeydown);
        };
    }

    function waitForBstageKeyboardToClose(view, timeout = 460) {
        const activeElement = document.activeElement;
        if (!view || !isBstageAndroid || !activeElement || !view.contains(activeElement) || !isBstageEditableElement(activeElement)) {
            return Promise.resolve();
        }

        activeElement.blur();
        const viewport = window.visualViewport;
        if (!viewport) {
            return new Promise(resolve => setTimeout(resolve, 280));
        }

        const startedAt = Date.now();
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
                const keyboardHasRetreated = height >= startingHeight + 72;
                if ((keyboardHasRetreated && stableFrames >= 2) || Date.now() - startedAt >= timeout) {
                    clearTimeout(hardTimeout);
                    finish();
                    return;
                }
                requestAnimationFrame(check);
            };
            requestAnimationFrame(check);
        });
    }

    const bstageFocusScopeCleanup = window.mobileInputCompat?.registerFocusScope?.({
        selector: '#bstage-view, #bstage-chat-view, #bstage-fan-chat-view, .bstage-center-modal-overlay, .bottom-sheet-overlay[id^="bstage-"]',
        resolveScrollContainer(target, root) {
            if (!target || !root) return null;
            if (root.id === 'bstage-chat-view') return document.getElementById('bstage-chat-content');
            if (root.id === 'bstage-fan-chat-view') return document.getElementById('bstage-fan-chat-content');
            if (root.id === 'bstage-video-detail-modal' && target.id === 'bstage-vid-comment-input') {
                return root.querySelector('.bstage-video-detail-scroll');
            }
            return null;
        }
    }) || function() {};

    function registerBstageSendInput(input, onSend, options = {}) {
        if (!input || typeof onSend !== 'function') return function() {};
        if (window.mobileInputCompat?.register) {
            return window.mobileInputCompat.register({
                input,
                root: options.root || null,
                scrollContainer: options.scrollContainer || null,
                onSend,
                blurAfterSend: false,
                enterKeyHint: 'send',
                restoreWindowScroll: false,
                onRestore: options.onRestore || null
            });
        }

        const handleKeydown = (event) => {
            if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.keyCode === 229) return;
            event.preventDefault();
            if (!String(input.value || '').trim()) return;
            onSend({ event, input, text: input.value.trim() });
        };
        input.setAttribute('enterkeyhint', 'send');
        input.addEventListener('keydown', handleKeydown);
        return () => input.removeEventListener('keydown', handleKeydown);
    }

    // --- Logic ---
    function formatTimeBubble(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
        const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        const isSameDay = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();

        if (isSameDay) {
            return `今天 ${timeStr}`;
        } else if (isYesterday) {
            return `昨天 ${timeStr}`;
        } else {
            const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
            if (diffDays < 7) {
                return `${days[date.getDay()]} ${timeStr}`;
            } else {
                return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`;
            }
        }
    }

    function normalizeChatCompletionsEndpoint(endpoint) {
        return window.u2Api.resolveChatCompletionsEndpoint(endpoint);
    }

    function stripGeneratedText(value, fallback = '') {
        return String(value || fallback || '').replace(/[<>]/g, '').trim();
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function createImageSeed(prefix = 'bstage') {
        return encodeURIComponent(`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    }

    const bstageEmojiAvatars = ['😀', '😎', '🥳', '🤩', '😊', '😺', '🌟', '✨', '🎤', '🎧', '🎵', '🎸', '💿', '📀', '🎬', '📸', '🌈', '🔥', '💜', '💙', '🍒', '🍓', '🍑', '🍋', '🍀', '🌙', '☀️', '⭐', '🪩', '🫶'];

    function hashBstageString(value) {
        const text = String(value || 'bstage');
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    function getStableEmojiAvatar(seed) {
        return bstageEmojiAvatars[hashBstageString(seed) % bstageEmojiAvatars.length];
    }

    function isBstageRandomAvatar(value) {
        return /^https:\/\/i\.pravatar\.cc\//.test(String(value || ''));
    }

    function ensureEmojiAvatar(entity, seed) {
        if (!entity || typeof entity !== 'object') return getStableEmojiAvatar(seed);
        if (!entity.avatarEmoji) entity.avatarEmoji = getStableEmojiAvatar(seed || entity.name || entity.id || entity.timestamp || 'bstage');
        return entity.avatarEmoji;
    }

    function renderBstageAvatar(entity, label = 'User', className = '') {
        const avatar = entity && entity.avatar ? String(entity.avatar) : '';
        if (avatar && !isBstageRandomAvatar(avatar)) {
            return `<img class="${escapeHtml(className)}" src="${escapeHtml(avatar)}" alt="">`;
        }
        const emoji = ensureEmojiAvatar(entity, label);
        return `<div class="${escapeHtml(className)} bstage-emoji-avatar" aria-label="${escapeHtml(label)}">${escapeHtml(emoji)}</div>`;
    }

    function renderBstageAvatarContent(entity, label = 'User') {
        const avatar = entity && entity.avatar ? String(entity.avatar) : '';
        if (avatar && !isBstageRandomAvatar(avatar)) {
            return `<img src="${escapeHtml(avatar)}" alt="">`;
        }
        return `<span class="bstage-emoji-avatar-text">${escapeHtml(ensureEmojiAvatar(entity, label))}</span>`;
    }

    function isUserTeam(team) {
        return !!team && (team.isUserTeam || team.id === '__bstage_user_team__');
    }

    function getBstageUserTeam() {
        const baseUserName = window.userState && window.userState.name ? window.userState.name : 'User';
        const customName = typeof bstageUserTeamState.customName === 'string' ? bstageUserTeamState.customName.trim() : '';
        const userName = customName || baseUserName;
        const hasCustomAvatar = Object.prototype.hasOwnProperty.call(bstageUserTeamState, 'customAvatar');
        const userAvatar = hasCustomAvatar ? bstageUserTeamState.customAvatar : (window.userState && window.userState.avatarUrl ? window.userState.avatarUrl : null);
        bstageUserTeamState.id = '__bstage_user_team__';
        bstageUserTeamState.isUserTeam = true;
        bstageUserTeamState.isSubscribed = true;
        bstageUserTeamState.name = userName;
        bstageUserTeamState.desc = bstageUserTeamState.customDesc || (window.userState && window.userState.persona ? window.userState.persona : 'User 官方空间');
        bstageUserTeamState.avatar = userAvatar;
        if (Object.prototype.hasOwnProperty.call(bstageUserTeamState, 'customBg')) {
            bstageUserTeamState.bg = bstageUserTeamState.customBg || null;
        }
        bstageUserTeamState.avatarEmoji = bstageUserTeamState.avatarEmoji || getStableEmojiAvatar(`bstage-user-team-${userName}`);
        const extraMembers = Array.isArray(bstageUserTeamState.members)
            ? bstageUserTeamState.members.filter(member => member && !member.isUserMember && member.id !== '__bstage_user_member__')
            : [];
        bstageUserTeamState.members = [{
            id: '__bstage_user_member__',
            isUserMember: true,
            name: userName,
            role: window.userState && window.userState.persona ? window.userState.persona : 'User',
            avatar: userAvatar,
            avatarEmoji: bstageUserTeamState.avatarEmoji,
            isSubscribed: true,
            subStartDate: Date.now()
        }, ...extraMembers];
        return bstageUserTeamState;
    }

    function findCanonicalBstageMember(memberId, preferredTeamId = null) {
        if (memberId === undefined || memberId === null) return null;
        const targetId = String(memberId);
        const teamId = preferredTeamId === undefined || preferredTeamId === null ? null : String(preferredTeamId);
        const userTeam = getBstageUserTeam();
        const candidates = [userTeam, ...teams];
        const preferred = teamId
            ? candidates.filter(team => team && String(team.id) === teamId)
            : candidates;
        const searchTeams = preferred.length > 0 ? preferred : candidates;
        for (const team of searchTeams) {
            const member = Array.isArray(team?.members)
                ? team.members.find(item => item && String(item.id) === targetId)
                : null;
            if (member) return { team, member };
        }
        return null;
    }

    function rebindActiveBstageReferences() {
        const selectedTeamId = currentTeam?.id;
        if (selectedTeamId !== undefined && selectedTeamId !== null) {
            currentTeam = String(selectedTeamId) === '__bstage_user_team__'
                ? getBstageUserTeam()
                : (teams.find(team => team && String(team.id) === String(selectedTeamId)) || null);
        }

        if (!currentChatMember) return false;
        const rebound = findCanonicalBstageMember(currentChatMember.id, currentTeam?.id);
        currentChatMember = rebound ? rebound.member : null;
        if (rebound) currentTeam = rebound.team;
        return !!rebound;
    }

    function ensureBstageHydrated(showFeedback = true) {
        if (bstageHydrationComplete) return true;
        if (showFeedback && typeof window.showToast === 'function') {
            window.showToast('b.stage 数据正在加载，请稍候');
        }
        return false;
    }

    function createExternalBackground(seed) {
        return `https://picsum.photos/seed/${encodeURIComponent(seed)}/900/1200`;
    }

    function createExternalRandomImage(seed, width = 800, height = 800) {
        return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
    }

    function removeBstageDefaultContent(team) {
        if (!team || typeof team !== 'object') return false;
        let changed = false;
        const teamKey = team.id || team.name || '';

        if (Array.isArray(team.shopItems)) {
            const defaultShopNames = new Set([
                `${team.name} 2024 Season Greeting`,
                `${team.name} Official Light Stick`,
                'Fan Meeting: OUR ZONE Ticket',
                'Video Call Event #3',
                'Behind Photo Set A'
            ]);
            const defaultShopImages = new Set([
                createExternalRandomImage(`${teamKey}-shop-season`, 600, 600),
                createExternalRandomImage(`${teamKey}-shop-lightstick`, 600, 600),
                createExternalRandomImage(`${teamKey}-shop-ticket`, 600, 600),
                createExternalRandomImage(`${teamKey}-shop-videocall`, 600, 600),
                createExternalRandomImage(`${teamKey}-shop-photo-set`, 600, 600)
            ]);
            const before = team.shopItems.length;
            team.shopItems = team.shopItems.filter(item => {
                const itemName = item && item.name ? String(item.name) : '';
                const itemImg = item && item.img ? String(item.img) : '';
                return !(defaultShopNames.has(itemName) || defaultShopImages.has(itemImg));
            });
            if (team.shopItems.length !== before) changed = true;
        }

        if (Array.isArray(team.shopCategories) && team.shopCategories.length === 5) {
            const defaultCats = ['全部', '周边', '票务', '签售', '其他'];
            if (defaultCats.every((cat, index) => team.shopCategories[index] === cat) && (!team.shopItems || team.shopItems.length === 0)) {
                team.shopCategories = ['全部'];
                changed = true;
            }
        }

        if (Array.isArray(team.contentPhotos)) {
            const defaultPhotos = new Set([
                createExternalRandomImage(`${teamKey}-content-photo-1`, 900, 600),
                createExternalRandomImage(`${teamKey}-content-photo-2`, 900, 600),
                createExternalRandomImage(`${teamKey}-content-photo-3`, 900, 600)
            ]);
            const before = team.contentPhotos.length;
            team.contentPhotos = team.contentPhotos.filter(photo => !defaultPhotos.has(String(photo || '')));
            if (team.contentPhotos.length !== before) changed = true;
        }

        if (Array.isArray(team.videos)) {
            const defaultVideoTitles = new Set(['Behind The Scenes Ep.1', 'Dance Practice', 'Vlog #5: Day Off']);
            const before = team.videos.length;
            team.videos = team.videos.filter(video => !defaultVideoTitles.has(video && video.title ? String(video.title) : ''));
            if (team.videos.length !== before) changed = true;
        }

        if (Array.isArray(team.contentSeries) && team.contentSeries.length === 2 && team.contentSeries[0] === '全部' && team.contentSeries[1] === 'vlog' && (!team.videos || team.videos.length === 0)) {
            team.contentSeries = ['全部'];
            changed = true;
        }

        return changed;
    }

    function createBstageMessageId(prefix = 'msg') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function ensureMessageId(msg, prefix = 'msg') {
        if (!msg || typeof msg !== 'object') return '';
        if (!msg.id) msg.id = `${prefix}_${msg.timestamp || Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        return msg.id;
    }

    function getMessageSummary(msg) {
        if (!msg) return '';
        const raw = msg.type === 'image' ? `[图片] ${msg.imgDesc || msg.description || ''}` : (msg.text || '');
        const text = stripGeneratedText(raw, msg.type === 'image' ? '[图片]' : '');
        return text.length > 64 ? `${text.slice(0, 64)}...` : text;
    }

    function createReplyMeta(msg, speaker) {
        if (!msg) return null;
        return {
            id: ensureMessageId(msg, msg.isUser ? 'user' : 'ai'),
            speaker: stripGeneratedText(speaker, msg.isUser ? 'User' : 'AI'),
            text: getMessageSummary(msg),
            isUser: !!msg.isUser
        };
    }

    function renderReplyQuote(replyTo) {
        if (!replyTo || !replyTo.text) return '';
        return `
            <div class="bstage-reply-quote">
                <div class="bstage-reply-quote-speaker">${escapeHtml(replyTo.speaker || '消息')}</div>
                <div class="bstage-reply-quote-text">${escapeHtml(replyTo.text)}</div>
            </div>
        `;
    }

    function formatReplyForPrompt(replyTo) {
        if (!replyTo || !replyTo.id) return '';
        return `；回复 ${replyTo.speaker || '消息'}(${replyTo.id})：「${replyTo.text || ''}」`;
    }

    function findMessageById(history, id, predicate) {
        if (!id || !Array.isArray(history)) return null;
        return history.find(msg => msg && msg.id === id && (!predicate || predicate(msg))) || null;
    }

    function normalizeOtherFanMessages(rawMessages, timestamp = Date.now()) {
        if (!Array.isArray(rawMessages)) return [];
        return rawMessages.slice(0, 14).map((item, index) => {
            const fanName = stripGeneratedText(item && item.name, getRandomFanName(index));
            const text = stripGeneratedText(typeof item === 'string' ? item : item && item.text);
            const trans = stripGeneratedText(item && (item.trans || item.translationZh || item.translation));
            if (!text) return null;
            if (fanMessageNeedsTranslation(text) && !trans) return null;
            const id = stripGeneratedText(item && item.id, createBstageMessageId('other_fan'));
            return {
                id,
                name: fanName,
                text,
                trans,
                timestamp: timestamp + index,
                avatarEmoji: stripGeneratedText(item && item.avatarEmoji) || getStableEmojiAvatar(`bstage-other-fan-${fanName}-${id}`)
            };
        }).filter(Boolean);
    }

    function normalizeFanBatchMessage(msg) {
        if (!msg || typeof msg !== 'object') return null;
        ensureMessageId(msg, 'fan_batch');
        msg.type = 'fan_batch';
        msg.timestamp = msg.timestamp || Date.now();
        msg.fanMessages = normalizeOtherFanMessages(msg.fanMessages || msg.messages || msg.otherFanMessages || [], msg.timestamp);
        return msg;
    }

    function formatFanBatchForPrompt(msg) {
        const batch = normalizeFanBatchMessage(msg);
        if (!batch || batch.fanMessages.length === 0) return '';
        const summary = batch.fanMessages
            .slice(0, 8)
            .map(fan => `${fan.name || '粉丝'}(${fan.id}): ${fan.text || ''}${fan.trans ? ` / 中文：${fan.trans}` : ''}`)
            .join(' | ');
        return `[id:${batch.id}] [其他粉丝消息批次]: ${summary}`;
    }

    function createOtherFanReplyMeta(fanMessage) {
        if (!fanMessage) return null;
        return {
            id: fanMessage.id,
            speaker: stripGeneratedText(fanMessage.name, '粉丝'),
            text: getMessageSummary({ type: 'text', text: fanMessage.text }),
            isUser: false,
            isOtherFan: true
        };
    }

    function closeOtherFansModal() {
        if (!bstageOtherFansModal) return;
        bstageOtherFansModal.classList.remove('active');
    }

    function openOtherFansModal(member, batch) {
        const normalizedBatch = normalizeFanBatchMessage(batch);
        const title = document.getElementById('bstage-other-fans-title');
        const list = document.getElementById('bstage-other-fans-list');
        if (!normalizedBatch || !list) return;
        const memberName = member && member.name ? member.name : 'Char';
        if (title) title.textContent = `其他粉丝给 ${memberName} 的消息`;
        const messages = normalizedBatch.fanMessages || [];
        if (messages.length === 0) {
            list.innerHTML = '<div class="bstage-other-fans-empty">本轮没有可查看的其他粉丝消息</div>';
        } else {
            list.innerHTML = messages.map(fan => {
                const transHtml = fan.trans ? `<div class="bstage-other-fan-trans">${escapeHtml(fan.trans)}</div>` : '';
                return `
                    <div class="bstage-other-fan-item">
                        ${renderBstageAvatar(fan, fan.name || '粉丝', 'bstage-other-fan-avatar')}
                        <div class="bstage-other-fan-body">
                            <div class="bstage-other-fan-name">${escapeHtml(fan.name || '粉丝')}</div>
                            <div class="bstage-other-fan-text">${escapeHtml(fan.text || '')}</div>
                            ${transHtml}
                        </div>
                    </div>
                `;
            }).join('');
        }
        bstageOtherFansModal.classList.add('active');
    }

    function openBstageImagePreview(src, desc) {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.cursor = 'zoom-out';

        const img = document.createElement('img');
        img.src = src;
        img.style.maxWidth = '90%';
        img.style.maxHeight = '80%';
        img.style.objectFit = 'contain';
        img.style.borderRadius = '12px';
        img.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
        overlay.appendChild(img);

        if (desc) {
            const textDiv = document.createElement('div');
            textDiv.style.color = '#fff';
            textDiv.style.marginTop = '20px';
            textDiv.style.maxWidth = '90%';
            textDiv.style.textAlign = 'center';
            textDiv.style.fontSize = '16px';
            textDiv.textContent = desc;
            overlay.appendChild(textDiv);
        }

        document.body.appendChild(overlay);
        overlay.addEventListener('click', () => overlay.remove());
    }

    function attachBstageImagePreview(container) {
        if (!container) return;
        const imgNode = container.querySelector('.bstage-chat-image-clickable');
        if (!imgNode) return;
        imgNode.addEventListener('click', (e) => {
            e.stopPropagation();
            openBstageImagePreview(imgNode.src, imgNode.getAttribute('data-desc') || '');
        });
    }

    function formatMessageForPrompt(msg, speaker) {
        if (!msg || msg.type === 'date') return '';
        if (msg.type === 'fan_batch') return formatFanBatchForPrompt(msg);
        ensureMessageId(msg, msg.isUser ? 'user' : 'ai');
        const summary = getMessageSummary(msg);
        const replyText = formatReplyForPrompt(msg.replyTo);
        return `[id:${msg.id}] [${speaker}]${replyText}: ${summary}`;
    }

    function setPendingReply(kind, target) {
        const isFan = kind === 'fan';
        if (isFan) pendingFanReply = target;
        else pendingChatReply = target;

        const preview = document.getElementById(isFan ? 'bstage-fan-chat-reply-preview' : 'bstage-chat-reply-preview');
        const textEl = document.getElementById(isFan ? 'bstage-fan-chat-reply-preview-text' : 'bstage-chat-reply-preview-text');
        if (preview && textEl) {
            if (target) {
                textEl.textContent = `${target.speaker}: ${target.text}`;
                preview.style.display = 'flex';
                preview.classList.add('active');
            } else {
                textEl.textContent = '';
                preview.style.display = 'none';
                preview.classList.remove('active');
            }
        }

        const input = document.getElementById(isFan ? 'bstage-fan-chat-input' : 'bstage-chat-input');
        if (target && input) input.focus({ preventScroll: true });
    }

    function clearPendingReply(kind) {
        setPendingReply(kind, null);
    }

    function setChatActionLoading(button, isLoading) {
        if (!button) return;
        button.classList.toggle('is-loading', isLoading);
        button.setAttribute('aria-disabled', isLoading ? 'true' : 'false');
        button.innerHTML = isLoading ? '<i class="fas fa-spinner"></i>' : '<i class="fas fa-arrow-down"></i>';
    }

    function parseApiJsonContent(rawContent) {
        const cleaned = String(rawContent || '').replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
    }

    async function callBstageJsonApi(prompt, systemContent = 'You are a JSON generator.', temperature = 0.7) {
        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
            throw new Error('missing_api_config');
        }

        const configuredTemperature = window.apiConfig.temperature !== undefined ? window.apiConfig.temperature : window.apiConfig.temp;
        const response = await fetch(normalizeChatCompletionsEndpoint(window.apiConfig.endpoint), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.apiConfig.apiKey}`
            },
            body: JSON.stringify({
                model: window.apiConfig.model || 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemContent },
                    { role: 'user', content: prompt }
                ],
                temperature: parseFloat(configuredTemperature) || temperature
            })
        });

        if (!response.ok) throw new Error(`api_error_${response.status}`);
        const data = await response.json();
        return parseApiJsonContent(data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '');
    }

    function openGenerateTypeSheet({ title, label, placeholder, onConfirm }) {
        currentGenerateTypeAction = typeof onConfirm === 'function' ? onConfirm : null;
        const titleEl = document.getElementById('bstage-generate-type-title');
        const labelEl = document.getElementById('bstage-generate-type-label');
        const inputEl = document.getElementById('bstage-generate-type-input');
        const confirmBtn = document.getElementById('bstage-generate-type-confirm-btn');
        if (titleEl) titleEl.textContent = title || '生成内容';
        if (labelEl) labelEl.textContent = label || '想看什么类型';
        if (inputEl) {
            inputEl.value = '';
            inputEl.placeholder = placeholder || '留空则随机生成';
        }
        if (confirmBtn) {
            confirmBtn.classList.remove('is-loading');
            confirmBtn.textContent = '确认生成';
        }
        window.openView(generateTypeSheet);
        setTimeout(() => {
            if (inputEl) inputEl.focus({ preventScroll: true });
        }, 80);
    }

    async function confirmGenerateTypeSheet() {
        if (!currentGenerateTypeAction) return;
        const confirmBtn = document.getElementById('bstage-generate-type-confirm-btn');
        const inputEl = document.getElementById('bstage-generate-type-input');
        if (confirmBtn && confirmBtn.classList.contains('is-loading')) return;
        const wasReadOnly = !!inputEl?.readOnly;
        if (confirmBtn) {
            confirmBtn.classList.add('is-loading');
            confirmBtn.textContent = '生成中...';
        }
        if (inputEl) {
            inputEl.readOnly = true;
            inputEl.setAttribute('aria-busy', 'true');
        }
        try {
            await currentGenerateTypeAction(inputEl ? inputEl.value.trim() : '');
            window.closeView(generateTypeSheet);
        } finally {
            if (inputEl) {
                inputEl.readOnly = wasReadOnly;
                inputEl.removeAttribute('aria-busy');
            }
            if (confirmBtn) {
                confirmBtn.classList.remove('is-loading');
                confirmBtn.textContent = '确认生成';
            }
        }
    }

    function checkAndAddDateBubble(member, contentContainer, timestamp) {
        if (!member.chatHistory) member.chatHistory = [];
        let lastMsg = null;
        for (let i = member.chatHistory.length - 1; i >= 0; i--) {
            if (member.chatHistory[i].type !== 'date') {
                lastMsg = member.chatHistory[i];
                break;
            }
        }
        
        const TIME_THRESHOLD = 5 * 60 * 1000; // 5 minutes
        if (!lastMsg || !lastMsg.timestamp || (timestamp - lastMsg.timestamp > TIME_THRESHOLD)) {
            const timeText = formatTimeBubble(timestamp);
            const dateMessage = { type: 'date', text: timeText, timestamp: timestamp };
            member.chatHistory.push(dateMessage);
            
            if (contentContainer) {
                const dateDiv = document.createElement('div');
                dateDiv.className = 'bstage-chat-date';
                dateDiv.textContent = timeText;
                contentContainer.appendChild(dateDiv);
            }
            return dateMessage;
        }
        return null;
    }

    function migrateRandomAvatarEntity(entity, seed) {
        if (!entity || typeof entity !== 'object') return false;
        let changed = false;
        if (isBstageRandomAvatar(entity.avatar)) {
            entity.avatarEmoji = entity.avatarEmoji || getStableEmojiAvatar(seed || entity.avatar);
            entity.avatar = null;
            changed = true;
        }
        return changed;
    }

    function normalizeLoadedBstageData() {
        let changed = false;
        if (bstageFanSubscriberCount != null && Number.isFinite(Number(bstageFanSubscriberCount))) {
            const normalizedSubscriberCount = normalizeBstageSubscriberCount(bstageFanSubscriberCount);
            if (normalizedSubscriberCount !== bstageFanSubscriberCount) {
                bstageFanSubscriberCount = normalizedSubscriberCount;
                changed = true;
            }
        }
        const normalizeVideoComments = (team) => {
            if (!team || !Array.isArray(team.videos)) return;
            team.videos.forEach(video => {
                if (!video || !Array.isArray(video.comments)) return;
                video.comments.forEach(comment => {
                    if (!comment || typeof comment !== 'object') return;
                    const beforeId = comment.id;
                    ensureMessageId(comment, comment.isUser ? 'user_comment' : 'video_comment');
                    if (!beforeId) changed = true;
                    if (!comment.isUser && !comment.avatar && !comment.avatarEmoji) {
                        comment.avatarEmoji = getStableEmojiAvatar(`video-comment-${comment.name || comment.id}`);
                        changed = true;
                    }
                    if (!Array.isArray(comment.replies)) {
                        comment.replies = [];
                        changed = true;
                    }
                    comment.replies.forEach(reply => {
                        if (!reply || typeof reply !== 'object') return;
                        const beforeReplyId = reply.id;
                        ensureMessageId(reply, 'video_comment_reply');
                        if (!beforeReplyId) changed = true;
                        if (!reply.avatarEmoji) {
                            reply.avatarEmoji = getStableEmojiAvatar(`video-comment-reply-${reply.name || reply.id}`);
                            changed = true;
                        }
                    });
                });
            });
        };

        teams.forEach(team => {
            changed = removeBstageDefaultContent(team) || changed;
            changed = migrateRandomAvatarEntity(team, `team-${team.id || team.name}`) || changed;
            if (Array.isArray(team.members)) {
                team.members.forEach(member => {
                    changed = migrateRandomAvatarEntity(member, `member-${member.id || member.name}`) || changed;
                    if (Array.isArray(member.chatHistory)) {
                        member.chatHistory.forEach(msg => {
                            if (!msg || msg.type === 'date') return;
                            if (msg.type === 'fan_batch') {
                                const beforeId = msg.id;
                                const beforeCount = Array.isArray(msg.fanMessages) ? msg.fanMessages.length : -1;
                                normalizeFanBatchMessage(msg);
                                if (!beforeId || beforeCount !== msg.fanMessages.length) changed = true;
                                return;
                            }
                            const beforeId = msg.id;
                            ensureMessageId(msg, msg.isUser ? 'user' : 'char');
                            if (!beforeId) changed = true;
                        });
                    }
                });
            }
            normalizeVideoComments(team);
        });

        changed = removeBstageDefaultContent(bstageUserTeamState) || changed;
        changed = migrateRandomAvatarEntity(bstageUserTeamState, `team-${bstageUserTeamState.id || bstageUserTeamState.name || 'user'}`) || changed;
        normalizeVideoComments(bstageUserTeamState);

        if (Array.isArray(bstageFanChatHistory)) {
            bstageFanChatHistory.forEach(msg => {
                if (!msg || msg.type === 'date') return;
                const beforeId = msg.id;
                ensureMessageId(msg, msg.isUser ? 'user' : 'fan');
                if (!beforeId) changed = true;
                if (!msg.isUser) {
                    changed = migrateRandomAvatarEntity(msg, `fan-${msg.name || msg.id}`) || changed;
                    if (!msg.avatarEmoji) {
                        msg.avatarEmoji = getStableEmojiAvatar(`fan-${msg.name || msg.id || msg.timestamp}`);
                        changed = true;
                    }
                }
            });
        }
        return changed;
    }

    function saveBstageData(options = {}) {
        if (!bstageHydrationComplete) return false;
        try {
            if (bstageFanSubscriberCount != null) {
                bstageFanSubscriberCount = normalizeBstageSubscriberCount(bstageFanSubscriberCount);
            }
            const flush = options && options.flush === true;
            const nextUpdatedAt = Date.now();
            bstageStateUpdatedAt = nextUpdatedAt;
            const nextState = {
                schemaVersion: BSTAGE_STATE_SCHEMA_VERSION,
                updatedAt: nextUpdatedAt,
                teams,
                bstageOrders,
                bstageFanChatHistory,
                bstageFanChatSettings,
                bstageUserTeamState,
                bstageFanSubscriberCount,
                bstageRevenueState,
                chatPhotos,
                bstagePresets,
                isTranslationEnabled,
                isContextEnabled,
                contextMessageCount
            };
            window.__bstageGlobalState = nextState;

            if (typeof window.setAppState === 'function') {
                window.setAppState('bstage', nextState);
                if (flush && typeof window.saveGlobalData === 'function') {
                    return Promise.resolve(window.saveGlobalData()).then(Boolean);
                }
                return true;
            }
            if (window.saveGlobalData) {
                return flush ? Promise.resolve(window.saveGlobalData()).then(Boolean) : window.saveGlobalData();
            }
        } catch (e) {
            console.warn('Bstage data save failed (possibly quota exceeded):', e);
        }
        return false;
    }

    function loadBstageData(options = {}) {
        const persistNormalized = options.persistNormalized !== false;
        let normalized = false;
        try {
            const data = typeof window.getAppState === 'function'
                ? window.getAppState('bstage')
                : window.__bstageGlobalState;
            window.__bstageGlobalState = data && typeof data === 'object' ? data : {};

            if (Array.isArray(window.__bstageGlobalState.teams)) teams = window.__bstageGlobalState.teams;
            if (Array.isArray(window.__bstageGlobalState.bstageOrders)) bstageOrders = window.__bstageGlobalState.bstageOrders;
            if (Array.isArray(window.__bstageGlobalState.bstageFanChatHistory)) bstageFanChatHistory = window.__bstageGlobalState.bstageFanChatHistory;
            if (window.__bstageGlobalState.bstageFanChatSettings && typeof window.__bstageGlobalState.bstageFanChatSettings === 'object') {
                bstageFanChatSettings = { ...bstageFanChatSettings, ...window.__bstageGlobalState.bstageFanChatSettings };
            }
            if (window.__bstageGlobalState.bstageUserTeamState && typeof window.__bstageGlobalState.bstageUserTeamState === 'object') {
                bstageUserTeamState = { ...bstageUserTeamState, ...window.__bstageGlobalState.bstageUserTeamState };
            }
            if (Number.isFinite(Number(window.__bstageGlobalState.bstageFanSubscriberCount))) {
                bstageFanSubscriberCount = normalizeBstageSubscriberCount(window.__bstageGlobalState.bstageFanSubscriberCount);
            }
            if (window.__bstageGlobalState.bstageRevenueState && typeof window.__bstageGlobalState.bstageRevenueState === 'object') {
                const withdrawnCny = Number(window.__bstageGlobalState.bstageRevenueState.withdrawnCny);
                bstageRevenueState = {
                    withdrawnCny: Number.isFinite(withdrawnCny) ? Math.max(0, withdrawnCny) : 0,
                    lastWithdrawAt: window.__bstageGlobalState.bstageRevenueState.lastWithdrawAt || null
                };
            }
            if (Array.isArray(window.__bstageGlobalState.chatPhotos)) chatPhotos = window.__bstageGlobalState.chatPhotos;
            if (window.__bstageGlobalState.bstagePresets) bstagePresets = window.__bstageGlobalState.bstagePresets;
            if (typeof window.__bstageGlobalState.isTranslationEnabled === 'boolean') isTranslationEnabled = window.__bstageGlobalState.isTranslationEnabled;
            if (typeof window.__bstageGlobalState.isContextEnabled === 'boolean') isContextEnabled = window.__bstageGlobalState.isContextEnabled;
            if (Number.isFinite(Number(window.__bstageGlobalState.contextMessageCount))) {
                contextMessageCount = Math.max(1, parseInt(window.__bstageGlobalState.contextMessageCount, 10) || 50);
            }
            if (Number.isFinite(Number(window.__bstageGlobalState.updatedAt))) {
                bstageStateUpdatedAt = Number(window.__bstageGlobalState.updatedAt) || 0;
            }
            if (persistNormalized) {
                normalized = normalizeLoadedBstageData();
                if (normalized && bstageHydrationComplete) saveBstageData();
            }
        } catch (e) {
            console.error('Bstage data load failed:', e);
        }
        return normalized;
    }

    // Load data on init
    loadBstageData({ persistNormalized: false });

    // Hook window functions to save data automatically
    const originalToast = window.showToast;
    window.showToast = function(msg) {
        saveBstageData();
        if (originalToast) originalToast(msg);
    };

    const originalCloseView = window.closeView;
    window.closeView = function(view) {
        saveBstageData();
        if (!originalCloseView) return;

        const activeElement = document.activeElement;
        const shouldWaitForKeyboard = !!(
            view
            && isBstageAndroid
            && view.id
            && view.id.startsWith('bstage-')
            && activeElement
            && view.contains(activeElement)
            && isBstageEditableElement(activeElement)
        );
        if (!shouldWaitForKeyboard) {
            originalCloseView(view);
            return;
        }
        if (pendingBstageKeyboardCloses.has(view)) return;

        pendingBstageKeyboardCloses.add(view);
        waitForBstageKeyboardToClose(view).finally(() => {
            pendingBstageKeyboardCloses.delete(view);
            originalCloseView(view);
        });
    };

    // Global Debounced Save
    let bstageSaveTimeout = null;
    let clickRAF = null;
    let keyupRAF = null;

    function flushBstageDataNow() {
        if (bstageSaveTimeout) {
            clearTimeout(bstageSaveTimeout);
            bstageSaveTimeout = null;
        }
        saveBstageData();
        if (typeof window.saveGlobalData === 'function') {
            window.saveGlobalData();
        }
    }

    window.addEventListener('pagehide', flushBstageDataNow);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushBstageDataNow();
    });
    
    document.body.addEventListener('click', () => {
        if (clickRAF) return;
        clickRAF = requestAnimationFrame(() => {
            clearTimeout(bstageSaveTimeout);
            bstageSaveTimeout = setTimeout(saveBstageData, 1000);
            clickRAF = null;
        });
    });
    
    document.body.addEventListener('keyup', () => {
        if (keyupRAF) return;
        keyupRAF = requestAnimationFrame(() => {
            clearTimeout(bstageSaveTimeout);
            bstageSaveTimeout = setTimeout(saveBstageData, 1000);
            keyupRAF = null;
        });
    });


    // Open/Close App
    const appBtn = document.getElementById('app-bstage-btn');
    if (appBtn) {
        appBtn.addEventListener('click', () => {
            window.openView(bstageView);
            if (!bstageHydrationComplete && typeof window.showToast === 'function') {
                window.showToast('b.stage 数据正在加载，请稍候');
            }
        });
    }

    document.getElementById('bstage-back-btn').addEventListener('click', () => {
        window.closeView(bstageView);
    });

    document.getElementById('bstage-chat-back-btn').addEventListener('click', () => {
        window.closeView(bstageChatView);
    });

    document.getElementById('bstage-fan-chat-back-btn').addEventListener('click', () => {
        window.closeView(bstageFanChatView);
    });

    document.getElementById('bstage-fan-chat-menu-btn').addEventListener('click', () => {
        openFanChatDetailSheet();
    });

    const chatReplyCancelBtn = document.getElementById('bstage-chat-reply-cancel-btn');
    if (chatReplyCancelBtn) {
        chatReplyCancelBtn.addEventListener('click', () => clearPendingReply('chat'));
        chatReplyCancelBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                clearPendingReply('chat');
            }
        });
    }

    const fanChatReplyCancelBtn = document.getElementById('bstage-fan-chat-reply-cancel-btn');
    if (fanChatReplyCancelBtn) {
        fanChatReplyCancelBtn.addEventListener('click', () => clearPendingReply('fan'));
        fanChatReplyCancelBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                clearPendingReply('fan');
            }
        });
    }

    const generateTypeConfirmBtn = document.getElementById('bstage-generate-type-confirm-btn');
    const generateTypeInput = document.getElementById('bstage-generate-type-input');
    if (generateTypeConfirmBtn) bindBstageFocusPreservingAction(generateTypeConfirmBtn, confirmGenerateTypeSheet);
    if (generateTypeInput) {
        generateTypeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
                e.preventDefault();
                confirmGenerateTypeSheet();
            }
        });
    }

    // --- Auto Activity Logic ---
    function startAutoActivity(member) {
        if (autoActivityIntervals[member.id]) clearInterval(autoActivityIntervals[member.id]);
        
        let intervalSec = member.autoActivityInterval || 60;
        
        autoActivityIntervals[member.id] = setInterval(() => {
            if (!ensureBstageHydrated(false)) return;
            const canonical = findCanonicalBstageMember(member.id);
            if (!canonical) {
                stopAutoActivity(member);
                return;
            }
            member = canonical.member;
            // Determine container: if currently chatting with this member, use DOM, else null
            const contentContainer = (currentChatMember && currentChatMember.id === member.id && bstageChatView.style.display !== 'none') 
                ? document.getElementById('bstage-chat-content') 
                : null;
            
            triggerChatApi(member, contentContainer, true);
        }, intervalSec * 1000);
    }

    function stopAutoActivity(member) {
        if (autoActivityIntervals[member.id]) {
            clearInterval(autoActivityIntervals[member.id]);
            delete autoActivityIntervals[member.id];
        }
    }

    // Init auto activity for all members on load
    function initAllAutoActivities() {
        teams.forEach(team => {
            if (team.members) {
                team.members.forEach(member => {
                    if (member.autoActivityEnabled) {
                        startAutoActivity(member);
                    }
                });
            }
        });
    }
    
    // Chat Menu Button
    document.getElementById('bstage-chat-menu-btn').addEventListener('click', () => {
        if (currentChatMember) {
            document.getElementById('bstage-detail-name').textContent = currentChatMember.name;
            const days = Math.floor((Date.now() - currentChatMember.subStartDate) / (1000 * 60 * 60 * 24)) + 1;
            document.getElementById('bstage-detail-days').textContent = `已一同 ${days} 天`;
            
            const avatar = document.getElementById('bstage-detail-avatar');
            const avatarText = document.getElementById('bstage-detail-avatar-text');
            const avatarContainer = document.getElementById('bstage-detail-avatar-container');
            
            if (currentChatMember.avatar) {
                avatar.src = currentChatMember.avatar;
                avatar.style.display = 'block';
                avatarText.style.display = 'none';
                avatarContainer.style.backgroundColor = '#1c1c1e';
            } else {
                avatar.style.display = 'none';
                avatarText.style.display = 'block';
                avatarText.textContent = currentChatMember.name[0];
                avatarContainer.style.backgroundColor = '#333';
            }
            
            // Sync Context State
            const contextSwitchEl = document.getElementById('bstage-context-switch');
            if (isContextEnabled) contextSwitchEl.classList.add('active');
            else contextSwitchEl.classList.remove('active');
            document.getElementById('bstage-context-count').value = contextMessageCount;
            
            // Sync Switch State
            const switchEl = document.getElementById('bstage-trans-switch');
            if (isTranslationEnabled) switchEl.classList.add('active');
            else switchEl.classList.remove('active');

            const otherFansSwitch = document.getElementById('bstage-other-fans-switch');
            if (otherFansSwitch) otherFansSwitch.classList.toggle('active', !!currentChatMember.otherFansEnabled);

            // Render Preview
            renderLockerPreview();
            
            populateCssSelects();

            // Sync Auto Activity Settings
            const autoSwitch = document.getElementById('bstage-auto-activity-switch');
            const autoOptions = document.getElementById('bstage-auto-activity-options');
            const autoInterval = document.getElementById('bstage-auto-activity-interval');
            const autoPreset = document.getElementById('bstage-auto-activity-preset');
            
            if (currentChatMember.autoActivityEnabled) {
                autoSwitch.classList.add('active');
                autoOptions.style.display = 'block';
            } else {
                autoSwitch.classList.remove('active');
                autoOptions.style.display = 'none';
            }
            
            autoInterval.value = currentChatMember.autoActivityInterval || 60;
            
            // Populate API Presets from window.appStorage/StorageManager if available
            autoPreset.innerHTML = '<option value="">默认全局API</option>';
            let globalPresets = [];
            try {
                if (window.StorageManager) {
                    globalPresets = window.StorageManager.load('u2_apiPresets', []);
                }
            } catch(e) {}
            
            globalPresets.forEach(p => {
                autoPreset.innerHTML += `<option value="${p.id}">${p.name}</option>`;
            });
            
            if (currentChatMember.autoActivityPresetId) {
                autoPreset.value = currentChatMember.autoActivityPresetId;
            }

            window.openView(chatDetailSheet);
        }
    });

    // Auto Activity Switch & Inputs Logic
    document.getElementById('bstage-auto-activity-switch').addEventListener('click', function() {
        if (!currentChatMember) return;
        
        currentChatMember.autoActivityEnabled = !currentChatMember.autoActivityEnabled;
        const autoOptions = document.getElementById('bstage-auto-activity-options');
        
        if (currentChatMember.autoActivityEnabled) {
            this.classList.add('active');
            autoOptions.style.display = 'block';
            startAutoActivity(currentChatMember);
            window.showToast('自主活动已开启');
        } else {
            this.classList.remove('active');
            autoOptions.style.display = 'none';
            stopAutoActivity(currentChatMember);
            window.showToast('自主活动已关闭');
        }
        saveBstageData();
    });

    document.getElementById('bstage-auto-activity-interval').addEventListener('change', function() {
        if (!currentChatMember) return;
        let val = parseInt(this.value, 10);
        if (isNaN(val) || val < 5) val = 5; // minimum 5s
        this.value = val;
        currentChatMember.autoActivityInterval = val;
        
        if (currentChatMember.autoActivityEnabled) {
            startAutoActivity(currentChatMember); // restart interval
        }
        saveBstageData();
    });
    
    document.getElementById('bstage-auto-activity-preset').addEventListener('change', function() {
        if (!currentChatMember) return;
        currentChatMember.autoActivityPresetId = this.value;
        saveBstageData();
    });

    document.getElementById('bstage-global-settings-btn').addEventListener('click', () => {
        renderPresetList();
        window.openView(globalSettingsModal);
    });

    // 全局 CSS 预设管理逻辑
    document.querySelectorAll('.bstage-preset-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.bstage-preset-tab').forEach(t => {
                t.classList.remove('active');
                t.style.background = '#2c2c2e';
                t.style.color = '#fff';
            });
            e.target.classList.add('active');
            e.target.style.background = '#fff';
            e.target.style.color = '#000';
            
            currentPresetTab = e.target.getAttribute('data-type');
            renderPresetList();
        });
    });

    document.getElementById('bstage-save-preset-btn').addEventListener('click', () => {
        const nameInput = document.getElementById('bstage-preset-name-input');
        const cssInput = document.getElementById('bstage-preset-css-input');
        const name = nameInput.value.trim();
        const css = cssInput.value.trim();

        if (!name || !css) {
            window.showToast('请输入预设名称和 CSS 代码');
            return;
        }

        const newPreset = {
            id: 'preset_' + Date.now(),
            name: name,
            css: css
        };

        if (!bstagePresets[currentPresetTab]) {
            bstagePresets[currentPresetTab] = [];
        }
        
        bstagePresets[currentPresetTab].push(newPreset);
        saveBstageData();
        renderPresetList();
        
        nameInput.value = '';
        cssInput.value = '';
        window.showToast('预设已保存');
    });

    function renderPresetList() {
        const container = document.getElementById('bstage-preset-list');
        container.innerHTML = '';
        const list = bstagePresets[currentPresetTab] || [];

        if (list.length === 0) {
            container.innerHTML = '<div style="color: #888; text-align: center; padding: 10px;">暂无预设</div>';
            return;
        }

        list.forEach(preset => {
            const item = document.createElement('div');
            item.style.cssText = 'background: #2c2c2e; padding: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;';
            item.innerHTML = `
                <div style="flex: 1; overflow: hidden;">
                    <div style="color: #fff; font-weight: bold; margin-bottom: 4px;">${preset.name}</div>
                    <div style="color: #aaa; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${preset.css}</div>
                </div>
                <div class="bstage-preset-del-btn" style="color: #ff3b30; padding: 5px; cursor: pointer;"><i class="fas fa-trash"></i></div>
            `;

            item.querySelector('.bstage-preset-del-btn').addEventListener('click', () => {
                bstagePresets[currentPresetTab] = bstagePresets[currentPresetTab].filter(p => p.id !== preset.id);
                saveBstageData();
                renderPresetList();
            });

            container.appendChild(item);
        });
    }

    function populateCssSelects() {
        const chatSelect = document.getElementById('bstage-chat-css-select');
        const frameSelect = document.getElementById('bstage-frame-css-select');
        const bubbleSelect = document.getElementById('bstage-bubble-css-select');

        // Populate Chat CSS Select
        chatSelect.innerHTML = '<option value="">默认</option>';
        (bstagePresets.chatCss || []).forEach(p => {
            chatSelect.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        });
        if (currentChatMember && currentChatMember.chatCssId) {
            chatSelect.value = currentChatMember.chatCssId;
        }

        // Populate Frame CSS Select
        frameSelect.innerHTML = '<option value="">默认</option>';
        (bstagePresets.avatarFrameCss || []).forEach(p => {
            frameSelect.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        });
        if (currentChatMember && currentChatMember.frameCssId) {
            frameSelect.value = currentChatMember.frameCssId;
        }

        // Populate Bubble CSS Select
        bubbleSelect.innerHTML = '<option value="">默认</option>';
        (bstagePresets.bubbleCss || []).forEach(p => {
            bubbleSelect.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        });
        if (currentChatMember && currentChatMember.bubbleCssId) {
            bubbleSelect.value = currentChatMember.bubbleCssId;
        }
    }

    function populateFanCssSelects() {
        const chatSelect = document.getElementById('bstage-fan-chat-css-select');
        const bubbleSelect = document.getElementById('bstage-fan-bubble-css-select');
        if (!chatSelect || !bubbleSelect) return;

        chatSelect.innerHTML = '<option value="">默认</option>';
        (bstagePresets.chatCss || []).forEach(p => {
            chatSelect.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        });
        chatSelect.value = bstageFanChatSettings.chatCssId || '';

        bubbleSelect.innerHTML = '<option value="">默认</option>';
        (bstagePresets.bubbleCss || []).forEach(p => {
            bubbleSelect.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        });
        bubbleSelect.value = bstageFanChatSettings.bubbleCssId || '';
    }

    // Select Change Listeners
    document.getElementById('bstage-chat-css-select').addEventListener('change', (e) => {
        if (!currentChatMember) return;
        currentChatMember.chatCssId = e.target.value;
        applyDynamicStyles();
        saveBstageData();
    });

    document.getElementById('bstage-frame-css-select').addEventListener('change', (e) => {
        if (!currentChatMember) return;
        currentChatMember.frameCssId = e.target.value;
        applyDynamicStyles();
        saveBstageData();
    });

    document.getElementById('bstage-bubble-css-select').addEventListener('change', (e) => {
        if (!currentChatMember) return;
        currentChatMember.bubbleCssId = e.target.value;
        applyDynamicStyles();
        saveBstageData();
    });

    document.getElementById('bstage-fan-chat-css-select').addEventListener('change', (e) => {
        bstageFanChatSettings.chatCssId = e.target.value;
        applyFanChatSettings();
        saveBstageData();
    });

    document.getElementById('bstage-fan-bubble-css-select').addEventListener('change', (e) => {
        bstageFanChatSettings.bubbleCssId = e.target.value;
        applyFanChatSettings();
        saveBstageData();
    });

    function applyDynamicStyles() {
        let styleTag = document.getElementById('bstage-dynamic-styles');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'bstage-dynamic-styles';
            document.head.appendChild(styleTag);
        }

        let combinedCss = '';

        // 1. Char Chat CSS
        if (currentChatMember && currentChatMember.chatCssId) {
            const preset = (bstagePresets.chatCss || []).find(p => p.id === currentChatMember.chatCssId);
            if (preset) {
                combinedCss += `
                    #bstage-chat-view {
                        ${preset.css}
                    }
                `;
            }
        }

        // 2. Char Frame CSS
        if (currentChatMember && currentChatMember.frameCssId) {
            const preset = (bstagePresets.avatarFrameCss || []).find(p => p.id === currentChatMember.frameCssId);
            if (preset) {
                combinedCss += `
                    #bstage-chat-view .bstage-chat-msg.income img {
                        ${preset.css}
                    }
                    #bstage-detail-avatar {
                        ${preset.css}
                    }
                `;
            }
        }

        // 3. Char Bubble CSS
        if (currentChatMember && currentChatMember.bubbleCssId) {
            const preset = (bstagePresets.bubbleCss || []).find(p => p.id === currentChatMember.bubbleCssId);
            if (preset) {
                combinedCss += `
                    #bstage-chat-view .bstage-chat-bubble {
                        ${preset.css}
                    }
                `;
            }
        }

        // 4. Fan Chat CSS
        if (bstageFanChatSettings.chatCssId) {
            const preset = (bstagePresets.chatCss || []).find(p => p.id === bstageFanChatSettings.chatCssId);
            if (preset) {
                combinedCss += `
                    #bstage-fan-chat-view {
                        ${preset.css}
                    }
                `;
            }
        }

        // 5. Fan Bubble CSS
        if (bstageFanChatSettings.bubbleCssId) {
            const preset = (bstagePresets.bubbleCss || []).find(p => p.id === bstageFanChatSettings.bubbleCssId);
            if (preset) {
                combinedCss += `
                    #bstage-fan-chat-view .bstage-chat-bubble {
                        ${preset.css}
                    }
                `;
            }
        }

        styleTag.textContent = combinedCss;
    }

    // Context Setting Logic
    document.getElementById('bstage-context-switch').addEventListener('click', function() {
        isContextEnabled = !isContextEnabled;
        if (isContextEnabled) this.classList.add('active');
        else this.classList.remove('active');
        const fanContextSwitch = document.getElementById('bstage-fan-context-switch');
        if (fanContextSwitch) fanContextSwitch.classList.toggle('active', isContextEnabled);
        saveBstageData();
        window.showToast(`上下文携带已${isContextEnabled ? '开启' : '关闭'}`);
    });

    document.getElementById('bstage-context-count').addEventListener('change', function() {
        let val = parseInt(this.value, 10);
        if (isNaN(val) || val < 1) val = 1;
        contextMessageCount = val;
        this.value = val;
        const fanContextCount = document.getElementById('bstage-fan-context-count');
        if (fanContextCount) fanContextCount.value = val;
        saveBstageData();
    });

    document.getElementById('bstage-fan-context-switch').addEventListener('click', function() {
        isContextEnabled = !isContextEnabled;
        if (isContextEnabled) this.classList.add('active');
        else this.classList.remove('active');
        const charContextSwitch = document.getElementById('bstage-context-switch');
        if (charContextSwitch) charContextSwitch.classList.toggle('active', isContextEnabled);
        saveBstageData();
        window.showToast(`上下文携带已${isContextEnabled ? '开启' : '关闭'}`);
    });

    document.getElementById('bstage-fan-context-count').addEventListener('change', function() {
        let val = parseInt(this.value, 10);
        if (isNaN(val) || val < 1) val = 1;
        contextMessageCount = val;
        this.value = val;
        const charContextCount = document.getElementById('bstage-context-count');
        if (charContextCount) charContextCount.value = val;
        saveBstageData();
    });

    // Clear Chat / Exit Logic
    const chatClearBtn = document.getElementById('bstage-chat-clear-btn');
    if (chatClearBtn) {
        chatClearBtn.addEventListener('click', () => {
            if (!currentChatMember) return;
            if (confirm(`确定要清空与 ${currentChatMember.name} 的聊天记录吗？此操作不可恢复。`)) {
                currentChatMember.chatHistory = [];
                saveBstageData();
                
                const content = document.getElementById('bstage-chat-content');
                if (content) {
                    content.innerHTML = '<div style="text-align:center; color:#666; padding:20px; font-size:13px;">聊天记录已清空</div>';
                }
                
                window.showToast('聊天记录已清空');
                window.closeView(chatDetailSheet);
            }
        });
    }

    const chatExitBtn = document.getElementById('bstage-chat-exit-btn');
    if (chatExitBtn) {
        chatExitBtn.addEventListener('click', () => {
            if (!currentChatMember) return;
            if (confirm(`确定要清空与 ${currentChatMember.name} 的聊天记录吗？此操作不可恢复。`)) {
                currentChatMember.chatHistory = [];
                saveBstageData();
                
                const content = document.getElementById('bstage-chat-content');
                if (content) {
                    content.innerHTML = '<div style="text-align:center; color:#666; padding:20px; font-size:13px;">聊天记录已清空</div>';
                }
                
                window.showToast('聊天记录已清空');
                window.closeView(chatDetailSheet);
            }
        });
    }

    // Translation Switch Logic
    document.getElementById('bstage-trans-switch').addEventListener('click', function() {
        isTranslationEnabled = !isTranslationEnabled;
        if (isTranslationEnabled) this.classList.add('active');
        else this.classList.remove('active');
        
        // Toggle Global Translation Visibility
        const content = document.getElementById('bstage-chat-content');
        if (content) {
            if (isTranslationEnabled) content.classList.add('show-trans');
            else content.classList.remove('show-trans');
        }
        syncFanChatTranslationState();
        const fanSwitchEl = document.getElementById('bstage-fan-trans-switch');
        if (fanSwitchEl) fanSwitchEl.classList.toggle('active', isTranslationEnabled);

        saveBstageData();
        window.showToast(`实时翻译已${isTranslationEnabled ? '开启' : '关闭'}`);
    });

    document.getElementById('bstage-fan-trans-switch').addEventListener('click', function() {
        isTranslationEnabled = !isTranslationEnabled;
        if (isTranslationEnabled) this.classList.add('active');
        else this.classList.remove('active');

        const charContent = document.getElementById('bstage-chat-content');
        if (charContent) {
            if (isTranslationEnabled) charContent.classList.add('show-trans');
            else charContent.classList.remove('show-trans');
        }
        syncFanChatTranslationState();
        const charSwitchEl = document.getElementById('bstage-trans-switch');
        if (charSwitchEl) charSwitchEl.classList.toggle('active', isTranslationEnabled);

        saveBstageData();
        window.showToast(`实时翻译已${isTranslationEnabled ? '开启' : '关闭'}`);
    });

    document.getElementById('bstage-other-fans-switch').addEventListener('click', function() {
        if (!currentChatMember) return;
        currentChatMember.otherFansEnabled = !currentChatMember.otherFansEnabled;
        this.classList.toggle('active', !!currentChatMember.otherFansEnabled);
        saveBstageData();
        window.showToast(`查看其他人消息已${currentChatMember.otherFansEnabled ? '开启' : '关闭'}`);
    });


    // Click outside to close modals
    [searchGenerateModal, generateTypeSheet, createTeamSheet, addCharSheet, pullFriendSheet, subModal, popSubModal, userProfileModal, ordersModal, editProfileModal, editTeamSheet, chatDetailSheet, fanChatDetailSheet, lockerModal, videoDetailModal, editVideoSheet, shopDetailModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                window.closeView(modal);
            }
        });
    });

    // --- Chat Settings Logic ---
    
    // Nickname Setting
    document.getElementById('bstage-setting-nickname').addEventListener('click', () => {
        if (!currentChatMember) return;
        
        // Simple prompt for now, could be a modal
        /* 
           Using window.prompt is simplest but blocks execution. 
           Given the constraints, I'll use it for simplicity unless a dedicated modal is preferred. 
           Let's use a prompt for "昵称设置".
        */
        const newName = prompt('请输入新的备注名:', currentChatMember.name);
        if (newName && newName.trim() !== '') {
            currentChatMember.name = newName.trim();
            // Update UI
            document.getElementById('bstage-detail-name').textContent = currentChatMember.name;
            document.getElementById('bstage-chat-name').textContent = currentChatMember.name;
            window.showToast('备注已修改');
            
            // Refresh Pop List if visible
            if (currentTeam) renderTeamPop(currentTeam);
        }
    });

    // Background Setting
    document.getElementById('bstage-setting-bg').addEventListener('click', () => {
        document.getElementById('bstage-chat-bg-input').click();
    });

    document.getElementById('bstage-reset-bg-btn').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering file input
        const chatView = document.getElementById('bstage-chat-view');
        chatView.style.backgroundImage = 'none';
        if (currentChatMember) {
            currentChatMember.chatBg = null;
        }
        window.showToast('背景已重置');
    });

    document.getElementById('bstage-chat-bg-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const bgUrl = e.target.result;
                // Apply to Chat View
                const chatView = document.getElementById('bstage-chat-view');
                chatView.style.backgroundImage = `url('${bgUrl}')`;
                chatView.style.backgroundSize = 'cover';
                chatView.style.backgroundPosition = 'center';
                
                // Store in member data if persistence is needed (optional)
                if (currentChatMember) {
                    currentChatMember.chatBg = bgUrl;
                }
                
                window.showToast('背景已更换');
                window.closeView(chatDetailSheet);
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('bstage-fan-setting-bg').addEventListener('click', () => {
        document.getElementById('bstage-fan-chat-bg-input').click();
    });

    document.getElementById('bstage-fan-reset-bg-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        bstageFanChatSettings.chatBg = null;
        applyFanChatSettings();
        saveBstageData();
        window.showToast('背景已重置');
    });

    document.getElementById('bstage-fan-chat-bg-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
            bstageFanChatSettings.chatBg = readerEvent.target.result;
            applyFanChatSettings();
            saveBstageData();
            window.showToast('背景已更换');
            window.closeView(fanChatDetailSheet);
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('bstage-fan-chat-clear-btn').addEventListener('click', () => {
        if (!confirm('确定要清空粉丝聊天室记录吗？此操作不可恢复。')) return;
        bstageFanChatHistory = [];
        renderFanChatHistory();
        updateFanSubscriberLabels();
        saveBstageData();
        window.showToast('粉丝聊天室已清空');
        window.closeView(fanChatDetailSheet);
    });

    // Locker Logic
    document.getElementById('bstage-locker-see-all-btn').addEventListener('click', () => {
        renderLockerGrid();
        window.openView(lockerModal);
    });

    function renderLockerGrid() {
        const grid = document.getElementById('bstage-locker-grid');
        grid.innerHTML = '';
        
        chatPhotos.forEach(url => {
            const item = document.createElement('div');
            item.className = 'bstage-locker-item';
            item.innerHTML = `<img src="${url}">`;
            item.title = '查看图片详情';
            item.addEventListener('click', () => {
                openBstageImagePreview(url, '置物柜照片');
            });
            grid.appendChild(item);
        });

        // Add Button
        const addBtn = document.createElement('div');
        addBtn.className = 'bstage-locker-item add-btn';
        addBtn.innerHTML = `
            <i class="fas fa-plus"></i>
            <input type="file" accept="image/*" style="display:none;">
        `;
        addBtn.addEventListener('click', () => {
            addBtn.querySelector('input').click();
        });
        addBtn.querySelector('input').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    chatPhotos.push(e.target.result);
                    renderLockerGrid();
                    renderLockerPreview(); // Update detail sheet preview
                };
                reader.readAsDataURL(file);
            }
        });
        grid.appendChild(addBtn);
    }

    function renderLockerPreview() {
        const container = document.getElementById('bstage-locker-preview-list');
        container.innerHTML = '';
        // Show first 4
        chatPhotos.slice(0, 4).forEach(url => {
            const item = document.createElement('div');
            item.style.cssText = 'width: 70px; height: 70px; border-radius: 8px; flex-shrink: 0; overflow: hidden; position: relative; cursor: pointer;';
            item.innerHTML = `<img src="${url}" style="width: 100%; height: 100%; object-fit: cover;">`;
            item.title = '查看图片详情';
            item.addEventListener('click', () => {
                openBstageImagePreview(url, '置物柜照片');
            });
            container.appendChild(item);
        });
        
        // Fill empty slots if less than 4 (optional, or just leave empty)
        if (chatPhotos.length === 0) {
            container.innerHTML = '<div style="color: #888; font-size: 13px; padding: 10px 0;">暂无照片</div>';
        }
    }

    // Create Team Logic
    const createBtn = document.getElementById('bstage-create-team-btn');
    createBtn.addEventListener('click', () => {
        isEditingTeam = false;
        // Reset form
        document.getElementById('bstage-team-name-input').value = '';
        const descInput = document.getElementById('bstage-team-desc-input');
        if(descInput) descInput.value = '';
        
        document.getElementById('bstage-team-avatar-preview').src = '';
        document.getElementById('bstage-team-avatar-preview').style.display = 'none';
        document.getElementById('bstage-team-bg-preview').src = '';
        document.getElementById('bstage-team-bg-preview').style.display = 'none';
        tempMembers = [];
        renderTempMembers();
        window.openView(createTeamSheet);
    });

    function clampSearchMemberCount(value) {
        const parsed = parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 1) return 1;
        if (parsed > 12) return 12;
        return parsed;
    }

    function setSearchGenerateLoading(isLoading) {
        const confirmBtn = document.getElementById('bstage-search-confirm-btn');
        const loading = document.getElementById('bstage-search-loading');
        const queryInput = document.getElementById('bstage-search-query-input');
        const countInput = document.getElementById('bstage-search-member-count');
        if (confirmBtn) {
            confirmBtn.classList.toggle('is-loading', isLoading);
            confirmBtn.textContent = isLoading ? '生成中...' : '生成团队';
        }
        if (loading) loading.style.display = isLoading ? 'flex' : 'none';
        if (queryInput) queryInput.readOnly = isLoading;
        if (countInput) countInput.readOnly = isLoading;
    }

    function openSearchGenerateModal() {
        const queryInput = document.getElementById('bstage-search-query-input');
        const countInput = document.getElementById('bstage-search-member-count');
        if (queryInput) queryInput.value = '';
        if (countInput) countInput.value = '1';
        setSearchGenerateLoading(false);
        window.openView(searchGenerateModal);
        setTimeout(() => {
            if (queryInput) queryInput.focus({ preventScroll: true });
        }, 80);
    }

    async function generateTeamFromSearch(query, memberCount) {
        const searchQuery = String(query || '').trim();
        const isRandom = !searchQuery;
        const generationIntent = isRandom
            ? '用户没有填写搜索内容。请随机生成一个虚构的 b.stage 团队或明星企划，可以自由选择风格、国家地区、成员定位和团队概念。'
            : `用户填写的搜索内容是「${searchQuery}」。必须围绕这个内容生成，团队名、团队信息、成员名字、成员人设都要明显贴合该内容，禁止忽略搜索内容或生成无关的随机团队。`;
        const prompt = `
请生成一个适合 b.stage 的虚构团队或明星企划。

${generationIntent}
团队人数：${memberCount}

要求：
1. 只返回严格 JSON 对象，不要 markdown，不要解释。
2. members 数组长度必须严格等于 ${memberCount}。
3. name 是团队名或艺名，desc 是团队/明星信息。
4. 每个成员必须包含 name 和 role，role 是可供 AI 扮演使用的人设。
5. ${isRandom ? '因为用户留空，本次可以随机发挥，但仍要保持团队设定完整、统一。' : '因为用户填写了搜索内容，本次不允许随机偏题，所有核心设定必须服务于该搜索内容。'}

格式：
{
  "name": "团队名",
  "desc": "团队信息",
  "members": [
    { "name": "成员名", "role": "成员人设" }
  ]
}
`;

        const generated = await callBstageJsonApi(prompt, 'You generate strict JSON for fictional idol/team profiles.', 0.8);
        if (!generated || typeof generated !== 'object' || Array.isArray(generated)) {
            throw new Error('invalid_team_payload');
        }

        const teamName = stripGeneratedText(generated.name);
        const desc = stripGeneratedText(generated.desc || generated.info || generated.description);
        const members = Array.isArray(generated.members) ? generated.members : [];
        if (!teamName || !desc || members.length !== memberCount) {
            throw new Error('invalid_team_payload');
        }

        const normalizedMembers = members.map((member, index) => {
            const name = stripGeneratedText(member && member.name, `成员${index + 1}`);
            const role = stripGeneratedText(member && (member.role || member.persona || member.desc));
            if (!name || !role) throw new Error('invalid_member_payload');
            const seed = createImageSeed(`bstage-member-${teamName}-${name}-${index}`);
            return {
                id: Date.now() + index + Math.random(),
                name,
                role,
                avatar: null,
                avatarEmoji: getStableEmojiAvatar(seed),
                isSubscribed: false,
                subStartDate: null
            };
        });

        const teamSeed = createImageSeed(`bstage-team-${teamName}`);
        return {
            id: Date.now(),
            name: teamName,
            desc,
            avatar: null,
            avatarEmoji: getStableEmojiAvatar(`${teamSeed}-avatar`),
            bg: createExternalBackground(`${teamSeed}-bg`),
            members: normalizedMembers,
            isSubscribed: false
        };
    }

    async function confirmSearchGenerate() {
        const confirmBtn = document.getElementById('bstage-search-confirm-btn');
        if (confirmBtn && confirmBtn.classList.contains('is-loading')) return;

        const queryInput = document.getElementById('bstage-search-query-input');
        const countInput = document.getElementById('bstage-search-member-count');
        const query = queryInput ? queryInput.value.trim() : '';
        const memberCount = clampSearchMemberCount(countInput ? countInput.value : 1);
        if (countInput) countInput.value = String(memberCount);

        setSearchGenerateLoading(true);
        try {
            const generatedTeam = await generateTeamFromSearch(query, memberCount);
            teams.push(generatedTeam);
            saveBstageData();
            renderFollowingBar();
            window.closeView(searchGenerateModal);
            openTeam(generatedTeam);
            window.showToast('团队已生成');
        } catch (error) {
            console.error('Bstage search generate failed:', error);
            if (error && error.message === 'missing_api_config') {
                window.showToast('请先在系统设置中配置 API');
            } else if (error && /member|payload/.test(error.message || '')) {
                window.showToast('生成结果格式或人数不匹配');
            } else {
                window.showToast('生成团队失败');
            }
        } finally {
            setSearchGenerateLoading(false);
        }
    }

    document.getElementById('bstage-search-generate-btn').addEventListener('click', openSearchGenerateModal);
    bindBstageFocusPreservingAction(document.getElementById('bstage-search-confirm-btn'), confirmSearchGenerate);
    ['bstage-search-query-input', 'bstage-search-member-count'].forEach(inputId => {
        const input = document.getElementById(inputId);
        if (!input) return;
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
                e.preventDefault();
                confirmSearchGenerate();
            }
        });
    });

    // File Upload Helpers
    function setupFileUpload(triggerId, inputQuery, previewId) {
        const trigger = document.getElementById(triggerId);
        const input = trigger.querySelector('input');
        const preview = document.getElementById(previewId);

        if (!trigger || !input) return;

        trigger.addEventListener('click', () => input.click());
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (preview) {
                        preview.src = e.target.result;
                        preview.style.display = 'block';
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    setupFileUpload('bstage-team-avatar-upload', 'input', 'bstage-team-avatar-preview');
    setupFileUpload('bstage-team-bg-upload', 'input', 'bstage-team-bg-preview');
    setupFileUpload('bstage-char-avatar-upload', 'input', 'bstage-char-avatar-preview');
    setupFileUpload('bstage-edit-team-avatar-upload', 'input', 'bstage-edit-team-avatar-preview');
    setupFileUpload('bstage-edit-team-bg-upload', 'input', 'bstage-edit-team-bg-preview');
    setupFileUpload('bstage-edit-video-cover-upload', 'input', 'bstage-edit-video-cover-preview');

    // Pull Friend Flow
    const handlePullFriend = async () => {
        const listContainer = document.getElementById('bstage-friend-list');
        listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#aaa;">加载中...</div>';
        window.openView(pullFriendSheet);

        try {
            // Retrieve friends from u2's storage
            let friends = [];
            if (window.imStorage && window.imStorage.loadFriends) {
                friends = await window.imStorage.loadFriends();
            } else if (window.getAppState) {
                const data = window.getAppState('imessage');
                if (data && data.friends) friends = data.friends;
            }

            // Filter friends: only include char type
            const validFriends = friends.filter(f => {
                if (!f) return false;
                return f.type === 'char';
            });

            if (validFriends.length === 0) {
                listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#aaa;">暂无可拉取的好友</div>';
                return;
            }

            listContainer.innerHTML = '';
            validFriends.forEach(f => {
                const item = document.createElement('div');
                item.className = 'bstage-friend-item';
                item.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 12px; background-color: #2c2c2e; border-radius: 12px; cursor: pointer;';
                
                const avatarUrl = f.avatar || (f.avatarDataUrl ? f.avatarDataUrl : '');
                const displayName = f.realName || f.originalName || f.name || '';
                const avatarHtml = avatarUrl ? 
                    `<img src="${avatarUrl}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` :
                    `<div style="width: 40px; height: 40px; border-radius: 50%; background-color: #444; display: flex; justify-content: center; align-items: center; color: #fff;">${displayName ? displayName[0] : 'U'}</div>`;
                const persona = f.persona || f.signature || f.desc || f.role || '';

                item.innerHTML = `
                    ${avatarHtml}
                    <div style="flex: 1; overflow: hidden;">
                        <div style="font-size: 16px; color: #fff; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${displayName}</div>
                        <div style="font-size: 13px; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${persona}</div>
                    </div>
                    <i class="fas fa-plus-circle" style="color: #007aff; font-size: 20px;"></i>
                `;

                item.addEventListener('click', () => {
                    // Populate addCharSheet with pulled friend data instead of directly adding
                    currentEditingMember = null; // We are creating a new one based on pulled data
                    
                    document.getElementById('bstage-char-name-input').value = displayName;
                    document.getElementById('bstage-char-role-input').value = persona;
                    
                    const preview = document.getElementById('bstage-char-avatar-preview');
                    if (avatarUrl) {
                        preview.src = avatarUrl;
                        preview.style.display = 'block';
                    } else {
                        preview.src = '';
                        preview.style.display = 'none';
                    }
                    
                    const title = document.querySelector('#bstage-add-char-sheet .sheet-title');
                    if(title) title.textContent = '确认成员信息';
                    
                    const btn = document.getElementById('bstage-confirm-add-char-btn');
                    if(btn) btn.textContent = '添加';
                    
                    window.closeView(pullFriendSheet);
                    window.openView(addCharSheet);
                });

                listContainer.appendChild(item);
            });
        } catch (e) {
            console.error('Failed to pull friends', e);
            listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#ff3b30;">拉取好友失败</div>';
        }
    };

    document.getElementById('bstage-pull-friend-btn').addEventListener('click', handlePullFriend);

    // Add Member Flow
    document.getElementById('bstage-add-char-btn').addEventListener('click', () => {
        currentEditingMember = null;
        document.getElementById('bstage-char-name-input').value = '';
        document.getElementById('bstage-char-role-input').value = '';
        document.getElementById('bstage-char-avatar-preview').style.display = 'none';
        
        const title = document.querySelector('#bstage-add-char-sheet .sheet-title');
        if(title) title.textContent = '添加成员';
        const btn = document.getElementById('bstage-confirm-add-char-btn');
        if(btn) btn.textContent = '添加';

        window.openView(addCharSheet);
    });

    document.getElementById('bstage-confirm-add-char-btn').addEventListener('click', () => {
        const name = document.getElementById('bstage-char-name-input').value;
        const role = document.getElementById('bstage-char-role-input').value;
        const avatar = document.getElementById('bstage-char-avatar-preview').src;
        const hasAvatar = document.getElementById('bstage-char-avatar-preview').style.display !== 'none';
        
        if (name) {
            if (currentEditingMember) {
                // Edit existing
                currentEditingMember.name = name;
                currentEditingMember.role = role;
                currentEditingMember.avatar = hasAvatar ? avatar : null;
                currentEditingMember.avatarEmoji = hasAvatar ? null : (currentEditingMember.avatarEmoji || getStableEmojiAvatar(`member-${currentEditingMember.id || name}`));

                if (isEditingTeam && currentTeam) {
                    renderEditTeamMembers();
                    saveBstageData();
                     // Update Pop View if needed
                    if (document.querySelector('.bstage-nav-item[data-tab="pop"]').classList.contains('active')) {
                        renderTeamPop(currentTeam);
                    }
                } else {
                    // Update Temp Members during creation
                    renderTempMembers();
                }
                window.showToast(`已更新成员: ${name}`);
                currentEditingMember = null;
            } else {
                // Add new
                const newChar = {
                    id: Date.now(),
                    name,
                    role,
                    avatar: hasAvatar ? avatar : null,
                    avatarEmoji: hasAvatar ? null : getStableEmojiAvatar(`member-${name}-${Date.now()}`),
                    isSubscribed: false,
                    subStartDate: null
                };

                if (isEditingTeam && currentTeam) {
                    currentTeam.members.push(newChar);
                    renderEditTeamMembers();
                    saveBstageData();
                    if (document.querySelector('.bstage-nav-item[data-tab="pop"]').classList.contains('active')) {
                        renderTeamPop(currentTeam);
                    }
                    window.showToast(`已添加成员: ${name}`);
                } else {
                    tempMembers.push(newChar);
                    renderTempMembers();
                }
            }
            window.closeView(addCharSheet);
        }
    });

    function renderTempMembers() {
        const container = document.getElementById('bstage-chars-preview-list');
        container.innerHTML = '';
        tempMembers.forEach(m => {
            const item = document.createElement('div');
            item.className = 'bstage-char-preview-item';
            item.style.cursor = 'pointer'; // Make it look clickable
            item.innerHTML = `
                ${renderBstageAvatar(m, m.name, 'bstage-char-preview-avatar')}
                <div class="bstage-char-preview-name">${escapeHtml(m.name)}</div>
            `;
            
            // Add click listener to edit temp member
            item.addEventListener('click', () => {
                currentEditingMember = m;
                document.getElementById('bstage-char-name-input').value = m.name;
                document.getElementById('bstage-char-role-input').value = m.role || '';
                const preview = document.getElementById('bstage-char-avatar-preview');
                if (m.avatar) {
                    preview.src = m.avatar;
                    preview.style.display = 'block';
                } else {
                    preview.src = '';
                    preview.style.display = 'none';
                }
                
                const title = document.querySelector('#bstage-add-char-sheet .sheet-title');
                if(title) title.textContent = '编辑成员';
                
                const btn = document.getElementById('bstage-confirm-add-char-btn');
                if(btn) btn.textContent = '保存';
                
                window.openView(addCharSheet);
            });

            container.appendChild(item);
        });
    }

    // Confirm Create Team
    document.getElementById('bstage-confirm-create-btn').addEventListener('click', () => {
        const name = document.getElementById('bstage-team-name-input').value;
        const descInput = document.getElementById('bstage-team-desc-input');
        const desc = descInput ? descInput.value : '';
        const avatar = document.getElementById('bstage-team-avatar-preview').src;
        const hasAvatar = document.getElementById('bstage-team-avatar-preview').style.display !== 'none';
        const bg = document.getElementById('bstage-team-bg-preview').src;
        const hasBg = document.getElementById('bstage-team-bg-preview').style.display !== 'none';

        if (!name) {
            window.showToast('请输入团队名称');
            return;
        }

        const newTeam = {
            id: Date.now(),
            name,
            desc,
            avatar: hasAvatar ? avatar : null,
            avatarEmoji: hasAvatar ? null : getStableEmojiAvatar(`team-${name}-${Date.now()}`),
            bg: hasBg ? bg : null,
            members: [...tempMembers],
            isSubscribed: false
        };
        teams.push(newTeam);
        saveBstageData(); // Explicitly save to ensure persistence
        renderFollowingBar();
        window.closeView(createTeamSheet);
        
        // Auto open the new team
        openTeam(newTeam);
    });

    function renderFollowingBar() {
        const container = document.getElementById('bstage-following-bar');
        // Keep the create button, remove others
        const createBtn = container.firstElementChild;
        container.innerHTML = '';
        container.appendChild(createBtn);

        [getBstageUserTeam(), ...teams].forEach(team => {
            const item = document.createElement('div');
            item.className = 'bstage-team-item';
            if (currentTeam && currentTeam.id === team.id) item.classList.add('active');
            
            item.innerHTML = `
                <div class="bstage-team-avatar">
                    ${renderBstageAvatarContent(team, team.name)}
                </div>
                <div class="bstage-team-name">${escapeHtml(team.name)}</div>
            `;
            
            item.addEventListener('click', () => {
                if (currentTeam && currentTeam.id === team.id) {
                    openEditTeamModal(team);
                } else {
                    openTeam(team);
                }
            });
            container.appendChild(item);
        });
    }

    function openEditTeamModal(team) {
        if (isUserTeam(team)) team = getBstageUserTeam();
        currentTeam = team;
        isEditingTeam = true;
        editTeamSheet.classList.toggle('bstage-user-team-editing', isUserTeam(team));
        const deleteBtn = document.getElementById('bstage-delete-team-btn');
        if (deleteBtn) deleteBtn.style.display = isUserTeam(team) ? 'none' : '';
        document.getElementById('bstage-edit-team-name-input').value = team.name;
        
        const avatarPreview = document.getElementById('bstage-edit-team-avatar-preview');
        if (team.avatar) {
            avatarPreview.src = team.avatar;
            avatarPreview.style.display = 'block';
            if (avatarPreview.previousElementSibling) avatarPreview.previousElementSibling.style.opacity = '0';
        } else {
            avatarPreview.src = '';
            avatarPreview.style.display = 'none';
            if (avatarPreview.previousElementSibling) avatarPreview.previousElementSibling.style.opacity = '1';
        }

        const bgPreview = document.getElementById('bstage-edit-team-bg-preview');
        if (team.bg) {
            bgPreview.src = team.bg;
            bgPreview.style.display = 'block';
            if (bgPreview.previousElementSibling) bgPreview.previousElementSibling.style.opacity = '0';
        } else {
            bgPreview.src = '';
            bgPreview.style.display = 'none';
            if (bgPreview.previousElementSibling) bgPreview.previousElementSibling.style.opacity = '1';
        }
        
        renderEditTeamMembers();
        
        window.openView(editTeamSheet);
    }

    function renderEditTeamMembers() {
        const container = document.getElementById('bstage-edit-team-members-list');
        if (!container || !currentTeam) return;
        container.innerHTML = '';
        currentTeam.members.forEach(m => {
            const item = document.createElement('div');
            item.className = 'bstage-char-preview-item';
            item.innerHTML = `
                ${renderBstageAvatar(m, m.name, 'bstage-char-preview-avatar')}
                <div class="bstage-char-preview-name">${escapeHtml(m.name)}</div>
            `;
            
            // Add click listener to edit
            item.addEventListener('click', () => {
                if (isUserTeam(currentTeam) && m.isUserMember) return;
                currentEditingMember = m;
                document.getElementById('bstage-char-name-input').value = m.name;
                document.getElementById('bstage-char-role-input').value = m.role || '';
                const preview = document.getElementById('bstage-char-avatar-preview');
                if (m.avatar) {
                    preview.src = m.avatar;
                    preview.style.display = 'block';
                } else {
                    preview.src = '';
                    preview.style.display = 'none';
                }
                
                const title = document.querySelector('#bstage-add-char-sheet .sheet-title');
                if(title) title.textContent = '编辑成员';
                
                const btn = document.getElementById('bstage-confirm-add-char-btn');
                if(btn) btn.textContent = '保存';
                
                window.openView(addCharSheet);
            });

            container.appendChild(item);
        });
    }

    // Bind Add Member btn in Edit Sheet
    document.getElementById('bstage-edit-team-sheet').addEventListener('click', (e) => {
        if (e.target.id === 'bstage-edit-team-add-member-btn') {
            currentEditingMember = null;
            document.getElementById('bstage-char-name-input').value = '';
            document.getElementById('bstage-char-role-input').value = '';
            document.getElementById('bstage-char-avatar-preview').style.display = 'none';
            
            const title = document.querySelector('#bstage-add-char-sheet .sheet-title');
            if(title) title.textContent = '添加成员';
            const btn = document.getElementById('bstage-confirm-add-char-btn');
            if(btn) btn.textContent = '添加';

            window.openView(addCharSheet);
        } else if (e.target.id === 'bstage-edit-team-pull-friend-btn') {
            handlePullFriend();
        }
    });

    document.getElementById('bstage-confirm-edit-team-btn').addEventListener('click', () => {
        if (!currentTeam) return;
        
        const name = document.getElementById('bstage-edit-team-name-input').value;
        const avatar = document.getElementById('bstage-edit-team-avatar-preview').src;
        const hasAvatar = document.getElementById('bstage-edit-team-avatar-preview').style.display !== 'none';
        const bg = document.getElementById('bstage-edit-team-bg-preview').src;
        const hasBg = document.getElementById('bstage-edit-team-bg-preview').style.display !== 'none';

        if (name) {
            if (isUserTeam(currentTeam)) {
                bstageUserTeamState.customName = name;
                bstageUserTeamState.customAvatar = hasAvatar ? avatar : null;
                bstageUserTeamState.customBg = hasBg ? bg : null;
                bstageUserTeamState.avatarEmoji = hasAvatar ? null : (bstageUserTeamState.avatarEmoji || getStableEmojiAvatar(`team-${currentTeam.id || name}`));
                currentTeam = getBstageUserTeam();
            } else {
                currentTeam.name = name;
                currentTeam.avatar = hasAvatar ? avatar : null;
                currentTeam.avatarEmoji = hasAvatar ? null : (currentTeam.avatarEmoji || getStableEmojiAvatar(`team-${currentTeam.id || name}`));
                currentTeam.bg = hasBg ? bg : null;
            }
            
            saveBstageData(); // Explicitly save to ensure persistence
            renderFollowingBar();
            // If home tab is active, re-render it to show new BG/Name
            if (document.querySelector('.bstage-nav-item[data-tab="home"]').classList.contains('active')) {
                renderTeamHome(currentTeam);
            }
            isEditingTeam = false;
            window.closeView(editTeamSheet);
            window.showToast('团队信息已更新');
        }
    });

    document.getElementById('bstage-delete-team-btn').addEventListener('click', () => {
        if (!currentTeam) return;
        if (isUserTeam(currentTeam)) {
            window.showToast('User 团队为固定团队，不能删除');
            return;
        }
        if (confirm('确定要删除这个团队吗？')) {
            teams = teams.filter(t => t.id !== currentTeam.id);
            currentTeam = null;
            saveBstageData(); // Explicitly save to ensure persistence
            renderFollowingBar();
            document.getElementById('bstage-bottom-nav').style.display = 'none';
            document.getElementById('bstage-content-area').innerHTML = `
                <div style="height: 100%; display: flex; justify-content: center; align-items: center; color: #333; font-size: 14px;">
                    请选择或创建一个团队
                </div>
            `;
            isEditingTeam = false;
            window.closeView(editTeamSheet);
            window.showToast('团队已删除');
        }
    });

    // Handle close via outside click or handle
    editTeamSheet.querySelector('.sheet-handle').addEventListener('click', () => { isEditingTeam = false; });

    function openTeam(team) {
        currentTeam = team;
        renderFollowingBar(); // Update active state
        document.getElementById('bstage-bottom-nav').style.display = 'block';
        
        // Render Home Tab by default
        renderTeamHome(team);
        
        // Reset Nav
        document.querySelectorAll('.bstage-nav-item').forEach(el => el.classList.remove('active'));
        const homeTab = document.querySelector('.bstage-nav-item[data-tab="home"]');
        homeTab.classList.add('active');
        if (typeof updateNavIndicator === 'function') {
            // Need slight delay for display block to take effect before calculating rects
            setTimeout(() => updateNavIndicator(homeTab), 10);
        }
    }

    // Render Views
    const contentArea = document.getElementById('bstage-content-area');

    function renderTeamHome(team) {
        const bgStyle = team.bg ? `background-image: url('${team.bg}')` : 'background-color: #111';
        const isFixedUserTeam = isUserTeam(team);
        
        contentArea.innerHTML = `
            <div class="bstage-team-home" style="${bgStyle}">
                <div class="bstage-home-content">
                    <div class="bstage-home-title">${team.name}</div>
                    
                    <div class="bstage-social-icons">
                        <i class="fab fa-instagram bstage-social-icon"></i>
                        <i class="fab fa-twitter bstage-social-icon"></i> <!-- X icon usually fontawesome twitter -->
                        <i class="fab fa-youtube bstage-social-icon"></i>
                        <i class="fab fa-tiktok bstage-social-icon"></i>
                        <i class="fab fa-facebook bstage-social-icon"></i>
                    </div>

                    <div class="bstage-sub-bubble" id="bstage-home-sub-btn">
                        <span>${isFixedUserTeam ? 'User Space' : (team.isSubscribed ? '会员已订阅' : '订阅会员')}</span>
                        <i class="fas fa-chevron-right" style="font-size: 12px;"></i>
                    </div>
                </div>
            </div>
        `;

        if (!isFixedUserTeam) {
            document.getElementById('bstage-home-sub-btn').addEventListener('click', openSubModal);
        }
    }

    function renderTeamPop(team) {
        const isFixedUserTeam = isUserTeam(team);
        const popTeam = isFixedUserTeam ? getBstageUserTeam() : team;
        if (isFixedUserTeam) currentTeam = popTeam;

        contentArea.innerHTML = `
            <div class="bstage-pop-view">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
                    <h2 style="font-size:20px; font-weight:700;">${isFixedUserTeam ? 'User POP' : 'Star'}</h2>
                </div>
                <div class="bstage-pop-list" id="bstage-pop-list-container">
                    <!-- Members -->
                </div>
            </div>
        `;

        const container = document.getElementById('bstage-pop-list-container');
        if (popTeam.members && popTeam.members.length > 0) {
            popTeam.members.forEach(m => {
                const item = document.createElement('div');
                item.className = 'bstage-pop-item';
                const isUserSelfMember = isFixedUserTeam && m.isUserMember;
                
                // Expiry Check
                let isExpired = false;
                let inGracePeriod = false;
                
                if (!isUserSelfMember && m.isSubscribed && m.subExpiryDate) {
                    const now = Date.now();
                    const graceEnd = m.subExpiryDate + (3 * 24 * 60 * 60 * 1000); // 3 days buffer
                    
                    if (now > graceEnd) {
                        // Fully Expired
                        isExpired = true;
                        m.isSubscribed = false;
                        m.subStartDate = null; // Clear days
                        m.subExpiryDate = null;
                        saveBstageData(); // Persist change
                    } else if (now > m.subExpiryDate) {
                        // In Grace Period
                        inGracePeriod = true;
                    }
                }

                // Calculate days
                let daysText = '';
                if (isUserSelfMember) {
                    daysText = getFanSubscriberText();
                } else if (m.isSubscribed && m.subStartDate) {
                    const days = Math.floor((Date.now() - m.subStartDate) / (1000 * 60 * 60 * 24)) + 1;
                    daysText = `已一同 ${days} 天`;
                }

                // Action Button Logic
                let actionHtml = '';
                if (isUserSelfMember) {
                    actionHtml = '<div class="bstage-pop-status">粉丝聊天室 <i class="fas fa-chevron-right"></i></div>';
                } else if (m.isSubscribed) {
                    if (inGracePeriod) {
                        actionHtml = '<div class="bstage-pop-sub-btn renew" style="background-color: #ffcc00; color: #000;">续费(缓冲)</div>';
                    } else {
                        actionHtml = '<div class="bstage-pop-status">订阅中 <i class="fas fa-chevron-right"></i></div>';
                    }
                } else {
                    actionHtml = '<div class="bstage-pop-sub-btn">订阅</div>';
                }
                const roleClass = isUserSelfMember ? 'bstage-pop-role bstage-fan-subscriber-label' : 'bstage-pop-role';

                item.innerHTML = `
                    <div class="bstage-pop-info">
                        ${renderBstageAvatar(m, m.name, 'bstage-pop-avatar')}
                        <div class="bstage-pop-name-wrap">
                            <div class="bstage-pop-name">
                                ${escapeHtml(m.name)} 
                                <i class="fas fa-check-circle bstage-verified-icon"></i>
                            </div>
                            ${daysText ? `<div class="${roleClass}">${daysText}</div>` : ''}
                        </div>
                    </div>
                    <div class="bstage-pop-action">
                        ${actionHtml}
                    </div>
                `;

                // Bind Events
                if (isUserSelfMember) {
                    item.addEventListener('click', openFanChat);
                } else if (m.isSubscribed && !inGracePeriod) {
                    item.addEventListener('click', () => openChat(m));
                } else {
                    // Renew Button (Grace Period)
                    if (m.isSubscribed && inGracePeriod) {
                        const renewBtn = item.querySelector('.renew');
                        if (renewBtn) {
                            renewBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                currentPopSubMember = m;
                                document.getElementById('pop-sub-char-name').textContent = `续订 ${m.name}`;
                                window.openView(popSubModal);
                            });
                        }
                        // Allow chat access during grace period by clicking elsewhere
                        item.addEventListener('click', (e) => {
                            if (e.target !== renewBtn) openChat(m);
                        });
                    } else {
                        // Regular Subscribe (New or Expired)
                        const subBtn = item.querySelector('.bstage-pop-sub-btn');
                        if (subBtn) {
                            subBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                currentPopSubMember = m;
                                document.getElementById('pop-sub-char-name').textContent = `订阅 ${m.name}`;
                                window.openView(popSubModal);
                            });
                        }
                    }
                }

                container.appendChild(item);
            });
        } else {
            container.innerHTML = '<div style="text-align:center; color:#666; padding:20px;">暂无成员</div>';
        }
    }

    // Pop Sub Confirm
    document.getElementById('bstage-confirm-pop-sub-btn').addEventListener('click', () => {
        if (currentPopSubMember) {
            const now = Date.now();
            const oneMonth = 30 * 24 * 60 * 60 * 1000;

            if (currentPopSubMember.isSubscribed && currentPopSubMember.subExpiryDate && now > currentPopSubMember.subExpiryDate) {
                // Renewal during Grace Period
                currentPopSubMember.subExpiryDate += oneMonth; // Extend from previous expiry
                // subStartDate remains unchanged
                window.showToast(`成功续订 ${currentPopSubMember.name}！`);
            } else {
                // New Subscription (or re-sub after full expiry)
                currentPopSubMember.isSubscribed = true;
                currentPopSubMember.subStartDate = now; // Reset start date
                currentPopSubMember.subExpiryDate = now + oneMonth;
                window.showToast(`成功订阅 ${currentPopSubMember.name}！`);
            }
            
            // Add Order
            const priceEl = popSubModal.querySelector('.selected .bstage-price-amount');
            bstageOrders.unshift({
                id: Date.now(),
                title: `订阅 ${currentPopSubMember.name}`,
                price: priceEl ? priceEl.textContent : '₩4,500 / 月',
                date: new Date().toLocaleDateString(),
                type: 'POP'
            });

            if (currentTeam) renderTeamPop(currentTeam);
            saveBstageData();
            window.showToast(`成功订阅 ${currentPopSubMember.name}！`);
            window.closeView(popSubModal);
        }
    });

    function appendCharChatMessage(member, msg, contentContainer) {
        if (!member || !msg || !contentContainer) return;

        if (msg.type === 'date') {
            const dateDiv = document.createElement('div');
            dateDiv.className = 'bstage-chat-date';
            dateDiv.textContent = msg.text;
            contentContainer.appendChild(dateDiv);
            return;
        }

        if (msg.type === 'fan_batch') {
            normalizeFanBatchMessage(msg);
            const trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.className = 'bstage-other-fans-trigger';
            const count = Array.isArray(msg.fanMessages) ? msg.fanMessages.length : 0;
            trigger.innerHTML = `<i class="fas fa-comments"></i><span>查看其他人的消息${count ? `（${count}）` : ''}</span>`;
            trigger.addEventListener('click', () => openOtherFansModal(member, msg));
            contentContainer.appendChild(trigger);
            return;
        }

        ensureMessageId(msg, msg.isUser ? 'user' : 'char');

        if (msg.isUser) {
            const msgDiv = document.createElement('div');
            msgDiv.className = 'bstage-chat-msg outgoing';
            msgDiv.dataset.msgId = msg.id;
            msgDiv.innerHTML = `
                <div class="bstage-msg-status">
                    <div class="bstage-msg-status-text">${escapeHtml(msg.status || '已读')}</div>
                    <div class="bstage-msg-time">${escapeHtml(msg.time || getCurrentChatTimeText(msg.timestamp))}</div>
                </div>
                <div class="bstage-chat-bubble">
                    ${renderReplyQuote(msg.replyTo)}
                    <div class="bstage-msg-text">${escapeHtml(msg.text)}</div>
                </div>
            `;
            contentContainer.appendChild(msgDiv);
            return;
        }

        const replyDiv = document.createElement('div');
        replyDiv.className = 'bstage-chat-msg income';
        replyDiv.dataset.msgId = msg.id;

        let bubbleContent = '';
        if (msg.type === 'image') {
            bubbleContent = `
                ${renderReplyQuote(msg.replyTo)}
                <div class="bstage-msg-text" style="padding: 0; background: transparent;">
                    <img class="bstage-chat-image-clickable" src="${escapeHtml(msg.imgUrl || 'assets/imessage/chat-image-placeholder-512.jpg')}" data-desc="${escapeHtml(msg.imgDesc || '')}" loading="lazy" decoding="async" style="max-width: 250px; width: 100%; border-radius: 12px; display: block; object-fit: cover; cursor: zoom-in; border: 1px solid #333;">
                </div>
            `;
        } else {
            bubbleContent = `
                ${renderReplyQuote(msg.replyTo)}
                <div class="bstage-msg-text">${escapeHtml(msg.text)}</div>
                ${msg.trans && msg.trans.trim() !== '' ? `<div class="bstage-trans-text">${escapeHtml(msg.trans)}</div>` : ''}
            `;
        }

        replyDiv.innerHTML = `
            ${renderBstageAvatar(member, member.name, 'bstage-chat-avatar')}
            <div class="bstage-chat-bubble" style="${msg.type === 'image' && !msg.replyTo ? 'background: transparent; padding: 0;' : ''}">${bubbleContent}</div>
            <button class="bstage-msg-reply-btn" type="button" aria-label="回复消息" title="回复消息">
                <i class="fas fa-reply"></i>
            </button>
        `;

        const replyBtn = replyDiv.querySelector('.bstage-msg-reply-btn');
        if (replyBtn) {
            replyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                setPendingReply('chat', createReplyMeta(msg, member.name));
            });
        }
        attachBstageImagePreview(replyDiv);
        contentContainer.appendChild(replyDiv);
    }

    function openChat(member) {
        if (!ensureBstageHydrated()) return;
        const canonical = findCanonicalBstageMember(member?.id, currentTeam?.id);
        if (!canonical) {
            if (typeof window.showToast === 'function') window.showToast('该角色已不存在，无法打开聊天');
            return;
        }
        currentTeam = canonical.team;
        member = canonical.member;
        currentChatMember = member; // Set current member
        document.getElementById('bstage-chat-name').textContent = member.name;
        const days = Math.floor((Date.now() - member.subStartDate) / (1000 * 60 * 60 * 24)) + 1;
        document.getElementById('bstage-chat-days').textContent = `已一同 ${days} 天`;
        
        // Restore Background if saved
        const chatView = document.getElementById('bstage-chat-view');
        if (member.chatBg) {
            chatView.style.backgroundImage = `url('${member.chatBg}')`;
        } else {
            chatView.style.backgroundImage = 'none'; // Default
            chatView.style.backgroundColor = '#1c1c1e'; // Default chat bg to dark gray
        }

        // Apply Dynamic Styles (Chat CSS, Frame CSS, Bubble CSS)
        applyDynamicStyles();

        // Reset Chat State
        userMsgCountSinceLastReply = 0; // Fresh start

        const content = document.getElementById('bstage-chat-content');
        
        // Apply Translation State
        if (isTranslationEnabled) content.classList.add('show-trans');
        else content.classList.remove('show-trans');

        // Initialize Chat History if missing
        if (!member.chatHistory || !Array.isArray(member.chatHistory)) {
            member.chatHistory = [
                { type: 'date', text: formatTimeBubble(Date.now()), timestamp: Date.now() },
                { isUser: false, type: 'text', text: `Hello! I'm ${member.name}.`, trans: `你好！我是${member.name}。`, timestamp: Date.now() },
                { isUser: false, type: 'text', text: `Thanks for subscribing!`, trans: `谢谢你的订阅！`, timestamp: Date.now() + 100 }
            ];
            saveBstageData();
        }

        // Render Chat History
        content.innerHTML = '';
        member.chatHistory.forEach(msg => appendCharChatMessage(member, msg, content));
        clearPendingReply('chat');
        // Scroll to bottom
        setTimeout(() => { content.scrollTop = content.scrollHeight; }, 100);
        
        // Input Logic
        const inputArea = document.getElementById('bstage-chat-input');
        const sendBtn = document.getElementById('bstage-chat-send-btn');
        const apiBtn = document.getElementById('bstage-chat-api-btn');
        if (!inputArea || !sendBtn || !apiBtn) return;
        
        // Clone buttons to remove old listeners
        const newSendBtn = sendBtn.cloneNode(true);
        sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
        
        const newApiBtn = apiBtn.cloneNode(true);
        apiBtn.parentNode.replaceChild(newApiBtn, apiBtn);

        // Helper to get time
        const getCurrentTime = () => {
            const now = Date.now();
            return typeof window.formatChatBubbleTime === 'function' ? window.formatChatBubbleTime(now) : (() => {
                const d = new Date();
                return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
            })();
        };

        // Helper to send
        const sendMsg = () => {
            if (!ensureBstageHydrated()) return;
            const canonical = findCanonicalBstageMember(member?.id, currentTeam?.id);
            if (!canonical) {
                if (typeof window.showToast === 'function') window.showToast('该角色已不存在，无法发送消息');
                return;
            }
            currentTeam = canonical.team;
            member = canonical.member;
            currentChatMember = member;
            const txt = inputArea.value.trim();
            if (!txt) return;
            
            // Limit Check
            if (userMsgCountSinceLastReply >= 3) {
                const noticeDiv = document.createElement('div');
                noticeDiv.className = 'bstage-system-notice';
                noticeDiv.textContent = `请等待 ${currentChatMember.name} 的回复`;
                content.appendChild(noticeDiv);
                inputArea.value = '';
                content.scrollTop = content.scrollHeight;
                return;
            }

            userMsgCountSinceLastReply++;
            const timeString = getCurrentTime();

            // Add Date Bubble if needed
            const now = Date.now();
            checkAndAddDateBubble(member, content, now);

            // Save to History
            if (!member.chatHistory) member.chatHistory = [];
            const msg = {
                id: createBstageMessageId('user'),
                isUser: true,
                type: 'text',
                text: txt,
                time: timeString,
                timestamp: now,
                status: '未读',
                replyTo: pendingChatReply ? { ...pendingChatReply } : null
            };
            member.chatHistory.push(msg);
            appendCharChatMessage(member, msg, content);
            saveBstageData();

            inputArea.value = '';
            clearPendingReply('chat');
            content.scrollTop = content.scrollHeight;
        };

        bindBstageFocusPreservingAction(newSendBtn, sendMsg);
        
        bindBstageFocusPreservingAction(newApiBtn, async () => {
            if (newApiBtn.classList.contains('is-loading')) return;
            setChatActionLoading(newApiBtn, true);
            const wasReadOnly = inputArea.readOnly;
            inputArea.readOnly = true;
            inputArea.setAttribute('aria-busy', 'true');
            try {
                await triggerChatApi(member, content);
            } finally {
                inputArea.readOnly = wasReadOnly;
                inputArea.removeAttribute('aria-busy');
                setChatActionLoading(newApiBtn, false);
            }
        });

        // Keep one Android-aware Enter handler while switching between members.
        if (activeCharacterChatInputCleanup) activeCharacterChatInputCleanup();
        activeCharacterChatInputCleanup = registerBstageSendInput(inputArea, sendMsg, {
            root: bstageChatView,
            scrollContainer: content
        });

        window.openView(document.getElementById('bstage-chat-view'));
    }

    async function triggerChatApi(member, contentContainer, isAuto = false) {
        if (!ensureBstageHydrated(!isAuto)) return false;
        const initialCanonical = findCanonicalBstageMember(member?.id, currentTeam?.id);
        if (!initialCanonical) {
            if (!isAuto && typeof window.showToast === 'function') window.showToast('该角色已不存在，无法生成回复');
            return false;
        }
        currentTeam = initialCanonical.team;
        member = initialCanonical.member;
        if (currentChatMember && String(currentChatMember.id) === String(member.id)) {
            currentChatMember = member;
        }
        // Resolve API Config based on member preset or global
        let resolvedApiConfig = window.apiConfig;
        
        if (member.autoActivityPresetId) {
            try {
                let globalPresets = window.StorageManager ? window.StorageManager.load('u2_apiPresets', []) : [];
                const preset = globalPresets.find(p => String(p.id) === String(member.autoActivityPresetId));
                if (preset) {
                    resolvedApiConfig = {
                        provider: preset.provider || 'openai-compatible',
                        endpoint: preset.endpoint,
                        apiKey: preset.apiKey,
                        model: preset.model,
                        temperature: preset.temp !== undefined ? preset.temp : 0.7
                    };
                }
            } catch(e) { console.warn("Failed to load preset config", e); }
        }

        if (!resolvedApiConfig || !resolvedApiConfig.endpoint || !resolvedApiConfig.apiKey) {
            if (!isAuto) window.showToast('请先在系统设置中配置 API 或检查预设');
            return;
        }

        if (!isAuto) window.showToast(`${member.name} 正在输入...`);

        // Collect Chat History
        if (!member.chatHistory || !Array.isArray(member.chatHistory)) member.chatHistory = [];
        let fetchCount = isContextEnabled ? contextMessageCount : 1;
        const promptMessages = member.chatHistory
            .filter(msg => msg && msg.type !== 'date')
            .slice(-fetchCount);
        let history = "聊天记录（每条都有 id，replyTo 表示正在引用/翻牌某条消息）:\n";
        if (promptMessages.length === 0) {
            history += '暂无聊天记录。\n';
        } else {
            promptMessages.forEach(msg => {
                const speaker = msg.isUser ? '当前粉丝' : member.name;
                const line = formatMessageForPrompt(msg, speaker);
                if (line) history += `${line}\n`;
            });
        }
        const validUserReplyIds = promptMessages
            .filter(msg => msg && msg.isUser && msg.id)
            .map(msg => msg.id);

        const mountedProfileName = window.userState && window.userState.name ? window.userState.name : '未命名人物';
        const mountedProfilePersona = window.userState && window.userState.persona ? window.userState.persona : '';
        const mountedProfileContext = `聊天室挂载资料 / 可讨论人物资料（注意：这不是当前发言的 User 本人）：\n名称：${mountedProfileName}\n人设/资料：${mountedProfilePersona || '未填写'}\n说明：当前粉丝可以提到、讨论或询问这个资料里的人物，但当前粉丝发来的消息在 ${member.name} 眼里只是普通粉丝消息，不能把当前粉丝当成该人物本人。\n`;

        // --- 提取世界书 ---
        const systemDepthWorldBookContext = window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('system_depth') : '';
        const beforeRoleWorldBookContext = window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('before_role') : '';
        const afterRoleWorldBookContext = window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('after_role') : '';

        // Get realistic current time context
        const now = new Date();
        const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const realTimeContext = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${days[now.getDay()]} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
        const otherFansEnabled = !!member.otherFansEnabled;
        const otherFansPromptBlock = otherFansEnabled ? `

其他粉丝消息功能已开启：
- 你必须先生成本轮 otherFanMessages，再生成你的回复 charMessages。
- otherFanMessages 不少于 10 条，最多 14 条，来自不同粉丝。
- otherFanMessages 必须是这些粉丝直接发给你（${member.name}）的消息：他们在和你说话、向你提问、对你应援、催你营业、请你翻牌或向你提到某个话题。
- 禁止写成其他粉丝在和当前粉丝/User聊天，禁止让其他粉丝对当前粉丝/User发问、打招呼或回复。
- 其他粉丝可以向你提到聊天室挂载资料里的可讨论人物/设定，但表达方式必须是“对你说”：例如问你怎么看、你和对方什么关系、你能不能聊聊，而不是粉丝之间互相讨论。
- 你可以回复本轮 otherFanMessages 里的某条其他粉丝消息；如需回复，请在 charMessages 对象中填写 replyToFanId，值只能来自你本次生成的 otherFanMessages.id。
` : '';
        const responseFormatPrompt = otherFansEnabled ? `
必须返回严格 JSON 对象，不要 markdown，不要解释：
{
  "otherFanMessages": [
    {"id": "fan_1", "name": "粉丝昵称", "text": "直接发给 ${member.name} 的原文消息", "trans": "非中文消息的中文翻译，中文消息则为空字符串"}
  ],
  "charMessages": [
    {"type": "text", "text": "气泡1原文", "trans": "气泡1中文翻译", "replyToUserId": "可选的当前粉丝消息 id", "replyToFanId": "可选的其他粉丝消息 id"},
    {"type": "image", "description": "一张帅气偶像的自拍，面带微笑，后台背景，明亮的灯光", "replyToUserId": "可选", "replyToFanId": "可选"}
  ]
}
` : `
必须返回严格 JSON 数组，不要 markdown，不要解释：
[
  {"type": "text", "text": "气泡1原文", "trans": "气泡1中文翻译", "replyToUserId": "可选的当前粉丝消息 id"},
  {"type": "image", "description": "一张帅气偶像的自拍，面带微笑，后台背景，明亮的灯光", "replyToUserId": "可选"}
]
`;

const prompt = `
${systemDepthWorldBookContext ? `System Depth Rules:\n${systemDepthWorldBookContext}\n\n` : ''}${beforeRoleWorldBookContext ? `Before Role Rules:\n${beforeRoleWorldBookContext}\n\n` : ''}你现在的身份是：${member.name}
你的人设是：${member.role || '爱豆/明星/gong'}
你所在的团队名称是：${currentTeam ? currentTeam.name : 'Unknown Team'}
你所在的团队信息是：${currentTeam && currentTeam.desc ? currentTeam.desc : '无'}${afterRoleWorldBookContext ? `\n\nAfter Role Rules:\n${afterRoleWorldBookContext}` : ''}
当前真实时间是 ${realTimeContext}。

请扮演该角色，与当前粉丝进行沉浸式对话。
视角说明：当前粉丝在界面上看到的是与你的单聊；但从你的视角，你正在面对很多粉丝/订阅者的实时消息，当前粉丝只是其中一个可能被你看见的人。聊天室挂载资料不是当前粉丝本人，只是一个可被讨论的人物/设定。

要求：
1. 根据char的人设进行一次日常消息的营业，根据你的人设选择输出什么语言，例如你是韩国人，输出韩语。
2. 一句一发，将你想说的话拆分成 3 到 6 条简短的气泡回复。
3. 从你的视角看会有很多很多粉丝的消息，你不一定能看见当前粉丝发的消息，禁止每一条都回复当前粉丝，禁止顺着当前粉丝的话机械往下说，请按真实一对多的逻辑回复。
4. 如果某条当前粉丝消息带有 replyTo，说明当前粉丝在引用/翻牌你的某条营业消息；你可以注意到，也可以像真实营业一样不一定回应。
5. 所有 text 都要包含原文和中文翻译字段 trans；如果原文是中文则 trans 为空字符串；如果原文不是纯中文，trans 必须是自然中文翻译。
6. 你可以回复某条当前粉丝消息；如需回复，请在消息对象中填写 replyToUserId，值只能从这些当前粉丝消息 id 中选择：${validUserReplyIds.length ? validUserReplyIds.join(', ') : '无'}。不回复则省略或填空。
7. 你可以发送普通文本气泡，也可以发送图片，但发图片的概率很低，禁止每一条都发图片，比如有很多粉丝希望你发图片再发。
8. 如果是图片，请使用 "type": "image" 并在 "description" 字段中写明画面的详细提示词描述（必须是中文描述）。
${otherFansPromptBlock}
${responseFormatPrompt}

${mountedProfileContext}
${history}
`;

        try {
            const endpoint = window.u2Api.resolveChatCompletionsEndpoint(resolvedApiConfig.endpoint);

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${resolvedApiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: resolvedApiConfig.model || 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: 'You generate strict JSON objects for immersive b.stage character fan interactions.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: parseFloat(resolvedApiConfig.temperature) || 0.8
                })
            });

            if (!response.ok) throw new Error('API Error');
            
            const data = await response.json();
            const resolvedMember = findCanonicalBstageMember(member.id, currentTeam?.id);
            if (!resolvedMember) {
                throw new Error('chat_member_removed');
            }
            currentTeam = resolvedMember.team;
            member = resolvedMember.member;
            if (currentChatMember && String(currentChatMember.id) === String(member.id)) {
                currentChatMember = member;
            }
            let aiReply = data.choices[0].message.content;
            aiReply = aiReply.replace(/```json/g, '').replace(/```/g, '').trim();
            
            let parsedMsgs = [];
            let otherFanMessages = [];
            try {
                const parsedPayload = JSON.parse(aiReply);
                if (Array.isArray(parsedPayload)) {
                    parsedMsgs = parsedPayload;
                } else if (parsedPayload && typeof parsedPayload === 'object') {
                    parsedMsgs = Array.isArray(parsedPayload.charMessages)
                        ? parsedPayload.charMessages
                        : (Array.isArray(parsedPayload.messages) ? parsedPayload.messages : []);
                    if (otherFansEnabled) {
                        otherFanMessages = normalizeOtherFanMessages(
                            parsedPayload.otherFanMessages || parsedPayload.fanMessages || parsedPayload.other_fan_messages || [],
                            Date.now()
                        );
                    }
                } else {
                    parsedMsgs = [aiReply];
                }
            } catch (e) {
                // Fallback for non-JSON
                const lines = aiReply.split('\n').filter(s => s.trim().length > 0);
                // Fallback translation assumption
                parsedMsgs = lines.map(l => ({ text: l, trans: '翻译失败' }));
            }
            if (otherFansEnabled && otherFanMessages.length < 10) {
                throw new Error('too_few_other_fans');
            }

            if (contentContainer) {
                // Reset user counter and update status text
                userMsgCountSinceLastReply = 0;
                // Change all "未读" to "已读" status
                const statusTexts = contentContainer.querySelectorAll('.bstage-msg-status-text');
                statusTexts.forEach(el => {
                    if (el.innerHTML === '未读') el.innerHTML = '已读';
                });
            }
            
            if (member.chatHistory) {
                member.chatHistory.forEach(h => {
                    if (h.isUser && h.status === '未读') h.status = '已读';
                });
            }

            // Fullscreen Image Preview
            function openImagePreview(src, desc) {
                const overlay = document.createElement('div');
                overlay.style.position = 'fixed';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100vw';
                overlay.style.height = '100vh';
                overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
                overlay.style.zIndex = '10000';
                overlay.style.display = 'flex';
                overlay.style.flexDirection = 'column';
                overlay.style.justifyContent = 'center';
                overlay.style.alignItems = 'center';
                overlay.style.cursor = 'zoom-out';
                
                const img = document.createElement('img');
                img.src = src;
                img.style.maxWidth = '90%';
                img.style.maxHeight = '80%';
                img.style.objectFit = 'contain';
                img.style.borderRadius = '12px';
                img.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
                
                overlay.appendChild(img);
                
                if (desc) {
                    const textDiv = document.createElement('div');
                    textDiv.style.color = '#fff';
                    textDiv.style.marginTop = '20px';
                    textDiv.style.maxWidth = '90%';
                    textDiv.style.textAlign = 'center';
                    textDiv.style.fontSize = '16px';
                    textDiv.textContent = desc;
                    overlay.appendChild(textDiv);
                }
                
                document.body.appendChild(overlay);
                
                overlay.addEventListener('click', () => {
                    overlay.remove();
                });
            }

            const generationStartedAt = Date.now();
            const playbackItems = [];
            const dateMessage = (parsedMsgs.length > 0 || otherFanMessages.length > 0)
                ? checkAndAddDateBubble(member, null, generationStartedAt)
                : null;
            let delay = 0;
            const otherFanMessageById = new Map(otherFanMessages.map(fan => [String(fan.id), fan]));
            parsedMsgs.forEach(msgItem => {
                // Normalize msgItem
                let text = '';
                let trans = '';
                let type = 'text';
                let imgDesc = '';
                let replyToUserId = '';
                let replyToFanId = '';
                
                if (typeof msgItem === 'string') {
                    text = stripGeneratedText(msgItem);
                } else {
                    type = msgItem.type || 'text';
                    text = stripGeneratedText(msgItem.text || '');
                    trans = stripGeneratedText(msgItem.trans || msgItem.translation || msgItem.translationZh || '');
                    imgDesc = stripGeneratedText(msgItem.description || '');
                    replyToUserId = stripGeneratedText(msgItem.replyToUserId || msgItem.reply_to_user_id || msgItem.replyToId || msgItem.reply_to_id || '');
                    replyToFanId = stripGeneratedText(msgItem.replyToFanId || msgItem.reply_to_fan_id || '');
                }
                if (type !== 'image' && !text) return;
                const fanReplySource = replyToFanId ? otherFanMessageById.get(String(replyToFanId)) : null;
                const userReplySource = findMessageById(member.chatHistory, replyToUserId, msg => msg && msg.isUser);
                const replyTo = fanReplySource
                    ? createOtherFanReplyMeta(fanReplySource)
                    : (userReplySource ? createReplyMeta(userReplySource, '当前粉丝') : null);

                const savedMsg = type === 'image'
                    ? {
                        id: createBstageMessageId('char'),
                        isUser: false,
                        type: 'image',
                        imgUrl: 'assets/imessage/chat-image-placeholder-512.jpg',
                        imgDesc,
                        timestamp: generationStartedAt + delay,
                        replyTo,
                        isUnread: !contentContainer
                    }
                    : {
                        id: createBstageMessageId('char'),
                        isUser: false,
                        type: 'text',
                        text,
                        trans,
                        timestamp: generationStartedAt + delay,
                        replyTo,
                        isUnread: !contentContainer
                    };
                if (!member.chatHistory) member.chatHistory = [];
                member.chatHistory.push(savedMsg);
                if (type === 'image') chatPhotos.push(savedMsg.imgUrl);
                playbackItems.push({ delay, message: savedMsg });
                delay += 1500 + Math.random() * 1000;
            });

            if (otherFanMessages.length > 0) {
                const fanBatchMsg = {
                    id: createBstageMessageId('fan_batch'),
                    type: 'fan_batch',
                    timestamp: generationStartedAt + delay,
                    fanMessages: otherFanMessages
                };
                if (!member.chatHistory) member.chatHistory = [];
                member.chatHistory.push(fanBatchMsg);
                playbackItems.push({ delay: delay + (parsedMsgs.length > 0 ? 250 : 0), message: fanBatchMsg });
            }

            if (playbackItems.length === 0 && !dateMessage) return;
            const persisted = await saveBstageData({ flush: true });
            if (!persisted) throw new Error('storage_write_failed');

            if (!contentContainer) {
                if (isAuto && playbackItems.length > 0) {
                    const firstMessage = playbackItems[0].message;
                    if (window.showBannerNotification) {
                        window.showBannerNotification({
                            nickname: member.name,
                            avatarUrl: member.avatar,
                            id: member.id,
                            sourceApp: 'bstage'
                        }, firstMessage.type === 'image' ? '[图片]' : firstMessage.text);
                    } else if (window.showToast) {
                        window.showToast(`收到来自 ${member.name} 的新消息`);
                    }
                }
                return;
            }

            if (dateMessage) appendCharChatMessage(member, dateMessage, contentContainer);
            let previousDelay = 0;
            for (const item of playbackItems) {
                const waitMs = Math.max(0, item.delay - previousDelay);
                if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
                previousDelay = item.delay;
                if (item.message.type === 'image') {
                    const previewList = document.getElementById('bstage-locker-preview-list');
                    if (previewList && chatDetailSheet.style.display === 'block') renderLockerPreview();
                }
                appendCharChatMessage(member, item.message, contentContainer);
                contentContainer.scrollTop = contentContainer.scrollHeight;
            }

        } catch (error) {
            console.error(error);
            if (!isAuto) window.showToast(error && error.message === 'too_few_other_fans' ? '其他人消息少于 10 条，请重试' : '生成回复失败');
        }
    }

    function renderShop(team) {
        if (removeBstageDefaultContent(team)) saveBstageData();
        // Init Data if needed
        if (!Array.isArray(team.shopItems)) {
            team.shopItems = [];
        }
        if (!Array.isArray(team.shopCategories) || team.shopCategories.length === 0) {
            team.shopCategories = ['全部'];
        }

        let activeCategory = '全部';

        const renderGrid = (filter) => {
            let gridHtml = '';
            const filteredItems = filter === '全部' ? team.shopItems : team.shopItems.filter(i => i.category === filter);
            
            if (filteredItems.length === 0) {
                gridHtml = '<div style="grid-column:span 2;text-align:center;padding:20px;color:#666;">暂无商品</div>';
            } else {
                filteredItems.forEach(item => {
                    const img = item.img || createExternalRandomImage(`${team.id || team.name}-shop-${item.id || item.name}`, 600, 600);
                    item.img = img;
                    gridHtml += `
                        <div class="bstage-shop-item" data-shop-id="${item.id}">
                            <div class="bstage-shop-img">
                                <img src="${escapeHtml(img)}" alt="">
                            </div>
                            <div class="bstage-shop-info">
                                <span class="bstage-shop-badge">${escapeHtml(item.category)}</span>
                                <div class="bstage-shop-name">${escapeHtml(item.name)}</div>
                                <div class="bstage-shop-price">${escapeHtml(item.price)}</div>
                            </div>
                        </div>
                    `;
                });
            }
            return gridHtml;
        };

        const renderView = () => {
            let catsHtml = '';
            team.shopCategories.forEach(cat => {
                const activeClass = cat === activeCategory ? 'active' : '';
                catsHtml += `<div class="bstage-shop-cat-item ${activeClass}" data-cat="${cat}">${cat}</div>`;
            });
            
            // Generate Button
            const magicHtml = `
                <div class="bstage-small-magic-btn" id="bstage-shop-magic-btn" style="margin-left: 5px; flex-shrink: 0;">
                    <i class="fas fa-plus"></i>
                </div>
            `;

            // Shop Banner Logic
            const bannerStyle = team.shopBanner ? `background-image: url('${team.shopBanner}');` : 'background-color:#222;';
            const bannerContent = team.shopBanner ? '' : `
                <div style="width:100%;height:100%;background-color:#222;display:flex;justify-content:center;align-items:center;opacity:0.5;">
                    <i class="fas fa-star" style="font-size:40px;color:#444;"></i>
                </div>
            `;

            contentArea.innerHTML = `
                <div class="bstage-shop-view">
                    <div class="bstage-shop-banner" id="bstage-shop-banner-edit" style="${bannerStyle}; cursor: pointer; position: relative;">
                        ${bannerContent}
                        <div class="bstage-shop-banner-text">OFFICIAL SHOP</div>
                        <input type="file" id="bstage-shop-banner-input" accept="image/*" style="display:none;">
                    </div>
                    
                    <div style="display: flex; align-items: center; margin-bottom: 5px;">
                        <div class="bstage-shop-category-bar" style="flex: 1; margin-bottom: 0;">
                            ${catsHtml}
                        </div>
                        ${magicHtml}
                    </div>

                    <div class="bstage-shop-section-title">${activeCategory === '全部' ? 'ALL ITEMS' : activeCategory}</div>
                    <div class="bstage-shop-grid" id="bstage-shop-grid-container">
                        ${renderGrid(activeCategory)}
                    </div>
                </div>
            `;

            // Add Event Listeners for Categories
            contentArea.querySelectorAll('.bstage-shop-cat-item').forEach(el => {
                el.addEventListener('click', () => {
                    activeCategory = el.getAttribute('data-cat');
                    renderView(); 
                });
            });

            // Banner Upload Listener
            const bannerEdit = document.getElementById('bstage-shop-banner-edit');
            const bannerInput = document.getElementById('bstage-shop-banner-input');
            if (bannerEdit && bannerInput) {
                bannerEdit.addEventListener('click', (e) => {
                    // Avoid triggering if clicked on specific children if needed, but whole area is fine
                    bannerInput.click();
                });
                
                bannerInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            team.shopBanner = ev.target.result;
                            renderView(); // Re-render to update bg
                            window.showToast('Shop 背景已更新');
                        };
                        reader.readAsDataURL(file);
                    }
                    e.stopPropagation();
                });
                
                // Stop propagation on input click to prevent double firing? No, input is hidden.
                bannerInput.addEventListener('click', (e) => e.stopPropagation());
            }

            // Magic Wand Listener
            const magicBtn = document.getElementById('bstage-shop-magic-btn');
            if(magicBtn) {
                magicBtn.addEventListener('click', () => {
                    openGenerateTypeSheet({
                        title: '生成商品',
                        label: '想看什么类型的商品',
                        placeholder: '例如：应援棒、签售周边、冬季套装；留空则随机',
                        onConfirm: (request) => triggerShopApi(team, activeCategory, request)
                    });
                });
            }

            // Bind Shop Item Clicks
            contentArea.querySelectorAll('.bstage-shop-item').forEach((el, index) => {
                el.addEventListener('click', () => {
                    const filteredItems = activeCategory === '全部' ? team.shopItems : team.shopItems.filter(i => i.category === activeCategory);
                    if(filteredItems[index]) {
                        openShopDetail(filteredItems[index]);
                    }
                });
            });
        };

        renderView();
    }

    function openShopDetail(item) {
        document.getElementById('bstage-shop-detail-title').textContent = item.name;
        document.getElementById('bstage-shop-detail-price').textContent = item.price;
        document.getElementById('bstage-shop-detail-cat').textContent = item.category;
        
        // Description
        const desc = item.desc || `${currentTeam.name} 官方正品周边。\n\n[商品信息]\n品名: ${item.name}\n材质: Detailed on package\n尺寸: Free Size\n制造国: Korea`;
        document.getElementById('bstage-shop-detail-desc').textContent = desc;
        
        // Image
        const imgEl = document.querySelector('#bstage-shop-detail-img img');
        const placeholder = document.querySelector('#bstage-shop-detail-img .bstage-shop-detail-placeholder');
        
        if (item.img) {
            imgEl.src = item.img;
            imgEl.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            imgEl.style.display = 'none';
            placeholder.style.display = 'flex';
            // Use random seed based on item id if no image but want consistency? 
            // Currently using picsum in CSS for list, let's leave placeholder for detail unless we want to generate.
        }

        window.openView(document.getElementById('bstage-shop-detail-modal'));
    }

    async function triggerShopApi(team, category, requestType = '') {
        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
            window.showToast('请先在系统设置中配置 API');
            return;
        }
        if (!Array.isArray(team.shopItems)) team.shopItems = [];
        if (!Array.isArray(team.shopCategories)) team.shopCategories = ['全部'];

        window.showToast('正在生成商品...');
        
        let charInfo = "团队成员:\n";
        if (team.members) {
            team.members.forEach(m => {
                charInfo += `- ${m.name} (${m.role})\n`;
            });
        }
        
        const prompt = `
你是一个周边商品策划。
请根据以下团队信息和角色人设，以及商品分类，生成2-3个相关的商品。
团队名称: ${team.name}
${charInfo}
商品分类: ${category}
用户想看的类型: ${requestType || '留空，随机生成适合该团队/账号的商品'}

要求：
1. 如果用户填写了想看的类型，商品必须围绕该类型生成；如果留空，则随机生成有吸引力的商品。
2. 价格要合理（韩元），格式如 "₩45,000"。
3. category 应该使用已有分类或根据用户想看的类型给出自然分类。
4. desc 是商品详情简介。
5. 返回严格的 JSON 数组格式，不要 markdown 标记。
格式示例:
[
  {"name": "商品名称1", "price": "₩35,000", "category": "周边", "desc": "商品详情"},
  {"name": "商品名称2", "price": "₩12,000", "category": "其他", "desc": "商品详情"}
]
`;

        try {
            const endpoint = window.u2Api.resolveChatCompletionsEndpoint(window.apiConfig.endpoint);

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.apiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: window.apiConfig.model || 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: 'You are a JSON generator.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7
                })
            });

            if (!response.ok) throw new Error('API Error');
            const data = await response.json();
            let aiReply = data.choices[0].message.content;
            aiReply = aiReply.replace(/```json/g, '').replace(/```/g, '').trim();
            
            const newItems = JSON.parse(aiReply);
            
            if (Array.isArray(newItems)) {
                newItems.forEach(item => {
                    const itemName = stripGeneratedText(item && item.name, 'New Item');
                    const itemCategory = stripGeneratedText(item && item.category, category === '全部' ? (requestType || '周边') : category);
                    if (itemCategory && !team.shopCategories.includes(itemCategory)) team.shopCategories.push(itemCategory);
                    team.shopItems.unshift({
                        id: Date.now() + Math.random(),
                        name: itemName,
                        price: stripGeneratedText(item && item.price, '₩35,000'),
                        img: createExternalRandomImage(`${team.id || team.name}-shop-${itemName}-${Date.now()}`, 600, 600),
                        category: itemCategory,
                        desc: stripGeneratedText(item && item.desc)
                    });
                });
                saveBstageData();
                renderShop(team); // Refresh
                window.showToast(`已生成 ${newItems.length} 个商品`);
            }
        } catch (e) {
            console.error(e);
            window.showToast('生成失败');
        }
    }

    function renderContent(team) {
        if (removeBstageDefaultContent(team)) saveBstageData();
        if (!Array.isArray(team.contentPhotos)) {
            team.contentPhotos = [];
        }
        // Init videos if not present
        if (!Array.isArray(team.videos)) team.videos = [];
        
        // Init Series
        if (!Array.isArray(team.contentSeries) || team.contentSeries.length === 0) {
            team.contentSeries = ['全部'];
        }

        let activeSeries = '全部';

        const renderView = () => {
            // Photos Carousel
            let photosHtml = '';
            team.contentPhotos.forEach(p => {
                photosHtml += `<div class="bstage-carousel-item"><img src="${p}"></div>`;
            });
            // Add Button
            photosHtml += `
                <div class="bstage-add-photo-btn" id="bstage-add-content-photo-btn">
                    <i class="fas fa-plus"></i>
                    <input type="file" accept="image/*" style="display:none;">
                </div>
            `;

            // Series Filter Bar
            let seriesHtml = '';
            team.contentSeries.forEach(s => {
                const activeClass = s === activeSeries ? 'active' : '';
                let deleteHtml = '';
                // Allow deleting custom series (not '全部')
                if (s !== '全部') {
                    deleteHtml = `<div class="bstage-cat-delete" data-del-series="${s}"><i class="fas fa-times"></i></div>`;
                }
                seriesHtml += `<div class="bstage-shop-cat-item ${activeClass}" data-series="${s}">${s}${deleteHtml}</div>`;
            });
            
            // Add Series Button
            seriesHtml += `
                <div class="bstage-shop-cat-item" id="bstage-add-series-btn">
                    <i class="fas fa-plus"></i>
                </div>
            `;

            // Generate Button
            const magicHtml = `
                <div class="bstage-small-magic-btn" id="bstage-content-magic-btn" style="margin-left: 5px; flex-shrink: 0;">
                    <i class="fas fa-plus"></i>
                </div>
            `;

            // Filter Videos
            let videosHtml = '';
            const filteredVideos = activeSeries === '全部' ? team.videos : team.videos.filter(v => v.series === activeSeries || (!v.series && activeSeries === '全部'));
            
            if (filteredVideos.length === 0) {
                videosHtml = '<div style="text-align:center; color:#666; padding:20px;">暂无视频</div>';
            } else {
                filteredVideos.forEach(v => {
                    if (!v.thumb) v.thumb = createExternalRandomImage(`${team.id || team.name}-video-${v.title || Date.now()}`, 800, 450);
                    const thumbStyle = v.thumb ? `background-image: url('${v.thumb}'); background-size: cover; background-position: center;` : '';
                    const thumbContent = v.thumb ? '' : `
                        <div style="width:100%;height:100%;display:flex;justify-content:center;align-items:center;color:#555;">
                            <i class="fas fa-play" style="font-size:30px;"></i>
                        </div>`;
                    
                    videosHtml += `
                        <div class="bstage-video-card">
                            <div class="bstage-video-thumb" style="${thumbStyle}">
                                ${thumbContent}
                                <div class="bstage-video-duration">${v.duration}</div>
                            </div>
                            <div class="bstage-video-info">
                                <div class="bstage-video-title">${v.title}</div>
                                <div class="bstage-video-meta">${v.views} • ${v.date}</div>
                            </div>
                        </div>
                    `;
                });
            }

            contentArea.innerHTML = `
                <div class="bstage-content-view">
                    <div class="bstage-top-carousel" id="bstage-carousel-container">
                        ${photosHtml}
                    </div>
                    
                    <div class="bstage-video-section">
                        <div style="display: flex; align-items: center; margin-bottom: 5px;">
                            <div class="bstage-shop-category-bar" style="flex: 1; margin-bottom: 0;">
                                ${seriesHtml}
                            </div>
                            ${magicHtml}
                        </div>
                        
                        <div class="bstage-section-header">${activeSeries === '全部' ? 'All Videos' : activeSeries}</div>
                        <div class="bstage-video-list">
                            ${videosHtml}
                        </div>
                    </div>
                </div>
            `;

            // Bind Video Click Events
            contentArea.querySelectorAll('.bstage-video-card').forEach((el, index) => {
                el.addEventListener('click', () => {
                    if (filteredVideos[index]) {
                        openVideoDetail(filteredVideos[index]);
                    }
                });
            });

            // Bind Upload Event
            const addBtn = document.getElementById('bstage-add-content-photo-btn');
            if (addBtn) {
                const input = addBtn.querySelector('input');
                addBtn.addEventListener('click', () => input.click());
                input.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            team.contentPhotos.unshift(e.target.result); // Add to beginning
                            renderView(); 
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }

            // Bind Series Clicks
            contentArea.querySelectorAll('.bstage-shop-cat-item').forEach(el => {
                if (el.id === 'bstage-add-series-btn') {
                    el.addEventListener('click', () => {
                        const newSeries = prompt('请输入新的系列名称:');
                        if (newSeries && newSeries.trim()) {
                            team.contentSeries.push(newSeries.trim());
                            activeSeries = newSeries.trim();
                            renderView();
                        }
                    });
                } else {
                    // Check if clicked on delete
                    const delBtn = el.querySelector('.bstage-cat-delete');
                    if(delBtn) {
                        delBtn.addEventListener('click', (ev) => {
                            ev.stopPropagation(); // Stop bubbling to item click
                            const s = delBtn.getAttribute('data-del-series');
                            if(confirm(`确定要删除系列 "${s}" 吗？`)) {
                                team.contentSeries = team.contentSeries.filter(x => x !== s);
                                if(activeSeries === s) activeSeries = '全部';
                                renderView();
                            }
                        });
                    }

                    el.addEventListener('click', (ev) => {
                        // If we clicked delete, don't switch (already handled by stopPropagation above, but safe check)
                        if(ev.target.closest('.bstage-cat-delete')) return;
                        
                        activeSeries = el.getAttribute('data-series');
                        renderView();
                    });
                }
            });

            // Magic Wand Listener
            const magicBtn = document.getElementById('bstage-content-magic-btn');
            if(magicBtn) {
                magicBtn.addEventListener('click', () => {
                    openGenerateTypeSheet({
                        title: '生成视频内容',
                        label: '想看什么类型的视频内容',
                        placeholder: '例如：练习室、旅行 vlog、后台花絮；留空则随机',
                        onConfirm: (request) => triggerContentApi(team, activeSeries, request)
                    });
                });
            }

            // Start Auto Carousel
            startCarousel();
        };

        renderView();
    }

    function startCarousel() {
        // Clear existing
        if (contentCarouselInterval) clearInterval(contentCarouselInterval);
        
        const container = document.getElementById('bstage-carousel-container');
        if (!container) return;

        contentCarouselInterval = setInterval(() => {
            if (!container) return;
            // Scroll by width of one item + gap
            const itemWidth = 290; // 280 + 10 gap
            if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 10) {
                container.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                container.scrollBy({ left: itemWidth, behavior: 'smooth' });
            }
        }, 3000); // 3 seconds
    }

    // Video Detail Logic
    let currentVideo = null;

    function openVideoDetail(video) {
        currentVideo = video;
        setPendingVideoCommentReply(null);
        
        // Populate Data
        document.getElementById('bstage-vid-detail-title').textContent = video.title;
        document.getElementById('bstage-vid-detail-meta').textContent = `${video.views} • ${video.date}`;
        document.getElementById('bstage-vid-publisher-name').textContent = currentTeam.name;
        
        const pubAvatar = document.getElementById('bstage-vid-publisher-avatar');
        if (pubAvatar) pubAvatar.innerHTML = renderBstageAvatarContent(currentTeam, currentTeam.name);

        // Reset Player Placeholder Content (Clear bubbles if new video, or restore if saved)
        const playerPlaceholder = videoDetailModal.querySelector('.bstage-video-player-placeholder');
        
        // Apply Cover
        if (video.thumb) {
            playerPlaceholder.style.backgroundImage = `url('${video.thumb}')`;
            playerPlaceholder.style.backgroundSize = 'cover';
            playerPlaceholder.style.backgroundPosition = 'center';
            playerPlaceholder.classList.add('has-cover');
        } else {
            playerPlaceholder.style.backgroundImage = '';
            playerPlaceholder.classList.remove('has-cover');
        }

        // Keep the play icon if no content, or clear it? 
        // Let's reset to default state (Play Icon) if no content and no cover?
        // If has cover, maybe don't show play icon.
        // If has generated content, show bubbles.
        
        playerPlaceholder.innerHTML = '';
        
        // If nothing generated, show play icon or just empty if cover exists
        if (!video.generatedContent || video.generatedContent.length === 0) {
            if (!video.thumb) {
                playerPlaceholder.innerHTML = '<i class="fas fa-play" style="font-size: 40px; opacity: 0.8; align-self: center; margin-top: auto; margin-bottom: auto;"></i>';
            }
        } else {
            video.generatedContent.forEach(text => {
                const bubble = document.createElement('div');
                bubble.className = 'bstage-video-content-bubble';
                bubble.textContent = text;
                playerPlaceholder.appendChild(bubble);
            });
        }
        
        // Add Edit Icon overlay to indicate clickability (optional but helpful)
        // Or just rely on user knowing to click. Let's rely on click for now as requested.
        
        // Description (Mock if empty)
        const desc = video.description || `这是 ${currentTeam.name} 的精彩视频内容。\n请大家多多支持，不要忘记点赞评论哦！`;
        document.getElementById('bstage-vid-description').textContent = desc;

        // Init Comments if needed
        if (!video.comments) {
            video.comments = [
                { id: 1, name: 'User123', text: '太棒了！😍', time: '1m ago', avatar: null, avatarEmoji: getStableEmojiAvatar('video-comment-User123') },
                { id: 2, name: 'K-Pop Fan', text: 'Love this team!!!', time: '5m ago', avatar: null, avatarEmoji: getStableEmojiAvatar('video-comment-K-Pop Fan') },
                { id: 3, name: 'Stan', text: '❤️❤️❤️', time: '1h ago', avatar: null, avatarEmoji: getStableEmojiAvatar('video-comment-Stan') }
            ];
        }

        renderVideoComments();

        // User Avatar in Input
        const userAvatarDiv = document.getElementById('bstage-comment-user-avatar');
        if (window.userState && window.userState.avatarUrl) {
            userAvatarDiv.innerHTML = `<img src="${window.userState.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            userAvatarDiv.innerHTML = '<i class="fas fa-user" style="color:#888;font-size:16px;display:flex;justify-content:center;align-items:center;height:100%;"></i>';
        }

        window.openView(videoDetailModal);
    }
    
    // Bind Player Placeholder Click (Edit Video)
    videoDetailModal.querySelector('.bstage-video-player-placeholder').addEventListener('click', (e) => {
        // Don't trigger if clicking on a bubble maybe? Or let it trigger.
        // User said "Click play button pops up edit".
        if (currentVideo) {
            openEditVideoSheet(currentVideo);
        }
    });
    
    function openEditVideoSheet(video) {
        document.getElementById('bstage-edit-video-title').value = video.title;
        const desc = video.description || '';
        document.getElementById('bstage-edit-video-desc').value = desc;
        
        const preview = document.getElementById('bstage-edit-video-cover-preview');
        if (video.thumb) {
            preview.src = video.thumb;
            preview.style.display = 'block';
            if (preview.previousElementSibling) preview.previousElementSibling.style.opacity = '0';
        } else {
            preview.src = '';
            preview.style.display = 'none';
            if (preview.previousElementSibling) preview.previousElementSibling.style.opacity = '1';
        }
        
        window.openView(document.getElementById('bstage-edit-video-sheet'));
    }
    
    document.getElementById('bstage-confirm-edit-video-btn').addEventListener('click', () => {
        if (currentVideo) {
            const newTitle = document.getElementById('bstage-edit-video-title').value;
            const newDesc = document.getElementById('bstage-edit-video-desc').value;
            const newCover = document.getElementById('bstage-edit-video-cover-preview').src;
            const hasCover = document.getElementById('bstage-edit-video-cover-preview').style.display !== 'none';
            
            if (newTitle) {
                currentVideo.title = newTitle;
                currentVideo.description = newDesc;
                currentVideo.thumb = hasCover ? newCover : null;
                
                // Refresh Detail View
                document.getElementById('bstage-vid-detail-title').textContent = newTitle;
                document.getElementById('bstage-vid-description').textContent = newDesc || `这是 ${currentTeam.name} 的精彩视频内容...`; // Fallback
                
                // Refresh Player Placeholder BG
                const playerPlaceholder = videoDetailModal.querySelector('.bstage-video-player-placeholder');
                if (currentVideo.thumb) {
                    playerPlaceholder.style.backgroundImage = `url('${currentVideo.thumb}')`;
                    playerPlaceholder.style.backgroundSize = 'cover';
                    playerPlaceholder.style.backgroundPosition = 'center';
                    playerPlaceholder.classList.add('has-cover');
                    
                    // Remove play icon if it was there and no bubbles
                    if (!playerPlaceholder.querySelector('.bstage-video-content-bubble')) {
                         playerPlaceholder.innerHTML = '';
                    }
                } else {
                    playerPlaceholder.style.backgroundImage = '';
                    playerPlaceholder.classList.remove('has-cover');
                    // Restore play icon if no bubbles
                    if (!playerPlaceholder.querySelector('.bstage-video-content-bubble')) {
                        playerPlaceholder.innerHTML = '<i class="fas fa-play" style="font-size: 40px; opacity: 0.8; align-self: center; margin-top: auto; margin-bottom: auto;"></i>';
                    }
                }
                
                // Refresh Content List (Background Sync)
                if (currentTeam) {
                    // renderContent re-renders everything, which might lose scroll position or state if we were in the list view.
                    // But we are in the detail modal now. Re-rendering the underlying view is fine.
                    // However, renderContent binds click events. If we re-render, the DOM nodes are replaced.
                    // This is okay because we are in a modal on top of it.
                    renderContent(currentTeam);
                }
                
                window.closeView(document.getElementById('bstage-edit-video-sheet'));
                window.showToast('视频信息已更新');
            }
        }
    });

    document.getElementById('bstage-delete-video-btn').addEventListener('click', () => {
        if (!currentTeam || !currentVideo || !Array.isArray(currentTeam.videos)) return;
        if (!confirm('确定要删除这个视频吗？')) return;

        const target = currentVideo;
        const before = currentTeam.videos.length;
        currentTeam.videos = currentTeam.videos.filter(video => {
            if (video === target) return false;
            if (video.id && target.id) return video.id !== target.id;
            return !(video.title === target.title && video.duration === target.duration && video.date === target.date);
        });

        if (currentTeam.videos.length === before) {
            window.showToast('未找到要删除的视频');
            return;
        }

        saveBstageData();
        renderContent(currentTeam);
        currentVideo = null;
        window.closeView(document.getElementById('bstage-edit-video-sheet'));
        window.closeView(videoDetailModal);
        window.showToast('视频已删除');
    });

    // Bind Magic Wand
    document.getElementById('bstage-video-detail-magic-btn').addEventListener('click', () => {
        if (currentVideo) {
            openGenerateTypeSheet({
                title: '生成视频详情',
                label: '想看什么类型的视频细节',
                placeholder: '例如：后台互动、开箱、舞台花絮；留空则随机',
                onConfirm: (request) => triggerVideoDetailApi(currentVideo, request)
            });
        }
    });

    async function triggerVideoDetailApi(video, requestType = '') {
        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
            window.showToast('请先在系统设置中配置 API');
            return;
        }

        window.showToast('正在生成内容...');
        
        let charInfo = "团队成员:\n";
        if (currentTeam.members) {
            currentTeam.members.forEach(m => {
                charInfo += `- ${m.name} (${m.role})\n`;
            });
        }
        
const prompt = `
你是一个偶像视频内容生成器。
请根据以下信息，生成视频简介、视频画面的内容描述（分镜/字幕），以及几条粉丝评论。
团队: ${currentTeam.name}
${charInfo}
视频标题: ${video.title}
视频简介: ${video.description || '无'}
用户想看的类型: ${requestType || '留空，随机生成适合该视频的细节'}

要求：
1. "description": 生成一段自然的视频简介，贴合团队/账号和用户想看的类型。
2. "content": 生成 5 到 10 条简短的视频画面描述或字幕文本，用于逐条显示在视频画面上。内容要有趣，符合人设。
3. "comments": 生成 2 到 3 条粉丝评论，包含 name、text、trans。非中文 text 必须提供自然中文翻译，中文 text 的 trans 为空字符串。
4. 返回严格的 JSON 格式，不要 markdown 标记。
格式示例:
{
  "description": "视频简介",
  "content": ["成员A正在大笑", "字幕: 今天天气真好", "成员B突然闯入镜头"],
  "comments": [
    {"name": "Fan1", "text": "太可爱了！", "trans": ""},
    {"name": "Fan2", "text": "Love this!", "trans": "太喜欢了！"}
  ]
}
`;

        try {
            const endpoint = window.u2Api.resolveChatCompletionsEndpoint(window.apiConfig.endpoint);

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.apiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: window.apiConfig.model || 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: 'You are a JSON generator.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7
                })
            });

            if (!response.ok) throw new Error('API Error');
            const data = await response.json();
            let aiReply = data.choices[0].message.content;
            aiReply = aiReply.replace(/```json/g, '').replace(/```/g, '').trim();
            
            const result = JSON.parse(aiReply);

            if (result.description) {
                video.description = stripGeneratedText(result.description);
                const descEl = document.getElementById('bstage-vid-description');
                if (descEl) descEl.textContent = video.description;
            }
            
            // Handle Content
            if (result.content && Array.isArray(result.content)) {
                video.generatedContent = result.content;
                // Render Bubbles
                const playerPlaceholder = videoDetailModal.querySelector('.bstage-video-player-placeholder');
                playerPlaceholder.innerHTML = '';
                
                let delay = 0;
                result.content.forEach(text => {
                    setTimeout(() => {
                        const bubble = document.createElement('div');
                        bubble.className = 'bstage-video-content-bubble';
                        bubble.textContent = text;
                        playerPlaceholder.appendChild(bubble);
                        playerPlaceholder.scrollTop = playerPlaceholder.scrollHeight;
                    }, delay);
                    delay += 800; // Staggered appearance
                });
            }
            
            // Handle Comments
            if (result.comments && Array.isArray(result.comments)) {
                result.comments.forEach(c => {
                    const name = stripGeneratedText(c && c.name, 'Fan');
                    video.comments.unshift({
                        id: Date.now() + Math.random(),
                        name,
                        text: stripGeneratedText(c && c.text),
                        trans: stripGeneratedText(c && (c.trans || c.translationZh || c.translation)),
                        time: 'Just now',
                        avatar: null,
                        avatarEmoji: getStableEmojiAvatar(`video-comment-${name}-${Date.now()}-${Math.random()}`),
                        replies: []
                    });
                });
                renderVideoComments();
            }
            saveBstageData();
            
            window.showToast('内容生成完成');

        } catch (e) {
            console.error(e);
            window.showToast('生成失败');
        }
    }

    function setPendingVideoCommentReply(comment) {
        pendingVideoCommentReply = comment || null;
        const preview = document.getElementById('bstage-vid-comment-reply-preview');
        const textEl = document.getElementById('bstage-vid-comment-reply-preview-text');
        if (preview && textEl) {
            if (comment) {
                textEl.textContent = `回复 ${comment.name}: ${getMessageSummary(comment)}`;
                preview.style.display = 'flex';
            } else {
                textEl.textContent = '';
                preview.style.display = 'none';
            }
        }
        const input = document.getElementById('bstage-vid-comment-input');
        if (comment && input) input.focus({ preventScroll: true });
    }

    function renderCommentTranslation(comment) {
        const trans = stripGeneratedText(comment && (comment.trans || comment.translationZh || comment.translation));
        if (!trans) return '';
        return `
            <button class="bstage-comment-trans-btn" type="button">翻译</button>
            <div class="bstage-comment-trans-text" style="display:none;">${escapeHtml(trans)}</div>
        `;
    }

    function renderVideoCommentReplyQuote(comment) {
        if (!comment || !comment.replyTo) return '';
        const speaker = stripGeneratedText(comment.replyTo.name || comment.replyTo.speaker, '评论');
        const text = getMessageSummary({ text: comment.replyTo.text || '' });
        return `
            <div class="bstage-comment-reply-quote">
                <span>回复 ${escapeHtml(speaker)}</span>
                <div>${escapeHtml(text)}</div>
            </div>
        `;
    }

    function renderCommentReplies(comment) {
        if (!comment || !Array.isArray(comment.replies) || comment.replies.length === 0) return '';
        return `
            <div class="bstage-comment-replies">
                ${comment.replies.map(reply => `
                    <div class="bstage-comment-reply-item">
                        <div class="bstage-comment-reply-author">${escapeHtml(reply.name || 'Fan')}</div>
                        <div class="bstage-comment-reply-text">${escapeHtml(reply.text || '')}</div>
                        ${renderCommentTranslation(reply)}
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderVideoComments() {
        if (!currentVideo) return;
        const list = document.getElementById('bstage-vid-comments-list');
        const count = currentVideo.comments.length;
        document.getElementById('bstage-vid-comments-header').textContent = `评论 (${count})`;
        
        list.innerHTML = '';
        currentVideo.comments.forEach(c => {
            const item = document.createElement('div');
            item.className = 'bstage-comment-item';
            const commentName = stripGeneratedText(c && c.name, 'User');
            
            const avatarHtml = c.avatar 
                ? `<img src="${escapeHtml(c.avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                : `<div style="width:100%;height:100%;background:#333;border-radius:50%;display:flex;justify-content:center;align-items:center;color:#fff;">${escapeHtml(c.avatarEmoji || (c.isUser ? commentName.slice(0, 1) || 'U' : getStableEmojiAvatar(`video-comment-${commentName}-${c.id || ''}`)))}</div>`;

            item.innerHTML = `
                <div class="bstage-comment-avatar">${avatarHtml}</div>
                <div class="bstage-comment-content">
                    <div class="bstage-comment-header">
                        <span class="bstage-comment-author">${escapeHtml(commentName)}</span>
                        <span class="bstage-comment-time">${escapeHtml(c.time || '')}</span>
                    </div>
                    ${renderVideoCommentReplyQuote(c)}
                    <div class="bstage-comment-text">${escapeHtml(c.text || '')}</div>
                    ${renderCommentTranslation(c)}
                    ${renderCommentReplies(c)}
                </div>
            `;
            item.addEventListener('click', (e) => {
                if (e.target.closest('.bstage-comment-trans-btn') || e.target.closest('.bstage-comment-replies')) return;
                setPendingVideoCommentReply(c);
            });
            item.querySelectorAll('.bstage-comment-trans-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const trans = btn.nextElementSibling;
                    if (!trans) return;
                    const isHidden = trans.style.display === 'none';
                    trans.style.display = isHidden ? 'block' : 'none';
                    btn.textContent = isHidden ? '收起翻译' : '翻译';
                });
            });
            list.appendChild(item);
        });
    }

    // Comment Input Logic
    const vidInput = document.getElementById('bstage-vid-comment-input');
    const vidSendBtn = document.getElementById('bstage-vid-comment-send-btn');
    const vidReplyCancelBtn = document.getElementById('bstage-vid-comment-reply-cancel-btn');

    if (vidReplyCancelBtn) {
        vidReplyCancelBtn.addEventListener('click', () => setPendingVideoCommentReply(null));
        vidReplyCancelBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setPendingVideoCommentReply(null);
            }
        });
    }

    if (vidInput && vidSendBtn) {
        vidInput.addEventListener('input', () => {
            if (vidInput.value.trim().length > 0) {
                vidSendBtn.classList.remove('disabled');
            } else {
                vidSendBtn.classList.add('disabled');
            }
        });

        const sendVideoComment = () => {
            if (vidSendBtn.classList.contains('disabled')) return;
            
            const text = vidInput.value.trim();
            if (text && currentVideo) {
                const newComment = {
                    id: Date.now(),
                    name: window.userState ? window.userState.name : 'User',
                    avatar: window.userState ? window.userState.avatarUrl : null,
                    text: text,
                    time: 'Just now',
                    isUser: true,
                    replyTo: pendingVideoCommentReply ? {
                        id: pendingVideoCommentReply.id,
                        name: pendingVideoCommentReply.name,
                        text: pendingVideoCommentReply.text
                    } : null,
                    replies: []
                };
                currentVideo.comments.unshift(newComment);
                renderVideoComments();
                vidInput.value = '';
                vidSendBtn.classList.add('disabled');
                setPendingVideoCommentReply(null);
                triggerVideoCommentReplyApi(currentVideo, newComment);
                
                // Scroll to top of comments (optional, layout dependent)
            }
        };

        bindBstageFocusPreservingAction(vidSendBtn, sendVideoComment);
        registerBstageSendInput(vidInput, sendVideoComment, {
            root: videoDetailModal,
            scrollContainer: videoDetailModal.querySelector('.bstage-video-detail-scroll')
        });
    }

    async function triggerVideoCommentReplyApi(video, userComment) {
        if (!video || !userComment) return;
        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
            window.showToast('请先在系统设置中配置 API');
            return;
        }

        let charInfo = "团队成员:\n";
        if (currentTeam && currentTeam.members) {
            currentTeam.members.forEach(m => {
                charInfo += `- ${m.name} (${m.role})\n`;
            });
        }

        const prompt = `
你正在模拟 b.stage 视频评论区。
团队/账号：${currentTeam ? currentTeam.name : 'User'}
${charInfo}
视频标题：${video.title || '未命名视频'}
视频简介：${video.description || '无'}
User 评论：${userComment.text}
${userComment.replyTo ? `User 正在回复评论：${userComment.replyTo.name}: ${userComment.replyTo.text}` : ''}

要求：
1. 生成不少于 10 条、最多 14 条来自粉丝/观众的回复，围绕 User 的评论自然互动。
2. 可以有人赞同、补充、提问、羡慕或讨论视频内容。
3. b.stage 是国际化应用，text 可以是中文或外文；非中文 text 必须提供自然中文翻译 trans，中文则 trans 为空字符串。
4. 只返回严格 JSON 数组，不要 markdown。
格式：
[
  { "name": "评论者", "text": "原文", "trans": "中文翻译或空" }
]
`;

        try {
            const replies = await callBstageJsonApi(prompt, 'You generate strict JSON arrays for b.stage video comment replies.', 0.85);
            if (!Array.isArray(replies)) throw new Error('invalid_comment_replies');
            const normalized = replies.slice(0, 14).map((item, index) => {
                const name = stripGeneratedText(item && item.name, getRandomFanName(index));
                const text = stripGeneratedText(typeof item === 'string' ? item : item && item.text);
                const trans = stripGeneratedText(item && (item.trans || item.translationZh || item.translation));
                if (!text) return null;
                if (fanMessageNeedsTranslation(text) && !trans) return null;
                return {
                    id: Date.now() + Math.random(),
                    name,
                    text,
                    trans,
                    avatarEmoji: getStableEmojiAvatar(`video-comment-reply-${name}-${index}-${Date.now()}`),
                    time: 'Just now'
                };
            }).filter(Boolean);
            if (normalized.length < 10) throw new Error('too_few_comment_replies');
            userComment.replies = normalized;
            saveBstageData();
            renderVideoComments();
        } catch (e) {
            console.error('Bstage video comment reply API failed:', e);
            window.showToast('生成评论回复失败');
        }
    }

    async function triggerContentApi(team, series, requestType = '') {
        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
            window.showToast('请先在系统设置中配置 API');
            return;
        }
        if (!Array.isArray(team.videos)) team.videos = [];
        if (!Array.isArray(team.contentSeries)) team.contentSeries = ['全部'];

        window.showToast('正在生成视频物料...');
        
        let charInfo = "团队成员:\n";
        if (Array.isArray(team.members) && team.members.length > 0) {
            team.members.forEach(m => {
                charInfo += `- ${m.name} (${m.role})\n`;
            });
        } else {
            charInfo += '- 暂无成员\n';
        }
        
        const prompt = `
你是一个偶像团体的内容策划。
请根据以下团队信息和角色人设，以及系列主题，生成2-3个相关的视频物料。
团队名称: ${team.name}
团队简介: ${team.desc || '无'}
${charInfo}
系列主题: ${series}
用户想看的类型: ${requestType || '留空，随机生成适合该团队/账号的视频内容'}

要求：
1. 如果用户填写了想看的类型，视频必须围绕该类型生成；如果留空，则随机生成有吸引力的视频内容。
2. 生成虚拟的时长(如 12:30)、观看量(如 1.2M)、发布日期(如 2 days ago)。
3. series 可以沿用当前系列，也可以根据用户想看的类型给出新系列名。
4. 返回严格的 JSON 数组格式，不要 markdown 标记。
格式示例:
[
  {"title": "Video Title 1", "duration": "10:05", "views": "500K", "date": "1 day ago", "series": "vlog"},
  {"title": "Video Title 2", "duration": "03:20", "views": "1.2M", "date": "3 days ago", "series": "behind"}
]
`;

        try {
            const endpoint = window.u2Api.resolveChatCompletionsEndpoint(window.apiConfig.endpoint);

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.apiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: window.apiConfig.model || 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: 'You are a JSON generator.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7
                })
            });

            if (!response.ok) throw new Error('API Error');
            const data = await response.json();
            let aiReply = data.choices[0].message.content;
            aiReply = aiReply.replace(/```json/g, '').replace(/```/g, '').trim();
            
            const newItems = JSON.parse(aiReply);
            
            if (Array.isArray(newItems)) {
                newItems.forEach(item => {
                    const title = stripGeneratedText(item && item.title, 'New Video');
                    const itemSeries = stripGeneratedText(item && item.series, series === '全部' ? (requestType || 'vlog') : series);
                    if (itemSeries && !team.contentSeries.includes(itemSeries)) team.contentSeries.push(itemSeries);
                    team.videos.unshift({
                        title,
                        duration: stripGeneratedText(item && item.duration, '10:05'),
                        views: stripGeneratedText(item && item.views, '500K'),
                        date: stripGeneratedText(item && item.date, 'Just now'),
                        thumb: createExternalRandomImage(`${team.id || team.name}-content-${title}-${Date.now()}`, 800, 450),
                        series: itemSeries
                    });
                });
                saveBstageData();
                renderContent(team); // Refresh
                window.showToast(`已生成 ${newItems.length} 个视频`);
            }
        } catch (e) {
            console.error(e);
            window.showToast('生成失败');
        }
    }

    function renderPlaceHolder(title) {
        contentArea.innerHTML = `
            <div style="height: 100%; display: flex; justify-content: center; align-items: center; color: #666; background-color: #000;">
                ${title} 功能暂空
            </div>
        `;
    }

    function updateNavIndicator(activeEl) {
        const indicator = document.querySelector('.bstage-nav-indicator');
        const nav = document.querySelector('.bstage-bottom-nav');
        if (!indicator || !activeEl || !nav) return;
        
        const navRect = nav.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();
        
        // 5px offset due to nav padding
        const offsetLeft = activeRect.left - navRect.left - 5;
        
        indicator.style.width = `${activeRect.width}px`;
        indicator.style.transform = `translateX(${offsetLeft}px)`;
    }

    // Tab Switching
    document.querySelectorAll('.bstage-nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!currentTeam) return;
            
            // Clear Interval if leaving content
            if (contentCarouselInterval) {
                clearInterval(contentCarouselInterval);
                contentCarouselInterval = null;
            }

            document.querySelectorAll('.bstage-nav-item').forEach(el => el.classList.remove('active'));
            e.target.classList.add('active');
            updateNavIndicator(e.target);
            
            const tab = e.target.getAttribute('data-tab');
            
            // Access Control
            if ((tab === 'content' || tab === 'shop') && !currentTeam.isSubscribed && !isUserTeam(currentTeam)) {
                renderLockedState(tab);
            } else {
                if (tab === 'home') renderTeamHome(currentTeam);
                else if (tab === 'pop') renderTeamPop(currentTeam);
                else if (tab === 'content') renderContent(currentTeam);
                else if (tab === 'shop') renderShop(currentTeam);
            }
        });
    });

    function renderLockedState(title) {
        contentArea.innerHTML = `
            <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; color: #666; background-color: #000; gap: 20px;">
                <i class="fas fa-lock" style="font-size: 40px; opacity: 0.5;"></i>
                <div>需要订阅会员才能查看 ${title}</div>
                <div class="bstage-pop-sub-btn" id="bstage-locked-sub-btn" style="background-color: #007aff; color: #fff; padding: 10px 24px;">去订阅</div>
            </div>
        `;
        document.getElementById('bstage-locked-sub-btn').addEventListener('click', openSubModal);
    }

    // Sub Modal Logic
    function openSubModal() {
        window.openView(subModal);
    }

    document.querySelectorAll('.bstage-price-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.bstage-price-option').forEach(o => {
                o.classList.remove('selected');
                o.style.borderColor = '#333';
            });
            opt.classList.add('selected');
            opt.style.borderColor = '#fff';
        });
    });

    document.getElementById('bstage-confirm-sub-btn').addEventListener('click', () => {
        if (currentTeam) {
            currentTeam.isSubscribed = true;
            
            // Add Order
            const selectedOpt = subModal.querySelector('.bstage-price-option.selected');
            const title = selectedOpt.querySelector('.bstage-price-title').textContent;
            const price = selectedOpt.querySelector('.bstage-price-amount').textContent;
            
            bstageOrders.unshift({
                id: Date.now(),
                title: `${currentTeam.name} - ${title}`,
                price: price,
                date: new Date().toLocaleDateString(),
                type: 'Membership'
            });

            window.showToast('订阅成功！您现在可以访问 Content 和 Shop。');
            
            // Refresh current view if it was home to update button text potentially, or just close
            if(document.querySelector('.bstage-nav-item[data-tab="home"]').classList.contains('active')) {
                renderTeamHome(currentTeam);
            }
        }
        window.closeView(subModal);
    });

    // User Profile Logic
    const profileBtn = bstageView.querySelector('.bstage-avatar-placeholder');
    profileBtn.addEventListener('click', () => {
        // Sync user data
        const userName = window.userState ? window.userState.name : 'User';
        const userAvatar = window.userState ? window.userState.avatarUrl : null;
        
        document.getElementById('bstage-profile-name-display').textContent = userName;
        const avatarDisplay = document.getElementById('bstage-profile-avatar-display');
        const avatarIcon = document.getElementById('bstage-profile-avatar-icon');
        
        if (userAvatar) {
            avatarDisplay.src = userAvatar;
            avatarDisplay.style.display = 'block';
            avatarIcon.style.display = 'none';
        } else {
            avatarDisplay.style.display = 'none';
            avatarIcon.style.display = 'block';
        }
        updateBstageProfileStats();
        
        window.openView(userProfileModal);
    });

    // Edit Profile Logic
    document.getElementById('bstage-edit-profile-btn').addEventListener('click', () => {
        const userName = window.userState ? window.userState.name : '';
        const userAvatar = window.userState ? window.userState.avatarUrl : '';
        const userPersona = window.userState && window.userState.persona ? window.userState.persona : '';
        
        document.getElementById('bstage-edit-profile-name').value = userName;
        const personaInput = document.getElementById('bstage-edit-profile-persona');
        if (personaInput) personaInput.value = userPersona;
        
        const preview = document.getElementById('bstage-edit-profile-avatar-preview');
        const uploadIcon = document.querySelector('#bstage-edit-profile-avatar-upload i');
        
        if (userAvatar) {
            preview.src = userAvatar;
            preview.style.display = 'block';
            uploadIcon.style.display = 'none';
        } else {
            preview.src = '';
            preview.style.display = 'none';
            uploadIcon.style.display = 'block';
        }
        
        window.openView(editProfileModal);
    });

    // Setup Edit Profile Avatar Upload
    setupFileUpload('bstage-edit-profile-avatar-upload', 'input', 'bstage-edit-profile-avatar-preview');
    // We need to handle icon display logic on change manually since helper is simple
    document.querySelector('#bstage-edit-profile-avatar-upload input').addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            document.querySelector('#bstage-edit-profile-avatar-upload i').style.display = 'none';
        }
    });

    document.getElementById('bstage-save-profile-btn').addEventListener('click', () => {
        const newName = document.getElementById('bstage-edit-profile-name').value;
        const newAvatar = document.getElementById('bstage-edit-profile-avatar-preview').src;
        const hasAvatar = document.getElementById('bstage-edit-profile-avatar-preview').style.display !== 'none';
        
        const personaInput = document.getElementById('bstage-edit-profile-persona');
        const newPersona = personaInput ? personaInput.value : '';
        
        if (window.userState) {
            window.userState.name = newName;
            if (hasAvatar) window.userState.avatarUrl = newAvatar;
            window.userState.persona = newPersona;
            
            // Sync global UI if function exists
            if (window.syncUIs) window.syncUIs();
            if (window.saveGlobalData) window.saveGlobalData();
            
            // Update local bstage profile modal if open (it is)
            document.getElementById('bstage-profile-name-display').textContent = newName;
            if (hasAvatar) {
                document.getElementById('bstage-profile-avatar-display').src = newAvatar;
                document.getElementById('bstage-profile-avatar-display').style.display = 'block';
                document.getElementById('bstage-profile-avatar-icon').style.display = 'none';
            }
            renderFollowingBar();
            if (isUserTeam(currentTeam)) {
                currentTeam = getBstageUserTeam();
            }
        }
        
        window.closeView(editProfileModal);
        window.showToast('资料已更新');
    });

    // Orders Logic
    document.getElementById('bstage-my-orders-btn').addEventListener('click', () => {
        renderOrders();
        window.openView(ordersModal);
    });

    function withdrawBstageRevenueToPay() {
        const amount = Number(getBstageAvailableRevenueCny().toFixed(2));
        if (!Number.isFinite(amount) || amount <= 0) {
            window.showToast('暂无可提现收益');
            updateBstageProfileStats();
            return;
        }
        if (typeof window.addPayTransaction !== 'function') {
            window.showToast('Pay 暂不可用，请稍后重试');
            return;
        }
        const success = window.addPayTransaction(amount, 'b.stage POP 订阅收益', 'income');
        if (!success) {
            window.showToast('提现失败，请稍后重试');
            return;
        }
        bstageRevenueState.withdrawnCny = getBstageWithdrawnRevenueCny() + amount;
        bstageRevenueState.lastWithdrawAt = Date.now();
        saveBstageData();
        updateBstageProfileStats();
    }

    document.getElementById('bstage-withdraw-revenue-btn').addEventListener('click', withdrawBstageRevenueToPay);

    ordersModal.addEventListener('click', (e) => {
        if (e.target === ordersModal) window.closeView(ordersModal);
    });

    function renderOrders() {
        const container = document.getElementById('bstage-orders-list');
        container.innerHTML = '';
        
        if (bstageOrders.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">暂无订单记录</div>';
            return;
        }

        bstageOrders.forEach(order => {
            const item = document.createElement('div');
            item.style.cssText = 'background: #2c2c2e; padding: 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;';
            item.innerHTML = `
                <div>
                    <div style="font-weight: 600; color: #fff; font-size: 15px;">${order.title}</div>
                    <div style="font-size: 12px; color: #aaa; margin-top: 4px;">${order.date} • ${order.type}</div>
                </div>
                <div style="font-weight: 700; color: #fff;">${order.price}</div>
            `;
            container.appendChild(item);
        });
    }

    // Fan Chat Logic
    const fallbackFanNames = ['Starry', 'Mina', 'Joon', 'Luna', 'BlueFan', 'Ari', 'Momo', 'Nabi', 'Echo', 'Summer'];

    function getCurrentChatTimeText(timestamp = Date.now()) {
        if (typeof window.formatChatBubbleTime === 'function') return window.formatChatBubbleTime(timestamp);
        const d = new Date(timestamp);
        return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
    }

    function getRandomFanName(index = 0) {
        return fallbackFanNames[Math.floor(Math.random() * fallbackFanNames.length)] || `Fan${index + 1}`;
    }

    function fanMessageNeedsTranslation(text) {
        const value = String(text || '');
        const hasChinese = /[\u3400-\u9fff]/.test(value);
        const hasForeignScript = /[A-Za-z\u3040-\u30ff\uac00-\ud7af\u0400-\u04ff]/.test(value);
        return hasForeignScript && !hasChinese;
    }

    function normalizeBstageSubscriberCount(value) {
        const numeric = parseInt(value, 10);
        if (!Number.isFinite(numeric)) return 0;
        return Math.max(0, Math.min(BSTAGE_MAX_SUBSCRIBERS, numeric));
    }

    function getFanSubscriberCount() {
        if (bstageFanSubscriberCount == null || !Number.isFinite(Number(bstageFanSubscriberCount))) {
            bstageFanSubscriberCount = Math.floor(800 + Math.random() * 9200);
            saveBstageData();
        }
        bstageFanSubscriberCount = normalizeBstageSubscriberCount(bstageFanSubscriberCount);
        return bstageFanSubscriberCount;
    }

    function formatBstageSubscriberCount(value) {
        const count = normalizeBstageSubscriberCount(value);
        if (count >= 1000000) {
            const millions = Math.floor(count / 10000) / 100;
            return `${millions}M`;
        }
        if (count >= 1000) {
            const thousands = Math.floor(count / 100) / 10;
            return `${thousands}K`;
        }
        return String(count);
    }

    function getFanSubscriberText() {
        return `已订阅 ${formatBstageSubscriberCount(getFanSubscriberCount())} 人`;
    }

    function getBstageTotalRevenueCny() {
        return getFanSubscriberCount() * BSTAGE_POP_MONTHLY_KRW * BSTAGE_KRW_TO_CNY;
    }

    function getBstageWithdrawnRevenueCny() {
        const value = Number(bstageRevenueState && bstageRevenueState.withdrawnCny);
        return Number.isFinite(value) ? Math.max(0, value) : 0;
    }

    function getBstageAvailableRevenueCny() {
        return Math.max(0, getBstageTotalRevenueCny() - getBstageWithdrawnRevenueCny());
    }

    function formatBstageCny(value) {
        return `￥${Math.max(0, Number(value) || 0).toFixed(2)}`;
    }

    function updateBstageProfileStats() {
        const subCountEl = document.getElementById('bstage-profile-pop-sub-count');
        const revenueEl = document.getElementById('bstage-profile-sub-revenue');
        const withdrawBtn = document.getElementById('bstage-withdraw-revenue-btn');
        const count = getFanSubscriberCount();
        const available = getBstageAvailableRevenueCny();
        if (subCountEl) subCountEl.textContent = formatBstageSubscriberCount(count);
        if (revenueEl) revenueEl.textContent = formatBstageCny(available);
        if (withdrawBtn) {
            withdrawBtn.style.opacity = available > 0 ? '1' : '0.55';
            withdrawBtn.setAttribute('aria-disabled', available > 0 ? 'false' : 'true');
            withdrawBtn.title = available > 0 ? `可提现 ${formatBstageCny(available)}` : '暂无可提现收益';
        }
    }

    function getFanSubscriberGrowthDelta(burst = false) {
        if (burst) {
            return 1 + Math.floor(Math.random() * 5);
        }
        const weightedDeltas = [0, 0, 1, 1, 2];
        return weightedDeltas[Math.floor(Math.random() * weightedDeltas.length)] || 0;
    }

    function growFanSubscriberCount(burst = false) {
        const currentCount = getFanSubscriberCount();
        if (currentCount >= BSTAGE_MAX_SUBSCRIBERS) {
            updateFanSubscriberLabels();
            return;
        }
        const delta = getFanSubscriberGrowthDelta(burst);
        if (delta <= 0) {
            updateFanSubscriberLabels();
            return;
        }
        bstageFanSubscriberCount = normalizeBstageSubscriberCount(currentCount + delta);
        updateFanSubscriberLabels();
        saveBstageData();
    }

    function randomizeFanSubscriberCount() {
        growFanSubscriberCount(true);
    }

    function scheduleFanSubscriberGrowth() {
        if (bstageFanSubscriberGrowthTimer) {
            clearTimeout(bstageFanSubscriberGrowthTimer);
        }
        bstageFanSubscriberGrowthTimer = null;
        if (getFanSubscriberCount() >= BSTAGE_MAX_SUBSCRIBERS) return;
        const delay = 30000 + Math.floor(Math.random() * 60000);
        bstageFanSubscriberGrowthTimer = setTimeout(() => {
            growFanSubscriberCount(false);
            scheduleFanSubscriberGrowth();
        }, delay);
    }

    function startFanSubscriberGrowth() {
        getFanSubscriberCount();
        updateFanSubscriberLabels();
        if (!bstageFanSubscriberGrowthTimer) {
            scheduleFanSubscriberGrowth();
        }
    }

    function updateFanSubscriberLabels() {
        const text = getFanSubscriberText();
        const subtitle = document.getElementById('bstage-fan-chat-subtitle');
        const detailSubscribers = document.getElementById('bstage-fan-detail-subscribers');
        if (subtitle) subtitle.textContent = text;
        if (detailSubscribers) detailSubscribers.textContent = text;
        document.querySelectorAll('.bstage-fan-subscriber-label').forEach(el => {
            el.textContent = text;
        });
        updateBstageProfileStats();
    }

    function syncFanChatTranslationState() {
        const content = document.getElementById('bstage-fan-chat-content');
        if (!content) return;
        content.classList.toggle('show-trans', isTranslationEnabled);
    }

    function applyFanChatSettings() {
        const fanView = document.getElementById('bstage-fan-chat-view');
        if (fanView) {
            if (bstageFanChatSettings.chatBg) {
                fanView.style.backgroundImage = `url('${bstageFanChatSettings.chatBg}')`;
                fanView.style.backgroundSize = 'cover';
                fanView.style.backgroundPosition = 'center';
            } else {
                fanView.style.backgroundImage = 'none';
                fanView.style.backgroundColor = '#1c1c1e';
            }
        }
        applyDynamicStyles();
        syncFanChatTranslationState();
    }

    function openFanChatDetailSheet() {
        updateFanSubscriberLabels();
        populateFanCssSelects();
        applyFanChatSettings();

        const userName = window.userState && window.userState.name ? window.userState.name : 'User';
        const userAvatar = window.userState && window.userState.avatarUrl ? window.userState.avatarUrl : '';
        const detailName = document.getElementById('bstage-fan-detail-name');
        const avatar = document.getElementById('bstage-fan-detail-avatar');
        const avatarIcon = document.getElementById('bstage-fan-detail-avatar-icon');
        if (detailName) detailName.textContent = `${userName} 的粉丝聊天室`;
        if (avatar && avatarIcon) {
            if (userAvatar) {
                avatar.src = userAvatar;
                avatar.style.display = 'block';
                avatarIcon.style.display = 'none';
            } else {
                avatar.src = '';
                avatar.style.display = 'none';
                avatarIcon.style.display = 'block';
            }
        }

        const contextSwitch = document.getElementById('bstage-fan-context-switch');
        const contextCount = document.getElementById('bstage-fan-context-count');
        const transSwitch = document.getElementById('bstage-fan-trans-switch');
        if (contextSwitch) contextSwitch.classList.toggle('active', isContextEnabled);
        if (contextCount) contextCount.value = contextMessageCount;
        if (transSwitch) transSwitch.classList.toggle('active', isTranslationEnabled);

        window.openView(fanChatDetailSheet);
    }

    function buildFanChatUserTeamContext() {
        const userTeam = getBstageUserTeam();
        const members = Array.isArray(userTeam.members) ? userTeam.members : [];
        const videos = Array.isArray(userTeam.videos) ? userTeam.videos.slice(0, 8) : [];
        const items = Array.isArray(userTeam.shopItems) ? userTeam.shopItems.slice(0, 8) : [];
        const memberSummary = members.length
            ? members.map(member => `- ${member.name || '未命名成员'}：${member.role || '暂无人设'}`).join('\n')
            : '暂无团队成员。';
        const contentSummary = videos.length
            ? videos.map(v => `- ${v.title || '未命名视频'}${v.description ? `：${v.description}` : ''}`).join('\n')
            : '暂无视频物料。';
        const shopSummary = items.length
            ? items.map(item => `- ${item.name || '未命名商品'}（${item.category || '商品'}，${item.price || '未定价'}）${item.desc ? `：${item.desc}` : ''}`).join('\n')
            : '暂无周边商品。';
        return `User 团队资料：\n团队名：${userTeam.name || 'User'}\n团队简介：${userTeam.desc || '无'}\n\nUser 团队成员：\n${memberSummary}\n\nUser 团队 Content 视频物料：\n${contentSummary}\n\nUser 团队 Shop 周边商品：\n${shopSummary}`;
    }

    function appendFanDateIfNeeded(contentContainer, timestamp) {
        let lastMsg = null;
        for (let i = bstageFanChatHistory.length - 1; i >= 0; i--) {
            if (bstageFanChatHistory[i].type !== 'date') {
                lastMsg = bstageFanChatHistory[i];
                break;
            }
        }

        const timeThreshold = 5 * 60 * 1000;
        if (!lastMsg || !lastMsg.timestamp || timestamp - lastMsg.timestamp > timeThreshold) {
            const timeText = formatTimeBubble(timestamp);
            const dateMsg = { type: 'date', text: timeText, timestamp };
            bstageFanChatHistory.push(dateMsg);
            if (contentContainer) appendFanChatMessage(dateMsg, contentContainer);
        }
    }

    function appendFanChatMessage(msg, contentContainer) {
        if (!contentContainer || !msg) return;

        if (msg.type === 'date') {
            const dateDiv = document.createElement('div');
            dateDiv.className = 'bstage-chat-date';
            dateDiv.textContent = msg.text;
            contentContainer.appendChild(dateDiv);
            return;
        }

        ensureMessageId(msg, msg.isUser ? 'user' : 'fan');

        if (msg.isUser) {
            const msgDiv = document.createElement('div');
            msgDiv.className = 'bstage-chat-msg outgoing';
            msgDiv.dataset.msgId = msg.id;
            msgDiv.innerHTML = `
                <div class="bstage-msg-status">
                    <div class="bstage-msg-status-text">已发送</div>
                    <div class="bstage-msg-time">${escapeHtml(msg.time || getCurrentChatTimeText(msg.timestamp))}</div>
                </div>
                <div class="bstage-chat-bubble">
                    ${renderReplyQuote(msg.replyTo)}
                    <div class="bstage-msg-text">${escapeHtml(msg.text)}</div>
                </div>
            `;
            contentContainer.appendChild(msgDiv);
            return;
        }

        const fanName = stripGeneratedText(msg.name, '粉丝');
        msg.avatarEmoji = msg.avatarEmoji || getStableEmojiAvatar(`bstage-fan-${fanName}-${msg.id || msg.timestamp || ''}`);
        const transText = stripGeneratedText(msg.trans);
        const replyDiv = document.createElement('div');
        replyDiv.className = 'bstage-chat-msg income';
        replyDiv.dataset.msgId = msg.id;
        replyDiv.innerHTML = `
            ${renderBstageAvatar(msg, fanName, 'bstage-chat-avatar')}
            <div class="bstage-chat-bubble">
                ${renderReplyQuote(msg.replyTo)}
                <div class="bstage-fan-chat-sender">${escapeHtml(fanName)}</div>
                <div class="bstage-msg-text">${escapeHtml(msg.text)}</div>
                ${transText ? `<div class="bstage-trans-text">${escapeHtml(transText)}</div>` : ''}
            </div>
            <button class="bstage-msg-reply-btn" type="button" aria-label="回复消息" title="回复消息">
                <i class="fas fa-reply"></i>
            </button>
        `;
        const replyBtn = replyDiv.querySelector('.bstage-msg-reply-btn');
        if (replyBtn) {
            replyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                setPendingReply('fan', createReplyMeta(msg, fanName));
            });
        }
        contentContainer.appendChild(replyDiv);
    }

    function renderFanChatHistory() {
        const content = document.getElementById('bstage-fan-chat-content');
        if (!content) return;
        content.innerHTML = '';
        syncFanChatTranslationState();

        if (!Array.isArray(bstageFanChatHistory)) bstageFanChatHistory = [];
        if (bstageFanChatHistory.length === 0) {
            content.innerHTML = '<div class="bstage-system-notice">粉丝聊天室已开启</div>';
        } else {
            bstageFanChatHistory.forEach(msg => appendFanChatMessage(msg, content));
        }
        updateFanSubscriberLabels();

        setTimeout(() => {
            content.scrollTop = content.scrollHeight;
        }, 50);
    }

    function openFanChat() {
        applyFanChatSettings();
        renderFanChatHistory();
        clearPendingReply('fan');
        window.openView(bstageFanChatView);
        const input = document.getElementById('bstage-fan-chat-input');
        setTimeout(() => {
            if (input) input.focus({ preventScroll: true });
        }, 80);
    }

    function sendFanChatMessage() {
        const input = document.getElementById('bstage-fan-chat-input');
        const content = document.getElementById('bstage-fan-chat-content');
        if (!input || !content) return;

        const text = input.value.trim();
        if (!text) return;

        if (content.querySelector('.bstage-system-notice') && bstageFanChatHistory.length === 0) {
            content.innerHTML = '';
        }

        const now = Date.now();
        appendFanDateIfNeeded(content, now);
        const msg = {
            id: createBstageMessageId('user'),
            isUser: true,
            type: 'text',
            text,
            time: getCurrentChatTimeText(now),
            timestamp: now,
            replyTo: pendingFanReply ? { ...pendingFanReply } : null
        };
        bstageFanChatHistory.push(msg);
        appendFanChatMessage(msg, content);
        saveBstageData();

        input.value = '';
        clearPendingReply('fan');
        content.scrollTop = content.scrollHeight;
    }

    async function triggerFanChatApi() {
        const apiBtn = document.getElementById('bstage-fan-chat-api-btn');
        const input = document.getElementById('bstage-fan-chat-input');
        const content = document.getElementById('bstage-fan-chat-content');
        if (!content || !apiBtn || apiBtn.classList.contains('is-loading')) return;

        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
            window.showToast('请先在系统设置中配置 API');
            return;
        }

        const userName = window.userState && window.userState.name ? window.userState.name : 'User';
        const userPersona = window.userState && window.userState.persona ? window.userState.persona : '';
        const teamContext = currentTeam ? `当前 b.stage 团队：${currentTeam.name}\n团队信息：${currentTeam.desc || '无'}` : '当前没有选中的 b.stage 团队。';
        const userTeamContext = buildFanChatUserTeamContext();
        const fetchCount = isContextEnabled ? contextMessageCount : 1;
        bstageFanChatHistory.forEach(msg => {
            if (msg && msg.type !== 'date') ensureMessageId(msg, msg.isUser ? 'user' : 'fan');
        });
        const userMessages = bstageFanChatHistory
            .filter(msg => msg && msg.type === 'text' && msg.isUser && msg.text)
            .slice(-fetchCount);
        const history = userMessages.length
            ? userMessages.map(msg => formatMessageForPrompt(msg, userName)).join('\n')
            : '暂无 User 发言。';
        const validUserReplyIds = userMessages.map(msg => msg.id).filter(Boolean);

        const systemDepthWorldBookContext = window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('system_depth') : '';
        const beforeRoleWorldBookContext = window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('before_role') : '';
        const afterRoleWorldBookContext = window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('after_role') : '';

        const now = new Date();
        const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const realTimeContext = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${days[now.getDay()]} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

        const prompt = `
${systemDepthWorldBookContext ? `System Depth Rules:\n${systemDepthWorldBookContext}\n\n` : ''}${beforeRoleWorldBookContext ? `Before Role Rules:\n${beforeRoleWorldBookContext}\n\n` : ''}你正在模拟 b.stage 的粉丝聊天室。b.stage 是国际化粉丝互动应用。

当前账号 / User：${userName}
User 的人设：${userPersona || '未填写'}
${teamContext}
${userTeamContext}
当前真实时间：${realTimeContext}
${afterRoleWorldBookContext ? `\nAfter Role Rules:\n${afterRoleWorldBookContext}\n` : ''}

上下文只包含 User 自己发过的消息，不包含任何粉丝历史消息。每条都有 id，replyTo 表示 User 正在引用/翻牌某条粉丝消息：
${history}

要求：
1. 你现在扮演的是 ${userName} 的粉丝或订阅者群体，不是 ${userName} 本人，也不是单一角色。
2. 这不是真正的群聊：每个粉丝从自己的视角像是在和 ${userName} 单聊；只有 ${userName} 的界面把很多粉丝消息汇总成聊天室。
3. 如果 User 的某条消息带有 replyTo，说明 User 翻牌/回复了某位粉丝；其他粉丝可能猜测被翻牌的是谁、羡慕、起哄、提出翻牌请求，但不要写成所有粉丝都知道完整群聊上下文。
4. 一次生成不少于 10 条、最多 14 条来自不同粉丝/订阅者的实时聊天室消息。
5. 消息要像真实国际化粉丝互动：可以应援、闲聊、提问、刷屏、玩梗、跨语言互动，不要每条都机械回复 User 上一句话。
6. 可以自然评价 User 的视频物料、讨论已上架周边、期待新物料或询问下一次更新。
7. 粉丝知道 User 团队的名字、简介和成员，可以自然询问 ${userName} 本人的近况、和其他队友的关系/合作/互动，也可以向 ${userName} 提到或追问别的队友。
8. 可以使用中文、英文、韩文、日文或其他符合语境的语言；如果 text 不是纯中文，必须在 trans 中提供自然中文翻译。text 是中文时 trans 为空字符串。
9. 你可以回复某条 User 消息；如需回复，请在该对象中填写 replyToId，值只能从这些 User 消息 id 中选择：${validUserReplyIds.length ? validUserReplyIds.join(', ') : '无'}。不回复则省略或填空。
10. 返回严格 JSON 数组，不要 markdown，不要解释，不要外层对象。
11. 每条必须包含 name、text、trans。

格式：
[
  { "name": "粉丝昵称", "text": "原文消息", "trans": "非中文消息的中文翻译，中文消息则为空字符串", "replyToId": "可选的 User 消息 id" }
]
`;

        setChatActionLoading(apiBtn, true);
        const wasReadOnly = !!input?.readOnly;
        if (input) {
            input.readOnly = true;
            input.setAttribute('aria-busy', 'true');
        }
        try {
            const generated = await callBstageJsonApi(prompt, 'You generate strict JSON arrays for live fan chat messages.', 0.85);
            if (!Array.isArray(generated)) throw new Error('invalid_fan_chat_payload');

            const now = Date.now();
            const messages = generated.slice(0, 14).map((item, index) => {
                const fanName = stripGeneratedText(item && item.name, getRandomFanName(index));
                const text = stripGeneratedText(typeof item === 'string' ? item : item && item.text);
                const trans = stripGeneratedText(item && (item.trans || item.translationZh || item.translation));
                const replyToId = stripGeneratedText(item && (item.replyToId || item.reply_to_id));
                const replySource = findMessageById(bstageFanChatHistory, replyToId, msg => msg && msg.isUser);
                if (!text) return null;
                if (fanMessageNeedsTranslation(text) && !trans) return null;
                return {
                    id: createBstageMessageId('fan'),
                    isUser: false,
                    type: 'text',
                    name: fanName,
                    avatar: null,
                    avatarEmoji: getStableEmojiAvatar(`bstage-fan-${fanName}-${index}`),
                    text,
                    trans,
                    timestamp: now + index,
                    replyTo: replySource ? createReplyMeta(replySource, userName) : null
                };
            }).filter(Boolean);

            if (messages.length < 10) throw new Error('too_few_fan_chat_payload');

            if (content.querySelector('.bstage-system-notice') && bstageFanChatHistory.length === 0) {
                content.innerHTML = '';
            }
            appendFanDateIfNeeded(content, now);
            randomizeFanSubscriberCount();

            messages.forEach((msg, index) => {
                setTimeout(() => {
                    bstageFanChatHistory.push(msg);
                    appendFanChatMessage(msg, content);
                    updateFanSubscriberLabels();
                    saveBstageData();
                    content.scrollTop = content.scrollHeight;
                }, index * 650);
            });
        } catch (error) {
            console.error('Bstage fan chat API failed:', error);
            window.showToast(error && error.message === 'missing_api_config' ? '请先在系统设置中配置 API' : '生成粉丝消息失败');
        } finally {
            if (input) {
                input.readOnly = wasReadOnly;
                input.removeAttribute('aria-busy');
            }
            setChatActionLoading(apiBtn, false);
        }
    }

    const fanChatInput = document.getElementById('bstage-fan-chat-input');
    const fanChatSendBtn = document.getElementById('bstage-fan-chat-send-btn');
    const fanChatApiBtn = document.getElementById('bstage-fan-chat-api-btn');
    if (fanChatInput) {
        registerBstageSendInput(fanChatInput, sendFanChatMessage, {
            root: bstageFanChatView,
            scrollContainer: document.getElementById('bstage-fan-chat-content')
        });
    }
    if (fanChatSendBtn) {
        bindBstageFocusPreservingAction(fanChatSendBtn, sendFanChatMessage);
    }
    if (fanChatApiBtn) {
        bindBstageFocusPreservingAction(fanChatApiBtn, triggerFanChatApi);
    }

    const chatRoomBtn = document.getElementById('bstage-my-chatroom-btn');
    if (chatRoomBtn) {
        chatRoomBtn.addEventListener('click', () => {
            window.closeView(userProfileModal);
            openFanChat();
        });
    }

    // Header Avatar Sync Logic
    function updateHeaderAvatar() {
        const container = document.getElementById('bstage-header-profile-container');
        if (!container) return;
        
        const userAvatar = window.userState ? window.userState.avatarUrl : null;
        if (userAvatar) {
            container.innerHTML = `<img src="${userAvatar}" style="width: 100%; height: 100%; object-fit: cover;">`;
            container.style.overflow = 'hidden';
            container.style.border = 'none';
        } else {
            container.innerHTML = `<i class="fas fa-user"></i>`;
            container.style.overflow = '';
            container.style.border = '';
        }
    }

    // Call on init
    updateHeaderAvatar();

    // Hook into profile save
    const originalSaveProfile = document.getElementById('bstage-save-profile-btn').onclick; // This might be null if added via addEventListener, so we should just append logic inside the existing listener if possible, or use a custom event.
    // Since we used addEventListener, we can't easily hook without modifying the existing listener.
    // However, I can just add another listener to the same button? No, the order matters if I want to use updated state.
    // But the state update is synchronous in the existing listener.
    
    document.getElementById('bstage-save-profile-btn').addEventListener('click', () => {
        // Wait for next tick to ensure state is updated
        setTimeout(updateHeaderAvatar, 50);
    });

    function getBstageDataSignature() {
        const userTeam = getBstageUserTeam();
        const getMemberChatHistoryCounts = (members) => Array.isArray(members)
            ? members.map(member => Array.isArray(member?.chatHistory) ? member.chatHistory.length : 0)
            : [];
        return JSON.stringify({
            updatedAt: bstageStateUpdatedAt,
            teams: teams.map(team => team && team.id),
            teamMemberCounts: teams.map(team => Array.isArray(team && team.members) ? team.members.length : 0),
            teamChatHistoryCounts: teams.map(team => getMemberChatHistoryCounts(team?.members)),
            userTeamMembers: Array.isArray(userTeam.members) ? userTeam.members.length : 0,
            userTeamChatHistoryCounts: getMemberChatHistoryCounts(userTeam.members),
            fanHistoryCount: Array.isArray(bstageFanChatHistory) ? bstageFanChatHistory.length : 0
        });
    }

    function renderBstageStartupView() {
        renderFollowingBar();
        setTimeout(() => {
            const currentTeamId = currentTeam && currentTeam.id;
            const nextTeam = currentTeamId && !isUserTeam(currentTeam)
                ? (teams.find(team => String(team.id) === String(currentTeamId)) || getBstageUserTeam())
                : getBstageUserTeam();
            openTeam(nextTeam);
        }, 50);
    }

    // Initialize UI with loaded data, then recover once more after IndexedDB-backed global data is ready.
    renderBstageStartupView();
    if (window.globalDataReadyPromise && typeof window.globalDataReadyPromise.then === 'function') {
        const beforeGlobalDataReady = getBstageDataSignature();
        window.bstageDataReadyPromise = window.globalDataReadyPromise.then(async () => {
            const normalized = loadBstageData({ persistNormalized: true });
            bstageHydrationComplete = true;
            if (normalized) await saveBstageData({ flush: true });
            const chatWasOpen = !!currentChatMember && bstageChatView.style.display !== 'none';
            const chatRebound = rebindActiveBstageReferences();
            startFanSubscriberGrowth();
            initAllAutoActivities();
            const afterGlobalDataReady = getBstageDataSignature();
            if (afterGlobalDataReady !== beforeGlobalDataReady) {
                renderBstageStartupView();
            }
            if (chatWasOpen && chatRebound) openChat(currentChatMember);
            return true;
        }).catch(error => {
            console.warn('Bstage global data recovery failed:', error);
            bstageHydrationComplete = true;
            startFanSubscriberGrowth();
            initAllAutoActivities();
            return false;
        });
    } else {
        bstageHydrationComplete = true;
        startFanSubscriberGrowth();
        initAllAutoActivities();
        window.bstageDataReadyPromise = Promise.resolve(true);
    }
});
