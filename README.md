# MCP Server for ThemeParks.wiki (`mcp-server-theme-parks`)

This project provides a Model-Context-Protocol (MCP) server that interfaces with the [ThemeParks.wiki API](https://api.themeparks.wiki/v1). It allows users to access real-time and static data for theme parks, including destinations, attractions, wait times, and schedules.

## Prerequisites

*   Node.js >= 18
## Setup & Installation

1.  **Clone the repository (if applicable):**
    ```bash
    git clone https://github.com/MasonMao-dev/mcp-server-theme-parks.git
    cd mcp-server-theme-parks
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root of the project and add the API base URL:
    ```env
    THEMEPARKS_API_BASE_URL="https://api.themeparks.wiki/v1"
    ```
    Alternatively, you can set this environment variable directly in your shell or when running the application.

## Running the Server

### Production
```bash
npm start
```
This will compile the TypeScript code (if not already built) and run the server using Node.

### Development
For development with live reloading:
```bash
npm run dev
```

### MCP Server Configuration (for MCP clients)

To use this server with an MCP-compatible client, you would typically configure the client as follows:

```json
{
  "mcpServers": {
    "mcp-server-theme-parks": {
      "command": "npx",
      "args": ["-y", "mcp-server-theme-parks"],
      "env": {
        "THEMEPARKS_API_BASE_URL": "https://api.themeparks.wiki/v1"
      }
    }
  }
}
```
If running locally from source (after `npm install` and `npm run build`):
```json
{
  "mcpServers": {
    "mcp-server-theme-parks": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/your/cloned/mcp-server-theme-parks", // Update this path
      "env": {
        "THEMEPARKS_API_BASE_URL": "https://api.themeparks.wiki/v1"
      }
    }
  }
}
```

### Debugging with MCP Inspector

You can debug the server using the MCP Inspector:
```bash
npx @modelcontextprotocol/inspector -e THEMEPARKS_API_BASE_URL=https://api.themeparks.wiki/v1 node dist/index.js
```
Ensure you have built the project first (`npm run build`).

## Available Tools

The server exposes the following tools that can be invoked by an MCP client:

1.  **`list_destinations`**
    *   **Description:** Retrieves a list of all available top-level theme park destinations (e.g., Walt Disney World Resort, Universal Orlando Resort).
    *   **Parameters:** None

2.  **`get_entity_details`**
    *   **Description:** Fetches detailed static information for a specific entity (like a park, attraction, or restaurant) using its unique ID.
    *   **Parameters:**
        *   `entity_id` (string, UUID, required): The unique GUID identifier for the entity.

3.  **`get_entity_children`**
    *   **Description:** Retrieves all direct child entities for a given parent entity ID (e.g., all parks within a destination, or all attractions within a park).
    *   **Parameters:**
        *   `entity_id` (string, UUID, required): The unique GUID identifier for the parent entity.

4.  **`get_entity_live_data`**
    *   **Description:** Fetches live data for a specific entity and its children. This can include attraction wait times, park operating hours, and show times.
    *   **Parameters:**
        *   `entity_id` (string, UUID, required): The unique GUID identifier for the entity.

5.  **`get_entity_schedule`**
    *   **Description:** Retrieves the operating schedule or calendar data for a specific entity. Can specify a year and month, or get general schedule data.
    *   **Parameters:**
        *   `entity_id` (string, UUID, required): The unique GUID identifier for the entity.
        *   `year` (integer, optional): The year for the schedule (e.g., 2025). If omitted with month, fetches general schedule.
        *   `month` (integer, optional): The month for the schedule (1-12). If omitted with year, fetches general schedule. Requires `year` if specified. (Both year and month must be provided if one is.)

### Help Prompt

The server also provides a `help` prompt:

*   **`help`**
    *   **Description:** Provides a summary of all available tools and their usage.
    *   **Parameters:** None
    *   **Output:** A user-friendly message listing all tools, their descriptions, and parameters.
