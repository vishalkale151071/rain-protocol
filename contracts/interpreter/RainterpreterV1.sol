// SPDX-License-Identifier: CAL
pragma solidity ^0.8.15;

import "./runtime/StandardInterpreter.sol";

contract RainterpreterV1 is IInterpreter, RainInterpreter {
    using LibStackTop for StackTop;
    using LibInterpreterState for bytes;
    using LibInterpreterState for InterpreterState;

    function eval(
        address statePointer_,
        SourceIndex entrypoint_,
        uint256[][] memory context_
    ) external view returns (uint256[] memory) {
        InterpreterState memory state_ = SSTORE2.read(statePointer_).deserialize();
        StackTop stackTop_ = state_.eval(entrypoint_);
        uint256 stackLength_ = state_.stackBottom.toIndex(stackTop_);
        (, uint256[] memory tail_) = stackTop_.list(stackLength_);
        return tail_;
    }

    function localEvalFunctionPointers()
        internal
        pure
        virtual
        returns (
            function(InterpreterState memory, Operand, StackTop)
                view
                returns (StackTop)[]
                memory localFnPtrs_
        )
    {}

    /// @inheritdoc RainInterpreter
    function opcodeFunctionPointers()
        internal
        view
        virtual
        override
        returns (
            function(InterpreterState memory, Operand, StackTop)
                view
                returns (StackTop)[]
                memory
        )
    {
        return
            AllStandardOps.opcodeFunctionPointers(localEvalFunctionPointers());
    }
}
