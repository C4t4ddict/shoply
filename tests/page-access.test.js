const test = require("node:test");
const assert = require("node:assert/strict");

const PageAccess = require("../src/page-access.js");
const manifest = require("../manifest.json");

test("일반 웹페이지만 스크립트 실행 대상으로 허용한다", () => {
  assert.equal(PageAccess.isScriptableUrl("https://shop.example/product/1"), true);
  assert.equal(PageAccess.isScriptableUrl("http://localhost:3000/product/1"), true);
  assert.equal(PageAccess.isScriptableUrl("chrome://extensions"), false);
  assert.equal(PageAccess.isScriptableUrl("file:///tmp/product.html"), false);
});

test("호스트 권한 오류를 사이트 접근 요청 대상으로 판별한다", () => {
  assert.equal(PageAccess.isHostPermissionError(new Error("Cannot access contents of url")), true);
  assert.equal(PageAccess.isHostPermissionError(new Error("Missing host permission for the tab")), true);
  assert.equal(PageAccess.isHostPermissionError(new Error("상품 정보를 찾지 못했습니다.")), false);
});

test("주요 쇼핑몰은 고정 권한, 일반 사이트는 선택 권한으로 선언한다", () => {
  assert.equal(Number(manifest.minimum_chrome_version) >= 133, true);
  assert.deepEqual(manifest.host_permissions, [
    "https://*.a-bly.com/*",
    "https://*.ably.co.kr/*",
    "https://*.musinsa.com/*",
    "https://*.coupang.com/*",
    "https://*.naver.com/*"
  ]);
  assert.deepEqual(manifest.optional_host_permissions, ["http://*/*", "https://*/*"]);
});
