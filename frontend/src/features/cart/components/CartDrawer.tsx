import React, { useEffect } from 'react';
import { useCartStore } from '../cartStore';
import { useThemeStore } from '../../theme/themeStore';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { api } from '../../../lib/axios';

export const CartDrawer = () => {
  const { items, subtotal, discount, total, isDrawerOpen, closeDrawer, removeItem, updateQuantity } = useCartStore();
  const { clientSeason, setClientSeason } = useThemeStore();
  const trapRef = useFocusTrap({ isOpen: isDrawerOpen, onClose: closeDrawer });

  const ENVIO_GRATIS = 150000;
  const progress = Math.min((total / ENVIO_GRATIS) * 100, 100);

  useEffect(() => {
    if (isDrawerOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      const top = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      if (top) window.scrollTo(0, parseInt(top || '0') * -1);
    }
  }, [isDrawerOpen]);

  if (!isDrawerOpen) return null;

  const handleCheckout = async () => {
    try {
      const res = await api.post('/carrito/checkout', {
        items: items.map(i => ({
          variante_id: i.variante_id,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario
        })),
        idempotencyKey: crypto.randomUUID(),
        datosEnvio: { email: 'cliente@ejemplo.com', nombre: 'Cliente' }
      });
      if (res.data.initPoint) {
        window.location.href = res.data.initPoint;
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al iniciar checkout');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={closeDrawer} />
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div ref={trapRef} className="w-screen max-w-md bg-[var(--bg-surface)] text-[var(--text-main)] shadow-2xl flex flex-col h-[100dvh]">
          
          <div className="p-5 border-b border-[var(--border-light)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="drawer-title" className="text-xl font-serif">Tu Carrito ({items.length})</h2>
              <button onClick={closeDrawer} className="p-2 text-neutral-400 hover:text-neutral-700 min-w-12 min-h-12 flex items-center justify-center">✕</button>
            </div>

            <div className="flex items-center justify-between bg-neutral-100 dark:bg-neutral-800 p-2 rounded-lg text-xs">
              <span className="font-semibold text-neutral-500">Temporada en vista:</span>
              <div className="flex bg-[var(--bg-surface)] rounded-md p-0.5 border border-[var(--border-light)]">
                <button
                  onClick={() => setClientSeason('verano')}
                  className={`px-3 py-1.5 rounded-sm font-bold min-h-8 ${clientSeason === 'verano' ? 'bg-[var(--accent-primary)] text-white' : 'text-neutral-500'}`}
                >
                  Verano
                </button>
                <button
                  onClick={() => setClientSeason('invierno')}
                  className={`px-3 py-1.5 rounded-sm font-bold min-h-8 ${clientSeason === 'invierno' ? 'bg-[var(--accent-primary)] text-white' : 'text-neutral-500'}`}
                >
                  Invierno
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span>{progress >= 100 ? '¡Envío Gratis Bonificado!' : `Faltan $${(ENVIO_GRATIS - total).toLocaleString('es-AR')} para envío gratis`}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 divide-y divide-[var(--border-light)]" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
            {items.map((it) => (
              <div key={it.variante_id} className="pt-4 flex gap-4">
                <img src={it.imagen_url} alt={it.nombre} width={80} height={96} className="w-20 h-24 object-cover rounded-md bg-neutral-100" />
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between">
                    <h3 className="text-sm font-semibold">{it.nombre}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">{it.estacion_item}</span>
                  </div>
                  <p className="text-xs text-neutral-500">Talle: {it.talle} | Color: {it.color}</p>
                  <div className="flex justify-between items-center pt-2">
                    <div className="flex items-center border border-[var(--border-light)] rounded-md touch-stepper">
                      <button onClick={() => updateQuantity(it.variante_id, it.cantidad - 1)} className="w-9 h-9 flex items-center justify-center font-bold text-sm">-</button>
                      <span className="px-2 text-xs font-bold">{it.cantidad}</span>
                      <button onClick={() => updateQuantity(it.variante_id, it.cantidad + 1)} className="w-9 h-9 flex items-center justify-center font-bold text-sm">+</button>
                    </div>
                    <span className="text-sm font-bold">${Number(it.precio_unitario * it.cantidad).toLocaleString('es-AR')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-5 border-t border-[var(--border-light)] bg-neutral-50 dark:bg-neutral-900 space-y-3" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">Subtotal</span>
              <span>${subtotal.toLocaleString('es-AR')}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2 border-t border-[var(--border-light)]">
              <span>Total Final</span>
              <span>${total.toLocaleString('es-AR')}</span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={items.length === 0}
              className="w-full h-13 bg-[var(--accent-primary)] text-white font-semibold text-sm uppercase tracking-wider rounded-md flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            >
              Pagar con Mercado Pago / Tarjetas
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
