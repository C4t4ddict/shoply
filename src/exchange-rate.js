(function (root, factory) {
  const api = factory();
  root.ShoplyExchangeRate = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CACHE_KEY = "shoplyExchangeRates";
  const FRESH_MS = 24 * 60 * 60 * 1000;
  const STALE_MS = 7 * 24 * 60 * 60 * 1000;

  function createService({ fetchFn, storage, now = () => Date.now(), timeoutMs = 5000 }) {
    const pending = new Map();

    async function readCache() {
      const result = await storage.get(CACHE_KEY);
      return result?.[CACHE_KEY] || {};
    }

    async function writeCache(cache) {
      await storage.set({ [CACHE_KEY]: cache });
    }

    function cachedResult(entry, status) {
      return { ...entry, status };
    }

    async function fetchRate(currency) {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        const response = await fetchFn(`https://api.frankfurter.dev/v2/rate/${currency}/KRW`, {
          signal: controller?.signal
        });
        if (!response.ok) throw new Error(`환율 API 오류 (${response.status})`);
        const data = await response.json();
        const rateToKrw = Number(data?.rate);
        if (!Number.isFinite(rateToKrw) || rateToKrw <= 0) throw new Error("환율 응답이 올바르지 않습니다.");
        const entry = {
          rateToKrw,
          rateDate: String(data.date || ""),
          fetchedAt: now(),
          source: "frankfurter-v2"
        };
        const cache = await readCache();
        cache[currency] = entry;
        await writeCache(cache);
        return cachedResult(entry, "live");
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    async function getRate(currency) {
      const code = String(currency || "").toUpperCase();
      if (code === "KRW") {
        return { rateToKrw: 1, rateDate: "", fetchedAt: now(), source: "native-krw", status: "live" };
      }
      if (!/^[A-Z]{3}$/.test(code)) throw new Error("통화 코드를 확인해주세요.");

      const cache = await readCache();
      const entry = cache[code];
      const age = entry ? now() - Number(entry.fetchedAt || 0) : Infinity;
      if (age <= FRESH_MS) return cachedResult(entry, "cached");
      if (pending.has(code)) return pending.get(code);

      const request = fetchRate(code).catch((error) => {
        if (entry && age <= STALE_MS) return cachedResult(entry, "stale");
        throw error;
      }).finally(() => pending.delete(code));
      pending.set(code, request);
      return request;
    }

    async function convertProduct(product) {
      const currency = String(product?.currency || "KRW").toUpperCase();
      if (currency === "KRW") {
        return { ...product, currency, krwPrice: Math.round(Number(product.price) || 0), fx: null };
      }
      const fx = await getRate(currency);
      return {
        ...product,
        currency,
        krwPrice: Math.round((Number(product.price) || 0) * fx.rateToKrw),
        fx
      };
    }

    return { convertProduct, getRate };
  }

  return { CACHE_KEY, FRESH_MS, STALE_MS, createService };
});
