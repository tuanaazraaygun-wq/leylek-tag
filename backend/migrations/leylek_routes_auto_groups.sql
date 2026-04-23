-- Leylek: güzergah kaydı, eşleşme, otomatik Muhabbet grubu
-- Önkoşut: public.users, Faz-1 groups / neighborhoods / group_members

CREATE TABLE IF NOT EXISTS public.user_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  start_lat double precision NOT NULL,
  start_lng double precision NOT NULL,
  end_lat double precision NOT NULL,
  end_lng double precision NOT NULL,
  city text NOT NULL,
  district text,
  pattern_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_routes_user_id ON public.user_routes (user_id);
CREATE INDEX IF NOT EXISTS idx_user_routes_city ON public.user_routes (city);
CREATE INDEX IF NOT EXISTS idx_user_routes_pattern ON public.user_routes (city, pattern_hash);

CREATE TABLE IF NOT EXISTS public.route_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  distance_meters integer NOT NULL,
  same_city boolean NOT NULL DEFAULT true,
  same_district boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_route_matches_pair UNIQUE (user_a, user_b),
  CONSTRAINT route_matches_order CHECK (user_a < user_b)
);

CREATE INDEX IF NOT EXISTS idx_route_matches_user_a ON public.route_matches (user_a);
CREATE INDEX IF NOT EXISTS idx_route_matches_user_b ON public.route_matches (user_b);

CREATE TABLE IF NOT EXISTS public.auto_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_hash text NOT NULL,
  city text NOT NULL,
  name text NOT NULL,
  group_id uuid REFERENCES public.groups (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_auto_groups_city_hash UNIQUE (city, route_hash)
);

CREATE INDEX IF NOT EXISTS idx_auto_groups_group ON public.auto_groups (group_id) WHERE group_id IS NOT NULL;

COMMENT ON TABLE public.user_routes IS 'Kullanıcı start/end güzergahı; pattern_hash = otomatik grup anahtarı';
COMMENT ON TABLE public.route_matches IS 'Aynı şehir, yaklaşık aynı rota; user_a < user_b';
COMMENT ON TABLE public.auto_groups IS 'Güzergah kovası; Muhabbet groups ile group_id üzerinden bağlı';
