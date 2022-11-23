/**
 * Custom reporter that dumps adapted structure of JSON report out.
 * Provides JSON response bodies if content-type is application/json, string otherwise.
 *
 * @param {Object} newman - The collection run object, with event hooks for reporting run details.
 * @param {Object} options - A set of collection run options.
 * @param {String} options.export - The path to which the report object must be written.
 * @param options.stats - Include also 'stats' dict in the output report.
 * @returns {*}
 */

const my = require('./package.json');
const prog = 'NR-json-steps@' + my.version;

function info(...msg) {
  console.log('INFO::' + prog, ...msg);
}

function error(...msg) {
  console.log('ERR::' + prog, ...msg);
}

function scrapeDescription(x) {
  var ret = (x.type === 'text/plain') ? x.content : undefined;
  return ret;
}

function compactHeaders(allHeaders) {
  var h = {};
  allHeaders.members.forEach(function (x) {
    h[x.key] = x.value;
  });
  return h;
}

function createLightSummary(rawDetail, options) {
  let detail = {};
  Object.assign(detail, {
    'name': rawDetail.collection.name,
    'description': scrapeDescription(rawDetail.collection.description),
    'env': rawDetail.environment.name
  });

  let steps = [];
  rawDetail.run.executions.forEach(function (exec) {
    let assertions = [];
    exec.assertions.forEach(function (assertionReport) {
      assertions.push({
        'name': assertionReport.assertion,
        'skipped': assertionReport.skipped,
        'failed': assertionReport.error !== undefined,
        'errorMessage': assertionReport.error ? assertionReport.error.message : undefined
      });
    });
    let step = {};
    let request = {};
    Object.assign(request, {
      'url': exec.request.url.toString(),
      'method': exec.request.method,
      'header': compactHeaders(exec.request.headers),
      'body': exec.request.body.raw,
    });
    if (exec.requestError)
      Object.assign(request, {
        'error': exec.requestError
      });
    Object.assign(step, {
      'name': exec.item.name,
      'request': request,
      'assertions': assertions,
    });
    if (exec.requestError == undefined && exec.response) {
      let response = {
        'body': exec.response.stream.toString('utf8'),
        'duration': exec.response.responseTime,
        'header': compactHeaders(exec.response.headers),
        'code': exec.response.code,
        'status': exec.response.status,
      }
      const CT = response.header['Content-Type'];
      if (CT && CT.includes('application/json'))
        response.body = JSON.parse(response.body);
      Object.assign(step, {
        'response': response,
      });
    }
    steps.push(step);
  });

  var ret = {};
  Object.assign(ret, {
    'info': detail,
    'steps': steps,
  });
  if (options.jsonStepsStats)
    Object.assign(ret, {
      'stats': rawDetail.run.stats,
    });
  return ret;
}

module.exports = function (newman, options) {
  newman.on('beforeItem', function (err, o) {
    info('beforeItem called');
  });
  newman.on('beforeDone', function (err, o) {
    info(options);
    if (err) {
      info('stops on error:', err);
      return;
    }
    try {
      newman.exports.push({
        name: 'json-steps-reporter',
        default: 'newman-step-results.json',
        path: options.jsonStepsExport,
        content: createLightSummary(o.summary, options)
      });
    }
    catch (e) {
      error(e);
      throw e;
    }
    info('finished');
  });
};
