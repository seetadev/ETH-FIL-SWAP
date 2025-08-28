
import React, { useState } from 'react';
import { Navbar, Nav, Button } from 'react-bootstrap';
import { ethers } from 'ethers';

const AppNavbar = () => {
    const [account, setAccount] = useState(null);
    const [network, setNetwork] = useState(null);

    const connectWallet = async () => {
        if (window.ethereum) {
            try {
                const provider = new ethers.BrowserProvider(window.ethereum)
                await provider.send("eth_requestAccounts", []);
                const signer =await provider.getSigner();
                // console.log("Signer:", signer);
                const address = await signer.getAddress();
                // console.log("Connected to wallet:", address);
                setAccount(address);
                const network = await provider.getNetwork();
                setNetwork(network.name);
            } catch (error) {
                console.error("Error connecting to wallet:", error);
            }
        } else {
            alert("Please install MetaMask!");
        }
    };

    return (
        <Navbar bg="dark" variant="dark" expand="lg">
            <Navbar.Brand href="#home">ETH-FIL Swap</Navbar.Brand>
            <Navbar.Toggle aria-controls="basic-navbar-nav" />
            <Navbar.Collapse id="basic-navbar-nav">
                <Nav className="mr-auto">
                </Nav>
                <Nav>
                    {account ? (
                        <Navbar.Text>
                            Signed in as: {account.substring(0, 6)}...{account.substring(account.length - 4)} ({network})
                        </Navbar.Text>
                    ) : (
                        <Button variant="outline-light" onClick={connectWallet}>Connect Wallet</Button>
                    )}
                </Nav>
            </Navbar.Collapse>
        </Navbar>
    );
};

export default AppNavbar;
