import SystemUtils from "../utils/cpr-systemUtils.js";

const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

/**
 * Thin helpers over Foundry's ApplicationV2 DialogV2, used to replace the legacy
 * (FormApplication-based) CPRDialog. They keep CPR's dialog call sites terse while
 * using the V2 framework directly.
 */

/**
 * Show a yes/no confirmation dialog.
 *
 * @param {string} message - the (already-localized) message to display; may contain HTML
 * @param {object} [options]
 * @param {string} [options.title] - the (already-localized) window title
 * @returns {Promise<boolean>} true if confirmed; false if declined or dismissed
 */
export async function cprConfirm(message, { title } = {}) {
  const confirmed = await DialogV2.confirm({
    window: {
      title: title ?? SystemUtils.Localize("CPR.global.generic.title"),
    },
    classes: ["cpr", "cpr-dialog"],
    content: `<div class="cpr-dialog-message">${message}</div>`,
    rejectClose: false,
    modal: true,
  });
  // confirm() returns null when dismissed (rejectClose:false); coerce to boolean.
  return confirmed === true;
}

/**
 * Show a form prompt rendered from a Handlebars template, returning the supplied
 * data object mutated with the submitted form values (mirroring the old
 * CPRDialog.showDialog contract of "pass an object in, get the updated object back").
 *
 * The template must NOT contain its own <form> or button markup — DialogV2 owns
 * the form element and renders the confirm/cancel buttons.
 *
 * @param {object} config
 * @param {string} config.template - path to the content template
 * @param {object} config.data - the data object passed to the template (and returned, mutated)
 * @param {string} config.title - the (already-localized) window title
 * @param {number|string} [config.width] - optional fixed window width
 * @param {number|string} [config.height] - optional fixed window height
 * @param {(formData: object, data: object) => any} [config.process] - optional hook to transform the
 *   submitted form values before returning; when provided, its return value is what the promise resolves to
 * @param {boolean} [config.modal=false] - show as a modal dialog. Use for blocking
 *   selections the user must resolve before continuing; a modal DialogV2 is rendered
 *   in the top layer, centred and constrained to the viewport.
 * @param {string} [config.confirmLabel] - localization key for the confirm button
 * @param {string} [config.cancelLabel] - localization key for the cancel button
 * @returns {Promise<object|null>} the mutated data object on confirm, or null if cancelled/dismissed
 */
export async function cprFormPrompt({
  template,
  data,
  title,
  width,
  height,
  process,
  modal = false,
  confirmLabel = "CPR.dialog.common.confirm",
  cancelLabel = "CPR.dialog.common.cancel",
}) {
  // Mirror the old FormApplication.getData context shape so existing dialog
  // templates work unchanged: the data's own keys are available at the top level
  // and also under `object` (which several templates iterate).
  const content = await renderTemplate(template, { ...data, object: data });
  const result = await DialogV2.wait({
    window: { title },
    // Only set position when a width or height is requested; passing `position: undefined`
    // makes DialogV2's option merge throw.
    ...(width || height
      ? {
          position: {
            width: width ? parseInt(width, 10) : undefined,
            height: height ? parseInt(height, 10) : undefined,
          },
        }
      : {}),
    modal,
    classes: ["cpr", "cpr-dialog"],
    content,
    buttons: [
      {
        action: "confirm",
        // Match the custom dialogs' footer markup so CPR's button styling and the
        // `button.cpr-dialog-button` selectors apply uniformly across all dialogs.
        class: "cpr-dialog-button",
        icon: "fas fa-check",
        label: confirmLabel,
        default: true,
        callback: (event, button) => {
          const formData = new foundry.applications.ux.FormDataExtended(
            button.form,
          );
          const expanded = foundry.utils.expandObject(formData.object);
          // A `process` hook lets callers transform the raw form values before
          // they are merged (e.g. converting selections into richer objects).
          if (process) return process(expanded, data);
          foundry.utils.mergeObject(data, expanded);
          return data;
        },
      },
      {
        action: "cancel",
        class: "cpr-dialog-button",
        icon: "fas fa-xmark",
        label: cancelLabel,
      },
    ],
    rejectClose: false,
  });
  // wait() resolves to the confirm callback's return (the data) or null on X/Escape
  // dismissal, but a clicked button without a callback resolves to its action
  // identifier — so Cancel arrives as the string "cancel". Map it back to null.
  return result === "cancel" ? null : (result ?? null);
}
