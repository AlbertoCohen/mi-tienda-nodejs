import React from 'react';
import { StoreProvider } from './context/StoreContext';
import { ClientShop } from './components/ClientShop';

export const App: React.FC = () => {
  return (
    <StoreProvider>
      <ClientShop />
    </StoreProvider>
  );
};
export default App;
