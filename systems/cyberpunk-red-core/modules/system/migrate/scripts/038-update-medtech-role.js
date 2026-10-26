import BaseMigrationScript from "../base-migration-script.js";

/**
 * For all entries: Set multiplier to "0.5"
 * If name = "Medical Tech", set it to "Medical Tech Skill"
 * If name = "Surgery", set it to "Surgery Skill", and set multiplier to "0.25"
 * ToDo ↴
 * Create new ability named Surgery, set multiplier to "0.5", and rank to 0.5 * Surgery Skill
 */
export default class UpdateMedtechRole extends BaseMigrationScript {
  static version = 38;

  static name = "Reconfigure: Medtech role abilities";

  static documentFilters = {
    Item: { types: ["role"], mixins: [] },
    Actor: { types: [], mixins: [] },
  };

  async updateItem(doc) {
    if (doc.name === "Medtech" && doc.type === "role") {
      const migratedData = [];

      doc.system.abilities.forEach((ability) => {
        const abilityRank = ability.rank;
        const abilityTemplate = {
          bonusRatio: 1,
          bonuses: [],
          hasRoll: false,
          isSituational: false,
          multiplier: 0.5,
          onByDefault: false,
          rank: abilityRank,
          skill: "--",
          stat: "--",
          universalBonuses: [],
        };

        if (ability.name === "Medical Tech") {
          abilityTemplate.name = "Medical Tech Skill";
          abilityTemplate.stat = "tech";
          abilityTemplate.hasRoll = true;
        }
        if (ability.name === "Medical Tech (Cryosystem Operation)") {
          abilityTemplate.name = "Medical Tech (Cryosystem Operation)";
        }
        if (ability.name === "Medical Tech (Pharmaceuticals)") {
          abilityTemplate.name = "Medical Tech (Pharmaceuticals)";
        }
        if (ability.name === "Surgery") {
          abilityTemplate.name = "Surgery Skill";
          abilityTemplate.multiplier = 0.25;
          abilityTemplate.stat = "tech";
          abilityTemplate.hasRoll = true;
        }

        migratedData.push(abilityTemplate);
      });

      const oldSurgeryRank = doc.system.abilities.find(
        (oa) => oa.name === "Surgery",
      )?.rank;
      const newSurgery = {
        bonusRatio: 1,
        bonuses: [],
        hasRoll: false,
        isSituational: false,
        multiplier: 0.5,
        onByDefault: false,
        rank: oldSurgeryRank / 2,
        name: "Surgery",
        skill: "--",
        stat: "--",
        universalBonuses: [],
      };

      migratedData.push(newSurgery);

      doc.system.abilities = migratedData;
    }
  }
}
