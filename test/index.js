const test = require('ava')
const createTestServer = require('create-test-server')
const {readFileSync} = require('fs')
const {resolve} = require('path')
const extractCss = require('..')

let server
const expected = readFileSync(resolve(__dirname, 'fixture.css'), 'utf8')

test.before(async () => {
	server = await createTestServer()

	server.get('/fixture.css', (req, res) => {
		res.send(expected)
	})
})

test.after(async () => {
	await server.close()
})

test('it fetches css from a page with CSS in a server generated <link> inside the <head>', async t => {
	const url = '/server-link-head'
	server.get(url, (req, res) => {
		res.send(`
			<!doctype>
			<html>
				<head>
					<link rel="stylesheet" href="fixture.css" />
				</head>
			</html>
    `)
	})

	const actual = await extractCss(server.url + url)

	t.is(actual, expected)
})

test('it fetches css from a page with CSS in server generated <style> inside the <head>', async t => {
	const url = '/server-style-head'
	server.get(url, (req, res) => {
		res.send(`
			<!doctype>
			<html>
				<head>
					<style>${expected.trim()}</style>
				</head>
			</html>
    `)
	})

	const actual = await extractCss(server.url + url)

	t.is(actual, expected.trim())
})

test('it finds JS generated <link /> CSS', async t => {
	const path = '/js-generated-link'
	const cssInJsExampleHtml = readFileSync(
		resolve(__dirname, 'js-create-link-element.html'),
		'utf8'
	)

	server.get(path, (req, res) => {
		res.send(cssInJsExampleHtml)
	})

	const actual = await extractCss(server.url + path)

	t.is(actual, expected)
})

test('it finds JS generated <style /> CSS', async t => {
	const url = '/js-generated-js-style-tag'
	const cssInJsExampleHtml = readFileSync(
		resolve(__dirname, 'js-create-style-element.html'),
		'utf8'
	)
	server.get(url, (req, res) => {
		res.send(cssInJsExampleHtml)
	})

	const actual = await extractCss(server.url + url, {waitUntil: 'load'})
	const expected = `body { color: teal; }`

	t.is(actual, expected)
})

test('it combines server generated <link> and <style> tags with client side created <link> and <style> tags', async t => {
	const path = '/kitchen-sink'
	const kitchenSinkExample = readFileSync(
		resolve(__dirname, 'kitchen-sink.html'),
		'utf8'
	)
	server.get(path, (req, res) => {
		res.send(kitchenSinkExample)
	})

	const actual = await extractCss(server.url + path)

	t.snapshot(actual)
})

test('it rejects if the url has an HTTP error status', async t => {
	const urlWith404 = server.url + '/404-page'
	await t.throwsAsync(extractCss(urlWith404), {
		message: `There was an error retrieving CSS from ${urlWith404}.\n\tHTTP status code: 404 (Not Found)`
	})
})

test('it rejects on an invalid url', async t => {
	await t.throwsAsync(extractCss('site.example'))
})

// TODO: write coverage for dynamically inserted style tags
test.skip('it finds CSS-in-JS (styled components)', async t => {
	const path = '/css-in-js'
	const cssInJsExampleHtml = readFileSync(
		resolve(__dirname, 'css-in-js.html'),
		'utf8'
	)
	server.get(path, (req, res) => {
		res.send(cssInJsExampleHtml)
	})

	const actual = await extractCss(server.url + path)
	const expected = 'lots of JS generated classNames and styles'

	t.is(actual, expected)
})
