const UpdateRoleFromItem = () => {
  /**
   * Sets the Actor role field when Role Item is dragged to a sheet.
   *
   * @public
   * @memberof hookEvents
   * @param {CPRItem} doc - The pending document which is requested for creation
   */
  Hooks.on("createItem", async (doc) => {
    const actor = doc.parent;
    // Only actors with a roleInfo section (characters and mooks) track an
    // active role; other actor types, such as containers, must be skipped.
    if (actor !== null && doc.type === "role" && actor.system.roleInfo) {
      if (actor.system.roleInfo.activeRole === "") {
        actor.update({ "system.roleInfo.activeRole": doc.name });
      }
      if (
        !actor.itemTypes.role.some(
          (r) => r.id === actor.system.roleInfo.activeNetRole,
        )
      ) {
        // If no roles are designated as activeNetRole, OR if an
        // activeNetRole has been set, but that role has since been
        // deleted, set activeNetRole.
        actor.update({ "system.roleInfo.activeNetRole": doc.id });
      }
    }
  });
};

export default UpdateRoleFromItem;
