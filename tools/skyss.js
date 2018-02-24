const request = require("request");
const cheerio = require("cheerio");
const moment = require("moment");

const skyssService = {
	getNextBybane: function() {
		const from = "Brann stadion, bybanestopp (Bergen)";
		const to = "Byparken, bybanestopp (Bergen)";
		const now = moment();
		const date = `${now.date()}.${now.month() + 1 > 12}.${now.year()}`;
		const time = `${now.hours()}:${
			now.minute() < 10 ? "0" + now.minute() : now.minute()
		}`;
		const skyssUrl = createSkyssUrl(from, to, date, time);

		return new Promise((resolve, reject) => {
			request.get(skyssUrl, (error, response, body) => {
				const $cheerio = cheerio.load(body);
				const times = new Array();
				$cheerio(".tm-result-header .tm-result-time").each(
					(index, header) => {
						const startTime = $cheerio(header)
							.children()
							.first();
						const endTime = $cheerio(header)
							.children()
							.last();

						const aTime = $cheerio(startTime)
							.children()
							.last()
							.text();
						const bTime = $cheerio(endTime)
							.children()
							.last()
							.text();
						times.push({
							start: aTime,
							end: bTime
						});
					}
				);
				resolve(times);
			});
		});
	}
};

// date must have format: day.month.year (2017)
// hour must have format: hour:minute
function createSkyssUrl(from, to, date, time) {
	const skyssUrl = `https://reiseplanlegger.skyss.no/scripts/TravelMagic/TravelMagicWE.dll/svar?from=${encodeURIComponent(
		from
	)}&to=${encodeURIComponent(
		to
	)}&direction=1&lang=nn&instant=1&date=${date}&time=${time}`;
	return skyssUrl;
}

module.exports = skyssService;
