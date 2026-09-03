var defaultPrompt = `你正在扮演 YouTube 直播主播 {char}。
主播人设：{char_persona}
观看用户：{user}
用户人设：{user_persona}
联动嘉宾：{guest}
已绑定世界书：{wb_context}
上一场直播总结：{live_summary_context}
{msg_context}
{context_clue}

请生成主播在直播画面中的回应，像真实直播间一样自然推进内容。除了要生成主播的话，还要生成第三人称视角的画面、环境和氛围描写，可以穿插在主播的话中，一条20字左右。
特别要求：主播不仅要针对 {user} 的最新消息进行回复，还得自然地回复其他观众的评论，表现出连续自然的直播间多人互动状态。
只返回严格 JSON：
{
  "narrative": "第三人称视角的画面、环境和氛围描写",
  "charBubbles": ["主播画面气泡1", "主播画面气泡2"],
  "fanComments": [{"name": "观众名", "text": "弹幕"}],
  "randomSuperChat": {"hasSuperChat": false, "name": "", "text": "", "displayAmount": "", "amount": 0, "color": "#e65100"}
}
要求：主播气泡不少于 5 条，继续生成不少于 10 条弹幕评论（fanComments），这些弹幕中，一部分可以是对 {user} 最新评论的回复、跟风或吐槽；另一部分可以是刚进直播间的新观众留言，或是没看到 {user} 评论、纯粹针对主播或直播内容表达自己观点的独立弹幕，以体现真实直播间弹幕的丰富和滚动感。
语言自然，不要 emoji，不要 Markdown。`;

var defaultGroupChatPrompt = `你要生成真实自然的 YouTube 私信或频道粉丝社群对话。频道主体是 {char}。
群主人设：{char_persona}
用户：{user}
用户人设：{user_persona}
可用管理员（自建社群时使用）：
{admins}
世界书内容：{wb_context}
聊天记录：
{chat_history}

触发说明：
{trigger_instruction}

请根据聊天上下文生成活泼自然的短消息，并严格遵循末尾追加的 JSON 输出协议。
要求：
1. 不要使用 Markdown，不要 emoji，语气符合真实私信或粉丝群氛围，可以吹捧、调侃、讨论和自然追问。
2. 连续消息应有上下文关系，不要机械复述。
3. YouTube 是国际化平台，可以使用符合角色国籍、人设和上下文的任意语言；外语必须提供自然中文翻译。`;

var defaultVODPrompt = `你正在扮演 YouTube 频道 {char}。
频道人设：{char_persona}
用户：{user}
用户人设：{user_persona}
视频标题：{video_title}
已绑定世界书：{wb_context}
用户评论：{msg}

请生成视频评论区的后续互动。
只返回严格 JSON：
{
  "charReplies": ["频道回复"],
  "fanReplies": ["其他观众回复"]
}
不要 Markdown，不要 emoji，评论要短而像真实 YouTube 评论区。`;

var defaultSummaryPrompt = `请为这场 YouTube 直播生成复盘总结。
主播/频道：{char}
主播人设：{char_persona}
用户人设：{user}
当前时间：{current_time}
聊天记录：
{chat_history}

只返回严格 JSON：
{
  "title": "总结标题",
  "content": "总结正文",
  "mood": "直播氛围",
  "highlights": ["亮点1", "亮点2"],
  "newSubs": 0
}
不要 Markdown，不要 emoji。`;

const ytBindWorldBookBtn = document.getElementById('yt-bind-wb-btn');
const ytSettingsSheet = document.getElementById('yt-settings-sheet');
const ytSummaryListBtn = document.getElementById('yt-summary-list-btn');
const ytBoundWbName = document.getElementById('yt-bound-wb-name');
const promptTabLive = document.getElementById('prompt-tab-live');
const promptTabGroup = document.getElementById('prompt-tab-group');
const ytPromptInput = document.getElementById('yt-prompt-input');
const ytPromptDesc = document.getElementById('yt-prompt-desc');
const resetYtPromptBtn = document.getElementById('reset-yt-prompt-btn');
const confirmYtPromptBtn = document.getElementById('confirm-yt-prompt-btn');

let currentYtPromptType = 'live';

function closeYtSettingsSheet() {
    if (ytSettingsSheet) ytSettingsSheet.classList.remove('active');
}

function updateYtBoundWorldBookLabel() {
    if (!ytBoundWbName) return;

    const ids = Array.isArray(channelState?.boundWorldBookIds) ? channelState.boundWorldBookIds : [];
    if (ids.length === 0) {
        ytBoundWbName.textContent = '未绑定';
        return;
    }

    const books = typeof window.getWorldBooks === 'function' ? window.getWorldBooks() : [];
    const names = ids
        .map(id => books.find(book => String(book.id) === String(id))?.name)
        .filter(Boolean);

    ytBoundWbName.textContent = names.length > 0 ? names.join('、') : `已绑定 ${ids.length} 项`;
}

function getYtPromptValue(type) {
    if (type === 'group') return channelState.groupChatPrompt || defaultGroupChatPrompt;
    return channelState.systemPrompt || defaultPrompt;
}

function getDefaultYtPromptValue(type) {
    if (type === 'group') return defaultGroupChatPrompt;
    return defaultPrompt;
}

function setActiveYtPromptTab(type) {
    currentYtPromptType = type === 'group' ? 'group' : 'live';
    if (promptTabLive) promptTabLive.classList.toggle('active', currentYtPromptType === 'live');
    if (promptTabGroup) promptTabGroup.classList.toggle('active', currentYtPromptType === 'group');
    if (ytPromptDesc) {
        ytPromptDesc.textContent = currentYtPromptType === 'group'
            ? '群聊/私信提示词。可用变量：{char}、{char_persona}、{user}、{user_persona}、{admins}、{wb_context}、{chat_history}、{trigger_instruction}。'
            : '直播互动提示词。可用变量：{char}、{char_persona}、{user}、{user_persona}、{guest}、{wb_context}、{live_summary_context}、{msg_context}、{context_clue}。';
    }
    if (ytPromptInput) ytPromptInput.value = getYtPromptValue(currentYtPromptType);
}

if (ytBindWorldBookBtn && ytSettingsSheet) {
    ytBindWorldBookBtn.addEventListener('click', () => {
        if (window.renderWorldBookSelector) {
            window.renderWorldBookSelector(
                channelState.boundWorldBookIds || [],
                (selectedIds) => {
                    channelState.boundWorldBookIds = selectedIds;
                    if (typeof saveYoutubeData === 'function') saveYoutubeData();
                    updateYtBoundWorldBookLabel();
                }
            );
        }
    });
}

if (ytSummaryListBtn) {
    ytSummaryListBtn.addEventListener('click', () => {
        if (typeof window.renderYtSummaryList === 'function') {
            window.renderYtSummaryList();
        }
        const summarySheet = document.getElementById('yt-summary-list-sheet');
        if (summarySheet) summarySheet.classList.add('active');
        closeYtSettingsSheet();
    });
}

if (promptTabLive) {
    promptTabLive.addEventListener('click', () => setActiveYtPromptTab('live'));
}

if (promptTabGroup) {
    promptTabGroup.addEventListener('click', () => setActiveYtPromptTab('group'));
}

if (resetYtPromptBtn && ytPromptInput) {
    resetYtPromptBtn.addEventListener('click', () => {
        ytPromptInput.value = getDefaultYtPromptValue(currentYtPromptType);
    });
}

if (confirmYtPromptBtn && ytPromptInput) {
    confirmYtPromptBtn.addEventListener('click', () => {
        if (currentYtPromptType === 'group') {
            channelState.groupChatPrompt = ytPromptInput.value.trim();
        } else {
            channelState.systemPrompt = ytPromptInput.value.trim();
        }
        if (typeof saveYoutubeData === 'function') saveYoutubeData();
        if (window.showToast) window.showToast('已保存');
        const promptSheet = document.getElementById('yt-prompt-sheet');
        if (promptSheet) promptSheet.classList.remove('active');
    });
}

updateYtBoundWorldBookLabel();
setActiveYtPromptTab('live');
