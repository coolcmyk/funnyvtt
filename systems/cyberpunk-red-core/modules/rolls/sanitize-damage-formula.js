// The CPR damage markers, in the order they should be reported.
const DAMAGE_MARKERS = ["dmg", "ab", "cd", "red"];

/**
 * Sanitise the CPR damage markers — `dmg`, `ab`, `cd`, `red` (with any of their parameters) — out of the
 * modifier tail of every die term in a formula, leaving the dice and all other modifiers intact, and
 * report which markers were actually removed.
 *
 * An attackable item's damage is **always** a damage roll, and its critical face/count, armor ablation
 * and critical bonus come from the item's own settings — the roll layer appends the matching
 * `dmg`/`ab`/`cd` markers itself (see CPRDamageRoll). So these markers must not be typed into an
 * attackable item's **Damage** field; if they are, we sanitise them out here rather than trying to
 * detect where a roll came from. `red` (the check-die crit) is invalid on a damage roll — the roll layer
 * auto-appends `dmg`, and `red`/`dmg` are mutually exclusive — so it is stripped too. Every other
 * modifier is preserved: `3d6kh2dmg5ab0cd10` → `3d6kh2` (the `dmg5ab0cd10` is item‑built).
 *
 * Pure string transform with no Foundry dependency (unit‑testable):
 *   - only the modifier run *directly following a die term* is touched, so flat mods (`+2`), operators,
 *     `@`‑roll‑data references (`@stats.body`) and flavor (`[fire]`) are left untouched;
 *   - `dmg`/`ab`/`cd`/`red` are matched wherever they appear in that run, so fused tokens (`dmgab0`) and
 *     any interleaving with other modifiers (`dmg5kh2`, `kh2dmg5`, `khred`) are handled.
 *
 * @param {string} formula - A roll formula (e.g. an attackable item's `system.damage`).
 * @returns {{cleaned: string, removed: string[]}} The cleaned formula and the distinct markers removed
 *   (a subset of `["dmg","ab","cd","red"]`, in that order). Non‑strings pass through with no removals.
 */
export function sanitizeDamageFormula(formula) {
  if (typeof formula !== "string" || formula === "") {
    return { cleaned: formula, removed: [] };
  }
  // A die term (`3d6`, `d10`) followed by its modifier run — the run stops at whitespace, an operator,
  // or a bracket, so it captures only that die's modifiers.
  const DIE_TERM = /(\d*[dD]\d+)([^\s(){}[\]+\-*/]*)/g;
  // `dmg` (with an optional threshold and comparison), `ab`/`cd` (with an optional value), or `red`
  // (with an optional explode threshold).
  const MARKER = /(?:dmg[0-9]*(?:[<>=]+[0-9]+)?|(?:ab|cd|red)[0-9]*)/gi;
  const seen = new Set();
  const cleaned = formula.replace(DIE_TERM, (whole, core, mods) => {
    if (!mods) return whole;
    const stripped = mods.replace(MARKER, (marker) => {
      seen.add(marker.match(/^[a-z]+/i)[0].toLowerCase());
      return "";
    });
    return core + stripped;
  });
  return { cleaned, removed: DAMAGE_MARKERS.filter((m) => seen.has(m)) };
}

/**
 * Convenience wrapper returning just the cleaned formula. See {@link sanitizeDamageFormula}.
 *
 * @param {string} formula
 * @returns {string}
 */
export function stripDamageMarkers(formula) {
  return sanitizeDamageFormula(formula).cleaned;
}

export default sanitizeDamageFormula;
