(function (root) {
  "use strict";

  const TRACKING_PARAMS = [
    /^utm_/i,
    /^n_(?:media|query|rank|ad_group|ad|campaign)/i,
    /^(?:fbclid|gclid|wbraid|gbraid|NaPm)$/i
  ];

  const ZERO_DECIMAL_CURRENCIES = new Set(["KRW", "JPY"]);

  function parseMoney(value, currency = "KRW") {
    const code = String(currency || "KRW").toUpperCase();
    if (typeof value === "number") {
      if (!Number.isFinite(value) || value < 0) return null;
      return ZERO_DECIMAL_CURRENCIES.has(code) ? Math.round(value) : value;
    }
    if (typeof value !== "string") return null;

    const normalized = value
      .replace(/\u00a0/g, " ")
      .replace(/(?:KRW|USD|JPY|CNY|EUR|GBP|CAD|AUD|TWD|US\s*\$|CN\s*¥|₩|원|[$¥€£])/gi, "")
      .trim();
    const matches = normalized.match(/\d[\d\s,.]*/g);
    if (!matches?.length) return null;

    const values = matches.map((candidate) => {
      let token = candidate.replace(/\s/g, "").replace(/[^\d,.]/g, "");
      if (!token) return null;
      if (ZERO_DECIMAL_CURRENCIES.has(code)) token = token.replace(/[^\d]/g, "");
      else {
        const lastComma = token.lastIndexOf(",");
        const lastDot = token.lastIndexOf(".");
        const separator = Math.max(lastComma, lastDot);
        const decimalDigits = separator >= 0 ? token.length - separator - 1 : 0;
        if (separator >= 0 && decimalDigits > 0 && decimalDigits <= 2) {
          token = `${token.slice(0, separator).replace(/[^\d]/g, "")}.${token.slice(separator + 1).replace(/[^\d]/g, "")}`;
        } else token = token.replace(/[^\d]/g, "");
      }
      const parsed = Number(token);
      return Number.isFinite(parsed) ? parsed : null;
    }).filter((candidate) => candidate !== null);
    if (!values.length) return null;

    return Math.max(...values);
  }

  function parsePrice(value) {
    return parseMoney(value, "KRW");
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

  function normalizeUrl(value, base) {
    if (!String(value || "").trim()) return "";
    try {
      const url = new URL(value, base);
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

  function normalizeImageUrl(value, base) {
    const candidate = Array.isArray(value) ? value[0] : value;
    const raw = candidate?.url || candidate?.contentUrl || candidate;
    if (typeof raw !== "string" || !raw.trim()) return "";
    const normalized = normalizeUrl(raw.trim(), base);
    return /^https?:\/\//i.test(normalized) ? normalized : "";
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function calculateCategoryTotal(items, categoryId) {
    return (items || [])
      .filter((item) => item.categoryId === categoryId)
      .reduce((sum, item) => {
        const price = Number(item.krwPrice ?? (item.currency === "KRW" || !item.currency ? item.price : 0)) || 0;
        const quantity = Math.max(1, Number(item.quantity) || 1);
        return sum + price * quantity;
      }, 0);
  }

  function productPriceFields(product) {
    const currency = String(product?.currency || "KRW").toUpperCase();
    const price = Number(product?.price) || null;
    const krwPrice = Number(product?.krwPrice ?? (currency === "KRW" ? price : null)) || null;
    return { currency, price, krwPrice, isForeign: currency !== "KRW" };
  }

  function sameOptions(left, right) {
    return JSON.stringify(left || {}) === JSON.stringify(right || {});
  }

  function siteNameFromHost(hostname) {
    const host = String(hostname || "").toLowerCase();
    const matches = (domain) => host === domain || host.endsWith(`.${domain}`);
    const sites = [
      [["a-bly.com", "ably.co.kr"], "에이블리"], [["musinsa.com"], "무신사"],
      [["coupang.com"], "쿠팡"], [["naver.com"], "네이버 쇼핑"], [["29cm.co.kr"], "29CM"],
      [["wconcept.co.kr"], "W컨셉"], [["zigzag.kr"], "지그재그"], [["kream.co.kr"], "KREAM"],
      [["11st.co.kr"], "11번가"], [["gmarket.co.kr"], "G마켓"], [["ssg.com"], "SSG.COM"],
      [["lotteon.com"], "롯데ON"], [["auction.co.kr"], "옥션"], [["aliexpress.com"], "AliExpress"],
      [["temu.com"], "Temu"], [["amazon.com"], "Amazon"], [["amazon.co.jp"], "Amazon Japan"],
      [["iherb.com"], "iHerb"], [["shein.com"], "SHEIN"], [["ebay.com"], "eBay"], [["newegg.com"], "Newegg"]
    ];
    for (const [domains, name] of sites) {
      if (domains.some(matches)) return name;
    }
    return host.replace(/^www\./, "") || "쇼핑몰";
  }

  const api = {
    calculateCategoryTotal,
    formatPrice,
    normalizeText,
    normalizeImageUrl,
    normalizeUrl,
    parseMoney,
    parsePrice,
    productPriceFields,
    sameOptions,
    siteNameFromHost
  };

  root.ShoplyCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
