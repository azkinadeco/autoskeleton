/**
 * Offline Video-to-SpriteSheet Extractor
 * Converts any .mp4 / .webm / .mov (e.g. from Wan 2.1, LTX-Video, Kling, ComfyUI)
 * into an aligned, background-removed PNG Sprite Sheet + JSON Atlas 100% offline.
 */
import { removeBackground } from '../utils/imageProcessing.js';
import { downloadCanvasPNG, downloadJSON } from '../engine/exporter.js';

const AI_VIDEO_PROMPTS = {
  attack:
    '2D game character performing a fast sword slash attack animation with glowing crescent slash trail, full body visible, solid plain white background, locked static side/front camera, no camera movement, crisp anime game sprite style',
  run:
    '2D game character running cycle animation in place, full body visible, solid plain white background, locked static camera, no camera movement, smooth looping game sprite',
  idle:
    '2D game character gentle breathing idle combat stance animation, hair and cape swaying softly, full body visible, solid plain white background, locked static camera',
  cast:
    '2D game character casting a glowing magic spell animation, full body visible, solid plain white background, locked static camera, no camera movement, crisp game sprite',
};

function getAlphaBounds(canvas, alphaThreshold = 20) {
  const w = canvas.width;
  const h = canvas.height;
  const data = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return { minX: 0, minY: 0, maxX: w - 1, maxY: h - 1, w, h, empty: true };
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1, empty: false };
}

function seekVideo(video, timeSec) {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked, { once: true });
    video.currentTime = Math.max(0, Math.min(video.duration || 0, timeSec));
  });
}

export function initVideoToSheet({ getCharName }) {
  const root = document.getElementById('videoSheetView');
  if (!root) return { setActive() {} };

  root.innerHTML = `
    <div class="v2s-layout">
      <div class="v2s-sidebar">
        <div class="v2s-drop" id="v2sDrop">
          <input type="file" id="v2sFile" accept="video/mp4,video/webm,video/quicktime,video/*" hidden />
          <strong>🎬 Tarik video MP4 / WebM ke sini</strong>
          <span>atau klik untuk pilih file</span>
        </div>

        <div class="v2s-group">
          <div class="v2s-row2">
            <div class="field-group">
              <label for="v2sCount">Jumlah Frame</label>
              <select id="v2sCount">
                <option value="6">6 frame</option>
                <option value="8" selected>8 frame</option>
                <option value="12">12 frame</option>
                <option value="16">16 frame (4×4)</option>
                <option value="25">25 frame (5×5 AutoSprite)</option>
              </select>
            </div>
            <div class="field-group">
              <label for="v2sSize">Ukuran Frame</label>
              <select id="v2sSize">
                <option value="128">128 px</option>
                <option value="256" selected>256 px</option>
                <option value="512">512 px</option>
              </select>
            </div>
          </div>

          <div class="v2s-row2">
            <div class="field-group">
              <label for="v2sLayout">Susunan Sheet</label>
              <select id="v2sLayout">
                <option value="grid" selected>Grid Persegi</option>
                <option value="strip">1 Baris (Strip)</option>
              </select>
            </div>
            <div class="field-group">
              <label for="v2sFps">FPS Preview</label>
              <select id="v2sFps">
                <option value="8">8 FPS</option>
                <option value="12" selected>12 FPS</option>
                <option value="16">16 FPS</option>
              </select>
            </div>
          </div>

          <div class="slider-group">
            <div class="slider-header"><span>Mulai (Trim Start)</span><span id="v2sStartVal">0.00s</span></div>
            <input type="range" id="v2sStart" min="0" max="100" value="0" />
          </div>
          <div class="slider-group">
            <div class="slider-header"><span>Selesai (Trim End)</span><span id="v2sEndVal">100%</span></div>
            <input type="range" id="v2sEnd" min="5" max="100" value="100" />
          </div>

          <label class="toggle-label"><input type="checkbox" id="v2sRemoveBg" checked /><span>Hapus background otomatis</span></label>
          <div class="slider-group" id="v2sTolWrap">
            <div class="slider-header"><span>Toleransi BG</span><span id="v2sTolVal">36</span></div>
            <input type="range" id="v2sTol" min="8" max="95" value="36" />
          </div>
          <label class="toggle-label"><input type="checkbox" id="v2sAlignFeet" checked /><span>Ratakan posisi kaki (Anti-Jitter)</span></label>

          <button class="btn btn-primary btn-block" id="v2sExtract" disabled style="margin-top:8px">⚡ Ekstrak Sprite Sheet</button>
          <div class="btn-row">
            <button class="btn btn-secondary btn-sm" id="v2sDlPng" disabled>⬇️ PNG</button>
            <button class="btn btn-secondary btn-sm" id="v2sDlJson" disabled>📄 JSON</button>
          </div>
          <div class="muted" id="v2sStatus" style="margin-top:6px">Belum ada video dimuat.</div>
        </div>

        <details class="card adv">
          <summary>Prompt AI Video Gratis</summary>
          <div class="field-group">
            <label for="v2sPromptKind">Jenis gerakan</label>
            <select id="v2sPromptKind">
              <option value="attack">Attack (Tebasan)</option>
              <option value="run">Run (Lari)</option>
              <option value="idle">Idle (Napas)</option>
              <option value="cast">Cast (Sihir)</option>
            </select>
          </div>
          <div class="v2s-prompt-box" id="v2sPromptText"></div>
          <button class="btn btn-secondary btn-sm btn-block" id="v2sCopyPrompt" style="margin-top:6px">📋 Copy Prompt (Wan / LTX / Kling)</button>
        </details>
      </div>

      <div class="v2s-main">
        <div class="v2s-preview-row">
          <div class="v2s-card">
            <div class="v2s-card-head"><span>Preview Animasi</span><span id="v2sAnimFrame">—</span></div>
            <canvas id="v2sAnimCanvas" width="256" height="256"></canvas>
          </div>
          <div class="v2s-card v2s-sheet-card">
            <div class="v2s-card-head"><span>Hasil Sprite Sheet</span><span id="v2sSheetDims">—</span></div>
            <div class="v2s-sheet-scroll">
              <canvas id="v2sSheetCanvas" width="256" height="256"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const $ = (id) => document.getElementById(id);
  const elDrop = $('v2sDrop');
  const elFile = $('v2sFile');
  const elCount = $('v2sCount');
  const elSize = $('v2sSize');
  const elLayout = $('v2sLayout');
  const elFps = $('v2sFps');
  const elStart = $('v2sStart');
  const elEnd = $('v2sEnd');
  const elStartVal = $('v2sStartVal');
  const elEndVal = $('v2sEndVal');
  const elRemoveBg = $('v2sRemoveBg');
  const elTol = $('v2sTol');
  const elTolVal = $('v2sTolVal');
  const elAlignFeet = $('v2sAlignFeet');
  const elExtract = $('v2sExtract');
  const elDlPng = $('v2sDlPng');
  const elDlJson = $('v2sDlJson');
  const elStatus = $('v2sStatus');
  const elAnimCanvas = $('v2sAnimCanvas');
  const elAnimFrame = $('v2sAnimFrame');
  const elSheetCanvas = $('v2sSheetCanvas');
  const elSheetDims = $('v2sSheetDims');
  const elPromptKind = $('v2sPromptKind');
  const elPromptText = $('v2sPromptText');
  const elCopyPrompt = $('v2sCopyPrompt');

  const animCtx = elAnimCanvas.getContext('2d');
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';

  let videoUrl = null;
  let videoName = 'video_sprite';
  let extractedFrames = [];
  let lastMeta = null;
  let isActive = false;
  let animIdx = 0;
  let lastTick = 0;

  function updatePromptBox() {
    elPromptText.textContent = AI_VIDEO_PROMPTS[elPromptKind.value] || AI_VIDEO_PROMPTS.attack;
  }
  updatePromptBox();
  elPromptKind.addEventListener('change', updatePromptBox);
  elCopyPrompt.addEventListener('click', () => {
    navigator.clipboard?.writeText(elPromptText.textContent);
    const orig = elCopyPrompt.textContent;
    elCopyPrompt.textContent = '✅ Tersalin!';
    setTimeout(() => { elCopyPrompt.textContent = orig; }, 1300);
  });

  function updateTrimLabels() {
    const dur = video.duration || 0;
    const s = (Number(elStart.value) / 100) * dur;
    const e = (Number(elEnd.value) / 100) * dur;
    elStartVal.textContent = dur ? `${s.toFixed(2)}s` : `${elStart.value}%`;
    elEndVal.textContent = dur ? `${e.toFixed(2)}s` : `${elEnd.value}%`;
  }

  elStart.addEventListener('input', () => {
    if (Number(elStart.value) >= Number(elEnd.value) - 2) {
      elStart.value = String(Math.max(0, Number(elEnd.value) - 2));
    }
    updateTrimLabels();
  });
  elEnd.addEventListener('input', () => {
    if (Number(elEnd.value) <= Number(elStart.value) + 2) {
      elEnd.value = String(Math.min(100, Number(elStart.value) + 2));
    }
    updateTrimLabels();
  });
  elTol.addEventListener('input', () => {
    elTolVal.textContent = elTol.value;
  });

  function loadVideoFile(file) {
    if (!file || !file.type.startsWith('video/')) {
      elStatus.textContent = '⚠ Pilih file video (.mp4 / .webm / .mov).';
      return;
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    videoUrl = URL.createObjectURL(file);
    videoName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    video.src = videoUrl;
    elStatus.textContent = 'Memuat video...';
    elExtract.disabled = true;

    video.onloadedmetadata = () => {
      updateTrimLabels();
      elExtract.disabled = false;
      elStatus.textContent = `Video siap: ${video.videoWidth}×${video.videoHeight}, ${video.duration.toFixed(2)}s. Klik Ekstrak.`;
    };
  }

  elDrop.addEventListener('click', () => elFile.click());
  elFile.addEventListener('change', (e) => {
    if (e.target.files?.[0]) loadVideoFile(e.target.files[0]);
    e.target.value = '';
  });
  elDrop.addEventListener('dragover', (e) => { e.preventDefault(); elDrop.classList.add('dragover'); });
  elDrop.addEventListener('dragleave', () => elDrop.classList.remove('dragover'));
  elDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    elDrop.classList.remove('dragover');
    if (e.dataTransfer.files?.[0]) loadVideoFile(e.dataTransfer.files[0]);
  });

  elExtract.addEventListener('click', async () => {
    if (!video.duration || !video.videoWidth) return;
    elExtract.disabled = true;
    elDlPng.disabled = true;
    elDlJson.disabled = true;

    try {
      const count = Number(elCount.value) || 8;
      const frameSize = Number(elSize.value) || 256;
      const layout = elLayout.value;
      const doRemoveBg = elRemoveBg.checked;
      const tol = Number(elTol.value) || 36;
      const alignFeet = elAlignFeet.checked;

      const tStart = (Number(elStart.value) / 100) * video.duration;
      const tEnd = (Number(elEnd.value) / 100) * video.duration;
      const span = Math.max(0.05, tEnd - tStart);

      // Downscale capture cap for speed
      const maxCap = Math.max(frameSize * 2, 512);
      const capScale = Math.min(1, maxCap / Math.max(video.videoWidth, video.videoHeight));
      const capW = Math.max(32, Math.round(video.videoWidth * capScale));
      const capH = Math.max(32, Math.round(video.videoHeight * capScale));

      const rawFrames = [];
      let maxContentW = 1;
      let maxContentH = 1;

      for (let i = 0; i < count; i++) {
        elStatus.textContent = `Mengekstrak frame ${i + 1} / ${count}...`;
        const t = tStart + (count === 1 ? 0 : (i / (count - 1)) * span * 0.98);
        await seekVideo(video, t);

        const c = document.createElement('canvas');
        c.width = capW;
        c.height = capH;
        c.getContext('2d', { willReadFrequently: true }).drawImage(video, 0, 0, capW, capH);

        const cleaned = doRemoveBg
          ? removeBackground(c, { tolerance: tol, feather: 1, removeInteriorPockets: true })
          : c;
        const bounds = getAlphaBounds(cleaned);
        if (!bounds.empty) {
          if (bounds.w > maxContentW) maxContentW = bounds.w;
          if (bounds.h > maxContentH) maxContentH = bounds.h;
        }
        rawFrames.push({ canvas: cleaned, bounds });
      }

      // Normalize & align feet onto frameSize × frameSize
      const pad = Math.round(frameSize * 0.08);
      const usable = frameSize - pad * 2;
      const unifiedScale = Math.min(usable / maxContentW, usable / maxContentH);

      extractedFrames = rawFrames.map(({ canvas, bounds }) => {
        const out = document.createElement('canvas');
        out.width = frameSize;
        out.height = frameSize;
        const octx = out.getContext('2d');
        if (alignFeet && !bounds.empty) {
          const dw = bounds.w * unifiedScale;
          const dh = bounds.h * unifiedScale;
          const dx = (frameSize - dw) * 0.5;
          const dy = frameSize - pad - dh; // anchor feet to consistent bottom baseline
          octx.drawImage(canvas, bounds.minX, bounds.minY, bounds.w, bounds.h, dx, dy, dw, dh);
        } else {
          const s = Math.min(frameSize / canvas.width, frameSize / canvas.height);
          const dw = canvas.width * s;
          const dh = canvas.height * s;
          octx.drawImage(canvas, (frameSize - dw) * 0.5, (frameSize - dh) * 0.5, dw, dh);
        }
        return out;
      });

      const cols = layout === 'strip' ? count : Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      elSheetCanvas.width = cols * frameSize;
      elSheetCanvas.height = rows * frameSize;
      const sctx = elSheetCanvas.getContext('2d');
      sctx.clearRect(0, 0, elSheetCanvas.width, elSheetCanvas.height);

      const framesMeta = {};
      extractedFrames.forEach((fc, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = col * frameSize;
        const y = row * frameSize;
        sctx.drawImage(fc, x, y);
        framesMeta[`${videoName}_${String(idx).padStart(2, '0')}`] = {
          frame: { x, y, w: frameSize, h: frameSize },
          sourceSize: { w: frameSize, h: frameSize },
        };
      });

      lastMeta = {
        meta: {
          app: 'Auto Skeleton Studio — Video-to-SpriteSheet',
          image: `${videoName}_sheet.png`,
          size: { w: elSheetCanvas.width, h: elSheetCanvas.height },
          frameSize,
          cols,
          rows,
          fps: Number(elFps.value) || 12,
          frameCount: count,
        },
        frames: framesMeta,
      };

      elSheetDims.textContent = `${elSheetCanvas.width}×${elSheetCanvas.height} px (${cols}×${rows})`;
      elStatus.textContent = `Selesai! ${count} frame siap diunduh.`;
      elDlPng.disabled = false;
      elDlJson.disabled = false;
      animIdx = 0;
    } catch (err) {
      elStatus.textContent = '⚠ Gagal ekstrak: ' + (err?.message || err);
    } finally {
      elExtract.disabled = false;
    }
  });

  elDlPng.addEventListener('click', () => {
    if (!extractedFrames.length) return;
    const base = videoName || getCharName() || 'sprite';
    downloadCanvasPNG(elSheetCanvas, `${base}_sheet.png`);
  });

  elDlJson.addEventListener('click', () => {
    if (!lastMeta) return;
    const base = videoName || getCharName() || 'sprite';
    downloadJSON(lastMeta, `${base}_sheet.json`);
  });

  function loop(now) {
    if (isActive && extractedFrames.length > 0) {
      const fps = Number(elFps.value) || 12;
      if (now - lastTick >= 1000 / fps) {
        lastTick = now;
        const fc = extractedFrames[animIdx % extractedFrames.length];
        animCtx.clearRect(0, 0, elAnimCanvas.width, elAnimCanvas.height);
        animCtx.drawImage(fc, 0, 0, elAnimCanvas.width, elAnimCanvas.height);
        elAnimFrame.textContent = `${(animIdx % extractedFrames.length) + 1} / ${extractedFrames.length}`;
        animIdx = (animIdx + 1) % extractedFrames.length;
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  return {
    setActive(active) {
      isActive = active;
    },
  };
}
