import assert from "node:assert/strict";
import {
  matchingSecurityCodes,
  securityFromMainlandCode,
  securitySearchPattern,
} from "../src/ui/securityCode";

const bank = {
  market: "USZA",
  code: "000001",
  name: "平安银行",
  fullCode: "USZA000001",
};
const index = {
  market: "USHA",
  code: "000001",
  name: "上证指数",
  fullCode: "USHA000001",
};
assert.equal(securitySearchPattern(" usza000001 "), "000001");
assert.equal(securitySearchPattern("600519"), "600519");
assert.deepEqual(securityFromMainlandCode("600519"), {
  market: "XSHG",
  code: "600519",
  fullCode: "XSHG600519",
});
assert.deepEqual(securityFromMainlandCode("000001"), {
  market: "XSHE",
  code: "000001",
  fullCode: "XSHE000001",
});
assert.equal(securityFromMainlandCode("920002"), undefined);
assert.deepEqual(matchingSecurityCodes(" usza000001 ", [index, bank]), [bank]);
assert.deepEqual(matchingSecurityCodes("000001", [bank, bank]), [bank]);
assert.deepEqual(matchingSecurityCodes("000001", [index, bank]), [index, bank]);
assert.deepEqual(matchingSecurityCodes("600519", [bank]), []);
assert.deepEqual(matchingSecurityCodes("平安银行", [bank]), [bank]);
assert.deepEqual(matchingSecurityCodes("", []), []);
process.stdout.write("纯股票代码匹配、去重及同码候选检查通过。\n");
