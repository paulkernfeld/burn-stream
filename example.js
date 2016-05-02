var BurnStream = require('.')
var fs = require('fs')
var debug = require('debug')('burnstream-example')

// Load the config from a JSON file
var config = JSON.parse(fs.readFileSync('example-config.json'))
debug('config', config)

// Log data out when we get it
var bs = BurnStream(config)
bs.stream.on('data', function (data) {
  debug('data', data)
  console.log('message utf8:', data.message.toString('utf8'))
})

bs.start()
