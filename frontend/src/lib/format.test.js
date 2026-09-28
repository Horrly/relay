import { describe, expect, it } from "vitest";
import { avatarColor, dayLabel, startsNewGroup, typingText } from "./format";
import { firstErrorMessage } from "./api";

const msg = (author, created_at) => ({ author, created_at });

describe("startsNewGroup", () => {
  it("starts a group for the first message", () => {
    expect(startsNewGroup(undefined, msg("alice", "2026-01-01T10:00:00Z"))).toBe(true);
  });

  it("groups same author within 5 minutes", () => {
    expect(startsNewGroup(msg("alice", "2026-01-01T10:00:00Z"), msg("alice", "2026-01-01T10:04:00Z"))).toBe(false);
  });

  it("splits on a different author", () => {
    expect(startsNewGroup(msg("alice", "2026-01-01T10:00:00Z"), msg("bob", "2026-01-01T10:00:10Z"))).toBe(true);
  });

  it("splits after a long gap", () => {
    expect(startsNewGroup(msg("alice", "2026-01-01T10:00:00Z"), msg("alice", "2026-01-01T10:06:00Z"))).toBe(true);
  });
});

describe("dayLabel", () => {
  const now = new Date(2026, 8, 27, 12, 0);
  it("labels today and yesterday", () => {
    expect(dayLabel(new Date(2026, 8, 27, 8, 0).toISOString(), now)).toBe("Today");
    expect(dayLabel(new Date(2026, 8, 26, 23, 0).toISOString(), now)).toBe("Yesterday");
  });
});

describe("typingText", () => {
  it("handles 0, 1, 2 and many typers", () => {
    expect(typingText([])).toBe("");
    expect(typingText(["alice"])).toBe("alice is typing…");
    expect(typingText(["alice", "bob"])).toBe("alice and bob are typing…");
    expect(typingText(["a", "b", "c"])).toBe("Several people are typing…");
  });
});

describe("avatarColor", () => {
  it("is stable for the same name", () => {
    expect(avatarColor("toheeb")).toBe(avatarColor("toheeb"));
  });
});

describe("firstErrorMessage", () => {
  it("reads DRF error shapes", () => {
    expect(firstErrorMessage({ detail: "No active account" })).toBe("No active account");
    expect(firstErrorMessage({ password: ["Too short."] })).toBe("password: Too short.");
    expect(firstErrorMessage({ non_field_errors: ["Nope."] })).toBe("Nope.");
    expect(firstErrorMessage(null)).toBe(null);
  });
});
