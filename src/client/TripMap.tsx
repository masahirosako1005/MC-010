import { MapPinned } from 'lucide-react';
import { EXPERIENCE_CATEGORIES, type ExperienceCategory } from '../shared/experience-categories';
import { spotListDescription } from '../shared/spot-copy';
import type { BrochureItem, Spot } from '../shared/types';
import './trip-map.css';

const positions: Record<ExperienceCategory, { x: number; y: number }> = {
  see: { x: 24, y: 25 },
  play: { x: 60, y: 12 },
  eat: { x: 82, y: 36 },
  relax: { x: 76, y: 70 },
  buy: { x: 24, y: 65 },
};

interface TripMapProps {
  selected: BrochureItem[];
  spotsById: Map<string, Spot>;
  onOpen: (spotId: string) => void;
}

export function TripMap({ selected, spotsById, onOpen }: TripMapProps) {
  const entries = selected.flatMap(item => {
    const category = EXPERIENCE_CATEGORIES.find(value => value.id === item.pickupCategory);
    const spot = spotsById.get(item.spotId);
    return category && spot ? [{ item, category, spot, position: positions[category.id] }] : [];
  });
  if (!entries.length) return null;

  const route = entries.map(({ position }, index) => {
    if (!index) return `M ${position.x} ${position.y}`;
    const previous = entries[index - 1]!.position;
    const middleX = (previous.x + position.x) / 2;
    return `C ${middleX} ${previous.y}, ${middleX} ${position.y}, ${position.x} ${position.y}`;
  }).join(' ');

  return <section className="trip-map" aria-labelledby="trip-map-title">
    <div className="trip-map-heading"><MapPinned aria-hidden="true" /><h2 id="trip-map-title">旅の全体像</h2></div>
    <div className="trip-map-layout">
      <figure className="trip-map-figure">
        <div className="trip-map-canvas">
          <img className="trip-map-art" src="/assets/trip-overview-map-v1.webp" alt="" width="1440" height="1080" loading="lazy" />
          <svg className="trip-map-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d={route} className="trip-map-route-halo" vectorEffect="non-scaling-stroke" />
            <path d={route} className="trip-map-route-line" vectorEffect="non-scaling-stroke" />
          </svg>
          {entries.map(({ item, category, spot, position }, index) => <button key={item.id} type="button"
            className={`trip-map-marker trip-map-${category.id}`} style={{ left: `${position.x}%`, top: `${position.y}%` }}
            aria-label={`マップの${index + 1}番、${category.label}：${spot.name}の詳細を表示`} title={spot.name} onClick={() => onOpen(spot.id)}>
            <span className="trip-map-pin"><span>{index + 1}</span></span><strong>{category.label}</strong>
          </button>)}
        </div>
        <figcaption>{entries.length}つの楽しみを、ひとめぐり。</figcaption>
      </figure>
      <ol className="trip-map-spots" aria-label="マップに掲載したスポットと紹介">
        {entries.map(({ item, category, spot }, index) => <li key={item.id} className={`trip-map-${category.id}`}>
          <button type="button" className="trip-map-spot" aria-label={`マップの紹介：${spot.name}の詳細を表示`} onClick={() => onOpen(spot.id)}>
            <span className="trip-map-spot-category"><span>{index + 1}</span>{category.label}</span>
            <strong title={spot.name}>{spot.name}</strong>
            <span className="trip-map-description">{spotListDescription(spot)}</span>
          </button>
        </li>)}
      </ol>
    </div>
  </section>;
}
