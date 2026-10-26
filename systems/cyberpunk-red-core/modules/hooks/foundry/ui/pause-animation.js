import LOGGER from "../../../utils/cpr-logger.js";

const PauseAnimation = () => {
  /**
   * When the game is paused, an animation is rendered in the bottom-middle of
   * the screen to indicate the paused state. When this rendering happens, this
   * hook is called. We use it to change the animation from the default to
   * something more Cyberpunk in theme.
   *
   * @public
   * @memberof hookEvents
   */
  Hooks.on("renderGamePause", (_, html) => {
    // Avoid conflicts if multiple systems register this hook
    if (Hooks.events.renderGamePause.length > 1) return;

    // Check settings
    const animationEnabled = game.settings.get("core", "photosensitiveMode")
      ? false
      : game.settings.get(game.system.id, "enablePauseAnimation");

    // Set up the text
    const caption = html.querySelector("figcaption");
    if (caption) {
      // Apply different class based on animation setting
      caption.className = animationEnabled ? "pause-glitch" : "pause-static";
      caption.setAttribute("data-text", game.i18n.localize("GAME.Paused"));
    }

    // Hide the pause image
    const img = html.querySelector("img");
    if (img) {
      img.className = "pause-image";
    }

    if (animationEnabled) {
      LOGGER.log("Enabling pause animation");
    } else {
      LOGGER.log("Using static pause text");
    }
  });
};

export default PauseAnimation;
