import { describe, expect, it } from 'vitest';
import { COMPANIONS } from '../src/shared/types.js';
import {
  loginSchema,
  regenerationSchema,
  saveSchema,
  settingsSchema,
} from '../src/server/validation.js';

const itemId = '11111111-1111-4111-8111-111111111111';
const spotId = '22222222-2222-4222-8222-222222222222';

const validSave = (comment = '') => ({
  revision: 1,
  companion: '友人' as const,
  duration: 'day' as const,
  tripStyle: 'slow' as const,
  template: 'colorful' as const,
  items: [{ id: itemId, selected: true, isMemory: false, order: 0, comment, pickupCategory: 'see' }],
});

describe('loginSchema', () => {
  it('メールをtrim・小文字化し、4桁コードを受け付ける', () => {
    const result = loginSchema.parse({ email: '  Demo@Example.Test ', code: '1111' });

    expect(result).toEqual({ email: 'demo@example.test', code: '1111' });
  });

  it.each([
    { email: 'not-an-email', code: '1111' },
    { email: 'demo@example.test', code: '111' },
    { email: 'demo@example.test', code: '11111' },
  ])('メール形式または4文字コードの境界を拒否する: %o', (payload) => {
    expect(loginSchema.safeParse(payload).success).toBe(false);
  });

  it('未定義フィールドを拒否する', () => {
    expect(loginSchema.safeParse({ email: 'demo@example.test', code: '1111', userId: 'other' }).success).toBe(false);
  });
});

describe('settingsSchema', () => {
  it.each(COMPANIONS)('許可された同行者「%s」を受け付ける', (companion) => {
    expect(settingsSchema.safeParse({
      companion,
      duration: 'day',
      tripStyle: 'slow',
      visitedSpotIds: [spotId],
    }).success).toBe(true);
  });

  it('未知の同行者、日数、旅スタイルを拒否する', () => {
    expect(settingsSchema.safeParse({
      companion: '同僚',
      duration: 'week',
      tripStyle: 'extreme',
      visitedSpotIds: [],
    }).success).toBe(false);
  });

  it('再訪先はUUIDのみ、最大100件に制限する', () => {
    expect(settingsSchema.safeParse({
      companion: '友人', duration: 'day', tripStyle: 'slow', visitedSpotIds: ['../photo.webp'],
    }).success).toBe(false);

    expect(settingsSchema.safeParse({
      companion: '友人',
      duration: 'day',
      tripStyle: 'slow',
      visitedSpotIds: Array.from({ length: 101 }, () => spotId),
    }).success).toBe(false);
  });
});

describe('saveSchema', () => {
  it('空コメントとUnicodeコードポイント200字を受け付ける', () => {
    expect(saveSchema.safeParse(validSave('')).success).toBe(true);
    expect(saveSchema.safeParse(validSave('旅'.repeat(200))).success).toBe(true);
    expect(saveSchema.safeParse(validSave('😀'.repeat(200))).success).toBe(true);
  });

  it('ASCII、日本語、サロゲートペア絵文字のいずれも201字を拒否する', () => {
    expect(saveSchema.safeParse(validSave('a'.repeat(201))).success).toBe(false);
    expect(saveSchema.safeParse(validSave('旅'.repeat(201))).success).toBe(false);
    expect(saveSchema.safeParse(validSave('😀'.repeat(201))).success).toBe(false);
  });

  it('revision、テンプレート、item UUID、順序の境界を検証する', () => {
    expect(saveSchema.safeParse({ ...validSave(), revision: 0 }).success).toBe(false);
    expect(saveSchema.safeParse({ ...validSave(), template: 'dark-saas' }).success).toBe(false);
    expect(saveSchema.safeParse({
      ...validSave(), items: [{ ...validSave().items[0], id: '../../etc/passwd' }],
    }).success).toBe(false);
    expect(saveSchema.safeParse({
      ...validSave(), items: [{ ...validSave().items[0], order: -1 }],
    }).success).toBe(false);
  });

  it('空item配列、1000件超、itemの余分なフィールドを拒否する', () => {
    expect(saveSchema.safeParse({ ...validSave(), items: [] }).success).toBe(false);
    expect(saveSchema.safeParse({
      ...validSave(),
      items: Array.from({ length: 1001 }, () => validSave().items[0]),
    }).success).toBe(false);
    expect(saveSchema.safeParse({
      ...validSave(),
      items: [{ ...validSave().items[0], spotId }],
    }).success).toBe(false);
  });
});

describe('regenerationSchema', () => {
  const settings = {
    companion: '一人' as const,
    duration: 'overnight' as const,
    tripStyle: 'active' as const,
    visitedSpotIds: [spotId],
  };

  it.each(['all', 'candidates'] as const)('再生成モード「%s」を受け付ける', (mode) => {
    expect(regenerationSchema.safeParse({ draft: validSave(), settings, mode }).success).toBe(true);
  });

  it('未知の再生成モードやdraft外の入力を拒否する', () => {
    expect(regenerationSchema.safeParse({ draft: validSave(), settings, mode: 'photos' }).success).toBe(false);
    expect(regenerationSchema.safeParse({ draft: { ...validSave(), userId: 'other' }, settings, mode: 'all' }).success).toBe(false);
  });
});
