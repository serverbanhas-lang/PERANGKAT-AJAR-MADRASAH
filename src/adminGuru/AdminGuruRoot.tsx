import React, { useEffect } from 'react';
import { syncMasterStudentsWithServer } from './bridge';
import { DaftarSiswaView } from './DaftarSiswaView';
import { DataSiswaView } from './DataSiswaView';
import { AbsensiView } from './AbsensiView';
import { JurnalView } from './JurnalView';
import { NilaiHarianView } from './NilaiHarianView';
import { KuisInteraktifView } from './KuisInteraktifView';
import { MediaPembelajaranView } from './MediaPembelajaranView';

interface AdminGuruRootProps {
  view: string;
}

export const AdminGuruRoot: React.FC<AdminGuruRootProps> = ({ view }) => {
  useEffect(() => {
    syncMasterStudentsWithServer();
  }, [view]);

  switch (view) {
    case 'daftar-siswa':
      return <DaftarSiswaView />;
    case 'kelas-siswa':
      return <DataSiswaView />;
    case 'absensi':
      return <AbsensiView />;
    case 'jurnal':
      return <JurnalView />;
    case 'nilai-harian':
      return <NilaiHarianView />;
    case 'media-pembelajaran':
      return <MediaPembelajaranView />;
    case 'kuis-interaktif':
      return <KuisInteraktifView />;
    default:
      return <DataSiswaView />;
  }
};
