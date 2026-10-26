import SystemUtils from "./cpr-systemUtils.js";
import { ContainerUtils } from "../item/mixins/cpr-container.js";

/**
 * Render the nested tree of items installed in a container item as an HTML
 * fragment. Shared by the item/actor sheets (interactive) and the document
 * browser (read-only) so the two never drift apart.
 *
 * Children resolve from two sources transparently:
 *  - live world/owned items via `item.getInstalledItems()`, and
 *  - for items living in a compendium, the embedded `cprInstallTree` flag
 *    written by `CPRItem#toCompendium`.
 *
 * Returns an empty SafeString when the item has no resolvable installed items
 * (for example a stale compendium item whose tree was never populated), so
 * callers never need to guard against a throw.
 *
 * @param {CPRItem} item - the top-level container item
 * @param {object} [options]
 * @param {boolean} [options.interactive=true] - include the uninstall /
 *   change-ammo controls (sheets); omit them for a read-only view (browser)
 * @param {boolean} [options.isItemSheet=false] - rendered on an item sheet
 *   rather than an actor sheet (suppresses the change-ammo control)
 * @param {boolean} [options.alwaysExpanded=false] - render the list visible,
 *   ignoring the per-actor show/hide flag
 * @returns {Handlebars.SafeString} nested list markup, or an empty SafeString
 */
export default function renderInstalledTree(item, options = {}) {
  const {
    interactive = true,
    isItemSheet = false,
    alwaysExpanded = false,
  } = options;

  if (!item?.system?.hasInstalled) return new Handlebars.SafeString("");

  // Compendium items carry their installed children in a flag; world/owned
  // items resolve them live. The source is fixed by the top-level item.
  const inItemPack = item.pack && !item.isEmbedded;

  /**
   * @param {CPRItem|object} parentItem - container document, or its flag data
   * @param {number} [level=0] - indentation depth
   * @returns {string}
   */
  function recursiveHTML(parentItem, level = 0) {
    const installedItems = inItemPack
      ? ContainerUtils.getInstallTreeFlag(parentItem)
      : parentItem.getInstalledItems();
    // Stale compendium data (or none installed) — nothing to render.
    if (!Array.isArray(installedItems) || installedItems.length === 0)
      return "";

    const sortedInstalled = [...installedItems].sort((a, b) => {
      // If items are the same type, sort alphabetically.
      if (a.type === b.type) return a.name > b.name ? 1 : -1;

      let sortOrder = [];
      switch (parentItem.type) {
        case "weapon":
        case "itemUpgrade":
          // For weapons and item upgrades, show loaded ammo at the top.
          sortOrder = ["ammo"];
          break;
        case "cyberdeck":
          // For cyberdecks, show installed programs at the top.
          sortOrder = ["program"];
          break;
        case "cyberware":
          // For cyberware, show installed cyberware at the top.
          sortOrder = ["cyberware"];
          break;
        default:
          break;
      }
      return sortOrder.indexOf(a.type) > sortOrder.indexOf(b.type) ? -1 : 1;
    });

    let html = "";
    for (const childItem of sortedInstalled) {
      const localizedType = SystemUtils.Localize(
        `TYPES.Item.${childItem.type}`,
      );

      let actions = "";
      // Interactive controls only make sense where the item can be edited.
      if (interactive) {
        let uninstallIcon = "fa-arrow-right-from-bracket"; // Most items share this.
        const uninstallTooltip = SystemUtils.Localize(
          "CPR.actorSheets.commonActions.uninstall",
        );
        switch (childItem.type) {
          case "itemUpgrade": {
            // Ranged weapon upgrades get the change ammo icon (actor sheet only).
            if (
              childItem.system.type === "weapon" &&
              childItem.system.isRanged &&
              !isItemSheet
            ) {
              const reloadTooltip = SystemUtils.Localize(
                "CPR.actorSheets.commonActions.changeAmmo",
              );
              actions += `<a class="item-action data-item-id="${childItem._id}" data-action="select-ammo">`;
              actions += `  <i class="fas fa-arrow-right-arrow-left" data-tooltip="${reloadTooltip}"></i>`;
              actions += `</a>`;
            }
            break;
          }
          case "program":
            // Programs get a unique uninstall icon.
            uninstallIcon = "fa-folder-minus";
            break;
          default:
            break;
        }
        // Every item gets an uninstall icon.
        actions += `<a class="uninstall-single-item" data-item-id="${childItem._id}" data-direct-parent="${parentItem._id}">`;
        actions += `  <i class="fas ${uninstallIcon}" data-tooltip="${uninstallTooltip}"></i>`;
        actions += `</a>`;
      }

      // Build the list item.
      html += `<li class="item flexrow" data-row-level=${level}
                     data-item-id="${childItem._id}"
                     data-item-category="${childItem.type}">`;
      html += `  <a class="name item-view flex-center"><span class="type-tag">${localizedType}</span> ${childItem.name}</a>`;
      html += `  <div class="action-container">`;
      html += `    ${actions}`;
      html += `  </div>`;
      html += `</li>`;

      // Recurse into the child's own installed items, increasing the indent.
      if (childItem.system.installedItems?.list?.length > 0) {
        html += recursiveHTML(childItem, level + 1);
      }
    }
    return html;
  }

  const inner = recursiveHTML(item);
  if (!inner) return new Handlebars.SafeString("");

  // On an actor sheet the list is hidden until the user expands it; item sheets,
  // the browser, and explicit callers render it open.
  const visible =
    alwaysExpanded ||
    isItemSheet ||
    item.actor?.flags?.[game.system.id]?.showInstalled?.[item.id];
  const display = visible ? "" : "item-hidden";

  // Wrap the whole sub-list in a div, so that it can be animated.
  return new Handlebars.SafeString(
    `<div class="sub-list ${display}" data-items-wrapper-for-parent="${item.id}" style="padding: 0;"><ol>${inner}</ol></div>`,
  );
}
