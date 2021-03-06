const fetch = require("node-fetch");
const zlib = require("zlib");
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const highlight = syntaxHighlight.pairedShortcode;
const SyntaxHighlightCharacterWrap = syntaxHighlight.CharacterWrap;
const URL = require("url").URL;

const MAX_SIZE = 20000;
const DEFAULT_AUTOPLAY = 99999;

async function gzipContent(inputContent) {
  return await new Promise((resolve, reject) => {
    zlib.gzip(inputContent, (error, output) => {
      if(error) {
        reject(error);
      } else {
        resolve(output);
      }
    })
  });
}

function checkValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
}

exports.handler = async function(event, context) {
  let { url, format, show, autoplay } = event.queryStringParameters;

  try {
    if(!url) {
      url = "https://gist.githubusercontent.com/zachleat/542f1d15c2061fc3cf4c0bc30c3b9bac/raw/queuecode.js";
      autoplay = DEFAULT_AUTOPLAY;
    } else if(!checkValidUrl(url)) {
      throw new Error("Invalid `url` parameter.");
    }

    // Guess the format based on a file extension in the URL
    let extension = url.split(".").pop();
    if(extension === "js" || extension === "html" || extension === "css") {
      format = extension;
    }

    if(!format) {
      throw new Error("Missing `format` param for syntax highlighter code format.");
    }

    // TODO check valid URL
    let htmlRequest = await fetch(url);
    let content = await htmlRequest.text();

    console.log( "Found", content.length );
    let highlightedCode;
    if(content.length > MAX_SIZE || show) {
      let errorMsg = "";
      if(!show) {
        let errorMsgContent = `This document was too long for queue-code (was: ${content.length}, maximum: ${MAX_SIZE}). Showing a syntax highlighted version only.`;
        if(format === "js") {
          errorMsg = `// ${errorMsgContent}\n`;
        } else if(format === "html") {
          errorMsg = `<!-- ${errorMsgContent} -->\n`;
        }
      }
      highlightedCode = highlight(errorMsg + content, format);
    } else {
      let wrap = new SyntaxHighlightCharacterWrap();
      highlightedCode = wrap.wrapContent(content, format);
    }

    let output = await gzipContent(`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="description" content="">
        <title></title>
        <link rel="stylesheet" href="/style.css">
        <link rel="stylesheet" href="/prism-theme.css">
        <link rel="stylesheet" href="/queue-code.css">
        <script defer async src="/queue-code.js"></script>
      </head>
      <body${autoplay !== undefined ? ` class="slide-autoplay" data-slide-autoplay-speed="${isNaN(autoplay) ? DEFAULT_AUTOPLAY : (autoplay || DEFAULT_AUTOPLAY)}"` : ""}>
        ${highlightedCode}
      </body>
    </html>`);
  
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
        "Content-Encoding": "gzip",
      },
      body: output.toString("base64"),
      isBase64Encoded: true,
    }
  } catch(e) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: e.message
      })
    }
  }
}