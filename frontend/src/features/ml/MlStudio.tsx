import React, { useEffect, useRef, useState } from 'react';
import {
  Brain,
  Cloud,
  Layers,
  Sparkles,
  TrendingUp,
  Download,
  Play,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Server,
  Zap,
  Activity,
  BarChart3,
  RefreshCw,
  Cpu,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  Compass,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  batchPredict,
  deleteModel,
  explainPrediction,
  getDownloadModelUrl,
  getModelDetails,
  listModels,
  listTimeSeriesModels,
  predict,
  trainModel,
  trainTimeSeries,
} from '@/services/mlService';
import {
  deleteSageMakerEndpoint,
  deploySageMakerEndpoint,
  getDownloadSageMakerBundleUrl,
  getSageMakerStatus,
  invokeSageMakerEndpoint,
  launchSageMakerTraining,
  listSageMakerEndpoints,
  listSageMakerJobs,
  updateSageMakerConfig,
} from '@/services/sagemakerService';
import { getSampleDataset, profileDataset } from '@/services/datasetService';
import type {
  DatasetProfile,
  ModelListEntry,
  SageMakerEndpoint,
  SageMakerJob,
  SageMakerStatus,
  TimeSeriesResult,
  TrainingResult,
} from '@/services/types';

type StudioTab = 'tabular' | 'timeseries' | 'sagemaker' | 'registry';

export default function MlStudio() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<StudioTab>('tabular');

  // ── Tabular State ──
  const tabularFileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [datasetProfile, setDatasetProfile] = useState<DatasetProfile | null>(null);
  const [targetColumn, setTargetColumn] = useState<string>('');
  const [taskOverride, setTaskOverride] = useState<string>('');
  const [nTrials, setNTrials] = useState<number>(15);
  const [cvFolds, setCvFolds] = useState<number>(5);
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([
    'random_forest',
    'gradient_boosting',
    'hist_gradient_boosting',
    'extra_trees',
    'logistic_regression',
  ]);
  const [isTrainingTabular, setIsTrainingTabular] = useState<boolean>(false);
  const [tabularResult, setTabularResult] = useState<TrainingResult | null>(null);
  const [singlePredictInput, setSinglePredictInput] = useState<string>('{}');
  const [singlePredictResult, setSinglePredictResult] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<any>(null);

  // ── Time Series State ──
  const tsFileRef = useRef<HTMLInputElement>(null);
  const [tsFile, setTsFile] = useState<File | null>(null);
  const [tsTarget, setTsTarget] = useState<string>('server_requests');
  const [tsTimeCol, setTsTimeCol] = useState<string>('timestamp');
  const [tsArch, setTsArch] = useState<string>('lstm');
  const [tsLookback, setTsLookback] = useState<number>(24);
  const [tsHorizon, setTsHorizon] = useState<number>(6);
  const [tsScaler, setTsScaler] = useState<string>('standard');
  const [tsEpochs, setTsEpochs] = useState<number>(25);
  const [isTrainingTs, setIsTrainingTs] = useState<boolean>(false);
  const [tsResult, setTsResult] = useState<TimeSeriesResult | null>(null);
  const [tsModels, setTsModels] = useState<TimeSeriesResult[]>([]);

  // ── SageMaker State ──
  const [smStatus, setSmStatus] = useState<SageMakerStatus | null>(null);
  const [smJobs, setSmJobs] = useState<SageMakerJob[]>([]);
  const [smEndpoints, setSmEndpoints] = useState<SageMakerEndpoint[]>([]);
  const [smRegion, setSmRegion] = useState<string>('us-east-1');
  const [smBucket, setSmBucket] = useState<string>('tarq-ml-artifacts');
  const [smRole, setSmRole] = useState<string>('arn:aws:iam::123456789012:role/TarQSageMakerExecutionRole');
  const [smSimMode, setSmSimMode] = useState<boolean>(true);
  const [smAccessKey, setSmAccessKey] = useState<string>('');
  const [smSecretKey, setSmSecretKey] = useState<string>('');
  const [smDeployModelId, setSmDeployModelId] = useState<string>('');
  const [smEndpointName, setSmEndpointName] = useState<string>('tarq-prod-endpoint');
  const [smInstanceType, setSmInstanceType] = useState<string>('ml.m5.large');
  const [isDeployingSm, setIsDeployingSm] = useState<boolean>(false);
  const [isTrainingSm, setIsTrainingSm] = useState<boolean>(false);
  const [invokeOutput, setInvokeOutput] = useState<any>(null);

  // ── Registry State ──
  const [registeredModels, setRegisteredModels] = useState<ModelListEntry[]>([]);
  const [registryFilter, setRegistryFilter] = useState<string>('all');

  const refreshRegistry = () => {
    listModels().then(setRegisteredModels).catch(() => {});
    listTimeSeriesModels().then(setTsModels).catch(() => {});
  };

  const refreshSageMaker = () => {
    getSageMakerStatus().then((s) => {
      setSmStatus(s);
      setSmRegion(s.region);
      setSmBucket(s.s3_bucket);
      setSmRole(s.role_arn);
      setSmSimMode(s.simulation_mode);
    }).catch(() => {});
    listSageMakerJobs().then(setSmJobs).catch(() => {});
    listSageMakerEndpoints().then(setSmEndpoints).catch(() => {});
  };

  useEffect(() => {
    refreshRegistry();
    refreshSageMaker();
  }, []);

  // ── Sample Dataset Loader ──
  const handleLoadSample = async (type: 'classification' | 'regression' | 'timeseries') => {
    try {
      const sample = await getSampleDataset(type);
      const blob = new Blob([sample.csv_data], { type: 'text/csv' });
      const file = new File([blob], `${sample.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.csv`, { type: 'text/csv' });

      if (type === 'timeseries') {
        setTsFile(file);
        setTsTarget(sample.target);
        setTsTimeCol('timestamp');
        toast({ title: 'Sample Loaded', description: `Loaded "${sample.name}" for Time Series forecasting.` });
      } else {
        setSelectedFile(file);
        setTargetColumn(sample.target);
        setTaskOverride(sample.task);
        setDatasetProfile(sample.profile);
        // Prep sample row for prediction
        if (sample.profile.preview && sample.profile.preview.length > 0) {
          const rowSample = { ...sample.profile.preview[0] };
          delete rowSample[sample.target];
          setSinglePredictInput(JSON.stringify(rowSample, null, 2));
        }
        toast({ title: 'Sample Loaded', description: `Loaded "${sample.name}" with ${sample.profile.rows} records.` });
      }
    } catch (err: any) {
      toast({ title: 'Failed to load sample', description: err.message, variant: 'destructive' });
    }
  };

  // ── Tabular File Upload & Profile ──
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    try {
      const profile = await profileDataset(file);
      setDatasetProfile(profile);
      if (profile.recommended_targets && profile.recommended_targets.length > 0) {
        setTargetColumn(profile.recommended_targets[0]);
      }
      if (profile.preview && profile.preview.length > 0) {
        const rowSample = { ...profile.preview[0] };
        if (profile.recommended_targets && profile.recommended_targets[0]) {
          delete rowSample[profile.recommended_targets[0]];
        }
        setSinglePredictInput(JSON.stringify(rowSample, null, 2));
      }
      toast({ title: 'Dataset Profiled', description: `Identified ${profile.columns_count} columns across ${profile.rows} rows.` });
    } catch (err: any) {
      toast({ title: 'Profiling Warning', description: err.message });
    }
  };

  // ── Tabular Train ──
  const handleTrainTabular = async () => {
    if (!selectedFile || !targetColumn.trim()) {
      toast({ title: 'Missing parameters', description: 'Please choose a dataset and specify the target column.', variant: 'destructive' });
      return;
    }
    setIsTrainingTabular(true);
    setTabularResult(null);
    setExplanation(null);
    try {
      const res = await trainModel(selectedFile, targetColumn.trim(), {
        task: taskOverride || undefined,
        nTrials,
        cv: cvFolds,
        families: selectedFamilies,
      });
      setTabularResult(res);
      setSmDeployModelId(res.model_id);
      refreshRegistry();
      toast({ title: 'Training Complete!', description: `Best candidate: ${res.best_model_name} (Score: ${res.best_score})` });
    } catch (err: any) {
      toast({ title: 'Training Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsTrainingTabular(false);
    }
  };

  // ── Single Row Prediction & Explanation ──
  const handlePredictSingle = async () => {
    if (!tabularResult) return;
    try {
      const row = JSON.parse(singlePredictInput);
      const rows = Array.isArray(row) ? row : [row];
      const preds = await predict(tabularResult.model_id, rows);
      setSinglePredictResult(JSON.stringify(preds));

      // Fetch explanation
      const exp = await explainPrediction(tabularResult.model_id, Array.isArray(row) ? row[0] : row);
      setExplanation(exp);
    } catch (err: any) {
      toast({ title: 'Prediction Error', description: err.message, variant: 'destructive' });
    }
  };

  // ── Batch Predict ──
  const handleBatchPredict = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tabularResult) return;
    try {
      const blob = await batchPredict(tabularResult.model_id, file);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tarq_predictions_${tabularResult.model_id}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast({ title: 'Batch Predictions Ready', description: 'Downloaded annotated predictions CSV.' });
    } catch (err: any) {
      toast({ title: 'Batch Prediction Failed', description: err.message, variant: 'destructive' });
    }
  };

  // ── Time Series Train ──
  const handleTrainTimeSeries = async () => {
    if (!tsFile || !tsTarget.trim()) {
      toast({ title: 'Missing parameters', description: 'Upload a CSV and specify the target time series column.', variant: 'destructive' });
      return;
    }
    setIsTrainingTs(true);
    setTsResult(null);
    try {
      const res = await trainTimeSeries(tsFile, tsTarget.trim(), {
        architecture: tsArch,
        lookback: tsLookback,
        horizon: tsHorizon,
        scaler: tsScaler,
        epochs: tsEpochs,
        timeColumn: tsTimeCol || undefined,
      });
      setTsResult(res);
      refreshRegistry();
      toast({ title: 'Forecasting Model Ready!', description: `Model ${res.model_id} trained. MAE: ${res.metrics.mae}` });
    } catch (err: any) {
      toast({ title: 'Time Series Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsTrainingTs(false);
    }
  };

  // ── SageMaker Config Save ──
  const handleSaveSmConfig = async () => {
    try {
      const updated = await updateSageMakerConfig({
        aws_access_key_id: smAccessKey || undefined,
        aws_secret_access_key: smSecretKey || undefined,
        region_name: smRegion,
        s3_bucket: smBucket,
        role_arn: smRole,
        simulation_mode: smSimMode,
      });
      setSmStatus(updated);
      toast({ title: 'AWS SageMaker Configuration Updated', description: `Running in ${updated.mode.toUpperCase()} mode.` });
    } catch (err: any) {
      toast({ title: 'Configuration Error', description: err.message, variant: 'destructive' });
    }
  };

  // ── SageMaker Remote Training ──
  const handleLaunchSmTrain = async () => {
    setIsTrainingSm(true);
    try {
      const job = await launchSageMakerTraining(targetColumn || 'target', {
        instanceType: smInstanceType,
        framework: 'scikit-learn',
        file: selectedFile || undefined,
      });
      refreshSageMaker();
      toast({ title: 'SageMaker Job Dispatched', description: `Job ${job.job_name} successfully initiated.` });
    } catch (err: any) {
      toast({ title: 'SageMaker Launch Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsTrainingSm(false);
    }
  };

  // ── SageMaker Deploy Endpoint ──
  const handleDeploySmEndpoint = async () => {
    if (!smEndpointName || !smDeployModelId) {
      toast({ title: 'Missing Fields', description: 'Provide an endpoint name and model ID to deploy.', variant: 'destructive' });
      return;
    }
    setIsDeployingSm(true);
    try {
      const ep = await deploySageMakerEndpoint(smEndpointName, smDeployModelId, smInstanceType);
      refreshSageMaker();
      toast({ title: 'Endpoint Deployed', description: `Endpoint ${ep.endpoint_name} is now ${ep.status}.` });
    } catch (err: any) {
      toast({ title: 'Deployment Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsDeployingSm(false);
    }
  };

  // ── SageMaker Invoke Endpoint ──
  const handleInvokeEndpoint = async (endpointName: string) => {
    try {
      const res = await invokeSageMakerEndpoint(endpointName, [{ feature1: 1.5, feature2: 2.8 }]);
      setInvokeOutput(res);
      refreshSageMaker();
      toast({ title: 'Endpoint Invocation Success', description: `Inference returned in ${res.latency_ms} ms.` });
    } catch (err: any) {
      toast({ title: 'Invocation Failed', description: err.message, variant: 'destructive' });
    }
  };

  // ── SageMaker Terminate Endpoint ──
  const handleDeleteEndpoint = async (endpointName: string) => {
    try {
      await deleteSageMakerEndpoint(endpointName);
      refreshSageMaker();
      toast({ title: 'Endpoint Terminated', description: `Endpoint ${endpointName} stopped to cease billing.` });
    } catch (err: any) {
      toast({ title: 'Termination Error', description: err.message, variant: 'destructive' });
    }
  };

  // ── Delete Registered Model ──
  const handleDeleteRegisteredModel = async (id: string) => {
    try {
      await deleteModel(id);
      refreshRegistry();
      toast({ title: 'Model Deleted', description: `Model ${id} removed from registry.` });
    } catch (err: any) {
      toast({ title: 'Delete Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Studio Header & Creative Director Vision ── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900/90 via-indigo-950/40 to-slate-900/90 p-6 backdrop-blur-xl shadow-2xl">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                TarQ · Next-Gen AutoML & Cloud Studio
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span>Machine Learning & SageMaker Hub</span>
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-xs py-0.5">
                v2.5 Enterprise
              </Badge>
            </h1>
            <p className="mt-1 text-sm text-slate-400 max-w-2xl">
              Bayesian AutoML hyperparameter search, deep time-series neural forecasting, model diagnostics,
              and seamless AWS SageMaker cloud training and real-time endpoint deployment.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3.5 py-2">
              <Server className="h-4 w-4 text-cyan-400" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">SageMaker Mode</span>
                <span className={`text-xs font-semibold ${smStatus?.mode === 'live_aws' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {smStatus?.mode === 'live_aws' ? 'Live Cloud (AWS)' : 'Simulation Sandbox'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs Navigation ── */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-4">
          {[
            { id: 'tabular', label: 'Tabular AutoML', icon: Brain, count: registeredModels.length },
            { id: 'timeseries', label: 'Time Series Studio', icon: TrendingUp, count: tsModels.length },
            { id: 'sagemaker', label: 'AWS SageMaker Hub', icon: Cloud, count: smEndpoints.length },
            { id: 'registry', label: 'Model Registry & Artifacts', icon: Layers, count: registeredModels.length + tsModels.length },
          ].map((tab) => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as StudioTab)}
                className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all duration-200 ${
                  active
                    ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-lg shadow-indigo-500/25 border border-cyan-400/30 scale-[1.02]'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800/60 border border-white/5'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* ── TAB 1: TABULAR AUTOML ── */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'tabular' && (
        <div className="space-y-6">
          {/* Dataset Ingestion & Configuration Card */}
          <Card className="p-6 border-white/10 bg-slate-900/70 backdrop-blur-md shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  <span>Dataset Selection & Experiment Parameters</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload custom tabular CSV data or load curated enterprise benchmarks.
                </p>
              </div>

              {/* Sample Dataset Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Quick Benchmark:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleLoadSample('classification')}
                  className="h-8 text-xs gap-1.5 bg-slate-800/60 border-cyan-500/30 hover:border-cyan-400 text-cyan-300"
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span>Customer Churn (Classif.)</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleLoadSample('regression')}
                  className="h-8 text-xs gap-1.5 bg-slate-800/60 border-indigo-500/30 hover:border-indigo-400 text-indigo-300"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>Property Price (Regr.)</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Upload CSV Dataset</label>
                <div className="flex items-center gap-2">
                  <input
                    ref={tabularFileRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/10 file:text-cyan-400 hover:file:bg-cyan-500/20 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Column</label>
                <Input
                  placeholder="e.g. churn or price"
                  value={targetColumn}
                  onChange={(e) => setTargetColumn(e.target.value)}
                  className="h-9 text-xs bg-slate-800/60 border-white/10 text-white focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Task Type</label>
                <select
                  value={taskOverride}
                  onChange={(e) => setTaskOverride(e.target.value)}
                  className="h-9 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 text-xs text-white outline-none focus:border-cyan-400"
                >
                  <option value="">Auto-Detect from Dtype</option>
                  <option value="classification">Classification</option>
                  <option value="regression">Regression</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Optuna Trials per Model</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={3}
                    max={60}
                    value={nTrials}
                    onChange={(e) => setNTrials(Number(e.target.value) || 15)}
                    className="h-9 w-24 text-xs bg-slate-800/60 border-white/10 text-white focus:border-cyan-400"
                  />
                  <Button
                    onClick={handleTrainTabular}
                    disabled={isTrainingTabular}
                    className="h-9 flex-1 gap-2 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:from-indigo-500 hover:to-cyan-500 shadow-md shadow-cyan-500/20 font-semibold text-xs"
                  >
                    {isTrainingTabular ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Run AutoML</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Candidate Model Families Selectors */}
            <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400 mr-2">Candidate Model Families:</span>
              {[
                { id: 'random_forest', label: 'Random Forest' },
                { id: 'gradient_boosting', label: 'Gradient Boosting' },
                { id: 'hist_gradient_boosting', label: 'Hist Gradient (Fast)' },
                { id: 'extra_trees', label: 'Extra Trees' },
                { id: 'neural_network', label: 'MLP Neural Net' },
                { id: 'logistic_regression', label: 'Linear/Logistic' },
              ].map((fam) => {
                const checked = selectedFamilies.includes(fam.id);
                return (
                  <button
                    key={fam.id}
                    type="button"
                    onClick={() => {
                      setSelectedFamilies((prev) =>
                        checked ? prev.filter((f) => f !== fam.id) : [...prev, fam.id]
                      );
                    }}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium border transition-colors ${
                      checked
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                        : 'bg-slate-800/30 border-white/5 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {checked ? '✓ ' : '+ '}{fam.label}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Dataset Profile Viewer if profiled */}
          {datasetProfile && (
            <Card className="p-5 border-white/10 bg-slate-900/50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-cyan-400" />
                  <span>Exploratory Data Health ({datasetProfile.rows} rows · {datasetProfile.columns_count} columns)</span>
                </h4>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                    {datasetProfile.numeric_columns.length} Numeric Features
                  </Badge>
                  <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[10px]">
                    {datasetProfile.categorical_columns.length} Categorical Features
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                {datasetProfile.columns.map((c) => (
                  <div key={c.name} className="rounded-lg border border-white/5 bg-black/30 p-2.5">
                    <div className="truncate text-xs font-semibold text-white" title={c.name}>{c.name}</div>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                      <span>{c.semantic_type}</span>
                      <span className={c.null_pct > 0 ? 'text-amber-400' : 'text-slate-500'}>
                        {c.null_pct}% null
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Results, Diagnostics & Leaderboard */}
          {tabularResult && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Leaderboard & Metric Summary */}
              <Card className="lg:col-span-2 p-6 border-white/10 bg-slate-900/70 backdrop-blur-md space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <h3 className="text-base font-bold text-white">Winning Model: {tabularResult.best_model_name}</h3>
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                        {tabularResult.task.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {tabularResult.summary}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-slate-400 uppercase font-semibold">Best {tabularResult.metric}</div>
                      <div className="text-xl font-extrabold text-cyan-400">{tabularResult.best_score.toFixed(4)}</div>
                    </div>
                    <a
                      href={getDownloadModelUrl(tabularResult.model_id)}
                      download
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download Bundle</span>
                    </a>
                  </div>
                </div>

                {/* Optuna Leaderboard Table */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">Optuna Study Leaderboard</h4>
                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <Table>
                      <TableHeader className="bg-black/40">
                        <TableRow>
                          <TableHead className="text-xs text-slate-300">Rank & Candidate</TableHead>
                          <TableHead className="text-xs text-slate-300">Score ({tabularResult.metric})</TableHead>
                          <TableHead className="text-xs text-slate-300">CV Trials</TableHead>
                          <TableHead className="text-xs text-slate-300">Key Hyperparameters</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tabularResult.leaderboard.map((entry, idx) => (
                          <TableRow
                            key={entry.name}
                            className={entry.name === tabularResult.best_model_name ? 'bg-cyan-500/10 border-l-2 border-l-cyan-400' : ''}
                          >
                            <TableCell className="font-semibold text-xs text-white flex items-center gap-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-slate-300 font-bold">
                                #{idx + 1}
                              </span>
                              <span>{entry.name}</span>
                            </TableCell>
                            <TableCell className="text-xs font-mono font-bold text-cyan-300">
                              {entry.best_score.toFixed(4)}
                            </TableCell>
                            <TableCell className="text-xs text-slate-400">{entry.n_trials}</TableCell>
                            <TableCell className="text-[11px] text-slate-300 font-mono">
                              {Object.entries(entry.best_params)
                                .slice(0, 3)
                                .map(([k, v]) => `${k}=${typeof v === 'number' ? (v < 1 && v > 0 ? v.toFixed(3) : v) : v}`)
                                .join(', ')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Feature Importance Ranked Bars */}
                {Object.keys(tabularResult.feature_importance).length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                      Global Feature Importance (Permutation / Tree Gain)
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(tabularResult.feature_importance).slice(0, 7).map(([feat, imp]) => (
                        <div key={feat} className="flex items-center gap-3">
                          <span className="text-xs font-medium text-slate-300 w-36 truncate" title={feat}>
                            {feat}
                          </span>
                          <div className="flex-1 h-3 rounded-full bg-slate-800/80 overflow-hidden border border-white/5">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(5, imp * 100))}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-cyan-400 w-12 text-right">
                            {(imp * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              {/* Inference Playground & Diagnostics Card */}
              <Card className="p-6 border-white/10 bg-slate-900/70 backdrop-blur-md space-y-5 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-cyan-400" />
                    <span>Live Inference Console</span>
                  </h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Test immediate predictions or execute bulk batch CSV transformations.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Input JSON Payload
                      </label>
                      <textarea
                        rows={5}
                        value={singlePredictInput}
                        onChange={(e) => setSinglePredictInput(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-black/40 p-2.5 font-mono text-xs text-cyan-300 outline-none focus:border-cyan-400"
                      />
                    </div>

                    <Button
                      onClick={handlePredictSingle}
                      className="w-full h-8 text-xs bg-slate-800 hover:bg-slate-700 text-white font-semibold"
                    >
                      Generate Real-Time Prediction
                    </Button>

                    {singlePredictResult && (
                      <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-3">
                        <span className="text-[10px] uppercase font-bold text-cyan-400">Prediction Output</span>
                        <div className="text-sm font-bold text-white font-mono mt-0.5">{singlePredictResult}</div>
                      </div>
                    )}

                    {explanation && explanation.top_features && (
                      <div className="rounded-lg border border-white/10 bg-black/40 p-3 space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Feature Contribution Attribution</span>
                        {explanation.top_features.slice(0, 4).map((f: any) => (
                          <div key={f.feature} className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 truncate w-24">{f.feature}</span>
                            <span className={f.contribution >= 0 ? 'text-emerald-400 font-mono' : 'text-rose-400 font-mono'}>
                              {f.contribution >= 0 ? `+${f.contribution}` : f.contribution}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Batch Predictions Section */}
                <div className="pt-4 border-t border-white/10">
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Batch Prediction Upload
                  </label>
                  <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-slate-800/40 p-2.5 text-xs text-slate-300 hover:border-cyan-400 cursor-pointer transition-colors">
                    <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
                    <span>Select CSV to predict & export</span>
                    <input type="file" accept=".csv" onChange={handleBatchPredict} className="hidden" />
                  </label>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* ── TAB 2: TIME SERIES FORECASTING STUDIO ── */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'timeseries' && (
        <div className="space-y-6">
          <Card className="p-6 border-white/10 bg-slate-900/70 backdrop-blur-md shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-cyan-400" />
                  <span>Deep Temporal Forecasting Studio</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Multi-horizon neural sequence models (LSTM, GRU, TCN, Transformer, N-BEATS).
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleLoadSample('timeseries')}
                className="h-8 text-xs gap-1.5 bg-slate-800/60 border-cyan-500/30 hover:border-cyan-400 text-cyan-300"
              >
                <Cpu className="h-3.5 w-3.5" />
                <span>Load Cloud Traffic Benchmark</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Time Series Dataset (.csv)</label>
                <input
                  ref={tsFileRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => setTsFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/10 file:text-cyan-400 hover:file:bg-cyan-500/20 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Metric Column</label>
                <Input
                  value={tsTarget}
                  onChange={(e) => setTsTarget(e.target.value)}
                  placeholder="e.g. server_requests"
                  className="h-9 text-xs bg-slate-800/60 border-white/10 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Architecture Family</label>
                <select
                  value={tsArch}
                  onChange={(e) => setTsArch(e.target.value)}
                  className="h-9 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 text-xs text-white outline-none focus:border-cyan-400"
                >
                  <option value="lstm">LSTM (Long Short-Term Memory)</option>
                  <option value="gru">GRU (Gated Recurrent Unit)</option>
                  <option value="transformer">Temporal Attention Transformer</option>
                  <option value="tcn">TCN (Temporal Convolutional)</option>
                  <option value="nbeats">N-BEATS (Interpretable Basis)</option>
                  <option value="gradient_boosting">Autoregressive Gradient Boost</option>
                </select>
              </div>

              <div>
                <Button
                  onClick={handleTrainTimeSeries}
                  disabled={isTrainingTs}
                  className="w-full h-9 gap-2 bg-gradient-to-r from-cyan-600 to-indigo-600 text-white hover:from-cyan-500 hover:to-indigo-500 font-semibold text-xs shadow-md shadow-cyan-500/20"
                >
                  {isTrainingTs ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Training Neural Forecaster...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Train & Generate Forecast</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Sliders for lookback and horizon */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-3 border-t border-white/5">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Lookback Window (Input Lag)</span>
                  <span className="font-mono text-cyan-400">{tsLookback} steps</span>
                </div>
                <input
                  type="range"
                  min={6}
                  max={48}
                  step={2}
                  value={tsLookback}
                  onChange={(e) => setTsLookback(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Forecast Horizon (Lead Steps)</span>
                  <span className="font-mono text-cyan-400">{tsHorizon} steps</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={14}
                  value={tsHorizon}
                  onChange={(e) => setTsHorizon(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Epochs</span>
                  <span className="font-mono text-cyan-400">{tsEpochs}</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={60}
                  step={5}
                  value={tsEpochs}
                  onChange={(e) => setTsEpochs(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>
          </Card>

          {/* Time Series Result View */}
          {tsResult && (
            <div className="space-y-6">
              {/* Metrics Banner */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 border-white/10 bg-slate-900/60">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Mean Absolute Error (MAE)</div>
                  <div className="text-2xl font-bold text-cyan-400 mt-1">{tsResult.metrics.mae}</div>
                </Card>
                <Card className="p-4 border-white/10 bg-slate-900/60">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Root Mean Square Error (RMSE)</div>
                  <div className="text-2xl font-bold text-indigo-400 mt-1">{tsResult.metrics.rmse}</div>
                </Card>
                <Card className="p-4 border-white/10 bg-slate-900/60">
                  <div className="text-[10px] uppercase font-bold text-slate-400">SMAPE Error</div>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">{tsResult.metrics.smape}%</div>
                </Card>
                <Card className="p-4 border-white/10 bg-slate-900/60">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Directional Accuracy</div>
                  <div className="text-2xl font-bold text-amber-400 mt-1">{tsResult.metrics.directional_accuracy}%</div>
                </Card>
              </div>

              {/* Multi-Step Forecast Display Table */}
              <Card className="p-6 border-white/10 bg-slate-900/70 backdrop-blur-md">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-cyan-400" />
                  <span>Out-of-Sample Horizon Projections</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {tsResult.future_forecast.map((pt) => (
                    <div key={pt.step} className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 text-center">
                      <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">{pt.step}</div>
                      <div className="text-lg font-extrabold text-white font-mono mt-1">{pt.forecast}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        [{pt.lower_bound} — {pt.upper_bound}]
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Loss Trajectory */}
              <Card className="p-6 border-white/10 bg-slate-900/70 backdrop-blur-md">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                  Epoch Loss Convergence ({tsResult.architecture.toUpperCase()})
                </h4>
                <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
                    <span>Train Loss</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-400" />
                    <span>Validation Loss</span>
                  </div>
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5 text-center text-[10px] font-mono">
                  {tsResult.loss_history.slice(0, 20).map((l) => (
                    <div key={l.epoch} className="rounded bg-black/30 p-1.5 border border-white/5">
                      <div className="text-slate-500">ep {l.epoch}</div>
                      <div className="text-cyan-400 font-bold">{l.train_loss}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* ── TAB 3: AWS SAGEMAKER CLOUD HUB ── */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'sagemaker' && (
        <div className="space-y-6">
          {/* Cloud Connection & Credentials Configuration */}
          <Card className="p-6 border-white/10 bg-slate-900/70 backdrop-blur-md shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <Cloud className="h-5 w-5 text-cyan-400" />
                <div>
                  <h3 className="text-base font-bold text-white">AWS SageMaker Cloud Orchestration</h3>
                  <p className="text-xs text-slate-400">Configure AWS IAM credentials, S3 bucket storage, and target cloud region.</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smSimMode}
                    onChange={(e) => setSmSimMode(e.target.checked)}
                    className="accent-cyan-400 rounded"
                  />
                  <span>Simulation Sandbox Mode</span>
                </label>
                <Button
                  onClick={handleSaveSmConfig}
                  size="sm"
                  className="h-8 text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                >
                  Save AWS Settings
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">AWS Region</label>
                <select
                  value={smRegion}
                  onChange={(e) => setSmRegion(e.target.value)}
                  className="h-9 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 text-xs text-white outline-none focus:border-cyan-400"
                >
                  <option value="us-east-1">US East (N. Virginia) us-east-1</option>
                  <option value="us-west-2">US West (Oregon) us-west-2</option>
                  <option value="eu-west-1">Europe (Ireland) eu-west-1</option>
                  <option value="eu-central-1">Europe (Frankfurt) eu-central-1</option>
                  <option value="ap-south-1">Asia Pacific (Mumbai) ap-south-1</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">S3 Artifact Bucket</label>
                <Input
                  value={smBucket}
                  onChange={(e) => setSmBucket(e.target.value)}
                  className="h-9 text-xs bg-slate-800/60 border-white/10 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">SageMaker Execution Role ARN</label>
                <Input
                  value={smRole}
                  onChange={(e) => setSmRole(e.target.value)}
                  className="h-9 text-xs bg-slate-800/60 border-white/10 text-white"
                />
              </div>
            </div>

            {!smSimMode && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-3 border-t border-white/5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">AWS Access Key ID</label>
                  <Input
                    type="password"
                    value={smAccessKey}
                    onChange={(e) => setSmAccessKey(e.target.value)}
                    placeholder="AKIA..."
                    className="h-9 text-xs bg-slate-800/60 border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">AWS Secret Access Key</label>
                  <Input
                    type="password"
                    value={smSecretKey}
                    onChange={(e) => setSmSecretKey(e.target.value)}
                    placeholder="••••••••••••"
                    className="h-9 text-xs bg-slate-800/60 border-white/10 text-white"
                  />
                </div>
              </div>
            )}
          </Card>

          {/* Cloud Training Dispatch & Real-Time Endpoints Fleet */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Deploy Endpoint Card */}
            <Card className="p-6 border-white/10 bg-slate-900/70 backdrop-blur-md space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Server className="h-4 w-4 text-cyan-400" />
                <span>Deploy Real-Time SageMaker Endpoint</span>
              </h3>
              <p className="text-xs text-slate-400">
                Deploy any registered TarQ model to an HTTPS SageMaker inference endpoint.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Select Model to Deploy</label>
                  <select
                    value={smDeployModelId}
                    onChange={(e) => setSmDeployModelId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 text-xs text-white outline-none focus:border-cyan-400"
                  >
                    <option value="">-- Choose registered model --</option>
                    {registeredModels.map((m) => (
                      <option key={m.model_id} value={m.model_id}>
                        {m.model_id} ({m.best_model_name} - {m.task})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Endpoint Name</label>
                    <Input
                      value={smEndpointName}
                      onChange={(e) => setSmEndpointName(e.target.value)}
                      className="h-9 text-xs bg-slate-800/60 border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">EC2 Instance Type</label>
                    <select
                      value={smInstanceType}
                      onChange={(e) => setSmInstanceType(e.target.value)}
                      className="h-9 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 text-xs text-white outline-none"
                    >
                      <option value="ml.m5.large">ml.m5.large (2 vCPU, 8 GB)</option>
                      <option value="ml.m5.xlarge">ml.m5.xlarge (4 vCPU, 16 GB)</option>
                      <option value="ml.c5.xlarge">ml.c5.xlarge (Compute Optimized)</option>
                      <option value="ml.g4dn.xlarge">ml.g4dn.xlarge (GPU T4)</option>
                    </select>
                  </div>
                </div>

                <Button
                  onClick={handleDeploySmEndpoint}
                  disabled={isDeployingSm}
                  className="w-full h-9 bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-semibold text-xs gap-2"
                >
                  {isDeployingSm ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  <span>Provision & Deploy Cloud Endpoint</span>
                </Button>
              </div>
            </Card>

            {/* Launch Cloud Training Job Card */}
            <Card className="p-6 border-white/10 bg-slate-900/70 backdrop-blur-md space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="h-4 w-4 text-indigo-400" />
                <span>Launch SageMaker Remote Training Job</span>
              </h3>
              <p className="text-xs text-slate-400">
                Dispatch training workloads to elastic cloud compute clusters with automatic S3 artifact checkpointing.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Target Prediction Column</label>
                  <Input
                    value={targetColumn || 'target'}
                    onChange={(e) => setTargetColumn(e.target.value)}
                    className="h-9 text-xs bg-slate-800/60 border-white/10 text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Training Compute Instance</label>
                  <select
                    value={smInstanceType}
                    onChange={(e) => setSmInstanceType(e.target.value)}
                    className="h-9 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 text-xs text-white outline-none"
                  >
                    <option value="ml.m5.xlarge">ml.m5.xlarge (Standard Cloud Worker)</option>
                    <option value="ml.c5.2xlarge">ml.c5.2xlarge (High Throughput)</option>
                    <option value="ml.g4dn.xlarge">ml.g4dn.xlarge (NVIDIA T4 Tensor Core)</option>
                  </select>
                </div>

                <Button
                  onClick={handleLaunchSmTrain}
                  disabled={isTrainingSm}
                  className="w-full h-9 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs gap-2"
                >
                  {isTrainingSm ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  <span>Dispatch SageMaker Training Job</span>
                </Button>
              </div>
            </Card>
          </div>

          {/* Active Real-Time Endpoints Table */}
          <Card className="p-6 border-white/10 bg-slate-900/70 backdrop-blur-md">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
              <Server className="h-4 w-4 text-emerald-400" />
              <span>Active SageMaker Inference Fleet ({smEndpoints.length})</span>
            </h4>

            {smEndpoints.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-black/30 p-8 text-center text-xs text-slate-500">
                No active endpoints deployed. Select a registered model above to provision one.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <Table>
                  <TableHeader className="bg-black/40">
                    <TableRow>
                      <TableHead className="text-xs text-slate-300">Endpoint Name</TableHead>
                      <TableHead className="text-xs text-slate-300">Status</TableHead>
                      <TableHead className="text-xs text-slate-300">Instance</TableHead>
                      <TableHead className="text-xs text-slate-300">Avg Latency</TableHead>
                      <TableHead className="text-xs text-slate-300">Invocations</TableHead>
                      <TableHead className="text-xs text-slate-300 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {smEndpoints.map((ep) => (
                      <TableRow key={ep.endpoint_name}>
                        <TableCell className="font-semibold text-xs text-white font-mono">{ep.endpoint_name}</TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                            {ep.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-300 font-mono">{ep.instance_type}</TableCell>
                        <TableCell className="text-xs text-cyan-300 font-mono">{ep.average_latency_ms} ms</TableCell>
                        <TableCell className="text-xs text-slate-400">{ep.invocation_count}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleInvokeEndpoint(ep.endpoint_name)}
                              className="h-7 text-[11px] bg-slate-800/60 border-white/10 hover:border-cyan-400 text-cyan-300"
                            >
                              Test Ping
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteEndpoint(ep.endpoint_name)}
                              className="h-7 text-[11px] bg-rose-950/60 border-rose-500/30 hover:bg-rose-900 text-rose-300"
                            >
                              Teardown
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {invokeOutput && (
              <div className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3">
                <span className="text-[10px] uppercase font-bold text-cyan-400">Latest Live Test Result</span>
                <div className="text-xs font-mono text-white mt-1">
                  Latency: {invokeOutput.latency_ms}ms · Output: {JSON.stringify(invokeOutput.predictions)}
                </div>
              </div>
            )}
          </Card>

          {/* SageMaker Jobs History */}
          <Card className="p-6 border-white/10 bg-slate-900/70 backdrop-blur-md">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-400" />
              <span>SageMaker Cloud Training History ({smJobs.length})</span>
            </h4>

            {smJobs.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-black/30 p-8 text-center text-xs text-slate-500">
                No cloud jobs dispatched yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <Table>
                  <TableHeader className="bg-black/40">
                    <TableRow>
                      <TableHead className="text-xs text-slate-300">Job Identifier</TableHead>
                      <TableHead className="text-xs text-slate-300">Status</TableHead>
                      <TableHead className="text-xs text-slate-300">Instance</TableHead>
                      <TableHead className="text-xs text-slate-300">Duration</TableHead>
                      <TableHead className="text-xs text-slate-300">Artifact S3 Destination</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {smJobs.map((j) => (
                      <TableRow key={j.job_name}>
                        <TableCell className="font-semibold text-xs text-white font-mono">{j.job_name}</TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                            {j.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-300 font-mono">{j.instance_type}</TableCell>
                        <TableCell className="text-xs text-slate-400">{j.billable_seconds}s billable</TableCell>
                        <TableCell className="text-xs font-mono text-cyan-400 truncate max-w-xs">{j.output_s3_uri}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* ── TAB 4: MODEL REGISTRY & ARTIFACT VAULT ── */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'registry' && (
        <div className="space-y-6">
          <Card className="p-6 border-white/10 bg-slate-900/70 backdrop-blur-md shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-5">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan-400" />
                  <span>Model Artifacts & Deployment Vault</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Inspect, download standalone Python inference bundles, and generate SageMaker container images.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {['all', 'classification', 'regression'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setRegistryFilter(f)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize border transition-colors ${
                      registryFilter === f
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                        : 'bg-slate-800/40 border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {registeredModels.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-black/30 p-12 text-center">
                <Brain className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">No trained models in registry yet</p>
                <p className="text-xs text-slate-500 mt-1">Run Tabular AutoML or Time Series training above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {registeredModels
                  .filter((m) => registryFilter === 'all' || m.task === registryFilter)
                  .map((m) => (
                    <Card
                      key={m.model_id}
                      className="p-5 border-white/10 bg-slate-900/80 backdrop-blur-md flex flex-col justify-between space-y-4 hover:border-cyan-500/40 transition-colors"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-slate-400 font-semibold">{m.model_id}</span>
                          <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px]">
                            {m.task}
                          </Badge>
                        </div>
                        <h4 className="text-base font-bold text-white mt-1.5">{m.best_model_name}</h4>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                          <span>Target: <strong className="text-slate-200">{m.target}</strong></span>
                          <span>Score: <strong className="text-cyan-400 font-mono">{m.best_score.toFixed(4)}</strong></span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                        <a
                          href={getDownloadModelUrl(m.model_id)}
                          download
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
                        >
                          <Download className="h-3 w-3" />
                          <span>Zip Bundle</span>
                        </a>

                        <a
                          href={getDownloadSageMakerBundleUrl(m.model_id)}
                          download
                          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-900/40 transition-colors"
                        >
                          <Cloud className="h-3 w-3" />
                          <span>SageMaker .tar.gz</span>
                        </a>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteRegisteredModel(m.model_id)}
                          className="h-7 w-7 p-0 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30"
                          title="Delete model"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Card>
                  ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
