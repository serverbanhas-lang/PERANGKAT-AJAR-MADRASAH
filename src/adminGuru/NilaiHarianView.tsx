import React, { useEffect, useMemo, useState } from 'react';
import { Award, Download, Printer, SlidersHorizontal } from 'lucide-react';
import {
  calcStudentGradeMetrics,
  createEmptyGradeRow,
  DEFAULT_WEIGHTS,
  exportGradesXlsx,
  getActiveMapelList,
  getAdminGuruState,
  getAppApi,
  getDynamicTPs,
  getLegacyState,
  getPreferredKelasId,
  subscribeMasterStudents,
  updateAdminGuruState,
} from './bridge';
import type { GradeBookData, GradeWeights, TingkatKelas } from '../types/adminGuru';

function clampScore(raw: string): number | '' {
  const trimmed = raw.trim();
  if (trimmed === '') return '';
  const n = Number(trimmed);
  if (Number.isNaN(n)) return '';
  return Math.max(0, Math.min(100, n));
}

export const NilaiHarianView: React.FC = () => {
  const [adminState, setAdminState] = useState(() => getAdminGuruState());
  const legacy = getLegacyState();
  const api = getAppApi();

  useEffect(() => {
    return subscribeMasterStudents(() => setAdminState(getAdminGuruState()));
  }, []);

  const mapelList = useMemo(() => getActiveMapelList(legacy), [legacy]);
  const dynamicTPs = useMemo(() => getDynamicTPs(legacy), [legacy]);

  const [filterTingkat, setFilterTingkat] = useState<'all' | TingkatKelas>('all');
  const [selectedKelasId, setSelectedKelasId] = useState<string>(() =>
    getPreferredKelasId(adminState.classes)
  );
  const [selectedMapel, setSelectedMapel] = useState<string>(mapelList[0] || 'Mata Pelajaran Utama');
  const [customMapel, setCustomMapel] = useState('');
  const [showWeightEditor, setShowWeightEditor] = useState(false);

  const visibleClasses = useMemo(() => {
    if (filterTingkat === 'all') return adminState.classes;
    return adminState.classes.filter((c) => c.tingkat === filterTingkat);
  }, [adminState.classes, filterTingkat]);

  const activeKelas = useMemo(
    () => adminState.classes.find((c) => c.id === selectedKelasId) || visibleClasses[0],
    [adminState.classes, selectedKelasId, visibleClasses]
  );
  const effectiveKelasId = activeKelas?.id || selectedKelasId;
  const gradeKey = `${effectiveKelasId}::${selectedMapel}`;

  const studentsInClass = useMemo(() => {
    return adminState.students
      .filter((s) => s.kelasId === effectiveKelasId && s.status !== 'nonaktif')
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [adminState.students, effectiveKelasId]);

  const defaultTpCount = Math.max(1, Math.min(10, dynamicTPs.length || 5));

  const currentGradeBook: GradeBookData = useMemo(() => {
    const existing = adminState.grades[gradeKey];
    if (existing) {
      return {
        weights: existing.weights || { ...DEFAULT_WEIGHTS },
        tpCount: existing.tpCount || defaultTpCount,
        rows: existing.rows || {},
      };
    }
    return {
      weights: { ...DEFAULT_WEIGHTS },
      tpCount: defaultTpCount,
      rows: {},
    };
  }, [adminState.grades, gradeKey, defaultTpCount]);

  const mutateGradeBook = (updater: (book: GradeBookData) => GradeBookData) => {
    const updated = updateAdminGuruState((prev) => {
      const existing = prev.grades[gradeKey] || {
        weights: { ...DEFAULT_WEIGHTS },
        tpCount: defaultTpCount,
        rows: {},
      };
      return {
        ...prev,
        grades: {
          ...prev.grades,
          [gradeKey]: updater(existing),
        },
      };
    });
    setAdminState(updated);
  };

  const handleScoreChange = (
    studentId: string,
    kind: 'formatif' | 'sumatif' | 'pats',
    colKey: string,
    raw: string
  ) => {
    const val = clampScore(raw);
    mutateGradeBook((book) => {
      const prevRow = book.rows[studentId] || createEmptyGradeRow();
      const nextRow = {
        ...prevRow,
        formatif: { ...prevRow.formatif },
        sumatif: { ...prevRow.sumatif },
      };
      if (kind === 'formatif') nextRow.formatif[colKey] = val;
      else if (kind === 'sumatif') nextRow.sumatif[colKey] = val;
      else nextRow.pats = val;

      return {
        ...book,
        rows: {
          ...book.rows,
          [studentId]: nextRow,
        },
      };
    });
  };

  const handleWeightChange = (field: keyof GradeWeights, val: number) => {
    mutateGradeBook((book) => ({
      ...book,
      weights: {
        ...book.weights,
        [field]: Math.max(0, Math.min(100, Number(val) || 0)),
      },
    }));
  };

  const handleTpCountChange = (count: number) => {
    mutateGradeBook((book) => ({
      ...book,
      tpCount: Math.max(1, Math.min(10, count)),
    }));
  };

  const handleAddMapel = (e: React.FormEvent) => {
    e.preventDefault();
    const m = customMapel.trim();
    if (!m) return;
    setSelectedMapel(m);
    setCustomMapel('');
    mutateGradeBook((b) => b);
    api?.toast(`Mata pelajaran "${m}" dipilih untuk input nilai.`);
  };

  const handleExportExcel = () => {
    if (studentsInClass.length === 0) {
      api?.toast('Belum ada data siswa di kelas ini.');
      return;
    }
    exportGradesXlsx({
      students: studentsInClass,
      kelasNama: activeKelas?.nama || 'Kelas',
      mapel: selectedMapel,
      tpCount: currentGradeBook.tpCount,
      tps: dynamicTPs,
      gradeBook: currentGradeBook,
    });
    api?.toast('Rekap Daftar Nilai berhasil diunduh (.xlsx).');
  };

  const totalWeight =
    (Number(currentGradeBook.weights.formatif) || 0) +
    (Number(currentGradeBook.weights.sumatif) || 0) +
    (Number(currentGradeBook.weights.pats) || 0);

  const tpColumns = useMemo(() => {
    const arr: Array<{ key: string; label: string; title: string }> = [];
    for (let i = 1; i <= currentGradeBook.tpCount; i++) {
      const info = dynamicTPs[i - 1];
      arr.push({
        key: `tp${i}`,
        label: `TP ${i}`,
        title: info ? info.fullText : `Tujuan Pembelajaran ${i}`,
      });
    }
    return arr;
  }, [currentGradeBook.tpCount, dynamicTPs]);

  const ident = legacy?.identitas || {};
  const signHtml = api ? api.signHTML() : '';

  return (
    <div className="max-w-[1300px] mx-auto space-y-4">
      <div className="panel noprint !max-w-none">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e9e4d4] pb-3 mb-4">
          <div>
            <h2 className="!border-0 !pb-0 !mb-1">Daftar Nilai Harian</h2>
            <p className="hint !mb-0">
              Kolom <b>Nilai Formatif (TP 1–{currentGradeBook.tpCount})</b> otomatis menyesuaikan daftar TP dari Promes, dilengkapi <b>Sumatif TP 1–5</b>, <b>Rata Sumatif</b>, <b>PATS</b>, serta kalkulasi otomatis <b>Nilai Akhir</b>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn sm"
              onClick={() => setShowWeightEditor((v) => !v)}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Atur Bobot &amp; Jumlah TP
            </button>
            <button type="button" className="btn sm" onClick={handleExportExcel}>
              <Download className="w-4 h-4 text-[#126451]" />
              Ekspor Excel (.xlsx)
            </button>
            <button type="button" className="btn primary" onClick={() => window.print()}>
              <Printer className="w-4 h-4" />
              Cetak / PDF Siap TTD
            </button>
          </div>
        </div>

        {/* Filter Kelas & Mapel */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-3">
            <label className="f">Filter Tingkat</label>
            <div className="flex gap-1.5 flex-wrap">
              {(['all', '10', '11', '12'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`btn sm ${filterTingkat === t ? 'primary' : ''}`}
                  onClick={() => {
                    setFilterTingkat(t);
                    const first =
                      t === 'all'
                        ? adminState.classes[0]
                        : adminState.classes.find((c) => c.tingkat === t);
                    if (first) setSelectedKelasId(first.id);
                  }}
                >
                  {t === 'all' ? 'Semua' : `Kls ${t}`}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="f">Kelas / Rombel</label>
            <select
              className="in"
              value={effectiveKelasId}
              onChange={(e) => setSelectedKelasId(e.target.value)}
            >
              {visibleClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  Kelas {c.tingkat} — {c.nama}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
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

          <div className="md:col-span-3">
            <form onSubmit={handleAddMapel} className="flex gap-1.5 items-end">
              <div className="flex-1">
                <label className="f">Tambah Mapel Lain (Opsional)</label>
                <input
                  className="in"
                  placeholder="Mis. Akidah Akhlak"
                  value={customMapel}
                  onChange={(e) => setCustomMapel(e.target.value)}
                />
              </div>
              <button type="submit" className="btn sm">
                Pilih
              </button>
            </form>
          </div>
        </div>

        {/* Info Bobot */}
        <div className="mt-3 pt-3 border-t border-[#eaf0e9] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="badge">
              Bobot Nilai Akhir: Formatif {currentGradeBook.weights.formatif}% + Sumatif {currentGradeBook.weights.sumatif}% + PATS {currentGradeBook.weights.pats}%
            </span>
            {totalWeight !== 100 && (
              <span className="badge hots">
                Catatan: Total bobot saat ini {totalWeight}% (disarankan 100%, nilai otomatis dinormalisasi proporsional).
              </span>
            )}
          </div>
          <span className="text-[#64736c]">
            Kolom TP sinkron dengan Promes ({dynamicTPs.length} TP tersedia) · Ketik nilai 0–100
          </span>
        </div>

        {showWeightEditor && (
          <div className="mt-3 p-3 rounded-lg border border-[#d9e2d9] bg-[#f8faf5] grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="f">Jumlah Kolom Formatif (TP 1–10)</label>
              <select
                className="in"
                value={currentGradeBook.tpCount}
                onChange={(e) => handleTpCountChange(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} Kolom (TP 1 s.d. TP {n})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="f">Bobot Formatif (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                className="in"
                value={currentGradeBook.weights.formatif}
                onChange={(e) => handleWeightChange('formatif', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="f">Bobot Sumatif (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                className="in"
                value={currentGradeBook.weights.sumatif}
                onChange={(e) => handleWeightChange('sumatif', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="f">Bobot PATS (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                className="in"
                value={currentGradeBook.weights.pats}
                onChange={(e) => handleWeightChange('pats', Number(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabel Input Nilai */}
      <div className="panel noprint !max-w-none">
        {studentsInClass.length === 0 ? (
          <div className="empty">
            <b>Belum ada siswa di kelas {activeKelas?.nama || 'ini'}</b>
            <span>
              Tambahkan data siswa di menu{' '}
              <a href="#/kelas-siswa" className="font-bold underline">
                Data Kelas &amp; Siswa
              </a>{' '}
              untuk mulai menginput nilai harian, sumatif, dan PATS.
            </span>
          </div>
        ) : (
          <div className="tw">
            <table className="work">
              <thead>
                <tr>
                  <th rowSpan={2} className="c w-10">No</th>
                  <th rowSpan={2} className="name">Nama Siswa &amp; NISN</th>
                  <th colSpan={tpColumns.length + 1} className="c !bg-[#e2f0e8] text-[#0b3c32]">
                    Nilai Formatif (Berdasarkan TP Promes)
                  </th>
                  <th colSpan={6} className="c !bg-[#f7efd9] text-[#6b4a00]">
                    Nilai Sumatif
                  </th>
                  <th rowSpan={2} className="c w-20">PATS</th>
                  <th rowSpan={2} className="c w-24 !bg-[#dcefea]">Nilai Akhir</th>
                  <th rowSpan={2} className="c w-28">Predikat</th>
                </tr>
                <tr>
                  {tpColumns.map((tp) => (
                    <th key={tp.key} className="c" title={tp.title}>
                      <span className="cursor-help underline decoration-dotted">{tp.label}</span>
                    </th>
                  ))}
                  <th className="c !bg-[#eef6f3]">Rata Fmt</th>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <th key={`s${s}`} className="c">
                      Sum {s}
                    </th>
                  ))}
                  <th className="c !bg-[#fbf4e2]">Rata Sum</th>
                </tr>
              </thead>
              <tbody>
                {studentsInClass.map((st, idx) => {
                  const row = currentGradeBook.rows[st.id];
                  const metrics = calcStudentGradeMetrics(
                    row,
                    currentGradeBook.weights,
                    currentGradeBook.tpCount
                  );
                  return (
                    <tr key={st.id}>
                      <td className="c">{idx + 1}</td>
                      <td className="name">
                        <div className="font-semibold text-[#0b3c32]">{st.nama}</div>
                        <div className="text-[11px] text-[#64736c] font-mono">{st.nisn || '-'}</div>
                      </td>
                      {tpColumns.map((tp) => (
                        <td key={tp.key} className="c">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            className="cell !w-14"
                            value={row?.formatif[tp.key] ?? ''}
                            onChange={(e) =>
                              handleScoreChange(st.id, 'formatif', tp.key, e.target.value)
                            }
                          />
                        </td>
                      ))}
                      <td className="calc">{metrics.avgFormatif ?? '-'}</td>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <td key={`s${s}`} className="c">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            className="cell !w-14"
                            value={row?.sumatif[`s${s}`] ?? ''}
                            onChange={(e) =>
                              handleScoreChange(st.id, 'sumatif', `s${s}`, e.target.value)
                            }
                          />
                        </td>
                      ))}
                      <td className="calc">{metrics.avgSumatif ?? '-'}</td>
                      <td className="c">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className="cell !w-16 font-semibold"
                          value={row?.pats ?? ''}
                          onChange={(e) =>
                            handleScoreChange(st.id, 'pats', 'pats', e.target.value)
                          }
                        />
                      </td>
                      <td className="calc !bg-[#e2f0e8] text-[#0b3c32] text-sm">
                        {metrics.nilaiAkhir ?? '-'}
                      </td>
                      <td className="c text-xs font-semibold">
                        {metrics.predikat !== '-' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#f4f7ef] border border-[#d9e2d9]">
                            <Award className="w-3 h-3 text-[#a17b31]" />
                            {metrics.predikat.split(' ')[0]}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dokumen Cetak Resmi Rekap Nilai (Landscape) */}
      {studentsInClass.length > 0 && (
        <div className="paper land">
          <div className="dt">DAFTAR NILAI HARIAN, SUMATIF &amp; PATS</div>
          <div className="dt2">{ident.namaSekolah || 'MADRASAH ALIYAH BANU HASYIM'}</div>
          <table className="info">
            <tbody>
              <tr>
                <td>Mata Pelajaran</td>
                <td>: {selectedMapel}</td>
                <td style={{ paddingLeft: 28 }}>Kelas / Rombel</td>
                <td>: {activeKelas?.nama || '-'} (Kelas {activeKelas?.tingkat || '-'})</td>
              </tr>
              <tr>
                <td>Tahun Pelajaran</td>
                <td>: {ident.tahun || '-'}</td>
                <td style={{ paddingLeft: 28 }}>Bobot Nilai Akhir</td>
                <td>
                  : Formatif {currentGradeBook.weights.formatif}% · Sumatif {currentGradeBook.weights.sumatif}% · PATS {currentGradeBook.weights.pats}%
                </td>
              </tr>
            </tbody>
          </table>

          <table className="doc xs">
            <thead>
              <tr>
                <th rowSpan={2} className="c" style={{ width: '3%' }}>No</th>
                <th rowSpan={2} style={{ width: '10%' }}>NIS/NISN</th>
                <th rowSpan={2} style={{ width: '18%' }}>Nama Peserta Didik</th>
                <th colSpan={tpColumns.length + 1} className="c">Nilai Formatif</th>
                <th colSpan={6} className="c">Nilai Sumatif</th>
                <th rowSpan={2} className="c" style={{ width: '4.5%' }}>PATS</th>
                <th rowSpan={2} className="c" style={{ width: '5.5%' }}>Nilai Akhir</th>
                <th rowSpan={2} className="c" style={{ width: '6%' }}>Pred.</th>
              </tr>
              <tr>
                {tpColumns.map((tp) => (
                  <th key={tp.key} className="c">
                    {tp.label}
                  </th>
                ))}
                <th className="c">Rata</th>
                {[1, 2, 3, 4, 5].map((s) => (
                  <th key={`ps${s}`} className="c">
                    S{s}
                  </th>
                ))}
                <th className="c">Rata</th>
              </tr>
            </thead>
            <tbody>
              {studentsInClass.map((st, idx) => {
                const row = currentGradeBook.rows[st.id];
                const metrics = calcStudentGradeMetrics(
                  row,
                  currentGradeBook.weights,
                  currentGradeBook.tpCount
                );
                return (
                  <tr key={st.id}>
                    <td className="c">{idx + 1}</td>
                    <td>{st.nisn || '-'}</td>
                    <td>{st.nama}</td>
                    {tpColumns.map((tp) => (
                      <td key={tp.key} className="c">
                        {row?.formatif[tp.key] ?? '-'}
                      </td>
                    ))}
                    <td className="c">
                      <b>{metrics.avgFormatif ?? '-'}</b>
                    </td>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <td key={`ps${s}`} className="c">
                        {row?.sumatif[`s${s}`] ?? '-'}
                      </td>
                    ))}
                    <td className="c">
                      <b>{metrics.avgSumatif ?? '-'}</b>
                    </td>
                    <td className="c">{metrics.pats ?? '-'}</td>
                    <td className="c">
                      <b>{metrics.nilaiAkhir ?? '-'}</b>
                    </td>
                    <td className="c">{metrics.predikat.split(' ')[0]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {signHtml && <div dangerouslySetInnerHTML={{ __html: signHtml }} />}
        </div>
      )}
    </div>
  );
};
