import { describe, expect, it } from "vitest";
import {
  generateId,
  generateApiKey,
  hashApiKey,
  generateClaimToken,
  getKeyPrefix,
} from "./crypto";

describe("Crypto Utilities", () => {
  describe("generateId", () => {
    it("should generate a valid UUID", () => {
      const id = generateId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("should generate unique IDs", () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("generateApiKey", () => {
    it("should generate key with sk-gw- prefix", () => {
      const key = generateApiKey();
      expect(key.startsWith("sk-gw-")).toBe(true);
    });

    it("should generate keys of sufficient length", () => {
      const key = generateApiKey();
      expect(key.length).toBeGreaterThan(40);
    });

    it("should generate unique keys", () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe("hashApiKey", () => {
    it("should return a 64-character hex string", async () => {
      const hash = await hashApiKey("test-key");
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should produce consistent hashes", async () => {
      const hash1 = await hashApiKey("same-key");
      const hash2 = await hashApiKey("same-key");
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different keys", async () => {
      const hash1 = await hashApiKey("key-1");
      const hash2 = await hashApiKey("key-2");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("generateClaimToken", () => {
    it("should generate a 16-character token", () => {
      const token = generateClaimToken();
      expect(token.length).toBe(16);
    });

    it("should be URL-safe", () => {
      const token = generateClaimToken();
      expect(token).not.toMatch(/[+/=]/);
    });

    it("should generate unique tokens", () => {
      const token1 = generateClaimToken();
      const token2 = generateClaimToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe("getKeyPrefix", () => {
    it("should return first 12 characters plus ellipsis", () => {
      const key = "sk-gw-abcdefghijklmnop";
      const prefix = getKeyPrefix(key);
      expect(prefix).toBe("sk-gw-abcdef...");
    });
  });
});
