import React, { useState, useEffect, useRef } from 'react';
import {
    Mic, MicOff, Video, VideoOff, ScreenShare,
    Hand, MessageSquare, Sparkles, X,
    Layout, Settings, LogOut, Users,
    PencilRuler, Download,
    Radio, StopCircle, Share2, Shield
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
}

const VideoRoom: React.FC<VideoRoomProps> = ({ roomName, userName, passcode, onExit }) => {
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [showAI, setShowAI] = useState(true);
    const [activeView, setActiveView] = useState<'video' | 'whiteboard'>('video');
    const [sidebarTab, setSidebarTab] = useState<'ai' | 'participants' | 'chat'>('ai');
    const [isRecording, setIsRecording] = useState(false);
    const isRecordingRef = useRef(false); // Fix for stale closure
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const [handRaised, setHandRaised] = useState(false);
    const [reactions, setReactions] = useState<{ id: number, emoji: string, x: number }[]>([]);
    const [toast, setToast] = useState<string | null>(null);
    const [messages, setMessages] = useState<{ user: string, text: string, time: string }[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [showSettings, setShowSettings] = useState(false);
    const [videoQuality, setVideoQuality] = useState<'720p' | '1080p' | '4k'>('1080p');
    const [selectedCamera, setSelectedCamera] = useState("");
    const [selectedMic, setSelectedMic] = useState("");
    const [isLocked, setIsLocked] = useState(!!passcode);
    const [inputPasscode, setInputPasscode] = useState("");
    const [passcodeError, setPasscodeError] = useState(false);
    const [blurBackground, setBlurBackground] = useState(false);
    const [sidebarVisibleOnMobile, setSidebarVisibleOnMobile] = useState(false);

    const recorderRef = useRef<MeetingRecorder | null>(null);
    const screenVideoRef = useRef<HTMLVideoElement | null>(null);

    const [myId] = useState(userName);
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const { participants: liveParticipants, channel } = usePresence(roomName, myId);
    const { remoteStreams, localStream, mediaError, retryMedia } = useSignaling(channel, myId, liveParticipants, screenStream);

    const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
    const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);

    const { transcript, summary, aiStatus } = useAI(localStream);

    const toggleScreenShare = async () => {
        if (!screenStream) {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                setScreenStream(stream);

                // Set the stream to the video ref if available
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
                // Professional recording captures the entire meeting UI (screen stream)
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
                console.error("Failed to start recording:", err);
            }
        } else {
            stopAndDownloadRecording();
        }
    };

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    const stopAndDownloadRecording = async () => {
        if (recorderRef.current && isRecordingRef.current) {
            const blob = await recorderRef.current.stop();
            recorderRef.current.download(blob, `InstantMeet-${roomName}-${new Date().getTime()}.webm`);
            setIsRecording(false);
            isRecordingRef.current = false;
        }
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() && channel) {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const chatMsg = { user: myId, text: newMessage, time };

            // Add Locally
            setMessages(prev => [...prev, { ...chatMsg, user: "You" }]);

            // Broadcast
            channel.send({
                type: 'broadcast',
                event: 'chat',
                payload: chatMsg
            });

            setNewMessage("");
        }
    };

    const addReaction = (emoji: string) => {
        const id = Date.now();
        const x = Math.random() * 80 + 10;
        const reactionObj = { id, emoji, x };
        setReactions(prev => [...prev, reactionObj]);

        // Broadcast reaction
        if (channel) {
            channel.send({
                type: 'broadcast',
                event: 'reaction',
                payload: reactionObj
            });
        }

        setTimeout(() => {
            setReactions(prev => prev.filter(r => r.id !== id));
        }, 3000);
    };

    const handlePasscodeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputPasscode === passcode) {
            setIsLocked(false);
            setPasscodeError(false);
            setToast("Access Granted. Welcome.");
            setTimeout(() => setToast(null), 3000);
        } else {
            setPasscodeError(true);
            setInputPasscode("");
        }
    };

    // Enumerate devices
    React.useEffect(() => {
        const getDevices = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                setAvailableCameras(devices.filter(d => d.kind === 'videoinput'));
                setAvailableMics(devices.filter(d => d.kind === 'audioinput'));
            } catch (err) {
                console.error("Error enumerating devices:", err);
            }
        };

        if (showSettings) {
            getDevices();
        }
    }, [showSettings]);

    // Apply Video Quality Settings
    React.useEffect(() => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                const constraints = {
                    width: videoQuality === '4k' ? 3840 : videoQuality === '1080p' ? 1920 : 1280,
                    height: videoQuality === '4k' ? 2160 : videoQuality === '1080p' ? 1080 : 720
                };
                videoTrack.applyConstraints(constraints).catch(e => console.warn("Could not apply quality constraints:", e));
            }
        }
    }, [videoQuality, localStream]);

    // Handle Device Selection
    React.useEffect(() => {
        const switchDevice = async () => {
            if (selectedCamera && localStream) {
                try {
                    const newStream = await navigator.mediaDevices.getUserMedia({
                        video: { deviceId: { exact: selectedCamera } }
                    });
                    const newVideoTrack = newStream.getVideoTracks()[0];
                    const oldVideoTrack = localStream.getVideoTracks()[0];
                    if (oldVideoTrack) {
                        localStream.removeTrack(oldVideoTrack);
                        oldVideoTrack.stop();
                    }
                    localStream.addTrack(newVideoTrack);

                    // Note: In a real app, you'd also need to replace the track in all peer connections
                    // For now, we'll update the local UI.
                } catch (err) {
                    console.error("Error switching camera:", err);
                }
            }
        };
        switchDevice();
    }, [selectedCamera]);

    // Listen for broadcasted reactions and hand raises
    React.useEffect(() => {
        if (!channel) return;

        channel.on('broadcast', { event: 'reaction' }, ({ payload }) => {
            setReactions(prev => [...prev, payload]);
            setTimeout(() => {
                setReactions(prev => prev.filter(r => r.id !== payload.id));
            }, 3000);
        });

        channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
            setMessages(prev => [...prev, payload]);
        });

        channel.on('broadcast', { event: 'handRaised' }, ({ payload }) => {
            setToast(`${payload.userName} raised their hand!`);
            setTimeout(() => setToast(null), 3000);
        });

        return () => {
            // Unsubscribe or untrack if needed, but the main channel cleanup 
            // is handled in usePresence
        };
    }, [channel]);

    // Mock active speaker cycling (Disabled for live sync)
    /*
    React.useEffect(() => {
        const interval = setInterval(() => {
            const speakers: (number | 'self')[] = ['self', 1, 2, 3];
            setActiveSpeaker(speakers[Math.floor(Math.random() * speakers.length)]);
        }, 5000);
        return () => clearInterval(interval);
    }, []);
    */

    if (isLocked) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 mesh-gradient">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-premium p-12 w-full max-w-md rounded-[2.5rem] border border-white/5 relative overflow-hidden shadow-2xl"
                >
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600" />
                    <div className="flex flex-col items-center text-center space-y-8">
                        <div className="w-20 h-20 bg-indigo-600/10 rounded-[2rem] flex items-center justify-center border border-indigo-500/20 shadow-inner">
                            <Shield className="w-10 h-10 text-indigo-400" />
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-3xl font-black tracking-tight text-white uppercase italic leading-none">Security Required</h2>
                            <p className="text-slate-500 font-medium text-sm leading-relaxed">This session is protected by a passcode. <br />Please authenticate to join the discussion.</p>
                        </div>
                        <form onSubmit={handlePasscodeSubmit} className="w-full space-y-6">
                            <div className="relative">
                                <input
                                    autoFocus
                                    type="password"
                                    placeholder="••••••"
                                    className={`w-full h-16 bg-slate-900/50 border ${passcodeError ? 'border-red-500/50 focus:ring-red-500/20 text-red-400' : 'border-white/5 focus:ring-indigo-500/30 text-white'} rounded-2xl px-6 focus:outline-none focus:ring-2 transition-all text-center text-2xl placeholder:text-slate-800 tracking-[0.5em] font-black`}
                                    value={inputPasscode}
                                    onChange={(e) => setInputPasscode(e.target.value)}
                                />
                                {passcodeError && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="absolute -bottom-6 left-0 right-0"
                                    >
                                        <p className="text-red-400 text-[9px] font-black uppercase tracking-widest">Invalid Passcode. Authentication Failed.</p>
                                    </motion.div>
                                )}
                            </div>
                            <div className="flex flex-col space-y-4 pt-4">
                                <button
                                    type="submit"
                                    className="h-16 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black shadow-2xl shadow-indigo-500/30 transition-all text-white text-xs uppercase tracking-[0.2em]"
                                >
                                    Unlock Access
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onExit(summary, transcript.map(t => t.text).join(" "))}
                                    className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    Return to Lobby
                                </button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-slate-950 flex flex-col overflow-hidden text-white font-sans">
            {/* Toast Notification */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-2xl z-[100] font-medium border border-indigo-400/30 backdrop-blur-xl"
                    >
                        {toast}
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Header */}
            <header className="h-16 px-6 flex justify-between items-center border-b border-white/5 bg-slate-900/50 backdrop-blur-md z-10">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold tracking-tight text-lg">InstantMeet / {roomName}</span>
                        <button
                            onClick={() => {
                                const url = `${window.location.origin}${window.location.pathname}?room=${roomName}`;
                                navigator.clipboard.writeText(url);
                                setToast("Meeting link copied to clipboard!");
                            }}
                            className="ml-2 p-1.5 hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-white flex items-center group relative"
                            title="Copy Meeting Link"
                        >
                            <Share2 className="w-4 h-4" />
                            <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/5">Copy Link</span>
                        </button>
                    </div>
                    {isRecording && (
                        <div className="px-2 py-1 rounded bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center animate-pulse">
                            <div className="w-2 h-2 bg-red-500 rounded-full mr-2" />
                            RECORDING
                        </div>
                    )}
                </div>

                <div className="flex items-center space-x-2 bg-slate-950/40 rounded-2xl p-1 border border-white/5">
                    <button
                        onClick={() => setActiveView('video')}
                        className={`px-4 py-1.5 rounded-xl text-sm font-black tracking-wide uppercase transition-all flex items-center ${activeView === 'video' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Video className="w-4 h-4 mr-2" /> Video
                    </button>
                    <button
                        onClick={() => setActiveView('whiteboard')}
                        className={`px-4 py-1.5 rounded-xl text-sm font-black tracking-wide uppercase transition-all flex items-center ${activeView === 'whiteboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <PencilRuler className="w-4 h-4 mr-2" /> Whiteboard
                    </button>
                </div>

                <div className="flex items-center space-x-4">
                    <div className="flex items-center bg-indigo-500/5 rounded-full px-4 py-1.5 border border-indigo-500/10">
                        <Users className="w-4 h-4 text-indigo-400 mr-2" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{liveParticipants.length} Connected</span>
                    </div>
                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors"
                    >
                        <Settings className="w-5 h-5 text-slate-400 hover:text-white" />
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                <main className="flex-1 p-6 flex flex-col items-center justify-center relative bg-slate-900/40">
                    <AnimatePresence mode="wait">
                        {activeView === 'video' ? (
                            <motion.div
                                key="video"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full h-full max-w-6xl"
                            >
                                {/* Other Participants or Screen Share */}
                                {screenStream ? (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="relative glass-card overflow-hidden border-2 col-span-2 row-span-2 transition-all duration-500 border-white/10"
                                    >
                                        <video
                                            ref={screenVideoRef}
                                            autoPlay
                                            playsInline
                                            className="w-full h-full object-contain bg-black"
                                            onLoadedMetadata={(e) => (e.currentTarget.srcObject = screenStream)}
                                        />
                                        <div className="absolute bottom-4 left-4 glass px-3 py-1 rounded-lg flex items-center space-x-2">
                                            <ScreenShare className="w-4 h-4 text-purple-400" />
                                            <span className="text-sm font-medium">Your Screen</span>
                                        </div>
                                        {handRaised && (
                                            <div className="absolute top-4 left-4 bg-yellow-500 text-slate-950 p-2 rounded-xl shadow-lg z-20">
                                                <Hand className="w-5 h-5 fill-current" />
                                            </div>
                                        )}
                                        <button
                                            onClick={toggleScreenShare}
                                            className="absolute top-4 right-4 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white p-2 rounded-xl transition-all border border-red-500/30"
                                        >
                                            <StopCircle className="w-5 h-5" />
                                        </button>
                                    </motion.div>
                                ) : (mediaError && !localStream) ? (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="relative glass-card overflow-hidden border-2 col-span-2 row-span-2 flex flex-col items-center justify-center p-12 text-center bg-slate-900 shadow-2xl border-white/10"
                                    >
                                        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
                                            <VideoOff className="w-10 h-10 text-red-500" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-white mb-2">Media Access Blocked</h3>
                                        <p className="text-slate-400 mb-8 max-w-md leading-relaxed">
                                            {mediaError} You can still participate via chat and whiteboard.
                                        </p>
                                        <div className="flex space-x-4">
                                            <button
                                                onClick={() => retryMedia()}
                                                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                                            >
                                                Retry Access
                                            </button>
                                            <button
                                                onClick={() => setShowSettings(true)}
                                                className="px-8 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all border border-white/10 active:scale-95"
                                            >
                                                Open Settings
                                            </button>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div className="relative glass-card overflow-hidden group border-2 transition-all duration-500 aspect-video md:aspect-auto border-white/10">
                                        {!isVideoOff ? (
                                            <div className="w-full h-full bg-slate-900 flex items-center justify-center relative overflow-hidden">
                                                <video
                                                    autoPlay
                                                    muted
                                                    playsInline
                                                    className={`w-full h-full object-cover mirror transition-all duration-700 ${blurBackground ? 'blur-2xl scale-110 opacity-60' : ''}`}
                                                    ref={localVideoRef}
                                                />
                                                {blurBackground && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md">
                                                        <div className="text-center space-y-4">
                                                            <div className="w-24 h-24 bg-indigo-600/20 rounded-full flex items-center justify-center mx-auto border border-indigo-500/30">
                                                                <Shield className="w-10 h-10 text-indigo-400" />
                                                            </div>
                                                            <p className="text-indigo-400 font-black uppercase tracking-[0.3em] text-[10px]">Privacy Mode Active</p>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                                                <p className="z-20 absolute bottom-4 left-4 font-medium flex items-center">
                                                    You {isMuted && <MicOff className="w-3 h-3 ml-2 text-red-400" />}
                                                </p>
                                                {handRaised && (
                                                    <div className="absolute top-4 left-4 bg-yellow-500 text-slate-950 p-2 rounded-xl shadow-lg z-20">
                                                        <Hand className="w-5 h-5 fill-current" />
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="w-full h-full bg-slate-900/50 flex items-center justify-center relative">
                                                <div className="w-20 h-20 bg-indigo-500/10 rounded-[2rem] flex items-center justify-center border border-indigo-500/20">
                                                    <span className="text-2xl font-black text-indigo-400">{myId.slice(0, 2).toUpperCase()}</span>
                                                </div>
                                                {handRaised && (
                                                    <div className="absolute top-4 left-4 bg-yellow-500 text-slate-950 p-2 rounded-xl shadow-lg z-20">
                                                        <Hand className="w-5 h-5 fill-current" />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {/* Render Remote Participants */}
                                {Object.entries(remoteStreams).map(([peerId, stream]) => (
                                    <motion.div
                                        key={peerId}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className={`relative glass-card overflow-hidden group border-2 transition-all duration-500 aspect-video md:aspect-auto border-white/10`}
                                    >
                                        <video
                                            autoPlay
                                            playsInline
                                            className="w-full h-full object-cover"
                                            ref={(el) => { if (el) el.srcObject = stream; }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                                        <p className="z-20 absolute bottom-4 left-4 font-medium flex items-center text-sm">
                                            {peerId}
                                        </p>
                                    </motion.div>
                                ))}

                                {/* Placeholder for empty room */}
                                {liveParticipants.length <= 1 && (
                                    <div className="col-span-full flex flex-col items-center justify-center text-slate-500 opacity-50 space-y-4">
                                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                                            <Users className="w-10 h-10" />
                                        </div>
                                        <p className="text-sm font-medium">Waiting for others to join...</p>
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="whiteboard"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                className="w-full h-full max-w-7xl"
                            >
                                <Whiteboard />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Emoji Reactions Container */}
                    <div className="absolute bottom-32 left-12 right-12 h-64 pointer-events-none flex justify-center z-50">
                        <AnimatePresence>
                            {reactions.map((r) => (
                                <motion.div
                                    key={r.id}
                                    initial={{ y: 0, opacity: 0, scale: 0.5, x: `${r.x}%` }}
                                    animate={{ y: -300, opacity: [0, 1, 1, 0], scale: [0.5, 1.5, 1.5, 1] }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 3, ease: "easeOut" }}
                                    className="absolute text-4xl"
                                >
                                    {r.emoji}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                </main>

                {/* Sidebar */}
                <AnimatePresence>
                    {(showAI || sidebarVisibleOnMobile) && (
                        <motion.aside
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            className="fixed inset-y-0 right-0 w-full sm:w-80 md:w-96 md:relative border-l border-white/5 bg-[#020617]/95 md:bg-slate-900/80 backdrop-blur-2xl flex flex-col z-[100] md:z-auto"
                        >
                            <div className="flex border-b border-white/5">
                                <button
                                    onClick={() => setSidebarTab('ai')}
                                    className={`flex-1 p-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-2 transition-all ${sidebarTab === 'ai' ? 'bg-indigo-600/5 text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500'}`}
                                >
                                    <Sparkles className="w-4 h-4" /> <span>AI Companion</span>
                                </button>
                                <button
                                    onClick={() => setSidebarTab('participants')}
                                    className={`flex-1 p-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-2 transition-all ${sidebarTab === 'participants' ? 'bg-indigo-600/5 text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500'}`}
                                >
                                    <Users className="w-4 h-4" /> <span>Participants</span>
                                </button>
                                <button
                                    onClick={() => setSidebarTab('chat')}
                                    className={`flex-1 p-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-2 transition-all ${sidebarTab === 'chat' ? 'bg-indigo-600/5 text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500'}`}
                                >
                                    <MessageSquare className="w-4 h-4" /> <span>Chat</span>
                                </button>
                                <button onClick={() => setShowAI(false)} className="p-4 hover:bg-white/10 transition-colors">
                                    <X className="w-4 h-4 text-slate-500" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                {sidebarTab === 'ai' ? (
                                    <div className="p-6 space-y-6">
                                        <div>
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Meeting Progress</h3>
                                                <span className="text-[9px] px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-black tracking-widest animate-pulse border border-emerald-500/20">
                                                    {aiStatus}
                                                </span>
                                            </div>
                                            <div className="glass p-5 rounded-2xl text-sm border-l-4 border-indigo-500/50 bg-indigo-500/[0.03] leading-relaxed font-medium text-slate-300">
                                                {summary || "Analyzing discussion flows to generate key insights..."}
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Real-time Transcript</h3>
                                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                {transcript.length > 0 ? (
                                                    transcript.map((msg, i) => (
                                                        <div key={i} className={`p-4 rounded-2xl transition-all ${msg.user === 'AI Assistant' ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-slate-900/40 border border-white/5'}`}>
                                                            <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${msg.user === 'AI Assistant' ? 'text-indigo-400' : 'text-slate-500'}`}>{msg.user}</p>
                                                            <p className="text-[13px] leading-relaxed text-slate-300 font-medium">{msg.text}</p>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-sm text-slate-500 italic">No speech detected yet...</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : sidebarTab === 'participants' ? (
                                    <div className="p-6 space-y-4">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Participant List</h3>
                                        <div className="space-y-2">
                                            {liveParticipants.map((person, i) => (
                                                <div key={i} className="glass p-3 rounded-xl flex items-center justify-between group overflow-hidden relative">
                                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${person.status === 'connected' ? 'bg-green-500' : person.status === 'away' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                                                    <div className="flex items-center space-x-3 ml-2">
                                                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold">
                                                            {person.name.split(' ').map(n => n[0]).join('')}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium">{person.name}</p>
                                                            <p className="text-[10px] text-slate-500">Joined recently</p>
                                                        </div>
                                                    </div>
                                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${person.status === 'connected' ? 'text-green-400' : person.status === 'away' ? 'text-yellow-400' : 'text-red-400'}`}>
                                                        {person.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        <button className="w-full mt-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-all flex items-center justify-center">
                                            <Download className="w-4 h-4 mr-2" /> Export Insight Report
                                        </button>
                                    </div>
                                ) : (
                                    <div className="p-6 flex flex-col h-full overflow-hidden">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Meeting Chat</h3>
                                        <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                                            {messages.map((msg, i) => {
                                                const isYou = msg.user === "You";
                                                return (
                                                    <div key={i} className={`flex flex-col ${isYou ? 'items-end' : 'items-start'}`}>
                                                        <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] font-medium leading-relaxed ${isYou ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'}`}>
                                                            {msg.text}
                                                        </div>
                                                        <span className="text-[9px] font-black tracking-widest text-slate-500 uppercase mt-2 px-1">{msg.user} • {msg.time}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 border-t border-white/5 bg-slate-900/40">
                                <form onSubmit={handleSendMessage} className="relative">
                                    <input
                                        type="text"
                                        placeholder={sidebarTab === 'chat' ? "Type a message..." : "Search messages or ask AI..."}
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        className="w-full bg-slate-950/40 border border-white/5 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all placeholder:text-slate-700"
                                    />
                                    <button type="submit" className="absolute right-4 top-4 text-indigo-500 hover:text-indigo-400 disabled:opacity-30 transition-colors" disabled={!newMessage.trim()}>
                                        <MessageSquare className="w-5 h-5" />
                                    </button>
                                </form>
                            </div>
                        </motion.aside>
                    )}
                </AnimatePresence>
            </div >

            {/* Control Bar */}
            <footer className="h-24 px-8 flex justify-between items-center bg-slate-900 border-t border-white/5 z-20">
                <div className="hidden lg:flex flex-col">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Meeting Duration</p>
                    <p className="font-mono text-xl text-purple-400">00:42:15</p>
                </div>

                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isMuted ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                    >
                        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                    <button
                        onClick={() => setIsVideoOff(!isVideoOff)}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                    >
                        {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                    </button>

                    <div className="h-8 w-[1px] bg-white/10 mx-2" />

                    <button
                        onClick={toggleScreenShare}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${screenStream ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                    >
                        <ScreenShare className="w-5 h-5" />
                    </button>

                    <button
                        onClick={toggleRecording}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                    >
                        {isRecording ? <StopCircle className="w-5 h-5" /> : <Radio className="w-5 h-5" />}
                    </button>

                    <button
                        onClick={() => {
                            const newState = !handRaised;
                            setHandRaised(newState);
                            if (channel) {
                                channel.send({
                                    type: 'broadcast',
                                    event: 'handRaised',
                                    payload: { userId: myId, userName: myId, raised: newState }
                                });
                            }
                        }}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${handRaised ? 'bg-yellow-500 text-slate-950 shadow-lg shadow-yellow-500/30' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                    >
                        <Hand className={`w-5 h-5 ${handRaised ? 'fill-current' : ''}`} />
                    </button>

                    <div className="group relative">
                        <button className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all">
                            <Sparkles className="w-5 h-5" />
                        </button>
                        <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 glass p-2 rounded-2xl hidden group-hover:flex space-x-2 border border-white/10 backdrop-blur-3xl">
                            {['❤️', '👏', '🔥', '😂', '🎉', '💡'].map((emoji) => (
                                <button
                                    key={emoji}
                                    onClick={() => addReaction(emoji)}
                                    className="hover:scale-125 transition-transform p-2 text-xl"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            if (!showAI) setShowAI(true);
                            setSidebarTab('chat');
                        }}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${showAI && sidebarTab === 'chat' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 border-transparent' : 'bg-white/5 hover:bg-white/10 text-slate-400 border border-white/5'}`}
                    >
                        <MessageSquare className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setShowAI(!showAI)}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${showAI ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 border-transparent' : 'bg-white/5 hover:bg-white/10 text-slate-400 border border-white/5'}`}
                    >
                        <Sparkles className="w-5 h-5" />
                    </button>

                    <div className="h-8 w-[1px] bg-white/10 mx-2" />

                    <button
                        onClick={() => onExit(summary, transcript.map(t => t.text).join(" "))}
                        className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold flex items-center transition-all active:scale-95 text-sm"
                    >
                        <span className="hidden sm:inline mr-2">End</span> <LogOut className="w-4 h-4" />
                    </button>

                    <button
                        onClick={() => setSidebarVisibleOnMobile(!sidebarVisibleOnMobile)}
                        className={`md:hidden w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${sidebarVisibleOnMobile ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400'}`}
                    >
                        <Users className="w-5 h-5" />
                    </button>
                </div>

                <div className="hidden lg:block">
                    <button
                        onClick={() => setShowSettings(true)}
                        className="bg-white/5 hover:bg-white/10 p-3 rounded-2xl transition-all"
                    >
                        <Layout className="w-5 h-5" />
                    </button>
                </div>
            </footer>

            {/* Settings Modal */}
            <AnimatePresence>
                {showSettings && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 pb-20">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowSettings(false)}
                            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative glass-card w-full max-w-2xl border border-white/10 p-8 overflow-hidden"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-indigo-500/20 rounded-lg">
                                        <Settings className="w-6 h-6 text-indigo-400" />
                                    </div>
                                    <h2 className="text-2xl font-bold">Meeting Settings</h2>
                                </div>
                                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-full transition-all">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <section>
                                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Video Quality</h3>
                                        <div className="grid grid-cols-3 gap-2">
                                            {(['720p', '1080p', '4k'] as const).map((q) => (
                                                <button
                                                    key={q}
                                                    onClick={() => setVideoQuality(q)}
                                                    className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${videoQuality === q ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-900/50 border-white/5 text-slate-500 hover:border-white/20'}`}
                                                >
                                                    {q}
                                                </button>
                                            ))}
                                        </div>
                                    </section>

                                    <section>
                                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Camera</h3>
                                        <select
                                            value={selectedCamera}
                                            onChange={(e) => setSelectedCamera(e.target.value)}
                                            className="w-full bg-slate-950/40 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all appearance-none text-slate-300"
                                        >
                                            <option value="">Default System Camera</option>
                                            {availableCameras.map(cam => (
                                                <option key={cam.deviceId} value={cam.deviceId}>
                                                    {cam.label || `Camera ${cam.deviceId.slice(0, 5)}...`}
                                                </option>
                                            ))}
                                        </select>
                                    </section>

                                    <section>
                                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Microphone</h3>
                                        <select
                                            value={selectedMic}
                                            onChange={(e) => setSelectedMic(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all appearance-none"
                                        >
                                            <option value="">Default System Mic</option>
                                            {availableMics.map(mic => (
                                                <option key={mic.deviceId} value={mic.deviceId}>
                                                    {mic.label || `Microphone ${mic.deviceId.slice(0, 5)}...`}
                                                </option>
                                            ))}
                                        </select>
                                    </section>
                                </div>

                                <div className="space-y-6">
                                    <section>
                                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Pro Features</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                                                <div className="flex items-center space-x-4">
                                                    <div className="p-3 bg-indigo-600/10 rounded-xl">
                                                        <Sparkles className="w-5 h-5 text-indigo-400" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm">Blur Background</p>
                                                        <p className="text-[10px] text-slate-500 font-medium font-black uppercase">Privacy focus</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setBlurBackground(!blurBackground)}
                                                    className={`w-14 h-8 rounded-full transition-all relative ${blurBackground ? 'bg-indigo-600' : 'bg-slate-800'}`}
                                                >
                                                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${blurBackground ? 'left-7' : 'left-1'}`} />
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                                                <div className="flex items-center space-x-3">
                                                    <Radio className="w-4 h-4 text-sky-400" />
                                                    <span className="text-sm font-medium">Noise Cancellation</span>
                                                </div>
                                                <div className="w-10 h-6 bg-indigo-600 rounded-full relative p-1 cursor-pointer">
                                                    <div className="w-4 h-4 bg-white rounded-full ml-auto" />
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl relative overflow-hidden group">
                                        <div className="relative z-10">
                                            <h4 className="text-sm font-black uppercase tracking-widest text-indigo-200 mb-1">Professional Suite</h4>
                                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                                                Unlock 4K streaming, custom backgrounds, and advanced meeting analytics with Professional.
                                            </p>
                                        </div>
                                        <Sparkles className="absolute -bottom-4 -right-4 w-24 h-24 text-indigo-500/5 group-hover:scale-110 transition-transform" />
                                    </section>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowSettings(false)}
                                className="w-full mt-8 h-14 bg-indigo-600 rounded-xl font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:bg-indigo-500 transition-all text-white"
                            >
                                Save Changes
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default VideoRoom;
