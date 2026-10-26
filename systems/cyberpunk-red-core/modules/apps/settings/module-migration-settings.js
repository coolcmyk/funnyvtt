import CPR from "../../system/config.js";
import SystemUtils from "../../utils/cpr-systemUtils.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Settings submenu (registered via game.settings.registerMenu) that lets a GM pick
 * which modules' compendia should be migrated by default. The available modules are
 * derived from game.modules at open time, so the options are built dynamically.
 */
export default class ModuleMigrationSettings extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "module-migration-config",
    classes: ["cpr"],
    tag: "form",
    position: {
      width: "auto",
      height: "auto",
    },
    window: {
      icon: "fa-solid fa-diagram-next",
      title: "CPR.settings.moduleMigrationMenu.name",
      resizable: false,
    },
    form: {
      handler: ModuleMigrationSettings.#onSubmit,
      closeOnSubmit: true,
    },
  };

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: `systems/${CPR.systemId}/templates/apps/settings/module-migration-settings.hbs`,
    },
  };

  get title() {
    return `${game.system.title}: ${SystemUtils.Localize(
      this.options.window.title,
    )}`;
  }

  /**
   * Build the data consumed by the template: the set of modules that ship relevant
   * compendia, and which of them are currently selected for default migration.
   *
   * @async
   * @override
   * @returns {Object}
   */
  // eslint-disable-next-line class-methods-use-this
  async _prepareContext() {
    const moduleIdSet = new Set(
      game.settings.get(game.system.id, "moduleMigrationIds"),
    );
    const selectedMods = Array.from(moduleIdSet);

    const modules = {};
    const compendiaTypes = ["Actor", "Item", "Scene"];

    // Gather modules with relevant compendia.
    game.modules.forEach((module) => {
      const filteredPacks = module.packs.filter((p) =>
        compendiaTypes.includes(p.type),
      );
      if (filteredPacks.size === 0) return;
      modules[module.id] = module.title;
    });

    return { selectedMods, modules };
  }

  /**
   * Persist the chosen module ids. Read the checked boxes straight from the form so
   * the result is the list of selected module ids regardless of FormDataExtended's
   * checkbox coercion.
   *
   * @this {ModuleMigrationSettings}
   * @param {SubmitEvent} _event
   * @param {HTMLFormElement} form
   */
  static async #onSubmit(_event, form) {
    const modIdList = Array.from(
      form.querySelectorAll('input[name="modIds"]:checked'),
    ).map((input) => input.value);
    await game.settings.set(game.system.id, "moduleMigrationIds", modIdList);
  }
}
