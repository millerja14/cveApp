var express = require('express');
var router = express.Router();
var passport = require('passport');

router.get('/google', passport.authenticate('google', { scope : ['profile', 'email'] }));

router.get('/google/callback',
    passport.authenticate('google', {
            successRedirect : '/projects',
            failureRedirect : '/'
    })
);

module.exports = router;