// js/db.js
// Initialize Dexie.js for IndexedDB
const db = new Dexie('VimGameDB');
db.version(1).stores({
  progress: 'id, currentLevelId, xp, badges, streak, lastPlayed',
  settings: 'key, value' // For saving player name and other settings
});

// Save progress
async function saveUserProgress(progressData) {
  await db.progress.put({
    id: 1, // Assuming one player
    ...progressData
  });
}

// Load progress
async function loadUserProgress() {
  return await db.progress.get(1);
}

// Function to clear all progress for the user
async function clearUserProgress() {
  try {
    await db.progress.delete(1); // Assuming user progress is stored with id: 1
    console.log('User progress cleared from DB.');
  } catch (error) {
    console.error('Failed to clear user progress from DB:', error);
    throw error; // Re-throw to be caught by caller if needed
  }
}

// Save setting (e.g., name)
async function saveSetting(key, value) {
  await db.settings.put({ key, value });
}

// Load setting
async function loadSetting(key) {
  const setting = await db.settings.get(key);
  return setting ? setting.value : undefined;
}

// Function to clear a specific setting
async function clearSetting(key) {
  try {
    await db.settings.delete(key);
    console.log(`Setting '${key}' cleared from DB.`);
  } catch (error) {
    console.error(`Failed to clear setting '${key}' from DB:`, error);
    throw error; // Re-throw to be caught by caller if needed
  }
}

window.vimgameDB = { saveUserProgress, loadUserProgress, clearUserProgress, saveSetting, loadSetting, clearSetting }; 