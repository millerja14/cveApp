Install and configure the mongo database
  -Download the correct version of mongodb here: https://www.mongodb.com/download-center#community
  -Create a folder in which mongodb will be installed
    -(MongoDB can be installed to any folder you choose as it is self contained and has no system dependencies)
  -Run the .msi file and continue through the installation process
    -Choose custom setup and browse to the previously created folder
  -Open mongod.cfg in the parent folder and make sure it contains the following where yourparentpath is the
  directory of the folder in which you installed mongodb:
	
	systemLog:
		destination: file
		path: yourparentpath\data\log\mongod.log
	storage:
		dbPath: yourparentpath\data\db
    
  -Make sure mongod.log exists, if it doesn't create it
  -Run a command prompt with administrator privileges and run the following command where yourparentpath is
  the same as above:

	"yourparentpath\bin\mongod.exe" --config "yourparentpath\mongod.cfg" --install
  
  -Start the MongoDB service using the following command in the admin cmd:
	
	net start MongoDB
  
  -Run mongo.exe from the bin folder in the parent directory
  -Run the following command in the terminal that appears to create a new database with name 'vuln':
	
	use vuln

  -Run the following command to ensure that 'vuln' was created:

	show dbs

  -If 'vuln' is shown then mongodb is all set up

Configure the cveApp
  -Open the command prompt and navigate to the 'cveApp' folder
  -Run the following command to install all dependencies for the app:

	npm install

  -Run the following command to install nodemon, a tool for easily starting the app:

	npm install -g nodemon

  -Before running the app, check that mongodb is running by entering the following command in 
  the mongo.exe terminal:

	net start MongoDB

  -To run the cveApp, execute the following command from within the cveApp folder:

	nodemon

  -The app is now started, and is running off of port 3000 on the localhost.

Possible issues
  -Almost all scripts in the app get around the asynchronous nature by calling functions in sequence like this:
	
	var a = function() {
		//code
		code.on('complete', b);
	}

	var b = function() {
		//morecode
		morecode.on('complete', c);
	}

	var c = function() {
		//finishcode
	}

  This is to avoid deep indentations that would occur if it were all one function, but is still messy. A
  module called async could probably help neaten it up.
  -There is probably too much going on in the routes, there is no dynamic html in the app so each page
  waits for operations within the route to finish before being displayed.
  -Search results are displayed all at once, there is no pagination on the output page
  -There is no way yet of force updating one year's file at a time
  -Routes will not render the view while the database is in a 'for' loop. This makes the seach page
  inaccessible for several minute durations while the database is updating (The db only updates at night
  unless forced by a user).
  -The page may time out after pressing the button to force an update. The response timeout is not long enough
  and needs to be lengthened. Even though the page may time out, the update will continue and the search
  page may be reloaded.
  -Parsing each xml file uses lots of ram. The 2011 file is extremely large and will use around 2GB of ram when
  parsed. An alternate method of parsing may need to implemented.
  -The index (home) page is basically blank and only includes a link to the search page. The search page can be
  moved to the index page, or the index page can be reserved for additional funcitonality to be added later.
  -Vendor names are not included in the database.
  -There are likely unhandled errors in the program that could cause it to unexpectedly crash.