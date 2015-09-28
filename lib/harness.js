'use strict';

var fs = require('fs');
var path = require('path');
var queue = require('queue-async');
var extend = require('extend');
var colors = require('colors/safe');
var handlebars = require('handlebars');

module.exports = function (directory, implementation, options, run) {
    var q = queue(1);
    var server = require('./server')();

    q.defer(server.listen);

    fs.readdirSync(directory).forEach(function (group) {
        if (group === 'index.html' || group == 'results.html.tmpl' || group[0] === '.')
            return;

        if (options.tests && options.tests.indexOf(group) < 0)
            return;

        var style = require(path.join(directory, group, 'style.json')),
            info = require(path.join(directory, group, 'info.json'));

        server.localizeURLs(style);

        for (var test in info) {
            var params = extend({
                group: group,
                test: test,
                width: 512,
                height: 512,
                pixelRatio: 1,
                zoom: 0,
                bearing: 0,
                classes: [],
                center: [0, 0],
                allowed: 0.001
            }, info[test]);

            if ('diff' in params) {
                if (typeof params.diff === 'number') {
                    params.allowed = params.diff;
                } else if (implementation in params.diff) {
                    params.allowed = params.diff[implementation];
                }
            }

            params.ignored = params.ignored && implementation in params.ignored;

            if (params[implementation] === false) {
                console.log(colors.gray('* skipped ' + params.group + ' ' + params.test));
            } else {
                q.defer(runOne, params);
            }
        }

        function runOne(params, callback) {
            var watchdog = setTimeout(function () {
                callback(new Error('timed out after 20 seconds'));
            }, 20000);

            run(style, params, function(err) {
                clearTimeout(watchdog);

                if (err) return callback(err);

                if (params.ignored && !params.ok) {
                    params.color = 'white';
                    console.log(colors.white('* ignore ' + params.group + ' ' + params.test));
                } else if (params.ignored) {
                    params.color = 'yellow';
                    console.log(colors.yellow('* ignore ' + params.group + ' ' + params.test));
                } else if (!params.ok) {
                    params.color = 'red';
                    console.log(colors.red('* failed ' + params.group + ' ' + params.test));
                } else {
                    params.color = 'green';
                    console.log(colors.green('* passed ' + params.group + ' ' + params.test));
                }

                callback(null, params);
            });
        };
    });

    q.defer(server.close);

    q.awaitAll(function (err, results) {
        if (err) {
            console.error(err);
            process.exit(-1);
        }

        results = results.slice(1, -1);

        if (process.env.UPDATE) {
            console.log('Updated ' + results.length + ' tests.');
            process.exit(0);
        }

        var passedCount = 0,
            ignoreCount = 0,
            ignorePassCount = 0,
            failedCount = 0;

        results.forEach(function (params) {
            if (params.ignored && !params.ok) {
                ignoreCount++;
            } else if (params.ignored) {
                ignorePassCount++;
            } else if (!params.ok) {
                failedCount++;
            } else {
                passedCount++;
            }
        });

        var totalCount = passedCount + ignorePassCount + ignoreCount + failedCount;

        if (passedCount > 0) {
            console.log(colors.green('%d passed (%s%)'),
                passedCount, (100 * passedCount / totalCount).toFixed(1));
        }

        if (ignorePassCount > 0) {
            console.log(colors.yellow('%d passed but were ignored (%s%)'),
                ignorePassCount, (100 * ignorePassCount / totalCount).toFixed(1));
        }

        if (ignoreCount > 0) {
            console.log(colors.white('%d ignored (%s%)'),
                ignoreCount, (100 * ignoreCount / totalCount).toFixed(1));
        }

        if (failedCount > 0) {
            console.log(colors.red('%d failed (%s%)'),
                failedCount, (100 * failedCount / totalCount).toFixed(1));
        }

        var template = handlebars.compile(fs.readFileSync(path.join(directory, 'results.html.tmpl'), 'utf8'));
        var p = path.join(directory, 'index.html');
        fs.writeFileSync(p, template({results: results}));
        console.log('Results at: ' + p);

        process.exit(failedCount === 0 ? 0 : 1);
    });
};