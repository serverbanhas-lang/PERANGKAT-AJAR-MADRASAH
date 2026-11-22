import * as XLSX from 'xlsx';
import type {
  AdminGuruState,
  AppApiBridge,
  AttendanceStatus,
  DynamicTP,
  GradeBookData,
  GradeWeights,
  JournalItem,
  KelasItem,
  LegacyAppState,
  LegacyUnit,
  StudentGradeRow,
  StudentItem,
  TingkatKelas,
} from '../types/adminGuru';

export const DEFAULT_CLASSES: KelasItem[] = [
  { id: 'kls_10_a', tingkat: '10', nama: 'X-A', jurusan: 'Umum' },
  { id: 'kls_10_b', tingkat: '10', nama: 'X-B', jurusan: 'Umum' },
  { id: 'kls_11_ipa1', tingkat: '11', nama: 'XI-IPA-1', jurusan: 'IPA' },
  { id: 'kls_11_ips1', tingkat: '11', nama: 'XI-IPS-1', jurusan: 'IPS' },
  { id: 'kls_12_ipa1', tingkat: '12', nama: 'XII-IPA-1', jurusan: 'IPA' },
  { id: 'kls_12_ips1', tingkat: '12', nama: 'XII-IPS-1', jurusan: 'IPS' },
];

export const DEFAULT_WEIGHTS: GradeWeights = {
  formatif: 40,
  sumatif: 30,
  pats: 30,
};

export function getDefaultAdminGuruState(): AdminGuruState {
  return {
    classes: DEFAULT_CLASSES.map((c) => ({ ...c })),
    students: [],
    attendance: {},
    journals: [],
    grades: {},
    quizzes: [],
  };
}

export function normalizeAdminGuruState(raw: unknown): AdminGuruState {
  const def = getDefaultAdminGuruState();
  if (!raw || typeof raw !== 'object') return def;
  const src = raw as Partial<AdminGuruState>;

  const classes: KelasItem[] =
    Array.isArray(src.classes) && src.classes.length > 0
      ? src.classes.map((c, idx) => ({
          id: String(c?.id || `kls_${idx}_${Date.now()}`),
          tingkat: (['10', '11', '12'].includes(String(c?.tingkat)) ? String(c?.tingkat) : '10') as TingkatKelas,
          nama: String(c?.nama || `Kelas ${idx + 1}`),
          jurusan: String(c?.jurusan || 'Umum'),
          waliKelas: c?.waliKelas ? String(c.waliKelas) : '',
        }))
      : def.classes;

  const students: StudentItem[] = Array.isArray(src.students)
    ? src.students.map((s, idx) => ({
        id: String(s?.id || `std_${idx}_${Date.now()}`),
        nisn: String(s?.nisn || ''),
        nama: String(s?.nama || ''),
        jk: s?.jk === 'P' ? 'P' : 'L',
        kelasId: String(s?.kelasId || classes[0]?.id || 'kls_10_a'),
        status: s?.status === 'nonaktif' ? 'nonaktif' : 'aktif',
      }))
    : [];

  const attendance: Record<string, Record<string, AttendanceStatus>> =
    src.attendance && typeof src.attendance === 'object' ? { ...src.attendance } : {};

  const journals: JournalItem[] = Array.isArray(src.journals) ? src.journals.map((j) => ({ ...j })) : [];
  const grades: Record<string, GradeBookData> =
    src.grades && typeof src.grades === 'object' ? { ...src.grades } : {};
  const quizzes = Array.isArray(src.quizzes) ? src.quizzes.map((q) => ({ ...q })) : [];

  return {
    classes,
    students,
    attendance,
    journals,
    grades,
    quizzes,
  };
}

export function getAppApi(): AppApiBridge | null {
  return typeof window !== 'undefined' ? window.__APP_API || null : null;
}

export function getLegacyState(): LegacyAppState | null {
  const api = getAppApi();
  if (!api) return null;
  const s = api.getState();
  if (!s.adminGuru) {
    s.adminGuru = getDefaultAdminGuruState();
  }
  return s;
}

export function getAdminGuruState(): AdminGuruState {
  const s = getLegacyState();
  if (!s) return getDefaultAdminGuruState();
  s.adminGuru = normalizeAdminGuruState(s.adminGuru);
  return s.adminGuru;
}

export function updateAdminGuruState(updater: (prev: AdminGuruState, full: LegacyAppState) => AdminGuruState): AdminGuruState {
  const api = getAppApi();
  if (!api) return getDefaultAdminGuruState();
  const s = api.getState();
  const prev = normalizeAdminGuruState(s.adminGuru);
  const next = updater(prev, s);
  s.adminGuru = next;
  api.save();
  return next;
}

export function createUid(prefix = 'ag'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function getActiveMapelList(state: LegacyAppState | null): string[] {
  const main = String(state?.identitas?.mapel || '').trim();
  const defaults = main ? [main] : ['Mata Pelajaran Utama'];
  const extras = new Set<string>(defaults);
  if (state?.adminGuru?.grades) {
    Object.keys(state.adminGuru.grades).forEach((k) => {
      const parts = k.split('::');
      if (parts[1]?.trim()) extras.add(parts[1].trim());
    });
  }
  return Array.from(extras);
}

/**
 * Mengambil daftar TP dinamis dari modul Promes & ATP/TP lama (maksimal 10 TP)
 * agar kolom Nilai Formatif & Jurnal Mengajar otomatis sinkron dengan Promes.
 */
export function getDynamicTPs(state: LegacyAppState | null, semesterFilter?: 1 | 2): DynamicTP[] {
  const api = getAppApi();
  const tps = Array.isArray(state?.tps) ? state.tps : [];
  const units = Array.isArray(state?.units) ? state.units : [];

  const result: DynamicTP[] = [];
  const seenIds = new Set<string>();

  if (semesterFilter) {
    units
      .filter((u) => (+(u.smt || 1) === semesterFilter) && u.tpId)
      .forEach((u) => {
        const tp = tps.find((t) => t.id === u.tpId);
        if (tp && !seenIds.has(tp.id) && result.length < 10) {
          seenIds.add(tp.id);
          const idx = result.length + 1;
          const fullText = api ? api.tpText(tp) : tp.lingkup || tp.kompetensi || `TP ${idx}`;
          result.push({
            index: idx,
            key: `tp${idx}`,
            id: tp.id,
            shortLabel: tp.lingkup ? `TP ${idx}: ${tp.lingkup}` : `TP ${idx}`,
            fullText,
            elemen: tp.elemen || '',
          });
        }
      });
  }

  tps.forEach((tp) => {
    if (!seenIds.has(tp.id) && result.length < 10) {
      seenIds.add(tp.id);
      const idx = result.length + 1;
      const fullText = api ? api.tpText(tp) : tp.lingkup || tp.kompetensi || `TP ${idx}`;
      result.push({
        index: idx,
        key: `tp${idx}`,
        id: tp.id,
        shortLabel: tp.lingkup ? `TP ${idx}: ${tp.lingkup}` : `TP ${idx}`,
        fullText,
        elemen: tp.elemen || '',
      });
    }
  });

  if (result.length === 0) {
    for (let i = 1; i <= 5; i++) {
      result.push({
        index: i,
        key: `tp${i}`,
        id: `default_tp_${i}`,
        shortLabel: `TP ${i}`,
        fullText: `Tujuan Pembelajaran ${i}`,
        elemen: '',
      });
    }
  }

  return result;
}

export interface BahanAjarSource {
  unitId: string;
  meetingNumber: number;
  smt: 1 | 2;
  judul: string;
  tpLabel: string;
  hasDeepContent: boolean;
  plainText: string;
}

export function serializeUnitBahanAjar(unit: LegacyUnit, idx: number, tpLabel: string): string {
  const chunks: string[] = [];
  const d = unit.bahanAjar;

  if (d && (d.judul || d.pengantar || (d.uraian || []).length || (d.konsep_kunci || []).length)) {
    if (d.judul) chunks.push(`Judul Materi: ${d.judul}`);
    if (d.subjudul) chunks.push(`Subjudul: ${d.subjudul}`);
    if (tpLabel) chunks.push(`Tujuan Pembelajaran: ${tpLabel}`);
    if (d.pengantar) chunks.push(`Pengantar:\n${d.pengantar}`);
    if (Array.isArray(d.tujuan) && d.tujuan.length) {
      chunks.push(`Tujuan Belajar:\n- ${d.tujuan.join('\n- ')}`);
    }
    if (Array.isArray(d.konsep_kunci) && d.konsep_kunci.length) {
      chunks.push(`Konsep Kunci:\n- ${d.konsep_kunci.join('\n- ')}`);
    }
    if (Array.isArray(d.uraian) && d.uraian.length) {
      chunks.push(
        `Uraian Materi:\n${d.uraian
          .map((u) => `${u.subbab || 'Pokok Bahasan'}:\n${u.isi || ''}`)
          .join('\n\n')}`
      );
    }
    if (Array.isArray(d.contoh_penerapan) && d.contoh_penerapan.length) {
      chunks.push(`Contoh Penerapan:\n- ${d.contoh_penerapan.join('\n- ')}`);
    }
    if (d.integrasi_kbc) chunks.push(`Integrasi Kurikulum Berbasis Cinta:\n${d.integrasi_kbc}`);
    if (Array.isArray(d.rangkuman) && d.rangkuman.length) {
      chunks.push(`Rangkuman:\n- ${d.rangkuman.join('\n- ')}`);
    }
  }

  if (unit.bahanAjarTeks) {
    chunks.push(`Catatan Bahan Ajar Mendalam:\n${unit.bahanAjarTeks}`);
  }

  if (chunks.length === 0) {
    if (unit.pokok) chunks.push(`Materi Pokok: ${unit.pokok}`);
    if (unit.subMateri) chunks.push(`Submateri: ${unit.subMateri}`);
    if (unit.ringkasan) chunks.push(`Ringkasan:\n${unit.ringkasan}`);
    if (unit.rincian) chunks.push(`Rincian Materi:\n${unit.rincian}`);
    if (unit.kegiatan) chunks.push(`Kegiatan Pembelajaran:\n${unit.kegiatan}`);
  }

  if (chunks.length === 0) {
    return `Pertemuan ${idx + 1} (${tpLabel || 'Materi Pembelajaran'})`;
  }

  return chunks.join('\n\n');
}

export function getBahanAjarSources(state: LegacyAppState | null): BahanAjarSource[] {
  const api = getAppApi();
  const units = Array.isArray(state?.units) ? state.units : [];
  const tps = Array.isArray(state?.tps) ? state.tps : [];

  return units.map((u, idx) => {
    const tp = tps.find((t) => t.id === u.tpId);
    const tpLabel = tp ? (api ? api.tpText(tp) : tp.lingkup || '') : '';
    const d = u.bahanAjar || {};
    const hasDeepContent = Boolean(
      u.bahanAjarTeks ||
        d.judul ||
        d.pengantar ||
        (d.uraian && d.uraian.length > 0) ||
        unitHasText(u)
    );
    return {
      unitId: u.id,
      meetingNumber: idx + 1,
      smt: Number(u.smt) === 2 ? 2 : 1,
      judul: d.judul || u.pokok || `Pertemuan ${idx + 1}`,
      tpLabel,
      hasDeepContent,
      plainText: serializeUnitBahanAjar(u, idx, tpLabel),
    };
  });
}

function unitHasText(u: LegacyUnit): boolean {
  return Boolean(u.ringkasan || u.rincian || u.subMateri);
}

export const DAY_NAMES_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function getIndonesianDayName(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3) return '';
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  return DAY_NAMES_ID[dt.getDay()] || '';
}

export function formatTanggalID(isoDate: string): string {
  const api = getAppApi();
  if (api) return api.tglID(isoDate);
  return isoDate;
}

export function getDayCalendarStatus(isoDate: string): {
  isEffective: boolean;
  semester: 1 | 2;
  hari: string;
  hariKe: number | null;
  jpJadwal: number;
  statusLabel: string;
  liburCode?: string;
} {
  const api = getAppApi();
  const state = getLegacyState();
  const hari = getIndonesianDayName(isoDate);
  if (!api || !state) {
    return { isEffective: true, semester: 1, hari, hariKe: null, jpJadwal: 0, statusLabel: 'Hari Aktif' };
  }
  const calc = api.kaldikCompute();
  const day = calc.days[isoDate];
  if (!day) {
    return {
      isEffective: false,
      semester: 1,
      hari,
      hariKe: null,
      jpJadwal: 0,
      statusLabel: 'Di luar rentang tahun pelajaran kalender pendidikan',
    };
  }
  const jp = api.jpHari(day.sem, day.dow);
  if (day.pre) {
    return {
      isEffective: false,
      semester: day.sem,
      hari,
      hariKe: null,
      jpJadwal: 0,
      statusLabel: 'Sebelum hari pertama masuk tahun ajaran',
    };
  }
  if (day.n == null) {
    const kodeInfo = state.kaldik?.kode?.find((k) => k.k === day.code);
    const ket = kodeInfo ? `${kodeInfo.k} (${kodeInfo.ket})` : day.code || 'Hari Libur';
    return {
      isEffective: false,
      semester: day.sem,
      hari,
      hariKe: null,
      jpJadwal: 0,
      statusLabel: `Non-Efektif: ${ket}`,
      liburCode: day.code,
    };
  }
  return {
    isEffective: true,
    semester: day.sem,
    hari,
    hariKe: day.n,
    jpJadwal: jp,
    statusLabel: jp > 0 ? `Hari Efektif ke-${day.n} (${jp} JP di jadwal)` : `Hari Efektif ke-${day.n} (0 JP jadwal mapel)`,
  };
}

export function computeAttendanceSummary(
  attendanceMap: Record<string, Record<string, AttendanceStatus>>,
  kelasId: string,
  tanggal: string,
  studentsInClass: StudentItem[]
): { H: number; S: number; I: number; A: number; total: number; recorded: boolean } {
  const key = `${kelasId}::${tanggal}`;
  const rec = attendanceMap[key];
  if (!rec) {
    return { H: 0, S: 0, I: 0, A: 0, total: studentsInClass.length, recorded: false };
  }
  let H = 0;
  let S = 0;
  let I = 0;
  let A = 0;
  studentsInClass.forEach((st) => {
    const val = rec[st.id];
    if (val === 'H') H++;
    else if (val === 'S') S++;
    else if (val === 'I') I++;
    else if (val === 'A') A++;
  });
  return { H, S, I, A, total: studentsInClass.length, recorded: true };
}

/**
 * Auto-Generate Jurnal Mengajar dari:
 * 1) Kalender Pendidikan & RPE (hari efektif, tanggal libur otomatis dilewati)
 * 2) Jadwal JP per hari
 * 3) Promes (S.prosem.cells) + ATP/TP (S.units, S.tps)
 */
export function autoGenerateJournals(
  kelasId: string,
  semester: 1 | 2,
  mapel: string
): { items: JournalItem[]; sourceNote: string } {
  const api = getAppApi();
  const state = getLegacyState();
  if (!api || !state) {
    return { items: [], sourceNote: 'State aplikasi tidak tersedia.' };
  }

  const kaldik = api.kaldikCompute();
  const weeks = api.kaldikWeeks(semester);
  const units = (state.units || []).filter((u) => (+(u.smt || 1) === semester));
  const tps = state.tps || [];
  const cells = state.prosem?.cells || {};

  if (!weeks.length) {
    return { items: [], sourceNote: 'Belum ada pekan efektif di Kalender Pendidikan untuk semester ini.' };
  }
  if (!units.length) {
    return { items: [], sourceNote: 'Belum ada pertemuan/ATP pada menu ATP & Promes untuk semester ini.' };
  }

  // Kumpulkan tanggal efektif per pekan
  const effectiveDatesByWeek = new Map<string, Array<{ date: string; dow: number; jp: number }>>();
  Object.keys(kaldik.days)
    .sort()
    .forEach((dateStr) => {
      const d = kaldik.days[dateStr];
      if (d.sem !== semester || d.n == null) return;
      const [y, m, day] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, day);
      const mon = new Date(dt);
      mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
      const weekKey = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`;
      const jp = api.jpHari(semester, d.dow);
      if (!effectiveDatesByWeek.has(weekKey)) effectiveDatesByWeek.set(weekKey, []);
      effectiveDatesByWeek.get(weekKey)!.push({ date: dateStr, dow: d.dow, jp });
    });

  const entries: JournalItem[] = [];
  let fromProsemCount = 0;

  // 1) Utamakan sebaran sel Promes (S.prosem.cells[unit.id][week.key])
  weeks.forEach((w, wIdx) => {
    const weekDates = effectiveDatesByWeek.get(w.key) || [];
    const scheduledDates = weekDates.filter((d) => d.jp > 0);
    const candidateDates = scheduledDates.length > 0 ? scheduledDates : weekDates;
    if (!candidateDates.length) return;

    const unitsInWeek = units.filter((u) => Number(cells[u.id]?.[w.key] || 0) > 0);
    if (!unitsInWeek.length) return;

    unitsInWeek.forEach((u, uIdx) => {
      fromProsemCount++;
      const tp = tps.find((t) => t.id === u.tpId);
      const tpLabel = tp ? api.tpText(tp) : u.pokok || 'Tujuan Pembelajaran';
      const datePick = candidateDates[uIdx % candidateDates.length];
      const jpPlanned = Number(cells[u.id]?.[w.key] || u.jp || datePick.jp || 2);
      const materiText = [u.pokok, u.subMateri].filter(Boolean).join(' — ') || tpLabel;

      entries.push({
        id: createUid('jrn'),
        kelasId,
        semester,
        tanggal: datePick.date,
        hari: getIndonesianDayName(datePick.date),
        pekanKe: wIdx + 1,
        jpCount: jpPlanned,
        mapel,
        tpId: u.tpId || undefined,
        tpLabel,
        materi: materiText,
        catatan: u.kegiatan ? `Aktivitas: ${u.kegiatan.slice(0, 140)}` : '',
        refleksi: '',
        status: 'terjadwal',
        autoGenerated: true,
      });
    });
  });

  // 2) Fallback jika Promes belum diisi sel-nya: distribusikan ATP ke pekan yang memiliki jadwal
  if (entries.length === 0) {
    const teachingWeeks = weeks.filter((w) => {
      const ds = effectiveDatesByWeek.get(w.key) || [];
      return ds.some((d) => d.jp > 0) || ds.length > 0;
    });
    units.forEach((u, idx) => {
      const targetWeekIdx = Math.min(teachingWeeks.length - 1, Math.floor((idx * teachingWeeks.length) / units.length));
      const w = teachingWeeks[targetWeekIdx];
      if (!w) return;
      const weekIdxOriginal = weeks.findIndex((x) => x.key === w.key);
      const ds = effectiveDatesByWeek.get(w.key) || [];
      const scheduled = ds.filter((d) => d.jp > 0);
      const pick = (scheduled.length ? scheduled : ds)[idx % (scheduled.length || ds.length)];
      if (!pick) return;

      const tp = tps.find((t) => t.id === u.tpId);
      const tpLabel = tp ? api.tpText(tp) : u.pokok || `TP Pertemuan ${idx + 1}`;
      const materiText = [u.pokok, u.subMateri].filter(Boolean).join(' — ') || tpLabel;

      entries.push({
        id: createUid('jrn'),
        kelasId,
        semester,
        tanggal: pick.date,
        hari: getIndonesianDayName(pick.date),
        pekanKe: weekIdxOriginal >= 0 ? weekIdxOriginal + 1 : targetWeekIdx + 1,
        jpCount: Number(u.jp) || pick.jp || 2,
        mapel,
        tpId: u.tpId || undefined,
        tpLabel,
        materi: materiText,
        catatan: u.kegiatan ? `Aktivitas: ${u.kegiatan.slice(0, 140)}` : '',
        refleksi: '',
        status: 'terjadwal',
        autoGenerated: true,
      });
    });
    return {
      items: entries.sort((a, b) => a.tanggal.localeCompare(b.tanggal)),
      sourceNote: `Disusun otomatis dari ${entries.length} unit ATP & Hari Efektif Kalender (sel Promes belum terisi sehingga memakai distribusi pekan efektif).`,
    };
  }

  return {
    items: entries.sort((a, b) => a.tanggal.localeCompare(b.tanggal)),
    sourceNote: `Berhasil menarik ${fromProsemCount} entri dari Promes & Kalender Pendidikan (otomatis melewati hari libur).`,
  };
}

export function createEmptyGradeRow(): StudentGradeRow {
  return {
    formatif: {},
    sumatif: {},
    pats: '',
    catatan: '',
  };
}

export function calcStudentGradeMetrics(
  row: StudentGradeRow | undefined,
  weights: GradeWeights,
  tpCount: number
): {
  avgFormatif: number | null;
  avgSumatif: number | null;
  pats: number | null;
  nilaiAkhir: number | null;
  predikat: string;
} {
  if (!row) {
    return { avgFormatif: null, avgSumatif: null, pats: null, nilaiAkhir: null, predikat: '-' };
  }

  const fVals: number[] = [];
  for (let i = 1; i <= tpCount; i++) {
    const v = row.formatif[`tp${i}`];
    if (v !== '' && v !== undefined && !Number.isNaN(Number(v))) {
      fVals.push(Number(v));
    }
  }
  const avgFormatif = fVals.length > 0 ? Math.round((fVals.reduce((a, b) => a + b, 0) / fVals.length) * 10) / 10 : null;

  const sVals: number[] = [];
  for (let i = 1; i <= 5; i++) {
    const v = row.sumatif[`s${i}`];
    if (v !== '' && v !== undefined && !Number.isNaN(Number(v))) {
      sVals.push(Number(v));
    }
  }
  const avgSumatif = sVals.length > 0 ? Math.round((sVals.reduce((a, b) => a + b, 0) / sVals.length) * 10) / 10 : null;

  const pats = row.pats !== '' && row.pats !== undefined && !Number.isNaN(Number(row.pats)) ? Number(row.pats) : null;

  const wF = Number(weights.formatif) || 0;
  const wS = Number(weights.sumatif) || 0;
  const wP = Number(weights.pats) || 0;

  let weightedSum = 0;
  let activeWeight = 0;
  if (avgFormatif !== null && wF > 0) {
    weightedSum += avgFormatif * wF;
    activeWeight += wF;
  }
  if (avgSumatif !== null && wS > 0) {
    weightedSum += avgSumatif * wS;
    activeWeight += wS;
  }
  if (pats !== null && wP > 0) {
    weightedSum += pats * wP;
    activeWeight += wP;
  }

  const nilaiAkhir = activeWeight > 0 ? Math.round((weightedSum / activeWeight) * 10) / 10 : null;
  let predikat = '-';
  if (nilaiAkhir !== null) {
    if (nilaiAkhir >= 90) predikat = 'A (Sangat Baik)';
    else if (nilaiAkhir >= 80) predikat = 'B (Baik)';
    else if (nilaiAkhir >= 70) predikat = 'C (Cukup)';
    else predikat = 'D (Perlu Bimbingan)';
  }

  return { avgFormatif, avgSumatif, pats, nilaiAkhir, predikat };
}

// ======================= EXCEL (SheetJS) HELPERS =======================

export function downloadStudentTemplateXlsx(classes: KelasItem[], selectedKelasNama?: string): void {
  const sampleClass = selectedKelasNama || classes[0]?.nama || 'X-A';
  const rows = [
    {
      'NIS/NISN': '0081234501',
      'Nama Lengkap': 'Contoh: Ahmad Fauzan',
      'Jenis Kelamin (L/P)': 'L',
      'Kelas/Rombel': sampleClass,
    },
    {
      'NIS/NISN': '0081234502',
      'Nama Lengkap': 'Contoh: Siti Aisyah',
      'Jenis Kelamin (L/P)': 'P',
      'Kelas/Rombel': sampleClass,
    },
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 18 }, { wch: 32 }, { wch: 22 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Template Siswa');

  const refSheet = XLSX.utils.json_to_sheet(
    classes.map((c) => ({ Tingkat: `Kelas ${c.tingkat}`, 'Nama Kelas/Rombel': c.nama, Jurusan: c.jurusan }))
  );
  refSheet['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, refSheet, 'Daftar Rombel');

  XLSX.writeFile(wb, `Template_Impor_Siswa_${sampleClass.replace(/[^A-Za-z0-9_-]/g, '_')}.xlsx`);
}

export function exportStudentsXlsx(students: StudentItem[], classes: KelasItem[], filterLabel = 'Semua_Kelas'): void {
  const classMap = new Map(classes.map((c) => [c.id, c]));
  const rows = students.map((s, idx) => {
    const cls = classMap.get(s.kelasId);
    return {
      No: idx + 1,
      'NIS/NISN': s.nisn,
      'Nama Lengkap': s.nama,
      'Jenis Kelamin': s.jk,
      Tingkat: cls ? `Kelas ${cls.tingkat}` : '-',
      Kelas: cls ? cls.nama : '-',
      Status: s.status === 'aktif' ? 'Aktif' : 'Nonaktif',
    };
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 30 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa');
  XLSX.writeFile(wb, `Data_Siswa_${filterLabel.replace(/[^A-Za-z0-9_-]/g, '_')}.xlsx`);
}

export async function parseStudentImportXlsx(
  file: File,
  classes: KelasItem[],
  fallbackKelasId: string
): Promise<{ imported: StudentItem[]; skippedRows: number }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { imported: [], skippedRows: 0 };

  const sheet = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const classByName = new Map(classes.map((c) => [c.nama.trim().toLowerCase(), c.id]));

  const imported: StudentItem[] = [];
  let skippedRows = 0;

  rawRows.forEach((row) => {
    const entries = Object.entries(row).reduce<Record<string, string>>((acc, [k, v]) => {
      acc[k.trim().toLowerCase()] = String(v ?? '').trim();
      return acc;
    }, {});

    const nisn =
      entries['nis/nisn'] ||
      entries['nisn'] ||
      entries['nis'] ||
      entries['no induk'] ||
      entries['nomor induk'] ||
      '';
    const nama =
      entries['nama lengkap'] ||
      entries['nama'] ||
      entries['nama siswa'] ||
      entries['peserta didik'] ||
      '';

    if (!nama || nama.toLowerCase().startsWith('contoh:')) {
      skippedRows++;
      return;
    }

    const jkRaw = (entries['jenis kelamin (l/p)'] || entries['jenis kelamin'] || entries['jk'] || entries['l/p'] || 'L').toUpperCase();
    const jk = jkRaw.startsWith('P') || jkRaw.includes('PEREMPUAN') ? 'P' : 'L';

    const kelasRaw = (entries['kelas/rombel'] || entries['kelas'] || entries['rombel'] || '').toLowerCase();
    const matchedKelasId = (kelasRaw && classByName.get(kelasRaw)) || fallbackKelasId;

    imported.push({
      id: createUid('std'),
      nisn,
      nama,
      jk,
      kelasId: matchedKelasId,
      status: 'aktif',
    });
  });

  return { imported, skippedRows };
}

export function exportGradesXlsx(params: {
  students: StudentItem[];
  kelasNama: string;
  mapel: string;
  tpCount: number;
  tps: DynamicTP[];
  gradeBook: GradeBookData;
}): void {
  const { students, kelasNama, mapel, tpCount, tps, gradeBook } = params;
  const rows = students.map((st, idx) => {
    const r = gradeBook.rows[st.id];
    const calc = calcStudentGradeMetrics(r, gradeBook.weights, tpCount);
    const out: Record<string, string | number> = {
      No: idx + 1,
      'NIS/NISN': st.nisn || '-',
      'Nama Siswa': st.nama,
      'L/P': st.jk,
    };
    for (let i = 1; i <= tpCount; i++) {
      const tpTitle = tps[i - 1]?.shortLabel || `TP ${i}`;
      const val = r?.formatif[`tp${i}`];
      out[`Fmt ${tpTitle}`] = val !== '' && val !== undefined ? Number(val) : '';
    }
    out['Rata Formatif'] = calc.avgFormatif ?? '';
    for (let i = 1; i <= 5; i++) {
      const val = r?.sumatif[`s${i}`];
      out[`Sumatif TP ${i}`] = val !== '' && val !== undefined ? Number(val) : '';
    }
    out['Rata Sumatif'] = calc.avgSumatif ?? '';
    out['Nilai PATS'] = calc.pats ?? '';
    out['Nilai Akhir'] = calc.nilaiAkhir ?? '';
    out['Predikat'] = calc.predikat;
    return out;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Daftar Nilai');
  XLSX.writeFile(wb, `Daftar_Nilai_${kelasNama}_${mapel.replace(/[^A-Za-z0-9_-]/g, '_')}.xlsx`);
}
