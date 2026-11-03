import React from 'react';
import { useStore, SeasonType } from '../context/StoreContext';
import { ResponsiveCartDrawer } from './ResponsiveCartDrawer';
import { AdminPanel } from './AdminPanel';

export const ClientShop: React.FC = () => {
  const { season, setSeason, addToCart, cartCount, setIsCartOpen } = useStore();
  const [viewAdmin, setViewAdmin] = React.useState(false);

  const sampleCatalog = [
    { id: 'p1', variantId: 'v1', name: 'Camperita de Gamuza con Flecos', category: 'Camperitas', price: 85000, season: 'Ambas', size: 'M' },
    { id: 'p2', variantId: 'v2', name: 'Ojotas Anatómicas Summer', category: 'Ojotas', price: 15000, season: 'Verano', size: '41/42' },
    { id: 'p3', variantId: 'v3', name: 'Tapado Largo de Paño Inglés', category: 'Tapados', price: 145000, season: 'Invierno', size: 'L' },
    { id: 'p4', variantId: 'v4', name: 'Remera Algodón Pima', category: 'Remeras', price: 22000, season: 'Verano', size: 'M' }
  ];

  const visibleProducts = sampleCatalog.filter(p => season === 'Ambas' || p.season === season || p.season === 'Ambas');

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b sticky top-0 z-30 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="font-black text-lg">MODA OMEGA</h1>
          <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            {(['Ambas', 'Invierno', 'Verano'] as SeasonType[]).map(s => (
              <button key={s} onClick={() => setSeason(s)} className={`px-2.5 py-1 rounded ${season === s ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}>{s}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setViewAdmin(!viewAdmin)} className="text-xs font-bold text-slate-600 hover:text-black">Panel Admin</button>
          <button onClick={() => setIsCartOpen(true)} className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-full">Carrito ({cartCount})</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {viewAdmin ? <AdminPanel /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {visibleProducts.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase">{p.category} ({p.season})</span>
                  <h3 className="font-bold text-sm mt-1">{p.name}</h3>
                  <p className="text-base font-black my-2">${p.price.toLocaleString()}</p>
                </div>
                <button onClick={() => addToCart({ variantId: p.variantId, productId: p.id, productName: p.name, productSeason: p.season, categoryName: p.category, size: p.size, unitPrice: p.price })} className="w-full bg-slate-900 text-white text-xs font-bold py-2 rounded-lg hover:bg-indigo-600">
                  Agregar
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
      <ResponsiveCartDrawer />
    </div>
  );
};
