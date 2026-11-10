import { MapPinned } from 'lucide-react';
import type { CSSProperties } from 'react';
import { EXPERIENCE_CATEGORIES, type ExperienceCategory } from '../shared/experience-categories';
import type { BrochureItem, Spot } from '../shared/types';
import { spotListDescription } from '../shared/spot-copy';
import './trip-map.css';

// Callouts use their top-left corner; the route runs between separate points below them.
const positions: Record<ExperienceCategory, { left: number; top: number; width: number; x: number; y: number }> = {
  see: { left: 15, top: 5, width: 32, x: 22, y: 35 },
  play: { left: 53, top: 1, width: 43, x: 60, y: 31 },
  eat: { left: 67, top: 34, width: 32, x: 81, y: 64 },
  relax: { left: 59, top: 67, width: 40, x: 69, y: 97 },
  buy: { left: 15, top: 58, width: 35, x: 23, y: 88 },
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

  const route = routePath(entries.map(({ position }) => position));

  return <section className="trip-map" aria-labelledby="trip-map-title">
    <div className="trip-map-heading"><MapPinned aria-hidden="true" /><h2 id="trip-map-title">旅の全体像</h2></div>
    <figure className="trip-map-figure">
      <div className="trip-map-canvas">
        <picture className="trip-map-artwork">
          <img className="trip-map-art" src="/assets/trip-overview-map-v1.webp" alt="" width="1440" height="1080" loading="lazy" />
        </picture>
        <svg className="trip-map-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d={route} className="trip-map-route-halo" vectorEffect="non-scaling-stroke" />
          <path d={route} className="trip-map-route-line" vectorEffect="non-scaling-stroke" />
          {entries.map(({ item, position }) => <circle key={item.id} cx={position.x} cy={position.y} r="1.6" className="trip-map-route-stop" vectorEffect="non-scaling-stroke" />)}
        </svg>
        {entries.map(({ item, category, spot, position }, index) => <button key={item.id} type="button"
          className={`trip-map-marker trip-map-${category.id}`} style={{
            '--marker-left': `${position.left}%`, '--marker-top': `${position.top}%`,
            '--marker-width': `${position.width}%`,
          } as CSSProperties}
          aria-label={`マップの${index + 1}番、${category.label}：${spot.name}の詳細を表示`} title={spot.name} onClick={() => onOpen(spot.id)}>
          <span className="trip-map-marker-heading"><span className="trip-map-pin"><span>{index + 1}</span></span><strong>{category.label}</strong></span>
          <span className="trip-map-callout">
            <strong className="trip-map-place-name" title={spot.name}>{spot.name}</strong>
            <span className="trip-map-description">{spotListDescription(spot)}</span>
          </span>
        </button>)}
      </div>
      <figcaption>{entries.length}つの楽しみを、ひとめぐり。</figcaption>
    </figure>
  </section>;
}
