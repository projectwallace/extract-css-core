const { suite } = require('uvu')
const assert = require('uvu/assert')
const createTestServer = require('create-test-server')
const sirv = require('sirv')

const Test = suite('inline styles')
const extractCss = require('..')

let server

Test.before(async () => {
  server = await createTestServer()
  server.use(sirv('test/fixtures'))
})

Test.after(async () => {
  await server.close()
})

Test('it finds inline styles - HTML', async () => {
  const actual = await extractCss(server.url + '/inline-style-html.html')

  assert.ok(actual.includes('[x-extract-css-inline-style] { color: red; font-size: 12px; }'))
  assert.ok(actual.includes('[x-extract-css-inline-style] { color: blue }'))
  // Assert.snapshot(actual)
})

Test('it finds inline styles - JS', async () => {
  const actual = await extractCss(server.url + '/inline-style-js.html')

  assert.ok(actual.includes('[x-extract-css-inline-style] { color: red; font-size: 12px; border-style: solid; }'))
  assert.ok(actual.includes('[x-extract-css-inline-style] { border-color: blue; border-width: 1px; }'))
  // Assert.snapshot(actual)
})

Test.run()
