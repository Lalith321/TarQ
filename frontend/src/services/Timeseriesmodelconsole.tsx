import { useState, useRef, type ReactNode, type ChangeEvent } from "react";
import { Play, Download, Plus, Trash2, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

type FieldKind = "number" | "select" | "bool";
type ParamValue = number | string | boolean;
type ParamSet = Record<string, ParamValue>;
type SearchSpace = { min: number; max: number } | { choices: ParamValue[] };
type SearchSet = Record<string, SearchSpace>;

interface BaseFieldDef {
  key: string;
  label: string;
  type: FieldKind;
}
interface NumberFieldDef extends BaseFieldDef {
  type: "number";
  default: number;
  min: number;
  max: number;
  step: number;
}
interface SelectFieldDef extends BaseFieldDef {
  type: "select";
  default: string;
  options: string[];
}
interface BoolFieldDef extends BaseFieldDef {
  type: "bool";
  default: boolean;
}
type FieldDef = NumberFieldDef | SelectFieldDef | BoolFieldDef;

type ArchType = "lstm" | "gru" | "tcn" | "transformer" | "nbeats";
type Mode = "manual" | "auto";
type Status = "idle" | "training" | "done";
type FnKind = "loss" | "metric" | "feature" | "postprocess";

interface CustomFunction {
  id: number;
  name: string;
  type: FnKind;
  code: string;
  enabled: boolean;
}

interface DataConfig {
  targetColumn: string;
  featureColumns: string;
  lookback: number;
  horizon: number;
  scaler: "standard" | "minmax" | "none";
  trainSplit: number;
  valSplit: number;
}

interface AutoTuneConfig {
  enabled: boolean;
  trials: number;
  metric: "val_loss" | "mae" | "rmse";
  timeoutMin: number;
}

interface TrialInfo {
  trial: number;
  total: number;
  best: number | null;
}

interface BestParams {
  arch: ParamSet;
  training: ParamSet;
}

interface Artifact {
  filename: string;
  sizeKB: number;
  bestParams?: BestParams;
  bestMetric?: number;
}

const MODEL_TYPES: { id: ArchType; label: string }[] = [
  { id: "lstm", label: "LSTM" },
  { id: "gru", label: "GRU" },
  { id: "tcn", label: "TCN" },
  { id: "transformer", label: "Transformer" },
  { id: "nbeats", label: "N-BEATS" },
];

// Each architecture gets the fields that actually apply to it — not one
// generic set reused everywhere.
const ARCH_FIELDS: Record<ArchType, FieldDef[]> = {
  lstm: [
    { key: "hiddenSize", label: "Hidden size", type: "number", default: 128, min: 8, max: 512, step: 1 },
    { key: "numLayers", label: "Layers", type: "number", default: 2, min: 1, max: 6, step: 1 },
    { key: "dropout", label: "Dropout", type: "number", default: 0.2, min: 0, max: 0.9, step: 0.05 },
    { key: "bidirectional", label: "Bidirectional", type: "bool", default: false },
  ],
  gru: [
    { key: "hiddenSize", label: "Hidden size", type: "number", default: 128, min: 8, max: 512, step: 1 },
    { key: "numLayers", label: "Layers", type: "number", default: 2, min: 1, max: 6, step: 1 },
    { key: "dropout", label: "Dropout", type: "number", default: 0.2, min: 0, max: 0.9, step: 0.05 },
    { key: "bidirectional", label: "Bidirectional", type: "bool", default: false },
  ],
  tcn: [
    { key: "numChannels", label: "Channels", type: "number", default: 64, min: 8, max: 256, step: 1 },
    { key: "kernelSize", label: "Kernel size", type: "number", default: 3, min: 2, max: 9, step: 1 },
    { key: "numLevels", label: "Levels (dilation depth)", type: "number", default: 4, min: 1, max: 8, step: 1 },
    { key: "dropout", label: "Dropout", type: "number", default: 0.2, min: 0, max: 0.9, step: 0.05 },
  ],
  transformer: [
    { key: "dModel", label: "d_model", type: "number", default: 64, min: 16, max: 512, step: 1 },
    { key: "nHead", label: "Attention heads", type: "number", default: 4, min: 1, max: 16, step: 1 },
    { key: "numEncoderLayers", label: "Encoder layers", type: "number", default: 2, min: 1, max: 8, step: 1 },
    { key: "dimFeedforward", label: "Feedforward dim", type: "number", default: 256, min: 32, max: 1024, step: 1 },
    { key: "dropout", label: "Dropout", type: "number", default: 0.1, min: 0, max: 0.9, step: 0.05 },
  ],
  nbeats: [
    { key: "numStacks", label: "Stacks", type: "number", default: 2, min: 1, max: 6, step: 1 },
    { key: "numBlocks", label: "Blocks per stack", type: "number", default: 3, min: 1, max: 8, step: 1 },
    { key: "layerWidth", label: "Layer width", type: "number", default: 256, min: 32, max: 512, step: 1 },
    { key: "basisType", label: "Basis", type: "select", options: ["trend", "seasonality", "generic"], default: "generic" },
  ],
};

const TRAINING_FIELDS: FieldDef[] = [
  { key: "optimizer", label: "Optimizer", type: "select", options: ["adam", "sgd", "rmsprop"], default: "adam" },
  { key: "learningRate", label: "Learning rate", type: "number", default: 0.001, min: 0.00001, max: 0.05, step: 0.0001 },
  { key: "batchSize", label: "Batch size", type: "number", default: 64, min: 8, max: 512, step: 1 },
  { key: "epochs", label: "Epochs", type: "number", default: 50, min: 1, max: 500, step: 1 },
];

const FN_TYPES: { id: FnKind; label: string }[] = [
  { id: "loss", label: "Loss fn" },
  { id: "metric", label: "Metric" },
  { id: "feature", label: "Feature transform" },
  { id: "postprocess", label: "Postprocess" },
];

const TEMPLATES: Record<FnKind, string> = {
  loss: 'def custom_loss(y_pred, y_true):\n    return ((y_pred - y_true) ** 2).mean()',
  metric: 'def custom_metric(y_pred, y_true):\n    return (y_pred - y_true).abs().mean()',
  feature: 'def transform(df):\n    df["rolling_mean_7"] = df["value"].rolling(7).mean()\n    return df',
  postprocess: 'def postprocess(preds):\n    return preds.clip(min=0)',
};

const defaultParamsFor = (fields: FieldDef[]): ParamSet => Object.fromEntries(fields.map((f) => [f.key, f.default]));
const defaultSearchFor = (field: FieldDef): SearchSpace => {
  if (field.type === "number") return { min: field.min, max: field.max };
  if (field.type === "bool") return { choices: [true, false] };
  return { choices: [...field.options] };
};
const defaultSearchSetFor = (fields: FieldDef[]): SearchSet => Object.fromEntries(fields.map((f) => [f.key, defaultSearchFor(f)]));

const DEFAULT_ARCH_PARAMS = Object.fromEntries(
  Object.entries(ARCH_FIELDS).map(([type, fields]) => [type, defaultParamsFor(fields)])
) as Record<ArchType, ParamSet>;
const DEFAULT_ARCH_SEARCH = Object.fromEntries(
  Object.entries(ARCH_FIELDS).map(([type, fields]) => [type, defaultSearchSetFor(fields)])
) as Record<ArchType, SearchSet>;

const labelize = (s: unknown): string => (typeof s === "string" ? s.charAt(0).toUpperCase() + s.slice(1) : String(s));

let fnSeq = 1;

function Module({ n, title, children, accent }: { n: string; title: string; children: ReactNode; accent?: "cyan" }) {
  return (
    <div className="relative rounded-md bg-zinc-900 border border-zinc-800">
      <div className={"absolute top-0 left-0 right-0 h-0.5 rounded-t-md " + (accent === "cyan" ? "bg-cyan-500/70" : "bg-amber-500/70")} />
      <div className="flex items-baseline gap-2 px-4 pt-4 pb-3 border-b border-zinc-800">
        <span className={"text-xs tracking-widest " + (accent === "cyan" ? "text-cyan-400" : "text-amber-500")} style={{ fontFamily: "ui-monospace, monospace" }}>
          MOD {n}
        </span>
        <span className="text-sm font-semibold tracking-wide text-zinc-100">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: ReactNode }) {
  return (
    <label className={"flex flex-col gap-1 " + (full ? "col-span-2" : "")}>
      <span className="text-xs uppercase tracking-wider text-zinc-500" style={{ fontFamily: "ui-monospace, monospace" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm px-2.5 py-1.5 " +
  "focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500";

function Chip({ label, value, active }: { label: string; value: string | number; active?: boolean }) {
  return (
    <div className={"shrink-0 rounded border px-3 py-2 text-center " + (active ? "border-amber-500/60 bg-amber-500/10" : "border-zinc-800 bg-zinc-900")}>
      <div className="text-xs uppercase tracking-wider text-zinc-500" style={{ fontFamily: "ui-monospace, monospace" }}>
        {label}
      </div>
      <div className={"text-sm font-medium " + (active ? "text-amber-400" : "text-zinc-300")}>{value}</div>
    </div>
  );
}

function Wire() {
  return <div className="flex-1 min-w-4 border-t border-dashed border-zinc-700 mt-5" />;
}

interface FieldControlProps {
  field: FieldDef;
  mode: Mode;
  value: ParamValue;
  onChangeValue: (v: ParamValue) => void;
  search: SearchSpace;
  onChangeSearch: (patch: SearchSpace) => void;
}

// Renders one field as a plain control in manual mode, or a search-space
// control (min/max range, or a set of toggleable candidate choices) in
// auto-tune mode.
function FieldControl({ field, mode, value, onChangeValue, search, onChangeSearch }: FieldControlProps) {
  if (mode === "manual") {
    if (field.type === "number") {
      return (
        <input
          type="number"
          step={field.step}
          min={field.min}
          max={field.max}
          className={inputCls}
          value={value as number}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChangeValue(Number(e.target.value))}
        />
      );
    }
    if (field.type === "select") {
      return (
        <select className={inputCls} value={value as string} onChange={(e: ChangeEvent<HTMLSelectElement>) => onChangeValue(e.target.value)}>
          {field.options.map((o) => (
            <option key={o} value={o}>{labelize(o)}</option>
          ))}
        </select>
      );
    }
    return (
      <label className="flex items-center gap-2 text-sm text-zinc-300 h-8">
        <input type="checkbox" className="accent-amber-500" checked={value as boolean} onChange={(e: ChangeEvent<HTMLInputElement>) => onChangeValue(e.target.checked)} />
        {value ? "Yes" : "No"}
      </label>
    );
  }

  // auto-tune mode: define a search space instead of a fixed value
  if (field.type === "number") {
    const range = search as { min: number; max: number };
    return (
      <div className="flex items-center gap-1.5">
        <input type="number" step={field.step} className={inputCls} value={range.min} onChange={(e: ChangeEvent<HTMLInputElement>) => onChangeSearch({ ...range, min: Number(e.target.value) })} />
        <span className="text-zinc-600 text-xs shrink-0">to</span>
        <input type="number" step={field.step} className={inputCls} value={range.max} onChange={(e: ChangeEvent<HTMLInputElement>) => onChangeSearch({ ...range, max: Number(e.target.value) })} />
      </div>
    );
  }
  const options: ParamValue[] = field.type === "bool" ? [true, false] : field.options;
  const choices = (search as { choices: ParamValue[] }).choices || [];
  const toggle = (opt: ParamValue) => {
    const has = choices.includes(opt);
    onChangeSearch({ choices: has ? choices.filter((c) => c !== opt) : [...choices, opt] });
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = choices.includes(opt);
        return (
          <button
            type="button"
            key={String(opt)}
            onClick={() => toggle(opt)}
            className={"text-xs px-2 py-1 rounded border " + (active ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-400" : "border-zinc-800 text-zinc-500")}
          >
            {field.type === "bool" ? (opt ? "Yes" : "No") : labelize(opt)}
          </button>
        );
      })}
    </div>
  );
}

interface FieldGridProps {
  fields: FieldDef[];
  mode: Mode;
  params: ParamSet;
  onParam: (key: string, value: ParamValue) => void;
  search: SearchSet;
  onSearch: (key: string, patch: SearchSpace) => void;
}

function FieldGrid({ fields, mode, params, onParam, search, onSearch }: FieldGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map((f) => (
        <Field key={f.key} label={f.label} full={mode === "auto" && f.type !== "number"}>
          <FieldControl
            field={f}
            mode={mode}
            value={params[f.key]}
            onChangeValue={(v) => onParam(f.key, v)}
            search={search[f.key]}
            onChangeSearch={(patch) => onSearch(f.key, patch)}
          />
        </Field>
      ))}
    </div>
  );
}

export default function TimeSeriesModelConsole() {
  const [dataConfig, setDataConfig] = useState<DataConfig>({
    targetColumn: "close_price",
    featureColumns: "close_price, volume, rsi_14",
    lookback: 60,
    horizon: 5,
    scaler: "standard",
    trainSplit: 70,
    valSplit: 15,
  });
  const setData = (key: keyof DataConfig) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const raw = e.target.value;
    setDataConfig((c) => ({ ...c, [key]: e.target.type === "number" ? Number(raw) : raw }));
  };

  const [archType, setArchType] = useState<ArchType>("lstm");
  const [archParams, setArchParams] = useState<Record<ArchType, ParamSet>>(DEFAULT_ARCH_PARAMS);
  const [archSearch, setArchSearch] = useState<Record<ArchType, SearchSet>>(DEFAULT_ARCH_SEARCH);
  const updateArchParam = (key: string, value: ParamValue) => setArchParams((p) => ({ ...p, [archType]: { ...p[archType], [key]: value } }));
  const updateArchSearch = (key: string, patch: SearchSpace) => setArchSearch((p) => ({ ...p, [archType]: { ...p[archType], [key]: patch } }));

  const [trainingParams, setTrainingParams] = useState<ParamSet>(defaultParamsFor(TRAINING_FIELDS));
  const [trainingSearch, setTrainingSearch] = useState<SearchSet>(defaultSearchSetFor(TRAINING_FIELDS));
  const updateTrainingParam = (key: string, value: ParamValue) => setTrainingParams((p) => ({ ...p, [key]: value }));
  const updateTrainingSearch = (key: string, patch: SearchSpace) => setTrainingSearch((p) => ({ ...p, [key]: patch }));

  const [autoTune, setAutoTune] = useState<AutoTuneConfig>({ enabled: false, trials: 30, metric: "val_loss", timeoutMin: 15 });

  const [functions, setFunctions] = useState<CustomFunction[]>([{ id: fnSeq++, name: "custom_loss", type: "loss", code: TEMPLATES.loss, enabled: true }]);
  const addFunction = () => setFunctions((fns) => [...fns, { id: fnSeq++, name: `fn_${fns.length + 1}`, type: "feature", code: TEMPLATES.feature, enabled: true }]);
  const updateFunction = (id: number, patch: Partial<CustomFunction>) => setFunctions((fns) => fns.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const removeFunction = (id: number) => setFunctions((fns) => fns.filter((f) => f.id !== id));

  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [trialInfo, setTrialInfo] = useState<TrialInfo | null>(null);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sampleField = (field: FieldDef, search: SearchSpace): ParamValue => {
    if (field.type === "number") {
      const range = search as { min: number; max: number };
      const min = range?.min ?? field.min;
      const max = range?.max ?? field.max;
      const raw = min + Math.random() * (max - min);
      const snapped = Math.round(raw / field.step) * field.step;
      return field.step < 1 ? Number(snapped.toFixed(4)) : Math.round(snapped);
    }
    const choices = (search as { choices: ParamValue[] })?.choices;
    const pool = choices && choices.length ? choices : [field.default];
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const sampleBestParams = (): BestParams => {
    const arch: ParamSet = {};
    ARCH_FIELDS[archType].forEach((f) => { arch[f.key] = sampleField(f, archSearch[archType][f.key]); });
    const training: ParamSet = {};
    TRAINING_FIELDS.forEach((f) => { training[f.key] = sampleField(f, trainingSearch[f.key]); });
    return { arch, training };
  };

  const startTraining = () => {
    if (status === "training") return;
    setStatus("training");
    setArtifact(null);

    if (autoTune.enabled) {
      let trial = 0;
      let best = Infinity;
      const total = autoTune.trials;
      setTrialInfo({ trial: 0, total, best: null });
      timerRef.current = setInterval(() => {
        trial += 1;
        const val = Math.max(0.01, 0.35 * Math.exp(-trial / (total * 0.4)) + Math.random() * 0.03);
        best = Math.min(best, val);
        setTrialInfo({ trial, total, best });
        setProgress((trial / total) * 100);
        if (trial >= total) {
          clearInterval(timerRef.current as ReturnType<typeof setInterval>);
          const bestParams = sampleBestParams();
          setArtifact({
            filename: `ts_${archType}_optuna_${Date.now()}.pth`,
            sizeKB: Math.round(400 + Math.random() * 3000),
            bestParams,
            bestMetric: best,
          });
          setStatus("done");
        }
      }, 140);
      return;
    }

    setProgress(0);
    let p = 0;
    timerRef.current = setInterval(() => {
      p += Math.random() * 12 + 6;
      if (p >= 100) {
        p = 100;
        clearInterval(timerRef.current as ReturnType<typeof setInterval>);
        setArtifact({ filename: `ts_${archType}_${Date.now()}.pth`, sizeKB: Math.round(400 + Math.random() * 3000) });
        setStatus("done");
      }
      setProgress(Math.min(p, 100));
    }, 220);
  };

  const downloadArtifact = () => {
    if (!artifact) return;
    const payload = {
      dataConfig,
      archType,
      arch: artifact.bestParams ? artifact.bestParams.arch : archParams[archType],
      training: artifact.bestParams ? artifact.bestParams.training : trainingParams,
      autoTune: autoTune.enabled ? { trials: autoTune.trials, metric: autoTune.metric, bestMetric: artifact.bestMetric } : null,
      functions: functions.filter((f) => f.enabled),
    };
    const stub =
      "# Placeholder artifact from UI1 — wire this button to your training service's\n" +
      "# actual model bytes. Config used to request this run:\n\n" +
      JSON.stringify(payload, null, 2) +
      "\n";
    const blob = new Blob([stub], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = artifact.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const enabledCount = functions.filter((f) => f.enabled).length;
  const testSplit = Math.max(0, 100 - dataConfig.trainSplit - dataConfig.valSplit);
  const hasExogenous = dataConfig.featureColumns
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .some((c) => c !== dataConfig.targetColumn);
  const mode: Mode = autoTune.enabled ? "auto" : "manual";

  return (
    <div className="min-h-full w-full bg-zinc-950 text-zinc-100 px-4 py-8 sm:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-xs px-2 py-0.5 rounded border border-amber-500/50 text-amber-400 tracking-widest" style={{ fontFamily: "ui-monospace, monospace" }}>
            UI1
          </span>
          <span className="text-xs uppercase tracking-widest text-zinc-500" style={{ fontFamily: "ui-monospace, monospace" }}>
            Time Series Model Console
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-50 mb-1">Configure, extend, export</h1>
        <p className="text-sm text-zinc-500 mb-4">
          Set the model's data window and architecture, attach custom functions, then export a checkpoint ready for inference.
        </p>

        <div className="inline-flex rounded-md border border-zinc-800 overflow-hidden mb-6">
          <button
            type="button"
            onClick={() => setAutoTune((a) => ({ ...a, enabled: false }))}
            className={"px-3 py-1.5 text-xs font-medium " + (!autoTune.enabled ? "bg-amber-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-200")}
          >
            Manual
          </button>
          <button
            type="button"
            onClick={() => setAutoTune((a) => ({ ...a, enabled: true }))}
            className={"px-3 py-1.5 text-xs font-medium " + (autoTune.enabled ? "bg-cyan-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-200")}
          >
            Auto-tune (Optuna)
          </button>
        </div>

        {/* signal chain summary */}
        <div className="flex items-stretch gap-2 mb-8 overflow-x-auto pb-1">
          <Chip label="Mode" value={autoTune.enabled ? "Auto" : "Manual"} active={autoTune.enabled} />
          <Wire />
          <Chip label="Data" value={dataConfig.targetColumn || "—"} active />
          <Wire />
          <Chip label="Window" value={`${dataConfig.lookback}→${dataConfig.horizon}`} active />
          <Wire />
          <Chip label="Model" value={archType.toUpperCase()} active />
          <Wire />
          <Chip label="Functions" value={enabledCount} active={enabledCount > 0} />
          <Wire />
          <Chip label="Output" value=".pth" active={status === "done"} />
        </div>

        <div className="flex flex-col gap-5">
          <Module n="01" title="Data & window">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Target column (y)">
                <input className={inputCls} value={dataConfig.targetColumn} onChange={setData("targetColumn")} />
              </Field>
              <Field label="Scaler">
                <select className={inputCls} value={dataConfig.scaler} onChange={setData("scaler")}>
                  <option value="standard">Standard</option>
                  <option value="minmax">Min-max</option>
                  <option value="none">None</option>
                </select>
              </Field>
              <Field label="Feature columns (x)" full>
                <input className={inputCls} value={dataConfig.featureColumns} onChange={setData("featureColumns")} />
              </Field>
              <Field label="Lookback window">
                <input type="number" min="1" className={inputCls} value={dataConfig.lookback} onChange={setData("lookback")} />
              </Field>
              <Field label="Forecast horizon">
                <input type="number" min="1" className={inputCls} value={dataConfig.horizon} onChange={setData("horizon")} />
              </Field>
              <Field label="Train split %">
                <input type="number" min="0" max="100" className={inputCls} value={dataConfig.trainSplit} onChange={setData("trainSplit")} />
              </Field>
              <Field label="Val split %">
                <input type="number" min="0" max="100" className={inputCls} value={dataConfig.valSplit} onChange={setData("valSplit")} />
              </Field>
              <div className="col-span-2 text-xs text-zinc-500" style={{ fontFamily: "ui-monospace, monospace" }}>
                Test split: {testSplit}%
              </div>
            </div>
          </Module>

          <Module n="02" title="Architecture" accent={mode === "auto" ? "cyan" : undefined}>
            <div className="flex flex-col gap-3">
              <Field label="Model type">
                <select className={inputCls} value={archType} onChange={(e: ChangeEvent<HTMLSelectElement>) => setArchType(e.target.value as ArchType)}>
                  {MODEL_TYPES.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </Field>

              {archType === "nbeats" && hasExogenous && (
                <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>N-BEATS is univariate by design — the extra feature columns you listed will be ignored unless you're using an N-BEATSx variant that accepts exogenous inputs.</span>
                </div>
              )}

              <FieldGrid
                fields={ARCH_FIELDS[archType]}
                mode={mode}
                params={archParams[archType]}
                onParam={updateArchParam}
                search={archSearch[archType]}
                onSearch={updateArchSearch}
              />
            </div>
          </Module>

          <Module n="03" title="Training" accent={mode === "auto" ? "cyan" : undefined}>
            <FieldGrid fields={TRAINING_FIELDS} mode={mode} params={trainingParams} onParam={updateTrainingParam} search={trainingSearch} onSearch={updateTrainingSearch} />
          </Module>

          {autoTune.enabled && (
            <Module n="04" title="Auto-tune (Optuna)" accent="cyan">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Trials">
                  <input type="number" min="1" className={inputCls} value={autoTune.trials} onChange={(e: ChangeEvent<HTMLInputElement>) => setAutoTune((a) => ({ ...a, trials: Number(e.target.value) }))} />
                </Field>
                <Field label="Metric to minimize">
                  <select className={inputCls} value={autoTune.metric} onChange={(e: ChangeEvent<HTMLSelectElement>) => setAutoTune((a) => ({ ...a, metric: e.target.value as AutoTuneConfig["metric"] }))}>
                    <option value="val_loss">Validation loss</option>
                    <option value="mae">MAE</option>
                    <option value="rmse">RMSE</option>
                  </select>
                </Field>
                <Field label="Timeout (minutes)">
                  <input type="number" min="1" className={inputCls} value={autoTune.timeoutMin} onChange={(e: ChangeEvent<HTMLInputElement>) => setAutoTune((a) => ({ ...a, timeoutMin: Number(e.target.value) }))} />
                </Field>
              </div>
              <p className="text-xs text-zinc-500 mt-3">
                Ranges and candidate values set above (Architecture, Training) define the search space. Each trial trains once and reports {autoTune.metric.replace("_", " ")}; the best trial's params become the exported checkpoint.
              </p>
            </Module>
          )}

          <Module n={autoTune.enabled ? "05" : "04"} title="Custom functions">
            <div className="flex flex-col gap-3">
              {functions.map((fn) => (
                <div key={fn.id} className="rounded border border-zinc-800 bg-zinc-950 p-3">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <input className={inputCls + " flex-1 min-w-32"} value={fn.name} onChange={(e: ChangeEvent<HTMLInputElement>) => updateFunction(fn.id, { name: e.target.value })} />
                    <select className={inputCls + " w-40"} value={fn.type} onChange={(e: ChangeEvent<HTMLSelectElement>) => updateFunction(fn.id, { type: e.target.value as FnKind })}>
                      {FN_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => updateFunction(fn.id, { code: TEMPLATES[fn.type] })}
                      className="text-xs px-2 py-1.5 rounded border border-zinc-800 text-zinc-400 hover:text-cyan-400 hover:border-cyan-500/50"
                    >
                      Use template
                    </button>
                    <label className="flex items-center gap-1.5 text-xs text-zinc-400 ml-auto">
                      <input type="checkbox" checked={fn.enabled} onChange={(e: ChangeEvent<HTMLInputElement>) => updateFunction(fn.id, { enabled: e.target.checked })} className="accent-amber-500" />
                      Enabled
                    </label>
                    <button type="button" onClick={() => removeFunction(fn.id)} className="text-zinc-500 hover:text-rose-400 p-1.5" aria-label={`Remove ${fn.name}`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <textarea
                    className={inputCls + " resize-y"}
                    style={{ fontFamily: "ui-monospace, monospace" }}
                    rows={4}
                    value={fn.code}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updateFunction(fn.id, { code: e.target.value })}
                    spellCheck={false}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={addFunction}
                className="self-start flex items-center gap-1.5 text-sm px-3 py-1.5 rounded border border-dashed border-zinc-700 text-zinc-400 hover:text-amber-400 hover:border-amber-500/50"
              >
                <Plus size={15} /> Add function
              </button>
            </div>
          </Module>

          <div className="rounded-md bg-zinc-900 border border-zinc-800 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={startTraining}
                disabled={status === "training"}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "training" ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                {status === "training" ? (autoTune.enabled ? "Searching…" : "Training…") : autoTune.enabled ? "Run search" : "Train model"}
              </button>
              {status === "training" && (
                <div className="flex-1 flex flex-col gap-1">
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-cyan-500 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  {autoTune.enabled && trialInfo && (
                    <span className="text-xs text-zinc-500" style={{ fontFamily: "ui-monospace, monospace" }}>
                      Trial {trialInfo.trial}/{trialInfo.total}
                      {trialInfo.best != null ? ` — best ${autoTune.metric}: ${trialInfo.best.toFixed(4)}` : ""}
                    </span>
                  )}
                </div>
              )}
            </div>

            {artifact && (
              <div className="flex flex-col gap-2 rounded border border-emerald-700/40 bg-emerald-500/5 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-zinc-200">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{artifact.filename}</span>
                    <span className="text-zinc-500">· {artifact.sizeKB} KB</span>
                  </div>
                  <button
                    type="button"
                    onClick={downloadArtifact}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-zinc-700 text-zinc-200 hover:border-cyan-500/50 hover:text-cyan-400"
                  >
                    <Download size={14} /> Download
                  </button>
                </div>
                {artifact.bestParams && (
                  <div className="text-xs text-zinc-400" style={{ fontFamily: "ui-monospace, monospace" }}>
                    best {autoTune.metric}: {artifact.bestMetric?.toFixed(4)} ·{" "}
                    {Object.entries(artifact.bestParams.arch).map(([k, v]) => `${k}=${v}`).join(" · ")} ·{" "}
                    {Object.entries(artifact.bestParams.training).map(([k, v]) => `${k}=${v}`).join(" · ")}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}