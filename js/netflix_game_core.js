(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.NetflixGameCore = api;
})(typeof window !== 'undefined' ? window : null, function () {
    'use strict';

    const SCHEMA_VERSION = 4;
    const MANUAL_SLOT_COUNT = 6;
    const DEFAULT_ATTRIBUTES = Object.freeze([
        { id: 'charm', name: '魅力' },
        { id: 'vitality', name: '体质' },
        { id: 'speed', name: '速度' },
        { id: 'insight', name: '洞察' }
    ]);

    function clone(value) {
        if (value === undefined) return undefined;
        return JSON.parse(JSON.stringify(value));
    }

    function clampInt(value, min = 0, max = 100, fallback = min) {
        const parsed = Number.parseInt(value, 10);
        const safe = Number.isFinite(parsed) ? parsed : fallback;
        return Math.max(min, Math.min(max, safe));
    }

    function randomAttributeValue(random = Math.random) {
        return clampInt(Math.floor(Number(random()) * 101), 0, 100, 0);
    }

    function createDefaultAttributes(random = Math.random) {
        return DEFAULT_ATTRIBUTES.map(attribute => ({
            ...attribute,
            value: randomAttributeValue(random),
            isDefault: true
        }));
    }

    function normalizeAttributes(value, random = Math.random) {
        const input = Array.isArray(value) ? value : [];
        const byId = new Map(input.map(item => [String(item?.id || ''), item]));
        const defaults = DEFAULT_ATTRIBUTES.map(attribute => {
            const saved = byId.get(attribute.id);
            return {
                ...attribute,
                value: saved ? clampInt(saved.value, 0, 100, 50) : randomAttributeValue(random),
                isDefault: true
            };
        });
        const custom = input
            .filter(item => item && !DEFAULT_ATTRIBUTES.some(attribute => attribute.id === String(item.id || '')))
            .map((item, index) => ({
                id: String(item.id || `custom-${Date.now()}-${index}`),
                name: String(item.name || '').trim().slice(0, 24),
                value: clampInt(item.value, 0, 100, 50),
                isDefault: false
            }))
            .filter(item => item.name);
        return [...defaults, ...custom];
    }

    function normalizeCharacterAttributes(value, definitions = [], options = {}) {
        const input = Array.isArray(value) ? value : [];
        const normalizedDefinitions = (Array.isArray(definitions) ? definitions : []).map(item => ({
            id: String(item?.id || '').trim(),
            name: String(item?.name || '').trim().slice(0, 24)
        })).filter(item => item.id && item.name);
        if (!normalizedDefinitions.length) {
            return input.map(item => {
                if (!item || typeof item !== 'object') return null;
                const id = String(item.id || '').trim();
                const name = String(item.name || '').trim().slice(0, 24);
                const rawValue = Number(item.value);
                if (!id || !name || !Number.isInteger(rawValue) || rawValue < 0 || rawValue > 100) return null;
                return { id, name, value: rawValue };
            }).filter(Boolean);
        }
        const byId = new Map(input.map(item => [String(item?.id || '').trim(), item]));
        const validIds = new Set(normalizedDefinitions.map(item => item.id));
        if (options.strict && (input.length !== normalizedDefinitions.length || input.some(item => !validIds.has(String(item?.id || '').trim())))) {
            throw new Error('角色属性必须完整复用开局 User 属性 ID');
        }
        return normalizedDefinitions.map(definition => {
            const rawValue = Number(byId.get(definition.id)?.value);
            if (!Number.isInteger(rawValue) || rawValue < 0 || rawValue > 100) {
                if (options.strict) throw new Error(`角色属性“${definition.name}”必须为 0–100 的整数`);
                return { ...definition, value: 50 };
            }
            return { ...definition, value: rawValue };
        });
    }

    function normalizeCast(value) {
        const input = Array.isArray(value) ? value : [];
        const seen = new Set();
        return input.map((actor, index) => {
            if (!actor || typeof actor !== 'object') return null;
            const type = actor.type === 'user' ? 'user' : (actor.type === 'char' ? 'char' : (actor.type === 'story' ? 'story' : 'custom'));
            const fallbackId = type === 'user' ? 'user-current' : `${type}-${Date.now()}-${index}`;
            const id = String(actor.id || actor.sourceId || fallbackId);
            if (seen.has(id)) return null;
            seen.add(id);
            const name = String(actor.name || actor.realName || actor.roleName || (type === 'user' ? 'User' : `主演${index + 1}`)).trim();
            return {
                id,
                sourceId: String(actor.sourceId || ''),
                type,
                name: name || `主演${index + 1}`,
                persona: String(actor.persona || actor.rolePersona || actor.desc || '').trim(),
                avatar: String(actor.avatar || actor.avatarUrl || '').trim(),
                affinity: type === 'user' ? null : clampInt(actor.affinity, 0, 100, 50),
                origin: type === 'user' ? 'user' : (actor.origin === 'story' || type === 'story' ? 'story' : 'setup'),
                identity: String(actor.identity || '').trim().slice(0, 80),
                occupation: String(actor.occupation || '').trim().slice(0, 60),
                faction: String(actor.faction || '').trim().slice(0, 60),
                characterAttributes: normalizeCharacterAttributes(actor.characterAttributes || actor.traits),
                profileComplete: type === 'user' ? true : !!actor.profileComplete,
                acquainted: type === 'user' ? true : actor.acquainted !== false,
                companionEligible: type === 'user' ? false : (typeof actor.companionEligible === 'boolean' ? actor.companionEligible : type !== 'story'),
                firstSeenAt: type === 'user' ? null : (Number(actor.firstSeenAt) || null),
                firstSeenSceneId: type === 'user' ? '' : String(actor.firstSeenSceneId || ''),
                acquaintedAt: type === 'user' ? null : (Number(actor.acquaintedAt) || null),
                acquaintedSceneId: type === 'user' ? '' : String(actor.acquaintedSceneId || ''),
                deferredSceneId: type === 'user' ? '' : String(actor.deferredSceneId || '')
            };
        }).filter(Boolean);
    }

    function cleanJsonText(raw) {
        const text = String(raw || '').trim()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
        if (!text) throw new Error('API 没有返回剧情内容');
        try {
            return JSON.parse(text);
        } catch (_) {
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
            throw new Error('API 返回的剧情不是合法 JSON');
        }
    }

    function normalizeRequirementMap(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
        return Object.entries(value).reduce((result, [key, minimum]) => {
            const id = String(key || '').trim();
            if (id) result[id] = clampInt(minimum, 0, 100, 0);
            return result;
        }, {});
    }

    function normalizeOutcome(value) {
        const source = value && typeof value === 'object' ? value : {};
        const normalizeDeltas = deltas => {
            if (!deltas || typeof deltas !== 'object' || Array.isArray(deltas)) return {};
            return Object.entries(deltas).reduce((result, [key, amount]) => {
                const id = String(key || '').trim();
                if (id) result[id] = clampInt(amount, -10, 10, 0);
                return result;
            }, {});
        };
        return {
            attributeDeltas: normalizeDeltas(source.attributeDeltas || source.attributes),
            affinityDeltas: normalizeDeltas(source.affinityDeltas || source.affinities),
            summary: String(source.summary || '').trim(),
            flags: Array.isArray(source.flags) ? source.flags.map(flag => String(flag || '').trim()).filter(Boolean).slice(0, 24) : []
        };
    }

    function normalizeTrainingOutcome(value) {
        const normalized = normalizeOutcome(value);
        const clampDeltas = deltas => Object.entries(deltas).reduce((result, [id, amount]) => {
            result[id] = clampInt(amount, -5, 5, 0);
            return result;
        }, {});
        return {
            ...normalized,
            attributeDeltas: clampDeltas(normalized.attributeDeltas),
            affinityDeltas: clampDeltas(normalized.affinityDeltas)
        };
    }

    function normalizeBeat(beat, index) {
        if (!beat || typeof beat !== 'object') return null;
        const kind = beat.kind === 'dialogue' || beat.type === 'dialogue' ? 'dialogue' :
            (beat.kind === 'narration' || beat.type === 'narration' ? 'narration' : '');
        const text = String(beat.text || beat.content || '').trim();
        if (!kind || !text) return null;
        const speakerName = String(beat.speakerName || beat.speaker || beat.name || '').trim();
        if (kind === 'dialogue' && !speakerName) return null;
        return {
            id: String(beat.id || `beat-${index + 1}`),
            kind,
            speakerId: String(beat.speakerId || '').trim(),
            speakerName: kind === 'dialogue' ? speakerName : '',
            text
        };
    }

    function normalizeChoice(choice, index) {
        if (!choice || typeof choice !== 'object') return null;
        const text = String(choice.text || choice.label || '').trim();
        if (!text) return null;
        const requirements = choice.requirements && typeof choice.requirements === 'object' ? choice.requirements : {};
        return {
            id: String(choice.id || `choice-${index + 1}`),
            text,
            requirements: {
                attributes: normalizeRequirementMap(requirements.attributes || choice.attributeRequirements),
                affinities: normalizeRequirementMap(requirements.affinities || choice.affinityRequirements)
            }
        };
    }

    function normalizeEnding(value) {
        if (!value || typeof value !== 'object') return null;
        const title = String(value.title || value.endingTitle || '').trim();
        const summary = String(value.summary || value.text || '').trim();
        if (!title || !summary) return null;
        return {
            id: String(value.id || `ending-${Date.now()}`),
            title,
            summary,
            type: String(value.type || '普通结局').trim(),
            unlockedAt: Number(value.unlockedAt) || Date.now()
        };
    }

    function normalizeCharacterProfiles(value, beats, cast = [], attributes = []) {
        const input = Array.isArray(value) ? value : [];
        const knownById = new Map(normalizeCast(cast).map(actor => [actor.id, actor]));
        const seenIds = new Set();
        const beatById = new Map(beats.map(beat => [beat.id, beat]));
        return input.map(profile => {
            if (!profile || typeof profile !== 'object') throw new Error('角色档案格式无效');
            const id = String(profile.id || profile.characterId || '').trim();
            const triggerBeatId = String(profile.triggerBeatId || '').trim();
            const name = String(profile.name || '').trim().slice(0, 40);
            const identity = String(profile.identity || '').trim().slice(0, 80);
            const occupation = String(profile.occupation || '').trim().slice(0, 60);
            const faction = String(profile.faction || '').trim().slice(0, 60);
            const persona = String(profile.persona || '').trim().slice(0, 1000);
            const triggerBeat = beatById.get(triggerBeatId);
            if (!id || id === 'user-current' || seenIds.has(id)) throw new Error('角色档案 ID 缺失、重复或指向 User');
            if (knownById.get(id)?.type === 'user') throw new Error('角色档案不能指向 User');
            if (!triggerBeat) throw new Error('角色档案引用了无效的登场内容');
            if (!name || !identity || !occupation || !faction || !persona) throw new Error('角色档案缺少身份资料');
            if (triggerBeat.speakerId !== id && !triggerBeat.text.includes(name)) throw new Error('角色档案必须绑定角色实际登场的内容');
            if (typeof profile.companionEligible !== 'boolean') throw new Error('角色档案缺少同行资格');
            const existing = knownById.get(id);
            const initialAffinity = Number(profile.initialAffinity);
            if (!existing && (!Number.isInteger(initialAffinity) || initialAffinity < 30 || initialAffinity > 70)) {
                throw new Error('剧情新角色初始好感度必须为 30–70');
            }
            seenIds.add(id);
            return {
                id,
                triggerBeatId,
                name,
                identity,
                occupation,
                faction,
                persona,
                characterAttributes: normalizeCharacterAttributes(profile.attributes || profile.characterAttributes, attributes, { strict: true }),
                initialAffinity: existing ? existing.affinity : initialAffinity,
                companionEligible: profile.companionEligible,
                isNew: !existing
            };
        });
    }

    function validateNarrativeCharacters(beats, profiles, cast = [], options = {}) {
        const actors = normalizeCast(cast);
        const allowedById = new Map(actors.map(actor => [actor.id, actor]));
        profiles.forEach(profile => allowedById.set(profile.id, profile));
        const profileIds = new Set(profiles.map(profile => profile.id));
        const aliases = new Set(['u', 'user', '玩家']);
        beats.forEach(beat => {
            if (beat.kind !== 'dialogue') return;
            if (!beat.speakerId) {
                const matching = [...allowedById.values()].filter(actor => actor.name === beat.speakerName);
                if (matching.length === 1) beat.speakerId = matching[0].id;
            }
            if (aliases.has(beat.speakerName.toLowerCase())) return;
            const actor = allowedById.get(beat.speakerId);
            if (!actor) throw new Error(`具名角色“${beat.speakerName}”缺少合法角色档案`);
            if (options.requireComplete !== false && actor.type !== 'user' && actor.profileComplete === false && !profileIds.has(actor.id)) {
                throw new Error(`角色“${actor.name}”首次登场时缺少完整身份档案`);
            }
        });
    }

    function mergeCharacterProfiles(cast, profiles, context = {}) {
        const next = normalizeCast(cast);
        const byId = new Map(next.map(actor => [actor.id, actor]));
        (Array.isArray(profiles) ? profiles : []).forEach(profile => {
            const existing = byId.get(profile.id);
            const profileData = {
                name: existing?.name || profile.name,
                identity: profile.identity,
                occupation: profile.occupation,
                faction: profile.faction,
                persona: existing?.persona || profile.persona,
                characterAttributes: clone(profile.characterAttributes),
                profileComplete: true,
                companionEligible: existing?.origin === 'setup' ? true : !!profile.companionEligible,
                firstSeenAt: existing?.firstSeenAt || Number(context.seenAt) || Date.now(),
                firstSeenSceneId: existing?.firstSeenSceneId || String(context.sceneId || '')
            };
            if (existing) {
                if (!existing.profileComplete) Object.assign(existing, profileData);
                return;
            }
            const actor = normalizeCast([{
                id: profile.id,
                type: 'story',
                origin: 'story',
                avatar: '',
                affinity: profile.initialAffinity,
                acquainted: false,
                ...profileData
            }])[0];
            next.push(actor);
            byId.set(actor.id, actor);
        });
        return next;
    }

    function normalizeScenePayload(raw, options = {}) {
        const parsed = typeof raw === 'string' ? cleanJsonText(raw) : clone(raw);
        const source = parsed && typeof parsed === 'object' ? parsed : {};
        const sceneSource = source.scene && typeof source.scene === 'object' ? source.scene : source;
        const beats = (Array.isArray(sceneSource.beats) ? sceneSource.beats : [])
            .map(normalizeBeat)
            .filter(Boolean);
        if (!beats.length) throw new Error('剧情响应缺少有效的旁白或对话');

        const phase = options.phase === 'prologue' ? 'prologue' : (options.phase === 'epilogue' ? 'epilogue' : 'main');
        const minimumBeats = phase === 'prologue' ? 8 : 12;
        const maximumBeats = phase === 'prologue' ? 14 : 18;
        if (beats.length < minimumBeats || beats.length > maximumBeats) {
            throw new Error(`${phase === 'prologue' ? '序章' : '主线或番外场景'}必须包含 ${minimumBeats}–${maximumBeats} 条有效内容`);
        }
        const characterProfiles = normalizeCharacterProfiles(
            source.characterProfiles || sceneSource.characterProfiles,
            beats,
            options.cast,
            options.attributes
        );
        validateNarrativeCharacters(beats, characterProfiles, options.cast, { requireComplete: options.requireProfiles !== false });
        const ending = normalizeEnding(source.ending || sceneSource.ending);
        let choices = (Array.isArray(source.choices) ? source.choices : (Array.isArray(sceneSource.choices) ? sceneSource.choices : []))
            .map(normalizeChoice)
            .filter(Boolean)
            .slice(0, 4);
        if (phase === 'prologue') choices = [];
        if (phase !== 'prologue' && !ending && choices.length < 2) {
            throw new Error('主场景至少需要两个有效选项');
        }

        return {
            id: String(sceneSource.id || `scene-${Date.now()}`),
            title: String(sceneSource.title || source.title || (phase === 'prologue' ? '序章' : '未命名场景')).trim(),
            phase,
            beats,
            characterProfiles,
            choices,
            outcome: normalizeOutcome(source.outcome || sceneSource.outcome),
            storySummary: String(source.storySummary || sceneSource.storySummary || '').trim(),
            ending,
            createdAt: Date.now()
        };
    }

    function normalizeMapPayload(raw, options = {}) {
        const parsed = typeof raw === 'string' ? cleanJsonText(raw) : clone(raw);
        const source = parsed?.map && typeof parsed.map === 'object' ? parsed.map : parsed;
        if (!source || typeof source !== 'object') throw new Error('地图响应缺少 map 对象');
        const minimum = options.manual ? 4 : 6;
        const maximum = options.manual ? 12 : 10;
        const inputNodes = Array.isArray(source.nodes) ? source.nodes.slice(0, maximum) : [];
        const seen = new Set();
        const nodes = inputNodes.map((node, index) => {
            if (!node || typeof node !== 'object') return null;
            const name = String(node.name || '').trim().slice(0, 30);
            const description = String(node.description || node.desc || '').trim().slice(0, 240);
            if (!name || !description) return null;
            let id = String(node.id || `location-${index + 1}`).trim().replace(/[^a-zA-Z0-9_-]/g, '-');
            if (!id || seen.has(id)) id = `location-${index + 1}`;
            while (seen.has(id)) id = `${id}-${index + 1}`;
            seen.add(id);
            return {
                id,
                name,
                description,
                type: String(node.type || '剧情地点').trim().slice(0, 20),
                icon: String(node.icon || 'fa-map-marker-alt').trim().replace(/[^a-zA-Z0-9-]/g, '') || 'fa-map-marker-alt',
                x: clampInt(node.x, 5, 95, 12 + (index % 4) * 24),
                y: clampInt(node.y, 8, 92, 18 + Math.floor(index / 4) * 30),
                focusAttributes: (Array.isArray(node.focusAttributes) ? node.focusAttributes : []).map(String).map(id => id.trim()).filter(Boolean).slice(0, 4),
                featuredCastIds: (Array.isArray(node.featuredCastIds) ? node.featuredCastIds : []).map(String).map(id => id.trim()).filter(Boolean).slice(0, 4)
            };
        }).filter(Boolean);
        if (nodes.length < minimum || nodes.length > maximum) throw new Error(`地图地点数量必须为 ${minimum}–${maximum} 个`);
        const nodeIds = new Set(nodes.map(node => node.id));
        const edgeKeys = new Set();
        const edges = (Array.isArray(source.edges) ? source.edges : []).map(edge => {
            const from = String(edge?.from || '').trim();
            const to = String(edge?.to || '').trim();
            if (!nodeIds.has(from) || !nodeIds.has(to) || from === to) return null;
            const key = [from, to].sort().join('::');
            if (edgeKeys.has(key)) return null;
            edgeKeys.add(key);
            return { from, to };
        }).filter(Boolean).slice(0, 24);
        if (!edges.length) throw new Error('地图至少需要一条有效连线');
        const graph = nodes.reduce((result, node) => result.set(node.id, []), new Map());
        edges.forEach(edge => {
            graph.get(edge.from).push(edge.to);
            graph.get(edge.to).push(edge.from);
        });
        const visited = new Set([nodes[0].id]);
        const queue = [nodes[0].id];
        while (queue.length) {
            const current = queue.shift();
            graph.get(current).forEach(id => {
                if (!visited.has(id)) { visited.add(id); queue.push(id); }
            });
        }
        if (visited.size !== nodes.length) throw new Error('地图连线必须让所有地点保持连通');
        return {
            id: String(source.id || `map-${Date.now()}`),
            name: String(source.name || '故事地图').trim().slice(0, 40) || '故事地图',
            description: String(source.description || '').trim().slice(0, 320),
            nodes,
            edges,
            updatedAt: Date.now()
        };
    }

    function normalizeTrainingEventPayload(raw, locationId = '', options = {}) {
        const parsed = typeof raw === 'string' ? cleanJsonText(raw) : clone(raw);
        const source = parsed?.event && typeof parsed.event === 'object' ? parsed.event : parsed;
        if (!source || typeof source !== 'object') throw new Error('养成事件响应缺少 event 对象');
        const beats = (Array.isArray(source.beats) ? source.beats : []).map(normalizeBeat).filter(Boolean);
        if (beats.length < 3 || beats.length > 6) throw new Error('养成事件需要 3–6 条有效内容');
        const characterProfiles = normalizeCharacterProfiles(source.characterProfiles, beats, options.cast, options.attributes);
        validateNarrativeCharacters(beats, characterProfiles, options.cast, { requireComplete: options.requireProfiles !== false });
        const choices = (Array.isArray(source.choices) ? source.choices : []).slice(0, 2).map((choice, index) => {
            const text = String(choice?.text || '').trim().slice(0, 120);
            if (!text) return null;
            return {
                id: String(choice.id || `training-choice-${index + 1}`),
                text,
                outcome: normalizeTrainingOutcome(choice.outcome)
            };
        }).filter(Boolean);
        if (choices.length !== 2) throw new Error('养成事件必须包含两个有效选项');
        return {
            id: String(source.id || `training-event-${Date.now()}`),
            locationId: String(source.locationId || locationId),
            title: String(source.title || '地点事件').trim().slice(0, 60),
            summary: String(source.summary || '').trim().slice(0, 300),
            beats,
            characterProfiles,
            choices,
            createdAt: Date.now()
        };
    }

    function resolvePlayerSpeakerNames(scene, cast) {
        const next = clone(scene);
        const player = (Array.isArray(cast) ? cast : []).find(actor => actor?.type === 'user');
        if (!next || !player?.name || !Array.isArray(next.beats)) return next;
        const aliases = new Set(['u', 'user', '玩家']);
        next.beats = next.beats.map(beat => {
            if (beat?.kind !== 'dialogue') return beat;
            const speakerId = String(beat.speakerId || '').toLowerCase();
            const speakerName = String(beat.speakerName || '').trim();
            if (speakerId === String(player.id || '').toLowerCase() || speakerId === 'user-current' || aliases.has(speakerName.toLowerCase())) {
                return { ...beat, speakerId: player.id || 'user-current', speakerName: player.name };
            }
            return beat;
        });
        return next;
    }

    function getRequirementStatus(choice, attributes, cast) {
        const attributeValues = new Map((Array.isArray(attributes) ? attributes : []).map(item => [String(item.id), clampInt(item.value, 0, 100, 0)]));
        const affinityValues = new Map((Array.isArray(cast) ? cast : []).map(item => [String(item.id), clampInt(item.affinity, 0, 100, 0)]));
        const requirements = choice?.requirements || {};
        const missing = [];
        Object.entries(requirements.attributes || {}).forEach(([id, minimum]) => {
            const current = attributeValues.get(String(id)) ?? 0;
            if (current < minimum) missing.push({ kind: 'attribute', id: String(id), current, minimum });
        });
        Object.entries(requirements.affinities || {}).forEach(([id, minimum]) => {
            const current = affinityValues.get(String(id)) ?? 0;
            if (current < minimum) missing.push({ kind: 'affinity', id: String(id), current, minimum });
        });
        return { unlocked: missing.length === 0, missing };
    }

    function ensureUnlockedChoice(choices, attributes, cast) {
        const list = clone(Array.isArray(choices) ? choices : []);
        if (!list.length || list.some(choice => getRequirementStatus(choice, attributes, cast).unlocked)) return list;
        list[0].requirements = { attributes: {}, affinities: {} };
        return list;
    }

    function applyOutcome(run, outcome) {
        const next = clone(run || {});
        const normalized = normalizeOutcome(outcome);
        next.attributes = normalizeAttributes(next.attributes, () => 0.5).map(attribute => ({
            ...attribute,
            value: clampInt(attribute.value + (normalized.attributeDeltas[attribute.id] || 0), 0, 100, attribute.value)
        }));
        next.cast = normalizeCast(next.cast).map(actor => actor.type === 'user' ? actor : ({
            ...actor,
            affinity: clampInt(actor.affinity + (normalized.affinityDeltas[actor.id] || 0), 0, 100, actor.affinity)
        }));
        const flags = new Set([...(Array.isArray(next.flags) ? next.flags : []), ...normalized.flags]);
        next.flags = Array.from(flags).slice(-100);
        if (normalized.summary) next.storySummary = normalized.summary;
        return next;
    }

    function applyTrainingOutcome(run, outcome) {
        const next = clone(run || {});
        const normalized = normalizeTrainingOutcome(outcome);
        next.attributes = normalizeAttributes(next.attributes, () => 0.5).map(attribute => ({
            ...attribute,
            value: clampInt(attribute.value + (normalized.attributeDeltas[attribute.id] || 0), 0, 100, attribute.value)
        }));
        next.cast = normalizeCast(next.cast).map(actor => actor.type === 'user' ? actor : ({
            ...actor,
            affinity: clampInt(actor.affinity + (normalized.affinityDeltas[actor.id] || 0), 0, 100, actor.affinity)
        }));
        next.flags = Array.from(new Set([...(Array.isArray(next.flags) ? next.flags : []), ...normalized.flags])).slice(-100);
        return next;
    }

    function createDefaultTraining() {
        return {
            day: 0,
            actionPoints: 0,
            cycleSceneNumber: null,
            map: null,
            companionId: '',
            familiarityByLocation: {},
            currentEvent: null,
            eventBeatIndex: 0,
            eventResult: null,
            eventLog: [],
            recentEventSummaries: []
        };
    }

    function normalizeTrainingEventResult(value) {
        if (!value || typeof value !== 'object') return null;
        const normalizeChanges = changes => (Array.isArray(changes) ? changes : []).map(change => {
            if (!change || typeof change !== 'object') return null;
            const id = String(change.id || '').trim();
            const name = String(change.name || id).trim().slice(0, 40);
            const before = clampInt(change.before, 0, 100, 0);
            const after = clampInt(change.after, 0, 100, before);
            if (!id || !name || before === after) return null;
            return { id, name, before, after, delta: after - before };
        }).filter(Boolean);
        return {
            eventId: String(value.eventId || ''),
            title: String(value.title || '行动结算').trim().slice(0, 60),
            choiceText: String(value.choiceText || '').trim().slice(0, 120),
            summary: String(value.summary || '').trim().slice(0, 300),
            attributeChanges: normalizeChanges(value.attributeChanges),
            affinityChanges: normalizeChanges(value.affinityChanges),
            flags: (Array.isArray(value.flags) ? value.flags : []).map(String).map(flag => flag.trim().slice(0, 80)).filter(Boolean).slice(-20),
            actionPoints: clampInt(value.actionPoints, 0, 3, 0),
            resolvedAt: Number(value.resolvedAt) || Date.now()
        };
    }

    function normalizeTraining(value, cast = [], attributes = []) {
        const source = value && typeof value === 'object' ? value : {};
        const defaults = createDefaultTraining();
        let map = null;
        if (source.map) {
            try { map = normalizeMapPayload(source.map, { manual: true }); } catch (_) { map = null; }
        }
        let currentEvent = null;
        if (source.currentEvent) {
            try { currentEvent = normalizeTrainingEventPayload(source.currentEvent, source.currentEvent.locationId, { cast, attributes, requireProfiles: false }); } catch (_) { currentEvent = null; }
        }
        const familiarity = source.familiarityByLocation && typeof source.familiarityByLocation === 'object' ? source.familiarityByLocation : {};
        return {
            ...defaults,
            day: clampInt(source.day, 0, 999999, 0),
            actionPoints: clampInt(source.actionPoints, 0, 3, 0),
            cycleSceneNumber: Number.isInteger(source.cycleSceneNumber) ? source.cycleSceneNumber : null,
            map,
            companionId: String(source.companionId || ''),
            familiarityByLocation: Object.entries(familiarity).reduce((result, [id, amount]) => {
                result[String(id)] = clampInt(amount, 0, 5, 0);
                return result;
            }, {}),
            currentEvent,
            eventBeatIndex: currentEvent ? clampInt(source.eventBeatIndex, 0, currentEvent.beats.length, 0) : 0,
            eventResult: normalizeTrainingEventResult(source.eventResult),
            eventLog: (Array.isArray(source.eventLog) ? source.eventLog : []).map(clone).filter(Boolean).slice(-200),
            recentEventSummaries: (Array.isArray(source.recentEventSummaries) ? source.recentEventSummaries : []).map(String).map(text => text.trim()).filter(Boolean).slice(-12)
        };
    }

    function normalizeRun(value) {
        if (!value || typeof value !== 'object') return null;
        const run = clone(value);
        run.attributes = normalizeAttributes(run.attributes, () => 0.5);
        run.cast = normalizeCast(run.cast);
        const cast = run.cast;
        if (run.currentScene && typeof run.currentScene === 'object') {
            run.currentScene = resolvePlayerSpeakerNames(run.currentScene, cast);
        }
        if (Array.isArray(run.storyLog)) {
            run.storyLog = run.storyLog.map(entry => (
                entry && typeof entry === 'object' ? resolvePlayerSpeakerNames(entry, cast) : entry
            ));
        }
        run.viewMode = run.viewMode === 'training' ? 'training' : 'story';
        run.storyReturnPoint = run.storyReturnPoint && typeof run.storyReturnPoint === 'object' ? {
            sceneId: String(run.storyReturnPoint.sceneId || run.currentScene?.id || ''),
            beatIndex: clampInt(run.storyReturnPoint.beatIndex, 0, Math.max(0, run.currentScene?.beats?.length || 0), run.beatIndex || 0)
        } : null;
        run.training = normalizeTraining(run.training, cast, run.attributes);
        run.pendingIdentityCard = run.pendingIdentityCard && typeof run.pendingIdentityCard === 'object' ? {
            characterId: String(run.pendingIdentityCard.characterId || ''),
            scope: run.pendingIdentityCard.scope === 'training' ? 'training' : 'story',
            scopeId: String(run.pendingIdentityCard.scopeId || ''),
            beatIndex: clampInt(run.pendingIdentityCard.beatIndex, 0, 999999, 0)
        } : null;
        if (run.training.currentEvent) {
            run.training.currentEvent = resolvePlayerSpeakerNames(run.training.currentEvent, cast);
        }
        run.training.eventLog = run.training.eventLog.map(entry => (
            entry && typeof entry === 'object' ? resolvePlayerSpeakerNames(entry, cast) : entry
        ));
        return run;
    }

    function createEmptySaveSlots() {
        return { auto: null, manual: Array.from({ length: MANUAL_SLOT_COUNT }, () => null) };
    }

    function normalizeSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') return null;
        const run = normalizeRun(snapshot.run || snapshot);
        if (!run || !run.id || !run.setup || !run.currentScene) return null;
        const beatIndex = clampInt(
            run.beatIndex,
            0,
            Math.max(0, (run.currentScene.beats || []).length),
            0
        );
        run.beatIndex = beatIndex;
        return {
            id: String(snapshot.id || `save-${Date.now()}`),
            title: String(snapshot.title || run.setup.title || '未命名游戏'),
            phase: String(run.phase || run.currentScene.phase || 'prologue'),
            sceneNumber: clampInt(run.sceneNumber, 0, 999999, 0),
            beatIndex,
            savedAt: Number(snapshot.savedAt) || Date.now(),
            run
        };
    }

    function normalizeSaveSlots(value) {
        const source = value && typeof value === 'object' ? value : {};
        const manual = Array.from({ length: MANUAL_SLOT_COUNT }, (_, index) => normalizeSnapshot(source.manual?.[index]));
        return { auto: normalizeSnapshot(source.auto), manual };
    }

    function createDefaultState(homeCatalog = null) {
        return {
            schemaVersion: SCHEMA_VERSION,
            homeCatalog: homeCatalog && typeof homeCatalog === 'object' ? clone(homeCatalog) : null,
            activeRun: null,
            saveSlots: createEmptySaveSlots(),
            unlockedEndings: [],
            uiSettings: { textSpeed: 'normal', reduceMotion: false }
        };
    }

    function normalizeState(rawState, fallbackHomeCatalog = null) {
        const source = rawState && typeof rawState === 'object' ? rawState : {};
        const version = Number(source.schemaVersion) || 1;
        const migrated = version !== SCHEMA_VERSION;
        const defaults = createDefaultState(source.homeCatalog || fallbackHomeCatalog);
        const preserveRuns = version >= 2;
        return {
            state: {
                ...defaults,
                homeCatalog: source.homeCatalog && typeof source.homeCatalog === 'object' ? clone(source.homeCatalog) : defaults.homeCatalog,
                activeRun: preserveRuns ? normalizeRun(source.activeRun) : null,
                saveSlots: preserveRuns ? normalizeSaveSlots(source.saveSlots) : createEmptySaveSlots(),
                unlockedEndings: (Array.isArray(source.unlockedEndings) ? source.unlockedEndings : []).map(normalizeEnding).filter(Boolean),
                uiSettings: {
                    textSpeed: ['slow', 'normal', 'fast'].includes(source.uiSettings?.textSpeed) ? source.uiSettings.textSpeed : 'normal',
                    reduceMotion: !!source.uiSettings?.reduceMotion
                }
            },
            migrated
        };
    }

    return {
        SCHEMA_VERSION,
        MANUAL_SLOT_COUNT,
        DEFAULT_ATTRIBUTES,
        clone,
        clampInt,
        randomAttributeValue,
        createDefaultAttributes,
        normalizeAttributes,
        normalizeCharacterAttributes,
        normalizeCast,
        cleanJsonText,
        normalizeOutcome,
        normalizeTrainingOutcome,
        normalizeScenePayload,
        normalizeMapPayload,
        normalizeTrainingEventPayload,
        normalizeCharacterProfiles,
        mergeCharacterProfiles,
        resolvePlayerSpeakerNames,
        getRequirementStatus,
        ensureUnlockedChoice,
        applyOutcome,
        applyTrainingOutcome,
        createDefaultTraining,
        normalizeTrainingEventResult,
        normalizeTraining,
        normalizeRun,
        createEmptySaveSlots,
        normalizeSaveSlots,
        normalizeSnapshot,
        createDefaultState,
        normalizeState
    };
});
