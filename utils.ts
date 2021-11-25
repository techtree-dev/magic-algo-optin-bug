/**
 * Wait until the transaction is confirmed or rejected, or until 'timeout'
 * number of rounds have passed.
 * @param {algosdk.Algodv2} algodClient the Algod V2 client
 * @param {string} txId the transaction ID to wait for
 * @param {number} timeout maximum number of rounds to wait
 * @return {Promise<*>} pending transaction information
 * @throws Throws an error if the transaction is not confirmed or rejected in the next timeout rounds
 */

export const waitForConfirmation = async function (algodClient, txId, timeout) {
  if (algodClient == null || txId == null || timeout < 0) {
    throw new Error("Bad arguments");
  }

  const status = await algodClient.status().do();
  if (status === undefined) {
    throw new Error("Unable to get node status");
  }

  const startround = status["last-round"] + 1;
  let currentround = startround;

  while (currentround < startround + timeout) {
    const pendingInfo = await algodClient
      .pendingTransactionInformation(txId)
      .do();
    if (pendingInfo !== undefined) {
      if (
        pendingInfo["confirmed-round"] !== null &&
        pendingInfo["confirmed-round"] > 0
      ) {
        //Got the completed Transaction
        return pendingInfo;
      } else {
        if (
          pendingInfo["pool-error"] != null &&
          pendingInfo["pool-error"].length > 0
        ) {
          // If there was a pool error, then the transaction has been rejected!
          throw new Error(
            "Transaction " +
              txId +
              " rejected - pool error: " +
              pendingInfo["pool-error"]
          );
        }
      }
    }
    await algodClient.statusAfterBlock(currentround).do();
    currentround++;
  }

  throw new Error(
    "Transaction " + txId + " not confirmed after " + timeout + " rounds!"
  );
};

export const getNodeRounds = async (
  algoClient: any
): Promise<{ currentRound: number; lastRound: number }> => {
  let status = await algoClient.status().do();
  if (status == undefined) throw new Error("Unable to get node status");
  const currentRound: number = status["last-round"] + 1;
  const lastRound: number = currentRound + 1000;
  return { currentRound, lastRound };
};

export const sendTransaction = async (
  client,
  transaction,
  privateKey?,
  magic?
) => {
  let tx, txId, rawSignedTx;
  if (privateKey) {
    console.log("Sign and Send with secret key");
    rawSignedTx = transaction.signTxn(privateKey);
    const tx = await client.sendRawTransaction(rawSignedTx).do();
    txId = tx.txId;
  } else {
    console.log("Sign and Send with Magic");
    tx = await magic.algorand.signTransaction(transaction);
    console.log("Magic Tx Signed");
    await client.sendRawTransaction(tx.blob).do();
    console.log("Magic Tx Sent");
    txId = tx.txID;
  }
  console.log("Transaction ID:", txId);
  await waitForConfirmation(client, txId, 100);
  console.log("Tx confirmed");
  return txId;
};
