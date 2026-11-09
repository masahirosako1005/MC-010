import { createHash } from 'node:crypto';
import type { Spot } from '../shared/types.js';
export function stableId(key: string): string {
  const h = createHash('sha256').update(key).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
}
// 提供CSVの架空7スポットに対する、レビュー済みのデモ表示補足。実在施設・営業時間・距離は推測しない。
const entries = [
  ['月花の風車丘','景色','風車のある丘の風景を楽しむスポット。','景色,散歩,自然','家族,子ども,パートナー,友人,一人','windmill'],
  ['星綾の潮見台','景色','海を見渡す景色を楽しむ展望スポット。','海,景色,休憩','家族,パートナー,友人,親,一人','coast'],
  ['雪雫の音楽堂','文化','音楽に親しむ時間を過ごす文化スポット。','文化,体験,雨の日','家族,子ども,パートナー,友人,親,一人','music'],
  ['灯雲の石畳通り','町歩き','石畳の通りを歩き、店を見ながら町の雰囲気を楽しむスポット。','散歩,町歩き,文化,買い物','家族,パートナー,友人,親,一人','street'],
  ['虹灯りの夜市','食','市場の雰囲気と食を楽しむスポット。','食,買い物,体験','家族,子ども,パートナー,友人','market'],
  ['風詠みの灯台','景色','灯台のある海辺の風景に出会うスポット。','海,散歩,景色','家族,子ども,パートナー,友人,一人','lighthouse'],
  ['瑠璃凪の水鏡湖','自然','湖の景色を眺めながら休憩する自然スポット。','自然,景色,休憩','家族,子ども,パートナー,友人,親,一人','lake'],
];
export const CATALOG: Spot[] = entries.map((e, index) => ({
  id: stableId(`sample-spot-${index+1}`), name: e[0]!, category: e[1]!,
  description: `${e[2]} ※架空スポットのデモ用説明です。`,
  themeTags: e[3]!.split(','), companionTags: e[4]!.split(','),
  image: `/assets/${e[5]}.png`, source: 'organizer', sourceUrl: null,
}));

