// src/App.js (Ejemplo Básico)
import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io('http://192.168.1.86:3001'); // Reemplaza con la URL de tu servidor

function App() {
    const [roomId, setRoomId] = useState('');
    const [userId, setUserId] = useState(''); // Genera un ID único para cada usuario
    const [remoteUserId, setRemoteUserId] = useState('');
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const [stream, setStream] = useState(null);

    const pc = useRef(null); // RTCPeerConnection

    useEffect(() => {
        const newUserId = Math.random().toString(36).substring(7); // Generar ID único
        setUserId(newUserId);

        socket.on('user-connected', (userId) => {
            console.log('User connected:', userId);
            setRemoteUserId(userId); // Almacena el ID del usuario remoto
        });

        socket.on('user-disconnected', (userId) => {
            console.log('User disconnected:', userId);
            // Lógica para limpiar la interfaz si el otro usuario se desconecta
            setRemoteUserId('');
        });
    }, []);


    const joinRoom = async () => {
        socket.emit('join-room', roomId, userId);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            setStream(stream);
            localVideoRef.current.srcObject = stream;
        } catch (error) {
            console.error('Error accessing media devices:', error);
        }
    };

    const callUser = async () => {
        pc.current = new RTCPeerConnection();

        stream.getTracks().forEach(track => {
            pc.current.addTrack(track, stream);
        });

        pc.current.onicecandidate = event => {
            if (event.candidate) {
                console.log("Enviando ICE candidate");
                socket.emit('ice-candidate', roomId, event.candidate);
            }
        };

        pc.current.ontrack = event => {
            remoteVideoRef.current.srcObject = event.streams[0];
        };

        const offer = await pc.current.createOffer();
        await pc.current.setLocalDescription(offer);

        socket.emit('offer', roomId, pc.current.localDescription);
    };

    useEffect(() => {
        socket.on('offer', async (description) => {
            pc.current = new RTCPeerConnection();

            stream.getTracks().forEach(track => {
                pc.current.addTrack(track, stream);
            });

            pc.current.onicecandidate = event => {
                if (event.candidate) {
                    console.log("Enviando ICE candidate (respuesta)");
                    socket.emit('ice-candidate', roomId, event.candidate);
                }
            };

            pc.current.ontrack = event => {
                remoteVideoRef.current.srcObject = event.streams[0];
            };

            await pc.current.setRemoteDescription(description);
            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);
            socket.emit('answer', roomId, pc.current.localDescription);
        });

        socket.on('answer', async (description) => {
            await pc.current.setRemoteDescription(description);
        });

        socket.on('ice-candidate', async (candidate) => {
            try {
                await pc.current.addIceCandidate(candidate);
            } catch (e) {
                console.error('Error adding ice candidate:', e);
            }
        });


        return () => {
            socket.off('offer');
            socket.off('answer');
            socket.off('ice-candidate');
        };
    }, [roomId, stream]);

    return (
        <div>
            <h1>WebRTC Video Call</h1>
            <div>
                <label>Room ID:</label>
                <input type="text" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
                <button onClick={joinRoom}>Join Room</button>
            </div>
            <div>
                <video ref={localVideoRef} autoPlay muted style={{ width: '200px', height: '150px' }} />
                <video ref={remoteVideoRef} autoPlay style={{ width: '200px', height: '150px' }} />
            </div>
            {remoteUserId && <p>User {remoteUserId} is in the room!</p>}
            <button onClick={callUser}>Call User</button>
            <p>Your User ID: {userId}</p>
        </div>
    );
}

export default App;