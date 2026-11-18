---
name: using-shopier-mcp
description: Use when the user talks about their Shopier shop (sipariş, ürün, kargo, iade, bakiye, indirim kodu), when shopier MCP tools such as list_orders are connected or a Shopier action has no matching tool, or when installing or configuring shopier-mcp, SHOPIER_PAT or the SHOPIER_ALLOW_* flags.
---

# Using shopier-mcp

## Overview

shopier-mcp is an unofficial MCP server for the Shopier REST API. It registers only the tools its flags allow, so a write tool can be missing from your list because its flag is off. The Turkish tool descriptions and error messages carry the API rules (date format, the 60-day default of `list_orders`, product 403s, refund confirmation, unknown write outcomes). Follow them.

## Which flag adds which tool

| Flags (value `true`, `1`, `yes` or `on`) | Tools added |
| --- | --- |
| none (default) | 17 read tools: `list_*`, `get_*` |
| `SHOPIER_ALLOW_WRITES` | `create_product`, `update_product`, `fulfill_order`, `update_order_shipping_address`, `create_shipping_code`, `create_category`, `create_discount_code`, `update_discount_code`, `create_automatic_discount` |
| `SHOPIER_ALLOW_WRITES` and `SHOPIER_ALLOW_DANGEROUS` | `create_refund` (para iadesi), `delete_resource` (kalıcı silme) |

`SHOPIER_ALLOW_DANGEROUS` does nothing on its own.

## When a Shopier action has no tool

| What you see | Meaning | What to tell the user |
| --- | --- | --- |
| No shopier tools at all | The server is not installed or did not connect | That. In Claude Code, `claude mcp list` shows its state. No flag fixes this. |
| The action's tool is in the table above but not in your list | Its flag is off | The steps below |
| The action is in no row of the table (cancelling an order, changing shop settings, creating a webhook, ...) | shopier-mcp can't do it | Use the Shopier panel. Don't suggest a flag. |

When a flag is off, tell the user, in this order:

1. Nothing was changed, and which flag the task needs.
2. How to turn it on. The user makes this change; you don't read or edit the config, because it holds their PAT.
   - Claude Code: with Claude Code closed, add `"SHOPIER_ALLOW_WRITES": "true"` to the `env` of the `shopier` server in `~/.claude.json` (user scope: top-level `mcpServers.shopier`). Re-adding the server with an extra `-e SHOPIER_ALLOW_WRITES=true` also works, but needs the PAT again.
   - Claude Desktop: the same key in the server's `env` in `claude_desktop_config.json`, with Claude Desktop closed.
   - Then start the client again. New tools appear only after the server restarts.
3. For refunds or deletion: also `SHOPIER_ALLOW_DANGEROUS`, on for the session that needs it and off afterwards.
4. The Shopier panel, as the way to do a one-off change without any flag.

## The PAT (Personal Access Token)

A Shopier PAT gives full access to the account.

- Never ask for it in chat. Write commands with `YOUR_PAT` for the user to fill in and run.
- **If the user pastes a PAT into the chat, it is leaked.** Before anything else, tell them to delete it in Shopier (*Hesap > Personal Access Token*), create a new one, and put the new one into the config themselves. Don't install or configure the server with the pasted token.
- `claude mcp add ... -e SHOPIER_PAT=...` is saved to shell history. In zsh with `HIST_IGNORE_SPACE`, starting the command with a space keeps it out. Never use `--scope project`, which writes the PAT to `.mcp.json` in the project.
- Shopier allows creating a PAT only with 2FA on (*Hesap > Hesap Güvenliği*).

Install command for Claude Code (read-only by default):

```bash
 claude mcp add shopier --scope user -e SHOPIER_PAT=YOUR_PAT -- npx -y shopier-mcp@0.1.4
```
