const { suite } = require('uvu')
const assert = require('uvu/assert')
const createTestServer = require('create-test-server')
const sirv = require('sirv')

const Test = suite('Extract CSS')
const extractCss = require('..')

let server

Test.before(async () => {
	server = await createTestServer()
	server.use(sirv('test/fixtures'))
})

Test.after(async () => {
	await server.close()
})

Test('it finds css in a <link> tag - HTML', async () => {
	const actual = await extractCss(server.url + '/link-tag-html.html')

	assert.ok(actual.includes('.link-in-html { }'))
	assert.ok(actual.includes('@import url("import-in-css.css")'))
	assert.ok(actual.includes('.css-imported-with-css {}'))
})

Test('it finds css in a <link> tag - JS', async () => {
	const actual = await extractCss(server.url + '/link-tag-js.html')

	assert.ok(actual.includes('.link-tag-created-with-js {}'))
	assert.ok(actual.includes('@import url("import-in-css.css")'))
	assert.ok(actual.includes('.css-imported-with-css {}'))
})

Test('it finds css in a <style> tag - HTML', async () => {
	const actual = await extractCss(server.url + '/style-tag-html.html')

	assert.ok(actual.includes('.fixture { color: red; }'))
	assert.ok(actual.includes('@import url("import-in-css.css")'))
	assert.ok(actual.includes('.css-imported-with-css {}'))
	// Assert.snapshot(actual)
})

Test('it finds css in a <style> tag - JS', async () => {
	const actual = await extractCss(server.url + '/style-tag-js.html')

	assert.ok(actual.includes('.fixture { color: red; }'))
	assert.ok(actual.includes('@import url("import-in-js.css")'))
	assert.ok(actual.includes('.css-imported-with-js {}'))
	// Assert.snapshot(actual)
})

Test('it finds css-in-js', async () => {
	const actual = await extractCss(server.url + '/css-in-js.html')
	const expected = '.bcMPWx { color: blue; }'

	assert.is(actual, expected)
	// Assert.snapshot(actual)
})

Test('it finds CSS implemented in a mixed methods (inline, links, style tags)', async () => {
	const actual = await extractCss(server.url + '/kitchen-sink.html')

	assert.ok(actual.includes('@import url("import-in-css.css")'))
	assert.ok(actual.includes('.css-imported-with-css {}'))
	assert.ok(actual.includes('[x-extract-css-inline-style]'))
	assert.ok(actual.includes('[x-extract-css-inline-style] { background-image: url(\'background-image-inline-style-attribute-in-html\'); }'))
	assert.ok(actual.includes('[x-extract-css-inline-style] { background-image: url("background-image-inline-style-js-cssText"); }'))
	assert.ok(actual.includes('[x-extract-css-inline-style] { background-image: url("background-image-inline-style-js-with-prop"); }'))
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

Test('it yields an array of entries when the `origins` option equals `include`', async () => {
	const actual = await extractCss(server.url + '/kitchen-sink.html', {
		origins: 'include'
	})

	assert.ok(Array.isArray(actual), 'Result should be an array when { origins: `include` }')
	assert.is(actual.length, 10)

	function isString(item) {
		return typeof item === 'string'
	}

	assert.ok(actual.every(item => isString(item.type) && ['link-or-import', 'style', 'inline'].includes(item.type)))
	assert.ok(actual.every(item => isString(item.href)))
	assert.ok(actual.every(item => item.href.startsWith('http://localhost:') && /\.(html|css)$/.test(item.href)))
	assert.ok(actual.every(item => isString(item.css)))

	// Cannot snapshot due to changing port numbers in `create-test-server`
})

Test('it returns a direct link to a CSS file', async () => {
	const actual = await extractCss(server.url + '/import-in-css.css')

	assert.ok(actual.includes('.css-imported-with-css {}'))
	// Assert.snapshot(actual)
})

Test('it rejects if the url has an HTTP error status', async () => {
	server.get('/404-page', (req, res) => {
		res.status(404).send()
	})
	const urlWith404 = server.url + '/404-page'
	assert.throws(() => extractCss(urlWith404),
		`There was an error retrieving CSS from ${urlWith404}.\n\tHTTP status code: 404 (Not Found)`
	)
})

Test('it rejects on an invalid url', () => {
	assert.throws(async () => {
		await extractCss('site.example')
	})
})

Test.run()
