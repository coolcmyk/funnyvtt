import BaseMigrationScript from "../base-migration-script.js";

/**
 * Hide the "Achievements & Loot Boxes" gear items from the document browser by
 * setting their `ignoredByBrowser` flag (added to the common item schema in this
 * version). The boxes are identified by their (source/English) names.
 */
export default class IgnoredByBrowserLootBoxes extends BaseMigrationScript {
  static version = 43;

  static name = "Item: ignore loot boxes in browser";

  static documentFilters = {
    Item: { types: ["gear"], mixins: [] },
    Actor: { types: [], mixins: [] },
  };

  /** The Achievements & Loot Boxes gear items to hide from the browser. */
  static LOOT_BOX_NAMES = [
    "A Box Bound Tightly in Rope",
    "A Box Covered in Chipped Paint",
    "A Box Dripping Wet With Fluid",
    "A Box Freezing Cold To The Touch",
    "A Box Handsomely Gift Wrapped",
    "A Box Marked With A Lime Green X",
    "A Box Melted Out Of Shape",
    "A Box Reeking Of Oil",
    "A Box Sealed With A Lipstick Kiss",
    "A Box Showing Signs Of Repair",
  ];

  /** @inheritdoc */
  async updateItem(doc) {
    // Match the source (English) name, not the displayed one: in a Babele-
    // translated world `doc.name` is the translated name, while Babele preserves
    // the original on `flags.babele.originalName`. Falling back to `doc.name`
    // covers untranslated worlds and locales that don't translate these names.
    const sourceName = doc.flags?.babele?.originalName ?? doc.name;
    if (this.constructor.LOOT_BOX_NAMES.includes(sourceName)) {
      doc.system.ignoredByBrowser = true;
    }
  }
}
