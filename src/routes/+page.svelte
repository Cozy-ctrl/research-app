<script lang="ts">
  import { onMount } from "svelte";

  interface ResearchResult {
    query: string;
    researchId: string;
    initialResearch: string;
    searchAngles: string[];
    deepDives: Array<{ status: number; content: string }>;
    minimaxAnalysis: Array<{ status: number; analysis: string }>;
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
              <label>Research ID:</label>
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

        <!-- Initial Research -->
        <div class="result-card initial-research">
          <div class="card-header">
            <h3>📝 Initial Research</h3>
            <span class="card-badge">Foundation</span>
          </div>
          <div class="card-content">
            <p>{results.initialResearch}</p>
          </div>
        </div>

        <!-- Search Angles -->
        <div class="result-card search-angles">
          <div class="card-header">
            <h3>🎯 Research Angles</h3>
            <span class="card-badge">{results.searchAngles.length} angles</span>
          </div>
          <div class="card-content">
            <div class="angles-grid">
              {#each results.searchAngles as angle, i}
                <div class="angle-item">
                  <span class="angle-number">{i + 1}</span>
                  <span class="angle-text">{angle}</span>
                </div>
              {/each}
            </div>
          </div>
        </div>

        <!-- Deep Dives -->
        <div class="result-card deep-dives">
          <div class="card-header">
            <h3>🔍 Deep Dive Analysis</h3>
            <span class="card-badge">{results.deepDives.length} analyses</span>
          </div>
          <div class="card-content">
            <div class="dives-container">
              {#each results.deepDives as dive, i}
                <div class="dive-item">
                  <div class="dive-header">
                    <h4>Analysis {i + 1}</h4>
                    <span class="status-code" class:success={dive.status === 200}>
                      {dive.status}
                    </span>
                  </div>
                  <p class="dive-content">{dive.content}</p>
                </div>
              {/each}
            </div>
          </div>
        </div>

        <!-- Minimax Analysis -->
        <div class="result-card minimax">
          <div class="card-header">
            <h3>⚙️ Synthesized Analysis</h3>
            <span class="card-badge">{results.minimaxAnalysis.length} syntheses</span>
          </div>
          <div class="card-content">
            <div class="analysis-container">
              {#each results.minimaxAnalysis as analysis, i}
                <div class="analysis-item">
                  <div class="analysis-number">Analysis {i + 1}</div>
                  <div class="analysis-text">{analysis.analysis}</div>
                </div>
              {/each}
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="results-actions">
          <button on:click={() => window.print()} class="btn btn-secondary">
            🖨️ Print Results
          </button>
          <button
            on:click={() => {
              const text = `Research: ${results?.query}\n\n${results?.initialResearch}`;
              navigator.clipboard.writeText(text);
              success = "Results copied to clipboard!";
            }}
            class="btn btn-secondary"
          >
            📋 Copy to Clipboard
          </button>
          <button on:click={resetSearch} class="btn btn-primary">
            🔍 New Search
          </button>
        </div>
      </section>
    {/if}
  </main>
</div>
