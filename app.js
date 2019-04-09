const fs = require('fs')
const crypto = require('crypto')
const dota2 = require('dota2')
const config = require('./config')

let steam = require('steam')
const steamClient = new steam.SteamClient()
const steamUser = new steam.SteamUser(steamClient)
const Dota2 = new dota2.Dota2Client(steamClient, true, true)

// Load in server list if we've saved one before
if (fs.existsSync('servers')) steam.servers = JSON.parse(fs.readFileSync('servers'))

function onSteamLogOn(logonResp) {
  if (logonResp.eresult !== steam.EResult.OK) return
  console.log('Logged on')

  Dota2.launch()
  Dota2.on('ready', function() {
    console.log('node-dota2 ready')

    const createLobby   = true
    const leaveLobby    = true
    const destroyLobby  = true
    
    let lobbyChannel = ''

    if (createLobby) { // sets only password, nothing more
      const properties = {
        'game_name': 'MyLobby',
        'server_region': dota2.ServerRegion.EUROPE,
        'game_mode': dota2.schema.DOTA_GameMode.DOTA_GAMEMODE_CM,
        'series_type': dota2.SeriesType.BEST_OF_THREE,
        'game_version': 1,
        'allow_cheats': false,
        'fill_with_bots': false,
        'allow_spectating': true,
        'pass_key': 'ap',
        'radiant_series_wins': 0,
        'dire_series_wins': 0,
        'allchat': true
      }


      // create a practice lobby
      Dota2.createPracticeLobby(properties, (err, data) => {
        if (err) return console.log(err, data)
        console.log('created lobby: \n', properties)
      })

      // listen for lobby updates
      Dota2.on('practiceLobbyUpdate', lobby => {
        Dota2.practiceLobbyKickFromTeam(Dota2.AccountID)
        lobbyChannel = `Lobby_${lobby.lobby_id}`
        Dota2.joinChat(lobbyChannel, dota2.schema.DOTAChatChannelType_t.DOTAChannelType_Lobby)
      })
    }

    // auto leave lobby for demo
    if(leaveLobby){
      setTimeout(() => {
        Dota2.leavePracticeLobby((err, data) => {
          if (err) return console.log(err)
          Dota2.abandonCurrentGame()
          if (lobbyChannel) Dota2.leaveChat(lobbyChannel)
        })
      }, 10000)
    }

    // delete the lobby
    if(destroyLobby){
      setTimeout(() => {
        Dota2.destroyLobby((err, data) => {
          if (err) return console.log(err, data)
          if (lobbyChannel) Dota2.leaveChat(lobbyChannel)
        })
      }, 10000)
    }
  })

  Dota2.on('unready', () => console.log('node-dota2 unready'))
  Dota2.on('chatMessage', (channel, personaName, message) => console.log('[' + channel + '] ' + personaName + ': ' + message))
  Dota2.on('unhandled', (kMsg) => console.log(`UNHANDLED MSG: + ${dota2._getMessageName(kMsg)}`))
}

function onSteamServers(servers) {
  console.log('Received servers')
  fs.writeFile('servers', JSON.stringify(servers), (err) => {
    if (err) console.log(err)
  })
}

function onSteamLogOff(data) {
  console.log('Logged off from Steam')
}

function onSteamError(error) {
  console.log('Connection closed by server')
}

steamUser.on('updateMachineAuth', function(sentry, callback) {
  const hashedSentry = crypto.createHash('sha1').update(sentry.bytes).digest()
  fs.writeFileSync('sentry', hashedSentry)
  console.log('sentryfile saved')

  callback({ sha_file: hashedSentry })
})

let authDetails = {
  'account_name': config.steam_user,
  'password': config.steam_pass
}

if (config.steam_guard_code) authDetails.auth_code = config.steam_guard_code
if (config.two_factor_code) authDetails.two_factor_code = config.two_factor_code

try {
  const sentry = fs.readFileSync('sentry')
  if (sentry.length) authDetails.sha_sentryfile = sentry
} catch (err){
  console.log(err)
}

steamClient.connect()
steamClient.on('connected', () => steamUser.logOn(authDetails))
steamClient.on('logOnResponse', onSteamLogOn)
steamClient.on('loggedOff', onSteamLogOff)
steamClient.on('error', onSteamError)
steamClient.on('servers', onSteamServers)