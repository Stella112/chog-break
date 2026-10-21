// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title CHOG//BREAK Recorded Splice registry (v2)
/// @notice Records a splice of two Chog Genesis tokens on Monad. The caller pays the $CHOG fee, which is split
/// between the CURRENT on-chain owners of both parent tokens, a prize-pool address and the dead address.
/// The first valid recording of a pair earns permanent first-discoverer credit.
/// v2 adds recordSpliceFor: the caller pays, a named player gets the credit (sponsored, gasless for the player).
/// @dev Small on purpose (spec §D10): no fighting, art, physics, trait mappings or randomness on-chain.
/// No upgradeability, no delegatecall, no selfdestruct, no token rescue.
contract ChogBreakRegistry is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC721 public immutable CHOG_GENESIS;
    IERC20 public immutable CHOG_TOKEN;
    uint256 public immutable MAX_FEE;

    uint16 public constant OWNER_BPS = 3500; // each parent owner
    uint16 public constant PRIZE_BPS = 2000; // informational: the prize gets the remainder (no dust lost)
    uint16 public constant BURN_BPS = 1000; // sent to the dead address (disclosed; not a burn() call)
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    uint256 public fee;
    address public prizeRecipient;

    mapping(bytes32 => address) public firstDiscoverer;
    mapping(bytes32 => uint64) public firstDiscoveryTime;
    mapping(bytes32 => uint256) public pairSpliceCount;
    mapping(uint256 => uint256) public tokenUsageCount;
    mapping(uint256 => uint256) public tokenEarned;

    event PairDiscovered(bytes32 indexed pairKey, uint256 indexed lo, uint256 indexed hi, address discoverer);
    /// @param splicer the player credited with this recording (the discoverer if `first`)
    /// @param payer who paid the fee and gas (equals `splicer` unless sponsored)
    event SpliceRecorded(
        address indexed splicer,
        address indexed payer,
        uint256 lo,
        uint256 hi,
        bytes32 indexed pairKey,
        address ownerLo,
        address ownerHi,
        uint256 fee,
        uint256 shareLo,
        uint256 shareHi,
        uint256 prize,
        uint256 burned,
        bool first
    );
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event PrizeRecipientUpdated(address oldRecipient, address newRecipient);

    error SameToken();
    error FeeTooHigh(uint256 fee, uint256 maxFee);
    error ZeroAddress();

    constructor(
        IERC721 chogGenesis,
        IERC20 chogToken,
        uint256 maxFee,
        uint256 initialFee,
        address initialPrizeRecipient,
        address initialOwner
    ) Ownable(initialOwner) {
        if (address(chogGenesis) == address(0) || address(chogToken) == address(0)) {
            revert ZeroAddress();
        }
        if (initialPrizeRecipient == address(0)) revert ZeroAddress();
        if (initialFee > maxFee) revert FeeTooHigh(initialFee, maxFee);
        CHOG_GENESIS = chogGenesis;
        CHOG_TOKEN = chogToken;
        MAX_FEE = maxFee;
        fee = initialFee;
        prizeRecipient = initialPrizeRecipient;
        emit FeeUpdated(0, initialFee);
        emit PrizeRecipientUpdated(address(0), initialPrizeRecipient);
    }

    /// @notice Same value the app computes: keccak256(abi.encode(CHOG_GENESIS, lo, hi)), order-independent.
    function pairKeyOf(uint256 a, uint256 b) public view returns (bytes32) {
        (uint256 lo, uint256 hi) = a < b ? (a, b) : (b, a);
        return keccak256(abi.encode(address(CHOG_GENESIS), lo, hi));
    }

    /// @notice Record a splice of tokens `a` and `b`. Pulls `fee` $CHOG from the caller (exact approval needed).
    /// @dev Owners are resolved on-chain with ownerOf (reverts for tokens that don't exist), never from input.
    function recordSplice(uint256 a, uint256 b) external nonReentrant whenNotPaused returns (bool first) {
        return _record(msg.sender, a, b);
    }

    /// @notice Sponsored recording: the caller pays the fee (and gas); `player` is credited as the splicer and,
    /// if this is the pair's first recording, its first discoverer. Paying to credit someone else gives the
    /// caller nothing, so this needs no access control.
    function recordSpliceFor(address player, uint256 a, uint256 b)
        external
        nonReentrant
        whenNotPaused
        returns (bool first)
    {
        if (player == address(0)) revert ZeroAddress();
        return _record(player, a, b);
    }

    function _record(address player, uint256 a, uint256 b) private returns (bool first) {
        if (a == b) revert SameToken();
        (uint256 lo, uint256 hi) = a < b ? (a, b) : (b, a);
        address ownerLo = CHOG_GENESIS.ownerOf(lo);
        address ownerHi = CHOG_GENESIS.ownerOf(hi);
        bytes32 pairKey = keccak256(abi.encode(address(CHOG_GENESIS), lo, hi));
        Split memory s = _split(fee);

        // effects
        first = firstDiscoverer[pairKey] == address(0);
        if (first) {
            firstDiscoverer[pairKey] = player;
            // forge-lint: disable-next-line(unsafe-typecast)
            firstDiscoveryTime[pairKey] = uint64(block.timestamp); // safe until the year 584,942,417,355
            emit PairDiscovered(pairKey, lo, hi, player);
        }
        pairSpliceCount[pairKey]++;
        tokenUsageCount[lo]++;
        tokenUsageCount[hi]++;
        tokenEarned[lo] += s.shareLo;
        tokenEarned[hi] += s.shareHi;

        // interactions (skip zero amounts)
        _pull(ownerLo, s.shareLo);
        _pull(ownerHi, s.shareHi);
        _pull(prizeRecipient, s.prize);
        _pull(DEAD, s.burned);

        _emitRecorded(player, lo, hi, pairKey, ownerLo, ownerHi, s, first);
    }

    /// @dev Separate frame for the 12-field event (avoids "stack too deep" without via-IR).
    function _emitRecorded(
        address player,
        uint256 lo,
        uint256 hi,
        bytes32 pairKey,
        address ownerLo,
        address ownerHi,
        Split memory s,
        bool first
    ) private {
        emit SpliceRecorded(
            player, msg.sender, lo, hi, pairKey, ownerLo, ownerHi, s.fee, s.shareLo, s.shareHi, s.prize, s.burned, first
        );
    }

    struct Split {
        uint256 fee;
        uint256 shareLo;
        uint256 shareHi;
        uint256 prize;
        uint256 burned;
    }

    /// @notice How a fee is split: 35% / 35% to the parent owners, 10% to the dead address, the rest to the prize.
    function _split(uint256 f) internal pure returns (Split memory s) {
        s.fee = f;
        s.shareLo = (f * OWNER_BPS) / 10_000;
        s.shareHi = s.shareLo;
        s.burned = (f * BURN_BPS) / 10_000;
        s.prize = f - s.shareLo - s.shareHi - s.burned; // remainder → no dust lost
    }

    function _pull(address to, uint256 amount) private {
        if (amount > 0) CHOG_TOKEN.safeTransferFrom(msg.sender, to, amount);
    }

    function setFee(uint256 newFee) external onlyOwner {
        if (newFee > MAX_FEE) revert FeeTooHigh(newFee, MAX_FEE);
        emit FeeUpdated(fee, newFee);
        fee = newFee;
    }

    function setPrizeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        emit PrizeRecipientUpdated(prizeRecipient, newRecipient);
        prizeRecipient = newRecipient;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
