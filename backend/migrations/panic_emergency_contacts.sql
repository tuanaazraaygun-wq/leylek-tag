-- Panic system: emergency contacts + panic event audit
-- Run on Supabase SQL editor or psql after review.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS user_emergency_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    phone_normalized TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('manual', 'device_contact')),
    sort_order SMALLINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_display_name_len CHECK (char_length(trim(display_name)) BETWEEN 1 AND 120)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_emergency_contacts_user_phone_active
    ON user_emergency_contacts (user_id, phone_normalized)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_user_emergency_contacts_user_id
    ON user_emergency_contacts (user_id);

CREATE TABLE IF NOT EXISTS panic_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_at_trigger TEXT NOT NULL CHECK (role_at_trigger IN ('driver', 'passenger')),
    tag_id UUID REFERENCES tags(id) ON DELETE SET NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_accuracy_m REAL,
    location_captured_at TIMESTAMPTZ,
    selected_contact_count SMALLINT NOT NULL,
    selected_contacts JSONB NOT NULL,
    sms_result_summary JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_panic_events_user_id ON panic_events(user_id);
CREATE INDEX IF NOT EXISTS idx_panic_events_created_at ON panic_events(created_at DESC);
