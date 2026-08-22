const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
const script = fs.readFileSync(path.join(root, "src", "sidepanel.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles", "sidepanel.css"), "utf8");

test("상품 카드에서 가격 수정 다이얼로그를 열고 저장한다", () => {
  assert.match(html, /id="priceDialog"/);
  assert.match(html, /id="editPriceInput"/);
  assert.match(script, /data-action="edit-price"/);
  assert.match(script, /Repository\.updateItem\(item\.id/);
});

test("주요 UI에 10px 미만의 작은 텍스트를 사용하지 않는다", () => {
  assert.doesNotMatch(styles, /font-size:\s*[1-9]px/);
});
