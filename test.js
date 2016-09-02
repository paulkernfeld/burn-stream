var fs = require('fs')
var timers = require('timers')

var levelup = require('levelup')
var rimraf = require('rimraf')
var tape = require('tape')

var BurnStream = require('.')

tape('read from burn stream', function (t) {
  var testDb = './test.db'
  rimraf.sync(testDb)

  t.on('end', function () {
    timers.setImmediate(process.exit)
  })
  // Load the config from a JSON file
  var config = JSON.parse(fs.readFileSync('example-config.json'))

  var bs = BurnStream({
    config: config,
    db: levelup(testDb)
  })

  // Log data out when we get it
  bs.stream.once('data', function (data) {
    t.same(data.message.toString('utf8'), 'okay')
    t.end()
  })

  bs.start()
})
