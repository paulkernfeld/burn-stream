burn-stream uses burned bitcoins to produce a stream of weighted binary messages.

A burn stream is a series of special Bitcoin transactions that can be efficiently retrieved by any client, including a [simplified payment verification](https://en.bitcoin.it/wiki/Thin_Client_Security) client. Burn streams should be usable in many different applications.

This library presents a "burn stream" as a Javascript object stream. Here's an example message that says, "okay" with a weight of 100,000 satoshis.

```
{
  message: <Buffer 6f 6b 61 79>,
  satoshis: 100000,
  output: <instance of bitcore.Transaction.Output>,
  burnieTx: <output from a burnie stream>
}
```

Getting started
---------------
### Reading
Here's a simple example that will log out messages from the demo burn stream on the Bitcoin testnet. See `example.js` for a more verbose version of this script.

```
var BurnStream = require('burn-stream')
var Networks = require('bitcore-lib').Networks
var Node = require('webcoin').Node
var fs = require('fs')
var constants = require('webcoin').constants

// Load the config from a JSON file
var config = JSON.parse(fs.readFileSync('example-config.json'))

// Set the node's checkpoint
constants.checkpoints[config.networkName] = BurnStream.checkpointToConstant(config.checkpoint)

// We need to pass in a node
var node = new Node({
  network: Networks[config.networkName],
  path: 'testdata',
  acceptWeb: true
})
config.node = node

// Log data out when we get it
var bs = BurnStream(config)
bs.stream.on('data', console.log)

node.start()
```

Note that burn-stream does *not* guarantee that the data will be delivered in chronological order.

### Writing
The `create_tx.js` script can be used to write data to a burn stream. Currently this process requires low-level access to a Bitcoin wallet.

1. Get a list of unspent transaction outputs from your Bitcoin client, in a [bitcore-friendly format](https://bitcore.io/api/lib/unspent-output).
2. Pipe these UTXOs into `create_tx.js`, specifying:
  * a hex-encoded message to write
  * the amount to burn, in Satoshis
  * the location of the config file
  * the address to send change to
  * (optionally) the fee, in Satoshis
3. Take the raw transaction from the script, sign it, and broadcast it.

The example below writes the word "hello" with 0.1 mBTC (10,000 satoshis).

```
cat utxos.json | node create_tx.js \
    --message=68656c6c6f \
    --amount=10000 \
    --config=config.json \
    --changeAddress=mgWrLnoWjjYrmX1YTUcxHR9AKQbeGRe7zC
```

### Creating a burn stream
You may want to create a new burn stream for your application. In this case, you'll need to create a config file. For a working example, see `example-config.json`.

Tips:

* `networkName` must be `livenet` or `testnet`.
* You can generate an unspendable address with Adam Krellenstein's [unspendable](https://github.com/adamkrellenstein/unspendable) library.
* The shorter your binary prefix, the more information you'll be able to fit into your messages, but the more accidental collisions you'll get.
* Ensure that the block hash of your checkpoint is correct.

The burn-stream protocol
------------------------
The burn-stream protocol is a simple way of storing data in the Bitcoin blockchain. It emphasizes ease of implementation and compatibility with SPV clients.

### Burn stream
A burn stream is a sequence of special transactions in the Bitcoin blockchain, intended for a particular purpose. Each burn stream has two identifiers:

* An obviously unspendable address, e.g. `mvBurnStreamDemoXXXXXXXXXXXXX2cyY3`.
* A short binary prefix for `OP_RETURN` messages, e.g. `burnz`.

It's probably not a good idea to reuse an existing burn stream for a different purpose, because this changes the contract of the existing burn stream.

### Transactions
A BurnStream transaction is a special Bitcoin transaction. It must include an "indexing output" for efficiently locating the transaction and one or more "data outputs" that contain the data. It may include any number of additional arbitrary outputs, such as a change outputs.

A BurnStream transaction may include arbitrary inputs.

#### Indexing output

The purpose of the indexing output is to efficiently indicate that a transaction is part of a particular burn stream; other than that, it doesn't contain any data. The indexing output is simply a [pay-to-PubkeyHash](https://en.bitcoin.it/wiki/Transaction#Pay-to-PubkeyHash) output that is sent to the obviously unspendable address for that burn stream (e.g. `mvBurnStreamDemoXXXXXXXXXXXXX2cyY3`).

This output will let the transaction be picked up by SPV clients by using a [BIP 37](https://github.com/bitcoin/bips/blob/master/bip-0037.mediawiki) Bloom filter. The presence of an indexing output may allow burn-stream to make use of future Bitcoin enhancements, such as [ultimate blockchain compression](https://bitcointalk.org/index.php?topic=88208.0). It's worth noting that this is currently a [controversial](https://github.com/bitcoin/bitcoin/pull/5286) use of a P2PKH transaction.

It is recommended to pay more than the [dust threshold](http://bitcoin.stackexchange.com/questions/10986/what-is-meant-by-bitcoin-dust) to the burn address. Since the dust threshold may change, it's better to be on the safe side by leaving a margin.

#### Data outputs

The purpose of a data output is to store binary data.

A data output is an `OP_RETURN` output containing the prefix for the stream (e.g. `burnz`), plus some binary data.

It is not recommended to send any bitcoins to data outputs, unless you're using them for weighting. It is also not recommended to exceed the default relay length for `OP_RETURN` transactions.

### Message weights

Every message in a stream has a weight associated with it, measured in satoshis. The weight is used to measure the writer's level of commitment to the message.

Call the amount spent to the indexing output `y`. Given data outputs `i in 1...D` where each output spends `x_i` satoshis, the weight for data output `i` is `x_i + y * x_i / sum(x_1 ... x_D)`. In the case where `sum(x_1 ... x_D) = 0`, the weight for data output `i` is `x_i + y / D`.