ALTER TABLE brochure_items
  ADD COLUMN pickup_category text
  CHECK (pickup_category IN ('see', 'play', 'eat', 'relax', 'buy'));

CREATE UNIQUE INDEX brochure_items_pickup_category_unique
  ON brochure_items (brochure_id, pickup_category)
  WHERE pickup_category IS NOT NULL;

