import { type ReactNode } from 'react';

import { StoreContext, useStorePlugin } from './storeContext';

export default function StoreProvider({ children }: { children: ReactNode }) {
  const store = useStorePlugin();

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
