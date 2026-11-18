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
const readNames = n;
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
const writeNames = n.filter((t) => !readNames.includes(t));
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

const allNames = tools.map((t) => t.name);
const dangerNames = allNames.filter((t) => !readNames.includes(t) && !writeNames.includes(t)).sort();
const skill = fs.readFileSync(new URL("../skills/using-shopier-mcp/SKILL.md", import.meta.url), "utf8");
const toolRefs = (s) => [...s.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)].map((m) => m[1]);
for (const t of toolRefs(skill)) assert.ok(allNames.includes(t), `SKILL.md bilinmeyen bir araçtan söz ediyor: ${t}`);
const row = (flags) => skill.split("\n").find((l) => l.startsWith(`| ${flags} |`)) ?? "";
assert.deepEqual(toolRefs(row("`SHOPIER_ALLOW_WRITES`")).sort(), writeNames.sort(), "SKILL.md yazma araçları listesi eskimiş");
assert.deepEqual(
  toolRefs(row("`SHOPIER_ALLOW_WRITES` and `SHOPIER_ALLOW_DANGEROUS`")).sort(),
  dangerNames,
  "SKILL.md tehlikeli araçlar listesi eskimiş",
);
assert.match(skill, new RegExp(`${readNames.length} read tools`));
const { version } = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
for (const [, v] of skill.matchAll(/shopier-mcp@([\d.]+)/g)) assert.equal(v, version, "SKILL.md eski bir sürüm numarası içeriyor");
console.log("✓ SKILL.md: araç adları, bayrak tablosu ve sürüm sunucuyla uyumlu");

console.log("Smoke testleri geçti.\n");
