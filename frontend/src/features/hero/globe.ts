import * as THREE from 'three';

const GLOBE_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GLOBE_FRAGMENT_SHADER = `
  uniform sampler2D uMap;
  uniform sampler2D uNormalMap;
  uniform float uNormalScale;
  uniform vec3 uAmbientColor;
  uniform vec3 uKeyColor;
  uniform vec3 uKeyDir;
  uniform vec3 uFillColor;
  uniform vec3 uFillDir;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  // Note: cameraPosition is auto-injected by three.js's ShaderMaterial —
  // do not redeclare it here or it will fail to compile.

  void main() {
    vec4 texColor = texture2D(uMap, vUv);
    vec3 tex = texColor.rgb;

    vec3 mapNormal = texture2D(uNormalMap, vUv).xyz * 2.0 - 1.0;
    mapNormal.xy *= uNormalScale;

    vec3 N = normalize(vWorldNormal + mapNormal * 0.3);

    float keyDiff = max(dot(N, uKeyDir), 0.0);
    float fillDiff = max(dot(N, uFillDir), 0.0);
    vec3 wash = uAmbientColor + uKeyColor * keyDiff + uFillColor * fillDiff;

    // No extra *1.2 boost here — oceans should read close to black.
    vec3 baseSurface = tex * wash;

    // City lights: isolate bright pixels and let them glow warm,
    // independent of the cool key/fill wash. Squaring the mask punches up
    // contrast so it reads as discrete glowing clusters, not a haze.
    float brightness = max(tex.r, max(tex.g, tex.b));
    float cityMask = smoothstep(0.35, 0.8, brightness);
    vec3 cityGlow = vec3(1.0, 0.82, 0.55) * cityMask * cityMask * 5.5;

    // True view-dependent fresnel limb light, tinted to match the
    // atmosphere shells so the surface and the atmosphere read as one
    // continuous glow at the horizon — this replaces the old broad
    // top-mask spotlight, which was washing the entire visible dome cyan.
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(dot(N, viewDir), 0.0), 3.0);
    vec3 limbGlow = uKeyColor * fresnel * 1.1;

    vec3 finalColor = baseSurface + cityGlow + limbGlow;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

const ATMOSPHERE_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMOSPHERE_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uRimStart;
  uniform float uRimPow;
  uniform float uAlpha;
  uniform float uEdgeSoftness;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vPos;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float d = dot(vNormal, vec3(0.0, 0.0, 1.0));
    float rim = pow(max(0.0, uRimStart - d), uRimPow);
    float edgeFade = 1.0 - smoothstep(-uEdgeSoftness, 0.0, d);
    rim *= edgeFade;

    float n = fbm(vPos * 0.4 + vec3(0.0, uTime * 0.03, 0.0));
    float wispy = smoothstep(0.25, 0.75, n);
    rim *= mix(0.35, 1.15, wispy);

    gl_FragColor = vec4(uColor, clamp(rim, 0.0, 1.0) * uAlpha);
  }
`;

export class Globe {
  readonly scene: THREE.Scene;
  readonly group: THREE.Group;
  mesh!: THREE.Mesh;
  readonly radius: number;
  private material!: THREE.ShaderMaterial;
  private starLayers: THREE.Points[] = [];
  private nearStarsMaterial: THREE.PointsMaterial | null = null;
  private nebulaSprites: THREE.Sprite[] = [];
  private atmosphereMaterials: THREE.ShaderMaterial[] = [];
  private atmosphereBases: { rimStart: number; alpha: number }[] = [];
  private rotationAxis = new THREE.Vector3(0.57, 0.918, 0.0).normalize();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Reverted to the original, proven-working radius/position. Do not
    // rescale these without knowing the camera's actual position/FOV/far
    // clip — a blind guess here is what made the globe disappear. If you
    // want to address the "toy scale" feel, do it via the camera setup
    // (distance/FOV) rather than moving the globe itself.
    this.radius = 12;
    this.group = new THREE.Group();
    this.group.position.set(0, -13, 20);
    this.group.rotation.x = 0.85;
    this.group.rotation.y = Math.PI * 0.5;
    this.scene.add(this.group);

    this.createGlobe();
    this.createAtmosphere();
    this.createNebulaHaze();
    this.createStars();
  }

  private createGlobe(): void {
    const geometry = new THREE.SphereGeometry(this.radius, 128, 128);

    const textureLoader = new THREE.TextureLoader();
    const normalTexture = textureLoader.load('/textures/earth-normal.png');
    const earthTexture = textureLoader.load(
      '/textures/earth-night.png',
      undefined,
      undefined,
      (err) => console.error('Failed to load earth texture:', err)
    );

    earthTexture.wrapS = THREE.RepeatWrapping;
    earthTexture.wrapT = THREE.ClampToEdgeWrapping;
    normalTexture.wrapS = THREE.RepeatWrapping;
    normalTexture.wrapT = THREE.ClampToEdgeWrapping;

    this.material = new THREE.ShaderMaterial({
      vertexShader: GLOBE_VERTEX_SHADER,
      fragmentShader: GLOBE_FRAGMENT_SHADER,
      uniforms: {
        uMap: { value: earthTexture },
        uNormalMap: { value: normalTexture },
        uNormalScale: { value: 5.2 },
        // Lower ambient floor than before (0.35 vs 0.5) so oceans sit
        // closer to true black instead of a lit navy.
        uAmbientColor: { value: new THREE.Color(0x0a1a2a).multiplyScalar(0.35) },
        uKeyColor: { value: new THREE.Color(0x00d4ff).multiplyScalar(0.8) },
        uKeyDir: { value: new THREE.Vector3(2.0, 0.5, 1.5).normalize() },
        uFillColor: { value: new THREE.Color(0x2244aa).multiplyScalar(0.4) },
        uFillDir: { value: new THREE.Vector3(-30, 10, -30).normalize() },
      },
      side: THREE.FrontSide,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.group.add(this.mesh);
  }

  private createAtmosphere(): void {
    const R = this.radius;
    const shells = [
      { scale: 1.18, rimStart: -10.04, rimPow: 6.5, alpha: 0.86, color: new THREE.Color(0x00d4ff), edgeSoftness: 2.20 },
      { scale: 1.02, rimStart: 0.75, rimPow: 0.20, alpha: 0.6, color: new THREE.Color(0x1e3a5f), edgeSoftness: 5.50 },
    ];
    shells.forEach((sh) => {
      const mat = new THREE.ShaderMaterial({
        vertexShader: ATMOSPHERE_VERTEX,
        fragmentShader: ATMOSPHERE_FRAGMENT,
        uniforms: {
          uColor: { value: sh.color },
          uRimStart: { value: sh.rimStart },
          uRimPow: { value: sh.rimPow },
          uAlpha: { value: sh.alpha },
          uTime: { value: 0 },
          uEdgeSoftness: { value: sh.edgeSoftness },
        },
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.atmosphereMaterials.push(mat);
      // Store each shell's own base values so update() animates AROUND
      // them, instead of overwriting shell 0's dramatic outer-glow numbers
      // with shell 1's tamer ones every frame (that was hiding the rim).
      this.atmosphereBases.push({ rimStart: sh.rimStart, alpha: sh.alpha });
      const shellMesh = new THREE.Mesh(new THREE.SphereGeometry(R * sh.scale, 64, 64), mat);
      this.group.add(shellMesh);
    });
  }

  private createNebulaHaze(): void {
    // Procedural soft-glow sprites — no external asset needed — placed far
    // behind the globe so space isn't flat black. Sprites always face the
    // camera, so no rotation handling is needed.
    const makeGlowTexture = (color: string): THREE.CanvasTexture => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    };

    // Positive z, same side as the globe (z=20) and within the stars'
    // visible range (r 80-280) — the earlier negative-z values put these
    // directly behind the camera, which is why no fog was visible.
    const glows: { color: string; pos: THREE.Vector3; scale: number; opacity: number }[] = [
      { color: 'rgba(40,90,180,0.55)', pos: new THREE.Vector3(-60, 20, 120), scale: 260, opacity: 0.45 },
      { color: 'rgba(120,60,180,0.4)', pos: new THREE.Vector3(70, 40, 160), scale: 240, opacity: 0.32 },
      { color: 'rgba(0,180,220,0.35)', pos: new THREE.Vector3(0, -30, 90), scale: 220, opacity: 0.3 },
    ];

    glows.forEach((g) => {
      const material = new THREE.SpriteMaterial({
        map: makeGlowTexture(g.color),
        transparent: true,
        opacity: g.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(g.pos);
      sprite.scale.set(g.scale, g.scale, 1);
      this.scene.add(sprite);
      this.nebulaSprites.push(sprite);
    });
  }

  private createStars(): void {
    const buildLayer = (
      count: number,
      radiusRange: [number, number],
      size: number,
      opacity: number,
      colorVariance: () => THREE.Color
    ): THREE.Points => {
      const pos = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = radiusRange[0] + Math.random() * (radiusRange[1] - radiusRange[0]);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i * 3 + 2] = r * Math.cos(phi);

        const c = colorVariance();
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const points = new THREE.Points(geo, material);
      this.scene.add(points);
      return points;
    };

    // Dense, dim, distant field for overall sky texture. Radius range kept
    // within the original 80-280 neighborhood so it stays framed with the
    // reverted globe scale.
    const farStars = buildLayer(3000, [80, 280], 0.22, 0.55, () => {
      const t = Math.random();
      return t < 0.7
        ? new THREE.Color(0xffffff)
        : t < 0.9
        ? new THREE.Color(0xbcd4ff)
        : new THREE.Color(0xfff0d0);
    });

    // Sparse, bright, nearer stars for a sense of parallax depth.
    const nearStars = buildLayer(150, [40, 90], 0.6, 0.85, () => {
      const t = Math.random();
      return t < 0.6 ? new THREE.Color(0xffffff) : new THREE.Color(0xa8d8ff);
    });
    this.nearStarsMaterial = nearStars.material as THREE.PointsMaterial;

    this.starLayers.push(farStars, nearStars);
  }

  update(time: number, dt: number): void {
    const speed = dt ? 0.2 * dt : 0.0004;
    this.mesh.rotateOnAxis(this.rotationAxis, speed);

    this.atmosphereMaterials.forEach((m, index) => {
      const base = this.atmosphereBases[index];
      m.uniforms.uTime.value = time;
      m.uniforms.uAlpha.value = base.alpha + Math.sin(time * 1.5 + index) * 0.04;
      m.uniforms.uRimStart.value = base.rimStart + Math.sin(time * 0.8 + index) * 0.03;
    });

    this.starLayers.forEach((layer, i) => {
      layer.rotation.y += 0.0002 * (i + 1);
    });
    if (this.nearStarsMaterial) {
      this.nearStarsMaterial.opacity = 0.75 + Math.sin(time * 0.6) * 0.15;
    }
  }
}