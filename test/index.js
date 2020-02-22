const test = require('ava')
const createTestServer = require('create-test-server')
const {readFileSync} = require('fs')
const {resolve} = require('path')

const extractCss = require('..')

let server

function serveStatic(req, res) {
	const fileContents = readFileSync(resolve(__dirname, req.path.slice(1)), 'utf8')
	res.send(fileContents)
}

test.before(async () => {
	server = await createTestServer()

	server.get('/fixture.css', serveStatic)
	server.get('/imported.css', serveStatic)
})

test.after(async () => {
	await server.close()
})

test('it finds css in a <link> tag - HTML', async t => {
	server.get('/link-tag-html.html', serveStatic)
	const actual = await extractCss(server.url + '/link-tag-html.html')

	t.true(actual.includes('@import url("imported.css");'))
	t.true(actual.includes('.imported { color: blue; }'))
	t.true(actual.includes('.fixture { color: red; }'))
	t.snapshot(actual)
})

test('it finds css in a <link> tag - JS', async t => {
	server.get('/link-tag-js.html', serveStatic)
	const actual = await extractCss(server.url + '/link-tag-js.html')

	t.true(actual.includes('@import url("imported.css");'))
	t.true(actual.includes('.fixture { color: red; }'))
	t.true(actual.includes('.imported { color: blue; }'))
	t.snapshot(actual)
})

test('it finds css in a <style> tag - HTML', async t => {
	server.get('/style-tag-html.html', serveStatic)
	const actual = await extractCss(server.url + '/style-tag-html.html')

	t.true(actual.includes('@import url("imported.css");'))
	t.true(actual.includes('.fixture { color: red; }'))
	t.true(actual.includes('.imported { color: blue; }'))
	t.snapshot(actual)
})

test('it finds css in a <style> tag - JS', async t => {
	server.get('/style-tag-js.html', serveStatic)
	const actual = await extractCss(server.url + '/style-tag-js.html')

	t.true(actual.includes('@import url("imported.css");'))
	t.true(actual.includes('.fixture { color: red; }'))
	t.true(actual.includes('.imported { color: blue; }'))
	t.snapshot(actual)
})

test('it finds css-in-js', async t => {
	server.get('/css-in-js.html', serveStatic)
	const actual = await extractCss(server.url + '/css-in-js.html')
	const expected = '.bcMPWx { color: blue; }'

	t.is(actual, expected)
})

test('it does not report the same CSS twice', async t => {
	// @TODO: during tests, it doesn't find the imported CSS file contents
	// but it does work outside of test scope
	server.get('/kitchen-sink.html', serveStatic)
	const actual = await extractCss(server.url + '/kitchen-sink.html')

	t.true(actual.includes('@import url("imported.css");'))
	t.true(actual.includes('.fixture { color: red; }'))
	t.true(actual.includes('.style-tag-fixture-js { color: yellow; }'))
	t.true(actual.includes('.style-tag-fixture-html { color: green; }'))
	t.true(actual.includes('border-style: solid'))
	t.true(actual.includes('background-color: red'))

	t.snapshot(actual)
})

test('it finds inline styles - HTML', async t => {
	server.get('/inline-style-html.html', serveStatic)
	const actual = await extractCss(server.url + '/inline-style-html.html')

	t.true(actual.includes('[x-inline-style-dfc776] { color: red; font-size: 12px; }'))
	t.true(actual.includes('[x-inline-style-ea2739] { color: blue }'))
	t.snapshot(actual)
})

test('it finds inline styles - JS', async t => {
	server.get('/inline-style-js.html', serveStatic)
	const actual = await extractCss(server.url + '/inline-style-js.html')

	t.true(actual.includes('[x-inline-style-874435] { color: red; font-size: 12px; border-style: solid; }'))
	t.true(actual.includes('[x-inline-style-ea1c8f] { border-color: blue; border-width: 1px; }'))
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
