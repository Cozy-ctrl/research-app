import { json, type RequestHandler } from "@sveltejs/kit";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
};

export const GET: RequestHandler = async () => {
  return json(
    { 
      status: "ok", 
      timestamp: new Date().toISOString() 
    },
    { 
      headers: corsHeaders 
    }
  );
};
