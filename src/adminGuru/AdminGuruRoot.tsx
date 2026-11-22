import React from 'react';
import { DataSiswaView } from './DataSiswaView';
import { AbsensiView } from './AbsensiView';
import { JurnalView } from './JurnalView';
import { NilaiHarianView } from './NilaiHarianView';
import { KuisInteraktifView } from './KuisInteraktifView';

interface AdminGuruRootProps {
  view: string;
}

export const AdminGuruRoot: React.FC<AdminGuruRootProps> = ({ view }) => {
  switch (view) {
    case 'kelas-siswa':
      return <DataSiswaView />;
    case 'absensi':
      return <AbsensiView />;
    case 'jurnal':
      return <JurnalView />;
    case 'nilai-harian':
      return <NilaiHarianView />;
    case 'kuis-interaktif':
      return <KuisInteraktifView />;
    default:
      return <DataSiswaView />;
  }
};
