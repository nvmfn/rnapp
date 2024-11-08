// const Janus = require("./Janus.js");
// import * as Janus from "./Janus.js";
// import { Janus } from "./janus";
import { Janus } from "./janusLast";

interface iBandwidth {
  audio: number;
  video: number;
}
/**
 * Update the bandwidth in SDP
 * @param opt
 * @param event
 * @returns
 * @example setBandwidth({ audio: 16, video: 64 }, jsep);
 */
function setBandwidth(opt: iBandwidth, event: any) {
  // console.info("sdp", event);
  // console.info("sdp old", event.sdp);
  //event.sdp = event.sdp.replace(/b=AS:[0-9]+\r\n/g, "") // CT | AS  https://tools.ietf.org/html/rfc4566#section-5.8

  if (opt.video > 0) {
    event.sdp = event.sdp.replace(/b=AS:[0-9]+\r\n/g, "");
  }

  if (opt.video > 0) {
    event.sdp = event.sdp.replace(/m=video(.*)\r\n/g, "m=video$1\r\nb=AS:" + opt.video + "\r\n");
  }
  if (opt.audio > 0) {
    event.sdp = event.sdp.replace(/m=audio(.*)\r\n/g, "m=audio$1\r\nb=AS:" + opt.audio + "\r\n");
  }

  // console.info("sdp set bandwidth", { audio: opt.audio, video: opt.video });
  // console.info("sdp new", event.sdp);
  return event;
}

// Helper to escape XML tags
function escapeXmlTags(value: string): string {
  let escapedValue = String(value).replace(new RegExp("<", "g"), "&lt");
  escapedValue = escapedValue.replace(new RegExp(">", "g"), "&gt");
  return escapedValue;
}

function randomString(len: number): string {
  let charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let randomString = "";
  for (let i = 0; i < len; i++) {
    let randomPoz = Math.floor(Math.random() * charSet.length);
    randomString += charSet.substring(randomPoz, randomPoz + 1);
  }
  return randomString;
}

const iceServers = [{ urls: ["stun:stun.l.google.com:19302"] }];

interface iJanusVideoCallProps {
  /**
   * If remote stream is added
   * @param stream
   * @param mid - stream id
   * @param kind - audio | video
   * @returns
   */
  setRemoteStream: (stream: any, mid: any, kind: `audio` | `video`) => void;
  /**
   * If remote stream is removed
   * @param mid - stream id
   * @param kind
   * @returns
   */
  removeRemoteStream: (mid: any, kind: `audio` | `video`) => void;
  /**
   * Cleanup
   */
  onCleanup: () => void;
  onNewMediaState: (medium: any, on: any, mid: any) => void;
  setLocalVideoStream: (stream: any, trackId: string) => void;
  removeLocalVideoStream: (trackId: any) => void;
  onWaitingForAnswer: () => void;
  onAcceptedCall: () => void;
  onNewWebrtcState: (on: any) => void;
  onIncomingCall: (allow: Function, hangup: Function) => void;
  bandwidth?: iBandwidth;
}

export interface iMediaDevice {
  deviceId: string;
  facing: string;
  groupId: string;
  kind: string;
  label: string;
}

export type iFacingMode = "environment" | `front`;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class JanusVideoCall {
  public videocall: any = null;
  private opaqueId = "videocalltest-" + randomString(12);

  private localTracks: any = {};
  private localVideos = 0;
  private remoteTracks: any = {};
  private remoteVideos = 0;
  private bitrateTimer: any = null;

  /**
   * Default bandwidth
   * Allow to decrease the traffic bandwidth
   * By default, the bandwidth is set to 0, which means that the bandwidth is not limited
   */
  private bandwidth: iBandwidth = { audio: 0, video: 0 };

  private audioenabled = false;
  private videoenabled = false;
  private isInCall: boolean = false;

  private myusername = null;
  private yourusername: any = "";

  private doSimulcast: boolean = false;
  private simulcastStarted: any = false;
  private janus: any = null;

  public getListDevices = async (): Promise<iMediaDevice[]> => {
    return new Promise((resolve, reject) => {
      try {
        // @ts-ignore
        Janus.listDevices((devices: any) => {
          console.log(`devices`, devices);
          resolve(devices);
        });
      } catch (e) {
        console.error(`getListDevices error`, e);
      }
    });
  };

  public janusDestroy = async () => {
    this.janus.destroy();
  };

  public showSDPinLogs = false;

  /**
   * Call to answer
   */
  public answerToCall: any = null;

  /**
   * @param bitrate - 0, 128, 256, 512, 1500, 2000
   * @returns
   */
  public setBitrate = (bitrate: number) => {
    if (this.videocall) {
      this.videocall.send({ message: { request: "set", bitrate: bitrate } });
      return true;
    }
    return false;
  };
  public toogleVideo = (value?: boolean) => {
    this.videoenabled = value === undefined ? !this.videoenabled : value;
    if (this.videocall) {
      this.videocall.send({ message: { request: "set", video: this.videoenabled } });
    }
    return this.videoenabled;
  };

  public toogleAudio = (value?: boolean) => {
    this.audioenabled = value === undefined ? !this.audioenabled : value;
    if (this.videocall) {
      this.videocall.send({ message: { request: "set", audio: this.audioenabled } });
    }
    return this.audioenabled;
  };

  public doHangup = () => {
    // Hangup a call
    if (this.videocall) {
      this.videocall.send({ message: { request: "hangup" } });
      this.videocall.hangup();
      console.log(`doHangup: done`);
      return true;
    }
    console.warn(`doHangup: not in call`);
    return true;
  };

  public replaceTracks = async (target: iMediaDevice) => {
    // janusVideoCall.onDoCall(toUser);
    console.log(`replaceTracks to`, target);
    this.videocall.replaceTracks({
      tracks: [
        {
          type: "video",
          facingMode: target.facing,
          capture: true,
          recv: true,
        },
        { type: "audio", capture: true, recv: true },
      ],
    });
    this.toogleVideo(true);
  };

  private lastCallName: string = "";
  /**
   * Call this user
   * @param toUser - user name
   * @returns
   */
  public onDoCall = async (toUser: string, facingMode?: iFacingMode, noVideo = false) => {
    this.lastCallName = toUser;
    this.isInCall = true;
    // const videocall = this.videocall;
    return new Promise((resolve, reject) => {
      // Call this user

      const video: any = {
        type: "video",
        capture: true,
        recv: true,
        simulcast: false,
      };
      if (facingMode) {
        video.facingMode = facingMode;
      }

      this.videocall.createOffer({
        // We want bidirectional audio and video, plus data channels
        tracks: [{ type: "audio", capture: true, recv: true }, video, { type: "data" }],
        success: (jsep: any) => {
          let body = { request: "call", username: toUser };

          this.videocall.send({ message: body, jsep: jsep });
          // Create a spinner waiting for the remote video

          if (noVideo) {
            this.toogleVideo(false);
          }

          resolve(true);
        },
        error: (error: any) => {
          console.error("WebRTC error...", error);
          reject(error);
        },
      });
    });
  };

  public init = async (props: iJanusVideoCallProps) => {
    if (props.bandwidth) {
      this.bandwidth = props.bandwidth;
    }

    return new Promise((resolve, reject) => {
      // Initialize the library (console debug enabled)
      let janus: any = this.janus;
      const opt = {
        server: "ws://api.imbachat.com:8188/ws",
        // server: "wss://api.imbachat.com:8989/ws",
        //   server: "wss://janus.conf.meetecho.com:8188/ws",
        onInitError: () => {},
        onDestroyed: () => {},
        onNewState: (name: any) => {
          console.log(`onNewState`, name);
        },
      };

      console.log("Janus.init... ");
      Janus.init({
        debug: true,
        callback: () => {
          console.log("Janus.init callback ... ");

          // Make sure the browser supports WebRTC
          if (!Janus.isWebrtcSupported()) {
            console.log("No WebRTC support... ");
            reject(`No WebRTC support`);
            return;
          }

          // Create session
          janus = new Janus({
            server: opt.server,
            iceServers: iceServers,
            // Should the Janus API require authentication, you can specify either the API secret or user token here too
            //		token: "mytoken",
            //	or
            //		apisecret: "serversecret",
            success: () => {
              // Attach to VideoCall plugin
              this.janus.attach({
                plugin: "janus.plugin.videocall",
                opaqueId: this.opaqueId,
                success: (pluginHandle: any) => {
                  // $("#details").remove();
                  this.videocall = pluginHandle;
                  console.log("Plugin attached! (" + this.videocall.getPlugin() + ", id=" + this.videocall.getId() + ")");
                  // Prepare the username registration
                  // $("#videocall").removeClass("hide");
                  // $("#login").removeClass("invisible");
                  // $("#registernow").removeClass("hide");
                  // $("#register").click(registerUsername);
                  // $("#username").focus();
                  // $("#start")
                  //   .removeAttr("disabled")
                  //   .html("Stop")
                  //   .click(  () => {
                  //     $(this).attr("disabled", true);
                  //     janus.destroy();
                  //   });
                },
                error: (error: any) => {
                  console.error("  -- Error attaching plugin...", error);
                  console.log("  -- Error attaching plugin... " + error);
                },
                consentDialog: (on: any) => {
                  console.info("Consent dialog should be " + (on ? "on" : "off") + " now");
                  // if (on) {
                  //   // Darken screen and show hint
                  //   $.blockUI({
                  //     message: '<div><img src="up_arrow.png"/></div>',
                  //     baseZ: 3001,
                  //     css: {
                  //       border: "none",
                  //       padding: "15px",
                  //       backgroundColor: "transparent",
                  //       color: "#aaa",
                  //       top: "10px",
                  //       left: "100px",
                  //     },
                  //   });
                  // } else {
                  //   // Restore screen
                  //   $.unblockUI();
                  // }
                },
                iceState: (state: any) => {
                  console.log("ICE state changed to " + state);
                },
                mediaState: (medium: any, on: any, mid: any) => {
                  console.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium + " (mid=" + mid + ")");
                  props.onNewMediaState(medium, on, mid);
                },
                webrtcState: (on: any) => {
                  console.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
                  props.onNewWebrtcState(on);
                  // $("#videoleft").parent().unblock();
                },
                slowLink: (uplink: any, lost: any, mid: any) => {
                  // console.warn("Janus reports problems " + (uplink ? "sending" : "receiving") + " packets on mid " + mid + " (" + lost + " lost packets)");
                },
                onmessage: (msg: any, jsep: any) => {
                  if (jsep) {
                    setBandwidth(this.bandwidth, jsep);
                  }

                  console.info(" ::: Got a message :::", msg);
                  let result = msg["result"];
                  if (result) {
                    if (result["list"]) {
                      let list = result["list"];
                      console.info("Got a list of registered peers:", list);
                      for (let mp in list) {
                        console.info("  >> [" + list[mp] + "]");
                      }
                    } else if (result["event"]) {
                      let event = result["event"];
                      if (event === "registered") {
                        let myusername = escapeXmlTags(result["username"]);
                        console.log("Successfully registered as " + myusername + "!");
                        //   $("#youok")
                        //     .removeClass("hide")
                        //     .html("Registered as '" + myusername + "'");
                        // Get a list of available peers, just for fun
                        this.videocall.send({ message: { request: "list" } });
                        // Enable buttons to call now
                      } else if (event === "calling") {
                        console.log("Waiting for the peer to answer...");
                        props.onWaitingForAnswer();
                      } else if (event === "incomingcall") {
                        console.log("Incoming call from " + result["username"] + "!");
                        this.yourusername = escapeXmlTags(result["username"]);
                        // Notify user

                        this.answerToCall = () => {
                          //   $("#peer").val(result["username"]).attr("disabled", true);
                          this.videocall.createAnswer({
                            jsep: jsep,
                            // We want bidirectional audio and video, if offered,
                            // plus data channels too if they were negotiated
                            tracks: [{ type: "audio", capture: true, recv: true }, { type: "video", capture: true, recv: true }, { type: "data" }],
                            success: (jsep: any) => {
                              if (this.showSDPinLogs) {
                                console.info("Got SDP!", jsep);
                              }
                              let body = { request: "accept" };

                              this.videocall.send({ message: body, jsep: jsep });
                            },
                            error: (error: any) => {
                              console.error("WebRTC error:", error);
                              console.log("WebRTC error... " + error.message);
                            },
                          });
                        };

                        props.onIncomingCall(
                          () => this.answerToCall(),
                          () => this.doHangup()
                        );
                      } else if (event === "accepted") {
                        let peer = escapeXmlTags(result["username"]);
                        if (!peer) {
                          console.log("Call started!");
                        } else {
                          console.log(peer + " accepted the call!");
                          props.onAcceptedCall();

                          this.yourusername = peer;
                        }
                        // Video call can start
                        if (jsep) {
                          this.videocall.handleRemoteJsep({ jsep: jsep });
                        }
                        //   $("#call").removeAttr("disabled").html("Hangup").removeClass("btn-success").addClass("btn-danger").unbind("click").click(doHangup);
                      } else if (event === "update") {
                        // An 'update' event may be used to provide renegotiation attempts
                        if (jsep) {
                          if (jsep.type === "answer") {
                            this.videocall.handleRemoteJsep({ jsep: jsep });
                          } else {
                            this.videocall.createAnswer({
                              jsep: jsep,
                              // We want bidirectional audio and video, if offered,
                              // plus data channels too if they were negotiated
                              tracks: [{ type: "audio", capture: true, recv: true }, { type: "video", capture: true, recv: true }, { type: "data" }],
                              success: (jsep: any) => {
                                if (this.showSDPinLogs) {
                                  console.info("Got SDP!", jsep);
                                }
                                let body = { request: "set" };

                                this.videocall.send({ message: body, jsep: jsep });
                              },
                              error: (error: any) => {
                                console.error("WebRTC error:", error);
                                console.log("WebRTC error... " + error.message);
                              },
                            });
                          }
                        }
                      } else if (event === "hangup") {
                        console.log("Call hung up by " + result["username"] + " (" + result["reason"] + ")!");
                        // Reset status

                        this.videocall.hangup();
                      } else if (event === "simulcast") {
                        // Is simulcast in place?
                        let substream = result["substream"];
                        let temporal = result["temporal"];
                        if ((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
                          console.error("Simulcast is not implemented yet", substream, temporal);
                          // @ToDo: Uncomment code and implement simulcast later
                          // if (!this.simulcastStarted) {
                          //   this.simulcastStarted = true;
                          //   addSimulcastButtons(result["videocodec"] === "vp8");
                          // }
                          // // We just received notice that there's been a switch, update the buttons
                          // updateSimulcastButtons(substream, temporal);
                        }
                      }
                    }
                  } else {
                    // FIXME Error?
                    let error = msg["error"];
                    console.log(`error-message::`, error);
                    if (error.indexOf("already taken") > 0) {
                      // FIXME Use status codes...
                      // $("#username").removeAttr("disabled").val("");
                      // $("#register").removeAttr("disabled").unbind("click").click(registerUsername);
                    }
                    // TODO Reset status
                    this.videocall.hangup();
                    if (this.bitrateTimer) {
                      clearInterval(this.bitrateTimer);
                    }
                    this.bitrateTimer = null;
                  }
                },
                onlocaltrack: (track: any, on: any) => {
                  // ---------- onlocaltrack
                  console.info("Local track " + (on ? "added" : "removed") + ":", track);
                  // props.setLocalVideoStream(track);

                  // We use the track ID as name of the element, but it may contain invalid characters
                  const trackId: string = track.id.replace(/[{}]/g, "");
                  if (!on) {
                    // Track removed, get rid of the stream and the rendering
                    let stream = this.localTracks[trackId];
                    if (stream) {
                      try {
                        let tracks = stream.getTracks();
                        for (let i in tracks) {
                          let mst = tracks[i];
                          if (mst !== null && mst !== undefined) mst.stop();
                        }
                      } catch (e) {
                        console.error(`onlocalstream`, e);
                      }
                    }
                    if (track.kind === "video") {
                      // $("#myvideo" + trackId).remove();
                      this.localVideos--;
                      if (this.localVideos === 0) {
                        // No video, at least for now: show a placeholder
                      }
                    }
                    props.removeLocalVideoStream(trackId);
                    delete this.localTracks[trackId];
                    return;
                  }
                  // If we're here, a new track was added
                  let stream = this.localTracks[trackId];
                  if (stream) {
                    // We've been here already
                    return;
                  }

                  if (track.kind === "audio") {
                    // We ignore local audio tracks, they'd generate echo anyway
                    if (this.localVideos === 0) {
                      // No video, at least for now: show a placeholder
                    }
                  } else {
                    // New video track: create a stream out of it
                    this.localVideos++;
                    //   $("#videoleft .no-video-container").remove();
                    stream = new MediaStream([track]);
                    this.localTracks[trackId] = stream;
                    console.log("Created local stream:", stream);

                    props.setLocalVideoStream(stream, trackId);
                  }
                  // if (this.videocall.webrtcStuff.pc.iceConnectionState !== "completed" && this.videocall.webrtcStuff.pc.iceConnectionState !== "connected") {
                  console.log(`videoleft: Publishing...`);
                },
                // old / new name  onremotetrack
                onremotetrack: (track: any, mid: any, on: any, metadata: any) => {
                  console.info("Remote track (mid=" + mid + ") " + (on ? "added" : "removed") + (metadata ? " (" + metadata.reason + ") " : "") + ":", track);

                  if (!on) {
                    props.removeRemoteStream(mid, track?.kind);
                    // Track removed, get rid of the stream and the rendering
                    //   $("#peervideo" + mid).remove();
                    if (track?.kind === "video") {
                      this.remoteVideos--;
                      if (this.remoteVideos === 0) {
                        // No video, at least for now: show a placeholder
                      }
                    }
                    delete this.remoteTracks[mid];

                    return;
                  }

                  if (track.kind === "audio") {
                    // New audio track: create a stream out of it, and use a hidden <audio> element
                    let stream = new MediaStream([track]);
                    this.remoteTracks[mid] = stream;
                    console.log("Created remote audio stream:", stream);

                    props.setRemoteStream(stream, mid, track.kind);

                    if (this.remoteVideos === 0) {
                      // No video, at least for now: show a placeholder
                    }
                  } else {
                    // New video track: create a stream out of it
                    this.remoteVideos++;
                    let stream = new MediaStream([track]);
                    this.remoteTracks[mid] = stream;
                    console.log("Created remote video stream:", stream);
                    props.setRemoteStream(stream, mid, track.kind);
                  }

                  // this.audioenabled = true;
                  // this.videoenabled = true;
                },
                // eslint-disable-next-line no-unused-vars
                ondataopen: (label: any, protocol: any) => {
                  console.log("The DataChannel is available!");
                },
                ondata: (data: any) => {
                  console.info("We got data from the DataChannel!", data);
                  // $("#datarecv").val(data);
                },
                oncleanup: () => {
                  console.log(" ::: Got a cleanup notification :::");
                  // $("#videoleft").empty().parent().unblock();
                  // $("#videoright").empty();
                  // $("#callee").empty().addClass("hide");
                  this.yourusername = null;
                  // $("#curbitrate").addClass("hide");
                  // $("#curres").addClass("hide");
                  // $("#videos").addClass("hide");
                  // $("#toggleaudio").attr("disabled", true);
                  // $("#togglevideo").attr("disabled", true);
                  // $("#bitrate").attr("disabled", true);
                  // $("#curbitrate").addClass("hide");
                  // $("#curres").addClass("hide");
                  if (this.bitrateTimer) {
                    clearInterval(this.bitrateTimer);
                  }
                  this.bitrateTimer = null;
                  // $("#videos").addClass("hide");
                  this.simulcastStarted = false;

                  this.localTracks = {};
                  this.localVideos = 0;
                  this.remoteTracks = {};
                  this.remoteVideos = 0;
                  this.isInCall = false;
                  props.onCleanup();
                },
              });
            },
            error: (error: any) => {
              console.error(error);
            },
            destroyed: () => {
              console.error(`ToDo: handle destroy`);
            },
          });

          resolve(true);
        },
      });
      this.janus = janus;
    });
  };
}
