import http from 'http';
import WebSocket, { WebSocketServer } from 'ws'; 
import { GameManager } from './GameManager';

const port = 8867; 
const server = http.createServer(function(request: any, response: any) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.end("hi there");
});
const wss = new WebSocketServer({ server }); 

const gameManager = new GameManager();

// Handle new WebSocket connections
wss.on('connection', (socket: WebSocket) => {
    console.log('New WebSocket connection established');
  console.log('New WebSocket connection established');

  // Add the user to the GameManager when a new connection is established
  socket.on('message', (data) => {
    console.log('WebSocket message received:', data.toString());
    const message = JSON.parse(data.toString());
    if (message.event === 'join' && message.username) {
      gameManager.addUser(socket, message.username); // Add user to the GameManager
    }
  });

  socket.on('close', () => {
    console.log('WebSocket connection closed');
    gameManager.removeUser(socket); // Remove user from the GameManager
  });

  socket.on('error', (error) => {
    console.error('WebSocket error:', error); // Log WebSocket errors
  });
  socket.send('Hello! Message From Server!!');
});

// Start the server and listen on the specified port
server.listen(port, () => {
  console.log(`WebSocket server is running on port ${port}`);
});
