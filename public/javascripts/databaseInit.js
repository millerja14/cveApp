//Require node modules for use in the program
var mongoose = require('mongoose');
var fs = require('fs');
var https = require('https');
var path = require('path');
var xmldom = require('xmldom');
var unzip = require('unzip');
var schedule = require('node-schedule');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

//Set up schedule for database to check for updates.
var updateRule = new schedule.RecurrenceRule();
updateRule.hour = 2;
updateRule.minute = 0;

//Define url for the products xml file hosted by the nvd.
var cveProductsURL = 'https://static.nvd.nist.gov/feeds/xml/cpe/dictionary/official-cpe-dictionary_v2.3.xml';

var oldId;
var lastUpdatedDate = '';

var productSave = {};
var productLoaded = false;

//Define the current year (The last file to update) and the start
//year (the first file to update)
var date = new Date();
var currentYear = date.getYear() + 1900;
var startYear = 2002;

//Define local path for temporarily storing the zip file.
var cveAnnualPath = (path.join(__dirname, '../', 'annual.zip'));

//Define local paths for temporarily storing the xml files after they are parsed.
var cveAnnualPathXML = (path.join(__dirname, '../', 'annual.xml'));
var cveProductsPathXML = (path.join(__dirname, '../', 'products.xml'));

//Import and define models for the mongo database.
var vulnModels = require(path.join(__dirname, '../../', 'models/vulnConnection.js'));
var count = vulnModels.count;
var vulnerability = vulnModels.vulnerability;
var updated = vulnModels.updated;

var prevInc;

vulnerability.findOne().sort('-Count').exec(function(err, countReturn) {
	if (countReturn == null) {
		prevInc = 0;
	} else {
		prevInc = countReturn + 1;
	}
});

//The database update will only run if startCheck is set to 0.
var startCheck = 0;

//Called when the there is an attempted update to check whether an update is already
//in progress.
var dbCheckBeginUpdate = function() {
	if (startCheck == 0) {
		dbBeginUpdate(function() {

		}, false);
	}
}

//Acts as a for loop and iterates through all the files between the startYear
//and the current year, and ends by unloading the xml and zip files.
var dbBeginUpdate = function(callback, force) {
	startCheck = 1; //Blocking any other attemps to update.
	//Exports the contents of the file.
	//Define urls for each meta file
	if (startYear > currentYear) {
		unloadFiles(callback);
	} else {

		//Generates the metadata url and zip url for the current year
		var currentMetaUrl = 'https://static.nvd.nist.gov/feeds/xml/cve/2.0/nvdcve-2.0-' + startYear + '.meta';
		var currentZipUrl = 'https://static.nvd.nist.gov/feeds/xml/cve/nvdcve-2.0-' + startYear + '.xml.zip'
		getMeta(currentMetaUrl, currentZipUrl, callback, force);
	}
}

//Gets the date of last update from the meta file for the xml file that is being
//checked. This date will be matched with the last updated date from the database
//in updateDate to determine whether an update is needed.
var getMeta = function(currentMetaUrl, currentZipUrl, callback, force) {
	var meta = new XMLHttpRequest();
	meta.open('GET', currentMetaUrl);
	meta.send();
	meta.onreadystatechange = function() {
		if (meta.readyState == 4 && meta.status == 200) {
			var metaResponse = meta.responseText;
			lastUpdatedDate = metaResponse.split('lastModifiedDate:')[1].split('s')[0].split('-04:00')[0] + '.000-04:00';
			var lastUpdatedDay = parseInt(lastUpdatedDate.split(/[-T]+/)[2]);
			var lastUpdatedMonth = parseInt(lastUpdatedDate.split(/[-T]+/)[1]);
			updateDate(lastUpdatedDay, lastUpdatedDate, lastUpdatedMonth, currentZipUrl, callback, force);
		}
	};
}

//Checks for each annual document whether it is up to date and will only edit the database
//if it is. The force parameter is for checking whether the db should update
//even if the date modified has not changed since last update. This allows for debugging.
var updateDate = function(lastUpdatedDay, lastUpdatedDate, lastUpdatedMonth, currentZipUrl, callback, force) {
	
	//Previous dates on which each year's document was updated are stored in the 'updated' collection
	//of the database. This locates the date from the current year of the loop with the largest Id, which will be the date
	//that was added most recently. The entire collection along with each document's
	//Id and Date property is retrieved and then narrowed by sorting by descending Id
	//and limiting the selection to only one document.
	updated.find({File: startYear}, 'Id Date').sort({Id: -1}).limit(1).exec(function(err, outputDate) {
		console.log('\nTesting whether to update file: ' + startYear);
		oldId = 0;
		var oldDay = '';
		var oldMonth = '';

		//If there is no data discovered by the find function, then the old date
		//will not be defined.
		if (typeof outputDate[0] != 'undefined') {
			var outputNewDate = new Date(outputDate[0].Date)
			var oldDay = outputNewDate.getDate();
			var oldMonth = outputNewDate.getMonth() + 1;
			oldId = outputDate[0].Id;
			console.log('The old day is: ' + oldDay + ' The old month is: ' + oldMonth);
			console.log('The new day is: ' + lastUpdatedDay + ' The new month is: ' + lastUpdatedMonth);
		}
		
		
		//Checks if the date is the same to determine whether the db should update. Also
		//checks if the force condition is true in case the database needs to be updated
		//manually. If oldDay is empty, it means that no date was found and that
		//an update should take place and this new date should be saved.
		if (force == true || oldDay == '' || oldDay != lastUpdatedDay || oldMonth != lastUpdatedMonth) {
			if (!force) {
				console.log(startYear + ' file is outdated. Proceeding to update.');
			} else {
				console.log('Forcing update.');
			}
			console.log('Adding an updated date to the database: ' + lastUpdatedDate);

			vulnerability
			.find({CVEId: {$regex: 'CVE-' + startYear, $options: 'i'}})
			.remove(function() {
				console.log(startYear + ' documents removed.');

				//When the db is empty, updateGoAhead is called to begin the process
				//of updating the db by importing a list of product Ids for
				//future use in crossreferencing. xmlFile is the parsed
				//vulnerabilities xml filed and is passed to the function.
				updateGoAhead(currentZipUrl, callback, force);
			});	
		} else {

			//If the last modified date has not changed and the update is not forced,
			//then startYear will increment and dbBeginUpdate will be called to check
			//the next file.
			console.log('Date not new, aborting db update for ' + startYear + ' file.');
			startYear++;
			dbBeginUpdate(callback, force);
		}
	});	
}

//Import of the current vulnerabilities zip file, unzips it to the temporary xml path,
//then exports the xml.
var updateGoAhead = function(currentUrl, callback, force) {
	console.log('About to import zip.');
	var zipImport = fs.createWriteStream(cveAnnualPath);
	var request = https.get(currentUrl, function(response) {
	 	response.pipe(zipImport);
	});

	//Executed when the zip file has uploaded.
	zipImport.on('finish', function() {
		
		//Unzips xml file.
		fs.createReadStream(cveAnnualPath).pipe(unzip.Parse()).on('entry', function (entry) {
			console.log('Xml file unzipped.');
			
			//Pipes the unzipped file to the temporary local storage location.
			var xmlImport = entry.pipe(fs.createWriteStream(cveAnnualPathXML));
			
			//Executed when the xml file is imported.
			xmlImport.on('finish', function() {
				console.log('Finished xml import.');
				
				//Reads the xml file.
				fs.readFile(cveAnnualPathXML, 'utf-8', function(err, xmlToParse) {
					console.log('Read xml file.');
					if (err) {
						throw err;
					}
					console.log('Loading xml from: ' + cveAnnualPathXML);

					var parser = xmldom.DOMParser; //Define the parser for the xml file.
					var xmlFile = new parser().parseFromString(xmlToParse, 'text/xml'); //Parse the xml.
					
					/*if (!productLoaded) {
						parseProducts(xmlFile, callback, force);
					} else {
						listCompile(productSave, xmlFile, callback, force);*/
						listCompile(xmlFile, callback, force);
					//}
				});
			})
		});
	});
}

//Imports the xml file containing a list of product Ids and their corresponding
//product names for future use in cross referencing.
var parseProducts = function(vulnContents, callback, force) {

	//Imports the products xml file to a temporary path in local storage.
	var xmlImportProd = fs.createWriteStream(cveProductsPathXML);
	var request = https.get(cveProductsURL, function(response) {
  		response.pipe(xmlImportProd);
	});

	//Called when the products xml file is finished uploading.
	xmlImportProd.on('finish', function() {

		//Reads the file and sends the products xml file as well as the parsed
		//vulnerabilites data to listCompile as prodContents and vulnContents.
		fs.readFile(cveProductsPathXML, 'utf-8', function(err, prodContents) {
			console.log('Imported and read products file');

			//Parse the products xml file.
			console.log('Loading xml from: ' + cveProductsPathXML);
			var parser = xmldom.DOMParser;
			var productXmlFile = new parser().parseFromString(prodContents, 'text/xml');
			productLoaded = true;

			//Defines the set of nodes in the products xml file that are the headers of each
			//product.
			var cpeItem = productXmlFile.getElementsByTagName('cpe-item');

			//Declare an empty object that will be populated with Ids and each's matcing
			//product name.
			var cpeItemObject = {};

			//Populates the cpeItemObject that will be used to crossreference from the
			//vulnerabilities xml file later.
			console.log('Compiling product references.');

			//Iterates through each header node and retrieves the product Id and name.
			//cpeItem.length is the number of nodes with tag name: 'cpe-item'.
			for (g = 0; g < cpeItem.length; g++) {
				var productIDProp = cpeItem[g].getAttribute('name'); //Retrieve product Id

				//Choose which node under the header node to take the product name from. There
				//are names in varying languages. This will choose the node with the english
				//name if possible, and otherwise choose any node available.
				if (cpeItem[g].getElementsByTagName('title')[0].getAttribute('xml:lang') == 'en-US' || typeof cpeItem[g].getElementsByTagName('title')[1] == 'undefined') {
					var lang = 0;
				} else {
					var lang = 1;
				}
				
				//Define productName as the value of either node 0 or 1 as chosen above.
				var productName = cpeItem[g].getElementsByTagName('title')[lang].childNodes[0].nodeValue;

				//Gives the cpeItemObject a property titled with the Id, which references the corresponding name.
				cpeItemObject[productIDProp] = productName;
			}

			productSave = cpeItemObject;

			//listCompile(cpeItemObject, vulnContents, callback, force);
		});
	});
}

//The main component of the vulnerabilities db update. listCompile parses the products
//xml file, and then retrieves data from both the products file and vulnerabilities file
//that is saved into several lists. There is a list for each property that is being
//saved for each vulnerability as defined in the vulnerabilites schema.
var listCompile = function(vulnXmlFile, callback, force) {

	//Declare each list that will be populated with data from the vulnerabilities
	//and products xml files.
	var cveIds = [];
	var products2 = [];
	var manufacturers = [];
	var descriptions = [];
	var createdDates = [];
	var modifiedDates = [];
	var scores = [];
	var attackVectors = [];
	var attackComplexities = [];
	var authentications = [];
	var confImpacts = [];
	var intImpacts = [];
	var availImpacts = [];
	var references2 = [];

	//Defines the set of nodes in the vulnerabilities xml file with the 'entry' tag as
	//this is the header tag for each vulnerability.
	var entry = vulnXmlFile.getElementsByTagName('entry');

	//undCount is the count of vulnerabilities in the file that have been removed and
	//only exist as placeholders. These contain no information besides an CVE Id so
	//have no use. This count start at 0 and increment as placeholders are discovered.
	var undCount = 0;

	//This loop iterates through each entry node in the vulnerabilities document and retrieves specific data.
	console.log('Number of entries: ' + entry.length);
	for (i = 0; i < entry.length; i++) {

		//Check that the entry is not a placeholder (placeholders do not have a software list field).
		if (typeof entry[i].getElementsByTagName('vuln:vulnerable-software-list')[0] != 'undefined') {
			var cveId = entry[i].getAttribute('id'); //Define the Id of the entry.

			//Define the number of product Ids listed in the vulnerabilites document under the entry node,
			//create an empty array for storing the list of product Ids associated with the entry node.
			var productLength = entry[i].getElementsByTagName('vuln:vulnerable-software-list')[0].getElementsByTagName('vuln:product').length;
			var products1 = [];
			
			//Iterates through each product Id under the entry node and matches it to a product name
			//from the previously populated object of product Ids and product names.
			for (e = 0; e < productLength; e++) {

				//Define the product Id for this iteration through the list.
				var product = entry[i].getElementsByTagName('vuln:vulnerable-software-list')[0].getElementsByTagName('vuln:product')[e].childNodes[0].nodeValue;

				//If the Id exists as a property within the cpeItemObject object, then productEntry will be assigned to this name.
				//Otherwise, productEntry will remain in the product Id form.
				/*if (typeof cpeItemObject[product] != 'undefined') {
					var productEntry = cpeItemObject[product];
				} else {*/
					var productEntry = product;
				//}

				//Adds productEntry to the array of products for this entry.
				products1.push(productEntry);
			}

			//Retrieving and storing information from various datafiels of the current entry node
			var manufacturer = product; //Not yet implemented.
			var description = entry[i].getElementsByTagName('vuln:summary')[0].childNodes[0].nodeValue;
			var createdDate = entry[i].getElementsByTagName('vuln:published-datetime')[0].childNodes[0].nodeValue;
			var modifiedDate = entry[i].getElementsByTagName('vuln:last-modified-datetime')[0].childNodes[0].nodeValue;
			
			var metrics = entry[i].getElementsByTagName('vuln:cvss')[0].getElementsByTagName('cvss:base_metrics')[0];
			var score = metrics.getElementsByTagName('cvss:score')[0].childNodes[0].nodeValue;
			var attackVector = metrics.getElementsByTagName('cvss:access-vector')[0].childNodes[0].nodeValue;
			var attackComplexity = metrics.getElementsByTagName('cvss:access-complexity')[0].childNodes[0].nodeValue;
			var authentication = metrics.getElementsByTagName('cvss:authentication')[0].childNodes[0].nodeValue;
			var confImpact = metrics.getElementsByTagName('cvss:confidentiality-impact')[0].childNodes[0].nodeValue;
			var intImpact = metrics.getElementsByTagName('cvss:integrity-impact')[0].childNodes[0].nodeValue;
			var availImpact = metrics.getElementsByTagName('cvss:availability-impact')[0].childNodes[0].nodeValue;
			
			//Retrives list of reference links using a similar process to that used when
			//iterating through product Ids.
			var referenceLength = entry[i].getElementsByTagName('vuln:references').length;
			var references1 = [];
			for (f = 0; f < referenceLength; f++) {
				var reference = entry[i].getElementsByTagName('vuln:reference')[f].getAttribute('href');
				references1.push(reference);
			}

			//All data from the current header is pushed to a master list and will later be retrieved
			//and saved to the db in an incrementing loop.
			cveIds.push(cveId);
			products2.push(products1);
			manufacturers.push(manufacturer);
			descriptions.push(description);
			createdDates.push(createdDate);
			modifiedDates.push(modifiedDate);
			scores.push(score);
			attackVectors.push(attackVector);
			attackComplexities.push(attackComplexity);
			authentications.push(authentication);
			confImpacts.push(confImpact);
			intImpacts.push(intImpact);
			availImpacts.push(availImpact);
			references2.push(references1);
		} else {

			//If the software list field is undefine and the entry is a placeholder, information
			//will not be extracted and the undCount will increase. undCount is later subtracted
			//from the entry.length to provide an accurate count of populated entries retrieved
			//from the vulnerabilities xml document.
			undCount++;
			console.log('Number of empty entries to subtract: ' + undCount);
		}
	}

	//When the for loop is finished and the list is compiled, newEntry will be called passing all
	//of the lists of data as well as undCount for use in incrementation and the callback. 'entry'
	//is passed to determine again its length (the number of entries in the xml file).
	console.log('Vulnerability list compiled.');
	newEntry(cveIds, products2, manufacturers, descriptions, createdDates, modifiedDates, 
		scores, attackVectors, attackComplexities, authentications, confImpacts, 
		intImpacts, availImpacts, references2, entry, undCount, callback, force);
}

//Adds an entry to the vulnerabilities db for each entry in the data lists.
var newEntry = function(cveIds, products, manufacturers, descriptions, createdDates,
	modifiedDates, scores, attackVectors, attackComplexities, authentications, confImpacts,
	intImpacts, availImpacts, references, entry, undCount, callback, force) {

	var inc = 0;

	//Iterates through each value in each list.
	for (inc = 0; inc < (entry.length - undCount); inc++) {

		//Defines a new document using the current inc value.
		var newVuln = new vulnerability({
			Count: inc + prevInc,
			CVEId: cveIds[inc],
			Products: products[inc],
			Manufacturer: manufacturers[inc],
			Description: descriptions[inc],
			DCDateAdded: createdDates[inc],
			DCDateModified: modifiedDates[inc],
			Score: scores[inc],
			AttackVector: attackVectors[inc],
			AttackComplexity: attackComplexities[inc],
			Authentication: authentications[inc],
			ConfidentialityImpact: confImpacts[inc],
			IntegrityImpact: intImpacts[inc],
			AvailabilityImpact: availImpacts[inc],
			References: references[inc]
		});

		//Saves this document to the database.
		newVuln.save(function(err) {
			if(err) {
				throw err;
				console.log(err);
			}
		});
	}
	console.log('List added to database. ' + inc + ' documents saved.');
	prevInc = inc + prevInc;

	//When all documents are save, the temporary xml and zip files will be unloaded.
	//Defines a new document with an incremented Id and the last modified date
	//provided by the xml document. If the update was forced this date may
	//be the same as in the previous document of the 'updated' collection.
	var updatedEntry = new updated({
		Id: oldId + 1,
		Date: lastUpdatedDate,
		File: startYear
	});

	//Saves the defined document to the 'updated' collection.
	updatedEntry.save(function(err) {
		if(err) {
			throw err;
			console.log(err);
		} else {

			//Once the new date entry is saved, all vulnerabilities will be
			//removed from the db so that it can be updated.
			console.log('Date: ' + lastUpdatedDate + ' added');
			startYear++;
			dbBeginUpdate(callback, force);
		}
	});
}

//Unloads the vulnerabilities zip file, the vulnerabilities xml file, and the products
//xml file in sequence to make sure each is unloaded before startCheck is set back
//to 0 and the callback is called.
var unloadFiles = function(callback) {
	fs.unlink(cveAnnualPath, function() {
		console.log('Unloaded: ' + cveAnnualPath);
		fs.unlink(cveAnnualPathXML, function() {
			console.log('Unloaded: ' + cveAnnualPathXML);
			fs.unlink(cveProductsPathXML, function() {
				console.log('Unloaded: ' + cveProductsPathXML);
				console.log('Database up to date.');

				//Callback is defined when calling dbBeginUpdate and is
				//the 'next();' function when called from the dbForceUpdate
				//route but is an empty function when called by the local timer.
				callback();
				startYear = 2002;
				startCheck = 0;
			});
		});
	});	
}

//Checks for a new xml file on app load
dbCheckBeginUpdate();

//Checks for a new xml file every 10 minutes. This should be udated to
//use a scheduled timer.
var updateTimer = schedule.scheduleJob(updateRule, dbCheckBeginUpdate);

//Exports the function that is called by a route to force a db update.
module.exports.vulnUpdate = function(callback) {
	dbBeginUpdate(callback, false);
}

//Exports the function that is called by a route to check that the
//db is not already updated before it tries to force an update.
module.exports.check = function() {
	return startCheck;
}