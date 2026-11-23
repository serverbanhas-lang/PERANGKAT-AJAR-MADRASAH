import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Download,
  FileSpreadsheet,
  Globe,
  Lock,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Unlock,
  Upload,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import {
  createUid,
  downloadStudentTemplateXlsx,
  exportStudentsCsv,
  exportStudentsXlsx,
  getAppApi,
  getLegacyState,
  parseStudentImportXlsx,
  setGlobalStudents,
  writeGlobalMasterStore,
} from './bridge';
import { useGlobalStudents } from './useGlobalStudents';
import type { JenisKelamin, StudentItem, TingkatKelas } from '../types/adminGuru';

type SortField = 'nama' | 'nisn' | 'jk' | 'kelas' | 'status';
type SortDirection = 'asc' | 'desc';

export const DaftarSiswaView: React.FC = () => {
  const {
    allStudents: globalStudents,
    classes: globalClasses,
    isLockedForTeachers,
    syncAll,
  } = useGlobalStudents();

  const [syncing, setSyncing] = useState(false);

  // Filter & Search state
  const [search, setSearch] = useState('');
  const [filterTingkat, setFilterTingkat] = useState<'all' | TingkatKelas>('all');
  const [filterKelasId, setFilterKelasId] = useState<string>('all');
  const [filterJk, setFilterJk] = useState<'all' | JenisKelamin>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'aktif' | 'nonaktif'>('all');

  // Sort state
  const [sortField, setSortField] = useState<SortField>('kelas');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  // Multi-select & bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTargetKelasId, setBulkTargetKelasId] = useState<string>('');
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Single add/edit form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formNisn, setFormNisn] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formJk, setFormJk] = useState<JenisKelamin>('L');
  const [formKelasId, setFormKelasId] = useState<string>(globalClasses[0]?.id || 'kls_10_a');
  const [formStatus, setFormStatus] = useState<'aktif' | 'nonaktif'>('aktif');

  // Inline single delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Excel import preview
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importPreview, setImportPreview] = useState<{
    rows: StudentItem[];
    skipped: number;
    fileName: string;
  } | null>(null);

  const api = getAppApi();
  const legacy = getLegacyState();
  const ident = legacy?.identitas || {};
  const signHtml = api ? api.signHTML() : '';
  const activeMapelName = legacy?.ws?.mapel || ident.mapel || '';
  const activeKelasName = legacy?.ws?.kelas || ident.kelas || '';

  const classMap = useMemo(
    () => new Map(globalClasses.map((c) => [c.id, c])),
    [globalClasses]
  );

  const classesByTingkat = useMemo(() => {
    if (filterTingkat === 'all') return globalClasses;
    return globalClasses.filter((c) => c.tingkat === filterTingkat);
  }, [globalClasses, filterTingkat]);

  const filteredAndSortedStudents = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = globalStudents.filter((st) => {
      const cls = classMap.get(st.kelasId);
      if (filterTingkat !== 'all' && cls?.tingkat !== filterTingkat) return false;
      if (filterKelasId !== 'all' && st.kelasId !== filterKelasId) return false;
      if (filterJk !== 'all' && st.jk !== filterJk) return false;
      if (filterStatus !== 'all' && st.status !== filterStatus) return false;

      if (q) {
        const hit =
          st.nama.toLowerCase().includes(q) ||
          st.nisn.toLowerCase().includes(q) ||
          (cls?.nama || '').toLowerCase().includes(q) ||
          (cls?.jurusan || '').toLowerCase().includes(q) ||
          st.status.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });

    const mult = sortDir === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      const clsA = classMap.get(a.kelasId);
      const clsB = classMap.get(b.kelasId);

      if (sortField === 'nisn') {
        const cmp = a.nisn.localeCompare(b.nisn, 'id', { numeric: true });
        if (cmp !== 0) return cmp * mult;
      } else if (sortField === 'jk') {
        const cmp = a.jk.localeCompare(b.jk);
        if (cmp !== 0) return cmp * mult;
      } else if (sortField === 'status') {
        const cmp = a.status.localeCompare(b.status);
        if (cmp !== 0) return cmp * mult;
      } else if (sortField === 'kelas') {
        const tA = Number(clsA?.tingkat || 99);
        const tB = Number(clsB?.tingkat || 99);
        if (tA !== tB) return (tA - tB) * mult;
        const kCmp = (clsA?.nama || '').localeCompare(clsB?.nama || '', 'id', { numeric: true });
        if (kCmp !== 0) return kCmp * mult;
        return a.nama.localeCompare(b.nama, 'id');
      }

      return a.nama.localeCompare(b.nama, 'id') * mult;
    });
  }, [
    globalStudents,
    classMap,
    filterTingkat,
    filterKelasId,
    filterJk,
    filterStatus,
    search,
    sortField,
    sortDir,
  ]);

  const masterStats = useMemo(() => {
    const totalAll = globalStudents.length;
    const totalShown = filteredAndSortedStudents.length;
    const aktif = globalStudents.filter((s) => s.status !== 'nonaktif').length;
    const nonaktif = totalAll - aktif;
    const putra = filteredAndSortedStudents.filter((s) => s.jk === 'L').length;
    const putri = filteredAndSortedStudents.filter((s) => s.jk === 'P').length;
    return { totalAll, totalShown, aktif, nonaktif, putra, putri };
  }, [globalStudents, filteredAndSortedStudents]);

  const hasActiveFilters =
    search.trim() !== '' ||
    filterTingkat !== 'all' ||
    filterKelasId !== 'all' ||
    filterJk !== 'all' ||
    filterStatus !== 'all';

  const handleResetFilters = () => {
    setSearch('');
    setFilterTingkat('all');
    setFilterKelasId('all');
    setFilterJk('all');
    setFilterStatus('all');
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 opacity-45 shrink-0" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-[#0c6a5a] shrink-0" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-[#0c6a5a] shrink-0" />
    );
  };

  const handleManualSyncAll = async () => {
    setSyncing(true);
    try {
      const merged = await syncAll({ rescanWorkspaces: true });
      api?.toast(
        `Sinkronisasi selesai: ${merged.students.length} siswa & ${merged.classes.length} rombel aktif di S.adminGuru.students.`
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleLockForTeachers = () => {
    const nextLocked = !isLockedForTeachers;
    writeGlobalMasterStore({ adminLockedForTeachers: nextLocked }, true);
    if (nextLocked) {
      setShowForm(false);
      setImportPreview(null);
      setSelectedIds(new Set());
      setConfirmBulkDelete(false);
      api?.toast('Mode Guru (Hanya Lihat) aktif. Master daftar siswa dikunci untuk Admin.');
    } else {
      api?.toast('Mode Admin aktif. Admin dapat mengelola seluruh master daftar siswa.');
    }
  };

  // Selection handlers
  const visibleIds = useMemo(
    () => filteredAndSortedStudents.map((s) => s.id),
    [filteredAndSortedStudents]
  );

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedCount = selectedIds.size;

  // Bulk operations
  const handleBulkMoveClass = () => {
    if (isLockedForTeachers || selectedCount === 0 || !bulkTargetKelasId) return;
    const targetCls = classMap.get(bulkTargetKelasId);
    setGlobalStudents((prev) =>
      prev.map((s) => (selectedIds.has(s.id) ? { ...s, kelasId: bulkTargetKelasId } : s))
    );
    api?.toast(
      `${selectedCount} siswa dipindahkan ke kelas ${targetCls?.nama || bulkTargetKelasId} untuk seluruh mapel.`
    );
    setSelectedIds(new Set());
    setBulkTargetKelasId('');
  };

  const handleBulkSetStatus = (nextStatus: 'aktif' | 'nonaktif') => {
    if (isLockedForTeachers || selectedCount === 0) return;
    setGlobalStudents((prev) =>
      prev.map((s) => (selectedIds.has(s.id) ? { ...s, status: nextStatus } : s))
    );
    api?.toast(
      `${selectedCount} siswa ditandai ${nextStatus === 'aktif' ? 'Aktif' : 'Nonaktif'}.`
    );
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    if (isLockedForTeachers || selectedCount === 0) return;
    const count = selectedCount;
    setGlobalStudents((prev) => prev.filter((s) => !selectedIds.has(s.id)));
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
    api?.toast(`${count} siswa dihapus dari Master Sekolah.`);
  };

  // Single student form
  const openAddForm = () => {
    if (isLockedForTeachers) return;
    setEditingId(null);
    setFormNisn('');
    setFormNama('');
    setFormJk('L');
    setFormStatus('aktif');
    const defaultKls =
      filterKelasId !== 'all'
        ? filterKelasId
        : classesByTingkat[0]?.id || globalClasses[0]?.id || '';
    setFormKelasId(defaultKls);
    setShowForm(true);
  };

  const openEditForm = (st: StudentItem) => {
    if (isLockedForTeachers) return;
    setEditingId(st.id);
    setFormNisn(st.nisn);
    setFormNama(st.nama);
    setFormJk(st.jk);
    setFormKelasId(st.kelasId);
    setFormStatus(st.status);
    setShowForm(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
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

    setGlobalStudents((prev) => {
      if (editingId) {
        return prev.map((s) =>
          s.id === editingId
            ? {
                ...s,
                nisn: formNisn.trim(),
                nama,
                jk: formJk,
                kelasId: formKelasId,
                status: formStatus,
              }
            : s
        );
      }
      const created: StudentItem = {
        id: createUid('std'),
        nisn: formNisn.trim(),
        nama,
        jk: formJk,
        kelasId: formKelasId,
        status: formStatus,
      };
      return [...prev, created];
    });

    setShowForm(false);
    setEditingId(null);
    api?.toast(
      editingId
        ? 'Perubahan data siswa tersimpan secara global untuk seluruh mapel.'
        : 'Siswa baru berhasil ditambahkan ke daftar master global.'
    );
  };

  const handleToggleStudentStatus = (st: StudentItem) => {
    if (isLockedForTeachers) return;
    const nextStatus: 'aktif' | 'nonaktif' = st.status === 'aktif' ? 'nonaktif' : 'aktif';
    setGlobalStudents((prev) =>
      prev.map((s) => (s.id === st.id ? { ...s, status: nextStatus } : s))
    );
    api?.toast(
      `${st.nama} sekarang berstatus ${nextStatus === 'aktif' ? 'Aktif' : 'Nonaktif'}.`
    );
  };

  const handleDeleteSingle = (id: string) => {
    if (isLockedForTeachers) return;
    setGlobalStudents((prev) => prev.filter((s) => s.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setConfirmDeleteId(null);
    api?.toast('Siswa berhasil dihapus dari master daftar siswa.');
  };

  // Excel import/export
  const handleDownloadTemplate = () => {
    const selectedNama =
      filterKelasId !== 'all'
        ? classMap.get(filterKelasId)?.nama
        : classesByTingkat[0]?.nama;
    downloadStudentTemplateXlsx(globalClasses, selectedNama);
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
        : classesByTingkat[0]?.id || globalClasses[0]?.id || '';

    try {
      const { imported, skippedRows } = await parseStudentImportXlsx(
        file,
        globalClasses,
        fallbackId
      );
      if (imported.length === 0) {
        api?.toast('Tidak ada baris siswa valid pada file Excel.');
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

    setGlobalStudents((prev) => {
      const existingSig = new Set(
        prev.map((s) =>
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
      return [...prev, ...uniqueNew];
    });

    api?.toast(
      duplicateCount > 0
        ? `Berhasil mengimpor ${addedCount} siswa baru (${duplicateCount} duplikat dilewati) ke Master Sekolah.`
        : `Berhasil mengimpor ${addedCount} siswa ke Master Sekolah!`
    );
    setImportPreview(null);
  };

  const handleExportStudents = () => {
    if (filteredAndSortedStudents.length === 0) {
      api?.toast('Belum ada data siswa yang tampil untuk diekspor.');
      return;
    }
    const label =
      filterKelasId !== 'all'
        ? classMap.get(filterKelasId)?.nama || 'Kelas'
        : filterTingkat !== 'all'
          ? `Kelas_${filterTingkat}`
          : 'Master_Semua_Siswa';
    exportStudentsXlsx(filteredAndSortedStudents, globalClasses, label);
    api?.toast('Daftar siswa berhasil diekspor ke Excel (.xlsx).');
  };

  const handleExportStudentsCsv = () => {
    if (filteredAndSortedStudents.length === 0) {
      api?.toast('Belum ada data siswa yang tampil untuk diekspor.');
      return;
    }
    const baseLabel =
      filterKelasId !== 'all'
        ? classMap.get(filterKelasId)?.nama || 'Kelas'
        : filterTingkat !== 'all'
          ? `Kelas_${filterTingkat}`
          : 'Master_Semua_Siswa';
    const label = filterStatus !== 'all' ? `${baseLabel}_${filterStatus}` : baseLabel;
    exportStudentsCsv(filteredAndSortedStudents, globalClasses, label);
    api?.toast('Daftar siswa berhasil diekspor sebagai file CSV.');
  };

  return (
    <div className="max-w-[1100px] mx-auto space-y-4">
      {/* Banner Master Daftar Siswa Global */}
      <div className="rounded-xl border border-[#8ac5b2] bg-[#e7f5ef] px-4 py-3 text-xs text-[#0b3c32] flex flex-wrap items-center justify-between gap-3 noprint">
        <div className="flex items-start gap-2.5 min-w-0">
          <Globe className="w-5 h-5 text-[#0f6b58] shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-sm text-[#073329]">
              Daftar Siswa Global (Master Induk Seluruh Mata Pelajaran)
            </div>
            <div className="text-[#1f5547] mt-0.5 leading-relaxed">
              Menampilkan seluruh peserta didik dari state global <code>S.adminGuru.students</code>.
              Perubahan nama, kelas, status, atau impor data di sini langsung berlaku di semua mata pelajaran dan guru.
              {activeMapelName && (
                <span className="ml-1 font-semibold text-[#0b3c32]">
                  (Mapel aktif: {activeMapelName}
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
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Menyinkronkan...' : 'Sinkronkan Semua Mapel'}
          </button>
          <button
            type="button"
            className={`btn sm ${isLockedForTeachers ? 'primary' : ''}`}
            onClick={handleToggleLockForTeachers}
          >
            {isLockedForTeachers ? (
              <>
                <Unlock className="w-3.5 h-3.5" /> Aktifkan Mode Admin
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" /> Kunci untuk Guru
              </>
            )}
          </button>
        </div>
      </div>

      {isLockedForTeachers && (
        <div className="rounded-xl border border-[#e3c87f] bg-[#fbf3de] px-4 py-2.5 text-xs text-[#614407] flex items-center gap-2 noprint">
          <ShieldCheck className="w-4 h-4 shrink-0 text-[#8b6416]" />
          <span>
            <b>Mode Guru (Hanya Lihat):</b> Pengelolaan master daftar siswa sedang dikunci khusus untuk Admin. Anda tetap dapat mencari, menyortir, mencetak, dan mengekspor daftar siswa.
          </span>
        </div>
      )}

      {/* Panel Kontrol Filter, Pencarian & Aksi Cepat */}
      <div className="panel noprint">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e9e4d4] pb-3 mb-4">
          <div>
            <h2 className="!border-0 !pb-0 !mb-1">Direktori &amp; Pengelolaan Daftar Siswa</h2>
            <p className="hint !mb-0">
              Total master global: <b>{masterStats.totalAll} siswa</b> ({masterStats.aktif} aktif,{' '}
              {masterStats.nonaktif} nonaktif) pada <b>{globalClasses.length} rombel</b>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="btn sm" href="#/kelas-siswa">
              Kelola Rombel
            </a>
            <button type="button" className="btn sm" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5" /> Cetak PDF
            </button>
            {!isLockedForTeachers && (
              <button type="button" className="btn primary" onClick={openAddForm}>
                <Plus className="w-4 h-4" /> Tambah Siswa
              </button>
            )}
          </div>
        </div>

        {/* Pencarian & Filter Multi-Dimensi */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label className="f">Cari Nama / NISN / Rombel</label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#64736c] absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                className="in !pl-8"
                type="text"
                placeholder="Cari nama, NISN, atau kelas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="f">Tingkat</label>
            <select
              className="in"
              value={filterTingkat}
              onChange={(e) => {
                setFilterTingkat(e.target.value as 'all' | TingkatKelas);
                setFilterKelasId('all');
              }}
            >
              <option value="all">Semua Tingkat</option>
              <option value="10">Kelas 10</option>
              <option value="11">Kelas 11</option>
              <option value="12">Kelas 12</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="f">Rombel / Kelas</label>
            <select
              className="in"
              value={filterKelasId}
              onChange={(e) => setFilterKelasId(e.target.value)}
            >
              <option value="all">Semua Rombel ({classesByTingkat.length})</option>
              {classesByTingkat.map((c) => {
                const count = globalStudents.filter((s) => s.kelasId === c.id).length;
                return (
                  <option key={c.id} value={c.id}>
                    {c.nama} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="f">Jenis Kelamin</label>
            <select
              className="in"
              value={filterJk}
              onChange={(e) => setFilterJk(e.target.value as 'all' | JenisKelamin)}
            >
              <option value="all">Semua (L &amp; P)</option>
              <option value="L">Putra (L)</option>
              <option value="P">Putri (P)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="f">Status</label>
            <select
              className="in"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'aktif' | 'nonaktif')}
            >
              <option value="all">Semua Status</option>
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </select>
          </div>
        </div>

        {/* Bar Statistik & Impor/Ekspor */}
        <div className="mt-4 pt-3 border-t border-[#eaf0e9] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2 items-center text-xs">
            <label
              className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md border font-semibold cursor-pointer select-none transition-colors ${
                filterStatus === 'aktif'
                  ? 'bg-[#dcefea] border-[#0c6a5a] text-[#093f36]'
                  : 'bg-white border-[#d3dcdf] text-[#14222b] hover:bg-[#f3f7f7]'
              }`}
            >
              <input
                type="checkbox"
                className="w-3.5 h-3.5 accent-[#0c6a5a] rounded cursor-pointer"
                checked={filterStatus === 'aktif'}
                onChange={(e) => setFilterStatus(e.target.checked ? 'aktif' : 'all')}
                aria-label="Hanya tampilkan siswa berstatus Aktif"
              />
              <span>Hanya siswa Aktif ({masterStats.aktif})</span>
            </label>
            <span className="badge">
              Ditampilkan: {masterStats.totalShown} dari {masterStats.totalAll} siswa
            </span>
            <span className="badge">Putra (L): {masterStats.putra}</span>
            <span className="badge">Putri (P): {masterStats.putri}</span>
            {hasActiveFilters && (
              <button type="button" className="btn sm ghost" onClick={handleResetFilters}>
                <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {!isLockedForTeachers && (
              <>
                <button type="button" className="btn sm" onClick={handleDownloadTemplate}>
                  <FileSpreadsheet className="w-4 h-4 text-[#126451]" />
                  Template Excel
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
            <button
              type="button"
              className="btn sm"
              onClick={handleExportStudentsCsv}
              title="Unduh daftar siswa yang sedang ditampilkan sebagai file CSV (.csv) untuk Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#126451]" />
              Export to Excel
            </button>
            <button type="button" className="btn sm" onClick={handleExportStudents}>
              <Download className="w-4 h-4 text-[#126451]" />
              Ekspor Excel (.xlsx)
            </button>
          </div>
        </div>
      </div>

      {/* Form Tambah / Edit Siswa */}
      {!isLockedForTeachers && showForm && (
        <div className="panel noprint border-l-4 border-l-[#126451]">
          <h2>{editingId ? 'Edit Data Siswa Master' : 'Tambah Siswa Baru ke Daftar Master'}</h2>
          <form onSubmit={handleSaveForm} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="f">NIS / NISN</label>
              <input
                className="in"
                placeholder="0081234567"
                value={formNisn}
                onChange={(e) => setFormNisn(e.target.value)}
              />
            </div>
            <div className="sm:col-span-4">
              <label className="f">Nama Lengkap *</label>
              <input
                className="in"
                placeholder="Nama lengkap siswa"
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
            <div className="sm:col-span-2">
              <label className="f">Kelas / Rombel *</label>
              <select
                className="in"
                value={formKelasId}
                onChange={(e) => setFormKelasId(e.target.value)}
              >
                {globalClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.tingkat} — {c.nama}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="f">Status</label>
              <select
                className="in"
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as 'aktif' | 'nonaktif')}
              >
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </select>
            </div>
            <div className="sm:col-span-12 flex justify-end gap-2 mt-1">
              <button
                type="button"
                className="btn sm"
                onClick={() => {
                  setShowForm(false);
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
                Ditemukan <b>{importPreview.rows.length}</b> siswa siap digabungkan ke{' '}
                <b>Daftar Siswa Global</b>
                {importPreview.skipped > 0
                  ? ` (${importPreview.skipped} baris contoh/kosong dilewati)`
                  : ''}
                .
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="mini-select"
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
                {globalClasses.map((c) => (
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
          <div className="tw max-h-60">
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

      {/* Bar Aksi Massal ketika ada baris terpilih */}
      {!isLockedForTeachers && selectedCount > 0 && (
        <div className="panel noprint !bg-[#fbf3de] !border-[#e3c87f] flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-bold text-[#614407]">
            {selectedCount} siswa dipilih untuk tindakan massal:
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="mini-select"
              value={bulkTargetKelasId}
              onChange={(e) => setBulkTargetKelasId(e.target.value)}
            >
              <option value="">Pindah ke Rombel...</option>
              {globalClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  Kelas {c.tingkat} — {c.nama}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn sm primary"
              disabled={!bulkTargetKelasId}
              onClick={handleBulkMoveClass}
            >
              Pindahkan Rombel
            </button>
            <button
              type="button"
              className="btn sm"
              onClick={() => handleBulkSetStatus('aktif')}
            >
              <UserCheck className="w-3.5 h-3.5 text-[#1c7a45]" /> Set Aktif
            </button>
            <button
              type="button"
              className="btn sm"
              onClick={() => handleBulkSetStatus('nonaktif')}
            >
              <UserX className="w-3.5 h-3.5 text-[#9a6700]" /> Set Nonaktif
            </button>
            {confirmBulkDelete ? (
              <div className="flex items-center gap-1">
                <button type="button" className="btn sm danger" onClick={handleBulkDelete}>
                  Ya, Hapus {selectedCount}
                </button>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setConfirmBulkDelete(false)}
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn sm danger"
                onClick={() => setConfirmBulkDelete(true)}
              >
                <Trash2 className="w-3.5 h-3.5" /> Hapus Terpilih
              </button>
            )}
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => {
                setSelectedIds(new Set());
                setConfirmBulkDelete(false);
              }}
            >
              Batal Pilih
            </button>
          </div>
        </div>
      )}

      {/* Tabel Utama Sortable & Searchable */}
      <div className="panel noprint">
        {filteredAndSortedStudents.length === 0 ? (
          <div className="empty">
            <b>Tidak ada data siswa yang cocok</b>
            <span>
              {globalStudents.length > 0
                ? 'Coba ubah kata kunci pencarian atau tekan "Reset Filter" di atas.'
                : 'Belum ada siswa di S.adminGuru.students. Klik "Tambah Siswa", "Impor Excel (.xlsx)", atau "Sinkronkan Semua Mapel".'}
            </span>
          </div>
        ) : (
          <div className="tw">
            <table className="work">
              <thead>
                <tr>
                  {!isLockedForTeachers && (
                    <th className="c w-10">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        title="Pilih semua baris yang tampil"
                      />
                    </th>
                  )}
                  <th className="c w-12">No</th>
                  <th>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-bold hover:text-[#0c6a5a] cursor-pointer"
                      onClick={() => handleSort('nisn')}
                    >
                      NIS / NISN {renderSortIcon('nisn')}
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-bold hover:text-[#0c6a5a] cursor-pointer"
                      onClick={() => handleSort('nama')}
                    >
                      Nama Lengkap {renderSortIcon('nama')}
                    </button>
                  </th>
                  <th className="c w-24">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-bold hover:text-[#0c6a5a] cursor-pointer"
                      onClick={() => handleSort('jk')}
                    >
                      L/P {renderSortIcon('jk')}
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-bold hover:text-[#0c6a5a] cursor-pointer"
                      onClick={() => handleSort('kelas')}
                    >
                      Kelas / Rombel {renderSortIcon('kelas')}
                    </button>
                  </th>
                  <th className="c w-28">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-bold hover:text-[#0c6a5a] cursor-pointer"
                      onClick={() => handleSort('status')}
                    >
                      Status {renderSortIcon('status')}
                    </button>
                  </th>
                  {!isLockedForTeachers && <th className="c w-32">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedStudents.map((st, idx) => {
                  const cls = classMap.get(st.kelasId);
                  const checked = selectedIds.has(st.id);
                  return (
                    <tr key={st.id} className={checked ? 'bg-[#f4fbf8]' : ''}>
                      {!isLockedForTeachers && (
                        <td className="c">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelectOne(st.id)}
                          />
                        </td>
                      )}
                      <td className="c">{idx + 1}</td>
                      <td className="font-mono text-xs">{st.nisn || '-'}</td>
                      <td className="font-semibold text-[#0b3c32]">{st.nama}</td>
                      <td className="c">
                        <span className={`badge ${st.jk === 'P' ? 'hots' : ''}`}>
                          {st.jk === 'L' ? 'L' : 'P'}
                        </span>
                      </td>
                      <td>
                        <span className="font-semibold">{cls?.nama || '-'}</span>{' '}
                        <span className="text-xs text-[#64736c]">
                          {cls ? `(Kls ${cls.tingkat} · ${cls.jurusan})` : ''}
                        </span>
                      </td>
                      <td className="c">
                        {isLockedForTeachers ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              st.status === 'aktif'
                                ? 'bg-[#e1f3e8] text-[#1c7a45]'
                                : 'bg-[#f4e5c2] text-[#7a5200]'
                            }`}
                          >
                            {st.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleStudentStatus(st)}
                            title="Klik untuk mengubah status Aktif / Nonaktif"
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold cursor-pointer border transition ${
                              st.status === 'aktif'
                                ? 'bg-[#e1f3e8] text-[#1c7a45] border-[#a7dfc0] hover:bg-[#cdebd9]'
                                : 'bg-[#f4e5c2] text-[#7a5200] border-[#e2c683] hover:bg-[#edd9aa]'
                            }`}
                          >
                            {st.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                          </button>
                        )}
                      </td>
                      {!isLockedForTeachers && (
                        <td className="c">
                          {confirmDeleteId === st.id ? (
                            <div className="flex justify-center gap-1">
                              <button
                                type="button"
                                className="btn sm danger"
                                onClick={() => handleDeleteSingle(st.id)}
                              >
                                Ya
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
                                onClick={() => openEditForm(st)}
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

      {/* Lembar Cetak Formal (tersembunyi di layar? Tidak, tampil di bawah seperti Absensi/Nilai agar pratinjau cetak akurat) */}
      {filteredAndSortedStudents.length > 0 && (
        <div className="paper">
          <div className="dt">DAFTAR INDUK PESERTA DIDIK (MASTER SEKOLAH)</div>
          <div className="dt2">{ident.namaSekolah || 'MADRASAH ALIYAH BANU HASYIM'}</div>
          <table className="info">
            <tbody>
              <tr>
                <td>Cakupan Data</td>
                <td>
                  :{' '}
                  {filterKelasId !== 'all'
                    ? `Kelas ${classMap.get(filterKelasId)?.nama || '-'}`
                    : filterTingkat !== 'all'
                      ? `Tingkat Kelas ${filterTingkat}`
                      : 'Semua Kelas & Rombel'}
                </td>
                <td style={{ paddingLeft: 24 }}>Tahun Pelajaran</td>
                <td>: {ident.tahun || '-'}</td>
              </tr>
              <tr>
                <td>Jumlah Peserta Didik</td>
                <td>
                  : {masterStats.totalShown} siswa (L: {masterStats.putra} · P: {masterStats.putri})
                </td>
                <td style={{ paddingLeft: 24 }}>Status Filter</td>
                <td>
                  : {filterStatus === 'all' ? 'Semua Status' : filterStatus === 'aktif' ? 'Aktif' : 'Nonaktif'}
                </td>
              </tr>
            </tbody>
          </table>
          <table className="doc">
            <thead>
              <tr>
                <th className="c" style={{ width: '6%' }}>No</th>
                <th style={{ width: '18%' }}>NIS / NISN</th>
                <th style={{ width: '38%' }}>Nama Lengkap</th>
                <th className="c" style={{ width: '8%' }}>L/P</th>
                <th style={{ width: '18%' }}>Kelas / Rombel</th>
                <th className="c" style={{ width: '12%' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedStudents.map((st, idx) => {
                const cls = classMap.get(st.kelasId);
                return (
                  <tr key={st.id}>
                    <td className="c">{idx + 1}</td>
                    <td>{st.nisn || '-'}</td>
                    <td>{st.nama}</td>
                    <td className="c">{st.jk}</td>
                    <td>{cls ? `${cls.nama} (Kls ${cls.tingkat})` : '-'}</td>
                    <td className="c">{st.status === 'aktif' ? 'Aktif' : 'Nonaktif'}</td>
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
