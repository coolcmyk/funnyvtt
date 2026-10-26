/**
 * Plan an embedded Item deletion without removing installed Items which are
 * still referenced by a parent outside the deletion set.
 *
 * A transfer may request deletion of both a weapon and its installed ammo.
 * When another weapon still references that same ammo Item, deleting the ammo
 * would unload the remaining weapon as a side effect. Preserve the shared Item
 * so the remaining parent reference continues to resolve.
 *
 * @param {Actor} actor - Actor which owns the embedded Items.
 * @param {string[]} ids - Embedded Item ids requested for deletion.
 * @returns {string[]} Embedded Item ids which are safe to delete.
 */
export function planInstalledItemDeletion(actor, ids) {
  const requestedIds = new Set(ids);
  const deleteIds = [];

  for (const id of ids) {
    const item = actor.getOwnedItem(id);
    if (!item) {
      deleteIds.push(id);
      continue;
    }

    const referencingParentIds = actor.items
      .filter((parent) =>
        parent.system?.installedItems?.list?.includes(item.id),
      )
      .map((parent) => parent.id);
    const deletingParent = referencingParentIds.some((parentId) =>
      requestedIds.has(parentId),
    );
    const remainingParentIds = referencingParentIds.filter(
      (parentId) => !requestedIds.has(parentId),
    );

    if (deletingParent && remainingParentIds.length > 0) {
      continue;
    }

    deleteIds.push(id);
  }

  return deleteIds;
}
