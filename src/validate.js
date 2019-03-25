function InvalidBrowserOverrideError(message) {
	this.name = 'InvalidBrowserOverrideError'
	this.message = `BrowserOverride is not valid. ${message} https://github.com/bartveneman/extract-css-core#options`
}

InvalidBrowserOverrideError.prototype = Error.prototype

exports.validateBrowserOverride = ({executablePath, args, puppeteer}) => {
	if (typeof executablePath !== 'string') {
		throw new InvalidBrowserOverrideError(
			`Check that executablePath is a valid string, got "${JSON.stringify(
				executablePath
			)}"`
		)
	}

	if (!Array.isArray(args)) {
		throw new InvalidBrowserOverrideError('Check that args is an Array.')
	}

	if (typeof puppeteer.launch !== 'function') {
		throw new InvalidBrowserOverrideError(
			'Check that puppeteer.launch is a function.'
		)
	}

	return true
}
