const { suite } = require('uvu')
const assert = require('uvu/assert')
const createTestServer = require('create-test-server')
const sirv = require('sirv')

const Test = suite('CSS in <style>')
const extractCss = require('..')

let server

Test.before.each(async () => {
  server = await createTestServer()
  server.use(sirv('test/fixtures'))
})

Test.after.each(async () => {
  await server.close()
})

Test('finds CSS directly from <style>', async () => {
  const actual = await extractCss(server.url + '/style-tag-html.html')

  assert.ok(actual.includes('.style-in-html'), 'Could not find `.style-in-html` selector')
  assert.ok(actual.includes('@import url("import-in-css.css")'), `Could not find @import rule`)
})

Test('finds CSS from @import\'ed CSS file within <style>', async () => {
  const actual = await extractCss(server.url + '/style-tag-html.html')

  assert.ok(actual.includes('.css-imported-with-css{color:#000;}'), `Could not find minified CSS from @import`)
})

Test.run()
