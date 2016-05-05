var fs = require('fs')

var levelup = require('levelup')

var BurnStream = require('.')

// Load the config from a JSON file
var config = JSON.parse(fs.readFileSync('example-config.json'))

var bs = BurnStream({
  config: config,
  db: levelup('./example.db')
})

// Log data out when we get it
bs.stream.on('data', function (data) {
  console.log('message utf8:', data.message.toString('utf8'))
})

bs.start()
