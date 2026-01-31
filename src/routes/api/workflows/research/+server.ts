import { serve } from "@upstash/workflow/svelte";
import { env } from "$env/dynamic/private";
import { redis } from "$lib/server/store";

interface ResearchPayload {
  query: string;
  userId: string;
  researchId: string;
}

interface SearchQuery {
  query: string;
  type: "who" | "what" | "why" | "when" | "where" | "how";
  context: string;
}

// Helper to sanitize headers - Restored from commit 26db369
function sanitize(str: string | undefined): string {
  if (!str) return "";
  return str.replace(/[\u2018\u2019\u201C\u201D]/g, '').replace(/[^\x00-\x7F]/g, '').trim();
}

export const { POST } = serve<ResearchPayload>(
  async (context) => {
    const { query, userId, researchId } = context.requestPayload;
    // Apply sanitization to context.env variables
    const openRouterKey = sanitize(env.OPENROUTER_API_KEY);
    const searchApiKey = sanitize(env.SEARCHAPI_API_KEY);
    const siteUrl = sanitize(env.PUBLIC_SITE_URL) || "http://localhost:5173";

    // ============================================
    // STEP 1: Plan Research (Palmyra-X5)
    // ============================================
    const planResult = await context.call<any>("plan-research", {
      url: "https://openrouter.ai/api/v1/chat/completions",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": siteUrl,
        "X-Title": "Research Planner"
      },
      body: JSON.stringify({
        model: "writer/palmyra-x5",
        messages: [
          {
            role: "system", 
            content: "You are an expert Google Search operator. Your task is to generate specific, standalone search queries that will yield high-quality research results. NEVER generate vague one-word queries like 'why' or 'how'. Every query must be a complete, self-contained phrase including the subject."
          },
          {
            role: "user",
            content: `User Query: "${query}"\n\nGenerate up to 10 unique search queries to fully research this topic.\n\nJSON Output Rules:\n1. "query": The exact string to type into Google. MUST include the subject (e.g. "koala habitat loss statistics" NOT "habitat loss").\n2. "type": One of "who", "what", "why", "when", "where", "how".\n3. "context": Brief explanation of what this search aims to find.\n\nThink: "If I typed this into Google without any other context, would I get the right answer?"`
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" } 
      }),
      retries: 3,
      timeout: "30s"
    } as any);

    let searchQueries: SearchQuery[] = [];
    try {
      const content = planResult.body.choices?.[0]?.message?.content || "[]";
      const cleanContent = content.replace(/```json\n?|\n?```/g, "");
      const parsed = JSON.parse(cleanContent);
      searchQueries = Array.isArray(parsed) ? parsed : (parsed.queries || []);
    } catch (e) {
      console.error("Failed to parse search queries", e);
      searchQueries = [{ query: query, type: "what", context: "Fallback query" }];
    }

    searchQueries = searchQueries.slice(0, 10);

    // ============================================
    // STEP 2: Execute Search (SearchAPI)
    // ============================================
    const searchResults = await Promise.all(
      searchQueries.map((item, index) => 
        context.call<any>(`search-${index}`, {
          url: `https://www.searchapi.io/api/v1/search?api_key=${searchApiKey}&engine=google&q=${encodeURIComponent(item.query)}&num=5`,
          method: "GET",
          retries: 3,
          timeout: "30s"
        } as any)
      )
    );

    // ============================================
    // STEP 3: Write Blog Posts (Palmyra-X5)
    // ============================================
    const blogPosts = await Promise.all(
      searchResults.map((result, index) => {
        const queryItem = searchQueries[index];
        const organicResults = result.body.organic_results || [];
        const snippets = organicResults.map((r: any) => `Title: ${r.title}\nLink: ${r.link}\nSnippet: ${r.snippet}`).join("\n\n");

        return context.call<any>(`write-blog-${index}`, {
          url: "https://openrouter.ai/api/v1/chat/completions",
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openRouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": siteUrl,
            "X-Title": "Research Writer"
          },
          body: JSON.stringify({
            model: "writer/palmyra-x5",
            messages: [
              {
                role: "system",
                content: `You are an expert content writer. Analyze search results and write high-authority blog posts with strict APA citations.

Writing Style Guide:
- Tone: Professional, authentic, and direct. Balance insight with straightforward communication.
- Perspective: Clear, practical, and drawn from real-world experience. Emphasize practical wisdom over theoretical depth.
- Language: Accessible and easy to understand. Avoid excessive academic complexity.
- Approach: Demonstrate understanding through relatable examples and clear, concise explanations that connect with readers' everyday experiences.`
              },
              {
                role: "user",
                content: `Context: ${queryItem.context}\nQuery: ${queryItem.query}\n\nSearch Results:\n${snippets}\n\nTask:\n1. Extract and structure key information into a high authority blog post section.\n2. Convert all references into APA citations at the bottom.\n3. Keep it focused on answering the specific question: "${queryItem.query}"`
              }
            ]
          }),
          retries: 3,
          timeout: "30s"
        } as any);
      })
    );

    // ============================================
    // STEP 4: Consolidate & Notify
    // ============================================
    const finalContent = await context.run("consolidate", async () => {
      const blogs = blogPosts.map((post, i) => ({
        query: searchQueries[i],
        content: post.body.choices?.[0]?.message?.content || "Failed to generate content."
      }));

      const resultData = {
        researchId,
        query,
        blogs,
        completedAt: new Date().toISOString()
      };

      // Save to Redis
      await redis.set(researchId, {
        researchId,
        userId,
        status: "completed",
        results: resultData
      });

      return resultData;
    });

    await context.call("webhook", {
      url: `${siteUrl}/api/research/webhook`,
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
         ...finalContent,
         secret: context.env.WEBHOOK_SECRET
      }),
      retries: 3,
      timeout: "30s"
    } as any);

    return { status: "completed", researchId };
  },
  { env }
);