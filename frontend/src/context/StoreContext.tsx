import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

export type SeasonType = 'Invierno' | 'Verano' | 'Ambas';

export interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  productSeason: SeasonType;
  categoryName: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

interface StoreContextType {
  season: SeasonType;
  setSeason: (s: SeasonType) => void;
  cart: CartItem[];
  cartSubtotal: number;
  cartCount: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  addToCart: (item: any) => void;
  removeFromCart: (variantId: string) => void;
  appliedPromo: string | null;
  setAppliedPromo: (p: string | null) => void;
  user: any;
  setUser: (u: any) => void;
  sessionToken: string;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [season, setSeason] = useState<SeasonType>('Ambas');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [sessionToken, setSessionToken] = useState('');

  useEffect(() => {
    let tok = localStorage.getItem('cart_tok') || 'guest_' + Math.random().toString(36).slice(2);
    localStorage.setItem('cart_tok', tok);
    setSessionToken(tok);

    const savedUser = localStorage.getItem('user_session');
    if (savedUser) setUser(JSON.parse(savedUser));

    const params = new URLSearchParams(window.location.search);
    if (params.get('promo')) setAppliedPromo(params.get('promo')!.toUpperCase());
  }, []);

  const cartSubtotal = useMemo(() => cart.reduce((s, i) => s + i.lineTotal, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);

  const addToCart = (payload: any) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.variantId === payload.variantId);
      if (idx > -1) {
        const up = [...prev];
        up[idx].quantity += 1;
        up[idx].lineTotal = up[idx].quantity * up[idx].unitPrice;
        return up;
      }
      return [...prev, {
        variantId: payload.variantId,
        productId: payload.productId,
        productName: payload.productName,
        productSeason: payload.productSeason || 'Ambas',
        categoryName: payload.categoryName || 'General',
        size: payload.size,
        color: payload.color,
        unitPrice: parseFloat(payload.unitPrice),
        quantity: 1,
        lineTotal: parseFloat(payload.unitPrice)
      }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (vId: string) => setCart(prev => prev.filter(i => i.variantId !== vId));

  return (
    <StoreContext.Provider value={{
      season, setSeason, cart, cartSubtotal, cartCount, isCartOpen, setIsCartOpen,
      addToCart, removeFromCart, appliedPromo, setAppliedPromo, user, setUser, sessionToken
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore debe usarse dentro de StoreProvider');
  return ctx;
};
