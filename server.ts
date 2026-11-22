import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, '.data');
const QUIZZES_FILE = path.join(DATA_DIR, 'quizzes.json');

interface QuizQuestionRecord {
  id: string;
  type: 'pg' | 'esai';
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  essayRubric: string;
  points: number;
}

interface QuizSubmissionRecord {
  id: string;
  submittedAt: string;
  studentId?: string;
  nisn: string;
  studentName: string;
  kelasLabel: string;
  answers: Record<string, string | number>;
  pgCorrect: number;
  pgTotal: number;
  pgScore: number;
  essayScores: Record<string, number>;
  totalScore: number;
  status: 'graded' | 'needs_essay_review';
}

interface PublishedQuizRecord {
  code: string;
  id: string;
  judul: string;
  mapel: string;
  kelasId: string;
  kelasLabel: string;
  tpKey: string;
  tpLabel: string;
  durationMinutes: number;
  isOpen: boolean;
  createdAt: string;
  updatedAt: string;
  questions: QuizQuestionRecord[];
  roster: Array<{ id: string; nisn: string; nama: string }>;
  submissions: QuizSubmissionRecord[];
}

function ensureDataStore(): Record<string, PublishedQuizRecord> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(QUIZZES_FILE)) {
    fs.writeFileSync(QUIZZES_FILE, JSON.stringify({}), 'utf8');
    return {};
  }
  try {
    const raw = fs.readFileSync(QUIZZES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveQuizzesStore(store: Record<string, PublishedQuizRecord>): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(QUIZZES_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function getGenAI(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY belum terpasang pada Settings > Secrets server. Gunakan tombol "Salin Prompt (Gemini / ChatGPT)" lalu "Tempel JSON", atau pasang API Key di Secrets panel.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseGeminiJson<T = Record<string, unknown>>(rawText: string | undefined): T {
  const trimmed = String(rawText ?? '').trim();
  if (!trimmed) {
    throw new Error('Respons AI kosong.');
  }
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenceMatch ? fenceMatch[1] : trimmed).trim();
  try {
    return JSON.parse(candidate) as T;
  } catch {
    const startObj = candidate.indexOf('{');
    const endObj = candidate.lastIndexOf('}');
    if (startObj !== -1 && endObj > startObj) {
      return JSON.parse(candidate.slice(startObj, endObj + 1)) as T;
    }
    throw new Error('Format JSON dari AI tidak valid.');
  }
}

function formatGeminiError(err: unknown, fallbackMsg: string): { status: number; message: string } {
  const rawMsg = err instanceof Error ? err.message : String(err || fallbackMsg);
  const lower = rawMsg.toLowerCase();

  if (lower.includes('gemini_api_key')) {
    return { status: 400, message: rawMsg };
  }
  if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('403') || lower.includes('401')) {
    return {
      status: 403,
      message:
        'API Key Gemini tidak valid atau ditolak. Periksa API Key di Settings > Secrets, atau gunakan menu "Salin Prompt & Tempel JSON".',
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return {
      status: 429,
      message:
        'Kuota Gemini API sedang penuh (429). Tunggu sebentar atau gunakan menu "Salin Prompt (Gemini / ChatGPT) & Tempel JSON".',
    };
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 404,
      message: `Model AI tidak ditemukan (${rawMsg}). Silakan gunakan menu "Salin Prompt & Tempel JSON".`,
    };
  }
  return { status: 500, message: rawMsg || fallbackMsg };
}

async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
  maxAttempts = 2
) {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      const isTransient = msg.includes('503') || msg.includes('unavailable') || msg.includes('429') || msg.includes('timeout');
      if (!isTransient || attempt === maxAttempts - 1) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
    }
  }
  throw lastErr;
}

function computeSubmissionScores(
  quiz: PublishedQuizRecord,
  answers: Record<string, string | number>,
  essayScoresInput?: Record<string, number>
): {
  pgCorrect: number;
  pgTotal: number;
  pgScore: number;
  essayScores: Record<string, number>;
  totalScore: number;
  status: 'graded' | 'needs_essay_review';
} {
  const pgQuestions = quiz.questions.filter((q) => q.type === 'pg');
  const essayQuestions = quiz.questions.filter((q) => q.type === 'esai');

  let pgCorrect = 0;
  let pgEarnedPts = 0;
  let pgMaxPts = 0;

  for (const q of pgQuestions) {
    const pts = Number(q.points) > 0 ? Number(q.points) : 10;
    pgMaxPts += pts;
    const ans = answers[q.id];
    if (ans !== undefined && ans !== '' && Number(ans) === Number(q.correctAnswerIndex)) {
      pgCorrect += 1;
      pgEarnedPts += pts;
    }
  }

  const pgScore = pgMaxPts > 0 ? Math.round((pgEarnedPts / pgMaxPts) * 100) : 0;

  const essayScores: Record<string, number> = {};
  let essayEarnedPts = 0;
  let essayMaxPts = 0;
  let allEssayGraded = true;

  for (const q of essayQuestions) {
    const pts = Number(q.points) > 0 ? Number(q.points) : 20;
    essayMaxPts += pts;
    const val = essayScoresInput ? essayScoresInput[q.id] : undefined;
    if (typeof val === 'number' && !Number.isNaN(val)) {
      const clamped = Math.max(0, Math.min(pts, val));
      essayScores[q.id] = clamped;
      essayEarnedPts += clamped;
    } else {
      allEssayGraded = false;
    }
  }

  const totalMax = pgMaxPts + essayMaxPts;
  const totalEarned = pgEarnedPts + essayEarnedPts;
  const totalScore = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;

  return {
    pgCorrect,
    pgTotal: pgQuestions.length,
    pgScore,
    essayScores,
    totalScore,
    status: essayQuestions.length > 0 && !allEssayGraded ? 'needs_essay_review' : 'graded',
  };
}

function generateAccessCode(existing: Record<string, PublishedQuizRecord>): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 25; attempt++) {
    let part = '';
    for (let i = 0; i < 5; i++) {
      part += chars[Math.floor(Math.random() * chars.length)];
    }
    const code = `MA-${part}`;
    if (!existing[code]) return code;
  }
  return `MA-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  // Endpoint materi ajar (kompatibel dengan Konten Materi & Bahan Ajar Mendalam)
  app.post('/api/generate-materi', async (req, res) => {
    try {
      const ai = getGenAI();
      const { mode, prompt, meeting, identitas, cp, tp, kbc, unit } = req.body || {};

      if (mode === 'bahan-ajar-mendalam' && prompt) {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: String(prompt),
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                judul: { type: Type.STRING },
                subjudul: { type: Type.STRING },
                pengantar: { type: Type.STRING },
                tujuan: { type: Type.ARRAY, items: { type: Type.STRING } },
                konsep_kunci: { type: Type.ARRAY, items: { type: Type.STRING } },
                uraian: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      subbab: { type: Type.STRING },
                      isi: { type: Type.STRING },
                    },
                  },
                },
                contoh_penerapan: { type: Type.ARRAY, items: { type: Type.STRING } },
                integrasi_kbc: { type: Type.STRING },
                miskonsepsi: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      keliru: { type: Type.STRING },
                      klarifikasi: { type: Type.STRING },
                    },
                  },
                },
                rangkuman: { type: Type.ARRAY, items: { type: Type.STRING } },
                glosarium: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      istilah: { type: Type.STRING },
                      makna: { type: Type.STRING },
                    },
                  },
                },
                refleksi: { type: Type.ARRAY, items: { type: Type.STRING } },
                latihan: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      pertanyaan: { type: Type.STRING },
                      jenis: { type: Type.STRING },
                      arah_jawaban: { type: Type.STRING },
                    },
                  },
                },
                referensi: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
          },
        });
        const parsed = JSON.parse((response.text ?? '{}').trim());
        res.json({ bahanAjar: parsed });
        return;
      }

      const contentPrompt = `Susun materi pembelajaran untuk Madrasah Aliyah (Pertemuan ${meeting || 1}).
Mata Pelajaran: ${identitas?.mapel || '-'}
Kelas/Fase: ${identitas?.kelas || '-'}
Tujuan Pembelajaran: ${tp?.tp || tp?.lingkup || '-'}
Elemen CP: ${tp?.elemen || '-'}
Materi Pokok Awal: ${unit?.pokok || '-'}
Submateri Awal: ${unit?.subMateri || '-'}
Tema KBC: ${kbc?.tema || unit?.kbc || '-'}

Susun secara naratif, bermakna, dan mudah dipahami peserta didik (bukan tabel).
Kembalikan JSON dengan field: pokok, subMateri, ringkasan (1-3 kalimat pengantar), rincian (array 3-6 pokok bahasan), kegiatan (gambaran aktivitas belajar mengamati, diskusi, praktik, refleksi), media (rekomendasi visual konkret dan penempatannya), sumber (sumber belajar umum terpercaya), pemantik (3 pertanyaan pemantik), profil (dimensi profil lulusan yang sesuai).`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: contentPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              pokok: { type: Type.STRING },
              subMateri: { type: Type.STRING },
              ringkasan: { type: Type.STRING },
              rincian: { type: Type.ARRAY, items: { type: Type.STRING } },
              kegiatan: { type: Type.STRING },
              media: { type: Type.STRING },
              sumber: { type: Type.STRING },
              pemantik: { type: Type.STRING },
              profil: { type: Type.STRING },
            },
          },
        },
      });
      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ materi: parsed });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyusun materi dengan Gemini AI.';
      res.status(500).json({ error: message });
    }
  });

  // Generator Soal Kuis Interaktif dari Bahan Ajar Mendalam
  app.post('/api/generate-quiz', async (req, res) => {
    try {
      const ai = getGenAI();
      const {
        materiText = '',
        judul = '',
        mapel = '',
        kelas = '',
        tp = '',
        jumlahPG = 5,
        jumlahEsai = 2,
        tingkatKesulitan = 'Campuran (LOTS & HOTS)',
      } = req.body || {};

      if (!String(materiText).trim()) {
        res.status(400).json({ error: 'Teks bahan ajar tidak boleh kosong.' });
        return;
      }

      const pgCount = Math.max(0, Math.min(25, Number(jumlahPG) || 0));
      const esaiCount = Math.max(0, Math.min(10, Number(jumlahEsai) || 0));
      if (pgCount + esaiCount === 0) {
        res.status(400).json({ error: 'Jumlah soal Pilihan Ganda atau Esai minimal 1.' });
        return;
      }

      const prompt = `Anda adalah guru profesional Madrasah Aliyah dan pembuat asesmen pembelajaran mendalam.
Buatlah soal kuis interaktif berdasarkan bahan ajar berikut.

IDENTITAS:
- Judul Kuis: ${judul || 'Kuis Pembelajaran'}
- Mata Pelajaran: ${mapel || '-'}
- Kelas: ${kelas || '-'}
- Tujuan Pembelajaran: ${tp || '-'}
- Tingkat Kesulitan: ${tingkatKesulitan}

BAHAN AJAR MENDALAM:
${String(materiText).slice(0, 18000)}

INSTRUKSI:
1. Buat tepat ${pgCount} soal Pilihan Ganda (type: "pg") dengan tepat 4 atau 5 opsi jawaban yang masuk akal, tidak ambigu, dan berimbang. Sertakan indeks jawaban benar (correctAnswerIndex: 0 untuk A, 1 untuk B, dst) serta penjelasan singkat (explanation).
2. Buat tepat ${esaiCount} soal Esai/Uraian (type: "esai") yang menguji pemahaman atau penalaran. Untuk soal esai, set options ke array kosong [], correctAnswerIndex ke 0, dan isi essayRubric dengan kunci/rubrik penilaian singkat.
3. Setiap soal memiliki poin (points): misal 10 untuk PG dan 20 untuk Esai.
4. Pastikan seluruh soal akurat dan bersumber dari bahan ajar di atas. Gunakan bahasa Indonesia yang jelas.`;

      const response = await generateContentWithRetry(ai, {
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING, description: 'Harus "pg" atau "esai"' },
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctAnswerIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING },
                    essayRubric: { type: Type.STRING },
                    points: { type: Type.INTEGER },
                  },
                },
              },
            },
          },
        },
      });

      const parsed = parseGeminiJson<{ questions?: Array<Record<string, unknown>> }>(response.text);
      const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
      const questions: QuizQuestionRecord[] = rawQuestions.map((q: Record<string, unknown>, idx: number) => {
        const isEssay = String(q.type || '').toLowerCase() === 'esai';
        const opts = Array.isArray(q.options) ? q.options.map((o) => String(o || '').trim()).filter(Boolean) : [];
        return {
          id: `q_${Date.now().toString(36)}_${idx}`,
          type: isEssay ? 'esai' : 'pg',
          question: String(q.question || '').trim(),
          options: isEssay ? [] : opts.length >= 2 ? opts : ['Opsi A', 'Opsi B', 'Opsi C', 'Opsi D'],
          correctAnswerIndex: isEssay ? 0 : Math.max(0, Math.min((opts.length || 4) - 1, Number(q.correctAnswerIndex) || 0)),
          explanation: String(q.explanation || '').trim(),
          essayRubric: String(q.essayRubric || '').trim(),
          points: Number(q.points) > 0 ? Number(q.points) : isEssay ? 20 : 10,
        };
      });

      res.json({ questions });
    } catch (err) {
      const formatted = formatGeminiError(err, 'Gagal membuat soal kuis dengan Gemini AI.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Generator Media Pembelajaran Interaktif (JSON Presentasi PowerPoint HTML5/JS)
  app.post('/api/generate-media', async (req, res) => {
    try {
      const ai = getGenAI();
      const {
        materiText = '',
        judul = '',
        mapel = '',
        kelas = '',
        tp = '',
        kbc = '',
        jenisMedia = 'slide-presentasi',
        jumlahSlide = 8,
      } = req.body || {};

      if (!String(materiText).trim()) {
        res.status(400).json({ error: 'Teks bahan ajar mendalam tidak boleh kosong.' });
        return;
      }

      const slideTarget = Math.max(4, Math.min(16, Number(jumlahSlide) || 8));
      const jenisDescMap: Record<string, string> = {
        'slide-presentasi': 'Slide Presentasi PowerPoint Interaktif HTML5/JS untuk Proyektor Kelas',
        'peta-konsep': 'Peta Konsep & Diagram Alur Pemahaman Bertahap',
        'kartu-ajar': 'Kartu Ajar Interaktif & Flashcard Konsep',
        'studi-kasus': 'Media Studi Kasus, Perbandingan & Diskusi Kelompok',
      };

      const prompt = `Anda adalah desainer media presentasi PowerPoint HTML5/JavaScript untuk Madrasah Aliyah berbasis Pembelajaran Mendalam dan Kurikulum Berbasis Cinta (KBC).
Ubah BAHAN AJAR MENDALAM di bawah ini menjadi objek JSON presentasi PowerPoint yang runtut, interaktif, visual, dan siap dijalankan langsung di pemutar slide HTML5.

IDENTITAS MEDIA:
- Judul Media: ${judul || 'Media Pembelajaran'}
- Jenis Media: ${jenisDescMap[String(jenisMedia)] || jenisMedia}
- Mata Pelajaran: ${mapel || '-'}
- Kelas: ${kelas || '-'}
- Tujuan Pembelajaran: ${tp || '-'}
- Tema KBC: ${kbc || '-'}
- Target Jumlah Slide: ${slideTarget}

BAHAN AJAR MENDALAM:
${String(materiText).slice(0, 18000)}

INSTRUKSI PENYUSUNAN SLIDE POWERPOINT:
1. Susun tepat ${slideTarget} slide yang runtut: Slide 1 pembuka & pemantik, tujuan belajar, konsep kunci, uraian inti, bagan alur/langkah proses (gunakan layout "alur" + isi diagramLangkah), perbandingan dua konsep jika relevan (gunakan layout "perbandingan" + isi perbandingan), contoh penerapan/kartu grid (layout "kartu-grid"), integrasi nilai KBC, kuis cepat/cek pemahaman (layout "kuis" + jawabanInteraktif), hingga refleksi & rangkuman.
2. Pilih tema warna: salah satu dari "zamrud", "biru", "emas", "gelap" (rekomendasi default "zamrud").
3. Pada setiap slide wajib mengisi:
   - judulSlide: judul singkat, kuat & menarik untuk layar proyektor (maks 10 kata)
   - tipe: pilih salah satu dari "pembuka", "tujuan", "konsep", "uraian", "contoh", "visual", "kbc", "kuis-cepat", "refleksi", "rangkuman"
   - layout: pilih salah satu dari "pembuka", "standar", "kartu-grid", "alur", "perbandingan", "kuis"
   - ringkasan: narasi singkat 1-3 kalimat yang tajam & ramah layar proyektor
   - poinUtama: array 3-5 poin ringkas padat (akan muncul bertahap per klik seperti animasi PowerPoint)
   - diagramLangkah: array langkah berurutan jika layout="alur" (contoh: ["1. Amati masalah", "2. Analisis konsep", "3. Simpulkan"]), atau array kosong [] jika bukan layout alur
   - perbandingan: jika layout="perbandingan" isi { judulKiri, isiKiri (array string), judulKanan, isiKanan (array string) }; jika bukan layout perbandingan isi { judulKiri: "", isiKiri: [], judulKanan: "", isiKanan: [] }
   - visualIde: ide konkret bagan/diagram/ilustrasi untuk slide ini
   - catatanGuru: panduan lisan (Speaker Notes) bagi guru saat menayangkan slide ini
   - pertanyaanInteraktif: 1 pertanyaan diskusi/kuis singkat untuk kelas
   - jawabanInteraktif: kunci/arah jawaban untuk ditampilkan guru saat tombol "Tampilkan Jawaban" diklik
4. Isi pula tujuanPembelajaran, integrasiKbc, aktivitasKelas, dan glosarium istilah kunci. Gunakan bahasa Indonesia yang jelas dan baku.`;

      const response = await generateContentWithRetry(ai, {
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              judul: { type: Type.STRING },
              subjudul: { type: Type.STRING },
              tema: { type: Type.STRING, description: 'zamrud, biru, emas, atau gelap' },
              tujuanPembelajaran: { type: Type.STRING },
              integrasiKbc: { type: Type.STRING },
              aktivitasKelas: { type: Type.STRING },
              glosarium: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    istilah: { type: Type.STRING },
                    makna: { type: Type.STRING },
                  },
                },
              },
              slides: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    judulSlide: { type: Type.STRING },
                    tipe: { type: Type.STRING },
                    layout: {
                      type: Type.STRING,
                      description: 'pembuka, standar, kartu-grid, alur, perbandingan, atau kuis',
                    },
                    ringkasan: { type: Type.STRING },
                    poinUtama: { type: Type.ARRAY, items: { type: Type.STRING } },
                    diagramLangkah: { type: Type.ARRAY, items: { type: Type.STRING } },
                    perbandingan: {
                      type: Type.OBJECT,
                      properties: {
                        judulKiri: { type: Type.STRING },
                        isiKiri: { type: Type.ARRAY, items: { type: Type.STRING } },
                        judulKanan: { type: Type.STRING },
                        isiKanan: { type: Type.ARRAY, items: { type: Type.STRING } },
                      },
                    },
                    visualIde: { type: Type.STRING },
                    catatanGuru: { type: Type.STRING },
                    pertanyaanInteraktif: { type: Type.STRING },
                    jawabanInteraktif: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const parsed = parseGeminiJson<Record<string, unknown>>(response.text);
      res.json({ media: parsed });
    } catch (err) {
      const formatted = formatGeminiError(err, 'Gagal menyusun media pembelajaran dengan Gemini AI.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Publikasikan Kuis & Hasilkan Kode Akses Unik
  app.post('/api/quizzes', (req, res) => {
    try {
      const store = ensureDataStore();
      const body = req.body || {};
      const requestedCode = String(body.code || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
      const code = requestedCode && store[requestedCode] ? requestedCode : requestedCode || generateAccessCode(store);
      const existing = store[code];
      const now = new Date().toISOString();

      const questions: QuizQuestionRecord[] = Array.isArray(body.questions) ? body.questions : [];
      if (!questions.length) {
        res.status(400).json({ error: 'Minimal harus ada 1 soal sebelum mempublikasikan kuis.' });
        return;
      }

      const record: PublishedQuizRecord = {
        code,
        id: String(body.id || existing?.id || code),
        judul: String(body.judul || 'Kuis Interaktif').trim(),
        mapel: String(body.mapel || '').trim(),
        kelasId: String(body.kelasId || '').trim(),
        kelasLabel: String(body.kelasLabel || '').trim(),
        tpKey: String(body.tpKey || '').trim(),
        tpLabel: String(body.tpLabel || '').trim(),
        durationMinutes: Math.max(5, Number(body.durationMinutes) || 30),
        isOpen: body.isOpen !== false,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        questions,
        roster: Array.isArray(body.roster) ? body.roster : existing?.roster || [],
        submissions: existing?.submissions || [],
      };

      store[code] = record;
      saveQuizzesStore(store);

      res.json({
        code: record.code,
        isOpen: record.isOpen,
        updatedAt: record.updatedAt,
        submissionCount: record.submissions.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mempublikasikan kuis.';
      res.status(500).json({ error: message });
    }
  });

  // Ambil Kuis untuk Siswa (tanpa kunci jawaban PG)
  app.get('/api/quizzes/:code', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const store = ensureDataStore();
    const quiz = store[code];
    if (!quiz) {
      res.status(404).json({ error: `Kuis dengan kode "${code}" tidak ditemukan.` });
      return;
    }
    if (!quiz.isOpen) {
      res.status(403).json({ error: 'Kuis ini sedang ditutup oleh guru.' });
      return;
    }

    res.json({
      code: quiz.code,
      judul: quiz.judul,
      mapel: quiz.mapel,
      kelasId: quiz.kelasId,
      kelasLabel: quiz.kelasLabel,
      tpLabel: quiz.tpLabel,
      durationMinutes: quiz.durationMinutes,
      roster: quiz.roster || [],
      questions: quiz.questions.map((q) => ({
        id: q.id,
        type: q.type,
        question: q.question,
        options: q.options,
        points: q.points,
      })),
    });
  });

  // Siswa Mengirim Jawaban Kuis
  app.post('/api/quizzes/:code/submit', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const store = ensureDataStore();
    const quiz = store[code];
    if (!quiz) {
      res.status(404).json({ error: `Kuis dengan kode "${code}" tidak ditemukan.` });
      return;
    }
    if (!quiz.isOpen) {
      res.status(403).json({ error: 'Kuis sudah ditutup. Jawaban tidak dapat dikirim.' });
      return;
    }

    const body = req.body || {};
    const studentName = String(body.studentName || '').trim();
    const nisn = String(body.nisn || '').trim();
    const studentId = body.studentId ? String(body.studentId) : undefined;
    const kelasLabel = String(body.kelasLabel || quiz.kelasLabel || '').trim();
    const answers = body.answers && typeof body.answers === 'object' ? body.answers : {};

    if (!studentName) {
      res.status(400).json({ error: 'Nama lengkap siswa wajib diisi.' });
      return;
    }

    const calc = computeSubmissionScores(quiz, answers);
    const submission: QuizSubmissionRecord = {
      id: `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      submittedAt: new Date().toISOString(),
      studentId,
      nisn,
      studentName,
      kelasLabel,
      answers,
      pgCorrect: calc.pgCorrect,
      pgTotal: calc.pgTotal,
      pgScore: calc.pgScore,
      essayScores: calc.essayScores,
      totalScore: calc.totalScore,
      status: calc.status,
    };

    quiz.submissions.push(submission);
    saveQuizzesStore(store);

    const review = quiz.questions.map((q) => ({
      id: q.id,
      type: q.type,
      question: q.question,
      options: q.options,
      studentAnswer: answers[q.id] ?? null,
      correctAnswerIndex: q.type === 'pg' ? q.correctAnswerIndex : null,
      isCorrect: q.type === 'pg' ? Number(answers[q.id]) === Number(q.correctAnswerIndex) : null,
      explanation: q.explanation,
    }));

    res.json({
      submission,
      hasEssay: quiz.questions.some((q) => q.type === 'esai'),
      review,
    });
  });

  // Guru Mengambil Rekap Skor Otomatis
  app.get('/api/quizzes/:code/results', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const store = ensureDataStore();
    const quiz = store[code];
    if (!quiz) {
      res.status(404).json({ error: 'Kuis belum dipublikasikan ke server.' });
      return;
    }
    res.json({
      code: quiz.code,
      isOpen: quiz.isOpen,
      submissions: quiz.submissions || [],
    });
  });

  // Guru Menilai Jawaban Esai Siswa
  app.patch('/api/quizzes/:code/submissions/:subId', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const subId = String(req.params.subId || '');
    const store = ensureDataStore();
    const quiz = store[code];
    if (!quiz) {
      res.status(404).json({ error: 'Kuis tidak ditemukan.' });
      return;
    }
    const sub = quiz.submissions.find((s) => s.id === subId);
    if (!sub) {
      res.status(404).json({ error: 'Data pengiriman siswa tidak ditemukan.' });
      return;
    }
    const essayScoresInput = req.body?.essayScores || {};
    const calc = computeSubmissionScores(quiz, sub.answers, essayScoresInput);
    sub.essayScores = calc.essayScores;
    sub.totalScore = calc.totalScore;
    sub.status = calc.status;
    saveQuizzesStore(store);
    res.json({ submission: sub });
  });

  // Buka / Tutup Link Kuis
  app.patch('/api/quizzes/:code/status', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const store = ensureDataStore();
    const quiz = store[code];
    if (!quiz) {
      res.status(404).json({ error: 'Kuis tidak ditemukan.' });
      return;
    }
    quiz.isOpen = Boolean(req.body?.isOpen);
    quiz.updatedAt = new Date().toISOString();
    saveQuizzesStore(store);
    res.json({ code: quiz.code, isOpen: quiz.isOpen });
  });

  app.delete('/api/quizzes/:code', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const store = ensureDataStore();
    if (store[code]) {
      delete store[code];
      saveQuizzesStore(store);
    }
    res.json({ deleted: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server berjalan pada http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Gagal menjalankan server:', err);
  process.exit(1);
});
