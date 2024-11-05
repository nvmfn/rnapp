import { MaterialIcons } from "@expo/vector-icons";
import { Text, View, Pressable } from "react-native";
import { mediaDevices, RTCView } from "react-native-webrtc";
import { useState } from "react";
import { JanusVideoCall } from "./JanusVideoCall";

export interface iVideoCallProps {}

let janusVideoCall: any;

export default function VideoCall(props: iVideoCallProps) {
  const [selfViewSrc, setSelfViewSrc] = useState<any>(null);
  const [remoteViewSrc, setRemoteViewSrc] = useState<any>(null);
  const [janusVideo, setJanusVideo] = useState<JanusVideoCall>();

  const [callStatus, setCallStatus] = useState<any>(null);

  const onRegister = async () => {
    let register = { request: "register", username: `me1` };
    janusVideoCall.videocall.send({ message: register });
  };

  const onInit = async () => {
    try {
      janusVideoCall = new JanusVideoCall();
      janusVideoCall.init({
        setLovalVideoStream: (stream: any) => {
          console.log("setLovalVideoStream", stream);

          setSelfViewSrc(stream.toURL());
        },
        setRemoteVideoStream: (stream: any) => {
          console.log("setRemoteVideoStream", stream);
          setRemoteViewSrc(stream.toURL());
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
      });
    } catch (err) {
      console.error("Error JanusVideoCall", err);
      // Handle Error
    }
  };

  const onDoCall = async (toUser = `me2`) => {
    // Call this user
    janusVideoCall.videocall.createOffer({
      // We want bidirectional audio and video, plus data channels
      tracks: [{ type: "audio", capture: true, recv: true }, { type: "video", capture: true, recv: true, simulcast: false }, { type: "data" }],
      success: function (jsep: any) {
        console.debug("Got SDP!", jsep);
        let body = { request: "call", username: toUser };
        janusVideoCall.videocall.send({ message: body, jsep: jsep });
        // Create a spinner waiting for the remote video
      },
      error: function (error: any) {
        console.error("WebRTC error...", error);
      },
    });
  };

  return (
    <View>
      <Text style={{ color: `#fff` }}>VideoCall ui will be here</Text>

      {/*  Show call status */}
      <Text style={{ color: `#f44` }}>{callStatus}</Text>

      <Pressable onPress={onInit}>
        <Text style={{ color: `#fff` }}>Btn: onInit</Text>
        <MaterialIcons name="add" size={38} color="#fff" />
      </Pressable>
      <Text style={{ color: `#fff`, paddingBottom: 10 }}>-----------------</Text>
      <Pressable onPress={onRegister}>
        <Text style={{ color: `#fff` }}>Btn: onRegister</Text>
      </Pressable>

      <Text style={{ color: `#fff`, paddingBottom: 10 }}>-----------------</Text>
      <Pressable onPress={(e) => onDoCall(`me2`)}>
        <Text style={{ color: `#fff` }}>Btn: onDoCall</Text>
      </Pressable>
      <Text style={{ color: `#fff`, paddingBottom: 10 }}>-----------------</Text>
      {selfViewSrc && (
        <>
          <Text style={{ color: `#fff` }}>selfViewSrc:</Text>
          <RTCView key={`selfViewSrcKey`} streamURL={selfViewSrc} style={{ width: 100, height: 100 }} />
        </>
      )}
      {remoteViewSrc && (
        <>
          <Text style={{ color: `#fff` }}>remoteViewSrc:</Text>
          <RTCView key={`remoteViewSrc`} streamURL={remoteViewSrc} style={{ width: 100, height: 100 }} />
        </>
      )}
    </View>
  );
}
