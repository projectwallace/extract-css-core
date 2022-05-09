/* global document */
const puppeteer = require('puppeteer')
const normalizeUrl = require('normalize-url')

function InvalidUrlError({ url, statusCode, statusText }) {
	this.name = 'InvalidUrlError'
	this.message = `There was an error retrieving CSS from ${url}.\n\tHTTP status code: ${statusCode} (${statusText})`
}

InvalidUrlError.prototype = Error.prototype

/**
 * @param {string} url URL to get CSS from
 * @param {string} waitUntil https://github.com/puppeteer/puppeteer/blob/master/docs/api.md#pagegotourl-options
 * @param {string} timeout https://github.com/puppeteer/puppeteer/blob/master/docs/api.md#pagegotourl-options
 * @param {string} origins Can either be 'include' or 'exlude'
 * @param {string} inlineStyles Can either be 'include' or 'exlude'
 * @returns {string} All CSS that was found
 */
module.exports = async (url, {
	waitUntil = 'networkidle0',
	timeout = 10000,
	origins = 'exclude',
	inlineStyles = 'include'
} = {}) => {
	// Setup a browser instance
	const browser = await puppeteer.launch()

	// Create a new page and navigate to it
	const page = await browser.newPage()

	// Set an explicit UserAgent, because the default UserAgent string includes something like
	// `HeadlessChrome/88.0.4298.0` and some websites/CDN's block that with a HTTP 403
	await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.16; rv:85.0) Gecko/20100101 Firefox/85.0')

	url = normalizeUrl(url, { stripWWW: false })

	let response

	// Explicit try-catch for when pages timeout
	try {
		response = await page.goto(url, {
			waitUntil,
			timeout
		})
	} catch (error) {
		// In case of timeouts
		await browser.close()

		throw error
	}

	// Make sure that we only try to extract CSS from valid pages.
	// Bail out if the response is an invalid request (400, 500)
	if (response.status() >= 400) {
		await browser.close() // Don't leave any resources behind

		throw new InvalidUrlError({
			url,
			statusCode: response.status(),
			statusText: response.statusText()
		})
	}

	// If the response is a CSS file, return that file
	// instead of running our complicated setup
	const headers = response.headers()

	if (headers['content-type'].includes('text/css')) {
		const css = await response.text()
		await browser.close()
		return css
	}

	// Get all CSS generated with the CSSStyleSheet API
	// This is primarily for CSS-in-JS solutions
	// See: https://developer.mozilla.org/en-US/docs/Web/API/CSSRule/cssText
	const styleSheetsApiCss = await page.evaluate(() => {
		function getCssFromStyleSheet(stylesheet) {
			var items = []
			var styleType = stylesheet.ownerNode ?
				stylesheet.ownerNode.tagName.toLowerCase() :
				'import'

			if (styleType === 'style') {
				items.push({
					type: 'style',
					css: stylesheet.ownerNode.textContent,
					href: document.location.href,
				})
			}

			if (styleType === 'link') {
				items.push({
					type: 'link',
					css: undefined,
					href: stylesheet.ownerNode.href,
				})
			}

			var sheetCss = ''

			for (var rule of stylesheet.cssRules) {
				// eslint-disable-next-line no-undef
				if (rule instanceof CSSImportRule) {
					items.push({
						type: 'import',
						href: rule.href,
						css: undefined,
					})
					var imported = getCssFromStyleSheet(rule.styleSheet)
					items = items.concat(imported)
				}

				if (styleType === 'style') {
					sheetCss += rule.cssText

					items.push({
						type: 'style',
						href: document.location.href,
						css: sheetCss
					})
				}
			}

			return items
		}

		let styles = []

		for (const stylesheet of document.styleSheets) {
			styles = styles.concat(getCssFromStyleSheet(stylesheet))
		}

		return styles
	})
	console.log(styleSheetsApiCss)

	// const allCss = await Promise.all(styleSheetsApiCss.map(item => {
	// 	return {

	// 	}
	// }))

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
	//    [x-extract-css-inline-style] { color: red; }
	//
	let inlineCss = []
	if (inlineStyles !== 'exclude') {
		const inlineCssRules = await page.evaluate(() => {
			return [...document.querySelectorAll('[style]')]
				.map(element => element.getAttribute('style'))
				// Filter out empty style="" attributes
				.filter(Boolean)
		})
		inlineCss = inlineCssRules
			.map(rule => `[x-extract-css-inline-style] { ${rule} }`)
			.map(css => ({ type: 'inline', href: url, css }))
	}

	await browser.close()

	const css = styleSheetsApiCss.concat(inlineCss)

	// Return the complete structure ...
	if (origins === 'include') {
		return css
	}

	// ... or return all CSS as a single String
	return css
		.map(({ css }) => css)
		.join('\n')
}
