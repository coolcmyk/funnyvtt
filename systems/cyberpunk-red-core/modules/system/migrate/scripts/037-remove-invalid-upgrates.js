import BaseMigrationScript from "../base-migration-script.js";

/**
 * For all actors, remove from all weapons any upgradeItems that cannot be found
 * either in the actor inventory, or in the game items.
 */
export default class RemoveInvalidUpgrates extends BaseMigrationScript {
  static version = 37;

  static name =
    "Weapons, remove invalid/undefnied/unfindable items from weapon installedItems";

  static documentFilters = {
    Item: { types: [], mixins: [] },
    Actor: { types: ["character", "container", "mook"], mixins: [] },
  };

  async updateActor(actorData) {
    const weapons = actorData.items.filter((item) => item.type === "weapon");

    weapons.forEach((itemData) => {
      const installedItems = itemData.system?.installedItems?.list;
      if (installedItems.length) {
        const validatedInstalledItems = installedItems
          .filter((item) => {
            const actorDataItem = actorData.items?.find(
              (actorItem) =>
                actorItem._id === item &&
                ["ammo", "itemUpgrade"].includes(actorItem.type),
            );
            const gameItem = game.items.get(item)?.toObject();
            const itemObject = actorData ? actorDataItem : gameItem;

            return itemObject;
          })
          .filter(Boolean);
        itemData.system.installedItems.list = validatedInstalledItems;
      }
    });
  }
}
