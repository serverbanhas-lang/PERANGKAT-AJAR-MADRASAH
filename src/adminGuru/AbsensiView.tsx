import React, { useMemo, useState } from 'react';
import { CalendarCheck, CheckCheck, Printer, RotateCcw } from 'lucide-react';
import {
  computeAttendanceSummary,
  formatTanggalID,
  getAdminGuruState,
  getAppApi,
  getDayCalendarStatus,
  getLegacyState,
  getPreferredKelasId,
  updateAdminGuruState,
} from './bridge';
import { useGlobalStudents } from './useGlobalStudents';
import type { AttendanceStatus, TingkatKelas } from '../types/adminGuru';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const STATUS_META: Array<{ code: AttendanceStatus; label: string; activeClass: string }> = [
  { code: 'H', label: 'Hadir', activeClass: 'bg-[#1c7a45] text-white border-[#1c7a45]' },
  { code: 'S', label: 'Sakit', activeClass: 'bg-[#134f8a] text-white border-[#134f8a]' },
  { code: 'I', label: 'Izin', activeClass: 'bg-[#c68a0f] text-white border-[#c68a0f]' },
  { code: 'A', label: 'Alpa', activeClass: 'bg-[#b3261e] text-white border-[#b3261e]' },
];

export const AbsensiView: React.FC = () => {
  const [adminState, setAdminState] = useState(() => getAdminGuruState());
  const { classes: globalClasses } = useGlobalStudents();
  const [filterTingkat, setFilterTingkat] = useState<'all' | TingkatKelas>('all');
  const [selectedKelasId, setSelectedKelasId] = useState<string>(() =>
    getPreferredKelasId(globalClasses)
  );
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());

  const api = getAppApi();
  const legacy = getLegacyState();

  const visibleClasses = useMemo(() => {
    if (filterTingkat === 'all') return globalClasses;
    return globalClasses.filter((c) => c.tingkat === filterTingkat);
  }, [globalClasses, filterTingkat]);

  const activeKelas = useMemo(
    () => globalClasses.find((c) => c.id === selectedKelasId) || visibleClasses[0],
    [globalClasses, selectedKelasId, visibleClasses]
  );

  const effectiveKelasId = activeKelas?.id || selectedKelasId;

  const { students: studentsInClass } = useGlobalStudents({
    kelasId: effectiveKelasId,
    activeOnly: true,
    sortByName: true,
  });

  const attendanceKey = `${effectiveKelasId}::${selectedDate}`;
  const currentRecord = adminState.attendance[attendanceKey] || {};

  const calStatus = useMemo(() => getDayCalendarStatus(selectedDate), [selectedDate]);

  const summary = useMemo(
    () => computeAttendanceSummary(adminState.attendance, effectiveKelasId, selectedDate, studentsInClass),
    [adminState.attendance, effectiveKelasId, selectedDate, studentsInClass]
  );

  const handleMarkAllHadir = () => {
    if (studentsInClass.length === 0) {
      api?.toast('Belum ada siswa pada kelas ini. Tambahkan siswa di menu Data Kelas & Siswa.');
      return;
    }
    const updated = updateAdminGuruState((prev) => {
      const nextRec: Record<string, AttendanceStatus> = { ...(prev.attendance[attendanceKey] || {}) };
      studentsInClass.forEach((st) => {
        nextRec[st.id] = 'H';
      });
      return {
        ...prev,
        attendance: {
          ...prev.attendance,
          [attendanceKey]: nextRec,
        },
      };
    });
    setAdminState(updated);
    api?.toast(`${studentsInClass.length} siswa ditandai Hadir Semua pada ${formatTanggalID(selectedDate)}.`);
  };

  const handleSetSingle = (studentId: string, status: AttendanceStatus) => {
    const updated = updateAdminGuruState((prev) => ({
      ...prev,
      attendance: {
        ...prev.attendance,
        [attendanceKey]: {
          ...(prev.attendance[attendanceKey] || {}),
          [studentId]: status,
        },
      },
    }));
    setAdminState(updated);
  };

  const handleResetDate = () => {
    const updated = updateAdminGuruState((prev) => {
      const copy = { ...prev.attendance };
      delete copy[attendanceKey];
      return { ...prev, attendance: copy };
    });
    setAdminState(updated);
    api?.toast('Data absensi pada tanggal ini dikosongkan.');
  };

  const ident = legacy?.identitas || {};
  const signHtml = api ? api.signHTML() : '';

  return (
    <div className="max-w-[1100px] mx-auto space-y-4">
      <div className="panel noprint">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e9e4d4] pb-3 mb-4">
          <div>
            <h2 className="!border-0 !pb-0 !mb-1">Absensi Siswa</h2>
            <p className="hint !mb-0">
              Catat kehadiran per pertemuan. Rekap <b>Hadir / Sakit / Izin / Alpa</b> otomatis terintegrasi ke <b>Jurnal Mengajar</b> pada tanggal yang sama.
            </p>
          </div>
          <button type="button" className="btn sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            Cetak Daftar Hadir
          </button>
        </div>

        {/* Filter Kelas & Tanggal */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
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
                        ? globalClasses[0]
                        : globalClasses.find((c) => c.tingkat === t);
                    if (first) setSelectedKelasId(first.id);
                  }}
                >
                  {t === 'all' ? 'Semua' : `Kelas ${t}`}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-4">
            <label className="f">Pilih Kelas / Rombel</label>
            <select
              className="in"
              value={effectiveKelasId}
              onChange={(e) => setSelectedKelasId(e.target.value)}
            >
              {visibleClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  Kelas {c.tingkat} — {c.nama} ({c.jurusan})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="f">Tanggal Pertemuan</label>
            <input
              type="date"
              className="in"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>

        {/* Status Kalender Pendidikan */}
        <div
          className={`mt-3 px-3 py-2 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${
            calStatus.isEffective
              ? 'bg-[#eaf5f3] border-[#bcd6d2] text-[#0b3c32]'
              : 'bg-[#fff6e0] border-[#f0d58a] text-[#6b4a00]'
          }`}
        >
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 shrink-0" />
            <span>
              <b>{calStatus.hari}, {formatTanggalID(selectedDate)}</b> · Semester {calStatus.semester} ·{' '}
              {calStatus.statusLabel}
            </span>
          </div>
          <span className="font-semibold">
            {summary.recorded ? 'Tersimpan di sistem' : 'Belum ada centangan pada tanggal ini'}
          </span>
        </div>

        {/* Tombol Centang Massal & Ringkasan */}
        <div className="mt-4 pt-3 border-t border-[#eaf0e9] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn primary"
              onClick={handleMarkAllHadir}
            >
              <CheckCheck className="w-4 h-4" />
              Hadir Semua (Centang Massal)
            </button>
            {summary.recorded && (
              <button type="button" className="btn sm" onClick={handleResetDate}>
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Tanggal Ini
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="px-2.5 py-1 rounded-md bg-[#e1f3e8] text-[#1c7a45]">Hadir: {summary.H}</span>
            <span className="px-2.5 py-1 rounded-md bg-[#d6e8fb] text-[#134f8a]">Sakit: {summary.S}</span>
            <span className="px-2.5 py-1 rounded-md bg-[#fdf0c8] text-[#7a5200]">Izin: {summary.I}</span>
            <span className="px-2.5 py-1 rounded-md bg-[#f9d6d3] text-[#b3261e]">Alpa: {summary.A}</span>
            <span className="px-2.5 py-1 rounded-md bg-[#eef3f3] text-[#33444c]">
              Total Siswa: {studentsInClass.length}
            </span>
          </div>
        </div>
      </div>

      {/* Tabel Absensi Interaktif */}
      <div className="panel noprint">
        {studentsInClass.length === 0 ? (
          <div className="empty">
            <b>Belum ada siswa di kelas {activeKelas?.nama || 'ini'}</b>
            <span>
              Silakan tambahkan atau impor data siswa melalui menu{' '}
              <a href="#/kelas-siswa" className="font-bold underline">
                Data Kelas &amp; Siswa
              </a>{' '}
              terlebih dahulu.
            </span>
          </div>
        ) : (
          <div className="tw">
            <table className="work">
              <thead>
                <tr>
                  <th className="c w-12">No</th>
                  <th>NIS / NISN</th>
                  <th>Nama Lengkap</th>
                  <th className="c w-14">L/P</th>
                  <th className="c w-72">Status Kehadiran (Klik Satuan)</th>
                </tr>
              </thead>
              <tbody>
                {studentsInClass.map((st, idx) => {
                  const status = currentRecord[st.id];
                  return (
                    <tr key={st.id}>
                      <td className="c">{idx + 1}</td>
                      <td className="font-mono text-xs">{st.nisn || '-'}</td>
                      <td className="font-semibold text-[#0b3c32]">{st.nama}</td>
                      <td className="c">{st.jk}</td>
                      <td className="c">
                        <div className="inline-flex gap-1.5 justify-center flex-wrap">
                          {STATUS_META.map((opt) => {
                            const active = status === opt.code;
                            return (
                              <button
                                key={opt.code}
                                type="button"
                                onClick={() => handleSetSingle(st.id, opt.code)}
                                className={`px-2.5 py-1 rounded text-xs font-bold border transition cursor-pointer ${
                                  active
                                    ? opt.activeClass
                                    : 'bg-white text-[#33444c] border-[#d5dfd5] hover:bg-[#f3f7f7]'
                                }`}
                              >
                                {opt.code} · {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lembar Cetak PDF (muncul sebagai pratinjau cetak formal & saat Print) */}
      {studentsInClass.length > 0 && (
        <div className="paper">
          <div className="dt">DAFTAR HADIR PESERTA DIDIK</div>
          <div className="dt2">{ident.namaSekolah || 'MADRASAH ALIYAH BANU HASYIM'}</div>
          <table className="info">
            <tbody>
              <tr>
                <td>Mata Pelajaran</td>
                <td>: {ident.mapel || '-'}</td>
                <td style={{ paddingLeft: 24 }}>Kelas / Rombel</td>
                <td>: {activeKelas?.nama || '-'} (Kelas {activeKelas?.tingkat || '-'})</td>
              </tr>
              <tr>
                <td>Hari / Tanggal</td>
                <td>: {calStatus.hari}, {formatTanggalID(selectedDate)}</td>
                <td style={{ paddingLeft: 24 }}>Tahun Pelajaran</td>
                <td>: {ident.tahun || '-'}</td>
              </tr>
            </tbody>
          </table>
          <table className="doc">
            <thead>
              <tr>
                <th className="c" style={{ width: '7%' }}>No</th>
                <th style={{ width: '18%' }}>NIS / NISN</th>
                <th style={{ width: '43%' }}>Nama Lengkap</th>
                <th className="c" style={{ width: '8%' }}>L/P</th>
                <th className="c" style={{ width: '24%' }}>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {studentsInClass.map((st, idx) => {
                const code = currentRecord[st.id];
                const label =
                  code === 'H'
                    ? 'Hadir'
                    : code === 'S'
                      ? 'Sakit'
                      : code === 'I'
                        ? 'Izin'
                        : code === 'A'
                          ? 'Alpa'
                          : '-';
                return (
                  <tr key={st.id}>
                    <td className="c">{idx + 1}</td>
                    <td>{st.nisn || '-'}</td>
                    <td>{st.nama}</td>
                    <td className="c">{st.jk}</td>
                    <td className="c">
                      <b>{label}</b>
                    </td>
                  </tr>
                );
              })}
              <tr className="tot">
                <td colSpan={5}>
                  Rekapitulasi Kehadiran — Hadir: {summary.H} · Sakit: {summary.S} · Izin: {summary.I} · Alpa: {summary.A} · Total: {studentsInClass.length} siswa
                </td>
              </tr>
            </tbody>
          </table>
          {signHtml && <div dangerouslySetInnerHTML={{ __html: signHtml }} />}
        </div>
      )}
    </div>
  );
};
