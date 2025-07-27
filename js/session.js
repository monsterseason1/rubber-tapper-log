// --- START OF FILE session.js ---

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
    updateProgressBar, 
    updateUserProfile, 
    updateUserCoinBalance,
    animateCoins,
    renderSessionLoot
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
 * Toggles the pause state of the current session.
 */
export function togglePauseSession() {
    sessionState.isPaused = !sessionState.isPaused;

    if (sessionState.isPaused) {
        // Pausing the game
        sessionState.pauseStartTime = Date.now();
        stopTimers(); // Stop all timers
        dom.pauseOverlay.classList.remove('hidden');
        dom.pauseSessionBtn.innerHTML = '<i data-lucide="play"></i> ทำต่อ';
    } else {
        // Resuming the game
        const pauseDuration = Date.now() - sessionState.pauseStartTime;
        sessionState.totalPauseDuration += pauseDuration;
        
        // Adjust the lap start time to account for the pause.
        if (sessionState.lapStartTime) {
            sessionState.lapStartTime += pauseDuration;
        }
        
        startTimers(); // Restart all timers
        dom.pauseOverlay.classList.add('hidden');
        dom.pauseSessionBtn.innerHTML = '<i data-lucide="pause"></i> หยุดพัก';
    }
    lucide.createIcons({nodes: [dom.pauseSessionBtn.querySelector('i')]});
}


/**
 * Updates the real-time average time display.
 */
function updateRealTimeStats() {
    if (sessionState.tappedTrees > 0) {
        const elapsedSeconds = (Date.now() - sessionState.startTime - sessionState.totalPauseDuration) / 1000;
        sessionState.currentAvgTime = elapsedSeconds / sessionState.tappedTrees;
        dom.rtAvgTimeSpan.textContent = sessionState.currentAvgTime.toFixed(2);
    } else {
        dom.rtAvgTimeSpan.textContent = "0.00";
    }
}

/**
 * Starts all session timers (main and lap).
 */
function startTimers() {
    stopTimers(); // Ensure no multiple timers are running

    // Main Timer
    sessionState.timerInterval = setInterval(() => {
        if (!sessionState.isPaused) {
            const elapsedSeconds = (Date.now() - sessionState.startTime - sessionState.totalPauseDuration) / 1000;
            dom.timerSpan.textContent = formatTime(elapsedSeconds);
        }
    }, 1000);

    // Lap Timer
    sessionState.lapTimerInterval = setInterval(() => {
        if (!sessionState.isPaused && sessionState.lapStartTime) {
            const lapElapsedSeconds = (Date.now() - sessionState.lapStartTime) / 1000;
            dom.rtLapTimeSpan.textContent = lapElapsedSeconds.toFixed(2);
        }
    }, 100);
}

/**
 * Stops all session timers.
 */
function stopTimers() {
    if (sessionState.timerInterval) {
        clearInterval(sessionState.timerInterval);
        sessionState.timerInterval = null;
    }
    if (sessionState.lapTimerInterval) {
        clearInterval(sessionState.lapTimerInterval);
        sessionState.lapTimerInterval = null;
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
    sessionState.tapTimestamps = [sessionState.startTime.getTime()]; 
    sessionState.totalTrees = treeCount;
    sessionState.lapStartTime = Date.now(); // Set initial lap start time

    dom.totalTreesDisplaySpan.textContent = sessionState.totalTrees;
    dom.currentTreeNumberSpan.textContent = 1;
    dom.timerSpan.textContent = '00:00:00';
    dom.nextTreeBtn.disabled = false;
    dom.endSessionBtn.disabled = false;
    dom.endSessionFullBtn.disabled = false;
    dom.pauseSessionBtn.disabled = false;
    dom.pauseSessionBtn.innerHTML = '<i data-lucide="pause"></i> หยุดพัก';
    lucide.createIcons({nodes: [dom.pauseSessionBtn.querySelector('i')]});

    dom.newRecordBadge.style.display = 'none'; 
    dom.pacingAnalysisCard.style.display = 'none'; 
    dom.aiInsightText.textContent = "กำลังวิเคราะห์ข้อมูลการกรีดของคุณ..."; 

    if (state.goalAvgTime) {
        dom.pacingIndicator.classList.add('visible');
        dom.pacingIndicator.className = 'pacing-card visible'; 
        dom.pacingStatus.textContent = `เทียบเป้าหมาย AI (${state.goalAvgTime.toFixed(2)}s)`;
        dom.pacingTimeDiff.textContent = 'รอเริ่ม...';
    } else if (state.bestSessionLapTimes && state.bestSessionLapTimes.length > 0) {
        dom.pacingIndicator.classList.add('visible');
        dom.pacingIndicator.className = 'pacing-card visible'; 
        dom.pacingStatus.textContent = 'เทียบสถิติดีที่สุด';
        dom.pacingTimeDiff.textContent = 'รอเริ่ม...';
    } else {
        dom.pacingIndicator.classList.remove('visible'); 
    }

    dom.realTimeStatsContainer.classList.remove('hidden');
    dom.rtAvgTimeSpan.textContent = "0.00";
    dom.rtLapTimeSpan.textContent = "0.00";
    renderSessionLoot(sessionState.sessionLoot);

    updateProgressBar(0, sessionState.totalTrees);
    
    startTimers();
    
    showScreen(dom.tappingScreen);
}

/**
 * Handles the logic for the "next tree" click.
 */
export function handleNextTree() {
    if (sessionState.isPaused || sessionState.totalTrees === 0) return; 

    if (state.animationEffectsEnabled && dom.nextTreeBtn) {
        dom.nextTreeBtn.classList.remove('anim-ripple');
        void dom.nextTreeBtn.offsetWidth; 
        dom.nextTreeBtn.classList.add('anim-ripple');
        setTimeout(() => {
            if (dom.nextTreeBtn) {
                dom.nextTreeBtn.classList.remove('anim-ripple');
            }
        }, 600);
    }

    sessionState.tappedTrees++;
    const now = new Date().getTime();
    
    // Calculate current lap time based on the dedicated lapStartTime
    const currentLapTime = (now - sessionState.lapStartTime) / 1000;
    
    sessionState.tapTimestamps.push(now); 

    playEffect(dom.tapSound, 50);

    updateProgressBar(sessionState.tappedTrees, sessionState.totalTrees);

    if (state.animationEffectsEnabled) {
        dom.currentTreeNumberSpan.classList.add('anim-pop');
        setTimeout(() => dom.currentTreeNumberSpan.classList.remove('anim-pop'), 300);
    }
    dom.currentTreeNumberSpan.textContent = sessionState.tappedTrees + 1;
    
    updateRealTimeStats();
    sessionState.lapStartTime = Date.now(); // Reset lap start time for the next tree

    if (dom.pacingIndicator.classList.contains('visible')) {
        let targetLapTime;
        if (state.goalAvgTime) {
            targetLapTime = state.goalAvgTime;
        } else if (state.bestSessionLapTimes && state.bestSessionLapTimes.length >= sessionState.tappedTrees) {
            targetLapTime = state.bestSessionLapTimes[sessionState.tappedTrees - 1];
        }

        if (targetLapTime) {
            const diff = targetLapTime - currentLapTime; 
            dom.pacingTimeDiff.textContent = `${Math.abs(diff).toFixed(2)}s`;
            if (diff > 0.05) { 
                dom.pacingIndicator.className = 'pacing-card visible ahead';
                dom.pacingStatus.textContent = 'เร็วกว่าเป้า!';
                dom.pacingTimeDiff.textContent = `+${diff.toFixed(2)}s`;
            } else if (diff < -0.05) { 
                dom.pacingIndicator.className = 'pacing-card visible behind';
                dom.pacingStatus.textContent = 'ช้ากว่าเป้า';
            } else { 
                dom.pacingIndicator.className = 'pacing-card visible on-pace';
                dom.pacingStatus.textContent = 'รักษาความเร็ว';
                dom.pacingTimeDiff.textContent = '0.00s';
            }
        }
    }
    
    handleMaterialDrop();
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
            renderSessionLoot(sessionState.sessionLoot);
            
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
            renderSessionLoot(sessionState.sessionLoot);
            
            showToast({ title: `พบเมล็ดพันธุ์หายาก!<br>ได้รับ: 1x ${speciesData.name} (เมล็ด)`, lucideIcon: 'package', customClass: 'mission-complete' });
        }
    }
}

/**
 * Ends the current tapping session, calculates results, and shows the summary screen.
 * @param {boolean} [isFullPlantation=false] - True if this was a full plantation tap.
 */
export function endSession(isFullPlantation = false) {
    if (sessionState.isPaused) {
        togglePauseSession();
    }
    
    stopTimers();

    dom.nextTreeBtn.disabled = true; 
    dom.endSessionBtn.disabled = true;
    dom.endSessionFullBtn.disabled = true;
    dom.pauseSessionBtn.disabled = true;
    dom.pacingIndicator.classList.remove('visible'); 
    dom.realTimeStatsContainer.classList.add('hidden');

    const endTime = new Date();
    const totalSeconds = (endTime.getTime() - sessionState.startTime.getTime() - sessionState.totalPauseDuration) / 1000;
    let avgTimePerTree = sessionState.tappedTrees > 0 ? totalSeconds / sessionState.tappedTrees : 0;
    
    avgTimePerTree *= (1 - applyUpgradeEffect('speed_boost_percent', 0));

    const lapTimes = [];
    if (sessionState.tapTimestamps.length > 1) {
        for (let i = 1; i < sessionState.tapTimestamps.length; i++) {
            lapTimes.push((sessionState.tapTimestamps[i] - sessionState.tapTimestamps[i-1]) / 1000);
        }
    } else if (sessionState.tappedTrees === 1) {
        lapTimes.push(totalSeconds);
    }
    
    const currentSessionData = {
        date: new Date().toISOString(),
        tappedTrees: sessionState.tappedTrees,
        totalTime: totalSeconds,
        avgTime: avgTimePerTree,
        lapTimes: lapTimes
    };
    
    const insight = getAIInsight(currentSessionData, state.sessionHistory);
    dom.aiInsightText.textContent = insight;
    currentSessionData.aiInsight = insight;

    const pacingResult = getPacingAnalysis(lapTimes);
    if (pacingResult) {
        dom.pacingAnalysisCard.style.display = 'block';
        dom.pacingAnalysisText.textContent = pacingResult.text;
        dom.pacingFirstHalf.textContent = `${pacingResult.firstHalfAvg.toFixed(2)} วิ/ต้น`;
        dom.pacingSecondHalf.textContent = `${pacingResult.secondHalfAvg.toFixed(2)} วิ/ต้น`;
    } else {
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

    dom.summaryTotalTrees.textContent = `${sessionState.tappedTrees} ต้น`;
    dom.summaryTotalTime.textContent = formatTime(totalSeconds);
    dom.summaryAvgTime.textContent = avgTimePerTree.toFixed(2);

    if (sessionState.tappedTrees > 0 && (!state.bestAvgTime || avgTimePerTree < state.bestAvgTime)) {
        dom.newRecordBadge.style.display = 'block';
        
        if (state.animationEffectsEnabled) {
            dom.newRecordBadge.classList.add('sparkle');
            setTimeout(() => dom.newRecordBadge.classList.remove('sparkle'), 700);
        }

        saveStateItem('bestAvgTime', avgTimePerTree);
        state.bestSessionLapTimes = lapTimes; 
        saveStateObject('bestSessionLapTimes', state.bestSessionLapTimes); 
        
        const baseRecordReward = gameData.gameBalance.RECORD_BONUS_COINS;
        const finalRecordReward = applyUpgradeEffect('record_bonus_flat', baseRecordReward);

        grantCoins(finalRecordReward);
        showToast({title: `<strong>ทำลายสถิติใหม่!</strong><br>รับ ${finalRecordReward.toLocaleString()} เหรียญ`, lucideIcon: 'award'});
        animateCoins(finalRecordReward, dom.newRecordBadge);
    } else {
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