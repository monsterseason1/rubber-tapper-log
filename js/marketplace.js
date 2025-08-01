// --- START OF FILE js/marketplace.js ---

/*
======================================
  Rubber Tapper's Log - marketplace.js
  Handles all logic for the Tree Marketplace.
======================================
*/

import { state, saveStateObject, saveStateItem } from './state.js';
import { gameData } from './gameDataService.js';
import * as dom from './dom.js';
import { showToast, hideTreeSelectionModal } from './ui.js'; // We might need more UI functions later
import { grantCoins } from './analysis.js';

let selectedTreeToSell = null;
let selectedTreeToSellIndex = -1;

/**
 * Initializes the marketplace screen, sets up listeners.
 */
export function initializeMarketplace() {
    setupMarketplaceListeners();
    renderMarketplace();
    // Default to the 'buy' tab
    switchMarketTab('buy');
}

/**
 * Main function to render both sections of the marketplace.
 */
function renderMarketplace() {
    renderBuyListings();
    renderMySellListings();
}

/**
 * Renders the "Buy" tab with AI-generated listings.
 */
function renderBuyListings() {
    if (!dom.marketplaceListingsGrid) return;
    dom.marketplaceListingsGrid.innerHTML = ''; // Clear existing listings

    // For now, we'll use a mock function to generate some listings
    const listings = generateAIMarketListings();

    if (listings.length === 0) {
        dom.marketplaceListingsGrid.innerHTML = `<p class="info-text">ยังไม่มีต้นยางวางขายในตลาดตอนนี้</p>`;
        return;
    }

    listings.forEach(listing => {
        const tree = listing.tree;
        const treeData = gameData.treeSpecies[tree.species];
        if (!treeData) return;

        const card = document.createElement('div');
        card.className = `tree-card rarity-${tree.rarity.toLowerCase()}`;
        
        const canAfford = state.userCoins >= listing.price;

        card.innerHTML = `
            <div class="tree-icon"><i data-lucide="${treeData.icon || 'trees'}"></i></div>
            <h4>${treeData.name}</h4>
            <p class="tree-level">Lvl ${tree.level}</p>
            <div class="tree-attributes-preview">
                ${Object.entries(tree.specialAttributes).slice(0, 2).map(([key, value]) => 
                    `<span><i data-lucide="${getIconForAttribute(key)}"></i> ${formatAttributeValue(key, value)}</span>`
                ).join('') || '<span>คุณสมบัติพื้นฐาน</span>'}
            </div>
            <button class="btn btn-primary btn-buy" data-listing-id="${listing.id}" ${canAfford ? '' : 'disabled'}>
                <i data-lucide="coins"></i> ${listing.price.toLocaleString()}
            </button>
        `;
        
        card.querySelector('.btn-buy').addEventListener('click', () => handleBuyTree(listing));
        dom.marketplaceListingsGrid.appendChild(card);
    });

    lucide.createIcons({ nodes: dom.marketplaceListingsGrid.querySelectorAll('i') });
}


/**
 * Renders the player's own listings in the "Sell" tab.
 */
function renderMySellListings() {
     if (!dom.myMarketplaceListings) return;
    dom.myMarketplaceListings.innerHTML = '';

    const myListings = state.marketplace.myListings || [];

    if (myListings.length === 0) {
        dom.myMarketplaceListings.innerHTML = `<p class="info-text">คุณยังไม่ได้ลงขายต้นยางเลย<br>ไปที่ "สวนของฉัน" เพื่อเลือกต้นไม้มาลงขาย!</p>`;
        return;
    }
    
    // Logic to display player's own listings would go here
    // For now, it's empty as we focus on the selling process first.
}


/**
 * Sets up all event listeners for the marketplace screen and modals.
 */
function setupMarketplaceListeners() {
    dom.marketTabs.forEach(tab => {
        tab.addEventListener('click', () => switchMarketTab(tab.dataset.tab));
    });

    // Sell Tree Modal Listeners
    dom.closeSellTreeModalBtn.addEventListener('click', hideSellTreeModal);
    dom.sellTreeModal.addEventListener('click', (event) => {
        if (event.target === dom.sellTreeModal) {
            hideSellTreeModal();
        }
    });
    dom.sellPriceInput.addEventListener('input', updateProfitCalculation);
    dom.confirmSellBtn.addEventListener('click', confirmSellListing);
}


/**
 * Handles switching between the "Buy" and "Sell" tabs.
 * @param {string} tabName - The name of the tab to switch to ('buy' or 'sell').
 */
function switchMarketTab(tabName) {
    dom.marketTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    dom.marketBuySection.classList.toggle('active', tabName === 'buy');
    dom.marketSellSection.classList.toggle('active', tabName === 'sell');
}

// --- Sell Logic ---

/**
 * Opens the sell modal for a specific tree from the plantation.
 * This function will be called from plantation.js (in a later step).
 * @param {object} tree The tree object to sell.
 * @param {number} index The original index of the tree in playerTrees.
 */
export function openSellTreeModal(tree, index) {
    if (!tree || index === -1) return;
    
    // Prevent selling active tree or non-grown trees
    if (state.activeTreeId === tree.treeId) {
        showToast({ title: 'ไม่สามารถขายต้นไม้ที่กำลังใช้งานอยู่ได้!', lucideIcon: 'alert-circle'});
        return;
    }
    if (tree.growthStage !== 'Grown') {
        showToast({ title: 'สามารถขายได้เฉพาะต้นไม้ที่โตเต็มวัย!', lucideIcon: 'alert-circle'});
        return;
    }

    selectedTreeToSell = tree;
    selectedTreeToSellIndex = index;
    
    const treeData = gameData.treeSpecies[tree.species];

    dom.sellTreeModalInfo.innerHTML = `
        <div class="tree-card small rarity-${tree.rarity.toLowerCase()}">
            <div class="tree-icon"><i data-lucide="${treeData.icon || 'trees'}"></i></div>
            <h4>${treeData.name}</h4>
            <p class="tree-level">Lvl ${tree.level}</p>
        </div>
    `;
    lucide.createIcons({nodes: dom.sellTreeModalInfo.querySelectorAll('i')});

    dom.sellPriceInput.value = '';
    updateProfitCalculation();
    dom.sellTreeModal.classList.remove('hidden');
}

/**
 * Hides the sell tree modal.
 */
function hideSellTreeModal() {
    dom.sellTreeModal.classList.add('hidden');
    selectedTreeToSell = null;
    selectedTreeToSellIndex = -1;
}

/**
 * Updates the profit calculation in the sell modal based on the input price.
 */
function updateProfitCalculation() {
    const price = parseInt(dom.sellPriceInput.value, 10) || 0;
    const feeRate = 0.05; // 5%
    const fee = Math.ceil(price * feeRate);
    const profit = price - fee;

    dom.listingFeeSpan.textContent = fee.toLocaleString();
    dom.profitSpan.textContent = profit.toLocaleString();
    
    dom.confirmSellBtn.disabled = (price <= 0 || profit <= 0);
}


/**
 * Finalizes the listing of a tree on the marketplace.
 */
function confirmSellListing() {
    if (!selectedTreeToSell) return;

    const price = parseInt(dom.sellPriceInput.value, 10);
    if (isNaN(price) || price <= 0) {
        showToast({ title: 'กรุณาตั้งราคาที่ถูกต้อง', lucideIcon: 'alert-circle' });
        return;
    }
    
    // Create the listing object
    const newListing = {
        id: `listing_${Date.now()}`,
        sellerId: 'player', // In a real multiplayer game, this would be a unique player ID
        tree: selectedTreeToSell,
        price: price,
        listedAt: Date.now()
    };
    
    // Add to state
    if (!state.marketplace) state.marketplace = { myListings: [] };
    if (!state.marketplace.myListings) state.marketplace.myListings = [];
    state.marketplace.myListings.push(newListing);
    saveStateObject('marketplace', state.marketplace);
    
    // Remove tree from player's inventory
    state.playerTrees.splice(selectedTreeToSellIndex, 1);
    saveStateObject('playerTrees', state.playerTrees);
    
    showToast({ title: 'ลงขายต้นยางสำเร็จ!', lucideIcon: 'tag', customClass: 'mission-complete' });
    hideSellTreeModal();
    
    // Refresh relevant UIs
    renderMySellListings();
    // We would need to re-render plantation if the user goes back
}


// --- Buy Logic (Mocked) ---

function handleBuyTree(listing) {
    if (state.userCoins < listing.price) {
        showToast({ title: 'เหรียญของคุณไม่เพียงพอ!', lucideIcon: 'alert-circle'});
        return;
    }

    if (confirm(`คุณต้องการซื้อ ${gameData.treeSpecies[listing.tree.species].name} ในราคา ${listing.price.toLocaleString()} เหรียญหรือไม่?`)) {
        // Deduct coins
        state.userCoins -= listing.price;
        saveStateItem('userCoins', state.userCoins);

        // Add tree to player's inventory (reset some properties)
        const purchasedTree = { ...listing.tree };
        purchasedTree.treeId = `tree_${Date.now()}_bought`; // Assign new unique ID
        purchasedTree.isNew = true; // Mark as new for notification system
        state.playerTrees.push(purchasedTree);
        saveStateObject('playerTrees', state.playerTrees);

        // Remove listing from the (mock) market
        // In a real system, you'd send a request to the server.
        // For now, we just re-render.
        
        showToast({ title: 'ซื้อต้นยางสำเร็จ!', lucideIcon: 'shopping-cart', customClass: 'mission-complete' });
        
        // Update UI
        renderMarketplace(); 
        dom.coinBalanceAmount.textContent = state.userCoins.toLocaleString();
    }
}


// --- Helper & Mock Functions ---

function getIconForAttribute(key) {
    const icons = { xpGain: 'sparkles', coinYield: 'dollar-sign', materialDropRate: 'package-search' };
    return icons[key] || 'help-circle';
}

function formatAttributeValue(key, value) {
    if (key.toLowerCase().includes('gain') || key.toLowerCase().includes('rate')) {
        return `+${(value * 100).toFixed(0)}%`;
    }
    return `+${value}`;
}


/**
 * MOCK FUNCTION: Generates fake AI listings for the marketplace.
 * In a real app, this would come from a server.
 */
function generateAIMarketListings() {
    // This is a simple mock. A better AI would generate more varied listings.
    return [
        {
            id: 'ai_listing_1',
            sellerId: 'ai_breeder_1',
            tree: {
                treeId: `tree_ai_1`, species: 'golden', rarity: 'Rare', level: 5, exp: 0, growthStage: 'Grown',
                specialAttributes: { coinYield: 0.15, xpGain: 0.05 },
            },
            price: 2500,
            listedAt: Date.now() - 3600000
        },
        {
            id: 'ai_listing_2',
            sellerId: 'ai_breeder_2',
            tree: {
                treeId: `tree_ai_2`, species: 'fastgrow', rarity: 'Uncommon', level: 8, exp: 0, growthStage: 'Grown',
                specialAttributes: { growthRate: 0.12 },
            },
            price: 1800,
            listedAt: Date.now() - 7200000
        },
        {
            id: 'ai_listing_3',
            sellerId: 'ai_breeder_1',
            tree: {
                treeId: `tree_ai_3`, species: 'highyield', rarity: 'Epic', level: 1, exp: 0, growthStage: 'Grown',
                specialAttributes: { coinYield: 0.28 },
            },
            price: 12000,
            listedAt: Date.now() - 120000
        }
    ];
}