# shopier-mcp

[Türkçe](README.md)

An **unofficial** MCP server for the [Shopier REST API v1](https://developer.shopier.com/reference/introduction). It lets Claude, or any other MCP client, read the orders, products, shipping, refunds and balance of your Shopier shop, and optionally update products, orders and discounts.

Tool descriptions and error messages are in Turkish, because Shopier's users are Turkish sellers. Tool names, parameters and enum values are in English.

## Status

Experimental (v0.1.1). It passes protocol tests and a local mock API, but **it has not yet been tested end to end against a real Shopier shop**. Start with the read-only tools.

The only official sources are this GitHub repository and the [`shopier-mcp`](https://www.npmjs.com/package/shopier-mcp) package on npm. Packages with similar names are not this project.

## Disclaimer

This is an independent, unofficial open-source project. It is not affiliated with, endorsed by, or supported by Shopier. "Shopier" and related marks belong to their respective owner and are used here only to identify the API this software talks to.

The software is provided under the MIT license, "as is", without warranty of any kind. You are responsible for every action taken in your shop (orders, products, discounts, refunds, deletions).

## Security

- **A PAT grants full access to your account.** Do not share it, paste it into a chat, or commit it.
- **The server runs on your own machine.** Your PAT is never sent to the project author or any other server; it goes only to `api.shopier.com`. If you override `SHOPIER_API_BASE_URL`, the PAT is sent to that host instead.
- **The PAT is stored in plain text** in your MCP client configuration. Do not share those files, and do not use `claude mcp add --scope project`, which writes the PAT to `.mcp.json` in the project folder.
- **Read tools return customer data** (names, addresses, phone numbers, emails, order contents). That data goes to your MCP client and the AI provider behind it. How you handle your customers' personal data is your responsibility.
- **Write tools are off by default.** Set `SHOPIER_ALLOW_WRITES=true` only when you need them.
- **`SHOPIER_ALLOW_DANGEROUS=true` enables refunds and permanent deletion.** These may be irreversible. Enable it only for the session that needs it, and do not auto-approve tool calls in your client.
- If you suspect the PAT has leaked, delete it under *Account > Personal Access Token* in Shopier and create a new one.

## Requirements

- Node.js 22+
- A Shopier **Personal Access Token (PAT)**. Two-factor authentication must be enabled on the account first; then create one under *Account > Personal Access Token*. It is shown only once. See [Creating and using PATs](https://developer.shopier.com/docs/creating-and-using-pats.md).

## Install

Nothing to install: your MCP client downloads and runs the server from npm with `npx`. The examples pin the version (`@0.1.1`); bump it by hand to upgrade.

### Claude Code

```bash
claude mcp add shopier --scope user -e SHOPIER_PAT=YOUR_PAT -- npx -y shopier-mcp@0.1.1
```

This writes the PAT to your shell history; remove it from the history afterwards.

### Claude Desktop

In `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "shopier": {
      "command": "npx",
      "args": ["-y", "shopier-mcp@0.1.1"],
      "env": {
        "SHOPIER_PAT": "YOUR_PAT",
        "SHOPIER_ALLOW_WRITES": "false"
      }
    }
  }
}
```

### From source

```bash
git clone https://github.com/karadoganyi/shopier-mcp.git
cd shopier-mcp
npm install
```

`npm install` also builds the project (`dist/`). In the examples above, replace `npx -y shopier-mcp@0.1.1` with `node /ABSOLUTE/PATH/shopier-mcp/dist/index.js`.

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `SHOPIER_PAT` | — | Required. Sent as a Bearer token, never logged. |
| `SHOPIER_ALLOW_WRITES` | `false` | Enables the product, order, shipping, category and discount write tools. |
| `SHOPIER_ALLOW_DANGEROUS` | `false` | With writes enabled, also enables refunds (`create_refund`) and permanent deletion (`delete_resource`). |
| `SHOPIER_API_BASE_URL` | `https://api.shopier.com/v1` | For testing. Only https is accepted (http for localhost); a non-default host prints a warning to stderr. |

Flags accept `true`, `1`, `yes` or `on`. Disabled tools are not registered at all, so the model cannot see them.

## Tools

**Read (always on, 17 tools)**
`list_orders`, `get_order`, `get_order_transaction`, `list_products`, `get_product`, `list_categories`, `list_variations`, `list_selections`, `list_refunds`, `list_shippings`, `get_balance`, `list_balance_transactions`, `list_payouts`, `list_payout_transactions`, `get_shop_info`, `list_discounts`, `list_webhooks`

**Write (`SHOPIER_ALLOW_WRITES=true`, +9 tools)**
`create_product`, `update_product`, `fulfill_order`, `update_order_shipping_address`, `create_shipping_code`, `create_category`, `create_discount_code`, `update_discount_code`, `create_automatic_discount`

**Dangerous (`SHOPIER_ALLOW_DANGEROUS=true`, +2 tools)**
`create_refund` (refunds the buyer), `delete_resource` (permanently deletes a product, category, discount, shipping code or webhook)

Changing shop settings (which can close the shop) and creating webhooks (which send customer data to a URL) are deliberately left out.

API notes (date formats, pagination, retries, local validation) are in the [Turkish README](README.md#api-notları).

## Test

```bash
npm test
```

Needs no network and no real PAT: it covers the MCP handshake, tool counts per flag, and request shapes and error handling against a local mock API. `npm run test:live` optionally calls the real `api.shopier.com` with a **fake** token and expects a clean 401.

## License

MIT. See [LICENSE](LICENSE).
