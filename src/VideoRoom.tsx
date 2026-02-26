import React, { useState, useEffect, useRef } from 'react';
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
    const [selectedCamera, setSelectedCamera] = useState("");
    const [isLocked, setIsLocked] = useState(!!passcode);
    const [inputPasscode, setInputPasscode] = useState("");
    const [passcodeError, setPasscodeError] = useState(false);
    const [blurBackground, setBlurBackground] = useState(false);
    const [sidebarVisibleOnMobile, setSidebarVisibleOnMobile] = useState(false);

    const recorderRef = useRef<MeetingRecorder | null>(null);
    const screenVideoRef = useRef<HTMLVideoElement | null>(null);

    const [myId] = useState(userName);
    const { participants: liveParticipants, channel, identity } = usePresence(roomName, myId);
    const { remoteStreams, localStream } = useSignaling(channel, identity, liveParticipants, screenStream);

    const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);

    const { transcript, summary } = useAI(localStream);

    const toggleScreenShare = async () => {
        if (!screenStream) {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                setScreenStream(stream);
                if (screenVideoRef.current) {
                    screenVideoRef.current.srcObject = stream;
                }
                stream.getVideoTracks()[0].onended = () => {
                    setScreenStream(null);
                };
            } catch (err) {
                console.error("Error sharing screen:", err);
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

            <header className="h-14 md:h-16 px-4 md:px-6 flex justify-between items-center border-b border-white/5 bg-slate-900/50 backdrop-blur-md z-10">
                <div className="flex items-center space-x-2 md:space-x-4">
                    <span className="hidden sm:inline text-white font-black text-sm tracking-tight uppercase italic mr-4">{roomName}</span>
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-black text-lg tracking-tight hidden md:inline">InstantMeet</span>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    <button onClick={() => setActiveView('video')} className={`px-4 py-2 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest ${activeView === 'video' ? 'bg-indigo-600 border-transparent text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 border-white/5 text-slate-400'}`}>Video</button>
                    <button onClick={() => setActiveView('whiteboard')} className={`px-4 py-2 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest ${activeView === 'whiteboard' ? 'bg-indigo-600 border-transparent text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 border-white/5 text-slate-400'}`}>Board</button>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden relative">
                <div className="flex-1 flex flex-col relative overflow-hidden">
                    <AnimatePresence mode="wait">
                        {activeView === 'video' ? (
                            <motion.div key="video" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`grid gap-2 md:gap-6 h-full p-2 md:p-6 ${Object.keys(remoteStreams).length === 0 ? 'grid-cols-1' : Object.keys(remoteStreams).length === 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2 lg:grid-cols-3'}`}>
                                {screenStream ? (
                                    <div className="col-span-full bg-slate-900 rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl relative group">
                                        <video autoPlay playsInline className="w-full h-full object-contain" ref={(el) => { if (el) el.srcObject = screenStream; }} />
                                    </div>
                                ) : (
                                    Object.entries(remoteStreams).map(([peerId, stream]) => (
                                        <motion.div key={peerId} className="bg-slate-900 rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl relative group">
                                            <video autoPlay playsInline className="w-full h-full object-cover" ref={(el) => { if (el) { el.srcObject = stream; el.onloadedmetadata = () => el.play().catch(console.error); } }} />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                                            <p className="z-20 absolute bottom-4 left-4 font-medium flex items-center text-sm">
                                                <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 shadow-lg shadow-emerald-500/50" />
                                                {liveParticipants.find(part => part.id === peerId)?.name || peerId.split(':')[0]}
                                            </p>
                                        </motion.div>
                                    ))
                                )}
                                <motion.div className={`relative bg-slate-950 rounded-[2rem] border-2 border-indigo-600/30 overflow-hidden shadow-2xl group ${Object.keys(remoteStreams).length === 0 ? 'col-span-full max-w-4xl mx-auto w-full aspect-video' : ''}`}>
                                    <video ref={(el) => { if (el) { el.srcObject = localStream; el.onloadedmetadata = () => el.play().catch(console.error); } }} autoPlay muted playsInline className={`w-full h-full object-cover mirror transition-all duration-700 ${blurBackground ? 'blur-2xl scale-110 opacity-60' : ''}`} />
                                    {isVideoOff && <div className="absolute inset-0 z-30 bg-slate-950 flex flex-col items-center justify-center space-y-6"><VideoOff className="w-10 h-10 text-indigo-500" /></div>}
                                    <div className="absolute bottom-4 right-4 z-20 flex space-x-2"><div className={`p-2 rounded-lg bg-slate-950/80 backdrop-blur-md border ${isMuted ? 'border-red-500/50 text-red-500' : 'border-indigo-500/50 text-indigo-500'}`}>{isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}</div></div>
                                </motion.div>
                            </motion.div>
                        ) : (
                            <motion.div key="whiteboard" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full h-full p-6">
                                <Whiteboard />
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div className="absolute bottom-0 left-0 right-0 h-[600px] pointer-events-none z-40 overflow-hidden">
                        {reactions.map(r => (
                            <motion.div key={r.id} initial={{ y: 600, x: `${r.x}%`, opacity: 0, scale: 0.5 }} animate={{ y: -100, opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1.5, 1] }} transition={{ duration: 4 }} className="absolute text-5xl">{r.emoji}</motion.div>
                        ))}
                    </div>
                </div>

                <AnimatePresence>
                    {showAI && (
                        <motion.aside initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }} className={`fixed inset-y-0 right-0 w-full sm:w-80 md:w-96 md:relative border-l border-white/5 bg-[#020617]/95 md:bg-slate-900/80 backdrop-blur-2xl flex flex-col z-[100] md:z-auto transition-all ${sidebarVisibleOnMobile || !sidebarVisibleOnMobile && 'hidden md:flex'}`}>
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

            <footer className="h-20 md:h-24 px-4 md:px-10 flex justify-between items-center border-t border-white/5 bg-slate-950/80 backdrop-blur-2xl z-20 pb-safe">
                <div className="flex-1 hidden md:flex items-center space-x-4">
                    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/5 text-slate-400">
                        {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-indigo-400" />}
                    </button>
                    <div className="flex flex-col"><p className="text-[10px] text-slate-500 font-bold uppercase">Duration</p><p className="font-mono text-xl text-purple-400">00:42:15</p></div>
                </div>
                <div className="flex items-center justify-center space-x-2 md:space-x-4 flex-1 md:flex-none">
                    <button onClick={() => setIsMuted(!isMuted)} className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center ${isMuted ? 'bg-red-600' : 'bg-white/5'}`}>{isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}</button>
                    <button onClick={() => setIsVideoOff(!isVideoOff)} className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center ${isVideoOff ? 'bg-red-600' : 'bg-white/5'}`}>{isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}</button>
                    <button onClick={toggleScreenShare} className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center ${screenStream ? 'bg-purple-600' : 'bg-white/5'}`}><ScreenShare className="w-5 h-5" /></button>
                    <button onClick={toggleRecording} className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center ${isRecording ? 'bg-red-600' : 'bg-white/5'}`}><Radio className="w-5 h-5" /></button>
                    <button onClick={() => { setHandRaised(!handRaised); if (channel) channel.send({ type: 'broadcast', event: 'handRaised', payload: { userId: myId, userName: myId, raised: !handRaised } }); }} className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center ${handRaised ? 'bg-yellow-500' : 'bg-white/5'}`}><Hand className="w-5 h-5" /></button>
                    <button onClick={() => { if (!showAI) setShowAI(true); setSidebarTab('chat'); }} className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center bg-white/5"><MessageSquare className="w-5 h-5" /></button>
                    <button onClick={() => setShowAI(!showAI)} className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center ${showAI ? 'bg-indigo-600' : 'bg-white/5'}`}><Sparkles className="w-5 h-5" /></button>
                    <button onClick={() => onExit(summary, transcript.map(t => t.text).join(" "))} className="px-4 py-2 bg-red-600 rounded-xl text-[10px] font-black uppercase flex items-center"><LogOut className="w-4 h-4 mr-2" /> End</button>
                    <button onClick={() => setSidebarVisibleOnMobile(!sidebarVisibleOnMobile)} className={`md:hidden w-10 h-10 rounded-xl flex items-center justify-center ${sidebarVisibleOnMobile ? 'bg-indigo-600' : 'bg-white/5'}`}><Users className="w-5 h-5" /></button>
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
        </div>
    );
};

export default VideoRoom;
