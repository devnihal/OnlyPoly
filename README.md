# OnlyPoly

A LAN-based multiplayer Monopoly-style board game built with Node.js and Socket.io.

## Features
- Real-time multiplayer gameplay over LAN
- 3D animated dice
- Property trading and auctions
- Houses and hotels
- Premium glassmorphism UI

## Installation

```bash
npm install
```

## Running the Game

```bash
node server/index.js
```

Then open your browser to `http://localhost:3000`

For LAN play, other devices can connect using your local IP address (displayed in the terminal).

## Tech Stack
- **Backend**: Node.js, Socket.io
- **Frontend**: Vanilla JavaScript, CSS3
- **Architecture**: Server-authoritative game state

## Game Rules
- 2-8 players
- Roll dice to move around the board
- Buy properties, build houses/hotels
- Trade with other players
- Auction system for unowned properties
