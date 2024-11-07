import { MaterialIcons } from "@expo/vector-icons";
import { Text, View, Pressable } from "react-native";
import { mediaDevices, RTCView } from "react-native-webrtc";
import { useState } from "react";
import { iMediaDevice, JanusVideoCall } from "./JanusVideoCall";

export interface iVideoCallProps {}

let janusVideoCall: JanusVideoCall = new JanusVideoCall();

const btnStyles = {
  backgroundColor: `#ccc`,
  padding: 10,
  borderRadius: 5,
  margin: 5,
  borderColor: `#fff`,
};

const splitterStyles = {
  color: `#fff`,
  paddingBottom: 10,
};

export default function VideoCall(props: iVideoCallProps) {
  const [myName, setMyName] = useState<string>();
  const [isInit, setIsInit] = useState<boolean>(false);
  const [devices, setDevices] = useState<any[]>([]);

  const [selfViewSrc, setSelfViewSrc] = useState<any>(null);
  const [remoteViewSrc, setRemoteViewSrc] = useState<any>(null);

  const [callStatus, setCallStatus] = useState<any>(null);
  const [isVideoOn, setIsVideoOn] = useState<boolean>(false);
  const [isAudioOn, setIsAudioOn] = useState<boolean>(true);

  const onRegister = async (username: string) => {
    setMyName(username);
    let register = { request: "register", username: username };
    janusVideoCall.videocall.send({ message: register });
  };

  const onInit = async () => {
    try {
      await janusVideoCall.init({
        bandwidth: {
          // Decrease bandwidth and video/audio quality
          // Set 0 for unlimited quality
          audio: 8,
          video: 16,
        },
        setLocalVideoStream: (stream: any, trackId: any) => {
          console.log("setLocalVideoStream", trackId, stream);
          setSelfViewSrc(stream.toURL());
        },
        removeLocalVideoStream: function (trackId: any): void {
          console.log("removeLocalVideoStream", trackId);
          // setSelfViewSrc(null);
        },
        setRemoteStream: (stream: any, mid: any, kind: `audio` | `video`) => {
          console.log("setRemoteVideoStream", stream, mid, kind);
          setRemoteViewSrc(stream.toURL());
        },
        removeRemoteStream: (mid: any) => {
          console.log("removeRemoteStream", mid);
          // setRemoteViewSrc(null);
        },
        onWaitingForAnswer: () => {
          console.log("onWaitingForAnswer");
          setCallStatus(`onWaitingForAnswer`);
        },
        onAcceptedCall: () => {
          console.log("onAcceptedCall");
          setCallStatus(`onAcceptedCall`);
        },
        onNewWebrtcState: (e: any) => {
          console.log("onNewWebrtcState", e);
          setCallStatus(`onNewWebrtcState:: ${e}`);
        },
        onNewMediaState: (medium: any, on: any, mid: any) => {
          console.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium + " (mid=" + mid + ")");
          setCallStatus("Janus " + (on ? "started" : "stopped") + " receiving our " + medium + " (mid=" + mid + ")");
        },
        onIncomingCall: (allow: any, hangup: any) => {
          allow(); // auto-accept
        },
        onCleanup: function (): void {
          console.log("ToDo: onCleanup ui");
        },
      });

      const devices = await janusVideoCall.getListDevices();
      setDevices(devices);

      setIsInit(true);
    } catch (err) {
      console.error("Error JanusVideoCall", err);
      // Handle Error
      setIsInit(false);
    }
  };

  const onDoCall = async (toUser: string) => {
    janusVideoCall.onDoCall(toUser);
  };

  const replaceTracks = async (target: iMediaDevice) => {
    janusVideoCall.replaceTracks(target);
  };

  if (!isInit) {
    return (
      <View>
        <Text style={{ color: `#fff` }}>VideoCall ui will be here</Text>
        <Pressable onPress={onInit}>
          <Text style={btnStyles}>Init</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      {/*  Show call status */}
      <Text style={{ color: `#f44` }}>{callStatus}</Text>

      {!myName && (
        <>
          <Text style={splitterStyles}>-----------------</Text>
          <Pressable onPress={(e) => onRegister(`me1`)}>
            <Text style={btnStyles}>Register as me1</Text>
          </Pressable>
          <Pressable onPress={(e) => onRegister(`me2`)}>
            <Text style={btnStyles}>Register as me2</Text>
          </Pressable>
        </>
      )}

      <Text style={splitterStyles}>-----------------</Text>
      {myName === `me1` && (
        <Pressable onPress={(e) => onDoCall(`me2`)}>
          <Text style={btnStyles}>Call to me2</Text>
        </Pressable>
      )}
      {myName === `me2` && (
        <Pressable onPress={(e) => onDoCall(`me1`)}>
          <Text style={btnStyles}>Call to me1</Text>
        </Pressable>
      )}

      <Text style={splitterStyles}>-----------------</Text>

      {remoteViewSrc && (
        <>
          <Text style={{ color: `#fff` }}>remoteViewSrc:</Text>
          <RTCView key={`remoteViewSrc`} streamURL={remoteViewSrc} style={{ width: 100, height: 100 }} />
        </>
      )}
      {selfViewSrc && (
        <>
          <Text style={{ color: `#fff` }}>selfViewSrc:</Text>
          <RTCView key={`selfViewSrcKey`} streamURL={selfViewSrc} style={{ width: 100, height: 100 }} />
          <Pressable onPress={(e) => setIsVideoOn(janusVideoCall.toogleVideo())}>
            <Text style={btnStyles}>My Video {isVideoOn ? `on` : `off`}</Text>
          </Pressable>
          <Pressable onPress={(e) => setIsAudioOn(janusVideoCall.toogleAudio())}>
            <Text style={btnStyles}>My Audio {isAudioOn ? `on` : `off`}</Text>
          </Pressable>
        </>
      )}
      <Pressable onPress={janusVideoCall.doHangup}>
        <Text style={btnStyles}>Hangup</Text>
      </Pressable>
      {devices
        .filter((d) => d.kind === `videoinput`)
        .map((d) => {
          return (
            <Pressable key={d.deviceId} onPress={() => replaceTracks(d)}>
              <Text style={btnStyles}>Use {d.facing}</Text>
            </Pressable>
          );
        })}
    </View>
  );
}
