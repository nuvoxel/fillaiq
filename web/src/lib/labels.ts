/**
 * Friendly display labels for database enum values.
 * Import from here instead of hardcoding labels in components.
 */

export const materialClassLabels: Record<string, string> = {
  fff: "3D Printing (FFF)",
  sla: "Resin (SLA)",
  cnc: "CNC",
  laser: "Laser",
};

export const productCategoryLabels: Record<string, string> = {
  filament: "Filament",
  resin: "Resin",
  cnc_stock: "CNC Stock",
  laser_stock: "Laser Stock",
  consumable: "Consumable",
  other: "Other",
};

export const machineTypeLabels: Record<string, string> = {
  fdm: "3D Printer (FDM)",
  cnc: "CNC",
  laser: "Laser",
  resin: "Resin Printer",
  multi: "Multi-Function",
};

export const fillTypeLabels: Record<string, string> = {
  none: "None",
  carbon_fiber: "Carbon Fiber",
  glass_fiber: "Glass Fiber",
  wood: "Wood",
  ceramic: "Ceramic",
  kevlar: "Kevlar",
  metal: "Metal",
  glow: "Glow",
};

export const finishTypeLabels: Record<string, string> = {
  matte: "Matte",
  glossy: "Glossy",
  satin: "Satin",
  silk: "Silk",
};

export const patternTypeLabels: Record<string, string> = {
  solid: "Solid",
  marble: "Marble",
  sparkle: "Sparkle",
  galaxy: "Galaxy",
  wood_grain: "Wood Grain",
  gradient: "Gradient",
};

export const itemStatusLabels: Record<string, string> = {
  active: "Active",
  empty: "Empty",
  archived: "Archived",
};

export const packageTypeLabels: Record<string, string> = {
  spool: "Spool",
  box: "Box",
  bottle: "Bottle",
  bag: "Bag",
  cartridge: "Cartridge",
  tool: "Tool",
  bolt: "Bolt",
  nut: "Nut",
  screw: "Screw",
  electronic_component: "Electronic Component",
  other: "Other",
};
