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
  assert.equal(detectSite("www.29cm.co.kr"), "29cm");
  assert.equal(detectSite("www.wconcept.co.kr"), "wconcept");
  assert.equal(detectSite("store.zigzag.kr"), "zigzag");
  assert.equal(detectSite("kream.co.kr"), "kream");
  assert.equal(detectSite("www.11st.co.kr"), "elevenst");
  assert.equal(detectSite("item.gmarket.co.kr"), "gmarket");
  assert.equal(detectSite("www.ssg.com"), "ssg");
  assert.equal(detectSite("www.lotteon.com"), "lotteon");
  assert.equal(detectSite("itempage3.auction.co.kr"), "auction");
  assert.equal(detectSite("www.aliexpress.com"), "aliexpress");
  assert.equal(detectSite("www.temu.com"), "temu");
  assert.equal(detectSite("www.amazon.com"), "amazon-us");
  assert.equal(detectSite("kr.iherb.com"), "iherb");
  assert.equal(detectSite("kr.shein.com"), "shein");
  assert.equal(detectSite("www.amazon.co.jp"), "amazon-jp");
  assert.equal(detectSite("www.ebay.com"), "ebay");
  assert.equal(detectSite("www.newegg.com"), "newegg");
  assert.equal(detectSite("fake-musinsa.com"), "generic");
  assert.equal(detectSite("11st.co.kr.example.com"), "generic");
  assert.equal(detectSite("shop.example.com"), "generic");
});
