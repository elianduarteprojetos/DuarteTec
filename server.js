const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Estado do Jogo
let gameState = {
    allNumbers: Array.from({ length: 75 }, (_, i) => i + 1),
    availableNumbers: Array.from({ length: 75 }, (_, i) => i + 1),
    drawnNumbers: [],         // Pedras já publicadas para todos
    currentHiddenNumber: null // Pedra sorteada, mas aguardando confirmação do dono da banca
};

function getBingoLetter(num) {
    if (num <= 15) return 'B';
    if (num <= 30) return 'I';
    if (num <= 45) return 'N';
    if (num <= 60) return 'G';
    return 'O';
}

io.on('connection', (socket) => {
    // Envia o estado atual assim que alguém conecta
    socket.emit('game-state', gameState);

    // Dono da banca sorteia a pedra (fica oculta primeiro)
    socket.on('draw-number', () => {
        if (gameState.availableNumbers.length === 0) {
            socket.emit('error-msg', 'Todas as pedras já foram sorteadas!');
            return;
        }

        // Se já houver uma pedra oculta não confirmada, não sorteia outra
        if (gameState.currentHiddenNumber !== null) {
            return;
        }

        const randomIndex = Math.floor(Math.random() * gameState.availableNumbers.length);
        const drawn = gameState.availableNumbers.splice(randomIndex, 1)[0];
        
        gameState.currentHiddenNumber = {
            number: drawn,
            letter: getBingoLetter(drawn)
        };

        // Envia a pedra oculta APENAS para o dono da banca (host)
        socket.emit('hidden-stone', gameState.currentHiddenNumber);
        
        // Avisa os outros que o host está preparando a pedra
        socket.broadcast.emit('drawing-pending');
    });

    // Dono da banca confirma e exibe a pedra para todos
    socket.on('publish-number', () => {
        if (!gameState.currentHiddenNumber) return;

        const stone = gameState.currentHiddenNumber;
        gameState.drawnNumbers.push(stone);
        gameState.currentHiddenNumber = null;

        // Envia a pedra oficial para TODOS (jogadores e host)
        io.emit('stone-published', {
            stone: stone,
            drawnNumbers: gameState.drawnNumbers
        });
    });

    // Reiniciar o jogo
    socket.on('reset-game', () => {
        gameState.availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
        gameState.drawnNumbers = [];
        gameState.currentHiddenNumber = null;
        io.emit('game-state', gameState);
        io.emit('game-reset');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT} (http://localhost:${PORT})`);
});
