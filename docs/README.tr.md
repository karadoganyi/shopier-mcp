# shopier-mcp

[English](../README.md)

[Shopier REST API v1](https://developer.shopier.com/reference/introduction) için **resmi olmayan** bir MCP sunucusu. Claude'un (veya MCP destekleyen başka bir istemcinin) Shopier mağazanızdaki siparişleri, ürünleri, kargoları, iadeleri ve bakiyeyi okumasını; isterseniz ürün/sipariş/indirim güncellemesini sağlar.

## Durum

Deneysel (v0.1.3). Protokol ve yerel sahte API testlerinden geçti, ancak **henüz gerçek bir Shopier mağazasına karşı uçtan uca denenmedi**. Önce yalnızca okuma araçlarıyla deneyin.

Resmi kaynaklar yalnızca bu GitHub deposu ve npm'deki [`shopier-mcp`](https://www.npmjs.com/package/shopier-mcp) paketidir. Benzer adlı başka paketler bu projeye ait değildir.

## Sorumluluk reddi ve marka

Bu proje bağımsız, resmi olmayan bir açık kaynak projesidir. Shopier ile bir bağlantısı yoktur; Shopier tarafından geliştirilmemiş, onaylanmamış veya desteklenmemiştir. "Shopier" adı ve ilgili markalar sahiplerine aittir ve burada yalnızca yazılımın hangi API ile çalıştığını belirtmek için kullanılmıştır.

Yazılım MIT lisansı altında, "olduğu gibi" ve hiçbir garanti verilmeden sunulur. Mağazanızda yapılan her işlemin (sipariş, ürün, indirim, para iadesi, silme) sorumluluğu size aittir.

## Güvenlik

- **PAT hesabınıza tam erişim verir.** Shopier dokümantasyonuna göre PAT'i paylaşmak hesabınıza tam erişim vermek demektir. Kimseyle paylaşmayın, sohbete yapıştırmayın, git'e koymayın.
- **Bu sunucu kendi bilgisayarınızda çalışır.** PAT'iniz proje sahibine veya başka bir sunucuya gönderilmez; yalnızca `api.shopier.com` adresine gider. `SHOPIER_API_BASE_URL` değerini değiştirirseniz PAT o adrese gönderilir; emin değilseniz dokunmayın.
- **PAT yapılandırma dosyasında düz metin olarak durur** (`claude_desktop_config.json` veya Claude Code ayarları). Bu dosyaları paylaşmayın. `claude mcp add --scope project` kullanmayın; PAT'i proje klasöründeki `.mcp.json` dosyasına yazar.
- **Okuma araçları müşteri verisi döndürür** (ad, adres, telefon, e-posta, sipariş içeriği). Bu veriler kullandığınız MCP istemcisine ve onun bağlı olduğu yapay zeka sağlayıcısına gider. Müşterilerinizin kişisel verilerini nasıl işlediğinizin sorumluluğu size aittir.
- **Yazma araçları varsayılan olarak kapalıdır.** `SHOPIER_ALLOW_WRITES=true` yalnızca ihtiyacınız olduğunda açın. Açıkken model ürün, sipariş, kargo ve indirim kayıtlarını değiştirebilir.
- **`SHOPIER_ALLOW_DANGEROUS=true` para iadesi ve kalıcı silmeyi açar.** Bunlar geri alınamayabilir. Yalnızca o işlemi yapacağınız oturumda açın, sonra kapatın. İstemcinizde araç çağrıları için otomatik onayı açık bırakmayın.
- PAT'in sızdığından şüphelenirseniz Shopier'de *Hesap > Personal Access Token* bölümünden silip yenisini oluşturun.

## Gereksinimler

- Node.js 22+
- Shopier hesabında bir **Personal Access Token (PAT)**

### PAT oluşturma

1. Shopier hesabınızda **iki adımlı doğrulamayı (2FA)** açın: *Hesap > Hesap Güvenliği*. 2FA kapalıyken PAT oluşturulamaz.
2. *Hesap > Personal Access Token* bölümünde bir isim verip **Generate**'e basın.
3. Token yalnızca bir kez gösterilir, hemen kopyalayın.

Kaynak: [Creating and using PATs](https://developer.shopier.com/docs/creating-and-using-pats.md).

## Kurulum

Ayrıca bir şey kurmanız gerekmez: MCP istemciniz sunucuyu `npx` ile npm'den indirip çalıştırır. Aşağıdaki örnekler sürümü sabitler (`@0.1.3`); yeni sürüme geçmek için numarayı elle güncelleyin.

### Claude Code

```bash
claude mcp add shopier --scope user -e SHOPIER_PAT=BURAYA_PAT -- npx -y shopier-mcp@0.1.3
```

`--scope user` sunucuyu tüm projelerde kullanılabilir yapar (varsayılan `local` yalnızca o klasörde geçerlidir). Yazma araçlarını da açmak için `-e SHOPIER_ALLOW_WRITES=true` ekleyin.

Not: Bu komut PAT'i kabuk geçmişine (`~/.zsh_history`) yazar. Önlemek için komutun başına bir boşluk koyun (zsh'de `setopt HIST_IGNORE_SPACE` açıksa) ya da çalıştırdıktan sonra geçmişten silin.

### Claude Desktop

`claude_desktop_config.json` içine:

```json
{
  "mcpServers": {
    "shopier": {
      "command": "npx",
      "args": ["-y", "shopier-mcp@0.1.3"],
      "env": {
        "SHOPIER_PAT": "BURAYA_PAT",
        "SHOPIER_ALLOW_WRITES": "false"
      }
    }
  }
}
```

### Kaynaktan çalıştırma

```bash
git clone https://github.com/karadoganyi/shopier-mcp.git
cd shopier-mcp
npm install
```

`npm install` derlemeyi de yapar (`dist/` oluşur). Yukarıdaki örneklerde `npx -y shopier-mcp@0.1.3` yerine `node /TAM/YOL/shopier-mcp/dist/index.js` kullanın.

## Ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `SHOPIER_PAT` | — | Zorunlu. Bearer token olarak gönderilir, hiçbir yere loglanmaz. |
| `SHOPIER_ALLOW_WRITES` | `false` | `true` ise ürün, sipariş, kargo, kategori ve indirim yazma araçları açılır. |
| `SHOPIER_ALLOW_DANGEROUS` | `false` | `true` **ve** yazma açıksa: para iadesi (`create_refund`) ve kalıcı silme (`delete_resource`) açılır. |
| `SHOPIER_API_BASE_URL` | `https://api.shopier.com/v1` | Test için değiştirilebilir. Yalnızca https (localhost için http) kabul edilir; varsayılan dışı adreste stderr'e uyarı yazılır. |

Bayraklar `true`, `1`, `yes`, `on` değerlerini kabul eder. Kapalı olan araçlar hiç kaydedilmez; model onları göremez.

## Araçlar

**Okuma (her zaman açık, 17 araç)**
`list_orders`, `get_order`, `get_order_transaction`, `list_products`, `get_product`, `list_categories`, `list_variations`, `list_selections`, `list_refunds`, `list_shippings`, `get_balance`, `list_balance_transactions`, `list_payouts`, `list_payout_transactions`, `get_shop_info`, `list_discounts`, `list_webhooks`

**Yazma (`SHOPIER_ALLOW_WRITES=true`, +9 araç)**
`create_product`, `update_product`, `fulfill_order`, `update_order_shipping_address`, `create_shipping_code`, `create_category`, `create_discount_code`, `update_discount_code`, `create_automatic_discount`

**Tehlikeli (`SHOPIER_ALLOW_DANGEROUS=true`, +2 araç)**
`create_refund` (alıcıya para iadesi), `delete_resource` (ürün/kategori/indirim/kargo kodu/webhook kalıcı silme)

Mağaza ayarlarını değiştirme (mağazayı kapatabilir) ve webhook oluşturma (müşteri verisini bir URL'ye gönderir) bilerek eklenmedi.

## API notları

- **Tarih biçimi:** `yyyy-MM-ddTHH:mm:ss+0300` (ofsette iki nokta yok). İndirim tarihleri: `yyyy-MM-dd+0300`.
- `list_orders` tarih verilmezse **yalnızca son 60 günü** döndürür.
- Liste uçları sayfa başına en fazla 50 kayıt döner. Sayfa bilgisi Shopier'de yanıt başlıklarında gelir; sunucu bunu her liste yanıtına `pagination` alanı olarak ekler.
- Fiyatlar metin olarak gönderilir (`"249.90"`).
- Ürün görselleri herkese açık bir URL olmalıdır.
- Hız sınırı dakikada 200 istek. 429 alınırsa `Retry-After` ≤ 10 sn ise bir kez otomatik yeniden denenir.
- 5xx hatasında yalnızca okuma istekleri bir kez yeniden denenir. Yazma isteklerinde (iade dahil) zaman aşımı veya 5xx olursa sunucu "sonuç bilinmiyor" der ve tekrar denemeden önce kaydın kontrol edilmesini ister; böylece çift iade gibi riskler önlenir.
- Boş güncellemeler, boş/`..` ID'ler, negatif tutarlar ve spec'teki koşullu zorunlu alanlar (dijital teslimat notu, indirim tipine göre tutar/yüzde) istek gönderilmeden yerel olarak reddedilir.

## Test

```bash
npm test
```

Ağ ve gerçek PAT gerektirmez:

- `test/smoke.mjs`: MCP el sıkışması, bayraklara göre araç sayıları (17 / 26 / 28), PAT yokken hata mesajı.
- `test/mock.mjs`: yerel sahte API'ye karşı — sorgu parametreleri ve pagination başlıkları; `create_product`, `update_product`, `fulfill_order`, `create_discount_code`, `create_refund` gövdeleri; DELETE ve ID kodlama; yerel doğrulamalar (istek gönderilmediği kontrol edilir); 403/404 hata mesajları; 429 ve 5xx yeniden deneme kuralları; geçersiz karakterli PAT'in hata mesajına sızmaması.

İsteğe bağlı: `npm run test:live` gerçek `api.shopier.com`'a **sahte** bir token ile istek atar ve temiz bir 401 bekler.

Gerçek bir mağazaya karşı uçtan uca test edilmemiştir. Yazma isteklerinde 30 sn zaman aşımı yolu da otomatik testte yoktur.

## Lisans

MIT. Ayrıntı için [LICENSE](../LICENSE).
