import SystemUtils from "../utils/cpr-systemUtils.js";
import { cprFormPrompt } from "./cpr-dialog.js";

/**
 * Show the "Select Role Bonuses" dialog and process its result. The form lets the
 * user pick which skills a role/sub-ability grants bonuses to, a bonus ratio, and
 * any universal bonuses; the selections are converted into the role's
 * `bonuses` / `universalBonuses` / `bonusRatio` data.
 *
 * @param {object} dialogData - { skillList, roleData } for the form
 * @returns {Promise<object|null>} the dialogData with `roleData` updated, or null if cancelled
 */
export default async function selectRoleBonuses(dialogData) {
  return cprFormPrompt({
    data: dialogData,
    title: SystemUtils.Localize("CPR.dialog.selectRoleBonuses.title"),
    template: `systems/${game.system.id}/templates/dialog/cpr-select-role-bonuses-prompt.hbs`,
    process: (formData, data) => {
      // Convert selected skills into a list of skill references.
      const bonuses = [];
      (formData.selectedSkills ?? []).forEach((s) => {
        if (s) bonuses.push(data.skillList.find((a) => a.name === s));
      });

      // Make sure that we are not dividing by 0 or null/undefined.
      const bonusRatio =
        !formData.bonusRatio || formData.bonusRatio === 0
          ? 1
          : formData.bonusRatio;

      foundry.utils.mergeObject(data.roleData, {
        bonusRatio,
        bonuses,
        universalBonuses: (formData.universalBonuses ?? []).filter((b) => b),
      });
      return data;
    },
  });
}
