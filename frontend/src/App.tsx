import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useThemeStore } from './features/theme/themeStore';
import { StoreLayout } from './components/layout/StoreLayout';
import { BackofficeLayout } from './components/layout/BackofficeLayout';
import { CatalogPage } from './features/catalog/components/CatalogPage';
import { ProductDetailPage } from './features/catalog/components/ProductDetailPage';
import { AdminFinanceDashboard } from './features/admin/components/AdminFinanceDashboard';
import { AdminPermissions } from './features/admin/components/AdminPermissions';
import { AdminProductsPage } from './features/admin/components/AdminProductsPage';
import { api } from './lib/axios';

export default function App() {
  const initializeTheme = useThemeStore((state) => state.initializeTheme);

  useEffect(() => {
    api.get('/productos/geo').then((res) => {
      const { season, activeEvents } = res.data;
      const event = activeEvents?.[0]?.theme || 'ninguno';
      initializeTheme(season.toLowerCase(), event);
    }).catch(() => {
      initializeTheme('verano', 'ninguno');
    });
  }, [initializeTheme]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Storefront Routes */}
        <Route element={<StoreLayout />}>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/tienda" element={<CatalogPage />} />
          <Route path="/producto/:id" element={<ProductDetailPage />} />
        </Route>

        {/* Backoffice Routes */}
        <Route path="/admin" element={<BackofficeLayout />}>
          <Route index element={<Navigate to="/admin/finanzas" replace />} />
          <Route path="finanzas" element={<AdminFinanceDashboard />} />
          <Route path="productos" element={<AdminProductsPage />} />
          <Route path="permisos" element={<AdminPermissions />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
