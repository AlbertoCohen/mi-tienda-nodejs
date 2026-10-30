import { create } from 'zustand';

export interface CartItem {
  id: string;
  variante_id: string;
  nombre: string;
  talle: string;
  color: string;
  cantidad: number;
  precio_unitario: number;
  estacion_item: string;
  imagen_url: string;
}

interface CartState {
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (product: any, variant: any) => void;
  updateQuantity: (varianteId: string, qty: number) => void;
  removeItem: (varianteId: string) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  subtotal: 0,
  discount: 0,
  total: 0,
  isDrawerOpen: false,

  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),

  addItem: (product, variant) => {
    const items = [...get().items];
    const existing = items.find((i) => i.variante_id === variant.id);
    const unitPrice = Number(product.precio_promocional || product.precio_base);

    if (existing) {
      existing.cantidad += 1;
    } else {
      items.push({
        id: crypto.randomUUID(),
        variante_id: variant.id,
        nombre: product.nombre,
        talle: variant.talle,
        color: variant.color,
        cantidad: 1,
        precio_unitario: unitPrice,
        estacion_item: product.estacion,
        imagen_url: product.imagenes?.[0]?.imagen_url || product.imagen_url || ''
      });
    }

    const sub = items.reduce((acc, it) => acc + it.precio_unitario * it.cantidad, 0);
    set({ items, subtotal: sub, total: sub, isDrawerOpen: true });
  },

  updateQuantity: (varianteId, qty) => {
    let items = [...get().items];
    if (qty <= 0) {
      items = items.filter((i) => i.variante_id !== varianteId);
    } else {
      const it = items.find((i) => i.variante_id === varianteId);
      if (it) it.cantidad = qty;
    }
    const sub = items.reduce((acc, it) => acc + it.precio_unitario * it.cantidad, 0);
    set({ items, subtotal: sub, total: sub });
  },

  removeItem: (varianteId) => {
    const items = get().items.filter((i) => i.variante_id !== varianteId);
    const sub = items.reduce((acc, it) => acc + it.precio_unitario * it.cantidad, 0);
    set({ items, subtotal: sub, total: sub });
  },

  clearCart: () => set({ items: [], subtotal: 0, discount: 0, total: 0 })
}));
