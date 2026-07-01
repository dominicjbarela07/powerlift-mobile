const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, '..', 'lib', 'videoUploadQueue.ts');
const source = fs.readFileSync(sourcePath, 'utf8');

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (source.includes('CHUNKED_UPLOAD_THRESHOLD_BYTES')) {
  fail('Mobile video uploads must not use a size threshold; native uploads are always chunked.');
}

if (!/return Platform\.OS !== 'web';/.test(source)) {
  fail('shouldUseChunkedUpload must route every native upload through the chunked path.');
}

const directEndpointMatches = source.match(/\/video-review\/mobile\/set-logs\/\$\{job\.setLogId\}\/video`/g) || [];
if (directEndpointMatches.length !== 1) {
  fail(`Expected exactly one legacy direct multipart endpoint reference, found ${directEndpointMatches.length}.`);
}

if (!/function uploadJobLegacyDirectMultipartForWebOnly/.test(source)) {
  fail('The remaining direct multipart uploader must be explicitly named as web-only legacy behavior.');
}

console.log('Mobile video upload policy guard passed.');
