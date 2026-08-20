(function () {
  "use strict";

  const Core = globalThis.ShoplyCore;
  const Repository = globalThis.ShoplyRepository;
  const elements = Object.fromEntries(
    [
      "scanButton", "emptyScanButton", "captureLoading", "captureEmpty", "captureForm", "captureImage",
      "captureStore", "confidenceBadge", "titleInput", "priceInput", "captureNotice", "optionSummary",
      "addCategorySelect", "categoryTabs", "activeCategoryName", "activeItemCount", "activeCategoryTotal",
      "emptyLibrary", "productList", "newCategoryButton", "categoryDialog", "categoryForm",
      "categoryNameInput", "cancelCategoryButton", "deleteCategoryButton", "toast"
    ].map((id) => [id, document.getElementById(id)])
  );

  let state = null;
  let selectedCategoryId = "default";
  let capturedProduct = null;
  let toastTimer = null;

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
    capturedProduct = product;
    elements.captureLoading.classList.add("hidden");
    elements.captureEmpty.classList.add("hidden");
    elements.captureForm.classList.remove("hidden");
    elements.titleInput.value = product.title || "";
    elements.priceInput.value = product.price ? Number(product.price).toLocaleString("ko-KR") : "";
    elements.captureImage.src = product.imageUrl || "";
    elements.captureImage.style.display = product.imageUrl ? "block" : "none";
    elements.captureStore.textContent = product.store || "쇼핑몰";

    const review = product.needsReview || !product.price;
    elements.confidenceBadge.textContent = review ? "가격 확인 필요" : "자동 인식 완료";
    elements.confidenceBadge.classList.toggle("good", !review);
    elements.captureNotice.classList.toggle("hidden", !review);
    elements.captureNotice.textContent = product.price
      ? "여러 가격이 있는 페이지일 수 있어요. 담기 전에 현재 가격을 한 번 확인해주세요."
      : "가격을 자동으로 찾지 못했어요. 페이지에 표시된 현재 판매가를 직접 입력해주세요.";

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

  async function scanCurrentPage() {
    elements.captureEmpty.classList.add("hidden");
    elements.captureForm.classList.add("hidden");
    elements.captureLoading.classList.remove("hidden");
    try {
      const response = await chrome.runtime.sendMessage({ type: "EXTRACT_ACTIVE_TAB" });
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

  function renderCategories() {
    if (!state.categories.some((category) => category.id === selectedCategoryId)) selectedCategoryId = "default";
    elements.categoryTabs.innerHTML = state.categories
      .map((category) => {
        const count = state.items.filter((item) => item.categoryId === category.id).length;
        return `<button class="category-tab" type="button" role="tab" data-category-id="${category.id}" aria-selected="${category.id === selectedCategoryId}">${escapeHtml(category.name)}<b>${count}</b></button>`;
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
            <span class="product-price">${Core.formatPrice(item.price, item.currency)}</span>
            <div class="quantity" aria-label="수량">
              <button type="button" data-action="decrease" aria-label="수량 줄이기">−</button>
              <span>${item.quantity}</span>
              <button type="button" data-action="increase" aria-label="수량 늘리기">＋</button>
            </div>
          </div>
          <div class="product-actions">
            <select data-action="move" aria-label="카테고리 이동">${categoryOptions(item.categoryId)}</select>
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

  async function handleAdd(event) {
    event.preventDefault();
    if (!capturedProduct) return;
    const price = Core.parsePrice(elements.priceInput.value);
    if (!price) {
      elements.priceInput.focus();
      toast("현재 판매 가격을 입력해주세요.");
      return;
    }
    try {
      const categoryId = elements.addCategorySelect.value;
      await Repository.addProduct(
        { ...capturedProduct, title: elements.titleInput.value, price },
        categoryId
      );
      selectedCategoryId = categoryId;
      toast("카테고리에 담았어요. 합계가 업데이트됐습니다.");
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
    state = await Repository.load();
    render();
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

  elements.scanButton.addEventListener("click", scanCurrentPage);
  elements.emptyScanButton.addEventListener("click", scanCurrentPage);
  elements.captureForm.addEventListener("submit", handleAdd);
  elements.categoryTabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-category-id]");
    if (!tab) return;
    selectedCategoryId = tab.dataset.categoryId;
    render();
  });
  elements.productList.addEventListener("click", handleProductAction);
  elements.productList.addEventListener("change", handleProductAction);
  elements.newCategoryButton.addEventListener("click", () => {
    elements.categoryNameInput.value = "";
    elements.categoryDialog.showModal();
    elements.categoryNameInput.focus();
  });
  elements.cancelCategoryButton.addEventListener("click", () => elements.categoryDialog.close());
  elements.categoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const category = await Repository.createCategory(elements.categoryNameInput.value);
      selectedCategoryId = category.id;
      elements.categoryDialog.close();
      toast("새 카테고리를 만들었어요.");
    } catch (error) {
      toast(error.message);
    }
  });
  elements.deleteCategoryButton.addEventListener("click", async () => {
    const category = state.categories.find((candidate) => candidate.id === selectedCategoryId);
    if (!category || !confirm(`'${category.name}' 카테고리를 삭제할까요? 상품은 '내 쇼핑'으로 이동합니다.`)) return;
    await Repository.removeCategory(category.id);
    selectedCategoryId = "default";
    toast("카테고리를 삭제했어요.");
  });
  elements.priceInput.addEventListener("input", () => {
    const price = Core.parsePrice(elements.priceInput.value);
    elements.priceInput.value = price ? price.toLocaleString("ko-KR") : elements.priceInput.value.replace(/[^\d]/g, "");
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

  initialize().catch((error) => {
    showCaptureError(error.message);
    toast("Shoply를 불러오지 못했습니다.");
  });
})();
