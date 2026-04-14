/**
 * Minimal Deno globals + URL import shim for Supabase Edge Functions.
 * Runtime uses real Deno + esm.sh; this only satisfies the workspace TypeScript checker.
 */
export {}

declare global {
  const Deno: {
    serve: (handler: (req: Request) => Response | Promise<Response>) => void
    readonly env: {
      get(name: string): string | undefined
    }
  }
}

// Deno.serve is provided by the Supabase Edge runtime; shim satisfies local TS.
