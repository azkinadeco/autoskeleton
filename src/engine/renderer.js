/**
 * Cutout Part & Skeleton Pivot Overlay Renderer (v3)
 * - High-visibility Draggable Pivot Handles with halo rings & "✋ Tarik Pivot" tooltip
 * - Works in BOTH Animate and Rig tabs so users can drag pivots anytime!
 * - Optional Combat Hurtbox & Weapon Hitbox preview
 */

import { PART_DEFINITIONS, PART_BY_INDEX } from './partCutter.js';

export function drawOverlay(ctx, width, height, options) {
  const {
    charWidth = 384,
    charHeight = 384,
    joints,
    posedJoints,
    view,
    showSkeleton = true,
    showPartMask = false,
    showHitboxes = false,
    partMap = null,
    showShadow = true,
    isRigMode = false,
    explodeAmount = 0,
    selectedJointId = null,
    hoveredJointId = null,
    selectedPartId = null,
    bounds = null,
    activeAnim = 'idle',
  } = options;

  ctx.clearRect(0, 0, width, height);
  if (!view) return;

  const { offsetX, offsetY, scale, flipX } = view;
  const toScreen = (x, y) => {
    const px = flipX ? charWidth - x : x;
    return [px * scale + offsetX, y * scale + offsetY];
  };

  // 1. Ground shadow ellipse
  if (showShadow && bounds) {
    const [gx, gy] = toScreen((bounds.minX + bounds.maxX) * 0.5, bounds.maxY + 4);
    const rx = Math.max(22, bounds.width * 0.36 * scale);
    const ry = Math.max(7, rx * 0.24);
    ctx.save();
    const grad = ctx.createRadialGradient(gx, gy, rx * 0.1, gx, gy, rx);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.44)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(gx, gy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 2. Color-coded Part Segmentation Mask overlay
  if (showPartMask && partMap && explodeAmount < 0.05) {
    ctx.save();
    const step = 3;
    for (let y = 0; y < charHeight; y += step) {
      for (let x = 0; x < charWidth; x += step) {
        const pIdx = partMap[y * charWidth + x];
        if (!pIdx) continue;
        const def = PART_BY_INDEX[pIdx];
        if (!def) continue;
        const isSel = selectedPartId === def.id;
        ctx.fillStyle = def.color + (isSel ? 'aa' : '44');
        const [sx, sy] = toScreen(x, y);
        ctx.fillRect(sx, sy, Math.ceil(step * scale), Math.ceil(step * scale));
      }
    }
    ctx.restore();
  }

  const activeMap = isRigMode
    ? Object.fromEntries((joints || []).map((j) => [j.id, j]))
    : posedJoints;

  if (!activeMap) return;

  // 3. Optional RPG Combat Hurtbox & Weapon Attack Box
  if (showHitboxes && bounds) {
    ctx.save();
    const hip = activeMap.hip || { x: (bounds.minX + bounds.maxX) * 0.5, y: (bounds.minY + bounds.maxY) * 0.6 };
    const head = activeMap.head || { x: hip.x, y: bounds.minY + 20 };
    const [hx0, hy0] = toScreen(hip.x - bounds.width * 0.22, head.y - 18);
    const [hx1, hy1] = toScreen(hip.x + bounds.width * 0.22, bounds.maxY);

    // Green Hurtbox (Body collision)
    ctx.strokeStyle = '#22c55e';
    ctx.fillStyle = 'rgba(34, 197, 94, 0.12)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 3]);
    const bx = Math.min(hx0, hx1), by = Math.min(hy0, hy1);
    const bw = Math.abs(hx1 - hx0), bh = Math.abs(hy1 - hy0);
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeRect(bx, by, bw, bh);

    // Red Weapon Hitbox (around hand_r / sword tip)
    if (activeMap.hand_r && ['attack', 'dash', 'gather', 'run'].includes(activeAnim)) {
      const [wx, wy] = toScreen(activeMap.hand_r.x, activeMap.hand_r.y);
      const rad = bounds.width * 0.24 * scale;
      ctx.strokeStyle = '#ef4444';
      ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
      ctx.beginPath();
      ctx.arc(wx, wy, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // 4. Exploded Cutout Connectors & Part Labels
  if (explodeAmount > 0.02 && bounds) {
    const bh = bounds.height || 200;
    for (const part of PART_DEFINITIONS) {
      const pJoint = activeMap[part.pivotJoint];
      if (!pJoint) continue;

      const expX = pJoint.x + explodeAmount * part.explodeVec.dx * bh;
      const expY = pJoint.y + explodeAmount * part.explodeVec.dy * bh;
      const [sx0, sy0] = toScreen(pJoint.x, pJoint.y);
      const [sx1, sy1] = toScreen(expX, expY);

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = part.color + 'cc';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sx0, sy0);
      ctx.lineTo(sx1, sy1);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = part.color;
      ctx.beginPath();
      ctx.arc(sx1, sy1, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      if (explodeAmount > 0.25) {
        ctx.font = '600 10.5px system-ui, -apple-system, sans-serif';
        const tw = ctx.measureText(part.label).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.beginPath();
        ctx.roundRect(sx1 - tw * 0.5 - 5, sy1 - 23, tw + 10, 16, 4);
        ctx.fill();
        ctx.fillStyle = part.color;
        ctx.fillText(part.label, sx1 - tw * 0.5, sy1 - 11);
      }
      ctx.restore();
    }
  }

  // 5. Skeleton Bones & High-Visibility Draggable Pivot Handles
  if (showSkeleton && joints) {
    for (const jt of joints) {
      if (!jt.parent || !activeMap[jt.parent] || !activeMap[jt.id]) continue;
      const p = activeMap[jt.parent];
      const c = activeMap[jt.id];
      const [x0, y0] = toScreen(p.x, p.y);
      const [x1, y1] = toScreen(c.x, c.y);

      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      if (len < 2) continue;

      const nx = -dy / len;
      const ny = dx / len;
      const bulge = Math.min(6, Math.max(2.4, len * 0.11));
      const mx = x0 + dx * 0.22;
      const my = y0 + dy * 0.22;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(mx + nx * bulge, my + ny * bulge);
      ctx.lineTo(x1, y1);
      ctx.lineTo(mx - nx * bulge, my - ny * bulge);
      ctx.closePath();

      ctx.fillStyle = jt.color + '48';
      ctx.fill();
      ctx.strokeStyle = jt.color;
      ctx.lineWidth = isRigMode ? 2.2 : 1.6;
      ctx.stroke();
      ctx.restore();
    }

    for (const jt of joints) {
      const pos = activeMap[jt.id];
      if (!pos) continue;
      const [sx, sy] = toScreen(pos.x, pos.y);
      const isSelected = jt.id === selectedJointId;
      const isHovered = jt.id === hoveredJointId;
      const radius = isSelected ? 9 : isHovered ? 8.5 : isRigMode ? 6.8 : 5.2;

      ctx.save();
      // Outer glowing halo ring so user clearly sees it's a draggable pivot handle
      if (isHovered || isSelected || isRigMode) {
        ctx.beginPath();
        ctx.arc(sx, sy, radius + (isHovered ? 5 : 3.5), 0, Math.PI * 2);
        ctx.fillStyle = isHovered
          ? 'rgba(56, 189, 248, 0.32)'
          : isSelected
            ? 'rgba(250, 204, 21, 0.28)'
            : 'rgba(255, 255, 255, 0.14)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#ffffff' : jt.color;
      ctx.fill();
      ctx.lineWidth = isSelected || isHovered ? 2.6 : 1.8;
      ctx.strokeStyle = '#090d16';
      ctx.stroke();

      // Crosshair inside pivot handle
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fill();

      if (isHovered || isSelected) {
        ctx.font = '600 11.5px system-ui, -apple-system, sans-serif';
        const text = `✋ Tarik Pivot: ${jt.label}`;
        const tw = ctx.measureText(text).width;
        const bx = Math.min(width - tw - 18, Math.max(10, sx + 14));
        const by = Math.max(22, sy - 10);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.strokeStyle = jt.color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(bx - 6, by - 13, tw + 12, 20, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(text, bx, by + 1);
      }
      ctx.restore();
    }
  }
}
