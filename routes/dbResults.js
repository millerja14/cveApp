//Require modules.
var express = require('express');
var router = express.Router();
var path = require('path');
var mongoose = require('mongoose');
var vulnModels = require(path.join(__dirname, '../', 'models/vulnConnection.js'));

//Define address for the mongo database.
var vulnURI = 'mongodb://localhost/vuln';

//Import and define model for the vulnerability database so it can be queried.
var vulnerability = vulnModels.vulnerability;

//Called when client sends an http get request.
router.get('/', function(req, res, next) {
	var resultCount = 0; //Set default result count

	//Set default search parameters that will be changed by the html
	//form query values
	var scoreLow = 0;
	var scoreHigh = 10;
	var descriptionKey = '';
	var productsKey = '';
	var CVEId = '';
	var attackVector = '';
	var resultLimit = 200;
	var sortType = '';

	//Define parameters for when a user searches by Id.
	if (req.query.type == 'id') {
		CVEId = 'CVE-' + req.query.year + '-' + req.query.cveId;
		console.log('CVEId: ' + CVEId);
	}

	//Define parameters for when a user searches by key words.
	if (req.query.type == 'keywords') {
		CVEId = 'CVE-' + req.query.year;
		descriptionKey = req.query.key;
		productsKey = req.query.product;
		scoreHigh = req.query.scoreMax;
		scoreLow = req.query.scoreMin;
		sortType = req.query.sort;
		attackVector = req.query.vector;
		resultLimit = parseInt(req.query.limit);

		//Set result limit for when user leaves input blank.
		if(isNaN(resultLimit)) {
			resultLimit = 200;
		}

		//Debug search parameters.
		console.log('resultLimit: ' + resultLimit);
		console.log('descriptionKey: ' + descriptionKey);
		console.log('productsKey: ' + productsKey);
		console.log('sortType: ' + sortType);
	}

	//Define what to sort and in what direction based on the sortType
	//parameter
	if (sortType == 'scoreDescending') {
		var sortValue = -1
		var sortField = 'score';
	} 
	if (sortType == 'scoreAscending') {
		var sortValue = 1;
		var sortField = 'score'
	}
	if (sortType == 'dateDescending') {
		var sortValue = -1
		var sortField = 'date';
	}
	if (sortType == 'dateAscending') {
		var sortValue = 1
		var sortField = 'date';
	}

	//Database query for when descriptionKey is present because full
	//text search needs to be used.
	if (descriptionKey != '') {
		var vulns = vulnerability.find(
			{$text: {$search: descriptionKey}},
			{score: {$meta: 'textScore'}}
		)
		.where(
			{Products: {$in: [new RegExp(productsKey, 'i')]}}
		)
		.where(
			{Score: {$lte: scoreHigh, $gte: scoreLow}}
		)
		.where(
			{AttackVector: {$regex: attackVector, $options: 'i'}}
		)
		.where(
			{CVEId: {$regex: CVEId, $options: 'i'}}
		)

		//Sort the database query results
		if (sortType == 'relevance') {
			console.log('Sorting by relevance.');
			vulns = vulns.sort(
				{score: {$meta: 'textScore'}}
			);
		} else {
			if (sortField == 'score') {
				console.log('Sorting by score.');
				vulns = vulns.sort(
					{Score: sortValue}
				);
			}
			if (sortField == 'date') {
				console.log('Sorting by date.');
				vulns = vulns.sort(
					{DCDateModified: sortValue}
				);
			}
		}
	}

	//Database query for when descriptionKey is blank because
	//full text search is not used.
	if (descriptionKey == '') {

		//If sortType and descriptionKey is blank, then the user
		//is finding by Id.
		if (sortType != '') {
			var vulns = vulnerability.find({
				Score: {$lte: scoreHigh, $gte: scoreLow},
				Products: {$in: [new RegExp(productsKey, 'i')]},
				CVEId: {$regex: CVEId, $options: 'i'},
				AttackVector: {$regex: attackVector, $options: 'i'}
			});

			//Sort query results.
			if(sortField == 'date') {
				console.log('Sorting by date.');
				vulns = vulns.sort(
					{DCDateModified: sortValue}
				);
			}
			if(sortField == 'score') {
				console.log('Sorting by score.');
				vulns = vulns.sort(
					{Score: sortValue}
				);
			}
					
		} else {
			console.log('Finding by id.')
			var vulns = vulnerability.find({
				CVEId: {$regex: CVEId, $options: 'i'}
			});
		}
	}

	//Limit number of results to display to reduce un-needed latency.
	vulns.limit(resultLimit).exec(function(err, vulnsOutput) {
			console.log('Rendering ouput page.');

			//Set resultCount to the number of results to be displayed. If
			//the output is empty, resultCount will remain at 0.
			if (typeof vulnsOutput != 'undefined') {
				resultCount = vulnsOutput.length;
			}

			//Render the final page with the results and the resultCount.
			res.render('results', {
				vulnList: vulnsOutput,
				Results: resultCount,
			});
		}
	);
});

module.exports = router;