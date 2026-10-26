import CPR from "../system/config.js";
import CPRMod from "../rolls/cpr-modifiers.js";
import SystemUtils from "../utils/cpr-systemUtils.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * The roll-verification dialog. An ApplicationV2 window that shows a roll's stat /
 * skill / modifiers, lets the user toggle situational modifiers, spend LUCK, etc.,
 * then resolves a promise with the (mutated) roll data — or with `undefined` if
 * cancelled — mirroring the old `showDialog` contract used by `handleRollDialog`.
 */
export class CPRRollDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["cpr", "dialog"],
    position: { width: 450, height: "auto" },
    window: {
      resizable: true,
      contentClasses: ["cpr-sheet-content"],
      title: "CPR.global.generic.title",
    },
    form: {
      handler: CPRRollDialog.#onChangeForm,
      submitOnChange: true,
      closeOnSubmit: false,
    },
    actions: {
      confirm: CPRRollDialog.#onConfirm,
      cancel: CPRRollDialog.#onCancel,
      toggleSituationalMod: CPRRollDialog.#onToggleSituationalMod,
      toggleShowMods: CPRRollDialog.#onToggleShowMods,
    },
  };

  /** @inheritDoc */
  static PARTS = {
    // `body` template is set per-instance in _configureRenderParts (it varies by
    // roll type via rollData.rollPrompt); this placeholder is never rendered.
    body: { template: "" },
    footer: {
      template: `systems/${CPR.systemId}/templates/dialog/rolls/cpr-roll-dialog-footer.hbs`,
    },
  };

  #resolve = null;

  #settled = false;

  /**
   * @param {CPRRoll} rollData - the roll object
   * @param {CPRActor} actor - the actor making the roll
   * @param {CPRItem} item - the item the roll came from (if any)
   * @param {object} [options]
   */
  constructor(rollData, actor, item, options = {}) {
    super(options);
    this.rollData = rollData;
    this.actor = actor;
    this.item = item;
    this.prototypeChain = SystemUtils.getPrototypeChain(rollData);
    this.defaultSituationalMods = CPRMod.getDefaultSituationalMods();
    this.showSituationalMods = true;
    this.showDefaultMods = false;
  }

  get title() {
    return this.rollData.rollTitle;
  }

  /** Render the per-roll-type prompt template as the body part. */
  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    parts.body.template = this.rollData.rollPrompt;
    return parts;
  }

  /**
   * Open the dialog and resolve with the (mutated) roll data, or `undefined` if
   * the user cancels/closes.
   *
   * @param {CPRRoll} rollData
   * @param {CPRActor} actor
   * @param {CPRItem} item
   * @returns {Promise<CPRRoll|undefined>}
   */
  static async showDialog(rollData, actor, item) {
    return new Promise((resolve) => {
      const dialog = new this(rollData, actor, item);
      dialog.#resolve = resolve;
      dialog.render(true);
    });
  }

  /** @override */
  async _prepareContext() {
    const data = {};
    data.rollData = this.rollData;
    data.actor = this.actor;
    data.prototypeChain = this.prototypeChain;

    if (this.rollData.rollCardExtraArgs.program) {
      data.programDamageSelectOptions = this.getProgramDamageSelectOptions();
    }

    if (
      !this.prototypeChain.includes("CPRDeathSaveRoll") &&
      !this.prototypeChain.includes("CPRLuckRoll")
    ) {
      data.defaultSituationalMods = this.defaultSituationalMods;
    }
    data.showDefaultMods = this.showDefaultMods;
    data.showSituationalMods = this.showSituationalMods;

    data.filteredMods = CPRMod.getSituationalRollMods(
      this.rollData,
      Array.from(this.actor.allApplicableEffects()),
      this.item,
      this.actor,
    );
    this.filteredMods = data.filteredMods;

    let totalMods = 0;
    this.rollData.mods.forEach((m) => {
      totalMods += parseInt(m.value, 10);
    });
    this.rollData.additionalMods.forEach((m) => {
      totalMods += parseInt(m, 10);
    });
    data.totalMods = totalMods;
    return data;
  }

  /**
   * Prepares the program damage select options.
   *
   * @return {Array<Object>} value/label objects for each program damage option
   */
  getProgramDamageSelectOptions() {
    const { program } = this.rollData.rollCardExtraArgs;
    const standardDamage = program.system
      ? program.system.damage.standard
      : program.damage.standard;
    const blackIceDamage = program.system
      ? program.system.damage.blackIce
      : program.damage.blackIce;
    return [
      {
        value: standardDamage,
        label: `${SystemUtils.Format("CPR.itemSheet.program.damageTo", {
          programType: SystemUtils.Localize(
            "CPR.itemSheet.program.nonBlackIce",
          ),
        })}: (${standardDamage})`,
      },
      {
        value: blackIceDamage,
        label: `${SystemUtils.Format("CPR.itemSheet.program.damageTo", {
          programType: SystemUtils.Localize("CPR.itemSheet.program.blackIce"),
        })}: (${blackIceDamage})`,
      },
    ];
  }

  /**
   * Wire interactions that aren't simple click actions: the aimed-shot checkbox.
   *
   * @override
   */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element
      .querySelectorAll(".aimed-checkbox")
      .forEach((el) =>
        el.addEventListener("change", () => this._aimedToggle()),
      );
  }

  /**
   * Merge changed form fields into the roll data. Replaces the V1 _updateObject;
   * parses the user-entered additional modifiers into an array of numbers.
   *
   * @this {CPRRollDialog}
   * @param {Event} event
   * @param {HTMLFormElement} form
   * @param {FormDataExtended} formData
   */
  static #onChangeForm(event, form, formData) {
    const fd = foundry.utils.expandObject(formData.object);
    if (typeof fd.additionalMods === "string") {
      // Replace all spaces/commas and then split into an array at each comma.
      let mods = fd.additionalMods.replace(/ +/g, ",").replace(/,+/g, ",");
      mods = mods.split(",");
      if (mods.some((m) => m !== "" && isNaN(m))) {
        SystemUtils.DisplayMessage(
          "warn",
          "CPR.rolls.modifiers.additionalModWarning",
        );
      }
      fd.additionalMods = mods.filter((m) => m !== "" && !isNaN(m)).map(Number);
    }
    foundry.utils.mergeObject(this.rollData, fd);
    this.render();
  }

  /**
   * When the aimed-shot checkbox is toggled, update the roll location immediately
   * (the form may not have re-submitted before the user presses OK).
   *
   * @private
   */
  _aimedToggle() {
    this.rollData.location = this.rollData.isAimed ? "body" : "head";
  }

  /**
   * Add/remove a situational modifier, then re-render to recompute totals.
   *
   * @private
   * @this {CPRRollDialog}
   * @param {PointerEvent} event
   * @param {HTMLElement} target - the clicked element carrying `data-mod-id`
   */
  static #onToggleSituationalMod(event, target) {
    const id = target.dataset.modId;
    const mod =
      this.filteredMods.find((m) => m.id === id) ||
      this.defaultSituationalMods.find((m) => m.id === id);

    if (this.rollData.mods.some((m) => m.id === id)) {
      this.rollData.removeMod(id);
    } else {
      this.rollData.addMod([mod]);
    }
    this.render();
  }

  /**
   * Toggle visibility of the situational or default modifier lists.
   *
   * @private
   * @this {CPRRollDialog}
   * @param {PointerEvent} event
   * @param {HTMLElement} target - the clicked element carrying `data-target`
   */
  static #onToggleShowMods(event, target) {
    if (target.dataset.target === "situational-mods") {
      this.showSituationalMods = !this.showSituationalMods;
    } else {
      this.showDefaultMods = !this.showDefaultMods;
    }
    this.render();
  }

  /**
   * Confirm the roll. Blocks when the requested LUCK exceeds the actor's pool
   * (warns and keeps the dialog open), otherwise resolves with the roll data.
   *
   * @private
   * @this {CPRRollDialog}
   */
  static async #onConfirm() {
    const availableLuck = this.actor?.system?.stats?.luck?.value ?? 0;
    const luckInput = this.element.querySelector('[name="luck"]');
    const requestedLuck = Number(luckInput?.value ?? this.rollData.luck);
    if (Number.isFinite(requestedLuck) && requestedLuck > availableLuck) {
      SystemUtils.DisplayMessage(
        "warn",
        SystemUtils.Localize("CPR.rolls.luckExceedsAvailable"),
      );
      return;
    }
    this.#settled = true;
    this.#resolve?.(this.rollData);
    this.close();
  }

  /**
   * Cancel the roll.
   *
   * @private
   * @this {CPRRollDialog}
   */
  static #onCancel() {
    this.#settled = true;
    this.#resolve?.(undefined);
    this.close();
  }

  /** Resolve with undefined if the window is closed without confirming. */
  _onClose(options) {
    super._onClose(options);
    if (!this.#settled) {
      this.#resolve?.(undefined);
    }
  }
}

/**
 * Variant of the roll dialog for Role abilities, which can use a "varying" skill
 * the user picks from a drop-down (changing the skill and its modifiers live).
 *
 * @extends {CPRRollDialog}
 */
export class CPRRoleRollDialog extends CPRRollDialog {
  /** @override */
  async _prepareContext() {
    const data = await super._prepareContext();

    const skillIsVarying =
      this.item.system.skill === "varying" ||
      this.item.system.abilities.find((a) => a.name === this.rollData.roleName)
        ?.skill === "varying";

    if (skillIsVarying) {
      data.isVarying = true;
      if (this.rollData.skillName === "varying") {
        const firstSkill = this.rollData.skillList.sort((a, b) =>
          a.name > b.name ? 1 : -1,
        )[0];
        data.rollData.skillName = firstSkill.name;
        data.rollData.skillValue = firstSkill.system.level;
        data.rollData.statName = firstSkill.system.stat;
        data.rollData.statValue = this.actor.getStat(this.rollData.statName);
      }
    }
    return data;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element
      .querySelectorAll(".skill-list-select")
      .forEach((el) =>
        el.addEventListener("change", (event) => this._updateSkillValue(event)),
      );
  }

  /**
   * Update the skill value (and its modifiers) when the varied skill changes.
   *
   * @private
   * @param {Event} event
   */
  _updateSkillValue(event) {
    const skill = this.rollData.skillList.find(
      (s) => s.name === event.currentTarget.value,
    );

    this.rollData.skillValue = skill.system.level;
    this.rollData.statName = skill.system.stat;
    this.rollData.statValue = this.actor.getStat(this.rollData.statName);

    const effects = Array.from(this.actor.allApplicableEffects());
    const allMods = CPRMod.getAllModifiers(effects);
    const newSkillMods = CPRMod.getRelevantMods(allMods, [
      SystemUtils.slugify(event.currentTarget.value),
      `${SystemUtils.slugify(event.currentTarget.value)}Hearing`,
      `${SystemUtils.slugify(event.currentTarget.value)}Sight`,
    ]);
    const previousSkillMods = CPRMod.getRelevantMods(allMods, [
      SystemUtils.slugify(this.rollData.skillName),
      `${SystemUtils.slugify(this.rollData.skillName)}Hearing`,
      `${SystemUtils.slugify(this.rollData.skillName)}Sight`,
    ]);

    if (newSkillMods) {
      newSkillMods.forEach((m) => {
        if (!m.isSituational) {
          this.rollData.addMod([m]);
        } else if (m.isSituational && m.onByDefault) {
          this.rollData.addMod([m]);
          this.filteredMods.push(m);
        } else {
          this.filteredMods.push(m);
        }
      });
    }

    if (previousSkillMods) {
      previousSkillMods.forEach((previousMod) => {
        if (this.rollData.mods.some((cur) => previousMod.id === cur.id)) {
          this.rollData.removeMod(previousMod.id);
        }
        if (this.filteredMods.some((cur) => previousMod.id === cur.id)) {
          const modIndex = this.filteredMods.findIndex(
            (cur) => previousMod.id === cur.id,
          );
          this.filteredMods.splice(modIndex, 1);
        }
      });
    }
    this.render();
  }
}
