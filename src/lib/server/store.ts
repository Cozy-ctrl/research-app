// Simple in-memory cache (replace with database in production)
// Note: In serverless environments (like Netlify), this cache will not verify reliably across invocations
// but it works for local development and demonstration purposes.
export const researchCache = new Map<string, any>();
