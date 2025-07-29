// --- START OF FILE main.js ---

/*
======================================
  Rubber Tapper's Log - main.js
  This is the main entry point of the application.
  It initializes the app and sets up all event listeners.
======================================
*/

// --- Module Imports ---
import * as dom from './dom.js';
import { loadState, saveStateItem, saveStateObject, clearStateItem, state } from './state.js'; 
import { 
    showScreen, 
    toggleTheme, 
    renderAchievements, 
    renderHistory, 
    updateGoalDisplay, 
    renderDashboardCharts, 
    applyPurchasedTheme,
    updateUserProfile,
    updateUserCoinBalance,
    renderMissions,
    hideLevelUpModal,
    renderThemeShop,
    showToast,
    renderSoundShop, 
    applyPurchasedSoundPack, 
    updateAnimationToggle, 
    animateCoins,
    hideTreeSelectionModal,
    adjustSetupScreenForUser,
    showSaleModal,
    hideSaleModal,
    setupSaleModalListeners,
    renderSalesDashboard,
    displaySaleResult,
    showDailyRewardModal,
    hideDailyRewardModal,
    updateNotificationIndicators // --- START: Import the new function ---
} from './ui.js';
import { startSession, initiateTreeTap, finalizeTreeTap, endSession } from './session.js';
import { generateNewMissions } from './missions.js'; 
import { grantCoins, setAIGoal, getAITreeSuggestion } from './analysis.js';
import { loadGameData, gameData } from './gameDataService.js';
import { renderUpgrades, purchaseUpgrade } from './upgrades.js';
import { renderPlantation, checkAllTreeGrowth, handleCloseTreeInfo } from './plantation.js';
import { initializeBreedingScreen } from './breeding.js';
import { initializeMarketplace } from './marketplace.js';


/**
 * The main function to start the application.
 */
async function initializeApp() {
    try {
        await loadGameData();

        loadState();
        
        checkAllTreeGrowth();
        
        applyPurchasedTheme(state.activeTheme);
        applyPurchasedSoundPack(state.activeSoundPack); 
        
        generateNewMissions(); 
        checkDailyLoginBonus();
        setAIGoal();
        updateUserProfile(); 
        updateUserCoinBalance();
        updateGoalDisplay();
        updateAnimationToggle();
        updateNotificationIndicators(); // --- START: Call on app load ---
        
        adjustSetupScreenForUser(); // Let UI function handle UI state

        setupEventListeners();
        setupSaleModalListeners();
        showScreen(dom.setupScreen, true); // Add flag to hide header on initial load
        lucide.createIcons();
    } catch (error) {
        console.error("Failed to initialize app: Game data could not be loaded.", error);
        dom.body.innerHTML = `
            <div style="text-align: center; padding: 20px; font-family: 'Sarabun', sans-serif; color: #e53e3e;">
                <h1>เกิดข้อผิดพลาด!</h1>
                <p>ไม่สามารถโหลดข้อมูลเกมได้ กรุณาลองใหม่ในภายหลัง หรือตรวจสอบการเชื่อมต่ออินเทอร์เน็ต</p>
                <p>Error: ${error.message}</p>
            </div>
        `;
    }
}

/**
 * Checks for daily login bonus and shows the reward modal if eligible.
 */
function checkDailyLoginBonus() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastLogin = state.lastLoginDate ? new Date(state.lastLoginDate) : null;
    if (lastLogin) {
        lastLogin.setHours(0, 0, 0, 0);
    }

    if (lastLogin && today.getTime() === lastLogin.getTime()) {
        return;
    }

    let newStreak = 1;
    if (lastLogin) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastLogin.getTime() === yesterday.getTime()) {
            newStreak = state.loginStreakCount + 1;
        }
    }
    
    if (newStreak > gameData.dailyRewards.length) {
        newStreak = 1;
    }

    state.loginStreakCount = newStreak;
    showDailyRewardModal(newStreak, state.claimedDailyRewards || []);
}

/**
 * Handles the logic when the user claims their daily reward.
 */
function handleClaimReward() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentStreak = state.loginStreakCount;
    const rewardData = gameData.dailyRewards.find(r => r.day === currentStreak);

    if (!rewardData) {
        console.error("No reward data found for streak:", currentStreak);
        hideDailyRewardModal();
        return;
    }

    switch (rewardData.type) {
        case 'coins':
            grantCoins(rewardData.amount);
            animateCoins(rewardData.amount, dom.claimDailyRewardBtn);
            showToast({ title: `ได้รับ ${rewardData.amount.toLocaleString()} เหรียญ!`, lucideIcon: 'coins' });
            break;
        case 'material':
            if (!state.materials[rewardData.item]) {
                state.materials[rewardData.item] = 0;
            }
            state.materials[rewardData.item] += rewardData.amount;
            saveStateObject('materials', state.materials);
            const materialInfo = gameData.treeMaterials[rewardData.item];
            showToast({ title: `ได้รับ ${rewardData.amount}x ${materialInfo.name}!`, lucideIcon: materialInfo.icon || 'package' });
            break;
        case 'random_seed':
             const availableSpecies = Object.keys(gameData.treeSpecies).filter(key => 
                (gameData.treeSpecies[key].rarity || 'Common') === rewardData.rarity
            );
            if (availableSpecies.length > 0) {
                const randomSpeciesKey = availableSpecies[Math.floor(Math.random() * availableSpecies.length)];
                const speciesData = gameData.treeSpecies[randomSpeciesKey];
                const newSeed = {
                     treeId: `tree_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                     species: randomSpeciesKey,
                     rarity: speciesData.rarity || 'Common',
                     level: 1,
                     exp: 0,
                     growthStage: 'Seed',
                     specialAttributes: speciesData.baseAttributes || {},
                     isNew: true, // --- START: Add isNew property for daily rewards ---
                };
                if (!state.playerTrees) state.playerTrees = [];
                state.playerTrees.push(newSeed);
                saveStateObject('playerTrees', state.playerTrees);
                showToast({ title: `ได้รับเมล็ดพันธุ์!<br>1x ${speciesData.name} (${speciesData.rarity})`, lucideIcon: 'package', customClass: 'mission-complete' });
            }
            break;
    }
    
    saveStateItem('lastLoginDate', today.toISOString());
    saveStateItem('loginStreakCount', currentStreak);

    if (!state.claimedDailyRewards) state.claimedDailyRewards = [];
    if (state.claimedDailyRewards.length >= 7) state.claimedDailyRewards = [];
    state.claimedDailyRewards.push(currentStreak);
    saveStateObject('claimedDailyRewards', state.claimedDailyRewards);


    updateUserCoinBalance();
    hideDailyRewardModal();
}

/**
 * Handles the start session button click.
 * This function determines the goal and initiates the session.
 */
function handleStartSession() {
    const isNewUser = !state.sessionHistory || state.sessionHistory.length === 0;
    let treeCountGoal;

    if (isNewUser) {
        // For new users, set a fixed starting goal.
        treeCountGoal = 50; 
        showToast({ title: 'เยี่ยมเลย! มาเริ่มบันทึก 50 ต้นแรกกัน', lucideIcon: 'rocket' });
    } else {
        // For existing users, get the AI-suggested goal.
        treeCountGoal = getAITreeSuggestion();
        showToast({ title: `💡 AI แนะนำ: กรีด ${treeCountGoal} ต้น`, lucideIcon: 'lightbulb' });
    }
    
    // Pass the determined goal to the session logic.
    startSession(treeCountGoal);
}


/**
 * Sets up all the event listeners for the entire application.
 */
function setupEventListeners() {
    // --- Session Control ---
    dom.startSessionBtn.addEventListener('click', handleStartSession);
    dom.startTappingTreeBtn.addEventListener('click', initiateTreeTap);
    dom.activeTapZone.addEventListener('click', finalizeTreeTap);

    dom.endSessionBtn.addEventListener('click', () => endSession(false));
    dom.endSessionFullBtn.addEventListener('click', () => endSession(true));
    dom.endSessionBtnDesktop.addEventListener('click', () => endSession(false));
    dom.endSessionFullBtnDesktop.addEventListener('click', () => endSession(true));
    
    dom.newSessionBtn.addEventListener('click', () => {
        loadState(); 
        setAIGoal();
        updateGoalDisplay();
        updateUserProfile(); 
        updateUserCoinBalance();
        generateNewMissions(); 
        adjustSetupScreenForUser(); // Re-adjust UI for the new session
        showScreen(dom.setupScreen);
    });

    // --- Header and Main Navigation ---
    dom.themeToggleBtn.addEventListener('click', toggleTheme);
    dom.settingsBtn.addEventListener('click', () => showScreen(dom.settingsScreen));
    dom.achievementsBtn.addEventListener('click', () => {
        renderAchievements();
        showScreen(dom.achievementsScreen);
    });
    dom.dashboardBtn.addEventListener('click', () => {
        renderDashboardCharts();
        showScreen(dom.dashboardScreen);
    });
    dom.historyBtn.addEventListener('click', () => {
        renderHistory();
        showScreen(dom.historyScreen);
    });
    dom.goalsBtn.addEventListener('click', () => {
        updateGoalDisplay();
        showScreen(dom.goalsScreen);
    });
    dom.missionsBtn.addEventListener('click', () => {
        renderMissions(); 
        showScreen(dom.missionsScreen);
    });
    dom.shopBtn.addEventListener('click', () => {
        renderThemeShop();
        showScreen(dom.themeShopScreen);
    });
    dom.soundShopBtn.addEventListener('click', () => { 
        renderSoundShop();
        showScreen(dom.soundShopScreen);
    });
    dom.upgradesBtn.addEventListener('click', () => {
        renderUpgrades();
        showScreen(dom.upgradesScreen);
    });
    dom.plantationBtn.addEventListener('click', () => {
        renderPlantation();
        showScreen(dom.plantationScreen);
        // --- START: Clear notification when entering the screen ---
        if (state.playerTrees.some(t => t.isNew)) {
            state.playerTrees.forEach(t => t.isNew = false);
            saveStateObject('playerTrees', state.playerTrees);
            updateNotificationIndicators();
        }
        // --- END: Clear notification ---
    });
    dom.breedingNavBtn.addEventListener('click', () => {
        initializeBreedingScreen();
        showScreen(dom.breedingScreen);
    });
    dom.marketplaceNavBtn.addEventListener('click', () => {
        initializeMarketplace(); 
        showScreen(dom.marketplaceScreen);
    });
    dom.logSaleBtn.addEventListener('click', showSaleModal);

    // --- "Back to Main" Buttons ---
    dom.backToMainBtn.addEventListener('click', () => showScreen(dom.setupScreen));
    dom.backToMainFromHistoryBtn.addEventListener('click', () => showScreen(dom.setupScreen));
    dom.backToMainFromGoalsBtn.addEventListener('click', () => showScreen(dom.setupScreen));
    dom.backToMainFromDashboardBtn.addEventListener('click', () => showScreen(dom.setupScreen));
    dom.backToMainFromSettingsBtn.addEventListener('click', () => showScreen(dom.setupScreen));
    dom.backToMainFromMissionsBtn.addEventListener('click', () => showScreen(dom.setupScreen));
    dom.backToMainFromShopBtn.addEventListener('click', () => showScreen(dom.setupScreen));
    dom.backToMainFromSoundShopBtn.addEventListener('click', () => showScreen(dom.setupScreen));
    dom.backToMainFromUpgradesBtn.addEventListener('click', () => showScreen(dom.setupScreen));
    dom.backToMainFromPlantationBtn.addEventListener('click', () => {
        handleCloseTreeInfo();
        showScreen(dom.setupScreen);
    });
    dom.backToMainFromBreedingBtn.addEventListener('click', () => showScreen(dom.setupScreen));
    dom.backToMainFromMarketplaceBtn.addEventListener('click', () => showScreen(dom.setupScreen));
    
    // --- Modals ---
    dom.closeLevelUpModalBtn.addEventListener('click', hideLevelUpModal);
    dom.claimDailyRewardBtn.addEventListener('click', handleClaimReward);
    dom.closeTreeSelectionModalBtn.addEventListener('click', hideTreeSelectionModal);
    dom.treeSelectionModal.addEventListener('click', (event) => {
        if (event.target === dom.treeSelectionModal) {
            hideTreeSelectionModal();
        }
    });
    dom.closeSaleModalBtn.addEventListener('click', hideSaleModal);
    dom.saleModal.addEventListener('click', (event) => {
        if (event.target === dom.saleModal) {
            hideSaleModal();
        }
    });
    dom.saleForm.addEventListener('submit', handleSaleSubmit);


    // --- Shop Interactions ---
    dom.themeShopGrid.addEventListener('click', handleThemeShopClick);
    dom.soundShopGrid.addEventListener('click', handleSoundShopClick);
    dom.upgradesList.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button || button.disabled) return;
        const card = event.target.closest('.upgrade-card');
        if (card && card.dataset.upgradeId) {
            purchaseUpgrade(card.dataset.upgradeId);
        }
    });

    // --- Settings ---
    dom.animationEffectsToggle.addEventListener('change', () => {
        state.animationEffectsEnabled = dom.animationEffectsToggle.checked;
        saveStateItem('animationEffectsEnabled', state.animationEffectsEnabled);
        showToast({title: `เอฟเฟกต์แอนิเมชัน: ${state.animationEffectsEnabled ? 'เปิด' : 'ปิด'}`, lucideIcon: 'sparkles'});
    });
    dom.exportDataBtn.addEventListener('click', exportData);
    dom.importFileInput.addEventListener('change', importData);
    dom.resetDataBtn.addEventListener('click', resetAllData);
}

function handleSaleSubmit(event) {
    event.preventDefault();

    const weight = parseFloat(dom.saleWeightInput.value);
    const deduction = parseFloat(dom.saleDeductionInput.value) || 0;
    const totalAmount = parseFloat(dom.saleAmountInput.value);
    const isGross = !dom.saleWeightTypeToggle.checked;

    if (isNaN(weight) || weight <= 0 || isNaN(totalAmount) || totalAmount <= 0) {
        showToast({ title: 'ข้อมูลไม่ถูกต้อง', lucideIcon: 'alert-circle' });
        return;
    }

    let netWeight = isGross ? weight * (1 - (deduction / 100)) : weight;

    const newSale = {
        saleDate: new Date().toISOString(),
        grossWeight: isGross ? weight : netWeight / (1 - (deduction / 100)),
        deductionPercent: deduction,
        netWeight: netWeight,
        totalAmount: totalAmount
    };

    state.salesHistory.push(newSale);
    saveStateObject('salesHistory', state.salesHistory);

    displaySaleResult(newSale); 
    
    if (dom.dashboardScreen.classList.contains('active')) {
        renderSalesDashboard();
    }
}

function handleThemeShopClick(event) {
    const card = event.target.closest('.theme-card');
    if (!card) return;
    const button = card.querySelector('button');
    if (button && button.disabled) return; 
    const themeId = card.dataset.themeId;
    const theme = gameData.themeShopItems[themeId];
    if (!theme) return;
    const isUnlocked = state.unlockedThemes.includes(themeId);
    if (isUnlocked) {
        applyPurchasedTheme(themeId);
        renderThemeShop(); 
        showToast({title: `เปิดใช้งานธีม "${theme.name}" แล้ว`, lucideIcon: 'palette'});
    } else {
        if (state.userCoins >= theme.price) {
            if (confirm(`คุณต้องการซื้อธีม "${theme.name}" ในราคา ${theme.price.toLocaleString()} เหรียญหรือไม่?`)) {
                state.userCoins -= theme.price;
                saveStateItem('userCoins', state.userCoins);
                updateUserCoinBalance();
                state.unlockedThemes.push(themeId);
                saveStateObject('unlockedThemes', state.unlockedThemes);
                applyPurchasedTheme(themeId);
                renderThemeShop();
                showToast({title: `<strong>ซื้อสำเร็จ!</strong><br>เปิดใช้งานธีม "${theme.name}" แล้ว`, lucideIcon: 'shopping-cart'});
                animateCoins(theme.price * -1, button);
            }
        } else {
            showToast({title: 'เหรียญของคุณไม่เพียงพอ', lucideIcon: 'alert-circle'});
        }
    }
}

function handleSoundShopClick(event) {
    const card = event.target.closest('.sound-card');
    if (!card) return;
    const button = card.querySelector('button');
    if (button && button.disabled) return; 
    const soundPackId = card.dataset.soundPackId;
    const soundPack = gameData.soundShopItems[soundPackId];
    if (!soundPack) return;
    const isUnlocked = state.unlockedSoundPacks.includes(soundPackId);
    if (isUnlocked) {
        applyPurchasedSoundPack(soundPackId);
        renderSoundShop(); 
        showToast({title: `เปิดใช้งานแพ็กเสียง "${soundPack.name}" แล้ว`, lucideIcon: 'volume-2'});
    } else {
        if (state.userCoins >= soundPack.price) {
            if (confirm(`คุณต้องการซื้อแพ็กเสียง "${soundPack.name}" ในราคา ${soundPack.price.toLocaleString()} เหรียญหรือไม่?`)) {
                state.userCoins -= soundPack.price;
                saveStateItem('userCoins', state.userCoins);
                updateUserCoinBalance();
                state.unlockedSoundPacks.push(soundPackId);
                saveStateObject('unlockedSoundPacks', state.unlockedSoundPacks);
                applyPurchasedSoundPack(soundPackId);
                renderSoundShop();
                showToast({title: `<strong>ซื้อสำเร็จ!</strong><br>เปิดใช้งานแพ็กเสียง "${soundPack.name}" แล้ว`, lucideIcon: 'shopping-cart'});
                animateCoins(soundPack.price * -1, button);
            }
        } else {
            showToast({title: 'เหรียญของคุณไม่เพียงพอ', lucideIcon: 'alert-circle'});
        }
    }
}

function exportData() {
    const dataToExport = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        dataToExport[key] = localStorage.getItem(key);
    }
    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date();
    const dateString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    a.download = `rubber-tapper-log-backup-${dateString}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast({title: 'ไฟล์สำรองข้อมูลกำลังจะถูกดาวน์โหลด...', lucideIcon: 'download'});
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!confirm('คำเตือน! การนำเข้าข้อมูลจะเขียนทับข้อมูลปัจจุบันทั้งหมด คุณแน่ใจหรือไม่ว่าจะดำเนินการต่อ?')) {
        event.target.value = null;
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (typeof importedData.sessionHistory === 'undefined' || typeof importedData.userLevel === 'undefined') {
                throw new Error("รูปแบบไฟล์สำรองไม่ถูกต้องหรือไม่สมบูรณ์");
            }
            localStorage.clear();
            Object.keys(importedData).forEach(key => {
                if (importedData[key] !== null && importedData[key] !== undefined) {
                    localStorage.setItem(key, importedData[key]);
                }
            });
            alert('นำเข้าข้อมูลสำเร็จ! แอพพลิเคชันจะทำการรีโหลดเพื่อใช้ข้อมูลใหม่');
            window.location.reload();
        } catch (error) {
            alert(`เกิดข้อผิดพลาดในการนำเข้าไฟล์: ${error.message}`);
        } finally {
            event.target.value = null;
        }
    };
    reader.readAsText(file);
}

function resetAllData() {
    if (confirm('คำเตือน! การรีเซ็ตข้อมูลจะลบข้อมูลทั้งหมดของคุณ รวมถึงประวัติ, สถิติ, เหรียญ, เลเวล, และการปลดล็อกธีม คุณแน่ใจหรือไม่?')) {
        if (confirm('คุณยืนยันอีกครั้งหรือไม่ว่าจะลบข้อมูลทั้งหมด? การกระทำนี้ไม่สามารถย้อนกลับได้!')) {
            localStorage.clear();
            alert('ลบข้อมูลทั้งหมดเรียบร้อยแล้ว! แอพพลิเคชันจะรีโหลดเพื่อเริ่มต้นใหม่');
            window.location.reload();
        }
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);