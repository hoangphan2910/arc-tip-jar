// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract TipJarV2 {
    IERC20 public usdc;

    event TipSent(address indexed from, address indexed to, uint256 amount, string message);

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function tip(address to, uint256 amount, string calldata message) external {
        require(amount > 0, "Amount must be greater than 0");
        require(to != address(0), "Invalid recipient");
        require(usdc.transferFrom(msg.sender, to, amount), "Transfer failed");
        emit TipSent(msg.sender, to, amount, message);
    }
}