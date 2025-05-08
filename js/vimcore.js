// VimCore: základná simulácia Vim príkazov pre VimGame
window.vimcore = {
  processInput,
  checkGoal,
  getLinesFromXterm,
  setCursorInXterm
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
 * @returns {{lines: string[], cursor: {row: number, col: number}}} Nový stav.
 */
function processInput(key, lines, cursor) {
  let { row, col } = cursor;
  const newLines = lines.map(line => line); // Kópia poľa, riadky sú stringy, takže sú tiež kópie pri modifikácii

  if (newLines.length === 0 && key !== 'i' && key !== 'a' && key !== 'o' && key !== 'O') { // Prázdny editor, len insert príkazy môžu niečo spraviť
    return { lines: [], cursor: { row: 0, col: 0 } };
  }
  if (newLines.length === 0 && (key === 'i' || key === 'a' || key === 'o' || key === 'O')){
    // TODO: Handle insert modes on empty buffer
    // For 'o' or 'O', add a new line and switch to insert mode
    // For 'i' or 'a', prepare for insert at {0,0}
    return { lines: [''], cursor: { row: 0, col: 0 } }; // Placeholder
  }
  
  row = Math.max(0, Math.min(row, newLines.length - 1));
  let currentLine = newLines[row] || ''; // Ak by riadok neexistoval (napr. kurzor je za posledným riadkom)
  let currentLineLength = currentLine.length;
  col = Math.max(0, Math.min(col, currentLineLength > 0 ? currentLineLength -1 : 0)); // Kurzor nemôže byť za posledným znakom pre operácie ako 'x'
                                                                                  // Výnimka: pre '$' môže byť na pozícii length, ale 'x' potrebuje existujúci znak.
  
  let newRow = row;
  let newCol = col;

  switch (key) {
    case 'h':
      newCol = Math.max(0, col - 1);
      break;
    case 'l':
      // Ak je riadok prázdny, 'l' nespraví nič
      if (currentLineLength > 0) {
        newCol = Math.min(currentLineLength - 1, col + 1);
      }
      break;
    case 'k':
      newRow = Math.max(0, row - 1);
      const prevLineLengthK = (newLines[newRow] || '').length;
      newCol = Math.min(col, prevLineLengthK > 0 ? prevLineLengthK - 1 : 0);
      break;
    case 'j':
      newRow = Math.min(newLines.length - 1, row + 1);
      const nextLineLengthJ = (newLines[newRow] || '').length;
      newCol = Math.min(col, nextLineLengthJ > 0 ? nextLineLengthJ - 1 : 0);
      break;
    case '0':
      newCol = 0;
      break;
    case '$':
      newCol = currentLineLength > 0 ? currentLineLength - 1 : 0;
      break;
    case 'x':
      if (currentLineLength > 0 && col < currentLineLength) { // Musí byť znak na pozícii col
        newLines[row] = currentLine.substring(0, col) + currentLine.substring(col + 1);
        // Kurzor zostane na tej istej pozícii, ak tam ešte existuje znak
        // Ak bol vymazaný posledný znak, kurzor sa posunie doľava
        const newLineLengthX = newLines[row].length;
        newCol = Math.min(col, newLineLengthX > 0 ? newLineLengthX - 1 : 0);
      } // Ak je riadok prázdny alebo kurzor za koncom, 'x' nespraví nič
      break;
    // TODO: ďalšie príkazy
  }
  
  // Ak po operácii ukazuje newCol na neexistujúcu pozíciu (napr. riadok sa skrátil)
  // alebo ak je riadok prázdny, nastav stĺpec na 0.
  const finalLineLength = (newLines[newRow] || '').length;
  if (newCol >= finalLineLength && finalLineLength > 0) {
      newCol = finalLineLength - 1;
  }
  if (finalLineLength === 0) {
      newCol = 0;
  }

  return { lines: newLines, cursor: { row: newRow, col: newCol } };
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