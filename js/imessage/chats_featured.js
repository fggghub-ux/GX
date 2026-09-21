// Decorative featured images for the Chats list. They are not pinned contacts.
(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    const entries = [
        {
            id: 'tearsorg',
            defaultSrc: 'assets/imessage/chats-featured-tearsorg.jpg',
            storageKey: 'imessage_chats_featured_tearsorg'
        },
        {
            id: 'tiamo',
            defaultSrc: 'assets/imessage/chats-featured-tiamo.jpg',
            storageKey: 'imessage_chats_featured_tiamo'
        }
    ];

    function setEntrySource(entry, source) {
        const image = document.querySelector(`[data-chats-featured-image="${entry.id}"]`);
        const shadow = document.querySelector(`[data-chats-featured-shadow="${entry.id}"]`);
        if (image) image.src = source;
        if (shadow) shadow.src = source;
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
        if (!button || !input) return;

        const saved = window.appStorage?.loadLegacyKey(entry.storageKey, null);
        setEntrySource(
            entry,
            typeof saved === 'string' && saved.startsWith('data:image/') ? saved : entry.defaultSrc
        );

        // Keep the picker call synchronous so iOS presents the native photo menu.
        button.addEventListener('click', () => input.click());
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
});
