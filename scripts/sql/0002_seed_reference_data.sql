-- ----------------------------------------------------------------------------
-- Phase 5 · Reference / master-data seed (idempotent)
--
-- Seeds:
--   ref_currencies, ref_languages, ref_countries, ref_timezones,
--   ref_industries, ref_business_natures, ref_brand_voices.
--
-- Re-runnable: insert if missing, update label/description if code exists.
-- Safe to apply on wapi (prod) and wapi.dev (dev).
-- ----------------------------------------------------------------------------

BEGIN;

-- ── currencies ─────────────────────────────────────────────────────────────
INSERT INTO ref_currencies (code, name, symbol, decimal_places, sort_order) VALUES
  ('MYR', 'Malaysian Ringgit', 'RM',  2, 10),
  ('SGD', 'Singapore Dollar',  'S$',  2, 20),
  ('IDR', 'Indonesian Rupiah', 'Rp',  0, 30),
  ('THB', 'Thai Baht',         '฿',   2, 40),
  ('BND', 'Brunei Dollar',     'B$',  2, 50),
  ('USD', 'US Dollar',         '$',   2, 60),
  ('EUR', 'Euro',              '€',   2, 70),
  ('GBP', 'British Pound',     '£',   2, 80),
  ('AUD', 'Australian Dollar', 'A$',  2, 90),
  ('PHP', 'Philippine Peso',   '₱',   2, 100),
  ('VND', 'Vietnamese Dong',   '₫',   0, 110),
  ('INR', 'Indian Rupee',      '₹',   2, 120),
  ('CNY', 'Chinese Yuan',      '¥',   2, 130),
  ('HKD', 'Hong Kong Dollar',  'HK$', 2, 140),
  ('JPY', 'Japanese Yen',      '¥',   0, 150)
ON CONFLICT (code) DO UPDATE
  SET name           = EXCLUDED.name,
      symbol         = EXCLUDED.symbol,
      decimal_places = EXCLUDED.decimal_places,
      sort_order     = EXCLUDED.sort_order,
      updated_at     = now();

-- ── languages ──────────────────────────────────────────────────────────────
INSERT INTO ref_languages (code, name, native_name, sort_order) VALUES
  ('en', 'English',     'English',      10),
  ('ms', 'Malay',       'Bahasa Melayu', 20),
  ('id', 'Indonesian',  'Bahasa Indonesia', 30),
  ('zh', 'Chinese',     '中文',           40),
  ('ta', 'Tamil',       'தமிழ்',         50),
  ('th', 'Thai',        'ไทย',            60),
  ('vi', 'Vietnamese',  'Tiếng Việt',    70),
  ('tl', 'Filipino',    'Filipino',      80),
  ('ja', 'Japanese',    '日本語',         90),
  ('ko', 'Korean',      '한국어',         100)
ON CONFLICT (code) DO UPDATE
  SET name        = EXCLUDED.name,
      native_name = EXCLUDED.native_name,
      sort_order  = EXCLUDED.sort_order,
      updated_at  = now();

-- ── countries ──────────────────────────────────────────────────────────────
INSERT INTO ref_countries (
  iso2_code, iso3_code, name, phone_country_code,
  default_currency_code, default_language_code, default_timezone, sort_order
) VALUES
  ('MY', 'MYS', 'Malaysia',     '+60',  'MYR', 'en', 'Asia/Kuala_Lumpur',   10),
  ('SG', 'SGP', 'Singapore',    '+65',  'SGD', 'en', 'Asia/Singapore',      20),
  ('ID', 'IDN', 'Indonesia',    '+62',  'IDR', 'id', 'Asia/Jakarta',        30),
  ('TH', 'THA', 'Thailand',     '+66',  'THB', 'th', 'Asia/Bangkok',        40),
  ('BN', 'BRN', 'Brunei',       '+673', 'BND', 'en', 'Asia/Brunei',         50),
  ('PH', 'PHL', 'Philippines',  '+63',  'PHP', 'tl', 'Asia/Manila',         60),
  ('VN', 'VNM', 'Vietnam',      '+84',  'VND', 'vi', 'Asia/Ho_Chi_Minh',    70),
  ('AU', 'AUS', 'Australia',    '+61',  'AUD', 'en', 'Australia/Sydney',    80),
  ('US', 'USA', 'United States','+1',   'USD', 'en', 'America/New_York',    90),
  ('GB', 'GBR', 'United Kingdom','+44', 'GBP', 'en', 'Europe/London',      100),
  ('IN', 'IND', 'India',        '+91',  'INR', 'en', 'Asia/Kolkata',       110),
  ('CN', 'CHN', 'China',        '+86',  'CNY', 'zh', 'Asia/Shanghai',      120),
  ('HK', 'HKG', 'Hong Kong',    '+852', 'HKD', 'zh', 'Asia/Hong_Kong',     130),
  ('JP', 'JPN', 'Japan',        '+81',  'JPY', 'ja', 'Asia/Tokyo',         140)
ON CONFLICT (iso2_code) DO UPDATE
  SET iso3_code              = EXCLUDED.iso3_code,
      name                   = EXCLUDED.name,
      phone_country_code     = EXCLUDED.phone_country_code,
      default_currency_code  = EXCLUDED.default_currency_code,
      default_language_code  = EXCLUDED.default_language_code,
      default_timezone       = EXCLUDED.default_timezone,
      sort_order             = EXCLUDED.sort_order,
      updated_at             = now();

-- ── timezones ──────────────────────────────────────────────────────────────
INSERT INTO ref_timezones (name, label, utc_offset, country_id, sort_order)
SELECT t.name, t.label, t.utc_offset, c.id, t.sort_order
FROM (VALUES
  ('Asia/Kuala_Lumpur',  'Kuala Lumpur (UTC+08:00)',   '+08:00', 'MY', 10),
  ('Asia/Singapore',     'Singapore (UTC+08:00)',      '+08:00', 'SG', 20),
  ('Asia/Jakarta',       'Jakarta (UTC+07:00)',        '+07:00', 'ID', 30),
  ('Asia/Bangkok',       'Bangkok (UTC+07:00)',        '+07:00', 'TH', 40),
  ('Asia/Brunei',        'Brunei (UTC+08:00)',         '+08:00', 'BN', 50),
  ('Asia/Manila',        'Manila (UTC+08:00)',         '+08:00', 'PH', 60),
  ('Asia/Ho_Chi_Minh',   'Ho Chi Minh (UTC+07:00)',    '+07:00', 'VN', 70),
  ('Australia/Sydney',   'Sydney (UTC+10:00)',         '+10:00', 'AU', 80),
  ('America/New_York',   'New York (UTC-05:00)',       '-05:00', 'US', 90),
  ('Europe/London',      'London (UTC+00:00)',         '+00:00', 'GB', 100),
  ('Asia/Kolkata',       'Kolkata (UTC+05:30)',        '+05:30', 'IN', 110),
  ('Asia/Shanghai',      'Shanghai (UTC+08:00)',       '+08:00', 'CN', 120),
  ('Asia/Hong_Kong',     'Hong Kong (UTC+08:00)',      '+08:00', 'HK', 130),
  ('Asia/Tokyo',         'Tokyo (UTC+09:00)',          '+09:00', 'JP', 140),
  ('UTC',                'UTC (UTC+00:00)',            '+00:00', NULL, 1000)
) AS t(name, label, utc_offset, iso2, sort_order)
LEFT JOIN ref_countries c ON c.iso2_code = t.iso2
ON CONFLICT (name) DO UPDATE
  SET label      = EXCLUDED.label,
      utc_offset = EXCLUDED.utc_offset,
      country_id = EXCLUDED.country_id,
      sort_order = EXCLUDED.sort_order,
      updated_at = now();

-- ── industries ─────────────────────────────────────────────────────────────
INSERT INTO ref_industries (code, name, description, sort_order) VALUES
  ('clinic_healthcare',     'Healthcare / Clinic',         'Clinics, GP, specialists, hospitals.', 10),
  ('beauty_salon',          'Beauty / Salon',              'Hair, nails, lashes, beauty services.', 20),
  ('dental_clinic',         'Dental Clinic',               'Dental practices and orthodontics.',  30),
  ('restaurant_cafe',       'Restaurant / Cafe',           'Restaurants, cafes, food courts.',     40),
  ('retail_shop',           'Retail Shop',                 'Brick & mortar retail.',              50),
  ('ecommerce',             'E-commerce',                  'Online stores, marketplaces.',         60),
  ('car_dealer',            'Car Dealer',                  'New & used car dealers.',             70),
  ('property_real_estate',  'Property / Real Estate',      'Agents, developers, rentals.',         80),
  ('education_training',    'Education / Training',        'Schools, tuition, online courses.',    90),
  ('service_contractor',    'Service Contractor',          'Plumbing, electrical, AC, cleaning.', 100),
  ('repair_workshop',       'Repair Workshop',             'Car / motorbike / electronics repair.',110),
  ('fitness_wellness',      'Fitness / Wellness',          'Gyms, yoga, wellness studios.',       120),
  ('travel_tourism',        'Travel / Tourism',            'Travel agencies, tours, hotels.',     130),
  ('insurance',             'Insurance',                   'Agents, brokers, claims support.',    140),
  ('financial_services',    'Financial Services',          'Loans, investment, accounting.',      150),
  ('legal_professional',    'Legal / Professional',        'Lawyers, consultants, notaries.',     160),
  ('event_venue',           'Event / Venue',               'Wedding venues, halls, event planners.',170),
  ('other',                 'Other',                       'Doesn''t fit above. Refine later.',   999)
ON CONFLICT (code) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      sort_order  = EXCLUDED.sort_order,
      updated_at  = now();

-- ── business_natures ───────────────────────────────────────────────────────
INSERT INTO ref_business_natures (code, name, description, sort_order) VALUES
  ('product',        'Product-based',         'Sells physical or digital products (retail, F&B, e-commerce).',    10),
  ('service',        'Service-based',         'Sells services by time or package (clinic, salon, training).',     20),
  ('hybrid',         'Hybrid (products + services)', 'Sells both (car workshop, beauty shop with retail).',      30),
  ('booking',        'Booking / appointment', 'Main flow is scheduled appointments (dental, tours, venues).',    40),
  ('lead_generation','Lead generation',       'Captures leads and follows up (property, insurance, education).', 50),
  ('support_helpdesk','Support / helpdesk',   'Primarily supports existing customers over WhatsApp.',            60),
  ('other',          'Other',                 'Doesn''t fit above. Refine later.',                                999)
ON CONFLICT (code) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      sort_order  = EXCLUDED.sort_order,
      updated_at  = now();

-- ── brand_voices ───────────────────────────────────────────────────────────
INSERT INTO ref_brand_voices (code, name, description, prompt_instruction, sort_order) VALUES
  ('friendly_casual', 'Friendly & casual',
    'Warm, conversational, light emoji.',
    'Use a warm, conversational, friendly tone. Use simple sentences. Light, natural emoji is allowed but not in every message. Avoid corporate jargon.',
    10),
  ('professional', 'Professional',
    'Polite, clear, business-appropriate, no emoji unless needed.',
    'Use a polite, clear, professional tone suitable for business communication. Avoid slang. Use emoji sparingly only when it adds clarity.',
    20),
  ('premium_luxury', 'Premium / luxury',
    'Confident, refined, aspirational. No emoji.',
    'Use a confident, refined, aspirational tone consistent with a premium brand. Avoid emoji and slang. Prefer concise, elegant phrasing.',
    30),
  ('short_direct', 'Short & direct',
    'Very short, action-oriented, no fluff.',
    'Keep every message under 2 short sentences. Be direct, action-oriented. No emoji, no fluff. Always end with a clear next step or question.',
    40),
  ('malay_casual', 'Malay casual',
    'Casual Malay, friendly, lokal feel.',
    'Reply in casual Bahasa Malaysia (with light Malaysian English allowed). Keep tone friendly, like talking to a regular customer. Avoid overly formal Malay.',
    50),
  ('malay_english_mix', 'Malay + English mix',
    'Mix Bahasa Malaysia and English (rojak).',
    'Reply in a natural Malay + English mix (rojak Malaysia). Friendly, helpful tone. Use whichever phrasing feels more natural per sentence.',
    60),
  ('formal_corporate', 'Formal corporate',
    'Strict business tone, full sentences, no emoji.',
    'Use formal corporate tone. Full sentences, polite, no emoji or slang. Sign-off should be neutral and professional.',
    70),
  ('soft_selling', 'Soft selling',
    'Helpful first, sells gently after value.',
    'Lead with value: answer the customer''s question or problem first. Only after providing useful info, gently invite next step (book, buy, register). Never pressure.',
    80),
  ('playful_respectful', 'Playful but respectful',
    'Fun, light, but never disrespectful.',
    'Use a light, playful tone with friendly humour. Stay respectful — no sarcasm, no negative jokes about the customer. Emoji allowed, max 1-2 per message.',
    90),
  ('support_focused', 'Support focused',
    'Empathetic, solution-first, calm.',
    'Use an empathetic, solution-first tone. Acknowledge the customer''s issue first, then guide them step by step. Avoid jargon. Stay calm even under complaints.',
    100)
ON CONFLICT (code) DO UPDATE
  SET name               = EXCLUDED.name,
      description        = EXCLUDED.description,
      prompt_instruction = EXCLUDED.prompt_instruction,
      sort_order         = EXCLUDED.sort_order,
      updated_at         = now();

COMMIT;

-- Sanity:
--   SELECT (SELECT count(*) FROM ref_countries)        AS countries,
--          (SELECT count(*) FROM ref_currencies)       AS currencies,
--          (SELECT count(*) FROM ref_languages)        AS languages,
--          (SELECT count(*) FROM ref_timezones)        AS timezones,
--          (SELECT count(*) FROM ref_industries)       AS industries,
--          (SELECT count(*) FROM ref_business_natures) AS natures,
--          (SELECT count(*) FROM ref_brand_voices)     AS voices;
