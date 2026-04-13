import React, { createContext, useCallback, useContext, useMemo } from 'react';

type TrustCtx = {
  /** Yolculuk güven / puanlama tetikleyicisi; backend bağlandığında burada çağrılır. */
  requestTrust: (tagId: string) => Promise<void>;
};

const TrustContext = createContext<TrustCtx | null>(null);

export function TrustProvider({ children }: { children: React.ReactNode }) {
  const requestTrust = useCallback(async (_tagId: string) => {
    /* no-op until trust API is wired */
  }, []);
  const value = useMemo(() => ({ requestTrust }), [requestTrust]);
  return <TrustContext.Provider value={value}>{children}</TrustContext.Provider>;
}

export function useTrust(): TrustCtx {
  const v = useContext(TrustContext);
  if (!v) {
    throw new Error('useTrust must be used within TrustProvider');
  }
  return v;
}
