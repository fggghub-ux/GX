(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.imOfflineRegex = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const PLACEMENTS = ['user', 'assistant'];

    const createId = () => `offline-regex-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const normalizeDepth = (value) => {
        if (value === '' || value === null || typeof value === 'undefined') return null;
        const number = Number(value);
        return Number.isInteger(number) && number >= 0 ? number : null;
    };

    const normalizeAppliedRevisions = (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
        return Object.fromEntries(Object.entries(value)
            .filter(([id, revision]) => id && Number.isInteger(Number(revision)) && Number(revision) >= 1)
            .map(([id, revision]) => [String(id), Number(revision)]));
    };

    const normalizeRule = (rule, index = 0) => {
        const source = rule && typeof rule === 'object' ? rule : {};
        const placement = Array.isArray(source.placement)
            ? PLACEMENTS.filter(role => source.placement.includes(role))
            : PLACEMENTS.slice();
        return {
            id: String(source.id || createId()),
            scriptName: String(source.scriptName || `正则 ${index + 1}`),
            findRegex: String(source.findRegex || ''),
            replaceString: String(source.replaceString || ''),
            placement,
            markdownOnly: !!source.markdownOnly,
            promptOnly: !!source.promptOnly,
            disabled: !!source.disabled,
            minDepth: normalizeDepth(source.minDepth),
            maxDepth: normalizeDepth(source.maxDepth),
            revision: Math.max(1, Math.floor(Number(source.revision) || 1))
        };
    };

    const normalizeRules = (rules) => (Array.isArray(rules) ? rules : []).map(normalizeRule);

    const createRule = () => normalizeRule({
        id: createId(),
        scriptName: '新正则',
        placement: PLACEMENTS.slice(),
        revision: 1
    });

    const findClosingSlash = (value) => {
        for (let index = value.length - 1; index > 0; index -= 1) {
            if (value[index] !== '/') continue;
            let backslashes = 0;
            for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) backslashes += 1;
            if (backslashes % 2 === 0) return index;
        }
        return -1;
    };

    const parseRegex = (value) => {
        const raw = String(value || '');
        if (!raw) throw new Error('请输入查找正则表达式');
        if (!raw.startsWith('/')) return { source: raw, flags: '' };
        const closingSlash = findClosingSlash(raw);
        if (closingSlash <= 0) return { source: raw, flags: '' };
        return {
            source: raw.slice(1, closingSlash),
            flags: raw.slice(closingSlash + 1)
        };
    };

    const compileRule = (rule) => {
        try {
            const parsed = parseRegex(rule?.findRegex);
            return { regex: new RegExp(parsed.source, parsed.flags), error: '' };
        } catch (error) {
            return { regex: null, error: error instanceof Error ? error.message : String(error) };
        }
    };

    const isDepthValid = (rule) => rule?.minDepth === null
        || rule?.maxDepth === null
        || Number(rule.maxDepth) >= Number(rule.minDepth);

    const isDepthIncluded = (rule, depth) => {
        if (!Number.isInteger(depth) || depth < 0 || !isDepthValid(rule)) return false;
        if (rule.minDepth !== null && depth < rule.minDepth) return false;
        if (rule.maxDepth !== null && depth > rule.maxDepth) return false;
        return true;
    };

    const matchesChannel = (rule, channel) => {
        if (channel === 'storage') return !rule.markdownOnly && !rule.promptOnly;
        if (channel === 'display') return rule.markdownOnly;
        if (channel === 'prompt') return rule.promptOnly;
        return false;
    };

    const replaceText = (text, rule, compiled) => {
        const replacement = String(rule.replaceString || '').replace(/\{\{match\}\}/g, () => '$&');
        return String(text || '').replace(compiled.regex, replacement);
    };

    const applyRules = (text, options = {}) => {
        const role = options.role === 'assistant' ? 'assistant' : 'user';
        const depth = Number(options.depth);
        const channel = options.channel || 'display';
        let result = String(text || '');
        normalizeRules(options.rules).forEach((rule) => {
            if (rule.disabled || !rule.placement.includes(role)) return;
            if (!matchesChannel(rule, channel) || !isDepthIncluded(rule, depth)) return;
            const compiled = compileRule(rule);
            if (!compiled.regex) return;
            result = replaceText(result, rule, compiled);
        });
        return result;
    };

    const applyStorageRules = (messages, rules, options = {}) => {
        const normalizedRules = normalizeRules(rules);
        const resetIds = new Set((options.resetMessageIds || []).map(String));
        const sourceMessages = Array.isArray(messages) ? messages : [];
        const depthByIndex = new Map();
        let conversationalDepth = 0;
        for (let index = sourceMessages.length - 1; index >= 0; index -= 1) {
            const role = sourceMessages[index]?.role;
            if (role !== 'user' && role !== 'assistant') continue;
            depthByIndex.set(index, conversationalDepth);
            conversationalDepth += 1;
        }
        return sourceMessages.map((message, index) => {
            const next = { ...message };
            const role = next.role === 'assistant' ? 'assistant' : (next.role === 'user' ? 'user' : null);
            if (!role) return next;
            const depth = depthByIndex.get(index);
            const applied = resetIds.has(String(next.id)) ? {} : normalizeAppliedRevisions(next.offlineRegexAppliedRevisions);
            let content = String(next.content || '');

            normalizedRules.forEach((rule) => {
                if (rule.disabled || !rule.placement.includes(role)) return;
                if (!matchesChannel(rule, 'storage') || !isDepthIncluded(rule, depth)) return;
                if (applied[rule.id] === rule.revision) return;
                const compiled = compileRule(rule);
                if (!compiled.regex) return;
                content = replaceText(content, rule, compiled);
                applied[rule.id] = rule.revision;
            });

            next.content = content;
            next.offlineRegexAppliedRevisions = applied;
            return next;
        });
    };

    return {
        PLACEMENTS: PLACEMENTS.slice(),
        normalizeDepth,
        normalizeAppliedRevisions,
        normalizeRule,
        normalizeRules,
        createRule,
        compileRule,
        isDepthValid,
        isDepthIncluded,
        matchesChannel,
        applyRules,
        applyStorageRules
    };
});
