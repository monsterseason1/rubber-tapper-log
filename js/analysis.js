// --- START OF FILE analysis.js ---

/*
======================================
  Rubber Tapper's Log - analysis.js
  Contains all AI and data analysis functions.
======================================
*/

import { state, saveStateItem, saveStateObject } from './state.js';
import { showToast, showLevelUpModal, updateUserProfile } from './ui.js'; // Import showLevelUpModal and updateUserProfile
import { gameData } from './gameDataService.js';
import { applyUpgradeEffect } from './upgrades.js'; // Import for upgrade system

/**
 * NEW: Helper function to get the currently active tree object from state.
 * @returns {object|null} The active tree object or null if none is active.
 */
function getActiveTree() {
    if (!state.activeTreeId || !state.playerTrees) {
        return null;
    }
    return state.playerTrees.find(tree => tree.treeId === state.activeTreeId) || null;
}


// --- Leveling Logic ---

/**
 * Calculates the total XP required to reach the next level.
 * @param {number} level The current level.
 * @returns {number} The total XP needed for the next level.
 */
export function getXpForNextLevel(level) {
    // Example formula: BASE_XP_PER_LEVEL * (level ^ 1.5)
    // You can adjust the exponent (1.5) to make leveling faster or slower
    return Math.round(gameData.gameBalance.BASE_XP_PER_LEVEL * Math.pow(level, 1.5));
}

/**
 * Grants XP to the user and handles level ups.
 * @param {number} xpAmount The base amount of XP to add.
 */
export function grantXp(xpAmount) {
    if (isNaN(xpAmount) || xpAmount <= 0) return; // Ensure XP is a positive number

    // 1. Apply XP boost from permanent upgrades
    let finalXpAmount = applyUpgradeEffect('xp_boost_percent', xpAmount);

    // 2. (IMPLEMENTED) Apply XP boost from active tree's special attributes if applicable
    const activeTree = getActiveTree(); // Helper to get the tree used in the session
    if (activeTree && activeTree.specialAttributes?.xpGain) {
        finalXpAmount *= (1 + activeTree.specialAttributes.xpGain);
    }

    const oldLevel = state.userLevel;
    state.userXp += Math.round(finalXpAmount); // Use the final amount after all boosts
    
    let xpForNext = getXpForNextLevel(state.userLevel);
    
    // Handle multiple level ups in one go
    while (state.userXp >= xpForNext) {
        state.userLevel++;
        state.userXp -= xpForNext;
        xpForNext = getXpForNextLevel(state.userLevel);
        
        // Grant coins on level up, which can also be affected by upgrades
        const levelUpCoinReward = gameData.gameBalance.LEVEL_UP_BASE_COINS + (state.userLevel * gameData.gameBalance.LEVEL_UP_COINS_PER_LEVEL);
        grantCoins(levelUpCoinReward);
        
        setAIGoal(); // Re-evaluate AI goal when level changes
    }
    
    // Save updated level and XP
    saveStateItem('userLevel', state.userLevel);
    saveStateItem('userXp', state.userXp);

    // If a level up occurred, show the modal
    if (state.userLevel > oldLevel) {
        // Delay the modal slightly to allow other UI updates to finish
        setTimeout(() => {
            showLevelUpModal(state.userLevel); // Use the dedicated modal function
            updateUserProfile(); // Update the profile immediately after the state changes
        }, 1500); // 1.5 second delay after session summary
    }
}

/**
 * Grants coins to the user. This function now ONLY updates state and saves it.
 * @param {number} coinAmount The base amount of coins to add.
 */
export function grantCoins(coinAmount) {
    if (isNaN(coinAmount) || coinAmount <= 0) return;
    
    let finalCoinAmount = coinAmount;
    
    // (IMPLEMENTED) Apply coin boost from active tree's special attributes if applicable
    const activeTree = getActiveTree();
    if (activeTree && activeTree.specialAttributes?.coinYield) {
        finalCoinAmount *= (1 + activeTree.specialAttributes.coinYield);
    }

    state.userCoins += Math.round(finalCoinAmount);
    saveStateItem('userCoins', state.userCoins);
}


/**
 * Grants coin rewards for newly unlocked achievements.
 * @param {string[]} newlyUnlockedKeys Array of achievement keys that were just unlocked.
 */
export function checkAchievementCoinRewards(newlyUnlockedKeys) {
    if (!newlyUnlockedKeys || newlyUnlockedKeys.length === 0) return;

    newlyUnlockedKeys.forEach(key => {
        const achievement = gameData.achievements[key];
        if (achievement && achievement.coinReward) {
            // (Future) Consider if upgrades might affect achievement coin rewards
            grantCoins(achievement.coinReward);
        }
    });
}


// --- AI and Data Analysis Functions ---

/**
 * Analyzes pacing across the first and second half of lap times.
 * @param {number[]} lapTimes Array of individual tree tapping times.
 * @returns {object|null} An object with analysis text and average times, or null if insufficient data.
 */
export function getPacingAnalysis(lapTimes) {
    if (!lapTimes || lapTimes.length < 10) return null; // Need at least 10 laps for meaningful analysis
    
    const half = Math.ceil(lapTimes.length / 2);
    const firstHalf = lapTimes.slice(0, half);
    const secondHalf = lapTimes.slice(half);
    
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const difference = avgSecond - avgFirst;
    // Ensure avgFirst is not zero to prevent division by zero
    const percentChange = avgFirst !== 0 ? (difference / avgFirst) * 100 : 0;

    let text = '';
    if (Math.abs(percentChange) < 3) { text = "ยอดเยี่ยม! คุณรักษาความเร็วได้สม่ำเสมอคงที่ตลอดการกรีด"; } 
    else if (percentChange > 10) { text = "คุณเริ่มต้นได้ดีมาก แต่ดูเหมือนจะแผ่วลงอย่างเห็นได้ชัดในช่วงท้าย"; }
    else if (percentChange < -10) { text = "สุดยอด! คุณเป็นพวกเครื่องร้อนช้าที่เร่งความเร็วขึ้นอย่างมากในช่วงท้าย"; }
    else { text = "ทำได้ดี! แม้จะมีความเร็วต่างกันบ้าง แต่ยังรักษาฟอร์มโดยรวมได้ดี"; }

    return { text, firstHalfAvg: avgFirst, secondHalfAvg: avgSecond };
}

/**
 * Provides AI insights based on current session and historical data.
 * @param {object} currentSession Data from the just completed session.
 * @param {object[]} history Array of past session data.
 * @returns {string} A combined AI insight message.
 */
export function getAIInsight(currentSession, history) {
    if (!currentSession || currentSession.tappedTrees < 2) return "ข้อมูลยังน้อยเกินไปสำหรับการวิเคราะห์";
    
    const { avgTime, lapTimes } = currentSession;
    const mean = avgTime;
    
    // Calculate standard deviation for consistency
    const stdDev = lapTimes.length > 1 ? Math.sqrt(lapTimes.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / lapTimes.length) : 0;
    
    let consistencyInsight = '';
    if (stdDev < mean * 0.15) { consistencyInsight = "คุณมีความสม่ำเสมอในการกรีดดีเยี่ยม!"; }
    else if (stdDev < mean * 0.3) { consistencyInsight = "ความเร็วในการกรีดค่อนข้างคงที่"; }
    else { consistencyInsight = "ความเร็วในการกรีดแต่ละต้นยังไม่ค่อยสม่ำเสมอ"; }
    
    // Compare with historical average if available
    const previousHistory = history.slice(0, -1); // Exclude the current session if it's already in history (which it is)
    const validHistorySessions = previousHistory.filter(s => s.tappedTrees > 0); // Ensure valid sessions
    const overallAvg = validHistorySessions.length > 0 ? validHistorySessions.map(s => s.avgTime).reduce((a, b) => a + b, 0) / validHistorySessions.length : null;
    
    let historicalInsight = '';
    if (overallAvg) {
        // Compare raw data for historical performance
        if (avgTime < overallAvg * 0.95) { historicalInsight = `รอบนี้คุณทำเวลาได้ดีกว่าค่าเฉลี่ยที่ผ่านมา (${overallAvg.toFixed(2)} วิ/ต้น)!`; }
        else if (avgTime > overallAvg * 1.05) { historicalInsight = `รอบนี้ใช้เวลามากกว่าค่าเฉลี่ยที่ผ่านมาเล็กน้อย (${overallAvg.toFixed(2)} วิ/ต้น)`; }
    }
    
    // Combine insights
    const combinedInsight = [historicalInsight, consistencyInsight].filter(Boolean).join(". ");
    return combinedInsight || "วันนี้ทำได้ดีมากครับ!";
}

/**
 * Sets an intelligent average time goal for the user based on their performance.
 * This function is designed to be called on app load, after a session, or on level up.
 */
export function setAIGoal() {
    const { sessionHistory } = state;
    const balance = gameData.gameBalance;

    // Check if enough sessions exist to form a reliable goal
    if (sessionHistory.length < balance.AI_GOAL_MIN_SESSIONS) {
        state.goalAvgTime = null;
        saveStateItem('goalAvgTime', null);
        return;
    }

    // Consider the last N sessions for goal setting
    const relevantSessions = sessionHistory.slice(-balance.AI_GOAL_LOOKBACK_SESSIONS);
    // Filter for sessions with enough taps to be considered valid for goal setting
    const validSessions = relevantSessions.filter(s => s.tappedTrees >= 10); // Minimum 10 trees for a decent average

    if (validSessions.length === 0) {
        state.goalAvgTime = null;
        saveStateItem('goalAvgTime', null);
        return;
    }

    // Find the best average time among the valid recent sessions
    const bestRecentAvgTime = Math.min(...validSessions.map(s => s.avgTime));

    // Calculate the new goal based on improvement percentage
    let newGoal = parseFloat((bestRecentAvgTime * balance.AI_GOAL_PERCENT_IMPROVEMENT).toFixed(2));

    // Apply minimum and maximum goal constraints
    newGoal = Math.max(newGoal, balance.AI_GOAL_MIN_TIME);
    newGoal = Math.min(newGoal, balance.AI_GOAL_MAX_TIME);

    // Round the goal appropriately (e.g., to nearest 0.5 for <20s, nearest integer otherwise)
    if (newGoal < 20) {
        newGoal = Math.round(newGoal * 2) / 2; // Round to nearest 0.5
    } else {
        newGoal = Math.round(newGoal); // Round to nearest integer
    }

    // Update state and notify the user if the goal has changed significantly
    if (state.goalAvgTime === null || Math.abs(state.goalAvgTime - newGoal) > 0.1) { // Check for noticeable change
        state.goalAvgTime = newGoal;
        saveStateItem('goalAvgTime', state.goalAvgTime);
        showToast({ title: `เป้าหมายใหม่จาก AI:<br>ทำความเร็วเฉลี่ยต่ำกว่า ${state.goalAvgTime.toFixed(2)} วิ/ต้น!`, lucideIcon: 'target', customClass: 'goal-set-ai' });
    }
}

/**
 * Provides an intelligent suggestion for the number of trees to tap for the day.
 * It's based on the user's recent activity to provide a realistic goal.
 * @returns {number} A suggested number of trees, rounded to a sensible value.
 */
export function getAITreeSuggestion() {
    const { sessionHistory, plantationSize } = state;
    const MIN_SESSIONS_FOR_SUGGESTION = 3;
    const LOOKBACK_SESSIONS = 7; // Look at the last 7 sessions
    const DEFAULT_SUGGESTION = 100; // Default if not enough data
    const MINIMUM_SUGGESTION = 50; // Don't suggest a very low number

    let suggestedAmount = DEFAULT_SUGGESTION;

    // Logic for returning a suggestion based on history or plantation size
    if (plantationSize && plantationSize > 0) {
        suggestedAmount = Math.round(plantationSize / 10) * 10;
    } else if (sessionHistory && sessionHistory.length >= MIN_SESSIONS_FOR_SUGGESTION) {
        // Get the last N sessions to analyze recent trends.
        const recentSessions = sessionHistory.slice(-LOOKBACK_SESSIONS);
        
        // Calculate the total number of trees tapped in these recent sessions.
        const totalTreesInRecentSessions = recentSessions.reduce((sum, session) => {
            return sum + (Number(session.tappedTrees) || 0);
        }, 0);

        // Calculate the average.
        const averageTrees = totalTreesInRecentSessions / recentSessions.length;

        // Round the average to the nearest 10 for a cleaner suggestion (e.g., 123 -> 120, 148 -> 150)
        if (!isNaN(averageTrees) && averageTrees > 0) {
            suggestedAmount = Math.round(averageTrees / 10) * 10;
        }
    }

    // Final check to ensure the suggestion is not below our defined minimum.
    if (suggestedAmount < MINIMUM_SUGGESTION) {
        suggestedAmount = MINIMUM_SUGGESTION;
    }

    return suggestedAmount;
}


/**
 * Provides a coaching tip based on user goals or recent performance.
 * @returns {string} A coaching tip message.
 */
export function getAICoachTip() {
    const lastSession = state.sessionHistory.length > 0 ? state.sessionHistory[state.sessionHistory.length - 1] : null;
    
    if (state.goalAvgTime) {
        if (lastSession && lastSession.avgTime <= state.goalAvgTime) {
            return `ยินดีด้วย! ครั้งที่แล้วคุณทำสำเร็จตามเป้าหมาย (${state.goalAvgTime.toFixed(2)} วิ/ต้น) แล้ว!`;
        }
        if (lastSession) { 
            const diff = (lastSession.avgTime - state.goalAvgTime).toFixed(2); 
            if (diff > 0) {
                return `เป้าหมายของคุณคือ ${state.goalAvgTime.toFixed(2)} วิ/ต้น ครั้งที่แล้วขาดไปแค่ ${diff} วิ! คุณทำได้แน่นอน!`; 
            }
        }
        return `เป้าหมายจาก AI: ${state.goalAvgTime.toFixed(2)} วิ/ต้น มาเริ่มกันเลย!`;
    }

    if (state.bestAvgTime && state.bestAvgTime > 0) {
        if (lastSession && lastSession.avgTime < state.bestAvgTime) {
            return `ครั้งที่แล้วคุณทำได้ดีมาก (${lastSession.avgTime.toFixed(2)} วิ/ต้น) ทำลายสถิติเก่า! 🎉`;
        }
        return `สถิติที่ดีที่สุดของคุณคือ ${state.bestAvgTime.toFixed(2)} วิ/ต้น ลองทำลายมันดูไหม?`;
    }

    return "สวัสดี! ยินดีต้อนรับสู่การบันทึกครั้งแรกของคุณ!";
}

/**
 * Calculates the current daily streak of using the app.
 * @returns {number} The current streak in days.
 */
export function calculateStreak() {
    if (!state.lastSessionDate) return 0;

    const today = new Date(); 
    today.setHours(0, 0, 0, 0);

    const uniqueHistoryDates = [...new Set(state.sessionHistory.map(s => new Date(s.date).setHours(0, 0, 0, 0)))].sort((a, b) => b - a);

    if (uniqueHistoryDates.length === 0) return 0;

    let currentStreak = 0;
    let expectedDate = today.getTime();

    if (uniqueHistoryDates[0] < today.getTime()) {
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        yesterday.setHours(0,0,0,0);
        
        if (uniqueHistoryDates[0] !== yesterday.getTime()) {
            return 0;
        }
        expectedDate = yesterday.getTime();
    }
    
    for (const dateMillis of uniqueHistoryDates) {
        if (dateMillis === expectedDate) {
            currentStreak++;
            expectedDate -= 86400000;
        } else if (dateMillis < expectedDate) {
            break;
        }
    }

    return currentStreak;
}

// --- Sales Data Analysis (Revised with new feature) ---

/**
 * Calculates and returns key metrics from the sales history, now using plantationSize.
 * @returns {object} An object containing sales analytics.
 */
export function calculateSalesAnalytics() {
    const { salesHistory, sessionHistory, plantationSize } = state;

    const defaultResult = {
        totalIncome: 0,
        avgPricePerKg: 0,
        avgIncomePerTap: 0,
        avgIncomePerDay: 0,
        avgWeightPerDay: 0,
        hasData: false
    };

    if (!salesHistory || salesHistory.length === 0) {
        return defaultResult;
    }

    const totalIncome = salesHistory.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalNetWeight = salesHistory.reduce((sum, sale) => sum + sale.netWeight, 0);
    const avgPricePerKg = totalNetWeight > 0 ? totalIncome / totalNetWeight : 0;

    const totalTaps = sessionHistory.reduce((sum, s) => sum + s.tappedTrees, 0);
    const avgIncomePerTap = totalTaps > 0 ? totalIncome / totalTaps : 0;
    
    // --- START: New intelligent analysis based on plantation size ---
    let avgIncomePerDay = 0;
    let avgWeightPerDay = 0;

    // A "day" is defined as one full tapping cycle of the plantation.
    if (plantationSize && plantationSize > 0 && totalTaps > 0) {
        // Calculate how many full plantation cycles the user has logged.
        const equivalentTappingDays = totalTaps / plantationSize;
        if (equivalentTappingDays > 0) {
            // Average income per full plantation cycle
            avgIncomePerDay = totalIncome / equivalentTappingDays;
            // Average weight per full plantation cycle
            avgWeightPerDay = totalNetWeight / equivalentTappingDays;
        }
    }
    // --- END: New intelligent analysis ---

    return {
        totalIncome,
        avgPricePerKg,
        avgIncomePerTap,
        avgIncomePerDay, // New metric
        avgWeightPerDay, // New metric
        hasData: true
    };
}

/**
 * NEW: Analyzes the most recent sale to provide instant feedback.
 * @param {object} lastSale - The sale object that was just added.
 * @returns {object} An object with instant analysis for the result modal.
 */
export function calculateLastSaleAnalysis(lastSale) {
    if (!lastSale) return { pricePerKg: 0, estimatedNextIncome: 0 };

    const pricePerKg = lastSale.netWeight > 0 ? lastSale.totalAmount / lastSale.netWeight : 0;
    
    let estimatedNextIncome = 0;
    if (state.plantationSize && state.plantationSize > 0) {
        // Find average weight per tap across all history
        const analytics = calculateSalesAnalytics(); // Use the main function
        if (analytics.hasData) {
            const totalTaps = state.sessionHistory.reduce((sum, s) => sum + s.tappedTrees, 0);
            const totalNetWeight = state.salesHistory.reduce((sum, sale) => sum + sale.netWeight, 0);
            if (totalTaps > 0 && totalNetWeight > 0) {
                const avgWeightPerTap = totalNetWeight / totalTaps;
                // Estimate income for a full plantation tap using the *current* sale's price
                estimatedNextIncome = avgWeightPerTap * state.plantationSize * pricePerKg;
            }
        }
    }
    
    return {
        pricePerKg,
        estimatedNextIncome
    };
}