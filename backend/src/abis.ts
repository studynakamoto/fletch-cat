import type { Abi } from "viem";

export const launchpadFactoryAbi = [
  {
    type: "event",
    name: "TokenCreated",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "curve", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
      { name: "index", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "getToken",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "token", type: "address" },
          { name: "curve", type: "address" },
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "description", type: "string" },
          { name: "image", type: "string" },
          { name: "twitter", type: "string" },
          { name: "telegram", type: "string" },
          { name: "website", type: "string" },
          { name: "creator", type: "address" },
          { name: "createdAt", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "tokenCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "saleSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalSupply_",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const satisfies Abi;

export const bondingCurveAbi = [
  {
    type: "event",
    name: "Buy",
    inputs: [
      { name: "buyer", type: "address", indexed: true },
      { name: "ethIn", type: "uint256", indexed: false },
      { name: "tokensOut", type: "uint256", indexed: false },
      { name: "newTokensSold", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Sell",
    inputs: [
      { name: "seller", type: "address", indexed: true },
      { name: "tokensIn", type: "uint256", indexed: false },
      { name: "ethOut", type: "uint256", indexed: false },
      { name: "newTokensSold", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Graduated",
    inputs: [
      { name: "pair", type: "address", indexed: true },
      { name: "ethLiquidity", type: "uint256", indexed: false },
      { name: "tokenLiquidity", type: "uint256", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "currentPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "tokensSold",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "saleSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "graduated",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "token",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const satisfies Abi;

export const pumpSwapPairAbi = [
  {
    type: "event",
    name: "Swap",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "ethIn", type: "bool", indexed: false },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "amountOut", type: "uint256", indexed: false },
      { name: "to", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Sync",
    inputs: [
      { name: "reserveETH", type: "uint112", indexed: false },
      { name: "reserveToken", type: "uint112", indexed: false },
    ],
  },
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "_reserveETH", type: "uint112" },
      { name: "_reserveToken", type: "uint112" },
    ],
  },
  {
    type: "function",
    name: "token",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const satisfies Abi;

export const pumpSwapFactoryAbi = [
  {
    type: "event",
    name: "PairCreated",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "pair", type: "address", indexed: false },
      { name: "index", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "getPair",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const satisfies Abi;

export const erc20Abi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const satisfies Abi;
