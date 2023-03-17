import React, { useState } from "react";
import * as state from "../states/state";

const ConvertToReact = () => {

  // START AUDIO AND VIDEO STREAM STATE
  const [localViewSrc, setlocalViewSrc] = useState<any>("");
  console.log({ localViewSrc });

  // START AUDIO AND VIDEO STREAM FUNCTION
  let onLoadCreateSteam = () => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices: any) => {
        const videoDevice: any = devices.find(
          (device: any) => device.kind === "videoinput"
        );
        const audioDevice: any = devices.find(
          (device: any) => device.kind === "audioinput"
        );
        console.log({ videoDevice, audioDevice });

        return navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: audioDevice?.deviceId ? videoDevice?.deviceId : "",
          },
          audio: {
            deviceId: audioDevice?.deviceId ? audioDevice?.deviceId : "",
          },
        });
      })
      .then((stream) => {
        console.log("Setting the stream");
        state.setLocalStream(stream);
        setlocalViewSrc(stream);
      })
      .catch((err) => console.log(err));
  };

  let stopTracks = () => {
    let currentState: any = state.getState();
    currentState.localStream.getTracks().forEach((track: any) => track.stop());
  };

  let stopRemoteTracks = () => {
    let currentState: any = state.getState();
    if (currentState?.remoteStream) {
      currentState?.remoteStream
        ?.getTracks()
        ?.forEach((track: any) => track.stop());
    }
  };

  const handleStartStopAudioVideo = async () => {
    console.log("start stop button pressed");
    state.toggleAudioVideoState();

    let currentState = state.getState();

    if (currentState.audio_video) {
      console.log("User started the audio video stream");
      // setup local stream
      onLoadCreateSteam();
      // setup kinesis stream and send data to kinesis stream
      currentState = state.getState();
      console.log("state function", currentState);
    } else {
      // change the ui state
      // state = {
      //   localStream: null,
      //   remoteStream: null,
      //   kinesisVideoClient: null,
      //   audio_video: true,
      // };
      console.log("state function", currentState);
      // stop the media tracks
      stopTracks();
      //updating state
      state.setLocalStream(null);
      console.log(state.getState());
      setlocalViewSrc(null);
    }
  };
  return (
    <div style={{ background: "red", padding: "20px", color: "white" }}>
      <button id="create_signaling_channel">Create Channel (Start Call)</button>
      <br />
      <h3>Audio Controls</h3>
      <button id="start_stop_audio_video" onClick={handleStartStopAudioVideo}>
        Start Audio Video Stream
      </button>
      <br />
      <h3>Master Controls</h3>
      <button id="join_call_master">
        Join call as master (call initiator){" "}
      </button>
      <button id="stop_call_master">
        End call as Master (call intiator ending)
      </button>
      <br />
      <h3>Viewer Controls</h3>
      <button id="join_call_viewer">Join Call as Viewer (call reciever)</button>
      <button id="stop_call_viewer">End call as Viewer (call ending)</button>
      <br />
      <h5>Caller View</h5>
      <div className="video-container">
        <video
          id="remote-view"
          src={localViewSrc}
          // autoplay
          // playsinline
          controls
        />
      </div>
      <h5>Your View</h5>
      <div className="video-container">
        <video id="local-view" src={localViewSrc} controls muted />
      </div>
    </div>
  );
};

export default ConvertToReact;
