// u2phone Settings App Logic
// Adapted from iiso/emulator/4_settings.js

(function() {
    // Basic User/Account State Mock
    let accounts = [];
    let currentAccountId = null;
    let userState = {
        name: '',
        phone: '',
        persona: '',
        avatarUrl: null
    };

    function clonePlainData(value) {
        if (typeof structuredClone === 'function') return structuredClone(value);
        return JSON.parse(JSON.stringify(value));
    }

    function syncUserStateFromCurrentAccount() {
        const acc = accounts.find(a => String(a.id) === String(currentAccountId));

        if (acc) {
            userState.name = acc.name || '';
            userState.phone = acc.phone || '';
            userState.persona = acc.persona || '';
            userState.signature = acc.signature || '';
            userState.avatarUrl = acc.avatarUrl || null;
        } else {
            userState.name = '';
            userState.phone = '';
            userState.persona = '';
            userState.signature = '';
            userState.avatarUrl = null;
        }

        window.userState = userState;
        return userState;
    }

    function notifyUserStateUpdated(detail = {}) {
        window.userState = userState;
        const eventDetail = {
            userState: clonePlainData(userState),
            ...detail
        };
        window.dispatchEvent(new CustomEvent('user-state-updated', { detail: eventDetail }));
        if (detail.avatarChanged) {
            window.dispatchEvent(new CustomEvent('avatar-updated', { detail: eventDetail }));
        }
    }

    function exposeAccountGlobals() {
        window.getAccounts = () => accounts;
        window.getCurrentAccountId = () => currentAccountId;
        window.setCurrentAccountId = (id) => {
            currentAccountId = id;
            syncUserStateFromCurrentAccount();
            persistSettingsData();
            notifyUserStateUpdated({ avatarChanged: true });
            return currentAccountId;
        };
    }

    function persistSettingsData() {
        syncUserStateFromCurrentAccount();
        if (!window.appStorage?.commitDomain) return Promise.resolve(false);
        return window.appStorage.commitDomain('settings', (draft) => {
            const nextDraft = {
                ...draft,
                userState: clonePlainData(userState),
                accounts: clonePlainData(accounts),
                currentAccountId,
                apiConfig: clonePlainData(apiConfig),
                vectorMemoryConfig: clonePlainData(vectorMemoryConfig),
                visionConfig: clonePlainData(visionConfig),
                imageGenerationConfig: clonePlainData(imageGenerationConfig),
                ttsConfig: clonePlainData(ttsConfig),
                apiPresets: clonePlainData(apiPresets),
                fetchedModels: clonePlainData(fetchedModels),
                assistiveBallSettings: clonePlainData(assistiveBallSettings),
                themeState: clonePlainData(themeState)
            };
            delete nextDraft.minimaxConfig;
            return nextDraft;
        }, { critical: true, reason: 'settings-update' }).catch((error) => {
            console.warn('Failed to persist settings:', error);
            return false;
        });
    }

    exposeAccountGlobals();

    // ==========================================
    // API Configuration State
    // ==========================================
    let apiConfig = {
        provider: 'openai-compatible',
        endpoint: '',
        apiKey: '',
        model: '',
        temperature: 0.7,
    };
    let vectorMemoryConfig = window.getVectorMemoryConfig
        ? window.getVectorMemoryConfig()
        : (window.vectorMemoryConfig || {});
    let imageGenerationConfig = window.u2ImageGeneration
        ? window.u2ImageGeneration.normalizeConfig(window.imageGenerationConfig)
        : (window.imageGenerationConfig || { activeProvider: 'gemini', providers: {} });
    let visionConfig = window.u2ImageUnderstanding
        ? window.u2ImageUnderstanding.normalizeConfig(window.visionConfig)
        : (window.getVisionConfig ? window.getVisionConfig() : (window.visionConfig || { activeProvider: 'gemini', providers: {} }));
    let ttsConfig = window.u2Tts
        ? window.u2Tts.getConfig()
        : (window.getTtsConfig ? window.getTtsConfig() : (window.ttsConfig || { activeProvider: 'minimax', providers: {} }));
    let apiPresets = [];
    let fetchedModels = [];
    window.getApiPresets = function getApiPresets() {
        return clonePlainData(Array.isArray(apiPresets) ? apiPresets : []);
    };

    function notifyApiPresetsUpdated() {
        window.dispatchEvent(new CustomEvent('u2:api-presets-updated', {
            detail: { presets: window.getApiPresets() }
        }));
    }
    let assistiveBallSettings = {
        enabled: false,
        x: null,
        y: null,
        size: 58,
        opacity: 0.72,
        imageUrl: ''
    };
    
    // 用于保存正在编辑的状态，避免未点保存就污染全局配置
    let tempApiConfig = {};

    // ==========================================
    // Theme Configuration State
    // ==========================================
    const DEFAULT_SYSTEM_THEME_FONT_FAMILY = 'system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    const IMESSAGE_CSS_THEME_TYPES = ['home', 'bubble', 'chat', 'group', 'status'];
    const BUILTIN_THEME_FONTS = [
        {
            key: 'system-default',
            label: '默认',
            cssName: '',
            family: DEFAULT_SYSTEM_THEME_FONT_FAMILY,
            sources: { woff2: '', woff: '', ttf: '', otf: '' }
        }
    ];

    let themeState = {
        bgUrl: null,
        uiChineseEnabled: false,
        apps: [
            { id: 'app-icon-1', name: 'Pay', icon: null },
            { id: 'app-icon-2', name: 'TikTok', icon: null },
            { id: 'app-icon-3', name: 'b.stage', icon: null },
            { id: 'app-icon-4', name: 'X', icon: null },
            { id: 'app-icon-5', name: 'Shop', icon: null },
            { id: 'app-icon-6', name: 'Library', icon: null },
            { id: 'app-icon-7', name: 'Netflix', icon: null },
            { id: 'app-icon-8', name: 'Loves', icon: null },
            { id: 'dock-icon-settings', name: '设置', icon: null },
            { id: 'dock-icon-imessage', name: '信息', icon: null },
            { id: 'dock-icon-youtube', name: 'YouTube', icon: null }
        ],
        fontMode: 'preset', // 'preset' or 'saved'
        fontPresetKey: 'system-default',
        fontFamily: DEFAULT_SYSTEM_THEME_FONT_FAMILY,
        fontCssName: '',
        fontSize: 16,
        fontSources: { woff2: '', woff: '', ttf: '', otf: '' },
        fontSourceType: 'preset',
        fontAssetId: '',
        fontFormat: '',
        savedFontPresets: [],
        imessageCssPresets: {
            home: [],
            bubble: [],
            chat: [],
            group: [],
            status: []
        },
        imessageHomeCssEnabled: false,
        imessageHomeCss: '',
        imessageChatCssEnabled: false,
        imessageChatCss: '',
        imessageGroupCssEnabled: false,
        imessageGroupCss: ''
    };
    window.u2ThemeState = themeState;
    let themeFontRuntimeReady = false;
    
    (window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(async () => {
        // ==========================================
        // Load Saved Data
        // ==========================================
        let savedSettings = null;
        try {
            await window.appStorage?.ready;
            savedSettings = typeof window.appStorage?.readDomain === 'function'
                ? window.appStorage.readDomain('settings', {})
                : null;
        } catch (error) {
            console.warn('Failed to hydrate settings from IndexedDB:', error);
        }

        let migratedImessageCssPresets = false;
        let migratedTtsConfig = false;
        if (savedSettings && typeof savedSettings === 'object') {
            apiConfig = { ...apiConfig, ...(savedSettings.apiConfig || {}) };
            apiConfig = window.u2Api.sanitizeApiConfig(apiConfig);
            if (apiConfig.endpoint) {
                try {
                    apiConfig.endpoint = window.u2Api.normalizeApiEndpoint(apiConfig.endpoint, apiConfig.provider);
                } catch (error) {
                    console.warn('Saved API endpoint is invalid:', error);
                }
            }
            vectorMemoryConfig = window.u2Api?.normalizeVectorMemoryConfig
                ? window.u2Api.normalizeVectorMemoryConfig(savedSettings.vectorMemoryConfig || vectorMemoryConfig)
                : { ...vectorMemoryConfig, ...(savedSettings.vectorMemoryConfig || {}) };
            imageGenerationConfig = window.u2ImageGeneration
                ? window.u2ImageGeneration.normalizeConfig(savedSettings.imageGenerationConfig || imageGenerationConfig)
                : (savedSettings.imageGenerationConfig || imageGenerationConfig);
            visionConfig = window.u2ImageUnderstanding
                ? window.u2ImageUnderstanding.normalizeConfig(savedSettings.visionConfig || visionConfig)
                : (savedSettings.visionConfig || visionConfig);
            migratedTtsConfig = !savedSettings.ttsConfig && !!savedSettings.minimaxConfig;
            ttsConfig = window.u2Tts
                ? window.u2Tts.normalizeConfig(savedSettings.ttsConfig || savedSettings.minimaxConfig || ttsConfig)
                : (savedSettings.ttsConfig || savedSettings.minimaxConfig || ttsConfig);
            apiPresets = Array.isArray(savedSettings.apiPresets) ? savedSettings.apiPresets : [];
            fetchedModels = Array.isArray(savedSettings.fetchedModels) ? savedSettings.fetchedModels : [];
            assistiveBallSettings = {
                ...assistiveBallSettings,
                ...(savedSettings.assistiveBallSettings || {})
            };
            
            accounts = Array.isArray(savedSettings.accounts) ? savedSettings.accounts : [];
            currentAccountId = savedSettings.currentAccountId ?? null;
            const savedUserState = savedSettings.userState;
            if (savedUserState && typeof savedUserState === 'object') {
                userState = { ...userState, ...savedUserState };
            }
            
            if (currentAccountId) {
                syncUserStateFromCurrentAccount();
            }

            // Load Theme State
            const savedThemeState = savedSettings.themeState;
            if (savedThemeState) {
                // Merge arrays smartly to retain new apps if added
                if (Array.isArray(savedThemeState.apps)) {
                    savedThemeState.apps.forEach(savedApp => {
                        const existingApp = themeState.apps.find(a => a.id === savedApp.id);
                        if (existingApp) {
                            existingApp.icon = savedApp.icon;
                            if (savedApp.id === 'app-icon-6') {
                                existingApp.name = 'Library';
                            } else if (savedApp.id === 'app-icon-8' && savedApp.name === 'Diary') {
                                existingApp.name = 'Loves';
                            } else {
                                existingApp.name = savedApp.name || existingApp.name;
                            }
                        } else {
                            themeState.apps.push(savedApp);
                        }
                    });
                    delete savedThemeState.apps;
                }
                themeState = { ...themeState, ...savedThemeState };
            }
            themeState.uiChineseEnabled = themeState.uiChineseEnabled === true;
            themeState.imessageHomeCssEnabled = themeState.imessageHomeCssEnabled === true;
            themeState.imessageHomeCss = typeof themeState.imessageHomeCss === 'string' ? themeState.imessageHomeCss : '';
            themeState.imessageCssPresets = normalizeImessageCssPresets(themeState.imessageCssPresets);

            // Move the old generic-key presets into the durable settings domain once.
            IMESSAGE_CSS_THEME_TYPES.forEach((type) => {
                if (themeState.imessageCssPresets[type].length > 0) return;
                const legacyPresets = window.appStorage?.loadLegacyKey
                    ? window.appStorage.loadLegacyKey(`u2_theme_${type}Presets`, [])
                    : [];
                const normalizedLegacyPresets = normalizeImessageCssPresets({ [type]: legacyPresets })[type];
                if (normalizedLegacyPresets.length > 0) {
                    themeState.imessageCssPresets[type] = normalizedLegacyPresets;
                    migratedImessageCssPresets = true;
                }
            });
            window.u2ThemeState = themeState;
            applySavedTheme();
        }

        themeState.uiChineseEnabled = themeState.uiChineseEnabled === true;
        window.u2ThemeState = themeState;
        window.u2UiTranslation?.setEnabled(themeState.uiChineseEnabled);

        if (migratedImessageCssPresets || migratedTtsConfig) {
            await persistSettingsData();
        }
        // Expose globally for other modules if needed
        window.apiConfig = apiConfig;
        window.vectorMemoryConfig = vectorMemoryConfig;
        window.visionConfig = visionConfig;
        window.imageGenerationConfig = imageGenerationConfig;
        if (window.u2Tts && typeof window.u2Tts.setConfig === 'function') {
            ttsConfig = window.u2Tts.setConfig(ttsConfig);
        } else {
            window.ttsConfig = ttsConfig;
        }
        window.userState = userState;
        exposeAccountGlobals();
        // Modules such as Moments may initialize before Settings in the storage queue.
        // Notify them after the durable Apple ID profile has been restored.
        notifyUserStateUpdated({ avatarChanged: true, source: 'settings-hydration' });

        // ==========================================
        // UI DOM Elements Mapping
        // ==========================================
        UI.views.settings = document.getElementById('settings-view');
        UI.views.edit = document.getElementById('edit-view');
        UI.overlays.accountSwitcher = document.getElementById('account-sheet-overlay');
        UI.overlays.personaDetail = document.getElementById('persona-detail-sheet');
        UI.overlays.aboutDevice = document.getElementById('about-device-sheet');
        
        UI.lists.accounts = document.getElementById('account-list');

        // Detail Inputs Mapping
        UI.inputs = {
            detailName: document.getElementById('detail-name-input'),
            detailPhone: document.getElementById('detail-phone-input'),
            detailSignature: document.getElementById('detail-signature-input'),
            detailPersona: document.getElementById('detail-persona-input'),
            detailAvatarImg: document.getElementById('detail-avatar-img'),
            detailAvatarIcon: document.querySelector('#user-detail-avatar-wrapper .fa-user'),
            
            // API Config Inputs
            apiProvider: document.getElementById('api-provider-select'),
            apiProviderHint: document.getElementById('api-provider-hint'),
            apiEndpoint: document.getElementById('api-endpoint-input'),
            apiKey: document.getElementById('api-key-input'),
            apiModel: document.getElementById('api-model-select'),
            apiModelPickerToggle: document.getElementById('api-model-picker-toggle'),
            apiModelPicker: document.getElementById('api-model-picker'),
            apiModelSearch: document.getElementById('api-model-search-input'),
            apiModelList: document.getElementById('api-model-list'),
            apiTemp: document.getElementById('api-temp-input'),
            vectorMemoryEnabled: document.getElementById('vector-memory-enabled-toggle'),
            vectorMemoryProvider: document.getElementById('vector-memory-provider-select'),
            vectorMemoryEndpoint: document.getElementById('vector-memory-endpoint-input'),
            vectorMemoryApiKey: document.getElementById('vector-memory-api-key-input'),
            vectorMemoryModel: document.getElementById('vector-memory-model-select'),
            vectorMemoryCustomModel: document.getElementById('vector-memory-custom-model-input'),
            vectorMemoryCustomModelRow: document.getElementById('vector-memory-custom-model-row'),
            vectorMemoryCustomEndpointRow: document.getElementById('vector-memory-custom-endpoint-row'),
            vectorMemoryIndexStatus: document.getElementById('vector-memory-index-status'),
            visionProvider: document.getElementById('vision-provider-select'),
            visionEndpoint: document.getElementById('vision-endpoint-input'),
            visionApiKey: document.getElementById('vision-key-input'),
            visionModel: document.getElementById('vision-model-input'),
            visionModelSelect: document.getElementById('vision-model-select'),
            visionKeyLabel: document.getElementById('vision-key-label'),
            visionEndpointHint: document.getElementById('vision-endpoint-hint'),
            imageProvider: document.getElementById('image-generation-provider-select'),
            imageEndpoint: document.getElementById('image-generation-endpoint-input'),
            imageApiKey: document.getElementById('image-generation-key-input'),
            imageModel: document.getElementById('image-generation-model-input'),
            imageModelSelect: document.getElementById('image-generation-model-select'),
            imageSize: document.getElementById('image-generation-size-select'),
            imageKeyLabel: document.getElementById('image-generation-key-label'),
            imageEndpointHint: document.getElementById('image-generation-endpoint-hint'),
            bgActivityToggle: document.getElementById('bg-activity-toggle'),
            systemNotificationToggle: document.getElementById('system-notification-toggle'),
            notificationSettingsGroup: document.getElementById('notification-settings-group'),
            notificationSoundSettings: document.getElementById('notification-sound-settings'),
            notificationSoundFileName: document.getElementById('notification-sound-file-name'),
            notificationSoundUploadBtn: document.getElementById('notification-sound-upload-btn'),
            notificationSoundUploadLabel: document.getElementById('notification-sound-upload-label'),
            notificationSoundFileInput: document.getElementById('notification-sound-file-input'),
            notificationSoundActions: document.getElementById('notification-sound-actions'),
            notificationSoundPreviewBtn: document.getElementById('notification-sound-preview-btn'),
            notificationSoundRemoveBtn: document.getElementById('notification-sound-remove-btn'),
            ttsProvider: document.getElementById('tts-provider-select'),
            ttsEndpoint: document.getElementById('tts-endpoint-input'),
            ttsApiKey: document.getElementById('tts-key-input'),
            ttsModel: document.getElementById('tts-model-input'),
            ttsModelSelect: document.getElementById('tts-model-select'),
            ttsKeyLabel: document.getElementById('tts-key-label'),
            ttsModelLabel: document.getElementById('tts-model-label'),
            ttsModelSelectLabel: document.getElementById('tts-model-select-label'),
            ttsExtraFields: document.getElementById('tts-provider-extra-fields'),
            ttsEndpointHint: document.getElementById('tts-endpoint-hint'),
            presetName: document.getElementById('preset-name-input')
        };

        UI.lists.presets = document.getElementById('preset-list');
        
        UI.overlays.apiConfig = document.getElementById('api-config-sheet');
        UI.overlays.vectorMemoryConfig = document.getElementById('vector-memory-config-sheet');
        UI.overlays.visionConfig = document.getElementById('vision-config-sheet');
        UI.overlays.imageGenerationConfig = document.getElementById('image-generation-config-sheet');
        UI.overlays.ttsConfig = document.getElementById('tts-config-sheet');
        UI.overlays.savePreset = document.getElementById('save-preset-name-sheet');
        UI.overlays.loadPreset = document.getElementById('load-preset-list-sheet');
        UI.overlays.assistiveBallSettings = document.getElementById('assistive-ball-settings-sheet');
        UI.inputs.assistiveBallToggle = document.getElementById('assistive-ball-toggle');
        UI.inputs.assistiveBallOpacity = document.getElementById('assistive-ball-opacity-range');
        UI.inputs.assistiveBallOpacityValue = document.getElementById('assistive-ball-opacity-value');
        UI.inputs.assistiveBallSize = document.getElementById('assistive-ball-size-range');
        UI.inputs.assistiveBallSizeValue = document.getElementById('assistive-ball-size-value');
        UI.inputs.assistiveBallImageUrl = document.getElementById('assistive-ball-image-url-input');
        UI.inputs.assistiveBallImageUrlApply = document.getElementById('assistive-ball-image-url-apply-btn');
        UI.inputs.assistiveBallImageUpload = document.getElementById('assistive-ball-image-upload-btn');
        UI.inputs.assistiveBallImageFile = document.getElementById('assistive-ball-image-file-input');
        UI.inputs.assistiveBallImageReset = document.getElementById('assistive-ball-image-reset-btn');

        function openApiConfigSheet() {
            openView(UI.overlays.apiConfig);
        }

        function closeApiConfigSheet() {
            setApiModelPickerOpen(false);
            closeView(UI.overlays.apiConfig);
        }

        function closeVectorMemoryConfigSheet() {
            closeView(UI.overlays.vectorMemoryConfig);
        }

        if (UI.overlays.apiConfig) {
            UI.overlays.apiConfig.addEventListener('click', (event) => {
                if (event.target === UI.overlays.apiConfig) {
                    event.stopPropagation();
                    closeApiConfigSheet();
                }
            });
        }

        if (UI.overlays.vectorMemoryConfig) {
            UI.overlays.vectorMemoryConfig.addEventListener('click', (event) => {
                if (event.target === UI.overlays.vectorMemoryConfig) {
                    event.stopPropagation();
                    closeVectorMemoryConfigSheet();
                }
            });
        }

        if (UI.overlays.visionConfig) {
            UI.overlays.visionConfig.addEventListener('click', (event) => {
                if (event.target === UI.overlays.visionConfig) {
                    event.stopPropagation();
                    closeView(UI.overlays.visionConfig);
                }
            });
        }

        if (UI.overlays.imageGenerationConfig) {
            UI.overlays.imageGenerationConfig.addEventListener('click', (event) => {
                if (event.target === UI.overlays.imageGenerationConfig) {
                    event.stopPropagation();
                    closeView(UI.overlays.imageGenerationConfig);
                }
            });
        }

        // ==========================================
        // NAVIGATION EVENT LISTENERS
        // ==========================================
        
        // Open Settings from Dock
        const settingsBtn = document.getElementById('dock-icon-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                syncUIs();
                openView(UI.views.settings);
            });
        }
        
        // Close Settings
        const settingsBackBtn = document.getElementById('settings-title-back-btn');
        if (settingsBackBtn) {
            settingsBackBtn.addEventListener('click', () => closeView(UI.views.settings));
        }

        // About Device
        const aboutDeviceBtn = document.getElementById('about-device-btn');
        const aboutDeviceSheet = document.getElementById('about-device-sheet');
        const aboutDeviceCloseBtn = document.getElementById('about-device-close-btn');
        const aboutDisclaimerBtn = document.getElementById('about-device-disclaimer-btn');
        const aboutChangelogBtn = document.getElementById('about-device-changelog-btn');
        
        if (aboutDeviceBtn && aboutDeviceSheet) {
            aboutDeviceBtn.addEventListener('click', () => {
                const appNameEl = document.getElementById('about-device-app-name');
                if (appNameEl) appNameEl.textContent = 'JW';
                openView(aboutDeviceSheet);
            });
        }
        if (aboutDeviceCloseBtn && aboutDeviceSheet) {
            aboutDeviceCloseBtn.addEventListener('click', () => closeView(aboutDeviceSheet));
        }
        aboutDisclaimerBtn?.addEventListener('click', () => window.u2AboutInfoModal?.open('disclaimer'));
        aboutChangelogBtn?.addEventListener('click', () => window.u2AboutInfoModal?.open('changelog'));

        // Data Management
        const dataManagementBtn = document.getElementById('data-management-btn');
        const dataManagementSheet = document.getElementById('data-management-sheet');
        const dataManagementCloseBtn = document.getElementById('data-management-close-btn');
        const authSignOutBtn = document.getElementById('u2-auth-sign-out-btn');
        
        if (dataManagementBtn && dataManagementSheet) {
            dataManagementBtn.addEventListener('click', () => {
                openView(dataManagementSheet);
            });
        }
        if (dataManagementCloseBtn && dataManagementSheet) {
            dataManagementCloseBtn.addEventListener('click', () => closeView(dataManagementSheet));
        }
        authSignOutBtn?.addEventListener('click', async () => {
            authSignOutBtn.disabled = true;
            try {
                if (dataManagementSheet) closeView(dataManagementSheet);
                await window.u2Auth?.logout();
            } catch (error) {
                console.error('[auth] Failed to sign out:', error);
            } finally {
                authSignOutBtn.disabled = false;
            }
        });

        // Apple ID / Profile View
        const appleIdTrigger = document.getElementById('apple-id-trigger');
        if (appleIdTrigger) {
            appleIdTrigger.addEventListener('click', (e) => {
                e.stopPropagation(); 
                syncUIs();
                openView(UI.views.edit);
            });
        }
        const editBackBtn = document.getElementById('edit-back-btn');
        if (editBackBtn) {
            editBackBtn.addEventListener('click', () => closeView(UI.views.edit));
        }

        // ==========================================
        // IMAGE COMPRESSION & ACCOUNT MANAGEMENT
        // ==========================================
        function readImageAsCompressedDataUrl(file, options = {}) {
            return new Promise((resolve, reject) => {
                if (!file) {
                    reject(new Error('No file selected'));
                    return;
                }

                const {
                    maxWidth = 1024,
                    maxHeight = 1024,
                    quality = 0.82,
                    outputType = 'image/jpeg'
                } = options;

                const reader = new FileReader();
                reader.onload = (event) => {
                    const rawDataUrl = event?.target?.result;
                    if (!rawDataUrl || typeof rawDataUrl !== 'string') {
                        reject(new Error('Failed to read file'));
                        return;
                    }

                    const image = new Image();
                    image.onload = () => {
                        let { width, height } = image;

                        if (!width || !height) {
                            resolve(rawDataUrl);
                            return;
                        }

                        const widthRatio = maxWidth / width;
                        const heightRatio = maxHeight / height;
                        const scale = Math.min(1, widthRatio, heightRatio);

                        const targetWidth = Math.max(1, Math.round(width * scale));
                        const targetHeight = Math.max(1, Math.round(height * scale));

                        const canvas = document.createElement('canvas');
                        canvas.width = targetWidth;
                        canvas.height = targetHeight;

                        const ctx = canvas.getContext('2d');
                        if (!ctx) {
                            resolve(rawDataUrl);
                            return;
                        }

                        ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

                        try {
                            const compressedDataUrl = canvas.toDataURL(outputType, quality);
                            resolve(compressedDataUrl || rawDataUrl);
                        } catch (err) {
                            console.warn('Failed to compress image, using original data url.', err);
                            resolve(rawDataUrl);
                        }
                    };

                    image.onerror = () => reject(new Error('Failed to load image for compression'));
                    image.src = rawDataUrl;
                };

                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsDataURL(file);
            });
        }
        window.readImageAsCompressedDataUrl = readImageAsCompressedDataUrl;

        // Main Edit Avatar Logic
        const mainEditAvatarWrapper = document.getElementById('main-edit-avatar-wrapper');
        const mainAvatarUpload = document.getElementById('main-avatar-upload');
        if (mainEditAvatarWrapper && mainAvatarUpload) {
            mainEditAvatarWrapper.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') mainAvatarUpload.click();
            });

            mainAvatarUpload.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        const url = await readImageAsCompressedDataUrl(file, {
                            maxWidth: 256,
                            maxHeight: 256,
                            quality: 0.72
                        });

                        // Update user state
                        userState.avatarUrl = url;
                        
                        // Update current account in accounts array
                        const acc = accounts.find(a => a.id === currentAccountId);
                        if (acc) {
                            acc.avatarUrl = url;
                        }
                        
                        saveGlobalData();
                        // Sync the UI immediately
                        syncUIs();
                        notifyUserStateUpdated({ avatarChanged: true });
                        showToast('头像已更新');
                    } catch (err) {
                        console.error('Failed to process avatar upload', err);
                        showToast('头像处理失败');
                    }
                }
                e.target.value = ''; // Reset
            });
        }

        let isCreatingNewAccount = false;
        let detailTempId = null;

        // Account Switcher
        const switchAccountBtn = document.getElementById('switch-account-btn');
        if (switchAccountBtn) {
            switchAccountBtn.addEventListener('click', () => {
                renderAccountList();
                openView(UI.overlays.accountSwitcher);
            });
        }

        // Account List Rendering
        function renderAccountList() {
            if(!UI.lists.accounts) return;
            UI.lists.accounts.innerHTML = '';

            accounts.forEach(acc => {
                const card = document.createElement('div');
                card.className = `account-card ${acc.id === currentAccountId ? 'selected' : ''}`;
                if (acc.id === currentAccountId) {
                    card.style.backgroundColor = '#e8f2ff'; // highlight current
                }
                
                const avatarHtml = acc.avatarUrl ? `<img src="${acc.avatarUrl}" alt="">` : `<i class="fas fa-user"></i>`;
                card.innerHTML = `
                    <div class="account-content">
                        <div class="account-avatar">${avatarHtml}</div>
                        <div class="account-info">
                            <div class="account-name">${acc.name}</div>
                            <div class="account-detail">${acc.phone || 'No Phone'}</div>
                        </div>
                        <i class="fas fa-times delete-icon"></i>
                    </div>
                `;

                // Click to Open Detail View & Set Active
                card.querySelector('.account-content').addEventListener('click', (e) => {
                    // If clicked on delete icon, do not open detail view
                    if (e.target.classList.contains('delete-icon') || e.target.closest('.delete-icon')) return;

                    currentAccountId = acc.id;
                    if (window.setCurrentAccountId) window.setCurrentAccountId(acc.id);
                    renderAccountList(); // Refresh highlighting
                    
                    isCreatingNewAccount = false;
                    detailTempId = acc.id;
                    UI.inputs.detailName.value = acc.name || '';
                    UI.inputs.detailPhone.value = acc.phone || '';
                    if(UI.inputs.detailSignature) UI.inputs.detailSignature.value = acc.signature || '';
                    UI.inputs.detailPersona.value = acc.persona || '';
                    setDetailAvatar(acc.avatarUrl);
                    
                    openView(UI.overlays.personaDetail);
                });

                // Delete Action
                card.querySelector('.delete-icon').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete account "${acc.name}"?`)) {
                        accounts = accounts.filter(a => a.id !== acc.id);
                        if (currentAccountId === acc.id) {
                            currentAccountId = accounts.length > 0 ? accounts[0].id : null;
                            if (window.setCurrentAccountId) window.setCurrentAccountId(currentAccountId);
                            const nextAccount = accounts.find(a => a.id === currentAccountId);
                            userState.name = nextAccount?.name || '';
                            userState.phone = nextAccount?.phone || '';
                            userState.persona = nextAccount?.signature || nextAccount?.persona || '';
                            userState.avatarUrl = nextAccount?.avatarUrl || null;
                        }
                        saveGlobalData();
                        syncUIs();
                        notifyUserStateUpdated({ avatarChanged: true });
                        renderAccountList();
                    }
                });

                UI.lists.accounts.appendChild(card);
            });
        }

        window.updateAccountById = function(id, mutatorOrPatch = {}) {
            const acc = accounts.find(a => String(a.id) === String(id));
            if (!acc) return false;

            const previousAvatarUrl = acc.avatarUrl || null;

            if (typeof mutatorOrPatch === 'function') {
                mutatorOrPatch(acc);
            } else if (mutatorOrPatch && typeof mutatorOrPatch === 'object') {
                Object.assign(acc, mutatorOrPatch);
            }

            const avatarChanged = previousAvatarUrl !== (acc.avatarUrl || null);

            if (String(currentAccountId) === String(acc.id)) {
                syncUserStateFromCurrentAccount();
            }

            saveGlobalData();
            if (window.syncUIs) window.syncUIs();
            window.dispatchEvent(new CustomEvent('account-updated', {
                detail: {
                    account: clonePlainData(acc),
                    accountId: acc.id,
                    avatarChanged
                }
            }));
            notifyUserStateUpdated({ avatarChanged });
            renderAccountList();
            return true;
        };

        // Add New Account
        document.getElementById('add-account-btn')?.addEventListener('click', () => {
            isCreatingNewAccount = true;
            detailTempId = Date.now();
            UI.inputs.detailName.value = '';
            UI.inputs.detailPhone.value = '';
            if(UI.inputs.detailSignature) UI.inputs.detailSignature.value = '';
            UI.inputs.detailPersona.value = '';
            setDetailAvatar(null);
            openView(UI.overlays.personaDetail);
        });

        // Save Selected Account to Main State
        document.getElementById('save-id-btn')?.addEventListener('click', () => {
            const accToSync = accounts.find(a => a.id === currentAccountId);
            if (accToSync) {
                userState.name = accToSync.name;
                userState.phone = accToSync.phone;
                userState.persona = accToSync.persona;
                userState.signature = accToSync.signature;
                userState.avatarUrl = accToSync.avatarUrl;
            } else {
                userState.name = '';
                userState.phone = '';
                userState.persona = '';
                userState.signature = '';
                userState.avatarUrl = null;
            }
            saveGlobalData();
            syncUIs();
            notifyUserStateUpdated({ avatarChanged: true });
            closeView(UI.overlays.accountSwitcher);
        });

        // Detail View Confirm
        document.getElementById('confirm-sync-btn')?.addEventListener('click', () => {
            const name = UI.inputs.detailName.value || 'New User';
            const phone = UI.inputs.detailPhone.value;
            const signature = UI.inputs.detailSignature ? UI.inputs.detailSignature.value : '';
            const persona = UI.inputs.detailPersona.value;
            const currentAvatarSrc = UI.inputs.detailAvatarImg.style.display === 'block' ? UI.inputs.detailAvatarImg.src : null;

            if (isCreatingNewAccount) {
                accounts.push({ id: detailTempId, name, phone, signature, persona, avatarUrl: currentAvatarSrc });
                currentAccountId = detailTempId; 
            } else {
                const acc = accounts.find(a => a.id === detailTempId);
                if (acc) {
                    acc.name = name;
                    acc.phone = phone;
                    acc.signature = signature;
                    acc.persona = persona;
                    acc.avatarUrl = currentAvatarSrc;
                }
            }
            isCreatingNewAccount = false;
            if (String(currentAccountId) === String(detailTempId)) {
                syncUserStateFromCurrentAccount();
            }
            saveGlobalData();
            syncUIs();
            notifyUserStateUpdated({ avatarChanged: true });
            renderAccountList(); 
            closeView(UI.overlays.personaDetail); 
            showToast('资料已保存');
        });

        // Avatar Upload Handler
        const userDetailAvatarWrapper = document.getElementById('user-detail-avatar-wrapper');
        if (userDetailAvatarWrapper) {
            userDetailAvatarWrapper.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') document.getElementById('detail-avatar-upload').click();
            });
        }

        document.getElementById('detail-avatar-upload')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const url = await readImageAsCompressedDataUrl(file, {
                        maxWidth: 256,
                        maxHeight: 256,
                        quality: 0.72
                    });
                    setDetailAvatar(url);
                } catch (err) {
                    console.error('Failed to process detail avatar upload', err);
                    showToast('头像处理失败');
                }
            }
        });

        function setDetailAvatar(url) {
            if (url) {
                UI.inputs.detailAvatarImg.src = url;
                UI.inputs.detailAvatarImg.style.display = 'block';
                if(UI.inputs.detailAvatarIcon) UI.inputs.detailAvatarIcon.style.display = 'none';
            } else {
                UI.inputs.detailAvatarImg.style.display = 'none';
                if(UI.inputs.detailAvatarIcon) UI.inputs.detailAvatarIcon.style.display = 'block';
                UI.inputs.detailAvatarImg.src = '';
            }
        }

        // Make syncUIs globally aware of the loaded userState
        const originalSyncUIs = window.syncUIs;
        window.syncUIs = function() {
            if (originalSyncUIs) {
                // Call original logic if any
                originalSyncUIs();
            }
            
            // Sync Apple ID Settings View
            const settingsName = document.getElementById('settings-name');
            const settingsAvatarImg = document.getElementById('settings-avatar-img');
            const settingsAvatarIcon = document.querySelector('.apple-id-avatar-small .fa-user');
            
            if (settingsName) {
                settingsName.textContent = userState.name || '未登录 Apple ID';
            }
            
            if (userState.avatarUrl) {
                if (settingsAvatarImg) {
                    settingsAvatarImg.src = userState.avatarUrl;
                    settingsAvatarImg.style.display = 'block';
                }
                if (settingsAvatarIcon) settingsAvatarIcon.style.display = 'none';
            } else {
                if (settingsAvatarImg) settingsAvatarImg.style.display = 'none';
                if (settingsAvatarIcon) settingsAvatarIcon.style.display = 'block';
            }
            
            // Sync Edit View
            const displayName = document.getElementById('display-name');
            const displayPhone = document.getElementById('display-phone');
            const displaySignature = document.getElementById('display-signature');
            const editAvatarImg = document.getElementById('edit-avatar-img');
            const editAvatarIcon = document.querySelector('#edit-avatar-preview .fa-user');
            
            if (displayName) displayName.textContent = userState.name || '未登录 Apple ID';
            if (displayPhone) displayPhone.textContent = userState.phone || '暂无手机号';
            if (displaySignature) displaySignature.textContent = userState.signature || '添加账号后可同步头像、名称与签名';
            
            if (userState.avatarUrl) {
                if (editAvatarImg) {
                    editAvatarImg.src = userState.avatarUrl;
                    editAvatarImg.style.display = 'block';
                }
                if (editAvatarIcon) editAvatarIcon.style.display = 'none';
            } else {
                if (editAvatarImg) editAvatarImg.style.display = 'none';
                if (editAvatarIcon) editAvatarIcon.style.display = 'block';
            }
            
            // Sync iMessage Home Top Bar
            const imProfileName = document.getElementById('imessage-profile-name');
            const imProfileSign = document.getElementById('imessage-profile-sign');
            const imAvatarImg = document.getElementById('imessage-avatar-img');
            const imAvatarIcon = document.getElementById('imessage-avatar-icon');
            
            if (imProfileName) imProfileName.textContent = userState.name || 'Default User';
            if (imProfileSign) imProfileSign.textContent = userState.signature || 'No Signature';
            
            if (userState.avatarUrl) {
                if (imAvatarImg) {
                    imAvatarImg.src = userState.avatarUrl;
                    imAvatarImg.style.display = 'block';
                }
                if (imAvatarIcon) imAvatarIcon.style.display = 'none';
            } else {
                if (imAvatarImg) imAvatarImg.style.display = 'none';
                if (imAvatarIcon) imAvatarIcon.style.display = 'block';
            }
        };

        // 初始同步 UI (使用包含了全局状态同步的完整方法)
        if (window.syncUIs) {
            window.syncUIs();
        }

        document.getElementById('close-account-sheet-btn')?.addEventListener('click', () => {
            closeView(UI.overlays.accountSwitcher);
        });

        document.getElementById('close-persona-sheet-btn')?.addEventListener('click', () => {
            closeView(UI.overlays.personaDetail);
        });

        // ==========================================
        // World Book Configuration Logic
        // ==========================================
        const worldBookMainBtn = document.getElementById('world-book-main-btn');
        if (worldBookMainBtn) {
            worldBookMainBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.renderWorldBooks) {
                    window.renderWorldBooks();
                }
                const wbView = document.getElementById('world-book-view');
                if (wbView) {
                    openView(wbView);
                }
            });
        }

        // ==========================================
        // THEME CONFIGURATION LOGIC
        // ==========================================
        const themeConfigBtn = document.getElementById('theme-config-btn');
        const imessageThemesBtn = document.getElementById('imessage-themes-btn');
        const themeConfigSheet = document.getElementById('theme-config-sheet');
        const themeConfigBackBtn = document.getElementById('theme-config-back-btn');
        const themeCurrentApplyBtn = document.getElementById('theme-current-apply-btn');
        const desktopThemeConfigSheet = document.getElementById('desktop-theme-config-sheet');
        const globalUiTranslationToggle = document.getElementById('global-ui-translation-toggle');

        function syncGlobalUiTranslationToggle() {
            if (globalUiTranslationToggle) globalUiTranslationToggle.checked = themeState.uiChineseEnabled === true;
        }

        async function setGlobalUiTranslationEnabled(nextEnabled, { persist = true } = {}) {
            themeState.uiChineseEnabled = nextEnabled === true;
            window.u2ThemeState = themeState;
            window.u2UiTranslation?.setEnabled(themeState.uiChineseEnabled);
            applyThemeAppIcons(themeState);
            renderThemeAppList();
            syncGlobalUiTranslationToggle();
            return persist ? saveGlobalData() : true;
        }

        syncGlobalUiTranslationToggle();

        if (globalUiTranslationToggle) {
            globalUiTranslationToggle.addEventListener('change', async () => {
                const enabled = globalUiTranslationToggle.checked;
                const persisted = await setGlobalUiTranslationEnabled(enabled);
                showToast(persisted
                    ? (enabled ? '全局 UI 已切换为中文' : '全局 UI 已恢复英文')
                    : '全局翻译保存失败，当前效果未持久化');
            });
        }

        async function applySavedTheme() {
            window.u2ThemeState = themeState;
            applyThemeBackground(themeState);
            applyThemeAppIcons(themeState);
            if (window.imApp && window.imApp.applyGlobalChatCss) {
                window.imApp.applyGlobalChatCss(themeState);
            }
            window.imApp?.applyGlobalHomeCss?.(themeState);
            if (window.imApp && window.imApp.applyGlobalGroupCss) {
                window.imApp.applyGlobalGroupCss(themeState);
            }
            if (themeFontRuntimeReady) await applyThemeFont(themeState);
        }
        
        function openDesktopThemeConfig() {
            ensureThemeFontStateShape();
            const themeBgUrlInput = document.getElementById('theme-bg-url-input');
            if (themeBgUrlInput) themeBgUrlInput.value = themeState.bgUrl || '';
            syncThemeFontInputsFromState();
            renderThemeFontPresetLists();
            renderThemeFontPreview();
            renderThemeAppList();
            openView(desktopThemeConfigSheet);
        }

        function openImessageThemeConfig() {
            const homeCssInput = document.getElementById('theme-home-css-input');
            if (homeCssInput) homeCssInput.value = themeState.imessageHomeCss || '';

            const bubbleCssInput = document.getElementById('theme-bubble-css-input');
            if (bubbleCssInput) bubbleCssInput.value = window.imData?.currentSettingsFriend?.customCss || '';

            const chatCssInput = document.getElementById('theme-chat-css-input');
            if (chatCssInput) chatCssInput.value = themeState.imessageChatCss || '';

            const groupCssInput = document.getElementById('theme-group-css-input');
            if (groupCssInput) groupCssInput.value = themeState.imessageGroupCss || '';

            const statusCssInput = document.getElementById('theme-status-css-input');
            if (statusCssInput) statusCssInput.value = window.imData?.currentSettingsFriend?.statusCss || '';

            refreshThemePresetUi();
            openView(themeConfigSheet);
        }

        function getActiveThemeType() {
            const activeTab = document.querySelector('.im-theme-tabs .theme-tab.active');
            const targetId = activeTab?.getAttribute('data-target') || 'theme-tab-home';
            if (targetId === 'theme-tab-home') return 'home';
            if (targetId === 'theme-tab-chat') return 'chat';
            if (targetId === 'theme-tab-group') return 'group';
            if (targetId === 'theme-tab-status') return 'status';
            return 'bubble';
        }

        if (themeConfigSheet && window.mobileInputCompat?.registerFocusScope) {
            window.mobileInputCompat.registerFocusScope({
                selector: '#theme-config-sheet',
                preferFocusScope: true,
                resolveScrollContainer: (target, root) => root.querySelector('.im-theme-content'),
                scrollBehavior: 'focus',
                viewportClassName: 'u2-android-theme-viewport-sized',
                viewportHeightCssVariable: '--u2-android-theme-viewport-height',
                viewportTopCssVariable: '--u2-android-theme-viewport-top'
            });
        }

        async function applyCurrentThemeCss() {
            const activeType = getActiveThemeType();

            if (activeType === 'home') {
                const cssInput = themeHomeCssInput;
                const nextCss = cssInput ? cssInput.value : '';
                themeState.imessageHomeCss = nextCss;
                themeState.imessageHomeCssEnabled = !!nextCss.trim();
                window.u2ThemeState = themeState;
                window.imApp?.applyGlobalHomeCss?.(themeState);
                const persisted = await saveGlobalData();
                const label = 'Home CSS';
                showToast(persisted
                    ? (nextCss.trim() ? `${label} 已应用` : `${label} 已清空`)
                    : `${label} 保存失败，当前效果未持久化`);
                return;
            }

            if (activeType === 'chat') {
                const nextChatCss = themeChatCssInput ? themeChatCssInput.value : '';
                themeState.imessageChatCss = nextChatCss;
                themeState.imessageChatCssEnabled = !!nextChatCss.trim();
                window.u2ThemeState = themeState;
                if (window.imApp && window.imApp.applyGlobalChatCss) {
                    window.imApp.applyGlobalChatCss(themeState);
                }
                const persisted = await saveGlobalData();
                showToast(persisted
                    ? (nextChatCss.trim() ? 'Chat CSS 已应用' : 'Chat CSS 已清空')
                    : 'Chat CSS 保存失败，当前效果未持久化');
                return;
            }

            if (activeType === 'group') {
                const nextGroupCss = themeGroupCssInput ? themeGroupCssInput.value : '';
                themeState.imessageGroupCss = nextGroupCss;
                themeState.imessageGroupCssEnabled = !!nextGroupCss.trim();
                window.u2ThemeState = themeState;
                if (window.imApp && window.imApp.applyGlobalGroupCss) {
                    window.imApp.applyGlobalGroupCss(themeState);
                }
                const persisted = await saveGlobalData();
                showToast(persisted
                    ? (nextGroupCss.trim() ? 'Group CSS 已应用' : 'Group CSS 已清空')
                    : 'Group CSS 保存失败，当前效果未持久化');
                return;
            }

            if (!window.imData || !window.imData.currentSettingsFriend) {
                showToast('请先选择一个朋友');
                return;
            }

            const friend = window.imData.currentSettingsFriend;
            const isBubble = activeType === 'bubble';
            const cssInput = isBubble ? themeBubbleCssInput : themeStatusCssInput;
            const nextCss = cssInput ? cssInput.value : '';

            if (window.imApp && window.imApp.commitScopedFriendChange) {
                const saved = await window.imApp.commitScopedFriendChange(friend, (targetFriend) => {
                    if (isBubble) {
                        targetFriend.customCss = nextCss;
                        targetFriend.customCssEnabled = !!nextCss.trim();
                    } else {
                        targetFriend.statusCss = nextCss;
                        targetFriend.statusCssEnabled = !!nextCss.trim();
                    }
                }, { silent: true, syncSettings: true });

                if (saved) {
                    if (window.imApp.applyFriendCss) window.imApp.applyFriendCss(window.imData.currentSettingsFriend);
                    showToast(isBubble ? '气泡 CSS 已应用' : '状态栏 CSS 已应用');
                } else {
                    showToast(isBubble ? '应用气泡 CSS 失败' : '应用状态栏 CSS 失败');
                }
            }
        }

        function normalizeImessageCssPresets(rawPresets) {
            const source = rawPresets && typeof rawPresets === 'object' ? rawPresets : {};
            return IMESSAGE_CSS_THEME_TYPES.reduce((presetsByType, type) => {
                const seenNames = new Set();
                presetsByType[type] = (Array.isArray(source[type]) ? source[type] : [])
                    .map((preset, index) => ({
                        id: String(preset?.id || `${type}-preset-${index}`),
                        name: String(preset?.name || '').trim(),
                        css: typeof preset?.css === 'string' ? preset.css : ''
                    }))
                    .filter((preset) => preset.name && preset.css.trim())
                    .filter((preset) => {
                        if (seenNames.has(preset.name)) return false;
                        seenNames.add(preset.name);
                        return true;
                    });
                return presetsByType;
            }, {});
        }

        if (themeConfigBtn && desktopThemeConfigSheet) {
            themeConfigBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openDesktopThemeConfig();
            });
        }

        if (imessageThemesBtn && themeConfigSheet) {
            imessageThemesBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openImessageThemeConfig();
            });
        }

        if (themeConfigBackBtn && themeConfigSheet) {
            themeConfigBackBtn.addEventListener('click', () => {
                closeView(themeConfigSheet);
            });
        }

        if (themeCurrentApplyBtn) {
            themeCurrentApplyBtn.addEventListener('click', () => {
                applyCurrentThemeCss().catch((error) => {
                    console.warn('Failed to apply Chat CSS:', error);
                    showToast('Chat CSS 保存失败，当前效果未持久化');
                });
            });
        }

        // Theme Tabs Logic
        const themeTabs = document.querySelectorAll('.theme-tab');
        const themeTabContents = document.querySelectorAll('.theme-tab-content');
        
        themeTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetId = tab.getAttribute('data-target');
                themeTabs.forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                
                themeTabContents.forEach(content => {
                    const isActive = content.id === targetId;
                    content.classList.toggle('active', isActive);
                    content.hidden = !isActive;
                    content.style.display = isActive ? '' : 'none';
                });
            });
        });
        
        const themeHomeCssInput = document.getElementById('theme-home-css-input');
        const themeHomeClearBtn = document.getElementById('theme-home-clear-btn');
        const themeHomeCopyBtn = document.getElementById('theme-home-copy-btn');
        const themeHomeSaveBtn = document.getElementById('theme-home-save-btn');
        const themeHomePresetName = document.getElementById('theme-home-preset-name');
        const themeHomePresetList = document.getElementById('theme-home-preset-list');
        const themeResetAllBtn = document.getElementById('theme-reset-all-btn');
        const themeBubbleCssInput = document.getElementById('theme-bubble-css-input');
        const themeBubbleClearBtn = document.getElementById('theme-bubble-clear-btn');
        const themeBubbleCopyBtn = document.getElementById('theme-bubble-copy-btn');
        const themeBubbleApplyBtn = document.getElementById('theme-bubble-apply-btn');
        const themeChatCopyBtn = document.getElementById('theme-chat-copy-btn');
        const themeStatusCopyBtn = document.getElementById('theme-status-copy-btn');
        const themeBubbleSaveBtn = document.getElementById('theme-bubble-save-btn');
        const themeBubblePresetName = document.getElementById('theme-bubble-preset-name');
        
        const themeChatCssInput = document.getElementById('theme-chat-css-input');
        const themeChatClearBtn = document.getElementById('theme-chat-clear-btn');
        const themeGroupCssInput = document.getElementById('theme-group-css-input');
        const themeGroupClearBtn = document.getElementById('theme-group-clear-btn');
        const themeGroupCopyBtn = document.getElementById('theme-group-copy-btn');
        const themeChatSaveBtn = document.getElementById('theme-chat-save-btn');
        const themeChatPresetName = document.getElementById('theme-chat-preset-name');
        const themeChatPresetList = document.getElementById('theme-chat-preset-list');
        const themeGroupSaveBtn = document.getElementById('theme-group-save-btn');
        const themeGroupPresetName = document.getElementById('theme-group-preset-name');
        const themeGroupPresetList = document.getElementById('theme-group-preset-list');
        
        const themeStatusCssInput = document.getElementById('theme-status-css-input');
        const themeStatusClearBtn = document.getElementById('theme-status-clear-btn');
        const themeStatusSaveBtn = document.getElementById('theme-status-save-btn');
        const themeStatusPresetName = document.getElementById('theme-status-preset-name');
        const themeStatusPresetList = document.getElementById('theme-status-preset-list');
        const themeCssImportInput = document.getElementById('theme-css-import-input');
        const themeCssImportButtons = document.querySelectorAll('[data-theme-import-type]');
        let pendingThemeCssImportType = '';
        
        const themeBubblePresetList = document.getElementById('theme-bubble-preset-list');

        function getThemeCssInput(type = getActiveThemeType()) {
            if (type === 'home') return themeHomeCssInput;
            if (type === 'chat') return themeChatCssInput;
            if (type === 'group') return themeGroupCssInput;
            if (type === 'status') return themeStatusCssInput;
            return themeBubbleCssInput;
        }

        async function readThemeCssImportFile(file) {
            const lowerName = String(file?.name || '').toLowerCase();
            if (!lowerName.endsWith('.txt') && !lowerName.endsWith('.docx')) {
                throw new Error('仅支持 TXT 和 DOCX 文件');
            }

            let text = '';
            if (lowerName.endsWith('.docx')) {
                await window.u2LoadVendorLibrary?.('mammoth');
                if (!window.mammoth?.extractRawText) {
                    throw new Error('DOCX 解析组件未加载，请检查网络后重试');
                }
                const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
                text = String(result?.value || '');
            } else {
                text = String(await file.text());
            }

            const normalized = text.replace(/\r\n?/g, '\n').replace(/\u0000/g, '');
            if (!normalized.trim()) throw new Error('文件内容为空');
            return normalized;
        }

        if (themeCssImportInput && themeCssImportButtons.length) {
            themeCssImportButtons.forEach(button => {
                button.addEventListener('click', () => {
                    pendingThemeCssImportType = button.getAttribute('data-theme-import-type') || getActiveThemeType();
                    themeCssImportInput.click();
                });
            });

            themeCssImportInput.addEventListener('change', async () => {
                const file = themeCssImportInput.files?.[0];
                const targetType = pendingThemeCssImportType || getActiveThemeType();
                pendingThemeCssImportType = '';
                themeCssImportInput.value = '';
                if (!file) return;

                try {
                    const importedCss = await readThemeCssImportFile(file);
                    const cssInput = getThemeCssInput(targetType);
                    if (!cssInput) throw new Error('未找到 CSS 编辑器');
                    if (cssInput.value.trim() && !window.confirm('导入内容会替换当前未应用的 CSS，确定继续吗？')) return;

                    cssInput.value = importedCss;
                    cssInput.dispatchEvent(new Event('input', { bubbles: true }));
                    showToast('CSS 已导入，请确认后点击应用');
                } catch (error) {
                    console.error('Failed to import Theme CSS', error);
                    showToast(error?.message || 'CSS 导入失败');
                }
            });
        }
        
        // --- 新增的“主题美化”模块变量 ---
        const chatThemeBeautifyToggle = document.getElementById('chat-theme-beautify-toggle');
        const chatThemeBeautifyBody = document.getElementById('chat-theme-beautify-body');
        const chatThemeBubbleSelect = document.getElementById('chat-theme-bubble-select');
        const chatThemeChatSelect = document.getElementById('chat-theme-chat-select');
        const chatThemeStatusSelect = document.getElementById('chat-theme-status-select');
        const chatThemeApplyBtn = document.getElementById('chat-theme-apply-btn');

        // 控制“主题美化”展开折叠
        if (chatThemeBeautifyToggle && chatThemeBeautifyBody) {
            chatThemeBeautifyToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    chatThemeBeautifyBody.style.display = 'flex';
                    if (window.imData && window.imData.currentSettingsFriend) {
                        const friend = window.imData.currentSettingsFriend;
                        if (chatThemeBubbleSelect && friend.customCssEnabled) {
                            chatThemeBubbleSelect.value = friend.customCss || '';
                        }
                        if (chatThemeStatusSelect && friend.statusCssEnabled) {
                            chatThemeStatusSelect.value = friend.statusCss || '';
                        }
                    }
                    if (chatThemeChatSelect && window.imData?.currentSettingsFriend?.chatCssEnabled) {
                        chatThemeChatSelect.value = window.imData.currentSettingsFriend.chatCss || '';
                    }
                } else {
                    chatThemeBeautifyBody.style.display = 'none';
                }
            });
        }

        async function clearGlobalHomeTheme() {
            themeState.imessageHomeCss = '';
            themeState.imessageHomeCssEnabled = false;
            if (themeHomeCssInput) themeHomeCssInput.value = '';
            window.imApp?.applyGlobalHomeCss?.(themeState);
            window.u2ThemeState = themeState;
            const persisted = await saveGlobalData();
            showToast(persisted ? 'Home CSS 已清空' : 'CSS 保存失败，当前效果未持久化');
        }

        themeHomeClearBtn?.addEventListener('click', clearGlobalHomeTheme);

        async function resetAppliedImessageThemeCss() {
            if (!window.confirm('重置 Theme 当前应用的 CSS？预设、背景、字体和其他好友的专属美化会保留。')) return;

            const globalSnapshot = {
                imessageHomeCss: themeState.imessageHomeCss || '',
                imessageHomeCssEnabled: !!themeState.imessageHomeCssEnabled,
                imessageChatCss: themeState.imessageChatCss || '',
                imessageChatCssEnabled: !!themeState.imessageChatCssEnabled,
                imessageGroupCss: themeState.imessageGroupCss || '',
                imessageGroupCssEnabled: !!themeState.imessageGroupCssEnabled
            };
            const friend = window.imData?.currentSettingsFriend || null;
            const friendSnapshot = friend ? {
                customCss: friend.customCss || '',
                customCssEnabled: !!friend.customCssEnabled,
                chatCss: friend.chatCss || '',
                chatCssEnabled: !!friend.chatCssEnabled,
                statusCss: friend.statusCss || '',
                statusCssEnabled: !!friend.statusCssEnabled
            } : null;

            const restoreGlobals = () => {
                Object.assign(themeState, globalSnapshot);
                window.u2ThemeState = themeState;
                window.imApp?.applyGlobalHomeCss?.(themeState);
                window.imApp?.applyGlobalChatCss?.(themeState);
                window.imApp?.applyGlobalGroupCss?.(themeState);
            };

            Object.assign(themeState, {
                imessageHomeCss: '', imessageHomeCssEnabled: false,
                imessageChatCss: '', imessageChatCssEnabled: false,
                imessageGroupCss: '', imessageGroupCssEnabled: false
            });
            window.u2ThemeState = themeState;
            window.imApp?.applyGlobalHomeCss?.(themeState);
            window.imApp?.applyGlobalChatCss?.(themeState);
            window.imApp?.applyGlobalGroupCss?.(themeState);

            let friendSaved = true;
            if (friend && window.imApp?.commitScopedFriendChange) {
                friendSaved = await window.imApp.commitScopedFriendChange(friend, (targetFriend) => {
                    targetFriend.customCss = '';
                    targetFriend.customCssEnabled = false;
                    targetFriend.chatCss = '';
                    targetFriend.chatCssEnabled = false;
                    targetFriend.statusCss = '';
                    targetFriend.statusCssEnabled = false;
                }, { silent: true, syncSettings: true });
            }

            if (!friendSaved) {
                restoreGlobals();
                showToast('重置失败，原美化已恢复');
                return;
            }

            const globalSaved = await saveGlobalData();
            if (!globalSaved) {
                restoreGlobals();
                if (friend && friendSnapshot && window.imApp?.commitScopedFriendChange) {
                    await window.imApp.commitScopedFriendChange(friend, (targetFriend) => Object.assign(targetFriend, friendSnapshot), { silent: true, syncSettings: true });
                    window.imApp?.applyFriendCss?.(window.imData?.currentSettingsFriend || friend);
                }
                await saveGlobalData();
                showToast('重置失败，原美化已恢复');
                return;
            }

            [themeHomeCssInput, themeBubbleCssInput, themeChatCssInput, themeGroupCssInput, themeStatusCssInput]
                .forEach((input) => { if (input) input.value = ''; });
            if (friend) window.imApp?.applyFriendCss?.(window.imData?.currentSettingsFriend || friend);
            refreshThemePresetUi(window.imData?.currentSettingsFriend);
            showToast(friend ? '已重置全局与当前好友的 Theme CSS' : '已重置全局 Theme CSS');
        }

        themeResetAllBtn?.addEventListener('click', () => {
            resetAppliedImessageThemeCss().catch((error) => {
                console.error('Failed to reset iMessage Theme CSS', error);
                showToast('重置失败，原美化已保留');
            });
        });
        
        // Clear Bubble CSS
        if (themeBubbleClearBtn) {
            themeBubbleClearBtn.addEventListener('click', async () => {
                 if (window.imData && window.imData.currentSettingsFriend) {
                    const friend = window.imData.currentSettingsFriend;
                    if (window.imApp && window.imApp.commitScopedFriendChange) {
                        const saved = await window.imApp.commitScopedFriendChange(friend, (targetFriend) => {
                            targetFriend.customCss = '';
                            targetFriend.customCssEnabled = false;
                        }, { silent: true, syncSettings: true });
                        
                        if (saved) {
                            if (themeBubbleCssInput) themeBubbleCssInput.value = '';
                            if (window.imApp.applyFriendCss) window.imApp.applyFriendCss(window.imData.currentSettingsFriend);
                            showToast('已清空气泡样式');
                        } else {
                            showToast('清空气泡样式失败');
                        }
                    }
                } else {
                    showToast('请先选择一个朋友');
                }
            });
        }
        
        // Clear Chat CSS
        if (themeChatClearBtn) {
            themeChatClearBtn.addEventListener('click', async () => {
                themeState.imessageChatCss = '';
                themeState.imessageChatCssEnabled = false;
                window.u2ThemeState = themeState;
                if (themeChatCssInput) themeChatCssInput.value = '';
                if (window.imApp && window.imApp.applyGlobalChatCss) {
                    window.imApp.applyGlobalChatCss(themeState);
                }
                const persisted = await saveGlobalData();
                showToast(persisted ? 'Chat CSS cleared' : 'Chat CSS 保存失败，当前效果未持久化');
            });
        }

        if (themeGroupClearBtn) {
            themeGroupClearBtn.addEventListener('click', async () => {
                themeState.imessageGroupCss = '';
                themeState.imessageGroupCssEnabled = false;
                window.u2ThemeState = themeState;
                if (themeGroupCssInput) themeGroupCssInput.value = '';
                if (window.imApp && window.imApp.applyGlobalGroupCss) {
                    window.imApp.applyGlobalGroupCss(themeState);
                }
                const persisted = await saveGlobalData();
                showToast(persisted ? 'Group CSS cleared' : 'Group CSS 保存失败，当前效果未持久化');
            });
        }

        // Clear Status CSS
        if (themeStatusClearBtn) {
            themeStatusClearBtn.addEventListener('click', async () => {
                if (themeStatusCssInput) themeStatusCssInput.value = '';

                if (window.imData && window.imData.currentSettingsFriend) {
                    const friend = window.imData.currentSettingsFriend;
                    if (window.imApp && window.imApp.commitScopedFriendChange) {
                        const saved = await window.imApp.commitScopedFriendChange(friend, (targetFriend) => {
                            targetFriend.statusCss = '';
                            targetFriend.statusCssEnabled = false;
                        }, { silent: true, syncSettings: true });

                        if (saved) {
                            if (window.imApp.applyFriendCss) window.imApp.applyFriendCss(window.imData.currentSettingsFriend);
                            showToast('已清空状态栏 CSS');
                        } else {
                            showToast('清空状态栏 CSS 失败');
                        }
                    }
                } else {
                    showToast('已清空状态栏 CSS 输入框');
                }
            });
        }

        function bindThemeSourceCopy(button, template, successMessage) {
            button?.addEventListener('click', () => {
                navigator.clipboard.writeText(template).then(() => {
                    showToast(successMessage);
                }).catch((error) => {
                    console.error('Copy failed', error);
                    showToast('复制失败');
                });
            });
        }

        bindThemeSourceCopy(themeHomeCopyBtn, `:scope {
  background: #ffffff;
}
:scope .line-header {
  background: rgba(255, 255, 255, 0.96);
}
:scope .line-content {
  color: #111111;
}
:scope .line-profile,
:scope .line-search-bar,
:scope .line-service-item,
:scope .line-list-item {
  background: #ffffff;
  border-color: #f2f2f7;
}
:scope .line-bottom-nav {
  background: rgba(255, 255, 255, 0.92);
}
:scope .chats-content,
:scope .chats-list-container {
  background: transparent;
}
:scope .chat-item {
  background: #ffffff;
  border-color: #f2f2f7;
}
:scope .chat-avatar {
  border-radius: 50%;
}
:scope .chat-name { color: #111111; }
:scope .chat-message,
:scope .chat-time { color: #8e8e93; }
:scope .chats-empty-state { color: #111111; }`, '已复制 Home 与 Chats 界面源码');

        if (themeBubbleCopyBtn) {
            themeBubbleCopyBtn.addEventListener('click', () => {
                const bubbleTemplate = `/* iMessage 真实气泡源码（单聊文本气泡）
   运行时结构：.chat-row.user-row/.ai-row > .chat-bubble.user-bubble/.ai-bubble
   提示：在主题编辑器里，:scope 代表当前聊天页根节点 */

.chat-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  width: 100%;
  transition: transform 0.2s, opacity 0.2s;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

.chat-row:not(.has-prev) {
  margin-top: 10px;
}

.chat-row:first-child {
  margin-top: 0;
}

.chat-row.user-row {
  justify-content: flex-end;
}

.chat-row.ai-row {
  justify-content: flex-start;
}

.chat-bubble {
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 20px;
  font-size: 15px;
  line-height: 1.4;
  word-wrap: break-word;
  white-space: pre-wrap;
  transition: border-radius 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.user-bubble {
  background-color: #2c2c2e;
  color: #fff;
  border-radius: 20px;
  position: relative;
}

.ai-bubble {
  background-color: #f2f2f7;
  color: #000;
  border-radius: 20px;
  position: relative;
}

/* 连续气泡圆角 */
.user-row.has-prev .user-bubble {
  border-top-right-radius: 4px;
}

.user-row.has-next .user-bubble {
  border-bottom-right-radius: 4px;
}

.ai-row.has-prev .ai-bubble {
  border-top-left-radius: 4px;
}

.ai-row.has-next .ai-bubble {
  border-bottom-left-radius: 4px;
}

/* 单聊消息头像与消息头
   这些节点由“显示头像”开关生成；运行时带内联初始值，因此这里使用 !important 方便主题覆盖 */
.chat-message-header {
  width: 100% !important;
  display: flex !important;
  align-items: flex-start !important;
  margin-bottom: 4px !important;
}

.chat-message-header.user-header {
  justify-content: flex-end !important;
}

.chat-message-header.ai-header {
  justify-content: flex-start !important;
}

.chat-message-header .chat-header-avatar {
  width: 44px !important;
  height: 44px !important;
  border: 1px solid #eee !important;
  border-radius: 50% !important;
  overflow: hidden !important;
  background: #fff !important;
  flex-shrink: 0 !important;
}

.chat-message-header .chat-header-avatar img {
  width: 100% !important;
  height: 100% !important;
  display: block;
  object-fit: cover !important;
}

.chat-message-header .chat-header-info {
  min-height: 44px;
  display: flex !important;
  flex-direction: column !important;
  justify-content: center !important;
}

.chat-message-header.user-header .chat-header-info {
  align-items: flex-end !important;
}

.chat-message-header.ai-header .chat-header-info {
  align-items: flex-start !important;
}

.chat-message-header .chat-header-name {
  margin-bottom: 2px !important;
  color: #333 !important;
  font-size: 14px !important;
  font-weight: 600 !important;
}

.chat-message-header .chat-header-date {
  color: #888 !important;
  font-size: 12px !important;
}

/* 群聊/多人消息的小头像 */
.chat-avatar-small {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: #e5e5ea;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 12px;
  color: #8e8e93;
}

.chat-avatar-small img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 单聊的每条实际消息都带一个隐藏头像节点，Theme 可按需显示。
   群聊继续使用原生的 .group-ai-avatar-slot，不使用这个节点。 */
.im-message-avatar {
  display: none;
  width: var(--im-message-avatar-size, 30px);
  height: var(--im-message-avatar-size, 30px);
  border-radius: var(--im-message-avatar-radius, 50%);
  overflow: hidden;
}

.im-message-avatar.is-user {
  /* 当前用户消息头像 */
}

.im-message-avatar.is-assistant {
  /* 单聊好友消息头像 */
}

.im-message-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 单聊居中时间分隔 */
.chat-timestamp {
  display: flex;
  justify-content: center;
  margin: 16px 0 6px;
}

.chat-timestamp span {
  padding: 4px 10px;
  border-radius: 12px;
  background: rgba(0,0,0,0.2);
  color: #fff;
  font-size: 11px;
}

/* 单聊气泡内时间/已读 */
.bubble-meta {
  display: none;
  margin-left: 6px;
  font-size: 10px;
  opacity: 0.7;
  vertical-align: bottom;
}

.bubble-time {
  white-space: nowrap;
}

:scope.show-timestamps .bubble-meta {
  display: inline-flex;
  align-items: center;
}

.bubble-read-icon {
  margin-left: 3px;
  font-size: 10px;
  letter-spacing: 0;
}

:scope.timestamp-outside .chat-bubble {
  overflow: visible;
}

:scope.timestamp-outside .user-row .bubble-meta {
  position: absolute;
  left: 0;
  bottom: 4px;
  transform: translateX(-100%);
  margin-left: -6px;
  margin-top: 0;
  color: #8e8e93;
}

:scope.timestamp-outside .ai-row .bubble-meta {
  position: absolute;
  right: 0;
  bottom: 4px;
  transform: translateX(100%);
  margin-right: -6px;
  margin-top: 0;
  color: #8e8e93;
}

/* 单聊可见 COT 卡片 */
.chat-cot-row {
  width: 100%;
  margin: 6px 0;
  display: flex;
  justify-content: flex-start;
  box-sizing: border-box;
}

.chat-cot-row.chat-cot-row-inline {
  margin: 2px 0 6px;
}

.chat-cot-card {
  width: fit-content;
  max-width: min(78%, 330px);
  overflow: hidden;
  border: 0;
  border-radius: 999px;
  background: rgba(242,242,247,0.94);
  color: #636366;
  box-sizing: border-box;
}

.chat-cot-card.is-expanded {
  width: min(78%, 330px);
  border-radius: 20px;
}

.chat-cot-toggle {
  width: 100%;
  min-height: 36px;
  padding: 7px 12px;
  border: 0;
  background: transparent;
  color: inherit;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font: inherit;
  cursor: pointer;
}

.chat-cot-title {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.chat-cot-chevron {
  flex: 0 0 auto;
  color: #8e8e93;
  font-size: 11px;
  transition: transform 0.2s ease;
}

.chat-cot-card.is-expanded .chat-cot-chevron {
  transform: rotate(180deg);
}

.chat-cot-content {
  padding: 0 12px 12px;
  color: #666;
  font-size: 13px;
  line-height: 1.58;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
  -webkit-user-select: text;
}

.chat-cot-content[hidden] {
  display: none;
}

.typing-row.im-cot-loading-row {
  margin-top: 10px;
}

.im-cot-loading-row .chat-cot-card {
  width: fit-content;
}

.im-cot-loading-row .chat-cot-toggle {
  cursor: default;
}

.im-cot-loading-dots {
  display: inline-flex;
  gap: 3px;
  margin-left: 3px;
}

.im-cot-loading-dots > span {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #8e8e93;
  animation: typingBounce 1.2s infinite ease-in-out;
}

.im-cot-loading-dots > span:nth-child(2) {
  animation-delay: 0.15s;
}

.im-cot-loading-dots > span:nth-child(3) {
  animation-delay: 0.3s;
}

/* 引用与翻译：实际由 JS 内联生成，这里给玩家可覆盖的真实 class */
.msg-reply-quote {
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 14px;
  margin-bottom: 8px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-bubble .msg-reply-quote {
  color: rgba(255,255,255,0.85);
  background: rgba(255,255,255,0.15);
}

.ai-bubble .msg-reply-quote {
  color: rgba(0,0,0,0.6);
  background: rgba(0,0,0,0.05);
}

.msg-translation {
  margin-top: 6px;
  padding-top: 6px;
  font-size: 13px;
  line-height: 1.4;
  word-wrap: break-word;
  white-space: normal;
}

.user-bubble .msg-translation {
  border-top: 1px solid rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.7);
}

.ai-bubble .msg-translation {
  border-top: 1px solid rgba(0,0,0,0.1);
  color: #8e8e93;
}`;
                navigator.clipboard.writeText(bubbleTemplate).then(() => {
                    if (window.showToast) window.showToast('已复制真实气泡源码');
                }).catch(err => {
                    console.error('Copy failed', err);
                    if (window.showToast) window.showToast('复制失败');
                });
            });
        }

        if (themeChatCopyBtn) {
            themeChatCopyBtn.addEventListener('click', () => {
                const chatTemplate = `/* iMessage 真实单聊 Chat 源码
   运行时根节点：.active-chat-interface.im-chat-single
   提示：在主题编辑器里，:scope 代表当前单聊根节点 */

:scope {
  --im-chat-bg-color: #ffffff;
  --im-chat-bg-image: none;
  --im-chat-bg-size: cover;
  --im-chat-bg-position: center;
  --im-chat-bg-repeat: no-repeat;
  --im-chat-avatar-size: 44px;
  --im-chat-name-size: 16px;
  --im-chat-sign-size: 11px;
  --im-chat-status-dot-size: 7px;
  --im-chat-header-gap: 10px;
  --im-chat-header-left-offset: 12px;
  --im-chat-header-padding: 0 16px;
  --im-chat-header-bg: #ffffff;
  --im-chat-header-border: 1px solid #f2f2f7;
  --im-chat-input-container-bg: #ffffff;
  --im-chat-input-bg: #f2f2f7;
  --im-chat-input-radius: 22px;
  position: absolute;
  inset: 0;
  flex-direction: column;
  background-color: var(--im-chat-bg-color);
  background-image: var(--im-chat-bg-image);
  background-size: var(--im-chat-bg-size);
  background-position: var(--im-chat-bg-position);
  background-repeat: var(--im-chat-bg-repeat);
  z-index: 150;
  min-height: 0;
  overflow: hidden;
}

:scope.has-chat-bg {
  --im-chat-header-bg: #ffffff;
  --im-chat-header-border: 1px solid #f2f2f7;
  --im-chat-header-backdrop: none;
  --im-chat-input-container-bg: transparent;
}

.chat-sticky-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 20;
  padding-top: max(10px, env(safe-area-inset-top, 0px));
  padding-bottom: 10px;
  pointer-events: none;
}

.chat-sticky-container.is-friend {
  background: #ffffff;
  border-bottom: var(--im-chat-header-border, 1px solid #f2f2f7);
  padding-bottom: 5px;
}

.chat-sticky-container :where(
  .chat-back-btn,
  .im-chat-back-btn,
  .chat-call-btn,
  .chat-menu-btn,
  .chat-cancel-batch-btn,
  .im-chat-header-main,
  .im-chat-header-main *,
  .ins-chat-avatar,
  .ins-chat-avatar *
) {
  pointer-events: auto;
}

.chat-top-bar {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: space-between;
  padding: var(--im-chat-header-padding);
  align-items: center;
  color: #000;
  font-size: 20px;
  z-index: 10;
  pointer-events: none;
}

.im-chat-top-bar {
  padding-left: var(--im-chat-header-left-offset) !important;
}

.im-chat-header-left,
.im-chat-actions,
.im-chat-input-actions {
  display: flex;
  align-items: center;
}

.im-chat-header-left {
  gap: var(--im-chat-header-gap);
  min-width: 0;
}

.im-chat-header-main {
  display: flex;
  align-items: center;
  min-width: 0;
}

.im-chat-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.ins-chat-avatar {
  width: var(--im-chat-avatar-size);
  height: var(--im-chat-avatar-size);
  border-radius: 50%;
  background-color: #f2f2f7;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #8e8e93;
  overflow: hidden;
  margin: 0;
  flex-shrink: 0;
}

.ins-chat-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.im-chat-title-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-left: 8px;
  gap: 1px;
  min-width: 0;
}

.ins-chat-name {
  font-size: var(--im-chat-name-size);
  font-weight: 600;
  color: #000;
  line-height: 1.05;
}

.ins-chat-sign {
  font-size: var(--im-chat-sign-size);
  color: #8e8e93;
  margin-top: 0;
  line-height: 1;
  display: flex;
  align-items: center;
  gap: 4px;
}

.im-chat-status-dot {
  width: var(--im-chat-status-dot-size);
  height: var(--im-chat-status-dot-size);
  border-radius: 50%;
  background: #34c759;
}

.chat-back-btn,
.chat-menu-btn,
.chat-call-btn {
  cursor: pointer;
  color: #000;
}

.ins-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

/* 单聊消息头像与消息头
   由“显示头像”开关生成；运行时带内联初始值，因此使用 !important 方便主题覆盖 */
.chat-message-header {
  width: 100% !important;
  display: flex !important;
  align-items: flex-start !important;
  margin-bottom: 4px !important;
}

.chat-message-header.user-header {
  justify-content: flex-end !important;
}

.chat-message-header.ai-header {
  justify-content: flex-start !important;
}

.chat-message-header .chat-header-avatar {
  width: 44px !important;
  height: 44px !important;
  border: 1px solid #eee !important;
  border-radius: 50% !important;
  overflow: hidden !important;
  background: #fff !important;
  flex-shrink: 0 !important;
}

.chat-message-header .chat-header-avatar img {
  width: 100% !important;
  height: 100% !important;
  display: block;
  object-fit: cover !important;
}

.chat-message-header .chat-header-info {
  min-height: 44px;
  display: flex !important;
  flex-direction: column !important;
  justify-content: center !important;
}

.chat-message-header.user-header .chat-header-info {
  align-items: flex-end !important;
}

.chat-message-header.ai-header .chat-header-info {
  align-items: flex-start !important;
}

.chat-message-header .chat-header-name {
  margin-bottom: 2px !important;
  color: #333 !important;
  font-size: 14px !important;
  font-weight: 600 !important;
}

.chat-message-header .chat-header-date {
  color: #888 !important;
  font-size: 12px !important;
}

/* 单聊每条实际消息的隐藏头像钩子；没有设置开关，由 Theme CSS 自行决定是否显示。 */
.im-message-avatar {
  display: none;
  width: var(--im-message-avatar-size, 30px);
  height: var(--im-message-avatar-size, 30px);
  border-radius: var(--im-message-avatar-radius, 50%);
  overflow: hidden;
}

.im-message-avatar.is-user { /* 当前用户消息头像 */ }
.im-message-avatar.is-assistant { /* 单聊好友消息头像 */ }
.im-message-avatar img { width: 100%; height: 100%; object-fit: cover; }

/* 单聊时间戳：居中分隔时间、气泡内时间和外置时间 */
.chat-timestamp {
  display: flex;
  justify-content: center;
  margin: 16px 0 6px;
}

.chat-timestamp span {
  padding: 4px 10px;
  border-radius: 12px;
  background: rgba(0,0,0,0.2);
  color: #fff;
  font-size: 11px;
}

.bubble-meta {
  display: none;
  margin-left: 6px;
  font-size: 10px;
  opacity: 0.7;
  vertical-align: bottom;
}

.bubble-time {
  white-space: nowrap;
}

:scope.show-timestamps .bubble-meta {
  display: inline-flex;
  align-items: center;
}

.bubble-read-icon {
  margin-left: 3px;
  font-size: 10px;
  letter-spacing: 0;
}

:scope.timestamp-outside .chat-bubble {
  overflow: visible;
}

:scope.timestamp-outside .user-row .bubble-meta {
  position: absolute;
  left: 0;
  bottom: 4px;
  transform: translateX(-100%);
  margin-left: -6px;
  color: #8e8e93;
}

:scope.timestamp-outside .ai-row .bubble-meta {
  position: absolute;
  right: 0;
  bottom: 4px;
  transform: translateX(100%);
  margin-right: -6px;
  color: #8e8e93;
}

/* 单聊可见 COT 卡片 */
.chat-cot-row {
  width: 100%;
  margin: 6px 0;
  display: flex;
  justify-content: flex-start;
  box-sizing: border-box;
}

.chat-cot-row.chat-cot-row-inline {
  margin: 2px 0 6px;
}

.chat-cot-card {
  width: fit-content;
  max-width: min(78%, 330px);
  overflow: hidden;
  border: 0;
  border-radius: 999px;
  background: rgba(242,242,247,0.94);
  color: #636366;
  box-sizing: border-box;
}

.chat-cot-card.is-expanded {
  width: min(78%, 330px);
  border-radius: 20px;
}

.chat-cot-toggle {
  width: 100%;
  min-height: 36px;
  padding: 7px 12px;
  border: 0;
  background: transparent;
  color: inherit;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font: inherit;
  cursor: pointer;
}

.chat-cot-title {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.chat-cot-chevron {
  flex: 0 0 auto;
  color: #8e8e93;
  font-size: 11px;
  transition: transform 0.2s ease;
}

.chat-cot-card.is-expanded .chat-cot-chevron {
  transform: rotate(180deg);
}

.chat-cot-content {
  padding: 0 12px 12px;
  color: #666;
  font-size: 13px;
  line-height: 1.58;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
  -webkit-user-select: text;
}

.chat-cot-content[hidden] {
  display: none;
}

.typing-row.im-cot-loading-row {
  margin-top: 10px;
}

.im-cot-loading-row .chat-cot-card {
  width: fit-content;
}

.im-cot-loading-row .chat-cot-toggle {
  cursor: default;
}

.im-cot-loading-dots {
  display: inline-flex;
  gap: 3px;
  margin-left: 3px;
}

.im-cot-loading-dots > span {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #8e8e93;
  animation: typingBounce 1.2s infinite ease-in-out;
}

.im-cot-loading-dots > span:nth-child(2) {
  animation-delay: 0.15s;
}

.im-cot-loading-dots > span:nth-child(3) {
  animation-delay: 0.3s;
}

.ins-chat-input-container {
  width: 100%;
  padding: 10px 16px 8px;
  padding-bottom: max(12px, env(safe-area-inset-bottom, 0px));
  background-color: var(--im-chat-input-container-bg, #ffffff);
  border-top: none;
  z-index: 30;
  box-sizing: border-box;
}

.keyboard-open .ins-chat-input-container {
  padding: 8px 12px;
}

.ins-chat-input-wrapper {
  display: flex;
  align-items: center;
  background-color: var(--im-chat-input-bg);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--im-chat-input-radius);
  padding: 6px 12px;
  gap: 10px;
}

.ins-message-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
  padding: 8px 0;
  min-width: 0;
  color: #111;
}

.ins-input-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: #007aff;
  color: #fff;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  font-size: 14px;
  flex-shrink: 0;
}

.im-chat-input-actions {
  gap: 8px;
}

.send-btn-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  border: none;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  transition: background-color 0.16s ease, transform 0.16s ease, opacity 0.16s ease;
}

.send-btn-icon:active {
  transform: scale(0.94);
}

.send-btn {
  background: transparent;
  color: #8e8e93;
  font-size: 16px;
}

.send-btn:active {
  background: transparent;
  color: #636366;
}

.mic-btn {
  background: #111111;
  color: #ffffff;
}

.mic-btn:active {
  background: #2c2c2e;
}

/* =========================================================
   消息卡片通用层
   结构：.chat-row > .chat-bubble.im-card-bubble > .im-card-content
   ========================================================= */
.chat-row .chat-bubble.im-card-bubble {
  width: auto !important;
  min-width: 0 !important;
  max-width: min(70%, 260px) !important;
  flex: 0 1 auto !important;
  white-space: normal !important;
  box-sizing: border-box !important;
}

.chat-row .chat-bubble.im-card-bubble .im-card-content {
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
}

:scope.timestamp-outside .pay-transfer-bubble .bubble-meta { bottom: 12px; }

/* 图片卡片 */
.chat-row .chat-bubble.image-message-bubble { max-width: min(62vw, 204px) !important; padding: 0; background: transparent; }
.chat-image-bubble-img { width: min(56vw, 200px) !important; height: min(56vw, 200px) !important; max-width: 200px !important; max-height: 200px !important; display: block; object-fit: cover; border-radius: 18px; }

/* 转账、亲属卡与收款凭证 */
.pay-transfer-bubble { padding: 4px 6px !important; min-width: 156px; max-width: min(56vw, 210px) !important; background: transparent !important; color: #111 !important; }
.pay-transfer-bubble .bubble-meta { margin-top: 4px; }
.pay-transfer-card { padding: 11px 12px; border: 1px solid rgba(0,0,0,0.05); border-radius: 20px; background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,248,250,0.98)); color: #111; }
.pay-transfer-card.is-received { background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,249,246,0.98)); }
.pay-transfer-card.is-income { background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,247,255,0.98)); }
.pay-transfer-card.is-pending { background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(249,249,251,0.98)); cursor: pointer; }
.pay-transfer-card.is-rejected { opacity: 0.72; }
.pay-transfer-card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.pay-transfer-card-icon { width: 28px; height: 28px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 10px; background: #111; color: #fff; font-size: 12px; }
.pay-transfer-card-meta { min-width: 0; flex: 1; }
.pay-transfer-card-title { color: #111; font-size: 12px; font-weight: 700; line-height: 1.1; }
.pay-transfer-card-subtitle { margin-top: 2px; overflow: hidden; color: #8e8e93; font-size: 10px; white-space: nowrap; text-overflow: ellipsis; }
.pay-transfer-card-amount { margin-bottom: 4px; color: #111; font-size: 20px; font-weight: 700; line-height: 1.05; letter-spacing: -0.03em; }
.pay-transfer-card-desc { margin-bottom: 0; color: #636366; font-size: 11px; line-height: 1.35; word-break: break-word; }
.pay-receipt-card { width: min(76vw, 280px) !important; max-width: 280px !important; padding: 16px; border-radius: 12px; background: #fff; color: #111; box-sizing: border-box; }

/* 语音卡片 */
.voice-message-bubble { min-width: 0; max-width: min(70%, 240px) !important; padding: 10px 14px; overflow: visible; }
.voice-message-bubble-inner { width: auto; min-height: 0; display: flex; align-items: center; gap: 8px; padding: 0; border: 0; border-radius: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; text-align: left; }
.voice-message-mic { display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: inherit; font-size: 14px; }
.voice-message-wave { display: flex; align-items: center; gap: 3px; min-width: 0; }
.voice-message-wave span { display: block; width: 3px; border-radius: 999px; background: currentColor; opacity: 0.82; }
.voice-message-duration { font-size: 12px; font-weight: 700; line-height: 1; white-space: nowrap; opacity: 0.76; }
.voice-message-transcript { margin-top: 7px; padding-top: 7px; border-top: 1px solid rgba(255,255,255,0.22); font-size: 13px; line-height: 1.45; white-space: normal; word-break: break-word; }
.ai-bubble .voice-message-transcript { color: #2c2c2e; border-top-color: rgba(0,0,0,0.12); }

/* 贴纸 */
.sticker-message-wrap { width: auto !important; max-width: min(44vw, 150px) !important; display: inline-flex; flex-direction: column; align-items: flex-end; padding: 0; background: transparent; }
.ai-row .sticker-message-wrap { align-items: flex-start; }
.sticker-message-img { width: auto !important; max-width: min(40vw, 132px) !important; max-height: min(40vw, 132px) !important; display: block; object-fit: contain; background: transparent; }
.sticker-message-meta { margin-top: 3px; color: #8e8e93; text-shadow: none; }
.sticker-group-wrap { max-width: min(78%, 190px); }

/* 朋友圈转发卡片 */
.moment-forward-bubble { width: min(62vw, 220px) !important; min-width: 0 !important; max-width: min(62vw, 220px) !important; display: flex; align-items: center; gap: 12px; margin: 4px 0; padding: 10px !important; border: 1px solid #e5e5ea !important; border-radius: 16px; background: #fff !important; color: #111; box-sizing: border-box; cursor: pointer; }

/* 链接卡片 */
.chat-link-card { width: min(64vw, 228px); overflow: hidden; border: 1px solid rgba(0,0,0,0.07); border-radius: 15px; background: #fbfbfd; color: #111; cursor: pointer; text-align: left; }
.chat-link-card-cover { height: 74px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: linear-gradient(135deg, #1c1c1e, #6b6b70); color: #fff; font-size: 22px; }
.chat-link-card-cover img { width: 100%; height: 100%; display: block; object-fit: cover; }
.chat-link-card-body { padding: 9px 10px 10px; }
.chat-link-card-platform { color: var(--link-card-color, #3a3a3c); font-size: 9px; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase; }
.chat-link-card-title { margin-top: 3px; overflow: hidden; color: #111; font-size: 13px; font-weight: 800; line-height: 1.32; word-break: break-word; }
.chat-link-card-summary { margin-top: 5px; overflow: hidden; color: #636366; font-size: 10px; line-height: 1.38; word-break: break-word; }
.chat-link-card-footer { margin-top: 8px; padding-top: 7px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border-top: 1px solid #f2f2f7; color: #8e8e93; font-size: 9px; }
.chat-link-card-footer span { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

/* HTML / Loves 自定义卡片 */
.html-bubble.im-card-bubble { position: relative; max-width: min(72%, 260px) !important; padding: 0; background: transparent; }
.html-bubble.im-card-bubble > * { max-width: 100% !important; box-sizing: border-box !important; }
.html-bubble.im-card-bubble .loves-invite-bubble { width: min(62vw, 220px) !important; max-width: 100% !important; box-sizing: border-box !important; }

/* 通话记录与线下见面记录 */
.voice-call-record-bubble { min-width: 176px !important; padding: 0; background: transparent; }
.voice-call-record-card { display: flex; align-items: center; gap: 10px; overflow: hidden; padding: 10px 14px; border-radius: 18px; background: #f2f2f7; color: #111; cursor: pointer; }
.offline-meeting-record-card { max-width: 84%; padding: 11px 15px; align-items: flex-start; background: rgba(0,0,0,0.05); text-align: left; }

/* 系统通知、撤回提示与群私聊入口 */
.chat-system-row { width: 100%; display: flex; justify-content: center; }
.system-notice-card { max-width: 80%; padding: 10px 16px; border-radius: 18px; background: rgba(0,0,0,0.05); color: #000; font-size: 13px; line-height: 1.4; }
.system-notice-narration { text-align: left; cursor: pointer; }
.system-notice-default,
.system-notice-offline_meeting_active { text-align: center; }
.message-recalled-notice { color: #8e8e93; font-size: 12px; text-align: center; }
.message-recalled-view-link { margin-left: 6px; color: #007aff; cursor: pointer; }
}`;
                navigator.clipboard.writeText(chatTemplate).then(() => {
                    if (window.showToast) window.showToast('已复制真实单聊 Chat 源码');
                }).catch(err => {
                    console.error('Copy failed', err);
                    if (window.showToast) window.showToast('复制失败');
                });
            });
        }

        if (themeGroupCopyBtn) {
            themeGroupCopyBtn.addEventListener('click', () => {
                const groupTemplate = `/* iMessage Group CSS source
   Runtime root: .active-chat-interface.im-chat-group
   In this editor, :scope represents that group-chat root only. */

:scope {
  --group-chat-bg: #ffffff;
  --group-chat-header-bg: #ffffff;
  --group-chat-input-bg: #ffffff;
  --group-chat-accent: #007aff;
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--group-chat-bg);
}

:scope .chat-sticky-container.is-group {
  background: var(--group-chat-header-bg);
  border-bottom: 1px solid #e5e5ea;
  z-index: 20;
}

:scope .im-chat-group-title-wrap { color: #111; }
:scope .group-header-right-avatar { border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.16); }
:scope .ins-chat-messages { flex: 1; min-height: 0; background: transparent; }
:scope .ins-chat-input-container { background: var(--group-chat-input-bg); border-top: 1px solid #e5e5ea; }

:scope .group-ai-bubble-wrap { display: flex; align-items: flex-end; gap: 8px; }
:scope .group-ai-speaker-name { color: #6d6d72; font-size: 12px; }
:scope .group-ai-bubble-row { align-items: flex-end; }
:scope .group-ai-avatar-slot { width: 34px; height: 34px; }
:scope .group-ai-avatar-placeholder { background: #e5e5ea; color: #6d6d72; }

:scope .group-poll-card { width: min(232px, 64vw); border: 1px solid #e5e5ea; background: #fff; }
:scope .group-poll-card-head { padding: 13px 14px 8px; }
:scope .group-poll-card-kicker { color: var(--group-chat-accent); }
:scope .group-poll-card-title { color: #111; }
:scope .group-poll-card-options { padding: 0 10px; }
:scope .group-poll-card-option { border-color: #e5e5ea; }
:scope .group-poll-card-option.is-user-selected { border-color: var(--group-chat-accent); }
:scope .group-poll-radio { border-color: #8e8e93; }
:scope .group-poll-card-option.is-user-selected .group-poll-radio { border-color: var(--group-chat-accent); }
:scope .group-poll-voters, :scope .group-poll-voter { color: #6d6d72; }
:scope .group-poll-card-footer { color: #8e8e93; }

:scope .group-red-packet-card, :scope .group-red-packet-bubble { background: #fa9d3b; color: #fff; }
:scope .group-red-packet-card .group-red-packet-amount { color: #fff7dd; }
:scope .group-red-packet-card .group-red-packet-footer { color: rgba(255,255,255,.72); }

:scope .chat-system-row .system-notice-card,
:scope .group-system-notice-card,
:scope .system-notice-group_join,
:scope .system-notice-group_left,
:scope .system-notice-red_packet_claim { background: rgba(142,142,147,.14); color: #6d6d72; }
:scope .group-private-chat-view-link { color: var(--group-chat-accent); }
`;
                navigator.clipboard.writeText(groupTemplate).then(() => {
                    if (window.showToast) window.showToast('已复制 Group CSS 源码');
                }).catch(err => {
                    console.error('Copy failed', err);
                    if (window.showToast) window.showToast('复制失败');
                });
            });
        }

        if (themeStatusCopyBtn) {
            themeStatusCopyBtn.addEventListener('click', () => {
                const statusTemplate = `/* iMessage 真实状态栏/资料卡源码
   运行时结构：.chat-profile-panel-overlay 内的 .chat-profile-panel-card / .gmp-*
   提示：在主题编辑器里，:scope 代表当前聊天页根节点 */

:scope .chat-profile-panel-overlay {
  position: absolute;
  inset: 0;
  z-index: 1100;
  display: none;
  align-items: flex-start;
  justify-content: center;
  padding: calc(88px + env(safe-area-inset-top, 0px)) 16px 24px;
  background: rgba(0, 0, 0, 0.22);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.22s ease;
}

.chat-profile-panel-overlay.active {
  opacity: 1;
  pointer-events: auto;
}

.chat-profile-panel-card {
  width: min(100%, 320px);
  background: #ffffff;
  border-radius: 24px;
  overflow: hidden;
  transform: translateY(12px) scale(0.96);
  opacity: 0;
  transition: transform 0.22s ease, opacity 0.22s ease;
}

.chat-profile-panel-overlay.active .chat-profile-panel-card {
  transform: translateY(0) scale(1);
  opacity: 1;
}

.gmp-header,
.chat-profile-panel-header {
  height: 88px;
  background: linear-gradient(180deg, #f2f2f7 0%, #ffffff 100%);
  position: relative;
}

.gmp-avatar-wrapper {
  position: absolute;
  bottom: -30px;
  left: 16px;
  display: flex;
  align-items: flex-end;
}

.chat-profile-panel-header .gmp-avatar-wrapper {
  bottom: -34px;
  left: 18px;
}

.gmp-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 3px solid #ffffff;
  background-color: #e5e5ea;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 24px;
  color: #8e8e93;
  overflow: hidden;
}

.chat-profile-panel-header .gmp-avatar {
  width: 66px;
  height: 66px;
}

.gmp-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gmp-status-bubble {
  background: #ffffff;
  border: 1px solid #e5e5ea;
  border-radius: 14px;
  padding: 4px 10px;
  font-size: 12px;
  color: #333;
  margin-left: -8px;
  margin-bottom: 6px;
  position: relative;
  cursor: pointer;
}

.gmp-status-bubble::before {
  content: '';
  position: absolute;
  left: -5px;
  bottom: 8px;
  border-width: 5px 5px 5px 0;
  border-style: solid;
  border-color: transparent #ffffff transparent transparent;
  filter: drop-shadow(-1px 0px 0px #e5e5ea);
}

.chat-profile-panel-header-status {
  max-width: 170px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-profile-panel-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  color: #111;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.chat-profile-panel-close:active {
  transform: scale(0.96);
}

.gmp-body,
.chat-profile-panel-body {
  padding: 40px 16px 16px;
  display: flex;
  flex-direction: column;
}

.chat-profile-panel-body {
  padding-top: 46px;
  gap: 0;
}

.gmp-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.gmp-name {
  font-size: 18px;
  font-weight: 700;
  color: #000;
}

.gmp-title {
  background: #f2f2f7;
  color: #8e8e93;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 500;
}

.gmp-signature {
  font-size: 13px;
  color: #8e8e93;
  margin-bottom: 12px;
  line-height: 1.4;
}

.gmp-inner-voice,
.chat-profile-panel-thought {
  font-size: 13px;
  color: #333;
  line-height: 1.4;
  background: #f2f2f7;
  padding: 10px 12px;
  border-radius: 16px;
  margin-bottom: 16px;
  min-height: 40px;
  position: relative;
  white-space: pre-wrap;
  word-break: break-word;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.gmp-inner-voice::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 12px;
  border-width: 0 6px 6px 6px;
  border-style: solid;
  border-color: transparent transparent #f2f2f7 transparent;
}

.chat-profile-panel-thought.is-empty {
  color: #8e8e93;
}

.chat-profile-panel-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-profile-panel-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-profile-panel-section-label {
  color: #8e8e93;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.chat-profile-panel-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chat-profile-panel-meta-bubble {
  background: #f2f2f7;
  border-radius: 14px;
  padding: 8px 10px;
  min-width: 0;
}

.chat-profile-panel-meta-key {
  color: #8e8e93;
  font-size: 11px;
  margin-bottom: 2px;
}

.chat-profile-panel-meta-value {
  color: #111;
  font-size: 13px;
  font-weight: 700;
  word-break: break-word;
}

.chat-profile-panel-events {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-profile-panel-empty {
  padding: 20px 14px;
  text-align: center;
  color: #8e8e93;
}

.chat-profile-panel-empty-title {
  color: #111;
  font-size: 14px;
  font-weight: 700;
}

.chat-profile-panel-empty-desc {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.45;
}

.chat-profile-panel-floating-tabs {
  position: relative;
  z-index: 2;
  pointer-events: auto;
}

.chat-profile-panel-tab-btn {
  pointer-events: auto;
  touch-action: manipulation;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  background: #fff;
  color: #111;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 22px;
  cursor: pointer;
  transition: transform 0.2s, background 0.2s;
}

.chat-profile-panel-tab-btn.active {
  background: #111;
  color: #fff;
}

/* 好感度、状态正文与历史 */
.chat-profile-status-affection { display: flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; background: #f2f2f7; color: #8e8e93; font-size: 13px; font-weight: 700; }
.chat-profile-status-affection-change { margin-top: 4px; color: #8e8e93; font-size: 10px; font-weight: 600; }
.chat-profile-status-page { width: 100%; }
.chat-profile-status-time { margin-bottom: 7px; color: #8e8e93; font-size: 11px; text-align: right; }
.chat-profile-status-counter { margin-top: 10px; color: #8e8e93; font-size: 11px; font-weight: 700; text-align: center; }

/* 悬浮操作、翻页、编辑和删除 */
.chat-profile-panel-action-btn { width: 42px; height: 42px; flex: 0 0 42px; display: flex; align-items: center; justify-content: center; border: 0; border-radius: 50%; background: #fff; color: #111; font-size: 15px; cursor: pointer; touch-action: manipulation; transition: transform 0.18s ease, background 0.18s ease; }
.chat-profile-panel-action-btn.is-page { font-size: 14px; }
.chat-profile-panel-action-btn.is-danger { color: #ff3b30; }
.chat-profile-panel-action-btn:disabled { opacity: 0.34; cursor: default; transform: none; }
.chat-profile-panel-action-btn:active { transform: scale(0.94); background: #f2f2f7; }
.chat-profile-panel-tab-btn i,
.chat-profile-panel-action-btn i,
.chat-profile-panel-close i { pointer-events: none; }

/* 普通事件列表 */
.chat-profile-event-item { display: flex; align-items: flex-start; gap: 10px; padding: 12px 12px 12px 4px; border-radius: 18px; background: #f8f8fb; }
.chat-profile-event-dot { width: 10px; height: 10px; margin-top: 6px; flex-shrink: 0; border-radius: 50%; background: #111; }
.chat-profile-event-main { flex: 1; min-width: 0; }
.chat-profile-event-title-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
.chat-profile-event-title { color: #111; font-size: 14px; font-weight: 700; line-height: 1.35; }
.chat-profile-event-time { flex-shrink: 0; color: #8e8e93; font-size: 11px; white-space: nowrap; }
.chat-profile-event-desc { color: #666; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }

/* 珍视回忆事件卡 */
.chat-profile-memory-request-card { display: flex; flex-direction: column; gap: 10px; padding: 14px; border: 1px solid #ececf2; border-radius: 20px; background: linear-gradient(180deg, #fff, #f8f8fb); }
.chat-profile-memory-request-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.chat-profile-memory-request-title { color: #111827; font-size: 14px; font-weight: 700; line-height: 1.4; }
.chat-profile-memory-request-badge { flex-shrink: 0; padding: 4px 10px; border-radius: 999px; background: #eef2ff; color: #4f46e5; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; }
.chat-profile-memory-request-badge.is-confirmed { background: #e8fff1; color: #149954; }
.chat-profile-memory-request-badge.is-cancelled { background: #fff1f2; color: #e11d48; }
.chat-profile-memory-request-content { color: #374151; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.chat-profile-memory-request-detail { padding: 10px 12px; border: 1px solid #ececf2; border-radius: 14px; background: rgba(255,255,255,0.72); color: #6b7280; font-size: 12px; line-height: 1.55; }
.chat-profile-memory-request-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.chat-profile-memory-request-time { color: #9ca3af; font-size: 11px; }
.chat-profile-memory-request-detail-trigger { padding: 0; border: 0; background: transparent; color: #111827; font-size: 12px; font-weight: 700; cursor: pointer; }
.chat-profile-memory-request-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.chat-profile-memory-request-btn { min-height: 40px; border: 0; border-radius: 14px; font-size: 13px; font-weight: 700; cursor: pointer; }
.chat-profile-memory-request-btn.is-confirm { background: #111827; color: #fff; }
.chat-profile-memory-request-btn.is-cancel { background: #f3f4f6; color: #6b7280; }
.chat-profile-memory-request-btn:active,
.chat-profile-memory-request-detail-trigger:active { transform: scale(0.97); opacity: 0.65; }

/* 事件详情弹层 */
.chat-profile-event-detail-overlay { position: absolute; inset: 0; z-index: 8; display: none; align-items: center; justify-content: center; padding: 18px; background: rgba(15,23,42,0.24); opacity: 0; transition: opacity 0.22s ease; }
.chat-profile-event-detail-overlay.active { opacity: 1; }
.chat-profile-event-detail-card { position: relative; width: min(100%, 284px); max-height: min(68vh, 420px); overflow-y: auto; padding: 18px 16px 16px; border-radius: 24px; background: rgba(255,255,255,0.97); transform: translateY(10px) scale(0.96); opacity: 0; transition: transform 0.22s ease, opacity 0.22s ease; }
.chat-profile-event-detail-overlay.active .chat-profile-event-detail-card { transform: translateY(0) scale(1); opacity: 1; }
.chat-profile-event-detail-close { position: absolute; top: 12px; right: 12px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border: 0; border-radius: 50%; background: #f3f4f6; color: #111827; cursor: pointer; }
.chat-profile-event-detail-label { min-height: 24px; display: inline-flex; align-items: center; margin-bottom: 12px; padding: 0 10px; border-radius: 999px; background: #f3f4f6; color: #6b7280; font-size: 11px; font-weight: 700; }
.chat-profile-event-detail-title { margin-bottom: 8px; padding-right: 36px; color: #111827; font-size: 18px; font-weight: 800; line-height: 1.35; }
.chat-profile-event-detail-time { margin-bottom: 14px; color: #9ca3af; font-size: 12px; }
.chat-profile-event-detail-desc { margin-bottom: 12px; color: #374151; font-size: 14px; line-height: 1.65; white-space: pre-wrap; word-break: break-word; }
.chat-profile-event-detail-detail { padding: 12px 13px; border: 1px solid #ececf2; border-radius: 16px; background: #f8f8fb; color: #6b7280; font-size: 13px; line-height: 1.65; white-space: pre-wrap; word-break: break-word; }

/* 状态编辑弹层 */
.chat-profile-status-edit-overlay { position: absolute; inset: 0; z-index: 12; display: none; align-items: center; justify-content: center; padding: 14px; background: rgba(0,0,0,0.32); opacity: 0; transition: opacity 0.18s ease; }
.chat-profile-status-edit-overlay.active { opacity: 1; }
.chat-profile-status-edit-card { width: 100%; max-height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding: 18px; border-radius: 20px; background: #fff; transform: translateY(8px) scale(0.98); transition: transform 0.18s ease; }
.chat-profile-status-edit-overlay.active .chat-profile-status-edit-card { transform: translateY(0) scale(1); }
.chat-profile-status-edit-title { color: #111; font-size: 18px; font-weight: 750; }
.chat-profile-status-edit-card label { display: flex; flex-direction: column; gap: 5px; color: #666; font-size: 12px; font-weight: 700; }
.chat-profile-status-edit-card textarea { width: 100%; box-sizing: border-box; padding: 10px 11px; border: 1px solid #e5e5ea; border-radius: 12px; background: #f8f8fb; color: #111; font: inherit; font-size: 14px; resize: none; outline: none; }
.chat-profile-status-edit-readonly { color: #8e8e93; font-size: 12px; }
.chat-profile-status-edit-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.chat-profile-status-edit-actions button { min-height: 40px; border: 0; border-radius: 12px; background: #f2f2f7; color: #111; font-size: 14px; font-weight: 700; }
.chat-profile-status-edit-actions button.is-primary { background: #111; color: #fff; }
}`;
                navigator.clipboard.writeText(statusTemplate).then(() => {
                    if (window.showToast) window.showToast('已复制真实状态栏源码');
                }).catch(err => {
                    console.error('Copy failed', err);
                    if (window.showToast) window.showToast('复制失败');
                });
            });
        }

        // Preset management lives with themeState so writes are durable before the UI confirms them.
        function loadPresets(type) {
            themeState.imessageCssPresets = normalizeImessageCssPresets(themeState.imessageCssPresets);
            return themeState.imessageCssPresets[type] || [];
        }

        async function savePresets(type, presets) {
            themeState.imessageCssPresets = {
                ...normalizeImessageCssPresets(themeState.imessageCssPresets),
                [type]: normalizeImessageCssPresets({ [type]: presets })[type]
            };
            window.u2ThemeState = themeState;
            return saveGlobalData();
        }

        function getCurrentFriendThemeCss(friend, type) {
            if (type === 'home') return themeState.imessageHomeCssEnabled ? (themeState.imessageHomeCss || '') : '';
            if (type === 'group') return themeState.imessageGroupCssEnabled ? (themeState.imessageGroupCss || '') : '';
            if (!friend) return '';
            if (type === 'bubble') return friend.customCssEnabled ? (friend.customCss || '') : '';
            if (type === 'chat') return friend.chatCssEnabled ? (friend.chatCss || '') : '';
            return friend.statusCssEnabled ? (friend.statusCss || '') : '';
        }

        function updatePresetSelect(type, selectEl, activeCss = '') {
            if (!selectEl) return;
            const presets = loadPresets(type);
            selectEl.innerHTML = '<option value="">默认主题（不应用 CSS）</option>';
            presets.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.css;
                opt.textContent = p.name;
                selectEl.appendChild(opt);
            });
            if (activeCss && !presets.some((preset) => preset.css === activeCss)) {
                const currentOption = document.createElement('option');
                currentOption.value = activeCss;
                currentOption.textContent = '当前已应用的自定义主题';
                selectEl.appendChild(currentOption);
            }
            selectEl.value = activeCss || '';
        }

        function renderThemePresetList(type, listEl, selectEl, cssInputEl) {
            if (!listEl) return;
            listEl.innerHTML = '';
            const presets = loadPresets(type);
            
            if (presets.length === 0) {
                listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #8e8e93;">暂无预设</div>';
                return;
            }

            presets.forEach(preset => {
                const item = document.createElement('div');
                item.className = 'account-card';
                item.style.marginBottom = '10px';
                
                const cssPreview = preset.css.length > 50 ? preset.css.substring(0, 50) + '...' : preset.css;
                
                item.innerHTML = `
                    <div class="account-content" style="cursor: pointer;">
                        <div class="account-info">
                            <div class="account-name">${preset.name}</div>
                            <div class="account-detail" style="font-family: monospace; font-size: 11px;">${cssPreview}</div>
                        </div>
                        <i class="fas fa-times delete-icon"></i>
                    </div>
                `;

                item.querySelector('.account-content').addEventListener('click', (e) => {
                    if (e.target.classList.contains('delete-icon') || e.target.closest('.delete-icon')) return;
                    if (cssInputEl) {
                        cssInputEl.value = preset.css;
                        if (window.showToast) window.showToast(`已应用预设 "${preset.name}" 的代码`);
                    }
                });

                item.querySelector('.delete-icon').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm(`删除预设“${preset.name}”？`)) {
                        const newPresets = presets.filter(p => p.id !== preset.id);
                        const persisted = await savePresets(type, newPresets);
                        if (persisted) {
                            refreshThemePresetUi(window.imData?.currentSettingsFriend);
                            if (window.showToast) window.showToast('预设已删除');
                        } else if (window.showToast) {
                            window.showToast('预设删除失败');
                        }
                    }
                });

                listEl.appendChild(item);
            });
        }

        function refreshThemePresetUi(friend = window.imData?.currentSettingsFriend) {
            updatePresetSelect('bubble', chatThemeBubbleSelect, getCurrentFriendThemeCss(friend, 'bubble'));
            updatePresetSelect('chat', chatThemeChatSelect, getCurrentFriendThemeCss(friend, 'chat'));
            updatePresetSelect('status', chatThemeStatusSelect, getCurrentFriendThemeCss(friend, 'status'));
            renderThemePresetList('bubble', themeBubblePresetList, chatThemeBubbleSelect, themeBubbleCssInput);
            renderThemePresetList('home', themeHomePresetList, null, themeHomeCssInput);
            renderThemePresetList('chat', themeChatPresetList, chatThemeChatSelect, themeChatCssInput);
            renderThemePresetList('group', themeGroupPresetList, null, themeGroupCssInput);
            renderThemePresetList('status', themeStatusPresetList, chatThemeStatusSelect, themeStatusCssInput);
        }

        function setupPresetLogic(type, saveBtn, nameInput, selectEl, listEl, cssInputEl) {
            if (saveBtn) {
                saveBtn.addEventListener('click', async () => {
                    let cssInput;
                    if (type === 'home') cssInput = themeHomeCssInput;
                    else if (type === 'bubble') cssInput = themeBubbleCssInput;
                    else if (type === 'chat') cssInput = themeChatCssInput;
                    else if (type === 'group') cssInput = themeGroupCssInput;
                    else if (type === 'status') cssInput = themeStatusCssInput;

                    const name = nameInput ? nameInput.value.trim() : '';
                    const css = cssInput ? cssInput.value.trim() : '';
                    if (!name) {
                        if (window.showToast) window.showToast('请输入预设名字');
                        return;
                    }
                    if (!css) {
                        if (window.showToast) window.showToast('CSS 代码不能为空');
                        return;
                    }
                    const presets = loadPresets(type);
                    const existingIndex = presets.findIndex(p => p.name === name);
                    if (existingIndex >= 0) {
                        presets[existingIndex] = { ...presets[existingIndex], css };
                    } else {
                        presets.push({ id: `${type}-preset-${Date.now()}`, name, css });
                    }
                    const persisted = await savePresets(type, presets);
                    if (!persisted) {
                        if (window.showToast) window.showToast(`预设 "${name}" 保存失败`);
                        return;
                    }
                    refreshThemePresetUi(window.imData?.currentSettingsFriend);
                    if (nameInput) nameInput.value = '';
                    if (window.showToast) window.showToast(`预设 "${name}" 已保存`);
                });
            }

            if (selectEl) {
                // Initial load
                updatePresetSelect(type, selectEl, getCurrentFriendThemeCss(window.imData?.currentSettingsFriend, type));
            }
            if (listEl) {
                renderThemePresetList(type, listEl, selectEl, cssInputEl);
            }
        }

        setupPresetLogic('home', themeHomeSaveBtn, themeHomePresetName, null, themeHomePresetList, themeHomeCssInput);
        setupPresetLogic('bubble', themeBubbleSaveBtn, themeBubblePresetName, chatThemeBubbleSelect, themeBubblePresetList, themeBubbleCssInput);
        setupPresetLogic('chat', themeChatSaveBtn, themeChatPresetName, chatThemeChatSelect, themeChatPresetList, themeChatCssInput);
        setupPresetLogic('group', themeGroupSaveBtn, themeGroupPresetName, null, themeGroupPresetList, themeGroupCssInput);
        setupPresetLogic('status', themeStatusSaveBtn, themeStatusPresetName, chatThemeStatusSelect, themeStatusPresetList, themeStatusCssInput);
        window.imApp = window.imApp || {};
        window.imApp.refreshChatThemePresetUi = refreshThemePresetUi;
        refreshThemePresetUi();
        
        // "应用"按钮统一逻辑
        if (chatThemeApplyBtn) {
            chatThemeApplyBtn.addEventListener('click', async () => {
                if (!window.imData || !window.imData.currentSettingsFriend) {
                    showToast('请先选择一个朋友');
                    return;
                }
                
                const friend = window.imData.currentSettingsFriend;
                const nextBubbleCss = chatThemeBubbleSelect ? chatThemeBubbleSelect.value : '';
                const nextChatCss = chatThemeChatSelect ? chatThemeChatSelect.value : '';
                const nextStatusCss = chatThemeStatusSelect ? chatThemeStatusSelect.value : '';

                if (window.imApp && window.imApp.commitScopedFriendChange) {
                    const saved = await window.imApp.commitScopedFriendChange(friend, (targetFriend) => {
                        // 气泡 CSS
                        targetFriend.customCss = nextBubbleCss;
                        targetFriend.customCssEnabled = !!nextBubbleCss;
                        
                        // Chat CSS
                        targetFriend.chatCss = nextChatCss;
                        targetFriend.chatCssEnabled = !!nextChatCss;

                        // 状态栏 CSS
                        targetFriend.statusCss = nextStatusCss;
                        targetFriend.statusCssEnabled = !!nextStatusCss;
                    }, { silent: true, syncSettings: true });
                    
                    if (saved) {
                        if (window.imApp.applyFriendCss) {
                            window.imApp.applyFriendCss(window.imData.currentSettingsFriend);
                        }
                        refreshThemePresetUi(window.imData.currentSettingsFriend);
                        showToast('主题美化已应用');
                    } else {
                        showToast('应用主题失败');
                    }
                }
            });
        }
        // Theme Background
        const HOME_THEME_PACKAGE_FORMAT = 'u2-home-theme';
        const HOME_THEME_PACKAGE_VERSION = 2;
        const HOME_THEME_SUPPORTED_VERSIONS = new Set([1, HOME_THEME_PACKAGE_VERSION]);
        const themeExportBtn = document.getElementById('theme-export-btn');
        const themeImportBtn = document.getElementById('theme-import-btn');
        const themeImportFileInput = document.getElementById('theme-import-file-input');
        const themeBgUploadBtn = document.getElementById('theme-bg-upload-btn');
        const themeBgResetBtn = document.getElementById('theme-bg-reset-btn');
        const themeBgFileInput = document.getElementById('theme-bg-file-input');

        function buildHomeThemePackage() {
            const widgetConfigs = typeof window.getHomeWidgetThemeConfigs === 'function'
                ? window.getHomeWidgetThemeConfigs()
                : (window.getAppState?.('desktop')?.widgets || {});
            return {
                format: HOME_THEME_PACKAGE_FORMAT,
                version: HOME_THEME_PACKAGE_VERSION,
                exportedAt: new Date().toISOString(),
                background: themeState.bgUrl ?? null,
                apps: themeState.apps.map(app => ({
                    id: String(app.id),
                    name: String(app.name || ''),
                    icon: app.icon ?? null
                })),
                widgets: widgetConfigs
            };
        }

        function parseHomeThemePackage(rawText) {
            let payload;
            try {
                payload = JSON.parse(String(rawText || ''));
            } catch (error) {
                throw new Error('主题文件不是有效的 JSON');
            }

            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
                throw new Error('主题文件结构无效');
            }
            if (payload.format !== HOME_THEME_PACKAGE_FORMAT) {
                throw new Error('这不是 U2 主屏主题文件');
            }
            if (!HOME_THEME_SUPPORTED_VERSIONS.has(payload.version)) {
                throw new Error(`不支持的主题文件版本：${payload.version ?? '未知'}`);
            }
            if (!Object.prototype.hasOwnProperty.call(payload, 'background') ||
                (payload.background !== null && typeof payload.background !== 'string')) {
                throw new Error('主题背景数据无效');
            }
            if (!Array.isArray(payload.apps)) {
                throw new Error('主题图标数据无效');
            }

            const importedApps = new Map();
            payload.apps.forEach((app) => {
                if (!app || typeof app !== 'object' || Array.isArray(app)) {
                    throw new Error('主题图标项目无效');
                }
                const id = typeof app.id === 'string' ? app.id.trim() : '';
                if (!id || (app.icon !== null && typeof app.icon !== 'string')) {
                    throw new Error('主题图标项目缺少有效 ID 或图标');
                }
                if (importedApps.has(id)) {
                    throw new Error(`主题图标 ID 重复：${id}`);
                }
                importedApps.set(id, app.icon);
            });

            let importedWidgets = null;
            if (payload.version >= 2) {
                if (!payload.widgets || typeof payload.widgets !== 'object' || Array.isArray(payload.widgets)) {
                    throw new Error('主题小组件数据无效');
                }
                importedWidgets = Object.create(null);
                Object.entries(payload.widgets).forEach(([id, config]) => {
                    if (!id || !config || typeof config !== 'object' || Array.isArray(config)) {
                        throw new Error('主题小组件项目无效');
                    }
                    importedWidgets[id] = config;
                });
            }

            return {
                background: payload.background,
                apps: importedApps,
                widgets: importedWidgets
            };
        }

        function applyImportedHomeTheme(importedTheme) {
            themeState.bgUrl = importedTheme.background;
            themeState.apps.forEach((app) => {
                if (importedTheme.apps.has(String(app.id))) {
                    app.icon = importedTheme.apps.get(String(app.id));
                }
            });
            applyThemeBackground(themeState);
            applyThemeAppIcons(themeState);
            if (importedTheme.widgets && typeof window.applyHomeWidgetThemeConfigs === 'function') {
                window.applyHomeWidgetThemeConfigs(importedTheme.widgets);
            }
            renderThemeAppList();
            saveGlobalData();
        }

        if (themeExportBtn) {
            themeExportBtn.addEventListener('click', async () => {
                try {
                    const serialized = JSON.stringify(buildHomeThemePackage(), null, 2);
                    const blob = new Blob([serialized], { type: 'application/json;charset=utf-8' });
                    const result = await window.u2ExportFile({
                        blob,
                        fileName: `u2-home-theme-${new Date().toISOString().slice(0, 10)}.json`,
                        title: 'U2 主屏主题'
                    });
                    if (result === 'shared' || result === 'downloaded') showToast('主屏主题已导出');
                    else if (result === 'failed') showToast('主题导出失败');
                } catch (error) {
                    console.error('Failed to export home theme', error);
                    showToast('主题导出失败');
                }
            });
        }

        if (themeImportBtn && themeImportFileInput) {
            themeImportBtn.addEventListener('click', () => themeImportFileInput.click());
            themeImportFileInput.addEventListener('change', async () => {
                const file = themeImportFileInput.files?.[0];
                themeImportFileInput.value = '';
                if (!file) return;
                if (!String(file.name || '').toLowerCase().endsWith('.json')) {
                    showToast('请选择 JSON 主题文件');
                    return;
                }

                try {
                    const importedTheme = parseHomeThemePackage(await file.text());
                    applyImportedHomeTheme(importedTheme);
                    showToast('主屏主题已导入');
                } catch (error) {
                    console.error('Failed to import home theme', error);
                    showToast(error?.message || '主题导入失败');
                }
            });
        }
        
        if (themeBgUploadBtn) themeBgUploadBtn.addEventListener('click', () => themeBgFileInput?.click());
        if (themeBgResetBtn) {
            themeBgResetBtn.addEventListener('click', () => {
                themeState.bgUrl = null;
                commitThemeBackgroundChanges('背景已重置');
            });
        }
        
        if (themeBgFileInput) {
            themeBgFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        // Resize for background if compressImage is available
                        if (window.compressImage) {
                            window.compressImage(event.target.result, 1080, 1920, (compressedUrl) => {
                                themeState.bgUrl = compressedUrl;
                                commitThemeBackgroundChanges('背景已更新');
                            });
                        } else {
                            themeState.bgUrl = event.target.result;
                            commitThemeBackgroundChanges('背景已更新');
                        }
                    };
                    reader.readAsDataURL(file);
                }
                e.target.value = '';
            });
        }
        
        function applyThemeBackground(state) {
            const appEl = document.getElementById('app');
            if (!appEl) return;
            const bgUrl = typeof state.bgUrl === 'string' ? state.bgUrl.trim() : '';
            if (bgUrl) {
                appEl.style.backgroundImage = `url(${bgUrl})`;
                appEl.style.backgroundSize = 'cover';
                appEl.style.backgroundPosition = 'center';
                appEl.style.backgroundColor = 'transparent';
                document.body.style.backgroundImage = `url(${bgUrl})`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
            } else {
                appEl.style.backgroundImage = '';
                appEl.style.backgroundColor = '';
                document.body.style.backgroundImage = '';
                document.body.style.backgroundSize = '';
                document.body.style.backgroundPosition = '';
            }
        }
        
        function commitThemeBackgroundChanges(toastMessage = '') {
            applyThemeBackground(themeState);
            saveGlobalData();
            if (toastMessage) showToast(toastMessage);
        }

        // Theme Apps Icons
        const themeAppListContainer = document.getElementById('theme-app-list');
        const themeAppFileInput = document.getElementById('theme-app-file-input');
        const resetAllIconsBtn = document.getElementById('theme-reset-all-icons-btn');
        let currentEditingAppIndex = -1;
        
        if (resetAllIconsBtn) {
            resetAllIconsBtn.addEventListener('click', () => {
                themeState.apps.forEach(app => { app.icon = null; });
                commitThemeAppIconChanges('应用图标已全部重置');
            });
        }
        
        if (themeAppFileInput) {
            themeAppFileInput.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                const appIndex = currentEditingAppIndex;
                try {
                    if (!file || appIndex < 0 || !themeState.apps[appIndex]) return;

                    // App icons must stay PNG so transparent pixels survive resizing.
                    const compressedUrl = await readImageAsCompressedDataUrl(file, {
                        maxWidth: 150,
                        maxHeight: 150,
                        outputType: 'image/png'
                    });
                    const appName = themeState.apps[appIndex]?.name || '应用';
                    themeState.apps[appIndex].icon = compressedUrl;
                    commitThemeAppIconChanges(`${appName} 图标已更新`);
                } catch (error) {
                    console.error('Failed to process app icon.', error);
                    showToast('图标处理失败，请更换图片后重试');
                } finally {
                    e.target.value = '';
                }
            });
        }
        
        function renderThemeAppList() {
            if (!themeAppListContainer) return;
            themeAppListContainer.innerHTML = '';
        
            themeState.apps.forEach((app, index) => {
                const item = document.createElement('div');
                const appDisplayName = window.u2UiTranslation?.getAppName
                    ? window.u2UiTranslation.getAppName(app)
                    : app.name;
                item.className = 'form-item';
                item.style.padding = '8px 16px';
                item.style.height = '60px';
                item.style.display = 'flex';
                item.style.justifyContent = 'space-between';
                item.style.alignItems = 'center';
                item.style.borderBottom = '1px solid #f2f2f7';
                
                let iconHtml = '';
                if (app.icon) {
                    iconHtml = `<div style="width: 40px; height: 40px; border-radius: 10px; background-image: url('${app.icon}'); background-size: cover; background-position: center; border: 1px solid #e5e5ea; flex-shrink: 0;"></div>`;
                } else {
                    iconHtml = `<div style="width: 40px; height: 40px; border-radius: 10px; background-color: #f2f2f7; border: 1px solid #e5e5ea; display: flex; align-items: center; justify-content: center; color: #c7c7cc; flex-shrink: 0;"><i class="fas fa-image"></i></div>`;
                }
        
                item.innerHTML = `
                    <div style="display: flex; align-items: center; flex: 1;">
                        ${iconHtml}
                        <div style="margin-left: 12px; font-size: 16px; font-weight: 500; color: #000;">${appDisplayName}</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <div class="reset-single-app-btn" style="width: 32px; height: 32px; border-radius: 50%; background: #ffebee; color: #ff3b30; display: flex; justify-content: center; align-items: center; cursor: pointer;">
                            <i class="fas fa-undo" style="font-size: 14px;"></i>
                        </div>
                        <div class="upload-single-app-btn" style="width: 32px; height: 32px; border-radius: 50%; background: #e8f5e9; color: #34c759; display: flex; justify-content: center; align-items: center; cursor: pointer;">
                            <i class="fas fa-upload" style="font-size: 14px;"></i>
                        </div>
                    </div>
                `;
                
                const resetBtn = item.querySelector('.reset-single-app-btn');
                resetBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    themeState.apps[index].icon = null;
                    commitThemeAppIconChanges(`${app.name} 图标已重置`);
                });
        
                const uploadBtn = item.querySelector('.upload-single-app-btn');
                uploadBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    currentEditingAppIndex = index;
                    themeAppFileInput?.click();
                });
        
                themeAppListContainer.appendChild(item);
            });
        }
        
        function applyThemeAppIcons(state) {
            if (!Array.isArray(state.apps)) return;
            state.apps.forEach(app => applyAppIconStyles(app));
        }
        
        function commitThemeAppIconChanges(toastMessage = '') {
            applyThemeAppIcons(themeState);
            renderThemeAppList();
            saveGlobalData();
            if (toastMessage) showToast(toastMessage);
        }
        
        function applyAppIconStyles(app) {
            const el = document.getElementById(app.id);
            if (!el) return;
        
            const appItem = el.classList.contains('app-item') ? el : el.closest('.app-item');
            const iconDiv = el.classList.contains('app-icon') ? el : (el.querySelector('.app-icon') || appItem?.querySelector('.app-icon'));
            const nameEl = appItem ? appItem.querySelector('.app-name') : el.querySelector('.app-name');
        
            if (nameEl && app.name) {
                if (window.u2UiTranslation?.applyAppName) {
                    window.u2UiTranslation.applyAppName(nameEl, app);
                } else {
                    nameEl.textContent = app.name;
                }
            }
        
            if (!iconDiv) return;
        
            const ensureIconElement = (className, extraStyle = '') => {
                iconDiv.innerHTML = `<i class="${className}" style="${extraStyle}"></i>`;
                return iconDiv.querySelector('i');
            };
        
            if (app.icon) {
                iconDiv.innerHTML = '';
                iconDiv.classList.add('has-custom-app-icon');
                iconDiv.style.setProperty('background', `url(${app.icon}) center / cover no-repeat`, 'important');
                iconDiv.style.setProperty('background-image', `url(${app.icon})`, 'important');
                iconDiv.style.setProperty('background-size', 'cover', 'important');
                iconDiv.style.setProperty('background-position', 'center', 'important');
                iconDiv.style.setProperty('background-repeat', 'no-repeat', 'important');
                iconDiv.style.setProperty('background-color', 'transparent', 'important');
                // Reset possible inner borders
                iconDiv.style.setProperty('border', 'none', 'important');
            } else {
                iconDiv.classList.remove('has-custom-app-icon');
                iconDiv.style.removeProperty('background');
                iconDiv.style.removeProperty('background-image');
                iconDiv.style.removeProperty('background-size');
                iconDiv.style.removeProperty('background-position');
                iconDiv.style.removeProperty('background-repeat');
                iconDiv.style.removeProperty('background-color');
                iconDiv.style.removeProperty('border');
                iconDiv.style.backgroundImage = 'none';
                iconDiv.style.backgroundSize = '';
                iconDiv.style.backgroundPosition = '';
                iconDiv.style.backgroundColor = '';
                iconDiv.style.color = '';
                iconDiv.style.border = '1px solid #e5e5ea';
                iconDiv.style.display = 'flex';
                iconDiv.style.justifyContent = 'center';
                iconDiv.style.alignItems = 'center';
                iconDiv.innerHTML = '';
        
                const isCustomBg = !!window.u2ThemeState?.bgUrl;
                const defaultBg = isCustomBg ? 'rgba(255, 255, 255, 0.7)' : '#ffffff';
                const defaultImessageBg = isCustomBg ? 'rgba(255, 255, 255, 0.8)' : 'linear-gradient(180deg, #ffffff 0%, #f2f2f7 100%)';

                if (app.id === 'dock-icon-settings') {
                    iconDiv.style.background = defaultBg;
                    iconDiv.style.color = '#1c1c1e';
                    ensureIconElement('fas fa-cog');
                } else if (app.id === 'dock-icon-imessage') {
                    iconDiv.style.background = defaultImessageBg;
                    iconDiv.style.color = '#1c1c1e';
                    ensureIconElement('fas fa-comment');
                } else if (app.id === 'dock-icon-youtube') {
                    iconDiv.style.background = defaultBg;
                    iconDiv.style.color = '#1c1c1e';
                    iconDiv.style.fontSize = '38px';
                    ensureIconElement('fab fa-youtube');
                } else if (app.id === 'app-icon-1') {
                    iconDiv.style.background = defaultBg;
                    iconDiv.style.color = '#1c1c1e';
                    ensureIconElement('fas fa-wallet');
                } else if (app.id === 'app-icon-2') {
                    iconDiv.style.background = defaultBg;
                    iconDiv.style.color = '#1c1c1e';
                    ensureIconElement('fab fa-tiktok');
                } else if (app.id === 'app-icon-3') {
                    iconDiv.style.background = defaultBg;
                    iconDiv.style.color = '#1c1c1e';
                    ensureIconElement('fas fa-layer-group', 'font-size: 26px;');
                } else if (app.id === 'app-icon-4') {
                    iconDiv.style.background = defaultBg;
                    iconDiv.style.color = '#1c1c1e';
                    ensureIconElement('fa-brands fa-x-twitter', 'font-size: 26px;');
                } else if (app.id === 'app-icon-5') {
                    iconDiv.style.background = defaultBg;
                    iconDiv.style.color = '#1c1c1e';
                    ensureIconElement('fas fa-shopping-bag', 'color: #1c1c1e; font-size: 30px; filter: none;');
                } else if (app.id === 'app-icon-6') {
                    iconDiv.style.background = '#ffffff';
                    iconDiv.style.color = '#1c1c1e';
                    iconDiv.style.fontSize = '27px';
                    iconDiv.style.border = '1px solid #e5e5ea';
                    ensureIconElement('fas fa-book-open', 'color: #1c1c1e; font-size: 27px; filter: none;');
                } else if (app.id === 'app-icon-7') {
                    iconDiv.style.background = defaultBg;
                    iconDiv.style.color = '#1c1c1e';
                    iconDiv.style.border = isCustomBg ? 'none' : '1px solid #e5e5ea';
                    iconDiv.style.fontSize = '32px';
                    iconDiv.style.fontWeight = '900';
                    iconDiv.style.fontFamily = 'Arial, sans-serif';
                    iconDiv.style.letterSpacing = '-1px';
                    iconDiv.innerHTML = 'N';
                } else if (app.id === 'app-icon-8') {
                    iconDiv.style.background = defaultBg;
                    iconDiv.style.color = '#1c1c1e';
                    ensureIconElement('fas fa-heart', 'color: #1c1c1e; font-size: 28px;');
                }
            }
        }

        // Theme Font Logic
        const themeFontBtn = document.getElementById('theme-font-btn');
        const themeFontModal = document.getElementById('theme-font-modal');
        const themeFontCloseBtn = document.getElementById('theme-font-close-btn');
        const themeFontModalPreview = document.getElementById('theme-font-modal-preview');
        const themeFontModalUserPresetList = document.getElementById('theme-font-modal-user-preset-list');
        const themeFontNameInput = document.getElementById('theme-font-name-input');
        const themeFontUrlInput = document.getElementById('theme-font-url-input');
        const themeFontLocalNameInput = document.getElementById('theme-font-local-name-input');
        const themeFontUploadBtn = document.getElementById('theme-font-upload-btn');
        const themeFontFileInput = document.getElementById('theme-font-file-input');
        const themeFontFileStatus = document.getElementById('theme-font-file-status');
        const themeFontAddBtn = document.getElementById('theme-font-add-btn');
        const themeFontSourceTabs = Array.from(document.querySelectorAll('.theme-font-source-tab'));
        const themeFontSourcePanels = Array.from(document.querySelectorAll('.theme-font-source-panel'));
        const themeFontSizeSlider = document.getElementById('theme-font-size-slider');
        const themeFontSizeValue = document.getElementById('theme-font-size-value');
        const THEME_FONT_PREVIEW_TEXT = 'Aa 你好 Hello 123';
        const THEME_FONT_MAX_FILE_SIZE = 20 * 1024 * 1024;
        const THEME_FONT_WARNING_FILE_SIZE = 5 * 1024 * 1024;
        const THEME_FONT_FORMATS = new Set(['ttf', 'otf', 'woff', 'woff2']);
        const THEME_FONT_DEFAULT_SIZE = 16;
        const THEME_FONT_SCALE_EXCLUDE_SELECTOR = [
            'script',
            'style',
            'link',
            'meta',
            'svg',
            'path',
            'canvas',
            'video',
            'audio',
            '.app-icon',
            '.icon-placeholder',
            'i',
            '.fa',
            '.fas',
            '.far',
            '.fab',
            '.fal',
            '.fa-solid',
            '.fa-regular',
            '.fa-brands',
            '#theme-bubble-css-input',
            '#theme-chat-css-input',
            '#theme-group-css-input',
            '#theme-status-css-input',
            '#bubble-css-input',
            '#status-css-input',
            'textarea[placeholder*="CSS"]',
            'textarea[placeholder*="css"]'
        ].join(',');
        const THEME_FONT_SURFACE_CANDIDATE_SELECTOR = [
            '#u2-login-screen',
            '.app-view',
            '.settings-view',
            '.edit-view',
            '.bottom-sheet-overlay',
            '.tk-sub-profile-view',
            '.tk-tab-content',
            '.yt-tab-content',
            '.x-tab-content',
            '.modal-overlay',
            '.wb-centered-modal-overlay',
            '.toast-bubble'
        ].join(',');
        const THEME_FONT_ACTIVE_SURFACE_SELECTOR = [
            '.app-view.active',
            '.settings-view.active',
            '.edit-view.active',
            '.bottom-sheet-overlay.active',
            '.tk-sub-profile-view.active',
            '.tk-tab-content.active',
            '.yt-tab-content.active',
            '.x-tab-content.active',
            '.modal-overlay.active',
            '.wb-centered-modal-overlay.active',
            '.toast-bubble.show'
        ].join(',');
        const THEME_FONT_INACTIVE_SURFACE_SELECTOR = [
            '#u2-login-screen.is-hidden',
            '.app-view:not(.active)',
            '.settings-view:not(.active)',
            '.edit-view:not(.active)',
            '.bottom-sheet-overlay:not(.active)',
            '.tk-sub-profile-view:not(.active)',
            '.tk-tab-content:not(.active)',
            '.yt-tab-content:not(.active)',
            '.x-tab-content:not(.active)',
            '[hidden]',
            '[aria-hidden="true"]'
        ].join(',');
        const THEME_FONT_HOME_SURFACE_SELECTOR = [
            '#pages-container',
            '#dock',
            '.page-indicators',
            '.home-search-pill',
            '#home-ios-status-bar'
        ].join(',');
        const themeFontFaceRegistry = new Map();
        const themeFontBaseSizes = new Set();
        const themeFontObservedSurfaces = new WeakSet();
        const themeFontCapturedSurfaces = new WeakSet();
        const themeFontPendingFullSurfaces = new WeakSet();
        const themeFontDeferredRoots = new WeakMap();
        const themeFontPendingRoots = new Set();
        let themeFontSaveTimer = null;
        let themeFontSelectedFile = null;
        let themeFontSourceMode = 'local';
        let themeFontApplyToken = 0;
        let themeFontScaleObserver = null;
        let themeFontScaleSurfaceObserver = null;
        let themeFontCaptureFrame = 0;
        let themeFontScaleRefreshFrame = 0;

        function cloneThemeFontSources(sources = {}) {
            return {
                woff2: typeof sources.woff2 === 'string' ? sources.woff2.trim() : '',
                woff: typeof sources.woff === 'string' ? sources.woff.trim() : '',
                ttf: typeof sources.ttf === 'string' ? sources.ttf.trim() : '',
                otf: typeof sources.otf === 'string' ? sources.otf.trim() : ''
            };
        }

        function normalizeThemeFontSize(value) {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) return 16;
            return Math.min(24, Math.max(12, Math.round(parsed)));
        }

        function sanitizeThemeFontCssName(value) {
            const sanitized = String(value || '').trim().replace(/["']/g, '').replace(/[{}]/g, '').replace(/\s+/g, ' ');
            return sanitized || 'CustomThemeFont';
        }

        function sanitizeThemeFontLabel(value) {
            return sanitizeThemeFontCssName(value).slice(0, 60);
        }

        function buildThemeFontFamily(cssName) {
            return `"${sanitizeThemeFontCssName(cssName)}", ${DEFAULT_SYSTEM_THEME_FONT_FAMILY}`;
        }

        function createThemeFontInternalName(presetId) {
            const safeId = String(presetId || 'font').replace(/[^a-z0-9_-]/gi, '_');
            return `U2ThemeFont_${safeId}_${Date.now().toString(36)}`;
        }

        function normalizeThemeFontFormat(value) {
            const normalized = String(value || '').trim().toLowerCase().replace(/^\./, '');
            return THEME_FONT_FORMATS.has(normalized) ? normalized : '';
        }

        function inferThemeFontFormat(value) {
            const cleanValue = String(value || '').split('?')[0].split('#')[0].toLowerCase();
            const match = cleanValue.match(/\.([a-z0-9]+)$/);
            return normalizeThemeFontFormat(match?.[1]);
        }

        function getThemeFontCssFormat(format) {
            if (format === 'ttf') return 'truetype';
            if (format === 'otf') return 'opentype';
            return format;
        }

        function normalizeThemeFontPreset(preset = {}, fallbackIndex = 0) {
            const id = typeof preset.id === 'string' && preset.id
                ? preset.id
                : `font_preset_${Date.now()}_${fallbackIndex}`;
            const normalizedName = sanitizeThemeFontLabel(preset.name || preset.label || preset.cssName || `CustomFont${fallbackIndex + 1}`);
            const fontAssetId = typeof preset.fontAssetId === 'string' ? preset.fontAssetId : '';
            const sourceType = preset.sourceType === 'local' || fontAssetId ? 'local' : 'link';
            const sources = cloneThemeFontSources(preset.sources);
            const sourceUrl = sources.woff2 || sources.woff || sources.ttf || sources.otf || '';
            const fontFormat = normalizeThemeFontFormat(preset.fontFormat) || inferThemeFontFormat(sourceUrl);
            const cssName = sanitizeThemeFontCssName(preset.cssName || normalizedName);
            return {
                id,
                type: 'user',
                name: normalizedName,
                label: normalizedName,
                cssName,
                family: buildThemeFontFamily(cssName),
                sourceType,
                fontAssetId,
                fontFormat,
                sources
            };
        }

        function ensureThemeFontStateShape() {
            if (!themeState || typeof themeState !== 'object') return;
            if (!themeState.fontMode) themeState.fontMode = 'preset';
            if (!themeState.fontPresetKey) themeState.fontPresetKey = 'system-default';
            if (!themeState.fontFamily) themeState.fontFamily = DEFAULT_SYSTEM_THEME_FONT_FAMILY;
            if (typeof themeState.fontCssName !== 'string') themeState.fontCssName = '';
            themeState.fontSize = normalizeThemeFontSize(themeState.fontSize);
            themeState.fontSources = cloneThemeFontSources(themeState.fontSources);
            themeState.fontSourceType = ['preset', 'local', 'link'].includes(themeState.fontSourceType)
                ? themeState.fontSourceType
                : 'preset';
            themeState.fontAssetId = typeof themeState.fontAssetId === 'string' ? themeState.fontAssetId : '';
            themeState.fontFormat = normalizeThemeFontFormat(themeState.fontFormat);

            themeState.savedFontPresets = Array.isArray(themeState.savedFontPresets)
                ? themeState.savedFontPresets.map((preset, index) => normalizeThemeFontPreset(preset, index))
                : [];

            if (themeState.fontMode === 'saved' && !themeState.savedFontPresets.some(preset => preset.id === themeState.fontPresetKey)) {
                const legacySourceUrl = themeState.fontSources.woff2 || themeState.fontSources.woff || themeState.fontSources.ttf || themeState.fontSources.otf || '';
                if (legacySourceUrl) {
                    const migratedPreset = normalizeThemeFontPreset({
                        id: `font_preset_migrated_${Date.now()}`,
                        name: themeState.fontCssName || '迁移字体',
                        cssName: themeState.fontCssName || 'MigratedThemeFont',
                        sourceType: 'link',
                        sources: themeState.fontSources,
                        fontFormat: themeState.fontFormat
                    });
                    themeState.savedFontPresets.push(migratedPreset);
                    themeState.fontPresetKey = migratedPreset.id;
                }
            }

            if (themeState.fontMode !== 'saved') {
                const builtin = BUILTIN_THEME_FONTS.find(font => font.key === themeState.fontPresetKey) || BUILTIN_THEME_FONTS[0];
                themeState.fontMode = 'preset';
                themeState.fontPresetKey = builtin.key;
                themeState.fontFamily = builtin.family || DEFAULT_SYSTEM_THEME_FONT_FAMILY;
                themeState.fontCssName = builtin.cssName || '';
                themeState.fontSources = cloneThemeFontSources(builtin.sources);
                themeState.fontSourceType = 'preset';
                themeState.fontAssetId = '';
                themeState.fontFormat = '';
            }
        }

        function getActiveThemeFontDefinition(state = themeState) {
            ensureThemeFontStateShape();
            if (state.fontMode === 'saved') {
                const savedPreset = state.savedFontPresets.find(preset => preset.id === state.fontPresetKey);
                if (savedPreset) return { ...savedPreset, type: 'user' };
            }
            const preset = BUILTIN_THEME_FONTS.find(font => font.key === state.fontPresetKey) || BUILTIN_THEME_FONTS[0];
            return { ...preset, type: 'builtin', sourceType: 'preset', fontAssetId: '', fontFormat: '' };
        }

        function setThemeFontStateFromDefinition(definition) {
            if (definition.type === 'builtin' || definition.key) {
                themeState.fontMode = 'preset';
                themeState.fontPresetKey = definition.key || 'system-default';
            } else {
                themeState.fontMode = 'saved';
                themeState.fontPresetKey = definition.id;
            }
            themeState.fontFamily = definition.family || DEFAULT_SYSTEM_THEME_FONT_FAMILY;
            themeState.fontCssName = definition.cssName || '';
            themeState.fontSources = cloneThemeFontSources(definition.sources);
            themeState.fontSourceType = definition.sourceType || (definition.type === 'builtin' ? 'preset' : 'link');
            themeState.fontAssetId = definition.fontAssetId || '';
            themeState.fontFormat = normalizeThemeFontFormat(definition.fontFormat);
        }

        function getThemeFontAppliedStyleElement() {
            let styleEl = document.getElementById('theme-font-applied-style');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'theme-font-applied-style';
                document.head.appendChild(styleEl);
            }
            return styleEl;
        }

        function getThemeFontScaleStyleElement() {
            let styleEl = document.getElementById('theme-font-scale-style');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'theme-font-scale-style';
                document.head.appendChild(styleEl);
            }
            return styleEl;
        }

        function formatThemeFontBaseSize(value) {
            return Number(value).toFixed(2).replace(/\.?0+$/, '');
        }

        function rebuildThemeFontScaleCss(fontSize = themeState.fontSize) {
            const scale = normalizeThemeFontSize(fontSize) / THEME_FONT_DEFAULT_SIZE;
            const rules = Array.from(themeFontBaseSizes, Number)
                .filter(Number.isFinite)
                .sort((a, b) => a - b)
                .map(baseSize => {
                    const key = formatThemeFontBaseSize(baseSize);
                    const scaledSize = Math.max(1, baseSize * scale).toFixed(3).replace(/\.?0+$/, '');
                    return `[data-theme-font-base-size="${key}"] { font-size: ${scaledSize}px !important; }`;
                });
            getThemeFontScaleStyleElement().textContent = rules.join('\n');
            document.documentElement.style.setProperty('--theme-font-scale', String(scale));
        }

        function captureThemeFontBaseSize(element, { recapture = false } = {}) {
            if (!(element instanceof HTMLElement) || element.matches(THEME_FONT_SCALE_EXCLUDE_SELECTOR)) {
                return false;
            }
            if (element.closest(THEME_FONT_INACTIVE_SURFACE_SELECTOR)) return false;
            if (!recapture && element.hasAttribute('data-theme-font-base-size')) return false;

            if (recapture) element.removeAttribute('data-theme-font-base-size');
            const computedSize = Number.parseFloat(window.getComputedStyle(element).fontSize);
            if (!Number.isFinite(computedSize) || computedSize <= 0) return false;

            const baseSize = formatThemeFontBaseSize(computedSize);
            element.setAttribute('data-theme-font-base-size', baseSize);
            const previousSizeCount = themeFontBaseSizes.size;
            themeFontBaseSizes.add(baseSize);
            return themeFontBaseSizes.size !== previousSizeCount;
        }

        function captureThemeFontSizesIn(root, options, includeDescendants = true) {
            if (!(root instanceof Element)) return false;
            const scaleStyleSheet = document.getElementById('theme-font-scale-style')?.sheet;
            const wasDisabled = !!scaleStyleSheet?.disabled;
            if (scaleStyleSheet) scaleStyleSheet.disabled = true;
            try {
                let addedSize = captureThemeFontBaseSize(root, options);
                if (includeDescendants) {
                    root.querySelectorAll('*').forEach(element => {
                        if (captureThemeFontBaseSize(element, options)) addedSize = true;
                    });
                }
                return addedSize;
            } finally {
                if (scaleStyleSheet) scaleStyleSheet.disabled = wasDisabled;
            }
        }

        function scheduleThemeFontScaleCssRefresh() {
            if (themeFontScaleRefreshFrame) return;
            themeFontScaleRefreshFrame = window.requestAnimationFrame(() => {
                themeFontScaleRefreshFrame = 0;
                rebuildThemeFontScaleCss();
            });
        }

        function isThemeFontLoginVisible() {
            const loginScreen = document.getElementById('u2-login-screen');
            return !!loginScreen && !loginScreen.classList.contains('is-hidden');
        }

        function getThemeFontActiveRoots() {
            if (!document.body) return [];
            const loginScreen = document.getElementById('u2-login-screen');
            if (isThemeFontLoginVisible()) return loginScreen ? [loginScreen] : [];

            const roots = Array.from(document.querySelectorAll(THEME_FONT_ACTIVE_SURFACE_SELECTOR));
            if (!document.querySelector('.app-view.active, .settings-view.active, .edit-view.active')) {
                document.querySelectorAll(THEME_FONT_HOME_SURFACE_SELECTOR).forEach(root => roots.push(root));
            }
            return Array.from(new Set(roots));
        }

        function getThemeFontActiveSurfaceFor(node) {
            if (!(node instanceof Element)) return null;
            const loginScreen = document.getElementById('u2-login-screen');
            if (isThemeFontLoginVisible()) return loginScreen?.contains(node) ? loginScreen : null;
            if (node.closest(THEME_FONT_INACTIVE_SURFACE_SELECTOR)) return null;

            const activeSurface = node.matches(THEME_FONT_ACTIVE_SURFACE_SELECTOR)
                ? node
                : node.closest(THEME_FONT_ACTIVE_SURFACE_SELECTOR);
            if (activeSurface) return activeSurface;

            if (!document.querySelector('.app-view.active, .settings-view.active, .edit-view.active')) {
                return node.matches(THEME_FONT_HOME_SURFACE_SELECTOR)
                    ? node
                    : node.closest(THEME_FONT_HOME_SURFACE_SELECTOR);
            }
            return null;
        }

        function getThemeFontRegisteredSurfaceFor(node) {
            if (!(node instanceof Element)) return null;
            return node.matches(THEME_FONT_SURFACE_CANDIDATE_SELECTOR)
                ? node
                : node.closest(THEME_FONT_SURFACE_CANDIDATE_SELECTOR);
        }

        function deferThemeFontCapture(root) {
            const surface = getThemeFontRegisteredSurfaceFor(root);
            if (!surface) return;
            if (!themeFontDeferredRoots.has(surface)) themeFontDeferredRoots.set(surface, new Set());
            themeFontDeferredRoots.get(surface).add(root);
        }

        function flushThemeFontCaptureQueue() {
            themeFontCaptureFrame = 0;
            const roots = Array.from(themeFontPendingRoots);
            themeFontPendingRoots.clear();
            let addedSize = false;
            roots.forEach(root => {
                if (!root.isConnected || !getThemeFontActiveSurfaceFor(root)) return;
                if (captureThemeFontSizesIn(root)) addedSize = true;
                if (themeFontPendingFullSurfaces.has(root)) {
                    themeFontPendingFullSurfaces.delete(root);
                    themeFontCapturedSurfaces.add(root);
                    themeFontDeferredRoots.delete(root);
                    root.querySelectorAll(THEME_FONT_SURFACE_CANDIDATE_SELECTOR).forEach(surface => {
                        if (!getThemeFontActiveSurfaceFor(surface)) return;
                        themeFontCapturedSurfaces.add(surface);
                        themeFontDeferredRoots.delete(surface);
                    });
                }
            });
            if (addedSize) scheduleThemeFontScaleCssRefresh();
        }

        function queueThemeFontCapture(root, { fullSurface = false } = {}) {
            if (!(root instanceof Element)) return;
            if (!getThemeFontActiveSurfaceFor(root)) {
                deferThemeFontCapture(root);
                return;
            }
            if (fullSurface) themeFontPendingFullSurfaces.add(root);
            themeFontPendingRoots.add(root);
            if (themeFontCaptureFrame) return;
            themeFontCaptureFrame = window.requestAnimationFrame(flushThemeFontCaptureQueue);
        }

        function queueThemeFontSurfaceActivation(surface) {
            if (!(surface instanceof Element) || !getThemeFontActiveSurfaceFor(surface)) return;
            if (!themeFontCapturedSurfaces.has(surface)) {
                queueThemeFontCapture(surface, { fullSurface: true });
                return;
            }
            const deferredRoots = themeFontDeferredRoots.get(surface);
            if (!deferredRoots) return;
            themeFontDeferredRoots.delete(surface);
            deferredRoots.forEach(root => queueThemeFontCapture(root));
        }

        function queueThemeFontActivatedSurfaceTree(surface) {
            if (!(surface instanceof Element) || !getThemeFontActiveSurfaceFor(surface)) return;
            if (!themeFontCapturedSurfaces.has(surface)) {
                queueThemeFontCapture(surface, { fullSurface: true });
                return;
            }
            queueThemeFontSurfaceActivation(surface);
            surface.querySelectorAll(THEME_FONT_SURFACE_CANDIDATE_SELECTOR).forEach(candidate => {
                if (getThemeFontActiveSurfaceFor(candidate)) queueThemeFontSurfaceActivation(candidate);
            });
        }

        function queueAllActiveThemeFontRoots() {
            getThemeFontActiveRoots().forEach(root => {
                if (root.matches(THEME_FONT_SURFACE_CANDIDATE_SELECTOR)) {
                    queueThemeFontSurfaceActivation(root);
                } else {
                    queueThemeFontCapture(root);
                }
            });
        }

        function observeThemeFontSurface(surface) {
            if (!(surface instanceof Element) || themeFontObservedSurfaces.has(surface)) return;
            themeFontObservedSurfaces.add(surface);
            themeFontScaleSurfaceObserver.observe(surface, {
                attributes: true,
                attributeFilter: ['class', 'hidden', 'aria-hidden']
            });
        }

        function registerThemeFontSurfacesIn(root) {
            if (!(root instanceof Element)) return;
            if (root.matches(THEME_FONT_SURFACE_CANDIDATE_SELECTOR)) observeThemeFontSurface(root);
            root.querySelectorAll(THEME_FONT_SURFACE_CANDIDATE_SELECTOR).forEach(observeThemeFontSurface);
        }

        function ensureThemeFontGlobalScaling() {
            if (!document.body) return;
            if (themeFontScaleObserver) return;

            let addedSize = false;
            getThemeFontActiveRoots().forEach(root => {
                if (captureThemeFontSizesIn(root)) addedSize = true;
                if (root.matches(THEME_FONT_SURFACE_CANDIDATE_SELECTOR)) themeFontCapturedSurfaces.add(root);
            });
            if (addedSize) rebuildThemeFontScaleCss();

            themeFontScaleSurfaceObserver = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    const target = mutation.target;
                    if (!(target instanceof Element)) return;
                    if (target.id === 'u2-login-screen') {
                        queueAllActiveThemeFontRoots();
                        return;
                    }
                    queueThemeFontActivatedSurfaceTree(target);
                });
            });
            registerThemeFontSurfacesIn(document.body);

            themeFontScaleObserver = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (!(node instanceof Element)) return;
                        registerThemeFontSurfacesIn(node);
                        if (node.matches(THEME_FONT_SURFACE_CANDIDATE_SELECTOR)) {
                            queueThemeFontSurfaceActivation(node);
                        } else {
                            queueThemeFontCapture(node);
                        }
                    });
                });
            });
            themeFontScaleObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        function applyThemeFontCss(resolvedFamily, fontSize) {
            const resolvedSize = `${normalizeThemeFontSize(fontSize)}px`;
            const appliedStyleEl = getThemeFontAppliedStyleElement();
            appliedStyleEl.textContent = `
            :root {
                --theme-font-family: ${resolvedFamily};
                --theme-font-size: ${resolvedSize};
            }
            body {
                font-family: var(--theme-font-family) !important;
            }
            body :where(*:not(i):not(.fa):not(.fas):not(.far):not(.fab):not(.fal):not(.fa-solid):not(.fa-regular):not(.fa-brands)) {
                font-family: var(--theme-font-family) !important;
            }
            body :where(i, .fa, .fas, .far, .fab, .fal, .fa-solid, .fa-regular, .fa-brands),
            body :where(i, .fa, .fas, .far, .fab, .fal, .fa-solid, .fa-regular, .fa-brands)::before {
                font-family: "Font Awesome 6 Free", "Font Awesome 6 Brands" !important;
            }
            body :where(#theme-bubble-css-input, #theme-chat-css-input, #theme-group-css-input, #theme-status-css-input, #bubble-css-input, #status-css-input, textarea[placeholder*="CSS"], textarea[placeholder*="css"]) {
                font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace !important;
                font-size: 13px !important;
            }`.trim();
            document.documentElement.style.setProperty('--theme-font-family', resolvedFamily);
            document.documentElement.style.setProperty('--theme-font-size', resolvedSize);
            ensureThemeFontGlobalScaling();
            rebuildThemeFontScaleCss(fontSize);
        }

        async function getThemeFontSource(definition) {
            if (!definition || definition.type === 'builtin' || definition.key) return null;
            if (definition.sourceType === 'local') {
                if (!definition.fontAssetId || typeof window.appStorage?.getAssetUrl !== 'function') {
                    throw new Error('本地字体文件不存在');
                }
                const assetUrl = await window.appStorage.getAssetUrl(definition.fontAssetId);
                if (!assetUrl) throw new Error('本地字体文件已丢失');
                return { url: assetUrl, format: normalizeThemeFontFormat(definition.fontFormat) };
            }
            const sources = cloneThemeFontSources(definition.sources);
            const format = sources.woff2 ? 'woff2' : sources.woff ? 'woff' : sources.ttf ? 'ttf' : sources.otf ? 'otf' : '';
            const url = sources[format] || '';
            if (!url) throw new Error('字体链接为空');
            return { url, format: normalizeThemeFontFormat(definition.fontFormat) || format };
        }

        async function loadThemeFontDefinition(definition) {
            if (!definition || definition.type === 'builtin' || definition.key) {
                return definition?.family || DEFAULT_SYSTEM_THEME_FONT_FAMILY;
            }
            if (typeof FontFace !== 'function' || !document.fonts) {
                throw new Error('当前浏览器不支持自定义字体');
            }
            const source = await getThemeFontSource(definition);
            const registryKey = `${definition.cssName}|${source.url}|${source.format}`;
            const existingFace = themeFontFaceRegistry.get(registryKey);
            if (existingFace?.status === 'loaded') return definition.family;

            const cssFormat = getThemeFontCssFormat(source.format);
            const sourceDescriptor = `url(${JSON.stringify(source.url)})${cssFormat ? ` format(${JSON.stringify(cssFormat)})` : ''}`;
            const fontFace = new FontFace(definition.cssName, sourceDescriptor, {
                style: 'normal',
                weight: 'normal',
                display: 'swap'
            });
            await fontFace.load();
            document.fonts.add(fontFace);
            themeFontFaceRegistry.set(registryKey, fontFace);
            return definition.family;
        }

        async function applyThemeFont(state = themeState, { fallbackOnError = true } = {}) {
            ensureThemeFontStateShape();
            const definition = getActiveThemeFontDefinition(state);
            const applyToken = ++themeFontApplyToken;
            try {
                const resolvedFamily = await loadThemeFontDefinition(definition);
                if (applyToken !== themeFontApplyToken) return false;
                applyThemeFontCss(resolvedFamily, state.fontSize);
                renderThemeFontPreview();
                return true;
            } catch (error) {
                console.warn('Failed to load theme font:', error);
                if (applyToken !== themeFontApplyToken) return false;
                if (fallbackOnError) applyThemeFontCss(DEFAULT_SYSTEM_THEME_FONT_FAMILY, state.fontSize);
                return false;
            }
        }

        function renderThemeFontPreview() {
            ensureThemeFontStateShape();
            const definition = getActiveThemeFontDefinition(themeState);
            const previewSize = `${normalizeThemeFontSize(themeState.fontSize)}px`;
            if (themeFontModalPreview) {
                themeFontModalPreview.textContent = THEME_FONT_PREVIEW_TEXT;
                themeFontModalPreview.style.fontFamily = definition.family || DEFAULT_SYSTEM_THEME_FONT_FAMILY;
                themeFontModalPreview.style.fontSize = previewSize;
            }
            if (themeFontSizeValue) themeFontSizeValue.textContent = previewSize;
            if (themeFontSizeSlider) themeFontSizeSlider.value = String(normalizeThemeFontSize(themeState.fontSize));
        }

        function syncThemeFontInputsFromState() {
            ensureThemeFontStateShape();
            renderThemeFontPreview();
            const preset = themeState.fontMode === 'saved'
                ? themeState.savedFontPresets.find(item => item.id === themeState.fontPresetKey)
                : null;
            if (preset?.sourceType === 'link') {
                themeFontNameInput.value = preset.name || '';
                themeFontUrlInput.value = preset.sources.woff2 || preset.sources.woff || preset.sources.ttf || preset.sources.otf || '';
            } else {
                if (themeFontNameInput) themeFontNameInput.value = '';
                if (themeFontUrlInput) themeFontUrlInput.value = '';
            }
            if (themeFontLocalNameInput) themeFontLocalNameInput.value = '';
            themeFontSelectedFile = null;
            if (themeFontFileInput) themeFontFileInput.value = '';
            updateThemeFontFileStatus();
        }

        function scheduleThemeFontSave() {
            if (themeFontSaveTimer) clearTimeout(themeFontSaveTimer);
            themeFontSaveTimer = setTimeout(() => {
                themeFontSaveTimer = null;
                saveGlobalData();
            }, 300);
        }

        function createThemeFontPill({ label, family, isActive, onSelect, onDelete = null }) {
            const pill = document.createElement('div');
            pill.className = `theme-font-pill ${isActive ? 'active' : ''}`;
            const selectBtn = document.createElement('button');
            selectBtn.type = 'button';
            selectBtn.className = 'theme-font-pill-select';
            selectBtn.textContent = label;
            selectBtn.style.fontFamily = family || DEFAULT_SYSTEM_THEME_FONT_FAMILY;
            selectBtn.addEventListener('click', () => onSelect?.());
            pill.appendChild(selectBtn);
            if (typeof onDelete === 'function') {
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'theme-font-pill-delete';
                deleteBtn.setAttribute('aria-label', `删除字体 ${label}`);
                deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
                deleteBtn.addEventListener('click', () => onDelete());
                pill.appendChild(deleteBtn);
            }
            return pill;
        }

        async function activateThemeFontDefinition(definition, toastMessage = '') {
            try {
                if (themeFontAddBtn) themeFontAddBtn.disabled = true;
                await loadThemeFontDefinition(definition);
                setThemeFontStateFromDefinition(definition);
                renderThemeFontPresetLists();
                renderThemeFontPreview();
                await applyThemeFont(themeState, { fallbackOnError: false });
                await saveGlobalData();
                if (toastMessage) showToast(toastMessage);
                return true;
            } catch (error) {
                console.warn('Failed to activate theme font:', error);
                showToast(error?.message || '字体加载失败');
                return false;
            } finally {
                if (themeFontAddBtn) themeFontAddBtn.disabled = false;
            }
        }

        async function deleteThemeFontPreset(preset) {
            const wasActive = themeState.fontMode === 'saved' && themeState.fontPresetKey === preset.id;
            themeState.savedFontPresets = themeState.savedFontPresets.filter(item => item.id !== preset.id);
            if (wasActive) setThemeFontStateFromDefinition({ ...BUILTIN_THEME_FONTS[0], type: 'builtin' });
            renderThemeFontPresetLists();
            renderThemeFontPreview();
            if (wasActive) await applyThemeFont(themeState);
            await saveGlobalData();
            if (preset.fontAssetId && typeof window.appStorage?.deleteAsset === 'function') {
                const stillReferenced = themeState.savedFontPresets.some(item => item.fontAssetId === preset.fontAssetId);
                if (!stillReferenced) await window.appStorage.deleteAsset(preset.fontAssetId);
            }
            showToast(`已删除字体 ${preset.label}`);
        }

        function renderThemeFontPresetLists() {
            if (!themeFontModalUserPresetList) return;
            themeFontModalUserPresetList.innerHTML = '';
            const builtin = BUILTIN_THEME_FONTS[0];
            themeFontModalUserPresetList.appendChild(createThemeFontPill({
                label: builtin.label,
                family: builtin.family,
                isActive: themeState.fontMode === 'preset',
                onSelect: () => activateThemeFontDefinition({ ...builtin, type: 'builtin' }, `已切换到 ${builtin.label}`)
            }));
            themeState.savedFontPresets.forEach((preset) => {
                themeFontModalUserPresetList.appendChild(createThemeFontPill({
                    label: preset.label,
                    family: preset.family,
                    isActive: themeState.fontMode === 'saved' && themeState.fontPresetKey === preset.id,
                    onSelect: () => activateThemeFontDefinition(preset, `已切换到 ${preset.label}`),
                    onDelete: () => deleteThemeFontPreset(preset)
                }));
            });
        }

        function setThemeFontSourceMode(mode) {
            themeFontSourceMode = mode === 'link' ? 'link' : 'local';
            themeFontSourceTabs.forEach((tab) => {
                const active = tab.dataset.fontSource === themeFontSourceMode;
                tab.classList.toggle('active', active);
                tab.setAttribute('aria-selected', String(active));
            });
            themeFontSourcePanels.forEach((panel) => {
                const active = panel.dataset.fontSourcePanel === themeFontSourceMode;
                panel.classList.toggle('active', active);
                panel.hidden = !active;
            });
        }

        function updateThemeFontFileStatus(message = '') {
            if (!themeFontFileStatus) return;
            themeFontFileStatus.classList.remove('is-ready', 'is-warning');
            if (!themeFontSelectedFile) {
                themeFontFileStatus.textContent = message || '支持 TTF、OTF、WOFF、WOFF2，单个文件不超过 20 MB';
                return;
            }
            const sizeMb = (themeFontSelectedFile.size / (1024 * 1024)).toFixed(1);
            const largeFile = themeFontSelectedFile.size > THEME_FONT_WARNING_FILE_SIZE;
            themeFontFileStatus.classList.add(largeFile ? 'is-warning' : 'is-ready');
            themeFontFileStatus.textContent = largeFile
                ? `${themeFontSelectedFile.name} · ${sizeMb} MB，文件较大，建议优先使用 WOFF2`
                : `${themeFontSelectedFile.name} · ${sizeMb} MB，已准备添加`;
        }

        async function readThemeFontFileAsDataUrl(file) {
            if (typeof window.appStorage?.blobToDataUrl === 'function') {
                return window.appStorage.blobToDataUrl(file);
            }
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(reader.error || new Error('字体文件读取失败'));
                reader.readAsDataURL(file);
            });
        }

        function buildThemeFontLinkSources(url, format) {
            const sources = cloneThemeFontSources();
            sources[format || 'woff2'] = url;
            return sources;
        }

        async function addAndApplyThemeFont() {
            ensureThemeFontStateShape();
            const rawName = themeFontSourceMode === 'local' ? themeFontLocalNameInput?.value : themeFontNameInput?.value;
            const name = sanitizeThemeFontLabel(rawName || '');
            if (!String(rawName || '').trim()) {
                showToast('请填写字体名称');
                return;
            }
            const existingIndex = themeState.savedFontPresets.findIndex(preset => preset.name === name);
            const previousPreset = existingIndex >= 0 ? themeState.savedFontPresets[existingIndex] : null;
            const presetId = previousPreset?.id || `font_preset_${Date.now()}`;
            const cssName = createThemeFontInternalName(presetId);
            let nextPreset = null;
            let newAssetId = '';

            try {
                if (themeFontAddBtn) themeFontAddBtn.disabled = true;
                if (themeFontSourceMode === 'local') {
                    const file = themeFontSelectedFile;
                    const format = inferThemeFontFormat(file?.name || '');
                    if (!file || !format) throw new Error('请选择支持的字体文件');
                    if (file.size <= 0) throw new Error('字体文件为空');
                    if (file.size > THEME_FONT_MAX_FILE_SIZE) throw new Error('字体文件不能超过 20 MB');
                    if (typeof window.appStorage?.saveAssetFromDataUrl !== 'function') throw new Error('字体存储服务不可用');
                    const dataUrl = await readThemeFontFileAsDataUrl(file);
                    newAssetId = `theme_font_${presetId}_${Date.now()}`;
                    await window.appStorage.saveAssetFromDataUrl(newAssetId, dataUrl, {
                        kind: 'theme-font',
                        fileName: file.name,
                        fontFormat: format
                    });
                    nextPreset = normalizeThemeFontPreset({
                        id: presetId,
                        name,
                        cssName,
                        sourceType: 'local',
                        fontAssetId: newAssetId,
                        fontFormat: format,
                        sources: {}
                    });
                } else {
                    const rawUrl = String(themeFontUrlInput?.value || '').trim();
                    let parsedUrl;
                    try {
                        parsedUrl = new URL(rawUrl);
                    } catch (error) {
                        throw new Error('请输入完整的字体链接');
                    }
                    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('字体链接仅支持 HTTP 或 HTTPS');
                    const format = inferThemeFontFormat(parsedUrl.pathname) || 'woff2';
                    nextPreset = normalizeThemeFontPreset({
                        id: presetId,
                        name,
                        cssName,
                        sourceType: 'link',
                        fontFormat: format,
                        sources: buildThemeFontLinkSources(rawUrl, format)
                    });
                }

                await loadThemeFontDefinition(nextPreset);
                if (existingIndex >= 0) themeState.savedFontPresets[existingIndex] = nextPreset;
                else themeState.savedFontPresets.push(nextPreset);
                setThemeFontStateFromDefinition(nextPreset);
                renderThemeFontPresetLists();
                renderThemeFontPreview();
                await applyThemeFont(themeState, { fallbackOnError: false });
                await saveGlobalData();

                if (previousPreset?.fontAssetId && previousPreset.fontAssetId !== newAssetId && typeof window.appStorage?.deleteAsset === 'function') {
                    await window.appStorage.deleteAsset(previousPreset.fontAssetId);
                }
                syncThemeFontInputsFromState();
                showToast(existingIndex >= 0 ? '字体已更新并应用' : '字体已添加并应用');
            } catch (error) {
                console.warn('Failed to add theme font:', error);
                if (newAssetId && typeof window.appStorage?.deleteAsset === 'function') {
                    await window.appStorage.deleteAsset(newAssetId).catch(() => undefined);
                }
                showToast(error?.message || '字体添加失败');
            } finally {
                if (themeFontAddBtn) themeFontAddBtn.disabled = false;
            }
        }

        function openThemeFontModal() {
            if (!themeFontModal) return;
            syncThemeFontInputsFromState();
            renderThemeFontPresetLists();
            setThemeFontSourceMode('local');
            themeFontModal.classList.add('active');
            themeFontModal.setAttribute('aria-hidden', 'false');
        }

        function closeThemeFontModal() {
            if (!themeFontModal) return;
            themeFontModal.classList.remove('active');
            themeFontModal.setAttribute('aria-hidden', 'true');
        }

        themeFontBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            openThemeFontModal();
        });
        themeFontCloseBtn?.addEventListener('click', closeThemeFontModal);
        themeFontModal?.addEventListener('click', (event) => {
            if (event.target === themeFontModal) closeThemeFontModal();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && themeFontModal?.classList.contains('active')) closeThemeFontModal();
        });
        themeFontSourceTabs.forEach(tab => tab.addEventListener('click', () => setThemeFontSourceMode(tab.dataset.fontSource)));
        themeFontUploadBtn?.addEventListener('click', () => themeFontFileInput?.click());
        themeFontFileInput?.addEventListener('change', () => {
            const file = themeFontFileInput.files?.[0] || null;
            const format = inferThemeFontFormat(file?.name || '');
            if (!file || !format) {
                themeFontSelectedFile = null;
                updateThemeFontFileStatus(file ? '不支持该字体格式' : '');
                if (file) showToast('仅支持 TTF、OTF、WOFF、WOFF2');
                return;
            }
            if (file.size > THEME_FONT_MAX_FILE_SIZE) {
                themeFontSelectedFile = null;
                themeFontFileInput.value = '';
                updateThemeFontFileStatus('字体文件不能超过 20 MB');
                showToast('字体文件不能超过 20 MB');
                return;
            }
            themeFontSelectedFile = file;
            if (themeFontLocalNameInput && !themeFontLocalNameInput.value.trim()) {
                themeFontLocalNameInput.value = file.name.replace(/\.[^.]+$/, '');
            }
            updateThemeFontFileStatus();
        });
        themeFontAddBtn?.addEventListener('click', addAndApplyThemeFont);

        if (themeFontSizeSlider) {
            themeFontSizeSlider.addEventListener('input', (event) => {
                themeState.fontSize = normalizeThemeFontSize(event.target.value);
                renderThemeFontPreview();
                const family = document.documentElement.style.getPropertyValue('--theme-font-family') || getActiveThemeFontDefinition(themeState).family;
                applyThemeFontCss(family, themeState.fontSize);
                scheduleThemeFontSave();
            });
            themeFontSizeSlider.addEventListener('change', () => {
                if (themeFontSaveTimer) {
                    clearTimeout(themeFontSaveTimer);
                    themeFontSaveTimer = null;
                }
                saveGlobalData();
                showToast(`字体大小已调整为 ${themeState.fontSize}px`);
            });
        }

        // Font helpers and runtime registries must exist before restoring a saved local font.
        themeFontRuntimeReady = true;
        await applySavedTheme();
        document.dispatchEvent(new CustomEvent('u2-theme-state-ready'));
        
        // ==========================================
        // API CONFIGURATION LOGIC
        // ==========================================
        function saveGlobalData() {
            return persistSettingsData();
        }

        function normalizeVectorMemoryConfig(value) {
            if (window.u2Api?.normalizeVectorMemoryConfig) {
                return window.u2Api.normalizeVectorMemoryConfig(value);
            }
            const source = value && typeof value === 'object' ? value : {};
            return {
                enabled: source.enabled === true,
                provider: String(source.provider || 'siliconflow').trim(),
                endpoint: String(source.endpoint || '').trim(),
                apiKey: String(source.apiKey || '').trim(),
                model: String(source.model || '').trim()
            };
        }

        function getVectorMemoryProviders() {
            return window.u2Api?.VECTOR_MEMORY_PROVIDERS || window.imVectorMemory?.PROVIDERS || {};
        }

        function getVectorMemoryProviderMeta(provider) {
            const providers = getVectorMemoryProviders();
            return providers[provider] || providers.siliconflow || { defaultModel: '', models: [] };
        }

        function getSelectedVectorMemoryModel() {
            const selected = String(UI.inputs.vectorMemoryModel?.value || '').trim();
            return selected === '__custom__'
                ? String(UI.inputs.vectorMemoryCustomModel?.value || '').trim()
                : selected;
        }

        function getVectorMemoryConfigDraft() {
            return normalizeVectorMemoryConfig({
                enabled: !!UI.inputs.vectorMemoryEnabled?.checked,
                provider: String(UI.inputs.vectorMemoryProvider?.value || 'siliconflow').trim(),
                endpoint: String(UI.inputs.vectorMemoryEndpoint?.value || '').trim(),
                apiKey: String(UI.inputs.vectorMemoryApiKey?.value || '').trim(),
                model: getSelectedVectorMemoryModel()
            });
        }

        function renderVectorMemoryModelOptions(selectedConfig = vectorMemoryConfig, preferredModel = '') {
            const select = UI.inputs.vectorMemoryModel;
            if (!select) return;
            const provider = String(selectedConfig?.provider || UI.inputs.vectorMemoryProvider?.value || 'siliconflow');
            const providerMeta = getVectorMemoryProviderMeta(provider);
            const selectedModel = String(preferredModel || selectedConfig?.model || providerMeta.defaultModel || '').trim();
            const models = Array.isArray(providerMeta.models) ? providerMeta.models.map(String).filter(Boolean) : [];
            select.replaceChildren();

            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                select.append(option);
            });

            const customOption = document.createElement('option');
            customOption.value = '__custom__';
            customOption.textContent = '自定义模型';
            select.append(customOption);

            const usesCustomModel = !models.includes(selectedModel);
            select.value = usesCustomModel ? '__custom__' : selectedModel;
            if (UI.inputs.vectorMemoryCustomModel) {
                UI.inputs.vectorMemoryCustomModel.value = usesCustomModel ? selectedModel : '';
            }
            if (UI.inputs.vectorMemoryCustomModelRow) {
                UI.inputs.vectorMemoryCustomModelRow.hidden = !usesCustomModel;
            }
        }

        function syncVectorMemoryConfigInputs() {
            const config = normalizeVectorMemoryConfig(vectorMemoryConfig);
            if (UI.inputs.vectorMemoryEnabled) UI.inputs.vectorMemoryEnabled.checked = config.enabled;
            if (UI.inputs.vectorMemoryProvider) UI.inputs.vectorMemoryProvider.value = config.provider;
            if (UI.inputs.vectorMemoryEndpoint) UI.inputs.vectorMemoryEndpoint.value = config.endpoint;
            if (UI.inputs.vectorMemoryApiKey) UI.inputs.vectorMemoryApiKey.value = config.apiKey;
            if (UI.inputs.vectorMemoryCustomEndpointRow) {
                UI.inputs.vectorMemoryCustomEndpointRow.hidden = config.provider !== 'openai-compatible';
            }
            renderVectorMemoryModelOptions(config);
            refreshVectorMemoryConfigStatus();
        }

        function refreshVectorMemoryConfigStatus() {
            const status = document.getElementById('vector-memory-config-status');
            const config = normalizeVectorMemoryConfig(vectorMemoryConfig);
            if (status) {
                status.textContent = config.enabled
                    ? (config.apiKey && config.model && (config.provider !== 'openai-compatible' || config.endpoint) ? '已启用' : '待配置')
                    : '关闭';
            }
            const runtimeStatus = window.imVectorMemory?.getStatus?.();
            if (UI.inputs.vectorMemoryIndexStatus) {
                UI.inputs.vectorMemoryIndexStatus.textContent = runtimeStatus?.message
                    || (config.enabled ? '保存后将自动同步全部记忆' : '未启用');
            }
        }

        refreshVectorMemoryConfigStatus();

        function getBackgroundActivitySettings() {
            if (window.u2BackgroundActivity && typeof window.u2BackgroundActivity.getSettings === 'function') {
                return window.u2BackgroundActivity.getSettings();
            }

            return { enabled: false, intervalSeconds: 60 };
        }

        function syncBackgroundActivityControls() {
            const settings = getBackgroundActivitySettings();

            if (UI.inputs.bgActivityToggle) {
                UI.inputs.bgActivityToggle.checked = !!settings.enabled;
            }
        }

        function applyBackgroundActivityControls(showFeedback = false) {
            const currentSettings = getBackgroundActivitySettings();
            const intervalSeconds = currentSettings.intervalSeconds || 60;
            const enabled = !!UI.inputs.bgActivityToggle?.checked;

            if (window.u2BackgroundActivity && typeof window.u2BackgroundActivity.updateSettings === 'function') {
                window.u2BackgroundActivity.updateSettings({ enabled, intervalSeconds });
            } else if (window.StorageManager && typeof window.StorageManager.save === 'function') {
                window.StorageManager.save('u2_backgroundActivitySettings', { enabled, intervalSeconds, lastTickAt: 0 });
            }

            if (showFeedback && typeof showToast === 'function') {
                showToast(enabled ? '后台保活已开启' : '后台保活已关闭');
            }
        }

        if (UI.inputs.bgActivityToggle) {
            UI.inputs.bgActivityToggle.addEventListener('change', () => {
                applyBackgroundActivityControls(true);
            });
            window.addEventListener('u2:background-activity-settings-changed', syncBackgroundActivityControls);
        }

        const MAX_NOTIFICATION_SOUND_BYTES = 5 * 1024 * 1024;

        function syncSystemNotificationControls() {
            if (!UI.inputs.systemNotificationToggle) return;

            const settings = window.u2SystemNotifications?.getSettings
                ? window.u2SystemNotifications.getSettings()
                : { enabled: false, hasCustomSound: false };
            const enabled = !!settings.enabled;
            const hasCustomSound = !!settings.hasCustomSound;

            UI.inputs.systemNotificationToggle.checked = enabled;
            UI.inputs.notificationSettingsGroup?.classList.toggle('is-sound-expanded', enabled);
            UI.inputs.notificationSoundSettings?.classList.toggle('is-visible', enabled);
            UI.inputs.notificationSoundSettings?.setAttribute('aria-hidden', String(!enabled));
            UI.inputs.notificationSoundActions?.classList.toggle('is-visible', hasCustomSound);
            UI.inputs.notificationSoundActions?.setAttribute('aria-hidden', String(!hasCustomSound));

            if (UI.inputs.notificationSoundFileName) {
                UI.inputs.notificationSoundFileName.textContent = hasCustomSound
                    ? (settings.soundFileName || '自定义提示音')
                    : '默认使用系统提示音';
            }
            if (UI.inputs.notificationSoundUploadLabel) {
                UI.inputs.notificationSoundUploadLabel.textContent = hasCustomSound ? '更换' : '上传音频';
            }
        }

        async function applySystemNotificationControls(showFeedback = false) {
            if (!UI.inputs.systemNotificationToggle) return;

            const enabled = !!UI.inputs.systemNotificationToggle.checked;

            if (window.u2SystemNotifications?.updateSettings) {
                const result = await window.u2SystemNotifications.updateSettings({ enabled });
                UI.inputs.systemNotificationToggle.checked = !!result.enabled;

                if (showFeedback && typeof showToast === 'function') {
                    if (result.unsupported) {
                        showToast('当前浏览器不支持系统通知');
                    } else if (result.permission === 'denied') {
                        showToast('系统通知权限被拒绝，请在浏览器设置中开启');
                    } else {
                        showToast(result.enabled ? '消息通知已开启' : '消息通知已关闭');
                    }
                }
                return;
            }

            UI.inputs.systemNotificationToggle.checked = false;
            if (showFeedback && typeof showToast === 'function') {
                showToast('消息通知模块未加载');
            }
        }

        if (UI.inputs.systemNotificationToggle) {
            UI.inputs.systemNotificationToggle.addEventListener('change', async () => {
                UI.inputs.systemNotificationToggle.disabled = true;
                try {
                    await applySystemNotificationControls(true);
                } finally {
                    UI.inputs.systemNotificationToggle.disabled = false;
                    syncSystemNotificationControls();
                }
            });
            window.addEventListener('u2:system-notification-settings-changed', syncSystemNotificationControls);
        }

        function readNotificationSoundFile(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(reader.error || new Error('音频读取失败'));
                reader.readAsDataURL(file);
            });
        }

        if (UI.inputs.notificationSoundUploadBtn && UI.inputs.notificationSoundFileInput) {
            UI.inputs.notificationSoundUploadBtn.addEventListener('click', () => {
                UI.inputs.notificationSoundFileInput.click();
            });

            UI.inputs.notificationSoundFileInput.addEventListener('change', async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;

                try {
                    if (file.type && !file.type.startsWith('audio/')) {
                        showToast('请选择音频文件');
                        return;
                    }
                    if (file.size > MAX_NOTIFICATION_SOUND_BYTES) {
                        showToast('提示音不能超过 5 MB');
                        return;
                    }
                    if (!window.u2SystemNotifications?.setCustomSound) {
                        showToast('消息通知模块未加载');
                        return;
                    }

                    UI.inputs.notificationSoundUploadBtn.disabled = true;
                    const dataUrl = await readNotificationSoundFile(file);
                    await window.u2SystemNotifications.setCustomSound({
                        dataUrl,
                        fileName: file.name,
                        mimeType: file.type || 'application/octet-stream'
                    });
                    syncSystemNotificationControls();
                    showToast('消息提示音已更新');
                } catch (error) {
                    console.error('[settings] Failed to save notification sound:', error);
                    showToast(error?.name === 'QuotaExceededError' ? '存储空间不足，无法保存提示音' : '提示音保存失败');
                } finally {
                    UI.inputs.notificationSoundUploadBtn.disabled = false;
                    event.target.value = '';
                }
            });
        }

        if (UI.inputs.notificationSoundPreviewBtn) {
            UI.inputs.notificationSoundPreviewBtn.addEventListener('click', async () => {
                const played = await window.u2SystemNotifications?.playNotificationSound?.();
                if (!played) showToast('提示音暂时无法播放');
            });
        }

        if (UI.inputs.notificationSoundRemoveBtn) {
            UI.inputs.notificationSoundRemoveBtn.addEventListener('click', async () => {
                if (!window.u2SystemNotifications?.clearCustomSound) return;
                UI.inputs.notificationSoundRemoveBtn.disabled = true;
                try {
                    await window.u2SystemNotifications.clearCustomSound();
                    syncSystemNotificationControls();
                    showToast('已恢复系统提示音');
                } catch (error) {
                    console.error('[settings] Failed to remove notification sound:', error);
                    showToast('提示音移除失败');
                } finally {
                    UI.inputs.notificationSoundRemoveBtn.disabled = false;
                }
            });
        }

        // -- Global Assistive API Ball --
        const assistiveBallConfigBtn = document.getElementById('assistive-ball-config-btn');
        let assistiveBallEl = null;
        let assistiveBallPanelEl = null;
        let assistivePresetSelectEl = null;
        let assistiveDragState = null;
        let assistiveDragFrame = null;
        let assistiveDragSettleFrame = null;
        let assistivePositionSaveTimer = null;

        function getCurrentApiPresetId() {
            if (!Array.isArray(apiPresets)) return '';
            const match = apiPresets.find(preset =>
                (preset.provider || 'openai-compatible') === (apiConfig.provider || 'openai-compatible') &&
                (preset.endpoint || '') === (apiConfig.endpoint || '') &&
                (preset.apiKey || '') === (apiConfig.apiKey || '') &&
                (preset.model || '') === (apiConfig.model || '') &&
                String(preset.temp ?? 0.7) === String(apiConfig.temperature ?? 0.7)
            );
            return match ? String(match.id) : '';
        }

        function getApiDisplayValue(value, fallback = '未设置') {
            const text = String(value || '').trim();
            return text || fallback;
        }

        function maskApiKey(key) {
            const text = String(key || '').trim();
            if (!text) return '未设置';
            if (text.length <= 8) return '已填写';
            return `${text.slice(0, 4)}...${text.slice(-4)}`;
        }

        function normalizeAssistiveBallOpacity(value) {
            const numeric = parseFloat(value);
            if (!Number.isFinite(numeric)) return 0.72;
            return Math.max(0.2, Math.min(1, numeric > 1 ? numeric / 100 : numeric));
        }

        function normalizeAssistiveBallSize(value) {
            const numeric = parseFloat(value);
            if (!Number.isFinite(numeric)) return 58;
            return Math.round(Math.max(36, Math.min(96, numeric)) / 2) * 2;
        }

        function normalizeAssistiveBallImageUrl(value) {
            const imageUrl = typeof value === 'string' ? value.trim() : '';
            if (!imageUrl) return '';
            if (/^data:image\/png;base64,/i.test(imageUrl)) return imageUrl;

            try {
                const parsed = new URL(imageUrl);
                return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? imageUrl : '';
            } catch (error) {
                return '';
            }
        }

        function preloadAssistiveBallImage(imageUrl) {
            return new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(imageUrl);
                image.onerror = () => reject(new Error('Failed to load assistive ball image'));
                image.src = imageUrl;
            });
        }

        function renderDefaultAssistiveBallAppearance() {
            if (!assistiveBallEl) return;
            const inner = assistiveBallEl.querySelector('.assistive-api-ball-inner');
            assistiveBallEl.classList.remove('has-custom-image');
            if (inner) inner.innerHTML = '<i class="fas fa-circle-dot"></i>';
        }

        function applyAssistiveBallAppearance() {
            if (!assistiveBallEl) return;
            const inner = assistiveBallEl.querySelector('.assistive-api-ball-inner');
            const imageUrl = normalizeAssistiveBallImageUrl(assistiveBallSettings.imageUrl);
            if (!inner || !imageUrl) {
                renderDefaultAssistiveBallAppearance();
                return;
            }

            assistiveBallEl.classList.add('has-custom-image');
            inner.innerHTML = '';
            const image = document.createElement('img');
            image.className = 'assistive-api-ball-image';
            image.alt = '';
            image.draggable = false;
            image.addEventListener('error', () => {
                if (normalizeAssistiveBallImageUrl(assistiveBallSettings.imageUrl) === imageUrl) {
                    renderDefaultAssistiveBallAppearance();
                }
            }, { once: true });
            image.src = imageUrl;
            inner.appendChild(image);
        }

        function syncAssistiveBallImageControls() {
            if (UI.inputs.assistiveBallImageUrl) {
                UI.inputs.assistiveBallImageUrl.value = normalizeAssistiveBallImageUrl(assistiveBallSettings.imageUrl);
            }
        }

        async function setAssistiveBallImage(imageUrl, successMessage) {
            const normalizedImageUrl = normalizeAssistiveBallImageUrl(imageUrl);
            if (!normalizedImageUrl) {
                showToast('请输入有效的 http(s) 图片链接');
                return false;
            }

            try {
                await preloadAssistiveBallImage(normalizedImageUrl);
            } catch (error) {
                showToast('图片加载失败，请检查链接或图片文件');
                return false;
            }

            assistiveBallSettings.imageUrl = normalizedImageUrl;
            ensureAssistiveBallDom();
            applyAssistiveBallAppearance();
            syncAssistiveBallImageControls();
            await saveGlobalData();
            showToast(successMessage);
            return true;
        }

        function syncAssistiveBallOpacityControls() {
            assistiveBallSettings.opacity = normalizeAssistiveBallOpacity(assistiveBallSettings.opacity);
            const percent = Math.round(assistiveBallSettings.opacity * 100);
            if (UI.inputs.assistiveBallOpacity) {
                UI.inputs.assistiveBallOpacity.value = String(percent);
            }
            if (UI.inputs.assistiveBallOpacityValue) {
                UI.inputs.assistiveBallOpacityValue.textContent = `${percent}%`;
            }
            if (assistiveBallEl) {
                assistiveBallEl.style.setProperty('--assistive-ball-opacity', assistiveBallSettings.opacity.toFixed(2));
            }
        }

        function syncAssistiveBallSizeControls() {
            assistiveBallSettings.size = normalizeAssistiveBallSize(assistiveBallSettings.size);
            if (UI.inputs.assistiveBallSize) {
                UI.inputs.assistiveBallSize.value = String(assistiveBallSettings.size);
            }
            if (UI.inputs.assistiveBallSizeValue) {
                UI.inputs.assistiveBallSizeValue.textContent = `${assistiveBallSettings.size}px`;
            }
            if (assistiveBallEl) {
                assistiveBallEl.style.setProperty('--assistive-ball-size', `${assistiveBallSettings.size}px`);
            }
        }

        function ensureAssistiveBallDom() {
            const appContainer = document.getElementById('app') || document.body;

            if (!assistiveBallEl) {
                assistiveBallEl = document.createElement('div');
                assistiveBallEl.id = 'global-assistive-api-ball';
                assistiveBallEl.className = 'assistive-api-ball';
                assistiveBallEl.setAttribute('role', 'button');
                assistiveBallEl.setAttribute('aria-label', 'API 悬浮球');
                assistiveBallEl.innerHTML = '<div class="assistive-api-ball-inner"><i class="fas fa-circle-dot"></i></div>';
                appContainer.appendChild(assistiveBallEl);

                assistiveBallEl.addEventListener('click', (event) => {
                    event.stopPropagation();
                    if (assistiveBallEl.dataset.dragged === 'true') {
                        assistiveBallEl.dataset.dragged = 'false';
                        return;
                    }
                    openAssistiveBallPanel();
                });
                assistiveBallEl.addEventListener('pointerdown', startAssistiveBallDrag);
                syncAssistiveBallOpacityControls();
                syncAssistiveBallSizeControls();
                applyAssistiveBallAppearance();
            }

            if (!assistiveBallPanelEl) {
                assistiveBallPanelEl = document.createElement('div');
                assistiveBallPanelEl.id = 'global-assistive-api-panel';
                assistiveBallPanelEl.className = 'assistive-api-panel';
                assistiveBallPanelEl.innerHTML = `
                    <div class="assistive-api-panel-title">当前 API</div>
                    <div class="assistive-api-row">
                        <span>模型</span>
                        <strong id="assistive-api-model">未设置</strong>
                    </div>
                    <label class="assistive-api-select-wrap">
                        <span>API 预设</span>
                        <select id="assistive-api-preset-select"></select>
                        <i class="fas fa-chevron-down"></i>
                    </label>
                `;
                appContainer.appendChild(assistiveBallPanelEl);
                assistivePresetSelectEl = assistiveBallPanelEl.querySelector('#assistive-api-preset-select');

                assistiveBallPanelEl.addEventListener('click', (event) => {
                    event.stopPropagation();
                    if (event.target === assistiveBallPanelEl) {
                        closeAssistiveBallPanel();
                    }
                });

                assistivePresetSelectEl?.addEventListener('change', (event) => {
                    applyAssistivePreset(event.target.value);
                });
            }
        }

        function openAssistiveBallPanel() {
            ensureAssistiveBallDom();
            syncAssistiveBallPanel();
            assistiveBallEl.classList.remove('visible');
            assistiveBallEl.classList.add('panel-open');
            assistiveBallPanelEl.classList.add('active');
        }

        function closeAssistiveBallPanel() {
            if (assistiveBallPanelEl) assistiveBallPanelEl.classList.remove('active');
            if (assistiveBallEl) {
                assistiveBallEl.classList.remove('panel-open');
                assistiveBallEl.classList.toggle('visible', assistiveBallSettings.enabled);
            }
        }

        function clampAssistiveBallPosition(x, y, measurements = null) {
            if (!assistiveBallEl) return { x: 0, y: 0 };
            let bounds = measurements;
            if (!bounds) {
                const parent = assistiveBallEl.parentElement || document.body;
                const parentRect = parent.getBoundingClientRect();
                const ballRect = assistiveBallEl.getBoundingClientRect();
                bounds = {
                    parentWidth: parentRect.width,
                    parentHeight: parentRect.height,
                    ballWidth: ballRect.width || 58,
                    ballHeight: ballRect.height || 58
                };
            }
            const margin = 8;
            return {
                x: Math.max(margin, Math.min(x, bounds.parentWidth - bounds.ballWidth - margin)),
                y: Math.max(margin, Math.min(y, bounds.parentHeight - bounds.ballHeight - margin))
            };
        }

        function applyAssistiveBallPosition() {
            if (!assistiveBallEl) return;
            const parent = assistiveBallEl.parentElement || document.body;
            const parentRect = parent.getBoundingClientRect();
            const currentRect = assistiveBallEl.getBoundingClientRect();
            const fallbackX = parentRect.width - (currentRect.width || 58) - 12;
            const fallbackY = parentRect.height * 0.46;
            const next = clampAssistiveBallPosition(
                Number.isFinite(assistiveBallSettings.x) ? assistiveBallSettings.x : fallbackX,
                Number.isFinite(assistiveBallSettings.y) ? assistiveBallSettings.y : fallbackY,
                {
                    parentWidth: parentRect.width,
                    parentHeight: parentRect.height,
                    ballWidth: currentRect.width || 58,
                    ballHeight: currentRect.height || 58
                }
            );
            assistiveBallSettings.x = next.x;
            assistiveBallSettings.y = next.y;
            assistiveBallEl.style.left = `${next.x}px`;
            assistiveBallEl.style.top = `${next.y}px`;
        }

        function startAssistiveBallDrag(event) {
            if (!assistiveBallEl) return;
            if (assistiveDragSettleFrame !== null) {
                cancelAnimationFrame(assistiveDragSettleFrame);
                assistiveDragSettleFrame = null;
            }
            const parent = assistiveBallEl.parentElement || document.body;
            const parentRect = parent.getBoundingClientRect();
            const ballRect = assistiveBallEl.getBoundingClientRect();

            assistiveDragState = {
                pointerId: event.pointerId,
                startClientX: event.clientX,
                startClientY: event.clientY,
                offsetX: event.clientX - ballRect.left,
                offsetY: event.clientY - ballRect.top,
                parentLeft: parentRect.left,
                parentTop: parentRect.top,
                parentWidth: parentRect.width,
                parentHeight: parentRect.height,
                ballWidth: ballRect.width || assistiveBallSettings.size || 58,
                ballHeight: ballRect.height || assistiveBallSettings.size || 58,
                originX: ballRect.left - parentRect.left,
                originY: ballRect.top - parentRect.top,
                nextX: ballRect.left - parentRect.left,
                nextY: ballRect.top - parentRect.top,
                latestClientX: event.clientX,
                latestClientY: event.clientY,
                moved: false
            };

            assistiveBallEl.classList.add('dragging');
            assistiveBallEl.style.transform = 'translate3d(0, 0, 0) scale(0.96)';
            assistiveBallEl.setPointerCapture?.(event.pointerId);
            assistiveBallEl.addEventListener('pointermove', moveAssistiveBallDrag);
            assistiveBallEl.addEventListener('pointerup', endAssistiveBallDrag);
            assistiveBallEl.addEventListener('pointercancel', endAssistiveBallDrag);
        }

        function moveAssistiveBallDrag(event) {
            if (!assistiveDragState || !assistiveBallEl || event.pointerId !== assistiveDragState.pointerId) return;
            event.preventDefault();
            assistiveDragState.latestClientX = event.clientX;
            assistiveDragState.latestClientY = event.clientY;

            const deltaX = event.clientX - assistiveDragState.startClientX;
            const deltaY = event.clientY - assistiveDragState.startClientY;
            if (!assistiveDragState.moved && Math.abs(deltaX) + Math.abs(deltaY) > 4) {
                assistiveDragState.moved = true;
                closeAssistiveBallPanel();
            }

            if (assistiveDragFrame === null) {
                assistiveDragFrame = requestAnimationFrame(renderAssistiveBallDragFrame);
            }
        }

        function renderAssistiveBallDragFrame() {
            assistiveDragFrame = null;
            if (!assistiveDragState || !assistiveBallEl) return;
            const margin = 8;
            const rawX = assistiveDragState.latestClientX - assistiveDragState.parentLeft - assistiveDragState.offsetX;
            const rawY = assistiveDragState.latestClientY - assistiveDragState.parentTop - assistiveDragState.offsetY;
            const nextX = Math.max(margin, Math.min(rawX, assistiveDragState.parentWidth - assistiveDragState.ballWidth - margin));
            const nextY = Math.max(margin, Math.min(rawY, assistiveDragState.parentHeight - assistiveDragState.ballHeight - margin));
            assistiveDragState.nextX = nextX;
            assistiveDragState.nextY = nextY;
            const translateX = nextX - assistiveDragState.originX;
            const translateY = nextY - assistiveDragState.originY;
            assistiveBallEl.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(0.96)`;
        }

        function endAssistiveBallDrag(event) {
            if (!assistiveBallEl) return;
            const moved = !!assistiveDragState?.moved;
            if (assistiveDragFrame !== null) {
                cancelAnimationFrame(assistiveDragFrame);
                assistiveDragFrame = null;
                renderAssistiveBallDragFrame();
            }
            const finalX = assistiveDragState?.nextX;
            const finalY = assistiveDragState?.nextY;
            assistiveBallEl.releasePointerCapture?.(event.pointerId);
            assistiveBallEl.removeEventListener('pointermove', moveAssistiveBallDrag);
            assistiveBallEl.removeEventListener('pointerup', endAssistiveBallDrag);
            assistiveBallEl.removeEventListener('pointercancel', endAssistiveBallDrag);
            assistiveDragState = null;

            if (moved) {
                assistiveBallSettings.x = finalX;
                assistiveBallSettings.y = finalY;
                assistiveBallEl.style.left = `${finalX}px`;
                assistiveBallEl.style.top = `${finalY}px`;
                // Commit the new layout position while transitions are still disabled.
                // Two frames let the zero-translation state paint before release easing returns.
                assistiveBallEl.style.transform = 'translate3d(0, 0, 0) scale(0.96)';
                assistiveBallEl.dataset.dragged = 'true';
                assistiveDragSettleFrame = requestAnimationFrame(() => {
                    assistiveDragSettleFrame = requestAnimationFrame(() => {
                        assistiveDragSettleFrame = null;
                        if (!assistiveDragState && assistiveBallEl) {
                            assistiveBallEl.classList.remove('dragging');
                            assistiveBallEl.style.transform = '';
                        }
                    });
                });
                if (assistivePositionSaveTimer !== null) clearTimeout(assistivePositionSaveTimer);
                assistivePositionSaveTimer = window.setTimeout(() => {
                    assistivePositionSaveTimer = null;
                    saveGlobalData();
                }, 50);
                window.setTimeout(() => {
                    if (assistiveBallEl) assistiveBallEl.dataset.dragged = 'false';
                }, 0);
            } else {
                assistiveBallEl.classList.remove('dragging');
                assistiveBallEl.style.transform = '';
            }
        }

        function syncAssistiveBallPanel() {
            if (!assistiveBallPanelEl) return;

            const modelEl = assistiveBallPanelEl.querySelector('#assistive-api-model');

            if (modelEl) modelEl.textContent = getApiDisplayValue(apiConfig.model);

            if (!assistivePresetSelectEl) return;

            assistivePresetSelectEl.innerHTML = '';
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = Array.isArray(apiPresets) && apiPresets.length ? '选择 API 预设' : '暂无 API 预设';
            assistivePresetSelectEl.appendChild(placeholder);

            if (Array.isArray(apiPresets)) {
                apiPresets.forEach((preset) => {
                    const option = document.createElement('option');
                    option.value = String(preset.id);
                    option.textContent = preset.name || '未命名预设';
                    assistivePresetSelectEl.appendChild(option);
                });
            }

            assistivePresetSelectEl.value = getCurrentApiPresetId();
        }

        function setAssistiveBallEnabled(enabled) {
            assistiveBallSettings.enabled = !!enabled;
            if (UI.inputs.assistiveBallToggle) {
                UI.inputs.assistiveBallToggle.checked = assistiveBallSettings.enabled;
            }

            ensureAssistiveBallDom();
            syncAssistiveBallOpacityControls();
            syncAssistiveBallSizeControls();
            applyAssistiveBallAppearance();
            applyAssistiveBallPosition();
            assistiveBallEl.classList.toggle('visible', assistiveBallSettings.enabled);
            if (!assistiveBallSettings.enabled) {
                closeAssistiveBallPanel();
            } else {
                syncAssistiveBallPanel();
            }
        }

        function applyAssistivePreset(presetId) {
            const preset = Array.isArray(apiPresets)
                ? apiPresets.find(item => String(item.id) === String(presetId))
                : null;
            if (!preset) {
                syncAssistiveBallPanel();
                return;
            }

            apiConfig = {
                provider: preset.provider || 'openai-compatible',
                endpoint: preset.endpoint || '',
                apiKey: preset.apiKey || '',
                model: preset.model || '',
                temperature: preset.temp ?? 0.7
            };
            tempApiConfig = { ...apiConfig };
            window.apiConfig = apiConfig;

            if (UI.inputs.apiProvider) UI.inputs.apiProvider.value = apiConfig.provider;
            syncApiProviderPresentation({ provider: apiConfig.provider });
            if (UI.inputs.apiEndpoint) UI.inputs.apiEndpoint.value = apiConfig.endpoint;
            if (UI.inputs.apiKey) UI.inputs.apiKey.value = apiConfig.apiKey;
            if (UI.inputs.apiModel) syncSelectValue(UI.inputs.apiModel, apiConfig.model || '');
            if (UI.inputs.apiTemp) UI.inputs.apiTemp.value = apiConfig.temperature;

            saveGlobalData();
            syncAssistiveBallPanel();
            showToast(`已切换到 ${preset.name || '未命名预设'}`);
        }

        if (assistiveBallConfigBtn && UI.overlays.assistiveBallSettings) {
            assistiveBallConfigBtn.addEventListener('click', () => {
                setAssistiveBallEnabled(assistiveBallSettings.enabled);
                syncAssistiveBallOpacityControls();
                syncAssistiveBallSizeControls();
                syncAssistiveBallImageControls();
                openView(UI.overlays.assistiveBallSettings);
            });
        }

        if (UI.inputs.assistiveBallToggle) {
            UI.inputs.assistiveBallToggle.addEventListener('change', () => {
                setAssistiveBallEnabled(UI.inputs.assistiveBallToggle.checked);
                saveGlobalData();
                showToast(assistiveBallSettings.enabled ? '悬浮球已开启' : '悬浮球已关闭');
            });
        }

        if (UI.inputs.assistiveBallOpacity) {
            UI.inputs.assistiveBallOpacity.addEventListener('input', () => {
                assistiveBallSettings.opacity = normalizeAssistiveBallOpacity(UI.inputs.assistiveBallOpacity.value);
                syncAssistiveBallOpacityControls();
            });
            UI.inputs.assistiveBallOpacity.addEventListener('change', () => {
                assistiveBallSettings.opacity = normalizeAssistiveBallOpacity(UI.inputs.assistiveBallOpacity.value);
                syncAssistiveBallOpacityControls();
                saveGlobalData();
            });
        }

        if (UI.inputs.assistiveBallSize) {
            UI.inputs.assistiveBallSize.addEventListener('input', () => {
                assistiveBallSettings.size = normalizeAssistiveBallSize(UI.inputs.assistiveBallSize.value);
                syncAssistiveBallSizeControls();
                applyAssistiveBallPosition();
            });
            UI.inputs.assistiveBallSize.addEventListener('change', () => {
                assistiveBallSettings.size = normalizeAssistiveBallSize(UI.inputs.assistiveBallSize.value);
                syncAssistiveBallSizeControls();
                applyAssistiveBallPosition();
                saveGlobalData();
            });
        }

        if (UI.inputs.assistiveBallImageUrlApply) {
            UI.inputs.assistiveBallImageUrlApply.addEventListener('click', () => {
                setAssistiveBallImage(UI.inputs.assistiveBallImageUrl?.value, '悬浮球图片已更新');
            });
        }

        if (UI.inputs.assistiveBallImageUrl) {
            UI.inputs.assistiveBallImageUrl.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                setAssistiveBallImage(UI.inputs.assistiveBallImageUrl.value, '悬浮球图片已更新');
            });
        }

        if (UI.inputs.assistiveBallImageUpload && UI.inputs.assistiveBallImageFile) {
            UI.inputs.assistiveBallImageUpload.addEventListener('click', () => {
                UI.inputs.assistiveBallImageFile.click();
            });

            UI.inputs.assistiveBallImageFile.addEventListener('change', async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                if (file.type !== 'image/png') {
                    showToast('请上传 PNG 图片');
                    return;
                }

                try {
                    const compressedImageUrl = await readImageAsCompressedDataUrl(file, {
                        maxWidth: 256,
                        maxHeight: 256,
                        outputType: 'image/png'
                    });
                    await setAssistiveBallImage(compressedImageUrl, '悬浮球图片已压缩并更新');
                } catch (error) {
                    console.warn('Failed to compress assistive ball image:', error);
                    showToast('图片压缩失败，请重试');
                }
            });
        }

        if (UI.inputs.assistiveBallImageReset) {
            UI.inputs.assistiveBallImageReset.addEventListener('click', async () => {
                assistiveBallSettings.imageUrl = '';
                ensureAssistiveBallDom();
                applyAssistiveBallAppearance();
                syncAssistiveBallImageControls();
                await saveGlobalData();
                showToast('已恢复默认悬浮球');
            });
        }

        document.addEventListener('click', (event) => {
            if (assistiveBallPanelEl?.classList.contains('active') && !assistiveBallPanelEl.contains(event.target)) {
                closeAssistiveBallPanel();
            }
        });

        window.u2AssistiveApiBall = {
            sync: syncAssistiveBallPanel,
            setEnabled: setAssistiveBallEnabled,
            getSettings: () => ({ ...assistiveBallSettings })
        };

        setAssistiveBallEnabled(assistiveBallSettings.enabled);

        const API_MODEL_RENDER_LIMIT = 80;
        const API_MODEL_SEARCH_DEBOUNCE_MS = 80;
        let apiModelListRevision = 0;
        let apiModelRenderKey = '';
        let apiModelSearchTimer = null;

        function invalidateNativeModelSelect() {
            apiModelListRevision += 1;
            apiModelRenderKey = '';
            if (apiModelSearchTimer) {
                clearTimeout(apiModelSearchTimer);
                apiModelSearchTimer = null;
            }
        }

        function renderNativeModelSelect(searchText = UI.inputs.apiModelSearch?.value || '', options = {}) {
            if (!UI.inputs.apiModelList) return;
            if (!options.force && UI.inputs.apiModelPicker?.hidden) return;
            const query = String(searchText || '').trim().toLocaleLowerCase();
            const models = (Array.isArray(fetchedModels) ? fetchedModels : [])
                .filter(model => !query || String(model).toLocaleLowerCase().includes(query));
            const selectedModel = String(UI.inputs.apiModel?.value || '').trim();
            const renderKey = `${apiModelListRevision}|${query}|${selectedModel}`;
            if (apiModelRenderKey === renderKey) return;
            apiModelRenderKey = renderKey;

            const visibleModels = models.slice(0, API_MODEL_RENDER_LIMIT);
            if (!query && selectedModel && !visibleModels.includes(selectedModel) && models.includes(selectedModel)) {
                visibleModels.pop();
                visibleModels.unshift(selectedModel);
            }

            const fragment = document.createDocumentFragment();

            if (!models.length) {
                const empty = document.createElement('div');
                empty.className = 'api-model-empty';
                empty.textContent = fetchedModels.length
                    ? '没有匹配的模型'
                    : '暂无模型列表，可先获取模型或直接填写名称';
                fragment.appendChild(empty);
                UI.inputs.apiModelList.replaceChildren(fragment);
                return;
            }

            visibleModels.forEach(model => {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'api-model-option';
                option.setAttribute('role', 'option');
                option.setAttribute('aria-selected', String(model === selectedModel));
                option.classList.toggle('is-selected', model === selectedModel);
                option.textContent = model;
                option.addEventListener('click', () => {
                    syncSelectValue(UI.inputs.apiModel, model);
                    tempApiConfig.model = model;
                    setApiModelPickerOpen(false);
                });
                fragment.appendChild(option);
            });

            if (models.length > visibleModels.length) {
                const hint = document.createElement('div');
                hint.className = 'api-model-limit-hint';
                hint.textContent = `已显示前 ${API_MODEL_RENDER_LIMIT} 个模型，请继续搜索`;
                fragment.appendChild(hint);
            }

            UI.inputs.apiModelList.replaceChildren(fragment);
        }

        function scheduleNativeModelSelectRender(searchText) {
            if (apiModelSearchTimer) clearTimeout(apiModelSearchTimer);
            apiModelSearchTimer = setTimeout(() => {
                apiModelSearchTimer = null;
                renderNativeModelSelect(searchText);
            }, API_MODEL_SEARCH_DEBOUNCE_MS);
        }

        function setApiModelPickerOpen(open) {
            if (!UI.inputs.apiModelPicker || !UI.inputs.apiModelPickerToggle) return;
            const shouldOpen = !!open;
            UI.inputs.apiModelPicker.hidden = !shouldOpen;
            UI.inputs.apiModelPickerToggle.setAttribute('aria-expanded', String(shouldOpen));
            if (!shouldOpen) {
                if (apiModelSearchTimer) {
                    clearTimeout(apiModelSearchTimer);
                    apiModelSearchTimer = null;
                }
                return;
            }
            if (UI.inputs.apiModelSearch) UI.inputs.apiModelSearch.value = '';
            renderNativeModelSelect('', { force: true });
            setTimeout(() => UI.inputs.apiModelSearch?.focus({ preventScroll: true }), 0);
        }

        function syncSelectValue(selectEl, value) {
            if (!selectEl) return;
            selectEl.value = value;
        }

        const API_PROVIDER_META = Object.freeze({
            openai: {
                endpoint: 'https://api.openai.com/v1',
                model: 'gpt-4o-mini',
                hint: '使用 OpenAI 官方 Chat Completions 接口。'
            },
            deepseek: {
                endpoint: 'https://api.deepseek.com/v1',
                model: 'deepseek-chat',
                hint: '使用 DeepSeek 的 OpenAI 兼容接口。'
            },
            siliconflow: {
                endpoint: 'https://api.siliconflow.cn/v1',
                model: 'deepseek-ai/DeepSeek-V3',
                hint: '使用硅基流动的 OpenAI 兼容接口。'
            },
            gemini: {
                endpoint: 'https://generativelanguage.googleapis.com/v1beta',
                model: 'gemini-2.5-flash',
                hint: '使用 Gemini 官方协议与 x-goog-api-key；不要填写 OpenAI 的 /chat/completions 路径。'
            },
            anthropic: {
                endpoint: 'https://api.anthropic.com/v1',
                model: 'claude-sonnet-4-20250514',
                hint: '使用 Claude 官方 Messages API 与 x-api-key。'
            },
            'openai-compatible': {
                endpoint: '',
                model: '',
                hint: '填写任意 OpenAI 兼容服务的地址、密钥和模型。'
            }
        });

        function getApiProviderMeta(provider) {
            const normalized = window.u2Api.normalizeApiProvider(provider);
            return API_PROVIDER_META[normalized] || API_PROVIDER_META['openai-compatible'];
        }

        function syncApiProviderPresentation(options = {}) {
            const provider = window.u2Api.normalizeApiProvider(
                options.provider || UI.inputs.apiProvider?.value || tempApiConfig.provider || apiConfig.provider
            );
            const meta = getApiProviderMeta(provider);
            if (UI.inputs.apiProvider) UI.inputs.apiProvider.value = provider;
            if (UI.inputs.apiProviderHint) UI.inputs.apiProviderHint.textContent = meta.hint;

            if (options.applyPreset && meta.endpoint && UI.inputs.apiEndpoint) {
                UI.inputs.apiEndpoint.value = meta.endpoint;
            }
            if (options.applyPreset && meta.model && UI.inputs.apiModel) {
                const previousMeta = getApiProviderMeta(options.previousProvider);
                const currentModel = String(UI.inputs.apiModel.value || '').trim();
                if (!currentModel || currentModel === previousMeta.model) {
                    syncSelectValue(UI.inputs.apiModel, meta.model);
                }
            }
            if (options.applyPreset && provider !== window.u2Api.normalizeApiProvider(options.previousProvider)) {
                fetchedModels = [];
                invalidateNativeModelSelect();
            }
            tempApiConfig.provider = provider;
            return provider;
        }

        function getApiConfigDraft(requireModel = true) {
            const config = window.u2Api.validateApiConfig({
                provider: UI.inputs.apiProvider?.value,
                endpoint: UI.inputs.apiEndpoint?.value,
                apiKey: UI.inputs.apiKey?.value,
                model: UI.inputs.apiModel?.value,
                temperature: UI.inputs.apiTemp?.value
            }, { requireModel });
            config.endpoint = window.u2Api.normalizeApiEndpoint(config.endpoint, config.provider);
            return config;
        }

        function formatApiRequestError(error, fallback) {
            const status = Number(error?.status) || 0;
            const detail = String(error?.message || '').trim();
            if (status) return `${fallback}（HTTP ${status}${detail ? `：${detail}` : ''}）`;
            return detail || fallback;
        }

        const apiConfigBtn = document.getElementById('api-config-btn');
        if (apiConfigBtn && UI.overlays.apiConfig) {
            apiConfigBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                setApiModelPickerOpen(false);

                tempApiConfig = {
                    provider: apiConfig.provider || 'openai-compatible',
                    endpoint: apiConfig.endpoint || '',
                    apiKey: apiConfig.apiKey || '',
                    model: apiConfig.model || '',
                    temperature: apiConfig.temperature ?? 0.7
                };

                syncApiProviderPresentation({ provider: tempApiConfig.provider });
                UI.inputs.apiEndpoint.value = tempApiConfig.endpoint || '';
                UI.inputs.apiKey.value = tempApiConfig.apiKey || '';
                syncSelectValue(UI.inputs.apiModel, tempApiConfig.model || '');
                UI.inputs.apiTemp.value = tempApiConfig.temperature ?? 0.7;
                syncBackgroundActivityControls();
                syncSystemNotificationControls();

                openApiConfigSheet();
            });
        }

        if (UI.inputs.apiProvider) {
            UI.inputs.apiProvider.addEventListener('change', () => {
                const previousProvider = tempApiConfig.provider || apiConfig.provider || 'openai-compatible';
                syncApiProviderPresentation({
                    provider: UI.inputs.apiProvider.value,
                    previousProvider,
                    applyPreset: true
                });
            });
        }

        const vectorMemoryConfigBtn = document.getElementById('vector-memory-config-btn');
        if (vectorMemoryConfigBtn && UI.overlays.vectorMemoryConfig) {
            vectorMemoryConfigBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                syncVectorMemoryConfigInputs();
                openView(UI.overlays.vectorMemoryConfig);
            });
        }

        const VISION_PROVIDER_COPY = {
            openai: {
                name: 'OpenAI',
                keyLabel: 'OpenAI API Key',
                endpointHint: '使用支持图片输入的 OpenAI 模型；接口可填写完整 chat/completions 地址或 /v1 基础地址。'
            },
            gemini: {
                name: 'Gemini',
                keyLabel: 'Gemini API Key',
                endpointHint: '使用 Gemini Interactions API；请填写支持图片理解的 Gemini 模型。'
            },
            claude: {
                name: 'Claude',
                keyLabel: 'Anthropic API Key',
                endpointHint: '使用 Anthropic Messages API；远程图片地址需要浏览器可读取。'
            },
            grok: {
                name: 'Grok',
                keyLabel: 'xAI API Key',
                endpointHint: '使用支持图片输入的 Grok 模型。'
            },
            qwen: {
                name: 'Qwen / DashScope',
                keyLabel: 'DashScope API Key',
                endpointHint: '使用百炼 OpenAI 兼容接口；请选择支持视觉输入的 Qwen-VL 或多模态模型。'
            },
            zhipu: {
                name: '智谱 GLM',
                keyLabel: '智谱 API Key',
                endpointHint: '使用智谱 OpenAI 兼容接口；请选择支持视觉输入的 GLM 模型。'
            },
            'openai-compatible': {
                name: 'OpenAI 兼容',
                keyLabel: 'API 密钥',
                endpointHint: '可接入支持 OpenAI Chat Completions 图像输入的中转站或兼容服务。'
            }
        };
        let tempVisionConfig = window.u2ImageUnderstanding
            ? window.u2ImageUnderstanding.normalizeConfig(visionConfig)
            : clonePlainData(visionConfig);

        function commitVisionInputsToDraft() {
            const provider = tempVisionConfig.activeProvider;
            if (!provider || !tempVisionConfig.providers?.[provider]) return;
            tempVisionConfig.providers[provider] = {
                endpoint: String(UI.inputs.visionEndpoint?.value || '').trim(),
                apiKey: String(UI.inputs.visionApiKey?.value || '').trim(),
                model: String(UI.inputs.visionModel?.value || '').trim(),
                models: Array.isArray(tempVisionConfig.providers[provider].models)
                    ? tempVisionConfig.providers[provider].models.slice()
                    : []
            };
        }

        function renderVisionModelSelect(config) {
            const select = UI.inputs.visionModelSelect;
            if (!select) return;
            const models = Array.isArray(config?.models) ? config.models : [];
            select.replaceChildren();
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = models.length ? '选择已获取模型' : '暂无已获取模型';
            select.appendChild(placeholder);
            models.forEach((model) => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                select.appendChild(option);
            });
            select.value = models.includes(String(config?.model || '').trim())
                ? String(config.model).trim()
                : '';
            select.disabled = models.length === 0;
        }

        function renderVisionInputs() {
            const provider = tempVisionConfig.activeProvider || 'gemini';
            const config = tempVisionConfig.providers?.[provider] || {};
            const copy = VISION_PROVIDER_COPY[provider] || VISION_PROVIDER_COPY['openai-compatible'];
            if (UI.inputs.visionProvider) UI.inputs.visionProvider.value = provider;
            if (UI.inputs.visionEndpoint) UI.inputs.visionEndpoint.value = config.endpoint || '';
            if (UI.inputs.visionApiKey) {
                UI.inputs.visionApiKey.value = config.apiKey || '';
                UI.inputs.visionApiKey.placeholder = provider === 'gemini' ? 'AIza...' : 'sk-...';
            }
            if (UI.inputs.visionModel) {
                UI.inputs.visionModel.value = config.model || '';
                UI.inputs.visionModel.placeholder = '填写支持视觉输入的模型';
            }
            renderVisionModelSelect(config);
            if (UI.inputs.visionKeyLabel) UI.inputs.visionKeyLabel.textContent = copy.keyLabel;
            if (UI.inputs.visionEndpointHint) UI.inputs.visionEndpointHint.textContent = copy.endpointHint;
        }

        const visionConfigBtn = document.getElementById('vision-config-btn');
        if (visionConfigBtn && UI.overlays.visionConfig) {
            visionConfigBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                if (!window.u2ImageUnderstanding) {
                    showToast('识图模块尚未加载，请刷新后重试');
                    return;
                }
                tempVisionConfig = window.u2ImageUnderstanding.normalizeConfig(visionConfig);
                renderVisionInputs();
                openView(UI.overlays.visionConfig);
            });
        }

        UI.inputs.visionProvider?.addEventListener('change', () => {
            commitVisionInputsToDraft();
            tempVisionConfig.activeProvider = UI.inputs.visionProvider.value;
            renderVisionInputs();
        });

        [UI.inputs.visionEndpoint, UI.inputs.visionApiKey].forEach((input) => {
            input?.addEventListener('input', commitVisionInputsToDraft);
            input?.addEventListener('change', commitVisionInputsToDraft);
        });

        UI.inputs.visionModel?.addEventListener('input', () => {
            commitVisionInputsToDraft();
            const provider = tempVisionConfig.activeProvider;
            const models = tempVisionConfig.providers?.[provider]?.models || [];
            if (UI.inputs.visionModelSelect) {
                UI.inputs.visionModelSelect.value = models.includes(String(UI.inputs.visionModel.value || '').trim())
                    ? String(UI.inputs.visionModel.value).trim()
                    : '';
            }
        });
        UI.inputs.visionModel?.addEventListener('change', commitVisionInputsToDraft);

        UI.inputs.visionModelSelect?.addEventListener('change', () => {
            const selectedModel = String(UI.inputs.visionModelSelect.value || '').trim();
            if (!selectedModel || !UI.inputs.visionModel) return;
            UI.inputs.visionModel.value = selectedModel;
            commitVisionInputsToDraft();
        });

        const fetchVisionModelsBtn = document.getElementById('fetch-vision-models-btn');
        if (fetchVisionModelsBtn) {
            fetchVisionModelsBtn.addEventListener('click', async () => {
                const originalHtml = fetchVisionModelsBtn.innerHTML;
                try {
                    if (!window.u2ImageUnderstanding) throw new Error('识图模块尚未加载，请刷新后重试');
                    commitVisionInputsToDraft();
                    const provider = tempVisionConfig.activeProvider;
                    const activeConfig = tempVisionConfig.providers?.[provider] || {};
                    fetchVisionModelsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><div class="settings-text" style="color:var(--blue-color);">正在获取模型…</div>';
                    fetchVisionModelsBtn.style.pointerEvents = 'none';
                    const models = await window.u2ImageUnderstanding.fetchModels({ provider, ...activeConfig });
                    if (!models.length) throw new Error('接口返回成功，但没有找到可用模型');
                    tempVisionConfig.providers[provider].models = models.slice();
                    renderVisionModelSelect(tempVisionConfig.providers[provider]);
                    if (UI.inputs.visionModel && !UI.inputs.visionModel.value.trim()) {
                        UI.inputs.visionModel.value = models[0];
                        commitVisionInputsToDraft();
                    }
                    if (UI.inputs.visionModelSelect) UI.inputs.visionModelSelect.value = UI.inputs.visionModel.value;
                    UI.inputs.visionModel?.focus({ preventScroll: true });
                    showToast(`成功获取 ${models.length} 个模型`);
                } catch (error) {
                    console.error('Fetch Vision Models Error:', error);
                    showToast(error?.message || '获取识图模型失败');
                } finally {
                    fetchVisionModelsBtn.innerHTML = originalHtml;
                    fetchVisionModelsBtn.style.pointerEvents = '';
                }
            });
        }

        const confirmVisionConfigBtn = document.getElementById('confirm-vision-config-btn');
        if (confirmVisionConfigBtn) {
            confirmVisionConfigBtn.addEventListener('click', async () => {
                const previousConfig = visionConfig;
                try {
                    if (!window.u2ImageUnderstanding) throw new Error('识图模块尚未加载，请刷新后重试');
                    commitVisionInputsToDraft();
                    const provider = tempVisionConfig.activeProvider;
                    const activeConfig = tempVisionConfig.providers?.[provider] || {};
                    window.u2ImageUnderstanding.validateActiveConfig({ provider, ...activeConfig });
                    confirmVisionConfigBtn.classList.add('is-busy');
                    confirmVisionConfigBtn.style.pointerEvents = 'none';

                    visionConfig = window.u2ImageUnderstanding.normalizeConfig(tempVisionConfig);
                    window.visionConfig = visionConfig;
                    const persisted = await saveGlobalData();
                    if (!persisted) throw new Error('识图配置未能写入本地存储，请重试');

                    closeView(UI.overlays.visionConfig);
                    const providerName = VISION_PROVIDER_COPY[provider]?.name || '识图服务';
                    showToast(`已启用 ${providerName}`);
                } catch (error) {
                    visionConfig = previousConfig;
                    window.visionConfig = previousConfig;
                    console.error('Save Vision Config Error:', error);
                    showToast(error?.message || '识图配置保存失败');
                } finally {
                    confirmVisionConfigBtn.classList.remove('is-busy');
                    confirmVisionConfigBtn.style.pointerEvents = '';
                }
            });
        }

        const IMAGE_PROVIDER_COPY = {
            openai: {
                name: 'GPT Image（OpenAI）',
                keyLabel: 'OpenAI API Key',
                endpointHint: '使用 OpenAI 官方 GPT Image 接口，也可替换为同协议代理地址'
            },
            gemini: {
                name: 'Gemini Image',
                keyLabel: 'Gemini API Key',
                endpointHint: '使用 x-goog-api-key 调用 Nano Banana / Gemini Image'
            },
            novelai: {
                name: 'NovelAI',
                keyLabel: 'Persistent Token',
                endpointHint: '使用 NovelAI Persistent API Token，返回图片将保存到聊天记录'
            },
            grok: {
                name: 'Grok',
                keyLabel: 'xAI API Key',
                endpointHint: '使用 Grok Imagine 图片生成接口'
            },
            relay: {
                name: 'OpenAI 兼容中转站',
                keyLabel: 'API 密钥',
                endpointHint: '可填写基础地址或完整 /v1/images/generations 地址'
            }
        };
        let tempImageGenerationConfig = window.u2ImageGeneration
            ? window.u2ImageGeneration.normalizeConfig(imageGenerationConfig)
            : clonePlainData(imageGenerationConfig);

        function commitImageGenerationInputsToDraft() {
            const provider = tempImageGenerationConfig.activeProvider;
            if (!provider || !tempImageGenerationConfig.providers?.[provider]) return;
            tempImageGenerationConfig.providers[provider] = {
                endpoint: String(UI.inputs.imageEndpoint?.value || '').trim(),
                apiKey: String(UI.inputs.imageApiKey?.value || '').trim(),
                model: String(UI.inputs.imageModel?.value || '').trim(),
                size: UI.inputs.imageSize?.value || '1024x1024',
                models: Array.isArray(tempImageGenerationConfig.providers[provider].models)
                    ? tempImageGenerationConfig.providers[provider].models.slice()
                    : []
            };
        }

        function renderImageGenerationModelSelect(config) {
            const select = UI.inputs.imageModelSelect;
            if (!select) return;
            const models = Array.isArray(config?.models) ? config.models : [];
            select.replaceChildren();
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = models.length ? '选择已获取模型' : '暂无已获取模型';
            select.appendChild(placeholder);
            models.forEach((model) => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                select.appendChild(option);
            });
            select.value = models.includes(String(config?.model || '').trim())
                ? String(config.model).trim()
                : '';
            select.disabled = models.length === 0;
        }

        function renderImageGenerationInputs() {
            const provider = tempImageGenerationConfig.activeProvider || 'gemini';
            const config = tempImageGenerationConfig.providers?.[provider] || {};
            const copy = IMAGE_PROVIDER_COPY[provider] || IMAGE_PROVIDER_COPY.relay;
            if (UI.inputs.imageProvider) UI.inputs.imageProvider.value = provider;
            if (UI.inputs.imageEndpoint) UI.inputs.imageEndpoint.value = config.endpoint || '';
            if (UI.inputs.imageApiKey) {
                UI.inputs.imageApiKey.value = config.apiKey || '';
                UI.inputs.imageApiKey.placeholder = provider === 'novelai' ? 'pst-...' : 'sk-...';
            }
            if (UI.inputs.imageModel) {
                UI.inputs.imageModel.value = config.model || '';
                UI.inputs.imageModel.placeholder = provider === 'novelai'
                    ? '填写账号可用的 NovelAI 图片模型'
                    : provider === 'relay' ? '填写中转站图片模型' : '填写图片模型';
            }
            if (UI.inputs.imageSize) UI.inputs.imageSize.value = config.size || '1024x1024';
            renderImageGenerationModelSelect(config);
            if (UI.inputs.imageKeyLabel) UI.inputs.imageKeyLabel.textContent = copy.keyLabel;
            if (UI.inputs.imageEndpointHint) UI.inputs.imageEndpointHint.textContent = copy.endpointHint;
        }

        const imageGenerationConfigBtn = document.getElementById('image-generation-config-btn');
        if (imageGenerationConfigBtn && UI.overlays.imageGenerationConfig) {
            imageGenerationConfigBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                tempImageGenerationConfig = window.u2ImageGeneration
                    ? window.u2ImageGeneration.normalizeConfig(imageGenerationConfig)
                    : clonePlainData(imageGenerationConfig);
                renderImageGenerationInputs();
                openView(UI.overlays.imageGenerationConfig);
            });
        }

        if (UI.inputs.imageProvider) {
            UI.inputs.imageProvider.addEventListener('change', () => {
                commitImageGenerationInputsToDraft();
                tempImageGenerationConfig.activeProvider = UI.inputs.imageProvider.value;
                renderImageGenerationInputs();
            });
        }

        [UI.inputs.imageEndpoint, UI.inputs.imageApiKey, UI.inputs.imageSize].forEach((input) => {
            input?.addEventListener('input', commitImageGenerationInputsToDraft);
            input?.addEventListener('change', commitImageGenerationInputsToDraft);
        });

        [UI.inputs.imageModel].forEach((input) => {
            input?.addEventListener('input', () => {
                commitImageGenerationInputsToDraft();
                const provider = tempImageGenerationConfig.activeProvider;
                const models = tempImageGenerationConfig.providers?.[provider]?.models || [];
                if (UI.inputs.imageModelSelect) {
                    UI.inputs.imageModelSelect.value = models.includes(String(input.value || '').trim())
                        ? String(input.value).trim()
                        : '';
                }
            });
            input?.addEventListener('change', commitImageGenerationInputsToDraft);
        });

        UI.inputs.imageModelSelect?.addEventListener('change', () => {
            const selectedModel = String(UI.inputs.imageModelSelect.value || '').trim();
            if (!selectedModel || !UI.inputs.imageModel) return;
            UI.inputs.imageModel.value = selectedModel;
            commitImageGenerationInputsToDraft();
        });

        const fetchImageGenerationModelsBtn = document.getElementById('fetch-image-generation-models-btn');
        if (fetchImageGenerationModelsBtn) {
            fetchImageGenerationModelsBtn.addEventListener('click', async () => {
                const originalHtml = fetchImageGenerationModelsBtn.innerHTML;
                try {
                    commitImageGenerationInputsToDraft();
                    const provider = tempImageGenerationConfig.activeProvider;
                    const activeConfig = tempImageGenerationConfig.providers?.[provider] || {};
                    fetchImageGenerationModelsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><div class="settings-text" style="color:var(--blue-color);">正在获取模型…</div>';
                    fetchImageGenerationModelsBtn.style.pointerEvents = 'none';
                    const models = await window.u2ImageGeneration.fetchModels({ provider, ...activeConfig });
                    if (!models.length) throw new Error('接口返回成功，但没有找到可用模型');
                    tempImageGenerationConfig.providers[provider].models = models.slice();
                    renderImageGenerationModelSelect(tempImageGenerationConfig.providers[provider]);
                    if (UI.inputs.imageModel && !UI.inputs.imageModel.value.trim()) {
                        UI.inputs.imageModel.value = models[0];
                        commitImageGenerationInputsToDraft();
                    }
                    if (UI.inputs.imageModelSelect) UI.inputs.imageModelSelect.value = UI.inputs.imageModel.value;
                    UI.inputs.imageModel?.focus({ preventScroll: true });
                    showToast(`成功获取 ${models.length} 个模型`);
                } catch (error) {
                    console.error('Fetch Image Generation Models Error:', error);
                    showToast(error?.message || '获取生图模型失败');
                } finally {
                    fetchImageGenerationModelsBtn.innerHTML = originalHtml;
                    fetchImageGenerationModelsBtn.style.pointerEvents = '';
                }
            });
        }

        const confirmImageGenerationBtn = document.getElementById('confirm-image-generation-btn');
        if (confirmImageGenerationBtn) {
            confirmImageGenerationBtn.addEventListener('click', async () => {
                const previousConfig = imageGenerationConfig;
                try {
                    commitImageGenerationInputsToDraft();
                    const provider = tempImageGenerationConfig.activeProvider;
                    const activeConfig = tempImageGenerationConfig.providers?.[provider] || {};
                    window.u2ImageGeneration.validateActiveConfig({ provider, ...activeConfig });
                    confirmImageGenerationBtn.classList.add('is-busy');
                    confirmImageGenerationBtn.style.pointerEvents = 'none';

                    imageGenerationConfig = window.u2ImageGeneration.normalizeConfig(tempImageGenerationConfig);
                    window.imageGenerationConfig = imageGenerationConfig;
                    const persisted = await saveGlobalData();
                    if (!persisted) throw new Error('生图配置未能写入本地存储，请重试');

                    closeView(UI.overlays.imageGenerationConfig);
                    const providerName = IMAGE_PROVIDER_COPY[provider]?.name || '生图服务';
                    showToast(`已启用 ${providerName}`);
                } catch (error) {
                    imageGenerationConfig = previousConfig;
                    window.imageGenerationConfig = previousConfig;
                    console.error('Save Image Generation Config Error:', error);
                    showToast(error?.message || '生图配置保存失败');
                } finally {
                    confirmImageGenerationBtn.classList.remove('is-busy');
                    confirmImageGenerationBtn.style.pointerEvents = '';
                }
            });
        }

        let tempTtsConfig = window.u2Tts
            ? window.u2Tts.normalizeConfig(ttsConfig)
            : clonePlainData(ttsConfig);

        function getActiveTtsDraft() {
            const provider = tempTtsConfig.activeProvider;
            return { provider, ...(tempTtsConfig.providers?.[provider] || {}) };
        }

        function commitTtsInputsToDraft() {
            const provider = tempTtsConfig.activeProvider;
            if (!provider || !tempTtsConfig.providers?.[provider]) return;
            const draft = tempTtsConfig.providers[provider];
            draft.endpoint = String(UI.inputs.ttsEndpoint?.value || '').trim();
            draft.apiKey = String(UI.inputs.ttsApiKey?.value || '').trim();
            draft.model = String(UI.inputs.ttsModel?.value || '').trim();
            UI.inputs.ttsExtraFields?.querySelectorAll('[data-tts-field]').forEach((input) => {
                draft[input.dataset.ttsField] = String(input.value || '').trim();
            });
        }

        function renderTtsModelSelect(config) {
            const select = UI.inputs.ttsModelSelect;
            if (!select) return;
            const models = Array.isArray(config?.models) ? config.models : [];
            select.replaceChildren();
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = models.length ? '选择已获取项目' : '暂无已获取项目';
            select.appendChild(placeholder);
            models.forEach((model) => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                select.appendChild(option);
            });
            select.value = models.includes(String(config?.model || '').trim()) ? String(config.model).trim() : '';
            select.disabled = models.length === 0;
        }

        function renderTtsExtraFields(provider, config) {
            const holder = UI.inputs.ttsExtraFields;
            if (!holder) return;
            holder.replaceChildren();
            const definition = window.u2Tts?.getProviderDefinition?.(provider);
            (definition?.fields || []).forEach((field, index, fields) => {
                const row = document.createElement('div');
                row.className = 'form-item';
                if (index === fields.length - 1) row.style.borderBottom = 'none';
                const label = document.createElement('label');
                label.style.width = '112px';
                label.style.whiteSpace = 'nowrap';
                label.textContent = field.label;
                row.appendChild(label);
                let input;
                if (field.type === 'select') {
                    input = document.createElement('select');
                    input.style.cssText = 'flex:1; border:none; text-align:right; direction:rtl; appearance:none; background:transparent; color:var(--blue-color); outline:none; font-size:16px; min-width:0;';
                    (field.options || []).forEach(([value, labelText]) => {
                        const option = document.createElement('option');
                        option.value = value;
                        option.textContent = labelText;
                        input.appendChild(option);
                    });
                } else {
                    input = document.createElement('input');
                    input.type = field.type || 'text';
                    input.autocomplete = 'off';
                    input.placeholder = field.placeholder || `填写${field.label}`;
                }
                input.dataset.ttsField = field.key;
                input.value = config[field.key] || '';
                input.addEventListener('input', commitTtsInputsToDraft);
                input.addEventListener('change', commitTtsInputsToDraft);
                row.appendChild(input);
                holder.appendChild(row);
            });
        }

        function renderTtsInputs() {
            const provider = tempTtsConfig.activeProvider || 'minimax';
            const config = tempTtsConfig.providers?.[provider] || {};
            const definition = window.u2Tts?.getProviderDefinition?.(provider);
            if (UI.inputs.ttsProvider) UI.inputs.ttsProvider.value = provider;
            if (UI.inputs.ttsEndpoint) UI.inputs.ttsEndpoint.value = config.endpoint || '';
            if (UI.inputs.ttsApiKey) UI.inputs.ttsApiKey.value = config.apiKey || '';
            if (UI.inputs.ttsModel) UI.inputs.ttsModel.value = config.model || '';
            if (UI.inputs.ttsKeyLabel) UI.inputs.ttsKeyLabel.textContent = definition?.keyLabel || 'API 密钥';
            const modelLabel = definition?.modelLabel || 'TTS 模型';
            if (UI.inputs.ttsModelLabel) UI.inputs.ttsModelLabel.textContent = modelLabel;
            if (UI.inputs.ttsModelSelectLabel) UI.inputs.ttsModelSelectLabel.textContent = `已获取${modelLabel}`;
            if (UI.inputs.ttsEndpointHint) {
                UI.inputs.ttsEndpointHint.textContent = `${definition?.label || 'TTS'}：模型或音色列表仅从当前服务商在线拉取，不提供内置候选。`;
            }
            renderTtsExtraFields(provider, config);
            renderTtsModelSelect(config);
        }

        const ttsConfigBtn = document.getElementById('tts-config-btn');
        if (ttsConfigBtn && UI.overlays.ttsConfig) {
            ttsConfigBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                if (!window.u2Tts) {
                    showToast('TTS 模块尚未加载，请刷新后重试');
                    return;
                }
                ttsConfig = window.u2Tts.getConfig();
                tempTtsConfig = window.u2Tts.normalizeConfig(ttsConfig);
                renderTtsInputs();
                openView(UI.overlays.ttsConfig);
            });
        }

        UI.inputs.ttsProvider?.addEventListener('change', () => {
            commitTtsInputsToDraft();
            tempTtsConfig.activeProvider = UI.inputs.ttsProvider.value;
            renderTtsInputs();
        });
        [UI.inputs.ttsEndpoint, UI.inputs.ttsApiKey].forEach((input) => {
            input?.addEventListener('input', commitTtsInputsToDraft);
            input?.addEventListener('change', commitTtsInputsToDraft);
        });
        UI.inputs.ttsModel?.addEventListener('input', () => {
            commitTtsInputsToDraft();
            const models = getActiveTtsDraft().models || [];
            if (UI.inputs.ttsModelSelect) UI.inputs.ttsModelSelect.value = models.includes(UI.inputs.ttsModel.value.trim()) ? UI.inputs.ttsModel.value.trim() : '';
        });
        UI.inputs.ttsModel?.addEventListener('change', commitTtsInputsToDraft);
        UI.inputs.ttsModelSelect?.addEventListener('change', () => {
            const model = String(UI.inputs.ttsModelSelect.value || '').trim();
            if (!model || !UI.inputs.ttsModel) return;
            UI.inputs.ttsModel.value = model;
            commitTtsInputsToDraft();
        });

        const fetchTtsModelsBtn = document.getElementById('fetch-tts-models-btn');
        if (fetchTtsModelsBtn) {
            fetchTtsModelsBtn.addEventListener('click', async () => {
                const originalHtml = fetchTtsModelsBtn.innerHTML;
                try {
                    if (!window.u2Tts) throw new Error('TTS 模块尚未加载，请刷新后重试');
                    commitTtsInputsToDraft();
                    const draft = getActiveTtsDraft();
                    fetchTtsModelsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><div class="settings-text" style="color:var(--blue-color);">正在获取模型…</div>';
                    fetchTtsModelsBtn.style.pointerEvents = 'none';
                    const models = await window.u2Tts.fetchModels(draft);
                    tempTtsConfig.providers[draft.provider].models = models.slice();
                    renderTtsModelSelect(tempTtsConfig.providers[draft.provider]);
                    showToast(`成功获取 ${models.length} 个${window.u2Tts.getProviderDefinition(draft.provider)?.modelIsVoice ? '音色' : '模型'}`);
                } catch (error) {
                    console.error('Fetch TTS Models Error:', error);
                    showToast(error?.message || '获取 TTS 模型失败');
                } finally {
                    fetchTtsModelsBtn.innerHTML = originalHtml;
                    fetchTtsModelsBtn.style.pointerEvents = '';
                }
            });
        }

        const confirmTtsBtn = document.getElementById('confirm-tts-btn');
        if (confirmTtsBtn) {
            confirmTtsBtn.addEventListener('click', async () => {
                const previousConfig = ttsConfig;
                try {
                    if (!window.u2Tts) throw new Error('TTS 模块尚未加载，请刷新后重试');
                    commitTtsInputsToDraft();
                    const activeConfig = getActiveTtsDraft();
                    window.u2Tts.validateActiveConfig(activeConfig);
                    confirmTtsBtn.classList.add('is-busy');
                    confirmTtsBtn.style.pointerEvents = 'none';
                    ttsConfig = window.u2Tts.setConfig(tempTtsConfig);
                    const persisted = await saveGlobalData();
                    if (!persisted) throw new Error('TTS 配置未能写入本地存储，请重试');
                    closeView(UI.overlays.ttsConfig);
                    showToast(`${window.u2Tts.getProviderName(activeConfig.provider)} TTS 已保存`);
                } catch (error) {
                    ttsConfig = previousConfig;
                    window.ttsConfig = previousConfig;
                    console.error('Save TTS Config Error:', error);
                    showToast(error?.message || 'TTS 配置保存失败');
                } finally {
                    confirmTtsBtn.classList.remove('is-busy');
                    confirmTtsBtn.style.pointerEvents = '';
                }
            });
        }

        const vectorMemoryTestBtn = document.getElementById('test-vector-memory-connection-btn');
        if (vectorMemoryTestBtn) {
            vectorMemoryTestBtn.addEventListener('click', async () => {
                const originalHtml = vectorMemoryTestBtn.innerHTML;
                vectorMemoryTestBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><div class="settings-text" style="color:var(--blue-color);">正在测试服务…</div>';
                vectorMemoryTestBtn.style.pointerEvents = 'none';
                try {
                    const draft = { ...getVectorMemoryConfigDraft(), enabled: true };
                    const result = await window.imVectorMemory?.testConnection?.(draft);
                    if (!result?.ok) throw new Error(result?.error || '嵌入服务连接失败');
                    showToast('嵌入服务连接成功');
                } catch (error) {
                    console.error('Test Vector Memory Connection Error:', error);
                    showToast(error?.message || '嵌入服务连接失败');
                } finally {
                    vectorMemoryTestBtn.innerHTML = originalHtml;
                    vectorMemoryTestBtn.style.pointerEvents = '';
                }
            });
        }

        const rebuildVectorMemoryIndexBtn = document.getElementById('rebuild-vector-memory-index-btn');
        if (rebuildVectorMemoryIndexBtn) {
            rebuildVectorMemoryIndexBtn.addEventListener('click', async () => {
                const originalHtml = rebuildVectorMemoryIndexBtn.innerHTML;
                rebuildVectorMemoryIndexBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><div class="settings-text" style="color:var(--blue-color);">正在构建索引…</div>';
                rebuildVectorMemoryIndexBtn.style.pointerEvents = 'none';
                try {
                    const result = await window.imVectorMemory?.rebuildAllMemoryIndexes?.();
                    if (!result?.ok) throw new Error(result?.error || '索引构建失败');
                    showToast(`已同步 ${result.count || 0} 条记忆`);
                } catch (error) {
                    console.error('Rebuild Vector Memory Index Error:', error);
                    showToast(error?.message || '索引构建失败');
                } finally {
                    rebuildVectorMemoryIndexBtn.innerHTML = originalHtml;
                    rebuildVectorMemoryIndexBtn.style.pointerEvents = '';
                    refreshVectorMemoryConfigStatus();
                }
            });
        }

        if (UI.inputs.vectorMemoryProvider) {
            UI.inputs.vectorMemoryProvider.addEventListener('change', () => {
                const provider = String(UI.inputs.vectorMemoryProvider.value || 'siliconflow');
                const providerMeta = getVectorMemoryProviderMeta(provider);
                if (UI.inputs.vectorMemoryCustomEndpointRow) {
                    UI.inputs.vectorMemoryCustomEndpointRow.hidden = provider !== 'openai-compatible';
                }
                renderVectorMemoryModelOptions({
                    ...getVectorMemoryConfigDraft(),
                    provider,
                    model: providerMeta.defaultModel || ''
                });
            });
        }

        if (UI.inputs.vectorMemoryModel) {
            UI.inputs.vectorMemoryModel.addEventListener('change', () => {
                const usesCustomModel = UI.inputs.vectorMemoryModel.value === '__custom__';
                if (UI.inputs.vectorMemoryCustomModelRow) {
                    UI.inputs.vectorMemoryCustomModelRow.hidden = !usesCustomModel;
                }
                if (usesCustomModel) UI.inputs.vectorMemoryCustomModel?.focus();
            });
        }

        window.addEventListener('u2:vector-memory-status', refreshVectorMemoryConfigStatus);

        const closeVectorMemoryConfigBtn = document.getElementById('close-vector-memory-config-btn');
        if (closeVectorMemoryConfigBtn) {
            closeVectorMemoryConfigBtn.addEventListener('click', closeVectorMemoryConfigSheet);
        }

        const confirmVectorMemoryConfigBtn = document.getElementById('confirm-vector-memory-config-btn');
        if (confirmVectorMemoryConfigBtn) {
            confirmVectorMemoryConfigBtn.addEventListener('click', async () => {
                const previousVectorMemoryConfig = vectorMemoryConfig;
                let vectorMemoryConfigPersisted = false;
                try {
                    const nextVectorMemoryConfig = getVectorMemoryConfigDraft();
                    if (nextVectorMemoryConfig.enabled && !nextVectorMemoryConfig.apiKey) {
                        throw new Error('启用向量记忆前请填写 API 密钥');
                    }
                    if (nextVectorMemoryConfig.enabled && !nextVectorMemoryConfig.model) {
                        throw new Error('启用向量记忆前请选择嵌入模型');
                    }
                    if (nextVectorMemoryConfig.enabled
                        && nextVectorMemoryConfig.provider === 'openai-compatible'
                        && !nextVectorMemoryConfig.endpoint) {
                        throw new Error('请填写兼容服务的嵌入接口地址');
                    }
                    confirmVectorMemoryConfigBtn.classList.add('is-busy');
                    confirmVectorMemoryConfigBtn.style.pointerEvents = 'none';
                    vectorMemoryConfig = nextVectorMemoryConfig;
                    window.vectorMemoryConfig = vectorMemoryConfig;

                    const persisted = await saveGlobalData();
                    if (!persisted) throw new Error('向量记忆设置未能写入本地存储，请重试');
                    vectorMemoryConfigPersisted = true;
                    refreshVectorMemoryConfigStatus();
                    if (nextVectorMemoryConfig.enabled) {
                        const rebuilt = await window.imVectorMemory?.rebuildAllMemoryIndexes?.();
                        if (!rebuilt?.ok) {
                            throw new Error(rebuilt?.error || '设置已保存，但索引同步失败');
                        }
                    }
                    closeVectorMemoryConfigSheet();
                    showToast(nextVectorMemoryConfig.enabled ? '向量记忆已同步' : '向量记忆设置已保存');
                } catch (error) {
                    if (!vectorMemoryConfigPersisted) {
                        vectorMemoryConfig = previousVectorMemoryConfig;
                        window.vectorMemoryConfig = vectorMemoryConfig;
                    }
                    console.error('Save Vector Memory Config Error:', error);
                    showToast(error?.message || '向量记忆设置保存失败');
                } finally {
                    confirmVectorMemoryConfigBtn.classList.remove('is-busy');
                    confirmVectorMemoryConfigBtn.style.pointerEvents = '';
                }
            });
        }

        const confirmApiBtn = document.getElementById('confirm-api-btn');
        if (confirmApiBtn) {
            confirmApiBtn.addEventListener('click', async () => {
                const previousConfig = apiConfig;
                try {
                    const nextConfig = getApiConfigDraft(true);
                    confirmApiBtn.classList.add('is-busy');
                    confirmApiBtn.style.pointerEvents = 'none';

                    tempApiConfig = { ...nextConfig };
                    apiConfig = { ...nextConfig };
                    window.apiConfig = apiConfig;
                    applyBackgroundActivityControls(false);
                    await applySystemNotificationControls(false);

                    const persisted = await saveGlobalData();
                    if (!persisted) throw new Error('API 设置未能写入本地存储，请重试');

                    notifyApiPresetsUpdated();
                    syncAssistiveBallPanel();
                    closeApiConfigSheet();
                    showToast('API 设置已保存');
                } catch (error) {
                    apiConfig = previousConfig;
                    window.apiConfig = apiConfig;
                    console.error('Save API Config Error:', error);
                    showToast(error?.message || 'API 设置保存失败');
                } finally {
                    confirmApiBtn.classList.remove('is-busy');
                    confirmApiBtn.style.pointerEvents = '';
                }
            });
        }

        const btnApiFetch = document.getElementById('fetch-models-btn');
        if (btnApiFetch) {
            btnApiFetch.addEventListener('click', async () => {
                const originalText = btnApiFetch.innerHTML;
                btnApiFetch.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';
                btnApiFetch.style.pointerEvents = 'none';
                
                try {
                    const draft = getApiConfigDraft(false);
                    const url = window.u2Api.resolveModelsEndpoint(draft.endpoint);
                    const headers = window.u2Api.buildApiHeaders(draft, {
                        [window.u2Api.INTERNAL_SILENT_ERROR_HEADER]: '1'
                    });
                    const res = await fetch(url, { method: 'GET', headers });
                    if (!res.ok) {
                        const detail = await window.u2Api.readApiError(res);
                        throw Object.assign(new Error(detail.message), detail);
                    }
                    
                    const data = await res.json();
                    const modelRows = Array.isArray(data?.data)
                        ? data.data
                        : Array.isArray(data?.models)
                            ? data.models
                            : Array.isArray(data) ? data : [];
                    const usableModelRows = draft.provider === 'gemini'
                        ? modelRows.filter((item) => {
                            if (typeof item === 'string') return true;
                            const methods = item?.supportedGenerationMethods;
                            return !Array.isArray(methods) || methods.includes('generateContent');
                        })
                        : modelRows;
                    fetchedModels = Array.from(new Set(usableModelRows
                        .map(item => typeof item === 'string' ? item : (item?.id || item?.name || ''))
                        .map(item => draft.provider === 'gemini' ? String(item || '').replace(/^models\//i, '') : item)
                        .map(item => String(item || '').trim())
                        .filter(Boolean)))
                        .sort((a, b) => a.localeCompare(b));

                    if (fetchedModels.length) {
                        const currentModel = UI.inputs.apiModel?.value || tempApiConfig.model || '';
                        await saveGlobalData();
                        invalidateNativeModelSelect();
                        renderNativeModelSelect();
                        syncSelectValue(UI.inputs.apiModel, currentModel);
                        showToast(`成功获取 ${fetchedModels.length} 个模型`);
                    } else {
                        throw new Error('接口返回成功，但没有识别到模型列表；可直接手动填写模型名称');
                    }
                } catch (error) {
                    console.error('Fetch Models Error:', error);
                    showToast(formatApiRequestError(error, '获取模型失败'));
                } finally {
                    btnApiFetch.innerHTML = originalText;
                    btnApiFetch.style.pointerEvents = '';
                }
            });
        }

        const testApiConnectionBtn = document.getElementById('test-api-connection-btn');
        if (testApiConnectionBtn) {
            testApiConnectionBtn.addEventListener('click', async () => {
                const originalText = testApiConnectionBtn.innerHTML;
                testApiConnectionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
                testApiConnectionBtn.style.pointerEvents = 'none';
                try {
                    const draft = getApiConfigDraft(true);
                    const endpoint = window.u2Api.resolveChatCompletionsEndpoint(draft.endpoint);
                    const headers = window.u2Api.buildApiHeaders(draft, {
                        [window.u2Api.INTERNAL_SILENT_ERROR_HEADER]: '1'
                    });
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            model: draft.model,
                            messages: [{ role: 'user', content: 'Reply with OK.' }],
                            temperature: 0
                        })
                    });
                    if (!response.ok) {
                        const detail = await window.u2Api.readApiError(response);
                        throw Object.assign(new Error(detail.message), detail);
                    }
                    const data = await response.json();
                    const hasCompatibleOutput = Array.isArray(data?.choices) || Array.isArray(data?.output);
                    if (!hasCompatibleOutput) throw new Error('接口已连接，但返回格式不是兼容的聊天响应');
                    showToast('连接测试成功');
                } catch (error) {
                    console.error('Test API Connection Error:', error);
                    showToast(formatApiRequestError(error, '连接测试失败'));
                } finally {
                    testApiConnectionBtn.innerHTML = originalText;
                    testApiConnectionBtn.style.pointerEvents = '';
                }
            });
        }

        if (UI.inputs.apiModel) {
            UI.inputs.apiModel.addEventListener('input', (e) => {
                tempApiConfig.model = e.target.value;
            });
            UI.inputs.apiModel.addEventListener('change', (e) => {
                tempApiConfig.model = e.target.value;
            });
        }

        if (UI.inputs.apiModelPickerToggle) {
            UI.inputs.apiModelPickerToggle.addEventListener('click', () => {
                const isOpen = UI.inputs.apiModelPickerToggle.getAttribute('aria-expanded') === 'true';
                setApiModelPickerOpen(!isOpen);
            });
        }

        if (UI.inputs.apiModelSearch) {
            UI.inputs.apiModelSearch.addEventListener('input', () => {
                scheduleNativeModelSelectRender(UI.inputs.apiModelSearch.value);
            });
        }

        // -- Presets --
        const savePresetBtn = document.getElementById('save-preset-btn');
        const loadPresetBtn = document.getElementById('load-preset-btn');
        const confirmSavePresetBtn = document.getElementById('confirm-save-preset-btn');

        if (savePresetBtn && UI.overlays.savePreset) {
            savePresetBtn.addEventListener('click', () => {
                if (UI.inputs.presetName) UI.inputs.presetName.value = '';
                openView(UI.overlays.savePreset);
            });
        }

        if (confirmSavePresetBtn) {
            confirmSavePresetBtn.addEventListener('click', () => {
                const endpoint = UI.inputs.apiEndpoint ? UI.inputs.apiEndpoint.value.trim() : '';
                const apiKey = UI.inputs.apiKey ? UI.inputs.apiKey.value.trim() : '';
                const model = UI.inputs.apiModel ? UI.inputs.apiModel.value.trim() : '';
                const parsedTemp = UI.inputs.apiTemp ? Number.parseFloat(UI.inputs.apiTemp.value) : 0.7;
                const temp = Number.isFinite(parsedTemp) ? Math.max(0, Math.min(2, parsedTemp)) : 0.7;
                const presetName = UI.inputs.presetName ? UI.inputs.presetName.value.trim() : '';

                apiPresets.push({
                    id: Date.now(),
                    name: presetName || '未命名预设',
                    provider: window.u2Api.normalizeApiProvider(UI.inputs.apiProvider?.value),
                    endpoint,
                    apiKey,
                    model,
                    temp
                });

                saveGlobalData();
                notifyApiPresetsUpdated();
                syncAssistiveBallPanel();
                closeView(UI.overlays.savePreset);
                showToast('预设已保存');
            });
        }

        if (loadPresetBtn && UI.overlays.loadPreset) {
            loadPresetBtn.addEventListener('click', () => {
                openView(UI.overlays.loadPreset);
                setTimeout(() => {
                    renderPresetList();
                }, 150);
            });
        }

        function renderPresetList() {
            if (!UI.lists.presets) return;
            UI.lists.presets.innerHTML = '';

            if (!Array.isArray(apiPresets) || apiPresets.length === 0) {
                UI.lists.presets.innerHTML = `
                    <div style="padding: 40px 20px; text-align: center; color: #8e8e93; font-size: 15px;">
                        暂无预设
                    </div>
                `;
                return;
            }

            const fragment = document.createDocumentFragment();

            apiPresets.forEach(preset => {
                const item = document.createElement('div');
                item.className = 'account-card';
                item.innerHTML = `
                    <div class="account-content" style="cursor: pointer;">
                        <div class="account-avatar" style="background-color: var(--blue-color); color: white;"><i class="fas fa-server"></i></div>
                        <div class="account-info">
                            <div class="account-name">${preset.name || '未命名预设'}</div>
                            <div class="account-detail" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;">${preset.endpoint || '未填写接口地址'}</div>
                        </div>
                        <i class="fas fa-times delete-icon"></i>
                    </div>
                `;

                const content = item.querySelector('.account-content');
                const deleteIcon = item.querySelector('.delete-icon');

                if (content) {
                    content.addEventListener('click', (e) => {
                        if (e.target.classList.contains('delete-icon') || e.target.closest('.delete-icon')) return;

                        const provider = window.u2Api.normalizeApiProvider(preset.provider);
                        if (UI.inputs.apiProvider) UI.inputs.apiProvider.value = provider;
                        tempApiConfig.provider = provider;
                        syncApiProviderPresentation({ provider });
                        if (UI.inputs.apiEndpoint) UI.inputs.apiEndpoint.value = preset.endpoint || '';
                        if (UI.inputs.apiKey) UI.inputs.apiKey.value = preset.apiKey || '';
                        if (UI.inputs.apiModel) {
                            syncSelectValue(UI.inputs.apiModel, preset.model || '');
                            tempApiConfig.model = preset.model || '';
                        }
                        if (UI.inputs.apiTemp) UI.inputs.apiTemp.value = preset.temp ?? 0.7;

                        closeView(UI.overlays.loadPreset);
                        showToast('预设已加载');
                    });
                }

                if (deleteIcon) {
                    deleteIcon.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (confirm(`删除预设“${preset.name || '未命名预设'}”？`)) {
                            apiPresets = apiPresets.filter(p => p.id !== preset.id);
                            saveGlobalData();
                            notifyApiPresetsUpdated();
                            renderPresetList();
                            syncAssistiveBallPanel();
                            showToast('预设已删除');
                        }
                    });
                }

                fragment.appendChild(item);
            });

            UI.lists.presets.appendChild(fragment);
        }

        // ==========================================
        // Data Management Logic
        // ==========================================
        const exportDataBtn = document.getElementById('export-data-btn');
        const importDataBtn = document.getElementById('import-data-btn');
        const importDataFile = document.getElementById('import-data-file');
        const clearDataBtn = document.getElementById('clear-data-btn');

        // Data Management v4
        (function initDataManagementV4() {
            const importPreview = document.getElementById('data-import-preview');
            const importFileName = document.getElementById('data-import-file-name');
            const importVersion = document.getElementById('data-import-version');
            const importRecords = document.getElementById('data-import-records');
            const importAssets = document.getElementById('data-import-assets');
            const importSize = document.getElementById('data-import-size');
            let selectedImportPayload = null;
            let selectedImportFile = null;
            let overlay = null;
            let overlayText = null;
            let overlayProgress = null;
            const storageHealthDot = document.getElementById('storage-health-dot');
            const storageHealthStatus = document.getElementById('storage-health-status');
            const storageHealthPersistence = document.getElementById('storage-health-persistence');
            const storageHealthLastSave = document.getElementById('storage-health-last-save');
            const storageHealthWarning = document.getElementById('storage-health-warning');
            const storageHealthCompaction = document.getElementById('storage-health-compaction');
            const storageHealthImageCompression = document.getElementById('storage-health-image-compression');
            const storageCleanCacheBtn = document.getElementById('storage-clean-cache-btn');
            const storageCompressImagesBtn = document.getElementById('storage-compress-images-btn');
            const storageRetryBtn = document.getElementById('storage-retry-btn');
            const storageTotalUsage = document.getElementById('storage-total-usage');
            const storageSummaryDescription = document.getElementById('storage-summary-description');
            const storageUsageBar = document.getElementById('storage-usage-bar');
            const storageUsageLegend = document.getElementById('storage-usage-legend');
            const storageCategoryList = document.getElementById('storage-category-list');
            const storageCategoryColors = {
                'iMessage': '#ff3b30',
                'X': '#0a84ff',
                '图片资源': '#ff9500',
                '书库': '#af52de',
                '应用状态': '#34c759',
                '冗余历史': '#8e8e93'
            };

            function stopLegacy(e) {
                e.preventDefault();
                e.stopImmediatePropagation();
            }

            function setBusy(btn, busy) {
                if (!btn) return;
                btn.disabled = !!busy;
                btn.classList.toggle('is-busy', !!busy);
            }

            function readFileText(file) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (event) => resolve(event.target.result || '');
                    reader.onerror = () => reject(reader.error || new Error('File read failed'));
                    reader.readAsText(file);
                });
            }

            function formatBytesForUi(bytes) {
                if (window.appStorage && typeof window.appStorage.formatBytes === 'function') {
                    return window.appStorage.formatBytes(bytes);
                }
                const size = Math.max(0, Number(bytes) || 0);
                return size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`;
            }

            function formatDateForUi(timestamp) {
                const value = Number(timestamp) || 0;
                if (!value) return '未知时间';
                try {
                    return new Date(value).toLocaleString();
                } catch (error) {
                    return '未知时间';
                }
            }

            function getStorageGroups(health) {
                return Object.entries(health?.breakdown?.logicalGroups || health?.breakdown?.groups || {})
                    .map(([name, value]) => ({
                        name,
                        bytes: Math.max(0, Number(value?.bytes) || 0),
                        count: Math.max(0, Number(value?.count) || 0)
                    }))
                    .filter((group) => group.bytes > 0)
                    .sort((a, b) => b.bytes - a.bytes);
            }

            function getStorageCategoryColor(name) {
                return storageCategoryColors[name] || '#c7c7cc';
            }

            function renderStorageUsage(health) {
                const groups = getStorageGroups(health);
                const totalBytes = Math.max(0, Number(health?.breakdown?.logicalBytes) || 0);
                const total = totalBytes || groups.reduce((sum, group) => sum + group.bytes, 0);

                if (storageTotalUsage) {
                    storageTotalUsage.textContent = `已使用 ${formatBytesForUi(total)}`;
                }
                if (storageSummaryDescription) {
                    storageSummaryDescription.textContent = total > 0
                        ? '根据当前应用内保存的数据实时统计'
                        : '当前还没有可统计的应用数据';
                }
                if (storageUsageBar) {
                    storageUsageBar.replaceChildren();
                    groups.forEach((group) => {
                        const segment = document.createElement('span');
                        const percentage = total > 0 ? (group.bytes / total) * 100 : 0;
                        segment.className = 'data-storage-usage-segment';
                        segment.style.width = `${percentage}%`;
                        segment.style.backgroundColor = getStorageCategoryColor(group.name);
                        segment.title = `${group.name} ${formatBytesForUi(group.bytes)}`;
                        storageUsageBar.appendChild(segment);
                    });
                    storageUsageBar.setAttribute('aria-label', groups.length
                        ? `应用数据已使用 ${formatBytesForUi(total)}，${groups.map((group) => `${group.name} ${formatBytesForUi(group.bytes)}`).join('，')}`
                        : '当前没有可统计的应用数据');
                }
                if (storageUsageLegend) {
                    storageUsageLegend.replaceChildren();
                    groups.forEach((group) => {
                        const item = document.createElement('span');
                        const dot = document.createElement('i');
                        const label = document.createElement('span');
                        item.className = 'data-storage-legend-item';
                        dot.className = 'data-storage-color-dot';
                        dot.style.backgroundColor = getStorageCategoryColor(group.name);
                        label.textContent = `${group.name} ${formatBytesForUi(group.bytes)}`;
                        item.append(dot, label);
                        storageUsageLegend.appendChild(item);
                    });
                }
                if (storageCategoryList) {
                    storageCategoryList.replaceChildren();
                    if (!groups.length) {
                        const empty = document.createElement('div');
                        empty.className = 'storage-category-empty';
                        empty.textContent = '暂无可统计的应用数据';
                        storageCategoryList.appendChild(empty);
                        return;
                    }
                    groups.forEach((group) => {
                        const row = document.createElement('div');
                        const dot = document.createElement('span');
                        const copy = document.createElement('span');
                        const name = document.createElement('strong');
                        const detail = document.createElement('small');
                        const size = document.createElement('span');
                        const chevron = document.createElement('i');
                        row.className = 'storage-category-row';
                        row.setAttribute('role', 'listitem');
                        dot.className = 'storage-category-color-dot';
                        dot.style.backgroundColor = getStorageCategoryColor(group.name);
                        copy.className = 'storage-category-copy';
                        name.textContent = group.name;
                        detail.textContent = group.count > 0 ? `${group.count} 条记录` : '应用数据';
                        size.className = 'storage-category-size';
                        size.textContent = formatBytesForUi(group.bytes);
                        chevron.className = 'fas fa-chevron-right storage-category-chevron';
                        chevron.setAttribute('aria-hidden', 'true');
                        copy.append(name, detail);
                        row.append(dot, copy, size, chevron);
                        storageCategoryList.appendChild(row);
                    });
                }
            }

            async function refreshStorageHealth() {
                if (!window.appStorage?.getStorageHealth) return;
                const health = await window.appStorage.getStorageHealth();
                const statusLabels = {
                    initializing: '正在初始化',
                    saving: '保存中',
                    saved: '已保存',
                    error: '保存失败'
                };
                if (storageHealthStatus) storageHealthStatus.textContent = statusLabels[health.status] || '存储状态未知';
                if (storageHealthDot) {
                    storageHealthDot.classList.toggle('is-saved', health.status === 'saved');
                    storageHealthDot.classList.toggle('is-error', health.status === 'error');
                }
                if (storageHealthPersistence) {
                    storageHealthPersistence.textContent = `有效数据：${formatBytesForUi(health.breakdown?.logicalBytes)} · 持久存储：${health.persisted ? '已启用' : '浏览器未授予'}`;
                }
                if (storageHealthLastSave) {
                    storageHealthLastSave.textContent = `最后保存：${formatDateForUi(health.lastCommitAt)}`;
                }
                if (storageHealthWarning) {
                    const warning = health.lastError ? `错误：${health.lastError}` : '';
                    storageHealthWarning.textContent = warning;
                    storageHealthWarning.hidden = !warning;
                }
                if (storageRetryBtn) storageRetryBtn.hidden = health.status !== 'error';
                renderStorageUsage(health);
                if (storageHealthCompaction) {
                    const cleaned = health.lastCacheCleanup;
                    const compacted = health.lastCompaction;
                    storageHealthCompaction.textContent = cleaned?.clearedAt
                        ? `最近手动清理：${formatDateForUi(cleaned.clearedAt)}，预计释放 ${formatBytesForUi(cleaned.estimatedBytesFreed)}`
                        : compacted?.compactedAt
                            ? `最近自动优化：${formatDateForUi(compacted.compactedAt)}，预计释放 ${formatBytesForUi(compacted.estimatedBytesFreed)}`
                            : '尚未执行存储优化';
                }
                if (storageHealthImageCompression) {
                    const compressed = health.lastImageCompression;
                    storageHealthImageCompression.textContent = compressed?.compressedAt
                        ? `最近图片压缩：${formatDateForUi(compressed.compressedAt)}，压缩 ${Number(compressed.compressed) || 0} 张，释放 ${formatBytesForUi(compressed.bytesFreed)}`
                        : '尚未执行图片压缩';
                }
            }

            storageCleanCacheBtn?.addEventListener('click', async () => {
                if (!confirm('将先创建并校验安全影子数据库，再无损去重资源并重建主数据库。不会删除聊天、帖子、资料、登录状态或仍在使用的图片。优化期间请勿关闭页面，继续吗？')) return;
                setBusy(storageCleanCacheBtn, true);
                showOperation('正在安全优化存储...');
                try {
                    const result = await window.appStorage.optimizeStorage({ progressCallback: updateOperation });
                    hideOperation();
                    const released = formatBytesForUi(result.estimatedBytesFreed);
                    showToast(`存储优化完成，浏览器报告已释放 ${released}`);
                } catch (error) {
                    console.error('Storage optimization failed:', error);
                    hideOperation();
                    showToast(error?.message || '存储优化中止，原数据仍被保留');
                } finally {
                    setBusy(storageCleanCacheBtn, false);
                    await refreshStorageHealth();
                }
            });

            storageCompressImagesBtn?.addEventListener('click', async () => {
                setBusy(storageCompressImagesBtn, true);
                showOperation('正在扫描图片资源...');
                try {
                    const summary = await window.appStorage.inspectImageCompression({
                        scope: 'all',
                        profile: 'balanced'
                    });
                    hideOperation();
                    if (!summary.eligible) {
                        showToast('图片已经足够精简');
                        return;
                    }
                    const confirmed = confirm(
                        `找到 ${summary.eligible} 张可压缩图片，当前共 ${formatBytesForUi(summary.bytes)}。\n\n`
                        + '将按图片用途限制尺寸，并以约 82% 质量转换为 WebP；只有明显变小的图片才会替换。GIF、SVG、音频、字体和内置素材不会处理。\n\n'
                        + '压缩不可恢复，重要数据建议先导出备份。继续吗？'
                    );
                    if (!confirmed) return;
                    showOperation('正在准备压缩图片...');
                    const result = await window.appStorage.compressImageAssets({
                        scope: 'all',
                        profile: 'balanced',
                        progressCallback: updateOperation
                    });
                    hideOperation();
                    showToast(
                        `图片压缩完成：压缩 ${result.compressed} 张，跳过 ${result.skipped} 张`
                        + `${result.failed ? `，失败 ${result.failed} 张` : ''}，`
                        + `${formatBytesForUi(result.bytesBefore)} → ${formatBytesForUi(result.bytesAfter)}，`
                        + `释放 ${formatBytesForUi(result.bytesFreed)}`
                    );
                } catch (error) {
                    console.error('Image compression failed:', error);
                    hideOperation();
                    showToast(error?.message || '图片压缩中止，原图片仍被保留');
                } finally {
                    setBusy(storageCompressImagesBtn, false);
                    await refreshStorageHealth();
                }
            });

            storageRetryBtn?.addEventListener('click', async () => {
                storageRetryBtn.disabled = true;
                try {
                    const saved = await window.appStorage.flushPendingWrites();
                    showToast(saved ? '待保存数据已完成写入' : '仍有数据保存失败');
                } finally {
                    storageRetryBtn.disabled = false;
                    await refreshStorageHealth();
                }
            });

            let storageRefreshTimer = null;
            const isDataManagementOpen = () => !!dataManagementSheet && (
                dataManagementSheet.classList.contains('active') ||
                dataManagementSheet.style.display === 'flex'
            );
            window.appStorage?.subscribe?.(() => {
                if (!isDataManagementOpen()) return;
                clearTimeout(storageRefreshTimer);
                storageRefreshTimer = setTimeout(() => refreshStorageHealth(), 180);
            });
            dataManagementBtn?.addEventListener('click', () => setTimeout(() => refreshStorageHealth(), 0));

            function showOperation(text) {
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.className = 'data-operation-overlay';
                    overlay.innerHTML = `
                        <div class="data-operation-card">
                            <i class="fas fa-spinner fa-spin data-operation-spinner"></i>
                            <div class="data-operation-text"></div>
                            <div class="data-operation-progress"><div></div></div>
                        </div>
                    `;
                    overlayText = overlay.querySelector('.data-operation-text');
                    overlayProgress = overlay.querySelector('.data-operation-progress > div');
                    document.body.appendChild(overlay);
                }
                overlayText.textContent = text || '处理中...';
                overlayProgress.style.width = '0%';
                overlay.style.display = 'flex';
            }

            function updateOperation(progressData = {}) {
                if (overlayText) overlayText.textContent = progressData.message || '处理中...';
                if (overlayProgress) {
                    const progress = Math.max(0, Math.min(100, Number(progressData.progress) || 0));
                    overlayProgress.style.width = `${progress}%`;
                }
            }

            function hideOperation() {
                if (overlay) overlay.style.display = 'none';
            }

            function updatePreview(file, summary) {
                if (!importPreview) return;
                importPreview.style.display = 'block';
                if (importFileName) importFileName.textContent = file?.name || '未命名备份';
                if (importVersion) importVersion.textContent = `v${summary.schemaVersion || '-'}`;
                if (importRecords) importRecords.textContent = String(summary.recordCount || 0);
                if (importAssets) importAssets.textContent = String(summary.assetCount || 0);
                if (importSize) importSize.textContent = formatBytesForUi(summary.approximateBytes || file?.size || 0);
            }

            function resetPreview() {
                selectedImportPayload = null;
                selectedImportFile = null;
                if (importPreview) importPreview.style.display = 'none';
            }

            if (exportDataBtn) {
                exportDataBtn.addEventListener('click', async (e) => {
                    stopLegacy(e);
                    try {
                        setBusy(exportDataBtn, true);
                        showOperation('正在准备导出数据...');
                        const blob = await window.appStorage.exportAllData(updateOperation);
                        updateOperation({ message: '准备下载...', progress: 99 });
                        hideOperation();
                        const result = await window.u2ExportFile({
                            blob,
                            fileName: `u2phone_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`,
                            title: 'U2 完整数据备份'
                        });
                        if (result === 'shared' || result === 'downloaded') showToast('数据导出成功');
                        else if (result === 'failed') showToast('导出失败，请重试');
                    } catch (err) {
                        console.error('Export failed:', err);
                        hideOperation();
                        showToast('导出失败，请查看控制台');
                    } finally {
                        setBusy(exportDataBtn, false);
                    }
                }, true);
            }

            if (importDataBtn && importDataFile) {
                importDataBtn.addEventListener('click', (e) => {
                    stopLegacy(e);
                    if (!selectedImportPayload || !selectedImportFile) {
                        importDataFile.click();
                        return;
                    }

                    if (!confirm(`将用「${selectedImportFile.name}」完整替换当前手机里的应用数据和配置。此操作不可撤销，确定继续？`)) {
                        return;
                    }

                    (async () => {
                        try {
                            setBusy(importDataBtn, true);
                            showOperation('正在导入备份...');
                            const importReport = await window.appStorage.importAllData(selectedImportPayload, updateOperation);
                            const stickerReport = importReport?.stickers;
                            const skippedStickers = Math.max(0, Number(stickerReport?.skippedItems) || 0);
                            const resultMessage = skippedStickers > 0
                                ? `导入成功，已跳过 ${skippedStickers} 张无法恢复的表情，正在重启...`
                                : '导入成功，正在重启...';
                            updateOperation({ message: resultMessage, progress: 100 });
                            setTimeout(() => window.location.reload(), 1200);
                        } catch (err) {
                            console.error('Import failed:', err);
                            hideOperation();
                            showToast(err?.message || '导入失败，当前数据未替换');
                            setBusy(importDataBtn, false);
                        }
                    })();
                }, true);

                importDataFile.addEventListener('change', async (e) => {
                    e.stopImmediatePropagation();
                    const file = e.target.files[0];
                    if (!file) return;

                    try {
                        setBusy(importDataBtn, true);
                        showOperation('正在读取备份文件...');
                        const text = await readFileText(file);
                        updateOperation({ message: '正在校验备份...', progress: 30 });
                        const payload = JSON.parse(text);
                        const summary = window.appStorage.inspectBackupPayload(payload);
                        selectedImportPayload = payload;
                        selectedImportFile = file;
                        updatePreview(file, summary);
                        hideOperation();
                        showToast('备份已校验，请再次点击导入');
                    } catch (err) {
                        console.error('Import preview failed:', err);
                        resetPreview();
                        hideOperation();
                        showToast(err?.message || '文件格式错误或备份已损坏');
                    } finally {
                        setBusy(importDataBtn, false);
                        e.target.value = '';
                    }
                }, true);
            }

            if (clearDataBtn) {
                clearDataBtn.addEventListener('click', async (e) => {
                    stopLegacy(e);
                    if (!confirm('确定清空所有应用数据和配置吗？此操作不可恢复，系统将重启到默认状态。')) return;
                    try {
                        setBusy(clearDataBtn, true);
                        showOperation('正在清空应用数据...');
                        await window.appStorage.clearAllPersistentData();
                        updateOperation({ message: '已清空，正在重启...', progress: 100 });
                        setTimeout(() => window.location.reload(), 1200);
                    } catch (err) {
                        console.error('Clear data failed:', err);
                        hideOperation();
                        showToast('清空数据失败');
                        setBusy(clearDataBtn, false);
                    }
                }, true);
            }
        })();
    });

})();
