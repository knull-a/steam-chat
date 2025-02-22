require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const steamAuth = require('./services/steamAuth');
const SteamID = require('steamid');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

async function initializeSteamAccounts() {
  try {
    const envVars = process.env;
    const accountPromises = [];

    console.log('Starting Steam account initialization...');

    for (let i = 1; ; i++) {
      const usernameKey = `STEAM_ACCOUNT_${i}_USERNAME`;
      const passwordKey = `STEAM_ACCOUNT_${i}_PASSWORD`;
      const secretKey = `STEAM_ACCOUNT_${i}_SHARED_SECRET`;

      if (!envVars[usernameKey] || !envVars[passwordKey]) {
        console.log(`Found ${i-1} Steam accounts in configuration`);
        break;
      }

      console.log(`Initializing Steam account ${i}: ${envVars[usernameKey]}`);
      console.log(`2FA enabled for account ${i}: ${Boolean(envVars[secretKey])}`);
      
      accountPromises.push(
        steamAuth.loginAccount(
          envVars[usernameKey],
          envVars[passwordKey],
          envVars[secretKey] || null
        )
      );
    }

    const results = await Promise.allSettled(accountPromises);
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`Account ${index + 1} logged in successfully with Steam ID: ${result.value.steamId}`);
      } else {
        console.error(`Failed to login account ${index + 1}:`, result.reason);
      }
    });
  } catch (error) {
    console.error('Error initializing Steam accounts:', error);
  }
}

steamAuth.on('friendMessage', (data) => {
  io.emit('messageReceived', {
    to: data.to,
    from: data.from,
    message: data.message
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    activeAccounts: steamAuth.getAllSessions().length
  });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('sendMessage', async (data) => {
    try {
      const { senderLogin, receiverSteamId, message } = data;
      
      const senderSession = steamAuth.getSession(senderLogin);
      if (!senderSession) {
        socket.emit('error', { message: 'Sender not authenticated' });
        return;
      }

      if (!receiverSteamId || typeof receiverSteamId !== 'string') {
        socket.emit('error', { message: 'Invalid receiver Steam ID' });
        return;
      }

      try {
        new SteamID(receiverSteamId);
      } catch (err) {
        socket.emit('error', { message: 'Invalid Steam ID format' });
        return;
      }

      const isFriend = await new Promise((resolve) => {
        senderSession.client.getPersonas([receiverSteamId], (err, personas) => {
          if (err || !personas[receiverSteamId]) {
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });

      if (!isFriend) {
        socket.emit('error', { message: 'Cannot send message: User is not in your friends list' });
        return;
      }

      senderSession.client.chat.sendFriendMessage(receiverSteamId, message);
      
      socket.emit('messageSent', {
        success: true,
        to: receiverSteamId,
        message: message
      });
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message: ' + error.message });
    }
  });

  socket.on('getActiveSessions', () => {
    socket.emit('activeSessions', steamAuth.getAllSessions());
  });

  socket.on('getFriends', async (username) => {
    try {
      const session = steamAuth.getSession(username);
      if (!session) {
        socket.emit('error', { message: 'Account not found' });
        return;
      }

      const friends = await new Promise((resolve) => {
        session.client.getPersonas(session.client.myFriends, (err, personas) => {
          if (err) {
            resolve([]);
          } else {
            resolve(Object.entries(personas).map(([steamId, persona]) => ({
              steamId,
              name: persona.player_name,
              state: persona.game_played_app_id ? 'In-Game' : 
                     persona.persona_state === 1 ? 'Online' : 'Offline'
            })));
          }
        });
      });

      socket.emit('friendsList', friends);
    } catch (error) {
      console.error('Error getting friends list:', error);
      socket.emit('error', { message: 'Failed to get friends list' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

initializeSteamAccounts().then(() => {
  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Active Steam accounts: ${steamAuth.getAllSessions().length}`);
  });
}); 