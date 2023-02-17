import * as state from './state.js';


const remoteViewPlayer = document.getElementById('remote-view');
const localViewPlayer = document.getElementById('local-view');

export let setlocalViewSrc = (stream)=>{
    localViewPlayer.srcObject = stream;
}

export let setRemoteViewSrc = (stream)=>{
    remoteViewPlayer.srcObject = stream;
}