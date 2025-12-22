-- Leylek TAG - Supabase Database Schema
-- Migration from MongoDB to PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mongo_id TEXT UNIQUE,  -- Eski MongoDB ID'si (migration için)
    phone TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    city TEXT,
    pin_hash TEXT,
    profile_photo TEXT,
    rating DECIMAL(3,2) DEFAULT 5.0,
    total_ratings INTEGER DEFAULT 0,
    total_trips INTEGER DEFAULT 0,
    penalty_points INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_premium BOOLEAN DEFAULT FALSE,
    push_token TEXT,
    push_token_updated_at TIMESTAMPTZ,
    
    -- Driver details (JSON for flexibility)
    driver_details JSONB,
    
    -- Location
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    last_location_update TIMESTAMPTZ,
    
    -- Device info
    device_ids TEXT[],
    verified_devices TEXT[],
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    last_active TIMESTAMPTZ
);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);
CREATE INDEX IF NOT EXISTS idx_users_push_token ON users(push_token);
CREATE INDEX IF NOT EXISTS idx_users_location ON users(latitude, longitude);

-- =============================================
-- TAGS TABLE (Trip Requests)
-- =============================================
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mongo_id TEXT UNIQUE,
    
    -- Passenger info
    passenger_id UUID REFERENCES users(id),
    passenger_name TEXT,
    
    -- Driver info (after match)
    driver_id UUID REFERENCES users(id),
    driver_name TEXT,
    
    -- Locations
    pickup_location TEXT,
    pickup_lat DECIMAL(10, 8),
    pickup_lng DECIMAL(11, 8),
    dropoff_location TEXT,
    dropoff_lat DECIMAL(10, 8),
    dropoff_lng DECIMAL(11, 8),
    
    -- Status
    status TEXT DEFAULT 'pending',  -- pending, offers_received, matched, in_progress, completed, cancelled
    
    -- Trip details
    notes TEXT,
    share_link TEXT,
    city TEXT,
    final_price DECIMAL(10, 2),
    accepted_offer_id UUID,
    
    -- Flags
    emergency_shared BOOLEAN DEFAULT FALSE,
    mutual_end BOOLEAN,
    penalty_applied BOOLEAN DEFAULT FALSE,
    penalty_user_id UUID,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    matched_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ
);

-- Tags indexes
CREATE INDEX IF NOT EXISTS idx_tags_passenger_id ON tags(passenger_id);
CREATE INDEX IF NOT EXISTS idx_tags_driver_id ON tags(driver_id);
CREATE INDEX IF NOT EXISTS idx_tags_status ON tags(status);
CREATE INDEX IF NOT EXISTS idx_tags_city ON tags(city);
CREATE INDEX IF NOT EXISTS idx_tags_created_at ON tags(created_at DESC);

-- =============================================
-- OFFERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mongo_id TEXT UNIQUE,
    
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES users(id),
    driver_name TEXT,
    driver_rating DECIMAL(3,2),
    driver_photo TEXT,
    
    -- Offer details
    price DECIMAL(10, 2) NOT NULL,
    estimated_time INTEGER,  -- minutes
    notes TEXT,
    
    -- Vehicle info
    vehicle_model TEXT,
    vehicle_color TEXT,
    vehicle_photo TEXT,
    is_premium BOOLEAN DEFAULT FALSE,
    
    -- Distance/Time calculations
    distance_to_passenger_km DECIMAL(10, 2),
    estimated_arrival_min INTEGER,
    trip_distance_km DECIMAL(10, 2),
    trip_duration_min INTEGER,
    
    -- Status
    status TEXT DEFAULT 'pending',  -- pending, accepted, rejected, expired
    expires_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Offers indexes
CREATE INDEX IF NOT EXISTS idx_offers_tag_id ON offers(tag_id);
CREATE INDEX IF NOT EXISTS idx_offers_driver_id ON offers(driver_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_expires_at ON offers(expires_at);

-- =============================================
-- BLOCKED USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS blocked_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    blocked_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_user_id ON blocked_users(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_user_id ON blocked_users(blocked_user_id);

-- =============================================
-- NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target TEXT,  -- all, drivers, passengers
    target_users UUID[],
    sent_by TEXT,
    push_sent INTEGER DEFAULT 0,
    push_failed INTEGER DEFAULT 0,
    read_by UUID[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- =============================================
-- APP SETTINGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT UNIQUE DEFAULT 'global',
    driver_radius_km INTEGER DEFAULT 50,
    max_call_duration_minutes INTEGER DEFAULT 30,
    min_call_duration_seconds INTEGER DEFAULT 10,
    max_trip_distance_km INTEGER DEFAULT 100,
    commission_percentage INTEGER DEFAULT 10,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO app_settings (type, driver_radius_km, max_call_duration_minutes) 
VALUES ('global', 50, 30) 
ON CONFLICT (type) DO NOTHING;

-- =============================================
-- CALL LOGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tag_id UUID REFERENCES tags(id),
    caller_id UUID REFERENCES users(id),
    receiver_id UUID REFERENCES users(id),
    call_type TEXT,  -- voice, video
    status TEXT,  -- initiated, answered, missed, rejected, ended
    duration_seconds INTEGER DEFAULT 0,
    caller_ip TEXT,
    receiver_ip TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_call_logs_tag_id ON call_logs(tag_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_caller_id ON call_logs(caller_id);

-- =============================================
-- LOGIN ATTEMPTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT,
    user_id UUID REFERENCES users(id),
    device_id TEXT,
    device_verified BOOLEAN,
    attempt_type TEXT,  -- check, success, wrong_pin
    is_new_device BOOLEAN,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_phone ON login_attempts(phone);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at DESC);

-- =============================================
-- FAILED LOGIN ATTEMPTS TABLE (IP Ban)
-- =============================================
CREATE TABLE IF NOT EXISTS failed_login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip_address TEXT UNIQUE,
    phone TEXT,
    attempt_count INTEGER DEFAULT 0,
    is_banned BOOLEAN DEFAULT FALSE,
    banned_at TIMESTAMPTZ,
    last_attempt TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failed_login_ip ON failed_login_attempts(ip_address);

-- =============================================
-- DISMISSED REQUESTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS dismissed_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    dismissed_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE(user_id, tag_id)
);

-- =============================================
-- DISMISSED OFFERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS dismissed_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    offer_id UUID REFERENCES offers(id) ON DELETE CASCADE,
    dismissed_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE(user_id, offer_id)
);

-- =============================================
-- TRIP END REQUESTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS trip_end_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    requester_id UUID REFERENCES users(id),
    requester_type TEXT,  -- driver, passenger
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- REPORTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES users(id),
    reported_user_id UUID REFERENCES users(id),
    tag_id UUID REFERENCES tags(id),
    reason TEXT,
    details TEXT,
    status TEXT DEFAULT 'pending',  -- pending, reviewed, resolved
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- =============================================
-- REALTIME LOCATIONS TABLE (for live tracking)
-- =============================================
CREATE TABLE IF NOT EXISTS realtime_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    heading DECIMAL(5, 2),
    speed DECIMAL(6, 2),
    trip_id UUID,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_realtime_locations_user_id ON realtime_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_realtime_locations_trip_id ON realtime_locations(trip_id);

-- Enable realtime for specific tables
ALTER PUBLICATION supabase_realtime ADD TABLE realtime_locations;

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Public read policies (for now, can be restricted later)
CREATE POLICY "Users are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Tags are viewable by everyone" ON tags FOR SELECT USING (true);
CREATE POLICY "Offers are viewable by everyone" ON offers FOR SELECT USING (true);
CREATE POLICY "Notifications are viewable by everyone" ON notifications FOR SELECT USING (true);

-- Service role has full access
CREATE POLICY "Service role has full access to users" ON users FOR ALL USING (true);
CREATE POLICY "Service role has full access to tags" ON tags FOR ALL USING (true);
CREATE POLICY "Service role has full access to offers" ON offers FOR ALL USING (true);
CREATE POLICY "Service role has full access to blocked_users" ON blocked_users FOR ALL USING (true);
CREATE POLICY "Service role has full access to notifications" ON notifications FOR ALL USING (true);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- STORAGE BUCKETS (run separately in Supabase dashboard)
-- =============================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('vehicle-photos', 'vehicle-photos', true);
