const UniV3PositionManager = artifacts.require("UniV3PositionManager");
const fs = require('fs');
const path = require('path');

const POSITION_MANAGER_ADDRESSES = {
    56: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    11155111: '0x1238536071E1c677A632429e3655c799b22cDA52'
};

const DEPLOYED_ADDRESS = '0x9aeF2b2d51DdfF752De99cde3f28C2D7b89314EC';

async function saveDeploymentInfo(deployer, networkId) {
    const buildPath = path.join(__dirname, '../build/contracts/UniV3PositionManager.json');
    const contractsDir = path.join(__dirname, '../build/contracts');
    if (!fs.existsSync(contractsDir)) {
        fs.mkdirSync(contractsDir, { recursive: true });
    }

    let contractData = {};
    if (fs.existsSync(buildPath)) {
        contractData = JSON.parse(fs.readFileSync(buildPath));
    }

    if (!contractData.networks) {
        contractData.networks = {};
    }

    contractData.networks[networkId] = {
        address: DEPLOYED_ADDRESS,
        transactionHash: "",
    };

    fs.writeFileSync(buildPath, JSON.stringify(contractData, null, 2));
    console.log(`Deployment info saved to ${buildPath}`);
}

module.exports = async function(deployer, network, accounts) {
    const networkId = await web3.eth.net.getId();

    try {
        console.log("Checking existing contract at:", DEPLOYED_ADDRESS);
        const existingContract = await UniV3PositionManager.at(DEPLOYED_ADDRESS);

        await saveDeploymentInfo(deployer, networkId);

        console.log("Contract already deployed at:", DEPLOYED_ADDRESS);
        return;
    } catch (error) {
        console.log("Deploying new contract...");

        const positionManagerAddress = POSITION_MANAGER_ADDRESSES[networkId];
        if (!positionManagerAddress) {
            throw new Error(`No position manager address for network ${networkId}`);
        }

        await deployer.deploy(UniV3PositionManager, positionManagerAddress);
        const instance = await UniV3PositionManager.deployed();

        await saveDeploymentInfo(deployer, networkId);

        console.log("New contract deployed at:", instance.address);
    }
};