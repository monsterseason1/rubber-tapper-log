// --- START OF FILE js/plantation.js ---

/*
======================================
  Rubber Tapper's Log - plantation.js
  Handles the logic for the player's tree plantation.
======================================
*/

import { state, saveStateObject, saveStateItem } from './state.js';
import { gameData } from './gameDataService.js';
import * as dom from './dom.js';
import { showScreen, showToast, formatTime, updateNotificationIndicators } from './ui.js';
import { applyUpgradeEffect } from './upgrades.js';
import { initializeBreedingScreen } from './breeding.js';
import { openSellTreeModal } from './marketplace.js';
import { checkActionMission } from './missions.js';

// --- State Variables for Plantation Screen ---
let selectedTreeInstance = null;
let selectedTreeIndex = -1;
let growthTimerInterval = null;
let gridTimers = {};

const treeInfoBackdrop = document.getElementById('tree-info-backdrop');


function clearGridTimers() {
    Object.values(gridTimers).forEach(clearInterval);
    gridTimers = {};
}

/**
 * Renders all the player's trees in the plantation grid.
 */
export function renderPlantation() {
    if (!dom.plantationGrid) return;
    dom.plantationGrid.innerHTML = '';
    clearGridTimers();

    handleCloseTreeInfo();

    const availableTrees = Array.isArray(state.playerTrees) ? state.playerTrees : [];

    if (availableTrees.length === 0) {
        dom.plantationGrid.innerHTML = `
            <div class="plantation-placeholder">
                <i data-lucide="sprout"></i>
                <p>ยังไม่มีต้นยางในสวนของคุณ ลองหาเมล็ดพันธุ์หรือรวมต้นยางดูสิ!</p>
                <button class="btn btn-primary" id="go-to-breeding-from-placeholder">ไปที่การรวมต้นยาง</button>
            </div>
        `;
        lucide.createIcons({ nodes: dom.plantationGrid.querySelectorAll('i') });
        const placeholderBtn = document.getElementById('go-to-breeding-from-placeholder');
        if(placeholderBtn) {
            placeholderBtn.addEventListener('click', () => {
                initializeBreedingScreen();
                showScreen(dom.breedingScreen);
            });
        }
        return;
    }

    availableTrees.forEach((tree, index) => {
        if (!tree || !tree.species) {
            console.warn('Skipping malformed tree object:', tree);
            return;
        }

        const treeData = gameData.treeSpecies[tree.species];
        if (!treeData) {
            console.warn(`Tree species data missing for species: ${tree.species}`);
            return;
        }

        const card = document.createElement('div');
        const growthStage = tree.growthStage || 'Grown';
        let stageClass = '';
        let stageText = '';
        let cardIcon = treeData.icon || 'trees';
        let infoHtml = '';

        switch (growthStage) {
            case 'Seed':
                stageClass = 'seed';
                stageText = 'เมล็ด';
                cardIcon = 'package';
                infoHtml = `<div class="tree-info-text ready-to-plant"><i data-lucide="shovel"></i><span>พร้อมปลูก</span></div>`;
                break;
            case 'Seedling':
                stageClass = 'seedling';
                stageText = 'ต้นกล้า';
                cardIcon = 'sprout';
                const countdownId = `countdown_${tree.treeId}`;
                infoHtml = `<div class="tree-info-text growth-countdown" id="${countdownId}"><i data-lucide="hourglass"></i><span>คำนวณ...</span></div>`;
                
                const updateCardCountdown = () => {
                    const countdownEl = document.getElementById(countdownId);
                    if (!countdownEl) {
                        clearInterval(gridTimers[tree.treeId]);
                        return;
                    }
                    const timeLeft = (tree.growsAtTimestamp || 0) - Date.now();
                    if (timeLeft <= 0) {
                        countdownEl.innerHTML = `<i data-lucide="sparkles"></i><span>พร้อมเติบโต!</span>`;
                        countdownEl.classList.add('ready-to-grow');
                        clearInterval(gridTimers[tree.treeId]);
                    } else {
                        countdownEl.querySelector('span').textContent = `${formatTime(timeLeft / 1000)}`;
                    }
                };
                
                if (gridTimers[tree.treeId]) clearInterval(gridTimers[tree.treeId]);
                updateCardCountdown();
                gridTimers[tree.treeId] = setInterval(updateCardCountdown, 1000);
                break;
            default: // Grown
                stageClass = `rarity-${tree.rarity.toLowerCase()}`;
                const currentExp = tree.exp || 0;
                const expForNext = getXpForNextLevelForTree(tree);
                const expPercentage = expForNext > 0 ? (currentExp / expForNext) * 100 : 100;
                infoHtml = `
                    <div class="tree-exp-bar-container">
                        <div class="tree-exp-bar" style="width: ${Math.min(expPercentage, 100)}%;"></div>
                    </div>
                    <p class="tree-exp-label">EXP: ${currentExp.toLocaleString()} / ${expForNext.toLocaleString()}</p>
                `;
        }
        
        const isActive = state.activeTreeId === tree.treeId;
        card.className = `tree-card ${stageClass} ${isActive ? 'active' : ''}`;
        card.dataset.treeIndex = index;

        const newItemIndicator = tree.isNew ? '<div class="new-item-indicator">ใหม่</div>' : '';
        const stageBadgeHtml = stageText ? `<div class="stage-badge ${stageClass}">${stageText}</div>` : '';

        card.innerHTML = `
            ${isActive ? '<div class="active-tree-indicator"><i data-lucide="power"></i><span>Active</span></div>' : ''}
            ${newItemIndicator}
            ${stageBadgeHtml}
            <div class="tree-icon"><i data-lucide="${cardIcon}"></i></div>
            <h4>${treeData.name}</h4>
            <p class="tree-level">${growthStage !== 'Grown' ? tree.rarity : `Lvl ${tree.level}`}</p>
            <div class="tree-card-footer">${infoHtml}</div>
        `;
        dom.plantationGrid.appendChild(card);
    });

    lucide.createIcons({ nodes: dom.plantationGrid.querySelectorAll('i') });

    dom.plantationGrid.querySelectorAll('.tree-card').forEach(el => {
        el.addEventListener('click', handleTreeCardClick);
    });
}

function handleTreeCardClick(event) {
    const card = event.target.closest('.tree-card');
    if (!card) return;
    const treeIndex = parseInt(card.dataset.treeIndex, 10);
    if (isNaN(treeIndex) || !state.playerTrees || treeIndex < 0 || treeIndex >= state.playerTrees.length) return;
    
    const tree = state.playerTrees[treeIndex];
    if (!tree) return;
    
    if (tree.isNew) {
        tree.isNew = false;
        saveStateObject('playerTrees', state.playerTrees);
        const indicator = card.querySelector('.new-item-indicator');
        if (indicator) {
            indicator.remove();
        }
        updateNotificationIndicators();
    }

    displayTreeInfo(tree, treeIndex);
}

function displayTreeInfo(tree, treeIndex) {
    const treeData = gameData.treeSpecies[tree.species];
    if (!treeData) return;

    selectedTreeInstance = { ...tree };
    selectedTreeIndex = treeIndex;
    
    if (growthTimerInterval) clearInterval(growthTimerInterval);

    const growthStage = tree.growthStage || 'Grown';
    let panelIcon = treeData.icon || 'trees';
    if (growthStage === 'Seed') panelIcon = 'package';
    if (growthStage === 'Seedling') panelIcon = 'sprout';

    const treeIconElement = dom.treeInfoPanel.querySelector('.tree-basic-info .tree-icon i');
    if (treeIconElement) {
        treeIconElement.setAttribute('data-lucide', panelIcon);
    }

    dom.selectedTreeName.textContent = treeData.name;
    dom.selectedTreeSpecies.textContent = tree.rarity || 'Common';
    dom.selectedTreeLevel.textContent = tree.level;
    dom.selectedTreeMaxLevel.textContent = treeData.maxLevel || 10;
    
    // --- START: Major Change - Simplified DOM manipulation ---
    const {
        treeGrownInfo, treePlantAction, seedPlantSection, seedlingCareSection,
        careActions, growTreeBtn
    } = dom;

    if (growthStage === 'Grown') {
        // Show the main container for grown tree info, hide the other
        treeGrownInfo.style.display = 'block';
        treePlantAction.style.display = 'none';

        // Update grown tree info
        const currentExp = tree.exp || 0;
        const expForNext = getXpForNextLevelForTree(tree);
        const expPercentage = expForNext > 0 ? (currentExp / expForNext) * 100 : 100;
        dom.treeExpBar.style.width = `${Math.min(expPercentage, 100)}%`;
        dom.selectedTreeExp.textContent = currentExp.toLocaleString();
        dom.selectedTreeExpNext.textContent = expForNext.toLocaleString();
    
        dom.treeAttributes.innerHTML = '';
        if (tree.specialAttributes && Object.keys(tree.specialAttributes).length > 0) {
            Object.entries(tree.specialAttributes).forEach(([attrKey, attrValue]) => {
                const li = document.createElement('li');
                li.innerHTML = `<i data-lucide="${getIconForAttribute(attrKey)}"></i> ${formatAttributeForDisplay(attrKey, attrValue)}`;
                dom.treeAttributes.appendChild(li);
            });
        } else {
            dom.treeAttributes.innerHTML = `<li><i data-lucide="minimize-2"></i> ไม่มีคุณสมบัติพิเศษ</li>`;
        }
        const requiredMaterials = getMaterialsNeededForUpgrade(tree);
        let canUpgrade = (tree.level < (treeData.maxLevel || 10));
        let materialsHtml = '';
        if (Object.keys(requiredMaterials).length > 0) {
            Object.entries(requiredMaterials).forEach(([matKey, matInfo]) => {
                const matData = gameData.treeMaterials[matKey];
                if (!matData) return;
                materialsHtml += `<li style="${matInfo.needed > matInfo.available ? 'color: var(--danger-color);' : ''}">
                    <i data-lucide="${matData.icon || 'hard-drive'}"></i> ${matData.name} (${matInfo.available} / ${matInfo.needed})
                </li>`;
                if (matInfo.needed > matInfo.available) canUpgrade = false;
            });
        }
        dom.treeMaterialsList.innerHTML = materialsHtml || '<li>ไม่ต้องการวัตถุดิบ</li>';
        dom.upgradeTreeBtn.disabled = !canUpgrade;
        const isActive = state.activeTreeId === tree.treeId;
        const anotherTreeIsActive = state.activeTreeId !== null && !isActive;
        if (isActive) {
            dom.activateTreeBtn.innerHTML = '<i data-lucide="power-off"></i> ปิดใช้งาน';
            dom.activateTreeBtn.classList.add('active');
            dom.activateTreeBtn.disabled = false;
            dom.activateTreeBtn.title = 'ปิดใช้งานโบนัสจากต้นไม้นี้';
        } else {
            dom.activateTreeBtn.innerHTML = '<i data-lucide="power"></i> เปิดใช้งาน';
            dom.activateTreeBtn.classList.remove('active');
            if (anotherTreeIsActive) {
                dom.activateTreeBtn.disabled = true;
                dom.activateTreeBtn.title = 'คุณต้องปิดใช้งานต้นไม้อื่นก่อน';
            } else {
                dom.activateTreeBtn.disabled = false;
                dom.activateTreeBtn.title = 'เปิดใช้งานเพื่อรับโบนัส';
            }
        }
    } else { // Seed or Seedling
        // Hide grown tree info, show the planting/caring container
        treeGrownInfo.style.display = 'none';
        treePlantAction.style.display = 'block';

        if (growthStage === 'Seed') {
            // Show only the seed planting section
            seedlingCareSection.style.display = 'none';
            seedPlantSection.style.display = 'block';
            dom.plantTreeBtn.disabled = false;
            dom.plantActionDescription.textContent = 'เริ่มต้นการปลูกเมล็ดพันธุ์นี้ให้กลายเป็นต้นกล้า';
        } else { // Seedling
            // Show only the seedling care section
            seedPlantSection.style.display = 'none';
            seedlingCareSection.style.display = 'block';
            
            const updateGrowthDisplay = () => {
                const timeLeft = (tree.growsAtTimestamp || 0) - Date.now();
                
                if (timeLeft <= 0) {
                    dom.growthCountdown.textContent = "พร้อมเติบโตเต็มวัย!";
                    careActions.style.display = 'none';
                    growTreeBtn.style.display = 'inline-flex';
                    if (growthTimerInterval) clearInterval(growthTimerInterval);
                    return;
                }
                
                careActions.style.display = 'grid';
                growTreeBtn.style.display = 'none';
                dom.growthCountdown.textContent = formatTime(timeLeft / 1000);

                const WATER_COOLDOWN_MS = 4 * 60 * 60 * 1000;
                const timeSinceWatered = Date.now() - (tree.lastWateredTimestamp || 0);
                dom.waterTreeBtn.disabled = timeSinceWatered < WATER_COOLDOWN_MS;
                dom.fertilizeTreeBtn.disabled = (state.materials?.fertilizer || 0) === 0;
            };
            
            updateGrowthDisplay();
            growthTimerInterval = setInterval(updateGrowthDisplay, 1000);
        }
    }
    // --- END: Major Change ---

    lucide.createIcons({ nodes: dom.treeInfoPanel.querySelectorAll('i') });
    dom.treeInfoPanel.classList.add('visible');
    if (treeInfoBackdrop) treeInfoBackdrop.classList.add('visible');
}

function getIconForAttribute(key) { switch(key) { case 'xpGain': return 'sparkles'; case 'coinYield': return 'dollar-sign'; case 'materialDropRate': return 'package-search'; default: return 'help-circle'; } }
function formatAttributeForDisplay(key, value) { let displayKey = key.replace(/([A-Z])/g, ' $1').trim(); displayKey = displayKey.charAt(0).toUpperCase() + displayKey.slice(1); let displayValue = value; if (typeof value === 'number') { if (key.toLowerCase().includes('percent') || key.toLowerCase().includes('rate') || key.toLowerCase().includes('gain')) { displayValue = `+${(value * 100).toFixed(1)}%`; } else if (key.toLowerCase().includes('yield') || key.toLowerCase().includes('bonus')) { displayValue = `+${value.toLocaleString()}`; } else { displayValue = value.toLocaleString(); } } return `${displayKey}: ${displayValue}`; }
function getXpForNextLevelForTree(tree) { const treeData = gameData.treeSpecies[tree.species]; if (!treeData) return 0; return Math.round((treeData.baseExpPerLevel || 10) * Math.pow(tree.level || 1, treeData.growthRate || 1.1)); }
export function getMaterialsNeededForUpgrade(tree) { const treeData = gameData.treeSpecies[tree.species]; const needed = {}; if (!treeData || tree.level >= (treeData.maxLevel || 10)) return needed; const baseMats = treeData.baseMaterialsNeeded || {}; const currentLevel = tree.level || 1; const rarityMultiplier = rarityToMultiplier(tree.rarity); const levelMultiplier = Math.pow(treeData.growthRate || 1.1, currentLevel); for (const matKey in baseMats) { const baseAmount = baseMats[matKey]; const neededAmount = Math.ceil(baseAmount * rarityMultiplier * levelMultiplier); needed[matKey] = { needed: neededAmount, available: state.materials?.[matKey] || 0 }; } return needed; }
function rarityToMultiplier(rarity) { switch(rarity) { case 'Common': return 1.0; case 'Uncommon': return 1.3; case 'Rare': return 1.8; case 'Epic': return 2.5; case 'Legendary': return 3.5; default: return 1.0; } }
function handleActivateTree() { if (!selectedTreeInstance) return; const currentTreeId = selectedTreeInstance.treeId; const isActive = state.activeTreeId === currentTreeId; if (isActive) { saveStateItem('activeTreeId', null); showToast({ title: 'ปิดใช้งานโบนัสต้นไม้แล้ว', lucideIcon: 'power-off' }); } else { saveStateItem('activeTreeId', currentTreeId); const treeData = gameData.treeSpecies[selectedTreeInstance.species]; showToast({ title: `เปิดใช้งานโบนัสจาก: ${treeData.name}!`, lucideIcon: 'power', customClass: 'mission-complete' }); } renderPlantation(); displayTreeInfo(state.playerTrees[selectedTreeIndex], selectedTreeIndex); }

function handleUpgradeTree() {
    if (!selectedTreeInstance || selectedTreeIndex === -1) return;
    const tree = selectedTreeInstance;
    const treeData = gameData.treeSpecies[tree.species];
    const materialsNeeded = getMaterialsNeededForUpgrade(tree);
    if (tree.level >= (treeData.maxLevel || 10)) {
        showToast({ title: 'อัปเกรดระดับสูงสุดแล้ว!', lucideIcon: 'check-circle' });
        return;
    }
    let canUpgrade = true;
    for (const matKey in materialsNeeded) {
        if (materialsNeeded[matKey].needed > materialsNeeded[matKey].available) {
            canUpgrade = false;
            break;
        }
    }
    if (!canUpgrade) {
        showToast({ title: 'วัตถุดิบไม่เพียงพอ!', lucideIcon: 'alert-circle' });
        return;
    }
    const updatedMaterials = { ...(state.materials || {}) };
    for (const matKey in materialsNeeded) {
        updatedMaterials[matKey] -= materialsNeeded[matKey].needed;
    }
    saveStateObject('materials', updatedMaterials);
    state.materials = updatedMaterials;
    const xpToGrant = getXpForNextLevelForTree(tree) / 2;
    const finalXpToGrant = applyUpgradeEffect('tree_xp_boost_percent', xpToGrant);
    state.playerTrees[selectedTreeIndex].exp = (state.playerTrees[selectedTreeIndex].exp || 0) + finalXpToGrant;
    let leveledUp = false;
    let treeXpNeeded = getXpForNextLevelForTree(state.playerTrees[selectedTreeIndex]);
    while (state.playerTrees[selectedTreeIndex].exp >= treeXpNeeded) {
        state.playerTrees[selectedTreeIndex].exp -= treeXpNeeded;
        state.playerTrees[selectedTreeIndex].level++;
        treeXpNeeded = getXpForNextLevelForTree(state.playerTrees[selectedTreeIndex]);
        leveledUp = true;
    }
    if(leveledUp) {
        showToast({ title: `ต้นยาง ${treeData.name} เลเวลอัพ!`, lucideIcon: 'arrow-up-circle' });
    }
    saveStateObject('playerTrees', state.playerTrees);
    
    checkActionMission('tree_upgraded');

    renderPlantation();
    selectedTreeInstance = { ...state.playerTrees[selectedTreeIndex] };
    displayTreeInfo(selectedTreeInstance, selectedTreeIndex);
    showToast({ title: `อัปเกรดต้นยาง ${treeData.name} สำเร็จ!`, lucideIcon: 'hammer', customClass: 'mission-complete' });
}

function handlePlantTree() {
    if (!selectedTreeInstance || selectedTreeIndex === -1 || selectedTreeInstance.growthStage !== 'Seed') return;
    
    const tree = state.playerTrees[selectedTreeIndex];
    const treeData = gameData.treeSpecies[tree.species];

    if (!treeData) {
        showToast({ title: 'ไม่พบข้อมูลสายพันธุ์ต้นไม้!', lucideIcon: 'alert-circle' });
        return;
    }

    tree.growthStage = 'Seedling';
    
    const growthHours = treeData.baseGrowthTimeHours || 8; 
    const growthDurationMs = growthHours * 60 * 60 * 1000;
    
    tree.growsAtTimestamp = Date.now() + growthDurationMs;
    tree.lastWateredTimestamp = 0;
    
    saveStateObject('playerTrees', state.playerTrees);
    showToast({ title: 'ปลูกเมล็ดสำเร็จ!', lucideIcon: 'sprout', customClass: 'mission-complete' });
    
    renderPlantation();
    displayTreeInfo(state.playerTrees[selectedTreeIndex], selectedTreeIndex);
}

function handleWaterTree() { if (!selectedTreeInstance || selectedTreeIndex === -1 || selectedTreeInstance.growthStage !== 'Seedling') return; const tree = state.playerTrees[selectedTreeIndex]; const TIME_REDUCTION_MS = 1 * 60 * 60 * 1000; tree.growsAtTimestamp -= TIME_REDUCTION_MS; tree.lastWateredTimestamp = Date.now(); saveStateObject('playerTrees', state.playerTrees); showToast({ title: 'รดน้ำสำเร็จ! ลดเวลาโต 1 ชั่วโมง', lucideIcon: 'cloud-drizzle' }); displayTreeInfo(state.playerTrees[selectedTreeIndex], selectedTreeIndex); }
function handleFertilizeTree() { if (!selectedTreeInstance || selectedTreeIndex === -1 || selectedTreeInstance.growthStage !== 'Seedling') return; if ((state.materials?.fertilizer || 0) < 1) { showToast({ title: 'ปุ๋ยไม่เพียงพอ!', lucideIcon: 'x-circle' }); return; } const tree = state.playerTrees[selectedTreeIndex]; const TIME_REDUCTION_MS = 30 * 60 * 1000; state.materials.fertilizer -= 1; tree.growsAtTimestamp -= TIME_REDUCTION_MS; saveStateObject('playerTrees', state.playerTrees); saveStateObject('materials', state.materials); showToast({ title: 'ใช้ปุ๋ยสำเร็จ! ลดเวลาโต 30 นาที', lucideIcon: 'leaf' }); displayTreeInfo(state.playerTrees[selectedTreeIndex], selectedTreeIndex); }
function handleGrowTree() { if (!selectedTreeInstance || selectedTreeIndex === -1 || selectedTreeInstance.growthStage !== 'Seedling') return; const tree = state.playerTrees[selectedTreeIndex]; const timeLeft = (tree.growsAtTimestamp || 0) - Date.now(); if (timeLeft > 0) { showToast({ title: 'ต้นยังไม่พร้อมเติบโต!', lucideIcon: 'hourglass' }); return; } tree.growthStage = 'Grown'; delete tree.growsAtTimestamp; delete tree.lastWateredTimestamp; saveStateObject('playerTrees', state.playerTrees); showToast({ title: `ต้นกล้า ${gameData.treeSpecies[tree.species].name} โตเต็มวัยแล้ว!`, lucideIcon: 'trees', customClass: 'mission-complete' }); renderPlantation(); displayTreeInfo(state.playerTrees[selectedTreeIndex], selectedTreeIndex); }

export function handleCloseTreeInfo() {
    if (growthTimerInterval) clearInterval(growthTimerInterval);
    growthTimerInterval = null;
    dom.treeInfoPanel.classList.remove('visible');
    if (treeInfoBackdrop) treeInfoBackdrop.classList.remove('visible');
    setTimeout(() => {
        selectedTreeInstance = null;
        selectedTreeIndex = -1;
    }, 300);
}

document.addEventListener('DOMContentLoaded', () => {
    if (dom.closeTreeInfoBtn) dom.closeTreeInfoBtn.addEventListener('click', handleCloseTreeInfo);
    if (treeInfoBackdrop) treeInfoBackdrop.addEventListener('click', handleCloseTreeInfo);
    if (dom.upgradeTreeBtn) dom.upgradeTreeBtn.addEventListener('click', handleUpgradeTree);
    if (dom.activateTreeBtn) dom.activateTreeBtn.addEventListener('click', handleActivateTree);
    if (dom.plantTreeBtn) dom.plantTreeBtn.addEventListener('click', handlePlantTree);
    if (dom.waterTreeBtn) dom.waterTreeBtn.addEventListener('click', handleWaterTree);
    if (dom.fertilizeTreeBtn) dom.fertilizeTreeBtn.addEventListener('click', handleFertilizeTree);
    if (dom.growTreeBtn) dom.growTreeBtn.addEventListener('click', handleGrowTree);

    if (dom.sellTreeBtn) {
        dom.sellTreeBtn.addEventListener('click', () => {
            if (selectedTreeInstance) {
                openSellTreeModal(selectedTreeInstance, selectedTreeIndex);
            }
        });
    }
});

export function checkAllTreeGrowth() {
    if (!state.playerTrees || !Array.isArray(state.playerTrees) || state.playerTrees.length === 0) return;
    let treesReadyToGrow = 0;
    state.playerTrees.forEach(tree => {
        if (tree && tree.growthStage === 'Seedling' && tree.growsAtTimestamp && Date.now() >= tree.growsAtTimestamp) {
            treesReadyToGrow++;
        }
    });
    if (treesReadyToGrow > 0) {
        showToast({ title: `มีต้นกล้า ${treesReadyToGrow} ต้น พร้อมที่จะโตแล้ว!`, lucideIcon: 'bell' });
    }
}