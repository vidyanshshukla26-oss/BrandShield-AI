import { describe, expect, it } from "vitest";
import { hasRole } from "../../lib/auth";

describe("server permission boundaries", () => {
  it("does not grant approval permissions to creators", () => {
    expect(hasRole("creator", ["owner", "brand_manager", "reviewer"])).toBe(false);
    expect(hasRole("reviewer", ["owner", "brand_manager", "reviewer"])).toBe(true);
  });
});
