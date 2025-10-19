
import React, { useState, useEffect } from 'react';
import { Button } from 'react-bootstrap';
import { ethers } from 'ethers';
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

const TakerView = ({ auction, contractChainA, contractChainB, contractChainAWithSigner, contractChainBWithSigner, account, signer }) => {
    const [secret, setSecret] = useState('');
    const [hashedSecret, setHashedSecret] = useState('');
    const [swapId, setSwapId] = useState('');
    const [swapState, setSwapState] = useState('Not Started');

    // Taker initiates swap on Chain B
    const initiateOnChainB = async () => {
        const tokenBContract = new ethers.Contract(auction.tokenB, erc20.abi, signer);
        const approveTx = await tokenBContract.approve(CHAIN_B_CONFIG.escrowAddress, auction.highestBid);
        await approveTx.wait();

        const timelock = Math.floor(Date.now() / 1000) + 3500; // Slightly shorter
        const tx = await contractChainBWithSigner.initiate(
            swapId,
            auction.maker,
            auction.tokenB,
            auction.highestBid,
            hashedSecret, // Must be the same hash
            timelock
        );
        await tx.wait();
        setSwapState('Initiated on Chain B');
    };

    // Taker claims funds from Chain A
    const claimOnChainA = async () => {
        const tx = await contractChainAWithSigner.claim(swapId, secret);
        await tx.wait();
        setSwapState('Claimed on Chain A');
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
                console.log("ContractChainA:", contractChainA);
                console.log("contractChainA runner:", contractChainA.runner);
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
                        if (swapDetails.recipient.toLowerCase() === account.toLowerCase()) {
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
                const fromBlockB = Math.max(latestBlockB - 1000, 0);
    
                console.log("Fetching past events for swapId:", currentSwapId);
                try {
                    const claimedBFilter = contractChainB.filters.SwapClaimed(currentSwapId);
                    const claimedBEvents = await contractChainB.queryFilter(claimedBFilter, fromBlockB, latestBlockB);
                    if (claimedBEvents.length > 0) {
                        console.log("Found past SwapClaimed event on Chain B:", claimedBEvents[0]);
                        setSecret(claimedBEvents[0].args.secret);
                        setSwapState('Claimed on Chain B');
                        const swapDetailsB = await contractChainB.swaps(currentSwapId);
                        setHashedSecret(swapDetailsB.hashedSecret);
                        return; // Stop checking further
                    }
                } catch (error) {
                    console.error("Error checking SwapClaimed on Chain B:", error);
                }
    
                console.log("Fetching function ended")
            } catch (error) {
                console.error("Error fetching past state:", error);
            }
        };

    return (
        <div>
            <h6>Taker's Steps:</h6>
            <p>Your Role: Taker</p>
            <p><strong>Status:</strong> {swapState}</p>

            {swapState === 'Not Started' && <p>Waiting for Maker to initiate the swap on {CHAIN_A_CONFIG.name}...</p>}

            {hashedSecret && <p className="mt-2 text-break"><strong>Hashed Secret:</strong> {hashedSecret}</p>}

            <Button onClick={initiateOnChainB} disabled={swapState !== 'Initiated on Chain A'}>
                2. Initiate Swap on {CHAIN_B_CONFIG.name}
            </Button>
            <hr/>
            {secret && <p className="mt-2 text-break"><strong>Revealed Secret:</strong> {secret}</p>}
            <Button onClick={claimOnChainA} disabled={swapState !== 'Claimed on Chain B'}>
                3. Claim Tokens from {CHAIN_A_CONFIG.name}
            </Button>
        </div>
    );
};

export default TakerView;
