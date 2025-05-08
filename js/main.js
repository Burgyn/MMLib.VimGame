// Načítanie levelov a zobrazenie zoznamu
const levels = window.getVimLevels();
const levelsListEl = document.getElementById('levels-list');
const gameAreaEl = document.getElementById('game-area');
const welcomeScreenEl = document.getElementById('welcome-screen');
const levelTitleEl = document.getElementById('level-title');
const levelDescriptionEl = document.getElementById('level-description');
const terminalContainerEl = document.getElementById('terminal-container');
const showHintBtnEl = document.getElementById('show-hint');
const hintEl = document.getElementById('hint');
const restartBtnEl = document.getElementById('restart-level');
const nextBtnEl = document.getElementById('next-level');
const playerNameDisplayEl = document.getElementById('player-name-display');

let currentLevelData = null;
let currentLines = []; // Aktuálny obsah editora ako pole riadkov
let currentCursorPos = { row: 0, col: 0 };
let goalLines = [];    // Cieľový obsah editora ako pole riadkov
let playerProgress = { currentLevelId: 1, xp: 0, badges: [], streak: 0, lastPlayed: null };
let term;
let fitAddon;

async function initializeGame() {
  const playerName = await window.vimgameDB.loadSetting('playerName');
  const nameTextSpan = playerNameDisplayEl.querySelector('span'); // Získame vnútorný span
  if (playerName) {
    nameTextSpan.textContent = `${playerName}`;
  } else {
    await promptForPlayerName(true); // true for initial prompt
  }
  playerNameDisplayEl.addEventListener('click', () => promptForPlayerName(false)); // false for editing

  const progress = await window.vimgameDB.loadUserProgress();
  if (progress) {
    playerProgress = progress;
  }

  initializeTerminal();
  renderLevelList();
  showWelcomeScreen(); // Zobrazí uvítaciu obrazovku na začiatku
}

async function promptForPlayerName(isInitial = false) {
  const currentName = await window.vimgameDB.loadSetting('playerName');
  const nameTextSpan = playerNameDisplayEl.querySelector('span'); // Získame vnútorný span
  const { value: name } = await Swal.fire({
    title: isInitial ? 'Welcome to VimGame!' : 'Edit Your Name', // Preklad
    input: 'text',
    inputValue: currentName || '',
    inputLabel: 'Enter your name', // Preklad
    inputPlaceholder: 'Your name or nickname', // Preklad
    allowOutsideClick: false,
    allowEscapeKey: false,
    confirmButtonText: 'Save', // Preklad
    inputValidator: (value) => {
      if (!value) {
        return 'Name cannot be empty!' // Preklad
      }
    }
  });
  if (name) {
    await window.vimgameDB.saveSetting('playerName', name);
    nameTextSpan.textContent = `${name}`;
    if (isInitial) {
        Swal.fire('Great!', `Good luck, ${name}!`, 'success'); // Preklad
    } else {
        Swal.fire('Saved!', `Your name has been updated to ${name}.`, 'success'); // Preklad
    }
  }
}

function initializeTerminal() {
  term = new Terminal({
    // cursorBlink: true, // Toto môžeme nechať, ak by náš softvérový kurzor mal blikať, alebo dať false.
                      // Hardvérový kurzor aj tak skryjeme.
    fontFamily: "'Fira Code', monospace",
    fontSize: 15,
    theme: {
      background: '#11131C',
      foreground: '#cad3f5',
      // cursor: '#f9e2af', // Farba hardvérového kurzora Xterm.js - už nie je taká dôležitá
      selectionBackground: '#494d64',
      black: '#494d64',
      red: '#f38ba8',
      green: '#a6e3a1',
      yellow: '#f9e2af',
      blue: '#89b4fa',
      magenta: '#cba6f7',
      cyan: '#89dceb',
      white: '#cad3f5',
      brightBlack: '#5b6078',
      brightRed: '#f38ba8',
      brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af',
      brightBlue: '#89b4fa',
      brightMagenta: '#cba6f7',
      brightCyan: '#89dceb',
      brightWhite: '#bac2de',
    },
    // cursorStyle: 'block', // Môžeme nastaviť aj štýl, ak by sme ho chceli vidieť, ale my ho skryjeme.
    screenReaderMode: true, // Odporúčané pre lepšiu prístupnosť a manažment kurzora
    convertEol: true, // Pre správne zaobchádzanie s koncami riadkov
  });
  fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);
  term.open(terminalContainerEl);
  try {
    fitAddon.fit();
  } catch (e) { 
    console.warn("FitAddon failed on init.");
  }
  window.addEventListener('resize', () => {
    if (!gameAreaEl.classList.contains('hidden')) {
        try { fitAddon.fit(); } catch(e) { console.warn("FitAddon failed on resize.", e); }
    }
  });

  term.onKey(async ({ key, domEvent: e }) => {
    console.log(`term.onKey: key pressed: ${key}`, e);

    if (gameAreaEl.classList.contains('hidden') || !currentLevelData) {
        console.log('term.onKey: Exiting because game area is hidden or no current level data.');
        return;
    }

    console.log('term.onKey: Current level ID:', currentLevelData.id, 'Allowed commands:', currentLevelData.allowedCommands);

    const vimCommands = ['h', 'j', 'k', 'l', '0', '$', 'x'];
    if (vimCommands.includes(key) || (key.length === 1 && key.match(/[a-zA-Z0-9]/) && !e.ctrlKey && !e.altKey && !e.metaKey) ) {
        console.log('term.onKey: Key is a potential Vim command.');
        if (currentLevelData.allowedCommands && currentLevelData.allowedCommands.includes(key)) {
            console.log(`term.onKey: Command '${key}' is allowed for this level. Processing...`);
            e.preventDefault(); 
            
            const result = window.vimcore.processInput(key, currentLines, currentCursorPos);
            currentLines = result.lines;
            currentCursorPos = result.cursor;
            
            renderEditorContent(); 
            console.log('term.onKey: About to call checkLevelGoal.');
            await checkLevelGoal();
        } else if (currentLevelData.allowedCommands && !currentLevelData.allowedCommands.includes(key)){
            console.log(`term.onKey: Command '${key}' is NOT allowed for this level.`);
            term.write('\x07'); 
        } else {
            console.log(`term.onKey: Key '${key}' was not in allowedCommands, or allowedCommands is undefined.`);
        }
    } else if (key === 'Escape') { 
        console.log('term.onKey: Escape key pressed.');
        e.preventDefault();
    } else {
        console.log(`term.onKey: Key '${key}' is not a designated Vim command or Escape. Ignoring.`);
    }
  });
}

function renderLevelList() {
  levelsListEl.innerHTML = '';
  levels.forEach((lvl) => {
    const btn = document.createElement('button');
    btn.className = 'level-btn';
    btn.textContent = `${lvl.id}. ${lvl.title}`;
    btn.tabIndex = 0;
    btn.dataset.levelId = lvl.id;

    if (lvl.id > playerProgress.currentLevelId) {
      btn.classList.add('locked');
      btn.disabled = true;
    } else if (lvl.id < playerProgress.currentLevelId) {
      btn.classList.add('completed');
    }

    btn.onclick = () => {
      if (!btn.classList.contains('locked')) {
        startLevel(lvl.id);
        document.querySelectorAll('#levels-list .level-btn.active').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
    };
    btn.addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' ') btn.click(); });
    levelsListEl.appendChild(btn);
  });
}

function showWelcomeScreen() {
  welcomeScreenEl.classList.remove('hidden');
  gameAreaEl.classList.add('hidden');
}

function showGameArea() {
  welcomeScreenEl.classList.add('hidden'); // Toto zabezpečí skrytie uvítacej obrazovky
  gameAreaEl.classList.remove('hidden');
  if (fitAddon) {
      try { fitAddon.fit(); } catch(e) { console.warn("FitAddon failed.", e); }
  }
}

async function startLevel(levelId) {
  const level = levels.find(l => l.id === levelId);
  if (!level) return;
  currentLevelData = level;

  showGameArea();
  levelTitleEl.textContent = currentLevelData.title;
  levelDescriptionEl.innerHTML = currentLevelData.description;
  hintEl.classList.add('hidden');
  nextBtnEl.classList.add('hidden');
  
  const startText = await fetchTextFile(currentLevelData.startTextFile);
  currentLines = startText.split('\n');
  if (currentLines.length === 1 && currentLines[0] === '') currentLines = []; // Prázdny súbor

  const goalText = await fetchTextFile(currentLevelData.goalTextFile);
  goalLines = goalText.split('\n');
  if (goalLines.length === 1 && goalLines[0] === '') goalLines = [];
  
  currentCursorPos = { row: 0, col: 0 }; // Reset kurzoru na začiatok
  if (level.startCursor) { // Ak level definuje štartovaciu pozíciu kurzora
      currentCursorPos = { ...level.startCursor };
  }
  
  renderEditorContent();
  term.focus();
}

function renderEditorContent() {
  term.write('\x1b[?25l'); // Skry hardvérový kurzor na začiatku renderovania
  term.reset(); 
  currentLines.forEach((line, rowIndex) => {
    let displayLine = '';
    for (let colIndex = 0; colIndex < line.length; colIndex++) {
      if (rowIndex === currentCursorPos.row && colIndex === currentCursorPos.col) {
        displayLine += `\x1b[48;5;220m\x1b[38;5;232m${line[colIndex]}\x1b[0m`; // Žlté pozadie, tmavé písmo
      } else {
        displayLine += line[colIndex];
      }
    }
    if (rowIndex === currentCursorPos.row && currentCursorPos.col === line.length) {
        displayLine += `\x1b[48;5;220m\x1b[38;5;232m \x1b[0m`; // Žlté pozadie pre medzeru na konci
    }
    term.writeln(displayLine);
  });

  for (let i = currentLines.length; i <= currentCursorPos.row; i++) {
    if (i === currentCursorPos.row && currentCursorPos.col === 0 && currentLines.length === i) { // Ak je to nový prázdny riadok, kde má byť kurzor
        term.writeln(`\x1b[48;5;220m\x1b[38;5;232m \x1b[0m`);
    } else {
        term.writeln(''); 
    }
  }
  term.scrollToLine(currentCursorPos.row);
  // Hardvérový kurzor by mal zostať skrytý vďaka `\x1b[?25l` na začiatku.
  // Ak by sme ho chceli na chvíľu ukázať a potom skryť, museli by sme poslať `\x1b[?25h` a potom znova `\x1b[?25l`.
  // Pre náš softvérový kurzor to nepotrebujeme.
}

async function checkLevelGoal() {
  if (!currentLevelData) return;

  console.log('Checking goal for level:', currentLevelData.id);
  console.log('Current cursor:', currentCursorPos);
  console.log('Current lines:', currentLines);
  console.log('Goal lines:', goalLines);
  if (currentLevelData.verify === 'cursor_at_pos') {
      console.log('Goal cursor for cursor_at_pos:', currentLevelData.goalCursor);
  }

  const isGoalMet = window.vimcore.checkGoal(currentLevelData, currentLines, currentCursorPos, goalLines);
  console.log('Is goal met:', isGoalMet);

  if (isGoalMet) {
    nextBtnEl.classList.remove('hidden');
    nextBtnEl.focus();
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 }
    });
    if (currentLevelData.id === playerProgress.currentLevelId) {
      playerProgress.currentLevelId++;
      await window.vimgameDB.saveUserProgress(playerProgress);
      renderLevelList();
    }
  }
}

showHintBtnEl.onclick = () => {
  if (!currentLevelData) return;
  hintEl.innerHTML = currentLevelData.hint.replace(/<kbd>/g, '<kbd class="keycap">').replace(/<\/kbd>/g, '</kbd>');
  hintEl.classList.toggle('hidden');
};

restartBtnEl.onclick = () => {
  if (currentLevelData) startLevel(currentLevelData.id);
};

nextBtnEl.onclick = () => {
  const currentIdx = levels.findIndex(l => l.id === currentLevelData.id);
  if (currentIdx !== -1 && currentIdx < levels.length - 1) {
    const nextLevel = levels[currentIdx + 1];
    if (nextLevel.id <= playerProgress.currentLevelId) { // Skontroluje, či je ďalší level odomknutý
      startLevel(nextLevel.id);
      document.querySelectorAll('#levels-list .level-btn.active').forEach(b => b.classList.remove('active'));
      document.querySelector(`#levels-list .level-btn[data-level-id='${nextLevel.id}']`)?.classList.add('active');
    } else {
      showWelcomeScreen(); // Ak nie, vrátime sa na úvod
    }
  } else {
    showWelcomeScreen(); // Koniec hry alebo posledný dostupný level
  }
};

// Ovládanie klávesnicou (výber levelu, hint, ...)
document.addEventListener('keydown', e => {
  if (!gameAreaEl.classList.contains('hidden')) { // Ak je hra aktívna
    if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.altKey && !e.metaKey) {
       // Ak nie sme vo formulárovom prvku (napr. input v termináli, ak by bol)
      if (!(document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
         e.preventDefault();
         showHintBtnEl.click();
      }
    }
  } else { // Ak je aktívny výber levelov
    const focusableLevelButtons = Array.from(levelsListEl.querySelectorAll('.level-btn:not(.locked)'));
    if (focusableLevelButtons.length === 0) return;

    let currentIndex = focusableLevelButtons.findIndex(btn => btn === document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      currentIndex = (currentIndex + 1) % focusableLevelButtons.length;
      focusableLevelButtons[currentIndex].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      currentIndex = (currentIndex - 1 + focusableLevelButtons.length) % focusableLevelButtons.length;
      focusableLevelButtons[currentIndex].focus();
    }
  }
});

// Globálne premenné a funkcie pre fetchTextFile, atď., zostávajú podobné.
function fetchTextFile(path) {
  return fetch(path).then(r => r.text());
}

// Štart hry
initializeGame(); 