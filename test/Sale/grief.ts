import { assert } from "chai";
import { concat } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { ReadWriteTier } from "../../typechain";
import { ReserveToken } from "../../typechain";
import { SaleFactory } from "../../typechain";
import { zeroAddress } from "../../utils/constants/address";
import { ONE, RESERVE_ONE, sixZeros } from "../../utils/constants/bigNumber";
import { basicDeploy } from "../../utils/deploy/basic";
import { saleDependenciesDeploy, saleDeploy } from "../../utils/deploy/sale";
import { createEmptyBlock } from "../../utils/hardhat";
import { AllStandardOps } from "../../utils/rainvm/ops/allStandardOps";
import { betweenBlockNumbersSource } from "../../utils/rainvm/sale";
import { op, memoryOperand, MemoryType } from "../../utils/rainvm/vm";
import { Status } from "../../utils/types/sale";
import { Tier } from "../../utils/types/tier";

const Opcode = AllStandardOps;

describe("Sale griefer", async function () {
  let reserve: ReserveToken,
    readWriteTier: ReadWriteTier,
    saleFactory: SaleFactory;

  before(async () => {
    ({ readWriteTier, saleFactory } = await saleDependenciesDeploy());
  });

  beforeEach(async () => {
    reserve = (await basicDeploy("ReserveToken", {})) as ReserveToken;
    await reserve.initialize();
  });

  it("should work happily if griefer sends small amount of reserve to contracts and signers", async () => {
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const recipient = signers[1];
    const signer1 = signers[2];
    const feeRecipient = signers[3];
    const forwardingAddress = signers[4];
    const griefer = signers[5];
    // griefer acquires 1m reserve somehow
    await reserve.transfer(
      griefer.address,
      ethers.BigNumber.from("1000000" + sixZeros)
    );
    // 5 blocks from now
    const startBlock = (await ethers.provider.getBlockNumber()) + 5;
    const saleDuration = 30;
    const minimumRaise = ethers.BigNumber.from("150000").mul(RESERVE_ONE);
    const totalTokenSupply = ethers.BigNumber.from("2000").mul(ONE);
    const redeemableERC20Config = {
      name: "Token",
      symbol: "TKN",
      distributor: zeroAddress,
      initialSupply: totalTokenSupply,
    };
    const staticPrice = ethers.BigNumber.from("75").mul(RESERVE_ONE);
    const constants = [
      staticPrice,
      startBlock - 1,
      startBlock + saleDuration - 1,
    ];
    const vBasePrice = op(Opcode.STATE, memoryOperand(MemoryType.Constant, 0));
    const vStart = op(Opcode.STATE, memoryOperand(MemoryType.Constant, 1));
    const vEnd = op(Opcode.STATE, memoryOperand(MemoryType.Constant, 2));
    const sources = [
      betweenBlockNumbersSource(vStart, vEnd),
      concat([op(Opcode.CONTEXT), vBasePrice]),
    ];
    const [sale, token] = await saleDeploy(
      signers,
      deployer,
      saleFactory,
      {
        vmStateConfig: {
          sources,
          constants,
        },
        recipient: recipient.address,
        reserve: reserve.address,
        cooldownDuration: 1,
        minimumRaise,
        dustSize: 0,
        saleTimeout: 100,
      },
      {
        erc20Config: redeemableERC20Config,
        tier: readWriteTier.address,
        minimumTier: Tier.ZERO,
        distributionEndForwardingAddress: forwardingAddress.address,
      }
    );
    // attempt to grief contracts and signers
    await reserve.connect(griefer).transfer(sale.address, "10" + sixZeros);
    await reserve.connect(griefer).transfer(token.address, "10" + sixZeros);
    await reserve.connect(griefer).transfer(deployer.address, "10" + sixZeros);
    await reserve.connect(griefer).transfer(recipient.address, "10" + sixZeros);
    await reserve.connect(griefer).transfer(signer1.address, "10" + sixZeros);
    await reserve
      .connect(griefer)
      .transfer(feeRecipient.address, "10" + sixZeros);
    await reserve
      .connect(griefer)
      .transfer(forwardingAddress.address, "10" + sixZeros);
    const fee = ethers.BigNumber.from("1").mul(RESERVE_ONE);
    // wait until sale start
    await createEmptyBlock(
      startBlock - (await ethers.provider.getBlockNumber())
    );
    await sale.start();
    const desiredUnits = totalTokenSupply; // all
    const cost = staticPrice.mul(desiredUnits).div(ONE);
    // give signer1 reserve to cover cost + fee
    await reserve.transfer(signer1.address, cost.add(fee));
    await reserve
      .connect(signer1)
      .approve(sale.address, staticPrice.mul(desiredUnits).add(fee));
    // buy all units
    await sale.connect(signer1).buy({
      feeRecipient: feeRecipient.address,
      fee,
      minimumUnits: desiredUnits,
      desiredUnits,
      maximumPrice: staticPrice,
    });
    // sale should have ended
    const saleStatusSuccess = await sale.saleStatus();
    assert(
      saleStatusSuccess === Status.SUCCESS,
      `wrong status in getter
      expected  ${Status.SUCCESS}
      got       ${saleStatusSuccess}`
    );
    await sale.claimFees(feeRecipient.address);
  });
});
