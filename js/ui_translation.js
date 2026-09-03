(function () {
    'use strict';

    const TRANSLATIONS = Object.freeze({
        'home.app.pay': '支付',
        'home.app.tiktok': '抖音',
        'home.app.bstage': '舞台',
        'home.app.x': '推特',
        'home.app.shop': '商店',
        'home.app.library': '图书馆',
        'home.app.netflix': '奈飞',
        'home.app.loves': '恋爱',
        'home.app.youtube': '油管',
        'home.search': '搜索',
        'home.widget.add': '添加小组件',
        'settings.title': '设置',
        'imessage.search': '搜索',
        'imessage.services': '服务',
        'imessage.stickers': '表情包',
        'imessage.themes': '主题',
        'imessage.official-accounts': '公众号',
        'imessage.game': '游戏',
        'imessage.home': '首页',
        'imessage.chats': '聊天',
        'imessage.reply': '回复',
        'imessage.copy': '复制',
        'imessage.translate': '翻译',
        'imessage.edit': '编辑',
        'imessage.forward': '转发',
        'imessage.delete': '删除',
        'imessage.select': '选择',
        'group.create': '创建',
        'group.cancel': '取消',
        'group.new': '新建群聊',
        'group.settings': '群聊设置',
        'group.edit': '编辑',
        'group.mute': '静音',
        'group.search': '搜索',
        'group.more': '更多',
        'chat.settings': '聊天设置',
        'x.cancel': '取消',
        'x.save': '保存',
        'x.close': '关闭',
        'x.edit-profile': '编辑资料',
        'x.settings': '推特设置',
        'x.upload-cover': '上传封面',
        'x.upload-avatar': '上传头像',
        'x.home': '首页',
        'x.super': '超话',
        'x.discover': '发现',
        'x.messages': '消息',
        'x.me': '我的',
        'shopping.shop': '商店',
        'shopping.search': '搜索',
        'shopping.settings': '设置',
        'shopping.bag': '购物袋',
        'shopping.account': '购物账号',
        'shopping.user': '用户',
        'shopping.edit': '编辑',
        'shopping.orders': '订单',
        'shopping.addresses': '地址',
        'shopping.order-history': '餐饮和商城记录',
        'shopping.delivery-places': '管理收货地址',
        'game.title': '游戏',
        'game.center': '游戏中心',
        'game.back': '返回游戏'
    });

    const APP_LABELS = Object.freeze({
        'app-icon-1': { name: 'Pay', key: 'home.app.pay' },
        'app-icon-2': { name: 'TikTok', key: 'home.app.tiktok' },
        'app-icon-3': { name: 'b.stage', key: 'home.app.bstage' },
        'app-icon-4': { name: 'X', key: 'home.app.x' },
        'app-icon-5': { name: 'Shop', key: 'home.app.shop' },
        'app-icon-6': { name: 'Library', key: 'home.app.library' },
        'app-icon-7': { name: 'Netflix', key: 'home.app.netflix' },
        'app-icon-8': { name: 'Loves', key: 'home.app.loves' },
        'dock-icon-youtube': { name: 'YouTube', key: 'home.app.youtube' }
    });

    const ATTRIBUTE_KEYS = [
        ['placeholder', 'data-u2-i18n-placeholder'],
        ['title', 'data-u2-i18n-title'],
        ['aria-label', 'data-u2-i18n-aria-label']
    ];
    const TRANSLATION_SELECTOR = [
        '[data-u2-i18n]',
        '[data-u2-i18n-placeholder]',
        '[data-u2-i18n-title]',
        '[data-u2-i18n-aria-label]'
    ].join(',');

    let enabled = false;
    let observer = null;

    function getTranslation(key) {
        return TRANSLATIONS[String(key || '')] || '';
    }

    function setText(element, key) {
        if (!element || !key) return;
        const originalAttribute = 'data-u2-i18n-original';
        if (!element.hasAttribute(originalAttribute)) {
            element.setAttribute(originalAttribute, element.textContent || '');
        }
        element.textContent = enabled ? (getTranslation(key) || element.getAttribute(originalAttribute)) : element.getAttribute(originalAttribute);
    }

    function getTextTarget(element) {
        const selector = element.getAttribute('data-u2-i18n-target');
        return selector ? element.querySelector(selector) || element : element;
    }

    function setAttribute(element, attribute, marker) {
        const key = element.getAttribute(marker);
        if (!key) return;
        const originalAttribute = `${marker}-original`;
        if (!element.hasAttribute(originalAttribute)) {
            element.setAttribute(originalAttribute, element.getAttribute(attribute) || '');
        }
        element.setAttribute(attribute, enabled ? (getTranslation(key) || element.getAttribute(originalAttribute)) : element.getAttribute(originalAttribute));
    }

    function applyElement(element) {
        if (!element || element.nodeType !== 1) return;
        const textKey = element.getAttribute('data-u2-i18n');
        if (textKey) setText(getTextTarget(element), textKey);
        ATTRIBUTE_KEYS.forEach(([attribute, marker]) => setAttribute(element, attribute, marker));
    }

    function apply(root = document) {
        if (!root) return;
        if (root.nodeType === 1 && root.matches?.(TRANSLATION_SELECTOR)) applyElement(root);
        root.querySelectorAll?.(TRANSLATION_SELECTOR).forEach(applyElement);
    }

    function applyAppName(element, app) {
        if (!element || !app) return;
        const appName = String(app.name || '');
        const descriptor = APP_LABELS[String(app.id || '')];
        const isBuiltInName = descriptor && descriptor.name === appName;

        element.textContent = appName;
        if (!isBuiltInName) {
            element.removeAttribute('data-u2-i18n');
            element.removeAttribute('data-u2-i18n-original');
            return;
        }

        element.setAttribute('data-u2-i18n', descriptor.key);
        element.setAttribute('data-u2-i18n-original', appName);
        applyElement(element);
    }

    function getAppName(app) {
        const appName = String(app?.name || '');
        const descriptor = APP_LABELS[String(app?.id || '')];
        return enabled && descriptor?.name === appName ? (getTranslation(descriptor.key) || appName) : appName;
    }

    function startObserver() {
        if (observer || !document.body || typeof MutationObserver !== 'function') return;
        observer = new MutationObserver((records) => {
            records.forEach((record) => {
                record.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) apply(node);
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function setEnabled(nextEnabled) {
        enabled = nextEnabled === true;
        apply();
        startObserver();
        document.dispatchEvent?.(new CustomEvent('u2-ui-translation-changed', { detail: { enabled } }));
        return enabled;
    }

    window.u2UiTranslation = {
        apply,
        applyAppName,
        getAppName,
        getTranslation,
        isEnabled: () => enabled,
        setEnabled
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver, { once: true });
    } else {
        startObserver();
    }
})();
