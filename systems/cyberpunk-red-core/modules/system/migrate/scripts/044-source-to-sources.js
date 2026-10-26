import BaseMigrationScript from "../base-migration-script.js";

/**
 * Convert the single `system.source` object on items into a `system.sources`
 * array of the same shape, so items can cite multiple sourcebooks.
 */
export default class SourceToSources extends BaseMigrationScript {
  static version = 44;

  static name = "Convert item source to sources array";

  static documentFilters = {
    Item: { types: [], mixins: ["common"] },
    Actor: { types: [], mixins: [] },
  };

  /** @inheritdoc */
  async updateItem(itemData) {
    const source = foundry.utils.getProperty(itemData, "system.source");
    if (source === undefined) return;

    const book = source?.book ?? "";
    const page = source?.page ?? 0;
    const hasBook = typeof book === "string" && book.trim() !== "";
    foundry.utils.setProperty(
      itemData,
      "system.sources",
      hasBook ? [{ book, page }] : [],
    );

    this.constructor.safeDelete(itemData, "system.source");
  }
}
