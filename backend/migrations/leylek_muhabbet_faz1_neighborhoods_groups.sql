-- Leylek Muhabbeti v1 — Faz 1: mahalleler, gruplar, üyelik (Supabase SQL Editor / migration)
-- Posts / comments / reports yok.

CREATE TABLE IF NOT EXISTS neighborhoods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_neighborhoods_city_name UNIQUE (city, name)
);

CREATE INDEX IF NOT EXISTS idx_neighborhoods_city_sort
  ON neighborhoods (city, sort_order ASC, name ASC);

CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id uuid NOT NULL REFERENCES neighborhoods (id) ON DELETE CASCADE,
  city text NOT NULL,
  name text NOT NULL,
  description text,
  member_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_groups_city ON groups (city);
CREATE INDEX IF NOT EXISTS idx_groups_neighborhood ON groups (neighborhood_id);

CREATE TABLE IF NOT EXISTS group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_group_members_group_user UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members (user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members (group_id);

COMMENT ON TABLE neighborhoods IS 'Leylek Muhabbeti Faz 1 — şehir altı mahalle/bölge';
COMMENT ON TABLE groups IS 'Leylek Muhabbeti Faz 1 — mahalleye bağlı grup';
COMMENT ON TABLE group_members IS 'Leylek Muhabbeti Faz 1 — grup üyeliği';

-- Örnek veri (Ankara). Tekrar çalıştırmada çoğalmaz.
INSERT INTO neighborhoods (city, name, sort_order)
VALUES
  ('Ankara', 'Çankaya', 10),
  ('Ankara', 'Keçiören', 20),
  ('Ankara', 'Yenimahalle', 30),
  ('Ankara', 'Mamak', 40),
  ('Ankara', 'Etimesgut', 50)
ON CONFLICT (city, name) DO NOTHING;

INSERT INTO groups (neighborhood_id, city, name, description)
SELECT n.id, 'Ankara', 'Genel muhabbet', 'Mahalle içi genel sohbet ve duyurular (Faz 1 — akış henüz yok).'
FROM neighborhoods n
WHERE n.city = 'Ankara' AND n.name = 'Çankaya'
  AND NOT EXISTS (
    SELECT 1 FROM groups g WHERE g.neighborhood_id = n.id AND g.name = 'Genel muhabbet'
  );

INSERT INTO groups (neighborhood_id, city, name, description)
SELECT n.id, 'Ankara', 'Trafik & yol', 'Anlık yol durumu paylaşımı.'
FROM neighborhoods n
WHERE n.city = 'Ankara' AND n.name = 'Çankaya'
  AND NOT EXISTS (
    SELECT 1 FROM groups g WHERE g.neighborhood_id = n.id AND g.name = 'Trafik & yol'
  );

INSERT INTO groups (neighborhood_id, city, name, description)
SELECT n.id, 'Ankara', 'Genel muhabbet', 'Mahalle içi genel sohbet.'
FROM neighborhoods n
WHERE n.city = 'Ankara' AND n.name = 'Keçiören'
  AND NOT EXISTS (
    SELECT 1 FROM groups g WHERE g.neighborhood_id = n.id AND g.name = 'Genel muhabbet'
  );

INSERT INTO groups (neighborhood_id, city, name, description)
SELECT n.id, 'Ankara', 'Genel muhabbet', 'Mahalle içi genel sohbet.'
FROM neighborhoods n
WHERE n.city = 'Ankara' AND n.name = 'Yenimahalle'
  AND NOT EXISTS (
    SELECT 1 FROM groups g WHERE g.neighborhood_id = n.id AND g.name = 'Genel muhabbet'
  );

INSERT INTO groups (neighborhood_id, city, name, description)
SELECT n.id, 'Ankara', 'Genel muhabbet', 'Mahalle içi genel sohbet.'
FROM neighborhoods n
WHERE n.city = 'Ankara' AND n.name = 'Mamak'
  AND NOT EXISTS (
    SELECT 1 FROM groups g WHERE g.neighborhood_id = n.id AND g.name = 'Genel muhabbet'
  );

INSERT INTO groups (neighborhood_id, city, name, description)
SELECT n.id, 'Ankara', 'Genel muhabbet', 'Mahalle içi genel sohbet.'
FROM neighborhoods n
WHERE n.city = 'Ankara' AND n.name = 'Etimesgut'
  AND NOT EXISTS (
    SELECT 1 FROM groups g WHERE g.neighborhood_id = n.id AND g.name = 'Genel muhabbet'
  );
