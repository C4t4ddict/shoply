(function (root) {
  "use strict";

  const TRACKING_PARAMS = [
    /^utm_/i,
    /^n_(?:media|query|rank|ad_group|ad|campaign)/i,
    /^(?:fbclid|gclid|wbraid|gbraid|NaPm)$/i
  ];

  function parsePrice(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
    }
    if (typeof value !== "string") return null;

    const normalized = value
      .replace(/\u00a0/g, " ")
      .replace(/(?:KRW|₩|원)/gi, "")
      .trim();
    const matches = normalized.match(/\d[\d,.]*/g);
    if (!matches?.length) return null;

    const token = matches
      .map((candidate) => candidate.replace(/[^\d]/g, ""))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)[0];
    if (!token) return null;

    const parsed = Number(token);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatPrice(value, currency = "KRW") {
    const amount = Number(value) || 0;
    try {
      return new Intl.NumberFormat("ko-KR", {
        style: "currency",
        currency,
        maximumFractionDigits: currency === "KRW" ? 0 : 2
      }).format(amount);
    } catch {
      return `${amount.toLocaleString("ko-KR")} ${currency}`;
    }
  }

  function normalizeUrl(value) {
    try {
      const url = new URL(value);
      url.hash = "";
      for (const key of [...url.searchParams.keys()]) {
        if (TRACKING_PARAMS.some((pattern) => pattern.test(key))) {
          url.searchParams.delete(key);
        }
      }
      return url.toString();
    } catch {
      return String(value || "");
    }
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function calculateCategoryTotal(items, categoryId) {
    return (items || [])
      .filter((item) => item.categoryId === categoryId)
      .reduce((sum, item) => {
        const price = Number(item.price) || 0;
        const quantity = Math.max(1, Number(item.quantity) || 1);
        return sum + price * quantity;
      }, 0);
  }

  function sameOptions(left, right) {
    return JSON.stringify(left || {}) === JSON.stringify(right || {});
  }

  function siteNameFromHost(hostname) {
    const host = String(hostname || "").toLowerCase();
    if (host.includes("a-bly.com") || host.includes("ably.co.kr")) return "에이블리";
    if (host.includes("musinsa.com")) return "무신사";
    if (host.includes("coupang.com")) return "쿠팡";
    if (host.includes("naver.com")) return "네이버 쇼핑";
    return host.replace(/^www\./, "") || "쇼핑몰";
  }

  const api = {
    calculateCategoryTotal,
    formatPrice,
    normalizeText,
    normalizeUrl,
    parsePrice,
    sameOptions,
    siteNameFromHost
  };

  root.ShoplyCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
