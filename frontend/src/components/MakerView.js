
import React, { useState, useEffect } from 'react';
import { Button, Form } from 'react-bootstrap';
import { ethers, parseEther } from 'ethers';
import erc20 from '../Erc20.json';

const CHAIN_A_CONFIG = {
    name: "Sepolia",
    escrowAddress: "0xDDF9D2f8B1a4674752630efD74F062720d319149",
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
};

const CHAIN_B_CONFIG = {
    name: "Filecoin Calibration",
    escrowAddress: "0x9a09103d9dF6d2C6a9DAd7e188AC45Ae11e19beb",
    rpcUrl: "https://rpc.ankr.com/filecoin_testnet",
};

const MakerView = ({ auction, contractChainAWithSigner, contractChainB, contractChainA, contractChainBWithSigner, account , signer}) => {
    const [secret, setSecret] = useState('');
    const [hashedSecret, setHashedSecret] = useState('');
    const [swapId, setSwapId] = useState('');
    const [swapState, setSwapState] = useState('Not Started');

    // Main logic to generate secret
    const generateSecretAndHash = () => {
        const newSecret = ethers.randomBytes(32);
        console.log("Generated Secret (bytes):", newSecret);
        const newHashedSecret = ethers.sha256(newSecret);

        setSecret(ethers.hexlify(newSecret));
        setHashedSecret(newHashedSecret);
        console.log("Hashed Secret:", newHashedSecret);
        setSwapId(ethers.zeroPadValue(ethers.toBeHex(auction.id), 32)); // Using auctionId as swapId
        setSwapState('Secret Generated');
    };

    // Maker initiates swap on Chain A
    const initiateOnChainA = async () => {
        const tokenAContract = new ethers.Contract(auction.tokenA, erc20.abi, signer);
        console.log("Approving tokens on Chain A");
        console.log("TokenA Contract:", tokenAContract);
        const approveTx = await tokenAContract.approve(CHAIN_A_CONFIG.escrowAddress, auction.amountA);
        console.log("Approve transaction sent:", approveTx);
        await approveTx.wait();
        console.log("Approved tokens on Chain A");
        const timelock = Math.floor(Date.now() / 1000) + 3600; // 1 hour
        console.log("Initiating swap on Chain A with swapId:", swapId);
        console.log("Hashed Secret:", hashedSecret);
        console.log("Auction Highest Bidder:", auction.highestBidder);
        console.log("Auction Token A:", auction.tokenA);
        console.log("Timelock:", timelock);
        console.log("Auction Amount A:", auction.amountA.toString());
        const tx = await contractChainAWithSigner.initiate(
            swapId,
            auction.highestBidder,
            auction.tokenA,
            auction.amountA,
            hashedSecret,
            timelock
        );
        await tx.wait();
        setSwapState('Initiated on Chain A');
    };

    // Maker claims funds from Chain B
    const claimOnChainB = async () => {
        const tx = await contractChainBWithSigner.claim(swapId, secret);
        await tx.wait();
        setSwapState('Claimed on Chain B');
    };

    useEffect(() => {
        if (auction && auction.id && contractChainA && contractChainB && account) {
            const currentSwapId = ethers.zeroPadValue(ethers.toBeHex(auction.id), 32);
            setSwapId(currentSwapId);
            fetchPastState(currentSwapId);
        }
    }, [auction, contractChainA, contractChainB, account]);

    // 2. Define an async function to fetch past events
    const fetchPastState = async (currentSwapId) => {
        if (!currentSwapId || currentSwapId === ethers.ZeroHash) {
            return;
        }
        try {
            const latestBlock = await contractChainA.runner.getBlockNumber();
            console.log("Latest Block Number:", latestBlock);
            const fromBlock = Math.max(latestBlock - 10000, 0); // last 1000 blocks

            try{
                // Check if Maker has initiated on Chain A
                console.log("ContractChainA:", contractChainA);
                const initiatedAFilter = contractChainA.filters.SwapInitiated(currentSwapId);
                console.log("initiatedAFilter:", initiatedAFilter);
                console.log("current SwapId:", currentSwapId);
                const initiatedAEvents = await contractChainA.queryFilter(initiatedAFilter, fromBlock, latestBlock);
                console.log("initiatedAEvents:", initiatedAEvents);
                console.log("from block:", fromBlock, "to latestBlock:", latestBlock);
                if (initiatedAEvents.length > 0) {
                    console.log("Found past SwapInitiated event on Chain A:", initiatedAEvents[0]);
                    const swapDetails = await contractChainA.swaps(currentSwapId);
                    if (swapDetails.initiator.toLowerCase() === account.toLowerCase()) {
                        setHashedSecret(swapDetails.hashedSecret);
                        setSwapState('None');
                    }
                }
            }
            catch (error) {
                console.error("Error checking SwapInitiated on Chain A:", error);
            }

    
            console.log("ContractChainB:", contractChainB);
            console.log("contractChainB runner:", contractChainB.runner);
            const latestBlockB = await contractChainB.runner.getBlockNumber();
            console.log("Latest Block B Number:", latestBlockB);
            const fromBlockB = Math.max(latestBlockB - 1000, 0); // last 1000 blocks

            try{
                // Check if Maker has initiated on Chain A
                console.log("ContractChainB:", contractChainB);
                const initiatedBFilter = contractChainB.filters.SwapInitiated(currentSwapId);
                console.log("initiatedBFilter:", initiatedBFilter);
                console.log("current SwapId:", currentSwapId);
                const initiatedBEvents = await contractChainB.queryFilter(initiatedBFilter, fromBlockB, latestBlockB);
                console.log("initiatedBEvents:", initiatedBEvents);
                console.log("from block:", fromBlockB, "to latestBlock:", latestBlockB);
                if (initiatedBEvents.length > 0) {
                    console.log("Found past SwapInitiated event on Chain B:", initiatedBEvents[0]);
                    const swapDetails = await contractChainB.swaps(currentSwapId);
                    if (swapDetails.recipient.toLowerCase() === account.toLowerCase()) {
                        setHashedSecret(swapDetails.hashedSecret);
                        setSwapState('Initiated on Chain B');
                    }
                }
            }
            catch (error) {
                console.error("Error checking SwapInitiated on Chain B:", error);
            }


            console.log("Fetching function ended")
        } catch (error) {
            console.error("Error fetching past state:", error);
        }
    };

    return (
        <div>
            <h6>Maker's Steps:</h6>
            <p>Your Role: Maker</p>
            <p><strong>Status:</strong> {swapState}</p>

            <Button onClick={generateSecretAndHash} disabled={swapState !== 'Not Started'}>
                1. Generate Secret
            </Button>
            {secret && <p className="mt-2 text-break"><strong>Secret:</strong> {secret} (Keep this safe!)</p>}
            <hr/>
            <Button onClick={initiateOnChainA} disabled={swapState !== 'Secret Generated'}>
                2. Initiate Swap on {CHAIN_A_CONFIG.name}
            </Button>
            <hr/>
            <Form.Group>
                <Form.Label>Secret</Form.Label>
                <Form.Control 
                    type="text" 
                    placeholder="Enter secret to claim" 
                    value={secret} 
                    onChange={(e) => setSecret(e.target.value)} 
                />
            </Form.Group>
            <Button onClick={claimOnChainB} disabled={swapState !== 'Initiated on Chain B'} className="mt-2">
                3. Claim Tokens from {CHAIN_B_CONFIG.name}
            </Button>
        </div>
    );
};

export default MakerView;
