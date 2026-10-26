import LOGGER from "../../utils/cpr-logger.js";
import CPR from "../../system/config.js";
import { CPRRoll } from "../../rolls/cpr-rolls.js";
import SystemUtils from "../../utils/cpr-systemUtils.js";
import CPRSheetUtils from "../../utils/SheetUtils.js";
import CPRScrollableSheetMixin from "../../utils/cpr-scrollable-sheet.js";
import selectRoleBonuses from "../../dialog/cpr-select-role-bonuses-prompt.js";
import createImageContextMenu from "../../utils/cpr-imageContextMenu.js";
import { cprConfirm, cprFormPrompt } from "../../dialog/cpr-dialog.js";
import RoleAbilitySchema from "../../datamodels/item/components/role-ability-schema.js";
import { ContainerUtils } from "../mixins/cpr-container.js";
import { applyUpgradeValue } from "../mixins/cpr-upgradable.js";
import { buildItemChips, buildItemBreadcrumb } from "../item-chips.js";

const { ItemSheetV2 } = foundry.applications.sheets;
const { Tabs } = foundry.applications.ux;
const TextEditor = foundry.applications.ux.TextEditor.implementation;

/**
 * Extend the basic ItemSheet.
 * @extends {ItemSheet}
 */

export default class CPRItemSheet extends CPRScrollableSheetMixin(ItemSheetV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["cpr", "item"],
    position: {
      width: 715,
      height: 400,
    },
    window: {
      resizable: true,
      contentClasses: ["cpr-sheet-content"],
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
  };

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: `systems/${CPR.systemId}/templates/item/cpr-item-sheet.hbs`,
      scrollable: [".item-bottom-content-section"],
    },
  };

  /**
   * Add the per-type class to the sheet root (item CSS keys off `.item.weapon`,
   * `.item.role`, etc.).
   *
   * @override
   * @param {object} options
   * @returns {object}
   */
  _initializeApplicationOptions(options) {
    const applied = super._initializeApplicationOptions(options);
    const type = options.document?.type;
    if (type) applied.classes.push(type);
    return applied;
  }

  /** @override */
  get isEditable() {
    return this.#readOnly ? false : super.isEditable;
  }

  /** @override */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    if (options.editable === false) this.#readOnly = true;
    else if (options.editable === true) this.#readOnly = false;
  }

  /** @override */
  async _prepareContext(options) {
    const foundryData = await super._prepareContext(options);
    foundryData.item = this.item;
    foundryData.system = this.item.system;
    foundryData.owner = this.item.isOwner;
    foundryData.editable = this.isEditable;
    // Precompute the read-only source display: the first book-having source is
    // shown inline in the header, the rest go into a hover tooltip. Blank
    // entries (e.g. a freshly added row) never contribute. Mirrors the document
    // browser's header rows.
    foundryData.sourceDisplay = SystemUtils.FormatSourceDisplay(
      this.item.system.sources,
    );
    const cprData = {};
    cprData.isGM = game.user.isGM;
    const itemType = foundryData.item.type;
    const mixins = SystemUtils.getMixins(itemType);
    if (itemType === "role" || mixins.includes("attackable")) {
      // relativeSkills and relativeAmmo will be other items relevant to this one.
      // For owned objects, the item list will come from the character owner
      // For unowned objects, the item list will come from the core list of objects
      if (foundryData.item.isOwned && this.item.actor.type !== "container") {
        cprData.relativeSkills = this.item.actor.itemTypes.skill;
        cprData.relativeAmmo = this.item.actor.itemTypes.ammo;
      } else {
        const coreSkills = await SystemUtils.GetCoreSkills();
        const worldSkills = game.items.filter((i) => i.type === "skill");
        cprData.relativeSkills = coreSkills.concat(worldSkills);
      }
    }

    if (mixins.includes("attackable")) {
      cprData.dvTableNames = await CPRItemSheet._getWeaponDVSelectOptions();
      cprData.weaponSkillSelectOptions =
        CPRItemSheet._getWeaponSkillSelectOptions(cprData.relativeSkills);
    }

    if (mixins.includes("effects")) {
      cprData.effectNames = this.item.getEffectNames();
      cprData.effectNames.push({
        label: SystemUtils.Localize("CPR.itemSheet.effects.none"),
        value: "none",
      });

      cprData.allowedUsages =
        this.item.system.allowedUsage &&
        this.item.system.allowedUsage.map((use) => {
          return {
            value: use,
            label: CPR.effectUses[use],
          };
        });
    }

    if (itemType === "itemUpgrade") {
      const { upgradableSelectOptions, upgradableSheetData } =
        CPRItemSheet._getItemUpgradeData(this.item);
      cprData.upgradableTypes = upgradableSelectOptions;
      cprData.upgradableDataPoints = upgradableSheetData;
    }

    if (itemType === "role") {
      const selectOptions = CPRItemSheet._getRoleSelectOptions(
        cprData.relativeSkills,
      );
      cprData.selectOptions = selectOptions;
    }

    // Enrich the description so that links to foundry documents in item descriptions have proper functionality.
    foundryData.enrichedHTMLDescription = await TextEditor.enrichHTML(
      foundryData.item.system.description.value,
      { async: true },
    );

    // Read-only header: a Type/subtype breadcrumb and a row of stat chips. All
    // editing lives on the Settings tab; the header only displays. Chip stat
    // values reflect installed upgrades for actor-owned upgraded items, exactly
    // as the (now-removed) description sidebar did (see `_getChipSystem`). The
    // header is drawn by the shared `cpr-item-header-body` partial (also used by
    // the document browser rows), so everything it needs is precomputed here
    // into a plain, document-free view-model.
    //
    // Each breadcrumb segment dims 15% more than the one before (segment 0 =
    // full strength). The shared builder returns a plain string[]; only the
    // header wants the per-segment opacity, so the map lives here.
    const { item } = this;
    const market = item.system.price?.market;
    // Price is shown for any valuable-mixin type (matching the old
    // `cprHasTemplate item.type "valuable"` gate), even at 0eb. The label and
    // category reuse the exact helpers the browser rows use, so both consumers
    // feed the partial identically ("5,000eb (Expensive)").
    const hasPrice = SystemUtils.hasMixin(item.type, "valuable");
    foundryData.headerBody = {
      img: item.img,
      editImg: true,
      statusUpgraded: item.system.isUpgraded,
      statusInstalled: item.system.isInstalled,
      // Mirror the old `localize (cprGetLocalizedlNameKey item)`: the helper
      // returns a localization key (or the raw name when none), which Localize
      // then resolves.
      name: SystemUtils.Localize(
        Handlebars.helpers.cprGetLocalizedlNameKey(item),
      ),
      debugId: game.settings.get(game.system.id, "debugElements")
        ? item.id
        : null,
      breadcrumb: buildItemBreadcrumb({
        type: item.type,
        system: item.system,
      }).map((label, index) => ({
        label,
        opacity: Math.max(0, 1 - 0.15 * index),
      })),
      // The sheet's leading Type segment links to the wiki; the browser omits
      // this (its rows open on click) by leaving wikiType null.
      wikiType: item.type,
      hasPrice,
      priceLabel: hasPrice
        ? SystemUtils.Format("CPR.browser.price.amount", {
            amount: Handlebars.helpers.cprNumberFormat(market, { hash: {} }),
          })
        : "",
      priceCategoryLabel: hasPrice
        ? (CPR.itemPriceCategory[
            Handlebars.helpers.cprGetPriceCategory(market)
          ] ?? "")
        : "",
      chips: buildItemChips({
        type: item.type,
        system: this._getChipSystem(),
      }),
      source: foundryData.sourceDisplay.source,
      sourceTooltip: foundryData.sourceDisplay.sourceTooltip,
    };

    return { ...foundryData, ...cprData };
  }

  /**
   * `dataPoint` -> the dot-path of the `system` stat it modifies. These mirror
   * the exact `cprApplyUpgrade item <value> <dataPoint>` calls that lived in the
   * old per-type/per-mixin description partials, so upgrade-adjusted chip values
   * match what the description sidebar used to show.
   */
  static #UPGRADE_ADJUSTED_FIELDS = {
    headSp: "headLocation.sp",
    bodySp: "bodyLocation.sp",
    shieldHp: "shieldHitPoints.max",
    seats: "seats",
    sdp: "sdp",
    speedCombat: "speedCombat",
    rof: "rof",
    damage: "damage",
    attackmod: "attackmod",
    magazine: "magazine.max",
    slots: "installedItems.slots",
  };

  /**
   * Build the `system` object handed to `buildItemChips`. For actor-owned,
   * upgraded items the upgradable stat fields are adjusted to reflect installed
   * upgrades (matching the old description sidebar). World/compendium items and
   * un-upgraded items show base values, so the live `system` is returned as-is.
   *
   * @returns {object} the item's `system`, or an upgrade-adjusted shallow clone
   */
  _getChipSystem() {
    const baseSystem = this.item.system;
    const isActorUpgraded =
      this.item.isOwned &&
      this.item.actor?.type !== "container" &&
      baseSystem.isUpgraded;
    if (!isActorUpgraded) return baseSystem;

    // Shallow clone so we never mutate the live document; nested containers on
    // an adjusted path are cloned lazily below.
    const chipSystem = { ...baseSystem };
    for (const [dataPoint, path] of Object.entries(
      CPRItemSheet.#UPGRADE_ADJUSTED_FIELDS,
    )) {
      if (!foundry.utils.hasProperty(baseSystem, path)) continue;
      const baseValue = foundry.utils.getProperty(baseSystem, path);
      const adjustedValue = this._applyUpgrade(baseValue, dataPoint);
      if (adjustedValue === baseValue) continue;

      const parts = path.split(".");
      let cursor = chipSystem;
      for (let i = 0; i < parts.length - 1; i += 1) {
        cursor[parts[i]] = { ...cursor[parts[i]] };
        cursor = cursor[parts[i]];
      }
      cursor[parts[parts.length - 1]] = adjustedValue;
    }
    return chipSystem;
  }

  /**
   * Apply this item's installed upgrades to a base stat value, sharing the exact
   * modifier/override semantics used by the `cprApplyUpgrade` Handlebars helper
   * (see `applyUpgradeValue`).
   *
   * @param {number|string} baseValue - the un-upgraded stat value
   * @param {string} dataPoint - the upgrade data point key
   * @returns {number|string} the upgrade-adjusted value
   */
  _applyUpgrade(baseValue, dataPoint) {
    return applyUpgradeValue(
      baseValue,
      this.item.getTotalUpgradeValues(dataPoint),
    );
  }

  /**
   * Retrieves the options for selecting DV tables in weapon settings.
   *
   * @return {Array} The options for selecting DV tables for weapons.
   */
  static async _getWeaponDVSelectOptions() {
    const dvTablesNames = (await SystemUtils.GetDvTables()).map((t) => {
      return { value: t.name, label: t.name };
    });
    return [
      {
        value: "",
        label: SystemUtils.Localize("CPR.global.generic.notApplicable"),
      },
      ...dvTablesNames,
    ];
  }

  /**
   * Generates the options for the weapon skill select element.
   *
   * @param {Array<CPRSkill>} skillList - The list of skills.
   * @return {Array} The options for the weapon skill select element.
   */
  static _getWeaponSkillSelectOptions(skillsList) {
    const options = [];

    Object.entries(CPR.skillCategoriesForWeapons).forEach(([k, v]) => {
      const optionGroup = SystemUtils.Localize(v);

      const skillByCategory = skillsList.filter((s) => k === s.system.category);

      skillByCategory.forEach((s) => {
        options.push({
          value: s.name,
          label: s.name,
          group: optionGroup,
        });
      });
    });

    return options;
  }

  /**
   * Generates the options for the role select element.
   *
   * @param {Array<CPRSkill>} skillList - The list of skills.
   * @return {Object} The options for the role select element.
   */
  static _getRoleSelectOptions(skillList, { includeMultiplier = false } = {}) {
    // Prepare Option Groups for Select Element.
    const optionGroups = {
      specialOptions: SystemUtils.Localize(
        "CPR.dialog.createEditRoleAbility.specialOptions",
      ),
      list: SystemUtils.Localize("CPR.dialog.createEditRoleAbility.skillList"),
    };
    // Prepare Skill options for Select Element.
    const skillOptions = [
      ...Object.entries(CPR.roleSpecialOptions).map(([k, v]) => {
        return {
          value: k,
          label: SystemUtils.Localize(v),
          group: optionGroups.specialOptions,
        };
      }),
      ...skillList.map((s) => {
        return {
          value: s.name,
          label: s.name,
          group: optionGroups.list,
        };
      }),
    ];
    // Prepare Stat options for Select Element.
    const statOptions = [
      {
        value: "--",
        label: SystemUtils.Localize("CPR.global.generic.notApplicable"),
        group: optionGroups.specialOptions,
      },
      ...Object.entries(CPR.statList).map(([k, v]) => {
        return {
          value: k,
          label: SystemUtils.Localize(v),
          group: optionGroups.list,
        };
      }),
    ];

    const selectOptions = {
      statOptions,
      skillOptions,
    };

    if (includeMultiplier) {
      // Prepare multiplier options for Select element.
      const multiplierOptions = [0.25, 0.5, 1, 2].map((v) => {
        return { value: v };
      });
      selectOptions.multiplierOptions = multiplierOptions;
    }

    return selectOptions;
  }

  /**
   * Retrieves data for item upgrades, and prepares it for display in the template.
   *
   * @return {Object} Item upgrade data for the template.
   */
  static _getItemUpgradeData(item) {
    const upgradableTypes = SystemUtils.getDocTypesFromMixin("upgradable");
    const upgradableSelectOptions = upgradableTypes.map((type) => {
      return {
        value: type,
        label: CPR.objectTypes[type],
      };
    });
    const upgradeType = item.system.type;
    const upgradableConfigData = CPR.upgradableDataPoints[upgradeType];
    const dataPointModTypes =
      CPR.upgradableDataPoints.upgradeConfig.configurableTypes;
    const upgradableSheetData = [];
    for (const [key, value] of Object.entries(upgradableConfigData)) {
      // Omit this datapoint if its type is not "modifier" or "override".
      const omitDataPoint = !Object.keys(dataPointModTypes).includes(
        value.type,
      );
      if (omitDataPoint) continue;

      const modData = item.system.modifiers[key];
      const dataPoint = {
        key,
        localization: value.localization,
        selectOptions: foundry.utils.duplicate(dataPointModTypes),
        modData,
        disableSituational: typeof value.isSituational === "undefined",
        // A freshly-created upgrade has no data for its type's modifiers yet
        // (the schema fields are optional), so modData can be undefined here.
        disableOnByDefault: !modData?.isSituational,
      };

      if (upgradeType === "clothing") delete dataPoint.selectOptions.override;

      upgradableSheetData.push(dataPoint);
    }

    return { upgradableSelectOptions, upgradableSheetData };
  }

  /* -------------------------------------------- */
  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;

    // Bind the (custom-markup) tab controller; preserve the active tab across renders.
    new Tabs({
      navSelector: ".navtabs-item",
      contentSelector: ".item-bottom-content-section",
      initial: this.#activeTab,
      callback: (event, tabs, active) => {
        this.#activeTab = active;
      },
    }).bind(root);

    // Size the item-type chips (e.g. in container contents) to their widest
    // content, once layout settles. See CPRActorSheet._onRender.
    window.requestAnimationFrame(() => {
      CPRSheetUtils.setCssClassWidth(this.element, ".type-tag");
    });

    if (!this.isEditable) return;

    const on = (selector, evt, handler) =>
      root
        .querySelectorAll(selector)
        .forEach((el) => el.addEventListener(evt, handler));

    // Select all text when focusing a text input.
    root
      .querySelectorAll('input[type="text"]')
      .forEach((input) =>
        input.addEventListener("focusin", () => input.select()),
      );

    on(".item-checkbox", "click", (event) => this._itemCheckboxToggle(event));
    on(".item-multi-option", "click", (event) => this._itemMultiOption(event));
    on(".source-action", "click", (event) => this._sourceAction(event));
    on(".select-compatible-ammo", "click", () => this._selectCompatibleAmmo());
    on(".netarch-level-action", "click", (event) =>
      this._netarchLevelAction(event),
    );
    on(".netarch-roll-level", "click", () => this._netarchGenerateFromTables());
    on(".role-ability-action", "click", (event) =>
      this._roleAbilityAction(event),
    );
    on(".select-role-bonuses", "click", (event) =>
      this._selectRoleBonuses(event),
    );
    on(".manage-installed-programs", "click", () =>
      this._manageInstalledItems("program"),
    );
    on(".manage-installed-upgrades", "click", () =>
      this._manageInstalledItems("itemUpgrade"),
    );
    on(".manage-installed-items", "click", () => this._manageInstalledItems());
    on(".uninstall-single-item", "click", (event) =>
      this._uninstallSingleItem(event),
    );
    on(".item-view", "click", (event) => this._renderReadOnlyItemCard(event));
    on(".manage-installable-types", "click", (event) =>
      this._manageInstallableTypes(event),
    );
    on(".netarch-generate-auto", "click", () => {
      if (game.user.isGM) {
        this.item._generateNetarchScene();
      } else {
        SystemUtils.DisplayMessage(
          "error",
          SystemUtils.Localize("CPR.netArchitecture.generation.noGMError"),
        );
      }
    });
    on(".netarch-generate-custom", "click", () => {
      if (game.user.isGM) {
        this.item._customize();
      } else {
        SystemUtils.DisplayMessage(
          "error",
          SystemUtils.Localize("CPR.netArchitecture.generation.noGMError"),
        );
      }
    });
    on(".netarch-item-link", "click", (event) => this._openItemFromId(event));

    // Active Effects listener
    on(".effect-control", "click", (event) => this.item.manageEffects(event));

    // Change things when the "usage" for active effects changes
    on(".set-usage", "change", (event) => this._setUsage(event));

    // Set up right click context menu when clicking on Item's image
    this._createItemImageContextMenu(root);
  }

  /** @override */
  _onClose(options) {
    super._onClose(options);
    this.#readOnly = false;
  }

  #activeTab = "item-description";
  #readOnly = false;

  /*
  INTERNAL METHODS BELOW HERE
  */

  async _sourceAction(event) {
    event.preventDefault();
    const actionType = SystemUtils.GetEventDatum(event, "data-action-type");
    const sources = foundry.utils.duplicate(this.item.system.sources ?? []);
    if (actionType === "create") {
      sources.push({ book: "", page: 0 });
    } else if (actionType === "delete") {
      const index = Number(SystemUtils.GetEventDatum(event, "data-index"));
      const label = SystemUtils.FormatSources([sources[index] ?? {}]);
      const message = label
        ? SystemUtils.Format("CPR.itemSheet.common.source.deleteConfirm", {
            source: label,
          })
        : SystemUtils.Localize(
            "CPR.itemSheet.common.source.deleteConfirmBlank",
          );
      const confirmed = await cprConfirm(message, {
        title: SystemUtils.Localize("CPR.itemSheet.common.source.delete"),
      });
      if (!confirmed) return undefined;
      sources.splice(index, 1);
    }
    return this.item.update({ "system.sources": sources });
  }

  _itemCheckboxToggle(event) {
    const cprItem = foundry.utils.duplicate(this.item);
    const target = SystemUtils.GetEventDatum(event, "data-target");
    const value = !foundry.utils.getProperty(cprItem, target);
    if (target === "system.concealable.concealable") {
      this.item.setConcealable(value);
    } else if (foundry.utils.hasProperty(cprItem, target)) {
      foundry.utils.setProperty(cprItem, target, value);
      this.item.update(cprItem);
      LOGGER.log(`Item ${this.item.id} ${target} set to ${value}`);
    }
  }

  async _itemMultiOption(event) {
    const cprItem = foundry.utils.duplicate(this.item);
    // the target the option wants to be put into
    const target =
      event.currentTarget.closest(".item-multi-select").dataset.target;
    const value = SystemUtils.GetEventDatum(event, "data-value");
    if (foundry.utils.hasProperty(cprItem, target)) {
      const prop = foundry.utils.getProperty(cprItem, target);
      if (prop.includes(value)) {
        prop.splice(prop.indexOf(value), 1);
      } else {
        prop.push(value);
      }
      foundry.utils.setProperty(cprItem, target, prop);
      this.item.update(cprItem);
    }
  }

  async _selectCompatibleAmmo() {
    const cprItemData = this.item.system;
    let formData = {
      header: SystemUtils.Format(
        "CPR.dialog.selectCompatibleAmmo.selectCompatibleAmmo",
        {
          name: this.item.name,
        },
      ),
      selectedAmmo: cprItemData.ammoVariety,
    };
    // Show "Select Compatible Ammo" prompt.
    formData = await cprFormPrompt({
      data: formData,
      title: SystemUtils.Localize("CPR.dialog.selectCompatibleAmmo.title"),
      template: `systems/${game.system.id}/templates/dialog/cpr-select-compatible-ammo-prompt.hbs`,
    });
    if (!formData) {
      return;
    }
    if (formData.selectedAmmo) {
      const filteredSelectedAmmo = formData.selectedAmmo.filter((a) => a);
      await this.item.setCompatibleAmmo(filteredSelectedAmmo);
    }
  }

  /**
   * This function creates and processes the dialog to apply bonuses from roles.
   *
   * @param {*} event
   */
  async _selectRoleBonuses(event) {
    const cprRoleData = foundry.utils.duplicate(this.item.system);
    const roleType = SystemUtils.GetEventDatum(event, "data-role-type"); // Either "mainRole" or "subRole".
    const coreSkills = await SystemUtils.GetCoreSkills(); // Get core skills.
    const customSkills = game.items.filter((i) => i.type === "skill"); // Get any custom skills.
    // If object is owned, get all skills on actor. If not, get all skills in system.
    const allSkills = this.item.isOwned
      ? this.actor.itemTypes.skill
      : coreSkills
          .concat(customSkills)
          .sort((a, b) => (a.name > b.name ? 1 : -1));
    const sortedAllSkills = SystemUtils.SortItemListByName(allSkills); // Sort these skills by name.

    // If we are editing a subability, get name from event data. Then, get the subrole from the name.
    const subRoleName = SystemUtils.GetEventDatum(event, "data-ability-name");
    const subRole = cprRoleData.abilities.find((a) => a.name === subRoleName);

    // The ability data is either item.system or item.system.someSubAbility.
    let abilityData = cprRoleData;
    if (subRole) {
      abilityData = subRole;
    }

    // Prepare relevant data for the dialog to use.
    let dialogData = {
      skillList: sortedAllSkills,
      roleData: abilityData,
    };

    // Call dialog and await results. Return if dialog is cancelled.
    dialogData = await selectRoleBonuses(dialogData);
    if (!dialogData) {
      return;
    }

    // If we are updating the main role ability, we can update item.system.
    // Else, find the correct subability and update that.
    if (roleType === "mainRole") {
      this.item.update({ system: dialogData.roleData });
    } else {
      foundry.utils.mergeObject(
        cprRoleData.abilities.find((a) => a.name === subRole.name),
        dialogData.subRole,
      );
      this.item.update({ "system.abilities": cprRoleData.abilities });
    }
  }

  async _netarchGenerateFromTables() {
    // Show "Netarch Rolltable Generation" Prompt.
    const formData = await cprFormPrompt({
      data: {},
      title: SystemUtils.Localize(
        "CPR.dialog.netArchitectureRolltableSelection.title",
      ),
      template: `systems/${game.system.id}/templates/dialog/cpr-netarch-rolltable-generation-prompt.hbs`,
    });
    if (!formData) {
      return;
    }
    const tableSetting = game.settings.get(
      game.system.id,
      "netArchRollTableCompendium",
    );
    const lobby = await SystemUtils.GetCompendiumDoc(
      tableSetting,
      "First Two Floors (The Lobby)",
    );
    const other = await SystemUtils.GetCompendiumDoc(
      tableSetting,
      "All Other Floors (".concat(formData.difficulty.capitalize(), ")"),
    );
    const numberOfFloorsRoll = CPRRoll.create(
      SystemUtils.Localize("CPR.rolls.roll"),
      "3d6",
    );
    await numberOfFloorsRoll.roll();
    const numberOfFloors = numberOfFloorsRoll.resultTotal;
    const branchCheck = CPRRoll.create(
      SystemUtils.Localize("CPR.rolls.roll"),
      "1d10",
    );
    await branchCheck.roll();
    let branchCounter = 0;
    while (branchCheck.initialRoll >= 7) {
      branchCounter += 1;
      if (branchCounter > 7) {
        break;
      }
      await branchCheck.roll();
    }
    let floors = await this._netarchDrawFromTableCustom(lobby, 2);
    if (numberOfFloors > 2) {
      floors = floors.concat(
        await this._netarchDrawFromTableCustom(other, numberOfFloors - 2),
      );
    }
    const prop = [];
    let index = 0;
    let floorIndex = 1;
    let minfloorIndexbranch = 3;
    let branch = "a";
    floors.forEach((floor) => {
      let content = "CPR.global.programClass.blackice";
      if (floor.results[0].text.match("^Password")) {
        content = "CPR.netArchitecture.floor.options.password";
      }
      if (floor.results[0].text.match("^File")) {
        content = "CPR.netArchitecture.floor.options.file";
      }
      if (floor.results[0].text.match("^Control Node")) {
        content = "CPR.netArchitecture.floor.options.controlnode";
      }
      let dv = "N/A";
      const dvRegex = /DV([0-9]+)/g;
      const match = dvRegex.exec(floor.results[0].text);
      if (match !== null && match.length > 1) {
        [, dv] = match;
      }
      let blackice = "--";
      if (content.match("blackice")) {
        switch (floor.results[0].text) {
          case "Asp":
            blackice = "CPR.netArchitecture.floor.options.blackIce.asp";
            break;
          case "Giant":
            blackice = "CPR.netArchitecture.floor.options.blackIce.giant";
            break;
          case "Hellhound":
            blackice = "CPR.netArchitecture.floor.options.blackIce.hellhound";
            break;
          case "Kraken":
            blackice = "CPR.netArchitecture.floor.options.blackIce.kraken";
            break;
          case "Liche":
            blackice = "CPR.netArchitecture.floor.options.blackIce.liche";
            break;
          case "Raven":
            blackice = "CPR.netArchitecture.floor.options.blackIce.raven";
            break;
          case "Scorpion":
            blackice = "CPR.netArchitecture.floor.options.blackIce.scorpion";
            break;
          case "Skunk":
            blackice = "CPR.netArchitecture.floor.options.blackIce.skunk";
            break;
          case "Wisp":
            blackice = "CPR.netArchitecture.floor.options.blackIce.wisp";
            break;
          case "Dragon":
            blackice = "CPR.netArchitecture.floor.options.blackIce.dragon";
            break;
          case "Killer":
            blackice = "CPR.netArchitecture.floor.options.blackIce.killer";
            break;
          case "Sabertooth":
            blackice = "CPR.netArchitecture.floor.options.blackIce.sabertooth";
            break;
          default:
            break;
        }
      }
      if (
        branchCounter > 0 &&
        floorIndex > minfloorIndexbranch &&
        floorIndex > numberOfFloors / (branchCounter + 1) &&
        index !== numberOfFloors - 1
      ) {
        floorIndex = minfloorIndexbranch;
        minfloorIndexbranch += 1;
        branch = String.fromCharCode(branch.charCodeAt() + 1);
        branchCounter -= 1;
      }
      prop.push({
        index,
        floor: floorIndex.toString(),
        branch,
        dv,
        content,
        blackice,
        description: "Roll ".concat(
          floor.roll.total.toString(),
          ": ",
          floor.results[0].text,
        ),
      });
      index += 1;
      floorIndex += 1;
    });
    const cprItemData = foundry.utils.duplicate(this.item.system);
    foundry.utils.setProperty(cprItemData, "floors", prop);
    this.item.update({ system: cprItemData });
  }

  // eslint-disable-next-line class-methods-use-this
  async _netarchDrawFromTableCustom(table, number) {
    let abortCounter = 0;
    const drawDuplicatesRegex = "^File|^Control Node";
    const drawnNumbers = [];
    const drawnResults = [];
    while (drawnResults.length < number) {
      const res = await table.draw({ displayChat: false });
      if (!drawnNumbers.includes(res.roll.total)) {
        if (!res.results[0].text.match(drawDuplicatesRegex)) {
          drawnNumbers.push(res.roll.total);
        }
        drawnResults.push(res);
      }
      abortCounter += 1;
      if (abortCounter > 1000) {
        break;
      }
    }
    return drawnResults;
  }

  async _netarchLevelAction(event) {
    const target = Number(
      SystemUtils.GetEventDatum(event, "data-action-target"),
    );
    const action = SystemUtils.GetEventDatum(event, "data-action-type");
    const cprItemData = foundry.utils.duplicate(this.item.system);

    if (action === "delete") {
      const setting = game.settings.get(
        game.system.id,
        "deleteItemConfirmation",
      );
      if (setting) {
        const dialogMessage = `${SystemUtils.Localize(
          "CPR.dialog.deleteConfirmation.message",
        )} ${SystemUtils.Localize(
          "CPR.netArchitecture.floor.deleteConfirmation",
        )}?`;

        // Show confirmation dialog.
        const confirmDelete = await cprConfirm(dialogMessage, {
          title: SystemUtils.Localize("CPR.dialog.deleteConfirmation.title"),
        });
        if (!confirmDelete) {
          return;
        }
      }
      if (foundry.utils.hasProperty(cprItemData, "floors")) {
        const prop = foundry.utils.getProperty(cprItemData, "floors");
        let deleteElement = null;
        prop.forEach((floor) => {
          if (floor.index === target) {
            deleteElement = floor;
          }
        });
        prop.splice(prop.indexOf(deleteElement), 1);
        foundry.utils.setProperty(cprItemData, "floors", prop);
        this.item.update({ system: cprItemData });
      }
    }

    if (action === "up" || action === "down") {
      if (foundry.utils.hasProperty(cprItemData, "floors")) {
        const prop = foundry.utils.getProperty(cprItemData, "floors");
        const indices = [];
        prop.forEach((floor) => {
          indices.push(floor.index);
        });
        let swapPartner = null;
        if (action === "up") {
          swapPartner = Math.min(...indices);
        } else {
          swapPartner = Math.max(...indices);
        }
        if (target !== swapPartner) {
          if (action === "up") {
            indices.forEach((i) => {
              if (i < target && i > swapPartner) {
                swapPartner = i;
              }
            });
          } else {
            indices.forEach((i) => {
              if (i > target && i < swapPartner) {
                swapPartner = i;
              }
            });
          }
          let element1 = null;
          let element2 = null;
          prop.forEach((floor) => {
            if (floor.index === target) {
              element1 = floor;
            }
          });
          prop.forEach((floor) => {
            if (floor.index === swapPartner) {
              element2 = floor;
            }
          });
          const newElement1 = foundry.utils.duplicate(element1);
          const newElement2 = foundry.utils.duplicate(element2);
          prop.splice(prop.indexOf(element1), 1);
          prop.splice(prop.indexOf(element2), 1);
          newElement1.index = swapPartner;
          newElement2.index = target;
          prop.push(newElement1);
          prop.push(newElement2);
          foundry.utils.setProperty(cprItemData, "floors", prop);
          this.item.update({ system: cprItemData });
        }
      }
    }

    if (action === "create") {
      let formData = {
        floornumbers: [
          "1",
          "2",
          "3",
          "4",
          "5",
          "6",
          "7",
          "8",
          "9",
          "10",
          "11",
          "12",
          "13",
          "14",
          "15",
          "16",
          "17",
          "18",
        ],
        branchlabels: ["a", "b", "c", "d", "e", "f", "g", "h"],
        dvoptions: [
          "N/A",
          "4",
          "5",
          "6",
          "7",
          "8",
          "9",
          "10",
          "11",
          "12",
          "13",
          "14",
          "15",
          "16",
          "17",
          "18",
          "19",
          "20",
        ],
        contentoptions: {
          "CPR.netArchitecture.floor.options.password": SystemUtils.Localize(
            "CPR.netArchitecture.floor.options.password",
          ),
          "CPR.netArchitecture.floor.options.file": SystemUtils.Localize(
            "CPR.netArchitecture.floor.options.file",
          ),
          "CPR.netArchitecture.floor.options.controlnode": SystemUtils.Localize(
            "CPR.netArchitecture.floor.options.controlnode",
          ),
          "CPR.global.programClass.blackice": SystemUtils.Localize(
            "CPR.global.programClass.blackice",
          ),
        },
        blackiceoptions: {
          "--": "--",
          "CPR.netArchitecture.floor.options.blackIce.asp":
            SystemUtils.Localize(
              "CPR.netArchitecture.floor.options.blackIce.asp",
            ),
          "CPR.netArchitecture.floor.options.blackIce.giant":
            SystemUtils.Localize(
              "CPR.netArchitecture.floor.options.blackIce.giant",
            ),
          "CPR.netArchitecture.floor.options.blackIce.hellhound":
            SystemUtils.Localize(
              "CPR.netArchitecture.floor.options.blackIce.hellhound",
            ),
          "CPR.netArchitecture.floor.options.blackIce.kraken":
            SystemUtils.Localize(
              "CPR.netArchitecture.floor.options.blackIce.kraken",
            ),
          "CPR.netArchitecture.floor.options.blackIce.liche":
            SystemUtils.Localize(
              "CPR.netArchitecture.floor.options.blackIce.liche",
            ),
          "CPR.netArchitecture.floor.options.blackIce.raven":
            SystemUtils.Localize(
              "CPR.netArchitecture.floor.options.blackIce.raven",
            ),
          "CPR.netArchitecture.floor.options.blackIce.scorpion":
            SystemUtils.Localize(
              "CPR.netArchitecture.floor.options.blackIce.scorpion",
            ),
          "CPR.netArchitecture.floor.options.blackIce.skunk":
            SystemUtils.Localize(
              "CPR.netArchitecture.floor.options.blackIce.skunk",
            ),
          "CPR.netArchitecture.floor.options.blackIce.wisp":
            SystemUtils.Localize(
              "CPR.netArchitecture.floor.options.blackIce.wisp",
            ),
          "CPR.netArchitecture.floor.options.blackIce.dragon":
            SystemUtils.Localize(
              "CPR.netArchitecture.floor.options.blackIce.dragon",
            ),
          "CPR.netArchitecture.floor.options.blackIce.killer":
            SystemUtils.Localize(
              "CPR.netArchitecture.floor.options.blackIce.killer",
            ),
          "CPR.netArchitecture.floor.options.blackIce.sabertooth":
            SystemUtils.Localize(
              "CPR.netArchitecture.floor.options.blackIce.sabertooth",
            ),
        },
        floor: "1",
        branch: "a",
        dv: "N/A",
        content: "CPR.netArchitecture.floor.options.password",
        blackice: "--",
        description: "",
        returnType: "string",
      };
      // Show "NetArch Level" dialog.
      formData = await cprFormPrompt({
        data: formData,
        title: SystemUtils.Localize("CPR.dialog.netArchitectureNewFloor.title"),
        template: `systems/${game.system.id}/templates/dialog/cpr-netarch-level-prompt.hbs`,
        width: "330px",
      });
      if (!formData) {
        return;
      }

      if (foundry.utils.hasProperty(cprItemData, "floors")) {
        const prop = foundry.utils.getProperty(cprItemData, "floors");
        let maxIndex = -1;
        prop.forEach((floor) => {
          if (floor.index > maxIndex) {
            maxIndex = floor.index;
          }
        });
        prop.push({
          index: maxIndex + 1,
          floor: formData.floor,
          branch: formData.branch,
          dv: formData.dv,
          content: formData.content,
          blackice: formData.blackice,
          description: formData.description,
        });
        foundry.utils.setProperty(cprItemData, "floors", prop);
        this.item.update({ system: cprItemData });
      } else {
        const prop = [
          {
            index: 0,
            floor: formData.floor,
            branch: formData.branch,
            dv: formData.dv,
            content: formData.content,
            blackice: formData.blackice,
            description: formData.description,
          },
        ];
        foundry.utils.setProperty(cprItemData, "floors", prop);
        this.item.update({ system: cprItemData });
      }
    }

    if (action === "edit") {
      if (foundry.utils.hasProperty(cprItemData, "floors")) {
        const prop = foundry.utils.getProperty(cprItemData, "floors");
        let editElement = null;
        prop.forEach((floor) => {
          if (floor.index === target) {
            editElement = floor;
          }
        });
        let formData = {
          floornumbers: [
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "10",
            "11",
            "12",
            "13",
            "14",
            "15",
            "16",
            "17",
            "18",
          ],
          branchlabels: ["a", "b", "c", "d", "e", "f", "g", "h"],
          dvoptions: [
            "N/A",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "10",
            "11",
            "12",
            "13",
            "14",
            "15",
            "16",
            "17",
            "18",
            "19",
            "20",
          ],
          contentoptions: {
            "CPR.netArchitecture.floor.options.password": SystemUtils.Localize(
              "CPR.netArchitecture.floor.options.password",
            ),
            "CPR.netArchitecture.floor.options.file": SystemUtils.Localize(
              "CPR.netArchitecture.floor.options.file",
            ),
            "CPR.netArchitecture.floor.options.controlnode":
              SystemUtils.Localize(
                "CPR.netArchitecture.floor.options.controlnode",
              ),
            "CPR.global.programClass.blackice": SystemUtils.Localize(
              "CPR.global.programClass.blackice",
            ),
          },
          blackiceoptions: {
            "--": "--",
            "CPR.netArchitecture.floor.options.blackIce.asp":
              SystemUtils.Localize(
                "CPR.netArchitecture.floor.options.blackIce.asp",
              ),
            "CPR.netArchitecture.floor.options.blackIce.giant":
              SystemUtils.Localize(
                "CPR.netArchitecture.floor.options.blackIce.giant",
              ),
            "CPR.netArchitecture.floor.options.blackIce.hellhound":
              SystemUtils.Localize(
                "CPR.netArchitecture.floor.options.blackIce.hellhound",
              ),
            "CPR.netArchitecture.floor.options.blackIce.kraken":
              SystemUtils.Localize(
                "CPR.netArchitecture.floor.options.blackIce.kraken",
              ),
            "CPR.netArchitecture.floor.options.blackIce.liche":
              SystemUtils.Localize(
                "CPR.netArchitecture.floor.options.blackIce.liche",
              ),
            "CPR.netArchitecture.floor.options.blackIce.raven":
              SystemUtils.Localize(
                "CPR.netArchitecture.floor.options.blackIce.raven",
              ),
            "CPR.netArchitecture.floor.options.blackIce.scorpion":
              SystemUtils.Localize(
                "CPR.netArchitecture.floor.options.blackIce.scorpion",
              ),
            "CPR.netArchitecture.floor.options.blackIce.skunk":
              SystemUtils.Localize(
                "CPR.netArchitecture.floor.options.blackIce.skunk",
              ),
            "CPR.netArchitecture.floor.options.blackIce.wisp":
              SystemUtils.Localize(
                "CPR.netArchitecture.floor.options.blackIce.wisp",
              ),
            "CPR.netArchitecture.floor.options.blackIce.dragon":
              SystemUtils.Localize(
                "CPR.netArchitecture.floor.options.blackIce.dragon",
              ),
            "CPR.netArchitecture.floor.options.blackIce.killer":
              SystemUtils.Localize(
                "CPR.netArchitecture.floor.options.blackIce.killer",
              ),
            "CPR.netArchitecture.floor.options.blackIce.sabertooth":
              SystemUtils.Localize(
                "CPR.netArchitecture.floor.options.blackIce.sabertooth",
              ),
          },
          floor: editElement.floor,
          branch: editElement.branch,
          dv: editElement.dv,
          content: editElement.content,
          blackice: editElement.blackice,
          description: editElement.description,
          returnType: "string",
        };

        // Show "NetArch Level" dialog.
        formData = await cprFormPrompt({
          data: formData,
          title: SystemUtils.Localize(
            "CPR.dialog.netArchitectureNewFloor.title",
          ),
          template: `systems/${game.system.id}/templates/dialog/cpr-netarch-level-prompt.hbs`,
        });
        if (!formData) {
          return;
        }

        prop.splice(prop.indexOf(editElement), 1);
        prop.push({
          index: editElement.index,
          floor: formData.floor,
          branch: formData.branch,
          dv: formData.dv,
          content: formData.content,
          blackice: formData.blackice,
          description: formData.description,
        });
        foundry.utils.setProperty(cprItemData, "floors", prop);
        this.item.update({ system: cprItemData });
      }
    }
  }

  // eslint-disable-next-line class-methods-use-this
  _openItemFromId(event) {
    const itemId = SystemUtils.GetEventDatum(event, "data-item-id");
    const itemEntity = game.items.get(itemId);
    if (itemEntity !== null) {
      itemEntity.sheet.render(true);
    } else {
      SystemUtils.DisplayMessage(
        "error",
        SystemUtils.Format("CPR.messages.itemDoesNotExistError", {
          itemid: itemId,
        }),
      );
    }
  }

  // Installed Item Code

  async _manageInstalledItems(itemType) {
    const { item } = this;

    const promptResult = await this._selectInstallableItems(itemType);

    if (Object.keys(promptResult).length === 0) {
      return;
    }

    if (promptResult.uninstallItemList.length > 0) {
      await item.uninstallItems(promptResult.uninstallItemList);
    }

    if (promptResult.installItemList.length > 0) {
      await item.installItems(promptResult.installItemList);
    }
  }

  async _uninstallSingleItem(event) {
    // Warn/disallow user if trying to uninstall from items in a pack.
    if (this.item.pack)
      return SystemUtils.DisplayMessage(
        "warn",
        SystemUtils.Localize("CPR.messages.warningCannotModifyInstalledInPack"),
      );
    const installedItemId = SystemUtils.GetEventDatum(event, "data-item-id");
    const actor = this.item.isEmbedded ? this.item.actor : null;
    const installedItem = actor
      ? actor.getOwnedItem(installedItemId)
      : game.items.get(installedItemId);
    return installedItem.uninstall();
  }

  async _roleAbilityAction(event) {
    const index = SystemUtils.GetEventDatum(event, "data-index");
    const action = SystemUtils.GetEventDatum(event, "data-action-type");

    const cprItemData = foundry.utils.duplicate(this.item.system);
    const { abilities } = cprItemData;

    const coreSkills = await SystemUtils.GetCoreSkills();
    const customSkills = game.items.filter((i) => i.type === "skill");
    const allSkills = this.item.isOwned
      ? this.actor.itemTypes.skill
      : coreSkills
          .concat(customSkills)
          .sort((a, b) => (a.name > b.name ? 1 : -1));

    const selectOptions = CPRItemSheet._getRoleSelectOptions(allSkills, {
      includeMultiplier: true,
    });

    let formData = {
      ...new RoleAbilitySchema(),
      ...selectOptions,
    };
    if (action === "create") {
      // Show "Role Ability" dialog.
      formData = await cprFormPrompt({
        data: formData,
        title: SystemUtils.Localize("CPR.dialog.createEditRoleAbility.title"),
        template: `systems/${game.system.id}/templates/dialog/cpr-role-ability-prompt.hbs`,
      });
      if (!formData) {
        return;
      }

      const skillObject =
        formData.skill !== "--" && formData.skill !== "varying"
          ? allSkills.find((a) => a.name === formData.skill)
          : formData.skill === "varying"
            ? "varying"
            : "--";
      formData.skill = skillObject;
      abilities.push(formData);
    }

    if (action === "delete") {
      const setting = game.settings.get(
        game.system.id,
        "deleteItemConfirmation",
      );
      if (setting) {
        const dialogMessage = `${SystemUtils.Localize(
          "CPR.dialog.deleteConfirmation.message",
        )} ${SystemUtils.Localize("CPR.itemSheet.role.deleteConfirmation")}?`;

        // Show confirmation dialog.
        const confirmDelete = await cprConfirm(dialogMessage, {
          title: SystemUtils.Localize("CPR.dialog.deleteConfirmation.title"),
        });
        if (!confirmDelete) {
          return;
        }
      }
      abilities.splice(index, 1);
    }

    if (action === "edit") {
      const abilityData = abilities[index];
      const abilityDataSkill =
        abilityData.skill !== "--" && abilityData.skill !== "varying"
          ? abilityData.skill.name
          : abilityData.skill;
      formData = {
        ...abilityData,
        ...selectOptions,
        skill: abilityDataSkill,
      };

      // Show "Role Ability" dialog.
      formData = await cprFormPrompt({
        data: formData,
        title: SystemUtils.Localize("CPR.dialog.createEditRoleAbility.title"),
        template: `systems/${game.system.id}/templates/dialog/cpr-role-ability-prompt.hbs`,
      });
      if (!formData) {
        return;
      }

      const skillObject =
        formData.skill !== "--" && formData.skill !== "varying"
          ? allSkills.find((a) => a.name === formData.skill)
          : formData.skill === "varying"
            ? "varying"
            : "--";
      formData.skill = skillObject;
      abilities.splice(
        index,
        1,
        foundry.utils.mergeObject(abilityData, formData),
      );
    }
    const sortedAbilities = abilities.sort((a, b) =>
      a.name > b.name ? -1 : 1,
    );
    foundry.utils.setProperty(cprItemData, "abilities", sortedAbilities);
    this.item.update({ system: cprItemData });
  }

  /**
   * Get an array of the objects installed in this Item. An optional
   * string parameter may be passed to filter the return list by a
   * specific Item type.
   *
   * @param {String} - Type of item to filter for.
   * @returns {Object} - { uninstallItemList (Array of CPRItems),
   *                       installItemList (Array of CPRItems) }
   */
  async _selectInstallableItems(itemType = false) {
    const installTarget = this.item;
    const actor = installTarget.isOwned ? installTarget.actor : false;
    // Items that *can* be installed, but might not be currently.
    const installableItems = installTarget
      .getInstallableItems(itemType)
      .filter((i) => {
        // You cannot install something into itself. Get outta here ouroboros.
        if (i.id === installTarget.id) return false;

        // You cannot install something that is installed in something else, but...
        // ...you *can* uninstall things that are already installed in this item.
        if (
          i.system.isInstalled &&
          i.system.installedIn[0] !== installTarget.id
        ) {
          return false;
        }

        switch (i.type) {
          case "ammo":
            // Ammo should really only be loaded from the change-ammo dialog, for now.
            // This limits the amount of ammo installed in an item to one.
            // Only allow uninstalling ammo from this dialog.
            if (installTarget.system.loadedAmmo?.id !== i.id) return false;
            break;
          case "cyberware":
            // Only allow installation of correct cyberware
            if (
              installTarget.system.type !== i.system.type ||
              i.system.isFoundational
            ) {
              return false;
            }
            break;

          default:
            break;
        }

        return true;
      });
    // Items that are currently installed.
    const installedItems = installTarget.getInstalledItems(itemType);

    // Get total slots.
    const availableSlots = installTarget.availableInstallSlots();
    const totalSlots =
      availableSlots + installTarget.system.installedItems.usedSlots;

    // For organizing the list by type in the dialog template.
    const typeList = [];
    for (const item of installableItems) {
      if (!typeList.includes(item.type)) {
        typeList.push(item.type);
      }
    }

    // Create a readable title and header.
    const dialogItemType = itemType
      ? SystemUtils.Localize(CPR.objectTypes[itemType])
      : SystemUtils.Localize("CPR.global.generic.item");

    const dialogPromptTitle = `${SystemUtils.Format(
      "CPR.dialog.selectInstallableItems.title",
      { type: dialogItemType },
    )}
    | ${SystemUtils.Localize("CPR.global.generic.item")} ${SystemUtils.Localize(
      "CPR.global.generic.slots",
    )}: ${totalSlots}`;

    const dialogPromptText =
      installableItems.length > 0
        ? SystemUtils.Format("CPR.dialog.selectInstallableItems.text", {
            type: dialogItemType,
            target: installTarget.name,
          })
        : `${SystemUtils.Format("CPR.dialog.selectInstallableItems.noOptions", {
            target: installTarget.name,
          })}`;

    // Prepare the form data.
    let formData = {
      target: installTarget,
      header: dialogPromptText,
      typeList,
      itemsList: installableItems,
      selectedItems: installedItems.map((i) => i.id),
      itemType: dialogItemType,
    };

    // Show "Select Install Items" prompt.
    formData = await cprFormPrompt({
      data: formData,
      title: dialogPromptTitle,
      template: `systems/${game.system.id}/templates/dialog/cpr-select-install-items-prompt.hbs`,
    });
    if (!formData) {
      return {};
    }

    // filteredSelectedItems must be an array because of the methods we use on it later.
    // formData.selectedItems, however, is sometimes a string and sometimes null.
    // It is a string when there is only one option, and that option is selected (installed).
    // It is null when there is only one option, and that option is deselected (uninsatlled)
    // The following creates an array out of formData.selectedItems, accounting for all cases (hopefully).
    let filteredSelectedItems = []; // If formData.selectedItems is null, this variable will remain an empty array.
    if (typeof formData.selectedItems === "string") {
      // If formData.selectedItems is a string, put it in an array.
      filteredSelectedItems = [formData.selectedItems]; //
    } else if (formData.selectedItems) {
      // Else, make sure it isn't null. If not, it's already an array -> filter against null entries.
      filteredSelectedItems = formData.selectedItems.filter((i) => i);
    }

    // Final list of uninstalled items.
    const uninstallItemList = [];
    // Push to the list if it was installed, but isn't anymore.
    installedItems.forEach((item) => {
      if (!filteredSelectedItems.includes(item._id)) {
        uninstallItemList.push(item);
      }
    });

    // Final list of installed items.
    const installItemList = [];
    // Push to the list if it wasn't installed, but is now.
    filteredSelectedItems.forEach((itemId) => {
      if (installedItems.filter((item) => item._id === itemId).length === 0) {
        const installedItem = !actor
          ? game.items.get(itemId)
          : actor.getOwnedItem(itemId);
        installItemList.push(installedItem);
      }
    });

    const promptResult = {
      uninstallItemList,
      installItemList,
    };

    return promptResult;
  }

  /**
   * Render an item sheet in read-only mode, which is used on installed cyberware. This is to
   * prevent a user from editing data while it is installed, such as the foundation type.
   *
   * @private
   * @callback
   * @param {Object} event - object capturing event data (what was clicked and where?)
   */
  _renderReadOnlyItemCard(event) {
    const itemId = SystemUtils.GetEventDatum(event, "data-item-id");
    let item = this.item.isEmbedded
      ? this.actor.items.find((i) => i._id === itemId)
      : game.items.get(itemId);

    // If this item is in a pack, its installed items don't actually exist,
    // except as stored data in `flags.cprInstallTree`. Thus, we find the correct
    // piece of itemData in this install tree and create an ephermeral item so we can
    // render its sheet.
    if (this.item.pack) {
      const flattenedTree = this.item.flattenInstallTree(
        ContainerUtils.getInstallTreeFlag(this.item),
      );
      const itemData = flattenedTree.find((i) => i._id === itemId);
      item = new CONFIG.Item.documentClass(itemData); // Create ephemeral item.
    }
    item.sheet.render(true, { editable: false });
  }

  /**
   * Sets up a ContextMenu that appears when the Item's image is right clicked.
   * Enables the user to share the image with other players.
   *
   * @param {Object} html - The DOM object
   * @returns {ContextMenu} The created ContextMenu
   */
  _createItemImageContextMenu(html) {
    return createImageContextMenu(html, ".item-image-block", this.item);
  }

  async _manageInstallableTypes() {
    // Show "Manage Installable Types" prompt.
    const formData = await cprFormPrompt({
      data: { selectedTypes: this.item.system.installedItems.allowedTypes },
      title: SystemUtils.Localize("CPR.dialog.manageItemTypes.title"),
      template: `systems/${game.system.id}/templates/dialog/cpr-manage-installable-types-prompt.hbs`,
    });
    if (!formData) {
      return;
    }
    const allowedTypes = formData.selectedTypes.filter((t) => t);

    if (allowedTypes.length === 0 && this.item.system.hasInstalled) {
      SystemUtils.DisplayMessage(
        "error",
        "CPR.messages.hasInstalledItemsOfRemovedType",
      );
      return;
    }
    await this.item.update({
      "system.installedItems.allowedTypes": allowedTypes,
    });
  }

  /**
   * See item._setUsage for details
   *
   * @param {Object} event
   */
  async _setUsage(event) {
    this.item._setUsage(event.target.value);
  }
}
