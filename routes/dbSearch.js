//Require modules and external funtions.
var express = require('express');
var mongoose = require('mongoose');
var router = express.Router();
var path = require('path');
var init = require(path.join(__dirname, '../', 'public/javascripts/databaseInit.js'));
var vulnModels = require(path.join(__dirname, '../', 'models/vulnConnection.js'));
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

//require('./app.js');

var today;
var incYear;
var currentYear;

//Declare empty variables to be populated later.
var state = '';
var dbState = '';
var year;
var metaUrl = '';
var briefVulns;
var needsUpdate;

//Import and define models.
var updated = vulnModels.updated;
var briefVulnerability = vulnModels.briefVulnerability;

//Function called recursively to retrieve the last updated date from each meta file
//and the last date each file was updated from the database. A 'for loop' did not
//wait for operations to be completed so a function and incrementing value are used.
var updatedLists = function(incYear, callback) {
	if (incYear <= currentYear) {
		var meta = new XMLHttpRequest();
		var metaUrl = 'https://static.nvd.nist.gov/feeds/xml/cve/2.0/nvdcve-2.0-' + incYear + '.meta';
		meta.open('GET', metaUrl);
		meta.send();
		meta.onreadystatechange = function() {
		if (meta.readyState == 4 && meta.status == 200) {
			console.log('Connected to metadata file.')
			var metaResponse = meta.responseText;
			var rDW = metaResponse.split('lastModifiedDate:')[1].split('s')[0].split('-04:00')[0] + '.000-04:00';
			var metaDate = new Date(rDW);
			updated.findOne({File: incYear}, 'Id Date').limit(1).exec(function(err, outputDate) {
				if (typeof outputDate != 'undefined') {
					console.log('outputDate: ' + outputDate.Date);
					console.log('metaDate: ' + metaDate);
					if (outputDate.Date != metaDate) {
						console.log(incYear + ' is out of date.');
						needsUpdate.push([incYear, Math.abs(metaDate - outputDate.Date)/1000/60]);
					} else {
						console.log(incYear + ' is up to date.');
					}
				} else {
					console.log('Couldnt find: ', incYear);
				}

				updatedLists(incYear + 1, callback);
			});
		}
	};
	} else {
		callback();
	}
}

//Renders the page after getting MongoDB readystate
router.get('/', function(req, res, next) {
		//Find the earliest date in the database and call updatedLists to find dates
		//starting with that file.
		needsUpdate = [];

		today = new Date();
		currentYear = today.getYear() + 1900;

		updated.find({}, 'File').sort({File: 1}).limit(1).exec(function(err, latestDate) {
			if (!err) {
				incYear = latestDate[0].File;

				//Retrieve date from meta file and date from database and check if
				//they match.
				updatedLists(incYear, function() {
					next();
				});
			} else {
				next();
			}
		});	
	}, function(req, res, next) {
		console.log('Rendering search page.')
		var readyState = mongoose.connection.readyState;
		state = readyState;
		if (readyState == 1) {
			dbState = 'up';
		} else {
			dbState = 'down';
		}

		//Renders the search page view with all the data retrieved by this route.
		res.render('search', {title: 'Working', 
			listElement: 'List Element',
			needsUpdate: needsUpdate,
			readyState: dbState,
			updatedAlert: req.query.updated
		});
	}
);



	



module.exports = router;