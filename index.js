var Burnie = require('burnie')
var debug = require('debug')('burn-stream')
var through2 = require('through2')
var assert = require('assert')
var PeerGroup = require('bitcoin-net').PeerGroup
var Blockchain = require('blockchain-spv')
var Filter = require('bitcoin-filter')
var utils = require('bitcoin-util')
var params = require('webcoin-bitcoin-testnet')
var sublevel = require('level-sublevel')
var network = require('bitcoinjs-lib').networks.testnet
var script = require('bitcoinjs-lib').script

function decodeOpReturnOutput (outScript) {
  var decompiled = script.decompile(outScript)
  if (decompiled[0] !== 106) return
  if (decompiled.length !== 2) return
  if (decompiled[1] < 1 || decompiled[1] > 78) return
  return decompiled[1]
}

function BurnStream (opts) {
  if (!(this instanceof BurnStream)) return new BurnStream(opts)

  var self = this
  var config = opts.config

  debug('new', config)

  assert(config.networkName = 'testnet')
  var opReturnPrefix = Buffer(config.opReturnPrefix, 'hex')

  params.blockchain.checkpoints = [ checkpointFromObject(config.checkpoint) ]

  // We need to pass in a PeerGroup
  this.peers = new PeerGroup(params.net)
  this.peers.on('error', console.log)

  var filter = new Filter(this.peers, { falsePositiveRate: 0.00001 })

  var db = sublevel(opts.db)
  var chain = new Blockchain(params.blockchain, db.sublevel('chain'))
  chain.on('error', console.log)

  this.burnie = Burnie({
    address: config.burnAddress,
    from: config.checkpoint.height + 1,
    peers: this.peers,
    chain: chain,
    network: network,
    db: db.sublevel('burnie')
  })
  filter.add(this.burnie)

  this.stream = through2.obj(function (burnieTx, enc, callback) {
    var tx = burnieTx.tx.transaction

    debug('tx found', tx.getId())
    var opReturnOutputs = []
    for (var o in tx.outs) {
      var output = tx.outs[o]
      var data = decodeOpReturnOutput(output.script)
      if (data) {
        debug('data out found', o)
        if (data.slice(0, opReturnPrefix.length).equals(opReturnPrefix)) {
          debug('prefixed output found', o)
          opReturnOutputs.push({
            output: output,
            data: data
          })
        }
      }
    }

    if (opReturnOutputs.length) {
      assert.equal(opReturnOutputs.length, 1, 'i have not yet implemented multiple outputs, sorry')
      var out = opReturnOutputs[0]
      assert.equal(out.output.value, 0, 'i have not implemented satoshis per op return')
      this.push({
        message: out.data.slice(opReturnPrefix.length),
        output: out.output,
        satoshis: burnieTx.satoshis,
        burnieTx: burnieTx
      })
    }

    callback()
  })
  this.burnie.stream.pipe(this.stream)

  this.peers.once('peer', function () {
    chain.getLocator(function (err, locator) {
      if (err) throw err
      self.peers.createHeaderStream({ locator: locator }).pipe(chain.createWriteStream())
    })
  })
}

BurnStream.prototype.start = function () {
  this.peers.connect()
}

var checkpointFromObject = function (checkpointJson) {
  // Deep copy: don't modify the original
  var checkpoint = JSON.parse(JSON.stringify(checkpointJson))

  checkpoint.header.prevHash = utils.toHash(checkpoint.header.prevHash)
  checkpoint.header.merkleRoot = utils.toHash(checkpoint.header.merkleRoot)

  return checkpoint
}

module.exports = BurnStream
