import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");

// Regression tests for the session-forgery fix in widgetSessions.boot.
//
// A visitorId is a NON-SECRET identifier (surfaced in message payloads, the agent inbox,
// network traffic, and localStorage). boot() must therefore never mint a session bound to
// an arbitrary `existingVisitorId` unless the caller proves ownership with that visitor's
// current, valid session token.
describe("widgetSessions.boot — session-forgery protection", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("does NOT bind a session to an arbitrary existingVisitorId without a valid session token", async () => {
    const { workspaceId, victimId } = await t.run(async (ctx) => {
      const now = Date.now();
      const workspaceId = await ctx.db.insert("workspaces", { name: "Victim WS", createdAt: now });
      const victimId = await ctx.db.insert("visitors", {
        sessionId: "victim-session",
        workspaceId,
        firstSeenAt: now,
        lastSeenAt: now,
        createdAt: now,
      });
      return { workspaceId, victimId };
    });

    // Attacker knows the victim's (non-secret) visitorId but holds no session token for it.
    const result = await t.mutation(api.widgetSessions.boot, {
      workspaceId,
      sessionId: "attacker-session",
      existingVisitorId: victimId,
      origin: "https://attacker.example.com",
    });

    // The minted session must NOT be bound to the victim visitor.
    expect(result.visitor._id).not.toBe(victimId);

    // The victim record must be untouched — its sessionId must not be hijacked.
    const victim = await t.run((ctx) => ctx.db.get(victimId));
    expect(victim?.sessionId).toBe("victim-session");
  });

  it("DOES rebind to an existing visitor when a valid session token for it is presented", async () => {
    const { workspaceId, visitorId, token } = await t.run(async (ctx) => {
      const now = Date.now();
      const workspaceId = await ctx.db.insert("workspaces", { name: "Owner WS", createdAt: now });
      const visitorId = await ctx.db.insert("visitors", {
        sessionId: "original-session",
        workspaceId,
        firstSeenAt: now,
        lastSeenAt: now,
        createdAt: now,
      });
      const token = `wst_${"a".repeat(64)}`;
      await ctx.db.insert("widgetSessions", {
        token,
        visitorId,
        workspaceId,
        identityVerified: false,
        expiresAt: now + 60 * 60 * 1000,
        createdAt: now,
      });
      return { workspaceId, visitorId, token };
    });

    const result = await t.mutation(api.widgetSessions.boot, {
      workspaceId,
      sessionId: "fresh-session",
      existingVisitorId: visitorId,
      sessionToken: token,
      origin: "https://legit.example.com",
    });

    // With valid ownership proof, the session rebinds to the same visitor.
    expect(result.visitor._id).toBe(visitorId);
    const rebound = await t.run((ctx) => ctx.db.get(visitorId));
    expect(rebound?.sessionId).toBe("fresh-session");
  });

  it("does NOT rebind when the presented session token belongs to a DIFFERENT visitor", async () => {
    const { workspaceId, victimId, token } = await t.run(async (ctx) => {
      const now = Date.now();
      const workspaceId = await ctx.db.insert("workspaces", { name: "Mixed WS", createdAt: now });
      const victimId = await ctx.db.insert("visitors", {
        sessionId: "victim-session",
        workspaceId,
        firstSeenAt: now,
        lastSeenAt: now,
        createdAt: now,
      });
      const attackerVisitorId = await ctx.db.insert("visitors", {
        sessionId: "attacker-own-session",
        workspaceId,
        firstSeenAt: now,
        lastSeenAt: now,
        createdAt: now,
      });
      // Attacker holds a valid token — but for their OWN visitor, not the victim.
      const token = `wst_${"b".repeat(64)}`;
      await ctx.db.insert("widgetSessions", {
        token,
        visitorId: attackerVisitorId,
        workspaceId,
        identityVerified: false,
        expiresAt: now + 60 * 60 * 1000,
        createdAt: now,
      });
      return { workspaceId, victimId, token };
    });

    const result = await t.mutation(api.widgetSessions.boot, {
      workspaceId,
      sessionId: "attacker-session",
      existingVisitorId: victimId,
      sessionToken: token,
      origin: "https://attacker.example.com",
    });

    // A token for a different visitor must not authorize rebinding to the victim.
    expect(result.visitor._id).not.toBe(victimId);
    const victim = await t.run((ctx) => ctx.db.get(victimId));
    expect(victim?.sessionId).toBe("victim-session");
  });
});
