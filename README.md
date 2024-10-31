# Uniswap V3 Position Manager

Smart contract for simplified liquidity positions management in Uniswap V3 pools. This contract helps users create liquidity positions with specified price ranges based on the percentage width from the current price.

## Features

- Create liquidity positions with percentage-based price ranges
- Automatic calculation of tick ranges based on desired width
- Price range validation to ensure accuracy
- Automatic token approvals and transfers
- Support for any Uniswap V3 pool

## Installation

1. Clone the repository:
```bash
git clone https://github.com/agopankov/UniV3PositionManager.git
cd uni3manager
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with the following variables:
```env
INFURA_API_KEY=your_infura_api_key
PRIVATE_KEY=your_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

## Usage

### Deployment

Deploy to Sepolia testnet:
```bash
truffle migrate --network sepolia
```

### Contract Interaction

The main function is `createPosition` which creates a new liquidity position:

```solidity
function createPosition(
    address pool,        // Uniswap V3 pool address
    uint256 amount0Desired,  // Amount of token0
    uint256 amount1Desired,  // Amount of token1
    uint256 widthBps     // Price range width in basis points (1-10000)
) external returns (uint256)
```

Example using web3.js:
```javascript
const positionManager = await UniV3PositionManager.at("CONTRACT_ADDRESS");

// Create position with 2% width
await positionManager.createPosition(
    "POOL_ADDRESS",
    web3.utils.toWei("1"),  // amount0Desired
    web3.utils.toWei("1"),  // amount1Desired
    200  // 2% width
);
```

### Width Calculation

The contract provides different precision for different width ranges:
- 0-5%: High precision
- 5-10%: Medium precision
- 10-20%: Lower precision
- >20%: Lowest precision

The actual width might slightly differ from the requested width due to Uniswap V3's tick spacing requirements.

## Testing

Run the test suite:
```bash
truffle test
```

## Deployment Addresses

- Sepolia: `0x9aeF2b2d51DdfF752De99cde3f28C2D7b89314EC`
- Mainnet: [Not deployed yet]

## Technical Details

### Prerequisites
- Node.js >= 14.0.0
- Truffle >= 5.0.0
- Solidity = 0.8.20

### Contract Architecture

The contract uses several components:
- `TickMath`: For tick-to-price calculations
- `INonfungiblePositionManager`: Interface to Uniswap V3 position manager
- `IUniswapV3Pool`: Interface to Uniswap V3 pool

### Security Considerations

1. The contract requires token approvals before creating positions
2. Slippage protection is not implemented - users should be aware of potential price movements
3. The contract doesn't hold any tokens - all tokens are directly transferred to Uniswap V3

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/my-new-feature`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

## Acknowledgments

- [Uniswap V3 Documentation](https://docs.uniswap.org/protocol/introduction)
- [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts)

## Support

For support, please create an issue in the repository or contact the maintainers.