import React from 'react';
import { Outlet, Link } from 'react-router-dom';

export const BackofficeLayout = () => {
  return (
    <div className="min-h-screen flex bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
      <aside className="w-64 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold font-serif">Backoffice</h2>
          <p className="text-xs text-neutral-500 uppercase tracking-widest mt-1">Panel de Administración</p>
        </div>
        <nav className="space-y-2 text-sm font-semibold">
          <Link to="/admin/finanzas" className="block px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700">Contabilidad & ARCA</Link>
          <Link to="/admin/productos" className="block px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700">Productos & Stock</Link>
          <Link to="/admin/permisos" className="block px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700">Permisos (SuperAdmin)</Link>
          <Link to="/" className="block px-3 py-2 rounded-lg text-neutral-500 hover:text-black dark:hover:text-white pt-4">← Volver a la Tienda</Link>
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};
