var BurnStream = require('.')
var Networks = require('bitcore-lib').Networks
var Node = require('webcoin').Node
var fs = require('fs')
var constants = require('webcoin').constants
var assert = require('assert')
var debug = require('debug')('burnstream-example')

// Load the config from a JSON file
var config = JSON.parse(fs.readFileSync('example-config.json'))
debug('config', config)

// Set the node's checkpoint
constants.checkpoints[config.networkName] = BurnStream.checkpointToConstant(config.checkpoint)

// We need to pass in a node
var node = new Node({
  network: Networks[config.networkName],
  path: 'testdata',
  acceptWeb: true
})
node.on('error', assert.ifError)
config.node = node

// Log data out when we get it
var bs = BurnStream(config)
bs.stream.on('data', function (data) {
  debug('data', data)
  console.log('message utf8', data.message.toString('utf8'))
})

node.start()
