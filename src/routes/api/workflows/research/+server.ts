import { serve } from "@upstash/workflow/svelte";
import { env } from "$env/dynamic/private";
import { researchCache } from "$lib/server/store";

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

// Helper to sanitize headers
function sanitize(str: string | undefined): string {
  if (!str) return "";
  return str.replace(/[\u2018\u2019\u201C\u201D]/g, '').replace(/[^\x00-\x7F]/g, '').trim();
}

export const { POST } = serve<ResearchPayload>(
  async (context) => {
    const { query, userId, researchId } = context.requestPayload;
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
      body: {
        model: "writer/palmyra-x5",
        messages: [
          {
            role: "system", 
            content: "You are a research planning assistant. Analyze the user query and generate up to 10 specific search queries that answer Who, What, Why, When, Where, and How questions as needed. Return a JSON array."
          },
          {
            role: "user",
            content: `User Query: "${query}"\n\nReturn a JSON array with objects containing:\n- "query": the search query string\n- "type": one of "who", "what", "why", "when", "where", "how"\n- "context": brief context for this search\n\nExample format:\n[\n  {"query": "what is...", "type": "what", "context": "understanding the concept"},\n  {"query": "who invented...", "type": "who", "context": "historical background"}\n]`
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" } 
      }
    } as any);

    let searchQueries: SearchQuery[] = [];
    try {
      // context.call returns the response body directly in the 'body' property if it's JSON
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
          url: "https://www.searchapi.io/api/v1/search",
          method: "GET",
          params: {
            api_key: searchApiKey,
            engine: "google",
            q: item.query,
            num: "5"
          }
        } as any)
      )
    );

    // ============================================
    // STEP 3: Write Blog Posts (Minimax)
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
          body: {
            model: "minimax/minimax-m2.1",
            messages: [
              {
                role: "system",
                content: "You are an expert content writer. Analyze search results and write high-authority blog posts with strict APA citations."
              },
              {
                role: "user",
                content: `Context: ${queryItem.context}\nQuery: ${queryItem.query}\n\nSearch Results:\n${snippets}\n\nTask:\n1. Extract and structure key information into a high authority blog post section.\n2. Convert all references into APA citations at the bottom.\n3. Keep it focused on answering the specific question: "${queryItem.query}"`
              }
            ]
          }
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

      researchCache.set(researchId, {
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
      body: {
         ...finalContent,
         secret: env.WEBHOOK_SECRET
      }
    } as any);

    return { status: "completed", researchId };
  },
  { env }
);
