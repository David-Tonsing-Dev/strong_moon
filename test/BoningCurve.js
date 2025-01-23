const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("TokenFactory Contract - Extended Test Suite", function () {
  let TokenFactory, tokenFactory;
  let owner, buyer;

  beforeEach(async function () {
    [owner, buyer] = await ethers.getSigners();

    const TokenFactoryContract = await ethers.getContractFactory(
      "TokenFactory",
      owner
    );
    tokenFactory = await TokenFactoryContract.deploy();
  });

  it("Should revert if tokens are bought exceeding CURVE_CAP", async function () {
    // Get the CURVE_CAP and total supply
    const curveCap = await tokenFactory.CURVE_CAP();
    const currentTotalSupply = await tokenFactory.totalSupply();
    const maxTokensToBuy = curveCap - currentTotalSupply;

    // Attempt to buy tokens exceeding the CURVE_CAP
    const excessTokensToBuy = maxTokensToBuy + 1n;

    await expect(
      tokenFactory.connect(buyer).buyTokens(excessTokensToBuy, {
        value: ethers.parseEther("1000"), // Corrected for Ethers.js v6
      })
    ).to.be.revertedWith("Bonding curve limit reached");
  });
});
