//Require modules
var mongoose = require('mongoose');
var fs = require('fs');
var https = require('https');
var path = require('path');
var xmldom = require('xmldom');

//Define mongo database address, the xml address, and where to temporarily
//store the xml file.
var vulnURI = 'mongodb://localhost/vuln';
var nvdURL = 'https://nvd.nist.gov/download/nvd-rss-analyzed.xml';
var xmlPath = (path.join(__dirname, '../', 'updated.xml'));

//Import and define the model for storing the vulnerabilities.
var vulnModels = require(path.join(__dirname, '../../', 'models/vulnConnection.js'));
var vulnerability = vulnModels.briefVulnerability;

//Transfers XML from the web to the temporary local file who's path is defined
//in xmlPath.
var transferXML = function() {
	var xmlImport = fs.createWriteStream(xmlPath);
	var request = https.get(nvdURL, function(response) {
  		response.pipe(xmlImport);
	});
	xmlImport.on('finish', function() {
		fs.readFile(xmlPath, 'utf-8', function(err, contents) {
			if (err) {
				throw err;
			}
			console.log('Loading breif vulnerabilities xml from: ' + xmlPath);
			parseXML(contents);
		});
	});
};

//Parse the xml file and save all of the contained documents.
var parseXML = function(xml) {
	var parser = xmldom.DOMParser;
	var xmlFile = new parser().parseFromString(xml, 'text/xml');
	var item = xmlFile.getElementsByTagName('item');

	//This iterates through the entire xml document and replaces entries by Id. Old
	//entries of the same Id as a new one are removed because some of the entries
	//in the file may be updated versions of a vulnerability that is already
	//in the database.
	for (i = 0; i < item.length; i++) {

		//Get data from each entry in the xml file.
		var description = item[i].getElementsByTagName('description')[0].childNodes[0].nodeValue;
		var title = item[i].getElementsByTagName('title')[0].childNodes[0].nodeValue;
		var date = item[i].getElementsByTagName('dc:date')[0].childNodes[0].nodeValue;
		var cveId = title.split(' ', 1)[0];
		var product = (title.split('(', 2)[1]).split(')',1)[0];

		//Find and replace each new entry by Id.
		vulnerability.find({CVEId: cveId}).remove().exec(function(err, idTest) {
			var newVuln = new vulnerability({
				CVEId: cveId,
				Product: product,
				Manufacturer: 'Unknown',
				Description: description,
				DCDate: date
			});
			newVuln.save(function(err) {
				if(err) {
					throw err;
					console.log(err);
				}
			});
		});
	}

	//Remove the temporarily stored xml file.
	fs.unlink(xmlPath, function() {
		console.log('Breif vulnerabilities file removed.');
	});
}

//Export a function that can be used to check the readyState of the
//mongo database
module.exports.readyState = function(callback) {
	readyState = mongoose.connection.readyState;
	callback(readyState);
}

//Initial update of database.
transferXML();

//Database set to update every hour.
var updateTimer = setInterval(transferXML, 60 * 60 * 1000);



