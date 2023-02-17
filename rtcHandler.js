
import * as state from './state.js';
import * as ui from './uiHandler.js';

export let onLoadCreateSteam = ()=>{
    navigator.mediaDevices.enumerateDevices().then((devices)=>{
        const videoDevice = devices.find((device)=>device.kind === 'videoinput');
        const audioDevice = devices.find((device)=> device.kind === 'audioinput');

        return navigator.mediaDevices.getUserMedia({
            video:{deviceId:videoDevice.deviceId},
            audio:{deviceId:audioDevice.deviceId}
        });
    }).then((stream)=>{
        state.setLocalStream(stream);
        ui.setlocalViewSrc(stream);
    }).catch((err)=>console.log(err));
}

export let stopTracks = ()=>{
   let currentState= state.getState();
   currentState.localStream.getTracks().forEach((track)=> track.stop())
};

export let stopRemoteTracks = ()=>{
    let currentState = state.getState();
    if(currentState.remoteStream){
        currentState.remoteStream.getTracks().forEach((track)=> track.stop());
    }
};