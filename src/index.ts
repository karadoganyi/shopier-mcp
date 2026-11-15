#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ShopierClient, ShopierError, VERSION, type Query } from "./client.js";

const env = (k: string) => process.env[k]?.trim() || undefined;
const flag = (k: string) => ["1", "true", "yes", "on"].includes((env(k) ?? "").toLowerCase());

const ALLOW_WRITES = flag("SHOPIER_ALLOW_WRITES");
const ALLOW_DANGEROUS = flag("SHOPIER_ALLOW_DANGEROUS");

let client: ShopierClient;
try {
  client = new ShopierClient(env("SHOPIER_PAT"), env("SHOPIER_API_BASE_URL"));
} catch (err) {
  console.error(`shopier-mcp başlatılamadı: ${(err as Error).message}`);
  process.exit(1);
}
const server = new McpServer({ name: "shopier", version: VERSION });

const id = (v: string) => encodeURIComponent(v);

const idParam = (desc?: string) => {
  const s = z
    .string()
    .trim()
    .min(1, "ID boş olamaz.")
    .refine((v) => v !== "." && v !== "..", "Geçersiz ID.");
  return desc ? s.describe(desc) : s;
};

type Result = { content: { type: "text"; text: string }[]; isError?: boolean };

const fail = (text: string): Result => ({ content: [{ type: "text", text }], isError: true });
const NOTHING_TO_UPDATE = "Güncellenecek alan verilmedi; hiçbir istek gönderilmedi.";

async function call(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  opts: { query?: Query; body?: unknown } = {},
): Promise<Result> {
  try {
    const res = await client.request(method, path, opts);
    const payload: Record<string, unknown> = {};
    if (res.pagination) payload.pagination = res.pagination;
    payload.data = res.data ?? (method === "DELETE" ? "Silindi." : null);
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  } catch (err) {
    const msg = err instanceof ShopierError ? err.message : `Beklenmeyen hata: ${(err as Error).message}`;
    return { content: [{ type: "text", text: msg }], isError: true };
  }
}

function compact<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };
const UPDATE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const OVERWRITE = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true };
const DANGER = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true };

const DATETIME_HINT = "Biçim: yyyy-MM-ddTHH:mm:ss+0300 (ofsette iki nokta yok), örn. 2026-11-01T00:00:00+0300.";
const DATE_HINT = "Biçim: yyyy-MM-dd+0300, örn. 2026-12-31+0300.";

const paging = {
  page: z.number().int().min(1).optional().describe("Sayfa numarası (varsayılan 1)."),
  limit: z.number().int().min(1).max(50).optional().describe("Sayfa başına kayıt, en fazla 50 (varsayılan 10)."),
};
const dateSort = z.enum(["dateDesc", "dateAsc"]).optional().describe("Tarihe göre sıralama (varsayılan dateDesc).");
const dateRange = {
  dateStart: z.string().optional().describe(`Bu tarihte veya sonrasında. ${DATETIME_HINT}`),
  dateEnd: z.string().optional().describe(`Bu tarihte veya öncesinde. ${DATETIME_HINT}`),
};
const currency = z.enum(["TRY", "USD", "EUR"]);
const LIST_NOTE = " Yanıttaki pagination alanı sayfa ve toplam kayıt sayısını gösterir.";

server.registerTool(
  "list_orders",
  {
    title: "Siparişleri listele",
    description:
      "Mağazanın siparişlerini listeler, en yeni önce. Tarih verilmezse yalnızca son 60 günün siparişleri döner." + LIST_NOTE,
    inputSchema: {
      ...dateRange,
      fulfillmentStatus: z.enum(["unfulfilled", "fulfilled"]).optional().describe("Gönderim durumu."),
      refundType: z.enum(["none", "partial", "full"]).optional().describe("İade durumu."),
      customerEmail: z.string().optional(),
      customerPhone: z.string().optional(),
      productId: z.string().optional().describe("Bu ürünü içeren siparişler."),
      sort: dateSort,
      ...paging,
    },
    annotations: READ,
  },
  (args) => call("GET", "/orders", { query: args }),
);

server.registerTool(
  "get_order",
  {
    title: "Sipariş detayı",
    description: "Tek bir siparişin tüm detaylarını getirir (alıcı, ürünler, adres, gönderim).",
    inputSchema: { orderId: idParam("Sipariş ID.") },
    annotations: READ,
  },
  ({ orderId }) => call("GET", `/orders/${id(orderId)}`),
);

server.registerTool(
  "get_order_transaction",
  {
    title: "Sipariş ödeme işlemi",
    description: "Bir siparişin ödeme/finans işlem kaydını getirir (komisyon, net tutar vb.).",
    inputSchema: { orderId: idParam() },
    annotations: READ,
  },
  ({ orderId }) => call("GET", `/orders/transactions/${id(orderId)}`),
);

server.registerTool(
  "list_products",
  {
    title: "Ürünleri listele",
    description: "Mağazadaki ürünleri filtreleyerek listeler." + LIST_NOTE,
    inputSchema: {
      dateStart: z.string().optional().describe(`İlk listeleme tarihi en erken. ${DATETIME_HINT}`),
      dateEnd: z.string().optional().describe(`İlk listeleme tarihi en geç. ${DATETIME_HINT}`),
      dateUpdatedStart: z.string().optional().describe(`Güncellenme tarihi en erken. ${DATETIME_HINT}`),
      dateUpdatedEnd: z.string().optional().describe(`Güncellenme tarihi en geç. ${DATETIME_HINT}`),
      productType: z.enum(["physical", "digital"]).optional(),
      shippingPayer: z.enum(["buyerPays", "sellerPays"]).optional(),
      stockStatus: z.enum(["inStock", "outOfStock"]).optional(),
      categoryId: z.array(z.string()).optional().describe("Kategori ID'leri."),
      selectionId: z.array(z.string()).optional().describe("Seçenek (selection) ID'leri."),
      discount: z.boolean().optional().describe("Yalnızca indirimli ürünler."),
      customListing: z.boolean().optional(),
      sort: dateSort,
      ...paging,
    },
    annotations: READ,
  },
  (args) => call("GET", "/products", { query: args }),
);

server.registerTool(
  "get_product",
  {
    title: "Ürün detayı",
    description: "Tek bir ürünün detaylarını getirir (fiyat, stok, varyantlar, görseller).",
    inputSchema: { productId: idParam() },
    annotations: READ,
  },
  ({ productId }) => call("GET", `/products/${id(productId)}`),
);

server.registerTool(
  "list_categories",
  {
    title: "Kategorileri listele",
    description: "Ürün kategorilerini vitrindeki sıralarına göre listeler." + LIST_NOTE,
    inputSchema: { sort: z.enum(["asc", "desc"]).optional(), ...paging },
    annotations: READ,
  },
  (args) => call("GET", "/categories", { query: args }),
);

server.registerTool(
  "list_variations",
  {
    title: "Varyasyon tiplerini listele",
    description: "Ürün varyasyon tiplerini listeler (örn. Beden, Renk).",
    inputSchema: {},
    annotations: READ,
  },
  () => call("GET", "/variations"),
);

server.registerTool(
  "list_selections",
  {
    title: "Varyasyon seçeneklerini listele",
    description: "Varyasyon seçeneklerini listeler (örn. S, M, L). Ürün varyantı oluştururken selectionId burada bulunur." + LIST_NOTE,
    inputSchema: { variationId: z.array(z.string()).optional().describe("Varyasyon ID'leri."), ...paging },
    annotations: READ,
  },
  (args) => call("GET", "/selections", { query: args }),
);

server.registerTool(
  "list_refunds",
  {
    title: "İadeleri listele",
    description: "İadeleri listeler." + LIST_NOTE,
    inputSchema: {
      ...dateRange,
      orderId: z.string().optional(),
      status: z.enum(["pending", "failed", "succeeded"]).optional(),
      sort: dateSort,
      ...paging,
    },
    annotations: READ,
  },
  (args) => call("GET", "/refunds", { query: args }),
);

server.registerTool(
  "list_shippings",
  {
    title: "Kargo kodlarını listele",
    description: "Kargo gönderi kodlarını listeler." + LIST_NOTE,
    inputSchema: {
      status: z.enum(["shipped", "notShipped"]).optional(),
      type: z.enum(["firstShipment", "secondShipment", "returnShipment"]).optional(),
      company: z.enum(["yurtici", "mng", "ptt"]).optional(),
      dateCreatedStart: z.string().optional().describe(DATETIME_HINT),
      dateCreatedEnd: z.string().optional().describe(DATETIME_HINT),
      dateDispatchedStart: z.string().optional().describe(DATETIME_HINT),
      dateDispatchedEnd: z.string().optional().describe(DATETIME_HINT),
      sort: dateSort,
      ...paging,
    },
    annotations: READ,
  },
  (args) => call("GET", "/shippings", { query: args }),
);

server.registerTool(
  "get_balance",
  {
    title: "Bakiye",
    description: "Mağazanın güncel Shopier bakiyesini getirir.",
    inputSchema: {},
    annotations: READ,
  },
  () => call("GET", "/balance"),
);

server.registerTool(
  "list_balance_transactions",
  {
    title: "Bakiye hareketleri",
    description: "Bakiye hareketlerini listeler." + LIST_NOTE,
    inputSchema: { ...dateRange, sort: dateSort, ...paging },
    annotations: READ,
  },
  (args) => call("GET", "/balance/transactions", { query: args }),
);

server.registerTool(
  "list_payouts",
  {
    title: "Ödemeleri (payout) listele",
    description: "Banka hesabına yapılan ödemeleri listeler." + LIST_NOTE,
    inputSchema: { ...dateRange, sort: dateSort, ...paging },
    annotations: READ,
  },
  (args) => call("GET", "/payouts", { query: args }),
);

server.registerTool(
  "list_payout_transactions",
  {
    title: "Ödeme içeriği",
    description: "Bir payout'a dahil olan işlemleri listeler." + LIST_NOTE,
    inputSchema: { payoutId: idParam(), sort: dateSort, ...paging },
    annotations: READ,
  },
  ({ payoutId, ...q }) => call("GET", `/payouts/transactions/${id(payoutId)}`, { query: q }),
);

server.registerTool(
  "get_shop_info",
  {
    title: "Mağaza bilgisi",
    description: "Mağaza ayarlarını (shop/settings) veya mağaza sahibi bilgisini (shop/owner) getirir.",
    inputSchema: { which: z.enum(["settings", "owner"]).default("settings") },
    annotations: READ,
  },
  ({ which }) => call("GET", `/shop/${which}`),
);

server.registerTool(
  "list_discounts",
  {
    title: "İndirimleri listele",
    description: "İndirim kodlarını (codes) veya otomatik indirimleri (automatic) listeler." + LIST_NOTE,
    inputSchema: { kind: z.enum(["codes", "automatic"]).default("codes"), sort: dateSort, ...paging },
    annotations: READ,
  },
  ({ kind, ...q }) => call("GET", `/discounts/${kind}`, { query: q }),
);

server.registerTool(
  "list_webhooks",
  {
    title: "Webhook aboneliklerini listele",
    description: "Kayıtlı webhook aboneliklerini listeler." + LIST_NOTE,
    inputSchema: { sort: z.enum(["asc", "desc"]).optional(), ...paging },
    annotations: READ,
  },
  (args) => call("GET", "/webhooks", { query: args }),
);

const money = (desc: string) =>
  z.string().regex(/^\d+(\.\d{1,2})?$/, 'Tutar "249.90" biçiminde, pozitif bir sayı olmalı.').describe(desc);
const vatPercent = z.enum(["0", "1", "10", "20"]).describe("KDV oranı (%).");
const mediaUrl = z.string().url().describe("Herkese açık erişilebilir görsel URL'si (jpg, jpeg, png, bmp).");

const mediaItem = z.object({
  type: z.literal("image").default("image"),
  url: mediaUrl,
  placement: z.number().int().min(1).max(5).describe("Sıra; ana görsel için 1."),
});

const variant = z.object({
  selectionId: z.array(z.string()),
  stockQuantity: z.number().int().min(0).optional(),
  media: z.array(z.object({ type: z.literal("image").default("image"), url: mediaUrl })).max(1).optional(),
  priceData: z.object({ currency: currency.optional(), price: money("Varyant fiyatı.").optional() }).optional(),
  primary: z.boolean().optional(),
});

const productCommon = {
  description: z.string().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  categories: z.array(z.object({ categoryId: z.string() })).optional(),
  variants: z.array(variant).optional().describe("Varyantlar. selectionId değerleri list_selections ile bulunur."),
  options: z
    .array(z.object({ optionId: z.string().optional(), optionTitle: z.string(), optionPrice: z.string().optional() }))
    .max(3)
    .optional(),
  singleOption: z.boolean().optional(),
  customListing: z.boolean().optional(),
  customNote: z.string().optional(),
  placementScore: z.number().int().min(1).optional().describe("Yüksek değerli ürünler vitrinde önce gösterilir."),
  dispatchDuration: z.number().int().min(1).max(3).optional().describe("Kargoya teslim süresi (1-3 gün)."),
};

const createProductFields = {
  title: z.string().min(1),
  type: z.enum(["physical", "digital"]),
  media: z.array(mediaItem).min(1).max(5),
  priceData: z.object({
    currency,
    price: money('Birim fiyat, örn. "249.90".'),
    vatPercent: vatPercent.optional(),
    discount: z.boolean().optional().describe("Ürün bazlı indirim var mı."),
    discountedPrice: money("İndirimli fiyat.").optional(),
    shippingPrice: money("Kargo ücreti.").optional(),
  }),
  shippingPayer: z.enum(["sellerPays", "buyerPays"]),
  ...productCommon,
};

const updateProductFields = {
  title: z.string().min(1).optional(),
  type: z.enum(["physical", "digital"]).optional(),
  media: z
    .array(mediaItem.extend({ placement: mediaItem.shape.placement.optional() }))
    .max(5)
    .optional()
    .describe("Gönderilirse mevcut görsellerin YERİNE geçer."),
  priceData: z
    .object({
      price: money('Birim fiyat, örn. "249.90".').optional(),
      vatPercent: vatPercent.optional(),
      discount: z.boolean().optional(),
      discountedPrice: money("İndirimli fiyat.").optional(),
      shippingPrice: money("Kargo ücreti.").optional(),
    })
    .optional()
    .describe("Para birimi güncellenemez; yalnızca gönderilen fiyat alanları değişir."),
  shippingPayer: z.enum(["sellerPays", "buyerPays"]).optional(),
  ...productCommon,
};

if (ALLOW_WRITES) {
  server.registerTool(
    "create_product",
    {
      title: "Ürün oluştur",
      description:
        "Mağazada yeni ürün oluşturur. Görseller herkese açık URL olmalıdır (Shopier kendisi indirir). Fiyatlar metin olarak gönderilir.",
      inputSchema: createProductFields,
      annotations: WRITE,
    },
    (args) => call("POST", "/products", { body: compact(args) }),
  );

  server.registerTool(
    "update_product",
    {
      title: "Ürün güncelle",
      description:
        "Var olan bir ürünü günceller; yalnızca gönderilen alanlar değişir. Stok veya fiyat güncellemek için kullanın. media, variants, options veya categories gönderilirse mevcut listenin yerine geçer.",
      inputSchema: { productId: idParam(), ...updateProductFields },
      annotations: OVERWRITE,
    },
    ({ productId, ...rest }) => {
      const body = compact(rest);
      if (Object.keys(body).length === 0) return fail(NOTHING_TO_UPDATE);
      return call("PUT", `/products/${id(productId)}`, { body });
    },
  );

  server.registerTool(
    "fulfill_order",
    {
      title: "Siparişi gönderildi olarak işaretle",
      description:
        "Siparişin gönderim bilgisini girer (kargo firması ve takip numarası, ya da dijital teslimat notu). Alıcıya bildirim gidebilir.",
      inputSchema: {
        orderId: idParam(),
        productType: z.enum(["physical", "digital"]),
        shippingCompany: z
          .enum(["yurtici", "mng", "ptt", "aras", "surat", "ups", "fedex", "dhl", "tnt", "pts", "aramex", "interGlobal", "hepsijet", "other"])
          .optional()
          .describe("Fiziksel gönderimde kargo firması."),
        trackingNumber: z.string().optional(),
        note: z.string().optional().describe("Dijital teslimatta zorunlu: teslimatın nasıl yapıldığı."),
      },
      annotations: OVERWRITE,
    },
    ({ orderId, ...f }) => {
      if (f.productType === "digital" && !f.note?.trim()) {
        return fail("Dijital teslimatta note (teslimatın nasıl yapıldığı) zorunludur.");
      }
      if (f.productType === "physical" && (!f.shippingCompany || !f.trackingNumber?.trim())) {
        return fail("Fiziksel gönderimde shippingCompany ve trackingNumber zorunludur.");
      }
      return call("PUT", `/orders/${id(orderId)}`, { body: { fulfillments: compact(f) } });
    },
  );

  server.registerTool(
    "update_order_shipping_address",
    {
      title: "Sipariş teslimat adresini güncelle",
      description: "Siparişin teslimat adresi/alıcı bilgilerini günceller; yalnızca gönderilen alanlar değişir.",
      inputSchema: {
        orderId: idParam(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        nationalId: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
        address: z.string().optional(),
        district: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        postcode: z.string().optional(),
        country: z.string().optional(),
      },
      annotations: OVERWRITE,
    },
    ({ orderId, ...s }) => {
      const shippingInfo = compact(s);
      if (Object.keys(shippingInfo).length === 0) return fail(NOTHING_TO_UPDATE);
      return call("PUT", `/orders/${id(orderId)}`, { body: { shippingInfo } });
    },
  );

  server.registerTool(
    "create_shipping_code",
    {
      title: "Kargo kodu oluştur",
      description: "Bir sipariş için Shopier anlaşmalı kargo gönderi kodu oluşturur.",
      inputSchema: {
        orderId: idParam(),
        company: z.enum(["yurtici", "mng", "ptt"]),
        type: z
          .enum(["firstShipment", "secondShipment", "returnShipment"])
          .optional()
          .describe("firstShipment/secondShipment satıcıdan alıcıya, returnShipment iade içindir."),
      },
      annotations: WRITE,
    },
    (args) => call("POST", "/shippings", { body: compact(args) }),
  );

  server.registerTool(
    "create_category",
    {
      title: "Kategori oluştur",
      description: "Yeni ürün kategorisi oluşturur.",
      inputSchema: { title: z.string(), placement: z.number().int().min(1).optional().describe("Vitrindeki sıra.") },
      annotations: WRITE,
    },
    (args) => call("POST", "/categories", { body: compact(args) }),
  );

  const discountCommon = {
    scope: z.enum(["all", "selectedProducts", "selectedCategories"]),
    productIds: z.array(z.string()).optional(),
    categoryIds: z.array(z.string()).optional(),
    type: z.enum(["percent", "amount", "buyXGetY"]),
    amountOff: z.string().optional().describe('type=amount iken indirim tutarı, örn. "50".'),
    percentOff: z.string().optional().describe('type=percent veya buyXGetY iken yüzde, örn. "15".'),
    quantityOff: z.number().int().optional().describe("type=buyXGetY iken bedava ürün adedi."),
    requirement: z.enum(["amount", "quantity"]).describe("Asgari koşul tipi."),
    amountMinimum: z.string().optional(),
    quantityMinimum: z.number().int().optional(),
    buyerGets: z
      .object({
        scope: z.enum(["all", "selectedProducts", "selectedCategories"]),
        productIds: z.array(z.string()).optional(),
        categoryIds: z.array(z.string()).optional(),
      })
      .optional()
      .describe("type=buyXGetY iken alıcının kazandığı ürünler."),
    currency,
  };

  const discountProblem = (d: { type: string; amountOff?: string; percentOff?: string; quantityOff?: number; buyerGets?: unknown }) => {
    if (d.type === "amount" && !d.amountOff) return "type=amount için amountOff zorunludur.";
    if (d.type === "percent" && !d.percentOff) return "type=percent için percentOff zorunludur.";
    if (d.type === "buyXGetY" && (!d.quantityOff || !d.buyerGets)) return "type=buyXGetY için quantityOff ve buyerGets zorunludur.";
    return undefined;
  };

  server.registerTool(
    "create_discount_code",
    {
      title: "İndirim kodu oluştur",
      description: "Alıcıların ödeme sırasında gireceği bir indirim kodu oluşturur.",
      inputSchema: {
        code: z.string(),
        ...discountCommon,
        numAvailable: z.number().int().min(1).describe("Kaç kez kullanılabilir."),
        expiresAt: z.string().describe(`Son geçerlilik tarihi. ${DATE_HINT}`),
      },
      annotations: WRITE,
    },
    (args) => {
      const problem = discountProblem(args);
      return problem ? fail(problem) : call("POST", "/discounts/codes", { body: compact(args) });
    },
  );

  server.registerTool(
    "update_discount_code",
    {
      title: "İndirim kodunu güncelle",
      description: "İndirim kodunun kullanım adedini veya son tarihini günceller.",
      inputSchema: {
        discountId: idParam(),
        numAvailable: z.number().int().min(0).optional(),
        expiresAt: z.string().optional().describe(DATE_HINT),
      },
      annotations: UPDATE,
    },
    ({ discountId, ...rest }) => {
      const body = compact(rest);
      if (Object.keys(body).length === 0) return fail(NOTHING_TO_UPDATE);
      return call("PUT", `/discounts/codes/${id(discountId)}`, { body });
    },
  );

  server.registerTool(
    "create_automatic_discount",
    {
      title: "Otomatik indirim oluştur",
      description: "Koşul sağlandığında kod gerekmeden uygulanan bir indirim kampanyası oluşturur.",
      inputSchema: {
        title: z.string(),
        ...discountCommon,
        startsAt: z.string().describe(`Başlangıç. ${DATE_HINT}`),
        expiresAt: z.string().describe(`Bitiş. ${DATE_HINT}`),
      },
      annotations: WRITE,
    },
    (args) => {
      const problem = discountProblem(args);
      return problem ? fail(problem) : call("POST", "/discounts/automatic", { body: compact(args) });
    },
  );
}

if (ALLOW_WRITES && ALLOW_DANGEROUS) {
  server.registerTool(
    "create_refund",
    {
      title: "İade yap (para iadesi)",
      description:
        "Bir sipariş için alıcıya PARA İADESİ başlatır. Geri alınamaz olabilir. Çağırmadan önce kullanıcıdan tutarı ve siparişi açıkça onaylamasını isteyin.",
      inputSchema: {
        orderId: idParam(),
        amount: money('İade tutarı, örn. "120.00".'),
        note: z.string().optional().describe("Alıcıya not."),
      },
      annotations: DANGER,
    },
    (args) => call("POST", "/refunds", { body: compact(args) }),
  );

  server.registerTool(
    "delete_resource",
    {
      title: "Kayıt sil",
      description:
        "Ürün, kategori, indirim kodu, otomatik indirim, kargo kodu veya webhook aboneliğini KALICI olarak siler. Çağırmadan önce kullanıcıdan onay alın.",
      inputSchema: {
        kind: z.enum(["product", "category", "discount_code", "automatic_discount", "shipping_code", "webhook"]),
        resourceId: idParam().describe("Silinecek kaydın ID'si (kargo kodu için kodun kendisi)."),
      },
      annotations: DANGER,
    },
    ({ kind, resourceId }) => {
      const base = {
        product: "/products",
        category: "/categories",
        discount_code: "/discounts/codes",
        automatic_discount: "/discounts/automatic",
        shipping_code: "/shippings",
        webhook: "/webhooks",
      }[kind];
      return call("DELETE", `${base}/${id(resourceId)}`);
    },
  );
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(
  `shopier-mcp çalışıyor (yazma: ${ALLOW_WRITES ? "açık" : "kapalı"}, tehlikeli işlemler: ${ALLOW_WRITES && ALLOW_DANGEROUS ? "açık" : "kapalı"}${env("SHOPIER_PAT") ? "" : ", UYARI: SHOPIER_PAT tanımlı değil"})`,
);
