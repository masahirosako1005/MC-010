import type { Companion, Spot } from './types.js';
import type { ExperienceCategory } from './experience-categories.js';

export const SPOT_IMAGES = [
  { value: '/assets/windmill.png', label: '風車の丘' },
  { value: '/assets/coast.png', label: '海の展望台' },
  { value: '/assets/music.png', label: '音楽堂' },
  { value: '/assets/street.png', label: '石畳の通り' },
  { value: '/assets/market.png', label: '夜市' },
  { value: '/assets/lighthouse.png', label: '灯台' },
  { value: '/assets/lake.png', label: '湖' },
] as const;
export const THEME_TAGS = ['景色', '海', '体験', '町歩き', '散歩', '文化', '食', '休憩', '自然', '買い物', '雨の日'] as const;
export type DataScope = 'all' | 'organizer' | 'fixture';
export interface SpotInput {
  name: string; category: string; description: string; image: string;
  themeTags: string[]; companionTags: Companion[]; active: boolean; hasGift?: boolean;
}
export interface AdminSpot extends Spot {
  active: boolean; revision: number; updatedAt: string;
  visitCount: number; visitorCount: number; brochureCount: number;
  hasGift: boolean; giftClaimCount: number;
}
export interface AdminOverview {
  users: number; usersWithVisits: number; brochures: number; eligibleBrochures: number;
  activeSpots: number; stoppedSpots: number;
  categories: Array<{ category: ExperienceCategory; count: number }>;
  popularSpots: Array<{ id: string; name: string; count: number }>;
}
export interface RegistrationRow {
  userId: string; source: 'fixture' | 'organizer'; visits: number;
  brochureId: string | null; createdAt: string | null; updatedAt: string | null;
  selectedSpots: number; photos: number; comments: number;
}
export interface RegistrationPage { rows: RegistrationRow[]; total: number; page: number; pageSize: number }
export interface GiftClaim { id: string; spotId: string; claimedAt: string }
export interface SpotDetail { spot: Spot; giftClaim: GiftClaim | null }
export interface CouponDisplay { couponCode: string | null; giftClaim: GiftClaim | null }
export interface GiftClaimRecord extends GiftClaim { spotName: string; userId: string; source: 'fixture' | 'organizer' }
export interface GiftClaimPage { rows: GiftClaimRecord[]; total: number; users: number; page: number; pageSize: number }
