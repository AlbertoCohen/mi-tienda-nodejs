import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { SizeGuideModal } from './SizeGuideModal';
import { useCartStore } from '../../cart/cartStore';

export const ProductDetailPage = () => {
  const { id } = useParams();
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const addItem = useCartStore((s) => s.addItem);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const res = await api.get(`/productos/${id}`);
      return res.data;
    }
  });

  if (isLoading || !product) {
    return <div className="max-w-7xl mx-auto p-12 text-center text-sm font-serif">Cargando prenda exclusiva...</div>;
  }

  const activeVariant = selectedVariant || product.variantes?.find((v: any) => v.stock > 0) || product.variantes?.[0];

  const handleAdd = () => {
    if (activeVariant) {
      addItem(product, activeVariant);
      setAnnouncement(`Se agregó ${product.nombre}, talle ${activeVariant.talle}, al carrito.`);
      setTimeout(() => setAnnouncement(''), 3000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 transition-colors duration-400">
      <div aria-live="polite" className="sr-only">{announcement}</div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(product.imagenes?.length ? product.imagenes : [{ imagen_url: product.imagen_url }]).map((img: any, idx: number) => (
            <div key={idx} className="relative overflow-hidden rounded-lg aspect-3/4 bg-neutral-100">
              <img
                src={img.imagen_url || 'https://images.unsplash.com/photo-1544441893-675973e31985?w=600'}
                alt={product.nombre}
                width={600}
                height={800}
                className="w-full h-full object-cover object-center"
                loading={idx === 0 ? 'eager' : 'lazy'}
              />
            </div>
          ))}
        </div>

        <div className="lg:col-span-5 space-y-6 sticky top-28">
          <div className="space-y-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-full bg-[var(--badge-discount-bg)] text-white">
              Colección {product.estacion}
            </span>
            <h1 className="text-3xl font-serif text-[var(--text-main)]">{product.nombre}</h1>
            <div className="flex items-baseline gap-3 pt-2">
              <span className="text-2xl font-bold">${Number(product.precio_promocional || product.precio_base).toLocaleString('es-AR')}</span>
              {product.precio_promocional && (
                <span className="text-lg text-neutral-400 line-through">${Number(product.precio_base).toLocaleString('es-AR')}</span>
              )}
            </div>
          </div>

          <div className="prose prose-sm text-[var(--text-muted)] leading-relaxed border-y border-[var(--border-light)] py-4">
            <p className="font-serif italic text-base text-[var(--text-main)] mb-1">
              "La distinción reside en el movimiento: nobleza táctil, caída impecable y silueta contemporánea."
            </p>
            <p>{product.descripcion_copywriting || 'Diseño de alta costura confeccionado con materias primas seleccionadas.'}</p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">Talles:</span>
              <button onClick={() => setShowSizeGuide(true)} className="text-xs font-semibold text-[var(--accent-primary)] hover:underline min-h-8">
                Guía de Medidas (cm)
              </button>
            </div>
            <div className="flex flex-wrap gap-2.5" role="radiogroup">
              {product.variantes?.map((v: any) => {
                const available = v.stock > 0;
                const selected = activeVariant?.id === v.id;
                return (
                  <button
                    key={v.id}
                    disabled={!available}
                    onClick={() => setSelectedVariant(v)}
                    className={`min-w-12 h-12 px-3 flex items-center justify-center text-sm font-semibold rounded-md border transition-all ${
                      selected ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white' : available ? 'border-[var(--border-light)] text-[var(--text-main)]' : 'bg-neutral-100 text-neutral-400 line-through'
                    }`}
                  >
                    {v.talle}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={!activeVariant || activeVariant.stock <= 0}
            className="w-full h-14 bg-[var(--accent-primary)] text-white font-semibold text-sm uppercase tracking-wider rounded-md hover:opacity-90 active:scale-98 transition-all shadow-md flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            Agregar al Carrito
          </button>
        </div>
      </div>

      {showSizeGuide && <SizeGuideModal categoria={product.categoria_nombre} guia={product.guia_talles} onClose={() => setShowSizeGuide(false)} />}
    </div>
  );
};
