import { assert } from "chai";
import { ContractFactory } from "ethers";
import { concat } from "ethers/lib/utils";
import { ethers } from "hardhat";
import type { OrderBook } from "../../../typechain";
import type { OrderBookIntegrity, ReserveToken18 } from "../../../typechain";
import {
  AfterClearEvent,
  ClearConfigStruct,
  DepositConfigStruct,
  DepositEvent,
  OrderConfigStruct,
  OrderLiveEvent,
  WithdrawConfigStruct,
} from "../../../typechain/contracts/orderbook/OrderBook";
import {
  eighteenZeros,
  max_uint256,
  ONE,
} from "../../../utils/constants/bigNumber";
import { basicDeploy } from "../../../utils/deploy/basic";
import { getEventArgs } from "../../../utils/events";
import { fixedPointDiv } from "../../../utils/math";
import { OrderBookOpcode } from "../../../utils/rainvm/ops/orderBookOps";
import { memoryOperand, MemoryType, op } from "../../../utils/rainvm/vm";
import { compareStructs } from "../../../utils/test/compareStructs";

const Opcode = OrderBookOpcode;

describe("OrderBook tracking order funds cleared", async function () {
  const cOrderHash = op(Opcode.CONTEXT);

  let orderBookFactory: ContractFactory,
    tokenA: ReserveToken18,
    tokenB: ReserveToken18,
    integrity: OrderBookIntegrity;

  beforeEach(async () => {
    tokenA = (await basicDeploy("ReserveToken18", {})) as ReserveToken18;
    tokenB = (await basicDeploy("ReserveToken18", {})) as ReserveToken18;
    await tokenA.initialize();
    await tokenB.initialize();
  });

  before(async () => {
    const integrityFactory = await ethers.getContractFactory(
      "OrderBookIntegrity"
    );
    integrity = (await integrityFactory.deploy()) as OrderBookIntegrity;
    await integrity.deployed();

    orderBookFactory = await ethers.getContractFactory("OrderBook", {});
  });

  it("should expose tracked data to RainVM calculations (e.g. asker throttles output of their tokens to 5 tokens per block)", async function () {
    const signers = await ethers.getSigners();

    const alice = signers[1];
    const bob = signers[2];
    const bountyBot = signers[4];

    const orderBook = (await orderBookFactory.deploy(
      integrity.address
    )) as OrderBook;

    const aliceInputVault = ethers.BigNumber.from(1);
    const aliceOutputVault = ethers.BigNumber.from(2);
    const bobInputVault = ethers.BigNumber.from(1);
    const bobOutputVault = ethers.BigNumber.from(2);
    const bountyBotVaultA = ethers.BigNumber.from(1);
    const bountyBotVaultB = ethers.BigNumber.from(2);

    // ASK ORDER

    const askPrice = ethers.BigNumber.from("90" + eighteenZeros);
    const askBlock = await ethers.provider.getBlockNumber();

    const askConstants = [askPrice, askBlock, 5];
    const vAskPrice = op(Opcode.STATE, memoryOperand(MemoryType.Constant, 0));
    const vAskBlock = op(Opcode.STATE, memoryOperand(MemoryType.Constant, 1));
    const v5 = op(Opcode.STATE, memoryOperand(MemoryType.Constant, 2));
    // prettier-ignore
    const askSource = concat([
      // outputMax = (currentBlock - askBlock) * 5 - aliceCleared
      // 5 tokens available per block
            op(Opcode.BLOCK_NUMBER),
            vAskBlock,
          op(Opcode.SUB, 2),
          v5,
        op(Opcode.MUL, 2),
          cOrderHash,
        op(Opcode.ORDER_FUNDS_CLEARED),
      op(Opcode.SUB, 2),
      vAskPrice,
    ]);

    const askOrderConfig: OrderConfigStruct = {
      validInputs: [{ token: tokenA.address, vaultId: aliceInputVault }],
      validOutputs: [{ token: tokenB.address, vaultId: aliceOutputVault }],
      vmStateConfig: {
        sources: [askSource],
        constants: askConstants,
      },
    };

    const txAskOrderLive = await orderBook
      .connect(alice)
      .addOrder(askOrderConfig);

    const { sender: askSender, config: askConfig } = (await getEventArgs(
      txAskOrderLive,
      "OrderLive",
      orderBook
    )) as OrderLiveEvent["args"];

    assert(askSender === alice.address, "wrong sender");
    compareStructs(askConfig, askOrderConfig);

    // BID ORDER

    const bidOutputMax = max_uint256;
    const bidPrice = fixedPointDiv(ONE, askPrice);
    const bidConstants = [bidOutputMax, bidPrice];
    const vBidOutputMax = op(
      Opcode.STATE,
      memoryOperand(MemoryType.Constant, 0)
    );
    const vBidPrice = op(Opcode.STATE, memoryOperand(MemoryType.Constant, 1));
    // prettier-ignore
    const bidSource = concat([
      vBidOutputMax,
      vBidPrice,
    ]);
    const bidOrderConfig: OrderConfigStruct = {
      validInputs: [{ token: tokenB.address, vaultId: bobInputVault }],
      validOutputs: [{ token: tokenA.address, vaultId: bobOutputVault }],
      vmStateConfig: {
        sources: [bidSource],
        constants: bidConstants,
      },
    };

    const txBidOrderLive = await orderBook
      .connect(bob)
      .addOrder(bidOrderConfig);

    const { sender: bidSender, config: bidConfig } = (await getEventArgs(
      txBidOrderLive,
      "OrderLive",
      orderBook
    )) as OrderLiveEvent["args"];

    assert(bidSender === bob.address, "wrong sender");
    compareStructs(bidConfig, bidOrderConfig);

    // DEPOSITS

    const amountB = ethers.BigNumber.from("1000" + eighteenZeros);
    const amountA = ethers.BigNumber.from("1000" + eighteenZeros);

    await tokenB.transfer(alice.address, amountB);
    await tokenA.transfer(bob.address, amountA);

    const depositConfigStructAlice: DepositConfigStruct = {
      token: tokenB.address,
      vaultId: aliceOutputVault,
      amount: amountB,
    };
    const depositConfigStructBob: DepositConfigStruct = {
      token: tokenA.address,
      vaultId: bobOutputVault,
      amount: amountA,
    };

    await tokenB
      .connect(alice)
      .approve(orderBook.address, depositConfigStructAlice.amount);
    await tokenA
      .connect(bob)
      .approve(orderBook.address, depositConfigStructBob.amount);

    // Alice deposits tokenB into her output vault
    const txDepositOrderAlice = await orderBook
      .connect(alice)
      .deposit(depositConfigStructAlice);
    // Bob deposits tokenA into his output vault
    const txDepositOrderBob = await orderBook
      .connect(bob)
      .deposit(depositConfigStructBob);

    const { sender: depositAliceSender, config: depositAliceConfig } =
      (await getEventArgs(
        txDepositOrderAlice,
        "Deposit",
        orderBook
      )) as DepositEvent["args"];
    const { sender: depositBobSender, config: depositBobConfig } =
      (await getEventArgs(
        txDepositOrderBob,
        "Deposit",
        orderBook
      )) as DepositEvent["args"];

    assert(depositAliceSender === alice.address);
    compareStructs(depositAliceConfig, depositConfigStructAlice);
    assert(depositBobSender === bob.address);
    compareStructs(depositBobConfig, depositConfigStructBob);

    // BOUNTY BOT CLEARS THE ORDERS

    const clearConfig: ClearConfigStruct = {
      aInputIOIndex: 0,
      aOutputIOIndex: 0,
      bInputIOIndex: 0,
      bOutputIOIndex: 0,
      aBountyVaultId: bountyBotVaultA,
      bBountyVaultId: bountyBotVaultB,
    };

    const blockClear0 = (await ethers.provider.getBlockNumber()) + 1;
    const expectedBounty0 = { a: 1, b: 0 };
    const expectedOutputAmount0 =
      (blockClear0 - askBlock) * 5 - expectedBounty0.a;

    const txClearOrder0 = await orderBook
      .connect(bountyBot)
      .clear(askConfig, bidConfig, clearConfig);
    const { stateChange: stateChange0 } = (await getEventArgs(
      txClearOrder0,
      "AfterClear",
      orderBook
    )) as AfterClearEvent["args"];
    const { bInput: bInput0 } = stateChange0;

    const actualBounty0 = {
      a: stateChange0.aOutput.sub(stateChange0.bInput),
      b: stateChange0.bOutput.sub(stateChange0.aInput),
    };
    console.log({ actualBounty0 });

    assert(
      bInput0.eq(expectedOutputAmount0),
      `did not throttle asker output amount correctly
      expected  ${expectedOutputAmount0}
      got       ${bInput0}`
    );

    const withdrawConfig0: WithdrawConfigStruct = {
      token: tokenB.address,
      vaultId: bobInputVault,
      amount: bInput0,
    };
    const bobTokenBBalance0 = await tokenB.balanceOf(bob.address);
    await orderBook.connect(bob).withdraw(withdrawConfig0);
    const bobTokenBBalance1 = await tokenB.balanceOf(bob.address);
    assert(bobTokenBBalance0.isZero());
    assert(bobTokenBBalance1.eq(bInput0));

    // clear again
    const blockClear1 = (await ethers.provider.getBlockNumber()) + 1;
    const expectedBounty1 = { a: 1, b: 0 };
    const expectedOutputAmount1 =
      (blockClear1 - askBlock) * 5 -
      expectedBounty1.a -
      expectedOutputAmount0 -
      expectedBounty0.a;

    const txClearOrder1 = await orderBook
      .connect(bountyBot)
      .clear(askConfig, bidConfig, clearConfig);
    const { stateChange: stateChange1 } = (await getEventArgs(
      txClearOrder1,
      "AfterClear",
      orderBook
    )) as AfterClearEvent["args"];
    const { bInput: bInput1 } = stateChange1;

    const actualBounty1 = {
      a: stateChange1.aOutput.sub(stateChange1.bInput),
      b: stateChange1.bOutput.sub(stateChange1.aInput),
    };
    console.log({ actualBounty1 });

    assert(
      bInput1.eq(expectedOutputAmount1),
      `did not throttle asker output amount correctly
      expected  ${expectedOutputAmount1}
      got       ${bInput1}`
    );

    const withdrawConfig1: WithdrawConfigStruct = {
      token: tokenB.address,
      vaultId: bobInputVault,
      amount: bInput1,
    };
    await orderBook.connect(bob).withdraw(withdrawConfig1);
    const bobTokenBBalance2 = await tokenB.balanceOf(bob.address);
    assert(bobTokenBBalance2.eq(bobTokenBBalance1.add(bInput1)));
  });
});
