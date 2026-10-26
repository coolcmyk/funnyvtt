import SystemUtils from "./cpr-systemUtils.js";

const ContextMenu = foundry.applications.ux.ContextMenu.implementation;

/**
 * Sets up a ContextMenu that appears when the provided selector is right clicked.
 * The ContextMenu contains a menu item that enables the user to share an image with other players.
 * @param {jQuery|HTMLElement} root - The sheet root: a jQuery object (AppV1 sheets) or a native HTMLElement (AppV2 sheets)
 * @param {string} contextMenuTargetSelector - The selector for the element that will open the ContextMenu when right clicked
 * @param {{name: string, img: string}} data - The created ContextMenu
 */
export default function createImageContextMenu(
  root,
  contextMenuTargetSelector,
  data,
) {
  // Accept either a jQuery object (AppV1) or a native HTMLElement (AppV2).
  const html = root instanceof HTMLElement ? root : root[0];
  const menuItems = [
    {
      name: SystemUtils.Format("CPR.sheets.image.showPlayers"),
      icon: '<i class="fas fa-eye"></i>',
      callback: () => {
        const popout = new ImagePopout(data.img, {
          title: data.name,
          shareable: true,
        });
        popout.render(true);
        popout.shareImage(true);
      },
    },
  ];
  return new ContextMenu(html, contextMenuTargetSelector, menuItems, {
    jQuery: false,
  });
}
