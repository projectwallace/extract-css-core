const puppeteer = require('puppeteer')

function InvalidUrlError({url, statusCode, statusText}) {
	this.name = 'InvalidUrlError'
	this.message = `There was an error retrieving CSS from ${url}.\n\tHTTP status code: ${statusCode} (${statusText})`
}

InvalidUrlError.prototype = Error.prototype

module.exports = async (
	url,
	{waitUntil = 'networkidle2', customBrowser = null} = {}
) => {
	if (
		customBrowser !== null &&
		(!customBrowser.isConnected || !customBrowser.isConnected())
	) {
		return Promise.reject(
			new TypeError('The `customBrowser` option is invalid')
		)
	}

	// Setup a browser instance
	const browser = customBrowser || (await puppeteer.launch())

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
	// See: https://developer.mozilla.org/en-US/docs/Web/API/CSSRule/cssText
	const styleSheetsApiCss = await page.evaluate(() => {
		/* global document */
		return [...document.styleSheets]
			.map(stylesheet =>
				[...stylesheet.cssRules]
					.map(cssStyleRule => cssStyleRule.cssText)
					.join('')
			)
			.join('')
	})

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
		.join('')

	return Promise.resolve(styleSheetsApiCss + coverageCss)
}
