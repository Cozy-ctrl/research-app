import { json, type RequestHandler } from "@sveltejs/kit";
import { researchCache } from "$lib/server/store";

export const GET: RequestHandler = async ({ params }) => {
  const { researchId } = params;

  if (!researchId) {
    return json(
      { error: "Research ID is required" },
      { status: 400 }
    );
  }

  const research = researchCache.get(researchId);

  if (!research) {
    return json(
      {
        error: "Research not found or still processing",
        researchId,
        status: "processing"
      },
      { status: 404 }
    );
  }

  return json(research);
};
