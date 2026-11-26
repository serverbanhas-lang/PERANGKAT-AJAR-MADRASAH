import * as XLSX from 'xlsx';
import type {
  AdminGuruState,
  AppApiBridge,
  AttendanceStatus,
  DynamicTP,
  GlobalStudentQueryOptions,
  GradeBookData,
  GradeWeights,
  JournalItem,
  KelasItem,
  LearningMediaItem,
  LegacyAppState,
  LegacyUnit,
  MediaPembelajaranJenis,
  MediaSlideItem,
  MediaSlideLayout,
  MediaSlideTipe,
  MediaThemeKey,
  QuizQuestion,
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
    mediaPembelajaran: [],
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
  const mediaPembelajaran = Array.isArray(src.mediaPembelajaran)
    ? src.mediaPembelajaran.map((m) => ({
        ...m,
        slides: Array.isArray(m?.slides) ? m.slides.map((sl) => ({ ...sl })) : [],
        glosarium: Array.isArray(m?.glosarium) ? m.glosarium.map((g) => ({ ...g })) : [],
      }))
    : [];

  return {
    classes,
    students,
    attendance,
    journals,
    grades,
    quizzes,
    mediaPembelajaran,
  };
}

export const MASTER_STUDENTS_STORAGE_KEY = 'ma-banu-hasyim-master-students-v1';

export interface MasterStudentsStorePayload {
  classes: KelasItem[];
  students: StudentItem[];
  deletedStudentIds: string[];
  adminLockedForTeachers: boolean;
  updatedAt: string | null;
  rescuedFromWorkspaces?: boolean;
}

export function normalizeClassMatchKey(raw: string): string {
  const s = String(raw || '')
    .toLowerCase()
    .split('/')[0]
    .replace(/\bkelas\b|\brombel\b/g, '')
    .replace(/\b10\b/g, 'x')
    .replace(/\b11\b/g, 'xi')
    .replace(/\b12\b/g, 'xii')
    .replace(/[^a-z0-9]/g, '');
  return s;
}

export function findMatchingClassId(
  classes: KelasItem[],
  rawName: string,
  fallbackId?: string
): string | undefined {
  const clean = String(rawName || '').trim().toLowerCase();
  if (!clean || classes.length === 0) return fallbackId;

  const exact = classes.find((c) => c.nama.trim().toLowerCase() === clean);
  if (exact) return exact.id;

  const targetKey = normalizeClassMatchKey(rawName);
  if (!targetKey) return fallbackId;

  const keyExact = classes.find((c) => normalizeClassMatchKey(c.nama) === targetKey);
  if (keyExact) return keyExact.id;

  // Cocokkan mis. "11 IPS" / "XI IPS" ke "XI-IPS-1" atau sebaliknya
  const prefixMatch = classes.find((c) => {
    const ck = normalizeClassMatchKey(c.nama);
    const ckNoNum = ck.replace(/\d+$/, '');
    const tkNoNum = targetKey.replace(/\d+$/, '');
    return ckNoNum && tkNoNum && ckNoNum === tkNoNum;
  });
  if (prefixMatch) return prefixMatch.id;

  return fallbackId;
}

export function getPreferredKelasId(classes: KelasItem[], fallback = 'kls_10_a'): string {
  if (!classes.length) return fallback;
  const legacy = getLegacyState();
  const wsKelas = legacy?.ws?.kelas || legacy?.identitas?.kelas || '';
  if (wsKelas) {
    const matched = findMatchingClassId(classes, wsKelas);
    if (matched) return matched;
  }
  return classes[0]?.id || fallback;
}

function sanitizeClassesList(raw: unknown): KelasItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => Boolean(c && typeof c === 'object'))
    .map((c, idx) => ({
      id: String(c.id || `kls_${idx}_${Date.now()}`),
      tingkat: (['10', '11', '12'].includes(String(c.tingkat))
        ? String(c.tingkat)
        : '10') as TingkatKelas,
      nama: String(c.nama || `Kelas ${idx + 1}`).trim(),
      jurusan: String(c.jurusan || 'Umum').trim(),
      waliKelas: c.waliKelas ? String(c.waliKelas).trim() : '',
    }))
    .filter((c) => c.nama.length > 0);
}

function sanitizeStudentsList(raw: unknown, fallbackKelasId: string): StudentItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
    .map((s, idx) => ({
      id: String(s.id || `std_${idx}_${Date.now()}`),
      nisn: String(s.nisn || '').trim(),
      nama: String(s.nama || '').trim(),
      jk: (s.jk === 'P' ? 'P' : 'L') as StudentItem['jk'],
      kelasId: String(s.kelasId || fallbackKelasId),
      status: (s.status === 'nonaktif' ? 'nonaktif' : 'aktif') as StudentItem['status'],
    }))
    .filter((s) => s.nama.length > 0);
}

function mergeMasterPools(
  baseClasses: KelasItem[],
  baseStudents: StudentItem[],
  incomingClasses: KelasItem[],
  incomingStudents: StudentItem[],
  deletedIds: Set<string>
): { classes: KelasItem[]; students: StudentItem[] } {
  const classes: KelasItem[] = baseClasses.length
    ? baseClasses.map((c) => ({ ...c }))
    : DEFAULT_CLASSES.map((c) => ({ ...c }));
  const classIdMap = new Map<string, string>();

  for (const ic of incomingClasses) {
    const byId = classes.find((c) => c.id === ic.id);
    if (byId) {
      if (!byId.waliKelas && ic.waliKelas) byId.waliKelas = ic.waliKelas;
      classIdMap.set(ic.id, byId.id);
      continue;
    }
    const normIn = `${ic.tingkat}::${ic.nama.trim().toLowerCase()}`;
    const byName = classes.find(
      (c) => `${c.tingkat}::${c.nama.trim().toLowerCase()}` === normIn
    );
    if (byName) {
      classIdMap.set(ic.id, byName.id);
      continue;
    }
    classes.push({ ...ic });
    classIdMap.set(ic.id, ic.id);
  }

  const validClassIds = new Set(classes.map((c) => c.id));
  const fallbackClassId = classes[0]?.id || 'kls_10_a';
  const students: StudentItem[] = [];
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();

  const pushStudent = (rawSt: StudentItem) => {
    if (!rawSt.nama || deletedIds.has(rawSt.id)) return;
    const remappedKelasId = classIdMap.get(rawSt.kelasId) || rawSt.kelasId;
    const finalKelasId = validClassIds.has(remappedKelasId) ? remappedKelasId : fallbackClassId;
    const sig = rawSt.nisn
      ? `nisn:${rawSt.nisn.toLowerCase()}::${rawSt.nama.toLowerCase()}`
      : `name:${rawSt.nama.toLowerCase()}::${finalKelasId}`;
    if (seenIds.has(rawSt.id) || seenSignatures.has(sig)) return;
    seenIds.add(rawSt.id);
    seenSignatures.add(sig);
    students.push({
      ...rawSt,
      kelasId: finalKelasId,
    });
  };

  baseStudents.forEach(pushStudent);
  incomingStudents.forEach(pushStudent);

  return { classes, students };
}

function collectLocalStorageWorkspaceAdmins(): Array<{ classes: KelasItem[]; students: StudentItem[] }> {
  const collected: Array<{ classes: KelasItem[]; students: StudentItem[] }> = [];
  if (typeof window === 'undefined' || !window.localStorage) return collected;

  const currentLegacy = getLegacyState();
  if (currentLegacy?.adminGuru) {
    const cls = sanitizeClassesList(currentLegacy.adminGuru.classes);
    const stds = sanitizeStudentsList(
      currentLegacy.adminGuru.students,
      cls[0]?.id || DEFAULT_CLASSES[0].id
    );
    if (cls.length || stds.length) {
      collected.push({ classes: cls, students: stds });
    }
  }

  try {
    const prefixes = [
      'ma-perangkat-ajar-v1',
      'amin-manajemen-sekolah-v1',
      'amin-manajemen-sekolah-kosong-v1',
    ];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      const matchesPrefix = prefixes.some((p) => k === p || k.startsWith(`${p}:ws:`));
      if (!matchesPrefix) continue;
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const ag = parsed?.adminGuru;
        if (ag && typeof ag === 'object') {
          const cls = sanitizeClassesList(ag.classes);
          const stds = sanitizeStudentsList(
            ag.students,
            cls[0]?.id || DEFAULT_CLASSES[0].id
          );
          if (cls.length || stds.length) {
            collected.push({ classes: cls, students: stds });
          }
        }
      } catch {
        // skip invalid entry
      }
    }
  } catch {
    // ignore storage access issues
  }

  return collected;
}

export function readGlobalMasterStore(): MasterStudentsStorePayload {
  const defClasses = DEFAULT_CLASSES.map((c) => ({ ...c }));
  let stored: MasterStudentsStorePayload | null = null;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(MASTER_STUDENTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const cls = sanitizeClassesList(parsed.classes);
          const effectiveCls = cls.length ? cls : defClasses;
          stored = {
            classes: effectiveCls,
            students: sanitizeStudentsList(parsed.students, effectiveCls[0].id),
            deletedStudentIds: Array.isArray(parsed.deletedStudentIds)
              ? parsed.deletedStudentIds.map(String)
              : [],
            adminLockedForTeachers: Boolean(parsed.adminLockedForTeachers),
            updatedAt: parsed.updatedAt ? String(parsed.updatedAt) : null,
            rescuedFromWorkspaces: Boolean(parsed.rescuedFromWorkspaces),
          };
        }
      }
    } catch {
      stored = null;
    }
  }

  let classes = stored ? stored.classes : defClasses;
  let students = stored ? stored.students : [];
  const deletedIds = new Set<string>(stored?.deletedStudentIds || []);

  // Jika belum pernah rescue lintas ruang kerja (mapel lain), atau ada siswa di ruang kerja aktif yang belum masuk master
  if (!stored || !stored.rescuedFromWorkspaces) {
    const allWorkspaces = collectLocalStorageWorkspaceAdmins();
    for (const ws of allWorkspaces) {
      const merged = mergeMasterPools(classes, students, ws.classes, ws.students, deletedIds);
      classes = merged.classes;
      students = merged.students;
    }
    const rescuedPayload: MasterStudentsStorePayload = {
      classes,
      students,
      deletedStudentIds: Array.from(deletedIds),
      adminLockedForTeachers: stored?.adminLockedForTeachers || false,
      updatedAt: stored?.updatedAt || (students.length > 0 ? new Date().toISOString() : null),
      rescuedFromWorkspaces: true,
    };
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(MASTER_STUDENTS_STORAGE_KEY, JSON.stringify(rescuedPayload));
      } catch {
        // ignore quota errors
      }
    }
    return rescuedPayload;
  }

  return stored;
}

let serverSyncTimer: number | null = null;

export function writeGlobalMasterStore(
  payload: Partial<MasterStudentsStorePayload>,
  syncToServer = true,
  skipAppSave = false
): MasterStudentsStorePayload {
  const current = readGlobalMasterStore();
  const nextClasses = payload.classes
    ? sanitizeClassesList(payload.classes)
    : current.classes;
  const effectiveClasses = nextClasses.length
    ? nextClasses
    : DEFAULT_CLASSES.map((c) => ({ ...c }));
  const nextStudents = payload.students
    ? sanitizeStudentsList(payload.students, effectiveClasses[0].id)
    : current.students;
  const nextDeleted = payload.deletedStudentIds
    ? Array.from(new Set(payload.deletedStudentIds.map(String))).slice(-1000)
    : current.deletedStudentIds;

  const full: MasterStudentsStorePayload = {
    classes: effectiveClasses,
    students: nextStudents,
    deletedStudentIds: nextDeleted,
    adminLockedForTeachers:
      payload.adminLockedForTeachers !== undefined
        ? Boolean(payload.adminLockedForTeachers)
        : current.adminLockedForTeachers,
    updatedAt: payload.updatedAt !== undefined ? payload.updatedAt : new Date().toISOString(),
    rescuedFromWorkspaces: true,
  };

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(MASTER_STUDENTS_STORAGE_KEY, JSON.stringify(full));
    } catch {
      // ignore quota error
    }

    // Sinkronkan ke state S saat ini agar cadangan/Google Drive tetap membawa salinan terbaru
    const api = getAppApi();
    const s = api?.getState();
    if (s) {
      s.adminGuru = normalizeAdminGuruState({
        ...(s.adminGuru || {}),
        classes: full.classes,
        students: full.students,
      });
      if (!skipAppSave) {
        api?.save();
      }
    }

    window.dispatchEvent(new CustomEvent('ma:master-students-updated', { detail: full }));

    if (syncToServer) {
      if (serverSyncTimer !== null) {
        window.clearTimeout(serverSyncTimer);
      }
      serverSyncTimer = window.setTimeout(() => {
        fetch('/api/master-students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classes: full.classes,
            students: full.students,
            deletedStudentIds: full.deletedStudentIds,
            adminLockedForTeachers: full.adminLockedForTeachers,
          }),
        }).catch(() => {
          // Abaikan diam-diam jika offline; data tetap tersimpan lokal lintas mapel
        });
      }, 150);
    }
  }

  return full;
}

export async function syncMasterStudentsWithServer(options?: {
  rescanWorkspaces?: boolean;
  preferServer?: boolean;
}): Promise<MasterStudentsStorePayload> {
  let local = readGlobalMasterStore();

  if (options?.rescanWorkspaces) {
    const deletedSet = new Set(local.deletedStudentIds);
    let classes = local.classes;
    let students = local.students;
    for (const ws of collectLocalStorageWorkspaceAdmins()) {
      const merged = mergeMasterPools(classes, students, ws.classes, ws.students, deletedSet);
      classes = merged.classes;
      students = merged.students;
    }
    if (students.length !== local.students.length || classes.length !== local.classes.length) {
      local = writeGlobalMasterStore(
        {
          classes,
          students,
          updatedAt: new Date().toISOString(),
        },
        true
      );
    }
  }

  try {
    const res = await fetch('/api/master-students');
    if (!res.ok) return local;
    const remote = (await res.json()) as Partial<MasterStudentsStorePayload>;
    const remoteClasses = sanitizeClassesList(remote?.classes);
    const remoteStudents = sanitizeStudentsList(
      remote?.students,
      remoteClasses[0]?.id || local.classes[0]?.id || 'kls_10_a'
    );
    const remoteUpdatedMs = remote?.updatedAt ? Date.parse(remote.updatedAt) : 0;
    const localUpdatedMs = local.updatedAt ? Date.parse(local.updatedAt) : 0;

    // Jika server punya data lebih baru (atau lokal kosong), adopsi dari server
    if (
      (remoteStudents.length > 0 || remoteClasses.length > 0) &&
      (options?.preferServer || local.students.length === 0 || remoteUpdatedMs > localUpdatedMs)
    ) {
      const mergedDeleted = Array.from(
        new Set([...(local.deletedStudentIds || []), ...(remote.deletedStudentIds || [])])
      ).slice(-1000);
      const effectiveClasses = remoteClasses.length ? remoteClasses : local.classes;
      return writeGlobalMasterStore(
        {
          classes: effectiveClasses,
          students: remoteStudents,
          deletedStudentIds: mergedDeleted,
          adminLockedForTeachers: Boolean(remote.adminLockedForTeachers),
          updatedAt: remote.updatedAt || new Date().toISOString(),
        },
        false
      );
    }

    // Jika lokal punya data (misal baru di-rescue dari mapel Akidah Akhlak) tapi server masih kosong, dorong ke server
    if (
      (local.students.length > 0 || local.classes.length > DEFAULT_CLASSES.length) &&
      remoteStudents.length === 0 &&
      !remote?.updatedAt
    ) {
      await fetch('/api/master-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classes: local.classes,
          students: local.students,
          deletedStudentIds: local.deletedStudentIds,
          adminLockedForTeachers: local.adminLockedForTeachers,
        }),
      }).catch(() => {});
    }
  } catch {
    // offline fallback
  }

  return local;
}

export function subscribeMasterStudents(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => listener();
  window.addEventListener('ma:master-students-updated', handler);
  return () => window.removeEventListener('ma:master-students-updated', handler);
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
  const master = readGlobalMasterStore();
  const s = getLegacyState();
  if (!s) {
    const def = getDefaultAdminGuruState();
    return {
      ...def,
      classes: master.classes,
      students: master.students,
    };
  }
  const normalized = normalizeAdminGuruState(s.adminGuru);
  const deletedIds = new Set(master.deletedStudentIds);
  const hasNewStudentsInWorkspace = normalized.students.some(
    (st) => !deletedIds.has(st.id) && !master.students.some((m) => m.id === st.id)
  );

  let finalClasses = master.classes;
  let finalStudents = master.students;

  if (hasNewStudentsInWorkspace) {
    const merged = mergeMasterPools(
      master.classes,
      master.students,
      normalized.classes,
      normalized.students,
      deletedIds
    );
    finalClasses = merged.classes;
    finalStudents = merged.students;
    if (
      merged.students.length !== master.students.length ||
      merged.classes.length !== master.classes.length
    ) {
      writeGlobalMasterStore(
        {
          classes: merged.classes,
          students: merged.students,
        },
        true
      );
    }
  }

  const combined: AdminGuruState = {
    ...normalized,
    classes: finalClasses,
    students: finalStudents,
  };
  s.adminGuru = combined;
  return combined;
}

export function updateAdminGuruState(
  updater: (prev: AdminGuruState, full: LegacyAppState) => AdminGuruState
): AdminGuruState {
  const api = getAppApi();
  if (!api) return getDefaultAdminGuruState();
  const s = api.getState();
  const prev = getAdminGuruState();
  const next = updater(prev, s);

  const prevStudentIds = new Set(prev.students.map((st) => st.id));
  const nextStudentIds = new Set(next.students.map((st) => st.id));
  const newlyDeleted = prev.students
    .filter((st) => !nextStudentIds.has(st.id))
    .map((st) => st.id);
  const reAddedIds = next.students
    .filter((st) => !prevStudentIds.has(st.id))
    .map((st) => st.id);

  const classesChanged =
    JSON.stringify(prev.classes) !== JSON.stringify(next.classes);
  const studentsChanged =
    JSON.stringify(prev.students) !== JSON.stringify(next.students);

  if (classesChanged || studentsChanged) {
    const currentMaster = readGlobalMasterStore();
    const updatedDeleted = currentMaster.deletedStudentIds
      .filter((id) => !reAddedIds.includes(id))
      .concat(newlyDeleted);
    writeGlobalMasterStore(
      {
        classes: next.classes,
        students: next.students,
        deletedStudentIds: updatedDeleted,
      },
      true,
      true
    );
  }

  s.adminGuru = next;
  api.save();
  return next;
}

/**
 * Mengambil daftar rombel/kelas global dari root state (S.adminGuru.classes)
 * yang berlaku lintas semua mata pelajaran dan guru.
 */
export function getGlobalClasses(tingkat?: TingkatKelas | 'all'): KelasItem[] {
  const { classes } = getAdminGuruState();
  if (!tingkat || tingkat === 'all') return classes;
  return classes.filter((c) => c.tingkat === tingkat);
}

/**
 * Mengambil daftar siswa global dari root state (S.adminGuru.students)
 * sehingga dapat dipanggil dari komponen atau mata pelajaran mana pun.
 */
export function getGlobalStudents(options: GlobalStudentQueryOptions = {}): StudentItem[] {
  const { students, classes } = getAdminGuruState();
  const { kelasId, tingkat, activeOnly = false, search, sortByName = false } = options;

  let result = students;

  if (activeOnly) {
    result = result.filter((st) => st.status !== 'nonaktif');
  }

  if (kelasId && kelasId !== 'all') {
    result = result.filter((st) => st.kelasId === kelasId);
  }

  if (tingkat && tingkat !== 'all') {
    const allowedClassIds = new Set(
      classes.filter((c) => c.tingkat === tingkat).map((c) => c.id)
    );
    result = result.filter((st) => allowedClassIds.has(st.kelasId));
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    const classMap = new Map(classes.map((c) => [c.id, c]));
    result = result.filter(
      (st) =>
        st.nama.toLowerCase().includes(q) ||
        st.nisn.toLowerCase().includes(q) ||
        (classMap.get(st.kelasId)?.nama || '').toLowerCase().includes(q)
    );
  }

  if (sortByName) {
    return [...result].sort((a, b) => a.nama.localeCompare(b.nama));
  }

  return result;
}

/**
 * Utilitas ringkas mengambil daftar siswa aktif pada rombel tertentu
 * (terurut sesuai abjad nama).
 */
export function getStudentsByKelas(
  kelasId: string,
  options?: { activeOnly?: boolean; sortByName?: boolean }
): StudentItem[] {
  return getGlobalStudents({
    kelasId,
    activeOnly: options?.activeOnly ?? true,
    sortByName: options?.sortByName ?? true,
  });
}

export function getStudentById(studentId: string): StudentItem | undefined {
  if (!studentId) return undefined;
  return getGlobalStudents().find((st) => st.id === studentId);
}

export function getStudentByNisn(nisn: string): StudentItem | undefined {
  const clean = String(nisn || '').trim().toLowerCase();
  if (!clean) return undefined;
  return getGlobalStudents().find((st) => st.nisn.trim().toLowerCase() === clean);
}

/**
 * Memperbarui daftar siswa global di root state (S.adminGuru.students)
 * sekaligus menyinkronkan ke seluruh mapel & penyimpanan server.
 */
export function setGlobalStudents(
  updater: StudentItem[] | ((prev: StudentItem[]) => StudentItem[])
): StudentItem[] {
  const updated = updateAdminGuruState((prev) => ({
    ...prev,
    students: typeof updater === 'function' ? updater(prev.students) : updater,
  }));
  return updated.students;
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
  jp: number;
  judul: string;
  tpLabel: string;
  kbcTema: string;
  hasDeepContent: boolean;
  hasDeepBahanAjar: boolean;
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
    if (Array.isArray(d.miskonsepsi) && d.miskonsepsi.length) {
      chunks.push(
        `Miskonsepsi & Klarifikasi:\n${d.miskonsepsi
          .map((m) => `- Keliru: ${m.keliru || ''} -> Klarifikasi: ${m.klarifikasi || ''}`)
          .join('\n')}`
      );
    }
    if (Array.isArray(d.rangkuman) && d.rangkuman.length) {
      chunks.push(`Rangkuman:\n- ${d.rangkuman.join('\n- ')}`);
    }
    if (Array.isArray(d.glosarium) && d.glosarium.length) {
      chunks.push(
        `Glosarium:\n${d.glosarium
          .map((g) => `- ${g.istilah || ''}: ${g.makna || ''}`)
          .join('\n')}`
      );
    }
    if (Array.isArray(d.refleksi) && d.refleksi.length) {
      chunks.push(`Refleksi:\n- ${d.refleksi.join('\n- ')}`);
    }
    if (Array.isArray(d.latihan) && d.latihan.length) {
      chunks.push(
        `Latihan:\n${d.latihan
          .map((l, li) => `${li + 1}. ${l.pertanyaan || ''} (${l.jenis || 'Latihan'})`)
          .join('\n')}`
      );
    }
  }

  if (unit.bahanAjarTeks) {
    chunks.push(`Catatan Bahan Ajar Mendalam:\n${unit.bahanAjarTeks}`);
  }

  if (chunks.length === 0) {
    if (unit.pokok) chunks.push(`Materi Pokok: ${unit.pokok}`);
    if (unit.subMateri) chunks.push(`Submateri: ${unit.subMateri}`);
    if (tpLabel) chunks.push(`Tujuan Pembelajaran: ${tpLabel}`);
    if (unit.ringkasan) chunks.push(`Ringkasan:\n${unit.ringkasan}`);
    if (unit.rincian) chunks.push(`Rincian Materi:\n${unit.rincian}`);
    if (unit.pemantik) chunks.push(`Pertanyaan Pemantik:\n${unit.pemantik}`);
    if (unit.kegiatan) chunks.push(`Kegiatan Pembelajaran:\n${unit.kegiatan}`);
    if (unit.media) chunks.push(`Rekomendasi Media:\n${unit.media}`);
    if (unit.kbc) chunks.push(`Tema KBC: ${unit.kbc}`);
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
    const hasDeepBahanAjar = Boolean(
      u.bahanAjarTeks ||
        d.judul ||
        d.pengantar ||
        (d.uraian && d.uraian.length > 0)
    );
    const hasDeepContent = Boolean(hasDeepBahanAjar || unitHasText(u));
    return {
      unitId: u.id,
      meetingNumber: idx + 1,
      smt: Number(u.smt) === 2 ? 2 : 1,
      jp: Number(u.jp) || 2,
      judul: d.judul || u.pokok || `Pertemuan ${idx + 1}`,
      tpLabel,
      kbcTema: u.kbc || tp?.kbc || '',
      hasDeepContent,
      hasDeepBahanAjar,
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

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportStudentsCsv(students: StudentItem[], classes: KelasItem[], filterLabel = 'Semua_Kelas'): void {
  const classMap = new Map(classes.map((c) => [c.id, c]));
  const headers = ['No', 'NIS/NISN', 'Nama Lengkap', 'Jenis Kelamin', 'Tingkat', 'Kelas', 'Status'];
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...students.map((s, idx) => {
      const cls = classMap.get(s.kelasId);
      const row = [
        idx + 1,
        s.nisn || '',
        s.nama || '',
        s.jk || '',
        cls ? `Kelas ${cls.tingkat}` : '-',
        cls ? cls.nama : '-',
        s.status === 'aktif' ? 'Aktif' : 'Nonaktif',
      ];
      return row.map(escapeCsvCell).join(',');
    }),
  ];

  // Prepend UTF-8 BOM so Microsoft Excel opens UTF-8 characters properly
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const safeLabel = filterLabel.replace(/[^A-Za-z0-9_-]/g, '_');
  const link = document.createElement('a');
  link.href = url;
  link.download = `Data_Siswa_${safeLabel}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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

    const kelasRaw = entries['kelas/rombel'] || entries['kelas'] || entries['rombel'] || '';
    const matchedKelasId =
      findMatchingClassId(classes, kelasRaw, fallbackKelasId) || fallbackKelasId;

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

// ======================= CLIPBOARD, PROMPT & AI JSON HELPERS =======================

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback below
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function extractJsonFromAiOutput(raw: string): unknown {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    throw new Error('Teks JSON masih kosong. Tempelkan hasil JSON dari Gemini atau ChatGPT terlebih dahulu.');
  }

  // Hapus markdown code fence jika ada (```json ... ```)
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenceMatch ? fenceMatch[1] : trimmed).trim();

  try {
    return JSON.parse(candidate);
  } catch {
    // Cari blok JSON pertama {...} atau [...] jika AI menambahkan kalimat pengantar/penutup
    const objStart = candidate.indexOf('{');
    const objEnd = candidate.lastIndexOf('}');
    const arrStart = candidate.indexOf('[');
    const arrEnd = candidate.lastIndexOf(']');

    let slice = '';
    if (arrStart !== -1 && arrEnd > arrStart && (objStart === -1 || arrStart < objStart)) {
      slice = candidate.slice(arrStart, arrEnd + 1);
    } else if (objStart !== -1 && objEnd > objStart) {
      slice = candidate.slice(objStart, objEnd + 1);
    }

    if (slice) {
      try {
        return JSON.parse(slice);
      } catch {
        // lanjut lempar pesan ramah
      }
    }
    throw new Error(
      'Format JSON tidak dapat dibaca. Pastikan seluruh blok JSON { ... } atau [ ... ] tersalin utuh dari Gemini/ChatGPT tanpa terpotong.'
    );
  }
}

function normalizeLetterIndex(val: unknown, optionCount: number): number {
  if (typeof val === 'number' && !Number.isNaN(val)) {
    // Jika 1..5 dan bukan 0, atau 0..4: tetap dukung 0-based standar, kecuali huruf
    return Math.max(0, Math.min(Math.max(0, optionCount - 1), Math.floor(val)));
  }
  const s = String(val ?? '').trim().toUpperCase();
  const letterIdx = ['A', 'B', 'C', 'D', 'E'].indexOf(s.charAt(0));
  if (letterIdx >= 0 && letterIdx < optionCount) return letterIdx;
  const numVal = Number(s);
  if (!Number.isNaN(numVal)) {
    return Math.max(0, Math.min(Math.max(0, optionCount - 1), Math.floor(numVal)));
  }
  return 0;
}

export function parseImportedQuizJson(raw: string): {
  questions: QuizQuestion[];
  judul?: string;
  durationMinutes?: number;
} {
  const parsed = extractJsonFromAiOutput(raw);
  const root =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;

  const rawList: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(root?.questions)
      ? root.questions
      : Array.isArray(root?.soal)
        ? root.soal
        : Array.isArray(root?.items)
          ? root.items
          : [];

  if (rawList.length === 0) {
    throw new Error(
      'JSON tidak berisi daftar soal ("questions"). Pastikan format JSON memiliki array "questions": [ ... ].'
    );
  }

  const questions: QuizQuestion[] = rawList
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((q, idx) => {
      const rawType = String(q.type || q.tipe || q.jenis || 'pg').toLowerCase();
      const isEssay =
        rawType.includes('esai') ||
        rawType.includes('essay') ||
        rawType.includes('uraian') ||
        rawType.includes('isian');

      let opts: string[] = [];
      const rawOpts = q.options ?? q.opsi ?? q.pilihan ?? q.choices;
      if (Array.isArray(rawOpts)) {
        opts = rawOpts.map((o) => String(o ?? '').trim()).filter(Boolean);
      } else if (rawOpts && typeof rawOpts === 'object') {
        const obj = rawOpts as Record<string, unknown>;
        opts = ['A', 'B', 'C', 'D', 'E']
          .map((k) => obj[k] ?? obj[k.toLowerCase()])
          .filter((v) => v !== undefined && String(v).trim() !== '')
          .map((v) => String(v).trim());
      } else {
        opts = ['a', 'b', 'c', 'd', 'e']
          .map((k) => q[k] ?? q[k.toUpperCase()])
          .filter((v) => v !== undefined && String(v).trim() !== '')
          .map((v) => String(v).trim());
      }

      const questionText = String(q.question || q.pertanyaan || q.soal || q.stem || '').trim();
      const rawAnswer = q.correctAnswerIndex ?? q.kunci ?? q.jawaban ?? q.correctAnswer ?? 0;

      return {
        id: createUid(`q_${idx}`),
        type: (isEssay ? 'esai' : 'pg') as QuizQuestion['type'],
        question: questionText,
        options: isEssay ? [] : opts.length >= 2 ? opts : ['Opsi A', 'Opsi B', 'Opsi C', 'Opsi D'],
        correctAnswerIndex: isEssay ? 0 : normalizeLetterIndex(rawAnswer, opts.length || 4),
        explanation: String(q.explanation || q.pembahasan || '').trim(),
        essayRubric: String(q.essayRubric || q.rubrik || q.kunciEsai || '').trim(),
        points: Number(q.points ?? q.poin ?? q.skor) > 0 ? Number(q.points ?? q.poin ?? q.skor) : isEssay ? 20 : 10,
      };
    })
    .filter((q) => q.question.length > 0);

  if (questions.length === 0) {
    throw new Error('Tidak ditemukan pertanyaan valid di dalam JSON. Periksa field "question" pada setiap soal.');
  }

  return {
    questions,
    judul: root?.judul ? String(root.judul).trim() : undefined,
    durationMinutes:
      Number(root?.durationMinutes ?? root?.durasi) > 0
        ? Number(root?.durationMinutes ?? root?.durasi)
        : undefined,
  };
}

const VALID_SLIDE_TYPES: MediaSlideTipe[] = [
  'pembuka',
  'tujuan',
  'konsep',
  'uraian',
  'contoh',
  'visual',
  'kbc',
  'kuis-cepat',
  'refleksi',
  'rangkuman',
];

const VALID_SLIDE_LAYOUTS: MediaSlideLayout[] = [
  'standar',
  'pembuka',
  'alur',
  'perbandingan',
  'kartu-grid',
  'kuis',
];

const VALID_THEMES: MediaThemeKey[] = ['zamrud', 'biru', 'emas', 'gelap'];

export function normalizeMediaPayload(
  rawObj: unknown,
  defaults: {
    judul?: string;
    jenis?: MediaPembelajaranJenis;
    tema?: MediaThemeKey;
    mapel?: string;
    kelasId?: string;
    kelasLabel?: string;
    unitId?: string;
    tpLabel?: string;
    durasiMenit?: number;
  } = {}
): LearningMediaItem {
  const parsed = rawObj as Record<string, unknown>;
  const root =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? ((parsed.media && typeof parsed.media === 'object' ? parsed.media : parsed) as Record<
          string,
          unknown
        >)
      : null;

  const rawSlides: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(root?.slides)
      ? root.slides
      : Array.isArray(root?.kartu)
        ? root.kartu
        : Array.isArray(root?.bagian)
          ? root.bagian
          : [];

  if (rawSlides.length === 0) {
    throw new Error(
      'JSON belum berisi daftar slide/kartu ("slides"). Pastikan format JSON memuat array "slides": [ ... ].'
    );
  }

  const slides: MediaSlideItem[] = rawSlides
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((sl, idx) => {
      const rawTipe = String(sl.tipe || sl.type || 'uraian').toLowerCase().trim() as MediaSlideTipe;
      const tipe: MediaSlideTipe = VALID_SLIDE_TYPES.includes(rawTipe) ? rawTipe : 'uraian';
      const rawLayout = String(sl.layout || '').toLowerCase().trim() as MediaSlideLayout;
      const inferredLayout: MediaSlideLayout = VALID_SLIDE_LAYOUTS.includes(rawLayout)
        ? rawLayout
        : tipe === 'pembuka'
          ? 'pembuka'
          : tipe === 'kuis-cepat'
            ? 'kuis'
            : Array.isArray(sl.diagramLangkah) && sl.diagramLangkah.length > 0
              ? 'alur'
              : sl.perbandingan && typeof sl.perbandingan === 'object'
                ? 'perbandingan'
                : 'standar';

      const rawBullets = sl.poinUtama ?? sl.poin ?? sl.bullets ?? sl.points;
      const poinUtama = Array.isArray(rawBullets)
        ? rawBullets.map((b) => String(b ?? '').trim()).filter(Boolean)
        : typeof rawBullets === 'string' && rawBullets.trim()
          ? rawBullets
              .split(/\r?\n/)
              .map((line) => line.replace(/^[-•*]\s*/, '').trim())
              .filter(Boolean)
          : [];

      const rawLangkah = sl.diagramLangkah ?? sl.langkah ?? sl.alur ?? sl.steps;
      const diagramLangkah = Array.isArray(rawLangkah)
        ? rawLangkah.map((s) => String(s ?? '').trim()).filter(Boolean)
        : undefined;

      const rawCmp = (sl.perbandingan || sl.comparison) as Record<string, unknown> | undefined;
      const perbandingan =
        rawCmp && typeof rawCmp === 'object'
          ? {
              judulKiri: String(rawCmp.judulKiri || rawCmp.leftTitle || 'Aspek A').trim(),
              isiKiri: Array.isArray(rawCmp.isiKiri ?? rawCmp.leftItems)
                ? ((rawCmp.isiKiri ?? rawCmp.leftItems) as unknown[])
                    .map((x) => String(x ?? '').trim())
                    .filter(Boolean)
                : [],
              judulKanan: String(rawCmp.judulKanan || rawCmp.rightTitle || 'Aspek B').trim(),
              isiKanan: Array.isArray(rawCmp.isiKanan ?? rawCmp.rightItems)
                ? ((rawCmp.isiKanan ?? rawCmp.rightItems) as unknown[])
                    .map((x) => String(x ?? '').trim())
                    .filter(Boolean)
                : [],
            }
          : undefined;

      const rawHtml5 = String(sl.html5 || sl.html || sl.htmlContent || '').trim();

      return {
        id: createUid(`sl_${idx}`),
        judulSlide: String(sl.judulSlide || sl.judul || sl.title || `Slide ${idx + 1}`).trim(),
        tipe,
        layout: inferredLayout,
        ringkasan: String(sl.ringkasan || sl.narasi || sl.isi || sl.content || '').trim(),
        poinUtama,
        diagramLangkah: diagramLangkah && diagramLangkah.length > 0 ? diagramLangkah : undefined,
        perbandingan:
          perbandingan && (perbandingan.isiKiri.length > 0 || perbandingan.isiKanan.length > 0)
            ? perbandingan
            : undefined,
        visualIde: String(sl.visualIde || sl.visual || sl.ilustrasi || sl.diagram || '').trim(),
        catatanGuru: String(sl.catatanGuru || sl.catatan || sl.speakerNotes || '').trim(),
        pertanyaanInteraktif: String(
          sl.pertanyaanInteraktif || sl.pertanyaan || sl.cekPemahaman || ''
        ).trim(),
        jawabanInteraktif: String(
          sl.jawabanInteraktif || sl.jawaban || sl.kunciJawaban || ''
        ).trim(),
        html5: rawHtml5 || undefined,
      };
    });

  const rawGlos = root?.glosarium;
  const glosarium = Array.isArray(rawGlos)
    ? rawGlos
        .filter((g): g is Record<string, unknown> => Boolean(g && typeof g === 'object'))
        .map((g) => ({
          istilah: String(g.istilah || g.term || '').trim(),
          makna: String(g.makna || g.arti || g.definition || '').trim(),
        }))
        .filter((g) => g.istilah && g.makna)
    : [];

  const rawTema = String(root?.tema || defaults.tema || 'zamrud').toLowerCase() as MediaThemeKey;
  const tema: MediaThemeKey = VALID_THEMES.includes(rawTema) ? rawTema : 'zamrud';

  const now = new Date().toISOString();
  return {
    id: createUid('med'),
    judul: String(root?.judul || root?.title || defaults.judul || 'Media Pembelajaran Interaktif').trim(),
    subjudul: String(root?.subjudul || root?.subtitle || '').trim(),
    jenis: (['slide-presentasi', 'peta-konsep', 'kartu-ajar', 'studi-kasus'].includes(
      String(root?.jenis || '')
    )
      ? String(root?.jenis)
      : defaults.jenis || 'slide-presentasi') as MediaPembelajaranJenis,
    tema,
    mapel: String(defaults.mapel || root?.mapel || 'Mata Pelajaran').trim(),
    kelasId: String(defaults.kelasId || ''),
    kelasLabel: String(defaults.kelasLabel || ''),
    unitId: defaults.unitId,
    materiJudul: defaults.judul,
    tujuanPembelajaran: String(
      root?.tujuanPembelajaran || root?.tujuan || defaults.tpLabel || ''
    ).trim(),
    integrasiKbc: String(root?.integrasiKbc || root?.integrasi_kbc || root?.kbc || '').trim(),
    aktivitasKelas: String(root?.aktivitasKelas || root?.aktivitas || '').trim(),
    durasiMenit: Number(defaults.durasiMenit || root?.durasiMenit || 45) || 45,
    createdAt: now,
    updatedAt: now,
    slides,
    glosarium,
  };
}

export function parseImportedMediaJson(
  raw: string,
  defaults: {
    judul?: string;
    jenis?: MediaPembelajaranJenis;
    mapel?: string;
    kelasId?: string;
    kelasLabel?: string;
    unitId?: string;
    tpLabel?: string;
    durasiMenit?: number;
  } = {}
): LearningMediaItem {
  const parsed = extractJsonFromAiOutput(raw);
  return normalizeMediaPayload(parsed, defaults);
}

export function buildQuizExternalPrompt(params: {
  materiText: string;
  judul: string;
  mapel: string;
  kelas: string;
  pertemuanJp?: string;
  tp: string;
  jumlahPG: number;
  jumlahEsai: number;
  tingkatKesulitan: string;
}): string {
  return `Anda adalah guru profesional Madrasah Aliyah dan pembuat asesmen pembelajaran mendalam.
Buatlah soal kuis interaktif berdasarkan BAHAN AJAR MENDALAM di bawah ini.

IDENTITAS KUIS:
- Judul Kuis: ${params.judul || 'Kuis Pembelajaran'}
- Mata Pelajaran: ${params.mapel || '-'}
- Kelas: ${params.kelas || '-'}
- Pertemuan & Alokasi JP: ${params.pertemuanJp || '-'}
- Tujuan Pembelajaran: ${params.tp || '-'}
- Tingkat Kesulitan: ${params.tingkatKesulitan}

BAHAN AJAR MENDALAM (SUMBER UTAMA):
${String(params.materiText || '').slice(0, 16000)}

ATURAN SOAL:
1. Buat tepat ${params.jumlahPG} soal Pilihan Ganda ("type": "pg") dengan 4 atau 5 opsi jawaban pada array "options". Isi "correctAnswerIndex" dengan indeks angka dimulai dari 0 (0=A, 1=B, 2=C, 3=D, 4=E). Sertakan "explanation" (pembahasan singkat).
2. Buat tepat ${params.jumlahEsai} soal Esai/Uraian ("type": "esai") dengan "options": [], "correctAnswerIndex": 0, dan isi "essayRubric" dengan rubrik/kunci penilaian singkat.
3. Isi "points": 10 untuk PG dan 20 untuk Esai.
4. Seluruh soal harus akurat dan merujuk pada bahan ajar di atas.

KELUARAN WAJIB:
Kembalikan HANYA JSON valid (tanpa teks pengantar/penutup atau markdown) dengan struktur persis seperti berikut:
{
  "judul": "${(params.judul || 'Kuis Pembelajaran').replace(/"/g, '\\"')}",
  "questions": [
    {
      "type": "pg",
      "question": "Pertanyaan pilihan ganda...",
      "options": ["Opsi A", "Opsi B", "Opsi C", "Opsi D"],
      "correctAnswerIndex": 0,
      "explanation": "Pembahasan singkat jawaban benar.",
      "essayRubric": "",
      "points": 10
    },
    {
      "type": "esai",
      "question": "Pertanyaan uraian/HOTS...",
      "options": [],
      "correctAnswerIndex": 0,
      "explanation": "",
      "essayRubric": "Poin kunci jawaban esai yang diharapkan.",
      "points": 20
    }
  ]
}`;
}

export function buildQuizGeminiCanvasPrompt(params: {
  materiText: string;
  judul: string;
  mapel: string;
  kelas: string;
  pertemuanJp: string;
  tp: string;
  kbc?: string;
  namaSekolah?: string;
  guru?: string;
  jumlahPG: number;
  jumlahEsai: number;
  durasiMenit: number;
  tingkatKesulitan: string;
  studentNames?: Array<{ nisn: string; nama: string }>;
}): string {
  const totalSoal = Math.max(1, Number(params.jumlahPG || 0) + Number(params.jumlahEsai || 0));
  const hasRoster = Array.isArray(params.studentNames) && params.studentNames.length > 0;
  const rosterSection = hasRoster
    ? `\nDAFTAR PESERTA KELAS (SEDIAKAN DROPDOWN PILIH NAMA ATAU INPUT MANUAL DI HALAMAN LOGIN CBT):\n${params.studentNames!
        .slice(0, 60)
        .map((s, i) => `${i + 1}. ${s.nama}${s.nisn ? ` (NISN: ${s.nisn})` : ''}`)
        .join('\n')}\n`
    : '';

  return `Buatkan langsung di **Gemini Canvas** sebuah aplikasi web interaktif **Kuis CBT (Computer-Based Test)** dalam 1 file HTML5 lengkap (HTML + Tailwind CSS CDN + JavaScript) yang siap langsung dijalankan di pratinjau Canvas dan dibagikan ke siswa melalui tautan Share Gemini Canvas.

IDENTITAS MADRASAH & PEMBELAJARAN:
- Satuan Pendidikan: ${params.namaSekolah || 'Madrasah Aliyah'}
- Guru Pengampu: ${params.guru || '-'}
- Mata Pelajaran: ${params.mapel || '-'}
- Kelas Sasaran: ${params.kelas || '-'}
- Pertemuan & Alokasi JP: ${params.pertemuanJp || '-'}
- Judul Kuis CBT: ${params.judul || 'Kuis CBT Pembelajaran'}
- Tujuan Pembelajaran (TP): ${params.tp || '-'}
- Integrasi Kurikulum Berbasis Cinta (KBC): ${params.kbc || '-'}
- Komposisi Soal: ${params.jumlahPG} Soal Pilihan Ganda (A-E) dan ${params.jumlahEsai} Soal Esai/Uraian (Total ${totalSoal} soal)
- Tingkat Kesulitan: ${params.tingkatKesulitan}
- Durasi Pengerjaan: ${params.durasiMenit} menit
${rosterSection}
BAHAN AJAR MENDALAM (WAJIB MENJADI SUMBER UTAMA SELURUH SOAL):
${String(params.materiText || '').slice(0, 16000)}

SPESIFIKASI WAJIB APLIKASI CBT DI GEMINI CANVAS:
1. **Keselarasan Materi 100%**:
   - Seluruh ${totalSoal} butir soal WAJIB disusun berdasarkan **Bahan Ajar Mendalam** di atas, selaras dengan **Mata Pelajaran (${params.mapel || '-'})** dan cakupan **${params.pertemuanJp || 'pertemuan ini'}**.
   - Tuliskan seluruh ${params.jumlahPG} soal PG (masing-masing 4 atau 5 pilihan jawaban yang logis, kunci jawaban, dan pembahasan) serta ${params.jumlahEsai} soal Esai (lengkap dengan rubrik/kunci jawaban ideal) secara penuh di dalam array JavaScript \`QUIZ_DATA\`. DILARANG menggunakan placeholder atau komentar penyingkat seperti \`// tambah soal lainnya\`.

2. **Tampilan & Alur CBT Profesional (Responsif untuk HP & Laptop)**:
   - **Tema Visual**: Desain akademik Madrasah Aliyah modern bernuansa hijau zamrud (#0c6a5a / #093f36) dan emas (#c68a0f), bersih, kontras tinggi, nyaman dibaca siswa di layar ponsel maupun komputer.
   - **Halaman 1 — Login / Identitas Peserta CBT**:
     - Tampilkan banner identitas: Nama Madrasah, Judul Kuis, Mapel, Kelas, Pertemuan & JP, Jumlah Soal, dan Durasi (${params.durasiMenit} menit).
     - ${
       hasRoster
         ? 'Sediakan pilihan dropdown Nama Siswa dari daftar kelas di atas (atau opsi ketik nama manual) serta input/otomatis NISN/Nomor Absen.'
         : 'Sediakan input Nama Lengkap Siswa, NISN / Nomor Absen, dan Kelas.'
     }
     - Tombol **"Mulai Mengerjakan CBT"**.
   - **Halaman 2 — Ruang Ujian CBT Interaktif**:
     - Header tetap menampilkan: Judul Kuis, Mapel, Pertemuan/JP, Nama Peserta, dan **Timer Hitung Mundur (${params.durasiMenit}:00)** yang otomatis mengumpulkan ujian saat waktu habis.
     - **Panel Navigasi Nomor Soal** (grid angka 1 s.d. ${totalSoal}) dengan indikator warna jelas:
       * Hijau = Sudah dijawab
       * Kuning/Amber = Ditandai Ragu-ragu
       * Abu-abu = Belum dijawab
     - Tampilan 1 soal per layar (atau navigasi klik nomor) dengan tombol **Sebelumnya**, **Tandai Ragu-ragu**, **Berikutnya**, dan tombol **Selesai & Kumpulkan** (disertai modal konfirmasi yang menunjukkan jumlah soal terjawab dan belum terjawab).
   - **Halaman 3 — Hasil Ujian, Pembahasan & Kirim Bukti ke Guru**:
     - Hitung otomatis **Skor Pilihan Ganda (skala 0–100)**, jumlah Benar, Salah, dan status ketercapaian.
     - Tampilkan **Pembahasan Lengkap** untuk setiap soal (membandingkan jawaban siswa vs kunci jawaban benar + penjelasan).
     - ${
       params.jumlahEsai > 0
         ? 'Untuk soal Esai, tampilkan jawaban siswa berdampingan dengan Rubrik & Kunci Jawaban Ideal sebagai refleksi mandiri.'
         : ''
     }
     - Sediakan tombol **"Salin Rekap Hasil (WhatsApp)"** untuk menyalin ringkasan rapi (Nama Siswa, NISN, Kelas, Mapel, Pertemuan & JP, Judul Kuis, Skor, dan Waktu Selesai) agar bisa langsung dikirim ke guru, serta tombol **"Cetak / Simpan Bukti PDF"** (\`window.print()\`).

INSTRUKSI EKSEKUSI CANVAS:
Buat kode HTML5 lengkap dalam satu file langsung di **Gemini Canvas** agar aplikasi CBT dapat langsung dicoba di pratinjau dan dibagikan ke siswa.`;
}

export function buildMediaExternalPrompt(params: {
  materiText: string;
  judul: string;
  mapel: string;
  kelas: string;
  tp: string;
  kbc: string;
  jenisMedia: MediaPembelajaranJenis;
  jumlahSlide: number;
}): string {
  const jenisMap: Record<MediaPembelajaranJenis, string> = {
    'slide-presentasi': 'Slide Presentasi Mengajar seperti PowerPoint (HTML5/JS)',
    'peta-konsep': 'Peta Konsep & Diagram Alur Materi Interaktif',
    'kartu-ajar': 'Kartu Ajar Interaktif & Flashcard Konsep',
    'studi-kasus': 'Slide Studi Kasus, Perbandingan & Diskusi Kelompok',
  };

  return `Anda adalah desainer slide presentasi interaktif (setara PowerPoint HTML5/JavaScript) untuk Madrasah Aliyah berbasis Pembelajaran Mendalam & Kurikulum Berbasis Cinta (KBC).
Ubah BAHAN AJAR MENDALAM berikut menjadi data JSON presentasi PowerPoint interaktif yang siap dijalankan di aplikasi HTML5.

IDENTITAS MEDIA:
- Judul Media: ${params.judul || 'Media Pembelajaran'}
- Bentuk Media: ${jenisMap[params.jenisMedia] || params.jenisMedia}
- Mata Pelajaran: ${params.mapel || '-'}
- Kelas: ${params.kelas || '-'}
- Tujuan Pembelajaran: ${params.tp || '-'}
- Tema Kurikulum Berbasis Cinta (KBC): ${params.kbc || '-'}
- Target Jumlah Slide: ${params.jumlahSlide} slide

BAHAN AJAR MENDALAM (SUMBER UTAMA):
${String(params.materiText || '').slice(0, 16000)}

INSTRUKSI PENYUSUNAN SLIDE POWERPOINT:
1. Susun tepat ${params.jumlahSlide} slide yang runtut seperti presentasi PowerPoint profesional: Slide 1 pembuka & pemantik, tujuan belajar, konsep kunci, uraian materi bertahap, bagan alur/langkah proses ("diagramLangkah"), perbandingan dua konsep ("perbandingan" jika relevan), contoh penerapan nyata, integrasi KBC, kuis cepat/cek pemahaman dengan "jawabanInteraktif", hingga refleksi & rangkuman.
2. Pada setiap slide wajib isi:
   - "judulSlide": judul singkat & kuat (maks 10 kata)
   - "tipe": salah satu dari ("pembuka" | "tujuan" | "konsep" | "uraian" | "contoh" | "visual" | "kbc" | "kuis-cepat" | "refleksi" | "rangkuman")
   - "layout": salah satu dari ("pembuka" | "standar" | "kartu-grid" | "alur" | "perbandingan" | "kuis")
   - "ringkasan": teks inti 1-3 kalimat yang tajam & enak dibaca di layar proyektor
   - "poinUtama": array 3-5 poin ringkas padat (akan dianimasikan bertahap per klik seperti PowerPoint)
   - "diagramLangkah": array langkah berurutan (isi bila layout="alur", misal ["Langkah 1: ...", "Langkah 2: ...", "Langkah 3: ..."], kosongkan [] jika tidak perlu)
   - "perbandingan": objek { "judulKiri": "", "isiKiri": [""], "judulKanan": "", "isiKanan": [""] } (isi bila layout="perbandingan", atau null jika tidak perlu)
   - "visualIde": ide visual/ilustrasi/grafik konkret untuk slide ini
   - "catatanGuru": catatan pembicara (Speaker Notes) bagi guru saat mengajar
   - "pertanyaanInteraktif": pertanyaan diskusi/kuis untuk siswa di slide ini
   - "jawabanInteraktif": arah/kunci jawaban yang muncul saat guru menekan tombol "Tampilkan Jawaban"
3. Sertakan "glosarium" istilah kunci dan "aktivitasKelas" singkat.

KELUARAN WAJIB:
Kembalikan HANYA JSON valid (tanpa kalimat pengantar/penutup dan tanpa markdown) dengan struktur persis seperti berikut:
{
  "judul": "${(params.judul || 'Media Pembelajaran').replace(/"/g, '\\"')}",
  "subjudul": "Subjudul singkat presentasi",
  "tema": "zamrud",
  "tujuanPembelajaran": "Tujuan pembelajaran ringkas",
  "integrasiKbc": "Keterkaitan materi dengan nilai Kurikulum Berbasis Cinta",
  "aktivitasKelas": "Saran aktivitas interaktif siswa selama presentasi",
  "glosarium": [
    { "istilah": "Istilah 1", "makna": "Penjelasan singkat istilah" }
  ],
  "slides": [
    {
      "judulSlide": "Judul Slide 1",
      "tipe": "pembuka",
      "layout": "pembuka",
      "ringkasan": "Pengantar singkat dan pemantik rasa ingin tahu siswa.",
      "poinUtama": ["Poin 1", "Poin 2", "Poin 3"],
      "diagramLangkah": [],
      "perbandingan": null,
      "visualIde": "Ilustrasi atau bagan pengantar",
      "catatanGuru": "Apa yang guru jelaskan/tanyakan saat slide ini tampil",
      "pertanyaanInteraktif": "Pertanyaan pemantik untuk kelas",
      "jawabanInteraktif": "Arah jawaban atau poin diskusi yang diharapkan"
    }
  ]
}`;
}


