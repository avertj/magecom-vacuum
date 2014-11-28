var argv         = require('yargs') // arguments ligne de commande
                    .alias('u', 'url') // url
                    .string('u')
                    .default('u', 'http://gatherer.wizards.com/Pages/Card/Details.aspx?printed=true&multiverseid=')
                    .alias('r', 'resources') // recuperer les images ?
                    .boolean('r')
                    .alias('h', 'here') // où les sauver
                    .default('h', './fetched_resources/')
                    .alias('f', 'from')
                    .alias('t', 'to')
                    .alias('p', 'post')
                    .string('p')
                    .default('p', 'http://localhost:8080/magecom-ejb/api/card')
                    .alias('j', 'json') // post json (p must me defined)
                    .boolean('j')
                    .alias('w', 'write') // write json to file
                    .boolean('w')
                    .argv

// core modules
var http         = require('http')
//http.globalAgent.maxSockets = 50 //number of simultaneous requests (default = 5)
var fs           = require('fs')
var path         = require('path')
var url          = require('url')

// non-core modules
var request      = require('request') // http requests
var request      = request.defaults({ // configuration des requetes http
  followRedirect: false,
  gzip: true
})
var cheerio      = require('cheerio') // HTML parser
var mkdirp       = require('mkdirp') // recursive mkdir


var cards = []
var size = 0
if(argv.from && argv.to && argv.from < argv.to) {
    size = argv.to - argv.from
    var i = argv.from
    for(i; i < argv.to; i++) lookupCard(i)
} else if(argv._ && argv._.length > 0) {
    size = argv._.length
    argv._.forEach(function(i, elem) {
        lookupCard(i)
    })
}

function writeJSON(filename, data) {
    var jsonstr = JSON.stringify(data)

    console.log(jsonstr)

    if(argv.json) {
        request.post({
            url: argv.post,
            json: true,
            body: data
        }, function(err, res, body) {
            if (err) {
                return console.error('upload failed:', err);
            }
            console.log('Upload successful!  Server responded with:', body);
        })
    }

    if(argv.write) {
        var folder = path.join(__dirname, argv.here, '/json/')
        mkdirp(folder, function (error) {
            if (error) console.error(error)
            else {
                fs.writeFile(path.join(folder, filename + '.json'), jsonstr, function(err) {
                    if(err) {
                        console.log(err)
                    } else {
                        console.log('The file was saved!')
                    }
                })
            }
        })
    }
}

// mana [R] [5] [X] [T]
function lookupCard(cardid) {
    request(argv.url + cardid, function(error, response, data) {
        if (error)
            return console.error(error)

        if(response.statusCode == 200) {
            console.log('Fetching ' + cardid)
            var $ = cheerio.load(data)

            var card = {
                id: cardid,
                color: {
                    black: false,
                    blue: false,
                    green: false,
                    red: false,
                    white: false
                },
                price: Math.floor((Math.random() * 10) + 1),
                x: false,
                text: [],
                flavorText: [],
                manaString: ''
            }

            if(argv.resources) {
                card.img = fetchPicture($('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_cardImage').attr('src'))
            }
            // calcul du cout de la carte
            $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_manaRow').find('img').each(function(i, elem) {
                if(argv.resources) fetchPicture($(this).attr('src'))
                
                if(/name=b/i.test($(this).attr('src'))) { card.color.black = true; card.manaString += '[B]' }
                if(/name=u/i.test($(this).attr('src'))) { card.color.blue = true; card.manaString += '[U]' }
                if(/name=g/i.test($(this).attr('src'))) { card.color.green = true; card.manaString += '[G]' }
                if(/name=r/i.test($(this).attr('src'))) { card.color.red = true; card.manaString += '[R]' }
                if(/name=w/i.test($(this).attr('src'))) { card.color.white = true; card.manaString += '[W]' }
                if(/name=\d/i.test($(this).attr('src'))) { card.manaString += '[' + Number($(this).attr('alt')) + ']' }
                if(/name=x/i.test($(this).attr('src'))) { card.x = true; card.manaString += '[X]' }
            })
            // remplacement des images utilisée dans le texte par des symboles texte
            $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_textRow').find('img').each(function(i, elem) {
                if(argv.resources) fetchPicture($(this).attr('src'))
                
                if(/name=b/i.test($(this).attr('src')))   $(this).replaceWith('[B]')
                if(/name=u/i.test($(this).attr('src')))   $(this).replaceWith('[U]')
                if(/name=g/i.test($(this).attr('src')))   $(this).replaceWith('[G]')
                if(/name=r/i.test($(this).attr('src')))   $(this).replaceWith('[R]')
                if(/name=w/i.test($(this).attr('src')))   $(this).replaceWith('[W]')
                if(/name=\d/i.test($(this).attr('src')))  $(this).replaceWith('[' + Number($(this).attr('alt')) + ']')
                if(/name=x/i.test($(this).attr('src')))   $(this).replaceWith('[X]')
                if(/name=tap/i.test($(this).attr('src'))) $(this).replaceWith('[T]')
            })

            card.name = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_nameRow .value').text().trim()
            card.type = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_typeRow .value').text().trim()
            card.artist = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_artistRow .value a').text().trim()
            card.rarity = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_rarityRow .value span').text().trim().toUpperCase()

            $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_textRow .value .cardtextbox').each(function (index, elem) {
                card.text.push($(this).text().trim())
            })
            $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_flavorRow .value .cardtextbox').each(function (index, elem) {
                card.flavorText.push($(this).text().trim())
            })

            var pt = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_ptRow')
            if(pt.length > 0) {
                var both = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_ptRow .value').text().trim().split('/')
                card.power = Number(both[0])
                card.toughness = Number(both[1])
            }

            card.convertedManaCost = Number($('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_cmcRow .value').text().trim())
            //card.text = card.text.join('|');
            //card.flavorText = card.flavorText.join('|');

            cards.push(card)
            writeJSON(card.id, card)

        } else {
            console.log('Error fetching ' + cardid)
        }
        size--
        /*if(size == 0) {
            writeJSON('card', cards)
        }*/
    })
}

function fetchPicture(raw_url, callback) {
    ///Handlers/Image.ashx?size=medium&name=G&type=symbol
    var resolved_url = url.resolve(argv.url, raw_url)
    var parsed_url = url.parse(resolved_url, true)
    //console.log(resolved_url)
    if(parsed_url.search) {
        var folder = path.join(__dirname, argv.here, parsed_url.query.type)
        var file
        if(parsed_url.query.type == 'card') {
            file = path.join(folder, parsed_url.query.multiverseid + '.jpg')
        } else {
            folder = path.join(folder, parsed_url.query.size)
            file = path.join(folder, parsed_url.query.name + '.jpg')
        }
        console.log(file)
        mkdirp(folder, function (error) {
            if (error) console.error(error)
            else {
                request(resolved_url).pipe(fs.createWriteStream(file))
            }
        })
        return file
    }
}

//node card_fetcher.js -r -f 161503 -t 161808 -h "..\magecom-client\resources"