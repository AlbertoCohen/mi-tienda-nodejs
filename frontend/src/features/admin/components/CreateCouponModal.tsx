import React, { useState } from 'react';

export const CreateCouponModal = ({ isOpen, onClose, onSave }: any) => {
  const [codigo, setCodigo] = useState('');
  const [valor, setValor] = useState(10);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white p-6 rounded-xl space-y-4">
        <h3 className="text-lg font-bold">Crear Cupón</h3>
        <input
          type="text"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
          placeholder="CÓDIGO"
          className="w-full h-10 px-3 border rounded-lg text-sm font-mono"
        />
        <input
          type="number"
          value={valor}
          onChange={(e) => setValor(Number(e.target.value))}
          className="w-full h-10 px-3 border rounded-lg text-sm"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
          <button onClick={() => { onSave({ codigo, valor }); onClose(); }} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-bold">Guardar</button>
        </div>
      </div>
    </div>
  );
};
