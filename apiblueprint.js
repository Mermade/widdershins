function convert(api, options, callback) {
	api = `---
title: Swagger Petstore v1.0.0
language_tabs:
toc_footers: []
includes: []
search: true
highlight_theme: darkula
---
` + api;
	callback(null, api);
}

module.exports = {
	convert : convert
};
