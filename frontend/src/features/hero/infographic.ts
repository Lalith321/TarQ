import { SceneManager } from './scene';
import { InfographicData, InfographicType } from './types';
import * as THREE from 'three';

export class InfographicSystem {
  private readonly sceneManager: SceneManager;
  private readonly overlay: HTMLElement;
  private currentType: InfographicType | null;
  private visible: boolean;
  private readonly targetPos: THREE.Vector3;
  private currentWorldPos: THREE.Vector3;
  private currentData: InfographicData | null;
  private readonly types: InfographicType[];

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    this.overlay = document.getElementById('infographic-overlay')!;
    this.currentType = null;
    this.visible = false;
    this.targetPos = new THREE.Vector3();
    this.currentWorldPos = new THREE.Vector3();
    this.currentData = null;
    this.types = ['line', 'bar', 'kpi', 'distribution'];
  }

  show(worldPos: THREE.Vector3, type: InfographicType | null = null): void {
    this.targetPos.copy(worldPos);
    this.currentWorldPos.copy(worldPos);
    const selectedType: InfographicType = type || this.types[Math.floor(Math.random() * this.types.length)];

    if (this.currentType !== selectedType || !this.visible) {
      this.currentType = selectedType;
      this.currentData = this.generateData(selectedType);
      this.render();
    }

    this.visible = true;
    this.overlay.classList.add('visible');
    this.updatePosition();
  }

  hide(): void {
    this.visible = false;
    this.overlay.classList.remove('visible');
  }

  private generateData(type: InfographicType): InfographicData {
    switch (type) {
      case 'line':
        return {
          title: 'Signal Trend',
          value: (85 + Math.random() * 15).toFixed(1),
          delta: (Math.random() * 10 - 2).toFixed(1),
          deltaPositive: Math.random() > 0.3,
          chartData: Array.from({ length: 12 }, () => 20 + Math.random() * 60)
        };
      case 'bar':
        return {
          title: 'Distribution',
          value: (42 + Math.random() * 30).toFixed(0) + '%',
          delta: (Math.random() * 8 - 2).toFixed(1),
          deltaPositive: Math.random() > 0.4,
          chartData: Array.from({ length: 6 }, () => 15 + Math.random() * 70)
        };
      case 'kpi':
        return {
          title: 'Active Flows',
          value: Math.floor(1200 + Math.random() * 3000).toLocaleString(),
          delta: (Math.random() * 20 - 5).toFixed(1),
          deltaPositive: Math.random() > 0.35,
          chartData: Array.from({ length: 8 }, () => 30 + Math.random() * 50)
        };
      case 'distribution':
        return {
          title: 'Anomaly Score',
          value: (0.7 + Math.random() * 0.28).toFixed(3),
          delta: (Math.random() * 0.1 - 0.02).toFixed(3),
          deltaPositive: Math.random() > 0.5,
          chartData: Array.from({ length: 10 }, () => Math.random() * 100)
        };
      default:
        return this.generateData('line');
    }
  }

  private render(): void {
    if (!this.currentData) return;
    const data = this.currentData;
    const deltaClass = data.deltaPositive ? 'positive' : 'negative';
    const deltaSign = data.deltaPositive ? '+' : '';

    let chartHTML = '';
    if (this.currentType === 'line') chartHTML = this.renderLineChart(data.chartData);
    else if (this.currentType === 'bar') chartHTML = this.renderBarChart(data.chartData);
    else chartHTML = this.renderSparkline(data.chartData);

    this.overlay.innerHTML = `
      <div class="lh-infographic-card">
        <div class="lh-infographic-title">${data.title}</div>
        <div class="lh-infographic-value">${data.value}</div>
        <div class="lh-infographic-delta ${deltaClass}">${deltaSign}${data.delta}%</div>
        <div class="lh-infographic-chart">${chartHTML}</div>
      </div>
    `;
  }

  private renderLineChart(data: number[]): string {
    const w = 160, h = 40, padding = 4;
    const max = Math.max(...data), min = Math.min(...data);
    const range = max - min || 1;
    let path = '';
    data.forEach((val, i) => {
      const x = padding + (i / (data.length - 1)) * (w - padding * 2);
      const y = h - padding - ((val - min) / range) * (h - padding * 2);
      path += (i === 0 ? 'M' : 'L') + `${x},${y}`;
    });
    const areaPath = path + ` L${w - padding},${h} L${padding},${h} Z`;
    return `
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lh-areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(79,195,247,0.3)"/>
            <stop offset="100%" stop-color="rgba(79,195,247,0)"/>
          </linearGradient>
        </defs>
        <path d="${areaPath}" fill="url(#lh-areaGrad)"/>
        <path d="${path}" fill="none" stroke="#4fc3f7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  private renderBarChart(data: number[]): string {
    const w = 160, h = 40, padding = 4;
    const barW = (w - padding * 2) / data.length - 2;
    const max = Math.max(...data);
    let bars = '';
    data.forEach((val, i) => {
      const x = padding + i * (barW + 2);
      const barH = (val / max) * (h - padding * 2);
      const y = h - padding - barH;
      const color = i === data.length - 1 ? '#22d3ee' : '#4fc3f7';
      bars += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${color}" opacity="0.7" rx="1"/>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${bars}</svg>`;
  }

  private renderSparkline(data: number[]): string {
    const w = 160, h = 40, padding = 4;
    const max = Math.max(...data), min = Math.min(...data);
    const range = max - min || 1;
    let path = '';
    data.forEach((val, i) => {
      const x = padding + (i / (data.length - 1)) * (w - padding * 2);
      const y = h - padding - ((val - min) / range) * (h - padding * 2);
      path += (i === 0 ? 'M' : 'L') + `${x},${y}`;
    });
    const lastY = h - padding - ((data[data.length - 1] - min) / range) * (h - padding * 2);
    return `
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <path d="${path}" fill="none" stroke="#4fc3f7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${w - padding}" cy="${lastY}" r="2.5" fill="#22d3ee"/>
      </svg>
    `;
  }

  private updatePosition(): void {
    if (!this.visible) return;
    this.currentWorldPos.lerp(this.targetPos, 0.1);
    const screen = this.sceneManager.projectToScreen(this.currentWorldPos);
    if (screen.visible) {
      this.overlay.style.left = screen.x + 'px';
      this.overlay.style.top = screen.y + 'px';
    }
  }

  update(): void {
    this.updatePosition();
  }
}