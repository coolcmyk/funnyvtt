import CPRDocumentBrowser from "../../../apps/browser/cpr-document-browser.js";
import SystemUtils from "../../../utils/cpr-systemUtils.js";

/** Launch-button label localization keys, keyed by mode (kept as literal
 * strings so the unused-localization check can see them). */
const LAUNCH_LABEL = {
  actor: "CPR.browser.launch.actor",
  item: "CPR.browser.launch.item",
};

/**
 * Inject a launch button at the bottom of a sidebar directory that opens the
 * document browser in the given mode ("Item Browser" / "Actor Browser"). No-ops
 * if the directory can't be found or a button for that mode already exists
 * (directories re-render often, and the compendium directory carries both).
 *
 * @param {HTMLElement|jQuery} html - the rendered directory element
 * @param {"actor"|"item"} mode - the mode to open the browser in
 */
function injectBrowserButton(html, mode) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector(`.cpr-browser-launch[data-mode="${mode}"]`)) {
    return;
  }

  // Pin to the directory footer when present, otherwise the directory root, so
  // the button sits at the bottom rather than in the header.
  const container = root.querySelector(".directory-footer") ?? root;

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("cpr-browser-launch");
  button.dataset.mode = mode;

  const icon = document.createElement("i");
  icon.className = "fa-solid fa-magnifying-glass";
  button.append(icon, ` ${SystemUtils.Localize(LAUNCH_LABEL[mode])}`);
  button.addEventListener("click", () =>
    new CPRDocumentBrowser({ mode }).render(true),
  );

  container.append(button);
}

/**
 * Register the document-browser launch buttons on the Actor, Item and
 * Compendium sidebar directories. Actor browsing is GM-only. The Compendium
 * directory holds both Item and (for GMs) Actor packs, so it offers both
 * launchers in place of the removed "All" mode.
 *
 * @public
 * @memberof hookEvents
 */
const DirectoryBrowserButtons = () => {
  Hooks.on("renderActorDirectory", (_app, html) => {
    if (!game.user.isGM) return;
    injectBrowserButton(html, "actor");
  });
  Hooks.on("renderItemDirectory", (_app, html) =>
    injectBrowserButton(html, "item"),
  );
  Hooks.on("renderCompendiumDirectory", (_app, html) => {
    injectBrowserButton(html, "item");
    if (game.user.isGM) injectBrowserButton(html, "actor");
  });
};

export default DirectoryBrowserButtons;
