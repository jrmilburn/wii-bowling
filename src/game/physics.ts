import RAPIER from "@dimforge/rapier3d-compat";
import { TUNING as C } from "../config";
import type { Throw } from "./throw";
export const pinPositions = Array.from({ length: 4 }, (_, row) =>
  Array.from({ length: row + 1 }, (_, j) => ({
    x: (j - row / 2) * 0.305,
    z: C.physics.pinZ - row * 0.264,
  })),
).flat();
export interface Pin {
  id: number;
  body: RAPIER.RigidBody;
}
export class BowlingPhysics {
  world: RAPIER.World;
  pins: Pin[] = [];
  ball: RAPIER.RigidBody | null = null;
  active = false;
  elapsed = 0;
  private accumulated = 0;
  private settled = 0;
  private queue: RAPIER.EventQueue;
  onImpact: (strength: number) => void = () => {};
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = C.physics.dt;
    this.world.integrationParameters.numSolverIterations = 8;
    this.world.integrationParameters.maxCcdSubsteps = 4;
    this.queue = new RAPIER.EventQueue(true);
    const box = (
      x: number,
      y: number,
      z: number,
      hx: number,
      hy: number,
      hz: number,
      friction = 0.18,
    ) =>
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, hy, hz)
          .setTranslation(x, y, z)
          .setFriction(friction)
          .setRestitution(0.12),
      );
    box(0, -0.12, -9, C.physics.laneHalfWidth, 0.12, 12);
    // Gutters have a lowered bed and an outside wall. A ball cannot roll back uphill.
    for (const side of [-1, 1]) {
      box(side * 0.66, -0.27, -9, 0.13, 0.055, 12, 0.08);
      box(side * 0.82, -0.02, -9, 0.025, 0.28, 12);
    }
    box(0, -0.22, -20.1, 0.84, 0.1, 0.8);
    box(0, 0.45, -21, 0.87, 0.7, 0.12);
    this.rack();
  }
  rack() {
    for (const p of this.pins) this.world.removeRigidBody(p.body);
    this.pins = [];
    pinPositions.forEach((p, id) => {
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(p.x, 0.001, p.z)
          .setLinearDamping(0.16)
          .setAngularDamping(0.28)
          .setCcdEnabled(true),
      );
      // Compound convex profile: stable flat foot, broad belly, slender neck and round head.
      this.world.createCollider(
        RAPIER.ColliderDesc.cylinder(0.035, 0.044)
          .setTranslation(0, 0.035, 0)
          .setMass(C.physics.pinMass * 0.28)
          .setFriction(0.28),
        body,
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.ball(0.058)
          .setTranslation(0, 0.115, 0)
          .setMass(C.physics.pinMass * (0.77 / 1.5))
          .setRestitution(0.34)
          .setFriction(0.23)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        body,
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.capsule(0.065, 0.025)
          .setTranslation(0, 0.237, 0)
          .setMass(C.physics.pinMass * 0.12)
          .setRestitution(0.3),
        body,
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.ball(0.039)
          .setTranslation(0, 0.34, 0)
          .setMass(C.physics.pinMass * (0.13 / 1.5))
          .setRestitution(0.3),
        body,
      );
      this.pins.push({ id, body });
    });
  }
  launch(t: Throw) {
    if (this.active) throw new Error("A delivery is already active");
    this.removeBall();
    const b = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, 0.17, 0.25)
        .setCcdEnabled(true)
        .setLinearDamping(0.025)
        .setAngularDamping(0.04),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(C.physics.ballRadius)
        .setMass(C.physics.ballMass)
        .setFriction(0.12)
        .setRestitution(0.12)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      b,
    );
    b.setLinvel(
      { x: Math.sin(t.angle) * t.speed, y: 0, z: -Math.cos(t.angle) * t.speed },
      true,
    );
    b.setAngvel({ x: -t.speed / C.physics.ballRadius, y: 0, z: 0 }, true);
    this.ball = b;
    this.active = true;
    this.elapsed = 0;
    this.settled = 0;
  }
  removeBall() {
    if (this.ball) this.world.removeRigidBody(this.ball);
    this.ball = null;
  }
  isDown(p: Pin) {
    const q = p.body.rotation(),
      pos = p.body.translation();
    return (
      1 - 2 * (q.x * q.x + q.z * q.z) < 0.72 ||
      pos.y < -0.06 ||
      Math.abs(pos.x) > 0.56 ||
      Math.abs(pos.z - pinPositions[p.id].z) > 0.5
    );
  }
  clearFallen() {
    const down = this.pins.filter((p) => this.isDown(p));
    for (const p of down) this.world.removeRigidBody(p.body);
    this.pins = this.pins.filter((p) => !down.includes(p));
    this.removeBall();
  }
  step(dt: number): number | null {
    this.accumulated = Math.min(
      this.accumulated + dt,
      C.physics.dt * C.physics.maxSteps,
    );
    while (this.accumulated >= C.physics.dt) {
      this.world.step(this.queue);
      this.accumulated -= C.physics.dt;
      this.queue.drainCollisionEvents((_a, _b, started) => {
        if (started && this.active)
          this.onImpact(
            this.ball ? Math.hypot(...Object.values(this.ball.linvel())) : 1,
          );
      });
      if (!this.active) continue;
      this.elapsed += C.physics.dt;
      const ballPast =
        !this.ball ||
        this.ball.translation().z < -19.3 ||
        this.ball.translation().y < -0.8 ||
        Math.hypot(...Object.values(this.ball.linvel())) < 0.15;
      const quiet = this.pins.every(
        (p) =>
          Math.hypot(...Object.values(p.body.linvel())) < 0.075 &&
          Math.hypot(...Object.values(p.body.angvel())) < 0.3,
      );
      this.settled = ballPast && quiet ? this.settled + C.physics.dt : 0;
      if (
        this.settled > C.physics.settleSeconds ||
        this.elapsed > C.physics.timeout
      ) {
        this.active = false;
        return this.pins.filter((p) => this.isDown(p)).length;
      }
    }
    return null;
  }
  dispose() {
    this.queue.free();
    this.world.free();
  }
}
export async function initPhysics() {
  await RAPIER.init();
  return new BowlingPhysics();
}
