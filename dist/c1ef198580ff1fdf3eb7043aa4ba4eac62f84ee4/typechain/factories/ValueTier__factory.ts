/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Signer, BigNumberish } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import { Contract, ContractFactory, Overrides } from "@ethersproject/contracts";

import type { ValueTier } from "../ValueTier";

export class ValueTier__factory extends ContractFactory {
  constructor(signer?: Signer) {
    super(_abi, _bytecode, signer);
  }

  deploy(
    tierValues_: [
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish
    ],
    overrides?: Overrides
  ): Promise<ValueTier> {
    return super.deploy(tierValues_, overrides || {}) as Promise<ValueTier>;
  }
  getDeployTransaction(
    tierValues_: [
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish
    ],
    overrides?: Overrides
  ): TransactionRequest {
    return super.getDeployTransaction(tierValues_, overrides || {});
  }
  attach(address: string): ValueTier {
    return super.attach(address) as ValueTier;
  }
  connect(signer: Signer): ValueTier__factory {
    return super.connect(signer) as ValueTier__factory;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): ValueTier {
    return new Contract(address, _abi, signerOrProvider) as ValueTier;
  }
}

const _abi = [
  {
    inputs: [
      {
        internalType: "uint256[8]",
        name: "tierValues_",
        type: "uint256[8]",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "tierValues",
    outputs: [
      {
        internalType: "uint256[8]",
        name: "tierValues_",
        type: "uint256[8]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

const _bytecode =
  "0x61018060405234801561001157600080fd5b506040516102c73803806102c7833981810160405261010081101561003557600080fd5b5080516080818152602083015160a0818152604085015160c0818152606087015160e0818152958801516101008190529388015161012081905291880151610140819052959097015161016081905295969395919490916101fe6100c96000398061018252508061015c52508061013652508061011052508060ea52508060c4525080609e525080607b52506101fe6000f3fe608060405234801561001057600080fd5b506004361061002b5760003560e01c806370230b3914610030575b600080fd5b610038610071565b604051808261010080838360005b8381101561005e578181015183820152602001610046565b5050505090500191505060405180910390f35b6100796101a9565b7f000000000000000000000000000000000000000000000000000000000000000081527f000000000000000000000000000000000000000000000000000000000000000060208201527f000000000000000000000000000000000000000000000000000000000000000060408201527f000000000000000000000000000000000000000000000000000000000000000060608201527f000000000000000000000000000000000000000000000000000000000000000060808201527f000000000000000000000000000000000000000000000000000000000000000060a08201527f000000000000000000000000000000000000000000000000000000000000000060c08201527f000000000000000000000000000000000000000000000000000000000000000060e082015290565b604051806101000160405280600890602082028036833750919291505056fea26469706673582212207f60bbf18967ee4d8bdc3a4caec91c130c7c67c8184f7513537c2c9d1733ddd864736f6c634300060c0033";