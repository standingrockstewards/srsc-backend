// ─── CHECKLIST MODULE DEFINITIONS ───────────────────────────────────────────
// Each module has items; each item has a key, label, allowPhoto flag, and allowNotes flag

export type ChecklistItemDef = {
  key: string;
  label: string;
  allowPhoto?: boolean;
  allowNotes?: boolean;
  fieldType?: "pass_flag_fail" | "text" | "number" | "date" | "select";
  options?: string[]; // for select type
};

export type ChecklistModule = {
  key: string;
  label: string;
  icon: string;
  items: ChecklistItemDef[];
  conditional?: keyof import("../.././../shared/schema").Property | string; // property flag that enables this module
};

export const CHECKLIST_MODULES: ChecklistModule[] = [
  // ─── CORE: EXTERIOR ──────────────────────────────────────────────────────
  {
    key: "exterior",
    label: "Exterior Condition",
    icon: "Home",
    items: [
      { key: "roof_damage", label: "Roof — visible damage", allowPhoto: true, allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "gutters", label: "Gutters and downspouts clear", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "siding", label: "Siding / trim / paint condition", allowPhoto: true, allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "windows", label: "Windows — all intact and locked", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "entry_doors", label: "Entry doors — secure and no damage", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "driveway", label: "Driveway and walkways clear", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "ext_lighting", label: "Exterior lighting functional", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "debris", label: "Debris or trash on property", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "unauthorized_entry", label: "Signs of unauthorized entry or trespassing", allowPhoto: true, allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "landscaping", label: "Landscaping — no immediate hazards", allowNotes: true, fieldType: "pass_flag_fail" },
    ],
  },
  // ─── CORE: SECURITY ──────────────────────────────────────────────────────
  {
    key: "security",
    label: "Security & Monitoring",
    icon: "ShieldCheck",
    items: [
      { key: "cameras", label: "All camera systems online and aimed correctly", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "motion_sensors", label: "Motion sensors functional", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "tampering", label: "No evidence of tampering with equipment", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "alarm_panel", label: "Alarm panel status check", allowNotes: true, fieldType: "pass_flag_fail" },
    ],
  },
  // ─── CORE: SUMMARY ──────────────────────────────────────────────────────
  {
    key: "summary",
    label: "Overall Site Summary",
    icon: "ClipboardCheck",
    items: [
      { key: "overall_status", label: "Overall property status", fieldType: "select", options: ["All Clear", "Items Flagged", "Action Required"] },
      { key: "general_notes", label: "General visit notes", allowNotes: true, fieldType: "text" },
      { key: "weather_temp", label: "Temperature (°F)", fieldType: "text" },
      { key: "weather_conditions", label: "Weather conditions", fieldType: "select", options: ["Clear", "Cloudy", "Rain", "Storm", "Snow", "Ice"] },
      { key: "duration", label: "Estimated visit duration (minutes)", fieldType: "number" },
    ],
  },
  // ─── DOCK MODULE ─────────────────────────────────────────────────────────
  {
    key: "dock",
    label: "Dock",
    icon: "Anchor",
    conditional: "hasDock",
    items: [
      { key: "dock_structure", label: "Dock structure integrity — no damage, loose boards, or hazards", allowPhoto: true, allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "dock_cleats", label: "Dock cleats and hardware secure", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "dock_lines", label: "Dock lines in good condition", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "dock_lighting", label: "Dock lighting functional", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "water_level", label: "Water level observation", fieldType: "text", allowNotes: true },
      { key: "shoreline_erosion", label: "Shoreline erosion visible", allowPhoto: true, allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "dock_locks", label: "Dock gates / locks secure", allowNotes: true, fieldType: "pass_flag_fail" },
    ],
  },
  // ─── WATERCRAFT MODULE ───────────────────────────────────────────────────
  {
    key: "watercraft",
    label: "Watercraft",
    icon: "Ship",
    conditional: "hasBoat",
    items: [
      { key: "vessel_secured", label: "Vessel secured and lines intact", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "hull_damage", label: "No visible damage to hull", allowPhoto: true, allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "cover", label: "Cover in place and secured", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "bilge", label: "Bilge pump operational / no water intrusion", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "pwc", label: "PWC / secondary watercraft secured", allowNotes: true, fieldType: "pass_flag_fail" },
    ],
  },
  // ─── BOAT LIFT MODULE ────────────────────────────────────────────────────
  {
    key: "boat_lift",
    label: "Boat Lift",
    icon: "ArrowUpFromLine",
    conditional: "hasBoatLift",
    items: [
      { key: "lift_mechanism", label: "Lift mechanism functional", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "lift_bunks", label: "Lift bunks and straps in good condition", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "vessel_seated", label: "Vessel properly seated on lift", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "lift_electrical", label: "Electrical connection to lift secure", allowNotes: true, fieldType: "pass_flag_fail" },
    ],
  },
  // ─── INTERIOR MODULE ─────────────────────────────────────────────────────
  {
    key: "interior",
    label: "Interior",
    icon: "DoorOpen",
    conditional: "interiorAccess",
    items: [
      { key: "water_leaks", label: "No water leaks or moisture intrusion visible", allowPhoto: true, allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "hvac_operational", label: "HVAC system operational — check thermostat", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "hvac_filter", label: "HVAC filter condition", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "pest", label: "No evidence of pest activity", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "water_heater", label: "Water heater — no leaks, pilot light on if gas", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "plumbing", label: "Plumbing — check under sinks, visible pipes", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "smoke_detectors", label: "Smoke detectors functional — tested", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "co_detectors", label: "CO detectors functional — tested", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "refrigerator", label: "Refrigerator — running, no spoiled food", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "interior_secure", label: "No doors or windows left unsecured inside", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "interior_condition", label: "Interior overall condition", allowPhoto: true, allowNotes: true, fieldType: "pass_flag_fail" },
    ],
  },
  // ─── GENERATOR MODULE ────────────────────────────────────────────────────
  {
    key: "generator",
    label: "Generator",
    icon: "Zap",
    conditional: "hasGenerator",
    items: [
      { key: "gen_visual", label: "Generator — visual inspection, no fuel leaks", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "gen_fuel", label: "Fuel level check", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "transfer_switch", label: "Transfer switch condition", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "last_run", label: "Last run date", fieldType: "date", allowNotes: true },
    ],
  },
  // ─── PROPANE MODULE ──────────────────────────────────────────────────────
  {
    key: "propane",
    label: "Propane System",
    icon: "Flame",
    conditional: "hasPropane",
    items: [
      { key: "tank_visual", label: "Tank visual — no rust, damage, or leaks", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "tank_level", label: "Tank level estimate (%)", fieldType: "number", allowNotes: true },
      { key: "regulator", label: "Regulator and lines appear intact", allowNotes: true, fieldType: "pass_flag_fail" },
    ],
  },
  // ─── IRRIGATION MODULE ───────────────────────────────────────────────────
  {
    key: "irrigation",
    label: "Irrigation System",
    icon: "Droplets",
    conditional: "hasIrrigation",
    items: [
      { key: "system_status", label: "System active or winterized per season", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "broken_heads", label: "No visible broken heads or leaks", allowNotes: true, fieldType: "pass_flag_fail" },
      { key: "controller", label: "Controller settings correct", allowNotes: true, fieldType: "pass_flag_fail" },
    ],
  },
];

export const CORE_MODULE_KEYS = ["exterior", "security", "summary"];

export function getActiveModules(property: {
  interiorAccess?: boolean | null;
  hasDock?: boolean | null;
  hasBoat?: boolean | null;
  hasBoatLift?: boolean | null;
  hasGenerator?: boolean | null;
  hasIrrigation?: boolean | null;
  hasPropane?: boolean | null;
}): ChecklistModule[] {
  return CHECKLIST_MODULES.filter(mod => {
    if (!mod.conditional) return true; // core modules always included
    return property[mod.conditional as keyof typeof property] === true;
  });
}

export function getResultLabel(result: string | null | undefined) {
  switch (result) {
    case "pass": return "Pass";
    case "flag": return "Flag";
    case "fail": return "Fail";
    case "na": return "N/A";
    default: return "—";
  }
}

export function getResultColor(result: string | null | undefined) {
  switch (result) {
    case "pass": return "text-green-700 dark:text-green-400";
    case "flag": return "text-amber-600 dark:text-amber-400";
    case "fail": return "text-red-600 dark:text-red-400";
    case "na": return "text-muted-foreground";
    default: return "text-muted-foreground";
  }
}
