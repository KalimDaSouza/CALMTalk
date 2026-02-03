const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Baza danych SQLite
const db = new sqlite3.Database('./komunikator.db', (err) => {
    if (err) {
        console.error('Błąd połączenia z bazą danych:', err);
    } else {
        console.log('✅ Połączono z bazą danych');
        initDatabase();
    }
});

// Inicjalizacja tabel w bazie danych
function initDatabase() {
    db.run(`
        CREATE TABLE IF NOT EXISTS rooms (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            mode TEXT NOT NULL,
            creator TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            active INTEGER DEFAULT 1
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT NOT NULL,
            author TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (room_id) REFERENCES rooms(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT NOT NULL,
            username TEXT NOT NULL,
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (room_id) REFERENCES rooms(id)
        )
    `);

    console.log('✅ Tabele bazy danych gotowe');
}

// Przechowywanie aktywnych pokoi i użytkowników w pamięci
const activeRooms = new Map();
const socketToRoom = new Map();
const socketToUser = new Map();

// API Endpoints

// Tworzenie nowego pokoju
app.post('/api/rooms/create', (req, res) => {
    const { name, mode, creator } = req.body;

    if (!name || !mode || !creator) {
        return res.status(400).json({ error: 'Brak wymaganych danych' });
    }

    const roomId = 'room_' + Math.random().toString(36).substr(2, 9);

    db.run(
        'INSERT INTO rooms (id, name, mode, creator) VALUES (?, ?, ?, ?)',
        [roomId, name, mode, creator],
        (err) => {
            if (err) {
                console.error('Błąd tworzenia pokoju:', err);
                return res.status(500).json({ error: 'Błąd serwera' });
            }

            // Inicjalizuj pokój w pamięci
            activeRooms.set(roomId, {
                id: roomId,
                name: name,
                mode: mode,
                creator: creator,
                participants: new Set(),
                messages: []
            });

            res.json({
                success: true,
                roomId: roomId,
                link: `${req.protocol}://${req.get('host')}/?room=${roomId}&mode=${mode}`
            });
        }
    );
});

// Pobieranie informacji o pokoju
app.get('/api/rooms/:roomId', (req, res) => {
    const { roomId } = req.params;

    db.get(
        'SELECT * FROM rooms WHERE id = ? AND active = 1',
        [roomId],
        (err, room) => {
            if (err) {
                return res.status(500).json({ error: 'Błąd serwera' });
            }

            if (!room) {
                return res.status(404).json({ error: 'Pokój nie istnieje' });
            }

            // Pobierz listę uczestników
            db.all(
                'SELECT DISTINCT username FROM participants WHERE room_id = ? ORDER BY joined_at DESC',
                [roomId],
                (err, participants) => {
                    if (err) {
                        return res.status(500).json({ error: 'Błąd serwera' });
                    }

                    // Pobierz ostatnie wiadomości
                    db.all(
                        'SELECT * FROM messages WHERE room_id = ? ORDER BY timestamp DESC LIMIT 50',
                        [roomId],
                        (err, messages) => {
                            if (err) {
                                return res.status(500).json({ error: 'Błąd serwera' });
                            }

                            res.json({
                                room: room,
                                participants: participants.map(p => p.username),
                                messages: messages.reverse()
                            });
                        }
                    );
                }
            );
        }
    );
});

// Pobieranie wiadomości z pokoju
app.get('/api/rooms/:roomId/messages', (req, res) => {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    db.all(
        'SELECT * FROM messages WHERE room_id = ? ORDER BY timestamp DESC LIMIT ?',
        [roomId, limit],
        (err, messages) => {
            if (err) {
                return res.status(500).json({ error: 'Błąd serwera' });
            }

            res.json({ messages: messages.reverse() });
        }
    );
});

// WebSocket - obsługa połączeń w czasie rzeczywistym
io.on('connection', (socket) => {
    console.log('🔌 Nowe połączenie:', socket.id);

    // Dołączanie do pokoju
    socket.on('join-room', (data) => {
        const { roomId, username } = data;

        if (!roomId || !username) {
            socket.emit('error', { message: 'Brak wymaganych danych' });
            return;
        }

        // Sprawdź czy pokój istnieje
        db.get('SELECT * FROM rooms WHERE id = ? AND active = 1', [roomId], (err, room) => {
            if (err || !room) {
                socket.emit('error', { message: 'Pokój nie istnieje' });
                return;
            }

            // Dołącz do pokoju Socket.IO
            socket.join(roomId);
            socketToRoom.set(socket.id, roomId);
            socketToUser.set(socket.id, username);

            // Zapisz uczestnika w bazie
            db.run(
                'INSERT INTO participants (room_id, username) VALUES (?, ?)',
                [roomId, username]
            );

            // Dodaj do aktywnego pokoju w pamięci
            if (!activeRooms.has(roomId)) {
                activeRooms.set(roomId, {
                    id: roomId,
                    name: room.name,
                    mode: room.mode,
                    participants: new Set(),
                    messages: []
                });
            }

            const roomData = activeRooms.get(roomId);
            roomData.participants.add(username);

            // Powiadom innych użytkowników
            socket.to(roomId).emit('user-joined', {
                username: username,
                participants: Array.from(roomData.participants)
            });

            // Wyślij aktualne informacje do nowego użytkownika
            socket.emit('room-joined', {
                roomId: roomId,
                roomName: room.name,
                mode: room.mode,
                participants: Array.from(roomData.participants)
            });

            console.log(`✅ ${username} dołączył do pokoju ${roomId}`);
        });
    });

    // Wysyłanie wiadomości
    socket.on('send-message', (data) => {
        const { message } = data;
        const roomId = socketToRoom.get(socket.id);
        const username = socketToUser.get(socket.id);

        if (!roomId || !username) {
            socket.emit('error', { message: 'Nie jesteś w żadnym pokoju' });
            return;
        }

        const timestamp = new Date().toISOString();

        // Zapisz wiadomość w bazie
        db.run(
            'INSERT INTO messages (room_id, author, message, timestamp) VALUES (?, ?, ?, ?)',
            [roomId, username, message, timestamp],
            function(err) {
                if (err) {
                    console.error('Błąd zapisywania wiadomości:', err);
                    return;
                }

                const messageData = {
                    id: this.lastID,
                    author: username,
                    message: message,
                    timestamp: timestamp
                };

                // Wyślij wiadomość do wszystkich w pokoju
                io.to(roomId).emit('new-message', messageData);

                console.log(`💬 Wiadomość od ${username} w pokoju ${roomId}`);
            }
        );
    });

    // WebRTC - sygnalizacja dla wideo
    socket.on('webrtc-offer', (data) => {
        const { targetSocketId, offer } = data;
        socket.to(targetSocketId).emit('webrtc-offer', {
            offer: offer,
            senderSocketId: socket.id
        });
    });

    socket.on('webrtc-answer', (data) => {
        const { targetSocketId, answer } = data;
        socket.to(targetSocketId).emit('webrtc-answer', {
            answer: answer,
            senderSocketId: socket.id
        });
    });

    socket.on('webrtc-ice-candidate', (data) => {
        const { targetSocketId, candidate } = data;
        socket.to(targetSocketId).emit('webrtc-ice-candidate', {
            candidate: candidate,
            senderSocketId: socket.id
        });
    });

    // Informacja o statusie audio/video
    socket.on('media-state-changed', (data) => {
        const roomId = socketToRoom.get(socket.id);
        const username = socketToUser.get(socket.id);

        if (roomId) {
            socket.to(roomId).emit('peer-media-state-changed', {
                username: username,
                socketId: socket.id,
                audio: data.audio,
                video: data.video
            });
        }
    });

    // Rozłączanie
    socket.on('disconnect', () => {
        const roomId = socketToRoom.get(socket.id);
        const username = socketToUser.get(socket.id);

        if (roomId && username) {
            const roomData = activeRooms.get(roomId);
            if (roomData) {
                roomData.participants.delete(username);

                // Powiadom innych
                socket.to(roomId).emit('user-left', {
                    username: username,
                    participants: Array.from(roomData.participants)
                });

                console.log(`👋 ${username} opuścił pokój ${roomId}`);

                // Jeśli pokój jest pusty, możesz go oznaczyć jako nieaktywny
                if (roomData.participants.size === 0) {
                    activeRooms.delete(roomId);
                }
            }
        }

        socketToRoom.delete(socket.id);
        socketToUser.delete(socket.id);
        console.log('❌ Rozłączono:', socket.id);
    });
});

// Serwowanie pliku HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Uruchomienie serwera
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('');
    console.log('🚀 ========================================');
    console.log(`🚀 Serwer komunikatora działa na porcie ${PORT}`);
    console.log(`🚀 Otwórz przeglądarkę: http://localhost:${PORT}`);
    console.log('🚀 ========================================');
    console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Zamykanie serwera...');
    db.close((err) => {
        if (err) {
            console.error('Błąd zamykania bazy:', err);
        }
        console.log('✅ Baza danych zamknięta');
        process.exit(0);
    });
});
