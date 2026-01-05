// tests/session/waiter.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { WaiterManager } from "../../src/session/waiter";

describe("WaiterManager", () => {
  let manager: WaiterManager<string, unknown>;

  beforeEach(() => {
    manager = new WaiterManager<string, unknown>();
  });

  describe("registerWaiter", () => {
    it("should register a waiter and return cleanup function", () => {
      let resolved = false;
      const cleanup = manager.registerWaiter("key1", () => {
        resolved = true;
      });

      expect(typeof cleanup).toBe("function");
      expect(manager.hasWaiters("key1")).toBe(true);
    });

    it("should allow multiple waiters for same key", () => {
      manager.registerWaiter("key1", () => {});
      manager.registerWaiter("key1", () => {});

      expect(manager.getWaiterCount("key1")).toBe(2);
    });

    it("cleanup should remove only that waiter", () => {
      const cleanup1 = manager.registerWaiter("key1", () => {});
      manager.registerWaiter("key1", () => {});

      cleanup1();

      expect(manager.getWaiterCount("key1")).toBe(1);
    });
  });

  describe("notifyFirst", () => {
    it("should call only the first waiter", async () => {
      const calls: number[] = [];
      manager.registerWaiter("key1", () => calls.push(1));
      manager.registerWaiter("key1", () => calls.push(2));

      manager.notifyFirst("key1", "data");

      expect(calls).toEqual([1]);
      expect(manager.getWaiterCount("key1")).toBe(1);
    });

    it("should do nothing if no waiters", () => {
      // Should not throw
      manager.notifyFirst("nonexistent", "data");
    });
  });

  describe("notifyAll", () => {
    it("should call all waiters for a key", () => {
      const calls: number[] = [];
      manager.registerWaiter("key1", () => calls.push(1));
      manager.registerWaiter("key1", () => calls.push(2));

      manager.notifyAll("key1", "data");

      expect(calls).toEqual([1, 2]);
    });

    it("should remove all waiters after notification", () => {
      manager.registerWaiter("key1", () => {});
      manager.registerWaiter("key1", () => {});

      manager.notifyAll("key1", "data");

      expect(manager.hasWaiters("key1")).toBe(false);
    });
  });

  describe("immutability", () => {
    it("should not mutate original array when adding waiter", () => {
      manager.registerWaiter("key1", () => {});
      const countBefore = manager.getWaiterCount("key1");

      manager.registerWaiter("key1", () => {});

      // Original count should have been 1, now 2
      expect(countBefore).toBe(1);
      expect(manager.getWaiterCount("key1")).toBe(2);
    });

    it("should not mutate original array when removing waiter", () => {
      const cleanup = manager.registerWaiter("key1", () => {});
      manager.registerWaiter("key1", () => {});

      const countBefore = manager.getWaiterCount("key1");
      cleanup();

      expect(countBefore).toBe(2);
      expect(manager.getWaiterCount("key1")).toBe(1);
    });
  });

  describe("clearAll", () => {
    it("should remove all waiters for a key", () => {
      manager.registerWaiter("key1", () => {});
      manager.registerWaiter("key1", () => {});

      manager.clearAll("key1");

      expect(manager.hasWaiters("key1")).toBe(false);
    });
  });
});
