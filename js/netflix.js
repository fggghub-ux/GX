/**
 * Netflix visual-novel app.
 * The movie catalog remains the entry shell; playback is a persistent AI story game.
 */

class NetflixApp {
    constructor() {
        this.core = window.NetflixGameCore;
        this.DEFAULT_CATALOG_VERSION = 'financial-crime-en-v1'; // 每次改默认文案就换一个新字符串
        this.view = document.getElementById('netflix-view');
        this.isOpen = false;
        this.activeTab = 'home';
        this.activeCatalogItem = null;
        this.setupDraft = null;
        this.availableCharacters = [];
        this.isBusy = false;
        this.isSearchBusy = false;
        this.saveModalMode = 'load';
        this.pendingRequestChoice = null;
        this.isTransitioning = false;
        this.customChoiceOpen = false;
        this.pendingRunPreview = null;
        this.mapTransform = { x: 0, y: 0, scale: 1 };
        this.mapPointers = new Map();
        this.mapGesture = null;
        this.mapEditMode = false;
        this.migratedLegacyState = false;
        if (!this.core || !this.view) return;
        this.state = this.loadState();
        this.init();
    }

    init() {
        this.renderStructure();
        this.cacheElements();
        this.bindEvents();
        this.renderHome();
        this.renderProfile();
        this.renderNav();
        if (this.migratedLegacyState) this.finishLegacyMigration();
    }

    createDefaultCatalog() {
        const make = (id, title, category, summary, seed, tags = []) => ({
            id,
            title,
            category,
            summary,
            tags,
            coverUrl: `https://picsum.photos/seed/${seed}/720/1080?grayscale`,
            cast: []
        });
        const items = [
            make('default-night-train', 'Vault Zero', 'Financial Crime', 'A private Swiss bank conducts its annual asset audit at midnight and discovers dozens of anonymous safety deposit boxes have simultaneously lost their records. No locks broken, no alarms triggered — every access trail shows no one ever entered. As the investigation deepens, a fund transfer scheme spanning Zurich and Singapore comes to light.', 'u2-night-train', ['Bank Heist', 'Financial Fraud']),
            make('default-summer-letter', 'Wall Street Fund', 'Financial Crime', 'You’re a junior analyst newly arrived on Wall Street who stumbles onto senior executives laundering billions through shell funds. Blowing the whistle means ruin — or worse, danger to your life; staying silent makes you complicit. Every choice you make will reshape the fate of a financial empire.', 'u2-summer-letter', ['Insider Trading', 'Moral Choices']),
            make('default-glass-city', 'Crypto Abyss', 'Financial Crime', 'The world’s largest cryptocurrency exchange collapses overnight, wiping out millions of investors. As the platform’s co-founder, you must choose between fleeing, turning yourself in, or striking back at the mastermind behind it all. The truth proves far less immutable than the blockchain itself.', 'u2-glass-city', ['Cryptocurrency', 'Ponzi Scheme']),
            make('default-star-academy', 'Ponzi Empire', 'Financial Crime', 'A magnetic wealth advisor lures an entire city’s fortune with promises of sky-high returns. As his most trusted assistant, you gradually realize the fund chain is about to break. Do you help him keep the scheme alive, or save the innocent investors before it all collapses?', 'u2-star-academy', ['Trust Collapse', 'Human Greed']),
            make('default-ancient-promise', 'Insider Game', 'Financial Crime', 'On the eve of a public company’s merger, an encrypted text leaks a piece of astronomically valuable insider information. As an SEC investigator, you have 48 hours to identify the leak — but the suspects include your mentor, your ex, and an untouchable political-business power broker.', 'u2-ancient-promise', ['Insider Trading', 'Gray Areas']),
            make('default-island', 'Underground Bank', 'Financial Crime', 'Behind an unassuming teahouse in the Pearl River Delta operates an underground bank moving hundreds of billions a year. As an undercover police officer planted inside, you’re caught between gang loyalty and the law’s bottom line — one botched wire transfer puts both sides of the law after you.', 'u2-island-letter', ['Undercover', 'Cross-Border Money Laundering']),
            make('default-stage', 'Silk Road Shadow Gold', 'Financial Crime', 'On a Belt and Road infrastructure project, massive construction funds flow into a Middle Eastern underground financial network through fraudulent trade schemes. As a posted commercial counselor, you discover a hidden link between your own country’s corporate executives and a terrorist financing organization — and exposing it could trigger a diplomatic firestorm.', 'u2-stage', ['Transnational Crime', 'Diplomatic Maneuvering'])
        ];
        
        return {
            version: this.DEFAULT_CATALOG_VERSION,
            banners: items.slice(0, 3),
            recent: [],
            sections: {
                'Recommend': items.slice(3, 7),
                'Escape Room': [items[1], items[4], items[6]],
                'Inception': [items[3], items[2], items[5]],
                'Fast & Furious': [items[0], items[5], items[4]]
            }
        };
    }

    normalizeCatalogItem(item = {}, fallbackId = '') {
        if (!item || typeof item !== 'object') return null;
        const title = String(item.title || item.name || '未命名影片').trim() || '未命名影片';
        const category = String(item.category || item.type || '剧情').trim() || '剧情';
        const id = String(item.id || fallbackId || `catalog-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
        const cast = (Array.isArray(item.cast) ? item.cast : (Array.isArray(item.actors) ? item.actors : []))
            .map((actor, index) => ({
                id: String(actor?.id || `film-${id}-${index}`),
                type: 'custom',
                sourceId: '',
                name: String(actor?.roleName || actor?.name || actor?.realName || `主演${index + 1}`).trim(),
                persona: String(actor?.rolePersona || actor?.persona || actor?.desc || '').trim(),
                avatar: String(actor?.avatar || actor?.avatarUrl || '').trim(),
                affinity: this.core.clampInt(actor?.affinity, 0, 100, 50)
            }));
        return {
            id,
            title,
            category,
            summary: String(item.summary || item.description || item.desc || '').trim(),
            tags: (Array.isArray(item.tags) ? item.tags : String(item.tags || '').split(/[，,、\s]+/)).map(tag => String(tag).trim()).filter(Boolean).slice(0, 5),
            coverUrl: this.normalizeCoverUrl(item.coverUrl || item.cover || item.thumbnail || '', `${id}-${title}`),
            cast
        };
    }

    normalizeCoverUrl(url, seed = 'netflix') {
        const value = String(url || '').trim();
        if (/^(https?:\/\/|data:image\/|blob:)/i.test(value)) return value;
        return `https://picsum.photos/seed/${encodeURIComponent(seed)}/720/1080?grayscale`;
    }

    normalizeCatalog(rawCatalog) {
        const fallback = this.createDefaultCatalog();
        const source = rawCatalog && typeof rawCatalog === 'object' ? rawCatalog : fallback;
        const sectionSource = source.sections && typeof source.sections === 'object' ? source.sections : fallback.sections;
        const sections = Object.entries(sectionSource).reduce((result, [name, items]) => {
            result[String(name)] = (Array.isArray(items) ? items : []).map((item, index) => this.normalizeCatalogItem(item, `section-${name}-${index}`)).filter(Boolean);
            return result;
        }, {});
        const normalizedBanners = (Array.isArray(source.banners) ? source.banners : fallback.banners).map((item, index) => this.normalizeCatalogItem(item, `banner-${index}`)).filter(Boolean).slice(0, 3);
        const normalizedRecent = (Array.isArray(source.recent) ? source.recent : []).map((item, index) => this.normalizeCatalogItem(item, `recent-${index}`)).filter(Boolean).slice(0, 8);
        const hasExplicitCatalogShape = !!rawCatalog && typeof rawCatalog === 'object' && ('banners' in rawCatalog || 'recent' in rawCatalog || 'sections' in rawCatalog);
        if (!Object.keys(sections).length && !hasExplicitCatalogShape) return fallback;
        return {
            version: source.version || fallback.version,
            generatedAt: source.generatedAt || null,
            banners: normalizedBanners,
            recent: normalizedRecent,
            sections
        };
    }

    loadState() {
        let raw = null;
        try {
            if (typeof window.getAppState === 'function') raw = window.getAppState('netflix');
            if (!raw && window.appStorage?.readDomain) raw = window.appStorage.readDomain('netflix', null);
        } catch (error) {
            console.warn('[Netflix] state load failed:', error);
        }
        if (raw && raw.homeCatalog && !raw.homeCatalog.generatedAt && raw.homeCatalog.version !== this.DEFAULT_CATALOG_VERSION) {
            raw = { ...raw, homeCatalog: null };
        }
        const normalized = this.core.normalizeState(raw, this.createDefaultCatalog());
        this.migratedLegacyState = normalized.migrated;
        normalized.state.homeCatalog = this.normalizeCatalog(normalized.state.homeCatalog);
        return normalized.state;
    }

    async saveState(options = {}) {
        try {
            if (typeof window.setAppState === 'function') {
                window.setAppState('netflix', this.state, { silent: true });
            } else if (window.appStorage?.commitDomain) {
                await window.appStorage.commitDomain('netflix', this.state, { critical: true, reason: 'netflix-visual-novel' });
            }
            if (options.flush && typeof window.saveGlobalData === 'function') await window.saveGlobalData();
            return true;
        } catch (error) {
            console.error('[Netflix] state save failed:', error);
            this.toast('存档写入失败，请稍后重试');
            return false;
        }
    }

    async finishLegacyMigration() {
        await this.saveState({ flush: true });
        const legacyKeys = [
            'u2_netflixWorks',
            'u2_netflixBoundWorldBookIds',
            'u2_netflixHomeCatalog',
            'u2_netflixPlaybackCatalog',
            'u2_netflixPlaybackCustomCss',
            'u2_netflixPresetState'
        ];
        if (window.appStorage?.removeLegacyKey) {
            await Promise.allSettled(legacyKeys.map(key => window.appStorage.removeLegacyKey(key)));
        }
    }

    renderStructure() {
        this.view.innerHTML = `
            <header class="netflix-header" id="netflix-header">
                <button type="button" class="netflix-logo" data-action="close-app" aria-label="关闭 Netflix">N</button>
                <div class="netflix-header-actions">
                    <button type="button" class="netflix-icon-button" data-action="open-search" aria-label="搜索"><i class="fas fa-search"></i></button>
                    <button type="button" class="netflix-header-avatar" data-action="open-profile" aria-label="我的 Netflix"><i class="fas fa-user"></i></button>
                </div>
            </header>
            <main class="netflix-content" id="netflix-content">
                <section class="netflix-panel is-active" data-panel="home"><div id="netflix-home-content"></div></section>
                <section class="netflix-panel netflix-profile-panel" data-panel="profile" id="netflix-profile-panel"></section>
            </main>
            <nav class="netflix-bottom-nav" aria-label="Netflix 导航">
                <button type="button" class="netflix-nav-item is-active" data-tab="home"><i class="fas fa-home"></i><span>Home</span></button>
                <button type="button" class="netflix-nav-item" data-tab="profile"><i class="fas fa-user-circle"></i><span>My Netflix</span></button>
            </nav>

            <section class="netflix-sheet netflix-detail-sheet" id="netflix-detail-sheet" aria-hidden="true">
                <div class="netflix-detail-card" id="netflix-detail-card"></div>
            </section>

            <section class="netflix-sheet netflix-search-sheet" id="netflix-search-sheet" aria-hidden="true">
                <div class="netflix-modal-card netflix-search-card" role="dialog" aria-modal="true" aria-labelledby="netflix-search-title">
                    <button type="button" class="netflix-modal-close" data-action="close-search" aria-label="关闭"><i class="fas fa-times"></i></button>
                    <span class="netflix-eyebrow">DISCOVER</span>
                    <h2 id="netflix-search-title">New Collection</h2>
                    <p>Enter your preferred genre, character dynamic, or story atmosphere. Leave blank for a random generation.</p>
                    <textarea id="netflix-search-input" placeholder="e.g.: One Hundred Years of Solitude, The Red and the Black"></textarea>
                    <button type="button" class="netflix-primary-button" data-action="confirm-search" id="netflix-search-confirm">Generate</button>
                </div>
            </section>

            <section class="netflix-setup-view" id="netflix-setup-view" aria-hidden="true">
                <header class="netflix-subview-header">
                    <button type="button" class="netflix-icon-button" data-action="close-setup" aria-label="返回"><i class="fas fa-chevron-left"></i></button>
                    <div><span>NEW STORY</span><strong>初始化游戏</strong></div>
                    <button type="button" class="netflix-subview-text-button" data-action="open-load">读档</button>
                </header>
                <div class="netflix-setup-scroll" id="netflix-setup-body"></div>
            </section>

            <section class="netflix-game-view" id="netflix-game-view" aria-hidden="true">
                <div class="netflix-game-backdrop" id="netflix-game-backdrop"></div>
                <div class="netflix-game-shade"></div>
                <header class="netflix-game-header">
                    <button type="button" class="netflix-game-top-button" data-action="return-to-netflix" aria-label="返回 Netflix"><i class="fas fa-chevron-left"></i></button>
                    <div class="netflix-game-title" id="netflix-game-title"></div>
                    <button type="button" class="netflix-game-top-button" data-action="open-game-menu" id="netflix-game-menu-button" aria-label="菜单"><i class="fas fa-bars"></i></button>
                </header>
                <div class="netflix-scene-heading" id="netflix-scene-heading"></div>
                <div class="netflix-game-stage" id="netflix-game-stage"></div>
                <section class="netflix-training-view" id="netflix-training-view" aria-hidden="true">
                    <header class="netflix-training-header">
                        <button type="button" class="netflix-game-top-button" data-action="continue-story" aria-label="继续剧情"><i class="fas fa-chevron-left"></i></button>
                        <div><span id="netflix-training-day">DAY 01</span><strong id="netflix-training-title">养成地图</strong></div>
                        <button type="button" class="netflix-game-top-button" data-action="open-game-menu" aria-label="菜单"><i class="fas fa-bars"></i></button>
                    </header>
                    <div class="netflix-training-hud" id="netflix-training-hud"></div>
                    <div class="netflix-map-viewport" id="netflix-map-viewport" tabindex="0" aria-label="养成地图，可拖动和缩放">
                        <div class="netflix-map-canvas" id="netflix-map-canvas"></div>
                    </div>
                    <div class="netflix-map-controls" aria-label="地图缩放控制">
                        <button type="button" data-action="map-zoom-out" aria-label="缩小地图"><i class="fas fa-minus"></i></button>
                        <button type="button" data-action="map-reset-view" aria-label="复位地图"><i class="fas fa-crosshairs"></i></button>
                        <button type="button" data-action="map-zoom-in" aria-label="放大地图"><i class="fas fa-plus"></i></button>
                    </div>
                    <div class="netflix-training-event" id="netflix-training-event" aria-hidden="true"></div>
                </section>
                <div class="netflix-generation-overlay" id="netflix-generation-overlay" role="status" aria-live="polite" aria-hidden="true">
                    <div><i class="fas fa-spinner fa-spin"></i><strong id="netflix-generation-title">正在生成剧情</strong><span id="netflix-generation-detail">正在建立世界与人物关系，请稍候。</span></div>
                </div>
            </section>

            <section class="netflix-sheet netflix-menu-sheet" id="netflix-menu-sheet" aria-hidden="true">
                <div class="netflix-menu-card" role="dialog" aria-modal="true" aria-label="游戏菜单">
                    <div class="netflix-menu-header"><div><span>STORY MENU</span><h2>游戏菜单</h2></div><button type="button" class="netflix-modal-close" data-action="close-game-menu" aria-label="关闭"><i class="fas fa-times"></i></button></div>
                    <div class="netflix-menu-grid">
                        <button type="button" data-action="continue-context" id="netflix-menu-continue"><i class="fas fa-play"></i><span>继续游戏</span></button>
                        <button type="button" data-action="open-save"><i class="fas fa-save"></i><span>存档</span></button>
                        <button type="button" data-action="open-load"><i class="fas fa-folder-open"></i><span>读档</span></button>
                        <button type="button" data-action="show-attributes"><i class="fas fa-chart-bar"></i><span>属性</span></button>
                        <button type="button" data-action="show-relations"><i class="fas fa-user-friends"></i><span>关系</span></button>
                        <button type="button" data-action="show-history"><i class="fas fa-book-open"></i><span>剧情回看</span></button>
                        <button type="button" data-action="restart-game"><i class="fas fa-redo"></i><span>重新开始</span></button>
                    </div>
                    <button type="button" class="netflix-menu-exit" data-action="return-to-netflix"><i class="fas fa-sign-out-alt"></i> 返回 Netflix</button>
                </div>
            </section>

            <section class="netflix-sheet netflix-save-sheet" id="netflix-save-sheet" aria-hidden="true">
                <div class="netflix-save-card" role="dialog" aria-modal="true" aria-labelledby="netflix-save-title">
                    <header><div><span>SAVE DATA</span><h2 id="netflix-save-title">读档</h2></div><button type="button" class="netflix-modal-close" data-action="close-saves" aria-label="关闭"><i class="fas fa-times"></i></button></header>
                    <div class="netflix-save-list" id="netflix-save-list"></div>
                </div>
            </section>

            <section class="netflix-sheet netflix-cast-picker-sheet" id="netflix-cast-picker-sheet" aria-hidden="true">
                <div class="netflix-modal-card netflix-cast-picker-card" role="dialog" aria-modal="true" aria-labelledby="netflix-cast-picker-title">
                    <button type="button" class="netflix-modal-close" data-action="close-cast-picker" aria-label="关闭"><i class="fas fa-times"></i></button>
                    <span class="netflix-eyebrow">CAST</span><h2 id="netflix-cast-picker-title">添加主演</h2>
                    <div class="netflix-cast-picker-list" id="netflix-cast-picker-list"></div>
                    <button type="button" class="netflix-secondary-button" data-action="add-custom-cast"><i class="fas fa-plus"></i> 手动添加 NPC</button>
                </div>
            </section>

            <section class="netflix-sheet netflix-info-sheet" id="netflix-info-sheet" aria-hidden="true">
                <div class="netflix-info-card" role="dialog" aria-modal="true" aria-labelledby="netflix-info-title">
                    <header><h2 id="netflix-info-title"></h2><button type="button" class="netflix-modal-close" data-action="close-info" aria-label="关闭"><i class="fas fa-times"></i></button></header>
                    <div class="netflix-info-body" id="netflix-info-body"></div>
                </div>
            </section>

            <section class="netflix-sheet netflix-map-editor-sheet" id="netflix-map-editor-sheet" aria-hidden="true">
                <div class="netflix-info-card netflix-map-editor-card" role="dialog" aria-modal="true" aria-labelledby="netflix-map-editor-title">
                    <header><div><span>MAP EDITOR</span><h2 id="netflix-map-editor-title">编辑养成地图</h2></div><button type="button" class="netflix-modal-close" data-action="close-map-editor" aria-label="关闭"><i class="fas fa-times"></i></button></header>
                    <div class="netflix-info-body" id="netflix-map-editor-body"></div>
                </div>
            </section>
        `;
    }

    cacheElements() {
        this.content = this.view.querySelector('#netflix-content');
        this.header = this.view.querySelector('#netflix-header');
        this.homeContent = this.view.querySelector('#netflix-home-content');
        this.profilePanel = this.view.querySelector('#netflix-profile-panel');
        this.detailSheet = this.view.querySelector('#netflix-detail-sheet');
        this.detailCard = this.view.querySelector('#netflix-detail-card');
        this.searchSheet = this.view.querySelector('#netflix-search-sheet');
        this.searchInput = this.view.querySelector('#netflix-search-input');
        this.searchConfirm = this.view.querySelector('#netflix-search-confirm');
        this.setupView = this.view.querySelector('#netflix-setup-view');
        this.setupBody = this.view.querySelector('#netflix-setup-body');
        this.gameView = this.view.querySelector('#netflix-game-view');
        this.gameBackdrop = this.view.querySelector('#netflix-game-backdrop');
        this.gameTitle = this.view.querySelector('#netflix-game-title');
        this.sceneHeading = this.view.querySelector('#netflix-scene-heading');
        this.gameStage = this.view.querySelector('#netflix-game-stage');
        this.gameMenuButton = this.view.querySelector('#netflix-game-menu-button');
        this.trainingView = this.view.querySelector('#netflix-training-view');
        this.trainingDay = this.view.querySelector('#netflix-training-day');
        this.trainingTitle = this.view.querySelector('#netflix-training-title');
        this.trainingHud = this.view.querySelector('#netflix-training-hud');
        this.mapViewport = this.view.querySelector('#netflix-map-viewport');
        this.mapCanvas = this.view.querySelector('#netflix-map-canvas');
        this.trainingEvent = this.view.querySelector('#netflix-training-event');
        this.generationOverlay = this.view.querySelector('#netflix-generation-overlay');
        this.generationTitle = this.view.querySelector('#netflix-generation-title');
        this.generationDetail = this.view.querySelector('#netflix-generation-detail');
        this.menuContinue = this.view.querySelector('#netflix-menu-continue');
        this.menuSheet = this.view.querySelector('#netflix-menu-sheet');
        this.saveSheet = this.view.querySelector('#netflix-save-sheet');
        this.saveTitle = this.view.querySelector('#netflix-save-title');
        this.saveList = this.view.querySelector('#netflix-save-list');
        this.castPickerSheet = this.view.querySelector('#netflix-cast-picker-sheet');
        this.castPickerList = this.view.querySelector('#netflix-cast-picker-list');
        this.infoSheet = this.view.querySelector('#netflix-info-sheet');
        this.infoTitle = this.view.querySelector('#netflix-info-title');
        this.infoBody = this.view.querySelector('#netflix-info-body');
        this.mapEditorSheet = this.view.querySelector('#netflix-map-editor-sheet');
        this.mapEditorBody = this.view.querySelector('#netflix-map-editor-body');
    }

    bindEvents() {
        document.getElementById('app-netflix-btn')?.addEventListener('click', () => this.open());
        this.view.addEventListener('click', event => this.handleClick(event));
        this.view.addEventListener('input', event => this.handleInput(event));
        this.view.addEventListener('change', event => this.handleChange(event));
        this.content?.addEventListener('scroll', () => this.header?.classList.toggle('is-scrolled', this.content.scrollTop > 28));
        this.mapViewport?.addEventListener('wheel', event => this.handleMapWheel(event), { passive: false });
        this.mapViewport?.addEventListener('pointerdown', event => this.handleMapPointerDown(event));
        this.mapViewport?.addEventListener('pointermove', event => this.handleMapPointerMove(event));
        this.mapViewport?.addEventListener('pointerup', event => this.handleMapPointerUp(event));
        this.mapViewport?.addEventListener('pointercancel', event => this.handleMapPointerUp(event));
        window.addEventListener('pagehide', () => {
            if (this.state.activeRun && !this.isBusy) this.updateAutoSave(false);
        });
    }

    handleClick(event) {
        const target = event.target.closest('[data-action], [data-tab], [data-catalog-id], [data-choice-id], [data-location-id], [data-training-choice-id]');
        if (!target || !this.view.contains(target)) return;
        if (target.dataset.tab) return this.switchTab(target.dataset.tab);
        if (target.dataset.catalogId) return this.openDetailById(target.dataset.catalogId);
        if (target.dataset.choiceId) return this.chooseStoryOption(target.dataset.choiceId);
        if (target.dataset.locationId) return this.openTrainingLocation(target.dataset.locationId);
        if (target.dataset.trainingChoiceId) return this.resolveTrainingChoice(target.dataset.trainingChoiceId);
        const action = target.dataset.action;
        const actions = {
            'close-app': () => this.close(),
            'open-profile': () => this.switchTab('profile'),
            'open-search': () => this.openSearch(),
            'close-search': () => this.closeSheet(this.searchSheet),
            'confirm-search': () => this.generateCatalog(),
            'close-detail': () => this.closeSheet(this.detailSheet),
            'play-title': () => this.openSetup(this.activeCatalogItem),
            'delete-title': () => this.deleteCatalogTitle(),
            'close-setup': () => this.closeSetup(),
            'reroll-attributes': () => this.rerollAttributes(),
            'add-attribute': () => this.addCustomAttribute(),
            'delete-attribute': () => this.deleteCustomAttribute(target.dataset.attributeId),
            'open-cast-picker': () => this.openCastPicker(),
            'close-cast-picker': () => this.closeSheet(this.castPickerSheet),
            'add-existing-cast': () => this.addExistingCharacter(target.dataset.characterId),
            'add-custom-cast': () => this.addCustomCast(),
            'delete-cast': () => this.deleteCast(target.dataset.castId),
            'start-game': () => this.startNewGame(),
            'advance-dialogue': () => this.advanceDialogue(),
            'toggle-custom-choice': () => this.toggleCustomChoice(),
            'submit-custom-choice': () => this.submitCustomChoice(),
            'enter-training': () => this.enterTraining(),
            'continue-story': () => this.continueStory(),
            'advance-training-event': () => this.advanceTrainingEvent(),
            'dismiss-training-result': () => this.dismissTrainingResult(),
            'close-training-event': () => this.closeTrainingEvent(),
            'select-companion': () => this.selectTrainingCompanion(target.dataset.companionId),
            'map-zoom-in': () => this.zoomMap(0.15),
            'map-zoom-out': () => this.zoomMap(-0.15),
            'map-reset-view': () => this.resetMapView(),
            'toggle-map-layout': () => this.toggleMapLayout(),
            'open-map-editor': () => this.openMapEditor(),
            'close-map-editor': () => this.closeSheet(this.mapEditorSheet),
            'add-map-node': () => this.addMapNode(),
            'delete-map-node': () => this.deleteMapNode(target.dataset.mapNodeId),
            'save-map-editor': () => this.saveMapEditor(),
            'regenerate-map': () => this.regenerateMap(),
            'enter-main-game': () => this.enterMainGame(),
            'continue-epilogue': () => this.continueEpilogue(),
            'open-game-menu': () => this.openGameMenu(),
            'close-game-menu': () => this.closeSheet(this.menuSheet),
            'continue-context': () => this.continueContext(),
            'open-save': () => this.openSaves('save'),
            'open-load': () => this.openSaves('load'),
            'close-saves': () => this.closeSheet(this.saveSheet),
            'save-slot': () => this.writeManualSave(Number(target.dataset.slotIndex)),
            'load-slot': () => this.loadSave(target.dataset.slotKind, Number(target.dataset.slotIndex)),
            'delete-save': () => this.deleteManualSave(Number(target.dataset.slotIndex)),
            'show-attributes': () => this.showAttributes(),
            'show-relations': () => this.showRelations(),
            'show-character-detail': () => this.showCharacterDetail(target.dataset.characterId),
            'back-to-relations': () => this.showRelations(false),
            'acquaint-character': () => this.resolveIdentityCard(true),
            'defer-character': () => this.resolveIdentityCard(false),
            'show-history': () => this.showHistory(),
            'show-endings': () => this.showEndings(),
            'show-worldbooks': () => this.showWorldBooksInfo(),
            'close-info': () => this.closeSheet(this.infoSheet),
            'restart-game': () => this.restartGame(),
            'return-to-netflix': () => this.returnToNetflix()
        };
        if (action && actions[action]) actions[action]();
    }

    handleInput(event) {
        if (!this.setupDraft) return;
        const field = event.target.dataset.setupField;
        if (field) this.setupDraft[field] = event.target.value;
        const attributeId = event.target.dataset.attributeId;
        if (attributeId) {
            const attribute = this.setupDraft.attributes.find(item => item.id === attributeId);
            if (attribute) {
                if (event.target.dataset.attributeField === 'name') attribute.name = event.target.value;
                if (event.target.dataset.attributeField === 'value') attribute.value = this.core.clampInt(event.target.value, 0, 100, 0);
            }
        }
        const castId = event.target.dataset.castId;
        if (castId) {
            const actor = this.setupDraft.cast.find(item => item.id === castId);
            if (actor) {
                const castField = event.target.dataset.castField;
                if (castField === 'name') actor.name = event.target.value;
                if (castField === 'persona') actor.persona = event.target.value;
                if (castField === 'affinity' && actor.type !== 'user') {
                    actor.affinity = this.core.clampInt(event.target.value, 0, 100, 50);
                    const output = event.target.closest('.netflix-affinity-field')?.querySelector('b');
                    if (output) output.textContent = String(actor.affinity);
                }
            }
        }
    }

    handleChange(event) {
        if (!this.setupDraft) return;
        if (event.target.matches('[data-worldbook-id]')) {
            const id = String(event.target.dataset.worldbookId);
            const ids = new Set(this.setupDraft.worldBookIds || []);
            event.target.checked ? ids.add(id) : ids.delete(id);
            this.setupDraft.worldBookIds = Array.from(ids);
        }
        if (event.target.dataset.action === 'upload-cover') this.readImageFile(event.target, dataUrl => {
            this.setupDraft.coverUrl = dataUrl;
            this.renderSetup();
        });
        if (event.target.dataset.action === 'upload-cast-avatar') {
            const castId = event.target.dataset.castId;
            this.readImageFile(event.target, dataUrl => {
                const actor = this.setupDraft.cast.find(item => item.id === castId);
                if (actor) actor.avatar = dataUrl;
                this.renderSetup();
            });
        }
    }

    readImageFile(input, callback) {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => callback(String(reader.result || ''));
        reader.readAsDataURL(file);
        input.value = '';
    }

    getUserState() {
        if (typeof window.getUserState === 'function') return window.getUserState() || {};
        return window.userState && typeof window.userState === 'object' ? window.userState : {};
    }

    getUserActor() {
        const user = this.getUserState();
        return {
            id: 'user-current',
            sourceId: 'user-current',
            type: 'user',
            name: String(user.name || user.realName || 'User'),
            persona: String(user.persona || user.signature || user.bio || ''),
            avatar: String(user.avatarUrl || user.avatar || ''),
            affinity: null
        };
    }

    getWorldBooks() {
        try {
            if (typeof window.getWorldBooks === 'function') return window.getWorldBooks() || [];
        } catch (error) {
            console.warn('[Netflix] world books unavailable:', error);
        }
        return [];
    }

    snapshotWorldBooks(ids) {
        const selected = new Set((Array.isArray(ids) ? ids : []).map(String));
        return this.getWorldBooks().filter(book => selected.has(String(book.id))).map(book => ({
            id: String(book.id),
            name: String(book.name || '未命名世界书'),
            content: (Array.isArray(book.entries) ? book.entries : [])
                .filter(entry => entry && entry.enabled !== false)
                .map(entry => `【${entry.title || entry.name || entry.keyword || '词条'}】\n${entry.content || ''}`.trim())
                .filter(Boolean)
                .join('\n\n')
        }));
    }

    renderAvatarMarkup(actor, className = '') {
        const name = String(actor?.name || '?');
        return actor?.avatar
            ? `<span class="netflix-avatar-image ${className}"><img src="${this.escapeAttr(actor.avatar)}" alt=""></span>`
            : `<span class="netflix-avatar-fallback ${className}">${this.escapeHtml(name.slice(0, 1).toUpperCase())}</span>`;
    }

    renderHome() {
        const catalog = this.normalizeCatalog(this.state.homeCatalog);
        this.state.homeCatalog = catalog;
        const banners = catalog.banners;
        const rows = [
            catalog.recent.length ? this.renderCatalogRow('继续你的故事', catalog.recent, true) : '',
            ...Object.entries(catalog.sections).map(([title, items]) => this.renderCatalogRow(title, items, false))
        ].filter(Boolean).join('');
        const hasTitles = banners.length || catalog.recent.length || Object.values(catalog.sections).some(items => items.length);
        this.homeContent.innerHTML = hasTitles ? `
            ${banners.length ? `<div class="netflix-hero-scroll">
                ${banners.map((item, index) => `
                    <article class="netflix-hero" style="--hero-image:url('${this.escapeAttr(item.coverUrl)}')">
                        <div class="netflix-hero-copy">
                            <span>${this.escapeHtml(item.category)}</span>
                            <h1>${this.escapeHtml(item.title)}</h1>
                            <p>${this.escapeHtml(item.summary || '开启一段属于你的互动故事。')}</p>
                            <button type="button" data-catalog-id="${this.escapeAttr(item.id)}"><i class="fas fa-play"></i> Play</button>
                        </div>
                        <div class="netflix-hero-index">0${index + 1}</div>
                    </article>`).join('')}
            </div>` : ''}
            ${rows}
        ` : '<div class="netflix-catalog-empty"><i class="fas fa-film"></i><h2>片库是空的</h2><p>可以通过右上角搜索生成新的互动故事。</p><button type="button" data-action="open-search">创建故事</button></div>';
    }

    renderCatalogRow(title, items, landscape) {
        return `<section class="netflix-row">
            <header><h2>${this.escapeHtml(title)}</h2><span>${items.length} part</span></header>
            <div class="netflix-row-scroll">
                ${items.map(item => `<button type="button" class="netflix-catalog-card ${landscape ? 'is-landscape' : ''}" data-catalog-id="${this.escapeAttr(item.id)}">
                    <span class="netflix-catalog-cover" style="background-image:url('${this.escapeAttr(item.coverUrl)}')"></span>
                    <strong>${this.escapeHtml(item.title)}</strong><small>${this.escapeHtml([item.category, ...(item.tags || [])].slice(0, 2).join(' · '))}</small>
                </button>`).join('')}
            </div>
        </section>`;
    }

    findCatalogItem(id) {
        const catalog = this.normalizeCatalog(this.state.homeCatalog);
        const all = [...catalog.banners, ...catalog.recent, ...Object.values(catalog.sections).flat()];
        return all.find(item => String(item.id) === String(id)) || null;
    }

    openDetailById(id) {
        const item = this.findCatalogItem(id);
        if (!item) return;
        this.activeCatalogItem = item;
        this.detailCard.innerHTML = `
            <button type="button" class="netflix-detail-close" data-action="close-detail" aria-label="关闭"><i class="fas fa-times"></i></button>
            <div class="netflix-detail-hero" style="background-image:url('${this.escapeAttr(item.coverUrl)}')"></div>
            <div class="netflix-detail-body">
                <span class="netflix-eyebrow">INTERACTIVE STORY</span>
                <h2>${this.escapeHtml(item.title)}</h2>
                <div class="netflix-detail-tags"><b>${this.escapeHtml(item.category)}</b>${(item.tags || []).map(tag => `<span>${this.escapeHtml(tag)}</span>`).join('')}</div>
                <p>${this.escapeHtml(item.summary || '世界尚未书写，等待你进入故事。')}</p>
                <div class="netflix-detail-actions">
                    <button type="button" class="netflix-primary-button" data-action="play-title"><i class="fas fa-play"></i> Play</button>
                    <button type="button" class="netflix-delete-title-button" data-action="delete-title"><i class="fas fa-trash-alt"></i> Delete Story</button>
                </div>
            </div>`;
        this.openSheet(this.detailSheet);
    }

    async deleteCatalogTitle() {
        const item = this.activeCatalogItem;
        if (this.isBusy || !item) return;
        if (!window.confirm(`确定从片库删除《${item.title}》吗？\n存档和已解锁结局会保留。`)) return;
        const id = String(item.id);
        const catalog = this.normalizeCatalog(this.state.homeCatalog);
        catalog.banners = catalog.banners.filter(entry => String(entry.id) !== id);
        catalog.recent = catalog.recent.filter(entry => String(entry.id) !== id);
        catalog.sections = Object.entries(catalog.sections).reduce((result, [name, items]) => {
            const remaining = items.filter(entry => String(entry.id) !== id);
            if (remaining.length) result[name] = remaining;
            return result;
        }, {});
        this.state.homeCatalog = catalog;
        this.activeCatalogItem = null;
        this.closeSheet(this.detailSheet);
        await this.saveState({ flush: true });
        this.renderHome();
        this.toast('故事已从片库删除，存档仍然保留');
    }

    renderProfile() {
        const user = this.getUserActor();
        const manualCount = this.state.saveSlots.manual.filter(Boolean).length;
        const endingCount = this.state.unlockedEndings.length;
        this.profilePanel.innerHTML = `
            <div class="netflix-profile-hero">
                ${this.renderAvatarMarkup(user, 'netflix-profile-avatar')}
                <div><span>PLAYER PROFILE</span><h1>${this.escapeHtml(user.name)}</h1><p>${this.escapeHtml(user.persona || 'My muse of desire.')}</p></div>
            </div>
            <div class="netflix-profile-stats">
                <div><strong>${manualCount}</strong><span>Manual Save</span></div>
                <div><strong>${endingCount}</strong><span>Endings Unlocked</span></div>
            </div>
            <div class="netflix-profile-actions">
                <button type="button" data-action="open-load"><i class="fas fa-folder-open"></i><span><strong>Save</strong><small>Auto Save & 6 Manual Saves</small></span><i class="fas fa-chevron-right"></i></button>
                <button type="button" data-action="show-endings"><i class="fas fa-trophy"></i><span><strong>Collection</strong><small>Review Endings Reached</small></span><i class="fas fa-chevron-right"></i></button>
                <button type="button" data-action="show-worldbooks"><i class="fas fa-book"></i><span><strong>World Book</strong><small>Create Independent Snapshot</small></span><i class="fas fa-chevron-right"></i></button>
            </div>`;
        const headerAvatar = this.view.querySelector('.netflix-header-avatar');
        if (headerAvatar) headerAvatar.innerHTML = user.avatar ? `<img src="${this.escapeAttr(user.avatar)}" alt="">` : '<i class="fas fa-user"></i>';
    }

    renderNav() {
        this.view.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('is-active', button.dataset.tab === this.activeTab));
        this.view.querySelectorAll('[data-panel]').forEach(panel => panel.classList.toggle('is-active', panel.dataset.panel === this.activeTab));
    }

    switchTab(tabName = 'home') {
        this.activeTab = tabName === 'profile' ? 'profile' : 'home';
        this.renderNav();
        if (this.activeTab === 'profile') this.renderProfile();
        if (this.content) this.content.scrollTop = 0;
    }

    openSearch() {
        this.searchInput.value = '';
        this.openSheet(this.searchSheet);
        setTimeout(() => this.searchInput?.focus({ preventScroll: true }), 80);
    }

    async generateCatalog() {
        if (this.isSearchBusy) return;
        if (!this.hasApiConfig()) return this.toast('请先在设置中配置大模型 API');
        this.isSearchBusy = true;
        this.searchConfirm.disabled = true;
        this.searchConfirm.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中';
        const query = this.searchInput.value.trim();
        try {
            const prompt = `你正在生成 Netflix 互动文游片库。${query ? `用户偏好：${query}` : '请随机选择有戏剧张力的题材。'}\n只返回 JSON 对象，不要 Markdown。格式：{"banners":[作品,作品,作品],"sections":{"为你推荐":[作品,作品,作品,作品],"恋爱剧情":[作品,作品,作品],"成长养成":[作品,作品,作品],"悬疑奇幻":[作品,作品,作品]}}。每个作品格式：{"id":"唯一英文id","title":"中文片名","category":"分类","summary":"80字内世界与矛盾简介","tags":["标签1","标签2"],"coverUrl":"https://picsum.photos/seed/英文关键词/720/1080?grayscale","cast":[{"name":"角色名","persona":"人物人设"}]}。必须恰好生成上述数量。`;
            const raw = await this.requestJson(prompt);
            const parsed = this.core.cleanJsonText(raw);
            const next = this.normalizeCatalog({ banners: parsed.banners, sections: parsed.sections, recent: this.state.homeCatalog.recent });
            next.generatedAt = Date.now();
            if (next.banners.length < 3 || Object.values(next.sections).some(items => items.length < 3)) throw new Error('片库数量不完整');
            this.state.homeCatalog = next;
            await this.saveState({ flush: true });
            this.renderHome();
            this.closeSheet(this.searchSheet);
            this.toast('新的片库已生成');
        } catch (error) {
            console.error('[Netflix] catalog generation failed:', error);
            this.toast(error?.message || '片库生成失败');
        } finally {
            this.isSearchBusy = false;
            this.searchConfirm.disabled = false;
            this.searchConfirm.innerHTML = '生成片库';
        }
    }

    createSetupDraft(item) {
        const filmCast = (item.cast || []).map((actor, index) => ({ ...actor, id: `film-${item.id}-${index}`, type: 'custom', affinity: 50 }));
        return {
            sourceId: item.id,
            title: item.title,
            category: item.category,
            coverUrl: item.coverUrl,
            worldview: item.summary || '',
            premise: item.summary || '',
            worldBookIds: [],
            cast: this.core.normalizeCast([this.getUserActor(), ...filmCast]),
            attributes: this.core.createDefaultAttributes()
        };
    }

    openSetup(item) {
        if (!item) return;
        this.activeCatalogItem = item;
        this.setupDraft = this.createSetupDraft(item);
        this.renderSetup();
        this.closeSheet(this.detailSheet);
        this.setupView.classList.add('is-active');
        this.setupView.setAttribute('aria-hidden', 'false');
    }

    closeSetup() {
        if (this.isBusy) return;
        this.setupView.classList.remove('is-active');
        this.setupView.setAttribute('aria-hidden', 'true');
    }

    renderSetup() {
        if (!this.setupDraft) return;
        const books = this.getWorldBooks();
        const selectedBooks = new Set((this.setupDraft.worldBookIds || []).map(String));
        this.setupBody.innerHTML = `
            <section class="netflix-setup-cover" style="--setup-cover:url('${this.escapeAttr(this.setupDraft.coverUrl)}')">
                <div><span>GAME PROJECT</span><h1>${this.escapeHtml(this.setupDraft.title || '未命名游戏')}</h1></div>
                <label class="netflix-cover-upload"><i class="fas fa-image"></i> 更换背景<input type="file" accept="image/*" data-action="upload-cover"></label>
            </section>
            <section class="netflix-setup-section">
                <div class="netflix-section-heading"><span>01</span><div><h2>故事设定</h2><p>影片资料已预填，可以完全改写。</p></div></div>
                <label class="netflix-field"><span>游戏标题</span><input type="text" maxlength="60" data-setup-field="title" value="${this.escapeAttr(this.setupDraft.title)}"></label>
                <label class="netflix-field"><span>世界观设定</span><textarea maxlength="8000" data-setup-field="worldview" placeholder="时代、地点、社会规则与不可违背的设定">${this.escapeHtml(this.setupDraft.worldview)}</textarea></label>
                <label class="netflix-field"><span>故事前提</span><textarea maxlength="4000" data-setup-field="premise" placeholder="主线矛盾、开局处境与希望体验的故事方向">${this.escapeHtml(this.setupDraft.premise)}</textarea></label>
            </section>
            <section class="netflix-setup-section">
                <div class="netflix-section-heading"><span>02</span><div><h2>主演人设</h2><p>玩家固定参与；Char 与自定义 NPC 会保存为独立快照。</p></div><button type="button" class="netflix-section-action" data-action="open-cast-picker"><i class="fas fa-plus"></i> 添加</button></div>
                <div class="netflix-setup-cast-list">
                    ${this.setupDraft.cast.map(actor => this.renderSetupActor(actor)).join('')}
                </div>
            </section>
            <section class="netflix-setup-section">
                <div class="netflix-section-heading"><span>03</span><div><h2>User 属性</h2><p>初始值随机 0–100，可直接修改。</p></div><button type="button" class="netflix-section-action" data-action="reroll-attributes"><i class="fas fa-dice"></i> 重随机</button></div>
                <div class="netflix-attribute-grid">
                    ${this.setupDraft.attributes.map(attribute => this.renderSetupAttribute(attribute)).join('')}
                </div>
                <button type="button" class="netflix-dashed-button" data-action="add-attribute"><i class="fas fa-plus"></i> 添加自定义属性</button>
            </section>
            <section class="netflix-setup-section">
                <div class="netflix-section-heading"><span>04</span><div><h2>世界书</h2><p>开始后保存词条快照，不受后续修改影响。</p></div></div>
                <div class="netflix-worldbook-options">
                    ${books.length ? books.map(book => `<label><span><i class="fas fa-book"></i><b>${this.escapeHtml(book.name || '未命名世界书')}</b><small>${Array.isArray(book.entries) ? book.entries.length : 0} 条词条</small></span><input type="checkbox" data-worldbook-id="${this.escapeAttr(book.id)}" ${selectedBooks.has(String(book.id)) ? 'checked' : ''}></label>`).join('') : '<div class="netflix-empty-state">暂无世界书，可直接使用上方世界观开始。</div>'}
                </div>
            </section>
            <div class="netflix-setup-actions">
                <button type="button" class="netflix-secondary-button" data-action="open-load"><i class="fas fa-folder-open"></i> 读档</button>
                <button type="button" class="netflix-primary-button" data-action="start-game" id="netflix-start-game-button"><i class="fas fa-play"></i> 开始播放</button>
            </div>`;
    }

    renderSetupActor(actor) {
        return `<article class="netflix-setup-actor" data-actor-card="${this.escapeAttr(actor.id)}">
            <div class="netflix-actor-visual">
                ${this.renderAvatarMarkup(actor)}
                <label aria-label="更换头像"><i class="fas fa-camera"></i><input type="file" accept="image/*" data-action="upload-cast-avatar" data-cast-id="${this.escapeAttr(actor.id)}"></label>
            </div>
            <div class="netflix-actor-fields">
                <div class="netflix-actor-title"><span>${actor.type === 'user' ? `PLAYER · ${this.escapeHtml(actor.name)}` : (actor.type === 'char' ? 'CHAR' : 'NPC')}</span>${actor.type !== 'user' ? `<button type="button" data-action="delete-cast" data-cast-id="${this.escapeAttr(actor.id)}" aria-label="移除主演"><i class="fas fa-trash-alt"></i></button>` : ''}</div>
                <label class="netflix-field compact"><span>姓名</span><input type="text" maxlength="40" data-cast-id="${this.escapeAttr(actor.id)}" data-cast-field="name" value="${this.escapeAttr(actor.name)}"></label>
                <label class="netflix-field compact"><span>人设</span><textarea maxlength="3000" data-cast-id="${this.escapeAttr(actor.id)}" data-cast-field="persona" placeholder="性格、背景、关系与说话方式">${this.escapeHtml(actor.persona)}</textarea></label>
                ${actor.type !== 'user' ? `<label class="netflix-affinity-field"><span>初始好感度</span><input type="number" min="0" max="100" inputmode="numeric" data-cast-id="${this.escapeAttr(actor.id)}" data-cast-field="affinity" value="${actor.affinity}"><b>${actor.affinity}</b></label>` : ''}
            </div>
        </article>`;
    }

    renderSetupAttribute(attribute) {
        return `<div class="netflix-attribute-editor">
            ${attribute.isDefault ? `<strong>${this.escapeHtml(attribute.name)}</strong>` : `<input type="text" maxlength="24" data-attribute-id="${this.escapeAttr(attribute.id)}" data-attribute-field="name" value="${this.escapeAttr(attribute.name)}" aria-label="属性名">`}
            <input type="number" min="0" max="100" inputmode="numeric" data-attribute-id="${this.escapeAttr(attribute.id)}" data-attribute-field="value" value="${attribute.value}" aria-label="${this.escapeAttr(attribute.name)}数值">
            ${attribute.isDefault ? '<span>/ 100</span>' : `<button type="button" data-action="delete-attribute" data-attribute-id="${this.escapeAttr(attribute.id)}" aria-label="删除属性"><i class="fas fa-times"></i></button>`}
        </div>`;
    }

    rerollAttributes() {
        if (!this.setupDraft) return;
        const custom = this.setupDraft.attributes.filter(attribute => !attribute.isDefault).map(attribute => ({ ...attribute, value: this.core.randomAttributeValue() }));
        this.setupDraft.attributes = [...this.core.createDefaultAttributes(), ...custom];
        this.renderSetup();
    }

    addCustomAttribute() {
        if (!this.setupDraft) return;
        this.setupDraft.attributes.push({ id: `custom-${Date.now()}`, name: '新属性', value: this.core.randomAttributeValue(), isDefault: false });
        this.renderSetup();
    }

    deleteCustomAttribute(id) {
        if (!this.setupDraft) return;
        this.setupDraft.attributes = this.setupDraft.attributes.filter(attribute => attribute.isDefault || attribute.id !== id);
        this.renderSetup();
    }

    async getAvailableCharacters() {
        let friends = [];
        try {
            if (window.imStorage?.loadFriends) friends = await window.imStorage.loadFriends();
            else if (typeof window.getAppState === 'function') friends = window.getAppState('imessage')?.friends || [];
        } catch (error) {
            console.warn('[Netflix] Char list unavailable:', error);
        }
        return (Array.isArray(friends) ? friends : []).filter(friend => friend?.type === 'char').map(friend => ({
            id: `char-${friend.id || friend.realName || friend.name}`,
            sourceId: String(friend.id || ''),
            type: 'char',
            name: String(friend.nickname || friend.name || friend.realName || 'Char'),
            persona: String(friend.persona || friend.desc || friend.signature || friend.bio || ''),
            avatar: String(friend.avatarUrl || friend.avatar || friend.avatarDataUrl || ''),
            affinity: 50
        }));
    }

    async openCastPicker() {
        if (!this.setupDraft) return;
        this.castPickerList.innerHTML = '<div class="netflix-empty-state"><i class="fas fa-spinner fa-spin"></i> 正在读取 Char…</div>';
        this.openSheet(this.castPickerSheet);
        this.availableCharacters = await this.getAvailableCharacters();
        const selected = new Set(this.setupDraft.cast.map(actor => actor.sourceId).filter(Boolean));
        this.castPickerList.innerHTML = this.availableCharacters.length ? this.availableCharacters.map(actor => `<button type="button" data-action="add-existing-cast" data-character-id="${this.escapeAttr(actor.id)}" ${selected.has(actor.sourceId) ? 'disabled' : ''}>${this.renderAvatarMarkup(actor)}<span><strong>${this.escapeHtml(actor.name)}</strong><small>${this.escapeHtml(actor.persona || '暂无人设')}</small></span><i class="fas ${selected.has(actor.sourceId) ? 'fa-check' : 'fa-plus'}"></i></button>`).join('') : '<div class="netflix-empty-state">暂无可用 Char，请先在 iMessage 添加。</div>';
    }

    addExistingCharacter(id) {
        const actor = this.availableCharacters.find(item => item.id === id);
        if (!actor || !this.setupDraft) return;
        if (!this.setupDraft.cast.some(item => item.sourceId && item.sourceId === actor.sourceId)) this.setupDraft.cast.push(this.core.clone(actor));
        this.closeSheet(this.castPickerSheet);
        this.renderSetup();
    }

    addCustomCast() {
        if (!this.setupDraft) return;
        this.setupDraft.cast.push({ id: `custom-cast-${Date.now()}`, sourceId: '', type: 'custom', name: '新角色', persona: '', avatar: '', affinity: 50 });
        this.closeSheet(this.castPickerSheet);
        this.renderSetup();
    }

    deleteCast(id) {
        if (!this.setupDraft) return;
        this.setupDraft.cast = this.setupDraft.cast.filter(actor => actor.type === 'user' || actor.id !== id);
        this.renderSetup();
    }

    validateSetup() {
        if (!this.setupDraft?.title.trim()) throw new Error('请填写游戏标题');
        if (!this.setupDraft.worldview.trim()) throw new Error('请填写世界观设定');
        if (!this.setupDraft.premise.trim()) throw new Error('请填写故事前提');
        if (!this.setupDraft.cast.some(actor => actor.type === 'user')) throw new Error('主演中必须包含玩家');
        if (this.setupDraft.cast.some(actor => !String(actor.name || '').trim())) throw new Error('主演姓名不能为空');
        const names = this.setupDraft.attributes.map(attribute => String(attribute.name || '').trim());
        if (names.some(name => !name)) throw new Error('属性名称不能为空');
        if (new Set(names).size !== names.length) throw new Error('属性名称不能重复');
        if (!this.hasApiConfig()) throw new Error('请先在设置中配置大模型 API');
    }

    createRunFromDraft() {
        const now = Date.now();
        const setup = {
            ...this.core.clone(this.setupDraft),
            title: this.setupDraft.title.trim(),
            worldview: this.setupDraft.worldview.trim(),
            premise: this.setupDraft.premise.trim(),
            worldBooks: this.snapshotWorldBooks(this.setupDraft.worldBookIds)
        };
        return {
            id: `run-${now}`,
            sourceId: setup.sourceId,
            phase: 'prologue',
            viewMode: 'story',
            storyReturnPoint: null,
            sceneNumber: 0,
            beatIndex: 0,
            setup,
            attributes: this.core.normalizeAttributes(setup.attributes, () => 0.5),
            cast: this.core.normalizeCast(setup.cast.map(actor => actor.type === 'user' ? actor : ({
                ...actor,
                origin: 'setup',
                acquainted: false,
                profileComplete: false,
                companionEligible: true
            }))),
            flags: [],
            storySummary: '',
            currentScene: null,
            storyLog: [],
            training: this.core.createDefaultTraining(),
            pendingIdentityCard: null,
            lastChoice: null,
            startedAt: now,
            updatedAt: now
        };
    }

    async startNewGame() {
        if (this.isBusy) return;
        try {
            this.validateSetup();
        } catch (error) {
            return this.toast(error.message);
        }
        if (this.state.saveSlots.auto && !window.confirm('开始新游戏会覆盖当前自动档，是否继续？')) return;
        const pendingRun = this.createRunFromDraft();
        this.pendingRunPreview = pendingRun;
        this.showPendingGame(pendingRun, '正在生成序章', '正在建立世界与人物关系，请稍候。');
        this.setBusy(true, '正在生成序章…');
        try {
            const raw = await this.requestJson(this.buildScenePrompt(pendingRun, 'prologue', null));
            const scene = this.normalizeSceneForRun(raw, 'prologue', pendingRun);
            pendingRun.cast = this.core.mergeCharacterProfiles(pendingRun.cast, scene.characterProfiles, { sceneId: scene.id, seenAt: scene.createdAt });
            pendingRun.currentScene = scene;
            pendingRun.storySummary = scene.storySummary || scene.outcome.summary || '';
            pendingRun.storyLog = [this.createLogEntry(scene)];
            pendingRun.updatedAt = Date.now();
            this.state.activeRun = pendingRun;
            this.upsertRecent(pendingRun.setup);
            await this.updateAutoSave(true);
            this.closeSetup();
            this.openGame();
        } catch (error) {
            console.error('[Netflix] prologue generation failed:', error);
            this.hidePendingGame(true);
            this.toast(error?.message || '序章生成失败，请重试');
        } finally {
            this.pendingRunPreview = null;
            this.setBusy(false);
        }
    }

    buildScenePrompt(run, phase, choice) {
        const setup = run.setup || {};
        const worldBooks = (setup.worldBooks || []).map(book => `《${book.name}》\n${book.content}`).filter(Boolean).join('\n\n');
        const attributes = (run.attributes || []).map(attribute => `${attribute.id}（${attribute.name}）=${attribute.value}`).join('；');
        const cast = (run.cast || []).map(actor => {
            if (actor.type === 'user') return `${actor.id} | ${actor.name} | 玩家本人，所有对话必须显示姓名“${actor.name}”`;
            const relation = actor.acquainted ? '已结识' : '已登场但未结识';
            const profile = actor.profileComplete
                ? `身份：${actor.identity}；职业：${actor.occupation}；阵营：${actor.faction}；角色属性：${actor.characterAttributes.map(attribute => `${attribute.name}${attribute.value}`).join('、')}`
                : '身份档案尚未补全，本次实际登场时必须返回 characterProfiles 档案';
            return `${actor.id} | ${actor.name} | ${actor.origin === 'story' ? '剧情人物' : '开局主演'} | ${relation} | 好感度${actor.affinity} | ${actor.companionEligible ? '可同行' : '不可同行'}\n${profile}\n人设：${actor.persona || '未填写'}`;
        }).join('\n\n');
        const recent = (run.storyLog || []).slice(-2).map(entry => `${entry.title}\n${entry.beats.map(beat => `${beat.speakerName ? `${beat.speakerName}：` : ''}${beat.text}`).join('\n')}`).join('\n\n');
        const trainingRecent = (run.training?.recentEventSummaries || []).slice(-3).join('\n') || '无';
        const common = `【固定设定】\n标题：${setup.title}\n分类：${setup.category || '剧情'}\n世界观：${setup.worldview}\n故事前提：${setup.premise}\n\n【世界书快照】\n${worldBooks || '无'}\n\n【主演】\n${cast}\n\n【当前 User 属性】\n${attributes}\n\n【累计剧情摘要】\n${run.storySummary || '尚未开始'}\n\n【事件标记】\n${(run.flags || []).join('、') || '无'}\n\n【最近养成事件】\n${trainingRecent}\n\n【最近场景】\n${recent || '无'}`;
        const schema = `只返回合法 JSON，不要 Markdown、代码围栏或解释。结构：\n{"scene":{"id":"scene-id","title":"场景标题","beats":[{"id":"beat-1","kind":"narration","text":"旁白"},{"id":"beat-2","kind":"dialogue","speakerId":"稳定角色id","speakerName":"显示姓名","text":"对话"}],"characterProfiles":[{"id":"角色稳定id","triggerBeatId":"角色首次实际登场的beat id","name":"姓名","identity":"身份定位","occupation":"职业","faction":"阵营","persona":"完整人设","attributes":[{"id":"开局User属性id","value":0}],"initialAffinity":50,"companionEligible":false}]},"outcome":{"attributeDeltas":{"属性id":0},"affinityDeltas":{"已登记角色id":0},"summary":"更新后的完整剧情摘要","flags":["新增事件标记"]},"choices":[{"id":"choice-id","text":"玩家可执行的行动","requirements":{"attributes":{"属性id":最低值},"affinities":{"已登记角色id":最低值}}}],"storySummary":"更新后的完整剧情摘要","ending":null}。characterProfiles 只为首次登场的新具名角色或档案未补全的已有角色返回；每份档案必须绑定实际登场 beat。角色 attributes 必须逐项完整复用【当前 User 属性】中的全部属性 id，数量和 id 完全一致，只由你为每项选择 0–100 整数值；禁止新增、删除、改名或输出其他属性。剧情新角色 initialAffinity 必须为 30–70；无名路人不要建档。已登记人物必须复用原 id，禁止同名重复建档。单场数值变化只能为 -10 到 10。`;
        if (phase === 'prologue') {
            return `你是中文养成文游的主笔。根据设定生成一次完整序章。序章必须有 8–14 条可逐条显示的内容，旁白与人物对话交错，对话必须有 speakerName 和稳定 speakerId；玩家角色只能使用主演快照中的真实姓名，禁止称为 U、User 或“玩家”。所有非 User 角色第一次实际登场都要按契约提供身份档案。只负责建立世界、人物关系和开局事件，不提供选项、不进行属性结算、不产生结局。\n\n${common}\n\n${schema}\n序章的 choices 必须是空数组，outcome 中所有变化为 0，ending 必须为 null。`;
        }
        const previousChoice = choice ? `玩家刚刚选择：${choice.text}（id=${choice.id}）` : '这是第一章的第一个场景，没有上一选择。';
        const canEnd = run.sceneNumber >= 8 || phase === 'epilogue';
        return `你是中文养成文游的主笔。生成下一个完整场景包：严格 12–18 条旁白/对话和 2–4 个差异明确的行动选项。先在 outcome 中结算上一选择，再写新场景。选项可以设置属性或好感度门槛，但必须至少有一个无门槛或按当前数值可满足的选项。所有对话必须使用稳定 speakerId；所有非 User 角色第一次实际登场都要按契约提供身份档案。玩家角色只能使用主演快照中的真实姓名，禁止称为 U、User 或“玩家”。如果玩家输入了不合理的自定义行动，应写出符合设定的失败尝试，不能扭曲世界规则。人物必须遵守人设，剧情要推进而非复述。${canEnd ? '如果剧情、属性和关系已经形成完整收束，可以返回自然结局；否则 ending 为 null。' : '主线不足 8 个场景，ending 必须为 null。'}\n\n${common}\n\n【本次输入】\n${previousChoice}\n\n${schema}\n${phase === 'epilogue' ? '这是结局后的番外，不要重复解锁同一个结局。' : ''}`;
    }

    hasApiConfig() {
        const config = typeof window.getApiConfig === 'function' ? window.getApiConfig() : (window.apiConfig || {});
        return !!(config?.endpoint && config?.apiKey && config?.model);
    }

    async requestJson(prompt) {
        const config = typeof window.getApiConfig === 'function' ? window.getApiConfig() : (window.apiConfig || {});
        const endpoint = window.u2Api?.resolveChatCompletionsEndpoint?.(config.endpoint || '') || '';
        if (!endpoint || !config.apiKey || !config.model) throw new Error('请先在设置中完成 API 配置');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);
        try {
            const headers = window.u2Api?.buildApiHeaders
                ? window.u2Api.buildApiHeaders(config, { 'X-U2-Silent-Errors': '1' })
                : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}`, 'X-U2-Silent-Errors': '1' };
            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: config.model,
                    temperature: Number.isFinite(Number(config.temperature)) ? Number(config.temperature) : 0.8,
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: 'json_object' }
                }),
                signal: controller.signal
            });
            if (!response.ok) {
                const detail = window.u2Api?.readApiError ? await window.u2Api.readApiError(response) : null;
                throw new Error(detail?.message || `API 请求失败（HTTP ${response.status}）`);
            }
            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? '';
            return Array.isArray(content) ? content.map(item => item?.text || item || '').join('') : String(content || '');
        } catch (error) {
            if (error?.name === 'AbortError') throw new Error('剧情生成超时，请重试');
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    setBusy(busy, message = '') {
        this.isBusy = !!busy;
        this.view.classList.toggle('is-generating', this.isBusy);
        this.view.querySelectorAll('#netflix-start-game-button, [data-choice-id], [data-training-choice-id], [data-location-id], [data-action="enter-main-game"], [data-action="continue-epilogue"], [data-action="submit-custom-choice"]').forEach(button => { button.disabled = this.isBusy; });
        if (this.generationOverlay) {
            this.generationOverlay.classList.toggle('is-active', this.isBusy && this.gameView.classList.contains('is-active'));
            this.generationOverlay.setAttribute('aria-hidden', String(!(this.isBusy && this.gameView.classList.contains('is-active'))));
            if (this.isBusy) this.generationTitle.textContent = message || '正在生成剧情…';
        }
    }

    normalizeSceneForRun(raw, phase, run) {
        return this.core.resolvePlayerSpeakerNames(this.core.normalizeScenePayload(raw, { phase, cast: run.cast, attributes: run.attributes }), run.cast);
    }

    showPendingGame(run, title, detail) {
        this.setupView.classList.remove('is-active');
        this.setupView.setAttribute('aria-hidden', 'true');
        this.gameView.classList.add('is-active');
        this.gameView.setAttribute('aria-hidden', 'false');
        this.gameView.classList.remove('is-training');
        this.gameBackdrop.style.backgroundImage = run.setup.coverUrl ? `url("${String(run.setup.coverUrl).replace(/["\\]/g, '\\$&')}")` : '';
        this.gameTitle.textContent = run.setup.title;
        this.sceneHeading.innerHTML = '<span>NEW STORY</span><strong>故事即将开始</strong>';
        this.gameStage.innerHTML = '';
        this.gameMenuButton.hidden = true;
        this.generationTitle.textContent = title || '正在生成剧情';
        this.generationDetail.textContent = detail || '正在建立世界与人物关系，请稍候。';
    }

    hidePendingGame(restoreSetup = false) {
        this.gameView.classList.remove('is-active', 'is-training');
        this.gameView.setAttribute('aria-hidden', 'true');
        if (restoreSetup) {
            this.setupView.classList.add('is-active');
            this.setupView.setAttribute('aria-hidden', 'false');
        }
    }

    createLogEntry(scene, selectedChoice = null) {
        return {
            id: scene.id,
            title: scene.title,
            phase: scene.phase,
            beats: this.core.clone(scene.beats),
            characterProfiles: this.core.clone(scene.characterProfiles || []),
            selectedChoice: selectedChoice ? { id: selectedChoice.id, text: selectedChoice.text } : null,
            createdAt: scene.createdAt || Date.now()
        };
    }

    async enterMainGame() {
        if (this.isBusy || !this.state.activeRun) return;
        const current = this.core.clone(this.state.activeRun);
        this.setBusy(true, '正在进入第一章…');
        this.generationDetail.textContent = '正在根据序章生成第一个主线场景。';
        try {
            const raw = await this.requestJson(this.buildScenePrompt(current, 'main', null));
            const scene = this.normalizeSceneForRun(raw, 'main', current);
            current.cast = this.core.mergeCharacterProfiles(current.cast, scene.characterProfiles, { sceneId: scene.id, seenAt: scene.createdAt });
            let next = this.core.applyOutcome(current, scene.outcome);
            scene.choices = this.core.ensureUnlockedChoice(scene.choices, next.attributes, next.cast);
            next.phase = scene.ending ? 'ending' : 'main';
            next.sceneNumber = 1;
            next.beatIndex = 0;
            next.currentScene = scene;
            next.storySummary = scene.storySummary || next.storySummary;
            next.storyLog.push(this.createLogEntry(scene));
            next.updatedAt = Date.now();
            this.state.activeRun = next;
            this.recordEnding(scene.ending, next);
            await this.updateAutoSave(true);
            this.renderGame();
        } catch (error) {
            console.error('[Netflix] first chapter generation failed:', error);
            this.toast(error?.message || '第一章生成失败，请重试');
            this.renderGame();
        } finally {
            this.setBusy(false);
        }
    }

    async chooseStoryOption(choiceId, providedChoice = null) {
        if (this.isBusy || !this.state.activeRun) return;
        const run = this.state.activeRun;
        const choice = providedChoice || (run.currentScene?.choices || []).find(item => item.id === choiceId);
        if (!choice) return;
        const status = this.core.getRequirementStatus(choice, run.attributes, run.cast);
        if (!status.unlocked) return this.toast('当前属性或好感度不足');
        const pending = this.core.clone(run);
        this.pendingRequestChoice = choice;
        this.setBusy(true, '选择已经送达，正在续写…');
        this.generationDetail.textContent = '选择尚未结算，请勿重复点击。';
        try {
            const phase = pending.phase === 'epilogue' ? 'epilogue' : 'main';
            const raw = await this.requestJson(this.buildScenePrompt(pending, phase, choice));
            const scene = this.normalizeSceneForRun(raw, phase, pending);
            pending.cast = this.core.mergeCharacterProfiles(pending.cast, scene.characterProfiles, { sceneId: scene.id, seenAt: scene.createdAt });
            let next = this.core.applyOutcome(pending, scene.outcome);
            scene.choices = this.core.ensureUnlockedChoice(scene.choices, next.attributes, next.cast);
            next.phase = scene.ending ? 'ending' : phase;
            next.sceneNumber += 1;
            next.beatIndex = 0;
            next.lastChoice = { id: choice.id, text: choice.text };
            const previousLog = next.storyLog[next.storyLog.length - 1];
            if (previousLog) previousLog.selectedChoice = { id: choice.id, text: choice.text };
            next.currentScene = scene;
            next.storySummary = scene.storySummary || next.storySummary;
            next.storyLog.push(this.createLogEntry(scene));
            next.updatedAt = Date.now();
            this.state.activeRun = next;
            this.customChoiceOpen = false;
            this.recordEnding(scene.ending, next);
            await this.updateAutoSave(true);
            this.renderGame();
        } catch (error) {
            console.error('[Netflix] story continuation failed:', error);
            this.toast(error?.message || '剧情生成失败，选择尚未结算');
            this.renderGame();
        } finally {
            this.pendingRequestChoice = null;
            this.setBusy(false);
        }
    }

    async continueEpilogue() {
        if (this.isBusy || !this.state.activeRun) return;
        const pending = this.core.clone(this.state.activeRun);
        pending.phase = 'epilogue';
        const choice = { id: 'continue-epilogue', text: '从当前结局继续番外', requirements: { attributes: {}, affinities: {} } };
        this.setBusy(true, '正在生成结局后的故事…');
        this.generationDetail.textContent = '正在延续当前结局与人物关系。';
        try {
            const raw = await this.requestJson(this.buildScenePrompt(pending, 'epilogue', choice));
            const scene = this.normalizeSceneForRun(raw, 'epilogue', pending);
            pending.cast = this.core.mergeCharacterProfiles(pending.cast, scene.characterProfiles, { sceneId: scene.id, seenAt: scene.createdAt });
            let next = this.core.applyOutcome(pending, scene.outcome);
            scene.ending = null;
            if (scene.choices.length < 2) {
                scene.choices = [
                    { id: 'epilogue-forward', text: '顺着眼前的生活继续前行', requirements: { attributes: {}, affinities: {} } },
                    { id: 'epilogue-reflect', text: '回望过去，再做一次新的决定', requirements: { attributes: {}, affinities: {} } }
                ];
            }
            scene.choices = this.core.ensureUnlockedChoice(scene.choices, next.attributes, next.cast);
            next.phase = 'epilogue';
            next.sceneNumber += 1;
            next.beatIndex = 0;
            next.currentScene = scene;
            next.storySummary = scene.storySummary || next.storySummary;
            next.storyLog.push(this.createLogEntry(scene));
            this.state.activeRun = next;
            await this.updateAutoSave(true);
            this.renderGame();
        } catch (error) {
            console.error('[Netflix] epilogue generation failed:', error);
            this.toast(error?.message || '番外生成失败');
            this.renderGame();
        } finally {
            this.setBusy(false);
        }
    }

    recordEnding(ending, run) {
        if (!ending) return;
        const record = { ...ending, runId: run.id, storyTitle: run.setup.title, sceneNumber: run.sceneNumber, unlockedAt: Date.now() };
        const exists = this.state.unlockedEndings.some(item => item.id === record.id && item.storyTitle === record.storyTitle);
        if (!exists) this.state.unlockedEndings.unshift(record);
    }

    openGame() {
        this.setupView.classList.remove('is-active');
        this.setupView.setAttribute('aria-hidden', 'true');
        this.gameView.classList.add('is-active');
        this.gameView.setAttribute('aria-hidden', 'false');
        this.renderGame();
    }

    renderGame() {
        const run = this.state.activeRun;
        if (!run?.currentScene) return;
        if (run.viewMode === 'training') {
            this.renderTraining();
            return;
        }
        this.gameView.classList.remove('is-training');
        this.trainingView.setAttribute('aria-hidden', 'true');
        const scene = run.currentScene;
        const beat = scene.beats[Math.min(run.beatIndex, scene.beats.length - 1)];
        this.gameBackdrop.style.backgroundImage = run.setup.coverUrl ? `url("${String(run.setup.coverUrl).replace(/["\\]/g, '\\$&')}")` : '';
        this.gameTitle.textContent = run.setup.title;
        this.sceneHeading.innerHTML = `<span>${run.phase === 'prologue' ? 'PROLOGUE' : (run.phase === 'epilogue' ? 'AFTER STORY' : `SCENE ${String(run.sceneNumber).padStart(2, '0')}`)}</span><strong>${this.escapeHtml(scene.title)}</strong>`;
        this.gameMenuButton.hidden = run.phase === 'prologue';
        if (run.beatIndex < scene.beats.length) {
            const identityActor = this.prepareIdentityCard(run, 'story', scene, run.beatIndex);
            if (identityActor) {
                this.renderStage(this.renderIdentityCardMarkup(identityActor));
                return;
            }
            this.renderStage(`<button type="button" class="netflix-dialogue-box ${beat.kind === 'narration' ? 'is-narration' : ''}" data-action="advance-dialogue">
                ${beat.kind === 'dialogue' ? `<span class="netflix-speaker-name">${this.escapeHtml(beat.speakerName)}</span>` : '<span class="netflix-narration-label">旁白</span>'}
                <span class="netflix-dialogue-text">${this.escapeHtml(beat.text)}</span>
                <span class="netflix-dialogue-progress">${run.beatIndex + 1} / ${scene.beats.length}<i class="fas fa-chevron-down"></i></span>
            </button>`);
            return;
        }
        if (run.phase === 'prologue') {
            this.renderStage(`<div class="netflix-scene-complete"><span>PROLOGUE COMPLETE</span><h2>序章结束</h2><p>故事的世界已经展开，接下来每个选择都会改变属性、关系与最终结局。</p><button type="button" class="netflix-primary-button" data-action="enter-main-game"><i class="fas fa-play"></i> 进入第一章</button></div>`);
            return;
        }
        if (scene.ending) {
            this.renderStage(`<div class="netflix-ending-panel"><span>${this.escapeHtml(scene.ending.type)}</span><h2>${this.escapeHtml(scene.ending.title)}</h2><p>${this.escapeHtml(scene.ending.summary)}</p><div><button type="button" class="netflix-secondary-button" data-action="open-load">读档</button><button type="button" class="netflix-primary-button" data-action="continue-epilogue">继续番外</button></div></div>`);
            return;
        }
        const choices = this.core.ensureUnlockedChoice(scene.choices, run.attributes, run.cast);
        scene.choices = choices;
        const training = this.core.normalizeTraining(run.training);
        run.training = training;
        const trainingSpent = training.cycleSceneNumber === run.sceneNumber && training.actionPoints <= 0;
        const customForm = this.customChoiceOpen ? `<div class="netflix-custom-choice-form"><textarea id="netflix-custom-choice-input" maxlength="200" placeholder="描述你想采取的行动……"></textarea><div><button type="button" data-action="toggle-custom-choice">取消</button><button type="button" class="netflix-primary-button" data-action="submit-custom-choice">确认行动</button></div></div>` : '';
        const auxiliary = `<div class="netflix-choice-auxiliary"><button type="button" data-action="toggle-custom-choice"><i class="fas fa-pen"></i><span><strong>自定义行动</strong><small>输入自己的选择</small></span></button>${run.phase === 'main' ? `<button type="button" data-action="enter-training" ${trainingSpent ? 'disabled' : ''}><i class="fas fa-map-marked-alt"></i><span><strong>进入养成</strong><small>${trainingSpent ? '本日行动力已用完' : '探索地图并提升能力'}</small></span></button>` : ''}</div>`;
        this.renderStage(`<div class="netflix-choice-panel"><span>YOUR CHOICE</span><h2>你准备怎么做？</h2><div>${choices.map((choice, index) => this.renderChoice(choice, index, run)).join('')}</div>${auxiliary}${customForm}</div>`);
        if (this.customChoiceOpen) requestAnimationFrame(() => this.view.querySelector('#netflix-custom-choice-input')?.focus({ preventScroll: true }));
    }

    renderStage(html) {
        this.gameStage.innerHTML = html;
        const element = this.gameStage.firstElementChild;
        if (element) {
            element.classList.add('netflix-stage-entering');
            element.addEventListener('animationend', () => element.classList.remove('netflix-stage-entering'), { once: true });
        }
    }

    prepareIdentityCard(run, scope, content, beatIndex) {
        const beat = content?.beats?.[beatIndex];
        if (!beat) return null;
        const scopeId = String(content.id || '');
        const pending = run.pendingIdentityCard;
        if (pending && pending.scope === scope && pending.scopeId === scopeId && pending.beatIndex === beatIndex) {
            const pendingActor = run.cast.find(actor => actor.id === pending.characterId);
            if (pendingActor && pendingActor.type !== 'user' && !pendingActor.acquainted && pendingActor.deferredSceneId !== scopeId) return pendingActor;
            run.pendingIdentityCard = null;
        }
        const ids = [];
        (content.characterProfiles || []).forEach(profile => {
            if (profile.triggerBeatId === beat.id && !ids.includes(profile.id)) ids.push(profile.id);
        });
        if (beat.kind === 'dialogue' && beat.speakerId && !ids.includes(beat.speakerId)) ids.push(beat.speakerId);
        const actor = ids.map(id => run.cast.find(item => item.id === id)).find(item => (
            item && item.type !== 'user' && item.profileComplete && !item.acquainted && item.deferredSceneId !== scopeId
        ));
        if (!actor) return null;
        run.pendingIdentityCard = { characterId: actor.id, scope, scopeId, beatIndex };
        run.updatedAt = Date.now();
        this.updateAutoSave(false);
        return actor;
    }

    renderIdentityCardMarkup(actor) {
        const attributes = (actor.characterAttributes || []).map(attribute => `<div><span>${this.escapeHtml(attribute.name)}</span><b>${attribute.value}</b><i><em style="width:${attribute.value}%"></em></i></div>`).join('');
        return `<article class="netflix-identity-card" aria-label="${this.escapeAttr(actor.name)}的身份卡">
            <span class="netflix-identity-eyebrow">NEW CHARACTER</span>
            <header>${this.renderAvatarMarkup(actor)}<div><small>${this.escapeHtml(actor.identity)}</small><h2>${this.escapeHtml(actor.name)}</h2><p>${this.escapeHtml(actor.occupation)} · ${this.escapeHtml(actor.faction)}</p></div></header>
            <p class="netflix-identity-persona">${this.escapeHtml(actor.persona)}</p>
            <div class="netflix-identity-traits">${attributes}</div>
            <div class="netflix-identity-actions"><button type="button" data-action="defer-character">暂不结识</button><button type="button" class="netflix-primary-button" data-action="acquaint-character"><i class="fas fa-handshake"></i> 结识</button></div>
        </article>`;
    }

    async resolveIdentityCard(acquaint) {
        const run = this.state.activeRun;
        const pending = run?.pendingIdentityCard;
        if (this.isBusy || !pending) return;
        const actor = run.cast.find(item => item.id === pending.characterId && item.type !== 'user');
        if (!actor) return;
        if (acquaint) {
            actor.acquainted = true;
            actor.acquaintedAt = Date.now();
            actor.acquaintedSceneId = pending.scopeId;
            actor.deferredSceneId = '';
        } else {
            actor.deferredSceneId = pending.scopeId;
        }
        run.pendingIdentityCard = null;
        run.updatedAt = Date.now();
        await this.updateAutoSave(true);
        this.renderGame();
    }

    renderChoice(choice, index, run) {
        const status = this.core.getRequirementStatus(choice, run.attributes, run.cast);
        const requirementLabels = [
            ...Object.entries(choice.requirements?.attributes || {}).map(([id, min]) => `${this.findAttributeName(id, run)} ${min}`),
            ...Object.entries(choice.requirements?.affinities || {}).map(([id, min]) => `${this.findActorName(id, run)}好感 ${min}`)
        ];
        return `<button type="button" data-choice-id="${this.escapeAttr(choice.id)}" ${status.unlocked ? '' : 'disabled'}><b>${String.fromCharCode(65 + index)}</b><span><strong>${this.escapeHtml(choice.text)}</strong>${requirementLabels.length ? `<small class="${status.unlocked ? '' : 'is-locked'}"><i class="fas ${status.unlocked ? 'fa-check-circle' : 'fa-lock'}"></i> ${this.escapeHtml(requirementLabels.join(' · '))}</small>` : '<small><i class="fas fa-unlock"></i> 无门槛</small>'}</span></button>`;
    }

    findAttributeName(id, run = this.state.activeRun) {
        return run?.attributes?.find(item => item.id === id)?.name || id;
    }

    findActorName(id, run = this.state.activeRun) {
        return run?.cast?.find(item => item.id === id)?.name || id;
    }

    advanceDialogue() {
        if (this.isBusy || this.isTransitioning || !this.state.activeRun?.currentScene) return;
        const commit = () => {
            const run = this.state.activeRun;
            if (!run?.currentScene) return;
            if (run.beatIndex < run.currentScene.beats.length) run.beatIndex += 1;
            run.updatedAt = Date.now();
            this.updateAutoSave(false);
            this.renderGame();
        };
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || this.state.uiSettings?.reduceMotion) return commit();
        this.isTransitioning = true;
        this.gameStage.firstElementChild?.classList.add('netflix-stage-leaving');
        setTimeout(() => {
            commit();
            setTimeout(() => { this.isTransitioning = false; }, 170);
        }, 90);
    }

    toggleCustomChoice() {
        if (this.isBusy) return;
        this.customChoiceOpen = !this.customChoiceOpen;
        this.renderGame();
    }

    submitCustomChoice() {
        if (this.isBusy || !this.state.activeRun) return;
        const input = this.view.querySelector('#netflix-custom-choice-input');
        const text = String(input?.value || '').trim().slice(0, 200);
        if (!text) return this.toast('请输入自定义行动');
        const choice = { id: `custom-${Date.now()}`, text, requirements: { attributes: {}, affinities: {} }, isCustom: true };
        this.chooseStoryOption(choice.id, choice);
    }

    async enterTraining() {
        const run = this.state.activeRun;
        if (this.isBusy || !run || run.phase !== 'main' || run.currentScene?.ending || run.beatIndex < run.currentScene.beats.length) return;
        const pending = this.core.clone(run);
        pending.training = this.core.normalizeTraining(pending.training);
        if (pending.training.cycleSceneNumber !== pending.sceneNumber) {
            pending.training.day += 1;
            pending.training.actionPoints = 3;
            pending.training.cycleSceneNumber = pending.sceneNumber;
            pending.training.currentEvent = null;
            pending.training.eventBeatIndex = 0;
        }
        if (pending.training.actionPoints <= 0) return this.toast('本日行动力已用完，请先推进主线');
        pending.storyReturnPoint = { sceneId: pending.currentScene.id, beatIndex: pending.beatIndex };
        if (!pending.training.map) {
            this.setBusy(true, '正在生成养成地图…');
            this.generationDetail.textContent = '正在把世界观转换为可探索地点。';
            try {
                pending.training.map = await this.requestTrainingMap(pending);
            } catch (error) {
                console.error('[Netflix] training map generation failed:', error);
                this.toast(error?.message || '地图生成失败，请重试');
                return;
            } finally {
                this.setBusy(false);
            }
        }
        pending.viewMode = 'training';
        this.state.activeRun = pending;
        this.customChoiceOpen = false;
        await this.updateAutoSave(true);
        this.resetMapView(false);
        this.renderTraining();
    }

    async requestTrainingMap(run) {
        const raw = await this.requestJson(this.buildMapPrompt(run));
        return this.core.normalizeMapPayload(raw);
    }

    buildMapPrompt(run) {
        const setup = run.setup || {};
        const books = (setup.worldBooks || []).map(book => `《${book.name}》${book.content}`).join('\n') || '无';
        const attributes = (run.attributes || []).map(item => `${item.id}=${item.name}`).join('、');
        const cast = (run.cast || []).filter(actor => actor.type === 'user' || (actor.acquainted && actor.companionEligible)).map(actor => `${actor.id}=${actor.name}`).join('、');
        return `你是中文养成文游的地图设计师。根据以下资料生成一张可长期探索的互动节点地图。只返回合法 JSON，不要 Markdown。\n\n标题：${setup.title}\n世界观：${setup.worldview}\n故事前提：${setup.premise}\n当前剧情：${run.storySummary || '序章之后'}\n世界书：${books}\n属性 id：${attributes}\n主演 id：${cast}\n\n严格结构：{"map":{"id":"英文id","name":"地图名","description":"地图整体说明","nodes":[{"id":"英文唯一id","name":"地点名","description":"地点介绍","type":"地点类型","icon":"Font Awesome 图标类名，如 fa-school","x":5到95的整数,"y":8到92的整数,"focusAttributes":["属性id"],"featuredCastIds":["主演id"]}],"edges":[{"from":"地点id","to":"地点id"}]}}。nodes 必须 6–10 个，分布不能重叠；edges 必须全部引用有效节点并让地图整体连通。`;
    }

    buildTrainingEventPrompt(run, location) {
        const training = run.training;
        const companion = run.cast.find(actor => actor.id === training.companionId && actor.type !== 'user');
        const familiarity = training.familiarityByLocation[location.id] || 0;
        const attributes = run.attributes.map(item => `${item.id}（${item.name}）=${item.value}`).join('；');
        const cast = run.cast.map(actor => `${actor.id} | ${actor.name}${actor.type === 'user' ? ' | 玩家本人' : ` | ${actor.acquainted ? '已结识' : '未结识'} | 好感度${actor.affinity}`} | ${actor.persona || '未填写'}${actor.profileComplete ? '' : ' | 档案待补全'}`).join('\n');
        return `你是中文养成文游的事件设计师。为一次地点行动生成完整小剧情。只返回合法 JSON，不要 Markdown。\n\n作品：${run.setup.title}\n世界观：${run.setup.worldview}\n主线摘要：${run.storySummary}\n地点：${location.name}（${location.type}）\n地点说明：${location.description}\n熟悉度：${familiarity}/5\n同行角色：${companion ? `${companion.id} | ${companion.name} | ${companion.persona}` : '独自行动'}\n当前属性：${attributes}\n已登记人物：\n${cast}\n已有事件标记：${run.flags.join('、') || '无'}\n最近事件，严禁重复冲突和桥段：\n${training.recentEventSummaries.slice(-12).join('\n') || '无'}\n\n严格结构：{"event":{"id":"英文id","locationId":"${location.id}","title":"事件标题","summary":"事件摘要","beats":[{"id":"beat-1","kind":"narration","text":"旁白"},{"id":"beat-2","kind":"dialogue","speakerId":"稳定角色id","speakerName":"显示姓名","text":"对话"}],"characterProfiles":[{"id":"角色稳定id","triggerBeatId":"实际登场beat id","name":"姓名","identity":"身份定位","occupation":"职业","faction":"阵营","persona":"完整人设","attributes":[{"id":"开局User属性id","value":50}],"initialAffinity":50,"companionEligible":false}],"choices":[{"id":"a","text":"行动选项","outcome":{"attributeDeltas":{"属性id":0},"affinityDeltas":{"已登记角色id":0},"flags":["事件标记"],"summary":"选择结果摘要"}},{"id":"b","text":"另一行动","outcome":{"attributeDeltas":{},"affinityDeltas":{},"flags":[],"summary":"选择结果摘要"}}]}}。beats 必须 3–6 条，choices 必须恰好 2 个。首次实际登场的新具名角色或档案待补全角色必须提供 characterProfiles；角色 attributes 必须逐项完整复用“当前属性”中的全部属性 id，数量和 id 完全一致，只选择每项 0–100 整数值，禁止新增、删除、改名或输出其他属性；新角色初始好感 30–70，无名路人不要建档，已登记人物必须复用原 id。每个数值变化只能为 -5 到 5；不能产生结局。玩家角色必须显示快照姓名，禁止称为 U、User 或“玩家”。`;
    }

    renderTraining() {
        const run = this.state.activeRun;
        if (!run?.training?.map) return;
        const training = run.training;
        this.gameView.classList.add('is-training');
        this.trainingView.setAttribute('aria-hidden', 'false');
        this.trainingDay.textContent = `DAY ${String(Math.max(1, training.day)).padStart(2, '0')}`;
        this.trainingTitle.textContent = training.map.name;
        this.renderTrainingHud(run);
        this.renderMap(run);
        this.renderTrainingEvent(run);
    }

    renderTrainingHud(run) {
        const training = run.training;
        const companions = run.cast.filter(actor => actor.type !== 'user' && actor.acquainted && actor.companionEligible);
        const recommended = this.getRecommendedLocationIds(run);
        const objective = recommended.size ? `根据当前锁定选项，推荐 ${recommended.size} 个地点` : '自由探索，寻找新的剧情标记';
        this.trainingHud.innerHTML = `<div class="netflix-training-status"><span><i class="fas fa-bolt"></i> 行动力 <b>${training.actionPoints}/3</b></span><span><i class="fas fa-bullseye"></i> ${this.escapeHtml(objective)}</span></div><div class="netflix-training-toolbar"><div class="netflix-companion-picker"><span>同行</span><button type="button" data-action="select-companion" data-companion-id="" class="${training.companionId ? '' : 'is-active'}">独自</button>${companions.map(actor => `<button type="button" data-action="select-companion" data-companion-id="${this.escapeAttr(actor.id)}" class="${training.companionId === actor.id ? 'is-active' : ''}">${this.escapeHtml(actor.name)}</button>`).join('')}</div><div><button type="button" data-action="toggle-map-layout" class="${this.mapEditMode ? 'is-active' : ''}"><i class="fas fa-arrows-alt"></i> ${this.mapEditMode ? '完成布局' : '调整位置'}</button><button type="button" data-action="open-map-editor"><i class="fas fa-edit"></i> 编辑地图</button></div></div>`;
    }

    getRecommendedLocationIds(run) {
        const missingAttributes = new Set();
        const missingCast = new Set();
        (run.currentScene?.choices || []).forEach(choice => {
            this.core.getRequirementStatus(choice, run.attributes, run.cast).missing.forEach(item => {
                if (item.kind === 'attribute') missingAttributes.add(item.id);
                if (item.kind === 'affinity') missingCast.add(item.id);
            });
        });
        return new Set((run.training?.map?.nodes || []).filter(node => node.focusAttributes.some(id => missingAttributes.has(id)) || node.featuredCastIds.some(id => missingCast.has(id))).map(node => node.id));
    }

    renderMap(run) {
        const map = run.training.map;
        const recommended = this.getRecommendedLocationIds(run);
        const byId = new Map(map.nodes.map(node => [node.id, node]));
        const lines = map.edges.map(edge => {
            const from = byId.get(edge.from);
            const to = byId.get(edge.to);
            if (!from || !to) return '';
            return `<line x1="${from.x}%" y1="${from.y}%" x2="${to.x}%" y2="${to.y}%"></line>`;
        }).join('');
        this.mapCanvas.innerHTML = `<svg class="netflix-map-routes" aria-hidden="true">${lines}</svg>${map.nodes.map(node => {
            const familiarity = run.training.familiarityByLocation[node.id] || 0;
            return `<button type="button" class="netflix-map-node ${recommended.has(node.id) ? 'is-recommended' : ''} ${this.mapEditMode ? 'is-editing' : ''}" data-location-id="${this.escapeAttr(node.id)}" style="left:${node.x}%;top:${node.y}%" aria-label="${this.escapeAttr(node.name)}，熟悉度 ${familiarity}"><i class="fas ${this.escapeAttr(node.icon)}"></i><span><strong>${this.escapeHtml(node.name)}</strong><small>${this.escapeHtml(node.type)} · 熟悉 ${familiarity}/5</small></span>${recommended.has(node.id) ? '<em>推荐</em>' : ''}</button>`;
        }).join('')}`;
        this.applyMapTransform();
    }

    async openTrainingLocation(locationId) {
        const run = this.state.activeRun;
        if (this.mapEditMode || this.mapDragMoved || this.isBusy || !run?.training?.map || run.viewMode !== 'training') return;
        if (run.training.currentEvent || run.training.eventResult) return;
        if (run.training.actionPoints <= 0) return this.toast('本日行动力已用完');
        const location = run.training.map.nodes.find(node => node.id === locationId);
        if (!location) return;
        const pending = this.core.clone(run);
        this.setBusy(true, `正在探索${location.name}…`);
        this.generationDetail.textContent = '正在生成不会重复的地点小剧情。';
        try {
            const raw = await this.requestJson(this.buildTrainingEventPrompt(pending, location));
            let event = this.core.normalizeTrainingEventPayload(raw, location.id, { cast: pending.cast, attributes: pending.attributes });
            const resolved = this.core.resolvePlayerSpeakerNames({ beats: event.beats }, pending.cast);
            if (resolved?.beats) event = { ...event, beats: resolved.beats };
            pending.cast = this.core.mergeCharacterProfiles(pending.cast, event.characterProfiles, { sceneId: event.id, seenAt: event.createdAt });
            pending.training.currentEvent = event;
            pending.training.eventBeatIndex = 0;
            pending.training.eventResult = null;
            this.state.activeRun = pending;
            await this.updateAutoSave(true);
            this.renderTraining();
        } catch (error) {
            console.error('[Netflix] training event generation failed:', error);
            this.toast(error?.message || '地点剧情生成失败，请重试');
        } finally {
            this.setBusy(false);
        }
    }

    renderTrainingEvent(run) {
        const training = run.training;
        const event = training.currentEvent;
        const result = training.eventResult;
        if (!event && !result) {
            this.trainingEvent.classList.remove('is-active');
            this.trainingEvent.setAttribute('aria-hidden', 'true');
            this.trainingEvent.innerHTML = '';
            return;
        }
        if (result) {
            const attributeChanges = (result.attributeChanges || []).map(change => `<div><span>${this.escapeHtml(change.name)}</span><b class="${change.delta > 0 ? 'is-positive' : 'is-negative'}">${change.delta > 0 ? '+' : ''}${change.delta}</b><small>${change.before} → ${change.after}</small></div>`).join('');
            const affinityChanges = (result.affinityChanges || []).map(change => `<div><span>${this.escapeHtml(change.name)}好感</span><b class="${change.delta > 0 ? 'is-positive' : 'is-negative'}">${change.delta > 0 ? '+' : ''}${change.delta}</b><small>${change.before} → ${change.after}</small></div>`).join('');
            const changes = `${attributeChanges}${affinityChanges}` || '<p class="netflix-training-result-empty">本次行动没有改变属性或好感度。</p>';
            const flags = (result.flags || []).length ? `<div class="netflix-training-result-flags"><span>获得事件标记</span>${result.flags.map(flag => `<b>${this.escapeHtml(flag)}</b>`).join('')}</div>` : '';
            const content = `<div class="netflix-training-result"><span>ACTION RESULT</span><h2>行动结算</h2><strong>${this.escapeHtml(result.choiceText)}</strong><p>${this.escapeHtml(result.summary || '这次行动已经结束。')}</p><div class="netflix-training-result-values">${changes}</div>${flags}<button type="button" class="netflix-primary-button" data-action="dismiss-training-result">返回地图 · 剩余 ${result.actionPoints} 点行动力</button></div>`;
            this.trainingEvent.innerHTML = `<div class="netflix-training-event-card">${content}</div>`;
            this.trainingEvent.classList.add('is-active');
            this.trainingEvent.setAttribute('aria-hidden', 'false');
            return;
        }
        const beat = event.beats[Math.min(training.eventBeatIndex, event.beats.length - 1)];
        let content;
        if (training.eventBeatIndex < event.beats.length) {
            const identityActor = this.prepareIdentityCard(run, 'training', event, training.eventBeatIndex);
            content = identityActor
                ? this.renderIdentityCardMarkup(identityActor)
                : `<button type="button" class="netflix-training-dialogue ${beat.kind === 'narration' ? 'is-narration' : ''}" data-action="advance-training-event">${beat.kind === 'dialogue' ? `<span>${this.escapeHtml(beat.speakerName)}</span>` : '<span>旁白</span>'}<strong>${this.escapeHtml(beat.text)}</strong><small>${training.eventBeatIndex + 1} / ${event.beats.length} <i class="fas fa-chevron-down"></i></small></button>`;
        } else {
            content = `<div class="netflix-training-event-choices"><span>EVENT CHOICE</span><h2>${this.escapeHtml(event.title)}</h2>${event.choices.map((choice, index) => `<button type="button" data-training-choice-id="${this.escapeAttr(choice.id)}"><b>${String.fromCharCode(65 + index)}</b><strong>${this.escapeHtml(choice.text)}</strong></button>`).join('')}</div>`;
        }
        this.trainingEvent.innerHTML = `<div class="netflix-training-event-card">${content}</div>`;
        this.trainingEvent.classList.add('is-active');
        this.trainingEvent.setAttribute('aria-hidden', 'false');
    }

    advanceTrainingEvent() {
        const run = this.state.activeRun;
        if (this.isBusy || this.isTransitioning || !run?.training?.currentEvent) return;
        const commit = () => {
            run.training.eventBeatIndex = Math.min(run.training.currentEvent.beats.length, run.training.eventBeatIndex + 1);
            this.updateAutoSave(false);
            this.renderTrainingEvent(run);
        };
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || this.state.uiSettings?.reduceMotion) return commit();
        this.isTransitioning = true;
        this.trainingEvent.firstElementChild?.classList.add('netflix-stage-leaving');
        setTimeout(() => {
            commit();
            this.trainingEvent.firstElementChild?.classList.add('netflix-stage-entering');
            setTimeout(() => { this.isTransitioning = false; }, 170);
        }, 90);
    }

    async resolveTrainingChoice(choiceId) {
        const run = this.state.activeRun;
        const event = run?.training?.currentEvent;
        if (this.isBusy || !event || run.training.eventBeatIndex < event.beats.length) return;
        const choice = event.choices.find(item => item.id === choiceId);
        if (!choice) return;
        const before = this.core.clone(run);
        let next = this.core.applyTrainingOutcome(run, choice.outcome);
        const training = next.training;
        training.actionPoints = Math.max(0, training.actionPoints - 1);
        training.familiarityByLocation[event.locationId] = Math.min(5, (training.familiarityByLocation[event.locationId] || 0) + 1);
        const summary = choice.outcome.summary || event.summary || `${event.title}：${choice.text}`;
        training.eventLog.push({ ...this.core.clone(event), selectedChoice: { id: choice.id, text: choice.text }, resolvedAt: Date.now() });
        training.eventLog = training.eventLog.slice(-200);
        training.recentEventSummaries.push(summary);
        training.recentEventSummaries = training.recentEventSummaries.slice(-12);
        const beforeAttributes = new Map((before.attributes || []).map(attribute => [attribute.id, attribute]));
        const beforeCast = new Map((before.cast || []).map(actor => [actor.id, actor]));
        training.eventResult = {
            eventId: event.id,
            title: event.title,
            choiceText: choice.text,
            summary,
            attributeChanges: (next.attributes || []).map(attribute => {
                const previous = beforeAttributes.get(attribute.id);
                return previous && previous.value !== attribute.value ? { id: attribute.id, name: attribute.name, before: previous.value, after: attribute.value, delta: attribute.value - previous.value } : null;
            }).filter(Boolean),
            affinityChanges: (next.cast || []).map(actor => {
                const previous = beforeCast.get(actor.id);
                return actor.type !== 'user' && previous && previous.affinity !== actor.affinity ? { id: actor.id, name: actor.name, before: previous.affinity, after: actor.affinity, delta: actor.affinity - previous.affinity } : null;
            }).filter(Boolean),
            flags: [...(choice.outcome.flags || [])],
            actionPoints: training.actionPoints,
            resolvedAt: Date.now()
        };
        training.currentEvent = null;
        training.eventBeatIndex = 0;
        next.updatedAt = Date.now();
        this.state.activeRun = next;
        await this.updateAutoSave(true);
        this.renderTraining();
    }

    async dismissTrainingResult() {
        const run = this.state.activeRun;
        if (this.isBusy || !run?.training?.eventResult) return;
        run.training.eventResult = null;
        run.updatedAt = Date.now();
        await this.updateAutoSave(true);
        this.renderTraining();
    }

    closeTrainingEvent() {
        if (this.state.activeRun?.training?.currentEvent) this.toast('请先读完并选择本次行动结果');
        else if (this.state.activeRun?.training?.eventResult) this.toast('请先确认本次行动结算');
    }

    selectTrainingCompanion(id) {
        const run = this.state.activeRun;
        if (!run?.training || this.isBusy) return;
        const valid = !id || run.cast.some(actor => actor.id === id && actor.type !== 'user' && actor.acquainted && actor.companionEligible);
        if (!valid) return;
        run.training.companionId = id || '';
        this.updateAutoSave(false);
        this.renderTrainingHud(run);
    }

    continueStory() {
        const run = this.state.activeRun;
        if (this.isBusy || !run) return;
        if (run.training?.currentEvent) return this.toast('请先完成当前地点事件');
        if (run.training?.eventResult) return this.toast('请先确认本次行动结算');
        run.viewMode = 'story';
        if (run.storyReturnPoint) run.beatIndex = this.core.clampInt(run.storyReturnPoint.beatIndex, 0, run.currentScene.beats.length, run.beatIndex);
        run.storyReturnPoint = null;
        this.mapEditMode = false;
        this.updateAutoSave(false);
        this.renderGame();
    }

    continueContext() {
        this.closeSheet(this.menuSheet);
        if (this.state.activeRun?.viewMode === 'training') this.continueStory();
    }

    openMapEditor() {
        const map = this.state.activeRun?.training?.map;
        if (!map || this.isBusy) return;
        this.mapEditorDraft = this.core.clone(map);
        this.renderMapEditor();
        this.openSheet(this.mapEditorSheet);
    }

    renderMapEditor() {
        const map = this.mapEditorDraft;
        if (!map) return;
        const edgeText = map.edges.map(edge => `${edge.from} > ${edge.to}`).join('\n');
        this.mapEditorBody.innerHTML = `<label class="netflix-field"><span>地图名称</span><input type="text" maxlength="40" data-map-field="name" value="${this.escapeAttr(map.name)}"></label><label class="netflix-field"><span>整体说明</span><textarea maxlength="320" data-map-field="description">${this.escapeHtml(map.description || '')}</textarea></label><div class="netflix-map-editor-heading"><h3>地点 ${map.nodes.length}/12</h3><button type="button" data-action="add-map-node" ${map.nodes.length >= 12 ? 'disabled' : ''}><i class="fas fa-plus"></i> 添加地点</button></div><div class="netflix-map-editor-nodes">${map.nodes.map(node => `<article data-map-node-editor="${this.escapeAttr(node.id)}"><header><strong>${this.escapeHtml(node.name)}</strong><button type="button" data-action="delete-map-node" data-map-node-id="${this.escapeAttr(node.id)}" ${map.nodes.length <= 4 ? 'disabled' : ''} aria-label="删除地点"><i class="fas fa-trash-alt"></i></button></header><div><label><span>名称</span><input type="text" maxlength="30" data-node-field="name" value="${this.escapeAttr(node.name)}"></label><label><span>类型</span><input type="text" maxlength="20" data-node-field="type" value="${this.escapeAttr(node.type)}"></label><label class="is-wide"><span>介绍</span><textarea maxlength="240" data-node-field="description">${this.escapeHtml(node.description)}</textarea></label><label><span>X 位置</span><input type="number" min="5" max="95" data-node-field="x" value="${node.x}"></label><label><span>Y 位置</span><input type="number" min="8" max="92" data-node-field="y" value="${node.y}"></label><label class="is-wide"><span>关联属性 ID（逗号分隔）</span><input type="text" data-node-field="focusAttributes" value="${this.escapeAttr(node.focusAttributes.join(','))}"></label><label class="is-wide"><span>关联主演 ID（逗号分隔）</span><input type="text" data-node-field="featuredCastIds" value="${this.escapeAttr(node.featuredCastIds.join(','))}"></label></div></article>`).join('')}</div><label class="netflix-field"><span>地点连线（每行：地点ID &gt; 地点ID）</span><textarea data-map-field="edges" spellcheck="false">${this.escapeHtml(edgeText)}</textarea></label><div class="netflix-map-editor-actions"><button type="button" class="netflix-secondary-button" data-action="regenerate-map"><i class="fas fa-sync-alt"></i> 重新生成</button><button type="button" class="netflix-primary-button" data-action="save-map-editor"><i class="fas fa-save"></i> 保存地图</button></div>`;
    }

    collectMapEditorDraft() {
        if (!this.mapEditorDraft) return null;
        const draft = this.core.clone(this.mapEditorDraft);
        const root = this.mapEditorBody;
        draft.name = root.querySelector('[data-map-field="name"]')?.value || draft.name;
        draft.description = root.querySelector('[data-map-field="description"]')?.value || '';
        draft.nodes = [...root.querySelectorAll('[data-map-node-editor]')].map(card => {
            const original = draft.nodes.find(node => node.id === card.dataset.mapNodeEditor);
            const read = field => card.querySelector(`[data-node-field="${field}"]`)?.value;
            return {
                ...original,
                name: read('name'),
                type: read('type'),
                description: read('description'),
                x: read('x'),
                y: read('y'),
                focusAttributes: String(read('focusAttributes') || '').split(',').map(value => value.trim()).filter(Boolean),
                featuredCastIds: String(read('featuredCastIds') || '').split(',').map(value => value.trim()).filter(Boolean)
            };
        });
        draft.edges = String(root.querySelector('[data-map-field="edges"]')?.value || '').split(/\r?\n/).map(line => line.split(/>|→/).map(value => value.trim())).filter(parts => parts.length === 2).map(([from, to]) => ({ from, to }));
        return draft;
    }

    addMapNode() {
        const draft = this.collectMapEditorDraft();
        if (!draft || draft.nodes.length >= 12) return;
        const id = `location-${Date.now().toString(36)}`;
        const previous = draft.nodes[draft.nodes.length - 1];
        draft.nodes.push({ id, name: '新地点', description: '填写这个地点的环境与用途。', type: '剧情地点', icon: 'fa-map-marker-alt', x: 50, y: 50, focusAttributes: [], featuredCastIds: [] });
        if (previous) draft.edges.push({ from: previous.id, to: id });
        this.mapEditorDraft = draft;
        this.renderMapEditor();
    }

    deleteMapNode(id) {
        const draft = this.collectMapEditorDraft();
        if (!draft || draft.nodes.length <= 4) return;
        draft.nodes = draft.nodes.filter(node => node.id !== id);
        draft.edges = draft.edges.filter(edge => edge.from !== id && edge.to !== id);
        this.mapEditorDraft = draft;
        this.renderMapEditor();
    }

    async saveMapEditor() {
        const run = this.state.activeRun;
        if (!run?.training || this.isBusy) return;
        try {
            const map = this.core.normalizeMapPayload({ map: this.collectMapEditorDraft() }, { manual: true });
            run.training.map = map;
            const ids = new Set(map.nodes.map(node => node.id));
            run.training.familiarityByLocation = Object.entries(run.training.familiarityByLocation).reduce((result, [id, value]) => {
                if (ids.has(id)) result[id] = value;
                return result;
            }, {});
            await this.updateAutoSave(true);
            this.closeSheet(this.mapEditorSheet);
            this.renderTraining();
            this.toast('地图已保存');
        } catch (error) {
            this.toast(error?.message || '地图信息不完整');
        }
    }

    async regenerateMap() {
        const run = this.state.activeRun;
        if (this.isBusy || !run || !window.confirm('重新生成会替换地点、连线和熟悉度，已获得的属性与事件记录会保留。是否继续？')) return;
        this.closeSheet(this.mapEditorSheet);
        const pending = this.core.clone(run);
        this.setBusy(true, '正在重新生成地图…');
        this.generationDetail.textContent = '正在重建地点与路线，原有数值不会改变。';
        try {
            pending.training.map = await this.requestTrainingMap(pending);
            pending.training.familiarityByLocation = {};
            pending.training.currentEvent = null;
            pending.training.eventBeatIndex = 0;
            this.state.activeRun = pending;
            await this.updateAutoSave(true);
            this.resetMapView(false);
            this.renderTraining();
        } catch (error) {
            console.error('[Netflix] map regeneration failed:', error);
            this.toast(error?.message || '地图重新生成失败');
        } finally {
            this.setBusy(false);
        }
    }

    toggleMapLayout() {
        if (this.isBusy) return;
        this.mapEditMode = !this.mapEditMode;
        if (!this.mapEditMode) this.updateAutoSave(false);
        this.renderTraining();
    }

    applyMapTransform() {
        if (!this.mapCanvas) return;
        const { x, y, scale } = this.mapTransform;
        this.mapCanvas.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    }

    zoomMap(delta) {
        this.mapTransform.scale = Math.max(0.75, Math.min(1.6, this.mapTransform.scale + delta));
        this.applyMapTransform();
    }

    resetMapView(render = true) {
        this.mapTransform = { x: 0, y: 0, scale: 1 };
        if (render) this.applyMapTransform();
    }

    handleMapWheel(event) {
        if (this.state.activeRun?.viewMode !== 'training') return;
        event.preventDefault();
        this.zoomMap(event.deltaY > 0 ? -0.1 : 0.1);
    }

    handleMapPointerDown(event) {
        if (this.state.activeRun?.viewMode !== 'training' || this.isBusy) return;
        this.mapViewport.setPointerCapture?.(event.pointerId);
        this.mapPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const node = event.target.closest('[data-location-id]');
        if (this.mapPointers.size === 2) {
            const points = [...this.mapPointers.values()];
            this.mapGesture = { mode: 'pinch', distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), scale: this.mapTransform.scale };
        } else {
            this.mapGesture = { mode: this.mapEditMode && node ? 'node' : 'pan', startX: event.clientX, startY: event.clientY, originX: this.mapTransform.x, originY: this.mapTransform.y, nodeId: node?.dataset.locationId || '', moved: false };
        }
    }

    handleMapPointerMove(event) {
        if (!this.mapPointers.has(event.pointerId) || !this.mapGesture) return;
        this.mapPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (this.mapPointers.size >= 2) {
            const points = [...this.mapPointers.values()];
            const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
            if (this.mapGesture.mode !== 'pinch') this.mapGesture = { mode: 'pinch', distance, scale: this.mapTransform.scale };
            this.mapTransform.scale = Math.max(0.75, Math.min(1.6, this.mapGesture.scale * (distance / Math.max(1, this.mapGesture.distance))));
            this.applyMapTransform();
            this.mapDragMoved = true;
            return;
        }
        const dx = event.clientX - this.mapGesture.startX;
        const dy = event.clientY - this.mapGesture.startY;
        if (Math.abs(dx) + Math.abs(dy) > 5) this.mapGesture.moved = this.mapDragMoved = true;
        if (this.mapGesture.mode === 'pan') {
            this.mapTransform.x = this.mapGesture.originX + dx;
            this.mapTransform.y = this.mapGesture.originY + dy;
            this.applyMapTransform();
        } else if (this.mapGesture.mode === 'node') {
            const node = this.state.activeRun?.training?.map?.nodes.find(item => item.id === this.mapGesture.nodeId);
            if (!node) return;
            const rect = this.mapCanvas.getBoundingClientRect();
            node.x = this.core.clampInt(((event.clientX - rect.left) / Math.max(1, rect.width)) * 100, 5, 95, node.x);
            node.y = this.core.clampInt(((event.clientY - rect.top) / Math.max(1, rect.height)) * 100, 8, 92, node.y);
            const element = [...this.mapCanvas.querySelectorAll('[data-location-id]')].find(item => item.dataset.locationId === node.id);
            if (element) { element.style.left = `${node.x}%`; element.style.top = `${node.y}%`; }
        }
    }

    handleMapPointerUp(event) {
        if (!this.mapPointers.has(event.pointerId)) return;
        const movedNode = this.mapGesture?.mode === 'node' && this.mapGesture.moved;
        this.mapPointers.delete(event.pointerId);
        if (this.mapPointers.size === 1) {
            const point = [...this.mapPointers.values()][0];
            this.mapGesture = { mode: 'pan', startX: point.x, startY: point.y, originX: this.mapTransform.x, originY: this.mapTransform.y, moved: true };
        } else if (!this.mapPointers.size) {
            this.mapGesture = null;
            if (movedNode) {
                this.renderMap(this.state.activeRun);
                this.updateAutoSave(false);
            }
            setTimeout(() => { this.mapDragMoved = false; }, 0);
        }
    }

    createSnapshot(run = this.state.activeRun) {
        if (!run?.currentScene) return null;
        return this.core.normalizeSnapshot({
            id: `save-${Date.now()}`,
            title: run.setup.title,
            phase: run.phase,
            sceneNumber: run.sceneNumber,
            beatIndex: run.beatIndex,
            savedAt: Date.now(),
            run: this.core.clone(run)
        });
    }

    async updateAutoSave(flush = false) {
        const snapshot = this.createSnapshot();
        if (!snapshot) return false;
        this.state.activeRun = this.core.clone(snapshot.run);
        this.state.saveSlots.auto = snapshot;
        return this.saveState({ flush });
    }

    openSaves(mode = 'load') {
        if (this.isBusy) return this.toast('剧情生成期间暂不能操作存档');
        this.saveModalMode = mode === 'save' ? 'save' : 'load';
        this.saveTitle.textContent = this.saveModalMode === 'save' ? '保存进度' : 'Progress';
        this.renderSaveSlots();
        this.closeSheet(this.menuSheet);
        this.openSheet(this.saveSheet);
    }

    renderSaveSlots() {
        const auto = this.state.saveSlots.auto;
        const slots = this.state.saveSlots.manual;
        this.saveList.innerHTML = `
            <section class="netflix-save-group"><h3>自动存档</h3>${this.renderSaveSlot(auto, 'auto', -1)}</section>
            <section class="netflix-save-group"><h3>手动存档</h3>${slots.map((snapshot, index) => this.renderSaveSlot(snapshot, 'manual', index)).join('')}</section>`;
    }

    renderSaveSlot(snapshot, kind, index) {
        const label = kind === 'auto' ? 'AUTO' : `SLOT ${index + 1}`;
        if (!snapshot) {
            return `<article class="netflix-save-slot is-empty"><span>${label}</span><div><strong>空存档</strong><small>还没有故事记录</small></div>${this.saveModalMode === 'save' && kind === 'manual' && this.state.activeRun ? `<button type="button" data-action="save-slot" data-slot-index="${index}">保存</button>` : ''}</article>`;
        }
        const savedTime = new Date(snapshot.savedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const phase = snapshot.run?.viewMode === 'training' ? `养成 DAY ${snapshot.run.training?.day || 1}` : (snapshot.phase === 'prologue' ? '序章' : (snapshot.phase === 'ending' ? '结局' : (snapshot.phase === 'epilogue' ? '番外' : `场景 ${snapshot.sceneNumber}`)));
        return `<article class="netflix-save-slot"><span>${label}</span><div><strong>${this.escapeHtml(snapshot.title)}</strong><small>${phase} · 对话 ${snapshot.beatIndex + 1} · ${savedTime}</small></div><div class="netflix-save-actions">${this.saveModalMode === 'save' && kind === 'manual' ? `<button type="button" data-action="save-slot" data-slot-index="${index}" aria-label="覆盖存档"><i class="fas fa-save"></i></button>` : `<button type="button" data-action="load-slot" data-slot-kind="${kind}" data-slot-index="${index}" aria-label="读取存档"><i class="fas fa-play"></i></button>`}${kind === 'manual' ? `<button type="button" class="is-danger" data-action="delete-save" data-slot-index="${index}" aria-label="删除存档"><i class="fas fa-trash-alt"></i></button>` : ''}</div></article>`;
    }

    async writeManualSave(index) {
        if (this.isBusy || !this.state.activeRun || index < 0 || index >= this.core.MANUAL_SLOT_COUNT) return;
        if (this.state.saveSlots.manual[index] && !window.confirm(`覆盖手动存档 ${index + 1}？`)) return;
        this.state.saveSlots.manual[index] = this.createSnapshot();
        const saved = await this.saveState({ flush: true });
        if (saved) this.toast(`已保存到槽位 ${index + 1}`);
        this.renderSaveSlots();
        this.renderProfile();
    }

    async loadSave(kind, index) {
        if (this.isBusy) return;
        const snapshot = kind === 'auto' ? this.state.saveSlots.auto : this.state.saveSlots.manual[index];
        if (!snapshot) return;
        if (this.state.activeRun && !window.confirm(`读取“${snapshot.title}”？当前进度会由自动档保存后切换。`)) return;
        if (this.state.activeRun) await this.updateAutoSave(true);
        this.state.activeRun = this.core.clone(snapshot.run);
        this.state.saveSlots.auto = this.createSnapshot(this.state.activeRun);
        await this.saveState({ flush: true });
        this.closeSheet(this.saveSheet);
        this.closeSheet(this.menuSheet);
        this.closeSetup();
        this.openGame();
        this.toast('存档已读取');
    }

    async deleteManualSave(index) {
        if (index < 0 || index >= this.core.MANUAL_SLOT_COUNT || !this.state.saveSlots.manual[index]) return;
        if (!window.confirm(`删除手动存档 ${index + 1}？删除后无法恢复。`)) return;
        this.state.saveSlots.manual[index] = null;
        await this.saveState({ flush: true });
        this.renderSaveSlots();
        this.renderProfile();
    }

    openGameMenu() {
        if (this.isBusy || this.state.activeRun?.phase === 'prologue') return;
        const training = this.state.activeRun?.viewMode === 'training';
        const label = this.menuContinue?.querySelector('span');
        if (label) label.textContent = training ? '继续剧情' : '继续游戏';
        this.openSheet(this.menuSheet);
    }

    showAttributes() {
        const run = this.state.activeRun;
        if (!run) return;
        this.infoTitle.textContent = 'User 属性';
        this.infoBody.innerHTML = `<section class="netflix-stats-section"><div class="netflix-stat-list">${run.attributes.map(attribute => `<div><span>${this.escapeHtml(attribute.name)}</span><b>${attribute.value}</b><i><em style="width:${attribute.value}%"></em></i></div>`).join('')}</div></section>`;
        this.closeSheet(this.menuSheet);
        this.openSheet(this.infoSheet);
    }

    showRelations(closeMenu = true) {
        const run = this.state.activeRun;
        if (!run) return;
        const relations = run.cast.filter(actor => actor.type !== 'user' && actor.acquainted);
        this.infoTitle.textContent = '关系';
        this.infoBody.innerHTML = relations.length ? `<div class="netflix-relation-list">${relations.map(actor => `<button type="button" data-action="show-character-detail" data-character-id="${this.escapeAttr(actor.id)}">${this.renderAvatarMarkup(actor)}<span><strong>${this.escapeHtml(actor.name)}</strong><small>${this.escapeHtml(actor.identity || '档案待补充')}</small></span><b><small>好感</small>${actor.affinity}</b><i class="fas fa-chevron-right"></i></button>`).join('')}</div>` : '<div class="netflix-empty-state">还没有结识任何角色。角色首次登场时，可以通过身份卡选择结识。</div>';
        if (closeMenu) this.closeSheet(this.menuSheet);
        this.openSheet(this.infoSheet);
    }

    showCharacterDetail(characterId) {
        const run = this.state.activeRun;
        const actor = run?.cast?.find(item => item.id === characterId && item.type !== 'user' && item.acquainted);
        if (!actor) return;
        const firstMet = actor.acquaintedAt ? new Date(actor.acquaintedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '旧存档关系';
        const attributes = actor.characterAttributes?.length
            ? actor.characterAttributes.map(attribute => `<div><span>${this.escapeHtml(attribute.name)}</span><b>${attribute.value}</b><i><em style="width:${attribute.value}%"></em></i></div>`).join('')
            : '<div class="netflix-character-profile-empty">属性档案待补充，角色下次登场时会自动完善。</div>';
        this.infoTitle.textContent = actor.name;
        this.infoBody.innerHTML = `<article class="netflix-character-profile"><button type="button" class="netflix-info-back" data-action="back-to-relations"><i class="fas fa-chevron-left"></i> 返回关系</button><header>${this.renderAvatarMarkup(actor)}<div><span>${this.escapeHtml(actor.identity || '档案待补充')}</span><h3>${this.escapeHtml(actor.name)}</h3><p>${this.escapeHtml(actor.occupation || '未知职业')} · ${this.escapeHtml(actor.faction || '未知阵营')}</p></div></header><p>${this.escapeHtml(actor.persona || '暂无人物介绍')}</p><section><div class="netflix-character-affinity"><span>好感度</span><b>${actor.affinity}</b><i><em style="width:${actor.affinity}%"></em></i></div><h4>角色属性</h4><div class="netflix-character-traits">${attributes}</div></section><footer><span><i class="fas fa-handshake"></i> ${this.escapeHtml(actor.acquaintedSceneId || '已有关系')} · ${firstMet}</span><span><i class="fas fa-walking"></i> ${actor.companionEligible ? '可在养成中同行' : '暂不可同行'}</span></footer></article>`;
    }

    showHistory() {
        const run = this.state.activeRun;
        if (!run) return;
        this.infoTitle.textContent = '剧情回看';
        const story = (run.storyLog || []).slice().reverse().map(entry => `<article><span>${this.escapeHtml(entry.phase === 'prologue' ? '序章' : entry.title)}</span>${entry.beats.map(beat => `<p>${beat.speakerName ? `<b>${this.escapeHtml(beat.speakerName)}</b>` : ''}${this.escapeHtml(beat.text)}</p>`).join('')}${entry.selectedChoice ? `<div><i class="fas fa-angle-right"></i> ${this.escapeHtml(entry.selectedChoice.text)}</div>` : ''}</article>`).join('');
        const training = (run.training?.eventLog || []).slice().reverse().map(entry => `<article><span>养成 · ${this.escapeHtml(entry.title)}</span>${entry.beats.map(beat => `<p>${beat.speakerName ? `<b>${this.escapeHtml(beat.speakerName)}</b>` : ''}${this.escapeHtml(beat.text)}</p>`).join('')}${entry.selectedChoice ? `<div><i class="fas fa-angle-right"></i> ${this.escapeHtml(entry.selectedChoice.text)}</div>` : ''}</article>`).join('');
        this.infoBody.innerHTML = `<div class="netflix-history-list">${story}${training}</div>`;
        this.closeSheet(this.menuSheet);
        this.openSheet(this.infoSheet);
    }

    showEndings() {
        this.infoTitle.textContent = 'Ending Collection';
        this.infoBody.innerHTML = this.state.unlockedEndings.length ? `<div class="netflix-ending-list">${this.state.unlockedEndings.map(ending => `<article><span>${this.escapeHtml(ending.type)}</span><h3>${this.escapeHtml(ending.title)}</h3><p>${this.escapeHtml(ending.summary)}</p><small>${this.escapeHtml(ending.storyTitle || '')} · ${new Date(ending.unlockedAt).toLocaleDateString('zh-CN')}</small></article>`).join('')}</div>` : '<div class="netflix-empty-state">When vodka cuts sharply through my throat, I remember the cold wind blowing from Siberia, and your eyes.</div>';
        this.openSheet(this.infoSheet);
    }

    showWorldBooksInfo() {
        const books = this.getWorldBooks();
        this.infoTitle.textContent = 'World Book';
        this.infoBody.innerHTML = books.length ? `<div class="netflix-book-list">${books.map(book => `<article><i class="fas fa-book"></i><span><strong>${this.escapeHtml(book.name || '未命名世界书')}</strong><small>${Array.isArray(book.entries) ? book.entries.length : 0} Entry</small></span></article>`).join('')}</div><p class="netflix-info-note">Between my consciousness and your lips, there lies a sea without a path.</p>` : '<div class="netflix-empty-state">Tonight, my voice is a train that has been intercepted, and your name is the long national border of Russia.</div>';
        this.openSheet(this.infoSheet);
    }

    restartGame() {
        if (this.isBusy || !this.state.activeRun) return;
        if (!window.confirm('重新开始会覆盖自动档，手动存档不会受影响。是否继续？')) return;
        const setup = this.state.activeRun.setup;
        this.setupDraft = {
            sourceId: setup.sourceId,
            title: setup.title,
            category: setup.category,
            coverUrl: setup.coverUrl,
            worldview: setup.worldview,
            premise: setup.premise,
            worldBookIds: (setup.worldBooks || []).map(book => book.id),
            cast: this.core.clone(setup.cast),
            attributes: this.core.createDefaultAttributes()
        };
        this.state.activeRun = null;
        this.state.saveSlots.auto = null;
        this.saveState({ flush: true });
        this.closeSheet(this.menuSheet);
        this.gameView.classList.remove('is-active');
        this.gameView.setAttribute('aria-hidden', 'true');
        this.renderSetup();
        this.setupView.classList.add('is-active');
        this.setupView.setAttribute('aria-hidden', 'false');
    }

    returnToNetflix() {
        if (this.isBusy) return;
        if (this.state.activeRun) this.updateAutoSave(true);
        this.closeSheet(this.menuSheet);
        this.closeSheet(this.saveSheet);
        this.closeSheet(this.infoSheet);
        this.closeSheet(this.mapEditorSheet);
        this.gameView.classList.remove('is-active');
        this.gameView.setAttribute('aria-hidden', 'true');
        this.setupView.classList.remove('is-active');
        this.setupView.setAttribute('aria-hidden', 'true');
        this.renderHome();
        this.renderProfile();
    }

    upsertRecent(setup) {
        const item = this.normalizeCatalogItem({
            id: setup.sourceId,
            title: setup.title,
            category: setup.category,
            summary: setup.premise,
            coverUrl: setup.coverUrl,
            cast: setup.cast.filter(actor => actor.type !== 'user')
        }, setup.sourceId);
        const catalog = this.normalizeCatalog(this.state.homeCatalog);
        catalog.recent = [item, ...catalog.recent.filter(existing => existing.id !== item.id)].slice(0, 8);
        this.state.homeCatalog = catalog;
    }

    openSheet(sheet) {
        if (!sheet) return;
        sheet.classList.add('is-active');
        sheet.setAttribute('aria-hidden', 'false');
    }

    closeSheet(sheet) {
        if (!sheet) return;
        sheet.classList.remove('is-active');
        sheet.setAttribute('aria-hidden', 'true');
    }

    toast(message) {
        if (typeof window.showToast === 'function') window.showToast(message);
        else console.warn('[Netflix]', message);
    }

    escapeHtml(value = '') {
        return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    }

    escapeAttr(value = '') {
        return this.escapeHtml(value).replace(/`/g, '&#96;');
    }

    open() {
        if (!this.view) return;
        this.isOpen = true;
        this.view.style.display = 'flex';
        this.view.classList.add('active');
        this.switchTab('home');
    }

    close() {
        if (this.isBusy) return this.toast('剧情生成中，请稍候');
        if (this.state.activeRun) this.updateAutoSave(true);
        this.isOpen = false;
        this.view.classList.remove('active');
        this.view.style.display = 'none';
    }
}

function initializeNetflixApp() {
    try {
        window.netflixApp = new NetflixApp();
        if (window.globalDataReadyPromise?.then) {
            window.netflixDataReadyPromise = window.globalDataReadyPromise.then(() => {
                if (!window.netflixApp) return false;
                window.netflixApp.state = window.netflixApp.loadState();
                window.netflixApp.renderHome();
                window.netflixApp.renderProfile();
                return true;
            }).catch(error => {
                console.warn('[Netflix] durable state recovery failed:', error);
                return false;
            });
        } else {
            window.netflixDataReadyPromise = Promise.resolve(true);
        }
    } catch (error) {
        document.documentElement.dataset.netflixInitError = error?.stack || error?.message || String(error);
        console.error('[Netflix] initialization failed:', error);
    }
}

(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(initializeNetflixApp);
