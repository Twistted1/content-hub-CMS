import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { createMockSupabaseClient } from "@/test/mockSupabase";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const templateRow = {
  id: "tpl-1",
  name: "Launch Announcement",
  description: "A template",
  category: "Marketing",
  platforms: ["twitter", "linkedin"],
  content: "Hello {{name}}",
  uses: 3,
  is_favorite: false,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

let mockClient: ReturnType<typeof createMockSupabaseClient>;

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() {
    return mockClient;
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useTemplates", () => {
  beforeEach(() => {
    mockClient = createMockSupabaseClient({
      templates: { data: [templateRow], error: null },
    });
  });

  it("loads and maps templates from snake_case DB rows to the camelCase Template shape", async () => {
    const { useTemplates } = await import("./useTemplates");
    const { result } = renderHook(() => useTemplates(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.templates).toEqual([
      {
        id: "tpl-1",
        name: "Launch Announcement",
        description: "A template",
        category: "Marketing",
        platforms: ["twitter", "linkedin"],
        uses: 3,
        isFavorite: false,
        createdAt: "2026-07-01T00:00:00.000Z",
        content: "Hello {{name}}",
      },
    ]);
  });

  it("defaults platforms/content when the DB row has them null", async () => {
    mockClient = createMockSupabaseClient({
      templates: { data: [{ ...templateRow, platforms: null, content: null }], error: null },
    });
    const { useTemplates } = await import("./useTemplates");
    const { result } = renderHook(() => useTemplates(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.templates[0].platforms).toEqual([]);
    expect(result.current.templates[0].content).toBe("");
  });

  it("calls supabase.from('templates').insert(...) when adding a template", async () => {
    const { useTemplates } = await import("./useTemplates");
    const { result } = renderHook(() => useTemplates(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.addTemplate.mutate({
        name: "New Template",
        description: "desc",
        category: "Content",
        platforms: ["instagram"],
      });
    });

    await waitFor(() => expect(result.current.addTemplate.isSuccess).toBe(true));
    expect(mockClient.from).toHaveBeenCalledWith("templates");
  });

  it("surfaces a query error instead of throwing", async () => {
    mockClient = createMockSupabaseClient({
      templates: { data: null, error: { message: "permission denied" } },
    });
    const { useTemplates } = await import("./useTemplates");
    const { result } = renderHook(() => useTemplates(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.templates).toEqual([]);
  });
});
