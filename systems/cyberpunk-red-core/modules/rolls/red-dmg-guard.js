/*
 * Pure, Foundry-free detection of the `red`+`dmg` mutual-exclusion violation in a raw chat message.
 *
 * `red` (the check-die crit) and `dmg` (the damage marker) can never share one roll: `dmg` never
 * explodes/implodes and a die cannot be both a check die and a damage die. The programmatic roll paths
 * enforce this via CPRRoll.assertRedDmgExclusive, and item Damage fields are sanitised on save — but a
 * raw `/r` chat formula builds a native Foundry roll that reaches neither. The chat hook
 * (hooks/chat/enforce-red-dmg-exclusive.js) uses these helpers to refuse such a manual roll too, so the
 * rule holds on every path. Kept dependency-free so it is unit-testable in bare Node.
 */

// The chat roll commands whose argument is a single roll formula.
const ROLL_COMMAND = /^\/(?:r|roll|gmroll|blindroll|selfroll|publicroll)\b\s*/i;
// An inline roll: the formula between `[[` and `]]`.
const INLINE_ROLL = /\[\[(.+?)\]\]/g;

/**
 * True when a single roll formula carries both `red` and `dmg` (mutually exclusive within one roll).
 *
 * @param {string} formula
 * @returns {boolean}
 */
export function formulaHasRedAndDmg(formula) {
  const str = String(formula);
  return /red/i.test(str) && /dmg/i.test(str);
}

/**
 * Extract the individual roll formulas a chat message would evaluate: a leading roll command's formula
 * (with any `#flavor` trailer removed) and every inline `[[…]]` roll. Plain prose — even prose that
 * happens to contain the words — yields none, so nothing but an actual roll is ever inspected.
 *
 * @param {string} message - the raw chat message text
 * @returns {string[]} one formula per roll the message would evaluate (possibly empty)
 */
export function messageRollFormulas(message) {
  const str = String(message).trim();
  const formulas = [];
  const command = str.match(ROLL_COMMAND);
  if (command) formulas.push(str.slice(command[0].length).split("#")[0]);
  INLINE_ROLL.lastIndex = 0;
  let match = INLINE_ROLL.exec(str);
  while (match) {
    formulas.push(match[1]);
    match = INLINE_ROLL.exec(str);
  }
  return formulas;
}

/**
 * True when any roll a chat message would evaluate carries both `red` and `dmg`. Two *separate* rolls in
 * one message (`[[1d10red]] and [[2d6dmg]]`) are each valid on their own, so they do NOT trip this.
 *
 * @param {string} message - the raw chat message text
 * @returns {boolean}
 */
export function messageHasRedDmgViolation(message) {
  return messageRollFormulas(message).some(formulaHasRedAndDmg);
}

export default messageHasRedDmgViolation;
