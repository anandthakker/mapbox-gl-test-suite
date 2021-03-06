'use strict';

var st = require('st');
var http = require('http');
var path = require('path');

module.exports = function () {
    var server = http.createServer(st({path: path.join(__dirname, '..')}));

    function localURL(url) {
        return url.replace(/^local:\/\//, 'http://localhost:2900/');
    }

    return {
        listen: function (callback) {
            server.listen(2900, callback);
        },

        close: function (callback) {
            server.close(callback)
        },

        localizeURLs: function (style) {
            for (var k in style.sources) {
                var source = style.sources[k];

                for (var l in source.tiles) {
                    source.tiles[l] = localURL(source.tiles[l]);
                }

                if (source.urls) {
                    source.urls = source.urls.map(localURL);
                }

                if (source.url) {
                    source.url = localURL(source.url);
                }

                if (source.data && typeof source.data == 'string') {
                    source.data = localURL(source.data);
                }
            }

            if (style.sprite) {
                style.sprite = localURL(style.sprite);
            }

            if (style.glyphs) {
                style.glyphs = localURL(style.glyphs);
            }
        }
    };
};
