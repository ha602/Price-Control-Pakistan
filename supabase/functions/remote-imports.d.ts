declare module 'https://esm.sh/@supabase/supabase-js@2.39.0' {
  export function createClient(...args: any[]): any
}

declare module 'https://deno.land/x/denomailer@1.6.0/mod.ts' {
  export class SMTPClient {
    constructor(config: any)
    send(config: any): Promise<any>
    close(): void | Promise<void>
  }
}
