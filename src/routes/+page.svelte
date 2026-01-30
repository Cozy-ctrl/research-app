<script lang="ts">
  import { onMount } from "svelte";
  import { marked } from "marked";

  interface ResearchResult {
    researchId: string;
    query: string;
    blogs: Array<{
      query: {
        query: string;
        type: string;
        context: string;
      };
      content: string;
    }>;
    completedAt: string;
  }

  let query = "";
  let researchId: string | null = null;
  let results: ResearchResult | null = null;
  let loading = false;
  let checking = false;
  let error = "";
  let success = "";
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  
  // ... (keeping existing script logic same, interface was the key change) ...

  async function startResearch() {
    if (!query.trim()) {
      error = "Please enter a research query";
      return;
    }

    loading = true;
    error = "";
    success = "";
    results = null;

    try {
      const response = await fetch("/api/research/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start research");
      }

      const data = await response.json();
      researchId = data.researchId;
      success = "Research started! Waiting for results...";
      if (researchId) {
        localStorage.setItem("researchId", researchId);
      }

      // Start polling automatically
      startPolling();
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function startPolling() {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
      if (!researchId) return;

      try {
        const response = await fetch(`/api/research/status/${researchId}`);

        if (response.ok) {
          const data = await response.json();
          if (data.status === "completed") {
            results = data.results;
            success = "Research completed!";
            if (pollInterval) clearInterval(pollInterval);
            pollInterval = null;
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000); // Poll every 3 seconds
  }

  async function checkResults() {
    if (!researchId) {
      error = "No research ID found";
      return;
    }

    checking = true;
    error = "";

    try {
      const response = await fetch(`/api/research/status/${researchId}`);

      if (!response.ok) {
        if (response.status === 404) {
          checking = false;
          return;
        }
        throw new Error("Failed to fetch results");
      }

      const data = await response.json();
      if (data.status === "completed") {
        results = data.results;
        success = "Research completed!";
      }
    } catch (err: any) {
      error = err.message;
    } finally {
      checking = false;
    }
  }

  function resetSearch() {
    researchId = null;
    results = null;
    query = "";
    error = "";
    success = "";
    if (pollInterval) clearInterval(pollInterval);
    localStorage.removeItem("researchId");
  }

  onMount(() => {
    const savedId = localStorage.getItem("researchId");
    if (savedId) {
      researchId = savedId;
      checkResults();
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  });
</script>

<svelte:head>
  <title>Research Assistant</title>
</svelte:head>

<div class="page">
  <!-- Hero Section -->
  <header class="hero">
    <div class="hero-content">
      <h1>🔬 AI Research Assistant</h1>
      <p>Submit any topic and get comprehensive research analysis powered by AI</p>
    </div>
  </header>

  <main class="container">
    <!-- Input Section -->
    {#if !researchId}
      <section class="input-section">
        <form on:submit|preventDefault={startResearch}>
          <div class="search-box">
            <input
              type="text"
              placeholder="What would you like researched? E.g., 'Climate change solutions', 'AI trends 2024'..."
              bind:value={query}
              disabled={loading}
              class="search-input"
            />
            <button type="submit" disabled={loading} class="search-btn">
              {#if loading}
                <span class="spinner"></span>
                Starting...
              {:else}
                <span>▶</span>
                Start Research
              {/if}
            </button>
          </div>
        </form>
      </section>
    {/if}

    <!-- Alerts -->
    {#if error}
      <div class="alert alert-error">
        <span class="alert-icon">⚠️</span>
        <span>{error}</span>
        <button on:click={() => (error = "")} class="alert-close">×</button>
      </div>
    {/if}

    {#if success}
      <div class="alert alert-success">
        <span class="alert-icon">✅</span>
        <span>{success}</span>
        <button on:click={() => (success = "")} class="alert-close">×</button>
      </div>
    {/if}

    <!-- Research Status Section -->
    {#if researchId && !results}
      <section class="status-section">
        <div class="status-card">
          <div class="status-header">
            <h2>⏳ Research In Progress</h2>
            <div class="status-badge">Processing</div>
          </div>

          <div class="status-content">
            <div class="research-id">
              <span class="label">Research ID:</span>
              <code>{researchId}</code>
              <button
                on:click={() => {
                  navigator.clipboard.writeText(researchId || "");
                  success = "Research ID copied!";
                }}
                class="copy-btn"
              >
                📋 Copy
              </button>
            </div>

            <p class="status-message">
              Your research is being processed. This typically takes 5-10 minutes depending on
              complexity.
            </p>

            <div class="action-buttons">
              <button
                on:click={checkResults}
                disabled={checking}
                class="btn btn-primary"
              >
                {#if checking}
                  <span class="spinner"></span>
                  Checking...
                {:else}
                  🔄 Check Results
                {/if}
              </button>
              <button on:click={resetSearch} class="btn btn-secondary">
                🔍 New Search
              </button>
            </div>

            <p class="info-text">
              💡 You can close this page and come back later. Your research will be saved.
            </p>
          </div>
        </div>
      </section>
    {/if}

    <!-- Results Section -->
    {#if results}
      <section class="results-section">
        <div class="results-header">
          <h2>📊 Research Results</h2>
          <div class="results-meta">
            <span class="meta-item">
              <strong>Query:</strong> {results.query}
            </span>
            <span class="meta-item">
              <strong>Completed:</strong>
              {new Date(results.completedAt).toLocaleString()}
            </span>
          </div>
        </div>

        <!-- Research Blogs -->
        <div class="blogs-container">
          {#each results.blogs as blog, i}
            <div class="result-card blog-post">
              <div class="card-header">
                <div class="header-left">
                  <span class="blog-number">#{i + 1}</span>
                  <h3>{blog.query.query}</h3>
                </div>
                <div class="header-right">
                  {#if blog.content === "Failed to generate content."}
                    <span class="status-badge error">Failed</span>
                  {:else}
                    <span class="query-type-badge">{blog.query.type}</span>
                  {/if}
                </div>
              </div>
              
              <div class="card-content">
                <div class="context-box">
                  <strong>Context:</strong> {blog.query.context}
                </div>
                <hr class="divider"/>
                
                {#if blog.content === "Failed to generate content."}
                  <div class="error-state">
                    <span class="error-icon">⚠️</span>
                    <p>
                      Unable to generate content for this section. This can happen if the AI model times out
                      or if the search results were insufficient.
                    </p>
                  </div>
                {:else}
                  <div class="blog-body markdown-content">
                    {@html marked.parse(blog.content)}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        <!-- Action Buttons -->
        <div class="results-actions">
          <button on:click={() => window.print()} class="btn btn-secondary">
            🖨️ Print Results
          </button>
          <button
            on:click={() => {
              const text = results?.blogs.map(b => `# ${b.query.query}\n\n${b.content}`).join('\n\n---\n\n');
              navigator.clipboard.writeText(text || "");
              success = "Results copied to clipboard!";
            }}
            class="btn btn-secondary"
          >
            📋 Copy All
          </button>
          <button on:click={resetSearch} class="btn btn-primary">
            🔍 New Search
          </button>
        </div>
      </section>
    {/if}
  </main>
</div>
