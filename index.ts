import algosdk from "algosdk";
import { Magic, LoginWithMagicLinkConfiguration } from "magic-sdk";
import { AlgorandExtension } from "@magic-ext/algorand";

import { getNodeRounds, waitForConfirmation, sendTransaction } from "./utils";

// FIXME
const TEST_EMAIL = "YOUR_EMAIL";
const RPC_URL = "http://localhost:4001";
const MAGIC_PUBLIC_API_KEY = "pk_live_96A346FE8FC421C9";
const ALGOD_TOKEN =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ALGOD_SERVER = "http://localhost";
const ALGOD_PORT = 4001;
const DEV_CORS_PROXY_URL = "https://derisk-cors.herokuapp.com"; // ${DEV_CORS_PROXY_URL}/

// NOTE: WARNING DO NOT REUSE
const MOCK_ACCOUNT_1_MNEMONIC =
  "state educate north evolve bring crunch regular stove dress daring unusual print must tribe hedgehog piece few lion rib baby trust claw high able skin";
const MOCK_ACCOUNT_2_MNEMONIC =
  "genius inside turtle lock alone blame parent civil depend dinosaur tag fiction fun skill chief use damp daughter expose pioneer today weasel box about silly";
const MOCK_ACCOUNT_3_MNEMONIC =
  "off canyon mystery cable pluck emotion manual legal journey grit lunch include friend social monkey approve lava steel school mango auto cactus huge ability basket";

const magic = new Magic(MAGIC_PUBLIC_API_KEY, {
  extensions: {
    algorand: new AlgorandExtension({
      rpcUrl: RPC_URL,
    }),
  },
});

const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);

const mockAdminAccount = algosdk.mnemonicToSecretKey(MOCK_ACCOUNT_1_MNEMONIC);
const mockUser1Account = algosdk.mnemonicToSecretKey(MOCK_ACCOUNT_2_MNEMONIC);
const mockUser2Account = algosdk.mnemonicToSecretKey(MOCK_ACCOUNT_3_MNEMONIC);

let user;
let userWalletAddress;
let html;

const handleLogout = async () => {
  await magic.user.logout();
};

const handleLogin = async (e) => {
  e.preventDefault();

  const isLoggedIn = await magic.user.isLoggedIn();

  if (!isLoggedIn) {
    const redirectURI = `${window.location.origin}/callback`;

    const params: LoginWithMagicLinkConfiguration = {
      email: TEST_EMAIL,
      redirectURI,
    };
    await magic.auth.loginWithMagicLink(params);
  }

  const userMetadata = await magic.user.getMetadata();

  user = userMetadata;
  userWalletAddress = userMetadata.publicAddress;

  html = `
    <h2>Current user: ${user.email}</h2>
    <h2>Algo Wallet: ${userWalletAddress}</h2>
    <button onclick="handleLogout">Logout</button>
  `;

  document.getElementById("app").innerHTML = html;
};

const simpleTx = async (e) => {
  const { currentRound, lastRound } = await getNodeRounds(algodClient);

  console.log("Receiver address: %s", mockAdminAccount.addr);

  const enc = new TextEncoder();
  let note = enc.encode("Simple Tx");

  const txn = {
    to: mockAdminAccount.addr,
    fee: 10,
    amount: 10e5,
    firstRound: currentRound,
    lastRound: lastRound,
    genesisID: "testnet-v1.0",
    genesisHash: "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
    note: note,
  };

  const tx = await magic.algorand.signTransaction(txn);
  console.log("signed transaction", tx);
  console.log("currentRound", currentRound);
  console.log("endRound", lastRound);

  let txId = tx.txID;
  console.log("Before Send raw tx", txId);
  await algodClient.sendRawTransaction(tx.blob).do();
  console.log("Sent raw tx");
  let confirmedTxn = await waitForConfirmation(algodClient, txId, 4);
  console.log("Tx confirmed");
  var string = new TextDecoder().decode(confirmedTxn.txn.txn.note);
  console.log("Note field: ", string);
};

const createAndOptInToAsset = async (shouldSignWithMagic: boolean) => {
  console.log(mockAdminAccount.addr);
  /* Asset Creation: */
  let params = await algodClient.getTransactionParams().do();
  params.fee = 1000;
  params.flatFee = true;

  // Data to be stored in the tx. None here.
  let note = undefined;
  // Whether user accounts will need to be unfrozen before transacting
  let defaultFrozen = false;
  // integer number of decimals for asset unit calculation
  let decimals = 0;
  // total number of this asset available for circulation
  let totalIssuance = 1000;
  // Used to display asset units to user
  let unitName = "TTT";
  // Friendly name of the asset
  let assetName = "TechTree Token";
  // Optional string pointing to a URL relating to the asset
  let assetURL = "http://techtree.dev";
  // Optional hash commitment of some sort relating to the asset. 32 character length.
  // MD5 of assetName
  let assetMetadataHash = "637b9adadf7acce5c70e5d327a725b13";

  let addr = mockAdminAccount.addr;
  // Specified address can change reserve, freeze, clawback, and manager
  let manager = mockAdminAccount.addr;
  // Specified address is considered the asset reserve
  // (it has no special privileges, this is only informational)
  let reserve = mockAdminAccount.addr;
  // Specified address can freeze or unfreeze user asset holdings
  let freeze = mockAdminAccount.addr;
  // Specified address can revoke user asset holdings and send
  // them to other addresses
  let clawback = mockAdminAccount.addr;

  // signing and sending "txn" allows "addr" to create an asset
  let assetCreationTx = algosdk.makeAssetCreateTxnWithSuggestedParams(
    addr,
    note,
    totalIssuance,
    decimals,
    defaultFrozen,
    manager,
    reserve,
    freeze,
    clawback,
    unitName,
    assetName,
    assetURL,
    assetMetadataHash,
    params
  );

  const txId = await sendTransaction(
    algodClient,
    assetCreationTx,
    mockAdminAccount.sk,
    null
  );

  // Get the new asset's information from the creator account
  const ptx = await algodClient.pendingTransactionInformation(txId).do();
  const assetID = ptx["asset-index"];

  console.log("Asset ID", assetID);

  const magicAddress: string = (await magic.user.getMetadata())?.publicAddress;
  console.log("magicAddress", magicAddress);
  console.log("mockAdminAccount", mockAdminAccount.addr);
  console.log("mockUser1Account", mockUser1Account.addr);

  let sender;

  if (shouldSignWithMagic) {
    sender = magicAddress;
  } else {
    sender = mockUser1Account.addr;
  }
  /* User Asset Optin */

  const recipient = sender;

  // We set revocationTarget to undefined as
  // This is not a clawback operation
  let revocationTarget = undefined;
  // CloseReaminerTo is set to undefined as
  // we are not closing out an asset
  let closeRemainderTo = undefined;
  // We are sending 0 assets
  const amount = 0;

  params = await algodClient.getTransactionParams().do();
  params.fee = 1000;
  params.flatFee = true;

  // signing and sending "txn" allows sender to begin accepting asset specified by creator and index
  let optInTx = algosdk.makeAssetTransferTxnWithSuggestedParams(
    sender,
    recipient,
    closeRemainderTo,
    revocationTarget,
    amount,
    note,
    assetID,
    params
  );

  if (shouldSignWithMagic) {
    await sendTransaction(algodClient, optInTx, null, magic);
  } else {
    await sendTransaction(algodClient, optInTx, mockUser1Account.sk, null);
  }
};

document.getElementById("login").onclick = handleLogin;
document.getElementById("simpleTx").onclick = simpleTx;
document.getElementById("createAndOptInWMagic").onclick = () =>
  createAndOptInToAsset(true);
document.getElementById("createAndOptInWPkey").onclick = () =>
  createAndOptInToAsset(false);
