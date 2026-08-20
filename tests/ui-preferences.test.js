const test = require("node:test");
const assert = require("node:assert/strict");

const UiPreferences = require("../src/ui-preferences.js");

function memoryStorage(initial = {}) {
  const values = { ...initial };
  return {
    async get(key) {
      return { [key]: values[key] };
    },
    async set(patch) {
      Object.assign(values, patch);
    }
  };
}

test("접힘 설정이 없으면 카테고리 영역을 펼친다", async () => {
  const preferences = await UiPreferences.load(memoryStorage());
  assert.equal(preferences.libraryCollapsed, false);
});

test("카테고리 접힘 상태를 저장하고 다시 불러온다", async () => {
  const storage = memoryStorage();
  await UiPreferences.setLibraryCollapsed(true, storage);
  const preferences = await UiPreferences.load(storage);
  assert.equal(preferences.libraryCollapsed, true);
});
