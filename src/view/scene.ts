import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { Bowler } from "./character";
import { ShotReplay, type TransformSnapshot } from "./replay";
import { Reflector } from "three/addons/objects/Reflector.js";
import { pinPositions, type BowlingPhysics } from "../game/physics";
import type { ArmSample, Hand } from "../tracking/pose";
import { clamp } from "../tracking/math";

function canvasTexture(
  w: number,
  h: number,
  draw: (c: CanvasRenderingContext2D) => void,
) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function wood() {
  let seed = 31;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  return canvasTexture(512, 2048, (c) => {
    c.fillStyle = "#d8a458";
    c.fillRect(0, 0, 512, 2048);
    for (let x = 0; x < 512; x += 32) {
      for (let y = -500; y < 2048; y += 340 + Math.floor(rand() * 200)) {
        const h = 340 + rand() * 180;
        c.fillStyle = `hsl(${34 + rand() * 3} 49% ${51 + rand() * 6}%)`;
        c.fillRect(x, y, 31.5, h);
        c.strokeStyle = "rgba(108,67,24,.23)";
        c.strokeRect(x, y, 32, h);
        for (let j = 0; j < 14; j++) {
          c.strokeStyle = `rgba(116,68,26,${rand() * 0.1})`;
          c.beginPath();
          const xx = x + rand() * 31;
          c.moveTo(xx, y);
          c.bezierCurveTo(xx + 3, y + h * 0.3, xx - 3, y + h * 0.7, xx, y + h);
          c.stroke();
        }
      }
    }
  });
}
const pinProfile = [
  [0, 0],
  [0.04, 0],
  [0.046, 0.014],
  [0.05, 0.055],
  [0.06, 0.11],
  [0.058, 0.15],
  [0.044, 0.19],
  [0.028, 0.24],
  [0.025, 0.275],
  [0.036, 0.302],
  [0.041, 0.335],
  [0.033, 0.365],
  [0.017, 0.38],
  [0, 0.385],
].map(([x, y]) => new THREE.Vector2(x, y));
export class AlleyScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.05, 110);
  readonly renderer: THREE.WebGLRenderer;
  private root = new THREE.Group();
  private pinMeshes = new Map<number, THREE.Group>();
  private ball: THREE.Mesh;
  private bowler!: Bowler;
  private spectators: Bowler[] = [];
  private avatar!: THREE.Group;
  private arm!: THREE.Group;
  private replay = new ShotReplay();
  private resultAt = 0;
  private successful = false;
  private shot = "";
  private environment: THREE.WebGLRenderTarget;
  private sweep = new THREE.Group();
  private sweepAt = 0;
  private ballShadow!: THREE.Mesh;
  private pinGeometry = new THREE.LatheGeometry(
    new THREE.CatmullRomCurve3(
      pinProfile.map((p) => new THREE.Vector3(p.x, p.y, 0)),
    )
      .getPoints(80)
      .map((p) => new THREE.Vector2(Math.max(0, p.x), p.y)),
    40,
  );
  private pinMaterial = new THREE.MeshPhysicalMaterial({
    color: "#fffefa",
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.14,
  });
  private heldBall: THREE.Mesh;
  private guide: THREE.Line;
  private reflection: Reflector;
  private follow = false;
  private launchedAt = 0;
  private hand: Hand = "right";
  private armTarget = 0;
  private releaseArm = 0;
  private intro = true;
  private last = 0;
  private target = new THREE.Vector3(0, 0.6, -9);
  private disposed = false;
  private reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.03;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.4;
    room.dispose();
    pmrem.dispose();
    container.append(this.renderer.domElement);
    this.scene.background = new THREE.Color("#d6dddb");
    this.scene.fog = new THREE.Fog("#d6dddb", 42, 95);
    this.scene.add(this.root);
    this.scene.add(new THREE.HemisphereLight("#f0f5ff", "#696251", 0.85));
    const key = new THREE.DirectionalLight("#fff1db", 2.4);
    key.position.set(-4, 9, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -12;
    key.shadow.camera.right = 12;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -26;
    key.shadow.camera.far = 45;
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.006;
    key.shadow.radius = 3;
    key.target.position.set(0, 0, -10);
    this.scene.add(key, key.target);
    const fill = new THREE.DirectionalLight("#c5f3ea", 1.0);
    fill.position.set(8, 5, -19);
    this.scene.add(fill);
    const woodMap = wood();
    woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping;
    woodMap.repeat.set(1, 2);
    woodMap.anisotropy = 8;
    const maple = new THREE.MeshPhysicalMaterial({
      map: woodMap,
      roughness: 0.38,
      metalness: 0,
      clearcoat: 0.65,
      clearcoatRoughness: 0.34,
      bumpMap: woodMap,
      bumpScale: 0.0012,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: "#303c45",
      roughness: 0.38,
      metalness: 0.4,
    });
    const trim = new THREE.MeshStandardMaterial({
      color: "#b5a78a",
      roughness: 0.24,
      metalness: 0.45,
    });
    for (let lane = -4; lane <= 4; lane++) {
      const x = lane * 1.72;
      this.box(x, -0.12, -8, 1.066, 0.24, 24, maple);
      for (const side of [-1, 1]) {
        const vertices: number[] = [],
          indices: number[] = [];
        for (let j = 0; j <= 20; j++) {
          const a = (j / 20) * Math.PI;
          for (const z of [4, -20])
            vertices.push(
              x + side * 0.677 + Math.cos(a) * 0.14,
              -Math.sin(a) * 0.18,
              z,
            );
          if (j < 20) {
            const n = j * 2;
            indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(vertices, 3),
        );
        g.setIndex(indices);
        g.computeVertexNormals();
        const gutter = new THREE.Mesh(
          g,
          new THREE.MeshStandardMaterial({
            color: "#2c353d",
            roughness: 0.4,
            metalness: 0.25,
            side: THREE.DoubleSide,
          }),
        );
        this.root.add(gutter);
        this.box(x + side * 0.81, 0.016, -8, 0.035, 0.065, 24, trim);
      }
      this.box(
        x,
        1.4,
        -20.6,
        1.69,
        1.42,
        0.28,
        new THREE.MeshStandardMaterial({
          color: lane % 2 === 0 ? "#78a6a3" : "#719997",
          roughness: 0.65,
        }),
      );
      this.box(
        x,
        0.43,
        -20.62,
        1.58,
        0.85,
        0.2,
        new THREE.MeshBasicMaterial({ color: "#10191c" }),
      );
      this.box(x, 2.17, -20.4, 1.7, 0.08, 0.4, trim);
      // A recessed pin deck, metal threshold and trim give the machine depth.
      this.box(x, 0.67, -20.28, 1.6, 0.065, 0.22, dark);
      this.box(
        x,
        0.72,
        -20.14,
        1.58,
        0.018,
        0.035,
        new THREE.MeshBasicMaterial({ color: "#e4ece4" }),
      );
      for (const side of [-1, 1]) {
        this.box(x + side * 0.79, 0.34, -20.04, 0.08, 0.65, 1.1, trim);
        for (const y of [0.9, 1.98]) {
          const bolt = new THREE.Mesh(
            new THREE.SphereGeometry(0.019, 10, 8),
            trim,
          );
          bolt.scale.z = 0.3;
          bolt.position.set(x + side * 0.72, y, -20.44);
          this.root.add(bolt);
        }
      }
      const panel = canvasTexture(512, 256, (c) => {
        c.fillStyle = "#a5c6bc";
        c.beginPath();
        c.roundRect(30, 35, 452, 135, 65);
        c.fill();
        c.strokeStyle = "#e4f0d5";
        c.lineWidth = 6;
        for (let y = 55; y <= 145; y += 22) {
          c.beginPath();
          c.moveTo(64, y);
          c.lineTo(448, y);
          c.stroke();
        }
        c.fillStyle = "#f8d768";
        c.beginPath();
        c.arc(256, 101, 43, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#286d70";
        c.font = "bold 46px Trebuchet MS";
        c.textAlign = "center";
        c.fillText(String(lane + 5).padStart(2, "0"), 256, 117);
        c.fillStyle = "#fff8dc";
        c.font = "bold 28px Trebuchet MS";
      });
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 0.75),
        new THREE.MeshBasicMaterial({ map: panel, transparent: true }),
      );
      sign.position.set(x, 1.45, -20.44);
      this.root.add(sign);
      if (lane !== 0)
        for (const p of pinPositions) {
          const pin = this.makePin();
          pin.position.set(x + p.x, 0, p.z);
          this.root.add(pin);
        }
      for (let j = -3; j <= 3; j++) {
        const arrow = new THREE.Shape();
        arrow.moveTo(0, -0.06);
        arrow.lineTo(-0.025, 0.025);
        arrow.lineTo(0.025, 0.025);
        arrow.closePath();
        const mesh = new THREE.Mesh(
          new THREE.ShapeGeometry(arrow),
          new THREE.MeshBasicMaterial({ color: "#795b35" }),
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x + j * 0.115, 0.005, -4.3 - Math.abs(j) * 0.1);
        this.root.add(mesh);
        for (const z of [1.6, -1.3]) {
          const dot = new THREE.Mesh(
            new THREE.CircleGeometry(0.012, 8),
            new THREE.MeshBasicMaterial({ color: "#85643a" }),
          );
          dot.rotation.x = -Math.PI / 2;
          dot.position.set(x + j * 0.13, 0.005, z);
          this.root.add(dot);
        }
      }
    }
    this.box(0, -0.14, 3, 17, 0.24, 5, maple);
    this.box(
      0,
      3.8,
      -20.8,
      18,
      3.3,
      0.3,
      new THREE.MeshStandardMaterial({ color: "#d3ae72", roughness: 0.85 }),
    );
    for (let x = -8.7; x < 9; x += 0.12)
      this.box(
        x,
        3.8,
        -20.62,
        0.014,
        3.2,
        0.018,
        new THREE.MeshStandardMaterial({ color: "#c29c62", roughness: 1 }),
      );
    this.box(
      0,
      5.5,
      -8,
      20,
      0.2,
      29,
      new THREE.MeshStandardMaterial({ color: "#dfdfd6", roughness: 0.95 }),
    );
    for (const side of [-1, 1]) {
      this.box(
        side * 8.6,
        2.6,
        -8,
        0.2,
        5.8,
        29,
        new THREE.MeshStandardMaterial({ color: "#86b6ac", roughness: 0.9 }),
      );
      this.box(side * 8.47, 1, -8, 0.08, 0.15, 29, trim);
    }
    const glow = new THREE.MeshBasicMaterial({ color: "#fff1c7" });
    for (let z = 2; z >= -19; z -= 5) {
      this.box(0, 5.34, z, 17, 0.035, 0.12, glow);
      this.box(0, 5.4, z, 17, 0.09, 0.27, dark);
    }
    // Recessed architectural panels replace the venue wordmark entirely.
    const panelMat = new THREE.MeshStandardMaterial({
      color: "#d8c6aa",
      roughness: 0.86,
    });
    for (let x = -7; x <= 7; x += 3.5) {
      this.box(x, 3.65, -20.42, 2.8, 1.02, 0.08, panelMat);
      this.box(x, 3.1, -20.32, 2.8, 0.035, 0.06, glow);
    }
    // Ceiling coffers and suspended luminaires give the lane real reflected structure.
    const ceilingTrim = new THREE.MeshStandardMaterial({
      color: "#a5aaa5",
      roughness: 0.65,
    });
    for (let z = 2; z > -20; z -= 3.5) {
      for (const x of [-5.2, 0, 5.2]) {
        this.box(x, 5.15, z, 2.6, 0.12, 0.6, ceilingTrim);
        this.box(x, 5.075, z, 2.4, 0.015, 0.42, glow);
      }
    }
    // Dark foul line across each lane, physically separate from the approach.
    for (let lane = -4; lane <= 4; lane++)
      this.box(lane * 1.72, 0.009, 0.02, 1.066, 0.007, 0.06, dark);
    const sweepBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.52, 0.12, 0.09),
      trim,
    );
    sweepBar.position.y = 0.14;
    this.sweep.add(sweepBar);
    for (const x of [-0.71, 0.71]) {
      const support = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.8, 0.04),
        dark,
      );
      support.position.set(x, 0.56, 0);
      this.sweep.add(support);
    }
    this.sweep.position.set(0, 0.9, -19.5);
    this.root.add(this.sweep);
    this.sweep.visible = false;
    // The approach opens into a lounge, visible behind the bowler in reaction shots.
    const lounge = new THREE.MeshStandardMaterial({
      color: "#657c80",
      roughness: 0.9,
    });
    const upholstery = new THREE.MeshStandardMaterial({
      color: "#315f6a",
      roughness: 0.96,
    });
    const approachMat = maple.clone();
    approachMat.roughness = 0.7;
    approachMat.clearcoat = 0.12;
    this.box(0, -0.15, 7, 17, 0.22, 7, approachMat);
    this.box(0, 2.5, 10, 17, 5.2, 0.2, lounge);
    this.box(0, 1.0, 9.84, 17, 0.08, 0.1, trim);
    for (const x of [-5, -2, 2, 5]) {
      this.box(x, 0.44, 7.8, 2, 0.16, 0.65, upholstery);
      this.box(x, 0.77, 8.05, 2, 0.6, 0.12, upholstery);
      for (const side of [-0.8, 0.8])
        this.box(x + side, 0.2, 7.8, 0.065, 0.4, 0.45, dark);
      this.box(x, 2.7, 9.8, 1.8, 1.25, 0.08, trim);
      this.box(
        x,
        2.7,
        9.73,
        1.65,
        1.1,
        0.05,
        new THREE.MeshStandardMaterial({ color: "#b9d4d1", roughness: 0.6 }),
      );
    }
    const crowdColors = [
      { shirt: "#b35447", skin: "#ad7451", hair: "#281e1b" },
      { shirt: "#d3a24e", skin: "#e0b38e", hair: "#4f3322" },
      { shirt: "#5e769f", skin: "#8c563b", hair: "#211d20" },
      { shirt: "#71885a", skin: "#e3b38b", hair: "#9b7348" },
    ];
    [-5, -2, 2, 5].forEach((x, i) => {
      const spectator = new Bowler(new THREE.Group(), crowdColors[i]);
      spectator.root.position.set(x, 0, 7.74);
      spectator.sit(i * 500, false, this.reduced);
      this.spectators.push(spectator);
      this.root.add(spectator.root);
    });
    this.reflection = new Reflector(new THREE.PlaneGeometry(15.4, 23.7), {
      color: 0xe2daca,
      textureWidth: 1024,
      textureHeight: 1024,
      clipBias: 0.002,
    });
    this.reflection.rotation.x = -Math.PI / 2;
    this.reflection.position.set(0, 0.008, -8.8);
    const reflectionMaterial = this.reflection.material as THREE.ShaderMaterial;
    reflectionMaterial.transparent = true;
    reflectionMaterial.depthWrite = false;
    reflectionMaterial.onBeforeCompile = (s) => {
      s.vertexShader =
        "varying vec2 laneUv;\n" +
        s.vertexShader.replace("void main() {", "void main() { laneUv = uv;");
      s.fragmentShader = "varying vec2 laneUv;\n" + s.fragmentShader;
      s.fragmentShader = s.fragmentShader.replace(
        "#include <tonemapping_fragment>",
        "float across = mod(laneUv.x * 15.4 + 1.433, 1.72); gl_FragColor.a = (across < 1.066 ? 0.13 : 0.0);\n#include <tonemapping_fragment>",
      );
    };
    this.root.add(this.reflection);
    const ballMaterial = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      map: this.ballTexture(),
      roughness: 0.13,
      metalness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    });
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.108, 32, 24),
      ballMaterial,
    );
    this.ball.castShadow = true;
    this.root.add(this.ball);
    this.ball.visible = false;
    this.heldBall = new THREE.Mesh(this.ball.geometry, ballMaterial);
    this.heldBall.position.set(0, -0.81, 0);
    this.heldBall.castShadow = true;
    this.bowler = new Bowler(this.heldBall);
    this.avatar = this.bowler.root;
    this.arm = this.bowler.arm;
    this.root.add(this.avatar);
    const shadowMap = canvasTexture(128, 128, (c) => {
      const g = c.createRadialGradient(64, 64, 2, 64, 64, 64);
      g.addColorStop(0, "#00000085");
      g.addColorStop(1, "#00000000");
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    });
    this.ballShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.48, 0.48),
      new THREE.MeshBasicMaterial({
        map: shadowMap,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.renderOrder = 2;
    this.root.add(this.ballShadow);
    const pts = Array.from(
      { length: 44 },
      (_, i) => new THREE.Vector3(0, 0.012, -0.5 - i * 0.29),
    );
    this.guide = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({
        color: "#fff4c5",
        dashSize: 0.12,
        gapSize: 0.13,
        transparent: true,
        opacity: 0.65,
      }),
    );
    this.guide.computeLineDistances();
    this.root.add(this.guide);
    this.camera.position.set(-2.9, 2.15, 4.3);
    this.resize();
    window.addEventListener("resize", this.resize);
  }
  private box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
  ) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    this.root.add(m);
    return m;
  }
  private makePin() {
    const g = new THREE.Group();
    const pin = new THREE.Mesh(this.pinGeometry, this.pinMaterial);
    pin.castShadow = true;
    pin.receiveShadow = false;
    g.add(pin);
    for (const y of [0.265, 0.283]) {
      const stripe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0295, 0.027, 0.011, 24),
        new THREE.MeshStandardMaterial({ color: "#bf282b", roughness: 0.35 }),
      );
      stripe.position.y = y;
      g.add(stripe);
    }
    return g;
  }
  private ballTexture() {
    return canvasTexture(1024, 512, (c) => {
      const data = c.createImageData(1024, 512);
      for (let y = 0; y < 512; y++)
        for (let x = 0; x < 1024; x++) {
          const u = (x / 1024) * Math.PI * 2,
            v = (y / 512) * Math.PI;
          const px = Math.sin(v) * Math.cos(u),
            py = Math.cos(v),
            pz = Math.sin(v) * Math.sin(u);
          const wave = Math.sin(
            px * 12 +
              py * 9 +
              Math.sin(pz * 9 + py * 6) * 2 +
              Math.sin(px * 19 - pz * 8) * 0.6,
          );
          const t = Math.pow((wave + 1) / 2, 3),
            i = (y * 1024 + x) * 4;
          data.data[i] = 18 + t * 61;
          data.data[i + 1] = 65 + t * 127;
          data.data[i + 2] = 110 + t * 111;
          data.data[i + 3] = 255;
        }
      c.putImageData(data, 0, 0);
      for (const [x, y, r] of [
        [504, 220, 15],
        [542, 220, 15],
        [523, 266, 19],
      ]) {
        c.fillStyle = "#071622";
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "#568caa";
        c.lineWidth = 3;
        c.stroke();
      }
    });
  }
  setHand(hand: Hand) {
    this.hand = hand;
    this.avatar.scale.x = hand === "right" ? 1 : -1;
    this.avatar.position.x = hand === "right" ? -0.207 : 0.207;
  }
  setPlaying(play: boolean) {
    this.intro = !play;
  }
  aim(angle: number, ready: boolean) {
    this.guide.rotation.y = -angle;
    this.guide.visible = ready && !this.follow;
  }
  track(sample: ArmSample | null, neutral: number) {
    if (sample?.valid)
      this.armTarget = clamp(
        Math.atan2(sample.forward - neutral, Math.max(0.25, sample.height)),
        -1.5,
        1.3,
      );
  }
  release() {
    this.releaseArm = this.arm.rotation.x;
    this.follow = true;
    this.resultAt = 0;
    this.replay.clear();
    this.launchedAt = performance.now();
    this.heldBall.visible = false;
    this.guide.visible = false;
  }
  ready() {
    this.follow = false;
    this.resultAt = 0;
    this.sweepAt = performance.now();
    this.heldBall.visible = true;
    this.armTarget = 0;
  }
  result(success: boolean, time: number) {
    this.resultAt = time;
    this.successful = success;
  }
  get shotPhase() {
    return this.shot;
  }
  get cutsceneDuration() {
    return this.reduced ? 3000 : 6500;
  }
  quality(high: boolean) {
    this.renderer.setPixelRatio(high ? Math.min(devicePixelRatio, 1.75) : 1);
    this.renderer.shadowMap.enabled = high;
    this.reflection.visible = high;
  }
  resize = () => {
    const { clientWidth: w, clientHeight: h } =
      this.renderer.domElement.parentElement!;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
  render(physics: BowlingPhysics, time: number) {
    if (this.disposed) return;
    const dt = Math.min(0.05, (time - this.last) / 1000 || 0.016);
    this.last = time;
    const ids = new Set(physics.pins.map((p) => p.id));
    for (const [id, m] of this.pinMeshes)
      if (!ids.has(id)) {
        this.root.remove(m);
        // Shared pin body resources live until scene disposal.
        m.traverse((child) => {
          if (
            child instanceof THREE.Mesh &&
            child.geometry !== this.pinGeometry
          ) {
            child.geometry.dispose();
            const materials = Array.isArray(child.material)
              ? child.material
              : [child.material];
            materials.forEach((material) => material.dispose());
          }
        });
        this.pinMeshes.delete(id);
      }
    for (const p of physics.pins) {
      let m = this.pinMeshes.get(p.id);
      if (!m) {
        m = this.makePin();
        this.pinMeshes.set(p.id, m);
        this.root.add(m);
      }
      const pos = p.body.translation(),
        q = p.body.rotation();
      m.position.set(pos.x, pos.y, pos.z);
      m.quaternion.set(q.x, q.y, q.z, q.w);
    }
    this.ball.visible = !!physics.ball;
    if (physics.ball) {
      const p = physics.ball.translation(),
        q = physics.ball.rotation();
      this.ball.position.set(p.x, p.y, p.z);
      this.ball.quaternion.set(q.x, q.y, q.z, q.w);
    }
    const capture = (body: {
      translation(): { x: number; y: number; z: number };
      rotation(): { x: number; y: number; z: number; w: number };
    }): TransformSnapshot => {
      const p = body.translation(),
        q = body.rotation();
      return { position: [p.x, p.y, p.z], rotation: [q.x, q.y, q.z, q.w] };
    };
    if (this.follow && !this.resultAt)
      this.replay.record({
        t: physics.elapsed,
        ball: physics.ball ? capture(physics.ball) : null,
        pins: physics.pins.map((p) => ({
          id: p.id,
          transform: capture(p.body),
        })),
      });
    const resultAge = this.resultAt ? (time - this.resultAt) / 1000 : -1;
    const replaying = resultAge >= 0.45 && resultAge < 3.7 && !this.reduced;
    const reaction = resultAge >= 3.7 && !this.reduced;
    if (replaying) {
      const frame = this.replay.sample(
        this.replay.impactStart() + (resultAge - 0.45) * 0.55,
      );
      if (frame) {
        const apply = (m: THREE.Object3D, t: TransformSnapshot) => {
          m.position.fromArray(t.position);
          m.quaternion.fromArray(t.rotation);
        };
        if (frame.ball) {
          this.ball.visible = true;
          apply(this.ball, frame.ball);
        }
        for (const pin of frame.pins) {
          const m = this.pinMeshes.get(pin.id);
          if (m) apply(m, pin.transform);
        }
      }
    }
    this.ballShadow.visible =
      this.ball.visible &&
      this.ball.position.y > -0.03 &&
      Math.abs(this.ball.position.x) < 0.54 &&
      !reaction;
    this.ballShadow.position.set(
      this.ball.position.x,
      0.014,
      this.ball.position.z,
    );
    this.ballShadow.scale.setScalar(
      1 + Math.max(0, this.ball.position.y - 0.108),
    );
    let cam: THREE.Vector3, look: THREE.Vector3, phase: string;
    if (replaying) {
      phase = "replay";
      cam = new THREE.Vector3(1.13, 0.78, -16.7);
      look = new THREE.Vector3(0, 0.17, -18.75);
    } else if (reaction) {
      phase = "reaction";
      cam = new THREE.Vector3(0.8, 1.2, -2.3);
      look = new THREE.Vector3(-0.65, 0.92, 0.38);
    } else if (this.follow) {
      const z = this.ball.position.z;
      if (this.reduced) {
        phase = "delivery";
        cam = new THREE.Vector3(0.1, 1.65, 3.3);
        look = new THREE.Vector3(0, 0.5, -12);
      } else {
        // One continuous dolly from the aiming camera: no new angle at release
        // or pin contact. The camera lowers as it advances, then holds the deck.
        const age = (time - this.launchedAt) / 1000;
        const travel = clamp((-z - 1) / 16, 0, 1);
        const eased = travel * travel * (3 - 2 * travel);
        phase = age < 0.65 ? "release" : z > -13 ? "follow" : "impact";
        cam = new THREE.Vector3(
          0.1,
          1.65 - 0.88 * eased,
          Math.max(-15.3, Math.min(3.3, z + 4.0)),
        );
        look = new THREE.Vector3(0, 0.5 - 0.25 * eased, -12 - 6.7 * eased);
      }
    } else if (this.intro) {
      phase = "intro";
      cam = new THREE.Vector3(-2.9, 2.15, 4.3);
      look = new THREE.Vector3(-0.2, 0.65, -6.0);
    } else {
      phase = "aim";
      cam = new THREE.Vector3(0.1, 1.65, 3.3);
      look = new THREE.Vector3(0, 0.5, -12);
    }
    const cut =
      phase !== this.shot &&
      (["replay", "reaction"].includes(phase) ||
        (phase === "aim" && this.shot === "reaction")) &&
      !this.reduced;
    const k = 1 - Math.exp(-dt * 3.5);
    if (cut) {
      this.camera.position.copy(cam);
      this.target.copy(look);
    } else {
      this.camera.position.lerp(cam, k);
      this.target.lerp(look, k);
    }
    this.shot = phase;
    this.camera.lookAt(this.target);
    const armAngle =
      this.arm.rotation.x +
      (this.armTarget - this.arm.rotation.x) * (1 - Math.exp(-dt * 14));
    this.bowler.pose(
      time,
      this.follow ? this.releaseArm : armAngle,
      this.follow ? (time - this.launchedAt) / 1000 : null,
      reaction ? resultAge - 3.7 : null,
      this.successful,
      this.reduced,
    );
    // Let the camera pass the bowler naturally instead of popping them away.
    this.avatar.visible = !replaying;
    const clearance = clamp((this.camera.position.z - 2.0) / 1.1, 0, 1);
    this.bowler.fade(
      this.follow && !reaction
        ? clearance * clearance * (3 - 2 * clearance)
        : 1,
    );
    this.spectators.forEach((spectator, i) =>
      spectator.sit(time + i * 830, reaction && this.successful, this.reduced),
    );
    if (reaction) this.ball.visible = false;
    const sweepAge = (time - this.sweepAt) / 1000;
    this.sweep.visible = !this.intro && !this.follow && sweepAge < 1.25;
    if (this.sweep.visible) {
      this.sweep.position.y = Math.max(0, 0.7 - sweepAge * 2);
      this.sweep.position.z = -18 - Math.min(1, sweepAge) * 1.8;
    }
    this.renderer.render(this.scene, this.camera);
  }
  private disposeObject(o: THREE.Object3D) {
    o.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const ms = Array.isArray(child.material)
          ? child.material
          : [child.material];
        for (const m of ms) {
          for (const v of Object.values(m))
            if (v instanceof THREE.Texture) v.dispose();
          m.dispose();
        }
      }
    });
  }
  dispose() {
    this.disposed = true;
    window.removeEventListener("resize", this.resize);
    this.reflection.getRenderTarget().dispose();
    this.disposeObject(this.root);
    this.environment.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
