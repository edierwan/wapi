BEGIN;

INSERT INTO modules (code, name, description, sort_order)
VALUES
  ('whatsapp', 'WhatsApp', 'Connect and manage WhatsApp accounts for this workspace.', 10),
  ('contacts', 'Contacts', 'Store contacts, inbox context, and audience data.', 20),
  ('products', 'Products', 'Maintain the product catalog used by AI and campaigns.', 30),
  ('services', 'Services', 'Maintain service offerings, appointments, and service packages.', 40),
  ('brain', 'Business Brain', 'Store business memory, FAQs, policies, and grounding notes.', 50),
  ('campaigns', 'Campaigns', 'Create, review, and schedule AI-assisted outbound campaigns.', 60),
  ('ai_assistant', 'AI Assistant', 'Draft grounded replies and campaign copy with tenant context.', 70),
  ('analytics', 'Analytics', 'Operational reporting and conversion insights.', 80)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      sort_order = EXCLUDED.sort_order,
      updated_at = now();

WITH preset(industry_code, module_code, enabled, sort_order) AS (
  VALUES
    ('clinic_healthcare', 'whatsapp', true, 10),
    ('clinic_healthcare', 'contacts', true, 20),
    ('clinic_healthcare', 'services', true, 30),
    ('clinic_healthcare', 'brain', true, 40),
    ('clinic_healthcare', 'campaigns', true, 50),
    ('clinic_healthcare', 'ai_assistant', true, 60),

    ('beauty_salon', 'whatsapp', true, 10),
    ('beauty_salon', 'contacts', true, 20),
    ('beauty_salon', 'services', true, 30),
    ('beauty_salon', 'products', true, 40),
    ('beauty_salon', 'brain', true, 50),
    ('beauty_salon', 'campaigns', true, 60),
    ('beauty_salon', 'ai_assistant', true, 70),

    ('dental_clinic', 'whatsapp', true, 10),
    ('dental_clinic', 'contacts', true, 20),
    ('dental_clinic', 'services', true, 30),
    ('dental_clinic', 'brain', true, 40),
    ('dental_clinic', 'campaigns', true, 50),
    ('dental_clinic', 'ai_assistant', true, 60),

    ('restaurant_cafe', 'whatsapp', true, 10),
    ('restaurant_cafe', 'contacts', true, 20),
    ('restaurant_cafe', 'products', true, 30),
    ('restaurant_cafe', 'brain', true, 40),
    ('restaurant_cafe', 'campaigns', true, 50),
    ('restaurant_cafe', 'ai_assistant', true, 60),

    ('retail_shop', 'whatsapp', true, 10),
    ('retail_shop', 'contacts', true, 20),
    ('retail_shop', 'products', true, 30),
    ('retail_shop', 'brain', true, 40),
    ('retail_shop', 'campaigns', true, 50),
    ('retail_shop', 'ai_assistant', true, 60),

    ('ecommerce', 'whatsapp', true, 10),
    ('ecommerce', 'contacts', true, 20),
    ('ecommerce', 'products', true, 30),
    ('ecommerce', 'brain', true, 40),
    ('ecommerce', 'campaigns', true, 50),
    ('ecommerce', 'ai_assistant', true, 60),

    ('car_dealer', 'whatsapp', true, 10),
    ('car_dealer', 'contacts', true, 20),
    ('car_dealer', 'products', true, 30),
    ('car_dealer', 'brain', true, 40),
    ('car_dealer', 'campaigns', true, 50),
    ('car_dealer', 'ai_assistant', true, 60),

    ('property_real_estate', 'whatsapp', true, 10),
    ('property_real_estate', 'contacts', true, 20),
    ('property_real_estate', 'brain', true, 30),
    ('property_real_estate', 'campaigns', true, 40),
    ('property_real_estate', 'ai_assistant', true, 50),

    ('education_training', 'whatsapp', true, 10),
    ('education_training', 'contacts', true, 20),
    ('education_training', 'services', true, 30),
    ('education_training', 'brain', true, 40),
    ('education_training', 'campaigns', true, 50),
    ('education_training', 'ai_assistant', true, 60),

    ('service_contractor', 'whatsapp', true, 10),
    ('service_contractor', 'contacts', true, 20),
    ('service_contractor', 'services', true, 30),
    ('service_contractor', 'brain', true, 40),
    ('service_contractor', 'campaigns', true, 50),
    ('service_contractor', 'ai_assistant', true, 60),

    ('repair_workshop', 'whatsapp', true, 10),
    ('repair_workshop', 'contacts', true, 20),
    ('repair_workshop', 'products', true, 30),
    ('repair_workshop', 'services', true, 40),
    ('repair_workshop', 'brain', true, 50),
    ('repair_workshop', 'campaigns', true, 60),
    ('repair_workshop', 'ai_assistant', true, 70),

    ('fitness_wellness', 'whatsapp', true, 10),
    ('fitness_wellness', 'contacts', true, 20),
    ('fitness_wellness', 'services', true, 30),
    ('fitness_wellness', 'brain', true, 40),
    ('fitness_wellness', 'campaigns', true, 50),
    ('fitness_wellness', 'ai_assistant', true, 60),

    ('travel_tourism', 'whatsapp', true, 10),
    ('travel_tourism', 'contacts', true, 20),
    ('travel_tourism', 'services', true, 30),
    ('travel_tourism', 'brain', true, 40),
    ('travel_tourism', 'campaigns', true, 50),
    ('travel_tourism', 'ai_assistant', true, 60),

    ('insurance', 'whatsapp', true, 10),
    ('insurance', 'contacts', true, 20),
    ('insurance', 'brain', true, 30),
    ('insurance', 'campaigns', true, 40),
    ('insurance', 'ai_assistant', true, 50),

    ('financial_services', 'whatsapp', true, 10),
    ('financial_services', 'contacts', true, 20),
    ('financial_services', 'services', true, 30),
    ('financial_services', 'brain', true, 40),
    ('financial_services', 'campaigns', true, 50),
    ('financial_services', 'ai_assistant', true, 60),

    ('legal_professional', 'whatsapp', true, 10),
    ('legal_professional', 'contacts', true, 20),
    ('legal_professional', 'services', true, 30),
    ('legal_professional', 'brain', true, 40),
    ('legal_professional', 'campaigns', true, 50),
    ('legal_professional', 'ai_assistant', true, 60),

    ('event_venue', 'whatsapp', true, 10),
    ('event_venue', 'contacts', true, 20),
    ('event_venue', 'services', true, 30),
    ('event_venue', 'brain', true, 40),
    ('event_venue', 'campaigns', true, 50),
    ('event_venue', 'ai_assistant', true, 60),

    ('other', 'whatsapp', true, 10),
    ('other', 'contacts', true, 20),
    ('other', 'brain', true, 30),
    ('other', 'campaigns', true, 40),
    ('other', 'ai_assistant', true, 50)
)
INSERT INTO industry_module_presets (industry_id, module_id, enabled, sort_order)
SELECT i.id, m.id, preset.enabled, preset.sort_order
FROM preset
INNER JOIN ref_industries i ON i.code = preset.industry_code
INNER JOIN modules m ON m.code = preset.module_code
ON CONFLICT (industry_id, module_id) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      sort_order = EXCLUDED.sort_order,
      updated_at = now();

COMMIT;