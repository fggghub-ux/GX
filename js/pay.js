(window.u2OnStorageReady || (callback => document.addEventListener('DOMContentLoaded', callback)))(() => {
    // --- State Management ---
    let currentCardId = 'bank_1'; // 默认选中第一张卡
    let currentFilter = 'all'; // 'all', 'income', 'expense'
    
    let cards = [
        {
            id: 'bank_1',
            type: 'bank',
            name: 'AMERICAN EXPRESS',
            icon: 'fas fa-university',
            cardType: '',
            number: '**** **** **** 9898',
            balance: 38,742.16,
            logo: '27',
            styleClass: '', // Default white card
            transactions: []
        },
        {
            id: 'bank_2',
            type: 'bank',
            name: 'J.P. Morgan',
            icon: 'fas fa-globe',
            cardType: 'Credit',
            number: '**** **** **** 8888',
            balance: 27,591.84,
            logo: 'VISA',
            styleClass: 'bank-card-blue',
            transactions: []
        }
    ];

    function getPayStoreSnapshot() {
        const raw = typeof window.getAppState === 'function' ? window.getAppState('pay') : null;
        return raw && typeof raw === 'object' ? raw : {};
    }

    function applyPaySnapshot(data = {}) {
        // Migrate old data if necessary, or load saved cards
        if (data.cards && Array.isArray(data.cards)) {
            cards = data.cards;
            if (data.currentCardId) {
                currentCardId = data.currentCardId;
            }
        } else {
            // Migration from old version
            if (data.transactions || data.balance !== undefined) {
                cards[0].transactions = Array.isArray(data.transactions) ? data.transactions : [];
                const nextBalance = parseFloat(data.balance);
                cards[0].balance = Number.isFinite(nextBalance) ? nextBalance : 1000.00;
            }
        }
        
        // Ensure currentCardId is valid
        if (!cards.find(c => c.id === currentCardId)) {
            currentCardId = cards[0].id;
        }
    }

    applyPaySnapshot(getPayStoreSnapshot());

    function getCurrentCard() {
        return cards.find(c => c.id === currentCardId) || cards[0];
    }

    function getPayBalance() {
        return getCurrentCard().balance;
    }

    window.getPayBalance = getPayBalance;
    window.getPayCards = function() {
        applyPaySnapshot(getPayStoreSnapshot()); // Always fetch latest from state
        return cards;
    };

    // Global API to add transactions (adds to current card or specified card)
    window.addPayTransaction = function(amount, title, type = 'income', targetCardId = null) {
        const safeAmount = Number(amount);
        if (!Number.isFinite(safeAmount) || safeAmount <= 0) return false;

        const targetCard = targetCardId 
            ? cards.find(c => c.id === targetCardId) || getCurrentCard()
            : getCurrentCard();

        if (type === 'income') {
            targetCard.balance += safeAmount;
        } else {
            targetCard.balance -= safeAmount;
        }

        const newTx = {
            id: Date.now(),
            title: title || '未知交易',
            amount: type === 'income' ? safeAmount : -safeAmount,
            time: Date.now(),
            icon: type === 'income' ? 'fa-arrow-down' : 'fa-shopping-bag',
            color: type === 'income' ? '#333' : '#666'
        };
        
        targetCard.transactions = targetCard.transactions || [];
        targetCard.transactions.unshift(newTx);
        savePayData();
        renderPayUI();

        if (window.showToast) {
            window.showToast(type === 'income' ? `Received $${safeAmount.toFixed(2)}` : `Payment $${safeAmount.toFixed(2)}`);
        }

        return true;
    };

    function savePayData() {
        if (typeof window.setAppState === 'function') {
            window.setAppState('pay', {
                cards: cards,
                currentCardId: currentCardId
            });
            return;
        }

        if (window.saveGlobalData) {
            window.saveGlobalData();
        }
    }

    // --- DOM Elements ---
    const payAppBtn = document.getElementById('app-pay-btn'); // 更新为包裹整个图标的父元素 ID
    const payView = document.getElementById('pay-view');
    const appContainer = document.getElementById('app');
    const payBackBtn = document.getElementById('pay-back-btn');
    
    // Tabs
    const filterBtns = document.querySelectorAll('.pay-filter-btn');
    
    // UI Elements
    const totalAmountEl = document.getElementById('pay-total-amount');
    const billListEl = document.getElementById('pay-bill-list');
    
    // Main Card Elements
    const mainCardEl = document.getElementById('pay-main-card');
    const mainCardTitleEl = document.getElementById('pay-main-card-title');
    const mainCardTypeEl = document.getElementById('pay-main-card-type');
    const mainCardNumberEl = document.getElementById('pay-main-card-number');
    const mainCardLogoEl = document.getElementById('pay-main-card-logo');

    // Modals
    const btnScan = document.getElementById('pay-action-scan');
    const scanModal = document.getElementById('pay-scan-modal');
    const scanClose = document.getElementById('pay-scan-close');
    
    const btnCards = document.getElementById('pay-action-cards');
    const cardsSheet = document.getElementById('pay-cards-sheet');
    const bankListEl = document.getElementById('pay-bank-list');
    
    const btnFamily = document.getElementById('pay-action-family');
    const familySheet = document.getElementById('pay-family-sheet');
    const familyListEl = document.getElementById('pay-family-list');
    const btnTransferIn = document.getElementById('pay-action-transfer-in');
    const transferInModal = document.getElementById('pay-transfer-in-modal');
    const transferInForm = document.getElementById('pay-transfer-in-form');
    const transferInAmountInput = document.getElementById('pay-transfer-in-amount');
    const transferInTargetEl = document.getElementById('pay-transfer-in-target');
    const transferInClose = document.getElementById('pay-transfer-in-close');
    const transferInCancel = document.getElementById('pay-transfer-in-cancel');
    let payUiRendered = false;

    // --- App Launch/Close ---
    // Launch logic is now handled in HTML via onclick, but we can hook into render here
    if (payAppBtn) {
        payAppBtn.addEventListener('click', () => {
            if (appContainer) {
                appContainer.scrollTop = 0;
                appContainer.scrollLeft = 0;
            }
            if (!payUiRendered) renderPayUI();
        });
    }

    if (payBackBtn && payView) {
        payBackBtn.addEventListener('click', () => {
            payView.classList.remove('active');
            setTimeout(() => {
                if (!payView.classList.contains('active')) payView.style.display = '';
            }, 220);
        });
    }

    // --- Filter Switching ---
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
            currentFilter = btn.getAttribute('data-filter');
            renderPayUI();
        });
    });

    filterBtns.forEach(btn => {
        btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
    });

    // --- Render Sheet Lists ---
    function renderSheetLists() {
        if (bankListEl) {
            bankListEl.innerHTML = '';
            const bankCards = cards.filter(c => c.type === 'bank');
            bankCards.forEach(c => {
                const el = document.createElement('div');
                el.className = `pay-bank-card ${c.styleClass || ''} ${c.id === currentCardId ? 'is-current' : ''}`;
                
                el.innerHTML = `
                    <div class="pay-bank-name"><i class="${c.icon}"></i> ${c.name}</div>
                    <div class="pay-bank-type">${c.cardType}</div>
                    <div class="pay-bank-number">${c.number}</div>
                    <div class="pay-bank-logo">${c.logo}</div>
                `;
                
                el.addEventListener('click', () => {
                    currentCardId = c.id;
                    savePayData();
                    renderPayUI();
                    if (window.closeView) window.closeView(cardsSheet);
                    else cardsSheet.classList.remove('active');
                });
                
                bankListEl.appendChild(el);
            });
        }
        
        if (familyListEl) {
            familyListEl.innerHTML = '';
            const familyCards = cards.filter(c => c.type === 'family');
            if (familyCards.length === 0) {
                familyListEl.innerHTML = '<div class="pay-empty-card-state">No Family Cards Yet</div>';
            } else {
                familyCards.forEach(c => {
                    const el = document.createElement('div');
                    el.className = `pay-bank-card family-sheet-card ${c.id === currentCardId ? 'is-current' : ''}`;
                    
                    el.innerHTML = `
                        <div class="pay-bank-name"><i class="${c.icon}"></i> ${c.name}</div>
                        <div class="pay-bank-type">${c.cardType}</div>
                        <div class="pay-bank-number">${c.number}</div>
                        <div class="pay-bank-logo">${c.logo}</div>
                    `;

                    const unbindBtn = document.createElement('button');
                    unbindBtn.type = 'button';
                    unbindBtn.className = 'pay-family-card-unbind';
                    unbindBtn.textContent = 'Unbind';
                    unbindBtn.setAttribute('aria-label', `Unbind${c.name}`);
                    unbindBtn.addEventListener('click', (event) => {
                        event.stopPropagation();
                        confirmRemoveFamilyCard(c);
                    });
                    el.appendChild(unbindBtn);
                    
                    el.addEventListener('click', () => {
                        currentCardId = c.id;
                        savePayData();
                        renderPayUI();
                        if (window.closeView) window.closeView(familySheet);
                        else familySheet.classList.remove('active');
                    });
                    
                    familyListEl.appendChild(el);
                });
            }
        }
    }

    // --- Rendering Logic ---
    function renderPayUI() {
        payUiRendered = true;
        const currentCard = getCurrentCard();
        
        // Render Main Card
        if (mainCardEl && currentCard) {
            mainCardEl.className = 'pay-total-card ' + (currentCard.styleClass || '');
            if (mainCardTitleEl) mainCardTitleEl.innerHTML = `<i class="${currentCard.icon}"></i> ${currentCard.name}`;
            if (mainCardTypeEl) mainCardTypeEl.textContent = currentCard.cardType;
            if (totalAmountEl) totalAmountEl.textContent = currentCard.balance.toFixed(2);
            if (mainCardNumberEl) mainCardNumberEl.textContent = currentCard.number;
            if (mainCardLogoEl) mainCardLogoEl.textContent = currentCard.logo;
        }
        
        renderSheetLists();

        // Filter Transactions
        let txs = currentCard.transactions || [];
        let filteredTxs = txs;
        if (currentFilter === 'income') {
            filteredTxs = txs.filter(tx => tx.amount > 0);
        } else if (currentFilter === 'expense') {
            filteredTxs = txs.filter(tx => tx.amount < 0);
        }

        // Render List
        if (billListEl) {
            billListEl.innerHTML = '';
            if (filteredTxs.length === 0) {
                billListEl.innerHTML = '<div class="pay-empty-state">No Transaction Yet</div>';
            } else {
                filteredTxs.forEach(tx => {
                    const el = document.createElement('div');
                    el.className = 'pay-bill-item';
                    
                    const date = new Date(tx.time);
                    const timeStr = `${date.getMonth()+1}-${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                    
                    const amountStr = (tx.amount > 0 ? '+' : '') + tx.amount.toFixed(2);
                    const amountClass = tx.amount > 0 ? 'pay-positive' : '';

                    el.innerHTML = `
                        <div class="pay-bill-icon">
                            <i class="fas ${tx.icon}"></i>
                        </div>
                        <div class="pay-bill-info">
                            <div class="pay-bill-title">${tx.title}</div>
                            <div class="pay-bill-time">${timeStr}</div>
                        </div>
                        <div class="pay-bill-amount ${amountClass}">${amountStr}</div>
                    `;
                    billListEl.appendChild(el);
                });
            }
        }
    }

    function refreshPayStateAfterHydration() {
        applyPaySnapshot(getPayStoreSnapshot());
        renderPayUI();
    }

    if (window.globalDataReadyPromise && typeof window.globalDataReadyPromise.then === 'function') {
        window.payDataReadyPromise = window.globalDataReadyPromise.then(() => {
            refreshPayStateAfterHydration();
            return true;
        }).catch((error) => {
            console.warn('Pay global data recovery failed:', error);
            return false;
        });
    } else {
        window.payDataReadyPromise = Promise.resolve(true);
    }

    // Family Card API
    window.addOrUpdateFamilyCard = function(friendId, friendName, amount) {
        const cardId = 'family_' + friendId;
        let existingCard = cards.find(c => c.id === cardId);
        const limit = Number(amount) || 0;

        if (existingCard) {
            existingCard.balance += limit;
            savePayData();
            if (typeof renderPayUI === 'function') renderPayUI();
            return { action: 'increase', newBalance: existingCard.balance };
        } else {
            const newCard = {
                id: cardId,
                type: 'family',
                name: 'Family - ' + (friendName || '好友'),
                icon: 'fas fa-heart',
                cardType: 'Family Card',
                number: '**** **** **** ' + Math.floor(1000 + Math.random() * 9000),
                balance: limit,
                logo: 'Pay',
                styleClass: 'family-card',
                transactions: []
            };
            cards.push(newCard);
            savePayData();
            if (typeof renderPayUI === 'function') renderPayUI();
            return { action: 'grant', newBalance: limit };
        }
    };

    window.hasFamilyCard = function(friendId) {
        return cards.some(c => c.id === 'family_' + friendId);
    };

    function removeFamilyCard(cardId) {
        const cardIndex = cards.findIndex(c => c.id === cardId && c.type === 'family');
        if (cardIndex < 0) return false;

        cards.splice(cardIndex, 1);
        if (!cards.some(c => c.id === currentCardId)) {
            currentCardId = cards.find(c => c.type === 'bank')?.id || cards[0]?.id || 'bank_1';
        }
        savePayData();
        renderPayUI();
        return true;
    }

    window.removeFamilyCard = removeFamilyCard;

    function confirmRemoveFamilyCard(card) {
        const doRemove = () => {
            if (!removeFamilyCard(card.id)) return;
            if (window.showToast) window.showToast('Family card unliked');
        };

        if (typeof window.showCustomModal === 'function') {
            window.showCustomModal({
                title: 'Unlink Family Card',
                message: `Unlinking will delete${card.name}，and cannot be undone.`,
                confirmText: 'unlink',
                cancelText: 'cancel',
                isDestructive: true,
                onConfirm: doRemove
            });
        } else if (window.confirm(`Unlinking will delete${card.name}，and cannot be undone.`)) {
            doRemove();
        }
    }

    function openTransferInModal() {
        const bankCards = cards.filter(card => card.type === 'bank');
        if (bankCards.length === 0 || !transferInModal) {
            if (window.showToast) window.showToast('No bank cards available for transfer');
            return;
        }

        const currentCard = getCurrentCard();
        const selectedBankCard = currentCard?.type === 'bank'
            ? currentCard
            : bankCards[0];
        if (transferInTargetEl) {
            transferInTargetEl.innerHTML = '';
            bankCards.forEach(card => {
                const option = document.createElement('option');
                option.value = card.id;
                option.textContent = `${card.name} ${card.number || ''}`.trim();
                option.selected = card.id === selectedBankCard.id;
                transferInTargetEl.appendChild(option);
            });
        }
        if (transferInAmountInput) transferInAmountInput.value = '';
        transferInModal.classList.add('active');
        transferInModal.setAttribute('aria-hidden', 'false');
        setTimeout(() => transferInAmountInput?.focus(), 80);
    }

    function closeTransferInModal() {
        if (!transferInModal) return;
        transferInModal.classList.remove('active');
        transferInModal.setAttribute('aria-hidden', 'true');
        if (transferInForm) transferInForm.reset();
    }

    // --- Modals Logic ---
    if (btnScan && scanModal) {
        btnScan.addEventListener('click', () => {
            scanModal.classList.add('active');
        });
    }

    if (scanClose && scanModal) {
        scanClose.addEventListener('click', () => {
            scanModal.classList.remove('active');
        });
    }

    if (btnTransferIn) {
        btnTransferIn.addEventListener('click', openTransferInModal);
    }

    if (transferInClose) {
        transferInClose.addEventListener('click', closeTransferInModal);
    }

    if (transferInCancel) {
        transferInCancel.addEventListener('click', closeTransferInModal);
    }

    if (transferInModal) {
        transferInModal.addEventListener('mousedown', (event) => {
            if (event.target === transferInModal) closeTransferInModal();
        });
    }

    if (transferInForm) {
        transferInForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const amount = Number(transferInAmountInput?.value);
            if (!Number.isFinite(amount) || amount <= 0) {
                if (window.showToast) window.showToast('Enter an amount greater than 0');
                transferInAmountInput?.focus();
                return;
            }

            const targetCardId = transferInTargetEl?.value;
            const targetCard = cards.find(card => card.id === targetCardId && card.type === 'bank');
            if (!targetCard) {
                if (window.showToast) window.showToast('Select Bank Card');
                return;
            }

            const success = window.addPayTransaction(amount, 'Transfer to Account', 'income', targetCard.id);
            if (!success) {
                if (window.showToast) window.showToast('转入失败，请重试');
                return;
            }
            closeTransferInModal();
        });
    }

    if (btnCards && cardsSheet) {
        btnCards.addEventListener('click', () => {
            renderSheetLists();
            if (window.openView) window.openView(cardsSheet);
            else cardsSheet.classList.add('active');
        });
    }

    if (cardsSheet) {
        cardsSheet.addEventListener('mousedown', (e) => {
            if (e.target === cardsSheet) {
                if (window.closeView) window.closeView(cardsSheet);
                else cardsSheet.classList.remove('active');
            }
        });
    }
    
    if (btnFamily && familySheet) {
        btnFamily.addEventListener('click', () => {
            renderSheetLists();
            if (window.openView) window.openView(familySheet);
            else familySheet.classList.add('active');
        });
    }

    if (familySheet) {
        familySheet.addEventListener('mousedown', (e) => {
            if (e.target === familySheet) {
                if (window.closeView) window.closeView(familySheet);
                else familySheet.classList.remove('active');
            }
        });
    }

});
