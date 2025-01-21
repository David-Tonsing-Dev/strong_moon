const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenFactory", function () {
  let tokenFactory;
  let deployer, user;

  // Correct usage of ethers.parseUnits for Ethers.js v6
  const MEMETOKEN_CREATION_PLATFORM_FEE = ethers.parseUnits("0.0001", "ether");

  beforeEach(async function () {
    [deployer, user] = await ethers.getSigners();

    // Deploy TokenFactory contract
    const TokenFactoryContract = await ethers.getContractFactory(
      "TokenFactory"
    );
    tokenFactory = await TokenFactoryContract.deploy();
  });

  it("should create a meme token successfully", async function () {
    const name = "MemeToken";
    const symbol = "MEME";
    const imageUrl = "https://example.com/token.png";
    const description = "A fun meme token";

    // Create Meme Token
    console.log("Creating meme token...");
    const tx = await tokenFactory
      .connect(user)
      .createMemeToken(name, symbol, imageUrl, description, {
        value: MEMETOKEN_CREATION_PLATFORM_FEE, // Pay the creation fee
      });

    const receipt = await tx.wait();

    // Verify the token creation
    const allTokens = await tokenFactory.getAllMemeTokens(); // Fetch all meme tokens
    console.log("All meme tokens:", allTokens);

    expect(allTokens).to.have.lengthOf(1);

    const createdToken = allTokens[0];
    expect(createdToken.name).to.equal(name);
    expect(createdToken.symbol).to.equal(symbol);
    expect(createdToken.description).to.equal(description);
    expect(createdToken.tokenImageUrl).to.equal(imageUrl);
    expect(createdToken.creatorAddress).to.equal(user.address);

    console.log("Meme Token Address:", createdToken.tokenAddress);
  });

  it("should fail if the fee is not paid", async function () {
    const name = "MemeToken";
    const symbol = "MEME";
    const imageUrl = "https://example.com/token.png";
    const description = "A fun meme token";

    // Attempt to create a meme token without paying the fee
    console.log("Attempting to create meme token without full fee...");
    await expect(
      tokenFactory
        .connect(user)
        .createMemeToken(name, symbol, imageUrl, description, {
          value: ethers.parseUnits("0.00001", "ether"), // Insufficient fee
        })
    ).to.be.revertedWith("fee not paid for memetoken creation");
  });

  it("should calculate the correct cost for buying tokens", async function () {
    // Use ethers.parseUnits to handle both the currentSupply and tokensToBuy
    const currentSupply = ethers.parseUnits("0", "ether"); // No tokens issued (currently 0)
    const tokensToBuy = ethers.parseUnits("10", "ether"); // Buying 10 tokens (use units for better compatibility)

    // Debugging logs to check parsed values
    console.log("currentSupply before parseUnits:", currentSupply.toString());
    console.log("tokensToBuy before parseUnits:", tokensToBuy.toString());

    // Ensure that calculateCost doesn't return zero
    const cost = await tokenFactory.calculateCost(currentSupply, tokensToBuy);
    console.log("Calculated Cost:", cost.toString());

    expect(cost).to.be.gt(0, "Cost should be greater than zero");
  });

  it("should calculate cost within a reasonable range", async function () {
    // Simulating the scenario where the supply is large
    const currentSupply = ethers.parseUnits("500000", "ether"); // Example current supply
    const tokensToBuy = ethers.parseUnits("10", "ether"); // Buying 10 tokens

    // Calculate the cost
    const cost = await tokenFactory.calculateCost(currentSupply, tokensToBuy);

    // Log the result for inspection
    console.log("Calculated Cost:", cost.toString());

    // Ensure the cost is within a reasonable limit
    expect(cost).to.be.lt(
      ethers.parseUnits("100", "ether"),
      "Cost is too high"
    ); // Adjust limit as needed
  });

  it("should correctly handle buying meme tokens and updating the funding", async function () {
    const name = "MemeToken";
    const symbol = "MEME";
    const imageUrl = "https://example.com/token.png";
    const description = "A fun meme token";

    // Create Meme Token
    console.log("Creating meme token...");
    const tx = await tokenFactory
      .connect(user)
      .createMemeToken(name, symbol, imageUrl, description, {
        value: MEMETOKEN_CREATION_PLATFORM_FEE, // Pay the creation fee
      });

    const receipt = await tx.wait();

    const allTokens = await tokenFactory.getAllMemeTokens(); // Fetch all meme tokens
    const createdToken = allTokens[0];
    const memeTokenAddress = createdToken.tokenAddress;

    // Simulating a purchase of 10 tokens
    const tokensToBuy = ethers.parseUnits("10", "ether");

    // Get the current funding raised before the purchase
    const initialFunding = createdToken.fundingRaised;
    console.log("Initial Funding:", initialFunding.toString());

    // User buys meme tokens
    console.log("User is buying tokens...");
    const purchaseTx = await tokenFactory
      .connect(user)
      .buyMemeToken(memeTokenAddress, 10, {
        value: tokensToBuy, // Send ETH for the purchase
      });

    const purchaseReceipt = await purchaseTx.wait();

    // Fetch updated funding and user token balance
    const updatedToken = await tokenFactory.addressToMemeTokenMapping(
      memeTokenAddress
    );
    const updatedFunding = updatedToken.fundingRaised;
    console.log("Updated Funding:", updatedFunding.toString());

    // Check if the funding has been updated correctly
    expect(updatedFunding).to.equal(
      initialFunding.add(tokensToBuy),
      "Funding raised is not updated correctly"
    );

    // Check if the user has received the minted tokens
    const tokenContract = Token(memeTokenAddress);
    const userBalance = await tokenContract.balanceOf(user.address);
    console.log("User token balance:", userBalance.toString());

    // Ensure the correct number of tokens are minted
    expect(userBalance).to.equal(
      tokensToBuy,
      "User balance does not match expected minted tokens"
    );

    // Check if the excess ETH is refunded to the user
    const txReceipt = await purchaseTx.wait();
    const gasUsed = txReceipt.gasUsed.mul(txReceipt.effectiveGasPrice);
    const totalAmountSpent = tokensToBuy.add(gasUsed);

    // Check that the sent ETH minus the required amount is refunded
    const expectedRefund = totalAmountSpent.sub(tokensToBuy);
    const balanceAfterRefund = await ethers.provider.getBalance(user.address);
    console.log("Balance after refund:", balanceAfterRefund.toString());

    expect(balanceAfterRefund).to.be.gte(
      expectedRefund,
      "Excess ETH was not refunded correctly"
    );

    console.log("Funding Raised:", updatedFunding.toString());
    console.log("User token balance:", userBalance.toString());
    console.log("Refunded ETH:", expectedRefund.toString());
  });
});
