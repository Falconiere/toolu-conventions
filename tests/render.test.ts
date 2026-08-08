import { describe, expect, test } from "bun:test";
import { ReservedPlaceholderError, renderTemplate } from "../src/render";

describe("renderTemplate", () => {
  test("rejects unknown reserved placeholders instead of emitting a partial scaffold", () => {
    expect(() =>
      renderTemplate("Hello {{TOOLU_DISPLAY_NAME}} / {{TOOLU_UNKNOWN}}", {
        TOOLU_DISPLAY_NAME: "Acme Console",
      }),
    ).toThrow(ReservedPlaceholderError);
    expect(() =>
      renderTemplate("Hello {{TOOLU_DISPLAY_NAME}} / {{TOOLU_UNKNOWN}}", {
        TOOLU_DISPLAY_NAME: "Acme Console",
      }),
    ).toThrow("unknown reserved placeholder: TOOLU_UNKNOWN");
  });
});
