import CPR from "../system/config.js";
import SystemUtils from "../utils/cpr-systemUtils.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } =
  foundry.applications.api;

// Localization key per ledger property, kept as literals so the unused-string
// CI check can find them (they were previously built by string concatenation).
const LEDGER_NAMES = {
  wealth: "CPR.ledger.wealth",
  improvementpoints: "CPR.ledger.improvementpoints",
  reputation: "CPR.ledger.reputation",
};

/**
 * A persistent window (ApplicationV2) to display and modify an actor's ledger
 * property (wealth / improvement points / reputation): a running total, add /
 * subtract / set controls, and a transaction history the GM can prune.
 *
 * @extends {ApplicationV2}
 */
export default class CPRLedger extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["cpr", "ledger"],
    // The ledger is a fixed-layout window (total + edit controls + a scrolling
    // transaction history), not a content-sized sheet, so it needs a real height
    // for its grid to fill; it remains resizable.
    position: {
      width: 600,
      height: 400,
    },
    window: {
      resizable: true,
      contentClasses: ["cpr-sheet-content"],
    },
    actions: {
      add: CPRLedger.#onModify,
      subtract: CPRLedger.#onModify,
      set: CPRLedger.#onModify,
      deleteLine: CPRLedger.#onDeleteLine,
    },
  };

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: `systems/${CPR.systemId}/templates/dialog/cpr-ledger-form.hbs`,
    },
  };

  /**
   * @param {CPRActor} actor - the actor whose ledger is shown
   * @param {string} propName - "wealth", "improvementPoints", or "reputation"
   * @param {object} [options]
   */
  constructor(actor, propName, options = {}) {
    super(options);
    this.actor = actor;
    this.propName = propName;
    this.total = actor.system[propName].value;
    this.ledgername = LEDGER_NAMES[propName.toLowerCase()];
    this.contents = actor.listRecords(propName);
    this._makeLedgerReadable();
  }

  get title() {
    return SystemUtils.Format("CPR.ledger.title", {
      property: SystemUtils.Localize(this.ledgername),
    });
  }

  /**
   * Open a ledger window for an actor's property.
   *
   * @param {CPRActor} actor
   * @param {string} propName
   * @returns {Promise<CPRLedger>}
   */
  static showDialog(actor, propName) {
    return new CPRLedger(actor, propName).render(true);
  }

  /** @override */
  async _prepareContext() {
    return {
      total: this.total,
      ledgername: this.ledgername,
      contents: this.contents,
      isGM: game.user.isGM,
    };
  }

  /**
   * Apply an add / subtract / set change to the actor's ledger. Bound as a
   * declarative action; the action name (`add`/`subtract`/`set`) is the operation.
   *
   * @private
   * @this {CPRLedger}
   * @param {PointerEvent} event
   * @param {HTMLElement} target - the clicked control carrying `data-action`
   */
  static async #onModify(event, target) {
    const ledgerProp = this.propName;
    const action = target.dataset.action;
    const valueInput = this.element.querySelector('[name="modifyValue"]');
    const reason = this.element.querySelector('[name="reason"]')?.value ?? "";
    const raw = valueInput?.value ?? "";

    if (raw === "") {
      SystemUtils.DisplayMessage(
        "warn",
        SystemUtils.Localize("CPR.messages.eurobucksModifyWarn"),
      );
      return;
    }

    const value = parseInt(raw, 10);
    if (Number.isNaN(value)) {
      SystemUtils.DisplayMessage(
        "error",
        SystemUtils.Localize("CPR.messages.eurobucksModifyInvalidAction"),
      );
      return;
    }

    const note = `${reason} - ${game.user.name}`;
    switch (action) {
      case "add":
        this.actor.sheet._gainLedger(ledgerProp, value, note);
        this.total += value;
        break;
      case "subtract":
        this.actor.sheet._loseLedger(ledgerProp, value, note);
        // Mirror _loseLedger: a negative input is treated as an addition.
        this.total += value <= 0 ? value : -value;
        break;
      case "set":
        this.actor.sheet._setLedger(ledgerProp, value, note);
        this.total = value;
        break;
      default:
        return;
    }

    this.contents = foundry.utils.duplicate(this.actor.listRecords(ledgerProp));
    this._makeLedgerReadable();
    this.render();
  }

  /**
   * Delete a single ledger line (GM only), optionally adjusting the total.
   * Shows a four-way prompt: delete and add back / delete and subtract / delete
   * only / cancel.
   *
   * @private
   * @this {CPRLedger}
   * @param {PointerEvent} event
   * @param {HTMLElement} target - the clicked control carrying `data-line`
   */
  static async #onDeleteLine(event, target) {
    const lineId = target.dataset.line;
    this.contents = foundry.utils.duplicate(
      this.actor.listRecords(this.propName),
    );
    let numbers = this.contents[lineId][0].match(/\d+/g);
    if (numbers === null) {
      numbers = ["NaN"];
    }

    const content = await foundry.applications.handlebars.renderTemplate(
      `systems/${CPR.systemId}/templates/dialog/cpr-ledger-deletion-prompt.hbs`,
      {
        transaction: this.contents[lineId][0],
        reason: this.contents[lineId][1],
        value: numbers[0],
      },
    );

    const rawChoice = await DialogV2.wait({
      window: {
        title: SystemUtils.Localize("CPR.dialog.ledgerDeletion.title"),
      },
      classes: ["cpr", "cpr-dialog"],
      content,
      buttons: [
        {
          action: "yesAdd",
          icon: "fas fa-check",
          label: SystemUtils.Localize("CPR.dialog.ledgerDeletion.yesAdd"),
          callback: () => ({ action: true, sign: 1 }),
        },
        {
          action: "yesSubtract",
          icon: "fas fa-check",
          label: SystemUtils.Localize("CPR.dialog.ledgerDeletion.yesSubtract"),
          callback: () => ({ action: true, sign: -1 }),
        },
        {
          action: "no",
          icon: "fas fa-xmark",
          label: SystemUtils.Localize("CPR.dialog.common.no"),
          callback: () => ({ action: false }),
        },
        {
          action: "cancel",
          icon: "fas fa-xmark",
          label: SystemUtils.Localize("CPR.dialog.common.cancel"),
        },
      ],
      rejectClose: false,
    });
    // A clicked button without a callback resolves to its action identifier, so
    // Cancel arrives as the string "cancel" rather than null.
    const choice = rawChoice === "cancel" ? null : (rawChoice ?? null);
    if (!choice) {
      return;
    }

    this.contents.splice(lineId, 1);
    const dataPointTransactions = `system.${this.propName}.transactions`;
    const cprActorData = foundry.utils.duplicate(this.actor);
    foundry.utils.setProperty(
      cprActorData,
      dataPointTransactions,
      this.contents,
    );

    // Change the value if desired.
    if (choice.action && numbers[0] !== "NaN") {
      const dataPointValue = `system.${this.propName}.value`;
      const value = foundry.utils.getProperty(cprActorData, dataPointValue);
      foundry.utils.setProperty(
        cprActorData,
        dataPointValue,
        value + choice.sign * numbers[0],
      );
      this.total = value + choice.sign * numbers[0];
    }

    await this.actor.update(cprActorData);
    this._makeLedgerReadable();
    this.render();
  }

  /**
   * Strip the leading property name (wealth/reputation/improvementPoints) from each
   * transaction string so the ledger reads naturally.
   *
   * @private
   */
  _makeLedgerReadable() {
    this.contents.forEach((element, index) => {
      const tmp = element[0].replace(this.propName, "").trim();
      this.contents[index][0] = tmp[0].toUpperCase() + tmp.slice(1);
    });
  }
}
