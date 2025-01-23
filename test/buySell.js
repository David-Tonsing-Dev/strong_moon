const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("TokenFactory Contract - Extended Test Suite", function () {
  let TokenFactory, tokenFactory;
  let owner, buyer, seller;

  beforeEach(async function () {
    [owner, buyer, seller] = await ethers.getSigners();

    const TokenFactoryContract = await ethers.getContractFactory(
      "TokenFactory",
      owner
    );
    tokenFactory = await TokenFactoryContract.deploy();
  });

  it("Should allow a user to buy tokens and transfer tax to the owner", async function () {
    const tokensToBuy = 10n;

    const cost = await tokenFactory.calculateCost(tokensToBuy);
    const tax = (cost * 1n) / 100n;
    const totalCost = cost + tax;

    await tokenFactory.connect(buyer).buyTokens(tokensToBuy, {
      value: totalCost,
    });

    const buyerBalance = await tokenFactory.balances(buyer.address);
    expect(buyerBalance).to.equal(tokensToBuy);

    const event = (await tokenFactory.queryFilter("TokensPurchased"))[0];
    expect(event.args.buyer).to.equal(buyer.address);
  });

  it("Should revert if user tries to sell more tokens than they have", async function () {
    const tokensToSell = 10n;
    await expect(
      tokenFactory.connect(buyer).sellTokens(tokensToSell)
    ).to.be.revertedWith("Insufficient token balance");
  });

  it("Should allow a user to buy tokens and handle excess Ether", async function () {
    const tokensToBuy = 10n;

    // Calculate cost and tax for the tokens
    const cost = await tokenFactory.calculateCost(tokensToBuy);
    const tax = (cost * 1n) / 100n;
    const totalCost = cost + tax;

    // Send extra Ether above the total cost
    const extraEther = ethers.parseEther("0.01");
    const amountSent = totalCost + extraEther;

    // Track the initial balances
    const ownerEtherBalanceBefore = await ethers.provider.getBalance(
      owner.address
    );
    const buyerEtherBalanceBefore = await ethers.provider.getBalance(
      buyer.address
    );

    // Buyer purchases tokens
    const tx = await tokenFactory
      .connect(buyer)
      .buyTokens(tokensToBuy, { value: amountSent });
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.effectiveGasPrice;

    // Verify the buyer’s token balance
    const buyerTokenBalance = await tokenFactory.balances(buyer.address);
    expect(buyerTokenBalance).to.equal(tokensToBuy);

    // Verify the owner received the tax
    const ownerEtherBalanceAfter = await ethers.provider.getBalance(
      owner.address
    );
    expect(ownerEtherBalanceAfter - ownerEtherBalanceBefore).to.equal(tax);

    // Verify the buyer received a refund for the excess Ether
    const buyerEtherBalanceAfter = await ethers.provider.getBalance(
      buyer.address
    );
    const expectedBuyerEtherBalance =
      buyerEtherBalanceBefore - totalCost - gasUsed;
    expect(buyerEtherBalanceAfter).to.equal(expectedBuyerEtherBalance);

    // Verify total supply increase
    const totalSupplyAfter = await tokenFactory.totalSupply();
    expect(totalSupplyAfter).to.equal(tokensToBuy);
  });
});
