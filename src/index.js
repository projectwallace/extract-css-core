/* global document */

const puppeteer = require('puppeteer')
const crypto = require('crypto')

function hashString(str) {
	return crypto.createHash('md5').update(str, 'utf8').digest('hex')
}

function InvalidUrlError({url, statusCode, statusText}) {
	this.name = 'InvalidUrlError'
	this.message = `There was an error retrieving CSS from ${url}.\n\tHTTP status code: ${statusCode} (${statusText})`
}

InvalidUrlError.prototype = Error.prototype

/**
 * @param {string} url URL to get CSS from
 * @param {string} waitUntil https://github.com/puppeteer/puppeteer/blob/master/docs/api.md#pagegotourl-options
 */
module.exports = async (url, {waitUntil = 'networkidle0'} = {}) => {
	// Setup a browser instance
	const browser = await puppeteer.launch()

	// Create a new page and navigate to it
	const page = await browser.newPage()

	// Start CSS coverage. This is the meat and bones of this module
	await page.coverage.startCSSCoverage()
	const response = await page.goto(url, {waitUntil})

	// Make sure that we only try to extract CSS from valid pages.
	// Bail out if the response is an invalid request (400, 500)
	if (response.status() >= 400) {
		await browser.close() // Don't leave any resources behind

		return Promise.reject(
			new InvalidUrlError({
				url,
				statusCode: response.status(),
				statusText: response.statusText()
			})
		)
	}

	// Coverage contains a lot of <style> and <link> CSS,
	// but not all...
	const coverage = await page.coverage.stopCSSCoverage()

	// Get all CSS generated with the CSSStyleSheet API
	// This is primarily for CSS-in-JS solutions
	// See: https://developer.mozilla.org/en-US/docs/Web/API/CSSRule/cssText
	const styleSheetsApiCss = await page.evaluate(() => {
		return [...document.styleSheets]
			.filter(stylesheet => stylesheet.href === null)
			.map(stylesheet =>
				[...stylesheet.cssRules]
					.map(cssStyleRule => cssStyleRule.cssText)
					.join('\n')
			)
			.join('\n')
	})

	// Get all inline styles: <element style="">
	// This creates a new CSSRule for every inline style
	// attribute it encounters.
	//
	// Example:
	//
	// HTML:
	//    <h1 style="color: red;">Text</h1>
	//
	// CSSRule:
	//    [x-inline-style-237a7d] { color: red; }
	//                    ^^^^^^
	//
	// The 6-digit hash is based on the actual CSS, so it's not
	// necessarily unique!
	const inlineCssRules = await page.evaluate(() => {
		return [...document.querySelectorAll('[style]')]
			.map(element => element.getAttribute('style'))
			.filter(Boolean)
	})
	const inlineCss = inlineCssRules
		.map(rule => {
			const hash = hashString(rule).slice(-6)
			return `[x-inline-style-${hash}] { ${rule} }`
		})
		.join('\n')

	await browser.close()

	// Turn the coverage Array into a single string of CSS
	const coverageCss = coverage
		// Filter out the <style> tags that were found in the coverage
		// report since we've conducted our own search for them.
		// A coverage CSS item with the same url as the url of the page
		// we requested is an indication that this was a <style> tag
		.filter(styles => styles.url !== url)
		// The `text` property contains the actual CSS
		.map(({text}) => text)
		.join('\n')

	const css = [styleSheetsApiCss, coverageCss, inlineCss]
		.filter(Boolean)
		.join('\n')

	return Promise.resolve(css)
}
