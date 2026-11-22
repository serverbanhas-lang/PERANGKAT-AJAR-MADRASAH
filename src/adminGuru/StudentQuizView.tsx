import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Send,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';

interface PublicQuestion {
  id: string;
  type: 'pg' | 'esai';
  question: string;
  options: string[];
  points: number;
}

interface PublicQuizData {
  code: string;
  judul: string;
  mapel: string;
  kelasId: string;
  kelasLabel: string;
  tpLabel: string;
  durationMinutes: number;
  roster: Array<{ id: string; nisn: string; nama: string }>;
  questions: PublicQuestion[];
}

interface ReviewItem {
  id: string;
  type: 'pg' | 'esai';
  question: string;
  options: string[];
  studentAnswer: string | number | null;
  correctAnswerIndex: number | null;
  isCorrect: boolean | null;
  explanation: string;
}

interface SubmitResult {
  submission: {
    id: string;
    studentName: string;
    nisn: string;
    pgCorrect: number;
    pgTotal: number;
    pgScore: number;
    totalScore: number;
    status: 'graded' | 'needs_essay_review';
  };
  hasEssay: boolean;
  review: ReviewItem[];
}

interface StudentQuizViewProps {
  code: string;
  previewMode?: boolean;
  onClose?: () => void;
}

export const StudentQuizView: React.FC<StudentQuizViewProps> = ({
  code,
  previewMode = false,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<PublicQuizData | null>(null);

  // Student identity step
  const [started, setStarted] = useState(false);
  const [selectedRosterId, setSelectedRosterId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [nisn, setNisn] = useState('');
  const [identityError, setIdentityError] = useState('');

  // Quiz taking state
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`/api/quizzes/${encodeURIComponent(code.trim().toUpperCase())}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `Gagal memuat kuis (HTTP ${res.status})`);
        }
        if (active) {
          setQuiz(data);
          setSecondsLeft((Number(data.durationMinutes) || 30) * 60);
        }
      } catch (err) {
        if (active) {
          setErrorMsg(err instanceof Error ? err.message : 'Kuis tidak dapat dimuat.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [code]);

  useEffect(() => {
    if (!started || result || secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [started, result, secondsLeft]);

  const handleRosterSelect = (id: string) => {
    setSelectedRosterId(id);
    if (!quiz) return;
    const found = quiz.roster.find((r) => r.id === id);
    if (found) {
      setStudentName(found.nama);
      setNisn(found.nisn);
      setIdentityError('');
    }
  };

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      setIdentityError('Pilih atau masukkan nama lengkap terlebih dahulu.');
      return;
    }
    setIdentityError('');
    setStarted(true);
  };

  const answeredCount = useMemo(() => {
    if (!quiz) return 0;
    return quiz.questions.filter((q) => {
      const a = answers[q.id];
      return a !== undefined && a !== '';
    }).length;
  }, [quiz, answers]);

  const handleSubmit = async () => {
    if (!quiz || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`/api/quizzes/${encodeURIComponent(quiz.code)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedRosterId || undefined,
          studentName: studentName.trim(),
          nisn: nisn.trim(),
          kelasLabel: quiz.kelasLabel,
          answers,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Gagal mengirim jawaban (HTTP ${res.status})`);
      }
      setResult(data);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Gagal mengirim jawaban kuis.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#f3f4ed] text-[#172a26] py-6 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header Bar */}
        <div className="rounded-2xl bg-gradient-to-r from-[#073d32] via-[#0b5a49] to-[#126451] text-white p-5 shadow-md mb-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-[#f0d28f] font-bold">
              MA BANU HASYIM · KUIS INTERAKTIF SISWA
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-serif mt-1">
              {quiz ? quiz.judul : `Kode Akses: ${code.toUpperCase()}`}
            </h1>
            {quiz && (
              <div className="text-xs text-[#d8e8df] mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <span>Mapel: <b>{quiz.mapel || '-'}</b></span>
                <span>Kelas: <b>{quiz.kelasLabel || '-'}</b></span>
                <span>Kode: <b>{quiz.code}</b></span>
              </div>
            )}
          </div>
          {previewMode && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" /> Tutup Pratinjau
            </button>
          )}
        </div>

        {loading && (
          <div className="bg-[#fffdf7] border border-[#d9e2d9] rounded-xl p-8 text-center text-[#64736c]">
            Memuat soal kuis dari server...
          </div>
        )}

        {!loading && errorMsg && (
          <div className="bg-[#fbeeed] border border-[#e3b9b6] text-[#8a1c16] rounded-xl p-6 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-bold text-base mb-1">Kuis Tidak Dapat Diakses</h2>
              <p className="text-sm">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Step 1: Identitas Siswa */}
        {!loading && quiz && !started && !result && (
          <form
            onSubmit={handleStart}
            className="bg-[#fffdf7] border border-[#d9e2d9] rounded-xl p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-2 text-[#0b3c32] font-bold text-lg border-b border-[#e9e4d4] pb-2">
              <UserCheck className="w-5 h-5 text-[#126451]" />
              <span>Identitas Peserta Didik</span>
            </div>

            {quiz.tpLabel && (
              <div className="text-xs bg-[#eaf5f3] border border-[#bcd6d2] rounded-lg p-3 text-[#0b3c32]">
                <b>Tujuan Pembelajaran:</b> {quiz.tpLabel}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#f8faf5] border border-[#d9e2d9]">
                <div className="text-[#64736c]">Jumlah Soal</div>
                <div className="font-bold text-base text-[#0b3c32]">{quiz.questions.length} Butir</div>
              </div>
              <div className="p-3 rounded-lg bg-[#f8faf5] border border-[#d9e2d9]">
                <div className="text-[#64736c]">Durasi Pengerjaan</div>
                <div className="font-bold text-base text-[#0b3c32]">{quiz.durationMinutes} Menit</div>
              </div>
              <div className="p-3 rounded-lg bg-[#f8faf5] border border-[#d9e2d9]">
                <div className="text-[#64736c]">Kelas Sasaran</div>
                <div className="font-bold text-base text-[#0b3c32]">{quiz.kelasLabel || 'Umum'}</div>
              </div>
            </div>

            {quiz.roster.length > 0 && (
              <div>
                <label className="f">Pilih Nama Anda dari Daftar Kelas (Opsional)</label>
                <select
                  className="in"
                  value={selectedRosterId}
                  onChange={(e) => handleRosterSelect(e.target.value)}
                >
                  <option value="">-- Pilih Nama Siswa atau Isi Manual di Bawah --</option>
                  {quiz.roster.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nama} {r.nisn ? `(${r.nisn})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="f">Nama Lengkap Siswa *</label>
                <input
                  className="in"
                  placeholder="Ketik nama lengkap Anda"
                  value={studentName}
                  onChange={(e) => {
                    setStudentName(e.target.value);
                    if (selectedRosterId) setSelectedRosterId('');
                  }}
                  required
                />
              </div>
              <div>
                <label className="f">NIS / NISN</label>
                <input
                  className="in"
                  placeholder="Nomor Induk Siswa (opsional)"
                  value={nisn}
                  onChange={(e) => setNisn(e.target.value)}
                />
              </div>
            </div>

            {identityError && (
              <div className="text-xs text-[#b3261e] font-semibold">{identityError}</div>
            )}

            <button type="submit" className="btn primary w-full justify-center !py-3 !text-sm">
              Mulai Kerjakan Kuis Sekarang
            </button>
          </form>
        )}

        {/* Step 2: Lembar Pengerjaan Soal */}
        {!loading && quiz && started && !result && (
          <div className="space-y-4">
            <div className="sticky top-2 z-20 bg-[#fffdf7]/95 backdrop-blur border border-[#d9e2d9] rounded-xl px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs">
                Siswa: <b className="text-[#0b3c32]">{studentName}</b> · Terjawab{' '}
                <b>
                  {answeredCount}/{quiz.questions.length}
                </b>
              </div>
              <div
                className={`flex items-center gap-1.5 text-sm font-bold px-3 py-1 rounded-lg ${
                  secondsLeft < 120 ? 'bg-[#fbeeed] text-[#b3261e]' : 'bg-[#e2f0e8] text-[#0b3c32]'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>{formatTimer(secondsLeft)}</span>
              </div>
            </div>

            {quiz.questions.map((q, idx) => (
              <div
                key={q.id}
                className="bg-[#fffdf7] border border-[#d9e2d9] rounded-xl p-5 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-[#0b3c32]">
                    Soal {idx + 1}{' '}
                    <span className="text-xs font-normal text-[#64736c]">
                      ({q.type === 'pg' ? 'Pilihan Ganda' : 'Esai / Uraian'} · {q.points} poin)
                    </span>
                  </div>
                </div>

                <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-[#172a26]">
                  {q.question}
                </p>

                {q.type === 'pg' ? (
                  <div className="space-y-2 pt-1">
                    {q.options.map((opt, oIdx) => {
                      const letter = String.fromCharCode(65 + oIdx);
                      const checked = answers[q.id] === oIdx;
                      return (
                        <label
                          key={oIdx}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                            checked
                              ? 'bg-[#e2f0e8] border-[#126451] font-semibold'
                              : 'bg-white border-[#d9e2d9] hover:bg-[#f7faf5]'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q_${q.id}`}
                            className="mt-1 accent-[#126451]"
                            checked={checked}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: oIdx }))}
                          />
                          <span className="font-bold text-[#0b3c32] min-w-[20px]">{letter}.</span>
                          <span className="text-sm">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <textarea
                    rows={4}
                    className="in"
                    placeholder="Tuliskan jawaban uraian Anda di sini..."
                    value={String(answers[q.id] ?? '')}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  />
                )}
              </div>
            ))}

            {submitError && (
              <div className="err-msg text-sm font-semibold">{submitError}</div>
            )}

            <div className="bg-[#fffdf7] border border-[#d9e2d9] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[#64736c]">
                Pastikan seluruh jawaban sudah diperiksa sebelum dikirim.
              </span>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="btn primary !px-6 !py-2.5"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Mengirim Jawaban...' : 'Kirim Jawaban Kuis'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Hasil & Pembahasan Otomatis */}
        {!loading && result && (
          <div className="space-y-4">
            <div className="bg-[#fffdf7] border-2 border-[#126451] rounded-2xl p-6 text-center shadow-sm">
              <CheckCircle2 className="w-12 h-12 text-[#1c7a45] mx-auto mb-2" />
              <h2 className="text-2xl font-bold font-serif text-[#0b3c32]">
                Jawaban Berhasil Dikirim!
              </h2>
              <p className="text-sm text-[#64736c] mt-1">
                Terima kasih, <b>{result.submission.studentName}</b>. Nilai Anda telah terekam otomatis di sistem guru.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 text-left">
                <div className="p-3.5 rounded-xl bg-[#e2f0e8] border border-[#bcd6d2]">
                  <div className="text-xs text-[#0b3c32]">Skor Pilihan Ganda</div>
                  <div className="text-2xl font-extrabold text-[#0b3c32]">
                    {result.submission.pgScore}
                  </div>
                  <div className="text-[11px] text-[#315449]">
                    Benar {result.submission.pgCorrect} dari {result.submission.pgTotal} soal PG
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#f7efd9] border border-[#ead8a8]">
                  <div className="text-xs text-[#6b4a00]">Skor Total Saat Ini</div>
                  <div className="text-2xl font-extrabold text-[#6b4a00]">
                    {result.submission.totalScore}
                  </div>
                  <div className="text-[11px] text-[#805d1d]">
                    {result.submission.status === 'needs_essay_review'
                      ? 'Menunggu koreksi esai oleh guru'
                      : 'Nilai final terhitung otomatis'}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#f8faf5] border border-[#d9e2d9]">
                  <div className="text-xs text-[#64736c]">Status</div>
                  <div className="text-sm font-bold text-[#0b3c32] mt-1">
                    {result.submission.status === 'graded'
                      ? 'Selesai & Ternilai'
                      : 'PG Ternilai · Esai Menunggu Review'}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#fffdf7] border border-[#d9e2d9] rounded-xl p-5 space-y-3">
              <h3 className="font-bold text-[#0b3c32] border-b border-[#e9e4d4] pb-2">
                Ringkasan &amp; Pembahasan Jawaban
              </h3>
              {result.review.map((r, idx) => (
                <div key={r.id} className="p-3.5 rounded-lg border border-[#e7eadf] bg-white space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-sm text-[#0b3c32]">
                      {idx + 1}. {r.question}
                    </span>
                    {r.type === 'pg' && (
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded ${
                          r.isCorrect
                            ? 'bg-[#e1f3e8] text-[#1c7a45]'
                            : 'bg-[#f9d6d3] text-[#b3261e]'
                        }`}
                      >
                        {r.isCorrect ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Benar
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" /> Kurang Tepat
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  {r.type === 'pg' ? (
                    <div className="text-xs text-[#33444c] space-y-0.5">
                      <div>
                        Jawaban Anda:{' '}
                        <b>
                          {r.studentAnswer !== null && r.options[Number(r.studentAnswer)] !== undefined
                            ? `${String.fromCharCode(65 + Number(r.studentAnswer))}. ${r.options[Number(r.studentAnswer)]}`
                            : 'Tidak dijawab'}
                        </b>
                      </div>
                      {r.correctAnswerIndex !== null && (
                        <div className="text-[#126451]">
                          Kunci Jawaban:{' '}
                          <b>
                            {String.fromCharCode(65 + r.correctAnswerIndex)}. {r.options[r.correctAnswerIndex]}
                          </b>
                        </div>
                      )}
                      {r.explanation && (
                        <div className="text-[#64736c] italic pt-1">Pembahasan: {r.explanation}</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-[#33444c]">
                      <div className="font-semibold">Jawaban Esai Anda:</div>
                      <div className="p-2 mt-1 rounded bg-[#f8faf5] border border-[#e7eadf] whitespace-pre-wrap">
                        {String(r.studentAnswer || '(Kosong)')}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
