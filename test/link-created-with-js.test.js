const { suite } = require('uvu')
const assert = require('uvu/assert')
const createTestServer = require('create-test-server')
const sirv = require('sirv')

const Test = suite('<link rel="stylesheet"> created with JS')
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
  const actual = await extractCss(server.url + '/link-tag-js.html')

  assert.ok(actual.includes('.link-tag-created-with-js { }'))
  assert.ok(actual.includes('@import url("import-in-css.css")'))
})

Test('it finds @import\'ed css', async () => {
  const actual = await extractCss(server.url + '/link-tag-js.html')

  assert.ok(actual.includes('.css-imported-with-css{color:#000;}'))
})

Test.run()
