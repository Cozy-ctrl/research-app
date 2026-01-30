import { json, type RequestHandler } from "@sveltejs/kit";
import { Client } from "@upstash/qstash";
import { env } from "$env/dynamic/private";

const qstash = new Client({ token: env.QSTASH_TOKEN });

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { query, userId } = await request.json();

    if (!query?.trim()) {
      return json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const researchId = `research-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Get the correct base URL
    const host = request.headers.get("host");
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
      executionId: result.messageId, // Changed from workflowRunId which might be different in latest SDK, sticking to result usually returns messageId for publishJSON
      status: "processing"
    });
  } catch (error) {
    console.error("Error triggering workflow:", error);
    return json(
      { error: "Failed to start research" },
      { status: 500 }
    );
  }
};
