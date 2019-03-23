const puppeteer = require('puppeteer')

function InvalidUrlError({url, statusCode, statusText}) {
	this.name = 'InvalidUrlError'
	this.message = `There was an error retrieving CSS from ${url}.\n\tHTTP status code: ${statusCode} (${statusText})`
}

InvalidUrlError.prototype = Error.prototype

module.exports = async (
	url,
	{debug = false, waitUntil = 'networkidle2', customBrowser = {}} = {}
) => {
	const browserOptions = {
		headless: debug !== true,
		puppeteer
	}

	// Replace the puppeteer instance if a custom one is provided
	// This also means that the executablePath needs to be set to
	// a custom path where some chromium instance is running.
	if (
		customBrowser &&
		customBrowser.executablePath &&
		customBrowser.customPuppeteer
	) {
		browserOptions.executablePath = customBrowser.executablePath
		browserOptions.puppeteer = customBrowser.customPuppeteer
	}

	// Setup a browser instance
	const browser = await browserOptions.puppeteer.launch(browserOptions)

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

	// Fetch all <style> tags from the page, because the coverage
	// API may have missed some JS-generated <style> tags.
	// Some of them *were* already caught by the coverage API,
	// but they will be removed later on to prevent duplicates.
	const styleTagsCss = (await page.$$eval('style', styles => {
		// Get the text inside each <style> tag and trim() the
		// results to prevent all the inside-html indentation
		// clogging up the results and making it look
		// bigger than it actually is
		return styles.map(style => style.innerHTML.trim())
	})).join('')

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

	return Promise.resolve(coverageCss + styleTagsCss)
}
