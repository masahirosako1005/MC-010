import type { BrochureItem, Companion, Spot, TripSettings, Visit } from '../shared/types.js';
export interface Survey { satisfaction: number | null; goodPoints: string | null; tags: string[]; previousCompanion: string | null }
const keywords: Record<string,string[]> = {
  海:['海','潮','灯台'], 景色:['景色','風景','眺め'], 食:['食','おいし','美味','グルメ'],
  散歩:['散歩','歩','散策'], 文化:['歴史','文化','音楽'], 体験:['体験','楽しか','作'], 自然:['自然','湖','山'],
};
export function surveyTags(survey: Survey | null): string[] {
  const tags=new Set(survey?.tags??[]);
  for(const [tag,words] of Object.entries(keywords)) if(words.some(w=>survey?.goodPoints?.includes(w)))tags.add(tag);
  return [...tags];
}
export function candidateReason(spot: Spot, companion: Companion, tripStyle: 'slow'|'active', tags: string[]): string {
  const matched=spot.themeTags.find(t=>tags.includes(t));
  const preference=tripStyle==='slow'?'ゆっくり過ごす':'いろいろな体験を楽しむ';
  return `${matched?`前回楽しんだ「${matched}」につながる、`:'前回は訪れていない、'}${spot.category}の候補です。${companion==='一人'?'自分のペースで':`${companion}と`}${preference}旅に。`;
}
export function selectRoute(spots: Spot[], visits: Visit[], survey: Survey | null, settings: TripSettings, rotation=0): string[] {
  const visited=new Set(visits.map(v=>v.spotId));
  const tags=surveyTags(survey);
  const preferred=settings.tripStyle==='slow'?['休憩','散歩','景色']:['体験','町歩き','自然'];
  const historicalCategories=new Set(spots.filter(s=>visited.has(s.id)).map(s=>s.category));
  const scored=spots.filter(s=>!visited.has(s.id)).map(s=>({spot:s,score:
    (s.companionTags.includes(settings.companion)?4:0)+s.themeTags.filter(t=>tags.includes(t)).length*3+
    s.themeTags.filter(t=>preferred.includes(t)).length*2+(historicalCategories.has(s.category)?1:0)
  })).sort((a,b)=>b.score-a.score||a.spot.id.localeCompare(b.spot.id));
  // 上位候補から順番に回し、毎回の選び直しを決定的・説明可能にする。
  const offset=scored.length?rotation%scored.length:0;
  const rotated=[...scored.slice(offset),...scored.slice(0,offset)];
  const candidates=rotated.slice(0,settings.duration==='overnight'?3:2).map(s=>s.spot.id);
  const revisits=[...new Set(settings.visitedSpotIds)].filter(id=>visited.has(id));
  return [...revisits,...candidates];
}
export function makeCopy(spots: Spot[], items: Pick<BrochureItem,'spotId'|'kind'|'selected'|'order'|'isMemory'|'comment'>[], settings: Pick<TripSettings,'companion'|'duration'|'tripStyle'>) {
  const names=new Map(spots.map(s=>[s.id,s.name]));
  const chosen=items.filter(i=>i.selected).sort((a,b)=>a.order-b.order);
  const past=items.filter(i=>i.kind==='visited'&&(i.isMemory||i.selected));
  const future=chosen.filter(i=>i.kind==='candidate');
  const style=settings.tripStyle==='slow'?'ゆっくり':'アクティブ';
  const duration=settings.duration==='day'?'日帰り':'一泊二日';
  const theme=`${style}楽しむ${duration}の旅`;
  const title=settings.companion==='一人'?`自分のペースで、${duration}の旅`:`${settings.companion}と、${duration}の旅`;
  const memories=past.map(i=>names.get(i.spotId)).filter(Boolean).join('、');
  const next=future.map(i=>names.get(i.spotId)).filter(Boolean).join('、');
  const route=chosen.map((i,n)=>`${n+1}. ${names.get(i.spotId)??''}${i.comment?`\n   ${i.kind==='visited'?'前回の感想':'行ってみたい理由'}：${i.comment}`:''}`).join('\n');
  const invitation=settings.companion==='一人'
    ?`${memories?`前回訪れた${memories}を振り返って、`:'前回の旅を振り返って、'}次は${theme}を計画しています。${next?`${next}にも行ってみたいです。`:''}\n\n【行きたい場所】\n${route}`
    :`${memories?`前回行った${memories}、また行きたいと思ってるんだ。`:'前回の旅、また出かけたいと思ってるんだ。'}今度は${settings.companion}と、${duration}で${style}楽しむ旅にしよう。${next?`${next}にも寄ってみたいな。`:''}一緒に行かない？\n\n【行きたい場所】\n${route}`;
  return {title,theme,invitation};
}

