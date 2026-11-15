# Changelog

## 0.1.0 - 2026-11-15

First public release. Experimental: not yet tested against a real Shopier shop.

- 17 read tools (orders, products, categories, variations, refunds, shippings, balance, payouts, shop info, discounts, webhooks).
- 9 write tools behind `SHOPIER_ALLOW_WRITES=true`.
- 2 dangerous tools (`create_refund`, `delete_resource`) behind `SHOPIER_ALLOW_DANGEROUS=true` as well.
- Write requests are never retried automatically; on a timeout or 5xx the server reports the outcome as unknown.
- Not published to npm.
