import BaseMigrationScript from "../base-migration-script.js";
import { ContainerUtils } from "../../../item/mixins/cpr-container.js";

/**
 * Turn Item UUIDs into IDs for Container Items
 */
export default class RemoveUnusedInstallFlag extends BaseMigrationScript {
  static version = 41;

  static name = "Remove Unused Install Flag";

  static documentFilters = {
    Item: { types: [], mixins: ["container"] },
    Actor: { types: [], mixins: ["container"] },
  };

  /** @inheritdoc */
  async updateItem(doc) {
    this.constructor.deleteOldInstallTreeFlag(doc);
  }

  /**
   * Recursively delete the the `flags.cprInstallTree`
   * as it was migrated in Data Model 34.
   *
   * @param {Object} doc - The document data to migrate.
   * @returns {void} - just mutates the document data.
   */
  static deleteOldInstallTreeFlag(doc) {
    // Delete the flag on this document.
    this.safeDelete(doc, "flags.cprInstallTree");

    const cprInstallTree = ContainerUtils.getInstallTreeFlag(doc);

    if (!Array.isArray(cprInstallTree) || cprInstallTree.length === 0) return;

    // Get migration data to update the record for each item data in tree.
    const { MigrationRunner } = game.cpr;
    const migrationData = {
      previous: MigrationRunner.currentDataModelVersion,
      current: MigrationRunner.newDataModelVersion,
    };

    const systemId = game.system.id;

    // Inner helper that does recursive migration.
    function deleteFlag(tree) {
      for (const itemData of tree) {
        // Update migration record for all item data in tree.
        itemData.flags[systemId] = {
          ...itemData.flags[systemId],
          _migration: migrationData,
        };

        BaseMigrationScript.safeDelete(itemData, `flags.cprInstallTree`);

        // Recurse into nested cprInstallTree if present.
        const childTree = itemData.flags?.cprInstallTree;
        if (Array.isArray(childTree) && childTree.length > 0) {
          deleteFlag(childTree);
        }
      }
    }

    deleteFlag(cprInstallTree);
  }
}
