import BaseMigrationScript from "../base-migration-script.js";

/**
 * Applies new unique role icons to existing role items.
 */
export default class UpdateRoleIcons extends BaseMigrationScript {
  static version = 47;

  static name = "Update icons to match Role";

  static documentFilters = {
    Item: { types: ["role"], mixins: [] },
    Actor: { types: [], mixins: [] },
  };

  async updateItem(doc) {
    const oldImage =
      "systems/cyberpunk-red-core/icons/compendium/default/Default_Role.svg";
    if (doc.type === "role" && doc.img === oldImage) {
      if (doc.name === "Exec") {
        doc.img = "systems/cyberpunk-red-core/icons/compendium/roles/exec.svg";
      } else if (doc.name === "Fixer") {
        doc.img = "systems/cyberpunk-red-core/icons/compendium/roles/fixer.svg";
      } else if (doc.name === "Lawman") {
        doc.img =
          "systems/cyberpunk-red-core/icons/compendium/roles/lawman.svg";
      } else if (doc.name === "Media") {
        doc.img = "systems/cyberpunk-red-core/icons/compendium/roles/media.svg";
      } else if (doc.name === "Medtech") {
        doc.img =
          "systems/cyberpunk-red-core/icons/compendium/roles/medtech.svg";
      } else if (doc.name === "Netrunner") {
        doc.img =
          "systems/cyberpunk-red-core/icons/compendium/roles/netrunner.svg";
      } else if (doc.name === "Nomad") {
        doc.img = "systems/cyberpunk-red-core/icons/compendium/roles/nomad.svg";
      } else if (doc.name === "Rockerboy") {
        doc.img =
          "systems/cyberpunk-red-core/icons/compendium/roles/rockerboy.svg";
      } else if (doc.name === "Solo") {
        doc.img = "systems/cyberpunk-red-core/icons/compendium/roles/solo.svg";
      } else if (doc.name === "Tech") {
        doc.img = "systems/cyberpunk-red-core/icons/compendium/roles/tech.svg";
      }
    }
  }
}
