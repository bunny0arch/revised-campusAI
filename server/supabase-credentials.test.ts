import { describe, expect, it } from "vitest";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

describe("Supabase browser authentication credentials", () => {
  it("can access the public authentication settings endpoint", async () => {
    expect(supabaseUrl).toBeTruthy();
    expect(supabaseAnonKey).toBeTruthy();

    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey! },
    });

    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toBeTypeOf("object");
  }, 15_000);
});
