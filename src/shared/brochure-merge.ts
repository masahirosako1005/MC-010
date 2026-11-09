import type { Brochure, BrochureItem } from './types.js';

const route = (items: BrochureItem[]) => JSON.stringify([...items].sort((a, b) => a.id.localeCompare(b.id)).map(item => [item.id, item.selected, item.order, item.pickupCategory]));

// 明示的な競合回復で使用する。写真・revision・追加itemは最新の保存情報を採用する。
export function mergeBrochureEdits(base: Brochure, local: Brochure, latest: Brochure): Brochure {
  if (base.id !== local.id || local.id !== latest.id) throw new Error('しおりが変わっています。ログインし直してください。');
  const localRouteChanged = route(local.items) !== route(base.items);
  const baseItems = new Map(base.items.map(item => [item.id, item]));
  const localItems = new Map(local.items.map(item => [item.id, item]));
  return {
    ...latest,
    companion: local.companion !== base.companion ? local.companion : latest.companion,
    duration: local.duration !== base.duration ? local.duration : latest.duration,
    tripStyle: local.tripStyle !== base.tripStyle ? local.tripStyle : latest.tripStyle,
    template: local.template !== base.template ? local.template : latest.template,
    items: latest.items.map(item => {
      const old = baseItems.get(item.id), edit = localItems.get(item.id);
      if (!old || !edit) return localRouteChanged ? { ...item, selected: false, pickupCategory: null } : item;
      return { ...item,
        comment: edit.comment !== old.comment ? edit.comment : item.comment,
        isMemory: edit.isMemory !== old.isMemory ? edit.isMemory : item.isMemory,
        ...(localRouteChanged ? { selected: edit.selected, order: edit.order, pickupCategory: edit.pickupCategory } : {}),
      };
    }),
  };
}
