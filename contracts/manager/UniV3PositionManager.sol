// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/TickMath.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "../interfaces/INonfungiblePositionManager.sol";

contract UniV3PositionManager {
    using TickMath for int24;

    struct PositionParams {
        int24 currentTick;
        int24 tickSpacing;
        int24 tickLower;
        int24 tickUpper;
        uint160 sqrtPriceLowerX96;
        uint160 sqrtPriceUpperX96;
    }

    INonfungiblePositionManager public immutable nonfungiblePositionManager;

    uint256 constant Q96 = 2**96;

    event PositionCreated(
        uint256 indexed tokenId,
        address indexed owner,
        address token0,
        address token1,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0,
        uint256 amount1
    );

    constructor(address _nonfungiblePositionManager) {
        nonfungiblePositionManager = INonfungiblePositionManager(_nonfungiblePositionManager);
    }

    function getTickFromWidth(
        int24 currentTick,
        uint256 targetWidth,
        bool isUpper
    ) internal pure returns (int24) {

        int24 tickDelta;
        if (targetWidth <= 500) { // до 5%
            tickDelta = int24(int256((targetWidth * 487) / 500));
        } else if (targetWidth <= 1000) { // до 10%
            tickDelta = int24(int256((targetWidth * 956) / 1000));
        } else if (targetWidth <= 2000) { // до 20%
            tickDelta = int24(int256((targetWidth * 1825) / 2000));
        } else { // более 20%
            tickDelta = int24(int256((targetWidth * 1825) / 2000)); // используем ту же пропорцию
        }

        return isUpper ? currentTick + tickDelta : currentTick - tickDelta;
    }

    function calculatePositionParams(
        IUniswapV3Pool uniPool,
        uint256 widthBps
    ) internal view returns (PositionParams memory params) {
        (, params.currentTick,,,,,) = uniPool.slot0();
        params.tickSpacing = uniPool.tickSpacing();

        int24 rawTickLower = getTickFromWidth(params.currentTick, widthBps, false);
        int24 rawTickUpper = getTickFromWidth(params.currentTick, widthBps, true);

        params.tickLower = (rawTickLower / params.tickSpacing) * params.tickSpacing;
        params.tickUpper = (rawTickUpper / params.tickSpacing) * params.tickSpacing;

        params.sqrtPriceLowerX96 = TickMath.getSqrtRatioAtTick(params.tickLower);
        params.sqrtPriceUpperX96 = TickMath.getSqrtRatioAtTick(params.tickUpper);

        return params;
    }

    function validateWidth(
        uint160 sqrtPriceLowerX96,
        uint160 sqrtPriceUpperX96,
        uint256 widthBps
    ) internal pure returns (uint256) {
        uint256 lowerPrice = uint256(sqrtPriceLowerX96) * uint256(sqrtPriceLowerX96) / Q96;
        uint256 upperPrice = uint256(sqrtPriceUpperX96) * uint256(sqrtPriceUpperX96) / Q96;

        uint256 actualWidth = (upperPrice - lowerPrice) * 10000 / (upperPrice + lowerPrice);
        require(actualWidth >= widthBps * 95 / 100 && actualWidth <= widthBps * 105 / 100, "Width out of range");

        return actualWidth;
    }

    function createPosition(
        address pool,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 widthBps
    ) external returns (uint256) {
        require(widthBps > 0 && widthBps <= 10000, "Invalid width");

        IUniswapV3Pool uniPool = IUniswapV3Pool(pool);
        address token0 = uniPool.token0();
        address token1 = uniPool.token1();
        uint24 fee = uniPool.fee();

        PositionParams memory params = calculatePositionParams(uniPool, widthBps);
        uint256 actualWidth = validateWidth(params.sqrtPriceLowerX96, params.sqrtPriceUpperX96, widthBps);

        emit Debug(
            params.currentTick,
            params.tickLower,
            params.tickUpper,
            params.tickLower,
            params.tickUpper,
            actualWidth,
            widthBps
        );

        _handleTokenTransfers(token0, token1, amount0Desired, amount1Desired);

        INonfungiblePositionManager.MintParams memory mintParams = INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            fee: fee,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            amount0Desired: amount0Desired,
            amount1Desired: amount1Desired,
            amount0Min: 0,
            amount1Min: 0,
            recipient: msg.sender,
            deadline: block.timestamp
        });

        (uint256 newTokenId,, uint256 mintedAmount0, uint256 mintedAmount1) =
                            nonfungiblePositionManager.mint(mintParams);

        emit PositionCreated(
            newTokenId,
            msg.sender,
            token0,
            token1,
            params.tickLower,
            params.tickUpper,
            mintedAmount0,
            mintedAmount1
        );

        return newTokenId;
    }

    function _handleTokenTransfers(
        address token0,
        address token1,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) internal {
        if (IERC20(token0).allowance(msg.sender, address(this)) < amount0Desired) {
            revert("Insufficient allowance for token0");
        }
        require(IERC20(token0).transferFrom(msg.sender, address(this), amount0Desired), "Transfer of token0 failed");

        if (IERC20(token1).allowance(msg.sender, address(this)) < amount1Desired) {
            revert("Insufficient allowance for token1");
        }
        require(IERC20(token1).transferFrom(msg.sender, address(this), amount1Desired), "Transfer of token1 failed");

        require(IERC20(token0).approve(address(nonfungiblePositionManager), amount0Desired), "Approval failed for token0");
        require(IERC20(token1).approve(address(nonfungiblePositionManager), amount1Desired), "Approval failed for token1");
    }

    event Debug(
        int24 currentTick,
        int24 rawTickLower,
        int24 rawTickUpper,
        int24 tickLower,
        int24 tickUpper,
        uint256 actualWidth,
        uint256 targetWidth
    );
}