const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const fontsCss = fs.readFileSync(path.join(root, "styles", "fonts.css"), "utf8");
const sidepanelHtml = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
const sidepanelCss = fs.readFileSync(path.join(root, "styles", "sidepanel.css"), "utf8");

test("Spoqa Han Sans Neo 폰트와 라이선스를 로컬 번들한다", () => {
  const fontDirectory = path.join(root, "assets", "fonts", "spoqa-han-sans-neo");
  for (const file of [
    "SpoqaHanSansNeo-Regular.woff2",
    "SpoqaHanSansNeo-Medium.woff2",
    "SpoqaHanSansNeo-Bold.woff2",
    "LICENSE_OFL.txt"
  ]) {
    assert.equal(fs.statSync(path.join(fontDirectory, file)).size > 0, true);
  }
});

test("세 웨이트를 선언하고 전체 UI에 Spoqa 폰트를 적용한다", () => {
  for (const weight of [400, 500, 700]) {
    assert.match(fontsCss, new RegExp(`font-weight:\\s*${weight}`));
  }
  assert.equal(sidepanelHtml.indexOf("styles/fonts.css") < sidepanelHtml.indexOf("styles/sidepanel.css"), true);
  assert.match(sidepanelCss, /--font-sans:\s*"Spoqa Han Sans Neo"/);
  assert.doesNotMatch(sidepanelCss, /Georgia|Pretendard|Noto Sans|Noto Serif|Inter/);
});
