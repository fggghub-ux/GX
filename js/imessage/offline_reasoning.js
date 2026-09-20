(function (globalScope, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (globalScope) globalScope.imOfflineReasoning = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const REASONING_TAG_NAMES = ['cot', 'think', 'thinking', 'reasoning', 'analysis'];
    const COMPLETE_TAG_PATTERN = new RegExp(`<\\s*(\\/?)\\s*(${REASONING_TAG_NAMES.join('|')})\\s*>`, 'gi');
    const PARTIAL_TAG_CANDIDATES = REASONING_TAG_NAMES.flatMap(tag => [`<${tag}>`, `</${tag}>`]);
    const REASONING_BOUNDARY_PATTERN = new RegExp(`<\\s*\\/?\\s*(?:${REASONING_TAG_NAMES.join('|')})\\s*>`, 'gi');
    const VISIBLE_REASONING_BLOCK_TYPES = new Set([
        'reasoning',
        'reasoning.text',
        'reasoning.summary',
        'thinking',
        'thinking.text',
        'thinking.summary',
        'analysis',
        'analysis.text',
        'analysis.summary'
    ]);

    const normalizeText = (value) => String(value == null ? '' : value).replace(/\r\n/g, '\n');

    const DEFAULT_MAX_RESPONSE_TOKENS = 30000;

    const normalizeMaxResponseTokens = (value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_MAX_RESPONSE_TOKENS;
        return Math.min(32768, Math.max(256, Math.round(numeric)));
    };

    const stripReasoningBoundaryTags = (value) => normalizeText(value)
        .replace(REASONING_BOUNDARY_PATTERN, '')
        .trim();

    const normalizeCotEntryTitle = (value, index) => {
        const title = normalizeText(value).replace(/[\r\n]+/g, ' ').trim();
        return title || `COT ${index + 1}`;
    };

    const buildCotInstructionBlock = (entries) => {
        const checklist = (Array.isArray(entries) ? entries : [])
            .filter(entry => entry && entry.enabled !== false)
            .map((entry, index) => ({
                title: normalizeCotEntryTitle(entry.name, index),
                instruction: stripReasoningBoundaryTags(entry.content)
            }))
            .filter(entry => entry.instruction);
        const expectedTitles = checklist.map(entry => `【${entry.title}】`);
        if (!checklist.length) return { content: '', expectedTitles: [], checklist: [] };

        const checklistText = checklist
            .map(entry => `【${entry.title}】\n${entry.instruction}`)
            .join('\n\n');
        const titleShape = expectedTitles.join('、');
        return {
            content: `<offline_cot_instruction>
在输出正文之前，先根据下面所有已启用的 COT 条目逐项思考，并输出一份简洁、可见的思考摘要。
思考摘要必须完整放在一对 <thinking> 与 </thinking> 标签内；正文必须紧跟在 </thinking> 之后并位于标签外。
思考摘要必须按当前顺序使用这些标题，标题文字不得改写、合并或遗漏：${titleShape}
每个标题下都要明确回应对应要求，不要只复述标题。

${checklistText}
</offline_cot_instruction>`,
            expectedTitles,
            checklist
        };
    };

    const validateCotResponse = (content, expectedTitles) => {
        const source = normalizeText(content);
        const titles = (Array.isArray(expectedTitles) ? expectedTitles : [])
            .map(title => String(title || '').trim())
            .filter(Boolean);
        if (!titles.length) {
            return { valid: true, hasCompleteTag: true, missingTitles: [], parsed: parseTaggedReasoning(source) };
        }
        const parsed = parseTaggedReasoning(source);
        const openingPattern = new RegExp(`<\\s*(?:${REASONING_TAG_NAMES.join('|')})\\s*>`, 'i');
        const closingPattern = new RegExp(`<\\s*\\/\\s*(?:${REASONING_TAG_NAMES.join('|')})\\s*>`, 'i');
        const hasCompleteTag = openingPattern.test(source) && closingPattern.test(source) && !parsed.incomplete;
        const missingTitles = titles.filter(title => !parsed.reasoning.includes(title));
        return {
            valid: hasCompleteTag && missingTitles.length === 0,
            hasCompleteTag,
            missingTitles,
            parsed
        };
    };

    const detectReasoningApiMode = (endpoint, model) => {
        const endpointText = String(endpoint || '').trim().toLowerCase();
        const modelText = String(model || '').trim().toLowerCase();
        if (/openrouter\.ai|openrouter/.test(endpointText)) return 'openrouter';
        if (/api\.openai\.com|openai\.com/.test(endpointText)) return 'native';
        if (/api\.deepseek\.com|deepseek\.com/.test(endpointText)) return 'native';
        if (/z\.ai|bigmodel|zhipu|moonshot|kimi/.test(endpointText)) return 'thinking';
        if (/\b(glm|kimi|moonshot)[-_/.]?/.test(modelText)) return 'thinking';
        return 'openrouter';
    };

    const isOpenAiReasoningModel = (endpoint, model) => {
        const endpointText = String(endpoint || '').trim().toLowerCase();
        const modelText = String(model || '').trim().toLowerCase();
        if (!/api\.openai\.com|openai\.com/.test(endpointText)) return false;
        return /^(o1|o3|o4)(?:[-_.]|$)|^gpt-5(?:[-_.]|$)/.test(modelText);
    };

    const buildReasoningRequestConfig = (options = {}) => {
        const endpoint = String(options.endpoint || '').trim();
        const model = String(options.model || '').trim();
        const enabled = options.enabled !== false;
        const maxTokens = normalizeMaxResponseTokens(options.maxTokens);
        const mode = detectReasoningApiMode(endpoint, model);
        const parameters = {};

        if (isOpenAiReasoningModel(endpoint, model)) parameters.max_completion_tokens = maxTokens;
        else parameters.max_tokens = maxTokens;

        if (mode === 'openrouter') {
            parameters.reasoning = { enabled, exclude: false };
        } else if (mode === 'thinking') {
            parameters.thinking = { type: enabled ? 'enabled' : 'disabled' };
        }

        return {
            mode,
            enabled,
            maxTokens,
            hasReasoningParameter: mode === 'openrouter' || mode === 'thinking',
            parameters
        };
    };

    const getStructuredBlockType = (value) => value && typeof value === 'object'
        ? String(value.type || value.kind || '').trim().toLowerCase()
        : '';

    const isEncryptedReasoningBlock = (value) => {
        const type = getStructuredBlockType(value);
        return type === 'reasoning.encrypted'
            || type === 'thinking.encrypted'
            || type === 'analysis.encrypted'
            || value?.encrypted === true;
    };

    const isVisibleReasoningBlock = (value) => {
        if (!value || typeof value !== 'object' || isEncryptedReasoningBlock(value)) return false;
        const type = getStructuredBlockType(value);
        return value.thought === true
            || value.is_reasoning === true
            || value.isReasoning === true
            || VISIBLE_REASONING_BLOCK_TYPES.has(type);
    };

    const readReasoningValue = (value) => {
        if (typeof value === 'string') return value;
        if (value == null) return '';
        if (Array.isArray(value)) {
            return value.map(readReasoningValue).filter(Boolean).join('\n');
        }
        if (typeof value === 'object') {
            if (isEncryptedReasoningBlock(value)) return '';
            for (const key of ['text', 'summary', 'thinking', 'reasoning_content', 'reasoning', 'content']) {
                const text = readReasoningValue(value[key]);
                if (text) return text;
            }
        }
        return '';
    };

    const readFirstReasoningValue = (...values) => {
        for (const value of values) {
            const text = readReasoningValue(value);
            if (text) return text;
        }
        return '';
    };

    const readContentValue = (value) => {
        if (typeof value === 'string') return value;
        if (value == null) return '';
        if (Array.isArray(value)) return value.map(readContentValue).filter(Boolean).join('');
        if (typeof value === 'object') {
            if (isVisibleReasoningBlock(value) || isEncryptedReasoningBlock(value)) return '';
            for (const key of ['text', 'output_text', 'content', 'value']) {
                const text = readContentValue(value[key]);
                if (text) return text;
            }
        }
        return '';
    };

    const readFirstContentValue = (...values) => {
        for (const value of values) {
            const text = readContentValue(value);
            if (text) return text;
        }
        return '';
    };

    const readStructuredReasoningValue = (value) => {
        if (value == null || typeof value === 'string') return '';
        if (Array.isArray(value)) {
            return value.map(readStructuredReasoningValue).filter(Boolean).join('\n');
        }
        if (typeof value !== 'object' || isEncryptedReasoningBlock(value)) return '';
        if (isVisibleReasoningBlock(value)) return readReasoningValue(value);
        for (const key of ['content', 'parts', 'output', 'items']) {
            const text = readStructuredReasoningValue(value[key]);
            if (text) return text;
        }
        return '';
    };

    const readFirstStructuredReasoningValue = (...values) => {
        for (const value of values) {
            const text = readStructuredReasoningValue(value);
            if (text) return text;
        }
        return '';
    };

    const extractResponseParts = (contentValues, reasoningValues) => {
        const contentCandidates = Array.isArray(contentValues) ? contentValues : [contentValues];
        const reasoningCandidates = Array.isArray(reasoningValues) ? reasoningValues : [reasoningValues];
        const content = readFirstContentValue(...contentCandidates);
        const structuredReasoning = readFirstStructuredReasoningValue(...contentCandidates);
        const nativeReasoning = readFirstReasoningValue(...reasoningCandidates);
        return {
            content,
            reasoning: structuredReasoning || nativeReasoning,
            reasoningSource: structuredReasoning ? 'structured' : (nativeReasoning ? 'native' : '')
        };
    };

    const findPartialTagSuffix = (text) => {
        const lower = text.toLowerCase();
        let best = '';
        for (const candidate of PARTIAL_TAG_CANDIDATES) {
            for (let length = 1; length < candidate.length; length += 1) {
                const prefix = candidate.slice(0, length);
                if (lower.endsWith(prefix) && prefix.length > best.length) best = text.slice(-prefix.length);
            }
        }
        return best;
    };

    const parseTaggedReasoning = (value, options = {}) => {
        const source = normalizeText(value);
        const contentParts = [];
        const reasoningParts = [];
        let cursor = 0;
        let reasoningStart = -1;
        let foundTag = false;
        let match = null;
        COMPLETE_TAG_PATTERN.lastIndex = 0;

        while ((match = COMPLETE_TAG_PATTERN.exec(source)) !== null) {
            foundTag = true;
            const isClosing = match[1] === '/';
            if (!isClosing) {
                if (reasoningStart < 0) {
                    contentParts.push(source.slice(cursor, match.index));
                    reasoningStart = COMPLETE_TAG_PATTERN.lastIndex;
                }
                continue;
            }

            if (reasoningStart >= 0) {
                reasoningParts.push(source.slice(reasoningStart, match.index));
                reasoningStart = -1;
                cursor = COMPLETE_TAG_PATTERN.lastIndex;
            } else {
                reasoningParts.push(source.slice(cursor, match.index));
                cursor = COMPLETE_TAG_PATTERN.lastIndex;
            }
        }

        let incomplete = false;
        let pendingTag = '';
        if (reasoningStart >= 0) {
            reasoningParts.push(source.slice(reasoningStart));
            incomplete = true;
        } else {
            contentParts.push(source.slice(cursor));
            if (!foundTag && options.streaming) {
                pendingTag = findPartialTagSuffix(contentParts[contentParts.length - 1] || '');
                if (pendingTag) {
                    const lastIndex = contentParts.length - 1;
                    contentParts[lastIndex] = contentParts[lastIndex].slice(0, -pendingTag.length);
                }
            }
        }

        return {
            content: contentParts.join('').trim(),
            reasoning: reasoningParts.map(part => part.trim()).filter(Boolean).join('\n\n'),
            foundTag,
            incomplete,
            pendingTag
        };
    };

    const normalizeResponse = (content, nativeReasoning, options = {}) => {
        const tagged = parseTaggedReasoning(content, options);
        const nativeText = readReasoningValue(nativeReasoning).trim();
        const taggedText = tagged.reasoning.trim();
        return {
            content: tagged.content,
            reasoning: taggedText || nativeText,
            reasoningSource: taggedText ? 'tagged' : (nativeText ? 'native' : ''),
            foundTag: tagged.foundTag,
            incomplete: tagged.incomplete,
            pendingTag: tagged.pendingTag
        };
    };

    return {
        normalizeMaxResponseTokens,
        stripReasoningBoundaryTags,
        buildCotInstructionBlock,
        validateCotResponse,
        detectReasoningApiMode,
        buildReasoningRequestConfig,
        readContentValue,
        readFirstContentValue,
        readReasoningValue,
        readFirstReasoningValue,
        readStructuredReasoningValue,
        readFirstStructuredReasoningValue,
        extractResponseParts,
        parseTaggedReasoning,
        normalizeResponse
    };
});
