import React, { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { listModels, predict, trainModel } from '@/services/mlService';
import type { ModelListEntry, TrainingResult } from '@/services/types';

export default function MlTrainingPanel() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState('');
  const [nTrials, setNTrials] = useState(20);
  const [isTraining, setIsTraining] = useState(false);
  const [result, setResult] = useState<TrainingResult | null>(null);
  const [models, setModels] = useState<ModelListEntry[]>([]);
  const [predictInput, setPredictInput] = useState('{}');
  const [predictOutput, setPredictOutput] = useState<string | null>(null);

  const refreshModels = () => listModels().then(setModels).catch(() => {});
  useEffect(() => { refreshModels(); }, []);

  const handleTrain = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !target.trim()) {
      toast({ title: 'Missing input', description: 'Pick a CSV and name the target column.', variant: 'destructive' });
      return;
    }
    setIsTraining(true);
    setResult(null);
    try {
      const res = await trainModel(file, target.trim(), { nTrials });
      setResult(res);
      refreshModels();
    } catch (err) {
      toast({
        title: 'Training failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsTraining(false);
    }
  };

  const handlePredict = async () => {
    if (!result) return;
    try {
      const row = JSON.parse(predictInput);
      const rows = Array.isArray(row) ? row : [row];
      const preds = await predict(result.model_id, rows);
      setPredictOutput(JSON.stringify(preds));
    } catch (err) {
      toast({
        title: 'Prediction failed',
        description: err instanceof Error ? err.message : 'Invalid JSON or request error',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h3 className="text-sm font-bold mb-3">Train a model</h3>
        <div className="flex flex-wrap items-end gap-3">
          <input ref={fileRef} type="file" accept=".csv" className="text-xs" />
          <Input
            placeholder="Target column"
            value={target}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTarget(e.target.value)}
            className="w-40 h-9"
          />
          <Input
            type="number"
            value={nTrials}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNTrials(Number(e.target.value) || 20)}
            className="w-28 h-9"
            title="Optuna trials per candidate model"
          />
          <Button onClick={handleTrain} disabled={isTraining}>
            {isTraining ? 'Training… (Optuna, no LLM in this loop)' : 'Train'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Preprocessing, model selection, and hyperparameter search are all
          deterministic Optuna/sklearn — no LLM call happens during training.
        </p>
      </Card>

      {result && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold">Result</h3>
            <Badge className="bg-emerald-500/10 text-emerald-600 border-none">{result.task}</Badge>
            <span className="text-xs text-muted-foreground">{result.duration_s.toFixed(1)}s · {result.n_rows} rows · {result.n_features} features</span>
          </div>
          <p className="text-sm">{result.summary}</p>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Leaderboard</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>{result.metric}</TableHead>
                  <TableHead>Trials</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.leaderboard.map((c) => (
                  <TableRow key={c.name} className={c.name === result.best_model_name ? 'bg-primary/5' : ''}>
                    <TableCell className="font-semibold text-sm">{c.name}</TableCell>
                    <TableCell className="text-xs">{c.best_score.toFixed(4)}</TableCell>
                    <TableCell className="text-xs">{c.n_trials}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {Object.keys(result.feature_importance).length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Top features</h4>
              <div className="space-y-1.5">
                {Object.entries(result.feature_importance).slice(0, 8).map(([name, value]) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="text-xs w-40 truncate">{name}</span>
                    <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, value * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Try a prediction</h4>
            <div className="flex gap-2">
              <Input value={predictInput} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPredictInput(e.target.value)} className="font-mono text-xs" />
              <Button variant="outline" onClick={handlePredict}>Predict</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">JSON row (or array of rows) matching the training columns, minus the target.</p>
            {predictOutput && <p className="text-sm font-mono mt-2">{predictOutput}</p>}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h3 className="text-sm font-bold mb-3">Previously trained models</h3>
        {models.length === 0 ? (
          <p className="text-xs text-muted-foreground">None yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model ID</TableHead>
                <TableHead>Best model</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((m) => (
                <TableRow key={m.model_id}>
                  <TableCell className="font-mono text-xs">{m.model_id}</TableCell>
                  <TableCell className="text-xs">{m.best_model_name}</TableCell>
                  <TableCell className="text-xs">{m.best_score.toFixed(4)}</TableCell>
                  <TableCell className="text-xs">{m.task}</TableCell>
                  <TableCell className="text-xs">{m.target}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
