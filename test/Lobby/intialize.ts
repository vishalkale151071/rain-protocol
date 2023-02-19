import { assert } from "chai";
import { ContractFactory } from "ethers";
import { concat } from "ethers/lib/utils";
import { ethers } from "hardhat";
import type { ReserveToken18 } from "../../typechain";
import {
  InitializeEvent,
  Lobby,
  LobbyConfigStruct,
  LobbyConstructorConfigStruct,
} from "../../typechain/contracts/lobby/Lobby";
import { compareStructs, getRainContractMetaBytes } from "../../utils";
import { ONE } from "../../utils/constants/bigNumber";
import { basicDeploy } from "../../utils/deploy/basicDeploy";
import { deployLobby } from "../../utils/deploy/lobby/deploy";
import deploy1820 from "../../utils/deploy/registry1820/deploy";
import { getEventArgs } from "../../utils/events";
import {
  generateEvaluableConfig,
  memoryOperand,
  MemoryType,
  op,
} from "../../utils/interpreter/interpreter";
import { RainterpreterOps } from "../../utils/interpreter/ops/allStandardOps";

describe("Lobby Tests Intialize", async function () {
  const Opcode = RainterpreterOps;
  let tokenA: ReserveToken18;

  before(async () => {
    // Deploy ERC1820Registry
    const signers = await ethers.getSigners();
    await deploy1820(signers[0]);
  });

  beforeEach(async () => {
    tokenA = (await basicDeploy("ReserveToken18", {})) as ReserveToken18;
    await tokenA.initialize();
  });

  it("Lobby is intialized correctly", async function () {
    const signers = await ethers.getSigners();

    const timeoutDuration = 15000000;
    const Lobby: Lobby = await deployLobby(timeoutDuration);

    const constants = [0, 1, ONE];

    // prettier-ignore
    const joinSource = concat([
        op(Opcode.context, 0x0300) ,
        op(Opcode.read_memory,memoryOperand(MemoryType.Constant, 2))
      ]);

    const leaveSource = concat([
      op(Opcode.read_memory, memoryOperand(MemoryType.Constant, 2)),
    ]);
    const claimSource = concat([op(Opcode.context, 0x0100)]);

    const invalidSource = concat([
      op(Opcode.read_memory, memoryOperand(MemoryType.Constant, 0)),
    ]);

    const lobbyExpressionConfig = {
      sources: [joinSource, leaveSource, claimSource, invalidSource],
      constants: constants,
    };

    const evaluableConfig = await generateEvaluableConfig(
      lobbyExpressionConfig.sources,
      lobbyExpressionConfig.constants
    );

    const initialConfig: LobbyConfigStruct = {
      refMustAgree: false,
      ref: signers[0].address,
      evaluableConfig: evaluableConfig,
      token: tokenA.address,
      description: "0x00",
      timeoutDuration: timeoutDuration,
    };

    const intializeTx = await Lobby.initialize(initialConfig);

    const intializeEvent = (await await getEventArgs(
      intializeTx,
      "Initialize",
      Lobby
    )) as InitializeEvent["args"];

    assert(
      intializeEvent.sender === signers[0].address,
      "wrong deposit sender"
    );
    compareStructs(intializeEvent.config, initialConfig);
  }); 
  
});
