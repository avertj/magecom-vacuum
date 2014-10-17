var argv         = require('yargs') // arguments ligne de commande
                    .alias('u', 'url') // url
                    .string('u')
                    .required('u')
                    .alias('r', 'resources') // recuperer les images ?
                    .boolean('r')
                    .alias('h', 'here') // où les sauver
                    .default('h', './fetched_resources/')
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




var cards = {}

lookupCard(argv.url)

// mana [R] [C:5] [C:x] [T]
function lookupCard(raw_url) {
    request(raw_url, function(error, response, data) {
        if (error)
            return console.error(error)

        if(response.statusCode == 200) {
            var $ = cheerio.load(data)

            var card = {
                mana: {
                    black: 0,
                    blue: 0,
                    green: 0,
                    red: 0,
                    white: 0,
                    colorless: 0,
                    variable: false,
                },
                text: [],
                flavor: []
            }

            if(argv.resources) {
                fetchPicture($('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_cardImage').attr('src'))
            }
            // calcul du cout de la carte
            $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_manaRow').find('img').each(function(i, elem) {
                if(argv.resources) fetchPicture($(this).attr('src'))
                
                if(/name=b/i.test($(this).attr('src')))  card.mana.black++
                if(/name=u/i.test($(this).attr('src')))  card.mana.blue++
                if(/name=g/i.test($(this).attr('src')))  card.mana.green++
                if(/name=r/i.test($(this).attr('src')))  card.mana.red++
                if(/name=w/i.test($(this).attr('src')))  card.mana.white++
                if(/name=\d/i.test($(this).attr('src'))) card.mana.colorless = Number($(this).attr('alt'))
                if(/name=x/i.test($(this).attr('src')))  card.mana.variable = true
            })
            // remplacement des images utilisée dans le texte par des symboles texte
            $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_textRow').find('img').each(function(i, elem) {
                if(argv.resources) fetchPicture($(this).attr('src'))
                
                if(/name=b/i.test($(this).attr('src')))   $(this).replaceWith('[B]')
                if(/name=u/i.test($(this).attr('src')))   $(this).replaceWith('[U]')
                if(/name=g/i.test($(this).attr('src')))   $(this).replaceWith('[G]')
                if(/name=r/i.test($(this).attr('src')))   $(this).replaceWith('[R]')
                if(/name=w/i.test($(this).attr('src')))   $(this).replaceWith('[W]')
                if(/name=\d/i.test($(this).attr('src')))  $(this).replaceWith('[C:' + Number($(this).attr('alt')) + ']')
                if(/name=x/i.test($(this).attr('src')))   $(this).replaceWith('[C:X]')
                if(/name=tap/i.test($(this).attr('src'))) $(this).replaceWith('[T]')
            })

            card.name = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_nameRow .value').text().trim()
            card.type = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_typeRow .value').text().trim()
            card.artist = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_artistRow .value a').text().trim()
            card.rarity = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_rarityRow .value span').text().trim()

            $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_textRow .value .cardtextbox').each(function (index, elem) {
                card.text.push($(this).text().trim())
            })
            $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_flavorRow .value .cardtextbox').each(function (index, elem) {
                card.flavor.push($(this).text().trim())
            })

            console.log(card)
        }
    })
}

function fetchPicture(raw_url) {
    ///Handlers/Image.ashx?size=medium&name=G&type=symbol
    var resolved_url = url.resolve(argv.url, raw_url)
    var parsed_url = url.parse(resolved_url, true)
    console.log(resolved_url)
    if(parsed_url.search) {
        var folder = path.join(__dirname, argv.here, parsed_url.query.type)
        var file
        if(parsed_url.query.type == 'card') {
            file = path.join(folder, parsed_url.query.multiverseid + '.jpg')
        } else {
            folder = path.join(folder, parsed_url.query.size)
            file = path.join(folder, parsed_url.query.name + '.jpg')
        }
        mkdirp(folder, function (error) {
            if (error) console.error(error)
            else request(resolved_url).pipe(fs.createWriteStream(file))
        })
    }
}