/**
 * Offline Image Processing Utilities (v4 - Smart Enclosed Background Pocket Removal):
 * - Border flood-fill background removal with dark-outline edge stop
 * - Automatic enclosed background hole removal (e.g. trapped white pockets between raised arms,
 *   hair twin-tails, and legs on JPG sprites like sven_sprite_1.jpg & 100samurai_sprite_1.jpg)
 * - Auto-crop with padding
 * - Built-in RPG demo character generator
 */

export function imageToCanvas(img, maxDim = 640) {
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (w > maxDim || h > maxDim) {
    const scale = maxDim / Math.max(w, h);
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

export function hasTransparency(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + (width - 1)) * 4,
  ];
  let transparentCorners = 0;
  for (const idx of corners) {
    if (data[idx + 3] < 20) transparentCorners++;
  }
  return transparentCorners >= 3;
}

/**
 * Removes solid/gradient background from character sprites (including enclosed background holes
 * trapped between arms, hair, weapons, or legs), while stopping cleanly at dark line-art outlines.
 */
export function removeBackground(sourceCanvas, options = {}) {
  const { tolerance = 30, feather = 1, removeInteriorPockets = true } = options;
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(sourceCanvas, 0, 0);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const sampleCoords = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
    [Math.floor(w / 2), 0],
    [0, Math.floor(h / 2)],
    [w - 1, Math.floor(h / 2)],
  ];

  const seeds = [];
  for (const [sx, sy] of sampleCoords) {
    const idx = (sy * w + sx) * 4;
    if (data[idx + 3] > 20) {
      seeds.push([data[idx], data[idx + 1], data[idx + 2]]);
    }
  }
  if (seeds.length === 0) return out;

  const tolSq = tolerance * tolerance * 3;
  const tightTolSq = Math.max(12, tolerance * 0.55) ** 2 * 3;
  const visited = new Uint8Array(w * h);
  const removed = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  const matchesSeed = (r, g, b, threshSq = tolSq) => {
    for (let i = 0; i < seeds.length; i++) {
      const dr = r - seeds[i][0];
      const dg = g - seeds[i][1];
      const db = b - seeds[i][2];
      if (dr * dr + dg * dg + db * db <= threshSq) return true;
    }
    return false;
  };

  const tryPush = (x, y) => {
    const pos = y * w + x;
    if (visited[pos]) return;
    const idx = pos * 4;
    if (data[idx + 3] < 16 || matchesSeed(data[idx], data[idx + 1], data[idx + 2])) {
      visited[pos] = 1;
      removed[pos] = 1;
      queue[tail++] = pos;
    }
  };

  for (let x = 0; x < w; x++) {
    tryPush(x, 0);
    tryPush(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tryPush(0, y);
    tryPush(w - 1, y);
  }

  // 1. Border BFS flood-fill
  while (head < tail) {
    const pos = queue[head++];
    const x = pos % w;
    const y = (pos - x) / w;
    const pIdx = pos * 4;
    const pr = data[pIdx], pg = data[pIdx + 1], pb = data[pIdx + 2];

    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    for (let i = 0; i < 4; i++) {
      const nx = neighbors[i][0];
      const ny = neighbors[i][1];
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const npos = ny * w + nx;
      if (visited[npos]) continue;
      const nIdx = npos * 4;
      if (data[nIdx + 3] < 16) {
        visited[npos] = 1;
        removed[npos] = 1;
        queue[tail++] = npos;
        continue;
      }
      const r = data[nIdx], g = data[nIdx + 1], b = data[nIdx + 2];
      const dr = r - pr, dg = g - pg, db = b - pb;
      const localClose = dr * dr + dg * dg + db * db <= tolSq * 0.42;
      if (matchesSeed(r, g, b) || (localClose && matchesSeed(pr, pg, pb))) {
        visited[npos] = 1;
        removed[npos] = 1;
        queue[tail++] = npos;
      }
    }
  }

  // 2. Enclosed Interior Background Pocket Removal (for trapped holes between arms/hair/legs)
  if (removeInteriorPockets) {
    const pocketVisited = new Uint8Array(w * h);
    const compNodes = new Int32Array(w * h);

    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        const startPos = y * w + x;
        if (removed[startPos] || pocketVisited[startPos]) continue;
        const sIdx = startPos * 4;
        if (!matchesSeed(data[sIdx], data[sIdx + 1], data[sIdx + 2], tightTolSq)) continue;

        // Flood-fill this interior background-colored island
        let cHead = 0, cTail = 0;
        pocketVisited[startPos] = 1;
        compNodes[cTail++] = startPos;
        let borderDarkCount = 0;
        let borderTotalCount = 0;

        while (cHead < cTail) {
          const curr = compNodes[cHead++];
          const cx = curr % w;
          const cy = (curr - cx) / w;

          const nbs = [
            [cx - 1, cy],
            [cx + 1, cy],
            [cx, cy - 1],
            [cx, cy + 1],
          ];
          for (let k = 0; k < 4; k++) {
            const nx = nbs[k][0], ny = nbs[k][1];
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            const npos = ny * w + nx;
            if (removed[npos] || pocketVisited[npos]) continue;
            const nIdx = npos * 4;
            const nr = data[nIdx], ng = data[nIdx + 1], nb = data[nIdx + 2];
            if (matchesSeed(nr, ng, nb, tightTolSq)) {
              pocketVisited[npos] = 1;
              compNodes[cTail++] = npos;
            } else {
              // Measure if the boundary of this pocket is a dark line-art outline
              borderTotalCount++;
              const lum = 0.299 * nr + 0.587 * ng + 0.114 * nb;
              if (lum < 135) borderDarkCount++;
            }
          }
        }

        // Trapped background pockets between arms/hair/swords are at least 24 pixels
        // and bounded predominantly (> 55%) by dark character line-art outlines
        const darkRatio = borderTotalCount > 0 ? borderDarkCount / borderTotalCount : 0;
        if (cTail >= 24 && cTail < w * h * 0.18 && darkRatio >= 0.55) {
          for (let i = 0; i < cTail; i++) {
            removed[compNodes[i]] = 1;
          }
        }
      }
    }
  }

  for (let i = 0; i < w * h; i++) {
    if (removed[i]) {
      data[i * 4 + 3] = 0;
    }
  }

  if (feather > 0) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const pos = y * w + x;
        if (removed[pos]) continue;
        let bgNeighbors = 0;
        if (removed[pos - 1]) bgNeighbors++;
        if (removed[pos + 1]) bgNeighbors++;
        if (removed[pos - w]) bgNeighbors++;
        if (removed[pos + w]) bgNeighbors++;
        if (bgNeighbors > 0) {
          const idx = pos * 4;
          const factor = 1 - bgNeighbors * 0.16 * feather;
          data[idx + 3] = Math.max(0, Math.round(data[idx + 3] * factor));
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return out;
}

export function normalizeCharacterCanvas(sourceCanvas, paddingRatio = 0.16) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, w, h).data;

  let minX = w, minY = h, maxX = 0, maxY = 0;
  let found = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }

  if (!found) return sourceCanvas;

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const padX = Math.round(Math.max(cw, ch) * paddingRatio);
  const padY = Math.round(Math.max(cw, ch) * paddingRatio);

  const out = document.createElement('canvas');
  out.width = cw + padX * 2;
  out.height = ch + padY * 2;
  const octx = out.getContext('2d', { willReadFrequently: true });
  octx.drawImage(sourceCanvas, minX, minY, cw, ch, padX, padY, cw, ch);
  return out;
}

export function createDemoCharacterCanvas() {
  const w = 320;
  const h = 420;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const cx = w / 2;

  const drawPart = (fn, fill, stroke = '#1a1523', lineWidth = 4) => {
    ctx.save();
    ctx.beginPath();
    fn();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke && lineWidth > 0) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  };

  drawPart(() => {
    ctx.moveTo(cx - 38, 172);
    ctx.quadraticCurveTo(cx - 58, 255, cx - 50, 310);
    ctx.quadraticCurveTo(cx, 326, cx + 50, 310);
    ctx.quadraticCurveTo(cx + 58, 255, cx + 38, 172);
    ctx.closePath();
  }, '#7f1d3a');

  drawPart(() => ctx.roundRect(cx - 36, 268, 26, 78, 11), '#334155');
  drawPart(() => ctx.roundRect(cx - 42, 336, 34, 34, 10), '#5c3a21');
  drawPart(() => ctx.roundRect(cx - 38, 332, 28, 10, 4), '#d97706', '#1a1523', 3);

  drawPart(() => ctx.roundRect(cx + 10, 268, 26, 78, 11), '#334155');
  drawPart(() => ctx.roundRect(cx + 8, 336, 34, 34, 10), '#5c3a21');
  drawPart(() => ctx.roundRect(cx + 10, 332, 28, 10, 4), '#d97706', '#1a1523', 3);

  drawPart(() => {
    ctx.moveTo(cx - 38, 176);
    ctx.lineTo(cx - 72, 232);
    ctx.lineTo(cx - 90, 272);
    ctx.lineTo(cx - 66, 282);
    ctx.lineTo(cx - 46, 240);
    ctx.lineTo(cx - 26, 198);
    ctx.closePath();
  }, '#3b82f6');
  drawPart(() => ctx.arc(cx - 80, 278, 15, 0, Math.PI * 2), '#f1c27d');
  drawPart(() => ctx.ellipse(cx - 44, 180, 22, 16, -0.35, 0, Math.PI * 2), '#cbd5e1');

  drawPart(() => {
    ctx.moveTo(cx + 38, 176);
    ctx.lineTo(cx + 72, 232);
    ctx.lineTo(cx + 90, 272);
    ctx.lineTo(cx + 66, 282);
    ctx.lineTo(cx + 46, 240);
    ctx.lineTo(cx + 26, 198);
    ctx.closePath();
  }, '#3b82f6');

  ctx.save();
  ctx.translate(cx + 86, 276);
  ctx.rotate(0.42);
  drawPart(() => {
    ctx.moveTo(-7, -10);
    ctx.lineTo(-9, -86);
    ctx.lineTo(0, -108);
    ctx.lineTo(9, -86);
    ctx.lineTo(7, -10);
    ctx.closePath();
  }, '#e2e8f0');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-2, -92, 3, 76);
  drawPart(() => ctx.roundRect(-20, -14, 40, 10, 4), '#f59e0b');
  drawPart(() => ctx.roundRect(-5, -4, 10, 22, 4), '#78350f');
  ctx.restore();

  drawPart(() => ctx.arc(cx + 80, 278, 15, 0, Math.PI * 2), '#f1c27d');
  drawPart(() => ctx.ellipse(cx + 44, 180, 22, 16, 0.35, 0, Math.PI * 2), '#cbd5e1');

  drawPart(() => {
    ctx.moveTo(cx - 38, 168);
    ctx.lineTo(cx + 38, 168);
    ctx.lineTo(cx + 44, 274);
    ctx.quadraticCurveTo(cx, 286, cx - 44, 274);
    ctx.closePath();
  }, '#2563eb');

  drawPart(() => {
    ctx.moveTo(cx - 32, 174);
    ctx.lineTo(cx + 32, 174);
    ctx.lineTo(cx + 26, 232);
    ctx.lineTo(cx, 244);
    ctx.lineTo(cx - 26, 232);
    ctx.closePath();
  }, '#94a3b8');

  drawPart(() => {
    ctx.moveTo(cx, 188);
    ctx.lineTo(cx + 12, 206);
    ctx.lineTo(cx, 224);
    ctx.lineTo(cx - 12, 206);
    ctx.closePath();
  }, '#38bdf8', '#0c4a6e', 3);

  drawPart(() => ctx.roundRect(cx - 42, 246, 84, 16, 5), '#78350f');
  drawPart(() => ctx.roundRect(cx - 12, 244, 24, 20, 4), '#fbbf24');
  drawPart(() => ctx.roundRect(cx - 12, 148, 24, 24, 8), '#f1c27d');
  drawPart(() => ctx.ellipse(cx, 114, 44, 44, 0, 0, Math.PI * 2), '#fde2c4');

  drawPart(() => {
    ctx.moveTo(cx - 46, 116);
    ctx.quadraticCurveTo(cx - 52, 72, cx - 22, 60);
    ctx.lineTo(cx - 10, 44);
    ctx.lineTo(cx + 6, 58);
    ctx.lineTo(cx + 26, 46);
    ctx.lineTo(cx + 34, 66);
    ctx.quadraticCurveTo(cx + 54, 78, cx + 46, 116);
    ctx.lineTo(cx + 38, 96);
    ctx.lineTo(cx + 24, 108);
    ctx.lineTo(cx + 8, 92);
    ctx.lineTo(cx - 10, 108);
    ctx.lineTo(cx - 26, 94);
    ctx.lineTo(cx - 38, 108);
    ctx.closePath();
  }, '#1e293b');

  drawPart(() => ctx.roundRect(cx - 42, 84, 84, 11, 5), '#ef4444', '#1a1523', 3);

  const drawEye = (ex) => {
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.ellipse(ex, 120, 6, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath(); ctx.ellipse(ex, 122, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(ex - 2, 117, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  drawEye(cx - 17);
  drawEye(cx + 17);

  ctx.save();
  ctx.strokeStyle = '#7c2d12';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, 134, 8, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();

  return canvas;
}
