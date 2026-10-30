import React from 'react';
import { Link } from 'react-router-dom';

export const ProductCard = ({ product }: any) => {
  const price = product.precio_promocional || product.precio_base;
  return (
    <Link to={`/producto/${product.slug || product.id}`} className="group block space-y-3">
      <div className="relative overflow-hidden rounded-lg aspect-3/4 bg-neutral-100">
        <picture>
          <source type="image/avif" srcSet={`${product.imagen_url || ''}`} />
          <img
            src={product.imagen_url || 'https://images.unsplash.com/photo-1544441893-675973e31985?w=600'}
            alt={product.nombre}
            width={600}
            height={800}
            className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        </picture>
        {product.precio_promocional && (
          <span className="absolute top-3 left-3 px-2 py-0.5 text-xs font-bold rounded-sm uppercase tracking-wider bg-[var(--badge-discount-bg)] text-[var(--badge-discount-text)]">
            Oferta
          </span>
        )}
        <span className="absolute top-3 right-3 px-2 py-0.5 text-[10px] font-bold rounded-full bg-black/60 text-white uppercase backdrop-blur-xs">
          {product.estacion}
        </span>
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold tracking-tight text-[var(--text-main)] group-hover:text-[var(--accent-primary)] transition-colors">
          {product.nombre}
        </h3>
        <p className="text-xs text-neutral-500">{product.categoria_nombre}</p>
        <div className="flex items-baseline gap-2 pt-1">
          <span className="text-sm font-bold">${Number(price).toLocaleString('es-AR')}</span>
          {product.precio_promocional && (
            <span className="text-xs text-neutral-400 line-through">${Number(product.precio_base).toLocaleString('es-AR')}</span>
          )}
        </div>
      </div>
    </Link>
  );
};
