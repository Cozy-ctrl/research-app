<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { Separator } from "$lib/components/ui/separator";
  import * as Tabs from "$lib/components/ui/tabs";
  import { Check, Copy, Terminal, Shield, Zap, Globe, Code2 } from "lucide-svelte";
  import { toast } from "svelte-sonner";

  import { onMount } from "svelte";

  let copied = false;
  let endpointUrl = "https://your-app-url.netlify.app/api/research/run";

  // Dynamic code snippets
  $: curlExample = `curl -X POST ${endpointUrl} \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: Secret-123" \\
  -d '{"query": "Future of Solid State Batteries"}'`;

  $: jsExample = `const response = await fetch('${endpointUrl}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'Secret-123'
  },
  body: JSON.stringify({
    query: 'Future of Solid State Batteries'
  })
});

const data = await response.json();
console.log(data);`;

  $: pythonExample = `import requests

url = "${endpointUrl}"
headers = {
    "Content-Type": "application/json",
    "x-api-key": "Secret-123"
}
payload = {
    "query": "Future of Solid State Batteries"
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`;

  onMount(() => {
    endpointUrl = `${window.location.origin}/api/research/run`;
  });

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    copied = true;
    toast.success("Code copied to clipboard");
    setTimeout(() => copied = false, 2000);
  }

</script>

<svelte:head>
  <title>API Documentation - Research Assistant</title>
</svelte:head>

<div class="min-h-screen bg-background text-foreground transition-colors duration-300">
  <div class="container mx-auto px-4 py-12 max-w-5xl space-y-12">
    
    <!-- Hero -->
    <header class="space-y-6 pt-8 text-center md:text-left" in:fade={{ duration: 600 }}>
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
        <Terminal class="h-4 w-4" />
        <span>Developer Resource</span>
      </div>
      <h1 class="text-4xl md:text-6xl font-extrabold tracking-tight">
        Research API <span class="text-primary">Documentation</span>
      </h1>
      <p class="text-xl text-muted-foreground max-w-3xl leading-relaxed">
        Integrate our autonomous research agent into your own applications. 
        Deep research capabilities, accessible via a simple REST API.
      </p>
    </header>

    <Separator />

    <!-- Authentication Section -->
    <section class="grid gap-6 md:grid-cols-3" in:fly={{ y: 20, duration: 600, delay: 200 }}>
      <div class="md:col-span-1 space-y-4">
        <h2 class="text-2xl font-bold flex items-center gap-2">
          <Shield class="h-6 w-6 text-primary" />
          Authentication
        </h2>
        <p class="text-muted-foreground">
          All external requests must include your API key in the header.
        </p>
        <Card.Root class="bg-muted/30 border-primary/20">
          <Card.Content class="p-4 space-y-2">
            <div class="text-sm font-semibold text-muted-foreground">Header Name</div>
            <code class="block bg-background px-3 py-2 rounded border font-mono text-primary">x-api-key</code>
            <div class="text-sm font-semibold text-muted-foreground pt-2">Test Key</div>
            <code class="block bg-background px-3 py-2 rounded border font-mono text-green-500">Secret-123</code>
          </Card.Content>
        </Card.Root>
      </div>

      <div class="md:col-span-2 space-y-4">
        <h2 class="text-2xl font-bold flex items-center gap-2">
          <Globe class="h-6 w-6 text-primary" />
          Endpoints
        </h2>
        
        <Card.Root>
          <Card.Header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <Badge variant="default" class="bg-blue-600 hover:bg-blue-700">POST</Badge>
                <code class="text-lg font-mono">/api/research/run</code>
              </div>
              <Badge variant="outline">Async</Badge>
            </div>
          </Card.Header>
          <Card.Content class="space-y-4">
            <p class="text-muted-foreground">
              Triggers a new research workflow. This is an asynchronous operation that queues the research job.
            </p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 class="font-semibold mb-2 text-sm uppercase tracking-wide opacity-70">Request Body</h4>
                <div class="bg-muted rounded-lg p-3 font-mono text-sm border">
                  <span class="text-blue-400">{"{"}</span><br/>
                  &nbsp;&nbsp;<span class="text-green-400">"query"</span>: <span class="text-orange-400">"string (required)"</span>,<br/>
                  &nbsp;&nbsp;<span class="text-green-400">"userId"</span>: <span class="text-orange-400">"string (optional)"</span><br/>
                  <span class="text-blue-400">{"}"}</span>
                </div>
              </div>
              <div>
                <h4 class="font-semibold mb-2 text-sm uppercase tracking-wide opacity-70">Response</h4>
                <div class="bg-muted rounded-lg p-3 font-mono text-sm border">
                   <span class="text-blue-400">{"{"}</span><br/>
                  &nbsp;&nbsp;<span class="text-green-400">"researchId"</span>: <span class="text-orange-400">"research-123..."</span>,<br/>
                  &nbsp;&nbsp;<span class="text-green-400">"status"</span>: <span class="text-orange-400">"processing"</span><br/>
                  <span class="text-blue-400">{"}"}</span>
                </div>
              </div>
            </div>
          </Card.Content>
        </Card.Root>
      </div>
    </section>

    <!-- Code Examples -->
    <section class="space-y-6" in:fly={{ y: 20, duration: 600, delay: 400 }}>
       <h2 class="text-2xl font-bold flex items-center gap-2">
          <Code2 class="h-6 w-6 text-primary" />
          Integration Examples
        </h2>

        <Tabs.Root value="curl" class="w-full">
          <Tabs.List class="grid w-full grid-cols-3 max-w-[400px]">
            <Tabs.Trigger value="curl">cURL</Tabs.Trigger>
            <Tabs.Trigger value="js">JavaScript</Tabs.Trigger>
            <Tabs.Trigger value="python">Python</Tabs.Trigger>
          </Tabs.List>
          
          <Tabs.Content value="curl">
            <Card.Root class="bg-slate-950 text-slate-50 border-slate-800">
              <Card.Content class="p-6 relative">
                 <Button variant="ghost" size="icon" class="absolute right-4 top-4 text-slate-400 hover:text-white hover:bg-slate-800" onclick={() => copyCode(curlExample)}>
                    {#if copied} <Check class="h-4 w-4" /> {:else} <Copy class="h-4 w-4" /> {/if}
                 </Button>
                 <pre class="font-mono text-sm overflow-x-auto whitespace-pre-wrap"><code>{curlExample}</code></pre>
              </Card.Content>
            </Card.Root>
          </Tabs.Content>

          <Tabs.Content value="js">
             <Card.Root class="bg-slate-950 text-slate-50 border-slate-800">
              <Card.Content class="p-6 relative">
                 <Button variant="ghost" size="icon" class="absolute right-4 top-4 text-slate-400 hover:text-white hover:bg-slate-800" onclick={() => copyCode(jsExample)}>
                    {#if copied} <Check class="h-4 w-4" /> {:else} <Copy class="h-4 w-4" /> {/if}
                 </Button>
                 <pre class="font-mono text-sm overflow-x-auto whitespace-pre-wrap"><code>{jsExample}</code></pre>
              </Card.Content>
            </Card.Root>
          </Tabs.Content>
          
          <Tabs.Content value="python">
             <Card.Root class="bg-slate-950 text-slate-50 border-slate-800">
              <Card.Content class="p-6 relative">
                 <Button variant="ghost" size="icon" class="absolute right-4 top-4 text-slate-400 hover:text-white hover:bg-slate-800" onclick={() => copyCode(pythonExample)}>
                    {#if copied} <Check class="h-4 w-4" /> {:else} <Copy class="h-4 w-4" /> {/if}
                 </Button>
                 <pre class="font-mono text-sm overflow-x-auto whitespace-pre-wrap"><code>{pythonExample}</code></pre>
              </Card.Content>
            </Card.Root>
          </Tabs.Content>
        </Tabs.Root>
    </section>

  </div>
</div>
