const test = require("node:test");
const assert = require("node:assert/strict");

const Core = require("../src/shared.js");

test("한국 원화 문자열을 숫자로 변환한다", () => {
  assert.equal(Core.parsePrice("판매가 39,900원"), 39900);
  assert.equal(Core.parsePrice("₩ 1,249,000"), 1249000);
  assert.equal(Core.parsePrice("가격 없음"), null);
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

test("대상 쇼핑몰 이름을 판별한다", () => {
  assert.equal(Core.siteNameFromHost("m.a-bly.com"), "에이블리");
  assert.equal(Core.siteNameFromHost("www.musinsa.com"), "무신사");
  assert.equal(Core.siteNameFromHost("www.coupang.com"), "쿠팡");
  assert.equal(Core.siteNameFromHost("smartstore.naver.com"), "네이버 쇼핑");
});
