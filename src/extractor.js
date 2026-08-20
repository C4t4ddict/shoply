(function (root) {
  "use strict";

  const Core = root.ShoplyCore;
  const HOST = String(root.location?.hostname || "").toLowerCase();

  const ADAPTERS = [
    {
      id: "ably",
      name: "에이블리",
      matches: (host) => host.includes("a-bly.com") || host.includes("ably.co.kr"),
      title: ["h1", "[data-testid*='product-name']", "[class*='ProductName']", "[class*='product-name']"],
      price: ["[data-testid*='price']", "[class*='ProductPrice']", "[class*='product-price']", "[class*='sale-price']"]
    },
    {
      id: "musinsa",
      name: "무신사",
      matches: (host) => host.includes("musinsa.com"),
      title: ["h1", "[data-testid*='product-name']", "[class*='ProductTitle']", "[class*='product_title']"],
      price: ["[data-testid*='price']", "[class*='Price']", "[class*='price']"]
    },
    {
      id: "coupang",
      name: "쿠팡",
      matches: (host) => host.includes("coupang.com"),
      title: ["h1.prod-buy-header__title", ".prod-buy-header__title", "h1"],
      price: [".prod-sale-price .total-price", ".prod-price .total-price", ".price-value", "[class*='final-price']"]
    },
    {
      id: "naver",
      name: "네이버 쇼핑",
      matches: (host) => host.includes("naver.com"),
      title: ["h1", "[data-testid*='product-name']", "[class*='product_title']", "[class*='ProductTitle']"],
      price: ["[data-testid*='price']", "[class*='sale_price']", "[class*='price']", "[class*='Price']"]
    },
    {
      id: "generic",
      name: null,
      matches: () => true,
      title: ["main h1", "article h1", "h1", "[itemprop='name']"],
      price: ["[itemprop='price']", "[data-price]", "[class*='sale-price']", "[class*='product-price']", "[class*='price']"]
    }
  ];

  function adapterForHost(hostname) {
    const host = String(hostname || "").toLowerCase();
    return ADAPTERS.find((candidate) => candidate.matches(host));
  }

  function adapter() {
    return adapterForHost(HOST);
  }

  function visible(element) {
    if (!element || !(element instanceof Element)) return false;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function firstVisible(selectors) {
    for (const selector of selectors) {
      try {
        const element = [...document.querySelectorAll(selector)].find(visible);
        if (element) return element;
      } catch {
        // Ignore selectors unsupported by a particular page.
      }
    }
    return null;
  }

  function meta(...keys) {
    for (const key of keys) {
      const selector = `meta[property="${CSS.escape(key)}"], meta[name="${CSS.escape(key)}"]`;
      const value = document.querySelector(selector)?.content;
      if (value) return Core.normalizeText(value);
    }
    return "";
  }

  function jsonLdObjects() {
    const objects = [];
    const visit = (value) => {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (typeof value !== "object") return;
      objects.push(value);
      if (Array.isArray(value["@graph"])) value["@graph"].forEach(visit);
    };

    document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      try {
        visit(JSON.parse(script.textContent));
      } catch {
        // Invalid merchant JSON-LD should not stop the remaining strategies.
      }
    });
    return objects;
  }

  function hasType(object, expected) {
    const type = object?.["@type"];
    return (Array.isArray(type) ? type : [type]).some(
      (value) => String(value || "").toLowerCase() === expected.toLowerCase()
    );
  }

  function wordOverlap(left, right) {
    const words = (value) =>
      new Set(Core.normalizeText(value).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1));
    const a = words(left);
    const b = words(right);
    if (!a.size || !b.size) return 0;
    let overlap = 0;
    a.forEach((word) => {
      if (b.has(word)) overlap += 1;
    });
    return overlap / Math.min(a.size, b.size);
  }

  function extractOffer(offers) {
    const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
    const sorted = list.sort((left, right) => {
      const leftUrl = Core.normalizeUrl(left?.url || "");
      const rightUrl = Core.normalizeUrl(right?.url || "");
      const current = Core.normalizeUrl(location.href);
      return Number(rightUrl === current) - Number(leftUrl === current);
    });

    for (const offer of sorted) {
      const price = Core.parsePrice(offer?.price ?? offer?.lowPrice ?? offer?.priceSpecification?.price);
      if (!price) continue;
      const specifications = Array.isArray(offer.priceSpecification)
        ? offer.priceSpecification
        : offer.priceSpecification
          ? [offer.priceSpecification]
          : [];
      const strike = specifications.find((specification) =>
        /strikethrough|listprice/i.test(String(specification?.priceType || ""))
      );
      return {
        price,
        originalPrice: Core.parsePrice(strike?.price),
        currency: offer.priceCurrency || offer.priceSpecification?.priceCurrency || "KRW"
      };
    }
    return null;
  }

  function structuredCandidate(titleHint) {
    const products = jsonLdObjects().filter((object) => hasType(object, "Product"));
    let best = null;
    for (const product of products) {
      const offer = extractOffer(product.offers);
      if (!offer) continue;
      let score = 75;
      score += Math.round(wordOverlap(product.name, titleHint) * 30);
      const productUrl = Core.normalizeUrl(product.url || product.offers?.url || "");
      if (productUrl && productUrl === Core.normalizeUrl(location.href)) score += 25;
      const image = Array.isArray(product.image) ? product.image[0] : product.image?.url || product.image;
      const candidate = {
        ...offer,
        title: Core.normalizeText(product.name),
        imageUrl: image || "",
        score,
        method: "json-ld"
      };
      if (!best || candidate.score > best.score) best = candidate;
    }
    return best;
  }

  function distanceScore(element, anchor) {
    if (!element || !anchor) return 0;
    if (element.closest("main, article") && element.closest("main, article") === anchor.closest("main, article")) return 12;
    const left = element.getBoundingClientRect();
    const right = anchor.getBoundingClientRect();
    const distance = Math.hypot(left.x - right.x, left.y - right.y);
    if (distance < 250) return 18;
    if (distance < 600) return 10;
    return 0;
  }

  function priceElements(siteAdapter) {
    const elements = new Set();
    const selectors = [
      ...siteAdapter.price,
      "[itemprop='price']",
      "[data-price]",
      "[class*='price']",
      "[class*='Price']",
      "del",
      "s"
    ];
    selectors.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((element) => {
          if (visible(element) && Core.parsePrice(element.getAttribute("content") || element.textContent)) elements.add(element);
        });
      } catch {
        // Continue with the generic text walker.
      }
    });

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    let inspected = 0;
    while ((node = walker.nextNode()) && inspected < 12000) {
      inspected += 1;
      const text = Core.normalizeText(node.nodeValue);
      if (text.length <= 70 && /(?:₩\s*\d|\d[\d,\.]*\s*원\b)/.test(text) && visible(node.parentElement)) {
        elements.add(node.parentElement);
      }
    }
    return [...elements];
  }

  function domPriceCandidate(siteAdapter, titleElement) {
    const purchaseButtons = [...document.querySelectorAll("button, a")].filter((element) => {
      const text = Core.normalizeText(element.textContent);
      return visible(element) && /구매|장바구니|바로구매|buy|add to cart/i.test(text);
    });

    let best = null;
    for (const element of priceElements(siteAdapter)) {
      const text = Core.normalizeText(element.getAttribute("content") || element.textContent);
      const price = Core.parsePrice(text);
      if (!price) continue;

      const context = Core.normalizeText(`${element.parentElement?.textContent || ""} ${text}`).slice(0, 250);
      const signature = `${element.id || ""} ${element.className || ""} ${element.getAttribute("itemprop") || ""}`;
      let score = 20;
      if (/price/i.test(signature)) score += 20;
      if (/sale|discount|final|total/i.test(signature)) score += 12;
      if (element.matches("[itemprop='price']")) score += 40;
      if (/판매가|할인가|최종가|결제가/.test(context)) score += 18;
      if (/쿠팡판매가/.test(context)) score += 20;
      score += distanceScore(element, titleElement);
      score += Math.max(0, ...purchaseButtons.map((button) => distanceScore(element, button)));

      if (element.closest("del, s") || /정상가|정가|소비자가/.test(context)) score -= 35;
      if (/배송비|배송료|적립금|쿠폰|할부|월\s*\d|최대\s*[\d,]+원\s*할인/.test(context)) score -= 45;
      if (element.closest("header, footer, nav, aside")) score -= 30;
      if (element.closest("[class*='recommend'], [class*='Recommend'], [class*='related'], [class*='Related']")) score -= 70;
      if (text.length > 80) score -= 20;

      const candidate = { price, score, element, method: `${siteAdapter.id}-dom` };
      if (!best || candidate.score > best.score) best = candidate;
    }
    return best;
  }

  function selectedOptions() {
    const options = {};
    document.querySelectorAll("select").forEach((select, index) => {
      if (!visible(select) || !select.value) return;
      const label = document.querySelector(`label[for="${CSS.escape(select.id)}"]`)?.textContent || select.name || `옵션 ${index + 1}`;
      const value = select.selectedOptions?.[0]?.textContent || select.value;
      const cleanValue = Core.normalizeText(value);
      if (cleanValue && !/선택|select/i.test(cleanValue)) options[Core.normalizeText(label)] = cleanValue;
    });

    [...document.querySelectorAll('[aria-selected="true"]')].slice(0, 8).forEach((element, index) => {
      if (!visible(element)) return;
      const value = Core.normalizeText(element.textContent);
      if (value && value.length <= 40 && !Object.values(options).includes(value)) {
        options[`선택 ${index + 1}`] = value;
      }
    });
    return options;
  }

  function extract() {
    const siteAdapter = adapter();
    const titleElement = firstVisible(siteAdapter.title);
    const titleHint = Core.normalizeText(
      titleElement?.textContent || meta("og:title", "twitter:title") || document.title.replace(/\s*[|｜-].*$/, "")
    );
    const structured = structuredCandidate(titleHint);
    const dom = domPriceCandidate(siteAdapter, titleElement);
    const metaPrice = Core.parsePrice(meta("product:price:amount", "og:price:amount", "twitter:data1"));
    const metaCandidate = metaPrice ? { price: metaPrice, score: 70, method: "meta" } : null;
    const winner = [structured, dom, metaCandidate].filter(Boolean).sort((a, b) => b.score - a.score)[0] || null;

    const title = structured?.title && wordOverlap(structured.title, titleHint) >= 0.3 ? structured.title : titleHint;
    const imageUrl =
      structured?.imageUrl ||
      meta("og:image", "twitter:image") ||
      firstVisible(["main img", "article img", "img[itemprop='image']"])?.currentSrc ||
      "";
    const price = winner?.price || null;
    const confidence = winner ? Math.min(100, Math.max(0, winner.score)) : 0;

    return {
      title: title || "상품명 확인 필요",
      price,
      originalPrice: winner?.originalPrice || null,
      currency: winner?.currency || meta("product:price:currency", "og:price:currency") || "KRW",
      imageUrl,
      productUrl: Core.normalizeUrl(location.href),
      store: siteAdapter.name || Core.siteNameFromHost(HOST),
      options: selectedOptions(),
      extractionMethod: winner?.method || "manual",
      confidence,
      needsReview: confidence < 70 || !price,
      detectedSite: siteAdapter.id
    };
  }

  root.ShoplyExtractor = {
    extract,
    detectSite(hostname) {
      return adapterForHost(hostname).id;
    }
  };
})(globalThis);
