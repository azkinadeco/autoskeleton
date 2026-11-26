/**
 * Interactive 2D RPG Playtest Arena (v4 - Supports both Hybrid Pivot Mesh & Cutout Layers + 4 Directions)
 */

import { solveForwardKinematics } from '../engine/skeleton.js';
import { renderCutoutCharacter } from '../engine/partCutter.js';
import { deformMesh, renderDeformedMesh2D } from '../engine/meshSkinning.js';
import { evaluateAnimation } from '../engine/animations.js';

export class PlaytestArena {
  constructor(bgCanvas) {
    this.bgCanvas = bgCanvas;
    this.bgCtx = bgCanvas.getContext('2d');

    this.active = false;
    this.keys = new Set();

    this.x = 320;
    this.y = 260;
    this.z = 0;
    this.vz = 0;
    this.facingLeft = false;

    this.state = 'idle';
    this.stateTimer = 0;
    this.animPhase = 0;
    this.particles = [];

    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) {
        e.preventDefault();
      }
      this.keys.add(k);

      if (k === ' ' && this.z <= 0.1) {
        this.vz = 520;
        this.state = 'jump';
        this.animPhase = 0;
      } else if (k === 'j' || k === 'z') {
        this.triggerAction('attack');
      } else if (k === 'k' || k === 'x') {
        this.triggerAction('cast');
      } else if (k === 'l') {
        this.triggerAction('dash');
      } else if (k === 'b') {
        this.triggerAction('block');
      } else if (k === 'h') {
        this.triggerAction('hurt');
      } else if (k === 'v') {
        this.triggerAction('victory');
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
  }

  setCharacter(imageCanvas, partLayers, mesh, skeleton, options = {}) {
    this.imageCanvas = imageCanvas;
    this.partLayers = partLayers;
    this.mesh = mesh;
    this.skeleton = skeleton;
    this.options = options;
  }

  triggerAction(actionName) {
    this.state = actionName;
    this.stateTimer = actionName === 'cast' ? 0.65 : 0.45;
    this.animPhase = 0;

    const dir = this.facingLeft ? -1 : 1;
    if (actionName === 'attack' || actionName === 'dash') {
      for (let i = 0; i < 8; i++) {
        this.particles.push({
          x: this.x + dir * (35 + Math.random() * 35),
          y: this.y - 45 - this.z + (Math.random() - 0.5) * 45,
          vx: dir * (90 + Math.random() * 140),
          vy: (Math.random() - 0.5) * 90,
          life: 0.35,
          maxLife: 0.45,
          color: actionName === 'attack' ? '#fbbf24' : '#38bdf8',
          size: 5,
        });
      }
    } else if (actionName === 'cast') {
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2;
        this.particles.push({
          x: this.x + Math.cos(ang) * 28,
          y: this.y - 50 - this.z + Math.sin(ang) * 28,
          vx: Math.cos(ang) * 90,
          vy: Math.sin(ang) * 90 - 40,
          life: 0.55,
          maxLife: 0.7,
          color: '#38bdf8',
          size: 4,
        });
      }
    }
  }

  resize(w, h) {
    this.bgCanvas.width = w;
    this.bgCanvas.height = h;
    this.x = Math.min(Math.max(80, this.x), w - 80);
    this.y = Math.min(Math.max(140, this.y), h - 60);
  }

  update(dt) {
    if (!this.active || !this.skeleton) return;

    const w = this.bgCanvas.width;
    const h = this.bgCanvas.height;

    let mx = 0, my = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) my -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) my += 1;

    const moving = mx !== 0 || my !== 0;
    const running = !this.keys.has('control');
    const speed = running ? 250 : 150;

    if (moving) {
      const len = Math.hypot(mx, my);
      this.x += (mx / len) * speed * dt;
      this.y += (my / len) * speed * 0.75 * dt;
      if (mx < 0) this.facingLeft = true;
      if (mx > 0) this.facingLeft = false;
    }

    this.x = Math.max(70, Math.min(w - 70, this.x));
    this.y = Math.max(130, Math.min(h - 45, this.y));

    if (this.z > 0 || this.vz > 0) {
      this.z += this.vz * dt;
      this.vz -= 1350 * dt;
      if (this.z <= 0) {
        this.z = 0;
        this.vz = 0;
        if (this.state === 'jump') this.state = 'idle';
      }
    }

    if (this.stateTimer > 0) {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.state = 'idle';
    } else if (this.z > 0) {
      this.state = 'jump';
    } else if (moving) {
      this.state = running ? 'run' : 'walk';
    } else {
      this.state = 'idle';
    }

    const rateMap = {
      idle: 1.0,
      walk: 1.4,
      run: 1.85,
      dash: 2.2,
      jump: 1.35,
      attack: 2.1,
      cast: 1.5,
      block: 1.2,
      hurt: 2.0,
      victory: 1.6,
    };
    this.animPhase = (this.animPhase + dt * (rateMap[this.state] || 1.2)) % 1;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    this._renderScene();
  }

  _renderScene() {
    const ctx = this.bgCtx;
    const w = this.bgCanvas.width;
    const h = this.bgCanvas.height;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#132238');
    grad.addColorStop(0.28, '#1e3a5f');
    grad.addColorStop(0.29, '#1e3a2f');
    grad.addColorStop(1, '#142921');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    for (let x = 0; x < w; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, h * 0.29);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = Math.floor(h * 0.29); y < h; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const shadowScale = Math.max(0.45, 1 - this.z / 260);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, 42 * shadowScale, 13 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    for (const pt of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const pose = evaluateAnimation(this.state, this.animPhase, this.skeleton, {
      intensity: this.options?.intensity ?? 1.0,
      squash: this.options?.squash ?? 1.0,
    });
    const { posedJoints, boneTransforms } = solveForwardKinematics(this.skeleton, pose);

    const srcW = this.imageCanvas?.width || 384;
    const srcH = this.imageCanvas?.height || 384;
    const scale = 210 / srcH;
    const drawW = srcW * scale;
    const drawH = srcH * scale;

    const view = {
      offsetX: this.x - drawW * 0.5,
      offsetY: this.y - drawH * 0.80 - this.z,
      scale,
      flipX: this.facingLeft,
      flash: pose.flash || 0,
    };

    const renderMode = this.options?.renderMode || 'hybrid_mesh';
    const pixelArt = this.options?.pixelArt ?? false;

    if (renderMode === 'hybrid_mesh' && this.mesh) {
      deformMesh(this.mesh, boneTransforms);
      renderDeformedMesh2D(ctx, this.imageCanvas, this.mesh, view, pixelArt);
    } else if (this.partLayers) {
      renderCutoutCharacter(ctx, w, h, {
        partLayers: this.partLayers,
        skeleton: this.skeleton,
        posedJoints,
        pose,
        view,
        pixelArt,
        explodeAmount: 0,
      });
    }
  }
}
