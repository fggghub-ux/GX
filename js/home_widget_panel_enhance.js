(function () {
    'use strict';

    const SETTINGS_KEY = 'homeWidgetPanelEnhanceSettings';
    const DESKTOP_STATE_KEY = 'desktop';

    const WIDGET_DEFAULTS = {
        profile: { color: 'rgba(255, 255, 255, 0.7)' },
        pet: { color: 'rgba(255, 255, 255, 0.7)' },
        music: { color: 'rgba(255, 255, 255, 0.7)' },
        couple: { color: 'rgba(255, 255, 255, 0.85)' },
        photo: { color: 'rgba(255, 255, 255, 0.7)' },
        notification: { color: 'rgba(255, 255, 255, 0.7)' }
    };

    const WIDGET_TEXT_DEFAULTS = {
        profileTitle: 'i 🤍uuu so..@kendall',
        profilePosts: '19',
        profileFollowers: '7119.1K',
        profileFollowing: '8',
        petText: 'irrelevant',
        musicTitle: 'But...',
        musicArtist: '- Drake',
        musicLyric1: 'Whit no makeup she a ten',
        musicLyric2: 'And she the best with that head',
        musicLyric3: 'Even better than Karrine',
        coupleLeft: '-.-',
        coupleRight: 'TT',
        photoTitle: 'callmekim',
        photoBody: '',
        notificationTitle: 'Entanglement',
        notificationDesc: 'If it’s not mine, it’s not special.'
    };

    const WIDGET_TEXT_FIELDS = {
        profile: [
            { key: 'profileTitle', label: '名称' },
            { key: 'profilePosts', label: 'Posts' },
            { key: 'profileFollowers', label: 'Followers' },
            { key: 'profileFollowing', label: 'Following' }
        ],
        pet: [
            { key: 'petText', label: '气泡文字' }
        ],
        music: [
            { key: 'musicTitle', label: '标题' },
            { key: 'musicLyric1', label: '歌词 1' },
            { key: 'musicLyric2', label: '歌词 2' },
            { key: 'musicLyric3', label: '歌词 3' }
        ],
        couple: [
            { key: 'coupleLeft', label: '左侧文字' },
            { key: 'coupleRight', label: '右侧文字' }
        ],
        notification: [
            { key: 'notificationTitle', label: '标题' },
            { key: 'notificationDesc', label: '内容', multiline: true }
        ]
    };

    const WIDGET_IMAGE_FIELDS = {
        profile: [{ key: 'avatar', label: '头像' }],
        pet: [{ key: 'pet', label: '图片' }],
        music: [{ key: 'cover', label: '封面' }],
        couple: [
            { key: 'left', label: '左侧图片' },
            { key: 'right', label: '右侧图片' }
        ],
        photo: [
            { key: 'photo', label: '图片 1' },
            { key: 'photo2', label: '图片 2' },
            { key: 'photo3', label: '图片 3' }
        ],
        notification: [{ key: 'avatar', label: '头像' }]
    };

    let libraryObserver = null;
    let batteryLevel = 100;

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        ensureStatusBar();
        ensurePanelSwitches();
        applyHomeChromeSettings();
        enhanceLibraryWhenReady();
        updateStatusClock();
        setInterval(updateStatusClock, 30000);
        initBattery();
    }

    function loadSettings() {
        try {
            const parsed = window.StorageManager?.load(SETTINGS_KEY, {}) || {};
            return {
                showStatusBar: parsed.showStatusBar === true,
                showSearch: parsed.showSearch !== false
            };
        } catch (error) {
            return { showStatusBar: false, showSearch: true };
        }
    }

    function saveSettings(next) {
        window.StorageManager?.save(SETTINGS_KEY, next);
    }

    function getDesktopState() {
        try {
            if (typeof window.getAppState === 'function') {
                const state = window.getAppState(DESKTOP_STATE_KEY);
                if (state && typeof state === 'object') return state;
            }
        } catch (error) {
            console.warn('[home_widget_panel_enhance] getAppState failed', error);
        }

        try {
            if (window.StorageManager && typeof window.StorageManager.load === 'function') {
                const state = window.StorageManager.load('home_desktop_state');
                if (state && typeof state === 'object') return state;
            }
        } catch (error) {
            console.warn('[home_widget_panel_enhance] StorageManager load failed', error);
        }

        return null;
    }

    function setDesktopState(state) {
        try {
            if (typeof window.setAppState === 'function') {
                window.setAppState(DESKTOP_STATE_KEY, state);
                return;
            }
        } catch (error) {
            console.warn('[home_widget_panel_enhance] setAppState failed', error);
        }

        try {
            if (window.StorageManager && typeof window.StorageManager.save === 'function') {
                window.StorageManager.save('home_desktop_state', state);
            }
        } catch (error) {
            console.warn('[home_widget_panel_enhance] StorageManager save failed', error);
        }
    }

    function ensurePanelSwitches() {
        const form = document.querySelector('.home-widget-form');
        const library = document.getElementById('home-widget-library');
        if (!form || !library || document.getElementById('home-panel-chrome-settings')) return;

        const settings = loadSettings();
        const group = document.createElement('div');
        group.className = 'home-widget-panel-settings';
        group.id = 'home-panel-chrome-settings';

        group.appendChild(createSettingRow({
            title: '显示状态栏',
            desc: '顶部时间、电量等仿 iPhone 状态',
            inputId: 'home-statusbar-toggle',
            checked: settings.showStatusBar,
            onChange: function (checked) {
                const next = Object.assign({}, loadSettings(), { showStatusBar: checked });
                saveSettings(next);
                applyHomeChromeSettings();
            }
        }));

        group.appendChild(createSettingRow({
            title: '显示搜索',
            desc: '主界面底栏上方 Search 样式',
            inputId: 'home-search-toggle',
            checked: settings.showSearch,
            onChange: function (checked) {
                const next = Object.assign({}, loadSettings(), { showSearch: checked });
                saveSettings(next);
                applyHomeChromeSettings();
            }
        }));

        form.insertBefore(group, library);
    }

    function createSettingRow(options) {
        const row = document.createElement('div');
        row.className = 'home-widget-setting-row';

        const text = document.createElement('div');
        const title = document.createElement('span');
        title.textContent = options.title;
        const desc = document.createElement('small');
        desc.textContent = options.desc;
        text.appendChild(title);
        text.appendChild(desc);

        const label = document.createElement('label');
        label.className = 'toggle-switch';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = options.inputId;
        input.checked = !!options.checked;

        const slider = document.createElement('span');
        slider.className = 'slider';

        input.addEventListener('change', function () {
            options.onChange(input.checked);
        });

        label.appendChild(input);
        label.appendChild(slider);
        row.appendChild(text);
        row.appendChild(label);

        return row;
    }

    function applyHomeChromeSettings() {
        const settings = loadSettings();
        document.body.classList.toggle('home-statusbar-visible', settings.showStatusBar);
        document.body.classList.toggle('home-search-hidden', !settings.showSearch);

        const statusToggle = document.getElementById('home-statusbar-toggle');
        const searchToggle = document.getElementById('home-search-toggle');
        if (statusToggle) statusToggle.checked = settings.showStatusBar;
        if (searchToggle) searchToggle.checked = settings.showSearch;
    }

    function ensureStatusBar() {
        const app = document.getElementById('app');
        if (!app || document.getElementById('home-ios-status-bar')) return;

        const bar = document.createElement('div');
        bar.className = 'home-ios-status-bar';
        bar.id = 'home-ios-status-bar';

        const left = document.createElement('div');
        left.className = 'home-ios-status-left';
        left.id = 'home-ios-status-time';
        left.textContent = '9:41';

        const right = document.createElement('div');
        right.className = 'home-ios-status-right';

        const signal = document.createElement('i');
        signal.className = 'fas fa-signal';

        const wifi = document.createElement('i');
        wifi.className = 'fas fa-wifi';

        const battery = document.createElement('div');
        battery.className = 'home-ios-battery';
        battery.setAttribute('aria-label', 'battery');

        const batteryLevelEl = document.createElement('div');
        batteryLevelEl.className = 'home-ios-battery-level';
        batteryLevelEl.id = 'home-ios-battery-level';

        battery.appendChild(batteryLevelEl);
        right.appendChild(signal);
        right.appendChild(wifi);
        right.appendChild(battery);

        bar.appendChild(left);
        bar.appendChild(right);
        app.insertBefore(bar, app.firstChild);
    }

    function updateStatusClock() {
        const timeEl = document.getElementById('home-ios-status-time');
        if (!timeEl) return;

        const now = new Date();
        timeEl.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');

        const batteryEl = document.getElementById('home-ios-battery-level');
        if (batteryEl) {
            batteryEl.style.setProperty('--battery-level', Math.max(8, Math.min(100, batteryLevel)) + '%');
        }
    }

    function initBattery() {
        if (!navigator.getBattery) return;

        navigator.getBattery().then(function (battery) {
            const sync = function () {
                batteryLevel = Math.round((battery.level || 1) * 100);
                updateStatusClock();
            };

            sync();
            battery.addEventListener('levelchange', sync);
        }).catch(function () {});
    }

    function enhanceLibraryWhenReady() {
        const library = document.getElementById('home-widget-library');
        if (!library) {
            setTimeout(enhanceLibraryWhenReady, 250);
            return;
        }

        enhanceLibraryCards();

        if (libraryObserver) libraryObserver.disconnect();
        libraryObserver = new MutationObserver(enhanceLibraryCards);
        libraryObserver.observe(library, { childList: true });

        bindScrollFriendlyLibraryTouch(library);
        library.addEventListener('click', onLibraryClick, true);
        library.addEventListener('input', onLibraryInput, true);
        library.addEventListener('change', onLibraryChange, true);
    }

    function bindScrollFriendlyLibraryTouch(library) {
        if (library.dataset.scrollFriendlyTouchBound === '1') return;
        library.dataset.scrollFriendlyTouchBound = '1';

        let startX = 0;
        let startY = 0;
        let moved = false;

        library.addEventListener('pointerdown', function (event) {
            if (event.pointerType !== 'touch') return;
            startX = event.clientX;
            startY = event.clientY;
            moved = false;
        }, { passive: true });

        library.addEventListener('pointermove', function (event) {
            if (event.pointerType !== 'touch') return;
            const dx = Math.abs(event.clientX - startX);
            const dy = Math.abs(event.clientY - startY);
            if (dx > 8 || dy > 8) moved = true;
        }, { passive: true });

        library.addEventListener('click', function (event) {
            if (!moved) return;
            event.preventDefault();
            event.stopPropagation();
            moved = false;
        }, true);
    }

    function enhanceLibraryCards() {
        const library = document.getElementById('home-widget-library');
        if (!library) return;

        library.querySelectorAll('.home-widget-library-card').forEach(function (card) {
            const widgetId = card.dataset.widgetId;
            if (!widgetId) return;

            if (card.classList.contains('is-added')) {
                card.disabled = false;
                card.removeAttribute('role');
                card.removeAttribute('tabindex');
                card.setAttribute('aria-expanded', card.classList.contains('home-widget-card-expanded') ? 'true' : 'false');

                if (!card.querySelector('.home-widget-card-chevron')) {
                    const toggle = document.createElement('button');
                    toggle.className = 'home-widget-card-chevron';
                    toggle.type = 'button';
                    toggle.setAttribute(
                        'aria-label',
                        card.classList.contains('home-widget-card-expanded') ? '收起小组件设置' : '展开小组件设置'
                    );

                    const icon = document.createElement('i');
                    icon.className = 'fas fa-chevron-down';
                    toggle.appendChild(icon);
                    card.appendChild(toggle);
                }

                if (!card.querySelector('.home-widget-card-controls')) {
                    card.appendChild(createControls(card));
                } else {
                    syncControl(card);
                }
            } else {
                card.classList.remove('home-widget-card-expanded');

                const controls = card.querySelector('.home-widget-card-controls');
                if (controls) controls.remove();

                const chevron = card.querySelector('.home-widget-card-chevron');
                if (chevron) chevron.remove();
            }
        });
    }

    function onLibraryClick(event) {
        const toggle = event.target.closest('.home-widget-card-chevron');
        const card = toggle && toggle.closest('.home-widget-library-card.is-added');
        if (!card) return;

        event.preventDefault();
        event.stopPropagation();

        card.classList.toggle('home-widget-card-expanded');
        const isExpanded = card.classList.contains('home-widget-card-expanded');
        card.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        toggle.setAttribute('aria-label', isExpanded ? '收起小组件设置' : '展开小组件设置');
        syncControl(card);
    }

    function onLibraryInput(event) {
        const imageUrlInput = event.target.closest('.home-widget-image-url-input');
        if (imageUrlInput) {
            const card = imageUrlInput.closest('.home-widget-library-card');
            const widgetId = card && card.dataset.widgetId;
            const field = imageUrlInput.dataset.imageField;
            const src = imageUrlInput.value.trim();
            if (!widgetId || !field) return;

            if (!src || isRemoteImageUrl(src)) {
                setWidgetImage(widgetId, field, src);
                syncImageButton(card, field, src);
            }
            return;
        }

        const textField = event.target.closest('.home-widget-text-input');
        if (textField) {
            const card = textField.closest('.home-widget-library-card');
            const widgetId = card && card.dataset.widgetId;
            const field = textField.dataset.textField;
            if (!widgetId || !field) return;

            setWidgetText(widgetId, field, textField.value);
            return;
        }

        const slider = event.target.closest('.home-widget-opacity-slider');
        if (!slider) return;
        const card = slider.closest('.home-widget-library-card');
        const widgetId = card && card.dataset.widgetId;
        const widgetType = (card && card.dataset.widgetType) || resolveWidgetType(widgetId);
        if (!widgetId || !widgetType) return;

        const alpha = Number(slider.value) / 100;
        setWidgetAlpha(widgetId, widgetType, alpha);
        syncControl(card, alpha);
    }

    function onLibraryChange(event) {
        const imageInput = event.target.closest('.home-widget-image-input');
        if (!imageInput) return;

        const card = imageInput.closest('.home-widget-library-card');
        const widgetId = card && card.dataset.widgetId;
        const field = imageInput.dataset.imageField;
        const file = imageInput.files && imageInput.files[0];
        imageInput.value = '';
        if (!widgetId || !field || !file) return;

        readWidgetImage(file).then(function (imageData) {
            setWidgetImage(widgetId, field, imageData);
            syncImageButton(card, field, imageData);
        }).catch(function (error) {
            console.warn('[home_widget_panel_enhance] image read failed', error);
        });
    }

    function createControls(card) {
        const widgetId = card.dataset.widgetId;
        const widgetType = card.dataset.widgetType || resolveWidgetType(widgetId);
        const alpha = getWidgetAlpha(widgetId, widgetType);
        const config = getWidgetConfig(widgetId, widgetType);

        const panel = document.createElement('div');
        panel.className = 'home-widget-card-controls';

        const textSection = document.createElement('div');
        textSection.className = 'home-widget-editor-section';
        textSection.appendChild(createSectionTitle('内容'));
        const textFields = WIDGET_TEXT_FIELDS[widgetType] || [];
        textFields.forEach(function (field) {
            textSection.appendChild(createTextField(field, config));
        });

        const imageFields = WIDGET_IMAGE_FIELDS[widgetType] || [];
        const imageSection = document.createElement('div');
        imageSection.className = 'home-widget-editor-section';
        imageSection.appendChild(createSectionTitle('图片'));
        imageFields.forEach(function (field) {
            imageSection.appendChild(createImageField(field, config));
        });

        const label = document.createElement('div');
        label.className = 'home-widget-opacity-label';

        const labelText = document.createElement('span');
        labelText.textContent = '组件背景透明度';

        const value = document.createElement('span');
        value.className = 'home-widget-opacity-value';
        value.textContent = Math.round(alpha * 100) + '%';

        label.appendChild(labelText);
        label.appendChild(value);

        const row = document.createElement('div');
        row.className = 'home-widget-opacity-row';

        const slider = document.createElement('input');
        slider.className = 'home-widget-opacity-slider';
        slider.type = 'range';
        slider.min = '0';
        slider.max = '100';
        slider.step = '1';
        slider.value = String(Math.round(alpha * 100));
        slider.setAttribute('aria-label', '组件背景透明度');

        const resetBtn = document.createElement('button');
        resetBtn.className = 'home-widget-reset-btn';
        resetBtn.type = 'button';
        resetBtn.title = '重置透明度';
        resetBtn.setAttribute('aria-label', '重置透明度');

        const resetIcon = document.createElement('i');
        resetIcon.className = 'fas fa-rotate-left';
        resetBtn.appendChild(resetIcon);

        resetBtn.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();

            const type = card.dataset.widgetType || resolveWidgetType(widgetId);
            resetWidgetAlpha(widgetId, type);
            syncControl(card);
        });

        row.appendChild(slider);
        row.appendChild(resetBtn);

        const opacitySection = document.createElement('div');
        opacitySection.className = 'home-widget-editor-section';
        opacitySection.appendChild(label);
        opacitySection.appendChild(row);

        if (textFields.length) panel.appendChild(textSection);
        if (imageFields.length) panel.appendChild(imageSection);
        panel.appendChild(opacitySection);

        return panel;
    }

    function createSectionTitle(text) {
        const title = document.createElement('div');
        title.className = 'home-widget-editor-title';
        title.textContent = text;
        return title;
    }

    function createTextField(field, config) {
        const label = document.createElement('label');
        label.className = 'home-widget-editor-field';

        const title = document.createElement('span');
        title.textContent = field.label;

        const input = document.createElement(field.multiline ? 'textarea' : 'input');
        input.className = 'home-widget-text-input';
        input.dataset.textField = field.key;
        input.value = getWidgetTextValue(config, field.key);
        if (!field.multiline) input.type = 'text';
        if (field.multiline) input.rows = 2;

        label.appendChild(title);
        label.appendChild(input);
        return label;
    }

    function createImageField(field, config) {
        const row = document.createElement('div');
        row.className = 'home-widget-image-field';

        const button = document.createElement('button');
        button.className = 'home-widget-image-btn';
        button.type = 'button';
        button.dataset.imageField = field.key;
        button.setAttribute('aria-label', '更换' + field.label);

        const src = getWidgetImageValue(config, field.key);
        const preview = document.createElement('span');
        preview.className = 'home-widget-image-thumb';
        preview.dataset.imageField = field.key;
        setImageThumb(preview, src);

        const text = document.createElement('span');
        text.textContent = field.label;

        const icon = document.createElement('i');
        icon.className = 'fas fa-image';

        button.appendChild(preview);
        button.appendChild(text);
        button.appendChild(icon);

        const input = document.createElement('input');
        input.className = 'home-widget-image-input';
        input.type = 'file';
        input.accept = 'image/*';
        input.dataset.imageField = field.key;

        const urlInput = document.createElement('input');
        urlInput.className = 'home-widget-image-url-input';
        urlInput.type = 'url';
        urlInput.inputMode = 'url';
        urlInput.placeholder = '图片链接 URL';
        urlInput.dataset.imageField = field.key;
        urlInput.value = isRemoteImageUrl(src) ? src : '';

        button.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            input.click();
        });

        row.appendChild(button);
        row.appendChild(input);
        row.appendChild(urlInput);
        return row;
    }
    function syncControl(card, forcedAlpha) {
        const widgetId = card && card.dataset.widgetId;
        const widgetType = (card && card.dataset.widgetType) || resolveWidgetType(widgetId);
        if (!widgetId || !widgetType) return;

        const config = getWidgetConfig(widgetId, widgetType);
        const alpha = typeof forcedAlpha === 'number' ? forcedAlpha : getWidgetAlpha(widgetId, widgetType);
        const value = Math.round(alpha * 100);

        const slider = card.querySelector('.home-widget-opacity-slider');
        const label = card.querySelector('.home-widget-opacity-value');
        if (slider) slider.value = String(value);
        if (label) label.textContent = value + '%';

        card.querySelectorAll('.home-widget-text-input').forEach(function (input) {
            const focused = document.activeElement === input;
            if (!focused) input.value = getWidgetTextValue(config, input.dataset.textField);
        });

        card.querySelectorAll('.home-widget-image-thumb').forEach(function (thumb) {
            setImageThumb(thumb, getWidgetImageValue(config, thumb.dataset.imageField));
        });

        card.querySelectorAll('.home-widget-image-url-input').forEach(function (input) {
            const focused = document.activeElement === input;
            const src = getWidgetImageValue(config, input.dataset.imageField);
            if (!focused) input.value = isRemoteImageUrl(src) ? src : '';
        });
    }

    function syncImageButton(card, field, src) {
        if (!card || !field) return;
        const thumb = card.querySelector('.home-widget-image-thumb[data-image-field="' + cssEscape(field) + '"]');
        if (thumb) setImageThumb(thumb, src);
        const input = card.querySelector('.home-widget-image-url-input[data-image-field="' + cssEscape(field) + '"]');
        if (input && document.activeElement !== input) input.value = isRemoteImageUrl(src) ? src : '';
    }

    function resolveWidgetType(widgetId) {
        const state = getDesktopState();
        return (state && state.widgets && state.widgets[widgetId] && state.widgets[widgetId].type) || inferTypeFromId(widgetId);
    }

    function inferTypeFromId(widgetId) {
        const id = widgetId || '';
        if (id.includes('profile')) return 'profile';
        if (id.includes('pet')) return 'pet';
        if (id.includes('music')) return 'music';
        if (id.includes('couple')) return 'couple';
        if (id.includes('notification')) return 'notification';
        return 'photo';
    }

    function getWidgetConfig(widgetId, widgetType) {
        const type = widgetType || resolveWidgetType(widgetId) || 'photo';
        const state = getDesktopState();
        const current = state && state.widgets && state.widgets[widgetId] ? state.widgets[widgetId] : {};
        return {
            type,
            color: current.color || (WIDGET_DEFAULTS[type] && WIDGET_DEFAULTS[type].color) || 'rgba(255,255,255,0.7)',
            text: Object.assign({}, WIDGET_TEXT_DEFAULTS, current.text || {}),
            images: Object.assign({}, current.images || {})
        };
    }

    function getWidgetTextValue(config, field) {
        return String((config && config.text && config.text[field]) || WIDGET_TEXT_DEFAULTS[field] || '');
    }

    function getWidgetImageValue(config, field) {
        return (config && config.images && config.images[field]) || '';
    }

    function setWidgetText(widgetId, field, value) {
        const config = getWidgetConfig(widgetId);
        config.text[field] = value;
        updateWidgetConfig(widgetId, { text: config.text });
    }

    function setWidgetImage(widgetId, field, value) {
        const config = getWidgetConfig(widgetId);
        config.images[field] = value;
        updateWidgetConfig(widgetId, { images: config.images });
    }

    function updateWidgetConfig(widgetId, patch) {
        if (!widgetId || !patch) return null;

        if (typeof window.updateHomeWidgetConfigFromPanel === 'function') {
            return window.updateHomeWidgetConfigFromPanel(widgetId, patch);
        }

        const state = getDesktopState();
        if (!state || !state.widgets) return null;
        const type = patch.type || resolveWidgetType(widgetId) || 'photo';
        const current = state.widgets[widgetId] || {};
        const next = Object.assign({}, current, patch, {
            type: current.type || type,
            text: Object.assign({}, WIDGET_TEXT_DEFAULTS, current.text || {}, patch.text || {}),
            images: Object.assign({}, current.images || {}, patch.images || {})
        });
        state.widgets[widgetId] = next;
        setDesktopState(state);
        if (typeof window.renderHomeDesktop === 'function') window.renderHomeDesktop();
        return next;
    }

    function setImageThumb(thumb, src) {
        if (!thumb) return;
        const value = src || '';
        if (thumb.dataset.thumbSrc === value) return;
        thumb.dataset.thumbSrc = value;

        thumb.innerHTML = '';
        if (value) {
            const img = document.createElement('img');
            img.src = value;
            img.alt = '';
            thumb.appendChild(img);
        } else {
            const icon = document.createElement('i');
            icon.className = 'fas fa-image';
            thumb.appendChild(icon);
        }
    }

    function isRemoteImageUrl(value) {
        return /^https?:\/\//i.test(String(value || '').trim());
    }

    function readWidgetImage(file) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onload = function (event) {
                const raw = event.target && event.target.result;
                if (!raw || typeof raw !== 'string') {
                    reject(new Error('Failed to read image'));
                    return;
                }
                if (window.compressImage) {
                    window.compressImage(raw, 512, 512, resolve);
                } else {
                    resolve(raw);
                }
            };
            reader.onerror = function () {
                reject(new Error('Failed to read image'));
            };
            reader.readAsDataURL(file);
        });
    }

    function cssEscape(value) {
        if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
        return String(value).replace(/["\\]/g, '\\$&');
    }

    function getWidgetAlpha(widgetId, widgetType) {
        const state = getDesktopState();
        const savedColor = state && state.widgets && state.widgets[widgetId] && state.widgets[widgetId].color;
        const color = savedColor || (WIDGET_DEFAULTS[widgetType] && WIDGET_DEFAULTS[widgetType].color) || 'rgba(255,255,255,0.7)';
        return parseColor(color).a;
    }

    function setWidgetAlpha(widgetId, widgetType, alpha) {
        const state = getDesktopState();
        if (!state || !state.widgets) return;

        const current = state.widgets[widgetId] || {};
        const defaultColor = (WIDGET_DEFAULTS[widgetType] && WIDGET_DEFAULTS[widgetType].color) || 'rgba(255,255,255,0.7)';
        const parsed = parseColor(current.color || defaultColor);
        const nextColor = 'rgba(' + parsed.r + ', ' + parsed.g + ', ' + parsed.b + ', ' + roundAlpha(alpha) + ')';

        updateWidgetConfig(widgetId, {
            type: current.type || widgetType,
            color: nextColor
        });
        applyWidgetColor(widgetId, widgetType, nextColor);
    }

    function resetWidgetAlpha(widgetId, widgetType) {
        const state = getDesktopState();
        if (!state || !state.widgets) return;

        const defaultColor = (WIDGET_DEFAULTS[widgetType] && WIDGET_DEFAULTS[widgetType].color) || 'rgba(255,255,255,0.7)';
        updateWidgetConfig(widgetId, {
            type: (state.widgets[widgetId] && state.widgets[widgetId].type) || widgetType,
            color: defaultColor
        });
        applyWidgetColor(widgetId, widgetType, defaultColor);
    }

    function applyWidgetColor(widgetId, widgetType, color) {
        const widget = document.getElementById(widgetId);
        if (!widget) return;

        if (['profile', 'music', 'photo', 'notification'].includes(widgetType)) {
            widget.style.backgroundColor = color;
            return;
        }

        if (widgetType === 'pet') {
            const petSurface = widget.querySelector('.pet-widget-img-wrapper');
            if (petSurface) petSurface.style.backgroundColor = color;
            return;
        }

        if (widgetType === 'couple') {
            widget.querySelectorAll('.couple-img-wrapper, .couple-bubble').forEach(function (el) {
                el.style.backgroundColor = color;
            });
        }
    }

    function parseColor(color) {
        const fallback = { r: 255, g: 255, b: 255, a: 0.7 };
        if (!color || typeof color !== 'string') return fallback;

        const rgba = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
        if (rgba) {
            return {
                r: clampColor(rgba[1]),
                g: clampColor(rgba[2]),
                b: clampColor(rgba[3]),
                a: rgba[4] === undefined ? 1 : Math.max(0, Math.min(1, Number(rgba[4]) || 0))
            };
        }

        const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (hex) {
            let value = hex[1];
            if (value.length === 3) value = value.split('').map(function (ch) { return ch + ch; }).join('');
            return {
                r: parseInt(value.slice(0, 2), 16),
                g: parseInt(value.slice(2, 4), 16),
                b: parseInt(value.slice(4, 6), 16),
                a: 1
            };
        }

        return fallback;
    }

    function clampColor(value) {
        return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
    }

    function roundAlpha(value) {
        return Math.max(0, Math.min(1, Number(value))).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    }
})();

