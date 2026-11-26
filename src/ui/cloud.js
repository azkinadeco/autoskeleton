// AutoSprite Cloud (opsional, butuh internet + API key). Key hanya disimpan di localStorage browser ini.
const LS_KEY = 'as_api_key';
const LS_CHAR = 'as_last_char';
const LS_SPENT = 'as_spent_est';

const TIER_COST = { turbo: 5, pro: 15, max: 35 };
const KINDS = ['idle', 'walk', 'run', 'attack', 'jump', 'death'];

function apiBase() {
  return location.protocol.startsWith('http') ? '/api/as' : 'https://www.autosprite.io/api/v1';
}

export function initCloud({ getSpriteBlob, getName }) {
  const $ = (id) => document.getElementById(id);
  const modal = $('cloudModal');
  if (!modal) return;

  const els = {
    open: $('btnOpenCloud'), close: $('btnCloseCloud'), badge: $('lblCredits'),
    key: $('inpApiKey'), check: $('btnCheckCredits'), info: $('lblCloudInfo'),
    upload: $('btnCloudUpload'), humanoid: $('chkHumanoid'), charInfo: $('lblCloudChar'),
    kinds: $('cloudKinds'), extra: $('inpExtraKind'), tier: $('selTier'),
    estimate: $('lblEstimate'), gen: $('btnCloudGenerate'), log: $('cloudLog'), links: $('cloudLinks'),
  };

  let credits = null;
  let charId = localStorage.getItem(LS_CHAR) || '';
  els.key.value = localStorage.getItem(LS_KEY) || '';

  const log = (msg) => { els.log.textContent = `${new Date().toLocaleTimeString()}  ${msg}\n` + els.log.textContent; };

  async function api(path, opts = {}) {
    const key = els.key.value.trim();
    if (!key.startsWith('vspk_')) throw new Error('API key harus diawali vspk_');
    let res;
    try {
      res = await fetch(apiBase() + path, { ...opts, headers: { 'x-api-key': key, ...(opts.headers || {}) } });
    } catch (e) {
      throw new Error('Gagal terhubung. Buka lewat http://127.0.0.1:4173 (node server.js) dan pastikan internet aktif.');
    }
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${data.error?.message || data.error || data.message || text.slice(0, 160)}`);
    return data;
  }

  function selectedKinds() {
    const list = [...els.kinds.querySelectorAll('input:checked')].map((i) => i.value);
    const extra = els.extra.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    return [...new Set([...list, ...extra])].slice(0, 10);
  }

  function updateEstimate() {
    const n = selectedKinds().length;
    const cost = n * (TIER_COST[els.tier.value] || 5);
    const spent = Number(localStorage.getItem(LS_SPENT) || 0);
    els.estimate.innerHTML = `${n} animasi × ${TIER_COST[els.tier.value]} = <b>${cost} kredit</b>` +
      (credits != null ? ` • saldo ${credits} → sisa ${credits - cost}` : '') +
      ` • estimasi terpakai dari app ini: ${spent}`;
    els.gen.disabled = n === 0 || !charId;
  }

  function renderBadge() {
    els.badge.textContent = credits == null ? '' : `${credits}`;
    els.badge.classList.toggle('hidden', credits == null);
  }

  async function checkCredits() {
    localStorage.setItem(LS_KEY, els.key.value.trim());
    els.info.textContent = 'Mengecek...';
    try {
      const d = await api('/account');
      credits = d.credits ?? d.balance ?? null;
      els.info.textContent = `Saldo: ${credits} kredit${d.plan ? ' • plan ' + d.plan : ''}`;
      renderBadge();
    } catch (e) { els.info.textContent = '⚠ ' + e.message; }
    updateEstimate();
  }

  els.kinds.innerHTML = KINDS.map((k) => `<label class="toggle-label"><input type="checkbox" value="${k}" ${k === 'walk' ? 'checked' : ''}/><span>${k}</span></label>`).join('');
  els.kinds.addEventListener('change', updateEstimate);
  els.extra.addEventListener('input', updateEstimate);
  els.tier.addEventListener('change', updateEstimate);
  els.check.addEventListener('click', checkCredits);
  els.open.addEventListener('click', () => { modal.classList.remove('hidden'); updateEstimate(); if (els.key.value && credits == null) checkCredits(); });
  els.close.addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
  els.charInfo.textContent = charId ? `Karakter tersimpan: ${charId}` : 'Belum ada karakter di cloud';

  els.upload.addEventListener('click', async () => {
    els.upload.disabled = true;
    try {
      const blob = await getSpriteBlob();
      if (!blob) throw new Error('Belum ada sprite.');
      const fd = new FormData();
      fd.append('name', (getName() || 'hero').slice(0, 100));
      fd.append('image', blob, 'sprite.png');
      fd.append('isHumanoid', els.humanoid.checked ? 'true' : 'false');
      const d = await api('/characters', { method: 'POST', body: fd });
      charId = d.id || d.character?.id || d.characterId || '';
      if (!charId) throw new Error('ID karakter tidak ditemukan: ' + JSON.stringify(d).slice(0, 160));
      localStorage.setItem(LS_CHAR, charId);
      els.charInfo.textContent = `Karakter tersimpan: ${charId}`;
      log('Upload karakter OK (gratis): ' + charId);
    } catch (e) { log('⚠ ' + e.message); }
    els.upload.disabled = false;
    updateEstimate();
  });

  function showLinks(obj) {
    const urls = [...new Set(JSON.stringify(obj).match(/https?:\/\/[^"\\\s]+/g) || [])];
    els.links.innerHTML = urls.map((u) => `<a href="${u}" target="_blank" rel="noopener">${u.split('/').pop().split('?')[0] || 'file'}</a>`).join('');
  }

  async function poll(jobId) {
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const j = await api('/jobs/' + jobId);
      const st = j.status || j.state || '?';
      log(`Job ${jobId}: ${st}`);
      if (/succe|complete|done/i.test(st)) { showLinks(j); log('Selesai. Link unduhan ada di bawah.'); return; }
      if (/fail|error|cancel/i.test(st)) throw new Error('Job gagal: ' + JSON.stringify(j).slice(0, 200));
    }
    throw new Error('Timeout menunggu job.');
  }

  els.gen.addEventListener('click', async () => {
    const kinds = selectedKinds();
    const tier = els.tier.value;
    const cost = kinds.length * TIER_COST[tier];
    if (credits != null && cost > credits) { log(`⚠ Kredit kurang (${cost} > ${credits}).`); return; }
    if (!confirm(`Generate ${kinds.join(', ')} (${tier})?\nBiaya ≈ ${cost} kredit.`)) return;
    els.gen.disabled = true;
    try {
      const d = await api(`/characters/${charId}/spritesheets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animations: kinds.map((kind) => ({ kind })), videoTier: tier }),
      });
      localStorage.setItem(LS_SPENT, String(Number(localStorage.getItem(LS_SPENT) || 0) + cost));
      const jobId = d.jobId || d.job?.id || d.id;
      log('Job dimulai: ' + jobId);
      await poll(jobId);
    } catch (e) { log('⚠ ' + e.message); }
    await checkCredits();
  });

  if (els.key.value) checkCredits();
}
