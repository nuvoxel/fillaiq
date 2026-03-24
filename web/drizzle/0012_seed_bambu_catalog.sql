-- ============================================================
-- Seed: Bambu Lab printer models + accessories
-- ============================================================

-- ── Printers ────────────────────────────────────────────────

-- H2D (Dual-nozzle, enclosed, AMS support)
INSERT INTO hardware_models (
  category, manufacturer, model, slug, description,
  build_volume_x, build_volume_y, build_volume_z,
  max_nozzle_temp, max_bed_temp,
  has_enclosure, has_filament_changer, filament_changer_slots,
  has_wifi, has_mqtt, protocol,
  capabilities, validation_status
) VALUES (
  'fdm_printer', 'Bambu Lab', 'H2D', 'bambu-lab-h2d',
  'Dual-nozzle enclosed FDM printer with AMS support. 350x320x325mm build volume.',
  350, 320, 325,
  300, 120,
  true, true, 16,
  true, true, 'bambu_mqtt',
  '{"dualNozzle": true, "cameraBuiltIn": true, "lidarLeveling": true, "maxAmsUnits": 4}',
  'validated'
) ON CONFLICT (slug) DO NOTHING;

-- X1 Carbon
INSERT INTO hardware_models (
  category, manufacturer, model, slug, description,
  build_volume_x, build_volume_y, build_volume_z,
  max_nozzle_temp, max_bed_temp,
  has_enclosure, has_filament_changer, filament_changer_slots,
  has_wifi, has_mqtt, protocol,
  capabilities, validation_status
) VALUES (
  'fdm_printer', 'Bambu Lab', 'X1 Carbon', 'bambu-lab-x1-carbon',
  'High-speed enclosed CoreXY FDM printer with AMS support. 256x256x256mm build volume.',
  256, 256, 256,
  300, 120,
  true, true, 16,
  true, true, 'bambu_mqtt',
  '{"cameraBuiltIn": true, "lidarLeveling": true, "maxAmsUnits": 4}',
  'validated'
) ON CONFLICT (slug) DO NOTHING;

-- X1E
INSERT INTO hardware_models (
  category, manufacturer, model, slug, description,
  build_volume_x, build_volume_y, build_volume_z,
  max_nozzle_temp, max_bed_temp,
  has_enclosure, has_filament_changer, filament_changer_slots,
  has_wifi, has_mqtt, protocol,
  capabilities, validation_status
) VALUES (
  'fdm_printer', 'Bambu Lab', 'X1E', 'bambu-lab-x1e',
  'Industrial-grade enclosed CoreXY FDM printer with active chamber heating and AMS support.',
  256, 256, 256,
  320, 120,
  true, true, 16,
  true, true, 'bambu_mqtt',
  '{"cameraBuiltIn": true, "lidarLeveling": true, "activeChamberHeating": true, "maxAmsUnits": 4}',
  'validated'
) ON CONFLICT (slug) DO NOTHING;

-- P1S
INSERT INTO hardware_models (
  category, manufacturer, model, slug, description,
  build_volume_x, build_volume_y, build_volume_z,
  max_nozzle_temp, max_bed_temp,
  has_enclosure, has_filament_changer, filament_changer_slots,
  has_wifi, has_mqtt, protocol,
  capabilities, validation_status
) VALUES (
  'fdm_printer', 'Bambu Lab', 'P1S', 'bambu-lab-p1s',
  'Enclosed CoreXY FDM printer with AMS support. 256x256x256mm build volume.',
  256, 256, 256,
  300, 100,
  true, true, 16,
  true, true, 'bambu_mqtt',
  '{"cameraBuiltIn": true, "maxAmsUnits": 4}',
  'validated'
) ON CONFLICT (slug) DO NOTHING;

-- P1P
INSERT INTO hardware_models (
  category, manufacturer, model, slug, description,
  build_volume_x, build_volume_y, build_volume_z,
  max_nozzle_temp, max_bed_temp,
  has_enclosure, has_filament_changer, filament_changer_slots,
  has_wifi, has_mqtt, protocol,
  capabilities, validation_status
) VALUES (
  'fdm_printer', 'Bambu Lab', 'P1P', 'bambu-lab-p1p',
  'Open-frame CoreXY FDM printer with optional AMS support. 256x256x256mm build volume.',
  256, 256, 256,
  300, 100,
  false, true, 16,
  true, true, 'bambu_mqtt',
  '{"maxAmsUnits": 4}',
  'validated'
) ON CONFLICT (slug) DO NOTHING;

-- A1
INSERT INTO hardware_models (
  category, manufacturer, model, slug, description,
  build_volume_x, build_volume_y, build_volume_z,
  max_nozzle_temp, max_bed_temp,
  has_enclosure, has_filament_changer, filament_changer_slots,
  has_wifi, has_mqtt, protocol,
  capabilities, validation_status
) VALUES (
  'fdm_printer', 'Bambu Lab', 'A1', 'bambu-lab-a1',
  'Open-frame bed-slinger FDM printer with AMS Lite support. 256x256x256mm build volume.',
  256, 256, 256,
  300, 100,
  false, true, 4,
  true, true, 'bambu_mqtt',
  '{"cameraBuiltIn": true, "maxAmsUnits": 1, "amsType": "ams_lite"}',
  'validated'
) ON CONFLICT (slug) DO NOTHING;

-- A1 Mini
INSERT INTO hardware_models (
  category, manufacturer, model, slug, description,
  build_volume_x, build_volume_y, build_volume_z,
  max_nozzle_temp, max_bed_temp,
  has_enclosure, has_filament_changer, filament_changer_slots,
  has_wifi, has_mqtt, protocol,
  capabilities, validation_status
) VALUES (
  'fdm_printer', 'Bambu Lab', 'A1 Mini', 'bambu-lab-a1-mini',
  'Compact open-frame bed-slinger FDM printer with AMS Lite support. 180x180x180mm build volume.',
  180, 180, 180,
  300, 80,
  false, true, 4,
  true, true, 'bambu_mqtt',
  '{"cameraBuiltIn": true, "maxAmsUnits": 1, "amsType": "ams_lite"}',
  'validated'
) ON CONFLICT (slug) DO NOTHING;

-- ── Filament Changers (AMS variants) ────────────────────────

-- AMS (Original, 4-spool, humidity sensor)
INSERT INTO hardware_models (
  category, manufacturer, model, slug, description,
  has_filament_changer, filament_changer_slots,
  capabilities, validation_status
) VALUES (
  'filament_changer', 'Bambu Lab', 'AMS', 'bambu-lab-ams',
  'Automatic Material System — 4-spool filament changer with RFID detection and humidity sensor.',
  true, 4,
  '{"rfid": true, "humiditySensor": true, "desiccant": true, "changerType": "ams"}',
  'validated'
) ON CONFLICT (slug) DO NOTHING;

-- AMS Lite (4-spool, no humidity, for A1/A1 Mini)
INSERT INTO hardware_models (
  category, manufacturer, model, slug, description,
  has_filament_changer, filament_changer_slots,
  capabilities, validation_status
) VALUES (
  'filament_changer', 'Bambu Lab', 'AMS Lite', 'bambu-lab-ams-lite',
  'Lightweight 4-spool filament changer for A1 series. No humidity sensor or RFID.',
  true, 4,
  '{"rfid": false, "humiditySensor": false, "changerType": "ams_lite"}',
  'validated'
) ON CONFLICT (slug) DO NOTHING;

-- AMS 2 Pro (4-spool, humidity, weight-based tracking)
INSERT INTO hardware_models (
  category, manufacturer, model, slug, description,
  has_filament_changer, filament_changer_slots,
  capabilities, validation_status
) VALUES (
  'filament_changer', 'Bambu Lab', 'AMS 2 Pro', 'bambu-lab-ams-2-pro',
  'Next-gen 4-spool AMS with weight-based filament tracking, humidity sensor, and RFID.',
  true, 4,
  '{"rfid": true, "humiditySensor": true, "weightTracking": true, "desiccant": true, "changerType": "ams"}',
  'validated'
) ON CONFLICT (slug) DO NOTHING;

-- AMS HT (4-spool, heated/dried, for engineering filaments)
INSERT INTO hardware_models (
  category, manufacturer, model, slug, description,
  has_filament_changer, filament_changer_slots,
  capabilities, validation_status
) VALUES (
  'filament_changer', 'Bambu Lab', 'AMS HT', 'bambu-lab-ams-ht',
  'Heated 4-spool AMS for engineering filaments. Active drying with temperature control.',
  true, 4,
  '{"rfid": true, "humiditySensor": true, "activeDrying": true, "heatedChamber": true, "changerType": "ams"}',
  'validated'
) ON CONFLICT (slug) DO NOTHING;

-- ── Dryboxes ────────────────────────────────────────────────

INSERT INTO hardware_models (
  category, manufacturer, model, slug, description,
  capabilities, validation_status
) VALUES (
  'drybox', 'Bambu Lab', 'Drybox', 'bambu-lab-drybox',
  'Passive filament drybox with humidity indicator. Holds 1 spool.',
  '{"spoolCapacity": 1, "humiditySensor": false, "activeDrying": false}',
  'validated'
) ON CONFLICT (slug) DO NOTHING;

-- ── Enclosures ──────────────────────────────────────────────

INSERT INTO hardware_models (
  category, manufacturer, model, slug, description,
  capabilities, validation_status
) VALUES (
  'enclosure', 'Bambu Lab', 'P1 Enclosure', 'bambu-lab-p1-enclosure',
  'Clip-on enclosure for P1P to enable printing engineering filaments.',
  '{"compatibleModels": ["P1P"]}',
  'validated'
) ON CONFLICT (slug) DO NOTHING;
