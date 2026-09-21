// Decorative featured images for the Chats list. They are not pinned contacts.
(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    const entries = [
        {
            id: 'tearsorg',
            defaultSrc: 'assets/imessage/chats-featured-tearsorg.jpg',
            storageKey: 'imessage_chats_featured_tearsorg',
            defaultStatus: 'Touch you',
            statusStorageKey: 'imessage_chats_featured_status_tearsorg'
        },
        {
            id: 'tiamo',
            defaultSrc: 'assets/imessage/chats-featured-tiamo.jpg',
            storageKey: 'imessage_chats_featured_tiamo',
            defaultStatus: "I'm so tired.",
            statusStorageKey: 'imessage_chats_featured_status_tiamo'
        }
    ];

    const featuredPage = document.querySelector('.chats-reference-page');
    const featuredSurface = document.getElementById('chats-list-surface');

    function syncPhoneScale() {
        if (!featuredPage || !featuredSurface) return;
        const surfaceWidth = featuredSurface.getBoundingClientRect().width;
        const isTabletLayout = surfaceWidth >= 700;
        const scale = isTabletLayout ? 1.05 : Math.min(1.05, Math.max(0.82, surfaceWidth / 410));
        featuredPage.style.setProperty('--chats-ui-scale', scale.toFixed(4));
    }
    window.imApp = window.imApp || {};
    window.imApp.syncChatsLayout = syncPhoneScale;

    function setEntrySource(entry, source) {
        const image = document.querySelector(`[data-chats-featured-image="${entry.id}"]`);
        const shadow = document.querySelector(`[data-chats-featured-shadow="${entry.id}"]`);
        if (image) image.src = source;
        if (shadow) shadow.src = source;
    }

    function setEntryStatus(entry, value) {
        const status = document.querySelector(`[data-chats-featured-status="${entry.id}"]`);
        if (!status) return;
        const normalizedValue = String(value == null ? '' : value).trim();
        status.textContent = normalizedValue;
        status.hidden = normalizedValue.length === 0;
    }

    function closeStatusModalStyle() {
        document.getElementById('custom-modal-overlay')?.classList.remove('im-chats-status-modal');
    }

    function openStatusEditor(entry) {
        const status = document.querySelector(`[data-chats-featured-status="${entry.id}"]`);
        if (!status) return;
        const currentValue = String(status.textContent || entry.defaultStatus).trim();

        if (typeof window.showCustomModal === 'function') {
            document.getElementById('custom-modal-overlay')?.classList.add('im-chats-status-modal');
            window.showCustomModal({
                title: 'STATUS',
                type: 'prompt',
                placeholder: 'Enter Your Current Status',
                defaultValue: currentValue,
                onConfirm: async value => {
                    const nextValue = String(value == null ? '' : value).trim();
                    setEntryStatus(entry, nextValue);
                    closeStatusModalStyle();
                    try {
                        await window.appStorage?.saveLegacyKey?.(entry.statusStorageKey, nextValue);
                    } catch (error) {
                        console.error(`Chats featured status update failed: ${entry.id}`, error);
                        window.showToast?.('Status could not be updated');
                    }
                },
                onCancel: closeStatusModalStyle
            });
            return;
        }

        const nextValue = window.prompt('Enter Your Current Status', currentValue);
        if (nextValue == null) return;
        const normalizedValue = String(nextValue).trim();
        setEntryStatus(entry, normalizedValue);
        window.appStorage?.saveLegacyKey?.(entry.statusStorageKey, normalizedValue);
    }

    async function encodeImage(file) {
        if (file.type && !file.type.startsWith('image/')) throw new Error('Not an image');

        const objectUrl = URL.createObjectURL(file);
        try {
            const selected = new Image();
            await new Promise((resolve, reject) => {
                selected.onload = resolve;
                selected.onerror = () => reject(new Error('Unsupported image'));
                selected.src = objectUrl;
            });

            const scale = Math.min(1, 1024 / Math.max(selected.naturalWidth, selected.naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(selected.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(selected.naturalHeight * scale));
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Image processing unavailable');
            context.drawImage(selected, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/jpeg', 0.9);
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    }

    entries.forEach(entry => {
        const button = document.querySelector(`[data-chats-featured="${entry.id}"]`);
        const input = document.getElementById(`chats-featured-${entry.id}-input`);
        const statusButton = document.querySelector(`[data-chats-featured-status="${entry.id}"]`);
        if (!button || !input) return;

        const saved = window.appStorage?.loadLegacyKey(entry.storageKey, null);
        setEntrySource(
            entry,
            typeof saved === 'string' && saved.startsWith('data:image/') ? saved : entry.defaultSrc
        );
        const savedStatus = window.appStorage?.loadLegacyKey(entry.statusStorageKey, null);
        setEntryStatus(entry, typeof savedStatus === 'string' ? savedStatus : entry.defaultStatus);

        // Keep the picker call synchronous so iOS presents the native photo menu.
        button.addEventListener('click', () => input.click());
        statusButton?.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            openStatusEditor(entry);
        });
        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            input.value = '';
            if (!file) return;

            button.disabled = true;
            try {
                const source = await encodeImage(file);
                if (!window.appStorage?.saveLegacyKey) throw new Error('Storage unavailable');
                await window.appStorage.saveLegacyKey(entry.storageKey, source);
                setEntrySource(entry, source);
            } catch (error) {
                console.error(`Chats featured image update failed: ${entry.id}`, error);
                window.showToast?.('Image could not be updated');
            } finally {
                button.disabled = false;
            }
        });
    });

    syncPhoneScale();
    window.addEventListener('resize', syncPhoneScale, { passive: true });
    window.visualViewport?.addEventListener('resize', syncPhoneScale, { passive: true });
    if (typeof ResizeObserver === 'function' && featuredSurface) {
        const resizeObserver = new ResizeObserver(syncPhoneScale);
        resizeObserver.observe(featuredSurface);
    }
});
