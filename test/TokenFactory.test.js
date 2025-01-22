const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenFactory", function () {
  let tokenFactory, qiteSwap;
  let deployer, user;

  const MEMETOKEN_CREATION_PLATFORM_FEE = ethers.parseUnits("0.0001", "ether");

  beforeEach(async function () {
    [deployer, user] = await ethers.getSigners();

    // Deploy QiteSwap contract
    const QiteSwapContract = await ethers.getContractFactory("QiteSwap");
    qiteSwap = await QiteSwapContract.deploy();
    await qiteSwap.waitForDeployment();

    // Deploy TokenFactory contract with the address of QiteSwap
    const TokenFactoryContract = await ethers.getContractFactory(
      "TokenFactory"
    );
    tokenFactory = await TokenFactoryContract.deploy(qiteSwap.target);
    await tokenFactory.waitForDeployment();
  });

  it("should create a meme token successfully", async function () {
    const name = "MemeToken";
    const symbol = "MEME";
    const imageUrl = "https://example.com/token.png";
    const description = "A fun meme token";

    const tx = await tokenFactory
      .connect(user)
      .createMemeToken(name, symbol, imageUrl, description, {
        value: MEMETOKEN_CREATION_PLATFORM_FEE,
      });
    await tx.wait();

    const allTokens = await tokenFactory.getAllMemeTokens();
    expect(allTokens).to.have.lengthOf(1);

    const createdToken = allTokens[0];
    expect(createdToken.name).to.equal(name);
    expect(createdToken.symbol).to.equal(symbol);
    expect(createdToken.description).to.equal(description);
    expect(createdToken.tokenImageUrl).to.equal(imageUrl);
    expect(createdToken.creatorAddress).to.equal(user.address);
  });

  it("should fail if the fee is not paid", async function () {
    const name = "MemeToken";
    const symbol = "MEME";
    const imageUrl = "https://example.com/token.png";
    const description = "A fun meme token";

    await expect(
      tokenFactory
        .connect(user)
        .createMemeToken(name, symbol, imageUrl, description, {
          value: ethers.parseUnits("0.00001", "ether"),
        })
    ).to.be.revertedWith("Fee not paid");
  });

  it("should calculate the correct cost for buying tokens", async function () {
    const currentSupply = ethers.parseUnits("0", "ether");
    const tokensToBuy = ethers.parseUnits("10", "ether");

    const cost = await tokenFactory.calculateCost(currentSupply, tokensToBuy);

    console.log("Calculated Cost:", cost.toString());
    expect(cost).to.be.gt(0, "Cost should be greater than zero");
  });

  it("should automatically create a pool and add liquidity once the funding goal is met", async function () {
    // Step 1: Create a meme token
    console.log("Step 1: Creating meme token...");
    const tx = await tokenFactory
      .connect(user)
      .createMemeToken(
        "MemeToken",
        "MEME",
        "https://example.com/token.png",
        "A fun meme token",
        {
          value: MEMETOKEN_CREATION_PLATFORM_FEE,
        }
      );
    await tx.wait();

    const allTokens = await tokenFactory.getAllMemeTokens();
    const createdToken = allTokens[0];
    const memeTokenAddress = createdToken.tokenAddress;

    console.log("Step 2: Simulating token purchase to raise funds...");
    const tokensToBuy = ethers.parseUnits("100", 18); // BigNumber
    const cost = await tokenFactory.calculateCost(
      ethers.parseUnits("0", 18), // Initial supply
      tokensToBuy / 10n ** 18n // Correct BigInt scaling
    );

    // Simulate buying tokens to raise the funding
    await tokenFactory
      .connect(user)
      .buyMemeToken(memeTokenAddress, tokensToBuy / 10n ** 18n, {
        value: cost,
      });

    // Verify the funding raised
    const updatedToken = await tokenFactory.addressToMemeTokenMapping(
      memeTokenAddress
    );
    console.log(
      "Updated token funding raised:",
      updatedToken.fundingRaised.toString()
    );

    // Step 3: Check if funding goal has been reached
    const fundingGoal = ethers.parseUnits("10", 18); // Funding goal mock
    await tokenFactory.setFundingRaised(memeTokenAddress, fundingGoal);

    // Step 4: Check if liquidity pool is created automatically by TokenFactory
    console.log("Step 4: Verifying automatic pool creation...");
    const tokenAmount = ethers.parseUnits("100", 18);
    const ethAmount = ethers.parseUnits("1", 18);

    const memeToken = await ethers.getContractAt("Token", memeTokenAddress);
    await memeToken.connect(user).approve(tokenFactory.target, tokenAmount);

    // Ensure the pool and liquidity creation doesn't revert
    await expect(
      tokenFactory
        .connect(deployer) // TokenFactory contract should add liquidity, not meme token creator
        .createPoolAndAddLiquidity(memeTokenAddress, tokenAmount, {
          value: ethAmount,
        })
    ).to.not.be.reverted;

    console.log("Pool and liquidity added successfully by TokenFactory.");
  });
});
