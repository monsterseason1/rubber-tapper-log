// --- START OF FILE js/session.js ---

/*
======================================
  Rubber Tapper's Log - session.js
  Contains the core logic for a tapping session.
======================================
*/

import * as dom from './dom.js';
import { state, sessionState, resetSessionState, saveStateItem, saveStateObject } from './state.js'; 
import { 
    showScreen, 
    formatTime, 
    showToast, 
    updateUserProfile, 
    updateUserCoinBalance,
    animateCoins,
    renderSessionLoot,
    updateTappingScreenUI,
    adjustSetupScreenForUser
} from './ui.js'; 
import { getAIInsight, getPacingAnalysis, checkAchievementCoinRewards, grantCoins, setAIGoal, grantXp, getActiveTree } from './analysis.js';
import { checkMissionCompletion } from './missions.js'; 
import { gameData } from './gameDataService.js';
import { applyUpgradeEffect } from './upgrades.js';

/**
 * Plays a sound effect based on the sound type.
 * @param {HTMLAudioElement} soundElement The audio element to play.
 * @param {number} [hapticDuration=0] Duration for haptic feedback in ms.
 */
function playEffect(soundElement, hapticDuration = 0) {
    if (!state.animationEffectsEnabled) return;

    if (soundElement) {
        soundElement.currentTime = 0;
        soundElement.play().catch(e => console.error(`Audio play failed for ${soundElement.id}:`, e));
    }

    if (hapticDuration > 0 && 'vibrate' in navigator) {
        navigator.vibrate(hapticDuration);
    }
}

/**
 * Checks if the user has met the criteria for any new achievements.
 * @param {object} sessionStats Stats from the completed session.
 * @returns {string[]} An array of keys for newly unlocked achievements.
 */
function checkAchievements(sessionStats) {
    const newlyUnlockedKeys = [];
    Object.entries(gameData.achievements).forEach(([key, achievement]) => {
        const isUnlocked = state.unlockedAchievements.includes(key);
        if (isUnlocked) return; 

        let conditionMet = false;
        if (achievement.type === 'trees' && sessionStats.lifetimeTrees >= achievement.target) conditionMet = true;
        if (achievement.type === 'speed' && sessionStats.lastAvgTime < achievement.target) conditionMet = true;
        if (achievement.type === 'session' && sessionStats.lastTappedTrees >= achievement.target) conditionMet = true;

        if (conditionMet) {
            state.unlockedAchievements.push(key);
            newlyUnlockedKeys.push(key);
            setTimeout(() => {
                showToast({title: `<strong>ปลดล็อกแล้ว!</strong><br>${achievement.title}`, lucideIcon: achievement.lucideIcon}); 
                playEffect(dom.achievementSound, 200);
            }, 1000);
        }
    });
    
    if (newlyUnlockedKeys.length > 0) {
        saveStateObject('unlockedAchievements', state.unlockedAchievements);
    }
    
    return newlyUnlockedKeys;
}

/**
 * Starts all session timers (main and lap).
 */
function startTimers() {
    stopTimers(); // Ensure no multiple timers are running

    // Main Timer for total elapsed time
    sessionState.timerInterval = setInterval(() => {
        const elapsedSeconds = (Date.now() - sessionState.startTime) / 1000;
        if (dom.timerSpan) {
            dom.timerSpan.textContent = formatTime(elapsedSeconds);
        }
    }, 1000);
}

/**
 * Stops all session timers.
 */
function stopTimers() {
    if (sessionState.timerInterval) {
        clearInterval(sessionState.timerInterval);
        sessionState.timerInterval = null;
    }
}

/**
 * Starts a new tapping session.
 */
export function startSession(treeCountGoal) {
    // --- START: BUG FIX - Re-enable buttons on new session start ---
    if (dom.startTappingTreeBtn) dom.startTappingTreeBtn.disabled = false;
    if (dom.endSessionBtn) dom.endSessionBtn.disabled = false;
    if (dom.endSessionFullBtn) dom.endSessionFullBtn.disabled = false;
    if (dom.endSessionBtnDesktop) dom.endSessionBtnDesktop.disabled = false;
    if (dom.endSessionFullBtnDesktop) dom.endSessionFullBtnDesktop.disabled = false;
    // --- END: BUG FIX ---

    const treeCount = parseInt(treeCountGoal, 10);
    if (isNaN(treeCount) || treeCount < 1) {
        showToast({title: 'เกิดข้อผิดพลาดในการตั้งเป้าหมายเซสชัน', lucideIcon: 'alert-circle'});
        return;
    }
    
    resetSessionState();
    sessionState.startTime = new Date();
    sessionState.tapTimestamps.push(sessionState.startTime.getTime()); 
    sessionState.totalTrees = treeCount;

    // --- New Mapping Mode Logic ---
    if (state.isMappingModeActive) {
        // If starting a map for the first time or continuing, load the layout.
        sessionState.mapLayout = [...(state.realPlantationLayout || [])];
        if (sessionState.mapLayout.length === 0) {
            // This is the very first tree. Place it at origin (0,0).
            const firstTree = {
                id: 1,
                x: 0,
                y: 0,
                note: ""
            };
            sessionState.mapLayout.push(firstTree);
            sessionState.currentMapPosition = { x: 0, y: 0 };
            saveStateObject('realPlantationLayout', sessionState.mapLayout);
            state.realPlantationLayout = sessionState.mapLayout; // Sync live state
        } else {
            // Find the last tree to continue mapping from it.
            const lastTree = sessionState.mapLayout[sessionState.mapLayout.length - 1];
            sessionState.currentMapPosition = { x: lastTree.x, y: lastTree.y };
        }
    }
    // --- End Mapping Mode Logic ---
    
    // Clear previous summary screen data to prevent flashing old data
    if(dom.newRecordBadge) dom.newRecordBadge.style.display = 'none'; 
    if(dom.pacingAnalysisCard) dom.pacingAnalysisCard.style.display = 'none'; 
    if(dom.aiInsightText) dom.aiInsightText.textContent = "กำลังวิเคราะห์ข้อมูลการกรีดของคุณ..."; 
    
    // Initial UI update for the tapping screen
    updateTappingScreenUI(); // Pass no args to use global state
    startTimers();
    showScreen(dom.tappingScreen);
}

/**
 * Initiates the tapping process for a single tree.
 * This is called when the user clicks "Start Tapping Tree" on the prep screen.
 */
export function initiateTreeTap() {
    sessionState.lapStartTime = Date.now(); // Start the timer for this specific lap
    
    // Update the active tapping screen UI
    if(dom.activeTapTreeNumber) dom.activeTapTreeNumber.textContent = state.tappedTreesInCurrentCycle + sessionState.tappedTrees + 1;
    
    // Update the real-time average display on the active screen
    const elapsedSeconds = (Date.now() - sessionState.startTime) / 1000;
    const currentAvg = sessionState.tappedTrees > 0 ? elapsedSeconds / sessionState.tappedTrees : 0;
    if (dom.activeRtAvgTimeSpan) {
        dom.activeRtAvgTimeSpan.textContent = currentAvg.toFixed(2);
    }

    // Show the active tapping screen and hide the header/footer
    showScreen(dom.activeTappingScreen, true); // (screenToShow, isTapping)
}

/**
 * Finalizes the tap for the current tree.
 * This is called when the user taps anywhere on the active tapping screen.
 */
export function finalizeTreeTap() {
    if (!sessionState.lapStartTime) return;

    // --- Core Logic for capturing new data ---
    const now = Date.now();
    const lapTimeSeconds = (now - sessionState.lapStartTime) / 1000;
    
    sessionState.tappedTrees++;
    sessionState.tapTimestamps.push(now);
    sessionState.lapTimes.push(lapTimeSeconds);
    
    // --- New Pacing Logic ---
    sessionState.previousLapTime = sessionState.lastLapTime; // Shift the last lap to previous
    sessionState.lastLapTime = lapTimeSeconds; // Set the new last lap time
    
    // Recalculate real-time average for this sub-session only
    const elapsedSecondsTotal = (now - sessionState.startTime) / 1000;
    sessionState.currentAvgTime = elapsedSecondsTotal / sessionState.tappedTrees;

    playEffect(dom.tapSound, 50);

    handleMaterialDrop();

    // Reset lap start time until the next tap is initiated
    sessionState.lapStartTime = null; 

    // --- START: New auto-end session logic ---
    // Check if the plantation size is set and if the total tapped trees for the cycle reach it
    if (state.plantationSize && state.plantationSize > 0) {
        const totalTappedInCycle = state.tappedTreesInCurrentCycle + sessionState.tappedTrees;
        if (totalTappedInCycle >= state.plantationSize) {
            endSession(true); // End the session as a "full plantation"
            return; // Exit the function to prevent showing the tapping screen again
        }
    }
    // --- END: New auto-end session logic ---

    // --- UI Update ---
    updateTappingScreenUI();

    // Switch back to the prep screen
    showScreen(dom.tappingScreen);
}

/**
 * Handles the user clicking a direction button in mapping mode.
 * @param {string} direction - 'up', 'down', 'left', or 'right'.
 */
export function handleMapDirection(direction) {
    if (!state.isMappingModeActive || !sessionState.currentMapPosition) return;

    let { x, y } = sessionState.currentMapPosition;
    switch (direction) {
        case 'up':    y--; break;
        case 'down':  y++; break;
        case 'left':  x--; break;
        case 'right': x++; break;
    }

    // Check if a tree already exists at the new coordinates
    const isOccupied = sessionState.mapLayout.some(tree => tree.x === x && tree.y === y);
    if (isOccupied) {
        showToast({ title: "ตำแหน่งนี้มีต้นไม้อยู่แล้ว!", lucideIcon: 'alert-triangle' });
        return;
    }
    
    // Add the new tree to the session's map layout
    const newTree = {
        id: sessionState.mapLayout.length + 1,
        x: x,
        y: y,
        note: ""
    };
    sessionState.mapLayout.push(newTree);
    sessionState.currentMapPosition = { x, y };

    // Now, initiate the regular tapping process for this new tree
    initiateTreeTap();
}

/**
 * Handles the "Undo" button click during mapping.
 */
export function handleUndoLastMapping() {
    if (!state.isMappingModeActive || !sessionState.mapLayout || sessionState.mapLayout.length <= 1) {
        showToast({ title: "ไม่สามารถย้อนกลับได้อีก", lucideIcon: 'info' });
        return;
    }
    // Remove the last tree added
    sessionState.mapLayout.pop();

    // Reset the current position to the new last tree
    const lastTree = sessionState.mapLayout[sessionState.mapLayout.length - 1];
    sessionState.currentMapPosition = { x: lastTree.x, y: lastTree.y };
    
    // Update the UI to reflect the change
    updateTappingScreenUI();
    showToast({ title: "ย้อนกลับการวางตำแหน่งล่าสุด", lucideIcon: 'rotate-ccw' });
}


/**
 * Handles guaranteed loot drop for every tap using a weighted table from game_data.
 */
function handleMaterialDrop() {
    const lootTable = gameData.perTapLootTable;
    if (!lootTable || lootTable.length === 0) return;

    // Apply material drop rate upgrade effect from permanent upgrades
    let materialBoostFactor = 1.0;
    materialBoostFactor = applyUpgradeEffect('material_drop_chance', materialBoostFactor);


    // --- START: REVISED - Apply active tree bonus, calculated by level ---
    const activeTree = getActiveTree();
    if (activeTree) {
        const treeData = gameData.treeSpecies[activeTree.species];
        const materialDropAttr = treeData?.baseAttributes?.materialDropRate;
        if (materialDropAttr) {
            // Calculate the bonus based on the tree's current level
            const bonus = (materialDropAttr.base || 0) + ((materialDropAttr.growth || 0) * (activeTree.level - 1));
            materialBoostFactor *= (1 + bonus);
        }
    }
    // --- END: REVISED ---

    const weightedLootTable = lootTable.map(item => {
        let weight = item.weight;
        // Boost weight only for materials and seeds, not coins
        if (item.type === 'material' || item.type === 'seed') {
            weight *= materialBoostFactor;
        }
        return { ...item, weight };
    });

    const totalWeight = weightedLootTable.reduce((sum, item) => sum + item.weight, 0);
    const randomRoll = Math.random() * totalWeight;

    let cumulativeWeight = 0;
    for (const lootItem of weightedLootTable) {
        cumulativeWeight += lootItem.weight;
        if (randomRoll <= cumulativeWeight) {
            // We have a winner!
            grantLoot(lootItem);
            return; // Exit after granting one loot item
        }
    }
}

/**
 * Helper function to grant the actual loot to the player.
 * @param {object} lootItem The winning loot item object from the loot table.
 */
function grantLoot(lootItem) {
    switch (lootItem.type) {
        case 'coins':
            const amount = Math.floor(Math.random() * (lootItem.maxAmount - lootItem.minAmount + 1)) + lootItem.minAmount;
            grantCoins(amount);
            showToast({ title: `+${amount} เหรียญ!`, lucideIcon: 'coins', customClass: 'coin-toast' });
            sessionState.sessionLoot['coins'] = (sessionState.sessionLoot['coins'] || 0) + amount;
            updateUserCoinBalance();
            break;

        case 'material':
            if (!state.materials) state.materials = {};
            state.materials[lootItem.id] = (state.materials[lootItem.id] || 0) + lootItem.amount;
            saveStateObject('materials', state.materials);
            
            sessionState.sessionLoot[lootItem.id] = (sessionState.sessionLoot[lootItem.id] || 0) + lootItem.amount;
            
            const materialData = gameData.treeMaterials[lootItem.id];
            showToast({ title: `พบวัตถุดิบ!<br>ได้รับ: ${lootItem.amount}x ${materialData.name}`, lucideIcon: materialData.icon || 'gem' });
            break;

        case 'seed':
            const availableSpecies = Object.keys(gameData.treeSpecies).filter(key => 
                (gameData.treeSpecies[key].rarity || 'Common').toLowerCase() === lootItem.rarity.toLowerCase()
            );
            if (availableSpecies.length > 0) {
                const randomSpeciesKey = availableSpecies[Math.floor(Math.random() * availableSpecies.length)];
                const speciesData = gameData.treeSpecies[randomSpeciesKey];
                
                const newTree = {
                    treeId: `tree_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                    species: randomSpeciesKey,
                    rarity: speciesData.rarity || 'Common',
                    level: 1,
                    exp: 0,
                    growthStage: 'Seed', 
                    specialAttributes: {}, // Attributes are now calculated, not stored
                    isNew: true,
                };
                
                if (!state.playerTrees) state.playerTrees = [];
                state.playerTrees.push(newTree);
                saveStateObject('playerTrees', state.playerTrees);
                
                const seedKey = `${randomSpeciesKey}_seed`;
                sessionState.sessionLoot[seedKey] = (sessionState.sessionLoot[seedKey] || 0) + 1;
                
                showToast({ title: `พบเมล็ดพันธุ์!<br>ได้รับ: 1x ${speciesData.name} (เมล็ด)`, lucideIcon: 'package', customClass: 'mission-complete' });
            }
            break;
    }
}


/**
 * Ends the current tapping session, calculates results, and shows the summary screen.
 */
export function endSession(isFullPlantation = false) {
    stopTimers();

    // --- START: MODIFIED CODE - Guard Clause for 0-tap sessions ---
    if (sessionState.tappedTrees <= 0) {
        showToast({ title: 'ยกเลิกรอบกรีด: ไม่มีข้อมูลที่ถูกบันทึก', lucideIcon: 'info' });
        resetSessionState(); // Clear the invalid session data
        adjustSetupScreenForUser(); // Ensure the setup screen UI is correct
        showScreen(dom.setupScreen); // Go back to the main screen
        return; // Exit the function immediately
    }
    // --- END: MODIFIED CODE ---

    if (dom.startTappingTreeBtn) dom.startTappingTreeBtn.disabled = true; 
    if (dom.endSessionBtn) dom.endSessionBtn.disabled = true;
    if (dom.endSessionFullBtn) dom.endSessionFullBtn.disabled = true;
    if (dom.endSessionBtnDesktop) dom.endSessionBtnDesktop.disabled = true;
    if (dom.endSessionFullBtnDesktop) dom.endSessionFullBtnDesktop.disabled = true;

    // --- Finalize Mapping Data ---
    if (state.isMappingModeActive) {
        saveStateObject('realPlantationLayout', sessionState.mapLayout);
        state.realPlantationLayout = sessionState.mapLayout; // Sync live state
        // Optional: Automatically turn off mapping mode when a full plantation is mapped
        if (isFullPlantation) {
            saveStateItem('isMappingModeActive', false);
            showToast({ title: "สร้างแผนที่สวนสำเร็จ!", lucideIcon: 'map-pin', customClass: 'mission-complete' });
        }
    }
    // --- End Finalize Mapping Data ---

    // --- START: New logic for cycle handling ---
    // Add the trees from this sub-session to the total for the current cycle
    state.tappedTreesInCurrentCycle += sessionState.tappedTrees;
    saveStateItem('tappedTreesInCurrentCycle', state.tappedTreesInCurrentCycle);
    // --- END: New logic for cycle handling ---

    const endTime = new Date();
    const totalSeconds = (endTime.getTime() - sessionState.startTime.getTime()) / 1000;
    let avgTimePerTree = sessionState.tappedTrees > 0 ? totalSeconds / sessionState.tappedTrees : 0;
    
    avgTimePerTree *= (1 - applyUpgradeEffect('speed_boost_percent', 0));
    
    const currentSessionData = {
        date: new Date().toISOString(),
        tappedTrees: sessionState.tappedTrees, // This remains the count for the *sub-session*
        totalTime: totalSeconds,
        avgTime: avgTimePerTree,
        lapTimes: sessionState.lapTimes
    };
    
    const insight = getAIInsight(currentSessionData, state.sessionHistory);
    if(dom.aiInsightText) dom.aiInsightText.textContent = insight;
    currentSessionData.aiInsight = insight;

    const pacingResult = getPacingAnalysis(sessionState.lapTimes);
    if (pacingResult && dom.pacingAnalysisCard) {
        dom.pacingAnalysisCard.style.display = 'block';
        if(dom.pacingAnalysisText) dom.pacingAnalysisText.textContent = pacingResult.text;
        if(dom.pacingFirstHalf) dom.pacingFirstHalf.textContent = `${pacingResult.firstHalfAvg.toFixed(2)} วิ/ต้น`;
        if(dom.pacingSecondHalf) dom.pacingSecondHalf.textContent = `${pacingResult.secondHalfAvg.toFixed(2)} วิ/ต้น`;
    } else if (dom.pacingAnalysisCard) {
        dom.pacingAnalysisCard.style.display = 'none'; 
    }

    state.sessionHistory.push(currentSessionData);
    if (state.sessionHistory.length > 30) state.sessionHistory.shift(); 
    saveStateObject('sessionHistory', state.sessionHistory);

    const todayForStreak = new Date();
    todayForStreak.setHours(0, 0, 0, 0); 
    saveStateItem('lastSessionDate', todayForStreak.toISOString());

    state.lifetimeTrees += sessionState.tappedTrees;
    saveStateItem('lifetimeTrees', state.lifetimeTrees);
    
    // --- START: Reworked "Full Plantation" logic ---
    if (isFullPlantation && state.tappedTreesInCurrentCycle > 0) {
        // Only set plantationSize if it hasn't been set before
        if (!state.plantationSize) {
            state.plantationSize = state.tappedTreesInCurrentCycle;
            saveStateItem('plantationSize', state.plantationSize);
            showToast({ title: `บันทึกขนาดสวน ${state.plantationSize} ต้น สำเร็จ!`, lucideIcon: 'check-check', customClass: 'mission-complete'});
        }
        
        // Reset the cycle counter for the next full round
        state.tappedTreesInCurrentCycle = 0;
        saveStateItem('tappedTreesInCurrentCycle', state.tappedTreesInCurrentCycle);
        showToast({ title: 'สิ้นสุดรอบการกรีด!', lucideIcon: 'flag', customClass: 'mission-complete'});
    }
    // --- END: Reworked "Full Plantation" logic ---

    const baseXP = currentSessionData.tappedTrees * 0.5;
    grantXp(baseXP);

    if(dom.summaryTotalTrees) dom.summaryTotalTrees.textContent = `${sessionState.tappedTrees} ต้น`;
    if(dom.summaryTotalTime) dom.summaryTotalTime.textContent = formatTime(totalSeconds);
    if(dom.summaryAvgTime) dom.summaryAvgTime.textContent = avgTimePerTree.toFixed(2);

    if (sessionState.tappedTrees > 0 && (!state.bestAvgTime || avgTimePerTree < state.bestAvgTime)) {
        if(dom.newRecordBadge) {
            dom.newRecordBadge.style.display = 'block';
            if (state.animationEffectsEnabled) {
                dom.newRecordBadge.classList.add('sparkle');
                setTimeout(() => dom.newRecordBadge.classList.remove('sparkle'), 700);
            }
        }

        saveStateItem('bestAvgTime', avgTimePerTree);
        state.bestSessionLapTimes = sessionState.lapTimes; 
        saveStateObject('bestSessionLapTimes', state.bestSessionLapTimes); 
        
        const baseRecordReward = gameData.gameBalance.RECORD_BONUS_COINS;
        const finalRecordReward = applyUpgradeEffect('record_bonus_flat', baseRecordReward);

        grantCoins(finalRecordReward);
        showToast({title: `<strong>ทำลายสถิติใหม่!</strong><br>รับ ${finalRecordReward.toLocaleString()} เหรียญ`, lucideIcon: 'award'});
        animateCoins(finalRecordReward, dom.newRecordBadge);
    } else if(dom.newRecordBadge) {
        dom.newRecordBadge.style.display = 'none';
    }

    const statsForRewards = {
        lifetimeTrees: state.lifetimeTrees,
        lastAvgTime: avgTimePerTree,
        lastTappedTrees: sessionState.tappedTrees,
        totalTime: totalSeconds 
    };

    const newlyUnlockedAchievementKeys = checkAchievements(statsForRewards);
    checkAchievementCoinRewards(newlyUnlockedAchievementKeys);
    
    checkMissionCompletion(currentSessionData); 
    
    updateUserProfile();
    updateUserCoinBalance();

    setAIGoal();

    showScreen(dom.summaryScreen);
}