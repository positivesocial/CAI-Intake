/**
 * CAI Intake - Operations Library Types
 * 
 * Per-organization libraries for:
 * - Hole Patterns (drilling patterns)
 * - Groove Profiles (groove specifications)
 * - Routing Profiles (CNC operations)
 */

// ============================================================
// HOLE PATTERNS
// ============================================================

export type HolePatternKind = 
  | 'hinge'
  | 'shelf_pins'
  | 'handle'
  | 'knob'
  | 'drawer_slide'
  | 'cam_lock'
  | 'dowel'
  | 'system32'
  | 'custom';

export interface HoleDefinition {
  x: number;       // mm from reference edge
  y: number;       // mm from reference corner (negative = from opposite)
  dia_mm: number;  // hole diameter
  depth_mm?: number;
  through?: boolean;
  note?: string;
}

export interface ParametricConfig {
  spacing_mm: number;    // e.g., 32 for System 32
  margin_mm: number;     // distance from edge
  rows: 'auto' | number; // number of rows or auto-calculate
  hole_dia_mm: number;
  hole_depth_mm: number;
}

export interface HolePattern {
  id: string;
  organization_id: string;
  pattern_id: string;
  name: string;
  description?: string;
  kind: HolePatternKind;
  holes: HoleDefinition[];
  ref_edge?: 'L1' | 'L2' | 'W1' | 'W2';
  ref_corner?: 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right';
  parametric_config?: ParametricConfig;
  hardware_id?: string;
  hardware_brand?: string;
  hardware_model?: string;
  is_system: boolean;
  is_active: boolean;
  usage_count: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface HolePatternInput {
  pattern_id: string;
  name: string;
  description?: string;
  kind: HolePatternKind;
  holes: HoleDefinition[];
  ref_edge?: 'L1' | 'L2' | 'W1' | 'W2';
  ref_corner?: 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right';
  parametric_config?: ParametricConfig;
  hardware_id?: string;
  hardware_brand?: string;
  hardware_model?: string;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

// ============================================================
// GROOVE PROFILES
// ============================================================

export type GroovePurpose = 
  | 'back_panel'
  | 'drawer_bottom'
  | 'light_profile'
  | 'glass_panel'
  | 'divider'
  | 'custom';

export interface GrooveProfile {
  id: string;
  organization_id: string;
  profile_id: string;
  name: string;
  description?: string;
  width_mm: number;
  depth_mm: number;
  purpose?: GroovePurpose;
  default_offset_mm: number;
  default_face: 'front' | 'back';
  allow_stopped: boolean;
  default_start_offset_mm: number;
  default_end_offset_mm: number;
  tool_dia_mm?: number;
  tool_id?: string;
  feed_rate?: number;
  is_system: boolean;
  is_active: boolean;
  usage_count: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GrooveProfileInput {
  profile_id: string;
  name: string;
  description?: string;
  width_mm: number;
  depth_mm: number;
  purpose?: GroovePurpose;
  default_offset_mm?: number;
  default_face?: 'front' | 'back';
  allow_stopped?: boolean;
  default_start_offset_mm?: number;
  default_end_offset_mm?: number;
  tool_dia_mm?: number;
  tool_id?: string;
  feed_rate?: number;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

// ============================================================
// ROUTING PROFILES
// ============================================================

export type RoutingProfileType = 
  | 'edge_profile'
  | 'pocket'
  | 'cutout'
  | 'rebate'
  | 'chamfer'
  | 'radius'
  | 'contour'
  | 'drill_array'
  | 'text'
  | 'custom';

export type ToolType = 
  | 'straight'
  | 'spiral_up'
  | 'spiral_down'
  | 'compression'
  | 'vbit'
  | 'ballnose'
  | 'ogee';

// Type-specific specifications
export interface EdgeProfileSpecs {
  shape: 'round' | 'ogee' | 'bevel' | 'custom';
  radius_mm?: number;
  angle_deg?: number;
  depth_mm?: number;
}

export interface PocketSpecs {
  default_depth_mm: number;
  through_allowed: boolean;
  width_mm?: number;
  height_mm?: number;
  corner_radius_mm?: number;
}

export interface CutoutSpecs {
  shape: 'rect' | 'circle' | 'oval' | 'custom';
  purpose?: 'sink' | 'hob' | 'vent' | 'socket' | 'custom';
  corner_radius_mm?: number;
  through: boolean;
}

export interface RadiusSpecs {
  radius_mm: number;
  corners: 'all' | 'front' | 'back' | 'left' | 'right' | string[];
}

export interface ChamferSpecs {
  angle_deg: number;
  width_mm: number;
}

export interface RebateSpecs {
  width_mm: number;
  depth_mm: number;
}

export type RoutingSpecs = 
  | EdgeProfileSpecs 
  | PocketSpecs 
  | CutoutSpecs 
  | RadiusSpecs 
  | ChamferSpecs 
  | RebateSpecs 
  | Record<string, unknown>;

export interface RoutingProfile {
  id: string;
  organization_id: string;
  profile_id: string;
  name: string;
  description?: string;
  profile_type: RoutingProfileType;
  specifications: RoutingSpecs;
  tool_dia_mm?: number;
  tool_id?: string;
  tool_type?: ToolType;
  feed_rate?: number;
  plunge_rate?: number;
  spindle_speed?: number;
  step_down_mm?: number;
  dxf_layer?: string;
  gcode_template?: string;
  is_system: boolean;
  is_active: boolean;
  usage_count: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RoutingProfileInput {
  profile_id: string;
  name: string;
  description?: string;
  profile_type: RoutingProfileType;
  specifications: RoutingSpecs;
  tool_dia_mm?: number;
  tool_id?: string;
  tool_type?: ToolType;
  feed_rate?: number;
  plunge_rate?: number;
  spindle_speed?: number;
  step_down_mm?: number;
  dxf_layer?: string;
  gcode_template?: string;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface OperationsLibrarySummary {
  hole_patterns: number;
  groove_profiles: number;
  routing_profiles: number;
}

export interface ListHolePatternsResponse {
  patterns: HolePattern[];
  total: number;
}

export interface ListGrooveProfilesResponse {
  profiles: GrooveProfile[];
  total: number;
}

export interface ListRoutingProfilesResponse {
  profiles: RoutingProfile[];
  total: number;
}

// ============================================================
// DISPLAY HELPERS
// ============================================================

export const HOLE_PATTERN_KIND_LABELS: Record<HolePatternKind, string> = {
  hinge: 'Hinge',
  shelf_pins: 'Shelf Pins',
  handle: 'Handle',
  knob: 'Knob',
  drawer_slide: 'Drawer Slide',
  cam_lock: 'Cam Lock',
  dowel: 'Dowel',
  system32: 'System 32',
  custom: 'Custom',
};

export const GROOVE_PURPOSE_LABELS: Record<GroovePurpose, string> = {
  back_panel: 'Back Panel',
  drawer_bottom: 'Drawer Bottom',
  light_profile: 'Light Profile',
  glass_panel: 'Glass Panel',
  divider: 'Divider',
  custom: 'Custom',
};

export const ROUTING_TYPE_LABELS: Record<RoutingProfileType, string> = {
  edge_profile: 'Edge Profile',
  pocket: 'Pocket',
  cutout: 'Cutout',
  rebate: 'Rebate',
  chamfer: 'Chamfer',
  radius: 'Corner Radius',
  contour: 'Contour',
  drill_array: 'Drill Array',
  text: 'Text Engraving',
  custom: 'Custom',
};

export const TOOL_TYPE_LABELS: Record<ToolType, string> = {
  straight: 'Straight',
  spiral_up: 'Spiral Up-cut',
  spiral_down: 'Spiral Down-cut',
  compression: 'Compression',
  vbit: 'V-Bit',
  ballnose: 'Ball Nose',
  ogee: 'Ogee',
};





