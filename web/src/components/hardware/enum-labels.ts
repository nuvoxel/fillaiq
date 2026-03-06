export const machineTypeLabels: Record<string, string> = {
  fdm: "FDM",
  cnc: "CNC",
  laser: "Laser",
  resin: "Resin",
  multi: "Multi",
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

export function enumToOptions(labels: Record<string, string>) {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}
