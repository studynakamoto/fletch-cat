// Hand-written ABIs for the functions/events the UI uses.
// These match the Solidity in ../contracts/src.

export const launchpadFactoryAbi = [
  {
    type: "function",
    name: "createToken",
    stateMutability: "payable",
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "description", type: "string" },
      { name: "image", type: "string" },
      { name: "twitter", type: "string" },
      { name: "telegram", type: "string" },
      { name: "website", type: "string" },
    ],
    outputs: [
      { name: "tokenAddr", type: "address" },
      { name: "curveAddr", type: "address" },
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
    name: "getTokens",
    stateMutability: "view",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      {
        name: "page",
        type: "tuple[]",
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
] as const;

export const bondingCurveAbi = [
  {
    type: "function",
    name: "buy",
    stateMutability: "payable",
    inputs: [
      { name: "minTokensOut", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "tokensOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "sell",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokensIn", type: "uint256" },
      { name: "minEthOut", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "ethOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "getBuyQuote",
    stateMutability: "view",
    inputs: [{ name: "ethIn", type: "uint256" }],
    outputs: [
      { name: "tokensOut", type: "uint256" },
      { name: "ethUsed", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getSellQuote",
    stateMutability: "view",
    inputs: [{ name: "tokensIn", type: "uint256" }],
    outputs: [{ name: "ethOut", type: "uint256" }],
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
    name: "graduationEth",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "ethReserve",
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
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
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
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export const pumpSwapFactoryAbi = [
  {
    type: "function",
    name: "getPair",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const pumpSwapPairAbi = [
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
    name: "getAmountOut",
    stateMutability: "pure",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "reserveIn", type: "uint256" },
      { name: "reserveOut", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "swapExactETHForTokens",
    stateMutability: "payable",
    inputs: [
      { name: "amountOutMin", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "swapExactTokensForETH",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;
