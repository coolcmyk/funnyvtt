import SystemUtils from "../../utils/cpr-systemUtils.js";
import { messageHasRedDmgViolation } from "../../rolls/red-dmg-guard.js";

/*
 * `red` and `dmg` are mutually exclusive within a single roll (see red-dmg-guard.js). The programmatic
 * roll paths (CPRRoll.assertRedDmgExclusive) and the item Damage-field sanitiser already enforce this,
 * but a raw `/r 1d6red4dmg` typed in chat builds a native Foundry roll that reaches neither — it would
 * explode the die AND raise a damage card. This hook closes that gap: on the `chatMessage` hook (which
 * fires before the command is parsed or the dice are rolled) it inspects the roll formulas the message
 * would evaluate and refuses — warns and returns false to block the message — any that pair `red` with
 * `dmg`. Only actual roll commands and inline `[[…]]` rolls are inspected, so ordinary chat is untouched.
 */
const EnforceRedDmgExclusive = () => {
  Hooks.on("chatMessage", (_chatLog, message) => {
    if (!messageHasRedDmgViolation(message)) return true;
    globalThis.ui?.notifications?.warn(
      SystemUtils.Localize("CPR.rolls.modifiers.redDmgExclusive"),
    );
    return false; // block the roll before it is evaluated or posted
  });
};

export default EnforceRedDmgExclusive;
