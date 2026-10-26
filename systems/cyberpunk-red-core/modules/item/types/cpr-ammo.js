import CPRItem from "../cpr-item.js";

/**
 * Extend the base CPRItem object with things specific to ammunition.
 * @extends {CPRItem}
 */
export default class CPRAmmoItem extends CPRItem {
  /**
   * Modify the ammount of ammo an Item object is tracking.
   * @param {*} actionAttributes - data passed in from the event
   */
  async _ammoAction(actionAttributes) {
    const actionData = actionAttributes["data-action"].nodeValue;
    const ammoAmount = actionAttributes["data-amount"].nodeValue;
    switch (actionData) {
      case "ammo-decrement":
        return this._ammoDecrement(ammoAmount);
      case "ammo-increment":
        return this._ammoIncrement(ammoAmount);
      default:
        return null;
    }
  }

  /**
   * Decrease ammo amount without going below 0.
   *
   * @param {Number} changeAmount - how much to decrease by
   * @returns - null or the updated actor data if this ammo is owned
   */
  async _ammoDecrement(changeAmount) {
    const currentValue = this.system.amount;
    const newValue = Math.max(0, Number(currentValue) - Number(changeAmount));
    // Persist a targeted key rather than mutating `this.system` in place and
    // re-sending the whole object: the latter diffs empty against the already
    // mutated source and never reaches the DB, so the change is silently lost on
    // the next re-prepare. Mirrors `unload()`'s `currentAmmo.update(...)`.
    return this.update({ "system.amount": newValue });
  }

  /**
   * Increase the amount of ammo carried
   *
   * @param {Number} changeAmount - how much to increase by
   * @returns -null or the updated actor data if this ammo is owned
   */
  async _ammoIncrement(changeAmount) {
    const currentValue = this.system.amount;
    const newValue = Number(currentValue) + Number(changeAmount);
    // See `_ammoDecrement`: persist a targeted key so the update is diffable and
    // actually written, instead of mutating `this.system` in place.
    return this.update({ "system.amount": newValue });
  }
}
