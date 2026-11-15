import assert from "node:assert/strict";
import { connect, names, text } from "./helpers.mjs";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const readmes = fs.readdirSync(rootDir).filter((f) => /^readme/i.test(f));
assert.deepEqual(readmes, ["README.md"], "npm picks an arbitrary README* from the root; keep only README.md there");
console.log("✓ kökte yalnızca README.md var (npm sayfası İngilizce README'yi gösterir)");

let c = await connect({});
let n = await names(c);
assert.equal(n.length, 17);
assert.ok(n.includes("list_orders") && !n.includes("create_product") && !n.includes("create_refund"));
let r = await c.callTool({ name: "get_balance", arguments: {} });
assert.equal(r.isError, true);
assert.match(text(r), /SHOPIER_PAT ortam değişkeni tanımlı değil/);
await c.close();
console.log("✓ varsayılan: 17 okuma aracı, PAT yokken anlaşılır hata");

c = await connect({ SHOPIER_ALLOW_DANGEROUS: "true" });
assert.equal((await names(c)).length, 17);
await c.close();
console.log("✓ yalnızca DANGEROUS açık: yazma kapalı olduğu için yine 17");

c = await connect({ SHOPIER_ALLOW_WRITES: "true" });
n = await names(c);
assert.equal(n.length, 26);
assert.ok(n.includes("create_product") && !n.includes("create_refund"));
await c.close();
console.log("✓ yazma açık: 26 araç");

c = await connect({ SHOPIER_ALLOW_WRITES: "true", SHOPIER_ALLOW_DANGEROUS: "true" });
const tools = (await c.listTools()).tools;
assert.equal(tools.length, 28);
assert.ok(tools.find((t) => t.name === "create_refund").annotations.destructiveHint);
assert.deepEqual(tools.find((t) => t.name === "update_product").inputSchema.required, ["productId"]);
await c.close();
console.log("✓ hepsi açık: 28 araç, açıklamalar ve şemalar doğru");

console.log("Smoke testleri geçti.\n");
