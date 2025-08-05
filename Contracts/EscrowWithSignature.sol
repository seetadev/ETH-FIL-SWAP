// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title EscrowWithSignature
 * @dev This contract facilitates gas-less swaps. The maker signs a swap message off-chain,
 * and a third-party taker/resolver can execute it on their behalf.
 * The core security relies on the EIP-712 standard for typed data signing.
 */
contract EscrowWithSignature is EIP712 {
    /**
     * @dev The Swap struct defines the data that the maker will sign.
     * It must match the structure defined in the off-chain signing script.
     */
    struct Swap {
        address initiator; // The user who wants to make the swap (the "maker")
        address recipient; // The user who will receive the tokens (the "taker")
        address token;     // The ERC20 token to be swapped
        uint256 amount;    // The amount of the token to be swapped
        uint256 timelock;  // A deadline for the swap to be executed
    }

    // A mapping to prevent the same signature from being used twice (replay attack).
    // The key is the EIP-712 hash of the Swap data.
    mapping(bytes32 => bool) public executedSwaps;

    event SwapExecuted(bytes32 indexed swapId, address indexed initiator, address indexed recipient, address token, uint256 amount);

    /**
     * @dev The constructor sets up the EIP-712 domain separator.
     * This is crucial for signature verification and prevents replay attacks across different contracts.
     * The name "Escrow" and "1" should match the domain data in the off-chain script.
     */
    constructor() EIP712("Escrow", "1") {}

    /**
     * @dev Executes a swap using a maker's signature.
     * This function is called by the taker/resolver, who pays the gas fee.
     * @param swap The struct containing all the data for the swap.
     * @param signature The EIP-712 signature from the maker.
     */
    function execute(Swap calldata swap, bytes calldata signature) external {
        require(block.timestamp < swap.timelock, "Swap timelock expired");

        // 1. Hash the swap data struct to get the unique identifier for this swap.
        bytes32 swapId = _hashTypedDataV4(keccak256(abi.encode(
            keccak256("Swap(address initiator,address recipient,address token,uint256 amount,uint256 timelock)"),
            swap.initiator,
            swap.recipient,
            swap.token,
            swap.amount,
            swap.timelock
        )));

        require(!executedSwaps[swapId], "Swap already executed");

        // 2. Recover the signer's address from the signature and the hash.
        address signer = ECDSA.recover(swapId, signature);
        require(signer != address(0), "Invalid signature");

        // 3. Authorize: Ensure the person who signed the message is the one initiating the swap.
        require(signer == swap.initiator, "Signer is not the initiator");

        // 4. Mark the swap as executed to prevent replay.
        executedSwaps[swapId] = true;

        // 5. Execute the token transfer. This requires the `swap.initiator` to have
        // previously called `approve()` on the token contract, giving this Escrow
        // contract the permission to spend tokens on their behalf.
        IERC20(swap.token).transferFrom(swap.initiator, swap.recipient, swap.amount);

        emit SwapExecuted(swapId, swap.initiator, swap.recipient, swap.token, swap.amount);
    }
}
