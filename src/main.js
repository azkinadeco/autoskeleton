/**
 * Auto Skeleton v4 — Multi-Direction Aetheria & AutoSprite Studio Controller
 * - 4 View Directions: Tampak Depan ('front'), Samping Kanan ('side_right'), Samping Kiri ('side_left'), Tampak Belakang ('back')
 * - 2 Rigging Modes:
 *   1. 'hybrid_mesh': Part-Guided Smooth Pivot Mesh (100% rigid face, zero cut seams on Front/Back/Aetheria sprites)
 *   2. 'cutout_layers': 10-Layer Cutout Renderer (wide 45 deg scissoring legs on Side/3-4 pixel-art sprites)
 * - Built-in Aetheria Online Hero Presets (Sven, Kali Samurai, Ymir Queen, Knight 3/4 Contoh)
 */

import {
  imageToCanvas,
  hasTransparency,
  removeBackground,
  normalizeCharacterCanvas,
  createDemoCharacterCanvas,
} from './utils/imageProcessing.js';
import { DEFAULT_KNIGHT_WEBP } from './utils/defaultKnightData.js';
import {
  AETHERIA_SVEN_DATA,
  AETHERIA_KALI_DATA,
  AETHERIA_YMIR_DATA,
} from './utils/aetheriaPresets.js';
import {
  RIG_TEMPLATES,
  autoDetectSkeleton,
  solveForwardKinematics,
} from './engine/skeleton.js';
import {
  PART_DEFINITIONS,
  PART_BY_ID,
  autoSegmentParts,
  buildPartLayers,
  renderCutoutCharacter,
} from './engine/partCutter.js';
import {
  buildCharacterMesh,
  computeSkinWeights,
  deformMesh,
  renderDeformedMesh2D,
} from './engine/meshSkinning.js';
import { drawOverlay } from './engine/renderer.js';
import {
  ANIMATION_LIST,
  evaluateAnimation,
} from './engine/animations.js';
import {
  generateSpriteSheet,
  downloadCanvasPNG,
  downloadJSON,
  exportAnimationWebM,
} from './engine/exporter.js';
import { PlaytestArena } from './ui/playtest.js';
import { initCloud } from './ui/cloud.js';
import { initVideoToSheet } from './ui/videoToSheet.js';

const state = {
  mode: 'animate', // 'animate' | 'rig' | 'multigrid' | 'playtest'
  rigTool: 'pivot', // 'pivot' | 'brush'
  viewDirection: 'front', // 'front' | 'side_right' | 'side_left' | 'back'
  renderMode: 'hybrid_mesh', // 'hybrid_mesh' | 'cutout_layers'
  templateId: 'front_aetheria',

  rawCanvas: null,
  processedCanvas: null,
  skeleton: null,
  partMap: null,
  partLayers: null,
  mesh: null,
  lockCutMask: false,
  undoStack: [],

  explodeAmount: 0,
  explodeTarget: null,

  selectedPartId: 'forearm_weapon_r',
  brushRadius: 10,
  showPartMask: false,

  removeBg: true,
  bgTolerance: 30,
  pixelArt: false,
  mirrorRig: false,
  showSkeleton: true,
  showHitboxes: false,
  flipX: false,
  showRefBox: true,

  activeAnim: 'run',
  playing: true,
  phase: 0,
  speed: 1.0,
  intensity: 1.0,
  squash: 1.0,
  zoom: 1.15,

  selectedJointId: 'hip',
  hoveredJointId: null,
  draggingJointId: null,
  paintingPart: false,

  multiGridCards: [],
  lastExport: null,
};

const el = {
  charCanvas: document.getElementById('glCanvas'),
  overlayCanvas: document.getElementById('overlayCanvas'),
  playBgCanvas: document.getElementById('playBgCanvas'),
  multiGridView: document.getElementById('multiGridView'),
  videoSheetView: document.getElementById('videoSheetView'),
  viewportStage: document.getElementById('viewportStage'),
  viewportHint: document.getElementById('viewportHint'),
  backdropSwitcher: document.getElementById('backdropSwitcher'),
  playtestControls: document.getElementById('playtestControls'),
  timelineBar: document.getElementById('timelineBar'),
  refCompareCard: document.getElementById('refCompareCard'),
  btnToggleRef: document.getElementById('btnToggleRef'),

  tabBtns: document.querySelectorAll('.tab-btn'),
  fileInput: document.getElementById('fileInput'),
  dropzone: document.getElementById('dropzone'),
  selPresetChar: document.getElementById('selPresetChar'),

  // 4-Direction & Structure Controls
  dirBtns: document.querySelectorAll('.dir-btn'),
  selRenderMode: document.getElementById('selRenderMode'),
  selTemplate: document.getElementById('selTemplate'),
  btnSmartAutoPivot: document.getElementById('btnSmartAutoPivot'),
  lblSelectedPivot: document.getElementById('lblSelectedPivot'),
  btnNudgeLeft: document.getElementById('btnNudgeLeft'),
  btnNudgeRight: document.getElementById('btnNudgeRight'),
  btnNudgeUp: document.getElementById('btnNudgeUp'),
  btnNudgeDown: document.getElementById('btnNudgeDown'),
  rngCustomAngle: document.getElementById('rngCustomAngle'),
  valCustomAngle: document.getElementById('valCustomAngle'),
  chkLockCutMask: document.getElementById('chkLockCutMask'),
  chkMirror: document.getElementById('chkMirror'),
  btnUndoRig: document.getElementById('btnUndoRig'),
  btnSaveRig: document.getElementById('btnSaveRig'),
  rigFileInput: document.getElementById('rigFileInput'),

  // Explode & Cutout controls
  btnToggleExplode: document.getElementById('btnToggleExplode'),
  rngExplode: document.getElementById('rngExplode'),
  valExplode: document.getElementById('valExplode'),
  partList: document.getElementById('partList'),
  btnToolPivot: document.getElementById('btnToolPivot'),
  btnToolBrush: document.getElementById('btnToolBrush'),
  brushControls: document.getElementById('brushControls'),
  rngBrushSize: document.getElementById('rngBrushSize'),
  valBrushSize: document.getElementById('valBrushSize'),
  chkShowPartMask: document.getElementById('chkShowPartMask'),

  chkRemoveBg: document.getElementById('chkRemoveBg'),
  rngBgTol: document.getElementById('rngBgTol'),
  valBgTol: document.getElementById('valBgTol'),
  bgToleranceGroup: document.getElementById('bgToleranceGroup'),
  chkPixelArt: document.getElementById('chkPixelArt'),
  chkShowSkeleton: document.getElementById('chkShowSkeleton'),
  chkShowHitboxes: document.getElementById('chkShowHitboxes'),
  chkFlipX: document.getElementById('chkFlipX'),

  animGrid: document.getElementById('animGrid'),
  btnPlayPause: document.getElementById('btnPlayPause'),
  rngTimeline: document.getElementById('rngTimeline'),
  lblFrameInfo: document.getElementById('lblFrameInfo'),

  rngSpeed: document.getElementById('rngSpeed'),
  valSpeed: document.getElementById('valSpeed'),
  rngIntensity: document.getElementById('rngIntensity'),
  valIntensity: document.getElementById('valIntensity'),
  rngSquash: document.getElementById('rngSquash'),
  valSquash: document.getElementById('valSquash'),
  rngZoom: document.getElementById('rngZoom'),
  valZoom: document.getElementById('valZoom'),

  // Export modal
  btnOpenExport: document.getElementById('btnOpenExport'),
  btnCloseExport: document.getElementById('btnCloseExport'),
  exportModal: document.getElementById('exportModal'),
  inpCharName: document.getElementById('inpCharName'),
  selDirectionMode: document.getElementById('selDirectionMode'),
  selExportScope: document.getElementById('selExportScope'),
  selFrameSize: document.getElementById('selFrameSize'),
  selFrameCount: document.getElementById('selFrameCount'),
  selEngineFormat: document.getElementById('selEngineFormat'),
  btnDownloadWebm: document.getElementById('btnDownloadWebm'),
  btnDownloadJson: document.getElementById('btnDownloadJson'),
  btnDownloadPng: document.getElementById('btnDownloadPng'),
  exportPreviewCanvas: document.getElementById('exportPreviewCanvas'),
  lblSheetDims: document.getElementById('lblSheetDims'),
  preCodeSnippet: document.getElementById('preCodeSnippet'),
  btnCopyCode: document.getElementById('btnCopyCode'),
};

const charCtx = el.charCanvas.getContext('2d');
const overlayCtx = el.overlayCanvas.getContext('2d');
const playtest = new PlaytestArena(el.playBgCanvas);

function getViewTransform() {
  const w = el.charCanvas.width;
  const h = el.charCanvas.height;
  const cw = state.processedCanvas?.width || 384;
  const ch = state.processedCanvas?.height || 384;
  const baseScale = Math.min((w * 0.68) / cw, (h * 0.76) / ch);
  const scale = baseScale * state.zoom;
  return {
    offsetX: (w - cw * scale) * 0.5,
    offsetY: (h - ch * scale) * 0.52,
    scale,
    flipX: state.flipX,
  };
}

function screenToCharacter(clientX, clientY) {
  const rect = el.overlayCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const sx = (clientX - rect.left) * dpr;
  const sy = (clientY - rect.top) * dpr;
  const view = getViewTransform();
  const cw = state.processedCanvas?.width || 384;
  let mx = (sx - view.offsetX) / view.scale;
  const my = (sy - view.offsetY) / view.scale;
  if (view.flipX) mx = cw - mx;
  return { x: mx, y: my, sx, sy };
}

function pushUndo() {
  if (!state.skeleton || !state.partMap) return;
  state.undoStack.push({
    joints: JSON.parse(JSON.stringify(state.skeleton.joints)),
    partMap: new Uint8Array(state.partMap),
  });
  if (state.undoStack.length > 25) state.undoStack.shift();
}

function popUndo() {
  if (!state.skeleton || state.undoStack.length === 0) return;
  const prev = state.undoStack.pop();
  state.skeleton.joints = prev.joints;
  state.partMap = prev.partMap;
  rebuildMeshAndLayersFromCurrentRig();
}

window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    popUndo();
  }
});
el.btnUndoRig?.addEventListener('click', popUndo);

function updateDirectionButtonsUI() {
  el.dirBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.dir === state.viewDirection);
  });
}

function updatePivotInspectorUI() {
  if (!state.skeleton || !el.lblSelectedPivot) return;
  const jt = state.skeleton.joints.find((j) => j.id === state.selectedJointId) || state.skeleton.joints[0];
  if (!jt) return;
  el.lblSelectedPivot.textContent = jt.label;
  const deg = Math.round(((jt.customAngle || 0) * 180) / Math.PI);
  if (el.rngCustomAngle) el.rngCustomAngle.value = String(deg);
  if (el.valCustomAngle) el.valCustomAngle.textContent = `${deg}°`;
}

function loadRawCanvas(rawCanvas, {
  suggestedName = 'aetheria_hero',
  preserveExactFrame = false,
  templateId = 'auto_smart',
  viewDirection = 'front',
  renderMode = 'hybrid_mesh',
  pixelArt = false,
} = {}) {
  state.rawCanvas = rawCanvas;
  state.undoStack = [];
  state.templateId = templateId;
  state.viewDirection = viewDirection;
  state.renderMode = renderMode;
  state.pixelArt = pixelArt;

  if (el.selTemplate) el.selTemplate.value = templateId;
  if (el.selRenderMode) el.selRenderMode.value = renderMode;
  if (el.chkPixelArt) el.chkPixelArt.checked = pixelArt;
  updateDirectionButtonsUI();

  el.inpCharName.value = suggestedName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() || 'aetheria_hero';

  const alreadyTransparent = hasTransparency(rawCanvas);
  state.removeBg = !alreadyTransparent;
  el.chkRemoveBg.checked = state.removeBg;
  el.bgToleranceGroup.style.opacity = state.removeBg ? '1' : '0.45';

  rebuildCharacterPipeline(true, preserveExactFrame);
}

function rebuildCharacterPipeline(redetectRig = true, preserveExactFrame = false) {
  if (!state.rawCanvas) return;

  let working = state.rawCanvas;
  if (state.removeBg) {
    working = removeBackground(working, {
      tolerance: state.bgTolerance,
      feather: 1,
      removeInteriorPockets: true,
    });
  }
  state.processedCanvas = preserveExactFrame
    ? working
    : normalizeCharacterCanvas(working, 0.16);

  if (redetectRig || !state.skeleton) {
    state.skeleton = autoDetectSkeleton(state.processedCanvas, state.templateId, state.viewDirection);
  }
  state.skeleton.viewDirection = state.viewDirection;

  state.partMap = autoSegmentParts(state.processedCanvas, state.skeleton);
  rebuildMeshAndLayersFromCurrentRig();
}

function rebuildMeshAndLayersFromCurrentRig() {
  if (!state.processedCanvas || !state.skeleton || !state.partMap) return;

  state.partLayers = buildPartLayers(state.processedCanvas, state.partMap, state.skeleton);
  state.mesh = buildCharacterMesh(state.processedCanvas, 34);
  computeSkinWeights(state.mesh, state.processedCanvas, state.skeleton, 3.2, state.partMap);

  updatePivotInspectorUI();
  buildPartListUI();
  syncPlaytestCharacter();
}

function applyPivotChangeAndRebuild() {
  if (!state.processedCanvas || !state.skeleton) return;
  if (!state.lockCutMask) {
    state.partMap = autoSegmentParts(state.processedCanvas, state.skeleton);
  }
  rebuildMeshAndLayersFromCurrentRig();
}

function syncPlaytestCharacter() {
  if (!state.processedCanvas || !state.skeleton) return;
  playtest.setCharacter(state.processedCanvas, state.partLayers, state.mesh, state.skeleton, {
    renderMode: state.renderMode,
    pixelArt: state.pixelArt,
    intensity: state.intensity,
    squash: state.squash,
  });
}

// ---- Built-in Aetheria Online & Contoh Presets ----
function loadPresetCharacter(presetKey) {
  if (presetKey === 'sven') {
    const img = new Image();
    img.onload = () => {
      loadRawCanvas(imageToCanvas(img, 420), {
        suggestedName: 'aetheria_sven',
        preserveExactFrame: false,
        templateId: 'front_aetheria',
        viewDirection: 'front',
        renderMode: 'hybrid_mesh',
        pixelArt: false,
      });
    };
    img.src = AETHERIA_SVEN_DATA;
  } else if (presetKey === 'kali') {
    const img = new Image();
    img.onload = () => {
      loadRawCanvas(imageToCanvas(img, 420), {
        suggestedName: 'aetheria_kali',
        preserveExactFrame: false,
        templateId: 'front_aetheria',
        viewDirection: 'front',
        renderMode: 'hybrid_mesh',
        pixelArt: false,
      });
    };
    img.src = AETHERIA_KALI_DATA;
  } else if (presetKey === 'ymir') {
    const img = new Image();
    img.onload = () => {
      loadRawCanvas(imageToCanvas(img, 420), {
        suggestedName: 'aetheria_ymir',
        preserveExactFrame: false,
        templateId: 'creature_simple',
        viewDirection: 'front',
        renderMode: 'hybrid_mesh',
        pixelArt: false,
      });
    };
    img.src = AETHERIA_YMIR_DATA;
  } else if (presetKey === 'knight') {
    const img = new Image();
    img.onload = () => {
      loadRawCanvas(imageToCanvas(img, 512), {
        suggestedName: 'ch1_knight',
        preserveExactFrame: true,
        templateId: 'knight_34',
        viewDirection: 'side_right',
        renderMode: 'cutout_layers',
        pixelArt: true,
      });
    };
    img.src = DEFAULT_KNIGHT_WEBP;
  } else {
    loadRawCanvas(createDemoCharacterCanvas(), {
      suggestedName: 'aetheria_demo',
      preserveExactFrame: false,
      templateId: 'humanoid_front',
      viewDirection: 'front',
      renderMode: 'hybrid_mesh',
      pixelArt: false,
    });
  }
}

el.selPresetChar?.addEventListener('change', () => {
  loadPresetCharacter(el.selPresetChar.value);
});

// ---- 4-Direction Buttons & Render Mode Selector ----
el.dirBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const newDir = btn.dataset.dir;
    state.viewDirection = newDir;
    updateDirectionButtonsUI();

    if (state.skeleton) {
      state.skeleton.viewDirection = newDir;
      // Match appropriate default template and renderMode when switching direction
      const tplView = RIG_TEMPLATES[state.templateId]?.defaultView;
      if (tplView && tplView !== newDir) {
        state.templateId = 'auto_smart';
        if (el.selTemplate) el.selTemplate.value = state.templateId;
      }
      if (newDir === 'front' || newDir === 'back') state.renderMode = 'hybrid_mesh';
      if (el.selRenderMode) el.selRenderMode.value = state.renderMode;
      pushUndo();
      state.skeleton = autoDetectSkeleton(state.processedCanvas, state.templateId, newDir);
      state.skeleton.viewDirection = newDir;
      state.partMap = autoSegmentParts(state.processedCanvas, state.skeleton);
      rebuildMeshAndLayersFromCurrentRig();
    }
  });
});

el.selRenderMode?.addEventListener('change', () => {
  state.renderMode = el.selRenderMode.value;
  syncPlaytestCharacter();
});

// ---- Part List & Explode Controls ----
function buildPartListUI() {
  if (!el.partList) return;
  el.partList.innerHTML = '';

  const sorted = PART_DEFINITIONS.slice().sort((a, b) => b.zIndex - a.zIndex);
  for (const def of sorted) {
    const layer = state.partLayers?.[def.id];
    const row = document.createElement('div');
    row.className = 'part-item' + (state.selectedPartId === def.id ? ' active' : '');
    row.innerHTML = `
      <span class="part-dot" style="background:${def.color}"></span>
      <span class="part-name">${def.label}</span>
      <span class="part-pivot-tag">${def.pivotJoint}</span>
      <button class="part-eye" title="Tampilkan/Sembunyikan Bagian">${layer?.hidden ? '🚫' : '👁️'}</button>
    `;
    row.addEventListener('click', (e) => {
      if (e.target.classList.contains('part-eye')) return;
      state.selectedPartId = def.id;
      state.selectedJointId = def.pivotJoint;
      updatePivotInspectorUI();
      buildPartListUI();
    });
    row.querySelector('.part-eye').addEventListener('click', (e) => {
      e.stopPropagation();
      if (layer) {
        layer.hidden = !layer.hidden;
        buildPartListUI();
      }
    });
    el.partList.appendChild(row);
  }
}

function setExplodeAmount(val) {
  state.explodeAmount = Math.max(0, Math.min(1, val));
  el.rngExplode.value = String(Math.round(state.explodeAmount * 100));
  el.valExplode.textContent = `${Math.round(state.explodeAmount * 100)}%`;
  el.btnToggleExplode.textContent =
    state.explodeAmount > 0.15
      ? '🧲 Satukan kembali'
      : '✂️ Pisahkan bagian';
}

el.rngExplode.addEventListener('input', () => {
  state.explodeTarget = null;
  setExplodeAmount(Number(el.rngExplode.value) / 100);
});

el.btnToggleExplode.addEventListener('click', () => {
  state.explodeTarget = state.explodeAmount > 0.15 ? 0 : 0.78;
});

function setRigTool(tool) {
  state.rigTool = tool;
  el.btnToolPivot?.classList.toggle('active', tool === 'pivot');
  el.btnToolBrush?.classList.toggle('active', tool === 'brush');
  el.brushControls?.classList.toggle('hidden', tool !== 'brush');
  state.showPartMask = tool === 'brush';
  if (el.chkShowPartMask) el.chkShowPartMask.checked = state.showPartMask;
}

el.btnToolPivot?.addEventListener('click', () => setRigTool('pivot'));
el.btnToolBrush?.addEventListener('click', () => {
  setMode('rig');
  setRigTool('brush');
});

el.rngBrushSize?.addEventListener('input', () => {
  state.brushRadius = Number(el.rngBrushSize.value);
  el.valBrushSize.textContent = `${state.brushRadius}px`;
});

el.chkShowPartMask?.addEventListener('change', () => {
  state.showPartMask = el.chkShowPartMask.checked;
});

// ---- Pivot Inspector Fine Nudge & Custom Angle ----
function nudgeSelectedPivot(dx, dy) {
  if (!state.skeleton || !state.selectedJointId) return;
  const jt = state.skeleton.joints.find((j) => j.id === state.selectedJointId);
  if (!jt) return;
  pushUndo();
  const cw = state.processedCanvas?.width || 384;
  const ch = state.processedCanvas?.height || 384;
  jt.x = Math.max(0, Math.min(cw, jt.x + dx));
  jt.y = Math.max(0, Math.min(ch, jt.y + dy));
  applyPivotChangeAndRebuild();
}

el.btnNudgeLeft?.addEventListener('click', () => nudgeSelectedPivot(-2, 0));
el.btnNudgeRight?.addEventListener('click', () => nudgeSelectedPivot(2, 0));
el.btnNudgeUp?.addEventListener('click', () => nudgeSelectedPivot(0, -2));
el.btnNudgeDown?.addEventListener('click', () => nudgeSelectedPivot(0, 2));

el.rngCustomAngle?.addEventListener('input', () => {
  if (!state.skeleton || !state.selectedJointId) return;
  const jt = state.skeleton.joints.find((j) => j.id === state.selectedJointId);
  if (!jt) return;
  const deg = Number(el.rngCustomAngle.value);
  el.valCustomAngle.textContent = `${deg}°`;
  jt.customAngle = (deg * Math.PI) / 180;
});

el.chkLockCutMask?.addEventListener('change', () => {
  state.lockCutMask = el.chkLockCutMask.checked;
});

// ---- File Upload Handling ----
function handleImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = imageToCanvas(img, 540);
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      loadRawCanvas(canvas, {
        suggestedName: baseName,
        preserveExactFrame: false,
        templateId: 'auto_smart',
        viewDirection: state.viewDirection,
        renderMode: 'hybrid_mesh',
        pixelArt: false,
      });
      state.showSkeleton = true;
      el.chkShowSkeleton.checked = true;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

el.fileInput.addEventListener('change', (e) => {
  if (e.target.files?.[0]) {
    handleImageFile(e.target.files[0]);
    e.target.value = '';
  }
});

el.dropzone.addEventListener('click', () => el.fileInput.click());
el.dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  el.dropzone.classList.add('dragover');
});
el.dropzone.addEventListener('dragleave', () => el.dropzone.classList.remove('dragover'));
el.dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  el.dropzone.classList.remove('dragover');
  if (e.dataTransfer.files?.[0]) handleImageFile(e.dataTransfer.files[0]);
});

el.viewportStage.addEventListener('dragover', (e) => e.preventDefault());
el.viewportStage.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer.files?.[0]) handleImageFile(e.dataTransfer.files[0]);
});

el.btnSmartAutoPivot?.addEventListener('click', () => {
  if (!state.processedCanvas) return;
  pushUndo();
  state.templateId = el.selTemplate.value;
  state.skeleton = autoDetectSkeleton(state.processedCanvas, state.templateId, state.viewDirection);
  state.partMap = autoSegmentParts(state.processedCanvas, state.skeleton);
  rebuildMeshAndLayersFromCurrentRig();
});

el.btnToggleRef?.addEventListener('click', () => {
  state.showRefBox = !state.showRefBox;
  el.refCompareCard?.classList.toggle('collapsed', !state.showRefBox);
  el.btnToggleRef.textContent = state.showRefBox ? '−' : '+';
});

el.backdropSwitcher.querySelectorAll('.bg-swatch').forEach((btn) => {
  btn.addEventListener('click', () => {
    el.viewportStage.classList.remove('bg-checker', 'bg-dark', 'bg-grass', 'bg-light');
    el.viewportStage.classList.add(btn.dataset.bg);
    el.backdropSwitcher.querySelectorAll('.bg-swatch').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ---- AutoSprite Multi-Animation Grid Builder ----
function buildMultiGridCards() {
  if (!el.multiGridView) return;
  el.multiGridView.innerHTML = '';
  state.multiGridCards = [];

  const showcaseAnims = ['run', 'idle', 'walk', 'attack', 'jump', 'cast', 'dash', 'block', 'gather', 'hurt', 'death', 'victory'];
  for (const animId of showcaseAnims) {
    const def = ANIMATION_LIST.find((a) => a.id === animId);
    if (!def) continue;

    const card = document.createElement('div');
    card.className = 'multi-card' + (state.activeAnim === animId ? ' active' : '');
    card.innerHTML = `
      <div class="multi-card-header">
        <span>${def.icon} ${def.name}</span>
        <span class="badge">${def.defaultFrames}f</span>
      </div>
      <canvas width="160" height="160"></canvas>
      <div class="btn-row" style="width:100%">
        <button class="btn btn-secondary btn-sm btn-pick">Pilih</button>
        <button class="btn btn-primary btn-sm btn-dl-strip">⬇️ PNG</button>
      </div>
    `;

    const canvas = card.querySelector('canvas');
    const ctx = canvas.getContext('2d');

    card.querySelector('.btn-pick').addEventListener('click', (e) => {
      e.stopPropagation();
      state.activeAnim = animId;
      buildAnimationButtons();
      setMode('animate');
    });

    card.querySelector('.btn-dl-strip').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!state.processedCanvas || !state.skeleton) return;
      const charName = el.inpCharName.value.trim() || 'hero';
      const res = generateSpriteSheet({
        imageCanvas: state.processedCanvas,
        partLayers: state.partLayers,
        mesh: state.mesh,
        skeleton: state.skeleton,
        renderMode: state.renderMode,
        animations: [{ id: animId, frames: def.defaultFrames, fps: def.defaultFps }],
        frameSize: Number(el.selFrameSize.value) || 256,
        padding: 4,
        flipX: state.flipX,
        pixelArt: state.pixelArt,
        intensity: state.intensity,
        squash: state.squash,
        characterName: `${charName}_${animId}`,
        engineFormat: 'phaser',
      });
      downloadCanvasPNG(res.sheetCanvas, `${charName}_${animId}_strip.png`);
    });

    card.addEventListener('click', () => {
      state.activeAnim = animId;
      buildAnimationButtons();
      setMode('animate');
    });

    el.multiGridView.appendChild(card);
    state.multiGridCards.push({ animId, def, canvas, ctx });
  }
}

// ---- Mode Switching ----
function setMode(newMode) {
  state.mode = newMode;
  el.tabBtns.forEach((b) => b.classList.toggle('active', b.dataset.mode === newMode));

  const isPlaytest = newMode === 'playtest';
  const isMultiGrid = newMode === 'multigrid';
  const isVideoSheet = newMode === 'videosheet';
  playtest.active = isPlaytest;
  videoToSheet?.setActive(isVideoSheet);

  el.charCanvas.classList.toggle('hidden', isPlaytest || isMultiGrid || isVideoSheet);
  el.overlayCanvas.classList.toggle('hidden', isPlaytest || isMultiGrid || isVideoSheet);
  el.playBgCanvas.classList.toggle('hidden', !isPlaytest);
  el.multiGridView?.classList.toggle('hidden', !isMultiGrid);
  el.videoSheetView?.classList.toggle('hidden', !isVideoSheet);
  el.playtestControls.classList.toggle('hidden', !isPlaytest);
  el.timelineBar.classList.toggle('hidden', isPlaytest || isMultiGrid || isVideoSheet);

  if (isVideoSheet) {
    el.viewportHint.textContent = 'Drop video MP4/WebM (Wan / LTX / Kling / ComfyUI) → PNG Sprite Sheet + JSON otomatis';
  } else if (isMultiGrid) {
    buildMultiGridCards();
    el.viewportHint.textContent = 'Klik kartu untuk memilih • ⬇ PNG untuk unduh strip';
  } else if (newMode === 'rig') {
    el.viewportHint.textContent = 'Tarik pin bulat • atau pakai Kuas untuk edit potongan';
    state.showSkeleton = true;
    el.chkShowSkeleton.checked = true;
  } else if (newMode === 'animate') {
    el.viewportHint.textContent = 'Tarik pin bulat untuk atur pivot';
  } else {
    el.viewportHint.textContent = 'WASD/Panah • Space lompat • J K L B aksi';
    syncPlaytestCharacter();
    handleResize();
  }
}

el.tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
});

el.playtestControls.querySelectorAll('[data-play-action]').forEach((btn) => {
  btn.addEventListener('click', () => playtest.triggerAction(btn.dataset.playAction));
});

// ---- Direct Pivot Dragging ----
function getActiveJointMapForHitTest() {
  if (!state.skeleton) return {};
  if (state.mode === 'rig' || state.draggingJointId) {
    return Object.fromEntries(state.skeleton.joints.map((j) => [j.id, j]));
  }
  const pose = evaluateAnimation(state.activeAnim, state.phase, state.skeleton, {
    intensity: state.intensity,
    squash: state.squash,
  });
  const { posedJoints } = solveForwardKinematics(state.skeleton, pose);
  return posedJoints;
}

function findNearestJoint(mx, my, maxDist = 26) {
  if (!state.skeleton) return null;
  const activeMap = getActiveJointMapForHitTest();
  const bh = state.skeleton.bounds?.height || 200;

  let best = null;
  let bestDist = maxDist;

  for (const jt of state.skeleton.joints) {
    const pos = activeMap[jt.id] || jt;
    const d = Math.hypot(pos.x - mx, pos.y - my);
    if (d < bestDist) {
      bestDist = d;
      best = jt;
    }
  }

  if (state.explodeAmount > 0.03) {
    for (const part of PART_DEFINITIONS) {
      const jt = state.skeleton.joints.find((j) => j.id === part.pivotJoint);
      const pos = activeMap[part.pivotJoint] || jt;
      if (!jt || !pos) continue;
      const expX = pos.x + state.explodeAmount * part.explodeVec.dx * bh;
      const expY = pos.y + state.explodeAmount * part.explodeVec.dy * bh;
      const d = Math.hypot(expX - mx, expY - my);
      if (d < bestDist) {
        bestDist = d;
        best = jt;
      }
    }
  }

  return best;
}

function canInteractWithPivots() {
  return (state.mode === 'animate' || state.mode === 'rig') && state.showSkeleton && state.skeleton;
}

function paintPartAt(mx, my) {
  if (!state.partMap || !state.processedCanvas) return;
  const def = PART_BY_ID[state.selectedPartId];
  if (!def) return;

  const w = state.processedCanvas.width;
  const h = state.processedCanvas.height;
  const ctx = state.processedCanvas.getContext('2d', { willReadFrequently: true });
  const srcData = ctx.getImageData(0, 0, w, h).data;

  const r = state.brushRadius;
  const rSq = r * r;
  const cx = Math.round(mx);
  const cy = Math.round(my);

  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= h) continue;
    for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx;
      if (x < 0 || x >= w) continue;
      if (dx * dx + dy * dy > rSq) continue;
      const pos = y * w + x;
      if (srcData[pos * 4 + 3] > 20) {
        state.partMap[pos] = def.index;
      }
    }
  }
}

el.overlayCanvas.addEventListener('pointerdown', (e) => {
  if (!state.skeleton) return;
  const pt = screenToCharacter(e.clientX, e.clientY);
  const view = getViewTransform();

  if (state.mode === 'rig' && state.rigTool === 'brush') {
    pushUndo();
    state.paintingPart = true;
    el.overlayCanvas.setPointerCapture(e.pointerId);
    paintPartAt(pt.x, pt.y);
    rebuildMeshAndLayersFromCurrentRig();
    return;
  }

  if (!canInteractWithPivots()) return;

  const jt = findNearestJoint(pt.x, pt.y, 28 / view.scale);
  if (jt) {
    pushUndo();
    state.draggingJointId = jt.id;
    state.selectedJointId = jt.id;
    updatePivotInspectorUI();
    el.overlayCanvas.setPointerCapture(e.pointerId);
    el.overlayCanvas.style.cursor = 'grabbing';
  }
});

el.overlayCanvas.addEventListener('pointermove', (e) => {
  if (!state.skeleton) {
    el.overlayCanvas.style.cursor = 'default';
    return;
  }
  const pt = screenToCharacter(e.clientX, e.clientY);
  const view = getViewTransform();

  if (state.paintingPart) {
    paintPartAt(pt.x, pt.y);
    return;
  }

  if (state.mode === 'rig' && state.rigTool === 'brush') {
    el.overlayCanvas.style.cursor = 'crosshair';
    return;
  }

  if (!canInteractWithPivots()) {
    el.overlayCanvas.style.cursor = 'default';
    return;
  }

  const cw = state.processedCanvas?.width || 384;
  const ch = state.processedCanvas?.height || 384;

  if (state.draggingJointId) {
    el.overlayCanvas.style.cursor = 'grabbing';
    const jt = state.skeleton.joints.find((j) => j.id === state.draggingJointId);
    if (jt) {
      jt.x = Math.max(0, Math.min(cw, pt.x));
      jt.y = Math.max(0, Math.min(ch, pt.y));

      if (state.mirrorRig && jt.mirror) {
        const partner = state.skeleton.joints.find((j) => j.id === jt.mirror);
        if (partner) {
          const cx = state.skeleton.centerX;
          partner.x = Math.max(0, Math.min(cw, cx + (cx - jt.x)));
          partner.y = jt.y;
        }
      }
    }
  } else {
    const hovered = findNearestJoint(pt.x, pt.y, 28 / view.scale);
    state.hoveredJointId = hovered ? hovered.id : null;
    el.overlayCanvas.style.cursor = hovered ? 'grab' : 'default';
  }
});

el.overlayCanvas.addEventListener('pointerup', (e) => {
  if (state.paintingPart) {
    state.paintingPart = false;
    try { el.overlayCanvas.releasePointerCapture(e.pointerId); } catch (_) {}
    rebuildMeshAndLayersFromCurrentRig();
    return;
  }
  if (state.draggingJointId) {
    state.draggingJointId = null;
    el.overlayCanvas.style.cursor = 'grab';
    try { el.overlayCanvas.releasePointerCapture(e.pointerId); } catch (_) {}
    applyPivotChangeAndRebuild();
  }
});

// ---- Left & Right Panel Controls ----
el.chkRemoveBg.addEventListener('change', () => {
  state.removeBg = el.chkRemoveBg.checked;
  el.bgToleranceGroup.style.opacity = state.removeBg ? '1' : '0.45';
  rebuildCharacterPipeline(false, false);
});

el.rngBgTol.addEventListener('input', () => {
  state.bgTolerance = Number(el.rngBgTol.value);
  el.valBgTol.textContent = String(state.bgTolerance);
});
el.rngBgTol.addEventListener('change', () => {
  if (state.removeBg) rebuildCharacterPipeline(false, false);
});

el.chkPixelArt.addEventListener('change', () => {
  state.pixelArt = el.chkPixelArt.checked;
  syncPlaytestCharacter();
});

el.selTemplate.addEventListener('change', () => {
  state.templateId = el.selTemplate.value;
  const tpl = RIG_TEMPLATES[state.templateId];
  if (tpl?.defaultView) {
    state.viewDirection = tpl.defaultView;
    updateDirectionButtonsUI();
  }
  if (state.templateId === 'knight_34') {
    state.renderMode = 'cutout_layers';
  } else if (state.viewDirection === 'front' || state.viewDirection === 'back') {
    state.renderMode = 'hybrid_mesh';
  }
  if (el.selRenderMode) el.selRenderMode.value = state.renderMode;

  pushUndo();
  state.skeleton = autoDetectSkeleton(state.processedCanvas, state.templateId, state.viewDirection);
  state.partMap = autoSegmentParts(state.processedCanvas, state.skeleton);
  rebuildMeshAndLayersFromCurrentRig();
});

el.chkMirror.addEventListener('change', () => {
  state.mirrorRig = el.chkMirror.checked;
});

el.btnSaveRig.addEventListener('click', () => {
  if (!state.skeleton) return;
  const name = el.inpCharName.value.trim() || 'aetheria_hero';
  downloadJSON(
    {
      app: 'Auto Skeleton Studio v4',
      version: 4,
      viewDirection: state.viewDirection,
      renderMode: state.renderMode,
      skeleton: state.skeleton,
    },
    `${name}_rig.json`
  );
});

el.rigFileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (parsed.skeleton && Array.isArray(parsed.skeleton.joints)) {
        state.skeleton = parsed.skeleton;
        state.templateId = parsed.skeleton.templateId || 'auto_smart';
        state.viewDirection = parsed.viewDirection || parsed.skeleton.viewDirection || 'front';
        state.renderMode = parsed.renderMode || state.renderMode;
        el.selTemplate.value = state.templateId;
        if (el.selRenderMode) el.selRenderMode.value = state.renderMode;
        updateDirectionButtonsUI();
        state.partMap = autoSegmentParts(state.processedCanvas, state.skeleton);
        rebuildMeshAndLayersFromCurrentRig();
      }
    } catch (_) {
      alert('File Rig JSON tidak valid.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

el.chkShowSkeleton.addEventListener('change', () => {
  state.showSkeleton = el.chkShowSkeleton.checked;
});
el.chkShowHitboxes?.addEventListener('change', () => {
  state.showHitboxes = el.chkShowHitboxes.checked;
});
el.chkFlipX.addEventListener('change', () => {
  state.flipX = el.chkFlipX.checked;
});

function buildAnimationButtons() {
  el.animGrid.innerHTML = '';
  for (const anim of ANIMATION_LIST) {
    const btn = document.createElement('button');
    btn.className = 'anim-btn' + (anim.id === state.activeAnim ? ' active' : '');
    btn.innerHTML = `<span class="anim-icon">${anim.icon}</span><span>${anim.name}</span>`;
    btn.addEventListener('click', () => {
      state.activeAnim = anim.id;
      state.phase = 0;
      if (state.mode === 'rig' || state.mode === 'multigrid') setMode('animate');
      el.animGrid.querySelectorAll('.anim-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
    el.animGrid.appendChild(btn);
  }
}

el.btnPlayPause.addEventListener('click', () => {
  state.playing = !state.playing;
  el.btnPlayPause.textContent = state.playing ? '⏸ Pause' : '▶ Play';
});

el.rngTimeline.addEventListener('input', () => {
  state.playing = false;
  el.btnPlayPause.textContent = '▶ Play';
  state.phase = Number(el.rngTimeline.value) / 1000;
});

el.rngSpeed.addEventListener('input', () => {
  state.speed = Number(el.rngSpeed.value);
  el.valSpeed.textContent = `${state.speed.toFixed(2)}x`;
});

el.rngIntensity.addEventListener('input', () => {
  state.intensity = Number(el.rngIntensity.value);
  el.valIntensity.textContent = `${Math.round(state.intensity * 100)}%`;
  syncPlaytestCharacter();
});

el.rngSquash.addEventListener('input', () => {
  state.squash = Number(el.rngSquash.value);
  el.valSquash.textContent = `${Math.round(state.squash * 100)}%`;
  syncPlaytestCharacter();
});

el.rngZoom.addEventListener('input', () => {
  state.zoom = Number(el.rngZoom.value);
  el.valZoom.textContent = `${Math.round(state.zoom * 100)}%`;
});

// ---- Export Modal & Engine Code Copy ----
function buildExportPreview() {
  if (!state.processedCanvas || !state.skeleton) return;

  const scope = el.selExportScope.value;
  const frameSize = Number(el.selFrameSize.value);
  const frameCount = Number(el.selFrameCount.value);
  const engineFormat = el.selEngineFormat.value;
  const directionMode = el.selDirectionMode?.value || 'single';
  const charName = el.inpCharName.value.trim() || 'aetheria_hero';

  const animIds =
    scope === 'current'
      ? [state.activeAnim]
      : scope === 'core'
        ? ['idle', 'walk', 'run', 'jump', 'attack']
        : ANIMATION_LIST.map((a) => a.id);

  const animations = animIds.map((id) => {
    const def = ANIMATION_LIST.find((a) => a.id === id);
    return {
      id,
      frames: frameCount,
      fps: Math.round((def?.defaultFps || 10) * state.speed),
    };
  });

  const result = generateSpriteSheet({
    imageCanvas: state.processedCanvas,
    partLayers: state.partLayers,
    mesh: state.mesh,
    skeleton: state.skeleton,
    renderMode: state.renderMode,
    animations,
    frameSize,
    padding: 4,
    flipX: state.flipX,
    directionMode,
    pixelArt: state.pixelArt,
    intensity: state.intensity,
    squash: state.squash,
    characterName: charName,
    engineFormat,
  });

  state.lastExport = result;

  const pCanvas = el.exportPreviewCanvas;
  pCanvas.width = result.sheetCanvas.width;
  pCanvas.height = result.sheetCanvas.height;
  const pctx = pCanvas.getContext('2d');
  pctx.clearRect(0, 0, pCanvas.width, pCanvas.height);
  pctx.drawImage(result.sheetCanvas, 0, 0);

  const dirMult = directionMode === 'four_way' ? 4 : directionMode === 'dual' ? 2 : 1;
  const totalRows = animations.length * dirMult;
  el.lblSheetDims.textContent = `${result.sheetCanvas.width} × ${result.sheetCanvas.height} px (${totalRows} baris × ${frameCount} frame)`;
  if (el.preCodeSnippet) {
    el.preCodeSnippet.textContent = result.codeSnippet || '';
  }
}

el.btnOpenExport.addEventListener('click', () => {
  el.exportModal.classList.remove('hidden');
  buildExportPreview();
});

el.btnCloseExport.addEventListener('click', () => {
  el.exportModal.classList.add('hidden');
});

el.exportModal.addEventListener('click', (e) => {
  if (e.target === el.exportModal) el.exportModal.classList.add('hidden');
});

[el.selExportScope, el.selFrameSize, el.selFrameCount, el.selEngineFormat, el.selDirectionMode].forEach((ctrl) => {
  ctrl?.addEventListener('change', buildExportPreview);
});

el.btnCopyCode?.addEventListener('click', () => {
  if (!state.lastExport?.codeSnippet) return;
  navigator.clipboard?.writeText(state.lastExport.codeSnippet);
  const orig = el.btnCopyCode.textContent;
  el.btnCopyCode.textContent = '✅ Tersalin!';
  setTimeout(() => { el.btnCopyCode.textContent = orig; }, 1400);
});

el.btnDownloadPng.addEventListener('click', () => {
  if (!state.lastExport) buildExportPreview();
  if (state.lastExport) {
    downloadCanvasPNG(state.lastExport.sheetCanvas, state.lastExport.imageFileName);
  }
});

el.btnDownloadJson.addEventListener('click', () => {
  if (!state.lastExport) buildExportPreview();
  if (state.lastExport) {
    const jsonName = state.lastExport.imageFileName.replace(/\.png$/, '.json');
    downloadJSON(state.lastExport.metadata, jsonName);
  }
});

el.btnDownloadWebm?.addEventListener('click', async () => {
  if (!state.processedCanvas || !state.skeleton) return;
  const origText = el.btnDownloadWebm.textContent;
  el.btnDownloadWebm.textContent = '⏳ Merekam WebM...';
  el.btnDownloadWebm.disabled = true;
  try {
    const charName = el.inpCharName.value.trim() || 'aetheria_hero';
    await exportAnimationWebM({
      imageCanvas: state.processedCanvas,
      partLayers: state.partLayers,
      mesh: state.mesh,
      skeleton: state.skeleton,
      renderMode: state.renderMode,
      animId: state.activeAnim,
      frameSize: Number(el.selFrameSize.value) || 256,
      speed: state.speed,
      flipX: state.flipX,
      pixelArt: state.pixelArt,
      intensity: state.intensity,
      squash: state.squash,
      filename: `${charName}_${state.activeAnim}.webm`,
    });
  } finally {
    el.btnDownloadWebm.textContent = origText;
    el.btnDownloadWebm.disabled = false;
  }
});

// ---- Resize & Main Animation Loop ----
function handleResize() {
  const rect = el.viewportStage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(200, Math.round(rect.width * dpr));
  const h = Math.max(200, Math.round(rect.height * dpr));

  el.charCanvas.width = w;
  el.charCanvas.height = h;
  el.overlayCanvas.width = w;
  el.overlayCanvas.height = h;

  playtest.resize(Math.max(200, Math.round(rect.width)), Math.max(200, Math.round(rect.height)));
}

window.addEventListener('resize', handleResize);

let lastTime = performance.now();

function tick(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (state.explodeTarget !== null) {
    const diff = state.explodeTarget - state.explodeAmount;
    if (Math.abs(diff) < 0.01) {
      setExplodeAmount(state.explodeTarget);
      state.explodeTarget = null;
    } else {
      setExplodeAmount(state.explodeAmount + diff * Math.min(1, dt * 8));
    }
  }

  if (state.mode === 'playtest') {
    playtest.update(dt);
  } else if (state.mode === 'multigrid' && state.skeleton) {
    state.phase = (state.phase + dt * 1.25 * state.speed) % 1;
    const cw = state.processedCanvas?.width || 384;
    const ch = state.processedCanvas?.height || 384;
    const fitScale = Math.min((160 * 0.80) / cw, (160 * 0.80) / ch);
    const offsetX = (160 - cw * fitScale) * 0.5;
    const offsetY = (160 - ch * fitScale) * 0.52;

    for (const item of state.multiGridCards) {
      const pose = evaluateAnimation(item.animId, state.phase, state.skeleton, {
        intensity: state.intensity,
        squash: state.squash,
      });
      const { posedJoints, boneTransforms } = solveForwardKinematics(state.skeleton, pose);
      item.ctx.clearRect(0, 0, 160, 160);
      const view = { offsetX, offsetY, scale: fitScale, flipX: state.flipX, flash: pose.flash || 0 };

      if (state.renderMode === 'hybrid_mesh' && state.mesh) {
        deformMesh(state.mesh, boneTransforms);
        renderDeformedMesh2D(item.ctx, state.processedCanvas, state.mesh, view, state.pixelArt);
      } else {
        renderCutoutCharacter(item.ctx, 160, 160, {
          partLayers: state.partLayers,
          skeleton: state.skeleton,
          posedJoints,
          pose,
          view,
          pixelArt: state.pixelArt,
          explodeAmount: 0,
        });
      }
    }
  } else if (state.partLayers && state.skeleton) {
    const view = getViewTransform();
    const cw = state.processedCanvas?.width || 384;
    const ch = state.processedCanvas?.height || 384;

    charCtx.clearRect(0, 0, el.charCanvas.width, el.charCanvas.height);

    if (state.mode === 'rig' || state.draggingJointId) {
      const bindPose = {
        rootOffset: { x: 0, y: 0 },
        rootScale: { x: 1, y: 1 },
        rotations: {},
      };
      const { posedJoints } = solveForwardKinematics(state.skeleton, bindPose);

      renderCutoutCharacter(charCtx, el.charCanvas.width, el.charCanvas.height, {
        partLayers: state.partLayers,
        skeleton: state.skeleton,
        posedJoints,
        pose: bindPose,
        view,
        pixelArt: state.pixelArt,
        explodeAmount: state.explodeAmount,
        selectedPartId: state.selectedPartId,
        dimUnselected: state.mode === 'rig' && state.rigTool === 'brush',
      });

      drawOverlay(overlayCtx, el.overlayCanvas.width, el.overlayCanvas.height, {
        charWidth: cw,
        charHeight: ch,
        joints: state.skeleton.joints,
        posedJoints,
        view,
        showSkeleton: true,
        showPartMask: state.showPartMask,
        showHitboxes: state.showHitboxes,
        partMap: state.partMap,
        showShadow: true,
        isRigMode: true,
        explodeAmount: state.explodeAmount,
        selectedJointId: state.selectedJointId,
        hoveredJointId: state.hoveredJointId,
        selectedPartId: state.selectedPartId,
        bounds: state.skeleton.bounds,
        activeAnim: state.activeAnim,
      });
    } else {
      const animDef = ANIMATION_LIST.find((a) => a.id === state.activeAnim) || ANIMATION_LIST[0];
      if (state.playing) {
        const cycleRate = (animDef.defaultFps / animDef.defaultFrames) * state.speed;
        state.phase = (state.phase + dt * cycleRate) % 1;
        el.rngTimeline.value = String(Math.round(state.phase * 1000));
      }

      const frameIdx = Math.min(animDef.defaultFrames, Math.floor(state.phase * animDef.defaultFrames) + 1);
      el.lblFrameInfo.textContent = `${frameIdx} / ${animDef.defaultFrames}`;

      const pose = evaluateAnimation(state.activeAnim, state.phase, state.skeleton, {
        intensity: state.intensity,
        squash: state.squash,
      });
      const { posedJoints, boneTransforms } = solveForwardKinematics(state.skeleton, pose);

      const renderView = { ...view, flash: pose.flash || 0 };

      // When Explode > 0, show the separated cutout layers; otherwise use selected renderMode!
      if (state.renderMode === 'hybrid_mesh' && state.mesh && state.explodeAmount < 0.02) {
        deformMesh(state.mesh, boneTransforms);
        renderDeformedMesh2D(charCtx, state.processedCanvas, state.mesh, renderView, state.pixelArt);
      } else {
        renderCutoutCharacter(charCtx, el.charCanvas.width, el.charCanvas.height, {
          partLayers: state.partLayers,
          skeleton: state.skeleton,
          posedJoints,
          pose,
          view: renderView,
          pixelArt: state.pixelArt,
          explodeAmount: state.explodeAmount,
        });
      }

      drawOverlay(overlayCtx, el.overlayCanvas.width, el.overlayCanvas.height, {
        charWidth: cw,
        charHeight: ch,
        joints: state.skeleton.joints,
        posedJoints,
        view,
        showSkeleton: state.showSkeleton,
        showPartMask: state.showPartMask,
        showHitboxes: state.showHitboxes,
        partMap: state.partMap,
        showShadow: true,
        isRigMode: false,
        explodeAmount: state.explodeAmount,
        selectedJointId: state.selectedJointId,
        hoveredJointId: state.hoveredJointId,
        bounds: state.skeleton.bounds,
        activeAnim: state.activeAnim,
      });
    }
  }

  requestAnimationFrame(tick);
}

const videoToSheet = initVideoToSheet({
  getCharName: () => el.inpCharName.value.trim(),
});

initCloud({
  getName: () => el.inpCharName.value.trim(),
  getSpriteBlob: () => new Promise((resolve) => {
    if (!state.processedCanvas) return resolve(null);
    state.processedCanvas.toBlob(resolve, 'image/png');
  }),
});

// ---- Boot with Aetheria Sven (Front View) by default! ----
buildAnimationButtons();
handleResize();
loadPresetCharacter('sven');
requestAnimationFrame(tick);
