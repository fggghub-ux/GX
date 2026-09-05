// ==========================================
// TIKTOK: 3. HOME TAB & VIDEO FEED
// ==========================================

(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    const feedContainer = document.getElementById('tk-feed-container');
    const apiGenBtn = document.getElementById('tk-api-generate-btn');
    let currentEditingVideoId = null;
    const TK_COMMENT_RENDER_LIMIT = 50;
    let tkFeedWheelLocked = false;
    let tkFeedTouchStart = null;

    function tkEscapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function tkEscapeAttr(value) {
        return tkEscapeHtml(value);
    }

    function tkCleanTranslation(value) {
        return String(value || '').trim();
    }

    function tkGetSceneTranslation(video = {}, index = 0) {
        const translations = Array.isArray(video.sceneSegmentTranslationsZh)
            ? video.sceneSegmentTranslationsZh
            : [];
        const segmentTranslation = tkCleanTranslation(translations[index]);
        if (segmentTranslation) return segmentTranslation;

        const fieldNames = ['openingTranslationZh', 'middleTranslationZh', 'endingTranslationZh'];
        const fieldTranslation = tkCleanTranslation(video[fieldNames[index]]);
        if (fieldTranslation) return fieldTranslation;

        return index === 0 ? tkCleanTranslation(video.translationZh) : '';
    }

    function tkCommentTranslationHtml(translation, id) {
        const clean = tkCleanTranslation(translation);
        if (!clean) return '';
        return `
            <div class="tk-comment-translation" id="${tkEscapeAttr(id)}" style="display:none;">
                ${tkEscapeHtml(clean)}
            </div>
        `;
    }

    function tkSplitSceneText(text) {
        const clean = String(text || '').trim();
        if (!clean) return [];

        const sentenceParts = clean
            .split(/(?<=[。！？!?；;])\s*/)
            .map(part => part.trim())
            .filter(Boolean);

        if (sentenceParts.length >= 2) return sentenceParts.slice(0, 5);

        const targetSize = Math.max(30, Math.ceil(clean.length / 3));
        const parts = [];
        for (let i = 0; i < clean.length; i += targetSize) {
            parts.push(clean.slice(i, i + targetSize).trim());
        }
        return parts.filter(Boolean).slice(0, 5);
    }

    function tkGetSceneSegments(video = {}) {
        const rawSegments = Array.isArray(video.sceneSegments)
            ? video.sceneSegments
            : [video.opening, video.middle, video.ending].filter(Boolean);
        const segments = rawSegments.map(part => String(part || '').trim()).filter(Boolean);
        if (segments.length) return segments.slice(0, 5);
        return tkSplitSceneText(video.sceneText);
    }

    function tkGetSceneText(video = {}) {
        const segments = tkGetSceneSegments(video);
        return segments.length ? segments.join(' ') : String(video.sceneText || '').trim();
    }

    window.tkFormatCount = function(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return '0';
        const abs = Math.abs(num);
        if (abs >= 1000000) {
            const formatted = (num / 1000000).toFixed(abs >= 10000000 ? 0 : 1).replace(/\.0$/, '');
            return `${formatted}M`;
        }
        if (abs >= 1000) {
            const formatted = (num / 1000).toFixed(abs >= 10000 ? 0 : 1).replace(/\.0$/, '');
            return `${formatted}K`;
        }
        return String(Math.round(num));
    };

    window.tkGetRandomAvatarUrl = function(seed = '') {
        const rawSeed = String(seed || `tk_avatar_${Math.floor(Math.random() * 1000000)}`).trim() || 'tk_avatar';
        return `https://picsum.photos/seed/${encodeURIComponent(rawSeed)}/150/150`;
    };

    window.tkResolveAvatar = function(id, name, originalAvatar) {
        const stableSeed = id || name || `tk_avatar_${Math.floor(Math.random() * 1000000)}`;
        const tkChar = id && window.tkGetChar ? window.tkGetChar(id) : null;

        // 角色存在但头像为空/删除时，统一使用随机图片，避免继续沿用旧视频/旧评论头像或人形图标。
        if (tkChar) {
            if (tkChar.avatar) return tkChar.avatar;
            return window.tkGetRandomAvatarUrl(`${tkChar.id || id || name}_deleted_or_empty_avatar`);
        }

        if (originalAvatar) return originalAvatar;

        if (window.resolveYtLinkedImChar) {
            const imChar = window.resolveYtLinkedImChar({
                id,
                imCharId: id,
                handle: id,
                name
            });
            if (imChar && imChar.avatarUrl) return imChar.avatarUrl;
        }

        return window.tkGetRandomAvatarUrl(stableSeed);
    };

    function tkStableImageUrl(video = {}) {
        const existing = video.imageUrl || video.cover || video.bgImage;
        if (existing) return existing;
        const seed = encodeURIComponent(video.imagePrompt || video.desc || video.authorName || video.id || 'tiktok-image');
        return `https://picsum.photos/seed/${seed}/900/1200`;
    }

    function tkGetMediaType(video = {}) {
        if (video.mediaType === 'image') return 'image';
        if (video.mediaType === 'video') return 'video';
        const hasSegments = tkGetSceneSegments(video).length > 0 || Boolean(video.sceneText);
        if ((video.imageUrl || video.imagePrompt || video.contentType === 'image') || ((video.cover || video.bgImage) && !hasSegments)) {
            return 'image';
        }
        return 'video';
    }

    function tkCreateFeedProgressHtml(video = {}) {
        if (tkGetMediaType(video) === 'image') {
            const count = Math.max(2, Math.min(5, tkGetSceneSegments(video).length || 3));
            const duration = Math.max(9000, count * 3200);
            return `
                <div class="tk-feed-progress tk-feed-progress-segments tk-feed-progress-count-${count}" style="--tk-segment-count:${count}; --tk-progress-duration:${duration}ms;" aria-hidden="true">
                    ${Array.from({ length: count }).map((_, index) => `<span style="--tk-segment-index:${index};"></span>`).join('')}
                </div>
            `;
        }
        return `
            <div class="tk-feed-progress tk-feed-progress-video" style="--tk-progress-duration:9500ms;" aria-hidden="true">
                <span></span>
            </div>
        `;
    }

    window.tkCreateFeedProgressHtml = tkCreateFeedProgressHtml;

    window.tkHandleMention = function(name, e) {
        if(e) e.stopPropagation();
        let char = tkState.chars.find(c => c.name === name || c.handle === name);
        if (!char) {
            let imChar = null;
            if (window.resolveYtLinkedImChar) {
                imChar = window.resolveYtLinkedImChar({name: name});
            }
            const newId = 'mention_' + Date.now();
            window.tkSaveChar({
                id: newId,
                name: name,
                handle: name.toLowerCase().replace(/\s+/g, ''),
                avatar: imChar ? imChar.avatarUrl : window.tkResolveAvatar(newId, name),
                status: '',
                persona: `从评论区被艾特的 ${name}`,
                isFollowed: false
            });
            char = window.tkGetChar(newId);
        }
        if (char && window.tkOpenSubProfile) {
            const detailSheet = document.getElementById('tk-video-detail-sheet');
            if (detailSheet) window.closeView(detailSheet);
            window.tkOpenSubProfile(char.id);
        }
    };

    function tkResolveMentionDisplayName(rawName) {
        const normalized = String(rawName || '').replace(/^@/, '').trim();
        if (!normalized) return rawName;
        const lower = normalized.toLowerCase();
        const char = tkState.chars.find(c => {
            return String(c.name || '').toLowerCase() === lower
                || String(c.handle || '').toLowerCase() === lower
                || String(c.id || '').toLowerCase() === lower;
        });
        return char ? (char.name || char.handle || normalized) : normalized;
    }

    function renderCommentText(text) {
        if (!text) return '';
        const safeText = tkEscapeHtml(text);
        return safeText.replace(/@([^\s，。！？]+)/g, (match, rawName) => {
            const displayName = tkResolveMentionDisplayName(rawName);
            return `<span class="tk-comment-mention" style="color: #ff4b4b; cursor: pointer;" onclick="window.tkHandleMention(${tkEscapeAttr(JSON.stringify(rawName))}, event)">@${tkEscapeHtml(displayName)}</span>`;
        });
    }

    function tkCreateBubbleFlowHtml(video = {}, options = {}) {
        const segments = tkGetSceneSegments(video);
        if (!segments.length) return '';
        const bubbleBg = options.background || ((video.cover || video.bgImage) ? 'rgba(17,17,17,0.82)' : '#111111');
        const total = Math.max(segments.length * 3.4, 6);

        return `
            <div class="tk-bubble-flow" style="--tk-flow-total:${total}s;">
                ${segments.map((segment, index) => `
                    <div class="tk-bubble-flow-item" style="--tk-flow-index:${index}; --tk-flow-bg:${bubbleBg};">
                        <div>${tkEscapeHtml(segment)}</div>
                        ${tkGetSceneTranslation(video, index) ? `<div class="tk-bubble-translation">${tkEscapeHtml(tkGetSceneTranslation(video, index))}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    function tkNormalizeComments(comments = []) {
        const safeComments = Array.isArray(comments) ? comments.slice(0, TK_COMMENT_RENDER_LIMIT) : [];
        return safeComments.map((comment, index) => ({
            id: comment.id || `cmt_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}`,
            authorId: comment.authorId || `commenter_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}`,
            authorName: comment.authorName || 'User',
            authorAvatar: comment.authorAvatar || '',
            text: comment.text || '',
            translationZh: tkCleanTranslation(comment.translationZh || comment.translation || comment.zhTranslation),
            likes: Number.isFinite(Number(comment.likes)) ? Number(comment.likes) : 0,
            isLiked: Boolean(comment.isLiked),
            replies: Array.isArray(comment.replies) ? comment.replies.slice(0, TK_COMMENT_RENDER_LIMIT).map((reply, replyIndex) => ({
                id: reply.id || `reply_${Date.now()}_${index}_${replyIndex}_${Math.floor(Math.random() * 1000)}`,
                authorId: reply.authorId || `reply_user_${Date.now()}_${index}_${replyIndex}_${Math.floor(Math.random() * 1000)}`,
                authorName: reply.authorName || 'User',
                authorAvatar: reply.authorAvatar || '',
                text: reply.text || '',
                translationZh: tkCleanTranslation(reply.translationZh || reply.translation || reply.zhTranslation),
                likes: Number.isFinite(Number(reply.likes)) ? Number(reply.likes) : 0
            })) : []
        })).filter(comment => comment.text);
    }

    window.tkNormalizeVideoPayload = function(payload = {}, overrides = {}) {
        const segments = Array.isArray(payload.sceneSegments)
            ? payload.sceneSegments
            : [payload.opening, payload.middle, payload.ending].filter(Boolean);
        const sceneSegments = segments.map(part => String(part || '').trim()).filter(Boolean).slice(0, 5);
        const rawSegmentTranslations = Array.isArray(payload.sceneSegmentTranslationsZh)
            ? payload.sceneSegmentTranslationsZh
            : [payload.openingTranslationZh, payload.middleTranslationZh, payload.endingTranslationZh];
        const sceneSegmentTranslationsZh = sceneSegments.map((_, index) => tkCleanTranslation(rawSegmentTranslations[index]));
        const sceneText = payload.sceneText || sceneSegments.join(' ');
        const comments = tkNormalizeComments(payload.comments);
        const inferredMediaType = payload.mediaType === 'image' || payload.contentType === 'image' || payload.imageUrl || payload.imagePrompt || ((payload.cover || payload.bgImage) && !sceneText)
            ? 'image'
            : 'video';
        const mediaType = overrides.mediaType || (payload.mediaType === 'video' ? 'video' : inferredMediaType);
        const imagePrompt = payload.imagePrompt || payload.visualPrompt || '';
        const fallbackImage = (mediaType === 'image' || imagePrompt)
            ? `https://picsum.photos/seed/${encodeURIComponent(imagePrompt || payload.desc || payload.authorName || payload.id || Date.now())}/900/1200`
            : null;

        return {
            id: overrides.id || payload.id || `v_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            authorId: overrides.authorId || payload.authorId || payload.handle || `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            authorName: overrides.authorName || payload.authorName || 'User',
            authorAvatar: overrides.authorAvatar ?? payload.authorAvatar ?? null,
            mediaType,
            imagePrompt,
            imageUrl: payload.imageUrl || null,
            desc: payload.desc || '',
            opening: payload.opening || sceneSegments[0] || '',
            middle: payload.middle || sceneSegments[1] || '',
            ending: payload.ending || sceneSegments[2] || '',
            translationZh: tkCleanTranslation(payload.translationZh || payload.sceneTextTranslationZh || payload.translation),
            openingTranslationZh: tkCleanTranslation(payload.openingTranslationZh || sceneSegmentTranslationsZh[0]),
            middleTranslationZh: tkCleanTranslation(payload.middleTranslationZh || sceneSegmentTranslationsZh[1]),
            endingTranslationZh: tkCleanTranslation(payload.endingTranslationZh || sceneSegmentTranslationsZh[2]),
            sceneSegments,
            sceneSegmentTranslationsZh,
            sceneText,
            likes: Number.isFinite(Number(payload.likes)) ? Number(payload.likes) : Math.floor(Math.random() * 1000),
            commentsCount: tkCountVideoComments({ comments }),
            shares: Number.isFinite(Number(payload.shares)) ? Number(payload.shares) : Math.floor(Math.random() * 100),
            isLiked: Boolean(payload.isLiked),
            comments,
            cover: payload.cover || fallbackImage,
            bgImage: payload.bgImage || null,
            bgColor: payload.bgColor || null,
            ...overrides
        };
    };

    window.tkBuildWorldBookContext = function(contextText = '', options = {}) {
        const chunks = [];
        const normalizeEntry = window.normalizeWorldBookEntry || ((entry) => entry);
        const formatEntry = window.formatWorldBookEntryForPrompt || ((entry) => {
            const title = entry.title || entry.keyword || 'World Book Entry';
            return `【${title}】\n${entry.content || ''}`.trim();
        });
        const keywordMatched = window.worldBookKeywordMatched || ((entry, text) => {
            if (!entry || entry.triggerMode !== 'keyword') return true;
            const keyword = String(entry.keyword || '').trim();
            return keyword ? String(text || '').includes(keyword) : false;
        });

        const explicitBoundIds = Array.isArray(options.boundIds) ? options.boundIds : [];
        const tkBoundIds = Array.isArray(tkState.settings?.boundWorldBookIds)
            ? tkState.settings.boundWorldBookIds
            : [];
        const boundIdSet = new Set([...explicitBoundIds, ...tkBoundIds]
            .filter(Boolean)
            .map(id => String(id)));

        if (window.getWorldBooks) {
            const books = window.getWorldBooks()
                .filter(book => book && (book.isGlobal || boundIdSet.has(String(book.id))));
            const entries = [];
            books.forEach(book => {
                (Array.isArray(book.entries) ? book.entries : []).forEach(entry => {
                    const normalized = normalizeEntry(entry);
                    if (normalized && normalized.enabled !== false && keywordMatched(normalized, contextText)) {
                        entries.push(normalized);
                    }
                });
            });
            if (entries.length) {
                chunks.push(`User World Book:\n${entries.map(formatEntry).join('\n\n')}`);
            }
        }

        if (window.getBuiltinWorldBookContext) {
            const builtin = window.getBuiltinWorldBookContext(null, contextText);
            if (builtin) chunks.push(builtin);
        }

        return chunks.join('\n\n').trim();
    };

    window.tkBuildWorldActorPrompt = function(options = {}) {
        const includeUserIdentity = Boolean(options.includeUserIdentity);
        const purpose = options.purpose || 'TikTok 内容生成';
        const triggerText = String(options.triggerText || '').trim();
        const userProfile = {
            name: tkState.profile?.name || window.userState?.name || '',
            handle: tkState.profile?.handle || '',
            tiktokPersona: tkState.profile?.persona || '',
            tiktokBio: tkState.profile?.bio || '',
            basePersona: window.userState?.persona || ''
        };
        const hasUserPersona = Object.values(userProfile).some(Boolean);
        const userBlock = hasUserPersona
            ? (includeUserIdentity
                ? `必要时才可提到的 user 身份（只作为上下文，不得扮演）：${JSON.stringify(userProfile, null, 2)}`
                : `user 人设关键词触发文本（只用于世界书/语境触发，不代表内容必须围绕 user；除非主题明确需要，否则不要提到 user）：${JSON.stringify(userProfile, null, 2)}`)
            : '没有显式 user 人设；不要自行编造 user 身份。';

        return `
世界观与 user 扮演规则（适用于 ${purpose}）：
- 你是这个世界观中的任何一个非 user 的真实账号/路人/粉丝/创作者/评论者，而不是旁白机器。
- 可以使用世界书、主题、角色人设和 user 人设关键词触发世界观信息，但不要强行让所有内容围绕 user。
- 只有当主题、评论语境或世界书明确需要提到 user 时，才把 user 当作被提及对象；否则不要提到 user。
- 即使必须提到 user，也只能从外部视角提及，禁止用第一人称替 user 说话，禁止让 user 发视频、发评论、点赞、关注或回复。
- 所有作者、评论者、回复者、访客和互动者都必须是 user 以外的人。
${triggerText ? `当前触发文本：${triggerText}` : ''}
${userBlock}
`.trim();
    };

    function tkResolveApiEndpoint() {
        return window.u2Api.resolveChatCompletionsEndpoint(window.apiConfig.endpoint);
    }

    function tkParseAiJson(rawText) {
        const raw = String(rawText || '')
            .replace(/```json/gi, '')
            .replace(/```/g, '')
            .trim();
        if (!raw) throw new Error('AI returned empty content');

        try {
            return JSON.parse(raw);
        } catch (firstError) {
            const arrayStart = raw.indexOf('[');
            const objectStart = raw.indexOf('{');
            const starts = [arrayStart, objectStart].filter(index => index >= 0);
            if (!starts.length) throw firstError;

            const start = Math.min(...starts);
            const endChar = raw[start] === '[' ? ']' : '}';
            const end = raw.lastIndexOf(endChar);
            if (end <= start) throw firstError;

            const extracted = raw.slice(start, end + 1)
                .replace(/,\s*([}\]])/g, '$1')
                .trim();
            return JSON.parse(extracted);
        }
    }

    window.tkParseAiJson = tkParseAiJson;

    function tkSlugText(value) {
        return String(value || 'user')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^\w\u4e00-\u9fa5-]/g, '')
            .slice(0, 40) || 'user';
    }

    function tkCountVideoComments(video) {
        if (!video || !Array.isArray(video.comments)) return 0;
        return video.comments.reduce((total, comment) => {
            return total + 1 + (Array.isArray(comment.replies) ? comment.replies.length : 0);
        }, 0);
    }

    function tkNormalizeGeneratedReply(reply = {}, index = 0) {
        const name = reply.authorName || reply.name || `User ${index + 1}`;
        const id = reply.authorId || reply.id || `reply_${tkSlugText(name)}_${Date.now()}_${index}`;
        const avatar = window.tkResolveAvatar(id, name, reply.authorAvatar || reply.avatar || '');
        return {
            id: reply.id || `reply_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}`,
            authorId: id,
            authorName: name,
            authorAvatar: avatar,
            text: String(reply.text || reply.content || '').trim(),
            translationZh: tkCleanTranslation(reply.translationZh || reply.translation || reply.zhTranslation),
            likes: Number.isFinite(Number(reply.likes)) ? Number(reply.likes) : Math.floor(Math.random() * 80)
        };
    }

    window.tkSaveProfileVisitors = function(visitors = [], source = {}) {
        if (!tkState.profile || typeof tkState.profile !== 'object') tkState.profile = {};
        const existing = Array.isArray(tkState.profile.visitors) ? tkState.profile.visitors : [];
        const nextVisitors = [];
        const seenNew = new Set();

        visitors.slice(0, 5).forEach((visitor, index) => {
            const name = visitor.authorName || visitor.name || `Visitor ${index + 1}`;
            const handle = visitor.handle || tkSlugText(name);
            const id = visitor.authorId || visitor.id || `visitor_${handle}_${Date.now()}_${index}`;
            const thought = String(visitor.thought || visitor.reason || visitor.text || '').trim().slice(0, 30);
            const key = String(handle || id || name).toLowerCase();
            if (!name || seenNew.has(key)) return;
            seenNew.add(key);
            nextVisitors.push({
                id,
                name,
                handle,
                avatar: window.tkResolveAvatar(id, name, visitor.authorAvatar || visitor.avatar || ''),
                thought: thought || '看完你的评论后，想确认你主页里是不是还有同样真实的内容。',
                reason: thought || '看完你的评论后访问了主页',
                sourceVideoId: source.videoId || '',
                sourceCommentId: source.commentId || '',
                createdAt: Date.now() - index
            });
        });

        const seenAll = new Set(nextVisitors.map(visitor => String(visitor.handle || visitor.id || visitor.name).toLowerCase()));
        tkState.profile.visitors = nextVisitors
            .concat(existing.filter(visitor => {
                const key = String(visitor.handle || visitor.id || visitor.name).toLowerCase();
                if (seenAll.has(key)) return false;
                seenAll.add(key);
                return true;
            }))
            .slice(0, 50);
    };

    function tkInteractionSlug(value, fallback = 'user') {
        const slug = tkSlugText(value || fallback);
        return slug || fallback;
    }

    function tkEnsureFollowerChar(follower = {}, index = 0) {
        const name = String(follower.authorName || follower.name || `New Followers${index + 1}`).trim();
        const handle = tkInteractionSlug(follower.handle || follower.authorId || follower.id || name, `follower_${index + 1}`);
        const id = String(follower.authorId || follower.id || `follower_${handle}`);
        let char = window.tkGetChar ? window.tkGetChar(id) : null;
        const avatar = window.tkResolveAvatar
            ? window.tkResolveAvatar(id, name, follower.authorAvatar || follower.avatar || '')
            : (follower.authorAvatar || follower.avatar || '');

        if (!char && window.tkSaveChar) {
            window.tkSaveChar({
                id,
                name,
                handle,
                avatar,
                status: follower.status || '刚刚关注了你',
                persona: follower.persona || `${name} 是 TikTok 上刚关注 user 的粉丝。`,
                bio: follower.bio || '来自新粉丝',
                isFollowed: false,
                isFollower: true
            });
            char = window.tkGetChar ? window.tkGetChar(id) : null;
        } else if (char) {
            char.isFollower = true;
            if (!char.name && name) char.name = name;
            if (!char.handle && handle) char.handle = handle;
            if (!char.avatar && avatar) char.avatar = avatar;
        }

        return char;
    }

    function tkNormalizeGeneratedComment(comment = {}, index = 0) {
        const name = comment.authorName || comment.name || `User ${index + 1}`;
        const authorId = comment.authorId || comment.id || `commenter_${tkInteractionSlug(name)}_${Date.now()}_${index}`;
        const avatar = window.tkResolveAvatar(authorId, name, comment.authorAvatar || comment.avatar || '');
        return {
            id: comment.id || `cmt_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}`,
            authorId,
            authorName: name,
            authorAvatar: avatar,
            text: String(comment.text || comment.content || '').trim(),
            translationZh: tkCleanTranslation(comment.translationZh || comment.translation || comment.zhTranslation),
            likes: Number.isFinite(Number(comment.likes)) ? Number(comment.likes) : Math.floor(Math.random() * 50),
            replies: Array.isArray(comment.replies)
                ? comment.replies.map((reply, replyIndex) => tkNormalizeGeneratedReply(reply, replyIndex)).filter(reply => reply.text)
            : []
        };
    }

    function tkIsUserGeneratedActor(entry = {}) {
        const ids = ['user', 'profile', tkState.profile?.id, window.userState?.id]
            .filter(Boolean)
            .map(value => String(value).toLowerCase());
        const names = [tkState.profile?.name, window.userState?.name, tkState.profile?.handle, window.userState?.realName]
            .filter(Boolean)
            .map(value => String(value).trim().toLowerCase());
        const entryId = String(entry.authorId || entry.id || '').toLowerCase();
        const entryName = String(entry.authorName || entry.name || '').trim().toLowerCase();
        return (entryId && ids.includes(entryId)) || (entryName && names.includes(entryName));
    }

    function tkRecordVideoActivity({ followers = 0, followerEntries = [], likes = 0, saves = 0, comments = 0, commentEntries = [], video = null } = {}) {
        tkState.activity = {
            newFollowers: tkState.activity?.newFollowers || 'No new followers yet',
            likesSaves: tkState.activity?.likesSaves || 'Interactions',
            commentsMentions: tkState.activity?.commentsMentions || 'Interactions',
            followers: Array.isArray(tkState.activity?.followers) ? tkState.activity.followers : [],
            likes: Array.isArray(tkState.activity?.likes) ? tkState.activity.likes : [],
            saves: Array.isArray(tkState.activity?.saves) ? tkState.activity.saves : [],
            comments: Array.isArray(tkState.activity?.comments) ? tkState.activity.comments : []
        };

        if (followers > 0) tkState.activity.newFollowers = `${followers}人关注了你`;
        if (Array.isArray(followerEntries) && followerEntries.length) {
            const followerItems = followerEntries.map((entry, index) => ({
                id: entry.id || entry.authorId || `follower_activity_${Date.now()}_${index}`,
                name: entry.name || entry.authorName || `New Followers${index + 1}`,
                avatar: entry.avatar || entry.authorAvatar || '',
                text: '关注了你',
                createdAt: Date.now() - index
            }));
            tkState.activity.followers = followerItems.concat(tkState.activity.followers).slice(0, 50);
        }

        const likeSaveParts = [];
        if (likes > 0) likeSaveParts.push(`${likes}人点赞了你`);
        if (saves > 0) likeSaveParts.push(`${saves}人收藏了你的视频`);
        if (likeSaveParts.length) tkState.activity.likesSaves = likeSaveParts.join(' · ');
        if (likes > 0) {
            tkState.activity.likes = [{
                id: `likes_${video?.id || 'video'}_${Date.now()}`,
                icon: 'fa-heart',
                title: '点赞',
                text: `${likes}人点赞了你`,
                videoId: video?.id || '',
                createdAt: Date.now()
            }].concat(tkState.activity.likes).slice(0, 50);
        }
        if (saves > 0) {
            tkState.activity.saves = [{
                id: `saves_${video?.id || 'video'}_${Date.now()}`,
                icon: 'fa-bookmark',
                title: '收藏',
                text: `${saves}人收藏了你的视频`,
                videoId: video?.id || '',
                createdAt: Date.now()
            }].concat(tkState.activity.saves).slice(0, 50);
        }

        if (comments > 0) tkState.activity.commentsMentions = `${comments}人评论了你的视频`;
        if (Array.isArray(commentEntries) && commentEntries.length) {
            const commentItems = commentEntries.map((entry, index) => ({
                id: entry.id || `comment_activity_${Date.now()}_${index}`,
                name: entry.authorName || entry.name || '评论者',
                avatar: entry.authorAvatar || entry.avatar || '',
                text: `评论了你的视频：${entry.text || ''}`,
                videoId: video?.id || '',
                commentId: entry.id || '',
                createdAt: Date.now() - index
            }));
            tkState.activity.comments = commentItems.concat(tkState.activity.comments).slice(0, 50);
        }
    }

    window.tkGenerateVideoInteractions = async function(videoId, options = {}) {
        const found = window.findVideoGlobal ? window.findVideoGlobal(videoId) : {};
        const video = found.video;
        const author = found.author || tkState.profile || {};
        const isAuto = Boolean(options.isAuto);
        if (!video) return;

        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
            if (window.showToast) window.showToast('请先在系统设置中配置 API');
            return;
        }

        if (window.showToast) window.showToast(isAuto ? 'AI 正在生成视频互动...' : 'AI 正在生成互动数据...');

        const followedChars = (tkState.chars || []).filter(c => c.isFollowed).slice(0, 6);
        const followedCharsContext = followedChars.length
            ? followedChars.map(c => `- CharID: ${c.id}, 名字: ${c.name || c.handle}, 人设: ${c.persona || ''}`).join('\n')
            : '没有已关注好友。';
        const isUserPost = String(video.authorId || '') === 'profile'
            || String(author.id || '') === 'profile'
            || (tkState.profile?.handle && String(author.handle || '') === String(tkState.profile.handle));
        const userTikTokProfileContext = {
            name: tkState.profile?.name || window.userState?.name || 'User',
            handle: tkState.profile?.handle || 'user',
            persona: tkState.profile?.persona || window.userState?.persona || '',
            bio: tkState.profile?.bio || '',
            basePersona: window.userState?.persona || ''
        };
        const effectiveAuthorContext = isUserPost ? userTikTokProfileContext : {
            name: author.name || tkState.profile?.name || 'User',
            handle: author.handle || 'user',
            persona: author.persona || tkState.profile?.persona || window.userState?.persona || '',
            bio: author.bio || tkState.profile?.bio || '',
            basePersona: window.userState?.persona || ''
        };
        const contextText = [
            video.desc || '',
            video.sceneText || '',
            Array.isArray(video.sceneSegments) ? video.sceneSegments.join('\n') : '',
            effectiveAuthorContext.persona || '',
            effectiveAuthorContext.bio || '',
            effectiveAuthorContext.name || '',
            effectiveAuthorContext.handle || '',
            window.userState?.persona || ''
        ].filter(Boolean).join('\n');
        const wbContext = window.tkBuildWorldBookContext ? window.tkBuildWorldBookContext(contextText) : '';
        const worldActorPrompt = window.tkBuildWorldActorPrompt
            ? window.tkBuildWorldActorPrompt({
                includeUserIdentity: isUserPost,
                purpose: '视频发布后的评论、关注、点赞、收藏和主页访客互动',
                triggerText: contextText
            })
            : '';

        const prompt = `
Creator identity rule:
${isUserPost
    ? 'This video was posted by the current user. Treat the creator/blogger as the user TikTok account below, and use the TikTok profile persona as the authoritative persona for followers, likes, comments, and visitors.'
    : 'This video was posted by another TikTok creator. Use the creator context below, but still avoid impersonating the current user.'}
The world book context was mounted with the video plus the user TikTok persona as trigger text.

你是 TikTok 视频互动模拟器。请根据视频、博主人设、已关注好友和世界书，生成这条视频发布后的真实互动。

${worldActorPrompt}

硬性规则：
1. 只返回严格 JSON 对象，不要 markdown，不要解释，不要尾逗号。
2. 必须包含 newFollowers、newLikes、newSaves、newComments、visitors 五个字段。
3. newFollowers 必须是 2-5 个新粉丝对象；每个对象含 authorId、authorName、authorAvatar、handle，可选 persona/status。
4. newLikes 是点赞人数数字；newSaves 是收藏人数数字。
5. newComments 必须是 2-5 条评论对象；每条含 authorId、authorName、authorAvatar、text、likes、replies。
6. 评论可以自然 @ 好友或路人；如果 @ 引发对话，放进 replies 数组，replies 每条含 authorId、authorName、authorAvatar、text、likes。
7. 禁止扮演user的身份发抖音和评论，你只能是除了user以外的人。严禁扮演、冒充或使用 user/博主本人发评论、点赞、收藏、关注；所有互动者必须是路人、粉丝、已关注好友或新访客。
8. 评论要有活人感、网感和上下文，不要像公告；如果用了已关注好友，authorId 必须填该好友 CharID。
9. 评论里的 @ 必须使用对方名字，不要使用账号、handle 或 id。
10. visitors 必须是 1-3 个主页访客对象；每个对象含 authorName、authorAvatar、handle、thought，thought 是 20-35 个中文字符的心声。
11. 国际化翻译规则：评论或 replies 的 text 如果不是中文，必须同时填写 translationZh，内容是自然中文翻译；如果 text 是中文，translationZh 必须是空字符串。

视频：
${JSON.stringify({
    id: video.id,
    desc: video.desc || '',
    mediaType: tkGetMediaType(video),
    sceneText: tkGetSceneText(video),
    sceneSegments: tkGetSceneSegments(video),
    currentLikes: video.likes || 0,
    currentSaves: video.saves || video.savedCount || 0,
    currentComments: tkCountVideoComments(video)
}, null, 2)}

博主：
${JSON.stringify({
    ...effectiveAuthorContext,
    isCurrentUserTikTokAccount: isUserPost
}, null, 2)}

已关注好友：
${followedCharsContext}

世界书：
${wbContext || '无'}

返回格式：
{
  "newFollowers": [
    {
      "authorId": "follower_unique_id",
      "authorName": "新粉丝名",
      "authorAvatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=follower",
      "handle": "follower_handle"
    }
  ],
  "newLikes": 128,
  "newSaves": 23,
  "newComments": [
    {
      "authorId": "commenter_id",
      "authorName": "评论者",
      "authorAvatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=commenter",
      "text": "评论内容",
      "translationZh": "",
      "likes": 12,
      "replies": [
        {
          "authorId": "reply_id",
          "authorName": "回复者",
          "authorAvatar": "",
          "text": "reply text",
          "translationZh": "回复文字的中文翻译",
          "likes": 5
        }
      ]
    }
  ],
  "visitors": [
    {
      "authorName": "访客名",
      "authorAvatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=visitor",
      "handle": "visitor_handle",
      "thought": "这条视频的细节让我想点进主页看看"
    }
  ]
}
`;

        try {
            const response = await fetch(tkResolveApiEndpoint(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.apiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: window.apiConfig.model || 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: 'Return strict valid JSON only. Use double-quoted keys and strings. Do not use markdown, comments, prose, or trailing commas.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: parseFloat(window.apiConfig.temperature) || 0.8
                })
            });

            if (!response.ok) throw new Error(`API Error: ${response.status}`);

            const data = await response.json();
            const parsed = tkParseAiJson(data.choices?.[0]?.message?.content || '');
            const followers = Array.isArray(parsed.newFollowers)
                ? parsed.newFollowers.filter(entry => !tkIsUserGeneratedActor(entry)).slice(0, 5)
                : [];
            const comments = Array.isArray(parsed.newComments)
                ? parsed.newComments.filter(entry => !tkIsUserGeneratedActor(entry)).slice(0, 5)
                : [];
            const visitors = Array.isArray(parsed.visitors)
                ? parsed.visitors.filter(entry => !tkIsUserGeneratedActor(entry)).slice(0, 3)
                : [];
            const newLikes = Math.max(0, Number(parsed.newLikes) || 0);
            const newSaves = Math.max(0, Number(parsed.newSaves) || 0);

            followers.forEach((follower, index) => tkEnsureFollowerChar(follower, index));

            video.likes = (Number(video.likes) || 0) + newLikes;
            video.savedCount = (Number(video.savedCount || video.saves) || 0) + newSaves;
            video.saves = video.savedCount;

            if (!Array.isArray(video.comments)) video.comments = [];
            comments
                .map(tkNormalizeGeneratedComment)
                .filter(comment => comment.text)
                .reverse()
                .forEach(comment => video.comments.unshift(comment));

            if (visitors.length && window.tkSaveProfileVisitors) {
                window.tkSaveProfileVisitors(visitors, { videoId: video.id });
            }

            video.commentsCount = tkCountVideoComments(video);
            tkRecordVideoActivity({
                followers: followers.length,
                followerEntries: followers,
                likes: newLikes,
                saves: newSaves,
                comments: comments.length,
                commentEntries: comments,
                video
            });

            if (window.tkPersistState) window.tkPersistState();
            if (window.tkRenderHome) window.tkRenderHome();
            if (window.tkRenderProfile) window.tkRenderProfile();
            if (window.tkRenderChat) window.tkRenderChat();
            if (currentCommentVideoId === video.id) renderCommentsList(video);

            const fsViewEl = document.getElementById('tk-fullscreen-video-view');
            if (fsViewEl && fsViewEl.dataset.videoId === video.id) {
                const likesEl = document.getElementById('tk-fs-video-likes');
                const commentsEl = document.getElementById('tk-fs-video-comments');
                if (likesEl) likesEl.textContent = window.tkFormatCount(video.likes || 0);
                if (commentsEl) commentsEl.textContent = window.tkFormatCount(video.commentsCount || 0);
            }

            if (window.showToast) window.showToast('互动数据生成完毕');
        } catch (error) {
            console.error('Video Interaction Gen Error:', error);
            if (window.showToast) window.showToast('生成互动失败，请检查 API');
        }
    };

    async function tkGenerateUserCommentAftermath(video, targetComment, parentComment, userText) {
        if (!video || !targetComment || !userText) return;
        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) return;

        const videoContext = {
            desc: video.desc || '',
            mediaType: tkGetMediaType(video),
            sceneSegments: tkGetSceneSegments(video),
            authorName: video.authorName || 'User'
        };
        const userPersonaContext = [
            window.userState && window.userState.persona ? `User persona: ${window.userState.persona}` : '',
            tkState.profile && tkState.profile.persona ? `TikTok profile persona: ${tkState.profile.persona}` : '',
            tkState.profile && tkState.profile.bio ? `TikTok profile bio: ${tkState.profile.bio}` : '',
            tkState.profile && tkState.profile.name ? `TikTok profile name: ${tkState.profile.name}` : ''
        ].filter(Boolean).join('\n');
        const parentContext = parentComment ? {
            authorName: parentComment.authorName || 'User',
            text: parentComment.text || ''
        } : null;
        const wbContext = window.tkBuildWorldBookContext
            ? window.tkBuildWorldBookContext(`${video.desc || ''}\n${userText}\n${parentContext ? parentContext.text : ''}\n${userPersonaContext}`)
            : '';
        const worldActorPrompt = window.tkBuildWorldActorPrompt
            ? window.tkBuildWorldActorPrompt({
                includeUserIdentity: true,
                purpose: 'user 发出评论后的楼中楼回复和主页访客',
                triggerText: `${video.desc || ''}\n${userText}`
            })
            : '';
        const prompt = `
你是 TikTok 评论区和主页访客模拟器。请根据当前视频、用户刚发出的评论，以及可选楼主评论，生成真实、有网感、符合上下文的互动。

${worldActorPrompt}

硬性规则：
1. 只能返回严格 JSON，不要 markdown，不要解释文字，不要尾逗号，不要单引号。
2. JSON 顶层必须是对象，且只包含 "replies" 和 "visitors" 两个数组。
3. "replies" 必须生成 2-5 条相关楼中楼评论；如果用户是在回复楼主，回复内容必须包含楼主评论语境。
4. "visitors" 必须生成 2-5 条主页访客；每条访客必须有 authorName、authorAvatar、handle、thought。
5. thought 必须是 20-30 个中文字符，写清楚这个人为什么看 user 主页，像真实心声，不要像系统文案。
6. 所有 key 必须使用英文双引号；所有数组和对象最后一项后面不能有逗号。
7. 国际化翻译规则：每条 replies 的 text 如果不是中文，必须同时填写 translationZh，内容是自然中文翻译；如果 text 是中文，translationZh 必须是空字符串。
8. 禁止扮演user的身份发抖音和评论，你只能是除了user以外的人。

视频上下文：
${JSON.stringify(videoContext, null, 2)}

User context:
${userPersonaContext || 'No explicit user persona. Infer a normal TikTok user.'}

用户评论：
${JSON.stringify(userText)}

${parentContext ? `用户回复的【目标评论】上下文：\n${JSON.stringify(parentContext, null, 2)}\n（注意：如果目标评论是楼主，请作为楼中楼互动；如果目标评论也是楼中楼，请延续他们的话题）` : '用户发的是新的根评论，没有上下文。'}

${wbContext}

返回格式示例：
{
  "replies": [
    {
      "authorName": "bagaholic_sz",
      "authorAvatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=a",
      "text": "Rose Sakura的Swift皮！！天 这个配置我等了一年半还没消息",
      "translationZh": "",
      "likes": 2.3K
    }
  ],
  "visitors": [
    {
      "authorName": "凯茜",
      "authorAvatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=li",
      "handle": "Cassie",
      "thought": "她评论太会抓重点了想看看主页"
    }
  ]
}
`;

        try {
            const response = await fetch(tkResolveApiEndpoint(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.apiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: window.apiConfig.model || 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'Return strict valid JSON only. Use double-quoted keys and strings. Do not use markdown, comments, prose, or trailing commas.'
                        },
                        { role: 'user', content: prompt }
                    ],
                    temperature: parseFloat(window.apiConfig.temperature) || 0.8
                })
            });
            if (!response.ok) throw new Error(`API Error: ${response.status}`);

            const data = await response.json();
            const parsed = tkParseAiJson(data.choices?.[0]?.message?.content || '');
            const replies = Array.isArray(parsed.replies) ? parsed.replies.slice(0, 5) : [];
            const visitors = Array.isArray(parsed.visitors) ? parsed.visitors.slice(0, 5) : [];

            if (!Array.isArray(targetComment.replies)) targetComment.replies = [];
            replies
                .map(tkNormalizeGeneratedReply)
                .filter(reply => reply.text)
                .forEach(reply => targetComment.replies.push(reply));

            if (window.tkSaveProfileVisitors) {
                window.tkSaveProfileVisitors(visitors, {
                    videoId: video.id,
                    commentId: targetComment.id
                });
            }

            video.commentsCount = tkCountVideoComments(video);
            if (window.tkPersistState) window.tkPersistState();
            if (currentCommentVideoId === video.id) renderCommentsList(video);
            window.tkRenderHome();
            if (visitors.length || replies.length) window.showToast('评论互动已更新');
        } catch (error) {
            console.error('Comment Followup Gen Error:', error);
        }
    }

    // Custom Background Upload bindings
    const bgBtn = document.getElementById('tk-edit-video-bg-btn');
    const bgUpload = document.getElementById('tk-edit-video-bg-upload');
    const bgImg = document.getElementById('tk-edit-video-bg-img');

    if (bgBtn && bgUpload) {
        bgBtn.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') bgUpload.click();
        });
        bgUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    bgImg.src = ev.target.result;
                    bgImg.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
            e.target.value = '';
        });
    }

    const resetBgBtn = document.getElementById('reset-tk-video-bg-btn');
    if (resetBgBtn) {
        resetBgBtn.addEventListener('click', () => {
            if (bgImg) {
                bgImg.src = '';
                bgImg.style.display = 'none';
            }
        });
    }

    const confirmEditVideoBtn = document.getElementById('tk-confirm-edit-video-btn');
    if (confirmEditVideoBtn) {
        confirmEditVideoBtn.addEventListener('click', () => {
            if (!currentEditingVideoId) return;
            
            // Allow editing videos from both global feed and user profile posts
            let targetVideo = null;
            if (window.findVideoGlobal) {
                const found = window.findVideoGlobal(currentEditingVideoId);
                if (found) targetVideo = found.video;
            } else {
                targetVideo = tkState.videos.find(v => v.id === currentEditingVideoId);
            }
            
            if (targetVideo) {
                // Determine if we should save to bgImage or cover based on original field (fallback to bgImage)
                if (targetVideo.cover !== undefined && targetVideo.cover !== null) {
                    targetVideo.cover = (bgImg && bgImg.style.display === 'block') ? bgImg.src : null;
                } else {
                    targetVideo.bgImage = (bgImg && bgImg.style.display === 'block') ? bgImg.src : null;
                }
                targetVideo.bgColor = null;
                targetVideo.desc = document.getElementById('tk-edit-video-desc-input').value.trim();
                targetVideo.sceneText = document.getElementById('tk-edit-video-scene-input').value.trim();
                targetVideo.sceneSegments = tkSplitSceneText(targetVideo.sceneText);
                targetVideo.opening = targetVideo.sceneSegments[0] || '';
                targetVideo.middle = targetVideo.sceneSegments[1] || '';
                targetVideo.ending = targetVideo.sceneSegments[2] || '';
                
                if (window.tkPersistState) window.tkPersistState();
                window.tkRenderHome();
                if (window.tkRenderProfile) window.tkRenderProfile();
                
                // If currently viewing in fullscreen, update it
                const fsView = document.getElementById('tk-fullscreen-video-view');
                if (fsView && fsView.classList.contains('active') && fsView.dataset.videoId === targetVideo.id) {
                    window.tkOpenFullscreenVideo(targetVideo.id); // re-trigger to update DOM
                }
                
                window.closeView(document.getElementById('tk-edit-single-video-sheet'));
                window.showToast('已保存修改');
            }
        });
    }

    function tkGetFeedCards() {
        return feedContainer ? Array.from(feedContainer.querySelectorAll('.tk-video-card')) : [];
    }

    function tkGetCurrentFeedCardIndex(cards) {
        if (!feedContainer || cards.length === 0) return -1;
        let closestIndex = 0;
        let closestDistance = Number.POSITIVE_INFINITY;
        cards.forEach((card, index) => {
            const distance = Math.abs(card.offsetTop - feedContainer.scrollTop);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = index;
            }
        });
        return closestIndex;
    }

    function tkPageHomeFeed(direction) {
        const cards = tkGetFeedCards();
        const currentIndex = tkGetCurrentFeedCardIndex(cards);
        if (currentIndex < 0) return false;

        const nextIndex = Math.min(cards.length - 1, Math.max(0, currentIndex + direction));
        if (nextIndex === currentIndex) return false;
        feedContainer.scrollTo({ top: cards[nextIndex].offsetTop, behavior: 'smooth' });
        return true;
    }

    function tkBindSingleStepFeedPaging() {
        if (!feedContainer || feedContainer.dataset.tkSingleStepPagingBound === 'true') return;
        feedContainer.dataset.tkSingleStepPagingBound = 'true';

        feedContainer.addEventListener('wheel', (event) => {
            if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || event.deltaY === 0) return;
            if (tkGetFeedCards().length < 2) return;
            event.preventDefault();
            if (tkFeedWheelLocked) return;

            tkFeedWheelLocked = true;
            tkPageHomeFeed(event.deltaY > 0 ? 1 : -1);
            window.setTimeout(() => {
                tkFeedWheelLocked = false;
            }, 420);
        }, { passive: false });

        feedContainer.addEventListener('touchstart', (event) => {
            const touch = event.touches[0];
            tkFeedTouchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
        }, { passive: true });

        feedContainer.addEventListener('touchmove', (event) => {
            if (!tkFeedTouchStart) return;
            const touch = event.touches[0];
            if (!touch) return;
            const deltaX = touch.clientX - tkFeedTouchStart.x;
            const deltaY = touch.clientY - tkFeedTouchStart.y;
            if (Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX)) event.preventDefault();
        }, { passive: false });

        feedContainer.addEventListener('touchend', (event) => {
            if (!tkFeedTouchStart) return;
            const touch = event.changedTouches[0];
            const start = tkFeedTouchStart;
            tkFeedTouchStart = null;
            if (!touch) return;

            const deltaX = touch.clientX - start.x;
            const deltaY = touch.clientY - start.y;
            if (Math.abs(deltaY) < 42 || Math.abs(deltaY) <= Math.abs(deltaX)) return;
            tkPageHomeFeed(deltaY < 0 ? 1 : -1);
        }, { passive: true });
    }

    function tkSetRecommendTopbarActive() {
        const tabs = Array.from(document.querySelectorAll('.tk-topbar-tab'));
        if (!tabs.length) return;
        tabs.forEach(tab => tab.classList.remove('active'));
        const recommendTab = tabs.find(tab => String(tab.textContent || '').includes('For You')) || tabs[1] || tabs[0];
        recommendTab.classList.add('active');
    }

    window.tkShowLatestGeneratedVideo = function(videoId) {
        const searchSheet = document.getElementById('tk-search-generate-sheet');
        if (searchSheet && window.closeView) window.closeView(searchSheet);

        const tkView = document.getElementById('tiktok-view');
        if (tkView) tkView.classList.add('active');

        tkSetRecommendTopbarActive();
        const homeNav = document.querySelector('.tk-bottom-nav .tk-nav-item[data-target="tk-home-tab"]');
        if (homeNav) {
            homeNav.click();
        } else if (window.tkRenderHome) {
            window.tkRenderHome();
        }

        requestAnimationFrame(() => {
            const safeVideoId = videoId && window.CSS && typeof CSS.escape === 'function'
                ? CSS.escape(String(videoId))
                : String(videoId || '').replace(/"/g, '\\"');
            const card = videoId && feedContainer
                ? feedContainer.querySelector(`.tk-video-card[data-video-id="${safeVideoId}"]`)
                : null;
            if (card && card.scrollIntoView) {
                card.scrollIntoView({ block: 'start' });
            } else if (feedContainer) {
                feedContainer.scrollTop = 0;
            }
        });
    };

    // Render Home Feed
    window.tkRenderHome = function(options = {}) {
        if (!feedContainer) return;
        
        // Determine active tab
        const activeTabEl = document.querySelector('.tk-topbar-tab.active');
        const isActiveTabFollowing = activeTabEl && activeTabEl.textContent === 'Following';
        
        // Filter videos based on tab
        let displayVideos = [];
        if (isActiveTabFollowing) {
            displayVideos = tkState.videos.filter(v => {
                const char = window.tkGetChar(v.authorId);
                return char && char.isFollowed;
            });
        } else {
            // "For You" tab - 过滤掉已关注的视频，只显示未关注的或系统的
            displayVideos = tkState.videos.filter(v => {
                const char = window.tkGetChar(v.authorId);
                return !char || !char.isFollowed;
            });
        }
        
        // Render videos
        feedContainer.innerHTML = '';
        
        if (displayVideos.length === 0) {
            if (isActiveTabFollowing) {
                feedContainer.innerHTML = '<div class="tk-empty-feed"><p style="color: #999; font-size: 14px;">No followed content yet, go explore.</p></div>';
            } else {
                feedContainer.innerHTML = `
                    <div class="tk-empty-feed">
                        <div class="tk-magic-btn-large" id="tk-api-generate-btn-empty" onclick="window.tkTriggerApiGenerate(event)">
                            <i class="fas fa-search"></i>
                            <span>生成内容</span>
                        </div>
                        <p style="color: #999; font-size: 13px; margin-top: 10px;">点击搜索生成 TikTok 视频流</p>
                    </div>
                `;
            }
            return;
        }

        const visibleVideos = displayVideos;
        
        visibleVideos.forEach((video, index) => {
            const char = window.tkGetChar(video.authorId);
            const isFollowed = char ? char.isFollowed : false;
            const authorName = char ? (char.name || char.handle) : video.authorName;
            const finalAvatar = window.tkResolveAvatar(video.authorId, authorName, video.authorAvatar);
            const avatarHtml = finalAvatar ? `<img src="${finalAvatar}">` : `<i class="fas fa-user"></i>`;

            // Format hashtags in description
            let formattedDesc = video.desc || '';
            formattedDesc = formattedDesc.replace(/#([\w\u4e00-\u9fa5]+)/g, '<span class="tk-hashtag" onclick="window.tkOpenHashtag(\'$1\', event)">#$1</span>');

            const card = document.createElement('div');
            card.className = 'tk-video-card';
            card.dataset.videoId = video.id; // Store ID for retrieving current video later
            
            let bgStyleStr = 'background: #ffffff;';
            let cardContentHtml = '';
            const mediaType = tkGetMediaType(video);
            const visualImageUrl = mediaType === 'image' ? tkStableImageUrl(video) : (video.cover || video.bgImage);
            
            // 独立背景区域：固定 4:3 (或 3:4) 宽高比例居中，稍微上移避免和底部名字重叠 (top: 45%)
            if (visualImageUrl) {
                cardContentHtml += `
                    <div class="tk-feed-visual ${mediaType === 'image' ? 'tk-feed-image-visual' : ''}">
                        <img src="${tkEscapeAttr(visualImageUrl)}" alt="">
                    </div>
                `;
            } else if (video.bgColor) {
                cardContentHtml += `
                    <div style="width: 100%; aspect-ratio: 3/4; background: ${video.bgColor}; position: absolute; top: 45%; transform: translateY(-50%);"></div>
                `;
            }

            // 独立气泡区域：悬浮其上，大小自适应文本内容，不全屏
            const bubbleFlowHtml = tkCreateBubbleFlowHtml(video);
            if (bubbleFlowHtml) {
                cardContentHtml += bubbleFlowHtml;
            } else if (video.sceneText) {
                let textContainerBg = '#111111';
                if (video.cover || video.bgImage) {
                    textContainerBg = 'rgba(17,17,17,0.8)';
                } else if (video.bgColor) {
                    textContainerBg = '#111111';
                }

                cardContentHtml += `
                    <div style="background: ${textContainerBg}; color: #ffffff; padding: 20px 24px; border-radius: 20px; max-width: 85%; margin: 0 auto; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 16px; line-height: 1.6; word-break: break-word; font-weight: 500; position: relative; z-index: 2; transform: translateY(-5vh);">
                        ${video.sceneText}
                    </div>
                `;
            } else if (!video.cover && !video.bgImage && !video.bgColor) {
                // 什么都没有的空视频保底
                cardContentHtml += `
                    <div style="background: #111111; color: #ffffff; padding: 20px 24px; border-radius: 20px; max-width: 85%; margin: 0 auto; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 16px; line-height: 1.6; word-break: break-word; font-weight: 500; position: relative; z-index: 2; transform: translateY(-5vh);">
                        No content yet
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="tk-video-text-content" style="${bgStyleStr} display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; position: relative;">
                    ${cardContentHtml}
                </div>

                <div class="tk-right-actions">
                    <div class="tk-avatar-action" onclick="window.tkHandleProfileClick('${video.authorId}', event)">
                        ${avatarHtml}
                        <div class="tk-action-plus ${isFollowed ? 'followed' : ''}" onclick="window.tkHandleFollow('${video.authorId}', event)">
                            <i class="fas fa-plus"></i>
                        </div>
                    </div>
                    
                    <div class="tk-action-item ${video.isLiked ? 'liked' : ''}" onclick="window.tkHandleLike('${video.id}', this, event)">
                        <i class="fas fa-heart"></i>
                        <span>${window.tkFormatCount(video.likes || 0)}</span>
                    </div>
                    
                    <div class="tk-action-item" onclick="window.tkOpenComments('${video.id}', event)">
                        <i class="fas fa-comment-dots"></i>
                        <span>${window.tkFormatCount(video.commentsCount || 0)}</span>
                    </div>
                    
            <div class="tk-action-item" onclick="window.tkOpenShare('${video.id}', event)">
                <i class="fas fa-share" style="transform: scaleX(-1);"></i>
                <span id="share-count-${video.id}">${window.tkFormatCount(video.shares || 0)}</span>
            </div>

                    <div class="tk-music-disc" onclick="window.tkOpenMusic(event)">
                        <i class="fas fa-music"></i>
                    </div>
                </div>

                ${tkCreateFeedProgressHtml(video)}

                <div class="tk-bottom-info">
                    <div class="tk-video-author">@${authorName}</div>
                    <div class="tk-video-desc">${formattedDesc}</div>
                </div>
            `;
            feedContainer.appendChild(card);
        });
    };


    // Make sure fullscreen music icon also opens music view
    setTimeout(() => {
        const fsMusicDisc = document.querySelector('#tk-fullscreen-video-view .tk-music-disc');
        if (fsMusicDisc) {
            const newDisc = fsMusicDisc.cloneNode(true);
            fsMusicDisc.parentNode.replaceChild(newDisc, fsMusicDisc);
            newDisc.addEventListener('click', (e) => window.tkOpenMusic(e));
        }
    }, 500);

    // Fullscreen Custom Video Player Logic
    const fsView = document.getElementById('tk-fullscreen-video-view');
    const backBtn = document.getElementById('tk-fs-video-back-btn');
    const magicBtn = document.getElementById('tk-fs-video-magic-btn');
    
    if (backBtn && fsView) {
        backBtn.addEventListener('click', () => {
            fsView.classList.remove('active');
            const coverEl = document.getElementById('tk-fs-video-cover');
            if (coverEl) coverEl.style.display = 'block'; // Reset
            document.getElementById('tk-fs-video-container').style.background = 'transparent';
        });
    }

    // Expose Helper to find video anywhere so other scripts can use it if needed
    window.findVideoGlobal = function(videoId) {
        let video = null;
        let author = null;
        let isUser = false;

        // 1. 尝试在用户自建的 posts 列表中查找
        if (tkState.profile && tkState.profile.posts) {
            video = tkState.profile.posts.find(v => v.id === videoId);
            if (video) {
                author = tkState.profile;
                isUser = true;
            }
        }

        // 2. 尝试在全局视频流中查找
        if (!video && tkState.videos) {
            video = tkState.videos.find(v => v.id === videoId);
            if (video) {
                author = window.tkGetChar(video.authorId);
                // 可能是 user 的点赞视频
                if (!author && video.authorId && video.authorId.startsWith('user_')) {
                    author = {
                        handle: video.authorName || 'user',
                        persona: '一个未知的 TikTok 用户',
                        avatar: video.authorAvatar
                    };
                } else if (!author) {
                    // Fallback for missing characters or weird data
                    author = {
                        handle: video.authorName || 'unknown',
                        persona: '未知用户',
                        avatar: video.authorAvatar || null
                    };
                }
            }
        }

        return { video, author, isUser };
    };

    // Global variable for sharing
    window.currentShareVideoId = null;

    // Attach fsShareBtn once globally
    setTimeout(() => {
        const fsAvatarBtn = document.querySelector('#tk-fullscreen-video-view .tk-avatar-action');
        if (fsAvatarBtn && !fsAvatarBtn.dataset.bound) {
            fsAvatarBtn.dataset.bound = "true";
            fsAvatarBtn.addEventListener('click', (e) => {
                const vid = document.getElementById('tk-fullscreen-video-view').dataset.videoId;
                if (vid) {
                    const { video } = window.findVideoGlobal(vid);
                    if (video && window.tkHandleProfileClick) {
                        window.tkHandleProfileClick(video.authorId, e);
                    }
                }
            });
        }

        const fsShareBtn = document.getElementById('tk-fs-video-share-btn');
        if (fsShareBtn && !fsShareBtn.dataset.bound) {
            fsShareBtn.dataset.bound = "true";
            fsShareBtn.addEventListener('click', (e) => {
                const vid = document.getElementById('tk-fullscreen-video-view').dataset.videoId;
                if (window.tkOpenShare && vid) window.tkOpenShare(vid, e);
            });
        }

        // Connect Comments button inside custom video player once globally
        const fsCommentBtn = document.getElementById('tk-fs-video-comment-btn');
        if (fsCommentBtn && !fsCommentBtn.dataset.bound) {
            fsCommentBtn.dataset.bound = "true";
            fsCommentBtn.addEventListener('click', (e) => {
                const vid = document.getElementById('tk-fullscreen-video-view').dataset.videoId;
                if (window.tkOpenComments && vid) {
                    // Update tkState.videos if it's a user post before opening
                    const { video, isUser } = window.findVideoGlobal(vid);
                    if (video && isUser) {
                        const existing = tkState.videos.find(v => v.id === video.id);
                        if (!existing) {
                            tkState.videos.push({
                                id: video.id,
                                comments: video.comments || [],
                                commentsCount: tkCountVideoComments(video)
                            });
                        } else {
                            existing.comments = video.comments;
                            existing.commentsCount = tkCountVideoComments(video);
                        }
                    }
                    window.tkOpenComments(vid, e);
                }
            });
        }

        // Connect Like button inside custom video player once globally
        const fsLikeBtn = document.getElementById('tk-fs-video-like-btn');
        if (fsLikeBtn && !fsLikeBtn.dataset.bound) {
            fsLikeBtn.dataset.bound = "true";
            fsLikeBtn.addEventListener('click', (e) => {
                const vid = document.getElementById('tk-fullscreen-video-view').dataset.videoId;
                if (window.tkHandleLike && vid) {
                    window.tkHandleLike(vid, fsLikeBtn, e);
                }
            });
        }
    }, 500);

    // Handle share actions via global function
    window.tkHandleShareAction = function(action) {
        const sheetOverlay = document.getElementById('tk-share-sheet');
        window.closeView(sheetOverlay);
        
        if (!window.currentShareVideoId) return;
        const { video } = window.findVideoGlobal(window.currentShareVideoId);
        if (!video) return;

        if (action === 'save') {
            video.isSaved = !video.isSaved;
            if (window.tkPersistState) window.tkPersistState();
            window.showToast(video.isSaved ? '已收藏' : '已取消收藏');
        } else if (action === 'edit') {
            currentEditingVideoId = window.currentShareVideoId;
            const bgImgEl = document.getElementById('tk-edit-video-bg-img');
            if (bgImgEl) {
                // 回显背景，包括用户发布时使用的 cover
                const editBg = video.bgImage || video.cover;
                if (editBg) {
                    bgImgEl.src = editBg;
                    bgImgEl.style.display = 'block';
                } else {
                    bgImgEl.src = '';
                    bgImgEl.style.display = 'none';
                }
            }
            const descInput = document.getElementById('tk-edit-video-desc-input');
            if(descInput) descInput.value = video.desc || '';
            
            const sceneInput = document.getElementById('tk-edit-video-scene-input');
            if(sceneInput) sceneInput.value = video.sceneText || '';
            
            window.openView(document.getElementById('tk-edit-single-video-sheet'));
        } else if (action === 'delete') {
            if (confirm('确定要彻底删除这个视频吗？')) {
                const vId = window.currentShareVideoId;
                tkState.videos = tkState.videos.filter(v => v.id !== vId);
                if (tkState.profile && tkState.profile.posts) {
                    tkState.profile.posts = tkState.profile.posts.filter(v => v.id !== vId);
                }
                tkState.chars.forEach(c => {
                    if (c.likedVideoIds) {
                        c.likedVideoIds = c.likedVideoIds.filter(id => id !== vId);
                    }
                });
                if (window.tkPersistState) window.tkPersistState();
                window.tkRenderHome();
                if (window.tkRenderProfile) window.tkRenderProfile();
                
                const fsView = document.getElementById('tk-fullscreen-video-view');
                if (fsView && fsView.classList.contains('active') && fsView.dataset.videoId === vId) {
                    fsView.classList.remove('active');
                }
                window.showToast('已删除');
            }
        }
    };

    window.tkOpenFullscreenVideo = function(videoId) {
        let { video, author, isUser } = window.findVideoGlobal(videoId);
        
        if (!video) {
            console.error("tkOpenFullscreenVideo: Video not found for id", videoId);
            if (window.showToast) window.showToast('无法加载该视频');
            return;
        }
        
        if (!author) {
            author = { handle: 'unknown', avatar: null };
        }
        
        if (!fsView) {
            console.error("tkOpenFullscreenVideo: fsView not found");
            if (window.showToast) window.showToast('错误: 全屏视频容器未加载');
            return;
        }

        try {
            const coverEl = document.getElementById('tk-fs-video-cover');
            const fsVideoContainer = document.getElementById('tk-fs-video-container');
            
            if (fsVideoContainer) {
                fsVideoContainer.querySelectorAll('.tk-fs-video-progress').forEach(el => el.remove());
                const progressHtml = tkCreateFeedProgressHtml(video).trim();
                if (progressHtml) {
                    const progressWrap = document.createElement('div');
                    progressWrap.innerHTML = progressHtml;
                    const progressEl = progressWrap.firstElementChild;
                    if (progressEl) {
                        progressEl.classList.add('tk-fs-video-progress');
                        fsVideoContainer.appendChild(progressEl);
                    }
                }

                let textBubble = document.getElementById('tk-fs-video-text-bubble');
                if (!textBubble) {
                    textBubble = document.createElement('div');
                    textBubble.id = 'tk-fs-video-text-bubble';
                    textBubble.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 2; width: 100%; display: flex; justify-content: center; align-items: center;';
                    fsVideoContainer.insertBefore(textBubble, fsVideoContainer.firstChild); // 放在容器里，垫在控件下面
                }

                if (coverEl) {
                    coverEl.style.objectFit = 'contain';
                    coverEl.style.boxShadow = 'none';
                }

                const visualUrl = video.cover || video.bgImage || video.imageUrl || '';
                if (coverEl) {
                    if (visualUrl) {
                        coverEl.src = visualUrl;
                        coverEl.style.display = 'block';
                    } else {
                        coverEl.src = '';
                        coverEl.style.display = 'none';
                    }
                }

                // Keep scene bubbles visible over both generated covers and plain-color videos.
                fsVideoContainer.style.background = '#ffffff';
                const fsBubbleFlowHtml = tkCreateBubbleFlowHtml(video, {
                    background: visualUrl ? 'rgba(17,17,17,0.82)' : (video.bgColor ? '#111111' : '#111111')
                });
                if (fsBubbleFlowHtml) {
                    textBubble.innerHTML = fsBubbleFlowHtml;
                    textBubble.style.display = 'flex';
                    textBubble.style.justifyContent = 'center';
                    textBubble.style.alignItems = 'center';
                    textBubble.style.width = '100%';
                    textBubble.style.height = '100%';
                } else {
                    textBubble.innerHTML = '';
                    textBubble.style.display = 'none';
                }
            }
            
            const descText = video.desc ? video.desc : tkGetSceneText(video);
            const descEl = document.getElementById('tk-fs-video-desc');
            if (descEl) {
                descEl.textContent = descText;
                descEl.style.color = '#111111'; // Set to black
            }
            
            const authorEl = document.getElementById('tk-fs-video-author');
            if (authorEl) {
                authorEl.textContent = '@' + (author.handle || author.id || 'user');
                authorEl.style.color = '#111111'; // Set to black
            }
            
            const avatarEl = document.getElementById('tk-fs-video-avatar');
            const iconEl = document.getElementById('tk-fs-video-avatar-icon');
            const resolvedFsAvatar = window.tkResolveAvatar(video.authorId, author.name || author.handle || video.authorName, author.avatar || video.authorAvatar);
            if (resolvedFsAvatar) {
                if (avatarEl) { avatarEl.src = resolvedFsAvatar; avatarEl.style.display = 'block'; }
                if (iconEl) iconEl.style.display = 'none';
            } else {
                if (avatarEl) avatarEl.style.display = 'none';
                if (iconEl) iconEl.style.display = 'block';
            }

            const likesEl = document.getElementById('tk-fs-video-likes');
            if (likesEl) likesEl.textContent = window.tkFormatCount(video.likes || 0);
            
            // Update icons color to black in JS just in case CSS misses it
            const fsRightActions = document.querySelectorAll('#tk-fullscreen-video-view .tk-action-item i, #tk-fullscreen-video-view .tk-action-item span');
            fsRightActions.forEach(el => {
                if(el.tagName === 'SPAN' || !el.parentElement.classList.contains('liked')) {
                    el.style.color = '#111111';
                    el.style.textShadow = 'none';
                }
            });

            // Set initial like state
            const fsLikeBtn = document.getElementById('tk-fs-video-like-btn');
            if (fsLikeBtn) {
                if (video.isLiked) {
                    fsLikeBtn.classList.add('liked');
                    const i = fsLikeBtn.querySelector('i');
                    if(i) i.style.color = '#ff4b4b'; // Keep red for liked
                } else {
                    fsLikeBtn.classList.remove('liked');
                    const i = fsLikeBtn.querySelector('i');
                    if(i) i.style.color = '#111111';
                }
            }
            
            const commentsEl = document.getElementById('tk-fs-video-comments');
            if (commentsEl) commentsEl.textContent = window.tkFormatCount(tkCountVideoComments(video) || video.commentsCount || 0);

            fsView.dataset.videoId = videoId;
            fsView.classList.add('active');
            
        } catch(e) {
            console.error("tkOpenFullscreenVideo DOM报错:", e);
            if(window.showToast) window.showToast('打开视频失败: ' + e.message);
        }
    };

    if (magicBtn) {
        magicBtn.addEventListener('click', async () => {
            const videoId = fsView.dataset.videoId;
            const { video, author, isUser } = window.findVideoGlobal(videoId);
            if (!video) return;

            if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
                window.showToast('请在系统设置中配置 API');
                return;
            }

            window.showToast('AI 正在生成互动数据...');

            let followedCharsContext = '';
            if (isUser && tkState && tkState.chars) {
                const friends = tkState.chars.filter(c => c.isFollowed).slice(0, 3);
                if (friends.length > 0) {
                    followedCharsContext = "\n博主(User)有以下几个已关注的好友（你可以安排他们中的1-2个来评论）：\n" + 
                        friends.map(c => `- CharID: ${c.id}, 名字: ${c.name}, 人设: ${c.persona}`).join('\n') +
                        "\n如果使用了好友的评论，请把他们的 CharID 填在 authorId 字段中，名字填在 authorName 字段。";
                }
            }

            const wbContext = window.tkBuildWorldBookContext
                ? window.tkBuildWorldBookContext(`${video.desc || ''}\n${video.scene || ''}\n${video.sceneText || ''}\n${author.persona || ''}`)
                : '';

            const prompt = `
你现在是一个 TikTok 互动模拟器。
用户（也就是发视频的博主）的人设是：${author.persona || '普通人'}
刚发布的视频内容或背景描述是：${video.scene || video.desc || video.sceneText || '一段有趣的日常视频'}
${followedCharsContext}
${wbContext}

请为这个视频生成一些观众的互动数据。评论要具有活人感、网感，如果是朋友的评论要符合朋友的人设语气。
重要：评论中可以带上艾特好友（@好友名字）或路人，增加互动真实感。艾特别人时，有几率触发被艾特的人在 \`replies\` 数组中进行楼中楼回复。
国际化翻译规则：评论或 replies 的 text 如果不是中文，必须同时填写 translationZh，内容是自然中文翻译；如果 text 是中文，translationZh 必须是空字符串。
要求返回严格的 JSON 格式（不要有多余文字或 markdown），格式如下：
{
  "newLikes": 850,
  "newComments": [
    { 
      "authorId": "可能的话填入好友的CharID，否则留空", 
      "authorName": "观众A或好友名字", 
      "authorAvatar": "可以留空由系统自动生成", 
      "text": "太有趣了吧！ @某某",
      "translationZh": "",
      "replies": [
         { "authorName": "某某", "authorAvatar": "", "text": "哈哈哈确实！", "translationZh": "", "likes": 5 }
      ]
    }
  ]
}
`;

            try {
                const endpoint = window.u2Api.resolveChatCompletionsEndpoint(window.apiConfig.endpoint);

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${window.apiConfig.apiKey}`
                    },
                    body: JSON.stringify({
                        model: window.apiConfig.model || 'gpt-3.5-turbo',
                        messages: [
                            { role: 'system', content: 'You are a JSON generator.' },
                            { role: 'user', content: prompt }
                        ],
                        temperature: parseFloat(window.apiConfig.temperature) || 0.8
                    })
                });

                if (!response.ok) throw new Error('API Error');
                
                const data = await response.json();
                let aiReply = data.choices[0].message.content;
                const parsed = tkParseAiJson(aiReply);
                
                video.likes = (video.likes || 0) + (parsed.newLikes || Math.floor(Math.random()*500));
                
                if (!video.comments) video.comments = [];
                if (parsed.newComments && Array.isArray(parsed.newComments)) {
                    parsed.newComments
                        .map((comment, commentIndex) => tkNormalizeGeneratedComment(comment, commentIndex))
                        .filter(comment => comment.text)
                        .forEach(comment => video.comments.unshift(comment));
                }
                video.commentsCount = tkCountVideoComments(video);
                
                if (window.tkPersistState) window.tkPersistState();
                
                // Refresh UI
                document.getElementById('tk-fs-video-likes').textContent = window.tkFormatCount(video.likes);
                document.getElementById('tk-fs-video-comments').textContent = window.tkFormatCount(video.commentsCount || tkCountVideoComments(video));
                window.showToast('互动数据生成完毕！');

                // If on main profile grid, re-render
                if (window.tkRenderProfile) window.tkRenderProfile();

            } catch (err) {
                console.error(err);
                window.showToast('生成互动失败，请检查 API');
            }
        });
    }

    if (magicBtn && magicBtn.parentNode) {
        const cleanMagicBtn = magicBtn.cloneNode(true);
        magicBtn.parentNode.replaceChild(cleanMagicBtn, magicBtn);
        cleanMagicBtn.title = '生成互动';
        cleanMagicBtn.addEventListener('click', () => {
            const videoId = fsView ? fsView.dataset.videoId : '';
            if (videoId && window.tkGenerateVideoInteractions) {
                window.tkGenerateVideoInteractions(videoId);
            }
        });
    }

    // Global Handlers for DOM inline events
    window.tkHandleProfileClick = function(authorId, e) {
        e.stopPropagation();
        const char = window.tkGetChar(authorId);
        if (char) {
            if (window.tkOpenSubProfile) {
                window.tkOpenSubProfile(authorId);
            }
        } else {
            // Auto create basic char if not exists so we can view profile
            const video = tkState.videos.find(v => v.authorId === authorId);
            if (video) {
                window.tkSaveChar({
                    id: authorId,
                    name: video.authorName,
                    handle: authorId,
                    avatar: video.authorAvatar || null,
                    status: '',
                    persona: '谢谢你的关注',
                    isFollowed: false
                });
                if (window.tkOpenSubProfile) {
                    window.tkOpenSubProfile(authorId);
                }
            }
        }
    };

    window.tkHandleFollow = function(authorId, e) {
        e.stopPropagation();
        const char = window.tkGetChar(authorId);
        if (char && !char.isFollowed) {
            char.isFollowed = true;
            if (window.tkPersistState) window.tkPersistState();
            window.tkRenderHome();
            if (window.tkRenderChat) window.tkRenderChat(); // Update following bar
            window.showToast('已关注');
        } else if (!char) {
            // Auto create char if not exists
            const video = tkState.videos.find(v => v.authorId === authorId);
            if (video) {
                window.tkSaveChar({
                    id: authorId,
                    name: video.authorName,
                    handle: authorId,
                    avatar: video.authorAvatar || null,
                    status: '刚刚发布了视频',
                    persona: '谢谢你的关注',
                    isFollowed: true
                });
                window.tkRenderHome();
                if (window.tkRenderChat) window.tkRenderChat();
                window.showToast('已关注');
            }
        }
    };

    window.tkHandleLike = function(videoId, el, e) {
        if (e) e.stopPropagation();
        const found = window.findVideoGlobal ? window.findVideoGlobal(videoId) : {};
        const video = found.video || tkState.videos.find(v => v.id === videoId);
        if (video) {
            video.likes = Number(video.likes) || 0;
            video.isLiked = !video.isLiked;
            video.likes = Math.max(0, video.likes + (video.isLiked ? 1 : -1));
            if (window.tkPersistState) window.tkPersistState();
            
            if (video.isLiked) {
                el.classList.add('liked');
            } else {
                el.classList.remove('liked');
            }
            const countEl = el.querySelector('span');
            if (countEl) countEl.textContent = window.tkFormatCount(video.likes);
            const fsLikesEl = document.getElementById('tk-fs-video-likes');
            const fsViewEl = document.getElementById('tk-fullscreen-video-view');
            if (fsLikesEl && fsViewEl && fsViewEl.dataset.videoId === videoId) {
                fsLikesEl.textContent = window.tkFormatCount(video.likes);
            }
            if (window.tkRenderProfile) window.tkRenderProfile();
            if (window.tkRenderHome) window.tkRenderHome();
        }
    };

    function tkResolveCommentAuthorForVideo(entry = {}, video = {}) {
        const rawId = String(entry.authorId || entry.id || '').trim();
        const rawName = String(entry.authorName || entry.name || '').trim();
        const normalize = value => String(value || '').trim().replace(/^@/, '').toLowerCase();
        const videoAuthorId = String(video.authorId || '').trim();
        const videoAuthorName = String(video.authorName || '').trim();
        const matchesVideoAuthor = videoAuthorId && (
            String(rawId) === videoAuthorId
            || (rawName && normalize(rawName) === normalize(videoAuthorName))
        );

        if (matchesVideoAuthor) {
            const char = window.tkGetChar ? window.tkGetChar(videoAuthorId) : null;
            const authorName = char?.name || videoAuthorName || rawName || 'User';
            const authorAvatar = window.tkResolveAvatar
                ? window.tkResolveAvatar(videoAuthorId, authorName, char?.avatar || video.authorAvatar || entry.authorAvatar || '')
                : (char?.avatar || video.authorAvatar || entry.authorAvatar || '');
            return { authorId: videoAuthorId, authorName, authorAvatar };
        }

        const linkedChar = (tkState.chars || []).find(char => {
            if (!char) return false;
            return (rawId && String(char.id) === rawId)
                || (rawId && String(char.imCharId || '') === rawId)
                || (rawName && normalize(char.name) === normalize(rawName))
                || (rawName && normalize(char.handle) === normalize(rawName));
        });

        if (linkedChar) {
            const authorName = linkedChar.name || linkedChar.handle || rawName || 'User';
            const authorAvatar = window.tkResolveAvatar
                ? window.tkResolveAvatar(linkedChar.id, authorName, linkedChar.avatar || entry.authorAvatar || '')
                : (linkedChar.avatar || entry.authorAvatar || '');
            return { authorId: linkedChar.id, authorName, authorAvatar };
        }

        const fallbackId = rawId || `commenter_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const fallbackName = rawName || 'User';
        return {
            authorId: fallbackId,
            authorName: fallbackName,
            authorAvatar: window.tkResolveAvatar
                ? window.tkResolveAvatar(fallbackId, fallbackName, entry.authorAvatar || '')
                : (entry.authorAvatar || '')
        };
    }

    let currentCommentVideoId = null;
    let currentReplyToCommentId = null; // Store parent comment ID if replying

    function renderCommentsList(video) {
        const list = document.getElementById('tk-comments-list');
        const title = document.getElementById('tk-comments-title');
        if (!list || !title) return;

        let totalComments = video.comments ? video.comments.length : 0;
        // Also count replies roughly
        if (video.comments) {
            video.comments.forEach(c => {
                if(c.replies) totalComments += c.replies.length;
            });
        }

        title.textContent = `Comments (${window.tkFormatCount(totalComments)})`;
        list.innerHTML = '';

        if (video.comments && video.comments.length > 0) {
            video.comments.forEach((c, index) => {
                // Ensure ID exists
                if(!c.id) c.id = 'cmt_' + Date.now() + '_' + index;
                const commentIdentity = tkResolveCommentAuthorForVideo(c, video);
                c.authorId = commentIdentity.authorId;
                c.authorName = commentIdentity.authorName;
                c.authorAvatar = commentIdentity.authorAvatar;
                const authorId = commentIdentity.authorId;
                const authorName = commentIdentity.authorName;
                const authorAvatar = commentIdentity.authorAvatar;
                const commentTranslationId = `tk-comment-translation-${c.id}`;
                const commentTranslateButton = tkCleanTranslation(c.translationZh)
                    ? `<span class="tk-comment-translate-btn" data-translation-target="${tkEscapeAttr(commentTranslationId)}">Translate</span>`
                    : '';
                const avatarHtml = authorAvatar 
                    ? `<img src="${tkEscapeAttr(authorAvatar)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` 
                    : `<i class="fas fa-user"></i>`;
                
                const item = document.createElement('div');
                item.className = 'tk-comment-item';
                item.innerHTML = `
                    <div class="tk-avatar-small tk-comment-profile-link" data-author-id="${tkEscapeAttr(authorId)}" data-author-name="${tkEscapeAttr(authorName)}" data-author-avatar="${tkEscapeAttr(authorAvatar)}" style="cursor:pointer;">${avatarHtml}</div>
                    <div class="tk-comment-content" style="cursor:pointer;">
                        <div class="tk-comment-name tk-comment-profile-link" data-author-id="${tkEscapeAttr(authorId)}" data-author-name="${tkEscapeAttr(authorName)}" data-author-avatar="${tkEscapeAttr(authorAvatar)}" style="cursor:pointer;">${tkEscapeHtml(authorName)}</div>
                        <div class="tk-comment-text" onclick="window.tkReplyToComment('${c.id}', '${c.id}', '${tkEscapeAttr(authorName)}', event)">${renderCommentText(c.text)}</div>
                        ${tkCommentTranslationHtml(c.translationZh, commentTranslationId)}
                        <div class="tk-comment-meta">
                            <span>1s ago</span>
                            <span onclick="window.tkReplyToComment('${c.id}', '${c.id}', '${tkEscapeAttr(authorName)}', event)">Reply</span>
                            ${commentTranslateButton}
                        </div>
                        
                        <!-- Replies Container -->
                        <div class="tk-comment-replies" id="replies-${c.id}" style="margin-top: 10px; display: none;">
                        </div>
                        
                        ${c.replies && c.replies.length > 0 ? `
                        <div class="tk-comment-expand" onclick="window.tkToggleReplies('${c.id}', event)" style="font-size: 12px; color: #888; margin-top: 8px; font-weight: 500;">
                            <span id="expand-text-${c.id}">View ${window.tkFormatCount(c.replies.length)} replies <i class="fas fa-chevron-down" style="font-size:10px;"></i></span>
                        </div>
                        ` : ''}
                    </div>
                    <div class="tk-comment-like ${c.isLiked ? 'liked' : ''}" onclick="window.tkToggleCommentLike('${video.id}', '${c.id}', this, event)">
                        <i class="fas fa-heart"></i>
                        <span>${window.tkFormatCount(c.likes || 0)}</span>
                    </div>
                `;
                list.appendChild(item);
                item.querySelectorAll('.tk-comment-profile-link').forEach(link => {
                    link.addEventListener('click', (event) => {
                        window.tkOpenCommentAuthorProfile(
                            link.dataset.authorId,
                            link.dataset.authorName,
                            link.dataset.authorAvatar,
                            event
                        );
                    });
                });
                item.querySelectorAll('.tk-comment-translate-btn').forEach(button => {
                    button.addEventListener('click', window.tkToggleCommentTranslation);
                });

                // Render replies if they exist
                if (c.replies && c.replies.length > 0) {
                    const repliesContainer = item.querySelector(`#replies-${c.id}`);
                    c.replies.forEach((reply, replyIndex) => {
                        if (!reply.id) reply.id = `reply_${c.id}_${replyIndex}_${Date.now()}`;
                        const rItem = document.createElement('div');
                        rItem.style.display = 'flex';
                        rItem.style.gap = '10px';
                        rItem.style.marginBottom = '12px';
                        
                        const replyIdentity = tkResolveCommentAuthorForVideo(reply, video);
                        reply.authorId = replyIdentity.authorId;
                        reply.authorName = replyIdentity.authorName;
                        reply.authorAvatar = replyIdentity.authorAvatar;
                        const rName = replyIdentity.authorName || 'User';
                        const rAvatarUrl = replyIdentity.authorAvatar;
                        const rAvatarHtml = rAvatarUrl 
                            ? `<img src="${tkEscapeAttr(rAvatarUrl)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` 
                            : `<i class="fas fa-user"></i>`;
                        const rText = reply.text || '';
                        const replyTranslationId = `tk-reply-translation-${reply.id}`;
                        const replyTranslateButton = tkCleanTranslation(reply.translationZh)
                            ? `<span class="tk-comment-translate-btn" data-translation-target="${tkEscapeAttr(replyTranslationId)}">Translate</span>`
                            : '';
                        
                        rItem.innerHTML = `
                            <div class="tk-avatar-small" style="width: 24px; height: 24px; font-size: 12px;">${rAvatarHtml}</div>
                            <div style="flex:1;">
                                <div style="font-size:12px; color:#888; font-weight:500; margin-bottom:2px; cursor:pointer;" class="tk-reply-profile-link" data-author-name="${tkEscapeAttr(rName)}">${tkEscapeHtml(rName)}</div>
                                <div style="font-size:13px; color:#111; line-height:1.4; cursor:pointer;" onclick="window.tkReplyToComment('${c.id}', '${reply.id}', '${tkEscapeAttr(rName)}', event)">${renderCommentText(rText)}</div>
                                ${tkCommentTranslationHtml(reply.translationZh, replyTranslationId)}
                                <div class="tk-comment-meta tk-reply-meta">
                                    <span>1s ago</span>
                                    <span onclick="window.tkReplyToComment('${c.id}', '${reply.id}', '${tkEscapeAttr(rName)}', event)" style="cursor:pointer;">Reply</span>
                                    ${replyTranslateButton}
                                </div>
                            </div>
                        `;
                        
                        const profileLink = rItem.querySelector('.tk-reply-profile-link');
                        if (profileLink) {
                            profileLink.addEventListener('click', (event) => {
                                window.tkOpenCommentAuthorProfile(reply.authorId, rName, rAvatarUrl, event);
                            });
                        }
                        rItem.querySelectorAll('.tk-comment-translate-btn').forEach(button => {
                            button.addEventListener('click', window.tkToggleCommentTranslation);
                        });
                        repliesContainer.appendChild(rItem);
                    });
                }
            });
        } else {
            list.innerHTML = '<div style="text-align:center; padding: 40px; color: #999; font-size: 13px;">Comments will appear here</div>';
        }
    }

    window.tkOpenComments = function(videoId, e) {
        if(e) e.stopPropagation();
        currentCommentVideoId = videoId;
        currentReplyToCommentId = null; // reset
        window.currentReplyTargetId = null;
        
        const foundVideo = window.findVideoGlobal ? window.findVideoGlobal(videoId) : {};
        const video = foundVideo.video || tkState.videos.find(v => v.id === videoId);
        if (!video) return;

        const sheetOverlay = document.getElementById('tk-video-detail-sheet');
        if (!sheetOverlay) return;

        // Render list
        renderCommentsList(video);

        // Reset input
        const inputEl = sheetOverlay.querySelector('#tk-comment-input');
        if (inputEl) {
            inputEl.value = '';
            inputEl.placeholder = 'Add comment...';
        }

        window.openView(sheetOverlay);

        // Setup blanket close once
        if (!sheetOverlay.dataset.boundClose) {
            sheetOverlay.dataset.boundClose = "true";
            sheetOverlay.addEventListener('click', (e) => {
                if (e.target === sheetOverlay) {
                    window.closeView(sheetOverlay);
                    currentCommentVideoId = null;
                }
            });
        }

        const sendBtn = sheetOverlay.querySelector('#tk-comment-send-btn');
        const newInputEl = sheetOverlay.querySelector('#tk-comment-input');
        
        if (sendBtn && newInputEl) {
            // Unbind old events to prevent duplicate sends by cloning btn or setting a new reference
            const newSendBtn = sendBtn.cloneNode(true);
            sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
            const sendBtnRef = newSendBtn;

            const sendComment = () => {
                const text = newInputEl.value.trim();
                if(!text) return;

                const foundCommentVideo = window.findVideoGlobal ? window.findVideoGlobal(currentCommentVideoId) : {};
                const vid = foundCommentVideo.video || tkState.videos.find(v => v.id === currentCommentVideoId);
                if (!vid) return;

                if (!vid.comments) vid.comments = [];
                let targetThreadComment = null;
                let parentContextComment = null;

                if (currentReplyToCommentId) {
                    // It's a reply
                    const parentCmt = vid.comments.find(c => c.id === currentReplyToCommentId);
                    if (parentCmt) {
                        let actualTarget = parentCmt;
                        if (window.currentReplyTargetId && window.currentReplyTargetId !== currentReplyToCommentId) {
                            if (parentCmt.replies) {
                                actualTarget = parentCmt.replies.find(r => r.id === window.currentReplyTargetId) || parentCmt;
                            }
                        }

                        if (!parentCmt.replies) parentCmt.replies = [];
                        parentCmt.replies.push({
                            id: `reply_${parentCmt.id}_${Date.now()}`,
                            authorName: window.userState ? window.userState.name : 'Profile',
                            authorAvatar: (tkState.profile && tkState.profile.avatar) ? tkState.profile.avatar : null,
                            text: text,
                            likes: 0
                        });
                        targetThreadComment = parentCmt;
                        parentContextComment = actualTarget;
                        // Auto expand parent
                        setTimeout(() => {
                            const repliesContainer = document.getElementById(`replies-${currentReplyToCommentId}`);
                            if(repliesContainer) {
                                repliesContainer.style.display = 'block';
                                const expandText = document.getElementById(`expand-text-${currentReplyToCommentId}`);
                                if (expandText) {
                                    expandText.innerHTML = `Hide <i class="fas fa-chevron-up" style="font-size:10px;"></i>`;
                                }
                            }
                        }, 50);
                    }
                } else {
                    // It's a root comment
                    vid.comments.unshift({
                        id: 'cmt_' + Date.now(),
                        authorName: window.userState ? window.userState.name : 'Profile',
                        authorAvatar: (tkState.profile && tkState.profile.avatar) ? tkState.profile.avatar : null,
                        text: text,
                        likes: 0,
                        replies: []
                    });
                    targetThreadComment = vid.comments[0];
                }
                
                vid.commentsCount = tkCountVideoComments(vid);
                if (window.tkPersistState) window.tkPersistState();
                
                // Re-render
                renderCommentsList(vid);
                window.tkRenderHome(); // update count on home feed

                if (targetThreadComment) {
                    tkGenerateUserCommentAftermath(vid, targetThreadComment, parentContextComment, text);
                }

                newInputEl.value = '';
                newInputEl.placeholder = 'Add comment...';
                currentReplyToCommentId = null; // reset reply target after send
                window.currentReplyTargetId = null;
                window.showToast('评论已发送');
            };

            sendBtnRef.addEventListener('click', sendComment);
            newInputEl.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    sendComment();
                }
            };
        }
    };

    window.tkReplyToComment = function(rootCommentId, targetCommentId, authorName, e) {
        if (typeof targetCommentId === 'string' && authorName && authorName.type) {
            e = authorName;
            authorName = targetCommentId;
            targetCommentId = rootCommentId;
        } else if (!e && authorName && authorName.type) {
            e = authorName;
            authorName = targetCommentId;
            targetCommentId = rootCommentId;
        }

        if(e) e.stopPropagation();
        currentReplyToCommentId = rootCommentId;
        window.currentReplyTargetId = targetCommentId || rootCommentId;
        
        const inputEl = document.getElementById('tk-comment-input');
        if(inputEl) {
            inputEl.placeholder = `Reply @${authorName}`;
            inputEl.value = `@${authorName} `;
            inputEl.focus();
        }
    };

    window.tkToggleCommentLike = function(videoId, commentId, el, e) {
        if(e) e.stopPropagation();
        const foundVideo = window.findVideoGlobal ? window.findVideoGlobal(videoId) : {};
        const video = foundVideo.video || tkState.videos.find(v => v.id === videoId);
        if (!video || !video.comments) return;
        
        const cmt = video.comments.find(c => c.id === commentId);
        if (cmt) {
            cmt.isLiked = !cmt.isLiked;
            cmt.likes = (cmt.likes || 0) + (cmt.isLiked ? 1 : -1);
            if (window.tkPersistState) window.tkPersistState();
            
            if (cmt.isLiked) {
                el.classList.add('liked');
            } else {
                el.classList.remove('liked');
            }
            el.querySelector('span').textContent = window.tkFormatCount(cmt.likes);
        }
    };

    window.tkToggleReplies = function(commentId, e) {
        if(e) e.stopPropagation();
        const container = document.getElementById(`replies-${commentId}`);
        const expandText = document.getElementById(`expand-text-${commentId}`);
        if (!container || !expandText) return;

        if (container.style.display === 'none') {
            container.style.display = 'block';
            expandText.innerHTML = `Hide <i class="fas fa-chevron-up" style="font-size:10px;"></i>`;
        } else {
            container.style.display = 'none';
            // Count replies roughly
            const count = container.children.length;
            expandText.innerHTML = `View ${count} replies <i class="fas fa-chevron-down" style="font-size:10px;"></i>`;
        }
    };

    window.tkToggleCommentTranslation = function(event) {
        if (event) event.stopPropagation();
        const button = event?.currentTarget || event?.target;
        const targetId = button?.dataset?.translationTarget;
        if (!targetId) return;
        const translationEl = document.getElementById(targetId);
        if (!translationEl) return;
        const isHidden = translationEl.style.display === 'none' || !translationEl.style.display;
        translationEl.style.display = isHidden ? 'block' : 'none';
        button.textContent = isHidden ? 'Collapse translation' : 'Translate';
    };
    
    // Share functionality
    window.tkOpenShare = function(videoId, e) {
        if(e) e.stopPropagation();
        window.currentShareVideoId = videoId;
        const shareSheet = document.getElementById('tk-share-sheet');
        const shareList = document.getElementById('tk-share-list');
        if (!shareSheet || !shareList) return;

        // Inject friends into share list
        shareList.innerHTML = '';
        const followedChars = tkState.chars.filter(c => c.isFollowed);
        if (followedChars.length === 0) {
            shareList.innerHTML = '<div style="padding: 10px 15px; color: #999; font-size: 13px;">No friends to forward to</div>';
        } else {
            followedChars.forEach(char => {
                const item = document.createElement('div');
                item.className = 'tk-share-friend-item';
                
                const avatarUrl = window.tkResolveAvatar(char.id, char.name || char.handle, char.avatar);
                const avatarHtml = avatarUrl
                    ? `<img src="${tkEscapeAttr(avatarUrl)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` 
                    : `<i class="fas fa-user"></i>`;
                
                item.innerHTML = `
                    <div class="tk-avatar-small" style="width: 48px; height: 48px;">${avatarHtml}</div>
                    <span style="font-size: 11px; color: #555; text-align: center; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${char.name || char.handle}</span>
                `;
                
                item.addEventListener('click', () => {
                    window.showToast('已转发给 ' + (char.name || char.handle));
                    window.closeView(document.getElementById('tk-share-sheet'));
                    
                    // Add mock message to DM with sharedVideoId
                    let dm = tkState.dms.find(d => d.charId === char.id);
                    if (!dm) {
                        dm = { charId: char.id, messages: [] };
                        tkState.dms.push(dm);
                    }
                    dm.messages.push({
                        sender: 'user',
                        text: '[分享了视频]',
                        sharedVideoId: window.currentShareVideoId
                    });

                    // Update shares count
                    const { video } = window.findVideoGlobal(window.currentShareVideoId);
                    if (video) {
                        video.shares = (video.shares || 0) + 1;
                        // update UI if on home feed
                        const shareCountEl = document.getElementById(`share-count-${video.id}`);
                        if (shareCountEl) {
                            shareCountEl.innerHTML = `已分享`;
                            shareCountEl.style.color = '#ffb300';
                            shareCountEl.previousElementSibling.style.color = '#ffb300';
                        }
                    }

                    if (window.tkPersistState) window.tkPersistState();
                    if (window.tkRenderChat) window.tkRenderChat();
                    
                    // Auto jump to chat
                    const chatTabBtn = document.querySelector('.tk-bottom-nav .tk-nav-item[data-target="tk-chat-tab"]');
                    if (chatTabBtn) chatTabBtn.click();
                    
                    setTimeout(() => {
                        if (window.tkOpenChatView) {
                            window.tkOpenChatView(char.id);
                        }
                    }, 300);
                });
                
                shareList.appendChild(item);
            });
        }
        
        // Setup bottom actions
        const actionsRow = document.querySelector('.tk-share-actions-row');
        if (actionsRow) {
            actionsRow.innerHTML = `
                <div class="tk-share-action-item" onclick="window.tkHandleShareAction('save')">
                    <div class="tk-share-action-icon"><i class="fas fa-bookmark" id="tk-share-save-icon"></i></div>
                    <span>Saved</span>
                </div>
                <div class="tk-share-action-item" onclick="window.tkHandleShareAction('edit')">
                    <div class="tk-share-action-icon"><i class="fas fa-pen"></i></div>
                    <span>Edit post</span>
                </div>
                <div class="tk-share-action-item" onclick="window.tkHandleShareAction('delete')">
                    <div class="tk-share-action-icon" style="color: #ff3b30;"><i class="fas fa-trash-alt"></i></div>
                    <span style="color: #ff3b30;">Delete</span>
                </div>
                <div class="tk-share-action-item" onclick="window.showToast('链接已复制'); window.closeView(document.getElementById('tk-share-sheet'));">
                    <div class="tk-share-action-icon"><i class="fas fa-link"></i></div>
                    <span>Copy link</span>
                </div>
            `;
        }
        
        // Prevent duplicate bindings on share actions by doing it only once
        if (shareSheet && !shareSheet.dataset.boundActions) {
            shareSheet.dataset.boundActions = "true";
            
            // Blanket close
            shareSheet.addEventListener('click', (ev) => {
                if (ev.target === shareSheet) window.closeView(shareSheet);
            });
            
            // Close btn
            const closeBtn = shareSheet.querySelector('#tk-close-share-btn');
            if(closeBtn) {
                closeBtn.addEventListener('click', () => window.closeView(shareSheet));
            }
        }
        
        // Before opening, dynamically color the save button if already saved
        const saveIcon = document.getElementById('tk-share-save-icon');
        if (saveIcon && window.currentShareVideoId) {
            const { video } = window.findVideoGlobal(window.currentShareVideoId);
            if (video && video.isSaved) {
                saveIcon.style.color = '#ffb300';
            } else {
                saveIcon.style.color = '';
            }
        }
        
        window.openView(shareSheet);
    };

    window.tkOpenHashtag = function(tag, e) {
        if(e) e.stopPropagation();
        
        const hashtagView = document.getElementById('tk-hashtag-view');
        const titleEl = document.getElementById('tk-hashtag-title');
        const gridEl = document.getElementById('tk-hashtag-grid');
        
        if (!hashtagView || !titleEl || !gridEl) return;
        
        titleEl.textContent = '#' + tag;
        
        // Filter videos containing this tag
        const tagVideos = tkState.videos.filter(v => v.desc && v.desc.includes('#' + tag));
        
        gridEl.innerHTML = '';
        if (tagVideos.length > 0) {
            tagVideos.forEach(item => {
                const el = document.createElement('div');
                el.className = 'tk-grid-item';
                let bgStyleStr = '#ffffff';
                if (item.bgImage) bgStyleStr = `url('${item.bgImage}') center/cover no-repeat`;
                else if (item.bgColor) bgStyleStr = item.bgColor;
                
                el.innerHTML = `
                    <div class="tk-grid-text" style="position: relative; left: 0; top: 0; transform: none; background: ${bgStyleStr}; color:#111; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding: 8px; width: 100%; height: 100%; box-sizing: border-box; border: none; ">
                        ${tkEscapeHtml(tkGetSceneText(item) ? tkGetSceneText(item).substring(0, 15) + '...' : '视频片段')}
                    </div>
                    <div class="tk-grid-views" style="color: #fff; text-shadow: none;"><i class="fas fa-play"></i> ${window.tkFormatCount(item.likes || Math.floor(Math.random()*1000))}</div>
                `;
                el.addEventListener('click', () => {
                    if (window.tkOpenFullscreenVideo) window.tkOpenFullscreenVideo(item.id);
                });
                gridEl.appendChild(el);
            });
        } else {
            gridEl.innerHTML = '<div style="grid-column: span 3; padding: 40px 0; text-align: center; color: #999; font-size: 13px;">暂无相关视频</div>';
        }
        
        window.openView(hashtagView);

        // Allow blank area click to close (Bind once)
        if (!hashtagView.dataset.boundClose) {
            hashtagView.dataset.boundClose = "true";
            hashtagView.addEventListener('click', (ev) => {
                if (ev.target === hashtagView) window.closeView(hashtagView);
            });
        }
    };

    window.tkOpenMusic = function(e) {
        if(e) e.stopPropagation();
        
        const musicView = document.getElementById('tk-music-view');
        const gridEl = document.getElementById('tk-music-grid');
        
        if (!musicView || !gridEl) return;

        // Randomly pick a few videos to simulate a music feed
        const musicVideos = [...tkState.videos].sort(() => 0.5 - Math.random()).slice(0, 8);
        
        gridEl.innerHTML = '';
        if (musicVideos.length > 0) {
            musicVideos.forEach(item => {
                const el = document.createElement('div');
                el.className = 'tk-grid-item';
                let bgStyleStr = '#ffffff';
                if (item.bgImage) bgStyleStr = `url('${item.bgImage}') center/cover no-repeat`;
                else if (item.bgColor) bgStyleStr = item.bgColor;
                
                el.innerHTML = `
                    <div class="tk-grid-text" style="position: relative; left: 0; top: 0; transform: none; background: ${bgStyleStr}; color:#111; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding: 8px; width: 100%; height: 100%; box-sizing: border-box; border: none; ">
                        ${tkEscapeHtml(tkGetSceneText(item) ? tkGetSceneText(item).substring(0, 15) + '...' : '视频片段')}
                    </div>
                    <div class="tk-grid-views" style="color: #fff; text-shadow: none;"><i class="fas fa-play"></i> ${window.tkFormatCount(item.likes || Math.floor(Math.random()*1000))}</div>
                `;
                el.addEventListener('click', () => {
                    if (window.tkOpenFullscreenVideo) window.tkOpenFullscreenVideo(item.id);
                });
                gridEl.appendChild(el);
            });
        } else {
            gridEl.innerHTML = '<div style="grid-column: span 3; padding: 40px 0; text-align: center; color: #999; font-size: 13px;">暂无相关视频</div>';
        }
        
        window.openView(musicView);

        // Allow blank area click to close (Bind once)
        if (!musicView.dataset.boundClose) {
            musicView.dataset.boundClose = "true";
            musicView.addEventListener('click', (ev) => {
                if (ev.target === musicView) window.closeView(musicView);
            });
        }
    };

    window.tkOpenCommentAuthorProfile = function(authorId, authorName, avatar, e) {
        if (e) e.stopPropagation();
        const safeId = authorId || `commenter_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const safeName = authorName || 'User';

        window.closeView(document.getElementById('tk-video-detail-sheet'));

        let char = window.tkGetChar(safeId);
        if (!char) {
            window.tkSaveChar({
                id: safeId,
                name: safeName,
                handle: safeId,
                avatar: avatar || null,
                persona: `${safeName} 是从 TikTok 评论区进入主页的用户。`,
                bio: '来自评论区',
                following: 0,
                followers: Math.floor(Math.random() * 5000),
                likes: Math.floor(Math.random() * 20000),
                isFollowed: false
            });
            char = window.tkGetChar(safeId);
        } else if (avatar && !char.avatar) {
            char.avatar = avatar;
            if (window.tkPersistState) window.tkPersistState();
        }

        if (window.tkOpenSubProfile) window.tkOpenSubProfile(safeId);
    };

    function tkEnsureSearchGenerateSheet() {
        let sheet = document.getElementById('tk-search-generate-sheet');
        if (sheet) return sheet;

        sheet = document.createElement('div');
        sheet.className = 'bottom-sheet-overlay detail-sheet-overlay';
        sheet.id = 'tk-search-generate-sheet';
        sheet.innerHTML = `
            <div class="bottom-sheet tk-search-generate-sheet">
                <div class="sheet-handle"></div>
                <div class="sheet-title">搜索生成视频</div>
                <div class="detail-sheet-content tk-search-generate-content">
                    <div class="tk-search-generate-box">
                        <i class="fas fa-search"></i>
                        <input id="tk-search-generate-input" type="text" placeholder="想看什么？留空随机生成">
                    </div>
                    <label class="tk-search-generate-count" for="tk-search-generate-count-input">
                        <span>生成数量</span>
                        <input id="tk-search-generate-count-input" type="number" min="1" max="10" step="1" value="3" inputmode="numeric" aria-label="生成视频数量">
                    </label>
                    <div class="sheet-action confirm-action" id="tk-search-generate-confirm">生成</div>
                    <div class="sheet-action" id="tk-search-generate-cancel">取消</div>
                </div>
            </div>
        `;
        document.getElementById('tiktok-view')?.appendChild(sheet);

        sheet.addEventListener('click', (event) => {
            if (event.target === sheet) window.closeView(sheet);
        });
        sheet.querySelector('#tk-search-generate-cancel')?.addEventListener('click', () => window.closeView(sheet));
        sheet.querySelector('#tk-search-generate-confirm')?.addEventListener('click', () => {
            const query = sheet.querySelector('#tk-search-generate-input')?.value.trim() || '';
            const countInput = sheet.querySelector('#tk-search-generate-count-input');
            const count = Math.min(10, Math.max(1, Number.parseInt(countInput?.value, 10) || 3));
            if (countInput) countInput.value = String(count);
            window.closeView(sheet);
            window.tkGenerateSearchVideos(query, count);
        });
        sheet.querySelectorAll('#tk-search-generate-input, #tk-search-generate-count-input').forEach(input => input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                sheet.querySelector('#tk-search-generate-confirm')?.click();
            }
        }));

        return sheet;
    }

    window.tkOpenSearchGenerateSheet = function(e) {
        if (e) e.stopPropagation();
        const sheet = tkEnsureSearchGenerateSheet();
        const input = sheet.querySelector('#tk-search-generate-input');
        const countInput = sheet.querySelector('#tk-search-generate-count-input');
        if (input) input.value = '';
        if (countInput) countInput.value = '3';
        window.openView(sheet);
        setTimeout(() => input?.focus(), 80);
    };

    window.tkTriggerApiGenerate = function(e) {
        window.tkOpenSearchGenerateSheet(e);
    };

    if (apiGenBtn) {
        apiGenBtn.addEventListener('click', window.tkOpenSearchGenerateSheet);
    }

    window.tkGenerateSearchVideos = async function(query = '', requestedCount = 3) {
        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
            window.showToast('请在系统设置中配置 API');
            return;
        }

        const topic = String(query || '').trim();
        const targetCount = Math.min(10, Math.max(1, Number.parseInt(requestedCount, 10) || 3));
        const contextText = topic || '随机 TikTok 视频流';
        const wbContext = window.tkBuildWorldBookContext ? window.tkBuildWorldBookContext(contextText) : '';
        const userPersonaContext = window.tkBuildWorldActorPrompt
            ? window.tkBuildWorldActorPrompt({
                includeUserIdentity: false,
                purpose: 'TikTok For You 主页内容流',
                triggerText: topic || contextText
            })
            : '';

        const prompt = `
你是 TikTok For You 内容流 JSON 生成器。根据用户想看的主题、世界书和 user 人设关键词触发信息，一次生成恰好 ${targetCount} 条完整 TikTok 内容，内容可以是短视频，也可以是图片帖。
你可以是这个世界观里的任何非 user 创作者/路人/账号；只有主题确实需要时才提到 user，且永远不能扮演 user。

用户主题：${topic || '留空，随机生成但要具体、有生活感'}

硬性要求：
1. 返回严格 JSON 数组，数组长度必须恰好为 ${targetCount}，不要 markdown，不要解释文字。
2. 每条内容必须有 mediaType，值只能是 "video" 或 "image"；video 像真实短视频，image 像真实图片帖/随手拍/截图梗图。
3. 每条内容必须有 opening、middle、ending 三段；每段不少于 40 个字符，建议 40-80 字，分别呈现开头、中间、结尾，适合在画面中央逐条气泡显示。原文可以使用符合作者国籍、世界观和内容语境的任意语言。
4. image 内容必须额外提供 imagePrompt，描述图片主体、构图、光线、质感；可选 bgImage、cover 或 imageUrl，如果没有真实 URL 就留空。
5. 每条内容必须有不少于 10 条 comments。每条评论必须有 authorName、authorAvatar、text、likes、replies。
6. replies 必须保留为数组；每条视频的 replies 楼中楼回复总数不少于 10 条，可以分布在多条评论下；每条回复带 authorName、authorAvatar、text、likes。
7. desc 要像真实 TikTok 文案，可带 0-3 个 tag。内容要有网感、活人感、镜头感，不要像新闻稿。
8. 作者和评论头像可使用 https://picsum.photos/150/150?random=数字 或 https://api.dicebear.com/7.x/avataaars/svg?seed=名字。
9. 国际化翻译规则：opening/middle/ending 如果不是中文，必须分别填写 openingTranslationZh/middleTranslationZh/endingTranslationZh；评论或 replies 的 text 如果不是中文，必须填写 translationZh；如果原文是中文，对应翻译字段必须是空字符串。
10. 禁止扮演user的身份发抖音和评论，你只能是除了user以外的人。

JSON 示例：
[
  {
    "mediaType": "image",
    "authorName": "用户昵称",
    "handle": "user_id",
    "authorAvatar": "https://picsum.photos/150/150?random=101",
    "desc": "刚刚发生的瞬间 #日常 #随手拍",
    "imagePrompt": "整栋楼只剩这一层还亮着灯，窗外的车都走了，做完这组数据再走",
    "opening": "开头不少于40字，写环境、第一眼看到的动作和氛围，要像画面中央的长气泡文字。",
    "openingTranslationZh": "",
    "middle": "中间不少于40字，写人物反应、冲突或一句很真实的话，保持第三人称和镜头感。",
    "middleTranslationZh": "",
    "ending": "结尾不少于40字，写收束、反转、余味或下一秒发生什么，不要短于40字。",
    "endingTranslationZh": "",
    "likes": 1234,
    "shares": 12,
    "comments": [
      {
        "authorName": "评论者A",
        "authorAvatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=a",
        "text": "评论内容",
        "translationZh": "",
        "likes": 12,
        "replies": [
          {
            "authorName": "回复者B",
            "authorAvatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=b",
            "text": "楼中楼回复",
            "translationZh": "",
            "likes": 3
          }
        ]
      }
    ]
  }
]

最终输出前请自检：
- 顶层只能是 JSON 数组，或对象 { "content": [...] }。
- 所有属性名必须是英文双引号。
- 每条内容至少 10 条 comments，且 replies 总数至少 10 条。
- opening、middle、ending 每个字段都不少于 40 个字符；如果不是中文，对应 TranslationZh 字段必须给出中文翻译。
- 不允许尾逗号、注释、markdown 代码块、解释文字、中文引号作为 JSON 引号。
- 如果不确定图片 URL，请把 imageUrl/bgImage/cover 留空，不要编造不可访问链接。

${wbContext}
${userPersonaContext}
`;

        try {
            window.showToast(topic ? '正在按搜索生成内容...' : '正在随机生成内容...');
            const response = await fetch(tkResolveApiEndpoint(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.apiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: window.apiConfig.model || 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'Return strict valid JSON only. Use double-quoted property names and string values. Do not include markdown, comments, prose, single-quoted strings, or trailing commas.'
                        },
                        { role: 'user', content: prompt }
                    ],
                    temperature: parseFloat(window.apiConfig.temperature) || 0.8
                })
            });

            if (!response.ok) throw new Error(`API Error: ${response.status}`);

            const data = await response.json();
            let aiReply = data.choices?.[0]?.message?.content || '';
            const parsed = tkParseAiJson(aiReply);
            const parsedVideos = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.content) ? parsed.content : []);
            if (!Array.isArray(parsedVideos) || parsedVideos.length === 0) throw new Error('JSON content is not an array');

            const normalizedVideos = parsedVideos
                .slice(0, targetCount)
                .map(video => window.tkNormalizeVideoPayload(video));
            if (normalizedVideos.length < targetCount) {
                throw new Error(`Expected ${targetCount} videos but received ${normalizedVideos.length}`);
            }
            normalizedVideos.slice().reverse().forEach(video => {
                tkState.videos.unshift(video);
            });
            const latestVideoId = normalizedVideos[0]?.id || null;

            if (window.tkPersistState) window.tkPersistState();
            if (window.tkShowLatestGeneratedVideo) {
                window.tkShowLatestGeneratedVideo(latestVideoId);
            } else {
                window.tkRenderHome();
                requestAnimationFrame(() => {
                    if (feedContainer) feedContainer.scrollTop = 0;
                });
            }
            window.showToast('已生成内容');
        } catch (error) {
            console.error('Search Gen Error:', error);
            window.showToast('生成失败，请检查 API 或返回格式');
        }
    };

    // Keep the TikTok top-right action as search.
    setTimeout(() => {
        const topbarRight = document.querySelector('.tk-home-topbar .tk-topbar-right');
        if (topbarRight) {
            topbarRight.innerHTML = '<i class="fas fa-search" style="color: #111; cursor: pointer; font-size: 20px;"></i>';
            topbarRight.addEventListener('click', window.tkOpenSearchGenerateSheet);
        }
    }, 100);

    // Top Bar Tabs logic
    const topTabs = document.querySelectorAll('.tk-topbar-tab');
    topTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            topTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Re-render home feed based on active tab
            window.tkRenderHome();
        });
    });

    tkBindSingleStepFeedPaging();


});
