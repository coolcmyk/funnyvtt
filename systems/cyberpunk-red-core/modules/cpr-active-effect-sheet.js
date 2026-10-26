import CPRMod from "./rolls/cpr-modifiers.js";
import CPR from "./system/config.js";
import LOGGER from "./utils/cpr-logger.js";
import SystemUtils from "./utils/cpr-systemUtils.js";

const { ActiveEffectConfig } = foundry.applications.sheets;

/**
 * Extend Foundry's ApplicationV2 ActiveEffectConfig to give CPR a friendlier
 * "Changes" tab: user-readable, category-aware modifier keys plus situational /
 * on-by-default toggles. We keep Foundry's core Details/Duration/footer parts and
 * override only the `changes` part with our own template and data.
 *
 * @extends {ActiveEffectConfig}
 */
export default class CPRActiveEffectSheet extends ActiveEffectConfig {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["cpr", "active-effect-sheet"],
    position: {
      width: 675,
      height: "auto",
    },
    window: {
      resizable: true,
    },
    actions: {
      addMod: CPRActiveEffectSheet.#onAddMod,
      deleteMod: CPRActiveEffectSheet.#onDeleteMod,
    },
  };

  /** @inheritDoc */
  static PARTS = {
    ...ActiveEffectConfig.PARTS,
    changes: {
      template: `systems/${CPR.systemId}/templates/effects/cpr-active-effect-changes.hbs`,
      scrollable: ["ol[data-changes]"],
    },
  };

  /**
   * Core's handler updates the per-row priority placeholder when a mode select
   * changes. That input only exists in Foundry's native changes grid; CPR rows
   * have no priority input, so skip it entirely (the base class adds nothing
   * else: this sheet does not use submitOnChange).
   *
   * @override
   */
  // eslint-disable-next-line class-methods-use-this
  _onChangeForm() {}

  /**
   * Build the per-change CPRMod list (with category-aware key inputs) for the
   * `changes` part. Other parts use the core context unchanged.
   *
   * @override
   * @param {string} partId
   * @param {object} context
   * @returns {Promise<object>}
   */
  async _preparePartContext(partId, context) {
    const partContext = await super._preparePartContext(partId, context);
    if (partId !== "changes") return partContext;

    // Convert Changes into CPRMods, which have a more convenient data structure.
    const modList = CPRMod.getAllModifiers([this.document], true);

    // Prepare the key input element for each Change (a select or a text input).
    modList.forEach((change, i) => {
      const name = `changes.${i}.key`;
      const selectClasses = ["key-key", "force-submit"];
      const value = change.key;
      switch (change.category) {
        case "skill": {
          const select = foundry.applications.fields.createSelectInput({
            name,
            options: CPRActiveEffectSheet.getSkillOptionConfigs(this.document),
            value,
          });
          select.classList.add(...selectClasses);
          change.keyInput = new Handlebars.SafeString(select.outerHTML);
          break;
        }
        case "custom": {
          const textInput = foundry.applications.fields.createTextInput({
            name,
            value,
          });
          textInput.classList.add("key-input", "force-submit");
          change.keyInput = new Handlebars.SafeString(textInput.outerHTML);
          break;
        }
        default: {
          const otherOptionConfigs = CPRActiveEffectSheet.getOtherOptionConfigs(
            this.document,
          );
          const select = foundry.applications.fields.createSelectInput({
            name,
            options: otherOptionConfigs[change.category],
            value,
          });
          select.classList.add(...selectClasses);
          change.keyInput = new Handlebars.SafeString(select.outerHTML);
          break;
        }
      }
    });

    partContext.modList = modList;
    return partContext;
  }

  /**
   * Wire CPR-specific change handlers that aren't expressible as declarative
   * actions (form-field changes). `this.element` is a native HTMLElement.
   *
   * @override
   */
  _onRender(context, options) {
    super._onRender(context, options);
    if (!this.isEditable) return;

    // QoL — select all text when focusing a text input.
    this.element.querySelectorAll('input[type="text"]').forEach((input) => {
      input.addEventListener("focusin", () => input.select());
    });

    // Persist key/value/mode edits (and re-render to disable already-used keys).
    this.element.querySelectorAll(".force-submit").forEach((el) => {
      el.addEventListener("change", () => this.submit());
    });

    this.element
      .querySelectorAll(".effect-key-category")
      .forEach((el) =>
        el.addEventListener("change", (event) =>
          this.#changeModKeyCategory(event),
        ),
      );

    this.element
      .querySelectorAll(".toggle-situational")
      .forEach((el) =>
        el.addEventListener("change", (event) =>
          this.#toggleSituational(event),
        ),
      );

    this.element
      .querySelectorAll(".toggle-on-by-default")
      .forEach((el) =>
        el.addEventListener("change", (event) =>
          this.#toggleOnByDefault(event),
        ),
      );
  }

  /**
   * Change the key category flag on a change, then persist. Stats cannot be
   * situational, so clear those flags when switching to the Stat category.
   *
   * @private
   * @param {Event} event
   * @returns {Promise<void>}
   */
  async #changeModKeyCategory(event) {
    const effect = this.document;
    const modnum = event.currentTarget.dataset.index;
    const keyCategory = event.target.value;

    await effect.setModKeyCategory(modnum, keyCategory);

    if (effect.getFlag(game.system.id, `changes.cats.${modnum}`) === "stat") {
      await effect.setFlag(
        game.system.id,
        `changes.situational.${modnum}.isSituational`,
        false,
      );
      await effect.setFlag(
        game.system.id,
        `changes.situational.${modnum}.onByDefault`,
        false,
      );
    }
    await this.submit();
  }

  /**
   * Toggle whether a change is situational.
   *
   * @private
   * @param {Event} event
   * @returns {Promise<void>}
   */
  async #toggleSituational(event) {
    const modnum = event.target.dataset.index;
    await this.document.setFlag(
      game.system.id,
      `changes.situational.${modnum}.isSituational`,
      event.target.checked,
    );
    await this.submit();
  }

  /**
   * Toggle whether a situational change is on by default.
   *
   * @private
   * @param {Event} event
   * @returns {Promise<void>}
   */
  async #toggleOnByDefault(event) {
    const modnum = event.target.dataset.index;
    await this.document.setFlag(
      game.system.id,
      `changes.situational.${modnum}.onByDefault`,
      event.target.checked,
    );
    await this.submit();
  }

  /**
   * Add a new change (mod) to the end of the changes array, seeding its default
   * category and situational flags. Bound as a declarative action.
   *
   * @private
   * @this {CPRActiveEffectSheet}
   * @returns {Promise<void>}
   */
  static async #onAddMod() {
    const idx = this.document.changes.length;
    LOGGER.debug(`adding change defaults for changes.${idx}`);
    const changes = this.document.toObject().changes;
    changes.push({
      key: "",
      mode: CONST.ACTIVE_EFFECT_MODES.ADD,
      value: "0",
    });
    await this.submit({
      updateData: {
        changes,
        [`flags.${game.system.id}.changes.cats.${idx}`]: "skill",
        [`flags.${game.system.id}.changes.situational.${idx}`]: {
          isSituational: false,
          onByDefault: false,
        },
      },
    });
  }

  /**
   * Delete a change (mod). When deleting from the middle of the list, collapse
   * the corresponding category/situational flags down one index so they stay
   * aligned with the changes array.
   *
   * @private
   * @this {CPRActiveEffectSheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target - the clicked control carrying `data-index`
   * @returns {Promise<void>}
   */
  static async #onDeleteMod(event, target) {
    const modnum = parseInt(target.dataset.index, 10);
    // First, delete the change itself in the AE.
    const changes = this.document.toObject().changes;
    changes.splice(modnum, 1);

    // Then, reindex the corresponding flags for the deleted change.
    const changeFlags =
      foundry.utils.getProperty(
        this.document,
        `flags.${game.system.id}.changes`,
      ) ?? {};
    const newFlags = { cats: {}, situational: {} };
    const flagArrayCats = Object.entries(changeFlags.cats ?? {});
    const flagArraySituational = Object.entries(changeFlags.situational ?? {});

    flagArrayCats.sort();
    flagArrayCats.forEach((chg) => {
      const index = Number(chg[0]);
      const category = chg[1];
      if (index < modnum) {
        newFlags.cats[String(index)] = category;
      } else if (index > modnum) {
        newFlags.cats[String(index - 1)] = category;
      }
    });

    flagArraySituational.sort();
    flagArraySituational.forEach((chg) => {
      const index = Number(chg[0]);
      const situationalSettings = chg[1];
      if (index < modnum) {
        newFlags.situational[String(index)] = situationalSettings;
      } else if (index > modnum) {
        newFlags.situational[String(index - 1)] = situationalSettings;
      }
    });

    await this.document.update({
      changes,
      [`flags.${game.system.id}.==changes`]: newFlags,
    });
  }

  /**
   * Generate a mapping of skill names and bonus object references for the AE sheet.
   *
   * @param {ActiveEffect} effect - the effect whose parent provides the skill list
   * @returns {Array<object>} sorted option configs of skill keys to names
   */
  static getSkillOptionConfigs(effect) {
    const skillMap = { ...CPR.activeEffectKeys.skill };
    const skillList = [...game.items.filter((i) => i.type === "skill")];
    if (effect.parent.documentName === "Item" && effect.parent.isOwned) {
      skillList.push(
        ...effect.parent.parent.items.filter((i) => i.type === "skill"),
      );
    } else if (effect.parent.documentName === "Actor") {
      skillList.push(...effect.parent.items.filter((i) => i.type === "skill"));
    }

    for (const skill of skillList) {
      skillMap["bonuses.".concat(SystemUtils.slugify(skill.name))] = skill.name;
    }

    const skillOptionConfigs = Object.entries(skillMap).map(([key, value]) => {
      return {
        value: key,
        label: SystemUtils.Localize(value),
        disabled: effect.changes.some((change) => change.key === key),
      };
    });

    return skillOptionConfigs.sort((a, b) => {
      return SystemUtils.Localize(a.label).localeCompare(
        game.i18n.localize(b.label),
      );
    });
  }

  /**
   * Generate configuration options for all key categories except "skill".
   *
   * @param {ActiveEffect} effect - the effect used to disable already-used keys
   * @returns {object} the configuration options keyed by category
   */
  static getOtherOptionConfigs(effect) {
    const configs = {};
    const aeKeyEntries = Object.entries(CPR.activeEffectKeys);
    aeKeyEntries.forEach(([categoryKey, data]) => {
      configs[categoryKey] = Object.entries(data).map(([effectKey, value]) => {
        return {
          value: effectKey,
          label: SystemUtils.Localize(value),
          disabled: effect.changes.some((change) => change.key === effectKey),
        };
      });
    });

    return configs;
  }
}
