// SPDX-License-Identifier: CAL
pragma solidity ^0.8.15;

import "../../../../math/SaturatingMath.sol";
import "../../../runtime/LibStackTop.sol";
import "../../../runtime/LibVMState.sol";
import "../../../integrity/LibIntegrityState.sol";

/// @title OpSaturatingSub
/// @notice Opcode for subtracting N numbers with saturating subtraction.
library OpSaturatingSub {
    using SaturatingMath for uint256;
    using LibStackTop for StackTop;
    using LibIntegrityState for IntegrityState;

    function integrity(
        IntegrityState memory integrityState_,
        Operand operand_,
        StackTop stackTop_
    ) internal pure returns (StackTop) {
        return
            integrityState_.applyFnN(
                stackTop_,
                SaturatingMath.saturatingSub,
                Operand.unwrap(operand_)
            );
    }

    function saturatingSub(
        VMState memory,
        Operand operand_,
        StackTop stackTop_
    ) internal view returns (StackTop stackTopAfter_) {
        return
            stackTop_.applyFnN(
                SaturatingMath.saturatingSub,
                Operand.unwrap(operand_)
            );
    }
}
