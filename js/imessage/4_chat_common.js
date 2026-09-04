
// ==========================================
// IMESSAGE: 4_chat_common.js
// ==========================================
(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    const { apiConfig, userState } = window;
    window.imChat = window.imChat || {};
    const imChat = window.imChat;
    imChat.CHAT_IMAGE_PLACEHOLDER_URL = 'assets/imessage/chat-image-placeholder-512.jpg';
    const imageGenerationRuns = new Set();

function createMessageId(prefix = 'msg') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function ensureMessageId(msg, prefix = 'msg') {
        if (!msg || typeof msg !== 'object') return '';
        if (!msg.id) msg.id = window.imChat.createMessageId(prefix);
        return msg.id;
    }

    async function resolveAutoImageReferenceFace(friend, options = {}) {
        if (!friend
            || friend.type !== 'char'
            || (options.force !== true && friend.imagePromptConfig?.autoUseReferenceFace !== true)) {
            return '';
        }

        const assetId = String(friend.imageFaceReferenceAssetId || '').trim();
        if (assetId && typeof window.appStorage?.getAssetUrl === 'function') {
            const assetUrl = await window.appStorage.getAssetUrl(assetId).catch(() => '');
            if (assetUrl) return assetUrl;
        }

        const directUrl = String(friend.imageFaceReferenceUrl || '').trim();
        if (directUrl) return directUrl;
        throw new Error('自动锁脸已开启，但角色参考脸不可用，请重新上传参考脸后重试');
    }

    window.imChat.createMessageId = createMessageId;
    window.imChat.ensureMessageId = ensureMessageId;
    window.imChat.resolveAutoImageReferenceFace = resolveAutoImageReferenceFace;

    async function generateChatImage(prompt, targetFriend, options = {}) {
        const friendId = targetFriend?.id;
        const runKey = String(friendId ?? '').trim();
        if (!runKey) throw new Error('当前聊天状态已失效，请重新进入聊天');
        if (imageGenerationRuns.has(runKey)) throw new Error('这段聊天已有图片正在生成');
        if (!window.u2ImageGeneration?.generate) throw new Error('生图功能尚未加载，请刷新后重试');

        imageGenerationRuns.add(runKey);
        try {
            return await window.u2ImageGeneration.generate(String(prompt || '').trim(), {
                referenceImage: options.referenceImage || '',
                charAppearance: options.charAppearance || '',
                userAppearance: options.userAppearance || '',
                artistPrompt: options.artistPrompt || '',
                negativePrompt: options.negativePrompt || ''
            });
        } finally {
            imageGenerationRuns.delete(runKey);
        }
    }

    imChat.generateChatImage = generateChatImage;
    imChat.isChatImageGenerationRunning = (friendOrId) => imageGenerationRuns.has(
        String(friendOrId && typeof friendOrId === 'object' ? friendOrId.id : friendOrId)
    );

});
