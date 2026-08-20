const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

globalThis.ShoplyCore = require("../src/shared.js");
globalThis.crypto = { randomUUID };

const memory = {};
const listeners = [];
globalThis.chrome = {
  storage: {
    local: {
      async get(key) {
        return { [key]: memory[key] };
      },
      async set(values) {
        Object.assign(memory, values);
      }
    },
    onChanged: {
      addListener(listener) { listeners.push(listener); },
      removeListener(listener) {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      }
    }
  }
};

require("../src/repository.js");
const Repository = globalThis.ShoplyRepository;

test.beforeEach(() => {
  delete memory[Repository.STORAGE_KEY];
});

test("서로 다른 쇼핑몰의 상품을 같은 카테고리에 저장한다", async () => {
  const category = await Repository.createCategory("여름 여행");
  await Repository.addProduct({
    title: "무신사 반팔티", price: 29000, productUrl: "https://musinsa.com/products/1", store: "무신사"
  }, category.id);
  await Repository.addProduct({
    title: "쿠팡 선크림", price: 12000, productUrl: "https://coupang.com/vp/2", store: "쿠팡"
  }, category.id);

  const state = await Repository.load();
  assert.equal(state.items.length, 2);
  assert.deepEqual(new Set(state.items.map((item) => item.store)), new Set(["무신사", "쿠팡"]));
  assert.equal(globalThis.ShoplyCore.calculateCategoryTotal(state.items, category.id), 41000);
});

test("같은 상품을 다시 추가하면 수량과 합계가 증가한다", async () => {
  const product = {
    title: "에이블리 원피스", price: 25000,
    productUrl: "https://m.a-bly.com/goods/10?utm_source=ad", store: "에이블리"
  };
  await Repository.addProduct(product, "default");
  await Repository.addProduct({ ...product, productUrl: "https://m.a-bly.com/goods/10" }, "default");

  const state = await Repository.load();
  assert.equal(state.items.length, 1);
  assert.equal(state.items[0].quantity, 2);
  assert.equal(globalThis.ShoplyCore.calculateCategoryTotal(state.items, "default"), 50000);
});

test("카테고리를 삭제하면 상품은 기본 카테고리로 이동한다", async () => {
  const category = await Repository.createCategory("삭제 예정");
  await Repository.addProduct({
    title: "네이버 가방", price: 79000, productUrl: "https://smartstore.naver.com/a/products/1", store: "네이버 쇼핑"
  }, category.id);
  await Repository.removeCategory(category.id);

  const state = await Repository.load();
  assert.equal(state.categories.some((item) => item.id === category.id), false);
  assert.equal(state.items[0].categoryId, "default");
});

test("카테고리 순서를 변경하고 저장한다", async () => {
  const travel = await Repository.createCategory("여행");
  const clothes = await Repository.createCategory("옷");

  await Repository.reorderCategories([clothes.id, "default", travel.id]);

  const state = await Repository.load();
  assert.deepEqual(state.categories.map((category) => category.id), [clothes.id, "default", travel.id]);
});

test("누락되거나 중복된 카테고리 순서는 거부한다", async () => {
  const travel = await Repository.createCategory("여행");
  await assert.rejects(
    Repository.reorderCategories(["default", "default"]),
    /순서 정보가 올바르지 않습니다/
  );
  const state = await Repository.load();
  assert.deepEqual(state.categories.map((category) => category.id), ["default", travel.id]);
});
