import CPRChat from "../../chat/cpr-chat.js";
import CPR from "../../system/config.js";
import createImageContextMenu from "../../utils/cpr-imageContextMenu.js";
import CPRScrollableSheetMixin from "../../utils/cpr-scrollable-sheet.js";

const { ActorSheetV2 } = foundry.applications.sheets;
const TextEditor = foundry.applications.ux.TextEditor.implementation;

/**
 * Implement the Demon sheet, which extends ActorSheetV2 directly from Foundry. This does
 * not extend CPRActor, as there is very little overlap between Demons and mooks/characters.
 *
 * @extends {ActorSheetV2}
 */
export default class CPRDemonActorSheet extends CPRScrollableSheetMixin(
  ActorSheetV2,
) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["demon"],
    position: {
      width: 600,
      height: "auto",
    },
    window: {
      resizable: true,
      contentClasses: ["cpr-sheet-content"],
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    actions: {
      roll: CPRDemonActorSheet.#onRoll,
    },
  };

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: `systems/${CPR.systemId}/templates/actor/cpr-demon-sheet.hbs`,
    },
  };

  /**
   * Get actor data into a more convenient organized structure for the template.
   *
   * @override
   * @param {object} options
   * @returns {Promise<object>} the template context
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.actor;
    context.system = this.actor.system;
    context.owner = this.actor.isOwner;
    context.editable = this.isEditable;
    context.enrichedHTML = {
      notes: await TextEditor.enrichHTML(this.actor.system.notes, {
        async: true,
      }),
    };
    return context;
  }

  /**
   * Wire up the image context menu after each render. `this.element` is a native
   * HTMLElement under ApplicationV2.
   *
   * @override
   */
  _onRender(context, options) {
    super._onRender(context, options);
    createImageContextMenu(this.element, ".demon-icon", this.actor);
  }

  /**
   * Execute a stat roll for the Demon. Bound as a declarative action, so `this`
   * is the sheet instance and `target` is the clicked `.rollable` element.
   *
   * @private
   * @this {CPRDemonActorSheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target - the clicked element carrying `data-roll-title`
   */
  static async #onRoll(event, target) {
    const rollName = target.dataset.rollTitle;
    const cprRoll = this.actor.createStatRoll(rollName);

    const keepRolling = await cprRoll.handleRollDialog(event, this.actor);
    if (!keepRolling) {
      return;
    }
    await cprRoll.roll();

    // output to chat
    const token = this.token === null ? null : this.token.id;
    cprRoll.entityData = { actor: this.actor.id, token };
    CPRChat.RenderRollCard(cprRoll);
  }
}
