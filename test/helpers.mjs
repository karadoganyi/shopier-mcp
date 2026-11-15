import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export const SERVER = fileURLToPath(new URL("../dist/index.js", import.meta.url));

export async function connect(env) {
  const client = new Client({ name: "test", version: "0" });
  await client.connect(
    new StdioClientTransport({ command: process.execPath, args: [SERVER], env: { PATH: process.env.PATH, ...env }, stderr: "ignore" }),
  );
  return client;
}
export const names = async (c) => (await c.listTools()).tools.map((t) => t.name).sort();
export const text = (r) => r.content.map((c) => c.text).join("\n");
