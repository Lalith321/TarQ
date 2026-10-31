// Hand-mirrored copy of backend/app/models/schemas.py.
// If you change one, change the other — there is no codegen wired up in
// this build (see LIMITATIONS.md for why: no build step assumed for the
// backend's Pydantic-to-OpenAPI-to-TS pipeline in this pass).
import * as THREE from 'three';

// Must match WidgetType in backend/app/models/schemas.py and the keys of
// WIDGET_REGISTRY in features/dashboard/components/widgets/widgetRegistry.tsx.
export type WidgetType =
  | 'bar'
  | 'stacked_bar'
  | 'line'
  | 'multi_line'
  | 'pie'
  | 'area'
  | 'table'
  | 'stat'
  | 'gis'
  | 'scatter'
  | 'manhattan'
  | 'volcano'
  | 'heatmap'
  | 'tiled_structure';

export type GisGeometry = 'point' | 'heatmap' | 'choropleth' | 'polygon' | 'trajectory';

export interface GisConfig {
  lat_field: string;
  lng_field: string;
  geometry: GisGeometry;
  weight_field?: string;
  region_id_field?: string;
  boundary_geojson_url?: string;
  geojson_data?: Record<string, any>;
  tile_url?: string;
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
  score_std?: number;
}

export interface TrainingResult {
  model_id: string;
  task: 'classification' | 'regression';
  target?: string;
  metric: string;
  best_model_name: string;
  best_score: number;
  leaderboard: LeaderboardEntry[];
  feature_importance: Record<string, number>;
  metrics?: Record<string, any>;
  trial_history?: Array<{
    model: string;
    trial_number: number;
    score: number | null;
    params: Record<string, any>;
  }>;
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
  n_features?: number;
  n_rows?: number;
  duration_s?: number;
}

export interface TimeSeriesHistoricalPoint {
  step: number;
  actual: number;
}

export interface TimeSeriesForecastPoint {
  step: string;
  forecast: number;
  lower_bound: number;
  upper_bound: number;
}

export interface TimeSeriesLossPoint {
  epoch: number;
  train_loss: number;
  val_loss: number;
}

export interface TimeSeriesMetrics {
  mae: number;
  rmse: number;
  smape: number;
  directional_accuracy: number;
}

export interface TimeSeriesResult {
  model_id: string;
  architecture: string;
  target_column: string;
  lookback: number;
  horizon: number;
  scaler_type: string;
  metrics: TimeSeriesMetrics;
  loss_history: TimeSeriesLossPoint[];
  historical_points: TimeSeriesHistoricalPoint[];
  validation_actual: Array<{ step: number; actual: number }>;
  validation_predicted: Array<{ step: number; predicted: number }>;
  future_forecast: TimeSeriesForecastPoint[];
  duration_s: number;
  created_at: string;
}

export interface SageMakerStatus {
  mode: 'simulation' | 'live_aws';
  simulation_mode: boolean;
  has_credentials: boolean;
  region: string;
  s3_bucket: string;
  role_arn: string;
  total_jobs: number;
  active_endpoints: number;
}

export interface SageMakerConfig {
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
  aws_session_token?: string;
  region_name?: string;
  s3_bucket?: string;
  role_arn?: string;
  simulation_mode?: boolean;
}

export interface SageMakerJob {
  job_name: string;
  status: 'InProgress' | 'Completed' | 'Failed';
  framework: string;
  instance_type: string;
  dataset_s3_uri: string;
  target_column: string;
  hyperparameters: Record<string, any>;
  created_at: string;
  completed_at?: string;
  billable_seconds: number;
  best_metric_name: string;
  best_metric_value: number;
  output_s3_uri: string;
  logs: string[];
}

export interface SageMakerEndpoint {
  endpoint_name: string;
  status: 'Creating' | 'InService' | 'Failed' | 'Deleting';
  instance_type: string;
  model_id: string;
  created_at: string;
  invocation_count: number;
  average_latency_ms: number;
}

export interface ColumnProfile {
  name: string;
  semantic_type: 'numeric' | 'categorical' | 'datetime' | 'boolean';
  raw_dtype?: string;
  null_count: number;
  null_pct: number;
  distinct_count: number;
  stats?: {
    min?: number | string;
    max?: number | string;
    mean?: number;
    median?: number;
    std?: number;
    q25?: number;
    q75?: number;
    outlier_count?: number;
  };
  top_categories?: Record<string, number>;
}

export interface DatasetProfile {
  rows: number;
  columns_count: number;
  columns: ColumnProfile[];
  numeric_columns: string[];
  categorical_columns: string[];
  correlations: Record<string, Record<string, number>>;
  recommended_targets: string[];
  preview: Record<string, any>[];
}

export interface SampleDataset {
  name: string;
  target: string;
  task: 'classification' | 'regression' | 'timeseries';
  csv_data: string;
  profile: DatasetProfile;
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