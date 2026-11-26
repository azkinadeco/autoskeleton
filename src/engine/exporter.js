/**
 * Offline Sprite Sheet PNG + JSON Atlas + WebM Exporter + Engine Code Generator (v4)
 * Supports BOTH:
 * - 'hybrid_mesh' (Part-Guided Smooth Pivot Mesh — zero cut seams on Front/Back/Aetheria sprites)
 * - 'cutout_layers' (10-Layer Cutout Renderer — wide scissoring legs on Side/3-4 pixel-art sprites)
 * - 4-Direction Export (Single, Dual Right+Left, or Full 4-Way Front/Left/Right/Back!)
 */

import { solveForwardKinematics } from './skeleton.js';
import { renderCutoutCharacter } from './partCutter.js';
import { deformMesh, renderDeformedMesh2D } from './meshSkinning.js';
import { evaluateAnimation, ANIMATION_LIST } from './animations.js';

export function generateSpriteSheet({
  imageCanvas,
  partLayers,
  mesh,
  skeleton,
  renderMode = 'hybrid_mesh',
  animations,
  frameSize = 256,
  padding = 4,
  flipX = false,
  directionMode = 'single', // 'single' | 'dual' | 'four_way'
  pixelArt = false,
  intensity = 1.0,
  squash = 1.0,
  characterName = 'aetheria_hero',
  engineFormat = 'phaser',
}) {
  const expandedAnims = [];
  for (const a of animations) {
    if (directionMode === 'four_way') {
      expandedAnims.push({ ...a, exportId: `${a.id}_front`, rowFlipX: false, viewDir: 'front' });
      expandedAnims.push({ ...a, exportId: `${a.id}_right`, rowFlipX: false, viewDir: 'side_right' });
      expandedAnims.push({ ...a, exportId: `${a.id}_left`,  rowFlipX: false, viewDir: 'side_left' });
      expandedAnims.push({ ...a, exportId: `${a.id}_back`,  rowFlipX: false, viewDir: 'back' });
    } else if (directionMode === 'dual') {
      expandedAnims.push({ ...a, exportId: `${a.id}_right`, rowFlipX: false, viewDir: skeleton.viewDirection });
      expandedAnims.push({ ...a, exportId: `${a.id}_left`,  rowFlipX: true,  viewDir: skeleton.viewDirection });
    } else {
      expandedAnims.push({ ...a, exportId: a.id, rowFlipX: flipX, viewDir: skeleton.viewDirection });
    }
  }

  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = frameSize;
  frameCanvas.height = frameSize;
  const fctx = frameCanvas.getContext('2d');

  const srcW = imageCanvas.width;
  const srcH = imageCanvas.height;

  const fitScale = Math.min(
    (frameSize * 0.82) / srcW,
    (frameSize * 0.82) / srcH
  );
  const offsetX = (frameSize - srcW * fitScale) * 0.5;
  const offsetY = (frameSize - srcH * fitScale) * 0.52;

  const maxCols = Math.max(...expandedAnims.map((a) => a.frames));
  const totalRows = expandedAnims.length;
  const cellW = frameSize + padding;
  const cellH = frameSize + padding;
  const sheetW = maxCols * cellW + padding;
  const sheetH = totalRows * cellH + padding;

  const sheetCanvas = document.createElement('canvas');
  sheetCanvas.width = sheetW;
  sheetCanvas.height = sheetH;
  const sctx = sheetCanvas.getContext('2d');
  sctx.imageSmoothingEnabled = !pixelArt;

  const frameEntries = [];
  const animMap = {};

  for (let row = 0; row < expandedAnims.length; row++) {
    const anim = expandedAnims[row];
    const animFrameNames = [];
    const animDef = ANIMATION_LIST.find((a) => a.id === anim.id);
    const isLoop = animDef ? animDef.loop : true;

    const skForRow = { ...skeleton, viewDirection: anim.viewDir || skeleton.viewDirection };

    for (let f = 0; f < anim.frames; f++) {
      const t = isLoop
        ? f / anim.frames
        : anim.frames > 1
          ? f / (anim.frames - 1)
          : 0;

      const pose = evaluateAnimation(anim.id, t, skForRow, { intensity, squash });
      const { posedJoints, boneTransforms } = solveForwardKinematics(skForRow, pose);

      fctx.clearRect(0, 0, frameSize, frameSize);
      const view = {
        offsetX,
        offsetY,
        scale: fitScale,
        flipX: anim.rowFlipX,
        flash: pose.flash || 0,
      };

      if (renderMode === 'hybrid_mesh' && mesh) {
        deformMesh(mesh, boneTransforms);
        renderDeformedMesh2D(fctx, imageCanvas, mesh, view, pixelArt);
      } else {
        renderCutoutCharacter(fctx, frameSize, frameSize, {
          partLayers,
          skeleton: skForRow,
          posedJoints,
          pose,
          view,
          pixelArt,
          explodeAmount: 0,
        });
      }

      const dx = padding + f * cellW;
      const dy = padding + row * cellH;
      sctx.drawImage(frameCanvas, dx, dy);

      const frameName = `${characterName}_${anim.exportId}_${String(f).padStart(2, '0')}.png`;
      animFrameNames.push(frameName);
      frameEntries.push({
        name: frameName,
        animId: anim.exportId,
        frameIndex: f,
        row,
        col: f,
        x: dx,
        y: dy,
        w: frameSize,
        h: frameSize,
      });
    }

    animMap[anim.exportId] = {
      row,
      fps: anim.fps,
      loop: isLoop,
      frameCount: anim.frames,
      frames: animFrameNames,
    };
  }

  const imageFileName = `${characterName}_spritesheet.png`;
  const metadata = buildEngineMetadata({
    engineFormat,
    imageFileName,
    sheetW,
    sheetH,
    frameSize,
    padding,
    frameEntries,
    animMap,
    characterName,
  });

  const codeSnippet = generateEngineCodeSnippet({
    engineFormat,
    imageFileName,
    characterName,
    frameSize,
    padding,
    animMap,
  });

  return { sheetCanvas, metadata, imageFileName, codeSnippet };
}

function buildEngineMetadata({
  engineFormat,
  imageFileName,
  sheetW,
  sheetH,
  frameSize,
  padding,
  frameEntries,
  animMap,
  characterName,
}) {
  const defaultBoxes = {
    hurtbox: {
      x: Math.round(frameSize * 0.32),
      y: Math.round(frameSize * 0.22),
      w: Math.round(frameSize * 0.36),
      h: Math.round(frameSize * 0.64),
    },
    attackHitbox: {
      x: Math.round(frameSize * 0.52),
      y: Math.round(frameSize * 0.28),
      w: Math.round(frameSize * 0.38),
      h: Math.round(frameSize * 0.44),
    },
  };

  if (engineFormat === 'unity') {
    return {
      format: 'unity-sprite-slices-v1',
      texture: imageFileName,
      textureWidth: sheetW,
      textureHeight: sheetH,
      frameWidth: frameSize,
      frameHeight: frameSize,
      padding,
      combatBoxes: defaultBoxes,
      sprites: frameEntries.map((e) => ({
        name: e.name.replace('.png', ''),
        animation: e.animId,
        index: e.frameIndex,
        rect: { x: e.x, y: sheetH - e.y - e.h, width: e.w, height: e.h },
        pivot: { x: 0.5, y: 0.12 },
      })),
      animations: animMap,
    };
  }

  if (engineFormat === 'godot') {
    return {
      format: 'godot-atlas-v1',
      resource_name: characterName,
      texture: imageFileName,
      sheet_size: { w: sheetW, h: sheetH },
      cell_size: { w: frameSize, h: frameSize },
      padding,
      combat_boxes: defaultBoxes,
      animations: Object.fromEntries(
        Object.entries(animMap).map(([id, info]) => [
          id,
          {
            fps: info.fps,
            loop: info.loop,
            regions: frameEntries
              .filter((e) => e.animId === id)
              .map((e) => ({ x: e.x, y: e.y, w: e.w, h: e.h })),
          },
        ])
      ),
    };
  }

  const framesObj = {};
  for (const e of frameEntries) {
    framesObj[e.name] = {
      frame: { x: e.x, y: e.y, w: e.w, h: e.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: e.w, h: e.h },
      sourceSize: { w: e.w, h: e.h },
      pivot: { x: 0.5, y: 0.88 },
    };
  }

  return {
    frames: framesObj,
    animations: Object.fromEntries(
      Object.entries(animMap).map(([id, info]) => [id, info.frames])
    ),
    meta: {
      app: 'Auto Skeleton Offline Studio v4',
      version: '4.0-multidir-hybrid',
      image: imageFileName,
      format: 'RGBA8888',
      size: { w: sheetW, h: sheetH },
      scale: '1',
      frameSize: { w: frameSize, h: frameSize },
      padding,
      combatBoxes: defaultBoxes,
      animationConfig: animMap,
    },
  };
}

export function generateEngineCodeSnippet({
  engineFormat,
  imageFileName,
  characterName,
  frameSize,
  padding,
  animMap,
}) {
  const firstAnim = Object.keys(animMap)[0] || 'run';
  const cell = frameSize + padding;

  if (engineFormat === 'phaser') {
    return `// Aetheria Online / HTML5 Canvas & Phaser 3 Loader
this.load.atlas('${characterName}', 'assets/${imageFileName}', 'assets/${characterName}_spritesheet.json');

// Render Langsung di HTML5 Canvas 2D:
const sheet = new Image();
sheet.src = 'assets/${imageFileName}';
const ANIM_ROWS = ${JSON.stringify(
      Object.fromEntries(Object.entries(animMap).map(([k, v]) => [k, { row: v.row, frames: v.frameCount, fps: v.fps }]))
    )};
function drawSprite(ctx, animName, frameIdx, x, y, scale = 1) {
  const cfg = ANIM_ROWS[animName] || ANIM_ROWS['${firstAnim}'];
  const col = frameIdx % cfg.frames;
  const sx = ${padding} + col * ${cell};
  const sy = ${padding} + cfg.row * ${cell};
  ctx.drawImage(sheet, sx, sy, ${frameSize}, ${frameSize}, x, y, ${frameSize} * scale, ${frameSize} * scale);
}`;
  }

  if (engineFormat === 'godot') {
    return `# Godot 4 GDScript — Auto SpriteFrames Builder (Aetheria Online)
var tex = preload("res://assets/${imageFileName}")
var frames = SpriteFrames.new()

func setup_animations(anim_sprite: AnimatedSprite2D):
\tvar data = ${JSON.stringify(
      Object.fromEntries(Object.entries(animMap).map(([k, v]) => [k, { row: v.row, count: v.frameCount, fps: v.fps }]))
    )}
\tfor anim_name in data.keys():
\t\tvar info = data[anim_name]
\t\tframes.add_animation(anim_name)
\t\tframes.set_animation_speed(anim_name, info.fps)
\t\tfor i in range(info.count):
\t\t\tvar atlas = AtlasTexture.new()
\t\t\tatlas.atlas = tex
\t\t\tatlas.region = Rect2(${padding} + i * ${cell}, ${padding} + info.row * ${cell}, ${frameSize}, ${frameSize})
\t\t\tframes.add_frame(anim_name, atlas)
\tanim_sprite.sprite_frames = frames
\tanim_sprite.play("${firstAnim}")`;
  }

  return `// Unity C# — Runtime Sprite Sheet Slicer (${imageFileName})
public Texture2D spriteSheet;
public Sprite GetFrame(int row, int col) {
    int x = ${padding} + col * ${cell};
    int y = spriteSheet.height - (${padding} + (row + 1) * ${cell} - ${padding});
    return Sprite.Create(spriteSheet, new Rect(x, y, ${frameSize}, ${frameSize}), new Vector2(0.5f, 0.12f), 100f);
}`;
}

export function downloadCanvasPNG(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportAnimationWebM({
  imageCanvas,
  partLayers,
  mesh,
  skeleton,
  renderMode = 'hybrid_mesh',
  animId,
  frameSize = 320,
  fps = 30,
  cycles = 2,
  speed = 1.0,
  flipX = false,
  pixelArt = false,
  intensity = 1.0,
  squash = 1.0,
  filename = 'hero_anim.webm',
}) {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Browser tidak mendukung MediaRecorder WebM.');
  }

  const recCanvas = document.createElement('canvas');
  recCanvas.width = frameSize;
  recCanvas.height = frameSize;
  const ctx = recCanvas.getContext('2d');

  const srcW = imageCanvas.width;
  const srcH = imageCanvas.height;
  const fitScale = Math.min((frameSize * 0.82) / srcW, (frameSize * 0.82) / srcH);
  const offsetX = (frameSize - srcW * fitScale) * 0.5;
  const offsetY = (frameSize - srcH * fitScale) * 0.52;

  const stream = recCanvas.captureStream(fps);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const animDef = ANIMATION_LIST.find((a) => a.id === animId) || ANIMATION_LIST[0];
  const cycleDurationSec = Math.max(0.35, (animDef.defaultFrames / animDef.defaultFps) / speed);
  const totalFrames = Math.max(12, Math.round(cycleDurationSec * cycles * fps));

  return new Promise((resolve, reject) => {
    recorder.onerror = reject;
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      resolve();
    };

    recorder.start();
    let frame = 0;
    const stepMs = 1000 / fps;

    const renderNext = () => {
      if (frame >= totalFrames) {
        recorder.stop();
        return;
      }
      const t = ((frame / totalFrames) * cycles) % 1;
      const pose = evaluateAnimation(animId, t, skeleton, { intensity, squash });
      const { posedJoints, boneTransforms } = solveForwardKinematics(skeleton, pose);

      ctx.clearRect(0, 0, frameSize, frameSize);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, frameSize, frameSize);

      const view = {
        offsetX,
        offsetY,
        scale: fitScale,
        flipX,
        flash: pose.flash || 0,
      };

      if (renderMode === 'hybrid_mesh' && mesh) {
        deformMesh(mesh, boneTransforms);
        renderDeformedMesh2D(ctx, imageCanvas, mesh, view, pixelArt);
      } else {
        renderCutoutCharacter(ctx, frameSize, frameSize, {
          partLayers,
          skeleton,
          posedJoints,
          pose,
          view,
          pixelArt,
          explodeAmount: 0,
        });
      }

      frame++;
      setTimeout(renderNext, stepMs);
    };

    renderNext();
  });
}
