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
            case 'collect_x_materials':
                // Target for collecting materials, e.g., 10 materials
                target = 10;
                break;
            case 'own_x_rare_trees':
                // Target for owning a number of rare trees
                target = 2; // Example: Own 2 Rare trees
                break;
            case 'perform_x_fusions':
                // Target for performing a number of fusions
                target = 1;
                break;
            // Add cases for other mission types/IDs if they require specific target generation
        }

        let missionText = template.text.replace('{target}', target);
        // If it's a dynamic target like 'beat_last_avg', ensure the text updates with the calculated target.
        // This is handled above for 'beat_last_avg' within its case.

        newMissions.push({
            id: template.id,
            text: missionText, // Use the updated text with dynamic target
            target: target,
            key: template.key,
            type: template.type, // Make sure type is included
            comparison: template.comparison || 'more', // Default comparison is 'more'
            reward: template.reward,
            completed: false,
            progress: 0 // Initialize progress for UI display
        });
    }

    state.activeMissions = newMissions; 
    saveStateObject('activeMissions', state.activeMissions);
    saveStateItem('lastMissionCheckDate', today); // Use a distinct key for this system
}

/**
 * Checks all active missions against the latest session's performance or overall player state.
 * This function is expanded to handle different mission types (session, cumulative, etc.).
 * @param {object} sessionStats Data from the completed session (for session-based missions).
 */
export function checkMissionCompletion(sessionStats) {
    if (!state.activeMissions) return;

    let totalCoinsEarned = 0; // Accumulate coins from all missions completed in this check

    state.activeMissions.forEach(mission => {
        if (mission.completed) return; // Skip if already completed

        let isComplete = false;
        let currentValue = 0;
        
        // --- Determine the source of data based on mission type ---
        switch (mission.type) {
            case 'session':
                if (sessionStats) { // Ensure sessionStats is provided for this type
                    currentValue = sessionStats[mission.key];
                }
                break;
            case 'cumulative':
                // Cumulative missions check against the player's overall state
                if (mission.key === 'totalRareTrees') {
                    currentValue = (state.playerTrees || []).filter(tree => tree.rarity === 'Rare').length;
                }
                // Add other cumulative checks here, e.g., total materials collected
                break;
            case 'action':
                // Action-based missions are checked when the action occurs (e.g., in breeding.js)
                // This part of the function might not be called for action missions,
                // but we handle it here for completeness if needed.
                currentValue = mission.progress; // Assume progress is updated elsewhere
                break;
            default:
                console.warn(`Unknown mission type: ${mission.type}`);
                return;
        }

        if (currentValue === undefined || currentValue === null) {
            // This is a soft warning, as not all mission types are checked on session end
            if (mission.type === 'session') {
                console.warn(`Mission '${mission.id}' depends on key '${mission.key}', but it's missing in sessionStats.`);
            }
            return; 
        }

        // Perform comparison based on mission's `comparison` type
        if (mission.comparison === 'less') {
            if (currentValue < mission.target) isComplete = true;
        } else { // Default to 'more' or 'equal'
            if (currentValue >= mission.target) isComplete = true;
        }

        if (isComplete) {
            mission.completed = true;
            mission.progress = mission.target; // Set progress to target to show completion
            totalCoinsEarned += mission.reward;
            // Show a toast for each completed mission
            showToast({ title: `สำเร็จภารกิจ! +${mission.reward.toLocaleString()} เหรียญ`, lucideIcon: 'check-circle', customClass: 'mission-complete' });
            
            // Play mission complete sound
            if (state.animationEffectsEnabled && dom.missionCompleteSound) { 
                dom.missionCompleteSound.currentTime = 0; // Rewind for immediate replay
                dom.missionCompleteSound.play().catch(e => console.error("Mission complete sound failed:", e));
            }
        } else {
             // Update progress if not completed, for UI display
             // Ensure progress is capped at target to avoid exceeding it visually
             mission.progress = Math.min(currentValue, mission.target);
        }
    });

    if (totalCoinsEarned > 0) {
        state.userCoins += totalCoinsEarned; 
        saveStateItem('userCoins', state.userCoins); // Save total earned coins
    }
    saveStateObject('activeMissions', state.activeMissions); // Save updated mission states
}

/**
 * Specifically checks and updates progress for 'action' type missions.
 * This function should be called from the relevant action (e.g., after a tree fusion).
 * @param {string} actionId The ID of the action (e.g., 'fusion_performed').
 */
export function checkActionMission(actionId) {
    if (!state.activeMissions) return;
    
    // Find missions that are triggered by this action
    const relevantMissions = state.activeMissions.filter(m => m.key === actionId && !m.completed);

    if (relevantMissions.length > 0) {
        let missionCompleted = false;
        let totalCoinsEarned = 0;

        relevantMissions.forEach(mission => {
            mission.progress = (mission.progress || 0) + 1; // Increment progress
            
            if (mission.progress >= mission.target) {
                mission.completed = true;
                missionCompleted = true; // Flag that at least one mission was completed
                
                totalCoinsEarned += mission.reward;
                showToast({ title: `สำเร็จภารกิจ! +${mission.reward.toLocaleString()} เหรียญ`, lucideIcon: 'check-circle', customClass: 'mission-complete' });
                
                if (state.animationEffectsEnabled && dom.missionCompleteSound) {
                    dom.missionCompleteSound.currentTime = 0;
                    dom.missionCompleteSound.play().catch(e => console.error("Sound failed:", e));
                }
            }
        });
        
        if (missionCompleted) {
            state.userCoins += totalCoinsEarned;
            saveStateItem('userCoins', state.userCoins);
        }
        saveStateObject('activeMissions', state.activeMissions); // Save progress regardless
    }
}