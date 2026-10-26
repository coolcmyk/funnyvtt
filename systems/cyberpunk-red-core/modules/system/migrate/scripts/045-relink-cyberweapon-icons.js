import BaseMigrationScript from "../base-migration-script.js";

// Map of the image moves, old: new
const IMG_MAP = {
  "systems/cyberpunk-red-core/icons/compendium/cyberweapons/big_knucks.svg":
    "systems/cyberpunk-red-core/icons/compendium/cyberware/big_knucks.svg",
  "systems/cyberpunk-red-core/icons/compendium/cyberweapons/cybersnake.svg":
    "systems/cyberpunk-red-core/icons/compendium/cyberware/cybersnake.svg",
  "systems/cyberpunk-red-core/icons/compendium/cyberweapons/rippers.svg":
    "systems/cyberpunk-red-core/icons/compendium/cyberware/rippers.svg",
  "systems/cyberpunk-red-core/icons/compendium/cyberweapons/scratchers.svg":
    "systems/cyberpunk-red-core/icons/compendium/cyberware/scratchers.svg",
  "systems/cyberpunk-red-core/icons/compendium/cyberweapons/slice_n_dice.svg":
    "systems/cyberpunk-red-core/icons/compendium/cyberware/slice_n_dice.svg",
  "systems/cyberpunk-red-core/icons/compendium/cyberweapons/talon_foot.svg":
    "systems/cyberpunk-red-core/icons/compendium/cyberware/talon_foot.svg",
  "systems/cyberpunk-red-core/icons/compendium/cyberweapons/vampyres.svg":
    "systems/cyberpunk-red-core/icons/compendium/cyberware/vampyres.svg",
  "systems/cyberpunk-red-core/icons/compendium/cyberweapons/wolvers.svg":
    "systems/cyberpunk-red-core/icons/compendium/cyberware/wolvers.svg",
};

export default class RelinkCyberwareIcons extends BaseMigrationScript {
  static version = 45;

  static name = "Item: Re-link Cyberweapon Icons";

  static documentFilters = {
    Item: { types: [], mixins: [] },
  };

  /*
   * Migrations
   */

  async updateItem(doc) {
    const { img } = doc;
    if (IMG_MAP[img]) {
      doc.img = IMG_MAP[img];
    }
  }
}
