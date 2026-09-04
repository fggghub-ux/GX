// ==========================================
// TIKTOK: 2. CORE SYSTEM, STATE & NAVIGATION
// ==========================================

function createDefaultTkState() {
    return {
        profile: {
            name: 'User',
            handle: 'user',
            avatar: null,
            status: 'Thinking...',
            bio: 'Click to add a bio',
            persona: '',
            following: 0,
            followers: 0,
            likes: 0,
            posts: [],
            visitors: []
        },
        activity: {
            newFollowers: 'No new followers yet',
            likesSaves: 'Interactions',
            commentsMentions: 'Interactions',
            followers: [],
            likes: [],
            saves: [],
            comments: []
        },
        settings: {
            boundWorldBookIds: []
        },
        chars: [],
        videos: [
            {
                id: 'vegartatelier',
                authorId: 'vegartatelier',
                authorName: 'VEGART ATELIER',
                desc: 'Aurelia Forest House is designed as an ultra-luxury brutalist villa concept lost in nature but losing nothing from its architectural character.#ArchitecturalConcept #ForestHouse',
                sceneText: 'Pale limestone surfaces, greige mineral concrete masses and warm travertine terraces create a calmer, more natural and more timeless luxury language within the dense wood texture. Brutalism is not harsh and cold here. On the contrary, it becomes more refined with the shadow of the forest, texture of the stone and soft light of the sunset.',
                likes: 143119,
                commentsCount: 1218,
                shares: 41280,
                isLiked: false,
                comments: [
                    { authorName: 'lewishartlily', text: 'My dream home in another life', likes: 733 },
                    { authorName: 'ali_ibo89', text: 'This,a wife and 4 kids,this is the final goal', likes: 237 }
                ]
            },
            {
                id: 'pilotluana',
                authorId: 'pilotluana',
                authorName: 'FRED',
                desc: 'If your business travels with you, your finances should too.#FlexGlobal #FlexElite #FlexPartner',
                sceneText: 'Now expanding across 170 countries and 37 currencies, it gives founders and business owners an easier way to manage expenses and operate internationally.And for those looking for an even more premium experience, Flex Elite takes it one step further.',
                likes: 22157,
                commentsCount: 179,
                shares: 5915,
                isLiked: false,
                comments: [
                    { authorName: 'lucyinthesskyy', text: 'Wow!!So dreamyyy', likes: 157 },
                    { authorName: 'hutravelstheworld', text: 'I need to try', likes: 44 }
                ]
            }
        ],
        dms: []
    };
}

function normalizeTkState(rawState = {}) {
    const defaults = createDefaultTkState();
    const safeState = rawState && typeof rawState === 'object' ? rawState : {};
    const imFriends = typeof window.getImFriends === 'function'
        ? window.getImFriends()
        : (Array.isArray(window.imData?.friends) ? window.imData.friends : []);
    const isLinkedImFriend = (char = {}) => {
        if (!Array.isArray(imFriends) || imFriends.length === 0) return false;
        return imFriends.some(friend => {
            if (!friend || friend.isOfficial || friend.type === 'official') return false;
            return String(friend.id) === String(char.imCharId || char.id)
                || String(friend.nickname || '') === String(char.name || '')
                || String(friend.realName || '') === String(char.name || '');
        });
    };
    const chars = Array.isArray(safeState.chars)
        ? safeState.chars.map(char => ({
            ...char,
            isFollowed: Boolean(char.isFollowed),
            isFollower: Boolean(char.isFollower || (char.isFollowed && isLinkedImFriend(char)))
        }))
        : defaults.chars;

    return {
        ...defaults,
        ...safeState,
        profile: {
            ...defaults.profile,
            ...(safeState.profile && typeof safeState.profile === 'object' ? safeState.profile : {})
        },
        activity: {
            ...defaults.activity,
            ...(safeState.activity && typeof safeState.activity === 'object' ? safeState.activity : {}),
            followers: Array.isArray(safeState.activity?.followers) ? safeState.activity.followers : [],
            likes: Array.isArray(safeState.activity?.likes) ? safeState.activity.likes : [],
            saves: Array.isArray(safeState.activity?.saves) ? safeState.activity.saves : [],
            comments: Array.isArray(safeState.activity?.comments) ? safeState.activity.comments : []
        },
        settings: {
            ...defaults.settings,
            ...(safeState.settings && typeof safeState.settings === 'object' ? safeState.settings : {}),
            boundWorldBookIds: Array.isArray(safeState.settings?.boundWorldBookIds)
                ? safeState.settings.boundWorldBookIds.filter(Boolean)
                : []
        },
        chars,
        videos: Array.isArray(safeState.videos) && safeState.videos.length > 0 ? safeState.videos : defaults.videos,
        dms: Array.isArray(safeState.dms) ? safeState.dms : defaults.dms
    };
}

function loadTkStateFromStore() {
    const raw = typeof window.getAppState === 'function' ? window.getAppState('tiktok') : null;
    const normalized = normalizeTkState(raw);

    if (window.userState) {
        if (!normalized.profile.name || normalized.profile.name === 'User') {
            normalized.profile.name = window.userState.name || 'User';
        }
        if (!normalized.profile.avatar && window.userState.avatarUrl) {
            normalized.profile.avatar = window.userState.avatarUrl;
        }
    }

    return normalized;
}

const tkState = loadTkStateFromStore();

window.tkState = tkState;

function persistTkState() {
    const nextState = normalizeTkState(tkState);

    if (typeof window.setAppState === 'function') {
        window.setAppState('tiktok', nextState);
        return;
    }

    if (window.saveGlobalData) {
        window.saveGlobalData();
    }
}

window.tkGetChar = function(charId) {
    return tkState.chars.find(c => c.id === charId);
};

window.tkSaveChar = function(charData) {
    const existing = tkState.chars.find(c => c.id === charData.id);
    if (existing) {
        Object.assign(existing, {
            isFollowed: Boolean(existing.isFollowed),
            isFollower: Boolean(existing.isFollower),
            ...charData
        });
    } else {
        tkState.chars.push({
            isFollowed: false,
            isFollower: false,
            ...charData
        });
    }
    persistTkState();
};

window.tkPersistState = persistTkState;
window.tkLoadStateFromStore = function() {
    const nextState = loadTkStateFromStore();
    Object.assign(tkState, nextState);
    return tkState;
};

function refreshTkUiAfterHydration() {
    const tkView = document.getElementById('tiktok-view');
    if (!tkView || !tkView.classList.contains('active')) return;
    if (window.tkRenderHome) window.tkRenderHome();
    if (window.tkRenderChat) window.tkRenderChat();
    if (window.tkRenderProfile) window.tkRenderProfile();
}

if (window.globalDataReadyPromise && typeof window.globalDataReadyPromise.then === 'function') {
    window.tkDataReadyPromise = window.globalDataReadyPromise.then(() => {
        window.tkLoadStateFromStore();
        refreshTkUiAfterHydration();
        return true;
    }).catch((error) => {
        console.warn('TikTok global data recovery failed:', error);
        return false;
    });
} else {
    window.tkDataReadyPromise = Promise.resolve(true);
}

(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    // UI Elements
    const tkAppBtn = document.getElementById('app-tiktok-btn');
    const tkView = document.getElementById('tiktok-view');
    const homeBar = document.getElementById('home-bar');

    // Nav Items
    const tkNavItems = document.querySelectorAll('.tk-bottom-nav .tk-nav-item[data-target]');
    const tkTabContents = document.querySelectorAll('.tk-tab-content');

    // Render only the visible tab when the app opens. Hidden tabs render lazily
    // when the user switches to them.
    function initTikTok() {
        const targetId = tkNavItems[currentTabIndex]?.getAttribute('data-target');
        if (targetId === 'tk-chat-tab' && window.tkRenderChat) {
            window.tkRenderChat();
        } else if (targetId === 'tk-profile-tab' && window.tkRenderProfile) {
            window.tkRenderProfile();
        } else if (window.tkRenderHome) {
            window.tkRenderHome();
        }
    }

    // Open App
    if (tkAppBtn && tkView) {
        tkAppBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.isJiggleMode) return;
            
            try {
                initTikTok();
            } catch(err) {
                console.error("TikTok Init Error:", err);
            }
            
            tkView.classList.add('active');
        });
    }

    // Close App
    const closeTkApp = () => {
        window.closeView(tkView);
        window.closeView(document.getElementById('tk-video-detail-sheet'));
        window.closeView(document.getElementById('tk-edit-profile-sheet'));
        window.closeView(document.getElementById('tk-edit-char-sheet'));
        window.closeView(document.getElementById('tk-import-char-sheet'));
        window.closeView(document.getElementById('tk-share-sheet'));
        document.getElementById('tk-sub-profile-view').classList.remove('active');
    };

    // Top Bar Back Buttons
    const homeBackBtn = document.getElementById('tk-home-back-btn');
    if (homeBackBtn) homeBackBtn.addEventListener('click', closeTkApp);

    // Bottom Navigation Switching & Swipe Logic
    const tkNavIndicator = document.querySelector('.tk-nav-indicator');
    const mainContent = document.querySelector('.tk-main-content');
    let currentTabIndex = 0;

    function switchTab(index) {
        if (index < 0 || index >= tkNavItems.length) return;
        currentTabIndex = index;

        // Update Nav Items
        tkNavItems.forEach((nav, i) => {
            if (i === index) nav.classList.add('active');
            else nav.classList.remove('active');
        });

        // Move indicator
        if (tkNavIndicator) {
            // Get actual position and width of the clicked nav item
            const targetItem = tkNavItems[index];
            const navRect = targetItem.parentElement.getBoundingClientRect();
            const itemRect = targetItem.getBoundingClientRect();
            
            // Calculate relative left position
            const leftPos = itemRect.left - navRect.left;
            
            tkNavIndicator.style.width = `${itemRect.width}px`;
            tkNavIndicator.style.left = `${leftPos}px`;
            tkNavIndicator.style.transform = 'none'; // Clear previous transform logic
        }

        // Slide Tabs
        tkTabContents.forEach((tab, i) => {
            tab.style.transform = `translateX(-${index * 100}%)`;
            if (i === index) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Refresh specific tab data if needed
        const targetId = tkNavItems[index].getAttribute('data-target');
        if (targetId === 'tk-home-tab' && window.tkRenderHome) {
            window.tkRenderHome();
        } else if (targetId === 'tk-chat-tab' && window.tkRenderChat) {
            window.tkRenderChat();
        } else if (targetId === 'tk-profile-tab' && window.tkRenderProfile) {
            window.tkRenderProfile();
        }
    }

    tkNavItems.forEach((item, index) => {
        item.addEventListener('click', () => {
            switchTab(index);
        });
    });

    // Swipe gestures
    let startX = 0;
    let isSwiping = false;

    if (mainContent) {
        mainContent.addEventListener('touchstart', (e) => {
            // Ignore if touching a horizontally scrollable element
            if (e.target.closest('.tk-following-bar')) return;
            startX = e.touches[0].clientX;
            isSwiping = true;
        }, { passive: true });

        mainContent.addEventListener('touchmove', (e) => {
            if (!isSwiping) return;
            // Prevent default to stop native scrolling while swiping tabs horizontally
            // But we need vertical scroll to work on feed/profile, so we don't preventDefault here simply.
        }, { passive: true });

        mainContent.addEventListener('touchend', (e) => {
            if (!isSwiping) return;
            isSwiping = false;
            let endX = e.changedTouches[0].clientX;
            let diffX = startX - endX;

            if (Math.abs(diffX) > 50) { // Threshold for swipe
                if (diffX > 0 && currentTabIndex < tkNavItems.length - 1) {
                    // Swipe Left -> Next Tab
                    switchTab(currentTabIndex + 1);
                } else if (diffX < 0 && currentTabIndex > 0) {
                    // Swipe Right -> Prev Tab
                    switchTab(currentTabIndex - 1);
                }
            }
        });
    }
    
    // Initialize
    switchTab(0);
});
