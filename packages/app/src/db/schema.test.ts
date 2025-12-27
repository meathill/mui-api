import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  apiKeys,
  claimTokens,
  models,
  usageLogs,
  users,
  wallets,
} from "./schema";

describe("Database Schema", () => {
  describe("users table", () => {
    it("should have correct table name", () => {
      expect(getTableName(users)).toBe("users");
    });

    it("should have required columns", () => {
      const columnNames = Object.keys(users);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("email");
      expect(columnNames).toContain("stripeCustomerId");
      expect(columnNames).toContain("createdAt");
    });
  });

  describe("wallets table", () => {
    it("should have correct table name", () => {
      expect(getTableName(wallets)).toBe("wallets");
    });

    it("should have required columns", () => {
      const columnNames = Object.keys(wallets);
      expect(columnNames).toContain("userId");
      expect(columnNames).toContain("balance");
      expect(columnNames).toContain("currency");
      expect(columnNames).toContain("updatedAt");
    });
  });

  describe("apiKeys table", () => {
    it("should have correct table name", () => {
      expect(getTableName(apiKeys)).toBe("api_keys");
    });

    it("should have required columns", () => {
      const columnNames = Object.keys(apiKeys);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("userId");
      expect(columnNames).toContain("keyPrefix");
      expect(columnNames).toContain("keyHash");
      expect(columnNames).toContain("isActive");
    });
  });

  describe("claimTokens table", () => {
    it("should have correct table name", () => {
      expect(getTableName(claimTokens)).toBe("claim_tokens");
    });

    it("should have required columns", () => {
      const columnNames = Object.keys(claimTokens);
      expect(columnNames).toContain("token");
      expect(columnNames).toContain("userId");
      expect(columnNames).toContain("tempRawKey");
      expect(columnNames).toContain("expiresAt");
      expect(columnNames).toContain("used");
    });
  });

  describe("models table", () => {
    it("should have correct table name", () => {
      expect(getTableName(models)).toBe("models");
    });

    it("should have required columns", () => {
      const columnNames = Object.keys(models);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("provider");
      expect(columnNames).toContain("upstreamModelId");
      expect(columnNames).toContain("inputPrice");
      expect(columnNames).toContain("outputPrice");
      expect(columnNames).toContain("markupRate");
    });
  });

  describe("usageLogs table", () => {
    it("should have correct table name", () => {
      expect(getTableName(usageLogs)).toBe("usage_logs");
    });

    it("should have required columns", () => {
      const columnNames = Object.keys(usageLogs);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("userId");
      expect(columnNames).toContain("apiKeyId");
      expect(columnNames).toContain("modelId");
      expect(columnNames).toContain("inputTokens");
      expect(columnNames).toContain("outputTokens");
      expect(columnNames).toContain("cost");
    });
  });
});
