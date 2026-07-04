'use client';
import { useState } from 'react';
import api from '../lib/api';

export default function ExcelExportButton({ url, filename }) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const res = await api.get(url, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={handleClick} disabled={busy} className="btn-ghost">
      {busy ? 'Exporting…' : 'Export to Excel'}
    </button>
  );
}
