/**
 * Forge AI — Tool declarations (OpenAPI schema format — lowercase types required)
 * Handlers run in the browser; system commands are proxied via the bridge server.
 */

const BRIDGE_URL = "http://localhost:3001/execute";

async function callBridge(command, args) {
    try {
        const res = await fetch(BRIDGE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command, args }),
        });
        return await res.json();
    } catch {
        return { success: false, error: "Bridge server not running. Start it with: node bridge/server.js" };
    }
}

// ── Declarations sent to Gemini Live API ─────────────────────────────────────
export const tools = [
    {
        functionDeclarations: [
            {
                name: "google_search",
                description: "Search a topic on Google and open results in a new tab.",
                parameters: {
                    type: "object",
                    properties: {
                        topic: { type: "string", description: "The search query." },
                    },
                    required: ["topic"],
                },
            },
            {
                name: "youtube_search",
                description: "Search for a video or song on YouTube and open results in a new tab.",
                parameters: {
                    type: "object",
                    properties: {
                        topic: { type: "string", description: "The video or song to search for." },
                    },
                    required: ["topic"],
                },
            },
            {
                name: "open_app",
                description: "Open a local Windows application or a website URL.",
                parameters: {
                    type: "object",
                    properties: {
                        app_name: {
                            type: "string",
                            description: "Application name (e.g. 'notepad', 'chrome', 'spotify') or a full URL.",
                        },
                    },
                    required: ["app_name"],
                },
            },
            {
                name: "system_command",
                description: "Control system audio — mute/unmute or set volume level.",
                parameters: {
                    type: "object",
                    properties: {
                        command: {
                            type: "string",
                            enum: ["mute", "volume"],
                            description: "'mute' toggles mute; 'volume' sets the level.",
                        },
                        value: {
                            type: "integer",
                            description: "Volume percentage 0–100 (only used when command is 'volume').",
                        },
                    },
                    required: ["command"],
                },
            },
            {
                name: "clawdbot_agent",
                description: "Query the Clawdbot agent for business data, sales dashboards, or weather.",
                parameters: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "The natural-language query to send." },
                    },
                    required: ["query"],
                },
            },
        ],
    },
];

// ── Handlers called when Gemini invokes a tool ────────────────────────────────
export const toolHandlers = {
    google_search: async ({ topic }) => {
        window.open(`https://www.google.com/search?q=${encodeURIComponent(topic)}`, "_blank");
        return { success: true, message: `Opened Google search for "${topic}"` };
    },

    youtube_search: async ({ topic }) => {
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(topic)}`, "_blank");
        return { success: true, message: `Opened YouTube search for "${topic}"` };
    },

    open_app:       async (args) => callBridge("open_app",       args),
    system_command: async (args) => callBridge("system_command", args),
    clawdbot_agent: async (args) => callBridge("clawdbot_agent", args),
};
