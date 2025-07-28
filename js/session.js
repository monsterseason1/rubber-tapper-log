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
    updateTappingScreenUI
} from './ui.js'; 
import { getAIInsight, getPacingAnalysis, checkAchievementCoinRewards, grantCoins, setAIGoal, grantXp } from './analysis.js';
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
    const treeCount = parseInt(treeCountGoal, 10);
    if (isNaN(treeCount) || treeCount < 1) {
        showToast({title: 'เกิดข้อผิดพลาดในการตั้งเป้าหมายเซสชัน', lucideIcon: 'alert-circle'});
        return;
    }
    
    resetSessionState();
    sessionState.startTime = new Date();
    sessionState.tapTimestamps.push(sessionState.startTime.getTime()); 
    sessionState.totalTrees = treeCount;

    // Clear previous summary screen data to prevent flashing old data
    if(dom.newRecordBadge) dom.newRecordBadge.style.display = 'none'; 
    if(dom.pacingAnalysisCard) dom.pacingAnalysisCard.style.display = 'none'; 
    if(dom.aiInsightText) dom.aiInsightText.textContent = "กำลังวิเคราะห์ข้อมูลการกรีดของคุณ..."; 
    
    // Initial UI update for the tapping screen
    updateTappingScreenUI(sessionState);
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
    if(dom.activeTapTreeNumber) dom.activeTapTreeNumber.textContent = sessionState.tappedTrees + 1;
    
    // Update the real-time average display on the active screen
    const elapsedSeconds = (Date.now() - sessionState.startTime) / 1000;
    const currentAvg = sessionState.tappedTrees > 0 ? elapsedSeconds / sessionState.tappedTrees : 0;
    if (dom.activeRtAvgTimeSpan) {
        dom.activeRtAvgTimeSpan.textContent = currentAvg.toFixed(2);
    }

    // Show the active tapping screen and hide the header/footer
    showScreen(dom.activeTappingScreen, false, true); // (screen, isInitial, isTapping)
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
    
    // Recalculate real-time average
    const elapsedSecondsTotal = (now - sessionState.startTime) / 1000;
    sessionState.currentAvgTime = elapsedSecondsTotal / sessionState.tappedTrees;

    playEffect(dom.tapSound, 50);

    handleMaterialDrop();

    // Reset lap start time until the next tap is initiated
    sessionState.lapStartTime = null; 

    // --- UI Update ---
    // Pass the entire updated state to the UI function for rendering.
    updateTappingScreenUI(sessionState);

    // Switch back to the prep screen
    showScreen(dom.tappingScreen);
}

/**
 * Checks for material/seed drops and updates the session loot state.
 */
function handleMaterialDrop() {
    const baseMaterialDropChance = 0.05;
    const finalMaterialDropChance = applyUpgradeEffect('material_drop_chance', baseMaterialDropChance);

    if (Math.random() < finalMaterialDropChance) {
        const availableMaterials = Object.keys(gameData.treeMaterials);
        if (availableMaterials.length > 0) {
            const randomMaterialKey = availableMaterials[Math.floor(Math.random() * availableMaterials.length)];
            const materialData = gameData.treeMaterials[randomMaterialKey];
            
            if (!state.materials) state.materials = {};
            state.materials[randomMaterialKey] = (state.materials[randomMaterialKey] || 0) + 1;
            saveStateObject('materials', state.materials);
            
            sessionState.sessionLoot[randomMaterialKey] = (sessionState.sessionLoot[randomMaterialKey] || 0) + 1;
            
            showToast({ title: `พบวัตถุดิบ!<br>ได้รับ: 1x ${materialData.name}`, lucideIcon: materialData.icon || 'gem' });
        }
    }
    
    const baseSeedDropChance = 0.01;
    const finalSeedDropChance = baseSeedDropChance;

    if (Math.random() < finalSeedDropChance) {
        const availableSpecies = Object.keys(gameData.treeSpecies);
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
                specialAttributes: speciesData.baseAttributes || {},
            };
            
            if (!state.playerTrees) state.playerTrees = [];
            state.playerTrees.push(newTree);
            saveStateObject('playerTrees', state.playerTrees);
            
            const seedKey = `${randomSpeciesKey}_seed`;
            sessionState.sessionLoot[seedKey] = (sessionState.sessionLoot[seedKey] || 0) + 1;
            
            showToast({ title: `พบเมล็ดพันธุ์หายาก!<br>ได้รับ: 1x ${speciesData.name} (เมล็ด)`, lucideIcon: 'package', customClass: 'mission-complete' });
        }
    }
}

/**
 * Ends the current tapping session, calculates results, and shows the summary screen.
 */
export function endSession(isFullPlantation = false) {
    stopTimers();

    if (dom.startTappingTreeBtn) dom.startTappingTreeBtn.disabled = true; 
    if (dom.endSessionBtn) dom.endSessionBtn.disabled = true;
    if (dom.endSessionFullBtn) dom.endSessionFullBtn.disabled = true;
    if (dom.endSessionBtnDesktop) dom.endSessionBtnDesktop.disabled = true;
    if (dom.endSessionFullBtnDesktop) dom.endSessionFullBtnDesktop.disabled = true;

    const endTime = new Date();
    const totalSeconds = (endTime.getTime() - sessionState.startTime.getTime()) / 1000;
    let avgTimePerTree = sessionState.tappedTrees > 0 ? totalSeconds / sessionState.tappedTrees : 0;
    
    avgTimePerTree *= (1 - applyUpgradeEffect('speed_boost_percent', 0));
    
    const currentSessionData = {
        date: new Date().toISOString(),
        tappedTrees: sessionState.tappedTrees,
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
    
    if (isFullPlantation && sessionState.tappedTrees > 0) {
        state.plantationSize = sessionState.tappedTrees;
        saveStateItem('plantationSize', state.plantationSize);
        showToast({ title: `บันทึกขนาดสวน ${state.plantationSize} ต้น สำเร็จ!`, lucideIcon: 'check-check', customClass: 'mission-complete'});
    }

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