import CPRSystemDataModel from "../../system-data-model.js";

export default class CommonSchema extends CPRSystemDataModel {
  static mixinName = "common";

  static defineSchema() {
    const { fields } = foundry.data;
    return {
      description: new fields.SchemaField({
        value: new fields.HTMLField({ blank: true }),
      }),
      favorite: new fields.BooleanField({ initial: false }),
      // When true, the item is hidden from the document browser entirely.
      ignoredByBrowser: new fields.BooleanField({ initial: false }),
      sources: new fields.ArrayField(
        new fields.SchemaField({
          book: new fields.StringField({ blank: true }),
          page: new fields.NumberField({
            required: true,
            nullable: false,
            integer: true,
            initial: 0,
            min: 0,
          }),
        }),
        { initial: [] },
      ),
      // Deprecated: superseded by `sources` (the list). Kept declared with a
      // `deprecate` tag so its value survives Foundry's schema cleaning, which
      // otherwise strips fields absent from the schema before migrations run —
      // letting `044-source-to-sources.js` still read `system.source` and fold
      // it into `sources`.
      source: new fields.SchemaField(
        {
          book: new fields.StringField({ blank: true }),
          page: new fields.NumberField({
            required: true,
            nullable: false,
            integer: true,
            initial: 0,
            min: 0,
          }),
        },
        {
          deprecate: {
            version: "0.93.0",
            path: "",
            reason: "Item sources are now a list (sources)",
          },
          nullable: true,
        },
      ),
    };
  }
}
