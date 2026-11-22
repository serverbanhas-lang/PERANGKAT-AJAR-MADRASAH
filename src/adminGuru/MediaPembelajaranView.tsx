import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardPaste,
  Code2,
  Copy,
  Download,
  Edit3,
  Eye,
  FileCode2,
  FileText,
  Layers,
  Maximize2,
  MessageCircleQuestion,
  MonitorPlay,
  Plus,
  Printer,
  RefreshCw,
  SlidersHorizontal,
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
  getPreferredKelasId,
  normalizeMediaPayload,
  parseImportedMediaJson,
  subscribeMasterStudents,
  updateAdminGuruState,
} from './bridge';
import { buildStandaloneHtml5PowerPoint } from './mediaHtmlExport';
import type {
  LearningMediaItem,
  MediaPembelajaranJenis,
  MediaSlideItem,
  MediaSlideLayout,
  MediaSlideTipe,
  MediaThemeKey,
} from '../types/adminGuru';

const JENIS_MEDIA_LABELS: Record<MediaPembelajaranJenis, string> = {
  'slide-presentasi': 'Slide Presentasi PowerPoint (HTML5/JS)',
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

const SLIDE_LAYOUT_LABELS: Record<MediaSlideLayout, string> = {
  pembuka: 'Sampul Pembuka',
  standar: 'Slide Standar',
  'kartu-grid': 'Grid Kartu Konsep',
  alur: 'Diagram Alur / Tahapan',
  perbandingan: 'Perbandingan 2 Kolom',
  kuis: 'Kuis & Tanya Jawab',
};

type TransitionType = 'slide' | 'fade' | 'zoom';

const THEME_STYLES: Record<
  MediaThemeKey,
  {
    label: string;
    outerBg: string;
    heroBg: string;
    slideBg: string;
    slideText: string;
    accentBg: string;
    accentText: string;
    accentSoft: string;
    border: string;
    goldSoft: string;
  }
> = {
  zamrud: {
    label: 'Zamrud Madrasah',
    outerBg: '#09241e',
    heroBg: 'linear-gradient(135deg, #0d5c4b 0%, #05221c 100%)',
    slideBg: '#fffdf8',
    slideText: '#142723',
    accentBg: '#0f6b58',
    accentText: '#0f6b58',
    accentSoft: '#e5f2ee',
    border: '#c7a45b',
    goldSoft: '#fcf3db',
  },
  biru: {
    label: 'Biru Akademik',
    outerBg: '#0f1b33',
    heroBg: 'linear-gradient(135deg, #1d4ed8 0%, #0f172a 100%)',
    slideBg: '#ffffff',
    slideText: '#0f172a',
    accentBg: '#1d4ed8',
    accentText: '#1e40af',
    accentSoft: '#e0edff',
    border: '#38bdf8',
    goldSoft: '#e0f2fe',
  },
  emas: {
    label: 'Emas Klasik',
    outerBg: '#261b0b',
    heroBg: 'linear-gradient(135deg, #9a6700 0%, #2d1f07 100%)',
    slideBg: '#fffcf4',
    slideText: '#291d0c',
    accentBg: '#9a6700',
    accentText: '#7c5200',
    accentSoft: '#faecc8',
    border: '#c68a0f',
    goldSoft: '#fef3c7',
  },
  gelap: {
    label: 'Gelap Modern',
    outerBg: '#090b10',
    heroBg: 'linear-gradient(135deg, #065f46 0%, #0f172a 100%)',
    slideBg: '#141a28',
    slideText: '#f1f5f9',
    accentBg: '#10b981',
    accentText: '#34d399',
    accentSoft: '#192a38',
    border: '#f59e0b',
    goldSoft: '#292214',
  },
};

const SAMPLE_MEDIA_JSON = `{
  "judul": "Media Interaktif: Konsep Inti & Penerapan",
  "subjudul": "Pembelajaran Mendalam Berbasis Cinta (HTML5 PowerPoint)",
  "tema": "zamrud",
  "tujuanPembelajaran": "Peserta didik mampu memahami alur konsep utama dan membandingkan penerapannya.",
  "integrasiKbc": "Menumbuhkan kecintaan pada ilmu pengetahuan dan kepedulian sosial.",
  "aktivitasKelas": "Diskusi berpasangan 10 menit membahas contoh nyata pada slide 3.",
  "glosarium": [
    { "istilah": "Konsep Inti", "makna": "Gagasan pokok yang menjadi landasan seluruh pembahasan." }
  ],
  "slides": [
    {
      "judulSlide": "Mari Memahami Konsep Inti Bersama",
      "tipe": "pembuka",
      "layout": "pembuka",
      "ringkasan": "Bagaimana konsep ini berperan dalam kehidupan nyata dan pembelajaran di madrasah?",
      "poinUtama": ["Amati fenomena sekitar", "Rumuskan 2 pertanyaan awal", "Diskusikan dengan teman sebangku"],
      "diagramLangkah": [],
      "perbandingan": null,
      "visualIde": "Ilustrasi pembuka bertema madrasah dan kolaborasi",
      "catatanGuru": "Beri waktu 2 menit agar siswa menyampaikan pengalaman awal.",
      "pertanyaanInteraktif": "Contoh nyata apa yang paling dekat dengan keseharian kalian?",
      "jawabanInteraktif": "Siswa dapat menyebutkan contoh di rumah, madrasah, atau lingkungan masyarakat."
    },
    {
      "judulSlide": "Alur Pemahaman Materi Bertahap",
      "tipe": "konsep",
      "layout": "alur",
      "ringkasan": "Ikuti tiga tahapan utama agar konsep mudah dipahami dari dasar hingga penerapan.",
      "poinUtama": ["Pahami definisi dasar", "Hubungkan sebab dan akibat", "Terapkan pada studi kasus"],
      "diagramLangkah": ["1. Mengamati Masalah", "2. Menganalisis Konsep", "3. Menyimpulkan & Menerapkan"],
      "perbandingan": null,
      "visualIde": "Diagram panah 3 langkah berurutan",
      "catatanGuru": "Klik poin bertahap agar siswa fokus pada satu tahap dahulu.",
      "pertanyaanInteraktif": "Tahap mana yang paling menentukan keberhasilan pemecahan masalah?",
      "jawabanInteraktif": "Tahap menganalisis konsep karena menjadi jembatan antara pengamatan dan penerapan."
    },
    {
      "judulSlide": "Cek Pemahaman Cepat",
      "tipe": "kuis-cepat",
      "layout": "kuis",
      "ringkasan": "Uji pemahaman singkat sebelum berlanjut ke latihan kelompok.",
      "poinUtama": ["Baca pertanyaan dengan cermat", "Diskusikan singkat 30 detik", "Bandingkan dengan kunci"],
      "diagramLangkah": [],
      "perbandingan": null,
      "visualIde": "Kartu pertanyaan kuis interaktif",
      "catatanGuru": "Tekan tombol Tampilkan Jawaban setelah beberapa siswa menjawab.",
      "pertanyaanInteraktif": "Mengapa pemahaman konsep lebih penting daripada sekadar menghafal?",
      "jawabanInteraktif": "Karena pemahaman konsep membantu kita menerapkan ilmu pada situasi baru yang berbeda."
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
  const [selectedKelasId, setSelectedKelasId] = useState<string>(() =>
    getPreferredKelasId(adminState.classes)
  );
  useEffect(() => {
    return subscribeMasterStudents(() => setAdminState(getAdminGuruState()));
  }, []);
  const [selectedMapel, setSelectedMapel] = useState<string>(
    mapelList[0] || 'Mata Pelajaran Utama'
  );
  const [jumlahSlide, setJumlahSlide] = useState<number>(8);
  const [durasiMenit, setDurasiMenit] = useState<number>(45);

  // Mode Input: AI Langsung vs Salin Prompt & Tempel JSON
  const [creatorMode, setCreatorMode] = useState<'ai' | 'prompt-json'>('ai');
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [lastAiGeneratedId, setLastAiGeneratedId] = useState<string | null>(null);
  const [pastedJson, setPastedJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  // Workspace PowerPoint HTML5/JS
  const [workspaceTab, setWorkspaceTab] = useState<'presentasi' | 'edit' | 'json'>('presentasi');
  const [currentSlideIdx, setCurrentSlideIdx] = useState<number>(0);
  const [transitionType, setTransitionType] = useState<TransitionType>('slide');
  const [stepMode, setStepMode] = useState<boolean>(false);
  const [revealedPoints, setRevealedPoints] = useState<number>(999);
  const [showInteractiveAnswer, setShowInteractiveAnswer] = useState<boolean>(false);
  const [showTeacherNotes, setShowTeacherNotes] = useState<boolean>(true);
  const [isFullscreenOverlay, setIsFullscreenOverlay] = useState<boolean>(false);

  // Editor JSON Aktif
  const [activeJsonDraft, setActiveJsonDraft] = useState<string>('');
  const [activeJsonError, setActiveJsonError] = useState<string | null>(null);

  const playerRootRef = useRef<HTMLDivElement | null>(null);

  const selectedSource = useMemo(
    () => bahanSources.find((b) => b.unitId === selectedUnitId),
    [bahanSources, selectedUnitId]
  );

  const activeMedia: LearningMediaItem | undefined = useMemo(
    () => adminState.mediaPembelajaran.find((m) => m.id === selectedMediaId),
    [adminState.mediaPembelajaran, selectedMediaId]
  );

  const activeThemeKey: MediaThemeKey = activeMedia?.tema || 'zamrud';
  const theme = THEME_STYLES[activeThemeKey] || THEME_STYLES.zamrud;

  // Sinkronkan draft JSON & reset indeks slide saat berpindah media
  useEffect(() => {
    if (!activeMedia) {
      setActiveJsonDraft('');
      setCurrentSlideIdx(0);
      return;
    }
    setActiveJsonDraft(JSON.stringify(activeMedia, null, 2));
    setActiveJsonError(null);
    setCurrentSlideIdx((idx) => Math.min(idx, Math.max(0, activeMedia.slides.length - 1)));
  }, [activeMedia]);

  useEffect(() => {
    setShowInteractiveAnswer(false);
    setRevealedPoints(stepMode ? 1 : 999);
  }, [currentSlideIdx, selectedMediaId, stepMode]);

  const currentSlide: MediaSlideItem | undefined =
    activeMedia && activeMedia.slides.length > 0
      ? activeMedia.slides[Math.min(currentSlideIdx, activeMedia.slides.length - 1)]
      : undefined;

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
    setCurrentSlideIdx(0);
    setWorkspaceTab('presentasi');
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

      const rawAiPayload = data.media || data;
      const normalized = normalizeMediaPayload(rawAiPayload, {
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
      setLastAiGeneratedId(normalized.id);
      api?.toast(
        `Berhasil! JSON PowerPoint AI (${normalized.slides.length} slide) siap dijalankan & dapat dilihat di tab JSON.`
      );
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
      api?.toast(
        'Prompt PowerPoint JSON tersalin! Tempel ke Gemini/ChatGPT, lalu salin JSON hasilnya ke kolom bawah.'
      );
    } else {
      setShowPromptPreview(true);
      api?.toast('Salin prompt dari kotak pratinjau di bawah.');
    }
  };

  const handleDownloadPromptTxt = () => {
    const blob = new Blob([externalPrompt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Prompt_PowerPoint_${(judulMedia || 'Media').replace(/[^A-Za-z0-9_-]/g, '_')}.txt`;
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
      setLastAiGeneratedId(null);
      setPastedJson('');
      api?.toast(
        `Berhasil! "${item.judul}" (${item.slides.length} slide) siap dijalankan seperti PowerPoint.`
      );
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
      api?.toast(`File JSON dimuat (${item.slides.length} slide) ke pemutar PowerPoint HTML5!`);
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
              layout: idx === 0 ? 'pembuka' : 'standar',
              ringkasan: (rest || block).slice(0, 320),
              poinUtama: block
                .split('\n')
                .map((l) => l.replace(/^[-•*]\s*/, '').trim())
                .filter((l) => l.length > 3)
                .slice(0, 4),
              visualIde: 'Tambahkan skema, diagram alur, atau gambar ilustrasi pendukung.',
              catatanGuru: 'Sampaikan poin inti dan ajak peserta didik berdiskusi.',
              pertanyaanInteraktif:
                idx === 0 ? 'Apa yang sudah kalian ketahui tentang topik ini?' : '',
              jawabanInteraktif: '',
            };
          })
        : [
            {
              id: createUid('sl_0'),
              judulSlide: judulMedia || 'Slide Pembuka',
              tipe: 'pembuka',
              layout: 'pembuka',
              ringkasan: 'Tuliskan ringkasan materi atau pemantik awal di sini.',
              poinUtama: ['Poin utama 1', 'Poin utama 2', 'Poin utama 3'],
              visualIde: 'Bagan konsep atau ilustrasi pembuka',
              catatanGuru: 'Ajak siswa mengamati dan bertanya.',
              pertanyaanInteraktif: 'Apa hubungan topik ini dengan kehidupan sehari-hari?',
              jawabanInteraktif: 'Siswa mengaitkan materi dengan pengalaman di madrasah atau rumah.',
            },
          ];

    const newItem: LearningMediaItem = {
      id: createUid('med'),
      judul: judulMedia.trim() || 'Media Pembelajaran Manual',
      subjudul: 'Disusun dari Materi Database',
      jenis: jenisMedia,
      tema: 'zamrud',
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
    api?.toast(`Draf PowerPoint HTML5 dengan ${slides.length} slide berhasil dibuat.`);
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
          layout: 'standar',
          ringkasan: '',
          poinUtama: ['Poin penting 1', 'Poin penting 2'],
          visualIde: '',
          catatanGuru: '',
          pertanyaanInteraktif: '',
          jawabanInteraktif: '',
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

  const handleDownloadHtml5PowerPoint = () => {
    if (!activeMedia) return;
    const html = buildStandaloneHtml5PowerPoint(activeMedia, activeThemeKey);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PowerPoint_HTML5_${activeMedia.judul.replace(/[^A-Za-z0-9_-]/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 300);
    api?.toast(
      'File Presentasi PowerPoint HTML5 (.html) diunduh! Dapat dibuka langsung di browser mana pun.'
    );
  };

  const handleApplyEditedActiveJson = () => {
    if (!activeMedia) return;
    setActiveJsonError(null);
    try {
      const parsed = parseImportedMediaJson(activeJsonDraft, {
        judul: activeMedia.judul,
        jenis: activeMedia.jenis,
        mapel: activeMedia.mapel,
        kelasId: activeMedia.kelasId,
        kelasLabel: activeMedia.kelasLabel,
        unitId: activeMedia.unitId,
        tpLabel: activeMedia.tujuanPembelajaran,
        durasiMenit: activeMedia.durasiMenit,
      });
      mutateActiveMedia(() => ({
        ...parsed,
        id: activeMedia.id,
        createdAt: activeMedia.createdAt,
      }));
      setCurrentSlideIdx(0);
      setWorkspaceTab('presentasi');
      api?.toast(
        `Perubahan JSON diterapkan (${parsed.slides.length} slide) dan siap dijalankan!`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Format JSON tidak valid.';
      setActiveJsonError(msg);
      api?.toast(msg);
    }
  };

  const handleCopyActiveJson = async () => {
    if (!activeJsonDraft) return;
    const ok = await copyTextToClipboard(activeJsonDraft);
    api?.toast(ok ? 'JSON Media Pembelajaran tersalin ke clipboard.' : 'Salin JSON dari kotak editor.');
  };

  const handleNextStepOrSlide = () => {
    if (!activeMedia || !currentSlide) return;
    if (stepMode && revealedPoints < currentSlide.poinUtama.length) {
      setRevealedPoints((n) => n + 1);
      return;
    }
    if (currentSlideIdx < activeMedia.slides.length - 1) {
      setCurrentSlideIdx((i) => i + 1);
    }
  };

  const handlePrevSlide = () => {
    if (currentSlideIdx > 0) {
      setCurrentSlideIdx((i) => i - 1);
    }
  };

  const toggleFullscreen = () => {
    if (isFullscreenOverlay) {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreenOverlay(false);
    } else {
      setIsFullscreenOverlay(true);
      if (playerRootRef.current?.requestFullscreen) {
        playerRootRef.current.requestFullscreen().catch(() => {});
      }
    }
  };

  // Sinkronkan tombol Escape / navigasi keyboard pada mode fullscreen
  useEffect(() => {
    if (!isFullscreenOverlay || !activeMedia) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreenOverlay(false);
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNextStepOrSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevSlide();
      } else if (e.key === 'Home') {
        setCurrentSlideIdx(0);
      } else if (e.key === 'End') {
        setCurrentSlideIdx(activeMedia.slides.length - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Render kanvas slide PowerPoint HTML5/JS (digunakan baik pada inline player maupun layar penuh)
  const renderSlideCanvas = (slide: MediaSlideItem, slideIndex: number, totalSlides: number) => {
    const layout: MediaSlideLayout =
      slide.layout ||
      (slide.tipe === 'pembuka'
        ? 'pembuka'
        : slide.tipe === 'kuis-cepat'
          ? 'kuis'
          : slide.diagramLangkah?.length
            ? 'alur'
            : slide.perbandingan
              ? 'perbandingan'
              : 'standar');
    const isHero = layout === 'pembuka';
    const animClass =
      transitionType === 'fade'
        ? 'ppt-anim-fade'
        : transitionType === 'zoom'
          ? 'ppt-anim-zoom'
          : 'ppt-anim-slide';

    return (
      <div
        key={`${slide.id}-${slideIndex}-${transitionType}`}
        style={{
          background: isHero ? theme.heroBg : theme.slideBg,
          color: isHero ? '#fffdf8' : theme.slideText,
          borderColor: theme.border,
        }}
        className={`w-full rounded-2xl border-2 shadow-xl p-6 sm:p-9 min-h-[420px] flex flex-col justify-between transition-all duration-300 ${animClass}`}
      >
        <div className="space-y-4">
          {/* Header slide */}
          <div
            className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b"
            style={{
              borderColor: isHero ? 'rgba(255,255,255,0.22)' : 'rgba(140,150,145,0.28)',
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
                style={{
                  background: isHero ? 'rgba(255,255,255,0.18)' : theme.accentSoft,
                  color: isHero ? '#f6dc9b' : theme.accentText,
                }}
              >
                {SLIDE_TIPE_LABELS[slide.tipe] || slide.tipe}
              </span>
              <span
                className="text-[11px] font-semibold opacity-75"
                style={{ color: isHero ? '#e2f2ee' : theme.slideText }}
              >
                · {SLIDE_LAYOUT_LABELS[layout]}
              </span>
            </div>
            <span
              className="text-xs font-bold"
              style={{ color: isHero ? '#f6dc9b' : theme.border }}
            >
              Slide {slideIndex + 1} / {totalSlides}
            </span>
          </div>

          {/* Judul & Ringkasan */}
          <h2
            className={`font-serif font-bold leading-tight ${
              isHero ? 'text-2xl sm:text-4xl' : 'text-xl sm:text-3xl'
            }`}
            style={{ color: isHero ? '#ffffff' : theme.accentText }}
          >
            {slide.judulSlide}
          </h2>

          {slide.ringkasan && (
            <p className="text-sm sm:text-lg leading-relaxed opacity-95">{slide.ringkasan}</p>
          )}

          {/* Diagram Alur / Tahapan */}
          {slide.diagramLangkah && slide.diagramLangkah.length > 0 && (
            <div className="flex flex-wrap items-stretch gap-2 pt-1">
              {slide.diagramLangkah.map((step, idx) => (
                <React.Fragment key={idx}>
                  <div
                    className="flex-1 min-w-[155px] p-3 rounded-xl border"
                    style={{
                      background: isHero ? 'rgba(255,255,255,0.12)' : theme.accentSoft,
                      borderColor: isHero ? 'rgba(255,255,255,0.24)' : theme.accentBg,
                    }}
                  >
                    <div
                      className="text-[10px] font-extrabold uppercase tracking-wider mb-1"
                      style={{ color: isHero ? '#f6dc9b' : theme.accentText }}
                    >
                      Tahap {idx + 1}
                    </div>
                    <div className="text-xs sm:text-sm font-semibold">{step}</div>
                  </div>
                  {idx < (slide.diagramLangkah?.length || 0) - 1 && (
                    <div className="flex items-center justify-center px-1 opacity-75">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Layout Perbandingan 2 Kolom */}
          {slide.perbandingan &&
            (slide.perbandingan.isiKiri.length > 0 || slide.perbandingan.isiKanan.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div
                  className="p-4 rounded-xl border"
                  style={{
                    background: isHero ? 'rgba(255,255,255,0.12)' : theme.accentSoft,
                    borderColor: theme.border,
                  }}
                >
                  <div
                    className="font-bold text-sm mb-2"
                    style={{ color: isHero ? '#f6dc9b' : theme.accentText }}
                  >
                    {slide.perbandingan.judulKiri || 'Aspek A'}
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-xs sm:text-sm">
                    {slide.perbandingan.isiKiri.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div
                  className="p-4 rounded-xl border"
                  style={{
                    background: isHero ? 'rgba(255,255,255,0.12)' : theme.goldSoft,
                    borderColor: theme.border,
                  }}
                >
                  <div
                    className="font-bold text-sm mb-2"
                    style={{ color: isHero ? '#f6dc9b' : theme.border }}
                  >
                    {slide.perbandingan.judulKanan || 'Aspek B'}
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-xs sm:text-sm">
                    {slide.perbandingan.isiKanan.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

          {/* Poin Utama (animasi bertahap seperti PowerPoint) */}
          {slide.poinUtama.length > 0 && (
            <div
              className={`grid gap-2.5 pt-1 ${
                layout === 'kartu-grid' || slide.poinUtama.length >= 3
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-1'
              }`}
            >
              {slide.poinUtama.map((pt, pIdx) => {
                const visible = !stepMode || pIdx < revealedPoints;
                return (
                  <div
                    key={pIdx}
                    style={{
                      background: isHero ? 'rgba(255,255,255,0.13)' : theme.accentSoft,
                      borderColor: isHero ? 'rgba(255,255,255,0.22)' : 'rgba(130,150,140,0.28)',
                      opacity: visible ? 1 : 0.14,
                      transform: visible ? 'translateY(0)' : 'translateY(6px)',
                    }}
                    className="flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-300"
                  >
                    <span
                      className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        background: isHero ? '#f6dc9b' : theme.accentBg,
                        color: isHero ? '#142723' : '#ffffff',
                      }}
                    >
                      {pIdx + 1}
                    </span>
                    <span className="text-sm sm:text-base font-medium leading-snug">{pt}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Custom HTML5 Sandbox jika tersedia di JSON */}
          {slide.html5 && (
            <iframe
              title={`HTML5 Slide ${slideIndex + 1}`}
              sandbox="allow-scripts"
              srcDoc={slide.html5}
              className="w-full h-64 rounded-xl border border-[#cfd9d4] bg-white"
            />
          )}
        </div>

        {/* Pertanyaan Interaktif + Tombol Tampilkan Jawaban */}
        {slide.pertanyaanInteraktif && (
          <div
            className="mt-5 p-4 rounded-xl border space-y-2"
            style={{
              background: isHero ? 'rgba(255,255,255,0.14)' : theme.goldSoft,
              borderColor: theme.border,
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <MessageCircleQuestion
                  className="w-5 h-5 shrink-0 mt-0.5"
                  style={{ color: isHero ? '#f6dc9b' : theme.border }}
                />
                <div>
                  <div
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: isHero ? '#f6dc9b' : theme.border }}
                  >
                    Pertanyaan Interaktif Kelas
                  </div>
                  <div className="text-sm sm:text-base font-semibold mt-0.5">
                    {slide.pertanyaanInteraktif}
                  </div>
                </div>
              </div>
              {slide.jawabanInteraktif && (
                <button
                  type="button"
                  onClick={() => setShowInteractiveAnswer((v) => !v)}
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-white text-[#142723] border border-[#d6c28e] hover:bg-[#fff9e8] cursor-pointer"
                >
                  {showInteractiveAnswer ? 'Sembunyikan Jawaban' : 'Tampilkan Jawaban'}
                </button>
              )}
            </div>
            {showInteractiveAnswer && slide.jawabanInteraktif && (
              <div className="p-2.5 rounded-lg bg-white/90 text-[#142723] text-xs sm:text-sm font-medium border border-[#e3d29f]">
                <b>Kunci / Arah Jawaban:</b> {slide.jawabanInteraktif}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-[1220px] mx-auto space-y-4">
      {/* Modal Fullscreen PowerPoint HTML5/JS */}
      {isFullscreenOverlay && activeMedia && currentSlide && (
        <div
          ref={playerRootRef}
          style={{ background: theme.outerBg }}
          className="fixed inset-0 z-[100000] text-[#fffdf7] flex flex-col noprint"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-black/45 border-b border-white/15">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-[#f0cf82] font-bold">
                {activeMedia.mapel} · {activeMedia.kelasLabel || 'Kelas'} · PowerPoint HTML5/JS
              </div>
              <div className="text-sm font-bold truncate text-white">{activeMedia.judul}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStepMode((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  stepMode ? 'bg-[#f0cf82] text-[#09241e]' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                Poin Bertahap: {stepMode ? 'Aktif' : 'Mati'}
              </button>
              <button
                type="button"
                onClick={() => setShowTeacherNotes((v) => !v)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-[#f5e7c2] cursor-pointer"
              >
                {showTeacherNotes ? 'Sembunyikan Catatan' : 'Tampilkan Catatan'}
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#c7a45b] text-[#062720] hover:bg-[#d8b870] flex items-center gap-1 cursor-pointer"
              >
                <X className="w-4 h-4" /> Keluar Layar Penuh (Esc)
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-10 py-5 flex flex-col items-center justify-center gap-3">
            <div className="w-full max-w-5xl">
              {renderSlideCanvas(currentSlide, currentSlideIdx, activeMedia.slides.length)}
            </div>

            {showTeacherNotes && (currentSlide.visualIde || currentSlide.catatanGuru) && (
              <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-black/30 border border-white/15 rounded-xl p-3">
                <div>
                  <span className="font-bold text-[#f0cf82]">Saran Visual / Bagan: </span>
                  <span className="text-[#dce8e4]">{currentSlide.visualIde || '-'}</span>
                </div>
                <div>
                  <span className="font-bold text-[#f0cf82]">Catatan Guru: </span>
                  <span className="text-[#dce8e4]">{currentSlide.catatanGuru || '-'}</span>
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-3 bg-black/45 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={currentSlideIdx === 0}
              onClick={handlePrevSlide}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Sebelumnya
            </button>

            <div className="flex flex-wrap items-center gap-1.5">
              {activeMedia.slides.map((sl, sIdx) => (
                <button
                  key={sl.id}
                  type="button"
                  onClick={() => setCurrentSlideIdx(sIdx)}
                  title={sl.judulSlide}
                  className={`h-2.5 rounded-full transition cursor-pointer ${
                    sIdx === currentSlideIdx
                      ? 'w-7 bg-[#f0d28f]'
                      : 'w-2.5 bg-white/30 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {stepMode && revealedPoints < currentSlide.poinUtama.length && (
                <button
                  type="button"
                  onClick={handleNextStepOrSlide}
                  className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold cursor-pointer"
                >
                  + Tampilkan Poin ({revealedPoints}/{currentSlide.poinUtama.length})
                </button>
              )}
              <button
                type="button"
                disabled={
                  currentSlideIdx >= activeMedia.slides.length - 1 &&
                  (!stepMode || revealedPoints >= currentSlide.poinUtama.length)
                }
                onClick={handleNextStepOrSlide}
                className="px-4 py-2 rounded-lg bg-[#c7a45b] hover:bg-[#d8b870] disabled:opacity-40 text-[#062720] text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer"
              >
                Berikutnya <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel 1: Sumber Materi Mendalam Database + Generator JSON PowerPoint / Salin Prompt & Tempel JSON */}
      <div className="panel noprint !max-w-none">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e9e4d4] pb-3 mb-4">
          <div>
            <h2 className="!border-0 !pb-0 !mb-1">
              Media Pembelajaran PowerPoint HTML5/JS (Dari Materi Mendalam Database)
            </h2>
            <p className="hint !mb-0">
              Tarik langsung materi dari database <b>Bahan Ajar Mendalam</b>, hasilkan format{' '}
              <b>JSON Terstruktur</b> lewat <b>Generate AI</b> atau{' '}
              <b>Salin Prompt (Gemini / ChatGPT) &amp; Tempel JSON</b>, lalu jalankan langsung seperti{' '}
              <b>PowerPoint HTML5/JS</b>.
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
                  <span className={`badge ${selectedSource.hasDeepBahanAjar ? '' : 'hots'}`}>
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

          {/* Kolom kanan: Konfigurasi & Pilihan Cara Pembuatan JSON */}
          <div className="lg:col-span-7 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="f">Judul Media Presentasi</label>
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
                  <option value="slide-presentasi">Slide Presentasi PowerPoint (HTML5/JS)</option>
                  <option value="peta-konsep">Peta Konsep &amp; Diagram Alur</option>
                  <option value="kartu-ajar">Kartu Ajar Interaktif (Flashcard)</option>
                  <option value="studi-kasus">Media Studi Kasus &amp; Perbandingan</option>
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
                <label className="f">Target Jumlah Slide PowerPoint</label>
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
                  Cara 1: Generate JSON AI Langsung
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
                      Menghasilkan JSON slide PowerPoint (layout alur, perbandingan, kuis, catatan guru) lalu langsung dijalankan di pemutar HTML5/JS.
                    </span>
                    <button
                      type="button"
                      disabled={generating}
                      onClick={handleGenerateWithAI}
                      className="btn primary"
                    >
                      <Sparkles className="w-4 h-4" />
                      {generating ? 'Menyusun JSON Slide...' : 'Generate Media JSON (AI)'}
                    </button>
                  </div>

                  {lastAiGeneratedId && activeMedia?.id === lastAiGeneratedId && (
                    <div className="p-2.5 rounded-lg bg-[#e6f4ee] border border-[#9fd0ba] text-xs text-[#0b4737] flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-[#126451]" />
                        JSON Hasil AI ({activeMedia.slides.length} slide) berhasil disusun dan dijalankan!
                      </span>
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => setWorkspaceTab('json')}
                      >
                        <Code2 className="w-3.5 h-3.5" /> Lihat / Salin JSON Hasil AI
                      </button>
                    </div>
                  )}

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
                    <b>Cara pakai Gemini Web atau ChatGPT:</b> (1) Klik <b>Salin Prompt</b>, (2) Kirim ke Gemini/ChatGPT, (3) Salin JSON hasilnya lalu tempel di bawah — media akan otomatis berjalan seperti <b>PowerPoint HTML5/JS</b>.
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
                        Isi Contoh JSON PowerPoint
                      </button>
                    </div>
                    <textarea
                      rows={5}
                      className="in text-xs font-mono"
                      placeholder='Tempel seluruh JSON hasil AI di sini (boleh disertai blok ```json ... ```)...'
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
                      <MonitorPlay className="w-3.5 h-3.5" /> Proses JSON &amp; Jalankan PowerPoint
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

      {/* Koleksi Media Tersimpan */}
      {adminState.mediaPembelajaran.length > 0 && (
        <div className="panel noprint !max-w-none">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="!border-0 !pb-0 !mb-0">
              Koleksi Presentasi Media Pembelajaran ({adminState.mediaPembelajaran.length})
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
                    {m.slides.length} slide · {THEME_STYLES[m.tema || 'zamrud'].label} ·{' '}
                    {m.kelasLabel || 'Semua'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Workspace Utama: Pemutar PowerPoint HTML5/JS, Editor Slide, & Viewer/Editor JSON */}
      {activeMedia ? (
        <>
          <div className="panel noprint !max-w-none border-l-4 border-l-[#c7a45b] space-y-4">
            {/* Header Identitas & Aksi Cepat */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e9e4d4] pb-3">
              <div>
                <h2 className="!border-0 !pb-0 !mb-1">{activeMedia.judul}</h2>
                <div className="text-xs text-[#64736c] flex flex-wrap gap-2">
                  <span className="badge">{JENIS_MEDIA_LABELS[activeMedia.jenis]}</span>
                  <span className="badge">{activeMedia.mapel}</span>
                  {activeMedia.kelasLabel && (
                    <span className="badge">{activeMedia.kelasLabel}</span>
                  )}
                  <span className="badge hots">{activeMedia.slides.length} Slide</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    setWorkspaceTab('presentasi');
                    setIsFullscreenOverlay(true);
                  }}
                >
                  <Maximize2 className="w-4 h-4" /> Layar Penuh (F5)
                </button>
                <button
                  type="button"
                  className="btn sm"
                  onClick={handleDownloadHtml5PowerPoint}
                >
                  <FileCode2 className="w-3.5 h-3.5" /> Unduh PowerPoint HTML5 (.html)
                </button>
                <button type="button" className="btn sm" onClick={handleExportActiveJson}>
                  <Download className="w-3.5 h-3.5" /> Unduh JSON
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

            {/* Sub-Tab Navigasi Workspace */}
            <div className="flex flex-wrap items-center gap-2 border-b border-[#e9e4d4] pb-2">
              <button
                type="button"
                onClick={() => setWorkspaceTab('presentasi')}
                className={`btn sm ${workspaceTab === 'presentasi' ? 'primary' : ''}`}
              >
                <MonitorPlay className="w-3.5 h-3.5" /> Tayangan PowerPoint (HTML5/JS)
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceTab('edit')}
                className={`btn sm ${workspaceTab === 'edit' ? 'primary' : ''}`}
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit Slide &amp; Materi ({activeMedia.slides.length})
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceTab('json')}
                className={`btn sm ${workspaceTab === 'json' ? 'primary' : ''}`}
              >
                <Code2 className="w-3.5 h-3.5" /> JSON Media (Hasil AI / Edit / Salin)
              </button>
            </div>

            {/* TAB 1: PEMUTAR POWERPOINT HTML5/JS INTERAKTIF */}
            {workspaceTab === 'presentasi' && currentSlide && (
              <div className="space-y-3">
                {/* Ribbon PowerPoint */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#f3f6f4] border border-[#dce4df]">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#33443c]">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-[#0f6b58]" />
                      <span>Tema:</span>
                      <select
                        className="mini-select"
                        value={activeThemeKey}
                        onChange={(e) =>
                          mutateActiveMedia((m) => ({
                            ...m,
                            tema: e.target.value as MediaThemeKey,
                          }))
                        }
                      >
                        {Object.entries(THEME_STYLES).map(([k, cfg]) => (
                          <option key={k} value={k}>
                            {cfg.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#33443c]">
                      <span>Transisi:</span>
                      <select
                        className="mini-select"
                        value={transitionType}
                        onChange={(e) => setTransitionType(e.target.value as TransitionType)}
                      >
                        <option value="slide">Geser (Slide)</option>
                        <option value="fade">Pudar (Fade)</option>
                        <option value="zoom">Perbesar (Zoom)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStepMode((v) => !v)}
                      className={`btn sm ${stepMode ? 'primary' : ''}`}
                    >
                      Mode Poin Bertahap: {stepMode ? 'Aktif' : 'Mati'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTeacherNotes((v) => !v)}
                      className={`btn sm ${showTeacherNotes ? 'primary' : ''}`}
                    >
                      <Eye className="w-3.5 h-3.5" /> Catatan Guru
                    </button>
                  </div>
                </div>

                {/* Area Utama PowerPoint: Sidebar Filmstrip + Kanvas Slide 16:9 */}
                <div
                  style={{ background: theme.outerBg }}
                  className="rounded-2xl p-3 sm:p-4 border border-[#233b35] grid grid-cols-1 lg:grid-cols-12 gap-4"
                >
                  {/* Thumbnail Filmstrip Kiri */}
                  <div className="lg:col-span-3 max-h-[520px] overflow-y-auto space-y-2 pr-1">
                    {activeMedia.slides.map((sl, sIdx) => {
                      const active = sIdx === currentSlideIdx;
                      return (
                        <button
                          key={sl.id}
                          type="button"
                          onClick={() => setCurrentSlideIdx(sIdx)}
                          className={`w-full text-left p-2.5 rounded-xl border-2 transition cursor-pointer ${
                            active
                              ? 'bg-white/15 border-[#f0cf82] text-white'
                              : 'bg-white/5 border-white/10 text-[#cbd9d4] hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] font-bold text-[#f0cf82] mb-1">
                            <span>SLIDE {sIdx + 1}</span>
                            <span>{SLIDE_TIPE_LABELS[sl.tipe] || sl.tipe}</span>
                          </div>
                          <div className="text-xs font-semibold line-clamp-2 leading-snug">
                            {sl.judulSlide}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Stage Slide Kanan */}
                  <div className="lg:col-span-9 flex flex-col gap-3">
                    {renderSlideCanvas(currentSlide, currentSlideIdx, activeMedia.slides.length)}

                    {/* Catatan Guru & Ide Visual */}
                    {showTeacherNotes &&
                      (currentSlide.visualIde || currentSlide.catatanGuru) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-black/30 border border-white/15 rounded-xl p-3 text-xs text-[#dce8e4]">
                          <div>
                            <b className="text-[#f0cf82]">Saran Visual / Bagan: </b>
                            {currentSlide.visualIde || '-'}
                          </div>
                          <div>
                            <b className="text-[#f0cf82]">Catatan Pembicara (Guru): </b>
                            {currentSlide.catatanGuru || '-'}
                          </div>
                        </div>
                      )}

                    {/* Kontrol Navigasi Slide Bawah */}
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-black/35 border border-white/15 rounded-xl px-3.5 py-2.5 text-white">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={currentSlideIdx === 0}
                          onClick={() => setCurrentSlideIdx(0)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          title="Slide Pertama"
                        >
                          <ChevronsLeft className="w-3.5 h-3.5" /> Awal
                        </button>
                        <button
                          type="button"
                          disabled={currentSlideIdx === 0}
                          onClick={handlePrevSlide}
                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
                        </button>
                      </div>

                      <div className="flex-1 max-w-xs mx-2 hidden sm:block">
                        <div className="h-2 rounded-full bg-white/15 overflow-hidden">
                          <div
                            className="h-full bg-[#f0cf82] transition-all duration-300"
                            style={{
                              width: `${
                                ((currentSlideIdx + 1) / activeMedia.slides.length) * 100
                              }%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#f0cf82] mr-1">
                          {currentSlideIdx + 1} / {activeMedia.slides.length}
                        </span>
                        {stepMode && revealedPoints < currentSlide.poinUtama.length && (
                          <button
                            type="button"
                            onClick={handleNextStepOrSlide}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold cursor-pointer"
                          >
                            + Poin ({revealedPoints}/{currentSlide.poinUtama.length})
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={
                            currentSlideIdx >= activeMedia.slides.length - 1 &&
                            (!stepMode || revealedPoints >= currentSlide.poinUtama.length)
                          }
                          onClick={handleNextStepOrSlide}
                          className="px-3 py-1.5 rounded-lg bg-[#c7a45b] hover:bg-[#d8b870] disabled:opacity-40 text-[#062720] text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          Berikutnya <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={currentSlideIdx >= activeMedia.slides.length - 1}
                          onClick={() => setCurrentSlideIdx(activeMedia.slides.length - 1)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          title="Slide Terakhir"
                        >
                          Akhir <ChevronsRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: EDITOR SLIDE & IDENTITAS MEDIA */}
            {workspaceTab === 'edit' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="f">Judul Media</label>
                    <input
                      className="in"
                      value={activeMedia.judul}
                      onChange={(e) =>
                        mutateActiveMedia((m) => ({ ...m, judul: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="f">Subjudul</label>
                    <input
                      className="in"
                      value={activeMedia.subjudul || ''}
                      onChange={(e) =>
                        mutateActiveMedia((m) => ({ ...m, subjudul: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="f">Tujuan Pembelajaran</label>
                    <input
                      className="in"
                      value={activeMedia.tujuanPembelajaran || ''}
                      onChange={(e) =>
                        mutateActiveMedia((m) => ({
                          ...m,
                          tujuanPembelajaran: e.target.value,
                        }))
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
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-[#0b3c32] text-[#fff8e8] text-xs font-bold">
                            Slide {idx + 1}
                          </span>
                          <select
                            className="mini-select"
                            value={sl.tipe}
                            onChange={(e) =>
                              handleUpdateSlide(sl.id, {
                                tipe: e.target.value as MediaSlideTipe,
                              })
                            }
                          >
                            {Object.entries(SLIDE_TIPE_LABELS).map(([k, label]) => (
                              <option key={k} value={k}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <select
                            className="mini-select"
                            value={sl.layout || 'standar'}
                            onChange={(e) =>
                              handleUpdateSlide(sl.id, {
                                layout: e.target.value as MediaSlideLayout,
                              })
                            }
                          >
                            {Object.entries(SLIDE_LAYOUT_LABELS).map(([k, label]) => (
                              <option key={k} value={k}>
                                Tata Letak: {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="btn sm"
                            onClick={() => {
                              setCurrentSlideIdx(idx);
                              setWorkspaceTab('presentasi');
                              setIsFullscreenOverlay(true);
                            }}
                            title="Tayangkan layar penuh mulai slide ini"
                          >
                            <MonitorPlay className="w-3.5 h-3.5" /> Tayangkan
                          </button>
                          <button
                            type="button"
                            className="btn sm"
                            disabled={idx === 0}
                            onClick={() => handleMoveSlide(idx, -1)}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            className="btn sm"
                            disabled={idx === activeMedia.slides.length - 1}
                            onClick={() => handleMoveSlide(idx, 1)}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            className="btn sm danger"
                            onClick={() => handleDeleteSlide(sl.id)}
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
                          <label className="f">Pertanyaan Interaktif Siswa</label>
                          <input
                            className="in"
                            placeholder="Pertanyaan diskusi atau cek pemahaman..."
                            value={sl.pertanyaanInteraktif || ''}
                            onChange={(e) =>
                              handleUpdateSlide(sl.id, {
                                pertanyaanInteraktif: e.target.value,
                              })
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
                            onChange={(e) =>
                              handleUpdateSlide(sl.id, { ringkasan: e.target.value })
                            }
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
                          <label className="f">Langkah Diagram Alur (1 Baris = 1 Tahap, Opsional)</label>
                          <textarea
                            rows={2}
                            className="in text-xs"
                            placeholder="Langkah 1&#10;Langkah 2&#10;Langkah 3"
                            value={(sl.diagramLangkah || []).join('\n')}
                            onChange={(e) => {
                              const arr = e.target.value
                                .split('\n')
                                .map((s) => s.trim())
                                .filter(Boolean);
                              handleUpdateSlide(sl.id, {
                                diagramLangkah: arr.length > 0 ? arr : undefined,
                              });
                            }}
                          />
                        </div>
                        <div>
                          <label className="f">Kunci / Arah Jawaban Interaktif (Opsional)</label>
                          <textarea
                            rows={2}
                            className="in text-xs"
                            placeholder="Muncul saat tombol Tampilkan Jawaban ditekan..."
                            value={sl.jawabanInteraktif || ''}
                            onChange={(e) =>
                              handleUpdateSlide(sl.id, { jawabanInteraktif: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="f">Ide Visual / Bagan / Ilustrasi</label>
                          <input
                            className="in text-xs"
                            value={sl.visualIde}
                            onChange={(e) =>
                              handleUpdateSlide(sl.id, { visualIde: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className="f">Catatan Penyampaian Guru (Speaker Notes)</label>
                          <input
                            className="in text-xs"
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
            )}

            {/* TAB 3: JSON MEDIA (HASIL GENERATE AI / TEMPEL / EDIT LANGSUNG) */}
            {workspaceTab === 'json' && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-[#eaf5f3] border border-[#bcd6d2] text-xs text-[#22473d] flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Berikut adalah data <b>JSON Media Pembelajaran</b> (hasil Generate AI atau impor JSON). Anda dapat menyalin, mengedit langsung, lalu klik <b>Terapkan ke Pemutar PowerPoint HTML5/JS</b>.
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn sm" onClick={handleCopyActiveJson}>
                      <Copy className="w-3.5 h-3.5" /> Salin JSON
                    </button>
                    <button type="button" className="btn sm" onClick={handleExportActiveJson}>
                      <Download className="w-3.5 h-3.5" /> Unduh .json
                    </button>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => {
                        setActiveJsonDraft(JSON.stringify(activeMedia, null, 2));
                        setActiveJsonError(null);
                        api?.toast('JSON dimuat ulang dari kondisi slide saat ini.');
                      }}
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang JSON
                    </button>
                  </div>
                </div>

                <textarea
                  rows={18}
                  className="in text-xs font-mono leading-relaxed bg-[#fcfdfb]"
                  value={activeJsonDraft}
                  onChange={(e) => {
                    setActiveJsonDraft(e.target.value);
                    if (activeJsonError) setActiveJsonError(null);
                  }}
                />

                {activeJsonError && (
                  <div className="p-2.5 rounded-lg bg-[#fbeeed] border border-[#e3b9b6] text-xs text-[#8a1c16]">
                    {activeJsonError}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    className="btn primary"
                    onClick={handleApplyEditedActiveJson}
                  >
                    <MonitorPlay className="w-4 h-4" /> Terapkan Perubahan JSON &amp; Jalankan PowerPoint
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={handleDownloadHtml5PowerPoint}
                  >
                    <FileCode2 className="w-4 h-4" /> Unduh File PowerPoint HTML5 (.html)
                  </button>
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
                {sl.diagramLangkah && sl.diagramLangkah.length > 0 && (
                  <div style={{ fontSize: '11px', marginTop: '4px' }}>
                    <b>Alur:</b> {sl.diagramLangkah.join(' → ')}
                  </div>
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
          <b>Generate Media JSON (AI)</b> atau gunakan <b>Salin Prompt &amp; Tempel JSON</b> untuk langsung dijalankan seperti PowerPoint HTML5/JS.
        </div>
      )}
    </div>
  );
};
