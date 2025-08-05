// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title CrossChainHashedEscrow
 * @dev This contract facilitates cross-chain atomic swaps using a Hashed Timelock Contract (HTLC) pattern.
 * It is designed to be deployed on two different chains to enable a trustless exchange of assets.
 * The process is initiated by a taker executing a maker's signed off-chain order.
 */
contract CrossChainHashedEscrow is EIP712 {

    enum HtlcStatus { Empty, Locked, Claimed, Refunded }

    struct Htlc {
        address initiator;      // The address that locked the funds
        address recipient;      // The address that can claim the funds
        address token;          // The ERC20 token locked in the escrow
        uint256 amount;         // The amount of tokens locked
        bytes32 hashedSecret;   // The hash of the secret key
        uint256 timelock;       // The timestamp after which funds can be refunded
        HtlcStatus status;      // The current status of the HTLC
    }

    struct SwapData {
        address initiator;      // The user who wants to make the swap (the "maker")
        address recipient;      // The user who will receive the tokens (the "taker")
        address token;          // The ERC20 token to be swapped
        uint256 amount;         // The amount of the token to be swapped
        bytes32 hashedSecret;   // The hash of the secret key, provided by the maker
        uint256 timelock;       // A deadline for the swap to be locked
    }

    mapping(bytes32 => Htlc) public swaps;

    event Locked(bytes32 indexed swapId, address indexed initiator, address indexed recipient, address token, uint256 amount);
    event Claimed(bytes32 indexed swapId, bytes32 secret);
    event Refunded(bytes32 indexed swapId);

    constructor() EIP712("CrossChainHashedEscrow", "1") {}

    /**
     * @dev Locks funds in the contract. This is called by the taker on behalf of the maker.
     * @param swap The struct containing all the data for the swap, signed by the maker.
     * @param signature The EIP-712 signature from the maker.
     */
    function lock(SwapData calldata swap, bytes calldata signature) external {
        require(block.timestamp < swap.timelock, "Swap lock deadline expired");

        bytes32 swapId = _getSwapId(swap);
        require(swaps[swapId].status == HtlcStatus.Empty, "Swap already initiated");

        address signer = _verifySignature(swapId, signature);
        require(signer == swap.initiator, "Invalid signature from maker");

        swaps[swapId] = Htlc({
            initiator: swap.initiator,
            recipient: swap.recipient,
            token: swap.token,
            amount: swap.amount,
            hashedSecret: swap.hashedSecret,
            timelock: block.timestamp + 24 hours, // Example: 24-hour refund timelock
            status: HtlcStatus.Locked
        });

        IERC20(swap.token).transferFrom(swap.initiator, address(this), swap.amount);
        emit Locked(swapId, swap.initiator, swap.recipient, swap.token, swap.amount);
    }

    /**
     * @dev Allows the recipient to claim the locked funds by providing the secret.
     * @param swapId The ID of the swap to claim.
     * @param secret The secret key that hashes to the stored hashedSecret.
     */
    function claim(bytes32 swapId, bytes32 secret) external {
        Htlc storage htlc = swaps[swapId];
        require(htlc.status == HtlcStatus.Locked, "Swap not in locked state");
        require(htlc.recipient == msg.sender, "Only recipient can claim");
        require(htlc.hashedSecret == sha256(abi.encodePacked(secret)), "Invalid secret");
        require(block.timestamp < htlc.timelock, "Timelock expired");

        htlc.status = HtlcStatus.Claimed;
        IERC20(htlc.token).transfer(htlc.recipient, htlc.amount);
        emit Claimed(swapId, secret);
    }

    /**
     * @dev Allows the initiator to get a refund if the swap was not claimed in time.
     * @param swapId The ID of the swap to refund.
     */
    function refund(bytes32 swapId) external {
        Htlc storage htlc = swaps[swapId];
        require(htlc.status == HtlcStatus.Locked, "Swap not in locked state");
        require(htlc.initiator == msg.sender, "Only initiator can refund");
        require(block.timestamp >= htlc.timelock, "Timelock not yet expired");

        htlc.status = HtlcStatus.Refunded;
        IERC20(htlc.token).transfer(htlc.initiator, htlc.amount);
        emit Refunded(swapId);
    }

    function _getSwapId(SwapData calldata swap) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            keccak256("SwapData(address initiator,address recipient,address token,uint256 amount,bytes32 hashedSecret,uint256 timelock)"),
            swap.initiator,
            swap.recipient,
            swap.token,
            swap.amount,
            swap.hashedSecret,
            swap.timelock
        )));
    }

    function _verifySignature(bytes32 digest, bytes calldata signature) internal view returns (address) {
        return ECDSA.recover(digest, signature);
    }
}
