(function (root, factory) {
  const api = factory(root);
  root.ShoplyUiPreferences = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const STORAGE_KEY = "shoplyUiPreferences";
  const DEFAULTS = { libraryCollapsed: false };

  async function load(storage = root.chrome?.storage?.local) {
    if (!storage) return { ...DEFAULTS };
    const result = await storage.get(STORAGE_KEY);
    return { ...DEFAULTS, ...(result[STORAGE_KEY] || {}) };
  }

  async function setLibraryCollapsed(collapsed, storage = root.chrome?.storage?.local) {
    if (!storage) throw new Error("UI 설정 저장소를 찾지 못했습니다.");
    const preferences = await load(storage);
    preferences.libraryCollapsed = Boolean(collapsed);
    await storage.set({ [STORAGE_KEY]: preferences });
    return preferences;
  }

  return { STORAGE_KEY, load, setLibraryCollapsed };
});
