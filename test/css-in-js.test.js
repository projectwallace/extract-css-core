const { suite } = require('uvu')
const assert = require('uvu/assert')
const createTestServer = require('create-test-server')
const sirv = require('sirv')

const Test = suite('CSS in JS')
const extractCss = require('..')

let server

Test.before(async () => {
  server = await createTestServer()
  server.use(sirv('test/fixtures'))
})

Test.after(async () => {
  await server.close()
})

Test('finds CSS directly from <link>\'ed file', async () => {
  const actual = await extractCss(server.url + '/css-in-js.html')

  const expected = '.bcMPWx { color: blue; }'
  assert.equal(actual, expected)
})

Test.run()
