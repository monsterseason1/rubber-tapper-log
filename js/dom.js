// --- START OF FILE dom.js ---

/*
======================================
  Rubber Tapper's Log - dom.js
  Exports all DOM element selections.
======================================
*/

// --- General ---
export const body = document.body;
export const allScreens = document.querySelectorAll('.screen');
export const toastContainer = document.getElementById('toast-container');
export const tapSound = document.getElementById('tap-sound');
export const achievementSound = document.getElementById('achievement-sound');
export const missionCompleteSound = document.getElementById('mission-complete-sound');

// --- Screens ---
export const setupScreen = document.getElementById('setup-screen');
export const tappingScreen = document.getElementById('tapping-screen');
export const summaryScreen = document.getElementById('summary-screen');
export const achievementsScreen = document.getElementById('achievements-screen');
export const historyScreen = document.getElementById('history-screen');
export const goalsScreen = document.getElementById('goals-screen');
export const dashboardScreen = document.getElementById('dashboard-screen');
export const settingsScreen = document.getElementById('settings-screen');
export const missionsScreen = document.getElementById('missions-screen');
export const themeShopScreen = document.getElementById('theme-shop-screen');
export const soundShopScreen = document.getElementById('sound-shop-screen');
export const upgradesScreen = document.getElementById('upgrades-screen');
export const plantationScreen = document.getElementById('plantation-screen');
export const breedingScreen = document.getElementById('breeding-screen');
export const marketplaceScreen = document.getElementById('marketplace-screen');


// --- Header ---
export const achievementsBtn = document.getElementById('achievements-btn');
export const themeToggleBtn = document.getElementById('theme-toggle-btn');
export const settingsBtn = document.getElementById('settings-btn');
export const shopBtn = document.getElementById('shop-btn');
export const soundShopBtn = document.getElementById('sound-shop-btn');
export const userProfileHeader = document.getElementById('user-profile');
export const userLevelSpan = document.getElementById('user-level');
export const userXpBar = document.getElementById('user-xp-bar');
export const coinBalanceAmount = document.getElementById('coin-balance-amount');

// --- Setup Screen & Dynamic Info Panel ---
export const totalTreesInput = document.getElementById('total-trees-input');
export const startSessionBtn = document.getElementById('start-session-btn');
export const dashboardBtn = document.getElementById('dashboard-btn');
export const historyBtn = document.getElementById('history-btn');
export const goalsBtn = document.getElementById('goals-btn');
export const missionsBtn = document.getElementById('missions-btn');
export const upgradesBtn = document.getElementById('upgrades-btn');
export const plantationBtn = document.getElementById('plantation-btn');
export const breedingNavBtn = document.getElementById('breeding-nav-btn');
export const marketplaceNavBtn = document.getElementById('marketplace-nav-btn');
export const logSaleBtn = document.getElementById('log-sale-btn');


export const dynamicInfoPanel = document.getElementById('dynamic-info-panel');
export const allInfoBlocks = dynamicInfoPanel.querySelectorAll('.info-block');
export const infoWelcome = document.getElementById('info-welcome');
export const infoStreak = document.getElementById('info-streak');
export const streakDaysSpan = document.getElementById('streak-days');
export const infoGoalProgress = document.getElementById('info-goal-progress');
export const goalTextSpan = document.getElementById('goal-text');
export const goalProgressBar = document.getElementById('goal-progress-bar');
export const goalProgressValueSpan = document.getElementById('goal-progress-value');
export const infoAchievementProgress = document.getElementById('info-achievement-progress');
export const achievementTextSpan = document.getElementById('achievement-text');
export const achievementProgressBar = document.getElementById('achievement-progress-bar');
export const achievementProgressValueSpan = document.getElementById('achievement-progress-value');
export const infoDailyLogin = document.getElementById('info-daily-login');
export const dailyLoginStreakSpan = document.getElementById('daily-login-streak');
export const dailyLoginRewardSpan = document.getElementById('daily-login-reward');


// --- Tapping Screen & Real-time Pacing Guide ---
export const currentTreeNumberSpan = document.getElementById('current-tree-number');
export const totalTreesDisplaySpan = document.getElementById('total-trees-display');
export const timerSpan = document.getElementById('timer');
export const progressBar = document.getElementById('progress-bar');
export const nextTreeBtn = document.getElementById('next-tree-btn');
export const endSessionBtn = document.getElementById('end-session-btn');
export const endSessionFullBtn = document.getElementById('end-session-full-btn');
export const pauseSessionBtn = document.getElementById('pause-session-btn');
export const pacingIndicator = document.getElementById('pacing-indicator');
export const pacingStatus = document.getElementById('pacing-status');
export const pacingTimeDiff = document.getElementById('pacing-time-diff');
export const realTimeStatsContainer = document.getElementById('real-time-stats-container');
export const rtAvgTimeSpan = document.getElementById('rt-avg-time');
export const rtLapTimeSpan = document.getElementById('rt-lap-time');
export const rtSessionLootContainer = document.getElementById('rt-session-loot-container');
export const pauseOverlay = document.getElementById('pause-overlay');
export const tappingHeader = document.querySelector('.tapping-header');
export const tappingFooter = document.querySelector('.tapping-footer');
export const pauseSessionBtnDesktop = document.getElementById('pause-session-btn-desktop');
export const endSessionBtnDesktop = document.getElementById('end-session-btn-desktop');
export const endSessionFullBtnDesktop = document.getElementById('end-session-full-btn-desktop');


// --- Summary Screen & AI Pacing Analysis ---
export const summaryTotalTrees = document.getElementById('summary-total-trees');
export const summaryTotalTime = document.getElementById('summary-total-time');
export const summaryAvgTime = document.getElementById('summary-avg-time');
export const newRecordBadge = document.getElementById('new-record-badge');
export const aiInsightText = document.getElementById('ai-insight-text');
export const newSessionBtn = document.getElementById('new-session-btn');
export const pacingAnalysisCard = document.getElementById('pacing-analysis-card');
export const pacingAnalysisText = document.getElementById('pacing-analysis-text');
export const pacingFirstHalf = document.getElementById('pacing-first-half');
export const pacingSecondHalf = document.getElementById('pacing-second-half');
export const coinAnimationContainer = document.getElementById('coin-animation-container');


// --- Achievements Screen ---
export const backToMainBtn = document.getElementById('back-to-main-btn');
export const achievementsGrid = document.getElementById('achievements-grid');
export const lifetimeTreesSpan = document.getElementById('lifetime-trees');

// --- History Screen ---
export const historyListContainer = document.getElementById('history-list-container');
export const backToMainFromHistoryBtn = document.getElementById('back-to-main-from-history-btn');

// --- Goals Screen ---
export const currentGoalDisplay = document.getElementById('current-goal-display');
export const backToMainFromGoalsBtn = document.getElementById('back-to-main-from-goals-btn');

// --- Dashboard Screen ---
export const backToMainFromDashboardBtn = document.getElementById('back-to-main-from-dashboard-btn');
export const avgTimeChartCanvas = document.getElementById('avg-time-chart');
export const treesTappedChartCanvas = document.getElementById('trees-tapped-chart');
export const dashboardSalesCard = document.getElementById('dashboard-sales-card');
export const salesAvgPricePerKg = document.getElementById('sales-avg-price-per-kg');
export const salesAvgIncomePerTap = document.getElementById('sales-avg-income-per-tap');
export const salesTotalIncome = document.getElementById('sales-total-income');
export const dashboardSalesEmptyState = document.getElementById('dashboard-sales-empty-state');
export const salesAvgIncomePerDay = document.getElementById('sales-avg-income-per-day');
export const salesAvgWeightPerDay = document.getElementById('sales-avg-weight-per-day');
export const plantationSizeInfo = document.getElementById('plantation-size-info');


// --- Settings Screen ---
export const exportDataBtn = document.getElementById('export-data-btn');
export const importFileInput = document.getElementById('import-file-input');
export const backToMainFromSettingsBtn = document.getElementById('back-to-main-from-settings-btn');
export const resetDataBtn = document.getElementById('reset-data-btn');
export const animationEffectsToggle = document.getElementById('animation-effects-toggle');


// --- Missions Screen ---
export const missionsList = document.getElementById('missions-list');
export const backToMainFromMissionsBtn = document.getElementById('back-to-main-from-missions-btn');

// --- Level Up Modal ---
export const levelUpModal = document.getElementById('level-up-modal');
export const levelUpText = document.getElementById('level-up-text');
export const closeLevelUpModalBtn = document.getElementById('close-level-up-modal-btn');

// --- Daily Reward Modal Elements ---
export const dailyRewardModal = document.getElementById('daily-reward-modal');
export const dailyRewardStreakText = document.getElementById('daily-reward-streak-text');
export const dailyRewardGrid = document.getElementById('daily-reward-grid');
export const claimDailyRewardBtn = document.getElementById('claim-daily-reward-btn');

// --- Theme Shop Screen ---
export const themeShopGrid = document.getElementById('theme-shop-grid');
export const backToMainFromShopBtn = document.getElementById('back-to-main-from-shop-btn');

// --- Sound Shop Screen elements ---
export const soundShopGrid = document.getElementById('sound-shop-grid');
export const backToMainFromSoundShopBtn = document.getElementById('back-to-main-from-sound-shop-btn');

// --- Upgrades Screen elements ---
export const upgradesList = document.getElementById('upgrades-list');
export const backToMainFromUpgradesBtn = document.getElementById('back-to-main-from-upgrades-btn');

// --- Plantation Screen elements ---
export const plantationGrid = document.getElementById('plantation-grid');
export const treeInfoPanel = document.getElementById('tree-info-panel');
export const selectedTreeName = document.getElementById('selected-tree-name');
export const selectedTreeSpecies = document.getElementById('selected-tree-species');
export const selectedTreeLevel = document.getElementById('selected-tree-level');
export const selectedTreeMaxLevel = document.getElementById('selected-tree-max-level');
export const treeExpBar = document.getElementById('tree-exp-bar');
export const selectedTreeExp = document.getElementById('selected-tree-exp');
export const selectedTreeExpNext = document.getElementById('selected-tree-exp-next');
export const treeAttributes = document.getElementById('tree-attributes');
export const treeMaterialsList = document.getElementById('tree-materials-list');
export const upgradeTreeBtn = document.getElementById('upgrade-tree-btn');
export const closeTreeInfoBtn = document.getElementById('close-tree-info-btn');
export const activateTreeBtn = document.getElementById('activate-tree-btn');
export const plantTreeBtn = document.getElementById('plant-tree-btn');
export const plantActionDescription = document.getElementById('plant-action-description');
export const seedlingCareSection = document.getElementById('seedling-care-section');
export const growthCountdown = document.getElementById('growth-countdown');
export const waterTreeBtn = document.getElementById('water-tree-btn');
export const fertilizeTreeBtn = document.getElementById('fertilize-tree-btn');
export const treeExpDisplay = document.querySelector('.tree-exp-display');
export const treeAttributesDisplay = document.querySelector('.tree-attributes-display');
export const treeMaterialsDisplay = document.querySelector('.tree-materials-display');
export const treeActions = document.querySelector('.tree-actions');
export const treePlantAction = document.querySelector('.tree-plant-action');
export const seedPlantSection = document.getElementById('seed-plant-section');
export const careActions = document.getElementById('care-actions');
export const growTreeBtn = document.getElementById('grow-tree-btn');
export const sellTreeBtn = document.getElementById('sell-tree-btn');


// --- Breeding Screen elements ---
export const breedingSlots = document.getElementById('breeding-slots');
export const breedTreeBtn = document.getElementById('breed-tree-btn');
export const breedingResultPanel = document.getElementById('breeding-result-panel');
export const bredTreeSpecies = document.getElementById('bred-tree-species');
export const bredTreeAttributes = document.getElementById('bred-tree-attributes');
export const materialForBreedingList = document.getElementById('material-for-breeding-list');
// --- START: Removed unnecessary button export ---
// export const goToBeedingBtn = document.getElementById('go-to-breeding-btn'); 
// --- END: Removed unnecessary button export ---
export const backToMainFromPlantationBtn = document.getElementById('back-to-main-from-plantation-btn');
export const backToMainFromBreedingBtn = document.getElementById('back-to-main-from-breeding-btn');

// --- Tree Selection Modal ---
export const treeSelectionModal = document.getElementById('tree-selection-modal');
export const closeTreeSelectionModalBtn = document.getElementById('close-tree-selection-modal-btn');
export const treeSelectionList = document.getElementById('tree-selection-list');

// --- Marketplace Screen Elements ---
export const marketplaceListingsGrid = document.getElementById('marketplace-listings-grid');
export const myMarketplaceListings = document.getElementById('my-marketplace-listings');
export const backToMainFromMarketplaceBtn = document.getElementById('back-to-main-from-marketplace-btn');
export const marketTabs = document.querySelectorAll('.market-tabs button');
export const marketBuySection = document.getElementById('market-buy-section');
export const marketSellSection = document.getElementById('market-sell-section');

// --- Sell Tree Modal Elements ---
export const sellTreeModal = document.getElementById('sell-tree-modal');
export const closeSellTreeModalBtn = document.getElementById('close-sell-tree-modal-btn');
export const sellTreeModalInfo = document.getElementById('sell-tree-modal-info');
export const sellPriceInput = document.getElementById('sell-price-input');
export const listingFeeSpan = document.getElementById('listing-fee-span');
export const profitSpan = document.getElementById('profit-span');
export const confirmSellBtn = document.getElementById('confirm-sell-btn');

// --- Sale Logging Modal Elements ---
export const saleModal = document.getElementById('sale-modal');
export const closeSaleModalBtn = document.getElementById('close-sale-modal-btn');
export const saleForm = document.getElementById('sale-form');
export const saleWeightInput = document.getElementById('sale-weight-input');
export const saleWeightTypeToggle = document.getElementById('sale-weight-type-toggle');
export const saleDeductionInput = document.getElementById('sale-deduction-input');
export const saleAmountInput = document.getElementById('sale-amount-input');
export const saleNetWeightDisplay = document.getElementById('sale-net-weight-display');
export const confirmSaleBtn = document.getElementById('confirm-sale-btn');
export const saleModalFormView = document.getElementById('sale-modal-form-view');
export const saleModalResultView = document.getElementById('sale-modal-result-view');
export const saleResultPricePerKg = document.getElementById('sale-result-price-per-kg');
export const saleResultEstIncome = document.getElementById('sale-result-est-income');
export const saleResultNewSaleBtn = document.getElementById('sale-result-new-sale-btn');


// --- END OF FILE dom.js ---