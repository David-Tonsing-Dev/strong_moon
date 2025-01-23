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
});
