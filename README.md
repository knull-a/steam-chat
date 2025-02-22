# Steam Chat Backend

A WebSocket-based chat server that enables communication between Steam friends using Steam's official APIs.

## Features

- Steam account authentication with 2FA support
- Real-time chat messaging between Steam friends
- Multiple simultaneous Steam account connections
- WebSocket-based communication for real-time updates

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Steam account(s) with credentials
- (Optional) Steam Guard Mobile Authenticator

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd steam-chat
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure your `.env` file with your Steam account credentials:
```
PORT=3000
STEAM_ACCOUNT_1_USERNAME=your_username
STEAM_ACCOUNT_1_PASSWORD=your_password
STEAM_ACCOUNT_1_SHARED_SECRET=your_shared_secret
```

## Running the Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## Testing with Postman

1. Import the Postman collection (provided separately)
2. Set up a WebSocket connection to `ws://localhost:3000`
3. Use the following event formats:

### Send Message
```json
{
  "event": "sendMessage",
  "data": {
    "senderLogin": "your_steam_username",
    "receiverSteamId": "receiver_steamid64",
    "message": "Hello!"
  }
}
```

### Receive Message
Messages from Steam friends will be automatically received through the WebSocket connection with the following format:
```json
{
  "event": "messageReceived",
  "data": {
    "from": "sender_steamid64",
    "message": "Message content"
  }
}
```

## Error Handling

The server will emit error events in the following format:
```json
{
  "event": "error",
  "data": {
    "message": "Error description"
  }
}
```

## Notes

- Always handle steamid64 as strings to avoid JavaScript number precision issues
- Keep your Steam credentials secure and never commit them to version control
- In production, configure proper CORS settings in `server.js` 