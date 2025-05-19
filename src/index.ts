import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import { z, ZodRawShape } from "zod";

// Load environment variables from .env file
dotenv.config();

const apiBaseUrl = process.env.THEMEPARKS_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error("Missing required environment variables: THEMEPARKS_API_BASE_URL");
}

// Initialize MCP Server
const server = new McpServer({
  name: "ThemeParks.wiki MCP Server",
  version: "1.0.0",
  description: "Provides access to real-time and static data for theme parks, including destinations, attractions, wait times, and schedules from ThemeParks.wiki."
});

// --- API Client Helper ---
interface ApiErrorResponse {
  error?: string;
  message?: string;
}

async function callThemeParksApi<T>(
  path: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  urlParams?: Record<string, any> // Used for query parameters if any, not directly in ThemeParks.wiki paths
): Promise<T> {
  const fullUrl = new URL(apiBaseUrl + path);

  if (urlParams) {
    for (const key in urlParams) {
      if (urlParams[key] !== undefined) {
        fullUrl.searchParams.append(key, String(urlParams[key]));
      }
    }
  }

  try {
    const response = await fetch(fullUrl.toString());

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After") || "unknown";
      console.warn(`ThemeParks API rate limit hit for ${path}. Retry after: ${retryAfter}s`);
      throw new Error(
        `API rate limit exceeded. Please try again after ${retryAfter} seconds.`
      );
    }

    if (!response.ok) {
      let errorDetails = `API responded with status ${response.status}`;
      try {
        const errorData: ApiErrorResponse = await response.json();
        errorDetails += `: ${errorData.message || errorData.error || await response.text()}`;
      } catch (e) {
        errorDetails += `: ${await response.text()}`;
      }
      console.error(`ThemeParks API error for ${path}: ${errorDetails}`);
      throw new Error(errorDetails);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith('API rate limit exceeded') || error.message.startsWith('API responded with status'))) {
        throw error; // Re-throw specific API errors to be caught by tool handler
    }
    console.error(`Network or other error calling ThemeParks API for ${path}:`, error);
    throw new Error(
      `Failed to call ThemeParks API for ${path}. ${(error as Error).message}`
    );
  }
}

// --- Tool Definitions ---

// 1. List Destinations
server.tool(
  "list_destinations",
  "Retrieves a list of all available top-level theme park destinations (e.g., Walt Disney World Resort, Universal Orlando Resort).",
  {}, // No parameters
  async () => {
    try {
      const data = await callThemeParksApi<unknown>("/destinations");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error listing destinations: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Common Entity ID parameter schema
const entityIdParams = {
  entity_id: z.string().uuid().describe("The unique GUID identifier for the entity (e.g., a specific destination, park, attraction, show, or restaurant).")
} as const;


// 2. Get Entity Details
server.tool(
  "get_entity_details",
  "Fetches detailed static information for a specific entity (like a park, attraction, or restaurant) using its unique ID.",
  entityIdParams,
  async (params) => {
    try {
      const data = await callThemeParksApi<unknown>(`/entity/${params.entity_id}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching details for entity ${params.entity_id}: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// 3. Get Entity Children
server.tool(
  "get_entity_children",
  "Retrieves all direct child entities for a given parent entity ID (e.g., all parks within a destination, or all attractions within a park).",
  entityIdParams, // Renaming to parent_entity_id in description for clarity, but param name is entity_id
  async (params) => {
    try {
      const data = await callThemeParksApi<unknown>(`/entity/${params.entity_id}/children`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching children for entity ${params.entity_id}: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// 4. Get Entity Live Data
server.tool(
  "get_entity_live_data",
  "Fetches live data for a specific entity and its children. This can include attraction wait times, park operating hours, and show times.",
  entityIdParams,
  async (params) => {
    try {
      const data = await callThemeParksApi<unknown>(`/entity/${params.entity_id}/live`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching live data for entity ${params.entity_id}: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// 5. Get Entity Schedule
const scheduleParamsSchema = z.object({ // Encapsulate in z.object for z.infer
  entity_id: z.string().uuid().describe("The unique GUID identifier for the entity."),
  year: z.number().int().min(2000).max(2100).optional()
    .describe("Optional. The year for the schedule (e.g., 2025). If omitted with month, fetches general schedule."),
  month: z.number().int().min(1).max(12).optional()
    .describe("Optional. The month for the schedule (1-12). If omitted with year, fetches general schedule. Requires year if specified."),
}); // No 'as const satisfies ZodRawShape' needed here when using z.object

type ScheduleParamsType = z.infer<typeof scheduleParamsSchema>;

server.tool(
  "get_entity_schedule",
  "Retrieves the operating schedule or calendar data for a specific entity. Can specify a year and month, or get general schedule data.",
  scheduleParamsSchema.shape, // Pass the .shape of the Zod object to server.tool
  async (params: ScheduleParamsType) => { // Use the inferred type here
    let path = `/entity/${params.entity_id}/schedule`;
    if (params.year && params.month) {
      path += `/${params.year}/${params.month}`;
    } else if (params.year || params.month) {
      // API requires both or neither for year/month path
      return {
        content: [{
          type: "text",
          text: "Error: If providing year or month for the schedule, both must be specified."
        }],
        isError: true
      };
    }

    try {
      const data = await callThemeParksApi<unknown>(path);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching schedule for entity ${params.entity_id}: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// --- Help Prompt ---
server.prompt(
  "help",
  "Provides a summary of all available tools and their usage.",
  {},
  () => ({
    messages: [{
      role: "user", // Or "assistant" depending on how you want it to appear
      content: {
        type: "text",
        text: `
Hello! I am the ThemeParks.wiki MCP Server. I can help you access data about theme parks. Here are the tools I offer:

1.  **list_destinations**:
    *   Description: Retrieves a list of all available top-level theme park destinations.
    *   Parameters: None

2.  **get_entity_details**:
    *   Description: Fetches detailed static information for a specific entity (park, attraction, etc.).
    *   Parameters:
        *   \`entity_id\` (string, UUID, required): The unique ID of the entity.

3.  **get_entity_children**:
    *   Description: Retrieves all direct child entities for a given parent entity.
    *   Parameters:
        *   \`entity_id\` (string, UUID, required): The unique ID of the parent entity.

4.  **get_entity_live_data**:
    *   Description: Fetches live data (wait times, hours, show times) for an entity and its children.
    *   Parameters:
        *   \`entity_id\` (string, UUID, required): The unique ID of the entity.

5.  **get_entity_schedule**:
    *   Description: Retrieves the operating schedule for an entity.
    *   Parameters:
        *   \`entity_id\` (string, UUID, required): The unique ID of the entity.
        *   \`year\` (integer, optional): The year for the schedule (e.g., 2025).
        *   \`month\` (integer, optional): The month (1-12). Both year and month must be provided if one is.

You can use these tools by asking me questions like:
- "List all theme park destinations."
- "Get details for entity with ID 'some-guid-here'."
- "What are the children of entity 'another-guid-here'?"
- "Show live data for park 'guid-for-a-park'."
- "What is the schedule for 'guid-for-an-attraction' for July 2025?"
        `
      }
    }]
  })
);


// --- Server Connection ---
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("ThemeParks.wiki MCP Server started successfully and connected via STDIO.");
  } catch (error) {
    console.error("Failed to start ThemeParks.wiki MCP Server:", error);
    process.exit(1);
  }
}

main();