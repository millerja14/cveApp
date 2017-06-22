var mongoose = require('mongoose');

//mongoose.set('debug', true);

var vulnSchema = new mongoose.Schema({
    Count: Number,
    CVEId: String,
    Products: {type: Array, index: 'text'},
    Manufacturer: String,
    Description: {type: String, index: 'text'},
    DCDateAdded: Date,
    DCDateModified: Date,
    Score: Number,
    AttackVector: String,
    AttackComplexity: String,
    Authentication: String,
    ConfidentialityImpact: String,
    IntegrityImpact: String,
    AvailabilityImpact: String,
    References: Array
});

var briefVulnSchema = new mongoose.Schema({
    CVEId: String,
    Product: String,
    Manufacturer: String,
    Description: String,
    DCDate: Date
});

var updatedSchema = new mongoose.Schema({
    Id: Number,
    Date: Date,
    File: Number
});

vulnSchema.on('index', function(err) {
    if (err) {
        console.error('User index error: %s', err);
    } else {
        console.info('User indexing complete');
    }
});

module.exports = {
    vulnerability: mongoose.model('vulnerability', vulnSchema),
    updated: mongoose.model('updated', updatedSchema),
    briefVulnerability: mongoose.model('briefVulnerability', briefVulnSchema)
}


