/*
 * SpatialVoice - Distance-based volume control for Discord
 * 
 * TODO:
 * - Save previous custom volumes before modifying, restore when plugin stops
 */

import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { FluxDispatcher, UserStore } from "@webpack/common";

// Discord's internal modules
const AudioModule = findByPropsLazy("setLocalVolume");
const VoiceStateStore = findByPropsLazy("getVoiceStatesForChannel", "getVoiceStateForUser");
const SelectedChannelStore = findByPropsLazy("getVoiceChannelId");

let ws: WebSocket | null = null;
let currentChannelId: string | null = null;

// Positions for users in our channel: { visibleId: { visibleId, odId?, x, y } }
let positions: Record<string, { odId?: string; visibleId: string; x: number; y: number }> = {};
let savedVolumes: Record<string, number> = {};

function distanceToVolume(myPos: { x: number; y: number }, theirPos: { x: number; y: number }): number {
    const distance = Math.sqrt(
        (theirPos.x - myPos.x) ** 2 + 
        (theirPos.y - myPos.y) ** 2
    );
    const maxDistance = 300;
    return Math.max(0, Math.round(100 - (distance / maxDistance) * 100));
}

function getMyPosition(): { x: number; y: number } | null {
    const myUsername = UserStore.getCurrentUser()?.username;
    const myId = UserStore.getCurrentUser()?.id;
    
    // Check by username first
    if (myUsername && positions[myUsername]) return positions[myUsername];
    
    // Check by odId
    for (const pos of Object.values(positions)) {
        if (pos.odId === myId) return pos;
    }
    
    return null;
}

function updateAllVolumes() {
    const myId = UserStore.getCurrentUser()?.id;
    const myPos = getMyPosition();
    
    if (!myId || !myPos) {
        console.log("[SpatialVoice] No position for self yet");
        return;
    }

    const channelId = SelectedChannelStore.getVoiceChannelId();
    if (!channelId) return;

    const voiceStates = VoiceStateStore.getVoiceStatesForChannel(channelId);
    if (!voiceStates) return;

    for (const odId of Object.keys(voiceStates)) {
        if (odId === myId) continue;

        // Find their position by odId
        let theirPos = null;
        for (const pos of Object.values(positions)) {
            if (pos.odId === odId) {
                theirPos = pos;
                break;
            }
        }
        
        if (!theirPos) {
            // No position data for this user, keep at 100%
            AudioModule.setLocalVolume(odId, 100);
            continue;
        }

        const volume = distanceToVolume(myPos, theirPos);
        AudioModule.setLocalVolume(odId, volume);
        console.log(`[SpatialVoice] ${theirPos.visibleId} (${odId}) -> ${volume}%`);
    }
}

function sendRegistration() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
    const myId = UserStore.getCurrentUser()?.id;
    const myUsername = UserStore.getCurrentUser()?.username;
    const channelId = SelectedChannelStore.getVoiceChannelId();
    
    if (myId && myUsername && channelId) {
        ws.send(JSON.stringify({
            type: "register",
            odId: myId,
            visibleId: myUsername,
            channelId: channelId
        }));
        console.log(`[SpatialVoice] Registered as ${myUsername} in channel ${channelId}`);
    }
}

function connectWebSocket() {
    if (ws) return;

    const serverUrl = "ws://127.0.0.1:8080";
    
    console.log("[SpatialVoice] Connecting to", serverUrl);
    ws = new WebSocket(serverUrl);

    ws.onopen = () => {
        console.log("[SpatialVoice] Connected to position server");
        sendRegistration();
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === "positions") {
                positions = data.positions;
                console.log("[SpatialVoice] Received positions:", Object.keys(positions));
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
        // If channel changed, re-register
        if (channelId !== currentChannelId) {
            currentChannelId = channelId;
            if (ws && ws.readyState === WebSocket.OPEN) {
                sendRegistration();
            } else {
                connectWebSocket();
            }
        }
    } else {
        // Left voice
        currentChannelId = null;
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
            currentChannelId = channelId;
            connectWebSocket();
        }
    },

    stop() {
        console.log("[SpatialVoice] Plugin stopped");
        
        FluxDispatcher.unsubscribe("VOICE_STATE_UPDATES", onVoiceStateUpdate);
        restoreVolumes();
        disconnectWebSocket();
        currentChannelId = null;
    }
});
