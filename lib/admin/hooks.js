"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/admin/format";

/**
 * Asenkron veri yükleyici. `interval` (ms) verilirse sayfa görünürken
 * belirtilen aralıkta sessizce yeniler (polling).
 *
 * loader: async () => veri
 * deps: loader'ın bağımlılıkları (değişince yeniden yüklenir)
 */
export function useAsyncData(loader, deps = [], { interval = 0 } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(null);
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  });

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const result = await loaderRef.current();
        if (cancelled) return;
        setData(result);
        setError("");
        setUpdatedAt(new Date());
      } catch (e) {
        if (!cancelled) setError(errorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    let timer;
    if (interval > 0) {
      timer = setInterval(() => {
        if (document.visibilityState === "visible") run();
      }, interval);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, interval]);

  return { data, error, loading, reload, updatedAt };
}

/** Değeri gecikmeli döndürür (arama kutuları için). */
export function useDebounced(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
