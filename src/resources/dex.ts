import type { HttpClient } from "../http.js";
import type { Chain, Loose } from "../types.js";

/** A single token balance in a wallet portfolio. */
export interface WalletToken {
  /** ERC-20 contract address; omitted for the chain's native coin. */
  contract_address?: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
  /** Integer balance in base units (wei), as a decimal string. */
  raw_balance: string;
  /** Human-readable balance, scaled by `decimals`. */
  balance: string;
  /** True for the chain's native coin (ETH/BNB/MATIC/…). */
  native?: boolean;
}

/** A wallet's token holdings on a chain. */
export interface WalletPortfolio {
  chain: string;
  address: string;
  tokens: WalletToken[];
  count: number;
  /** Query time, Unix epoch seconds. */
  updated_at: number;
}

/** `/v1/fnd/dex/*` — on-chain wallet portfolios across EVM chains. */
export class DexResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Token holdings for a wallet on a chain.
   * `wallet("eth", "0x…")`. `GET /v1/fnd/dex/wallet/:chain/:address`.
   */
  wallet(chain: Loose<Chain>, address: string): Promise<WalletPortfolio> {
    return this.http.get(
      `/v1/fnd/dex/wallet/${encodeURIComponent(chain)}/${encodeURIComponent(address)}`,
    );
  }
}
