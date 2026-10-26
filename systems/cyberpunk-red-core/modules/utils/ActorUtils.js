import SystemUtils from "./cpr-systemUtils.js";

/**
 * Common utils for Actors
 */
export default class CPRActorUtils {
  /**
   * Gets the SP value for a given armor and location with ablation (optional), including any upgrades
   *
   * @param {Actor} armor - The armor actor to check
   * @param {string} location - The location to check
   * @param {boolean} withAblation - Whether to include ablation in the calculation
   * @returns {Promise<number>} The total SP value for the specified armor and location
   */
  static async calculateArmorSP(armor, location, withAblation = false) {
    if (!armor) return 0;

    const cprArmorData = armor.system;
    const upgradeData = armor.getTotalUpgradeValues(`${location}Sp`);

    const currentSP = Number(cprArmorData[`${location}Location`].sp);
    const currentAblation = Number(
      cprArmorData[`${location}Location`].ablation,
    );

    const currentSpWithUpgrades =
      upgradeData.type === "override"
        ? upgradeData.value
        : currentSP + upgradeData.value;

    const armorSPWithAblation =
      currentAblation < 0
        ? Math.min(
            currentSpWithUpgrades - currentAblation,
            currentSpWithUpgrades,
          )
        : Math.max(currentSpWithUpgrades - currentAblation, 0);

    return withAblation ? armorSPWithAblation : currentSpWithUpgrades;
  }

  /**
   * Creates a Black ICE actor with default settings
   * @param {Object} additionalData - Optional data to merge with default Black ICE data
   * @returns {Promise<Actor>} The created actor
   */
  static async createBlackIceActor(additionalData = {}) {
    const iconPath = `systems/${game.system.id}/icons/compendium/default/default-blackice.svg`;
    const actorName = SystemUtils.Localize("CPR.global.programClass.blackice");
    const blackIceActorData = {
      name: actorName,
      type: "blackIce",
      img: iconPath,
      prototypeToken: {
        name: actorName,
        actorLink: false,
        texture: {
          src: iconPath,
        },
      },
    };

    // Merge the default data with any additional data passed in
    const mergedData = foundry.utils.mergeObject(
      blackIceActorData,
      additionalData,
    );

    return Actor.create(mergedData);
  }
}
