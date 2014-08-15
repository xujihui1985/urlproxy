'use strict';

describe('urlproxy', function() {

  var should = require('should');
  var join = require('path').join;
  var fs = require('fs');
  var http = require('http');
  var st = require('st');
  var rimraf = require('rimraf');
  var proxy = require('..');
  var fixtures = join(__dirname, 'fixtures');

  var mount = st({ path: fixtures });
  var server = http.createServer(function(req, res) {
    if (req.url === '/500.js') {
      res.statusCode = 500;
      return res.end();
    }
    if (req.url === '/302.js') {
      res.statusCode = 302;
      res.writeHead(302, {
        'Location': '/a.js'
      });
      return res.end();
    }
    mount(req, res);
  }).listen(12345);

  after(function() {
    server.close();
  });

  it('should response from local', function(done) {
    var ret  = '';
    proxy('a.js', {directory: fixtures})
    .on('data', function(data) {
      ret += data;
    })
    .on('end', function() {
      ret.should.eql('console.log(\'a\');\n');
      done();
    });
  });

  it('should error when not found from local', function() {
    (function() {
      proxy('noexist.js', {directory: fixtures});
    }).should.throw('not found ' + join(fixtures, 'noexist.js') + ' and no proxy');
  });

  it('should response from remote', function(done) {
    var ret  = '';
    proxy('a.js', {proxy: 'http://localhost:12345'})
    .on('data', function(data) {
      ret += data;
    })
    .on('end', function() {
      ret.should.eql('console.log(\'a\');\n');
      done();
    });
  });

  it('should get 404 from remote', function(done) {
    proxy('noexist.js', {proxy: 'http://localhost:12345'})
    .on('error', function(err) {
      should.exist(err);
      err.message.should.eql('not found http://localhost:12345/noexist.js');
      done();
    });
  });

  it('should get 500 from remote', function(done) {
    proxy('500.js', {proxy: 'http://localhost:12345'})
    .on('error', function(err) {
      should.exist(err);
      err.message.should.eql('server error');
      done();
    });
  });

  it('should get 302 from remote', function(done) {
    proxy('302.js', {proxy: 'http://localhost:12345'})
    .on('error', function(err) {
      should.exist(err);
      err.message.should.eql('not found http://localhost:12345/302.js');
      done();
    });
  });

  it('should response when followRedirect 302 from remote', function(done) {
    var ret = '';
    proxy('302.js', {proxy: 'http://localhost:12345', followRedirect: true})
    .on('data', function(data) {
      ret += data;
    })
    .on('end', function() {
      ret.should.eql('console.log(\'a\');\n');
      done();
    });
  });

  it('should response from remote and cache', function(done) {
    var cache = join(fixtures, 'cache');
    var cacheFile = join(cache, 'a.js');
    var ret  = '';
    proxy('a.js', {
      directory: cache,
      proxy: 'http://localhost:12345',
      cache: true
    })
    .on('data', function(data) {
      ret += data;
    })
    .on('end', function() {
      ret.should.eql('console.log(\'a\');\n');
      fs.readFileSync(cacheFile).toString()
        .should.eql('console.log(\'a\');\n');
      rimraf(cache, done);
    });
  });
});
