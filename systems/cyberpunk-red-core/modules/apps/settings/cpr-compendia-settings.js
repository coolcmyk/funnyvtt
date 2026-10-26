import CPR from "../../system/config.js";
import SystemUtils from "../../utils/cpr-systemUtils.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Defines behaviors for a window that pops up when the Config Compendia button in
 * system settings is clicked. We go this route because the options available are
 * based on content in game.packs, but game.packs is not defined when settings are
 * configured. So we have present options dynamically when a button is clicked.
 */
export default class CPRCompendiaSettings extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "compendia-config",
    classes: ["cpr"],
    tag: "form",
    position: {
      width: 540,
      height: "auto",
    },
    window: {
      icon: "fa-solid fa-book",
      contentClasses: ["standard-form"],
      title: "CPR.settings.compendiumMenu.title",
      resizable: false,
    },
    form: {
      handler: CPRCompendiaSettings.#onSubmit,
      closeOnSubmit: true,
    },
  };

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: `systems/${CPR.systemId}/templates/apps/settings/compendia-settings.hbs`,
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  get title() {
    return `${game.system.title}: ${SystemUtils.Localize(
      this.options.window.title,
    )}`;
  }

  /**
   * When this application (read: form window) is launched, create the data object that is
   * consumed by the handle bars template to present options to the user. This populates
   * the select menu, and looks like this: {settingValue: humanReadableString}
   *
   * @async
   * @override
   * @param {Object} options (unused here)
   * @returns {Object}
   */
  // eslint-disable-next-line class-methods-use-this
  async _prepareContext() {
    const critCurr = await game.settings.get(
      game.system.id,
      "criticalInjuryRollTableCompendium",
    );
    const netCurr = await game.settings.get(
      game.system.id,
      "netArchRollTableCompendium",
    );
    const dvCurr = await game.settings.get(
      game.system.id,
      "dvRollTableCompendium",
    );
    const choicesCrit = {
      [CPR.defaultCriticalInjuryTable]:
        "CPR.settings.criticalInjuryRollTableCompendium.default",
    };
    const choicesNet = {
      [CPR.defaultNetArchTable]:
        "CPR.settings.netArchRollTableCompendium.default",
    };
    const choicesDv = {
      [CPR.defaultDvTable]: "CPR.settings.dvRollTableCompendium.default",
    };
    const comps = SystemUtils.GetCompendiaByType("world", "RollTable");
    for (const comp of comps) {
      choicesCrit[`world.${comp.metadata.name}`] = comp.metadata.label;
      choicesNet[`world.${comp.metadata.name}`] = comp.metadata.label;
      choicesDv[`world.${comp.metadata.name}`] = comp.metadata.label;
    }
    return {
      choicesCrit,
      choicesNet,
      choicesDv,
      critCurr,
      netCurr,
      dvCurr,
      buttons: [
        { type: "submit", icon: "fas fa-floppy-disk", label: "SETTINGS.Save" },
      ],
    };
  }

  /**
   * Handle form submission
   * @this {CPRCompendiaSettings}
   * @param {SubmitEvent} event
   * @param {HTMLFormElement} form
   * @param {FormDataExtended} formData
   */
  static async #onSubmit(event, form, formData) {
    event.preventDefault();

    const formObject = formData.object;
    await game.settings.set(
      game.system.id,
      "criticalInjuryRollTableCompendium",
      formObject.injuryChoice,
    );
    await game.settings.set(
      game.system.id,
      "netArchRollTableCompendium",
      formObject.netArchChoice,
    );
    await game.settings.set(
      game.system.id,
      "dvRollTableCompendium",
      formObject.dvChoice,
    );

    SystemUtils.DisplayMessage(
      "notify",
      SystemUtils.Localize("CPR.settings.compendiumMenu.update"),
    );
  }
}
