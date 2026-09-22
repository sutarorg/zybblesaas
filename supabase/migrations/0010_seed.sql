-- ============================================================================
-- Zybble · 0010 · seed data: plans, geo centroids, operational defaults
--
-- Razorpay plan ids are NOT seeded here (they are environment-specific): set
-- them through the deployment configuration, see DEPLOYMENT.md §2 (Razorpay).
-- ============================================================================

insert into public.plans (
  code, name, description, price_minor, currency, billing_interval, billing_interval_count, trial_days,
  is_public, is_active, sort_order,
  leads_per_period, ai_runs_per_period, seats, concurrent_searches, max_search_depth, max_radius_km,
  queue_priority, ai_enabled, api_access, grid_coverage, priority_queue, export_formats, export_retention_days,
  features
) values
(
  'starter', 'Starter', 'Test the water. Free forever, no card required.',
  0, 'USD', 'month', 1, 0,
  true, true, 10,
  50, 0, 1, 1, 8, 10,
  10, false, false, false, false, array['csv'], 30,
  jsonb_build_array(
    jsonb_build_object('label', '50 enriched leads / mo', 'included', true),
    jsonb_build_object('label', 'Email & phone included', 'included', true),
    jsonb_build_object('label', 'CSV export', 'included', true),
    jsonb_build_object('label', 'Unlimited lead lists', 'included', true),
    jsonb_build_object('label', 'AI Assistant', 'included', false),
    jsonb_build_object('label', 'Priority extraction queue', 'included', false)
  )
),
(
  'growth', 'Growth', 'For closers who prospect weekly, not someday.',
  4900, 'USD', 'month', 1, 14,
  true, true, 20,
  10000, 300, 3, 2, 12, 25,
  60, true, true, true, false, array['csv', 'json'], 30,
  jsonb_build_array(
    jsonb_build_object('label', '10,000 enriched leads / mo', 'included', true),
    jsonb_build_object('label', 'Email & phone included', 'included', true),
    jsonb_build_object('label', 'CSV & JSON export', 'included', true),
    jsonb_build_object('label', 'Unlimited lead lists', 'included', true),
    jsonb_build_object('label', 'AI Assistant', 'included', true),
    jsonb_build_object('label', 'Priority extraction queue', 'included', false)
  )
),
(
  'scale', 'Scale', 'Whole territories, whole verticals, in one sitting.',
  9900, 'USD', 'month', 1, 14,
  true, true, 30,
  50000, 2000, 10, 4, 16, 50,
  90, true, true, true, true, array['csv', 'json'], 30,
  jsonb_build_array(
    jsonb_build_object('label', '50,000 enriched leads / mo', 'included', true),
    jsonb_build_object('label', 'Email & phone included', 'included', true),
    jsonb_build_object('label', 'CSV & JSON export', 'included', true),
    jsonb_build_object('label', 'Unlimited lead lists', 'included', true),
    jsonb_build_object('label', 'AI Assistant', 'included', true),
    jsonb_build_object('label', 'Priority extraction queue', 'included', true)
  )
)
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      price_minor = excluded.price_minor,
      currency = excluded.currency,
      trial_days = excluded.trial_days,
      leads_per_period = excluded.leads_per_period,
      ai_runs_per_period = excluded.ai_runs_per_period,
      seats = excluded.seats,
      concurrent_searches = excluded.concurrent_searches,
      max_search_depth = excluded.max_search_depth,
      max_radius_km = excluded.max_radius_km,
      queue_priority = excluded.queue_priority,
      ai_enabled = excluded.ai_enabled,
      api_access = excluded.api_access,
      grid_coverage = excluded.grid_coverage,
      priority_queue = excluded.priority_queue,
      export_formats = excluded.export_formats,
      export_retention_days = excluded.export_retention_days,
      features = excluded.features,
      is_public = excluded.is_public,
      is_active = excluded.is_active;

-- ---------------------------------------------------------------------------
-- geo_places — curated centroids for radius / grid / fast-mode planning.
-- Public geographic data (city names + centroids). Deliberately not the
-- Google Geocoding API (task §26). Operators can extend this table.
-- ---------------------------------------------------------------------------
insert into public.geo_places (name, name_norm, country_code, admin_area, latitude, longitude, timezone, population, source)
values
  ('Berlin', 'berlin', 'DE', null, 52.5200, 13.4050, 'Europe/Berlin', 3645000, 'seed'),
  ('Berlin Mitte', 'berlin mitte', 'DE', 'Berlin', 52.5259, 13.4053, 'Europe/Berlin', 385000, 'seed'),
  ('Berlin Kreuzberg', 'berlin kreuzberg', 'DE', 'Berlin', 52.4977, 13.4173, 'Europe/Berlin', 154000, 'seed'),
  ('Berlin Charlottenburg', 'berlin charlottenburg', 'DE', 'Berlin', 52.5126, 13.3040, 'Europe/Berlin', 129000, 'seed'),
  ('Berlin Prenzlauer Berg', 'berlin prenzlauer berg', 'DE', 'Berlin', 52.5410, 13.4240, 'Europe/Berlin', 165000, 'seed'),
  ('Munich', 'munich', 'DE', 'Bavaria', 48.1351, 11.5820, 'Europe/Berlin', 1488000, 'seed'),
  ('Hamburg', 'hamburg', 'DE', 'Hamburg', 53.5511, 9.9937, 'Europe/Berlin', 1853000, 'seed'),
  ('Frankfurt', 'frankfurt', 'DE', 'Hesse', 50.1109, 8.6821, 'Europe/Berlin', 753000, 'seed'),
  ('Vienna', 'vienna', 'AT', 'Vienna', 48.2082, 16.3738, 'Europe/Vienna', 1901000, 'seed'),
  ('Zurich', 'zurich', 'CH', 'Zurich', 47.3769, 8.5417, 'Europe/Zurich', 421000, 'seed'),
  ('Amsterdam', 'amsterdam', 'NL', 'North Holland', 52.3676, 4.9041, 'Europe/Amsterdam', 883000, 'seed'),
  ('Rotterdam', 'rotterdam', 'NL', 'South Holland', 51.9244, 4.4777, 'Europe/Amsterdam', 651000, 'seed'),
  ('Paris', 'paris', 'FR', 'Ile-de-France', 48.8566, 2.3522, 'Europe/Paris', 2148000, 'seed'),
  ('Lyon', 'lyon', 'FR', 'Auvergne-Rhone-Alpes', 45.7640, 4.8357, 'Europe/Paris', 522000, 'seed'),
  ('Marseille', 'marseille', 'FR', 'Provence', 43.2965, 5.3698, 'Europe/Paris', 870000, 'seed'),
  ('Madrid', 'madrid', 'ES', 'Madrid', 40.4168, -3.7038, 'Europe/Madrid', 3223000, 'seed'),
  ('Barcelona', 'barcelona', 'ES', 'Catalonia', 41.3874, 2.1686, 'Europe/Madrid', 1620000, 'seed'),
  ('Lisbon', 'lisbon', 'PT', 'Lisbon', 38.7223, -9.1393, 'Europe/Lisbon', 545000, 'seed'),
  ('Porto', 'porto', 'PT', 'Porto', 41.1579, -8.6291, 'Europe/Lisbon', 231000, 'seed'),
  ('Rome', 'rome', 'IT', 'Lazio', 41.9028, 12.4964, 'Europe/Rome', 2873000, 'seed'),
  ('Milan', 'milan', 'IT', 'Lombardy', 45.4642, 9.1900, 'Europe/Rome', 1352000, 'seed'),
  ('London', 'london', 'GB', 'England', 51.5074, -0.1278, 'Europe/London', 8982000, 'seed'),
  ('Manchester', 'manchester', 'GB', 'England', 53.4808, -2.2426, 'Europe/London', 553000, 'seed'),
  ('Birmingham', 'birmingham', 'GB', 'England', 52.4862, -1.8904, 'Europe/London', 1141000, 'seed'),
  ('Leeds', 'leeds', 'GB', 'England', 53.8008, -1.5491, 'Europe/London', 793000, 'seed'),
  ('Glasgow', 'glasgow', 'GB', 'Scotland', 55.8642, -4.2518, 'Europe/London', 635000, 'seed'),
  ('Dublin', 'dublin', 'IE', 'Leinster', 53.3498, -6.2603, 'Europe/Dublin', 554000, 'seed'),
  ('Copenhagen', 'copenhagen', 'DK', 'Capital Region', 55.6761, 12.5683, 'Europe/Copenhagen', 644000, 'seed'),
  ('Stockholm', 'stockholm', 'SE', 'Stockholm', 59.3293, 18.0686, 'Europe/Stockholm', 975000, 'seed'),
  ('Oslo', 'oslo', 'NO', 'Oslo', 59.9139, 10.7522, 'Europe/Oslo', 709000, 'seed'),
  ('Warsaw', 'warsaw', 'PL', 'Masovia', 52.2297, 21.0122, 'Europe/Warsaw', 1793000, 'seed'),
  ('Prague', 'prague', 'CZ', 'Prague', 50.0755, 14.4378, 'Europe/Prague', 1309000, 'seed'),
  ('Budapest', 'budapest', 'HU', 'Budapest', 47.4979, 19.0402, 'Europe/Budapest', 1752000, 'seed'),
  ('Athens', 'athens', 'GR', 'Attica', 37.9838, 23.7275, 'Europe/Athens', 664000, 'seed'),
  ('Istanbul', 'istanbul', 'TR', 'Istanbul', 41.0082, 28.9784, 'Europe/Istanbul', 15460000, 'seed'),
  ('Pune', 'pune', 'IN', 'Maharashtra', 18.5204, 73.8567, 'Asia/Kolkata', 6629000, 'seed'),
  ('Mumbai', 'mumbai', 'IN', 'Maharashtra', 19.0760, 72.8777, 'Asia/Kolkata', 20411000, 'seed'),
  ('Delhi', 'delhi', 'IN', 'Delhi', 28.7041, 77.1025, 'Asia/Kolkata', 32941000, 'seed'),
  ('Bengaluru', 'bengaluru', 'IN', 'Karnataka', 12.9716, 77.5946, 'Asia/Kolkata', 13193000, 'seed'),
  ('Hyderabad', 'hyderabad', 'IN', 'Telangana', 17.3850, 78.4867, 'Asia/Kolkata', 10269000, 'seed'),
  ('Chennai', 'chennai', 'IN', 'Tamil Nadu', 13.0827, 80.2707, 'Asia/Kolkata', 11503000, 'seed'),
  ('Dubai', 'dubai', 'AE', 'Dubai', 25.2048, 55.2708, 'Asia/Dubai', 3607000, 'seed'),
  ('Singapore', 'singapore', 'SG', null, 1.3521, 103.8198, 'Asia/Singapore', 5686000, 'seed'),
  ('Jakarta', 'jakarta', 'ID', 'Jakarta', -6.2088, 106.8456, 'Asia/Jakarta', 10562000, 'seed'),
  ('Manila', 'manila', 'PH', 'Metro Manila', 14.5995, 120.9842, 'Asia/Manila', 13482000, 'seed'),
  ('Bangkok', 'bangkok', 'TH', 'Bangkok', 13.7563, 100.5018, 'Asia/Bangkok', 10539000, 'seed'),
  ('Hong Kong', 'hong kong', 'HK', null, 22.3193, 114.1694, 'Asia/Hong_Kong', 7482000, 'seed'),
  ('Tokyo', 'tokyo', 'JP', 'Tokyo', 35.6762, 139.6503, 'Asia/Tokyo', 13960000, 'seed'),
  ('Seoul', 'seoul', 'KR', 'Seoul', 37.5665, 126.9780, 'Asia/Seoul', 9776000, 'seed'),
  ('Shanghai', 'shanghai', 'CN', 'Shanghai', 31.2304, 121.4737, 'Asia/Shanghai', 24870000, 'seed'),
  ('Sydney', 'sydney', 'AU', 'New South Wales', -33.8688, 151.2093, 'Australia/Sydney', 5312000, 'seed'),
  ('Melbourne', 'melbourne', 'AU', 'Victoria', -37.8136, 144.9631, 'Australia/Melbourne', 5078000, 'seed'),
  ('Brisbane', 'brisbane', 'AU', 'Queensland', -27.4698, 153.0251, 'Australia/Brisbane', 2560000, 'seed'),
  ('Auckland', 'auckland', 'NZ', 'Auckland', -36.8485, 174.7633, 'Pacific/Auckland', 1657000, 'seed'),
  ('New York', 'new york', 'US', 'New York', 40.7128, -74.0060, 'America/New_York', 8336000, 'seed'),
  ('Brooklyn', 'brooklyn', 'US', 'New York', 40.6782, -73.9442, 'America/New_York', 2736000, 'seed'),
  ('Los Angeles', 'los angeles', 'US', 'California', 34.0522, -118.2437, 'America/Los_Angeles', 3898000, 'seed'),
  ('San Francisco', 'san francisco', 'US', 'California', 37.7749, -122.4194, 'America/Los_Angeles', 873000, 'seed'),
  ('San Diego', 'san diego', 'US', 'California', 32.7157, -117.1611, 'America/Los_Angeles', 1424000, 'seed'),
  ('San Jose', 'san jose', 'US', 'California', 37.3382, -121.8863, 'America/Los_Angeles', 1013000, 'seed'),
  ('Sacramento', 'sacramento', 'US', 'California', 38.5816, -121.4944, 'America/Los_Angeles', 524000, 'seed'),
  ('Seattle', 'seattle', 'US', 'Washington', 47.6062, -122.3321, 'America/Los_Angeles', 749000, 'seed'),
  ('Portland', 'portland', 'US', 'Oregon', 45.5152, -122.6784, 'America/Los_Angeles', 652000, 'seed'),
  ('Denver', 'denver', 'US', 'Colorado', 39.7392, -104.9903, 'America/Denver', 727000, 'seed'),
  ('Phoenix', 'phoenix', 'US', 'Arizona', 33.4484, -112.0740, 'America/Phoenix', 1680000, 'seed'),
  ('Austin', 'austin', 'US', 'Texas', 30.2672, -97.7431, 'America/Chicago', 979000, 'seed'),
  ('Dallas', 'dallas', 'US', 'Texas', 32.7767, -96.7970, 'America/Chicago', 1343000, 'seed'),
  ('Houston', 'houston', 'US', 'Texas', 29.7604, -95.3698, 'America/Chicago', 2320000, 'seed'),
  ('San Antonio', 'san antonio', 'US', 'Texas', 29.4241, -98.4936, 'America/Chicago', 1547000, 'seed'),
  ('Chicago', 'chicago', 'US', 'Illinois', 41.8781, -87.6298, 'America/Chicago', 2706000, 'seed'),
  ('Minneapolis', 'minneapolis', 'US', 'Minnesota', 44.9778, -93.2650, 'America/Chicago', 429000, 'seed'),
  ('Atlanta', 'atlanta', 'US', 'Georgia', 33.7490, -84.3880, 'America/New_York', 498000, 'seed'),
  ('Miami', 'miami', 'US', 'Florida', 25.7617, -80.1918, 'America/New_York', 442000, 'seed'),
  ('Tampa', 'tampa', 'US', 'Florida', 27.9506, -82.4572, 'America/New_York', 399000, 'seed'),
  ('Orlando', 'orlando', 'US', 'Florida', 28.5383, -81.3792, 'America/New_York', 307000, 'seed'),
  ('Boston', 'boston', 'US', 'Massachusetts', 42.3601, -71.0589, 'America/New_York', 692000, 'seed'),
  ('Philadelphia', 'philadelphia', 'US', 'Pennsylvania', 39.9526, -75.1652, 'America/New_York', 1584000, 'seed'),
  ('Washington', 'washington', 'US', 'District of Columbia', 38.9072, -77.0369, 'America/New_York', 705000, 'seed'),
  ('Nashville', 'nashville', 'US', 'Tennessee', 36.1627, -86.7816, 'America/Chicago', 692000, 'seed'),
  ('Detroit', 'detroit', 'US', 'Michigan', 42.3314, -83.0458, 'America/Detroit', 670000, 'seed'),
  ('Las Vegas', 'las vegas', 'US', 'Nevada', 36.1699, -115.1398, 'America/Los_Angeles', 651000, 'seed'),
  ('Salt Lake City', 'salt lake city', 'US', 'Utah', 40.7608, -111.8910, 'America/Denver', 200000, 'seed'),
  ('Toronto', 'toronto', 'CA', 'Ontario', 43.6532, -79.3832, 'America/Toronto', 2930000, 'seed'),
  ('Vancouver', 'vancouver', 'CA', 'British Columbia', 49.2827, -123.1207, 'America/Vancouver', 675000, 'seed'),
  ('Montreal', 'montreal', 'CA', 'Quebec', 45.5017, -73.5673, 'America/Toronto', 1780000, 'seed'),
  ('Calgary', 'calgary', 'CA', 'Alberta', 51.0447, -114.0719, 'America/Edmonton', 1306000, 'seed'),
  ('Mexico City', 'mexico city', 'MX', 'Mexico City', 19.4326, -99.1332, 'America/Mexico_City', 9209000, 'seed'),
  ('Guadalajara', 'guadalajara', 'MX', 'Jalisco', 20.6597, -103.3496, 'America/Mexico_City', 1495000, 'seed'),
  ('Sao Paulo', 'sao paulo', 'BR', 'Sao Paulo', -23.5505, -46.6333, 'America/Sao_Paulo', 12330000, 'seed'),
  ('Rio de Janeiro', 'rio de janeiro', 'BR', 'Rio de Janeiro', -22.9068, -43.1729, 'America/Sao_Paulo', 6748000, 'seed'),
  ('Buenos Aires', 'buenos aires', 'AR', 'Buenos Aires', -34.6037, -58.3816, 'America/Argentina/Buenos_Aires', 3075000, 'seed'),
  ('Bogota', 'bogota', 'CO', 'Bogota', 4.7110, -74.0721, 'America/Bogota', 7413000, 'seed'),
  ('Santiago', 'santiago', 'CL', 'Santiago', -33.4489, -70.6693, 'America/Santiago', 6150000, 'seed'),
  ('Lima', 'lima', 'PE', 'Lima', -12.0464, -77.0428, 'America/Lima', 9675000, 'seed'),
  ('Cairo', 'cairo', 'EG', 'Cairo', 30.0444, 31.2357, 'Africa/Cairo', 9540000, 'seed'),
  ('Lagos', 'lagos', 'NG', 'Lagos', 6.5244, 3.3792, 'Africa/Lagos', 14860000, 'seed'),
  ('Nairobi', 'nairobi', 'KE', 'Nairobi', -1.2921, 36.8219, 'Africa/Nairobi', 4397000, 'seed'),
  ('Johannesburg', 'johannesburg', 'ZA', 'Gauteng', -26.2041, 28.0473, 'Africa/Johannesburg', 5635000, 'seed'),
  ('Cape Town', 'cape town', 'ZA', 'Western Cape', -33.9249, 18.4241, 'Africa/Johannesburg', 4618000, 'seed'),
  ('Tel Aviv', 'tel aviv', 'IL', 'Tel Aviv', 32.0853, 34.7818, 'Asia/Jerusalem', 460000, 'seed'),
  ('Riyadh', 'riyadh', 'SA', 'Riyadh', 24.7136, 46.6753, 'Asia/Riyadh', 7676000, 'seed')
on conflict (name_norm, country_code) do update
  set name = excluded.name,
      admin_area = excluded.admin_area,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      timezone = excluded.timezone,
      population = excluded.population;

-- ---------------------------------------------------------------------------
-- operational defaults (queue priorities per brief §44, tunable at runtime)
-- ---------------------------------------------------------------------------
insert into ops.system_settings (key, value, description) values
  ('job_priorities', jsonb_build_object(
      'scrape', 100,
      'email_enrichment', 90,
      'ai_search_plan', 70,
      'ai_lead_analysis', 70,
      'ai_lead_scoring', 65,
      'ai_list_analysis', 60,
      'export', 50,
      'ai_chat', 40,
      'notification', 20,
      'cleanup', 10
    ), 'Base priority per job type (higher runs first). Plan bonus is added for scrape/enrichment/ai.'),
  ('queue', jsonb_build_object(
      'lease_seconds', 300,
      'heartbeat_seconds', 30,
      'max_attempts', 3,
      'poll_interval_ms', 1000,
      'idle_backoff_max_ms', 15000
    ), 'Queue timing defaults (worker env overrides).'),
  ('scraper', jsonb_build_object(
      'concurrency', 4,
      'browser_pool_size', 2,
      'pages_per_browser', 2,
      'progress_write_interval_seconds', 5,
      'lead_flush_batch', 5,
      'lead_flush_interval_ms', 1500
    ), 'Conservative browser resource defaults; tune after load testing (task §60).'),
  ('lead_accounting', jsonb_build_object(
      'accrual_rule', 'first_association_with_contact_channel',
      'overage_policy', 'never_discard; cap search allowance and notify'
    ), 'Documented lead/billing accounting rule (see README §usage).')
on conflict (key) do update set value = excluded.value, description = excluded.description;
