export const machineTypeLabels: Record<string, string> = {
  fdm: "FDM",
  cnc: "CNC",
  laser: "Laser",
  resin: "Resin",
  multi: "Multi",
};

export const machineProtocolLabels: Record<string, string> = {
  bambu: "Bambu Lab",
  klipper: "Klipper (Moonraker)",
  octoprint: "OctoPrint",
  prusalink: "PrusaLink",
  grbl: "GRBL",
  manual: "Manual / None",
};

export const toolCategoryLabels: Record<string, string> = {
  nozzle: "Nozzle",
  spindle_bit: "Spindle Bit",
  laser_module: "Laser Module",
};

export const nozzleMaterialLabels: Record<string, string> = {
  brass: "Brass",
  hardened_steel: "Hardened Steel",
  stainless_steel: "Stainless Steel",
  copper_alloy: "Copper Alloy",
  ruby: "Ruby",
};

export const nozzleTypeLabels: Record<string, string> = {
  standard: "Standard",
  high_flow: "High Flow",
  chc: "CHC",
  revo: "Revo",
};

export const wearLevelLabels: Record<string, string> = {
  new: "New",
  good: "Good",
  worn: "Worn",
  replace: "Replace",
};

export const workSurfaceTypeLabels: Record<string, string> = {
  cool_plate: "Cool Plate",
  textured_pei: "Textured PEI",
  engineering_plate: "Engineering Plate",
  high_temp_plate: "High Temp Plate",
  wasteboard: "Wasteboard",
  aluminum_bed: "Aluminum Bed",
  vacuum_table: "Vacuum Table",
  honeycomb_bed: "Honeycomb Bed",
  knife_blade_bed: "Knife Blade Bed",
  material_pass_through: "Material Pass-Through",
};

export const changerTypeLabels: Record<string, string> = {
  ams: "AMS",
  ams_lite: "AMS Lite",
  mmu: "MMU",
  manual: "Manual",
};

export const accessoryTypeLabels: Record<string, string> = {
  smoke_extractor: "Smoke Extractor",
  enclosure: "Enclosure",
  camera: "Camera",
  light: "Light",
  exhaust_fan: "Exhaust Fan",
  filament_buffer: "Filament Buffer",
  purge_tray: "Purge Tray",
  dust_collector: "Dust Collector",
  air_assist: "Air Assist",
  rotary_module: "Rotary Module",
  other: "Other",
};

export const equipmentTypeLabels: Record<string, string> = {
  drybox: "Drybox",
  enclosure: "Enclosure",
  storage_bin: "Storage Bin",
  other: "Other",
};

export const hardwareCategoryLabels: Record<string, string> = {
  label_printer: "Label Printer",
  scan_station: "FillaScan",
  shelf_station: "FillaShelf",
  fdm_printer: "FDM Printer",
  resin_printer: "Resin Printer",
  cnc: "CNC",
  laser_cutter: "Laser Cutter",
  laser_engraver: "Laser Engraver",
  drybox: "Drybox",
  filament_changer: "Filament Changer",
  enclosure: "Enclosure",
  other: "Other",
};

export const hardwareIdentifierTypeLabels: Record<string, string> = {
  usb_vid_pid: "USB VID:PID",
  ble_name_prefix: "BLE Name Prefix",
  ble_service_uuid: "BLE Service UUID",
  mdns_service: "mDNS Service",
  mqtt_topic_prefix: "MQTT Topic Prefix",
  serial_pattern: "Serial Pattern",
};

export function enumToOptions(labels: Record<string, string>) {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}
