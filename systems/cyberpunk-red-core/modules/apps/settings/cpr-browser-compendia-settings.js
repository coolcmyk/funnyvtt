import CPR from "../../system/config.js";
import SystemUtils from "../../utils/cpr-systemUtils.js";
import CPRBrowserIndex from "../browser/cpr-browser-index.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM settings window listing every Item/Actor compendium (system, module, or
 * world) so the GM can choose which the document browser indexes. All compendia
 * are active by default; a pack is excluded only when explicitly unchecked.
 * System-ignored packs (CPR.browserIgnoredPacks) and internal packs are never
 * listed.
 *
 * @extends {ApplicationV2}
 */
export default class CPRBrowserCompendiaSettings extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "cpr-browser-compendia",
    classes: ["cpr"],
    tag: "form",
    position: { width: 520, height: "auto" },
    window: {
      icon: "fa-solid fa-book-open",
      title: "CPR.settings.browserCompendiaMenu.title",
      contentClasses: ["standard-form"],
      resizable: false,
    },
    form: {
      handler: CPRBrowserCompendiaSettings.#onSubmit,
      closeOnSubmit: true,
    },
  };

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: `systems/${CPR.systemId}/templates/apps/settings/cpr-browser-compendia-settings.hbs`,
    },
    footer: { template: "templates/generic/form-footer.hbs" },
  };

  /** @override */
  get title() {
    return `${game.system.title}: ${SystemUtils.Localize(
      this.options.window.title,
    )}`;
  }

  /** @inheritDoc */
  // eslint-disable-next-line class-methods-use-this
  async _prepareContext() {
    const active = game.settings.get(game.system.id, "browserActiveCompendia");
    // Source ordering: the system first, then dependent modules, then the world.
    const sourceRank = { system: 0, module: 1, world: 2 };

    // Bucket eligible Item/Actor packs into groups headed by their compendium
    // folder (falling back to the source package title when a pack has none, as
    // third-party packs may), so like-named packs are distinguishable and the
    // rows stay short.
    const groups = new Map();
    for (const pack of game.packs) {
      if (!["Item", "Actor"].includes(pack.documentName)) continue;
      if (!CPRBrowserIndex.isPackEligible(pack)) continue;
      const name =
        pack.folder?.name ?? CPRBrowserCompendiaSettings.#sourceTitle(pack);
      if (!groups.has(name)) {
        groups.set(name, {
          name,
          rank: sourceRank[pack.metadata.packageType] ?? 1,
          packs: [],
        });
      }
      groups.get(name).packs.push({
        id: pack.metadata.id,
        label: pack.metadata.label,
        active: active[pack.metadata.id] !== false,
      });
    }

    const ordered = [...groups.values()].sort(
      (a, b) => a.rank - b.rank || a.name.localeCompare(b.name),
    );
    for (const group of ordered) {
      group.packs.sort((a, b) => a.label.localeCompare(b.label));
      group.allActive = group.packs.every((pack) => pack.active);
    }

    return {
      groups: ordered,
      buttons: [
        { type: "submit", icon: "fas fa-floppy-disk", label: "SETTINGS.Save" },
      ],
    };
  }

  /**
   * Wire each group's header checkbox: toggling it enables/disables every pack
   * in that group, and a fully-disabled group collapses its pack list. The
   * header checkbox also reflects the packs' combined state (checked / unchecked
   * / indeterminate) as individual packs are toggled.
   *
   * @inheritDoc
   */

  _onRender(context, options) {
    super._onRender(context, options);
    const blocks = this.element.querySelectorAll(
      ".cpr-browser-compendia-group-block",
    );
    for (const block of blocks) {
      const groupToggle = block.querySelector(
        ".cpr-browser-compendia-group-toggle",
      );
      const packBoxes = [...block.querySelectorAll("input[data-pack-id]")];
      const sync = () => {
        const checked = packBoxes.filter((box) => box.checked).length;
        groupToggle.checked = checked === packBoxes.length;
        groupToggle.indeterminate = checked > 0 && checked < packBoxes.length;
        // Collapse the pack list when the whole group is disabled.
        block.classList.toggle(
          "cpr-browser-compendia-collapsed",
          checked === 0,
        );
      };
      sync();
      groupToggle.addEventListener("change", () => {
        packBoxes.forEach((box) => {
          box.checked = groupToggle.checked;
        });
        sync();
      });
      packBoxes.forEach((box) => box.addEventListener("change", sync));
    }
  }

  /**
   * The human-readable title of the package a pack comes from (the system, a
   * module, or the world). Used as a group header when a pack has no folder.
   *
   * @private
   * @param {CompendiumCollection} pack
   * @returns {string}
   */
  static #sourceTitle(pack) {
    const { packageType, packageName } = pack.metadata;
    if (packageType === "world") return game.world.title;
    if (packageType === "system") return game.system.title;
    return game.modules.get(packageName)?.title ?? packageName;
  }

  /**
   * Persist the active state of every listed compendium and rebuild the index
   * so disabled compendia stop appearing in the browser.
   *
   * @this {CPRBrowserCompendiaSettings}
   * @param {SubmitEvent} event
   * @param {HTMLFormElement} form
   */

  static async #onSubmit(event, form) {
    event.preventDefault();
    const active = {};
    form.querySelectorAll("input[data-pack-id]").forEach((checkbox) => {
      active[checkbox.dataset.packId] = checkbox.checked;
    });
    // Saving fires the setting's onChange, which rebuilds the index and
    // refreshes any open browser.
    await game.settings.set(game.system.id, "browserActiveCompendia", active);
    SystemUtils.DisplayMessage(
      "notify",
      SystemUtils.Localize("CPR.settings.browserCompendiaMenu.update"),
    );
  }
}
