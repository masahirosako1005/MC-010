import { MapPinned } from 'lucide-react';
import type { CSSProperties } from 'react';
import { EXPERIENCE_CATEGORIES, type ExperienceCategory } from '../shared/experience-categories';
import { spotListDescription } from '../shared/spot-copy';
import type { BrochureItem, Spot } from '../shared/types';
import './trip-map.css';

const positions: Record<ExperienceCategory, { x: number; y: number; mobileX: number; mobileY: number }> = {
  see: { x: 24, y: 25, mobileX: 25, mobileY: 18 },
  play: { x: 60, y: 12, mobileX: 75, mobileY: 5 },
  eat: { x: 82, y: 40, mobileX: 75, mobileY: 39 },
  relax: { x: 76, y: 70, mobileX: 75, mobileY: 73 },
  buy: { x: 24, y: 65, mobileX: 25, mobileY: 73 },
};

function routePath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => {
    if (!index) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1]!;
    const middleX = (previous.x + point.x) / 2;
    return `C ${middleX} ${previous.y}, ${middleX} ${point.y}, ${point.x} ${point.y}`;
  }).join(' ');
}

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

  const routes = {
    desktop: routePath(entries.map(({ position }) => position)),
    mobile: routePath(entries.map(({ position }) => ({ x: position.mobileX, y: position.mobileY }))),
  };

  return <section className="trip-map" aria-labelledby="trip-map-title">
    <div className="trip-map-heading"><MapPinned aria-hidden="true" /><h2 id="trip-map-title">旅の全体像</h2></div>
    <figure className="trip-map-figure">
      <div className="trip-map-canvas">
        <img className="trip-map-art" src="/assets/trip-overview-map-v1.webp" alt="" width="1440" height="1080" loading="lazy" />
        {Object.entries(routes).map(([layout, route]) => <svg key={layout} className={`trip-map-route trip-map-route-${layout}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d={route} className="trip-map-route-halo" vectorEffect="non-scaling-stroke" />
          <path d={route} className="trip-map-route-line" vectorEffect="non-scaling-stroke" />
        </svg>)}
        {entries.map(({ item, category, spot, position }, index) => <button key={item.id} type="button"
          className={`trip-map-marker trip-map-${category.id}`} style={{
            '--marker-x': `${position.x}%`, '--marker-y': `${position.y}%`,
            '--marker-mobile-x': `${position.mobileX}%`, '--marker-mobile-y': `${position.mobileY}%`,
          } as CSSProperties} aria-describedby={`trip-map-description-${category.id}`}
          aria-label={`マップの${index + 1}番、${category.label}：${spot.name}の詳細を表示`} title={spot.name} onClick={() => onOpen(spot.id)}>
          <span className="trip-map-marker-heading"><span className="trip-map-pin"><span>{index + 1}</span></span><strong>{category.label}</strong></span>
          <span className="trip-map-callout">
            <strong className="trip-map-place-name" title={spot.name}>{spot.name}</strong>
            <span id={`trip-map-description-${category.id}`} className="trip-map-description">{spotListDescription(spot)}</span>
          </span>
        </button>)}
      </div>
      <figcaption>{entries.length}つの楽しみを、ひとめぐり。</figcaption>
    </figure>
  </section>;
}
