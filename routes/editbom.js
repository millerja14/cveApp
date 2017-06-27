var express = require('express');
var router = express.Router();

var mongoose = require('mongoose');
var path = require('path');

var models = require(path.join(__dirname, '../', 'models/vulnConnection.js'));

var vulnerability = models.vulnerability;
var software = models.software;
var product = models.product;

var productList = [];
var versionList = [];
var vendorList = [];

var vendorSendSimple = [];

/* GET home page. */
router.get('/', function(req, res, next) {
        res.render('editbom', {displayedVendor: '', vendors: vendorList, products: productList, versions: versionList });
});

router.get('/search', function(req, res) {
    var vendor = '';
    var product = '';
    var version = '';
    var exclude = '';

    var search = req.query;
    vendor = search.vendor;
    product = search.product;
    version = search.version;
    exclude = search.exclude;

    var vendorQuery = software.find({
        $and: [
            {Vendor: {$regex: vendor, $options: 'i'}}
        ]
    });

    vendorQuery.limit(10).exec(function(err, vendorObjectList) {
        if (vendorObjectList != undefined) {
            var vendorSend = vendorObjectList.map(function(a) {
                return a.Name;
            });
        } else {
            var vendorSend = [];
        }
        console.log(vendorSend);
        res.send(vendorSend);
    });
});

router.get('/newproduct', function(req, res) {
    var name = req.query.name;
    var email = req.query.email;
    var products = req.query.products;

    console.log(name + email + '\n' + products)
});

router.get('/reqlist', function(req, res) {
    res.send([1,2,3,4,5,6,6]);
});

module.exports = router;