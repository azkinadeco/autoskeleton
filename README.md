# Auto Skeleton — Offline 2D Character Sprite Animator

Aplikasi web **100% offline, gratis, tanpa API berbayar** untuk mengubah gambar karakter 2D statis menjadi animasi sprite bergerak dan mengekspornya ke **PNG Sprite Sheet + JSON Atlas** (siap pakai untuk *Aetheria Online*, Phaser, PixiJS, Godot, Unity, atau HTML5 Canvas).

## Cara Menjalankan (Offline)

1. Buka terminal di folder `Auto Skeleton`:
   ```bash
   npm start
   ```
   (atau `node server.js`)
2. Buka browser ke:
   ```
   http://127.0.0.1:4173
   ```

Tidak butuh internet, tidak butuh `npm install`, dan tidak butuh API key.

## Fitur Utama
- **Upload PNG/JPG/WebP** + **Hapus Background Otomatis** (Magic Flood-Fill dengan slider toleransi).
- **Auto-Rig Skeleton** berbasis deteksi siluet karakter (mendukung *Humanoid Depan / 3/4 RPG*, *Humanoid Samping*, dan *Monster / Slime / Pet*).
- **Geodesic Silhouette-Aware 2D Mesh Skinning**: bobot tulang mengikuti bentuk tubuh di dalam siluet agar gerakan lengan tidak menarik badan.
- **Edit Tulang Interaktif** dengan *Symmetry Mirror* (geser sendi kiri, kanan ikut rapi) + **Simpan/Muat Rig (.json)**.
- **9 Preset Animasi Game RPG**: Idle, Walk, Run, Jump, Attack, Cast Spell, Hurt, Death, Victory + slider kecepatan, intensitas, squash & stretch, dan **Mode Pixel Art (Crisp)**.
- **Test Play RPG Arena**: coba langsung gerak karaktermu pakai **WASD / Panah**, **Shift** (lari), **Space** (lompat), **J** (serang), **K** (sihir).
- **Export Sprite Sheet PNG + JSON Atlas**: pilih 1 animasi, Paket RPG Inti (5 baris), atau Semua Animasi (9 baris Master Sheet) dengan format JSON untuk **Phaser/Pixi/Web**, **Godot**, dan **Unity**.
