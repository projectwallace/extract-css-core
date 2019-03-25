const test = require('ava')
const extractCss = require('..')
const {validateBrowserOverride} = require('../src/validate')

test('it does basic validation on browserOverride', t => {
	const failures = [
		{},
		{executablePath: null},
		{executablePath: ''},
		{
			puppeteer: null
		},
		{puppeteer: {}},
		{puppeteer: {launch: null}}
	]
	const successes = [
		{
			executablePath: '/path/to/chromium',
			puppeteer: {launch: () => {}},
			args: []
		}
	]

	failures.forEach(failure => {
		t.throws(() => validateBrowserOverride(failure))
	})
	successes.forEach(success =>
		t.notThrows(() => validateBrowserOverride(success))
	)
})

test('it does basic validation on the browserOverride option', async t => {
	await t.throwsAsync(
		extractCss('http://google.com', {
			browserOverride: {
				executablePath: null
			}
		}),
		{
			message:
				'BrowserOverride is not valid. Check that executablePath is a valid string, got "null" https://github.com/bartveneman/extract-css-core#options'
		}
	)
	await t.throwsAsync(
		extractCss('http://google.com', {
			browserOverride: {
				puppeteer: null
			}
		}),
		{
			message:
				'BrowserOverride is not valid. Check that executablePath is a valid string, got "undefined" https://github.com/bartveneman/extract-css-core#options'
		}
	)
	await t.throwsAsync(
		extractCss('http://google.com', {
			browserOverride: {
				args: null
			}
		}),
		{
			message:
				'BrowserOverride is not valid. Check that executablePath is a valid string, got "undefined" https://github.com/bartveneman/extract-css-core#options'
		}
	)
})
