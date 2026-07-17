import { describe, it, expect } from "vitest";
import { dateKey, formatDateLabel } from "../src/dateUtils.js";

describe("dateKey", () => {
  it("formats a date as YYYY-MM-DD with zero padding", () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("pads single-digit months and days", () => {
    expect(dateKey(new Date(2026, 8, 9))).toBe("2026-09-09");
  });
});

describe("formatDateLabel", () => {
  it("formats a date with the Japanese weekday", () => {
    // 2026-07-17 は金曜日
    expect(formatDateLabel(new Date(2026, 6, 17))).toBe("7月17日(金)");
  });
});
