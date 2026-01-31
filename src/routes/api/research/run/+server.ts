import { json, type RequestHandler } from "@sveltejs/kit";
import { Client } from "@upstash/qstash";
import { env } from "$env/dynamic/private";

const qstash = new Client({ token: env.QSTASH_TOKEN });

const COZY_API_KEY = env.COZY_API_KEY;

// CORS Headers helper
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    // 1. Security Check
    const apiKey = request.headers.get("x-api-key");
    const origin = request.headers.get("origin");
    const host = request.headers.get("host"); // e.g. localhost:5173
    
    // Determine if request is internal (same origin)
    // Note: In production, trust specific domains if possible. 
    // For now, we compare origin hostname with current host.
    const isInternal = origin && origin.includes(host || ""); 
    const isAuthenticated = apiKey === COZY_API_KEY;

    if (!isInternal && !isAuthenticated) {
      // If we have an API key configured but none provided/matched, and not internal -> 401
      // If no API key configured, we might default to open or closed. 
      // Safest is: if Key exists in env, enforce it.
      if (COZY_API_KEY) {
        return json(
          { error: "Unauthorized: Invalid or missing API Key" },
          { status: 401, headers: corsHeaders }
        );
      }
    }

    const { query, userId } = await request.json();

    if (!query?.trim()) {
      return json(
        { error: "Query is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const researchId = `research-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Get the correct base URL
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const baseUrl = `${protocol}://${host}`;

    // Trigger the workflow
    const result = await qstash.publishJSON({
      url: `${baseUrl}/api/workflows/research`,
      body: {
        query,
        userId: userId || "anonymous",
        researchId
      }
    });

    return json({
      researchId,
      executionId: result.messageId,
      status: "processing"
    }, {
      headers: corsHeaders
    });
  } catch (error) {
    console.error("Error triggering workflow:", error);
    return json(
      { error: "Failed to start research" },
      { status: 500, headers: corsHeaders }
    );
  }
};
