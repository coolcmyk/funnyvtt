export default function overrideRulerFunctions() {
  // Patch the ruler class prototype directly rather than a live instance from
  // `canvas.controls.ruler` — the latter is null when no scene is active (the
  // ruler is only constructed once the canvas is drawn), which threw on `ready`.
  const proto = CONFIG.Canvas.rulerClass.prototype;
  const originalContext = proto._getWaypointLabelContext;

  proto._getWaypointLabelContext = function (waypoint, state) {
    const context = originalContext.call(this, waypoint, state);

    if (!context) return context;

    if (this.user.isSelf) {
      const token = canvas.tokens.controlled[0];
      const dvTableFlag = token?.document.getFlag(game.system.id, "cprDvTable");
      if (dvTableFlag) {
        const distance = Number(context.distance.total);

        let DV = 0;
        for (const range of Object.keys(dvTableFlag.table)) {
          const [start, end] = range.split("_");
          if (distance >= +start && distance <= +end) {
            DV = dvTableFlag.table[range];
            if (typeof DV === "object") {
              DV = DV.description;
            }
            break;
          }
        }

        if (DV) {
          context.dvLabel = `DV: ${DV} ${dvTableFlag.name.replace(/^DV /, "")}`;
        }
      }
    }

    return context;
  };
}

const foundryValidate = foundry.abstract.DataModel.prototype.validate;
/**
 * Override for the validate function of Foundry's DataModel.
 * If migration is running, always return true.
 * Otherwise, call the original validate function.
 * @param {object} options
 * @returns {boolean} - The result of the validation.
 */
export function validateOverride(options) {
  if (game.cpr.MigrationRunner.needsMigration) return true;
  return foundryValidate.call(this, options);
}
