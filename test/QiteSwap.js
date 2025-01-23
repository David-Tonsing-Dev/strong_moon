const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("Deployment Process", function () {
  let deployer;
  let qiteSwap;
  let tokenFactory;

  it("Should deploy QiteSwap successfully", async function () {
    // Fetch the deployer account
    [deployer] = await ethers.getSigners();
    console.log("Deployer Address:", deployer.address);

    // Deploy QiteSwap
    const QiteSwap = await ethers.getContractFactory("QiteSwap", deployer);
    qiteSwap = await QiteSwap.deploy();
    await qiteSwap.waitForDeployment();
    console.log("QiteSwap deployed at:", qiteSwap.target);

    // Assertions to verify QiteSwap deployment
    expect(qiteSwap.target).to.exist;
    expect(qiteSwap.target).to.not.equal(ethers.ZeroAddress);
  });

  it("Should deploy TokenFactory using QiteSwap address", async function () {
    // Ensure QiteSwap is deployed
    expect(qiteSwap.target).to.exist;

    // Deploy TokenFactory, passing in the QiteSwap address
    const TokenFactory = await ethers.getContractFactory(
      "TokenFactory",
      deployer
    );
    tokenFactory = await TokenFactory.deploy(qiteSwap.target);
    await tokenFactory.waitForDeployment();
    console.log("TokenFactory deployed at:", tokenFactory.target);

    // Assertions to verify TokenFactory deployment
    expect(tokenFactory.target).to.exist;
    expect(tokenFactory.target).to.not.equal(ethers.ZeroAddress);
  });
});
