/**
 * Game-Ready Procedural 2D Pivot-Cutout Animations (v4 - 4 View Directions Aware!)
 *
 * Adapts automatically to `skeleton.viewDirection`:
 * - 'front' (Tampak Depan): Alternating vertical foot-lift & perspective stride (legs never swing
 *   45 deg sideways like a pendulum!), torso weight shift, breathing, and forward lunge attacks.
 * - 'back' (Tampak Belakang): North-facing RPG walk/run with vertical foot lift and cape/hair bounce.
 * - 'side_right' (Tampak Samping Kanan / 3/4 Kanan): Right-facing forward lean & wide scissor leg stride.
 * - 'side_left' (Tampak Samping Kiri / 3/4 Kiri): Mirror of side_right (left-facing forward lean & scissor stride).
 */

const TAU = Math.PI * 2;

export const ANIMATION_LIST = [
  { id: 'run',     name: 'Run (Lari)',         defaultFps: 14, defaultFrames: 8,  loop: true,  icon: '🏃' },
  { id: 'idle',    name: 'Idle (Napas)',       defaultFps: 8,  defaultFrames: 8,  loop: true,  icon: '🧘' },
  { id: 'walk',    name: 'Walk (Jalan)',       defaultFps: 10, defaultFrames: 8,  loop: true,  icon: '🚶' },
  { id: 'dash',    name: 'Dash (Dodge)',       defaultFps: 14, defaultFrames: 6,  loop: true,  icon: '💨' },
  { id: 'jump',    name: 'Jump (Lompat)',      defaultFps: 12, defaultFrames: 8,  loop: true,  icon: '🦘' },
  { id: 'attack',  name: 'Attack (Serang)',    defaultFps: 14, defaultFrames: 8,  loop: true,  icon: '⚔️' },
  { id: 'cast',    name: 'Cast Spell (Sihir)', defaultFps: 10, defaultFrames: 8,  loop: true,  icon: '✨' },
  { id: 'block',   name: 'Block (Bertahan)',   defaultFps: 8,  defaultFrames: 6,  loop: true,  icon: '🛡️' },
  { id: 'gather',  name: 'Mine / Gather',      defaultFps: 12, defaultFrames: 8,  loop: true,  icon: '⛏️' },
  { id: 'hurt',    name: 'Hurt (Kena Hit)',    defaultFps: 12, defaultFrames: 6,  loop: true,  icon: '💥' },
  { id: 'death',   name: 'Death (KO)',         defaultFps: 10, defaultFrames: 8,  loop: false, icon: '💀' },
  { id: 'victory', name: 'Victory',            defaultFps: 10, defaultFrames: 8,  loop: true,  icon: '🎉' },
];

export function evaluateAnimation(animId, t, skeleton, params = {}) {
  const I = params.intensity ?? 1.0;
  const SQ = params.squash ?? 1.0;
  const h = skeleton?.bounds?.height || 204;
  const viewDir = skeleton?.viewDirection || (skeleton?.templateId === 'knight_34' ? 'side_right' : 'front');

  let pose;
  const weaponSide = findWeaponSide(skeleton);
  if (animId === 'attack' && weaponSide) {
    pose = evaluateWeaponAttack(t, h, I, SQ, skeleton, weaponSide);
  } else if ((viewDir === 'front' || viewDir === 'back') && skeleton?.templateId !== 'knight_34') {
    pose = evaluateFrontOrBackAnimation(animId, t, h, I, SQ, viewDir === 'back');
  } else {
    const dir = viewDir === 'side_left' ? -1 : 1;
    pose = evaluateSideAnimation(animId, t, h, I, SQ, dir);
  }

  if (!pose.sway) {
    const amp = { idle: 0.004, walk: 0.007, run: 0.013, dash: 0.014, jump: 0.012, attack: 0.016, hurt: 0.012 }[animId] ?? 0.008;
    pose.sway = { phase: (t % 1) * TAU, amp: amp * I };
  }
  return pose;
}

function findWeaponSide(skeleton) {
  const j = skeleton?.joints?.find((x) => x.id === 'weapon_r' || x.id === 'weapon_l');
  return j ? j.id.slice(-1) : null;
}

const easeInOut = (k) => k * k * (3 - 2 * k);
const clamp01 = (k) => Math.max(0, Math.min(1, k));

/**
 * Overhead sword chop for characters with a detected long weapon:
 * crouch + raise (anticipation) -> fast sweep with slash trail -> follow-through -> recover.
 */
function evaluateWeaponAttack(t, h, I, SQ, skeleton, side) {
  const p = t % 1;
  const sg = side === 'r' ? 1 : -1; // screen-left weapon rotates clockwise (+), mirrored for screen-right
  const other = side === 'r' ? 'l' : 'r';
  const joints = Object.fromEntries(skeleton.joints.map((j) => [j.id, j]));
  const hand = joints['hand_' + side];
  const tip = joints['weapon_' + side];
  let bind = Math.atan2(tip.y - hand.y, tip.x - hand.x);
  if (sg < 0) bind = Math.PI - bind; // reflect into the "screen-left" frame
  const norm = (a) => ((a % TAU) + TAU) % TAU;
  const windRot = norm((250 * Math.PI) / 180 - bind);
  let endRot = norm((70 * Math.PI) / 180 - bind);
  if (endRot <= windRot + 0.5) endRot += TAU;

  // Timeline
  let rot = 0, wind = 0, strike = 0, recover = 0;
  if (p < 0.32) {
    wind = easeInOut(p / 0.32);
    rot = windRot * wind;
  } else if (p < 0.42) {
    wind = 1;
    rot = windRot + Math.sin(((p - 0.32) / 0.1) * Math.PI) * 0.05;
  } else if (p < 0.62) {
    const k = clamp01((p - 0.42) / 0.2);
    strike = k * k;
    wind = 1 - strike;
    rot = windRot + (endRot - windRot) * strike;
  } else if (p < 0.72) {
    strike = 1;
    rot = endRot + Math.sin(((p - 0.62) / 0.1) * Math.PI * 0.5) * 0.12;
  } else {
    const k = easeInOut((p - 0.72) / 0.28);
    recover = k;
    strike = 1 - k;
    rot = endRot * (1 - k) + (endRot - TAU) * 0 ; // blend back to bind pose (TAU-periodic)
    rot = (endRot - TAU) * (1 - k);
  }

  const pose = {
    rootOffset: { x: 0, y: 0 },
    rootScale: { x: 1, y: 1 },
    rotations: {},
    offsets: {},
    partAngles: {},
    partOffsets: {},
    flash: 0,
  };
  const R = pose.rotations;
  const crouch = wind * (p < 0.42 ? 1 : 0.6);

  pose.rootOffset.y = (crouch * 0.04 - strike * 0.012) * h * I;
  pose.rootOffset.x = sg * (-wind * 0.02 + strike * 0.035) * h * I;
  pose.rootScale.x = 1 + (strike * 0.035 + crouch * 0.025) * I * SQ;
  pose.rootScale.y = 1 + (strike * 0.045 - crouch * 0.05) * I * SQ;

  R.hip = sg * (-wind * 0.06 + strike * 0.10) * I;
  R.neck = sg * (wind * 0.05 - strike * 0.09) * I;

  R['shoulder_' + side] = rot * 0.55 * I;
  R['elbow_' + side] = rot * 0.45 * I;
  R['hand_' + side] = 0;
  if (sg < 0) {
    R['shoulder_' + side] *= -1;
    R['elbow_' + side] *= -1;
    R['hand_' + side] *= -1;
  }
  // Shield arm braces forward during the strike
  R['shoulder_' + other] = -sg * (wind * 0.10 - strike * 0.16) * I;

  // Feet plant & widen on the strike
  pose.offsets.hip_l = { x: -strike * h * 0.015 * I, y: 0 };
  pose.offsets.hip_r = { x: strike * h * 0.015 * I, y: 0 };

  // Slash trail during the sweep
  const sweepK = p >= 0.44 && p < 0.7 ? Math.sin(clamp01((p - 0.44) / 0.26) * Math.PI) : 0;
  if (sweepK > 0.02) {
    pose.slash = { side, alpha: Math.min(1, sweepK * 1.25), trail: 1.9 * Math.min(1, sweepK * 1.4) };
  }

  pose.sway = { phase: p * TAU, amp: (0.012 + strike * 0.012 + wind * 0.008) * I };
  return pose;
}

/**
 * Choreographed specifically for FRONT-VIEW & BACK-VIEW sprites (Aetheria Heroes: Sven, Kali, Ymir, Hyeonxa).
 * Uses vertical stepping (offsets.y), subtle perspective weight shift, and clean arm/head motion
 * so front-facing legs and background weapons NEVER tear or swing sideways like pendulums!
 */
function evaluateFrontOrBackAnimation(animId, t, h, I, SQ, isBack = false) {
  const p = t % 1;
  const s1 = Math.sin(p * TAU);
  const c1 = Math.cos(p * TAU);
  const s2 = Math.sin(p * TAU * 2);
  const c2 = Math.cos(p * TAU * 2);

  const pose = {
    rootOffset: { x: 0, y: 0 },
    rootScale: { x: 1, y: 1 },
    rotations: {},
    offsets: {},
    partAngles: {},
    partOffsets: {},
    flash: 0,
  };

  const R = pose.rotations;
  const O = pose.offsets;
  const PA = pose.partAngles;
  const PO = pose.partOffsets;

  switch (animId) {
    case 'idle': {
      const breath = (s1 + 1) * 0.5;
      pose.rootOffset.y = -breath * h * 0.016 * I;
      pose.rootScale.x = 1 + (0.012 - breath * 0.024) * I * SQ;
      pose.rootScale.y = 1 - (0.012 - breath * 0.024) * I * SQ;

      R.hip = s1 * 0.018 * I;
      R.neck = Math.sin(p * TAU - 0.6) * 0.04 * I;

      R.shoulder_r = (0.02 + s1 * 0.045) * I;
      R.elbow_r = Math.sin(p * TAU - 0.7) * 0.05 * I;
      R.shoulder_l = (-0.02 - s1 * 0.045) * I;

      PA.tasset_cape = Math.sin(p * TAU - 0.9) * 0.025 * I;
      PO.tasset_cape = { x: 0, y: -breath * h * 0.01 * I };
      break;
    }

    case 'walk': {
      // Front/Back Walk: alternating vertical knee/foot lift + weight shift left-right
      const bounce = Math.abs(s1);
      pose.rootOffset.y = (-bounce * 0.032 + 0.010) * h * I;
      pose.rootOffset.x = s1 * h * 0.016 * I;
      pose.rootScale.x = 1 + (0.018 - bounce * 0.034) * I * SQ;
      pose.rootScale.y = 1 - (0.018 - bounce * 0.034) * I * SQ;

      // Subtle hip & shoulder counter-tilt
      R.hip = s1 * 0.042 * I;
      R.neck = -s1 * 0.05 * I;

      // Left leg lifts when s1 > 0; Right leg lifts when s1 < 0
      const liftL = Math.max(0, s1);
      const liftR = Math.max(0, -s1);

      O.hip_l = { x: 0, y: (-liftL * 0.038 + liftR * 0.012) * h * I };
      O.knee_l = { x: 0, y: -liftL * 0.028 * h * I };
      R.hip_l = (liftL * 0.07 - liftR * 0.03) * I;
      R.knee_l = -liftL * 0.08 * I;

      O.hip_r = { x: 0, y: (-liftR * 0.038 + liftL * 0.012) * h * I };
      O.knee_r = { x: 0, y: -liftR * 0.028 * h * I };
      R.hip_r = (-liftR * 0.07 + liftL * 0.03) * I;
      R.knee_r = liftR * 0.08 * I;

      // Arms pump counter to legs
      R.shoulder_r = -s1 * 0.10 * I;
      R.elbow_r = -s1 * 0.08 * I;
      R.shoulder_l = -s1 * 0.10 * I;
      O.shoulder_r = { x: 0, y: liftR * h * 0.015 * I };
      O.shoulder_l = { x: 0, y: liftL * h * 0.015 * I };

      PA.tasset_cape = -s1 * 0.035 * I;
      PO.tasset_cape = { x: -s1 * h * 0.008 * I, y: -bounce * h * 0.015 * I };
      break;
    }

    case 'run': {
      // Front/Back Run: energetic vertical knee drive toward/away from camera + dynamic bounce
      const bounce = Math.abs(s1);
      pose.rootOffset.y = (-bounce * 0.062 + 0.022) * h * I;
      pose.rootOffset.x = s1 * h * 0.026 * I;
      pose.rootScale.x = 1 + (0.032 - bounce * 0.058) * I * SQ;
      pose.rootScale.y = 1 - (0.032 - bounce * 0.058) * I * SQ;

      R.hip = s1 * 0.075 * I;
      R.neck = (-s1 * 0.08 + s2 * 0.03) * I;

      const liftL = Math.max(0, s1);
      const liftR = Math.max(0, -s1);

      // High vertical knee drive without sideways pendulum tearing
      O.hip_l = { x: liftL * h * 0.012 * I, y: (-liftL * 0.068 + liftR * 0.018) * h * I };
      O.knee_l = { x: 0, y: -liftL * 0.048 * h * I };
      R.hip_l = (liftL * 0.12 - liftR * 0.05) * I;
      R.knee_l = -liftL * 0.14 * I;

      O.hip_r = { x: -liftR * h * 0.012 * I, y: (-liftR * 0.068 + liftL * 0.018) * h * I };
      O.knee_r = { x: 0, y: -liftR * 0.048 * h * I };
      R.hip_r = (-liftR * 0.12 + liftL * 0.05) * I;
      R.knee_r = liftR * 0.14 * I;

      // Energetic arm & shoulder pump
      R.shoulder_r = -s1 * 0.16 * I;
      R.elbow_r = -s1 * 0.12 * I;
      R.shoulder_l = -s1 * 0.16 * I;
      O.shoulder_r = { x: 0, y: (liftR - 0.3) * h * 0.025 * I };
      O.shoulder_l = { x: 0, y: (liftL - 0.3) * h * 0.025 * I };

      // Back greatsword / hair / cape bounces dynamically behind
      PA.tasset_cape = (-s1 * 0.06 + s2 * 0.03) * I;
      PO.tasset_cape = { x: -s1 * h * 0.012 * I, y: -bounce * h * 0.025 * I };
      break;
    }

    case 'dash': {
      const burst = Math.sin(p * Math.PI);
      const dirSign = isBack ? -1 : 1;
      pose.rootOffset.y = -burst * h * 0.05 * dirSign * I;
      pose.rootOffset.x = burst * h * 0.08 * I;
      pose.rootScale.x = 1 + burst * 0.09 * I * SQ;
      pose.rootScale.y = 1 + burst * 0.06 * I * SQ;

      R.hip = 0.12 * burst * I;
      R.neck = -0.08 * burst * I;
      O.hip_l = { x: -burst * h * 0.02 * I, y: -burst * h * 0.05 * I };
      O.hip_r = { x: burst * h * 0.02 * I, y: -burst * h * 0.02 * I };
      PA.tasset_cape = -0.10 * burst * I;
      break;
    }

    case 'jump': {
      let yOff = 0, sx = 1, sy = 1, legLift = 0, armLift = 0;
      if (p < 0.20) {
        const k = Math.sin((p / 0.20) * Math.PI * 0.5);
        yOff = k * h * 0.055 * I;
        sx = 1 + 0.08 * k * I * SQ;
        sy = 1 - 0.08 * k * I * SQ;
        legLift = -k * 0.02;
        armLift = k * 0.08;
      } else if (p < 0.78) {
        const airT = (p - 0.20) / 0.58;
        const arc = Math.sin(airT * Math.PI);
        yOff = -arc * h * 0.20 * I;
        sx = 1 - 0.05 * arc * I * SQ;
        sy = 1 + 0.06 * arc * I * SQ;
        legLift = arc * 0.065;
        armLift = -arc * 0.18;
      } else {
        const k = Math.sin(((p - 0.78) / 0.22) * Math.PI);
        yOff = k * h * 0.05 * I;
        sx = 1 + 0.10 * k * I * SQ;
        sy = 1 - 0.10 * k * I * SQ;
        legLift = -k * 0.02;
        armLift = k * 0.06;
      }

      pose.rootOffset.y = yOff;
      pose.rootScale.x = sx;
      pose.rootScale.y = sy;
      O.hip_l = { x: 0, y: -legLift * h * I };
      O.knee_l = { x: 0, y: -legLift * 0.8 * h * I };
      O.hip_r = { x: 0, y: -legLift * 0.7 * h * I };
      O.knee_r = { x: 0, y: -legLift * 0.5 * h * I };
      R.shoulder_r = armLift * I;
      R.shoulder_l = -armLift * I;
      PO.tasset_cape = { x: 0, y: -legLift * 0.4 * h * I };
      break;
    }

    case 'attack': {
      // Front-View Forward Slash Lunge (character winds up then lunges forward toward camera!)
      let wind = 0, strike = 0;
      if (p < 0.34) {
        wind = Math.sin((p / 0.34) * Math.PI * 0.5);
      } else if (p < 0.58) {
        const k = (p - 0.34) / 0.24;
        const ease = 1 - Math.pow(1 - k, 3);
        wind = 1 - ease;
        strike = ease;
      } else {
        const k = (p - 0.58) / 0.42;
        strike = Math.cos(k * Math.PI * 0.5);
      }

      // Lunge scale effect toward camera
      const lungeScale = 1 + (strike * 0.09 - wind * 0.04) * I * SQ;
      pose.rootScale.x = lungeScale;
      pose.rootScale.y = lungeScale;
      pose.rootOffset.y = (-wind * 0.03 + strike * 0.04) * h * I;
      pose.rootOffset.x = (-wind * 0.03 + strike * 0.04) * h * I;

      R.hip = (-wind * 0.10 + strike * 0.14) * I;
      R.neck = (wind * 0.06 - strike * 0.10) * I;

      R.shoulder_r = (wind * 0.25 - strike * 0.45) * I;
      R.elbow_r = (wind * 0.20 - strike * 0.38) * I;
      R.shoulder_l = (-wind * 0.18 + strike * 0.28) * I;

      O.hip_l = { x: -strike * h * 0.02 * I, y: -strike * h * 0.025 * I };
      O.hip_r = { x: strike * h * 0.02 * I, y: -wind * h * 0.02 * I };

      PA.tasset_cape = (-wind * 0.12 + strike * 0.18) * I;
      break;
    }

    case 'cast': {
      const pulse = Math.sin(p * TAU * 2);
      const lift = 0.65 + 0.35 * s1;
      pose.rootOffset.y = -(0.045 + 0.03 * s1) * h * I;
      pose.rootScale.x = 1 - 0.02 * lift * I * SQ;
      pose.rootScale.y = 1 + 0.03 * lift * I * SQ;

      R.neck = (-0.06 + pulse * 0.04) * I;
      R.shoulder_r = (-0.22 - pulse * 0.08) * I;
      R.shoulder_l = (0.22 + pulse * 0.08) * I;
      O.hip_l = { x: 0, y: -0.025 * lift * h * I };
      O.hip_r = { x: 0, y: -0.015 * lift * h * I };
      PA.tasset_cape = pulse * 0.06 * I;
      break;
    }

    case 'block': {
      const brace = 0.72 + 0.28 * s1;
      pose.rootOffset.y = h * 0.03 * brace * I;
      pose.rootScale.x = 1 + 0.04 * brace * I * SQ;
      pose.rootScale.y = 1 - 0.04 * brace * I * SQ;
      R.hip = -0.04 * brace * I;
      R.neck = 0.05 * brace * I;
      R.shoulder_r = 0.16 * brace * I;
      R.shoulder_l = -0.16 * brace * I;
      break;
    }

    case 'gather': {
      const swing = s1;
      const down = Math.max(0, -swing);
      pose.rootOffset.y = down * h * 0.045 * I;
      pose.rootScale.x = 1 + down * 0.06 * I * SQ;
      pose.rootScale.y = 1 - down * 0.06 * I * SQ;
      R.hip = down * 0.12 * I;
      R.shoulder_r = (-0.20 + swing * 0.32) * I;
      R.shoulder_l = (0.15 - swing * 0.22) * I;
      break;
    }

    case 'hurt': {
      const hit = Math.sin(p * Math.PI);
      const shake = Math.sin(p * TAU * 4) * (1 - p);
      pose.rootOffset.x = (shake * 0.035 - hit * 0.04) * h * I;
      pose.rootOffset.y = -hit * 0.025 * h * I;
      pose.rootScale.x = 1 + hit * 0.07 * I * SQ;
      pose.rootScale.y = 1 - hit * 0.07 * I * SQ;
      pose.flash = p < 0.35 ? (1 - p / 0.35) * 0.78 : 0;

      R.hip = -hit * 0.14 * I;
      R.neck = -hit * 0.18 * I;
      R.shoulder_r = hit * 0.25 * I;
      R.shoulder_l = -hit * 0.25 * I;
      break;
    }

    case 'death': {
      const fall = Math.min(1, p / 0.76);
      const ease = fall * fall * (3 - 2 * fall);
      pose.rootOffset.y = ease * h * 0.32 * I;
      pose.rootOffset.x = -ease * h * 0.10 * I;
      R.hip = -ease * 1.15 * I;
      R.neck = -ease * 0.22 * I;
      R.shoulder_r = ease * 0.35 * I;
      R.shoulder_l = -ease * 0.35 * I;
      break;
    }

    case 'victory': {
      const hop = Math.abs(s1);
      pose.rootOffset.y = -hop * h * 0.09 * I;
      pose.rootScale.x = 1 + (0.035 - hop * 0.07) * I * SQ;
      pose.rootScale.y = 1 - (0.035 - hop * 0.07) * I * SQ;

      R.hip = s1 * 0.06 * I;
      R.neck = c1 * 0.07 * I;
      R.shoulder_r = (-0.25 - hop * 0.18) * I;
      R.shoulder_l = (0.25 + hop * 0.18) * I;
      O.hip_l = { x: 0, y: -hop * h * 0.03 * I };
      O.hip_r = { x: 0, y: -hop * h * 0.03 * I };
      break;
    }
  }

  return pose;
}

/**
 * Choreographed for SIDE-RIGHT (dir = 1) and SIDE-LEFT (dir = -1) 3/4 & Side-View sprites.
 */
function evaluateSideAnimation(animId, t, h, I, SQ, dir = 1) {
  const p = t % 1;
  const s1 = Math.sin(p * TAU);
  const c1 = Math.cos(p * TAU);
  const s2 = Math.sin(p * TAU * 2);
  const c2 = Math.cos(p * TAU * 2);

  const pose = {
    rootOffset: { x: 0, y: 0 },
    rootScale: { x: 1, y: 1 },
    rotations: {},
    offsets: {},
    partAngles: {},
    partOffsets: {},
    flash: 0,
  };

  const R = pose.rotations;
  const PA = pose.partAngles;
  const PO = pose.partOffsets;

  switch (animId) {
    case 'run': {
      const bounce = Math.abs(s1);
      pose.rootOffset.y = (-bounce * 0.062 + 0.028) * h * I;
      pose.rootOffset.x = dir * (0.025 + s2 * 0.010) * h * I;
      pose.rootScale.x = 1 + (0.030 - bounce * 0.055) * I * SQ;
      pose.rootScale.y = 1 - (0.030 - bounce * 0.055) * I * SQ;

      R.hip = dir * (0.30 + s2 * 0.04) * I;
      R.neck = dir * (-0.15 - s2 * 0.045) * I;

      PA.tasset_cape = dir * (0.12 + Math.sin(p * TAU * 2 - 0.9) * 0.10) * I;
      PO.tasset_cape = { x: -dir * h * 0.012 * I, y: 0 };

      const stride = 0.76;
      const pelvisTwistX = h * 0.036 * I;

      R.hip_l = -dir * s1 * stride * I;
      pose.offsets.hip_l = { x: dir * s1 * pelvisTwistX, y: -Math.max(0, s1) * h * 0.018 * I };
      const kneeDriveL = Math.max(0, s1) * 0.38;
      const kneeKickL = Math.max(0, -s1) * 0.45 + Math.max(0, -c1) * 0.25;
      R.knee_l = dir * (0.08 + kneeDriveL + kneeKickL) * I;

      R.hip_r = dir * s1 * stride * I;
      pose.offsets.hip_r = { x: -dir * s1 * pelvisTwistX, y: -Math.max(0, -s1) * h * 0.018 * I };
      const kneeDriveR = Math.max(0, -s1) * 0.38;
      const kneeKickR = Math.max(0, s1) * 0.45 + Math.max(0, c1) * 0.25;
      R.knee_r = dir * (0.08 + kneeDriveR + kneeKickR) * I;

      R.shoulder_r = dir * (-0.14 + s1 * 0.38) * I;
      R.elbow_r = dir * (-0.12 + Math.sin(p * TAU - 0.5) * 0.22) * I;

      R.shoulder_l = dir * (-0.08 - s1 * 0.14) * I;
      PO.shield_arm_l = {
        x: dir * (-0.022 + s1 * 0.016) * h * I,
        y: (-0.010 - bounce * 0.016) * h * I,
      };
      break;
    }

    case 'idle': {
      const breath = (s1 + 1) * 0.5;
      pose.rootOffset.y = -breath * h * 0.016 * I;
      pose.rootScale.x = 1 + (0.014 - breath * 0.028) * I * SQ;
      pose.rootScale.y = 1 - (0.014 - breath * 0.028) * I * SQ;

      R.hip = dir * s1 * 0.022 * I;
      R.neck = dir * Math.sin(p * TAU - 0.6) * 0.045 * I;
      R.shoulder_r = dir * (0.03 + s1 * 0.065) * I;
      R.elbow_r = dir * Math.sin(p * TAU - 0.7) * 0.075 * I;
      R.shoulder_l = dir * (-0.02 - s1 * 0.05) * I;
      PO.shield_arm_l = { x: 0, y: -s1 * h * 0.012 * I };
      PA.tasset_cape = dir * Math.sin(p * TAU - 0.8) * 0.05 * I;
      break;
    }

    case 'walk': {
      const bounce = Math.abs(s1);
      pose.rootOffset.y = (-bounce * 0.036 + 0.012) * h * I;
      pose.rootScale.x = 1 + (0.022 - bounce * 0.042) * I * SQ;
      pose.rootScale.y = 1 - (0.022 - bounce * 0.042) * I * SQ;

      R.hip = dir * (0.12 + s2 * 0.025) * I;
      R.neck = dir * (-0.06 - s2 * 0.035) * I;
      PA.tasset_cape = dir * (0.10 + Math.abs(s1) * 0.08) * I;

      const stride = 0.46;
      R.hip_l = -dir * s1 * stride * I;
      R.knee_l = dir * (0.08 + Math.max(0, -c1) * 0.42 + Math.max(0, s1) * 0.25) * I;
      R.hip_r = dir * s1 * stride * I;
      R.knee_r = dir * (0.08 + Math.max(0, c1) * 0.42 + Math.max(0, -s1) * 0.25) * I;

      R.shoulder_r = dir * s1 * 0.28 * I;
      R.elbow_r = dir * (-0.08 + s1 * 0.20) * I;
      R.shoulder_l = dir * (-0.10 - s1 * 0.14) * I;
      break;
    }

    case 'dash': {
      const burst = Math.sin(p * Math.PI);
      pose.rootOffset.x = dir * burst * h * 0.18 * I;
      pose.rootOffset.y = -burst * h * 0.02 * I;
      pose.rootScale.x = 1 + burst * 0.12 * I * SQ;
      pose.rootScale.y = 1 - burst * 0.10 * I * SQ;

      R.hip = dir * 0.44 * burst * I;
      R.neck = -dir * 0.26 * burst * I;
      PA.tasset_cape = dir * 0.35 * burst * I;

      R.hip_l = -dir * 0.72 * burst * I;
      R.knee_l = dir * 0.62 * burst * I;
      R.hip_r = dir * 0.70 * burst * I;
      R.knee_r = dir * 0.50 * burst * I;

      R.shoulder_r = dir * 0.35 * burst * I;
      R.elbow_r = dir * 0.25 * burst * I;
      R.shoulder_l = -dir * 0.25 * burst * I;
      break;
    }

    case 'jump': {
      let yOff = 0, sx = 1, sy = 1, lean = 0, legFront = 0, legBack = 0, knee = 0, arm = 0;
      if (p < 0.20) {
        const k = Math.sin((p / 0.20) * Math.PI * 0.5);
        yOff = k * h * 0.065 * I; sx = 1 + 0.10 * k * I * SQ; sy = 1 - 0.10 * k * I * SQ;
        lean = 0.22 * k * I; legFront = -0.30 * k * I; legBack = 0.20 * k * I; knee = 0.55 * k * I; arm = 0.25 * k * I;
      } else if (p < 0.78) {
        const airT = (p - 0.20) / 0.58;
        const arc = Math.sin(airT * Math.PI);
        yOff = -arc * h * 0.22 * I; sx = 1 - 0.06 * arc * I * SQ; sy = 1 + 0.07 * arc * I * SQ;
        lean = (0.18 - airT * 0.22) * I; legFront = -0.62 * arc * I; legBack = 0.48 * arc * I; knee = 0.72 * arc * I; arm = -0.45 * arc * I;
      } else {
        const k = Math.sin(((p - 0.78) / 0.22) * Math.PI);
        yOff = k * h * 0.06 * I; sx = 1 + 0.12 * k * I * SQ; sy = 1 - 0.12 * k * I * SQ;
        lean = 0.20 * k * I; legFront = -0.25 * k * I; legBack = 0.18 * k * I; knee = 0.48 * k * I; arm = 0.20 * k * I;
      }

      pose.rootOffset.y = yOff; pose.rootScale.x = sx; pose.rootScale.y = sy;
      R.hip = dir * lean; R.neck = -dir * lean * 0.5;
      R.hip_l = dir * legFront; R.knee_l = dir * knee;
      R.hip_r = dir * legBack; R.knee_r = dir * knee * 0.85;
      R.shoulder_r = dir * arm; R.elbow_r = dir * arm * 0.6;
      R.shoulder_l = -dir * arm * 0.5;
      break;
    }

    case 'attack': {
      let wind = 0, strike = 0;
      if (p < 0.34) wind = Math.sin((p / 0.34) * Math.PI * 0.5);
      else if (p < 0.58) {
        const ease = 1 - Math.pow(1 - (p - 0.34) / 0.24, 3);
        wind = 1 - ease; strike = ease;
      } else strike = Math.cos(((p - 0.58) / 0.42) * Math.PI * 0.5);

      pose.rootOffset.x = dir * (-wind * 0.05 + strike * 0.12) * h * I;
      pose.rootOffset.y = (wind * 0.02 + strike * 0.03) * h * I;
      pose.rootScale.x = 1 + (strike * 0.07 - wind * 0.04) * I * SQ;
      pose.rootScale.y = 1 - (strike * 0.05 - wind * 0.04) * I * SQ;

      R.hip = dir * (-wind * 0.16 + strike * 0.34) * I;
      R.neck = dir * (wind * 0.10 - strike * 0.18) * I;
      R.shoulder_r = dir * (wind * 0.65 - strike * 1.15) * I;
      R.elbow_r = dir * (wind * 0.45 - strike * 0.95) * I;
      R.shoulder_l = dir * (-wind * 0.18 + strike * 0.22) * I;

      R.hip_l = dir * (-wind * 0.15 - strike * 0.55) * I;
      R.knee_l = dir * (0.15 + strike * 0.52) * I;
      R.hip_r = dir * (wind * 0.20 + strike * 0.52) * I;
      R.knee_r = dir * (0.15 + wind * 0.35 + strike * 0.25) * I;
      break;
    }

    case 'cast': {
      const pulse = Math.sin(p * TAU * 2);
      const lift = 0.65 + 0.35 * s1;
      pose.rootOffset.y = -(0.045 + 0.03 * s1) * h * I;
      R.hip = -dir * 0.08 * lift * I;
      R.neck = dir * (-0.12 + pulse * 0.05) * I;
      R.shoulder_r = dir * (-0.95 - pulse * 0.15) * I;
      R.elbow_r = dir * (-0.65 - c2 * 0.14) * I;
      R.shoulder_l = dir * (-0.25 + pulse * 0.10) * I;
      R.hip_l = -dir * 0.18 * lift * I; R.knee_l = dir * 0.32 * lift * I;
      R.hip_r = dir * 0.18 * lift * I; R.knee_r = dir * 0.28 * lift * I;
      break;
    }

    case 'block': {
      const brace = 0.72 + 0.28 * s1;
      pose.rootOffset.y = h * 0.032 * brace * I;
      pose.rootOffset.x = -dir * h * 0.02 * brace * I;
      R.hip = dir * 0.14 * brace * I;
      R.neck = dir * 0.08 * brace * I;
      R.shoulder_l = -dir * 0.20 * brace * I;
      PO.shield_arm_l = { x: dir * h * 0.035 * brace * I, y: -h * 0.032 * brace * I };
      R.shoulder_r = dir * 0.32 * brace * I;
      R.elbow_r = dir * 0.22 * brace * I;
      R.hip_l = -dir * 0.35 * brace * I; R.knee_l = dir * 0.42 * brace * I;
      R.hip_r = dir * 0.35 * brace * I; R.knee_r = dir * 0.35 * brace * I;
      break;
    }

    case 'gather': {
      const swing = s1;
      const down = Math.max(0, -swing);
      pose.rootOffset.y = down * h * 0.04 * I;
      R.hip = dir * (0.16 + down * 0.22 - Math.max(0, swing) * 0.15) * I;
      R.neck = -dir * down * 0.12 * I;
      R.shoulder_r = dir * (-0.45 + swing * 0.72) * I;
      R.elbow_r = dir * (-0.35 + swing * 0.55) * I;
      R.hip_l = -dir * 0.25 * I; R.knee_l = dir * (0.20 + down * 0.22) * I;
      R.hip_r = dir * 0.22 * I; R.knee_r = dir * 0.18 * I;
      break;
    }

    case 'hurt': {
      const hit = Math.sin(p * Math.PI);
      const shake = Math.sin(p * TAU * 4) * (1 - p);
      pose.rootOffset.x = dir * (-hit * 0.12 + shake * 0.025) * h * I;
      pose.rootOffset.y = -hit * 0.025 * h * I;
      pose.flash = p < 0.35 ? (1 - p / 0.35) * 0.78 : 0;
      R.hip = -dir * hit * 0.32 * I;
      R.neck = -dir * hit * 0.28 * I;
      R.shoulder_r = dir * hit * 0.55 * I;
      R.elbow_r = dir * hit * 0.35 * I;
      R.shoulder_l = dir * hit * 0.35 * I;
      R.hip_l = -dir * hit * 0.30 * I; R.knee_l = dir * hit * 0.40 * I;
      R.hip_r = dir * hit * 0.25 * I; R.knee_r = dir * hit * 0.30 * I;
      break;
    }

    case 'death': {
      const fall = Math.min(1, p / 0.76);
      const ease = fall * fall * (3 - 2 * fall);
      const settle = p > 0.76 ? Math.sin(((p - 0.76) / 0.24) * Math.PI) * 0.04 : 0;
      pose.rootOffset.x = -dir * ease * h * 0.18 * I;
      pose.rootOffset.y = (ease * h * 0.34 - settle * h) * I;
      R.hip = -dir * ease * 1.38 * I;
      R.neck = -dir * ease * 0.25 * I;
      R.shoulder_r = dir * ease * 0.65 * I;
      R.elbow_r = dir * ease * 0.35 * I;
      R.shoulder_l = -dir * ease * 0.45 * I;
      R.hip_l = -dir * ease * 0.55 * I; R.knee_l = dir * ease * 0.65 * I;
      R.hip_r = -dir * ease * 0.35 * I; R.knee_r = dir * ease * 0.45 * I;
      break;
    }

    case 'victory': {
      const hop = Math.abs(s1);
      pose.rootOffset.y = -hop * h * 0.095 * I;
      pose.rootScale.x = 1 + (0.04 - hop * 0.08) * I * SQ;
      pose.rootScale.y = 1 - (0.04 - hop * 0.08) * I * SQ;
      R.hip = -dir * 0.06 * hop * I;
      R.neck = dir * (-0.12 + c1 * 0.08) * I;
      R.shoulder_r = dir * (-0.95 - s2 * 0.22) * I;
      R.elbow_r = dir * (-0.75 - c2 * 0.18) * I;
      R.shoulder_l = dir * (-0.18 + s2 * 0.12) * I;
      R.hip_l = -dir * hop * 0.32 * I; R.knee_l = dir * hop * 0.48 * I;
      R.hip_r = dir * hop * 0.24 * I; R.knee_r = dir * hop * 0.38 * I;
      break;
    }
  }

  return pose;
}
