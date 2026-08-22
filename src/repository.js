(function (root) {
  "use strict";

  const STORAGE_KEY = "shoplyState";
  const DEFAULT_CATEGORY = {
    id: "default",
    name: "내 쇼핑",
    createdAt: 0
  };

  function freshState() {
    return {
      version: 2,
      categories: [{ ...DEFAULT_CATEGORY }],
      items: []
    };
  }

  async function load() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY];
    if (!stored || !Array.isArray(stored.categories) || !Array.isArray(stored.items)) {
      const initial = freshState();
      await save(initial);
      return initial;
    }
    if (!stored.categories.length) stored.categories.push({ ...DEFAULT_CATEGORY });
    if (stored.version !== 2) {
      stored.items = stored.items.map((item) => ({
        ...item,
        krwPrice: item.krwPrice ?? (item.currency === "KRW" || !item.currency ? Number(item.price) || null : null)
      }));
      stored.version = 2;
      await save(stored);
    }
    return stored;
  }

  async function save(state) {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
    return state;
  }

  async function createCategory(name) {
    const cleanName = root.ShoplyCore.normalizeText(name);
    if (!cleanName) throw new Error("플레이리스트 이름을 입력해주세요.");
    const state = await load();
    const duplicate = state.categories.find(
      (category) => category.name.toLocaleLowerCase("ko") === cleanName.toLocaleLowerCase("ko")
    );
    if (duplicate) return duplicate;

    const category = {
      id: crypto.randomUUID(),
      name: cleanName.slice(0, 40),
      createdAt: Date.now()
    };
    state.categories.push(category);
    await save(state);
    return category;
  }

  async function renameCategory(id, name) {
    const cleanName = root.ShoplyCore.normalizeText(name);
    if (!cleanName) throw new Error("플레이리스트 이름을 입력해주세요.");
    if (cleanName.length > 40) throw new Error("플레이리스트 이름은 40자 이하로 입력해주세요.");

    const state = await load();
    const category = state.categories.find((candidate) => candidate.id === id);
    if (!category) throw new Error("플레이리스트를 찾지 못했습니다.");

    const duplicate = state.categories.find(
      (candidate) => candidate.id !== id && candidate.name.toLocaleLowerCase("ko") === cleanName.toLocaleLowerCase("ko")
    );
    if (duplicate) throw new Error("같은 이름의 플레이리스트가 이미 있습니다.");

    category.name = cleanName;
    category.updatedAt = Date.now();
    await save(state);
    return category;
  }

  async function addProduct(product, categoryId) {
    const state = await load();
    const category = state.categories.find((candidate) => candidate.id === categoryId);
    if (!category) throw new Error("플레이리스트를 찾지 못했습니다.");

    const currency = product.currency || "KRW";
    const cleanProduct = {
      title: root.ShoplyCore.normalizeText(product.title).slice(0, 200),
      price: Math.max(0, Number(product.price) || 0),
      originalPrice: Number(product.originalPrice) || null,
      currency,
      krwPrice: Math.max(0, Number(product.krwPrice ?? (currency === "KRW" ? product.price : 0)) || 0),
      fx: product.fx || null,
      imageUrl: product.imageUrl || "",
      productUrl: root.ShoplyCore.normalizeUrl(product.productUrl),
      store: product.store || "쇼핑몰",
      options: product.options || {},
      extractionMethod: product.extractionMethod || "manual"
    };
    if (!cleanProduct.title) throw new Error("상품명이 없습니다.");
    if (!cleanProduct.price) throw new Error("가격을 확인해주세요.");
    if (!cleanProduct.krwPrice) throw new Error("원화 환산 가격을 확인해주세요.");

    const existing = state.items.find(
      (item) =>
        item.categoryId === categoryId &&
        item.productUrl === cleanProduct.productUrl &&
        root.ShoplyCore.sameOptions(item.options, cleanProduct.options)
    );

    if (existing) {
      existing.quantity = (Number(existing.quantity) || 1) + 1;
      existing.price = cleanProduct.price;
      existing.krwPrice = cleanProduct.krwPrice;
      existing.currency = cleanProduct.currency;
      existing.fx = cleanProduct.fx;
      existing.updatedAt = Date.now();
      await save(state);
      return existing;
    }

    const item = {
      ...cleanProduct,
      id: crypto.randomUUID(),
      categoryId,
      quantity: 1,
      addedAt: Date.now(),
      updatedAt: Date.now()
    };
    state.items.unshift(item);
    await save(state);
    return item;
  }

  async function updateItem(id, patch) {
    const state = await load();
    const item = state.items.find((candidate) => candidate.id === id);
    if (!item) throw new Error("상품을 찾지 못했습니다.");
    const allowed = ["categoryId", "quantity", "price", "krwPrice", "title", "fx"];
    for (const key of allowed) {
      if (Object.hasOwn(patch, key)) item[key] = patch[key];
    }
    item.quantity = Math.max(1, Number(item.quantity) || 1);
    item.price = Math.max(0, Number(item.price) || 0);
    item.krwPrice = Math.max(0, Number(item.krwPrice ?? (item.currency === "KRW" ? item.price : 0)) || 0);
    if (!item.price || !item.krwPrice) throw new Error("가격을 확인해주세요.");
    item.updatedAt = Date.now();
    await save(state);
    return item;
  }

  async function removeItem(id) {
    const state = await load();
    state.items = state.items.filter((item) => item.id !== id);
    await save(state);
  }

  async function removeCategory(id) {
    if (id === DEFAULT_CATEGORY.id) throw new Error("기본 플레이리스트는 삭제할 수 없습니다.");
    const state = await load();
    state.items.forEach((item) => {
      if (item.categoryId === id) item.categoryId = DEFAULT_CATEGORY.id;
    });
    state.categories = state.categories.filter((category) => category.id !== id);
    await save(state);
  }

  async function reorderCategories(categoryIds) {
    const state = await load();
    if (!Array.isArray(categoryIds) || categoryIds.length !== state.categories.length) {
      throw new Error("플레이리스트 순서 정보가 올바르지 않습니다.");
    }

    const categoriesById = new Map(state.categories.map((category) => [category.id, category]));
    const uniqueIds = new Set(categoryIds);
    if (uniqueIds.size !== state.categories.length || categoryIds.some((id) => !categoriesById.has(id))) {
      throw new Error("플레이리스트 순서 정보가 올바르지 않습니다.");
    }

    state.categories = categoryIds.map((id) => categoriesById.get(id));
    await save(state);
    return state.categories;
  }

  function subscribe(listener) {
    const handler = (changes, area) => {
      if (area === "local" && changes[STORAGE_KEY]) {
        listener(changes[STORAGE_KEY].newValue);
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }

  root.ShoplyRepository = {
    STORAGE_KEY,
    addProduct,
    createCategory,
    load,
    removeCategory,
    removeItem,
    renameCategory,
    reorderCategories,
    save,
    subscribe,
    updateItem
  };
})(globalThis);
