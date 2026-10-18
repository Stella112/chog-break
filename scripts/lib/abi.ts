import { parseAbi } from 'viem';

// Standard ERC-721 / ERC-20 read functions (EIP-721, EIP-20). Presence is checked by verify-chain.ts.
export const erc721Abi = parseAbi([
  'function ownerOf(uint256) view returns (address)',
  'function tokenURI(uint256) view returns (string)',
  'function balanceOf(address) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
]);
export const erc20Abi = parseAbi([
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
]);
