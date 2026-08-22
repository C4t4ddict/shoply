const test = require("node:test");
const assert = require("node:assert/strict");
const ExchangeRate = require("../src/exchange-rate.js");

function memoryStorage(initial = {}) {
  const memory = { ...initial };
  return {
    memory,
    async get(key) { return { [key]: memory[key] }; },
    async set(values) { Object.assign(memory, values); }
  };
}

test("최신 환율로 외화 가격을 원화로 환산한다", async () => {
  const storage = memoryStorage();
  const service = ExchangeRate.createService({
    storage,
    now: () => 1_000_000,
    fetchFn: async () => ({ ok: true, async json() { return { date: "2026-08-21", rate: 1380.5 }; } })
  });
  const product = await service.convertProduct({ price: 19.99, currency: "USD" });
  assert.equal(product.krwPrice, 27596);
  assert.equal(product.price, 19.99);
  assert.equal(product.fx.status, "live");
});

test("24시간 이내 캐시는 네트워크 없이 사용한다", async () => {
  const storage = memoryStorage({
    [ExchangeRate.CACHE_KEY]: { USD: { rateToKrw: 1400, rateDate: "2026-08-21", fetchedAt: 900_000, source: "frankfurter-v2" } }
  });
  let calls = 0;
  const service = ExchangeRate.createService({ storage, now: () => 1_000_000, fetchFn: async () => { calls += 1; } });
  const rate = await service.getRate("USD");
  assert.equal(rate.status, "cached");
  assert.equal(calls, 0);
});

test("갱신 실패 시 7일 이내의 마지막 환율을 사용한다", async () => {
  const now = 8 * 24 * 60 * 60 * 1000;
  const storage = memoryStorage({
    [ExchangeRate.CACHE_KEY]: { USD: { rateToKrw: 1390, rateDate: "2026-08-17", fetchedAt: now - 2 * 24 * 60 * 60 * 1000, source: "frankfurter-v2" } }
  });
  const service = ExchangeRate.createService({ storage, now: () => now, fetchFn: async () => { throw new Error("offline"); } });
  const rate = await service.getRate("USD");
  assert.equal(rate.status, "stale");
  assert.equal(rate.rateToKrw, 1390);
});

test("7일을 넘긴 캐시는 실패를 숨기지 않는다", async () => {
  const now = 10 * 24 * 60 * 60 * 1000;
  const storage = memoryStorage({
    [ExchangeRate.CACHE_KEY]: { USD: { rateToKrw: 1390, rateDate: "2026-08-01", fetchedAt: 1, source: "frankfurter-v2" } }
  });
  const service = ExchangeRate.createService({ storage, now: () => now, fetchFn: async () => { throw new Error("offline"); } });
  await assert.rejects(service.getRate("USD"), /offline/);
});
