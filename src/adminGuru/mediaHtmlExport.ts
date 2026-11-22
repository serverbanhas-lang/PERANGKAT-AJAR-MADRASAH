import type { LearningMediaItem, MediaThemeKey } from '../types/adminGuru';

function safeJsonEmbed(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function escapeHtmlText(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildStandaloneHtml5PowerPoint(
  media: LearningMediaItem,
  themeOverride?: MediaThemeKey
): string {
  const initialTheme: MediaThemeKey = themeOverride || media.tema || 'zamrud';
  const safePayload = safeJsonEmbed({
    ...media,
    tema: initialTheme,
  });

  const safeTitle = escapeHtmlText(media.judul || 'Presentasi Pembelajaran');

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle} — Presentasi PowerPoint HTML5</title>
<style>
  :root {
    --bg-app: #0c1917;
    --bg-bar: #071210;
    --bg-side: #0f211e;
    --slide-bg: #fffdf8;
    --slide-ink: #142723;
    --slide-muted: #526761;
    --accent: #0f6b58;
    --accent-soft: #e2f2ee;
    --gold: #c68a0f;
    --gold-soft: #fcf3db;
    --border: #d7e2dc;
  }
  [data-theme="biru"] {
    --bg-app: #0c1629;
    --bg-bar: #08101e;
    --bg-side: #111e35;
    --slide-bg: #ffffff;
    --slide-ink: #0f172a;
    --slide-muted: #475569;
    --accent: #1d4ed8;
    --accent-soft: #e0edff;
    --gold: #0284c7;
    --gold-soft: #e0f2fe;
    --border: #cbd5e1;
  }
  [data-theme="emas"] {
    --bg-app: #1f170c;
    --bg-bar: #140e06;
    --bg-side: #291e0f;
    --slide-bg: #fffcf4;
    --slide-ink: #291d0c;
    --slide-muted: #6b573b;
    --accent: #9a6700;
    --accent-soft: #faecc8;
    --gold: #b45309;
    --gold-soft: #fef3c7;
    --border: #e5d4b1;
  }
  [data-theme="gelap"] {
    --bg-app: #090b10;
    --bg-bar: #05060a;
    --bg-side: #111622;
    --slide-bg: #141a28;
    --slide-ink: #f1f5f9;
    --slide-muted: #94a3b8;
    --accent: #10b981;
    --accent-soft: #132b26;
    --gold: #f59e0b;
    --gold-soft: #2a2112;
    --border: #263147;
  }

  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; font-family: "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; background: var(--bg-app); color: #f1f5f9; }
  .app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

  .topbar {
    display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
    padding: 8px 16px; background: var(--bg-bar); border-bottom: 1px solid rgba(255,255,255,0.12);
  }
  .brand-wrap { min-width: 180px; }
  .brand-meta { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #f0cf82; font-weight: 700; }
  .brand-title { font-size: 14px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 420px; }

  .controls { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .btn, .sel {
    appearance: none; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08);
    color: #fff; padding: 6px 10px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer;
  }
  .sel option { color: #111; background: #fff; }
  .btn:hover, .sel:hover { background: rgba(255,255,255,0.16); }
  .btn.active { background: var(--gold); color: #111; border-color: var(--gold); }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .workspace { flex: 1; display: flex; min-height: 0; overflow: hidden; }
  .sidebar {
    width: 245px; flex-shrink: 0; background: var(--bg-side); border-right: 1px solid rgba(255,255,255,0.1);
    overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px;
  }
  .sidebar.hidden { display: none; }
  .thumb {
    width: 100%; text-align: left; border: 2px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04);
    border-radius: 9px; padding: 8px 10px; color: #dbe7e4; cursor: pointer; transition: all .15s;
  }
  .thumb:hover { background: rgba(255,255,255,0.1); }
  .thumb.on { border-color: #f0cf82; background: rgba(240,207,130,0.14); color: #fff; }
  .thumb-top { display: flex; justify-content: space-between; font-size: 10px; color: #f0cf82; font-weight: 700; margin-bottom: 3px; }
  .thumb-title { font-size: 12px; font-weight: 600; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

  .stage-wrap {
    flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 16px 20px; overflow-y: auto; gap: 12px;
  }
  .slide-frame {
    width: 100%; max-width: 1040px; min-height: 460px; aspect-ratio: 16 / 9;
    background: var(--slide-bg); color: var(--slide-ink); border-radius: 16px;
    border: 2px solid var(--gold); box-shadow: 0 20px 55px rgba(0,0,0,0.45);
    padding: 28px 36px; display: flex; flex-direction: column; overflow-y: auto; position: relative;
  }
  .slide-frame.layout-pembuka {
    background: linear-gradient(135deg, var(--accent) 0%, #062b23 100%);
    color: #fffdf8; border-color: #f0cf82; justify-content: center;
  }
  [data-theme="biru"] .slide-frame.layout-pembuka {
    background: linear-gradient(135deg, #1d4ed8 0%, #0f172a 100%);
  }
  [data-theme="emas"] .slide-frame.layout-pembuka {
    background: linear-gradient(135deg, #9a6700 0%, #2b1d07 100%);
  }

  .anim-fade { animation: animFade .32s ease; }
  .anim-slide { animation: animSlide .32s cubic-bezier(.2,.8,.2,1); }
  .anim-zoom { animation: animZoom .3s ease; }
  @keyframes animFade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes animSlide { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes animZoom { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: scale(1); } }

  .slide-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-bottom: 10px; border-bottom: 1px solid var(--border); margin-bottom: 14px; }
  .layout-pembuka .slide-head { border-bottom-color: rgba(255,255,255,0.22); }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; background: var(--accent-soft); color: var(--accent); }
  .layout-pembuka .badge { background: rgba(255,255,255,0.18); color: #f6dc9b; }
  .slide-num { font-size: 12px; font-weight: 700; color: var(--gold); }

  .slide-title { margin: 0 0 10px; font-size: clamp(22px, 3vw, 34px); line-height: 1.18; font-weight: 800; color: var(--accent); }
  .layout-pembuka .slide-title { color: #fff; font-size: clamp(28px, 3.6vw, 42px); }
  .slide-summary { margin: 0 0 14px; font-size: clamp(14px, 1.45vw, 18px); line-height: 1.55; color: var(--slide-ink); opacity: .94; }
  .layout-pembuka .slide-summary { color: #e8f3ef; }

  .points-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; margin-top: 4px; }
  .point-card {
    display: flex; align-items: flex-start; gap: 10px; padding: 11px 13px; border-radius: 10px;
    background: var(--accent-soft); border: 1px solid var(--border); transition: opacity .25s, transform .25s;
  }
  .layout-pembuka .point-card { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2); color: #fff; }
  .point-card.dim { opacity: 0.14; transform: translateY(6px); }
  .point-num { width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .layout-pembuka .point-num { background: #f0cf82; color: #111; }
  .point-text { font-size: 14px; font-weight: 500; line-height: 1.45; }

  .flow-wrap { display: flex; flex-wrap: wrap; align-items: stretch; gap: 10px; margin: 8px 0 12px; }
  .flow-step {
    flex: 1 1 160px; padding: 12px; border-radius: 10px; background: var(--accent-soft); border: 1.5px solid var(--accent);
    display: flex; flex-direction: column; gap: 4px;
  }
  .flow-idx { font-size: 11px; font-weight: 800; color: var(--accent); text-transform: uppercase; }
  .flow-arrow { align-self: center; font-size: 18px; font-weight: 800; color: var(--gold); }

  .cmp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 6px 0 12px; }
  @media (max-width: 700px) { .cmp-grid { grid-template-columns: 1fr; } }
  .cmp-col { padding: 14px; border-radius: 11px; border: 1.5px solid var(--border); background: var(--accent-soft); }
  .cmp-col.right { background: var(--gold-soft); }
  .cmp-col h4 { margin: 0 0 8px; font-size: 15px; color: var(--accent); }
  .cmp-col.right h4 { color: var(--gold); }
  .cmp-col ul { margin: 0; padding-left: 18px; font-size: 13.5px; line-height: 1.5; }

  .quiz-box { margin-top: auto; padding: 12px 14px; border-radius: 11px; background: var(--gold-soft); border: 1px solid var(--gold); }
  .layout-pembuka .quiz-box { background: rgba(255,255,255,0.14); border-color: #f0cf82; color: #fff; }
  .quiz-label { font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--gold); margin-bottom: 3px; }
  .quiz-q { font-size: 14.5px; font-weight: 700; }
  .quiz-ans { margin-top: 8px; padding: 8px 10px; border-radius: 8px; background: rgba(255,255,255,0.75); color: #142723; font-size: 13px; display: none; }
  [data-theme="gelap"] .quiz-ans { background: rgba(15,23,42,0.85); color: #f8fafc; }
  .quiz-ans.show { display: block; }

  .notes-bar {
    width: 100%; max-width: 1040px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14);
    border-radius: 10px; padding: 10px 14px; font-size: 12.5px; color: #dbe7e4; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  }
  .notes-bar.hidden { display: none; }
  @media (max-width: 768px) { .sidebar { display: none; } .notes-bar { grid-template-columns: 1fr; } }

  .bottombar {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 9px 16px; background: var(--bg-bar); border-top: 1px solid rgba(255,255,255,0.12);
  }
  .progress-wrap { flex: 1; max-width: 420px; height: 7px; border-radius: 999px; background: rgba(255,255,255,0.15); overflow: hidden; }
  .progress-fill { height: 100%; background: #f0cf82; transition: width .25s; }
  .custom-html5 { width: 100%; height: 280px; border: 1px solid var(--border); border-radius: 10px; background: #fff; margin-top: 8px; }
</style>
</head>
<body data-theme="${escapeHtmlText(initialTheme)}">
<div class="app">
  <header class="topbar">
    <div class="brand-wrap">
      <div class="brand-meta" id="metaLine"></div>
      <div class="brand-title" id="deckTitle"></div>
    </div>
    <div class="controls">
      <button class="btn" id="btnSidebar" type="button">Daftar Slide</button>
      <select class="sel" id="selTheme" title="Pilih Tema Warna">
        <option value="zamrud">Tema: Zamrud Madrasah</option>
        <option value="biru">Tema: Biru Akademik</option>
        <option value="emas">Tema: Emas Klasik</option>
        <option value="gelap">Tema: Gelap Modern</option>
      </select>
      <select class="sel" id="selAnim" title="Efek Transisi Slide">
        <option value="slide">Transisi: Geser</option>
        <option value="fade">Transisi: Pudar</option>
        <option value="zoom">Transisi: Perbesar</option>
      </select>
      <button class="btn" id="btnStepMode" type="button">Poin Bertahap: Mati</button>
      <button class="btn active" id="btnNotes" type="button">Catatan Guru</button>
      <button class="btn" id="btnFull" type="button">Layar Penuh (F)</button>
    </div>
  </header>

  <div class="workspace">
    <aside class="sidebar" id="sidebar"></aside>
    <main class="stage-wrap">
      <section class="slide-frame" id="slideFrame"></section>
      <div class="notes-bar" id="notesBar"></div>
    </main>
  </div>

  <footer class="bottombar">
    <div class="controls">
      <button class="btn" id="btnFirst" type="button">&laquo; Awal</button>
      <button class="btn" id="btnPrev" type="button">&lsaquo; Sebelumnya</button>
    </div>
    <div class="progress-wrap"><div class="progress-fill" id="progressFill"></div></div>
    <div class="controls">
      <span id="slideCounter" style="font-size:12px;font-weight:700;color:#f0cf82;margin-right:6px;"></span>
      <button class="btn" id="btnReveal" type="button" style="display:none;">Tampilkan Poin Berikutnya</button>
      <button class="btn active" id="btnNext" type="button">Berikutnya &rsaquo;</button>
      <button class="btn" id="btnLast" type="button">Akhir &raquo;</button>
    </div>
  </footer>
</div>

<script id="presentation-data" type="application/json">${safePayload}</script>
<script>
(function () {
  var raw = document.getElementById('presentation-data').textContent || '{}';
  var media = JSON.parse(raw);
  var slides = Array.isArray(media.slides) ? media.slides : [];
  var cur = 0;
  var anim = 'slide';
  var stepMode = false;
  var revealedCount = 999;
  var showNotes = true;
  var showAnswer = false;

  var tipeLabels = {
    pembuka: 'Pembuka & Pemantik',
    tujuan: 'Tujuan Belajar',
    konsep: 'Konsep Kunci',
    uraian: 'Uraian Materi',
    contoh: 'Contoh Penerapan',
    visual: 'Visual / Diagram',
    kbc: 'Integrasi KBC',
    'kuis-cepat': 'Cek Pemahaman',
    refleksi: 'Refleksi',
    rangkuman: 'Rangkuman'
  };

  var el = function (id) { return document.getElementById(id); };
  var mk = function (tag, cls, txt) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (txt !== undefined && txt !== null) node.textContent = String(txt);
    return node;
  };

  el('metaLine').textContent = [media.mapel || 'Madrasah Aliyah', media.kelasLabel || 'Kelas', slides.length + ' Slide'].join(' · ');
  el('deckTitle').textContent = media.judul || 'Presentasi Pembelajaran';
  el('selTheme').value = media.tema || 'zamrud';
  document.body.setAttribute('data-theme', media.tema || 'zamrud');

  function renderSidebar() {
    var sb = el('sidebar');
    sb.innerHTML = '';
    slides.forEach(function (sl, idx) {
      var btn = mk('button', 'thumb' + (idx === cur ? ' on' : ''));
      btn.type = 'button';
      var top = mk('div', 'thumb-top');
      top.appendChild(mk('span', '', 'SLIDE ' + (idx + 1)));
      top.appendChild(mk('span', '', tipeLabels[sl.tipe] || sl.tipe || 'Materi'));
      btn.appendChild(top);
      btn.appendChild(mk('div', 'thumb-title', sl.judulSlide || ('Slide ' + (idx + 1))));
      btn.addEventListener('click', function () { goTo(idx); });
      sb.appendChild(btn);
    });
  }

  function renderSlide() {
    var sl = slides[cur];
    if (!sl) return;
    var frame = el('slideFrame');
    var layout = sl.layout || 'standar';
    frame.className = 'slide-frame layout-' + layout + ' anim-' + anim;
    frame.innerHTML = '';

    var head = mk('div', 'slide-head');
    head.appendChild(mk('span', 'badge', tipeLabels[sl.tipe] || sl.tipe || 'Slide'));
    head.appendChild(mk('span', 'slide-num', 'Slide ' + (cur + 1) + ' / ' + slides.length));
    frame.appendChild(head);

    frame.appendChild(mk('h1', 'slide-title', sl.judulSlide || ''));
    if (sl.ringkasan) {
      frame.appendChild(mk('p', 'slide-summary', sl.ringkasan));
    }

    if (Array.isArray(sl.diagramLangkah) && sl.diagramLangkah.length > 0) {
      var flow = mk('div', 'flow-wrap');
      sl.diagramLangkah.forEach(function (stepText, idx) {
        var card = mk('div', 'flow-step');
        card.appendChild(mk('div', 'flow-idx', 'Tahap ' + (idx + 1)));
        card.appendChild(mk('div', 'point-text', stepText));
        flow.appendChild(card);
        if (idx < sl.diagramLangkah.length - 1) {
          flow.appendChild(mk('div', 'flow-arrow', '→'));
        }
      });
      frame.appendChild(flow);
    }

    if (sl.perbandingan && (sl.perbandingan.isiKiri?.length || sl.perbandingan.isiKanan?.length)) {
      var cmp = mk('div', 'cmp-grid');
      var left = mk('div', 'cmp-col');
      left.appendChild(mk('h4', '', sl.perbandingan.judulKiri || 'Aspek A'));
      var ulL = mk('ul');
      (sl.perbandingan.isiKiri || []).forEach(function (t) { ulL.appendChild(mk('li', '', t)); });
      left.appendChild(ulL);
      cmp.appendChild(left);

      var right = mk('div', 'cmp-col right');
      right.appendChild(mk('h4', '', sl.perbandingan.judulKanan || 'Aspek B'));
      var ulR = mk('ul');
      (sl.perbandingan.isiKanan || []).forEach(function (t) { ulR.appendChild(mk('li', '', t)); });
      right.appendChild(ulR);
      cmp.appendChild(right);
      frame.appendChild(cmp);
    }

    var pts = Array.isArray(sl.poinUtama) ? sl.poinUtama : [];
    if (pts.length > 0) {
      var list = mk('div', 'points-list');
      pts.forEach(function (pt, pIdx) {
        var visible = !stepMode || pIdx < revealedCount;
        var card = mk('div', 'point-card' + (visible ? '' : ' dim'));
        card.appendChild(mk('div', 'point-num', String(pIdx + 1)));
        card.appendChild(mk('div', 'point-text', pt));
        list.appendChild(card);
      });
      frame.appendChild(list);
    }

    if (sl.html5) {
      var iframe = document.createElement('iframe');
      iframe.className = 'custom-html5';
      iframe.setAttribute('sandbox', 'allow-scripts');
      iframe.srcdoc = sl.html5;
      frame.appendChild(iframe);
    }

    if (sl.pertanyaanInteraktif) {
      var qBox = mk('div', 'quiz-box');
      qBox.appendChild(mk('div', 'quiz-label', 'Pertanyaan Interaktif Kelas'));
      qBox.appendChild(mk('div', 'quiz-q', sl.pertanyaanInteraktif));
      if (sl.jawabanInteraktif) {
        var ansDiv = mk('div', 'quiz-ans' + (showAnswer ? ' show' : ''), 'Kunci / Arah Jawaban: ' + sl.jawabanInteraktif);
        var toggleBtn = mk('button', 'btn', showAnswer ? 'Sembunyikan Jawaban' : 'Tampilkan Jawaban');
        toggleBtn.type = 'button';
        toggleBtn.style.marginTop = '8px';
        toggleBtn.style.color = '#142723';
        toggleBtn.style.background = '#fff';
        toggleBtn.addEventListener('click', function () {
          showAnswer = !showAnswer;
          renderSlide();
        });
        qBox.appendChild(toggleBtn);
        qBox.appendChild(ansDiv);
      }
      frame.appendChild(qBox);
    }

    var nb = el('notesBar');
    nb.innerHTML = '';
    nb.className = 'notes-bar' + (showNotes && (sl.visualIde || sl.catatanGuru) ? '' : ' hidden');
    var n1 = mk('div');
    n1.appendChild(mk('strong', '', 'Saran Visual / Bagan: '));
    n1.appendChild(document.createTextNode(sl.visualIde || '-'));
    var n2 = mk('div');
    n2.appendChild(mk('strong', '', 'Catatan Guru: '));
    n2.appendChild(document.createTextNode(sl.catatanGuru || '-'));
    nb.appendChild(n1);
    nb.appendChild(n2);

    el('slideCounter').textContent = (cur + 1) + ' / ' + slides.length;
    el('progressFill').style.width = ((cur + 1) / Math.max(1, slides.length)) * 100 + '%';
    el('btnFirst').disabled = cur === 0;
    el('btnPrev').disabled = cur === 0;
    el('btnNext').disabled = cur >= slides.length - 1;
    el('btnLast').disabled = cur >= slides.length - 1;
    var revealBtn = el('btnReveal');
    revealBtn.style.display = stepMode && revealedCount < pts.length ? 'inline-block' : 'none';
    renderSidebar();
  }

  function goTo(index) {
    if (!slides.length) return;
    cur = Math.max(0, Math.min(slides.length - 1, index));
    showAnswer = false;
    revealedCount = stepMode ? 1 : 999;
    renderSlide();
  }

  function nextAction() {
    var sl = slides[cur];
    var pts = sl && Array.isArray(sl.poinUtama) ? sl.poinUtama : [];
    if (stepMode && revealedCount < pts.length) {
      revealedCount++;
      renderSlide();
      return;
    }
    if (cur < slides.length - 1) goTo(cur + 1);
  }

  el('btnSidebar').addEventListener('click', function () { el('sidebar').classList.toggle('hidden'); });
  el('selTheme').addEventListener('change', function (e) { document.body.setAttribute('data-theme', e.target.value); });
  el('selAnim').addEventListener('change', function (e) { anim = e.target.value; renderSlide(); });
  el('btnStepMode').addEventListener('click', function () {
    stepMode = !stepMode;
    revealedCount = stepMode ? 1 : 999;
    this.textContent = 'Poin Bertahap: ' + (stepMode ? 'Aktif' : 'Mati');
    this.classList.toggle('active', stepMode);
    renderSlide();
  });
  el('btnNotes').addEventListener('click', function () {
    showNotes = !showNotes;
    this.classList.toggle('active', showNotes);
    renderSlide();
  });
  el('btnFull').addEventListener('click', function () {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen && document.exitFullscreen();
    }
  });
  el('btnFirst').addEventListener('click', function () { goTo(0); });
  el('btnPrev').addEventListener('click', function () { goTo(cur - 1); });
  el('btnNext').addEventListener('click', nextAction);
  el('btnLast').addEventListener('click', function () { goTo(slides.length - 1); });
  el('btnReveal').addEventListener('click', nextAction);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextAction(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(cur - 1); }
    else if (e.key === 'Home') { goTo(0); }
    else if (e.key === 'End') { goTo(slides.length - 1); }
    else if (e.key === 'f' || e.key === 'F') { el('btnFull').click(); }
    else if (e.key === 'n' || e.key === 'N') { el('btnNotes').click(); }
  });

  renderSlide();
})();
</script>
</body>
</html>`;
}
