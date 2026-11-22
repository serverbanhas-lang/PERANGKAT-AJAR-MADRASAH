import React from 'react';
import { AdminGuruRoot } from './adminGuru/AdminGuruRoot';

export default function App({ view = 'kelas-siswa' }: { view?: string }) {
  return <AdminGuruRoot view={view} />;
}
