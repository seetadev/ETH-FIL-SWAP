

import React, { useState, useEffect, useMemo } from 'react';
import { Card, Spinner, Alert } from 'react-bootstrap';
import { ethers } from 'ethers';
import escrowABI from '../Escrow.json';
import MakerView from './MakerView';
import TakerView from './TakerView';

// ============== CONFIGURATION ==================
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
// ===============================================

const CrossChainSwap = ({ auction, provider, signer, account }) => {
    const [userRole, setUserRole] = useState(null); // 'maker' or 'taker'
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [makerSwapState, setMakerSwapState] = useState('Not Started');
    const [takerSwapState, setTakerSwapState] = useState('Not Started');
    const [swapCompletionStatus, setSwapCompletionStatus] = useState('');

    // Setup providers and contracts for both chains
    const { contractChainA, contractChainB, contractChainAWithSigner, contractChainBWithSigner } = useMemo(() => {
        // Read-only providers for fetching data from either chain, regardless of wallet connection
        const provA = new ethers.JsonRpcProvider(CHAIN_A_CONFIG.rpcUrl);
        const provB = new ethers.JsonRpcProvider(CHAIN_B_CONFIG.rpcUrl);
        
        // Read-only contract instances
        const conA = new ethers.Contract(CHAIN_A_CONFIG.escrowAddress, escrowABI.abi, provA);
        const conB = new ethers.Contract(CHAIN_B_CONFIG.escrowAddress, escrowABI.abi, provB);

        let conAWithSigner = null;
        let conBWithSigner = null;
        if (signer) {
            // The signer from the wallet is connected to the currently active network.
            // We create contract instances for writing, connected to this signer.
            // The user must be on the correct network for these to work.
            conAWithSigner = new ethers.Contract(CHAIN_A_CONFIG.escrowAddress, escrowABI.abi, signer);
            conBWithSigner = new ethers.Contract(CHAIN_B_CONFIG.escrowAddress, escrowABI.abi, signer);
        }

        return { 
            contractChainA: conA, // Read-only instance for Chain A
            contractChainB: conB, // Read-only instance for Chain B
            contractChainAWithSigner: conAWithSigner, // Write instance for Chain A
            contractChainBWithSigner: conBWithSigner  // Write instance for Chain B
        };
    }, [signer]);

    // Determine user role
    useEffect(() => {
        if (account) {
            if (account.toLowerCase() === auction.maker.toLowerCase()) {
                setUserRole('maker');
            } else if (account.toLowerCase() === auction.highestBidder.toLowerCase()) {
                setUserRole('taker');
            }
        }
        console.log("Account:", account);
        console.log("Auction Maker:", auction.maker);
        console.log("Auction Taker:", auction.highestBidder);
        console.log("User Role:", userRole);
    }, [account, auction]);

    return (
        <Card className="mt-4">
            <Card.Header><h4>Cross-Chain Swap for Auction #{auction.id}</h4></Card.Header>
            <Card.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                {isLoading && <Spinner animation="border" />}

                <hr />

                <h5>Swap Details:</h5>
                <ul>
                    <li><strong>Maker ({CHAIN_A_CONFIG.name}):</strong> {auction.maker}</li>
                    <li><strong>Taker ({CHAIN_B_CONFIG.name}):</strong> {auction.highestBidder}</li>
                    <li><strong>Maker's Tokens:</strong> {ethers.formatEther(auction.amountA)} of {auction.tokenA}</li>
                    <li><strong>Taker's Tokens:</strong> {ethers.formatEther(auction.highestBid)} of {auction.tokenB}</li>
                </ul>

                <hr />
                {swapCompletionStatus === 'Swap Complete' ? (
                    <Alert variant="success">Swap Complete!</Alert>
                ) : (
                    <>
                        <h5>Actions:</h5>
                        {!userRole && <p>Connecting to wallet to determine your role...</p>}
                        {userRole === 'maker' && 
                            <MakerView 
                                auction={auction} 
                                contractChainAWithSigner={contractChainAWithSigner} 
                                contractChainB={contractChainB} 
                                contractChainA={contractChainA} 
                                contractChainBWithSigner={contractChainBWithSigner} 
                                account={account}
                                signer={signer}
                                swapState={makerSwapState}
                                setSwapState={setMakerSwapState}
                            />}
                        {userRole === 'taker' && 
                            <TakerView 
                                auction={auction} 
                                contractChainA={contractChainA} 
                                contractChainB={contractChainB} 
                                contractChainAWithSigner={contractChainAWithSigner} 
                                contractChainBWithSigner={contractChainBWithSigner} 
                                account={account}
                                signer={signer}
                                swapState={takerSwapState}
                                setSwapState={setTakerSwapState}
                            />}
                        {userRole && userRole !== 'maker' && userRole !== 'taker' && <p>You are not a participant in this swap.</p>}
                    </>
                )}

            </Card.Body>
        </Card>
    );
};

export default CrossChainSwap;