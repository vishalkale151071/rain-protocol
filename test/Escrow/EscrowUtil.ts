/* eslint-disable @typescript-eslint/no-var-requires */
import * as Util from "../Util";
import { ethers } from "hardhat";
import type { RedeemableERC20ClaimEscrow } from "../../typechain/RedeemableERC20ClaimEscrow";
import type { ReserveToken } from "../../typechain/ReserveToken";
import type { ReadWriteTier } from "../../typechain/ReadWriteTier";
import type { RedeemableERC20 } from "../../typechain/RedeemableERC20";
import type { Contract } from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import type { TrustFactory } from "../../typechain/TrustFactory";
import type { SeedERC20Factory } from "../../typechain/SeedERC20Factory";

const tokenJson = require("../../artifacts/contracts/redeemableERC20/RedeemableERC20.sol/RedeemableERC20.json");

enum Tier {
  NIL,
  COPPER,
  BRONZE,
  SILVER,
  GOLD,
  PLATINUM,
  DIAMOND,
  CHAD,
  JAWAD,
}

export const deployGlobals = async () => {
  const [crpFactory, bFactory] = await Util.balancerDeploy();

  const tierFactory = await ethers.getContractFactory("ReadWriteTier");
  const tier = (await tierFactory.deploy()) as ReadWriteTier & Contract;

  const { trustFactory, seedERC20Factory } = await Util.factoriesDeploy(
    crpFactory,
    bFactory
  );

  // Deploy global Claim contract
  const claimFactory = await ethers.getContractFactory(
    "RedeemableERC20ClaimEscrow"
  );
  const claim = (await claimFactory.deploy(
    trustFactory.address
  )) as RedeemableERC20ClaimEscrow & Contract;

  return {
    crpFactory,
    bFactory,
    tierFactory,
    tier,
    trustFactory,
    seedERC20Factory,
    claimFactory,
    claim,
  };
};

export const basicSetup = async (
  signers: SignerWithAddress[],
  trustFactory: TrustFactory & Contract,
  seedERC20Factory: SeedERC20Factory & Contract,
  tier: ReadWriteTier & Contract
) => {
  const reserve = (await Util.basicDeploy("ReserveToken", {})) as ReserveToken &
    Contract;

  const minimumStatus = Tier.GOLD;

  const erc20Config = { name: "Token", symbol: "TKN" };
  const seedERC20Config = { name: "SeedToken", symbol: "SDT" };

  const reserveInit = ethers.BigNumber.from("2000" + Util.sixZeros);
  const redeemInit = ethers.BigNumber.from("2000" + Util.sixZeros);
  const totalTokenSupply = ethers.BigNumber.from("2000" + Util.eighteenZeros);
  const initialValuation = ethers.BigNumber.from("20000" + Util.sixZeros);
  const minimumCreatorRaise = ethers.BigNumber.from("100" + Util.sixZeros);

  const creator = signers[0];
  const seeder = signers[1]; // seeder is not creator/owner
  const deployer = signers[2]; // deployer is not creator

  const seederFee = ethers.BigNumber.from("100" + Util.sixZeros);
  const seederUnits = 0;
  const seederCooldownDuration = 0;

  const successLevel = reserveInit
    .add(seederFee)
    .add(redeemInit)
    .add(minimumCreatorRaise);

  const minimumTradingDuration = 100;

  const trustFactory1 = trustFactory.connect(deployer);

  const trust = await Util.trustDeploy(
    trustFactory1,
    creator,
    {
      creator: creator.address,
      minimumCreatorRaise,
      seederFee,
      redeemInit,
      reserve: reserve.address,
      reserveInit,
      initialValuation,
      finalValuation: successLevel,
      minimumTradingDuration,
    },
    {
      erc20Config,
      tier: tier.address,
      minimumStatus,
      totalSupply: totalTokenSupply,
    },
    {
      seeder: seeder.address,
      seederUnits,
      seederCooldownDuration,
      seedERC20Config,
      seedERC20Factory: seedERC20Factory.address,
    },
    { gasLimit: 100000000 }
  );

  await trust.deployed();

  // seeder needs some cash, give enough to seeder
  await reserve.transfer(seeder.address, reserveInit);

  const reserveSeeder = new ethers.Contract(
    reserve.address,
    reserve.interface,
    seeder
  ) as ReserveToken & Contract;

  const redeemableERC20Address = await trust.token();

  const redeemableERC20 = new ethers.Contract(
    redeemableERC20Address,
    tokenJson.abi,
    creator
  ) as RedeemableERC20 & Contract;

  // seeder must transfer funds to pool
  await reserveSeeder.transfer(trust.address, reserveInit);

  await trust.startDutchAuction({ gasLimit: 100000000 });

  // crp and bPool are now defined
  const [crp, bPool] = await Util.poolContracts(signers, trust);

  return {
    creator,
    seeder,
    deployer,
    reserve,
    trust,
    successLevel,
    crp,
    bPool,
    minimumTradingDuration,
    redeemableERC20,
    minimumCreatorRaise,
  };
};