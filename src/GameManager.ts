import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { Game } from './Game';
import { INIT_GAME, BALL_MOVE, GAME_OVER, INNINGS_OVER, OUT } from './constants';

// Interface to represent a user with a WebSocket connection and a username
interface User {
  socket: WebSocket;
  username: string;
}

export class GameManager {
  private games: Game[] = [];
  private pendingUser: User | null = null; // For pairing users into games
  private users: User[] = [];

  // Add a new user and attempt to pair them with another user to start a game
  addUser(socket: WebSocket, username: string) {
    const user: User = { socket, username };
    this.users.push(user); // Add user to the list of connected users

    this.addHandlers(socket); // Add WebSocket event handlers

    if (this.pendingUser === null) {
      this.pendingUser = user; // If no pending user, set this as pending for pairing
    } else {
      // If there's a pending user, create a new game
      const gameId = uuidv4();
      const newGame = new Game(gameId, this.pendingUser, user); // Start a new game with pending user and new user

      this.games.push(newGame); // Add the new game to the list of games

      // Notify both players that the game has started
      this.pendingUser.socket.send(
        JSON.stringify({
          event: INIT_GAME,
          gameId,
          opponentName: username,
        })
      );
      user.socket.send(
        JSON.stringify({
          event: INIT_GAME,
          gameId,
          opponentName: this.pendingUser.username,
        })
      );

      this.pendingUser = null; // Clear the pending user after game start
      newGame.startGame(); // Start the game logic
    }
  }

  // Add event handlers for WebSocket messages and closing events
  addHandlers(socket: WebSocket) {
    socket.on('message', (data) => {
      const message = JSON.parse(data.toString());

      if (message.event === 'join') {
        this.addUser(socket, message.username); // Add the user with the provided username
      } else {
        this.handleMessage(socket, message);
      }
    });

    socket.on('close', () => {
      this.removeUser(socket); // Handle user disconnection
    });
  }

  // Handle messages and route them to the appropriate game
  handleMessage(socket: WebSocket, message: any) {
    const game = this.games.find((g) => g.isPlayerInGame(socket));
    if (game) {
      game.handleMessage(socket, message); // Forward the message to the appropriate game
    }
  }

  // Remove a user and stop any active games they were part of
  removeUser(socket: WebSocket) {
    this.users = this.users.filter((user) => user.socket !== socket); // Remove the user from the list

    if (this.pendingUser?.socket === socket) {
      this.pendingUser = null; // Clear the pending user if it's the one who disconnected
    }

    // Find and stop the game where this user was playing
    const game = this.games.find((g) => g.isPlayerInGame(socket));
    if (game) {
      game.stopGame(); // Notify the other player and stop the game
      this.games = this.games.filter((g) => g !== game); // Remove the game from the list
    }
  }
}
