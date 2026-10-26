import CPRChat from "../../chat/cpr-chat.js";
import CPR from "../../system/config.js";
import SystemUtils from "../../utils/cpr-systemUtils.js";
import createImageContextMenu from "../../utils/cpr-imageContextMenu.js";
import CPRScrollableSheetMixin from "../../utils/cpr-scrollable-sheet.js";
import { cprFormPrompt } from "../../dialog/cpr-dialog.js";

const { ActorSheetV2 } = foundry.applications.sheets;
const TextEditor = foundry.applications.ux.TextEditor.implementation;

/**
 * Implement the Black-ICE sheet, which extends ActorSheetV2 directly from Foundry. This does
 * not extend CPRActor, as there is very little overlap between Black-ICE and mooks/characters.
 *
 * @extends {ActorSheetV2}
 */
export default class CPRBlackIceActorSheet extends CPRScrollableSheetMixin(
  ActorSheetV2,
) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["blackice"],
    position: {
      width: 575,
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
      roll: CPRBlackIceActorSheet.#onRoll,
      configureFromProgram: CPRBlackIceActorSheet.#configureFromProgram,
    },
  };

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: `systems/${CPR.systemId}/templates/actor/cpr-black-ice-sheet.hbs`,
    },
  };

  /**
   * Get actor data into a more convenient organized structure for the template,
   * including the linked program's damage formula (which lives on the program,
   * not the actor).
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

    // Get data for the linked program for the Black ICE.
    // This will be helpful for displaying damage on the sheet, as it comes from the program, not the actor.
    const externalData = {
      programUUID: this.actor.token?.getFlag(game.system.id, "programUUID"),
      netrunnerTokenId: this.actor.token?.getFlag(
        game.system.id,
        "netrunnerTokenId",
      ),
      sceneId: this.actor.token?.getFlag(game.system.id, "sceneId"),
    };

    let program;
    if (externalData.netrunnerTokenId) {
      const sceneList = externalData.sceneId
        ? game.scenes.filter((s) => s.id === externalData.sceneId)
        : game.scenes;
      let netrunnerToken;
      sceneList.forEach((scene) => {
        const tokenList = scene.tokens.filter(
          (t) => t.id === externalData.netrunnerTokenId,
        );
        if (tokenList.length === 1) {
          [netrunnerToken] = tokenList;
        }
      });
      if (netrunnerToken) {
        program = netrunnerToken.actor.getOwnedItem(externalData.programUUID);
      }
    } else {
      const programList = game.items.filter(
        (i) => i.uuid === externalData.programUUID,
      );
      if (programList.length === 1) {
        [program] = programList;
      }
    }

    let damageFormula = SystemUtils.Localize(
      "CPR.global.generic.notApplicable",
    );
    if (program) {
      damageFormula =
        this.actor.system.class === "antiprogram"
          ? program.system.damage.blackIce
          : program.system.damage.standard;
    }
    context.externalData = externalData;
    context.damageFormula = damageFormula;

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
    createImageContextMenu(this.element, ".bice-icon", this.actor);
  }

  /**
   * Dispatcher that executes a roll based on the "type" datum on the clicked
   * element. Bound as a declarative action, so `this` is the sheet instance.
   *
   * @private
   * @this {CPRBlackIceActorSheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target - the clicked element carrying the roll data
   */
  static async #onRoll(event, target) {
    const { rollType, rollTitle } = target.dataset;
    let cprRoll;
    switch (rollType) {
      case "stat": {
        cprRoll = this.actor.createStatRoll(rollTitle);
        break;
      }
      case "damage": {
        cprRoll = this.actor.createDamageRoll(
          target.dataset.programUuid,
          target.dataset.netrunnerId,
          target.dataset.sceneId,
        );
        break;
      }
      default:
    }
    cprRoll.setNetCombat(this.actor.name);

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

  /**
   * Create/link a Black-ICE actor from a program Item. This is called when a user
   * rezzes Black-ICE they have in their Cyberdeck. Bound as a declarative action.
   *
   * @private
   * @this {CPRBlackIceActorSheet}
   * @returns {Promise<void>}
   */
  static async #configureFromProgram() {
    // Only configure Black ICE from a token.
    if (!this.actor.isToken) {
      SystemUtils.DisplayMessage(
        "error",
        SystemUtils.Localize("CPR.messages.linkBlackIceWithoutToken"),
      );
      return;
    }
    const biPrograms = game.items.filter(
      (i) => i.type === "program" && i.system.class === "blackice",
    );
    // Sorts the biPrograms list before 'selecting Black Ice Actor from Program' link box
    biPrograms.sort((a, b) => {
      const progA = a.name.toUpperCase();
      const progB = b.name.toUpperCase();
      if (progA < progB) {
        return -1;
      }
      if (progA > progB) {
        return 1;
      }
      return 0;
    });

    const linkedProgramUUID = this.actor.token.getFlag(
      game.system.id,
      "programUUID",
    );

    // Show "Configure Black Ice Actor From Program" prompt
    let dialogData = {
      biProgramList: biPrograms,
      programUUID: linkedProgramUUID || "unlink",
    };
    dialogData = await cprFormPrompt({
      data: dialogData,
      title: SystemUtils.Localize(
        "CPR.dialog.configureBlackIceActorFromProgram.title",
      ),
      template: `systems/${game.system.id}/templates/dialog/cpr-configure-bi-actor-from-program-prompt.hbs`,
    });
    if (!dialogData) {
      return;
    }

    const { programUUID } = dialogData;
    if (programUUID === "unlink") {
      await this.actor.token.unsetFlag(game.system.id, "programUUID");
    } else {
      const program = biPrograms.filter(
        (p) => p.uuid === dialogData.programUUID,
      )[0];
      await this.actor.update({
        name: program.name,
        img: program.img,
        "system.class": program.system.stats,
        "system.stats": {
          per: program.system.per,
          spd: program.system.spd,
          atk: program.system.atk,
          def: program.system.def,
          rez: program.system.rez,
        },
        "system.notes": program.system.description.value,
      });
      await this.actor.token.update({
        name: program.name,
        texture: {
          src: program.img,
        },
      });
      await this.actor.token.setFlag(
        game.system.id,
        "programUUID",
        program.uuid,
      );
    }
    this.render();
  }
}
