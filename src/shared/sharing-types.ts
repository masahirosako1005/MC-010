import type { Brochure, Spot, Visit } from './types.js';

export interface ShareSettings {
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
  createdAt: string;
  lastViewedAt: string | null;
}
export interface AdminSharePage {
  rows: AdminShareRow[];
  total: number;
  active: number;
  totalViews: number;
  page: number;
  pageSize: number;
}
