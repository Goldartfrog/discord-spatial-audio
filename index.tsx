/*
 * SpatialVoice - Distance-based volume control for Discord
 * 
 * TODO:
 * - Save previous custom volumes before modifying, restore when plugin stops
 *   (need to find a getLocalVolume or similar to read current values)
 */

import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { FluxDispatcher, UserStore } from "@webpack/common";

// Discord's internal modules - verify these with findByProps() in console
const AudioModule = findByPropsLazy("setLocalVolume");
const VoiceStateStore = findByPropsLazy("getVoiceStatesForChannel", "getVoiceStateForUser");
const SelectedChannelStore = findByPropsLazy("getVoiceChannelId");

let ws: WebSocket | null = null;
let positions: Record<string, { x: number; y: number }> = {};
let savedVolumes: Record<string, number> = {};

function distanceToVolume(myPos: { x: number; y: number }, theirPos: { x: number; y: number }): number {
    const distance = Math.sqrt(
        (theirPos.x - myPos.x) ** 2 + 
        (theirPos.y - myPos.y) ** 2
    );
    const maxDistance = 300;
    return Math.max(0, Math.round(100 - (distance / maxDistance) * 100));
}

function updateAllVolumes() {
    const myId = UserStore.getCurrentUser()?.id;
    if (!myId || !positions[myId]) return;

    const channelId = SelectedChannelStore.getVoiceChannelId();
    if (!channelId) return;

    const voiceStates = VoiceStateStore.getVoiceStatesForChannel(channelId);
    if (!voiceStates) return;

    for (const odId of Object.keys(voiceStates)) {
        if (odId === myId) continue;

        const theirPos = positions[odId];
        if (!theirPos) {
            AudioModule.setLocalVolume(odId, 100);
            continue;
        }

        const volume = distanceToVolume(positions[myId], theirPos);
        AudioModule.setLocalVolume(odId, volume);
        console.log(`[SpatialVoice] ${odId} -> ${volume}%`);
    }
}

function connectWebSocket() {
    if (ws) return;

    // TODO: Make this configurable
    const serverUrl = "ws://127.0.0.1:8080";
    
    console.log("[SpatialVoice] Connecting to", serverUrl);
    ws = new WebSocket(serverUrl);

    ws.onopen = () => {
        console.log("[SpatialVoice] Connected to position server");
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === "positions") {
                positions = data.positions;
                updateAllVolumes();
            }
        } catch (e) {
            console.error("[SpatialVoice] Failed to parse message:", e);
        }
    };

    ws.onclose = () => {
        console.log("[SpatialVoice] Disconnected from position server");
        ws = null;
    };

    ws.onerror = (error) => {
        console.error("[SpatialVoice] WebSocket error:", error);
    };
}

function disconnectWebSocket() {
    if (ws) {
        ws.close();
        ws = null;
    }
    positions = {};
}

function restoreVolumes() {
    const channelId = SelectedChannelStore.getVoiceChannelId();
    if (channelId) {
        const voiceStates = VoiceStateStore.getVoiceStatesForChannel(channelId);
        if (voiceStates) {
            for (const odId of Object.keys(voiceStates)) {
                const originalVolume = savedVolumes[odId] ?? 100;
                AudioModule.setLocalVolume(odId, originalVolume);
            }
        }
    }
    savedVolumes = {};
}

function onVoiceStateUpdate() {
    const channelId = SelectedChannelStore.getVoiceChannelId();

    if (channelId) {
        connectWebSocket();
    } else {
        restoreVolumes();
        disconnectWebSocket();
    }
}

export default definePlugin({
    name: "SpatialVoice",
    description: "Distance-based volume control via external canvas",
    authors: [{ id: 0n, name: "You" }],

    patches: [],

    start() {
        console.log("[SpatialVoice] Plugin started");
        
        FluxDispatcher.subscribe("VOICE_STATE_UPDATES", onVoiceStateUpdate);

        // Check if already in a voice channel
        const channelId = SelectedChannelStore.getVoiceChannelId();
        if (channelId) {
            connectWebSocket();
        }
    },

    stop() {
        console.log("[SpatialVoice] Plugin stopped");
        
        FluxDispatcher.unsubscribe("VOICE_STATE_UPDATES", onVoiceStateUpdate);
        restoreVolumes();
        disconnectWebSocket();
    }
});
