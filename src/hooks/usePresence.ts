import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Participant {
    id: string;
    name: string;
    status: 'connected' | 'away' | 'disconnected';
    isHost?: boolean;
}

export function usePresence(roomName: string, userName: string) {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [channel, setChannel] = useState<RealtimeChannel | null>(null);
    const [sessionId] = useState(() => Math.random().toString(36).substring(7));
    const [identity, setIdentity] = useState(`${userName}:${sessionId}`);

    useEffect(() => {
        if (!roomName || !userName) return;
        const currentIdentity = `${userName}:${sessionId}`;
        setIdentity(currentIdentity);
        console.log(`[Presence] Initializing channel for: ${roomName} as ${currentIdentity}`);

        const roomChannel = supabase.channel(`room:${roomName}`, {
            config: {
                presence: {
                    key: currentIdentity,
                },
            },
        });

        roomChannel
            .on('presence', { event: 'sync' }, () => {
                const state = roomChannel.presenceState();
                console.log('[Presence] Sync state received:', state);

                const formattedParticipants: Participant[] = Object.keys(state).map((key) => {
                    const presence = state[key][0] as any;
                    const [name] = key.split(':');
                    return {
                        id: key,
                        name: name || key,
                        status: 'connected',
                        isHost: presence?.isHost || false,
                    };
                });

                setParticipants(formattedParticipants);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                console.log('[Presence] Join event:', key, newPresences);
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                console.log('[Presence] Leave event:', key, leftPresences);
            })
            .subscribe(async (status, err) => {
                console.log('[Presence] Subscription status change:', status);
                if (err) {
                    console.error('[Presence] Subscription error object:', err);
                    console.error('[Presence] Error message:', err.message);
                }

                if (status === 'SUBSCRIBED') {
                    // Check if anyone else is already here to determine host status
                    const currentState = roomChannel.presenceState();
                    const isFirst = Object.keys(currentState).length === 0;

                    console.log('[Presence] Attempting to track. First in room?', isFirst);

                    const trackStatus = await roomChannel.track({
                        online_at: new Date().toISOString(),
                        isHost: isFirst,
                    });
                    console.log('[Presence] Track result:', trackStatus);
                }
            });

        setChannel(roomChannel);

        return () => {
            console.log('[Presence] Cleaning up channel');
            roomChannel.unsubscribe();
        };
    }, [roomName, userName, sessionId]);

    return { participants, channel, identity };
}
