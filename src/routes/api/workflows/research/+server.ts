import { serve } from "@upstash/workflow/svelte";
import { env } from "$env/dynamic/private";
import { researchCache } from "$lib/server/store";

interface ResearchPayload {
  query: string;
  userId: string;
  researchId: string;
}

function sanitize(str: string | undefined): string {
  if (!str) return "";
  // Remove smart quotes and non-ascii characters that might cause header issues
  return str.replace(/[\u2018\u2019\u201C\u201D]/g, '').replace(/[^\x00-\x7F]/g, '').trim();
}

export const { POST } = serve<ResearchPayload>(
  async (context) => {
    const { query, userId, researchId } = context.requestPayload;

    const apiKey = sanitize(env.OPENROUTER_API_KEY);
    const siteUrl = sanitize(env.PUBLIC_SITE_URL) || "http://localhost:5173";

    console.log(`Starting research: ${researchId}`);

    // ============================================
    // STEP 1: Initial OpenRouter Research Call
    // ============================================
    const openrouterInitial = await context.call("openrouter-initial", {
      url: "https://openrouter.ai/api/v1/chat/completions",
      method: "POST",
      body: {
        model: "openrouter/auto",
        messages: [
          {
            role: "system",
            content: "You are a comprehensive research assistant. Provide detailed, well-structured research findings."
          },
          {
            role: "user",
            content: `Please conduct comprehensive research on the following topic and provide detailed findings: "${query}"`
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      },
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": siteUrl,
        "X-Title": "Research Assistant"
      },
      timeout: 7200, // 2 hours
      retries: 3,
      retryDelay: "exponential"
    });

    if (openrouterInitial.status !== 200) {
      throw new Error(`OpenRouter initial call failed: ${openrouterInitial.status}`);
    }

    const initialResearch = openrouterInitial.body.choices?.[0]?.message?.content || "";

    // ============================================
    // STEP 2: Generate 10 Different Search Angles
    // ============================================
    const generateSearchAngles = await context.call("generate-search-angles", {
      url: "https://openrouter.ai/api/v1/chat/completions",
      method: "POST",
      body: {
        model: "openrouter/auto",
        messages: [
          {
            role: "system",
            content: "Generate 10 different search query angles for comprehensive research coverage."
          },
          {
            role: "user",
            content: `Generate 10 different search query variations to thoroughly research: "${query}". Return as a JSON array of strings.`
          }
        ],
        temperature: 0.8,
        max_tokens: 1000
      },
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": siteUrl,
        "X-Title": "Research Assistant"
      },
      timeout: 7200,
      retries: 3
    });

    let searchAngles = [];
    try {
      const content = generateSearchAngles.body.choices?.[0]?.message?.content || "[]";
      searchAngles = JSON.parse(content);
    } catch (e) {
      searchAngles = [query, `${query} overview`, `${query} analysis`];
    }

    // ============================================
    // STEP 3: Parallel Deep Dives via OpenRouter
    // ============================================
    const deepDivePromises = searchAngles.slice(0, 10).map((angle, i) =>
      context.call(`research-angle-${i}`, {
        url: "https://openrouter.ai/api/v1/chat/completions",
        method: "POST",
        body: {
          model: "openrouter/auto",
          messages: [
            {
              role: "system",
              content: "Provide detailed research findings on this specific angle."
            },
            {
              role: "user",
              content: `Research angle: "${angle}". Provide comprehensive findings and insights.`
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        },
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": env.PUBLIC_SITE_URL || "http://localhost:5173",
          "X-Title": "Research Assistant"
        },
        timeout: 7200,
        retries: 2
      })
    );

    const deepDiveResults = await Promise.all(deepDivePromises);

    // ============================================
    // STEP 4: Minimax Analysis via OpenRouter
    // (Minimax through OpenRouter's API)
    // ============================================
    const minimaxAnalysisPromises = deepDiveResults.map((result, i) =>
      context.call(`minimax-analysis-${i}`, {
        url: "https://openrouter.ai/api/v1/chat/completions",
        method: "POST",
        body: {
          model: "openrouter/auto",
          messages: [
            {
              role: "system",
              content: "You are an expert at synthesizing and analyzing research data. Provide concise summaries with key takeaways, risks, and opportunities."
            },
            {
              role: "user",
              content: `Analyze and summarize this research finding into key points, potential risks, and opportunities:\n\n${result.body.choices?.[0]?.message?.content || ""}`
            }
          ],
          temperature: 0.6,
          max_tokens: 1500
        },
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": env.PUBLIC_SITE_URL || "http://localhost:5173",
          "X-Title": "Research Assistant"
        },
        timeout: 7200,
        retries: 2
      })
    );

    const minimaxResults = await Promise.all(minimaxAnalysisPromises);

    // ============================================
    // STEP 5: Final Consolidation
    // ============================================
    const consolidated = await context.run("consolidate-results", async () => {
      const consolidationData = {
        query,
        researchId,
        initialResearch,
        searchAngles: searchAngles.slice(0, 10),
        deepDives: deepDiveResults.map(r => ({
          status: r.status,
          content: r.body.choices?.[0]?.message?.content || ""
        })),
        minimaxAnalysis: minimaxResults.map(r => ({
          status: r.status,
          analysis: r.body.choices?.[0]?.message?.content || ""
        })),
        completedAt: new Date().toISOString(),
        processingTimeMs: Date.now()
      };

      // Store in cache for quick retrieval
      researchCache.set(researchId, {
        researchId,
        userId,
        status: "completed",
        results: consolidationData,
        cachedAt: new Date().toISOString()
      });

      return consolidationData;
    });

    // ============================================
    // STEP 6: Notify Webhook
    // ============================================
    // Ensure we have a valid URL base. In local dev it might depend on incoming request, which we don't have direct access to in serve's context easily
    // unless we use env vars. Ideally env.PUBLIC_SITE_URL should be set.
    // Fallback to localhost if not set.
    const origin = env.PUBLIC_SITE_URL || "http://localhost:5173";
    
    // Note: The user's code used: `${new URL(context.requestPayload as any).origin}` which implies requestPayload has origin? 
    // Usually requestPayload only has the body sent. I will use the env var approach for safety.

    const notifyResponse = await context.call("notify-webhook", {
      url: `${origin}/api/research/webhook`,
      method: "POST",
      body: {
        researchId,
        userId,
        status: "completed",
        results: consolidated,
        completedAt: new Date().toISOString(),
        secret: env.WEBHOOK_SECRET
      },
      timeout: 60,
      retries: 3
    });

    console.log(`Research ${researchId} completed and notified`);

    return { researchId, status: "completed" };
  },
  { env }
);
