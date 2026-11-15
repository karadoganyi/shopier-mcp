# Changelog

## 0.1.4 - 2026-11-15

First run against a real Shopier shop.

- Product titles over 80 characters or containing `&`, `<` or `>` are rejected before sending: Shopier stores `&` as `&amp;` and cuts long titles at about 90 characters.
- A 403 from a product endpoint now explains that some accounts can create products but not read or update them, and points to Shopier support.
- Tool descriptions now say how shipping fields map to "sepette kargo" and free shipping, that dispatch time is in business days, and that line breaks in descriptions are not shown.
- README: new "Observed Shopier behaviour" section; date-format note updated (`+03:00` and `Z` are also accepted).

## 0.1.3 - 2026-11-15

- npm showed the Turkish README on the package page, because npm picks the first `README.*` file it finds in the package root. The Turkish README moved to `docs/README.tr.md`, so `README.md` (English) is the only README in the root.
- A test now fails if more than one `README*` file is in the package root.
- No code changes.

## 0.1.2 - 2026-11-15

- The main `README.md` is now in English; the Turkish version moved to `README.tr.md`. The English README now includes the full API notes and test details.
- No code changes.

## 0.1.1 - 2026-11-15

- Published to npm as `shopier-mcp`; install with `npx -y shopier-mcp@0.1.1`.
- Added `mcpName` (`io.github.karadoganyi/shopier-mcp`) for the official MCP Registry.
- README: npx setup for Claude Code and Claude Desktop. No code changes.

## 0.1.0 - 2026-11-15

First public release. Experimental: not yet tested against a real Shopier shop.

- 17 read tools (orders, products, categories, variations, refunds, shippings, balance, payouts, shop info, discounts, webhooks).
- 9 write tools behind `SHOPIER_ALLOW_WRITES=true`.
- 2 dangerous tools (`create_refund`, `delete_resource`) behind `SHOPIER_ALLOW_DANGEROUS=true` as well.
- Write requests are never retried automatically; on a timeout or 5xx the server reports the outcome as unknown.
- Not published to npm.
