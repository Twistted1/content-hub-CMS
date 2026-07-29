import { vi } from "vitest";

/**
 * Supabase's query builder is chainable (`.select().eq().order()...`) and
 * thenable — awaiting it at any point resolves to `{ data, error }`. Real
 * hooks in this codebase chain a different number of calls before awaiting,
 * so the mock has to support being awaited from any point in the chain,
 * not just after a fixed set of methods.
 */
export interface MockResult<T = unknown> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

function chainable<T>(result: MockResult<T>): any {
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === "then") {
        const promise = Promise.resolve(result);
        return promise.then.bind(promise);
      }
      if (prop === "catch" || prop === "finally") {
        const promise = Promise.resolve(result);
        return (promise as any)[prop].bind(promise);
      }
      // Any other call (.select, .eq, .order, .insert, .single, ...) just
      // keeps returning the same chainable proxy.
      return () => proxy;
    },
  };
  const proxy = new Proxy(() => {}, handler);
  return proxy;
}

/**
 * Builds a mock Supabase client for `vi.mock("@/integrations/supabase/client", ...)`.
 *
 * `tableResults` maps table name -> the { data, error } that `.from(table)`
 * should eventually resolve to for that test. Tables not listed resolve to
 * `{ data: [], error: null }` so hooks touching untested tables don't throw.
 *
 * Usage:
 *   vi.mock("@/integrations/supabase/client", () => ({
 *     supabase: createMockSupabaseClient({ posts: { data: [...], error: null } }),
 *   }));
 */
export function createMockSupabaseClient(tableResults: Record<string, MockResult> = {}) {
  return {
    from: vi.fn((table: string) => chainable(tableResults[table] ?? { data: [], error: null })),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "test-user-id", email: "test@example.com" } }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  };
}
