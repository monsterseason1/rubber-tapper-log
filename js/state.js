// --- START OF FILE js/state.js ---

/*
======================================
  Rubber Tapper's Log - state.js
  Manages application state and localStorage.
======================================
*/

import { gameData } from './gameDataService.js';

export let state = {};
export let sessionState = {};

/**
 * Saves a single key-value pair to localStorage and updates the live state.
 * @param {string} key The key for the localStorage item.
 * @param {any} value The value to save. Can be string, number, boolean, null. Use JSON.stringify for objects/arrays.
 */
export function saveStateItem(key, value) {
    try {
        localStorage.setItem(key, value);
        // We ensure the live state is also updated. This is safe for primitive types.
        state[key] = value;
    } catch (e) {
        console.error(`Error saving state item for key "${key}":`, e);
    }
}

/**
 * --- START: REVISED FUNCTION ---
 * Saves an object or array to localStorage by converting it to a JSON string.
 * IMPORTANT: This function ONLY saves to localStorage. It no longer modifies the live 'state' object.
 * The calling function is responsible for mutating the state object directly.
 * @param {string} key The key for the localStorage item.
 * @param {object | Array<any>} value The object or array to save.
 */
export function saveStateObject(key, value) {
    try {
        const stringValue = JSON.stringify(value);
        localStorage.setItem(key, stringValue);
        // The line `state[key] = value;` has been REMOVED.
        // This prevents the state object's reference from being replaced,
        // which was the root cause of the stale state bug.
    } catch (e) {
        console.error(`Error saving state object for key "${key}":`, e);
    }
}
// --- END: REVISED FUNCTION ---


/**
 * Loads the initial state from localStorage.
 */
export function loadState() {
    let playerTrees = [];
    try {
        const storedTrees = localStorage.getItem('playerTrees');
        if (storedTrees) {
            const parsed = JSON.parse(storedTrees);
            if (Array.isArray(parsed)) {
                playerTrees = parsed;
            }
        }
    } catch (error) {
        console.warn('Could not parse playerTrees from localStorage. Defaulting to an empty array.', error);
        playerTrees = [];
    }
    
    if (Array.isArray(playerTrees)) {
        let needsSave = false;
        playerTrees.forEach(tree => {
            if (tree.isNew === undefined) {
                tree.isNew = false;
                needsSave = true;
            }
        });
        if (needsSave) {
            saveStateObject('playerTrees', playerTrees);
        }
    }

    const sessionHistory = JSON.parse(localStorage.getItem('sessionHistory')) || [];
    const bestAvgTime = parseFloat(localStorage.getItem('bestAvgTime')) || null;
    let bestSessionLapTimes = null;

    const storedBestLapTimes = JSON.parse(localStorage.getItem('bestSessionLapTimes')) || null;
    if (storedBestLapTimes && Array.isArray(storedBestLapTimes) && storedBestLapTimes.length > 0) {
        bestSessionLapTimes = storedBestLapTimes;
    } else if (bestAvgTime && sessionHistory.length > 0) {
        const bestSession = sessionHistory.find(s => s.avgTime === bestAvgTime);
        if (bestSession && bestSession.lapTimes && Array.isArray(bestSession.lapTimes)) {
            bestSessionLapTimes = bestSession.lapTimes;
        }
    }
    
    const materials = JSON.parse(localStorage.getItem('materials')) || {};
    const activeTreeId = localStorage.getItem('activeTreeId') || null;
    const marketplace = JSON.parse(localStorage.getItem('marketplace')) || { myListings: [] };
    const salesHistory = JSON.parse(localStorage.getItem('salesHistory')) || [];
    const realPlantationLayout = JSON.parse(localStorage.getItem('realPlantationLayout')) || [];

    state = {
        bestAvgTime: bestAvgTime,
        lifetimeTrees: parseInt(localStorage.getItem('lifetimeTrees'), 10) || 0,
        unlockedAchievements: JSON.parse(localStorage.getItem('unlockedAchievements')) || [],
        sessionHistory: sessionHistory,
        goalAvgTime: parseFloat(localStorage.getItem('goalAvgTime')) || null,
        lastSessionDate: localStorage.getItem('lastSessionDate') || null,
        bestSessionLapTimes: bestSessionLapTimes,

        userLevel: parseInt(localStorage.getItem('userLevel'), 10) || 1,
        userXp: parseInt(localStorage.getItem('userXp'), 10) || 0,
        activeMissions: JSON.parse(localStorage.getItem('activeMissions')) || [],
        lastMissionCheckDate: localStorage.getItem('lastMissionCheckDate') || null,
        
        userCoins: parseInt(localStorage.getItem('userCoins'), 10) || 0,
        unlockedThemes: JSON.parse(localStorage.getItem('unlockedThemes')) || [], 
        activeTheme: localStorage.getItem('activeTheme') || '', 
        unlockedSoundPacks: JSON.parse(localStorage.getItem('unlockedSoundPacks')) || [], 
        activeSoundPack: localStorage.getItem('activeSoundPack') || '',

        upgrades: JSON.parse(localStorage.getItem('upgrades')) || {},

        playerTrees: playerTrees,
        materials: materials,
        activeTreeId: activeTreeId,
        marketplace: marketplace,

        salesHistory: salesHistory,

        plantationSize: parseInt(localStorage.getItem('plantationSize'), 10) || null,
        tappedTreesInCurrentCycle: parseInt(localStorage.getItem('tappedTreesInCurrentCycle'), 10) || 0,

        isMappingModeActive: localStorage.getItem('isMappingModeActive') === 'true',
        realPlantationLayout: realPlantationLayout,

        lastLoginDate: localStorage.getItem('lastLoginDate') || null,
        loginStreakCount: parseInt(localStorage.getItem('loginStreakCount'), 10) || 0,

        animationEffectsEnabled: localStorage.getItem('animationEffectsEnabled') === 'false' ? false : true 
    };

    // --- Data Migration & Initialization for new properties ---

    if (!gameData) {
        console.error("Error: gameData is not loaded. Cannot initialize state dependent on gameData.");
        return; 
    }

    if ((!state.activeMissions || state.activeMissions.length === 0) && state.lastMissionCheckDate === null) {
        state.activeMissions = []; 
        saveStateObject('activeMissions', state.activeMissions);
    }
    
    if (!state.unlockedThemes || state.unlockedThemes.length === 0) {
        state.unlockedThemes = Object.values(gameData.themeShopItems).filter(item => item.isDefault).map(item => item.id);
        saveStateObject('unlockedThemes', state.unlockedThemes);
    }
    if (!state.activeTheme || !state.unlockedThemes.includes(state.activeTheme)) {
        state.activeTheme = Object.values(gameData.themeShopItems).find(item => item.isDefault)?.id || Object.keys(gameData.themeShopItems)[0] || '';
        saveStateItem('activeTheme', state.activeTheme);
    }

    if (!state.unlockedSoundPacks || state.unlockedSoundPacks.length === 0) {
        state.unlockedSoundPacks = Object.values(gameData.soundShopItems).filter(item => item.isDefault).map(item => item.id);
        saveStateObject('unlockedSoundPacks', state.unlockedSoundPacks);
    }
    if (!state.activeSoundPack || !state.unlockedSoundPacks.includes(state.activeSoundPack)) {
        state.activeSoundPack = Object.values(gameData.soundShopItems).find(item => item.isDefault)?.id || Object.keys(gameData.soundShopItems)[0] || '';
        saveStateItem('activeSoundPack', state.activeSoundPack);
    }
    
    if (Object.keys(state.upgrades).length === 0 && gameData.upgrades) {
        const defaultUpgrades = {};
        for (const key in gameData.upgrades) {
            defaultUpgrades[key] = { level: 0 };
        }
        state.upgrades = defaultUpgrades;
        saveStateObject('upgrades', state.upgrades);
    }
    
    if (!state.playerTrees) {
        state.playerTrees = [];
        saveStateObject('playerTrees', state.playerTrees);
    }

    if (!state.materials || Object.keys(state.materials).length === 0) {
        state.materials = {};
        saveStateObject('materials', state.materials);
    }

    if (localStorage.getItem('animationEffectsEnabled') === null) {
        state.animationEffectsEnabled = true;
        saveStateItem('animationEffectsEnabled', state.animationEffectsEnabled);
    }
    
    if (!state.salesHistory) {
        state.salesHistory = [];
        saveStateObject('salesHistory', state.salesHistory);
    }

    if (state.sessionHistory.length === 0 && Array.isArray(state.playerTrees) && state.playerTrees.length === 1) {
        const initialTree = state.playerTrees[0];
        
        if (initialTree.growthStage !== 'Seed') {
            console.log("Sanitizing initial tree for new user. Converting to a usable Seed.");
            
            initialTree.growthStage = 'Seed';
            initialTree.level = 1;
            initialTree.exp = 0;
            
            delete initialTree.growsAtTimestamp;
            delete initialTree.lastWateredTimestamp;
            
            saveStateObject('playerTrees', state.playerTrees);
        }
    }
}

/**
 * Removes an item from localStorage and sets its value in the live state to null or a default.
 * @param {string} key The key of the item to remove.
 */
export function clearStateItem(key) {
    try {
        localStorage.removeItem(key);
        if (Object.prototype.hasOwnProperty.call(state, key)) {
            if (Array.isArray(state[key])) state[key] = [];
            else if (typeof state[key] === 'object' && state[key] !== null) state[key] = {};
            else if (typeof state[key] === 'number') state[key] = 0;
            else if (typeof state[key] === 'boolean') state[key] = false;
            else state[key] = null; 
        }
    } catch (e) {
        console.error(`Error clearing state item for key "${key}":`, e);
    }
}

/**
 * Resets the temporary session state to its default values.
 */
export function resetSessionState() {
    sessionState = {
        totalTrees: 0,
        tappedTrees: 0,
        startTime: null,
        lapStartTime: null,
        timerInterval: null,
        tapTimestamps: [],
        lapTimes: [],
        sessionLoot: {},
        currentAvgTime: 0,
        lastLapTime: 0,
        previousLapTime: 0,
        mapLayout: [],
        currentMapPosition: null
    };
}