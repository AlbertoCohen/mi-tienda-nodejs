import React from 'react';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

export const SizeGuideModal = ({ categoria, guia, onClose }: any) => {
  const modalRef = useFocusTrap({ isOpen: true, onClose });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" role="dialog" aria-modal="true" aria-labelledby="size-modal-title">
      <div ref={modalRef} className="w-full max-w-xl bg-[var(--bg-surface)] text-[var(--text-main)] rounded-xl shadow-2xl border border-[var(--border-light)] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-[var(--border-light)] flex justify-between items-center">
          <h3 id="size-modal-title" className="text-lg font-serif font-bold">Guía de Talles y Medidas en Centímetros</h3>
          <button onClick={onClose} aria-label="Cerrar modal" className="w-10 h-10 flex items-center justify-center text-neutral-400 hover:text-neutral-700">✕</button>
        </div>
        <div className="p-5 overflow-x-auto overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full text-left text-sm border-collapse min-w-[320px]">
            <thead>
              <tr className="border-b border-[var(--border-light)] text-xs uppercase tracking-wider text-neutral-500">
                <th className="py-2.5 px-3 font-bold">Talle</th>
                <th className="py-2.5 px-3 font-bold">Pecho / Medida</th>
                <th className="py-2.5 px-3 font-bold">Largo (cm)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-light)]">
              {guia?.talles?.map((t: any, idx: number) => (
                <tr key={idx} className="hover:bg-neutral-500/5">
                  <td className="py-2.5 px-3 font-bold">{t.talle || t.talle_ar}</td>
                  <td className="py-2.5 px-3">{t.ancho_pecho_cm || t.largo_plantilla_cm || 95} cm</td>
                  <td className="py-2.5 px-3">{t.largo_total_cm || 70} cm</td>
                </tr>
              )) || (
                <tr>
                  <td className="py-2 px-3 font-bold">M</td>
                  <td className="py-2 px-3">98 cm</td>
                  <td className="py-2 px-3">72 cm</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-[var(--border-light)] bg-neutral-500/5 flex justify-end">
          <button onClick={onClose} className="px-5 py-2.5 bg-[var(--accent-primary)] text-white text-xs font-bold uppercase rounded-lg">Cerrar</button>
        </div>
      </div>
    </div>
  );
};
