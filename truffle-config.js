require('dotenv').config();
const HDWalletProvider = require('@truffle/hdwallet-provider');

module.exports = {
    networks: {
        sepolia: {
            provider: () => new HDWalletProvider({
                privateKeys: [process.env.PRIVATE_KEY],
                providerOrUrl: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
                pollingInterval: 30000,
                timeout: 20000000,
            }),
            network_id: 11155111,
            confirmations: 2,
            timeoutBlocks: 10000,
            networkCheckTimeout: 10000000,
            skipDryRun: true,
        },
        bsc: {
            provider: () => new HDWalletProvider(
                process.env.PRIVATE_KEY,
                'https://bsc-dataseed1.binance.org'
            ),
            network_id: 56,
            confirmations: 2,
            timeoutBlocks: 200,
            skipDryRun: true
        }
    },
    compilers: {
        solc: {
            version: "0.8.20",
            settings: {
                viaIR: true,
                optimizer: {
                    enabled: true,
                    runs: 200
                },
                evmVersion: "paris",
                outputSelection: {
                    "*": {
                        "*": ["evm.bytecode", "evm.deployedBytecode", "abi"]
                    }
                }
            }
        }
    },
    verify: {
        compiler: {
            version: "0.8.20",
            settings: {
                viaIR: true,
                optimizer: {
                    enabled: true,
                    runs: 200
                },
                evmVersion: "paris",
                metadata: {
                    bytecodeHash: "none"
                },
                outputSelection: {
                    "*": {
                        "*": [
                            "evm.bytecode",
                            "evm.deployedBytecode",
                            "abi",
                            "metadata",
                            "evm.methodIdentifiers"
                        ]
                    }
                }
            }
        },
        apiUrls: {
            sepolia: 'https://api-sepolia.etherscan.io/api'
        },
        customArgs: {
            encoding: "utf8",
            constructorArguments: ["0x1238536071E1c677A632429e3655c799b22cDA52"],
            optimizationRuns: 200,
            evmVersion: "paris",
            compilerVersion: "v0.8.20+commit.a1b79de6"
        }
    },
    plugins: ['truffle-plugin-verify'],
    api_keys: {
        bscscan: process.env.BSCSCAN_API_KEY,
        etherscan: process.env.ETHERSCAN_API_KEY
    },
    mocha: {
        timeout: 20000000,
        bail: false,
        enableTimeouts: false
    }
};