import { buildOpenApi } from "@/lib/api/openapi";

// Generowana przy budowaniu ze schematów zod (lib/api/contract.ts), więc nie rozjedzie się z kodem tras.
export const dynamic = "force-static";

export function GET() {
  return Response.json(buildOpenApi(), { headers: { "Access-Control-Allow-Origin": "*" } });
}
