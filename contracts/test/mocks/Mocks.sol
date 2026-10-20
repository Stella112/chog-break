// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Test-only mocks. Never deployed to a real network.

contract MockChogs is ERC721("Mock Chog Genesis", "MCHOG") {
    function mint(address to, uint256 id) external {
        _mint(to, id);
    }
}

contract MockChogToken is ERC20("Mock CHOG", "MCHOG") {
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

interface IRecord {
    function recordSplice(uint256 a, uint256 b) external returns (bool);
}

/// A malicious ERC-20 that tries to re-enter the registry from inside transferFrom.
contract ReentrantToken is ERC20("Evil", "EVIL") {
    IRecord public target;
    bool public attacked;

    function setTarget(IRecord t) external {
        target = t;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (!attacked && address(target) != address(0)) {
            attacked = true;
            target.recordSplice(1, 2); // must revert (nonReentrant)
        }
        return super.transferFrom(from, to, value);
    }
}
