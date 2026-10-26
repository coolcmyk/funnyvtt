import CPR from "../system/config.js";
import SystemUtils from "../utils/cpr-systemUtils.js";

/*
 * The single source of truth for an item's curated headline stats and
 * breadcrumb (sub-type/quality/brand) facts, shared by the document browser's
 * result cards and the item sheet header. Both consumers pass a normalized
 * `{type, system}` source — the browser's index entry already has that shape,
 * and the sheet header passes its (upgrade-adjusted) item data the same way.
 *
 * These functions are deliberately pure: they read `source.system` as given
 * and apply no upgrades themselves — a caller that wants upgraded values
 * (e.g. the sheet header) pre-adjusts `system` before calling in.
 */

/*
 * Full localization keys for every chip, spelled out as literals (rather than
 * composed from a namespace + suffix) so the unused-string CI check — which
 * greps src for each key verbatim — can see them. The builders below reference
 * them symbolically (CHIP.rof, …), keeping each call readable.
 */
const CHIP = {
  ablation: "CPR.browser.chip.ablation",
  atk: "CPR.browser.chip.atk",
  attackMod: "CPR.browser.chip.attackMod",
  autofire: "CPR.browser.chip.autofire",
  bodySp: "CPR.browser.chip.bodySp",
  combatSpeed: "CPR.browser.chip.combatSpeed",
  concealable: "CPR.browser.chip.concealable",
  damage: "CPR.browser.chip.damage",
  deathSaveIncrease: "CPR.browser.chip.deathSaveIncrease",
  def: "CPR.browser.chip.def",
  electronic: "CPR.browser.chip.electronic",
  floors: "CPR.browser.chip.floors",
  foundational: "CPR.browser.chip.foundational",
  hands: "CPR.browser.chip.hands",
  headSp: "CPR.browser.chip.headSp",
  humanityLoss: "CPR.browser.chip.humanityLoss",
  install: "CPR.browser.chip.install",
  level: "CPR.browser.chip.level",
  magazine: "CPR.browser.chip.magazine",
  penalty: "CPR.browser.chip.penalty",
  per: "CPR.browser.chip.per",
  providingHardening: "CPR.browser.chip.providingHardening",
  quickFixDv: "CPR.browser.chip.quickFixDv",
  rank: "CPR.browser.chip.rank",
  rez: "CPR.browser.chip.rez",
  rof: "CPR.browser.chip.rof",
  sdp: "CPR.browser.chip.sdp",
  seats: "CPR.browser.chip.seats",
  shieldHp: "CPR.browser.chip.shieldHp",
  slots: "CPR.browser.chip.slots",
  spd: "CPR.browser.chip.spd",
  stat: "CPR.browser.chip.stat",
  suppressiveFire: "CPR.browser.chip.suppressiveFire",
  treatmentDv: "CPR.browser.chip.treatmentDv",
  upgradeSlots: "CPR.browser.chip.upgradeSlots",
};

// A chip with a substituted value, e.g. "ROF 1" from "ROF {value}".
const valued = (key, value) => SystemUtils.Format(key, { value });

/*
 * Small helpers, each returning a finished chip string or null when the stat
 * doesn't apply. Callers drop the nulls.
 */

// A bare flag chip (e.g. "Concealable"), only when `on` is truthy.
const flag = (key, on) => (on ? SystemUtils.Localize(key) : null);

// A numeric chip shown only when the value is greater than zero.
const positive = (key, value) => (value > 0 ? valued(key, value) : null);

// A numeric chip shown whenever the value is a number, including zero
// (unlike `positive`, which drops zero). Used where zero is a meaningful,
// displayable value, e.g. a utility program's ATK/DEF/REZ.
const number = (key, value) =>
  typeof value === "number" ? valued(key, value) : null;

// A numeric chip shown whenever the value is a non-zero number, positive or
// negative (unlike `positive`, which also drops negatives). Used where a
// negative value is meaningful, e.g. a weapon's Attack Mod.
const nonZero = (key, value) =>
  typeof value === "number" && value !== 0 ? valued(key, value) : null;

// A chip shown only when the value is truthy (non-empty string / non-zero).
const present = (key, value) => (value ? valued(key, value) : null);

// A "used/total" chip (e.g. "1/3"), shown only when the total is set.
const ratio = (key, used, total) =>
  total > 0 ? valued(key, `${used ?? 0}/${total}`) : null;

// The localized label for an enum value (config map -> localization key),
// falling back to the raw value when the map has no entry for it.
const enumLabel = (map, value) => {
  const key = map?.[value];
  return key ? SystemUtils.Localize(key) : value || null;
};

// The first strictly-positive number among the candidates, or undefined.
const firstPositive = (...values) =>
  values.find((value) => typeof value === "number" && value > 0);

/**
 * Whether an attackable-mixin type is an actual weapon for chip purposes.
 * Weapons always are; cyberware only when flagged as a cyberweapon; item
 * upgrades only when their secondary-weapon modifier is configured. Every
 * other attackable type (none currently) gets no attackable chips.
 *
 * @param {string} type
 * @param {object} s - the item's `system` data
 * @returns {boolean}
 */
const isActualWeapon = (type, s) => {
  if (type === "weapon") return true;
  if (type === "cyberware") return Boolean(s.isWeapon);
  if (type === "itemUpgrade")
    return Boolean(s.modifiers?.secondaryWeapon?.configured);
  return false;
};

/**
 * The attackable-mixin chips, in display order. Only called once the caller
 * has confirmed the item actually qualifies as a weapon (see isActualWeapon).
 *
 * @param {object} s
 * @returns {Array<string|null>}
 */
const attackableChips = (s) => [
  present(CHIP.damage, s.damage),
  positive(CHIP.rof, s.rof),
  positive(CHIP.autofire, s.fireModes?.autoFire),
  flag(CHIP.suppressiveFire, s.fireModes?.suppressiveFire),
  nonZero(CHIP.attackMod, s.attackmod),
];

/**
 * Chips driven purely by which data-model mixins a type has (as opposed to a
 * type's own fields, see OWN_CHIP_BUILDERS below). Cyberware's own "Slots"
 * chip (see OWN_CHIP_BUILDERS.cyberware) replaces the generic upgrade-slots
 * chip here, since both would otherwise read the same installedItems data.
 *
 * @param {string} type
 * @param {Array<string>} mixins
 * @param {object} s
 * @returns {Array<string|null>}
 */
const mixinChips = (type, mixins, s) => {
  const chips = [];
  if (mixins.includes("attackable") && isActualWeapon(type, s)) {
    chips.push(...attackableChips(s));
  }
  if (mixins.includes("loadable")) {
    chips.push(positive(CHIP.magazine, s.magazine?.max));
  }
  if (mixins.includes("physical")) {
    chips.push(flag(CHIP.concealable, s.concealable?.concealable));
  }
  if (mixins.includes("electronic")) {
    chips.push(
      flag(CHIP.electronic, s.isElectronic),
      flag(CHIP.providingHardening, s.providesHardening),
    );
  }
  if (
    type !== "cyberware" &&
    (mixins.includes("upgradable") || mixins.includes("container"))
  ) {
    chips.push(
      ratio(
        CHIP.upgradeSlots,
        s.installedItems?.usedSlots,
        s.installedItems?.slots,
      ),
    );
  }
  return chips;
};

// Ammo's damage chip: only shown when the ammo actually overrides the
// weapon's base damage (mode "set" or "modify"; "none" is the default).
const ammoDamageChip = (s) => {
  const mode = s.overrides?.damage?.mode;
  return mode && mode !== "none"
    ? valued(CHIP.damage, s.overrides.damage.value)
    : null;
};

// A location's SP chip: current = sp - ablation. `ablation` defaults to 0
// when absent (e.g. compendium/browser-index entries, which don't carry
// wear-tracking data), so partial data reads as "unworn" rather than NaN.
// Dropped entirely when `sp` itself isn't set.
const locationSpChip = (key, location) => {
  if (typeof location?.sp !== "number") return null;
  const ablation = location.ablation ?? 0;
  return valued(key, `${location.sp - ablation}/${location.sp}`);
};

// Shield HP chip: `value` defaults to `max` when absent (same partial-data
// case as locationSpChip above), so it reads as "undamaged" rather than
// undefined. Dropped entirely when `max` itself isn't set.
const shieldHpChip = (shieldHitPoints) => {
  if (typeof shieldHitPoints?.max !== "number") return null;
  const value = shieldHitPoints.value ?? shieldHitPoints.max;
  return valued(CHIP.shieldHp, `${value}/${shieldHitPoints.max}`);
};

// Cyberware's humanity-loss chip: prefers the rolled value, falling back to
// the static one, hidden when neither is meaningfully set.
const humanityLossChip = (s) => {
  const roll = s.humanityLoss?.roll;
  const value = roll && roll !== "0" ? roll : s.humanityLoss?.static;
  return present(CHIP.humanityLoss, value);
};

/*
 * Per-type chips driven by a type's own fields, in addition to whatever the
 * type's mixins contribute (see mixinChips above). Types absent here (or
 * returning no entries) simply get no own-field chips.
 */
const OWN_CHIP_BUILDERS = {
  weapon: (s) => [positive(CHIP.hands, s.handsReq)],

  armor: (s) => [
    s.isHeadLocation ? locationSpChip(CHIP.headSp, s.headLocation) : null,
    s.isBodyLocation ? locationSpChip(CHIP.bodySp, s.bodyLocation) : null,
    s.isShield ? shieldHpChip(s.shieldHitPoints) : null,
    present(CHIP.penalty, s.penalty),
  ],

  ammo: (s) => [ammoDamageChip(s), positive(CHIP.ablation, s.ablationValue)],

  cyberware: (s) => [
    humanityLossChip(s),
    flag(CHIP.foundational, s.isFoundational),
    present(
      CHIP.install,
      enumLabel(CPR.cyberwareInstallList, s.installLocation),
    ),
    ratio(CHIP.slots, s.installedItems?.usedSlots, s.installedItems?.slots),
  ],

  criticalInjury: (s) => [
    flag(CHIP.deathSaveIncrease, s.deathSaveIncrease),
    positive(
      CHIP.quickFixDv,
      firstPositive(s.quickFix?.dvFirstAid, s.quickFix?.dvParamedic),
    ),
    positive(
      CHIP.treatmentDv,
      firstPositive(s.treatment?.dvParamedic, s.treatment?.dvSurgery),
    ),
  ],

  program: (s) => {
    const isBlackIce = s.class === "blackice";
    return [
      number(CHIP.atk, s.atk),
      number(CHIP.def, s.def),
      number(CHIP.rez, s.rez?.max),
      isBlackIce ? positive(CHIP.per, s.per) : null,
      isBlackIce ? positive(CHIP.spd, s.spd) : null,
      isBlackIce ? present(CHIP.damage, s.damage?.blackIce) : null,
    ];
  },

  role: (s) => [positive(CHIP.rank, s.rank)],

  skill: (s) => [
    positive(CHIP.level, s.level),
    present(CHIP.stat, enumLabel(CPR.statList, s.stat)),
  ],

  vehicle: (s) => [
    positive(CHIP.seats, s.seats),
    positive(CHIP.sdp, s.sdp),
    positive(CHIP.combatSpeed, s.speedCombat),
  ],

  netarch: (s) => [positive(CHIP.floors, s.floors?.length)],
};

/**
 * Build the ordered list of stat chips for a normalized item source: the key
 * stats each item type surfaces, as short localized strings (e.g. "ROF 1",
 * "Head SP 5/7", "Foundational"). Absent/zero/non-meaningful stats are
 * dropped rather than shown as empty chips.
 *
 * @param {{type: string, system: object}} source
 * @returns {Array<string>}
 */
export function buildItemChips(source) {
  const { type } = source;
  const s = source.system ?? {};
  const mixins = SystemUtils.getMixins(type);
  const ownBuilder = OWN_CHIP_BUILDERS[type];
  return [
    ...mixinChips(type, mixins, s),
    ...(ownBuilder ? ownBuilder(s) : []),
  ].filter(Boolean);
}

// The localized label for an item type, e.g. "Weapon". Falls back to the raw
// TYPES.Item localization key, mirroring the document browser's type header.
const typeLabel = (type) =>
  SystemUtils.Localize(CPR.objectTypes[type] ?? `TYPES.Item.${type}`);

/**
 * The sub-type breadcrumb segment(s) for a type's own sub-type enum(s), e.g. a
 * weapon's weapon type, or ammo's type + variety.
 *
 * @param {string} type
 * @param {object} s
 * @returns {Array<string>}
 */
const subtypeSegments = (type, s) => {
  switch (type) {
    case "weapon":
      return [enumLabel(CPR.weaponTypes, s.weaponType)];
    case "ammo":
      return [
        enumLabel(CPR.ammoTypes, s.type),
        enumLabel(CPR.ammoVarieties, s.variety),
      ];
    case "program": {
      const segments = [enumLabel(CPR.programClassList, s.class)];
      if (s.class === "blackice") {
        segments.push(enumLabel(CPR.blackIceType, s.blackIceType));
      }
      return segments;
    }
    case "cyberware":
      return [enumLabel(CPR.cyberwareTypes, s.type)];
    case "criticalInjury":
      return [enumLabel(CPR.criticalInjuryLocation, s.location)];
    case "itemUpgrade":
      return [enumLabel(CPR.objectTypes, s.type)];
    case "skill":
      return [enumLabel(CPR.skillCategories, s.category)];
    case "clothing":
      return [
        enumLabel(CPR.clothingTypes, s.type),
        enumLabel(CPR.clothingVarieties, s.style),
      ];
    case "armor": {
      const locations = [];
      if (s.isHeadLocation)
        locations.push(SystemUtils.Localize("CPR.global.location.head"));
      if (s.isBodyLocation)
        locations.push(SystemUtils.Localize("CPR.global.location.body"));
      if (s.isShield)
        locations.push(
          SystemUtils.Localize("CPR.browser.armorLocation.shield"),
        );
      return locations.length ? [locations.join(" & ")] : [];
    }
    default:
      return [];
  }
};

/**
 * Build the ordered breadcrumb segments for a normalized item source:
 * `[Type?, ...Subtype(s), Quality?, Brand?]`. Segments that don't apply
 * (blank sub-type, standard quality, no brand, …) are omitted.
 *
 * @param {{type: string, system: object}} source
 * @param {object} [options]
 * @param {boolean} [options.includeType] - whether to include the leading
 *   Type segment (the browser omits it since its section header names the
 *   type already; the item sheet header wants it).
 * @returns {Array<string>}
 */
export function buildItemBreadcrumb(source, { includeType = true } = {}) {
  const { type } = source;
  const s = source.system ?? {};
  const mixins = SystemUtils.getMixins(type);

  const segments = [];
  if (includeType) segments.push(typeLabel(type));
  segments.push(...subtypeSegments(type, s));

  if (mixins.includes("quality") && ["poor", "excellent"].includes(s.quality)) {
    segments.push(enumLabel(CPR.itemQuality, s.quality));
  }

  if (s.brand) segments.push(s.brand);

  return segments.filter(Boolean);
}
