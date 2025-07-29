// --- START OF FILE js/breeding.js ---

/*
======================================
  Rubber Tapper's Log - breeding.js
  Handles the logic for the tree fusion system ("รวมต้นยาง").
======================================
*/

import { state, saveStateObject } from './state.js';
import { gameData } from './gameDataService.js';
import * as dom from './dom.js';
import { showScreen, showToast } from './ui.js';
import { getMaterialsNeededForUpgrade, renderPlantation } from './plantation.js';
import { applyUpgradeEffect } from './upgrades.js';
import { grantXp } from './analysis.js';
import { checkActionMission } from './missions.js';
import { showTreeSelectionModal, hideTreeSelectionModal } from './ui.js';

let parentTree1 = null;
let parentTree2 = null;
let selectedParentTree1Index = -1;
let selectedParentTree2Index = -1;

/**
 * Initializes the breeding screen.
 */
export function initializeBreedingScreen() {
    resetBreedingState();
    // No need to render available trees here, as selection is handled via modal/placeholder
    renderBreedingRequirements();
    setupBreedingListeners();
}

/**
 * Resets the selection of parent trees and clears the result panel.
 */
function resetBreedingState(keepResultPanel = false) {
    parentTree1 = null;
    parentTree2 = null;
    selectedParentTree1Index = -1;
    selectedParentTree2Index = -1;
    
    if (!keepResultPanel && dom.breedingResultPanel) {
        dom.breedingResultPanel.classList.add('hidden');
    }

    // Guard Clause: Prevent crash if the main breeding slots element is not found
    if (!dom.breedingSlots) {
        console.error("Breeding slots container not found in DOM. Check if the element with id 'breeding-slots' exists.");
        return;
    }

    // Reset slot appearances
    const slots = dom.breedingSlots.querySelectorAll('.slot-content');
    slots.forEach((slot, slotIndex) => {
        slot.innerHTML = '<i data-lucide="sprout"></i><p>เลือกต้นยาง</p>';
        slot.classList.remove('selected');
        slot.dataset.slotIndex = slotIndex;
    });
    
    lucide.createIcons({ nodes: dom.breedingSlots.querySelectorAll('i') });
    updateBreedButtonState();
}

/**
 * Handles the click event on a breeding slot to select a parent tree.
 * @param {Event} event The click event.
 */
function handleSlotClick(event) {
    const slotElement = event.currentTarget;
    const slotIndex = parseInt(slotElement.dataset.slotIndex, 10);
    if (isNaN(slotIndex)) return;

    if (!state.playerTrees || state.playerTrees.length < 2) {
        showToast({ title: 'คุณต้องมีต้นยางอย่างน้อย 2 ต้นเพื่อรวม!', lucideIcon: 'alert-circle' });
        return;
    }

    const excludeIndex = (slotIndex === 0) ? selectedParentTree2Index : selectedParentTree1Index;

    const onTreeSelect = (selectedTree, selectedTreeIndex) => {
        // Filter to only allow fully grown trees to be selected for breeding
        if (selectedTree.growthStage && selectedTree.growthStage !== 'Grown') {
            showToast({ title: 'ต้องใช้ต้นไม้ที่โตเต็มวัยเท่านั้น!', lucideIcon: 'alert-circle' });
            return;
        }

        const treeData = gameData.treeSpecies[selectedTree.species];
        if (!treeData) return;

        slotElement.innerHTML = `
            <div class="tree-icon"><i data-lucide="${treeData.icon || 'tree'}"></i></div>
            <h4>${treeData.name} (Lvl ${selectedTree.level})</h4>
            <p>${selectedTree.rarity || 'Common'}</p>
        `;
        slotElement.classList.add('selected');
        lucide.createIcons({ nodes: slotElement.querySelectorAll('i') });

        if (slotIndex === 0) {
            parentTree1 = selectedTree;
            selectedParentTree1Index = selectedTreeIndex;
        } else {
            parentTree2 = selectedTree;
            selectedParentTree2Index = selectedTreeIndex;
        }

        renderBreedingRequirements();
        updateBreedButtonState();
    };

    showTreeSelectionModal(onTreeSelect, excludeIndex, (tree) => !tree.growthStage || tree.growthStage === 'Grown');
}

/**
 * Updates the state of the "Combine Trees" button.
 */
function updateBreedButtonState() {
    const allMaterialsAvailable = checkMaterialAvailability();
    if (dom.breedTreeBtn) {
        dom.breedTreeBtn.disabled = !(parentTree1 && parentTree2 && selectedParentTree1Index !== selectedParentTree2Index && allMaterialsAvailable);
    }
}

/**
 * Checks if the player has enough materials for the fusion.
 * @returns {boolean} True if materials are available.
 */
function checkMaterialAvailability() {
    if (!parentTree1 || !parentTree2) return false;

    const requiredMats = getFusionMaterials(parentTree1, parentTree2);
    for (const matKey in requiredMats) {
        if (requiredMats[matKey].needed > (state.materials?.[matKey] || 0)) {
            return false;
        }
    }
    return true;
}

/**
 * Gets the materials needed for breeding based on parent trees.
 * @param {object} tree1 Parent tree 1.
 * @param {object} tree2 Parent tree 2.
 * @returns {object} Object mapping material keys to { needed, available }.
 */
function getFusionMaterials(tree1, tree2) {
    const required = {};
    const rarityMultiplier1 = rarityToMultiplier(tree1.rarity);
    const rarityMultiplier2 = rarityToMultiplier(tree2.rarity);
    const levelMultiplier = (tree1.level + tree2.level) / 2;

    const baseCostMultiplier = gameData.fusionRules.materialCostMultiplier || 1.0;
    
    const fertilizerNeeded = Math.ceil(5 * ((rarityMultiplier1 + rarityMultiplier2) / 2) * baseCostMultiplier * (1 + levelMultiplier / 10));
    const sapNeeded = Math.ceil(2 * ((rarityMultiplier1 + rarityMultiplier2) / 2) * baseCostMultiplier * (1 + levelMultiplier / 10));

    required['fertilizer'] = { needed: fertilizerNeeded, available: state.materials?.fertilizer || 0 };
    required['special_sap'] = { needed: sapNeeded, available: state.materials?.special_sap || 0 };
    
    return required;
}

/**
 * Converts tree rarity to a numerical multiplier.
 * @param {string} rarity The rarity string.
 * @returns {number} The multiplier value.
 */
function rarityToMultiplier(rarity) {
    switch(rarity) {
        case 'Common': return 1.0;
        case 'Uncommon': return 1.3;
        case 'Rare': return 1.8;
        case 'Epic': return 2.5;
        case 'Legendary': return 3.5;
        default: return 1.0;
    }
}

/**
 * Renders the material requirements for the fusion.
 */
function renderBreedingRequirements() {
    const container = dom.materialForBreedingList;
    if (!container) return;

    if (!parentTree1 || !parentTree2) {
        container.innerHTML = '<p>เลือกต้นยาง 2 ต้นเพื่อดูวัตถุดิบที่ต้องใช้</p>';
        return;
    }

    const requiredMats = getFusionMaterials(parentTree1, parentTree2);
    let htmlContent = '<h5>วัตถุดิบสำหรับการรวมต้นยาง:</h5><ul>';

    if (Object.keys(requiredMats).length > 0) {
        Object.entries(requiredMats).forEach(([matKey, matInfo]) => {
            const matData = gameData.treeMaterials[matKey];
            if (!matData) return;

            const li = document.createElement('li');
            li.innerHTML = `<i data-lucide="${matData.icon || 'hard-drive'}"></i> ${matData.name} (${matInfo.available} / ${matInfo.needed})`;
            if (matInfo.needed > matInfo.available) {
                li.style.color = 'var(--danger-color)';
            }
            htmlContent += li.outerHTML;
        });
    } else {
        htmlContent += '<li>ไม่ต้องการวัตถุดิบเพิ่มเติม</li>';
    }
    htmlContent += '</ul>';
    container.innerHTML = htmlContent;
    
    lucide.createIcons({ nodes: container.querySelectorAll('i') });
}

/**
 * Handles the tree fusion action.
 */
function handleBreedTree() {
    if (!parentTree1 || !parentTree2 || selectedParentTree1Index === selectedParentTree2Index) {
        showToast({ title: 'กรุณาเลือกต้นยางที่แตกต่างกัน 2 ต้น', lucideIcon: 'alert-circle' });
        return;
    }

    if (!checkMaterialAvailability()) {
        showToast({ title: 'วัตถุดิบไม่เพียงพอ!', lucideIcon: 'alert-circle' });
        return;
    }
    
    const materialsNeeded = getFusionMaterials(parentTree1, parentTree2);
    const updatedMaterials = { ...(state.materials || {}) };
    for (const matKey in materialsNeeded) {
        updatedMaterials[matKey] -= materialsNeeded[matKey].needed;
    }
    saveStateObject('materials', updatedMaterials);

    const result = performFusion(parentTree1, parentTree2);

    // Remove parent trees from player's inventory
    // Sort indices descending to avoid shifting issues when splicing
    const indicesToRemove = [selectedParentTree1Index, selectedParentTree2Index].sort((a, b) => b - a);
    indicesToRemove.forEach(index => {
        state.playerTrees.splice(index, 1);
    });

    if (!state.playerTrees) state.playerTrees = [];
    state.playerTrees.push(result);
    saveStateObject('playerTrees', state.playerTrees);
    
    displayFusionResult(result);
    grantXp(50);
    // --- START: New Mission Check ---
    checkActionMission('fusion_performed');
    // --- END: New Mission Check ---

    showToast({ title: `รวมต้นยางสำเร็จ!`, lucideIcon: 'combine', customClass: 'mission-complete' });
    setTimeout(() => {
        resetBreedingState(true);
        renderBreedingRequirements();
        updateBreedButtonState(); // Ensure button state is correct after reset
    }, 500);
}

/**
 * Simulates the tree fusion process.
 * @param {object} tree1 Parent tree 1.
 * @param {object} tree2 Parent tree 2.
 * @returns {object} The resulting tree object.
 */
function performFusion(tree1, tree2) {
    let resultingSpecies = 'normal';
    let resultingRarity = 'Common';
    const speciesOrder = ['normal', 'golden', 'resilient', 'highyield', 'fastgrow'];
    const rarityOrder = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

    const species1Index = speciesOrder.indexOf(tree1.species);
    const species2Index = speciesOrder.indexOf(tree2.species);
    const higherSpeciesIndex = Math.max(species1Index, species2Index);
    resultingSpecies = (Math.random() < 0.7) ? speciesOrder[higherSpeciesIndex] : speciesOrder[Math.min(species1Index, species2Index)];
    if (speciesOrder.indexOf(resultingSpecies) === -1) resultingSpecies = 'normal';

    const rarity1Index = rarityOrder.indexOf(tree1.rarity);
    const rarity2Index = rarityOrder.indexOf(tree2.rarity);
    const avgRarityIndex = Math.floor((rarity1Index + rarity2Index) / 2);
    let rarityRoll = Math.random();
    if (tree1.rarity === tree2.rarity) rarityRoll *= 0.8;
    
    let newRarityIndex;
    if (rarityRoll < 0.3) newRarityIndex = Math.max(0, avgRarityIndex - 1);
    else if (rarityRoll < 0.8) newRarityIndex = avgRarityIndex;
    else newRarityIndex = Math.min(rarityOrder.length - 1, avgRarityIndex + 1);
    
    const baseSuccessChance = 0.8;
    const finalSuccessChance = applyUpgradeEffect('fusion_success_chance', baseSuccessChance);
    if (Math.random() > finalSuccessChance) {
        newRarityIndex = Math.max(0, newRarityIndex - 1);
    }
    
    resultingRarity = rarityOrder[newRarityIndex];

    const resultingLevel = 1; // New trees always start at level 1
    let resultingAttributes = {};
    const allAttributes = { ...tree1.specialAttributes, ...tree2.specialAttributes };
    Object.keys(allAttributes).forEach(attrKey => {
        if (Math.random() < (gameData.fusionRules.attributeInheritanceChance || 0.7)) {
            resultingAttributes[attrKey] = Math.max(allAttributes[attrKey], tree1.specialAttributes?.[attrKey] || 0, tree2.specialAttributes?.[attrKey] || 0);
        }
    });

    const newTreeId = `tree_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return {
        treeId: newTreeId,
        species: resultingSpecies,
        rarity: resultingRarity,
        level: resultingLevel,
        exp: 0,
        growthStage: 'Seed', 
        specialAttributes: resultingAttributes,
        isNew: true, // --- START: This is the new change ---
    };
}

/**
 * Displays the result of the tree fusion.
 * @param {object} result The resulting tree object.
 */
function displayFusionResult(result) {
    if (!dom.breedingResultPanel || !result) return;
    const treeData = gameData.treeSpecies[result.species];
    dom.bredTreeSpecies.textContent = `${treeData.name} (${result.rarity})`;
    
    const attributesText = Object.entries(result.specialAttributes)
        .map(([key, value]) => formatAttributeForDisplay(key, value))
        .join(', ');
    
    dom.bredTreeAttributes.innerHTML = attributesText || '<em>ไม่มีคุณสมบัติพิเศษ</em>';
    
    dom.breedingResultPanel.classList.remove('hidden');
    if (state.animationEffectsEnabled) {
        dom.breedingResultPanel.classList.add('anim-reveal');
        setTimeout(() => {
            dom.breedingResultPanel.classList.remove('anim-reveal');
        }, 600);
    }
}

/**
 * Formats an attribute for display.
 * @param {string} key The attribute key.
 * @param {any} value The attribute value.
 * @returns {string} Formatted string.
 */
function formatAttributeForDisplay(key, value) {
    let displayKey = key.replace(/([A-Z])/g, ' $1').trim();
    displayKey = displayKey.charAt(0).toUpperCase() + displayKey.slice(1);
    let displayValue = value;
    if (typeof value === 'number') {
        if (key.toLowerCase().includes('percent') || key.toLowerCase().includes('rate') || key.toLowerCase().includes('gain')) {
            displayValue = `+${(value * 100).toFixed(1)}%`;
        } else if (key.toLowerCase().includes('yield') || key.toLowerCase().includes('bonus')) {
             displayValue = `+${value.toLocaleString()}`;
        }
    }
    return `${displayKey}: ${displayValue}`;
}

/**
 * Sets up event listeners for the breeding screen.
 */
function setupBreedingListeners() {
    if (dom.breedTreeBtn) {
        dom.breedTreeBtn.addEventListener('click', handleBreedTree);
    }
    const receiveSeedlingBtn = dom.breedingResultPanel?.querySelector('button.btn-success');
    if (receiveSeedlingBtn) {
        receiveSeedlingBtn.addEventListener('click', handleReceiveSeedling);
    }
    const slots = dom.breedingSlots?.querySelectorAll('.slot-content');
    if (slots) {
        slots.forEach(slot => {
            slot.addEventListener('click', handleSlotClick);
        });
    }
}

/**
 * Handler for receiving the newly bred seedling.
 */
function handleReceiveSeedling() {
    resetBreedingState(false);
    renderBreedingRequirements();
    updateBreedButtonState();
    if (dom.plantationScreen.classList.contains('active')) {
        renderPlantation();
    }
}