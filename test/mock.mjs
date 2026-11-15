import http from "node:http";
import assert from "node:assert/strict";
import { connect, text } from "./helpers.mjs";

const seen = [];
const queue = [];
const srv = http.createServer((req, res) => {
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", () => {
    seen.push({ method: req.method, url: req.url, body: body ? JSON.parse(body) : undefined, auth: req.headers.authorization });
    const next = queue.shift();
    if (next) { res.writeHead(next.status, next.headers ?? {}); return res.end(next.body ?? ""); }
    if (req.method === "DELETE") { res.writeHead(204); return res.end(); }
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Shopier-Pagination-Page": "1", "Shopier-Pagination-Limit": "5",
      "Shopier-Pagination-Total-Pages": "3", "Shopier-Pagination-Total-Items": "12",
    });
    res.end(JSON.stringify([{ id: "x" }]));
  });
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${srv.address().port}/v1`;
const ALL = { SHOPIER_ALLOW_WRITES: "1", SHOPIER_ALLOW_DANGEROUS: "1", SHOPIER_API_BASE_URL: BASE };

const c = await connect({ ...ALL, SHOPIER_PAT: "tok" });
const run = async (name, args) => {
  seen.length = 0;
  const r = await c.callTool({ name, arguments: args });
  return { r, text: text(r), req: [...seen] };
};
const ok = (m) => console.log("✓ " + m);

let t = await run("list_products", { categoryId: ["a", "b"], limit: 5, dateStart: "2026-11-01T00:00:00+0300", discount: false });
const u = new URL(t.req[0].url, "http://x");
assert.equal(u.pathname, "/v1/products");
assert.deepEqual(u.searchParams.getAll("categoryId"), ["a", "b"]);
assert.equal(u.searchParams.get("limit"), "5");
assert.equal(u.searchParams.get("discount"), "false");
assert.equal(u.searchParams.get("dateStart"), "2026-11-01T00:00:00+0300");
assert.match(t.req[0].url, /dateStart=2026-11-01T00%3A00%3A00%2B0300/);
assert.equal(t.req[0].auth, "Bearer tok");
assert.equal(JSON.parse(t.text).pagination.totalItems, 12);
ok("sorgu parametreleri (dizi, tarih, false) + pagination başlıkları");

for (const [name, args, why] of [
  ["list_orders", { limit: 500 }, "limit > 50"],
  ["get_order", { orderId: "" }, "boş ID"],
  ["get_order_transaction", { orderId: ".." }, "'..' ID"],
  ["delete_resource", { kind: "product", resourceId: " " }, "boşluk ID"],
  ["create_refund", { orderId: "o1", amount: "-5" }, "negatif tutar"],
  ["update_product", { productId: "p1", dispatchDuration: 7 }, "dispatchDuration > 3"],
]) {
  t = await run(name, args);
  assert.equal(t.r.isError, true, why);
  assert.equal(t.req.length, 0, `${why}: istek gönderilmemeli`);
}
ok("geçersiz girdiler (limit, boş/'..' ID, negatif tutar, aralık dışı) istek göndermeden reddediliyor");

t = await run("update_product", { productId: "p1", stockQuantity: 3 });
assert.equal(t.req[0].method, "PUT"); assert.equal(t.req[0].url, "/v1/products/p1");
assert.deepEqual(t.req[0].body, { stockQuantity: 3 });
t = await run("update_product", { productId: "p1", priceData: { price: "10" } });
assert.deepEqual(t.req[0].body, { priceData: { price: "10" } });
ok("update_product yalnızca verilen alanları gönderiyor (priceData para birimi olmadan)");

t = await run("update_product", { productId: "p1" });
assert.equal(t.r.isError, true); assert.equal(t.req.length, 0);
t = await run("update_order_shipping_address", { orderId: "o1" });
assert.equal(t.r.isError, true); assert.equal(t.req.length, 0);
t = await run("update_discount_code", { discountId: "d1" });
assert.equal(t.r.isError, true); assert.equal(t.req.length, 0);
ok("boş güncellemeler istek göndermeden reddediliyor");

t = await run("fulfill_order", { orderId: "o1", productType: "physical", shippingCompany: "yurtici", trackingNumber: "T" });
assert.deepEqual(t.req[0].body, { fulfillments: { productType: "physical", shippingCompany: "yurtici", trackingNumber: "T" } });
t = await run("fulfill_order", { orderId: "o1", productType: "digital" });
assert.equal(t.r.isError, true); assert.equal(t.req.length, 0);
t = await run("fulfill_order", { orderId: "o1", productType: "physical", shippingCompany: "mng" });
assert.equal(t.r.isError, true); assert.equal(t.req.length, 0);
ok("fulfill_order gövdesi + dijital not / fiziksel takip no zorunluluğu");

const product = {
  title: "Kupa", type: "physical", shippingPayer: "buyerPays",
  media: [{ url: "https://example.com/a.jpg", placement: 1 }],
  priceData: { currency: "TRY", price: "249.90", vatPercent: "20" },
};
t = await run("create_product", product);
assert.equal(t.req[0].method, "POST"); assert.equal(t.req[0].url, "/v1/products");
assert.deepEqual(t.req[0].body, { ...product, media: [{ type: "image", url: "https://example.com/a.jpg", placement: 1 }] });
ok("create_product gövdesi (media.type varsayılanı eklendi)");

for (const [title, why] of [
  ["Avokado 3'lü - Fuerte & Zutano", "& içeren başlık"],
  ["Kupa <b>", "< > içeren başlık"],
  ["x".repeat(81), "81 karakterlik başlık"],
  ["   ", "boş başlık"],
]) {
  t = await run("create_product", { ...product, title });
  assert.equal(t.r.isError, true, why);
  assert.equal(t.req.length, 0, `${why}: istek gönderilmemeli`);
}
t = await run("update_product", { productId: "p1", title: "A & B" });
assert.equal(t.r.isError, true); assert.equal(t.req.length, 0);
t = await run("create_product", { ...product, title: "  " + "Ç".repeat(80) + "  " });
assert.equal(t.req[0].body.title, "Ç".repeat(80));
ok("başlık: &, <, >, 80 karakter üstü ve boş başlık istek göndermeden reddediliyor; baştaki/sondaki boşluk kırpılıyor");

t = await run("create_discount_code", { code: "X", scope: "all", type: "percent", requirement: "amount", currency: "TRY", numAvailable: 5, expiresAt: "2026-12-31+0300" });
assert.equal(t.r.isError, true); assert.equal(t.req.length, 0);
t = await run("create_discount_code", { code: "X", scope: "all", type: "percent", percentOff: "15", requirement: "amount", currency: "TRY", numAvailable: 5, expiresAt: "2026-12-31+0300" });
assert.equal(t.req[0].url, "/v1/discounts/codes"); assert.equal(t.req[0].body.percentOff, "15");
ok("indirim kodu: type=percent için percentOff zorunlu, gövde doğru");

t = await run("create_refund", { orderId: "o1", amount: "120.00", note: "özür" });
assert.equal(t.req[0].url, "/v1/refunds"); assert.deepEqual(t.req[0].body, { orderId: "o1", amount: "120.00", note: "özür" });
ok("create_refund gövdesi");

t = await run("delete_resource", { kind: "shipping_code", resourceId: "a b" });
assert.equal(t.req[0].method, "DELETE"); assert.equal(t.req[0].url, "/v1/shippings/a%20b");
assert.match(t.text, /Silindi\./); assert.notEqual(t.r.isError, true);
ok("DELETE + ID kodlama + boş 204 yanıtı");

queue.push({ status: 404, body: '{"error":"notFound"}' });
t = await run("get_order", { orderId: "zz" });
assert.equal(t.r.isError, true); assert.match(t.text, /\(404\)/);
queue.push({ status: 403 });
t = await run("get_balance", {});
assert.match(t.text, /\(403\)/);
assert.doesNotMatch(t.text, /hello@shopier\.com/);
queue.push({ status: 403, body: '{"error":"forbidden"}' });
t = await run("get_product", { productId: "52978169" });
assert.match(t.text, /\(403\)/); assert.match(t.text, /hello@shopier\.com/);
ok("403/404 anlaşılır hataya dönüşüyor; ürün uç noktalarında 403'e hesap kısıtı notu ekleniyor");

queue.push({ status: 429, headers: { "Retry-After": "1" } });
t = await run("get_balance", {});
assert.equal(t.req.length, 2); assert.notEqual(t.r.isError, true);
queue.push({ status: 429, headers: { "Retry-After": "60" } });
t = await run("get_balance", {});
assert.equal(t.req.length, 1); assert.match(t.text, /60 saniye/);
ok("429: kısa Retry-After'da tek yeniden deneme, uzunsa beklemeden hata");

queue.push({ status: 500 });
t = await run("get_balance", {});
assert.equal(t.req.length, 2); assert.notEqual(t.r.isError, true);
queue.push({ status: 500 });
t = await run("create_refund", { orderId: "o1", amount: "1" });
assert.equal(t.req.length, 1); assert.match(t.text, /BİLİNMİYOR/);
ok("5xx: GET bir kez yeniden deneniyor; yazma işlemi tekrarlanmıyor ve 'sonuç bilinmiyor' deniyor");
await c.close();

const leaky = await connect({ ...ALL, SHOPIER_PAT: "sek\nret-token" });
seen.length = 0;
const r = await leaky.callTool({ name: "get_balance", arguments: {} });
assert.equal(r.isError, true);
assert.ok(!text(r).includes("ret-token") && !text(r).includes("sek"), "token sızmamalı: " + text(r));
assert.equal(seen.length, 0);
await leaky.close();
ok("geçersiz karakterli PAT: istek atılmıyor, token hata mesajında yok");

srv.close();
console.log("Mock API testleri geçti.");
