var express = require('express');
var path = require('path');

var models = require(path.join(__dirname, '../', 'models/vulnConnection.js'));
var user = require(path.join(__dirname, '../', 'models/users.js'));

var project = models.project;

var router = express.Router();

/* GET users listing. */
router.get('/', isLoggedIn, function(req, res, next) {
  res.render('projects', {
  	user : req.user
  });
});

router.post('/addproject', isLoggedIn, function(req, res, next) {

	var name = req.body.name;
	var emails = [];
	var id = ''
	var nonUsers = [];
	
	if (typeof req.body.emails != 'undefined') {
		emails = req.body.emails;
	}

	console.log('Req Emails: ', req.query.emails);
	console.log('Emails: ', emails);

	var emptyBOM = [];
	var newProject = new project({
		Name: name,
		BOM: emptyBOM
	});

	newProject.save(function(err, project) {
		if(err) {
			throw err;
			console.log(err);
		} else {
			id = project.id;
			console.log('Saved project: ', id);
			addProjectToUser();
		}
	});

	var addProjectToUser = function() {
		user.findById(req.user.id , function (err, user) {
		  	if (err) return handleError(err);
			user.projects.push(id);
			console.log('User projects: ', user.projects);
			user.save(function (err, updated) {
			    if (err) return handleError(err);
			});
			addSharedProductsToUsers(0, function() {
				res.send(nonUsers);
				console.log('nonUsers sent to server: ', nonUsers);
			});
		});
	}

	var addSharedProductsToUsers = function(i, callback) {
		if(i < emails.length) {
			user.findOne({'google.email': emails[i]}, function(err, user) {
				if (err) return handleError(err);
				if (user != null) {
					user.sharedProjects.push(id);
					console.log('User shared projects: ', user.sharedProjects);
					user.save(function(err, updated) {
						if (err) return handleError(err);
					});
				} else {
					nonUsers.push(emails[i]);
				}

				addSharedProductsToUsers(i+1, callback);		
			});
		} else {
			callback();
		}
	}	
});

router.get('/getprojects', isLoggedIn, function(req, res, next) {
	var userProjectIds = [];
	var userProjects = [];

	user.findById(req.user.id, function(err, user) {
		if (err) return handleError(err);
		userProjectIds = user.projects;
		getUserProjects(0, function() {
			res.send(userProjects);
			console.log('User projects sent: ', userProjects);
		});
	});

	var getUserProjects = function(i, callback){
		if (i < userProjectIds.length) {
			project.findById(userProjectIds[i], function(err, project) {
				var objUserProjects = {
					Name: project.Name,
					Id: userProjectIds[i]
				};
				userProjects.push(objUserProjects);
				getUserProjects(i+1, callback);
			});
		} else {
			callback();
		}
	}
});

router.get('/getsharedprojects', isLoggedIn, function(req, res, next) {
	var sharedProjectIds = [];
	var sharedProjects = [];

	user.findById(req.user.id, function(err, user) {
		if (err) return handleError(err);
		sharedProjectIds = user.sharedProjects;
		getSharedProjects(0, function() {
			res.send(sharedProjects);
			console.log('Shared projects sent: ', sharedProjects);
		});
	});

	var getSharedProjects = function(i, callback){
		if (i < sharedProjectIds.length) {
			project.findById(sharedProjectIds[i], function(err, project) {
				var objSharedProjects = {
					Name: project.Name,
					Id: sharedProjectIds[i]
				};
				sharedProjects.push(objSharedProjects);
				getSharedProjects(i+1, callback);
			});
		} else {
			callback();
		}
	}
});

router.get('/editproject', isLoggedIn, function(req, res, next) {
	var projectToEditId = req.query.projectId;
	var projectToEditName = '';
	var projectToEditBOM = [];

	user.findById(req.user.id, function(err, user) {
		if (user.projects.indexOf(projectToEditId) > -1) {
			editSuccess();
		} else {
			editFailure();
		}
	});

	var editSuccess = function() {
		project.findById(projectToEditId, function(err, project) {
			projectToEditName = project.Name;
			projectToEditBOM = project.BOM;
		});

		res.render('editproject', {projectId: projectToEditId, projectName: projectToEditName, projectBOM: projectToEditBOM});
	}

	var editFailure = function() {
		res.redirect('/projects');
	}
});

function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on 
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/login');
}

module.exports = router;