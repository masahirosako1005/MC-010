import type { ExperienceCategory } from './experience-categories.js';

export const COMPANIONS = ['家族', '子ども', 'パートナー', '友人', '親', '一人'] as const;
export type Companion = typeof COMPANIONS[number];
export type TripStyle = 'slow' | 'active';
export type Duration = 'day' | 'overnight';
export type Template = 'colorful' | 'postcard';
export interface Spot {
  id: string; name: string; category: string; description: string;
  companionTags: string[]; themeTags: string[]; image: string;
  source: 'fixture' | 'organizer' | 'town'; sourceUrl: string | null;
  active?: boolean;
  hasGift?: boolean;
}
export interface Visit {
  id: string; spotId: string; visitedAt: string; stamp: boolean;
  satisfaction: number | null; goodPoints: string | null; previousCompanion: string | null;
}
export interface BrochureItem {
  id: string; spotId: string; kind: 'visited' | 'candidate'; selected: boolean;
  isMemory: boolean; order: number; comment: string; photoUrl: string | null;
  reason: string; pickupCategory: ExperienceCategory | null;
}
export interface Brochure {
  id: string; revision: number; companion: Companion; duration: Duration; tripStyle: TripStyle;
  template: Template; title: string; theme: string; invitation: string;
  items: BrochureItem[]; updatedAt: string;
}
export interface User { id: string; displayName: string; source: 'fixture' | 'organizer'; role?: 'visitor' | 'town_admin' }
export interface SessionData { user: User; visits: Visit[]; spots: Spot[]; brochure: Brochure | null; survey?: {satisfaction:number|null;goodPoints:string|null;previousCompanion:string|null}|null }
export interface TripSettings { companion: Companion; duration: Duration; tripStyle: TripStyle; visitedSpotIds: string[] }
export interface SavePayload {
  revision: number; companion: Companion; duration: Duration; tripStyle: TripStyle; template: Template;
  items: Array<Pick<BrochureItem, 'id' | 'selected' | 'isMemory' | 'order' | 'comment' | 'pickupCategory'>>;
}

