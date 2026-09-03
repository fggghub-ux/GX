// === Trending (榜单) Logic ===
    const trendRefreshBtn = document.getElementById('yt-trending-refresh-btn');
    const trendList = document.getElementById('yt-trending-list');
    let isTrendingLoading = false;
    let currentTrendingType = 'live';

    const trendFilterLive = document.getElementById('yt-trend-filter-live');
    const trendFilterSub = document.getElementById('yt-trend-filter-sub');

    if (trendFilterLive && trendFilterSub) {
        trendFilterLive.addEventListener('click', () => {
            trendFilterLive.classList.add('active');
            trendFilterSub.classList.remove('active');
            currentTrendingType = 'live';
            if (channelState.cachedTrendingLive && channelState.cachedTrendingLive.length > 0) {
                renderTrendingData(channelState.cachedTrendingLive);
            } else if (trendList) {
                trendList.innerHTML = '<div style="text-align: center; color: #8e8e93; margin-top: 40px;">点击右上角魔法棒生成最新榜单</div>';
            }
        });
        trendFilterSub.addEventListener('click', () => {
            trendFilterSub.classList.add('active');
            trendFilterLive.classList.remove('active');
            currentTrendingType = 'sub';
            if (channelState.cachedTrendingSub && channelState.cachedTrendingSub.length > 0) {
                renderTrendingData(channelState.cachedTrendingSub);
            } else if (trendList) {
                trendList.innerHTML = '<div style="text-align: center; color: #8e8e93; margin-top: 40px;">点击右上角魔法棒生成最新榜单</div>';
            }
        });
    }

    // 默认的 Mock 榜单数据
    const mockTrendingData = [
        { rank: 1, name: 'PewDiePie', handle: 'pewdiepie', desc: 'Gameplays, memes and everything in between.', subs: '1.11亿', videos: '4.7K', isLive: true },
        { rank: 2, name: 'MrBeast', handle: 'mrbeast', desc: 'I do crazy challenges and give away money.', subs: '2.5亿', videos: '780', isLive: false },
        { rank: 3, name: 'Markiplier', handle: 'markiplier', desc: 'Welcome to Markiplier! Here you\'ll find hilarious gaming videos.', subs: '3600万', videos: '5.4K', isLive: false },
        { rank: 4, name: 'Gawr Gura', handle: 'gawrgura', desc: 'Shark girl from Atlantis. Chumbuds assemble!', subs: '440万', videos: '500', isLive: true },
        { rank: 5, name: 'MKBHD', handle: 'markiplier', desc: 'Tech reviews and crispy videos.', subs: '1800万', videos: '1.5K', isLive: false },
        { rank: 6, name: 'IShowSpeed', handle: 'ishowspeed', desc: 'Loud, crazy, and always entertaining.', subs: '2200万', videos: '1.2K', isLive: true },
        { rank: 7, name: 'Jacksepticeye', handle: 'jacksepticeye', desc: 'Top of the mornin to ya laddies!', subs: '3000万', videos: '5.1K', isLive: false },
        { rank: 8, name: 'Dude Perfect', handle: 'dudeperfect', desc: '5 best friends and a panda.', subs: '6000万', videos: '300', isLive: false },
        { rank: 9, name: 'Valkyrae', handle: 'valkyrae', desc: 'Gaming, lifestyle and good vibes.', subs: '400万', videos: '400', isLive: true },
        { rank: 10, name: 'Sykkuno', handle: 'sykkuno', desc: 'Just playing games for fun.', subs: '290万', videos: '600', isLive: false }
    ];

    function normalizeTrendingArray(trendingArray, type = currentTrendingType) {
        if (!Array.isArray(trendingArray)) return [];
        return trendingArray
            .filter(item => item && typeof item === 'object')
            .map((item, index) => {
                const rank = Number(item.rank) || index + 1;
                const name = String(item.name || item.nickname || `频道${rank}`).trim();
                const handle = String(item.handle || name || `channel${rank}`).replace(/^@/, '').replace(/\s+/g, '').trim() || `channel${rank}`;
                const id = item.id || (typeof createStableYtChannelId === 'function'
                    ? createStableYtChannelId(`${type}_${handle}`, 'char_trend')
                    : `char_trend_${type}_${handle}`);
                const avatar = item.avatar || item.avatarUrl || `https://picsum.photos/seed/${encodeURIComponent(handle)}/80/80`;

                return {
                    ...item,
                    id,
                    rank,
                    name,
                    handle,
                    avatar,
                    banner: item.banner || null,
                    desc: item.desc || item.persona || '',
                    subs: item.subs || '0',
                    videos: item.videos || '10',
                    isLive: type === 'live' ? true : !!item.isLive
                };
            });
    }

    function persistTrendingCache(type, trendingArray) {
        const normalized = normalizeTrendingArray(trendingArray, type);
        if (type === 'live') {
            channelState.cachedTrendingLive = normalized;
        } else {
            channelState.cachedTrendingSub = normalized;
        }
        if (typeof saveYoutubeData === 'function') saveYoutubeData();
        return normalized;
    }

    function renderTrendingData(trendingArray) {
        if (!trendList) return;
        trendList.innerHTML = '';

        const normalizedTrending = normalizeTrendingArray(trendingArray);
        
        if (normalizedTrending.length > 0) {
            normalizedTrending.forEach((item, index) => {
                const avatarUrl = item.avatar || `https://picsum.photos/seed/${encodeURIComponent(item.handle)}/80/80`;
                
                const el = document.createElement('div');
                el.className = 'yt-trending-list-item';
                
                let rankClass = '';
                if (item.rank === 1) rankClass = 'top-1';
                if (item.rank === 2) rankClass = 'top-2';
                if (item.rank === 3) rankClass = 'top-3';

                el.innerHTML = `
                    <div class="yt-trending-rank ${rankClass}">${item.rank}</div>
                    <div class="yt-video-avatar" style="width: 50px; height: 50px; flex-shrink: 0;">
                        <img src="${avatarUrl}">
                    </div>
                    <div style="flex: 1; overflow: hidden;">
                        <div style="font-size: 16px; font-weight: 500; color: #0f0f0f; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${item.name}</div>
                        <div style="font-size: 12px; color: #606060; margin-top: 2px;">@${item.handle} • ${item.subs} 订阅</div>
                        <div style="font-size: 12px; color: #8e8e93; margin-top: 2px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${item.desc}</div>
                    </div>
                    ${item.isLive ? '<div class="yt-live-badge" style="position:static; margin-left:10px;"><i class="fas fa-broadcast-tower"></i></div>' : ''}
                `;

                el.addEventListener('click', () => {
                    let channelData = typeof buildYtChannelFromTrendingItem === 'function'
                        ? buildYtChannelFromTrendingItem(item, currentTrendingType, index)
                        : {
                            ...item,
                            avatar: avatarUrl,
                            isSubscribed: false
                        };

                    if (typeof mergeYtChannelIntoSubscriptions === 'function') {
                        channelData = mergeYtChannelIntoSubscriptions(channelData, { save: true, preferExistingSubscription: true }) || channelData;
                    } else if (typeof saveYoutubeData === 'function') {
                        saveYoutubeData();
                    }

                    openSubChannelView(channelData);
                });

                trendList.appendChild(el);
            });
        } else {
            trendList.innerHTML = '<div style="text-align: center; color: #8e8e93; margin-top: 40px;">点击右上角魔法棒生成最新榜单</div>';
        }
    }

    if (trendList) {
        const initialTrending = channelState.cachedTrendingLive || channelState.cachedTrendingSub;
        if (Array.isArray(initialTrending) && initialTrending.length > 0) {
            if (!channelState.cachedTrendingLive && channelState.cachedTrendingSub) {
                currentTrendingType = 'sub';
                if (trendFilterSub && trendFilterLive) {
                    trendFilterSub.classList.add('active');
                    trendFilterLive.classList.remove('active');
                }
            }
            renderTrendingData(initialTrending);
        }
    }

    if (trendRefreshBtn && trendList) {
        trendRefreshBtn.addEventListener('click', async (e) => {
            if (e) e.stopPropagation();
            if (isTrendingLoading) return;
            
            if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
                if(window.showToast) window.showToast('请先配置 API，当前显示默认榜单');
                const fallbackTrending = persistTrendingCache(currentTrendingType, mockTrendingData);
                renderTrendingData(fallbackTrending);
                return;
            }

            const wbContext = window.getYtWorldBookContext
                ? window.getYtWorldBookContext(currentTrendingType)
                : '';

            isTrendingLoading = true;
            trendList.innerHTML = '<div style="text-align:center; padding: 40px; color:#8e8e93;"><i class="fas fa-spinner fa-spin" style="font-size:24px; margin-bottom:10px;"></i><p>正在拉取最新榜单数据...</p></div>';


            let prompt = "";
            if (currentTrendingType === 'live') {
                prompt = `请根据世界书生成八个正在直播的频道（NO.1-8）。
要求返回严格的JSON格式，必须完全符合以下结构：
{
  "trending": [
    {
      "rank": 1,
      "name": "频道名称",
      "handle": "账号名不带@",
      "desc": "频道简介或主播人设",
      "subs": "254万",
      "videos": "120",
      "isLive": true
    }
  ]
}
注意：isLive 必须全部设为 true。
${wbContext}
不要包含任何Markdown标记。`;
            } else {
                prompt = `请根据世界书生成NO.1-8订阅最多的人。
要求返回严格的JSON格式，必须完全符合以下结构：
{
  "trending": [
    {
      "rank": 1,
      "name": "频道名称",
      "handle": "账号名不带@",
      "desc": "频道简介或主播人设",
      "subs": "254万",
      "videos": "120",
      "isLive": false
    }
  ]
}
注意：isLive 必须全部设为 false。
${wbContext}
不要包含任何Markdown标记。`;
            }

            try {
                const endpoint = window.u2Api.resolveChatCompletionsEndpoint(window.apiConfig.endpoint);

                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${window.apiConfig.apiKey}`
                    },
                    body: JSON.stringify({
                        model: window.apiConfig.model || 'gpt-3.5-turbo',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.9,
                        response_format: { type: "json_object" } 
                    })
                });

                if (!res.ok) throw new Error("API Request Failed");
                const data = await res.json();
                
                // 更健壮的 JSON 提取正则：提取大括号或中括号内的内容，防止大模型前言不搭后语
                let rawText = data.choices[0].message.content;
                let jsonMatch = rawText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
                let resultText = jsonMatch ? jsonMatch[0] : rawText;
                
                // 移除可能的 Markdown 包装
                resultText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
                
                let parsed;
                try {
                    parsed = sanitizeObj(JSON.parse(resultText));
                } catch (parseErr) {
                    console.error("JSON Parse Error in Trending:", parseErr, resultText);
                    if(window.showToast) window.showToast('大模型返回的格式有误，请重试');
                    trendList.innerHTML = '<div style="text-align:center; padding: 40px; color:#ff3b30;"><i class="fas fa-exclamation-triangle" style="font-size:24px; margin-bottom:10px;"></i><p>生成数据解析失败，请点击右上角重新生成</p></div>';
                    isTrendingLoading = false;
                    return;
                }

                trendList.innerHTML = '';
                
                let trendingArray = [];
                if (Array.isArray(parsed)) {
                    trendingArray = parsed;
                } else if (parsed.trending && Array.isArray(parsed.trending)) {
                    trendingArray = parsed.trending;
                } else if (typeof parsed === 'object') {
                    // Fallback if the object is unexpectedly structured
                    const keys = Object.keys(parsed);
                    if (keys.length > 0 && Array.isArray(parsed[keys[0]])) {
                        trendingArray = parsed[keys[0]];
                    } else {
                        trendingArray = [parsed]; 
                    }
                }

                if (trendingArray.length > 0) {
                    const normalizedTrending = persistTrendingCache(currentTrendingType, trendingArray);
                    renderTrendingData(normalizedTrending);
                } else {
                    trendList.innerHTML = '<div style="text-align:center; padding: 40px; color:#8e8e93;">没有生成到有效榜单，请重试</div>';
                }

            } catch(e) {
                console.error(e);
                trendList.innerHTML = '<div style="text-align:center; padding: 40px; color:#ff3b30;">生成失败，请重试</div>';
            } finally {
                isTrendingLoading = false;
            }
        });
    }
