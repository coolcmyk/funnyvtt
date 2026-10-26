import CPR from "../system/config.js";
import SystemUtils from "../utils/cpr-systemUtils.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * The "Homebrew Rules" settings window, opened from the homebrewSettingsMenu button in system
 * settings. It holds optional, non-RAW rule toggles — currently JonJon's Luck Roll — keeping them out
 * of the main settings panel so they read as a distinct, opt-in group.
 */
export default class CPRHomebrewSettings extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "homebrew-config",
    classes: ["cpr"],
    tag: "form",
    position: {
      width: 540,
      height: "auto",
    },
    window: {
      icon: "fa-solid fa-flask",
      contentClasses: ["standard-form"],
      title: "CPR.settings.homebrewMenu.title",
      resizable: false,
    },
    form: {
      handler: CPRHomebrewSettings.#onSubmit,
      closeOnSubmit: true,
    },
  };

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: `systems/${CPR.systemId}/templates/apps/homebrew-settings.hbs`,
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
   * Build the template context: the current values of the homebrew settings plus the choice map for the
   * Luck Roll variant select and the standard save button.
   *
   * @async
   * @override
   * @param {Object} options
   * @returns {Object}
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.luckRollEnabled = game.settings.get(
      game.system.id,
      "homebrewLuckRoll",
    );
    context.luckRollVariant = game.settings.get(
      game.system.id,
      "homebrewLuckRollVariant",
    );
    context.variantChoices = {
      max: "CPR.settings.homebrewLuckRollVariant.max",
      current: "CPR.settings.homebrewLuckRollVariant.current",
    };
    context.buttons = [
      { type: "submit", icon: "fas fa-floppy-disk", label: "SETTINGS.Save" },
    ];
    return context;
  }

  /**
   * Persist the homebrew settings from the submitted form.
   *
   * @this {CPRHomebrewSettings}
   * @param {SubmitEvent} event
   * @param {HTMLFormElement} form
   * @param {FormDataExtended} formData
   */
  static async #onSubmit(event, form, formData) {
    event.preventDefault();

    const formObject = formData.object;
    await game.settings.set(
      game.system.id,
      "homebrewLuckRoll",
      formObject.homebrewLuckRoll,
    );
    await game.settings.set(
      game.system.id,
      "homebrewLuckRollVariant",
      formObject.homebrewLuckRollVariant,
    );

    SystemUtils.DisplayMessage(
      "notify",
      SystemUtils.Localize("CPR.settings.homebrewMenu.update"),
    );
  }
}
