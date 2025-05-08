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

// Uloženie nastavenia (napr. mena)
async function saveSetting(key, value) {
  await db.settings.put({ key, value });
}

// Načítanie nastavenia
async function loadSetting(key) {
  const setting = await db.settings.get(key);
  return setting ? setting.value : null;
}

window.vimgameDB = { saveUserProgress, loadUserProgress, saveSetting, loadSetting }; 