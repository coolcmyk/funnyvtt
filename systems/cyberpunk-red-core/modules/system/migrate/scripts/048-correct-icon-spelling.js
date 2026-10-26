import BaseMigrationScript from "../base-migration-script.js";

/**
 * Corrects icon spelling for existing world items.
 */
export default class CorrectIconSpelling extends BaseMigrationScript {
  static version = 48;

  static name = "Correct icon spelling to match item name";

  static documentFilters = {
    Item: { types: [], mixins: [] },
    Actor: { types: [], mixins: [] },
  };

  async updateItem(doc) {
    if (
      doc.img ===
      `systems/cyberpunk-red-core/icons/compendium/cyberware/tactile_boot.svg`
    ) {
      doc.img = `systems/cyberpunk-red-core/icons/compendium/cyberware/tactile_boost.svg`;
    }
    if (
      doc.img ===
      `systems/cyberpunk-red-core/icons/compendium/gear/chemical_analizer.svg`
    ) {
      doc.img = `systems/cyberpunk-red-core/icons/compendium/gear/chemical_analyzer.svg`;
    }
  }
}
