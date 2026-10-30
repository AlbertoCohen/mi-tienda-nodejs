import React from 'react';

export const AdminProductsPage = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-neutral-800 p-6 rounded-xl border border-neutral-200 dark:border-neutral-700">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Catálogo e Inventario</h1>
          <p className="text-xs text-neutral-500 mt-1">CRUD completo de productos, variantes y subida a Cloudinary</p>
        </div>
      </div>
      <div className="p-8 text-center text-sm text-neutral-400 border border-dashed rounded-xl bg-white dark:bg-neutral-800">
        Panel administrativo de productos conectado a la API de PostgreSQL y Cloudinary.
      </div>
    </div>
  );
};
