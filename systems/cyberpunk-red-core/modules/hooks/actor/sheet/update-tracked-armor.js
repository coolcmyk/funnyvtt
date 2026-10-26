const updateTrackedArmor = () => {
  /**
   * Executes only for tracked armor items. Updates the armor tracking on
   * the associated actor based on changes to shield hit points or body/head
   * locations.
   *
   * @param {Object} doc - The item document being updated.
   * @param {Object} updateData - The update data for the item.
   */
  Hooks.on("updateItem", (doc, updateData) => {
    // Only run if updateData exists
    if (updateData?.system == null) return;

    if (doc.type === "armor" && doc.isEmbedded) {
      const actor = doc.actor;
      const tracked = actor.system.externalData;
      if (
        "headLocation" in updateData.system &&
        tracked?.currentArmorHead?.id === doc.id
      ) {
        actor.updateTrackedArmor("head", doc._id);
      }
      if (
        "bodyLocation" in updateData.system &&
        tracked?.currentArmorBody?.id === doc.id
      ) {
        actor.updateTrackedArmor("body", doc._id);
      }
      if (
        "shieldHitPoints" in updateData.system &&
        tracked?.currentArmorShield?.id === doc.id
      ) {
        actor.updateTrackedArmor("shield", doc._id);
      }
    }
  });
};

export default updateTrackedArmor;
