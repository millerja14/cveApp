var express = require('express');
var mongoose = require('mongoose');

var softwareSchema = new mongoose.Schema({
    SoftwareID: Number,
    Name: String,
    Vendor: String,
    Product: String,
    Version: String,
    CVEIds: Array

});

var projectSchema = new mongoose.Schema({
    Name: String,
    BOM: Array
});

var bomSchema = new mongoose.Schema({
    Name: String,
    Softwares: Array
});

var vulnSchema = new mongoose.Schema({
    Count: Number,
    CVEId: String,
    Products: {type: Array, index: 'text'},
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

var updatedSchema = new mongoose.Schema({
    Id: Number,
    Date: Date,
    File: Number
});

module.exports = {
    software: mongoose.model('software', softwareSchema),
    project: mongoose.model('project', projectSchema),
    bom: mongoose.model('bom', bomSchema),
    vulnerability: mongoose.model('vulnerability', vulnSchema),
    updated: mongoose.model('updated', updatedSchema)
}






