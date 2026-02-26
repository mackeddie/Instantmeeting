import { useState, useEffect } from 'react';
import { Video, Users, Sparkles, ArrowRight, Code, Layout, ScreenShare, Radio, Globe, Zap, Heart, Mic, Shield, BarChart3, Cloud } from 'lucide-react';
import { motion } from 'framer-motion';
import VideoRoom from './VideoRoom';

function App() {
  const [roomName, setRoomName] = useState('');
  const [userName, setUserName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [step, setStep] = useState<'landing' | 'lobby' | 'room'>('landing');
  const [recentMeetings, setRecentMeetings] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('instantmeet_history');
    if (saved) {
      setRecentMeetings(JSON.parse(saved));
    }
  }, []);

  const saveToHistory = (room: string, summary: string, transcript: string) => {
    const meeting = {
      id: Date.now(),
      name: room,
      date: new Date().toLocaleDateString(),
      summary,
      transcript
    };
    const updated = [meeting, ...recentMeetings].slice(0, 5);
    setRecentMeetings(updated);
    localStorage.setItem('instantmeet_history', JSON.stringify(updated));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room && step === 'landing') {
      setRoomName(room);
      setStep('lobby');
    }
  }, [step]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomName.trim()) {
      setStep('lobby');
    }
  };

  const handleJoinMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim()) {
      setStep('room');
    }
  };

  const scrollToSection = (id: string, focusId?: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      if (focusId) {
        setTimeout(() => {
          document.getElementById(focusId)?.focus();
        }, 800);
      }
    }
  };

  if (step === 'room') {
    return (
      <VideoRoom
        roomName={roomName}
        userName={userName}
        passcode={passcode}
        onExit={(summary, transcript) => {
          if (summary || transcript) {
            saveToHistory(roomName, summary || "", transcript || "");
          }
          setStep('landing');
        }}
      />
    );
  }

  if (step === 'lobby') {
    return (
      <div className="min-h-screen mesh-gradient flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-premium p-12 w-full max-w-lg rounded-[2.5rem]"
        >
          <div className="flex items-center space-x-6 mb-12">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/20 text-white">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white">Complete Profile</h2>
              <p className="text-slate-400 font-medium">Joining room <span className="text-indigo-400">{roomName}</span></p>
            </div>
          </div>

          <form onSubmit={handleJoinMeeting} className="space-y-10">
            <div className="space-y-4">
              <label className="block text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 ml-1">Your Display Name</label>
              <input
                autoFocus
                type="text"
                placeholder="Ex. Sarah Jenkins"
                className="w-full h-16 bg-slate-900/50 border border-white/5 rounded-2xl px-6 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-lg placeholder:text-slate-700"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </div>
            <div className="space-y-4">
              <label className="block text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 ml-1">Room Passcode (Optional)</label>
              <div className="relative">
                <Shield className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                <input
                  type="password"
                  placeholder="Set a passcode for privacy..."
                  className="w-full h-16 bg-slate-900/50 border border-white/5 rounded-2xl pl-16 pr-6 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-lg placeholder:text-slate-700"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col space-y-4 pt-4">
              <button
                type="submit"
                className="h-16 bg-gradient-to-r from-indigo-600 to-sky-600 rounded-2xl font-black shadow-2xl shadow-indigo-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all text-white text-lg tracking-wide"
              >
                Join Now
              </button>
              <button
                type="button"
                onClick={() => setStep('landing')}
                className="h-14 bg-transparent hover:bg-white/[0.03] rounded-2xl font-bold transition-all border border-white/5 text-slate-500 hover:text-slate-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] selection:bg-indigo-500/30 overflow-x-hidden">
      <div className="mesh-gradient absolute inset-0 opacity-60 pointer-events-none" />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-[100] px-10 py-8 flex justify-between items-center bg-slate-950/40 backdrop-blur-2xl border-b border-white/5">
        <div className="flex items-center space-x-4 group cursor-pointer" onClick={() => scrollToSection('home')}>
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/30 text-white transform group-hover:scale-110 transition-transform">
            <Video className="w-7 h-7" />
          </div>
          <span className="text-2xl font-black tracking-tight text-white">InstantMeet</span>
        </div>
        <div className="hidden lg:flex items-center space-x-12 text-xs font-black uppercase tracking-[0.15em] text-slate-500">
          <button onClick={() => scrollToSection('features')} className="hover:text-white transition-all">Features</button>
          <button onClick={() => scrollToSection('solutions')} className="hover:text-white transition-all">Solutions</button>
          <button onClick={() => scrollToSection('enterprise')} className="hover:text-white transition-all">Security</button>
          <button
            onClick={() => scrollToSection('hero-action', 'room-input')}
            className="px-10 py-3.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl border border-indigo-500/20 transition-all font-black text-[10px] uppercase tracking-widest"
          >
            Start Meeting
          </button>
        </div>
      </nav>

      <main className="relative pt-24">
        {/* Hero Section */}
        <section id="home" className="relative min-h-[90vh] flex items-center px-10 max-w-7xl mx-auto">
          <div className="hero-glow" />
          <div className="grid lg:grid-cols-12 gap-20 items-center w-full">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="lg:col-span-7 space-y-12"
            >
              <div className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <Shield className="w-4 h-4 mr-2" />
                Enterprise-Grade Video Architecture
              </div>
              <h1 className="text-7xl md:text-9xl font-black leading-[0.85] tracking-tighter text-white">
                Simple. <br />
                Silent. <br />
                <span className="gradient-text">Standard.</span>
              </h1>
              <p className="text-xl text-slate-400 max-w-xl leading-relaxed font-medium">
                The world standard for high-stakes professional meetings. <span className="text-white border-b border-indigo-500/50">Zero lag. No logins.</span> Experience real-time AI transcription and 4K screen sharing.
              </p>

              <form onSubmit={handleCreateRoom} className="relative max-w-lg group" id="hero-action">
                <div className="absolute -inset-1 bg-indigo-500/20 rounded-[1.5rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative flex p-2 bg-slate-900 border border-white/5 rounded-2xl shadow-2xl">
                  <input
                    id="room-input"
                    type="text"
                    placeholder="Enter meeting name..."
                    className="flex-1 bg-transparent px-6 text-white placeholder:text-slate-600 focus:outline-none text-lg font-medium"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="h-14 px-10 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-black text-white transition-all flex items-center space-x-3 shadow-xl shadow-indigo-500/20"
                  >
                    <span>START</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </form>

              {recentMeetings.length > 0 && (
                <div className="pt-10 space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 ml-1">Recent Intelligence</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {recentMeetings.map(m => (
                      <div key={m.id} className="p-4 bg-slate-900/50 border border-white/5 rounded-2xl flex items-center justify-between group/item hover:bg-slate-900 transition-all cursor-pointer">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-white leading-none tracking-tight">{m.name}</p>
                          <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest leading-none">{m.date}</p>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity">
                          <BarChart3 className="w-4 h-4 text-indigo-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center space-x-10 pt-4">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="w-11 h-11 rounded-xl border-2 border-[#020617] bg-slate-800 flex items-center justify-center overflow-hidden shadow-2xl transform hover:scale-110 transition-transform cursor-pointer">
                      <img src={`https://i.pravatar.cc/100?u=${i + 10}`} alt="user" className="w-full h-full object-cover grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all" />
                    </div>
                  ))}
                </div>
                <div className="h-10 w-px bg-slate-800" />
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">
                  Powering <span className="text-indigo-400">50,000+</span> <br />Daily Sessions
                </p>
              </div>
            </motion.div>

            {/* Premium Billboard Section */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="lg:col-span-5 relative hidden lg:block"
            >
              <div className="relative glass-premium rounded-[3rem] p-6 aspect-[4/5] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] overflow-hidden group">
                {/* Abstract UI Placeholder */}
                <div className="absolute inset-0 bg-[#020617]/40">
                  <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-center z-10 border-b border-white/[0.03]">
                    <div className="flex space-x-3">
                      <div className="w-3 h-3 rounded-full bg-slate-700/50" />
                      <div className="w-3 h-3 rounded-full bg-slate-700/50" />
                      <div className="w-3 h-3 rounded-full bg-slate-700/50" />
                    </div>
                    <div className="px-4 py-1.5 bg-indigo-500/10 rounded-lg text-[10px] font-black text-indigo-400 border border-indigo-500/20 tracking-[0.1em]">ENCRYPTION ACTIVE</div>
                  </div>

                  {/* Visual Decoration */}
                  <div className="absolute inset-x-10 top-32 bottom-40 grid grid-cols-2 gap-6">
                    <div className="bg-slate-900 rounded-3xl border border-white/5 relative overflow-hidden group/item">
                      <div className="absolute inset-0 bg-indigo-500/[0.02] group-hover/item:bg-indigo-500/[0.05] transition-colors" />
                      <div className="absolute bottom-6 left-6 w-20 h-2 bg-indigo-500/20 rounded-full" />
                    </div>
                    <div className="bg-slate-900 rounded-3xl border border-white/5 overflow-hidden flex items-center justify-center">
                      <BarChart3 className="w-12 h-12 text-slate-800" />
                    </div>
                    <div className="col-span-2 bg-indigo-600/5 rounded-[2.5rem] border border-indigo-500/10 p-10 flex items-center justify-center">
                      <div className="text-center">
                        <Cloud className="w-16 h-16 text-indigo-600/20 mx-auto mb-6" />
                        <div className="space-y-3">
                          <div className="w-48 h-2 bg-slate-800 rounded-full mx-auto" />
                          <div className="w-32 h-2 bg-slate-800 rounded-full mx-auto opacity-50" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="absolute bottom-10 inset-x-10 flex justify-between items-center p-6 bg-slate-950/80 rounded-[2rem] border border-white/5 backdrop-blur-3xl shadow-2xl">
                    <div className="flex space-x-4">
                      {[Mic, ScreenShare, Globe].map((Icon, idx) => (
                        <div key={idx} className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/[0.03] flex items-center justify-center hover:bg-white/[0.05] transition-all cursor-pointer">
                          <Icon className="w-5 h-5 text-slate-500" />
                        </div>
                      ))}
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-indigo-600 shadow-[0_10px_30px_rgba(79,70,229,0.4)] flex items-center justify-center transform hover:scale-105 transition-all cursor-pointer">
                      <Zap className="w-7 h-7 text-white fill-current" />
                    </div>
                  </div>
                </div>

                {/* Stat Badge Overlay */}
                <div className="absolute -bottom-8 -right-8 stat-card p-12 rounded-[3.5rem] transform hover:rotate-0 transition-all cursor-default z-20 group-hover:scale-105">
                  <div className="flex items-center space-x-6">
                    <div className="w-20 h-20 bg-indigo-600/10 border border-indigo-500/20 rounded-3xl flex items-center justify-center">
                      <Users className="w-10 h-10 text-indigo-500" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-6xl font-black tracking-tighter text-white">50K+</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Global Partners daily</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-48 relative px-10">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end mb-32 gap-10">
              <div className="max-w-2xl">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 mb-6 block">The Tech Stack</span>
                <h2 className="text-6xl font-black mb-10 leading-[0.9] tracking-tighter text-white">Built for <br /><span className="gradient-text">Elite Reliability.</span></h2>
                <p className="text-slate-500 text-xl font-medium leading-relaxed">Engineered with a focus on privacy and high-fidelity data transmission. No middlemen, no data collection, just raw connectivity.</p>
              </div>
              <div className="pb-4">
                <button onClick={() => scrollToSection('hero-action')} className="p-4 bg-white/5 border border-white/5 rounded-full hover:bg-white/10 transition-all">
                  <ArrowRight className="w-8 h-8 text-white -rotate-45" />
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-12">
              <FeatureCard
                icon={<Zap className="w-7 h-7" />}
                title="Flash Connect"
                description="Proprietary P2P signaling logic that connects you instantly with global peers, bypassing central server delays."
                theme="indigo"
              />
              <FeatureCard
                icon={<Sparkles className="w-7 h-7" />}
                title="AI Synthesis"
                description="Advanced natural language processing for real-time transcription and automated executive summaries."
                theme="slate"
              />
              <FeatureCard
                icon={<Radio className="w-7 h-7" />}
                title="UHD Broadcast"
                description="Highest possible bitrate for screen sharing, designed specifically for code review and design clarity."
                theme="sky"
              />
            </div>
          </div>
        </section>

        {/* Solutions Section */}
        <section id="solutions" className="py-48 bg-slate-900/10 border-y border-white/[0.03] px-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/5 blur-[150px] rounded-full" />
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-24">
            <div className="flex-1 space-y-16">
              <h2 className="text-6xl font-black tracking-tighter leading-[0.9] text-white">Universal <br />Compatibility.</h2>
              <div className="space-y-12">
                <SolutionBox
                  icon={<Code className="w-7 h-7" />}
                  title="Product Engineering"
                  desc="Crystal clear code sharing with zero compression artifacts."
                />
                <SolutionBox
                  icon={<Layout className="w-7 h-7" />}
                  title="Strategic Design"
                  desc="Collaborative whiteboards that feel as responsive as local apps."
                />
                <SolutionBox
                  icon={<Globe className="w-7 h-7" />}
                  title="Remote Operation"
                  desc="Standardized across every continent with intelligent routing."
                />
              </div>
            </div>
            <div className="flex-1 relative w-full">
              <div className="glass-premium p-20 rounded-[4rem] text-center border-white/[0.03] relative z-10">
                <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] mx-auto mb-12 flex items-center justify-center shadow-[0_20px_50px_rgba(79,70,229,0.3)] transform hover:rotate-12 transition-all">
                  <Heart className="w-11 h-11 text-white fill-current" />
                </div>
                <h3 className="text-4xl font-black mb-6 text-white tracking-tighter">Ready to Deploy?</h3>
                <p className="text-slate-500 mb-12 font-medium tracking-wide leading-relaxed">Join the world's most innovative teams today. <br />Free forever for individuals.</p>
                <button
                  onClick={() => scrollToSection('home')}
                  className="w-full h-20 bg-white text-slate-950 rounded-2xl font-black text-xl hover:bg-slate-100 transition-all flex items-center justify-center space-x-4 shadow-2xl"
                >
                  <span>Launch Now</span>
                  <ArrowRight className="w-6 h-6" />
                </button>
              </div>
              <div className="absolute -inset-10 bg-indigo-600/5 blur-[100px] rounded-[5rem]" />
            </div>
          </div>
        </section>

        {/* Enterprise Section */}
        <section id="enterprise" className="py-48 px-10 text-center max-w-5xl mx-auto">
          <div className="p-24 glass-premium rounded-[5rem] border-indigo-500/10 relative overflow-hidden group">
            <div className="absolute inset-0 bg-indigo-600/[0.01] group-hover:bg-indigo-600/[0.03] transition-colors" />
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-8 py-2.5 bg-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-[0.3em] text-white shadow-2xl shadow-indigo-600/40">Infrastructure Integrity</div>
            <h2 className="text-5xl font-black mb-12 tracking-tighter text-white leading-tight">Trusted by global <br />infrastructure partners.</h2>
            <div className="flex flex-wrap justify-center gap-16 opacity-20 grayscale hover:grayscale-0 transition-all duration-1000">
              {['TECHCO', 'VORTEX', 'SYNAPSE', 'CORE', 'APEX'].map(name => (
                <span key={name} className="text-3xl font-black tracking-[0.2em]">{name}</span>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="py-24 border-t border-white/5 px-10 bg-slate-950/50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="flex flex-col items-center md:items-start space-y-4">
            <div className="flex items-center space-x-4">
              <Video className="w-8 h-8 text-indigo-600" />
              <span className="text-2xl font-black tracking-tighter text-white">InstantMeet</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">A Deetech Innovations Digital Product</p>
          </div>
          <div className="flex flex-col items-center space-y-4">
            <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.3em] italic">Standardized Communication Protocol © 2026</p>
            <p className="text-indigo-400/40 text-[9px] font-black uppercase tracking-[0.4em]">Developer: Deetech Innovations</p>
          </div>
          <div className="flex space-x-12">
            {['X', 'LINKEDIN', 'GITHUB'].map(s => (
              <a key={s} href="#" className="text-xs font-black tracking-[0.3em] text-slate-500 hover:text-indigo-400 transition-all">{s}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, theme }: { icon: React.ReactNode, title: string, description: string, theme: string }) {
  const themeMap: any = {
    indigo: "text-indigo-400 bg-indigo-600/5 border-indigo-500/20 shadow-indigo-500/5",
    slate: "text-slate-300 bg-slate-800/10 border-slate-700/20 shadow-slate-700/5",
    sky: "text-sky-400 bg-sky-600/5 border-sky-500/20 shadow-sky-500/5"
  };
  return (
    <motion.div
      whileHover={{ y: -12 }}
      className="glass-premium p-12 rounded-[3rem] border border-white/[0.03] hover:border-white/[0.08] transition-all group"
    >
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-10 border transition-all group-hover:scale-110 ${themeMap[theme]}`}>
        {icon}
      </div>
      <h3 className="text-3xl font-black mb-6 tracking-tight text-white">{title}</h3>
      <p className="text-slate-500 leading-relaxed font-medium text-lg">{description}</p>
    </motion.div>
  );
}

function SolutionBox({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="flex items-start space-x-8 group">
      <div className="w-14 h-14 bg-slate-900 border border-white/5 rounded-2xl flex items-center justify-center text-slate-600 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500/50 transition-all transform group-hover:-translate-y-1 shadow-lg">
        {icon}
      </div>
      <div className="space-y-2">
        <h4 className="text-2xl font-black tracking-tight text-white">{title}</h4>
        <p className="text-slate-500 text-base font-medium tracking-wide italic leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

export default App;
