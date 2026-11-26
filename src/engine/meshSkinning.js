/**
 * 2D Triangle Mesh Generator, Part-Guided Geodesic Skinning & Canvas2D Textured Mesh Renderer (v4)
 *
 * Combines:
 * 1. Silhouette-Aware Geodesic Dijkstra bone weights (preventing limbs from pulling across air gaps).
 * 2. Part-Mask Guided Rigidity:
 *    - Head vertices (part 7) are 100% locked to the `neck -> head` pivot bone so faces/helmets NEVER warp!
 *    - Limb & torso vertices receive strong affinity to their assigned pivot bone while blending smoothly
 *      across joint seams so no gaps, holes, or sliced background weapons ever occur!
 * 3. Fast Canvas2D affine triangle rasterizer (`renderDeformedMesh2D`) so any 2D canvas (main viewport,
 *    multi-animation grid, playtest arena, and sprite-sheet exporter) can render smooth deformed meshes!
 */

import { getBones } from './skeleton.js';
import { drawSlashFX } from './fx.js';

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a || 1)));
  return t * t * (3 - 2 * t);
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return { dist: Math.hypot(px - ax - t * dx, py - ay - t * dy), t };
}

export function buildCharacterMesh(canvas, targetCols = 34) {
  const w = canvas.width;
  const h = canvas.height;
  const aspect = h / Math.max(1, w);
  const cols = Math.max(16, Math.min(48, targetCols));
  const rows = Math.max(16, Math.min(60, Math.round(cols * aspect)));

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, w, h).data;

  const cellW = w / cols;
  const cellH = h / rows;

  const active = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const y0 = Math.floor(r * cellH);
    const y1 = Math.min(h - 1, Math.ceil((r + 1) * cellH));
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor(c * cellW);
      const x1 = Math.min(w - 1, Math.ceil((c + 1) * cellW));
      let hasOpaque = false;
      const stepX = Math.max(1, Math.floor((x1 - x0) / 4));
      const stepY = Math.max(1, Math.floor((y1 - y0) / 4));
      for (let y = y0; y <= y1 && !hasOpaque; y += stepY) {
        for (let x = x0; x <= x1; x += stepX) {
          if (data[(y * w + x) * 4 + 3] > 10) {
            hasOpaque = true;
            break;
          }
        }
      }
      if (hasOpaque) active[r * cols + c] = 1;
    }
  }

  const dilated = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (active[r * cols + c]) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              dilated[nr * cols + nc] = 1;
            }
          }
        }
      }
    }
  }

  const vertMap = new Int32Array((cols + 1) * (rows + 1)).fill(-1);
  const bindPos = [];
  const uvs = [];
  const indices = [];

  const getVertIndex = (r, c) => {
    const key = r * (cols + 1) + c;
    if (vertMap[key] !== -1) return vertMap[key];
    const idx = bindPos.length / 2;
    vertMap[key] = idx;
    const x = c * cellW;
    const y = r * cellH;
    bindPos.push(x, y);
    uvs.push(x / w, y / h);
    return idx;
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!dilated[r * cols + c]) continue;
      const v00 = getVertIndex(r, c);
      const v10 = getVertIndex(r, c + 1);
      const v01 = getVertIndex(r + 1, c);
      const v11 = getVertIndex(r + 1, c + 1);

      if ((r + c) % 2 === 0) {
        indices.push(v00, v10, v11);
        indices.push(v00, v11, v01);
      } else {
        indices.push(v00, v10, v01);
        indices.push(v10, v11, v01);
      }
    }
  }

  const vertexCount = bindPos.length / 2;
  return {
    width: w,
    height: h,
    cols,
    rows,
    vertexCount,
    bindPos: new Float32Array(bindPos),
    deformedPos: new Float32Array(bindPos),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
    boneIndices: new Uint8Array(vertexCount * 4),
    boneWeights: new Float32Array(vertexCount * 4),
  };
}

class MinHeap {
  constructor() {
    this.nodes = [];
    this.dists = [];
  }
  push(node, dist) {
    let i = this.nodes.length;
    this.nodes.push(node);
    this.dists.push(dist);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.dists[p] <= dist) break;
      this.nodes[i] = this.nodes[p];
      this.dists[i] = this.dists[p];
      i = p;
    }
    this.nodes[i] = node;
    this.dists[i] = dist;
  }
  pop() {
    const topNode = this.nodes[0];
    const topDist = this.dists[0];
    const lastNode = this.nodes.pop();
    const lastDist = this.dists.pop();
    if (this.nodes.length > 0) {
      let i = 0;
      const len = this.nodes.length;
      while (true) {
        let l = (i << 1) + 1;
        let r = l + 1;
        let smallest = i;
        if (l < len && this.dists[l] < lastDist) smallest = l;
        if (r < len && this.dists[r] < (smallest === i ? lastDist : this.dists[l])) smallest = r;
        if (smallest === i) break;
        this.nodes[i] = this.nodes[smallest];
        this.dists[i] = this.dists[smallest];
        i = smallest;
      }
      this.nodes[i] = lastNode;
      this.dists[i] = lastDist;
    }
    return [topNode, topDist];
  }
  get size() {
    return this.nodes.length;
  }
}

const PART_INDEX_TO_PIVOT = {
  1: 'hip_r',      // thigh_r
  2: 'knee_r',     // shin_r
  3: 'hip',        // torso
  4: 'hip_l',      // thigh_l
  5: 'knee_l',     // shin_l
  6: 'hip',        // tasset_cape
  7: 'neck',       // head
  8: 'shoulder_r', // upper_arm_r
  9: 'elbow_r',    // forearm_weapon_r
  10: 'shoulder_l',// shield_arm_l
};

export function computeSkinWeights(mesh, canvas, skeleton, rigidity = 3.2, partMap = null) {
  const bones = getBones(skeleton);
  const boneCount = bones.length;
  if (boneCount === 0 || mesh.vertexCount === 0) return;

  const w = canvas.width;
  const h = canvas.height;
  const maxGrid = 88;
  const scale = maxGrid / Math.max(w, h);
  const gw = Math.max(16, Math.round(w * scale));
  const gh = Math.max(16, Math.round(h * scale));

  const smallCanvas = document.createElement('canvas');
  smallCanvas.width = gw;
  smallCanvas.height = gh;
  const sctx = smallCanvas.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(canvas, 0, 0, gw, gh);
  const sdata = sctx.getImageData(0, 0, gw, gh).data;

  const rawMask = new Uint8Array(gw * gh);
  for (let i = 0; i < gw * gh; i++) {
    rawMask[i] = sdata[i * 4 + 3] > 18 ? 1 : 0;
  }
  const mask = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (rawMask[y * gw + x]) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < gw && ny >= 0 && ny < gh) {
              mask[ny * gw + nx] = 1;
            }
          }
        }
      }
    }
  }

  const distFields = new Array(boneCount);
  const dirs = [
    [-1, 0, 1.0],
    [1, 0, 1.0],
    [0, -1, 1.0],
    [0, 1, 1.0],
    [-1, -1, 1.414],
    [1, -1, 1.414],
    [-1, 1, 1.414],
    [1, 1, 1.414],
  ];

  for (let b = 0; b < boneCount; b++) {
    const bone = bones[b];
    const dist = new Float32Array(gw * gh).fill(1e9);
    const heap = new MinHeap();

    const x0 = (bone.start.x / w) * (gw - 1);
    const y0 = (bone.start.y / h) * (gh - 1);
    const x1 = (bone.end.x / w) * (gw - 1);
    const y1 = (bone.end.y / h) * (gh - 1);
    const segLen = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(4, Math.ceil(segLen * 2));

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const gx = Math.max(0, Math.min(gw - 1, Math.round(x0 + (x1 - x0) * t)));
      const gy = Math.max(0, Math.min(gh - 1, Math.round(y0 + (y1 - y0) * t)));
      const idx = gy * gw + gx;
      if (dist[idx] > 0) {
        dist[idx] = 0;
        heap.push(idx, 0);
      }
    }

    while (heap.size > 0) {
      const [curr, d] = heap.pop();
      if (d > dist[curr]) continue;
      const cx = curr % gw;
      const cy = (curr - cx) / gw;

      for (let k = 0; k < 8; k++) {
        const nx = cx + dirs[k][0];
        const ny = cy + dirs[k][1];
        if (nx < 0 || nx >= gw || ny < 0 || ny >= gh) continue;
        const nIdx = ny * gw + nx;
        const penalty = mask[nIdx] ? 1.0 : 8.5;
        const nd = d + dirs[k][2] * penalty;
        if (nd < dist[nIdx]) {
          dist[nIdx] = nd;
          heap.push(nIdx, nd);
        }
      }
    }

    distFields[b] = dist;
  }

  // Weapon bones (hand -> tip): extract crisp rigid weapon sprite layers & clean bodyCanvas
  // so 180-deg swings NEVER stretch shared triangles between blade and skirt/legs!
  const weaponBones = [];
  bones.forEach((b, bi) => {
    if (b.id.startsWith('weapon_')) {
      const wj = skeleton.joints.find((j) => j.id === b.id);
      weaponBones.push({
        bi,
        id: b.id,
        sx: b.start.x,
        sy: b.start.y,
        ex: b.end.x,
        ey: b.end.y,
        radius: wj?.weaponRadius || Math.max(8, (skeleton.bounds?.height || 200) * 0.05),
      });
    }
  });
  const weaponBoneSet = new Set(weaponBones.map((wb) => wb.bi));
  mesh.weaponLayers = [];
  mesh.bodyCanvas = null;

  if (weaponBones.length > 0 && typeof document !== 'undefined') {
    const srcCtx = canvas.getContext('2d', { willReadFrequently: true });
    const srcImg = srcCtx.getImageData(0, 0, w, h);
    const sData = srcImg.data;

    const bodyCanvas = document.createElement('canvas');
    bodyCanvas.width = w;
    bodyCanvas.height = h;
    const bCtx = bodyCanvas.getContext('2d', { willReadFrequently: true });
    const bodyImg = bCtx.createImageData(w, h);
    bodyImg.data.set(sData);

    for (const wb of weaponBones) {
      const wCanvas = document.createElement('canvas');
      wCanvas.width = w;
      wCanvas.height = h;
      const wCtx = wCanvas.getContext('2d', { willReadFrequently: true });
      const wImg = wCtx.createImageData(w, h);
      const wData = wImg.data;

      const radKeep = wb.radius * 1.58;
      const radCut = wb.radius * 1.48;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const p = y * w + x;
          const a = sData[p * 4 + 3];
          if (a <= 12) continue;
          const pPart = partMap ? partMap[p] : 0;
          const sd = segDist(x, y, wb.sx, wb.sy, wb.ex, wb.ey);
          // Protect head (7) and torso (3), and protect legs only near the grip
          if (pPart === 7 || pPart === 3) continue;
          if ((pPart === 1 || pPart === 2 || pPart === 4 || pPart === 5) && sd.t < 0.28) continue;
          if (sd.dist <= radKeep && sd.t >= 0.02) {
            const idx4 = p * 4;
            wData[idx4] = sData[idx4];
            wData[idx4 + 1] = sData[idx4 + 1];
            wData[idx4 + 2] = sData[idx4 + 2];
            wData[idx4 + 3] = a;
            if (sd.dist <= radCut && sd.t >= 0.06) {
              bodyImg.data[idx4 + 3] = 0;
            }
          }
        }
      }
      wCtx.putImageData(wImg, 0, 0);
      mesh.weaponLayers.push({ bi: wb.bi, canvas: wCanvas });
    }
    bCtx.putImageData(bodyImg, 0, 0);
    mesh.bodyCanvas = bodyCanvas;
  }

  mesh.sway = new Float32Array(mesh.vertexCount);
  const sj = Object.fromEntries(skeleton.joints.map((j) => [j.id, j]));
  const bnd = skeleton.bounds || { minX: 0, minY: 0, width: w, height: h };
  const headC = {
    x: ((sj.neck?.x ?? w / 2) + (sj.head?.x ?? w / 2)) / 2,
    y: bnd.minY + ((sj.neck?.y ?? h * 0.35) - bnd.minY) * 0.52,
  };
  const headRX = Math.max(bnd.width * 0.19, Math.abs((sj.shoulder_l?.x ?? 0) - (sj.shoulder_r?.x ?? 0)) * 0.82);
  const headRY = Math.max(bnd.height * 0.22, Math.abs((sj.neck?.y ?? 0) - bnd.minY) * 1.05);

  const power = Math.max(1.8, Math.min(6.0, rigidity));
  const eps = 1.15;
  const rawWeights = new Float32Array(boneCount);
  const headBoneIdx = bones.findIndex((b) => b.parentId === 'neck');

  for (let v = 0; v < mesh.vertexCount; v++) {
    const vx = mesh.bindPos[v * 2];
    const vy = mesh.bindPos[v * 2 + 1];
    const gx = Math.max(0, Math.min(gw - 1, Math.round((vx / w) * (gw - 1))));
    const gy = Math.max(0, Math.min(gh - 1, Math.round((vy / h) * (gh - 1))));
    const gIdx = gy * gw + gx;

    const px = Math.max(0, Math.min(w - 1, Math.round(vx)));
    const py = Math.max(0, Math.min(h - 1, Math.round(vy)));
    const pPart = partMap ? partMap[py * w + px] : 0;

    // 100% Rigid Head Protection: vertices inside the Head part (7) bind 100% to `neck -> head`
    if (pPart === 7 && headBoneIdx !== -1) {
      const base = v * 4;
      mesh.boneIndices[base] = headBoneIdx;
      mesh.boneWeights[base] = 1.0;
      for (let k = 1; k < 4; k++) {
        mesh.boneIndices[base + k] = 0;
        mesh.boneWeights[base + k] = 0;
      }
      continue;
    }

    const ownerPivot = PART_INDEX_TO_PIVOT[pPart];

    for (let b = 0; b < boneCount; b++) {
      const d = distFields[b][gIdx];
      let wVal = 1.0 / Math.pow(d + eps, power);

      if (ownerPivot && bones[b].parentId === ownerPivot) {
        wVal *= 3.8;
      }
      if (headBoneIdx !== -1 && b === headBoneIdx && pPart !== 7) {
        wVal *= 0.08;
      }
      if (weaponBoneSet.has(b)) wVal = 0;
      rawWeights[b] = wVal;
    }

    const topIdx = [0, 0, 0, 0];
    const topW = [0, 0, 0, 0];

    for (let b = 0; b < boneCount; b++) {
      const rw = rawWeights[b];
      if (rw > topW[3]) {
        let pos = 3;
        while (pos > 0 && rw > topW[pos - 1]) {
          topW[pos] = topW[pos - 1];
          topIdx[pos] = topIdx[pos - 1];
          pos--;
        }
        topW[pos] = rw;
        topIdx[pos] = b;
      }
    }

    const sum = topW[0] + topW[1] + topW[2] + topW[3] || 1;
    const base = v * 4;
    for (let k = 0; k < 4; k++) {
      mesh.boneIndices[base + k] = topIdx[k];
      mesh.boneWeights[base + k] = topW[k] / sum;
    }

    // Hair / cape sway: back-layer pixels far from the face flutter gently
    if (pPart === 6) {
      const hd = Math.hypot((vx - headC.x) / headRX, (vy - headC.y) / headRY);
      mesh.sway[v] = smoothstep(1.05, 1.9, hd);
    }
  }
}

export function deformMesh(mesh, boneTransforms) {
  const count = mesh.vertexCount;
  const bindPos = mesh.bindPos;
  const outPos = mesh.deformedPos;
  const bIndices = mesh.boneIndices;
  const bWeights = mesh.boneWeights;
  const numBones = boneTransforms.length;
  const sw = boneTransforms.sway;

  for (let v = 0; v < count; v++) {
    const vx = bindPos[v * 2];
    const vy = bindPos[v * 2 + 1];
    const base = v * 4;
    let fx = 0;
    let fy = 0;
    for (let k = 0; k < 4; k++) {
      const w = bWeights[base + k];
      if (w <= 0.0001) continue;
      const bi = bIndices[base + k];
      if (bi >= numBones) continue;
      const bt = boneTransforms[bi];
      const lx = vx - bt.pBindX;
      const ly = vy - bt.pBindY;
      fx += (bt.pPosedX + bt.m00 * lx + bt.m01 * ly) * w;
      fy += (bt.pPosedY + bt.m10 * lx + bt.m11 * ly) * w;
    }
    if (sw && mesh.sway && mesh.sway[v] > 0.001) {
      const k = mesh.sway[v] * sw.amp;
      fx += Math.sin(sw.phase + vy * 0.05 + vx * 0.018) * k;
      fy += Math.cos(sw.phase * 2 + vx * 0.04) * k * 0.3;
    }
    outPos[v * 2] = fx;
    outPos[v * 2 + 1] = fy;
  }

  mesh.weaponTransforms = (mesh.weaponLayers || []).map((wl) => boneTransforms[wl.bi] || null);
  mesh.fx = boneTransforms.fx || null;
}

/**
 * Renders a deformed 2D triangle mesh onto any 2D Canvas context using affine triangle clipping.
 * Works 100% offline in any canvas without needing multiple WebGL contexts!
 */
export function renderDeformedMesh2D(targetCtx, imageCanvas, mesh, view = {}, pixelArt = false) {
  if (!mesh || !imageCanvas || mesh.indices.length === 0) return;
  const { offsetX = 0, offsetY = 0, scale = 1, flipX = false, flash = 0 } = view;

  const srcW = mesh.width;
  const srcH = mesh.height;

  if (!targetCtx._meshWorkCanvas) {
    targetCtx._meshWorkCanvas = document.createElement('canvas');
  }
  const workCanvas = targetCtx._meshWorkCanvas;
  if (workCanvas.width !== srcW || workCanvas.height !== srcH) {
    workCanvas.width = srcW;
    workCanvas.height = srcH;
  }
  const wctx = workCanvas.getContext('2d');
  wctx.clearRect(0, 0, srcW, srcH);
  wctx.imageSmoothingEnabled = !pixelArt;

  const bind = mesh.bindPos;
  const def = mesh.deformedPos;
  const idx = mesh.indices;

  const bodySource = mesh.bodyCanvas || imageCanvas;
  for (let i = 0; i < idx.length; i += 3) {
    const i0 = idx[i] * 2;
    const i1 = idx[i + 1] * 2;
    const i2 = idx[i + 2] * 2;

    const sx0 = bind[i0], sy0 = bind[i0 + 1];
    const sx1 = bind[i1], sy1 = bind[i1 + 1];
    const sx2 = bind[i2], sy2 = bind[i2 + 1];

    const dx0 = def[i0], dy0 = def[i0 + 1];
    const dx1 = def[i1], dy1 = def[i1 + 1];
    const dx2 = def[i2], dy2 = def[i2 + 1];

    // Solve affine transform mapping (sx0,sy0)->(dx0,dy0), (sx1,sy1)->(dx1,dy1), (sx2,sy2)->(dx2,dy2)
    const denom = (sx1 - sx0) * (sy2 - sy0) - (sx2 - sx0) * (sy1 - sy0);
    if (Math.abs(denom) < 1e-4) continue;
    const inv = 1.0 / denom;

    const a = ((dx1 - dx0) * (sy2 - sy0) - (dx2 - dx0) * (sy1 - sy0)) * inv;
    const b = ((dy1 - dy0) * (sy2 - sy0) - (dy2 - dy0) * (sy1 - sy0)) * inv;
    const c = ((sx1 - sx0) * (dx2 - dx0) - (sx2 - sx0) * (dx1 - dx0)) * inv;
    const d = ((sx1 - sx0) * (dy2 - dy0) - (sx2 - sx0) * (dy1 - dy0)) * inv;
    const e = dx0 - a * sx0 - c * sy0;
    const f = dy0 - b * sx0 - d * sy0;

    // Expand triangle clip by 0.45px outward from centroid to prevent 1px subpixel hairline seams
    const cx = (dx0 + dx1 + dx2) / 3;
    const cy = (dy0 + dy1 + dy2) / 3;
    const expand = (px, py) => {
      const vx = px - cx, vy = py - cy;
      const len = Math.hypot(vx, vy) || 1;
      return [px + (vx / len) * 0.48, py + (vy / len) * 0.48];
    };
    const [ex0, ey0] = expand(dx0, dy0);
    const [ex1, ey1] = expand(dx1, dy1);
    const [ex2, ey2] = expand(dx2, dy2);

    wctx.save();
    wctx.beginPath();
    wctx.moveTo(ex0, ey0);
    wctx.lineTo(ex1, ey1);
    wctx.lineTo(ex2, ey2);
    wctx.closePath();
    wctx.clip();
    wctx.transform(a, b, c, d, e, f);
    wctx.drawImage(bodySource, 0, 0);
    wctx.restore();
  }

  // Draw crisp rigid weapon layers on top of the deformed body
  if (mesh.weaponLayers && mesh.weaponTransforms) {
    for (let k = 0; k < mesh.weaponLayers.length; k++) {
      const wl = mesh.weaponLayers[k];
      const bt = mesh.weaponTransforms[k];
      if (!wl || !bt) continue;
      wctx.save();
      const tx = bt.pPosedX - (bt.m00 * bt.pBindX + bt.m01 * bt.pBindY);
      const ty = bt.pPosedY - (bt.m10 * bt.pBindX + bt.m11 * bt.pBindY);
      wctx.transform(bt.m00, bt.m10, bt.m01, bt.m11, tx, ty);
      wctx.drawImage(wl.canvas, 0, 0);
      wctx.restore();
    }
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

  if (mesh.fx) drawSlashFX(targetCtx, mesh.fx, view, srcW);
}
