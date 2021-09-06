/* global document */
const puppeteer = require('puppeteer')
const normalizeUrl = require('normalize-url')

function InvalidUrlError({url, statusCode, statusText}) {
	this.name = 'InvalidUrlError'
	this.message = `There was an error retrieving CSS from ${url}.\n\tHTTP status code: ${statusCode} (${statusText})`
}

InvalidUrlError.prototype = Error.prototype

/**
 * @param {string} url URL to get CSS from
 * @param {string} waitUntil https://github.com/puppeteer/puppeteer/blob/master/docs/api.md#pagegotourl-options
 * @param {Object} launchOptions https://github.com/puppeteer/puppeteer/blob/main/docs/api.md#puppeteerlaunchoptions
 * @returns {string} All CSS that was found
 */
module.exports = async (
	url, 
	{ 
		waitUntil = 'networkidle0',
		origins = 'exclude', 
		launchOptions = { 
			headless: true,
			args: [],
		}
	} = {}
	) => {
	// Setup a browser instance
	const browser = await puppeteer.launch(launchOptions)

	// Create a new page and navigate to it
	const page = await browser.newPage()

	// Set an explicit UserAgent, because the default UserAgent string includes something like
	// `HeadlessChrome/88.0.4298.0` and some websites/CDN's block that with a HTTP 403
	await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.16; rv:85.0) Gecko/20100101 Firefox/85.0')
	await page.coverage.startCSSCoverage()
	url = normalizeUrl(url, {stripWWW: false})
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

	// If the response is a CSS file, return that file
	// instead of running our complicated setup
	const headers = response.headers()

	if (headers['content-type'].includes('text/css')) {
		const css = await response.text()
		return Promise.resolve(css)
	}

	const coverage = await page.coverage.stopCSSCoverage()

	// Get all CSS generated with the CSSStyleSheet API
	// This is primarily for CSS-in-JS solutions
	// See: https://developer.mozilla.org/en-US/docs/Web/API/CSSRule/cssText
	const styleSheetsApiCss = await page.evaluate(() => {
		return [...document.styleSheets]
			// Only take the stylesheets without href, because those with href are
			// <link> tags, and we already tackled those with the Coverage API
			.filter(stylesheet => stylesheet.href === null)
			.map(stylesheet => {
				return {
					type: stylesheet.ownerNode.tagName.toLowerCase(),
					href: stylesheet.href || document.location.href,
					css: [...stylesheet.cssRules].map(({cssText}) => cssText).join('\n')
				}
			})
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
	//    [x-extract-css-inline-style] { color: red; }
	//
	const inlineCssRules = await page.evaluate(() => {
		return [...document.querySelectorAll('[style]')]
			.map(element => element.getAttribute('style'))
			// Filter out empty style="" attributes
			.filter(Boolean)
	})
	const inlineCss = inlineCssRules
		.map(rule => `[x-extract-css-inline-style] { ${rule} }`)
		.map(css => ({type: 'inline', href: url, css}))

	const links = coverage
		// Filter out the <style> tags that were found in the coverage
		// report since we've conducted our own search for them.
		// A coverage CSS item with the same url as the url of the page
		// we requested is an indication that this was a <style> tag
		.filter(entry => entry.url !== url)
		.map(entry => ({
			href: entry.url,
			css: entry.text,
			type: 'link-or-import'
		}))

	await browser.close()

	const css = links
		.concat(styleSheetsApiCss)
		.concat(inlineCss)

	// Return the complete structure ...
	if (origins === 'include') {
		return Promise.resolve(css)
	}

	// ... or return all CSS as a single String
	return Promise.resolve(
		css
			.map(({css}) => css)
			.join('\n')
	)
}
