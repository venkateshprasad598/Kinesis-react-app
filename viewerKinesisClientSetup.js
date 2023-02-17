import * as state from './state.js';
import * as ui from './uiHandler.js'
const viewerState = {
    kinesisVideoClient: null,
    signalingClient: null,
    channelARN: null,
    peerConnectionByClientId:{},
    peerConnectionStatsInterval:null
};

let useTrickle = true;
 const kinesisVideoClient = new AWS.KinesisVideo({
    region:'ap-southeast-1',
    accessKeyId:'AKIAVZUUFVXYD5K6KZUK',
    secretAccessKey:'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'
});

export const startViewer = async ()=>{
    const describeSignalingChannel = await kinesisVideoClient.describeSignalingChannel({
        ChannelName:'av-test'
    }).promise();

    let channelARN = describeSignalingChannel.ChannelInfo.ChannelARN;
    console.log("VIEWER Channle ARN", channelARN);

        // Get Singaling Channel Enpoint Response
    const getSignalingChannelEndpointResponse = await kinesisVideoClient
    .getSignalingChannelEndpoint({
    ChannelARN: channelARN,
    SingleMasterChannelEndpointConfiguration: {
        Protocols: ['WSS', 'HTTPS'],
        Role: KVSWebRTC.Role.VIEWER,
    },
    })
    .promise();

    const endpointsByProtocol = getSignalingChannelEndpointResponse.ResourceEndpointList.reduce((endpoints, endpoint) => {
    endpoints[endpoint.Protocol] = endpoint.ResourceEndpoint;
    return endpoints;
    }, {});

    console.log('VIEWER Enpoints', endpointsByProtocol);


    const kinesisVideoSignalingChannelsClient = new AWS.KinesisVideoSignalingChannels({
        region: 'ap-southeast-1',
        accessKeyId:'AKIAVZUUFVXYD5K6KZUK',
        secretAccessKey:'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',
        sessionToken: '',
        endpoint: endpointsByProtocol.HTTPS,
        correctClockSkew: true,
    });
    const getIceServerConfigResponse = await kinesisVideoSignalingChannelsClient
        .getIceServerConfig({
            ChannelARN: channelARN,
        })
        .promise();
    const iceServers = [];
    //iceServers.push({ urls: `stun:stun.kinesisvideo.ap-southeast-1.amazonaws.com:443`});
    getIceServerConfigResponse.IceServerList.forEach((iceServer)=>
    iceServers.push({urls:iceServer.Uris,
        username:iceServer.Username,
        credential:iceServer.Password,
    }))

    console.log('VIEWER ICE Server',iceServers);

    let signalingClient =  new KVSWebRTC.SignalingClient({
        channelARN,
        channelEndpoint: endpointsByProtocol.WSS,
        clientId: Math.random()
        .toString(36)
        .substring(2)
        .toUpperCase(),
        role: KVSWebRTC.Role.VIEWER,
        region: 'ap-southeast-1',
        credentials: {
            accessKeyId:'AKIAVZUUFVXYD5K6KZUK',
            secretAccessKey:'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',
            sessionToken: '',
        },
        systemClockOffset: kinesisVideoClient.config.systemClockOffset,
    });

    const configuration = {
        iceServers,
        iceTransportPolicy:'relay'
    };

    const resolution = { width: { ideal: 640 }, height: { ideal: 480 } };

    const constraints = {
        video: resolution ,
        audio: true,
    };

    let peerConnection = new RTCPeerConnection(configuration);;

    viewerState.peerConnectionStatsInterval = setInterval(()=> peerConnection.getStats().then((stats)=>console.log("Peer connection stats",stats)),1000);

    signalingClient.on('open',async()=>{
        console.log('VIEWER connected to signaling service');
        // sending local stream to other users
        let currentState = state.getState();
        if(currentState.localStream){
            currentState.localStream.getTracks().forEach((track)=> peerConnection.addTrack(track,currentState.localStream));
        }
        console.log('VIEWER creating SDP offer');
        await peerConnection.setLocalDescription(
            await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
            }),
        );

        if(useTrickle){
           console.log('viewer sending SDP offer');
           signalingClient.sendSdpOffer(peerConnection.localDescription); 
        }
        console.log('VIEWER generating ice candidates');
    })

    signalingClient.on('sdpAnswer',async (answer)=>{
        console.log('VIEWER recieved SDP answer');
        await peerConnection.setRemoteDescription(answer);
    })

    signalingClient.on('iceCandidate',(candidate)=>{
        console.log('VIEWER recieved ICE candidate');
        peerConnection.addIceCandidate(candidate);
    })

    signalingClient.on('close',()=>{
        console.log('VIEWER disconnected from singaling channel');
    })

    signalingClient.on('error',(error)=>{
        console.log('VIEWER Signaling client error',error);
    })

    peerConnection.addEventListener('icecandidate',({candidate})=>{
        if(candidate){
            console.log('VIEWER Generated ICE Candidate');
            if(useTrickle){
                console.log('VIEWER Sending ICE candidate');
                signalingClient.sendIceCandidate(candidate);
            }
        }else{
            console.log('VIEWER All ICE candidates have been generated');
            // When trickle ICE is disabled, send the offer now that all the ICE candidates have ben generated.
            if (!useTrickle) {
                console.log('VIEWER Sending SDP offer');
                signalingClient.sendSdpOffer(peerConnection.localDescription);
            } 
        }
    })
    // Remote Stream Recieved adding it to state
    peerConnection.addEventListener('track',(event)=>{
        console.log("VIEWER Recieved remote track");
        state.setRemoteStream(event.streams[0]);
        // setting  UI remote stream
        ui.setRemoteViewSrc(event.streams[0]);
        console.log("After setting up remote track",state.getState());
    })

    console.log('VIEWER Starting viewer connection');
    viewerState.signalingClient = signalingClient;
    signalingClient.open();
};

export let stopViewer = async()=>{
    console.log('VIEWER Stopping viewer connection');
    if(viewerState.signalingClient){
        viewerState.signalingClient.close();
        viewerState.signalingClient = null;
    }
    if(viewerState.peerConnectionStatsInterval){
        clearInterval(viewerState.peerConnectionStatsInterval);
        viewerState.peerConnectionStatsInterval=null;
    }

};