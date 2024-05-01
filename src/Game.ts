import { WebSocket } from 'ws';
import { INNINGS_OVER, GAME_OVER, OUT, BALL_MOVE } from './constants';

export class Game {
  private gameId: string;
  private player1: { socket: WebSocket; username: string };
  private player2: { socket: WebSocket; username: string };
  private currentBatsman: WebSocket;
  private player1Score: number = 0;
  private player2Score: number = 0;
  private ballsPlayed: number = 0;
  private timeout: NodeJS.Timeout | null = null; // Timer for each ball
  private timeoutDuration: number = 6000; // Timeout duration in milliseconds
  private currentMoves: { batsman?: number; bowler?: number } = {}; // Store the current moves

  constructor(gameId: string, player1: { socket: WebSocket; username: string }, player2: { socket: WebSocket; username: string }) {
    this.gameId = gameId;
    this.player1 = player1;
    this.player2 = player2;
    this.currentBatsman = player1.socket; // Default to player1 as the initial batsman
  }

  startGame() {
    this.resetGame();
    this.startTimer();
  }

  resetGame() {
    this.ballsPlayed = 0;
    this.player1Score = 0;
    this.player2Score = 0;
  }

  startTimer() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    this.timeout = setTimeout(() => {
      this.handleDotBall();
    }, this.timeoutDuration);
  }

  handleDotBall() {
    this.sendToBothPlayers({
      event: BALL_MOVE,
      choice: 0, // Dot ball
    });

    if (this.ballsPlayed >= 6) {
      this.endInnings(); // End the innings if all balls are played
    } else {
      this.startTimer(); // Restart the timer for the next ball
    }
  }

  endInnings() {
    if (this.currentBatsman === this.player1.socket) {
      this.currentBatsman = this.player2.socket; // Switch to the second innings
      this.sendToBothPlayers({
        event: INNINGS_OVER,
        targetScore: this.player1Score,
      });
    } else {
      const winner = this.player1Score > this.player2Score ? this.player1.username : this.player2.username;
      this.sendToBothPlayers({
        event: GAME_OVER,
        winner,
      });
    }
  }

  handleMessage(socket: WebSocket, message: any) {
    // Depending on the event, take action
    switch (message.event) {
      case BALL_MOVE:
        const choice = message.choice;

        // Determine if the sender is the batsman or bowler
        if (socket === this.currentBatsman) {
          this.currentMoves.batsman = choice; // Store the batsman's move
        } else {
          const currentBowler = this.currentBatsman === this.player1.socket ? this.player2.socket : this.player1.socket;
          if (socket === currentBowler) {
            this.currentMoves.bowler = choice; // Store the bowler's move
          }
        }

        // If both batsman and bowler have made their moves, process them
        if (this.currentMoves.batsman !== undefined && this.currentMoves.bowler !== undefined) {
          this.handleBall(this.currentMoves.batsman, this.currentMoves.bowler);
          // Reset the moves for the next turn
          this.currentMoves = {};
        }
        break;

      default:
        console.log(`Unknown message event: ${message.event}`);
        break;
    }
  }

  handleBall(batsmanChoice: number, bowlerChoice: number) {
    if (this.timeout) {
      clearTimeout(this.timeout); // Clear timeout when moves are made
    }

    this.ballsPlayed++;

    if (batsmanChoice === bowlerChoice) {
      this.sendToBothPlayers({ event: OUT }); // If choices are the same, batsman is out
      this.endInnings();
      return;
    }

    if (this.currentBatsman === this.player1.socket) {
      this.player1Score += batsmanChoice; // Player 1 scores
    } else {
      this.player2Score += batsmanChoice; // Player 2 scores
    }

    if (this.ballsPlayed >= 6) {
      this.endInnings(); // End the innings if 6 balls are played
    } else {
      this.startTimer(); // Restart the timer for the next ball
    }
  }

  sendToBothPlayers(event: Record<string, unknown>) {
    this.player1.socket.send(JSON.stringify(event));
    this.player2.socket.send(JSON.stringify(event));
  }

  isPlayerInGame(socket: WebSocket): boolean {
    return socket === this.player1.socket || socket === this.player2.socket;
  }

  stopGame() {
    if (this.timeout) {
      clearTimeout(this.timeout); // Clear existing timeouts
    }

    const gameOverEvent = JSON.stringify({
      event: GAME_OVER,
      reason: 'player_disconnected',
    });

    this.player1.socket.send(gameOverEvent);
    this.player2.socket.send(gameOverEvent);
  }
}
