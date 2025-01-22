const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenFactory", function () {
  let tokenFactory, qiteSwap;
  let deployer, user;

  const MEMETOKEN_CREATION_PLATFORM_FEE = ethers.parseUnits("0.0001", "ether");
  const MEMECOIN_FUNDING_GOAL = ethers.parseUnits("10", "ether"); // Set the funding goal to 10 ETHW (10 ETHW in wei)

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

  it("should allow multiple users to buy tokens for the same ETHW (2 ETHW) and raise funds to 10 ETHW", async function () {
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
    const [_, buyer1, buyer2, buyer3, buyer4, buyer5] =
      await ethers.getSigners(); // Get multiple signers

    // Same ETHW cost for all buyers
    const ethwToSpend = ethers.parseUnits("2", 18); // 2 ETHW for all buyers

    // Buyer 1 buying tokens for 2 ETHW
    await tokenFactory.connect(buyer1).buyMemeToken(memeTokenAddress, 1, {
      value: ethwToSpend,
    });

    // Buyer 2 buying tokens for 2 ETHW
    await tokenFactory.connect(buyer2).buyMemeToken(memeTokenAddress, 2, {
      value: ethwToSpend,
    });

    // Buyer 3 buying tokens for 2 ETHW
    await tokenFactory.connect(buyer3).buyMemeToken(memeTokenAddress, 3, {
      value: ethwToSpend,
    });

    // Buyer 4 buying tokens for 2 ETHW
    await tokenFactory.connect(buyer4).buyMemeToken(memeTokenAddress, 4, {
      value: ethwToSpend,
    });

    // Buyer 5 buying tokens for 2 ETHW
    await tokenFactory.connect(buyer5).buyMemeToken(memeTokenAddress, 5, {
      value: ethwToSpend,
    });

    // Check if the total funding raised is updated correctly to 10 ETHW
    const updatedToken = await tokenFactory.addressToMemeTokenMapping(
      memeTokenAddress
    );
    console.log(
      "Updated token funding raised (wei):",
      updatedToken.fundingRaised.toString()
    );

    // The total funding raised should be exactly 10 ETHW (10 * 10^18 wei)
    expect(updatedToken.fundingRaised).to.be.equal(MEMECOIN_FUNDING_GOAL);

    // Verify that each buyer's balance is updated using the Token contract
    const memeToken = await ethers.getContractAt("Token", memeTokenAddress);

    const buyer1Balance = await memeToken.balanceOf(buyer1.address);
    const buyer2Balance = await memeToken.balanceOf(buyer2.address);
    const buyer3Balance = await memeToken.balanceOf(buyer3.address);
    const buyer4Balance = await memeToken.balanceOf(buyer4.address);
    const buyer5Balance = await memeToken.balanceOf(buyer5.address);

    console.log("Buyer 1 balance:", buyer1Balance.toString());
    console.log("Buyer 2 balance:", buyer2Balance.toString());
    console.log("Buyer 3 balance:", buyer3Balance.toString());
    console.log("Buyer 4 balance:", buyer4Balance.toString());
    console.log("Buyer 5 balance:", buyer5Balance.toString());

    // The first buyer should have more tokens than the second, and so on
    expect(buyer1Balance).to.be.gt(buyer2Balance);
    expect(buyer2Balance).to.be.gt(buyer3Balance);
    expect(buyer3Balance).to.be.gt(buyer4Balance);
    expect(buyer4Balance).to.be.gt(buyer5Balance);

    console.log(
      "Multiple users have bought tokens for 2 ETHW successfully, with the first buyer getting more tokens."
    );
  });
});
