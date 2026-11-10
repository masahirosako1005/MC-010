import { Eye, Image as ImageIcon, LayoutGrid, Leaf, ShoppingBag, Sparkles, Utensils } from 'lucide-react';
import { useState } from 'react';
import { EXPERIENCE_CATEGORIES } from '../shared/experience-categories';
import { spotListDescription } from '../shared/spot-copy';
import type { BrochureItem, Spot } from '../shared/types';
import './trip-overview.css';

const categoryIcons = { see: Eye, play: Sparkles, eat: Utensils, relax: Leaf, buy: ShoppingBag };

interface TripOverviewProps {
  selected: BrochureItem[];
  spotsById: Map<string, Spot>;
  pendingPhotos: Record<string, { preview: string }>;
  onOpen: (spotId: string) => void;
}

export function TripOverview({ selected, spotsById, pendingPhotos, onOpen }: TripOverviewProps) {
  const entries = EXPERIENCE_CATEGORIES.flatMap(category => {
    const item = selected.find(value => value.pickupCategory === category.id);
    const spot = item ? spotsById.get(item.spotId) : undefined;
    return item && spot ? [{ category, item, spot }] : [];
  });

  if (!entries.length) return null;

  return <section className="trip-overview" aria-labelledby="trip-overview-title">
    <div className="trip-overview-heading"><LayoutGrid aria-hidden="true" /><h2 id="trip-overview-title">旅の全体像</h2></div>
    <ul className="trip-overview-grid" aria-label="今回の旅のスポット一覧">
      {entries.map(({ category, item, spot }) => {
        const image = pendingPhotos[item.id]?.preview || item.photoUrl || spot.image;
        const Icon = categoryIcons[category.id];
        const description = spotListDescription(spot);
        return <li key={item.id} className={`trip-overview-item trip-overview-${category.id}`}>
          <button type="button" className="trip-overview-spot" aria-label={`旅の全体像：${spot.name}の詳細を表示`} onClick={() => onOpen(spot.id)}>
            <span className="trip-overview-photo">
              <OverviewPhoto key={image} src={image} />
              <span className="trip-overview-category"><Icon aria-hidden="true" />{category.label}</span>
            </span>
            <span className="trip-overview-copy">
              <strong className="trip-overview-name" title={spot.name}>{spot.name}</strong>
              <span className="trip-overview-description" title={description}>{description}</span>
            </span>
          </button>
        </li>;
      })}
    </ul>
  </section>;
}

function OverviewPhoto({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return src && !failed
    ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
    : <span className="trip-overview-photo-empty"><ImageIcon aria-hidden="true" /><span>画像を表示できません</span></span>;
}
