import BaseMigrationScript from "../base-migration-script.js";

// Map of the image moves, old: new
const IMG_MAP = {
  "systems/cyberpunk-red-core/icons/compendium/ammo/bow_biotoxin.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/bow_biotoxin.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/bow_expansive.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/bow_expansive.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/bow_incendiary.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/bow_incendiary.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/bow_poison.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/bow_poison.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/bow_rubber.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/bow_rubber.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/bow_sleep.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/bow_sleep.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/bow_smart.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/bow_smart.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/grenade_armorpiercing.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/grenade_armorpiercing.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/grenade_biotoxin.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/grenade_biotoxin.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/grenade_emp.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/grenade_emp.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/grenade_flashbang.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/grenade_flashbang.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/grenade_incendiary.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/grenade_incendiary.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/grenade_poison.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/grenade_poison.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/grenade_sleep.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/grenade_sleep.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/grenade_smoke.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/grenade_smoke.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/grenade_teargas.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/grenade_teargas.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/paintball_acid.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/paintball_acid.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/paintball_basic.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/paintball_basic.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/pistolheavy_armorpiercing.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/pistolheavy_armorpiercing.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/pistolheavy_basic.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/pistolheavy_basic.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/pistolheavy_expansive.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/pistolheavy_expansive.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/pistolheavy_incendiary.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/pistolheavy_incendiary.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/pistolheavy_rubber.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/pistolheavy_rubber.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/pistolheavy_smart.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/pistolheavy_smart.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/pistolmedium_armorpiercing.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/pistolmedium_armorpiercing.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/pistolmedium_basic.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/pistolmedium_basic.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/pistolmedium_expansive.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/pistolmedium_expansive.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/pistolmedium_incendiary.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/pistolmedium_incendiary.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/pistolmedium_rubber.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/pistolmedium_rubber.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/pistolmedium_smart.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/pistolmedium_smart.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/pistolveryheavy_armorpiercing.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/pistolveryheavy_armorpiercing.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/pistolveryheavy_basic.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/pistolveryheavy_basic.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/pistolveryheavy_expansive.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/pistolveryheavy_expansive.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/pistolveryheavy_incendiary.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/pistolveryheavy_incendiary.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/pistolveryheavy_rubber.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/pistolveryheavy_rubber.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/pistolveryheavy_smart.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/pistolveryheavy_smart.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/rifle_armorpiercing.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/rifle_armorpiercing.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/rifle_basic.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/rifle_basic.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/rifle_expansive.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/rifle_expansive.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/rifle_incendiary.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/rifle_incendiary.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/rifle_rubber.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/rifle_rubber.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/rifle_smart.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/rifle_smart.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/rocket_armorpiercing.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/rocket_armorpiercing.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/rocket_smart.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/rocket_smart.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/shotgun_shell_basic.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/shotgun_shell_basic.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/shotgun_shell_incendiary.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/shotgun_shell_incendiary.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/shotgun_slug_armorpiercing.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/shotgun_slug_armorpiercing.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/shotgun_slug_basic.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/shotgun_slug_basic.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/shotgun_slug_expansive.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/shotgun_slug_expansive.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/shotgun_slug_incendiary.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/shotgun_slug_incendiary.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/shotgun_slug_rubber.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/shotgun_slug_rubber.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/shotgun_slug_smart.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/shotgun_slug_smart.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/battery.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/battery.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/bow_armorpiercing.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/bow_armorpiercing.svg",
  "systems/cyberpunk-red-core/icons/compendium/ammo/bow_basic.png":
    "systems/cyberpunk-red-core/icons/compendium/ammo/bow_basic.svg",
  // include black-chrome compendium items
  "modules/cyberpunk-red-dlc/icons/black-chrome/ammo/capsule_tied.png":
    "modules/cyberpunk-red-dlc/icons/black-chrome/ammo/cannister_net.svg",
  "modules/cyberpunk-red-dlc/icons/black-chrome/ammo/grenade_tied.png":
    "modules/cyberpunk-red-dlc/icons/black-chrome/ammo/grenade_arachnid.svg",
  "modules/cyberpunk-red-dlc/icons/black-chrome/ammo/paintball_tracking.png":
    "modules/cyberpunk-red-dlc/icons/black-chrome/ammo/doberman500_markingscent.svg",
  // include dlc compendium items
  "modules/cyberpunk-red-dlc/icons/dlc/ammo/bow_junk.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/bow_junk.svg",
  "modules/cyberpunk-red-dlc/icons/dlc/ammo/paintball_biotoxin.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/paintball_biotoxin.svg",
  "modules/cyberpunk-red-dlc/icons/dlc/ammo/paintball_poison.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/paintball_poison.svg",
  "modules/cyberpunk-red-dlc/icons/dlc/ammo/pistolheavy_junk.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/pistolheavy_junk.svg",
  "modules/cyberpunk-red-dlc/icons/dlc/ammo/pistolheavy_small.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/pistolheavy_small.svg",
  "modules/cyberpunk-red-dlc/icons/dlc/ammo/pistolmedium_junk.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/pistolmedium_junk.svg",
  "modules/cyberpunk-red-dlc/icons/dlc/ammo/pistolmedium_small.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/pistolmedium_small.svg",
  "modules/cyberpunk-red-dlc/icons/dlc/ammo/pistolveryheavy_junk.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/pistolveryheavy_junk.svg",
  "modules/cyberpunk-red-dlc/icons/dlc/ammo/pistolveryheavy_small.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/pistolveryheavy_small.svg",
  "modules/cyberpunk-red-dlc/icons/dlc/ammo/rifle_junk.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/rifle_junk.svg",
  "modules/cyberpunk-red-dlc/icons/dlc/ammo/rifle_small.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/rifle_small.svg",
  "modules/cyberpunk-red-dlc/icons/dlc/ammo/shotgun_slug_junk.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/shotgun_slug_junk.svg",
};

export default class AmmoIconConversion extends BaseMigrationScript {
  static version = 40;

  static name = "Item: Convert Ammo Icons from '.png' to '.svg'";

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
