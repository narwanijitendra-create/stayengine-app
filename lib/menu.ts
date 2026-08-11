import type { MenuCategory, MenuItem } from "./types";

export type MenuGroup = {
  category: MenuCategory;
  subcategory: MenuCategory | null;
  items: MenuItem[];
};

const UNCATEGORIZED: MenuCategory = {
  id: "__uncategorized",
  hotel_id: "",
  name: "Uncategorized",
  parent_id: null,
  sort_order: Number.MAX_SAFE_INTEGER,
  created_at: "",
};

// Groups menu items into Category -> Subcategory buckets, honoring each
// category/subcategory's sort_order (set via admin drag-and-drop) rather
// than alphabetical order. By default, empty groups (no items) are omitted
// - pass includeEmpty to also list categories/subcategories with no items,
// which the admin category manager uses so staff can see the full structure.
export function buildMenuGroups(
  items: MenuItem[],
  categories: MenuCategory[],
  opts: { includeEmpty?: boolean } = {}
): MenuGroup[] {
  const topCategories = categories
    .filter((c) => c.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order);
  const knownIds = new Set(categories.map((c) => c.id));
  const groups: MenuGroup[] = [];

  for (const top of topCategories) {
    const directItems = items
      .filter((i) => i.category_id === top.id)
      .sort((a, b) => a.sort_order - b.sort_order);
    if (directItems.length || opts.includeEmpty) {
      groups.push({ category: top, subcategory: null, items: directItems });
    }

    const subs = categories
      .filter((c) => c.parent_id === top.id)
      .sort((a, b) => a.sort_order - b.sort_order);
    for (const sub of subs) {
      const subItems = items
        .filter((i) => i.category_id === sub.id)
        .sort((a, b) => a.sort_order - b.sort_order);
      if (subItems.length || opts.includeEmpty) {
        groups.push({ category: top, subcategory: sub, items: subItems });
      }
    }
  }

  const uncategorized = items.filter((i) => !i.category_id || !knownIds.has(i.category_id));
  if (uncategorized.length) {
    groups.push({ category: UNCATEGORIZED, subcategory: null, items: uncategorized });
  }

  return groups;
}
