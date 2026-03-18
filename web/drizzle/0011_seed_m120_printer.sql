-- Seed Phomemo M120 label printer model and identifiers
-- M110/M120/M220 family: ESC/POS m110 variant, 203 DPI, 48mm print width

INSERT INTO hardware_models (
  category, manufacturer, model, slug, description,
  print_width_mm, print_dpi, dots_per_line,
  print_technology, continuous_feed,
  supported_label_widths,
  has_ble, protocol,
  ble_service_uuid, ble_write_char_uuid, ble_notify_char_uuid,
  capabilities, validation_status
) VALUES (
  'label_printer', 'Phomemo', 'M120', 'phomemo-m120',
  'Portable Bluetooth thermal label printer. ESC/POS protocol via BLE. Supports gap, continuous, and black-mark media.',
  48, 203, 384,
  'thermal', true,
  '[15, 20, 25, 30, 40, 50]',
  true, 'esc_pos',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '0000ff03-0000-1000-8000-00805f9b34fb',
  '{"battery": true, "paperSensor": true, "coverSensor": true, "speedControl": true, "densityControl": true, "protocolVariant": "m110", "bleAdvertisedUuid": "0000af30-0000-1000-8000-00805f9b34fb"}',
  'validated'
) ON CONFLICT (slug) DO NOTHING;

-- Add identifier: BLE advertised service UUID (0xAF30)
INSERT INTO hardware_identifiers (hardware_model_id, identifier_type, value, priority, notes)
SELECT id, 'ble_service_uuid', '0000af30-0000-1000-8000-00805f9b34fb', 10,
  'Advertised during BLE scan (not the GATT service UUID)'
FROM hardware_models WHERE slug = 'phomemo-m120'
ON CONFLICT (identifier_type, value) DO NOTHING;
