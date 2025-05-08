// Inicializácia Dexie.js pre IndexedDB
const db = new Dexie('VimGameDB');
db.version(1).stores({
  progress: 'id, currentLevelId, xp, badges, streak, lastPlayed',
  settings: 'key, value' // Pre uloženie mena hráča a iných nastavení
});

// Uloženie progresu
async function saveUserProgress(progressData) {
  await db.progress.put({
    id: 1, // Predpokladáme jedného hráča
    ...progressData
  });
}

// Načítanie progresu
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

// Uloženie nastavenia (napr. mena)
async function saveSetting(key, value) {
  await db.settings.put({ key, value });
}

// Načítanie nastavenia
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