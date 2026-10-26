import CPR from "../../system/config.js";
import LOGGER from "../../utils/cpr-logger.js";
import SystemUtils from "../../utils/cpr-systemUtils.js";

/**
 * Lazy, session-scoped index powering the document browser (CPRDocumentBrowser).
 *
 * It builds a flat array of lightweight, source-agnostic entries for every
 * Item/Actor the current user can see, drawing from both world collections
 * (full documents) and compendium packs (via `pack.getIndex({ fields })` so
 * full documents are never loaded just to list them). Full documents are
 * resolved lazily with `fromUuid` only when a row is opened or dragged.
 *
 * The cache is built on first request, kept fresh by document create/update/
 * delete hooks, and can be rebuilt wholesale via the browser's refresh button.
 */
export default class CPRBrowserIndex {
  /** @type {Array<object>|null} cached Item entries, null until built */
  static #items = null;

  /** @type {Array<object>|null} cached Actor entries, null until built */
  static #actors = null;

  /** @type {{Item: Promise|null, Actor: Promise|null}} in-flight build guards */
  static #building = { Item: null, Actor: null };

  /** @type {boolean} whether freshness hooks have been wired */
  static #hooksRegistered = false;

  /**
   * Index fields requested from compendium packs for Items. These mirror the
   * dot paths used by CPR.browserFilters plus the universal price path, so the
   * filter predicates work identically against world and compendium entries.
   *
   * INVARIANT: every `system.*` path read by a filter (CPR.browserFilters and
   * the range derivers), a stat chip (cpr-browser-chips.js) or a result row
   * (#toRow) must appear here. Compendium entries carry only these fields, so a
   * path omitted here silently reads `undefined` for compendium content even
   * though it works for world items (which keep their full system data).
   */
  static ITEM_FIELDS = [
    "img",
    "system.description.value",
    "system.type",
    "system.variety",
    "system.style",
    "system.weaponType",
    "system.isFoundational",
    "system.installLocation",
    "system.isWeapon",
    "system.modifiers.secondaryWeapon.configured",
    "system.isElectronic",
    "system.providesHardening",
    "system.isBodyLocation",
    "system.isHeadLocation",
    "system.isShield",
    "system.class",
    "system.quality",
    "system.sources",
    "system.brand",
    "system.installedItems",
    "system.ignoredByBrowser",
    "system.price.market",
    "system.rof",
    "system.fireModes.autoFire",
    "system.fireModes.suppressiveFire",
    "system.damage",
    "system.attackmod",
    "system.magazine.max",
    "system.handsReq",
    "system.concealable.concealable",
    "system.bodyLocation.sp",
    "system.headLocation.sp",
    "system.shieldHitPoints.max",
    "system.penalty",
    "system.ablationValue",
    "system.overrides.damage.mode",
    "system.overrides.damage.value",
    "system.amount",
    "system.humanityLoss.static",
    "system.humanityLoss.roll",
    "system.atk",
    "system.def",
    "system.per",
    "system.spd",
    "system.rez.max",
    "system.floors",
    "system.sdp",
    "system.seats",
    "system.speedCombat",
  ];

  /** Index fields requested from compendium packs for Actors. */
  static ACTOR_FIELDS = ["img"];

  /**
   * Return the cached entries for a document class, building the index on first
   * request. Concurrent callers share a single in-flight build.
   *
   * @async
   * @param {"Item"|"Actor"} docClass - the document class to index
   * @returns {Promise<Array<object>>} the normalized entries
   */
  static async getEntries(docClass) {
    this.#registerHooks();
    const key = docClass === "Actor" ? "Actor" : "Item";
    const cache = this.#cacheFor(key);
    if (cache !== null) return cache;
    if (!this.#building[key]) {
      this.#building[key] = this.#build(key).finally(() => {
        this.#building[key] = null;
      });
    }
    return this.#building[key];
  }

  /**
   * Discard the cached indices so the next request rebuilds them from scratch.
   * Used by the browser's manual refresh control for bulk/compendium changes
   * the incremental hooks can't catch one-by-one. Any in-flight build is
   * abandoned too, so a refresh during a build doesn't re-cache stale data.
   *
   * @async
   */
  static async rebuild() {
    this.#items = null;
    this.#actors = null;
    this.#building.Item = null;
    this.#building.Actor = null;
  }

  /**
   * Build the index for one document class from world docs + visible packs.
   *
   * @async
   * @private
   * @param {"Item"|"Actor"} docClass
   * @returns {Promise<Array<object>>}
   */
  static async #build(docClass) {
    const isActor = docClass === "Actor";
    const fields = isActor ? this.ACTOR_FIELDS : this.ITEM_FIELDS;
    const worldCollection = isActor ? game.actors : game.items;
    const entries = [];

    // World documents (full documents — read fields directly).
    for (const doc of worldCollection) {
      if (this.#shouldIndexDoc(doc)) entries.push(this.#entryFromDocument(doc));
    }

    // Compendium packs (lightweight indices fetched in parallel): only those
    // eligible at the system level, kept active by the GM, and visible.
    const packs = game.packs.filter(
      (pack) =>
        pack.documentName === docClass &&
        this.isPackEligible(pack) &&
        this.#isPackActive(pack) &&
        (game.user.isGM || pack.visible),
    );
    const results = await Promise.all(
      packs.map(async (pack) => {
        try {
          const index = await pack.getIndex({ fields });
          return { pack, index };
        } catch (error) {
          LOGGER.error(
            `Document browser failed to index pack ${pack.metadata.id}: ${error}`,
          );
          return null;
        }
      }),
    );
    for (const result of results) {
      if (!result) continue;
      for (const indexEntry of result.index) {
        if (this.#isExcludedType(docClass, indexEntry.type)) continue;
        if (this.#isIgnoredByBrowser(indexEntry)) continue;
        entries.push(this.#entryFromIndex(indexEntry, result.pack));
      }
    }

    if (isActor) this.#actors = entries;
    else this.#items = entries;
    LOGGER.debug(
      `Document browser indexed ${entries.length} ${docClass} entries`,
    );
    return entries;
  }

  /**
   * Whether a document should be indexed: viewable, not an excluded item type,
   * and not from an internal compendium.
   *
   * @private
   * @param {Document} doc
   * @returns {boolean}
   */
  static #shouldIndexDoc(doc) {
    // Only world-directory and compendium items belong in the browser — never
    // items embedded on an actor/sheet. Those fire the same create/update hooks,
    // but an embedded document has a parent, so exclude it.
    if (doc.isEmbedded || doc.parent) return false;
    if (!this.#canView(doc)) return false;
    if (this.#isExcludedType(doc.documentName, doc.type)) return false;
    if (this.#isIgnoredByBrowser(doc)) return false;
    if (!doc.pack) return true;
    const pack = this.#packById(doc.pack);
    return !!pack && this.isPackEligible(pack) && this.#isPackActive(pack);
  }

  /**
   * Whether a document opts out of the browser via its `ignoredByBrowser` flag.
   *
   * @private
   * @param {Document|object} source
   * @returns {boolean}
   */
  static #isIgnoredByBrowser(source) {
    return (
      foundry.utils.getProperty(source, "system.ignoredByBrowser") === true
    );
  }

  /**
   * Whether the current user may view a document. GMs see everything; for
   * compendium documents the pack's visibility governs, for world documents the
   * document's own ownership does.
   *
   * @private
   * @param {Document} doc
   * @returns {boolean}
   */
  static #canView(doc) {
    if (game.user.isGM) return true;
    if (doc.pack) return this.#packById(doc.pack)?.visible ?? false;
    return doc.testUserPermission(game.user, "LIMITED");
  }

  /**
   * Whether an item type is excluded from the browser (character mechanics
   * rather than discoverable content). Only applies to Items.
   *
   * @private
   * @param {string} docClass
   * @param {string} type
   * @returns {boolean}
   */
  static #isExcludedType(docClass, type) {
    return docClass === "Item" && CPR.browserExcludedItemTypes.includes(type);
  }

  /**
   * Whether a pack may appear in the browser at the system level. A pack is
   * eligible when it is not in CPR.browserIgnoredPacks (the system-internal
   * packs) and it belongs to the active world or declares this system. Both the
   * system's own packs and a module's content packs set `metadata.system`, which
   * (unlike module relationships) survives the dev builds that strip them, so it
   * is the reliable signal. Shared by the index and the GM compendia settings
   * menu so they agree on eligibility.
   *
   * @param {CompendiumCollection} pack
   * @returns {boolean}
   */
  static isPackEligible(pack) {
    if (CPR.browserIgnoredPacks.includes(pack.metadata.id)) return false;
    if (pack.metadata.packageType === "world") return true;
    return pack.metadata.system === game.system.id;
  }

  /**
   * Resolve a pack collection by its id. Uses `find` rather than
   * `game.packs.get`, which the compendia-use lint forbids outside SystemUtils.
   *
   * @private
   * @param {string} id - the pack collection id
   * @returns {CompendiumCollection|undefined}
   */
  static #packById(id) {
    return game.packs.find((pack) => pack.metadata.id === id);
  }

  /**
   * Whether the GM has kept a pack active in the browser (active unless
   * explicitly disabled in the browser-compendia setting).
   *
   * @private
   * @param {CompendiumCollection} pack
   * @returns {boolean}
   */
  static #isPackActive(pack) {
    const active = game.settings.get(game.system.id, "browserActiveCompendia");
    return active[pack.metadata.id] !== false;
  }

  /**
   * Normalize a full document into an index entry.
   *
   * @private
   * @param {Document} doc
   * @returns {object}
   */
  static #entryFromDocument(doc) {
    const pack = doc.pack ? this.#packById(doc.pack) : null;
    return this.#entry(doc, {
      uuid: doc.uuid,
      name: doc.name,
      img: doc.img,
      docClass: doc.documentName,
      type: doc.type,
      source: pack ? pack.metadata.id : "world",
      sourceLabel: pack
        ? pack.metadata.label
        : SystemUtils.Localize("CPR.browser.source.world"),
    });
  }

  /**
   * Normalize a compendium index record into an index entry.
   *
   * @private
   * @param {object} indexEntry - a record from pack.getIndex
   * @param {CompendiumCollection} pack
   * @returns {object}
   */
  static #entryFromIndex(indexEntry, pack) {
    return this.#entry(indexEntry, {
      uuid: indexEntry.uuid,
      name: this.#translateName(pack, indexEntry),
      img: indexEntry.img,
      docClass: pack.documentName,
      type: indexEntry.type,
      source: pack.metadata.id,
      sourceLabel: pack.metadata.label,
    });
  }

  /**
   * Assemble a normalized entry from a raw source (a full document or a
   * compendium index record) and the per-source identity already resolved by
   * the caller. The computed fields (price category, armour location, drug type)
   * and the stored `system` data are derived from `raw`, so both index paths
   * produce an identically-shaped entry.
   *
   * @private
   * @param {Document|object} raw - the document or index record to read from
   * @param {object} identity - {uuid, name, img, docClass, type, source, sourceLabel}
   * @returns {object}
   */
  static #entry(raw, { uuid, name, img, docClass, type, source, sourceLabel }) {
    return {
      uuid,
      name,
      img,
      docClass,
      type,
      system: raw.system ?? {},
      priceCategory: this.#priceCategoryFor(raw),
      armorLocation: this.#armorLocationFor(raw),
      drugType: this.#drugTypeFor(raw),
      source,
      sourceLabel,
    };
  }

  /**
   * The display name for a compendium index entry, translated by Babele when it
   * is active. A fresh getIndex with custom fields isn't covered by Babele's
   * index translation, so translate the name explicitly. No-op (returns the raw
   * name) when Babele is absent.
   *
   * @private
   * @param {CompendiumCollection} pack
   * @param {object} indexEntry
   * @returns {string}
   */
  static #translateName(pack, indexEntry) {
    const babele = game.babele;
    if (!babele) return indexEntry.name;
    try {
      if (typeof babele.translateField === "function") {
        return (
          babele.translateField("name", pack.metadata.id, indexEntry) ??
          indexEntry.name
        );
      }
      if (typeof babele.translate === "function") {
        return (
          babele.translate(pack.metadata.id, indexEntry)?.name ??
          indexEntry.name
        );
      }
    } catch (error) {
      LOGGER.warn(
        `Babele name translation failed for ${pack.metadata.id}: ${error}`,
      );
    }
    return indexEntry.name;
  }

  /**
   * Derive an armor's location sub-type (body / head / both / shield) from its
   * location and shield flags. Undefined for non-armor entries.
   *
   * @private
   * @param {Document|object} source
   * @returns {string|undefined}
   */
  static #armorLocationFor(source) {
    if (foundry.utils.getProperty(source, "type") !== "armor") return undefined;
    if (foundry.utils.getProperty(source, "system.isShield")) return "shield";
    const body = foundry.utils.getProperty(source, "system.isBodyLocation");
    const head = foundry.utils.getProperty(source, "system.isHeadLocation");
    if (body && head) return "both";
    if (head) return "head";
    if (body) return "body";
    return undefined;
  }

  /**
   * Derive a drug's category from its price: free drugs (market 0) are treated
   * as pharmaceuticals, priced drugs as street drugs. Undefined for non-drugs.
   *
   * @private
   * @param {Document|object} source
   * @returns {string|undefined}
   */
  static #drugTypeFor(source) {
    if (foundry.utils.getProperty(source, "type") !== "drug") return undefined;
    const market = foundry.utils.getProperty(source, "system.price.market");
    if (typeof market !== "number") return undefined;
    return market === 0 ? "pharmaceutical" : "street";
  }

  /**
   * The canonical price category for an entry, matching what item sheets show.
   * Reuses the system's cprGetPriceCategory helper so the browser never drifts
   * from the rest of the system. Undefined for entries without a market price.
   *
   * @private
   * @param {Document|object} source - a document or compendium index record
   * @returns {string|undefined}
   */
  static #priceCategoryFor(source) {
    const market = foundry.utils.getProperty(source, "system.price.market");
    if (typeof market !== "number") return undefined;
    return Handlebars.helpers.cprGetPriceCategory(market);
  }

  /**
   * Register the create/update/delete hooks that keep a built index fresh.
   * Idempotent — safe to call on every getEntries.
   *
   * @private
   */
  static #registerHooks() {
    if (this.#hooksRegistered) return;
    this.#hooksRegistered = true;
    for (const docClass of ["Item", "Actor"]) {
      Hooks.on(`create${docClass}`, (doc) => this.#onCreate(doc));
      Hooks.on(`update${docClass}`, (doc) => this.#onUpdate(doc));
      Hooks.on(`delete${docClass}`, (doc) => this.#onDelete(doc));
    }
  }

  /**
   * The cached array for a document name, or null if not yet built.
   *
   * @private
   * @param {string} docClass
   * @returns {Array<object>|null}
   */
  static #cacheFor(docClass) {
    return docClass === "Actor" ? this.#actors : this.#items;
  }

  /** @private @param {Document} doc */
  static #onCreate(doc) {
    const cache = this.#cacheFor(doc.documentName);
    if (!cache || !this.#shouldIndexDoc(doc)) return;
    cache.push(this.#entryFromDocument(doc));
  }

  /** @private @param {Document} doc */
  static #onUpdate(doc) {
    const cache = this.#cacheFor(doc.documentName);
    if (!cache) return;
    const index = cache.findIndex((entry) => entry.uuid === doc.uuid);
    const viewable = this.#shouldIndexDoc(doc);
    if (index === -1) {
      if (viewable) cache.push(this.#entryFromDocument(doc));
    } else if (viewable) {
      cache[index] = this.#entryFromDocument(doc);
    } else {
      cache.splice(index, 1);
    }
  }

  /** @private @param {Document} doc */
  static #onDelete(doc) {
    const cache = this.#cacheFor(doc.documentName);
    if (!cache) return;
    const index = cache.findIndex((entry) => entry.uuid === doc.uuid);
    if (index !== -1) cache.splice(index, 1);
  }
}
