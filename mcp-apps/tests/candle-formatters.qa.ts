import assert from "node:assert/strict";

import {
  formatOrderBookAmount,
  formatPrice,
  formatSignedPrice,
} from "../src/features/candle/formatters";

assert.equal(formatPrice(1235.58), "1235.58");
assert.equal(formatPrice(1235), "1235.00");
assert.equal(formatPrice(1235.678), "1235.678");
assert.equal(formatPrice(1234567.89), "1234567.89");
assert.equal(formatSignedPrice(1235.58), "+1235.58");
assert.doesNotMatch(formatPrice(1234567.89), /[,，]/);
assert.equal(formatOrderBookAmount(9.23, 137900), "127.28万");
assert.equal(formatOrderBookAmount(9.13, 81500), "74.41万");
assert.equal(formatOrderBookAmount(null, 81500), "—");
assert.equal(formatOrderBookAmount(9.13, null), "—");

process.stdout.write("K 线价格和盘口委托金额格式验收通过。\n");
