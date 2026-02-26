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

    useEffect(() => {
        if (!roomName || !userName) return;
        console.log(`[Presence] Initializing channel for: ${roomName} as ${userName}`);

        const roomChannel = supabase.channel(`room:${roomName}`, {
            config: {
                presence: {
                    key: userName,
                },
            },
        });

        roomChannel
            .on('presence', { event: 'sync' }, () => {
                const state = roomChannel.presenceState();
                console.log('[Presence] Sync state received:', state);

                const formattedParticipants: Participant[] = Object.keys(state).map((key) => {
                    const presence = state[key][0] as any;
                    return {
                        id: key,
                        name: key,
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
    }, [roomName, userName]);

    return { participants, channel };
}
