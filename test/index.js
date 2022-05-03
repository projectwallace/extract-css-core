const test = require('ava')
const createTestServer = require('create-test-server')
const sirv = require('sirv')

const extractCss = require('..')

let server

test.before(async () => {
	server = await createTestServer()
	server.use(sirv('test/fixtures'))
})

test.after(async () => {
	await server.close()
})

test('it finds css in a <link> tag - HTML', async t => {
	const actual = await extractCss(server.url + '/link-tag-html.html')

	t.true(actual.includes('.link-in-html { }'))
	t.true(actual.includes('@import url("import-in-css.css")'))
	t.true(actual.includes('.css-imported-with-css { }'))
	t.snapshot(actual)
})

test('it finds css in a <link> tag - JS', async t => {
	const actual = await extractCss(server.url + '/link-tag-js.html')

	t.true(actual.includes('.link-tag-created-with-js'))
	t.true(actual.includes('@import url("import-in-css.css")'))
	t.true(actual.includes('.css-imported-with-css { }'))
	t.snapshot(actual)
})

test('it finds css in a <style> tag - HTML', async t => {
	const actual = await extractCss(server.url + '/style-tag-html.html')

	t.true(actual.includes('.fixture { color: red; }'))
	t.true(actual.includes('@import url("import-in-css.css")'))
	t.true(actual.includes('.css-imported-with-css { }'))
	t.snapshot(actual)
})

// This is an issue with chrome-aws-lambda, so let's make sure
// it doesn't happen here too.
test('it reports CSS in a <style> tag in HTML only once', async t => {
	const actual = await extractCss(server.url + '/style-tag-html.html')

	const firstOccurence = actual.indexOf('.fixture')
	const lastOccurence = actual.lastIndexOf('.fixture')

	t.is(firstOccurence, lastOccurence)
	t.snapshot(actual)
})

test('it finds css in a <style> tag - JS', async t => {
	const actual = await extractCss(server.url + '/style-tag-js.html')

	t.true(actual.includes('.fixture { color: red; }'))
	t.true(actual.includes('@import url("import-in-js.css")'))
	t.true(actual.includes('.css-imported-with-js { }'))
	t.snapshot(actual)
})

test('it finds css-in-js', async t => {
	const actual = await extractCss(server.url + '/css-in-js.html')
	const expected = '.bcMPWx { color: blue; }'

	t.is(actual, expected)
	t.snapshot(actual)
})

test('it finds CSS implemented in a mixed methods (inline, links, style tags)', async t => {
	const actual = await extractCss(server.url + '/kitchen-sink.html')

	t.true(actual.includes('@import url("import-in-css.css")'))
	t.true(actual.includes('.css-imported-with-css { }'))
	t.true(actual.includes('[x-extract-css-inline-style]'))
	t.true(actual.includes('[x-extract-css-inline-style] { background-image: url(\'background-image-inline-style-attribute-in-html\'); }'))
	t.true(actual.includes('[x-extract-css-inline-style] { background-image: url("background-image-inline-style-js-cssText"); }'))
	t.true(actual.includes('[x-extract-css-inline-style] { background-image: url("background-image-inline-style-js-with-prop"); }'))
	t.snapshot(actual)
})

test('it finds inline styles - HTML', async t => {
	const actual = await extractCss(server.url + '/inline-style-html.html')

	t.true(actual.includes('[x-extract-css-inline-style] { color: red; font-size: 12px; }'))
	t.true(actual.includes('[x-extract-css-inline-style] { color: blue }'))
	t.snapshot(actual)
})

test('it ignores inline styles when `inlineStyles !== "include"`', async t => {
	const actual = await extractCss(server.url + '/inline-style-html.html', {
		inlineStyles: 'exclude'
	})

	t.false(actual.includes('[x-extract-css-inline-style] { color: red; font-size: 12px; }'))
	t.false(actual.includes('[x-extract-css-inline-style] { color: blue }'))
	t.is(actual, '')
})

test('it finds inline styles - JS', async t => {
	const actual = await extractCss(server.url + '/inline-style-js.html')

	t.true(actual.includes('[x-extract-css-inline-style] { color: red; font-size: 12px; border-style: solid; }'))
	t.true(actual.includes('[x-extract-css-inline-style] { border-color: blue; border-width: 1px; }'))
	t.snapshot(actual)
})

test('it returns an array of entries when the `origins` option equals `include`', async t => {
	const actual = await extractCss(server.url + '/kitchen-sink.html', {
		origins: 'include'
	})

	t.true(Array.isArray(actual), 'Result should be an array when { origins: `include` }')
	t.is(actual.length, 12)

	function isString(item) {
		return typeof item === 'string'
	}

	t.true(actual.every(item => isString(item.type) && ['link', 'import', 'style', 'inline'].includes(item.type)))
	t.true(actual.every(item => isString(item.href)))
	t.true(actual.every(item => item.href.startsWith('http://localhost:') && /\.(html|css)$/.test(item.href)))
	t.true(actual.every(item => isString(item.css)))

	// Cannot snapshot due to changing port numbers in `create-test-server`
})

test('it returns a direct link to a CSS file', async t => {
	const actual = await extractCss(server.url + '/import-in-css.css')

	t.true(actual.includes('.css-imported-with-css {}'))
	t.snapshot(actual)
})

test('it rejects if the url has an HTTP error status', async t => {
	server.get('/404-page', (req, res) => {
		res.status(404).send()
	})
	const urlWith404 = server.url + '/404-page'
	await t.throwsAsync(extractCss(urlWith404), {
		message: `There was an error retrieving CSS from ${urlWith404}.\n\tHTTP status code: 404 (Not Found)`
	})
})

test('it rejects on an invalid url', async t => {
	await t.throwsAsync(extractCss('site.example'))
})

test('it rejects on server timing out', async t => {
	server.get('/timeout-page', (req, res) => {
		setTimeout(function () {
			res.status(500).send()
		}, 5000)
	})
	const timoutUrl = server.url + '/timeout-page'
	await t.throwsAsync(extractCss(timoutUrl, {timeout: 4500}), {
		message: 'Navigation timeout of 4500 ms exceeded'
	})
})
