// Hand-mirrored copy of backend/app/models/schemas.py.
// If you change one, change the other — there is no codegen wired up in
// this build (see LIMITATIONS.md for why: no build step assumed for the
// backend's Pydantic-to-OpenAPI-to-TS pipeline in this pass).
import * as THREE from 'three';

export type WidgetType = 'bar' | 'line' | 'multi_line' | 'pie' | 'area' | 'table' | 'stat' | 'gis';

export type GisGeometry = 'point' | 'heatmap' | 'choropleth';

export interface GisConfig {
  lat_field: string;
  lng_field: string;
  geometry: GisGeometry;
  weight_field?: string;
  region_id_field?: string;
  boundary_geojson_url?: string;
  tooltip_fields: string[];
}

export interface DrillDownConfig {
  enabled: boolean;
  key_fields: string[];
  sql_connection?: string;
  sql_query?: string;
  result_widget_type: WidgetType;
  title_template: string;
}

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface CanvasStroke {
  tool: 'pen' | 'brush' | 'marker' | 'eraser';
  color: string;
  size: number;
  points: CanvasPoint[];
}

export interface WidgetSpec {
  id: string;
  type: WidgetType;
  title: string;
  data: Record<string, any>[];
  x_field?: string;
  y_field?: string | string[];
  group_by?: string;
  color?: string;
  gis?: GisConfig;
  drill_down?: DrillDownConfig;
  sql_connection?: string;
  sql_query?: string;
  sql_params?: Record<string, any>;
  position: WidgetPosition;
}

export interface DashboardSpec {
  id: string;
  title: string;
  description: string;
  widgets: WidgetSpec[];
  drawings: CanvasStroke[];
  updated_at: string;
}

export interface ExtractedMetric {
  label: string;
  value: string;
  unit?: string;
}

export interface InsightBundle {
  source_file: string;
  summary: string;
  entities: string[];
  metrics: ExtractedMetric[];
  action_items: string[];
  risks: string[];
  chunk_count: number;
  low_confidence: boolean;
}

// Mirrors backend/app/ml/service.py's train_and_register() return shape.
export interface LeaderboardEntry {
  name: string;
  best_score: number;
  best_params: Record<string, any>;
  n_trials: number;
}

export interface TrainingResult {
  model_id: string;
  task: 'classification' | 'regression';
  metric: string;
  best_model_name: string;
  best_score: number;
  leaderboard: LeaderboardEntry[];
  feature_importance: Record<string, number>;
  n_rows: number;
  n_features: number;
  duration_s: number;
  summary: string;
}

export interface ModelListEntry {
  model_id: string;
  best_model_name: string;
  best_score: number;
  task: string;
  target: string;
}

// Mirrors GET /analyst/sessions/{id}/state (LangGraph / chat.py)
export interface AnalystMessage {
  role: string;
  content: string;
  name: string | null;
}

export interface AnalystTodo {
  id: string;
  description: string;
  assigned_to: 'Data Analyst' | 'Narrator';
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
}

export interface AnalystState {
  session_id: string;
  next_step: string[];
  messages: AnalystMessage[];
  artifacts: Record<string, string>;
  widgets: Record<string, any>[];
  todo: AnalystTodo[];
}

// Streaming event types received over WebSocket
export type AgentEvent =
  | { type: 'message_delta'; content: string }
  | { type: 'tool_started'; tool: string; toolCallId: string }
  | { type: 'tool_finished'; toolCallId: string }
  | { type: 'widget_created'; widgetId: string; widget: WidgetSpec }
  | { type: 'final'; content: string }
  | { type: 'interrupted' }
  | { type: 'error'; message: string };

/** @deprecated use AgentEvent */
export type AnalystStreamEvent = AgentEvent;



export interface NodeData {
  position: THREE.Vector3;
  worldPos: THREE.Vector3;
  size: number;
  intensity: number;
  isHub: boolean;
  id: number;
  active: boolean;
}

export interface ConnectionData {
  from: number;
  to: number;
  intensity: number;
}

export interface SplineData {
  curve: THREE.CatmullRomCurve3;
  tube: THREE.Mesh;
  tubeMaterial: THREE.MeshBasicMaterial;
  particleSystem: THREE.Points;
  particleGeometry: THREE.BufferGeometry;
  progress: number;
  speed: number;
  fadeIn: number;
  fadeOut: boolean;
  sourceNode: NodeData;
}

export interface FloatingObject {
  mesh: THREE.Sprite;
  material: THREE.SpriteMaterial;
  basePos: THREE.Vector3;
  driftSpeed: number;
  driftOffset: number;
  rotSpeed: number;
  type: string;
}

export interface HubSprite {
  sprite: THREE.Sprite;
  node: NodeData;
}

export interface ScreenPosition {
  x: number;
  y: number;
  visible: boolean;
}

export interface InfographicData {
  title: string;
  value: string;
  delta: string;
  deltaPositive: boolean;
  chartData: number[];
}

export type CursorState = 'default' | 'hover' | 'active';
export type InfographicType = 'line' | 'bar' | 'kpi' | 'distribution';