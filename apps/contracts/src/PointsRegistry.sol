// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PointsRegistry
 * @notice Global points tracking system for Vidrune platform
 * @dev Awards points for various platform activities (uploads, challenges, market wins)
 */
contract PointsRegistry {
    // State variables
    mapping(address => uint256) private points;

    address public videoRegistry;
    address public predictionMarket;
    address public convictionRegistry;
    address public owner;
    uint256 public totalBurned;

    // Events
    event PointsAwarded(address indexed user, uint256 amount, string reason);
    event ContractsSet(
        address videoRegistry,
        address predictionMarket,
        address convictionRegistry
    );
    event RewardsDistributed(address[] agents, uint256[] amounts);
    event PointsBurned(uint256 amount);

    // Errors
    error Unauthorized();
    error InvalidAddress();
    error LengthMismatch();

    constructor(address _owner) {
        owner = _owner;
    }

    function setContracts(
        address _videoRegistry,
        address _predictionMarket,
        address _convictionRegistry
    ) external {
        if (msg.sender != owner) revert Unauthorized();
        if (
            _videoRegistry == address(0) ||
            _predictionMarket == address(0) ||
            _convictionRegistry == address(0)
        ) {
            revert InvalidAddress();
        }

        videoRegistry = _videoRegistry;
        predictionMarket = _predictionMarket;
        convictionRegistry = _convictionRegistry;

        emit ContractsSet(_videoRegistry, _predictionMarket, _convictionRegistry);
    }

    function awardPoints(address user, uint256 amount) external {
        if (
            msg.sender != videoRegistry &&
            msg.sender != predictionMarket &&
            msg.sender != convictionRegistry
        ) {
            revert Unauthorized();
        }

        points[user] += amount;
        emit PointsAwarded(user, amount, "Platform activity");
    }

    function distributeRewards(address[] calldata agents, uint256[] calldata amounts) external {
        if (msg.sender != owner) revert Unauthorized();
        if (agents.length != amounts.length) revert LengthMismatch();

        for (uint256 i = 0; i < agents.length; i++) {
            points[agents[i]] += amounts[i];
        }

        emit RewardsDistributed(agents, amounts);
    }

    function burnPoints(uint256 amount) external {
        if (msg.sender != owner) revert Unauthorized();

        totalBurned += amount;

        emit PointsBurned(amount);
    }

    function getPoints(address user) external view returns (uint256) {
        return points[user];
    }

    function getTotalBurned() external view returns (uint256) {
        return totalBurned;
    }
}
