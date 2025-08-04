// --- START OF FILE gameDataService.js ---

/*
======================================
  Rubber Tapper's Log - gameDataService.js
  Handles loading and providing access to game configuration data.
======================================
*/

/**
 * @typedef {Object} GameConfig
 * @property {string} motd
 * @property {Array<Object>} missions
 * @property {Array<Object>} research
 * @property {Array<Object>} traderDeals
 * @property {Object} currentSeason
 * @property {Object} activeWeekendEvent
 * @property {Array<Object>} leaderboard
 * @property {Array<string>} avatars
 * @property {Array<Object>} skills
 * @property {Object} achievements // We'll add this structure here
 * @property {Object} themeShopItems // We'll add this structure here
 * @property {Object} soundShopItems // We'll add this structure here
 * @property {Object} gameBalance // New: For XP/Coin rates, etc.
 * @property {Array<Object>} missionTemplates // New: For daily mission generation
 * @property {Object} items // New: For in-game items like seeds and coins
 */

/** @type {GameConfig | null} */
export let gameData = null;

/**
 * Loads game configuration data from game_data.json.
 * This function must be called and awaited before other modules try to access gameData.
 * @returns {Promise<GameConfig>} A promise that resolves with the loaded game data.
 * @throws {Error} If the data fails to load or parse.
 */
export async function loadGameData() {
    try {
        const response = await fetch('game_data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // --- Add/Override game data based on our existing app logic ---
        // This is crucial for integrating game_data.json with existing state.js data,
        // and provides a central place to manage game balance and content.

        // Default achievements (previously in state.js, now managed here)
        data.achievements = {
            'master_tapper': { title: 'นักกรีดมือฉมัง', description: 'กรีดครบ 1,000 ต้น', lucideIcon: 'swords', type: 'trees', target: 1000, coinReward: 250 },
            'speed_demon':   { title: 'เจ้าแห่งความเร็ว', description: 'เฉลี่ยต่ำกว่า 30 วิ/ต้น', lucideIcon: 'zap', type: 'speed', target: 30, coinReward: 150 },
            'marathoner':    { title: 'มาราธอน', description: 'กรีดรวดเดียว 500+ ต้น', lucideIcon: 'footprints', type: 'session', target: 500, coinReward: 200 }
        };

        // Default theme shop items (previously in state.js, now managed here)
        data.themeShopItems = {
            'default-light': { id: 'default-light', name: 'สว่าง (ค่าเริ่มต้น)', price: 0, isDefault: true },
            'default-dark': { id: 'default-dark', name: 'มืด (ค่าเริ่มต้น)', price: 0, isDefault: true, isDark: true },
            'forest': { id: 'forest', name: 'ป่าไม้', price: 200, variables: { '--bg-color': '#EAF2E8', '--container-bg': '#FFFFFF', '--primary-color': '#3A6B35', '--xp-bar-fill': '#5A9C54' } },
            'ocean': { id: 'ocean', name: 'มหาสมุทร', price: 250, variables: { '--bg-color': '#E6F4F1', '--container-bg': '#FFFFFF', '--primary-color': '#006D77', '--xp-bar-fill': '#2A9D8F' } },
            'sunset': { id: 'sunset', name: 'ตะวันตกดิน', price: 300, variables: { '--bg-color': '#FFF2E6', '--container-bg': '#FFFFFF', '--primary-color': '#E76F51', '--xp-bar-fill': '#F4A261' } },
            'midnight': { id: 'midnight', name: 'เที่ยงคืน', price: 400, isDark: true, variables: { '--bg-color': '#0D1B2A', '--container-bg': '#1B263B', '--primary-color': '#E0E1DD', '--xp-bar-fill': '#778DA9' } }
        };

        // Default sound shop items (previously in state.js, now managed here)
        data.soundShopItems = {
            'default': { id: 'default', name: 'เสียงค่าเริ่มต้น', price: 0, isDefault: true, sounds: { tap: 'sounds/click.mp3', achievement: 'sounds/success.mp3', mission: 'sounds/mission.mp3' } },
            'jungle_rhythms': { id: 'jungle_rhythms', name: 'จังหวะป่า', price: 150, sounds: { tap: 'sounds/jungle_tap.mp3', achievement: 'sounds/jungle_success.mp3', mission: 'sounds/jungle_mission.mp3' } },
        };

        // Mission templates (previously in missions.js, now managed here)
        data.missionTemplates = [
            { id: 'tap_x_trees', text: 'กรีดยางให้ครบ {target} ต้นในรอบเดียว', type: 'session', key: 'tappedTrees', reward: 50 },
            { id: 'avg_time_under_x', text: 'ทำความเร็วเฉลี่ยต่ำกว่า {target} วินาที', type: 'session', key: 'avgTime', comparison: 'less', reward: 75 },
            { id: 'beat_last_avg', text: 'ทำเวลาให้ดีกว่ารอบที่แล้ว ({target} วิ/ต้น)', type: 'session', key: 'avgTime', comparison: 'less', dynamicTarget: 'lastAvgTime', reward: 100 },
            { id: 'session_over_x_min', text: 'กรีดยางต่อเนื่องนานกว่า {target} นาที', type: 'session', key: 'totalTime', reward: 60 }
        ];

        // Game balance configurations (New addition to game_data)
        data.gameBalance = {
            BASE_XP_PER_LEVEL: 100, // Base XP for level 1 -> 2
            RECORD_BONUS_COINS: 25, // Coins for new best average time
            DAILY_LOGIN_BASE_COINS: 10, // Base coins for daily login
            DAILY_LOGIN_STREAK_INCREMENT: 5, // Additional coins per streak day
            LEVEL_UP_BASE_COINS: 50, // Base coins for level up
            LEVEL_UP_COINS_PER_LEVEL: 5, // Additional coins per level on level up
            AI_GOAL_MIN_SESSIONS: 5, // Minimum sessions required for AI to set a meaningful goal
            AI_GOAL_LOOKBACK_SESSIONS: 10, // Number of recent sessions to consider for AI goal
            AI_GOAL_PERCENT_IMPROVEMENT: 0.98, // Target for AI goal (e.g., 0.98 means 98% of best avg)
            AI_GOAL_MIN_TIME: 15, // Minimum possible AI goal time (seconds/tree)
            AI_GOAL_MAX_TIME: 60 // Maximum possible AI goal time (seconds/tree)
        };

        // Items (New addition to game_data)
        data.items = {
            seed: {
                name: 'เมล็ดพันธุ์',
                description: 'ใช้สำหรับปลูกต้นไม้ใหม่',
                icon: 'seedling' // ตัวอย่างไอคอน
            },
            coin: {
                name: 'เหรียญ',
                description: 'สกุลเงินในเกม',
                icon: 'coins' // ตัวอย่างไอคอน
            }
        };

        gameData = data; // Assign loaded data to the exported variable
        console.log('Game data loaded successfully:', gameData);
        return gameData;
    } catch (error) {
        console.error('Failed to load game data:', error);
        throw error; // Re-throw to propagate the error
    }
}

// Note: You can add an initialization call here if you want to ensure it's loaded
// as soon as the module is imported, but it's often better to explicitly call it
// in main.js where you control the app's startup flow.
// loadGameData(); // Don't uncomment unless you want auto-load on import