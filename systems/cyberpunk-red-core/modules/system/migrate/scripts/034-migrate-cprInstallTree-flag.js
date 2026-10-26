import BaseMigrationScript from "../base-migration-script.js";

/**
 * Turn Item UUIDs into IDs for Container Items
 */
export default class MoveCPRInstallTreeFlag extends BaseMigrationScript {
  static version = 34;

  static name = "Move cprInstallTree Flag";

  static documentFilters = {
    Item: { types: [], mixins: ["container"] },
    Actor: { types: [], mixins: ["container"] },
  };

  /** @inheritdoc */
  async updateItem(doc) {
    this.constructor.migrateInstallTreeFlag(doc);
  }

  /**
   * Recursively move the cprInstallTree flag from `flags` to `flags[game.system.id]`
   * for all installed items in the given document.
   *
   * @param {Object} doc - The document data to migrate
   * @returns {void} - just mutates the document data.
   */
  static migrateInstallTreeFlag(doc) {
    const { flags } = doc;
    const cprInstallTree = flags?.cprInstallTree;

    if (!Array.isArray(cprInstallTree) || cprInstallTree.length === 0) return;

    // Get migration data to update the record for each item data in tree.
    const { MigrationRunner } = game.cpr;
    const migrationData = {
      previous: MigrationRunner.currentDataModelVersion,
      current: MigrationRunner.newDataModelVersion,
    };

    const systemId = game.system.id;

    // Inner helper that does recursive migration.
    function moveFlag(tree) {
      for (const itemData of tree) {
        // Update migration record for all item data in tree.
        itemData.flags[systemId] = {
          ...itemData.flags[systemId],
          _migration: migrationData,
        };

        // Recurse into nested cprInstallTree if present.
        const childTree = itemData.flags?.cprInstallTree;
        if (Array.isArray(childTree) && childTree.length > 0) {
          itemData.flags[systemId] = {
            ...itemData.flags[systemId],
            cprInstallTree: moveFlag(childTree),
          };
        }
      }
      return tree;
    }

    flags[systemId] = {
      ...flags[systemId],
      cprInstallTree: moveFlag(cprInstallTree),
    };
  }
}
