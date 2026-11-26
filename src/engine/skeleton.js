/**
 * 2D Pivot-Based Skeleton System (v4 - 4 View Directions: Front, Side-Right, Side-Left, Back)
 *
 * Supports explicit View Direction ('front' | 'side_right' | 'side_left' | 'back')
 * so front-facing Aetheria sprites (like Sven, Kali, Ymir, Hyeonxa, and Titik Tumpu diagram),
 * side-right knights (ch1-idle-first.webp), side-left sprites, and back-view RPG sprites
 * each get their proper anatomical structure and pivot placement!
 */

import { computeSlashFX } from './fx.js';

export const VIEW_DIRECTIONS = [
  { id: 'front',      name: '⬆️ Tampak Depan (Front RPG / Aetheria)' },
  { id: 'side_right', name: '➡️ Tampak Samping Kanan / 3/4 Kanan' },
  { id: 'side_left',  name: '⬅️ Tampak Samping Kiri / 3/4 Kiri' },
  { id: 'back',       name: '⬇️ Tampak Belakang (Back View)' },
];

export const RIG_TEMPLATES = {
  auto_smart: {
    name: '✨ Auto-Scan Siluet Pintar (Sesuai Arah Hadap)',
    mode: 'smart',
  },
  front_aetheria: {
    name: '🧍 Tampak Depan — Aetheria Chibi/Anime (Sven/Kali)',
    mode: 'preset',
    defaultView: 'front',
    joints: [
      { id: 'hip',        label: 'Pivot Pinggang / Tubuh Bawah', parent: null,         mirror: null,         color: '#facc15', nx: 0.500, ny: 0.610, inheritRot: true },
      { id: 'chest',      label: 'Pivot Dada / Tubuh Atas',      parent: 'hip',        mirror: null,         color: '#fb923c', nx: 0.500, ny: 0.460, inheritRot: true },
      { id: 'neck',       label: 'Pivot Leher / Kepala',         parent: 'chest',      mirror: null,         color: '#38bdf8', nx: 0.500, ny: 0.375, inheritRot: true },
      { id: 'head',       label: 'Puncak Kepala',                parent: 'neck',       mirror: null,         color: '#38bdf8', nx: 0.500, ny: 0.160, inheritRot: true },

      { id: 'shoulder_r', label: 'Pivot Bahu Kiri Layar',        parent: 'chest',      mirror: 'shoulder_l', color: '#f472b6', nx: 0.390, ny: 0.395, inheritRot: true },
      { id: 'elbow_r',    label: 'Pivot Siku Kiri Layar',        parent: 'shoulder_r', mirror: 'elbow_l',    color: '#ec4899', nx: 0.285, ny: 0.340, inheritRot: true },
      { id: 'hand_r',     label: 'Tangan Kiri Layar',            parent: 'elbow_r',    mirror: 'hand_l',     color: '#ec4899', nx: 0.295, ny: 0.240, inheritRot: true },

      { id: 'shoulder_l', label: 'Pivot Bahu Kanan Layar',       parent: 'chest',      mirror: 'shoulder_r', color: '#4ade80', nx: 0.605, ny: 0.395, inheritRot: true },
      { id: 'elbow_l',    label: 'Pivot Siku Kanan Layar',       parent: 'shoulder_l', mirror: 'elbow_r',    color: '#4ade80', nx: 0.695, ny: 0.330, inheritRot: true },
      { id: 'hand_l',     label: 'Tangan Kanan Layar',           parent: 'elbow_l',    mirror: 'hand_r',     color: '#4ade80', nx: 0.665, ny: 0.235, inheritRot: true },

      { id: 'hip_l',      label: 'Pivot Paha Kiri Layar',        parent: 'hip',        mirror: 'hip_r',      color: '#a78bfa', nx: 0.435, ny: 0.650, inheritRot: false },
      { id: 'knee_l',     label: 'Pivot Lutut Kiri Layar',       parent: 'hip_l',      mirror: 'knee_r',     color: '#8b5cf6', nx: 0.405, ny: 0.800, inheritRot: true },
      { id: 'foot_l',     label: 'Pergelangan Kaki Kiri',        parent: 'knee_l',     mirror: 'foot_r',     color: '#8b5cf6', nx: 0.370, ny: 0.955, inheritRot: true },

      { id: 'hip_r',      label: 'Pivot Paha Kanan Layar',       parent: 'hip',        mirror: 'hip_l',      color: '#2dd4bf', nx: 0.565, ny: 0.650, inheritRot: false },
      { id: 'knee_r',     label: 'Pivot Lutut Kanan Layar',      parent: 'hip_r',      mirror: 'knee_l',     color: '#14b8a6', nx: 0.595, ny: 0.800, inheritRot: true },
      { id: 'foot_r',     label: 'Pergelangan Kaki Kanan',       parent: 'knee_r',     mirror: 'foot_l',     color: '#14b8a6', nx: 0.630, ny: 0.955, inheritRot: true },
    ],
  },
  humanoid_front: {
    name: '🧍 Tampak Depan — Standar Tangan di Samping',
    mode: 'preset',
    defaultView: 'front',
    joints: [
      { id: 'hip',        label: 'Pivot Pinggul / Badan', parent: null,         mirror: null,         color: '#facc15', nx: 0.500, ny: 0.590, inheritRot: true },
      { id: 'chest',      label: 'Pivot Dada',            parent: 'hip',        mirror: null,         color: '#fb923c', nx: 0.500, ny: 0.430, inheritRot: true },
      { id: 'neck',       label: 'Pivot Leher / Kepala',  parent: 'chest',      mirror: null,         color: '#38bdf8', nx: 0.500, ny: 0.335, inheritRot: true },
      { id: 'head',       label: 'Puncak Kepala',         parent: 'neck',       mirror: null,         color: '#38bdf8', nx: 0.500, ny: 0.140, inheritRot: true },

      { id: 'shoulder_r', label: 'Pivot Bahu Kiri Layar', parent: 'chest',      mirror: 'shoulder_l', color: '#f472b6', nx: 0.370, ny: 0.365, inheritRot: true },
      { id: 'elbow_r',    label: 'Pivot Siku Kiri Layar', parent: 'shoulder_r', mirror: 'elbow_l',    color: '#ec4899', nx: 0.285, ny: 0.490, inheritRot: true },
      { id: 'hand_r',     label: 'Tangan Kiri Layar',     parent: 'elbow_r',    mirror: 'hand_l',     color: '#ec4899', nx: 0.220, ny: 0.615, inheritRot: true },

      { id: 'shoulder_l', label: 'Pivot Bahu Kanan Layar',parent: 'chest',      mirror: 'shoulder_r', color: '#4ade80', nx: 0.630, ny: 0.365, inheritRot: true },
      { id: 'elbow_l',    label: 'Pivot Siku Kanan Layar',parent: 'shoulder_l', mirror: 'elbow_r',    color: '#4ade80', nx: 0.715, ny: 0.490, inheritRot: true },
      { id: 'hand_l',     label: 'Tangan Kanan Layar',    parent: 'elbow_l',    mirror: 'hand_r',     color: '#4ade80', nx: 0.780, ny: 0.615, inheritRot: true },

      { id: 'hip_l',      label: 'Pivot Paha Kiri',       parent: 'hip',        mirror: 'hip_r',      color: '#a78bfa', nx: 0.430, ny: 0.640, inheritRot: false },
      { id: 'knee_l',     label: 'Pivot Lutut Kiri',      parent: 'hip_l',      mirror: 'knee_r',     color: '#8b5cf6', nx: 0.420, ny: 0.805, inheritRot: true },
      { id: 'foot_l',     label: 'Pergelangan Kaki Kiri', parent: 'knee_l',     mirror: 'foot_r',     color: '#8b5cf6', nx: 0.415, ny: 0.960, inheritRot: true },

      { id: 'hip_r',      label: 'Pivot Paha Kanan',      parent: 'hip',        mirror: 'hip_l',      color: '#2dd4bf', nx: 0.570, ny: 0.640, inheritRot: false },
      { id: 'knee_r',     label: 'Pivot Lutut Kanan',     parent: 'hip_r',      mirror: 'knee_l',     color: '#14b8a6', nx: 0.580, ny: 0.805, inheritRot: true },
      { id: 'foot_r',     label: 'Pergelangan Kaki Kanan',parent: 'knee_r',     mirror: 'foot_l',     color: '#14b8a6', nx: 0.585, ny: 0.960, inheritRot: true },
    ],
  },
  knight_34: {
    name: '➡️ Samping Kanan / 3/4 — Ksatria Pedang & Perisai',
    mode: 'preset',
    defaultView: 'side_right',
    joints: [
      { id: 'hip',        label: 'Pivot Pinggul / Badan', parent: null,         mirror: null,         color: '#facc15', nx: 0.510, ny: 0.610, inheritRot: true },
      { id: 'chest',      label: 'Dada (Tengah Torso)',   parent: 'hip',        mirror: null,         color: '#fb923c', nx: 0.520, ny: 0.450, inheritRot: true },
      { id: 'neck',       label: 'Pivot Leher / Kepala',  parent: 'chest',      mirror: null,         color: '#38bdf8', nx: 0.525, ny: 0.345, inheritRot: true },
      { id: 'head',       label: 'Ujung Kepala / Helm',   parent: 'neck',       mirror: null,         color: '#38bdf8', nx: 0.505, ny: 0.130, inheritRot: true },

      { id: 'shoulder_r', label: 'Pivot Bahu Pedang (Kiri)',parent: 'chest',    mirror: 'shoulder_l', color: '#f472b6', nx: 0.415, ny: 0.365, inheritRot: true },
      { id: 'elbow_r',    label: 'Pivot Siku & Pedang',   parent: 'shoulder_r', mirror: 'elbow_l',    color: '#ec4899', nx: 0.318, ny: 0.505, inheritRot: true },
      { id: 'hand_r',     label: 'Ujung Tangan & Pedang', parent: 'elbow_r',    mirror: 'hand_l',     color: '#ec4899', nx: 0.220, ny: 0.640, inheritRot: true },

      { id: 'shoulder_l', label: 'Pivot Perisai (Kanan)', parent: 'chest',      mirror: 'shoulder_r', color: '#4ade80', nx: 0.630, ny: 0.435, inheritRot: true },
      { id: 'elbow_l',    label: 'Tengah Perisai / Siku', parent: 'shoulder_l', mirror: 'elbow_r',    color: '#4ade80', nx: 0.710, ny: 0.530, inheritRot: true },
      { id: 'hand_l',     label: 'Ujung Perisai / Tangan',parent: 'elbow_l',    mirror: 'hand_r',     color: '#4ade80', nx: 0.775, ny: 0.625, inheritRot: true },

      { id: 'hip_l',      label: 'Pivot Paha Depan',      parent: 'hip',        mirror: 'hip_r',      color: '#a78bfa', nx: 0.445, ny: 0.655, inheritRot: false },
      { id: 'knee_l',     label: 'Pivot Lutut Depan',     parent: 'hip_l',      mirror: 'knee_r',     color: '#8b5cf6', nx: 0.440, ny: 0.815, inheritRot: true },
      { id: 'foot_l',     label: 'Ujung Kaki Depan',      parent: 'knee_l',     mirror: 'foot_r',     color: '#8b5cf6', nx: 0.440, ny: 0.965, inheritRot: true },

      { id: 'hip_r',      label: 'Pivot Paha Belakang',   parent: 'hip',        mirror: 'hip_l',      color: '#2dd4bf', nx: 0.568, ny: 0.655, inheritRot: false },
      { id: 'knee_r',     label: 'Pivot Lutut Belakang',  parent: 'hip_r',      mirror: 'knee_l',     color: '#14b8a6', nx: 0.585, ny: 0.800, inheritRot: true },
      { id: 'foot_r',     label: 'Ujung Kaki Belakang',   parent: 'knee_r',     mirror: 'foot_l',     color: '#14b8a6', nx: 0.625, ny: 0.935, inheritRot: true },
    ],
  },
  side_left_34: {
    name: '⬅️ Samping Kiri / 3/4 Kiri — Hero / Ksatria',
    mode: 'preset',
    defaultView: 'side_left',
    joints: [
      { id: 'hip',        label: 'Pivot Pinggul / Badan', parent: null,         mirror: null,         color: '#facc15', nx: 0.490, ny: 0.610, inheritRot: true },
      { id: 'chest',      label: 'Dada (Tengah Torso)',   parent: 'hip',        mirror: null,         color: '#fb923c', nx: 0.480, ny: 0.450, inheritRot: true },
      { id: 'neck',       label: 'Pivot Leher / Kepala',  parent: 'chest',      mirror: null,         color: '#38bdf8', nx: 0.475, ny: 0.345, inheritRot: true },
      { id: 'head',       label: 'Ujung Kepala',          parent: 'neck',       mirror: null,         color: '#38bdf8', nx: 0.495, ny: 0.130, inheritRot: true },

      { id: 'shoulder_r', label: 'Pivot Lengan Kiri/Depan',parent: 'chest',     mirror: 'shoulder_l', color: '#f472b6', nx: 0.370, ny: 0.435, inheritRot: true },
      { id: 'elbow_r',    label: 'Pivot Siku Kiri/Depan', parent: 'shoulder_r', mirror: 'elbow_l',    color: '#ec4899', nx: 0.290, ny: 0.530, inheritRot: true },
      { id: 'hand_r',     label: 'Ujung Tangan Kiri',     parent: 'elbow_r',    mirror: 'hand_l',     color: '#ec4899', nx: 0.225, ny: 0.625, inheritRot: true },

      { id: 'shoulder_l', label: 'Pivot Bahu Kanan/Senjata',parent: 'chest',    mirror: 'shoulder_r', color: '#4ade80', nx: 0.585, ny: 0.365, inheritRot: true },
      { id: 'elbow_l',    label: 'Pivot Siku Kanan',      parent: 'shoulder_l', mirror: 'elbow_r',    color: '#4ade80', nx: 0.682, ny: 0.505, inheritRot: true },
      { id: 'hand_l',     label: 'Ujung Tangan Kanan',    parent: 'elbow_l',    mirror: 'hand_r',     color: '#4ade80', nx: 0.780, ny: 0.640, inheritRot: true },

      { id: 'hip_l',      label: 'Pivot Paha Kiri (Depan)',parent: 'hip',       mirror: 'hip_r',      color: '#a78bfa', nx: 0.432, ny: 0.655, inheritRot: false },
      { id: 'knee_l',     label: 'Pivot Lutut Kiri',      parent: 'hip_l',      mirror: 'knee_r',     color: '#8b5cf6', nx: 0.415, ny: 0.800, inheritRot: true },
      { id: 'foot_l',     label: 'Ujung Kaki Kiri',       parent: 'knee_l',     mirror: 'foot_r',     color: '#8b5cf6', nx: 0.375, ny: 0.935, inheritRot: true },

      { id: 'hip_r',      label: 'Pivot Paha Kanan (Belakang)',parent: 'hip',   mirror: 'hip_l',      color: '#2dd4bf', nx: 0.555, ny: 0.655, inheritRot: false },
      { id: 'knee_r',     label: 'Pivot Lutut Kanan',     parent: 'hip_r',      mirror: 'knee_l',     color: '#14b8a6', nx: 0.560, ny: 0.815, inheritRot: true },
      { id: 'foot_r',     label: 'Ujung Kaki Kanan',      parent: 'knee_r',     mirror: 'foot_l',     color: '#14b8a6', nx: 0.560, ny: 0.965, inheritRot: true },
    ],
  },
  back_rpg: {
    name: '⬇️ Tampak Belakang — RPG Back View',
    mode: 'preset',
    defaultView: 'back',
    joints: [
      { id: 'hip',        label: 'Pivot Pinggul Belakang', parent: null,         mirror: null,         color: '#facc15', nx: 0.500, ny: 0.600, inheritRot: true },
      { id: 'chest',      label: 'Punggung / Jubah Atas',  parent: 'hip',        mirror: null,         color: '#fb923c', nx: 0.500, ny: 0.440, inheritRot: true },
      { id: 'neck',       label: 'Pivot Tengkuk / Kepala', parent: 'chest',      mirror: null,         color: '#38bdf8', nx: 0.500, ny: 0.340, inheritRot: true },
      { id: 'head',       label: 'Puncak Kepala Belakang', parent: 'neck',       mirror: null,         color: '#38bdf8', nx: 0.500, ny: 0.140, inheritRot: true },

      { id: 'shoulder_r', label: 'Pivot Bahu Kiri',        parent: 'chest',      mirror: 'shoulder_l', color: '#f472b6', nx: 0.370, ny: 0.370, inheritRot: true },
      { id: 'elbow_r',    label: 'Pivot Siku Kiri',        parent: 'shoulder_r', mirror: 'elbow_l',    color: '#ec4899', nx: 0.285, ny: 0.495, inheritRot: true },
      { id: 'hand_r',     label: 'Tangan Kiri',            parent: 'elbow_r',    mirror: 'hand_l',     color: '#ec4899', nx: 0.225, ny: 0.620, inheritRot: true },

      { id: 'shoulder_l', label: 'Pivot Bahu Kanan',       parent: 'chest',      mirror: 'shoulder_r', color: '#4ade80', nx: 0.630, ny: 0.370, inheritRot: true },
      { id: 'elbow_l',    label: 'Pivot Siku Kanan',       parent: 'shoulder_l', mirror: 'elbow_r',    color: '#4ade80', nx: 0.715, ny: 0.495, inheritRot: true },
      { id: 'hand_l',     label: 'Tangan Kanan',           parent: 'elbow_l',    mirror: 'hand_r',     color: '#4ade80', nx: 0.775, ny: 0.620, inheritRot: true },

      { id: 'hip_l',      label: 'Pivot Paha Kiri',        parent: 'hip',        mirror: 'hip_r',      color: '#a78bfa', nx: 0.430, ny: 0.645, inheritRot: false },
      { id: 'knee_l',     label: 'Pivot Lutut Kiri',       parent: 'hip_l',      mirror: 'knee_r',     color: '#8b5cf6', nx: 0.425, ny: 0.805, inheritRot: true },
      { id: 'foot_l',     label: 'Kaki Kiri Belakang',     parent: 'knee_l',     mirror: 'foot_r',     color: '#8b5cf6', nx: 0.420, ny: 0.960, inheritRot: true },

      { id: 'hip_r',      label: 'Pivot Paha Kanan',       parent: 'hip',        mirror: 'hip_l',      color: '#2dd4bf', nx: 0.570, ny: 0.645, inheritRot: false },
      { id: 'knee_r',     label: 'Pivot Lutut Kanan',      parent: 'hip_r',      mirror: 'knee_l',     color: '#14b8a6', nx: 0.575, ny: 0.805, inheritRot: true },
      { id: 'foot_r',     label: 'Kaki Kanan Belakang',    parent: 'knee_r',     mirror: 'foot_l',     color: '#14b8a6', nx: 0.580, ny: 0.960, inheritRot: true },
    ],
  },
  creature_simple: {
    name: '👾 Boss / Pose Duduk / Monster (Ymir / Hyeonxa)',
    mode: 'preset',
    defaultView: 'front',
    joints: [
      { id: 'hip',        label: 'Pivot Dasar / Pinggul', parent: null,         mirror: null,         color: '#facc15', nx: 0.50, ny: 0.66, inheritRot: true },
      { id: 'chest',      label: 'Pivot Dada',            parent: 'hip',        mirror: null,         color: '#fb923c', nx: 0.50, ny: 0.50, inheritRot: true },
      { id: 'neck',       label: 'Pivot Leher / Kepala',  parent: 'chest',      mirror: null,         color: '#38bdf8', nx: 0.50, ny: 0.39, inheritRot: true },
      { id: 'head',       label: 'Puncak Kepala / Mahkota',parent: 'neck',      mirror: null,         color: '#38bdf8', nx: 0.50, ny: 0.15, inheritRot: true },
      { id: 'shoulder_r', label: 'Pivot Lengan/Sayap Kiri',parent: 'chest',     mirror: 'shoulder_l', color: '#f472b6', nx: 0.38, ny: 0.46, inheritRot: true },
      { id: 'elbow_r',    label: 'Siku / Sisi Kiri',      parent: 'shoulder_r', mirror: 'elbow_l',    color: '#ec4899', nx: 0.30, ny: 0.56, inheritRot: true },
      { id: 'hand_r',     label: 'Ujung Tangan Kiri',     parent: 'elbow_r',    mirror: 'hand_l',     color: '#ec4899', nx: 0.25, ny: 0.66, inheritRot: true },
      { id: 'shoulder_l', label: 'Pivot Lengan/Sayap Kanan',parent: 'chest',    mirror: 'shoulder_r', color: '#4ade80', nx: 0.62, ny: 0.44, inheritRot: true },
      { id: 'elbow_l',    label: 'Siku / Sisi Kanan',     parent: 'shoulder_l', mirror: 'elbow_r',    color: '#4ade80', nx: 0.70, ny: 0.42, inheritRot: true },
      { id: 'hand_l',     label: 'Ujung Tangan Kanan',    parent: 'elbow_l',    mirror: 'hand_r',     color: '#4ade80', nx: 0.74, ny: 0.36, inheritRot: true },
      { id: 'hip_l',      label: 'Pivot Paha Kiri',       parent: 'hip',        mirror: 'hip_r',      color: '#a78bfa', nx: 0.43, ny: 0.68, inheritRot: false },
      { id: 'knee_l',     label: 'Pivot Lutut Kiri',      parent: 'hip_l',      mirror: 'knee_r',     color: '#8b5cf6', nx: 0.38, ny: 0.82, inheritRot: true },
      { id: 'foot_l',     label: 'Kaki Kiri',             parent: 'knee_l',     mirror: 'foot_r',     color: '#8b5cf6', nx: 0.34, ny: 0.94, inheritRot: true },
      { id: 'hip_r',      label: 'Pivot Paha Kanan',      parent: 'hip',        mirror: 'hip_l',      color: '#2dd4bf', nx: 0.57, ny: 0.68, inheritRot: false },
      { id: 'knee_r',     label: 'Pivot Lutut Kanan',     parent: 'hip_r',      mirror: 'knee_l',     color: '#14b8a6', nx: 0.62, ny: 0.80, inheritRot: true },
      { id: 'foot_r',     label: 'Kaki Kanan',            parent: 'knee_r',     mirror: 'foot_l',     color: '#14b8a6', nx: 0.66, ny: 0.94, inheritRot: true },
    ],
  },
};

export function autoDetectSkeleton(canvas, templateId = 'auto_smart', viewDirection = 'front') {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, w, h).data;

  let minX = w, maxX = 0, minY = h, maxY = 0, found = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }

  if (!found) {
    minX = Math.round(w * 0.2); maxX = Math.round(w * 0.8);
    minY = Math.round(h * 0.1); maxY = Math.round(h * 0.9);
  }

  const bw = Math.max(10, maxX - minX);
  const bh = Math.max(10, maxY - minY);

  // Preset template placement
  if (templateId !== 'auto_smart' && RIG_TEMPLATES[templateId]?.joints) {
    const template = RIG_TEMPLATES[templateId];
    const joints = template.joints.map((jt) => ({
      id: jt.id,
      label: jt.label,
      parent: jt.parent,
      mirror: jt.mirror,
      color: jt.color,
      inheritRot: jt.inheritRot !== false,
      x: minX + jt.nx * bw,
      y: minY + jt.ny * bh,
    }));
    const byId = Object.fromEntries(joints.map((j) => [j.id, j]));
    return {
      templateId,
      viewDirection: template.defaultView || viewDirection,
      centerX: byId.hip ? byId.hip.x : minX + bw * 0.5,
      bounds: { minX, minY, maxX, maxY, width: bw, height: bh },
      joints,
    };
  }

  // ---- SMART SILHOUETTE ANATOMY SCANNER (Adapts to viewDirection: front, side_right, side_left, back) ----
  const colDensity = new Float32Array(w);
  let maxColScore = 1;
  const yScanTop = Math.floor(minY + bh * 0.05);
  const yScanMid = Math.floor(minY + bh * 0.38);
  const yScanBot = Math.floor(minY + bh * 0.95);
  for (let x = minX; x <= maxX; x++) {
    let upperCnt = 0;
    let totalCnt = 0;
    for (let y = yScanTop; y <= yScanBot; y++) {
      if (data[(y * w + x) * 4 + 3] > 28) {
        totalCnt++;
        if (y <= yScanMid) upperCnt++;
      }
    }
    const score = totalCnt * (1 + (upperCnt / Math.max(1, yScanMid - yScanTop)) * 1.45);
    colDensity[x] = score;
    if (score > maxColScore) maxColScore = score;
  }

  let coreSumX = 0, coreWeight = 0;
  let coreLeftX = maxX, coreRightX = minX;
  for (let x = minX; x <= maxX; x++) {
    if (colDensity[x] >= maxColScore * 0.55) {
      const weight = colDensity[x] * colDensity[x];
      coreSumX += x * weight;
      coreWeight += weight;
      if (x < coreLeftX) coreLeftX = x;
      if (x > coreRightX) coreRightX = x;
    }
  }
  const coreCenterX = coreWeight > 0 ? coreSumX / coreWeight : minX + bw * 0.5;
  const coreW = Math.max(bw * 0.24, Math.min(bw * 0.48, coreRightX - coreLeftX));

  // Scan head/neck width profile within body core
  const corePad = Math.round(coreW * 0.30);
  const hScanL = Math.max(minX, Math.floor(coreLeftX - corePad));
  const hScanR = Math.min(maxX, Math.ceil(coreRightX + corePad));

  const rowCoreW = new Float32Array(h);
  const rowCoreCenterX = new Float32Array(h);
  for (let y = minY; y <= maxY; y++) {
    let l = w, r = -1, sumX = 0, cnt = 0;
    for (let x = hScanL; x <= hScanR; x++) {
      if (data[(y * w + x) * 4 + 3] > 28) {
        if (x < l) l = x;
        if (x > r) r = x;
        sumX += x;
        cnt++;
      }
    }
    if (cnt > 0) {
      rowCoreW[y] = r - l + 1;
      rowCoreCenterX[y] = sumX / cnt;
    }
  }

  let headPeakY = Math.round(minY + bh * 0.18);
  let headMaxW = 0;
  for (let y = Math.floor(minY + bh * 0.06); y <= Math.floor(minY + bh * 0.32); y++) {
    if (rowCoreW[y] > headMaxW) {
      headMaxW = rowCoreW[y];
      headPeakY = y;
    }
  }

  let neckY = Math.round(minY + bh * 0.36);
  let minNeckScore = Infinity;
  const neckSearchStart = Math.max(headPeakY + Math.round(bh * 0.06), Math.floor(minY + bh * 0.22));
  const neckSearchEnd = Math.floor(minY + bh * 0.46);
  for (let y = neckSearchStart; y <= neckSearchEnd; y++) {
    if (rowCoreW[y] > coreW * 0.15) {
      const belowY = Math.min(maxY, y + Math.round(bh * 0.06));
      const shoulderExpansion = Math.max(0, rowCoreW[belowY] - rowCoreW[y]);
      const score = rowCoreW[y] - shoulderExpansion * 0.65;
      if (score < minNeckScore) {
        minNeckScore = score;
        neckY = y;
      }
    }
  }

  const neckX = rowCoreCenterX[neckY] > 0
    ? rowCoreCenterX[neckY] * 0.5 + coreCenterX * 0.5
    : coreCenterX;
  const headY = minY + (neckY - minY) * 0.42;
  const headX = neckX;

  // Detect Lower-Body Leg Split Seam
  const legScanTop = Math.floor(minY + bh * 0.68);
  const legScanBot = Math.floor(minY + bh * 0.96);
  let bestSplitX = Math.round(coreCenterX);
  let minSeamOpacity = Infinity;

  const seamSearchL = Math.max(minX + 4, Math.floor(coreCenterX - coreW * 0.24));
  const seamSearchR = Math.min(maxX - 4, Math.ceil(coreCenterX + coreW * 0.24));
  for (let x = seamSearchL; x <= seamSearchR; x++) {
    let seamScore = 0;
    for (let y = legScanTop; y <= legScanBot; y++) {
      const idx = (y * w + x) * 4;
      const a = data[idx + 3];
      if (a <= 28) {
        seamScore += 0;
      } else {
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        seamScore += 45 + lum;
      }
    }
    const distBias = Math.abs(x - coreCenterX) * 9;
    if (seamScore + distBias < minSeamOpacity) {
      minSeamOpacity = seamScore + distBias;
      bestSplitX = x;
    }
  }

  const hipY = Math.round(neckY + (maxY - neckY) * 0.40);
  const chestY = Math.round(neckY + (hipY - neckY) * 0.38);
  const hipX = coreCenterX;
  const chestX = (neckX + hipX) * 0.5;

  const getBandCentroid = (x0, x1, y0, y1, fallbackX, fallbackY) => {
    let sumX = 0, sumY = 0, cnt = 0;
    const iy0 = Math.max(minY, Math.floor(y0));
    const iy1 = Math.min(maxY, Math.ceil(y1));
    const ix0 = Math.max(minX, Math.floor(x0));
    const ix1 = Math.min(maxX, Math.ceil(x1));
    for (let y = iy0; y <= iy1; y++) {
      for (let x = ix0; x <= ix1; x++) {
        if (data[(y * w + x) * 4 + 3] > 28) {
          sumX += x;
          sumY += y;
          cnt++;
        }
      }
    }
    return cnt > 12
      ? { x: sumX / cnt, y: sumY / cnt, count: cnt }
      : { x: fallbackX, y: fallbackY ?? (y0 + y1) * 0.5, count: 0 };
  };

  // Keep leg centroid search inside the leg core band (ignoring far-out sword tips)
  const legLBound = Math.max(minX, Math.floor(bestSplitX - coreW * 0.65));
  const legRBound = Math.min(maxX, Math.ceil(bestSplitX + coreW * 0.65));

  const kneeBandY = Math.round(hipY + (maxY - hipY) * 0.50);
  const footBandY = Math.round(hipY + (maxY - hipY) * 0.78);
  const thighL = getBandCentroid(legLBound, bestSplitX, hipY, kneeBandY, bestSplitX - coreW * 0.18);
  const shinL  = getBandCentroid(legLBound, bestSplitX, kneeBandY, footBandY, thighL.x);
  const footL  = getBandCentroid(legLBound, bestSplitX, footBandY, maxY, shinL.x);

  const thighR = getBandCentroid(bestSplitX, legRBound, hipY, kneeBandY, bestSplitX + coreW * 0.18);
  const shinR  = getBandCentroid(bestSplitX, legRBound, kneeBandY, footBandY, thighR.x);
  const footR  = getBandCentroid(bestSplitX, legRBound, footBandY, maxY, shinR.x);

  const hipLX = hipX * 0.30 + thighL.x * 0.70;
  const kneeLX = (thighL.x + shinL.x) * 0.5;
  const footLX = footL.x;
  const footLY = Math.min(maxY - 4, Math.max(footBandY, footL.y));

  const hipRX = hipX * 0.30 + thighR.x * 0.70;
  const kneeRX = (thighR.x + shinR.x) * 0.5;
  const footRX = footR.x;
  const footRY = Math.min(maxY - 4, Math.max(footBandY, footR.y));

  // Detect Arms (handles both lowered arms and raised behind-head arms like Sven & Kali!)
  const shRY = Math.round(neckY + bh * 0.03);
  const shRX = Math.max(minX + 8, Math.round(neckX - coreW * 0.30));
  const shLY = Math.round(neckY + bh * 0.03);
  const shLX = Math.min(maxX - 8, Math.round(neckX + coreW * 0.30));

  // Check if arms are raised high (above shoulder/neck level, like Sven/Kali) vs lowered
  const upperArmL = getBandCentroid(minX, shRX - 2, minY + bh * 0.15, shRY + bh * 0.12, shRX - coreW * 0.25, shRY);
  const lowerArmL = getBandCentroid(minX, shRX - 2, shRY + bh * 0.06, hipY + bh * 0.05, shRX - coreW * 0.28, shRY + bh * 0.20);

  let elbowRX, elbowRY, handRX, handRY;
  if (upperArmL.count > lowerArmL.count * 0.85 && upperArmL.y < shRY + bh * 0.04) {
    // Raised left arm (e.g. holding greatsword behind head)
    elbowRX = Math.min(shRX - 8, upperArmL.x);
    elbowRY = upperArmL.y;
    handRX = elbowRX + (neckX - elbowRX) * 0.15;
    handRY = Math.max(minY + 12, elbowRY - bh * 0.09);
  } else {
    elbowRX = Math.min(shRX - 6, lowerArmL.x);
    elbowRY = Math.round(shRY + bh * 0.13);
    handRX = Math.min(elbowRX - 4, lowerArmL.x - coreW * 0.08);
    handRY = Math.round(elbowRY + bh * 0.13);
  }

  const upperArmR = getBandCentroid(shLX + 2, maxX, minY + bh * 0.15, shLY + bh * 0.12, shLX + coreW * 0.25, shLY);
  const lowerArmR = getBandCentroid(shLX + 2, maxX, shLY + bh * 0.06, hipY + bh * 0.05, shLX + coreW * 0.28, shLY + bh * 0.20);

  let elbowLX, elbowLY, handLX, handLY;
  if (upperArmR.count > lowerArmR.count * 0.85 && upperArmR.y < shLY + bh * 0.04) {
    // Raised right arm
    elbowLX = Math.max(shLX + 8, upperArmR.x);
    elbowLY = upperArmR.y;
    handLX = elbowLX - (elbowLX - neckX) * 0.15;
    handLY = Math.max(minY + 12, elbowLY - bh * 0.09);
  } else {
    elbowLX = Math.max(shLX + 6, lowerArmR.x);
    elbowLY = Math.round(shLY + bh * 0.13);
    handLX = Math.max(elbowLX + 4, lowerArmR.x + coreW * 0.08);
    handLY = Math.round(elbowLY + bh * 0.13);
  }

  const baseTemplate = RIG_TEMPLATES.humanoid_front.joints;
  const computedCoords = {
    hip:        { x: hipX,    y: hipY },
    chest:      { x: chestX,  y: chestY },
    neck:       { x: neckX,   y: neckY },
    head:       { x: headX,   y: headY },
    shoulder_r: { x: shRX,    y: shRY },
    elbow_r:    { x: elbowRX, y: elbowRY },
    hand_r:     { x: handRX,  y: handRY },
    shoulder_l: { x: shLX,    y: shLY },
    elbow_l:    { x: elbowLX, y: elbowLY },
    hand_l:     { x: handLX,  y: handLY },
    hip_l:      { x: hipLX,   y: Math.round(hipY + bh * 0.04) },
    knee_l:     { x: kneeLX,  y: kneeBandY },
    foot_l:     { x: footLX,  y: footLY },
    hip_r:      { x: hipRX,   y: Math.round(hipY + bh * 0.04) },
    knee_r:     { x: kneeRX,  y: kneeBandY },
    foot_r:     { x: footRX,  y: footRY },
  };

  // Props: long weapons (sword/staff) get their own bone; big shields drive the arm pivots.
  const props = detectProps(data, w, h, { minX, maxX, minY, maxY, bw, bh }, {
    coreCenterX, coreW, neckY,
    shR: computedCoords.shoulder_r, shL: computedCoords.shoulder_l,
  });
  const extraJoints = [];
  for (const side of ['r', 'l']) {
    const p = props[side];
    if (!p) continue;
    computedCoords['elbow_' + side] = p.elbow;
    computedCoords['hand_' + side] = p.hand;
    if (p.kind === 'weapon') {
      extraJoints.push({
        id: 'weapon_' + side,
        label: side === 'r' ? 'Ujung Senjata (kiri layar)' : 'Ujung Senjata (kanan layar)',
        parent: 'hand_' + side,
        mirror: null,
        color: '#facc15',
        inheritRot: true,
        x: p.tip.x,
        y: p.tip.y,
        weaponRadius: p.radius,
        weaponColor: p.color,
      });
    }
  }

  const joints = baseTemplate.map((jt) => ({
    id: jt.id,
    label: jt.label,
    parent: jt.parent,
    mirror: jt.mirror,
    color: jt.color,
    inheritRot: jt.inheritRot !== false,
    x: computedCoords[jt.id]?.x ?? (minX + jt.nx * bw),
    y: computedCoords[jt.id]?.y ?? (minY + jt.ny * bh),
  })).concat(extraJoints);

  return {
    templateId,
    viewDirection,
    centerX: hipX,
    props,
    legSplitX: bestSplitX,
    coreBounds: { coreLeftX, coreRightX, coreCenterX, coreW },
    bounds: { minX, minY, maxX, maxY, width: bw, height: bh },
    joints,
  };
}

function detectProps(data, w, h, B, C) {
  const { minX, maxX, bh } = B;
  const { coreCenterX, coreW, neckY, shR, shL } = C;
  const out = {};
  const alphaAt = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : data[(y * w + x) * 4 + 3]);

  for (const side of ['r', 'l']) {
    const sh = side === 'r' ? shR : shL;
    const x0 = side === 'r' ? minX : Math.ceil(coreCenterX + coreW * 0.62);
    const x1 = side === 'r' ? Math.floor(coreCenterX - coreW * 0.62) : maxX;
    let cnt = 0, sx = 0, sy = 0, far = 0, fx = 0, fy = 0;
    let bx0 = 1e9, bx1 = -1, by0 = 1e9, by1 = -1;
    for (let y = Math.max(0, Math.floor(neckY)); y < h; y += 2) {
      for (let x = Math.max(0, x0); x <= x1; x += 2) {
        if (alphaAt(x, y) <= 40) continue;
        cnt++; sx += x; sy += y;
        if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
        if (y < by0) by0 = y; if (y > by1) by1 = y;
        const d = Math.hypot(x - sh.x, y - sh.y);
        if (d > far) { far = d; fx = x; fy = y; }
      }
    }
    if (!cnt) continue;
    const area = cnt * 4;

    const boxArea = (bx1 - bx0 + 4) * (by1 - by0 + 4);
    const isShield = area > bh * bh * 0.09 && area / boxArea > 0.5 && by1 - by0 > bh * 0.3;
    if (isShield) {
      // ---- Big compact prop on the side (shield)
      const hand = { x: sx / cnt, y: sy / cnt };
      out[side] = { kind: 'shield', hand, elbow: { x: (sh.x + hand.x) / 2, y: (sh.y + hand.y) / 2 } };
    } else if (far > bh * 0.52) {
      // ---- Long weapon: tip = farthest pixel; grip sits near the shoulder on the tip->shoulder line
      const tip = { x: fx, y: fy };
      const hand = { x: tip.x + (sh.x - tip.x) * 0.84, y: tip.y + (sh.y - tip.y) * 0.84 };
      const len = Math.hypot(tip.x - hand.x, tip.y - hand.y) || 1;
      const ux = (tip.x - hand.x) / len, uy = (tip.y - hand.y) / len;
      const mx = hand.x + ux * len * 0.55, my = hand.y + uy * len * 0.55;
      let run = 0;
      for (const sgn of [1, -1]) {
        for (let k = 0; k < bh * 0.25; k++) {
          if (alphaAt(Math.round(mx - uy * k * sgn), Math.round(my + ux * k * sgn)) <= 40) break;
          run++;
        }
      }
      const radius = Math.max(bh * 0.045, run * 0.65);
      let cr = 0, cg = 0, cb = 0, cn = 0;
      for (let i = 0; i < 40; i++) {
        const t = 0.3 + (i / 40) * 0.6;
        const px = Math.round(hand.x + ux * len * t), py = Math.round(hand.y + uy * len * t);
        if (alphaAt(px, py) > 200) {
          const o = (py * w + px) * 4;
          cr += data[o]; cg += data[o + 1]; cb += data[o + 2]; cn++;
        }
      }
      const hex = (v) => Math.round(v).toString(16).padStart(2, '0');
      const color = cn ? '#' + hex(cr / cn) + hex(cg / cn) + hex(cb / cn) : '#ff5fa2';
      out[side] = {
        kind: 'weapon', tip, hand, radius, color,
        elbow: { x: (sh.x + hand.x) / 2, y: (sh.y + hand.y) / 2 },
      };
    }
  }
  return out;
}

export function getBones(skeleton) {
  const byId = Object.fromEntries(skeleton.joints.map((j) => [j.id, j]));
  const bones = [];
  for (const joint of skeleton.joints) {
    if (joint.parent && byId[joint.parent]) {
      bones.push({
        id: joint.id,
        parentId: joint.parent,
        childId: joint.id,
        start: byId[joint.parent],
        end: joint,
        color: joint.color,
      });
    }
  }
  return bones;
}

export function solveForwardKinematics(skeleton, pose = {}) {
  const joints = skeleton.joints;
  const byId = Object.fromEntries(joints.map((j) => [j.id, j]));

  const rootOffset = pose.rootOffset || { x: 0, y: 0 };
  const rootScale = pose.rootScale || { x: 1, y: 1 };
  const rotations = pose.rotations || {};
  const offsets = pose.offsets || {};

  const anchorX = skeleton.centerX || (skeleton.bounds.minX + skeleton.bounds.maxX) * 0.5;
  const anchorY = skeleton.bounds ? skeleton.bounds.maxY : joints[0].y;

  const posedJoints = {};

  for (const jt of joints) {
    const localRot = (rotations[jt.id] || 0) + (jt.customAngle || 0);
    const localOff = offsets[jt.id] || { x: 0, y: 0 };

    if (!jt.parent || !posedJoints[jt.parent]) {
      const rx = anchorX + (jt.x - anchorX) * rootScale.x + rootOffset.x + localOff.x;
      const ry = anchorY + (jt.y - anchorY) * rootScale.y + rootOffset.y + localOff.y;
      posedJoints[jt.id] = {
        id: jt.id,
        x: rx,
        y: ry,
        worldAngle: localRot,
        bindX: jt.x,
        bindY: jt.y,
        color: jt.color,
        parent: jt.parent,
      };
    } else {
      const parentBind = byId[jt.parent];
      const parentPosed = posedJoints[jt.parent];

      const dx = (jt.x - parentBind.x) * rootScale.x;
      const dy = (jt.y - parentBind.y) * rootScale.y;

      const orbitAngle =
        jt.inheritRot === false ? parentPosed.worldAngle * 0.25 : parentPosed.worldAngle;
      const cos = Math.cos(orbitAngle);
      const sin = Math.sin(orbitAngle);

      const wx = parentPosed.x + dx * cos - dy * sin + localOff.x;
      const wy = parentPosed.y + dx * sin + dy * cos + localOff.y;

      const baseAngle = jt.inheritRot === false ? 0 : parentPosed.worldAngle;
      const worldAngle = baseAngle + localRot;

      posedJoints[jt.id] = {
        id: jt.id,
        x: wx,
        y: wy,
        worldAngle,
        bindX: jt.x,
        bindY: jt.y,
        color: jt.color,
        parent: jt.parent,
      };
    }
  }

  // Also emit per-bone 2D affine transforms for Hybrid Pivot Mesh Skinning!
  // Crucially, in True Pivot FK, bone (parent -> child) rotates around parentBind by parentPosed.worldAngle!
  const boneTransforms = [];
  for (const jt of joints) {
    if (!jt.parent || !byId[jt.parent]) continue;
    const pBind = byId[jt.parent];
    const pPosed = posedJoints[jt.parent];
    const extraOff = pose.partOffsets?.[jt.parent] || { x: 0, y: 0 };

    const angle = pPosed.worldAngle;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    boneTransforms.push({
      id: jt.id,
      parentId: jt.parent,
      pBindX: pBind.x,
      pBindY: pBind.y,
      pPosedX: pPosed.x + extraOff.x,
      pPosedY: pPosed.y + extraOff.y,
      m00: cos * rootScale.x,
      m01: -sin * rootScale.y,
      m10: sin * rootScale.x,
      m11: cos * rootScale.y,
    });
  }

  boneTransforms.sway = pose.sway
    ? { phase: pose.sway.phase, amp: pose.sway.amp * (skeleton.bounds?.height || 200) }
    : null;
  const fx = computeSlashFX(skeleton, posedJoints, pose);
  boneTransforms.fx = fx;

  return { posedJoints, boneTransforms, fx };
}
