/**
 * timezone-toolkit stdio entrypoint — the `@agishub/timezone-toolkit` npm binary.
 * Runs the exact same toolset as the Cloudflare Worker, over stdio, for local
 * MCP clients (Claude Desktop, Cursor, Windsurf) that prefer a local process.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./adapters/mcp";

const server = new McpServer({ name: "timezone-toolkit", version: "2.1.0" });
registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
