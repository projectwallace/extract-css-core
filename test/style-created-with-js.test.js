const { suite } = require('uvu')
const assert = require('uvu/assert')
const createTestServer = require('create-test-server')
const sirv = require('sirv')

const Test = suite('CSS in <style> created by JS')
const extractCss = require('..')

let server

Test.before(async () => {
  server = await createTestServer()
  server.use(sirv('test/fixtures'))
})

Test.after(async () => {
  await server.close()
})

Test('finds CSS directly from <style>', async () => {
  const actual = await extractCss(server.url + '/style-tag-js.html')

  assert.ok(actual.includes('.css-in-style'))
  assert.ok(actual.includes('@import url("import-in-js.css")'))
})

Test('finds CSS from @import\'ed CSS file within <style>', async () => {
  const actual = await extractCss(server.url + '/style-tag-js.html')

  assert.ok(actual.includes('.css-imported-with-js { }'))
})

Test.run()
