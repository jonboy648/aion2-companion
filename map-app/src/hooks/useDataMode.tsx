// src/hooks/useDataMode.tsx  (static-only: no toggling, no backend)
import {createContext, useCallback, useContext, useMemo, type ReactNode} from "react";
import {type DataMode, DEFAULT_DATA_MODE, computeExportBaseUrl} from "@/utils/dataMode";

type DataModeContextValue = {
  dataMode: DataMode;
  getBaseUrl: () => string;
};

const DataModeContext = createContext<DataModeContextValue | undefined>(undefined);

export function DataModeProvider({children}: { children: ReactNode }) {
  const getBaseUrl = useCallback(() => computeExportBaseUrl(DEFAULT_DATA_MODE), []);
  const value = useMemo<DataModeContextValue>(
    () => ({dataMode: DEFAULT_DATA_MODE, getBaseUrl}),
    [getBaseUrl],
  );
  return <DataModeContext.Provider value={value}>{children}</DataModeContext.Provider>;
}

export function useDataMode(): DataModeContextValue {
  const ctx = useContext(DataModeContext);
  if (!ctx) throw new Error("useDataMode must be used within a DataModeProvider");
  return ctx;
}
