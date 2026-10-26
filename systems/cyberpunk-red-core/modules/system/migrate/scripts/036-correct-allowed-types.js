import BaseMigrationScript from "../base-migration-script.js";

/**
 * For cyberware items with an incorrectly set 'programs' in `allowedTypes`,
 * remove 'programs' and add 'program'.
 */
export default class ReplaceProgramsWithProgram extends BaseMigrationScript {
  static version = 36;

  static name = "Cyberware: change `allowedTypes` 'programs' to 'program'";

  static documentFilters = {
    Item: { types: [], mixins: ["container"] },
    Actor: { types: [], mixins: ["container"] },
  };

  async updateActor(doc) {
    if (doc.system?.installedItems?.allowedTypes.includes("programs")) {
      const newAllowedTypes = [
        "program",
        doc.system?.installedItems?.allowedTypes.filter(
          (t) => t !== "programs",
        ),
      ];
      doc.system.installedItems.allowedTypes = newAllowedTypes;
    }
  }

  async updateItem(doc) {
    if (doc.system?.installedItems?.allowedTypes.includes("programs")) {
      const newAllowedTypes = [
        "program",
        doc.system?.installedItems?.allowedTypes.filter(
          (t) => t !== "programs",
        ),
      ];
      doc.system.installedItems.allowedTypes = newAllowedTypes;
    }
  }
}
