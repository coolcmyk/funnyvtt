import CPR from "../../system/config.js";
import SystemUtils from "../../utils/cpr-systemUtils.js";
import CPRSheetUtils from "../../utils/SheetUtils.js";
import CPRBrowserIndex from "./cpr-browser-index.js";
import CPRBrowserCompendiaSettings from "../settings/cpr-browser-compendia-settings.js";
import renderInstalledTree from "../../utils/cpr-installed-tree.js";
import browserStatChips from "./cpr-browser-chips.js";
import { buildItemBreadcrumb } from "../../item/item-chips.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A browser for discovering Items (or Actors) across world collections and every
 * compendium the user can see. It opens in a single mode — Item, or the GM-only
 * Actor — launched from the matching sidebar directory, with a per-type filter
 * box for each document type, top-bar global filters (search, price, category,
 * quality), and drag-out onto sheets.
 *
 * Entries come from CPRBrowserIndex (lightweight, lazily built). Results render
 * progressively: the first batch appears immediately, then remaining rows are
 * appended on idle frames with a visible loading indicator until complete.
 *
 * @extends {ApplicationV2}
 */
export default class CPRDocumentBrowser extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  /** Number of result rows rendered per batch. */
  static BATCH_SIZE = 50;

  /** Base window width, and the extra width added when the cart is shown. */
  static BASE_WIDTH = 1020;

  static CART_WIDTH = 260;

  /**
   * @param {object} [options]
   * @param {"actor"|"item"} [options.mode] - the mode to open in
   */
  constructor(options = {}) {
    super(options);
    this.mode = CPRDocumentBrowser.#sanitizeMode(options.mode ?? "item");
    this.filterState = CPRDocumentBrowser.#emptyFilterState();

    // Shopping cart (player shop mode): array of
    // {uuid, name, img, brand, price, priceCategory, quantity}.
    this.cart = [];

    // The actor the cart buys for. Defaults to the user's assigned character but
    // is switchable in the cart, so a player who owns several actors (or has no
    // Main set) can direct the purchase at the right one.
    this.cartActorId = game.user.character?.id ?? null;

    // Filter groups start collapsed; this holds the ids the user has expanded.
    this.expandedGroups = new Set();

    // Progressive-render state.
    this._results = [];
    this._rendered = 0;
    this._loadHandle = null;

    // Result-list group headers the user has collapsed (by item type).
    this._collapsedGroups = new Set();
  }

  /**
   * The actor the cart buys for: the one picked in the cart if it still
   * resolves, otherwise the user's assigned character (which may be null).
   *
   * @returns {Actor|null}
   */
  get cartActor() {
    return (
      (this.cartActorId && game.actors.get(this.cartActorId)) ||
      game.user.character ||
      null
    );
  }

  /**
   * The character actors the current user owns, as a `{id: name}` map for
   * `selectOptions`. Used to let the cart target any owned actor.
   *
   * @private
   * @returns {Object<string, string>}
   */
  static #ownedCharacterActors() {
    const actors = {};
    for (const actor of game.actors) {
      if (actor.isOwner && actor.type === "character") {
        actors[actor.id] = actor.name;
      }
    }
    return actors;
  }

  /**
   * A fresh, fully-default filter state. The per-type buckets are keyed by item
   * type then filter id:
   *   - `types`     {type: tristate}                  — the type box's own toggle
   *   - `sets`      {type: {filterId: {value: tristate}}} — set/sub-type filters
   *   - `ranges`    {type: {filterId: {min, max}}}     — range + damage filters
   *   - `booleans`  {type: {filterId: tristate}}       — boolean filters
   *   - `toggles`   {type: {filterId: tristate}}       — tri-state toggles
   *   - `tristate`  {filterId: {value: tristate}}      — the global filters
   *
   * `autoPromoted` holds the types whose box was forced to "only" by a child
   * sub-filter (not by the user clicking the box itself), so clearing the last
   * "only" child can undo exactly that promotion and nothing else.
   *
   * @private
   * @returns {object}
   */
  static #emptyFilterState() {
    return {
      name: "",
      price: { min: null, max: null },
      priceCategory: { op: "any", value: null },
      quality: "",
      sourceScope: "any",
      tristate: {},
      types: {},
      sets: {},
      ranges: {},
      booleans: {},
      toggles: {},
      autoPromoted: new Set(),
    };
  }

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "cpr-document-browser",
    classes: ["cpr", "cpr-document-browser"],
    tag: "div",
    position: { width: 1020, height: 920 },
    window: {
      icon: "fa-solid fa-magnifying-glass",
      title: "CPR.browser.title",
      resizable: true,
    },
    actions: {
      clearFilters: CPRDocumentBrowser.clearFilters,
      refreshIndex: CPRDocumentBrowser.refreshIndex,
      openCompendiaSettings: CPRDocumentBrowser.openCompendiaSettings,
      openDocument: CPRDocumentBrowser.openDocument,
      toggleInstalled: CPRDocumentBrowser.toggleInstalled,
      addToCart: CPRDocumentBrowser.addToCart,
      adjustCartItem: CPRDocumentBrowser.adjustCartItem,
      removeFromCart: CPRDocumentBrowser.removeFromCart,
      purchaseCart: CPRDocumentBrowser.purchaseCart,
    },
  };

  /** @inheritDoc */
  static PARTS = {
    globals: {
      template: `systems/${CPR.systemId}/templates/apps/browser/cpr-browser-globals.hbs`,
    },
    sidebar: {
      template: `systems/${CPR.systemId}/templates/apps/browser/cpr-browser-sidebar.hbs`,
    },
    results: {
      template: `systems/${CPR.systemId}/templates/apps/browser/cpr-browser-results.hbs`,
      scrollable: [".cpr-browser-results-list"],
    },
    cart: {
      template: `systems/${CPR.systemId}/templates/apps/browser/cpr-browser-cart.hbs`,
      scrollable: [".cpr-browser-cart-list"],
    },
  };

  /** @override */
  get title() {
    return `${game.system.title}: ${SystemUtils.Localize(
      this.options.window.title,
    )}`;
  }

  /**
   * Coerce a requested mode into one the current user is allowed to use.
   * Actor browsing is GM-only, so non-GMs fall back to Item mode.
   *
   * @private
   * @param {string} mode
   * @returns {"actor"|"item"}
   */
  static #sanitizeMode(mode) {
    if (mode === "actor" && !game.user.isGM) return "item";
    return ["actor", "item"].includes(mode) ? mode : "item";
  }

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.isGM = game.user.isGM;
    context.mode = this.mode;
    context.name = this.filterState.name;
    context.isItemContext = this.#isItemContext();
    context.priceMin = this.filterState.price.min;
    context.priceMax = this.filterState.price.max;
    context.priceCategoryOp = this.filterState.priceCategory.op;
    context.priceCategoryValue = this.filterState.priceCategory.value;
    context.priceCategoryOps = {
      any: "CPR.browser.compare.any",
      lte: "CPR.browser.compare.atMost",
      eq: "CPR.browser.compare.equals",
      gte: "CPR.browser.compare.atLeast",
    };
    context.priceCategories = CPR.itemPriceCategory;
    context.quality = this.filterState.quality;
    context.sourceScope = this.filterState.sourceScope;
    context.sourceScopeOptions = {
      any: "CPR.browser.compare.any",
      world: "CPR.browser.source.world",
      compendium: "CPR.browser.source.compendium",
    };
    context.itemQuality = CPR.itemQuality;

    context.isShop = CPRDocumentBrowser.#isShop();
    context.cart = this.cart.map((item) => ({
      ...item,
      categoryLabel: CPR.itemPriceCategory[item.priceCategory] ?? "",
      lineTotalLabel: CPRDocumentBrowser.#money(item.price * item.quantity),
    }));
    const cartTotal = this.cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    context.cartTotalLabel = CPRDocumentBrowser.#money(cartTotal);
    context.cartActors = CPRDocumentBrowser.#ownedCharacterActors();
    context.cartActorId = this.cartActor?.id ?? "";

    // Filters and results both derive from the index, so only recompute them
    // when a part that shows them is actually rendering. In particular, cart-only
    // renders must not reset the progressive-render counters: doing so mid-load
    // would re-append rows already in the DOM.
    const parts = options.parts ?? Object.keys(CPRDocumentBrowser.PARTS);
    const needsEntries = parts.includes("sidebar") || parts.includes("results");
    const entries = needsEntries ? await this.#getModeEntries() : [];

    context.typeBoxes = parts.includes("sidebar") ? this.#getTypeBoxes() : [];

    if (parts.includes("sidebar")) {
      context.filters = this.#getFilterContext(entries);
    }
    if (parts.includes("results")) {
      const results = this.#applyFilters(entries);
      this._results = results;
      // Rows (and their group headers) are appended progressively in _onRender.
      this._rendered = 0;
      context.resultTotal = results.length;
      context.shown = 0;
      context.loading = results.length > 0;
    }
    return context;
  }

  /**
   * Map a normalized index entry to the lightweight view-model a result row
   * template consumes.
   *
   * @private
   * @param {object} entry
   * @returns {object}
   */
  static #toRow(entry) {
    const market = foundry.utils.getProperty(entry, "system.price.market");
    const isItem = entry.docClass === "Item";
    const hasInstalled =
      foundry.utils.getProperty(entry, "system.installedItems.list")?.length >
      0;
    return {
      uuid: entry.uuid,
      name: entry.name,
      img: entry.img,
      docClass: entry.docClass,
      type: entry.type,
      typeLabel: CPRDocumentBrowser.#typeLabel(entry),
      sourceLabel: CPRDocumentBrowser.#sourceKindLabel(entry),
      description: CPRDocumentBrowser.#plainText(
        foundry.utils.getProperty(entry, "system.description.value"),
      ),
      // The row feeds the shared `cpr-item-header-body` partial (also used by
      // the item sheet header), so it carries the same view-model. Breadcrumb
      // segments include the Type and the per-segment opacity gradient, exactly
      // like the sheet header.
      breadcrumb: isItem
        ? buildItemBreadcrumb(entry, { includeType: true }).map(
            (label, index) => ({
              label,
              opacity: Math.max(0, 1 - 0.15 * index),
            }),
          )
        : [],
      // Browser rows open on click, so the leading Type segment must be a plain
      // span, not a wiki link (no nested interactive), and the image is not
      // editable here.
      wikiType: null,
      editImg: false,
      // The browser tracks only whether an item has things installed in it,
      // shown with the "upgraded" caret marker (as the old row markup did).
      statusUpgraded: hasInstalled,
      statusInstalled: false,
      chips: isItem ? browserStatChips(entry) : [],
      ...CPRDocumentBrowser.#sourceDisplay(entry),
      hasInstalled,
      // Drag-out copies an item onto a sheet for free, so it is GM-only — in shop
      // mode (players) rows aren't draggable and they must buy via the cart.
      draggable: !CPRDocumentBrowser.#isShop(),
      hasPrice: typeof market === "number",
      priceLabel:
        typeof market === "number" ? CPRDocumentBrowser.#money(market) : "",
      priceCategoryLabel: entry.priceCategory
        ? (CPR.itemPriceCategory[entry.priceCategory] ?? "")
        : "",
      canBuy:
        CPRDocumentBrowser.#isShop() && isItem && typeof market === "number",
    };
  }

  /** @private @param {object} entry @returns {"world"|"compendium"} */
  static #sourceKind(entry) {
    return entry.source === "world" ? "world" : "compendium";
  }

  /** @private @param {object} entry @returns {string} */
  static #sourceKindLabel(entry) {
    return SystemUtils.Localize(
      CPRDocumentBrowser.#sourceKind(entry) === "world"
        ? "CPR.browser.source.world"
        : "CPR.browser.source.compendium",
    );
  }

  /**
   * The source text shown in an entry card's header. Browser rows prepend the
   * coarse source kind label and, when present, append the first cited
   * source-book citation. Remaining cited books stay in the hover tooltip
   * exactly as before.
   *
   * @private
   * @param {object} entry
   * @returns {{source: string, sourceTooltip: string}}
   */
  static #sourceDisplay(entry) {
    const sources = foundry.utils.getProperty(entry, "system.sources");
    const { source, sourceTooltip } = SystemUtils.FormatSourceDisplay(sources);
    const originLabel = CPRDocumentBrowser.#sourceKindLabel(entry);
    return {
      source: source ? `${originLabel} / ${source}` : originLabel,
      sourceTooltip,
    };
  }

  /**
   * Whether the browser is acting as a shop. It is for players (purchasable
   * items show a buy control); for the GM it is a plain browser.
   *
   * @private
   * @returns {boolean}
   */
  static #isShop() {
    return !game.user.isGM;
  }

  /**
   * Reduce an HTML description to plain text for use in a hover tooltip (Foundry
   * renders `data-tooltip` as text, so raw markup would show literally).
   *
   * @private
   * @param {string} [html]
   * @returns {string}
   */
  static #plainText(html) {
    if (!html) return "";
    const element = document.createElement("div");
    element.innerHTML = html;
    return (element.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  /**
   * Localized label for an entry's document subtype.
   *
   * @private
   * @param {object} entry
   * @returns {string}
   */
  static #typeLabel(entry) {
    if (entry.docClass === "Actor") {
      return SystemUtils.Localize(`TYPES.Actor.${entry.type}`);
    }
    return SystemUtils.Localize(
      CPR.objectTypes[entry.type] ?? `TYPES.Item.${entry.type}`,
    );
  }

  /**
   * Build a filter box per document type for the active mode. Each box carries a
   * type-level tri-state and (when it has any) a body of that type's filters.
   * Item types come from CPR.objectTypes (minus excluded); actor types from the
   * Actor data models (GM only) and have no per-type filters.
   *
   * @private
   * @param {Array<object>} entries - the current mode's unfiltered browser entries
   * @returns {Array<object>}
   */
  #getTypeBoxes() {
    const boxes = [];
    if (this.mode === "actor") {
      if (game.user.isGM) {
        for (const type of Object.keys(CONFIG.Actor.dataModels)) {
          boxes.push(this.#typeBox(type, `TYPES.Actor.${type}`, []));
        }
      }
      return boxes;
    }
    for (const [type, label] of Object.entries(CPR.objectTypes)) {
      if (CPR.browserExcludedItemTypes.includes(type)) continue;
      boxes.push(this.#typeBox(type, label, CPR.browserFilters[type] ?? []));
    }
    return boxes;
  }

  /**
   * Build a single type box: its tri-state, expand state, and rendered filters.
   *
   * @private
   * @param {string} type
   * @param {string} label - localization key
   * @param {Array<object>} defs - the type's filter definitions
   * @returns {object}
   */
  #typeBox(type, label, defs) {
    const filters = defs.map((def) => this.#renderFilterDef(type, def));
    // Order within a box by control kind: range inputs first, then booleans,
    // then toggles, then the (taller) tri-state set lists last. Sorting is
    // stable, so each kind keeps its config order.
    const kindOrder = (filter) => {
      if (filter.isRange) return 0;
      if (filter.isBoolean) return 1;
      if (filter.isToggle) return 2;
      return 3;
    };
    const ordered = [...filters].sort((a, b) => kindOrder(a) - kindOrder(b));
    return {
      type,
      label,
      state: this.filterState.types[type] ?? "include",
      expanded: this.expandedGroups.has(`box:${type}`),
      hasBody: ordered.length > 0,
      filters: ordered,
    };
  }

  /**
   * Resolve a filter definition into a render-ready control carrying its current
   * selection. Sets become tri-state option lists, ranges/damage become min/max
   * inputs, booleans an Any/Yes/No state, and toggles an on/off plus their
   * (recursively rendered) nested filters.
   *
   * @private
   * @param {string} type - the owning item type
   * @param {object} def - a filter definition from CPR.browserFilters
   * @returns {object}
   */
  #renderFilterDef(type, def) {
    const base = { id: def.id, label: def.label };
    switch (def.type) {
      case "set": {
        const states = this.filterState.sets[type]?.[def.id] ?? {};
        const choices = Object.entries(CPR[def.choices] ?? {});
        return {
          ...base,
          isSet: true,
          options: choices.map(([value, label]) => ({
            value,
            label,
            state: states[value] ?? "include",
          })),
        };
      }
      case "range":
      case "damage": {
        const range = this.filterState.ranges[type]?.[def.id] ?? {};
        return {
          ...base,
          isRange: true,
          min: range.min ?? "",
          max: range.max ?? "",
        };
      }
      case "boolean":
        return {
          ...base,
          isBoolean: true,
          state: this.filterState.booleans[type]?.[def.id] ?? "include",
        };
      case "toggle": {
        const state = this.filterState.toggles[type]?.[def.id] ?? "include";
        return {
          ...base,
          isToggle: true,
          state,
          // Nested stat filters only apply (and show) when filtering to the
          // "only" state (e.g. only cyberweapons).
          revealNested: state === "only",
          filters: (def.filters ?? []).map((nested) =>
            this.#renderFilterDef(type, nested),
          ),
        };
      }
      default:
        return base;
    }
  }

  /**
   * Whether the active mode browses items, and so should offer the common item
   * filters (quality, price, source book).
   *
   * @private
   * @returns {boolean}
   */
  #isItemContext() {
    return this.mode !== "actor";
  }

  /**
   * The filter definitions active for the current mode/type: the common item
   * filters (plus the dynamic brand/source-book filters) when browsing items,
   * followed by the selected type's own filters. Shared by the filter UI and
   * predicates so they never drift apart.
   *
   * @private
   * @returns {Array<object>}
   */
  #activeFilterDefs() {
    if (!this.#isItemContext()) return [];
    return [
      ...CPR.browserCommonItemFilters,
      {
        id: "brand",
        type: "tristate",
        field: "system.brand",
        dynamic: true,
        label: "CPR.browser.filter.brand",
      },
      {
        id: "book",
        type: "tristate",
        field: "system.sources",
        dynamic: true,
        multi: true,
        valueKey: "book",
        label: "CPR.browser.filter.book",
      },
    ];
  }

  /**
   * Resolve the active filter definitions into render-ready controls carrying
   * the current selection. Set filters with a fixed enum read their options
   * from config; dynamic filters derive their options from the indexed entries.
   *
   * @private
   * @param {Array<object>} entries - the unfiltered entries for the active mode
   * @returns {Array<object>}
   */
  #getFilterContext(entries) {
    return this.#activeFilterDefs().map((definition) => {
      const choices = definition.dynamic
        ? CPRDocumentBrowser.#dynamicChoices(definition.field, entries, {
            multi: definition.multi,
            valueKey: definition.valueKey,
            labelField: definition.labelField,
          })
        : Object.entries(CPR[definition.choices] ?? {});
      const states = this.filterState.tristate[definition.id] ?? {};
      return {
        id: definition.id,
        type: "tristate",
        label: definition.label,
        collapsed: !this.expandedGroups.has(definition.id),
        options: choices.map(([value, label]) => ({
          value,
          label,
          state: states[value] ?? "include",
        })),
      };
    });
  }

  /**
   * Build [value, label] choice pairs from the distinct, non-empty values a
   * field takes across the supplied entries (used for free-text fields like the
   * source book, brand, and origin). The raw value is its own label unless a
   * separate `labelField` is supplied.
   *
   * When `multi` is set, `field` is an array path (e.g. `system.sources`) and
   * each element's `valueKey` property supplies the value, so an entry citing
   * several source books contributes all of them.
   *
   * @private
   * @param {string} field
   * @param {Array<object>} entries
   * @param {object} [options]
   * @param {boolean} [options.multi] - whether `field` is an array of value-bearing objects
   * @param {string} [options.valueKey] - the property to read off each array element when `multi`
   * @param {string} [options.labelField] - an alternate field to read a visible label from
   * @returns {Array<[string, string]>}
   */
  static #dynamicChoices(
    field,
    entries,
    { multi = false, valueKey = null, labelField = null } = {},
  ) {
    const values = new Map();
    for (const entry of entries) {
      if (multi) {
        const list = foundry.utils.getProperty(entry, field) ?? [];
        for (const item of list) {
          const value = item?.[valueKey];
          if (value && !values.has(value)) values.set(value, value);
        }
      } else {
        const value = foundry.utils.getProperty(entry, field);
        if (!value || values.has(value)) continue;
        values.set(
          value,
          foundry.utils.getProperty(entry, labelField) || value,
        );
      }
    }
    return Array.from(values.entries()).sort((a, b) =>
      SystemUtils.Localize(a[1]).localeCompare(SystemUtils.Localize(b[1])),
    );
  }

  /**
   * Fetch the unfiltered, source-agnostic entries for the active mode.
   *
   * @async
   * @private
   * @returns {Promise<Array<object>>}
   */
  async #getModeEntries() {
    if (this.mode === "actor") {
      return game.user.isGM ? CPRBrowserIndex.getEntries("Actor") : [];
    }
    return CPRBrowserIndex.getEntries("Item");
  }

  /**
   * Filter and sort the supplied entries by the active filter state.
   *
   * @private
   * @param {Array<object>} entries
   * @returns {Array<object>}
   */
  #applyFilters(entries) {
    const predicates = this.#buildPredicates();
    return entries
      .filter((entry) => predicates.every((predicate) => predicate(entry)))
      .sort(
        (a, b) =>
          CPRDocumentBrowser.#typeOrder(a) - CPRDocumentBrowser.#typeOrder(b) ||
          CPRDocumentBrowser.#compareTypeGroupEntries(a, b),
      );
  }

  /**
   * Sort key grouping entries by type in a stable order (item types first in
   * their config order, then actor types), so the results read like the gear
   * tab's grouped sections.
   *
   * @private
   * @param {object} entry
   * @returns {number}
   */
  static #typeOrder(entry) {
    const itemTypes = Object.keys(CPR.objectTypes);
    const actorTypes = Object.keys(CONFIG.Actor.dataModels);
    const itemIndex = itemTypes.indexOf(entry.type);
    if (entry.docClass === "Item" && itemIndex !== -1) return itemIndex;
    const actorIndex = actorTypes.indexOf(entry.type);
    if (actorIndex !== -1) return itemTypes.length + actorIndex;
    return itemTypes.length + actorTypes.length;
  }

  /**
   * Sort entries within a type group. Item upgrades sort first by their target
   * item type, then by name; every other group keeps the existing name sort.
   *
   * @private
   * @param {object} a
   * @param {object} b
   * @returns {number}
   */
  static #compareTypeGroupEntries(a, b) {
    if (a.type === "itemUpgrade" && b.type === "itemUpgrade") {
      const aUpgradeType = foundry.utils.getProperty(a, "system.type") ?? "";
      const bUpgradeType = foundry.utils.getProperty(b, "system.type") ?? "";
      return (
        aUpgradeType.localeCompare(bUpgradeType) || a.name.localeCompare(b.name)
      );
    }
    return a.name.localeCompare(b.name);
  }

  /**
   * Compile the active filter state into a list of predicate functions, all of
   * which an entry must satisfy.
   *
   * @private
   * @returns {Array<function(object): boolean>}
   */
  #buildPredicates() {
    const predicates = [];

    // Type-level include/exclude/only across the type boxes.
    const typePredicate = CPRDocumentBrowser.#tristatePredicate(
      this.filterState.types,
      (entry) => entry.type,
    );
    if (typePredicate) predicates.push(typePredicate);

    const name = this.filterState.name.trim().toLowerCase();
    if (name) {
      predicates.push((entry) => entry.name.toLowerCase().includes(name));
    }

    const { min, max } = this.filterState.price;
    if (min !== null || max !== null) {
      predicates.push((entry) => {
        const market = foundry.utils.getProperty(entry, "system.price.market");
        if (typeof market !== "number") return false;
        if (min !== null && market < min) return false;
        if (max !== null && market > max) return false;
        return true;
      });
    }

    const category = this.filterState.priceCategory;
    if (category.op !== "any" && category.value) {
      const target = CPR.itemPriceCategoryMap[category.value];
      predicates.push((entry) => {
        if (category.op === "eq") return entry.priceCategory === category.value;
        const current = CPR.itemPriceCategoryMap[entry.priceCategory];
        if (typeof current !== "number") return false;
        return category.op === "lte" ? current <= target : current >= target;
      });
    }

    const { quality } = this.filterState;
    if (quality) {
      predicates.push(
        (entry) =>
          foundry.utils.getProperty(entry, "system.quality") === quality,
      );
    }

    const { sourceScope } = this.filterState;
    if (sourceScope !== "any") {
      predicates.push((entry) =>
        sourceScope === "world"
          ? CPRDocumentBrowser.#sourceKind(entry) === "world"
          : CPRDocumentBrowser.#sourceKind(entry) === "compendium",
      );
    }

    for (const definition of this.#activeFilterDefs()) {
      const state = this.filterState.tristate[definition.id];
      const accessor = definition.multi
        ? (entry) =>
            (foundry.utils.getProperty(entry, definition.field) ?? [])
              .map((e) => e?.[definition.valueKey])
              .filter(Boolean)
        : (entry) => foundry.utils.getProperty(entry, definition.field);
      const predicate = CPRDocumentBrowser.#tristatePredicate(state, accessor);
      if (predicate) predicates.push(predicate);
    }

    this.#addPerTypeFilterPredicates(predicates);

    return predicates;
  }

  /**
   * Add the Type-tree predicates: a document-type include/exclude/only filter,
   * plus per-type sub-type filters scoped to entries of that type.
   *
   * @private
   * @param {Array<function(object): boolean>} predicates - mutated in place
   */
  #addPerTypeFilterPredicates(predicates) {
    for (const [type, defs] of Object.entries(CPR.browserFilters)) {
      for (const def of defs) {
        const predicate = this.#filterDefPredicate(type, def);
        // Per-type filters only constrain entries of their own type.
        if (predicate) {
          predicates.push((entry) => entry.type !== type || predicate(entry));
        }
      }
    }
  }

  /**
   * Compile one filter definition against the current state into a predicate (or
   * null when it adds no constraint). The predicate is unscoped — the caller
   * scopes it to the owning type.
   *
   * @private
   * @param {string} type
   * @param {object} def
   * @returns {function(object): boolean|null}
   */
  #filterDefPredicate(type, def) {
    switch (def.type) {
      case "set":
        return CPRDocumentBrowser.#tristatePredicate(
          this.filterState.sets[type]?.[def.id],
          (entry) => foundry.utils.getProperty(entry, def.field),
        );
      case "range":
        return CPRDocumentBrowser.#rangePredicate(
          this.filterState.ranges[type]?.[def.id],
          def,
        );
      case "damage":
        return CPRDocumentBrowser.#damagePredicate(
          this.filterState.ranges[type]?.[def.id],
          def,
        );
      case "boolean":
        return CPRDocumentBrowser.#booleanPredicate(
          this.filterState.booleans[type]?.[def.id],
          def.field,
        );
      case "toggle":
        return this.#togglePredicate(type, def);
      default:
        return null;
    }
  }

  /**
   * Numeric min/max predicate over a field (or any of `def.fields`).
   *
   * @private
   * @param {{min: ?number, max: ?number}|undefined} range
   * @param {object} def
   * @returns {function(object): boolean|null}
   */
  static #rangePredicate(range, def) {
    if (!range || (range.min == null && range.max == null)) return null;
    const { min, max } = range;
    const fields = def.fields ?? [def.field];
    const inRange = (value) => {
      if (typeof value !== "number") return false;
      if (min != null && value < min) return false;
      if (max != null && value > max) return false;
      return true;
    };
    // A value may be a single number or an array of candidates (e.g. an armor's
    // per-location SP); match if any candidate is in range. Derived defs compute
    // their candidates from the entry rather than reading a field path.
    const derive = def.derive
      ? CPRDocumentBrowser.#RANGE_DERIVERS[def.derive]
      : null;
    return (entry) => {
      if (derive) return derive(entry).some(inRange);
      return fields.some((field) => {
        const value = foundry.utils.getProperty(entry, field);
        return Array.isArray(value) ? value.some(inRange) : inRange(value);
      });
    };
  }

  /**
   * Value derivers for range filters whose candidates aren't a plain field path.
   * Computed at filter time from the entry's raw system fields so they don't
   * depend on a precomputed (and potentially stale) index field.
   */
  static #RANGE_DERIVERS = {
    armorSp: (entry) => CPRDocumentBrowser.#armorDefenceValues(entry),
  };

  /**
   * The defence values an armor actually uses: a shield's HP, or the SP of
   * whichever body/head locations it covers. Unused locations store stale
   * defaults (often 0), so they're excluded — otherwise a "max 7" filter would
   * match an 18-SP plate on its phantom 0.
   *
   * @private
   * @param {object} entry
   * @returns {Array<number>}
   */
  static #armorDefenceValues(entry) {
    const get = (path) => foundry.utils.getProperty(entry, path);
    if (get("system.isShield")) {
      const hp = get("system.shieldHitPoints.max");
      return typeof hp === "number" ? [hp] : [];
    }
    const values = [];
    if (get("system.isBodyLocation")) {
      const sp = get("system.bodyLocation.sp");
      if (typeof sp === "number") values.push(sp);
    }
    if (get("system.isHeadLocation")) {
      const sp = get("system.headLocation.sp");
      if (typeof sp === "number") values.push(sp);
    }
    return values;
  }

  /**
   * Min/max predicate over the die count parsed from a dice-string field.
   *
   * @private
   * @param {{min: ?number, max: ?number}|undefined} range
   * @param {object} def
   * @returns {function(object): boolean|null}
   */
  static #damagePredicate(range, def) {
    if (!range || (range.min == null && range.max == null)) return null;
    const { min, max } = range;
    return (entry) => {
      const dice = CPRDocumentBrowser.#dieCount(
        foundry.utils.getProperty(entry, def.field),
      );
      if (min != null && dice < min) return false;
      if (max != null && dice > max) return false;
      return true;
    };
  }

  /**
   * The leading die count of a damage value: the integer before the `d` in an
   * `XdY...` string (ignoring die size and modifiers), or 0 for a flat/blank
   * value.
   *
   * @private
   * @param {*} damage
   * @returns {number}
   */
  static #dieCount(damage) {
    const match = String(damage ?? "").match(/^\s*(\d+)\s*d/i);
    return match ? Number(match[1]) : 0;
  }

  /**
   * Tri-state predicate over a boolean field: include = no constraint, exclude =
   * must be falsy, only = must be truthy.
   *
   * @private
   * @param {"include"|"exclude"|"only"|undefined} state
   * @param {string} field
   * @returns {function(object): boolean|null}
   */
  static #booleanPredicate(state, field) {
    if (!state || state === "include") return null;
    const want = state === "only";
    return (entry) => Boolean(foundry.utils.getProperty(entry, field)) === want;
  }

  /**
   * On/off toggle predicate: when on, the field must be truthy and every nested
   * filter must also pass. When off, no constraint.
   *
   * @private
   * @param {string} type
   * @param {object} def
   * @returns {function(object): boolean|null}
   */
  #togglePredicate(type, def) {
    const state = this.filterState.toggles[type]?.[def.id];
    if (!state || state === "include") return null;
    if (state === "exclude") {
      return (entry) => !foundry.utils.getProperty(entry, def.field);
    }
    // "only": the field must be truthy and every nested filter must also pass.
    const nested = (def.filters ?? [])
      .map((nestedDef) => this.#filterDefPredicate(type, nestedDef))
      .filter(Boolean);
    return (entry) => {
      if (!foundry.utils.getProperty(entry, def.field)) return false;
      return nested.every((predicate) => predicate(entry));
    };
  }

  /**
   * Compile a tri-state state map into a single predicate, or null if it adds no
   * constraint. The accessor's result is normalized to an array (a scalar is
   * wrapped), so this covers both a single-valued accessor (e.g. an entry's
   * type) and a set-valued one (e.g. an item's several source books). Any
   * "only" states act as a whitelist — an entry passes if any of its values is
   * among them (multiple "only" values OR together); otherwise "exclude"
   * states act as a blacklist — an entry passes only if none of its values is
   * excluded.
   *
   * @private
   * @param {object|undefined} states - {value: "include"|"exclude"|"only"}
   * @param {function(object): (*|Array<*>)} accessor - reads the value(s) to test from an entry
   * @returns {function(object): boolean|null}
   */
  static #tristatePredicate(states, accessor) {
    if (!states) return null;
    const vals = (entry) => [accessor(entry)].flat();
    const only = Object.keys(states).filter((v) => states[v] === "only");
    if (only.length)
      return (entry) => vals(entry).some((v) => only.includes(v));
    const excluded = Object.keys(states).filter((v) => states[v] === "exclude");
    if (excluded.length)
      return (entry) => !vals(entry).some((v) => excluded.includes(v));
    return null;
  }

  /** @inheritDoc */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    // Keyboard support for the non-button [data-action] controls (the row-open
    // span and the icon links): translate Enter/Space on a focused control into
    // the click ApplicationV2's action handler already listens for. Native
    // <button> actions do this themselves, so they're skipped. Bound once here on
    // the persistent root element (per-part re-renders would otherwise stack it).
    this.element.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const action = event.target.closest("[data-action]");
      if (!action || action.tagName === "BUTTON") return;
      event.preventDefault();
      action.click();
    });
  }

  /** @inheritDoc */
  _onRender(context, options) {
    super._onRender(context, options);
    // The cart column only appears once items are added, and widens the window
    // to the right rather than shrinking the results.
    const hasCart = this.cart.length > 0;
    this.element.classList.toggle("cpr-browser-has-cart", hasCart);
    const width =
      CPRDocumentBrowser.BASE_WIDTH +
      (hasCart ? CPRDocumentBrowser.CART_WIDTH : 0);
    if (this.position.width !== width) this.setPosition({ width });
    const parts = options.parts ?? Object.keys(CPRDocumentBrowser.PARTS);

    if (parts.includes("globals")) this.#activateGlobalsListeners();
    if (parts.includes("sidebar")) this.#activateSidebarListeners();
    if (parts.includes("results")) this.#activateResultsListeners();
    if (parts.includes("cart")) this.#activateCartListeners();
  }

  /**
   * Wire the cart controls that aren't plain `data-action` buttons: the
   * buying-for actor selector.
   *
   * @private
   */
  #activateCartListeners() {
    this.element
      .querySelector(".cpr-browser-cart-actor-select")
      ?.addEventListener("change", (event) => {
        this.cartActorId = event.target.value || null;
        this.render({ parts: ["cart"] });
      });
  }

  /**
   * Wire the top global controls: name search, source scope, price range, and
   * price category.
   *
   * @private
   */
  #activateGlobalsListeners() {
    const root = this.element;

    const nameInput = root.querySelector(".cpr-browser-name-input");
    if (nameInput) {
      const debounced = foundry.utils.debounce((value) => {
        this.filterState.name = value;
        this.render({ parts: ["results"] });
      }, 200);
      nameInput.addEventListener("input", (event) =>
        debounced(event.target.value),
      );
    }

    root
      .querySelector(".cpr-browser-price-min")
      ?.addEventListener("change", (event) => {
        const { value } = event.target;
        this.filterState.price.min = value === "" ? null : Number(value);
        this.render({ parts: ["results"] });
      });

    root
      .querySelector(".cpr-browser-price-max")
      ?.addEventListener("change", (event) => {
        const { value } = event.target;
        this.filterState.price.max = value === "" ? null : Number(value);
        this.render({ parts: ["results"] });
      });

    root
      .querySelector(".cpr-browser-price-category-op")
      ?.addEventListener("change", (event) => {
        this.filterState.priceCategory.op = event.target.value;
        this.render({ parts: ["results"] });
      });

    root
      .querySelector(".cpr-browser-price-category-value")
      ?.addEventListener("change", (event) => {
        const { value } = event.target;
        this.filterState.priceCategory.value = value === "" ? null : value;
        this.render({ parts: ["results"] });
      });

    root
      .querySelector(".cpr-browser-source-scope")
      ?.addEventListener("change", (event) => {
        this.filterState.sourceScope = event.target.value;
        this.render({ parts: ["results"] });
      });

    root
      .querySelector(".cpr-browser-quality")
      ?.addEventListener("change", (event) => {
        this.filterState.quality = event.target.value;
        this.render({ parts: ["results"] });
      });
  }

  /**
   * Wire the left sidebar controls: the per-type filter boxes (collapse toggles,
   * tri-states, ranges, booleans and toggles) and the global tri-state filters.
   *
   * @private
   */
  #activateSidebarListeners() {
    const root = this.element;

    root.querySelectorAll(".cpr-browser-collapse-toggle").forEach((toggle) => {
      toggle.addEventListener("click", () => {
        const { collapse } = toggle.dataset;
        const fieldset = toggle.closest(".cpr-browser-collapsible");
        const collapsed = fieldset.classList.toggle("cpr-browser-collapsed");
        toggle
          .querySelector("i")
          ?.classList.toggle("fa-flip-vertical", collapsed);
        if (collapsed) this.expandedGroups.delete(collapse);
        else this.expandedGroups.add(collapse);
      });
    });

    // Per-type numeric range inputs (min/max), including damage die-count.
    root
      .querySelectorAll(".cpr-browser-range-min, .cpr-browser-range-max")
      .forEach((input) => {
        input.addEventListener("change", (event) => {
          const { type, filter } = event.target.dataset;
          const bound = event.target.classList.contains("cpr-browser-range-min")
            ? "min"
            : "max";
          const { value } = event.target;
          const bucket = (this.filterState.ranges[type] ??= {});
          (bucket[filter] ??= { min: null, max: null })[bound] =
            value === "" ? null : Number(value);
          this.render({ parts: ["results"] });
        });
      });

    this.#activateTristateListeners(root);
  }

  /**
   * Wire every tri-state toggle (the Type tree's type/sub-type nodes and the
   * quality/source-book filters). Clicking cycles include → only → exclude and
   * re-renders the results.
   *
   * @private
   * @param {HTMLElement} root
   */
  #activateTristateListeners(root) {
    const cycle = { include: "only", only: "exclude", exclude: "include" };
    root.querySelectorAll(".cpr-browser-tristate").forEach((toggle) => {
      const tooltip = CPRDocumentBrowser.#tristateTooltip(toggle.dataset.state);
      toggle.setAttribute("data-tooltip", tooltip);
      // The toggle is a role="button" span — not natively focusable or
      // keyboard-activatable — so make it both. Name it by its option (the
      // adjacent label) plus its current state for assistive technology.
      const label = toggle
        .closest(".cpr-browser-tristate-row, .cpr-browser-typebox-head")
        ?.querySelector(
          ".cpr-browser-tristate-label, .cpr-browser-tree-type-label",
        )
        ?.textContent?.trim();
      toggle.setAttribute("tabindex", "0");
      toggle.setAttribute(
        "aria-label",
        label ? `${label}: ${tooltip}` : tooltip,
      );
      const cycleState = () => {
        const next = cycle[toggle.dataset.state];
        this.#applyTristate(toggle, next);
        this.render({ parts: ["results"] });
      };
      toggle.addEventListener("click", cycleState);
      toggle.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        cycleState();
      });
    });
  }

  /**
   * Tri-state tooltip localization keys (kept as literal strings so the
   * unused-localization check can see them).
   */
  static #TRISTATE_TOOLTIP = {
    include: "CPR.browser.tristate.include",
    exclude: "CPR.browser.tristate.exclude",
    only: "CPR.browser.tristate.only",
  };

  /** Localized tooltip for a tri-state value. @private */
  static #tristateTooltip(state) {
    return SystemUtils.Localize(CPRDocumentBrowser.#TRISTATE_TOOLTIP[state]);
  }

  /**
   * Apply a tri-state value to a toggle: update its DOM (class/state/tooltip)
   * and the matching slot of the filter state, mirroring how the toggle is
   * keyed (type tree node, sub-type node, or a named filter option).
   *
   * @private
   * @param {HTMLElement} toggle
   * @param {"include"|"exclude"|"only"} state
   */
  #applyTristate(toggle, state) {
    toggle.dataset.state = state;
    toggle.className = `cpr-browser-tristate cpr-browser-tristate-${state}`;
    toggle.setAttribute(
      "data-tooltip",
      CPRDocumentBrowser.#tristateTooltip(state),
    );
    const {
      tree,
      type,
      filter,
      value,
      set,
      bool,
      toggle: isToggle,
    } = toggle.dataset;
    if (tree === "type") {
      this.filterState.types[type] = state;
      // A manual click on the box owns its state outright, so it is no longer an
      // auto-promotion a child could later undo.
      this.filterState.autoPromoted.delete(type);
      // Tri-state ⇄ collapse coupling: exclude collapses the box, only expands
      // it; include leaves the manual expand/collapse untouched.
      const box = toggle.closest(".cpr-browser-collapsible");
      if (state === "exclude") this.#setBoxExpanded(box, type, false);
      else if (state === "only") this.#setBoxExpanded(box, type, true);
    } else if (isToggle) {
      (this.filterState.toggles[type] ??= {})[filter] = state;
      // Reveal the nested stat filters only in the "only" state.
      toggle
        .closest(".cpr-browser-toggle-row")
        ?.querySelector(".cpr-browser-toggle-nested")
        ?.classList.toggle("cpr-browser-hidden", state !== "only");
    } else if (bool) {
      (this.filterState.booleans[type] ??= {})[filter] = state;
    } else if (set) {
      ((this.filterState.sets[type] ??= {})[filter] ??= {})[value] = state;
    } else {
      const { filterId } = toggle.closest(
        ".cpr-browser-filter-tristate",
      ).dataset;
      (this.filterState.tristate[filterId] ??= {})[value] = state;
    }

    // Choosing "only" on any in-box sub-filter implies you want only that type,
    // so promote the parent type box to "only" as well. Undoing that child (or
    // any sibling) leaves the box stuck on "only" unless we mirror the promotion
    // in reverse: once no sub-filter is "only" any more, demote a box we (not
    // the user) promoted back to "include".
    if (state === "only" && (set || bool || isToggle)) {
      this.#promoteTypeToOnly(toggle, type);
    } else if (
      (set || bool || isToggle) &&
      this.filterState.autoPromoted.has(type) &&
      !this.#typeHasOnlyChild(type)
    ) {
      this.#demoteTypeFromOnly(toggle, type);
    }
  }

  /**
   * Whether any of a type's in-box sub-filters (sets, booleans, toggles) is
   * currently in the "only" state.
   *
   * @private
   * @param {string} type
   * @returns {boolean}
   */
  #typeHasOnlyChild(type) {
    const sets = Object.values(this.filterState.sets[type] ?? {});
    if (sets.some((filter) => Object.values(filter).includes("only")))
      return true;
    if (Object.values(this.filterState.booleans[type] ?? {}).includes("only"))
      return true;
    return Object.values(this.filterState.toggles[type] ?? {}).includes("only");
  }

  /**
   * Set a sub-filter's owning type box to the "only" state — updating its
   * tri-state slider DOM and filter state, and expanding it — so an "only"
   * sub-selection scopes the whole browser to that type.
   *
   * @private
   * @param {HTMLElement} child - the sub-filter toggle that was set to "only"
   * @param {string} type
   */
  #promoteTypeToOnly(child, type) {
    const parentWasManualOnly =
      this.filterState.types[type] === "only" &&
      !this.filterState.autoPromoted.has(type);
    this.filterState.types[type] = "only";
    if (!parentWasManualOnly) this.filterState.autoPromoted.add(type);
    const box = child.closest(".cpr-browser-collapsible");
    const parent = box?.querySelector(
      '.cpr-browser-tristate[data-tree="type"]',
    );
    if (parent) {
      parent.dataset.state = "only";
      parent.className = "cpr-browser-tristate cpr-browser-tristate-only";
      parent.setAttribute(
        "data-tooltip",
        CPRDocumentBrowser.#tristateTooltip("only"),
      );
    }
    this.#setBoxExpanded(box, type, true);
  }

  /**
   * Undo an auto-promotion: return a type box we forced to "only" back to
   * "include", mirroring #promoteTypeToOnly's DOM update. The box's manual
   * expand/collapse is left untouched (as it is for a plain "include" click).
   *
   * @private
   * @param {HTMLElement} child - the sub-filter toggle that left "only"
   * @param {string} type
   */
  #demoteTypeFromOnly(child, type) {
    this.filterState.types[type] = "include";
    this.filterState.autoPromoted.delete(type);
    const box = child.closest(".cpr-browser-collapsible");
    const parent = box?.querySelector(
      '.cpr-browser-tristate[data-tree="type"]',
    );
    if (parent) {
      parent.dataset.state = "include";
      parent.className = "cpr-browser-tristate cpr-browser-tristate-include";
      parent.setAttribute(
        "data-tooltip",
        CPRDocumentBrowser.#tristateTooltip("include"),
      );
    }
  }

  /**
   * Expand or collapse a type box in the DOM and record it in expandedGroups, so
   * the state survives a sidebar re-render. No-op for boxes with no body.
   *
   * @private
   * @param {HTMLElement|null} box - the `.cpr-browser-collapsible` fieldset
   * @param {string} type
   * @param {boolean} expanded
   */
  #setBoxExpanded(box, type, expanded) {
    if (!box) return;
    // Boxes with no body (no sub-filters, e.g. Gear) can't expand — expanding
    // would just draw a border around empty space, so keep them collapsed.
    if (expanded && !box.querySelector(".cpr-browser-collapse-body")) return;
    box.classList.toggle("cpr-browser-collapsed", !expanded);
    box
      .querySelector(".cpr-browser-collapse-toggle i")
      ?.classList.toggle("fa-flip-vertical", !expanded);
    if (expanded) this.expandedGroups.add(`box:${type}`);
    else this.expandedGroups.delete(`box:${type}`);
  }

  /**
   * Wire results-list interactions: delegated drag-out and progressive load.
   *
   * @private
   */
  #activateResultsListeners() {
    if (this._loadHandle) cancelAnimationFrame(this._loadHandle);
    this._loadHandle = null;
    this._lastGroupType = null;

    const list = this.element.querySelector(".cpr-browser-results-list");
    if (!list) return;
    list.addEventListener("dragstart", CPRDocumentBrowser.#onDragStart);
    list.addEventListener("click", CPRDocumentBrowser.#onInstalledNameClick);
    list.addEventListener("click", (event) => this.#onGroupHeaderClick(event));

    if (this._rendered < this._results.length) {
      this._loadHandle = requestAnimationFrame(() => this.#appendBatch());
    }
  }

  /**
   * Toggle a result-list group (collapsing/expanding all of a type's rows, plus
   * any expanded install trees, beneath its header). The collapsed set persists
   * across re-renders so progressively-appended rows of a collapsed group stay
   * hidden.
   *
   * @private
   * @param {PointerEvent} event
   */
  #onGroupHeaderClick(event) {
    const header = event.target.closest(".cpr-browser-group-header");
    if (!header) return;
    const group = header.dataset.group;
    const collapsed = !this._collapsedGroups.has(group);
    if (collapsed) this._collapsedGroups.add(group);
    else this._collapsedGroups.delete(group);
    header.classList.toggle("cpr-browser-group-collapsed", collapsed);
    header.querySelector("i")?.classList.toggle("fa-flip-vertical", collapsed);
    // Hide/show every following sibling until the next group header.
    let sibling = header.nextElementSibling;
    while (sibling && !sibling.classList.contains("cpr-browser-group-header")) {
      sibling.classList.toggle("cpr-browser-hidden", collapsed);
      sibling = sibling.nextElementSibling;
    }
  }

  /**
   * Open the sheet of an installed item whose name is clicked inside an expanded
   * tree. The rows carry the world item's id (the install renderer's markup);
   * compendium-embedded children aren't real documents, so those resolve to
   * nothing and are simply ignored.
   *
   * @private
   * @param {PointerEvent} event
   */
  static #onInstalledNameClick(event) {
    const name = event.target.closest(".cpr-browser-installed .item-view");
    if (!name) return;
    const { itemId } = name.closest("[data-item-id]")?.dataset ?? {};
    if (itemId) game.items.get(itemId)?.sheet?.render(true);
  }

  /**
   * Append the next batch of result rows to the list — inserting a group header
   * whenever the type changes — and schedule the following batch, keeping the
   * loading footer in sync until the full set is rendered.
   *
   * @async
   * @private
   */
  async #appendBatch() {
    const list = this.element?.querySelector(".cpr-browser-results-list");
    if (!list) return;

    const next = this._results.slice(
      this._rendered,
      this._rendered + CPRDocumentBrowser.BATCH_SIZE,
    );
    const entryPath = `systems/${CPR.systemId}/templates/apps/browser/cpr-browser-entry.hbs`;
    let html = "";
    for (const [offset, entry] of next.entries()) {
      const collapsed = this._collapsedGroups.has(entry.type);
      const row = CPRDocumentBrowser.#toRow(entry);
      row.groupCollapsed = collapsed;
      // Stripe by the result's overall position so headers between rows don't
      // disturb the alternation.
      row.rowParity = (this._rendered + offset) % 2 === 0 ? "even" : "odd";
      if (entry.type !== this._lastGroupType) {
        this._lastGroupType = entry.type;
        html +=
          `<li class="cpr-browser-group-header${collapsed ? " cpr-browser-group-collapsed" : ""}" data-group="${entry.type}">` +
          `<i class="fa-solid fa-chevron-up fa-sm${collapsed ? " fa-flip-vertical" : ""}"></i>` +
          `<span>${row.typeLabel}</span></li>`;
      }
      html += await foundry.applications.handlebars.renderTemplate(
        entryPath,
        row,
      );
    }
    list.insertAdjacentHTML("beforeend", html);
    this._rendered += next.length;
    this.#updateResultsFooter();

    if (this._rendered < this._results.length) {
      this._loadHandle = requestAnimationFrame(() => this.#appendBatch());
    } else {
      this._loadHandle = null;
    }
  }

  /**
   * Update the "showing N of M" footer and its loading indicator.
   *
   * @private
   */
  #updateResultsFooter() {
    const footer = this.element?.querySelector(".cpr-browser-results-footer");
    if (!footer) return;
    const done = this._rendered >= this._results.length;
    footer.classList.toggle("cpr-browser-loading", !done);
    const count = footer.querySelector(".cpr-browser-result-count");
    if (count) {
      count.textContent = SystemUtils.Format("CPR.browser.showingCount", {
        shown: this._rendered,
        total: this._results.length,
      });
    }
  }

  /**
   * Set the Foundry-standard drag payload so existing sheet drop handlers can
   * create a copy of the dragged document. Drag-out is GM-only: in shop mode
   * (players) it is suppressed so items can't be copied to a sheet for free,
   * mirroring the non-draggable rows (defense-in-depth).
   *
   * @private
   * @param {DragEvent} event
   */
  static #onDragStart(event) {
    if (CPRDocumentBrowser.#isShop()) {
      event.preventDefault();
      return;
    }
    const row = event.target.closest("[data-uuid]");
    if (!row) return;
    const { uuid, docClass } = row.dataset;
    event.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ type: docClass, uuid }),
    );
  }

  /** @inheritDoc */
  _onClose(options) {
    if (this._loadHandle) cancelAnimationFrame(this._loadHandle);
    this._loadHandle = null;
    super._onClose(options);
  }

  /**
   * Reset all filters back to their defaults.
   *
   * @this {CPRDocumentBrowser}
   */
  static clearFilters() {
    this.filterState = CPRDocumentBrowser.#emptyFilterState();
    this.render({ parts: ["globals", "sidebar", "results"] });
  }

  /**
   * Rebuild the index from scratch and re-render the sidebar filters and the
   * results. The sidebar must re-render too: the dynamic filter option lists
   * (Source Books, Brand) are derived from the indexed entries, so a
   * results-only render would leave a newly-added book or brand missing from
   * its filter until the browser was fully closed and reopened.
   *
   * @this {CPRDocumentBrowser}
   */
  static async refreshIndex() {
    await CPRBrowserIndex.rebuild();
    this.render({ parts: ["sidebar", "results"] });
  }

  /**
   * Open the GM compendia-selection settings directly from the browser. Saving
   * there refreshes this browser via the browserActiveCompendia onChange.
   *
   * @this {CPRDocumentBrowser}
   */
  static openCompendiaSettings() {
    new CPRBrowserCompendiaSettings().render(true);
  }

  /**
   * Open the sheet of the clicked entry, resolving the full document on demand.
   *
   * @this {CPRDocumentBrowser}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async openDocument(event, target) {
    const row = target.closest("[data-uuid]");
    if (!row) return;
    const document = await fromUuid(row.dataset.uuid);
    document?.sheet?.render(true);
  }

  /**
   * Toggle the nested installed-items tree under a result row, resolving the
   * full item on demand and reusing the character sheet's install-tree renderer.
   *
   * @this {CPRDocumentBrowser}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async toggleInstalled(event, target) {
    const row = target.closest("[data-uuid]");
    const icon = target.querySelector("i");
    const next = row.nextElementSibling;
    if (next?.classList.contains("cpr-browser-installed")) {
      next.remove();
      icon?.classList.add("fa-flip-vertical");
      this.#resizeInstalledTags();
      return;
    }
    const item = await fromUuid(row.dataset.uuid);
    // Read-only tree: works for world items (children resolved live) and
    // compendium items (children from the embedded flag); empty when there is
    // no resolvable install data (e.g. a stale compendium item).
    const html = item
      ? renderInstalledTree(item, {
          interactive: false,
          alwaysExpanded: true,
        }).toString()
      : "";
    if (!html) {
      icon?.classList.add("fa-flip-vertical");
      return;
    }
    const wrapper = document.createElement("li");
    wrapper.classList.add("cpr-browser-installed");
    wrapper.innerHTML = html;
    row.after(wrapper);
    icon?.classList.remove("fa-flip-vertical");
    this.#resizeInstalledTags();
  }

  /**
   * Give every visible installed-item type chip a uniform width sized to the
   * widest one, reusing the same routine the actor/item sheets use so the chips
   * look identical across the system.
   *
   * @private
   */
  #resizeInstalledTags() {
    window.requestAnimationFrame(() => {
      if (this.element)
        CPRSheetUtils.setCssClassWidth(
          this.element,
          ".cpr-browser-installed .type-tag",
        );
    });
  }

  /**
   * Add the clicked item to the shopping cart (shop mode).
   *
   * @this {CPRDocumentBrowser}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static addToCart(event, target) {
    const row = target.closest("[data-uuid]");
    if (!row) return;
    const { uuid } = row.dataset;
    // Adding an item already in the cart bumps its quantity rather than
    // refusing — players can buy multiples of the same item.
    const existing = this.cart.find((item) => item.uuid === uuid);
    if (existing) {
      existing.quantity += 1;
      this.render({ parts: ["cart"] });
      return;
    }
    const entry = this._results.find((result) => result.uuid === uuid);
    if (!entry) return;
    this.cart.push({
      uuid,
      name: entry.name,
      img: entry.img,
      brand: foundry.utils.getProperty(entry, "system.brand") || "",
      price: foundry.utils.getProperty(entry, "system.price.market") ?? 0,
      priceCategory: entry.priceCategory,
      quantity: 1,
    });
    this.render({ parts: ["cart"] });
  }

  /**
   * Adjust a cart line's quantity by the clicked control's delta, removing the
   * line if it drops below one.
   *
   * @this {CPRDocumentBrowser}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static adjustCartItem(event, target) {
    const row = target.closest("[data-cart-uuid]");
    if (!row) return;
    const { cartUuid } = row.dataset;
    const delta = Number(target.dataset.delta);
    const line = this.cart.find((item) => item.uuid === cartUuid);
    if (!line) return;
    line.quantity += delta;
    if (line.quantity < 1) {
      this.cart = this.cart.filter((item) => item.uuid !== cartUuid);
    }
    this.render({ parts: ["cart"] });
  }

  /**
   * Remove the clicked line from the shopping cart.
   *
   * @this {CPRDocumentBrowser}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static removeFromCart(event, target) {
    const row = target.closest("[data-cart-uuid]");
    if (!row) return;
    const { cartUuid } = row.dataset;
    this.cart = this.cart.filter((item) => item.uuid !== cartUuid);
    this.render({ parts: ["cart"] });
  }

  /**
   * Format a number the way prices are shown (delegates to the cprNumberFormat
   * helper). Used where the surrounding localized string already carries the
   * currency unit.
   *
   * @private
   * @param {number} value
   * @returns {string}
   */
  static #formatNumber(value) {
    return Handlebars.helpers.cprNumberFormat(value, { hash: {} });
  }

  /**
   * A localized eb (eurobucks) amount, e.g. "500eb" — keeping the currency unit
   * inside a translatable string rather than concatenated in markup/code. Shared
   * by the result rows, cart, ledger reason and chat log.
   *
   * @private
   * @param {number} value
   * @returns {string}
   */
  static #money(value) {
    return SystemUtils.Format("CPR.browser.price.amount", {
      amount: CPRDocumentBrowser.#formatNumber(value),
    });
  }

  /**
   * The " ×N" multiplier suffix shown for a line of more than one (empty for a
   * single). Shared by the ledger reason and the chat log.
   *
   * @private
   * @param {number} quantity
   * @returns {string}
   */
  static #qtySuffix(quantity) {
    return quantity > 1 ? ` ×${quantity}` : "";
  }

  /**
   * Check out the cart: confirm, verify funds, add every item to the player's
   * character, record each spend on the wealth ledger, and log to chat.
   *
   * @this {CPRDocumentBrowser}
   */
  static async purchaseCart() {
    const character = this.cartActor;
    if (!character) {
      SystemUtils.DisplayMessage(
        "warn",
        SystemUtils.Localize("CPR.browser.purchase.noCharacter"),
      );
      return;
    }
    if (!this.cart.length) return;

    const total = this.cart.reduce(
      (sum, line) => sum + line.price * line.quantity,
      0,
    );
    const count = this.cart.reduce((sum, line) => sum + line.quantity, 0);
    if (character.system.wealth.value < total) {
      // Block the purchase but keep the cart intact so the player can adjust it.
      SystemUtils.DisplayMessage(
        "warn",
        SystemUtils.Localize("CPR.browser.purchase.insufficientFunds"),
      );
      return;
    }

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: SystemUtils.Localize("CPR.browser.purchase.confirmTitle"),
      },
      content: SystemUtils.Format("CPR.browser.purchase.confirmContent", {
        count,
        total: CPRDocumentBrowser.#formatNumber(total),
      }),
    });
    if (!confirmed) return;

    // Create `quantity` copies of each line on the character. A line whose item
    // no longer resolves (deleted, or its compendium disabled, since it was
    // added to the cart) is skipped — so the buyer is only ever charged for the
    // items they actually receive.
    const purchased = [];
    for (const line of this.cart) {
      const item = await fromUuid(line.uuid);
      if (!item) continue;
      const copies = Array.from({ length: line.quantity }, () =>
        item.toObject(),
      );
      const owned = await character.createEmbeddedDocuments("Item", copies);
      purchased.push({
        uuid: owned[0]?.uuid ?? item.uuid,
        name: item.name,
        img: item.img,
        price: line.price,
        quantity: line.quantity,
      });
    }

    if (purchased.length) {
      await CPRDocumentBrowser.#recordPurchaseChat(character, purchased);
      // Charge only for the lines actually purchased, on one ledger entry that
      // lists each item with its quantity and line price.
      const spent = purchased.reduce(
        (sum, line) => sum + line.price * line.quantity,
        0,
      );
      const lines = purchased
        .map(
          (line) =>
            `- ${line.name}${CPRDocumentBrowser.#qtySuffix(
              line.quantity,
            )}: ${CPRDocumentBrowser.#money(line.price * line.quantity)}`,
        )
        .join("<br />");
      const reason = `<p>${SystemUtils.Localize(
        "CPR.browser.purchase.reason",
      )}:</p>${lines}`;
      await character.deltaLedgerProperty("wealth", -spent, reason);
    }

    this.cart = [];
    this.render({ parts: ["cart"] });
  }

  /** Window (ms) within which further purchases update the same chat message. */
  static PURCHASE_LOG_WINDOW = 10 * 60 * 1000;

  /**
   * Post a purchase to chat, or append to the buyer's existing purchase log if
   * one was posted within PURCHASE_LOG_WINDOW. Each line shows the item icon and
   * a content link that opens the purchased item's sheet.
   *
   * @async
   * @private
   * @param {Actor} character - the buyer
   * @param {Array<{uuid: string, name: string, img: string, price: number, quantity: number}>} entries
   */
  static async #recordPurchaseChat(character, entries) {
    const now = Date.now();

    const existing = game.messages.contents
      .filter((message) => {
        const log = message.getFlag(game.system.id, "purchaseLog");
        return (
          log && log.actorId === character.id && log.userId === game.user.id
        );
      })
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    const log = existing?.getFlag(game.system.id, "purchaseLog");

    if (
      existing &&
      now - log.updated <= CPRDocumentBrowser.PURCHASE_LOG_WINDOW
    ) {
      const items = [...log.items, ...entries];
      await existing.update({
        content: CPRDocumentBrowser.#purchaseLogContent(items),
        [`flags.${game.system.id}.purchaseLog.items`]: items,
        [`flags.${game.system.id}.purchaseLog.updated`]: now,
      });
      return;
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: character }),
      content: CPRDocumentBrowser.#purchaseLogContent(entries),
      flags: {
        [game.system.id]: {
          purchaseLog: {
            actorId: character.id,
            userId: game.user.id,
            updated: now,
            items: entries,
          },
        },
      },
    });
  }

  /**
   * Build the HTML for a purchase-log chat message from its line items.
   *
   * @private
   * @param {Array<{uuid: string, name: string, img: string, price: number, quantity: number}>} items
   * @returns {string}
   */
  static #purchaseLogContent(items) {
    const total = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const lines = items
      .map((item) => {
        const qty = CPRDocumentBrowser.#qtySuffix(item.quantity);
        const lineTotal = CPRDocumentBrowser.#money(item.price * item.quantity);
        return (
          `<li class="cpr-purchase-log-line">` +
          `<img class="cpr-purchase-log-icon" src="${item.img}" alt="" />` +
          ` @UUID[${item.uuid}]{${item.name}}${qty} ` +
          `<span class="cpr-purchase-log-cost">${lineTotal}</span></li>`
        );
      })
      .join("");
    return (
      `<div class="cpr-purchase-log">` +
      `<p class="cpr-purchase-log-header">${SystemUtils.Localize(
        "CPR.browser.purchase.logHeader",
      )}:</p>` +
      `<ul class="cpr-purchase-log-list">${lines}</ul>` +
      `<p class="cpr-purchase-log-total">${SystemUtils.Format(
        "CPR.browser.purchase.logTotal",
        { total: CPRDocumentBrowser.#formatNumber(total) },
      )}</p>` +
      `</div>`
    );
  }
}
