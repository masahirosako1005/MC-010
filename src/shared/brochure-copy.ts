import type { Companion, TripSettings } from './types.js';

const titles: Record<Companion, string> = {
  家族: '思い出のつづき、今度は家族と',
  子ども: 'あの日の思い出から、子どもと新しい発見へ',
  パートナー: 'あの日の続き、今度はふたりで',
  友人: 'あの日の続きへ、今度は友人と',
  親: '思い出をつないで、親と過ごす次の旅',
  一人: '自分のペースで、思い出のその先へ',
};

export function brochureTitle(settings: Pick<TripSettings, 'companion'>): string {
  return titles[settings.companion];
}

export function displayBrochureTitle(savedTitle: string, settings: Pick<TripSettings, 'companion' | 'duration'>): string {
  const duration = settings.duration === 'day' ? '日帰り' : '一泊二日';
  const legacy = settings.companion === '一人' ? `自分のペースで、${duration}の旅` : `${settings.companion}と、${duration}の旅`;
  return savedTitle === legacy ? brochureTitle(settings) : savedTitle;
}
