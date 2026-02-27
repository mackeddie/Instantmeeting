import { useEffect, useRef, useState, useCallback } from 'react';
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
    // Use a ref for participants so signal listener doesn't need it as a dep
    const participantsRef = useRef<Participant[]>(participants);
    participantsRef.current = participants;
    const channelRef = useRef<RealtimeChannel | null>(channel);
    channelRef.current = channel;
    const screenStreamRef = useRef<MediaStream | null>(screenStream ?? null);
    screenStreamRef.current = screenStream ?? null;

    const getMedia = async (constraints: MediaStreamConstraints = { video: true, audio: true }) => {
        try {
            setMediaError(null);
            console.log('Signaling: Starting media acquisition...', constraints);

            // Step 1: Try Combined first
            try {
                const combined = await navigator.mediaDevices.getUserMedia(constraints);
                console.log('Signaling: Combined media granted');
                localStreamRef.current = combined;
                setLocalStream(combined);
                return;
            } catch (err: any) {
                console.warn('Signaling: Combined media failed, falling back to separate requests', err);
            }

            // Step 2: Try Separated for better error isolation
            let videoStream: MediaStream | null = null;
            let audioStream: MediaStream | null = null;

            if (constraints.video) {
                try {
                    videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
                    console.log('Signaling: Video access granted separately');
                } catch (vErr: any) {
                    console.error('Signaling: Video failed', vErr);
                }
            }

            if (constraints.audio) {
                try {
                    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    console.log('Signaling: Audio access granted separately');
                } catch (aErr: any) {
                    console.error('Signaling: Audio failed', aErr);
                }
            }

            if (!videoStream && !audioStream) {
                setMediaError(
                    "Permission denied. Please check your browser and Windows Privacy Settings (Settings > Privacy > Camera/Microphone) and ensure 'Allow desktop apps' is ON."
                );
                throw new Error('Could not acquire any media tracks.');
            }

            const finalStream = new MediaStream();
            videoStream?.getTracks().forEach(t => finalStream.addTrack(t));
            audioStream?.getTracks().forEach(t => finalStream.addTrack(t));

            localStreamRef.current = finalStream;
            setLocalStream(finalStream);
        } catch (err: any) {
            console.error('Signaling: Critical media failure', err);
        }
    };

    // Acquire camera/mic once on mount
    useEffect(() => {
        getMedia();
        return () => {
            localStreamRef.current?.getTracks().forEach(t => t.stop());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const retryMedia = () => {
        getMedia();
    };

    // ─── Helper: create a peer connection ─────────────────────────────────────
    const createPeer = useCallback((targetId: string, initiator: boolean) => {
        if (peersRef.current[targetId]) return; // already exists, skip
        const ch = channelRef.current;
        const stream = screenStreamRef.current || localStreamRef.current;
        if (!stream || !ch) return;

        console.log(`Signaling: createPeer -> ${targetId} initiator=${initiator}`);
        const peer = new Peer({
            initiator,
            trickle: false, // MUST be false for Supabase, 10 msgs/sec rate limit drops candidates if true!
            stream,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun.cloudflare.com:3478' },
                    { urls: 'stun:stun.relay.metered.ca:80' },
                ]
            }
        });

        peer.on('signal', (data: Peer.SignalData) => {
            ch.send({
                type: 'broadcast',
                event: 'signal',
                payload: { from: userName, to: targetId, signal: data },
            });
        });

        peer.on('stream', (incomingStream: MediaStream) => {
            console.log(`Signaling: Received stream from ${targetId}`);
            setRemoteStreams(prev => ({ ...prev, [targetId]: incomingStream }));
        });

        peer.on('close', () => cleanupPeer(targetId));
        peer.on('error', (err) => {
            console.error(`Peer ${targetId} error:`, err);
            cleanupPeer(targetId);
        });

        peersRef.current[targetId] = peer;
    }, [userName]);

    const cleanupPeer = useCallback((targetId: string) => {
        if (peersRef.current[targetId]) {
            try { peersRef.current[targetId].destroy(); } catch (_) { }
            delete peersRef.current[targetId];
        }
        setRemoteStreams(prev => {
            const next = { ...prev };
            delete next[targetId];
            return next;
        });
    }, []);

    // ─── Effect 1: Register signal listener (strictly ATTACH ONCE per channel) ──
    const attachedChannelTopic = useRef<string | null>(null);
    useEffect(() => {
        if (!channel || !userName || !localStream) return;
        if (attachedChannelTopic.current === channel.topic) return; // Prevent duplicate listeners
        attachedChannelTopic.current = channel.topic;

        const handleSignal = ({ payload }: any) => {
            const { from, to, signal } = payload;
            if (to !== userName) return;

            if (peersRef.current[from]) {
                peersRef.current[from].signal(signal);
            } else {
                // Answering side: create non-initiator then immediately signal it
                createPeer(from, false);
                // Give the peer a tick to be stored before signalling
                setTimeout(() => {
                    peersRef.current[from]?.signal(signal);
                }, 0);
            }
        };

        channel.on('broadcast', { event: 'signal' }, handleSignal);
        // Do NOT destroy peers here; Effect 2 handles participant departures naturally.

    }, [channel, userName, localStream, createPeer]);

    // ─── Effect 2: Connect to newly arrived participants ───────────────────────
    useEffect(() => {
        if (!channel || !userName || !localStream) return;

        participants.forEach(p => {
            if (p.id !== userName && !peersRef.current[p.id] && p.id > userName) {
                createPeer(p.id, true);
            }
        });

        // Clean up peers for participants who have left
        const currentIds = new Set(participants.map(p => p.id));
        Object.keys(peersRef.current).forEach(peerId => {
            if (!currentIds.has(peerId)) {
                cleanupPeer(peerId);
            }
        });
        // Re-run only when participant list changes — does NOT destroy existing peers
    }, [participants, channel, userName, localStream, createPeer, cleanupPeer]);

    // ─── Effect 3: Screen share track replacement ──────────────────────────────
    useEffect(() => {
        const screenTrack = screenStream?.getVideoTracks()[0];
        const cameraTrack = localStream?.getVideoTracks()[0];

        Object.entries(peersRef.current).forEach(([peerId, peer]) => {
            if (!peer.connected) return;
            const peerStream = (peer as any)._remoteStreams?.[0] ?? peer.streams?.[0];
            if (!peerStream) return;

            const currentTrack = peerStream.getVideoTracks()[0];
            const targetTrack = screenTrack || cameraTrack;

            if (targetTrack && currentTrack && currentTrack !== targetTrack) {
                console.log(`Signaling: Replacing track for peer ${peerId}`);
                try {
                    peer.replaceTrack(currentTrack, targetTrack, peerStream);
                } catch (err) {
                    console.error(`Signaling: Track replace failed for ${peerId}`, err);
                }
            }
        });
    }, [screenStream, localStream]);

    return { remoteStreams, localStream, mediaError, retryMedia };
}
