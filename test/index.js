const test = require('ava')
const createTestServer = require('create-test-server')
const {readFileSync, existsSync} = require('fs')
const {resolve} = require('path')

const extractCss = require('..')

let server
const fixture = readFileSync(resolve(__dirname, 'fixture.css'), 'utf8')

test.before(async () => {
	server = await createTestServer()
	server.get('/fixture.css', (req, res) => {
		res.send(fixture)
	})
	function staticFile(req, res) {
		const fileContents = readFileSync(resolve(__dirname, req.path.slice(1)), 'utf8')
		res.send(fileContents)
	}

	server.get('/css-in-js.html', staticFile)
	server.get('/inline-style-html.html', staticFile)
	server.get('/inline-style-js.html', staticFile)
	server.get('/link-tag-html.html', staticFile)
	server.get('/link-tag-js.html', staticFile)
	server.get('/style-tag-html.html', staticFile)
	server.get('/style-tag-js.html', staticFile)
})

test.after(async () => {
	await server.close()
})

test('it finds css in a <link> tag - HTML', async t => {
	const actual = await extractCss(server.url + '/link-tag-html.html')
	const expected = fixture
	t.is(actual, expected)
})

test('it finds css in a <link> tag - JS', async t => {
	const actual = await extractCss(server.url + '/link-tag-js.html')
	const expected = fixture
	t.is(actual, expected)
})

test('it finds css in a <style> tag - HTML', async t => {
	const actual = await extractCss(server.url + '/style-tag-html.html')
	const expected = '.fixture { color: red; }'
	t.is(actual, expected)
})

test('it finds css in a <style> tag - JS', async t => {
	const actual = await extractCss(server.url + '/style-tag-js.html')
	const expected = '.fixture { color: red; }'
	t.is(actual, expected)
})

test('it finds css-in-js', async t => {
	const actual = await extractCss(server.url + '/css-in-js.html')
	const expected = '.bcMPWx { color: blue; }'
	t.is(actual, expected)
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
