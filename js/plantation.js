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
import { showScreen, showToast, formatTime, updateNotificationIndicators, renderPlayerInventory } from './ui.js';
import { applyUpgradeEffect } from './upgrades.js';
import { initializeBreedingScreen } from './breeding.js';
import { openSellTreeModal } from './marketplace.js';
import { checkActionMission } from './missions.js';
import { getActiveTree } from './analysis.js';

// --- State Variables for Plantation Screen ---
let selectedTreeIndex = -1;
let growthTimerInterval = null;
let gridTimers = {};
let currentFilter = 'all';

const treeInfoBackdrop = document.getElementById('tree-info-backdrop');


function clearGridTimers() {
    Object.values(gridTimers).forEach(clearInterval);
    gridTimers = {};
}

/**
 * Renders all the player's trees in the plantation grid based on the current filter.
 */
export function renderPlantation() {
    if (!dom.plantationGrid) return;
    dom.plantationGrid.innerHTML = '';
    clearGridTimers();

    handleCloseTreeInfo();

    renderPlayerInventory(dom.playerInventoryListPlantation);

    const allTrees = Array.isArray(state.playerTrees) ? state.playerTrees : [];
    
    const filteredTrees = allTrees.filter(tree => {
        if (currentFilter === 'all') return true;
        const growthStage = tree.growthStage || 'Grown';
        if (currentFilter === 'grown' && growthStage === 'Grown') return true;
        if (currentFilter === 'seedling' && growthStage === 'Seedling') return true;
        if (currentFilter === 'seed' && growthStage === 'Seed') return true;
        return false;
    });


    if (filteredTrees.length === 0) {
        let emptyMessage = `
            <div class="plantation-placeholder">
                <i data-lucide="sprout"></i>`;
        if (currentFilter === 'all') {
            emptyMessage += `<p>ยังไม่มีต้นยางในสวนของคุณ ลองหาเมล็ดพันธุ์หรือรวมต้นยางดูสิ!</p>
                             <button class="btn btn-primary" id="go-to-breeding-from-placeholder">ไปที่การรวมต้นยาง</button>`;
        } else {
            emptyMessage += `<p>ไม่พบต้นไม้ประเภท "${getFilterDisplayName(currentFilter)}" ในสวนของคุณ</p>`;
        }
        emptyMessage += `</div>`;
        dom.plantationGrid.innerHTML = emptyMessage;
        
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

    filteredTrees.forEach((tree) => {
        if (!tree || !tree.species) {
            console.warn('Skipping malformed tree object:', tree);
            return;
        }

        const treeData = gameData.treeSpecies[tree.species];
        if (!treeData) {
            console.warn(`Tree species data missing for species: ${tree.species}`);
            return;
        }

        const originalIndex = allTrees.indexOf(tree);

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
        card.dataset.treeIndex = originalIndex;

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

function getFilterDisplayName(filterKey) {
    switch (filterKey) {
        case 'grown': return 'โตเต็มวัย';
        case 'seedling': return 'ต้นกล้า';
        case 'seed': return 'เมล็ด';
        default: return 'ทั้งหมด';
    }
}

function handleTreeCardClick(event) {
    const card = event.target.closest('.tree-card');
    if (!card) return;
    const treeIndex = parseInt(card.dataset.treeIndex, 10);
    if (isNaN(treeIndex) || !state.playerTrees || treeIndex < 0 || treeIndex >= state.playerTrees.length) return;
    
    // --- START: REFACTORED LOGIC ---
    // Pass only the index to displayTreeInfo
    const tree = state.playerTrees[treeIndex];
    if (tree && tree.isNew) {
        tree.isNew = false;
        saveStateObject('playerTrees', state.playerTrees);
        const indicator = card.querySelector('.new-item-indicator');
        if (indicator) indicator.remove();
        updateNotificationIndicators();
    }
    displayTreeInfo(treeIndex);
    // --- END: REFACTORED LOGIC ---
}

function setupTreeInfoPanelListeners() {
    const rebindButton = (buttonId, handler) => {
        const oldButton = document.getElementById(buttonId);
        if (oldButton) {
            const newButton = oldButton.cloneNode(true);
            oldButton.parentNode.replaceChild(newButton, oldButton);
            newButton.addEventListener('click', handler);
        }
    };

    rebindButton('upgrade-tree-btn', handleUpgradeTree);
    rebindButton('activate-tree-btn', handleActivateTree);
    rebindButton('plant-tree-btn', handlePlantTree);
    rebindButton('water-tree-btn', handleWaterTree);
    rebindButton('fertilize-tree-btn', handleFertilizeTree);
    rebindButton('use-growth-accelerant-btn', handleUseGrowthAccelerant);
    rebindButton('grow-tree-btn', handleGrowTree);
    
    const sellBtn = document.getElementById('sell-tree-btn');
    if (sellBtn) {
        const newSellBtn = sellBtn.cloneNode(true);
        sellBtn.parentNode.replaceChild(newSellBtn, sellBtn);
        newSellBtn.addEventListener('click', () => {
            if (selectedTreeIndex > -1) {
                const treeToSell = state.playerTrees[selectedTreeIndex];
                if (treeToSell) {
                    openSellTreeModal(treeToSell, selectedTreeIndex);
                }
            }
        });
    }
}

/**
 * --- START: REFACTORED FUNCTION ---
 * Displays the info panel for a tree based on its index in the state.
 * This function now ALWAYS fetches the latest data from the state.
 * @param {number} index The index of the tree in state.playerTrees.
 */
function displayTreeInfo(index) {
    // 1. Get the most up-to-date tree data from the state
    const tree = state.playerTrees[index];
    if (!tree) {
        console.error(`Tree at index ${index} not found.`);
        return;
    }

    const treeData = gameData.treeSpecies[tree.species];
    if (!treeData) return;

    // 2. Update the global index
    selectedTreeIndex = index;
    
    if (growthTimerInterval) clearInterval(growthTimerInterval);

    // 3. Render the UI using the fresh `tree` object
    const growthStage = tree.growthStage || 'Grown';
    let panelIcon = treeData.icon || 'trees';
    if (growthStage === 'Seed') panelIcon = 'package';
    if (growthStage === 'Seedling') panelIcon = 'sprout';

    const treeIconElement = dom.treeInfoPanel.querySelector('.tree-basic-info .tree-icon i');
    if (treeIconElement) treeIconElement.setAttribute('data-lucide', panelIcon);

    dom.selectedTreeName.textContent = treeData.name;
    dom.selectedTreeSpecies.textContent = tree.rarity || 'Common';
    dom.selectedTreeLevel.textContent = tree.level;
    dom.selectedTreeMaxLevel.textContent = treeData.maxLevel || 10;
    
    const {
        treeGrownInfo, treePlantAction, seedPlantSection, seedlingCareSection,
        careActions, growTreeBtn
    } = dom;

    if (growthStage === 'Grown') {
        treeGrownInfo.style.display = 'block';
        treePlantAction.style.display = 'none';

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

        const materialsNeeded = getMaterialsNeededForUpgrade(tree);
        let canUpgrade = (tree.level < (treeData.maxLevel || 10));
        let materialsHtml = '';
        
        if (Object.keys(materialsNeeded).length > 0) {
            Object.entries(materialsNeeded).forEach(([matKey, neededAmount]) => {
                const matData = gameData.treeMaterials[matKey];
                if (!matData) return;
                const availableAmount = state.materials?.[matKey] || 0;
                materialsHtml += `<li style="${neededAmount > availableAmount ? 'color: var(--danger-color);' : ''}">
                    <i data-lucide="${matData.icon || 'hard-drive'}"></i> ${matData.name} (${availableAmount} / ${neededAmount})
                </li>`;
                if (neededAmount > availableAmount) canUpgrade = false;
            });
        }
        dom.treeMaterialsList.innerHTML = materialsHtml || '<li>ไม่ต้องการวัตถุดิบ</li>';
        
        const upgradeBtn = document.getElementById('upgrade-tree-btn');
        if (upgradeBtn) upgradeBtn.disabled = !canUpgrade;

        const isActive = state.activeTreeId === tree.treeId;
        const activateBtn = document.getElementById('activate-tree-btn');
        if(activateBtn){
             if (isActive) {
                activateBtn.innerHTML = '<i data-lucide="power-off"></i> ปิดใช้งาน';
                activateBtn.classList.add('active');
            } else {
                activateBtn.innerHTML = '<i data-lucide="power"></i> เปิดใช้งาน';
                activateBtn.classList.remove('active');
            }
            activateBtn.disabled = false;
        }
       
    } else { // Seed or Seedling
        treeGrownInfo.style.display = 'none';
        treePlantAction.style.display = 'block';

        if (growthStage === 'Seed') {
            seedlingCareSection.style.display = 'none';
            seedPlantSection.style.display = 'block';
            const plantBtn = document.getElementById('plant-tree-btn');
            if (plantBtn) plantBtn.disabled = false;
            dom.plantActionDescription.textContent = treeData.description || 'เริ่มต้นการปลูกเมล็ดพันธุ์นี้ให้กลายเป็นต้นกล้า';
        } else { // Seedling
            seedPlantSection.style.display = 'none';
            seedlingCareSection.style.display = 'block';
            
            const updateGrowthDisplay = () => {
                const currentTreeState = state.playerTrees[index];
                if(!currentTreeState) {
                    if (growthTimerInterval) clearInterval(growthTimerInterval);
                    return;
                };

                const timeLeft = (currentTreeState.growsAtTimestamp || 0) - Date.now();
                
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
                const timeSinceWatered = Date.now() - (currentTreeState.lastWateredTimestamp || 0);
                document.getElementById('water-tree-btn').disabled = timeSinceWatered < WATER_COOLDOWN_MS;
                document.getElementById('fertilize-tree-btn').disabled = (state.materials?.fertilizer || 0) === 0;
                document.getElementById('use-growth-accelerant-btn').disabled = (state.materials?.growth_accelerant || 0) === 0;
            };
            
            updateGrowthDisplay();
            growthTimerInterval = setInterval(updateGrowthDisplay, 1000);
        }
    }

    // 4. Finalize UI and rebind listeners
    lucide.createIcons({ nodes: dom.treeInfoPanel.querySelectorAll('i') });
    dom.treeInfoPanel.classList.add('visible');
    if (treeInfoBackdrop) treeInfoBackdrop.classList.add('visible');
    
    setupTreeInfoPanelListeners();
}
// --- END: REFACTORED FUNCTION ---


function getIconForAttribute(key) { switch(key) { case 'xpGain': return 'sparkles'; case 'coinYield': return 'dollar-sign'; case 'materialDropRate': return 'package-search'; case 'growthRate': return 'timer'; default: return 'help-circle'; } }
function formatAttributeForDisplay(key, value) { let displayKey = key.replace(/([A-Z])/g, ' $1').trim(); displayKey = displayKey.charAt(0).toUpperCase() + displayKey.slice(1); let displayValue = value; if (typeof value === 'number') { if (key.toLowerCase().includes('percent') || key.toLowerCase().includes('rate') || key.toLowerCase().includes('gain')) { displayValue = `+${(value * 100).toFixed(1)}%`; } else if (key.toLowerCase().includes('yield') || key.toLowerCase().includes('bonus')) { displayValue = `+${value.toLocaleString()}`; } else { displayValue = value.toLocaleString(); } } return `${displayKey}: ${displayValue}`; }
function getXpForNextLevelForTree(tree) { const treeData = gameData.treeSpecies[tree.species]; if (!treeData) return 0; return Math.round((treeData.baseExpPerLevel || 10) * Math.pow(tree.level || 1, treeData.growthRate || 1.1)); }
export function getMaterialsNeededForUpgrade(tree) {
    const treeData = gameData.treeSpecies[tree.species];
    const needed = {};
    if (!treeData || tree.level >= (treeData.maxLevel || 10)) return needed;

    const baseMats = treeData.baseMaterialsNeeded || {};
    const currentLevel = tree.level || 1;
    const rarityMultiplier = rarityToMultiplier(tree.rarity);
    const levelMultiplier = Math.pow(treeData.growthRate || 1.1, currentLevel);

    for (const matKey in baseMats) {
        const baseAmount = baseMats[matKey];
        needed[matKey] = Math.ceil(baseAmount * rarityMultiplier * levelMultiplier);
    }
    return needed;
}
function rarityToMultiplier(rarity) { switch(rarity) { case 'Common': return 1.0; case 'Uncommon': return 1.3; case 'Rare': return 1.8; case 'Epic': return 2.5; case 'Legendary': return 3.5; default: return 1.0; } }

function handleActivateTree() {
    if (selectedTreeIndex === -1) return;
    const newTree = state.playerTrees[selectedTreeIndex];
    if (!newTree) return;

    const newTreeData = gameData.treeSpecies[newTree.species];
    const newTreeId = newTree.treeId;
    const currentActiveTreeId = state.activeTreeId;
    const isDeactivating = currentActiveTreeId === newTreeId;

    if (isDeactivating) {
        saveStateItem('activeTreeId', null);
        showToast({ title: 'ปิดใช้งานโบนัสต้นไม้แล้ว', lucideIcon: 'power-off' });
    } else {
        if (currentActiveTreeId !== null) {
            const currentActiveTree = state.playerTrees.find(t => t.treeId === currentActiveTreeId);
            const currentActiveTreeData = currentActiveTree ? gameData.treeSpecies[currentActiveTree.species] : { name: 'ต้นไม้ที่ไม่รู้จัก' };
            const confirmationMessage = `คุณมีต้น '${currentActiveTreeData.name}' ใช้งานอยู่แล้ว ต้องการสลับมาใช้โบนัสจากต้น '${newTreeData.name}' หรือไม่?`;

            if (confirm(confirmationMessage)) {
                saveStateItem('activeTreeId', newTreeId);
                showToast({ title: `สลับมาใช้งาน: ${newTreeData.name}!`, lucideIcon: 'power', customClass: 'mission-complete' });
            } else {
                return;
            }
        } else {
            saveStateItem('activeTreeId', newTreeId);
            showToast({ title: `เปิดใช้งานโบนัสจาก: ${newTreeData.name}!`, lucideIcon: 'power', customClass: 'mission-complete' });
        }
    }
    
    renderPlantation();
    displayTreeInfo(selectedTreeIndex);
}

function handleUpgradeTree() {
    if (selectedTreeIndex === -1) return;
    const tree = state.playerTrees[selectedTreeIndex];
    if (!tree) return;

    const treeData = gameData.treeSpecies[tree.species];
    if (tree.level >= (treeData.maxLevel || 10)) {
        showToast({ title: 'อัปเกรดระดับสูงสุดแล้ว!', lucideIcon: 'check-circle' });
        return;
    }

    const materialsNeeded = getMaterialsNeededForUpgrade(tree);
    let canUpgrade = true;
    for (const matKey in materialsNeeded) {
        const neededAmount = materialsNeeded[matKey];
        const availableAmount = state.materials[matKey] || 0;
        if (neededAmount > availableAmount) {
            canUpgrade = false;
            break;
        }
    }

    if (!canUpgrade) {
        showToast({ title: 'วัตถุดิบไม่เพียงพอ!', lucideIcon: 'alert-circle' });
        return;
    }

    for (const matKey in materialsNeeded) {
        state.materials[matKey] -= materialsNeeded[matKey];
    }
    saveStateObject('materials', state.materials);
    
    const xpToGrant = getXpForNextLevelForTree(tree) / 2;
    const finalXpToGrant = applyUpgradeEffect('tree_xp_boost_percent', xpToGrant);
    state.playerTrees[selectedTreeIndex].exp = (state.playerTrees[selectedTreeIndex].exp || 0) + Math.round(finalXpToGrant);
    let leveledUp = false;
    let treeXpNeeded = getXpForNextLevelForTree(state.playerTrees[selectedTreeIndex]);
    while (state.playerTrees[selectedTreeIndex].exp >= treeXpNeeded && state.playerTrees[selectedTreeIndex].level < (treeData.maxLevel || 10)) {
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
    renderPlayerInventory(dom.playerInventoryListPlantation);
    displayTreeInfo(selectedTreeIndex); // --- CHANGE: Refresh using only the index
    showToast({ title: `อัปเกรดต้นยาง ${treeData.name} สำเร็จ!`, lucideIcon: 'hammer', customClass: 'mission-complete' });
}

function handlePlantTree() {
    if (selectedTreeIndex === -1) return;
    const tree = state.playerTrees[selectedTreeIndex];
    if (!tree || tree.growthStage !== 'Seed') return;
    
    const treeData = gameData.treeSpecies[tree.species];
    if (!treeData) return;

    tree.growthStage = 'Seedling';
    let growthHours = treeData.baseGrowthTimeHours || 8; 
    const activeTree = getActiveTree();
    if (activeTree && activeTree.specialAttributes?.growthRate) {
        growthHours *= (1 - activeTree.specialAttributes.growthRate);
    }
    tree.growsAtTimestamp = Date.now() + (growthHours * 60 * 60 * 1000);
    tree.lastWateredTimestamp = 0;
    
    saveStateObject('playerTrees', state.playerTrees);
    showToast({ title: 'ปลูกเมล็ดสำเร็จ!', lucideIcon: 'sprout', customClass: 'mission-complete' });
    
    renderPlantation();
    displayTreeInfo(selectedTreeIndex);
}

function handleWaterTree() { if (selectedTreeIndex === -1) return; const tree = state.playerTrees[selectedTreeIndex]; if(!tree || tree.growthStage !== 'Seedling') return; const TIME_REDUCTION_MS = 1 * 60 * 60 * 1000; tree.growsAtTimestamp -= TIME_REDUCTION_MS; tree.lastWateredTimestamp = Date.now(); saveStateObject('playerTrees', state.playerTrees); showToast({ title: 'รดน้ำสำเร็จ! ลดเวลาโต 1 ชั่วโมง', lucideIcon: 'cloud-drizzle' }); displayTreeInfo(selectedTreeIndex); }
function handleFertilizeTree() { if (selectedTreeIndex === -1) return; const tree = state.playerTrees[selectedTreeIndex]; if(!tree || tree.growthStage !== 'Seedling') return; if ((state.materials?.fertilizer || 0) < 1) { showToast({ title: 'ปุ๋ยไม่เพียงพอ!', lucideIcon: 'x-circle' }); return; } const TIME_REDUCTION_MS = 30 * 60 * 1000; state.materials.fertilizer -= 1; tree.growsAtTimestamp -= TIME_REDUCTION_MS; saveStateObject('playerTrees', state.playerTrees); saveStateObject('materials', state.materials); showToast({ title: 'ใช้ปุ๋ยสำเร็จ! ลดเวลาโต 30 นาที', lucideIcon: 'leaf' }); displayTreeInfo(selectedTreeIndex); }
function handleUseGrowthAccelerant() { if (selectedTreeIndex === -1) return; const tree = state.playerTrees[selectedTreeIndex]; if(!tree || tree.growthStage !== 'Seedling') return; if ((state.materials?.growth_accelerant || 0) < 1) { showToast({ title: 'น้ำยาเร่งโตไม่เพียงพอ!', lucideIcon: 'x-circle' }); return; } const timeLeftMs = tree.growsAtTimestamp - Date.now(); if (timeLeftMs <= 0) return; const timeReductionMs = timeLeftMs * 0.25; state.materials.growth_accelerant -= 1; tree.growsAtTimestamp -= timeReductionMs; saveStateObject('playerTrees', state.playerTrees); saveStateObject('materials', state.materials); const hoursReduced = (timeReductionMs / (1000 * 60 * 60)).toFixed(1); showToast({ title: `ใช้น้ำยาเร่งโตสำเร็จ! ลดเวลาโตลง ${hoursReduced} ชั่วโมง`, lucideIcon: 'zap', customClass: 'mission-complete' }); displayTreeInfo(selectedTreeIndex); }
function handleGrowTree() { if (selectedTreeIndex === -1) return; const tree = state.playerTrees[selectedTreeIndex]; if(!tree || tree.growthStage !== 'Seedling') return; const timeLeft = (tree.growsAtTimestamp || 0) - Date.now(); if (timeLeft > 0) { showToast({ title: 'ต้นยังไม่พร้อมเติบโต!', lucideIcon: 'hourglass' }); return; } tree.growthStage = 'Grown'; delete tree.growsAtTimestamp; delete tree.lastWateredTimestamp; saveStateObject('playerTrees', state.playerTrees); showToast({ title: `ต้นกล้า ${gameData.treeSpecies[tree.species].name} โตเต็มวัยแล้ว!`, lucideIcon: 'trees', customClass: 'mission-complete' }); renderPlantation(); displayTreeInfo(selectedTreeIndex); }

export function handleCloseTreeInfo() {
    if (growthTimerInterval) clearInterval(growthTimerInterval);
    growthTimerInterval = null;
    dom.treeInfoPanel.classList.remove('visible');
    if (treeInfoBackdrop) treeInfoBackdrop.classList.remove('visible');
    setTimeout(() => {
        selectedTreeIndex = -1;
    }, 300);
}

function handleFilterClick(event) {
    const clickedButton = event.target.closest('button');
    if (!clickedButton) return;
    const filterValue = clickedButton.dataset.filter;
    if (filterValue === currentFilter) return;
    currentFilter = filterValue;
    dom.plantationFilterTabs.querySelectorAll('button').forEach(button => {
        button.classList.toggle('active', button.dataset.filter === currentFilter);
    });
    renderPlantation();
}

document.addEventListener('DOMContentLoaded', () => {
    if (dom.closeTreeInfoBtn) dom.closeTreeInfoBtn.addEventListener('click', handleCloseTreeInfo);
    if (treeInfoBackdrop) treeInfoBackdrop.addEventListener('click', handleCloseTreeInfo);
    if (dom.plantationFilterTabs) {
        dom.plantationFilterTabs.addEventListener('click', handleFilterClick);
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