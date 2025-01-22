const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenFactory", function () {
  let tokenFactory;
  let deployer, user;

  const MEMETOKEN_CREATION_PLATFORM_FEE = ethers.parseUnits("0.0001", "ether");

  beforeEach(async function () {
    [deployer, user] = await ethers.getSigners();

    const TokenFactoryContract = await ethers.getContractFactory(
      "TokenFactory"
    );
    tokenFactory = await TokenFactoryContract.deploy(); // Deploy the contract
    await tokenFactory.waitForDeployment(); // Ensure deployment completes
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
});
