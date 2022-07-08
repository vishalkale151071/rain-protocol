// SPDX-License-Identifier: CAL
pragma solidity =0.8.10;

import "../VMStateBuilder.sol";
import "./AllStandardOps.sol";

contract AllStandardOpsStateBuilder is VMStateBuilder {
    /// @inheritdoc VMStateBuilder
    function stackPopsFnPtrs() public pure override returns (bytes memory) {
        return AllStandardOps.stackPopsFnPtrs();
    }

    /// @inheritdoc VMStateBuilder
    function stackPushes() public view override returns (uint[] memory) {
        return AllStandardOps.stackPushes(new uint[](0));
    }
}
