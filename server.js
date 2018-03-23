var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var exphbs = require("express-handlebars");

// Our scraping tools
var request = require("request");
var cheerio = require("cheerio");

// Require all models
var Article = require("./models/Article.js");
var Note = require("./models/Note.js")

mongoose.Promise = Promise;

var PORT = process.env.PORT || 3000;

var app = express();


app.use(logger("dev"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Connect to the MongoDB
var MONGODB_URI= process.env.MONGODB_URI ||"mongodb://localhost/headlineScraper";
 mongoose.Promise = Promise;
 mongoose.connect(MONGODB_URI);

var db = mongoose.connection;

// show any mongoose errors
db.on("error", function(err) {
  console.log("MongooseError: ", err);
});

// once logged in to the db through mongoose, log a success message
db.once("open", function() {
  console.log("Mongoose connection successful.");
});

app.engine("handlebars", exphbs({defaultLayout: "main"}))
app.set("view engine", "handlebars");


// Routes

app.get("/", function(req, res) {
  Article.find({"saved": false}, function(error, data) {
    var hbsObject = {
      article: data
    };
    console.log(hbsObject);
    res.render("index", hbsObject);
  });
});

app.get("/favorites", function(req, res) {
  Article.find({"saved": true}).populate("notes").exec(function(error, articles) {
    var hbsObject = {
      article: articles
    };
    res.render("favorites", hbsObject);
  });
});


app.get("/scrape", function(req, res) {
  request("http://www.reuters.com", function(error, response, html) {
    var $ = cheerio.load(html);

    $("article.story").each(function(i, element) {
      var result = {};

      result.title = $(this).find(".story-title").text();
      result.summary = $(this).find(".story-content p").text();
      result.link = $(this).find(".story-content").children().attr("href");

      Article.create(result, function(err, outcome) {
        if (err) {
          console.log(err);
        } else {
          console.log(outcome);
        }
      });
    });

    res.send("Scrape Complete");
  });
});

app.get("/articles", function(req, res) {
  Article.find({}, function(error, result) {
    if (error) {
      console.log(error);
    } else {
      res.json(result)
    }
  })
});

app.get("/articles/:id", function(req, res) {
  Article.findOne({ _id: req.params.id })
  .populate("note")
  .exec(function(error, result) {
    if (error) {
      console.log(error);
    } else {
      res.json(result)
    }
  });
});

app.post("/articles/save/:id", function(req, res) {
  Article.findOneAndUpdate({ "_id": req.params.id }, { "saved": true})
  .exec(function(err, result) {
    if (err) {
      console.log(err);
    }
    else {
      res.send(result);
    }
  });
});

app.post("/notes/save/:id", function(req, res) {
  var newNote = new Note({
    body: req.body.text,
    article: req.params.id
  });
  console.log(req.body)
  newNote.save(function(error, note) {
    if (error) {
      console.log(error);
    }
    else {
      Article.findOneAndUpdate({ "_id": req.params.id }, {$push: { "notes": note }})
      .exec(function(err) {

        if (err) {
          console.log(err);
          res.send(err);
        }
        else {
          res.send(note);
        }
      });
    }
  });
});

app.post("/articles/delete/:id", function(req, res) {
  Article.findOneAndUpdate({ "_id": req.params.id }, {"saved": false, "notes": []})
  .exec(function(err, result) {
    if (err) {
      console.log(err);
    }
    else {
      res.send(result);
    }
  });
});

app.delete("/notes/delete/:note_id/:article_id", function(req, res) {

  Note.findOneAndRemove({ "_id": req.params.note_id }, function(err) {
    if (err) {
      console.log(err);
      res.send(err);
    }
    else {
      Article.findOneAndUpdate({ "_id": req.params.article_id }, {$pull: {"notes": req.params.note_id}})
      .exec(function(err) {

        if (err) {
          console.log(err);
          res.send(err);
        }
        else {
          res.send(" Deleted");
        }
      });
    }
  });
});

app.listen(PORT, function() {
  console.log("App running on port " + PORT + "!");
});
