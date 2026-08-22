const test = require("node:test");
const assert = require("node:assert/strict");

const Core = require("../src/shared.js");

test("한국 원화 문자열을 숫자로 변환한다", () => {
  assert.equal(Core.parsePrice("판매가 39,900원"), 39900);
  assert.equal(Core.parsePrice("₩ 1,249,000"), 1249000);
  assert.equal(Core.parsePrice("가격 없음"), null);
});

test("외화 소수점과 천 단위 구분자를 보존해 파싱한다", () => {
  assert.equal(Core.parseMoney("US $1,299.99", "USD"), 1299.99);
  assert.equal(Core.parseMoney(19.99, "USD"), 19.99);
  assert.equal(Core.parseMoney("¥12,800", "JPY"), 12800);
  assert.equal(Core.parseMoney("€1.299,95", "EUR"), 1299.95);
});

test("추적 파라미터만 제거하고 상품 옵션 파라미터는 유지한다", () => {
  const normalized = Core.normalizeUrl(
    "https://shop.example/product/1?color=black&utm_source=test&n_media=123#reviews"
  );
  assert.equal(normalized, "https://shop.example/product/1?color=black");
});

test("한 카테고리의 가격과 수량만 합산한다", () => {
  const items = [
    { categoryId: "travel", price: 10000, quantity: 2 },
    { categoryId: "travel", price: 3500, quantity: 1 },
    { categoryId: "clothes", price: 999999, quantity: 1 }
  ];
  assert.equal(Core.calculateCategoryTotal(items, "travel"), 23500);
});

test("외화 상품은 환산된 원화 가격으로만 합산한다", () => {
  const items = [
    { categoryId: "travel", price: 10, currency: "USD", krwPrice: 13800, quantity: 2 },
    { categoryId: "travel", price: 20, currency: "USD", quantity: 1 },
    { categoryId: "travel", price: 5000, currency: "KRW", quantity: 1 }
  ];
  assert.equal(Core.calculateCategoryTotal(items, "travel"), 32600);
});

test("KRW 상품은 읽은 현재가를 그대로 원화 가격에 사용한다", () => {
  assert.deepEqual(Core.productPriceFields({ price: 206640, currency: "KRW" }), {
    currency: "KRW", price: 206640, krwPrice: 206640, isForeign: false
  });
});

test("외화 상품은 현재가와 예상 원화를 별도 필드로 유지한다", () => {
  assert.deepEqual(Core.productPriceFields({ price: 19.99, currency: "USD", krwPrice: 27785 }), {
    currency: "USD", price: 19.99, krwPrice: 27785, isForeign: true
  });
});

test("대상 쇼핑몰 이름을 판별한다", () => {
  assert.equal(Core.siteNameFromHost("m.a-bly.com"), "에이블리");
  assert.equal(Core.siteNameFromHost("www.musinsa.com"), "무신사");
  assert.equal(Core.siteNameFromHost("www.coupang.com"), "쿠팡");
  assert.equal(Core.siteNameFromHost("smartstore.naver.com"), "네이버 쇼핑");
  assert.equal(Core.siteNameFromHost("item.gmarket.co.kr"), "G마켓");
  assert.equal(Core.siteNameFromHost("www.aliexpress.com"), "AliExpress");
  assert.equal(Core.siteNameFromHost("www.amazon.co.jp"), "Amazon Japan");
  assert.equal(Core.siteNameFromHost("www.newegg.com"), "Newegg");
  assert.equal(Core.siteNameFromHost("fake-musinsa.com"), "fake-musinsa.com");
});
