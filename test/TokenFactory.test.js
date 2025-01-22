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

  it("should correctly handle buying meme tokens and updating the funding", async function () {
    const name = "MemeToken";
    const symbol = "MEME";
    const imageUrl = "https://example.com/token.png";
    const description = "A fun meme token";

    // Create a meme token
    const tx = await tokenFactory
      .connect(user)
      .createMemeToken(name, symbol, imageUrl, description, {
        value: MEMETOKEN_CREATION_PLATFORM_FEE,
      });
    await tx.wait();

    const allTokens = await tokenFactory.getAllMemeTokens();
    console.log("All tokens:", allTokens);

    const createdToken = allTokens[0];
    console.log("Created token:", createdToken);

    const memeTokenAddress = createdToken.tokenAddress;
    console.log("Meme token address:", memeTokenAddress);

    const tokensToBuy = ethers.parseUnits("10", 18); // Correctly scaled value
    console.log("Tokens to buy:", tokensToBuy.toString());

    // Calculate cost
    const cost = await tokenFactory.calculateCost(
      ethers.parseUnits("0", 18), // Current supply
      tokensToBuy / 10n ** 18n // Correct BigInt scaling
    );
    console.log("Calculated cost:", cost.toString());

    // Buy tokens
    await expect(
      tokenFactory.connect(user).buyMemeToken(
        memeTokenAddress,
        tokensToBuy / 10n ** 18n, // Correct BigInt scaling
        {
          value: cost,
        }
      )
    ).to.not.be.reverted;

    const updatedToken = await tokenFactory.addressToMemeTokenMapping(
      memeTokenAddress
    );
    console.log("Updated token:", updatedToken);

    expect(updatedToken.fundingRaised).to.equal(cost);
  });
  it("should create and sell meme tokens successfully", async function () {
    const name = "MemeToken";
    const symbol = "MEME";
    const imageUrl = "https://example.com/token.png";
    const description = "A fun meme token";

    // Create a meme token
    const tx = await tokenFactory
      .connect(user)
      .createMemeToken(name, symbol, imageUrl, description, {
        value: MEMETOKEN_CREATION_PLATFORM_FEE,
      });
    await tx.wait();

    const allTokens = await tokenFactory.getAllMemeTokens();
    const createdToken = allTokens[0];
    const memeTokenAddress = createdToken.tokenAddress;

    // User buys tokens
    const tokensToBuy = ethers.parseUnits("10", 18); // BigInt
    const cost = await tokenFactory.calculateCost(
      ethers.parseUnits("0", 18),
      tokensToBuy / 10n ** 18n
    );
    await tokenFactory
      .connect(user)
      .buyMemeToken(memeTokenAddress, tokensToBuy / 10n ** 18n, {
        value: cost,
      });

    const memeToken = await ethers.getContractAt("Token", memeTokenAddress);
    const userBalance = await memeToken.balanceOf(user.address);
    expect(userBalance).to.equal(
      tokensToBuy,
      "User should own the purchased tokens"
    );

    // User sells tokens
    const tokensToSell = ethers.parseUnits("5", 18); // BigInt
    const sellPrice = await tokenFactory.calculateCost(
      ethers.parseUnits("10", 18), // Current supply
      tokensToSell / 10n ** 18n
    );

    const contractBalanceBefore = BigInt(
      (await ethers.provider.getBalance(tokenFactory.target)).toString()
    );
    const userBalanceBefore = BigInt(
      (await ethers.provider.getBalance(user.address)).toString()
    );

    const sellTx = await tokenFactory
      .connect(user)
      .sellMemeToken(memeTokenAddress, tokensToSell / 10n ** 18n);

    const receipt = await sellTx.wait();
    const gasUsed = BigInt(receipt.gasUsed.toString());
    const gasPrice = sellTx.gasPrice
      ? BigInt(sellTx.gasPrice.toString())
      : BigInt((await ethers.provider.getGasPrice()).toString());
    const gasCost = gasUsed * gasPrice;

    const contractBalanceAfter = BigInt(
      (await ethers.provider.getBalance(tokenFactory.target)).toString()
    );
    const userBalanceAfter = BigInt(
      (await ethers.provider.getBalance(user.address)).toString()
    );

    expect(contractBalanceAfter).to.equal(
      contractBalanceBefore - sellPrice,
      "Contract balance should decrease by sell price"
    );
    expect(userBalanceAfter).to.equal(
      userBalanceBefore + sellPrice - gasCost,
      "User balance should increase after selling (accounting for gas)"
    );

    const userBalanceAfterSell = await memeToken.balanceOf(user.address);
    expect(userBalanceAfterSell.toString()).to.equal(
      (tokensToBuy - tokensToSell).toString(),
      "User should have fewer tokens after selling"
    );
  });

  it("should automatically create a pool and add liquidity once the funding goal is met", async function () {
    // Step 1: Create a meme token
    console.log("Step 1++++++++++++++++++: Creating meme token...");
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

    // Simulate buying tokens
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

    // Step 4: Check if liquidity pool is created automatically
    console.log("Step 4: Verifying automatic pool creation...");
    const tokenAmount = ethers.parseUnits("100", 18);
    const ethAmount = ethers.parseUnits("1", 18);

    const memeToken = await ethers.getContractAt("Token", memeTokenAddress);
    await memeToken.connect(user).approve(tokenFactory.target, tokenAmount);

    await expect(
      tokenFactory
        .connect(user)
        .createPoolAndAddLiquidity(memeTokenAddress, tokenAmount, {
          value: ethAmount,
        })
    ).to.not.be.reverted;

    console.log("Pool and liquidity added successfully.");
  });
});
