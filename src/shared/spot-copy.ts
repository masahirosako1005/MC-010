import type { Brochure, BrochureItem, Spot } from './types.js';
import { experienceCategoryLabel } from './experience-categories.js';

export function spotOverview(spot: Pick<Spot, 'description' | 'category' | 'themeTags'>): string {
  const text = spot.description.replace(/\s*※架空スポットのデモ用説明です。?\s*$/u, '').trim()
    || `${spot.category}のスポット。${spot.themeTags.slice(0, 3).join('・')}`;
  const points = Array.from(text);
  return points.length > 120 ? `${points.slice(0, 120).join('')}…` : text;
}

export function spotListDescription(spot: Pick<Spot, 'description' | 'category' | 'themeTags'>): string {
  const overview = spotOverview(spot);
  const sentence = overview.match(/^[^。！？!?\r\n]+[。！？!?]?/u)?.[0] ?? overview;
  const points = Array.from(sentence);
  return points.length > 40 ? `${points.slice(0, 40).join('')}...` : sentence;
}

export function spotRecommendation(item: Pick<BrochureItem, 'kind' | 'reason' | 'pickupCategory'>, trip: Pick<Brochure, 'companion' | 'tripStyle'>): string {
  if (item.kind === 'visited') {
    const who = trip.companion === '一人' ? '自分のペースで' : `${trip.companion}と`;
    const pace = trip.companion === '一人' ? '' : trip.tripStyle === 'slow' ? 'ゆっくり' : '新しい視点で';
    return `前回の旅の思い出を、今度は${who}${pace}楽しみ直すために選びました。`;
  }
  return item.reason.trim() || `${item.pickupCategory ? `「${experienceCategoryLabel(item.pickupCategory)}」の` : '次の旅の'}楽しみを広げる、新しい体験としておすすめします。`;
}
