/**
 * Slash / weapon-trail FX. Drawn in image space on top of the character.
 * pose.slash = { side: 'r' | 'l', alpha: 0..1, trail: radians }
 */
export function computeSlashFX(skeleton, posedJoints, pose) {
  const s = pose?.slash;
  if (!s || s.alpha < 0.02 || !posedJoints) return null;
  const hand = posedJoints['hand_' + s.side];
  const tip = posedJoints['weapon_' + s.side];
  if (!hand || !tip) return null;
  const wj = skeleton?.joints?.find((j) => j.id === 'weapon_' + s.side);
  const sg = s.side === 'r' ? 1 : -1;
  return {
    cx: hand.x,
    cy: hand.y,
    r: Math.hypot(tip.x - hand.x, tip.y - hand.y),
    lead: Math.atan2(tip.y - hand.y, tip.x - hand.x),
    trail: s.trail * sg,
    alpha: s.alpha,
    color: wj?.weaponColor || '#ff5fa2',
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function drawSlashFX(ctx, fx, view = {}, srcW = 512) {
  if (!fx) return;
  const { offsetX = 0, offsetY = 0, scale = 1, flipX = false } = view;
  const [r, g, b] = hexToRgb(fx.color);
  const N = 28;
  const Ro = fx.r * 1.04;
  const Wmax = fx.r * 0.2;

  const outer = [];
  const inner = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const ang = fx.lead - fx.trail * (1 - u);
    const th = Wmax * Math.pow(Math.sin(u * Math.PI * 0.5), 1.4);
    outer.push([fx.cx + Math.cos(ang) * Ro, fx.cy + Math.sin(ang) * Ro]);
    inner.push([fx.cx + Math.cos(ang) * (Ro - th), fx.cy + Math.sin(ang) * (Ro - th)]);
  }

  ctx.save();
  ctx.translate(offsetX, offsetY);
  if (flipX) {
    ctx.translate(srcW * scale, 0);
    ctx.scale(-scale, scale);
  } else {
    ctx.scale(scale, scale);
  }

  const poly = (fill, shrink, blur) => {
    ctx.beginPath();
    outer.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = N; i >= 0; i--) {
      const [ox, oy] = outer[i];
      const [ix, iy] = inner[i];
      ctx.lineTo(ox + (ix - ox) * shrink, oy + (iy - oy) * shrink);
    }
    ctx.closePath();
    ctx.shadowBlur = blur;
    ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
    ctx.fillStyle = fill;
    ctx.fill();
  };

  poly(`rgba(${r},${g},${b},${0.55 * fx.alpha})`, 1.0, 18);
  poly(`rgba(255,${Math.min(255, g + 120)},${Math.min(255, b + 120)},${0.85 * fx.alpha})`, 0.55, 6);
  poly(`rgba(255,255,255,${0.9 * fx.alpha})`, 0.22, 0);
  ctx.restore();
}
