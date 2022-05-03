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

Test('it finds CSS implemented in a mixed methods (inline, links, style tags)', async () => {
	const actual = await extractCss(server.url + '/kitchen-sink.html')

	assert.ok(actual.includes('@import url("import-in-css.css")'))
	assert.ok(actual.includes('.css-imported-with-css { }'))
	assert.ok(actual.includes('[x-extract-css-inline-style]'))
	assert.ok(actual.includes('[x-extract-css-inline-style] { background-image: url(\'background-image-inline-style-attribute-in-html\'); }'))
	assert.ok(actual.includes('[x-extract-css-inline-style] { background-image: url("background-image-inline-style-js-cssText"); }'))
	assert.ok(actual.includes('[x-extract-css-inline-style] { background-image: url("background-image-inline-style-js-with-prop"); }'))
})

Test('it yields an array of entries when the `origins` option equals `include`', async () => {
	const actual = await extractCss(server.url + '/kitchen-sink.html', {
		origins: 'include'
	})

	assert.ok(Array.isArray(actual), 'Result should be an array when { origins: `include` }')
	assert.is(actual.length, 12)

	function isString(item) {
		return typeof item === 'string'
	}

	assert.ok(actual.every(item => isString(item.type) && ['link', 'import', 'style', 'inline'].includes(item.type)))
	assert.ok(actual.every(item => isString(item.href)))
	assert.ok(actual.every(item => item.href.startsWith('http://localhost:') && /\.(html|css)$/.test(item.href)))
	assert.ok(actual.every(item => isString(item.css)))

	// Cannot snapshot due to changing port numbers in `create-test-server`
})

Test('it returns a direct link to a CSS file', async () => {
	const actual = await extractCss(server.url + '/import-in-css.css')

	assert.equal(actual, '.css-imported-with-css {}')
})

Test('it rejects if the url has an HTTP error status', async () => {
	server.get('/404-page', (req, res) => {
		res.status(404).send()
	})
	const urlWith404 = server.url + '/404-page'

	try {
		await extractCss(urlWith404)
		assert.unreachable('should have thrown')
	} catch (error) {
		assert.instance(error, Error)
		assert.is(error.message, `There was an error retrieving CSS from ${urlWith404}.\n\tHTTP status code: 404 (Not Found)`)
	}
})

Test('it rejects on an invalid url', async () => {
	try {
		await extractCss('site.example')
		assert.unreachable('should have thrown')
	} catch (error) {
		assert.instance(error, Error)
	}
})

Test.run()
