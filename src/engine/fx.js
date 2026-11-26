/**
 * Next-Gen Anime Combat VFX Engine (v5)
 * Renders multi-layered crescent sword slashes, inner speed-ribbons,
 * leading-edge star flares, radial impact spark streaks, and ground aura rings.
 */
export function computeSlashFX(skeleton, posedJoints, pose) {
  const s = pose?.slash;
  if (!s || s.alpha < 0.02 || !posedJoints) return null;
  const hand = posedJoints['hand_' + s.side];
  const tip = posedJoints['weapon_' + s.side];
  const chest = posedJoints.chest || posedJoints.hip || hand;
  if (!hand || !tip) return null;
  const wj = skeleton?.joints?.find((j) => j.id === 'weapon_' + s.side);
  const bh = skeleton?.bounds?.height || 220;
  const sg = s.side === 'r' ? 1 : -1;

  // Center the heroic slash crescent slightly in front of the chest so it wraps across the character & shield
  const cx = s.centerChest
    ? chest.x * 0.72 + hand.x * 0.28 + (s.offsetX || 0) * bh
    : hand.x;
  const cy = s.centerChest
    ? chest.y * 0.75 + hand.y * 0.25 + (s.offsetY || 0) * bh
    : hand.y;
  const r = s.radiusScale
    ? bh * s.radiusScale
    : Math.max(bh * 0.46, Math.hypot(tip.x - hand.x, tip.y - hand.y) * 0.96);
  const lead = s.leadAngle != null
    ? s.leadAngle
    : Math.atan2(tip.y - cy, tip.x - cx);

  return {
    cx,
    cy,
    r,
    ry: r * (s.ellipseRatio || 0.78),
    tilt: s.tilt || 0,
    lead,
    trail: s.trail * sg,
    alpha: s.alpha,
    sparks: s.sparks ?? s.alpha,
    seed: s.seed || 1,
    color: s.color || wj?.weaponColor || '#ff4d94',
  };
}

function hexToRgb(hex) {
  const clean = (hex || '#ff4d94').replace('#', '');
  const n = parseInt(clean, 16) || 0xff4d94;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function evalCrescentPoint(fx, ang, radScale = 1) {
  const rx = fx.r * radScale;
  const ry = (fx.ry || fx.r * 0.82) * radScale;
  const lx = Math.cos(ang) * rx;
  const ly = Math.sin(ang) * ry;
  const ct = Math.cos(fx.tilt || 0);
  const st = Math.sin(fx.tilt || 0);
  return [
    fx.cx + lx * ct - ly * st,
    fx.cy + lx * st + ly * ct,
  ];
}

export function drawSlashFX(ctx, fx, view = {}, srcW = 512) {
  if (!fx || view.showVfx === false) return;
  const { offsetX = 0, offsetY = 0, scale = 1, flipX = false } = view;
  const [r, g, b] = hexToRgb(fx.color);
  // Boost saturation/brightness for anime pink/cyan glow
  const br = Math.min(255, Math.max(r, 235));
  const bg = Math.min(255, Math.round(g * 0.75 + 45));
  const bb = Math.min(255, Math.round(b * 0.85 + 75));

  const N = 34;
  const Ro = 1.06;
  const Wmax = 0.30;

  const outer = [];
  const inner = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const ang = fx.lead - fx.trail * (1 - u);
    // Sharp tapered tail (u=0) and sharp leading tip (u=1) with wide belly around u=0.68
    const taper = Math.sin(Math.pow(u, 0.75) * Math.PI);
    const th = Wmax * Math.pow(Math.max(0, taper), 0.85);
    outer.push(evalCrescentPoint(fx, ang, Ro));
    inner.push(evalCrescentPoint(fx, ang, Ro - th));
  }

  ctx.save();
  ctx.translate(offsetX, offsetY);
  if (flipX) {
    ctx.translate(srcW * scale, 0);
    ctx.scale(-scale, scale);
  } else {
    ctx.scale(scale, scale);
  }

  const drawRibbon = (fill, outerBias, innerShrink, blur) => {
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const [ox, oy] = outer[i];
      const [ix, iy] = inner[i];
      const px = ox + (ix - ox) * outerBias;
      const py = oy + (iy - oy) * outerBias;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    for (let i = N; i >= 0; i--) {
      const [ox, oy] = outer[i];
      const [ix, iy] = inner[i];
      const px = ox + (ix - ox) * innerShrink;
      const py = oy + (iy - oy) * innerShrink;
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.shadowBlur = blur;
    ctx.shadowColor = `rgba(${br},${bg},${bb},0.95)`;
    ctx.fillStyle = fill;
    ctx.fill();
  };

  // Layer 1: Outer bloom
  drawRibbon(`rgba(${br},${bg},${bb},${0.42 * fx.alpha})`, -0.08, 1.12, 22);
  // Layer 2: Rich anime crescent body
  drawRibbon(`rgba(${br},${bg},${bb},${0.88 * fx.alpha})`, 0.0, 0.92, 10);
  // Layer 3: Mid bright pink/pastel band
  drawRibbon(`rgba(255,${Math.min(255, bg + 95)},${Math.min(255, bb + 95)},${0.92 * fx.alpha})`, 0.08, 0.54, 4);
  // Layer 4: Razor-sharp hot white outer edge core
  drawRibbon(`rgba(255,255,255,${0.96 * fx.alpha})`, 0.03, 0.25, 0);
  // Layer 5: Secondary inner speed-line ribbon (AutoSprite signature double-arc)
  drawRibbon(`rgba(255,255,255,${0.72 * fx.alpha})`, 0.72, 0.84, 0);

  // Leading-edge impact flash & radial spark streaks (like frame 5 of bloody charlote)
  if (fx.sparks > 0.15) {
    const tipIdx = Math.floor(N * 0.88);
    const [tx, ty] = outer[tipIdx];
    const sparkAlpha = Math.min(1, fx.sparks);

    // Glowing impact star at the slash apex
    const starR = fx.r * 0.14 * sparkAlpha;
    ctx.fillStyle = `rgba(255,255,255,${0.92 * sparkAlpha})`;
    ctx.shadowBlur = 12;
    ctx.shadowColor = `rgba(${br},${bg},${bb},1)`;
    for (let a = 0; a < 2; a++) {
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(a * Math.PI * 0.5 + 0.25);
      ctx.beginPath();
      ctx.moveTo(-starR * 1.8, 0);
      ctx.lineTo(0, -starR * 0.28);
      ctx.lineTo(starR * 1.8, 0);
      ctx.lineTo(0, starR * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Radial flying spark streaks & particles
    const rays = [
      { ang: -0.55, d0: 0.12, d1: 0.42, w: 2.4, white: true },
      { ang: -0.22, d0: 0.10, d1: 0.34, w: 2.0, white: false },
      { ang: 0.08,  d0: 0.14, d1: 0.46, w: 2.2, white: true },
      { ang: 0.38,  d0: 0.10, d1: 0.30, w: 1.8, white: false },
      { ang: -0.82, d0: 0.18, d1: 0.36, w: 1.6, white: false },
    ];
    const baseDir = Math.atan2(ty - fx.cy, tx - fx.cx);
    ctx.lineCap = 'round';
    for (const ray of rays) {
      const dir = baseDir + ray.ang;
      const x0 = tx + Math.cos(dir) * fx.r * ray.d0;
      const y0 = ty + Math.sin(dir) * fx.r * ray.d0;
      const x1 = tx + Math.cos(dir) * fx.r * ray.d1 * sparkAlpha;
      const y1 = ty + Math.sin(dir) * fx.r * ray.d1 * sparkAlpha;
      ctx.strokeStyle = ray.white
        ? `rgba(255,255,255,${0.88 * sparkAlpha})`
        : `rgba(${br},${bg},${bb},${0.88 * sparkAlpha})`;
      ctx.lineWidth = ray.w;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  }

  ctx.restore();
}
