import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/axios';

export const AdminFinanceDashboard = () => {
  const [agrupacion, setAgrupacion] = useState('mes');
  const [fechaInicio, setFechaInicio] = useState('2026-01-01');
  const [fechaFin, setFechaFin] = useState('2026-12-31');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-finance', agrupacion, fechaInicio, fechaFin],
    queryFn: async () => {
      const res = await api.get('/admin/reportes/financieros', { params: { agrupacion, fechaInicio, fechaFin } });
      return res.data;
    }
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-neutral-800 p-6 rounded-xl border border-neutral-200 dark:border-neutral-700">
        <div>
          <h1 className="text-2xl font-bold">Cuadro Contable y Facturación ARCA</h1>
          <p className="text-xs text-neutral-500 mt-1">Conciliación de comprobantes fiscales y Mercado Pago</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={agrupacion} onChange={(e) => setAgrupacion(e.target.value)} className="h-10 px-3 border rounded-lg text-sm bg-neutral-50 dark:bg-neutral-700">
            <option value="dia">Día</option>
            <option value="semana">Semana</option>
            <option value="mes">Mes</option>
            <option value="anio">Año</option>
          </select>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="h-10 px-3 border rounded-lg text-sm bg-neutral-50 dark:bg-neutral-700" />
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="h-10 px-3 border rounded-lg text-sm bg-neutral-50 dark:bg-neutral-700" />
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse min-w-[600px]">
          <thead className="bg-neutral-50 dark:bg-neutral-900 text-xs uppercase text-neutral-500 font-semibold border-b">
            <tr>
              <th className="p-4">Período</th>
              <th className="p-4">Pedidos</th>
              <th className="p-4">Total Cobrado</th>
              <th className="p-4">Base Neta</th>
              <th className="p-4">IVA 21%</th>
              <th className="p-4">CAE ARCA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {data?.periodos?.map((r: any, idx: number) => (
              <tr key={idx} className="hover:bg-neutral-500/5">
                <td className="p-4 font-medium">{new Date(r.periodo).toLocaleDateString('es-AR')}</td>
                <td className="p-4">{r.total_pedidos}</td>
                <td className="p-4 font-bold">${Number(r.facturacion_total_cobrada).toLocaleString('es-AR')}</td>
                <td className="p-4">${Number(r.base_imponible_fiscal || 0).toLocaleString('es-AR')}</td>
                <td className="p-4 text-emerald-600">{r.debito_fiscal_iva !== null ? `$${Number(r.debito_fiscal_iva).toLocaleString('es-AR')}` : <span className="text-neutral-400 italic">Sin emitir</span>}</td>
                <td className="p-4"><span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">{r.comprobantes_arca_emitidos} Emitidos</span></td>
              </tr>
            )) || (
              <tr><td colSpan={6} className="p-6 text-center text-neutral-400">Sin datos para el período seleccionado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
