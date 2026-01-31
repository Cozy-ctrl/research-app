<script lang="ts">
  import { onMount } from "svelte";
  import { marked } from "marked";
  import { fade, fly, slide } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  
  // UI Components
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Progress } from "$lib/components/ui/progress";
  import * as Alert from "$lib/components/ui/alert";
  import { Separator } from "$lib/components/ui/separator";
  import { toast } from "svelte-sonner";
  import { 
    Loader2, 
    Search, 
    RotateCcw, 
    Copy, 
    Printer, 
    CheckCircle2, 
    AlertCircle, 
    FileText,
    BrainCircuit,
    Sparkles,
    Clock,
    ChevronRight,
    Terminal
  } from "lucide-svelte";

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
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  
  // Simulated progress for UI feel
  let progressValue = 0;

  async function startResearch() {
    if (!query.trim()) {
      toast.error("Please enter a research query");
      return;
    }

    loading = true;
    error = "";
    results = null;
    progressValue = 0;

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
      toast.success("Research started!");
      
      if (researchId) {
        localStorage.setItem("researchId", researchId);
      }

      // Start simulated progress
      const progressInterval = setInterval(() => {
        progressValue = Math.min(progressValue + Math.random() * 5, 90);
        if (results) clearInterval(progressInterval);
      }, 1000);

      startPolling();
    } catch (err: any) {
      error = err.message;
      toast.error(err.message);
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
            progressValue = 100;
            toast.success("Research completed!");
            if (pollInterval) clearInterval(pollInterval);
            pollInterval = null;
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000); 
  }

  async function checkResults() {
    if (!researchId) {
      toast.error("No research ID found");
      return;
    }

    checking = true;

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
        progressValue = 100;
        toast.success("Research completed!");
      } else {
        toast.info("Still processing...");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      checking = false;
    }
  }

  function resetSearch() {
    researchId = null;
    results = null;
    query = "";
    error = "";
    progressValue = 0;
    if (pollInterval) clearInterval(pollInterval);
    localStorage.removeItem("researchId");
  }

  function copyResults() {
    const text = results?.blogs.map(b => `# ${b.query.query}\n\n${b.content}`).join('\n\n---\n\n');
    navigator.clipboard.writeText(text || "");
    toast.success("All results copied to clipboard");
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

<div class="min-h-screen bg-background text-foreground transition-colors duration-300">
  <div class="container mx-auto px-4 py-8 md:py-16 max-w-5xl space-y-8">
    
    <!-- Hero Section -->
    <header class="text-center space-y-6 pt-4 md:pt-12" in:fade={{ duration: 800, delay: 200 }}>
      <div class="inline-flex items-center justify-center p-3 mb-4 rounded-full bg-primary/10 text-primary animate-pulse">
        <BrainCircuit class="h-8 w-8" />
      </div>
      <h1 class="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent bg-300% animate-gradient">
        Deep Knowledge Discovery
      </h1>
      <p class="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
        Autonomous multi-agent research powered by AI. 
        <span class="block text-base mt-2 opacity-80">Just ask a question, and we'll do the deep diving.</span>
      </p>
    </header>

    <!-- Main Input Section -->
    {#if !researchId}
      <div class="max-w-3xl mx-auto" in:fly={{ y: 20, duration: 600, delay: 400 }}>
        <Card.Root class="border-2 border-primary/5 shadow-2xl bg-card/50 backdrop-blur-sm">
          <Card.Content class="p-6 md:p-8">
            <form on:submit|preventDefault={startResearch} class="flex flex-col md:flex-row gap-4">
              <div class="relative flex-1 group">
                <Search class="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  bind:value={query} 
                  placeholder="What do you want to master today? (e.g. 'Future of Solid State Batteries')" 
                  class="pl-12 h-14 text-lg bg-background/50 border-input/60 focus-visible:ring-primary/20 transition-all font-medium"
                  disabled={loading}
                />
              </div>
              <Button type="submit" size="lg" disabled={loading} class="h-14 px-8 text-lg font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:scale-[1.02]">
                {#if loading}
                  <Loader2 class="mr-2 h-5 w-5 animate-spin" /> 
                  Initializing
                {:else}
                  <Sparkles class="mr-2 h-5 w-5" /> 
                  Start Research
                {/if}
              </Button>
            </form>
          </Card.Content>
        </Card.Root>

        <!-- Suggested Topics -->
        <div class="mt-8 flex flex-wrap justify-center gap-3 opacity-70">
          {#each ["Quantum Computing", "Longevity Research", "Rust vs Go", "Fusion Energy status"] as topic}
            <button 
              class="px-4 py-2 text-sm rounded-full bg-secondary/50 hover:bg-secondary text-secondary-foreground transition-colors cursor-pointer border border-transparent hover:border-primary/20"
              on:click={() => { query = topic; }}
            >
              {topic}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Progress / Status Section -->
    {#if researchId && !results}
      <div class="max-w-2xl mx-auto space-y-6" in:fade>
        <Card.Root class="relative overflow-hidden border-primary/20 shadow-xl">
          <!-- Background Pattern -->
          <div class="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none"></div>
          
          <Card.Header class="text-center pb-2">
            <Card.Title class="text-2xl flex items-center justify-center gap-2">
              <Loader2 class="h-6 w-6 animate-spin text-primary" />
              Researching
            </Card.Title>
            <Card.Description class="text-base">
              Agents are analyzing sources and synthesizing findings...
            </Card.Description>
          </Card.Header>
          
          <Card.Content class="space-y-6">
            <div class="space-y-2">
              <div class="flex justify-between text-sm font-medium text-muted-foreground">
                <span>Progress</span>
                <span>{Math.round(progressValue)}%</span>
              </div>
              <Progress value={progressValue} class="h-3 w-full" />
            </div>

            <div class="bg-muted/30 rounded-lg p-4 space-y-3 font-mono text-sm border border-border/50">
              <div class="flex items-center gap-2 text-primary">
                <Terminal class="h-4 w-4" />
                <span>Initializing agents... [Done]</span>
              </div>
              <div class="flex items-center gap-2 text-primary animate-pulse">
                <Search class="h-4 w-4" />
                <span>Searching knowledge bases...</span>
              </div>
              <div class="flex items-center gap-2 text-muted-foreground opacity-50">
                <FileText class="h-4 w-4" />
                <span>Synthesizing report...</span>
              </div>
            </div>

            <div class="flex justify-between items-center pt-2">
              <div class="text-xs text-muted-foreground flex items-center gap-1">
                <Clock class="h-3 w-3" /> Est. remaining: 1-2 mins
              </div>
              <div class="flex gap-2">
                <Button variant="outline" size="sm" class="gap-2" onclick={() => {
                   navigator.clipboard.writeText(researchId || "");
                   toast.success("ID copied");
                }}>
                  <Copy class="h-3 w-3" /> ID
                </Button>
                <Button variant="destructive" size="sm" class="gap-2" onclick={resetSearch}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card.Content>
        </Card.Root>
      </div>
    {/if}

    <!-- Results Section -->
    {#if results}
      <div class="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <!-- Results Header -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-6">
          <div class="space-y-1">
            <div class="flex items-center gap-2 text-primary mb-2">
              <CheckCircle2 class="h-5 w-5" />
              <span class="font-semibold text-sm tracking-wide uppercase">Analysis Complete</span>
            </div>
            <h2 class="text-3xl md:text-4xl font-bold tracking-tight">{results.query}</h2>
            <p class="text-muted-foreground flex items-center gap-2 text-sm">
              <Clock class="h-4 w-4" />
              Generated on {new Date(results.completedAt).toLocaleString()}
            </p>
          </div>
          
          <div class="flex gap-2">
            <Button variant="outline" onclick={copyResults} class="gap-2">
              <Copy class="h-4 w-4" /> Copy All
            </Button>
            <Button variant="outline" onclick={() => window.print()} class="gap-2">
              <Printer class="h-4 w-4" /> Print
            </Button>
            <Button onclick={resetSearch} class="gap-2">
              <RotateCcw class="h-4 w-4" /> New Search
            </Button>
          </div>
        </div>

        <!-- Content Cards -->
        <div class="space-y-12">
          {#each results.blogs as blog, i}
            <article class="group relative">
              <div class="absolute -left-4 md:-left-12 top-0 h-full w-[1px] bg-border/50 group-last:bg-transparent hidden md:block"></div>
              <div class="absolute -left-4 md:-left-[3.25rem] top-0 h-6 w-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary hidden md:flex">
                {i + 1}
              </div>

              <Card.Root class="border shadow-sm hover:shadow-md transition-shadow duration-300">
                <Card.Header class="bg-muted/10 pb-4 border-b">
                   <div class="flex flex-wrap justify-between gap-2 items-start">
                      <Card.Title class="text-2xl leading-tight">{blog.query.query}</Card.Title>
                      <Badge variant="secondary" class="font-mono text-xs uppercase tracking-wider">
                        {blog.query.type}
                      </Badge>
                   </div>
                </Card.Header>
                
                <Card.Content class="pt-6">
                  {#if blog.content === "Failed to generate content."}
                    <Alert.Root variant="destructive">
                      <AlertCircle class="h-4 w-4" />
                      <Alert.Title>Generation Failed</Alert.Title>
                      <Alert.Description>
                        Unable to generate content for this section. The AI model may have timed out or lacked sufficient data.
                      </Alert.Description>
                    </Alert.Root>
                  {:else}
                    <div class="prose prose-slate dark:prose-invert max-w-none 
                      prose-headings:font-semibold prose-headings:tracking-tight
                      prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
                      prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                      prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border/50
                      prose-blockquote:border-l-primary/50 prose-blockquote:bg-muted/20 prose-blockquote:py-1 prose-blockquote:px-4
                    ">
                      {@html marked.parse(blog.content)}
                    </div>
                  {/if}
                </Card.Content>

                {#if blog.query.context}
                   <div class="bg-muted/5 px-6 py-4 text-xs text-muted-foreground border-t flex flex-col gap-1">
                      <span class="uppercase tracking-widest font-semibold opacity-50 text-[10px]">Context</span>
                      <p class="italic opacity-80">{blog.query.context}</p>
                   </div>
                {/if}
              </Card.Root>
            </article>
          {/each}
        </div>

        <div class="flex justify-center pt-8 pb-20">
          <Button variant="ghost" class="text-muted-foreground hover:text-primary transition-colors" onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div class="flex flex-col items-center gap-1">
              <ChevronRight class="h-6 w-6 -rotate-90" />
              <span>Back to Top</span>
            </div>
          </Button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  /* Global page transitions */
  :global(.page-transition-enter) {
    animation: fade-in 0.3s ease-out;
  }
  
  @keyframes gradient {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  
  .animate-gradient {
    background-size: 300%;
    animation: gradient 8s ease infinite;
  }
</style>
