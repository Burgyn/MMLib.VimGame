// VimCore: základná simulácia Vim príkazov pre VimGame
window.vimcore = {
  processInput,
  checkGoal,
  getLinesFromXterm,
  setCursorInXterm,
  activeCount: "", // Stores the pending count for commands
  pendingKeystrokes: "", // Stores pending non-numeric keystrokes (e.g., 'd', 'c', 'f', 'F', 't', 'T')
  lastFindCommand: null, // Stores { type: 'f'/'F'/'t'/'T', char: 'x', count: 1, forwardForSemicolon: true }
  isWaitingForMotionOrTargetChar: false // Added this flag
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
 * Checks if a line is blank (empty or only whitespace).
 * @param {string} line The line to check.
 * @returns {boolean} True if the line is blank, false otherwise.
 */
function isLineBlank(line) {
  return line.trim() === '';
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

  // If an operator or find command is pending
  if (window.vimcore.pendingKeystrokes) {
    const operatorOrFinder = window.vimcore.pendingKeystrokes;
    const motionOrTargetChar = key;
    let count = parseInt(window.vimcore.activeCount || "1", 10);
    if (isNaN(count) || count < 1) count = 1;

    if (operatorOrFinder === 'd') {
      if (motionOrTargetChar === 'd') { // 'dd' command
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
      } else if (isMotionKey(motionOrTargetChar) && motionOrTargetChar !== 'g') { // 'dw', 'de', 'd0', 'd$' etc. (excluding 'dg' for now)
        // Simplified: 'dw' will delete from cursor to start of next word (inclusive of space if any)
        // This is a placeholder for more precise motion calculation.
        if (motionOrTargetChar === 'w') {
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
            console.log(`VimCore: Operator 'd' with motion '${motionOrTargetChar}' (count ${count}) - NOT FULLY IMPLEMENTED.`);
            commandExecuted = true; // To clear state
        }
      } else if (motionOrTargetChar === 'Escape') { // Cancel pending 'd'
        // State clearing will happen in the main `if (commandExecuted)` block or by main.js
        window.vimcore.pendingKeystrokes = "";
        window.vimcore.activeCount = "";
        window.vimcore.isWaitingForMotionOrTargetChar = false;
        return { lines, cursor, commandProcessed: false }; // Let main.js handle escape UI
      } else {
        // Invalid sequence after 'd'
        console.log(`VimCore: Invalid key '${motionOrTargetChar}' after 'd'.`);
        // Bell sound should be handled by main.js if desired
        window.vimcore.pendingKeystrokes = "";
        window.vimcore.activeCount = "";
        window.vimcore.isWaitingForMotionOrTargetChar = false;
        return { lines, cursor, commandProcessed: false }; // No actual Vim command processed
      }

      if (commandExecuted) {
        window.vimcore.pendingKeystrokes = "";
        window.vimcore.activeCount = "";
        window.vimcore.isWaitingForMotionOrTargetChar = false;
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
    } else if (operatorOrFinder === 'f' || operatorOrFinder === 'F' || operatorOrFinder === 't' || operatorOrFinder === 'T') {
        if (motionOrTargetChar === 'Escape') {
            window.vimcore.pendingKeystrokes = "";
            window.vimcore.activeCount = "";
            window.vimcore.isWaitingForMotionOrTargetChar = false;
            return { lines, cursor, commandProcessed: false };
        }
        
        const isFindType = (operatorOrFinder === 'f' || operatorOrFinder === 'F');
        const isTillType = (operatorOrFinder === 't' || operatorOrFinder === 'T');
        const findForward = (operatorOrFinder === 'f' || operatorOrFinder === 't');

        let found = false;
        let finalR = row;
        let finalC = col;
        let targetCharFoundAt = -1; // Store the actual column where the character was found

        const lineText = newLines[row] || "";
        let searchFromCol = col; // This will be adjusted for each iteration of count

        for (let k = 0; k < count; k++) { // Apply count times
            let iterationFound = false;
            let iterationTargetCharFoundAt = -1;
            let searchStartOffset = findForward ? 1 : -1;
            let currentSearchCol = searchFromCol + searchStartOffset;

            if (findForward) {
                for (let cScan = currentSearchCol; cScan < lineText.length; cScan++) {
                    if (lineText[cScan] === motionOrTargetChar) {
                        iterationTargetCharFoundAt = cScan;
                        iterationFound = true;
                        break;
                    }
                }
            } else { // search backward
                for (let cScan = currentSearchCol; cScan >= 0; cScan--) {
                    if (lineText[cScan] === motionOrTargetChar) {
                        iterationTargetCharFoundAt = cScan;
                        iterationFound = true;
                        break;
                    }
                }
            }

            if (iterationFound) {
                targetCharFoundAt = iterationTargetCharFoundAt;
                if (isFindType) {
                    searchFromCol = targetCharFoundAt; // For next iteration of f/F, search from the found char
                } else if (isTillType) {
                    // For next iteration of t/T, search from one step before/after the found char, 
                    // effectively from where the cursor would land.
                    searchFromCol = findForward ? targetCharFoundAt -1 : targetCharFoundAt + 1;
                    if (findForward && searchFromCol < col) { // safety, should not happen if logic correct
                         iterationFound = false; // Cannot move for t if char is current or before
                    } else if (!findForward && searchFromCol > col) { // safety
                         iterationFound = false; // Cannot move for T if char is current or after
                    }
                }
                found = true; // At least one iteration found something
            } else {
                found = false; // if any of the counts fail, the whole command fails
                break; 
            }
        }

        if (found) {
            newRow = finalR; // Stays on the same line
            if (isFindType) {
                newCol = targetCharFoundAt;
            } else { // isTillType
                if (findForward) {
                    // Move to just before the character
                    // If targetCharFoundAt is same as original col + 1, means char is immediately next
                    // Vim's 't{char}' when {char} is the next char will not move.
                    if (targetCharFoundAt > col) { // Ensure we are moving forward
                         newCol = targetCharFoundAt - 1;
                    } else {
                        found = false; // Cannot move, e.g. cursor on 'a', command 'tb', text "ab"
                    }
                } else { // for 'T', searching backward
                    // Move to just after the character
                    if (targetCharFoundAt < col) { // Ensure we are moving backward
                        newCol = targetCharFoundAt + 1;
                    } else {
                        found = false; // Cannot move
                    }
                }
            }
            if (!found) commandExecuted = false; // if till type couldn't move
            else commandExecuted = true;

            if (commandExecuted) {
                window.vimcore.lastFindCommand = {
                    type: operatorOrFinder, // 'f', 'F', 't', or 'T'
                    char: motionOrTargetChar,
                    count: 1, // Semicolon/comma always do 1 find from the perspective of lastFindCommand
                    forwardForSemicolon: findForward 
                };
            }
        } else {
            commandExecuted = false;
        }
        window.vimcore.pendingKeystrokes = "";
        window.vimcore.activeCount = "";
        window.vimcore.isWaitingForMotionOrTargetChar = false;
        return { lines: newLines, cursor: { row: newRow, col: newCol }, commandProcessed: commandExecuted };
    } else {
        // If pendingKeystrokes was set but current key didn't complete it validly
        console.log(`VimCore: Operator/Finder '${operatorOrFinder}' with key '${motionOrTargetChar}' - not a valid combo or not implemented.`);
        window.vimcore.pendingKeystrokes = "";
        window.vimcore.activeCount = "";
        window.vimcore.isWaitingForMotionOrTargetChar = false;
        return { lines, cursor, commandProcessed: false };
    }

    // This part below for dd or dw might need restructuring if it was inside the 'd' block only
    if (commandExecuted) { // This was originally for 'd' operator, check if still needed here broadly
        window.vimcore.pendingKeystrokes = "";
        window.vimcore.activeCount = "";
        window.vimcore.isWaitingForMotionOrTargetChar = false;
        // Final cursor validation
        if (newLines.length === 0) {
            newRow = 0; newCol = 0;
        } else {
            newRow = Math.max(0, Math.min(newRow, newLines.length - 1));
            const finalLineLen = (newLines[newRow] || "").length;
            newCol = Math.max(0, Math.min(newCol, finalLineLen > 0 ? finalLineLen -1 : 0));
        }
        return { lines: newLines, cursor: { row: newRow, col: newCol }, commandProcessed: true };
    }
    // Reset pending state if not handled
    window.vimcore.pendingKeystrokes = ""; 
    window.vimcore.activeCount = "";
    window.vimcore.isWaitingForMotionOrTargetChar = false;
    return { lines, cursor, commandProcessed: false }; // Indicate nothing happened for this key yet

  } // End of pendingKeystrokes handling

  // Handle digit input for counts
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

  // Handle keys that START an operator sequence or find command
  if (['d', 'c', 'y', 'f', 'F', 't', 'T'].includes(key)) { 
    window.vimcore.pendingKeystrokes = key;
    window.vimcore.isWaitingForMotionOrTargetChar = true; // Set flag
    // activeCount should persist.
    return { lines: newLines, cursor, commandProcessed: false }; 
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

        if (c < currentWordLineText.length && !/\s/.test(currentWordLineText[c])) {
            while (c < currentWordLineText.length && !/\s/.test(currentWordLineText[c])) {
                c++;
            }
        }

        let wordFound = false;
        while (!wordFound) {
            if (c < currentWordLineText.length) {
                if (/\s/.test(currentWordLineText[c])) {
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

        if (c > 0 && (/\s/.test(currentWordLineText[c]) || (c > 0 && /\s/.test(currentWordLineText[c-1])) ) ) {
            c--;
        }
        else if (c === 0 && r > 0 && ( (currentWordLineText.length === 0) || (currentWordLineText.length > 0 && /\s/.test(currentWordLineText[0])) ) ) {
        } else if (c > 0 && !/\s/.test(currentWordLineText[c]) && /\s/.test(currentWordLineText[c-1]) ){
            c--; 
        }

        let wordFound = false;
        while (!wordFound) {
            if (c >= 0 && c < currentWordLineText.length) {
                if (/\s/.test(currentWordLineText[c])) {
                    c--; 
                    if (c < 0) { 
                    }
                } else {
                    while (c >= 0 && !/\s/.test(currentWordLineText[c])) {
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

        if (c < line.length && /\s/.test(line[c])) { 
            findNextWordEnd = true;
        } else if (c < line.length) { 
            let atEndOfCurrentWord = true;
            if (c < line.length - 1 && !/\s/.test(line[c+1])) {
                atEndOfCurrentWord = false; 
            }
            if (atEndOfCurrentWord) {
                findNextWordEnd = true; 
            }
        } else { 
            findNextWordEnd = true;
        }

        if (!findNextWordEnd) {
            while (c < line.length - 1 && !/\s/.test(line[c+1])) {
                c++;
            }
            tempCol = c;
            tempRow = r;
        } else {
            if (c < line.length && !/\s/.test(line[c])) { 
                while (c < line.length && !/\s/.test(line[c])) {
                    c++;
                }
            } 
            
            let advancedToNextWordRegion = false;
            while(!advancedToNextWordRegion){
                if(c < line.length){
                    if(/\s/.test(line[c])){
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
                    while (c < line.length - 1 && !/\s/.test(line[c+1])) {
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
      case '{': {
        commandExecuted = true;
        let r = tempRow;
        // Find the first non-blank line when moving upwards from current line
        // If current line is blank, move up until a non-blank line is found (start of current/prev paragraph)
        // Then, move up again until a blank line is found (end of prev-prev paragraph)
        // Then, move up again until a non-blank line is found (start of prev paragraph)

        // First, skip any blank lines upwards from current position to find end of current/previous paragraph
        while (r > 0 && isLineBlank(newLines[r])) {
          r--;
        }
        // Now r is on a non-blank line (or r is 0).
        // If we started on a blank line, r is now at the end of the previous paragraph.
        // If we started on a non-blank line, r is still on the current line.

        // Skip the current paragraph (non-blank lines) upwards
        while (r > 0 && !isLineBlank(newLines[r])) {
          r--;
        }
        // Now r is on a blank line separating paragraphs, or r is 0 if at start of file.
        // If r is 0 and it's not blank, it means the first paragraph starts at line 0.
        
        // If r is 0 and newLines[0] is not blank, we are already at the target.
        if (r === 0 && !isLineBlank(newLines[0])) {
            // do nothing, already at the first paragraph
        } else {
            // Skip any further blank lines upwards to find the start of the desired paragraph
            while (r > 0 && isLineBlank(newLines[r])) {
              r--;
            }
        }
        
        // After the loops, r should be at the start of the previous paragraph or line 0.
        tempRow = r;
        tempCol = 0;
        if (tempRow < 0) tempRow = 0; // Should not happen with r > 0 checks but as safeguard

        // If after all, we are still on a blank line and not at the top, try to find the previous non-blank.
        // This handles cases where a count might try to go past the beginning into multiple blank lines.
        while(tempRow > 0 && isLineBlank(newLines[tempRow])) {
            tempRow--;
        }
        tempCol = 0;
        break;
      }
      case '}': {
        commandExecuted = true;
        let r = tempRow;

        // Skip current paragraph (non-blank lines) downwards
        while (r < newLines.length - 1 && !isLineBlank(newLines[r])) {
            r++;
        }
        // Now r is on a blank line or at the end of the file.

        // Skip blank lines downwards to find the start of the next paragraph
        while (r < newLines.length - 1 && isLineBlank(newLines[r])) {
            r++;
        }
        // Now r is on a non-blank line (start of next paragraph) or at the end of the file.

        // If r is at the end and the last line is blank, we might need to adjust
        // or if we are on a blank line but there are no more non-blank lines.
        if (r === newLines.length - 1 && isLineBlank(newLines[r])) {
            // If we scanned to the very last line and it's blank,
            // we should try to find the last non-blank line upwards if the intention
            // was to go to the "start" of a paragraph that might have trailing blanks.
            // However, Vim's '}' typically goes to the *next* paragraph start.
            // If the last line is blank, there's no "next" paragraph start *on or after* it.
            // Vim would stay on the last line if it's the only line or last non-blank.
            // Let's try to find the start of the *current* paragraph if `r` is blank
            // or the last non-blank line if all else fails.

            let originalR = tempRow;
            let lastNonBlankR = originalR;
            for(let k = newLines.length -1; k >=0; k--){
                if(!isLineBlank(newLines[k])){
                    lastNonBlankR = k;
                    break;
                }
            }
             // If current tempRow was already on/after the last actual content,
             // and we are trying to go further down, but only blanks are left,
             // Vim behaviour for `}` often stays on the last non-blank line if no *next* paragraph.
             // Or, if the buffer ends with blank lines, `}` might go to the very last line.
             // For now, let's make it so if `r` ends up blank, it goes to that blank line.
             // If it was already the last line, it stays.
        }


        tempRow = r;
        tempCol = 0;
        if (tempRow >= newLines.length) tempRow = newLines.length - 1;


        // If after all, we are still on a blank line and not at the bottom, try to find the next non-blank.
        // This handles cases where a count might try to go past the end into multiple blank lines.
         while(tempRow < newLines.length -1 && isLineBlank(newLines[tempRow])) {
            tempRow++;
        }
        tempCol = 0;

        break;
      }
      case '%': {
        commandExecuted = true;
        let r = tempRow;
        let c = tempCol;
        const charUnderCursor = newLines[r] ? newLines[r][c] : null;
        let openChar = null, closeChar = null;
        let searchForward = true;

        const pairs = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', };

        if (pairs[charUnderCursor]) {
            openChar = (charUnderCursor === '(' || charUnderCursor === '[' || charUnderCursor === '{') ? charUnderCursor : pairs[charUnderCursor];
            closeChar = pairs[openChar];
            searchForward = (charUnderCursor === openChar);
        } else {
            // Search for the next parenthesis on the line if not on one
            let foundParen = false;
            for (let scanCol = c; scanCol < (newLines[r] ? newLines[r].length : 0); scanCol++) {
                if (pairs[newLines[r][scanCol]]) {
                    c = scanCol;
                    openChar = (newLines[r][scanCol] === '(' || newLines[r][scanCol] === '[' || newLines[r][scanCol] === '{') ? newLines[r][scanCol] : pairs[newLines[r][scanCol]];
                    closeChar = pairs[openChar];
                    searchForward = (newLines[r][scanCol] === openChar);
                    foundParen = true;
                    break;
                }
            }
            if (!foundParen) {
                commandExecuted = false; // No parenthesis found on the line
                break;
            }
        }

        let balance = 0;
        if (searchForward) {
            let currentR = r;
            let currentC = c;
            let eof = false;
            while (!eof) {
                const lineToSearch = newLines[currentR] || "";
                for (let scanC = (currentR === r ? currentC : 0) ; scanC < lineToSearch.length; scanC++) {
                    if (lineToSearch[scanC] === openChar) {
                        balance++;
                    } else if (lineToSearch[scanC] === closeChar) {
                        balance--;
                        if (balance === 0) {
                            tempRow = currentR;
                            tempCol = scanC;
                            eof = true; // Found match
                            break;
                        }
                    }
                }
                if (eof) break;
                currentR++;
                if (currentR >= newLines.length) {
                    commandExecuted = false; // No match found by end of file
                    eof = true;
                }
            }
        } else { // Search backward
            let currentR = r;
            let currentC = c;
            let bof = false; // beginning of file
            while (!bof) {
                const lineToSearch = newLines[currentR] || "";
                for (let scanC = (currentR === r ? currentC : lineToSearch.length - 1) ; scanC >= 0; scanC--) {
                    if (lineToSearch[scanC] === closeChar) { // when searching backward, original char is closeChar
                        balance++;
                    } else if (lineToSearch[scanC] === openChar) {
                        balance--;
                        if (balance === 0) {
                            tempRow = currentR;
                            tempCol = scanC;
                            bof = true; // Found match
                            break;
                        }
                    }
                }
                if (bof) break;
                currentR--;
                if (currentR < 0) {
                    commandExecuted = false; // No match found by beginning of file
                    bof = true;
                }
            }
        }
        break;
      }
      case 'g': // Special handling for 'g' might be needed if 'gg' is not passed as a single key
        // For now, 'g' alone does nothing unless 'gg' logic is elsewhere or passed as 'gg'
        // If 'gg' is handled by main.js sending "gg", this case might not be hit for that.
        commandExecuted = false; // 'g' alone does nothing unless part of 'gg'
        break;
      case ';': {
        if (window.vimcore.lastFindCommand) {
            const { type, char, count: findCount, forwardForSemicolon } = window.vimcore.lastFindCommand;
            // For ';' use forwardForSemicolon directly
            const findForward = forwardForSemicolon;
            let found = false;
            let currentR = newRow; // Use newRow/newCol from current state
            let currentC = newCol;
            const lineText = newLines[currentR] || "";

            for (let k = 0; k < findCount; k++) { // lastFindCommand.count is usually 1
                let searchStartCol = findForward ? currentC + 1 : currentC - 1;
                let tempFoundC = -1;

                if (findForward) {
                    for (let cScan = searchStartCol; cScan < lineText.length; cScan++) {
                        if (lineText[cScan] === char) {
                            tempFoundC = cScan;
                            break;
                        }
                    }
                } else { // search backward
                    for (let cScan = searchStartCol; cScan >= 0; cScan--) {
                        if (lineText[cScan] === char) {
                            tempFoundC = cScan;
                            break;
                        }
                    }
                }
                if (tempFoundC !== -1) {
                    currentC = tempFoundC;
                    found = true;
                } else {
                    found = false;
                    break;
                }
            }
            if (found) {
                newCol = currentC; // newRow doesn't change for f/F/;/
                commandExecuted = true;
                // lastFindCommand remains the same for subsequent ; or ,
            } else {
                commandExecuted = false;
            }
        } else {
            commandExecuted = false; // No last find command to repeat
        }
        break;
      }
      case ',': {
        if (window.vimcore.lastFindCommand) {
            const { type, char, count: findCount, forwardForSemicolon } = window.vimcore.lastFindCommand;
            // For ',' use INVERSE of forwardForSemicolon
            const findForward = !forwardForSemicolon;
            let found = false;
            let currentR = newRow;
            let currentC = newCol;
            const lineText = newLines[currentR] || "";

            for (let k = 0; k < findCount; k++) {
                let searchStartCol = findForward ? currentC + 1 : currentC - 1;
                let tempFoundC = -1;

                if (findForward) {
                    for (let cScan = searchStartCol; cScan < lineText.length; cScan++) {
                        if (lineText[cScan] === char) {
                            tempFoundC = cScan;
                            break;
                        }
                    }
                } else { // search backward
                    for (let cScan = searchStartCol; cScan >= 0; cScan--) {
                        if (lineText[cScan] === char) {
                            tempFoundC = cScan;
                            break;
                        }
                    }
                }
                if (tempFoundC !== -1) {
                    currentC = tempFoundC;
                    found = true;
                } else {
                    found = false;
                    break;
                }
            }
            if (found) {
                newCol = currentC;
                commandExecuted = true;
            } else {
                commandExecuted = false;
            }
        } else {
            commandExecuted = false;
        }
        break;
      }
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
    window.vimcore.isWaitingForMotionOrTargetChar = false; // Should be cleared when pendingKeystrokes is cleared
  } else {
    if (! (key >= '0' && key <= '9') ) { 
        if (!['d', 'c', 'y', 'f', 'F', 't', 'T'].includes(key)) { // if not a pending starter key
             window.vimcore.activeCount = ""; 
             // window.vimcore.isWaitingForMotionOrTargetChar = false; // only if it was an unknown key that didn't start a sequence
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