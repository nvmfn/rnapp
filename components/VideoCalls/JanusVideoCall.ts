// const Janus = require("./Janus.js");
// import * as Janus from "./Janus.js";
// import { Janus } from "./janus";
import { Janus } from "./janusLast";

function setBandwidth(opt: { audio: number; video: number }, event: any) {
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
// setBandwidth({ audio: 16, video: 64 }, jsep);

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
export class JanusVideoCall {
  public videocall: any = null;
  private opaqueId = "videocalltest-" + randomString(12);

  private localTracks: any = {};
  private localVideos = 0;
  private remoteTracks: any = {};
  private remoteVideos = 0;
  private bitrateTimer: any = null;

  private audioenabled = false;
  private videoenabled = false;

  private myusername = null;
  private yourusername: any = "";

  private doSimulcast: boolean = false;
  private simulcastStarted: any = false;
  private janus: any = null;

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
      this.videocall?.send({ message: { request: "set", bitrate: bitrate } });
      return true;
    }
    return false;
  };
  public toogleVideo = () => {
    this.videoenabled = !this.videoenabled;
    if (this.videocall) {
      this.videocall.send({ message: { request: "set", video: this.videoenabled } });
    }
    return this.videoenabled;
  };

  public toogleAudio = () => {
    this.audioenabled = !this.audioenabled;
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
      return true;
    }
    return true;
  };

  public init = async (props: {
    setRemoteVideoStream: any; //
    onNewMediaState: any; //
    setLovalVideoStream: any;
    onWaitingForAnswer: any;
    onAcceptedCall: any;
    onNewWebrtcState: any;
    onIncomingCall: any;
  }) => {
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
                  console.warn("Janus reports problems " + (uplink ? "sending" : "receiving") + " packets on mid " + mid + " (" + lost + " lost packets)");
                },
                onmessage: (msg: any, jsep: any) => {
                  if (jsep) {
                    setBandwidth({ audio: 16, video: 64 }, jsep);
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
                        //   $("#phone").removeClass("invisible");
                        //   $("#call").unbind("click").click(doCall);
                        //   $("#peer").focus();
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
                              //   $("#peer").attr("disabled", true);
                              //   $("#call")
                              //     .removeAttr("disabled")
                              //     .html("Hangup")
                              //     .removeClass("btn-success")
                              //     .addClass("btn-danger")
                              //     .unbind("click")
                              //     .click(doHangup);
                            },
                            error: (error: any) => {
                              console.error("WebRTC error:", error);
                              console.log("WebRTC error... " + error.message);
                            },
                          });
                        };

                        props.onIncomingCall(this.answerToCall, this.doHangup);
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
                        //   $("#waitingvideo").remove();
                        //   $("#videos").addClass("hide");
                        //   $("#peer").removeAttr("disabled").val("");
                        //   $("#call").removeAttr("disabled").html("Call").removeClass("btn-danger").addClass("btn-success").unbind("click").click(doCall);
                        //   $("#toggleaudio").attr("disabled", true);
                        //   $("#togglevideo").attr("disabled", true);
                        //   $("#bitrate").attr("disabled", true);
                        //   $("#curbitrate").addClass("hide");
                        //   $("#curres").addClass("hide");
                      } else if (event === "simulcast") {
                        // Is simulcast in place?
                        let substream = result["substream"];
                        let temporal = result["temporal"];
                        if ((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
                          // debugger;
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
                    //   $("#waitingvideo").remove();
                    //   $("#videos").addClass("hide");
                    //   $("#peer").removeAttr("disabled").val("");
                    //   $("#call").removeAttr("disabled").html("Call").removeClass("btn-danger").addClass("btn-success").unbind("click").click(doCall);
                    //   $("#toggleaudio").attr("disabled", true);
                    //   $("#togglevideo").attr("disabled", true);
                    //   $("#bitrate").attr("disabled", true);
                    //   $("#curbitrate").addClass("hide");
                    //   $("#curres").addClass("hide");
                    if (this.bitrateTimer) {
                      clearInterval(this.bitrateTimer);
                    }
                    this.bitrateTimer = null;
                  }
                },
                onlocaltrack: (track: any, on: any) => {
                  // ---------- onlocaltrack
                  console.info("Local track " + (on ? "added" : "removed") + ":", track);
                  // props.setLovalVideoStream(track);

                  // We use the track ID as name of the element, but it may contain invalid characters
                  let trackId = track.id.replace(/[{}]/g, "");
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
                        //   if ($("#videoleft .no-video-container").length === 0) {
                        //     $("#videoleft").append(
                        //       '<div class="no-video-container">' +
                        //         '<i class="fa-solid fa-video fa-xl no-video-icon"></i>' +
                        //         '<span class="no-video-text">No webcam available</span>' +
                        //         "</div>"
                        //     );
                        //   }
                      }
                    }
                    delete this.localTracks[trackId];
                    return;
                  }
                  // If we're here, a new track was added
                  let stream = this.localTracks[trackId];
                  if (stream) {
                    // We've been here already
                    return;
                  }
                  // if ($("#videoleft video").length === 0) {
                  //   $("#videos").removeClass("hide");
                  // }
                  if (track.kind === "audio") {
                    // We ignore local audio tracks, they'd generate echo anyway
                    if (this.localVideos === 0) {
                      // No video, at least for now: show a placeholder
                      // if ($("#videoleft .no-video-container").length === 0) {
                      //   $("#videoleft").append(
                      //     '<div class="no-video-container">' +
                      //       '<i class="fa-solid fa-video fa-xl no-video-icon"></i>' +
                      //       '<span class="no-video-text">No webcam available</span>' +
                      //       "</div>"
                      //   );
                      // }
                    }
                  } else {
                    // New video track: create a stream out of it
                    this.localVideos++;
                    //   $("#videoleft .no-video-container").remove();
                    stream = new MediaStream([track]);
                    this.localTracks[trackId] = stream;
                    console.log("Created local stream:", stream);
                    //   $("#videoleft").append(
                    //     '<video class="rounded centered" id="myvideo' + trackId + '" width="100%" height="100%" autoplay playsinline muted="muted"/>'
                    //   );

                    props.setLovalVideoStream(stream);
                    //   props.setVideoStream(stream);
                    //   //   Janus.attachMediaStream(props.getVideoRef(), stream);
                    //   //   Janus.attachMediaStream($("#myvideo" + trackId).get(0), stream);
                  }
                  // if (this.videocall.webrtcStuff.pc.iceConnectionState !== "completed" && this.videocall.webrtcStuff.pc.iceConnectionState !== "connected") {
                  //   console.log(`videoleft: Publishing...`);
                  //   //   $("#videoleft")
                  //   //     .parent()
                  //   //     .block({
                  //   //       message: "<b>Publishing...</b>",
                  //   //       css: {
                  //   //         border: "none",
                  //   //         backgroundColor: "transparent",
                  //   //         color: "white",
                  //   //       },
                  //   //     });
                  // }
                },
                // old / new name  onremotetrack
                onremotetrack: (track: any, mid: any, on: any, metadata: any) => {
                  console.info("Remote track (mid=" + mid + ") " + (on ? "added" : "removed") + (metadata ? " (" + metadata.reason + ") " : "") + ":", track);

                  // props.setRemoteVideoStream(track);
                  // // return;

                  if (!on) {
                    // Track removed, get rid of the stream and the rendering
                    //   $("#peervideo" + mid).remove();
                    if (track?.kind === "video") {
                      this.remoteVideos--;
                      if (this.remoteVideos === 0) {
                        // No video, at least for now: show a placeholder
                        //   if ($("#videoright .no-video-container").length === 0) {
                        //     $("#videoright").append(
                        //       '<div class="no-video-container">' +
                        //         '<i class="fa-solid fa-video fa-xl no-video-icon"></i>' +
                        //         '<span class="no-video-text">No remote video available</span>' +
                        //         "</div>"
                        //     );
                        //   }
                      }
                    }
                    delete this.remoteTracks[mid];
                    return;
                  }
                  // if ($("#peervideo" + mid).length > 0) return;
                  // If we're here, a new track was added
                  // $("#spinner").remove();
                  let addButtons = false;
                  // if ($("#videoright audio").length === 0 && $("#videoright video").length === 0) {
                  //   addButtons = true;
                  //   $("#videos").removeClass("hide");
                  // }
                  if (track.kind === "audio") {
                    // New audio track: create a stream out of it, and use a hidden <audio> element
                    //   let stream = new MediaStream([track]);
                    //   this.remoteTracks[mid] = stream;
                    //   console.log("Created remote audio stream:", stream);
                    //   $("#videoright").append('<audio class="hide" id="peervideo' + mid + '" autoplay playsinline/>');
                    //   Janus.attachMediaStream($("#peervideo" + mid).get(0), stream);
                    //   props.setAudioStream(track);

                    if (this.remoteVideos === 0) {
                      // No video, at least for now: show a placeholder
                      // if ($("#videoright .no-video-container").length === 0) {
                      //   $("#videoright").append(
                      //     '<div class="no-video-container">' +
                      //       '<i class="fa-solid fa-video fa-xl no-video-icon"></i>' +
                      //       '<span class="no-video-text">No webcam available</span>' +
                      //       "</div>"
                      //   );
                      // }
                    }
                  } else {
                    // New video track: create a stream out of it
                    this.remoteVideos++;
                    //   $("#videoright .no-video-container").remove();
                    let stream = new MediaStream([track]);
                    this.remoteTracks[mid] = stream;
                    console.log("Created remote video stream:", stream);
                    //   $("#videoright").append('<video class="rounded centered" id="peervideo' + mid + '" width="100%" height="100%" autoplay playsinline/>');
                    //   Janus.attachMediaStream($("#peervideo" + mid).get(0), stream);
                    //   Janus.attachMediaStream(props.getVideoRef(), stream);

                    // debugger;
                    props.setRemoteVideoStream(stream);
                    //   props.setVideoStream(stream);

                    // Note: we'll need this for additional videos too
                    if (!this.bitrateTimer) {
                      // $("#curbitrate").removeClass("hide");
                      // this.bitrateTimer = setInterval(() => {
                      //   if (!$("#peervideo" + mid).get(0)) return;
                      //   // Display updated bitrate, if supported
                      // let bitrate = this.videocall.getBitrate();
                      console.info("Current bitrate is ", this.videocall.getBitrate());
                      //   $("#curbitrate").text(bitrate);
                      //   // Check if the resolution changed too
                      //   let width = $("#peervideo" + mid).get(0).videoWidth;
                      //   let height = $("#peervideo" + mid).get(0).videoHeight;
                      //   if (width > 0 && height > 0)
                      //     $("#curres")
                      //       .removeClass("hide")
                      //       .text(width + "x" + height)
                      //       .removeClass("hide");
                      // }, 1000);
                    }
                  }
                  if (!addButtons) return;
                  // Enable audio/video buttons and bitrate limiter
                  this.audioenabled = true;
                  this.videoenabled = true;
                  // $("#toggleaudio")
                  //   .removeAttr("disabled")
                  //   .click(() => {
                  //     this.audioenabled = !this.audioenabled;
                  //     if (this.audioenabled) {
                  //       //   $("#toggleaudio").html("Disable audio").removeClass("btn-success").addClass("btn-danger");
                  //     } else {
                  //       //   $("#toggleaudio").html("Enable audio").removeClass("btn-danger").addClass("btn-success");
                  //     }
                  //     this.videocall.send({ message: { request: "set", audio: this.audioenabled } });
                  //   });
                  // $("#togglevideo")
                  //   .removeAttr("disabled")
                  //   .click(() => {
                  //     this.videoenabled = !this.videoenabled;
                  //     if (this.videoenabled) {
                  //       //   $("#togglevideo").html("Disable video").removeClass("btn-success").addClass("btn-danger");
                  //     } else {
                  //       //   $("#togglevideo").html("Enable video").removeClass("btn-danger").addClass("btn-success");
                  //     }
                  //     this.videocall.send({ message: { request: "set", video: this.videoenabled } });
                  //   });
                  // $("#toggleaudio").parent().removeClass("hide");
                  // $("#bitrate a")
                  //   .removeAttr("disabled")
                  //   .click(() => {
                  //     // $(".dropdown-toggle").dropdown("hide");
                  //     let id = $(this).attr("id");
                  //     let bitrate = parseInt(id) * 1000;
                  //     if (bitrate === 0) {
                  //       console.log("Not limiting bandwidth via REMB");
                  //     } else {
                  //       console.log("Capping bandwidth to " + bitrate + " via REMB");
                  //     }
                  //     // $("#bitrateset").text($(this).text()).parent().removeClass("open");
                  //     this.videocall.send({ message: { request: "set", bitrate: bitrate } });
                  //     return false;
                  //   });
                },
                // eslint-disable-next-line no-unused-vars
                ondataopen: (label: any, protocol: any) => {
                  console.log("The DataChannel is available!");
                  // $("#videos").removeClass("hide");
                  // $("#datasend").removeAttr("disabled");
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
                  // $("#simulcast").remove();
                  // $("#peer").removeAttr("disabled").val("");
                  // $("#call").removeAttr("disabled").html("Call").removeClass("btn-danger").addClass("btn-success").unbind("click").click(doCall);
                  this.localTracks = {};
                  this.localVideos = 0;
                  this.remoteTracks = {};
                  this.remoteVideos = 0;
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
