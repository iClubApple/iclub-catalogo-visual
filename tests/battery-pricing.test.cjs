const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const helpers = source.slice(source.indexOf("    function physicalSerial("), source.indexOf("    function selectedBatteryOption("));
const { attachBatteryPriceOptions } = vm.runInNewContext(`${helpers}\n({ attachBatteryPriceOptions })`, {
  normalize: value => String(value || "").toLowerCase().trim(),
  isUsed: product => product.condition === "SEMINUEVO",
});

function product(model, capacity, cash, tier, row, extra = {}) {
  return { model, capacity, cash, batteryPriceTier: tier, battery: tier === "battery_100" ? "100%" : "90%", category: "iPhone", condition: "SEMINUEVO", stock: 0, color: "", serial: "", priceList: cash, transfer: cash, raw: { __rowNumber: row }, ...extra };
}

test("a copied heading never links iPhone 17 Pro Max to iPhone 16 prices", () => {
  const oldReference = product("IPHONE 16 PRO MAX", "256GB", "USD 970", "battery_100", 359);
  const correctReference = product("IPHONE 17 PRO MAX", "256GB", "USD 1.280", "battery_100", 432, { batteryPriceModel: "IPHONE 16 PRO MAX" });
  const actual = product("IPHONE 17 PRO MAX", "256GB", "USD 1.220", "battery_under_99", 438, { batteryPriceModel: "IPHONE 16 PRO MAX" });
  attachBatteryPriceOptions([oldReference, correctReference, actual]);
  assert.equal(actual.cash, "USD 1.220");
  assert.equal(actual.batteryPricing.new100.cash, "USD 1.280");
  assert.equal(actual.batteryPricing.new100.referenceRow, 432);
});

test("references match capacity and condition and never fall back to another model", () => {
  const base = product("IPHONE 17 PRO MAX", "256GB", "USD 1.220", "battery_under_99", 438);
  const wrongCapacity = product("IPHONE 17 PRO MAX", "512GB", "USD 1.380", "battery_100", 444);
  const wrongModel = product("IPHONE 16 PRO MAX", "256GB", "USD 970", "battery_100", 359);
  const wrongCondition = product("IPHONE 17 PRO MAX", "256GB", "USD 1.340", "battery_100", 37, { condition: "NEW" });
  attachBatteryPriceOptions([base, wrongCapacity, wrongModel, wrongCondition]);
  assert.equal(base.batteryPricing, null);
});

test("an inherited 100% heading does not make a 90% device a replacement-price reference", () => {
  const fakeReference = product("IPHONE 17 PRO MAX", "256GB", "USD 1.220", "battery_100", 431, { battery: "90%" });
  const base = product("IPHONE 17 PRO MAX", "256GB", "USD 1.220", "battery_under_99", 438);
  const output = attachBatteryPriceOptions([fakeReference, base]);
  assert.equal(base.batteryPricing, null);
  assert(output.includes(fakeReference));
});

test("generic replacement prices take precedence over a physical unit and retain all payment prices", () => {
  const physical = product("IPHONE 17 PRO MAX", "256GB", "USD 1.230", "battery_100", 431, { stock: 1, color: "Gold", serial: "device-serial" });
  const reference = product("IPHONE 17 PRO MAX", "256GB", "USD 1.280", "battery_100", 432, { transfer: "USD 1.470", priceList: "USD 2.130" });
  const base = product("IPHONE 17 PRO MAX", "256GB", "USD 1.220", "battery_under_99", 438);
  const output = attachBatteryPriceOptions([physical, reference, base]);
  assert.equal(base.batteryPricing.new100.transfer, "USD 1.470");
  assert.equal(base.batteryPricing.new100.priceList, "USD 2.130");
  assert.equal(base.batteryPricing.new100.cash, "USD 1.280");
  assert(output.includes(physical));
  assert(!output.includes(reference));
});
