import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getGlobalClasses,
  getGlobalStudents,
  readGlobalMasterStore,
  subscribeMasterStudents,
  syncMasterStudentsWithServer,
  type MasterStudentsStorePayload,
} from './bridge';
import type { GlobalStudentQueryOptions, KelasItem, StudentItem } from '../types/adminGuru';

export interface UseGlobalStudentsResult {
  students: StudentItem[];
  allStudents: StudentItem[];
  classes: KelasItem[];
  isLockedForTeachers: boolean;
  refresh: () => void;
  syncAll: (options?: { rescanWorkspaces?: boolean; preferServer?: boolean }) => Promise<MasterStudentsStorePayload>;
}

/**
 * React hook untuk memanggil daftar siswa & rombel global dari root state
 * (S.adminGuru.students & S.adminGuru.classes) secara reaktif di komponen mana pun.
 */
export function useGlobalStudents(
  options: GlobalStudentQueryOptions = {}
): UseGlobalStudentsResult {
  const { kelasId, tingkat, activeOnly = false, search, sortByName = false } = options;
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    return subscribeMasterStudents(() => {
      setVersion((v) => v + 1);
    });
  }, []);

  const allStudents = useMemo(() => {
    void version;
    return getGlobalStudents();
  }, [version]);

  const classes = useMemo(() => {
    void version;
    return getGlobalClasses();
  }, [version]);

  const students = useMemo(() => {
    void version;
    return getGlobalStudents({ kelasId, tingkat, activeOnly, search, sortByName });
  }, [version, kelasId, tingkat, activeOnly, search, sortByName]);

  const isLockedForTeachers = useMemo(() => {
    void version;
    return readGlobalMasterStore().adminLockedForTeachers;
  }, [version]);

  const syncAll = useCallback(
    async (syncOpts?: { rescanWorkspaces?: boolean; preferServer?: boolean }) => {
      const result = await syncMasterStudentsWithServer(syncOpts);
      setVersion((v) => v + 1);
      return result;
    },
    []
  );

  return {
    students,
    allStudents,
    classes,
    isLockedForTeachers,
    refresh,
    syncAll,
  };
}
