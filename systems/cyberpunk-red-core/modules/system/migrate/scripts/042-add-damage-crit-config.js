import BaseMigrationScript from "../base-migration-script.js";

/**
 * Backfill the configurable damage-critical fields introduced alongside the `dmg` die modifier:
 *   - attackable items (weapons) gain `system.damageCrit` { threshold, count, bonus }
 *   - ammo gains `system.overrides.crit` { override, threshold, count, bonus }
 *
 * Most items get RAW defaults (2+ dice at the die's max face → +5 damage), matching the data model
 * initials. Items that RAW says **cannot cause a Critical Injury** are backfilled to never crit
 * (`count: 0`): weapons via `damageCrit.count = 0`; Rubber ammo via `overrides.crit` with
 * `override: true` + `count: 0` so it overrides the loaded weapon. We can't match compendium IDs, so
 * we match on name — including every shipped Babele translation, because Babele rewrites `doc.name`
 * in non-English worlds (see 030-isElectronic for the same approach).
 *
 * The DLC weapons (Sub-Flechette Gun, Burst Flamethrower) live in the cyberpunk-red-dlc module; their
 * *compendium* copies need a migration in that repo (separate task). They are listed here so a copy
 * already in a user's world is migrated.
 */
export default class AddDamageCritConfig extends BaseMigrationScript {
  static version = 42;

  static name = "Item: Add configurable damage-critical fields";

  static documentFilters = {
    Item: { types: ["ammo"], mixins: ["attackable"] },
    Actor: { types: [], mixins: [] },
  };

  /**
   * Names (English + every shipped Babele translation) of weapons that RAW says cannot cause a
   * Critical Injury, backfilled with `damageCrit.count: 0`.
   *
   * @type {string[]}
   */
  static NON_CRIT_WEAPON_NAMES = [
    // Core — Air Pistol
    "Air Pistol",
    "Luftpistole",
    "Pistola de Aire",
    "Pistola de ar",
    "Pistola Pneumatica",
    "Pistolet à air comprimé",
    "Pistolet pneumatyczny",
    "Пневматический пистолет",
    "エアーピストル",
    // Core — Stun Gun
    "Stun Gun",
    "Arma de choque",
    "Betäubungspistole",
    "Cañón Aturdidor",
    "Pistolet à impulsion électrique",
    "Pistolet ogłuszający",
    "Taser",
    "Шокер",
    "スタンガン",
    // Core — Stun Baton
    "Stun Baton",
    "Bastão de Atordoamento",
    "Bastón Aturdidor",
    "Betäubungsstock",
    "Matraque électrique",
    "Pałka ogłuszająca",
    "Storditore",
    "Оглушающая дубинка",
    "スタンバトン",
    // DLC (cyberpunk-red-dlc) — Sub-Flechette Gun
    "Sub-Flechette Gun",
    "Mitrailleuse à fléchettes",
    // DLC (cyberpunk-red-dlc) — Burst Flamethrower
    "Burst Flamethrower",
    "Lance-flammes à rafale",
  ];

  /**
   * Names (English + every shipped Babele translation) of ammo that RAW says cannot cause a Critical
   * Injury (Rubber Ammunition, one entry per ammo type), backfilled with `overrides.crit` set to
   * override the loaded weapon to never crit.
   *
   * @type {string[]}
   */
  static NON_CRIT_AMMO_NAMES = [
    // Shotgun Slug (Rubber)
    "Shotgun Slug (Rubber)",
    "Breneka (Gumowa)",
    "Cartucce a Pallettoni (di Gomma)",
    "Flintenpatrone (Gummi)",
    "Posta de Escopeta (Goma)",
    "Slug de fusil à pompe (Caoutchouc)",
    "Жакан (резиновый)",
    "ショットガンのスラッグ弾（ゴム弾）",
    // Rifle (Rubber)
    "Rifle (Rubber)",
    "Fucile (di Gomma)",
    "Fusil (Caoutchouc)",
    "Gewehr (Gummi)",
    "Karabin (Gumowa)",
    "Rifle (Goma)",
    "Винтовочный (резиновый)",
    "ライフル（ゴム弾）",
    // Heavy Pistol (Rubber)
    "Heavy Pistol (Rubber)",
    "Ciężki pistolet (Gumowa)",
    "Pistola Pesada (Goma)",
    "Pistola Pesante (di Gomma)",
    "Pistolet lourd (Caoutchouc)",
    "Schwere Pistole (Gummi)",
    "Для пистолета крупного калибра (резиновый)",
    "大型拳銃（ゴム弾）",
    // Medium Pistol (Rubber)
    "Medium Pistol (Rubber)",
    "Mittelschwere Pistole (Gummi)",
    "Pistola Media (di Gomma)",
    "Pistola Media (Goma)",
    "Pistolet moyen (Caoutchouc)",
    "Średni pistolet (Gumowa)",
    "Для пистолета среднего калибра (резиновый)",
    "中型拳銃（ゴム弾）",
    // Very Heavy Pistol (Rubber)
    "Very Heavy Pistol (Rubber)",
    "B. Ciężki pistolet (Gumowa)",
    "Pistola Molto Pesante (di Gomma)",
    "Pistola Muy Pesada (Goma)",
    "Pistolet très lourd (Caoutchouc)",
    "Sehr Schwere Pistole (Gummi)",
    "Для пистолета сверхкрупного калибра (резиновый)",
    "超大型拳銃（ゴム弾）",
    // Arrow (Rubber)
    "Arrow (Rubber)",
    "Flecha (Goma)",
    "Flèche (Caoutchouc)",
    "Frecce (di Gomma)",
    "Pfeil (Gummi)",
    "Strzała (Gumowa)",
    "Стрела (резиновая)",
    "矢（ゴム弾）",
  ];

  /** @inheritdoc */
  async updateItem(itemData) {
    if (itemData.type === "ammo") {
      // RAW: Rubber ammunition can't cause a Critical Injury — override the loaded weapon to
      // never crit. Set unconditionally (matched by name) so it survives the data model default.
      if (this.constructor.NON_CRIT_AMMO_NAMES.includes(itemData.name)) {
        foundry.utils.setProperty(itemData, "system.overrides.crit", {
          override: true,
          threshold: 0,
          count: 0,
          bonus: 5,
        });
        return;
      }
      if (!foundry.utils.hasProperty(itemData, "system.overrides.crit")) {
        foundry.utils.setProperty(itemData, "system.overrides.crit", {
          override: false,
          threshold: 0,
          count: 2,
          bonus: 5,
        });
      }
      return;
    }
    // RAW: these weapons can't cause a Critical Injury. Set unconditionally (matching by name like
    // 030-isElectronic) — the v13 data model injects the default `count` into the source, so a
    // guarded set would never override it back down to 0.
    if (this.constructor.NON_CRIT_WEAPON_NAMES.includes(itemData.name)) {
      foundry.utils.setProperty(itemData, "system.damageCrit", {
        threshold: 0,
        count: 0,
        bonus: 5,
      });
      return;
    }
    if (!foundry.utils.hasProperty(itemData, "system.damageCrit")) {
      foundry.utils.setProperty(itemData, "system.damageCrit", {
        threshold: 0,
        count: 2,
        bonus: 5,
      });
    }
  }
}
