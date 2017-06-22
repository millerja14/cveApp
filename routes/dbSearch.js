//Require modules and external funtions.
var express = require('express');
var router = express.Router();
var path = require('path');
var vuln = require(path.join(__dirname, '../', 'public/javascripts/updateDatabase.js'));
var init = require(path.join(__dirname, '../', 'public/javascripts/databaseInit.js'));
var vulnModels = require(path.join(__dirname, '../', 'models/vulnConnection.js'));
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

//Declare empty variables to be populated later.
var state = '';
var dbState = '';
var year;
var metaUrl = '';
var briefVulns;

//Import and define models.
var updated = vulnModels.updated;
var briefVulnerability = vulnModels.briefVulnerability;

//Function called recursively to retrieve the last updated date from each meta file
//and the last date each file was updated from the database. A 'for loop' did not
//wait for operations to be completed so a function and incrementing value are used.
var updatedLists = function(callback) {
	var meta = new XMLHttpRequest();
	var metaUrl = 'https://static.nvd.nist.gov/feeds/xml/cve/2.0/nvdcve-2.0-' + year + '.meta';
	meta.open('GET', metaUrl);
	meta.send();
	meta.onreadystatechange = function() {
		if (meta.readyState == 4 && meta.status == 200) {
			console.log('Connected to metadata file.')
			var metaResponse = meta.responseText;
			var rDW = metaResponse.split('lastModifiedDate:')[1].split('s')[0].split('-04:00')[0] + '.000-04:00';
			var metaDate = new Date(rDW);
			releaseDate.push(year + ': '+ metaDate);
			updated.find({File: year}, 'Id Date').sort({Id: -1}).limit(1).exec(function(err, outputDate) {
				if (typeof outputDate[0] != 'undefined') {
					updateDate.push(year + ': ' + outputDate[0].Date);
				} else {
					updateDate.push(year + ': ' + "couldn't find in database");
				}

				year++;
				if (year <= 2016) {
					updatedLists(callback);
				} else {
					callback();
				}
			});
		}
	};
	
}

//Called on any request to the route.
router.use(function(req, res, next) {
		if (req.method === 'GET') { 

			//Retrieves the server's ready state and translates it.
			vuln.readyState(function(readyState) {
				state = readyState;
				if (readyState == 1) {
					dbState = 'up';
				} else {
					dbState = 'down';
				}
				next();
			});
		}
	}, function(req, res, next) {
		if (req.method === 'GET') {

			//Find the earliest date in the database and call updatedLists to find dates
			//starting with that file.
			releaseDate = [];
			updateDate = [];
			updated.find({}, 'File').sort({File: 1}).limit(1).exec(function(err, latestDate) {
				if (!err) {
					year = latestDate[0].File;

					//Retrieve date from meta file and date from database and check if
					//they match.
					updatedLists(function() {
						for (var i = 0; i < releaseDate.length; i++) {

							//Depending on whether the two dates match, a tag will
							//be given and displayed before the date.
							if (releaseDate[i] != updateDate[i]) {
								updateDate[i] = '(needs update) ' + updateDate[i];
							} else {
								updateDate[i] = '(updated) ' + updateDate[i];
							}
						}
						next();
					});
				} else {
					next();
				}
			});	
		}
	}, function(req, res, next) {

		//Finds the latest 50 updates released in the brief vulnerability database
		//and displays them in a feed-like format.
		briefVulnerability.find({}).sort({DCDate: -1}).limit(50).exec(function(err, vulns) {
			briefVulns = vulns;
			next();
		});
	}
);

//Renders the page after the all the operations are complete and the preceding
//next(); function has been called.
router.get('/', function(req, res, next) {
	console.log('Rendering search page.')

	//Renders the search page view with all the data retrieved by this route.
  	res.render('search', {title: 'Working', 
  					listElement: 'List Element',
  					released: releaseDate,
  					updated: updateDate,
  					readyState: dbState,
  					updatedAlert: req.query.updated,
  					briefVulnList: briefVulns
  	});
});



module.exports = router;