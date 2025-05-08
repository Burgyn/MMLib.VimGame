// VimCore: základná simulácia Vim príkazov pre VimGame
window.vimcore = {
  processInput,
  checkGoal,
  getLinesFromXterm,
  setCursorInXterm,
  activeCount: "", // Stores the pending count for commands
  pendingKeystrokes: "" // Stores pending non-numeric keystrokes (e.g., 'd', 'c', 'f')
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

// Helper to check for motion keys (simplified)
function isMotionKey(key) {
  return ['h', 'l', 'j', 'k', 'w', 'b', 'e', '0', '$', 'G', 'g'].includes(key) || (key.length === 1 && key >= '0' && key <= '9'); // gg handled separately
}

/**
 * Spracuje vstup (kláves) a vráti nový stav editora.
 * @param {string} key - Stlačená klávesa (napr. \'h\', \'j\', \'0\', \'$\').
 * @param {string[]} lines - Aktuálny obsah editora ako pole riadkov.
 * @param {{row: number, col: number}} cursor - Aktuálna pozícia kurzora.
 * @returns {{lines: string[], cursor: {row: number, col: number}, commandProcessed: boolean, commandOutput?: string }} 
 *          Nový stav. commandProcessed is true if a command was run. commandOutput for messages.
 */
function processInput(key, lines, cursor) {
  let { row, col } = cursor;
  let newLines = lines.map(line => line);
  let commandExecuted = false;
  let newRow = row;
  let newCol = col;

  // If an operator is pending
  if (window.vimcore.pendingKeystrokes) {
    const operator = window.vimcore.pendingKeystrokes;
    const motionOrSecondKey = key;
    let count = parseInt(window.vimcore.activeCount || "1", 10);
    if (isNaN(count) || count < 1) count = 1;

    if (operator === 'd') {
      if (motionOrSecondKey === 'd') { // 'dd' command
        if (newLines.length > 0) {
          for (let i = 0; i < count && newRow < newLines.length; i++) {
            newLines.splice(newRow, 1); // Delete line at newRow
            // No need to increment newRow for deletion, next line comes up or it becomes empty
          }
          if (newLines.length === 0) {
            newRow = 0; newCol = 0; // Reset cursor if buffer empty
          } else {
            newRow = Math.min(newRow, newLines.length - 1); // Ensure newRow is valid
            newCol = 0; // Cursor to start of the line below (or current if last was deleted)
          }
          commandExecuted = true;
        }
      } else if (isMotionKey(motionOrSecondKey) && motionOrSecondKey !== 'g') { // 'dw', 'de', 'd0', 'd$' etc. (excluding 'dg' for now)
        // Simplified: 'dw' will delete from cursor to start of next word (inclusive of space if any)
        // This is a placeholder for more precise motion calculation.
        if (motionOrSecondKey === 'w') {
            // Very basic 'dw': delete to end of line for now as a placeholder
            if (newLines[newRow] !== undefined) {
                for(let i=0; i<count; i++) { // apply count times
                    if (newLines[newRow] !== undefined) {
                        if (newCol < newLines[newRow].length) {
                             newLines[newRow] = newLines[newRow].substring(0, newCol);
                        }
                         // If deleting multiple 'words' (lines for now), and current line becomes empty,
                         // and it's not the last line, effectively we should delete the line.
                        if (newLines[newRow] === "" && newLines.length > 1 && newRow < newLines.length -1) {
                            newLines.splice(newRow, 1);
                            // newRow stays, newCol = 0
                        } else if (newLines[newRow] === "" && newRow === newLines.length -1 && newLines.length > 1) {
                            // if it was the last line and became empty, stay on it.
                             newCol = 0;
                        } else if (newLines[newRow] === "" && newLines.length ===1) {
                            // last line, becomes empty
                            newCol = 0;
                        }
                    } else break; // no more lines to operate on
                }
                newCol = Math.min(newCol, (newLines[newRow] || "").length);
                 if (newLines[newRow] === "" && newCol > 0) newCol = 0;


                commandExecuted = true;
            }
        } else {
            // For other d+motion, just log and act as if processed to clear state
            console.log(`VimCore: Operator 'd' with motion '${motionOrSecondKey}' (count ${count}) - NOT FULLY IMPLEMENTED.`);
            commandExecuted = true; // To clear state
        }
      } else if (motionOrSecondKey === 'Escape') { // Cancel pending 'd'
        // State clearing will happen in the main `if (commandExecuted)` block or by main.js
        window.vimcore.pendingKeystrokes = "";
        window.vimcore.activeCount = "";
        return { lines, cursor, commandProcessed: false }; // Let main.js handle escape UI
      } else {
        // Invalid sequence after 'd'
        console.log(`VimCore: Invalid key '${motionOrSecondKey}' after 'd'.`);
        // Bell sound should be handled by main.js if desired
        window.vimcore.pendingKeystrokes = "";
        window.vimcore.activeCount = "";
        return { lines, cursor, commandProcessed: false }; // No actual Vim command processed
      }

      if (commandExecuted) {
        window.vimcore.pendingKeystrokes = "";
        window.vimcore.activeCount = "";
        // Final cursor validation after 'dd' or 'dw'
        if (newLines.length === 0) {
            newRow = 0; newCol = 0;
        } else {
            newRow = Math.max(0, Math.min(newRow, newLines.length - 1));
            const finalLineLen = (newLines[newRow] || "").length;
            newCol = Math.max(0, Math.min(newCol, finalLineLen > 0 ? finalLineLen -1 : 0));
        }
        return { lines: newLines, cursor: { row: newRow, col: newCol }, commandProcessed: true };
      }
    }
    // Add other operators like 'c', 'y' here in future
    // If here, pendingKeystrokes was set but current key didn't complete it validly (or was escape)
    // and not handled above. This case should ideally be caught by "else" above.
    // For safety, if commandExecuted is false, means it was not a valid combo.
    // Reset pending state.
    window.vimcore.pendingKeystrokes = ""; 
    // activeCount might still be valid for a *new* command starting with 'key'
    // return { lines, cursor, commandProcessed: false }; // Indicate nothing happened for this key yet

} // End of pendingKeystrokes handling


  // Handle digit input for counts (if no operator was pending and handled above)
  if (key >= '0' && key <= '9') {
    if (key === '0' && window.vimcore.activeCount === "") {
      // '0' is a command (motion), not start of count, unless a count is already active.
      // This will be handled by the switch statement if '0' is a motion key.
      // So, allow '0' to fall through if activeCount is empty.
    } else {
      window.vimcore.activeCount += key;
      return { lines: newLines, cursor, commandProcessed: false }; // Count updated, no command processed yet
    }
  }

  // Handle keys that START an operator sequence (if no operator was already pending)
  // This must come AFTER digit handling, so '2d' works (activeCount="2", then 'd' makes pendingKeystrokes="d")
  if (key === 'd' || key === 'c' || key === 'y') { // Add 'g' and others later
    window.vimcore.pendingKeystrokes = key;
    // activeCount (e.g., "2" from "2d") should persist.
    return { lines: newLines, cursor, commandProcessed: false }; // Operator started, wait for motion/next key
  }


  // If we reach here, 'key' is a standalone command/motion, or '0' as a motion.
  let count = 1;
  if (window.vimcore.activeCount !== "") {
    count = parseInt(window.vimcore.activeCount, 10);
    if (isNaN(count) || count < 1) {
      count = 1; // Default to 1 if parsing fails or count is invalid
    }
  }
  // DO NOT reset activeCount globally here. It's reset after a command successfully uses it,
  // or if an operation is cancelled/invalid.

  if (newLines.length === 0 && !['i', 'a', 'o', 'O'].includes(key)) {
    if(window.vimcore.activeCount) window.vimcore.activeCount = ""; // Clear count if file empty and not insert
    return { lines: [], cursor: { row: 0, col: 0 }, commandProcessed: true };
  }
  if (newLines.length === 0 && ['i', 'a', 'o', 'O'].includes(key)) {
    // TODO: Handle insert modes on empty buffer
    if(window.vimcore.activeCount) window.vimcore.activeCount = "";
    return { lines: [''], cursor: { row: 0, col: 0 }, commandProcessed: true }; // Placeholder
  }
  
  row = Math.max(0, Math.min(row, newLines.length - 1));
  let currentLine = newLines[row] || '';
  // col = Math.max(0, Math.min(col, currentLine.length)); // Allow cursor past EOL for $ etc.
  col = Math.max(0, Math.min(col, currentLine.length > 0 ? currentLine.length -1 : 0)); // More restrictive default

  // --- Main Command Loop (for count) ---
  let tempRow = newRow; // Use temp vars for iterations
  let tempCol = newCol;

  for (let i = 0; i < count; i++) {
    currentLine = newLines[tempRow] || ''; // Re-evaluate current line
    let currentLineLength = currentLine.length;
    
    // Ensure col is valid for the current line state before each iteration of command
    // For commands like h,l,j,k, cursor can be temporarily out of strict bounds during calculation.
    // But for 'x', it must be on a char. For '$' it can be at length.
    // Let's adjust col for safety before commands, specific commands can override.
    let effectiveCol = Math.max(0, Math.min(tempCol, currentLineLength > 0 ? currentLineLength -1 : 0));


    switch (key) {
      case 'h':
        if (currentLineLength > 0) tempCol = Math.max(0, tempCol - 1);
        else tempCol = 0;
        commandExecuted = true;
        break;
      case 'l':
        if (currentLineLength > 0) tempCol = Math.min(currentLineLength - 1, tempCol + 1);
        else tempCol = 0;
        commandExecuted = true;
        break;
      case 'k':
        tempRow = Math.max(0, tempRow - 1);
        const prevLineLengthK = (newLines[tempRow] || '').length;
        tempCol = Math.min(tempCol, prevLineLengthK > 0 ? prevLineLengthK - 1 : 0);
        commandExecuted = true;
        break;
      case 'j':
        tempRow = Math.min(newLines.length - 1, tempRow + 1);
        const nextLineLengthJ = (newLines[tempRow] || '').length;
        tempCol = Math.min(tempCol, nextLineLengthJ > 0 ? nextLineLengthJ - 1 : 0);
        commandExecuted = true;
        break;
      case '0':
        tempCol = 0;
        commandExecuted = true;
        if (i > 0) break; 
        break;
      case '$':
        tempCol = currentLineLength > 0 ? currentLineLength -1 : 0;
        commandExecuted = true;
        if (i > 0) break; 
        break;
      case 'x':
        if (currentLineLength > 0 && effectiveCol < currentLineLength) { // use effectiveCol for 'x'
          newLines[tempRow] = currentLine.substring(0, effectiveCol) + currentLine.substring(effectiveCol + 1);
          const newLineLengthX = newLines[tempRow].length;
          // Cursor remains at effectiveCol, or moves left if last char deleted
          tempCol = Math.min(effectiveCol, newLineLengthX > 0 ? newLineLengthX - 1 : 0);
          commandExecuted = true;
        } else {
           if (i > 0) break; 
        }
        break;
      case 'w': {
        commandExecuted = true; // Assume it will execute, set to false if it can't move
        let r = tempRow;
        let c = tempCol;
        let currentWordLineText = newLines[r] || "";

        if (c < currentWordLineText.length && !/\\s/.test(currentWordLineText[c])) {
            while (c < currentWordLineText.length && !/\\s/.test(currentWordLineText[c])) {
                c++;
            }
        }

        let wordFound = false;
        while (!wordFound) {
            if (c < currentWordLineText.length) {
                if (/\\s/.test(currentWordLineText[c])) {
                    c++; 
                } else {
                    tempCol = c;
                    tempRow = r;
                    wordFound = true;
                }
            } else { 
                if (r < newLines.length - 1) {
                    r++;
                    c = 0;
                    currentWordLineText = newLines[r] || "";
                    if (currentWordLineText.length === 0 && r < newLines.length - 1) {
                        continue; 
                    }
                } else {
                    // End of file
                    if (i === 0) commandExecuted = false; // Only set false if first attempt fails
                    tempRow = r; 
                    tempCol = Math.max(0, currentWordLineText.length > 0 ? currentWordLineText.length -1 : 0);
                    wordFound = true; 
                }
            }
        }
        if (!commandExecuted && i === 0 && count > 1) count = 1; // If 'w' can't move, don't try to repeat for count.
        break;
      }
      case 'b': {
        commandExecuted = true; // Assume it will execute
        let r = tempRow;
        let c = tempCol;
        let currentWordLineText = newLines[r] || "";

        if (c > 0 && (/\\s/.test(currentWordLineText[c]) || (c > 0 && /\\s/.test(currentWordLineText[c-1])) ) ) {
            c--;
        }
        else if (c === 0 && r > 0 && ( (currentWordLineText.length === 0) || (currentWordLineText.length > 0 && /\\s/.test(currentWordLineText[0])) ) ) {
        } else if (c > 0 && !/\\s/.test(currentWordLineText[c]) && /\\s/.test(currentWordLineText[c-1]) ){
            c--; 
        }

        let wordFound = false;
        while (!wordFound) {
            if (c >= 0 && c < currentWordLineText.length) {
                if (/\\s/.test(currentWordLineText[c])) {
                    c--; 
                    if (c < 0) { 
                    }
                } else {
                    while (c >= 0 && !/\\s/.test(currentWordLineText[c])) {
                        c--;
                    }
                    tempCol = c + 1; 
                    tempRow = r;
                    wordFound = true;
                }
            } else { 
                if (r > 0) { 
                    r--;
                    currentWordLineText = newLines[r] || "";
                    c = Math.max(0, currentWordLineText.length - 1); 
                    if (currentWordLineText.length === 0 && r > 0) { 
                        continue; 
                    }
                } else {
                    if (i === 0) commandExecuted = false;
                    tempRow = 0;
                    tempCol = 0;
                    wordFound = true; 
                }
            }
        }
        if (!commandExecuted && i === 0 && count > 1) count = 1;
        break;
      }
      case 'e': {
        commandExecuted = true; // Assume it will execute
        let r = tempRow;
        let c = tempCol;
        let line = newLines[r] || "";
        let findNextWordEnd = false;

        if (c < line.length && /\\s/.test(line[c])) { 
            findNextWordEnd = true;
        } else if (c < line.length) { 
            let atEndOfCurrentWord = true;
            if (c < line.length - 1 && !/\\s/.test(line[c+1])) {
                atEndOfCurrentWord = false; 
            }
            if (atEndOfCurrentWord) {
                findNextWordEnd = true; 
            }
        } else { 
            findNextWordEnd = true;
        }

        if (!findNextWordEnd) {
            while (c < line.length - 1 && !/\\s/.test(line[c+1])) {
                c++;
            }
            tempCol = c;
            tempRow = r;
        } else {
            if (c < line.length && !/\\s/.test(line[c])) { 
                while (c < line.length && !/\\s/.test(line[c])) {
                    c++;
                }
            } 
            
            let advancedToNextWordRegion = false;
            while(!advancedToNextWordRegion){
                if(c < line.length){
                    if(/\\s/.test(line[c])){
                        c++;
                    } else {
                        advancedToNextWordRegion = true; 
                    }
                } else { 
                    if (r < newLines.length - 1) {
                        r++;
                        c = 0;
                        line = newLines[r] || "";
                        if (line.length === 0 && r < newLines.length -1) { 
                           continue;
                        }                        
                    } else {
                        if(i === 0) commandExecuted = false; 
                        tempCol = Math.max(0, line.length - 1); 
                        if(line.length === 0) tempCol = 0;
                        tempRow = r;
                        advancedToNextWordRegion = true; 
                        break;
                    }
                }
            }

            if (commandExecuted) { 
                 if (c < line.length) { 
                    while (c < line.length - 1 && !/\\s/.test(line[c+1])) {
                        c++;
                    }
                    tempCol = c;
                    tempRow = r;
                 } else { 
                    if(i === 0) commandExecuted = false;
                    tempCol = Math.max(0, line.length -1); 
                    if (line.length === 0) tempCol = 0;
                    tempRow = r;
                 }
            }
        }
        if (!commandExecuted && i === 0 && count > 1) count = 1; 
        break;
      }
      case 'g': // Special handling for 'g' might be needed if 'gg' is not passed as a single key
        // For now, 'g' alone does nothing unless 'gg' logic is elsewhere or passed as 'gg'
        // If 'gg' is handled by main.js sending "gg", this case might not be hit for that.
        commandExecuted = false; // 'g' alone does nothing unless part of 'gg'
        break;
      default:
        commandExecuted = false; 
        break;
    }
    if (!commandExecuted && i === 0 && count > 1) { // If the first execution of a command did nothing, don't repeat.
        break; 
    }
    if (key === '0' || key === '$') { // These commands don't typically repeat with count for N times.
        if (i === 0 && commandExecuted) { /* allow first execution */ } else { break; }
    }

    // After one iteration of the command, update row/col for the next iteration if count > 1
    newRow = tempRow;
    newCol = tempCol;
  } // End of for loop for count


  // Handle 'G' and 'gg' (if passed as "gg") post-loop, as they set row/col directly based on final count.
  if (key === 'G') {
    if (count === 1 && window.vimcore.activeCount === "") { // G to last line
        newRow = newLines.length - 1;
    } else { // <count>G to line <count>
        newRow = Math.min(count - 1, newLines.length - 1);
    }
    newRow = Math.max(0, newRow);
    newCol = 0; // Go to column 0 of the target line.
    commandExecuted = true;
  }
  if (key === "gg") { // If main.js sends "gg" as the key
      newRow = Math.min(count - 1, newLines.length - 1); // count is from activeCount e.g. 3gg
      newRow = Math.max(0, newRow);
      newCol = 0; // Go to column 0 of the target line
      commandExecuted = true;
  }


  // Final cursor position validation
  if (commandExecuted) {
    newRow = Math.max(0, Math.min(newRow, newLines.length - 1)); // Ensure row is valid
    const finalLineLength = (newLines[newRow] || '').length;
    if (newCol >= finalLineLength && finalLineLength > 0) {
        newCol = finalLineLength - 1;
    } else if (finalLineLength === 0) {
        newCol = 0;
    } else {
        newCol = Math.max(0, newCol); // Ensure col is not negative
    }
    window.vimcore.activeCount = ""; // Clear count after successful standalone command
  } else {
    // If no command was executed (e.g., unknown key, or an operator key that didn't complete)
    // Do not clear activeCount if it was just a sequence of digits.
    // If it was an unknown key after digits, then clear activeCount.
    if (! (key >= '0' && key <= '9') ) { // If key is not a digit
         // and it wasn't 'd', 'c', 'y' (which return early if starting sequence)
        if (!['d', 'c', 'y'].includes(key)) {
             window.vimcore.activeCount = ""; // Clear for unknown non-digit, non-operator-starting key
        }
    }
  }
  
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