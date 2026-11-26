// Offline preview: node tools/preview.js <png> <anim> [out.png] [dir] [template]
const path = require('path'), { pathToFileURL } = require('url');
const { decode, encode } = require('./png.js');
const [,, file = 'contoh/contoh 2/standing.png', anim = 'attack', out = 'tools/out.png', dir = 'front', tpl = 'auto_smart'] = process.argv;

class Canvas {
  constructor(w = 1, h = 1) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); }
  getContext() {
    const c = this;
    return {
      getImageData: (x, y, w, h) => ({ data: c.data, width: c.width, height: c.height }),
      putImageData: (img) => { c.data = new Uint8ClampedArray(img.data); },
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      clearRect: () => c.data.fill(0),
      drawImage: (src, dx = 0, dy = 0, dw = src.width, dh = src.height) => {
        const sw = src.width, sh = src.height;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
          const sx = Math.min(sw - 1, Math.floor(x / c.width * sw)), sy = Math.min(sh - 1, Math.floor(y / c.height * sh));
          // box sample for downscale
          const bx = Math.max(1, Math.floor(sw / c.width)), by = Math.max(1, Math.floor(sh / c.height));
          let r = 0, g = 0, b = 0, a = 0, n = 0;
          for (let yy = 0; yy < by; yy++) for (let xx = 0; xx < bx; xx++) {
            const i = (Math.min(sh - 1, sy + yy) * sw + Math.min(sw - 1, sx + xx)) * 4, al = src.data[i + 3];
            r += src.data[i] * al; g += src.data[i + 1] * al; b += src.data[i + 2] * al; a += al; n++;
          }
          const o = (y * c.width + x) * 4;
          if (a > 0) { c.data[o] = r / a; c.data[o + 1] = g / a; c.data[o + 2] = b / a; c.data[o + 3] = a / n; }
        }
      },
    };
  }
}
globalThis.document = { createElement: () => new Canvas() };

(async () => {
  const imp = (p) => import(pathToFileURL(path.resolve(p)).href);
  const sk = await imp('src/engine/skeleton.js'), pc = await imp('src/engine/partCutter.js'), ms = await imp('src/engine/meshSkinning.js'), an = await imp('src/engine/animations.js');
  // load + crop + pad + resize to 480
  const im = decode(file);
  let x0 = im.width, x1 = 0, y0 = im.height, y1 = 0;
  for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) if (im.data[(y * im.width + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, pad = 0.16, side = Math.max(bw, bh) * (1 + pad * 2), S = 480;
  const canvas = new Canvas(S, S), sc = S / side;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const sx0 = x0 + bw / 2 + (x - S / 2) / sc, sy0 = y0 + bh / 2 + (y - S / 2) / sc, n = Math.max(1, Math.floor(1 / sc));
    let r = 0, g = 0, b = 0, a = 0, k = 0;
    for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) {
      const ix = Math.round(sx0 + xx), iy = Math.round(sy0 + yy);
      if (ix < 0 || iy < 0 || ix >= im.width || iy >= im.height) { k++; continue; }
      const i = (iy * im.width + ix) * 4, al = im.data[i + 3]; r += im.data[i] * al; g += im.data[i + 1] * al; b += im.data[i + 2] * al; a += al; k++;
    }
    const o = (y * S + x) * 4; if (a > 0) { canvas.data[o] = r / a; canvas.data[o + 1] = g / a; canvas.data[o + 2] = b / a; canvas.data[o + 3] = a / k; }
  }
  const skel = sk.autoDetectSkeleton(canvas, tpl, dir); skel.viewDirection = dir;
  const partMap = pc.autoSegmentParts(canvas, skel);
  const mesh = ms.buildCharacterMesh(canvas, 34);
  ms.computeSkinWeights(mesh, canvas, skel, 3.2, partMap);

  const N = 8, FS = 480, W = FS * 5, H = FS * 2;
  const sheet = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < W * H; i++) { sheet[i*4]=34; sheet[i*4+1]=40; sheet[i*4+2]=52; sheet[i*4+3]=255; }
  const blend = (px, py, r, g, b, a, ox) => { if (px < 0 || py < 0 || px >= FS || py >= FS) return; const o = (py * W + ox + px) * 4, f = a / 255; sheet[o] = sheet[o]*(1-f)+r*f; sheet[o+1] = sheet[o+1]*(1-f)+g*f; sheet[o+2] = sheet[o+2]*(1-f)+b*f; };
  const frames = [null, ...Array.from({ length: N }, (_, i) => i / N)];
  const drawFrame = (t, slot) => {
    const ox = (slot % 5) * FS, oy = Math.floor(slot / 5) * FS;
    const pose = t === null ? { rootOffset: {x:0,y:0}, rootScale: {x:1,y:1}, rotations: {} } : an.evaluateAnimation(anim, t, skel, { intensity: 1, squash: 1 });
    const fk = sk.solveForwardKinematics(skel, pose);
    ms.deformMesh(mesh, fk.boneTransforms);
    const P = mesh.deformedPos, UV = mesh.uvs, I = mesh.indices;
    const bl = (px, py, r, g, b, a) => { const o = ((oy + py) * W + ox + px) * 4; if (px<0||py<0||px>=FS||py>=FS) return; const f = a/255; sheet[o]=sheet[o]*(1-f)+r*f; sheet[o+1]=sheet[o+1]*(1-f)+g*f; sheet[o+2]=sheet[o+2]*(1-f)+b*f; };
    const bodySrc = mesh.bodyCanvas || canvas;
    for (let t3 = 0; t3 < I.length; t3 += 3) {
      const a = I[t3], b = I[t3+1], c = I[t3+2];
      const ax = P[a*2], ay = P[a*2+1], bx = P[b*2], by = P[b*2+1], cx = P[c*2], cy = P[c*2+1];
      const minx = Math.max(0, Math.floor(Math.min(ax,bx,cx))), maxx = Math.min(FS-1, Math.ceil(Math.max(ax,bx,cx)));
      const miny = Math.max(0, Math.floor(Math.min(ay,by,cy))), maxy = Math.min(FS-1, Math.ceil(Math.max(ay,by,cy)));
      const den = (by-cy)*(ax-cx)+(cx-bx)*(ay-cy); if (Math.abs(den) < 1e-6) continue;
      for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
        const l1 = ((by-cy)*(x+.5-cx)+(cx-bx)*(y+.5-cy))/den, l2 = ((cy-ay)*(x+.5-cx)+(ax-cx)*(y+.5-cy))/den, l3 = 1-l1-l2;
        if (l1 < -0.01 || l2 < -0.01 || l3 < -0.01) continue;
        const u = l1*UV[a*2]+l2*UV[b*2]+l3*UV[c*2], v = l1*UV[a*2+1]+l2*UV[b*2+1]+l3*UV[c*2+1];
        const sx = Math.min(S-1, Math.max(0, Math.floor(u*S))), sy = Math.min(S-1, Math.max(0, Math.floor(v*S))), i = (sy*S+sx)*4;
        if (bodySrc.data[i+3] > 8) bl(x, y, bodySrc.data[i], bodySrc.data[i+1], bodySrc.data[i+2], bodySrc.data[i+3]);
      }
    }
    // Draw rigid weapon layers
    for (let k = 0; k < (mesh.weaponLayers || []).length; k++) {
      const wl = mesh.weaponLayers[k], bt = mesh.weaponTransforms[k];
      if (!wl || !bt) continue;
      const det = bt.m00 * bt.m11 - bt.m01 * bt.m10;
      if (Math.abs(det) < 1e-6) continue;
      const inv00 = bt.m11 / det, inv01 = -bt.m01 / det, inv10 = -bt.m10 / det, inv11 = bt.m00 / det;
      for (let y = 0; y < FS; y++) for (let x = 0; x < FS; x++) {
        const dx = x - bt.pPosedX, dy = y - bt.pPosedY;
        const sx = Math.round(bt.pBindX + inv00 * dx + inv01 * dy);
        const sy = Math.round(bt.pBindY + inv10 * dx + inv11 * dy);
        if (sx < 0 || sy < 0 || sx >= S || sy >= S) continue;
        const i = (sy * S + sx) * 4;
        if (wl.canvas.data[i+3] > 8) bl(x, y, wl.canvas.data[i], wl.canvas.data[i+1], wl.canvas.data[i+2], wl.canvas.data[i+3]);
      }
    }
    for (const j of Object.values(fk.posedJoints)) for (let dy=-3;dy<=3;dy++) for (let dx=-3;dx<=3;dx++) bl(Math.round(j.x)+dx, Math.round(j.y)+dy, 255, 255, 0, 255);
  };
  frames.forEach((t, i) => drawFrame(t, i));
  encode(W, H, sheet, out);
  console.log('joints', skel.joints.map(j => `${j.id}:${Math.round(j.x)},${Math.round(j.y)}`).join(' '));
  console.log('written', out);
})();
