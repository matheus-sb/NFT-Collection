import Head from 'next/head'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import Web3Modal from 'web3modal';
import { Contract, providers, utils } from 'ethers';
import styles from '../styles/Home.module.css'
import { NFT_CONTRACT_ADDRESS, abi } from '../constants';

export default function Home() {

  const [ walletConnected, setWalletConnected ] = useState(false);

  const [ presaleStarted, setPresaleStarted ] = useState(false);

  const [presaleEnded, setPresaleEnded ] = useState(false);

  const [ isOwner, setIsOwner ] = useState(false);

  const [tokenIdsMinted, setTokenIdsMinted] = useState('0');

  const [loading, setLoading] = useState(false);

  const web3ModalRef = useRef();

  const getProviderOrSigner = async (needSigner = false) => {
    // Connect to Metamask
    // Since we store `web3Modal` as a reference, we need to access the `current` value to get access to the underlying object
    const provider = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);

    // If user is not connected to the Rinkeby network, let them know and throw an error
    const { chainId } = await web3Provider.getNetwork();
    
    if (chainId !== 4) {
      window.alert('Change the network to Rinkeby');
      throw new Error('Change the network to Rinkeby');
    }

    if (needSigner) {
      return web3Provider.getSigner()
    }

    return web3Provider;
  }

  const connectWallet = async () => {
    try {

      await getProviderOrSigner();
      setWalletConnected(true);
    } catch (error) {
      console.error(error);
    }
  }

  const getNFTContract = async (needSigner = false) => {
    const providerOrSigner = await getProviderOrSigner(needSigner);
    // We connect to the Contract using a Provider, so we will only
    // have read-only access to the Contract
    return new Contract(NFT_CONTRACT_ADDRESS, abi, providerOrSigner);
  }

  /**
  * checkIfPresaleStarted: checks if the presale has started by quering the `presaleStarted`
  * variable in the contract
  */
  const checkIfPresaleStarted = async (nftContract) => {
    hasNftContract(nftContract);
    try {
      // call the presaleStarted from the contract
      const _presaleStarted = await nftContract.presaleStarted();

      setPresaleStarted(_presaleStarted);

      return _presaleStarted;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const hasNftContract = (nftContract) => {
    if (!nftContract) {
      throw new Error('Missing nftContract');
    }
  }

  const checkIfPresaleEnded = async (nftContract) => {
    hasNftContract(nftContract);

    try {
      const _presaleEnded = await nftContract.presaleEnded();
      // _presaleEnded is a Big Number, so we are using the lt(less than function) instead of `<`
      // Date.now()/1000 returns the current time in seconds
      // We compare if the _presaleEnded timestamp is less than the current time
      // which means presale has ended
      const hasEnded = _presaleEnded.lt(Math.floor(Date.now() / 1000));
  
      setPresaleEnded(hasEnded);
      return hasEnded;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  const checkIfItIsTheOwner = async (nftContract) => {
    hasNftContract(nftContract);

    try {
      // call the owner function from the contract
      const _owner = await nftContract.owner();
      // We will get the signer now to extract the address of the currently connected MetaMask account
      const signer = await getProviderOrSigner(true);
      // Get the address associated to the signer which is connected to  MetaMask
      const address = await signer.getAddress();
      const _isOwner = address.toLowerCase() === _owner.toLowerCase();

      setIsOwner(_isOwner);
      return _isOwner;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

    /**
   * getTokenIdsMinted: gets the number of tokenIds that have been minted
   */
  const getTokenIdsMinted = async (nftContract) => {
    hasNftContract(nftContract);

    try {
      // call the tokenIds from the contract
      const _tokenIds = await nftContract.tokenIds();
      //_tokenIds is a `Big Number`. We need to convert the Big Number to a string
      setTokenIdsMinted(_tokenIds.toString());
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * startPresale: starts the presale for the NFT Collection
   */
  const startPresale = async () => {
    try {
      const whitelistContract = await getNFTContract(true);
      // call the startPresale from the contract
      const tx = await whitelistContract.startPresale();
      setLoading(true);
      // wait for the transaction to get mined
      await tx.wait();
      setLoading(false);
      // set the presale started to true
      await checkIfPresaleStarted(whitelistContract);
    } catch (err) {
      console.error(err);
    }
  };

    /**
   * mint: Mint an NFT during and after the presale
   */
  const mint = async (presaleMint = false) => {
    try {
      const whitelistContract = await getNFTContract(true);

      // if presaleMint then only whitelisted addresses would be able to mint
      const mint = presaleMint ? whitelistContract.presaleMint : whitelistContract.mint;

      const tx = await mint({
        // value signifies the cost of one crypto dev which is "0.01" eth.
        // We are parsing `0.01` string to ether using the utils library from ethers.js
        value: utils.parseEther("0.01"),
      });
      setLoading(true);
      // wait for the transaction to get mined
      await tx.wait();
      setLoading(false);
      window.alert("You successfully minted a Crypto Dev!");
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (walletConnected) {
      return;
    }

    web3ModalRef.current = new Web3Modal({
      network: 'rinkeby',
      providerOptions: {},
      disableInjectedProvider: false
    });

    connectWallet();

    let presaleEndedInterval;
    let tokenIDsMintedInterval;

    getNFTContract().then(async (nftContract) => {
      const _presaleStarted = await checkIfPresaleStarted(nftContract);
      
      if (_presaleStarted) { 
        checkIfPresaleEnded(nftContract);
      } else {
        checkIfItIsTheOwner(nftContract);
      }
  
      getTokenIdsMinted(nftContract);
  
      // Set an interval which gets called every 5 seconds to check presale has ended
      presaleEndedInterval = setInterval(async () => {
        const _presaleStarted = await checkIfPresaleStarted(nftContract);
        if (_presaleStarted) {
          const _presaleEnded = await checkIfPresaleEnded(nftContract);
          if (_presaleEnded) {
            clearInterval(presaleEndedInterval);
          }
        }
      }, 5 * 1000);
  
      // set an interval to get the number of token Ids minted every 5 seconds
      tokenIDsMintedInterval = setInterval(async () => {
        await getTokenIdsMinted(nftContract);
      }, 5 * 1000);
     });

    return () => {
      if (presaleEndedInterval) {
        clearInterval(presaleEndedInterval);
      }
      if (tokenIDsMintedInterval) {
        clearInterval(tokenIDsMintedInterval);
      }
    }
  }, [walletConnected]);

  /*
    renderButton: Returns a button based on the state of the dapp
  */
  const renderButton = () => {
    // If wallet is not connected, return a button which allows them to connect their wllet
    if (!walletConnected) {
      return (
        <button onClick={connectWallet} className={styles.button}>
          Connect your wallet
        </button>
      );
    }

    // If we are currently waiting for something, return a loading button
    if (loading) {
      return <button className={styles.button}>Loading...</button>;
    }

    // If connected user is the owner, and presale hasnt started yet, allow them to start the presale
    if (isOwner && !presaleStarted) {
      return (
        <button className={styles.button} onClick={startPresale}>
          Start Presale!
        </button>
      );
    }

    // If connected user is not the owner but presale hasn't started yet, tell them that
    if (!presaleStarted) {
      return (
        <div>
          <div className={styles.description}>Presale hasnt started!</div>
        </div>
      );
    }

    // If presale started, but hasn't ended yet, allow for minting during the presale period
    if (presaleStarted && !presaleEnded) {
      return (
        <div>
          <div className={styles.description}>
            Presale has started!!! If your address is whitelisted, Mint a
            Crypto Dev 🚀
          </div>
          <button className={styles.button} onClick={() => mint(true)}>
            Presale Mint 🚀
          </button>
        </div>
      );
    }

    // If presale started and has ended, its time for public minting
    if (presaleStarted && presaleEnded) {
      return (
        <button className={styles.button} onClick={() => mint()}>
          Public Mint 🚀
        </button>
      );
    }
  };

  return (
    <div>
      <Head>
        <title>Crypto Devs</title>
        <meta name="description" content="Whitelist-Dapp" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Welcome to Crypto Devs!</h1>
          <div className={styles.description}>
            Its an NFT collection for developers in Crypto.
          </div>
          <div className={styles.description}>
            {tokenIdsMinted}/20 have been minted
          </div>
          {renderButton()}
        </div>
        <div>
          <img className={styles.image} src="./cryptodevs/0.svg" />
        </div>
      </div>

      <footer className={styles.footer}>
        Made with &#10084; by Crypto Devs
      </footer>
    </div>
  );
}
