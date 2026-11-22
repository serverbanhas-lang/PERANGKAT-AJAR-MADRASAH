import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Download,
  FileText,
  Layers,
  MessageCircleQuestion,
  MonitorPlay,
  Plus,
  Printer,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  buildMediaExternalPrompt,
  copyTextToClipboard,
  createUid,
  getActiveMapelList,
  getAdminGuruState,
  getAppApi,
  getBahanAjarSources,
  getLegacyState,
  normalizeMediaPayload,
  parseImportedMediaJson,
  updateAdminGuruState,
} from './bridge';
import type {
  LearningMediaItem,
  MediaPembelajaranJenis,
  MediaSlideItem,
  MediaSlideTipe,
} from '../types/adminGuru';

const JENIS_MEDIA_LABELS: Record<MediaPembelajaranJenis, string> = {
  'slide-presentasi': 'Slide Presentasi Kelas',
  'peta-konsep': 'Peta Konsep & Alur Materi',
  'kartu-ajar': 'Kartu Ajar Interaktif',
  'studi-kasus': 'Studi Kasus & Diskusi',
};

const SLIDE_TIPE_LABELS: Record<MediaSlideTipe, string> = {
  pembuka: 'Pembuka & Pemantik',
  tujuan: 'Tujuan Belajar',
  konsep: 'Konsep Kunci',
  uraian: 'Uraian Materi',
  contoh: 'Contoh Penerapan',
  visual: 'Visual / Diagram',
  kbc: 'Integrasi KBC',
  'kuis-cepat': 'Cek Pemahaman',
  refleksi: 'Refleksi',
  rangkuman: 'Rangkuman',
};

const SAMPLE_MEDIA_JSON = `{
  "judul": "Media Interaktif: Memahami Konsep Inti",
  "subjudul": "Pembelajaran Mendalam Berbasis Cinta",
  "tujuanPembelajaran": "Peserta didik mampu menjelaskan konsep dan menerapkannya dalam kehidupan nyata.",
  "integrasiKbc": "Menumbuhkan cinta ilmu dan kepedulian kepada sesama.",
  "aktivitasKelas": "Diskusi berpasangan 10 menit membahas studi kasus pada slide 4.",
  "glosarium": [
    { "istilah": "Konsep Kunci", "makna": "Gagasan pokok yang menjadi landasan materi." }
  ],
  "slides": [
    {
      "judulSlide": "Mari Berpikir Sejenak",
      "tipe": "pembuka",
      "ringkasan": "Pernahkah kalian mengamati penerapan materi ini di sekitar lingkungan madrasah?",
      "poinUtama": ["Amati fenomena sehari-hari", "Catat 2 pertanyaan awal", "Bagikan kepada teman sebangku"],
      "visualIde": "Foto atau ilustrasi situasi nyata di lingkungan madrasah",
      "catatanGuru": "Berikan waktu 2 menit agar siswa menyampaikan pendapat awal.",
      "pertanyaanInteraktif": "Apa contoh paling dekat yang pernah kalian temui?"
    }
  ]
}`;

export const MediaPembelajaranView: React.FC = () => {
  const [adminState, setAdminState] = useState(() => getAdminGuruState());
  const [dbTick, setDbTick] = useState(0);
  const legacy = useMemo(() => {
    void dbTick;
    return getLegacyState();
  }, [dbTick]);
  const api = getAppApi();

  const bahanSources = useMemo(() => getBahanAjarSources(legacy), [legacy]);
  const mapelList = useMemo(() => getActiveMapelList(legacy), [legacy]);

  const [selectedMediaId, setSelectedMediaId] = useState<string>(
    adminState.mediaPembelajaran[0]?.id || ''
  );

  // Sumber Materi Mendalam & Konfigurasi Media
  const [selectedUnitId, setSelectedUnitId] = useState<string>(bahanSources[0]?.unitId || '');
  const [customMateriText, setCustomMateriText] = useState<string>(
    bahanSources[0]?.plainText || ''
  );
  const [judulMedia, setJudulMedia] = useState<string>(
    bahanSources[0] ? `Media Ajar: ${bahanSources[0].judul}` : 'Media Pembelajaran Interaktif'
  );
  const [jenisMedia, setJenisMedia] = useState<MediaPembelajaranJenis>('slide-presentasi');
  const [selectedKelasId, setSelectedKelasId] = useState<string>(
    adminState.classes[0]?.id || 'kls_10_a'
  );
  const [selectedMapel, setSelectedMapel] = useState<string>(
    mapelList[0] || 'Mata Pelajaran Utama'
  );
  const [jumlahSlide, setJumlahSlide] = useState<number>(8);
  const [durasiMenit, setDurasiMenit] = useState<number>(45);

  // Mode Input: AI Langsung vs Salin Prompt & Tempel JSON
  const [creatorMode, setCreatorMode] = useState<'ai' | 'prompt-json'>('ai');
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [pastedJson, setPastedJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  // Mode Presentasi Layar Penuh
  const [presentingIndex, setPresentingIndex] = useState<number | null>(null);
  const [showTeacherNotesInSlide, setShowTeacherNotesInSlide] = useState(true);

  const selectedSource = useMemo(
    () => bahanSources.find((b) => b.unitId === selectedUnitId),
    [bahanSources, selectedUnitId]
  );

  const activeMedia: LearningMediaItem | undefined = useMemo(
    () => adminState.mediaPembelajaran.find((m) => m.id === selectedMediaId),
    [adminState.mediaPembelajaran, selectedMediaId]
  );

  // Sinkronkan sumber database awal jika unit terpilih belum terisi
  const handleSelectBahanSource = (unitId: string) => {
    setSelectedUnitId(unitId);
    const found = bahanSources.find((b) => b.unitId === unitId);
    if (found) {
      setCustomMateriText(found.plainText);
      setJudulMedia(`Media Ajar: ${found.judul}`);
    }
  };

  const handleRefreshDatabase = () => {
    setDbTick((t) => t + 1);
    const latest = getLegacyState();
    const latestSources = getBahanAjarSources(latest);
    const target = latestSources.find((b) => b.unitId === selectedUnitId) || latestSources[0];
    if (target) {
      setSelectedUnitId(target.unitId);
      setCustomMateriText(target.plainText);
      setJudulMedia(`Media Ajar: ${target.judul}`);
      api?.toast(
        target.hasDeepBahanAjar
          ? `Materi Mendalam "${target.judul}" berhasil ditarik dari database.`
          : `Data pertemuan "${target.judul}" dimuat dari database.`
      );
    } else {
      api?.toast('Belum ada pertemuan/materi pada menu ATP & Bahan Ajar Mendalam.');
    }
  };

  const externalPrompt = useMemo(() => {
    const kelasObj = adminState.classes.find((c) => c.id === selectedKelasId);
    return buildMediaExternalPrompt({
      materiText: customMateriText,
      judul: judulMedia,
      mapel: selectedMapel,
      kelas: kelasObj ? `${kelasObj.nama} (Kelas ${kelasObj.tingkat})` : '',
      tp: selectedSource?.tpLabel || '',
      kbc: selectedSource?.kbcTema || '',
      jenisMedia,
      jumlahSlide,
    });
  }, [
    adminState.classes,
    customMateriText,
    jenisMedia,
    judulMedia,
    jumlahSlide,
    selectedKelasId,
    selectedMapel,
    selectedSource,
  ]);

  const saveNewMediaItem = (item: LearningMediaItem) => {
    const updated = updateAdminGuruState((prev) => ({
      ...prev,
      mediaPembelajaran: [item, ...(prev.mediaPembelajaran || [])],
    }));
    setAdminState(updated);
    setSelectedMediaId(item.id);
  };

  const handleGenerateWithAI = async () => {
    setAiError(null);
    if (!customMateriText.trim()) {
      const msg = 'Tarik materi dari database atau isi teks materi terlebih dahulu.';
      setAiError(msg);
      api?.toast(msg);
      return;
    }
    setGenerating(true);
    try {
      const kelasObj = adminState.classes.find((c) => c.id === selectedKelasId);
      const res = await fetch('/api/generate-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materiText: customMateriText,
          judul: judulMedia,
          mapel: selectedMapel,
          kelas: kelasObj ? `${kelasObj.nama} (Kelas ${kelasObj.tingkat})` : '',
          tp: selectedSource?.tpLabel || '',
          kbc: selectedSource?.kbcTema || '',
          jenisMedia,
          jumlahSlide,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Gagal menyusun media pembelajaran (HTTP ${res.status})`);
      }

      const normalized = normalizeMediaPayload(data.media || data, {
        judul: judulMedia.trim() || 'Media Pembelajaran Interaktif',
        jenis: jenisMedia,
        mapel: selectedMapel,
        kelasId: selectedKelasId,
        kelasLabel: kelasObj?.nama || '',
        unitId: selectedUnitId || undefined,
        tpLabel: selectedSource?.tpLabel || '',
        durasiMenit,
      });

      saveNewMediaItem(normalized);
      api?.toast(`Berhasil menyusun ${normalized.slides.length} slide media pembelajaran!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menghubungi Gemini AI.';
      setAiError(msg);
      api?.toast(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!customMateriText.trim()) {
      api?.toast('Pilih Materi Mendalam dari database atau isi teks materi dahulu.');
      return;
    }
    const ok = await copyTextToClipboard(externalPrompt);
    if (ok) {
      api?.toast('Prompt Media Pembelajaran tersalin! Tempel ke Gemini atau ChatGPT, lalu salin JSON hasilnya ke sini.');
    } else {
      setShowPromptPreview(true);
      api?.toast('Klik kanan dan salin prompt dari kotak pratinjau di bawah.');
    }
  };

  const handleDownloadPromptTxt = () => {
    const blob = new Blob([externalPrompt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Prompt_Media_${(judulMedia || 'Pembelajaran').replace(/[^A-Za-z0-9_-]/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 300);
  };

  const handleImportFromJson = () => {
    setJsonError(null);
    try {
      const kelasObj = adminState.classes.find((c) => c.id === selectedKelasId);
      const item = parseImportedMediaJson(pastedJson, {
        judul: judulMedia.trim() || 'Media Pembelajaran Interaktif',
        jenis: jenisMedia,
        mapel: selectedMapel,
        kelasId: selectedKelasId,
        kelasLabel: kelasObj?.nama || '',
        unitId: selectedUnitId || undefined,
        tpLabel: selectedSource?.tpLabel || '',
        durasiMenit,
      });
      saveNewMediaItem(item);
      setPastedJson('');
      api?.toast(`Media "${item.judul}" (${item.slides.length} slide) berhasil dimuat dari JSON!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'JSON tidak valid.';
      setJsonError(msg);
      api?.toast(msg);
    }
  };

  const handleUploadJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setPastedJson(text);
      setJsonError(null);
      const kelasObj = adminState.classes.find((c) => c.id === selectedKelasId);
      const item = parseImportedMediaJson(text, {
        judul: judulMedia.trim() || 'Media Pembelajaran Interaktif',
        jenis: jenisMedia,
        mapel: selectedMapel,
        kelasId: selectedKelasId,
        kelasLabel: kelasObj?.nama || '',
        unitId: selectedUnitId || undefined,
        tpLabel: selectedSource?.tpLabel || '',
        durasiMenit,
      });
      saveNewMediaItem(item);
      setPastedJson('');
      api?.toast(`File JSON berhasil diimpor (${item.slides.length} slide)!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal membaca file JSON.';
      setJsonError(msg);
      api?.toast(msg);
    } finally {
      e.target.value = '';
    }
  };

  const handleCreateManualMedia = () => {
    const kelasObj = adminState.classes.find((c) => c.id === selectedKelasId);
    const now = new Date().toISOString();
    const lines = customMateriText
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);

    const slides: MediaSlideItem[] =
      lines.length > 0
        ? lines.map((block, idx) => {
            const firstLine = block.split('\n')[0].replace(/^#+\s*/, '').slice(0, 80);
            const rest = block.split('\n').slice(1).join('\n').trim();
            return {
              id: createUid(`sl_${idx}`),
              judulSlide: firstLine || `Bagian ${idx + 1}`,
              tipe: idx === 0 ? 'pembuka' : idx === lines.length - 1 ? 'rangkuman' : 'uraian',
              ringkasan: (rest || block).slice(0, 320),
              poinUtama: block
                .split('\n')
                .map((l) => l.replace(/^[-•*]\s*/, '').trim())
                .filter((l) => l.length > 3)
                .slice(0, 4),
              visualIde: 'Tambahkan skema, diagram alur, atau gambar ilustrasi pendukung.',
              catatanGuru: 'Sampaikan poin inti dan ajak peserta didik berdiskusi.',
              pertanyaanInteraktif: idx === 0 ? 'Apa yang sudah kalian ketahui tentang topik ini?' : '',
            };
          })
        : [
            {
              id: createUid('sl_0'),
              judulSlide: judulMedia || 'Slide Pembuka',
              tipe: 'pembuka',
              ringkasan: 'Tuliskan ringkasan materi atau pemantik awal di sini.',
              poinUtama: ['Poin utama 1', 'Poin utama 2', 'Poin utama 3'],
              visualIde: 'Bagan konsep atau ilustrasi pembuka',
              catatanGuru: 'Ajak siswa mengamati dan bertanya.',
              pertanyaanInteraktif: 'Apa hubungan topik ini dengan kehidupan sehari-hari?',
            },
          ];

    const newItem: LearningMediaItem = {
      id: createUid('med'),
      judul: judulMedia.trim() || 'Media Pembelajaran Manual',
      subjudul: 'Disusun dari Materi Database',
      jenis: jenisMedia,
      mapel: selectedMapel,
      kelasId: selectedKelasId,
      kelasLabel: kelasObj?.nama || '',
      unitId: selectedUnitId || undefined,
      tujuanPembelajaran: selectedSource?.tpLabel || '',
      integrasiKbc: selectedSource?.kbcTema || '',
      aktivitasKelas: '',
      durasiMenit,
      createdAt: now,
      updatedAt: now,
      slides,
      glosarium: [],
    };
    saveNewMediaItem(newItem);
    api?.toast(`Draf media dengan ${slides.length} slide berhasil dibuat dari data materi.`);
  };

  const mutateActiveMedia = (updater: (m: LearningMediaItem) => LearningMediaItem) => {
    if (!activeMedia) return;
    const updated = updateAdminGuruState((prev) => ({
      ...prev,
      mediaPembelajaran: (prev.mediaPembelajaran || []).map((m) =>
        m.id === activeMedia.id ? { ...updater(m), updatedAt: new Date().toISOString() } : m
      ),
    }));
    setAdminState(updated);
  };

  const handleUpdateSlide = (slideId: string, patch: Partial<MediaSlideItem>) => {
    mutateActiveMedia((m) => ({
      ...m,
      slides: m.slides.map((sl) => (sl.id === slideId ? { ...sl, ...patch } : sl)),
    }));
  };

  const handleMoveSlide = (idx: number, dir: -1 | 1) => {
    if (!activeMedia) return;
    const target = idx + dir;
    if (target < 0 || target >= activeMedia.slides.length) return;
    mutateActiveMedia((m) => {
      const next = [...m.slides];
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...m, slides: next };
    });
  };

  const handleAddSlide = () => {
    mutateActiveMedia((m) => ({
      ...m,
      slides: [
        ...m.slides,
        {
          id: createUid('sl'),
          judulSlide: `Slide ${m.slides.length + 1}`,
          tipe: 'uraian',
          ringkasan: '',
          poinUtama: ['Poin penting 1', 'Poin penting 2'],
          visualIde: '',
          catatanGuru: '',
          pertanyaanInteraktif: '',
        },
      ],
    }));
  };

  const handleDeleteSlide = (slideId: string) => {
    if (!activeMedia || activeMedia.slides.length <= 1) {
      api?.toast('Media pembelajaran minimal memiliki 1 slide.');
      return;
    }
    mutateActiveMedia((m) => ({
      ...m,
      slides: m.slides.filter((sl) => sl.id !== slideId),
    }));
  };

  const handleDeleteMedia = (id: string) => {
    const updated = updateAdminGuruState((prev) => ({
      ...prev,
      mediaPembelajaran: (prev.mediaPembelajaran || []).filter((m) => m.id !== id),
    }));
    setAdminState(updated);
    if (selectedMediaId === id) {
      setSelectedMediaId(updated.mediaPembelajaran[0]?.id || '');
    }
    api?.toast('Media pembelajaran dihapus.');
  };

  const handleExportActiveJson = () => {
    if (!activeMedia) return;
    const payload = JSON.stringify(activeMedia, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Media_${activeMedia.judul.replace(/[^A-Za-z0-9_-]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 300);
    api?.toast('File JSON Media Pembelajaran diunduh.');
  };

  // Keyboard shortcut untuk mode presentasi layar penuh
  useEffect(() => {
    if (presentingIndex === null || !activeMedia) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPresentingIndex(null);
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setPresentingIndex((idx) =>
          idx === null ? null : Math.min(activeMedia.slides.length - 1, idx + 1)
        );
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPresentingIndex((idx) => (idx === null ? null : Math.max(0, idx - 1)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presentingIndex, activeMedia]);

  const currentPresentedSlide =
    presentingIndex !== null && activeMedia ? activeMedia.slides[presentingIndex] : undefined;

  return (
    <div className="max-w-[1200px] mx-auto space-y-4">
      {/* Mode Presentasi Layar Penuh (Proyektor Kelas) */}
      {presentingIndex !== null && activeMedia && currentPresentedSlide && (
        <div
          className="fixed inset-0 z-[100000] bg-[#062720] text-[#fffdf7] flex flex-col noprint"
          role="dialog"
          aria-modal="true"
        >
          {/* Top bar presentasi */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 bg-[#041d18] border-b border-[#c7a45b]/35">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-[#e6c57a] font-bold">
                {activeMedia.mapel} · {activeMedia.kelasLabel || 'Kelas'} ·{' '}
                {JENIS_MEDIA_LABELS[activeMedia.jenis]}
              </div>
              <div className="text-sm font-bold truncate text-white">{activeMedia.judul}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTeacherNotesInSlide((v) => !v)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-[#f5e7c2] cursor-pointer"
              >
                {showTeacherNotesInSlide ? 'Sembunyikan Catatan Guru' : 'Tampilkan Catatan Guru'}
              </button>
              <button
                type="button"
                onClick={() => setPresentingIndex(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#c7a45b] text-[#062720] hover:bg-[#d8b870] flex items-center gap-1 cursor-pointer"
              >
                <X className="w-4 h-4" /> Keluar Presentasi
              </button>
            </div>
          </div>

          {/* Isi slide */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-10 py-6 flex items-center justify-center">
            <div className="w-full max-w-5xl rounded-2xl bg-[#fffdf7] text-[#172a26] border-2 border-[#c7a45b] shadow-2xl p-6 sm:p-10 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e9e4d4] pb-3">
                <span className="px-3 py-1 rounded-full bg-[#e2f0e8] text-[#0b3c32] text-xs font-bold uppercase tracking-wider">
                  {SLIDE_TIPE_LABELS[currentPresentedSlide.tipe] || currentPresentedSlide.tipe}
                </span>
                <span className="text-xs font-bold text-[#9b7938]">
                  Slide {presentingIndex + 1} / {activeMedia.slides.length}
                </span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-bold font-serif text-[#0b3c32] leading-tight">
                {currentPresentedSlide.judulSlide}
              </h2>

              {currentPresentedSlide.ringkasan && (
                <p className="text-base sm:text-xl leading-relaxed text-[#253b34]">
                  {currentPresentedSlide.ringkasan}
                </p>
              )}

              {currentPresentedSlide.poinUtama.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {currentPresentedSlide.poinUtama.map((pt, pIdx) => (
                    <div
                      key={pIdx}
                      className="flex items-start gap-3 p-3.5 rounded-xl bg-[#f5f7ef] border border-[#dce5d9]"
                    >
                      <span className="w-6 h-6 rounded-full bg-[#126451] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {pIdx + 1}
                      </span>
                      <span className="text-sm sm:text-base font-medium text-[#172a26]">{pt}</span>
                    </div>
                  ))}
                </div>
              )}

              {currentPresentedSlide.pertanyaanInteraktif && (
                <div className="p-4 rounded-xl bg-[#fbf3de] border border-[#e3c87f] flex items-start gap-3">
                  <MessageCircleQuestion className="w-6 h-6 text-[#8b6416] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[#8b6416]">
                      Pertanyaan Interaktif Kelas
                    </div>
                    <div className="text-sm sm:text-base font-semibold text-[#473308] mt-0.5">
                      {currentPresentedSlide.pertanyaanInteraktif}
                    </div>
                  </div>
                </div>
              )}

              {showTeacherNotesInSlide &&
                (currentPresentedSlide.visualIde || currentPresentedSlide.catatanGuru) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#e9e4d4] text-xs">
                    {currentPresentedSlide.visualIde && (
                      <div className="p-3 rounded-lg bg-[#eef6f3] border border-[#cde2d9]">
                        <div className="font-bold text-[#0b5745] mb-0.5">
                          Saran Visual / Bagan Papan:
                        </div>
                        <div className="text-[#315449]">{currentPresentedSlide.visualIde}</div>
                      </div>
                    )}
                    {currentPresentedSlide.catatanGuru && (
                      <div className="p-3 rounded-lg bg-[#f8f9fa] border border-[#dfe5e8]">
                        <div className="font-bold text-[#33444c] mb-0.5">Catatan Penyampaian Guru:</div>
                        <div className="text-[#4a5c65]">{currentPresentedSlide.catatanGuru}</div>
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>

          {/* Bottom nav presentasi */}
          <div className="px-6 py-3.5 bg-[#041d18] border-t border-[#c7a45b]/35 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={presentingIndex === 0}
              onClick={() => setPresentingIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-sm font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Sebelumnya
            </button>

            <div className="flex flex-wrap items-center gap-1.5">
              {activeMedia.slides.map((sl, sIdx) => (
                <button
                  key={sl.id}
                  type="button"
                  onClick={() => setPresentingIndex(sIdx)}
                  title={sl.judulSlide}
                  className={`h-2.5 rounded-full transition cursor-pointer ${
                    sIdx === presentingIndex
                      ? 'w-7 bg-[#f0d28f]'
                      : 'w-2.5 bg-white/30 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              disabled={presentingIndex >= activeMedia.slides.length - 1}
              onClick={() =>
                setPresentingIndex((i) =>
                  i !== null && i < activeMedia.slides.length - 1 ? i + 1 : i
                )
              }
              className="px-4 py-2 rounded-lg bg-[#c7a45b] hover:bg-[#d8b870] disabled:opacity-40 text-[#062720] text-sm font-bold flex items-center gap-1.5 cursor-pointer"
            >
              Berikutnya <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Panel 1: Sumber Materi Mendalam Database + Generator / Salin Prompt + Tempel JSON */}
      <div className="panel noprint !max-w-none">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e9e4d4] pb-3 mb-4">
          <div>
            <h2 className="!border-0 !pb-0 !mb-1">
              Media Pembelajaran (Dari Materi Mendalam Database)
            </h2>
            <p className="hint !mb-0">
              Tarik langsung materi dari database <b>Bahan Ajar Mendalam</b>, lalu ubah menjadi{' '}
              <b>Slide Presentasi / Peta Konsep / Kartu Ajar</b> lewat <b>Generate AI</b> atau{' '}
              <b>Salin Prompt ke Gemini / ChatGPT &amp; Tempel JSON</b>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn sm" onClick={handleRefreshDatabase}>
              <RefreshCw className="w-3.5 h-3.5" />
              Tarik Ulang dari Database
            </button>
            <button type="button" className="btn sm" onClick={handleCreateManualMedia}>
              <Plus className="w-3.5 h-3.5" />
              Buat Draf dari Teks
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Kolom kiri: Tarik Materi Mendalam dari Database */}
          <div className="lg:col-span-5 space-y-3">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="f !mb-0">Sumber Database Bahan Ajar Mendalam</label>
                {selectedSource && (
                  <span
                    className={`badge ${
                      selectedSource.hasDeepBahanAjar ? '' : 'hots'
                    }`}
                  >
                    {selectedSource.hasDeepBahanAjar
                      ? '✓ Materi Mendalam Tersedia'
                      : 'Ringkasan ATP/Konten'}
                  </span>
                )}
              </div>
              <select
                className="in"
                value={selectedUnitId}
                onChange={(e) => handleSelectBahanSource(e.target.value)}
              >
                {bahanSources.length === 0 && (
                  <option value="">
                    (Database pertemuan kosong — tempel ringkasan materi di bawah)
                  </option>
                )}
                {bahanSources.map((b) => (
                  <option key={b.unitId} value={b.unitId}>
                    Pertemuan {b.meetingNumber} (Smt {b.smt} · {b.jp} JP): {b.judul}{' '}
                    {b.hasDeepBahanAjar ? '✓ Materi Mendalam' : b.hasDeepContent ? '(Konten)' : '(Kosong)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="f">
                Isi Materi Mendalam dari Database (Dapat Diedit Sebelum Diproses)
              </label>
              <textarea
                rows={9}
                className="in text-xs leading-relaxed"
                placeholder="Pilih pertemuan di atas untuk menarik otomatis isi Bahan Ajar Mendalam, atau tempel teks materi di sini..."
                value={customMateriText}
                onChange={(e) => setCustomMateriText(e.target.value)}
              />
            </div>
          </div>

          {/* Kolom kanan: Konfigurasi & Pilihan Cara Pembuatan */}
          <div className="lg:col-span-7 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="f">Judul Media Pembelajaran</label>
                <input
                  className="in"
                  value={judulMedia}
                  onChange={(e) => setJudulMedia(e.target.value)}
                />
              </div>
              <div>
                <label className="f">Bentuk / Jenis Media</label>
                <select
                  className="in"
                  value={jenisMedia}
                  onChange={(e) => setJenisMedia(e.target.value as MediaPembelajaranJenis)}
                >
                  <option value="slide-presentasi">Slide Presentasi Kelas (Proyektor)</option>
                  <option value="peta-konsep">Peta Konsep &amp; Alur Materi</option>
                  <option value="kartu-ajar">Kartu Ajar Interaktif (Flashcard)</option>
                  <option value="studi-kasus">Media Studi Kasus &amp; Diskusi</option>
                </select>
              </div>
              <div>
                <label className="f">Kelas Sasaran</label>
                <select
                  className="in"
                  value={selectedKelasId}
                  onChange={(e) => setSelectedKelasId(e.target.value)}
                >
                  {adminState.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      Kelas {c.tingkat} — {c.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="f">Mata Pelajaran</label>
                <select
                  className="in"
                  value={selectedMapel}
                  onChange={(e) => setSelectedMapel(e.target.value)}
                >
                  {mapelList.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="f">Target Jumlah Slide / Kartu</label>
                <input
                  type="number"
                  min={4}
                  max={16}
                  className="in"
                  value={jumlahSlide}
                  onChange={(e) => setJumlahSlide(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="f">Estimasi Durasi Tayang (Menit)</label>
                <input
                  type="number"
                  min={10}
                  max={180}
                  className="in"
                  value={durasiMenit}
                  onChange={(e) => setDurasiMenit(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Switch Mode: Generate AI vs Salin Prompt + Tempel JSON */}
            <div className="rounded-xl border border-[#d9e2d9] bg-[#f8faf5] p-3.5 space-y-3">
              <div className="flex flex-wrap gap-2 border-b border-[#e2e7dc] pb-2.5">
                <button
                  type="button"
                  onClick={() => setCreatorMode('ai')}
                  className={`btn sm ${creatorMode === 'ai' ? 'primary' : ''}`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Cara 1: Generate AI Langsung
                </button>
                <button
                  type="button"
                  onClick={() => setCreatorMode('prompt-json')}
                  className={`btn sm ${creatorMode === 'prompt-json' ? 'primary' : ''}`}
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  Cara 2: Salin Prompt (Gemini / ChatGPT) &amp; Tempel JSON
                </button>
              </div>

              {creatorMode === 'ai' ? (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-[#64736c]">
                      Menyusun otomatis slide, poin utama, ide visual, catatan guru, dan pertanyaan interaktif dari Materi Mendalam.
                    </span>
                    <button
                      type="button"
                      disabled={generating}
                      onClick={handleGenerateWithAI}
                      className="btn primary"
                    >
                      <Sparkles className="w-4 h-4" />
                      {generating ? 'Menyusun Media...' : 'Generate Media Ajar (AI)'}
                    </button>
                  </div>

                  {aiError && (
                    <div className="p-3 rounded-lg bg-[#fbeeed] border border-[#e3b9b6] text-xs text-[#8a1c16] space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{aiError}</span>
                      </div>
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => setCreatorMode('prompt-json')}
                      >
                        <ClipboardPaste className="w-3.5 h-3.5" />
                        Beralih ke Salin Prompt (Gemini / ChatGPT) &amp; Tempel JSON
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-[#315449] bg-[#eaf5f3] border border-[#bcd6d2] rounded-lg p-2.5">
                    <b>Langkah mudah pakai Gemini Web atau ChatGPT:</b> (1) Klik{' '}
                    <b>Salin Prompt Media</b>, (2) Tempel &amp; kirim ke Gemini/ChatGPT, (3) Salin JSON jawabannya lalu tempel di kolom bawah ini.
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn primary sm" onClick={handleCopyPrompt}>
                      <Copy className="w-3.5 h-3.5" /> Salin Prompt (Gemini / ChatGPT)
                    </button>
                    <button type="button" className="btn sm" onClick={handleDownloadPromptTxt}>
                      <Download className="w-3.5 h-3.5" /> Unduh Prompt (.txt)
                    </button>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => setShowPromptPreview((v) => !v)}
                    >
                      <FileText className="w-3.5 h-3.5" />{' '}
                      {showPromptPreview ? 'Tutup Pratinjau Prompt' : 'Lihat Prompt'}
                    </button>
                  </div>

                  {showPromptPreview && (
                    <textarea
                      readOnly
                      rows={6}
                      className="in text-[11px] font-mono bg-white"
                      value={externalPrompt}
                    />
                  )}

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="f !mb-0">Tempel Hasil JSON dari Gemini / ChatGPT</label>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-[#126451] underline cursor-pointer"
                        onClick={() => {
                          setPastedJson(SAMPLE_MEDIA_JSON);
                          setJsonError(null);
                        }}
                      >
                        Isi Contoh JSON
                      </button>
                    </div>
                    <textarea
                      rows={5}
                      className="in text-xs font-mono"
                      placeholder='Tempel seluruh respons JSON dari Gemini atau ChatGPT di sini (boleh termasuk tanda ```json ... ```)...'
                      value={pastedJson}
                      onChange={(e) => {
                        setPastedJson(e.target.value);
                        if (jsonError) setJsonError(null);
                      }}
                    />
                  </div>

                  {jsonError && (
                    <div className="p-2.5 rounded-lg bg-[#fbeeed] border border-[#e3b9b6] text-xs text-[#8a1c16]">
                      {jsonError}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="btn primary sm"
                      onClick={handleImportFromJson}
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" /> Proses &amp; Simpan Media dari JSON
                    </button>
                    <label className="btn sm cursor-pointer">
                      <Upload className="w-3.5 h-3.5" /> Unggah File .json
                      <input
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={handleUploadJsonFile}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Daftar Media Pembelajaran Tersimpan */}
      {adminState.mediaPembelajaran.length > 0 && (
        <div className="panel noprint !max-w-none">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="!border-0 !pb-0 !mb-0">
              Koleksi Media Pembelajaran ({adminState.mediaPembelajaran.length})
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {adminState.mediaPembelajaran.map((m) => {
              const active = m.id === activeMedia?.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMediaId(m.id)}
                  className={`px-3 py-2 rounded-lg border text-left transition cursor-pointer ${
                    active
                      ? 'bg-[#e2f0e8] border-[#126451] text-[#0b3c32]'
                      : 'bg-[#fffdf8] border-[#d9e2d9] hover:bg-[#f4f7ef]'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#126451]" />
                    <span>{m.judul}</span>
                  </div>
                  <div className="text-[11px] text-[#64736c]">
                    {JENIS_MEDIA_LABELS[m.jenis]} · {m.slides.length} slide ·{' '}
                    {m.kelasLabel || 'Semua'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Workspace Presentasi & Editor Media Terpilih */}
      {activeMedia ? (
        <>
          <div className="panel noprint !max-w-none border-l-4 border-l-[#c7a45b] space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e9e4d4] pb-3">
              <div>
                <h2 className="!border-0 !pb-0 !mb-1">{activeMedia.judul}</h2>
                <div className="text-xs text-[#64736c] flex flex-wrap gap-2">
                  <span className="badge">{JENIS_MEDIA_LABELS[activeMedia.jenis]}</span>
                  <span className="badge">{activeMedia.mapel}</span>
                  {activeMedia.kelasLabel && (
                    <span className="badge">{activeMedia.kelasLabel}</span>
                  )}
                  <span className="badge hots">{activeMedia.slides.length} Slide / Kartu</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => setPresentingIndex(0)}
                >
                  <MonitorPlay className="w-4 h-4" /> Tayangkan Presentasi (Layar Penuh)
                </button>
                <button type="button" className="btn sm" onClick={handleExportActiveJson}>
                  <Download className="w-3.5 h-3.5" /> Ekspor JSON
                </button>
                <button type="button" className="btn sm" onClick={() => window.print()}>
                  <Printer className="w-3.5 h-3.5" /> Cetak Handout
                </button>
                <button
                  type="button"
                  className="btn sm danger"
                  onClick={() => handleDeleteMedia(activeMedia.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Hapus
                </button>
              </div>
            </div>

            {/* Identitas Ringkas Media (Editable) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="f">Judul Media</label>
                <input
                  className="in"
                  value={activeMedia.judul}
                  onChange={(e) => mutateActiveMedia((m) => ({ ...m, judul: e.target.value }))}
                />
              </div>
              <div>
                <label className="f">Subjudul</label>
                <input
                  className="in"
                  value={activeMedia.subjudul || ''}
                  onChange={(e) => mutateActiveMedia((m) => ({ ...m, subjudul: e.target.value }))}
                />
              </div>
              <div>
                <label className="f">Tujuan Pembelajaran</label>
                <input
                  className="in"
                  value={activeMedia.tujuanPembelajaran || ''}
                  onChange={(e) =>
                    mutateActiveMedia((m) => ({ ...m, tujuanPembelajaran: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="f">Integrasi Kurikulum Berbasis Cinta (KBC)</label>
                <input
                  className="in"
                  value={activeMedia.integrasiKbc || ''}
                  onChange={(e) =>
                    mutateActiveMedia((m) => ({ ...m, integrasiKbc: e.target.value }))
                  }
                />
              </div>
            </div>

            <div>
              <label className="f">Saran Aktivitas Kelas Menggunakan Media Ini</label>
              <textarea
                rows={2}
                className="in text-xs"
                value={activeMedia.aktivitasKelas || ''}
                onChange={(e) =>
                  mutateActiveMedia((m) => ({ ...m, aktivitasKelas: e.target.value }))
                }
              />
            </div>

            {/* Editor Slide */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#e9e4d4]">
              <h3 className="font-bold text-sm text-[#0b3c32]">
                Daftar Slide / Kartu Ajar ({activeMedia.slides.length})
              </h3>
              <button type="button" className="btn sm" onClick={handleAddSlide}>
                <Plus className="w-3.5 h-3.5" /> Tambah Slide
              </button>
            </div>

            <div className="space-y-3">
              {activeMedia.slides.map((sl, idx) => (
                <div
                  key={sl.id}
                  className="p-4 rounded-xl border border-[#d9e2d9] bg-[#fffdf8] space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-[#0b3c32] text-[#fff8e8] text-xs font-bold">
                        Slide {idx + 1}
                      </span>
                      <select
                        className="mini-select"
                        value={sl.tipe}
                        onChange={(e) =>
                          handleUpdateSlide(sl.id, { tipe: e.target.value as MediaSlideTipe })
                        }
                      >
                        {Object.entries(SLIDE_TIPE_LABELS).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => setPresentingIndex(idx)}
                        title="Tayangkan mulai dari slide ini"
                      >
                        <MonitorPlay className="w-3.5 h-3.5" /> Tayangkan
                      </button>
                      <button
                        type="button"
                        className="btn sm"
                        disabled={idx === 0}
                        onClick={() => handleMoveSlide(idx, -1)}
                        title="Pindah ke atas"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="btn sm"
                        disabled={idx === activeMedia.slides.length - 1}
                        onClick={() => handleMoveSlide(idx, 1)}
                        title="Pindah ke bawah"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="btn sm danger"
                        onClick={() => handleDeleteSlide(sl.id)}
                        title="Hapus slide"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="f">Judul Slide</label>
                      <input
                        className="in"
                        value={sl.judulSlide}
                        onChange={(e) =>
                          handleUpdateSlide(sl.id, { judulSlide: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="f">Pertanyaan Interaktif Siswa (Opsional)</label>
                      <input
                        className="in"
                        placeholder="Pertanyaan diskusi atau cek pemahaman..."
                        value={sl.pertanyaanInteraktif || ''}
                        onChange={(e) =>
                          handleUpdateSlide(sl.id, { pertanyaanInteraktif: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="f">Narasi / Ringkasan di Layar</label>
                      <textarea
                        rows={3}
                        className="in text-xs"
                        value={sl.ringkasan}
                        onChange={(e) => handleUpdateSlide(sl.id, { ringkasan: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="f">Poin Utama (1 Baris = 1 Poin)</label>
                      <textarea
                        rows={3}
                        className="in text-xs"
                        value={sl.poinUtama.join('\n')}
                        onChange={(e) =>
                          handleUpdateSlide(sl.id, {
                            poinUtama: e.target.value
                              .split('\n')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="f">Ide Visual / Bagan / Ilustrasi</label>
                      <input
                        className="in text-xs"
                        placeholder="Contoh: Diagram alur sebab-akibat di papan/slide..."
                        value={sl.visualIde}
                        onChange={(e) => handleUpdateSlide(sl.id, { visualIde: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="f">Catatan Penyampaian Guru</label>
                      <input
                        className="in text-xs"
                        placeholder="Panduan lisan saat slide ini ditayangkan..."
                        value={sl.catatanGuru}
                        onChange={(e) =>
                          handleUpdateSlide(sl.id, { catatanGuru: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {activeMedia.glosarium && activeMedia.glosarium.length > 0 && (
              <div className="p-3.5 rounded-xl bg-[#f8faf5] border border-[#d9e2d9]">
                <div className="text-xs font-bold text-[#0b3c32] mb-2 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-[#126451]" /> Glosarium Istilah Kunci
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {activeMedia.glosarium.map((g, gIdx) => (
                    <div key={gIdx} className="p-2 rounded bg-white border border-[#e7eadf]">
                      <b className="text-[#0b3c32]">{g.istilah}:</b> {g.makna}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Lembar Handout Cetak (Muncul saat Print / Simpan PDF) */}
          <section className="paper hidden print:block">
            <div className="dt">MEDIA PEMBELAJARAN &amp; HANDOUT KELAS</div>
            <div className="dt2">{activeMedia.judul}</div>
            {activeMedia.subjudul && <div className="dsub">{activeMedia.subjudul}</div>}
            <table className="info">
              <tbody>
                <tr>
                  <td>Mata Pelajaran</td>
                  <td>:</td>
                  <td>{activeMedia.mapel}</td>
                </tr>
                <tr>
                  <td>Kelas</td>
                  <td>:</td>
                  <td>{activeMedia.kelasLabel || '-'}</td>
                </tr>
                <tr>
                  <td>Bentuk Media</td>
                  <td>:</td>
                  <td>{JENIS_MEDIA_LABELS[activeMedia.jenis]}</td>
                </tr>
                {activeMedia.tujuanPembelajaran && (
                  <tr>
                    <td>Tujuan Pembelajaran</td>
                    <td>:</td>
                    <td>{activeMedia.tujuanPembelajaran}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {activeMedia.slides.map((sl, idx) => (
              <div
                key={sl.id}
                style={{
                  border: '1px solid #333',
                  padding: '8px 10px',
                  marginBottom: '10px',
                  breakInside: 'avoid',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                  Slide {idx + 1}: {sl.judulSlide} ({SLIDE_TIPE_LABELS[sl.tipe] || sl.tipe})
                </div>
                {sl.ringkasan && <p style={{ margin: '0 0 6px' }}>{sl.ringkasan}</p>}
                {sl.poinUtama.length > 0 && (
                  <ul className="n">
                    {sl.poinUtama.map((pt, pIdx) => (
                      <li key={pIdx}>{pt}</li>
                    ))}
                  </ul>
                )}
                {sl.visualIde && (
                  <div style={{ fontSize: '11px', marginTop: '4px' }}>
                    <b>Visual:</b> {sl.visualIde}
                  </div>
                )}
                {sl.pertanyaanInteraktif && (
                  <div style={{ fontSize: '11px', marginTop: '3px' }}>
                    <b>Pertanyaan Kelas:</b> {sl.pertanyaanInteraktif}
                  </div>
                )}
              </div>
            ))}
          </section>
        </>
      ) : (
        <div className="empty noprint">
          <b>Belum Ada Media Pembelajaran Tersimpan</b>
          Pilih pertemuan pada <b>Sumber Database Bahan Ajar Mendalam</b> di atas, lalu klik{' '}
          <b>Generate Media Ajar (AI)</b> atau gunakan <b>Salin Prompt &amp; Tempel JSON</b>.
        </div>
      )}
    </div>
  );
};
