// --- START OF FILE upgrades.js ---

/*
======================================
  Rubber Tapper's Log - upgrades.js
  Contains all logic for the permanent upgrades system.
======================================
*/

import { state, saveStateObject } from './state.js';
import { gameData } from './gameDataService.js';
import * as dom from './dom.js';
import { showToast, updateUserCoinBalance, animateCoins } from './ui.js';

/**
 * Calculates the cost for the next level of a specific upgrade.
 * @param {string} upgradeId The ID of the upgrade (e.g., 'sharperKnife').
 * @returns {number} The cost in coins for the next level.
 */
export function getUpgradeCost(upgradeId) {
    const upgradeInfo = gameData.upgrades[upgradeId];
    if (!upgradeInfo) return Infinity;

    const currentLevel = state.upgrades[upgradeId]?.level || 0;
    if (currentLevel >= upgradeInfo.maxLevel) return Infinity;

    // Cost formula: baseCost * (multiplier ^ currentLevel)
    const cost = Math.floor(upgradeInfo.baseCost * Math.pow(upgradeInfo.costMultiplier, currentLevel));
    return cost;
}

/**
 * Handles the purchase of an upgrade.
 * @param {string} upgradeId The ID of the upgrade to purchase.
 */
export function purchaseUpgrade(upgradeId) {
    const upgradeInfo = gameData.upgrades[upgradeId];
    if (!upgradeInfo) return;

    const currentLevel = state.upgrades[upgradeId]?.level || 0;
    if (currentLevel >= upgradeInfo.maxLevel) {
        showToast({ title: 'อัปเกรดระดับสูงสุดแล้ว!', lucideIcon: 'check-circle' });
        return;
    }

    const cost = getUpgradeCost(upgradeId);
    if (state.userCoins < cost) {
        showToast({ title: 'เหรียญของคุณไม่เพียงพอ', lucideIcon: 'alert-circle' });
        return;
    }

    // Deduct coins and update state
    state.userCoins -= cost;
    state.upgrades[upgradeId].level++;

    // Save state
    saveStateObject('upgrades', state.upgrades);
    saveStateObject('userCoins', state.userCoins); // Use saveStateObject for coins to ensure state sync

    // Update UI
    const buttonElement = dom.upgradesList.querySelector(`[data-upgrade-id="${upgradeId}"] button`);
    if (buttonElement) {
        animateCoins(cost * -1, buttonElement);
    }
    updateUserCoinBalance();
    renderUpgrades(); // Re-render to show new level and cost

    showToast({ title: `อัปเกรด "${upgradeInfo.name}" สำเร็จ!`, lucideIcon: 'arrow-up-circle', customClass: 'mission-complete' });
}

/**
 * Renders all available upgrades on the upgrades screen.
 */
export function renderUpgrades() {
    if (!dom.upgradesList) return;
    dom.upgradesList.innerHTML = '';

    Object.keys(gameData.upgrades).forEach(upgradeId => {
        const upgradeInfo = gameData.upgrades[upgradeId];
        const currentLevel = state.upgrades[upgradeId]?.level || 0;
        const cost = getUpgradeCost(upgradeId);
        
        const isMaxLevel = currentLevel >= upgradeInfo.maxLevel;
        
        const card = document.createElement('div');
        card.className = `upgrade-card ${isMaxLevel ? 'maxed-out' : ''}`;
        card.dataset.upgradeId = upgradeId;

        let buttonHtml;
        if (isMaxLevel) {
            buttonHtml = `<button class="btn btn-success" disabled>สูงสุด</button>`;
        } else {
            buttonHtml = `<button class="btn btn-primary" ${state.userCoins < cost ? 'disabled' : ''}>
                            <i data-lucide="coins"></i> ${cost.toLocaleString()}
                          </button>`;
        }

        card.innerHTML = `
            <div class="upgrade-icon"><i data-lucide="${upgradeInfo.icon}"></i></div>
            <div class="upgrade-details">
                <h4>${upgradeInfo.name}</h4>
                <p>${upgradeInfo.description}</p>
            </div>
            <div class="upgrade-progress">
                <progress value="${currentLevel}" max="${upgradeInfo.maxLevel}"></progress>
                <span>เลเวล ${currentLevel}/${upgradeInfo.maxLevel}</span>
            </div>
            <div class="upgrade-action">
                ${buttonHtml}
            </div>
        `;
        
        dom.upgradesList.appendChild(card);
    });

    lucide.createIcons({ nodes: dom.upgradesList.querySelectorAll('i') });
}

/**
 * Applies the effect of a specific upgrade type.
 * This is a helper function to be called by other parts of the app.
 * @param {string} effectType The type of effect to calculate (e.g., 'xp_boost_percent').
 * @param {number} baseValue The initial value to be modified.
 * @returns {number} The value after applying the upgrade effect.
 */
export function applyUpgradeEffect(effectType, baseValue) {
    let modifiedValue = baseValue;

    for (const upgradeId in state.upgrades) {
        const upgradeInfo = gameData.upgrades[upgradeId];
        const userUpgrade = state.upgrades[upgradeId];

        if (upgradeInfo.effect.type === effectType && userUpgrade.level > 0) {
            const effectPerLevel = upgradeInfo.effect.baseValue;
            const totalEffect = effectPerLevel * userUpgrade.level;

            switch (effectType) {
                case 'xp_boost_percent':
                    modifiedValue *= (1 + totalEffect);
                    break;
                case 'speed_boost_percent': 
                    // Example: avgTime * (1 + (-0.005)) = avgTime * 0.995
                    modifiedValue *= (1 + totalEffect);
                    break;
                case 'record_bonus_flat':
                    modifiedValue += totalEffect;
                    break;
                // --- NEW: Add cases for Plantation and Breeding upgrades ---
                case 'material_drop_chance':
                    // This type of effect is a percentage increase on a chance.
                    // E.g., base 5% chance, upgrade gives +10%. New chance = 5% * (1 + 0.10) = 5.5%
                    // So we multiply the base chance by (1 + totalEffect)
                    modifiedValue *= (1 + totalEffect);
                    break;
                case 'fusion_success_chance':
                    // This can be a flat or percentage increase on the success rate of getting a rare tree
                    // For now, let's treat it as a flat bonus to a base chance
                    modifiedValue += totalEffect;
                    break;
                case 'tree_xp_boost_percent':
                    // Similar to player XP boost, but for trees
                    modifiedValue *= (1 + totalEffect);
                    break;
                // Add other effect types here in the future
            }
        }
    }

    return modifiedValue;
}