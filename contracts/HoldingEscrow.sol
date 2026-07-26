// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IUSDC {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract HoldingEscrow {
    address public owner;
    address public agent;
    IUSDC public usdc;

    struct Holding {
        address user;
        address recipient;
        uint256 amount;
        uint256 unlockTime;
        bool executed;
        string action; // "send", "swap", "bridge"
        bytes extraData;
    }

    uint256 public holdingCount;
    mapping(uint256 => Holding) public holdings;
    mapping(address => uint256[]) public userHold