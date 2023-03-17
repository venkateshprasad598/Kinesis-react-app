let state = {
  localStream: null,
  remoteStream: null,
  kinesisVideoClient: null,
  audio_video: false,
};

export const setLocalStream = (stream) => {
  state = {
    ...state,
    localStream: stream,
  };
};

export const setRemoteStream = (stream) => {
  state = {
    ...state,
    remoteStream: stream,
  };
};

export const setKinesisVideoClient = (kvc) => {
  state = {
    ...state,
    kinesisVideoClient: kvc,
  };
};

export const toggleAudioVideoState = () => {
  if (state.audio_video) {
    state.audio_video = false;
  } else {
    state.audio_video = true;
  }
};

export const getState = () => {
  return state;
};
