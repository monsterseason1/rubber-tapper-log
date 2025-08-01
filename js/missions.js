// --- START OF FILE js/missions.js ---

import { state, saveStateObject, saveStateItem } from './state.js';
import { showToast } from './ui.js';
import * as dom from './dom.js'; 
import { gameData } from './gameDataService.js'; // Import gameData

/**
 * Generates new missions for the day if they haven't been generated yet or if the date changes.
 * This function will replace the mission generation logic previously in analysis.js.
 */
export function generateNewMissions() {
    const today = new Date().toISOString().slice(0, 10);
    
    // Check if missions for today have already been generated and are valid.
    const isMissionsGeneratedToday = state.lastMissionCheckDate === today && state.activeMissions && state.activeMissions.length > 0;
    
    // Also, check for outdated mission data (e.g., missing a 'reward' property) to force regeneration.
    const isMissionDataOutdated = state.activeMissions && state.activeMissions.length > 0 && !state.activeMissions[0].hasOwnProperty('reward');

    if (isMissionsGeneratedToday && !isMissionDataOutdated) {
        return; // Already generated for today and data is valid.
    }

    const newMissions = [];
    // Fetch MISSION_TEMPLATES from gameData
    const availableTemplates = [...gameData.missionTemplates]; // Clone to modify

    for (let i = 0; i < 3; i++) { // Generate 3 missions for the day
        if (availableTemplates.length === 0) break; // No more templates left
        
        const randomIndex = Math.floor(Math.random() * availableTemplates.length);
        const template = availableTemplates.splice(randomIndex, 1)[0]; // Remove selected template to prevent duplicates
        
        let target = 0;
        // Personalize targets based on user's historical performance
        const lastFiveSessions = state.sessionHistory ? state.sessionHistory.slice(-5) : [];
        const lastSession = state.sessionHistory && state.sessionHistory.length > 0 ? state.sessionHistory[state.sessionHistory.length-1] : null;

        switch (template.id) {
            case 'tap_x_trees':
                // Target is based on average trees from last 5 sessions, rounded up, with a minimum.
                const avgTreesLastFive = lastFiveSessions.reduce((sum, s) => sum + s.tappedTrees, 0) / lastFiveSessions.length || 0;
                target = Math.ceil(avgTreesLastFive / 10) * 10 || 100; 
                if (target < 50) target = 50; 
                break;
            case 'avg_time_under_x':
                // Target is 10% faster than user's best average time, with a minimum.
                target = state.bestAvgTime ? parseFloat((state.bestAvgTime * 0.9).toFixed(2)) : 40; 
                if (target < 20) target = 20; 
                break;
            case 'session_over_x_min':
                // Target is 5 minutes more than average total session time (converted to minutes), with a minimum.
                const avgTotalTimeSecLastFive = lastFiveSessions.reduce((sum, s) => sum + s.totalTime, 0) / lastFiveSessions.length || 0;
                target = Math.ceil(avgTotalTimeSecLastFive / 60) + 5 || 30; 
                if (target < 10) target = 10; 
                break;
            case 'beat_last_avg':
                // Target is 5% faster than the last session's average time, with a minimum.
                target = lastSession ? parseFloat((lastSession.avgTime * 0.95).toFixed(2)) : 45; 
                if (target < 20) target = 20; 
                break;
            // NEW: Cases for Plantation/Breeding Missions
            case 'perform_x_fusions':
                // Target for performing a number of fusions
                target = 1;
                break;
            case 'own_x_rare_trees':
                // Target for owning a number of rare trees
                target = (state.playerTrees || []).filter(t => t.rarity === 'Rare').length + 1; // Target is to get one more
                if (target < 2) target = 2;
                break;
            case 'upgrade_any_tree':
                target = 1;
                break;
            // Add cases for other mission types/IDs if they require specific target generation
        }

        let missionText = template.text.replace('{target}', target);
        
        newMissions.push({
            id: template.id,
            text: missionText,
            target: target,
            key: template.key,
            type: template.type,
            comparison: template.comparison || 'more',
            reward: template.reward,
            completed: false,
            progress: 0
        });
    }

    state.activeMissions = newMissions; 
    saveStateObject('activeMissions', state.activeMissions);
    saveStateItem('lastMissionCheckDate', today);
}

/**
 * Checks all active missions against the latest session's performance or overall player state.
 * This function is expanded to handle different mission types (session, cumulative, etc.).
 * @param {object} sessionStats Data from the completed session (for session-based missions).
 */
export function checkMissionCompletion(sessionStats) {
    if (!state.activeMissions) return;

    let totalCoinsEarned = 0;
    let missionCompleted = false;

    state.activeMissions.forEach(mission => {
        if (mission.completed) return;

        let isComplete = false;
        let currentValue = 0;
        
        switch (mission.type) {
            case 'session':
                if (sessionStats) {
                    currentValue = sessionStats[mission.key];
                    if (mission.key === 'totalTime') currentValue /= 60; // Convert seconds to minutes for this mission
                }
                break;
            case 'cumulative':
                if (mission.key === 'totalRareTrees') {
                    currentValue = (state.playerTrees || []).filter(tree => tree.rarity === 'Rare').length;
                }
                break;
            case 'action':
                // This is handled by checkActionMission, but we check progress here too.
                currentValue = mission.progress;
                break;
            default:
                return;
        }

        if (currentValue === undefined || currentValue === null) return; 

        if (mission.comparison === 'less') {
            if (currentValue < mission.target && currentValue > 0) isComplete = true; // Added > 0 check for avgTime
        } else {
            if (currentValue >= mission.target) isComplete = true;
        }

        if (isComplete) {
            mission.completed = true;
            mission.progress = mission.target;
            totalCoinsEarned += mission.reward;
            missionCompleted = true;
            showToast({ title: `สำเร็จภารกิจ! +${mission.reward.toLocaleString()} เหรียญ`, lucideIcon: 'check-circle', customClass: 'mission-complete' });
            
            if (state.animationEffectsEnabled && dom.missionCompleteSound) { 
                dom.missionCompleteSound.currentTime = 0;
                dom.missionCompleteSound.play().catch(e => console.error("Sound failed:", e));
            }
        } else if (mission.type !== 'action') {
             mission.progress = Math.min(currentValue, mission.target);
        }
    });

    if (missionCompleted) {
        state.userCoins += totalCoinsEarned; 
        saveStateItem('userCoins', state.userCoins);
    }
    saveStateObject('activeMissions', state.activeMissions);
}

/**
 * Specifically checks and updates progress for 'action' type missions.
 * This function should be called from the relevant action (e.g., after a tree fusion).
 * @param {string} actionId The ID of the action (e.g., 'fusion_performed').
 */
export function checkActionMission(actionId) {
    if (!state.activeMissions) return;
    
    let missionCompletedThisAction = false;
    let totalCoinsEarned = 0;
    
    state.activeMissions.forEach(mission => {
        if (mission.completed || mission.type !== 'action' || mission.key !== actionId) {
            return;
        }
        
        mission.progress = (mission.progress || 0) + 1;
        
        if (mission.progress >= mission.target) {
            mission.completed = true;
            missionCompletedThisAction = true;
            totalCoinsEarned += mission.reward;
            showToast({ title: `สำเร็จภารกิจ! +${mission.reward.toLocaleString()} เหรียญ`, lucideIcon: 'check-circle', customClass: 'mission-complete' });
            
            if (state.animationEffectsEnabled && dom.missionCompleteSound) {
                dom.missionCompleteSound.currentTime = 0;
                dom.missionCompleteSound.play().catch(e => console.error("Sound failed:", e));
            }
        }
    });
        
    if (missionCompletedThisAction) {
        state.userCoins += totalCoinsEarned;
        saveStateItem('userCoins', state.userCoins);
    }
    // Save progress regardless of completion
    saveStateObject('activeMissions', state.activeMissions);
}