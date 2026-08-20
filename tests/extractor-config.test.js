const test = require("node:test");
const assert = require("node:assert/strict");

globalThis.ShoplyCore = require("../src/shared.js");
globalThis.location = { hostname: "example.test" };
require("../src/extractor.js");

const { detectSite } = globalThis.ShoplyExtractor;

test("각 목표 쇼핑몰을 전용 어댑터로 연결한다", () => {
  assert.equal(detectSite("m.a-bly.com"), "ably");
  assert.equal(detectSite("www.musinsa.com"), "musinsa");
  assert.equal(detectSite("www.coupang.com"), "coupang");
  assert.equal(detectSite("shopping.naver.com"), "naver");
  assert.equal(detectSite("smartstore.naver.com"), "naver");
  assert.equal(detectSite("shop.example.com"), "generic");
});
