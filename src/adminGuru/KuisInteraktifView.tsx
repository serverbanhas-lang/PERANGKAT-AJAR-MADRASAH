import React, { useMemo, useState } from 'react';
import {
  BookOpenCheck,
  Check,
  Copy,
  Eye,
  Globe,
  Lock,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Unlock,
} from 'lucide-react';
import {
  createEmptyGradeRow,
  createUid,
  DEFAULT_WEIGHTS,
  getActiveMapelList,
  getAdminGuruState,
  getAppApi,
  getBahanAjarSources,
  getDynamicTPs,
  getLegacyState,
  updateAdminGuruState,
} from './bridge';
import { StudentQuizView } from './StudentQuizView';
import type { QuizItem, QuizQuestion, QuizSubmission } from '../types/adminGuru';

export const KuisInteraktifView: React.FC = () => {
  const [adminState, setAdminState] = useState(() => getAdminGuruState());
  const legacy = getLegacyState();
  const api = getAppApi();

  const bahanSources = useMemo(() => getBahanAjarSources(legacy), [legacy]);
  const dynamicTPs = useMemo(() => getDynamicTPs(legacy), [legacy]);
  const mapelList = useMemo(() => getActiveMapelList(legacy), [legacy]);

  const [selectedQuizId, setSelectedQuizId] = useState<string>(adminState.quizzes[0]?.id || '');

  // Generator & Config form state
  const [selectedUnitId, setSelectedUnitId] = useState<string>(bahanSources[0]?.unitId || '');
  const [customMateriText, setCustomMateriText] = useState<string>(
    bahanSources[0]?.plainText || ''
  );
  const [judulKuis, setJudulKuis] = useState<string>(
    bahanSources[0] ? `Kuis: ${bahanSources[0].judul}` : 'Kuis Pemahaman Materi'
  );
  const [selectedKelasId, setSelectedKelasId] = useState<string>(
    adminState.classes[0]?.id || 'kls_10_a'
  );
  const [selectedMapel, setSelectedMapel] = useState<string>(
    mapelList[0] || 'Mata Pelajaran Utama'
  );
  const [selectedTpKey, setSelectedTpKey] = useState<string>(dynamicTPs[0]?.key || 'tp1');
  const [jumlahPG, setJumlahPG] = useState<number>(5);
  const [jumlahEsai, setJumlahEsai] = useState<number>(2);
  const [kesulitan, setKesulitan] = useState<string>('Campuran (LOTS & HOTS)');
  const [durasi, setDurasi] = useState<number>(25);

  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [fetchingScores, setFetchingScores] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [editingEssaySub, setEditingEssaySub] = useState<QuizSubmission | null>(null);
  const [essayScoresDraft, setEssayScoresDraft] = useState<Record<string, number>>({});

  const activeQuiz: QuizItem | undefined = useMemo(
    () => adminState.quizzes.find((q) => q.id === selectedQuizId),
    [adminState.quizzes, selectedQuizId]
  );

  const handleSelectBahanSource = (unitId: string) => {
    setSelectedUnitId(unitId);
    const found = bahanSources.find((b) => b.unitId === unitId);
    if (found) {
      setCustomMateriText(found.plainText);
      setJudulKuis(`Kuis: ${found.judul}`);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!customMateriText.trim()) {
      api?.toast('Pilih Bahan Ajar Mendalam atau isi teks materi terlebih dahulu.');
      return;
    }
    setGenerating(true);
    try {
      const kelasObj = adminState.classes.find((c) => c.id === selectedKelasId);
      const tpObj = dynamicTPs.find((t) => t.key === selectedTpKey);

      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materiText: customMateriText,
          judul: judulKuis,
          mapel: selectedMapel,
          kelas: kelasObj ? `${kelasObj.nama} (Kelas ${kelasObj.tingkat})` : '',
          tp: tpObj?.fullText || '',
          jumlahPG,
          jumlahEsai,
          tingkatKesulitan: kesulitan,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Gagal men-generate soal (HTTP ${res.status})`);
      }
      const questions: QuizQuestion[] = Array.isArray(data.questions) ? data.questions : [];
      if (questions.length === 0) {
        throw new Error('AI tidak menghasilkan soal. Coba ulangi dengan teks bahan ajar yang lebih jelas.');
      }

      const newId = createUid('quiz');
      const newQuiz: QuizItem = {
        id: newId,
        code: '',
        judul: judulKuis.trim() || 'Kuis Interaktif',
        mapel: selectedMapel,
        kelasId: selectedKelasId,
        kelasLabel: kelasObj?.nama || '',
        unitId: selectedUnitId || undefined,
        tpKey: selectedTpKey,
        tpLabel: tpObj?.shortLabel || selectedTpKey.toUpperCase(),
        durationMinutes: durasi,
        isOpen: true,
        questions,
        submissions: [],
      };

      const updated = updateAdminGuruState((prev) => ({
        ...prev,
        quizzes: [newQuiz, ...prev.quizzes],
      }));
      setAdminState(updated);
      setSelectedQuizId(newId);
      api?.toast(`Berhasil men-generate ${questions.length} soal kuis dari Bahan Ajar!`);
    } catch (err) {
      api?.toast(err instanceof Error ? err.message : 'Gagal membuat soal dengan AI.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateBlankQuiz = () => {
    const kelasObj = adminState.classes.find((c) => c.id === selectedKelasId);
    const tpObj = dynamicTPs.find((t) => t.key === selectedTpKey);
    const newId = createUid('quiz');
    const newQuiz: QuizItem = {
      id: newId,
      code: '',
      judul: judulKuis.trim() || 'Kuis Manual Baru',
      mapel: selectedMapel,
      kelasId: selectedKelasId,
      kelasLabel: kelasObj?.nama || '',
      tpKey: selectedTpKey,
      tpLabel: tpObj?.shortLabel || selectedTpKey.toUpperCase(),
      durationMinutes: durasi,
      isOpen: true,
      questions: [
        {
          id: createUid('q'),
          type: 'pg',
          question: 'Tuliskan pertanyaan di sini...',
          options: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
          correctAnswerIndex: 0,
          explanation: '',
          essayRubric: '',
          points: 10,
        },
      ],
      submissions: [],
    };
    const updated = updateAdminGuruState((prev) => ({
      ...prev,
      quizzes: [newQuiz, ...prev.quizzes],
    }));
    setAdminState(updated);
    setSelectedQuizId(newId);
    api?.toast('Draf kuis manual dibuat.');
  };

  const mutateActiveQuiz = (updater: (q: QuizItem) => QuizItem) => {
    if (!activeQuiz) return;
    const updated = updateAdminGuruState((prev) => ({
      ...prev,
      quizzes: prev.quizzes.map((q) => (q.id === activeQuiz.id ? updater(q) : q)),
    }));
    setAdminState(updated);
  };

  const handleAddQuestion = (type: 'pg' | 'esai') => {
    mutateActiveQuiz((q) => ({
      ...q,
      questions: [
        ...q.questions,
        {
          id: createUid('q'),
          type,
          question: '',
          options: type === 'pg' ? ['Opsi A', 'Opsi B', 'Opsi C', 'Opsi D'] : [],
          correctAnswerIndex: 0,
          explanation: '',
          essayRubric: '',
          points: type === 'pg' ? 10 : 20,
        },
      ],
    }));
  };

  const handleUpdateQuestion = (qId: string, patch: Partial<QuizQuestion>) => {
    mutateActiveQuiz((quiz) => ({
      ...quiz,
      questions: quiz.questions.map((item) => (item.id === qId ? { ...item, ...patch } : item)),
    }));
  };

  const handleDeleteQuestion = (qId: string) => {
    mutateActiveQuiz((quiz) => ({
      ...quiz,
      questions: quiz.questions.filter((item) => item.id !== qId),
    }));
  };

  const handlePublishQuiz = async () => {
    if (!activeQuiz) return;
    if (activeQuiz.questions.length === 0) {
      api?.toast('Tambahkan minimal 1 soal sebelum mempublikasikan kuis.');
      return;
    }
    setPublishing(true);
    try {
      const roster = adminState.students
        .filter((s) => s.kelasId === activeQuiz.kelasId && s.status !== 'nonaktif')
        .map((s) => ({ id: s.id, nisn: s.nisn, nama: s.nama }));

      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeQuiz.id,
          code: activeQuiz.code || undefined,
          judul: activeQuiz.judul,
          mapel: activeQuiz.mapel,
          kelasId: activeQuiz.kelasId,
          kelasLabel: activeQuiz.kelasLabel,
          tpKey: activeQuiz.tpKey,
          tpLabel: activeQuiz.tpLabel,
          durationMinutes: activeQuiz.durationMinutes,
          isOpen: activeQuiz.isOpen,
          questions: activeQuiz.questions,
          roster,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Gagal mempublikasikan kuis (HTTP ${res.status})`);
      }

      mutateActiveQuiz((q) => ({
        ...q,
        code: data.code,
        isOpen: data.isOpen,
        publishedAt: data.updatedAt || new Date().toISOString(),
      }));
      api?.toast(`Kuis dipublikasikan! Kode akses siswa: ${data.code}`);
    } catch (err) {
      api?.toast(err instanceof Error ? err.message : 'Gagal mempublikasikan kuis.');
    } finally {
      setPublishing(false);
    }
  };

  const handleToggleOpen = async () => {
    if (!activeQuiz || !activeQuiz.code) return;
    const nextOpen = !activeQuiz.isOpen;
    try {
      const res = await fetch(`/api/quizzes/${encodeURIComponent(activeQuiz.code)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOpen: nextOpen }),
      });
      if (!res.ok) throw new Error('Gagal mengubah status kuis.');
      mutateActiveQuiz((q) => ({ ...q, isOpen: nextOpen }));
      api?.toast(nextOpen ? 'Link kuis dibuka kembali untuk siswa.' : 'Link kuis ditutup.');
    } catch (err) {
      api?.toast(err instanceof Error ? err.message : 'Gagal mengubah status link kuis.');
    }
  };

  const handleFetchResults = async () => {
    if (!activeQuiz || !activeQuiz.code) return;
    setFetchingScores(true);
    try {
      const res = await fetch(`/api/quizzes/${encodeURIComponent(activeQuiz.code)}/results`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil rekap skor.');
      const submissions: QuizSubmission[] = Array.isArray(data.submissions) ? data.submissions : [];
      mutateActiveQuiz((q) => ({ ...q, submissions }));
      api?.toast(`Rekap diperbarui: ${submissions.length} siswa telah mengerjakan.`);
    } catch (err) {
      api?.toast(err instanceof Error ? err.message : 'Gagal mengambil skor dari server.');
    } finally {
      setFetchingScores(false);
    }
  };

  const handleSaveEssayScores = async () => {
    if (!activeQuiz || !activeQuiz.code || !editingEssaySub) return;
    try {
      const res = await fetch(
        `/api/quizzes/${encodeURIComponent(activeQuiz.code)}/submissions/${encodeURIComponent(editingEssaySub.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ essayScores: essayScoresDraft }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan nilai esai.');
      mutateActiveQuiz((q) => ({
        ...q,
        submissions: q.submissions.map((s) =>
          s.id === editingEssaySub.id ? data.submission : s
        ),
      }));
      setEditingEssaySub(null);
      api?.toast('Nilai esai tersimpan & skor total diperbarui.');
    } catch (err) {
      api?.toast(err instanceof Error ? err.message : 'Gagal menyimpan penilaian esai.');
    }
  };

  const handleSyncToGradeBook = () => {
    if (!activeQuiz || activeQuiz.submissions.length === 0) {
      api?.toast('Belum ada skor siswa untuk disinkronkan.');
      return;
    }

    const gradeKey = `${activeQuiz.kelasId}::${activeQuiz.mapel}`;
    let matchedCount = 0;

    const updated = updateAdminGuruState((prev) => {
      const classStudents = prev.students.filter((s) => s.kelasId === activeQuiz.kelasId);
      const existingBook = prev.grades[gradeKey] || {
        weights: { ...DEFAULT_WEIGHTS },
        tpCount: Math.max(5, dynamicTPs.length),
        rows: {},
      };
      const nextRows = { ...existingBook.rows };

      activeQuiz.submissions.forEach((sub) => {
        const studentMatch =
          (sub.studentId && classStudents.find((s) => s.id === sub.studentId)) ||
          (sub.nisn && classStudents.find((s) => s.nisn.trim() === sub.nisn.trim())) ||
          classStudents.find(
            (s) => s.nama.trim().toLowerCase() === sub.studentName.trim().toLowerCase()
          );

        if (studentMatch) {
          matchedCount++;
          const prevRow = nextRows[studentMatch.id] || createEmptyGradeRow();
          nextRows[studentMatch.id] = {
            ...prevRow,
            formatif: {
              ...prevRow.formatif,
              [activeQuiz.tpKey]: sub.totalScore,
            },
          };
        }
      });

      return {
        ...prev,
        grades: {
          ...prev.grades,
          [gradeKey]: {
            ...existingBook,
            rows: nextRows,
          },
        },
        quizzes: prev.quizzes.map((q) =>
          q.id === activeQuiz.id ? { ...q, syncedToGradeAt: new Date().toISOString() } : q
        ),
      };
    });

    setAdminState(updated);
    if (matchedCount > 0) {
      api?.toast(
        `Berhasil menyinkronkan nilai ${matchedCount} siswa ke kolom Formatif ${activeQuiz.tpKey.toUpperCase()} di Daftar Nilai Harian!`
      );
    } else {
      api?.toast(
        'Belum ada nama/NISN pengiriman siswa yang cocok dengan daftar siswa di kelas ini.'
      );
    }
  };

  const handleDeleteQuiz = async (quiz: QuizItem) => {
    if (quiz.code) {
      fetch(`/api/quizzes/${encodeURIComponent(quiz.code)}`, { method: 'DELETE' }).catch(() => {});
    }
    const updated = updateAdminGuruState((prev) => ({
      ...prev,
      quizzes: prev.quizzes.filter((q) => q.id !== quiz.id),
    }));
    setAdminState(updated);
    if (selectedQuizId === quiz.id) {
      setSelectedQuizId(updated.quizzes[0]?.id || '');
    }
    api?.toast('Kuis dihapus.');
  };

  const studentLink = activeQuiz?.code
    ? `${window.location.origin}/?kuis=${activeQuiz.code}`
    : '';

  const handleCopyLink = async () => {
    if (!studentLink) return;
    try {
      await navigator.clipboard.writeText(studentLink);
      api?.toast('Tautan kuis siswa disalin ke clipboard!');
    } catch {
      api?.toast(`Salin manual tautan ini: ${studentLink}`);
    }
  };

  if (previewCode) {
    return <StudentQuizView code={previewCode} previewMode onClose={() => setPreviewCode(null)} />;
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-4">
      {/* Panel 1: Generator Soal AI dari Bahan Ajar Mendalam */}
      <div className="panel noprint !max-w-none">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e9e4d4] pb-3 mb-4">
          <div>
            <h2 className="!border-0 !pb-0 !mb-1">Kuis Interaktif (AI / Auto-Generate)</h2>
            <p className="hint !mb-0">
              Tarik materi langsung dari <b>Bahan Ajar Mendalam / Konten Materi</b>, buat soal PG &amp; Esai otomatis, bagikan <b>Link / Kode Akses Siswa</b> berbasis web, dan sinkronkan skor ke <b>Nilai Formatif</b>.
            </p>
          </div>
          <button type="button" className="btn sm" onClick={handleCreateBlankQuiz}>
            <Plus className="w-4 h-4" />
            Buat Kuis Manual
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 space-y-3">
            <div>
              <label className="f">Sumber dari Bahan Ajar Mendalam / Pertemuan</label>
              <select
                className="in"
                value={selectedUnitId}
                onChange={(e) => handleSelectBahanSource(e.target.value)}
              >
                {bahanSources.length === 0 && (
                  <option value="">(Belum ada pertemuan — tempel teks materi di bawah)</option>
                )}
                {bahanSources.map((b) => (
                  <option key={b.unitId} value={b.unitId}>
                    Pertemuan {b.meetingNumber} (Smt {b.smt}): {b.judul}{' '}
                    {b.hasDeepContent ? '✓' : '(Ringkas)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="f">Isi Teks Bahan Ajar (Bisa Diedit Sebelum Generate)</label>
              <textarea
                rows={7}
                className="in text-xs"
                placeholder="Pilih pertemuan di atas atau tempel ringkasan bahan ajar di sini..."
                value={customMateriText}
                onChange={(e) => setCustomMateriText(e.target.value)}
              />
            </div>
          </div>

          <div className="lg:col-span-7 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="f">Judul Kuis</label>
                <input
                  className="in"
                  value={judulKuis}
                  onChange={(e) => setJudulKuis(e.target.value)}
                />
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
              <div>
                <label className="f">Sinkron ke Kolom Nilai Formatif</label>
                <select
                  className="in"
                  value={selectedTpKey}
                  onChange={(e) => setSelectedTpKey(e.target.value)}
                >
                  {dynamicTPs.map((tp) => (
                    <option key={tp.key} value={tp.key}>
                      {tp.shortLabel}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="f">Soal PG</label>
                <input
                  type="number"
                  min={0}
                  max={25}
                  className="in"
                  value={jumlahPG}
                  onChange={(e) => setJumlahPG(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="f">Soal Esai</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  className="in"
                  value={jumlahEsai}
                  onChange={(e) => setJumlahEsai(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="f">Durasi (Menit)</label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  className="in"
                  value={durasi}
                  onChange={(e) => setDurasi(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="f">Tingkat Kesulitan</label>
                <select
                  className="in"
                  value={kesulitan}
                  onChange={(e) => setKesulitan(e.target.value)}
                >
                  <option value="Dasar (LOTS)">Dasar (LOTS)</option>
                  <option value="Campuran (LOTS & HOTS)">Campuran (LOTS &amp; HOTS)</option>
                  <option value="Penalaran Tinggi (HOTS)">Penalaran (HOTS)</option>
                </select>
              </div>
            </div>

            <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-[#64736c]">
                Soal otomatis disusun terstruktur (JSON) lengkap dengan opsi A–E, kunci, dan pembahasan.
              </span>
              <button
                type="button"
                disabled={generating}
                onClick={handleGenerateQuestions}
                className="btn primary"
              >
                <Sparkles className="w-4 h-4" />
                {generating ? 'Menyusun Soal dengan Gemini AI...' : 'Generate Soal Otomatis (AI)'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Daftar Kuis Tersimpan */}
      {adminState.quizzes.length > 0 && (
        <div className="panel noprint !max-w-none">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="!border-0 !pb-0 !mb-0">Daftar Kuis ({adminState.quizzes.length})</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {adminState.quizzes.map((q) => {
              const active = q.id === activeQuiz?.id;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setSelectedQuizId(q.id)}
                  className={`px-3 py-2 rounded-lg border text-left transition cursor-pointer ${
                    active
                      ? 'bg-[#e2f0e8] border-[#126451] text-[#0b3c32]'
                      : 'bg-[#fffdf8] border-[#d9e2d9] hover:bg-[#f4f7ef]'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <span>{q.judul}</span>
                    {q.code && (
                      <span className="px-1.5 py-0.5 rounded bg-[#0b3c32] text-[#fff8e8] text-[10px]">
                        {q.code}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#64736c]">
                    {q.kelasLabel || 'Semua'} · {q.questions.length} soal · {q.submissions.length} hasil
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Workspace Editor, Publikasi Link & Rekap Skor Kuis Terpilih */}
      {activeQuiz && (
        <div className="space-y-4">
          {/* Panel Publikasi & Link Siswa */}
          <div className="panel noprint !max-w-none border-l-4 border-l-[#c7a45b]">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="!border-0 !pb-0 !mb-1">{activeQuiz.judul}</h2>
                <div className="text-xs text-[#64736c] flex flex-wrap gap-2">
                  <span className="badge">{activeQuiz.kelasLabel || 'Kelas'}</span>
                  <span className="badge">{activeQuiz.mapel}</span>
                  <span className="badge hots">Target Nilai: {activeQuiz.tpLabel}</span>
                  <span className="badge">{activeQuiz.questions.length} Soal</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={publishing}
                  onClick={handlePublishQuiz}
                  className="btn primary"
                >
                  <Globe className="w-4 h-4" />
                  {publishing
                    ? 'Mempublikasikan...'
                    : activeQuiz.code
                      ? 'Perbarui Kuis Terpublikasi'
                      : 'Publikasikan & Buat Link Siswa'}
                </button>
                <button
                  type="button"
                  className="btn sm danger"
                  onClick={() => handleDeleteQuiz(activeQuiz)}
                >
                  <Trash2 className="w-4 h-4" /> Hapus Kuis
                </button>
              </div>
            </div>

            {activeQuiz.code ? (
              <div className="p-3.5 rounded-xl bg-[#eaf5f3] border border-[#bcd6d2] flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="text-xs font-bold text-[#0b3c32]">
                    Kode Akses Siswa:{' '}
                    <span className="px-2 py-0.5 rounded bg-[#0b3c32] text-[#fff8e8] font-mono">
                      {activeQuiz.code}
                    </span>{' '}
                    <span className="ml-2 font-normal">
                      ({activeQuiz.isOpen ? 'Status: Dibuka' : 'Status: Ditutup'})
                    </span>
                  </div>
                  <div className="text-xs font-mono text-[#126451] break-all">{studentLink}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn sm" onClick={handleCopyLink}>
                    <Copy className="w-3.5 h-3.5" /> Salin Link
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => setPreviewCode(activeQuiz.code)}
                  >
                    <Eye className="w-3.5 h-3.5" /> Pratinjau Mode Siswa
                  </button>
                  <button type="button" className="btn sm" onClick={handleToggleOpen}>
                    {activeQuiz.isOpen ? (
                      <>
                        <Lock className="w-3.5 h-3.5" /> Tutup Akses
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5" /> Buka Akses
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#6b4a00] bg-[#fff6e0] border border-[#f0d58a] rounded-lg px-3 py-2">
                Kuis ini masih berupa draf lokal. Periksa butir soal di bawah lalu klik{' '}
                <b>Publikasikan &amp; Buat Link Siswa</b> untuk menghasilkan kode akses web siswa.
              </div>
            )}
          </div>

          {/* Panel Rekap Skor Otomatis & Sinkronisasi ke Daftar Nilai */}
          {activeQuiz.code && (
            <div className="panel noprint !max-w-none">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9e4d4] pb-3 mb-3">
                <div>
                  <h2 className="!border-0 !pb-0 !mb-0.5">
                    Rekap Skor Siswa ({activeQuiz.submissions.length} Pengiriman)
                  </h2>
                  <p className="hint !mb-0">
                    Ambil hasil pengerjaan siswa dari server lalu sinkronkan ke kolom Formatif{' '}
                    <b>{activeQuiz.tpKey.toUpperCase()}</b> di Daftar Nilai Harian.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={fetchingScores}
                    className="btn sm"
                    onClick={handleFetchResults}
                  >
                    <RefreshCw className={`w-4 h-4 ${fetchingScores ? 'animate-spin' : ''}`} />
                    {fetchingScores ? 'Mengambil...' : 'Ambil / Segarkan Skor'}
                  </button>
                  <button
                    type="button"
                    className="btn sm primary"
                    onClick={handleSyncToGradeBook}
                  >
                    <BookOpenCheck className="w-4 h-4" />
                    Sinkronkan ke Formatif ({activeQuiz.tpKey.toUpperCase()})
                  </button>
                </div>
              </div>

              {activeQuiz.submissions.length === 0 ? (
                <div className="text-xs text-[#64736c] py-4 text-center">
                  Belum ada siswa yang mengirimkan jawaban. Bagikan link di atas lalu klik{' '}
                  <b>Ambil / Segarkan Skor</b>.
                </div>
              ) : (
                <div className="tw">
                  <table className="work">
                    <thead>
                      <tr>
                        <th className="c w-10">No</th>
                        <th>Nama Siswa</th>
                        <th>NISN</th>
                        <th className="c">Benar PG</th>
                        <th className="c">Skor PG</th>
                        <th className="c">Skor Total</th>
                        <th className="c">Status</th>
                        <th className="c">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeQuiz.submissions.map((sub, i) => (
                        <tr key={sub.id}>
                          <td className="c">{i + 1}</td>
                          <td className="font-semibold text-[#0b3c32]">{sub.studentName}</td>
                          <td className="font-mono text-xs">{sub.nisn || '-'}</td>
                          <td className="c">
                            {sub.pgCorrect}/{sub.pgTotal}
                          </td>
                          <td className="c font-semibold">{sub.pgScore}</td>
                          <td className="calc">{sub.totalScore}</td>
                          <td className="c">
                            <span
                              className={`badge ${sub.status === 'needs_essay_review' ? 'hots' : ''}`}
                            >
                              {sub.status === 'graded' ? 'Ternilai' : 'Perlu Nilai Esai'}
                            </span>
                          </td>
                          <td className="c">
                            {activeQuiz.questions.some((q) => q.type === 'esai') && (
                              <button
                                type="button"
                                className="btn sm"
                                onClick={() => {
                                  setEditingEssaySub(sub);
                                  setEssayScoresDraft({ ...sub.essayScores });
                                }}
                              >
                                Nilai Esai
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Modal/Panel Penilaian Esai */}
              {editingEssaySub && (
                <div className="mt-4 p-4 rounded-xl border border-[#126451] bg-[#f8faf5] space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-[#0b3c32]">
                      Penilaian Jawaban Esai: {editingEssaySub.studentName}
                    </h3>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => setEditingEssaySub(null)}
                    >
                      Tutup
                    </button>
                  </div>
                  {activeQuiz.questions
                    .filter((q) => q.type === 'esai')
                    .map((q, idx) => (
                      <div key={q.id} className="p-3 rounded-lg bg-white border border-[#d9e2d9] space-y-2">
                        <div className="font-semibold text-xs text-[#0b3c32]">
                          Esai {idx + 1} (Maks {q.points} poin): {q.question}
                        </div>
                        <div className="text-xs bg-[#f7faf5] p-2 rounded border border-[#e7eadf] whitespace-pre-wrap">
                          <b>Jawaban Siswa:</b> {String(editingEssaySub.answers[q.id] || '(Kosong)')}
                        </div>
                        {q.essayRubric && (
                          <div className="text-[11px] text-[#64736c]">
                            <b>Rubrik:</b> {q.essayRubric}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold">Berikan Poin (0–{q.points}):</label>
                          <input
                            type="number"
                            min={0}
                            max={q.points}
                            className="cell !w-20"
                            value={essayScoresDraft[q.id] ?? 0}
                            onChange={(e) =>
                              setEssayScoresDraft((prev) => ({
                                ...prev,
                                [q.id]: Math.max(0, Math.min(q.points, Number(e.target.value) || 0)),
                              }))
                            }
                          />
                        </div>
                      </div>
                    ))}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="btn sm primary"
                      onClick={handleSaveEssayScores}
                    >
                      <Check className="w-4 h-4" /> Simpan Skor Esai
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Panel Editor Butir Soal */}
          <div className="panel noprint !max-w-none space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e9e4d4] pb-3">
              <h2 className="!border-0 !pb-0 !mb-0">
                Editor Soal ({activeQuiz.questions.length} Butir)
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => handleAddQuestion('pg')}
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah PG
                </button>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => handleAddQuestion('esai')}
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Esai
                </button>
              </div>
            </div>

            {activeQuiz.questions.map((q, idx) => (
              <div
                key={q.id}
                className="p-4 rounded-xl border border-[#d9e2d9] bg-[#fffdf8] space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#0b3c32]">Soal {idx + 1}</span>
                    <span className={`badge ${q.type === 'esai' ? 'hots' : ''}`}>
                      {q.type === 'pg' ? 'Pilihan Ganda' : 'Esai'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-[#64736c]">Poin:</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      className="cell !w-16"
                      value={q.points}
                      onChange={(e) =>
                        handleUpdateQuestion(q.id, { points: Math.max(1, Number(e.target.value) || 10) })
                      }
                    />
                    <button
                      type="button"
                      className="btn sm danger"
                      onClick={() => handleDeleteQuestion(q.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <textarea
                  rows={2}
                  className="in text-sm"
                  placeholder="Tulis pertanyaan..."
                  value={q.question}
                  onChange={(e) => handleUpdateQuestion(q.id, { question: e.target.value })}
                />

                {q.type === 'pg' ? (
                  <div className="space-y-1.5">
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`ans_${q.id}`}
                          className="accent-[#126451]"
                          checked={q.correctAnswerIndex === oIdx}
                          onChange={() => handleUpdateQuestion(q.id, { correctAnswerIndex: oIdx })}
                          title="Tandai sebagai kunci jawaban benar"
                        />
                        <span className="text-xs font-bold w-5">
                          {String.fromCharCode(65 + oIdx)}.
                        </span>
                        <input
                          className="in text-xs !py-1.5"
                          value={opt}
                          onChange={(e) => {
                            const nextOpts = [...q.options];
                            nextOpts[oIdx] = e.target.value;
                            handleUpdateQuestion(q.id, { options: nextOpts });
                          }}
                        />
                      </div>
                    ))}
                    <input
                      className="in text-xs !py-1.5 mt-1"
                      placeholder="Pembahasan singkat (opsional)..."
                      value={q.explanation}
                      onChange={(e) => handleUpdateQuestion(q.id, { explanation: e.target.value })}
                    />
                  </div>
                ) : (
                  <input
                    className="in text-xs !py-1.5"
                    placeholder="Kunci / rubrik penilaian esai..."
                    value={q.essayRubric}
                    onChange={(e) => handleUpdateQuestion(q.id, { essayRubric: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
