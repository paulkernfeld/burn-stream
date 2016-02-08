var Burnie = require('burnie')
var Address = require('bitcore-lib').Address
var utils = require('webcoin').utils
var BlockHeader = require('bitcore-lib').BlockHeader
var debug = require('debug')('burnstream')
var through2 = require('through2')
var assert = require('assert')

function BurnStream (opts) {
  if (!(this instanceof BurnStream)) return new BurnStream(opts)

  var opReturnPrefix = Buffer(opts.opReturnPrefix, 'hex')

  var burnieOpts = {
    // Slice off the address prefix byte to get the hash 160
    pubkeyHash: Address.fromString(opts.burnAddress).toBuffer().slice(1),
    from: opts.checkpoint.height + 1,
    node: opts.node
  }
  this.burnie = new Burnie(burnieOpts)

  this.stream = through2.obj(function (burnieTx, enc, callback) {
    var tx = burnieTx.tx.transaction

    debug('tx found', tx.hash)
    var opReturnOutputs = []
    for (var o in tx.outputs) {
      var output = tx.outputs[o]
      var script = output.script
      if (script.isDataOut()) {
        debug('data out found', o)
        var data = script.getData()
        if (data.slice(0, opReturnPrefix.length).equals(opReturnPrefix)) {
          debug('prefixed output found', o)
          opReturnOutputs.push(output)
        }
      }
    }

    if (opReturnOutputs.length) {
      assert.equal(opReturnOutputs.length, 1, 'i have not yet implemented multiple outputs, sorry')
      var out = opReturnOutputs[0]
      assert.equal(out.satoshis, 0, 'i have not implemented satoshis per op return')
      this.push({
        message: out.script.getData().slice(opReturnPrefix.length),
        output: out,
        satoshis: burnieTx.satoshis,
        burnieTx: burnieTx
      })
    }

    callback()
  })
  this.burnie.stream.pipe(this.stream)
}

var checkpointToConstant = function (checkpointJson) {
  // Deep copy: don't modify the original
  var checkpoint = JSON.parse(JSON.stringify(checkpointJson))

  checkpoint.header.prevHash = utils.toHash(checkpoint.header.prevHash)
  checkpoint.header.merkleRoot = utils.toHash(checkpoint.header.merkleRoot)
  checkpoint.header = BlockHeader(checkpoint.header)
  debug('checkpoint hash', checkpoint.header.hash)

  return checkpoint
}

module.exports = BurnStream
module.exports.checkpointToConstant = checkpointToConstant
