const { BN } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");

const UniV3PositionManager = artifacts.require("UniV3PositionManager");
const IERC20 = artifacts.require("@openzeppelin/contracts/token/ERC20/IERC20.sol");
const IUniswapV3Pool = artifacts.require("@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol");
const INonfungiblePositionManager = artifacts.require("INonfungiblePositionManager");
const TickMath = artifacts.require("TickMath");

const POSITION_MANAGER_ADDRESS = '0x1238536071E1c677A632429e3655c799b22cDA52';
const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const WETH = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
const USDC_WETH_POOL = '0x3289680dD4d6C10bb19b899729cda5eEF58AEfF1';

// Константы для тестов
const TEST_AMOUNT_USDC = "1";    // 20 USDC
const TEST_AMOUNT_WETH = "0.001";  // 0.001 WETH
const TEST_WIDTH = 500;           // 5%
const TEST_WIDTH_BN = new BN('500');  // 5%

function toWei(n) {
    return new BN(web3.utils.toWei(n, "ether"));
}

function toUSDC(n) {
    return new BN(String(Math.floor(Number(n) * 1000000)));
}

async function checkAllowance(token, owner, spender) {
    const allowance = await token.allowance(owner, spender);
    console.log(`Current allowance: ${allowance.toString()}`);
    return allowance;
}

async function approveToken(token, spender, amount, owner) {
    const allowanceFact = await checkAllowance(token, owner, spender);
    if (allowanceFact.gte(amount)) {
        console.log(`Already approved, skipping...`);
        return;
    }

    console.log(`Approving token...`);
    const tx = await token.approve(spender, amount, { from: owner });
    console.log(`Approved, tx: ${tx.tx}`);
    const allowance = await checkAllowance(token, owner, spender);
    expect(allowance).to.be.bignumber.gte(amount);
}

function getSqrtRatioAtTick(tick) {
    const absTick = tick < 0 ? tick * -1 : tick;
    let ratio = (absTick & 0x1) != 0 ? '0xfffcb933bd6fad37aa2d162d1a594001' : '0x100000000000000000000000000000000';
    if ((absTick & 0x2) != 0) ratio = (BigInt(ratio) * BigInt('0xfff97272373d413259a46990580e213a')) >> BigInt(128);
    if ((absTick & 0x4) != 0) ratio = (BigInt(ratio) * BigInt('0xfff2e50f5f656932ef12357cf3c7fdcc')) >> BigInt(128);
    if ((absTick & 0x8) != 0) ratio = (BigInt(ratio) * BigInt('0xffe5caca7e10e4e61c3624eaa0941cd0')) >> BigInt(128);
    if ((absTick & 0x10) != 0) ratio = (BigInt(ratio) * BigInt('0xffcb9843d60f6159c9db58835c926644')) >> BigInt(128);
    if ((absTick & 0x20) != 0) ratio = (BigInt(ratio) * BigInt('0xff973b41fa98c081472e6896dfb254c0')) >> BigInt(128);
    if ((absTick & 0x40) != 0) ratio = (BigInt(ratio) * BigInt('0xff2ea16466c96a3843ec78b326b52861')) >> BigInt(128);
    if ((absTick & 0x80) != 0) ratio = (BigInt(ratio) * BigInt('0xfe5dee046a99a2a811c461f1969c3053')) >> BigInt(128);
    if ((absTick & 0x100) != 0) ratio = (BigInt(ratio) * BigInt('0xfcbe86c7900a88aedcffc83b479aa3a4')) >> BigInt(128);
    if ((absTick & 0x200) != 0) ratio = (BigInt(ratio) * BigInt('0xf987a7253ac413176f2b074cf7815e54')) >> BigInt(128);
    if ((absTick & 0x400) != 0) ratio = (BigInt(ratio) * BigInt('0xf3392b0822b70005940c7a398e4b70f3')) >> BigInt(128);
    if ((absTick & 0x800) != 0) ratio = (BigInt(ratio) * BigInt('0xe7159475a2c29b7443b29c7fa6e889d9')) >> BigInt(128);
    if ((absTick & 0x1000) != 0) ratio = (BigInt(ratio) * BigInt('0xd097f3bdfd2022b8845ad8f792aa5825')) >> BigInt(128);
    if ((absTick & 0x2000) != 0) ratio = (BigInt(ratio) * BigInt('0xa9f746462d870fdf8a65dc1f90e061e5')) >> BigInt(128);
    if ((absTick & 0x4000) != 0) ratio = (BigInt(ratio) * BigInt('0x70d869a156d2a1b890bb3df62baf32f7')) >> BigInt(128);
    if ((absTick & 0x8000) != 0) ratio = (BigInt(ratio) * BigInt('0x31be135f97d08fd981231505542fcfa6')) >> BigInt(128);
    if ((absTick & 0x10000) != 0) ratio = (BigInt(ratio) * BigInt('0x9aa508b5b7a84e1c677de54f3e99bc9')) >> BigInt(128);
    if ((absTick & 0x20000) != 0) ratio = (BigInt(ratio) * BigInt('0x5d6af8dedb81196699c329225ee604')) >> BigInt(128);
    if ((absTick & 0x40000) != 0) ratio = (BigInt(ratio) * BigInt('0x2216e584f5fa1ea926041bedfe98')) >> BigInt(128);
    if ((absTick & 0x80000) != 0) ratio = (BigInt(ratio) * BigInt('0x48a170391f7dc42444e8fa2')) >> BigInt(128);

    if (tick > 0) ratio = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') / BigInt(ratio);

    return new BN(ratio.toString());
}

async function getGasPrice() {
    const latestBlock = await web3.eth.getBlock("latest");
    const baseFee = latestBlock.baseFeePerGas;

    const gasPrice = await web3.eth.getGasPrice();

    const baseFeeBN = baseFee ? new BN(baseFee) : new BN(gasPrice);
    const gasPriceBN = new BN(gasPrice);

    const maxPriorityFeePerGas = gasPriceBN.div(new BN('20'));

    const maxFeePerGas = baseFeeBN.mul(new BN('2')).add(maxPriorityFeePerGas);

    console.log("Current gas prices (in gwei):");
    console.log("Gas Price:", web3.utils.fromWei(gasPrice.toString(), 'gwei'));
    console.log("Base fee:", web3.utils.fromWei(baseFeeBN.toString(), 'gwei'));
    console.log("Max priority fee:", web3.utils.fromWei(maxPriorityFeePerGas.toString(), 'gwei'));
    console.log("Max fee:", web3.utils.fromWei(maxFeePerGas.toString(), 'gwei'));

    return {
        maxFeePerGas: maxFeePerGas.toString(),
        maxPriorityFeePerGas: maxPriorityFeePerGas.toString()
    };
}

contract("UniV3PositionManager", accounts => {
    let manager, usdcToken, wethToken, uniPool;
    const [owner] = accounts;

    before(async () => {
        console.log("Deploying contracts...");

        manager = await UniV3PositionManager.new(
            POSITION_MANAGER_ADDRESS,
            { from: owner }
        );
        console.log("Manager deployed at:", manager.address);

        usdcToken = await IERC20.at(USDC);
        wethToken = await IERC20.at(WETH);
        uniPool = await IUniswapV3Pool.at(USDC_WETH_POOL);

        const positionManagerAddress = await manager.nonfungiblePositionManager();
        nonfungiblePositionManager = await INonfungiblePositionManager.at(positionManagerAddress);
        console.log("NonfungiblePositionManager at:", positionManagerAddress);

        const token0 = await uniPool.token0();
        const token1 = await uniPool.token1();
        console.log("Pool tokens:", token0, token1);

        const wethBalance = await wethToken.balanceOf(owner);
        const usdcBalance = await usdcToken.balanceOf(owner);
        console.log("Initial balances:");
        console.log(`WETH: ${web3.utils.fromWei(wethBalance.toString())} WETH`);
        console.log(`USDC: ${usdcBalance.toString() / 1e6} USDC`);
    });

    // before(async () => {
    //     console.log("Initializing tests...");
    //
    //     manager = await UniV3PositionManager.at('0xb687963DAD8f0041B5c8a12d05F57ECB07EE551e');
    //     console.log("Using manager at:", manager.address);
    //
    //     usdcToken = await IERC20.at(USDC);
    //     wethToken = await IERC20.at(WETH);
    //     uniPool = await IUniswapV3Pool.at(USDC_WETH_POOL);
    //
    //     const positionManagerAddress = await manager.nonfungiblePositionManager();
    //     nonfungiblePositionManager = await INonfungiblePositionManager.at(positionManagerAddress);
    //     console.log("NonfungiblePositionManager at:", positionManagerAddress);
    //
    //     const token0 = await uniPool.token0();
    //     const token1 = await uniPool.token1();
    //     console.log("Pool tokens:", token0, token1);
    //
    //     const wethBalance = await wethToken.balanceOf(owner);
    //     const usdcBalance = await usdcToken.balanceOf(owner);
    //     console.log("Initial balances:");
    //     console.log(`WETH: ${web3.utils.fromWei(wethBalance.toString())} WETH`);
    //     console.log(`USDC: ${usdcBalance.toString() / 1e6} USDC`);
    //
    //     const nonfungiblePositionManagerAddress = await manager.nonfungiblePositionManager();
    //     console.log("NonfungiblePositionManager address:", nonfungiblePositionManagerAddress);
    //     expect(nonfungiblePositionManagerAddress).to.equal(POSITION_MANAGER_ADDRESS);
    // });

    describe("Position Creation Flow", () => {
        let wethAmount, usdcAmount;

        beforeEach(async () => {
            wethAmount = toWei(TEST_AMOUNT_WETH);
            usdcAmount = toUSDC(TEST_AMOUNT_USDC);

            await approveToken(wethToken, manager.address, wethAmount, owner);
            await approveToken(usdcToken, manager.address, usdcAmount, owner);
        });

        it("should create position with valid parameters", async () => {
            console.log("\nCreating position...");
            console.log("WETH amount:", TEST_AMOUNT_WETH);
            console.log("USDC amount:", TEST_AMOUNT_USDC);
            console.log("Width:", TEST_WIDTH);

            try {
                const gasPrices = await getGasPrice();

                const txResult = await manager.createPosition(
                    USDC_WETH_POOL,
                    usdcAmount,
                    wethAmount,
                    TEST_WIDTH,
                    {
                        from: owner,
                        gas: 3000000,
                        maxFeePerGas: gasPrices.maxFeePerGas,
                        maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas
                    }
                );

                const debugEvent = txResult.logs.find(log => log.event === 'Debug');
                if (debugEvent) {
                    console.log("Debug info:");
                    console.log("Current tick:", debugEvent.args.currentTick.toString());
                    console.log("Raw ticks:", {
                        lower: debugEvent.args.rawTickLower.toString(),
                        upper: debugEvent.args.rawTickUpper.toString()
                    });
                    console.log("Final ticks:", {
                        lower: debugEvent.args.tickLower.toString(),
                        upper: debugEvent.args.tickUpper.toString()
                    });
                    console.log("Widths:", {
                        actual: debugEvent.args.actualWidth.toString(),
                        target: debugEvent.args.targetWidth.toString()
                    });
                }

                console.log("Position created!");
                console.log("Transaction hash:", txResult.tx);
                console.log("Gas used:", txResult.receipt.gasUsed);

                // Проверяем успешность транзакции
                expect(txResult.receipt.status).to.be.true;

                console.log("Position created!");
                console.log("Transaction hash:", txResult.tx);
                console.log("Gas used:", txResult.receipt.gasUsed);

                const positionCreatedEvent = txResult.logs.find(
                    log => log.event === 'PositionCreated'
                );

                if (!positionCreatedEvent) {
                    throw new Error("PositionCreated event not found");
                }

                const positionId = positionCreatedEvent.args.tokenId;
                console.log("Position ID:", positionId.toString());

                const position = await nonfungiblePositionManager.positions(positionId);

                const tickLower = position.tickLower;
                const tickUpper = position.tickUpper;
                console.log("Ticks:", {lower: tickLower.toString(), upper: tickUpper.toString()});

                const sqrtPriceLowerX96 = getSqrtRatioAtTick(tickLower);
                const sqrtPriceUpperX96 = getSqrtRatioAtTick(tickUpper);

                const Q96 = new BN('2').pow(new BN('96'));
                const lowerPrice = sqrtPriceLowerX96.mul(sqrtPriceLowerX96).div(Q96);
                const upperPrice = sqrtPriceUpperX96.mul(sqrtPriceUpperX96).div(Q96);

                const actualWidth = upperPrice.sub(lowerPrice).mul(new BN('10000')).div(upperPrice.add(lowerPrice));
                console.log("Actual width:", actualWidth.toString());

                const minWidth = new BN(TEST_WIDTH_BN).mul(new BN('95')).div(new BN('100'));
                const maxWidth = new BN(TEST_WIDTH_BN).mul(new BN('105')).div(new BN('100'));

                expect(actualWidth).to.be.bignumber.gte(minWidth);
                expect(actualWidth).to.be.bignumber.lte(maxWidth);

            } catch (error) {
                console.error("\nError creating position:");
                console.error("USDC amount:", usdcAmount.toString());
                console.error("WETH amount:", wethAmount.toString());
                console.error("Width:", TEST_WIDTH);
                if (error.reason) console.error("Reason:", error.reason);
                if (error.message) console.error("Message:", error.message);
                if (error.receipt) {
                    console.error("Receipt status:", error.receipt.status);
                    console.error("Gas used:", error.receipt.gasUsed);
                }
                throw error;
            }
        });

        it("should fail with invalid width", async () => {
            // Test width = 0
            try {
                await manager.createPosition(
                    USDC_WETH_POOL,
                    usdcAmount,
                    wethAmount,
                    0,
                    { from: owner }
                );
                assert.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Invalid width");
            }

            // Test width > 10000
            try {
                await manager.createPosition(
                    USDC_WETH_POOL,
                    usdcAmount,
                    wethAmount,
                    10001,
                    { from: owner }
                );
                assert.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Invalid width");
            }
        });
    });
});