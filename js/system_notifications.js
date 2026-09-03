// Real browser/system notifications for incoming app messages.
(function () {
    const STORAGE_KEY = 'u2_systemNotificationSettings';
    const SOUND_ASSET_ID = 'u2_system_notification_sound';

    const defaults = {
        enabled: false,
        permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
        soundAssetId: '',
        soundFileName: '',
        soundMimeType: '',
        soundDataUrl: ''
    };

    let settings = normalize(loadSettings());
    let storageHydrated = false;
    let activeSound = null;

    function normalize(value) {
        const safe = value && typeof value === 'object' ? value : {};
        const permission = getPermission();
        return {
            enabled: !!safe.enabled && permission === 'granted',
            permission,
            soundAssetId: typeof safe.soundAssetId === 'string' ? safe.soundAssetId : '',
            soundFileName: typeof safe.soundFileName === 'string' ? safe.soundFileName.slice(0, 180) : '',
            soundMimeType: typeof safe.soundMimeType === 'string' ? safe.soundMimeType.slice(0, 100) : '',
            soundDataUrl: typeof safe.soundDataUrl === 'string' && /^data:(?:audio\/|application\/octet-stream)/i.test(safe.soundDataUrl)
                ? safe.soundDataUrl
                : ''
        };
    }

    function getSettingsSnapshot(extra = {}) {
        return {
            enabled: !!settings.enabled,
            permission: settings.permission,
            soundAssetId: settings.soundAssetId,
            soundFileName: settings.soundFileName,
            soundMimeType: settings.soundMimeType,
            hasCustomSound: !!(settings.soundAssetId || settings.soundDataUrl),
            ...extra
        };
    }

    function getPermission() {
        if (typeof Notification === 'undefined') return 'unsupported';
        return Notification.permission;
    }

    function loadSettings() {
        try {
            if (window.StorageManager && typeof window.StorageManager.load === 'function') {
                return window.StorageManager.load(STORAGE_KEY, defaults);
            }

            return defaults;
        } catch (error) {
            console.warn('[system_notifications] Failed to load settings:', error);
            return defaults;
        }
    }

    async function saveSettings() {
        try {
            if (window.appStorage && typeof window.appStorage.saveLegacyKey === 'function') {
                await window.appStorage.saveLegacyKey(STORAGE_KEY, settings);
                return true;
            }

            if (window.StorageManager && typeof window.StorageManager.save === 'function') {
                return window.StorageManager.save(STORAGE_KEY, settings) !== false;
            }
        } catch (error) {
            console.warn('[system_notifications] Failed to save settings:', error);
        }
        return false;
    }

    function notifySettingsChanged(reason) {
        window.dispatchEvent(new CustomEvent('u2:system-notification-settings-changed', {
            detail: getSettingsSnapshot({ reason })
        }));
    }

    async function hydrateSettingsFromStorage() {
        if (storageHydrated) return { ...settings };
        storageHydrated = true;

        const loaded = loadSettings();
        const normalized = normalize(loaded);
        const needsReconcile = !!loaded?.enabled !== normalized.enabled
            || loaded?.permission !== normalized.permission;
        settings = normalized;
        if (needsReconcile) await saveSettings();
        notifySettingsChanged('storage-ready');
        return getSettingsSnapshot();
    }

    function getSettings() {
        const permission = getPermission();
        const shouldDisable = settings.enabled && permission !== 'granted';
        const permissionChanged = settings.permission !== permission;
        settings.permission = permission;
        if (shouldDisable) settings.enabled = false;
        if (shouldDisable || permissionChanged) {
            void saveSettings();
            notifySettingsChanged('permission');
        }
        return getSettingsSnapshot();
    }

    async function updateSettings(nextSettings = {}) {
        const wantsEnabled = !!nextSettings.enabled;

        if (getPermission() === 'unsupported') {
            settings.enabled = false;
            settings.permission = 'unsupported';
            await saveSettings();
            notifySettingsChanged('settings');
            return getSettingsSnapshot({ unsupported: true });
        }

        let permission = getPermission();
        if (wantsEnabled && permission === 'default') {
            try {
                permission = await Notification.requestPermission();
            } catch (error) {
                console.warn('[system_notifications] Failed to request permission:', error);
                permission = getPermission();
            }
        }

        settings.enabled = wantsEnabled && permission === 'granted';
        settings.permission = permission;
        if (!settings.enabled) stopNotificationSound();
        await saveSettings();
        notifySettingsChanged('settings');
        return getSettingsSnapshot();
    }

    async function setCustomSound(sound = {}) {
        const dataUrl = typeof sound.dataUrl === 'string' ? sound.dataUrl : '';
        if (!/^data:(?:audio\/|application\/octet-stream)/i.test(dataUrl)) {
            throw new TypeError('Invalid audio data URL');
        }

        const fileName = String(sound.fileName || '自定义提示音').slice(0, 180);
        const mimeType = String(sound.mimeType || dataUrl.slice(5, dataUrl.indexOf(';')) || 'audio/*').slice(0, 100);
        let soundAssetId = '';
        let soundDataUrl = dataUrl;

        if (window.appStorage && typeof window.appStorage.saveAssetFromDataUrl === 'function') {
            soundAssetId = await window.appStorage.saveAssetFromDataUrl(SOUND_ASSET_ID, dataUrl, {
                ownerType: 'system_notification',
                ownerId: 'global',
                field: 'sound',
                mimeType
            });
            soundDataUrl = '';
        }

        stopNotificationSound();
        settings.soundAssetId = soundAssetId || '';
        settings.soundFileName = fileName;
        settings.soundMimeType = mimeType;
        settings.soundDataUrl = soundDataUrl;
        await saveSettings();
        notifySettingsChanged('sound');
        return getSettingsSnapshot();
    }

    async function clearCustomSound() {
        const assetId = settings.soundAssetId;
        stopNotificationSound();
        settings.soundAssetId = '';
        settings.soundFileName = '';
        settings.soundMimeType = '';
        settings.soundDataUrl = '';
        await saveSettings();

        if (assetId && window.appStorage && typeof window.appStorage.deleteAsset === 'function') {
            try {
                await window.appStorage.deleteAsset(assetId);
            } catch (error) {
                console.warn('[system_notifications] Failed to delete custom sound asset:', error);
            }
        }

        notifySettingsChanged('sound');
        return getSettingsSnapshot();
    }

    async function resolveCustomSoundUrl() {
        if (settings.soundAssetId && window.appStorage && typeof window.appStorage.getAssetUrl === 'function') {
            return window.appStorage.getAssetUrl(settings.soundAssetId);
        }
        return settings.soundDataUrl || '';
    }

    function stopNotificationSound() {
        if (!activeSound) return;
        try {
            activeSound.pause();
            activeSound.currentTime = 0;
        } catch (error) {}
        activeSound = null;
    }

    async function playNotificationSound() {
        if (!(settings.soundAssetId || settings.soundDataUrl) || typeof window.Audio !== 'function') return false;

        try {
            const soundUrl = await resolveCustomSoundUrl();
            if (!soundUrl) return false;
            stopNotificationSound();
            activeSound = new window.Audio(soundUrl);
            activeSound.preload = 'auto';
            activeSound.playsInline = true;
            activeSound.addEventListener?.('ended', () => {
                activeSound = null;
            }, { once: true });
            await activeSound.play();
            return true;
        } catch (error) {
            console.warn('[system_notifications] Failed to play custom sound:', error);
            return false;
        }
    }

    function resolveTitle(payload = {}) {
        const friend = payload.friend || {};
        const message = payload.message || {};
        return message.speaker || message.senderName || friend.nickname || friend.realName || friend.realname || friend.name || 'iMessage';
    }

    function resolveBody(payload = {}) {
        const message = payload.message || {};
        const preview = window.imApp?.getFriendMessagePreview
            ? window.imApp.getFriendMessagePreview(message)
            : (message.content || message.text || message.message || '');
        return String(preview || '新消息').replace(/\s+/g, ' ').trim().slice(0, 180);
    }

    function notifyIncomingMessage(payload = {}) {
        const current = getSettings();
        if (!current.enabled || current.permission !== 'granted') return false;

        const friend = payload.friend || {};
        const title = resolveTitle(payload);
        const body = resolveBody(payload);
        const tag = payload.message?.id ? `imessage-${payload.message.id}` : `imessage-${friend.id || Date.now()}`;
        const options = {
            body,
            tag,
            renotify: true,
            silent: !!current.hasCustomSound,
            icon: friend.avatarUrl || 'assets/moren-thumb.jpg',
            badge: 'assets/moren-thumb.jpg',
            data: {
                app: 'imessage',
                friendId: friend.id || null,
                messageId: payload.message?.id || null
            }
        };

        try {
            if (current.hasCustomSound) void playNotificationSound();
            const notification = new Notification(title, options);
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
            return true;
        } catch (error) {
            console.warn('[system_notifications] Failed to show notification:', error);
            return false;
        }
    }

    window.u2SystemNotifications = {
        getSettings,
        updateSettings,
        setCustomSound,
        clearCustomSound,
        playNotificationSound,
        stopNotificationSound,
        notifyIncomingMessage
    };

    window.addEventListener('u2-storage-ready', hydrateSettingsFromStorage, { once: true });

    if (window.appStorage?.ready && typeof window.appStorage.ready.then === 'function') {
        window.appStorage.ready.then(() => {
            if (!storageHydrated) return hydrateSettingsFromStorage();
            return undefined;
        }).catch((error) => {
            console.warn('[system_notifications] Storage hydration failed:', error);
        });
    }
})();
