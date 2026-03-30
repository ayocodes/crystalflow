import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { anvil } from "./config.js";

export function getAccount() {
  const key = process.env.PRIVATE_KEY;
  if (!key) {
    throw new Error("PRIVATE_KEY env var is required");
  }
  return privateKeyToAccount(key.startsWith("0x") ? (key as `0x${string}`) : (`0x${key}` as `0x${string}`));
}

export function getPublicClient() {
  return createPublicClient({
    chain: anvil,
    transport: http(),
  });
}

export function getWalletClient() {
  const account = getAccount();
  return createWalletClient({
    account,
    chain: anvil,
    transport: http(),
  });
}
