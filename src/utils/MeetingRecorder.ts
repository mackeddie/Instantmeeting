export class MeetingRecorder {
    private mediaRecorder: MediaRecorder | null = null;
    private chunks: Blob[] = [];
    private stream: MediaStream;

    constructor(stream: MediaStream) {
        this.stream = stream;
    }

    start() {
        this.chunks = [];
        const options = { mimeType: 'video/webm;codecs=vp9,opus' };

        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            console.warn('VP9 not supported, falling back to default');
            (options as { mimeType?: string }).mimeType = undefined;
        }

        this.mediaRecorder = new MediaRecorder(this.stream, options);

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                console.log(`Recording: Received chunk of size ${event.data.size}`);
                this.chunks.push(event.data);
            }
        };

        this.mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event);
        };

        this.mediaRecorder.start(1000); // Capture in 1s chunks
        console.log('Recording started with stream:', this.stream.id, 'Tracks:', this.stream.getTracks().length);
    }

    stop(): Promise<Blob> {
        return new Promise((resolve) => {
            if (!this.mediaRecorder) return;

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.chunks, { type: 'video/webm' });
                resolve(blob);
            };

            this.mediaRecorder.stop();
            console.log('Recording stopped');
        });
    }

    download(blob: Blob, filename: string) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
    }
}
