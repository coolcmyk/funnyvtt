import BaseMigrationScript from "../base-migration-script.js";

/**
 * For weapon items that were created on the actor sheet and have no weaponSkill,
 * set the weapon skill to "Handgun".
 */
export default class SetActorSheetCreatedWeaponSkill extends BaseMigrationScript {
  static version = 35;

  static name = "Item: Created Weapon `weaponSkill` Configuration";

  static documentFilters = {
    Item: { types: [], mixins: ["attackable"] },
    Actor: { types: [], mixins: [] },
  };

  async updateItem(doc) {
    if (doc.system.weaponSkill === undefined) {
      doc.system.weaponSkill = "Handgun";
    }
  }
}
