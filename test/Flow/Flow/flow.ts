import { assert } from "chai";
import { concat } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { FlowFactory, FlowIntegrity } from "../../../typechain";
import {
  FlowIOStruct,
  InitializeEvent,
  StateConfigStruct,
} from "../../../typechain/contracts/flow/Flow";
import { RAIN_FLOW_SENTINEL } from "../../../utils/constants/sentinel";
import { flowDeploy } from "../../../utils/deploy/flow/flow";
import { getEventArgs } from "../../../utils/events";
import { AllStandardOps } from "../../../utils/rainvm/ops/allStandardOps";
import { memoryOperand, MemoryType, op } from "../../../utils/rainvm/vm";
import { compareStructs } from "../../../utils/test/compareStructs";

const Opcode = AllStandardOps;

describe("Flow flow tests", async function () {
  let integrity: FlowIntegrity;
  let flowFactory: FlowFactory;

  before(async () => {
    const integrityFactory = await ethers.getContractFactory("FlowIntegrity");
    integrity = (await integrityFactory.deploy()) as FlowIntegrity;
    await integrity.deployed();

    const flowFactoryFactory = await ethers.getContractFactory(
      "FlowFactory",
      {}
    );
    flowFactory = (await flowFactoryFactory.deploy(
      integrity.address
    )) as FlowFactory;
    await flowFactory.deployed();
  });

  it("should preview flow when specifying only native IO", async () => {
    const signers = await ethers.getSigners();
    const deployer = signers[0];

    const flowIO: FlowIOStruct = {
      inputNative: 100,
      outputNative: 200,
      inputs20: [],
      outputs20: [],
      inputs721: [],
      outputs721: [],
      inputs1155: [],
      outputs1155: [],
    };

    const constants = [
      RAIN_FLOW_SENTINEL,
      1,
      flowIO.inputNative,
      flowIO.outputNative,
    ];

    const SENTINEL = () =>
      op(Opcode.STATE, memoryOperand(MemoryType.Constant, 0));
    const FLOWIO_INPUT_NATIVE = () =>
      op(Opcode.STATE, memoryOperand(MemoryType.Constant, 2));
    const FLOWIO_OUTPUT_NATIVE = () =>
      op(Opcode.STATE, memoryOperand(MemoryType.Constant, 3));

    // prettier-ignore
    const sourceCanFlow = concat([
      op(Opcode.STATE, memoryOperand(MemoryType.Constant, 1)), // true
    ]);

    // prettier-ignore
    const sourceFlowIO = concat([
      FLOWIO_INPUT_NATIVE(),
      FLOWIO_OUTPUT_NATIVE(),
      SENTINEL(),
      SENTINEL(),
      SENTINEL(),
      SENTINEL(),
      SENTINEL(),
      SENTINEL(),
    ]);

    const sources = [sourceCanFlow, sourceFlowIO];

    const stateConfigStruct: StateConfigStruct = {
      sources,
      constants,
    };

    const flow = await flowDeploy(deployer, flowFactory, stateConfigStruct);

    const {
      inputNative,
      outputNative,
      inputs20,
      outputs20,
      inputs721,
      outputs721,
      inputs1155,
      outputs1155,
    } = await flow.previewFlow(1, 1234);

    console.log({
      inputNative,
      outputNative,
      inputs20,
      outputs20,
      inputs721,
      outputs721,
      inputs1155,
      outputs1155,
    });
  });
});
