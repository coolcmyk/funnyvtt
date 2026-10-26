import BaseMigrationScript from "../base-migration-script.js";
import CPRSystemUtils from "../../../utils/cpr-systemUtils.js";
import { IMG_MAP as SPLIT_PACK_IMG_MAP } from "./039-split-packs.js";

const OLD_BRANDED_WEAPONS_PACK = "cyberpunk-red-core.core_weapons-branded";
const NEW_BRANDED_WEAPONS_PACK = "cyberpunk-red-dlc.dlc_weapons";
const OLD_READIED_ACTION_IMG =
  "systems/cyberpunk-red-core/icons/compendium/status/readied_action.svg";
const NEW_TIMEWARP_IMG =
  "modules/cyberpunk-red-dlc/icons/dlc/status/timewarp.svg";

const IMG_MAP = {
  ...SPLIT_PACK_IMG_MAP,
  "systems/cyberpunk-red-core/icons/compendium/spinning_your_wheels/bulletproof_glass.svg":
    "systems/cyberpunk-red-core/icons/compendium/upgrades/bulletproof_glass.svg",
  "systems/cyberpunk-red-core/icons/compendium/spinning_your_wheels/smuggling_upgrade.svg":
    "systems/cyberpunk-red-core/icons/compendium/upgrades/smuggling_upgrade.svg",
  ...Object.fromEntries(
    [
      "beserker.svg",
      "beserker_addiction.svg",
      "deathtrance.svg",
      "piranha-smash-addiction.svg",
      "piranha-smash.svg",
      "poser_chip.svg",
      "prime_time.svg",
      "prime_time_addiction.svg",
      "sedative.svg",
      "sixgun.svg",
      "sixgun_addiction.svg",
      "timewarp.svg",
      "timewarp_addiction.svg",
      "veritas.svg",
    ].map((file) => [
      `systems/cyberpunk-red-core/icons/compendium/status/${file}`,
      `modules/cyberpunk-red-dlc/icons/dlc/status/${file}`,
    ]),
  ),
};

export function relinkDlcString(value) {
  let result = value.replaceAll(
    OLD_BRANDED_WEAPONS_PACK,
    NEW_BRANDED_WEAPONS_PACK,
  );

  if (IMG_MAP[result]) return IMG_MAP[result];
  if (!result.includes("systems/cyberpunk-red-core/icons/compendium/")) {
    return result;
  }

  for (const [oldPath, newPath] of Object.entries(IMG_MAP)) {
    result = result.replaceAll(oldPath, newPath);
  }
  return result;
}

export function relinkDlcContent(data) {
  let changed = false;

  function visit(value, isEffect = false) {
    if (typeof value === "string") {
      const result = relinkDlcString(value);
      if (result !== value) changed = true;
      return result;
    }

    if (!value || typeof value !== "object") return value;

    if (
      isEffect &&
      !Array.isArray(value) &&
      value.name === "Timewarp Primary" &&
      value.img === OLD_READIED_ACTION_IMG
    ) {
      value.img = NEW_TIMEWARP_IMG;
      changed = true;
    }

    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        value[index] = visit(value[index], isEffect);
      }
      return value;
    }

    for (const [key, child] of Object.entries(value)) {
      value[key] = visit(child, key === "effects");
    }
    return value;
  }

  visit(data);
  return changed;
}

export default class RelinkDlcContent extends BaseMigrationScript {
  static version = 46;

  static name = "Relink content moved to the DLC module";

  static documentFilters = {
    Item: { types: [], mixins: [] },
    Actor: { types: [], mixins: [] },
  };

  async updateItem(itemData) {
    relinkDlcContent(itemData);
  }

  async updateActor(actorData) {
    relinkDlcContent(actorData);
  }

  async _relinkDocuments(documents) {
    for (const document of documents) {
      const data = document.toObject();
      if (relinkDlcContent(data)) {
        await document.update(data, { noHook: true });
      }
    }
  }

  async _relinkWorldCompendiumDocuments(documentType, embeddedCollection) {
    const compendia = CPRSystemUtils.GetCompendiaByType("world", documentType);

    for (const compendium of compendia) {
      const pack = game.packs.get(compendium.metadata.id);
      const wasLocked = pack.locked;

      if (wasLocked) await pack.configure({ locked: false });
      try {
        const documents = await pack.getDocuments();
        for (const document of documents) {
          await this._relinkDocuments(document[embeddedCollection]);
        }
      } finally {
        if (wasLocked) await pack.configure({ locked: true });
      }
    }
  }

  async migrateMisc() {
    for (const journal of game.journal) {
      await this._relinkDocuments(journal.pages);
    }
    await this._relinkWorldCompendiumDocuments("JournalEntry", "pages");

    for (const table of game.tables) {
      await this._relinkDocuments(table.results);
    }
    await this._relinkWorldCompendiumDocuments("RollTable", "results");

    for (const scene of game.scenes) {
      await this._relinkDocuments(scene.tiles);
    }
    await this._relinkWorldCompendiumDocuments("Scene", "tiles");

    await this._relinkDocuments(game.macros);
  }
}
