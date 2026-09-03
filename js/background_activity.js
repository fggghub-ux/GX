// U2 background activity manager.
// Best-effort PWA heartbeat. When enabled, it keeps a tiny looping audio session alive
// because mobile browsers usually preserve active audio more aggressively than timers.
(function () {
    const STORAGE_KEY = 'u2_backgroundActivitySettings';
    const MIN_INTERVAL_SECONDS = 1;
    const MAX_INTERVAL_SECONDS = 3600;

    const defaults = {
        enabled: false,
        intervalSeconds: 60,
        lastTickAt: 0
    };

    let settings = normalize(loadSettings());
    let timerId = null;
    let wakeLock = null;
    let keepAliveAudio = null;
    let keepAliveAudioUrl = '';
    let audioUnlockBound = false;
    let storageHydrated = false;

    function clampInterval(value) {
        const number = Number.parseInt(value, 10);
        if (!Number.isFinite(number)) return defaults.intervalSeconds;
        return Math.max(MIN_INTERVAL_SECONDS, Math.min(MAX_INTERVAL_SECONDS, number));
    }

    function normalize(value) {
        const safe = value && typeof value === 'object' ? value : {};
        return {
            enabled: !!safe.enabled,
            intervalSeconds: clampInterval(safe.intervalSeconds),
            lastTickAt: Number.isFinite(Number(safe.lastTickAt)) ? Number(safe.lastTickAt) : 0
        };
    }

    function loadSettings() {
        try {
            if (window.StorageManager && typeof window.StorageManager.load === 'function') {
                return window.StorageManager.load(STORAGE_KEY, defaults);
            }

            return defaults;
        } catch (error) {
            console.warn('[background_activity] Failed to load settings:', error);
            return defaults;
        }
    }

    function saveSettings() {
        try {
            if (window.StorageManager && typeof window.StorageManager.save === 'function') {
                window.StorageManager.save(STORAGE_KEY, settings);
                return;
            }

        } catch (error) {
            console.warn('[background_activity] Failed to save settings:', error);
        }
    }

    function notifySettingsChanged(reason) {
        window.dispatchEvent(new CustomEvent('u2:background-activity-settings-changed', {
            detail: { ...getSettings(), reason }
        }));
    }

    function hydrateSettingsFromStorage() {
        settings = normalize(loadSettings());
        storageHydrated = true;

        if (settings.enabled) start('storage-ready');
        else stop();

        notifySettingsChanged('storage-ready');
        return getSettings();
    }

    function clearTimer() {
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
    }

    async function releaseWakeLock() {
        if (!wakeLock) return;

        try {
            await wakeLock.release();
        } catch (error) {
            console.warn('[background_activity] Failed to release wake lock:', error);
        } finally {
            wakeLock = null;
        }
    }

    function createKeepAliveAudioUrl() {
        if (keepAliveAudioUrl) return keepAliveAudioUrl;

        const sampleRate = 8000;
        const durationSeconds = 1;
        const sampleCount = sampleRate * durationSeconds;
        const bytesPerSample = 2;
        const dataSize = sampleCount * bytesPerSample;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);
        let offset = 0;

        const writeString = (value) => {
            for (let index = 0; index < value.length; index += 1) {
                view.setUint8(offset + index, value.charCodeAt(index));
            }
            offset += value.length;
        };

        writeString('RIFF');
        view.setUint32(offset, 36 + dataSize, true); offset += 4;
        writeString('WAVE');
        writeString('fmt ');
        view.setUint32(offset, 16, true); offset += 4;
        view.setUint16(offset, 1, true); offset += 2;
        view.setUint16(offset, 1, true); offset += 2;
        view.setUint32(offset, sampleRate, true); offset += 4;
        view.setUint32(offset, sampleRate * bytesPerSample, true); offset += 4;
        view.setUint16(offset, bytesPerSample, true); offset += 2;
        view.setUint16(offset, 8 * bytesPerSample, true); offset += 2;
        writeString('data');
        view.setUint32(offset, dataSize, true); offset += 4;

        for (let index = 0; index < sampleCount; index += 1) {
            const sample = Math.sin((2 * Math.PI * 18 * index) / sampleRate) * 6;
            view.setInt16(offset, sample, true);
            offset += bytesPerSample;
        }

        if (location.protocol === 'file:') {
            const bytes = new Uint8Array(buffer);
            const chunkSize = 0x8000;
            let binary = '';

            for (let index = 0; index < bytes.length; index += chunkSize) {
                binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
            }

            keepAliveAudioUrl = `data:audio/wav;base64,${btoa(binary)}`;
        } else {
            keepAliveAudioUrl = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
        }

        return keepAliveAudioUrl;
    }

    function ensureKeepAliveAudio() {
        if (keepAliveAudio) return keepAliveAudio;

        keepAliveAudio = document.createElement('audio');
        keepAliveAudio.loop = true;
        keepAliveAudio.preload = 'auto';
        keepAliveAudio.playsInline = true;
        keepAliveAudio.volume = 1;
        keepAliveAudio.src = createKeepAliveAudioUrl();
        keepAliveAudio.setAttribute('aria-hidden', 'true');
        keepAliveAudio.setAttribute('webkit-playsinline', 'true');
        keepAliveAudio.style.position = 'fixed';
        keepAliveAudio.style.width = '1px';
        keepAliveAudio.style.height = '1px';
        keepAliveAudio.style.opacity = '0';
        keepAliveAudio.style.pointerEvents = 'none';
        keepAliveAudio.style.left = '-9999px';
        keepAliveAudio.style.top = '-9999px';

        const mount = () => {
            if (document.body && !keepAliveAudio.isConnected) {
                document.body.appendChild(keepAliveAudio);
            }
        };

        if (document.body) {
            mount();
        } else {
            document.addEventListener('DOMContentLoaded', mount, { once: true });
        }

        return keepAliveAudio;
    }

    function bindAudioUnlock() {
        if (audioUnlockBound) return;
        audioUnlockBound = true;

        ['pointerdown', 'touchstart', 'click', 'keydown'].forEach((eventName) => {
            document.addEventListener(eventName, handleAudioUnlock, {
                capture: true,
                passive: true
            });
        });
    }

    function unbindAudioUnlock() {
        if (!audioUnlockBound) return;
        audioUnlockBound = false;

        ['pointerdown', 'touchstart', 'click', 'keydown'].forEach((eventName) => {
            document.removeEventListener(eventName, handleAudioUnlock, true);
        });
    }

    function handleAudioUnlock() {
        if (settings.enabled) {
            startKeepAliveAudio('user-gesture');
        } else {
            unbindAudioUnlock();
        }
    }

    async function startKeepAliveAudio(reason = 'audio') {
        if (!settings.enabled) return false;

        const audio = ensureKeepAliveAudio();

        try {
            if (audio.paused || audio.ended) {
                await audio.play();
            }
            unbindAudioUnlock();
            window.dispatchEvent(new CustomEvent('u2:background-audio-active', {
                detail: { reason, activeAt: Date.now() }
            }));
            return true;
        } catch (error) {
            bindAudioUnlock();
            console.info('[background_activity] Audio keep-alive is waiting for a user gesture:', error);
            return false;
        }
    }

    function stopKeepAliveAudio() {
        unbindAudioUnlock();

        if (!keepAliveAudio) return;

        keepAliveAudio.pause();
        keepAliveAudio.currentTime = 0;
    }

    async function requestWakeLock() {
        if (!settings.enabled || document.hidden || wakeLock || !navigator.wakeLock?.request) {
            return;
        }

        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                wakeLock = null;
            });
        } catch (error) {
            wakeLock = null;
            console.info('[background_activity] Wake Lock is unavailable:', error);
        }
    }

    function dispatchTick(reason) {
        const now = Date.now();
        const previousTickAt = settings.lastTickAt || 0;
        settings.lastTickAt = now;
        saveSettings();

        window.dispatchEvent(new CustomEvent('u2:background-activity-tick', {
            detail: {
                reason,
                enabled: settings.enabled,
                intervalSeconds: settings.intervalSeconds,
                tickAt: now,
                previousTickAt,
                elapsedSeconds: previousTickAt ? Math.max(0, Math.round((now - previousTickAt) / 1000)) : 0
            }
        }));
    }

    function maybeCatchUpAfterHidden() {
        if (!settings.enabled || !settings.lastTickAt) return;

        const elapsedMs = Date.now() - settings.lastTickAt;
        if (elapsedMs >= settings.intervalSeconds * 1000) {
            dispatchTick('resume');
        }
    }

    function schedule() {
        clearTimer();

        if (!settings.enabled) {
            return;
        }

        timerId = setInterval(() => {
            dispatchTick('interval');
        }, settings.intervalSeconds * 1000);
    }

    function start(reason = 'start') {
        if (!settings.enabled) {
            stop();
            return;
        }

        if (!settings.lastTickAt) {
            dispatchTick(reason);
        } else {
            maybeCatchUpAfterHidden();
        }

        schedule();
        requestWakeLock();
        startKeepAliveAudio(reason);
    }

    function stop() {
        clearTimer();
        releaseWakeLock();
        stopKeepAliveAudio();
    }

    function updateSettings(nextSettings = {}) {
        settings = normalize({
            ...settings,
            ...nextSettings
        });
        saveSettings();

        if (settings.enabled) {
            start('settings');
        } else {
            stop();
        }

        notifySettingsChanged('settings');
        return getSettings();
    }

    function getSettings() {
        return { ...settings };
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            releaseWakeLock();
            schedule();
            startKeepAliveAudio('hidden');
            return;
        }

        start('visible');
    });

    window.addEventListener('pagehide', () => {
        clearTimer();
        releaseWakeLock();
        stopKeepAliveAudio();
    });

    window.addEventListener('pageshow', () => {
        start('pageshow');
    });

    window.u2BackgroundActivity = {
        getSettings,
        updateSettings,
        start,
        stop
    };

    window.addEventListener('u2-storage-ready', hydrateSettingsFromStorage, { once: true });

    if (window.appStorage?.ready && typeof window.appStorage.ready.then === 'function') {
        window.appStorage.ready.then(() => {
            if (!storageHydrated) hydrateSettingsFromStorage();
        }).catch((error) => {
            console.warn('[background_activity] Storage hydration failed:', error);
        });
    }

    if (settings.enabled) {
        start('boot');
    }
})();
