import * as THREE from 'three';

const GLOBE_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
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

  void main() {
    vec4 texColor = texture2D(uMap, vUv);
    vec3 tex = texColor.rgb;

    vec3 mapNormal = texture2D(uNormalMap, vUv).xyz * 2.0 - 1.0;
    mapNormal.xy *= uNormalScale;

    vec3 N = normalize(vWorldNormal + mapNormal * 0.3);

    float keyDiff = max(dot(N, uKeyDir), 0.0);
    float fillDiff = max(dot(N, uFillDir), 0.0);
    vec3 wash = uAmbientColor + uKeyColor * keyDiff + uFillColor * fillDiff;

    vec3 baseSurface = tex * wash * 1.2;

    float brightness = max(tex.r, max(tex.g, tex.b));
    float cityMask = smoothstep(0.45, 0.85, brightness);
    vec3 cityGlow = vec3(1.0, 0.9, 0.6) * cityMask * 6.0;

    float topMask = smoothstep(0.1, 0.85, vWorldNormal.y);
    vec3 spotColor = vec3(0.0, 0.85, 1.0) * topMask * 8.8;
    vec3 topSpotlightGlow = tex * spotColor;

    vec3 finalColor = baseSurface + cityGlow + topSpotlightGlow;

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
  private stars!: THREE.Points;
  private atmosphereMaterials: THREE.ShaderMaterial[] = [];
  private rotationAxis = new THREE.Vector3(0.57, 0.918, 0.0).normalize();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.radius = 12;
    this.group = new THREE.Group();
    this.group.position.set(0, -13, 20);
    this.group.rotation.x = 0.85;
    this.group.rotation.y = Math.PI * 0.5;
    this.scene.add(this.group);

    this.createGlobe();
    this.createAtmosphere();
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
        uAmbientColor: { value: new THREE.Color(0x0a1a2a).multiplyScalar(0.5) },
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
      const shellMesh = new THREE.Mesh(new THREE.SphereGeometry(R * sh.scale, 64, 64), mat);
      this.group.add(shellMesh);
    });
  }

  private createStars(): void {
    const count = 500;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 80 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    this.stars = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0x5577aa,
        size: 0.3,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.scene.add(this.stars);
  }

  update(time: number, dt: number): void {
    const speed = dt ? 0.2 * dt : 0.0004;
    this.mesh.rotateOnAxis(this.rotationAxis, speed);

    this.atmosphereMaterials.forEach((m, index) => {
      m.uniforms.uTime.value = time;
      const baseAlpha = index === 0 ? 0.86 : 0.6;
      m.uniforms.uAlpha.value = baseAlpha + Math.sin(time * 1.5) * 0.05;
      m.uniforms.uRimStart.value = 0.55 + Math.sin(time * 0.8) * 0.05;
    });

    if (this.stars) this.stars.rotation.y += 0.0005;
  }
}