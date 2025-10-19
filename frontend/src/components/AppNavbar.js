
import React from 'react';
import { Navbar, Nav, Button } from 'react-bootstrap';

const AppNavbar = ({ account, network, connectWallet, disconnectWallet }) => {

    return (
        <Navbar bg="dark" variant="dark" expand="lg">
            <Navbar.Brand href="#home">ETH-FIL Swap</Navbar.Brand>
            <Navbar.Toggle aria-controls="basic-navbar-nav" />
            <Navbar.Collapse id="basic-navbar-nav">
                <Nav className="mr-auto">
                </Nav>
                <Nav>
                    {account ? (
                        <>
                            <Navbar.Text>
                                Signed in as: {account.substring(0, 6)}...{account.substring(account.length - 4)} ({network})
                            </Navbar.Text>
                            <Button variant="outline-light" onClick={disconnectWallet} style={{marginLeft: '10px'}}>Disconnect</Button>
                        </>
                    ) : (
                        <Button variant="outline-light" onClick={connectWallet}>Connect Wallet</Button>
                    )}
                </Nav>
            </Navbar.Collapse>
        </Navbar>
    );
};

export default AppNavbar;
