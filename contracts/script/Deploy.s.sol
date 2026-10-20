// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ChogBreakRegistry} from "../src/ChogBreakRegistry.sol";

/// Deploys ChogBreakRegistry to Monad mainnet. Read docs/DEPLOY.md first.
/// Everything is printed BEFORE anything is sent; the script aborts unless CONFIRM_MAINNET_DEPLOY=YES
/// and the RPC reports chain 143. Sign with your own keystore: --account <name> (never a raw key in a file).
contract Deploy is Script {
    uint256 constant MONAD_CHAIN_ID = 143;

    function run() external returns (ChogBreakRegistry reg) {
        address nft = vm.envAddress("CHOG_NFT_ADDRESS");
        address token = vm.envAddress("CHOG_TOKEN_ADDRESS");
        uint256 fee = vm.envUint("LAB_FEE"); // raw units (wei of $CHOG)
        uint256 maxFee = vm.envUint("MAX_FEE"); // raw units
        address prize = vm.envAddress("PRIZE_POOL_RECIPIENT");
        address owner = vm.envAddress("OWNER");
        string memory confirm = vm.envOr("CONFIRM_MAINNET_DEPLOY", string(""));

        uint8 decimals = IERC20Metadata(token).decimals();
        address deployer = msg.sender;

        console2.log("==== CHOG//BREAK registry deployment: CHECK EVERY LINE ====");
        console2.log("chain id              ", block.chainid);
        console2.log("deployer              ", deployer);
        console2.log("deployer MON (wei)    ", deployer.balance);
        console2.log("CHOG Genesis (NFT)    ", nft);
        console2.log("$CHOG token           ", token);
        console2.log("$CHOG decimals        ", decimals);
        console2.log("fee (raw)             ", fee);
        console2.log("fee ($CHOG)           ", _human(fee, decimals));
        console2.log("max fee (raw)         ", maxFee);
        console2.log("max fee ($CHOG)       ", _human(maxFee, decimals));
        console2.log("prize pool recipient  ", prize);
        console2.log("owner                 ", owner);
        console2.log("split: 35% owner of #lo, 35% owner of #hi, 20% prize pool, 10% to 0x...dEaD");
        console2.log("==========================================================");

        require(block.chainid == MONAD_CHAIN_ID, "ABORT: RPC is not Monad mainnet (chain 143)");
        require(
            keccak256(bytes(confirm)) == keccak256(bytes("YES")),
            "ABORT: set CONFIRM_MAINNET_DEPLOY=YES after checking every line above"
        );
        require(nft.code.length > 0 && token.code.length > 0, "ABORT: NFT or token address has no code");
        require(fee <= maxFee, "ABORT: fee above max fee");
        IERC721(nft).ownerOf(1); // sanity: the NFT answers ownerOf for token 1

        vm.startBroadcast();
        reg = new ChogBreakRegistry(IERC721(nft), IERC20Metadata(token), maxFee, fee, prize, owner);
        vm.stopBroadcast();
        console2.log("ChogBreakRegistry deployed at", address(reg));
    }

    /// "123.45" style string with up to 4 decimals (display only).
    function _human(uint256 raw, uint8 decimals) internal pure returns (string memory) {
        uint256 unit = 10 ** decimals;
        uint256 whole = raw / unit;
        uint256 frac = ((raw % unit) * 10_000) / unit;
        string memory f = vm.toString(frac);
        while (bytes(f).length < 4) f = string.concat("0", f);
        return string.concat(vm.toString(whole), ".", f);
    }
}
