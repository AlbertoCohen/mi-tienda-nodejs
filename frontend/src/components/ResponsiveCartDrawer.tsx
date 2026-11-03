import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';

export const ResponsiveCartDrawer: React.FC = () => {
  const { cart, cartSubtotal, removeFromCart, isCartOpen, setIsCartOpen, appliedPromo } = useStore();
  const [cp, setCp] = useState('');
  const [quotes, setQuotes] = useState<any[]>([]);
  const [selectedShip, setSelectedShip] = useState<any>(null);
  const [needsInvoice, setNeedsInvoice] = useState(false);
  const [cuit, setCuit] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isCartOpen) return null;

  const quote = async () => {
    if (!cp) return;
    try {
      const res = await fetch('/api/logistics/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinationZip: cp, items: cart })
      });
      const d = await res.json();
      if (d.quotes) { setQuotes(d.quotes); setSelectedShip(d.quotes[0]); }
    } catch (e) {}
  };

  const checkout = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fintech/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartId: 'c1',
          shippingAddress: { street: 'Calle Falsa 123', zipCode: cp, email: 'comprador@moda.com' },
          shippingCost: selectedShip?.cost || 0,
          appliedPromoCode: appliedPromo,
          needsInvoice,
          fiscalData: { cuitOrDni: cuit }
        })
      });
      const d = await res.json();
      alert(`Orden generada: ${d.orderNumber}. Redirigiendo a pasarela MercadoPago...`);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end">
      <div className="w-full sm:max-w-md bg-white viewport-drawer flex flex-col justify-between p-4 shadow-2xl">
        <div>
          <div className="flex justify-between items-center pb-3 border-b">
            <h3 className="font-bold text-base">Carrito Unificado</h3>
            <button onClick={() => setIsCartOpen(false)} className="text-slate-500 font-bold">✕</button>
          </div>
          <div className="divide-y max-h-56 overflow-y-auto my-3">
            {cart.map(i => (
              <div key={i.variantId} className="py-2 flex justify-between text-xs">
                <div>
                  <p className="font-semibold">{i.productName}</p>
                  <p className="text-slate-500">{i.size} | {i.productSeason}</p>
                  <p className="font-bold">${i.unitPrice} x {i.quantity}</p>
                </div>
                <button onClick={() => removeFromCart(i.variantId)} className="text-red-500 font-bold">Quitar</button>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border my-2 text-xs">
            <span className="font-bold block mb-1">Calcular Envío (Andreani / PAQ.AR):</span>
            <div className="flex gap-2">
              <input value={cp} onChange={e => setCp(e.target.value)} placeholder="CP: 1425" className="border p-1.5 rounded flex-1" />
              <button onClick={quote} className="bg-slate-900 text-white px-3 py-1 rounded font-bold">Cotizar</button>
            </div>
            {quotes.map((q, idx) => (
              <label key={idx} className="flex justify-between mt-1 cursor-pointer">
                <span><input type="radio" checked={selectedShip?.serviceType === q.serviceType} onChange={() => setSelectedShip(q)} /> {q.serviceName}</span>
                <span className="font-bold">${q.cost}</span>
              </label>
            ))}
          </div>

          <div className="bg-amber-50 p-2.5 rounded-lg border text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-900">
              <input type="checkbox" checked={needsInvoice} onChange={e => setNeedsInvoice(e.target.checked)} />
              Solicitar Factura Fiscal (ARCA)
            </label>
            {needsInvoice && (
              <input value={cuit} onChange={e => setCuit(e.target.value)} placeholder="CUIT/DNI (11 dígitos)" className="w-full border p-1.5 rounded mt-2" />
            )}
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="flex justify-between font-black text-sm mb-3">
            <span>Total:</span>
            <span>${cartSubtotal + (selectedShip?.cost || 0)}</span>
          </div>
          <button onClick={checkout} disabled={cart.length === 0 || loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg text-xs hover:bg-blue-700">
            {loading ? 'Procesando...' : 'Pagar con MercadoPago'}
          </button>
        </div>
      </div>
    </div>
  );
};
