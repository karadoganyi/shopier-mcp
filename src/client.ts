export const VERSION = "0.1.4";
const DEFAULT_BASE_URL = "https://api.shopier.com/v1";

export class ShopierError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ShopierError";
  }
}

export type Query = Record<string, string | number | boolean | string[] | undefined>;

export interface Pagination {
  page?: number;
  limit?: number;
  totalPages?: number;
  totalItems?: number;
}

export interface ShopierResponse {
  status: number;
  data: unknown;
  pagination?: Pagination;
}

const STATUS_MESSAGES: Record<number, string> = {
  400: "Geçersiz istek (400): bir parametre eksik veya hatalı.",
  401: "Yetkisiz (401): SHOPIER_PAT eksik, hatalı ya da iptal edilmiş.",
  402: "Ödeme gerekli (402): uygulama ücreti ödenmemiş.",
  403: "Erişim yok (403): bu kaynak için ek yetki gerekiyor.",
  404: "Bulunamadı (404): kaynak yok veya ID hatalı.",
  429: "Hız sınırı aşıldı (429): dakikada 200 istek sınırı.",
};

const UNKNOWN_OUTCOME =
  "İşlemin Shopier tarafında uygulanıp uygulanmadığı BİLİNMİYOR. Tekrar denemeden önce ilgili kaydı okuyarak (örn. get_order, list_refunds, get_product) durumu kontrol edin.";

const TOKEN_RE = /^[\x21-\x7E]+$/;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function num(v: string | null): number | undefined {
  if (v === null || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function isLoopback(host: string) {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

export class ShopierClient {
  private baseUrl: string;
  private tokenProblem?: string;

  constructor(private token: string | undefined, baseUrl?: string) {
    if (token && !TOKEN_RE.test(token)) {
      this.tokenProblem =
        "SHOPIER_PAT geçersiz karakter içeriyor (boşluk, satır sonu veya ASCII dışı karakter). Token'ı Shopier'den yeniden kopyalayın.";
    }

    const url = new URL(baseUrl ?? DEFAULT_BASE_URL);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback(url.hostname))) {
      throw new Error("SHOPIER_API_BASE_URL https olmalıdır (yalnızca localhost için http kabul edilir).");
    }
    this.baseUrl = url.toString().replace(/\/+$/, "");
    if (baseUrl && this.baseUrl !== DEFAULT_BASE_URL) {
      console.error(`UYARI: Varsayılan dışı API adresi kullanılıyor: ${this.baseUrl}`);
    }
  }

  private redact(s: string) {
    return this.token ? s.split(this.token).join("[gizlendi]") : s;
  }

  async request(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    opts: { query?: Query; body?: unknown } = {},
  ): Promise<ShopierResponse> {
    try {
      return await this.doRequest(method, path, opts);
    } catch (err) {
      if (err instanceof ShopierError) throw new ShopierError(this.redact(err.message), err.status);
      throw new ShopierError(this.redact(`Beklenmeyen hata: ${(err as Error).message}`));
    }
  }

  private async doRequest(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    opts: { query?: Query; body?: unknown },
  ): Promise<ShopierResponse> {
    if (!this.token) {
      throw new ShopierError(
        "SHOPIER_PAT ortam değişkeni tanımlı değil. Shopier hesabında Hesap > Personal Access Token bölümünden bir PAT oluşturup MCP yapılandırmasına ekleyin.",
      );
    }
    if (this.tokenProblem) throw new ShopierError(this.tokenProblem);

    const isRead = method === "GET";
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(opts.query ?? {})) {
      if (value === undefined || value === "") continue;
      if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
      else url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${this.token}`,
      "User-Agent": `shopier-mcp/${VERSION}`,
    };
    let body: string | undefined;
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }

    for (let attempt = 0; ; attempt++) {
      let res: Response;
      let text: string;
      try {
        res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(30_000) });
        if (res.status === 429 && attempt === 0) {
          const wait = num(res.headers.get("Retry-After")) ?? 5;
          if (wait <= 10) {
            await res.body?.cancel();
            await sleep(wait * 1000);
            continue;
          }
        }
        if (res.status >= 500 && attempt === 0 && isRead) {
          await res.body?.cancel();
          await sleep(1000);
          continue;
        }
        text = await res.text();
      } catch (err) {
        const reason = (err as Error).name === "TimeoutError" ? "zaman aşımı (30 sn)" : "bağlantı hatası";
        if (isRead) throw new ShopierError(`Shopier API'ye ulaşılamadı: ${reason}.`);
        throw new ShopierError(`Shopier API yanıtı alınamadı: ${reason}. ${UNKNOWN_OUTCOME}`);
      }

      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      if (!res.ok) {
        let msg = STATUS_MESSAGES[res.status] ?? `Shopier API hatası (${res.status}).`;
        if (res.status === 429) {
          const ra = res.headers.get("Retry-After");
          if (ra) msg += ` ${ra} saniye sonra tekrar deneyin.`;
        }
        if (res.status >= 500 && !isRead) msg += ` ${UNKNOWN_OUTCOME}`;
        if (data !== null) {
          msg += ` Yanıt: ${typeof data === "string" ? data.slice(0, 1000) : JSON.stringify(data).slice(0, 1000)}`;
        }
        throw new ShopierError(msg, res.status);
      }

      const h = res.headers;
      const pagination: Pagination = {
        page: num(h.get("Shopier-Pagination-Page")),
        limit: num(h.get("Shopier-Pagination-Limit")),
        totalPages: num(h.get("Shopier-Pagination-Total-Pages")),
        totalItems: num(h.get("Shopier-Pagination-Total-Items")),
      };
      const hasPagination = Object.values(pagination).some((v) => v !== undefined);
      return { status: res.status, data, pagination: hasPagination ? pagination : undefined };
    }
  }
}
