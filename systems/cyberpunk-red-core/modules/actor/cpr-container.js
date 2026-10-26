import SystemUtils from "../utils/cpr-systemUtils.js";
import LOGGER from "../utils/cpr-logger.js";
import Rules from "../utils/cpr-rules.js";
import { ContainerUtils } from "../item/mixins/cpr-container.js";
import { planInstalledItemDeletion } from "../item/installed-item-deletion.js";

/**
 * Container actors function like loot boxes, player or party stashes, stores, and
 * vending machines. Note this does not extend CPRActor.
 *
 * @extends {Actor}
 */
export default class CPRContainerActor extends Actor {
  /**
   * create() is called when creating the actor, but it's not the same as a constructor. In the
   * code here, we pre-configure a few token options to reduce repetitive clicking.
   */
  static async create(data, options) {
    const createData = data;
    if (typeof data.system === "undefined") {
      createData.prototypeToken = {
        disposition: 0,
      };
      createData.ownership = { default: 3 };
    }
    const newContainerActor = await super.create(createData, options);
    newContainerActor.setContainerType("shop");
  }

  /**
   * This is pretty much a copy of the same function in `cpr-actor.js`.
   * We copy it because CPRContainerActor does not actually extend CPRActor.
   * In the future, we should refactor so that CPRContainerActor extends CPRActor,
   * thus rendering this function copy unnecessary.
   *
   * @override
   * @param {String} embeddedName - document name, usually a category like Item
   * @param {Array<CPRItem>} items - Array of documents to create
   * @param {Object} context - an object tracking the context in which the method is being called
   * @returns {null}
   */
  async createEmbeddedDocuments(
    embeddedName,
    items,
    context = { createInstalled: true },
  ) {
    if (embeddedName !== "Item")
      return super.createEmbeddedDocuments(embeddedName, items, context);

    let itemsToCreate = items;

    // Don't add core items. Filter by predicate rather than collected ids so
    // that id-less create payloads don't cause sibling items to be dropped.
    if (itemsToCreate.some((i) => i.system?.core)) {
      Rules.lawyer(false, "CPR.messages.dontAddCoreItems");
      itemsToCreate = itemsToCreate.filter((i) => !i.system?.core);
    }

    // Role items serve no purpose on containers; discard them so they are
    // not persisted.
    if (itemsToCreate.some((i) => i.type === "role")) {
      SystemUtils.DisplayMessage(
        "error",
        SystemUtils.Localize("CPR.messages.cannotAddRoleToContainer"),
      );
      itemsToCreate = itemsToCreate.filter((i) => i.type !== "role");
    }

    // Attempt to stack item before creating it
    const stackedItemReferences = [];
    if (!context.CPRsplitStack) {
      LOGGER.debug("Attempting to stack items on an actor sheet");
      const dontCreate = new Set();
      for (const doc of itemsToCreate) {
        if (!doc.system) continue;
        const [returnValue] = await this.automaticallyStackItems(doc);
        if (returnValue) {
          dontCreate.add(doc);
          // Keep track of the item that we stacked upon, so we can update the parent's
          // references later, if the item that was stacked is meant to be installed.
          stackedItemReferences.push({ id: returnValue._id, system: {} });
        }
      }
      // Don't create items that we should stack.
      itemsToCreate = itemsToCreate.filter((i) => !dontCreate.has(i));
    }

    // Create the items
    const createdItems = await super.createEmbeddedDocuments(
      embeddedName,
      itemsToCreate,
      context,
    );

    const handledInstalledItems = new Set();
    if (context.createInstalled) {
      // Handle creating and installing any items into the parent item.
      for (const item of createdItems) {
        if (!item.system.hasInstalled) continue;
        handledInstalledItems.add(item.id);
        // The item will only have this flag if it is imported/coming from another actor.
        const imported = !!ContainerUtils.getInstallTreeFlag(item);
        // The following function recusrively creates and installs all items in the install tree.
        await item.createInstalledItemsOnActor(imported);
      }
    }

    // Handle upgradable items (weapons, armor, clothing) with installed upgrades
    const upgradableTypes = SystemUtils.getDocTypesFromMixin("upgradable");
    for (const item of createdItems) {
      // Items handled above already have their installed upgrades duplicated and re-linked.
      if (handledInstalledItems.has(item.id)) continue;
      // skip item if it is not upgradeable - nothing should be there
      if (!upgradableTypes.includes(item.type)) continue;
      const installedUpgradeIds = item.system.installedItems?.list ?? [];
      // skip item if it has no upgrades
      if (installedUpgradeIds.length === 0) continue;
      const sourceUpgrades = [];
      const installTree = ContainerUtils.getInstallTreeFlag(item);
      if (installTree && installTree.length > 0) {
        for (const upgrade of installTree) {
          sourceUpgrades.push(foundry.utils.duplicate(upgrade));
        }
      } else {
        for (const upgradeId of installedUpgradeIds) {
          const sourceUpgrade =
            game.items.get(upgradeId) ?? item.actor?.getOwnedItem(upgradeId);
          if (sourceUpgrade) sourceUpgrades.push(sourceUpgrade);
        }
      }

      // game environment doesn't have the upgrade items, so we cannot duplicate them (!?)
      if (sourceUpgrades.length === 0) continue;
      // Finally, duplicate and install the upgrades
      const upgradeData = sourceUpgrades.map((u) => foundry.utils.duplicate(u));
      const newUpgrades = await item.actor.createEmbeddedDocuments(
        "Item",
        upgradeData,
        { keepId: false },
      );
      const newUpgradeIds = newUpgrades.map((u) => u.id);

      await item.update({ "system.installedItems": { list: newUpgradeIds } });
    }

    // Here, we return the created item array, but concatenated with references to any stacked items
    // This way, when dragging/dropping installed items from sheet to sheet, the calling function can still
    // update the parent with the correct references (see `createInstalledItemsOnActor()` in the mixin cpr-container.js)
    return createdItems.concat(stackedItemReferences);
  }

  /**
   * This is a copy of the same function in `cpr-actor.js`.
   * We copy it because CPRContainerActor does not actually extend CPRActor.
   * In the future, we should refactor so that CPRContainerActor extends CPRActor,
   * thus rendering this function copy unnecessary.
   *
   * When we delete an owned item, we should first check if it has items installed into it,
   * or if it's installed into something else (or both). That way we can make sure they get
   * uninstalled properly and their references are scrubbed. Without this, deleting an
   * installed item (e.g. purchasing a loaded weapon's ammo pile from a shop) leaves
   * dangling ids in the other items' `installedItems.list`.
   *
   * @override
   * @param {String} embeddedName - document name, usually a category like Item
   * @param {Object} ids - Array of ids to consider
   * @param {Object} [options] - an object tracking the context in which the method is being called
   * @param {Boolean} [options.cprIsMigrating = false] - Whether or not this is being called during migration.
   * @param {Boolean} [options.unloadAmmo = true]      - If ammo should be unloaded as a part of this delete action.
   * @param {Boolean} [options.deleteInstalled = false]   - Uninstall or delete installed items?.
   * @returns {null}
   */
  async deleteEmbeddedDocuments(
    embeddedName,
    ids,
    options = {
      cprIsMigrating: false,
      unloadAmmo: true,
      deleteInstalled: false,
    },
  ) {
    // If migration is calling this, we assume migration is
    // handling all references to containers and installable
    // items, so we just delete the item.
    const isMigration = !!options?.cprIsMigrating;
    if (isMigration)
      return super.deleteEmbeddedDocuments(embeddedName, ids, options);

    let idsToDelete = ids;
    if (embeddedName === "Item") {
      idsToDelete = planInstalledItemDeletion(this, ids);
    }

    // For every item that we are deleting...
    const uninstallPromises = [];
    for (const itemId of idsToDelete) {
      // Get the item.
      const item = this.getOwnedItem(itemId);
      // Check if item is installed somewhere. Uninstall it first.
      if (item?.system.isInstalled) {
        uninstallPromises.push(item.uninstall({ skipDialog: true }));
      }

      // Check if it has installed items. Uninstall them before deleting.
      if (item?.system.hasInstalled) {
        const installedItemIDs = item.system.installedItems.list;
        const installedItemsList = installedItemIDs.map((id) =>
          this.getOwnedItem(id),
        );
        if (!options.deleteInstalled) {
          // Uninstall all items before deletion of parent.
          uninstallPromises.push(
            item.uninstallItems(installedItemsList, {
              unloadAmmo: options.unloadAmmo,
            }),
          );
        }
      }
    }
    // Resolve all promises.
    await Promise.all(uninstallPromises);

    // Continue on with deleting the documents (call the Foundry function).
    return super.deleteEmbeddedDocuments(embeddedName, idsToDelete, options);
  }

  /**
   * This is a helper function for when syncing installed items fails irrecoverably.
   * It forcibly uninstalls all items from all other items so that the character sheet
   * can reset from a neutral state. This function should reveal items that are "invisible" on actors
   * due to IDs not matching up. Unfortunately, it means that users will have to manually
   * reinstall all their items, but at least other stats on those items aren't lost.
   * Ideally, this is also seldomly used.
   *
   * Note: Much of this code is duplicated from CPRContainer (Mixin). It should stay until
   * we harmonize CPRActor and CPRContainerActor.
   *
   * @async
   */
  async resetInstalled() {
    const containerTypes = SystemUtils.getDocTypesFromMixin("container");
    const installableTypes = SystemUtils.getDocTypesFromMixin("installable");
    const relevantItems = this.items.filter(
      (i) =>
        containerTypes.includes(i.type) || installableTypes.includes(i.type),
    );
    const updateList = [];
    for (const item of relevantItems) {
      const updateData = {
        _id: item.id,
      };

      if (item.system.installedItems?.list) {
        updateData["system.installedItems.list"] = [];
      }

      if (item.system.installedItems?.slots) {
        updateData["system.installedItems.usedSlots"] = 0;
      }

      if (item.type === "program") {
        updateData["system.isRezzed"] = false;
      }

      updateList.push(updateData);
    }

    await this.updateEmbeddedDocuments("Item", updateList);
  }

  /**
   * automaticallyStackItems searches for an identical item on the actor
   * and if found increments the amount and price for the item on the actor
   * instead of adding it as a new item.
   *
   * @param {Object} newItem - an object containing the new item
   * @returns {boolean} - true if thee item should be added normally
   *                    - false if it has been stacked on an existing item
   */
  automaticallyStackItems(newItem) {
    const itemTemplates = SystemUtils.getMixins(newItem.type);
    if (!itemTemplates.includes("stackable")) return [];
    const itemMatch = this.items.find(
      (i) => i.type === newItem.type && i.name === newItem.name,
    );
    if (
      !itemMatch ||
      !CPRContainerActor._canStackOnto(itemTemplates, itemMatch, newItem)
    )
      return [];
    const toInt = (value) => {
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) ? 1 : parsed;
    };
    const newAmount =
      toInt(itemMatch.system.amount) + toInt(newItem.system.amount);
    return this.updateEmbeddedDocuments(
      "Item",
      [{ _id: itemMatch.id, "system.amount": newAmount }],
      { diff: false },
    );
  }

  /**
   * Whether an incoming item may stack onto an existing match. Upgradable items
   * become unique once either side carries installed upgrades, so they never
   * merge; everything else stacks.
   *
   * @param {string[]} itemTemplates - the mixin templates for the item type
   * @param {Item} itemMatch - the existing item to stack onto
   * @param {Object} newItem - the incoming item data
   * @returns {boolean} true if the items may be merged into one stack
   */
  static _canStackOnto(itemTemplates, itemMatch, newItem) {
    if (!itemTemplates.includes("upgradable")) return true;
    return (
      !itemMatch.system.installedUpgrades.length &&
      !newItem.system.installedUpgrades?.length
    );
  }

  /**
   * This is the callback for setting the container type.
   *
   * @callback
   * @public
   * @param {} event - object capturing event data (what was clicked and where?)
   */
  async setContainerType(containerType) {
    await this.setFlag(game.system.id, "container-type", containerType);
    switch (containerType) {
      case "shop": {
        await this.unsetFlag(game.system.id, "items-free");
        await this.unsetFlag(game.system.id, "players-create");
        await this.unsetFlag(game.system.id, "players-delete");
        await this.unsetFlag(game.system.id, "players-modify");
        await this.setFlag(game.system.id, "players-sell", true);
        await this.unsetFlag(game.system.id, "players-move");
        break;
      }
      case "loot": {
        await this.unsetFlag(game.system.id, "infinite-stock");
        await this.setFlag(game.system.id, "items-free", true);
        await this.unsetFlag(game.system.id, "players-create");
        await this.unsetFlag(game.system.id, "players-delete");
        await this.unsetFlag(game.system.id, "players-modify");
        await this.unsetFlag(game.system.id, "players-sell");
        await this.unsetFlag(game.system.id, "players-move");
        break;
      }
      case "stash": {
        await this.unsetFlag(game.system.id, "infinite-stock");
        await this.unsetFlag(game.system.id, "players-sell");
        await this.setFlag(game.system.id, "items-free", true);
        await this.setFlag(game.system.id, "players-create", true);
        await this.setFlag(game.system.id, "players-delete", true);
        await this.setFlag(game.system.id, "players-modify", true);
        await this.setFlag(game.system.id, "players-move", true);
        break;
      }
      case "custom": {
        break;
      }
      default: {
        break;
      }
    }
  }

  /**
   * A utility method that toggles a flag back and forth. If defined, it is
   * set to true, but when it should be "false" we just remove it.
   *
   * @param {*} flagName - a name for the flag to set/unset
   * @returns {Document} representing the flag
   */
  async toggleFlag(flagName) {
    const flag = this.getFlag(game.system.id, flagName);
    if (flag === undefined || flag === false) {
      return this.setFlag(game.system.id, flagName, true);
    }
    return this.unsetFlag(game.system.id, flagName);
  }

  /**
   * Get all records from the associated ledger of a property. Currently the only
   * ledger that the container actor supports is the wealth ledger, however the
   * actor data model does have hit points listed as a ledger so we will
   * leave this as is.
   *
   * @param {String} prop - name of the property that has a ledger
   * @returns {Array} - Each element is a tuple: [value, reason], or null if not found
   */
  listRecords(prop) {
    if (prop === "wealth") {
      return foundry.utils.getProperty(this.system, `${prop}.transactions`);
    }
    return null;
  }

  /**
   * Return whether a property in actor data is a ledgerProperty. This means it has
   * two (sub-)properties, "value", and "transactions".
   *
   * XXX: This method is copied from cpr-actor.js because CPRContainerActor does not inherit
   *      from that class. We could fix that, but then all other code in this file would be added
   *      to an already long file. If you make changes here, be sure to consider them there too.
   *
   * @param {String} prop - name of the property that has a ledger
   * @returns {Boolean}
   */
  isLedgerProperty(prop) {
    const ledgerData = foundry.utils.getProperty(this.system, prop);
    if (!foundry.utils.hasProperty(ledgerData, "value")) {
      SystemUtils.DisplayMessage(
        "error",
        SystemUtils.Format("CPR.ledger.errorMessage.missingValue", { prop }),
      );
      return false;
    }
    if (!foundry.utils.hasProperty(ledgerData, "transactions")) {
      SystemUtils.DisplayMessage(
        "error",
        SystemUtils.Format("CPR.ledger.errorMessage.missingTransactions", {
          prop,
        }),
      );
      return false;
    }
    return true;
  }

  /**
   * Change the value of a property and store a record of the change in the corresponding
   * ledger.
   *
   * @param {Number} value - how much to increase or decrease the value by
   * @param {String} reason - a user-provided reason for the change
   * @returns {Number} (or null if not found)
   */
  recordTransaction(value, reason, seller = null) {
    // update "value"; it may be negative
    // If Containers ever get Active Effects, this code will be a problem. See Issue #583.
    const cprData = foundry.utils.duplicate(this.system);
    let newValue = foundry.utils.getProperty(cprData, "wealth.value") || 0;
    let transactionSentence;
    let transactionType;

    if (seller) {
      if (seller._id === this._id) {
        transactionType = "add";
      } else {
        transactionType = "subtract";
      }
    } else {
      transactionType = reason.split(" ")[2];
    }

    switch (transactionType) {
      case "set": {
        newValue = value;
        transactionSentence = "CPR.ledger.setSentence";
        break;
      }
      case "add": {
        newValue += value;
        transactionSentence = "CPR.ledger.increaseSentence";
        break;
      }
      case "subtract": {
        newValue -= value;
        transactionSentence = "CPR.ledger.decreaseSentence";
        break;
      }
      default:
    }

    foundry.utils.setProperty(cprData, "wealth.value", newValue);
    // update the ledger with the change
    const ledger = foundry.utils.getProperty(cprData, "wealth.transactions");
    ledger.push([
      SystemUtils.Format(transactionSentence, {
        property: "wealth",
        amount: value,
        total: newValue,
      }),
      reason,
    ]);
    foundry.utils.setProperty(cprData, "wealth.transactions", ledger);
    // update the actor and return the modified property
    this.update({ system: cprData });
    return foundry.utils.getProperty(this.system, "wealth");
  }

  /**
   * Given a property name on the actor model, wipe out all records in the corresponding ledger
   * for it. Effectively this sets it back to [].
   *
   * @param {String} prop - name of the property that has a ledger
   * @returns {Array} - empty or null if the property was not found
   */
  clearLedger(prop) {
    if (this.isLedgerProperty(prop)) {
      const valProp = `system.${prop}.value`;
      const ledgerProp = `system.${prop}.transactions`;
      this.update({
        [valProp]: 0,
        [ledgerProp]: [],
      });
      return foundry.utils.getProperty(this.system, prop);
    }
    return null;
  }

  /**
   * Change the value of a property and store a record of the change in the corresponding
   * ledger.
   *
   * @param {String} prop - name of the property that has a ledger
   * @param {Number} value - how much to increase or decrease the value by
   * @param {String} reason - a user-provided reason for the change
   * @returns {Number} (or null if not found)
   */
  deltaLedgerProperty(prop, value, reason) {
    if (this.isLedgerProperty(prop)) {
      // update "value"; it may be negative
      const valProp = `system.${prop}.value`;
      let newValue = foundry.utils.getProperty(this, valProp);
      newValue += value;
      // update the ledger with the change
      const ledgerProp = `system.${prop}.transactions`;
      const ledger = foundry.utils.getProperty(this, ledgerProp);
      if (value > 0) {
        ledger.push([
          SystemUtils.Format("CPR.ledger.increaseSentence", {
            property: prop,
            amount: value,
            total: newValue,
          }),
          reason,
        ]);
      } else {
        ledger.push([
          SystemUtils.Format("CPR.ledger.decreaseSentence", {
            property: prop,
            amount: -1 * value,
            total: newValue,
          }),
          reason,
        ]);
      }
      // update the actor and return the modified property
      this.update({
        [valProp]: newValue,
        [ledgerProp]: ledger,
      });
      return foundry.utils.getProperty(this.system, prop);
    }
    return null;
  }

  /**
   * Set the value of a property and store a record of the change in the corresponding
   * ledger. This is different from applying a delta, here we just set the value.
   *
   * @param {String} prop - name of the property that has a ledger
   * @param {Number} value - what to set the value to
   * @param {String} reason - a user-provided reason for the change
   * @returns {Number} (or null if not found)
   */
  setLedgerProperty(prop, value, reason) {
    if (this.isLedgerProperty(prop)) {
      const valProp = `system.${prop}.value`;
      const ledgerProp = `system.${prop}.transactions`;
      const ledger = foundry.utils.getProperty(this, ledgerProp);
      ledger.push([
        SystemUtils.Format("CPR.ledger.setSentence", {
          property: prop,
          total: value,
        }),
        reason,
      ]);
      this.update({
        [valProp]: value,
        [ledgerProp]: ledger,
      });
      return foundry.utils.getProperty(this.system, prop);
    }
    return null;
  }

  /**
   * Return the Item object given an Id
   *
   * @public
   * @param {String} itemId - Id or UUID of the item to get
   * @returns {CPRItem}
   */
  getOwnedItem(itemId) {
    const item = this.items.find((i) => i._id === itemId)
      ? this.items.find((i) => i._id === itemId)
      : this.items.find((i) => i.uuid === itemId);
    return item;
  }

  /**
   * This is a copy of the same function in `cpr-actor.js`.
   * We copy it because CPRContainerActor does not actually extend CPRActor.
   * In the future, we should refactor so that CPRContainerActor extends CPRActor,
   * thus rendering this function copy unnecessary.
   *
   * Return an array of Item objects given an array of Ids
   *
   * @public
   * @param {Array} itemIds - Array of Ids or UUIDs of the item(s) to get.
   * @returns {Array<CPRItem>}
   */
  getMultipleOwnedItems(itemIds) {
    const items = [];
    for (const id of itemIds) {
      const ownedItem = this.items.find((i) => i._id === id || i.uuid === id);
      items.push(ownedItem);
    }
    return items;
  }
}
