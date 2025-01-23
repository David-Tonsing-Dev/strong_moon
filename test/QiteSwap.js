const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("TokenFactory Meme Token Creation", function () {
  let deployer, otherUser, qiteSwap, tokenFactory;

  before(async function () {
    // Get deployer and another user
    [deployer, otherUser] = await ethers.getSigners();

    console.log("Deployer Address:", deployer.address);
    console.log("Other User Address:", otherUser.address);

    // Deploy QiteSwap
    const QiteSwap = await ethers.getContractFactory("QiteSwap", deployer);
    qiteSwap = await QiteSwap.deploy();
    await qiteSwap.waitForDeployment();

    console.log("QiteSwap Address:", qiteSwap.target);

    // Deploy TokenFactory using QiteSwap address
    const TokenFactory = await ethers.getContractFactory(
      "TokenFactory",
      deployer
    );
    tokenFactory = await TokenFactory.deploy(qiteSwap.target);
    await tokenFactory.waitForDeployment();

    console.log("TokenFactory Address:", tokenFactory.target);
  });

  it("Should allow a different user to create a meme token", async function () {
    // Specify token creation details
    const tokenName = "MemeToken";
    const tokenSymbol = "MEME";
    const tokenImageUrl = "https://example.com/meme.png";
    const tokenDescription = "A fun meme token.";
    const creationFee = ethers.parseEther("0.01");

    console.log("Attempting to create a meme token...");
    console.log("Token Name:", tokenName);
    console.log("Token Symbol:", tokenSymbol);
    console.log("Creation Fee:", creationFee.toString());

    // Connect to TokenFactory as another user and create a meme token
    const tx = await tokenFactory
      .connect(otherUser)
      .createMemeToken(
        tokenName,
        tokenSymbol,
        tokenImageUrl,
        tokenDescription,
        { value: creationFee }
      );
    const receipt = await tx.wait();

    console.log("Transaction Receipt:", receipt);

    // Parse the logs manually to find the TokenCreated event
    const event = receipt.logs
      .map((log) => {
        try {
          return tokenFactory.interface.parseLog(log);
        } catch (err) {
          console.log("Log Parsing Error:", err);
          return null;
        }
      })
      .find((parsedLog) => parsedLog && parsedLog.name === "TokenCreated");

    console.log("Parsed Event:", event);

    expect(event).to.exist;

    const { creator, tokenAddress, name, symbol } = event.args;
    console.log("Token Created:");
    console.log("Creator:", creator);
    console.log("Token Address:", tokenAddress);
    console.log("Name:", name);
    console.log("Symbol:", symbol);

    expect(creator).to.equal(otherUser.address);
    expect(tokenAddress).to.not.equal(ethers.ZeroAddress);
    expect(name).to.equal(tokenName);
    expect(symbol).to.equal(tokenSymbol);

    // Verify that the new token is stored in the list of meme tokens
    const allMemeTokens = await tokenFactory.getAllMemeTokens();
    console.log("All Meme Tokens:", allMemeTokens);

    const createdToken = allMemeTokens.find(
      (t) => t.tokenAddress === tokenAddress
    );
    expect(createdToken).to.exist;
    expect(createdToken.name).to.equal(tokenName);
    expect(createdToken.symbol).to.equal(tokenSymbol);
    expect(createdToken.creatorAddress).to.equal(otherUser.address);
  });
});
