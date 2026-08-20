const MENU_ID = "shoply-add-product";

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "현재 상품을 Shoply에 추가",
      contexts: ["page", "image", "link"]
    });
  });
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

async function extractFromTab(tabId) {
  if (!tabId) throw new Error("현재 탭을 찾지 못했습니다.");
  const tab = await chrome.tabs.get(tabId);
  if (!/^https?:/i.test(tab.url || "")) {
    throw new Error("일반 웹페이지에서만 상품을 추가할 수 있습니다.");
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["src/shared.js", "src/extractor.js"]
  });
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => globalThis.ShoplyExtractor.extract()
  });
  return result?.result || null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "EXTRACT_ACTIVE_TAB") return false;

  (async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const product = await extractFromTab(tab?.id);
      sendResponse({ ok: true, product });
    } catch (error) {
      sendResponse({ ok: false, error: error.message || "상품 정보를 읽지 못했습니다." });
    }
  })();
  return true;
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  await chrome.storage.session.set({ contextScanStarted: true });
  await chrome.sidePanel.open({ tabId: tab.id });
  try {
    const product = await extractFromTab(tab.id);
    await chrome.storage.session.set({ pendingProduct: product });
    await chrome.storage.session.remove(["pendingProductError", "contextScanStarted"]);
    chrome.runtime.sendMessage({ type: "CONTEXT_PRODUCT", product }).catch(() => {});
  } catch (error) {
    await chrome.storage.session.set({ pendingProductError: error.message });
    await chrome.storage.session.remove(["pendingProduct", "contextScanStarted"]);
    chrome.runtime.sendMessage({ type: "CONTEXT_PRODUCT_ERROR", error: error.message }).catch(() => {});
  }
});
