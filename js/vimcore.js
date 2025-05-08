// VimCore: základná simulácia Vim príkazov pre VimGame
window.vimcore = {
  processInput,
  checkGoal,
  getLinesFromXterm,
  setCursorInXterm,
  activeCount: "" // Stores the pending count for commands
};

/**
 * Získa aktuálne riadky z Xterm.js buffera.
 * @param {Terminal} term - Inštancia Xterm.js.
 * @returns {string[]} Pole reťazcov, kde každý reťazec je jeden riadok.
 */
function getLinesFromXterm(term) {
  const buffer = term.buffer.active;
  const lines = [];
  for (let i = 0; i < buffer.length; i++) {
    lines.push(buffer.getLine(i).translateToString(true)); // true pre trimRight
  }
  return lines;
}

/**
 * Nastaví kurzor v Xterm.js na danú pozíciu.
 * @param {Terminal} term - Inštancia Xterm.js.
 * @param {object} cursorPos - Objekt s { row: number, col: number }.
 */
function setCursorInXterm(term, cursorPos) {
  term.scrollToRow(cursorPos.row);
  // Xterm.js API pre priame nastavenie kurzora nie je také priamočiare pre každý shell.
  // Namiesto toho sa budeme spoliehať na to, že príkazy ako write posunú kurzor,
  // alebo použijeme sekvencie, ak bude treba.
  // Pre jednoduchosť zatiaľ len scrollujeme na riadok.
  // V praxi budeme prepisovať riadok s novým kurzorom, alebo manažovať kurzor detailnejšie.
  // Pre základné pohyby by malo stačiť, že vieme, kde kurzor logicky je.
  // Xterm.js terminál sám zobrazí kurzor na pozícii, kde sa naposledy písalo alebo kam bol posunutý escape sekvenciami.
  // Pre naše účely budeme chcieť vizuálne reprezentovať kurzor. Toto vyriešime v main.js pri renderovaní.
}

/**
 * Spracuje vstup (kláves) a vráti nový stav editora.
 * @param {string} key - Stlačená klávesa (napr. 'h', 'j', '0', '$').
 * @param {string[]} lines - Aktuálny obsah editora ako pole riadkov.
 * @param {{row: number, col: number}} cursor - Aktuálna pozícia kurzora.
 * @returns {{lines: string[], cursor: {row: number, col: number}, commandProcessed: boolean }} 
 *          Nový stav. commandProcessed is true if a command was run, false if count was updated.
 */
function processInput(key, lines, cursor) {
  let { row, col } = cursor;
  const newLines = lines.map(line => line); // Kópia poľa

  // Handle digit input for counts
  if (key >= '0' && key <= '9') {
    if (key === '0' && window.vimcore.activeCount === "") {
      // '0' is a command, not start of count, unless a count is already active
      // This specific '0' case will be handled below as a command.
    } else {
      window.vimcore.activeCount += key;
      return { lines: newLines, cursor, commandProcessed: false }; // Count updated, no command processed yet
    }
  }

  let count = 1;
  if (window.vimcore.activeCount !== "") {
    count = parseInt(window.vimcore.activeCount, 10);
    if (isNaN(count) || count < 1) {
      count = 1; // Default to 1 if parsing fails or count is invalid
    }
  }
  // Reset activeCount after parsing it for a command (or if key is not a digit)
  // This reset happens regardless of whether a command is found,
  // to clear count if a non-command, non-digit key is pressed after digits.
  window.vimcore.activeCount = ""; 


  if (newLines.length === 0 && !['i', 'a', 'o', 'O'].includes(key)) {
    return { lines: [], cursor: { row: 0, col: 0 }, commandProcessed: true };
  }
  if (newLines.length === 0 && ['i', 'a', 'o', 'O'].includes(key)) {
    // TODO: Handle insert modes on empty buffer
    return { lines: [''], cursor: { row: 0, col: 0 }, commandProcessed: true }; // Placeholder
  }
  
  row = Math.max(0, Math.min(row, newLines.length - 1));
  let currentLine = newLines[row] || '';
  let currentLineLength = currentLine.length;
  // Adjust initial column based on Vim's behavior (can be on char or just after for some ops)
  col = Math.max(0, Math.min(col, currentLineLength));


  let newRow = row;
  let newCol = col;
  let commandExecuted = false; // Flag to track if any action was taken

  for (let i = 0; i < count; i++) { // Apply command `count` times
    // Re-evaluate current line and its length for each iteration of count, esp for 'x'
    currentLine = newLines[newRow] || '';
    currentLineLength = currentLine.length;
    
    // Ensure col is valid for the current line state before each iteration of command
    // For commands like h,l,j,k, cursor can be temporarily out of strict bounds during calculation.
    // But for 'x', it must be on a char. For '$' it can be at length.
    // Let's adjust col for safety before commands, specific commands can override.
    let effectiveCol = Math.max(0, Math.min(newCol, currentLineLength > 0 ? currentLineLength -1 : 0));
    if (key === '$') { // $ allows col to be at currentLineLength
        effectiveCol = currentLineLength;
    }


    switch (key) {
      case 'h':
        if (currentLineLength > 0) newCol = Math.max(0, newCol - 1);
        else newCol = 0;
        commandExecuted = true;
        break;
      case 'l':
        if (currentLineLength > 0) newCol = Math.min(currentLineLength - 1, newCol + 1);
        else newCol = 0;
        commandExecuted = true;
        break;
      case 'k':
        newRow = Math.max(0, newRow - 1);
        // Try to maintain column, or go to end of shorter line
        const prevLineLengthK = (newLines[newRow] || '').length;
        newCol = Math.min(newCol, prevLineLengthK > 0 ? prevLineLengthK - 1 : 0);
        commandExecuted = true;
        break;
      case 'j':
        newRow = Math.min(newLines.length - 1, newRow + 1);
        const nextLineLengthJ = (newLines[newRow] || '').length;
        newCol = Math.min(newCol, nextLineLengthJ > 0 ? nextLineLengthJ - 1 : 0);
        commandExecuted = true;
        break;
      case '0':
        newCol = 0;
        commandExecuted = true;
        // '0' typically doesn't repeat with count in a meaningful direct way for this simple model
        if (i > 0) break; // break from count loop for '0'
        break;
      case '$':
        newCol = currentLineLength > 0 ? currentLineLength -1 : 0; // Move to last char
        // Or newCol = currentLineLength; // to move AFTER last char
        // Vim's $ in normal mode moves to the last character of the line.
        // For cursor positioning, length - 1 is more common if line not empty.
        commandExecuted = true;
        if (i > 0) break; // break from count loop for '$'
        break;
      case 'x':
        // 'x' should use effectiveCol which ensures it's on an existing character
        if (currentLineLength > 0 && effectiveCol < currentLineLength) {
          newLines[newRow] = currentLine.substring(0, effectiveCol) + currentLine.substring(effectiveCol + 1);
          // Cursor remains, or moves left if last char deleted
          const newLineLengthX = newLines[newRow].length;
          newCol = Math.min(effectiveCol, newLineLengthX > 0 ? newLineLengthX - 1 : 0);
          commandExecuted = true;
        } else {
           if (i > 0) break; // if 'x' did nothing, and it's part of a count, stop.
        }
        break;
      case 'g': // Check for 'gg'
        if (i === 0 && count === 1) { // Only check for next 'g' if no count or count is 1 (for simple 'gg')
            // This is a simplified 'g', actual 'g' needs a following char.
            // We'll make 'g' itself a NOOP unless followed by 'g' (handled in main.js or by sending 'gg' as key)
            // For now, if 'g' alone, do nothing. 'gg' will be a separate "key".
            // To implement 'gg' properly here, processInput would need to handle multi-key commands
            // or `key` would be 'gg'. Let's assume `key` can be 'gg'.
        }
        commandExecuted = false; // 'g' alone does nothing
        break;
      case 'w': {
        commandExecuted = true;
        let r = newRow;
        let c = newCol;
        let currentLineText = newLines[r] || "";

        // Phase 1: If on a non-whitespace character, advance c to the position AFTER the current word.
        if (c < currentLineText.length && !/\s/.test(currentLineText[c])) {
            while (c < currentLineText.length && !/\s/.test(currentLineText[c])) {
                c++;
            }
        }

        // Phase 2: Skip whitespace, advancing to the next line if necessary, until a non-whitespace char is found or EOF.
        let wordFound = false;
        while (!wordFound) {
            if (c < currentLineText.length) { // Still on the current line text being examined
                if (/\s/.test(currentLineText[c])) {
                    c++; // Skip space
                } else {
                    // Found start of the next word on the current line segment
                    newCol = c;
                    newRow = r;
                    wordFound = true;
                }
            } else { // Reached end of current line text (c >= currentLineText.length)
                if (r < newLines.length - 1) { // Can go to next line
                    r++;
                    c = 0;
                    currentLineText = newLines[r] || ""; // Update currentLineText to the new line
                    if (currentLineText.length === 0 && r < newLines.length - 1) {
                        // Current new line is empty, and it's not the last line of the file,
                        // so loop again to effectively skip this empty line.
                        // The loop condition (c < currentLineText.length) will be false, leading to the else here again.
                        continue; 
                    }
                    // If the new line (even if empty) is the last line, or if it has content,
                    // the loop will re-evaluate c < currentLineText.length.
                } else {
                    // End of file, cannot move further
                    commandExecuted = false; 
                    // Position cursor at the end of the very last line.
                    newRow = r; // Should be last line index already
                    newCol = Math.max(0, currentLineText.length); // Go to end of line (after last char)
                                                              // Vim 'w' at EOF often stays put or on last char.
                                                              // For simplicity, let's ensure it stays on the line.
                    if (currentLineText.length > 0) newCol = currentLineText.length -1;
                    else newCol = 0;

                    wordFound = true; // Stop searching
                }
            }
        }
        
        if (!commandExecuted && i === 0) count = 1; // If w can't move, don't repeat for count.
        break;
      }
      case 'b': {
        commandExecuted = true;
        let r = newRow;
        let c = newCol;
        let currentLineText = newLines[r] || "";

        // Phase 1: If current `c` is on whitespace or at the very start of a word, move `c` back one position to start search from there.
        // This helps `b` when pressed multiple times to correctly cross word boundaries.
        if (c > 0 && (/\s/.test(currentLineText[c]) || (c > 0 && /\s/.test(currentLineText[c-1])) ) ) {
            c--;
        }
        // If c is at the start of the line (0) but not the first line, and we need to go to prev line:
        else if (c === 0 && r > 0 && ( (currentLineText.length === 0) || (currentLineText.length > 0 && /\s/.test(currentLineText[0])) ) ) {
             // If at (0,0) or (line_start, whitespace) and r > 0, prepare to go to previous line
        } else if (c > 0 && !/\s/.test(currentLineText[c]) && /\s/.test(currentLineText[c-1]) ){
            // If cursor is at the beginning of a word (not whitespace, but prev char is whitespace)
            c--; // Move into the whitespace or previous word to start scan properly.
        }

        // Phase 2: Find the beginning of the previous/current word.
        let wordFound = false;
        while (!wordFound) {
            if (c >= 0 && c < currentLineText.length) { // Still on the current line text being examined
                if (/\s/.test(currentLineText[c])) {
                    c--; // Skip whitespace backwards
                    if (c < 0) { // Reached beginning of line while skipping spaces
                        // Handled by the `else` block below (c < 0)
                    }
                } else {
                    // Now on a non-whitespace character. Move to the beginning of this word.
                    while (c >= 0 && !/\s/.test(currentLineText[c])) {
                        c--;
                    }
                    newCol = c + 1; // The char after the space, or 0 if word starts at line beginning.
                    newRow = r;
                    wordFound = true;
                }
            } else { // Reached end (c < 0) or start (c >= length, though not for 'b') of current line text
                if (r > 0) { // Can go to previous line
                    r--;
                    currentLineText = newLines[r] || "";
                    c = Math.max(0, currentLineText.length - 1); // Go to end of previous line
                    if (currentLineText.length === 0 && r > 0) { // Previous line is empty, and it's not the first line
                        continue; // Skip this empty line by re-entering while loop
                    }
                } else {
                    // Start of file, cannot move further back
                    commandExecuted = false;
                    newRow = 0;
                    newCol = 0;
                    wordFound = true; // Stop searching
                }
            }
        }
        if (!commandExecuted && i === 0) count = 1;
        break;
      }
      case 'e': {
        commandExecuted = true;
        let line = newLines[newRow] || "";
        if (newCol >= line.length -1 && newRow < newLines.length - 1) { // End of line, try next line
            newRow++;
            newCol = 0;
            line = newLines[newRow] || "";
        }

        if (newCol < line.length) {
            let searchingFrom = newCol;
            // If on whitespace, skip to next non-whitespace
            if (/\\s/.test(line[searchingFrom])) {
                while (searchingFrom < line.length && /\\s/.test(line[searchingFrom])) {
                    searchingFrom++;
                }
            }
            // If still in line, skip to end of current word
            if (searchingFrom < line.length) {
                 while (searchingFrom < line.length - 1 && !/\\s/.test(line[searchingFrom+1])) {
                    searchingFrom++;
                }
                newCol = searchingFrom;
            } else if (newRow < newLines.length - 1) { // Moved past all chars on current line
                newRow++;
                newCol = 0;
                line = newLines[newRow] || "";
                // Find first word end on new line
                 let nextCol = 0;
                 while(nextCol < line.length && /\\s/.test(line[nextCol])) { // skip leading spaces
                     nextCol++;
                 }
                 if (nextCol < line.length) { // if non-space found
                    while (nextCol < line.length - 1 && !/\\s/.test(line[nextCol+1])) {
                        nextCol++;
                    }
                    newCol = nextCol;
                 } else { // new line is all spaces or empty
                    newCol = Math.max(0, line.length -1); // go to end of it
                 }
            } else {
                commandExecuted = false; // cannot move
            }
        } else if (newRow < newLines.length - 1) { // On empty line or at very end of line string
            newRow++;
            newCol = 0;
            line = newLines[newRow] || "";
            // Find first word end on new line
            let nextCol = 0;
            while(nextCol < line.length && /\\s/.test(line[nextCol])) { // skip leading spaces
                nextCol++;
            }
            if (nextCol < line.length) { // if non-space found
                while (nextCol < line.length - 1 && !/\\s/.test(line[nextCol+1])) {
                    nextCol++;
                }
                newCol = nextCol;
            } else { // new line is all spaces or empty
                newCol = Math.max(0, line.length -1); // go to end of it
                if (line.length === 0) newCol = 0;
            }
        }
        else {
           commandExecuted = false; // Cannot move
        }
        if (!commandExecuted && i == 0) count = 1;
        break;
      }
      // More commands will be added here
      default:
        // If key is not a digit and not a known command, count is already reset.
        // No command executed for this unknown key.
        if (i > 0) break; // break from count loop if unknown command
        commandExecuted = false; 
        break;
    }
    if (!commandExecuted && i === 0) break; // If the first execution of a command did nothing (e.g. 'x' on empty line), don't repeat.
    if (key === '0' || key === '$') break; // These commands don't typically repeat with count for N times.
  }

  if (key === 'g' && arguments[0] === 'g') { // A bit of a hack to check for 'gg' if passed that way
      newRow = 0; 
      newCol = 0;
      commandExecuted = true;
      if (count > 1) { // e.g. 3gg goes to line 3 (index 2)
        newRow = Math.min(count - 1, newLines.length - 1);
      }
  }
  // Special handling for 'G'
  if (key === 'G') {
    if (count === 1 && window.vimcore.activeCount === "") { // G to last line (count was default 1 because activeCount was empty)
        newRow = newLines.length - 1;
    } else { // <count>G to line <count>
        newRow = Math.min(count - 1, newLines.length - 1);
    }
    newRow = Math.max(0, newRow); // Ensure row is not negative
    const targetLineLengthG = (newLines[newRow] || '').length;
    newCol = Math.min(newCol, targetLineLengthG > 0 ? targetLineLengthG -1 : 0); // try to keep col, or move to end
    // Vim often goes to first non-whitespace, for simplicity, col 0 or keep current if valid
    newCol = 0; // Simplification: go to column 0 of the target line.
    commandExecuted = true;
  }
  // Handle 'gg' if key is "gg" (requires main.js to send "gg")
  if (key === "gg") {
      newRow = Math.min(count - 1, newLines.length - 1);
      newRow = Math.max(0, newRow);
      newCol = 0; // Go to column 0 of the target line
      commandExecuted = true;
  }


  // Final cursor position validation
  const finalLineLength = (newLines[newRow] || '').length;
  if (newCol >= finalLineLength && finalLineLength > 0) {
      newCol = finalLineLength - 1; // Place cursor on the last character
  } else if (finalLineLength === 0) {
      newCol = 0; // Cursor at col 0 for empty line
  }
  // If cursor is past actual content (e.g. after $), normalise it for most operations
  // but display might show it at 'length'. For logic, 'length-1' is safer if not empty.


  return { lines: newLines, cursor: { row: newRow, col: newCol }, commandProcessed: commandExecuted };
}

/**
 * Overí, či bol splnený cieľ levelu.
 * @param {object} level - Objekt levelu s 'verify', 'goalTextFile', atď.
 * @param {string[]} currentLines - Aktuálny obsah editora ako pole riadkov.
 * @param {{row: number, col: number}} currentCursor - Aktuálna pozícia kurzora.
 * @param {string[]} goalLines - Cieľový obsah editora ako pole riadkov (pre 'text_equals').
 * @returns {boolean} True, ak je cieľ splnený.
 */
function checkGoal(level, currentLines, currentCursor, goalLines) {
  switch (level.verify) {
    case 'cursor_at_start':
      // Overí, či je kurzor na úplnom začiatku prvého znaku riadku (stĺpec 0)
      return currentCursor.col === 0;
    case 'cursor_at_end':
      // Overí, či je kurzor na poslednom znaku aktuálneho riadku
      const lineLength = currentLines[currentCursor.row] ? currentLines[currentCursor.row].length : 0;
      // For cursor_at_end, cursor should be ON the last character.
      // If line is "abc", length is 3, last char index is 2.
      return currentCursor.col === (lineLength > 0 ? lineLength - 1 : 0);
    case 'text_equals':
      if (currentLines.length !== goalLines.length) return false;
      for (let i = 0; i < currentLines.length; i++) {
        if (currentLines[i] !== goalLines[i]) return false;
      }
      return true;
    case 'cursor_at_pos': // Nový typ overenia pre konkrétnu pozíciu
      return currentCursor.row === level.goalCursor.row && currentCursor.col === level.goalCursor.col;
    // TODO: ďalšie typy overenia
    default:
      return false;
  }
} 