const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment...");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer Address:", deployer.address);

  // Fetch deployer's balance
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer Balance:", ethers.formatEther(deployerBalance));

  // Deploy mock ERC20 tokens
  console.log("Deploying Token1...");
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  const token1 = await MockERC20Factory.deploy("Ghost", "GST");
  await token1.waitForDeployment();
  const token1Address = await token1.getAddress();
  console.log("Token1 deployed to:", token1Address);

  console.log("Deploying Token2...");
  const token2 = await MockERC20Factory.deploy("Batman", "BAT");
  await token2.waitForDeployment();
  const token2Address = await token2.getAddress();
  console.log("Token2 deployed to:", token2Address);

  // Mint initial tokens
  const mintAmount = ethers.parseEther("1000000");
  await token1.mint(deployer.address, mintAmount);
  await token2.mint(deployer.address, mintAmount);
  console.log("Minted tokens for deployer:", deployer.address);

  // Deploy QiteSwap
  console.log("Deploying QiteSwap...");
  const QiteSwapFactory = await ethers.getContractFactory("QiteSwap");
  const qiteSwap = await QiteSwapFactory.deploy();
  await qiteSwap.waitForDeployment();
  const qiteSwapAddress = await qiteSwap.getAddress();
  console.log("QiteSwap deployed to:", qiteSwapAddress);

  // Deploy QitePool
  console.log("Deploying QitePool...");
  const QitePoolFactory = await ethers.getContractFactory("QitePool");
  const qitePool = await QitePoolFactory.deploy(
    token1Address,
    "Liquidity-TokenE1-TokenE2",
    "LP-TKE1-TKE2"
  );
  await qitePool.waitForDeployment();
  const qitePoolAddress = await qitePool.getAddress();
  console.log("QitePool deployed to:", qitePoolAddress);

  // Log the LP token address from QitePool
  const lpTokenAddress = await qitePool.getLPTokenAddress();
  console.log("LP Token Address (from QitePool):", lpTokenAddress);

  // Create a pool in QiteSwap
  console.log("Creating a liquidity pool...");
  const tx = await qiteSwap.createPool(
    token1Address,
    "Liquidity-TokenE1-TokenE2",
    "LP-TKE1-TKE2"
  );
  await tx.wait();
  console.log("Liquidity pool created.");

  // Retrieve the liquidity pool address
  const poolAddress = await qiteSwap.getPair(token1Address);
  console.log("Liquidity pool address (from QiteSwap):", poolAddress);

  // Final deployer balance
  const finalDeployerBalance = await ethers.provider.getBalance(
    deployer.address
  );
  console.log(
    "Deployer Final Balance:",
    ethers.formatEther(finalDeployerBalance)
  );

  console.log("Deployment complete.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error during deployment:", error);
    process.exit(1);
  });
