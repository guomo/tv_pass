//
// # SimpleServer
//
// A simple chat server using Socket.IO, Express, and Async.
//
var http = require('http');
var path = require('path');
var assert = require('assert');
var fs = require("fs")

var async = require('async');
var socketio = require('socket.io');
var express = require('express');

//
// ## SimpleServer `SimpleServer(obj)`
//
// Creates a new instance of SimpleServer with the following options:
//  * `port` - The HTTP port to listen on. If `process.env.PORT` is set, _it overrides this value_.
//
var router = express();
var server = http.createServer(router);
var io = socketio.listen(server);

router.use(express.static(path.resolve(__dirname, 'client')));
router.use(express.bodyParser());
router.use(express.methodOverride());
var messages = [];
var sockets = [];

io.on('connection', function (socket) {
    messages.forEach(function (data) {
      socket.emit('message', data);
    });

    sockets.push(socket);

    socket.on('disconnect', function () {
      sockets.splice(sockets.indexOf(socket), 1);
      updateRoster();
    });

    socket.on('message', function (msg) {
      var text = String(msg || '');

      if (!text)
        return;

      socket.get('name', function (err, name) {
        var data = {
          name: name,
          text: text
        };

        broadcast('message', data);
        messages.push(data);
      });
    });

    socket.on('identify', function (name) {
      socket.set('name', String(name || 'Anonymous'), function (err) {
        updateRoster();
      });
    });
  });

function updateRoster() {
  async.map(
    sockets,
    function (socket, callback) {
      socket.get('name', callback);
    },
    function (err, names) {
      broadcast('roster', names);
    }
  );
}

function broadcast(event, data) {
  sockets.forEach(function (socket) {
    socket.emit(event, data);
  });
}

// Load up the embedded mongo
var Engine = require('tingodb')();
var db = new Engine.Db('./database', {});
var collection = db.collection("playlist");

router.get('/playlists/', function (req, res) {
  res.send('You must supply an esn, e.g. /playlists/{esn}')
})

router.get('/playlists/:esn', function (req, res) {
    
  collection.findOne({"esn":req.params.esn}, function(err, record) {
    assert.equal(null, err);
    if( null == record ){
        res.status(404).send('No playlist found for ' + req.params.esn);
    }else{
      res.json(record.feed)
    } 
  })
})



router.put('/playlists/:esn', function (req, res) {
  
  // Validate the content
  if( !checkFeed(req) ){
    res.status(400).send('Invalid feed type or missing content')
  }

  // Check if we need to replace 
  collection.findOne( {"esn": req.params.esn}, function(err, feed) {
    assert.equal(null, err)
    if( null != feed ){
        // Delete the old record since put is overwrite semantics
        collection.remove({"esn":req.params.esn}, function(err){
          assert.equal(null, err)
          console.log("Deleted record: " + req.params.esn)
          doInsert(req.params.esn, req.body)
        })
    }else{
      doInsert(req.params.esn, req.body)
    }
  })
  res.send('OK')
})
    

function doInsert(esn, feed){
  
    //feed.lastUpdated = new Date();
    collection.insert( {esn: esn, feed: feed}, function(err, result) {
        assert.equal(null, err)
      }) 
}


router.delete('playlists/:esn', function(req,res){
          console.log("Deleted record: " + req.params.esn)

  
  collection.findOne({"esn":req.params.esn}, function(err, feed) {
    assert.equal(null, err);
    if( null == feed ){
      res.status(204).send('No Content - record did not exist');
    }else{
      collection.remove({"esn":req.params.esn}, function(err){
        assert.equal(null, err);
        console.log("Deleted record: " + req.params.esn)
      })
      res.status(204).send()
    }
  })
  
})


function checkFeed(req){
  // Check it is JSON content type
  var retVal = req.is('application/json')
  // Check it parses to actual object
  console.log(req.body)
  //retVal = req.body == undefined  ? false : true
  if(!retVal) {  console.log("Feed check failed for esn:" + req.path) }

  return(retVal)
}


  server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
    console.log("Creating index...")
    collection.createIndex( { "esn": 1 }, { "unique" : true }, function(err, results) {
                        console.log(results);
                        if(err){
                          console.log("Error creating index: " + err)
                        }
                      }
                );
    var addr = server.address()
    console.log("Playlist server listening at", addr.address + ":" + addr.port)
  });