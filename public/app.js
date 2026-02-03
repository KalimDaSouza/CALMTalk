// Połączenie z serwerem WebSocket
const socket = io();

// Stan aplikacji
let currentRoom = null;
let currentUser = null;
let roomMode = 'chat';
let localStream = null;
let peerConnections = new Map();
let isMuted = false;
let isVideoOff = false;

// Konfiguracja ICE servers (STUN/TURN) dla WebRTC
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// ============================================
// OBSŁUGA INTERFEJSU
// ============================================

function showWelcome() {
    hideAllScreens();
    document.getElementById('welcomeScreen').classList.remove('hidden');
}

function showCreateRoom() {
    hideAllScreens();
    document.getElementById('createRoomScreen').classList.remove('hidden');
    document.getElementById('roomLinkSection').classList.add('hidden');
}

function showJoinRoom() {
    hideAllScreens();
    document.getElementById('joinRoomScreen').classList.remove('hidden');
}

function showLoading() {
    hideAllScreens();
    document.getElementById('loadingScreen').classList.remove('hidden');
}

function hideAllScreens() {
    document.getElementById('welcomeScreen').classList.add('hidden');
    document.getElementById('createRoomScreen').classList.add('hidden');
    document.getElementById('joinRoomScreen').classList.add('hidden');
    document.getElementById('loadingScreen').classList.add('hidden');
    document.getElementById('chatContainer').style.display = 'none';
    document.getElementById('videoContainer').style.display = 'none';
}

function selectMode(mode) {
    roomMode = mode;
    document.getElementById('chatModeBtn').classList.remove('active');
    document.getElementById('videoModeBtn').classList.remove('active');
    
    if (mode === 'chat') {
        document.getElementById('chatModeBtn').classList.add('active');
    } else {
        document.getElementById('videoModeBtn').classList.add('active');
    }
}

// ============================================
// TWORZENIE I DOŁĄCZANIE DO POKOI
// ============================================

async function createRoom() {
    const roomName = document.getElementById('roomName').value.trim();
    const userName = document.getElementById('userName').value.trim();

    if (!roomName || !userName) {
        showNotification('Proszę wypełnić wszystkie pola', 'error');
        return;
    }

    showLoading();

    try {
        const response = await fetch('/api/rooms/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: roomName,
                mode: roomMode,
                creator: userName
            })
        });

        const data = await response.json();

        if (data.success) {
            currentRoom = {
                id: data.roomId,
                name: roomName,
                mode: roomMode
            };
            currentUser = userName;

            hideAllScreens();
            document.getElementById('createRoomScreen').classList.remove('hidden');
            document.getElementById('generatedLink').value = data.link;
            document.getElementById('roomLinkSection').classList.remove('hidden');

            showNotification('Pokój utworzony pomyślnie!', 'success');
        } else {
            showNotification('Błąd tworzenia pokoju', 'error');
            showWelcome();
        }
    } catch (error) {
        console.error('Błąd:', error);
        showNotification('Błąd połączenia z serwerem', 'error');
        showWelcome();
    }
}

function copyLink() {
    const linkInput = document.getElementById('generatedLink');
    linkInput.select();
    document.execCommand('copy');
    showNotification('Link skopiowany do schowka!', 'success');
}

async function joinRoom() {
    const roomLink = document.getElementById('roomLink').value.trim();
    const userName = document.getElementById('joinUserName').value.trim();

    if (!roomLink || !userName) {
        showNotification('Proszę wypełnić wszystkie pola', 'error');
        return;
    }

    try {
        const url = new URL(roomLink);
        const roomId = url.searchParams.get('room');
        const mode = url.searchParams.get('mode') || 'chat';

        if (!roomId) {
            showNotification('Nieprawidłowy link do pokoju', 'error');
            return;
        }

        showLoading();

        // Sprawdź czy pokój istnieje
        const response = await fetch(`/api/rooms/${roomId}`);
        const data = await response.json();

        if (data.error) {
            showNotification('Pokój nie istnieje lub jest nieaktywny', 'error');
            showWelcome();
            return;
        }

        currentRoom = {
            id: roomId,
            name: data.room.name,
            mode: mode
        };
        currentUser = userName;
        roomMode = mode;

        await enterRoom();

    } catch (error) {
        console.error('Błąd:', error);
        showNotification('Nieprawidłowy link lub błąd połączenia', 'error');
        showWelcome();
    }
}

async function enterRoom() {
    if (!currentRoom || !currentUser) {
        showNotification('Brak danych pokoju', 'error');
        return;
    }

    showLoading();

    // Dołącz do pokoju przez WebSocket
    socket.emit('join-room', {
        roomId: currentRoom.id,
        username: currentUser
    });
}

// ============================================
// WEBSOCKET - OBSŁUGA ZDARZEŃ
// ============================================

socket.on('room-joined', async (data) => {
    console.log('Dołączono do pokoju:', data);

    currentRoom.name = data.roomName;
    roomMode = data.mode;

    hideAllScreens();

    if (roomMode === 'chat') {
        // Tryb czatu
        document.getElementById('chatContainer').style.display = 'flex';
        document.getElementById('chatRoomName').textContent = currentRoom.name;
        updateParticipants(data.participants);
        await loadMessages();
    } else {
        // Tryb wideo
        document.getElementById('videoContainer').style.display = 'flex';
        document.getElementById('videoRoomName').textContent = currentRoom.name;
        updateVideoParticipants(data.participants.length);
        await initializeVideo();
    }

    showNotification('Połączono z pokojem!', 'success');
});

socket.on('user-joined', (data) => {
    console.log('Nowy użytkownik:', data.username);
    showNotification(`${data.username} dołączył do pokoju`, 'info');
    
    if (roomMode === 'chat') {
        updateParticipants(data.participants);
    } else {
        updateVideoParticipants(data.participants.length);
    }
});

socket.on('user-left', (data) => {
    console.log('Użytkownik opuścił pokój:', data.username);
    showNotification(`${data.username} opuścił pokój`, 'info');
    
    if (roomMode === 'chat') {
        updateParticipants(data.participants);
    } else {
        updateVideoParticipants(data.participants.length);
        // Usuń wideo użytkownika
        const videoElement = document.getElementById(`video-${data.username}`);
        if (videoElement) {
            videoElement.remove();
        }
    }
});

socket.on('new-message', (data) => {
    addMessageToUI(data);
    const messagesEl = document.getElementById('chatMessages');
    messagesEl.scrollTop = messagesEl.scrollHeight;
});

socket.on('error', (data) => {
    console.error('Błąd WebSocket:', data);
    showNotification(data.message, 'error');
});

// ============================================
// CZAT
// ============================================

function updateParticipants(participants) {
    const count = participants.length;
    document.getElementById('participantCount').textContent = count;
    
    const listEl = document.getElementById('participantList');
    listEl.innerHTML = '';
    
    participants.forEach(p => {
        const participantEl = document.createElement('div');
        participantEl.className = 'participant';
        participantEl.textContent = p === currentUser ? p + ' (Ty)' : p;
        listEl.appendChild(participantEl);
    });
}

async function loadMessages() {
    try {
        const response = await fetch(`/api/rooms/${currentRoom.id}/messages?limit=50`);
        const data = await response.json();
        
        const messagesEl = document.getElementById('chatMessages');
        messagesEl.innerHTML = '';
        
        data.messages.forEach(msg => {
            addMessageToUI(msg);
        });
        
        messagesEl.scrollTop = messagesEl.scrollHeight;
    } catch (error) {
        console.error('Błąd ładowania wiadomości:', error);
    }
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text) return;
    
    socket.emit('send-message', {
        message: text
    });
    
    input.value = '';
}

function addMessageToUI(message) {
    const messagesEl = document.getElementById('chatMessages');
    const messageEl = document.createElement('div');
    messageEl.className = 'message ' + (message.author === currentUser ? 'message-own' : 'message-other');
    
    const timestamp = new Date(message.timestamp).toLocaleTimeString('pl-PL', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    messageEl.innerHTML = `
        <div class="message-author">${message.author}</div>
        <div class="message-text">${escapeHtml(message.message)}</div>
        <div class="message-time">${timestamp}</div>
    `;
    
    messagesEl.appendChild(messageEl);
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// ============================================
// WIDEO - WebRTC
// ============================================

async function initializeVideo() {
    try {
        // Pobierz strumień wideo i audio
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        // Wyświetl lokalny strumień
        const localVideo = document.getElementById('localVideo');
        localVideo.srcObject = localStream;

        console.log('Lokalne wideo zainicjalizowane');
        
        // Połącz z innymi uczestnikami, którzy już są w pokoju
        // (w pełnej implementacji potrzebny byłby mechanizm sygnalizacji)
        
    } catch (error) {
        console.error('Błąd dostępu do kamery/mikrofonu:', error);
        showNotification('Nie udało się uzyskać dostępu do kamery lub mikrofonu', 'error');
    }
}

function updateVideoParticipants(count) {
    document.getElementById('videoParticipantCount').textContent = count;
}

function toggleMute() {
    if (!localStream) return;
    
    isMuted = !isMuted;
    const audioTrack = localStream.getAudioTracks()[0];
    
    if (audioTrack) {
        audioTrack.enabled = !isMuted;
    }
    
    const btn = document.getElementById('muteBtn');
    const statusEl = document.getElementById('localVideoStatus');
    
    if (isMuted) {
        btn.classList.add('muted');
        btn.textContent = '🔇';
        statusEl.innerHTML = '<span class="status-icon muted">🔇</span>';
    } else {
        btn.classList.remove('muted');
        btn.textContent = '🎤';
        statusEl.innerHTML = '';
    }

    // Powiadom innych o zmianie statusu
    socket.emit('media-state-changed', {
        audio: !isMuted,
        video: !isVideoOff
    });
}

function toggleVideo() {
    if (!localStream) return;
    
    isVideoOff = !isVideoOff;
    const videoTrack = localStream.getVideoTracks()[0];
    
    if (videoTrack) {
        videoTrack.enabled = !isVideoOff;
    }
    
    const btn = document.getElementById('videoBtn');
    const statusEl = document.getElementById('localVideoStatus');
    
    if (isVideoOff) {
        btn.classList.add('off');
        btn.textContent = '📷';
        const currentStatus = statusEl.innerHTML;
        statusEl.innerHTML = currentStatus + '<span class="status-icon muted">📷</span>';
    } else {
        btn.classList.remove('off');
        btn.textContent = '📹';
        statusEl.querySelectorAll('.status-icon').forEach(el => {
            if (el.textContent === '📷') el.remove();
        });
    }

    // Powiadom innych o zmianie statusu
    socket.emit('media-state-changed', {
        audio: !isMuted,
        video: !isVideoOff
    });
}

// ============================================
// OPUSZCZANIE POKOJU
// ============================================

function leaveRoom() {
    if (confirm('Czy na pewno chcesz opuścić pokój?')) {
        // Zatrzymaj strumienie wideo
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }

        // Zamknij połączenia peer
        peerConnections.forEach(pc => pc.close());
        peerConnections.clear();

        // Rozłącz z WebSocket
        socket.disconnect();
        
        // Połącz ponownie
        setTimeout(() => {
            socket.connect();
        }, 100);

        currentRoom = null;
        currentUser = null;
        isMuted = false;
        isVideoOff = false;
        
        showWelcome();
    }
}

// ============================================
// POMOCNICZE FUNKCJE
// ============================================

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    notification.innerHTML = `${icon} ${message}`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// INICJALIZACJA
// ============================================

window.addEventListener('load', function() {
    // Sprawdź czy jest link w URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    
    if (roomId) {
        document.getElementById('roomLink').value = window.location.href;
        showJoinRoom();
    }
});

// Zapobiegaj przypadkowemu opuszczeniu strony
window.addEventListener('beforeunload', (e) => {
    if (currentRoom) {
        e.preventDefault();
        e.returnValue = '';
    }
});
