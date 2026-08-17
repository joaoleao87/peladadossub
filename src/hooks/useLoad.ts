import { useCallback, useEffect, useRef, useState } from "react";

export function useLoad<T>(loader: () => Promise<T>, key: unknown = "") {
  const loaderRef = useRef(loader),
    loadedKey = useRef<string>();
  loaderRef.current = loader;
  const stableKey = JSON.stringify(key),
    [data, setData] = useState<T>(),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const firstLoad = loadedKey.current !== stableKey;
    if (firstLoad) setLoading(true);
    setError("");
    try {
      setData(await loaderRef.current());
      loadedKey.current = stableKey;
    } catch (err) {
      if (firstLoad)
        setError(err instanceof Error ? err.message : "Falha ao carregar.");
    } finally {
      if (firstLoad) setLoading(false);
    }
  }, [stableKey]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, error, loading, reload: load };
}
