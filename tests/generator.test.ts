import { describe, expect, it, vi } from 'vitest';
import { ensureBrochure } from '../src/server/brochures.js';
import {
  candidateReason,
  makeCopy,
  selectRoute,
  surveyTags,
  type Survey,
} from '../src/server/generator.js';
import type { BrochureItem, Spot, TripSettings, Visit } from '../src/shared/types.js';

const spot = (
  id: string,
  name: string,
  category: string,
  companionTags: Spot['companionTags'],
  themeTags: Spot['themeTags'],
): Spot => ({
  id,
  name,
  category,
  companionTags,
  themeTags,
  description: `${name}の説明`,
  image: '/assets/demo.webp',
  source: 'fixture',
  sourceUrl: null,
});

const spots = [
  spot('visited-sea', '前回の海辺', '景色', ['友人', '一人'], ['海', '景色', '散歩']),
  spot('friend-cafe', '港のカフェ', '食', ['友人'], ['食', '休憩']),
  spot('solo-lake', '静かな湖', '自然', ['一人', '親'], ['自然', '景色', '休憩']),
  spot('active-market', '体験市場', '町歩き', ['家族', '友人'], ['体験', '町歩き', '食']),
  spot('culture-hall', '音楽堂', '文化', ['パートナー', '親'], ['文化', '雨の日']),
];

const visits: Visit[] = [{
  id: 'visit-1',
  spotId: 'visited-sea',
  visitedAt: '2026-10-01T00:00:00.000Z',
  stamp: true,
  satisfaction: 5,
  goodPoints: '海の景色が良かった',
  previousCompanion: '友人',
}];

const settings = (overrides: Partial<TripSettings> = {}): TripSettings => ({
  companion: '友人',
  duration: 'day',
  tripStyle: 'slow',
  visitedSpotIds: ['visited-sea'],
  ...overrides,
});

describe('surveyTags', () => {
  it('明示タグと感想由来タグを重複なくまとめる', () => {
    const survey: Survey = {
      satisfaction: 5,
      goodPoints: '海の眺めとグルメが良かった',
      tags: ['海'],
      previousCompanion: '友人',
    };

    expect(surveyTags(survey)).toEqual(expect.arrayContaining(['海', '景色', '食']));
    expect(surveyTags(survey).filter((tag) => tag === '海')).toHaveLength(1);
  });

  it('アンケートがなくても安全に空配列を返す', () => {
    expect(surveyTags(null)).toEqual([]);
  });
});

describe('selectRoute', () => {
  it('選択した訪問済みスポットと、同行者・前回タグに合う未訪問候補を組み合わせる', () => {
    const survey: Survey = {
      satisfaction: 5,
      goodPoints: '海の景色が良かった',
      tags: ['食'],
      previousCompanion: '友人',
    };

    const route = selectRoute(spots, visits, survey, settings());

    expect(route[0]).toBe('visited-sea');
    expect(route).toHaveLength(3);
    expect(route.slice(1)).toContain('friend-cafe');
    expect(new Set(route).size).toBe(route.length);
  });

  it('日帰りは新候補2件、一泊二日は新候補3件までにする', () => {
    const day = selectRoute(spots, visits, null, settings({ visitedSpotIds: [] }));
    const overnight = selectRoute(
      spots,
      visits,
      null,
      settings({ duration: 'overnight', visitedSpotIds: [] }),
    );

    expect(day).toHaveLength(2);
    expect(overnight).toHaveLength(3);
    expect(day.every((id) => id !== 'visited-sea')).toBe(true);
  });

  it('再訪先は実際の履歴にあるものだけを採用し、重複も作らない', () => {
    const route = selectRoute(
      spots,
      visits,
      null,
      settings({ visitedSpotIds: ['visited-sea', 'not-visited', 'visited-sea'] }),
    );

    expect(route.filter((id) => id === 'visited-sea')).toHaveLength(1);
    expect(route).not.toContain('not-visited');
  });

  it('rotationで候補を選び直しても訪問済み選択を保持する', () => {
    const first = selectRoute(spots, visits, null, settings(), 0);
    const regenerated = selectRoute(spots, visits, null, settings(), 1);

    expect(first[0]).toBe('visited-sea');
    expect(regenerated[0]).toBe('visited-sea');
    expect(regenerated.slice(1)).not.toEqual(first.slice(1));
  });

});

describe('candidateReason', () => {
  it('一人旅では同行を誘う表現にせず、自分のペースという理由にする', () => {
    const reason = candidateReason(spots[2]!, '一人', 'slow', ['自然']);

    expect(reason).toContain('自分のペースで');
    expect(reason).not.toContain('一人と');
    expect(reason).toContain('前回楽しんだ「自然」');
  });
});

describe('makeCopy', () => {
  const items: Array<Pick<BrochureItem, 'spotId' | 'kind' | 'selected' | 'order' | 'isMemory' | 'comment'>> = [
    { spotId: 'visited-sea', kind: 'visited', selected: true, order: 0, isMemory: true, comment: '潮風が気持ちよかった' },
    { spotId: 'friend-cafe', kind: 'candidate', selected: true, order: 2, isMemory: false, comment: '海を見ながら休みたい' },
    { spotId: 'active-market', kind: 'candidate', selected: true, order: 1, isMemory: false, comment: '' },
  ];

  it('訪問順、前回の感想、行ってみたい理由を共有文へ反映する', () => {
    const copy = makeCopy(spots, items, settings());

    expect(copy.invitation).toContain('前回行った前回の海辺');
    expect(copy.invitation.indexOf('1. 前回の海辺')).toBeLessThan(copy.invitation.indexOf('2. 体験市場'));
    expect(copy.invitation).toContain('前回の感想：潮風が気持ちよかった');
    expect(copy.invitation).toContain('行ってみたい理由：海を見ながら休みたい');
    expect(copy.invitation).toContain('一緒に行かない？');
  });

  it('同行者が一人なら招待ではなく旅紹介文として成立する', () => {
    const copy = makeCopy(spots, items, settings({ companion: '一人' }));

    expect(copy.title).toBe('自分のペースで、日帰りの旅');
    expect(copy.invitation).toContain('計画しています');
    expect(copy.invitation).not.toContain('一緒に行かない？');
    expect(copy.invitation).not.toContain('一人と');
  });
});

describe('ensureBrochure', () => {
  it('利用者に訪問履歴がなければパンフレットを挿入しない', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM brochures')) return { rows: [] };
      if (sql.includes('FROM spots')) return { rows: [] };
      if (sql.includes('FROM visits')) return { rows: [] };
      if (sql.includes('FROM surveys')) return { rows: [] };
      if (sql.includes('FROM users')) return { rows: [{ id: 'user-1' }] };
      throw new Error(`予期しないSQL: ${sql}`);
    });

    await expect(ensureBrochure({ query } as never, 'user-1')).rejects.toMatchObject({
      status: 422,
      code: 'history_missing',
    });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO brochures'))).toBe(false);
  });
});
