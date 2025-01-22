const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenFactory", function () {
  let tokenFactory, qiteSwap;
  let deployer, user;

  const MEMETOKEN_CREATION_PLATFORM_FEE = ethers.parseUnits("0.0001", "ether");

  beforeEach(async function () {
    // Assign different roles
    [deployer, user] = await ethers.getSigners(); // Deployer and user are different

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

    console.log("TokenFactory deployed by:", deployer.address);
  });

  it("should allow multiple users to buy tokens for the same ETHW (1 ETHW) and decrease token reward for each buyer", async function () {
    const name = "MemeToken";
    const symbol = "MEME";
    const imageUrl = "https://example.com/token.png";
    const description = "A fun meme token";

    // Create the meme token
    const tx = await tokenFactory
      .connect(user) // User creates the meme token
      .createMemeToken(name, symbol, imageUrl, description, {
        value: MEMETOKEN_CREATION_PLATFORM_FEE,
      });
    await tx.wait();

    const allTokens = await tokenFactory.getAllMemeTokens();
    const createdToken = allTokens[0];
    const memeTokenAddress = createdToken.tokenAddress;

    // Define buyers
    const [_, buyer1, buyer2, buyer3] = await ethers.getSigners(); // Get multiple signers

    // Same ETHW cost for all buyers
    const ethwToSpend = ethers.parseUnits("1", 18); // 1 ETHW for all buyers

    // Get the current supply to calculate cost for each user
    const currentSupply = ethers.parseUnits("0", 18); // Start from initial supply

    // Buyer 1 buying tokens for 1 ETHW
    await tokenFactory.connect(buyer1).buyMemeToken(memeTokenAddress, 1, {
      value: ethwToSpend,
    });

    // Buyer 2 buying tokens for 1 ETHW
    await tokenFactory.connect(buyer2).buyMemeToken(memeTokenAddress, 2, {
      value: ethwToSpend,
    });

    // Buyer 3 buying tokens for 1 ETHW
    await tokenFactory.connect(buyer3).buyMemeToken(memeTokenAddress, 3, {
      value: ethwToSpend,
    });

    // Check if the total funding raised is updated correctly
    const updatedToken = await tokenFactory.addressToMemeTokenMapping(
      memeTokenAddress
    );
    console.log(
      "Updated token funding raised:",
      updatedToken.fundingRaised.toString()
    );

    // Verify that each buyer's balance is updated using the Token contract
    const memeToken = await ethers.getContractAt("Token", memeTokenAddress);

    const buyer1Balance = await memeToken.balanceOf(buyer1.address);
    const buyer2Balance = await memeToken.balanceOf(buyer2.address);
    const buyer3Balance = await memeToken.balanceOf(buyer3.address);

    console.log("Buyer 1 balance:", buyer1Balance.toString());
    console.log("Buyer 2 balance:", buyer2Balance.toString());
    console.log("Buyer 3 balance:", buyer3Balance.toString());

    // The first buyer should have more tokens than the second, and the second should have more than the third
    expect(buyer1Balance).to.be.gt(buyer2Balance);
    expect(buyer2Balance).to.be.gt(buyer3Balance);

    console.log(
      "Multiple users have bought tokens for 1 ETHW successfully, with the first buyer getting more tokens."
    );
  });
});
