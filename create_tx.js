var fs = require('fs')
var argv = require('minimist')(process.argv.slice(2))
var toArray = require('stream-to-array')
var assert = require('assert')
var Transaction = require('bitcore-lib').Transaction
var Script = require('bitcore-lib').Script

var config = JSON.parse(fs.readFileSync(argv.config))
var message = argv.message
console.log('amount', argv.amount)
console.log('change address', argv.change)
console.log('message hex', message)
console.log('message ascii', Buffer(message, 'hex').toString('ascii'))
console.log('message utf8', Buffer(message, 'hex').toString('utf8'))

console.log('burn address', config.burnAddress)
console.log('OP_RETURN prefix hex', config.opReturnPrefix)

toArray(process.stdin, function (err, stdin) {
  assert.ifError(err)
  assert.equal(stdin.length, 1)
  var utxos = JSON.parse(stdin[0])
  console.log('# of utxos', utxos.length)

  var messageBuffer = Buffer(config.opReturnPrefix + message, 'hex')
  assert(messageBuffer.length < 80)
  var opReturnScript = Script.buildDataOut(messageBuffer)
  console.log('script', opReturnScript)

  var output = new Transaction.Output({
    satoshis: 0,
    script: opReturnScript
  })

  var transaction = new Transaction()
    .from(utxos)          // Feed information about what unspent outputs one can use
    .to(config.burnAddress, argv.amount)  // Add an output with the given amount of satoshis
    .addOutput(output)

  if (argv.fee) {
    transaction.fee(argv.fee)
  }
  transaction.change(argv.change)      // Sets up a change address where the rest of the funds will go

  console.log('fee', transaction.getFee())
  console.log(transaction)
})

