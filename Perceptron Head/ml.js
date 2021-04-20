const http = require('http');
const handler = require('serve-handler');
const needle = require('needle');
const Twit = require('twit')
const puppeteer = require("puppeteer");
const fs  = require("fs");
const socketio = require('socket.io');

var T = new Twit({
  consumer_key:         'DLQpDLbvqmg3GweSgm4ftKHV7',
  consumer_secret:      'b97ltz6y0WRt5Ytlv1dcsZvX7SOpPAiKGXYYn9fH6Np5V7c7ZL',
  access_token:         '3230566964-4wdrMbUTXc8sF04eaZFQKw2INuuzj4nsaRpy75R',
  access_token_secret:  'OfeeB1zNI1Tb7bbJX3UtqxYxiigDf6IJnUWTEezySPDFO',
})

const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAO%2F5OgEAAAAAZ98%2FS5tcjTwkAjDgjnU5y%2BIcjMs%3DaRi3xnnUAQd9IEnVSDC8f7X1VQGnLGTORa5w9FDXa9FeBXLMzi';
const rulesURL = 'https://api.twitter.com/2/tweets/search/stream/rules';
const streamURL = 'https://api.twitter.com/2/tweets/search/stream?media.fields=url&tweet.fields=public_metrics,attachments&expansions=author_id,attachments.media_keys';
const rules = [{ value: 'to:Breaking911 is:reply' }]

const server = http.createServer((request, response) => {
    return handler(request, response);
});
const io = socketio(server);

async function getRules() {
    const response = await needle('get', rulesURL, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    })
    console.log(response.body)
    return response.body
}
async function setRules() {
    const data = {
      add: rules,
    }
  
    const response = await needle('post', rulesURL, data, {
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
    })
  
    return response.body
}
async function deleteRules(rules) {
    if (!Array.isArray(rules.data)) {
      return null
    }
  
    const ids = rules.data.map((rule) => rule.id)
  
    const data = {
      delete: {
        ids: ids,
      },
    }
  
    const response = await needle('post', rulesURL, data, {
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
    })
  
    return response.body
}

function streamTweets(socket) {
    const stream = needle.get(streamURL, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    })
  
    stream.on('data', async (data) => {
      try {
        const json = JSON.parse(data);
        const text = json.data.text.split(" ").slice(1);
        if (text.length >= 2) {
            T.post('statuses/update/:id', { status: `Tweet with a specific keyword, ${text.toString()} is not specific.`, in_reply_to_status_id: `${json.data.id}` }, (err, data, response) => {
                console.log(data)
            })
        } else {
            const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
            const page = await browser.newPage();
            io.on('connection', () => console.log('[ML] > connected to the client'));
            await page.goto("https://perceptron-head.herokuapp.com/public/");
            page.evaluate("ml5.version").then(version => console.log(`[ML] > ml5 ${version} has loaded`));
            io.emit('predict', json.includes.attachment);
        }       
      } catch (error) {}
    })
  
    return stream
}

;(async() => {
    try {
        let currentRules = await getRules()
        await deleteRules(currentRules)
        await setRules()
    }
    catch (error) {
        console.error(error)
        process.exit(1)
    }
    const filteredStream = streamTweets(io)

    let timeout = 0
    filteredStream.on('timeout', () => {
      console.warn('A connection error occurred. Reconnecting…')
      setTimeout(() => {
        timeout++
        streamTweets(io)
      }, 2 ** timeout)
      streamTweets(io)
    })
})();

server.listen(process.env.PORT || 3000, () => {
    console.log('[ML] > server is running');
});