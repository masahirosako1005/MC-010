import type { AdminSpot, DataScope } from './admin-types.js';
import type { Companion, Duration, Template, TripStyle } from './types.js';
import type { ExperienceCategory } from './experience-categories.js';

export interface AdminRegistrationDetail {
  registration: { userId: string; source: 'organizer' | 'fixture'; visits: number; visitedSpots: number; stamps: number; lastVisitedAt: string | null };
  brochure: { id: string; revision: number; companion: Companion; duration: Duration; tripStyle: TripStyle; template: Template;
    createdAt: string; updatedAt: string; regenerationCount: number; selectedSpots: number; memorySpots: number; photos: number; comments: number } | null;
  items: Array<{ id: string; spotId: string; name: string; active: boolean; kind: 'visited' | 'candidate'; selected: boolean; isMemory: boolean;
    order: number; pickupCategory: ExperienceCategory | null; hasPhoto: boolean; hasComment: boolean; commentLength: number }>;
  share: { active: boolean; viewCount: number; copyCount: number; likeCount: number; createdAt: string; lastViewedAt: string | null; lastCopiedAt: string | null } | null;
}

export interface SpotAnalyticsDay { date: string; visits: number; brochures: number; couponUses: number; shareViews: number; shareCopies: number }
export interface AnalyticsBreakdown { key: string; count: number }
export interface AdminSpotAnalytics {
  scope: DataScope;
  spot: Pick<AdminSpot, 'id' | 'name' | 'category' | 'description' | 'image' | 'source' | 'active' | 'hasGift' | 'themeTags'>;
  totals: { visits: number; visitors: number; firstVisitedAt: string | null; lastVisitedAt: string | null;
    brochures: number; allBrochures: number; memoryBrochures: number; visitedSelections: number; candidateSelections: number;
    photos: number; comments: number; couponUses: number; sharedPages: number; activeSharedPages: number; shareViews: number; shareCopies: number; likeCount: number };
  breakdowns: { companions: AnalyticsBreakdown[]; durations: AnalyticsBreakdown[]; tripStyles: AnalyticsBreakdown[]; categories: AnalyticsBreakdown[] };
  period: { from: string; to: string; totals: Omit<SpotAnalyticsDay, 'date'>; days: SpotAnalyticsDay[] };
  recentBrochures: Array<{ id: string; userId: string; source: 'fixture' | 'organizer'; companion: Companion; duration: Duration; tripStyle: TripStyle; createdAt: string; updatedAt: string }>;
}
