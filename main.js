// handles all actions taken by the user on the page.
import * as state from "./state.js";
import * as rtcHandler from "./rtcHandler.js";
import * as master from "./masterKinesisClientSetup.js";
import * as viewer from "./viewerKinesisClientSetup.js";
import * as ui from './uiHandler.js';



// check if start stop button was pressed
const start_stop_button=document.getElementById("start_stop_audio_video");

start_stop_button.addEventListener("click",()=>{
    console.log("start stop button pressed");
    state.toggleAudioVideoState();

    let currentState = state.getState();

    if(currentState.audio_video){
        console.log("User started the audio video stream");
        // setup local stream
        rtcHandler.onLoadCreateSteam();
        // setup kinesis stream and send data to kinesis stream
        currentState=state.getState();
        console.log("state function",currentState);

    }else{
        // change the ui state
        console.log("state function",currentState);
        // stop the media tracks
        rtcHandler.stopTracks();
        //updating state
        state.setLocalStream(null);
        console.log(state.getState());
        ui.setlocalViewSrc(null);
    }
});

const create_signaling_stream_button = document.getElementById("create_signaling_channel");

create_signaling_stream_button.addEventListener("click",async ()=>{
    console.log("STARTING CALL");
    await master.createSingallingChannel('av-test');
    console.log("Created the channel, next it shoudl use lambda to notify other users about the call");
});


const join_as_master_button = document.getElementById("join_call_master");

join_as_master_button.addEventListener("click",async ()=>{
    console.log("Joining call as master");
    await master.startMaster();
});

const stop_as_master_button = document.getElementById("stop_call_master");

stop_as_master_button.addEventListener("click",async()=>{
    //stop sending data as master 
    master.stopMaster();
    // stop media tracks
    rtcHandler.stopTracks();
    state.setLocalStream(null);
    // stop remote media tracks
    rtcHandler.stopRemoteTracks();
    state.setRemoteStream(null);
    // ui to be updated to null src for videos
    ui.setRemoteViewSrc(null);
    ui.setlocalViewSrc(null);

});


const join_call_viewer_button = document.getElementById('join_call_viewer');

join_call_viewer_button.addEventListener("click",async()=>{
    console.log("Joining call as viewer");
    await viewer.startViewer();
});

const stop_as_viewer_button= document.getElementById('stop_call_viewer');

stop_as_viewer_button.addEventListener('click',async()=>{
    // stop sending data as viewer
    viewer.stopViewer();
    // stop media tracks
    rtcHandler.stopTracks();
    state.setLocalStream(null);
    // stop remote media tracks
    rtcHandler.stopRemoteTracks();
    state.setRemoteStream(null);
    // ui to be changeed to null 
    ui.setRemoteViewSrc(null);
    ui.setlocalViewSrc(null);
})