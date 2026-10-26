import SystemUtils from "../../../utils/cpr-systemUtils.js";

const SetTheme = () => {
  /**
   * Set the CSS theme on ready
   *
   * @public
   * @memberof hookEvents
   */
  Hooks.on("ready", () => {
    SystemUtils.SetTheme();
  });

  /**
   * Update theme when Foundry's color scheme setting changes
   *
   * @public
   * @memberof hookEvents
   */
  Hooks.on("clientSettingChanged", (key) => {
    if (key === "core.uiConfig") {
      SystemUtils.SetTheme();
    }
  });
};

export default SetTheme;
