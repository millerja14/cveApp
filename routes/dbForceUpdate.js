var express = require('express');
var router = express.Router();
var path = require('path');

var init = require(path.join(__dirname, '../', 'public/javascripts/databaseInit.js'));

/* GET home page. */
router.use('/', function(req, res, next) {
	if (req.method == 'GET') {
		res.connection.setTimeout(0);
		if (init.check() == 0) {
			init.vulnUpdate(function() {
				next();
			});
		} else {
			next();
		}
	}
});

router.get('/', function(req, res, next) {
	console.log('Finished Update.');
	var updatedString = encodeURIComponent('true');
	res.redirect('dbSearch' + '/?updated=' + updatedString);
});

module.exports = router;