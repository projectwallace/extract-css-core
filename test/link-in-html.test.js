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

  assert.ok(actual.includes('.unminified {'), 'Could not find unminified selector in <link>')
  assert.ok(actual.includes('color: rgb(255, 0, 0);'), 'Could not find unminified declaration in <link>')
  assert.ok(actual.includes('.minified{color:red}'), 'Could not find minified RuleSet in <link>')
  assert.ok(actual.includes('@import url("import-in-css.css")'), 'Could not find @import in <link>')
})

Test('finds CSS from @import\'ed CSS file', async () => {
  const actual = await extractCss(server.url + '/link-tag-html.html')

  assert.ok(actual.includes('.css-imported-with-css{color:#000;}'), 'Could not find minified CSS from @imported file in <link>')
})

Test.run()
