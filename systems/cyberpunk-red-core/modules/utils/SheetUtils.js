import LOGGER from "./cpr-logger.js";

/**
 * CPR-C utilities that are used in sheets
 */
export default class CPRSheetUtils {
  /**
   * Dynamically adjusts the width of all elements with the specified class
   * within the provided HTML context. It ensures that all elements have a
   * consistent width equal to the width of the widest element. The width is
   * calculated by cloning the elements, appending them to the body invisibly,
   * measuring their width, and then applying this maximum width to all
   * elements in rem units.
   *
   * @param {HTMLElement} element - The sheet's root element in which to find
   *                                and adjust the matching elements.
   * @param {String} cssClass - The CSS selector to target
   */
  static setCssClassWidth(element, cssClass) {
    if (!(element instanceof HTMLElement)) return;
    const typeTags = Array.from(element.querySelectorAll(cssClass));
    if (!typeTags.length) return;

    const maxWidth = CPRSheetUtils._measureMaxContentWidth(typeTags);
    if (maxWidth <= 0) return;

    // Convert the maxWidth from px to rem and apply it to every element so they
    // share a uniform width equal to the widest one's content.
    const rootFontSize = parseFloat(
      window.getComputedStyle(document.documentElement).fontSize,
    );
    const maxWidthInRem = maxWidth / rootFontSize;
    typeTags.forEach((tag) => {
      tag.style.boxSizing = "border-box";
      tag.style.width = `${maxWidthInRem}rem`;
    });
  }

  /**
   * Measure the widest content width across the given elements. Some are hidden
   * (collapsed expandos / inactive tabs), so measuring in place returns 0; each
   * is cloned to the body — copying the style properties that affect width,
   * since the source styling is scoped to the sheet and would be lost off-DOM —
   * sized to content, measured, then removed.
   *
   * @param {HTMLElement[]} typeTags - the elements to measure
   * @returns {number} the largest content width in pixels
   */
  static _measureMaxContentWidth(typeTags) {
    const widthProps = [
      "fontSize",
      "fontFamily",
      "fontWeight",
      "fontStyle",
      "letterSpacing",
      "textTransform",
      "paddingLeft",
      "paddingRight",
      "borderLeftWidth",
      "borderRightWidth",
      "boxSizing",
    ];
    const clones = typeTags.map((tag) => {
      const computed = window.getComputedStyle(tag);
      const clone = tag.cloneNode(true);
      widthProps.forEach((prop) => {
        clone.style[prop] = computed[prop];
      });
      clone.style.position = "absolute";
      clone.style.visibility = "hidden";
      clone.style.display = "inline-block";
      clone.style.width = "auto";
      clone.style.whiteSpace = "nowrap";
      document.body.appendChild(clone);
      return clone;
    });
    const maxWidth = Math.max(
      ...clones.map((clone) => clone.getBoundingClientRect().width),
    );
    clones.forEach((clone) => clone.remove());
    return maxWidth;
  }

  /**
   * Dynamically adjusts the font size of the input element to fit its contents
   * within its bounds. It reduces the font size step by step until the text fits
   * or the minimum font size is reached.
   *
   * @param {HTMLElement|jQuery} inputElement - The DOM or jQuery object for the
   *                                            input field whose font size will
   *                                            be adjusted. It accepts both a raw
   *                                            DOM element or a jQuery element.
   */
  static adjustFontSizeToFit(inputElement) {
    // Use LOGGER to trace the call

    // Ensure we have the DOM element
    const input = inputElement.jquery ? inputElement.get(0) : inputElement;

    // Make sure we have a valid element to work with
    if (!input || !input.style) {
      LOGGER.warn(
        "adjustFontSizeToFit | CPRSheetUtils | No input element found or input element has no style property.",
      );
      return;
    }

    // Maximum and minimum font sizes in rem
    const minFontSize = 0.5;
    const maxFontSize = 2;
    // How much to adjust the font size each time (in rem)
    const step = 0.1;

    let fontSize = maxFontSize;
    input.style.fontSize = `${fontSize}rem`;

    // Decrease the font size until the text fits within the input width
    while (fontSize > minFontSize && input.scrollWidth > input.clientWidth) {
      fontSize -= step;
      input.style.fontSize = `${fontSize}rem`;
    }

    // If the minimum font size is still too big, set it to the minimum
    if (input.scrollWidth > input.clientWidth) {
      input.style.fontSize = `${minFontSize}rem`;
    }
  }
}
