import type { Brochure, Spot, Visit } from './types.js';

export interface SharedSpotLike { spotId: string; count: number; liked: boolean }
export interface SharedSpotLikes { spots: SharedSpotLike[] }

export interface ShareSettings {
  id: string;
  path: string;
  active: boolean;
  viewCount: number;
  createdAt: string;
  lastViewedAt: string | null;
}
export interface SharedBrochure {
  brochure: Brochure;
  spots: Spot[];
  memoryVisits: Array<Pick<Visit, 'spotId' | 'visitedAt' | 'stamp'>>;
  viewerIsOwner: boolean;
}
export interface AdminShareRow {
  id: string;
  userId: string;
  source: 'fixture' | 'organizer';
  active: boolean;
  viewCount: number;
  copyCount: number;
  likeCount: number;
  lastCopiedAt: string | null;
  createdAt: string;
  lastViewedAt: string | null;
}
export interface AdminSharePage {
  rows: AdminShareRow[];
  total: number;
  active: number;
  totalViews: number;
  totalCopies: number;
  totalLikes: number;
  page: number;
  pageSize: number;
}
