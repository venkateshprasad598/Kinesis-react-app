import * as state from './state.js';
import * as kinesisVideo from 'https://unpkg.com/amazon-kinesis-video-streams-webrtc/dist/kvs-webrtc.min.js';
import * as ui from './uiHandler.js';
const masterState = {
    kinesisVideoClient: null,
    signalingClient: null,
    channelARN: null,
    peerConnectionByClientId:{},
    peerConnectionStatsInterval:null
};

const trickleIce = true;
const kinesisVideoClient = new AWS.KinesisVideo({
    region:'ap-southeast-1',
    accessKeyId:'AKIAVZUUFVXYD5K6KZUK',
    secretAccessKey:'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'
});

export const startMaster = async ()=>{
    // creating a singaling channel
    //const createSignalChannelResponse = await createSingallingChannel('av-test');
    console.log('CREATING singaling channel');
    // get signaling channel arn
    const describeSignalingChannel = await kinesisVideoClient.describeSignalingChannel({
        ChannelName:'av-test'
    }).promise();
    let channelARN = describeSignalingChannel.ChannelInfo.ChannelARN;
    console.log("MASTER Channle ARN", channelARN);

    // Get Singaling Channel Enpoint Response
    const getSignalingChannelEndpointResponse = await kinesisVideoClient
        .getSignalingChannelEndpoint({
            ChannelARN: channelARN,
            SingleMasterChannelEndpointConfiguration: {
                Protocols: ['WSS', 'HTTPS'],
                Role: KVSWebRTC.Role.MASTER,
            },
        })
        .promise();

    const endpointsByProtocol = getSignalingChannelEndpointResponse.ResourceEndpointList.reduce((endpoints, endpoint) => {
        endpoints[endpoint.Protocol] = endpoint.ResourceEndpoint;
        return endpoints;
    }, {});

    console.log('MASTER Enpoints', endpointsByProtocol);

    // SETUP Signaling Client
    let signalingClient =  new KVSWebRTC.SignalingClient({
        channelARN,
        channelEndpoint: endpointsByProtocol.WSS,
        role: KVSWebRTC.Role.MASTER,
        region: 'ap-southeast-1',
        credentials: {
            accessKeyId:'AKIAVZUUFVXYD5K6KZUK',
            secretAccessKey:'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',
            sessionToken: '',
        },
        systemClockOffset: kinesisVideoClient.config.systemClockOffset,
    });
    
     // Get ICE server configuration
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
    iceServers.push({ urls: `stun:stun.kinesisvideo.ap-southeast-1.amazonaws.com:443`});

    getIceServerConfigResponse.IceServerList.forEach((iceServer)=>
    iceServers.push({urls:iceServer.Uris,
        username:iceServer.Username,
        credential:iceServer.Password,
    }))

    console.log('MASTER ICE Server',iceServers);

    const configuration = {
        iceServers,
        iceTransportPolicy:'relay'
    };

    const resolution = { width: { ideal: 640 }, height: { ideal: 480 } };

    const constraints = {
        video: resolution ,
        audio: true,
    };

    // local stream set by main.js
    signalingClient.on('open',async()=>{
        console.log('MASTER is connected to signaling server');
    })

    signalingClient.on('sdpOffer',async(offer,remotClientId)=>{
        console.log('MASTER recieved SDP offer from client',remotClientId);
        // create new peer connection usng the offer from the client
        const peerConnection = new RTCPeerConnection(configuration);
        masterState.peerConnectionByClientId[remotClientId]=peerConnection;

        // can be avoided
        if(!masterState.peerConnectionStatsInterval){
            // assign a periodic funttion to check stats of peer every one second
            masterState.peerConnectionStatsInterval = setInterval(() => peerConnection.getStats().then((stats)=>console.log("Peer Connection Stats")), 1000);
        }

        peerConnection.addEventListener('icecandidate',({candidate})=>{
            if(candidate){
                console.log("MASTER generated ICE Candidate for client", remotClientId);
                // using trickle ice 
                if(trickleIce){
                    console.log('MASTER Sending ICE candidate to client',remotClientId);
                    signalingClient.sendIceCandidate(candidate, remotClientId);;
                }else{
                    console.log("All ICE candidates have been generated for client".remotClientId);
                    if(!trickleIce){
                        console.log("Sending Sending SDP answer to client", remotClientId);
                        signalingClient.sendSdpAnswer(peerConnection.localDescription,remotClientId);
                    }
                }
            }
        });

        // Remote tracks been recieved, adding them to remote view 
        peerConnection.addEventListener('track',(event)=>{
            console.log("MASTER adding remote track for",remotClientId);
            state.setRemoteStream(event.streams[0]);
            // ui to set view stream
            ui.setRemoteViewSrc(event.streams[0]);
            console.log("After Setting up remote track", state.getState());
        });

        let currentState = state.getState();

        if(currentState.localStream){
            currentState.localStream.getTracks().forEach((track)=> peerConnection.addTrack(track,currentState.localStream));
        }

        await peerConnection.setRemoteDescription(offer);
        console.log("MASTER preparing SDP answer for client", remotClientId);

        await peerConnection.setLocalDescription(            
            await peerConnection.createAnswer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
        }));

        if(trickleIce){
            console.log('MASTER sending SDP asnwer to client',remotClientId);
            signalingClient.sendSdpAnswer(peerConnection.localDescription,remotClientId);
        }
        console.log('MASTER Generating ICE candidates for client', remotClientId);
    })

    signalingClient.on('iceCandidate',async (candidate,remoteClientId)=>{
        console.log('MASTER Recieved ICE candidate from client', remoteClientId);
        const peerConnection = masterState.peerConnectionByClientId[remoteClientId];
        peerConnection.addIceCandidate(candidate);
    })

    signalingClient.on('close',()=>{
        console.log('MASTER Disconnected from singaling channel');
    });

    signalingClient.on('error',()=>{
        console.log('MASTER Signaling client error');
    })

    console.log("Master starting connection");
    masterState.signalingClient = signalingClient;
    signalingClient.open();
    
};

export const stopMaster = ()=>{
    console.log("Master Stopping the master Connection");
    if(masterState.signalingClient){
        masterState.signalingClient.close();
        masterState.signalingClient=null;
    }

    Object.keys(masterState.peerConnectionByClientId).forEach(clientId=>{
        masterState.peerConnectionByClientId[clientId].close();
    });
    masterState.peerConnectionByClientId=[];

    if(masterState.peerConnectionStatsInterval){
        clearInterval(masterState.peerConnectionStatsInterval);
        masterState.peerConnectionStatsInterval=null;
    }

}


export const createSingallingChannel = async (channelName)=>{
    const createSignalChannelResponse = await kinesisVideoClient.createSignalingChannel({
        ChannelName:channelName ,// masterId-groupId/userId
        ChannelType:"SINGLE_MASTER"
      }).promise();

      console.log("MASTER CHANNEL SETUP", createSignalChannelResponse);
      return createSignalChannelResponse;
};

const deleteChannel = async ()=>{
    let currentState = state.getState();

    const describeSignalingChannelResponse = await kinesisVideoClient.describeSignalingChannel(
        {
            ChannelName:'av-test'
        }).promise();
    const channelARN = describeSignalingChannelResponse.ChannelInfo.ChannelARN;

    await kinesisVideoClient.deleteSignalingChannel({
        ChannelARN:`${channelARN}`
    }).promise();
};