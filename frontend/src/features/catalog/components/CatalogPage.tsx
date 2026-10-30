import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { ProductCard } from './ProductCard';
import { useThemeStore } from '../../theme/themeStore';

export const CatalogPage = () => {
  const { clientSeason } = useThemeStore();
  const [genero, setGenero] = useState<string>('Hombre');

  const { data: menuData } = useQuery({
    queryKey: ['menu', clientSeason, genero],
    queryFn: async () => {
      const res = await api.get('/productos/menu', { params: { estacion: clientSeason === 'invierno' ? 'Invierno' : 'Verano', genero } });
      return res.data.menu;
    }
  });

  const { data: catalogData, isLoading } = useQuery({
    queryKey: ['catalog', clientSeason, genero],
    queryFn: async () => {
      const res = await api.get('/productos', { params: { estacion: clientSeason === 'invierno' ? 'Invierno' : 'Verano', genero } });
      return res.data.products;
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-light)] pb-4">
        <div>
          <h1 className="text-3xl font-serif">Catálogo de Temporada</h1>
          <p className="text-xs text-neutral-500 uppercase tracking-widest mt-1">Colección {clientSeason} & Vanguardia</p>
        </div>
        <div className="flex gap-2">
          {['Hombre', 'Mujer', 'Unisex'].map((g) => (
            <button
              key={g}
              onClick={() => setGenero(g)}
              className={`px-4 py-2 text-xs font-bold uppercase rounded-md border min-h-10 ${
                genero === g ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]' : 'border-[var(--border-light)] text-[var(--text-main)]'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-sm font-serif">Cargando colección de moda...</div>
        ) : catalogData?.length ? (
          catalogData.map((p: any) => <ProductCard key={p.id} product={p} />)
        ) : (
          <div className="col-span-full py-12 text-center text-sm text-neutral-500">No hay prendas disponibles con stock para este filtro.</div>
        )}
      </div>
    </div>
  );
};
