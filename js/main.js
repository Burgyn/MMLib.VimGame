// Load levels and display list - No longer needed as levels fetched async
let chapters = []; 
let allLevelsFlat = []; 

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
// const progressBarContainerEl = document.getElementById('progress-bar-container'); // REMOVED
// const progressBarEl = document.querySelector('#progress-bar .bar'); // REMOVED
const badgesContainerEl = document.getElementById('badges-container');
const badgesEl = document.getElementById('badges');

// Status Bar Elements
const statusBarModeEl = document.getElementById('status-mode');
const statusBarFileInfoEl = document.getElementById('status-file-info');
const statusBarCursorPosEl = document.getElementById('status-cursor-pos');
const statusTimeEl = document.getElementById('status-time');
const statusBarPendingKeysEl = document.getElementById('status-pending-keys');

// Help Modal Elements
let helpModalEl;                   // MOVED back to global, changed to let
let closeHelpModalBtnEl;       // MOVED back to global, changed to let

// Progress Modal Elements - MOVED INSIDE initializeGame
// const progressModalEl = document.getElementById('progress-modal');
// const closeProgressModalBtnEl = document.getElementById('close-progress-modal');
// const progressModalContentEl = document.getElementById('progress-modal-content');

// Splash Screen Footer Elements for Stats
const splashCompletedLevelsEl = document.getElementById('splash-completed-levels');
const splashTotalLevelsEl = document.getElementById('splash-total-levels');

// Level Palette Modal Elements (Now disabled, explorer is primary)
/*
const levelPaletteModalEl = document.getElementById('level-palette-modal');
const levelPaletteFilterEl = document.getElementById('level-palette-filter');
const levelPaletteListEl = document.getElementById('level-palette-list');
if (!levelPaletteModalEl || !levelPaletteFilterEl || !levelPaletteListEl) {
  console.error("CRITICAL PALETTE ERROR: One or more level palette DOM elements were not found!");
}
*/

let currentLevelData = null;
let currentLines = []; // Current content of the editor as array of lines
let currentCursorPos = { row: 0, col: 0 };
let goalLines = [];    // Target content of the editor as array of lines
let playerProgress = { currentLevelId: 1, xp: 0, badges: [], streak: 0, lastPlayed: null };
let term;
let fitAddon;

// Helper function to flatten chapters into levels
function flattenChaptersToLevels(chaptersData) {
  let allLevels = [];
  if (!Array.isArray(chaptersData)) return [];
  chaptersData.forEach(chapter => {
    if (chapter && Array.isArray(chapter.levels)) {
        allLevels = allLevels.concat(chapter.levels);
    }
  });
  return allLevels;
}

// Helper function to fetch level data
async function loadLevelData() {
  try {
    const response = await fetch('levels.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    chapters = data; // Store fetched chapters
    allLevelsFlat = flattenChaptersToLevels(chapters); // Flatten them
    console.log("Level data loaded successfully:", chapters);
    return true;
  } catch (error) {
    console.error("CRITICAL: Failed to load levels.json:", error);
    levelsListEl.innerHTML = '<p style="color:var(--red);">Error: levels.json could not be loaded or parsed.</p>';
    return false;
  }
}

async function initializeGame() {
  // Define modal element constants here, after DOM is loaded.
  const progressModalEl = document.getElementById('progress-modal');
  const closeProgressModalBtnEl = document.getElementById('close-progress-modal');
  const progressModalContentEl = document.getElementById('progress-modal-content');

  // Assign Help Modal elements here (declared globally)
  helpModalEl = document.getElementById('help-modal');
  closeHelpModalBtnEl = document.getElementById('close-help-modal');

  // Load level data first
  const levelsLoaded = await loadLevelData();
  if (!levelsLoaded) return; // Stop initialization if levels failed to load

  // Load player name and progress
  const playerName = await window.vimgameDB.loadSetting('playerName');
  const nameTextSpan = playerNameDisplayEl.querySelector('span'); // Get the inner span
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

  updatePlayerStatsUI();
  updateSplashFooterStats();
  initializeTerminal();
  renderLevelExplorer(); // Render based on fetched data
  
  // Initial call to handle current hash on page load
  handleHashChange(); 
  // Listen for subsequent hash changes
  window.addEventListener('hashchange', handleHashChange, false);
  
  // Add event listeners for splash menu items
  setupSplashScreenMenuActions();

  // Add event listener for help modal close button
  if (closeHelpModalBtnEl) {
    closeHelpModalBtnEl.addEventListener('click', hideHelpModal);
  }
  // Optional: Close modal on Escape key or click outside
  if (helpModalEl) {
    helpModalEl.addEventListener('click', (event) => {
      if (event.target === helpModalEl) { // Clicked on backdrop
        hideHelpModal();
      }
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && helpModalEl && !helpModalEl.classList.contains('hidden')) {
      hideHelpModal();
    }
  });

  // Setup for Progress Modal
  if (closeProgressModalBtnEl) {
    closeProgressModalBtnEl.addEventListener('click', hideProgressModal);
  }
  if (progressModalEl) {
    progressModalEl.addEventListener('click', (event) => {
      if (event.target === progressModalEl) { hideProgressModal(); }
    });
  }

  // Global keydown listener for home screen shortcuts and modal escapes
  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();

    // If Vim core is waiting for a motion or target character for a command (e.g., after 'f', 'd'),
    // and the current key is a single character (likely the target char or motion),
    // then don't process global shortcuts that might conflict.
    // Allow Escape to pass through for VimCore to handle, and allow shortcuts with modifiers (Ctrl, Shift, Alt, Meta).
    if (window.vimcore && window.vimcore.isWaitingForMotionOrTargetChar && 
        key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey && key !== 'escape') {
        // Check if the key is NOT shift itself, but could be a character produced by shift (e.g. '$', 'G')
        // This check is a bit broad; the main idea is to let vimcore handle the next key if it's waiting.
        // If shift is pressed with a letter, vimcore should receive the uppercase letter.
        // If it is a global shortcut like Ctrl+Shift+H, the `!event.ctrlKey` above handles it.
        return; 
    }

    // --- Modal Escape Handling (Highest Priority) ---
    if (key === 'escape') {
      const currentHelpModal = document.getElementById('help-modal');
      if (currentHelpModal && !currentHelpModal.classList.contains('hidden')) {
        hideHelpModal();
        event.preventDefault(); // Prevent other escape actions if modal was closed
        return;
      }
      const currentProgressModal = document.getElementById('progress-modal');
      if (currentProgressModal && !currentProgressModal.classList.contains('hidden')) {
        hideProgressModal();
        event.preventDefault(); // Prevent other escape actions if modal was closed
        return;
      }
      // Note: SweetAlerts handle their own escape.
    }

    // --- Global Shortcuts (if no modals are open and event not already handled) ---
    const helpModalVisible = !document.getElementById('help-modal')?.classList.contains('hidden');
    const progressModalVisible = !document.getElementById('progress-modal')?.classList.contains('hidden');
    const anyModalVisible = helpModalVisible || progressModalVisible; // Extend with other modals if any

    if (!anyModalVisible && !event.defaultPrevented) {
      if (key === 'r') {
        console.log("Global 'r' key pressed for My Progress");
        showProgressModal();
        event.preventDefault(); // Prevent potential further handling
        return;
      }
      if (event.ctrlKey && event.shiftKey && key === 'h') {
        console.log("Global 'Ctrl+Shift+H' key pressed for Help");
        showHelpModal();
        event.preventDefault(); // Prevent potential further handling
        return;
      }
      if (key === 'q') {
        console.log("Global 'q' key pressed for Quit/Go Home");
        window.location.hash = ''; // Navigate to home
        event.preventDefault();
        return;
      }
    }

    // --- Home Screen Specific Shortcuts (if home is visible and no modals) ---
    if (welcomeScreenEl && !welcomeScreenEl.classList.contains('hidden') && !anyModalVisible) {
      // Check again for vimcore waiting before processing home screen shortcuts
      if (window.vimcore && window.vimcore.isWaitingForMotionOrTargetChar && 
          key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey && key !== 'escape') {
          if (key === 's') { // Explicitly list clashing single-key shortcuts for home screen
             return;
          }
      }
      if (key === 's' && !event.defaultPrevented) {
        console.log("'s' key pressed on home screen for Start Learning");
        // Simulate click on the "Start Learning" menu item
        const startLearningItem = Array.from(document.querySelectorAll('.splash-menu li span')).find(span => span.textContent.toLowerCase() === 'start learning');
        startLearningItem?.closest('li')?.click();
        event.preventDefault();
        // The other home screen shortcuts (r, h) are now handled by the global section above
        // so they don't need to be duplicated here.
      }
    }
  });
}

async function promptForPlayerName(isInitial = false) {
  const currentName = await window.vimgameDB.loadSetting('playerName');
  const nameTextSpan = playerNameDisplayEl.querySelector('span'); // Get the inner span
  
  const swalOptions = {
    title: isInitial ? 'Welcome to Vim Dojo!' : 'Edit Your Name',
    input: 'text',
    inputValue: currentName || '',
    inputLabel: 'Enter your name',
    inputPlaceholder: 'Your name or nickname',
    confirmButtonText: 'Save',
    showCancelButton: true,
    cancelButtonText: 'Cancel',
    inputValidator: (value) => {
      if (!value && !swalOptions.willClose) {
        return 'Name cannot be empty if saving!';
      }
      return null;
    }
  };

  if (!isInitial) {
    swalOptions.showDenyButton = true;
    swalOptions.denyButtonText = 'Reset Progress';
    swalOptions.denyButtonColor = 'var(--red)';
  }

  const result = await Swal.fire(swalOptions);

  if (result.isConfirmed && result.value) {
    await window.vimgameDB.saveSetting('playerName', result.value);
    nameTextSpan.textContent = `${result.value}`;
    Swal.fire('Saved!', `Your name has been updated to ${result.value}.`, 'success');
  } else if (result.isDenied) {
    // User clicked "Reset Progress"
    await handleResetProgress(); 
  } else if (result.isConfirmed && !result.value && isInitial) {
    // Initial prompt, but user saved an empty name (should be caught by validator but as a fallback)
    // Re-prompt or set a default, here we re-prompt by doing nothing specific, 
    // the game init flow might handle this or prompt again if name is still null.
    // For now, let the validator handle it primarily.
    // If validator is bypassed or name is empty, prompt again when needed.
    await promptForPlayerName(true); // Force re-prompt if initial and empty
  }
}

function initializeTerminal() {
  term = new Terminal({
    // cursorBlink: true, // We can leave this if we want our software cursor to blink, or set false.
                      // We hide the hardware cursor anyway.
    fontFamily: "'Fira Code', monospace",
    fontSize: 15,
    theme: {
      background: '#1e1e2e', // Use the new background
      foreground: '#f8f8f2', // Use the new text color
      cursor: '#f8f8f2',     // Make cursor match text color (or choose an accent)
      selectionBackground: '#44475a', // Use the new selection color
      // Use new accent colors for ANSI colors
      black: '#44475a', 
      red: '#ff5555', 
      green: '#50fa7b',
      yellow: '#f1fa8c',
      blue: '#bd93f9',    // Using purple for blue
      magenta: '#ff79c6', // Pinkish magenta often used in these themes
      cyan: '#8be9fd', 
      white: '#f8f8f2',
      brightBlack: '#6272a4',
      brightRed: '#ff6e6e',
      brightGreen: '#69ff94',
      brightYellow: '#ffffa5',
      brightBlue: '#d6acff',
      brightMagenta: '#ff92df',
      brightCyan: '#a4ffff',
      brightWhite: '#ffffff',
    },
    // cursorStyle: 'block', // Could set style if we wanted to see it, but we hide it.
    screenReaderMode: true, // Recommended for better accessibility and cursor management
    convertEol: true, // For correct handling of line endings
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
    console.log(`term.onKey: key: ${e.key}, ctrl: ${e.ctrlKey}, alt: ${e.altKey}, meta: ${e.metaKey}, shift: ${e.shiftKey}`);

    if (gameAreaEl.classList.contains('hidden') || !currentLevelData) {
        console.log('term.onKey: Exiting because game area is hidden or no current level data.');
        return;
    }

    // --- START: Key Filtering and Propagation Control for term.onKey --- 
    // If vimcore is waiting for a specific key, and the current key is suitable,
    // it's definitely for vimcore. Stop propagation.
    if (window.vimcore && window.vimcore.isWaitingForMotionOrTargetChar) {
        if (e.key.length === 1 || e.key === 'Escape') {
            console.log('term.onKey: vimcore is waiting, key intended for vimcore. Stopping propagation.');
            e.preventDefault();
            e.stopPropagation();
            // Proceed to send the key to vimcore below
        } else {
            // Vimcore is waiting, but this key is not a single char or Escape (e.g. F5).
            // It's unlikely for vimcore. We can choose to stop it or let it bubble.
            // Stopping it might be safer to prevent unexpected global shortcuts.
            console.log('term.onKey: vimcore waiting, but key is special. Stopping and ignoring for vimcore.');
            e.preventDefault();
            e.stopPropagation();
            return; 
        }
    } else {
        // Vimcore is NOT waiting. 
        // If it's a Ctrl/Alt/Meta modified key (and not just the modifier itself being pressed),
        // assume it's a global shortcut and should NOT be processed by vimcore. Let it bubble.
        if ((e.ctrlKey || e.altKey || e.metaKey) && 
            !(e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta' || e.key === 'Shift')) {
            console.log('term.onKey: Modifier key (Ctrl/Alt/Meta) + char detected. Letting it bubble for global shortcuts.');
            return; // Let browser/global listeners handle it.
        }

        // NEW: Check for global single-key shortcuts 'r' and 'q'
        // These should take precedence over Vim commands if the game is active.
        const lowerKey = e.key.toLowerCase();
        if (lowerKey === 'r' || lowerKey === 'q') {
            // These are global shortcuts. Let them bubble up to the document listener.
            // Do not preventDefault or stopPropagation here within term.onKey.
            // Also, do not send them to vimcore.processInput.
            console.log(`term.onKey: Detected global shortcut key '${e.key}'. Letting it bubble up.`);
            return; // Exit term.onKey's processing for these keys.
        }
        
        // For any other key that reaches here (single chars, Shift+char, Escape, Tab, Enter, etc.)
        // when vimcore is NOT waiting for a multi-key sequence part, we assume it *could* be a Vim command.
        // So, we should prevent default browser actions and stop it from bubbling to global document listeners
        // that might also react to simple keys like 'r', 'q'.
        // Escape is a special case; it might be used by Vim or by global handlers (like closing modals).
        // The global handlers for modals check if a modal is open first.
        if (e.key !== 'Escape') { // For non-Escape keys that are candidates for Vim commands
             console.log(`term.onKey: Key '${e.key}' (not r/q global shortcut) is a candidate for Vim. Stopping propagation.`);
             e.preventDefault();
             e.stopPropagation();
        } else {
            // If it IS Escape, and vimcore is not waiting, it might be for closing a modal.
            // The global Escape handlers for modals should take precedence if a modal is open.
            // If no modal is open, Escape will be passed to vimcore.processInput.
            // We don't unconditionally stopPropagation for Escape here to allow modals to close.
            // vimcore.processInput itself will handle Escape for its own state clearing.
             console.log('term.onKey: Escape key detected. Allowing potential modal close, then to Vimcore.');
             // No stopPropagation here to allow global modal escape to work.
             // e.preventDefault() might still be useful if Escape has a default browser action we want to avoid
             // but xterm usually handles Escape well. Let's be cautious.
        }
    }
    // --- END: Key Filtering and Propagation Control --- 

    let vimKey = key;
    if (e.key.length > 1) { 
        if (e.key === 'Escape') {
            vimKey = 'Escape';
            // vimcore.processInput will handle resetting its state (pendingKeystrokes, isWaiting...)
            // updateStatusBar() will be called after processInput returns.
        } 
        // ... (rest of special key handling like Arrows, Home, End - currently mostly ignored by vimcore) ...
        else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Insert', 'Delete', 'PageUp', 'PageDown'].includes(e.key) || e.key.startsWith('F')) {
            console.log(`term.onKey: Special key ${e.key} pressed, not treating as simple Vim command. Vimcore might ignore it.`);
            // For now, send them to vimcore, which will likely ignore them and set commandProcessed=false
            // unless we specifically map them in vimcore in the future.
             vimKey = e.key; // Send the actual key name
        } else {
             console.log(`term.onKey: Other special key ${e.key} pressed.`);
             return; // Ignore other unmapped special keys for now
        }
    } else if (e.shiftKey && e.key.length === 1) {
        // If shift is pressed with a letter, it produces an uppercase letter (e.g., Shift + g = G).
        // `key` will be the correct uppercase character (e.g., 'G', '$').
        // This is fine. No special handling needed here for Shift + letter.
    }

    // Basic handling for 'gg' sequence
    if (window.vimcore.lastChar === 'g' && vimKey === 'g' && !window.vimcore.isWaitingForMotionOrTargetChar) {
        window.vimcore.lastChar = null; 
        vimKey = 'gg';
    } else if (vimKey === 'g' && !window.vimcore.isWaitingForMotionOrTargetChar) {
        window.vimcore.lastChar = 'g';
        updateStatusBar(); // Show the 'g' in pending keys
        console.log("term.onKey: 'g' pressed, waiting for potential second 'g'.");
        return; 
    } else {
        window.vimcore.lastChar = null; 
    }
    
    const result = window.vimcore.processInput(vimKey, currentLines, currentCursorPos);

    // After vimcore.processInput, isWaitingForMotionOrTargetChar should be correctly updated by vimcore.
    // So, global shortcuts will be unblocked if the sequence was completed or cancelled.

    if (result.commandProcessed) {
        currentLines = result.lines;
        currentCursorPos = result.cursor;
        renderEditorContent(); 
        // updateStatusBar(); // Called below, also after non-processed to show pending
        await checkLevelGoal(); 
    } else {
        // Count was updated, or a multi-key sequence is still in progress (e.g. 'd' is now pending)
        // or an invalid key was pressed after a pending starter (e.g. 'fx' then 'z' - 'z' is unprocessed here)
        // or a known command did nothing (e.g. 'h' at start of line)
        console.log('term.onKey: Vimcore did not process command fully, or is waiting, or count updated.');
    }
    updateStatusBar(); // Update status bar regardless to show current state (pending keys, cursor)
  });
}

// --- Level Explorer Rendering & Logic ---
function renderLevelExplorer() {
  if (!levelsListEl || !chapters) return;
  levelsListEl.innerHTML = ''; // Clear old list

  chapters.forEach(chapter => {
    const chapterDiv = document.createElement('div');
    chapterDiv.className = 'chapter-item';
    chapterDiv.dataset.chapterId = chapter.id;
    if (chapter.isOpen === undefined) chapter.isOpen = true; // Default to open if not specified
    if (chapter.isOpen) chapterDiv.classList.add('open');

    const chapterHeader = document.createElement('div');
    chapterHeader.className = 'chapter-header';
    chapterHeader.tabIndex = 0; // Make focusable
    // Folder icon: closed = [34m[0m, open = [34m[0m (use Unicode or Nerd Font if available)
    const folderIcon = chapter.isOpen ? '📂' : '📁'; // fallback: open/closed folder emoji
    chapterHeader.innerHTML = `<span class="chapter-toggle-icon">${folderIcon}</span>${chapter.title}`;
    chapterHeader.addEventListener('click', () => toggleChapter(chapter.id));
    chapterHeader.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { // Space or Enter to toggle
        e.preventDefault();
        toggleChapter(chapter.id);
      }
    });

    const levelsUl = document.createElement('ul');
    levelsUl.className = 'levels-under-chapter';

    chapter.levels.forEach(level => {
      const levelLi = document.createElement('li');
      const levelBtn = document.createElement('button');
      levelBtn.className = 'level-btn';
      levelBtn.dataset.levelId = level.id;
      levelBtn.tabIndex = 0; // Make focusable
      levelBtn.innerHTML = `<span class="level-icon"></span>${level.id}. ${level.title}`;

      if (level.id > playerProgress.currentLevelId) {
        levelBtn.classList.add('locked');
        levelBtn.disabled = true;
        levelBtn.title = "Level locked";
      } else if (level.id < playerProgress.currentLevelId) {
        levelBtn.classList.add('completed');
      }
      if (currentLevelData && level.id === currentLevelData.id) {
        levelBtn.classList.add('active-level-item');
      }

      levelBtn.onclick = () => {
        if (!levelBtn.classList.contains('locked')) {
          startLevel(level.id);
        }
      };
      // Enter key on button already handled by button default behavior if not disabled
      // but we can add explicit keydown for consistency or if it were not a button
      levelBtn.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !levelBtn.classList.contains('locked')) {
             e.preventDefault(); // Prevent potential double action if it's a button
             startLevel(level.id); 
        }
      });

      levelLi.appendChild(levelBtn);
      levelsUl.appendChild(levelLi);
    });

    chapterDiv.appendChild(chapterHeader);
    chapterDiv.appendChild(levelsUl);
    levelsListEl.appendChild(chapterDiv);
  });
}

function toggleChapter(chapterId) {
  const chapterItem = levelsListEl.querySelector(`.chapter-item[data-chapter-id='${chapterId}']`);
  if (chapterItem) {
    chapterItem.classList.toggle('open');
    const icon = chapterItem.querySelector('.chapter-toggle-icon');
    const chapterData = chapters.find(c => c.id === chapterId);
    if (chapterData) chapterData.isOpen = !chapterData.isOpen; // Update state model
    if (icon) icon.textContent = chapterItem.classList.contains('open') ? '📂' : '📁';
  }
}

function updateActiveLevelInExplorer(levelId) {
  document.querySelectorAll('#levels-list .level-btn.active-level-item').forEach(btn => {
    btn.classList.remove('active-level-item');
  });
  const newActiveButton = document.querySelector(`#levels-list .level-btn[data-level-id='${levelId}']`);
  if (newActiveButton) {
    newActiveButton.classList.add('active-level-item');
    // Optionally, ensure its chapter is open
    const chapterItem = newActiveButton.closest('.chapter-item');
    if (chapterItem && !chapterItem.classList.contains('open')) {
      toggleChapter(chapterItem.dataset.chapterId);
    }
    newActiveButton.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function showWelcomeScreen() {
  welcomeScreenEl.classList.remove('hidden');
  gameAreaEl.classList.add('hidden');
  // Also hide progress/badges on welcome screen, or decide if they should be visible
  // progressBarContainerEl.classList.add('hidden');
  // badgesContainerEl.classList.add('hidden');
}

function showGameArea() {
  welcomeScreenEl.classList.add('hidden'); // Ensure welcome screen is hidden
  gameAreaEl.classList.remove('hidden');
  // Show progress/badges when game area is shown
  updatePlayerStatsUI();
  if (fitAddon) {
      try { fitAddon.fit(); } catch(e) { console.warn("FitAddon failed.", e); }
  }
}

async function startLevel(levelId) {
  const level = allLevelsFlat.find(l => l.id === levelId); // Use new flat list
  if (!level) {
      console.error(`Level with ID ${levelId} not found.`);
      return;
  }
  currentLevelData = level;

  showGameArea();
  levelTitleEl.textContent = currentLevelData.title;
  levelDescriptionEl.innerHTML = currentLevelData.description;
  hintEl.classList.add('hidden');
  nextBtnEl.classList.add('hidden');
  
  // Update URL hash
  window.location.hash = `#/level/${levelId}`;
  
  const startText = await fetchTextFile(currentLevelData.startTextFile);
  currentLines = startText.split('\n');
  if (currentLines.length === 1 && currentLines[0] === '') currentLines = []; // Handle empty file

  const goalText = await fetchTextFile(currentLevelData.goalTextFile);
  goalLines = goalText.split('\n');
  if (goalLines.length === 1 && goalLines[0] === '') goalLines = []; // Handle empty file
  
  currentCursorPos = { row: 0, col: 0 }; // Reset cursor to start
  if (level.startCursor) { // If level defines a start cursor position
      currentCursorPos = { ...level.startCursor };
  }
  
  renderEditorContent();
  term.focus();
  updateActiveLevelInExplorer(levelId);
  updateStatusBar();
}

function renderEditorContent() {
  term.write('\x1b[?25l'); // Hide hardware cursor at the start of render
  term.reset(); 
  currentLines.forEach((line, rowIndex) => {
    let displayLine = '';
    for (let colIndex = 0; colIndex < line.length; colIndex++) {
      if (rowIndex === currentCursorPos.row && colIndex === currentCursorPos.col) {
        displayLine += `\x1b[48;5;220m\x1b[38;5;232m${line[colIndex]}\x1b[0m`; // Yellow background, dark text
      } else {
        displayLine += line[colIndex];
      }
    }
    if (rowIndex === currentCursorPos.row && currentCursorPos.col === line.length) {
        displayLine += `\x1b[48;5;220m\x1b[38;5;232m \x1b[0m`; // Yellow background for space at end of line
    }
    term.writeln(displayLine);
  });

  for (let i = currentLines.length; i <= currentCursorPos.row; i++) {
    if (i === currentCursorPos.row && currentCursorPos.col === 0 && currentLines.length === i) { // If it's a new empty line where cursor should be
        term.writeln(`\x1b[48;5;220m\x1b[38;5;232m \x1b[0m`);
    } else {
        term.writeln(''); // Empty line
    }
  }
  term.scrollToLine(currentCursorPos.row);
  // Hardware cursor should remain hidden thanks to `\x1b[?25l` at the start.
  // For our software cursor, this isn't needed.
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
      if (window.vimgameDB && window.vimgameDB.saveUserProgress) {
        window.vimgameDB.saveUserProgress(playerProgress);
      }
      renderLevelExplorer();
      updatePlayerStatsUI();
    } else if (currentLevelData.id === playerProgress.currentLevelId - 1) {
      renderLevelExplorer(); // Re-render to update completed/locked states
      updatePlayerStatsUI();
    }
    updateStatusBar();
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
  const currentIdx = allLevelsFlat.findIndex(l => l.id === currentLevelData.id);
  if (currentIdx !== -1 && currentIdx < allLevelsFlat.length - 1) {
    const nextLevel = allLevelsFlat[currentIdx + 1];
    if (nextLevel.id <= playerProgress.currentLevelId) { // Check if next level is unlocked
      startLevel(nextLevel.id);
      document.querySelectorAll('#levels-list .level-btn.active').forEach(b => b.classList.remove('active'));
      document.querySelector(`#levels-list .level-btn[data-level-id='${nextLevel.id}']`)?.classList.add('active');
    } else {
      showWelcomeScreen(); // If not, return to welcome screen
    }
  } else {
    showWelcomeScreen(); // End of game or last available level
  }
};

// --- Status Bar Update Function ---
function updateStatusBar() {
  if (!currentLevelData) {
    statusBarFileInfoEl.textContent = 'No Level Loaded';
    statusBarCursorPosEl.textContent = '';
    if (statusBarPendingKeysEl) statusBarPendingKeysEl.textContent = ''; // Clear pending keys
    return;
  }
  statusBarFileInfoEl.textContent = `${currentLevelData.id}: ${currentLevelData.title}`;
  if (currentCursorPos) {
    statusBarCursorPosEl.textContent = `${currentCursorPos.row}:${currentCursorPos.col}`;
  }
  // statusBarModeEl can be updated later with Vim modes

  // Update pending keystrokes display
  if (statusBarPendingKeysEl) {
    const count = window.vimcore.activeCount || "";
    const keys = window.vimcore.pendingKeystrokes || "";
    statusBarPendingKeysEl.textContent = count + keys;
  }
}

// --- Keyboard Navigation for Explorer (and global shortcuts) ---
document.addEventListener('keydown', e => {
  // Ctrl+Shift+E to focus level explorer
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'e') {
    e.preventDefault();
    console.log("Ctrl+Shift+E pressed. Attempting to focus level explorer.");
    const firstFocusable = levelsListEl.querySelector('.chapter-header, .level-btn:not(.locked)');
    if (firstFocusable) {
      firstFocusable.focus();
      console.log("Focused explorer item:", firstFocusable);
    }
    return; 
  }

  // Handle keys if level explorer is focused (an item within #levels-list)
  const activeElementInExplorer = document.activeElement.closest('#levels-list .chapter-header, #levels-list .level-btn');
  if (activeElementInExplorer) {
    const allFocusable = Array.from(levelsListEl.querySelectorAll('.chapter-header, .level-btn:not(.locked)'));
    let currentIndex = allFocusable.findIndex(item => item === activeElementInExplorer);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      currentIndex = (currentIndex + 1) % allFocusable.length;
      allFocusable[currentIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      currentIndex = (currentIndex - 1 + allFocusable.length) % allFocusable.length;
      allFocusable[currentIndex]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') { // Space or Enter
      // Let the item's own click/keydown handler deal with it (already set up in renderLevelExplorer)
      // If it's a button, Space/Enter often trigger click by default.
      // If it's a div (chapter-header), we added explicit handlers.
    }
    return; // Key handled by explorer navigation
  }

  // Hint shortcut ('?') if game area is active
  if (!gameAreaEl.classList.contains('hidden') && e.key === '?' /* ... and not in input ... */) {
    // ... (hint logic)
  }
  
  // Terminal key processing (term.onKey) is separate and handles Vim commands
});

// --- Hash Handling ---
async function handleHashChange() {
  const hash = window.location.hash;
  console.log('Hash changed to:', hash);

  if (hash.startsWith('#/level/')) {
    const levelId = parseInt(hash.substring(8), 10);
    const levelExists = allLevelsFlat.some(l => l.id === levelId);
    if (levelExists) {
      await startLevel(levelId);
    } else {
      console.warn(`Level with ID ${levelId} not found from hash. Showing home.`);
      window.location.hash = '#/home'; // Fallback to home
      showAppHomeScreen();
    }
  } else if (hash === '#/home' || hash === '') { // Show home on #/home or empty hash
    showAppHomeScreen();
  } else {
    // Fallback for any other unknown hash: show home screen.
    // Or, if there was a default level to start, handle that.
    // For now, defaulting to home.
    console.log('Unknown hash, showing home screen.');
    showAppHomeScreen();
  }
}

// New function to update and display progress bar and badges
function updatePlayerStatsUI() {
  if (!playerProgress || !allLevelsFlat) return;
  const totalLevels = allLevelsFlat.length;
  const completedLevels = playerProgress.currentLevelId -1; // Assuming currentLevelId is the next level to play
  const progressPercentage = totalLevels > 0 ? (completedLevels / totalLevels) * 100 : 0;
  // progressBarEl.style.width = `${Math.min(progressPercentage, 100)}%`; // REMOVED
  // progressBarContainerEl.classList.remove('hidden'); // REMOVED
  // Add tooltip to the progress bar container
  // progressBarContainerEl.title = `Progress: ${completedLevels} / ${totalLevels} levels completed (${Math.round(progressPercentage)}%)`; // REMOVED

  // Update status bar progress segment
  const statusBarProgressEl = document.getElementById('status-progress');
  if (statusBarProgressEl) {
    statusBarProgressEl.textContent = `${completedLevels}/${totalLevels} completed`;
  }

  // Update Badges
  if (badgesEl && badgesContainerEl) {
    badgesEl.innerHTML = ''; // Clear existing badges
    if (playerProgress.badges && playerProgress.badges.length > 0) {
      playerProgress.badges.forEach(badgeText => {
        const badgeDiv = document.createElement('div');
        badgeDiv.className = 'badge';
        badgeDiv.textContent = badgeText.substring(0, 3); // Display first 3 chars of badge ID or design as needed
        badgeDiv.title = `Achievement: ${badgeText}`; // Tooltip for badge
        badgesEl.appendChild(badgeDiv);
      });
      badgesContainerEl.classList.remove('hidden');
    } else {
      badgesContainerEl.classList.add('hidden'); // Hide if no badges
    }
  } else {
    console.warn('Badges elements not found.');
  }
}

// Handler for resetting progress
async function handleResetProgress() {
  const result = await Swal.fire({
    title: 'Are you sure?',
    text: "This will reset all your progress and name. This action cannot be undone!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: 'var(--red)',
    cancelButtonColor: 'var(--secondary-color)',
    confirmButtonText: 'Yes, reset it!',
    cancelButtonText: 'Cancel'
  });

  if (result.isConfirmed) {
    try {
      await window.vimgameDB.clearUserProgress();
      await window.vimgameDB.clearSetting('playerName');

      Swal.fire(
        'Reset!',
        'Your progress has been successfully reset.',
        'success'
      ).then(() => {
        window.location.reload();
      });
    } catch (error) {
      console.error('Error during progress reset:', error);
      Swal.fire(
        'Error!',
        'Could not reset progress. Please check the console for details.',
        'error'
      );
    }
  }
}

// Globálne premenné a funkcie pre fetchTextFile, atď., zostávajú podobné.
function fetchTextFile(path) {
  return fetch(path).then(r => r.text());
}

// Initialization
document.addEventListener('DOMContentLoaded', initializeGame);

function updateStatusTime() {
  const el = document.getElementById('status-time');
  if (!el) return;
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  el.textContent = `${h}:${m}:${s}`;
}
setInterval(updateStatusTime, 1000);
document.addEventListener('DOMContentLoaded', updateStatusTime);

// NEW FUNCTION to show the main application home screen (Neovim-style splash)
function showAppHomeScreen() {
  console.log("Showing App Home Screen");
  if (gameAreaEl) gameAreaEl.classList.add('hidden');
  if (welcomeScreenEl) welcomeScreenEl.classList.remove('hidden');
  // Ensure terminal is not focused or active if applicable
  if (term) term.blur();
  // Clear level specific info from status bar if needed
  if (statusBarFileInfoEl) statusBarFileInfoEl.textContent = 'Vim Dojo';
  if (statusBarCursorPosEl) statusBarCursorPosEl.textContent = '';
}

// NEW functions for Help Modal
function showHelpModal() {
  if (helpModalEl) {
    helpModalEl.classList.remove('hidden');
    helpModalEl.focus(); // Set focus to the modal
  }
}

function hideHelpModal() {
  if (helpModalEl) {
    helpModalEl.classList.add('hidden');
  }
}

// NEW function to update splash screen footer stats
function updateSplashFooterStats() {
  if (!playerProgress || !allLevelsFlat || !splashCompletedLevelsEl || !splashTotalLevelsEl) {
    // Set to default or error state if data not ready
    if(splashCompletedLevelsEl) splashCompletedLevelsEl.textContent = '-';
    if(splashTotalLevelsEl) splashTotalLevelsEl.textContent = '-';
    return;
  }
  const totalLevels = allLevelsFlat.length;
  // currentLevelId is the ID of the *next* level to be played.
  // So, completed levels are currentLevelId - 1, but ensure it's not negative if currentLevelId is 1 (or 0 if no progress yet).
  const completedCount = Math.max(0, (playerProgress.currentLevelId || 1) - 1);
  
  splashCompletedLevelsEl.textContent = completedCount;
  splashTotalLevelsEl.textContent = totalLevels;
}

function setupSplashScreenMenuActions() {
  const menuItems = document.querySelectorAll('.splash-menu li');
  menuItems.forEach(item => {
    const actionTextElement = item.querySelector('span');
    if (!actionTextElement) return; 
    const actionText = actionTextElement.textContent.toLowerCase();
    
    item.addEventListener('click', () => {
      console.log(`Splash menu item clicked: ${actionText}`);
      switch (actionText) {
        case 'start learning':
          const targetLevelId = playerProgress.currentLevelId || (allLevelsFlat.length > 0 ? allLevelsFlat[0].id : 1);
          window.location.hash = `#/level/${targetLevelId}`;
          break;
        case 'select level': // The displayed keybind is Ctrl+Shift+E, which is global
          const firstLevelButton = levelsListEl.querySelector('.level-btn:not(.locked), .chapter-header');
          if (firstLevelButton) {
            firstLevelButton.focus();
          }
          break;
        case 'my progress':
          showProgressModal();
          break;
        case 'help':
          showHelpModal(); // This should now work correctly
          break;
        case 'quit':
          window.location.hash = ''; // Navigate to home
          break;
        default:
          console.warn(`Unknown splash menu action: ${actionText}`);
      }
    });
  });
}

// NEW functions for Progress Modal
function showProgressModal() {
  // Re-select elements at the time of function call for robustness, 
  // especially if their top-level const declaration was problematic.
  const currentProgressModal = document.getElementById('progress-modal');
  const currentProgressModalContent = document.getElementById('progress-modal-content');

  if (currentProgressModal && currentProgressModalContent) {
    const totalLevels = allLevelsFlat.length;
    const completedCount = Math.max(0, (playerProgress.currentLevelId || 1) - 1);
    const progressPercentage = totalLevels > 0 ? (completedCount / totalLevels) * 100 : 0;

    let message = '';
    let icon = '';

    if (progressPercentage === 100) {
      message = "Congratulations, Vim Master! You've completed all levels!";
      icon = '<i class="fas fa-crown" style="font-size: 3rem; color: gold;"></i>';
    } else if (progressPercentage >= 75) {
      message = "Nearly there, Vim Virtuoso! Keep up the amazing work!";
      icon = '<i class="fas fa-trophy" style="font-size: 3rem; color: silver;"></i>';
    } else if (progressPercentage >= 50) {
      message = "Halfway to mastery! You're doing great, Vim Adept!";
      icon = '<i class="fas fa-star" style="font-size: 3rem; color: #D4AF37;"></i>'; // Bronze/Star
    } else if (progressPercentage >= 25) {
      message = "Solid progress, Vim Padawan! The basics are strong with you.";
      icon = '<i class="fas fa-medal" style="font-size: 3rem; color: #cd7f32;"></i>'; // Medal
    } else if (progressPercentage > 0) {
      message = "A good start, Vim Novice! Every command learned is a victory.";
      icon = '<i class="fas fa-seedling" style="font-size: 3rem; color: var(--green);"></i>';
    } else {
      message = "Welcome to Vim Dojo! Your journey to Vim mastery begins now. Select 'Start Learning'!";
      icon = '<i class="fas fa-flag-checkered" style="font-size: 3rem; color: var(--text-color-muted);"></i>';
    }

    currentProgressModalContent.innerHTML = `
      <div style="text-align: center; margin-bottom: 1.5rem;">${icon}</div>
      <p style="text-align: center; font-size: 1.2rem; margin-bottom: 1rem;">${message}</p>
      <p style="text-align: center; font-size: 1rem;">You have completed <strong>${completedCount}</strong> out of <strong>${totalLevels}</strong> levels.</p>
      <p style="text-align: center; font-size: 1.2rem; font-weight: bold; margin-top: 0.5rem;">That's ${progressPercentage.toFixed(0)}% progress!</p>
    `;
    currentProgressModal.classList.remove('hidden');
    currentProgressModal.focus(); // Set focus to the modal
  } else {
    console.error("Progress modal elements not found upon trying to show!");
    // For debugging, log what was found:
    console.log("progressModalEl at show time:", currentProgressModal);
    console.log("progressModalContentEl at show time:", currentProgressModalContent);
  }
}

function hideProgressModal() {
  const currentProgressModal = document.getElementById('progress-modal'); // Re-select
  if (currentProgressModal) {
    currentProgressModal.classList.add('hidden');
  }
} 