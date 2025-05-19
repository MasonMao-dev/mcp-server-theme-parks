## mcp-server-theme-parks

### MCP Server Config

```
{
  "mcpServers": {
    "mcp-server-theme-parks": {
      "command": "npx",
      "args": ["mcp-server-theme-parks"],
      "env": {
        "THEMEPARKS_API_BASE_URL": "https://api.themeparks.wiki/v1"
      }
    }
  }
}

```

### DEBUG

```
npx @modelcontextprotocol/inspector -e THEMEPARKS_API_BASE_URL=https://api.themeparks.wiki/v1 node dist/index.js
```
