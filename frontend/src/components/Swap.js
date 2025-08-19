import React, { useState, useEffect } from 'react';
import { Form, Button, Card, ListGroup } from 'react-bootstrap';
import { ethers, parseEther,formatEther} from 'ethers';
import contractAddress from '../SwapAuction.json';

const CONTRACTADDRESS="0xF7015cC82A0980152521fc3B31A5bb267A625f35"
const Swap = () => {
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [contract, setContract] = useState(null);
    const [auctions, setAuctions] = useState([]);

    const [form, setForm] = useState({
        tokenA: '',
        amountA: '1',
        tokenB: '',
        minAmountB: '1',
        duration: ''
    });

    useEffect(() => {
        const init = async () => {
            if (window.ethereum) {
                const provider = new ethers.BrowserProvider(window.ethereum);
                console.log("Provider:", provider);
                setProvider(provider);
                const signer =await provider.getSigner();
                console.log("Signer:", signer);
                setSigner(signer);
                console.log("Contract Address:", CONTRACTADDRESS);
                console.log("Contract ABI:", contractAddress.abi);
                const contract = new ethers.Contract(CONTRACTADDRESS, contractAddress.abi, signer);
                console.log(contract);
                setContract(contract);
                await loadAuctions(contract);
            }
        };
        init();
    }, []);

    const loadAuctions = async (contract) => {
        const auctionCounter = await contract.auctionCounter();
        let auctions = [];
        for (let i = 1; i <= auctionCounter; i++) {
            const auction = await contract.auctions(i);
            // console.log("Auction while pushing:", auction);
            auctions.push({ id: i, ...auction });
        }
        setAuctions(auctions.filter(a => !a[8]));
    };

    const handleInputChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
    };

    const createAuction = async (e) => {
        e.preventDefault();
        if (contract) {
            try {
                console.log("create Auction")
                const tx = await contract.createAuction(
                    form.tokenA,
                    parseEther(form.amountA.toString()),
                    form.tokenB,
                    parseEther(form.minAmountB.toString()),
                    form.duration
                );
                await tx.wait();
                console.log(tx);
                await loadAuctions(contract);
            } catch (error) {
                console.error("Error creating auction:", error);
            }
        }
    };

    const bid = async (auctionId, amount) => {
        if(contract) {
            try {
                const tx = await contract.bid(auctionId,parseEther(amount));
                await tx.wait();
                loadAuctions(contract);
            } catch (error) {
                console.error(error);
            }
        }
    }

    const endAuction = async (auctionId) => {
        if(contract) {
            try {
                const tx = await contract.endAuction(auctionId);
                await tx.wait();
                loadAuctions(contract);
            } catch (error) {
                console.error("Error ending auction:", error);
            }
        }
    }


    return (
        <div className="container mt-5">
            <Card>
                <Card.Header>Create Swap Auction</Card.Header>
                <Card.Body>
                    <Form onSubmit={createAuction}>
                        <Form.Group className="mb-3">
                            <Form.Label>Token to Sell (Address)</Form.Label>
                            <Form.Control type="text" name="tokenA" placeholder="0x..." onChange={handleInputChange} value={form.tokenA} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Amount to Sell</Form.Label>
                            <Form.Control type="text" name="amountA" placeholder="1.0" onChange={handleInputChange} value={form.amountA} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Token to Buy (Address)</Form.Label>
                            <Form.Control type="text" name="tokenB" placeholder="0x..." onChange={handleInputChange} value={form.tokenB} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Minimum Amount to Buy</Form.Label>
                            <Form.Control type="text" name="minAmountB" placeholder="0.5" onChange={handleInputChange} value={form.minAmountB} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Auction Duration (seconds)</Form.Label>
                            <Form.Control type="text" name="duration" placeholder="3600" onChange={handleInputChange} value={form.duration} />
                        </Form.Group>
                        <Button variant="primary" type="submit">Create Auction</Button>
                    </Form>
                </Card.Body>
            </Card>

            <h2 className="mt-5">Active Auctions</h2>
            <ListGroup>
                {auctions.map(auction => (
                    console.log("auctioin   :", auction),
                    <ListGroup.Item key={auction.id}>
                        <h5>Auction #{auction.id}</h5>
                        <p>Maker: {auction[0]}</p>
                        <p>Selling: {formatEther(auction[2])} of {auction[2]}</p>
                        <p>Buying: at least { formatEther(auction[4])} of {auction[3]}</p>
                        <p>Highest Bid: { formatEther(auction[7])} by {auction[6]}</p>
                        <p>End Time: {new Date(Number(auction[5]) * 1000).toLocaleString()}</p>
                        <Form onSubmit={(e) => { e.preventDefault(); bid(auction.id, e.target.elements.bidAmount.value); }}>
                            <Form.Group className="mb-3">
                                <Form.Control type="text" name="bidAmount" placeholder="Enter your bid" />
                            </Form.Group>
                            <Button variant="success" type="submit">Bid</Button>
                        </Form>
                        <Button className="mt-2" variant="danger" onClick={() => endAuction(auction.id)}>End Auction</Button>
                    </ListGroup.Item>
                ))}
            </ListGroup>
        </div>
    );
};

export default Swap;