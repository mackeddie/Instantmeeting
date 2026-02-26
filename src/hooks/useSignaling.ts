import { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import { RealtimeChannel } from '@supabase/supabase-js';
import type { Participant } from './usePresence';

export function useSignaling(
    channel: RealtimeChannel | null,
    userName: string,
    participants: Participant[],
    screenStream?: MediaStream | null
) {
    const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({});
    const peersRef = useRef<{ [key: string]: Peer.Instance }>({});
    const localStreamRef = useRef<MediaStream | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [mediaError, setMediaError] = useState<string | null>(null);
    const retryCount = useRef(0);

    const getMedia = async (constraints: MediaStreamConstraints = { video: true, audio: true }) => {
        try {
            setMediaError(null);
            console.log("Signaling: Starting media acquisition...", constraints);

            const devices = await navigator.mediaDevices.enumerateDevices();
            console.log("Signaling: Available devices:", devices.map(d => ({ kind: d.kind, label: d.label || 'HIDDEN' })));

            let videoStream: MediaStream | null = null;
            let audioStream: MediaStream | null = null;

            // Step 1: Try Combined first
            try {
                const combined = await navigator.mediaDevices.getUserMedia(constraints);
                console.log("Signaling: Combined media granted");
                localStreamRef.current = combined;
                setLocalStream(combined);
                return;
            } catch (err: any) {
                console.warn("Signaling: Combined media failed, falling back to separate requests", err);
            }

            // Step 2: Try Separated for better error isolation
            if (constraints.video) {
                try {
                    videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
                    console.log("Signaling: Video access granted separately");
                } catch (vErr: any) {
                    console.error("Signaling: Video failed", vErr);
                }
            }

            if (constraints.audio) {
                try {
                    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    console.log("Signaling: Audio access granted separately");
                } catch (aErr: any) {
                    console.error("Signaling: Audio failed", aErr);
                }
            }

            if (!videoStream && !audioStream) {
                setMediaError("Permission denied. Please check your browser and Windows Privacy Settings (Settings > Privacy > Camera/Microphone) and ensure 'Allow desktop apps' is ON.");
                throw new Error("Could not acquire any media tracks.");
            }

            const finalStream = new MediaStream();
            videoStream?.getTracks().forEach(t => finalStream.addTrack(t));
            audioStream?.getTracks().forEach(t => finalStream.addTrack(t));

            localStreamRef.current = finalStream;
            setLocalStream(finalStream);
        } catch (err: any) {
            console.error("Signaling: Critical media failure", err);
        }
    };

    useEffect(() => {
        getMedia();

        return () => {
            localStreamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, []);

    const retryMedia = () => {
        retryCount.current = 0;
        getMedia();
    };

    // Handle Screen Share Track replacement
    useEffect(() => {
        const screenTrack = screenStream?.getVideoTracks()[0];
        const cameraTrack = localStream?.getVideoTracks()[0];

        Object.entries(peersRef.current).forEach(([peerId, peer]) => {
            if (!peer.connected) return;

            // Simple-peer usually puts the stream in peer.streams[0]
            const stream = peer.streams[0];
            if (!stream) return;

            const currentTracks = stream.getVideoTracks();
            const currentTrack = currentTracks[0];
            const targetTrack = screenTrack || cameraTrack;

            if (targetTrack && currentTrack && currentTrack !== targetTrack) {
                console.log(`Signaling: Replacing track for peer ${peerId} from ${currentTrack.label} to ${targetTrack.label}`);
                try {
                    peer.replaceTrack(currentTrack, targetTrack, stream);
                } catch (err) {
                    console.error(`Signaling: Failed to replace track for peer ${peerId}`, err);
                }
            }
        });
    }, [screenStream, localStream]);

    useEffect(() => {
        if (!channel || !userName || !localStream) return;

        // Listen for signals
        channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
            const { from, to, signal } = payload;
            if (to !== userName) return;

            const peerInstance = peersRef.current[from];
            if (peerInstance) {
                peerInstance.signal(signal);
            } else {
                // Incoming call
                createPeer(from, false);
                const newPeer = peersRef.current[from];
                if (newPeer) newPeer.signal(signal);
            }
        });

        // Auto-call logic: if a new participant appears and their ID is "greater" than mine, I call them.
        // This simple tie-breaker prevents double calling.
        participants.forEach(p => {
            if (p.id !== userName && !peersRef.current[p.id] && p.id > userName) {
                createPeer(p.id, true);
            }
        });

        function createPeer(targetId: string, initiator: boolean) {
            // Use screenStream as initial stream if active, otherwise local camera
            const initialStream = screenStream || localStream;

            const peer = new Peer({
                initiator,
                trickle: false,
                stream: initialStream!,
            });

            peer.on('signal', (data: Peer.SignalData) => {
                channel?.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { from: userName, to: targetId, signal: data },
                });
            });

            peer.on('stream', (stream: MediaStream) => {
                setRemoteStreams(prev => ({ ...prev, [targetId]: stream }));
            });

            peer.on('close', () => {
                cleanupPeer(targetId);
            });

            peer.on('error', (err) => {
                console.error(`Peer ${targetId} error:`, err);
                cleanupPeer(targetId);
            });

            peersRef.current[targetId] = peer;
            return peer;
        }

        function cleanupPeer(targetId: string) {
            if (peersRef.current[targetId]) {
                peersRef.current[targetId].destroy();
                delete peersRef.current[targetId];
            }
            setRemoteStreams(prev => {
                const next = { ...prev };
                delete next[targetId];
                return next;
            });
        }

        return () => {
            Object.values(peersRef.current).forEach(p => p.destroy());
            peersRef.current = {};
        };
    }, [channel, userName, localStream, participants, screenStream]);

    return { remoteStreams, localStream, mediaError, retryMedia };
}
