import CPRActorSheet from "./cpr-actor-sheet.js";
import CPR from "../../system/config.js";
import SystemUtils from "../../utils/cpr-systemUtils.js";
import CPRChat from "../../chat/cpr-chat.js";
import CPRItem from "../../item/cpr-item.js";
import { cprConfirm, cprFormPrompt } from "../../dialog/cpr-dialog.js";
import { ContainerUtils } from "../../item/mixins/cpr-container.js";

const TextEditor = foundry.applications.ux.TextEditor.implementation;

/**
 * Implement the sheet for containers and shop keepers. This extends CPRActorSheet to make use
 * of owned-item management methods like getOwnedItem and _deleteOwnedItem.
 *
 * @extends {CPRActorSheet}
 */
export default class CPRContainerActorSheet extends CPRActorSheet {
  /**
   * See https://foundryvtt.com/api/v12/classes/client.Application.html for the complete list of options available.
   *
   * @override
   * @returns - sheet options merged with default options in ActorSheet
   */
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    position: {
      width: 1000,
      height: 750,
    },
  };

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: `systems/${CPR.systemId}/templates/actor/cpr-container-sheet.hbs`,
      scrollable: [".right-content"],
    },
  };

  /**
   * Get actor data into a more convenient organized structure. This should be called sparingly in code.
   * Only add new data points to getData when you need a complex struct, not when you only need to add
   * new data points to shorten dataPaths.
   *
   * @override
   * @returns {Object} data - a curated structure of actorSheet data
   */
  async _prepareContext(options) {
    const foundryData = await super._prepareContext(options);
    const cprActorData = {};

    cprActorData.userOwnedActors = [];
    game.actors
      .filter((a) => a.isOwner && a.type === "character")
      .forEach((a) => {
        cprActorData.userOwnedActors.push({ id: a.id, name: a.name });
      });
    cprActorData.userOwnedActors.unshift({ id: "", name: "--" });

    if (game.user.character !== undefined && game.user.character !== null) {
      cprActorData.userCharacter = game.user.character.id;
      if (!cprActorData.tradePartnerId) {
        cprActorData.tradePartnerId = game.user.character.id;
      }
      if (this.tradePartnerId) {
        cprActorData.tradePartnerId = this.tradePartnerId;
      }
    } else {
      cprActorData.userCharacter = "";
      cprActorData.tradePartnerId = this.tradePartnerId;
    }
    return { ...foundryData, ...cprActorData };
  }

  /**
   * Add listeners specific to the Container sheet. Remember additional listeners are added from the
   * parent class, CPRActorSheet.
   *
   * @override
   * @param {*} html - the DOM object
   */
  _onRender(context, options) {
    super._onRender(context, options);

    this._on('select[name="trade-with-dropdown"]', "change", (event) =>
      this._setTradePartner(event),
    );
    this._on(".container-type-dropdown", "change", (event) =>
      this._setContainerType(event),
    );
    this._on(".checkbox-toggle", "click", (event) =>
      this._checkboxToggle(event),
    );
    this._on(".eurobucks-input-button", "click", (event) =>
      this._updateEurobucks(event),
    );
    this._on(".eurobucks-open-ledger", "click", () =>
      this.showLedger("wealth"),
    );
    this._on(".vendor-configure-sell-to", "click", () =>
      this._configureSellTo(),
    );
  }

  /**
   * Override the _itemAction() of the CPRActorSheet to add "purchase" action
   * and remove non needed other action types.
   *
   *
   * @async
   * @private
   * @callback
   * @param {event} event - object capturing event data (what was clicked and where?)
   */
  async _itemAction(event) {
    const itemId = SystemUtils.GetEventDatum(event, "data-item-id");
    const item = this.actor.getOwnedItem(itemId);
    const actionType = SystemUtils.GetEventDatum(event, "data-action-type");
    if (item) {
      switch (actionType) {
        case "delete": {
          await this._deleteOwnedItem(item);
          break;
        }
        case "purchase": {
          await this._purchaseItem(item, true);
          break;
        }
        case "purchaseFraction": {
          this._purchaseItem(item, false);
          break;
        }
        default: {
          item.doAction(this.actor, event.currentTarget.attributes);
        }
      }
      // Only update if we aren't deleting the item.  Item deletion is handled in this._deleteOwnedItem()
      // The same holds for purchasing the item, as it is handled by this._purchaseItem()
      if (actionType !== "delete" && actionType !== "purchase") {
        this.actor.updateEmbeddedDocuments("Item", [
          { _id: item.id, system: item.system },
        ]);
      }
    }
  }

  /**
   * Render the item card (chat message) when ctrl-click happens on an item link, or display
   * the item sheet if ctrl was not pressed.
   *
   * @override
   * @private
   * @callback
   * @param {Object} event - object capturing event data (what was clicked and where?)
   */
  _renderItemCard(event) {
    const itemId = CPRActorSheet._getItemId(event);
    const item = this.actor.items.find((i) => i._id === itemId);
    if (event.ctrlKey || event.metaKey) {
      CPRChat.RenderItemCard(item);
    } else {
      const playersCanModify = foundry.utils.getProperty(
        this.actor,
        `flags.${game.system.id}.players-modify`,
      );
      if (playersCanModify || game.user.isGM) {
        item.sheet.render(true, { editable: true });
      } else {
        item.sheet.render(true, { editable: false });
      }
    }
  }

  /**
   * This is the callback for setting the trade partner of the container.
   * This given the knowledge, which actor to mofify upon purchase of items.
   *
   * @callback
   * @private
   * @param {} event - object capturing event data (what was clicked and where?)
   */
  _setTradePartner(event) {
    this.tradePartnerId = event.currentTarget.value;
  }

  /**
   * Handle the purchase of an item. The item is added to the actor specified as
   * the tradePartner and money is deducted accordingly.
   *
   * @private
   * @param {Item} item - object to be purchased
   * @param {boolean} all - Toggle to purchase all of the items in the stack or just a part of them
   */
  async _purchaseItem(item, all) {
    if (
      SystemUtils.hasMixin(item.type, "stackable") &&
      item.system.amount < 1
    ) {
      return;
    }

    let { tradePartnerId } = this;
    if (tradePartnerId === undefined || tradePartnerId === "") {
      if (!game.user.isGM && game.user.character) {
        tradePartnerId = game.user.character._id;
      } else {
        SystemUtils.DisplayMessage(
          "warn",
          SystemUtils.Localize("CPR.messages.tradeWithWarn"),
        );
        return;
      }
    }

    // Players must have Owned permission on Containers for them to function properly
    if (!this.actor.isOwner) {
      SystemUtils.DisplayMessage(
        "warn",
        SystemUtils.Localize("CPR.messages.insufficientPermissions"),
      );
      return;
    }
    const containerTypes = SystemUtils.getDocTypesFromMixin("container");

    let cost;
    if (
      item.type === "ammo" &&
      item.system.variety !== "grenade" &&
      item.system.variety !== "rocket"
    ) {
      // Ammunition, which is neither grenades nor rockets, are prices are for 10 of them (pg. 344)
      cost = item.system.price.market / 10;
    } else {
      cost = item.system.price.market;
    }

    let purchaseAmount;
    if (!all) {
      // Prepare data for dialog.
      let formData = {
        header: SystemUtils.Format("CPR.dialog.purchasePart.text", {
          itemName: item.name,
        }),
        purchaseAmount: Math.ceil(item.system.amount / 2),
      };

      // Show "Purchase Part" dialog.
      formData = await cprFormPrompt({
        data: formData,
        title: SystemUtils.Localize("CPR.dialog.purchasePart.title"),
        template: `systems/${game.system.id}/templates/dialog/cpr-purchase-part-prompt.hbs`,
      });

      const inventoryAmount =
        typeof item.system.amount !== "undefined"
          ? parseInt(item.system.amount, 10)
          : 1;
      if (!formData) {
        return;
      }
      purchaseAmount = parseInt(formData.purchaseAmount, 10);
      if (purchaseAmount < 1 || purchaseAmount >= inventoryAmount) {
        SystemUtils.DisplayMessage(
          "warn",
          SystemUtils.Localize("CPR.dialog.purchasePart.wrongAmountWarning"),
        );
        return;
      }
      cost *= purchaseAmount;
    } else {
      cost *=
        typeof item.system.amount !== "undefined"
          ? parseInt(item.system.amount, 10)
          : 1;
    }

    // The buyer must be able to afford the item before anything on this
    // container is changed, including uninstalling it from other items.
    const tradePartnerActor = game.actors.get(tradePartnerId);
    if (
      !foundry.utils.getProperty(
        this.actor,
        `flags.${game.system.id}.items-free`,
      ) &&
      tradePartnerActor.system.wealth.value < cost
    ) {
      SystemUtils.DisplayMessage(
        "warn",
        SystemUtils.Localize("CPR.messages.tradePriceWarn"),
      );
      return;
    }

    // If the purchased item is installed in another item on this container and
    // will be removed from stock, uninstall it now that the purchase is known
    // to go through. This scrubs the reference so the other item does not
    // dangle, and restores any magazine rounds to the item.
    const removesFromStock =
      all &&
      !foundry.utils.getProperty(
        this.actor,
        `flags.${game.system.id}.infinite-stock`,
      );
    if (removesFromStock && item.system.isInstalled) {
      await item.uninstall({ skipDialog: true });
    }

    const transferredItemData = foundry.utils.duplicate(item);
    if (!all) {
      transferredItemData.system.amount = purchaseAmount;
    }

    if (SystemUtils.hasMixin(item.type, "container")) {
      const cprInstallTree = item.createInstalledObjectData();
      ContainerUtils.setInstallTreeFlag(transferredItemData, cprInstallTree);
    }

    if (
      !foundry.utils.getProperty(
        this.actor,
        `flags.${game.system.id}.items-free`,
      )
    ) {
      const { amount } = transferredItemData.system;
      const username = game.user.name;
      let reason;
      if (amount > 1) {
        reason = `${SystemUtils.Format(
          "CPR.containerSheet.tradeLog.multiplePurchased",
          { amount, name: item.name, price: cost },
        )} - ${username}`;
      } else {
        reason = `${SystemUtils.Format(
          "CPR.containerSheet.tradeLog.singlePurchased",
          { name: item.name, price: cost },
        )} - ${username}`;
      }
      const vendorReason = `${SystemUtils.Format(
        "CPR.containerSheet.tradeLog.vendorSold",
        {
          name: item.name,
          quantity: amount,
          purchaser: tradePartnerActor.name,
          price: cost,
        },
      )} - ${username}`;
      await tradePartnerActor.deltaLedgerProperty("wealth", -1 * cost, reason);
      await this.actor.recordTransaction(cost, vendorReason, this.actor);
    }
    if (
      tradePartnerActor.automaticallyStackItems(
        new CPRItem(transferredItemData),
      ).length === 0
    ) {
      await tradePartnerActor.createEmbeddedDocuments("Item", [
        transferredItemData,
      ]);
    }
    if (
      !foundry.utils.getProperty(
        this.actor,
        `flags.${game.system.id}.infinite-stock`,
      )
    ) {
      if (all) {
        const deleteList = [item._id];

        if (
          containerTypes.includes(item.type) &&
          item.isOwned === true &&
          item.system.hasInstalled
        ) {
          const deleteItemList = item.recursiveGetAllInstalledItems();
          for (const installedItem of deleteItemList) {
            deleteList.push(installedItem._id);
          }
        }
        await this.actor.deleteEmbeddedDocuments("Item", deleteList, {
          // Preserve the loaded rounds while transferring the weapon.
          unloadAmmo: false,
          // The installed-item data was copied to the buyer above.
          deleteInstalled: true,
        });
      } else {
        const keepAmount =
          item.system.amount - transferredItemData.system.amount;
        await this.actor.updateEmbeddedDocuments("Item", [
          { _id: item.id, "system.amount": keepAmount },
        ]);
      }
    }
  }

  /**
   * Handle the purchase of an item. The item is added to the actor specified as
   * the tradePartner and money is deducted accordingly.
   *
   * @private
   * @param {string} tradePartnerId - actor.id of the person selling the item
   * @param {Item} item - object to be purchased
   */
  async _sellItemTo(tradePartnerId, item) {
    // Players must have Owned permission on Containers for them to function properly
    if (!this.actor.isOwner) {
      SystemUtils.DisplayMessage(
        "warn",
        SystemUtils.Localize("CPR.messages.insufficientPermissions"),
      );
      return;
    }
    if (tradePartnerId === this.actor.id) {
      return;
    }

    const cprItemData = item.system;
    let cprItemName = item.name;
    const amount = cprItemData.amount ? parseInt(cprItemData.amount, 10) : 1;
    const vendorData = this.actor.system;
    const vendorConfig = vendorData.vendor;
    const tradePartnerActor = game.actors.get(tradePartnerId);
    const username = game.user.name;

    let cost;

    if (
      item.type === "ammo" &&
      cprItemData.variety !== "grenade" &&
      cprItemData.variety !== "rocket"
    ) {
      // Ammunition, which is neither grenades nor rockets, are prices are for 10 of them (pg. 344)
      cost = parseInt(parseInt(cprItemData.price.market, 10) / 10, 10);
    } else {
      cost = parseInt(cprItemData.price.market, 10);
    }
    const percent = parseInt(
      vendorConfig.itemTypes[item.type].purchasePercentage,
      10,
    );

    const containerTypes = SystemUtils.getDocTypesFromMixin("container");

    let vendorOffer = parseInt((amount * cost * percent) / 100, 10);
    vendorOffer = Math.min(vendorOffer, vendorData.wealth.value);

    if (cprItemData.isUpgraded) {
      cprItemName = `${SystemUtils.Localize(
        "CPR.global.generic.upgraded",
      )} ${cprItemName}`;
    }

    const dialogMessage = `${SystemUtils.Format(
      "CPR.dialog.container.vendor.offerToBuy",
      {
        vendorName: this.actor.name,
        vendorOffer,
        itemName: cprItemName,
        percent,
      },
    )}`;

    // Show confirmation prompt.
    const confirmed = await cprConfirm(dialogMessage, {
      title: SystemUtils.Localize(
        "CPR.dialog.container.vendor.purchaseOrderTitle",
      ),
    });

    if (confirmed) {
      const loadableTypes = SystemUtils.getDocTypesFromMixin("loadable");
      if (loadableTypes.includes(item.type) && item.system.hasAmmoLoaded) {
        await item.unload();
      }
      let createItems = [];
      const deleteItems = [];

      // Package installed items so they duplicate on the vendor, mirroring _purchaseItem.
      const transferredItemData = foundry.utils.duplicate(item);
      if (SystemUtils.hasMixin(item.type, "container")) {
        const cprInstallTree = item.createInstalledObjectData();
        ContainerUtils.setInstallTreeFlag(transferredItemData, cprInstallTree);
      }

      createItems.push(transferredItemData);
      deleteItems.push(item._id);
      if (containerTypes.includes(item.type) && item.system.hasInstalled) {
        const deleteItemList = item.recursiveGetAllInstalledItems();
        for (const installedItem of deleteItemList) {
          deleteItems.push(installedItem._id);
        }
      }

      const infiniteStock = foundry.utils.getProperty(
        this.actor,
        `flags.${game.system.id}.infinite-stock`,
      );

      if (infiniteStock) {
        const itemList = createItems;
        itemList.forEach((infiniteItem) => {
          if (this.actor.items.find((i) => i.name === infiniteItem.name)) {
            createItems = createItems.filter(
              (ci) => ci._id !== infiniteItem._id,
            );
          }
        });
      }

      if (createItems.length > 0) {
        const creationSuccess = await this.actor.createEmbeddedDocuments(
          "Item",
          createItems,
        );
        if (creationSuccess.length > 0) {
          await tradePartnerActor.deleteEmbeddedDocuments("Item", deleteItems);
          let reason;
          if (amount > 1) {
            reason = `${SystemUtils.Format(
              "CPR.containerSheet.tradeLog.multipleSold",
              {
                amount,
                name: item.name,
                price: vendorOffer,
                vendor: this.actor.name,
              },
            )} - ${username}`;
          } else {
            reason = `${SystemUtils.Format(
              "CPR.containerSheet.tradeLog.singleSold",
              {
                name: item.name,
                price: vendorOffer,
                vendor: this.actor.name,
              },
            )} - ${username}`;
          }
          const vendorReason = `${SystemUtils.Format(
            "CPR.containerSheet.tradeLog.vendorPurchased",
            {
              name: item.name,
              quantity: cprItemData.amount,
              seller: tradePartnerActor.name,
              price: vendorOffer,
            },
          )} - ${username}`;
          await tradePartnerActor.deltaLedgerProperty(
            "wealth",
            vendorOffer,
            reason,
          );
          await this.actor.recordTransaction(
            vendorOffer,
            vendorReason,
            tradePartnerActor,
          );
        }
      }
    }
  }

  /**
   * Set or unset a corresponding flag on the actor when a checkbox is clicked.
   *
   * @private
   * @callback
   * @param {Object} event - object capturing event data (what was clicked and where?)
   */
  async _checkboxToggle(event) {
    const flagName = SystemUtils.GetEventDatum(event, "data-flag-name");
    await this.actor.toggleFlag(flagName);
    await this.render();
  }

  /**
   * This is the callback for setting the container type.
   *
   * @callback
   * @private
   * @param {} event - object capturing event data (what was clicked and where?)
   */
  async _setContainerType(event) {
    const containerType = event.currentTarget.value;
    await this.actor.setContainerType(containerType);
    await this.render();
  }

  /**
   * _onDrop is provided by ActorSheet and extended here. When an Item is dragged to an ActorSheet a new
   * copy is created. This extension ensures players are allowed to create items in the container-actor before doing so.
   *
   * @private
   * @override
   * @param {Object} event - an object capturing event details
   */
  async _onDrop(event) {
    const dragData = TextEditor.getDragEventData(event);
    if (
      dragData.type === "Item" &&
      dragData.system?.actorId === this.actor.id
    ) {
      return;
    }
    const containerType = foundry.utils.getProperty(
      this.actor,
      `flags.${game.system.id}.container-type`,
    );
    if (!containerType) {
      await this.actor.setContainerType("shop");
    }
    const playersCanCreate = foundry.utils.getProperty(
      this.actor,
      `flags.${game.system.id}.players-create`,
    );
    const playersCanSell = foundry.utils.getProperty(
      this.actor,
      `flags.${game.system.id}.players-sell`,
    );
    if (game.user.isGM || playersCanCreate || playersCanSell) {
      if (!game.user.isGM && !playersCanCreate) {
        const tradePartnerId = dragData.system.actorId;
        const vendorData = this.actor.system.vendor;
        if (dragData.type === "Item") {
          const item = await Item.implementation.fromDropData(dragData);
          if (
            typeof vendorData.itemTypes[item.type] !== "undefined" &&
            vendorData.itemTypes[item.type].isPurchasing
          ) {
            await this._sellItemTo(tradePartnerId, item);
            return;
          }
          SystemUtils.DisplayMessage(
            "warn",
            SystemUtils.Localize("CPR.messages.tradeDragNotBuying"),
          );
          return;
        }
      }
      return super._onDrop(event);
    } else {
      SystemUtils.DisplayMessage(
        "warn",
        SystemUtils.Localize("CPR.messages.tradeDragInWarn"),
      );
    }
  }

  /**
   * Configure Container Actor to be able to purchase items from a player.
   *
   * @private
   * @callback
   */
  async _configureSellTo() {
    const cprActorData = foundry.utils.duplicate(this.actor.system);
    const promptData = {};
    promptData.itemTypes = SystemUtils.getDocTypesFromMixin("physical");
    promptData.currentConfig = cprActorData.vendor;

    promptData.itemTypes.forEach((itemType) => {
      if (typeof promptData.currentConfig.itemTypes[itemType] === "undefined") {
        promptData.currentConfig.itemTypes[itemType] = {
          isPurchasing: true,
          purchasePercentage: 100,
        };
      }
    });

    // Show "Configure Sell To" prompt.
    const formData = await cprFormPrompt({
      data: promptData,
      title: SystemUtils.Localize("CPR.dialog.container.vendor.sellToTitle"),
      template: `systems/${game.system.id}/templates/dialog/cpr-container-configure-sell-to-prompt.hbs`,
    });

    if (formData) {
      const newConfig = foundry.utils.mergeObject(
        promptData.currentConfig,
        formData.currentConfig,
        { recursive: true },
      );
      await this.actor.update({ "system.vendor": newConfig });
    }
  }

  async _updateEurobucks(event) {
    // const value = parseInt(event.currentTarget.parentElement.previousElementSibling.children[0].value, 10);
    const value = parseInt(this.element.querySelector("#eurobucks")?.value, 10);
    const action = event.currentTarget.dataset.action;
    if (Number.isNaN(value)) {
      SystemUtils.DisplayMessage(
        "warn",
        SystemUtils.Localize("CPR.messages.eurobucksModifyWarn"),
      );
      return;
    }
    const reason = `Sheet update ${action} ${value}`;
    await this.actor.recordTransaction(value, reason);
  }
}
