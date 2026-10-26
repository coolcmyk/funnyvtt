const { Die, DiceTerm } = foundry.dice.terms;

/**
 * Extended Die that adds four Cyberpunk RED modifiers to Foundry's dice pipeline:
 *
 * - `red` — the check-die critical. A natural **max** face explodes (adds one die, **once**, no
 *   cascading); a natural **1** implodes (adds one die counted **negatively**, once). An optional
 *   threshold (`redN`) lowers the explode trigger to `>= N` (RAW default = the die's max face). `red`
 *   **supersedes** Foundry's explode: any `x`/`xo` on the same term is stripped (see the constructor).
 *   Notation: `1d10red`, `1d10red+8`, `1d6red`, `1d10red5`.
 *
 * - `dmg` — a **non-mutating marker** that (a) flags the term as a *damage roll* (so the system renders
 *   the damage card with its apply-damage icon) and (b) flags a *critical* by counting qualifying dice,
 *   **without** adding/removing dice or changing the total. Trigger params follow core `explode`'s
 *   grammar — `dmg(count)(op)(threshold)` — with the "lone number = threshold" rule. RAW default is
 *   `2×MAX`: `count = 2`, `op = ">="`, `threshold = faces`. `count 0` (`dmg0` / `dmg0>=6`) is the
 *   "no crit" sentinel: still a damage roll, but it never crits. Notation: `2d6dmg`, `2d6dmg5`,
 *   `4d6dmg3>=5`, `4d10dmg2>=9`, `2d6dmg0`.
 *
 * - `ab` — a **non-mutating** companion to `dmg` that sets how many points of armor SP the roll ablates
 *   when applied: `abN` → N, a lone `ab` → 1, `ab0` → none. It is meaningless without `dmg` (a bare
 *   roll has nothing to apply); used on a non-damage term it warns and no-ops. RAW default (when `ab`
 *   is absent from a `dmg` roll) is 1, applied by the apply-damage hook. Notation: `2d6dmgab2`.
 *
 * - `cd` — a **non-mutating** companion to `dmg` that sets the critical bonus damage added on a crit:
 *   `cdN` → N, a lone `cd` → 5, `cd0` → none. Same `dmg`-required rule as `ab`. RAW default (when `cd`
 *   is absent) is 5, applied by the apply-damage hook. Notation: `2d6dmgcd10`, `2d6dmg5ab3cd7`.
 *
 * All four are registered as first-class entries in {@link MODIFIERS} so Foundry's modifier pipeline
 * dispatches them in formula order. Foundry tokenises a die's modifier blob with a greedy letter run,
 * so letter-adjacent modifiers fuse into one token (`dmgab2`) and core's compound splitter drops their
 * numeric params; {@link CPRDie#_evaluateModifiers} re-splits such tokens first, preserving the params.
 *
 * @extends {Die}
 */
export default class CPRDie extends Die {
  /**
   * Register the CPR modifiers alongside the core set.
   * @type {Record<string, string>}
   * @override
   */
  static MODIFIERS = {
    ...Die.MODIFIERS,
    red: "red",
    dmg: "dmg",
    ab: "ab",
    cd: "cd",
  };

  /**
   * Note whether this term carries `red`/`dmg`. Foundry can fuse adjacent letter-modifiers into one
   * token (`1d10xred` → `["xred"]`, split only at evaluation), so we detect them on the joined modifier
   * string rather than per token. `_cprHasRed` makes `explode`/`explodeOnce` no-ops (`red` supersedes
   * them); `_cprHasDmg` gates the `ab`/`cd` companions, which are meaningless without `dmg`.
   *
   * @param {object} termData - Die term data (see {@link DiceTerm}).
   */
  constructor(termData = {}) {
    super(termData);
    const joined = Array.isArray(this.modifiers) ? this.modifiers.join("") : "";
    this._cprHasRed = /red/i.test(joined);
    this._cprHasDmg = /dmg/i.test(joined);
  }

  /**
   * Re-split fused modifier tokens before core evaluates them, preserving each sub-modifier's params.
   * Foundry tokenises a die's modifier blob with a greedy letter run
   * (`Die.MODIFIER_REGEXP = /([A-z]+)([^A-z…]+)?/`), so letter-adjacent modifiers fuse into one token —
   * `2d6dmgab2` → `["dmgab2"]` — and core's compound splitter then re-dispatches each keyword **bare**,
   * silently dropping its trailing number (here `ab`'s `2`). Expand such tokens ourselves, keeping the
   * params (`["dmgab2"]` → `["dmg", "ab2"]`), then defer to core. A token whose leading letters already
   * name a registered modifier (`dmg5`, `kh2`, `red`) is not fused and passes through untouched.
   *
   * @returns {Promise<void>}
   * @override
   */
  async _evaluateModifiers() {
    if (Array.isArray(this.modifiers)) {
      this.modifiers = this.modifiers.flatMap((m) => CPRDie._cprSplitFused(m));
    }
    return super._evaluateModifiers();
  }

  /**
   * Split one (possibly fused) modifier token into param-preserving sub-tokens. Mirrors core's
   * greedy-longest keyword match but re-attaches the non-letter run (digits / comparison ops) that
   * follows each keyword. A token that is already a single registered modifier — or whose leading
   * letters match none — is returned unchanged for core to handle. See {@link _evaluateModifiers}.
   *
   * @param {string} token - One modifier token (e.g. `dmgab2`, `dmg5`, `xred`).
   * @returns {string[]} One or more tokens with their params intact.
   */
  static _cprSplitFused(token) {
    const command = token.match(/[A-Za-z]+/)?.[0]?.toLowerCase();
    // Already a whole registered modifier (letters then params, e.g. `dmg5`) — leave it to core.
    if (!command || command in CPRDie.MODIFIERS) return [token];
    const keywords = Object.keys(CPRDie.MODIFIERS).sort(
      (a, b) => b.length - a.length,
    );
    const out = [];
    let rest = token;
    while (rest) {
      const kw = keywords.find((k) => rest.toLowerCase().startsWith(k));
      if (!kw) break; // Unknown leading letters — hand the remainder back to core untouched.
      rest = rest.slice(kw.length);
      const params = rest.match(/^[^A-Za-z\s(){}[\]+\-*/]+/)?.[0] ?? "";
      rest = rest.slice(params.length);
      out.push(kw + params);
    }
    if (out.length === 0) return [token];
    return rest ? [...out, rest] : out;
  }

  /**
   * `red` supersedes Foundry's explode: when the term also carries `red`, `x` does nothing (order in
   * the formula is irrelevant) so a max face never produces both an `x` explosion and a `red` bonus die.
   *
   * @param {string} modifier - The matched modifier query.
   * @param {object} [options] - Explode options.
   * @returns {Promise<false|void>}
   * @override
   */
  async explode(modifier, options) {
    if (this._cprHasRed) {
      this._warnSuperseded(modifier);
      return undefined;
    }
    return super.explode(modifier, options);
  }

  /** @override - see {@link explode}; `red` supersedes `xo` too. */
  async explodeOnce(modifier) {
    if (this._cprHasRed) {
      this._warnSuperseded(modifier);
      return undefined;
    }
    return super.explodeOnce(modifier);
  }

  /**
   * Warn that an explode modifier was ignored because `red` supersedes it. Not deduplicated — a single
   * notification is easily missed, so every ignored modifier surfaces its own warning. Fires on the
   * rolling client only — modifiers are not re-evaluated when a roll is reconstructed from data.
   *
   * @param {string} modifier - The ignored modifier (e.g. `x`, `xo`, `x10`).
   */
  // eslint-disable-next-line class-methods-use-this
  _warnSuperseded(modifier) {
    globalThis.ui?.notifications?.warn(
      game.i18n.format("CPR.rolls.modifiers.redSupersedesExplode", {
        modifier,
      }),
    );
  }

  /**
   * `red`'s bonus/penalty dice are not themselves rerollable (confirmed CPR behaviour). When `reroll`
   * runs after `red` (e.g. `1d10redr1`), temporarily hide the `red`-added dice — `reroll` skips inactive
   * results — then restore them. `rerollRecursive` routes through here via its own `this.reroll(...)`.
   *
   * @param {string} modifier - The matched modifier query.
   * @param {object} [options] - Reroll options (e.g. `{ recursive: true }`).
   * @returns {Promise<false|void>}
   * @override
   */
  async reroll(modifier, options) {
    const exempt = this.results.filter((r) => r.cprBonus && r.active);
    exempt.forEach((r) => {
      r.active = false;
    });
    try {
      return await super.reroll(modifier, options);
    } finally {
      exempt.forEach((r) => {
        r.active = true;
      });
    }
  }

  /**
   * Keep/drop must treat each `red` explode/implode as a **single** result — the original die plus the
   * bonus/penalty it spawned — ranked by their combined value and kept or dropped together. Foundry's
   * core keep/drop instead ranks every result independently by its rolled face, which (a) can strand a
   * bonus die away from its parent and (b) lets an implode penalty (positive face, negative count) win
   * `kh` and produce a negative "kept" total. `keep`/`drop` delegate to this; it folds each group into
   * its parent's face for the core pass, then restores and propagates the verdict to the added dice.
   *
   * @param {Function} runCore - Runs the core keep/drop over the temporarily folded results.
   * @returns {void|false}
   */
  _cprGroupedKeepDrop(runCore) {
    // Map each parent (by its index in `results`) to the bonus/penalty dice `red` spawned from it.
    const groups = new Map();
    for (const r of this.results) {
      if (r.cprBonus && Number.isInteger(r.cprParentIndex)) {
        const list = groups.get(r.cprParentIndex) ?? [];
        list.push(r);
        groups.set(r.cprParentIndex, list);
      }
    }
    // No `red`-added dice in the pool (e.g. `khred`, where keep runs before red) — nothing to group.
    if (groups.size === 0) return runCore();

    // Fold each group's added dice into its parent's face so the core pass ranks by the combined value,
    // and deactivate the added dice so they are neither ranked nor selected on their own.
    const folded = [];
    for (const [parentIndex, added] of groups) {
      const parent = this.results[parentIndex];
      if (!parent) continue;
      const delta = added.reduce((t, r) => t + (r.count ?? r.result), 0);
      folded.push({ parent, added, origResult: parent.result });
      parent.result += delta;
      added.forEach((r) => {
        r.active = false;
      });
    }

    try {
      return runCore();
    } finally {
      // Restore each parent's rolled face and propagate its keep/drop verdict to its added dice, so the
      // whole group stays or goes as a unit.
      for (const { parent, added, origResult } of folded) {
        parent.result = origResult;
        added.forEach((r) => {
          r.active = parent.active;
          r.discarded = !parent.active;
        });
      }
    }
  }

  /**
   * @override - group `red`'s added dice with their parent for keep/drop. See {@link _cprGroupedKeepDrop}.
   * @param {string} modifier - The matched modifier query (e.g. `kh`, `kl2`).
   * @returns {void|false}
   */
  keep(modifier) {
    return this._cprGroupedKeepDrop(() => super.keep(modifier));
  }

  /** @override - see {@link keep}. */
  drop(modifier) {
    return this._cprGroupedKeepDrop(() => super.drop(modifier));
  }

  /**
   * The `red` check-die critical: explode on max (`>= threshold`), implode on a natural 1. One extra
   * die per qualifying original result, no cascading. A d1 is a no-op — its single face is both the max
   * and a natural 1, so neither rule applies.
   *
   * @param {string} modifier - The matched modifier query (e.g. `red`, `red5`).
   * @returns {Promise<false|void>} False if the modifier was unmatched.
   */
  async red(modifier) {
    const match = modifier.match(/red([0-9]+)?/i);
    if (!match) return false;
    const [rawThreshold] = match.slice(1);
    const threshold = Number.isNumeric(rawThreshold)
      ? parseInt(rawThreshold, 10)
      : this.faces;

    // A d1 is degenerate: its only face (1) is simultaneously the max (explode) and a natural 1
    // (implode), so the two rules contradict. Ignore `red` entirely on a d1 — no bonus/penalty die —
    // rather than arbitrarily pick one.
    if (this.faces <= 1) return undefined;

    // Snapshot the active, unprocessed results so the dice we add below are not themselves processed.
    const targets = this.results.filter((r) => r.active && !r.cprProcessed);
    for (const result of targets) {
      result.cprProcessed = true;
      // Index of the parent die, recorded on each added die so a later keep/drop can group the two as
      // one result (see {@link keep}). Stable: `roll()` only appends, so existing indices never shift.
      const parentIndex = this.results.indexOf(result);
      if (result.result >= threshold) {
        // Critical success — explode: add one die, summed into the total normally.
        result.exploded = true;
        const bonus = await this.roll();
        bonus.cprProcessed = true;
        bonus.cprBonus = true;
        bonus.cprSuccess = true;
        bonus.cprParentIndex = parentIndex;
      } else if (result.result === 1) {
        // Critical failure — implode: add one die counted negatively (subtracted from the total).
        const penalty = await this.roll();
        penalty.cprProcessed = true;
        penalty.cprBonus = true;
        penalty.cprFailure = true;
        penalty.count = -1 * penalty.result;
        penalty.cprParentIndex = parentIndex;
      }
    }
    return undefined;
  }

  /**
   * The `dmg` damage marker: flag the term as a damage roll and detect a critical by counting
   * qualifying dice. Pure inspection — never changes the dice pool or the total.
   *
   * @param {string} modifier - The matched modifier query (e.g. `dmg`, `dmg5`, `dmg3>=5`, `dmg0`).
   * @returns {false|void} False if the modifier was unmatched.
   */
  dmg(modifier) {
    const match = modifier.match(/dmg([0-9]+)?([<>=]+)?([0-9]+)?/i);
    if (!match) return false;
    const [n1, rawOp, n2] = match.slice(1);

    let count;
    let threshold;
    if (n1 === "0") {
      // Count-0 sentinel: a damage roll that never crits.
      count = 0;
      threshold = Number.isNumeric(n2) ? parseInt(n2, 10) : this.faces;
    } else if (n1 && !rawOp && !n2) {
      // A lone number with no comparison is the threshold (e.g. dmg5 → 5s count).
      count = 2;
      threshold = parseInt(n1, 10);
    } else {
      count = Number.isNumeric(n1) ? parseInt(n1, 10) : 2;
      threshold = Number.isNumeric(n2) ? parseInt(n2, 10) : this.faces;
    }
    const op = rawOp || ">=";

    // Mark this as a damage roll regardless of the crit outcome (drives the damage card + apply icon).
    this.options.cprDamage = true;
    this.options.cprDamageCrit = { count, op, threshold };

    const qualifying = this.results.filter(
      (r) => r.active && DiceTerm.compareResult(r.result, op, threshold),
    );
    const isCrit = count > 0 && qualifying.length >= count;
    this.options.cprDamageIsCrit = isCrit;
    if (isCrit) {
      for (const r of qualifying) r.cprDamageCrit = true;
    }
    return undefined;
  }

  /**
   * The `ab` armor-ablation marker: record how many points of armor SP this damage roll ablates when
   * applied. Pure inspection — never touches the pool or total; the value is read by the apply-damage
   * hook (see add-damage-application.js). `abN` sets N, a lone `ab` means 1, `ab0` means no ablation.
   * A companion to `dmg`: on a term without `dmg` it warns and no-ops (a bare roll has nothing to apply).
   *
   * @param {string} modifier - The matched modifier query (e.g. `ab`, `ab2`, `ab0`).
   * @returns {false|void} False if the modifier was unmatched.
   */
  ab(modifier) {
    const match = modifier.match(/ab([0-9]+)?/i);
    if (!match) return false;
    if (!this._cprHasDmg) {
      this._warnMarkerNeedsDamage(modifier);
      return undefined;
    }
    const [n] = match.slice(1);
    this.options.cprAblation = Number.isNumeric(n) ? parseInt(n, 10) : 1;
    return undefined;
  }

  /**
   * The `cd` critical-bonus marker: record the bonus damage added when this roll crits. Pure inspection;
   * read by the apply-damage hook and only applied on a crit. `cdN` sets N, a lone `cd` means 5, `cd0`
   * means no bonus. A companion to `dmg`: on a term without `dmg` it warns and no-ops.
   *
   * @param {string} modifier - The matched modifier query (e.g. `cd`, `cd10`, `cd0`).
   * @returns {false|void} False if the modifier was unmatched.
   */
  cd(modifier) {
    const match = modifier.match(/cd([0-9]+)?/i);
    if (!match) return false;
    if (!this._cprHasDmg) {
      this._warnMarkerNeedsDamage(modifier);
      return undefined;
    }
    const [n] = match.slice(1);
    this.options.cprCritBonus = Number.isNumeric(n) ? parseInt(n, 10) : 5;
    return undefined;
  }

  /**
   * Warn that an `ab`/`cd` marker was ignored because the term carries no `dmg` — they only qualify a
   * damage roll. Fires on the rolling client only; modifiers are not re-evaluated on reconstruction.
   *
   * @param {string} modifier - The ignored modifier (e.g. `ab2`, `cd10`).
   */
  // eslint-disable-next-line class-methods-use-this
  _warnMarkerNeedsDamage(modifier) {
    globalThis.ui?.notifications?.warn(
      game.i18n.format("CPR.rolls.modifiers.markerNeedsDamage", { modifier }),
    );
  }

  /**
   * Style the dice that `red` added: a critical-success bonus die as a green `+N`, a critical-failure
   * penalty die as a red negative value. All other dice fall back to the core label.
   *
   * @param {DiceTermResult} result - A single rolled result.
   * @returns {string}
   * @override
   */
  getResultLabel(result) {
    if (result.cprFailure) {
      return `<span class="cpr-crit-failure" title="Critical Failure!">${result.count}</span>`;
    }
    if (result.cprSuccess) {
      return `<span class="cpr-crit-success" title="Critical Success!">+${result.result}</span>`;
    }
    return super.getResultLabel(result);
  }
}
