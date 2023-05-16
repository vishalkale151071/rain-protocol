import { strict as assert } from "assert";
import { ethers } from "hardhat";
import { flatten2D } from "../../../../utils/array/flatten";
import deploy1820 from "../../../../utils/deploy/registry1820/deploy";
import { iinterpreterV1ConsumerDeploy } from "../../../../utils/deploy/test/iinterpreterV1Consumer/deploy";
import {
  opMetaHash,
  standardEvaluableConfig,
} from "../../../../utils/interpreter/interpreter";
import { assertError } from "../../../../utils/test/assertError";
import { rainlang } from "../../../../utils/extensions/rainlang";

describe("RainInterpreter CONTEXT_ROW", async function () {
  before(async () => {
    // Deploy ERC1820Registry
    const signers = await ethers.getSigners();
    await deploy1820(signers[0]);
  });

  it("should support context height [COLUMN] up to 16", async () => {
    const { sources, constants } = await standardEvaluableConfig(
      rainlang`
        @${opMetaHash}
_: context-row<15>(0);`
    );

    const { consumerLogic, interpreter, dispatch } =
      await iinterpreterV1ConsumerDeploy(sources, constants, 1);

    const col: number[] = [1];
    const context = new Array<number[]>(16).fill(col, 0, 256);
    await consumerLogic["eval(address,uint256,uint256[][])"](
      interpreter.address,
      dispatch,
      context
    );
    const resultCol_ = await consumerLogic.stack();
    assert(resultCol_, "should read context value at 0xff00");
  });

  it("should support context width [ROW] up to 256", async () => {
    const MAX_ROWS = 2 ** 8;
    const { sources, constants } = await standardEvaluableConfig(
      rainlang`
        @${opMetaHash}
_: context-row<0>(${MAX_ROWS - 1});`
    );

    const { consumerLogic, interpreter, dispatch } =
      await iinterpreterV1ConsumerDeploy(sources, constants, 1);

    const row: number[] = new Array<number>(MAX_ROWS).fill(1, 0, MAX_ROWS);
    const context = [row];
    await consumerLogic["eval(address,uint256,uint256[][])"](
      interpreter.address,
      dispatch,
      context
    );
    const resultRow_ = await consumerLogic.stack();
    assert(resultRow_, "should read context value at 0x00ff");
  });

  it("should error if accessing memory outside of context memory range", async () => {
    const { sources, constants } = await standardEvaluableConfig(
      rainlang`
        @${opMetaHash}
_: context-row<0>(10);`
    );

    const { consumerLogic, interpreter, dispatch } =
      await iinterpreterV1ConsumerDeploy(sources, constants, 1);

    // OOB check for row is being made at runtime
    await assertError(
      async () =>
        await consumerLogic["eval(address,uint256,uint256[][])"](
          interpreter.address,
          dispatch,
          []
        ),
      "Array accessed at an out-of-bounds or negative index",
      "did not error when accessing OOB ROW"
    );
  });

  it("should return correct context value when specifying CONTEXT_ROW operand for 2D context", async () => {
    const { sources, constants } = await standardEvaluableConfig(
      rainlang`
        @${opMetaHash}

      _: context-row<0>(0),
      _: context-row<0>(1),
      _: context-row<0>(2),
      _: context-row<0>(3),
      _: context-row<1>(0),
      _: context-row<1>(1),
      _: context-row<1>(2),
      _: context-row<1>(3),
      _: context-row<2>(0),
      _: context-row<2>(1);`
    );
    const { consumerLogic, interpreter, dispatch } =
      await iinterpreterV1ConsumerDeploy(sources, constants, 20);

    const context = [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [8, 9],
    ];

    await consumerLogic["eval(address,uint256,uint256[][])"](
      interpreter.address,
      dispatch,
      context
    );

    const result_ = await consumerLogic.stack();

    const expectedFlattenedContext = flatten2D(context);

    expectedFlattenedContext.forEach((expectedValue, i_) => {
      assert(
        result_[i_].eq(expectedValue),
        `wrong value was returned at index ${i_}
        expected  ${expectedValue}
        got       ${result_[i_]}`
      );
    });
  });

  it("should return correct context value when specifying CONTEXT_ROW operand for 1D context", async () => {
    const { sources, constants } = await standardEvaluableConfig(
      rainlang`
        @${opMetaHash}

      _: context-row<0>(0),
      _: context-row<0>(1),
      _: context-row<0>(2),
      _: context-row<0>(3);`
    );

    const { consumerLogic, interpreter, dispatch } =
      await iinterpreterV1ConsumerDeploy(sources, constants, 8);

    const context = [[10, 20, 30, 40]];

    await consumerLogic["eval(address,uint256,uint256[][])"](
      interpreter.address,
      dispatch,
      context
    );

    const result_ = await consumerLogic.stack();

    context[0].forEach((expectedValue, i_) => {
      assert(
        result_[i_].eq(expectedValue),
        `wrong value was returned at index ${i_}
        expected  ${expectedValue}
        got       ${result_[i_]}`
      );
    });
  });

  it("should support adding new data to stack at runtime via CONTEXT_ROW opcode", async () => {
    const { sources, constants } = await standardEvaluableConfig(
      rainlang`
        @${opMetaHash}
_: context-row<1>(0);`
    );

    const { consumerLogic, interpreter, dispatch } =
      await iinterpreterV1ConsumerDeploy(sources, constants, 1);

    const data = [
      [422, 213, 123, 413],
      [11, 22],
    ];

    await consumerLogic["eval(address,uint256,uint256[][])"](
      interpreter.address,
      dispatch,
      data
    );

    const result = await consumerLogic.stackTop();
    const expected = 11;

    assert(
      result.eq(expected),
      `wrong value was returned
      expected  ${expected}
      got       ${result}`
    );
  });
});
