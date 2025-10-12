import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Spinner, Alert, Form } from 'react-bootstrap';
import { ethers } from 'ethers';
import escrowABI from '../Escrow.json'; // Using the correct ABI

// ============== CONFIGURATION ==================
const CHAIN_A_CONFIG = {
    name: "Sepolia",
    escrowAddress: "0x3B469d926876f10cA002E5Cf20776745aAcDFd3A",
    rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/U-GVSL9PaqaHm-FZCJ4cZ_JI55R66lYm",
};

const CHAIN_B_CONFIG = {
    name: "Filecoin Calibration",
    escrowAddress: "0x6A6D7a69A302Ca8B41D7D00eD7019997854F587B",
    rpcUrl: "https://rpc.ankr.com/filecoin_testnet",
};
// ===============================================

const CrossChainSwap = ({ auction, provider, signer }) => {
    const [userRole, setUserRole] = useState(null); // 'maker' or 'taker'
    const [secret, setSecret] = useState('');
    const [hashedSecret, setHashedSecret] = useState('');
    const [swapState, setSwapState] = useState('Not Started'); // Overall status
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [takerHashedSecret, setTakerHashedSecret] = useState('');
    const [swapId, setSwapId] = useState('');

    // Setup providers and contracts for both chains
    const { contractChainA, contractChainB, contractChainAWithSigner, contractChainBWithSigner } = useMemo(() => {
        const provA = new ethers.JsonRpcProvider(CHAIN_A_CONFIG.rpcUrl);
        const provB = new ethers.JsonRpcProvider(CHAIN_B_CONFIG.rpcUrl);
        
        const conA = new ethers.Contract(CHAIN_A_CONFIG.escrowAddress, escrowABI.abi, provA);
        const conB = new ethers.Contract(CHAIN_B_CONFIG.escrowAddress, escrowABI.abi, provB);

        let conAWithSigner = null;
        let conBWithSigner = null;
        if (signer) {
            conAWithSigner = conA.connect(signer);
            conBWithSigner = conB.connect(signer);
        }

        return { 
            contractChainA: conA, 
            contractChainB: conB,
            contractChainAWithSigner: conAWithSigner,
            contractChainBWithSigner: conBWithSigner
        };
    }, [signer]);

    // Determine user role
    useEffect(() => {
        const checkUserRole = async () => {
            if (signer) {
                const userAddress = await signer.getAddress();
                if (userAddress.toLowerCase() === auction.maker.toLowerCase()) {
                    setUserRole('maker');
                } else if (userAddress.toLowerCase() === auction.highestBidder.toLowerCase()) {
                    setUserRole('taker');
                }
            }
        };
        checkUserRole();
    }, [signer, auction]);

    // Main logic to generate secret
    const generateSecretAndHash = () => {
        const newSecret = ethers.randomBytes(32);
        const newHashedSecret = ethers.sha256(newSecret);
        const newSwapId = newHashedSecret; // Using hashedSecret as swapId

        setSecret(ethers.hexlify(newSecret));
        setHashedSecret(newHashedSecret);
        setSwapId(newSwapId);
        setSwapState('Secret Generated');
        setError('');
    };

    // Maker initiates swap on Chain A
    const initiateOnChainA = async () => {
        if (!contractChainAWithSigner) {
            setError("Wallet not connected properly.");
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            // TODO: Ensure user is on Chain A network in their wallet
            // TODO: You might need to approve the token transfer first
            const timelock = Math.floor(Date.now() / 1000) + 3600; // 1 hour
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
        } catch (e) {
            setError(`Error on ${CHAIN_A_CONFIG.name}. Is your wallet on the correct network?`);
            console.error(e);
        }
        setIsLoading(false);
    };

    // Taker initiates swap on Chain B
    const initiateOnChainB = async () => {
        if (!contractChainBWithSigner) {
            setError("Wallet not connected properly.");
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            // TODO: Ensure user is on Chain B network in their wallet
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
        } catch (e) {
            setError(`Error on ${CHAIN_B_CONFIG.name}. Is your wallet on the correct network?`);
            console.error(e);
        }
        setIsLoading(false);
    };

    // Maker claims funds from Chain B
    const claimOnChainB = async () => {
        setIsLoading(true);
        setError('');
        try {
            // TODO: Ensure user is on Chain B network
            const tx = await contractChainBWithSigner.claim(swapId, secret);
            await tx.wait();
            setSwapState('Claimed on Chain B');
        } catch (e) {
            setError(`Error on ${CHAIN_B_CONFIG.name}.`);
            console.error(e);
        }
        setIsLoading(false);
    };

    // Taker claims funds from Chain A
    const claimOnChainA = async () => {
        setIsLoading(true);
        setError('');
        try {
            // TODO: Ensure user is on Chain A network
            const tx = await contractChainAWithSigner.claim(swapId, secret);
            await tx.wait();
            setSwapState('Claimed on Chain A');
        } catch (e) {
            setError(`Error on ${CHAIN_A_CONFIG.name}.`);
            console.error(e);
        }
        setIsLoading(false);
    };

    // --- Event Listeners ---
    useEffect(() => {
        if (!swapId) return;

        const onInitiateA = (initiatedSwapId) => {
            if (initiatedSwapId === swapId) {
                console.log(`Initiation detected on ${CHAIN_A_CONFIG.name} for swap ${swapId}`);
                setSwapState('Initiated on Chain A');
            }
        };
        const onInitiateB = (initiatedSwapId) => {
            if (initiatedSwapId === swapId) {
                console.log(`Initiation detected on ${CHAIN_B_CONFIG.name} for swap ${swapId}`);
                setSwapState('Initiated on Chain B');
            }
        };
        const onClaimB = (claimedSwapId) => {
            if (claimedSwapId === swapId) {
                console.log(`Claim detected on ${CHAIN_B_CONFIG.name}.`);
                setSwapState('Claimed on Chain B');
            }
        };
        const onClaimA = (claimedSwapId) => {
            if (claimedSwapId === swapId) {
                console.log(`Claim detected on ${CHAIN_A_CONFIG.name}. Swap complete!`);
                setSwapState('Claimed on Chain A');
            }
        };

        // Subscribe
        contractChainA.on('SwapInitiated', onInitiateA);
        contractChainB.on('SwapInitiated', onInitiateB);
        contractChainB.on('SwapClaimed', onClaimB);
        contractChainA.on('SwapClaimed', onClaimA);

        // Unsubscribe on cleanup
        return () => {
            contractChainA.removeAllListeners('SwapInitiated');
            contractChainB.removeAllListeners('SwapInitiated');
            contractChainB.removeAllListeners('SwapClaimed');
            contractChainA.removeAllListeners('SwapClaimed');
        };
    }, [swapId, contractChainA, contractChainB]);


    // --- UI Rendering ---
    const renderMakerActions = () => (
        <div>
            <h6>Maker's Steps:</h6>
            <p>Your Role: Maker</p>
            <Button onClick={generateSecretAndHash} disabled={swapState !== 'Not Started'}>
                1. Generate Secret
            </Button>
            {secret && <p className="mt-2 text-break"><strong>Secret:</strong> {secret} (Keep this safe!)</p>}
            <hr/>
            <Button onClick={initiateOnChainA} disabled={swapState !== 'Secret Generated'}>
                2. Initiate Swap on {CHAIN_A_CONFIG.name}
            </Button>
            <hr/>
            <Button onClick={claimOnChainB} disabled={swapState !== 'Initiated on Chain B'}>
                3. Claim Tokens from {CHAIN_B_CONFIG.name}
            </Button>
        </div>
    );

    const renderTakerActions = () => {
        

        const startMonitoring = (e) => {
            e.preventDefault();
            setHashedSecret(takerHashedSecret);
            setSwapId(takerHashedSecret); // Set swapId to start listeners
            setError('');
        }

        return (
            <div>
                <h6>Taker's Steps:</h6>
                <p>Your Role: Taker</p>
                <Form onSubmit={startMonitoring}>
                    <Form.Group className="mb-3">
                        <Form.Label>Enter Hashed Secret from Maker:</Form.Label>
                        <Form.Control 
                            type="text" 
                            placeholder="0x..." 
                            value={takerHashedSecret}
                            onChange={(e) => setTakerHashedSecret(e.target.value)}
                        />
                    </Form.Group>
                    <Button type="submit" disabled={!takerHashedSecret || swapId !== ''}>
                        1. Monitor Swap
                    </Button>
                </Form>
                <hr/>
                <Button onClick={initiateOnChainB} disabled={swapState !== 'Initiated on Chain A'}>
                    2. Initiate Swap on {CHAIN_B_CONFIG.name}
                </Button>
                <hr/>
                <Button onClick={claimOnChainA} disabled={swapState !== 'Claimed on Chain B'}>
                    3. Claim Tokens from {CHAIN_A_CONFIG.name}
                </Button>
            </div>
        );
    }

    return (
        <Card className="mt-4">
            <Card.Header><h4>Cross-Chain Swap for Auction #{auction.id}</h4></Card.Header>
            <Card.Body>
                <p><strong>Status:</strong> {swapState}</p>
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

                <h5>Actions:</h5>
                {!userRole && <p>Connecting to wallet to determine your role...</p>}
                {userRole === 'maker' && renderMakerActions()}
                {userRole === 'taker' && renderTakerActions()}
                {userRole && userRole !== 'maker' && userRole !== 'taker' && <p>You are not a participant in this swap.</p>}

            </Card.Body>
        </Card>
    );
};

export default CrossChainSwap;
