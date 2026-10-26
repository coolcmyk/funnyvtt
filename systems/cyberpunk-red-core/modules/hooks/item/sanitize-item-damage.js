import SystemUtils from "../../utils/cpr-systemUtils.js";
import { sanitizeDamageFormula } from "../../rolls/sanitize-damage-formula.js";

/*
 * A damage formula's critical face/count, armor ablation and critical bonus are configured on the item
 * itself — the roll layer appends the matching `dmg`/`ab`/`cd`/`red` markers when it builds the damage
 * roll (see CPRDamageRoll). Typing those markers into a damage field would double them up (or, for
 * `red`, conflict with the auto-appended `dmg`), so this hook sanitises them out before the update is
 * written (rather than trying to detect at roll time where a roll originated). Every other modifier a
 * user might enter (`kh2`, `+2`, `@stats.body`, …) is preserved: `3d6kh2dmg5ab0cd10` saves as `3d6kh2`.
 *
 * Two item shapes carry a user-editable damage formula, each at its own field:
 *   - attackable items (weapons, attackable cyberware, item upgrades) → `system.damage`
 *   - ammo (whose override can replace a weapon's damage)             → `system.overrides.damage.value`
 */

/**
 * The update path whose value is a damage formula for this item, or null if the item has none.
 *
 * @param {CPRItem} item
 * @returns {string|null}
 */
function damageFieldFor(item) {
  if (SystemUtils.hasMixin(item.type, "attackable")) return "system.damage";
  if (item.type === "ammo") return "system.overrides.damage.value";
  return null;
}

const SanitizeItemDamage = () => {
  Hooks.on("preUpdateItem", (item, changes, options) => {
    const field = damageFieldFor(item);
    if (!field) return;

    // The sheet submits nested (`{system:{damage}}`); a programmatic update may pass a flat, dotted key.
    // getProperty resolves the nested shape; the bracket lookup catches the literal-key shape. Handle both.
    const nested = foundry.utils.getProperty(changes, field);
    const isNested = typeof nested === "string";
    const entered = isNested ? nested : changes[field];
    if (typeof entered !== "string") return;

    const { cleaned, removed } = sanitizeDamageFormula(entered);
    if (cleaned === entered) return;

    if (isNested) foundry.utils.setProperty(changes, field, cleaned);
    else changes[field] = cleaned;

    // The cleaned value often equals what's already stored — e.g. the user appended `red` to an
    // already-clean formula — which makes this a no-op update that Foundry skips, so the sheet never
    // re-renders and the raw text lingers in the field until it is reopened. Force the write so the
    // update (and the sheet re-render that follows it) always happens and the field shows the
    // sanitised value. See also the migration runner, which uses `diff: false` for the same reason.
    options.diff = false;

    globalThis.ui?.notifications?.warn(
      game.i18n.format("CPR.rolls.modifiers.damageMarkersStripped", {
        removed: removed.join("/"),
        cleaned,
      }),
    );
  });
};

export default SanitizeItemDamage;
