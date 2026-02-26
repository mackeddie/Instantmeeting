import { useState, useEffect, useRef } from 'react';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import OpenAI from 'openai';

export function useAI(localStream: MediaStream | null) {
    const [transcript, setTranscript] = useState<{ user: string, text: string }[]>([]);
    const [summary, setSummary] = useState<string>("");
    const [isListening, setIsListening] = useState(false);
    const [aiStatus, setAiStatus] = useState<string>("Initializing AI...");

    const deepgramRef = useRef<any>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const transcriptBufferRef = useRef<string>("");
    const lastSummaryTimeRef = useRef<number>(Date.now());

    const DEEPGRAM_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;
    const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY;

    useEffect(() => {
        if (!localStream || !DEEPGRAM_KEY || DEEPGRAM_KEY === 'your_deepgram_api_key_here') {
            setAiStatus("Waiting for API keys...");
            return;
        }

        const setupTranscription = async () => {
            try {
                const deepgram = createClient(DEEPGRAM_KEY);
                const connection = deepgram.listen.live({
                    model: 'nova-2',
                    interim_results: true,
                    smart_format: true,
                });

                connection.on(LiveTranscriptionEvents.Open, () => {
                    console.log("Deepgram: Connection opened");
                    setIsListening(true);
                    setAiStatus("AI Listening...");

                    // Use the audio tracks from the local stream
                    const audioStream = new MediaStream(localStream.getAudioTracks());
                    const mediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });

                    mediaRecorder.addEventListener('dataavailable', (event) => {
                        if (event.data.size > 0 && connection.getReadyState() === 1) {
                            connection.send(event.data);
                        }
                    });

                    mediaRecorder.start(250); // Send chunks every 250ms
                    mediaRecorderRef.current = mediaRecorder;
                });

                connection.on(LiveTranscriptionEvents.Transcript, (data) => {
                    const received = data.channel.alternatives[0].transcript;
                    if (received && data.is_final) {
                        setTranscript(prev => [...prev, { user: "You", text: received }]);
                        transcriptBufferRef.current += " " + received;

                        // Check if it's time for a summary (every 30 seconds of speech)
                        if (Date.now() - lastSummaryTimeRef.current > 30000 && transcriptBufferRef.current.length > 100) {
                            generateSummary();
                        }
                    }
                });

                connection.on(LiveTranscriptionEvents.Close, () => {
                    console.warn("Deepgram: Connection closed");
                    setIsListening(false);
                });

                connection.on(LiveTranscriptionEvents.Error, (err) => {
                    console.error("Deepgram: Error", err);
                    setAiStatus("AI Error: Check Console");
                });

                deepgramRef.current = connection;
            } catch (err) {
                console.error("Failed to setup Deepgram:", err);
            }
        };

        setupTranscription();

        return () => {
            mediaRecorderRef.current?.stop();
            deepgramRef.current?.finish();
        };
    }, [localStream, DEEPGRAM_KEY]);

    const generateSummary = async () => {
        if (!OPENAI_KEY || OPENAI_KEY === 'your_openai_api_key_here' || !transcriptBufferRef.current) return;

        try {
            setAiStatus("Summarizing...");
            const openai = new OpenAI({ apiKey: OPENAI_KEY, dangerouslyAllowBrowser: true });

            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: "You are a meeting assistant. Summarize the following discussion concisely in 1-2 sentences." },
                    { role: "user", content: transcriptBufferRef.current }
                ],
            });

            const newSummary = response.choices[0]?.message?.content || "";
            if (newSummary) {
                setSummary(newSummary);
                lastSummaryTimeRef.current = Date.now();
                setAiStatus("AI Listening...");
            }
        } catch (err) {
            console.error("Failed to generate summary:", err);
            setAiStatus("AI Error: Summary failed");
        }
    };

    return { transcript, summary, isListening, aiStatus };
}
