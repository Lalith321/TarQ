import * as THREE from 'three';
import { FloatingObject } from './types';

export class FloatingData {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly objects: FloatingObject[];
  private readonly group: THREE.Group;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    this.objects = [];
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.createDataObjects();
  }

  private createDataObjects(): void {
    const configs: { type: string; count: number }[] = [
      { type: 'table', count: 5 },
      { type: 'numbers', count: 6 },
      { type: 'json', count: 4 },
      { type: 'chart', count: 3 },
      { type: 'text', count: 5 }
    ];

    for (const config of configs) {
      for (let i = 0; i < config.count; i++) {
        const obj = this.createObject(config.type, i);
        this.objects.push(obj);
        this.group.add(obj.mesh);
      }
    }
  }

  private createObject(type: string, index: number): FloatingObject {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 160;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    switch (type) {
      case 'table':
        this.drawTableFragment(ctx, canvas.width, canvas.height, index);
        break;
      case 'numbers':
        this.drawNumbers(ctx, canvas.width, canvas.height, index);
        break;
      case 'json':
        this.drawJSON(ctx, canvas.width, canvas.height, index);
        break;
      case 'chart':
        this.drawChart(ctx, canvas.width, canvas.height, index);
        break;
      case 'text':
        this.drawTextFragment(ctx, canvas.width, canvas.height, index);
        break;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.35 + Math.random() * 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const sprite = new THREE.Sprite(material);

    const angle = Math.random() * Math.PI * 2;
    const radius = 4 + Math.random() * 10;
    const height = 2 + Math.random() * 8;

    sprite.position.set(
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius - 3
    );

    const scale = 0.8 + Math.random() * 1.2;
    sprite.scale.set(scale * 2.5, scale * 1.5, 1);

    return {
      mesh: sprite,
      material,
      basePos: sprite.position.clone(),
      driftSpeed: 0.1 + Math.random() * 0.3,
      driftOffset: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.2,
      type
    };
  }

  private drawTableFragment(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.5)';
    ctx.fillStyle = 'rgba(100, 180, 255, 0.7)';
    ctx.lineWidth = 1;

    const rows = 4;
    const cols = 3;
    const cellW = w / cols;
    const cellH = h / rows;

    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.fillRect(2, 2, w - 4, cellH - 2);

    ctx.strokeStyle = 'rgba(100, 180, 255, 0.25)';
    for (let i = 0; i <= rows; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * cellH);
      ctx.lineTo(w, i * cellH);
      ctx.stroke();
    }
    for (let i = 0; i <= cols; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellW, 0);
      ctx.lineTo(i * cellW, h);
      ctx.stroke();
    }

    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(150, 200, 255, 0.6)';
    const data = [['ID', 'Value', 'Status'], ['A-42', '98.4', 'OK'], ['B-17', '102.1', 'WARN'], ['C-09', '87.3', 'OK']];
    for (let r = 0; r < data.length; r++) {
      for (let c = 0; c < data[r].length; c++) {
        ctx.fillText(data[r][c], c * cellW + 8, r * cellH + 18);
      }
    }
  }

  private drawNumbers(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
    ctx.font = 'bold 32px monospace';
    ctx.fillStyle = 'rgba(79, 195, 247, 0.6)';
    ctx.textAlign = 'center';

    const values = ['42.7K', '98.4%', '1.2M', '0.003', '847.2', '12.5x'];
    ctx.fillText(values[seed % values.length], w / 2, h / 2 + 10);

    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(100, 180, 255, 0.35)';
    ctx.fillText('metric_' + String.fromCharCode(97 + seed), w / 2, h / 2 + 30);
    ctx.textAlign = 'left';
  }

  private drawJSON(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(150, 200, 255, 0.5)';

    const snippets = [
      '{\\n  "id": "evt_42",\\n  "type": "anomaly",\\n  "score": 0.97\\n}',
      '{\\n  "source": "db_01",\\n  "records": 15420,\\n  "latency": 12\\n}',
      '{\\n  "model": "v2.4",\\n  "accuracy": 0.943,\\n  "drift": false\\n}',
      '{\\n  "pipeline": "etl",\\n  "status": "running",\\n  "queue": 3\\n}'
    ];

    const lines = snippets[seed % snippets.length].split('\\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, 10, 18 + i * 14);
    });
  }

  private drawChart(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
    const padding = 20;
    const chartW = w - padding * 2;
    const chartH = h - padding * 2;

    ctx.strokeStyle = 'rgba(100, 180, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, h - padding);
    ctx.lineTo(w - padding, h - padding);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(79, 195, 247, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const points = 8;
    for (let i = 0; i < points; i++) {
      const x = padding + (i / (points - 1)) * chartW;
      const y = h - padding - (0.2 + Math.random() * 0.6) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.lineTo(w - padding, h - padding);
    ctx.lineTo(padding, h - padding);
    ctx.closePath();
    ctx.fillStyle = 'rgba(79, 195, 247, 0.1)';
    ctx.fill();
  }

  private drawTextFragment(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'rgba(180, 200, 230, 0.45)';

    const texts = [
      'SELECT * FROM events\\nWHERE score > 0.95\\nORDER BY timestamp DESC\\nLIMIT 100;',
      'import { analyze } from\\n  "@TarQ/core";\\n\\nconst result = await\\n  analyze(dataset);',
      'correlation: 0.847\\np-value: < 0.001\\nconfidence: 95%\\nmethod: pearson',
      'timestamp: 2024-01-15T09:23:17Z\\nlevel: INFO\\nmsg: pipeline complete\\nduration: 1.24s',
      'feature_importance:\\n  - revenue: 0.34\\n  - churn_risk: 0.28\\n  - engagement: 0.19'
    ];

    const lines = texts[seed % texts.length].split('\\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, 10, 18 + i * 14);
    });
  }

  update(time: number, dt: number): void {
    for (const obj of this.objects) {
      obj.mesh.position.x = obj.basePos.x + Math.sin(time * obj.driftSpeed + obj.driftOffset) * 0.3;
      obj.mesh.position.y = obj.basePos.y + Math.cos(time * obj.driftSpeed * 0.7 + obj.driftOffset) * 0.2;

      const rot = Math.sin(time * obj.rotSpeed + obj.driftOffset) * 0.05;
      const baseScaleX = obj.basePos.y > 5 ? 2.5 : 2.0;
      obj.mesh.scale.x = baseScaleX * (1 + rot);

      const dist = obj.mesh.position.distanceTo(this.camera.position);
      const targetOpacity = Math.max(0.1, Math.min(0.5, 1 - dist / 20));
      obj.material.opacity += (targetOpacity - obj.material.opacity) * 2 * dt;
    }
  }

  getObjects(): FloatingObject[] {
    return this.objects;
  }
}