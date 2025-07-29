// --- START OF FILE js/ui.js ---

/*
======================================
  Rubber Tapper's Log - ui.js
  Handles all UI rendering and manipulation.
======================================
*/

import * as dom from './dom.js';
import { state, sessionState, saveStateItem } from './state.js';
import { calculateStreak, getAICoachTip, getXpForNextLevel, calculateSalesAnalytics, calculateLastSaleAnalysis } from './analysis.js'; 
import { gameData } from './gameDataService.js';
import { renderPlantation } from './plantation.js';
import { initializeBreedingScreen } from './breeding.js';

let avgTimeChartInstance = null;
let treesTappedChartInstance = null;
const mainHeader = document.querySelector('.main-header');


// --- START: New Notification Logic ---

/**
 * Checks all relevant state properties and updates the notification dots on menu buttons.
 */
export function updateNotificationIndicators() {
    // Check for new trees in the plantation
    const hasNewTrees = state.playerTrees && state.playerTrees.some(tree => tree.isNew);
    const plantationDot = dom.plantationBtn.querySelector('.notification-dot');
    if (plantationDot) {
        plantationDot.classList.toggle('hidden', !hasNewTrees);
    }

    // Future checks can be added here, e.g., for missions or shop items
    // const hasCompletedMissions = state.activeMissions && state.activeMissions.some(m => m.completed && !m.claimed);
    // const missionDot = dom.missionsBtn.querySelector('.notification-dot');
    // if(missionDot) {
    //     missionDot.classList.toggle('hidden', !hasCompletedMissions);
    // }
}

// --- END: New Notification Logic ---


// --- UI Functions for Missions, Leveling & Shop ---

/**
 * Updates the user profile display in the header (Level and XP bar).
 */
export function updateUserProfile() {
    if (!dom.userProfileHeader) return; 
    const xpForNext = getXpForNextLevel(state.userLevel);
    const xpPercentage = xpForNext > 0 ? (state.userXp / xpForNext) * 100 : 0;

    dom.userLevelSpan.textContent = `เลเวล ${state.userLevel}`;
    const oldXpBarWidth = dom.userXpBar.style.width;
    dom.userXpBar.style.width = `${xpPercentage}%`;

    if (state.animationEffectsEnabled && oldXpBarWidth !== dom.userXpBar.style.width) {
        dom.userXpBar.classList.add('glow');
        setTimeout(() => {
            dom.userXpBar.classList.remove('glow');
        }, 500);
    }
}

/**
 * Updates the user coin balance display in the header.
 */
export function updateUserCoinBalance() {
    if (!dom.coinBalanceAmount) return; 
    const oldBalance = parseInt(dom.coinBalanceAmount.textContent.replace(/,/g, ''), 10) || 0;
    const newBalance = state.userCoins;

    if (state.animationEffectsEnabled && oldBalance !== newBalance) {
        animateNumber(dom.coinBalanceAmount, oldBalance, newBalance, 500);
    } else {
        dom.coinBalanceAmount.textContent = newBalance.toLocaleString();
    }
}

/**
 * Animates a number element from a start value to an end value.
 * @param {HTMLElement} element The DOM element to animate.
 * @param {number} startValue The starting number.
 * @param {number} endValue The target number.
 * @param {number} duration The animation duration in milliseconds.
 */
function animateNumber(element, startValue, endValue, duration) {
    let startTime = null;

    function frame(currentTime) {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const currentValue = Math.floor(startValue + (endValue - startValue) * progress);
        element.textContent = currentValue.toLocaleString();

        if (progress < 1) {
            requestAnimationFrame(frame);
        } else {
            element.textContent = endValue.toLocaleString();
            if (state.animationEffectsEnabled) {
                element.classList.add('anim-pop');
                setTimeout(() => element.classList.remove('anim-pop'), 300);
            }
        }
    }
    requestAnimationFrame(frame);
}


/**
 * Renders the list of daily missions on the missions screen.
 */
export function renderMissions() {
    if (!dom.missionsList) return; 
    dom.missionsList.innerHTML = '';

    if (!state.activeMissions || state.activeMissions.length === 0) {
        dom.missionsList.innerHTML = '<p class="info-text">ไม่มีภารกิจสำหรับวันนี้ กลับมาใหม่วันพรุ่งนี้นะ!</p>';
        return;
    }

    const missionElements = [];
    state.activeMissions.forEach((mission) => {
        const card = document.createElement('div');
        card.className = `mission-card ${mission.completed ? 'completed' : ''} anim-staggered-item`;
        
        const coinReward = mission.reward || 0; 
        const progressText = mission.completed || mission.target === 0 ? '' : ` (${mission.progress.toFixed(0)}/${mission.target.toFixed(0)})`; 

        card.innerHTML = `
            <div class="mission-icon">
                <i data-lucide="${mission.completed ? 'check-circle-2' : 'circle-dashed'}"></i>
            </div>
            <div class="mission-details">
                <h4>${mission.text}${progressText}</h4>
                <p>
                    <span class="mission-reward coin-reward"><i data-lucide="coins"></i> ${coinReward.toLocaleString()} เหรียญ</span>
                </p>
            </div>
        `;
        dom.missionsList.appendChild(card);
        missionElements.push(card);
    });
    lucide.createIcons({ nodes: dom.missionsList.querySelectorAll('i') });

    if (state.animationEffectsEnabled) {
        missionElements.forEach((el, i) => {
            setTimeout(() => {
                el.classList.add('loaded');
            }, i * 100);
        });
    } else {
        missionElements.forEach(el => el.classList.add('loaded'));
    }
}

/**
 * Shows the level up modal with the new level.
 * @param {number} newLevel The level the user just reached.
 */
export function showLevelUpModal(newLevel) {
    if (!dom.levelUpModal) return; 
    dom.levelUpText.textContent = `ยินดีด้วย! คุณไปถึงเลเวล ${newLevel} แล้ว!`;
    dom.levelUpModal.classList.remove('hidden');
    
    if (state.animationEffectsEnabled) {
        dom.userXpBar.style.width = '100%'; 
        setTimeout(() => { 
            dom.userXpBar.style.width = `${(state.userXp / getXpForNextLevel(state.userLevel)) * 100}%`;
            dom.userXpBar.classList.add('glow');
            setTimeout(() => {
                dom.userXpBar.classList.remove('glow');
            }, 500);
        }, 800);
    }

    lucide.createIcons({ nodes: [dom.levelUpModal.querySelector('i')] });
    if (state.animationEffectsEnabled) {
        const modalIcon = dom.levelUpModal.querySelector('.modal-icon i');
        if (modalIcon) {
            modalIcon.classList.add('anim-pop');
            setTimeout(() => modalIcon.classList.remove('anim-pop'), 500);
        }
    }
}

/**
 * Hides the level up modal.
 */
export function hideLevelUpModal() {
    if (dom.levelUpModal) {
        dom.levelUpModal.classList.add('hidden');
    }
}

/**
 * Shows the daily reward modal and renders the rewards.
 * @param {number} currentStreak - The user's current login streak.
 * @param {number[]} claimedRewards - An array of streak days already claimed this cycle.
 */
export function showDailyRewardModal(currentStreak, claimedRewards = []) {
    if (!dom.dailyRewardModal) return;

    dom.dailyRewardStreakText.textContent = `คุณล็อกอินต่อเนื่องเป็นวันที่ ${currentStreak} แล้ว!`;
    dom.dailyRewardGrid.innerHTML = ''; // Clear previous rewards

    gameData.dailyRewards.forEach(reward => {
        const card = document.createElement('div');
        const isClaimed = claimedRewards.includes(reward.day);
        const isToday = reward.day === currentStreak;

        let cardClass = 'reward-card';
        if (isClaimed) cardClass += ' claimed';
        if (isToday && !isClaimed) cardClass += ' today';
        
        card.className = cardClass;
        
        let icon = 'gift';
        let text = 'รางวัล';

        switch(reward.type) {
            case 'coins':
                icon = 'coins';
                text = `${reward.amount.toLocaleString()} เหรียญ`;
                break;
            case 'material':
                const materialInfo = gameData.treeMaterials[reward.item];
                if (materialInfo) {
                    icon = materialInfo.icon || 'package';
                    text = `${reward.amount}x ${materialInfo.name}`;
                }
                break;
            case 'random_seed':
                icon = 'package-plus';
                text = `เมล็ดพันธุ์ (${reward.rarity})`;
                break;
        }

        card.innerHTML = `
            <div class="day-label">วันที่ ${reward.day}</div>
            <div class="reward-icon"><i data-lucide="${isClaimed ? 'check-circle' : icon}"></i></div>
            <p class="reward-text">${text}</p>
        `;
        dom.dailyRewardGrid.appendChild(card);
    });

    lucide.createIcons({ nodes: dom.dailyRewardGrid.querySelectorAll('i') });

    dom.claimDailyRewardBtn.disabled = claimedRewards.includes(currentStreak);
    
    dom.dailyRewardModal.classList.remove('hidden');
}

/**
 * Hides the daily reward modal.
 */
export function hideDailyRewardModal() {
    if (dom.dailyRewardModal) {
        dom.dailyRewardModal.classList.add('hidden');
    }
}


/**
 * Renders the theme shop, showing all available themes.
 */
export function renderThemeShop() {
    if (!dom.themeShopGrid) return; 
    dom.themeShopGrid.innerHTML = '';

    const themeElements = [];
    const renderCard = (theme) => {
        const isUnlocked = state.unlockedThemes.includes(theme.id);
        const isActive = state.activeTheme === theme.id;
        const card = document.createElement('div');
        card.className = `theme-card ${isUnlocked ? 'unlocked' : ''} ${isActive ? 'active' : ''} anim-staggered-item`;
        card.dataset.themeId = theme.id;
        
        let previewHtml = '';
        if (theme.isDefault) {
            previewHtml = `<div class="theme-preview ${theme.id}"></div>`;
        } else {
            previewHtml = `
            <div class="theme-preview" style="background: linear-gradient(45deg, ${theme.variables['--bg-color']} 50%, ${theme.variables['--primary-color']} 50%);">
                <div style="width: 20px; height: 20px; background-color: ${theme.variables['--xp-bar-fill']}; border-radius: 50%; border: 1px solid rgba(0,0,0,0.1);"></div>
            </div>`;
        }

        let buttonHtml = '';
        if (isActive) {
            buttonHtml = `<button class="btn btn-secondary" disabled>ใช้งานอยู่</button>`;
        } else if (isUnlocked) {
            buttonHtml = `<button class="btn btn-secondary">ใช้ธีมนี้</button>`;
        } else {
            buttonHtml = `<button class="btn btn-primary theme-price" ${state.userCoins < theme.price ? 'disabled' : ''}><i data-lucide="coins"></i> ${theme.price.toLocaleString()}</button>`;
        }

        card.innerHTML = `
            ${previewHtml}
            <h4>${theme.name}</h4>
            <div class="button-container" style="padding: 0.75rem;">
                ${buttonHtml}
            </div>
        `;
        dom.themeShopGrid.appendChild(card);
        themeElements.push(card);
    };

    const allThemes = Object.values(gameData.themeShopItems);
    allThemes.filter(t => t.isDefault).forEach(renderCard);
    allThemes.filter(t => !t.isDefault).sort((a, b) => a.price - b.price).forEach(renderCard);

    lucide.createIcons({ nodes: dom.themeShopGrid.querySelectorAll('i')});

    if (state.animationEffectsEnabled) {
        themeElements.forEach((el, i) => {
            setTimeout(() => {
                el.classList.add('loaded');
            }, i * 100);
        });
    } else {
        themeElements.forEach(el => el.classList.add('loaded'));
    }
}

/**
 * Applies a selected theme's CSS variables to the root element.
 * @param {string} themeId The ID of the theme to apply.
 */
export function applyPurchasedTheme(themeId) {
    const theme = gameData.themeShopItems[themeId];
    if (!theme) {
        console.error(`Theme with ID '${themeId}' not found.`);
        return;
    }

    const isDark = theme.isDark || false; 
    dom.body.classList.toggle('dark-mode', isDark);

    const rootStyle = document.documentElement.style;
    Object.values(gameData.themeShopItems).forEach(item => {
        if (item.variables) {
            Object.keys(item.variables).forEach(key => rootStyle.removeProperty(key));
        }
    });

    if (theme.variables) {
        Object.entries(theme.variables).forEach(([key, value]) => {
            rootStyle.setProperty(key, value);
        });
    }
    
    saveStateItem('activeTheme', themeId); 
    if (dom.dashboardScreen && dom.dashboardScreen.classList.contains('active')) {
        renderDashboardCharts();
    }
}

/**
 * Renders the sound shop, showing all available sound packs.
 */
export function renderSoundShop() {
    if (!dom.soundShopGrid) return;
    dom.soundShopGrid.innerHTML = '';

    const soundElements = [];
    const renderCard = (soundPack) => {
        const isUnlocked = state.unlockedSoundPacks.includes(soundPack.id);
        const isActive = state.activeSoundPack === soundPack.id;
        const card = document.createElement('div');
        card.className = `sound-card ${isUnlocked ? 'unlocked' : ''} ${isActive ? 'active' : ''} anim-staggered-item`;
        card.dataset.soundPackId = soundPack.id;
        
        let buttonHtml = '';
        if (isActive) {
            buttonHtml = `<button class="btn btn-secondary" disabled>ใช้งานอยู่</button>`;
        } else if (isUnlocked) {
            buttonHtml = `<button class="btn btn-secondary">ใช้แพ็กนี้</button>`;
        } else {
            buttonHtml = `<button class="btn btn-primary sound-price" ${state.userCoins < soundPack.price ? 'disabled' : ''}><i data-lucide="coins"></i> ${soundPack.price.toLocaleString()}</button>`;
        }

        card.innerHTML = `
            <div class="sound-preview">
                <i data-lucide="volume-2"></i>
                <p>${soundPack.name}</p>
            </div>
            <div class="button-container" style="padding: 0.75rem;">
                ${buttonHtml}
            </div>
        `;
        dom.soundShopGrid.appendChild(card);
        soundElements.push(card);
    };

    const allSoundPacks = Object.values(gameData.soundShopItems);
    allSoundPacks.filter(s => s.isDefault).forEach(renderCard);
    allSoundPacks.filter(s => !s.isDefault).sort((a, b) => a.price - b.price).forEach(renderCard);

    lucide.createIcons({ nodes: dom.soundShopGrid.querySelectorAll('i')});

    if (state.animationEffectsEnabled) {
        soundElements.forEach((el, i) => {
            setTimeout(() => {
                el.classList.add('loaded');
            }, i * 100);
        });
    } else {
        soundElements.forEach(el => el.classList.add('loaded'));
    }
}

/**
 * Applies a selected sound pack by updating the audio element sources.
 * @param {string} soundPackId The ID of the sound pack to apply.
 */
export function applyPurchasedSoundPack(soundPackId) {
    const soundPack = gameData.soundShopItems[soundPackId];
    if (!soundPack) {
        console.error(`Sound pack with ID '${soundPackId}' not found.`);
        return;
    }

    if (dom.tapSound) dom.tapSound.src = soundPack.sounds.tap;
    if (dom.achievementSound) dom.achievementSound.src = soundPack.sounds.achievement;
    if (dom.missionCompleteSound) dom.missionCompleteSound.src = soundPack.sounds.mission;
    
    saveStateItem('activeSoundPack', soundPackId);
}

/**
 * Updates the state of the animation effects toggle in settings.
 */
export function updateAnimationToggle() {
    if (dom.animationEffectsToggle) {
        dom.animationEffectsToggle.checked = state.animationEffectsEnabled;
    }
}


// --- Core UI Functions ---

/**
 * Hides all screens and shows the specified screen.
 * @param {HTMLElement} screenToShow The DOM element of the screen to display.
 * @param {boolean} [isInitialLoad=false] Flag for the very first screen load.
 * @param {boolean} [isTapping=false] Flag to indicate if we are in the active tapping state.
 */
export function showScreen(screenToShow, isInitialLoad = false, isTapping = false) {
    dom.allScreens.forEach(screen => screen.classList.remove('active'));
    screenToShow.classList.add('active');
    
    // Manage header visibility
    if (mainHeader) {
        if (isInitialLoad || isTapping) {
            mainHeader.style.display = 'none';
        } else {
            mainHeader.style.display = 'grid';
        }
    }
    // Manage body class for full-screen tapping
    dom.body.classList.toggle('is-tapping', isTapping);

    if (state.animationEffectsEnabled && !isTapping) {
        const screenContent = screenToShow.querySelector('.screen-content');
        if (screenContent) {
            screenContent.classList.remove('anim-slide-in-up');
            void screenContent.offsetWidth;
            screenContent.classList.add('anim-slide-in-up');
        }
    }

    if (screenToShow === dom.setupScreen) {
        updateDynamicInfoPanel();
        adjustSetupScreenForUser();
        updateNotificationIndicators(); // --- START: Call notification update
    }
}

/**
 * Adjusts the visibility and content of setup screen elements based on user history.
 */
export function adjustSetupScreenForUser() {
    if (!dom.setupScreen) return;

    const isNewUser = !state.sessionHistory || state.sessionHistory.length === 0;
    const inputGroup = dom.totalTreesInput.parentElement;
    const logSaleBtn = dom.logSaleBtn;

    // Always hide the manual input group as it's deprecated
    if (inputGroup) inputGroup.classList.add('hidden');
    
    // Adjust the main start button text and visibility of sale button
    if (isNewUser) {
        dom.startSessionBtn.innerHTML = '<i data-lucide="play-circle"></i> เริ่มบันทึกครั้งแรก!';
        if(logSaleBtn) logSaleBtn.style.display = 'none';
    } else {
        dom.startSessionBtn.innerHTML = '<i data-lucide="play-circle"></i> เริ่มบันทึกการกรีด';
        if(logSaleBtn) logSaleBtn.style.display = 'flex';
    }
    
    // Refresh icons for the buttons
    lucide.createIcons({
        nodes: [dom.startSessionBtn, logSaleBtn].filter(Boolean).map(el => el.querySelector('i')).filter(Boolean)
    });
}


/**
 * Formats seconds into HH:MM:SS string.
 * @param {number} seconds The total number of seconds.
 * @returns {string} Formatted time string.
 */
export function formatTime(seconds) {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

/**
 * Toggles between light and dark default themes.
 */
export function toggleTheme() {
    const currentTheme = gameData.themeShopItems[state.activeTheme];
    if (currentTheme && !currentTheme.isDefault) {
        showToast({ title: 'คุณกำลังใช้ธีมพิเศษ', lucideIcon: 'palette', customClass: 'info' });
        showToast({ title: 'หากต้องการเปลี่ยนธีม กรุณาเลือกในร้านค้าธีม', lucideIcon: 'store', customClass: 'info' });
        return;
    }
    
    const newThemeId = dom.body.classList.contains('dark-mode') ? 'default-light' : 'default-dark';
    applyPurchasedTheme(newThemeId);
}

/**
 * Displays a toast notification.
 * @param {object} options - Options for the toast.
 * @param {string} options.title - The main text/title of the toast. Can include HTML.
 * @param {string} [options.lucideIcon='info'] - Lucide icon name to display.
 * @param {string} [options.customClass=''] - Additional CSS class for custom styling.
 */
export function showToast({ title, lucideIcon = 'info', customClass = '' }) {
    const toast = document.createElement('div');
    toast.className = `toast ${customClass}`;
    toast.innerHTML = `<span class="icon"><i data-lucide="${lucideIcon}"></i></span> <div>${title}</div>`;
    dom.toastContainer.appendChild(toast);
    lucide.createIcons({ nodes: [toast.querySelector('i')] });
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500); 
    }, 4000); 
}

/**
 * Updates the progress bar visually during a session.
 * @param {number} tapped The number of trees tapped.
 * @param {number} total The total number of trees for the session goal.
 */
function updateProgressBar(tapped, total) {
    if (dom.progressBar) {
        // --- START: Reworked Progress Bar Logic ---
        // The total for the progress bar is ALWAYS the session goal.
        const totalForProgressBar = total;
        const currentTotalTapped = state.tappedTreesInCurrentCycle + tapped;

        const percentage = totalForProgressBar > 0 ? Math.min((currentTotalTapped / totalForProgressBar) * 100, 100) : 0;
        dom.progressBar.style.width = `${percentage}%`;
        // --- END: Reworked Progress Bar Logic ---
    }
}

/**
 * Updates all UI elements on the main tapping (prep) screen based on the current session state.
 */
export function updateTappingScreenUI() {
    // --- START: Reworked UI Logic ---
    const { 
        tappedTrees, // This is from sessionState, representing trees tapped in THIS sub-session
        totalTrees, // This is the session goal
        sessionLoot, 
        currentAvgTime, 
        lastLapTime, 
        previousLapTime 
    } = sessionState;

    const totalTappedInCycle = state.tappedTreesInCurrentCycle + tappedTrees;

    // Update tree counters and progress bar
    if (dom.currentTreeNumberSpan) dom.currentTreeNumberSpan.textContent = totalTappedInCycle + 1;
    if (dom.totalTreesDisplaySpan) {
        // The display now ALWAYS shows the session goal.
        dom.totalTreesDisplaySpan.textContent = totalTrees;
    }
    updateProgressBar(tappedTrees, totalTrees);

    // NEW: Update plantation size info display
    if (dom.plantationSizeInfoTapping) {
        if (state.plantationSize > 0) {
            dom.plantationSizeInfoTapping.textContent = `จากสวนทั้งหมด: ${state.plantationSize} ต้น`;
            dom.plantationSizeInfoTapping.style.display = 'block';
        } else {
            dom.plantationSizeInfoTapping.style.display = 'none';
        }
    }
    
    // Update loot display (no change here)
    renderSessionLoot(sessionLoot);

    // Update real-time stats (no change here)
    if (dom.rtAvgTimeSpan) dom.rtAvgTimeSpan.textContent = currentAvgTime.toFixed(2);
    if (dom.rtLastLapTimeSpan) dom.rtLastLapTimeSpan.textContent = lastLapTime.toFixed(2);
    
    // Update pacing indicator (no change here)
    if (dom.rtPacingIcon && tappedTrees > 1 && previousLapTime > 0) {
        const parentP = dom.rtLastLapTimeSpan.parentElement;
        parentP.classList.remove('faster', 'slower');

        if (lastLapTime < previousLapTime) {
            dom.rtPacingIcon.innerHTML = '<i data-lucide="arrow-down-right"></i>';
            parentP.classList.add('faster');
        } else if (lastLapTime > previousLapTime) {
            dom.rtPacingIcon.innerHTML = '<i data-lucide="arrow-up-right"></i>';
            parentP.classList.add('slower');
        } else {
            dom.rtPacingIcon.innerHTML = '<i data-lucide="minus"></i>';
        }
        lucide.createIcons({ nodes: dom.rtPacingIcon.querySelectorAll('i') });
    } else if (dom.rtPacingIcon) {
        dom.rtPacingIcon.innerHTML = ''; // Clear icon if not enough data
        const parentP = dom.rtLastLapTimeSpan.parentElement;
        parentP.classList.remove('faster', 'slower');
    }

    // Update button states
    const startButtonSpan = dom.startTappingTreeBtn.querySelector('span');
    if (startButtonSpan) {
        startButtonSpan.textContent = `กรีดต้นที่ ${totalTappedInCycle + 1}`;
    }
    
    if (dom.startTappingTreeBtn) dom.startTappingTreeBtn.disabled = false;
    if (dom.endSessionBtn) dom.endSessionBtn.disabled = false;
    
    // --- New logic to hide "Full Plantation" button ---
    const isFullPlantationKnown = state.plantationSize > 0;
    const fullPlantationButtons = [dom.endSessionFullBtn, dom.endSessionFullBtnDesktop];
    fullPlantationButtons.forEach(btn => {
        if (btn) {
            btn.style.display = isFullPlantationKnown ? 'none' : 'inline-flex';
            btn.disabled = false;
        }
    });
    // --- END: New logic to hide "Full Plantation" button ---

    if (dom.endSessionBtnDesktop) dom.endSessionBtnDesktop.disabled = false;
    // --- END: Reworked UI Logic ---
}

function showInfoBlock(activeBlock) {
    if (!activeBlock) return;
    dom.allInfoBlocks.forEach(block => {
        if (state.animationEffectsEnabled && block.classList.contains('active')) {
            block.classList.add('anim-fade-out');
            setTimeout(() => {
                block.classList.remove('active', 'anim-fade-out');
                activeBlock.classList.add('active');
            }, 300);
        } else {
            block.classList.remove('active', 'anim-fade-out');
            activeBlock.classList.add('active');
        }
    });
}

export function updateDynamicInfoPanel() {
    if (!dom.dynamicInfoPanel) return;

    const lastSession = state.sessionHistory.length > 0 ? state.sessionHistory[state.sessionHistory.length - 1] : null;

    const today = new Date();
    today.setHours(0,0,0,0);
    const lastLogin = state.lastLoginDate ? new Date(state.lastLoginDate) : null;
    if (lastLogin) lastLogin.setHours(0,0,0,0);

    if (state.loginStreakCount > 0 && lastLogin && lastLogin.getTime() === today.getTime()) {
        dom.dailyLoginStreakSpan.textContent = state.loginStreakCount;
        const nextBonus = gameData.gameBalance.DAILY_LOGIN_BASE_COINS + ((state.loginStreakCount + 1) * gameData.gameBalance.DAILY_LOGIN_STREAK_INCREMENT); 
        dom.dailyLoginRewardSpan.textContent = nextBonus.toLocaleString();
        showInfoBlock(dom.infoDailyLogin);
        return;
    }

    if (state.goalAvgTime && lastSession) {
        dom.goalTextSpan.textContent = `ทำความเร็วต่ำกว่า ${state.goalAvgTime.toFixed(2)} วิ/ต้น`;
        
        let progress = 0;
        if (state.bestAvgTime && state.bestAvgTime > state.goalAvgTime) {
            const range = state.bestAvgTime - state.goalAvgTime;
            const improvementNeeded = lastSession.avgTime - state.goalAvgTime;
            if (range > 0 && improvementNeeded > 0) {
                progress = 100 - ((improvementNeeded / range) * 100);
            } else if (lastSession.avgTime <= state.goalAvgTime) {
                progress = 100;
            }
        } else if (lastSession.avgTime <= state.goalAvgTime) {
            progress = 100;
        }
        
        dom.goalProgressBar.value = Math.max(0, Math.min(100, progress)); 
        dom.goalProgressValueSpan.textContent = `ครั้งล่าสุด: ${lastSession.avgTime.toFixed(2)} วิ/ต้น`;
        showInfoBlock(dom.infoGoalProgress);
        return;
    }

    const nextAchievementKey = Object.keys(gameData.achievements).find(key => 
        !state.unlockedAchievements.includes(key) && gameData.achievements[key].type === 'trees'
    );
    if (nextAchievementKey) {
        const achievement = gameData.achievements[nextAchievementKey];
        const progress = (state.lifetimeTrees / achievement.target) * 100;
        if (progress > 50 && progress < 100) { 
            dom.achievementTextSpan.textContent = achievement.title;
            dom.achievementProgressBar.value = progress;
            dom.achievementProgressValueSpan.textContent = `${state.lifetimeTrees.toLocaleString()}/${achievement.target.toLocaleString()}`;
            showInfoBlock(dom.infoAchievementProgress);
            return;
        }
    }
    
    const streak = calculateStreak();
    if (streak > 1) { 
        dom.streakDaysSpan.textContent = streak;
        showInfoBlock(dom.infoStreak);
        return;
    }

    const aiTip = getAICoachTip();
    dom.infoWelcome.querySelector('p').textContent = aiTip;
    showInfoBlock(dom.infoWelcome);
}

export function renderSessionLoot(sessionLoot) {
    if (!dom.rtSessionLootContainer) return;

    dom.rtSessionLootContainer.innerHTML = '';

    if (Object.keys(sessionLoot).length === 0) {
        dom.rtSessionLootContainer.innerHTML = '<p class="no-loot-text">ยังไม่พบไอเทมในรอบนี้</p>';
        return;
    }

    Object.entries(sessionLoot).forEach(([key, quantity]) => {
        let icon = 'help-circle';
        let title = 'Unknown Item';

        if (key.endsWith('_seed')) {
            const speciesKey = key.replace('_seed', '');
            const speciesData = gameData.treeSpecies[speciesKey];
            if (speciesData) {
                icon = 'package';
                title = `${speciesData.name} (เมล็ด)`;
            }
        } else {
            const materialData = gameData.treeMaterials[key];
            if (materialData) {
                icon = materialData.icon || 'gem';
                title = materialData.name;
            }
        }
        
        const lootItemEl = document.createElement('div');
        lootItemEl.className = 'loot-item';
        lootItemEl.title = title;
        lootItemEl.innerHTML = `
            <i data-lucide="${icon}"></i>
            <span>${quantity}</span>
        `;
        dom.rtSessionLootContainer.appendChild(lootItemEl);
    });

    lucide.createIcons({ nodes: dom.rtSessionLootContainer.querySelectorAll('i') });
}

export function renderAchievements() {
    if (!dom.achievementsGrid) return;
    dom.lifetimeTreesSpan.textContent = state.lifetimeTrees.toLocaleString();
    dom.achievementsGrid.innerHTML = ''; 

    const achievementElements = [];
    Object.entries(gameData.achievements).forEach(([key, achievement]) => {
        const isUnlocked = state.unlockedAchievements.includes(key);
        const card = document.createElement('div');
        card.className = `achievement-card ${isUnlocked ? 'unlocked' : ''} anim-staggered-item`;
        card.innerHTML = `
            <div class="icon"><i data-lucide="${achievement.lucideIcon}"></i></div>
            <h4>${achievement.title}</h4>
            <p>${achievement.description}</p>
        `;
        dom.achievementsGrid.appendChild(card);
        achievementElements.push(card);
    });
    lucide.createIcons({ nodes: dom.achievementsGrid.querySelectorAll('i') });

    if (state.animationEffectsEnabled) {
        achievementElements.forEach((el, i) => {
            setTimeout(() => {
                el.classList.add('loaded');
            }, i * 100);
        });
    } else {
        achievementElements.forEach(el => el.classList.add('loaded'));
    }
}

export function renderHistory() {
    if (!dom.historyListContainer) return;
    dom.historyListContainer.innerHTML = ''; 
    if (state.sessionHistory.length === 0) {
        dom.historyListContainer.innerHTML = '<p class="info-text">ยังไม่มีประวัติการกรีด</p>';
        return;
    }
    const historyElements = [];
    [...state.sessionHistory].reverse().forEach(session => {
        const card = document.createElement('div');
        card.className = 'history-card anim-staggered-item';
        const sessionDate = new Date(session.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
        const sessionTime = new Date(session.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

        card.innerHTML = `
            <div class="history-card-header"><h4>ผลงานวันที่ ${sessionDate}</h4><span>${sessionTime}</span></div>
            <div class="history-stats">
                <p>จำนวน: <strong>${session.tappedTrees} ต้น</strong></p>
                <p>เวลาเฉลี่ย: <strong>${session.avgTime.toFixed(2)} วิ/ต้น</strong></p>
                <p>เวลาทั้งหมด: <strong>${formatTime(session.totalTime)}</strong></p>
            </div>
            <div class="history-ai-insight"><i data-lucide="brain-circuit" class="ai-insight-icon"></i> ${session.aiInsight || "ไม่มีการวิเคราะห์"}</div>
        `;
        dom.historyListContainer.appendChild(card);
        historyElements.push(card);
    });
    lucide.createIcons({ nodes: dom.historyListContainer.querySelectorAll('i') });

    if (state.animationEffectsEnabled) {
        historyElements.forEach((el, i) => {
            setTimeout(() => {
                el.classList.add('loaded');
            }, i * 100);
        });
    } else {
        historyElements.forEach(el => el.classList.add('loaded'));
    }
}

export function updateGoalDisplay() {
    if (state.goalAvgTime) {
        dom.currentGoalDisplay.textContent = `${state.goalAvgTime.toFixed(2)} วินาที/ต้น`; 
    } else {
        dom.currentGoalDisplay.textContent = 'ต้องการข้อมูลเพิ่มเพื่อตั้งเป้าหมาย';
    }
    updateDynamicInfoPanel();
}

export function renderDashboardCharts() {
    if (!dom.avgTimeChartCanvas || !dom.treesTappedChartCanvas) return;
    
    renderSalesDashboard();

    const avgTimeContainer = dom.avgTimeChartCanvas.closest('.chart-container');
    const treesTappedContainer = dom.treesTappedChartCanvas.closest('.chart-container');

    const lastTenSessions = state.sessionHistory.slice(-10);
    
    if (lastTenSessions.length < 2) { 
        if (avgTimeContainer) { avgTimeContainer.classList.remove('has-data'); avgTimeContainer.classList.add('no-data'); }
        if (treesTappedContainer) { treesTappedContainer.classList.remove('has-data'); treesTappedContainer.classList.add('no-data'); }
        lucide.createIcons({ nodes: avgTimeContainer ? avgTimeContainer.querySelectorAll('i, svg') : [] });
        lucide.createIcons({ nodes: treesTappedContainer ? treesTappedContainer.querySelectorAll('i, svg') : [] });
        if (avgTimeChartInstance) { avgTimeChartInstance.destroy(); avgTimeChartInstance = null; }
        if (treesTappedChartInstance) { treesTappedChartInstance.destroy(); treesTappedChartInstance = null; }
        return;
    }
    
    if (avgTimeContainer) { avgTimeContainer.classList.remove('no-data'); avgTimeContainer.classList.add('has-data'); }
    if (treesTappedContainer) { treesTappedContainer.classList.remove('no-data'); treesTappedContainer.classList.add('has-data'); }

    const labels = lastTenSessions.map((_, index) => `รอบที่ ${state.sessionHistory.length - lastTenSessions.length + index + 1}`);
    const avgTimeData = lastTenSessions.map(session => session.avgTime); 
    const treesTappedData = lastTenSessions.map(session => session.tappedTrees);

    if (avgTimeChartInstance) avgTimeChartInstance.destroy();
    if (treesTappedChartInstance) treesTappedChartInstance.destroy();

    const computedStyles = getComputedStyle(document.documentElement);
    const gridColor = computedStyles.getPropertyValue('--border-color').trim();
    const fontColor = computedStyles.getPropertyValue('--text-color').trim();
    const primaryColor = computedStyles.getPropertyValue('--primary-color').trim();
    const primaryBgColor = `${primaryColor}33`; 

    Chart.defaults.color = fontColor;
    Chart.defaults.borderColor = gridColor;
    Chart.defaults.font.family = "'Kanit', sans-serif";
    Chart.defaults.font.size = 14;

    avgTimeChartInstance = new Chart(dom.avgTimeChartCanvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'ความเร็วเฉลี่ย (วินาที/ต้น)',
                data: avgTimeData,
                fill: true,
                backgroundColor: primaryBgColor,
                borderColor: primaryColor,
                tension: 0.4, 
                pointBackgroundColor: primaryColor,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { reverse: true } },
            plugins: { tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${context.raw.toFixed(2)} วินาที` } } }
        }
    });

    treesTappedChartInstance = new Chart(dom.treesTappedChartCanvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'จำนวนต้นที่กรีด',
                data: treesTappedData,
                backgroundColor: primaryColor,
                borderRadius: 4,
                hoverBackgroundColor: primaryBgColor,
                borderColor: primaryColor,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${context.raw} ต้น` } } }
        }
    });
}

export function animateCoins(amount, originElement = null) {
    if (!state.animationEffectsEnabled) return;

    const coinBalanceRect = dom.coinBalanceAmount.getBoundingClientRect();
    const targetX = coinBalanceRect.left + (coinBalanceRect.width / 2);
    const targetY = coinBalanceRect.top + (coinBalanceRect.height / 2);

    let numCoins = Math.min(Math.abs(amount / 10), 10);
    if (numCoins === 0 && amount !== 0) numCoins = 1;

    for (let i = 0; i < numCoins; i++) {
        const coin = document.createElement('div');
        coin.className = 'coin-animation';
        coin.innerHTML = '<i data-lucide="coins"></i>';
        lucide.createIcons({ nodes: [coin.querySelector('i')] });
        
        let startX, startY;
        if (originElement) {
            const originRect = originElement.getBoundingClientRect();
            startX = originRect.left + (originRect.width / 2) + (Math.random() * 40 - 20);
            startY = originRect.top + (originRect.height / 2) + (Math.random() * 40 - 20);
        } else {
            startX = window.innerWidth / 2 + (Math.random() * 100 - 50);
            startY = window.innerHeight / 2 + (Math.random() * 100 - 50);
        }

        coin.style.left = `${startX}px`;
        coin.style.top = `${startY}px`;
        coin.style.opacity = '1';
        coin.style.transform = 'translate3d(0, 0, 0) scale(0.5)';

        if (dom.coinAnimationContainer) {
            dom.coinAnimationContainer.appendChild(coin);
        } else {
            document.body.appendChild(coin);
        }

        const translateX = targetX - startX;
        const translateY = targetY - startY;

        setTimeout(() => {
            coin.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(0.2)`;
            coin.style.opacity = '0';
        }, i * 50);

        const animationDuration = 800;
        setTimeout(() => {
            if (coin.parentNode) {
                coin.parentNode.removeChild(coin);
            }
        }, animationDuration + (i * 50) + 100);
    }
}

export function showTreeSelectionModal(onSelectCallback, excludeIndex = -1, filterFn = null) {
    if (!dom.treeSelectionModal || !dom.treeSelectionList) return;

    dom.treeSelectionList.innerHTML = '';

    let availableTrees = state.playerTrees || [];
    if (filterFn) {
        availableTrees = availableTrees.filter(filterFn);
    }

    if (availableTrees.length === 0) {
        dom.treeSelectionList.innerHTML = '<p class="info-text">ไม่มีต้นยางที่เข้าเงื่อนไขให้เลือก</p>';
    } else {
        const originalIndexMap = new Map(state.playerTrees.map((tree, index) => [tree.treeId, index]));

        availableTrees.forEach((tree) => {
            const originalIndex = originalIndexMap.get(tree.treeId);
            const treeData = gameData.treeSpecies[tree.species];
            if (!treeData) return;

            const card = document.createElement('div');
            card.className = 'tree-selection-card';
            card.dataset.treeIndex = originalIndex;

            if (originalIndex === excludeIndex) {
                card.classList.add('disabled');
            }
            
            const growthStage = tree.growthStage || 'Grown';
            let stageClass = '', stageText = '', cardIcon = treeData.icon || 'trees';

            switch (growthStage) {
                case 'Seed': stageClass = 'seed'; stageText = 'เมล็ด'; cardIcon = 'package'; break;
                case 'Seedling': stageClass = 'seedling'; stageText = 'ต้นกล้า'; cardIcon = 'sprout'; break;
                default: stageClass = `rarity-${tree.rarity.toLowerCase()}`;
            }

            card.innerHTML = `
                ${stageText ? `<div class="stage-badge-small ${stageClass}">${stageText}</div>` : ''}
                <div class="tree-icon"><i data-lucide="${cardIcon}"></i></div>
                <h4>${treeData.name}</h4>
                <p>${growthStage !== 'Grown' ? tree.rarity : `Lvl ${tree.level}`}</p>
            `;
            
            if (originalIndex !== excludeIndex) {
                card.addEventListener('click', () => {
                    onSelectCallback(tree, originalIndex);
                    hideTreeSelectionModal();
                });
            }

            dom.treeSelectionList.appendChild(card);
        });
    }

    lucide.createIcons({ nodes: dom.treeSelectionList.querySelectorAll('i') });
    dom.treeSelectionModal.classList.remove('hidden');
}


export function hideTreeSelectionModal() {
    if (dom.treeSelectionModal) {
        dom.treeSelectionModal.classList.add('hidden');
    }
}

export function showSaleModal() {
    if (!dom.saleModal) return;
    dom.saleForm.reset();
    dom.saleModalFormView.classList.remove('hidden');
    dom.saleModalResultView.classList.add('hidden');
    dom.saleModal.classList.remove('hidden');
    dom.saleWeightInput.dispatchEvent(new Event('input'));
}

export function hideSaleModal() {
    if (dom.saleModal) {
        dom.saleModal.classList.add('hidden');
    }
}

export function setupSaleModalListeners() {
    if (!dom.saleForm) return;

    const weightInput = dom.saleWeightInput;
    const typeToggle = dom.saleWeightTypeToggle;
    const deductionInput = dom.saleDeductionInput;
    const netWeightDisplay = dom.saleNetWeightDisplay;
    const confirmBtn = dom.confirmSaleBtn;
    const typeLabel = document.getElementById('sale-weight-type-label');

    const updateCalculations = () => {
        const weight = parseFloat(weightInput.value) || 0;
        const deduction = parseFloat(deductionInput.value) || 0;
        const isGross = !typeToggle.checked;

        let netWeight = 0;

        if (isGross) {
            netWeight = weight * (1 - (deduction / 100));
            deductionInput.disabled = false;
        } else {
            netWeight = weight;
            deductionInput.value = '';
            deductionInput.disabled = true;
        }
        
        netWeightDisplay.textContent = netWeight.toFixed(2);
        typeLabel.textContent = isGross ? 'ก่อนหัก %' : 'หลังหัก %';

        confirmBtn.disabled = !(weight > 0 && dom.saleAmountInput.value > 0 && (isGross ? deduction >= 0 : true));
    };

    weightInput.addEventListener('input', updateCalculations);
    typeToggle.addEventListener('change', updateCalculations);
    deductionInput.addEventListener('input', updateCalculations);
    dom.saleAmountInput.addEventListener('input', updateCalculations);
    
    dom.saleResultNewSaleBtn.addEventListener('click', () => {
        dom.saleModalResultView.classList.add('hidden');
        showSaleModal();
    });
    
    updateCalculations();
}

export function displaySaleResult(lastSale) {
    const analysis = calculateLastSaleAnalysis(lastSale);

    dom.saleResultPricePerKg.textContent = analysis.pricePerKg.toFixed(2);
    dom.saleResultEstIncome.textContent = analysis.estimatedNextIncome.toLocaleString('en-US', { maximumFractionDigits: 0 });

    dom.saleModalFormView.classList.add('hidden');
    dom.saleModalResultView.classList.remove('hidden');
}


export function renderSalesDashboard() {
    if (!dom.dashboardSalesCard) return;

    const analytics = calculateSalesAnalytics();

    if (!analytics.hasData) {
        dom.dashboardSalesCard.classList.add('is-empty');
        return;
    }

    dom.dashboardSalesCard.classList.remove('is-empty');
    dom.salesTotalIncome.textContent = analytics.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    dom.salesAvgPricePerKg.textContent = analytics.avgPricePerKg.toFixed(2);
    dom.salesAvgIncomePerTap.textContent = analytics.avgIncomePerTap.toFixed(2);
    
    dom.salesAvgIncomePerDay.textContent = analytics.avgIncomePerDay.toLocaleString('en-US', { maximumFractionDigits: 0 });
    dom.salesAvgWeightPerDay.textContent = analytics.avgWeightPerDay.toFixed(2);
    
    if (state.plantationSize && state.plantationSize > 0) {
        dom.plantationSizeInfo.textContent = `*คำนวณจากขนาดสวนที่บันทึกไว้: ${state.plantationSize} ต้น`;
        dom.plantationSizeInfo.style.display = 'block';
    } else {
        dom.plantationSizeInfo.style.display = 'none';
    }
}