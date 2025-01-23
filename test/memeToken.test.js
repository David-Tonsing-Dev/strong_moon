const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("TokenFactory Contract - Extended Test Suite", function () {
  let TokenFactory, tokenFactory;
  let owner, addr1, addr2, addr3;

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    // Deploy the TokenFactory contract using `owner`
    const TokenFactoryContract = await ethers.getContractFactory(
      "TokenFactory",
      owner
    );
    tokenFactory = await TokenFactoryContract.deploy();
  });

  it("Should allow different accounts to create multiple tokens", async function () {
    const creationFee = ethers.parseEther("0.01");

    // Create token 1 from addr1
    const tx1 = await tokenFactory
      .connect(addr1)
      .createMemeToken(
        "Token1",
        "TK1",
        "https://example.com/tk1.png",
        "Description 1",
        {
          value: creationFee,
        }
      );
    const receipt1 = await tx1.wait();

    const event1 = receipt1.logs
      .map((log) => {
        try {
          return tokenFactory.interface.parseLog(log);
        } catch (error) {
          return null;
        }
      })
      .find((e) => e && e.name === "TokenCreated");

    const token1Address = event1.args.tokenAddress;

    // Create token 2 from addr2
    const tx2 = await tokenFactory
      .connect(addr2)
      .createMemeToken(
        "Token2",
        "TK2",
        "https://example.com/tk2.png",
        "Description 2",
        {
          value: creationFee,
        }
      );
    const receipt2 = await tx2.wait();

    const event2 = receipt2.logs
      .map((log) => {
        try {
          return tokenFactory.interface.parseLog(log);
        } catch (error) {
          return null;
        }
      })
      .find((e) => e && e.name === "TokenCreated");

    const token2Address = event2.args.tokenAddress;

    // Verify both tokens are stored in the factory
    const tokens = await tokenFactory.getAllMemeTokens();
    expect(tokens).to.have.lengthOf(2);

    // Attach and verify details of token1
    const Token = await ethers.getContractFactory("Token");
    const token1 = await Token.attach(token1Address);
    expect(await token1.name()).to.equal("Token1");
    expect(await token1.symbol()).to.equal("TK1");

    // Attach and verify details of token2
    const token2 = await Token.attach(token2Address);
    expect(await token2.name()).to.equal("Token2");
    expect(await token2.symbol()).to.equal("TK2");
  });

  it("Should reject token creation with insufficient fee", async function () {
    // Attempt to create a token without paying the fee
    await expect(
      tokenFactory
        .connect(addr1)
        .createMemeToken(
          "FailToken",
          "FAIL",
          "https://example.com/fail.png",
          "No Fee",
          {
            value: ethers.parseEther("0.005"), // Insufficient fee
          }
        )
    ).to.be.revertedWith("Insufficient creation fee");
  });

  it("Should correctly handle token creation fees sent to the owner", async function () {
    const creationFee = ethers.parseEther("0.01");
    const initialOwnerBalance = await ethers.provider.getBalance(owner.address);

    // Create token from addr1
    await tokenFactory
      .connect(addr1)
      .createMemeToken(
        "Token1",
        "TK1",
        "https://example.com/tk1.png",
        "Description 1",
        {
          value: creationFee,
        }
      );

    // Verify owner balance increased by the creation fee
    const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
    expect(finalOwnerBalance - initialOwnerBalance).to.equal(creationFee); // Use subtraction for `bigint`
  });

  it("Should allow multiple tokens created by the same account", async function () {
    const creationFee = ethers.parseEther("0.01");

    // Create two tokens from addr1
    await tokenFactory
      .connect(addr1)
      .createMemeToken(
        "TokenA",
        "TKA",
        "https://example.com/tka.png",
        "Token A",
        {
          value: creationFee,
        }
      );

    await tokenFactory
      .connect(addr1)
      .createMemeToken(
        "TokenB",
        "TKB",
        "https://example.com/tkb.png",
        "Token B",
        {
          value: creationFee,
        }
      );

    // Verify two tokens are stored in the factory
    const tokens = await tokenFactory.getAllMemeTokens();
    expect(tokens).to.have.lengthOf(2);
  });

  it("Should revert if invalid parameters are passed during token creation", async function () {
    const creationFee = ethers.parseEther("0.01");

    // Attempt to create a token with an empty name
    await expect(
      tokenFactory
        .connect(addr1)
        .createMemeToken(
          "",
          "TKX",
          "https://example.com/emptyname.png",
          "No Name",
          {
            value: creationFee,
          }
        )
    ).to.be.revertedWith("Invalid token name");

    // Attempt to create a token with an empty symbol
    await expect(
      tokenFactory
        .connect(addr1)
        .createMemeToken(
          "TokenX",
          "",
          "https://example.com/emptysymbol.png",
          "No Symbol",
          {
            value: creationFee,
          }
        )
    ).to.be.revertedWith("Invalid token symbol");
  });
});
