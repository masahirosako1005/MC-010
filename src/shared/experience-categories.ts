import type { BrochureItem, Spot } from './types.js';

export const EXPERIENCE_CATEGORIES = [
  { id: 'see', label: 'みる', tags: ['景色', '海'] },
  { id: 'play', label: 'あそぶ', tags: ['体験', '町歩き', '散歩', '文化'] },
  { id: 'eat', label: 'たべる', tags: ['食'] },
  { id: 'relax', label: 'いやす', tags: ['休憩', '自然'] },
  { id: 'buy', label: 'かう', tags: ['買い物'] },
] as const;

export type ExperienceCategory = typeof EXPERIENCE_CATEGORIES[number]['id'];

export function experienceCategoryLabel(category: ExperienceCategory): string {
  return EXPERIENCE_CATEGORIES.find((entry) => entry.id === category)?.label ?? category;
}

export function spotSupportsExperienceCategory(
  spot: Pick<Spot, 'themeTags'>,
  category: ExperienceCategory,
): boolean {
  const definition = EXPERIENCE_CATEGORIES.find((entry) => entry.id === category);
  return Boolean(definition?.tags.some((tag) => spot.themeTags.includes(tag)));
}

export function assignPickupCategories(brochure: { items: BrochureItem[] }, spots: Spot[]): BrochureItem[] {
  const spotsById = new Map(spots.map((spot) => [spot.id, spot]));
  const usedCategories = new Set<ExperienceCategory>();
  const usedItems = new Set<string>();
  const assigned = new Map<string, ExperienceCategory>();
  const ordered = [...brochure.items].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  for (const item of ordered) {
    const spot = spotsById.get(item.spotId);
    if (!item.selected || !item.pickupCategory || !spot || usedCategories.has(item.pickupCategory)) continue;
    if (!spotSupportsExperienceCategory(spot, item.pickupCategory)) continue;
    assigned.set(item.id, item.pickupCategory);
    usedCategories.add(item.pickupCategory);
    usedItems.add(item.id);
  }

  const missingDefinitions = EXPERIENCE_CATEGORIES
    .filter((definition) => !usedCategories.has(definition.id))
    .map((definition, index) => ({
      definition,
      index,
      count: ordered.filter((item) => {
        const spot = spotsById.get(item.spotId);
        return !usedItems.has(item.id) && Boolean(spot && spot.active !== false && spotSupportsExperienceCategory(spot, definition.id));
      }).length,
    }))
    .sort((a, b) => a.count - b.count || a.index - b.index);

  for (const { definition } of missingDefinitions) {
    if (usedCategories.has(definition.id)) continue;
    const item = ordered
      .filter((entry) => {
        const spot = spotsById.get(entry.spotId);
        return !usedItems.has(entry.id) && Boolean(spot && spot.active !== false && spotSupportsExperienceCategory(spot, definition.id));
      })
      .sort((a, b) => Number(b.selected) - Number(a.selected) || a.order - b.order || a.id.localeCompare(b.id))[0];
    if (!item) continue;
    assigned.set(item.id, definition.id);
    usedCategories.add(definition.id);
    usedItems.add(item.id);
  }

  const selectedIds = ordered
    .filter((item) => assigned.has(item.id))
    .sort((a, b) => Number(b.selected) - Number(a.selected) || a.order - b.order || a.id.localeCompare(b.id))
    .map((item) => item.id);
  const orderById = new Map(selectedIds.map((id, index) => [id, index]));
  return brochure.items.map((item) => ({
    ...item,
    selected: assigned.has(item.id),
    pickupCategory: assigned.get(item.id) ?? null,
    order: orderById.get(item.id) ?? item.order,
  }));
}

