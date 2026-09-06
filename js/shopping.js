(function() {
    const durableStorage = window.u2LegacyStorageFacade;
    class ShoppingApp {
        constructor() {
            this.view = document.getElementById('shopping-view');
            this.panelsWrap = document.getElementById('shopping-panels');
            this.indicator = document.getElementById('shopping-nav-indicator');
            this.closeBtn = document.getElementById('shopping-close-btn');
            this.tabs = ['food', 'mall', 'cart', 'me'];
            this.currentTab = 'food';
            this.scrollTimer = null;
            this.ordersRefreshTimer = null;
            
            // Cart state
            this.cart = this.loadCart();
            
            // Mall Details Sheet
            this.detailSheet = document.getElementById('shopping-detail-sheet');
            this.detailMedia = document.getElementById('shopping-detail-media');
            this.detailName = document.getElementById('shopping-detail-name');
            this.detailPrice = document.getElementById('shopping-detail-price');
            this.detailDesc = document.getElementById('shopping-detail-desc');
            this.addToCartBtn = document.getElementById('shopping-add-to-cart-btn');
            
            // Food Details Sheet
            this.foodDetailSheet = document.getElementById('shopping-food-detail-sheet');
            this.foodDetailMedia = document.getElementById('shopping-food-detail-media');
            this.foodDetailName = document.getElementById('shopping-food-detail-name');
            this.foodDetailPrice = document.getElementById('shopping-food-detail-price');
            this.foodDetailDesc = document.getElementById('shopping-food-detail-desc');
            this.foodBottomPrice = document.getElementById('shopping-food-bottom-price');
            this.foodCloseBtn = document.getElementById('shopping-food-close-btn');
            this.addFoodToCartBtn = document.getElementById('shopping-food-add-to-cart-btn');
            
            this.currentProduct = null;

            // Cart View elements
            this.cartEmptyState = document.getElementById('shopping-cart-empty-state');
            this.cartContent = document.getElementById('shopping-cart-content');
            this.cartList = document.getElementById('shopping-cart-list');
            this.cartSubtotal = document.getElementById('shopping-cart-subtotal');
            this.cartTotal = document.getElementById('shopping-cart-total');

            // Checkout & Orders elements
            this.checkoutBtn = document.getElementById('shopping-checkout-btn');
            this.checkoutSheet = document.getElementById('shopping-checkout-sheet');
            this.payDesc = document.getElementById('shopping-checkout-pay-desc');
            this.paySelectBtn = document.getElementById('shopping-checkout-pay-select');
            this.friendDesc = document.getElementById('shopping-checkout-friend-desc');
            this.friendSelectBtn = document.getElementById('shopping-checkout-friend-select');
            this.confirmPaymentBtn = document.getElementById('shopping-confirm-payment-btn');
            this.paymentRadios = document.querySelectorAll('input[name="shopping-payment-method"]');
            
            this.cardSelectionModal = document.getElementById('shopping-card-selection-modal');
            this.cardList = document.getElementById('shopping-card-list');
            this.cardBalance = document.getElementById('shopping-card-selection-balance');
            
            this.charSelectionModal = document.getElementById('shopping-char-selection-modal');
            this.charList = document.getElementById('shopping-char-list');

            this.ordersBtn = document.getElementById('shopping-orders-btn');
            this.ordersSheet = document.getElementById('shopping-orders-sheet');
            this.ordersList = document.getElementById('shopping-orders-list');
            
            this.orders = this.loadOrders();
            this.selectedCard = null;
            this.selectedFriend = null;

            if (!this.view || !this.panelsWrap) return;
            this.navItems = Array.from(this.view.querySelectorAll('.shopping-nav-item'));
            this.panels = Array.from(this.view.querySelectorAll('.shopping-panel'));
            
            // New UI Elements
            this.settingsBtn = document.getElementById('shopping-settings-btn');
            this.settingsSheet = document.getElementById('shopping-settings-sheet');
            this.searchBtn = document.getElementById('shopping-search-btn');
            this.searchSheet = document.getElementById('shopping-search-sheet');
            this.searchInput = document.getElementById('shopping-search-input');
            this.searchConfirmBtn = document.getElementById('shopping-search-confirm-btn');
            this.bindWbBtn = document.getElementById('shopping-bind-wb-btn');
            this.boundWbName = document.getElementById('shopping-bound-wb-name');
            
            this.foodListContainer = document.getElementById('shopping-food-list-container');
            this.productListContainer = document.getElementById('shopping-product-grid-container');

            this.updateBoundWbDisplay();

            this.bindEvents();
            this.switchTab('food', { scroll: false });
            this.renderCart();
            
            this.loadGeneratedProducts();
        }

        loadGeneratedProducts() {
            try {
                const savedFood = durableStorage.getItem('shopping_generated_food');
                if (savedFood) {
                    const foodData = JSON.parse(savedFood);
                    this.renderProductCards(foodData, 'food');
                }
                const savedMall = durableStorage.getItem('shopping_generated_mall');
                if (savedMall) {
                    const mallData = JSON.parse(savedMall);
                    this.renderProductCards(mallData, 'mall');
                }
            } catch (e) {
                console.error("Failed to load generated products", e);
            }
        }

        getAvailableWorldBooks() {
            if (typeof window.getWorldBooks === 'function') {
                return window.getWorldBooks() || [];
            }

            const globalDataStr = durableStorage.getItem('app_global_data');
            if (globalDataStr) {
                try {
                    const globalData = JSON.parse(globalDataStr);
                    return globalData?.worldBooks?.books || [];
                } catch (e) {}
            }

            return [];
        }

        getBoundWorldBookIds() {
            let ids = [];
            const savedIds = durableStorage.getItem('shopping_bound_wb_ids');
            if (savedIds) {
                try {
                    const parsedIds = JSON.parse(savedIds);
                    if (Array.isArray(parsedIds)) ids = parsedIds;
                } catch (e) {}
            }

            const legacyId = durableStorage.getItem('shopping_bound_wb_id');
            if (legacyId && !ids.map(String).includes(String(legacyId))) {
                ids.unshift(legacyId);
            }

            return ids
                .map(id => String(id))
                .filter((id, index, allIds) => id && allIds.indexOf(id) === index);
        }

        saveBoundWorldBookIds(ids = []) {
            const nextIds = (Array.isArray(ids) ? ids : [])
                .map(id => String(id))
                .filter((id, index, allIds) => id && allIds.indexOf(id) === index);

            if (nextIds.length > 0) {
                durableStorage.setItem('shopping_bound_wb_ids', JSON.stringify(nextIds));
                durableStorage.setItem('shopping_bound_wb_id', nextIds[0]);
            } else {
                durableStorage.removeItem('shopping_bound_wb_ids');
                durableStorage.removeItem('shopping_bound_wb_id');
            }
        }

        updateBoundWbDisplay() {
            if (!this.boundWbName) return;
            const boundIds = this.getBoundWorldBookIds();
            if (boundIds.length === 0) {
                this.boundWbName.textContent = 'Not Mounted';
                return;
            }

            const books = this.getAvailableWorldBooks();
            const boundBooks = boundIds
                .map(id => books.find(book => String(book.id) === String(id)))
                .filter(Boolean);

            if (boundBooks.length === 1) {
                this.boundWbName.textContent = boundBooks[0].name || '未命名世界书';
            } else if (boundBooks.length > 1) {
                this.boundWbName.textContent = `已挂载 ${boundBooks.length} 本`;
            } else {
                this.boundWbName.textContent = 'Not Mounted';
            }
        }

        bindEvents() {
            this.closeBtn?.addEventListener('click', () => this.close());
            this.foodCloseBtn?.addEventListener('click', () => this.closeDetail());
            
            // Settings logic
            if (this.settingsBtn) {
                this.settingsBtn.addEventListener('click', () => {
                    this.updateBoundWbDisplay();
                    this.settingsSheet?.classList.add('active');
                });
            }

            if (this.bindWbBtn) {
                this.bindWbBtn.addEventListener('click', () => {
                    if (typeof window.renderWorldBookSelector === 'function') {
                        window.renderWorldBookSelector(this.getBoundWorldBookIds(), (selectedIds) => {
                            this.saveBoundWorldBookIds(selectedIds);
                            this.updateBoundWbDisplay();
                        });
                    } else if (window.wbManager && window.wbManager.showWorldBookPicker) {
                        window.wbManager.showWorldBookPicker((selectedBook) => {
                            this.saveBoundWorldBookIds(selectedBook ? [selectedBook.id] : []);
                            this.updateBoundWbDisplay();
                        });
                    }
                });
            }

            // Search logic
            if (this.searchBtn) {
                this.searchBtn.addEventListener('click', () => {
                    if(this.searchInput) this.searchInput.value = '';
                    this.searchSheet?.classList.add('active');
                });
            }

            if (this.searchConfirmBtn) {
                this.searchConfirmBtn.addEventListener('click', () => {
                    this.handleGenerateProducts();
                });
            }

            // Allow closing sheets by clicking on overlay
            [this.settingsSheet, this.searchSheet].forEach(sheet => {
                if(sheet) {
                    sheet.addEventListener('click', (e) => {
                        if(e.target === sheet) {
                            sheet.classList.remove('active');
                        }
                    });
                }
            });
            
            const reviewsTrigger = document.getElementById('shopping-reviews-trigger');
            if (reviewsTrigger) {
                reviewsTrigger.addEventListener('click', () => {
                    if (this.currentProduct) {
                        this.openAllReviews(this.currentProduct.name, false);
                    }
                });
            }

            const foodReviewsTrigger = document.getElementById('shopping-food-reviews-trigger');
            if (foodReviewsTrigger) {
                foodReviewsTrigger.addEventListener('click', () => {
                    if (this.currentProduct) {
                        this.openAllReviews(this.currentProduct.name, true);
                    }
                });
            }
            
            const qaTrigger = document.getElementById('shopping-mall-qa-trigger');
            if (qaTrigger) {
                qaTrigger.addEventListener('click', () => {
                    const qaSheet = document.getElementById('shopping-qa-sheet');
                    if (qaSheet) {
                        qaSheet.classList.add('active');
                    }
                });
            }
            
            const qaSheetElement = document.getElementById('shopping-qa-sheet');
            if (qaSheetElement) {
                qaSheetElement.addEventListener('click', (e) => {
                    if (e.target === qaSheetElement) {
                        qaSheetElement.classList.remove('active');
                    }
                });
            }
            
            const allReviewsSheet = document.getElementById('shopping-all-reviews-sheet');
            if (allReviewsSheet) {
                allReviewsSheet.addEventListener('click', (e) => {
                    if (e.target === allReviewsSheet) {
                        allReviewsSheet.classList.remove('active');
                    }
                });
            }

            this.navItems.forEach((item) => {
                item.addEventListener('click', () => {
                    this.switchTab(item.dataset.tab || 'food');
                });
            });

            this.panelsWrap.addEventListener('scroll', () => {
                window.clearTimeout(this.scrollTimer);
                this.scrollTimer = window.setTimeout(() => {
                    const width = this.panelsWrap.clientWidth || 1;
                    const index = Math.round(this.panelsWrap.scrollLeft / width);
                    const tab = this.tabs[Math.max(0, Math.min(this.tabs.length - 1, index))];
                    this.switchTab(tab, { scroll: false });
                }, 80);
            }, { passive: true });

            window.addEventListener('resize', () => this.updateIndicator());

            // Initial Product clicks binding
            this.bindProductClicks();

            // Add to cart
            if (this.addToCartBtn) {
                this.addToCartBtn.addEventListener('click', () => {
                    if (this.currentProduct) {
                        this.addToCart(this.currentProduct);
                        this.closeDetail();
                        const originalText = this.addToCartBtn.textContent;
                        this.addToCartBtn.textContent = '已添加!';
                        setTimeout(() => {
                            if(this.addToCartBtn) this.addToCartBtn.textContent = originalText;
                        }, 1000);
                    }
                });
            }

            if (this.addFoodToCartBtn) {
                this.addFoodToCartBtn.addEventListener('click', () => {
                    if (this.currentProduct) {
                        this.addToCart(this.currentProduct);
                        this.closeDetail();
                        const originalText = this.addFoodToCartBtn.textContent;
                        this.addFoodToCartBtn.textContent = '已添加!';
                        setTimeout(() => {
                            if(this.addFoodToCartBtn) this.addFoodToCartBtn.textContent = originalText;
                        }, 1000);
                    }
                });
            }

            // Checkout flow
            if (this.checkoutBtn) {
                this.checkoutBtn.addEventListener('click', async () => {
                    if (this.cart.length === 0) return;
                    await this.initCheckout();
                    this.checkoutSheet?.classList.add('active');
                });
            }

            if (this.paySelectBtn) {
                this.paySelectBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const payRadio = document.querySelector('input[name="shopping-payment-method"][value="pay"]');
                    if (payRadio) payRadio.checked = true;
                    this.openCardSelection();
                });
            }

            if (this.friendSelectBtn) {
                this.friendSelectBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const friendRadio = document.querySelector('input[name="shopping-payment-method"][value="friend"]');
                    if (friendRadio) friendRadio.checked = true;
                    this.openCharSelection();
                });
            }

            if (this.confirmPaymentBtn) {
                this.confirmPaymentBtn.addEventListener('click', () => {
                    this.processPayment();
                });
            }

            // Orders
            if (this.ordersBtn) {
                this.ordersBtn.addEventListener('click', () => {
                    this.renderOrders();
                    this.ordersSheet?.classList.add('active');
                    this.startOrdersRefresh();
                });
            }

            document.addEventListener('visibilitychange', () => {
                if (document.hidden) this.stopOrdersRefresh();
                else if (this.ordersSheet?.classList.contains('active')) this.startOrdersRefresh();
            });
        }

        stopOrdersRefresh() {
            if (this.ordersRefreshTimer) clearTimeout(this.ordersRefreshTimer);
            this.ordersRefreshTimer = null;
        }

        startOrdersRefresh() {
            this.stopOrdersRefresh();
            if (!this.ordersSheet?.classList.contains('active') || document.hidden) return;
            this.ordersRefreshTimer = window.setTimeout(() => {
                this.ordersRefreshTimer = null;
                if (!this.ordersSheet?.classList.contains('active') || document.hidden) return;
                this.renderOrders();
                this.startOrdersRefresh();
            }, 1000);
        }

        async handleGenerateProducts() {
            let userInput = this.searchInput ? this.searchInput.value.trim() : '';
            
            const targetTab = this.currentTab === 'food' ? 'food' : 'mall';
            
            // If empty, generate random items based on the current tab
            if (!userInput) {
                userInput = targetTab === 'food' 
                    ? "随机生成一些高质量的外卖美食和饮品" 
                    : "随机生成一些高品质的商城百货和数码日常用品";
            }

            if (this.searchConfirmBtn) {
                this.searchConfirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
                this.searchConfirmBtn.disabled = true;
            }

            let systemPrompt = `你现在是一个商品、评价及问答生成器。根据用户的输入，生成不少于10个商品。每个商品生成5-10条用户评价，以及5-10条问答(Q&A)。
当前分类是 ${targetTab === 'food' ? 'Food(外卖美食)' : 'Mall(商城百货)'}。

**关键要求**：
1. **评价(Reviews)**：必须非常真实、接地气，包含好评、中评甚至差评。语气要幽默、调侃或者夸张（比如：“好吃是好吃，就是吃完对象跑了”、“衣服很仙，但穿上像个成了精的拖把”）。
2. **问答(Q&A)**：这是买家向已经买过的买家提问的板块（类似淘宝的“问大家”）。回答者**绝对不要**像官方客服，而是真实的、充满个性的普通买家。回答可以很搞笑、无厘头、甚至带点互坑的成分（比如 Q：“吃完能变帅吗？” A：“别做梦了，看脸” 或 Q：“好用吗？” A：“买回来积灰挺好的，建议入手”）。

\n\n`;

            // Append World Book context if bound
            const boundIds = this.getBoundWorldBookIds();
            if (boundIds.length > 0 && window.wbManager) {
                const bookContexts = [];
                for (const boundId of boundIds) {
                    const bookCtx = await window.wbManager.getBookContextString(boundId);
                    if (bookCtx) bookContexts.push(bookCtx);
                }
                if (bookContexts.length > 0) {
                    systemPrompt += `[当前挂载的世界书上下文]\n${bookContexts.join('\n\n')}\n\n参考以上世界书设定生成契合世界观的商品，评价和问答也可以带入世界观中的梗。\n\n`;
                }
            }

            systemPrompt += `输出必须为纯 JSON 数组格式，不要任何多余文本或 markdown 标签。格式要求：\n
[
  {
    "name": "商品名称",
    "price": "商品价格(包含¥符号，如¥45)",
    "desc": "商品简短描述",
    "iconClass": "fontawesome图标类名(例如 fa-burger)",
    "bgGrad": "CSS渐变背景(例如 linear-gradient(135deg, #f093fb 0%, #f5576c 100%))",
    "tags": ["标签1", "标签2"],
    "reviews": [
      { "user": "用户A", "text": "评价内容", "rating": 5 },
      { "user": "用户B", "text": "评价内容", "rating": 4 }
    ],
    "qa": [
      { "q": "问题内容1", "a": "回答内容1" },
      { "q": "问题内容2", "a": "回答内容2" }
    ]
  }
]`;

            try {
                const apiConfig = typeof window.getApiConfig === 'function' ? window.getApiConfig() : (window.apiConfig || {});
                if (!apiConfig || !apiConfig.endpoint || !apiConfig.apiKey) {
                    throw new Error('请先在系统设置中配置 API');
                }

                const endpoint = window.u2Api.resolveChatCompletionsEndpoint(apiConfig.endpoint);

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiConfig.apiKey}`
                    },
                    body: JSON.stringify({
                        model: apiConfig.model || 'gpt-3.5-turbo',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userInput }
                        ],
                        temperature: parseFloat(apiConfig.temperature) || 0.8
                    })
                });

                if (!response.ok) {
                    throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                const choice = data.choices && data.choices[0];
                const responseText = choice && choice.message ? choice.message.content : '';
                
                let jsonText = responseText || '';
                
                // Clean up possible markdown wrappers
                if (jsonText.startsWith('```')) {
                    jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
                }

                let productsData = null;
                try {
                    productsData = JSON.parse(jsonText);
                } catch(e) {
                    // Try to extract array if parsing fails
                    const startIdx = jsonText.indexOf('[');
                    const endIdx = jsonText.lastIndexOf(']');
                    if(startIdx !== -1 && endIdx !== -1) {
                        productsData = JSON.parse(jsonText.substring(startIdx, endIdx + 1));
                    } else {
                        throw new Error("JSON 解析失败");
                    }
                }

                if (!Array.isArray(productsData) || productsData.length === 0) {
                     throw new Error("生成数据为空");
                }

                // Append generated products to UI
                this.injectGeneratedProducts(productsData, targetTab);
                
                if (this.searchSheet) this.searchSheet.classList.remove('active');
                if (this.searchInput) this.searchInput.value = '';
                
            } catch(e) {
                console.error("Generate error:", e);
                window.showToast ? window.showToast('生成失败: ' + e.message) : alert('生成失败: ' + e.message);
            } finally {
                if (this.searchConfirmBtn) {
                    this.searchConfirmBtn.innerHTML = '<i class="fas fa-magic"></i> Confirm Genration';
                    this.searchConfirmBtn.disabled = false;
                }
            }
        }

        renderProductCards(productsData, targetTab) {
            let container = null;
            if (targetTab === 'food') container = this.foodListContainer;
            if (targetTab === 'mall') container = this.productListContainer;

            if (!container) return;

            productsData.forEach(p => {
                const article = document.createElement('article');
                
                // Set rating randomly if not provided (for tags)
                const rndRating = (Math.random() * (5.0 - 4.0) + 4.0).toFixed(1);
                
                if (targetTab === 'food') {
                    article.className = 'shopping-food-card';
                    let tagsHtml = (p.tags || ['30 min', rndRating]).map(t => `<span>${t}</span>`).join('');
                    
                    article.innerHTML = `
                        <div class="shopping-food-media" style="background: ${p.bgGrad || '#f2f2f7'}"><i class="fas ${p.iconClass || 'fa-utensils'}"></i></div>
                        <div class="shopping-food-copy">
                            <div class="shopping-card-topline"><strong>${p.name}</strong><span>${p.price}</span></div>
                            <p>${p.desc}</p>
                            <div class="shopping-tags">${tagsHtml}</div>
                        </div>
                    `;
                } else {
                    article.className = 'shopping-product-card';
                    article.innerHTML = `
                        <div class="shopping-product-media" style="background: ${p.bgGrad || '#f2f2f7'}"><i class="fas ${p.iconClass || 'fa-box'}"></i></div>
                        <strong>${p.name}</strong>
                        <span>${p.price}</span>
                        <span style="display:none;">${p.desc}</span> <!-- Hidden desc to pass to openDetail -->
                    `;
                }

                container.appendChild(article);
            });
            
            this.bindProductClicks();
        }

        injectGeneratedProducts(productsData, targetTab) {
            this.renderProductCards(productsData, targetTab);
            
            // Save generated products to localStorage
            try {
                const key = targetTab === 'food' ? 'shopping_generated_food' : 'shopping_generated_mall';
                let saved = [];
                const stored = durableStorage.getItem(key);
                if (stored) saved = JSON.parse(stored);
                saved = saved.concat(productsData);
                durableStorage.setItem(key, JSON.stringify(saved));
            } catch (e) {}

            let commentsObj = {};
            try {
                const stored = durableStorage.getItem('shopping_comments');
                if (stored) commentsObj = JSON.parse(stored);
            } catch(err) {}

            let qaObj = {};
            try {
                const storedQa = durableStorage.getItem('shopping_qa');
                if (storedQa) qaObj = JSON.parse(storedQa);
            } catch(err) {}

            productsData.forEach(p => {
                // Save comments
                if (p.reviews && Array.isArray(p.reviews)) {
                    // Prepend date if missing
                    const datedReviews = p.reviews.map(r => ({
                        ...r,
                        date: r.date || new Date().toLocaleDateString()
                    }));
                    
                    if(commentsObj[p.name]) {
                        commentsObj[p.name] = [...datedReviews, ...commentsObj[p.name]];
                    } else {
                        commentsObj[p.name] = datedReviews;
                    }
                }

                // Save Q&A
                if (p.qa && Array.isArray(p.qa)) {
                    if (qaObj[p.name]) {
                        qaObj[p.name] = [...p.qa, ...qaObj[p.name]];
                    } else {
                        qaObj[p.name] = p.qa;
                    }
                }
            });

            durableStorage.setItem('shopping_comments', JSON.stringify(commentsObj));
            durableStorage.setItem('shopping_qa', JSON.stringify(qaObj));
        }

        bindProductClicks() {
            const products = this.view.querySelectorAll('.shopping-food-card, .shopping-product-card');
            products.forEach(product => {
                // Prevent multiple bindings
                if (product.hasAttribute('data-bound')) return;
                product.setAttribute('data-bound', 'true');

                product.style.cursor = 'pointer';
                product.addEventListener('click', () => {
                    let name, price, desc, iconHtml, mediaBg;
                    
            let isFood = false;
            if (product.classList.contains('shopping-food-card')) {
                isFood = true;
                name = product.querySelector('strong')?.textContent || 'Food Item';
                price = product.querySelector('.shopping-card-topline span')?.textContent || '¥0';
                desc = product.querySelector('p')?.textContent || '';
                iconHtml = product.querySelector('.shopping-food-media')?.innerHTML || '';
                mediaBg = product.querySelector('.shopping-food-media').style.background || window.getComputedStyle(product.querySelector('.shopping-food-media')).background;
            } else {
                name = product.querySelector('strong')?.textContent || 'Product';
                price = product.querySelector('span')?.textContent.split('·')[0].trim() || '¥0';
                // For generated mall items, desc is in the hidden span
                const spans = product.querySelectorAll('span');
                desc = (spans.length > 1) ? spans[1].textContent : '';
                iconHtml = product.querySelector('.shopping-product-media')?.innerHTML || '';
                mediaBg = product.querySelector('.shopping-product-media').style.background || window.getComputedStyle(product.querySelector('.shopping-product-media')).background;
            }

                    this.openDetail({ name, price, desc, iconHtml, mediaBg }, isFood);
                });
            });
        }

        async openGiftCharSelection(order, orderIndex) {
            if (!this.charSelectionModal || !this.charList) return;
            
            const originalTitle = this.charSelectionModal.querySelector('.wb-centered-modal-title').textContent;
            this.charSelectionModal.querySelector('.wb-centered-modal-title').textContent = 'Select a friend to gift';
            
            this.charList.innerHTML = '';
            
            let friends = [];
            if (window.imStorage && window.imStorage.loadFriends) {
                try {
                    const allFriends = await window.imStorage.loadFriends();
                    friends = allFriends;
                } catch(e) {}
            }
            
            if (friends.length === 0) {
                this.charList.innerHTML = '<div style="text-align: center; padding: 20px; color: #73706a;">no friends yet</div>';
            } else {
                friends.forEach(friend => {
                    const el = document.createElement('div');
                    el.style.cssText = 'background: rgba(255, 255, 255, 0.82); border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; border: 1px solid rgba(17,17,17,0.09); ';
                    
                    const name = friend.name || friend.nickname || 'Unknown Char';
                    let avatarHtml = `<div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(17,17,17,0.06); display: flex; justify-content: center; align-items: center; color: #73706a;"><i class="fas fa-user"></i></div>`;
                    if (friend.avatar) {
                        avatarHtml = `<img src="${friend.avatar}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(17,17,17,0.09);">`;
                    }
                    
                    el.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 12px;">
                            ${avatarHtml}
                            <div style="display: flex; flex-direction: column;">
                                <div style="font-size: 15px; font-weight: 700; color: #111;">${name}</div>
                                <div style="font-size: 13px; color: #73706a; max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${friend.signature || ''}</div>
                            </div>
                        </div>
                        <div style="background: #111; color: #fff; padding: 6px 12px; border-radius: 16px; font-size: 13px; font-weight: 600;">Gift</div>
                    `;
                    
                    el.addEventListener('click', async () => {
                        const success = await this.sendGiftMessage(friend, order);
                        if (success) {
                            if (orderIndex !== undefined && this.orders[orderIndex]) {
                                this.orders[orderIndex].gifted = true;
                                this.saveOrders();
                                this.renderOrders();
                            }
                        }
                        this.charSelectionModal.style.display = 'none';
                        this.charSelectionModal.classList.remove('active');
                        this.charSelectionModal.querySelector('.wb-centered-modal-title').textContent = originalTitle;
                    });
                    
                    this.charList.appendChild(el);
                });
            }
            
            const closeBtn = this.charSelectionModal.querySelector('.wb-centered-modal-close');
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.addEventListener('click', () => {
                this.charSelectionModal.style.display = 'none';
                this.charSelectionModal.classList.remove('active');
                this.charSelectionModal.querySelector('.wb-centered-modal-title').textContent = originalTitle;
            });

            this.charSelectionModal.style.display = 'flex';
            requestAnimationFrame(() => {
                this.charSelectionModal.classList.add('active');
            });
        }
        
        async sendGiftMessage(friend, order) {
            const itemNames = order.items.map(i => i.name).join(', ');
            const msgText = `[赠送礼物]\n商品: ${itemNames}\n总价: ¥${order.total.toFixed(2)}\n付款方式: ${order.method}`;
            
            const htmlCard = `
                <div style="background: #fff0f3; border-radius: 16px; padding: 16px; min-width: 220px; max-width: 280px; color: #111111; border: 1px solid rgba(255,155,179,0.3); display: inline-block;">
                    <div style="font-size: 12px; color: #ff9bb3; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; font-weight: 700;">
                        <i class="fas fa-gift"></i> Gift Received
                    </div>
                    <div style="font-size: 15px; font-weight: 700; margin-bottom: 6px; white-space: normal; word-break: break-word; line-height: 1.4;">${itemNames}</div>
                    <div style="font-size: 13px; color: #73706a; margin-top: 8px;">Value ¥${order.total.toFixed(2)}</div>
                    <div style="font-size: 12px; color: #8e8e93; margin-top: 4px;">Paid via ${order.method}</div>
                </div>
            `;

            let success = false;
            if (window.imApp && window.imApp.appendFriendMessage) {
                try {
                    if (window.imApp.ensureFriendMessagesLoaded) {
                        await window.imApp.ensureFriendMessagesLoaded(friend.id);
                    }

                    const newMsg = {
                        role: 'user',
                        type: 'html',
                        text: msgText,
                        content: htmlCard,
                        timestamp: Date.now()
                    };
                    
                    success = await window.imApp.appendFriendMessage(friend.id, newMsg, { silent: false });
                    
                    const aiMsg = {
                        role: 'system',
                        type: 'text',
                        text: `你收到了一份礼物: ${itemNames}。价值 ¥${order.total.toFixed(2)}。付款方式是: ${order.method}。请根据你的角色人设对这份礼物做出真实的反应（感谢、惊喜或者调侃等）。`,
                        timestamp: Date.now() + 1
                    };
                    await window.imApp.appendFriendMessage(friend.id, aiMsg, { silent: true });
                    
                    if (window.imData && window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(friend.id)) {
                        const activeContainer = document.querySelector('.active-chat-interface .ins-chat-messages');
                        if (activeContainer && window.imChat && window.imChat.appendMessageToContainer) {
                            window.imChat.appendMessageToContainer(window.imData.currentActiveFriend, activeContainer, newMsg);
                        }
                    }
                } catch(e) {
                    console.error('Failed to append gift message:', e);
                }
            }
            
            if (success) {
                if (window.showToast) window.showToast('Gift sent successfully.');
                else alert('Gift sent successfully.');
            } else {
                if (window.showToast) window.showToast('赠送失败');
                else alert('赠送失败');
            }
            
            return success;
        }

        loadOrders() {
            try {
                const saved = durableStorage.getItem('shopping_orders');
                if (saved) return JSON.parse(saved);
            } catch(e) {}
            return [];
        }

        saveOrders() {
            durableStorage.setItem('shopping_orders', JSON.stringify(this.orders));
        }

        async initCheckout() {
            // Retrieve cards from the new storage architecture
            let cards = [];
            if (typeof window.getPayCards === 'function') {
                cards = window.getPayCards();
            }
            if (!cards || cards.length === 0) {
                cards = [
                    { id: 'card1', name: '招商银行储蓄卡', number: '**** **** **** 8888', icon: 'fa-university' },
                    { id: 'card2', name: '工商银行信用卡', number: '**** **** **** 9999', icon: 'fa-credit-card' }
                ];
            }

            // Retrieve friends from iMessage storage
            let friends = [];
            if (window.imStorage && window.imStorage.loadFriends) {
                try {
                    friends = await window.imStorage.loadFriends();
                } catch(e) {}
            }
            
            if (!this.selectedCard && cards.length > 0) {
                this.selectedCard = cards[0];
            }
            // Ensure selected friend exists in current friends list, otherwise pick first
            if (friends.length > 0) {
                if (!this.selectedFriend || !friends.find(f => String(f.id) === String(this.selectedFriend.id))) {
                    this.selectedFriend = friends[0];
                }
            } else {
                this.selectedFriend = null;
            }

            if (this.payDesc && this.selectedCard) {
                this.payDesc.textContent = `${this.selectedCard.name} (${this.selectedCard.number.slice(-4)})`;
            }
            if (this.friendDesc) {
                this.friendDesc.textContent = this.selectedFriend ? (this.selectedFriend.name || this.selectedFriend.nickname || 'Unknown Char') : 'select friends';
            }
        }

        async openCardSelection() {
            if (!this.cardSelectionModal || !this.cardList) return;
            
            this.cardList.innerHTML = '';
            
            let cards = [];
            let balance = 0;
            if (typeof window.getPayCards === 'function') {
                cards = window.getPayCards();
            }
            if (typeof window.getPayBalance === 'function') {
                balance = window.getPayBalance();
            }
            
            if (!cards || cards.length === 0) {
                cards = [
                    { id: 'card1', name: '招商银行储蓄卡', number: '**** **** **** 8888', icon: 'fa-university' },
                    { id: 'card2', name: '工商银行信用卡', number: '**** **** **** 9999', icon: 'fa-credit-card' }
                ];
            }

            if (this.cardBalance) {
                this.cardBalance.textContent = `¥${balance.toFixed(2)}`;
            }

            cards.forEach(card => {
                const el = document.createElement('div');
                el.style.cssText = 'background: rgba(255, 255, 255, 0.82); border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; border: 1px solid rgba(17,17,17,0.09); ';
                
                const isSelected = this.selectedCard && String(this.selectedCard.id) === String(card.id);
                
                el.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(17,17,17,0.06); display: flex; justify-content: center; align-items: center; color: #111;">
                            <i class="fas ${card.icon || 'fa-credit-card'}"></i>
                        </div>
                        <div style="display: flex; flex-direction: column;">
                            <div style="font-size: 15px; font-weight: 700; color: #111;">${card.name}</div>
                            <div style="font-size: 13px; color: #73706a; font-family: monospace;">${card.number}</div>
                        </div>
                    </div>
                    ${isSelected ? '<i class="fas fa-check-circle" style="color: #a97642; font-size: 20px;"></i>' : '<div style="width: 20px; height: 20px; border-radius: 50%; border: 1px solid rgba(17,17,17,0.15);"></div>'}
                `;
                
                el.addEventListener('click', () => {
                    this.selectedCard = card;
                    if (this.payDesc) {
                        this.payDesc.textContent = `${this.selectedCard.name} (${this.selectedCard.number.slice(-4)})`;
                    }
                    this.cardSelectionModal.style.display = 'none';
                    this.cardSelectionModal.classList.remove('active');
                });
                
                this.cardList.appendChild(el);
            });
            
            this.cardSelectionModal.style.display = 'flex';
            requestAnimationFrame(() => {
                this.cardSelectionModal.classList.add('active');
            });
        }

        async openCharSelection() {
            if (!this.charSelectionModal || !this.charList) return;
            
            this.charList.innerHTML = '';
            
            let friends = [];
            if (window.imStorage && window.imStorage.loadFriends) {
                try {
                    friends = await window.imStorage.loadFriends();
                } catch(e) {}
            }
            
            if (friends.length === 0) {
                this.charList.innerHTML = '<div style="text-align: center; padding: 20px; color: #73706a;">no friends yet</div>';
            } else {
                friends.forEach(friend => {
                    const el = document.createElement('div');
                    el.style.cssText = 'background: rgba(255, 255, 255, 0.82); border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; border: 1px solid rgba(17,17,17,0.09); ';
                    
                    const isSelected = this.selectedFriend && String(this.selectedFriend.id) === String(friend.id);
                    const name = friend.name || friend.nickname || 'Unknown Char';
                    let avatarHtml = `<div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(17,17,17,0.06); display: flex; justify-content: center; align-items: center; color: #73706a;"><i class="fas fa-user"></i></div>`;
                    if (friend.avatar) {
                        avatarHtml = `<img src="${friend.avatar}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(17,17,17,0.09);">`;
                    }
                    
                    el.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 12px;">
                            ${avatarHtml}
                            <div style="display: flex; flex-direction: column;">
                                <div style="font-size: 15px; font-weight: 700; color: #111;">${name}</div>
                                <div style="font-size: 13px; color: #73706a; max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${friend.signature || ''}</div>
                            </div>
                        </div>
                        ${isSelected ? '<i class="fas fa-check-circle" style="color: #a97642; font-size: 20px;"></i>' : '<div style="width: 20px; height: 20px; border-radius: 50%; border: 1px solid rgba(17,17,17,0.15);"></div>'}
                    `;
                    
                    el.addEventListener('click', () => {
                        this.selectedFriend = friend;
                        if (this.friendDesc) {
                            this.friendDesc.textContent = name;
                        }
                        this.charSelectionModal.style.display = 'none';
                        this.charSelectionModal.classList.remove('active');
                    });
                    
                    this.charList.appendChild(el);
                });
            }
            
            this.charSelectionModal.style.display = 'flex';
            requestAnimationFrame(() => {
                this.charSelectionModal.classList.add('active');
            });
        }

        async processPayment() {
            const method = document.querySelector('input[name="shopping-payment-method"]:checked')?.value;
            let subtotal = 0;
            this.cart.forEach(item => subtotal += item.priceVal);
            const total = subtotal + 5; // +5 delivery
            
            const itemNames = this.cart.map(item => item.name).join(', ');

            if (method === 'pay') {
                if (!this.selectedCard) {
                    window.showToast ? window.showToast('请选择支付卡片') : alert('请选择支付卡片');
                    return;
                }
                
                const cardBalance = this.selectedCard.balance !== undefined ? this.selectedCard.balance : (typeof window.getPayBalance === 'function' ? window.getPayBalance() : 0);
                
                if (cardBalance >= total) {
                    let paymentSuccess = true;
                    if (typeof window.addPayTransaction === 'function') {
                        paymentSuccess = window.addPayTransaction(total, '购物消费', 'expense', this.selectedCard.id);
                    }
                    
                    if (paymentSuccess) {
                        // Save to orders
                        this.orders.unshift({
                            id: Date.now(),
                            timestamp: Date.now(),
                            date: new Date().toLocaleString(),
                            items: [...this.cart],
                            total: total,
                            status: '已付款',
                            method: this.selectedCard.type === 'family' ? `亲属卡 (${this.selectedCard.name})` : 'Pay'
                        });
                        this.saveOrders();
                        
                        this.cart = [];
                        this.saveCart();
                        this.renderCart();
                        this.checkoutSheet?.classList.remove('active');
                        window.showToast ? window.showToast('支付成功') : alert('支付成功');
                    } else {
                        window.showToast ? window.showToast('支付失败') : alert('支付失败');
                    }
                } else {
                    window.showToast ? window.showToast('余额不足') : alert('余额不足');
                }
            } else if (method === 'friend') {
                if (!this.selectedFriend) {
                    window.showToast ? window.showToast('请选择代付好友') : alert('请选择代付好友');
                    return;
                }
                
                const friendName = this.selectedFriend.name || this.selectedFriend.nickname || 'Unknown Char';
                
                // Construct fallback text message
                const msgText = `[代付请求]\n商品: ${itemNames}\n总价: ¥${total.toFixed(2)}`;
                
                // Construct HTML Card for modern pipeline
                const htmlCard = `
                    <div style="background: #f7f7f5; border-radius: 16px; padding: 16px; min-width: 220px; max-width: 280px; color: #111111;  border: 1px solid rgba(17,17,17,0.09); display: inline-block;">
                        <div style="font-size: 12px; color: #73706a; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; font-weight: 700;">
                            <i class="fas fa-bag-shopping" style="color: #a97642;"></i> Shop Request
                        </div>
                        <div style="font-size: 15px; font-weight: 700; margin-bottom: 6px; white-space: normal; word-break: break-word; line-height: 1.4;">${itemNames}</div>
                        <div style="font-size: 24px; font-weight: 800; color: #111111; margin-top: 14px; margin-bottom: 16px;">¥${total.toFixed(2)}</div>
                        <div style="background: #a97642; color: #ffffff; text-align: center; padding: 10px 0; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;">Pay Now</div>
                    </div>
                `;
                
                let success = false;
                
                if (window.imApp && window.imApp.appendFriendMessage) {
                    try {
                        // Crucial: ensure historical messages are loaded in memory so we append, not overwrite
                        if (window.imApp.ensureFriendMessagesLoaded) {
                            await window.imApp.ensureFriendMessagesLoaded(this.selectedFriend.id);
                        }

                        const newMsg = {
                            role: 'user',
                            type: 'html',
                            text: msgText,
                            content: htmlCard,
                            timestamp: Date.now()
                        };
                        
                        success = await window.imApp.appendFriendMessage(this.selectedFriend.id, newMsg, { silent: true });
                        
                        // Trigger render if this chat is currently active
                        if (success && window.imData && window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(this.selectedFriend.id)) {
                            const activeContainer = document.querySelector('.active-chat-interface .ins-chat-messages');
                            if (activeContainer && window.imChat && window.imChat.appendMessageToContainer) {
                                window.imChat.appendMessageToContainer(window.imData.currentActiveFriend, activeContainer, newMsg);
                            }
                        }
                    } catch(e) {
                        console.error('Failed to append shop request message:', e);
                    }
                }
                
                if (success) {
                    this.orders.unshift({
                        id: Date.now(),
                        timestamp: Date.now(),
                        date: new Date().toLocaleString(),
                        items: [...this.cart],
                        total: total,
                        status: '代付请求已发送',
                        method: `代付 (${friendName})`
                    });
                    this.saveOrders();
                    
                    this.cart = [];
                    this.saveCart();
                    this.renderCart();
                    this.checkoutSheet?.classList.remove('active');
                    window.showToast ? window.showToast('代付请求已发送') : alert('代付请求已发送');
                } else {
                    window.showToast ? window.showToast('无法发送代付请求') : alert('无法发送代付请求');
                }
            }
        }

        renderOrders() {
            if (!this.ordersList) return;
            this.ordersList.innerHTML = '';
            
            if (this.orders.length === 0) {
                this.ordersList.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; color: #8e8e93;">
                        <i class="fas fa-receipt" style="font-size: 40px; margin-bottom: 15px; opacity: 0.5;"></i>
                        <div style="font-size: 15px;">No Order History Yet</div>
                    </div>
                `;
                return;
            }

            this.orders.forEach((order, index) => {
                const el = document.createElement('div');
                el.style.cssText = 'background: #fff; border-radius: 16px; padding: 16px;  position: relative;';
                
                const itemNames = order.items.map(i => i.name).join(', ');
                let mediaHtml = '';
                order.items.slice(0, 3).forEach(item => {
                    mediaHtml += `<div style="width: 40px; height: 40px; border-radius: 8px; background: ${item.mediaBg}; display: flex; justify-content: center; align-items: center; color: #fff; font-size: 16px; flex-shrink: 0;">${item.iconHtml}</div>`;
                });
                if (order.items.length > 3) {
                    mediaHtml += `<div style="width: 40px; height: 40px; border-radius: 8px; background: #f2f2f7; display: flex; justify-content: center; align-items: center; color: #8e8e93; font-size: 12px; font-weight: 600; flex-shrink: 0;">+${order.items.length - 3}</div>`;
                }

                let displayStatus = order.status;

                const ts = order.timestamp || order.id; // fallback to id which is Date.now()
                const elapsed = (Date.now() - ts) / 1000;
                const isFood = order.items.some(i => i.isFood);
                
                const step1Text = isFood ? 'picked up' : 'shipped';
                const step2Text = isFood ? 'delivery' : 'in transit';
                const step3Text = 'delivered';

                const progress = Math.min(100, Math.max(0, (elapsed / 16) * 100));
                // Premium colors
                const cColor = isFood ? 'var(--shop-accent, #a97642)' : '#111111';
                const fColor = 'var(--shop-green, #476c5a)';
                const fGlow = isFood ? 'shopPulseGlow' : 'shopPulseGlowGreen';
                
                const s1Active = elapsed >= 0;
                const s2Active = elapsed >= 8;
                const s3Active = elapsed >= 16;

                const lineBg = s3Active ? fColor : cColor;
                
                // Add staggered animation delay
                const delay = index * 0.1;
                el.className = 'shopping-order-card';
                el.style.animationDelay = `${delay}s`;
                // Remove inline styles that clash with css classes
                el.style.cssText = `animation-delay: ${delay}s;`;
                
                el.innerHTML = `
                    <div class="shopping-order-header">
                        <div class="shopping-order-date">${order.date}</div>
                        <button class="shopping-order-delete-btn shopping-order-delete" data-index="${index}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="shopping-order-progress">
                        <div class="shopping-order-track"></div>
                        <div class="shopping-order-fill" style="width: calc(68% * ${progress / 100}); background: ${lineBg};"></div>
                        
                        <div class="shopping-order-nodes">
                            <!-- Node 1 -->
                            <div class="shopping-order-node">
                                <div class="shopping-order-icon-wrap" style="background: ${s1Active ? cColor : '#f2f2f7'}; ${s1Active && !s2Active ? `animation: ${fGlow} 2s infinite;` : ''}">
                                    <i class="fas fa-check" style="color: ${s1Active ? '#fff' : '#c7c7cc'};"></i>
                                </div>
                                <div class="shopping-order-node-text" style="color: ${s1Active ? '#111' : '#8e8e93'}; font-weight: ${s1Active ? '700' : '600'};">${step1Text}</div>
                            </div>
                            <!-- Node 2 -->
                            <div class="shopping-order-node">
                                <div class="shopping-order-icon-wrap" style="background: ${s2Active ? cColor : '#f2f2f7'}; ${s2Active && !s3Active ? `animation: ${fGlow} 2s infinite;` : ''}">
                                    <i class="fas fa-motorcycle" style="color: ${s2Active ? '#fff' : '#c7c7cc'};"></i>
                                </div>
                                <div class="shopping-order-node-text" style="color: ${s2Active ? '#111' : '#8e8e93'}; font-weight: ${s2Active ? '700' : '600'};">${step2Text}</div>
                            </div>
                            <!-- Node 3 -->
                            <div class="shopping-order-node">
                                <div class="shopping-order-icon-wrap" style="background: ${s3Active ? fColor : '#f2f2f7'};">
                                    <i class="fas fa-home" style="color: ${s3Active ? '#fff' : '#c7c7cc'};"></i>
                                </div>
                                <div class="shopping-order-node-text" style="color: ${s3Active ? '#111' : '#8e8e93'}; font-weight: ${s3Active ? '700' : '600'};">${step3Text}</div>
                            </div>
                        </div>
                    </div>

                    <div class="shopping-order-item-inline-wrap">
                        <div class="shopping-order-items-scroll inline-mode">
                            ${order.items.map(item => `
                                <div class="shopping-order-item-media" style="background: ${item.mediaBg};">
                                    ${item.iconHtml}
                                </div>
                            `).join('')}
                        </div>
                        <div class="shopping-order-title inline-mode">${itemNames}</div>
                    </div>
                    
                    <div class="shopping-order-footer">
                        <div class="shopping-order-method">${order.method}</div>
                        <div class="shopping-order-price-wrap">
                            <button class="shopping-order-gift-btn" data-index="${index}" style="margin-right: 8px; background: #ff9bb3; color: #fff; border: none; border-radius: 12px; padding: 6px 12px; font-size: 13px; font-weight: 600; cursor: pointer;">Gift</button>
                            <button class="shopping-order-comment-btn" data-product="${order.items.length > 0 ? order.items[0].name : ''}">Rate product</button>
                            <div class="shopping-order-price">¥${order.total.toFixed(2)}</div>
                        </div>
                    </div>
                `;

                const giftBtn = el.querySelector('.shopping-order-gift-btn');
                if (giftBtn) {
                    if (order.gifted) {
                        giftBtn.textContent = 'Gifted';
                        giftBtn.style.background = '#e5e5ea';
                        giftBtn.style.color = '#8e8e93';
                        giftBtn.style.cursor = 'default';
                    } else {
                        giftBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const idx = parseInt(giftBtn.dataset.index, 10);
                            const orderToGift = this.orders[idx];
                            this.openGiftCharSelection(orderToGift, idx);
                        });
                    }
                }

                const deleteBtn = el.querySelector('.shopping-order-delete-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const idx = parseInt(deleteBtn.dataset.index, 10);
                        this.orders.splice(idx, 1);
                        this.saveOrders();
                        this.renderOrders();
                    });
                }

                const commentBtn = el.querySelector('.shopping-order-comment-btn');
                if (commentBtn) {
                    commentBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const productName = commentBtn.dataset.product;
                        if (!productName) return;
                        
                        this.currentReviewProduct = productName;
                        if (!this.ratingSheet) this.initRatingSheet();
                        
                        // Reset form
                        this.ratingText.value = '';
                        if (this.ratingStars) {
                            Array.from(this.ratingStars).forEach(s => {
                                s.className = 'fas fa-star';
                                s.style.color = '#ff9500';
                            });
                        }
                        
                        this.ratingSheet.classList.add('active');
                    });
                }

                this.ordersList.appendChild(el);
            });
        }

        openDetail(product, isFood = false) {
            product.isFood = isFood;
            this.currentProduct = product;
            
            if (isFood) {
                if (this.foodDetailName) this.foodDetailName.textContent = product.name;
                if (this.foodDetailPrice) {
                    const val = product.price.replace('¥', '');
                    this.foodDetailPrice.innerHTML = `<span style="font-size: 16px;">¥</span>${val}`;
                }
                if (this.foodBottomPrice) this.foodBottomPrice.textContent = product.price;
                if (this.foodDetailDesc) this.foodDetailDesc.textContent = product.desc;
                if (this.foodDetailMedia) {
                    this.foodDetailMedia.innerHTML = product.iconHtml;
                    this.foodDetailMedia.style.background = product.mediaBg;
                }
                if (this.foodDetailSheet) {
                    this.foodDetailSheet.classList.add('active');
                }
            } else {
                if (this.detailName) this.detailName.textContent = product.name;
                if (this.detailPrice) this.detailPrice.textContent = product.price;
                if (this.detailDesc) this.detailDesc.textContent = product.desc;
                if (this.detailMedia) {
                    this.detailMedia.innerHTML = product.iconHtml;
                    this.detailMedia.style.background = product.mediaBg;
                }
                
                // Update QA Trigger Preview
                this.renderQA(product.name, false);

                if (this.detailSheet) {
                    this.detailSheet.classList.add('active');
                }
            }
            
            // Render comments for this product
            this.renderComments(product.name, isFood);
        }

        renderQA(productName, isFood) {
            const qaTrigger = document.getElementById('shopping-mall-qa-trigger');
            const qaContainer = document.getElementById('shopping-qa-container');
            const qaSheetTitle = document.getElementById('shopping-qa-sheet-title');
            
            if (!qaContainer) return;
            
            if (isFood) {
                if (qaTrigger) qaTrigger.style.display = 'none';
                return;
            } else {
                if (qaTrigger) qaTrigger.style.display = 'block';
            }

            let qaObj = {};
            try {
                const stored = durableStorage.getItem('shopping_qa');
                if (stored) qaObj = JSON.parse(stored);
            } catch(err) {}

            const qaList = qaObj[productName] || [];
            
            if (qaSheetTitle) qaSheetTitle.textContent = `Q&A (${qaList.length})`;
            
            if (qaTrigger) {
                qaTrigger.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div style="font-size: 16px; font-weight: 700; color: #111;">Q&A (${qaList.length})</div>
                        <div style="font-size: 13px; color: #111; font-weight: 600; display: flex; align-items: center;">See All <i class="fas fa-chevron-right" style="font-size: 10px; margin-left: 4px;"></i></div>
                    </div>
                `;
                
                if (qaList.length === 0) {
                    qaTrigger.innerHTML += '<div style="font-size: 14px; color: #8e8e93;">no answers yet</div>';
                } else {
                    const topQa = qaList.slice(0, 2);
                    topQa.forEach(qa => {
                        const randomAnswersCount = Math.floor(Math.random() * 5) + 1;
                        qaTrigger.innerHTML += `
                            <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
                                <span style="background: #111; color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-top: 2px;">Q</span>
                                <div style="flex: 1; font-size: 14px; color: #111; line-height: 1.4;">${qa.q}</div>
                                <div style="font-size: 12px; color: #8e8e93; white-space: nowrap;">${randomAnswersCount} answers</div>
                            </div>
                        `;
                    });
                }
            }
            
            qaContainer.innerHTML = '';
            if (qaList.length === 0) {
                qaContainer.innerHTML = '<div style="text-align: center; color: #8e8e93; font-size: 14px; padding: 20px 0;">No Answers Yet</div>';
            } else {
                qaList.forEach(qa => {
                    const el = document.createElement('div');
                    el.style.cssText = 'display: flex; flex-direction: column; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid rgba(17,17,17,0.05);';
                    el.innerHTML = `
                        <div style="display: flex; align-items: flex-start; gap: 8px;">
                            <span style="background: #111; color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-top: 2px;">Q</span>
                            <div style="font-size: 15px; font-weight: 600; color: #111; line-height: 1.4;">${qa.q}</div>
                        </div>
                        <div style="display: flex; align-items: flex-start; gap: 8px; margin-top: 4px;">
                            <span style="background: #e5e5ea; color: #8e8e93; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-top: 2px;">A</span>
                            <div style="font-size: 14px; color: #333; line-height: 1.5;">${qa.a}</div>
                        </div>
                    `;
                    qaContainer.appendChild(el);
                });
            }
        }

        renderComments(productName, isFood) {
            // Find the reviews container
            const sheet = isFood ? this.foodDetailSheet : this.detailSheet;
            if (!sheet) return;

            // hide old comment section
            const oldContainer = sheet.querySelector(isFood ? '#shopping-food-detail-comments' : '#shopping-detail-comments');
            if (oldContainer) {
                oldContainer.style.display = 'none';
            }

            // find the "Reviews (128)" or "DELIVERY REVIEW (458)" element
            let reviewsContainerList;
            let titleEl;
            if (isFood) {
                const allDivs = sheet.querySelectorAll('div');
                for (let div of allDivs) {
                    if (div.textContent.includes('DELIVERY REVIEW') && div.style.fontSize === '15px') {
                        titleEl = div;
                        reviewsContainerList = div.parentElement.lastElementChild;
                        break;
                    }
                }
            } else {
                const allDivs = sheet.querySelectorAll('div');
                for (let div of allDivs) {
                    if (div.textContent.includes('Reviews') && div.style.fontSize === '16px') {
                        titleEl = div;
                        reviewsContainerList = div.parentElement.lastElementChild;
                        break;
                    }
                }
            }

            if (!reviewsContainerList) return;

            let commentsObj = {};
            try {
                const stored = durableStorage.getItem('shopping_comments');
                if (stored) commentsObj = JSON.parse(stored);
            } catch(err) {}

            const comments = commentsObj[productName] || [];
            
            if (titleEl) {
                titleEl.textContent = isFood ? `DELIVERY REVIEW (${comments.length})` : `Reviews (${comments.length})`;
            }

            reviewsContainerList.innerHTML = '';

            if (comments.length === 0) {
                reviewsContainerList.innerHTML = '<div style="font-size: 14px; color: #8e8e93; text-align: center; padding: 10px 0;">No Reviews Yet</div>';
            }
        }

        initRatingSheet() {
            if (document.getElementById('shopping-rating-sheet')) return;

            const sheetHtml = `
            <div class="bottom-sheet-overlay detail-sheet-overlay" id="shopping-rating-sheet" style="z-index: 1200;">
                <div class="bottom-sheet" style="height: auto; max-height: 70%; padding-bottom: max(20px, env(safe-area-inset-bottom, 0px)); background: #ffffff;">
                    <div class="sheet-handle"></div>
                    <div class="sheet-title" id="shopping-rating-title">PRODUCT REVIEWS</div>
                    <div class="detail-sheet-content" style="padding: 16px;">
                        <div style="display: flex; justify-content: center; gap: 15px; margin-bottom: 24px;" id="shopping-rating-stars">
                            <i class="fas fa-star" data-val="1" style="font-size: 32px; color: #ff9500; cursor: pointer;"></i>
                            <i class="fas fa-star" data-val="2" style="font-size: 32px; color: #ff9500; cursor: pointer;"></i>
                            <i class="fas fa-star" data-val="3" style="font-size: 32px; color: #ff9500; cursor: pointer;"></i>
                            <i class="fas fa-star" data-val="4" style="font-size: 32px; color: #ff9500; cursor: pointer;"></i>
                            <i class="fas fa-star" data-val="5" style="font-size: 32px; color: #ff9500; cursor: pointer;"></i>
                        </div>
                        <textarea id="shopping-rating-text" placeholder="Florence à leur fenêtre et la mort sur la table. Si aujourd’hui me trouve si loin de tout, c’est que je n’ai d’autre force que d’aimer et d’admirer. " style="width: 100%; height: 120px; border: none; background: #f7f7f5; border-radius: 12px; padding: 16px; font-size: 15px; resize: none; outline: none; margin-bottom: 20px; box-sizing: border-box;"></textarea>
                        <button type="button" id="shopping-rating-submit" style="width: 100%; padding: 16px; background: #111; color: #fff; border-radius: 12px; font-size: 16px; font-weight: 700; border: none; cursor: pointer;">submit review</button>
                    </div>
                </div>
            </div>`;

            document.body.insertAdjacentHTML('beforeend', sheetHtml);

            this.ratingSheet = document.getElementById('shopping-rating-sheet');
            this.ratingStars = document.getElementById('shopping-rating-stars').children;
            this.ratingText = document.getElementById('shopping-rating-text');
            this.ratingSubmit = document.getElementById('shopping-rating-submit');

            let currentRating = 5;

            Array.from(this.ratingStars).forEach(star => {
                star.addEventListener('click', (e) => {
                    currentRating = parseInt(e.target.dataset.val, 10);
                    Array.from(this.ratingStars).forEach((s, idx) => {
                        if (idx < currentRating) {
                            s.className = 'fas fa-star';
                            s.style.color = '#ff9500';
                        } else {
                            s.className = 'far fa-star';
                            s.style.color = '#e5e5ea';
                        }
                    });
                });
            });

            this.ratingSubmit.addEventListener('click', () => {
                const text = this.ratingText.value.trim();
                if (!text) {
                    if (window.showToast) window.showToast('请输入评价内容');
                    else alert('请输入评价内容');
                    return;
                }

                if (!this.currentReviewProduct) return;

                let commentsObj = {};
                try {
                    const stored = durableStorage.getItem('shopping_comments');
                    if (stored) commentsObj = JSON.parse(stored);
                } catch(err) {}
                
                if (!commentsObj[this.currentReviewProduct]) {
                    commentsObj[this.currentReviewProduct] = [];
                }
                
                commentsObj[this.currentReviewProduct].unshift({
                    user: '我',
                    text: text,
                    rating: currentRating,
                    date: new Date().toLocaleDateString()
                });
                
                durableStorage.setItem('shopping_comments', JSON.stringify(commentsObj));
                
                if (window.showToast) window.showToast('Comment posted successfully.');
                else alert('Comment posted successfully.');
                
                this.ratingSheet.classList.remove('active');
                
                // Refresh if currently on that detail view
                if (this.currentProduct && this.currentProduct.name === this.currentReviewProduct) {
                    this.renderComments(this.currentReviewProduct, this.currentProduct.isFood);
                }
            });
            
            // Allow closing by clicking outside
            this.ratingSheet.addEventListener('click', (e) => {
                if(e.target === this.ratingSheet) {
                    this.ratingSheet.classList.remove('active');
                }
            });
        }

        openAllReviews(productName, isFood) {
            const sheet = document.getElementById('shopping-all-reviews-sheet');
            const container = document.getElementById('shopping-all-reviews-container');
            const titleEl = document.getElementById('shopping-all-reviews-sheet-title');
            
            if (!sheet || !container) return;

            let commentsObj = {};
            try {
                const stored = durableStorage.getItem('shopping_comments');
                if (stored) commentsObj = JSON.parse(stored);
            } catch(err) {}

            const comments = commentsObj[productName] || [];
            
            if (titleEl) {
                 titleEl.textContent = isFood ? `DELIVERY REVIEW (${comments.length})` : `Reviews (${comments.length})`;
            }

            container.innerHTML = '';

            if (comments.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: #8e8e93;">no reviews yet</div>';
            } else {
                comments.forEach(c => {
                    const cEl = document.createElement('div');
                    cEl.style.cssText = 'display: flex; gap: 12px; align-items: flex-start; padding-bottom: 12px; border-bottom: 1px solid rgba(17,17,17,0.05);';
                    
                    let starsHtml = '';
                    const stars = c.rating || 5;
                    for (let i = 0; i < 5; i++) {
                        if (i < stars) {
                            starsHtml += '<i class="fas fa-star" style="color: #ff9500; font-size: 10px;"></i>';
                        } else {
                            starsHtml += '<i class="far fa-star" style="color: #e5e5ea; font-size: 10px;"></i>';
                        }
                    }

                    cEl.innerHTML = `
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: #f2f2f7; display: flex; justify-content: center; align-items: center; font-size: 16px; color: #8e8e93; flex-shrink: 0;"><i class="fas fa-user"></i></div>
                        <div style="flex: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <div style="font-size: 15px; font-weight: 600; color: #111;">${c.user}</div>
                                <div style="font-size: 12px; color: #8e8e93;">${c.date}</div>
                            </div>
                            <div style="margin-bottom: 8px; display: flex; gap: 2px;">${starsHtml}</div>
                            <div style="font-size: 15px; color: #333; line-height: 1.5;">${c.text}</div>
                        </div>
                    `;
                    container.appendChild(cEl);
                });
            }

            sheet.classList.add('active');
        }

        closeDetail() {
            if (this.detailSheet) this.detailSheet.classList.remove('active');
            if (this.foodDetailSheet) this.foodDetailSheet.classList.remove('active');
        }

        loadCart() {
            try {
                const savedCart = durableStorage.getItem('shopping_cart');
                if (savedCart) {
                    return JSON.parse(savedCart);
                }
            } catch (e) {
                console.error('Failed to load cart from localStorage', e);
            }
            return [];
        }

        saveCart() {
            try {
                durableStorage.setItem('shopping_cart', JSON.stringify(this.cart));
            } catch (e) {
                console.error('Failed to save cart to localStorage', e);
            }
        }

        addToCart(product) {
            // Parse price
            const priceVal = parseFloat(product.price.replace('¥', '')) || 0;
            this.cart.push({
                ...product,
                priceVal: priceVal,
                id: Date.now()
            });
            this.saveCart();
            this.renderCart();
        }

        removeFromCart(index) {
            this.cart.splice(index, 1);
            this.saveCart();
            this.renderCart();
        }

        renderCart() {
            if (!this.cartEmptyState || !this.cartContent || !this.cartList) return;

            if (this.cart.length === 0) {
                this.cartEmptyState.style.display = 'flex';
                this.cartContent.style.display = 'none';
                return;
            }

            this.cartEmptyState.style.display = 'none';
            this.cartContent.style.display = 'flex';
            
            this.cartList.innerHTML = '';
            let subtotal = 0;

            this.cart.forEach((item, index) => {
                subtotal += item.priceVal;
                
                const itemEl = document.createElement('div');
                itemEl.style.display = 'flex';
                itemEl.style.alignItems = 'center';
                itemEl.style.gap = '15px';
                itemEl.style.padding = '10px';
                itemEl.style.background = '#fff';
                itemEl.style.borderRadius = '12px';
                itemEl.style.boxShadow = '0 2px 10px rgba(0,0,0,0.03)';
                
                itemEl.innerHTML = `
                    <div style="width: 50px; height: 50px; border-radius: 10px; background: ${item.mediaBg}; display: flex; justify-content: center; align-items: center; color: #fff; font-size: 20px;">
                        ${item.iconHtml}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 15px;">${item.name}</div>
                        <div style="color: #a97642; font-weight: 700; margin-top: 4px;">${item.price}</div>
                    </div>
                    <div class="shopping-cart-remove" style="width: 30px; height: 30px; border-radius: 50%; background: #ffebee; color: #ff3b30; display: flex; justify-content: center; align-items: center; cursor: pointer;">
                        <i class="fas fa-trash-alt" style="font-size: 12px;"></i>
                    </div>
                `;
                
                const removeBtn = itemEl.querySelector('.shopping-cart-remove');
                removeBtn.addEventListener('click', () => {
                    this.removeFromCart(index);
                });
                
                this.cartList.appendChild(itemEl);
            });

            if (this.cartSubtotal) this.cartSubtotal.textContent = `¥${subtotal.toFixed(2)}`;
            const deliveryFee = 5;
            if (this.cartTotal) this.cartTotal.textContent = `¥${(subtotal + deliveryFee).toFixed(2)}`;
        }

        open() {
            if (!this.view) return;
            this.view.style.display = 'flex';
            window.requestAnimationFrame(() => {
                this.view.classList.add('active');
                this.switchTab('food', { behavior: 'auto' });
            });
            document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f7f7f5');
        }

        close() {
            if (!this.view) return;
            this.view.classList.remove('active');
            window.setTimeout(() => {
                if (!this.view.classList.contains('active')) {
                    this.view.style.display = 'none';
                }
            }, 340);
            document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#ffffff');
        }

        switchTab(tab, options = {}) {
            const targetTab = this.tabs.includes(tab) ? tab : 'food';
            const shouldScroll = options.scroll !== false;
            this.currentTab = targetTab;

            this.navItems?.forEach((item) => {
                item.classList.toggle('active', item.dataset.tab === targetTab);
            });

            this.panels?.forEach((panel) => {
                panel.classList.toggle('active', panel.dataset.tab === targetTab);
            });

            if (shouldScroll && this.panelsWrap) {
                const index = this.tabs.indexOf(targetTab);
                this.panelsWrap.scrollTo({
                    left: index * this.panelsWrap.clientWidth,
                    behavior: options.behavior || 'smooth'
                });
            }

            this.updateIndicator();
        }

        updateIndicator() {
            if (!this.indicator || !this.navItems || !this.navItems.length) return;
            const activeItem = this.navItems.find((item) => item.dataset.tab === this.currentTab) || this.navItems[0];
            const nav = activeItem.closest('.shopping-bottom-nav');
            if (!nav) return;

            const navRect = nav.getBoundingClientRect();
            const itemRect = activeItem.getBoundingClientRect();
            const navStyle = window.getComputedStyle(nav);
            const inset = parseFloat(navStyle.paddingLeft) || 0;
            const offset = itemRect.left - navRect.left - inset;

            this.indicator.style.width = `${itemRect.width}px`;
            this.indicator.style.transform = `translateX(${offset}px)`;
        }
    }

    function initShoppingApp() {
        if (window.shoppingApp) return window.shoppingApp;
        window.shoppingApp = new ShoppingApp();
        const appBtn = document.getElementById('app-shopping-btn');
        if (appBtn) {
            appBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                if (window.isJiggleMode) return;
                window.shoppingApp?.open();
            });
        }
        return window.shoppingApp;
    }

    function initShoppingAppAfterStorageReady() {
        if (window.shoppingDataReadyPromise) return window.shoppingDataReadyPromise;
        const initialize = () => {
            initShoppingApp();
            return true;
        };

        if (window.globalDataReadyPromise && typeof window.globalDataReadyPromise.then === 'function') {
            window.shoppingDataReadyPromise = window.globalDataReadyPromise.then(initialize).catch((error) => {
                console.warn('Shopping global data recovery failed:', error);
                initialize();
                return false;
            });
        } else {
            initialize();
            window.shoppingDataReadyPromise = Promise.resolve(true);
        }
        return window.shoppingDataReadyPromise;
    }

    (window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(initShoppingAppAfterStorageReady);
})();
