(function (root) {
  "use strict";

  const Core = root.ShoplyCore;
  const HOST = String(root.location?.hostname || "").toLowerCase();

  function hostMatches(host, ...domains) {
    const normalized = String(host || "").toLowerCase().replace(/\.$/, "");
    return domains.some((domain) => normalized === domain || normalized.endsWith(`.${domain}`));
  }

  const ADAPTERS = [
    {
      id: "ably",
      name: "에이블리",
      matches: (host) => hostMatches(host, "a-bly.com", "ably.co.kr"),
      title: ["h1", "[data-testid*='product-name']", "[class*='ProductName']", "[class*='product-name']"],
      price: ["[data-testid*='price']", "[class*='ProductPrice']", "[class*='product-price']", "[class*='sale-price']"]
    },
    {
      id: "musinsa",
      name: "무신사",
      matches: (host) => hostMatches(host, "musinsa.com"),
      title: ["h1", "[data-testid*='product-name']", "[class*='ProductTitle']", "[class*='product_title']"],
      price: ["[data-testid*='price']", "[class*='Price']", "[class*='price']"]
    },
    {
      id: "coupang",
      name: "쿠팡",
      matches: (host) => hostMatches(host, "coupang.com"),
      title: ["h1.prod-buy-header__title", ".prod-buy-header__title", "h1"],
      price: [".prod-sale-price .total-price", ".prod-price .total-price", ".price-value", "[class*='final-price']"]
    },
    {
      id: "naver",
      name: "네이버 쇼핑",
      matches: (host) => hostMatches(host, "naver.com"),
      title: ["h1", "[data-testid*='product-name']", "[class*='product_title']", "[class*='ProductTitle']"],
      price: ["[data-testid*='price']", "[class*='sale_price']", "[class*='price']", "[class*='Price']"]
    },
    {
      id: "29cm", name: "29CM", matches: (host) => hostMatches(host, "29cm.co.kr"),
      title: ["h1", "[class*='ProductName']", "[class*='product_name']", "[class*='product-name']"],
      price: ["[class*='SalePrice']", "[class*='sale_price']", "[class*='sale-price']", "[class*='final-price']"]
    },
    {
      id: "wconcept", name: "W컨셉", matches: (host) => hostMatches(host, "wconcept.co.kr"),
      title: [".product_info .product_name", ".product_info .prd_name", "[class*='ProductName']", "h1"],
      price: [".product_info .sale_price", ".product_info .price", "[class*='discount-price']", "[class*='salePrice']"]
    },
    {
      id: "zigzag", name: "지그재그", matches: (host) => hostMatches(host, "zigzag.kr"),
      title: ["main h1", "[class*='product-title']", "[class*='product_name']", "h1"],
      price: ["[class*='sale-price']", "[class*='discount-price']", "[class*='product-price']"]
    },
    {
      id: "kream", name: "KREAM", matches: (host) => hostMatches(host, "kream.co.kr"),
      title: ["[class*='product_title']", ".main_title_box h1", "h1"],
      price: ["[class*='buy'] [class*='price']", "[class*='instant'] [class*='price']", "[class*='price_now']"],
      preferredPriceText: /즉시\s*구매가|구매가/,
      excludedPriceText: /발매가|최근\s*거래가|판매\s*입찰|구매\s*입찰/
    },
    {
      id: "elevenst", name: "11번가", matches: (host) => hostMatches(host, "11st.co.kr"),
      title: [".c_product_info_title", "h1"],
      price: [".price_block .sale_price", ".c_product_info_price .price", "[class*='sale_price']"]
    },
    {
      id: "gmarket", name: "G마켓", matches: (host) => hostMatches(host, "gmarket.co.kr"),
      title: [".itemtit", "h1.itemtit", "h1"],
      price: [".box__price-seller", ".price_real", ".price_innerwrap .price", "[class*='sale_price']"],
      image: [".box__viewer-container img", "img[alt*='상품이미지']"]
    },
    {
      id: "ssg", name: "SSG.COM", matches: (host) => hostMatches(host, "ssg.com"),
      title: [".cdtl_info_tit", ".cdtl_item_info h2", "h1"],
      price: [".cdtl_new_price .ssg_price", ".cdtl_price .ssg_price", "[class*='sale_price']"],
      excludedPriceText: /100\s*g당|단위당|적립|카드|쿠폰/
    },
    {
      id: "lotteon", name: "롯데ON", matches: (host) => hostMatches(host, "lotteon.com"),
      title: ["[class*='product-title']", ".pd-title", "h1"],
      price: ["[class*='discount-price']", "[class*='sale-price']", "[class*='final-price']"]
    },
    {
      id: "auction", name: "옥션", matches: (host) => hostMatches(host, "auction.co.kr"),
      title: [".itemtit", "h1.itemtit", "h1"],
      price: [".price_real", ".item_price .price", "[class*='sale_price']"]
    },
    {
      id: "aliexpress", name: "AliExpress", matches: (host) => hostMatches(host, "aliexpress.com"), defaultCurrency: "USD",
      title: ["h1", "[data-pl*='product-title']", "[class*='product-title']"],
      price: ["[class*='price--current']", "[class*='product-price-current']", "[class*='sale-price']", "[class*='price']"]
    },
    {
      id: "temu", name: "Temu", matches: (host) => hostMatches(host, "temu.com"), defaultCurrency: "KRW",
      title: ["h1", "[data-testid*='product-title']", "[class*='product-title']"],
      price: ["[data-testid*='price']", "[class*='sale-price']", "[class*='price']"]
    },
    {
      id: "amazon-us", name: "Amazon", matches: (host) => hostMatches(host, "amazon.com"), defaultCurrency: "USD",
      title: ["#productTitle", "h1"],
      price: ["#corePrice_feature_div .a-offscreen", ".priceToPay .a-offscreen", "#priceblock_ourprice", "#priceblock_dealprice"]
    },
    {
      id: "iherb", name: "iHerb", matches: (host) => hostMatches(host, "iherb.com"), defaultCurrency: "KRW",
      title: ["#name", "h1", "[class*='product-title']"],
      price: ["#price", "[class*='price-inner-text']", "[class*='sale-price']"]
    },
    {
      id: "shein", name: "SHEIN", matches: (host) => hostMatches(host, "shein.com"), defaultCurrency: "KRW",
      title: ["h1", "[class*='product-intro__head-name']", "[class*='goods-title']"],
      price: ["[class*='product-intro__head-mainprice']", "[class*='sale-price']", "[class*='price']"]
    },
    {
      id: "amazon-jp", name: "Amazon Japan", matches: (host) => hostMatches(host, "amazon.co.jp"), defaultCurrency: "JPY",
      title: ["#productTitle", "h1"],
      price: ["#corePrice_feature_div .a-offscreen", ".priceToPay .a-offscreen", "#priceblock_ourprice", "#priceblock_dealprice"]
    },
    {
      id: "ebay", name: "eBay", matches: (host) => hostMatches(host, "ebay.com"), defaultCurrency: "USD",
      title: ["h1.x-item-title__mainTitle", "h1"],
      price: [".x-price-primary", "[itemprop='price']", "[class*='price']"]
    },
    {
      id: "newegg", name: "Newegg", matches: (host) => hostMatches(host, "newegg.com"), defaultCurrency: "USD",
      title: ["h1.product-title", "h1"],
      price: [".price-current", "[itemprop='price']", "[class*='price-current']"]
    },
    {
      id: "generic",
      name: null,
      matches: () => true,
      defaultCurrency: "KRW",
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

  function imageUrl(value) {
    return Core.normalizeImageUrl(value, location.href);
  }

  function imageUrlFromElement(element) {
    if (!element) return "";
    const source =
      element.getAttribute("data-src") ||
      element.getAttribute("data-original") ||
      element.getAttribute("data-lazy-src") ||
      element.currentSrc ||
      element.getAttribute("src") ||
      element.getAttribute("srcset")?.split(",")[0]?.trim().split(/\s+/)[0] ||
      "";
    return imageUrl(source);
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

  function normalizeCurrency(value, fallback = "KRW") {
    const text = String(value || "").trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(text)) return text;
    return fallback;
  }

  function currencyFromText(value, fallback = "KRW") {
    const text = String(value || "");
    const explicit = text.match(/\b(KRW|USD|JPY|CNY|EUR|GBP|CAD|AUD|TWD)\b/i)?.[1];
    if (explicit) return explicit.toUpperCase();
    if (/₩|원/.test(text)) return "KRW";
    if (/€/.test(text)) return "EUR";
    if (/£/.test(text)) return "GBP";
    return fallback;
  }

  function extractOffer(offers, fallbackCurrency) {
    const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
    const sorted = list.sort((left, right) => {
      const leftUrl = Core.normalizeUrl(left?.url || "");
      const rightUrl = Core.normalizeUrl(right?.url || "");
      const current = Core.normalizeUrl(location.href);
      return Number(rightUrl === current) - Number(leftUrl === current);
    });

    for (const offer of sorted) {
      const currency = normalizeCurrency(
        offer?.priceCurrency || offer?.priceSpecification?.priceCurrency,
        fallbackCurrency
      );
      const price = Core.parseMoney(offer?.price ?? offer?.lowPrice ?? offer?.priceSpecification?.price, currency);
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
        originalPrice: Core.parseMoney(strike?.price, currency),
        currency
      };
    }
    return null;
  }

  function structuredCandidates(titleHint, siteAdapter) {
    const products = jsonLdObjects().filter((object) => hasType(object, "Product"));
    let content = null;
    let priced = null;
    for (const product of products) {
      const offer = extractOffer(product.offers, siteAdapter.defaultCurrency || "KRW");
      let score = offer ? 75 : 45;
      score += Math.round(wordOverlap(product.name, titleHint) * 30);
      const offers = Array.isArray(product.offers) ? product.offers : [product.offers];
      const rawProductUrl = product.url || offers[0]?.url || "";
      const productUrl = rawProductUrl ? Core.normalizeUrl(rawProductUrl, location.href) : "";
      if (productUrl && productUrl === Core.normalizeUrl(location.href)) score += 25;
      const candidate = {
        ...(offer || {}),
        title: Core.normalizeText(product.name),
        imageUrl: imageUrl(product.image),
        score,
        method: "json-ld"
      };
      if (!content || candidate.score > content.score) content = candidate;
      if (offer && (!priced || candidate.score > priced.score)) priced = candidate;
    }
    return { content, priced };
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
          const text = element.getAttribute("content") || element.textContent;
          const currency = currencyFromText(text, siteAdapter.defaultCurrency || "KRW");
          if (visible(element) && (Core.parseSalePrice(text, currency) || Core.parseMoney(text, currency))) elements.add(element);
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
      if (text.length <= 70 && /(?:₩\s*\d|\d[\d,\.]*\s*원\b|(?:US\s*)?\$\s*\d|¥\s*\d|€\s*\d|£\s*\d|\b(?:USD|JPY|CNY|EUR|GBP|CAD|AUD|TWD)\s*\d)/i.test(text) && visible(node.parentElement)) {
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
      const currency = currencyFromText(text, siteAdapter.defaultCurrency || "KRW");
      const salePrice = Core.parseSalePrice(text, currency);
      const price = salePrice || Core.parseMoney(text, currency);
      if (!price) continue;

      const context = Core.normalizeText(`${element.parentElement?.textContent || ""} ${text}`).slice(0, 250);
      const signature = `${element.id || ""} ${element.className || ""} ${element.getAttribute("itemprop") || ""}`;
      let score = 20;
      if (/price/i.test(signature)) score += 20;
      if (/sale|discount|final|total/i.test(signature)) score += 12;
      if (salePrice) score += 70;
      if (element.matches("[itemprop='price']")) score += 40;
      if (/판매가|할인가|최종가|결제가/.test(context)) score += 18;
      if (siteAdapter.preferredPriceText?.test(context)) score += 35;
      if (/쿠팡판매가/.test(context)) score += 20;
      score += distanceScore(element, titleElement);
      score += Math.max(0, ...purchaseButtons.map((button) => distanceScore(element, button)));

      if (element.closest("del, s") || /원가|정상가|정가|소비자가|list\s*price|regular\s*price|original\s*price/i.test(context)) score -= 55;
      if (/original|regular|list/i.test(signature)) score -= 70;
      if (/배송비|배송료|적립금|쿠폰|할부|월\s*\d|최대\s*[\d,]+원\s*할인/.test(context)) score -= 45;
      if (siteAdapter.excludedPriceText?.test(context)) score -= 80;
      if (element.closest("header, footer, nav, aside")) score -= 30;
      if (element.closest("[class*='recommend'], [class*='Recommend'], [class*='related'], [class*='Related']")) score -= 70;
      if (text.length > 80) score -= 20;

      const candidate = {
        price,
        originalPrice: Core.parseOriginalPrice(context, currency),
        currency,
        score,
        element,
        method: `${siteAdapter.id}-dom`
      };
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
    const structured = structuredCandidates(titleHint, siteAdapter);
    const dom = domPriceCandidate(siteAdapter, titleElement);
    const metaCurrency = normalizeCurrency(
      meta("product:price:currency", "og:price:currency"),
      siteAdapter.defaultCurrency || "KRW"
    );
    const metaPrice = Core.parseMoney(meta("product:price:amount", "og:price:amount", "twitter:data1"), metaCurrency);
    const metaCandidate = metaPrice ? { price: metaPrice, currency: metaCurrency, score: 70, method: "meta" } : null;
    const winner = [structured.priced, dom, metaCandidate].filter(Boolean).sort((a, b) => b.score - a.score)[0] || null;

    const title = structured.content?.title && wordOverlap(structured.content.title, titleHint) >= 0.3
      ? structured.content.title
      : titleHint;
    const imageElement = firstVisible([
      ...(siteAdapter.image || []),
      "img[itemprop='image']",
      "main img",
      "article img",
      "img[alt*='상품']",
      "img[alt*='Product']"
    ]);
    const extractedImageUrl =
      structured.content?.imageUrl ||
      imageUrl(meta("og:image:secure_url", "og:image", "twitter:image")) ||
      imageUrlFromElement(imageElement);
    const price = winner?.price || null;
    const confidence = winner ? Math.min(100, Math.max(0, winner.score)) : 0;

    return {
      title: title || "상품명 확인 필요",
      price,
      originalPrice: winner?.originalPrice || null,
      currency: winner?.currency || metaCurrency,
      imageUrl: extractedImageUrl,
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
