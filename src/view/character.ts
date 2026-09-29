import * as THREE from "three";

/** An articulated original bowler. The face points down-lane (-Z). */
export class Bowler {
  readonly root = new THREE.Group();
  readonly arm = new THREE.Group();
  readonly otherArm = new THREE.Group();
  readonly legs = [new THREE.Group(), new THREE.Group()];
  private elbows = [new THREE.Group(), new THREE.Group()];
  private knees = [new THREE.Group(), new THREE.Group()];
  private feet = [new THREE.Group(), new THREE.Group()];
  private materials = new Set<THREE.Material>();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  constructor(
    ball: THREE.Object3D,
    colors: { shirt?: string; skin?: string; hair?: string } = {},
  ) {
    const skin = new THREE.MeshPhysicalMaterial({
      color: colors.skin ?? "#d49a73",
      roughness: 0.54,
      clearcoat: 0.12,
    });
    const fabric = new THREE.MeshStandardMaterial({
      color: colors.shirt ?? "#237c91",
      roughness: 0.84,
    });
    const cream = new THREE.MeshStandardMaterial({
      color: "#f4f0e4",
      roughness: 0.65,
    });
    const pants = new THREE.MeshStandardMaterial({
      color: "#243446",
      roughness: 0.9,
    });
    const hair = new THREE.MeshStandardMaterial({
      color: colors.hair ?? "#38281f",
      roughness: 0.82,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: "#17202b",
      roughness: 0.5,
    });
    const eye = new THREE.MeshPhysicalMaterial({
      color: "#352d23",
      roughness: 0.2,
    });
    const ellipsoid = (
      parent: THREE.Object3D,
      mat: THREE.Material,
      p: number[],
      s: number[],
    ) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), mat);
      m.position.set(p[0], p[1], p[2]);
      m.scale.set(s[0], s[1], s[2]);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const capsule = (
      parent: THREE.Object3D,
      mat: THREE.Material,
      radius: number,
      length: number,
      y: number,
    ) => {
      const m = new THREE.Mesh(
        new THREE.CapsuleGeometry(radius, length, 8, 20),
        mat,
      );
      m.position.y = y;
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    this.root.add(this.torso);
    this.torso.position.y = 0.73;
    const body = new THREE.Mesh(
      new THREE.LatheGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.14, -0.22, 0),
          new THREE.Vector3(0.16, -0.16, 0),
          new THREE.Vector3(0.18, 0.02, 0),
          new THREE.Vector3(0.2, 0.16, 0),
          new THREE.Vector3(0.16, 0.22, 0),
          new THREE.Vector3(0.065, 0.245, 0),
        ])
          .getPoints(32)
          .map((p) => new THREE.Vector2(p.x, p.y)),
        32,
      ),
      fabric,
    );
    body.scale.z = 0.72;
    body.castShadow = true;
    this.torso.add(body);
    capsule(this.torso, skin, 0.065, 0.06, 0.29);
    // Contrasting collar, placket, stitched sleeve bands and a small chest pocket.
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.072, 0.019, 8, 32),
      cream,
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.24;
    this.torso.add(collar);
    const placket = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.16, 0.008),
      cream,
    );
    placket.position.set(0, 0.12, -0.139);
    this.torso.add(placket);
    for (const y of [0.09, 0.14, 0.19])
      ellipsoid(this.torso, dark, [0, y, -0.147], [0.006, 0.006, 0.003]);
    const pocket = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.05, 0.01),
      fabric,
    );
    pocket.position.set(-0.09, 0.12, -0.137);
    this.torso.add(pocket);
    this.head.position.y = 1.25;
    this.root.add(this.head);
    ellipsoid(this.head, skin, [0, 0, 0], [0.185, 0.223, 0.176]);
    for (const side of [-1, 1]) {
      ellipsoid(
        this.head,
        skin,
        [side * 0.18, -0.015, 0],
        [0.039, 0.057, 0.035],
      );
      ellipsoid(
        this.head,
        cream,
        [side * 0.065, 0.017, -0.159],
        [0.046, 0.028, 0.017],
      );
      ellipsoid(
        this.head,
        eye,
        [side * 0.063, 0.015, -0.174],
        [0.019, 0.023, 0.008],
      );
      ellipsoid(
        this.head,
        cream,
        [side * 0.068, 0.023, -0.182],
        [0.005, 0.006, 0.003],
      );
      const brow = ellipsoid(
        this.head,
        hair,
        [side * 0.065, 0.068, -0.158],
        [0.05, 0.012, 0.013],
      );
      brow.rotation.z = side * 0.1;
    }
    ellipsoid(this.head, skin, [0, -0.028, -0.177], [0.032, 0.043, 0.045]);
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.041, 0.005, 8, 24, Math.PI * 0.7),
      new THREE.MeshStandardMaterial({ color: "#804638", roughness: 0.7 }),
    );
    smile.position.set(0.022, -0.077, -0.177);
    smile.rotation.z = Math.PI * 1.15;
    this.head.add(smile);
    // Sculpted cap and overlapping locks retain a readable silhouette from behind.
    ellipsoid(this.head, hair, [0, 0.133, 0.027], [0.19, 0.126, 0.171]);
    ellipsoid(this.head, hair, [0, 0.036, 0.133], [0.176, 0.135, 0.058]);
    for (let i = 0; i < 7; i++) {
      const lock = ellipsoid(
        this.head,
        hair,
        [-0.145 + i * 0.044, 0.14, -0.105],
        [0.054, 0.081, 0.058],
      );
      lock.rotation.z = -0.38;
    }
    for (const [i, side] of [-1, 1].entries()) {
      const leg = this.legs[i];
      leg.position.set(side * 0.083, 0.52, 0);
      this.root.add(leg);
      capsule(leg, pants, 0.061, 0.11, -0.115);
      const knee = this.knees[i];
      knee.position.y = -0.23;
      leg.add(knee);
      capsule(knee, pants, 0.053, 0.115, -0.085);
      const foot = this.feet[i];
      foot.position.y = -0.225;
      knee.add(foot);
      ellipsoid(foot, dark, [0, 0, -0.055], [0.078, 0.052, 0.14]);
      ellipsoid(foot, cream, [0, 0.04, -0.085], [0.07, 0.045, 0.1]);
      for (let j = 0; j < 3; j++) {
        const lace = new THREE.Mesh(
          new THREE.BoxGeometry(0.065, 0.006, 0.009),
          cream,
        );
        lace.position.set(0, 0.083, -0.07 - j * 0.021);
        foot.add(lace);
      }
    }
    for (const [joint, side] of [
      [this.arm, 1],
      [this.otherArm, -1],
    ] as const) {
      joint.position.set(side * 0.207, 0.91, 0);
      this.root.add(joint);
      capsule(joint, fabric, 0.07, 0.095, -0.06);
      const cuff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.071, 0.071, 0.025, 24),
        cream,
      );
      cuff.position.y = -0.145;
      joint.add(cuff);
      capsule(joint, skin, 0.044, 0.045, -0.2);
      const elbow = this.elbows[side === 1 ? 0 : 1];
      elbow.position.y = -0.25;
      joint.add(elbow);
      capsule(elbow, skin, 0.041, 0.13, -0.09);
      ellipsoid(elbow, skin, [0, -0.215, 0], [0.049, 0.071, 0.045]);
      ellipsoid(
        elbow,
        skin,
        [-side * 0.037, -0.206, -0.018],
        [0.02, 0.038, 0.02],
      );
    }
    ball.position.set(0, -0.315, -0.012);
    this.root.position.set(-0.207, 0, 0.38);
    this.root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        for (const material of Array.isArray(child.material)
          ? child.material
          : [child.material])
          this.materials.add(material);
      }
    });
    // The held ball shares a material with the delivered ball; never fade that
    // material when hiding the character for camera clearance.
    this.elbows[0].add(ball);
  }
  fade(opacity: number) {
    this.materials.forEach((material) => {
      const transparent = opacity < 1;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.opacity = opacity;
      material.depthWrite = !transparent;
    });
  }
  sit(time: number, cheer: boolean, reduced: boolean) {
    const idle = reduced ? 0 : Math.sin(time * 0.0014);
    this.head.rotation.y = idle * 0.08;
    for (let i = 0; i < 2; i++) {
      this.legs[i].rotation.x = Math.PI / 2;
      this.knees[i].rotation.x = -Math.PI / 2 + idle * (i === 0 ? 0.06 : -0.04);
      this.feet[i].rotation.x = 0;
      this.elbows[i].rotation.x = cheer ? 1.25 : 0.9;
    }
    this.arm.rotation.x = this.otherArm.rotation.x = cheer ? 0.85 : 0.15;
    this.arm.rotation.z = cheer ? -0.2 - Math.abs(idle) * 0.22 : -0.12;
    this.otherArm.rotation.z = cheer ? 0.2 + Math.abs(idle) * 0.22 : 0.12;
  }
  pose(
    time: number,
    swing: number,
    releaseAge: number | null,
    reactionAge: number | null,
    success: boolean,
    reduced: boolean,
  ) {
    const smooth = (t: number) => {
      const x = Math.max(0, Math.min(1, t));
      return x * x * (3 - 2 * x);
    };
    const reaction = reactionAge !== null;
    const celebrate = reaction ? smooth(reactionAge / 0.55) : 0;
    const breath = reduced ? 0 : Math.sin(time * 0.0018) * 0.004;
    this.torso.position.y = 0.73 + breath;
    this.head.rotation.z = celebrate * (success ? -0.08 : 0.08);
    this.root.rotation.y = -0.18 * celebrate;
    this.root.position.y =
      reaction && success && !reduced
        ? Math.sin(
            Math.PI * Math.max(0, Math.min(1, (reactionAge - 0.45) / 0.65)),
          ) * 0.055
        : 0;
    const delivery = releaseAge !== null;
    const follow = delivery
      ? Math.sin(Math.min(1, releaseAge / 1.8) * Math.PI)
      : 0;
    // Start exactly at the tracked release pose, accelerate into follow-through,
    // then settle through a longer eased recovery without snapping to idle.
    const releaseAngle = !delivery
      ? swing
      : releaseAge < 0.48
        ? swing + (1.35 - swing) * smooth(releaseAge / 0.48)
        : 1.35 * (1 - smooth((releaseAge - 0.48) / 1.32));
    this.arm.rotation.x = reaction
      ? success
        ? 2.7 * celebrate
        : 0.3 * celebrate
      : releaseAngle;
    this.arm.rotation.z = -0.06 - (success ? 0.29 * celebrate : 0);
    this.otherArm.rotation.x =
      reaction && success ? 2.5 * celebrate : -0.32 * follow;
    this.otherArm.rotation.z =
      0.1 + (reaction && success ? 0.3 * celebrate : 0.26 * follow);
    this.elbows[0].rotation.x =
      0.28 * follow + (success ? 0.35 * celebrate : 0);
    this.elbows[1].rotation.x = 0.15 * follow + 0.4 * celebrate;
    this.legs[0].rotation.x = -0.12 * follow;
    this.legs[1].rotation.x = 0.32 * follow;
    this.knees[0].rotation.x = 0.24 * follow;
    this.knees[1].rotation.x = -0.6 * follow;
    for (let i = 0; i < 2; i++) {
      const hip = this.legs[i].rotation.x,
        knee = this.knees[i].rotation.x;
      this.feet[i].rotation.x = -hip - knee;
      this.legs[i].position.y =
        0.055 +
        0.23 * Math.cos(hip) +
        0.225 * Math.cos(hip + knee) +
        (i === 1 ? 0.025 * follow : 0);
      this.legs[i].position.z =
        i === 0 ? 0.23 * Math.sin(hip) + 0.225 * Math.sin(hip + knee) : 0;
    }
    this.torso.rotation.x = -0.1 * follow;
    this.torso.rotation.y = -0.08 * follow;
    this.head.position.z = -0.02 * follow;
  }
}
