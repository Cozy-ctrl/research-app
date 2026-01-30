import { json, type RequestHandler } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { researchCache } from "$lib/server/store";

interface WebhookPayload {
  researchId: string;
  userId: string;
  status: string;
  results: any;
  completedAt: string;
  secret: string;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const payload: WebhookPayload = await request.json();

    // Verify webhook signature
    if (payload.secret !== env.WEBHOOK_SECRET) {
      console.error("Invalid webhook secret");
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    // Store results in cache
    researchCache.set(payload.researchId, {
      researchId: payload.researchId,
      userId: payload.userId,
      status: payload.status,
      results: payload.results,
      completedAt: payload.completedAt,
      cachedAt: new Date().toISOString()
    });

    console.log(`✅ Webhook received and cached: ${payload.researchId}`);

    // TODO: In production, also store in database
    // await db.research.upsert({ researchId: payload.researchId }, {...});

    return json({ ok: true, researchId: payload.researchId });
  } catch (error) {
    console.error("Webhook error:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
};
