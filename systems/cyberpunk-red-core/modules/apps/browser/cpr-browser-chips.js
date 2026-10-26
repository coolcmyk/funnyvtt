import { buildItemChips } from "../../item/item-chips.js";

/**
 * Build the ordered list of stat chips for a browser result card. Thin
 * wrapper around the shared, neutral `buildItemChips` (also used by the item
 * sheet header) — the browser's index entry already has the `{type, system}`
 * shape that function expects.
 *
 * @param {object} entry - a normalized browser index entry
 * @returns {Array<string>} the chip labels in display order (may be empty)
 */
export default function browserStatChips(entry) {
  return buildItemChips(entry);
}
