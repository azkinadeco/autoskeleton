/**
 * Part-Based Cutout & Pivot Rigging Engine (v4 - Multi-Direction & Bone-Capsule Corridor Cutter)
 *
 * Supports:
 * 1. 4 View Directions ('front', 'side_right', 'side_left', 'back') with automatic Z-order adaptation.
 * 2. Bone-Capsule Corridor Segmentation for Front/Back/Complex Aetheria sprites (Sven, Kali, Ymir, Hyeonxa):
 *    - Only pixels within the anatomical capsule around each limb bone (head, torso, arms, thighs, shins)
 *      are cut into that limb.
 *    - Background greatswords, twin-tails, dragon coils, capes, or props outside the limb capsules stay
 *      100% unified in `tasset_cape` (Back Layer / Ornamen Punggung, zIndex: 12) instead of getting sliced
 *      by the legs!
 * 3. Surgical 3/4 Knight Cutout for Side-Right / Side-Left pixel-art warriors (like contoh/ch1-idle-first.webp).
 */

import { computeSlashFX, drawSlashFX } from './fx.js';

export const PART_DEFINITIONS = [
  {
    index: 1,
    id: 'thigh_r',
    label: 'Paha Kanan / Belakang',
    pivotJoint: 'hip_r',
    childJoint: 'knee_r',
    zIndex: 20,
    color: '#2dd4bf',
    explodeVec: { dx: 0.24, dy: 0.12 },
    capRadius: 0.065,
  },
  {
    index: 2,
    id: 'shin_r',
    label: 'Betis & Kaki Kanan',
    pivotJoint: 'knee_r',
    childJoint: 'foot_r',
    zIndex: 25,
    color: '#14b8a6',
    explodeVec: { dx: 0.26, dy: 0.36 },
    capRadius: 0.060,
  },
  {
    index: 3,
    id: 'torso',
    label: 'Badan & Dada (Torso)',
    pivotJoint: 'hip',
    childJoint: 'chest',
    zIndex: 40,
    color: '#fb923c',
    explodeVec: { dx: 0.0, dy: -0.04 },
    capRadius: 0.070,
  },
  {
    index: 4,
    id: 'thigh_l',
    label: 'Paha Kiri / Depan',
    pivotJoint: 'hip_l',
    childJoint: 'knee_l',
    zIndex: 50,
    color: '#a78bfa',
    explodeVec: { dx: -0.22, dy: 0.12 },
    capRadius: 0.065,
  },
  {
    index: 5,
    id: 'shin_l',
    label: 'Betis & Kaki Kiri',
    pivotJoint: 'knee_l',
    childJoint: 'foot_l',
    zIndex: 55,
    color: '#8b5cf6',
    explodeVec: { dx: -0.24, dy: 0.36 },
    capRadius: 0.060,
  },
  {
    index: 6,
    id: 'tasset_cape',
    label: 'Jubah / Senjata Punggung / Rok',
    pivotJoint: 'hip',
    childJoint: 'chest',
    zIndex: 62,
    color: '#ef4444',
    explodeVec: { dx: 0.36, dy: 0.22 },
    capRadius: 0.055,
  },
  {
    index: 7,
    id: 'head',
    label: 'Kepala & Wajah',
    pivotJoint: 'neck',
    childJoint: 'head',
    zIndex: 72,
    color: '#38bdf8',
    explodeVec: { dx: 0.0, dy: -0.34 },
    capRadius: 0.065,
  },
  {
    index: 8,
    id: 'upper_arm_r',
    label: 'Lengan Atas Kiri Layar',
    pivotJoint: 'shoulder_r',
    childJoint: 'elbow_r',
    zIndex: 80,
    color: '#f472b6',
    explodeVec: { dx: -0.30, dy: -0.16 },
    capRadius: 0.062,
  },
  {
    index: 9,
    id: 'forearm_weapon_r',
    label: 'Tangan / Senjata Kiri Layar',
    pivotJoint: 'elbow_r',
    childJoint: 'hand_r',
    zIndex: 86,
    color: '#ec4899',
    explodeVec: { dx: -0.42, dy: -0.02 },
    capRadius: 0.060,
  },
  {
    index: 10,
    id: 'shield_arm_l',
    label: 'Lengan / Perisai Kanan Layar',
    pivotJoint: 'shoulder_l',
    childJoint: 'hand_l',
    zIndex: 94,
    color: '#4ade80',
    explodeVec: { dx: 0.38, dy: -0.12 },
    capRadius: 0.062,
  },
];

export const PART_BY_ID = Object.fromEntries(PART_DEFINITIONS.map((p) => [p.id, p]));
export const PART_BY_INDEX = Object.fromEntries(PART_DEFINITIONS.map((p) => [p.index, p]));

/**
 * Distance from point (px, py) to line segment (ax, ay) -> (bx, by), plus normalized projection t in [0, 1].
 */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-4) return { dist: Math.hypot(px - ax, py - ay), t: 0 };
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return { dist: Math.hypot(px - cx, py - cy), t };
}

/**
 * Returns direction-specific Z-order overrides so Front, Side-Right, Side-Left, and Back views
 * layer legs, arms, weapons, and back hair/capes in the proper anatomical order.
 */
export function getDirectionZOrder(viewDirection = 'front', templateId = 'auto_smart') {
  if (templateId === 'knight_34') {
    return {}; // Default PART_DEFINITIONS zIndex is tailored for knight_34
  }
  if (viewDirection === 'front') {
    // In front view, tasset_cape (back weapon / greatsword / long hair / dragon / cape) is BEHIND the body!
    return {
      tasset_cape: 12,
      torso: 40,
      thigh_r: 48,
      thigh_l: 50,
      shin_r: 54,
      shin_l: 56,
      upper_arm_r: 68,
      shield_arm_l: 70,
      forearm_weapon_r: 74,
      head: 82,
    };
  }
  if (viewDirection === 'back') {
    // In back view, back hair / cape / back weapon is IN FRONT of the back of the head & torso!
    return {
      head: 30,
      upper_arm_r: 36,
      shield_arm_l: 38,
      forearm_weapon_r: 40,
      torso: 45,
      thigh_l: 52,
      thigh_r: 54,
      shin_l: 58,
      shin_r: 60,
      tasset_cape: 92,
    };
  }
  if (viewDirection === 'side_left') {
    // Facing left: right-side leg/arm is near camera, left-side leg/arm is far
    return {
      tasset_cape: 15,
      thigh_l: 20,
      shin_l: 25,
      upper_arm_r: 30,
      forearm_weapon_r: 35,
      torso: 45,
      thigh_r: 55,
      shin_r: 60,
      head: 75,
      shield_arm_l: 88,
    };
  }
  return {};
}

/**
 * Segments the character into 10 body parts according to View Direction & Skeleton Pivots.
 */
export function autoSegmentParts(canvas, skeleton) {
  const viewDir = skeleton.viewDirection || 'front';
  const isKnight34 = skeleton.templateId === 'knight_34';

  if (!isKnight34 && (viewDir === 'front' || viewDir === 'back')) {
    return segmentFrontOrBackBoneCapsules(canvas, skeleton);
  }

  return segmentSide34Parts(canvas, skeleton);
}

/**
 * Bone-Capsule Corridor Segmenter for Front & Back Views (Aetheria Heroes: Sven, Kali, Ymir, Hyeonxa, etc.)
 * Prevents background greatswords, twin-tails, or props from being sliced by the legs/arms!
 */
function segmentFrontOrBackBoneCapsules(canvas, skeleton) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, w, h).data;

  const partMap = new Uint8Array(w * h);
  const bounds = skeleton.bounds || { minX: 0, minY: 0, maxX: w, maxY: h, width: w, height: h };
  const { minX, minY, width: bw, height: bh } = bounds;
  const byId = Object.fromEntries(skeleton.joints.map((j) => [j.id, j]));

  const neck = byId.neck || { x: minX + bw * 0.5, y: minY + bh * 0.36 };
  const head = byId.head || { x: neck.x, y: minY + bh * 0.15 };
  const chest = byId.chest || { x: neck.x, y: minY + bh * 0.46 };
  const hip = byId.hip || { x: neck.x, y: minY + bh * 0.60 };
  const shR = byId.shoulder_r || { x: neck.x - bw * 0.12, y: neck.y + bh * 0.03 };
  const elR = byId.elbow_r || { x: shR.x - bw * 0.10, y: shR.y + bh * 0.12 };
  const haR = byId.hand_r || { x: elR.x - bw * 0.05, y: elR.y + bh * 0.12 };
  const shL = byId.shoulder_l || { x: neck.x + bw * 0.12, y: neck.y + bh * 0.03 };
  const elL = byId.elbow_l || { x: shL.x + bw * 0.10, y: shL.y + bh * 0.12 };
  const haL = byId.hand_l || { x: elL.x + bw * 0.05, y: elL.y + bh * 0.12 };

  const hipL = byId.hip_l || { x: hip.x - bw * 0.07, y: hip.y + bh * 0.04 };
  const kneeL = byId.knee_l || { x: hipL.x - bw * 0.02, y: hip.y + bh * 0.20 };
  const footL = byId.foot_l || { x: kneeL.x - bw * 0.02, y: minY + bh * 0.96 };

  const hipR = byId.hip_r || { x: hip.x + bw * 0.07, y: hip.y + bh * 0.04 };
  const kneeR = byId.knee_r || { x: hipR.x + bw * 0.02, y: hip.y + bh * 0.20 };
  const footR = byId.foot_r || { x: kneeR.x + bw * 0.02, y: minY + bh * 0.96 };

  // Anatomical capsule radii proportional to body height/width
  const headRadX = Math.max(bw * 0.19, Math.abs(shL.x - shR.x) * 0.82);
  const headRadY = Math.max(bh * 0.22, Math.abs(neck.y - minY) * 1.05);
  const torsoHalfW = Math.max(bw * 0.13, Math.abs(shL.x - shR.x) * 0.58);
  const thighRad = Math.max(bw * 0.095, Math.abs(hipR.x - hipL.x) * 0.68);
  const shinRad = Math.max(bw * 0.082, thighRad * 0.85);
  const armRad = Math.max(bw * 0.075, bh * 0.065);

  const midLegSplitX = skeleton.legSplitX || (hipL.x + hipR.x) * 0.5;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (data[idx * 4 + 3] <= 20) continue;

      // 1. Check Head Ellipse / Capsule (above neck chin curve)
      const headCenterX = (neck.x + head.x) * 0.5;
      const headCenterY = minY + (neck.y - minY) * 0.52;
      const hdx = (x - headCenterX) / headRadX;
      const hdy = (y - headCenterY) / headRadY;
      const chinY = neck.y + bh * 0.015 - Math.abs(x - neck.x) * 0.18;
      if (y <= chinY && hdx * hdx + hdy * hdy <= 1.08) {
        partMap[idx] = PART_BY_ID.head.index;
        continue;
      }

      // 2. Check Torso Column (between neck.y and hip.y + pelvis)
      const pelvisBotY = Math.max(hipL.y, hipR.y) + bh * 0.035;
      if (
        y >= neck.y - bh * 0.02 &&
        y <= pelvisBotY &&
        Math.abs(x - (chest.x + hip.x) * 0.5) <= torsoHalfW
      ) {
        partMap[idx] = PART_BY_ID.torso.index;
        continue;
      }

      // 3. Check Left & Right Leg Bone Capsules (below hip.y)
      if (y >= hip.y - bh * 0.01) {
        const dThighL = distToSegment(x, y, hipL.x, hipL.y, kneeL.x, kneeL.y);
        const dShinL  = distToSegment(x, y, kneeL.x, kneeL.y, footL.x, footL.y);
        const dThighR = distToSegment(x, y, hipR.x, hipR.y, kneeR.x, kneeR.y);
        const dShinR  = distToSegment(x, y, kneeR.x, kneeR.y, footR.x, footR.y);

        const minL = Math.min(dThighL.dist / thighRad, dShinL.dist / shinRad);
        const minR = Math.min(dThighR.dist / thighRad, dShinR.dist / shinRad);

        // Pixel must be inside the leg capsule corridor (so outer greatswords/twin-tails aren't grabbed!)
        if (minL <= 1.05 || minR <= 1.05) {
          const isLeftLeg = minL < minR || (Math.abs(minL - minR) < 0.08 && x < midLegSplitX);
          if (isLeftLeg) {
            partMap[idx] = y < kneeL.y ? PART_BY_ID.thigh_l.index : PART_BY_ID.shin_l.index;
          } else {
            partMap[idx] = y < kneeR.y ? PART_BY_ID.thigh_r.index : PART_BY_ID.shin_r.index;
          }
          continue;
        }
      }

      // 3b. Weapon corridors (hand -> tip) travel with the arm that holds them
      let weaponHit = 0;
      for (const side of ['r', 'l']) {
        const wj = byId['weapon_' + side];
        const hj = byId['hand_' + side];
        if (!wj || !hj) continue;
        const dw = distToSegment(x, y, hj.x, hj.y, wj.x, wj.y);
        if (dw.dist <= (wj.weaponRadius || bh * 0.05) * 1.35) {
          weaponHit = side === 'r' ? PART_BY_ID.forearm_weapon_r.index : PART_BY_ID.shield_arm_l.index;
          break;
        }
      }
      if (weaponHit) {
        partMap[idx] = weaponHit;
        continue;
      }

      // 4. Check Left-Side Arm Capsules (shoulder_r -> elbow_r -> hand_r)
      const dUpArmR = distToSegment(x, y, shR.x, shR.y, elR.x, elR.y);
      const dLoArmR = distToSegment(x, y, elR.x, elR.y, haR.x, haR.y);
      if (dUpArmR.dist <= armRad || dLoArmR.dist <= armRad * 1.1) {
        partMap[idx] =
          dUpArmR.dist <= dLoArmR.dist
            ? PART_BY_ID.upper_arm_r.index
            : PART_BY_ID.forearm_weapon_r.index;
        continue;
      }

      // 5. Check Right-Side Arm Capsule (shoulder_l -> elbow_l -> hand_l)
      const dUpArmL = distToSegment(x, y, shL.x, shL.y, elL.x, elL.y);
      const dLoArmL = distToSegment(x, y, elL.x, elL.y, haL.x, haL.y);
      if (dUpArmL.dist <= armRad || dLoArmL.dist <= armRad * 1.1) {
        partMap[idx] = PART_BY_ID.shield_arm_l.index;
        continue;
      }

      // 6. All remaining pixels (back greatsword, long hair twin-tails, dragon coils, cape, wings)
      // stay unified in `tasset_cape` (Back Layer, zIndex: 12 behind the character!)
      partMap[idx] = PART_BY_ID.tasset_cape.index;
    }
  }

  return partMap;
}

/**
 * Surgical 3/4 & Side-View Segmenter (for knight_34, side_right, side_left).
 */
function segmentSide34Parts(canvas, skeleton) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const partMap = new Uint8Array(w * h);
  const bounds = skeleton.bounds || { minX: 0, minY: 0, maxX: w, maxY: h, width: w, height: h };
  const { minX, minY, width: bw, height: bh } = bounds;
  const byId = Object.fromEntries(skeleton.joints.map((j) => [j.id, j]));

  const neckNX = byId.neck ? (byId.neck.x - minX) / bw : 0.525;
  const neckNY = byId.neck ? (byId.neck.y - minY) / bh : 0.345;
  const shRNX  = byId.shoulder_r ? (byId.shoulder_r.x - minX) / bw : 0.415;
  const shRNY  = byId.shoulder_r ? (byId.shoulder_r.y - minY) / bh : 0.365;
  const elbowRNX = byId.elbow_r ? (byId.elbow_r.x - minX) / bw : 0.318;
  const elbowRNY = byId.elbow_r ? (byId.elbow_r.y - minY) / bh : 0.505;
  const shLNX  = byId.shoulder_l ? (byId.shoulder_l.x - minX) / bw : 0.625;
  const hipNY  = byId.hip ? (byId.hip.y - minY) / bh : 0.610;
  const hipLNX = byId.hip_l ? (byId.hip_l.x - minX) / bw : 0.445;
  const hipRNX = byId.hip_r ? (byId.hip_r.x - minX) / bw : 0.568;
  const kneeLNY = byId.knee_l ? (byId.knee_l.y - minY) / bh : 0.815;
  const kneeRNY = byId.knee_r ? (byId.knee_r.y - minY) / bh : 0.800;

  const legSplitNX = skeleton.legSplitX
    ? (skeleton.legSplitX - minX) / bw
    : (hipLNX + hipRNX) * 0.5;

  const torsoLeftTopNX = Math.min(neckNX - 0.04, shRNX + 0.065);
  const torsoLeftMidNX = Math.min(hipLNX - 0.045, shRNX - 0.052);

  for (let y = 0; y < h; y++) {
    const ny = (y - minY) / bh;

    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const pIdx = idx * 4;
      const a = data[pIdx + 3];
      if (a <= 20) continue;

      const nx = (x - minX) / bw;

      const chinCurveNY = neckNY + (nx - (neckNX - 0.04)) * 0.22;
      if (
        ny < neckNY - 0.075 ||
        (nx >= shRNX + 0.04 && nx <= shLNX + 0.045 && ny <= chinCurveNY)
      ) {
        partMap[idx] = PART_BY_ID.head.index;
        continue;
      }

      const shieldLeftNX =
        ny <= hipNY + 0.01
          ? shLNX - 0.004
          : shLNX - 0.004 + (ny - (hipNY + 0.01)) * 0.62;
      if (ny >= neckNY - 0.02 && nx >= shieldLeftNX) {
        partMap[idx] = PART_BY_ID.shield_arm_l.index;
        continue;
      }

      const armSwordRightNX =
        ny < shRNY + 0.08
          ? torsoLeftTopNX
          : ny < hipNY - 0.05
            ? torsoLeftTopNX - ((ny - (shRNY + 0.08)) / Math.max(0.05, hipNY - 0.05 - (shRNY + 0.08))) * (torsoLeftTopNX - torsoLeftMidNX)
            : torsoLeftMidNX - Math.max(0, ny - hipNY) * 0.38;

      if (nx < armSwordRightNX && ny >= neckNY - 0.08) {
        const elbowCutNY = elbowRNY - 0.015 + (nx - elbowRNX) * 0.28;
        partMap[idx] =
          ny < elbowCutNY
            ? PART_BY_ID.upper_arm_r.index
            : PART_BY_ID.forearm_weapon_r.index;
        continue;
      }

      const capeRightNX = Math.max(armSwordRightNX + 0.01, hipLNX - 0.052);
      const isLeftCapeFlap =
        ny >= hipNY - 0.05 &&
        ny <= 0.89 &&
        nx >= armSwordRightNX &&
        nx < capeRightNX;

      const isCenterRedTasset =
        skeleton.templateId === 'knight_34' &&
        ny >= hipNY - 0.035 &&
        ny <= Math.max(kneeLNY, kneeRNY) &&
        nx >= legSplitNX - 0.024 &&
        nx < shieldLeftNX;

      if (isLeftCapeFlap || isCenterRedTasset) {
        partMap[idx] = PART_BY_ID.tasset_cape.index;
        continue;
      }

      if (ny <= hipNY + 0.035) {
        partMap[idx] = PART_BY_ID.torso.index;
        continue;
      }

      const effectiveLegSplitNX =
        ny > kneeRNY - 0.05 ? Math.max(legSplitNX, hipLNX + 0.08) : legSplitNX - 0.024;
      if (nx < effectiveLegSplitNX) {
        partMap[idx] =
          ny < kneeLNY ? PART_BY_ID.thigh_l.index : PART_BY_ID.shin_l.index;
      } else {
        partMap[idx] =
          ny < kneeRNY + 0.01 ? PART_BY_ID.thigh_r.index : PART_BY_ID.shin_r.index;
      }
    }
  }

  return partMap;
}

/**
 * Pure RGBA buffer builder for all 10 cutout body-part layers.
 * - On Front/Back views, preserves 100% of original right thigh & avoids horizontal armor stripes,
 *   while filling smooth under-limb bridges on the base layer so small limb movements never leave holes!
 * - On Knight 3/4 view, performs back-thigh armor cloning & under-shield armor extension.
 */
export function buildPartBuffers(srcData, w, h, partMap, skeleton, options = {}) {
  const byId = Object.fromEntries(skeleton.joints.map((j) => [j.id, j]));
  const bh = skeleton.bounds?.height || h;
  const viewDir = skeleton.viewDirection || 'front';
  const isFrontOrBack = (viewDir === 'front' || viewDir === 'back') && skeleton.templateId !== 'knight_34';
  const cloneBackThighMode = options.cloneBackThigh ?? 'auto';

  const buffers = {};
  const avgColors = {};
  const pixelCounts = {};

  for (const def of PART_DEFINITIONS) {
    const buf = new Uint8ClampedArray(w * h * 4);
    let sumR = 0, sumG = 0, sumB = 0, count = 0;

    for (let i = 0; i < w * h; i++) {
      if (partMap[i] === def.index) {
        const idx = i * 4;
        buf[idx] = srcData[idx];
        buf[idx + 1] = srcData[idx + 1];
        buf[idx + 2] = srcData[idx + 2];
        buf[idx + 3] = srcData[idx + 3];
        if (srcData[idx + 3] > 100) {
          sumR += srcData[idx];
          sumG += srcData[idx + 1];
          sumB += srcData[idx + 2];
          count++;
        }
      }
    }

    buffers[def.id] = buf;
    pixelCounts[def.id] = count;
    avgColors[def.id] = count > 0
      ? [Math.round(sumR / count), Math.round(sumG / count), Math.round(sumB / count)]
      : [52, 42, 36];
  }

  // ---- A. Bidirectional Real-Pixel Joint Overlap Disks ----
  const jointSharePairs = [
    ['thigh_l', 'hip_l', [PART_BY_ID.torso.index]],
    ['thigh_l', 'knee_l', [PART_BY_ID.shin_l.index]],
    ['shin_l',  'knee_l', [PART_BY_ID.thigh_l.index]],
    ['thigh_r', 'hip_r', [PART_BY_ID.torso.index]],
    ['thigh_r', 'knee_r', [PART_BY_ID.shin_r.index]],
    ['shin_r',  'knee_r', [PART_BY_ID.thigh_r.index]],
    ['upper_arm_r', 'shoulder_r', [PART_BY_ID.torso.index]],
    ['upper_arm_r', 'elbow_r', [PART_BY_ID.forearm_weapon_r.index]],
    ['forearm_weapon_r', 'elbow_r', [PART_BY_ID.upper_arm_r.index]],
    ['shield_arm_l', 'shoulder_l', [PART_BY_ID.torso.index]],
    ['head', 'neck', [PART_BY_ID.torso.index]],
    ['torso', 'neck', [PART_BY_ID.head.index]],
    ['torso', 'hip_l', [PART_BY_ID.thigh_l.index]],
    ['torso', 'hip_r', [PART_BY_ID.thigh_r.index]],
  ];

  const shareRadius = Math.max(8, Math.round(bh * (isFrontOrBack ? 0.075 : 0.062)));
  const shareRSq = shareRadius * shareRadius;

  for (const [partId, jointId, allowedSources] of jointSharePairs) {
    const buf = buffers[partId];
    const jt = byId[jointId];
    if (!buf || !jt) continue;

    const px = Math.round(jt.x);
    const py = Math.round(jt.y);

    for (let dy = -shareRadius; dy <= shareRadius; dy++) {
      const y = py + dy;
      if (y < 0 || y >= h) continue;
      for (let dx = -shareRadius; dx <= shareRadius; dx++) {
        const x = px + dx;
        if (x < 0 || x >= w) continue;
        if (dx * dx + dy * dy > shareRSq) continue;
        const pos = y * w + x;
        const idx = pos * 4;
        if (buf[idx + 3] < 80 && allowedSources.includes(partMap[pos])) {
          buf[idx] = srcData[idx];
          buf[idx + 1] = srcData[idx + 1];
          buf[idx + 2] = srcData[idx + 2];
          buf[idx + 3] = srcData[idx + 3];
        }
      }
    }
  }

  if (isFrontOrBack) {
    // For Front/Back Aetheria sprites:
    // Also copy a subtle darkened under-bridge around neck, shoulders, and hips onto `torso`
    // so when head/arms/thighs tilt, there is never a transparent hole!
    if (buffers.torso) {
      const tBuf = buffers.torso;
      const bridgeJoints = ['neck', 'shoulder_r', 'shoulder_l', 'hip_l', 'hip_r'];
      const br = Math.max(9, Math.round(bh * 0.075));
      const brSq = br * br;
      for (const jId of bridgeJoints) {
        const jt = byId[jId];
        if (!jt) continue;
        const px = Math.round(jt.x), py = Math.round(jt.y);
        for (let dy = -br; dy <= br; dy++) {
          const y = py + dy;
          if (y < 0 || y >= h) continue;
          for (let dx = -br; dx <= br; dx++) {
            const x = px + dx;
            if (x < 0 || x >= w) continue;
            if (dx * dx + dy * dy > brSq) continue;
            const idx = (y * w + x) * 4;
            if (tBuf[idx + 3] < 50 && srcData[idx + 3] > 80) {
              tBuf[idx] = Math.round(srcData[idx] * 0.85);
              tBuf[idx + 1] = Math.round(srcData[idx + 1] * 0.85);
              tBuf[idx + 2] = Math.round(srcData[idx + 2] * 0.85);
              tBuf[idx + 3] = srcData[idx + 3];
            }
          }
        }
      }
    }
    return { buffers, avgColors };
  }

  // ---- B. Side / 3/4 Mode: Smart Back Thigh Reconstruction ----
  const shouldCloneBackThigh =
    cloneBackThighMode === true ||
    (cloneBackThighMode === 'auto' && pixelCounts.thigh_r < pixelCounts.thigh_l * 0.65);

  if (shouldCloneBackThigh && buffers.thigh_r && buffers.thigh_l && byId.hip_r && byId.hip_l) {
    const dx = Math.round(byId.hip_r.x - byId.hip_l.x);
    const dy = Math.round(byId.hip_r.y - byId.hip_l.y);
    const lData = buffers.thigh_l;
    const rData = buffers.thigh_r;
    rData.fill(0);

    for (let y = 0; y < h; y++) {
      const sy = y - dy;
      if (sy < 0 || sy >= h) continue;
      for (let x = 0; x < w; x++) {
        const sx = x - dx;
        if (sx < 0 || sx >= w) continue;
        const sIdx = (sy * w + sx) * 4;
        const dIdx = (y * w + x) * 4;
        if (lData[sIdx + 3] > 40) {
          rData[dIdx] = Math.round(lData[sIdx] * 0.82);
          rData[dIdx + 1] = Math.round(lData[sIdx + 1] * 0.82);
          rData[dIdx + 2] = Math.round(lData[sIdx + 2] * 0.82);
          rData[dIdx + 3] = lData[sIdx + 3];
        }
      }
    }
  }

  // ---- C. Side / 3/4 Mode: Under-Shield & Under-Shoulder Torso Armor Inpainting ----
  if (buffers.torso) {
    const tData = buffers.torso;
    const extendRight = Math.max(10, Math.round(bh * 0.11));
    const extendLeft = Math.max(8, Math.round(bh * 0.075));

    for (let y = 0; y < h; y++) {
      let leftX = -1, rightX = -1;
      for (let x = 0; x < w; x++) {
        if (tData[(y * w + x) * 4 + 3] > 120) {
          if (leftX === -1) leftX = x;
          rightX = x;
        }
      }
      if (leftX !== -1 && rightX - leftX >= 5) {
        const sampleRX = Math.max(leftX, rightX - 3);
        const srIdx = (y * w + sampleRX) * 4;
        for (let step = 1; step <= extendRight; step++) {
          const nx = rightX + step;
          if (nx >= w) break;
          if (srcData[(y * w + nx) * 4 + 3] <= 20) break;
          const dIdx = (y * w + nx) * 4;
          const isRim = step === extendRight;
          tData[dIdx] = isRim ? 22 : Math.round(tData[srIdx] * 0.85);
          tData[dIdx + 1] = isRim ? 18 : Math.round(tData[srIdx + 1] * 0.85);
          tData[dIdx + 2] = isRim ? 16 : Math.round(tData[srIdx + 2] * 0.85);
          tData[dIdx + 3] = 255;
        }

        const sampleLX = Math.min(rightX, leftX + 3);
        const slIdx = (y * w + sampleLX) * 4;
        for (let step = 1; step <= extendLeft; step++) {
          const nx = leftX - step;
          if (nx < 0) break;
          if (srcData[(y * w + nx) * 4 + 3] <= 20) break;
          const dIdx = (y * w + nx) * 4;
          const isRim = step === extendLeft;
          tData[dIdx] = isRim ? 22 : Math.round(tData[slIdx] * 0.85);
          tData[dIdx + 1] = isRim ? 18 : Math.round(tData[slIdx + 1] * 0.85);
          tData[dIdx + 2] = isRim ? 16 : Math.round(tData[slIdx + 2] * 0.85);
          tData[dIdx + 3] = 255;
        }
      }
    }
  }

  // ---- D. Fallback Pivot Caps ----
  for (const def of PART_DEFINITIONS) {
    const pData = buffers[def.id];
    const pivot = byId[def.pivotJoint];
    if (!pData || !pivot) continue;

    const radius = Math.max(6, Math.round(bh * (def.capRadius || 0.055)));
    const rSq = radius * radius;
    const rimSq = Math.max(1, (radius - 2) * (radius - 2));
    const px = Math.round(pivot.x);
    const py = Math.round(pivot.y);
    const [cr, cg, cb] = avgColors[def.id];

    for (let dy = -radius; dy <= radius; dy++) {
      const y = py + dy;
      if (y < 0 || y >= h) continue;
      for (let dx = -radius; dx <= radius; dx++) {
        const x = px + dx;
        if (x < 0 || x >= w) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 > rSq) continue;
        if (srcData[(y * w + x) * 4 + 3] <= 15) continue;

        const idx = (y * w + x) * 4;
        if (pData[idx + 3] < 100) {
          const isOutline = d2 >= rimSq;
          pData[idx] = isOutline ? 24 : cr;
          pData[idx + 1] = isOutline ? 19 : cg;
          pData[idx + 2] = isOutline ? 17 : cb;
          pData[idx + 3] = 255;
        }
      }
    }
  }

  return { buffers, avgColors };
}

export function buildPartLayers(sourceCanvas, partMap, skeleton, options = {}) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const sctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const srcData = sctx.getImageData(0, 0, w, h).data;

  const { buffers, avgColors } = buildPartBuffers(srcData, w, h, partMap, skeleton, options);
  const layers = {};

  for (const def of PART_DEFINITIONS) {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = w;
    pCanvas.height = h;
    const pctx = pCanvas.getContext('2d', { willReadFrequently: true });
    const pImg = new ImageData(buffers[def.id], w, h);
    pctx.putImageData(pImg, 0, 0);

    layers[def.id] = {
      ...def,
      canvas: pCanvas,
      ctx: pctx,
      imgData: pImg,
      avgColor: avgColors[def.id],
    };
  }

  return layers;
}

export function renderCutoutCharacter(targetCtx, targetW, targetH, {
  partLayers,
  skeleton,
  posedJoints,
  pose,
  view,
  pixelArt = true,
  explodeAmount = 0,
  selectedPartId = null,
  dimUnselected = false,
}) {
  if (!partLayers || !skeleton || !posedJoints) return;

  const { offsetX = 0, offsetY = 0, scale = 1, flipX = false, flash = 0 } = view;
  const bh = skeleton.bounds?.height || 200;

  const dirZ = getDirectionZOrder(skeleton.viewDirection || 'front', skeleton.templateId);
  const zOverrides = { ...dirZ, ...(pose?.zOverrides || {}) };
  const sortedParts = Object.values(partLayers).sort((a, b) => {
    const za = zOverrides[a.id] ?? a.zIndex;
    const zb = zOverrides[b.id] ?? b.zIndex;
    return za - zb;
  });

  const srcW = sortedParts[0]?.canvas.width || 384;
  const srcH = sortedParts[0]?.canvas.height || 384;

  if (!targetCtx._workCanvas) {
    targetCtx._workCanvas = document.createElement('canvas');
  }
  const workCanvas = targetCtx._workCanvas;
  if (workCanvas.width !== srcW || workCanvas.height !== srcH) {
    workCanvas.width = srcW;
    workCanvas.height = srcH;
  }
  const wctx = workCanvas.getContext('2d');
  wctx.clearRect(0, 0, srcW, srcH);
  wctx.imageSmoothingEnabled = !pixelArt;

  const partOffsets = pose?.partOffsets || {};
  const partAngles = pose?.partAngles || {};
  const rootScale = pose?.rootScale || { x: 1, y: 1 };

  for (const part of sortedParts) {
    if (part.hidden) continue;
    const pJoint = posedJoints[part.pivotJoint];
    if (!pJoint) continue;

    const expX = explodeAmount * part.explodeVec.dx * bh;
    const expY = explodeAmount * part.explodeVec.dy * bh;

    const extraOff = partOffsets[part.id] || { x: 0, y: 0 };
    const extraRot = partAngles[part.id] || 0;
    const rot = (pJoint.worldAngle + extraRot) * (1 - explodeAmount * 0.75);

    wctx.save();
    if (dimUnselected && selectedPartId && selectedPartId !== part.id) {
      wctx.globalAlpha = 0.32;
    }

    wctx.translate(pJoint.x + expX + extraOff.x, pJoint.y + expY + extraOff.y);
    wctx.rotate(rot);
    wctx.scale(rootScale.x, rootScale.y);
    wctx.translate(-pJoint.bindX, -pJoint.bindY);

    wctx.drawImage(part.canvas, 0, 0);
    wctx.restore();
  }

  if (flash > 0.01) {
    wctx.save();
    wctx.globalCompositeOperation = 'source-atop';
    wctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, flash)})`;
    wctx.fillRect(0, 0, srcW, srcH);
    wctx.restore();
  }

  targetCtx.save();
  targetCtx.imageSmoothingEnabled = !pixelArt;
  targetCtx.translate(offsetX, offsetY);
  if (flipX) {
    targetCtx.translate(srcW * scale, 0);
    targetCtx.scale(-scale, scale);
  } else {
    targetCtx.scale(scale, scale);
  }
  targetCtx.drawImage(workCanvas, 0, 0);
  targetCtx.restore();

  const fx = computeSlashFX(skeleton, posedJoints, pose);
  if (fx) drawSlashFX(targetCtx, fx, view, srcW);
}
