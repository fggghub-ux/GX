// UI Helper Functions for Modal and View Management

const UI = {
    views: {},
    overlays: {},
    inputs: {},
    lists: {}
};

/**
 * Open a view or bottom sheet overlay
 * @param {HTMLElement} viewEl 
 */
function openView(viewEl) {
    if (!viewEl) return;
    
    // Check if it's a bottom sheet overlay or standard app view
    if (viewEl.classList.contains('bottom-sheet-overlay')) {
        viewEl.classList.add('active');
        // Prevent body scrolling
        document.body.style.overflow = 'hidden';
    } else {
        viewEl.classList.add('active');
    }
}

/**
 * Close a view or bottom sheet overlay
 * @param {HTMLElement} viewEl 
 */
function closeView(viewEl) {
    if (!viewEl) return;
    
    if (viewEl.classList.contains('bottom-sheet-overlay')) {
        viewEl.classList.remove('active');
        // Restore body scrolling
        document.body.style.overflow = '';
    } else {
        viewEl.classList.remove('active');
    }
}

/**
 * Sync UI components based on state
 * (Placeholder function, can be expanded)
 */
function syncUIs() {
    // Implement global UI sync logic here
}

/**
 * Show a toast notification bubble
 * @param {string} message 
 */
function showToast(message) {
    let toast = document.getElementById('global-toast-bubble');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'global-toast-bubble';
        toast.className = 'toast-bubble';
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.classList.add('show');
    
    // Remove after 2.5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// Make sure close functions can be bound to sheet overlays when clicking outside
document.addEventListener('DOMContentLoaded', () => {
    // Close bottom sheets when clicking on the overlay background
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('bottom-sheet-overlay')) {
            closeView(e.target);
        }
    });
});

// --- iOS Style Banner Notification System ---
let notificationBanner = null;
let bannerTimeout = null;
let notificationQueue = [];
let isShowingNotification = false;

function processNotificationQueue() {
    if (isShowingNotification || notificationQueue.length === 0) return;

    isShowingNotification = true;
    const { friend, messageText } = notificationQueue.shift();

    const appContainer = document.querySelector('#app') || document.body;

    if (!notificationBanner) {
        notificationBanner = document.createElement('div');
        notificationBanner.id = 'ios-banner-notification';
        // Styling exactly like the uploaded image capsule, constrained to appContainer
        notificationBanner.style.position = 'absolute';
        notificationBanner.style.top = '10px'; // Starts slightly below top
        notificationBanner.style.left = '50%';
        notificationBanner.style.transform = 'translate(-50%, -150%)'; // Hidden initially
        notificationBanner.style.width = 'calc(100% - 32px)';
        notificationBanner.style.maxWidth = '360px'; // Keep it tight like a mobile banner
        notificationBanner.style.backgroundColor = '#ffffff';
        notificationBanner.style.borderRadius = '40px'; // Deep capsule pill shape
        notificationBanner.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,1)';
        notificationBanner.style.display = 'flex';
        notificationBanner.style.alignItems = 'center';
        notificationBanner.style.padding = '8px 16px 8px 8px'; // Asymmetric padding to match image (avatar left)
        notificationBanner.style.zIndex = '9999999'; // 极高层级，覆盖全屏应用
        notificationBanner.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.2)';
        notificationBanner.style.cursor = 'pointer';

        appContainer.appendChild(notificationBanner);

        // Global click handler to jump to chat
        notificationBanner.addEventListener('click', () => {
            hideBannerNotification(true);
            if (window.imApp && window.imApp.openChatTab && notificationBanner.currentFriend) {
                // 如果当前在别的应用全屏态，可以考虑退出全屏，这里依赖 openChatTab 的处理
                window.imApp.openChatTab(notificationBanner.currentFriend);
            }
        });
    }

    notificationBanner.currentFriend = friend;

    const avatar = friend.avatarUrl || 'https://picsum.photos/seed/char/100/100';
    const name = friend.nickname || friend.realName || 'Unknown';
    
    // Remove markdown or code blocks from preview
    let previewText = messageText.replace(/<[^>]*>?/gm, '').trim();
    if (previewText.length > 30) previewText = previewText.substring(0, 30) + '...';

    // Get current time
    const now = new Date();
    const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

    notificationBanner.innerHTML = `
        <img src="${avatar}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; flex-shrink: 0; ">
        <div style="flex: 1; min-width: 0; margin-left: 14px; display: flex; flex-direction: column; justify-content: center;">
            <div style="font-weight: 700; font-size: 15px; color: #1c1c1e; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
            <div style="font-size: 13px; color: #8e8e93; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${previewText}</div>
        </div>
        <div style="font-size: 12px; color: #8e8e93; font-weight: 500; margin-left: 10px; flex-shrink: 0;">
            ${timeStr}
        </div>
    `;

    if (bannerTimeout) clearTimeout(bannerTimeout);

    // Slide down
    requestAnimationFrame(() => {
        notificationBanner.style.transform = 'translate(-50%, max(env(safe-area-inset-top, 0px), 10px))';
    });

    // Slide up after 4 seconds
    bannerTimeout = setTimeout(() => {
        hideBannerInternal();
    }, 4000);
}

function hideBannerInternal() {
    if (notificationBanner) {
        notificationBanner.style.transform = 'translate(-50%, -150%)';
    }
    setTimeout(() => {
        isShowingNotification = false;
        processNotificationQueue();
    }, 400); // Wait for transition to finish
}

function showBannerNotification(friend, messageText) {
    notificationQueue.push({ friend, messageText });
    processNotificationQueue();
}

function hideBannerNotification(clearQueue = false) {
    if (clearQueue) {
        notificationQueue = [];
    }
    if (bannerTimeout) {
        clearTimeout(bannerTimeout);
    }
    hideBannerInternal();
}

// Expose globally
window.openView = openView;
window.closeView = closeView;
window.syncUIs = syncUIs;
window.showToast = showToast;
window.showBannerNotification = showBannerNotification;
window.hideBannerNotification = hideBannerNotification;
