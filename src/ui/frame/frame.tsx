import * as styles from "./frame.css";
import { ChatWindow } from "../chat-window/chat-window";
import { Component } from "preact";
import { runServiceWorkerCommand } from "service-worker-command-bridge";
import { CacheSyncRequest, CacheSyncResponse } from "../../interfaces/cache-sync-request";
import { Waveform } from "../waveform/waveform";
import { Controls } from "../controls/controls";

enum PlayState {
    Paused,
    Playing,
    Buffering
}

interface PlayerState {
    download?: {
        total: number;
        current: number;
    };
    playback?: {
        current: number;
        total: number;
    };
    playState: PlayState;
}

export class Frame extends Component<any, PlayerState> {
    audioElement: HTMLAudioElement;

    constructor() {
        super();
        this.state = {
            playState: PlayState.Paused
        };
        this.timeUpdate = this.timeUpdate.bind(this);
        this.playStateChange = this.playStateChange.bind(this);
        this.audioProgress = this.audioProgress.bind(this);
    }

    render() {
        let loadedPercent = 0;
        let playbackPercent = 0;
        if (this.state.download) {
            loadedPercent = this.state.download.current / this.state.download.total;
        }
        if (this.state.playback) {
            playbackPercent = this.state.playback.current / this.state.playback.total;
        }

        return (
            <div class={styles.frame}>
                <audio
                    src="/bundles/mona-ep-1/Data_Pod_E01_v3_192519.mp3"
                    preload="auto"
                    onProgress={this.audioProgress}
                    onTimeUpdate={this.timeUpdate}
                    onPlay={this.playStateChange}
                    onPause={this.playStateChange}
                    title="TEST CONTENT"
                    style={{ position: "absolute", zIndex: 100 }}
                    ref={el => (this.audioElement = el as HTMLAudioElement)}
                />

                <ChatWindow
                    url="/bundles/mona-ep-1/script.json"
                    currentTime={this.state.playback ? this.state.playback.current : 0}
                />
                <div className={styles.controls}>
                    <Waveform
                        dataURL="/bundles/mona-ep-1/waveform.dat"
                        downloadPercentage={loadedPercent}
                        playbackPercentage={playbackPercent}
                    />
                    <Controls
                        onPlay={() => this.audioElement.play()}
                        onPause={() => this.audioElement.pause()}
                        canPlay={this.state.playState == PlayState.Paused}
                        canPause={this.state.playState == PlayState.Playing}
                    />
                </div>
            </div>
        );
    }

    componentDidMount() {
        runServiceWorkerCommand<CacheSyncRequest, CacheSyncResponse>("cachesync", {
            cacheName: "mona-ep-1",
            payloadURL: "/bundles/mona-ep-1/files.json"
        }).then(response => {
            response.progressEvents.onmessage = (e: MessageEvent) => {
                this.setState({
                    download: {
                        current: e.data.current,
                        total: e.data.total
                    }
                });
            };
        });
    }

    nextSecondTimeout: number;

    timeUpdate(e: Event) {
        let currentTime = this.audioElement.currentTime;
        let nextSecond = Math.ceil(currentTime);
        let untilNextSecond = nextSecond - currentTime;

        clearTimeout(this.nextSecondTimeout);
        this.nextSecondTimeout = setTimeout(() => {
            this.setState({
                playback: {
                    current: this.audioElement.currentTime,
                    total: this.audioElement.duration
                }
            });
            console.log("TIME UPDATE", this.audioElement.currentTime);
        }, untilNextSecond * 1000);
    }

    audioProgress(e) {
        console.log(e.target.buffered);
        if (e.target.buffered.length == 0) {
            return;
        }

        let bufferEnd = e.target.buffered.end(e.target.buffered.length - 1);
        console.log("end");
        if ("serviceWorker" in navigator == false) {
            console.log("send end", bufferEnd);
            this.setState({
                download: {
                    current: bufferEnd,
                    total: this.audioElement.duration
                }
            });
        }

        console.info(e, e.target.buffered.start(0), e.target.buffered.end(0));
    }

    playStateChange(e) {
        this.setState({
            playState: this.audioElement.paused ? PlayState.Paused : PlayState.Playing
        });

        if (this.audioElement.paused) {
            clearTimeout(this.nextSecondTimeout);
        }
    }
}
