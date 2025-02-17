// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

interface IVault {
    error InvalidSubjectToken();
    error InvalidToken();
    error InvalidAmount();
    error InvalidToAddress();
    error InvalidReserveBalance();
    error InvalidOwner();

    event VaultTransfer(
        address indexed subject,
        address indexed token,
        address indexed to,
        uint256 amount,
        uint256 totalReserve
    );
    event VaultDeposit(
        address indexed subject,
        address indexed token,
        address indexed sender,
        uint256 amount,
        uint256 totalReserve
    );

    function balanceOf(
        address _subject,
        address _token
    ) external view returns (uint256 balance_);

    function deposit(address _subject, address _token, uint256 _value) external;

    function transfer(
        address _subject,
        address _token,
        address _to,
        uint256 _value
    ) external;
}
