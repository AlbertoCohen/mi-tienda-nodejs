import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useCartStore } from '../../features/cart/cartStore';
import { CartDrawer } from '../../features/cart/components/CartDrawer';
import { useThemeStore } from '../../features/theme/themeStore';

export const StoreLayout = () => {
  const { items, openDrawer } = useCartStore();
  const { clientSeason, setClientSeason } = useThemeStore();

  return (
    <div className="min-h-[100svh] flex flex-col transition-colors duration-400">
      <header className="sticky top-0 z-40 bg-[var(--bg-surface)]/90 backdrop-blur-md border-b border-[var(--border-light)]" style={{ WebkitBackdropFilter: 'blur(16px)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="text-2xl font-serif font-bold tracking-tight text-[var(--text-main)]">
            HAUTE ÉLITE
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
            <Link to="/tienda?genero=Hombre" className="hover:text-[var(--accent-primary)] transition-colors">Hombre</Link>
            <Link to="/tienda?genero=Mujer" className="hover:text-[var(--accent-primary)] transition-colors">Mujer</Link>
            <Link to="/tienda?genero=Unisex" className="hover:text-[var(--accent-primary)] transition-colors">Unisex</Link>
          </nav>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setClientSeason(clientSeason === 'verano' ? 'invierno' : 'verano')}
              className="text-xs font-bold uppercase px-3 py-1.5 rounded-full border border-[var(--border-light)] hover:bg-neutral-500/10 transition-colors min-h-10"
            >
              {clientSeason === 'verano' ? '☀️ Verano' : '❄️ Invierno'}
            </button>
            <button
              onClick={openDrawer}
              className="relative p-2.5 text-[var(--text-main)] hover:text-[var(--accent-primary)] transition-colors min-h-12 min-w-12 flex items-center justify-center"
              aria-label="Abrir carrito de compras"
            >
              🛍️
              {items.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-[var(--accent-primary)] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {items.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <CartDrawer />

      <footer className="border-t border-[var(--border-light)] py-10 bg-[var(--bg-surface)] text-xs text-neutral-500 text-center">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-serif font-bold text-[var(--text-main)] text-sm">HAUTE ÉLITE FASHION GROUP</p>
          <p>© 2026 Todos los derechos reservados. Facturación oficial integrada con ARCA & Mercado Pago.</p>
        </div>
      </footer>
    </div>
  );
};
