import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';

export const AdminPanel: React.FC = () => {
  const { user } = useStore();
  const [targetId, setTargetId] = useState('');
  const [msg, setMsg] = useState('');

  const elevate = async () => {
    try {
      const res = await fetch('/api/admin/elevate-role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user?.token || ''}` },
        body: JSON.stringify({ targetUserId: targetId, newRole: 'admin' })
      });
      const d = await res.json();
      if (res.ok) setMsg(`Rol delegado a ${targetId}`);
      else setMsg(`Fallo: ${d.error}`);
    } catch (e: any) { setMsg(e.message); }
  };

  const downloadZpl = () => {
    const code = '^XA^PW800^LL1200^FO50,50^A0N,50,50^FDANDREANI^FS^FO50,150^BCN,100,Y,N,N^FDAND123456AR^FS^XZ';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'label_203dpi.zpl';
    a.click();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-sm border mt-6">
      <h2 className="text-xl font-black mb-4">Backoffice Gauntlet - Delegación y Despacho</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border p-4 rounded-lg">
          <h3 className="font-bold text-sm mb-2">Delegación RBAC (SuperAdmin: itamarx2400@gmail.com)</h3>
          <input value={targetId} onChange={e => setTargetId(e.target.value)} placeholder="UUID de Usuario" className="w-full border p-2 text-xs rounded mb-2" />
          <button onClick={elevate} className="bg-purple-600 text-white text-xs font-bold px-4 py-2 rounded">Delegar Rol Admin</button>
          {msg && <p className="text-xs font-bold mt-2 text-emerald-600">{msg}</p>}
        </div>
        <div className="border p-4 rounded-lg">
          <h3 className="font-bold text-sm mb-2">Despacho ZPL 203 DPI (Andreani / PAQ.AR)</h3>
          <p className="text-xs text-slate-500 mb-3">Impresión directa para impresoras térmicas de etiquetas 100x150mm.</p>
          <button onClick={downloadZpl} className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded">Descargar Rótulo ZPL</button>
        </div>
      </div>
    </div>
  );
};
