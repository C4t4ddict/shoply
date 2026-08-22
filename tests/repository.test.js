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

test("기본 플레이리스트 이름을 변경해도 상품 연결을 유지한다", async () => {
  await Repository.addProduct({
    title: "기본 상품", price: 10000, productUrl: "https://example.com/product/1", store: "테스트"
  }, "default");
  await Repository.renameCategory("default", "이번 달 살 것");

  const state = await Repository.load();
  assert.equal(state.categories.find((category) => category.id === "default").name, "이번 달 살 것");
  assert.equal(state.items[0].categoryId, "default");
});

test("플레이리스트 이름 수정 시 빈 값, 40자 초과, 중복을 거부한다", async () => {
  const travel = await Repository.createCategory("여행");
  const clothes = await Repository.createCategory("옷");

  await assert.rejects(Repository.renameCategory(travel.id, "   "), /이름을 입력해주세요/);
  await assert.rejects(Repository.renameCategory(travel.id, "가".repeat(41)), /40자 이하/);
  await assert.rejects(Repository.renameCategory(travel.id, "옷"), /이미 있습니다/);

  const state = await Repository.load();
  assert.equal(state.categories.find((category) => category.id === travel.id).name, "여행");
  assert.equal(state.categories.find((category) => category.id === clothes.id).name, "옷");
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

test("외화 상품의 원문 가격과 원화 환산가를 함께 저장한다", async () => {
  await Repository.addProduct({
    title: "Newegg GPU",
    price: 499.99,
    currency: "USD",
    krwPrice: 689986,
    fx: { rateToKrw: 1380, rateDate: "2026-08-21", status: "live", source: "frankfurter-v2" },
    productUrl: "https://www.newegg.com/p/1",
    store: "Newegg"
  }, "default");

  const state = await Repository.load();
  assert.equal(state.version, 2);
  assert.equal(state.items[0].price, 499.99);
  assert.equal(state.items[0].currency, "USD");
  assert.equal(state.items[0].krwPrice, 689986);
  assert.equal(globalThis.ShoplyCore.calculateCategoryTotal(state.items, "default"), 689986);
});

test("환산가 없는 외화 상품은 저장하지 않는다", async () => {
  await assert.rejects(Repository.addProduct({
    title: "환율 미확인 상품",
    price: 10,
    currency: "USD",
    productUrl: "https://example.com/product/foreign"
  }, "default"), /원화 환산 가격/);
});

test("KRW 상품 가격을 수정하면 현재가와 합계가 같이 바뀐다", async () => {
  const item = await Repository.addProduct({
    title: "가격 수정 상품", price: 32000, currency: "KRW",
    productUrl: "https://example.com/product/edit-krw"
  }, "default");
  await Repository.updateItem(item.id, { price: 24900, krwPrice: 24900, fx: null });
  const state = await Repository.load();
  assert.equal(state.items[0].price, 24900);
  assert.equal(state.items[0].krwPrice, 24900);
  assert.equal(globalThis.ShoplyCore.calculateCategoryTotal(state.items, "default"), 24900);
});

test("외화 상품은 원문가를 유지하고 예상 원화만 수정한다", async () => {
  const item = await Repository.addProduct({
    title: "해외 가격 수정", price: 19.99, currency: "USD", krwPrice: 27800,
    fx: { status: "live", rateToKrw: 1390 }, productUrl: "https://example.com/product/edit-usd"
  }, "default");
  await Repository.updateItem(item.id, {
    krwPrice: 26500,
    fx: { status: "manual", source: "user", rateToKrw: 26500 / 19.99 }
  });
  const state = await Repository.load();
  assert.equal(state.items[0].price, 19.99);
  assert.equal(state.items[0].krwPrice, 26500);
  assert.equal(state.items[0].fx.status, "manual");
});
