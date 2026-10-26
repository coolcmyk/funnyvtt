import SystemUtils from "../../utils/cpr-systemUtils.js";

/*
 * A native roll made with the `dmg` die modifier (e.g. `/r 2d6dmg`) is a plain Foundry roll — it carries
 * the CPR damage flags on its die term (`options.cprDamage` / `cprDamageIsCrit`, set by CPRDie#dmg) but
 * none of the bespoke weapon-damage card, so on its own it renders without any way to apply the damage.
 * This hook injects the apply-damage affordance onto exactly those messages: a bolt that reuses the same
 * `applyDamage` chat action as the weapon card (wired by add-glyphs' chatListeners), carrying the armor
 * ablation and, on a crit, the critical bonus fed to `_applyDamage`. Both default to RAW (ablation 1,
 * crit bonus +5) and are overridable on the roll with the `ab`/`cd` companion modifiers (see CPRDie).
 * Weapon/program damage cards already render their own apply-damage button, so they are skipped (see the
 * guard) to avoid a duplicate.
 */

// RAW defaults for a bare `dmg` roll, applied when the roll carries no explicit override. The `dmg`
// marker is non-mutating (it never changes the roll total), so the crit's extra damage and the armor
// ablation are applied here, mirroring the weapon path (CPRDamageRoll's `bonusDamage`; cpr-attackable's
// ablation of 1). The `cd`/`ab` companion modifiers override them per-roll (`cdN`/`abN`; see CPRDie).
const DEFAULT_CRIT_BONUS = 5;
const DEFAULT_ABLATION = 1;

const AddDamageApplication = () => {
  Hooks.on("renderChatMessageHTML", async (message, htmlElement) => {
    // Only native rolls flagged by the `dmg` modifier. `message.rolls` survives serialisation, so this
    // fires the same on the rolling client and on clients that reconstruct the message.
    const dmgDie = (message?.rolls ?? [])
      .flatMap((roll) => roll.dice ?? [])
      .find((die) => die?.options?.cprDamage === true);
    if (!dmgDie) return;

    const html = $(htmlElement); // TODO: Remove JQuery.
    // Skip messages that already carry an apply-damage button — i.e. the bespoke weapon/program damage
    // card, whose roll also carries the `dmg` marker. Only the bare native roll needs one injected.
    if (html.find('[data-action="applyDamage"]').length) return;

    const roll = message.rolls.find((r) =>
      (r.dice ?? []).some((die) => die?.options?.cprDamage === true),
    );
    const isCrit = dmgDie.options.cprDamageIsCrit === true;
    // `cdN` (cprCritBonus) / `abN` (cprAblation) override the RAW defaults; absent → the defaults.
    const bonusDamage = isCrit
      ? (dmgDie.options.cprCritBonus ?? DEFAULT_CRIT_BONUS)
      : 0;
    const ablation = dmgDie.options.cprAblation ?? DEFAULT_ABLATION;

    const applyTooltip = SystemUtils.Localize(
      "CPR.chat.damageApplication.applyDamageSelected",
    );
    const critLabel = isCrit
      ? `<span class="cpr-native-damage-crit">${SystemUtils.Localize(
          "CPR.chat.damageApplication.criticalDamage",
        )} ${bonusDamage}</span>`
      : "";

    // scope=global → apply to the clicking user's selected/targeted tokens, resolved at click time by
    // CPRChat.damageApplication. location=body / lethal=true are the RAW defaults for an unqualified roll;
    // ablation defaults to 1 (RAW, overridable with `abN`); ammo data is absent (a bare roll has no ammo).
    const block = $(
      `<div class="cpr-native-damage">
        <a class="clickable" data-action="applyDamage" data-scope="global"
           data-total-damage="${roll.total}" data-bonus-damage="${bonusDamage}"
           data-damage-location="body" data-damage-lethal="true" data-ablation="${ablation}">
          <i class="fas fa-bolt" data-tooltip="${applyTooltip}"></i>
          <span>${SystemUtils.Localize("CPR.global.generic.damage")}</span>
        </a>
        ${critLabel}
      </div>`,
    );

    const content = html.find(".message-content");
    (content.length ? content : html).append(block);
  });
};

export default AddDamageApplication;
