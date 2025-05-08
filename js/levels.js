// Basic levels for VimGame
window.VIM_LEVELS = [
  {
    id: 1,
    title: "Move to Line Start",
    description: "Move the cursor to the <strong>start</strong> of the current line.",
    startTextFile: "levels/level1_start.txt",
    goalTextFile: "levels/level1_goal.txt",
    verify: "cursor_at_start",
    allowedCommands: ["0", "h", "l"],
    startCursor: { row: 0, col: 9 },
    hint: "Use the <kbd>0</kbd> key to jump to the start of the line."
  },
  {
    id: 2,
    title: "Move to Line End",
    description: "Move the cursor to the <strong>end</strong> of the current line.",
    startTextFile: "levels/level2_start.txt",
    goalTextFile: "levels/level2_goal.txt",
    verify: "cursor_at_end",
    allowedCommands: ["$", "h", "l"],
    startCursor: { row: 0, col: 6 },
    hint: "Use the <kbd>$</kbd> key to jump to the end of the line."
  },
  {
    id: 3,
    title: "Move Up/Down",
    description: "Move the cursor to the line containing \"Second line\".",
    startTextFile: "levels/level3_multiline_start.txt",
    goalTextFile: "levels/level3_multiline_start.txt",
    verify: "cursor_at_pos",
    goalCursor: { row: 1, col: 0 },
    allowedCommands: ["j", "k", "h", "l", "0", "$"],
    startCursor: { row: 0, col: 0 },
    hint: "Use <kbd>j</kbd> to move down a line and <kbd>k</kbd> to move up."
  },
  {
    id: 4,
    title: "Delete Character (x)",
    description: "Delete the letter 'X' from the word \"teXt\". The cursor starts on 'X'.",
    startTextFile: "levels/level4_delete_char_start.txt",
    goalTextFile: "levels/level4_delete_char_goal.txt",
    verify: "text_equals",
    allowedCommands: ["x", "h", "l"],
    startCursor: { row: 0, col: 2 },
    hint: "Place the cursor on the character you want to delete and press <kbd>x</kbd>."
  }
  // ... ďalšie levely
];

// Funkcia na načítanie levelov (prípadne asynchrónne v budúcnosti)
window.getVimLevels = function() {
  return window.VIM_LEVELS;
}; 