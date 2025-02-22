const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp');
const EventEmitter = require('events');

class SteamAuthService extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
  }

  async loginAccount(username, password, sharedSecret = null) {
    try {
      const client = new SteamUser();
      
      const loginOptions = {
        accountName: username,
        password: password,
        rememberPassword: true
      };

      if (sharedSecret) {
        loginOptions.twoFactorCode = SteamTotp.generateAuthCode(sharedSecret);
      }

      return new Promise((resolve, reject) => {
        client.logOn(loginOptions);

        client.on('loggedOn', () => {
          console.log(`Successfully logged in as ${username}`);
          
          client.setPersona(SteamUser.EPersonaState.Online);
          client.getPersonas([client.steamID], (err, personas) => {
            if (err) {
              console.error(`Error getting persona for ${username}:`, err);
            }
          });

          this.sessions.set(username, {
            client,
            steamId: client.steamID.toString()
          });

          client.on('friendMessage', (steamId, message) => {
            console.log(`Message from ${steamId} to ${username}: ${message}`);
            this.emit('friendMessage', {
              to: username,
              from: steamId.toString(),
              message: message
            });
          });

          resolve({
            success: true,
            steamId: client.steamID.toString()
          });
        });

        client.on('error', (err) => {
          console.error(`Login failed for ${username}:`, err);
          reject(err);
        });
      });
    } catch (error) {
      console.error('Steam login error:', error);
      throw error;
    }
  }

  getSession(username) {
    return this.sessions.get(username);
  }

  getAllSessions() {
    return Array.from(this.sessions.entries()).map(([username, session]) => ({
      username,
      steamId: session.steamId
    }));
  }

  async logout(username) {
    const session = this.sessions.get(username);
    if (session) {
      session.client.logOff();
      this.sessions.delete(username);
      return true;
    }
    return false;
  }
}

module.exports = new SteamAuthService(); 