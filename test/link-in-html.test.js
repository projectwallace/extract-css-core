const { suite } = require('uvu')
const assert = require('uvu/assert')
const createTestServer = require('create-test-server')
const sirv = require('sirv')

const Test = suite('CSS in <link rel="stylesheet">')
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
  const actual = await extractCss(server.url + '/link-tag-html.html')

  assert.ok(actual.includes('.link-in-html { }'))
  assert.ok(actual.includes('@import url("import-in-css.css")'))
})

Test('finds CSS from @import\'ed CSS file', async () => {
  const actual = await extractCss(server.url + '/link-tag-html.html')

  assert.ok(actual.includes('.css-imported-with-css { }'))
})

Test.run()
