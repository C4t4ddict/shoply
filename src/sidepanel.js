(function () {
  "use strict";

  const Core = globalThis.ShoplyCore;
  const Repository = globalThis.ShoplyRepository;
  const UiPreferences = globalThis.ShoplyUiPreferences;
  const elements = Object.fromEntries(
    [
      "scanButton", "emptyScanButton", "captureLoading", "captureEmpty", "captureForm", "captureImage",
      "captureStore", "confidenceBadge", "titleInput", "priceInput", "priceCurrencyLabel", "krwPriceField",
      "krwPriceInput", "captureNotice", "currencySummary", "optionSummary",
      "addCategorySelect", "categoryTabs", "activeCategoryName", "activeItemCount", "activeCategoryTotal",
      "emptyLibrary", "productList", "newCategoryButton", "librarySection", "libraryContent",
      "toggleLibraryButton", "categoryDialog", "categoryForm",
      "categoryDialogMark", "categoryDialogTitle", "categoryDialogDescription", "categorySubmitButton",
      "categoryNameInput", "cancelCategoryButton", "deleteCategoryButton", "toast"
    ].map((id) => [id, document.getElementById(id)])
  );

  let state = null;
  let selectedCategoryId = "default";
  let capturedProduct = null;
  let toastTimer = null;
  let draggedCategoryId = null;
  let libraryCollapsed = false;
  let libraryCollapseAnimation = null;
  let waitingForHostAccess = false;
  let editingCategoryId = null;
  let categoryDialogReturnId = null;

  function toast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2300);
  }

  function escapeHtml(value) {
    const span = document.createElement("span");
    span.textContent = String(value || "");
    return span.innerHTML;
  }

  function showCapture(product) {
    const { currency, krwPrice, isForeign: foreignCurrency } = Core.productPriceFields(product);
    capturedProduct = { ...product, currency, krwPrice };
    waitingForHostAccess = false;
    elements.emptyScanButton.textContent = "현재 페이지 읽기";
    elements.captureLoading.classList.add("hidden");
    elements.captureEmpty.classList.add("hidden");
    elements.captureForm.classList.remove("hidden");
    elements.titleInput.value = product.title || "";
    elements.priceInput.value = product.price
      ? Number(product.price).toLocaleString(currency === "KRW" ? "ko-KR" : "en-US", {
          maximumFractionDigits: currency === "KRW" || currency === "JPY" ? 0 : 2
        })
      : "";
    elements.priceCurrencyLabel.textContent = currency === "KRW" ? "원" : currency;
    elements.krwPriceField.classList.toggle("hidden", !foreignCurrency);
    elements.krwPriceInput.required = foreignCurrency;
    elements.krwPriceInput.value = foreignCurrency && krwPrice ? Number(krwPrice).toLocaleString("ko-KR") : "";
    elements.captureImage.src = product.imageUrl || "";
    elements.captureImage.style.display = product.imageUrl ? "block" : "none";
    elements.captureStore.textContent = product.store || "쇼핑몰";

    const review = product.needsReview || !product.price || !krwPrice;
    elements.confidenceBadge.textContent = review ? "가격 확인 필요" : "자동 인식 완료";
    elements.confidenceBadge.classList.toggle("good", !review);
    elements.captureNotice.classList.toggle("hidden", !review);
    elements.captureNotice.textContent = product.conversionError
      ? `환율을 불러오지 못했어요. 예상 원화 가격을 직접 입력해주세요. (${product.conversionError})`
      : product.price
        ? "여러 가격이 있는 페이지일 수 있어요. 담기 전에 현재 가격을 한 번 확인해주세요."
        : "가격을 자동으로 찾지 못했어요. 페이지에 표시된 현재 판매가를 직접 입력해주세요.";

    elements.currencySummary.classList.toggle("hidden", !foreignCurrency);
    if (foreignCurrency) {
      const rateDate = product.fx?.rateDate ? ` · ${escapeHtml(product.fx.rateDate)} 환율` : "";
      const stale = product.fx?.status === "stale" ? " · 최근 저장 환율" : "";
      elements.currencySummary.innerHTML = `<b>${escapeHtml(currency)} 가격을 원화로 환산</b>${rateDate}${stale}<small>예상 원화에는 배송비·관세·카드 수수료가 포함되지 않아요.</small>`;
    }

    const options = Object.entries(product.options || {});
    elements.optionSummary.classList.toggle("hidden", !options.length);
    elements.optionSummary.innerHTML = options.length
      ? `<b>선택 옵션</b> · ${options.map(([key, value]) => `${escapeHtml(key)}: ${escapeHtml(value)}`).join(" · ")}`
      : "";
  }

  function showCaptureError(message) {
    elements.captureLoading.classList.add("hidden");
    elements.captureForm.classList.add("hidden");
    elements.captureEmpty.classList.remove("hidden");
    elements.captureEmpty.querySelector("small").textContent = message || "상품 상세 페이지에서 다시 시도해주세요.";
  }

  async function scanCurrentPage({ requestHostAccess = false } = {}) {
    elements.captureEmpty.classList.add("hidden");
    elements.captureForm.classList.add("hidden");
    elements.captureLoading.classList.remove("hidden");
    try {
      const response = await chrome.runtime.sendMessage({ type: "EXTRACT_ACTIVE_TAB", requestHostAccess });
      if (response?.needsHostPermission) {
        waitingForHostAccess = true;
        elements.emptyScanButton.textContent = "사이트 접근 허용 후 다시 읽기";
        showCaptureError(response.error);
        return;
      }
      if (!response?.ok || !response.product) throw new Error(response?.error || "상품 정보를 찾지 못했습니다.");
      showCapture(response.product);
    } catch (error) {
      showCaptureError(error.message);
    }
  }

  function categoryOptions(selectedId) {
    return state.categories
      .map((category) => `<option value="${category.id}" ${category.id === selectedId ? "selected" : ""}>${escapeHtml(category.name)}</option>`)
      .join("");
  }

  function categoryTabRects() {
    return new Map(
      [...elements.categoryTabs.querySelectorAll("[data-category-id]")]
        .map((tab) => [tab.dataset.categoryId, tab.getBoundingClientRect()])
    );
  }

  function animateCategoryTabs(previousRects) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    elements.categoryTabs.querySelectorAll("[data-category-id]").forEach((tab) => {
      const previousRect = previousRects.get(tab.dataset.categoryId);
      if (!previousRect) return;
      const nextRect = tab.getBoundingClientRect();
      const deltaX = previousRect.left - nextRect.left;
      if (Math.abs(deltaX) < 1) return;
      tab.getAnimations().forEach((animation) => animation.cancel());
      tab.animate(
        [{ transform: `translateX(${deltaX}px)` }, { transform: "translateX(0)" }],
        { duration: 160, easing: "cubic-bezier(.2,.8,.2,1)" }
      );
    });
  }

  function renderCategories() {
    if (!state.categories.some((category) => category.id === selectedCategoryId)) selectedCategoryId = "default";
    elements.categoryTabs.innerHTML = state.categories
      .map((category) => {
        const count = state.items.filter((item) => item.categoryId === category.id).length;
        return `<div class="category-tab-item" draggable="true" data-category-id="${category.id}">
          <button class="category-tab" type="button" role="tab" aria-selected="${category.id === selectedCategoryId}" aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight" title="드래그하거나 Alt+방향키로 순서 변경">${escapeHtml(category.name)}<b>${count}</b></button>
          <button class="rename-category-button" type="button" data-action="rename-category" draggable="false" aria-label="플레이리스트 이름 수정" title="플레이리스트 이름 수정">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" /><path d="m13.8 6.4 3.8 3.8" /></svg>
          </button>
        </div>`;
      })
      .join("");
    elements.addCategorySelect.innerHTML = categoryOptions(selectedCategoryId);
  }

  function productCard(item) {
    const optionText = Object.values(item.options || {}).filter(Boolean).join(" · ");
    const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='90'%3E%3Crect width='100%25' height='100%25' fill='%23eeeDE7'/%3E%3Ctext x='50%25' y='52%25' text-anchor='middle' font-size='10' fill='%23888'%3ENo image%3C/text%3E%3C/svg%3E";
    return `
      <article class="product-card" data-item-id="${item.id}">
        <a href="${escapeHtml(item.productUrl)}" target="_blank" rel="noreferrer" title="상품 페이지 열기">
          <img src="${escapeHtml(item.imageUrl || placeholder)}" alt="" />
        </a>
        <div class="product-card-body">
          <div class="product-meta"><span>${escapeHtml(item.store)}</span><span>${escapeHtml(optionText)}</span></div>
          <a class="product-title" href="${escapeHtml(item.productUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>
          <div class="product-price-row">
            <div><span class="product-price">${Core.formatPrice(item.krwPrice, "KRW")}</span>${item.currency !== "KRW" ? `<small class="source-price">${escapeHtml(Core.formatPrice(item.price, item.currency))}</small>` : ""}</div>
            <div class="quantity" aria-label="수량">
              <button type="button" data-action="decrease" aria-label="수량 줄이기">−</button>
              <span>${item.quantity}</span>
              <button type="button" data-action="increase" aria-label="수량 늘리기">＋</button>
            </div>
          </div>
          <div class="product-actions">
            <select data-action="move" aria-label="플레이리스트 이동">${categoryOptions(item.categoryId)}</select>
            <button class="remove-item" type="button" data-action="remove" title="삭제" aria-label="상품 삭제">×</button>
          </div>
        </div>
      </article>`;
  }

  function renderLibrary() {
    const category = state.categories.find((candidate) => candidate.id === selectedCategoryId) || state.categories[0];
    const items = state.items.filter((item) => item.categoryId === category.id);
    const quantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    const total = Core.calculateCategoryTotal(state.items, category.id);

    elements.activeCategoryName.textContent = category.name;
    elements.activeItemCount.textContent = `상품 ${quantity}개`;
    elements.activeCategoryTotal.textContent = Core.formatPrice(total);
    elements.emptyLibrary.classList.toggle("hidden", items.length > 0);
    elements.productList.innerHTML = items.map(productCard).join("");
    elements.deleteCategoryButton.classList.toggle("hidden", category.id === "default");
  }

  function render() {
    renderCategories();
    renderLibrary();
  }

  function openCategoryDialog(category = null, returnCategoryId = null) {
    editingCategoryId = category?.id || null;
    categoryDialogReturnId = returnCategoryId;
    elements.categoryDialogMark.textContent = category ? "✎" : "＋";
    elements.categoryDialogTitle.textContent = category ? "플레이리스트 이름 수정" : "새 플레이리스트";
    elements.categoryDialogDescription.textContent = category
      ? "상품과 순서는 그대로 유지되고 이름만 변경됩니다."
      : "여행 준비, 가을 코디처럼 원하는 테마로 묶어보세요.";
    elements.categorySubmitButton.textContent = category ? "저장" : "만들기";
    elements.categoryNameInput.value = category?.name || "";
    elements.categoryDialog.showModal();
    elements.categoryNameInput.focus();
    elements.categoryNameInput.select();
  }

  function focusCategoryControl(categoryId) {
    if (!categoryId) return;
    requestAnimationFrame(() => {
      elements.categoryTabs
        .querySelector(`[data-category-id="${CSS.escape(categoryId)}"] .rename-category-button`)
        ?.focus();
    });
  }

  async function renderLibraryCollapsed({ animate = false } = {}) {
    elements.librarySection.classList.toggle("collapsed", libraryCollapsed);
    elements.toggleLibraryButton.setAttribute("aria-expanded", String(!libraryCollapsed));
    elements.toggleLibraryButton.title = libraryCollapsed ? "플레이리스트 펼치기" : "플레이리스트 접기";
    elements.toggleLibraryButton.querySelector(".sr-only").textContent = elements.toggleLibraryButton.title;

    libraryCollapseAnimation?.cancel();
    libraryCollapseAnimation = null;

    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduceMotion) {
      elements.libraryContent.hidden = libraryCollapsed;
      elements.libraryContent.inert = libraryCollapsed;
      return;
    }

    if (libraryCollapsed && elements.libraryContent.contains(document.activeElement)) {
      elements.toggleLibraryButton.focus();
    }

    elements.libraryContent.hidden = false;
    elements.libraryContent.inert = libraryCollapsed;
    const contentHeight = elements.libraryContent.scrollHeight;
    const keyframes = libraryCollapsed
      ? [{ height: `${contentHeight}px`, opacity: 1 }, { height: "0px", opacity: 0 }]
      : [{ height: "0px", opacity: 0 }, { height: `${contentHeight}px`, opacity: 1 }];

    const animation = elements.libraryContent.animate(keyframes, {
      duration: 220,
      easing: "cubic-bezier(.2,.8,.2,1)"
    });
    libraryCollapseAnimation = animation;

    try {
      await animation.finished;
    } catch {
      return;
    } finally {
      if (libraryCollapseAnimation === animation) libraryCollapseAnimation = null;
    }

    elements.libraryContent.hidden = libraryCollapsed;
    elements.libraryContent.inert = libraryCollapsed;
  }

  async function persistCategoryOrder(categoryIds, movedCategoryId) {
    const previousRects = categoryTabRects();
    try {
      const categories = await Repository.reorderCategories(categoryIds);
      state = { ...state, categories };
      render();
      animateCategoryTabs(previousRects);
      const movedTab = elements.categoryTabs.querySelector(`[data-category-id="${CSS.escape(movedCategoryId)}"] .category-tab`);
      movedTab?.focus();
      const movedCategory = categories.find((category) => category.id === movedCategoryId);
      const movedIndex = categories.findIndex((category) => category.id === movedCategoryId);
      toast(`‘${movedCategory?.name || "플레이리스트"}’ ${movedIndex + 1}번째로 이동했어요.`);
    } catch (error) {
      renderCategories();
      animateCategoryTabs(previousRects);
      toast(error.message);
    }
  }

  async function handleAdd(event) {
    event.preventDefault();
    if (!capturedProduct) return;
    const currency = capturedProduct.currency || "KRW";
    const price = Core.parseMoney(elements.priceInput.value, currency);
    const krwPrice = currency === "KRW" ? price : Core.parsePrice(elements.krwPriceInput.value);
    if (!price) {
      elements.priceInput.focus();
      toast("현재 판매 가격을 입력해주세요.");
      return;
    }
    if (!krwPrice) {
      elements.krwPriceInput.focus();
      toast("예상 원화 가격을 입력해주세요.");
      return;
    }
    try {
      const categoryId = elements.addCategorySelect.value;
      await Repository.addProduct(
        {
          ...capturedProduct,
          title: elements.titleInput.value,
          currency,
          price,
          krwPrice,
          fx: currency !== "KRW" && !capturedProduct.fx
            ? { status: "manual", source: "user", rateDate: "", fetchedAt: Date.now(), rateToKrw: krwPrice / price }
            : capturedProduct.fx
        },
        categoryId
      );
      selectedCategoryId = categoryId;
      toast("플레이리스트에 담았어요. 합계가 업데이트됐습니다.");
    } catch (error) {
      toast(error.message);
    }
  }

  async function handleProductAction(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const card = target.closest("[data-item-id]");
    const item = state.items.find((candidate) => candidate.id === card?.dataset.itemId);
    if (!item) return;

    try {
      if (target.dataset.action === "increase") await Repository.updateItem(item.id, { quantity: item.quantity + 1 });
      if (target.dataset.action === "decrease") await Repository.updateItem(item.id, { quantity: Math.max(1, item.quantity - 1) });
      if (target.dataset.action === "move") await Repository.updateItem(item.id, { categoryId: target.value });
      if (target.dataset.action === "remove") await Repository.removeItem(item.id);
    } catch (error) {
      toast(error.message);
    }
  }

  async function initialize() {
    const [storedState, preferences] = await Promise.all([Repository.load(), UiPreferences.load()]);
    state = storedState;
    libraryCollapsed = preferences.libraryCollapsed;
    render();
    await renderLibraryCollapsed();
    Repository.subscribe((nextState) => {
      state = nextState;
      render();
    });

    const session = await chrome.storage.session.get(["pendingProduct", "pendingProductError", "contextScanStarted"]);
    if (session.pendingProduct) {
      showCapture(session.pendingProduct);
      await chrome.storage.session.remove(["pendingProduct", "pendingProductError", "contextScanStarted"]);
    } else if (session.pendingProductError) {
      showCaptureError(session.pendingProductError);
      await chrome.storage.session.remove(["pendingProduct", "pendingProductError", "contextScanStarted"]);
    } else if (!session.contextScanStarted) {
      await scanCurrentPage();
    }
  }

  elements.scanButton.addEventListener("click", () => scanCurrentPage({ requestHostAccess: true }));
  elements.emptyScanButton.addEventListener("click", () => scanCurrentPage({ requestHostAccess: true }));
  elements.captureForm.addEventListener("submit", handleAdd);
  elements.categoryTabs.addEventListener("click", (event) => {
    const categoryItem = event.target.closest("[data-category-id]");
    const renameButton = event.target.closest('[data-action="rename-category"]');
    if (categoryItem && renameButton) {
      const category = state.categories.find((candidate) => candidate.id === categoryItem.dataset.categoryId);
      if (category) openCategoryDialog(category, category.id);
      return;
    }
    const tab = event.target.closest(".category-tab");
    if (!tab) return;
    selectedCategoryId = tab.closest("[data-category-id]").dataset.categoryId;
    render();
  });
  elements.categoryTabs.addEventListener("dragstart", (event) => {
    if (event.target.closest('[data-action="rename-category"]')) {
      event.preventDefault();
      return;
    }
    const tab = event.target.closest("[data-category-id]");
    if (!tab) return;
    draggedCategoryId = tab.dataset.categoryId;
    tab.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedCategoryId);
  });
  elements.categoryTabs.addEventListener("dragover", (event) => {
    if (!draggedCategoryId) return;
    const target = event.target.closest("[data-category-id]");
    const dragged = elements.categoryTabs.querySelector(`[data-category-id="${CSS.escape(draggedCategoryId)}"]`);
    if (!target || !dragged || target === dragged) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const insertBefore = event.clientX < target.getBoundingClientRect().left + target.offsetWidth / 2;
    const previousRects = categoryTabRects();
    elements.categoryTabs.insertBefore(dragged, insertBefore ? target : target.nextSibling);
    animateCategoryTabs(previousRects);
  });
  elements.categoryTabs.addEventListener("drop", async (event) => {
    if (!draggedCategoryId) return;
    event.preventDefault();
    const movedCategoryId = draggedCategoryId;
    draggedCategoryId = null;
    const categoryIds = [...elements.categoryTabs.querySelectorAll("[data-category-id]")]
      .map((tab) => tab.dataset.categoryId);
    await persistCategoryOrder(categoryIds, movedCategoryId);
  });
  elements.categoryTabs.addEventListener("dragend", (event) => {
    event.target.closest("[data-category-id]")?.classList.remove("dragging");
    if (draggedCategoryId) renderCategories();
    draggedCategoryId = null;
  });
  elements.categoryTabs.addEventListener("keydown", async (event) => {
    if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const tabButton = event.target.closest(".category-tab");
    const tab = tabButton?.closest("[data-category-id]");
    if (!tab) return;
    const categoryIds = state.categories.map((category) => category.id);
    const fromIndex = categoryIds.indexOf(tab.dataset.categoryId);
    const toIndex = fromIndex + (event.key === "ArrowLeft" ? -1 : 1);
    if (fromIndex < 0 || toIndex < 0 || toIndex >= categoryIds.length) return;
    event.preventDefault();
    [categoryIds[fromIndex], categoryIds[toIndex]] = [categoryIds[toIndex], categoryIds[fromIndex]];
    await persistCategoryOrder(categoryIds, tab.dataset.categoryId);
  });
  elements.productList.addEventListener("click", handleProductAction);
  elements.productList.addEventListener("change", handleProductAction);
  elements.newCategoryButton.addEventListener("click", () => openCategoryDialog());
  elements.toggleLibraryButton.addEventListener("click", async () => {
    const previousValue = libraryCollapsed;
    libraryCollapsed = !libraryCollapsed;
    void renderLibraryCollapsed({ animate: true });
    try {
      await UiPreferences.setLibraryCollapsed(libraryCollapsed);
    } catch (error) {
      libraryCollapsed = previousValue;
      await renderLibraryCollapsed({ animate: true });
      toast(error.message || "접기 설정을 저장하지 못했습니다.");
    }
  });
  elements.cancelCategoryButton.addEventListener("click", () => elements.categoryDialog.close());
  elements.categoryDialog.addEventListener("close", () => {
    const returnCategoryId = categoryDialogReturnId;
    editingCategoryId = null;
    categoryDialogReturnId = null;
    focusCategoryControl(returnCategoryId);
  });
  elements.categoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      if (editingCategoryId) {
        const categoryId = editingCategoryId;
        await Repository.renameCategory(categoryId, elements.categoryNameInput.value);
        elements.categoryDialog.close();
        toast("플레이리스트 이름을 변경했어요.");
        return;
      }
      const category = await Repository.createCategory(elements.categoryNameInput.value);
      selectedCategoryId = category.id;
      elements.categoryDialog.close();
      toast("새 플레이리스트를 만들었어요.");
    } catch (error) {
      toast(error.message);
    }
  });
  elements.deleteCategoryButton.addEventListener("click", async () => {
    const category = state.categories.find((candidate) => candidate.id === selectedCategoryId);
    if (!category || !confirm(`'${category.name}' 플레이리스트를 삭제할까요? 상품은 '내 쇼핑'으로 이동합니다.`)) return;
    await Repository.removeCategory(category.id);
    selectedCategoryId = "default";
    toast("플레이리스트를 삭제했어요.");
  });
  elements.priceInput.addEventListener("input", () => {
    const currency = capturedProduct?.currency || "KRW";
    const price = Core.parseMoney(elements.priceInput.value, currency);
    if (currency === "KRW") {
      elements.priceInput.value = price
        ? price.toLocaleString("ko-KR")
        : elements.priceInput.value.replace(/[^\d]/g, "");
    }
    if (!price) return;
    if (currency !== "KRW" && capturedProduct?.fx?.rateToKrw) {
      elements.krwPriceInput.value = Math.round(price * capturedProduct.fx.rateToKrw).toLocaleString("ko-KR");
    }
  });
  elements.krwPriceInput.addEventListener("input", () => {
    const price = Core.parsePrice(elements.krwPriceInput.value);
    elements.krwPriceInput.value = price
      ? price.toLocaleString("ko-KR")
      : elements.krwPriceInput.value.replace(/[^\d]/g, "");
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "CONTEXT_PRODUCT") {
      showCapture(message.product);
      chrome.storage.session.remove(["pendingProduct", "pendingProductError", "contextScanStarted"]);
    }
    if (message?.type === "CONTEXT_PRODUCT_ERROR") {
      showCaptureError(message.error);
      chrome.storage.session.remove(["pendingProduct", "pendingProductError", "contextScanStarted"]);
    }
  });
  chrome.permissions.onAdded.addListener(() => {
    if (waitingForHostAccess) scanCurrentPage();
  });

  initialize().catch((error) => {
    showCaptureError(error.message);
    toast("Shoply를 불러오지 못했습니다.");
  });
})();
