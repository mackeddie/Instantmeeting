import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Mic, MicOff, Video, VideoOff, ScreenShare,
    Hand, MessageSquare, Sparkles, X,
    Layout, LogOut, Users,
    Download, Radio, Shield,
    Sun, Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Whiteboard from './Whiteboard';
import { MeetingRecorder } from './utils/MeetingRecorder';
import { usePresence } from './hooks/usePresence';
import { useSignaling } from './hooks/useSignaling';
import { useAI } from './hooks/useAI';

/** Stable video ref helper – avoids resetting srcObject on every render */
function useVideoRef(stream: MediaStream | null) {
    const ref = useRef<HTMLVideoElement | null>(null);
    const setRef = useCallback((el: HTMLVideoElement | null) => {
        ref.current = el;
        if (el && stream) {
            el.srcObject = stream;
            el.play().catch(() => { });
        }
    }, [stream]);
    // Also update srcObject if the stream object changes after mount
    useEffect(() => {
        if (ref.current && stream) {
            ref.current.srcObject = stream;
            ref.current.play().catch(() => { });
        }
    }, [stream]);
    return setRef;
}

interface VideoRoomProps {
    roomName: string;
    userName: string;
    passcode?: string;
    onExit: (summary?: string, transcript?: string) => void;
    theme: 'dark' | 'light';
    setTheme: (theme: 'dark' | 'light') => void;
}

const VideoRoom: React.FC<VideoRoomProps> = ({ roomName, userName, passcode, onExit, theme, setTheme }) => {
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [showAI, setShowAI] = useState(true);
    const [activeView, setActiveView] = useState<'video' | 'whiteboard'>('video');
    const [sidebarTab, setSidebarTab] = useState<'ai' | 'participants' | 'chat'>('ai');
    const [isRecording, setIsRecording] = useState(false);
    const isRecordingRef = useRef(false);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const [handRaised, setHandRaised] = useState(false);
    const [reactions, setReactions] = useState<{ id: number, emoji: string, x: number }[]>([]);
    const [toast, setToast] = useState<string | null>(null);
    const [messages, setMessages] = useState<{ user: string, text: string, time: string }[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [showSettings, setShowSettings] = useState(false);
    const [showInvite, setShowInvite] = useState(false);
    const [selectedCamera, setSelectedCamera] = useState("");
    const [isLocked, setIsLocked] = useState(!!passcode);
    const [inputPasscode, setInputPasscode] = useState("");
    const [passcodeError, setPasscodeError] = useState(false);
    const [blurBackground, setBlurBackground] = useState(false);
    const [sidebarVisibleOnMobile, setSidebarVisibleOnMobile] = useState(false);
    const [meetingSeconds, setMeetingSeconds] = useState(0);

    // Build shareable invite link
    const inviteLink = (() => {
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('room', roomName);
            return url.toString();
        } catch { return window.location.href; }
    })();

    const copyInviteLink = () => {
        navigator.clipboard.writeText(inviteLink).then(() => {
            setToast('Invite link copied!');
            setTimeout(() => setToast(null), 3000);
        });
    };

    useEffect(() => {
        const interval = setInterval(() => setMeetingSeconds(s => s + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    const formatDuration = (secs: number) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const recorderRef = useRef<MeetingRecorder | null>(null);

    const [myId] = useState(userName);
    const { participants: liveParticipants, channel, identity } = usePresence(roomName, myId);
    const { remoteStreams, localStream } = useSignaling(channel, identity, liveParticipants, screenStream);

    const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);

    const { transcript, summary } = useAI(localStream);

    // Stable video refs — no more srcObject reset on every re-render (camera shake fix)
    const localVideoRef = useVideoRef(localStream);
    const screenVideoRef = useVideoRef(screenStream);

    // Toggle mic track enabled state (camera LED turns off properly)
    const toggleMute = () => {
        localStream?.getAudioTracks().forEach(t => { t.enabled = isMuted; }); // flip: if muted, re-enable
        setIsMuted(m => !m);
    };
    const toggleVideo = () => {
        localStream?.getVideoTracks().forEach(t => { t.enabled = isVideoOff; }); // flip: if off, re-enable
        setIsVideoOff(v => !v);
    };
    const toggleScreenShare = async () => {
        if (!screenStream) {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                setScreenStream(stream); // useVideoRef will auto-assign srcObject
                stream.getVideoTracks()[0].onended = () => {
                    setScreenStream(null);
                };
            } catch (err) {
                console.error('Error sharing screen:', err);
            }
        } else {
            screenStream.getTracks().forEach(track => track.stop());
            setScreenStream(null);
        }
    };

    const toggleRecording = async () => {
        if (!isRecording) {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: { frameRate: 30 },
                    audio: true
                });
                const recorder = new MeetingRecorder(stream);
                recorderRef.current = recorder;
                recorder.start();
                setIsRecording(true);
                isRecordingRef.current = true;
                stream.getVideoTracks()[0].onended = () => {
                    stopAndDownloadRecording();
                };
            } catch (err) {
                console.error("Error starting recording:", err);
            }
        } else {
            stopAndDownloadRecording();
        }
    };

    const stopAndDownloadRecording = () => {
        if (recorderRef.current && isRecordingRef.current) {
            recorderRef.current.stop();
            setIsRecording(false);
            isRecordingRef.current = false;
            setToast("Recording saved to downloads");
            setTimeout(() => setToast(null), 3000);
        }
    };

    useEffect(() => {
        if (!channel) return;
        channel.on('broadcast', { event: 'reaction' }, ({ payload }) => {
            if (payload.userId !== myId) {
                const id = Date.now();
                setReactions(prev => [...prev, { id, emoji: payload.emoji, x: Math.random() * 80 + 10 }]);
                setTimeout(() => {
                    setReactions(prev => prev.filter(r => r.id !== id));
                }, 4000);
            }
        });
        channel.on('broadcast', { event: 'handRaised' }, ({ payload }) => {
            if (payload.userId !== myId) {
                setToast(`${payload.userName} raised their hand!`);
                setTimeout(() => setToast(null), 3000);
            }
        });
        channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
            if (payload.user !== userName) {
                setMessages(prev => [...prev, payload]);
            }
        });
    }, [channel, myId, userName]);

    useEffect(() => {
        const getDevices = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                setAvailableCameras(devices.filter(d => d.kind === 'videoinput'));
            } catch (err) {
                console.error("Error getting devices:", err);
            }
        };
        getDevices();
    }, []);

    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() && channel) {
            const msg = {
                user: userName,
                text: newMessage,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            channel.send({
                type: 'broadcast',
                event: 'chat',
                payload: msg
            });
            setMessages(prev => [...prev, { ...msg, user: "You" }]);
            setNewMessage("");
        }
    };

    const handleUnlock = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputPasscode === passcode) {
            setIsLocked(false);
            setPasscodeError(false);
        } else {
            setPasscodeError(true);
            setTimeout(() => setPasscodeError(false), 3000);
        }
    };

    if (isLocked) {
        return (
            <div className="h-screen mesh-gradient flex items-center justify-center p-6 bg-slate-950">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-premium p-12 w-full max-w-md rounded-[2.5rem] text-center border-indigo-500/20"
                >
                    <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-500/40">
                        <Shield className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-2 tracking-tighter uppercase">Secured Room</h2>
                    <p className="text-slate-500 font-medium mb-10 text-sm">Please verify identity to enter <span className="text-indigo-400 font-bold">{roomName}</span></p>
                    <form onSubmit={handleUnlock} className="space-y-6">
                        <div className="relative group">
                            <input
                                autoFocus
                                type="password"
                                placeholder="Enter Room Passcode"
                                className={`w-full h-16 bg-slate-900 border ${passcodeError ? 'border-red-500' : 'border-white/10'} rounded-2xl px-6 text-center text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all text-xl tracking-[0.5em] placeholder:tracking-normal placeholder:text-slate-700`}
                                value={inputPasscode}
                                onChange={(e) => setInputPasscode(e.target.value)}
                            />
                            {passcodeError && (
                                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="absolute -bottom-6 left-0 right-0">
                                    <p className="text-red-400 text-[9px] font-black uppercase tracking-widest">Invalid Passcode. Authentication Failed.</p>
                                </motion.div>
                            )}
                        </div>
                        <div className="flex flex-col space-y-4 pt-4">
                            <button type="submit" className="h-16 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black shadow-2xl shadow-indigo-500/30 transition-all text-white text-xs uppercase tracking-[0.2em]">Unlock Access</button>
                            <button type="button" onClick={() => onExit(summary, transcript.map(t => t.text).join(" "))} className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-slate-300 transition-colors">Return to Lobby</button>
                        </div>
                    </form>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="h-[100dvh] bg-slate-950 flex flex-col overflow-hidden text-white font-sans transition-all duration-300">
            <AnimatePresence>
                {toast && (
                    <motion.div initial={{ opacity: 0, y: -20, x: '-50%' }} animate={{ opacity: 1, y: 20, x: '-50%' }} exit={{ opacity: 0, y: -20, x: '-50%' }} className="fixed top-20 left-1/2 z-[100] px-6 py-3 bg-indigo-600 text-white rounded-full font-bold shadow-2xl text-sm">
                        {toast}
                    </motion.div>
                )}
            </AnimatePresence>

            <header className="shrink-0 h-14 md:h-16 px-4 md:px-6 flex justify-between items-center border-b border-white/5 bg-slate-900/50 backdrop-blur-md z-10">
                <div className="flex items-center space-x-2 md:space-x-4">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-black text-base tracking-tight hidden sm:inline">InstantMeet</span>
                    </div>
                    <div className="h-5 w-px bg-white/10 hidden sm:block" />
                    <span className="text-indigo-400 font-bold text-sm truncate max-w-[120px] md:max-w-xs">{roomName}</span>
                </div>
                <div className="flex items-center gap-2 md:gap-3">
                    {/* Invite / Share link button */}
                    <button
                        onClick={() => setShowInvite(true)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 transition-all text-[10px] font-black uppercase tracking-widest"
                    >
                        <Users className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Invite</span>
                    </button>
                    <button onClick={() => setActiveView('video')} className={`px-3 py-2 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest ${activeView === 'video' ? 'bg-indigo-600 border-transparent text-white' : 'bg-white/5 border-white/5 text-slate-400'}`}>Video</button>
                    <button onClick={() => setActiveView('whiteboard')} className={`px-3 py-2 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest ${activeView === 'whiteboard' ? 'bg-indigo-600 border-transparent text-white' : 'bg-white/5 border-white/5 text-slate-400'}`}>Board</button>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden relative min-h-0">
                <div className="flex-1 flex flex-col relative overflow-hidden min-h-0">
                    <AnimatePresence mode="wait">
                        {activeView === 'video' ? (
                            <motion.div
                                key="video"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                className="h-full w-full"
                            >
                                {/* ── SOLO / WAITING STATE ────────────────────────────── */}
                                {Object.keys(remoteStreams).length === 0 && !screenStream ? (
                                    <div className="h-full flex flex-col md:flex-row gap-3 p-3 md:p-4">
                                        {/* Self video — left column */}
                                        <div className="relative flex-1 bg-slate-900 rounded-2xl border border-white/5 overflow-hidden shadow-2xl min-h-0">
                                            <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover mirror ${blurBackground ? 'blur-2xl scale-110 opacity-60' : ''}`} />
                                            {isVideoOff && <div className="absolute inset-0 bg-slate-950 flex items-center justify-center z-10"><VideoOff className="w-10 h-10 text-indigo-400" /></div>}
                                            <div className="absolute bottom-3 left-3 flex items-center gap-2 z-20">
                                                <span className="px-2 py-1 bg-slate-950/80 rounded-lg text-[10px] font-bold text-white">{userName} (You)</span>
                                                {isMuted && <span className="px-2 py-1 bg-red-600/80 rounded-lg text-[10px] font-bold text-white">Muted</span>}
                                            </div>
                                        </div>
                                        {/* Waiting panel — right column */}
                                        <div className="w-full md:w-72 lg:w-80 flex flex-col gap-3 shrink-0">
                                            {/* Invite card */}
                                            <div className="flex-1 bg-slate-900/60 border border-white/5 rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-4">
                                                <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                                                    <Users className="w-7 h-7 text-indigo-400" />
                                                </div>
                                                <div>
                                                    <p className="text-white font-black text-base">Waiting for others</p>
                                                    <p className="text-slate-500 text-xs mt-1">Share the link below to invite participants</p>
                                                </div>
                                                <div className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 flex items-center gap-2">
                                                    <span className="flex-1 text-indigo-400 text-[10px] font-mono truncate">{inviteLink}</span>
                                                    <button onClick={copyInviteLink} className="shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[10px] font-black text-white transition-all">Copy</button>
                                                </div>
                                            </div>
                                            {/* Participants list */}
                                            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-3">In Room ({liveParticipants.length})</p>
                                                <div className="space-y-2">
                                                    {liveParticipants.map(p => (
                                                        <div key={p.id} className="flex items-center gap-2">
                                                            <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                                                            <span className="text-xs text-white font-medium">{p.name || p.id.split(':')[0]}</span>
                                                            {p.isHost && <span className="text-[9px] text-indigo-400 font-black">HOST</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* ── MULTI-USER GRID ──────────────────────────────── */
                                    <div className={`grid gap-2 md:gap-3 h-full p-2 md:p-3 auto-rows-fr ${Object.keys(remoteStreams).length === 1
                                        ? 'grid-cols-1 sm:grid-cols-2'
                                        : Object.keys(remoteStreams).length <= 3
                                            ? 'grid-cols-2'
                                            : 'grid-cols-2 lg:grid-cols-3'
                                        }`}>
                                        {/* Screen share tile */}
                                        {screenStream && (
                                            <div className="col-span-full bg-slate-900 rounded-2xl border border-white/5 overflow-hidden shadow-2xl" style={{ maxHeight: '55%' }}>
                                                <video ref={screenVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
                                            </div>
                                        )}
                                        {/* Remote tiles */}
                                        {Object.entries(remoteStreams).map(([peerId, stream]) => (
                                            <RemoteTile
                                                key={peerId}
                                                peerId={peerId}
                                                stream={stream}
                                                label={liveParticipants.find(p => p.id === peerId)?.name || peerId.split(':')[0]}
                                            />
                                        ))}
                                        {/* Self tile — smaller corner tile */}
                                        <motion.div className="relative bg-slate-950 rounded-2xl border-2 border-indigo-600/30 overflow-hidden shadow-2xl min-h-0">
                                            <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover mirror ${blurBackground ? 'blur-2xl scale-110 opacity-60' : ''}`} />
                                            {isVideoOff && <div className="absolute inset-0 z-30 bg-slate-950 flex items-center justify-center"><VideoOff className="w-8 h-8 text-indigo-500" /></div>}
                                            <div className="absolute bottom-2 left-2 right-2 z-20 flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-white/70">You</span>
                                                <div className={`p-1.5 rounded-lg bg-slate-950/80 border ${isMuted ? 'border-red-500/50 text-red-500' : 'border-indigo-500/50 text-indigo-500'}`}>
                                                    {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                                                </div>
                                            </div>
                                        </motion.div>
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div key="whiteboard" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full h-full p-3 md:p-6">
                                <Whiteboard />
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div className="absolute bottom-0 left-0 right-0 h-[400px] pointer-events-none z-40 overflow-hidden">
                        {reactions.map(r => (
                            <motion.div key={r.id} initial={{ y: 400, x: `${r.x}%`, opacity: 0, scale: 0.5 }} animate={{ y: -100, opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1.5, 1] }} transition={{ duration: 4 }} className="absolute text-4xl md:text-5xl">{r.emoji}</motion.div>
                        ))}
                    </div>
                </div>

                <AnimatePresence>
                    {showAI && (
                        <motion.aside initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }} className={`fixed inset-y-0 right-0 w-full sm:w-80 md:w-96 md:relative border-l border-white/5 bg-[#020617]/95 md:bg-slate-900/80 backdrop-blur-2xl flex flex-col z-[100] md:z-auto transition-all ${sidebarVisibleOnMobile ? 'flex' : 'hidden md:flex'}`}>
                            <div className="h-16 flex items-center justify-between px-6 border-b border-white/5">
                                <div className="flex space-x-4">
                                    {(['ai', 'participants', 'chat'] as const).map(tab => (
                                        <button key={tab} onClick={() => setSidebarTab(tab)} className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${sidebarTab === tab ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500'}`}>{tab}</button>
                                    ))}
                                </div>
                                <button onClick={() => { setShowAI(false); setSidebarVisibleOnMobile(false); }} className="p-2 text-slate-500"><X className="w-4 h-4" /></button>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                {sidebarTab === 'ai' ? (
                                    <div className="p-6 h-full overflow-y-auto custom-scrollbar space-y-6">
                                        {summary && <div className="p-4 bg-indigo-600/10 rounded-2xl border border-indigo-500/20 text-xs italic text-slate-300">{summary}</div>}
                                        <div className="space-y-3">
                                            {transcript.slice(-5).map((t, i) => (
                                                <div key={i} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-xs text-slate-400">{t.text}</div>
                                            ))}
                                        </div>
                                    </div>
                                ) : sidebarTab === 'participants' ? (
                                    <div className="p-6 space-y-3 overflow-y-auto h-full custom-scrollbar">
                                        {liveParticipants.map(p => (
                                            <div key={p.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex justify-between items-center">
                                                <span className="text-xs font-bold text-white">{p.name || p.id.split(':')[0]}</span>
                                                <span className="text-[8px] font-black text-emerald-500 uppercase">Live</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-6 flex flex-col h-full overflow-hidden">
                                        <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                                            {messages.map((msg, i) => (
                                                <div key={i} className={`flex flex-col ${msg.user === "You" ? 'items-end' : 'items-start'}`}>
                                                    <div className={`p-3 rounded-2xl text-xs ${msg.user === "You" ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-300'}`}>{msg.text}</div>
                                                </div>
                                            ))}
                                        </div>
                                        <form onSubmit={sendMessage} className="mt-4 flex space-x-2">
                                            <input type="text" placeholder="Type..." className="flex-1 h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
                                            <button className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center"><Download className="w-4 h-4 text-white rotate-[270deg]" /></button>
                                        </form>
                                    </div>
                                )}
                            </div>
                        </motion.aside>
                    )}
                </AnimatePresence>
            </main>

            <footer className="shrink-0 px-3 md:px-10 flex justify-between items-center border-t border-white/5 bg-slate-950/80 backdrop-blur-2xl z-20" style={{ minHeight: '64px', paddingBottom: 'env(safe-area-inset-bottom, 8px)', paddingTop: '8px' }}>
                <div className="flex-1 hidden md:flex items-center space-x-4">
                    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/5 text-slate-400">
                        {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-indigo-400" />}
                    </button>
                    <div className="flex flex-col">
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Duration</p>
                        <p className="font-mono text-lg text-purple-400">{formatDuration(meetingSeconds)}</p>
                    </div>
                </div>
                <div className="flex items-center justify-center gap-1.5 md:gap-3 flex-1 md:flex-none flex-wrap">
                    <button id="btn-mute" onClick={toggleMute} className={`w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center shrink-0 ${isMuted ? 'bg-red-600' : 'bg-white/5'}`}>{isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}</button>
                    <button id="btn-video" onClick={toggleVideo} className={`w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center shrink-0 ${isVideoOff ? 'bg-red-600' : 'bg-white/5'}`}>{isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}</button>
                    <button id="btn-screen" onClick={toggleScreenShare} className={`w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center shrink-0 ${screenStream ? 'bg-purple-600' : 'bg-white/5'}`}><ScreenShare className="w-4 h-4" /></button>
                    <button id="btn-record" onClick={toggleRecording} className={`w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center shrink-0 ${isRecording ? 'bg-red-600' : 'bg-white/5'}`}><Radio className="w-4 h-4" /></button>
                    <button id="btn-hand" onClick={() => { setHandRaised(!handRaised); if (channel) channel.send({ type: 'broadcast', event: 'handRaised', payload: { userId: myId, userName: myId, raised: !handRaised } }); }} className={`w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center shrink-0 ${handRaised ? 'bg-yellow-500' : 'bg-white/5'}`}><Hand className="w-4 h-4" /></button>
                    <button id="btn-invite" onClick={() => setShowInvite(true)} className="w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center shrink-0 bg-emerald-600/20 border border-emerald-500/20 text-emerald-400"><Users className="w-4 h-4" /></button>
                    <button id="btn-chat" onClick={() => { if (!showAI) setShowAI(true); setSidebarTab('chat'); setSidebarVisibleOnMobile(true); }} className="w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center bg-white/5 shrink-0"><MessageSquare className="w-4 h-4" /></button>
                    <button id="btn-end" onClick={() => onExit(summary, transcript.map(t => t.text).join(" "))} className="px-3 py-2 bg-red-600 rounded-xl text-[9px] md:text-[10px] font-black uppercase flex items-center shrink-0"><LogOut className="w-3.5 h-3.5 mr-1" /> End</button>
                    <button id="btn-sidebar-mobile" onClick={() => setSidebarVisibleOnMobile(!sidebarVisibleOnMobile)} className={`md:hidden w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${sidebarVisibleOnMobile ? 'bg-indigo-600' : 'bg-white/5'}`}><Sparkles className="w-4 h-4" /></button>
                </div>
                <div className="hidden lg:block">
                    <button onClick={() => setShowSettings(true)} className="p-3 bg-white/5 rounded-xl"><Layout className="w-5 h-5" /></button>
                </div>
            </footer>

            <AnimatePresence>
                {showSettings && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSettings(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-lg bg-slate-900 rounded-[2.5rem] border border-white/10 p-8 space-y-6">
                            <h3 className="text-xl font-black uppercase">Service Settings</h3>
                            <div className="space-y-4">
                                <section className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Camera</label>
                                    <select className="w-full bg-slate-800 rounded-xl p-3 text-xs" value={selectedCamera} onChange={(e) => setSelectedCamera(e.target.value)}>
                                        {availableCameras.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
                                    </select>
                                </section>
                                <button onClick={() => setBlurBackground(!blurBackground)} className={`w-full p-4 rounded-xl border flex justify-between items-center ${blurBackground ? 'border-indigo-600 bg-indigo-600/10' : 'border-white/5'}`}>
                                    <span className="text-xs font-bold uppercase">Background AI Blur</span>
                                    <div className={`w-10 h-5 rounded-full relative transition-all ${blurBackground ? 'bg-indigo-600' : 'bg-slate-700'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${blurBackground ? 'left-6' : 'left-1'}`} /></div>
                                </button>
                            </div>
                            <button onClick={() => setShowSettings(false)} className="w-full py-4 bg-white text-slate-950 rounded-xl font-black text-xs uppercase">Close</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Invite Modal Overlay */}
            <AnimatePresence>
                {showInvite && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowInvite(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-sm bg-slate-900 rounded-[2.5rem] border border-white/10 p-8 shadow-2xl flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-3xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center mb-6">
                                <Users className="w-8 h-8 text-emerald-500" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2">Invite Others</h3>
                            <p className="text-slate-400 text-sm mb-8 font-medium">Share this link with anyone you want to join the meeting.</p>

                            <div className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 flex items-center gap-3 mb-8">
                                <span className="flex-1 text-emerald-400 text-xs font-mono truncate text-left">{inviteLink}</span>
                            </div>

                            <div className="w-full flex gap-3">
                                <button onClick={() => setShowInvite(false)} className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all">Close</button>
                                <button onClick={() => { copyInviteLink(); setShowInvite(false); }} className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20">Copy Link</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

/** Stable remote video tile — uses its own useVideoRef so srcObject never flickers */
function RemoteTile({ peerId, stream, label }: { peerId: string; stream: MediaStream; label: string }) {
    const videoRef = useVideoRef(stream);
    return (
        <div className="relative bg-slate-900 rounded-2xl border border-white/5 overflow-hidden shadow-2xl min-h-0">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10 pointer-events-none" />
            <p className="z-20 absolute bottom-2 left-2 md:bottom-4 md:left-4 font-medium flex items-center text-xs md:text-sm">
                <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 shadow-lg shadow-emerald-500/50 shrink-0" />
                {label}
            </p>
        </div>
    );
}

export default VideoRoom;
