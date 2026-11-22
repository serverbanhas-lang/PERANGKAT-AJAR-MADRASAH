import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Download,
  FileSpreadsheet,
  Globe,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Unlock,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  createUid,
  downloadStudentTemplateXlsx,
  exportStudentsXlsx,
  getAdminGuruState,
  getAppApi,
  getLegacyState,
  parseStudentImportXlsx,
  readGlobalMasterStore,
  subscribeMasterStudents,
  syncMasterStudentsWithServer,
  updateAdminGuruState,
  writeGlobalMasterStore,
} from './bridge';
import type { JenisKelamin, KelasItem, StudentItem, TingkatKelas } from '../types/adminGuru';

export const DataSiswaView: React.FC = () => {
  const [adminState, setAdminState] = useState(() => getAdminGuruState());
  const [masterMeta, setMasterMeta] = useState(() => readGlobalMasterStore());
  const [syncing, setSyncing] = useState(false);

  const [filterTingkat, setFilterTingkat] = useState<'all' | TingkatKelas>('all');
  const [filterKelasId, setFilterKelasId] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Form tambah/edit siswa
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formNisn, setFormNisn] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formJk, setFormJk] = useState<JenisKelamin>('L');
  const [formKelasId, setFormKelasId] = useState<string>(adminState.classes[0]?.id || 'kls_10_a');

  // Form kelola rombel
  const [showRombelPanel, setShowRombelPanel] = useState(false);
  const [newRombelTingkat, setNewRombelTingkat] = useState<TingkatKelas>('10');
  const [newRombelNama, setNewRombelNama] = useState('');
  const [newRombelJurusan, setNewRombelJurusan] = useState('Umum');
  const [newRombelWali, setNewRombelWali] = useState('');

  // Konfirmasi hapus inline
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteClassId, setConfirmDeleteClassId] = useState<string | null>(null);

  // Preview impor Excel
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importPreview, setImportPreview] = useState<{
    rows: StudentItem[];
    skipped: number;
    fileName: string;
  } | null>(null);

  const api = getAppApi();
  const legacy = getLegacyState();
  const activeMapelName = legacy?.ws?.mapel || legacy?.identitas?.mapel || '';
  const activeKelasName = legacy?.ws?.kelas || legacy?.identitas?.kelas || '';
  const isLockedForTeachers = masterMeta.adminLockedForTeachers;

  useEffect(() => {
    const refresh = () => {
      setAdminState(getAdminGuruState());
      setMasterMeta(readGlobalMasterStore());
    };
    const unsub = subscribeMasterStudents(refresh);
    return unsub;
  }, []);

  const handleManualSyncAll = async () => {
    setSyncing(true);
    try {
      const merged = await syncMasterStudentsWithServer({ rescanWorkspaces: true });
      setAdminState(getAdminGuruState());
      setMasterMeta(merged);
      api?.toast(
        `Sinkronisasi selesai: ${merged.students.length} siswa & ${merged.classes.length} rombel aktif untuk semua mapel.`
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleLockForTeachers = () => {
    const nextLocked = !isLockedForTeachers;
    const saved = writeGlobalMasterStore({ adminLockedForTeachers: nextLocked }, true);
    setMasterMeta(saved);
    if (nextLocked) {
      setShowStudentForm(false);
      setShowRombelPanel(false);
      setImportPreview(null);
      api?.toast('Mode Guru (Hanya Lihat) diaktifkan. Data siswa dikunci untuk pengunggahan Admin.');
    } else {
      api?.toast('Mode Admin aktif. Admin dapat menambah, mengimpor, dan mengubah data siswa.');
    }
  };

  const classesByTingkat = useMemo(() => {
    if (filterTingkat === 'all') return adminState.classes;
    return adminState.classes.filter((c) => c.tingkat === filterTingkat);
  }, [adminState.classes, filterTingkat]);

  const classMap = useMemo(() => {
    return new Map(adminState.classes.map((c) => [c.id, c]));
  }, [adminState.classes]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return adminState.students
      .filter((s) => {
        const cls = classMap.get(s.kelasId);
        if (filterTingkat !== 'all' && cls?.tingkat !== filterTingkat) return false;
        if (filterKelasId !== 'all' && s.kelasId !== filterKelasId) return false;
        if (q) {
          const hit =
            s.nama.toLowerCase().includes(q) ||
            s.nisn.toLowerCase().includes(q) ||
            (cls?.nama || '').toLowerCase().includes(q);
          if (!hit) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const ca = classMap.get(a.kelasId)?.nama || '';
        const cb = classMap.get(b.kelasId)?.nama || '';
        if (ca !== cb) return ca.localeCompare(cb);
        return a.nama.localeCompare(b.nama);
      });
  }, [adminState.students, classMap, filterTingkat, filterKelasId, search]);

  const stats = useMemo(() => {
    const total = filteredStudents.length;
    const putra = filteredStudents.filter((s) => s.jk === 'L').length;
    const putri = filteredStudents.filter((s) => s.jk === 'P').length;
    return { total, putra, putri };
  }, [filteredStudents]);

  const handleOpenAddStudent = () => {
    if (isLockedForTeachers) return;
    setEditingId(null);
    setFormNisn('');
    setFormNama('');
    setFormJk('L');
    const defaultKls =
      filterKelasId !== 'all'
        ? filterKelasId
        : classesByTingkat[0]?.id || adminState.classes[0]?.id || '';
    setFormKelasId(defaultKls);
    setShowStudentForm(true);
  };

  const handleOpenEditStudent = (st: StudentItem) => {
    if (isLockedForTeachers) return;
    setEditingId(st.id);
    setFormNisn(st.nisn);
    setFormNama(st.nama);
    setFormJk(st.jk);
    setFormKelasId(st.kelasId);
    setShowStudentForm(true);
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedForTeachers) return;
    const nama = formNama.trim();
    if (!nama) {
      api?.toast('Nama lengkap siswa wajib diisi.');
      return;
    }
    if (!formKelasId) {
      api?.toast('Pilih kelas/rombel terlebih dahulu.');
      return;
    }

    const updated = updateAdminGuruState((prev) => {
      if (editingId) {
        return {
          ...prev,
          students: prev.students.map((s) =>
            s.id === editingId
              ? { ...s, nisn: formNisn.trim(), nama, jk: formJk, kelasId: formKelasId }
              : s
          ),
        };
      }
      const newStudent: StudentItem = {
        id: createUid('std'),
        nisn: formNisn.trim(),
        nama,
        jk: formJk,
        kelasId: formKelasId,
        status: 'aktif',
      };
      return {
        ...prev,
        students: [...prev.students, newStudent],
      };
    });

    setAdminState(updated);
    setShowStudentForm(false);
    setEditingId(null);
    api?.toast(
      editingId
        ? 'Data siswa diperbarui untuk seluruh mapel.'
        : 'Siswa baru berhasil ditambahkan ke Master Sekolah.'
    );
  };

  const handleDeleteStudent = (id: string) => {
    if (isLockedForTeachers) return;
    const updated = updateAdminGuruState((prev) => ({
      ...prev,
      students: prev.students.filter((s) => s.id !== id),
    }));
    setAdminState(updated);
    setConfirmDeleteId(null);
    api?.toast('Data siswa dihapus dari Master Sekolah.');
  };

  const handleAddRombel = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedForTeachers) return;
    const nama = newRombelNama.trim();
    if (!nama) {
      api?.toast('Nama rombel wajib diisi (misal: X-C atau XI-IPA-2).');
      return;
    }
    const exists = adminState.classes.some((c) => c.nama.toLowerCase() === nama.toLowerCase());
    if (exists) {
      api?.toast(`Kelas "${nama}" sudah terdaftar.`);
      return;
    }
    const newKelas: KelasItem = {
      id: createUid('kls'),
      tingkat: newRombelTingkat,
      nama,
      jurusan: newRombelJurusan.trim() || 'Umum',
      waliKelas: newRombelWali.trim(),
    };
    const updated = updateAdminGuruState((prev) => ({
      ...prev,
      classes: [...prev.classes, newKelas],
    }));
    setAdminState(updated);
    setNewRombelNama('');
    setNewRombelWali('');
    api?.toast(`Rombel ${nama} berhasil ditambahkan untuk semua mapel.`);
  };

  const handleDeleteRombel = (kelasId: string) => {
    if (isLockedForTeachers) return;
    const hasStudents = adminState.students.some((s) => s.kelasId === kelasId);
    if (hasStudents) {
      api?.toast('Kosongkan atau pindahkan siswa dari rombel ini terlebih dahulu.');
      setConfirmDeleteClassId(null);
      return;
    }
    const updated = updateAdminGuruState((prev) => ({
      ...prev,
      classes: prev.classes.filter((c) => c.id !== kelasId),
    }));
    setAdminState(updated);
    if (filterKelasId === kelasId) setFilterKelasId('all');
    setConfirmDeleteClassId(null);
    api?.toast('Rombel berhasil dihapus.');
  };

  const handleDownloadTemplate = () => {
    const selectedNama =
      filterKelasId !== 'all'
        ? classMap.get(filterKelasId)?.nama
        : classesByTingkat[0]?.nama;
    downloadStudentTemplateXlsx(adminState.classes, selectedNama);
    api?.toast('Template Excel (.xlsx) berhasil diunduh.');
  };

  const handleFileChange = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    if (isLockedForTeachers) return;
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;

    const fallbackId =
      filterKelasId !== 'all'
        ? filterKelasId
        : classesByTingkat[0]?.id || adminState.classes[0]?.id || '';

    try {
      const { imported, skippedRows } = await parseStudentImportXlsx(
        file,
        adminState.classes,
        fallbackId
      );
      if (imported.length === 0) {
        api?.toast('Tidak ada baris siswa valid yang ditemukan pada file Excel.');
        return;
      }
      setImportPreview({ rows: imported, skipped: skippedRows, fileName: file.name });
    } catch (err) {
      api?.toast(err instanceof Error ? err.message : 'Gagal membaca file Excel (.xlsx).');
    }
  };

  const handleConfirmImport = () => {
    if (!importPreview || isLockedForTeachers) return;
    let addedCount = 0;
    let duplicateCount = 0;

    const updated = updateAdminGuruState((prev) => {
      const existingSig = new Set(
        prev.students.map((s) =>
          s.nisn
            ? `nisn:${s.nisn.trim().toLowerCase()}::${s.nama.trim().toLowerCase()}`
            : `name:${s.nama.trim().toLowerCase()}::${s.kelasId}`
        )
      );
      const uniqueNew: StudentItem[] = [];
      for (const row of importPreview.rows) {
        const sig = row.nisn
          ? `nisn:${row.nisn.trim().toLowerCase()}::${row.nama.trim().toLowerCase()}`
          : `name:${row.nama.trim().toLowerCase()}::${row.kelasId}`;
        if (existingSig.has(sig)) {
          duplicateCount++;
          continue;
        }
        existingSig.add(sig);
        uniqueNew.push(row);
      }
      addedCount = uniqueNew.length;
      return {
        ...prev,
        students: [...prev.students, ...uniqueNew],
      };
    });

    setAdminState(updated);
    api?.toast(
      duplicateCount > 0
        ? `Berhasil mengimpor ${addedCount} siswa baru (${duplicateCount} duplikat dilewati). Tersedia untuk semua mapel!`
        : `Berhasil mengimpor ${addedCount} siswa ke Master Sekolah untuk seluruh mapel!`
    );
    setImportPreview(null);
  };

  const handleExportStudents = () => {
    if (filteredStudents.length === 0) {
      api?.toast('Belum ada data siswa untuk diekspor.');
      return;
    }
    const label =
      filterKelasId !== 'all'
        ? classMap.get(filterKelasId)?.nama || 'Kelas'
        : filterTingkat !== 'all'
          ? `Kelas_${filterTingkat}`
          : 'Semua_Kelas';
    exportStudentsXlsx(filteredStudents, adminState.classes, label);
    api?.toast('Data siswa berhasil diekspor ke Excel (.xlsx).');
  };

  return (
    <div className="max-w-[1100px] mx-auto space-y-4">
      {/* Banner Pusat Data Terintegrasi Lintas Mapel & Guru */}
      <div className="rounded-xl border border-[#8ac5b2] bg-[#e7f5ef] px-4 py-3 text-xs text-[#0b3c32] flex flex-wrap items-center justify-between gap-3 noprint">
        <div className="flex items-start gap-2.5 min-w-0">
          <Globe className="w-5 h-5 text-[#0f6b58] shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-sm text-[#073329]">
              Pusat Master Data Kelas &amp; Siswa Sekolah (Berlaku untuk Semua Mapel &amp; Guru)
            </div>
            <div className="text-[#1f5547] mt-0.5 leading-relaxed">
              Cukup diunggah <b>1 kali oleh Admin</b> — seluruh mata pelajaran (
              <i>Akidah Akhlak, Al-Qur&apos;an Hadis, Fikih, SKI, Bahasa Arab, dll.</i>) otomatis
              memakai daftar siswa ini di Absensi, Jurnal, Daftar Nilai, dan Kuis.
              {activeMapelName && (
                <span className="ml-1 font-semibold text-[#0b3c32]">
                  (Ruang kerja aktif: {activeMapelName}
                  {activeKelasName ? ` · ${activeKelasName}` : ''})
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn sm"
            disabled={syncing}
            onClick={handleManualSyncAll}
            title="Tarik data siswa yang pernah diunggah dari mapel lain dan sinkronkan ke server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Menyinkronkan...' : 'Sinkronkan Semua Mapel'}
          </button>
          <button
            type="button"
            className={`btn sm ${isLockedForTeachers ? 'primary' : ''}`}
            onClick={handleToggleLockForTeachers}
            title="Admin dapat mengunci unggah siswa agar guru mapel hanya melihat roster"
          >
            {isLockedForTeachers ? (
              <>
                <Unlock className="w-3.5 h-3.5" /> Aktifkan Mode Admin (Edit/Unggah)
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" /> Kunci untuk Guru (Hanya Lihat)
              </>
            )}
          </button>
        </div>
      </div>

      {isLockedForTeachers && (
        <div className="rounded-xl border border-[#e3c87f] bg-[#fbf3de] px-4 py-2.5 text-xs text-[#614407] flex items-center gap-2 noprint">
          <ShieldCheck className="w-4 h-4 shrink-0 text-[#8b6416]" />
          <span>
            <b>Mode Guru (Hanya Lihat):</b> Pengunggahan dan perubahan daftar siswa sedang dikunci khusus untuk Admin sekolah. Guru mapel langsung dapat memakai seluruh data siswa ini pada menu Absensi, Nilai, dan Kuis.
          </span>
        </div>
      )}

      <div className="panel noprint">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e9e4d4] pb-3 mb-4">
          <div>
            <h2 className="!border-0 !pb-0 !mb-1">Master Data Kelas &amp; Siswa</h2>
            <p className="hint !mb-0">
              Total tersimpan di Master Sekolah: <b>{adminState.students.length} siswa</b> pada{' '}
              <b>{adminState.classes.length} rombel</b> (terhubung ke seluruh mapel).
            </p>
          </div>
          {!isLockedForTeachers && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn sm"
                onClick={() => setShowRombelPanel((v) => !v)}
              >
                <Users className="w-4 h-4" />
                {showRombelPanel ? 'Tutup Kelola Rombel' : 'Kelola Rombel'}
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={handleOpenAddStudent}
              >
                <Plus className="w-4 h-4" />
                Tambah Siswa
              </button>
            </div>
          )}
        </div>

        {/* Filter Tingkat & Rombel + Impor/Ekspor Excel */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label className="f">Filter Tingkat Kelas</label>
            <div className="flex gap-1.5 flex-wrap">
              {(['all', '10', '11', '12'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setFilterTingkat(t);
                    setFilterKelasId('all');
                  }}
                  className={`btn sm ${filterTingkat === t ? 'primary' : ''}`}
                >
                  {t === 'all' ? 'Semua' : `Kelas ${t}`}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-4">
            <label className="f">Rombel / Jurusan</label>
            <select
              className="in"
              value={filterKelasId}
              onChange={(e) => setFilterKelasId(e.target.value)}
            >
              <option value="all">Semua Rombel ({classesByTingkat.length})</option>
              {classesByTingkat.map((c) => {
                const count = adminState.students.filter((s) => s.kelasId === c.id).length;
                return (
                  <option key={c.id} value={c.id}>
                    Kelas {c.tingkat} — {c.nama} ({c.jurusan}) · {count} siswa
                  </option>
                );
              })}
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="f">Cari NIS/NISN atau Nama</label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#64736c] absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                className="in !pl-8"
                type="text"
                placeholder="Ketik nama atau NISN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Bar Impor & Ekspor Excel */}
        <div className="mt-4 pt-3 border-t border-[#eaf0e9] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2 items-center text-xs text-[#64736c]">
            <span className="badge">Tampil: {stats.total} siswa</span>
            <span className="badge">Putra (L): {stats.putra}</span>
            <span className="badge">Putri (P): {stats.putri}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isLockedForTeachers && (
              <>
                <button type="button" className="btn sm" onClick={handleDownloadTemplate}>
                  <FileSpreadsheet className="w-4 h-4 text-[#126451]" />
                  Unduh Template Excel (.xlsx)
                </button>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 text-[#126451]" />
                  Impor Excel (.xlsx)
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </>
            )}
            <button type="button" className="btn sm" onClick={handleExportStudents}>
              <Download className="w-4 h-4 text-[#126451]" />
              Ekspor Excel (.xlsx)
            </button>
          </div>
        </div>
      </div>

      {/* Panel Kelola Rombel */}
      {!isLockedForTeachers && showRombelPanel && (
        <div className="panel noprint">
          <h2>Kelola Rombel / Kelas (10, 11, 12)</h2>
          <form onSubmit={handleAddRombel} className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-end mb-4">
            <div>
              <label className="f">Tingkat</label>
              <select
                className="in"
                value={newRombelTingkat}
                onChange={(e) => setNewRombelTingkat(e.target.value as TingkatKelas)}
              >
                <option value="10">Kelas 10 (Fase E)</option>
                <option value="11">Kelas 11 (Fase F)</option>
                <option value="12">Kelas 12 (Fase F)</option>
              </select>
            </div>
            <div>
              <label className="f">Nama Rombel</label>
              <input
                className="in"
                placeholder="Mis. XI-IPA-2"
                value={newRombelNama}
                onChange={(e) => setNewRombelNama(e.target.value)}
              />
            </div>
            <div>
              <label className="f">Jurusan / Peminatan</label>
              <input
                className="in"
                placeholder="IPA / IPS / Agama / Umum"
                value={newRombelJurusan}
                onChange={(e) => setNewRombelJurusan(e.target.value)}
              />
            </div>
            <div>
              <label className="f">Wali Kelas (Opsional)</label>
              <input
                className="in"
                placeholder="Nama Wali Kelas"
                value={newRombelWali}
                onChange={(e) => setNewRombelWali(e.target.value)}
              />
            </div>
            <div>
              <button type="submit" className="btn primary w-full justify-center">
                <Plus className="w-4 h-4" /> Tambah Rombel
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {adminState.classes.map((c) => {
              const count = adminState.students.filter((s) => s.kelasId === c.id).length;
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-[#d9e2d9] bg-[#fffdf8]"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-[#0b3c32] text-sm">
                      {c.nama}{' '}
                      <span className="text-xs font-normal text-[#64736c]">
                        (Kls {c.tingkat} · {c.jurusan})
                      </span>
                    </div>
                    <div className="text-xs text-[#64736c]">
                      {count} siswa {c.waliKelas ? `· Wali: ${c.waliKelas}` : ''}
                    </div>
                  </div>
                  {confirmDeleteClassId === c.id ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="btn sm danger"
                        onClick={() => handleDeleteRombel(c.id)}
                      >
                        Hapus
                      </button>
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => setConfirmDeleteClassId(null)}
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn sm ghost text-[#a9322a]"
                      title="Hapus Rombel"
                      onClick={() => setConfirmDeleteClassId(c.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Form Tambah / Edit Siswa */}
      {!isLockedForTeachers && showStudentForm && (
        <div className="panel noprint border-l-4 border-l-[#126451]">
          <h2>{editingId ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}</h2>
          <form onSubmit={handleSaveStudent} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-3">
              <label className="f">NIS / NISN</label>
              <input
                className="in"
                placeholder="Contoh: 0081234567"
                value={formNisn}
                onChange={(e) => setFormNisn(e.target.value)}
              />
            </div>
            <div className="sm:col-span-4">
              <label className="f">Nama Lengkap *</label>
              <input
                className="in"
                placeholder="Nama lengkap sesuai absen"
                value={formNama}
                onChange={(e) => setFormNama(e.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="f">Jenis Kelamin</label>
              <select
                className="in"
                value={formJk}
                onChange={(e) => setFormJk(e.target.value as JenisKelamin)}
              >
                <option value="L">Laki-laki (L)</option>
                <option value="P">Perempuan (P)</option>
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="f">Kelas / Rombel *</label>
              <select
                className="in"
                value={formKelasId}
                onChange={(e) => setFormKelasId(e.target.value)}
              >
                {adminState.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.tingkat} — {c.nama}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-12 flex justify-end gap-2 mt-1">
              <button
                type="button"
                className="btn sm"
                onClick={() => {
                  setShowStudentForm(false);
                  setEditingId(null);
                }}
              >
                Batal
              </button>
              <button type="submit" className="btn sm primary">
                <Check className="w-4 h-4" />
                {editingId ? 'Simpan Perubahan' : 'Simpan Siswa'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Preview Impor Excel */}
      {!isLockedForTeachers && importPreview && (
        <div className="panel noprint border-l-4 border-l-[#c7a45b]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="!border-0 !pb-0 !mb-0.5">
                Pratinjau Impor Excel: {importPreview.fileName}
              </h2>
              <p className="hint !mb-0">
                Ditemukan <b>{importPreview.rows.length}</b> siswa siap disimpan ke{' '}
                <b>Master Sekolah (Semua Mapel)</b>
                {importPreview.skipped > 0
                  ? ` (${importPreview.skipped} baris contoh/kosong dilewati)`
                  : ''}
                .
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="mini-select"
                title="Ubah kelas tujuan untuk seluruh baris impor"
                value=""
                onChange={(e) => {
                  const targetKelasId = e.target.value;
                  if (!targetKelasId) return;
                  setImportPreview((prev) =>
                    prev
                      ? {
                          ...prev,
                          rows: prev.rows.map((r) => ({ ...r, kelasId: targetKelasId })),
                        }
                      : null
                  );
                }}
              >
                <option value="">Setel Kelas Semua Baris...</option>
                {adminState.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.tingkat} — {c.nama}
                  </option>
                ))}
              </select>
              <button type="button" className="btn sm" onClick={() => setImportPreview(null)}>
                <X className="w-4 h-4" /> Batal
              </button>
              <button type="button" className="btn sm primary" onClick={handleConfirmImport}>
                <Check className="w-4 h-4" /> Konfirmasi Impor ({importPreview.rows.length} Siswa)
              </button>
            </div>
          </div>
          <div className="tw max-h-64">
            <table className="work">
              <thead>
                <tr>
                  <th className="c w-12">No</th>
                  <th>NIS/NISN</th>
                  <th>Nama Lengkap</th>
                  <th className="c">L/P</th>
                  <th>Kelas Tujuan</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.rows.slice(0, 50).map((r, i) => (
                  <tr key={r.id}>
                    <td className="c">{i + 1}</td>
                    <td>{r.nisn || '-'}</td>
                    <td className="font-semibold">{r.nama}</td>
                    <td className="c">{r.jk}</td>
                    <td>{classMap.get(r.kelasId)?.nama || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabel Data Siswa */}
      <div className="panel noprint">
        {filteredStudents.length === 0 ? (
          <div className="empty">
            <b>Belum ada data siswa pada filter ini</b>
            <span>
              {adminState.students.length > 0
                ? 'Coba ubah filter Tingkat/Rombel ke "Semua" atau cek kolom pencarian.'
                : 'Klik "Sinkronkan Semua Mapel" jika data pernah diunggah pada mapel lain, atau gunakan tombol Tambah Siswa / Impor Excel (.xlsx).'}
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
                  <th className="c w-24">Jenis Kelamin</th>
                  <th>Kelas / Rombel</th>
                  {!isLockedForTeachers && <th className="c w-36">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((st, idx) => {
                  const cls = classMap.get(st.kelasId);
                  return (
                    <tr key={st.id}>
                      <td className="c">{idx + 1}</td>
                      <td className="font-mono text-xs">{st.nisn || '-'}</td>
                      <td className="font-semibold text-[#0b3c32]">{st.nama}</td>
                      <td className="c">
                        <span className={`badge ${st.jk === 'P' ? 'hots' : ''}`}>
                          {st.jk === 'L' ? 'Laki-laki' : 'Perempuan'}
                        </span>
                      </td>
                      <td>
                        <span className="font-semibold">{cls?.nama || '-'}</span>{' '}
                        <span className="text-xs text-[#64736c]">
                          {cls ? `(Kelas ${cls.tingkat} · ${cls.jurusan})` : ''}
                        </span>
                      </td>
                      {!isLockedForTeachers && (
                        <td className="c">
                          {confirmDeleteId === st.id ? (
                            <div className="flex justify-center gap-1">
                              <button
                                type="button"
                                className="btn sm danger"
                                onClick={() => handleDeleteStudent(st.id)}
                              >
                                Ya, Hapus
                              </button>
                              <button
                                type="button"
                                className="btn sm"
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-center gap-1">
                              <button
                                type="button"
                                className="btn sm"
                                title="Edit Siswa"
                                onClick={() => handleOpenEditStudent(st)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                className="btn sm danger"
                                title="Hapus Siswa"
                                onClick={() => setConfirmDeleteId(st.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
